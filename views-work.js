// ================================================================
// views-work.js - WORK MANAGEMENT (Tasks, Meetings, Unified View)
// ================================================================
// ================================================================
// HELPER: PARSE THAI DATE (DD/MM/YYYY)
// ================================================================
function parseThaiDate(str) {
  if (!str) return null;
  var parts = str.split('/');
  if (parts.length !== 3) return null;
  var day = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1;
  var year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}

// ================================================================
// UNIFIED TASKS PAGE (List + Kanban + Timeline)
// ================================================================
var tasksView = 'list';      // 'list', 'kanban', 'timeline'
var tasksGroupBy = 'none';   // 'none', 'dealer', 'status', 'dueDate'
var tasksFilterStatus = 'all';   // 'all', 'active', 'completed', 'on-hold'
var tasksFilterPriority = 'all'; // 'all', 'high', 'medium', 'low'
var tasksFilterDealer = 'all';
var tasksFilterCategory = 'all';
var tasksSearch = '';

// ตัวแปรสำหรับ Kanban drag & drop
var dragSourceTaskId = null;

function rUnifiedTasks(el) {
  document.getElementById('pgT').textContent = '📋 งานทั้งหมด';
  
  var allTasks = ST.getAll('tasks');
  var dealers = ST.getAll('dealers');
  var categories = getUniqueCategories(allTasks);
  
  var filteredTasks = filterTasks(allTasks);
  
  filteredTasks.sort(function(a, b) {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
  
  var groupedTasks = groupTasks(filteredTasks, tasksGroupBy);
  var stats = getTaskStats(allTasks);
  
  var h = '';
  
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<h2 style="font-size:1rem;margin:0">📋 จัดการงาน</h2>';
  h += '<button class="btn bp" onclick="showTaskM()">➕ เพิ่มงาน</button>';
  h += '</div>';
  
  h += '<div class="today-tabs" style="margin-bottom:12px">';
  h += '<div class="today-tab ' + (tasksView === 'list' ? 'act' : '') + '" onclick="tasksView=\'list\';render()">📋 รายการ</div>';
  h += '<div class="today-tab ' + (tasksView === 'kanban' ? 'act' : '') + '" onclick="tasksView=\'kanban\';render()">📊 Kanban</div>';
  h += '<div class="today-tab ' + (tasksView === 'timeline' ? 'act' : '') + '" onclick="tasksView=\'timeline\';render()">⏰ เส้นเวลา</div>';
  h += '</div>';
  
  h += renderTaskFilterBar(dealers, categories, stats);
  
  h += '<div class="sr" style="margin-bottom:12px">';
  h += '<div class="sc"><div class="sn c1">' + stats.total + '</div><div class="sl">ทั้งหมด</div></div>';
  h += '<div class="sc"><div class="sn c2">' + stats.active + '</div><div class="sl">กำลังทำ</div></div>';
  h += '<div class="sc"><div class="sn c3">' + stats.overdue + '</div><div class="sl">เลยกำหนด</div></div>';
  h += '<div class="sc"><div class="sn c5">' + stats.completed + '</div><div class="sl">เสร็จแล้ว</div></div>';
  h += '</div>';
  
  if (tasksView === 'list') {
    h += renderTaskListView(groupedTasks, filteredTasks.length);
  } else if (tasksView === 'kanban') {
    h += renderKanbanView();
  } else if (tasksView === 'timeline') {
    h += renderTimelineView(filteredTasks);
  }
  
  el.innerHTML = h;
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

function getUniqueCategories(tasks) {
  var cats = {};
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].category) cats[tasks[i].category] = true;
  }
  var result = Object.keys(cats).sort();
  result.unshift('all');
  return result;
}

function getTaskStats(tasks) {
  var active = 0, completed = 0, onHold = 0, overdue = 0;
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  
  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    if (t.status === 'active') {
      active++;
      if (t.dueDate) {
        var due = parseThaiDate(t.dueDate);
        if (due && due < now) overdue++;
      }
    } else if (t.status === 'completed') completed++;
    else if (t.status === 'on-hold') onHold++;
  }
  
  return {
    total: tasks.length,
    active: active,
    completed: completed,
    onHold: onHold,
    overdue: overdue
  };
}

function filterTasks(tasks) {
  return tasks.filter(function(t) {
    if (tasksFilterStatus !== 'all' && t.status !== tasksFilterStatus) return false;
    if (tasksFilterPriority !== 'all' && t.priority !== tasksFilterPriority) return false;
    if (tasksFilterDealer !== 'all' && t.dealerId !== tasksFilterDealer) return false;
    if (tasksFilterCategory !== 'all' && t.category !== tasksFilterCategory) return false;
    if (tasksSearch) {
      var q = tasksSearch.toLowerCase();
      if (!(t.title || '').toLowerCase().includes(q) &&
          !(t.description || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function groupTasks(tasks, groupBy) {
  if (groupBy === 'none') return { '': tasks };
  
  var groups = {};
  
  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    var key = '';
    
    if (groupBy === 'dealer') {
      var dealer = ST.getOne('dealers', t.dealerId);
      key = dealer ? dealer.name : '🏪 ไม่ระบุ Dealer';
    } else if (groupBy === 'status') {
      var statusLabels = { active: '🔄 กำลังทำ', completed: '✅ เสร็จ', 'on-hold': '⏸ พัก' };
      key = statusLabels[t.status] || t.status;
    } else if (groupBy === 'dueDate') {
      key = getDueDateGroup(t.dueDate);
    }
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  
  var sortedKeys = Object.keys(groups).sort();
  if (groupBy === 'dueDate') {
    var order = ['🔴 เลยกำหนด', '🟠 วันนี้', '🟡 พรุ่งนี้', '📅 สัปดาห์นี้', '📆 เดือนนี้', '🗓️ อนาคต', '✅ เสร็จแล้ว'];
    sortedKeys.sort(function(a, b) {
      return order.indexOf(a) - order.indexOf(b);
    });
  }
  
  var result = {};
  for (var i = 0; i < sortedKeys.length; i++) {
    result[sortedKeys[i]] = groups[sortedKeys[i]];
  }
  return result;
}

function getDueDateGroup(dueDate) {
  if (!dueDate) return '🗓️ ไม่กำหนด';
  
  var days = dTo(dueDate);
  if (days < 0) return '🔴 เลยกำหนด';
  if (days === 0) return '🟠 วันนี้';
  if (days === 1) return '🟡 พรุ่งนี้';
  if (days <= 7) return '📅 สัปดาห์นี้';
  if (days <= 30) return '📆 เดือนนี้';
  return '🗓️ อนาคต';
}

// ================================================================
// FILTER BAR
// ================================================================

function renderTaskFilterBar(dealers, categories, stats) {
  var dealerOpts = '<option value="all">🏪 ทุก Dealer</option>';
  for (var i = 0; i < dealers.length; i++) {
    dealerOpts += '<option value="' + dealers[i].id + '">' + sanitize(dealers[i].name) + '</option>';
  }
  
  var catOpts = '<option value="all">📂 ทุกหมวด</option>';
  for (var i = 0; i < categories.length; i++) {
    if (categories[i] !== 'all') {
      catOpts += '<option value="' + sanitize(categories[i]) + '">' + sanitize(categories[i]) + '</option>';
    }
  }
  
  return `
  <div class="card" style="padding:12px;margin-bottom:12px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <input type="text" id="taskSearch" value="${sanitize(tasksSearch)}" 
        placeholder="🔍 ค้นหางาน..." style="flex:1;min-width:150px"
        oninput="tasksSearch=this.value;render()">
      <button class="btn bsm bo" onclick="clearTaskFilters()">✕ ล้างตัวกรอง</button>
    </div>
    
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <select id="taskStatusFilter" onchange="tasksFilterStatus=this.value;render()" style="width:110px">
        <option value="all" ${tasksFilterStatus === 'all' ? 'selected' : ''}>✅ สถานะทั้งหมด</option>
        <option value="active" ${tasksFilterStatus === 'active' ? 'selected' : ''}>🔄 กำลังทำ</option>
        <option value="completed" ${tasksFilterStatus === 'completed' ? 'selected' : ''}>✅ เสร็จ</option>
        <option value="on-hold" ${tasksFilterStatus === 'on-hold' ? 'selected' : ''}>⏸ พัก</option>
      </select>
      
      <select id="taskPriorityFilter" onchange="tasksFilterPriority=this.value;render()" style="width:100px">
        <option value="all" ${tasksFilterPriority === 'all' ? 'selected' : ''}>🎯 ทุกระดับ</option>
        <option value="high" ${tasksFilterPriority === 'high' ? 'selected' : ''}>🔴 สำคัญ</option>
        <option value="medium" ${tasksFilterPriority === 'medium' ? 'selected' : ''}>🟡 กลาง</option>
        <option value="low" ${tasksFilterPriority === 'low' ? 'selected' : ''}>🟢 ทั่วไป</option>
      </select>
      
      <select id="taskDealerFilter" onchange="tasksFilterDealer=this.value;render()" style="min-width:130px">
        ${dealerOpts}
      </select>
      
      <select id="taskCatFilter" onchange="tasksFilterCategory=this.value;render()" style="min-width:120px">
        ${catOpts}
      </select>
      
      <select id="taskGroupBy" onchange="tasksGroupBy=this.value;render()" style="width:130px">
        <option value="none" ${tasksGroupBy === 'none' ? 'selected' : ''}>📌 ไม่จัดกลุ่ม</option>
        <option value="dealer" ${tasksGroupBy === 'dealer' ? 'selected' : ''}>🏪 ตาม Dealer</option>
        <option value="status" ${tasksGroupBy === 'status' ? 'selected' : ''}>📊 ตามสถานะ</option>
        <option value="dueDate" ${tasksGroupBy === 'dueDate' ? 'selected' : ''}>📅 ตามกำหนด</option>
      </select>
    </div>
  </div>
  `;
}

function clearTaskFilters() {
  tasksSearch = '';
  tasksFilterStatus = 'all';
  tasksFilterPriority = 'all';
  tasksFilterDealer = 'all';
  tasksFilterCategory = 'all';
  tasksGroupBy = 'none';
  render();
}

// ================================================================
// LIST VIEW
// ================================================================

function renderTaskListView(groupedTasks, totalCount) {
  if (totalCount === 0) {
    return '<div class="empty"><div class="icon">📋</div><p>ไม่พบงาน<br><button class="btn bp" onclick="showTaskM()" style="margin-top:8px">➕ เพิ่มงาน</button></p></div>';
  }
  
  var h = '';
  var groupKeys = Object.keys(groupedTasks);
  
  for (var g = 0; g < groupKeys.length; g++) {
    var groupName = groupKeys[g];
    var tasks = groupedTasks[groupName];
    
    if (groupName) {
      h += '<div style="margin:16px 0 8px 0;padding-bottom:4px;border-bottom:2px solid var(--accent)">';
      h += '<h3 style="font-size:14px;font-weight:700;color:var(--accent)">' + groupName + ' (' + tasks.length + ')</h3>';
      h += '</div>';
    }
    
    h += '<div class="task-grid" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">';
    
    for (var i = 0; i < tasks.length; i++) {
      h += renderTaskCard(tasks[i]);
    }
    
    h += '</div>';
  }
  
  return h;
}

function renderTaskCard(t) {
  var isCompleted = t.status === 'completed';
  var daysLeft = t.dueDate ? dTo(t.dueDate) : null;
  var urgencyClass = '';
  var urgencyLabel = '';
  
  if (!isCompleted && daysLeft !== null) {
    if (daysLeft < 0) {
      urgencyClass = 'task-overdue';
      urgencyLabel = '<span class="task-urgent-badge task-badge-red">🔴 เกิน ' + Math.abs(daysLeft) + ' วัน</span>';
    } else if (daysLeft === 0) {
      urgencyClass = 'task-today';
      urgencyLabel = '<span class="task-urgent-badge task-badge-orange">🟠 วันนี้!</span>';
    } else if (daysLeft === 1) {
      urgencyClass = 'task-tomorrow';
      urgencyLabel = '<span class="task-urgent-badge task-badge-yellow">🟡 พรุ่งนี้</span>';
    } else if (daysLeft <= 3) {
      urgencyLabel = '<span class="task-urgent-badge task-badge-yellow">🟡 อีก ' + daysLeft + ' วัน</span>';
    }
  }
  
  var priorityIcon = '';
  if (t.priority === 'high') priorityIcon = '🔴';
  else if (t.priority === 'medium') priorityIcon = '🟡';
  else priorityIcon = '🟢';
  
  var statusIcon = '';
  if (t.status === 'active') statusIcon = '🔄';
  else if (t.status === 'completed') statusIcon = '✅';
  else if (t.status === 'on-hold') statusIcon = '⏸';
  
  var dealer = t.dealerId ? ST.getOne('dealers', t.dealerId) : null;
  var dealerHtml = dealer ? '<span class="task-dealer">🏪 ' + sanitize(dealer.name) + '</span>' : '';
  
  var pipelineHtml = '';
  if (t.pipeId) {
    var pipe = ST.getOne('pipeline', t.pipeId);
    if (pipe) {
      pipelineHtml = '<span class="task-pipeline">📊 ' + sanitize((pipe.projectName || '').substr(0, 25)) + '</span>';
    }
  }
  
  var pg = prog(t);
  var progressHtml = '';
  if (pg > 0 && pg < 100) {
    progressHtml = '<div class="pb" style="height:4px;margin:6px 0 0 0"><div class="pf pf-blue" style="width:' + pg + '%"></div></div>';
  }
  
  var fuCount = countTaskFollowups(t);
  var fuHtml = '';
  if (fuCount > 0) {
    fuHtml = '<span class="task-fu-badge" title="ติดตาม ' + fuCount + ' ครั้ง">📞' + fuCount + '</span>';
  }
  
  var cardClass = 'task-card';
  if (urgencyClass) cardClass += ' ' + urgencyClass;
  if (isCompleted) cardClass += ' task-completed';
  
  var checkedAttr = isCompleted ? 'checked' : '';
  
  return `
  <div class="${cardClass}" data-task-id="${t.id}">
    <div class="task-card-left">
      <input type="checkbox" class="task-complete-chk" ${checkedAttr} 
        onclick="event.stopPropagation();toggleTaskComplete('${t.id}', this.checked)">
    </div>
    <div class="task-card-body" onclick="go('taskDetail',{taskId:'${t.id}'})">
      <div class="task-card-header">
        <span class="task-title">${priorityIcon} ${sanitize(t.title)}</span>
        <span class="task-status">${statusIcon} ${t.status === 'active' ? 'กำลังทำ' : t.status === 'completed' ? 'เสร็จ' : 'พัก'}</span>
        ${urgencyLabel}
      </div>
      <div class="task-card-meta">
        ${dealerHtml}
        ${pipelineHtml}
        ${t.category ? '<span class="task-category">📂 ' + sanitize(t.category) + '</span>' : ''}
        ${t.dueDate ? '<span class="task-due">📅 ' + fDShort(t.dueDate) + '</span>' : ''}
        ${fuHtml}
      </div>
      ${progressHtml}
    </div>
    <div class="task-card-actions" onclick="event.stopPropagation()">
      <button class="task-action-btn" onclick="showQuickUpdateTaskM('${t.id}')" title="อัพเดทด่วน">📝</button>
      <button class="task-action-btn" onclick="showStepFuM('${t.id}', -1)" title="ติดตาม">📞</button>
      <button class="task-action-btn" onclick="startTimer('task','${t.id}','${sanitize(t.title).substr(0,15)}')" title="จับเวลา">⏱️</button>
      <button class="task-action-btn" onclick="toast('🚧 กำลังพัฒนา')" title="ส่งไปปฏิทิน">📅</button>
    </div>
  </div>
  `;
}

function countTaskFollowups(t) {
  if (!t.steps) return 0;
  var count = 0;
  for (var i = 0; i < t.steps.length; i++) {
    if (t.steps[i].followups) {
      count += t.steps[i].followups.length;
    }
  }
  return count;
}

function toggleTaskComplete(taskId, isChecked) {
  var newStatus = isChecked ? 'completed' : 'active';
  ST.update('tasks', taskId, {status: newStatus});
  
  if (isChecked) {
    ST.add('taskLogs', {tid: taskId, type: 'completed', content: '✅ งานเสร็จสิ้น', date: _nw()});
  }
  
  toast(isChecked ? '✅ ทำเครื่องหมายเสร็จ' : '🔄 กลับเป็นกำลังทำ');
  render();
}

function showQuickUpdateTaskM(taskId) {
  var t = ST.getOne('tasks', taskId);
  if (!t) return;
  
  openM('📝 อัพเดทด่วน — ' + sanitize(t.title), `
    <div class="fg"><label>📝 อัพเดท</label>
    <textarea id="qu_task_note" rows="3" placeholder="พิมพ์อัพเดท..."></textarea></div>
    <div class="fg"><label>🔄 เปลี่ยนสถานะ</label>
    <select id="qu_task_status">
      <option value="active" ${t.status === 'active' ? 'selected' : ''}>🔄 กำลังทำ</option>
      <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>✅ เสร็จ</option>
      <option value="on-hold" ${t.status === 'on-hold' ? 'selected' : ''}>⏸ พัก</option>
    </select></div>
    <div class="fr">${dpH('qu_task_date', _td(), 'วันที่')}</div>
    <div class="fm-actions">
      <button class="btn btn-blue" onclick="saveQuickUpdateTask('${taskId}')">💾 บันทึก</button>
      <button class="btn" onclick="closeM()">ยกเลิก</button>
    </div>
  `);
}

function saveQuickUpdateTask(taskId) {
  var note = document.getElementById('qu_task_note') ? document.getElementById('qu_task_note').value.trim() : '';
  var newStatus = document.getElementById('qu_task_status') ? document.getElementById('qu_task_status').value : 'active';
  var date = dpG('qu_task_date') || _td();
  
  if (note) {
    ST.add('taskLogs', {tid: taskId, type: 'update', content: note, date: date + 'T' + new Date().toTimeString().slice(0,8)});
  }
  
  ST.update('tasks', taskId, {status: newStatus});
  
  closeMForce();
  toast('💾 อัพเดทแล้ว');
  render();
}

function exportTaskToCalendar(taskId) {
  var t = ST.getOne('tasks', taskId);
  if (!t) return;
  
  var summary = '📋 ' + t.title;
  var description = t.description || '';
  if (t.dealerId) {
    var d = ST.getOne('dealers', t.dealerId);
    if (d) description = 'Dealer: ' + d.name + '\n\n' + description;
  }
  var startDate = t.startDate;
  var endDate = t.dueDate;
  
  exportToICS(summary, description, startDate, endDate, '', window.location.href);
}

// ================================================================
// KANBAN VIEW
// ================================================================

function renderKanbanView() {
  var allTasks = ST.getAll('tasks');
  var filteredTasks = filterTasks(allTasks);
  
  var columns = [
    { id: 'todo', name: '📥 รอทำ', color: '#64748b', tasks: [] },
    { id: 'doing', name: '🔄 กำลังทำ', color: '#3b82f6', tasks: [] },
    { id: 'review', name: '👀 รอตรวจ', color: '#f59e0b', tasks: [] },
    { id: 'done', name: '✅ เสร็จ', color: '#22c55e', tasks: [] }
  ];
  
  for (var i = 0; i < filteredTasks.length; i++) {
    var t = filteredTasks[i];
    var colId = t.kanban || (t.status === 'completed' ? 'done' : t.status === 'active' ? 'todo' : 'todo');
    
    for (var c = 0; c < columns.length; c++) {
      if (columns[c].id === colId) {
        columns[c].tasks.push(t);
        break;
      }
    }
  }
  
  for (var c = 0; c < columns.length; c++) {
    columns[c].tasks.sort(function(a, b) {
      var priority = { high: 0, medium: 1, low: 2 };
      return (priority[a.priority] || 1) - (priority[b.priority] || 1);
    });
  }
  
  var h = '<div class="kanban-board" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:12px;min-height:500px">';
  
  for (var c = 0; c < columns.length; c++) {
    var col = columns[c];
    h += `
    <div class="kanban-col" data-col="${col.id}" 
      style="min-width:280px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid var(--border);display:flex;flex-direction:column"
      ondragover="event.preventDefault();kanbanDragOver(event)"
      ondragleave="kanbanDragLeave(event)"
      ondrop="kanbanDrop(event, '${col.id}')">
      
      <div class="kanban-col-header" style="padding:10px 12px;border-bottom:2px solid ${col.color};display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700">${col.name}</span>
        <span style="font-size:11px;background:${col.color}20;padding:2px 8px;border-radius:10px">${col.tasks.length}</span>
      </div>
      
      <div class="kanban-col-body" style="flex:1;padding:8px;display:flex;flex-direction:column;gap:6px;min-height:300px">
    `;
    
    if (col.tasks.length === 0) {
      h += '<div style="text-align:center;padding:20px;color:var(--text2);font-size:12px">— ว่าง —</div>';
    } else {
      for (var i = 0; i < col.tasks.length; i++) {
        h += renderKanbanCard(col.tasks[i], col.id);
      }
    }
    
    h += `
      </div>
    </div>
    `;
  }
  
  h += '</div>';
  h += '<div style="margin-top:8px;text-align:center;font-size:11px;color:var(--text2)">💡 ลากการ์ดไปยังคอลัมน์อื่นเพื่อเปลี่ยนสถานะ</div>';
  
  return h;
}

function renderKanbanCard(t, colId) {
  var dealer = t.dealerId ? ST.getOne('dealers', t.dealerId) : null;
  var daysLeft = t.dueDate ? dTo(t.dueDate) : null;
  var isOverdue = daysLeft !== null && daysLeft < 0 && t.status !== 'completed';
  
  var priorityIcon = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
  var priorityColor = t.priority === 'high' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : '#22c55e';
  
  var fuCount = countTaskFollowups(t);
  var fuBadge = fuCount > 0 ? '<span class="kanban-fu-badge">📞' + fuCount + '</span>' : '';
  
  var pg = prog(t);
  var progressHtml = '';
  if (pg > 0 && pg < 100) {
    progressHtml = '<div class="pb" style="height:3px;margin-top:6px"><div class="pf pf-blue" style="width:' + pg + '%"></div></div>';
  }
  
  return `
  <div class="kanban-card" draggable="true" 
    data-task-id="${t.id}" data-col="${colId}"
    style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px;cursor:grab;transition:0.15s"
    ondragstart="kanbanDragStart(event)"
    ondragend="kanbanDragEnd(event)"
    onclick="go('taskDetail',{taskId:'${t.id}'})">
    
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-weight:600;font-size:13px">${priorityIcon} ${sanitize(t.title).substr(0, 30)}</span>
        <span style="font-size:9px;padding:1px 6px;border-radius:8px;background:${priorityColor}20;color:${priorityColor}">${t.priority === 'high' ? 'High' : t.priority === 'medium' ? 'Medium' : 'Low'}</span>
      </div>
      ${fuBadge}
    </div>
    
    ${dealer ? '<div style="font-size:11px;color:var(--text2);margin-bottom:2px">🏪 ' + sanitize(dealer.name) + '</div>' : ''}
    
    ${t.dueDate ? '<div style="font-size:11px;color:' + (isOverdue ? '#ef4444' : 'var(--text2)') + '">📅 ' + fDShort(t.dueDate) + (isOverdue ? ' <span style="color:#ef4444">⚠️ เกิน ' + Math.abs(daysLeft) + ' วัน</span>' : '') + '</div>' : ''}
    
    ${progressHtml}
    
    <div style="display:flex;gap:4px;margin-top:8px;justify-content:flex-end">
      <button class="kanban-action" onclick="event.stopPropagation();showQuickUpdateTaskM('${t.id}')" title="อัพเดทด่วน" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer">📝</button>
      <button class="kanban-action" onclick="event.stopPropagation();startTimer('task','${t.id}','${sanitize(t.title).substr(0,15)}')" title="จับเวลา" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer">⏱️</button>
      ${t.status !== 'completed' ? '<button class="kanban-action" onclick="event.stopPropagation();toggleTaskComplete(\'' + t.id + '\', true)" title="เสร็จแล้ว" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer">✅</button>' : ''}
    </div>
  </div>
  `;
}

function kanbanDragStart(e) {
  var card = e.target.closest('.kanban-card');
  if (!card) return;
  
  dragSourceTaskId = card.dataset.taskId;
  e.dataTransfer.setData('text/plain', dragSourceTaskId);
  e.dataTransfer.effectAllowed = 'move';
  card.style.opacity = '0.4';
}

function kanbanDragEnd(e) {
  var card = e.target.closest('.kanban-card');
  if (card) card.style.opacity = '';
  dragSourceTaskId = null;
  
  var cols = document.querySelectorAll('.kanban-col');
  for (var i = 0; i < cols.length; i++) {
    cols[i].classList.remove('drag-over');
  }
}

function kanbanDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var col = e.target.closest('.kanban-col');
  if (col && !col.classList.contains('drag-over')) {
    col.classList.add('drag-over');
  }
}

function kanbanDragLeave(e) {
  var col = e.target.closest('.kanban-col');
  if (col) {
    col.classList.remove('drag-over');
  }
}

function kanbanDrop(e, newColId) {
  e.preventDefault();
  
  var cols = document.querySelectorAll('.kanban-col');
  for (var i = 0; i < cols.length; i++) {
    cols[i].classList.remove('drag-over');
  }
  
  var taskId = dragSourceTaskId || e.dataTransfer.getData('text/plain');
  if (!taskId) return;
  
  var task = ST.getOne('tasks', taskId);
  if (!task) return;
  
  var newStatus = 'active';
  var newKanban = newColId;
  
  if (newColId === 'done') {
    newStatus = 'completed';
  } else if (newColId === 'todo' || newColId === 'doing' || newColId === 'review') {
    newStatus = 'active';
  }
  
  ST.update('tasks', taskId, {
    status: newStatus,
    kanban: newKanban
  });
  
  var colNames = { todo: 'รอทำ', doing: 'กำลังทำ', review: 'รอตรวจ', done: 'เสร็จ' };
  ST.add('taskLogs', {
    tid: taskId,
    type: 'progress',
    content: '📋 ย้ายไปคอลัมน์ ' + colNames[newColId],
    date: _nw()
  });
  
  toast('📋 ย้ายงานไป ' + colNames[newColId]);
  
  dragSourceTaskId = null;
  render();
}

// ================================================================
// TIMELINE VIEW
// ================================================================

function renderTimelineView(tasks) {
  if (tasks.length === 0) {
    return '<div class="empty"><div class="icon">⏰</div><p>ไม่พบงานในเส้นเวลา</p></div>';
  }
  
  var activeTasks = tasks.filter(function(t) {
    return t.status !== 'completed' && t.dueDate;
  });
  
  if (activeTasks.length === 0) {
    return '<div class="empty"><div class="icon">⏰</div><p>ไม่มีงานที่กำลังดำเนินการและมีกำหนดส่ง</p></div>';
  }
  
  var byMonth = {};
  
  for (var i = 0; i < activeTasks.length; i++) {
    var t = activeTasks[i];
    var dueDate = parseThaiDate(t.dueDate);
    if (!dueDate) continue;
    
    var monthKey = (dueDate.getMonth() + 1) + '/' + dueDate.getFullYear();
    var monthName = getMonthName(dueDate.getMonth()) + ' ' + dueDate.getFullYear();
    
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { name: monthName, tasks: [] };
    }
    
    byMonth[monthKey].tasks.push(t);
  }
  
  var months = Object.keys(byMonth).sort(function(a, b) {
    var aParts = a.split('/');
    var bParts = b.split('/');
    var aDate = new Date(parseInt(aParts[1]), parseInt(aParts[0]) - 1, 1);
    var bDate = new Date(parseInt(bParts[1]), parseInt(bParts[0]) - 1, 1);
    return aDate - bDate;
  });
  
  var h = '<div class="timeline-view">';
  
  for (var m = 0; m < months.length; m++) {
    var monthKey = months[m];
    var month = byMonth[monthKey];
    var monthTasks = month.tasks;
    
    monthTasks.sort(function(a, b) {
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });
    
    h += '<div class="timeline-month">';
    h += '<div class="timeline-month-title">📅 ' + month.name + '</div>';
    
    var totalDays = getDaysInMonth(monthKey);
    var tasksByDay = {};
    
    for (var i = 0; i < monthTasks.length; i++) {
      var t = monthTasks[i];
      var day = parseInt(t.dueDate.split('/')[0]);
      if (!tasksByDay[day]) tasksByDay[day] = [];
      tasksByDay[day].push(t);
    }
    
    h += '<div class="timeline-grid">';
    
    for (var d = 1; d <= totalDays; d++) {
      var dayTasks = tasksByDay[d] || [];
      var isToday = isTodayDate(d, monthKey);
      var isPast = isPastDate(d, monthKey);
      
      h += '<div class="timeline-day ' + (isToday ? 'timeline-day-today' : '') + (isPast ? 'timeline-day-past' : '') + '">';
      h += '<div class="timeline-day-num">' + d + '</div>';
      
      for (var i = 0; i < dayTasks.length; i++) {
        var t = dayTasks[i];
        var daysLeft = dTo(t.dueDate);
        var isOverdue = daysLeft < 0;
        
        h += '<div class="timeline-task ' + (isOverdue ? 'timeline-task-overdue' : '') + '" onclick="go(\'taskDetail\',{taskId:\'' + t.id + '\'})">';
        h += '<div class="timeline-task-title">';
        if (t.priority === 'high') h += '🔴 ';
        else if (t.priority === 'medium') h += '🟡 ';
        else h += '🟢 ';
        h += sanitize(t.title).substr(0, 20);
        if (t.title.length > 20) h += '...';
        h += '</div>';
        if (t.dealerId) {
          var dealer = ST.getOne('dealers', t.dealerId);
          if (dealer) h += '<div class="timeline-task-dealer">' + sanitize(dealer.name).substr(0, 15) + '</div>';
        }
        h += '</div>';
      }
      
      h += '</div>';
    }
    
    h += '</div>';
    h += '</div>';
  }
  
  h += '</div>';
  return h;
}

function getMonthName(monthIndex) {
  var months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
                'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return months[monthIndex];
}

function getDaysInMonth(monthKey) {
  var parts = monthKey.split('/');
  var month = parseInt(parts[0]) - 1;
  var year = parseInt(parts[1]);
  return new Date(year, month + 1, 0).getDate();
}

function isTodayDate(day, monthKey) {
  var today = new Date();
  var parts = monthKey.split('/');
  var month = parseInt(parts[0]) - 1;
  var year = parseInt(parts[1]);
  
  return today.getDate() === day && 
         today.getMonth() === month && 
         today.getFullYear() === year;
}

function isPastDate(day, monthKey) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var parts = monthKey.split('/');
  var month = parseInt(parts[0]) - 1;
  var year = parseInt(parts[1]);
  var date = new Date(year, month, day);
  
  return date < today;
}

// ================================================================
// TASKS (Legacy - ยังใช้งานได้)
// ================================================================

function rTasks(el) {
  document.getElementById('pgT').textContent = '📋 งานอื่นๆ';
  let ts = ST.getAll('tasks');
  if (taskFlt === 'active') ts = ts.filter(t => t.status === 'active');
  else if (taskFlt === 'completed') ts = ts.filter(t => t.status === 'completed');
  else if (taskFlt === 'high') ts = ts.filter(t => t.priority === 'high' && t.status === 'active');
  else if (taskFlt === 'dealer') ts = ts.filter(function(t) { return !!t.dealerId; });
  ts.sort((a,b) => { if (a.status !== b.status) return a.status === 'active' ? -1 : 1; return ({high:0,medium:1,low:2}[a.priority]||1) - ({high:0,medium:1,low:2}[b.priority]||1); });

  el.innerHTML = `
  <div style="margin-bottom:8px;display:flex;gap:5px;flex-wrap:wrap">
    <button class="btn bp" onclick="showTaskM()">➕ เพิ่มงาน</button>
    <button class="btn bo" onclick="go('kanban')">📋 Kanban</button>
  </div>
  <div class="ftabs">
    <div class="ftab ${taskFlt==='all'?'act':''}" onclick="taskFlt='all';render()">ทั้งหมด (${ST.count('tasks')})</div>
    <div class="ftab ${taskFlt==='active'?'act':''}" onclick="taskFlt='active';render()">กำลังทำ</div>
    <div class="ftab ${taskFlt==='completed'?'act':''}" onclick="taskFlt='completed';render()">เสร็จ</div>
    <div class="ftab ${taskFlt==='high'?'act':''}" onclick="taskFlt='high';render()">🔴 สำคัญ</div>
    <div class="ftab ${taskFlt==='dealer'?'act':''}" onclick="taskFlt='dealer';render()">🏪 Dealer</div>
  </div>
  ${ts.length ? ts.map(t => { const pg = prog(t); return `<div class="li ${dlC(t.dueDate, t.status==='completed')}" onclick="go('taskDetail',{taskId:'${t.id}'})"><div class="lm">
    <div class="lt">${sanitize(t.title)} ${sTag(t.status)} ${pTag(t.priority)} ${t.sequential?'<span class="tag tag-count">⚡</span>':''}</div>
    <div class="ls">${t.dealerId?(function(){var dd=ST.getOne('dealers',t.dealerId);return dd?'🏪 '+dd.name+' • ':''})():''}${t.category?'📂 '+t.category+' • ':''}${fD(t.dueDate)} ${dlB(t.dueDate, t.status==='completed')}</div>
    ${t.steps?.length?`<div class="pb"><div class="pf pf-blue" style="width:${pg}%"></div></div><div class="ls">${pg}%</div>`:''}</div></div>`; }).join('') : '<div class="empty"><div class="icon">📋</div><p>ยังไม่มีงาน</p></div>'}`;
}

// ================================================================
// TASK DETAIL
// ================================================================

function rTaskDet(el) {
  const t = ST.getOne('tasks', S.taskId);
  if (!t) return go('tasks');
  const logs = ST.taskLogsByTask(t.id);
  const pg = prog(t);
  const isPinned = ST.hasPin(t.id);
  document.getElementById('pgT').textContent = '📋 ' + t.title;

  el.innerHTML = `
  <div class="bc"><a onclick="go('tasks')">📋 งาน</a><span class="sep">›</span><span class="cur">${sanitize(t.title)}</span></div>

  <div class="card"><h2>📋 ข้อมูลงาน <span class="ml">
    <button class="btn bsm bs" onclick="startTimer('task','${t.id}','${sanitize(t.title).substr(0,18)}')">⏱️</button>
    <button class="btn bsm ${isPinned?'bw':'bo'}" onclick="ST.togglePin('task','${t.id}','${sanitize(t.title)}','');render()">📌</button>
    <button class="btn bsm bo" onclick="showTaskM('${t.id}')">✏️</button>
    <button class="btn bsm bd" onclick="delTask('${t.id}')">🗑️</button>
  </span></h2>
  <div class="fr"><div><label style="color:#64748b;font-size:.68rem">สถานะ</label><div>${sTag(t.status)} ${t.sequential?'<span class="tag tag-count">⚡ Flow</span>':''}</div></div>
  <div><label style="color:#64748b;font-size:.68rem">สำคัญ</label><div>${pTag(t.priority)}</div></div></div>
  <div class="fr" style="margin-top:3px"><div><label style="color:#64748b;font-size:.68rem">เริ่ม</label><div>${fD(t.startDate)}</div></div>
  <div><label style="color:#64748b;font-size:.68rem">Deadline</label><div>${fD(t.dueDate)} ${dlB(t.dueDate, t.status==='completed')}</div></div></div>
  ${t.description?`<div style="margin-top:3px">${t.url?`<div style="margin-top:3px"><label style="color:#64748b;font-size:.68rem">🔗 Link</label><div><a href="${sanitize(t.url)}" target="_blank" style="color:var(--accent);font-size:.78rem;word-break:break-all" onclick="event.stopPropagation()">${sanitize(t.url)}</a></div></div>`:''}<label style="color:#64748b;font-size:.68rem">รายละเอียด</label><div style="font-size:.78rem;white-space:pre-wrap">${sanitize(t.description)}</div></div>`:''}
  ${t.steps?.length?`<div style="margin-top:4px"><div class="pb" style="height:8px"><div class="pf pf-blue" style="width:${pg}%"></div></div><div style="font-size:.7rem;color:#94a3b8">${pg}%</div></div>`:''}</div>

  <div class="card"><h2>✅ Steps ${t.sequential?'(⚡ ไล่ลำดับ)':''} <span class="ml"><button class="btn bsm bp" onclick="showStepM('${t.id}')">➕</button></span></h2>
  ${(t.steps||[]).length ? t.steps.map((s,i) => { const lk = isStepLocked(t,i); checkStepFuOverdue(s);
  return `<div class="si ${s.done?'done':''} ${lk?'locked-step':''} ${dlC(s.dueDate,s.done)}">
    <div class="ck ${s.done?'chk':''} ${lk?'locked':''}" onclick="${lk?'':`togStep('${t.id}',${i})`}"></div>
    <div style="flex:1">
      <div class="stt" onclick="${lk?'':`editStep('${t.id}',${i})`}">
        ${i+1}. ${sanitize(s.title)} ${lk?'🔒':''} ${fuBadge(s)}
      </div>
      <div class="sd">${s.startDate?fD(s.startDate):''} ${s.dueDate?'→ '+fD(s.dueDate):''} ${dlB(s.dueDate,s.done)}</div>
      ${s.notes?`<div style="font-size:.66rem;color:#94a3b8;margin-top:1px">${sanitize(s.notes)}</div>`:''}
      ${s.url?`<div style="font-size:.66rem;margin-top:1px"><a href="${sanitize(s.url)}" target="_blank" style="color:var(--accent);word-break:break-all" onclick="event.stopPropagation()">🔗 ${sanitize(s.url.length>40?s.url.substr(0,40)+'...':s.url)}</a></div>`:''}
      ${buildFuTimeline(t.id, i)}
    </div>
    <div style="display:flex;flex-direction:column;gap:3px">
      <button class="btn bsm bp" onclick="event.stopPropagation();showStepFuM('${t.id}',${i})" title="ติดตาม">📞</button>
      ${countActiveFu(s)>0?`<button class="btn bsm bw" onclick="event.stopPropagation();quickFuAgain('${t.id}',${i})" title="ติดตามอีกครั้ง">🔄</button>`:''}
      <button class="btn bsm bs" onclick="event.stopPropagation();startTimer('step','${s.id||i}','${sanitize(s.title).substr(0,18)}')" title="จับเวลา">⏱️</button>
      <button class="btn bsm bd" onclick="event.stopPropagation();delStep('${t.id}',${i})">✕</button>
    </div>
  </div>`; }).join('') : '<div class="empty"><p>ยังไม่มี Steps</p></div>'}

  <div class="card"><h2>📝 Log <span class="ml"><button class="btn bsm bp" onclick="showTaskLogM('${t.id}')">➕</button></span></h2>
  ${logs.length ? `<div class="tl">${logs.map(l => `<div class="ti tl-${l.type}">
    <div style="display:flex;justify-content:space-between"><div class="td2">${fDT(l.date)}</div>
    <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('taskLogs','${l.id}');render()" style="padding:1px 3px">✕</button></div>
    <div class="tt2">${logL(l.type)}</div><div class="tc2">${sanitize(l.content)}</div>
  </div>`).join('')}</div>` : '<div class="empty"><p>ยังไม่มี Log</p></div>'}
  </div>`;
}

// Step Actions
function togStep(tid, idx) {
  const t = ST.getOne('tasks', tid);
  if (!t?.steps[idx]) return;
  if (t.sequential && isStepLocked(t, idx)) return;
  t.steps[idx].done = !t.steps[idx].done;
  t.steps[idx].kanban = t.steps[idx].done ? 'done' : 'todo';
  ST.update('tasks', tid, {steps: t.steps});
  if (t.steps[idx].done) ST.add('taskLogs', {tid, type:'progress', content:`✅ เสร็จ: ${t.steps[idx].title}`, date: _nw()});
  if (t.steps.every(s => s.done) && t.steps.length && confirm('🎉 ทำครบทุก Step! เปลี่ยนเป็นเสร็จ?')) {
    ST.update('tasks', tid, {status:'completed'});
    ST.add('taskLogs', {tid, type:'completed', content:'🎉 งานเสร็จสมบูรณ์', date: _nw()});
  }
  render();
}

function delStep(tid, idx) {
  if (!confirm('ลบ Step?')) return;
  const t = ST.getOne('tasks', tid);
  t.steps.splice(idx, 1);
  ST.update('tasks', tid, {steps: t.steps});
  render();
}

function delTask(id) {
  if (!confirm('ลบงานนี้?')) return;
  ST.delete('tasks', id);
  ST.deleteWhere('taskLogs', l => l.tid === id);
  go('tasks');
  toast('🗑️ ลบแล้ว');
}

// ================================================================
// MEETINGS
// ================================================================

function rMeetings(el) {
  document.getElementById('pgT').textContent = '📅 ประชุม';
  let ms = ST.getAll('meetings');
  if (mtFlt === 'upcoming') ms = ms.filter(m => dTo(m.date) >= 0);
  else if (mtFlt === 'past') ms = ms.filter(m => dTo(m.date) < 0);
  ms.sort((a,b) => (b.date||'').localeCompare(a.date||''));

  el.innerHTML = `
  <div style="margin-bottom:8px"><button class="btn bp" onclick="showMeetingM()">➕ ประชุม</button></div>
  <div class="ftabs">
    <div class="ftab ${mtFlt==='all'?'act':''}" onclick="mtFlt='all';render()">ทั้งหมด (${ST.count('meetings')})</div>
    <div class="ftab ${mtFlt==='upcoming'?'act':''}" onclick="mtFlt='upcoming';render()">กำลังมา</div>
    <div class="ftab ${mtFlt==='past'?'act':''}" onclick="mtFlt='past';render()">ผ่านแล้ว</div>
  </div>
  ${ms.length ? ms.map(m => `<div class="li ${dlC(m.date,false)}" onclick="go('meetingDetail',{meetingId:'${m.id}'})"><div class="lm">
    <div class="lt">${sanitize(m.title)} <span class="tag tag-active">${m.type||'ทั่วไป'}</span></div>
    <div class="ls">📅 ${fD(m.date)} ${m.time?'⏰ '+m.time:''} ${m.location?'📍 '+m.location:''} ${dlB(m.date,false)}</div>
    ${m.actions?.length?`<div class="ls">📌 Actions: ${m.actions.filter(a=>a.done).length}/${m.actions.length}</div>`:''}</div></div>`).join('') : '<div class="empty"><div class="icon">📅</div><p>ยังไม่มีประชุม</p></div>'}`;
}

// ================================================================
// MEETING DETAIL
// ================================================================

function rMeetDet(el) {
  const m = ST.getOne('meetings', S.meetingId);
  if (!m) return go('meetings');
  document.getElementById('pgT').textContent = '📅 ' + m.title;

  el.innerHTML = `
  <div class="bc"><a onclick="go('meetings')">📅 ประชุม</a><span class="sep">›</span><span class="cur">${sanitize(m.title)}</span></div>

  <div class="card"><h2>📅 ข้อมูลประชุม <span class="ml">
    <button class="btn bsm bo" onclick="showMeetingM('${m.id}')">✏️</button>
    <button class="btn bsm bd" onclick="delMeeting('${m.id}')">🗑️</button>
  </span></h2>
  <div class="fr"><div>📅 ${fD(m.date)} ${m.time||''} ${m.endTime?'→ '+m.endTime:''}</div>
  <div>${m.location?'📍 '+sanitize(m.location):''}</div></div>
  ${m.type?`<div style="margin-top:3px"><span class="tag tag-active">${sanitize(m.type)}</span></div>`:''}
  ${m.attendees?`<div style="margin-top:3px">👥 ${sanitize(m.attendees)}</div>`:''}</div>

  ${m.agenda?`<div class="card"><h2>📋 วาระ</h2><div style="white-space:pre-wrap;font-size:.76rem">${sanitize(m.agenda)}</div></div>`:''}
  ${m.notes?`<div class="card"><h2>📝 บันทึก</h2><div style="white-space:pre-wrap;font-size:.76rem">${sanitize(m.notes)}</div></div>`:''}

  <div class="card"><h2>📌 Action Items (${(m.actions||[]).filter(a=>a.done).length}/${(m.actions||[]).length}) <span class="ml"><button class="btn bsm bp" onclick="showActionM('${m.id}')">➕</button></span></h2>
  ${(m.actions||[]).length ? m.actions.map((a,i) => `<div class="si ${a.done?'done':''}">
    <div class="ck ${a.done?'chk':''}" onclick="togAction('${m.id}',${i})"></div>
    <div style="flex:1"><div class="stt">${sanitize(a.title)}</div>
    <div class="sd">${a.assignee?'👤 '+sanitize(a.assignee):''} ${a.dueDate?'📅 '+fD(a.dueDate)+' '+dlB(a.dueDate,a.done):''}</div></div>
    <button class="btn bsm bd" onclick="event.stopPropagation();delAction('${m.id}',${i})">✕</button>
  </div>`).join('') : '<div class="empty"><p>ยังไม่มี Action Items</p></div>'}
  </div>

  ${m.decisions?`<div class="card"><h2>✅ มติ</h2><div style="white-space:pre-wrap;font-size:.76rem">${sanitize(m.decisions)}</div></div>`:''}`;
}

function togAction(mid, i) {
  const m = ST.getOne('meetings', mid);
  if (!m?.actions?.[i]) return;
  m.actions[i].done = !m.actions[i].done;
  ST.update('meetings', mid, {actions: m.actions});
  render();
}

function delAction(mid, i) {
  if (!confirm('ลบ?')) return;
  const m = ST.getOne('meetings', mid);
  m.actions.splice(i, 1);
  ST.update('meetings', mid, {actions: m.actions});
  render();
}

function delMeeting(id) {
  if (!confirm('ลบประชุมนี้?')) return;
  ST.delete('meetings', id);
  go('meetings');
  toast('🗑️ ลบแล้ว');
}

// ================================================================
// STEP FOLLOW-UP TRACKER
// ================================================================

function fuStatusTag(st) {
  if (st === 'received') return '<span class="tag tag-green">✅ ได้รับแล้ว</span>';
  if (st === 'overdue') return '<span class="tag tag-red">🔴 เกินกำหนด</span>';
  if (st === 'cancelled') return '<span class="tag tag-gray">⚫ ยกเลิก</span>';
  return '<span class="tag tag-yellow">⏳ รอตอบกลับ</span>';
}

function checkStepFuOverdue(step) {
  if (!step.followups || !step.followups.length) return;
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  for (var i = 0; i < step.followups.length; i++) {
    var fu = step.followups[i];
    if (fu.status !== 'waiting') continue;
    if (!fu.expectedDate) continue;
    var exp = parseThaiDate(fu.expectedDate);
    if (exp && exp < now) {
      fu.status = 'overdue';
    }
  }
}

function countActiveFu(step) {
  if (!step.followups) return 0;
  return step.followups.filter(function (f) {
    return f.status === 'waiting' || f.status === 'overdue';
  }).length;
}

function buildFuTimeline(taskId, stepIdx) {
  var t = ST.getOne('tasks', taskId);
  if (!t || !t.steps || !t.steps[stepIdx]) return '';
  var step = t.steps[stepIdx];
  if (!step.followups || !step.followups.length) return '';

  checkStepFuOverdue(step);

  var h = '<div class="fu-timeline">';
  for (var i = 0; i < step.followups.length; i++) {
    var fu = step.followups[i];
    var isLast = i === step.followups.length - 1;
    var dotClass = 'fu-dot';
    if (fu.status === 'received') dotClass += ' fu-dot-green';
    else if (fu.status === 'overdue') dotClass += ' fu-dot-red';
    else if (fu.status === 'cancelled') dotClass += ' fu-dot-gray';
    else dotClass += ' fu-dot-yellow';

    h += '<div class="fu-item">';
    h += '<div class="fu-line-wrap">';
    h += '<div class="' + dotClass + '"></div>';
    if (!isLast) h += '<div class="fu-vline"></div>';
    h += '</div>';
    h += '<div class="fu-content">';
    h += '<div class="fu-header">';
    h += '<span class="fu-attempt">ครั้งที่ ' + (i + 1) + '</span>';
    h += '<span class="fu-date">' + (fu.date || '-') + '</span>';
    h += fuStatusTag(fu.status);
    h += '</div>';
    h += '<div class="fu-note">' + sanitize(fu.note || '-') + '</div>';
    if (fu.expectedDate) {
      h += '<div class="fu-expect">📅 กำหนดตอบกลับ: <strong>' + fu.expectedDate + '</strong>';
      if (fu.status === 'overdue') h += ' <span style="color:#ff5252">⚠️ เกินกำหนด!</span>';
      h += '</div>';
    }
    if (fu.response) {
      h += '<div class="fu-response">💬 ตอบกลับ: ' + sanitize(fu.response) + '</div>';
    }
    if (fu.status === 'waiting' || fu.status === 'overdue') {
      h += '<div class="fu-actions">';
      h += '<button class="btn-xs fu-btn-green" onclick="markFuReceived(\'' + taskId + '\',' + stepIdx + ',' + i + ')">✅ ได้รับแล้ว</button>';
      h += '<button class="btn-xs fu-btn-cancel" onclick="markFuCancelled(\'' + taskId + '\',' + stepIdx + ',' + i + ')">⚫ ยกเลิก</button>';
      h += '</div>';
    }
    h += '</div></div>';
  }
  h += '</div>';
  return h;
}

function fuBadge(step) {
  if (!step.followups || !step.followups.length) return '';
  checkStepFuOverdue(step);
  var total = step.followups.length;
  var active = countActiveFu(step);
  var overdue = step.followups.filter(function (f) { return f.status === 'overdue'; }).length;

  if (overdue > 0) {
    return '<span class="fu-badge fu-badge-red" title="' + overdue + ' เกินกำหนด">🔴 ' + total + ' ครั้ง</span>';
  }
  if (active > 0) {
    return '<span class="fu-badge fu-badge-yellow" title="' + active + ' รอตอบกลับ">⏳ ' + total + ' ครั้ง</span>';
  }
  return '<span class="fu-badge fu-badge-green" title="เสร็จทั้งหมด">✅ ' + total + ' ครั้ง</span>';
}

function showStepFuM(taskId, stepIdx) {
  var t = ST.getOne('tasks', taskId);
  if (!t || !t.steps || !t.steps[stepIdx]) return;
  var step = t.steps[stepIdx];
  var attempt = (step.followups ? step.followups.length : 0) + 1;
  var today = _td();

  var h = '<div style="max-width:450px">';
  h += '<div style="padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:12px">';
  h += '<div style="font-weight:600;font-size:14px">📋 ' + sanitize(step.title) + '</div>';
  h += '<div style="font-size:12px;color:var(--text2);margin-top:4px">ติดตามครั้งที่ ' + attempt + '</div>';
  h += '</div>';

  h += '<div class="fm-group"><label>⚡ Quick Action</label>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
  h += '<button class="btn-sm" onclick="fuQuickFill(\'โทรติดต่อ รอตอบกลับ\')">📞 โทร</button>';
  h += '<button class="btn-sm" onclick="fuQuickFill(\'ส่ง LINE แล้ว รอตอบกลับ\')">💬 LINE</button>';
  h += '<button class="btn-sm" onclick="fuQuickFill(\'ส่ง Email แล้ว รอตอบกลับ\')">📧 Email</button>';
  h += '<button class="btn-sm" onclick="fuQuickFill(\'เข้าพบแล้ว รอเอกสาร\')">🤝 Visit</button>';
  h += '<button class="btn-sm" onclick="fuQuickFill(\'ติดตามซ้ำ ยังไม่ได้ตอบกลับ\')">🔄 ติดตามซ้ำ</button>';
  h += '</div></div>';

  h += '<div class="fm-group"><label>📅 วันที่ติดตาม</label>';
  h += '<input type="text" id="fuDate" class="fm-input dp" value="' + today + '" placeholder="DD/MM/YYYY"></div>';

  h += '<div class="fm-group"><label>📝 รายละเอียด</label>';
  h += '<textarea id="fuNote" rows="3" class="fm-input" placeholder="เช่น โทรติดต่อแล้ว ลูกค้ารับปากส่งเอกสารภายในวันศุกร์..."></textarea></div>';

  h += '<div class="fm-group"><label>📅 กำหนดตอบกลับ / ส่ง (ถ้ามี)</label>';
  h += '<input type="text" id="fuExpDate" class="fm-input dp" placeholder="DD/MM/YYYY"></div>';

  h += '<div class="fm-group"><label>📊 สถานะ</label>';
  h += '<select id="fuStatus" class="fm-input">';
  h += '<option value="waiting">⏳ รอตอบกลับ</option>';
  h += '<option value="received">✅ ได้รับแล้ว</option>';
  h += '</select></div>';

  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveStepFu(\'' + taskId + '\',' + stepIdx + ')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('📞 ติดตามงาน — ครั้งที่ ' + attempt, h);
}

function fuQuickFill(text) {
  var el = document.getElementById('fuNote');
  if (el) el.value = text;
}

function saveStepFu(taskId, stepIdx) {
  var date = (document.getElementById('fuDate').value || '').trim();
  var note = (document.getElementById('fuNote').value || '').trim();
  var expectedDate = (document.getElementById('fuExpDate').value || '').trim();
  var status = document.getElementById('fuStatus').value || 'waiting';

  if (!note) { toast('กรุณาใส่รายละเอียด', 'warning'); return; }

  var t = ST.getOne('tasks', taskId);
  if (!t || !t.steps || !t.steps[stepIdx]) return;

  if (!t.steps[stepIdx].followups) t.steps[stepIdx].followups = [];

  var attempt = t.steps[stepIdx].followups.length + 1;
  t.steps[stepIdx].followups.push({
    attempt: attempt,
    date: date || _td(),
    note: note,
    expectedDate: expectedDate,
    status: status,
    response: ''
  });

  ST.update('tasks', taskId, { steps: t.steps });

  ST.add('taskLogs', {
    tid: taskId,
    type: 'followup',
    content: '📞 ติดตามครั้งที่ ' + attempt + ': ' + note + (expectedDate ? ' (กำหนด: ' + expectedDate + ')' : ''),
    date: _nw()
  });

  toast('✅ บันทึกการติดตามครั้งที่ ' + attempt, 'success');
  closeMForce();
  render();
}

function markFuReceived(taskId, stepIdx, fuIdx) {
  var response = prompt('💬 ตอบกลับ/ผลลัพธ์ (ถ้ามี):');
  var t = ST.getOne('tasks', taskId);
  if (!t || !t.steps[stepIdx] || !t.steps[stepIdx].followups[fuIdx]) return;

  t.steps[stepIdx].followups[fuIdx].status = 'received';
  if (response) t.steps[stepIdx].followups[fuIdx].response = response;

  ST.update('tasks', taskId, { steps: t.steps });

  var attempt = t.steps[stepIdx].followups[fuIdx].attempt || (fuIdx + 1);
  ST.add('taskLogs', {
    tid: taskId,
    type: 'progress',
    content: '✅ ได้รับตอบกลับ ครั้งที่ ' + attempt + (response ? ': ' + response : ''),
    date: _nw()
  });

  toast('✅ อัพเดทแล้ว', 'success');
  render();
}

function markFuCancelled(taskId, stepIdx, fuIdx) {
  if (!confirm('ยกเลิกการติดตามนี้?')) return;
  var t = ST.getOne('tasks', taskId);
  if (!t || !t.steps[stepIdx] || !t.steps[stepIdx].followups[fuIdx]) return;

  t.steps[stepIdx].followups[fuIdx].status = 'cancelled';
  ST.update('tasks', taskId, { steps: t.steps });
  render();
}

function quickFuAgain(taskId, stepIdx) {
  showStepFuM(taskId, stepIdx);
  setTimeout(function () {
    var noteEl = document.getElementById('fuNote');
    if (noteEl) {
      noteEl.value = 'ติดตามซ้ำ — ยังไม่ได้รับตอบกลับ';
    }
  }, 100);
}

function getAllOverdueFu() {
  var tasks = ST.getAll('tasks');
  var overdue = [];
  tasks.forEach(function (t) {
    if (t.status === 'completed') return;
    (t.steps || []).forEach(function (s, si) {
      if (s.done) return;
      (s.followups || []).forEach(function (fu, fi) {
        if (fu.status !== 'waiting' && fu.status !== 'overdue') return;
        checkStepFuOverdue(s);
        if (fu.status === 'overdue') {
          overdue.push({
            taskId: t.id,
            taskTitle: t.title,
            stepIdx: si,
            stepTitle: s.title,
            followup: fu,
            fuIdx: fi
          });
        }
      });
    });
  });
  return overdue;
}