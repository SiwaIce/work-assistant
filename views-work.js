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
var taskCardCols = 1;         // 1 หรือ 2 — จำนวนคอลัมน์การ์ดตอนดูแบบรายการ (list)
var tasksGroupBy = 'none';   // 'none', 'dealer', 'status', 'dueDate'
var tasksFilterStatus = 'active';   // 'all', 'active', 'completed', 'on-hold' — default โฟกัสงานที่ยังต้องทำก่อน กด "ทั้งหมด" เองได้ถ้าอยากดูรวม
var tasksFilterPriority = 'all'; // 'all', 'high', 'medium', 'low'
var tasksFilterDealer = 'all';
var tasksFilterCategory = 'all';
var tasksSearch = '';
var tasksSortDate = 'asc'; // 'asc' = เก่าสุด→ใหม่สุด (ใกล้ครบกำหนดก่อน, ค่าเริ่มต้นเดิม), 'desc' = ใหม่สุด→เก่าสุด

// ตัวแปรสำหรับ Kanban drag & drop
var dragSourceTaskId = null;

// สถานะย่อ/ขยายการ์ดงาน ต่อ task id (true = ขยายเต็ม) — ไม่มี key = ย่อ (ค่าเริ่มต้น)
// จำไว้ระหว่างใช้งาน (session) ไม่ reset ตอน render() ซ้ำ กันต้องกดขยายใหม่ทุกครั้งที่มีการอัพเดทหน้า
var _taskCardExpanded = {};
function toggleTaskCardExpand(tid, ev) {
  if (ev) ev.stopPropagation();
  _taskCardExpanded[tid] = !_taskCardExpanded[tid];
  var t = ST.getOne('tasks', tid);
  var cardEl = document.querySelector('[data-task-id="' + tid + '"]');
  if (t && cardEl) {
    var wrap = document.createElement('div');
    wrap.innerHTML = renderTaskCard(t).trim();
    cardEl.replaceWith(wrap.firstElementChild);
  }
}

function rUnifiedTasks(el) {
  document.getElementById('pgT').textContent = '📋 งานทั้งหมด';
  
  var allTasks = ST.getAll('tasks');
  var dealers = ST.getAll('dealers');
  var categories = getUniqueCategories(allTasks);
  
  var filteredTasks = filterTasks(allTasks);
  
  filteredTasks.sort(function(a, b) {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    // ระหว่างกำลังเลื่อนวันที่การ์ดไหนอยู่ (ดู openTaskDateShift) ใช้วันที่ ณ ตอนเปิดโหมด ไม่ใช่ค่าล่าสุด —
    // กันการ์ดกระโดดตำแหน่งในลิสต์ทุกครั้งที่กด ◀ ▶ (จัดเรียงตามวันที่ใหม่ทันที ทำให้กดต่อเนื่องไม่ได้
    // ต้องเปิดโหมดใหม่ทุกรอบ) พอกดปิดโหมดแล้วค่อยจัดเรียงตามวันที่จริงตามปกติ
    var aDate = (a.id === _taskDateShiftId && _taskDateShiftOrigDate) ? _taskDateShiftOrigDate : a.dueDate;
    var bDate = (b.id === _taskDateShiftId && _taskDateShiftOrigDate) ? _taskDateShiftOrigDate : b.dueDate;
    if (aDate && bDate) return tasksSortDate === 'desc' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
    if (aDate) return -1;
    if (bDate) return 1;
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
  if (tasksView === 'list') {
    h += '<div style="margin-left:auto;display:flex;gap:2px">';
    h += '<div class="today-tab ' + (taskCardCols === 1 ? 'act' : '') + '" title="1 การ์ดต่อแถว" onclick="taskCardCols=1;render()">🔲 1</div>';
    h += '<div class="today-tab ' + (taskCardCols === 2 ? 'act' : '') + '" title="2 การ์ดต่อแถว" onclick="taskCardCols=2;render()">⚏ 2</div>';
    h += '</div>';
  }
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
        oninput="tasksSearchInput(this.value)">
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

      <select id="taskSortDate" onchange="tasksSortDate=this.value;render()" style="width:150px">
        <option value="asc" ${tasksSortDate === 'asc' ? 'selected' : ''}>🔃 วันที่: เก่าสุด→ใหม่สุด</option>
        <option value="desc" ${tasksSortDate === 'desc' ? 'selected' : ''}>🔃 วันที่: ใหม่สุด→เก่าสุด</option>
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
  tasksSortDate = 'asc';
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
    
    // เดิมใช้ auto-fit minmax(280px,1fr) ตั้งใจให้ยุบคอลัมน์เองบนจอแคบ แต่ auto-fit ก็ยัดคอลัมน์เพิ่มเรื่อยๆ
    // บนจอกว้างด้วยเหมือนกัน (จอกว้างพอ 280px*5 กลายเป็น 5 คอลัมน์ ทั้งที่ตั้งใจแค่ 2) เปลี่ยนเป็น repeat(2,...)
    // ตายตัวจริง แล้วให้ media query ใน style.css คุม breakpoint แทน (ต่ำกว่า 700px ยุบเป็น 1 คอลัมน์เสมอ)
    h += '<div class="task-grid' + (taskCardCols === 2 ? ' task-grid-2col' : '') + '">';
    
    for (var i = 0; i < tasks.length; i++) {
      h += renderTaskCard(tasks[i]);
    }
    
    h += '</div>';
  }
  
  return h;
}

// ตัวเดียวที่ activate ได้ทีละอัน (การ์ดไหนกำลังอยู่โหมดเลื่อนวัน / เลือกสถานะด่วน) — เก็บเป็น global เดียว
// พอง่ายกว่าเก็บต่อการ์ด และ render() ถูกเรียกซ้ำได้เสมอโดยไม่หลุดโหมดที่เปิดค้างไว้
var _taskDateShiftId = null;
var _taskDateShiftOrigDate = null; // วันที่ ณ ตอนเปิดโหมด — ใช้ตรึงตำแหน่งการ์ดในลิสต์ไม่ให้กระโดดระหว่างเลื่อน (ดู sort ใน rUnifiedTasks)
var _taskStatusPickId = null;

function closeTaskDateShift() { _taskDateShiftId = null; _taskDateShiftOrigDate = null; render(); }
function openTaskDateShift(tid, ev) {
  if (ev) ev.stopPropagation();
  var t = ST.getOne('tasks', tid);
  _taskDateShiftId = tid;
  _taskDateShiftOrigDate = t ? t.dueDate : null;
  _taskStatusPickId = null;
  render();
}
function shiftTaskDate(tid, delta, ev) {
  if (ev) ev.stopPropagation();
  var t = ST.getOne('tasks', tid);
  if (!t || !t.dueDate) return;
  ST.update('tasks', tid, { dueDate: addD(t.dueDate, delta) });
  render();
}
function closeTaskStatusPick(ev) { if (ev) ev.stopPropagation(); _taskStatusPickId = null; render(); }
function openTaskStatusPick(tid, ev) { if (ev) ev.stopPropagation(); _taskStatusPickId = tid; _taskDateShiftId = null; _taskDateShiftOrigDate = null; render(); }
function quickSetTaskStatus(tid, status, ev) {
  if (ev) ev.stopPropagation();
  ST.update('tasks', tid, { status: status });
  _taskStatusPickId = null;
  toast(status === 'completed' ? '✅ เสร็จแล้ว' : status === 'on-hold' ? '⏸ พักงานนี้ไว้ก่อน' : '🔄 กลับมาทำต่อ');
  render();
}

function renderTaskCard(t) {
  var isCompleted = t.status === 'completed';
  var daysLeft = t.dueDate ? dTo(t.dueDate) : null;

  // tier: red (เกิน/วันนี้) / amber (พรุ่งนี้ หรือ <=3 วัน) / gray (ปกติ) — ใช้ทั้งพื้นหลังไล่สีการ์ด และสีป้ายวันที่
  var tier = 'gray';
  var dayLabel = '';
  if (!isCompleted && daysLeft !== null) {
    if (daysLeft < 0) { tier = 'red'; dayLabel = 'เกิน ' + Math.abs(daysLeft) + ' วัน'; }
    else if (daysLeft === 0) { tier = 'red'; dayLabel = 'วันนี้!'; }
    else if (daysLeft === 1) { tier = 'amber'; dayLabel = 'พรุ่งนี้'; }
    else if (daysLeft <= 3) { tier = 'amber'; dayLabel = 'อีก ' + daysLeft + ' วัน'; }
    else { dayLabel = 'อีก ' + daysLeft + ' วัน'; }
  }

  var priorityIcon = '';
  if (t.priority === 'high') priorityIcon = '🔴';
  else if (t.priority === 'medium') priorityIcon = '🟡';
  else priorityIcon = '🟢';

  // แถว "เชื่อมโยง" รวม Dealer/Pipeline (dealerId/pipeId แบบเดิม) + t.links (ดู TASK_LINK_TYPES/
  // openTaskLink ใน utils.js) เป็นรายการเดียวกัน กดเปิดปลายทางตรงได้ทุกอัน — โชว์แค่ 4 อันแรกกันรก
  // เกินนั้นย่อเป็น "+N" กดแล้วไปหน้ารายละเอียดงานเพื่อดูครบ
  var connections = [];
  if (t.dealerId) {
    var _cd = ST.getOne('dealers', t.dealerId);
    if (_cd) connections.push({ icon: '🏪', label: _cd.name || '-', onclick: "event.stopPropagation();go('dealerDetail',{dealerId:'" + t.dealerId + "'})" });
  }
  if (t.pipeId) {
    var _cp = ST.getOne('pipeline', t.pipeId);
    if (_cp) connections.push({ icon: '📊', label: _cp.projectName || _cp.name || '-', onclick: "event.stopPropagation();go('pipeDetail',{pipeId:'" + t.pipeId + "'})" });
  }
  (t.links || []).forEach(function(l) {
    var lt = TASK_LINK_TYPES[l.type] || { icon: '🔗' };
    if (l.pending) {
      // ลิงก์ "รอสร้าง" — ยังไม่มี id จริง กดแล้วพาไปหน้าสร้างใหม่ของเมนูนั้นเลย (ดู openTaskLinkCreate)
      connections.push({ icon: '⏳', label: lt.name + ' (รอสร้าง)', onclick: "event.stopPropagation();openTaskLinkCreate('" + l.type + "','" + t.id + "')", pending: true });
    } else {
      connections.push({ icon: lt.icon, label: l.label, onclick: "event.stopPropagation();openTaskLink('" + l.type + "','" + l.id + "')" });
    }
  });
  var linkRowHtml = '';
  if (connections.length) {
    var shownConn = connections.slice(0, 4);
    var extraConn = connections.length - shownConn.length;
    linkRowHtml = '<div class="task-link-row">' +
      shownConn.map(function(c) {
        return '<span class="task-link-badge' + (c.pending ? ' pending' : '') + '" onclick="' + c.onclick + '" title="' + sanitize(c.label) + '">' + c.icon + ' ' + sanitize((c.label || '').substr(0, 14)) + '</span>';
      }).join('') +
      (extraConn > 0 ? '<span class="task-link-badge" onclick="event.stopPropagation();go(\'taskDetail\',{taskId:\'' + t.id + '\'})">+' + extraConn + '</span>' : '') +
      '</div>';
  }

  var fuCount = countTaskFollowups(t);
  var fuHtml = '';
  if (fuCount > 0) {
    fuHtml = '<span class="task-fu-badge" title="ติดตาม ' + fuCount + ' ครั้ง">📞' + fuCount + '</span>';
  }

  // Progress ring — แทน progress bar เดิม วงกลม r=16 เส้นรอบวง ~100.5
  var pg = prog(t);
  var ringColor = isCompleted ? '#22c55e' : (tier === 'gray' ? 'var(--accent)' : '#fff');
  var ringTrack = tier === 'gray' ? 'var(--border)' : 'rgba(255,255,255,.18)';
  var ringDash = (pg / 100 * 100.5).toFixed(1) + ' 100.5';
  var ringCenter = isCompleted ? '✅' : priorityIcon;
  var ringHtml = '<div class="task-ring">' +
    '<svg width="38" height="38" style="transform:rotate(-90deg)">' +
    '<circle cx="19" cy="19" r="16" fill="none" stroke="' + ringTrack + '" stroke-width="4"></circle>' +
    '<circle cx="19" cy="19" r="16" fill="none" stroke="' + ringColor + '" stroke-width="4" stroke-dasharray="' + ringDash + '" stroke-linecap="round"></circle>' +
    '</svg><span>' + ringCenter + '</span></div>';

  // step ปัจจุบัน = step แรกที่ยังไม่ done (ตามลำดับ) — ถ้าไม่มี step หรือทำครบแล้วไม่ต้องโชว์แถวนี้
  var steps = t.steps || [];
  var curStep = steps.find(function(s) { return !s.done; });
  var stepNameHtml = curStep ? '<div class="task-step-name">🔸 ' + sanitize(curStep.title || '') + '</div>' : '';

  // อัพเดทล่าสุดจากไทม์ไลน์ (taskLogs) — โชว์แค่บรรทัดเดียวสรุปย่อ ไม่ใช่ไทม์ไลน์เต็ม กันการ์ดรก
  // ดูรายละเอียดทั้งหมดต้องเปิดหน้า Task detail เอง
  var latestLog = ST.filter('taskLogs', function(l) { return l.tid === t.id; }).sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); })[0];
  var latestUpdateHtml = '';
  if (latestLog && latestLog.content) {
    var luText = latestLog.content.length > 40 ? latestLog.content.substr(0, 40) + '…' : latestLog.content;
    latestUpdateHtml = '<div class="task-latest-update">💬 "' + sanitize(luText) + '" · ' + fDRelative(latestLog.date) + '</div>';
  }
  var stepBarHtml = '';
  if (steps.length > 1) {
    stepBarHtml = '<div class="task-step-bar">' + steps.map(function(s) {
      return '<span class="' + (s.done ? 'on' : '') + '"></span>';
    }).join('') + '</div>';
  }

  // ป้ายวันครบกำหนด — กดแล้วสลับเป็นแถบลูกศรเลื่อนวัน (โหมดเดียวเปิดได้ทีละการ์ด ดู _taskDateShiftId)
  // มีทั้งลูกศรทีละวัน (◀▶) และทีละสัปดาห์ (««»») เผื่ออยากเลื่อนไปไกลๆ ไม่ต้องกดทีละวันหลายครั้ง — ตอนเปิด
  // โหมดนี้ทำเป็นแถบเต็มความกว้างแยกต่างหาก (ไม่ใช่มุมขวาบนแบบปกติ) กันปุ่มเยอะขึ้นจนทับข้อความชื่องานบนการ์ดแคบๆ
  var dateBadgeHtml = '';
  var dateShiftBarHtml = '';
  if (t.dueDate) {
    var dow = DAYS_S[new Date(t.dueDate).getDay()];
    if (_taskDateShiftId === t.id) {
      dateShiftBarHtml = '<div class="task-date-shift-bar" onclick="event.stopPropagation()">' +
        '<button type="button" title="ถอย 1 สัปดาห์" onclick="shiftTaskDate(\'' + t.id + '\',-7,event)">«</button>' +
        '<button type="button" title="ถอย 1 วัน" onclick="shiftTaskDate(\'' + t.id + '\',-1,event)">◀</button>' +
        '<span onclick="closeTaskDateShift(event)">' + fDShort(t.dueDate) + ' (' + dow + ')</span>' +
        '<button type="button" title="ไป 1 วัน" onclick="shiftTaskDate(\'' + t.id + '\',1,event)">▶</button>' +
        '<button type="button" title="ไป 1 สัปดาห์" onclick="shiftTaskDate(\'' + t.id + '\',7,event)">»</button>' +
        '</div>';
    } else {
      dateBadgeHtml = '<div class="task-date-badge tier-' + tier + '" onclick="openTaskDateShift(\'' + t.id + '\',event)">' +
        (dayLabel ? '<span class="task-date-pill">' + dayLabel + '</span>' : '') +
        '<div class="task-date-num">' + fDShort(t.dueDate) + ' (' + dow + ')</div></div>';
    }
  }

  // ปุ่มด้านล่าง — ปกติ 3 ปุ่ม, กด "📝 อัพเดท" แล้วสลับเป็นชิปเปลี่ยนสถานะด่วนแทน (ดู _taskStatusPickId)
  var actionsHtml;
  if (_taskStatusPickId === t.id) {
    actionsHtml =
      '<span class="task-status-chip' + (t.status === 'active' ? ' cur' : '') + '" onclick="quickSetTaskStatus(\'' + t.id + '\',\'active\',event)">🔄 กำลังทำ</span>' +
      '<span class="task-status-chip chip-done' + (t.status === 'completed' ? ' cur' : '') + '" onclick="quickSetTaskStatus(\'' + t.id + '\',\'completed\',event)">✅ เสร็จ</span>' +
      '<span class="task-status-chip' + (t.status === 'on-hold' ? ' cur' : '') + '" onclick="quickSetTaskStatus(\'' + t.id + '\',\'on-hold\',event)">⏸ พัก</span>' +
      '<span class="task-status-chip-close" onclick="closeTaskStatusPick(event)">✕</span>';
  } else {
    actionsHtml =
      '<button class="task-action-btn" onclick="openTaskStatusPick(\'' + t.id + '\',event)" title="อัพเดทด่วน">📝</button>' +
      '<button class="task-action-btn" onclick="showStepFuM(\'' + t.id + '\', -1)" title="ติดตาม">📞</button>' +
      '<button class="task-action-btn" onclick="startTimer(\'task\',\'' + t.id + '\',\'' + sanitize(t.title).substr(0, 15) + '\')" title="จับเวลา">⏱️</button>';
  }

  var cardClass = 'task-card task-card-v2 tier-' + tier;
  if (isCompleted) cardClass += ' task-completed';
  var checkedAttr = isCompleted ? 'checked' : '';

  // ย่อ/ขยาย — ค่าเริ่มต้นย่อ แสดงแค่หัวข้องาน/ป้ายวันที่/แถวลิงก์ กันการ์ดกินพื้นที่เยอะตอนดูรายการยาวๆ
  // กด ▾/▴ (หรือทั้งแถวหัวข้อ) เพื่อขยายดู ring/ขั้นตอน/อัพเดทล่าสุด/ปุ่ม/คอมเมนต์แบบเดิมทั้งหมด
  var expanded = !!_taskCardExpanded[t.id];
  var expandToggleHtml = '<span class="task-expand-toggle" onclick="toggleTaskCardExpand(\'' + t.id + '\',event)" title="' + (expanded ? 'ย่อการ์ด' : 'ขยายการ์ด') + '">' + (expanded ? '▴' : '▾') + '</span>';

  return `
  <div class="${cardClass}" data-task-id="${t.id}">
    ${dateBadgeHtml}
    <div class="task-card-body" onclick="go('taskDetail',{taskId:'${t.id}'})">
      ${dateShiftBarHtml}
      <div class="task-card-main-row" style="${t.dueDate && _taskDateShiftId !== t.id ? 'padding-right:80px' : ''}">
        <input type="checkbox" class="task-complete-chk" ${checkedAttr}
          onclick="event.stopPropagation();toggleTaskComplete('${t.id}', this.checked)">
        ${expanded ? ringHtml : ''}
        <div style="flex:1;min-width:0">
          <div class="task-title">${sanitize(t.title)}</div>
          ${expanded ? `<div class="task-card-meta">
            ${t.category ? '<span class="task-category">📂 ' + sanitize(t.category) + '</span>' : ''}
            ${fuHtml}
          </div>` : ''}
        </div>
        ${expandToggleHtml}
      </div>
      ${expanded ? stepNameHtml : ''}
      ${expanded ? latestUpdateHtml : ''}
      ${expanded ? `<div class="task-card-actions" onclick="event.stopPropagation()">
        ${actionsHtml}
      </div>
      <textarea rows="2" class="task-comment-input" placeholder="💬 พิมพ์คอมเมนต์... (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
        onclick="event.stopPropagation()"
        oninput="this.classList.toggle('overflowing', this.scrollHeight > this.clientHeight)"
        onkeydown="event.stopPropagation();if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();addQuickTaskComment('${t.id}',this)}"></textarea>` : ''}
      ${linkRowHtml}
    </div>
    ${expanded ? stepBarHtml : ''}
  </div>
  `;
}

// บันทึกคอมเมนต์ด่วนจากหน้าการ์ด — ไม่เปิดโมดัลอัพเดทเต็ม แค่พิมพ์แล้ว Enter (เก็บใน taskLogs เหมือนโน้ตใน
// โมดัล "อัพเดทด่วน" เดิมทุกอย่าง จะไปโผล่ในไทม์ไลน์ของงานที่หน้ารายละเอียดด้วย)
function addQuickTaskComment(taskId, inputEl) {
  var val = inputEl.value.trim();
  if (!val) return;
  ST.add('taskLogs', { tid: taskId, type: 'update', content: val, date: _nw() });
  toast('💬 บันทึกคอมเมนต์แล้ว');
  // อัพเดทเฉพาะการ์ดนี้ (ไม่เรียก render() เต็มหน้า) กันเลื่อนตำแหน่ง/ตัดโฟกัสจากช่องพิมพ์ในการ์ดอื่นที่อาจ
  // กำลังพิมพ์ค้างอยู่พร้อมกัน — แทนที่ DOM การ์ดเดิมด้วยผลลัพธ์ renderTaskCard() ที่คำนวณใหม่ (มี latestUpdateHtml
  // ล่าสุดแล้ว) โดยตรง
  var t = ST.getOne('tasks', taskId);
  var cardEl = document.querySelector('[data-task-id="' + taskId + '"]');
  if (t && cardEl) {
    var wrap = document.createElement('div');
    wrap.innerHTML = renderTaskCard(t).trim();
    cardEl.replaceWith(wrap.firstElementChild);
  }
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
  var prevStatus = (ST.getOne('tasks', taskId) || {}).status || 'active';
  var newStatus = isChecked ? 'completed' : 'active';
  ST.update('tasks', taskId, {status: newStatus});

  if (isChecked) {
    ST.add('taskLogs', {tid: taskId, type: 'completed', content: '✅ งานเสร็จสิ้น', date: _nw()});
  }

  render();

  if (isChecked) {
    // กันเผลอกดติ๊กถูกพลาด — ย้อนกลับสถานะเดิมได้ภายในไม่กี่วิ (ดู showUndoToast ใน utils.js)
    showUndoToast('✅ ทำเครื่องหมายเสร็จ', function() {
      ST.update('tasks', taskId, { status: prevStatus });
      toast('↩️ ย้อนกลับแล้ว');
      render();
    });
  } else {
    toast('🔄 กลับเป็นกำลังทำ');
  }
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
    
    var monthParts = monthKey.split('/');
    var dayCellMonth = monthParts[0], dayCellYear = monthParts[1];

    for (var d = 1; d <= totalDays; d++) {
      var dayTasks = tasksByDay[d] || [];
      var isToday = isTodayDate(d, monthKey);
      var isPast = isPastDate(d, monthKey);
      var dayIso = dayCellYear + '-' + String(dayCellMonth).padStart(2, '0') + '-' + String(d).padStart(2, '0');

      // คลิกพื้นที่ว่างของวันไหน (ไม่ใช่ตัวการ์ดงาน) เปิดฟอร์ม "เพิ่มงาน" ทันที ตั้ง Deadline เป็นวันนั้นให้เลย
      // ตัวการ์ดงานแต่ละอันมี stopPropagation กันไม่ให้ทริกเกอร์การเพิ่มงานซ้อนตอนแค่จะดูรายละเอียด
      h += '<div class="timeline-day ' + (isToday ? 'timeline-day-today' : '') + (isPast ? 'timeline-day-past' : '') + '" onclick="showTaskM(null,\'\',\'' + dayIso + '\')" title="คลิกเพื่อเพิ่มงาน กำหนดส่งวันนี้">';
      h += '<div class="timeline-day-num">' + d + '<span class="timeline-day-add">+</span></div>';

      for (var i = 0; i < dayTasks.length; i++) {
        var t = dayTasks[i];
        var daysLeft = dTo(t.dueDate);
        var isOverdue = daysLeft < 0;

        h += '<div class="timeline-task ' + (isOverdue ? 'timeline-task-overdue' : '') + '" onclick="event.stopPropagation();go(\'taskDetail\',{taskId:\'' + t.id + '\'})">';
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

  // วงแหวนความคืบหน้า — r=24 เส้นรอบวง ~150.8 (ตามดีไซน์การ์ดงานย่อ/ขยาย ใน renderTaskCard)
  var ringColor = t.status === 'completed' ? '#22c55e' : 'var(--accent)';
  var ringDash = (pg / 100 * 150.8).toFixed(1) + ' 150.8';
  var ringHtml = '<div class="td2-ring"><svg width="60" height="60" style="transform:rotate(-90deg)">' +
    '<circle cx="30" cy="30" r="24" fill="none" stroke="var(--bg2)" stroke-width="5"></circle>' +
    '<circle cx="30" cy="30" r="24" fill="none" stroke="' + ringColor + '" stroke-width="5" stroke-dasharray="' + ringDash + '" stroke-linecap="round"></circle>' +
    '</svg><span>' + pg + '%</span></div>';

  var doneSteps = (t.steps || []).filter(function(s) { return s.done; }).length;

  var html = `
  <div class="td2">

    <div class="td2-topbar">
      <span class="td2-back" onclick="go('tasks')">‹ งานทั้งหมด</span>
      <div class="td2-icons">
        <button class="td2-icon-btn" onclick="startTimer('task','${t.id}','${sanitize(t.title).substr(0,18)}')" title="จับเวลา">⏱️</button>
        <button class="td2-icon-btn ${isPinned ? 'on' : ''}" onclick="ST.togglePin('task','${t.id}','${sanitize(t.title)}','');render()" title="ปักหมุด">📌</button>
        <button class="td2-icon-btn" onclick="showTaskM('${t.id}')" title="แก้ไข">✏️</button>
        <button class="td2-icon-btn" onclick="delTask('${t.id}')" title="ลบ">🗑️</button>
      </div>
    </div>

    <!-- Task Header -->
    <div class="td2-card">
      <div class="td2-hero">
        ${ringHtml}
        <div style="flex:1;min-width:0">
          <div class="td2-title">${sanitize(t.title)}</div>
          <div class="td2-badges">
            ${sTag(t.status)}
            ${t.sequential ? '<span class="tag tag-count">⚡ Flow</span>' : ''}
            ${pTag(t.priority)}
          </div>
        </div>
      </div>
      ${t.description ? `<div class="td2-desc">${sanitize(t.description)}</div>` : ''}
      ${t.attachments && t.attachments.length ? attachGalleryHtml(t.attachments) : ''}
      ${t.url ? `<div style="margin-top:10px"><a href="${sanitize(t.url)}" target="_blank" style="color:var(--accent);font-size:.78rem;word-break:break-all" onclick="event.stopPropagation()">🔗 ${sanitize(t.url)}</a></div>` : ''}
    </div>

    <!-- Linked Records -->
    <div class="td2-card">
      <h3 class="td2-h">เชื่อมโยงกับ</h3>
      <div class="td2-chips">
      ${(function() {
        var chips = [];
        if (t.dealerId) {
          var _dd = ST.getOne('dealers', t.dealerId);
          if (_dd) chips.push(`<span class="td2-chip" onclick="go('dealerDetail',{dealerId:'${t.dealerId}'})">🏪 ${sanitize(_dd.name)}</span>`);
        }
        if (t.pipeId) {
          var _dp = ST.getOne('pipeline', t.pipeId);
          if (_dp) chips.push(`<span class="td2-chip" onclick="go('pipeDetail',{pipeId:'${t.pipeId}'})">📊 ${sanitize(_dp.projectName || _dp.name || '-')}</span>`);
        }
        (t.links || []).forEach(function(l, i) {
          var lt = TASK_LINK_TYPES[l.type] || { icon: '🔗', name: l.type };
          if (l.pending) {
            chips.push(`<span class="td2-chip pending" onclick="openTaskLinkCreate('${l.type}','${t.id}')">⏳ ${lt.icon} ${sanitize(lt.name)} (รอสร้าง)<span class="rm" onclick="event.stopPropagation();removeTaskLink('${t.id}',${i})">✕</span></span>`);
          } else {
            chips.push(`<span class="td2-chip" onclick="openTaskLink('${l.type}','${l.id}')">${lt.icon} ${sanitize(l.label)}<span class="rm" onclick="event.stopPropagation();removeTaskLink('${t.id}',${i})">✕</span></span>`);
          }
        });
        return chips.length ? chips.join('') : '<div class="hint">ยังไม่มีลิงก์เชื่อมโยง — กด ✏️ แก้ไขงานเพื่อเพิ่ม</div>';
      })()}
      </div>
    </div>

    <!-- Date Section -->
    <div class="td2-card">
      <h3 class="td2-h">กำหนดการ</h3>
      <div class="td2-row">
        <div class="td2-row-label">📅 กำหนดเสร็จ</div>
        <div class="td2-row-value"><strong>${fD(t.dueDate) || 'ไม่ได้ตั้ง'}</strong> ${formatDueDateStatus(t.dueDate, t.status)}</div>
        <button class="btn bsm bo" onclick="showRescheduleModal('${t.id}')">📅 เลื่อนกำหนด</button>
      </div>
      <div class="td2-row">
        <div class="td2-row-label">📞 นัดติดตาม</div>
        <div class="td2-row-value">
          ${t.followupDate ? fD(t.followupDate) : 'ไม่ได้ตั้ง'}
          ${t.followupDate && dTo(t.followupDate) <= 0 ? '<span class="badge-red">⚠️ ต้องติดตามวันนี้!</span>' : ''}
        </div>
        <button class="btn bsm bo" onclick="setFollowupDate('${t.id}')">📞 ตั้ง/แก้ไข</button>
        ${t.followupDate ? `<button class="btn bsm bs" onclick="markFollowupDone('${t.id}')">✅ ติดตามแล้ว</button>` : ''}
        <button class="btn bsm bo" onclick="addFollowupToTimeline('${t.id}')">➕ เพิ่มนัด</button>
      </div>
      <div class="td2-row">
        <div class="td2-row-label">🚀 วันที่เริ่ม</div>
        <div class="td2-row-value">${fD(t.startDate) || 'ไม่ได้ตั้ง'}</div>
        <button class="btn bsm bo" onclick="setStartDate('${t.id}')">✏️ แก้ไข</button>
      </div>

      ${t.dueDateHistory && t.dueDateHistory.length ? `
      <div class="due-history">
        <div class="history-title">📝 ประวัติการเลื่อนกำหนด</div>
        ${t.dueDateHistory.map(function(h) {
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

    <!-- Steps Section -->
    <div class="td2-card">
      <h3 class="td2-h">ขั้นตอน · ${doneSteps}/${(t.steps || []).length} ${t.sequential ? '(⚡ ไล่ลำดับ)' : ''} <button class="btn bsm bp" onclick="showStepM('${t.id}')">➕</button></h3>
      ${(t.steps || []).length ? `<div class="td2-progress-track"><div class="td2-progress-fill" style="width:${pg}%"></div></div>` : ''}
      ${(t.steps || []).length ? t.steps.map(function(s, i) {
        var lk = isStepLocked(t, i);
        checkStepFuOverdue(s);
        return `<div class="td2-step ${s.done ? 'done' : ''}" draggable="true" ondragstart="stepDragStart(event,'${t.id}',${i})" ondragover="stepDragOver(event)" ondrop="stepDrop(event,'${t.id}',${i})">
          <div style="cursor:grab;color:var(--text3);padding:2px 2px 0 0;align-self:flex-start" title="ลากเพื่อจัดลำดับ">⠿</div>
          <div class="td2-step-check ${s.done ? 'done' : ''} ${lk ? 'locked' : ''}" onclick="${lk ? '' : `togStep('${t.id}',${i})`}">${s.done ? '✓' : ''}</div>
          <div style="flex:1;min-width:0">
            <div class="td2-step-title" onclick="${lk ? '' : `editStep('${t.id}',${i})`}">
              ${i + 1}. ${sanitize(s.title)} ${lk ? '🔒' : ''} ${fuBadge(s)}
            </div>
            <div class="td2-step-meta">${s.startDate ? fD(s.startDate) : ''} ${s.dueDate ? '→ ' + fD(s.dueDate) : ''} ${dlB(s.dueDate, s.done)}</div>
            ${renderStepDueDate(s)}
            ${s.notes ? `<div class="td2-step-meta">${sanitize(s.notes)}</div>` : ''}
            ${s.url ? `<div class="td2-step-meta"><a href="${sanitize(s.url)}" target="_blank" style="color:var(--accent);word-break:break-all" onclick="event.stopPropagation()">🔗 ${sanitize(s.url.length > 40 ? s.url.substr(0, 40) + '...' : s.url)}</a></div>` : ''}
            ${s.attachments && s.attachments.length ? `<div onclick="event.stopPropagation()">${attachGalleryHtml(s.attachments)}</div>` : ''}
            ${buildFuTimeline(t.id, i)}
          </div>
          <div class="td2-step-actions">
            <button class="btn bsm bp" onclick="event.stopPropagation();showStepFuM('${t.id}',${i})" title="ติดตาม">📞</button>
            ${countActiveFu(s) > 0 ? `<button class="btn bsm bw" onclick="event.stopPropagation();quickFuAgain('${t.id}',${i})" title="ติดตามอีกครั้ง">🔄</button>` : ''}
            <button class="btn bsm bs" onclick="event.stopPropagation();startTimer('step', '${s.id || i}', '${sanitize(s.title).substr(0, 18)}')" title="จับเวลา">⏱️</button>
            <button class="btn bsm bd" onclick="event.stopPropagation();delStep('${t.id}',${i})">✕</button>
          </div>
        </div>`;
      }).join('') : '<div class="empty"><p>ยังไม่มี Steps</p></div>'}
    </div>

    <!-- Timeline / Logs -->
    <div class="td2-card">
      <h3 class="td2-h">ไทม์ไลน์
        <span>
          <button class="btn bsm bp" onclick="showTaskLogM('${t.id}')">➕</button>
          <button class="btn bsm bo" onclick="addFollowupToTimeline('${t.id}')">📞 + นัด</button>
        </span>
      </h3>
      ${logs.length ? `<div class="td2-tl">${logs.map(function(l, i) {
        var isFollowupOverdue = l.type === 'followup_set' && l.dueDate && dTo(l.dueDate) < 0;
        var isLast = i === logs.length - 1;
        return `<div class="td2-tl-item">
          <div class="td2-tl-dotcol"><div class="td2-tl-dot ${isFollowupOverdue ? 'warn' : ''}"></div>${isLast ? '' : '<div class="td2-tl-line"></div>'}</div>
          <div class="td2-tl-body">
            <div class="td2-tl-date">
              <span>${fDT(l.date)}</span>
              <span style="display:flex;gap:4px">
                <button class="btn bsm bo" onclick="event.stopPropagation();editTimelineLog('${l.id}', '${sanitize(l.content).replace(/'/g, "\\'")}', '${l.type}', '${l.date}')" style="padding:1px 6px">✏️</button>
                <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('taskLogs','${l.id}');render()" style="padding:1px 4px">✕</button>
              </span>
            </div>
            <div class="td2-tl-type">${logL(l.type)}</div>
            <div class="td2-tl-content">${sanitize(l.content)}</div>
            ${l.dueDate ? `<div class="td2-tl-type" style="margin-top:2px">📅 กำหนด: ${fD(l.dueDate)} ${dlB(l.dueDate, false)}</div>` : ''}
          </div>
        </div>`;
      }).join('')}</div>` : '<div class="empty"><p>ยังไม่มี Log</p></div>'}
    </div>

    <!-- Quick Add Comment (Inline) -->
    <div class="td2-card">
      <div class="td2-comment-bar">
        <textarea id="quickComment" rows="2" placeholder="พิมพ์ comment ด่วน... (เช่น โทรติดตามแล้ว, ได้รับเอกสารแล้ว)"></textarea>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px">
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

// รวม 2 prompt() (ชื่อ Step + วันกำหนดเสร็จ) เป็น modal เดียว เห็นทั้ง 2 ช่องพร้อมกัน
function addQuickStep(taskId) {
  openM('📋 เพิ่ม Step', '' +
    '<div class="fg"><label>📋 ชื่อ Step *</label><input type="text" id="qst_title" class="fm-input"></div>' +
    dpH('qst_date', addD(_td(), 3), 'กำหนดเสร็จ') +
    '<button class="btn bp btn-full" onclick="saveQuickStep(\'' + taskId + '\')">💾 บันทึก</button>');
}

function saveQuickStep(taskId) {
  var title = document.getElementById('qst_title').value.trim();
  if (!title) return alert('ใส่ชื่อ Step');
  var dueDate = dpG('qst_date');

  ST.add('taskLogs', {
    tid: taskId,
    type: 'step',
    content: title,
    dueDate: dueDate,
    done: false,
    date: _nw()
  });

  closeMForce();
  toast('✅ เพิ่ม Step แล้ว');
  render();
}

// รวม 2 prompt() (รายละเอียด + วันนัดติดตาม) เป็น modal เดียว เห็นทั้ง 2 ช่องพร้อมกัน
function addQuickFollowup(taskId) {
  openM('📞 ตั้งนัดติดตาม', '' +
    '<div class="fg"><label>📞 รายละเอียดการติดตาม *</label><textarea id="qfu2_note" rows="3"></textarea></div>' +
    dpH('qfu2_date', addD(_td(), 3), 'นัดติดตามอีกครั้ง') +
    '<button class="btn bp btn-full" onclick="saveQuickFollowup(\'' + taskId + '\')">💾 บันทึก</button>');
}

function saveQuickFollowup(taskId) {
  var note = document.getElementById('qfu2_note').value.trim();
  if (!note) return alert('ใส่รายละเอียดการติดตาม');
  var dueDate = dpG('qfu2_date');

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

  closeMForce();
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
  ${(typeof _sourceTaskBackLinkHtml === 'function') ? _sourceTaskBackLinkHtml(m.sourceTaskId) : ''}

  <div class="card"><h2>📅 ข้อมูลประชุม <span class="ml">
    <button class="btn bsm bo" onclick="openMeetingWindow('${m.id}')" title="เปิดแท็บบันทึกการประชุม">🪟 เปิดแท็บบันทึก</button>
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
// MEETING WINDOW — แท็บแยก บันทึกการประชุมแบบเต็มรูปแบบ (v2)
// ================================================================

// --- Custom Templates (stored in localStorage) ---
function getMeetingTemplates() {
  var DEFAULT_TPL = [
    {name:'มติที่ประชุม', text:'ที่ประชุมมีมติ: '},
    {name:'รอเอกสาร', text:'รอเอกสารจาก: ... ภายใน '},
    {name:'รับทราบ', text:'ที่ประชุมรับทราบ'},
    {name:'เลื่อนพิจารณา', text:'เลื่อนพิจารณาในครั้งถัดไป'},
    {name:'ผู้รับผิดชอบ', text:'ผู้รับผิดชอบ: [ชื่อ] / กำหนดเสร็จ: '},
    {name:'นัดครั้งถัดไป', text:'นัดประชุมครั้งถัดไป: '},
    {name:'ระหว่างพิจารณา', text:'อยู่ระหว่างพิจารณา'},
    {name:'ติดตามผล', text:'ติดตามผลภายใน: '}
  ];
  try {
    var saved = JSON.parse(localStorage.getItem('v7_meetingTemplates') || 'null');
    return saved || DEFAULT_TPL;
  } catch(e) { return DEFAULT_TPL; }
}
function saveMeetingTemplates(list) {
  if (typeof ST !== 'undefined' && ST._set) ST._set('v7_meetingTemplates', list);
  else localStorage.setItem('v7_meetingTemplates', JSON.stringify(list));
}

// --- Meeting Type Quick-start Templates ---
var MEETING_TYPE_TEMPLATES = {
  'ประชุมลูกค้า': {
    agenda: ['แนะนำตัวและบริษัท', 'รับฟังความต้องการลูกค้า', 'นำเสนอ DJI Solution', 'ราคาและเงื่อนไข', 'สรุปและ Next Steps'],
    notesTemplate: 'ความต้องการลูกค้า:\n\nโซลูชันที่นำเสนอ:\n\nข้อสงสัย/คำถาม:\n\nข้อตกลงเบื้องต้น:\n'
  },
  'Team Sales': {
    agenda: ['รายงานยอดขายสัปดาห์ที่ผ่านมา', 'Pipeline Review', 'ปัญหาและอุปสรรค', 'แชร์ Best Practice', 'แผนและเป้าสัปดาห์หน้า'],
    notesTemplate: 'ยอดขายสัปดาห์นี้:\n\nPipeline ที่น่าจับตา:\n\nปัญหา:\n\nแผนถัดไป:\n'
  },
  'อบรม/Training': {
    agenda: ['วัตถุประสงค์การอบรม', 'เนื้อหาส่วนที่ 1', 'เนื้อหาส่วนที่ 2', 'Workshop/ทดลองปฏิบัติ', 'Q&A', 'สรุปและ Action Items'],
    notesTemplate: 'ประเด็นสำคัญที่เรียนรู้:\n\nคำถามที่ถาม:\n\nสิ่งที่ต้องนำไปปฏิบัติ:\n'
  },
  'Demo Product': {
    agenda: ['เตรียมอุปกรณ์ก่อน Demo', 'แนะนำ Feature หลัก', 'Demo สด / ทดลองใช้', 'ตอบข้อสงสัย', 'สรุปข้อดีและ ROI'],
    notesTemplate: 'Feedback จากลูกค้า:\n\nคำถาม/ข้อสงสัย:\n\nความประทับใจ:\n\nNext Steps:\n'
  }
};

// --- Timer state ---
var _mwTimerSec = 0;
var _mwTimerRunning = false;
var _mwTimerInterval = null;
var _mwAutoSaveInterval = null;
var _mwAgendaTimers = {};

function _mwFormatSec(sec) {
  var m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function rMeetingWindow(el) {
  var mid = window._mwId || '';
  var m = mid ? ST.getOne('meetings', mid) : null;
  if (!m) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text2)">ไม่พบข้อมูลประชุม — ปิดแท็บนี้ได้เลย</div>'; return; }
  document.title = '📅 ' + m.title;
  document.getElementById('pgT').textContent = '📅 ' + m.title;

  // Init agenda items
  if (!m.agendaItems || !m.agendaItems.length) {
    m.agendaItems = (m.agenda || '').split('\n').map(function(t) { return {text: t.trim(), done: false, timerSec: 0}; }).filter(function(x) { return x.text; });
  }
  window._mwAgenda = m.agendaItems.map(function(a) { return {text: a.text, done: !!a.done, timerSec: a.timerSec || 0}; });

  // Init attendance
  if (!m.attendanceList && m.attendees) {
    var names = m.attendees.split(/[,\/\n]/).map(function(n) { return n.trim(); }).filter(Boolean);
    m.attendanceList = names.map(function(n) { return {name: n, attended: true}; });
  }
  window._mwAttendance = (m.attendanceList || []).map(function(a) { return {name: a.name, attended: !!a.attended}; });
  _mwAgendaTimers = {};

  // Find pending actions from most recent previous meeting
  var allMtgs = ST.getAll('meetings').filter(function(x) { return x.id !== mid && x.date <= m.date && (x.actions||[]).some(function(a) { return !a.done; }); });
  allMtgs.sort(function(a, b) { return b.date.localeCompare(a.date); });
  window._mwPrevMeeting = allMtgs[0] || null;
  var pendingFromPrev = window._mwPrevMeeting ? (window._mwPrevMeeting.actions||[]).filter(function(a) { return !a.done; }) : [];

  var h = '<div class="vw-layout" style="gap:16px">';

  // ===== LEFT PANEL =====
  h += '<div class="vw-left">';

  // Header
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px 16px;margin-bottom:14px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px"><div>';
  h += '<div style="font-size:16px;font-weight:700">' + sanitize(m.title) + '</div>';
  h += '<div style="font-size:12px;color:var(--text2);margin-top:3px">';
  var hbits = ['📅 ' + fD(m.date)];
  if (m.time) hbits.push('⏰ ' + m.time + (m.endTime ? ' – ' + m.endTime : ''));
  if (m.location) hbits.push('📍 ' + sanitize(m.location));
  if (m.type) hbits.push('<span style="background:#3b82f622;color:#60a5fa;padding:2px 7px;border-radius:4px;font-size:10px">' + sanitize(m.type) + '</span>');
  if (m.recurrence) hbits.push('<span style="background:#8b5cf622;color:#a78bfa;padding:2px 7px;border-radius:4px;font-size:10px">🔁 ' + sanitize(m.recurrence) + '</span>');
  h += hbits.join(' · ') + '</div>';
  if (m.linkedDealerId) { var ld = ST.getOne('dealers', m.linkedDealerId); if (ld) h += '<div style="font-size:11px;color:#4ade80;margin-top:2px">🏪 ' + sanitize(ld.name || ld.shopName || '') + '</div>'; }
  if (m.linkedPipelineId) { var lp = ST.getOne('pipeline', m.linkedPipelineId); if (lp) h += '<div style="font-size:11px;color:#fbbf24;margin-top:2px">📊 ' + sanitize(lp.projectName || lp.title || '') + '</div>'; }
  h += '</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  h += '<button class="btn bsm bp" onclick="mwSave()">💾 บันทึก</button>';
  h += '<button class="btn bsm bo" onclick="mwCopySummary()">📋 Copy สรุป</button>';
  h += '<button class="btn bsm bo" onclick="mwCopyLine()">💬 LINE</button>';
  h += '<button class="btn bsm bo" onclick="window.print()" title="Print/Export PDF">🖨️</button>';
  h += '<button class="btn bsm bo" onclick="mwScheduleNext()" title="นัดครั้งถัดไป">📅+</button>';
  h += '</div></div></div>';

  // Attendance
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px 16px;margin-bottom:14px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  h += '<div style="font-weight:600;font-size:13px">👥 ผู้เข้าร่วมประชุม</div>';
  h += '<button class="btn bsm bo" onclick="mwAddAttendee()">+ เพิ่ม</button></div>';
  if (window._mwAttendance.length === 0) {
    h += '<div style="font-size:12px;color:var(--text2)">ยังไม่มีรายชื่อ — กด "+ เพิ่ม" หรือเพิ่มจากแผงขวา</div>';
  } else {
    h += '<div id="mw-attend-list" style="display:flex;flex-wrap:wrap;gap:8px">';
    window._mwAttendance.forEach(function(a, i) { h += _mwAttendChipHtml(a, i); });
    h += '</div>';
  }
  h += '<div style="font-size:10px;color:var(--text2);margin-top:5px">กดชื่อ → สลับ ✓ มาร่วม / ✕ ขาด</div></div>';

  // Agenda
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px 16px;margin-bottom:14px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h += '<div style="font-weight:600;font-size:13px">📋 วาระการประชุม</div>';
  h += '<button class="btn bsm bo" onclick="mwAgendaAdd()">+ เพิ่มวาระ</button></div>';
  h += '<div id="mw-agenda-list">';
  if (window._mwAgenda.length === 0) h += '<div style="font-size:12px;color:var(--text2)">ยังไม่มีวาระ — กด "+ เพิ่มวาระ" หรือโหลด Quick-start ด้านขวา</div>';
  else window._mwAgenda.forEach(function(a, i) { h += _mwAgendaRowHtml(a, i); });
  h += '</div></div>';

  // Notes
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px 16px;margin-bottom:14px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  h += '<div style="font-weight:600;font-size:13px">📝 บันทึกการประชุม</div>';
  h += '<button class="btn bsm bo" onclick="mwInsertTimestamp()">⏱️ แทรกเวลา</button></div>';
  h += '<textarea id="mw-notes" style="width:100%;min-height:220px;resize:vertical;font-size:13px;line-height:1.7;font-family:inherit;background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:8px;padding:10px;color:var(--text)" placeholder="พิมพ์โน้ตระหว่างประชุมได้เลย&#10;&#10;กด ⏱️ แทรกเวลา เพื่อใส่ [HH:MM] timestamp">' + sanitize(m.notes || '') + '</textarea></div>';

  // Parking Lot
  h += '<div style="background:var(--card,#1e293b);border:1px dashed #475569;border-radius:10px;padding:14px 16px;margin-bottom:14px">';
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">';
  h += '<div style="font-weight:600;font-size:13px">🅿️ Parking Lot</div>';
  h += '<div style="font-size:11px;color:var(--text2)">— หัวข้อนอกวาระที่ต้องติดตาม</div></div>';
  h += '<textarea id="mw-parking" style="width:100%;min-height:70px;resize:vertical;font-size:13px;line-height:1.7;font-family:inherit;background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:8px;padding:10px;color:var(--text)" placeholder="หัวข้อที่พูดถึงแต่ไม่อยู่ในวาระ...&#10;จะนำไปต่อในประชุมครั้งหน้า">' + sanitize(m.parkingLot || '') + '</textarea></div>';

  // Decisions
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px 16px;margin-bottom:14px">';
  h += '<div style="font-weight:600;font-size:13px;margin-bottom:8px">✅ มติที่ประชุม</div>';
  h += '<textarea id="mw-decisions" style="width:100%;min-height:80px;resize:vertical;font-size:13px;line-height:1.7;font-family:inherit;background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:8px;padding:10px;color:var(--text)" placeholder="บันทึกมติหรือข้อสรุปที่ตกลงกันในที่ประชุม...">' + sanitize(m.decisions || '') + '</textarea></div>';

  // Action Items
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px 16px;margin-bottom:14px">';
  h += '<div style="font-weight:600;font-size:13px;margin-bottom:10px">📌 Action Items <span style="font-size:11px;color:var(--text2);font-weight:400" id="mw-action-count">(' + (m.actions||[]).length + ')</span></div>';
  if (pendingFromPrev.length) {
    h += '<div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:10px;margin-bottom:10px">';
    h += '<div style="font-size:11px;font-weight:600;color:#fbbf24;margin-bottom:5px">⚠️ ค้างจากประชุมก่อน: ' + sanitize(window._mwPrevMeeting.title) + ' (' + fD(window._mwPrevMeeting.date) + ')</div>';
    pendingFromPrev.forEach(function(a) { h += '<div style="font-size:12px;color:var(--text2);padding:1px 0">• ' + sanitize(a.title) + (a.assignee ? ' — ' + sanitize(a.assignee) : '') + '</div>'; });
    h += '<button class="btn bsm bo" style="margin-top:6px;font-size:11px" onclick="mwImportPendingActions()">⬇️ นำเข้าทั้งหมด</button></div>';
  }
  h += '<div id="mw-action-list">';
  (m.actions||[]).forEach(function(a, i) { h += _mwActionRowHtml(a, i); });
  h += '</div>';
  h += '<div style="background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:8px;padding:10px;margin-top:8px">';
  h += '<div style="font-size:11px;color:var(--text2);margin-bottom:6px">➕ Quick Add (Enter เพื่อเพิ่ม)</div>';
  h += '<input id="mw-qa-text" placeholder="ต้องทำ..." style="width:100%;font-size:13px;margin-bottom:6px;background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:6px;padding:6px 10px;color:var(--text)" onkeydown="if(event.key===\'Enter\')mwAddAction()">';
  h += '<div style="display:flex;gap:6px">';
  h += '<input id="mw-qa-who" placeholder="👤 ผู้รับผิดชอบ" style="flex:1;font-size:12px;background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:6px;padding:5px 10px;color:var(--text)">';
  h += '<input id="mw-qa-due" type="date" style="font-size:12px;background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:6px;padding:5px 10px;color:var(--text)">';
  h += '<button class="btn bsm bp" onclick="mwAddAction()">➕</button>';
  h += '</div></div></div>';

  h += '<div style="text-align:center;padding:4px 0 16px"><button class="btn bp" onclick="mwSave()" style="min-width:200px">💾 บันทึกทั้งหมด</button>';
  h += '<div id="mw-save-status" style="font-size:11px;color:var(--text2);margin-top:6px"></div></div>';
  h += '</div>'; // vw-left

  // ===== RIGHT PANEL =====
  h += '<div class="vw-right" style="gap:12px;overflow-y:auto">';

  // Overall Timer
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px 16px">';
  h += '<div style="font-size:11px;color:var(--text2);margin-bottom:6px;font-weight:600">⏱️ เวลาประชุมรวม</div>';
  h += '<div id="mw-timer-display" style="font-size:36px;font-weight:700;text-align:center;letter-spacing:2px;margin-bottom:8px;font-family:monospace">00:00</div>';
  h += '<div style="display:flex;gap:6px;justify-content:center">';
  h += '<button class="btn bsm bp" id="mw-timer-btn" onclick="mwTimerToggle()">▶️ เริ่ม</button>';
  h += '<button class="btn bsm bo" onclick="mwTimerReset()">↺ รีเซ็ต</button>';
  h += '</div></div>';

  // Custom Templates
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px 16px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  h += '<div style="font-size:11px;color:var(--text2);font-weight:600">📝 Template ด่วน</div>';
  h += '<button class="btn bsm bo" onclick="mwManageTemplates()" style="font-size:10px;padding:2px 8px">✏️ จัดการ</button></div>';
  h += '<div id="mw-template-list" style="display:flex;flex-wrap:wrap;gap:6px">';
  getMeetingTemplates().forEach(function(t) {
    var txt = t.text;
    h += '<div onclick="mwInsertTemplate(\'' + txt.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n') + '\')" style="background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:20px;padding:4px 10px;font-size:11px;cursor:pointer;color:var(--text2)" onmouseover="this.style.borderColor=\'#60a5fa\';this.style.color=\'#60a5fa\'" onmouseout="this.style.borderColor=\'\';this.style.color=\'\'">' + sanitize(t.name) + '</div>';
  });
  h += '</div></div>';

  // Meeting type quick-start
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px 16px">';
  h += '<div style="font-size:11px;color:var(--text2);font-weight:600;margin-bottom:8px">🚀 Quick-start ตามประเภท</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
  Object.keys(MEETING_TYPE_TEMPLATES).forEach(function(type) {
    h += '<div onclick="mwApplyTypeTemplate(\'' + type.replace(/'/g,"\\'") + '\')" style="background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:20px;padding:4px 10px;font-size:11px;cursor:pointer;color:var(--text2)" onmouseover="this.style.borderColor=\'#a78bfa\';this.style.color=\'#a78bfa\'" onmouseout="this.style.borderColor=\'\';this.style.color=\'\'">' + sanitize(type) + '</div>';
  });
  h += '</div></div>';

  // Link Dealer/Pipeline
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px 16px">';
  h += '<div style="font-size:11px;color:var(--text2);font-weight:600;margin-bottom:8px">🔗 เชื่อมกับ Dealer / Pipeline</div>';
  var dOpts = '<option value="">— ไม่เชื่อม —</option>';
  try { ST.getAll('dealers').forEach(function(d) { dOpts += '<option value="' + d.id + '"' + (m.linkedDealerId === d.id ? ' selected' : '') + '>' + sanitize(d.name || d.shopName || d.id) + '</option>'; }); } catch(e) {}
  h += '<div style="margin-bottom:6px"><label style="font-size:11px;color:var(--text2)">🏪 Dealer</label><select id="mw-link-dealer" onchange="mwLinkDealer(this.value)" style="width:100%;font-size:12px;background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:6px;padding:5px 8px;color:var(--text);margin-top:3px">' + dOpts + '</select></div>';
  var pOpts = '<option value="">— ไม่เชื่อม —</option>';
  try { ST.getAll('pipeline').forEach(function(p) { pOpts += '<option value="' + p.id + '"' + (m.linkedPipelineId === p.id ? ' selected' : '') + '>' + sanitize(p.projectName || p.title || p.id) + '</option>'; }); } catch(e) {}
  h += '<div><label style="font-size:11px;color:var(--text2)">📊 Pipeline Deal</label><select id="mw-link-pipe" onchange="mwLinkPipeline(this.value)" style="width:100%;font-size:12px;background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:6px;padding:5px 8px;color:var(--text);margin-top:3px">' + pOpts + '</select></div>';
  h += '</div>';

  // Auto-save status
  h += '<div id="mw-autosave-info" style="font-size:11px;color:var(--text2);text-align:center;padding:4px"></div>';
  h += '</div>'; // vw-right
  h += '</div>'; // vw-layout

  el.innerHTML = h;

  if (_mwAutoSaveInterval) clearInterval(_mwAutoSaveInterval);
  _mwAutoSaveInterval = setInterval(function() { mwAutoSave(); }, 45000);
}

// --- Row renderers ---
function _mwAttendChipHtml(a, i) {
  var color = a.attended ? '#4ade80' : '#f87171';
  var icon = a.attended ? '✓' : '✕';
  return '<div onclick="mwToggleAttend(' + i + ')" id="mw-att-' + i + '" style="background:' + color + '22;border:1px solid ' + color + '55;border-radius:20px;padding:4px 10px;font-size:12px;cursor:pointer;color:' + color + ';display:flex;align-items:center;gap:4px">' + icon + ' ' + sanitize(a.name) + '</div>';
}

function _mwAgendaRowHtml(a, i) {
  var timerSec = (window._mwAgendaTimers && window._mwAgendaTimers[i]) ? window._mwAgendaTimers[i].sec : (a.timerSec || 0);
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px" id="mw-ag-' + i + '">' +
    '<div onclick="mwAgendaToggle(' + i + ')" style="width:18px;height:18px;border-radius:50%;border:2px solid ' + (a.done ? '#4ade80' : 'var(--border,#334155)') + ';background:' + (a.done ? '#4ade80' : 'transparent') + ';cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#111">' + (a.done ? '✓' : '') + '</div>' +
    '<div style="flex:1;font-size:13px;' + (a.done ? 'text-decoration:line-through;color:var(--text2)' : '') + '">' + sanitize(a.text) + '</div>' +
    '<div id="mw-ag-timer-' + i + '" style="font-size:10px;color:var(--text2);font-family:monospace;min-width:34px">' + _mwFormatSec(timerSec) + '</div>' +
    '<button onclick="mwAgendaTimerToggle(' + i + ')" id="mw-ag-tbtn-' + i + '" style="background:transparent;border:1px solid var(--border,#334155);border-radius:4px;color:var(--text2);cursor:pointer;font-size:10px;padding:1px 5px" title="จับเวลาวาระนี้">▶</button>' +
    '<button onclick="mwAgendaAddToNotes(' + i + ')" style="background:transparent;border:none;color:var(--text2);cursor:pointer;font-size:11px;padding:2px 4px" title="เพิ่มวาระนี้เข้าโน้ต">→</button>' +
    '</div>';
}

function _mwActionRowHtml(a, i) {
  return '<div id="mw-act-' + i + '" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border,#334155)">' +
    '<div onclick="mwToggleAction(' + i + ')" style="width:18px;height:18px;border-radius:4px;border:2px solid ' + (a.done ? '#4ade80' : 'var(--border,#334155)') + ';background:' + (a.done ? '#4ade80' : 'transparent') + ';cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#111">' + (a.done ? '✓' : '') + '</div>' +
    '<div style="flex:1;min-width:0"><div style="font-size:12px;' + (a.done ? 'text-decoration:line-through;color:var(--text2)' : '') + '">' + sanitize(a.title) + '</div>' +
    (a.assignee || a.dueDate ? '<div style="font-size:11px;color:var(--text2)">' + (a.assignee ? '👤 ' + sanitize(a.assignee) : '') + (a.dueDate ? ' 📅 ' + fD(a.dueDate) : '') + '</div>' : '') + '</div>' +
    '<button onclick="mwDeleteAction(' + i + ')" style="background:transparent;border:none;color:#f87171;cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0">✕</button></div>';
}

// --- Data helper ---
function _mwGetData() { return window._mwId ? ST.getOne('meetings', window._mwId) : null; }

// --- Save ---
function mwSave() {
  var mid = window._mwId;
  var m = _mwGetData();
  if (!m) return;
  Object.keys(_mwAgendaTimers).forEach(function(k) { if (window._mwAgenda[k]) window._mwAgenda[k].timerSec = _mwAgendaTimers[k].sec; });
  ST.update('meetings', mid, {
    notes: ((document.getElementById('mw-notes') || {}).value || '').trim(),
    decisions: ((document.getElementById('mw-decisions') || {}).value || '').trim(),
    parkingLot: ((document.getElementById('mw-parking') || {}).value || '').trim(),
    agendaItems: window._mwAgenda,
    attendanceList: window._mwAttendance,
    actions: m.actions || []
  });
  var now = new Date().toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'});
  var st = document.getElementById('mw-save-status'); if (st) st.textContent = '💾 บันทึกแล้ว ' + now;
  var info = document.getElementById('mw-autosave-info'); if (info) info.textContent = '💾 ' + now;
  toast('💾 บันทึกแล้ว');
}

function mwAutoSave() {
  var mid = window._mwId;
  var m = _mwGetData();
  if (!m || !document.getElementById('mw-notes')) return;
  Object.keys(_mwAgendaTimers).forEach(function(k) { if (window._mwAgenda[k]) window._mwAgenda[k].timerSec = _mwAgendaTimers[k].sec; });
  ST.update('meetings', mid, {
    notes: ((document.getElementById('mw-notes') || {}).value || '').trim(),
    decisions: ((document.getElementById('mw-decisions') || {}).value || '').trim(),
    parkingLot: ((document.getElementById('mw-parking') || {}).value || '').trim(),
    agendaItems: window._mwAgenda,
    attendanceList: window._mwAttendance
  });
  var info = document.getElementById('mw-autosave-info');
  if (info) info.textContent = '💾 auto-save ' + new Date().toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'});
}

// --- Timestamp & Template ---
function mwInsertTimestamp() {
  var t = document.getElementById('mw-notes'); if (!t) return;
  var stamp = '[' + new Date().toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'}) + '] ';
  var pos = t.selectionStart, val = t.value;
  var prefix = (pos > 0 && val[pos-1] !== '\n') ? '\n' : '';
  t.value = val.slice(0, pos) + prefix + stamp + val.slice(pos);
  t.selectionStart = t.selectionEnd = pos + prefix.length + stamp.length;
  t.focus();
}

function mwInsertTemplate(text) {
  var t = document.getElementById('mw-notes'); if (!t) return;
  var pos = t.selectionStart, val = t.value;
  var prefix = (pos > 0 && val[pos-1] !== '\n') ? '\n' : '';
  t.value = val.slice(0, pos) + prefix + text + val.slice(pos);
  t.selectionStart = t.selectionEnd = pos + prefix.length + text.length;
  t.focus();
}

// --- Custom Template Management ---
function mwManageTemplates() {
  var list = getMeetingTemplates();
  var h = '<div style="max-width:420px"><div id="mw-tpl-list">';
  list.forEach(function(t, i) {
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:8px;background:var(--bg,#0f172a);border-radius:6px">';
    h += '<div style="flex:1"><div style="font-size:12px;font-weight:600">' + sanitize(t.name) + '</div>';
    h += '<div style="font-size:11px;color:var(--text2)">' + sanitize(t.text.slice(0, 50)) + (t.text.length > 50 ? '...' : '') + '</div></div>';
    h += '<button class="btn bsm bd" onclick="mwDeleteTemplate(' + i + ')">✕</button></div>';
  });
  if (!list.length) h += '<div style="font-size:12px;color:var(--text2)">ยังไม่มี template</div>';
  h += '</div>';
  h += '<div style="margin-top:12px;background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:8px;padding:12px">';
  h += '<div style="font-size:11px;color:var(--text2);margin-bottom:6px">➕ เพิ่ม Template ใหม่</div>';
  h += '<input id="mw-tpl-name" placeholder="ชื่อ เช่น รอการอนุมัติ" class="fm-input" style="margin-bottom:6px">';
  h += '<textarea id="mw-tpl-text" rows="2" placeholder="ข้อความ..." class="fm-input" style="resize:none"></textarea>';
  h += '<button class="btn bsm bp btn-full" style="margin-top:6px" onclick="mwSaveNewTemplate()">💾 บันทึก Template</button>';
  h += '</div></div>';
  openM('📝 จัดการ Template', h);
}

function mwDeleteTemplate(i) {
  var list = getMeetingTemplates(); list.splice(i, 1); saveMeetingTemplates(list); mwManageTemplates();
}

function mwSaveNewTemplate() {
  var name = ((document.getElementById('mw-tpl-name') || {}).value || '').trim();
  var text = ((document.getElementById('mw-tpl-text') || {}).value || '').trim();
  if (!name || !text) { toast('ใส่ชื่อและข้อความด้วย'); return; }
  var list = getMeetingTemplates(); list.push({name: name, text: text}); saveMeetingTemplates(list);
  var tl = document.getElementById('mw-template-list');
  if (tl) {
    var div = document.createElement('div');
    div.textContent = name; div.style.cssText = 'background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:20px;padding:4px 10px;font-size:11px;cursor:pointer;color:var(--text2)';
    var t2 = text; div.onclick = function() { mwInsertTemplate(t2); }; tl.appendChild(div);
  }
  closeMForce(); toast('💾 บันทึก Template แล้ว');
}

// --- Quick-start Type Template ---
function mwApplyTypeTemplate(type) {
  var tpl = MEETING_TYPE_TEMPLATES[type]; if (!tpl) return;
  if (!confirm('โหลด template "' + type + '"?\nวาระและโน้ตปัจจุบัน (ถ้าว่าง) จะถูกแทนที่')) return;
  window._mwAgenda = tpl.agenda.map(function(t) { return {text: t, done: false, timerSec: 0}; });
  var al = document.getElementById('mw-agenda-list');
  if (al) al.innerHTML = window._mwAgenda.map(function(a, i) { return _mwAgendaRowHtml(a, i); }).join('');
  var notes = document.getElementById('mw-notes');
  if (notes && !notes.value.trim()) notes.value = tpl.notesTemplate;
  toast('🚀 โหลด template "' + type + '" แล้ว');
}

// --- Agenda ---
function mwAgendaToggle(i) {
  if (!window._mwAgenda || !window._mwAgenda[i]) return;
  window._mwAgenda[i].done = !window._mwAgenda[i].done;
  var row = document.getElementById('mw-ag-' + i); if (!row) return;
  var a = window._mwAgenda[i];
  var dot = row.querySelector('div'); if (dot) { dot.style.borderColor = a.done ? '#4ade80' : 'var(--border,#334155)'; dot.style.background = a.done ? '#4ade80' : 'transparent'; dot.textContent = a.done ? '✓' : ''; }
  var lbl = row.querySelectorAll('div')[1]; if (lbl) { lbl.style.textDecoration = a.done ? 'line-through' : ''; lbl.style.color = a.done ? 'var(--text2)' : ''; }
}

function mwAgendaAddToNotes(i) {
  if (!window._mwAgenda || !window._mwAgenda[i]) return;
  mwInsertTemplate('[วาระ ' + (i+1) + '] ' + window._mwAgenda[i].text + '\n');
}

function mwAgendaAdd() {
  var text = prompt('หัวข้อวาระ:'); if (!text || !text.trim()) return;
  window._mwAgenda = window._mwAgenda || [];
  window._mwAgenda.push({text: text.trim(), done: false, timerSec: 0});
  var i = window._mwAgenda.length - 1;
  var list = document.getElementById('mw-agenda-list'); if (!list) return;
  var emptyMsg = list.querySelector('div[style*="ยังไม่มีวาระ"]'); if (emptyMsg) list.innerHTML = '';
  var div = document.createElement('div'); div.innerHTML = _mwAgendaRowHtml({text: text.trim(), done: false, timerSec: 0}, i); list.appendChild(div.firstChild);
}

// --- Per-agenda timer ---
function mwAgendaTimerToggle(i) {
  if (!_mwAgendaTimers[i]) _mwAgendaTimers[i] = {sec: (window._mwAgenda[i] ? window._mwAgenda[i].timerSec || 0 : 0), running: false, interval: null};
  var t = _mwAgendaTimers[i];
  if (t.running) {
    clearInterval(t.interval); t.running = false;
    if (window._mwAgenda[i]) window._mwAgenda[i].timerSec = t.sec;
    var btn = document.getElementById('mw-ag-tbtn-' + i); if (btn) btn.textContent = '▶';
  } else {
    // stop any other running agenda timer
    Object.keys(_mwAgendaTimers).forEach(function(k) { if (parseInt(k) !== i && _mwAgendaTimers[k].running) mwAgendaTimerToggle(parseInt(k)); });
    t.running = true;
    var btn2 = document.getElementById('mw-ag-tbtn-' + i); if (btn2) btn2.textContent = '⏸';
    t.interval = setInterval(function() {
      t.sec++;
      if (window._mwAgenda[i]) window._mwAgenda[i].timerSec = t.sec;
      var d = document.getElementById('mw-ag-timer-' + i); if (d) d.textContent = _mwFormatSec(t.sec);
    }, 1000);
  }
}

// --- Overall Timer ---
function mwTimerToggle() {
  if (_mwTimerRunning) {
    clearInterval(_mwTimerInterval); _mwTimerRunning = false;
    var btn = document.getElementById('mw-timer-btn'); if (btn) btn.textContent = '▶️ ต่อ';
  } else {
    _mwTimerRunning = true;
    var btn2 = document.getElementById('mw-timer-btn'); if (btn2) btn2.textContent = '⏸️ หยุด';
    _mwTimerInterval = setInterval(function() {
      _mwTimerSec++;
      var d = document.getElementById('mw-timer-display'); if (!d) { clearInterval(_mwTimerInterval); return; }
      d.textContent = _mwFormatSec(_mwTimerSec);
    }, 1000);
  }
}

function mwTimerReset() {
  clearInterval(_mwTimerInterval); _mwTimerRunning = false; _mwTimerSec = 0;
  var d = document.getElementById('mw-timer-display'); if (d) d.textContent = '00:00';
  var btn = document.getElementById('mw-timer-btn'); if (btn) btn.textContent = '▶️ เริ่ม';
}

// --- Attendance ---
function mwToggleAttend(i) {
  if (!window._mwAttendance || !window._mwAttendance[i]) return;
  window._mwAttendance[i].attended = !window._mwAttendance[i].attended;
  var old = document.getElementById('mw-att-' + i); if (!old) return;
  var tmp = document.createElement('div'); tmp.innerHTML = _mwAttendChipHtml(window._mwAttendance[i], i); old.replaceWith(tmp.firstChild);
}

function mwAddAttendee() {
  var name = prompt('ชื่อผู้เข้าร่วม:'); if (!name || !name.trim()) return;
  window._mwAttendance = window._mwAttendance || [];
  window._mwAttendance.push({name: name.trim(), attended: true});
  var i = window._mwAttendance.length - 1;
  var list = document.getElementById('mw-attend-list');
  if (!list) { render(); return; }
  var tmp = document.createElement('div'); tmp.innerHTML = _mwAttendChipHtml({name: name.trim(), attended: true}, i); list.appendChild(tmp.firstChild);
}

// --- Action Items ---
function mwAddAction() {
  var mid = window._mwId; var m = _mwGetData(); if (!m) return;
  var txt = ((document.getElementById('mw-qa-text') || {}).value || '').trim(); if (!txt) { toast('ใส่ชื่อ Action ด้วย'); return; }
  var a = {id: 'act_' + Date.now(), title: txt, assignee: ((document.getElementById('mw-qa-who') || {}).value || '').trim(), dueDate: ((document.getElementById('mw-qa-due') || {}).value || ''), done: false};
  m.actions = m.actions || []; m.actions.push(a); ST.update('meetings', mid, {actions: m.actions});
  var list = document.getElementById('mw-action-list'); if (list) { var tmp = document.createElement('div'); tmp.innerHTML = _mwActionRowHtml(a, m.actions.length - 1); list.appendChild(tmp.firstChild); }
  var cnt = document.getElementById('mw-action-count'); if (cnt) cnt.textContent = '(' + m.actions.length + ')';
  document.getElementById('mw-qa-text').value = ''; document.getElementById('mw-qa-who').value = ''; document.getElementById('mw-qa-due').value = '';
  document.getElementById('mw-qa-text').focus();
}

function mwToggleAction(i) {
  var mid = window._mwId; var m = _mwGetData(); if (!m || !m.actions || !m.actions[i]) return;
  m.actions[i].done = !m.actions[i].done; ST.update('meetings', mid, {actions: m.actions});
  var old = document.getElementById('mw-act-' + i); if (!old) return;
  var tmp = document.createElement('div'); tmp.innerHTML = _mwActionRowHtml(m.actions[i], i); old.replaceWith(tmp.firstChild);
}

function mwDeleteAction(i) {
  var mid = window._mwId; var m = _mwGetData(); if (!m || !m.actions) return;
  if (!confirm('ลบ Action นี้?')) return;
  m.actions.splice(i, 1); ST.update('meetings', mid, {actions: m.actions});
  var list = document.getElementById('mw-action-list'); if (list) list.innerHTML = m.actions.map(function(a, idx) { return _mwActionRowHtml(a, idx); }).join('');
  var cnt = document.getElementById('mw-action-count'); if (cnt) cnt.textContent = '(' + m.actions.length + ')';
}

function mwImportPendingActions() {
  var mid = window._mwId; var m = _mwGetData(); if (!m || !window._mwPrevMeeting) return;
  var pending = (window._mwPrevMeeting.actions || []).filter(function(a) { return !a.done; });
  if (!pending.length) return;
  m.actions = m.actions || [];
  pending.forEach(function(a) {
    m.actions.push({id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2), title: a.title + ' [ค้างจาก: ' + window._mwPrevMeeting.title + ']', assignee: a.assignee || '', dueDate: a.dueDate || '', done: false});
  });
  ST.update('meetings', mid, {actions: m.actions});
  var list = document.getElementById('mw-action-list'); if (list) list.innerHTML = m.actions.map(function(a, i) { return _mwActionRowHtml(a, i); }).join('');
  var cnt = document.getElementById('mw-action-count'); if (cnt) cnt.textContent = '(' + m.actions.length + ')';
  toast('⬇️ นำเข้า ' + pending.length + ' actions แล้ว');
}

// --- Link Dealer/Pipeline ---
function mwLinkDealer(dealerId) {
  ST.update('meetings', window._mwId, {linkedDealerId: dealerId || null});
  toast(dealerId ? '🏪 เชื่อม Dealer แล้ว' : 'ยกเลิกการเชื่อม Dealer');
}
function mwLinkPipeline(pipeId) {
  ST.update('meetings', window._mwId, {linkedPipelineId: pipeId || null});
  toast(pipeId ? '📊 เชื่อม Pipeline แล้ว' : 'ยกเลิกการเชื่อม Pipeline');
}

// --- Schedule Next Meeting ---
function mwScheduleNext() {
  var m = _mwGetData(); if (!m) return;
  var nextDate = new Date(m.date);
  if (m.recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
  else if (m.recurrence === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
  else if (m.recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
  else nextDate.setDate(nextDate.getDate() + 7);
  var parking = ((document.getElementById('mw-parking') || {}).value || '').trim();
  showMeetingM();
  setTimeout(function() {
    var f = function(id) { return document.getElementById(id); };
    if (f('fm_t')) f('fm_t').value = m.title;
    if (f('fm_tp')) f('fm_tp').value = m.type || '';
    if (f('fm_loc')) f('fm_loc').value = m.location || '';
    if (f('fm_att')) f('fm_att').value = m.attendees || '';
    if (f('fm_s') && m.time) f('fm_s').value = m.time;
    if (f('fm_e') && m.endTime) f('fm_e').value = m.endTime;
    if (f('fm_ag') && parking) f('fm_ag').value = parking;
  }, 120);
  toast('📅 เปิดฟอร์มสำหรับประชุมครั้งถัดไป — กรอกวันที่และบันทึก');
}

// --- Copy Functions ---
function mwCopyLine() {
  var m = _mwGetData(); if (!m) return;
  var decisions = ((document.getElementById('mw-decisions') || {}).value || m.decisions || '').trim();
  var lines = ['📋 สรุปประชุม: ' + (m.title || ''), '📅 ' + fD(m.date) + (m.time ? ' เวลา ' + m.time : ''), ''];
  if (decisions) { lines.push('✅ มติ:'); lines.push(decisions); lines.push(''); }
  var acts = (m.actions || []).filter(function(a) { return !a.done; });
  if (acts.length) {
    lines.push('📌 Action Items:');
    acts.forEach(function(a) { var r = '• ' + a.title; if (a.assignee) r += ' (' + a.assignee + ')'; if (a.dueDate) r += ' ภายใน ' + fD(a.dueDate); lines.push(r); });
  }
  copyToClip(lines.join('\n')); toast('💬 Copy สำหรับ LINE แล้ว');
}

function mwCopySummary() {
  var m = _mwGetData(); if (!m) return;
  var notes = ((document.getElementById('mw-notes') || {}).value || m.notes || '').trim();
  var decisions = ((document.getElementById('mw-decisions') || {}).value || m.decisions || '').trim();
  var parking = ((document.getElementById('mw-parking') || {}).value || m.parkingLot || '').trim();
  var lines = ['=== สรุปการประชุม ===', 'หัวข้อ: ' + (m.title || ''), 'วันที่: ' + fD(m.date) + (m.time ? ' เวลา ' + m.time + (m.endTime ? '-' + m.endTime : '') : '')];
  if (m.location) lines.push('สถานที่: ' + m.location);
  var attList = window._mwAttendance || [];
  if (attList.length) {
    var came = attList.filter(function(a) { return a.attended; }).map(function(a) { return a.name; });
    var absent = attList.filter(function(a) { return !a.attended; }).map(function(a) { return a.name; });
    if (came.length) lines.push('ผู้เข้าร่วม: ' + came.join(', '));
    if (absent.length) lines.push('ขาด: ' + absent.join(', '));
  } else if (m.attendees) lines.push('ผู้เข้าร่วม: ' + m.attendees);
  lines.push('');
  if (window._mwAgenda && window._mwAgenda.length) {
    lines.push('วาระ:');
    window._mwAgenda.forEach(function(a, i) {
      var timeStr = a.timerSec ? ' [' + _mwFormatSec(a.timerSec) + ']' : '';
      lines.push((a.done ? '[✓] ' : '[ ] ') + (i+1) + '. ' + a.text + timeStr);
    });
    lines.push('');
  }
  if (notes) { lines.push('บันทึก:'); lines.push(notes); lines.push(''); }
  if (decisions) { lines.push('มติที่ประชุม:'); lines.push(decisions); lines.push(''); }
  if (parking) { lines.push('Parking Lot:'); lines.push(parking); lines.push(''); }
  var acts = m.actions || [];
  if (acts.length) {
    lines.push('Action Items:');
    acts.forEach(function(a, i) { var r = (a.done ? '[✓] ' : '[ ] ') + (i+1) + '. ' + a.title; if (a.assignee) r += ' — ' + a.assignee; if (a.dueDate) r += ' (' + fD(a.dueDate) + ')'; lines.push(r); });
  }
  copyToClip(lines.join('\n')); toast('📋 Copy สรุปการประชุมแล้ว');
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
  if (typeof syncToFirebase === 'function') syncToFirebase('pendingFollowups', pending);
  toast('✅ ทำเครื่องหมายเสร็จแล้ว'); render();
}

function deleteContactLog(id) {
  if (!confirm('ลบบันทึกนี้?')) return;
  var logs = JSON.parse(localStorage.getItem('v7_contact_logs') || '[]');
  var newLogs = [];
  for (var i = 0; i < logs.length; i++) { if (logs[i].id !== id) newLogs.push(logs[i]); }
  localStorage.setItem('v7_contact_logs', JSON.stringify(newLogs));
  if (typeof syncToFirebase === 'function') syncToFirebase('contactLogs', newLogs);
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