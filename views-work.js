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

  h += '<div class="fr" style="margin-bottom:8px;gap:6px">';
  h += '<input type="text" id="qaTaskInput" class="fm-input" placeholder="⚡ พิมพ์ชื่องานแล้วกด Enter เพื่อสร้างทันที..." onkeydown="if(event.key===\'Enter\'){quickAddTask();}" style="flex:1">';
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

var taskFilterCollapsed = localStorage.getItem('taskFilterCollapsed') === '1';
function toggleTaskFilterBar() {
  taskFilterCollapsed = !taskFilterCollapsed;
  localStorage.setItem('taskFilterCollapsed', taskFilterCollapsed ? '1' : '0');
  render();
}

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
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:${taskFilterCollapsed ? '0' : '8px'}">
      <input type="text" id="taskSearch" value="${sanitize(tasksSearch)}"
        placeholder="🔍 ค้นหางาน..." style="flex:1;min-width:150px"
        oninput="tasksSearch=this.value;render()">
      <button class="btn bsm bo" onclick="toggleTaskFilterBar()">${taskFilterCollapsed ? '▾ ตัวกรอง' : '▴ ซ่อนตัวกรอง'}</button>
      <button class="btn bsm bo" onclick="clearTaskFilters()">✕ ล้างตัวกรอง</button>
    </div>

    <div style="display:${taskFilterCollapsed ? 'none' : 'flex'};gap:6px;flex-wrap:wrap;align-items:center">
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
    var dueDate = new Date(t.dueDate);
    if (isNaN(dueDate.getTime())) continue;
    
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
      var day = new Date(t.dueDate).getDate();
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
  <div class="fr" style="margin-bottom:8px;gap:6px">
    <input type="text" id="qaTaskInput" class="fm-input" placeholder="⚡ พิมพ์ชื่องานแล้วกด Enter เพื่อสร้างทันที..." onkeydown="if(event.key==='Enter'){quickAddTask();}" style="flex:1">
  </div>
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

function quickAddTask() {
  var el = document.getElementById('qaTaskInput');
  var title = el ? el.value.trim() : '';
  if (!title) return;
  ST.add('tasks', {
    title: title, description: '', startDate: _td(), dueDate: '', priority: 'medium',
    category: '', status: 'active', sequential: false, url: '', dealerId: '', pipeId: '', steps: []
  });
  el.value = '';
  toast('⚡ เพิ่มงานแล้ว: ' + title);
  render();
}

// ================================================================
// แสดง Due Date ของ Step (ใน Card และ Kanban)
// ================================================================

function renderStepDueDate(step) {
  if (!step.dueDate) return '';
  var daysLeft = dTo(step.dueDate);
  var isOverdue = daysLeft < 0 && !step.done;
  var isToday = daysLeft === 0 && !step.done;
  
  var colorClass = isOverdue ? 'step-overdue' : (isToday ? 'step-today' : 'step-normal');
  var label = '';
  if (isOverdue) label = '🔴 เกิน ' + Math.abs(daysLeft) + ' วัน';
  else if (isToday) label = '🟠 วันนี้!';
  else if (daysLeft === 1) label = '🟡 พรุ่งนี้';
  else if (daysLeft <= 3) label = '🟡 อีก ' + daysLeft + ' วัน';
  
  return `<div class="step-due ${colorClass}">📅 ${fD(step.dueDate)} ${label ? `<span class="step-due-badge">${label}</span>` : ''}</div>`;
}

// ================================================================
// แก้ไข Timeline Log (Inline Edit)
// ================================================================

function editTimelineLog(logId, currentText, currentType, currentDate) {
  var cfg = getConfig();
  var logTypes = [
    { value: 'note', label: '📝 หมายเหตุ' },
    { value: 'progress', label: '🟢 คืบหน้า' },
    { value: 'problem', label: '🔴 ปัญหา' },
    { value: 'solution', label: '🟡 แก้ไข' },
    { value: 'followup', label: '📞 ติดตาม' },
    { value: 'step', label: '✅ Step' },
    { value: 'update', label: '📝 อัพเดท' }
  ];
  
  var typeOptions = logTypes.map(t => `<option value="${t.value}" ${t.value === currentType ? 'selected' : ''}>${t.label}</option>`).join('');
  
  openM('✏️ แก้ไข Log', `
    <div class="fg">
      <label>📊 ประเภท</label>
      <select id="edit_log_type">${typeOptions}</select>
    </div>
    <div class="fg">
      <label>📅 วันที่</label>
      <input type="text" id="edit_log_date" class="dp" value="${fD(currentDate) || _td()}">
    </div>
    <div class="fg">
      <label>📝 รายละเอียด</label>
      <textarea id="edit_log_content" rows="4">${sanitize(currentText)}</textarea>
    </div>
    <div id="edit_log_step_wrap" style="display:none">
      <div class="fg">
        <label>📅 กำหนดเสร็จ (Step)</label>
        <input type="text" id="edit_log_due" class="dp">
      </div>
    </div>
    <div class="fm-actions">
      <button class="btn btn-blue" onclick="saveTimelineLog('${logId}')">💾 บันทึก</button>
      <button class="btn bd" onclick="deleteTimelineLog('${logId}')">🗑️ ลบ</button>
      <button class="btn" onclick="closeM()">ยกเลิก</button>
    </div>
  `);
  
  // แสดงฟิลด์ Due Date ถ้าเป็น step
  var typeSel = document.getElementById('edit_log_type');
  var stepWrap = document.getElementById('edit_log_step_wrap');
  
  if (currentType === 'step') {
    stepWrap.style.display = 'block';
    var dueDateInput = document.getElementById('edit_log_due');
    if (dueDateInput) dueDateInput.value = currentText.match(/📅 Due: ([\d/]+)/)?.[1] || '';
  }
  
  typeSel.onchange = function() {
    stepWrap.style.display = this.value === 'step' ? 'block' : 'none';
  };
}

function saveTimelineLog(logId) {
  var newType = document.getElementById('edit_log_type').value;
  var newDate = dpG('edit_log_date') || _td();
  var newContent = document.getElementById('edit_log_content').value.trim();
  
  if (!newContent) { toast('กรุณาใส่รายละเอียด'); return; }
  
  // ถ้าเป็น step และมี due date
  var newDueDate = '';
  if (newType === 'step') {
    newDueDate = dpG('edit_log_due');
    if (newDueDate) newContent = newContent + ` (📅 Due: ${newDueDate})`;
  }
  
  ST.update('taskLogs', logId, {
    type: newType,
    content: newContent,
    date: newDate + 'T' + new Date().toTimeString().slice(0,8)
  });
  
  // ถ้ามี due date และเป็น step ให้อัพเดท task steps ด้วย
  if (newType === 'step' && newDueDate) {
    // หา task ที่เกี่ยวข้อง
    var log = ST.getOne('taskLogs', logId);
    if (log && log.tid) {
      var task = ST.getOne('tasks', log.tid);
      if (task && task.steps) {
        for (var i = 0; i < task.steps.length; i++) {
          if (task.steps[i].id === logId || task.steps[i].title === newContent.split('(')[0].trim()) {
            task.steps[i].dueDate = newDueDate;
            ST.update('tasks', task.id, { steps: task.steps });
            break;
          }
        }
      }
    }
  }
  
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

function deleteTimelineLog(logId) {
  if (!confirm('ลบ Log นี้?')) return;
  ST.delete('taskLogs', logId);
  closeMForce();
  toast('🗑️ ลบแล้ว');
  render();
}

// ================================================================
// เพิ่ม Follow-up ใน Timeline (แก้ไขแล้ว)
// ================================================================

function addFollowupToTimeline(taskId) {
  var t = ST.getOne('tasks', taskId);
  if (!t) return;
  
  var today = _td();
  var defaultDate = addD(today, 2);
  
  openM('📞 เพิ่มนัดติดตาม', `
    <div class="fg">
      <label>📅 วันที่ต้องติดตาม *</label>
      ${dpH('tl_fu_date', defaultDate, 'วันที่ต้องติดตาม *')}
    </div>
    <div class="fg">
      <label>📝 รายละเอียด *</label>
      <textarea id="tl_fu_note" rows="3" placeholder="เช่น โทรถามความคืบหน้า, ทวงเอกสาร..."></textarea>
    </div>
    <div class="fg">
      <label>🔔 เตือนล่วงหน้า</label>
      <div class="check-g">
        <label><input type="checkbox" id="tl_fu_notify_day_before"> เตือนล่วงหน้า 1 วัน</label>
      </div>
    </div>
    <div class="fm-actions">
      <button class="btn btn-blue" onclick="saveFollowupToTimeline('${taskId}')">💾 บันทึก</button>
      <button class="btn" onclick="closeM()">ยกเลิก</button>
    </div>
  `);
}

function saveFollowupToTimeline(taskId) {
  // รับค่าวันที่จาก date picker
  var dueDateInput = document.getElementById('tl_fu_date');
  var dueDate = dpG('tl_fu_date');
  
  // ถ้าใช้ date picker แบบ dpH ให้ใช้ dpG แทน
  if (!dueDate || dueDate === '') {
    dueDate = dpG('tl_fu_date');
  }
  
  var note = document.getElementById('tl_fu_note') ? document.getElementById('tl_fu_note').value.trim() : '';
  var notifyDayBefore = document.getElementById('tl_fu_notify_day_before') ? document.getElementById('tl_fu_notify_day_before').checked : false;
  
  // ตรวจสอบข้อมูล
  if (!dueDate || dueDate === '') {
    toast('กรุณาเลือกวันที่');
    return;
  }
  
  if (!note) {
    toast('กรุณาใส่รายละเอียด');
    return;
  }
  
  // อัพเดท task
  ST.update('tasks', taskId, {
    followupDate: dueDate,
    followupNote: note,
    followupNotifyDayBefore: notifyDayBefore
  });
  
  // เพิ่ม log ใน timeline
  ST.add('taskLogs', {
    tid: taskId,
    type: 'followup_set',
    content: `📞 ตั้งนัดติดตามวันที่ ${dueDate}: ${note}`,
    date: _nw(),
    dueDate: dueDate
  });
  
  closeMForce();
  toast(`📞 ตั้งนัดติดตามวันที่ ${dueDate}`);
  render();
}
// ================================================================
// TASK DETAIL (NEW VERSION with Due Date + Follow-up + Timeline)
// ================================================================

function rTaskDet(el) {
  const t = ST.getOne('tasks', S.taskId);
  if (!t) return go('tasks');
  const logs = ST.taskLogsByTask(t.id);
  const pg = prog(t);
  const isPinned = ST.hasPin(t.id);
  const dealer = t.dealerId ? ST.getOne('dealers', t.dealerId) : null;
  const isTaskOverdue = isOverdue(t.dueDate, t.status);
  const isTaskSoon = isDueSoon(t.dueDate, t.status);
  
  document.getElementById('pgT').textContent = '📋 ' + t.title;

  var html = `
  <div class="bc"><a onclick="go('tasks')">📋 งาน</a><span class="sep">›</span><span class="cur">${sanitize(t.title)}</span></div>

  <!-- Task Header -->
  <div class="card">
    <h2>📋 ข้อมูลงาน <span class="ml">
      <button class="btn bsm bs" onclick="startTimer('task','${t.id}','${sanitize(t.title).substr(0,18)}')">⏱️</button>
      <button class="btn bsm ${isPinned ? 'bw' : 'bo'}" onclick="ST.togglePin('task','${t.id}','${sanitize(t.title)}','');render()">📌</button>
      <button class="btn bsm bo" onclick="showTaskM('${t.id}')">✏️</button>
      <button class="btn bsm bd" onclick="delTask('${t.id}')">🗑️</button>
    </span></h2>
    <div class="fr">
      <div><label style="color:#64748b;font-size:.68rem">สถานะ</label><div>${sTag(t.status)} ${t.sequential ? '<span class="tag tag-count">⚡ Flow</span>' : ''}</div></div>
      <div><label style="color:#64748b;font-size:.68rem">สำคัญ</label><div>${pTag(t.priority)}</div></div>
    </div>
    ${t.description ? `<div style="margin-top:8px"><label style="color:#64748b;font-size:.68rem">รายละเอียด</label><div style="font-size:.78rem;white-space:pre-wrap">${sanitize(t.description)}</div></div>` : ''}
    ${t.attachments && t.attachments.length ? attachGalleryHtml(t.attachments) : ''}
    ${t.url ? `<div style="margin-top:8px"><label style="color:#64748b;font-size:.68rem">🔗 ลิงก์</label><div><a href="${sanitize(t.url)}" target="_blank" style="color:var(--accent);font-size:.78rem;word-break:break-all" onclick="event.stopPropagation()">${sanitize(t.url)}</a></div></div>` : ''}
  </div>

  <!-- Date Section -->
  <div class="card">
    <h2>📅 กำหนดการ</h2>
    <div class="date-section">
<div class="date-row ${isTaskOverdue ? 'overdue' : isTaskSoon ? 'soon' : ''}">
  <div class="date-label">📅 กำหนดเสร็จ (Deadline)</div>
  <div class="date-value">
    <strong>${fD(t.dueDate) || 'ไม่ได้ตั้ง'}</strong>
    ${formatDueDateStatus(t.dueDate, t.status)}
  </div>
  <button class="btn bsm bo" onclick="showRescheduleModal('${t.id}')">📅 เลื่อนกำหนด</button>  <!-- ✅ ปุ่มนี้ -->
</div>      
      <div class="date-row">
        <div class="date-label">📞 นัดติดตาม (Follow-up)</div>
        <div class="date-value">
          ${t.followupDate ? fD(t.followupDate) : 'ไม่ได้ตั้ง'}
          ${t.followupDate && dTo(t.followupDate) <= 0 ? '<span class="badge-red">⚠️ ต้องติดตามวันนี้!</span>' : ''}
        </div>
        <button class="btn bsm bo" onclick="setFollowupDate('${t.id}')">📞 ตั้ง/แก้ไข</button>
        ${t.followupDate ? `<button class="btn bsm bs" onclick="markFollowupDone('${t.id}')">✅ ติดตามแล้ว</button>` : ''}
        <button class="btn bsm bo" onclick="addFollowupToTimeline('${t.id}')">➕ เพิ่มนัด</button>
      </div>
      
      <div class="date-row">
        <div class="date-label">🚀 วันที่เริ่ม</div>
        <div class="date-value">${fD(t.startDate) || 'ไม่ได้ตั้ง'}</div>
        <button class="btn bsm bo" onclick="setStartDate('${t.id}')">✏️ แก้ไข</button>
      </div>
    </div>
    
    ${t.dueDateHistory && t.dueDateHistory.length ? `
    <div class="due-history">
      <div class="history-title">📝 ประวัติการเลื่อนกำหนด</div>
      ${t.dueDateHistory.map(function(h, i) {
        return `<div class="history-item">
          <span class="history-date">${h.changedAt}</span>
          <span class="history-change">${h.oldDate || '-'} → ${h.newDate}</span>
          <span class="history-reason">${h.reason}</span>
          <span class="history-by">(${h.changedBy})</span>
        </div>`;
      }).join('')}
    </div>
    ` : ''}
  </div>

  <!-- Steps Section (แสดง Due Date ของแต่ละ Step) -->
  <div class="card">
    <h2>✅ Steps ${t.sequential ? '(⚡ ไล่ลำดับ)' : ''} <span class="ml"><button class="btn bsm bp" onclick="showStepM('${t.id}')">➕</button></span></h2>
    ${(t.steps || []).length ? t.steps.map(function(s, i) {
      var lk = isStepLocked(t, i);
      checkStepFuOverdue(s);
      return `<div class="si ${s.done ? 'done' : ''} ${lk ? 'locked-step' : ''} ${dlC(s.dueDate, s.done)}" draggable="true" ondragstart="stepDragStart(event,'${t.id}',${i})" ondragover="stepDragOver(event)" ondrop="stepDrop(event,'${t.id}',${i})">
        <div style="cursor:grab;color:#475569;padding:0 2px;align-self:center" title="ลากเพื่อจัดลำดับ">⠿</div>
        <div class="ck ${s.done ? 'chk' : ''} ${lk ? 'locked' : ''}" onclick="${lk ? '' : `togStep('${t.id}',${i})`}"></div>
        <div style="flex:1">
          <div class="stt" onclick="${lk ? '' : `editStep('${t.id}',${i})`}">
            ${i + 1}. ${sanitize(s.title)} ${lk ? '🔒' : ''} ${fuBadge(s)}
          </div>
          <div class="sd">${s.startDate ? fD(s.startDate) : ''} ${s.dueDate ? '→ ' + fD(s.dueDate) : ''} ${dlB(s.dueDate, s.done)}</div>
          ${renderStepDueDate(s)}
          ${s.notes ? `<div style="font-size:.66rem;color:#94a3b8;margin-top:1px">${sanitize(s.notes)}</div>` : ''}
          ${s.url ? `<div style="font-size:.66rem;margin-top:1px"><a href="${sanitize(s.url)}" target="_blank" style="color:var(--accent);word-break:break-all" onclick="event.stopPropagation()">🔗 ${sanitize(s.url.length > 40 ? s.url.substr(0, 40) + '...' : s.url)}</a></div>` : ''}
          ${s.attachments && s.attachments.length ? `<div onclick="event.stopPropagation()">${attachGalleryHtml(s.attachments)}</div>` : ''}
          ${buildFuTimeline(t.id, i)}
        </div>
        <div style="display:flex;flex-direction:column;gap:3px">
          <button class="btn bsm bp" onclick="event.stopPropagation();showStepFuM('${t.id}',${i})" title="ติดตาม">📞</button>
          ${countActiveFu(s) > 0 ? `<button class="btn bsm bw" onclick="event.stopPropagation();quickFuAgain('${t.id}',${i})" title="ติดตามอีกครั้ง">🔄</button>` : ''}
          <button class="btn bsm bs" onclick="event.stopPropagation();startTimer('step', '${s.id || i}', '${sanitize(s.title).substr(0, 18)}')" title="จับเวลา">⏱️</button>
          <button class="btn bsm bd" onclick="event.stopPropagation();delStep('${t.id}',${i})">✕</button>
        </div>
      </div>`;
    }).join('') : '<div class="empty"><p>ยังไม่มี Steps</p></div>'}
  </div>

  <!-- Timeline / Logs (พร้อม Edit) -->
  <div class="card">
    <h2>📝 ไทม์ไลน์ <span class="ml">
      <button class="btn bsm bp" onclick="showTaskLogM('${t.id}')">➕</button>
      <button class="btn bsm bo" onclick="addFollowupToTimeline('${t.id}')">📞 + นัด</button>
    </span></h2>
    <div id="timelineList">
      ${logs.length ? `<div class="tl">${logs.map(function(l) {
        var isFollowupOverdue = l.type === 'followup_set' && l.dueDate && dTo(l.dueDate) < 0;
        return `<div class="ti tl-${l.type} ${isFollowupOverdue ? 'tl-overdue' : ''}">
          <div style="display:flex;justify-content:space-between">
            <div class="td2">${fDT(l.date)}</div>
            <div style="display:flex;gap:4px">
              <button class="btn bsm bo" onclick="event.stopPropagation();editTimelineLog('${l.id}', '${sanitize(l.content).replace(/'/g, "\\'")}', '${l.type}', '${l.date}')" style="padding:1px 6px">✏️</button>
              <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('taskLogs','${l.id}');render()" style="padding:1px 4px">✕</button>
            </div>
          </div>
          <div class="tt2">${logL(l.type)}</div>
          <div class="tc2">${sanitize(l.content)}</div>
          ${l.dueDate ? `<div class="td2" style="margin-top:2px">📅 กำหนด: ${fD(l.dueDate)} ${dlB(l.dueDate, false)}</div>` : ''}
        </div>`;
      }).join('')}</div>` : '<div class="empty"><p>ยังไม่มี Log</p></div>'}
    </div>
  </div>
  
  <!-- Quick Add Comment (Inline) -->
  <div class="card">
    <div class="inline-comment">
      <textarea id="quickComment" rows="2" placeholder="พิมพ์ comment ด่วน... (เช่น โทรติดตามแล้ว, ได้รับเอกสารแล้ว)"></textarea>
      <div class="inline-comment-actions" style="display:flex;gap:6px;margin-top:6px">
        <button class="btn bsm bp" onclick="addQuickComment('${t.id}')">💬 เพิ่ม Comment</button>
        <button class="btn bsm bs" onclick="addQuickStep('${t.id}')">✅ + Step</button>
        <button class="btn bsm bo" onclick="addQuickFollowup('${t.id}')">📞 + นัดติดตาม</button>
      </div>
    </div>
  </div>`;

  el.innerHTML = html;
}

// ================================================================
// QUICK ACTIONS (Inline)
// ================================================================

function addQuickComment(taskId) {
  var text = document.getElementById('quickComment')?.value.trim();
  if (!text) { toast('กรุณาพิมพ์ comment'); return; }
  
  ST.add('taskLogs', {
    tid: taskId,
    type: 'note',
    content: text,
    date: _nw()
  });
  
  document.getElementById('quickComment').value = '';
  toast('💬 เพิ่ม comment แล้ว');
  render();
}

function addQuickStep(taskId) {
  var title = prompt('📋 ชื่อ Step:', '');
  if (!title) return;
  var dueDate = prompt('📅 กำหนดเสร็จ (DD/MM/YYYY):', addD(_td(), 3));
  
  ST.add('taskLogs', {
    tid: taskId,
    type: 'step',
    content: title,
    dueDate: dueDate,
    done: false,
    date: _nw()
  });
  
  toast('✅ เพิ่ม Step แล้ว');
  render();
}

function addQuickFollowup(taskId) {
  var note = prompt('📞 รายละเอียดการติดตาม:', '');
  if (!note) return;
  var dueDate = prompt('📅 นัดติดตามอีกครั้ง (DD/MM/YYYY):', addD(_td(), 3));
  
  // บันทึกเป็น taskLog
  ST.add('taskLogs', {
    tid: taskId,
    type: 'followup',
    content: note,
    dueDate: dueDate,
    status: 'waiting',
    date: _nw()
  });
  
  // ตั้ง followupDate ใน task
  ST.update('tasks', taskId, { followupDate: dueDate, followupNote: note });
  
  toast(`📞 ตั้งนัดติดตามวันที่ ${dueDate}`);
  render();
}

// ================================================================
// STEP DRAG REORDER
// ================================================================
function stepDragStart(e, tid, idx) {
  e.dataTransfer.setData('text/plain', JSON.stringify({tid: tid, idx: idx}));
}
function stepDragOver(e) { e.preventDefault(); }
function stepDrop(e, tid, toIdx) {
  e.preventDefault();
  var data;
  try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
  if (!data || data.tid !== tid || data.idx === toIdx) return;
  var t = ST.getOne('tasks', tid);
  if (!t || !t.steps) return;
  var arr = t.steps;
  var moved = arr.splice(data.idx, 1)[0];
  arr.splice(toIdx, 0, moved);
  ST.update('tasks', tid, {steps: arr});
  render();
}

// ================================================================
// STEP ACTIONS (KEEP ORIGINAL)
// ================================================================

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
// ================================================================
// CONTACT LOGS PAGE (ศูนย์รวมการติดต่อ)
// ================================================================

function rContactLogs(el) {
  document.getElementById('pgT').textContent = '📞 ศูนย์รวมการติดต่อ';
  
  var logs = JSON.parse(localStorage.getItem('v7_contact_logs') || '[]');
  var pendingFu = JSON.parse(localStorage.getItem('v7_pending_followups') || '[]');
  
  var pendingItems = pendingFu.filter(function(f) { return !f.done; }).map(function(f) {
    return { id: f.id, date: f.dueDate, channel: '⏰ เตือน', dealerId: f.dealerId,
      pipeId: f.pipeId, summary: f.note, isPending: true, dueDate: f.dueDate };
  });
  
  var allItems = logs.concat(pendingItems);
  allItems.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
  
  var channelIcons = { line: '💬', email: '📧', phone: '📞', meeting: '🤝', other: '📝' };
  
  var html = '<div style="margin-bottom:12px"><button class="btn bp" onclick="showUnifiedContactForm()">➕ บันทึกการติดต่อ</button></div>';
  html += '<div class="card"><h2>📋 ตารางการติดต่อ</h2>';
  
  if (allItems.length) {
    for (var i = 0; i < allItems.length; i++) {
      var item = allItems[i];
      var dealer = item.dealerId ? ST.getOne('dealers', item.dealerId) : null;
      var isOverdue = item.dueDate && dTo(item.dueDate) < 0;
      var icon = channelIcons[item.channel] || '📝';
      
      html += '<div class="contact-log-item' + (isOverdue ? ' overdue' : '') + '">';
      html += '<div class="contact-log-header"><span class="contact-channel">' + icon + ' ' + (item.channel || 'อื่นๆ') + '</span>';
      html += '<span class="contact-date">' + (item.date || '-') + ' ' + (item.time || '') + '</span>';
      if (item.dueDate) html += '<span class="contact-due ' + (isOverdue ? 'due-over' : '') + '">📅 กำหนด: ' + item.dueDate + '</span>';
      html += '</div>';
      html += '<div class="contact-log-dealer">🏪 ' + (dealer ? dealer.name : 'ไม่ระบุ Dealer') + '</div>';
      if (item.pipeId) { var pipe = ST.getOne('pipeline', item.pipeId); if (pipe) html += '<div class="contact-log-pipe">📊 ' + sanitize(pipe.projectName || '') + '</div>'; }
      html += '<div class="contact-log-note">' + sanitize(item.summary || '-') + '</div>';
      html += '<div class="contact-log-actions">';
      if (item.isPending) html += '<button class="btn bsm bs" onclick="markPendingDone(\'' + item.id + '\')">✅ เสร็จแล้ว</button>';
      else html += '<button class="btn bsm bo" onclick="createTaskFromContact(\'' + item.id + '\')">📋 สร้างงาน</button>';
      html += '<button class="btn bsm bd" onclick="deleteContactLog(\'' + item.id + '\')">🗑️</button></div></div>';
    }
  } else {
    html += '<div class="empty"><p>ยังไม่มีบันทึกการติดต่อ<br><button class="btn bp" onclick="showUnifiedContactForm()">➕ บันทึกครั้งแรก</button></p></div>';
  }
  
  html += '</div>';
  el.innerHTML = html;
}

function markPendingDone(id) {
  var pending = JSON.parse(localStorage.getItem('v7_pending_followups') || '[]');
  for (var i = 0; i < pending.length; i++) {
    if (pending[i].id === id) { pending[i].done = true; break; }
  }
  localStorage.setItem('v7_pending_followups', JSON.stringify(pending));
  if (typeof syncToFirebase === 'function') syncToFirebase('pending_followups', pending);
  toast('✅ ทำเครื่องหมายเสร็จแล้ว'); render();
}

function deleteContactLog(id) {
  if (!confirm('ลบบันทึกนี้?')) return;
  var logs = JSON.parse(localStorage.getItem('v7_contact_logs') || '[]');
  var newLogs = [];
  for (var i = 0; i < logs.length; i++) { if (logs[i].id !== id) newLogs.push(logs[i]); }
  localStorage.setItem('v7_contact_logs', JSON.stringify(newLogs));
  if (typeof syncToFirebase === 'function') syncToFirebase('contact_logs', newLogs);
  toast('🗑️ ลบแล้ว'); render();
}

function createTaskFromContact(contactId) {
  var logs = JSON.parse(localStorage.getItem('v7_contact_logs') || '[]');
  var contact = null;
  for (var i = 0; i < logs.length; i++) { if (logs[i].id === contactId) { contact = logs[i]; break; } }
  if (!contact) return;
  
  var taskTitle = prompt('📋 ชื่องาน:', 'ติดตาม: ' + (contact.summary || '').substr(0, 40));
  if (!taskTitle) return;
  var dueDate = prompt('📅 กำหนดเสร็จ (DD/MM/YYYY):', addD(_td(), 3));
  
  ST.add('tasks', {
    title: taskTitle, description: 'จาก ' + contact.channel + ': ' + contact.summary,
    dealerId: contact.dealerId, pipeId: contact.pipeId, dueDate: dueDate || '',
    priority: 'medium', status: 'active', category: 'Contact', contactId: contact.id
  });
  toast('📋 สร้างงาน: ' + taskTitle); render();
}
// ================================================================
// PIPELINE ACTION ITEMS (สำหรับ Pipeline Detail)
// ================================================================

// Get pipe actions from localStorage
function getPipeActions() {
  var saved = localStorage.getItem('v7_pipeActions');
  if (saved) {
    try { return JSON.parse(saved); } catch(e) { return []; }
  }
  return [];
}

function savePipeActions(list) {
  localStorage.setItem('v7_pipeActions', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('pipeActions', list);
}

function getPipeActionsByPipe(pipeId) {
  var actions = getPipeActions();
  return (actions || []).filter(function(a) {
    return a.pipeId === pipeId && a.status !== 'dropped';
  });
}

function autoUpdatePipeNextAction(pipeId) {
  var actions = getPipeActionsByPipe(pipeId);
  var pending = (actions || []).filter(function(a) { return a.status === 'pending'; });

  if (!pending.length) return;

  pending.sort(function(a, b) {
    var da = ftParseDate(a.dueDate);
    var db = ftParseDate(b.dueDate);
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  var nearest = pending[0];
  var pipe = null;
  try { pipe = ST.getOne('pipeline', pipeId); } catch(e) { pipe = null; }
  if (!pipe) return;

  var updates = {};
  if (nearest.text) updates.nextAction = nearest.text;
  if (nearest.dueDate) updates.followupDate = nearest.dueDate;

  try { ST.update('pipeline', pipeId, updates); } catch(e) {}
}

function markPipeActionDone(actionId) {
  var response = prompt('💬 ผลลัพธ์ / ตอบกลับ (ถ้ามี):');
  
  var actions = getPipeActions();
  var pipeId = '';

  for (var i = 0; i < actions.length; i++) {
    if (actions[i].id === actionId) {
      actions[i].status = 'done';
      actions[i].doneDate = _td();
      if (response) actions[i].response = response;
      pipeId = actions[i].pipeId;

      if (ST && ST.add) {
        ST.add('pipeLog', {
          pipeId: pipeId,
          type: 'progress',
          content: '✅ เสร็จ: ' + actions[i].text + (response ? ' — ' + response : ''),
          date: _nw()
        });
      }
      break;
    }
  }
  
  savePipeActions(actions);
  if (pipeId) autoUpdatePipeNextAction(pipeId);

  toast('✅ เสร็จแล้ว!');
  render();
}

function extendPipeAction(actionId) {
  var newDate = prompt('📅 กำหนดใหม่ (DD/MM/YYYY):');
  if (!newDate) return;

  var actions = getPipeActions();
  var pipeId = '';

  for (var i = 0; i < actions.length; i++) {
    if (actions[i].id === actionId) {
      var oldDate = actions[i].dueDate;
      actions[i].dueDate = newDate;
      pipeId = actions[i].pipeId;

      if (ST && ST.add) {
        ST.add('pipeLog', {
          pipeId: pipeId,
          type: 'followup',
          content: '🔄 เลื่อนกำหนด: ' + actions[i].text + ' (' + oldDate + ' → ' + newDate + ')',
          date: _nw()
        });
      }
      break;
    }
  }
  
  savePipeActions(actions);
  if (pipeId) autoUpdatePipeNextAction(pipeId);

  toast('📅 เลื่อนกำหนดแล้ว');
  render();
}

function dropPipeAction(actionId) {
  if (!confirm('ยกเลิก Action Item นี้?')) return;
  
  var actions = getPipeActions();
  var pipeId = '';

  for (var i = 0; i < actions.length; i++) {
    if (actions[i].id === actionId) {
      actions[i].status = 'dropped';
      pipeId = actions[i].pipeId;
      break;
    }
  }
  
  savePipeActions(actions);
  if (pipeId) autoUpdatePipeNextAction(pipeId);

  toast('🗑️ ยกเลิกแล้ว');
  render();
}

function buildPipeActionsHTML(pipeId) {
  var actions = getPipeActionsByPipe(pipeId);
  var pending = (actions || []).filter(function(a) { return a.status === 'pending'; });
  var done = (actions || []).filter(function(a) { return a.status === 'done'; });
  var now = new Date();
  now.setHours(0, 0, 0, 0);

  pending.sort(function(a, b) {
    var da = ftParseDate(a.dueDate);
    var db = ftParseDate(b.dueDate);
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  var h = '<div class="card"><h2>⏳ Action Items';
  if (pending.length > 0) h += ' <span class="pa-count-badge">' + pending.length + ' ค้าง</span>';
  h += ' <span class="ml"><button class="btn bsm bp" onclick="showAddPipeActionM(\'' + pipeId + '\')">➕</button></span></h2>';

  if (!pending.length && !done.length) {
    h += '<div class="empty"><p>ไม่มี Action Item — กด ➕ เพื่อเพิ่ม</p></div>';
    h += '</div>';
    return h;
  }

  // Pending actions
  if (pending.length) {
    pending.forEach(function(a) {
      var due = ftParseDate(a.dueDate);
      var daysLeft = due ? Math.ceil((due - now) / 86400000) : 999;
      var urgClass = 'pa-normal';
      var urgLabel = '';

      if (daysLeft < 0) {
        urgClass = 'pa-overdue';
        urgLabel = '<span class="pa-urg pa-urg-red">🔴 เกิน ' + Math.abs(daysLeft) + ' วัน</span>';
      } else if (daysLeft === 0) {
        urgClass = 'pa-overdue';
        urgLabel = '<span class="pa-urg pa-urg-red">🔴 วันนี้!</span>';
      } else if (daysLeft <= 2) {
        urgClass = 'pa-urgent';
        urgLabel = '<span class="pa-urg pa-urg-orange">🟠 อีก ' + daysLeft + ' วัน</span>';
      } else if (daysLeft <= 5) {
        urgClass = 'pa-soon';
        urgLabel = '<span class="pa-urg pa-urg-yellow">🟡 อีก ' + daysLeft + ' วัน</span>';
      } else {
        urgLabel = '<span class="pa-urg pa-urg-green">🟢 อีก ' + daysLeft + ' วัน</span>';
      }

      h += '<div class="pa-item ' + urgClass + '">';
      h += '<div class="pa-dot"></div>';
      h += '<div class="pa-content">';
      h += '<div class="pa-header">';
      h += '<span class="pa-text">' + sanitize(a.text) + '</span>';
      h += (a.priority === 1 ? ' <span class="pa-priority">🔴 เร่งด่วน</span>' : '');
      h += '</div>';
      h += '<div class="pa-meta">';
      h += '📅 กำหนด: <strong>' + (a.dueDate || '-') + '</strong> ' + urgLabel;
      h += '</div>';
      if (a.note) h += '<div class="pa-note">' + sanitize(a.note) + '</div>';
      h += '<div class="pa-actions">';
      h += '<button class="btn-xs pa-btn-done" onclick="markPipeActionDone(\'' + a.id + '\')">✅ เสร็จแล้ว</button>';
      h += '<button class="btn-xs pa-btn-extend" onclick="extendPipeAction(\'' + a.id + '\')">📅 เลื่อนกำหนด</button>';
      h += '<button class="btn-xs pa-btn-drop" onclick="dropPipeAction(\'' + a.id + '\')">✕</button>';
      h += '</div>';
      h += '</div></div>';
    });
  }

  // Done actions (collapsible)
  if (done.length) {
    h += '<div class="pa-done-toggle" onclick="togglePaDone()">✅ เสร็จแล้ว (' + done.length + ') <span id="paDoneArrow">▶</span></div>';
    h += '<div class="pa-done-list" id="paDoneList" style="display:none">';
    done.sort(function(a, b) {
      var da = ftParseDate(a.doneDate || a.createdDate);
      var db = ftParseDate(b.doneDate || b.createdDate);
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
    done.forEach(function(a) {
      h += '<div class="pa-item pa-done">';
      h += '<div class="pa-dot pa-dot-done"></div>';
      h += '<div class="pa-content">';
      h += '<div class="pa-text" style="text-decoration:line-through;opacity:0.6">' + sanitize(a.text) + '</div>';
      h += '<div class="pa-meta" style="opacity:0.5">✅ ' + (a.doneDate || '-');
      if (a.response) h += ' — ' + sanitize(a.response);
      h += '</div></div></div>';
    });
    h += '</div>';
  }

  h += '</div>';
  return h;
}

function togglePaDone() {
  var el = document.getElementById('paDoneList');
  var arrow = document.getElementById('paDoneArrow');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (arrow) arrow.textContent = '▼';
  } else {
    el.style.display = 'none';
    if (arrow) arrow.textContent = '▶';
  }
}
// ================================================================
// RESCHEDULE TASK (เลื่อนกำหนดงาน)
// ================================================================

function showRescheduleModal(taskId) {
  var t = ST.getOne('tasks', taskId);
  if (!t) return;
  
  var oldDueDate = t.dueDate || '';
  var defaultDate = t.dueDate || _td();
  
  // แปลงวันที่ให้แสดงในรูปแบบ DD/MM/YYYY
  function formatDateToDisplay(isoDate) {
    if (!isoDate) return '';
    var parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    var day = parts[2];
    var month = parts[1];
    var year = parseInt(parts[0]) + 543;
    return day + '/' + month + '/' + year;
  }
  
  var html = `
    <div style="max-width:450px">
      <div class="fg">
        <label>📅 วันที่กำหนดเดิม</label>
        <div style="padding:8px;background:var(--bg2);border-radius:6px;font-size:14px">${oldDueDate || 'ไม่ได้ตั้ง'}</div>
      </div>
      <div class="fg">
        <label>📅 กำหนดใหม่ *</label>
        <input type="text" id="newDueDateInput" class="fm-input" value="${formatDateToDisplay(defaultDate)}" placeholder="DD/MM/YYYY" autocomplete="off">
        <div class="hint">รูปแบบ: วัน/เดือน/ปี (เช่น 31/12/2568)</div>
      </div>
      <div class="fg">
        <label>📝 เหตุผลที่เลื่อน</label>
        <textarea id="rescheduleReason" rows="2" class="fm-input" placeholder="เช่น รอเอกสารจากลูกค้า, ลูกค้าขอเลื่อน, งบไม่ออก..."></textarea>
      </div>
      <div class="fg">
        <label>🔔 แจ้งเตือน</label>
        <div class="check-g">
          <label><input type="checkbox" id="notifyChange" checked> ส่งเตือนใน Notification</label>
        </div>
      </div>
      <div class="fm-actions" style="margin-top:16px">
        <button class="btn btn-blue" onclick="saveRescheduleTask('${taskId}')">💾 บันทึก</button>
        <button class="btn" onclick="closeM()">ยกเลิก</button>
      </div>
    </div>
  `;
  
  openM('📅 เลื่อนกำหนดเสร็จ', html);
}

function saveRescheduleTask(taskId) {
  // อ่านวันที่จาก input (รูปแบบ DD/MM/YYYY)
  var dateStr = document.getElementById('newDueDateInput').value.trim();
  var reason = document.getElementById('rescheduleReason').value.trim();
  var sendNotify = document.getElementById('notifyChange')?.checked || false;
  
  if (!dateStr) {
    toast('⚠️ กรุณาใส่วันที่');
    return;
  }
  
  // แปลงวันที่จาก DD/MM/YYYY เป็น YYYY-MM-DD
  function convertToISODate(dateStr) {
    var parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    var day = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    var christianYear = year - 543;
    return christianYear + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }
  
  var newDueDate = convertToISODate(dateStr);
  if (!newDueDate) {
    toast('⚠️ รูปแบบวันที่ไม่ถูกต้อง (ใช้ DD/MM/YYYY)');
    return;
  }
  
  var t = ST.getOne('tasks', taskId);
  if (!t) return;
  
  var oldDueDate = t.dueDate;
  
  // บันทึกประวัติการเลื่อน
  var history = t.dueDateHistory || [];
  history.push({
    oldDate: oldDueDate || '',
    newDate: newDueDate,
    reason: reason || 'ไม่ได้ระบุ',
    changedBy: (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.displayName : 'Siwawong',
    changedAt: _td()
  });
  
  // อัพเดท task
  ST.update('tasks', taskId, { 
    dueDate: newDueDate, 
    dueDateHistory: history,
    updatedAt: _nw()
  });
  
  // เพิ่ม log
  ST.add('taskLogs', {
    tid: taskId,
    type: 'reschedule',
    content: `📅 เลื่อนกำหนดจาก ${oldDueDate || '-'} เป็น ${newDueDate}${reason ? ' (' + reason + ')' : ''}`,
    date: _nw()
  });
  
  // ส่ง Notification (ถ้าเปิด)
  if (sendNotify && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('📅 กำหนดการเปลี่ยนแปลง', {
      body: `งาน "${t.title}" ถูกเลื่อนจาก ${oldDueDate || '-'} เป็น ${newDueDate}`,
      tag: 'task_' + taskId
    });
  }
  
  closeMForce();
  toast(`📅 เลื่อนกำหนดเป็น ${newDueDate} แล้ว`);
  render();
}