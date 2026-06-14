// ================================================================
// RENDER PENDING ACTIONS TODAY (Pipeline Action Items)
// ================================================================
function renderPendingActionsToday() {
  var pipeActions = [];
  var saved = localStorage.getItem('v7_pipeActions');
  if (saved) {
    try { pipeActions = JSON.parse(saved); } catch(e) { pipeActions = []; }
  }
  
  // ตรวจสอบว่า pipeActions เป็น array
  if (!pipeActions || !Array.isArray(pipeActions)) {
    pipeActions = [];
  }
  
  var pending = [];
  for (var i = 0; i < pipeActions.length; i++) {
    if (pipeActions[i] && pipeActions[i].status === 'pending') {
      pending.push(pipeActions[i]);
    }
  }
  
  if (!pending || pending.length === 0) return '';
  
  var allPipes = [];
  var allDealers = [];
  try {
    allPipes = ST.getAll('pipeline');
    allDealers = ST.getAll('dealers');
  } catch(e) {
    allPipes = [];
    allDealers = [];
  }
  
  var pipeMap = {};
  for (var i = 0; i < allPipes.length; i++) {
    if (allPipes[i]) pipeMap[allPipes[i].id] = allPipes[i];
  }
  
  var dealerMap = {};
  for (var i = 0; i < allDealers.length; i++) {
    if (allDealers[i]) dealerMap[allDealers[i].id] = allDealers[i];
  }
  
  var todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  
  var overdue = [];
  var todayItems = [];
  var soon = [];
  var normal = [];
  
  for (var i = 0; i < pending.length; i++) {
    var a = pending[i];
    if (!a) continue;
    
    var pipe = pipeMap[a.pipeId];
    if (!pipe) continue;
    if (pipe.status === 'lost' || pipe.status === 'delivered') continue;
    
    var dealer = dealerMap[pipe.dealerId];
    
    var daysLeft = 999;
    if (a.dueDate) {
      var parts = a.dueDate.split('/');
      if (parts.length === 3) {
        var dueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        daysLeft = Math.ceil((dueDate - todayDate) / 86400000);
      }
    }
    
    var item = { action: a, pipe: pipe, dealer: dealer, daysLeft: daysLeft };
    if (daysLeft < 0) overdue.push(item);
    else if (daysLeft === 0) todayItems.push(item);
    else if (daysLeft <= 3) soon.push(item);
    else normal.push(item);
  }
  
  var h = '<div class="card"><h2>⏳ Pipeline Action Items ';
  if (overdue.length) h += '<span class="pa-count-badge pa-count-red">' + overdue.length + ' เลยกำหนด</span> ';
  h += '<span class="pa-count-badge">' + pending.length + ' ทั้งหมด</span>';
  h += '</h2>';
  
  if (overdue.length) {
    h += '<div class="pa-group-title">🔴 เลยกำหนด</div>';
    for (var i = 0; i < overdue.length; i++) {
      var item = overdue[i];
      h += '<div class="pa-today-item" onclick="go(\'pipeDetail\',{pipeId:\'' + item.pipe.id + '\'})" style="cursor:pointer">';
      h += '<div class="pa-today-left">';
      h += '<div class="pa-today-text">' + sanitize(item.action.text) + '</div>';
      h += '<div class="pa-today-meta">📊 ' + sanitize(item.pipe.projectName || '-') + ' • ' + (item.dealer ? sanitize(item.dealer.name) : '-') + '</div>';
      h += '</div>';
      h += '<div class="pa-today-right">';
      h += '<div class="pa-today-date">' + (item.action.dueDate || '-') + '</div>';
      h += '<div class="pa-today-days" style="color:#ff5252">เกิน ' + Math.abs(item.daysLeft) + ' วัน</div>';
      h += '</div>';
      h += '<button class="btn-xs pa-btn-done" onclick="event.stopPropagation();quickMarkActionDone(\'' + item.action.id + '\')">✅</button>';
      h += '</div>';
    }
  }
  
  if (todayItems.length) {
    h += '<div class="pa-group-title">🟠 วันนี้</div>';
    for (var i = 0; i < todayItems.length; i++) {
      var item = todayItems[i];
      h += '<div class="pa-today-item" onclick="go(\'pipeDetail\',{pipeId:\'' + item.pipe.id + '\'})" style="cursor:pointer">';
      h += '<div class="pa-today-left">';
      h += '<div class="pa-today-text">' + sanitize(item.action.text) + '</div>';
      h += '<div class="pa-today-meta">📊 ' + sanitize(item.pipe.projectName || '-') + ' • ' + (item.dealer ? sanitize(item.dealer.name) : '-') + '</div>';
      h += '</div>';
      h += '<div class="pa-today-right">';
      h += '<div class="pa-today-date">' + (item.action.dueDate || '-') + '</div>';
      h += '<div class="pa-today-days" style="color:#ff9800">วันนี้!</div>';
      h += '</div>';
      h += '<button class="btn-xs pa-btn-done" onclick="event.stopPropagation();quickMarkActionDone(\'' + item.action.id + '\')">✅</button>';
      h += '</div>';
    }
  }
  
  if (soon.length) {
    h += '<div class="pa-group-title">🟡 ใกล้กำหนด (3 วัน)</div>';
    for (var i = 0; i < soon.length; i++) {
      var item = soon[i];
      h += '<div class="pa-today-item" onclick="go(\'pipeDetail\',{pipeId:\'' + item.pipe.id + '\'})" style="cursor:pointer">';
      h += '<div class="pa-today-left">';
      h += '<div class="pa-today-text">' + sanitize(item.action.text) + '</div>';
      h += '<div class="pa-today-meta">📊 ' + sanitize(item.pipe.projectName || '-') + ' • ' + (item.dealer ? sanitize(item.dealer.name) : '-') + '</div>';
      h += '</div>';
      h += '<div class="pa-today-right">';
      h += '<div class="pa-today-date">' + (item.action.dueDate || '-') + '</div>';
      h += '<div class="pa-today-days" style="color:#ffb74d">อีก ' + item.daysLeft + ' วัน</div>';
      h += '</div>';
      h += '<button class="btn-xs pa-btn-done" onclick="event.stopPropagation();quickMarkActionDone(\'' + item.action.id + '\')">✅</button>';
      h += '</div>';
    }
  }
  
  h += '</div>';
  return h;
}
// ================================================================
// QUICK MARK ACTION DONE
// ================================================================
function quickMarkActionDone(actionId) {
  var response = prompt('💬 ผลลัพธ์ / ตอบกลับ (ถ้ามี):');
  
  var pipeActions = [];
  var saved = localStorage.getItem('v7_pipeActions');
  if (saved) {
    try { pipeActions = JSON.parse(saved); } catch(e) { pipeActions = []; }
  }
  
  var pipeId = '';
  var actionText = '';
  
  for (var i = 0; i < pipeActions.length; i++) {
    if (pipeActions[i].id === actionId) {
      pipeActions[i].status = 'done';
      pipeActions[i].doneDate = _td();
      if (response) pipeActions[i].response = response;
      pipeId = pipeActions[i].pipeId;
      actionText = pipeActions[i].text;
      break;
    }
  }
  
  localStorage.setItem('v7_pipeActions', JSON.stringify(pipeActions));
  
  if (pipeId && typeof ST !== 'undefined' && ST.add) {
    ST.add('pipeLog', {
      pipeId: pipeId,
      type: 'progress',
      content: '✅ เสร็จ: ' + actionText + (response ? ' — ' + response : ''),
      date: _nw()
    });
  }
  
  toast('✅ เสร็จแล้ว!');
  render();
}
// ================================================================
// TODAY — Command Center
// ================================================================
function rToday(el) {
  document.getElementById('pgT').textContent = '📌 วันนี้ — ' + fD(_td());
  const cfg = getConfig();
  const tdy = _td(), dow = getTodayDow();
  const kpi = getKPIData();
  const suggestions = getSmartSuggestions();
  const pins = ST.getPins();

  // Schedule
  const mts = ST.filter('meetings', m => m.date === tdy).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const todayVisits = ST.filter('visits', v => v.date === tdy).sort((a,b) => (a.time||'').localeCompare(b.time||''));

  // Bidding urgent
  const bidUrg = ST.filter('pipeline', p => p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 1 && !['lost','delivered'].includes(p.status));

  // Waiting overdue
  const waitUrg = ST.filter('waiting', w => !w.resolved && w.dueDate && dTo(w.dueDate) <= 0);

  // Urgent tasks
  const taskUrg = getUrgentItems().filter(i => dTo(i.dueDate) <= 0);

  // Routine
  const rts = getRoutinesForToday(dow);
  const rc = ST.getRoutineCheck(tdy);
  const rtDone = rts.filter(r => rc.done.includes(r.id)).length;

  // Monthly (show first 5 days)
  const isMonthStart = new Date().getDate() <= 5;
  const mc = ST.getMonthlyCheck();
  const mItems = cfg.monthlyChecklist || [];
  const mDone = mItems.filter((_, i) => mc.done.includes(i)).length;

  // Quick notes today
  const qn = ST.filter('qnotes', n => n.created?.startsWith(tdy));
// Tab system
  if (!window.todayTab) window.todayTab = 'summary';
  
  var tabHtml = '<div class="today-tabs">';
  tabHtml += '<div class="today-tab ' + (todayTab === 'summary' ? 'act' : '') + '" onclick="todayTab=\'summary\';render()">📌 สรุป</div>';
  tabHtml += '<div class="today-tab ' + (todayTab === 'urgent' ? 'act' : '') + '" onclick="todayTab=\'urgent\';render()">🔴 ด่วน</div>';
  tabHtml += '<div class="today-tab ' + (todayTab === 'tasks' ? 'act' : '') + '" onclick="todayTab=\'tasks\';render()">📋 งาน</div>';
  tabHtml += '<div class="today-tab ' + (todayTab === 'schedule' ? 'act' : '') + '" onclick="todayTab=\'schedule\';render()">📅 วันนี้</div>';
  tabHtml += '<div class="today-tab ' + (todayTab === 'kpi' ? 'act' : '') + '" onclick="todayTab=\'kpi\';render()">🎯 KPI</div>';
  tabHtml += '<div class="today-tab ' + (todayTab === 'other' ? 'act' : '') + '" onclick="todayTab=\'other\';render()">⚙️ อื่นๆ</div>';
  tabHtml += '</div>';

  var briefingHtml = renderDailyBriefing();
  var timelineHtml = renderUpcomingTimeline();
  var notifHtml = renderSmartNotifPanel();
  var streakHtml = renderStreakCard();
  var healthHtml = renderHealthSummary();
  var pendingHtml = renderPendingActionsToday();

  var overdueFuHtml = '';
  var overdueFu = getAllOverdueFu();
  if (overdueFu.length > 0) {
    overdueFuHtml += '<div class="card"><h2>🔴 ติดตามเกินกำหนด (' + overdueFu.length + ')</h2>';
    overdueFu.forEach(function (o) {
      overdueFuHtml += '<div class="li" onclick="go(\'taskDetail\',{taskId:\'' + o.taskId + '\'})" style="cursor:pointer">';
      overdueFuHtml += '<div class="lm"><div class="lt">📞 ' + sanitize(o.stepTitle) + ' <span class="fu-badge fu-badge-red">ครั้งที่ ' + (o.followup.attempt || o.fuIdx + 1) + '</span></div>';
      overdueFuHtml += '<div class="ls">📋 ' + sanitize(o.taskTitle) + ' • กำหนด: ' + (o.followup.expectedDate || '-') + '</div>';
      overdueFuHtml += '</div></div>';
    });
    overdueFuHtml += '</div>';
  }

  // Build tab content
  var tabContent = '';

  if (todayTab === 'summary') {
    // 📌 สรุป = Briefing + Stats + Pins
    tabContent += briefingHtml;
    tabContent += `
    ${pins.length ? '<div class="pin-bar">' + pins.map(pinHTML).join('') + '</div>' : ''}
    `;

  } else if (todayTab === 'urgent') {
    // 🔴 ด่วน = Urgent + Timeline + Notifications + Overdue
    tabContent += `
    ${bidUrg.length || waitUrg.length || taskUrg.length ? '<div class="card" style="border-color:#ef4444"><h2 style="color:#ef4444">🔴 ต้องทำเดี๋ยวนี้</h2>' +
    bidUrg.map(function(p) { var d = ST.getOne('dealers', p.dealerId); return '<div class="li dl1" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})"><div class="lm"><div class="lt">⏳ Bidding: ' + sanitize(p.projectName) + '</div><div class="ls">' + (d ? d.name : '') + ' • 💰 ' + fmtMoney(p.forecastAmount) + ' ' + dlB(p.biddingDate, false) + '</div></div></div>'; }).join('') +
    waitUrg.map(function(w) { return '<div class="li dlo" onclick="go(\'reminders\')"><div class="lm"><div class="lt">📭 ' + sanitize(w.title) + '</div><div class="ls">' + (w.person ? '👤 ' + w.person : '') + ' ' + dlB(w.dueDate, false) + '</div></div></div>'; }).join('') +
    taskUrg.map(function(i) { return '<div class="li ' + dlC(i.dueDate, false) + '" onclick="go(\'taskDetail\',{taskId:\'' + i.refId + '\'})"><div class="lm"><div class="lt">📋 ' + sanitize(i.title) + '</div><div class="ls">' + dlB(i.dueDate, false) + '</div></div></div>'; }).join('') +
    '</div>' : '<div class="card" style="text-align:center;padding:20px"><div style="font-size:32px;margin-bottom:8px">✅</div><div style="color:var(--text2)">ไม่มีเรื่องด่วน!</div></div>'}
    `;
    tabContent += timelineHtml;
    tabContent += notifHtml;
    tabContent += overdueFuHtml;

  } else if (todayTab === 'tasks') {
    // 📋 งาน = Pipeline Actions + Suggestions
    tabContent += pendingHtml;
    tabContent += `
    ${suggestions.length ? '<div class="card"><h2>💡 แนะนำ</h2>' +
    suggestions.map(function(s) { return '<div class="li" style="border-left:3px solid ' + (s.priority === 'high' ? '#ef4444' : s.priority === 'medium' ? '#f59e0b' : '#3b82f6') + '"><div class="lm"><div class="lt">' + s.icon + ' ' + sanitize(s.text) + '</div>' +
    (s.dealers ? '<div class="ls">' + s.dealers.map(function(d) { return '<span class="kpi-dealer pending"><span class="dealer-name">' + sanitize(d.name) + '</span> <span class="dealer-act" onclick="event.stopPropagation();' + (s.action === 'followup' ? 'showFollowupM(\'' + d.id + '\')' : 'showVisitM(\'' + d.id + '\')') + '">📞</span></span>'; }).join(' ') + '</div>' : '') +
    (s.items ? '<div class="ls">' + s.items.map(function(i) { return '<span onclick="event.stopPropagation();go(\'pipeDetail\',{pipeId:\'' + i.id + '\'})" style="cursor:pointer;color:#3b82f6">' + sanitize(i.name) + '</span>'; }).join(', ') + '</div>' : '') +
    '</div></div>'; }).join('') + '</div>' : ''}
    `;

  } else if (todayTab === 'schedule') {
    // 📅 วันนี้ = Schedule + Routine
    tabContent += `
    ${mts.length || todayVisits.length ? '<div class="card"><h2>📅 ตารางวันนี้</h2>' +
    mts.map(function(m) { return '<div class="today-time" onclick="go(\'meetingDetail\',{meetingId:\'' + m.id + '\'})"><div class="tm">' + (m.time || '--:--') + '</div><div class="desc">📅 ' + sanitize(m.title) + '</div></div>'; }).join('') +
    todayVisits.map(function(v) { var d = ST.getOne('dealers', v.dealerId); return '<div class="today-time" onclick="go(\'visitDetail\',{visitId:\'' + v.id + '\'})"><div class="tm">' + (v.time || '--:--') + '</div><div class="desc">' + (v.mode === 'offline' ? '🤝' : '📞') + ' ' + (d ? d.name : '?') + ' ' + modeTag(v.mode) + '</div></div>'; }).join('') +
    '</div>' : '<div class="card" style="text-align:center;padding:20px"><div style="color:var(--text2)">ไม่มีตารางวันนี้</div></div>'}

    ${rts.length ? '<div class="card"><h2>🔄 Routine (' + rtDone + '/' + rts.length + ') <span class="ml"><button class="btn bsm bo" onclick="go(\'admin\',{tab:\'routine\'})">จัดการ</button></span></h2>' +
    '<div class="rt-prog"><div class="pb" style="flex:1;height:8px"><div class="pf ' + (rtDone >= rts.length ? 'pf-green' : 'pf-blue') + '" style="width:' + (rts.length ? Math.round(rtDone / rts.length * 100) : 0) + '%"></div></div><span style="font-size:.78rem;color:#94a3b8;min-width:35px;text-align:right">' + (rts.length ? Math.round(rtDone / rts.length * 100) : 0) + '%</span></div>' +
    rts.map(function(r) { var isDone = rc.done.indexOf(r.id) !== -1; return '<div class="rt-item ' + (isDone ? 'rt-done' : '') + '"><div class="ck ' + (isDone ? 'chk' : '') + '" onclick="ST.toggleRoutineCheck(\'' + r.id + '\');render()"></div><div class="rt-time">' + (r.time || '') + '</div><div class="rt-title">' + sanitize(r.title) + '</div><span class="rt-tag">' + (DAY_NAMES[r.days] || r.days) + '</span></div>'; }).join('') +
    '</div>' : ''}
    `;

  } else if (todayTab === 'kpi') {
    // 🎯 KPI = KPI + Monthly + Streak
    tabContent += `
    <div class="card"><h2>🎯 KPI สัปดาห์ (${fDShort(kpi.weekRange.start)}—${fDShort(kpi.weekRange.end)}) <span class="ml"><button class="btn bsm bo" onclick="go('kpi')">ดูเต็ม →</button></span></h2>
    <div class="kpi-row">
      ${kpiCardHTML('📞 Follow-up', kpi.followup.current, kpi.followup.target, kpi.followup.dealers)}
      ${kpiCardHTML('🤝 Visit', kpi.visit.current, kpi.visit.target)}
    </div>
    <div style="display:flex;gap:8px;font-size:.76rem;margin-top:4px">
      <span>📊 Pipeline: ${kpi.pipeUpdated ? '✅' : '❌'}</span>
      <span>📦 Forecast: ${kpi.fcUpdated ? '✅' : '❌'}</span>
      <span>📧 Visit Plan: ${kpi.vpSent ? '✅' : '❌'}</span>
    </div></div>

    ${isMonthStart && mItems.length ? '<div class="card"><h2>📋 Monthly Checklist (' + mDone + '/' + mItems.length + ')</h2>' +
    mItems.map(function(item, i) { var isDone = mc.done.indexOf(i) !== -1; return '<div class="monthly-item ' + (isDone ? 'done' : '') + '"><div class="ck ' + (isDone ? 'chk' : '') + '" onclick="ST.toggleMonthlyCheck(' + i + ');render()"></div><div class="monthly-title">' + sanitize(item) + '</div></div>'; }).join('') +
    '</div>' : ''}
    `;
    tabContent += streakHtml;

  } else if (todayTab === 'other') {
    // ⚙️ อื่นๆ = Quick Notes + Health + Pins
    tabContent += `
    <div class="card"><h2>📝 Quick Notes <span class="ml"><button class="btn bsm bp" onclick="showQNote()">➕</button></span></h2>
    ${qn.length ? qn.map(function(n) { return '<div style="padding:4px 8px;background:#0f172a;border:1px solid #334155;border-radius:7px;margin-bottom:3px;display:flex;justify-content:space-between;font-size:.76rem"><div style="white-space:pre-wrap;flex:1">' + sanitize(n.text) + '</div><button class="btn bsm bd" onclick="ST.delete(\'qnotes\',\'' + n.id + '\');render()">✕</button></div>'; }).join('') : '<div class="empty"><p>กด ➕ จดโน้ตด่วน</p></div>'}
    </div>
    `;
    tabContent += healthHtml;
    tabContent += `
    ${pins.length ? '<div class="pin-bar">' + pins.map(pinHTML).join('') + '</div>' : ''}
    `;
  }

  el.innerHTML = tabHtml + tabContent;
}

// KPI Card HTML helper
function kpiCardHTML(label, current, target, dealerIds) {
  const pct = target ? Math.round(current / target * 100) : 0;
  const ok = current >= target;
  return `<div class="kpi-card ${ok?'kpi-ok':'kpi-bad'}">
    <h4>${label} <span class="kpi-score" style="color:${ok?'#22c55e':'#ef4444'}">${current}/${target}</span></h4>
    <div class="kpi-bar"><div class="pb" style="flex:1;height:8px"><div class="pf ${ok?'pf-green':'pf-red'}" style="width:${Math.min(pct,100)}%"></div></div>
    <div class="kpi-pct">${pct}%</div></div>
    <div class="kpi-dots">${Array.from({length:target},(_,i) => `<div class="kpi-dot ${i<current?'filled':''}"></div>`).join('')}</div>
    ${dealerIds ? `<div style="margin-top:4px">${dealerIds.map(did => { const d = ST.getOne('dealers', did); return d ? `<span class="kpi-dealer done">✅ ${sanitize(d.name)}</span>` : ''; }).join('')}</div>` : ''}
  </div>`;
}

// Pin HTML
function pinHTML(p) {
  let onclick = '';
  if (p.type === 'dealer') onclick = `go('dealerDetail',{dealerId:'${p.refId}'})`;
  else if (p.type === 'pipeline') onclick = `go('pipeDetail',{pipeId:'${p.refId}'})`;
  else if (p.type === 'task') onclick = `go('taskDetail',{taskId:'${p.refId}'})`;
  return `<div class="pin-card" onclick="${onclick}"><h4>📌 ${sanitize(p.label)}</h4><div class="meta">${sanitize(p.sub||'')}</div></div>`;
}

// Get routines for today
function getRoutinesForToday(dow) {
  return ST.getAll('routines').filter(r => {
    if (r.days === 'daily') return true;
    if (r.days === dow) return true;
    if (r.days === 'mon-wed' && ['mon','tue','wed'].includes(dow)) return true;
    if (r.days === 'mon-fri' && ['mon','tue','wed','thu','fri'].includes(dow)) return true;
    return false;
  }).sort((a,b) => (a.time||'').localeCompare(b.time||''));
}

// ================================================================
// KPI FULL PAGE
// ================================================================
function rKPI(el) {
  document.getElementById('pgT').textContent = '🎯 KPI & เป้า';
  const cfg = getConfig();
  const kpi = getKPIData();
  const dealerStatus = getDealerContactStatus();
  const goalData = getGoalData();

  // Split dealers by contact status
  const contacted = dealerStatus.filter(d => kpi.followup.dealers.includes(d.id));
  const notContacted = dealerStatus.filter(d => !kpi.followup.dealers.includes(d.id) && d.level && d.level !== 'Other');
  const noContactEver = dealerStatus.filter(d => d.lastContactDays === null);

  el.innerHTML = `
  <!-- KPI Cards -->
  <div class="card"><h2>🎯 KPI สัปดาห์ (${fD(kpi.weekRange.start)} — ${fD(kpi.weekRange.end)})</h2>

  <!-- Follow-up Detail -->
  <div style="margin-bottom:16px">
    <h3 style="font-size:.84rem;color:#3b82f6;margin-bottom:8px">📞 Follow-up Online (${kpi.followup.current}/${kpi.followup.target} ราย)</h3>
    <div class="kpi-bar" style="margin-bottom:8px"><div class="pb" style="flex:1;height:10px"><div class="pf ${kpi.followup.current>=kpi.followup.target?'pf-green':'pf-red'}" style="width:${Math.min(100,Math.round(kpi.followup.current/kpi.followup.target*100))}%"></div></div>
    <div class="kpi-pct" style="font-size:.82rem">${Math.round(kpi.followup.current/kpi.followup.target*100)}%</div></div>
    
    ${contacted.length ? `<div style="margin-bottom:6px;font-size:.74rem;color:#22c55e;font-weight:600">✅ ติดต่อแล้ว (${contacted.length}):</div>
    ${contacted.map(d => `<div class="kpi-dealer done"><span class="dealer-name">🟢 ${sanitize(d.name)} ${levelTag(d.level)}</span><span style="color:#64748b">${d.lastContactDate ? fDShort(d.lastContactDate) : ''}</span></div>`).join('')}` : ''}
    
    ${notContacted.length ? `<div style="margin:8px 0 6px;font-size:.74rem;color:#ef4444;font-weight:600">❌ ยังไม่ได้ติดต่อ (${notContacted.length}):</div>
    ${notContacted.map(d => `<div class="kpi-dealer ${d.lastContactDays > 14 ? 'overdue' : 'pending'}">
      <span class="health-dot ${d.contactStatus}"></span>
      <span class="dealer-name">${sanitize(d.name)} ${levelTag(d.level)}</span>
      <span style="color:#64748b;font-size:.62rem">${d.lastContactDate ? fDRelative(d.lastContactDate) : 'ไม่เคย'}</span>
      <span class="dealer-act" onclick="event.stopPropagation();showFollowupM('${d.id}')">📞 FU</span>
    </div>`).join('')}` : ''}
  </div>

  <!-- Visit Detail -->
  <div style="margin-bottom:16px">
    <h3 style="font-size:.84rem;color:#3b82f6;margin-bottom:8px">🤝 Visit Onsite (${kpi.visit.current}/${kpi.visit.target} ครั้ง)</h3>
    <div class="kpi-bar" style="margin-bottom:8px"><div class="pb" style="flex:1;height:10px"><div class="pf ${kpi.visit.current>=kpi.visit.target?'pf-green':'pf-red'}" style="width:${Math.min(100,Math.round(kpi.visit.current/kpi.visit.target*100))}%"></div></div>
    <div class="kpi-pct" style="font-size:.82rem">${Math.round(kpi.visit.current/kpi.visit.target*100)}%</div></div>
    
    ${kpi.visit.details.length ? kpi.visit.details.map(v => { const d = ST.getOne('dealers', v.dealerId); return `<div class="kpi-dealer done"><span class="dealer-name">🟢 ${d?.name||'?'} — ${fD(v.date)} ${v.time||''}</span><span class="dealer-act" onclick="event.stopPropagation();go('visitDetail',{visitId:'${v.id}'})">ดู →</span></div>`; }).join('') : ''}
    
    <div style="margin-top:8px;font-size:.74rem;color:#94a3b8">💡 แนะนำ Visit ถัดไป (ไม่ Visit นานสุด):</div>
    ${dealerStatus.filter(d => d.level && d.level !== 'Other').sort((a,b) => (b.lastVisitDays === null ? 9999 : b.lastVisitDays) - (a.lastVisitDays === null ? 9999 : a.lastVisitDays)).slice(0,3).map(d => `<div class="kpi-dealer pending">
      <span class="health-dot ${contactColor(d.lastVisitDays)}"></span>
      <span class="dealer-name">${sanitize(d.name)}</span>
      <span style="color:#64748b;font-size:.62rem">${d.lastVisitDate ? `Visit ${fDRelative(d.lastVisitDate)}` : 'ไม่เคย Visit'}</span>
      <span class="dealer-act" onclick="event.stopPropagation();showVisitM('${d.id}')">🤝</span>
    </div>`).join('')}
  </div>

  <!-- Other KPIs -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:.78rem">
    <span style="padding:4px 10px;border-radius:6px;background:${kpi.pipeUpdated?'#14532d':'#7f1d1d'};color:${kpi.pipeUpdated?'#86efac':'#fca5a5'}">📊 Pipeline: ${kpi.pipeUpdated?'✅ Updated':'❌'}</span>
    <span style="padding:4px 10px;border-radius:6px;background:${kpi.fcUpdated?'#14532d':'#7f1d1d'};color:${kpi.fcUpdated?'#86efac':'#fca5a5'}">📦 Forecast: ${kpi.fcUpdated?'✅':'❌'}</span>
    <span style="padding:4px 10px;border-radius:6px;background:${kpi.vpSent?'#14532d':'#7f1d1d'};color:${kpi.vpSent?'#86efac':'#fca5a5'}">📧 Visit Plan: ${kpi.vpSent?'✅':'❌'}</span>
  </div></div>

  <!-- Dealer Health Board -->
  <div class="card"><h2>🏥 Dealer Health Score <span class="ml"><button class="btn bsm bo" onclick="copyDealerHealth()">📋 Copy</button></span></h2>
  <div style="overflow-x:auto"><table class="export-table" id="healthTable">
    <thead><tr><th>Dealer</th><th>Level</th><th>Score</th><th>ติดต่อ</th><th>Visit</th><th>Pipeline</th><th>Achievement</th><th>Cert</th></tr></thead>
    <tbody>${ST.getAll('dealers').filter(d => d.level && d.level !== 'Other').map(d => {
      const h = calcHealthScore(d.id);
      const lcd = ST.getLastContactDays(d.id);
      const lvd = ST.getLastVisitDays(d.id);
      const pipes = ST.pipelineByDealer(d.id);
      const won = pipes.filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
      const target = Number(d.targetRevenue) || 0;
      const pct = target ? Math.round(won/target*100) : 0;
      const certCount = ['dsec','crm','fh2','lark'].filter(c => d[c+'Status'] === 'pass' || d[c+'Status'] === 'yes' || d[c+'Status'] === 'added').length;
      return `<tr onclick="go('dealerDetail',{dealerId:'${d.id}'})" style="cursor:pointer">
        <td><b>${sanitize(d.name)}</b></td>
        <td>${levelTag(d.level)}</td>
        <td><span style="color:${h.level==='good'?'#22c55e':h.level==='warn'?'#f59e0b':'#ef4444'};font-weight:700">${h.score}</span></td>
        <td><span class="${contactColor(lcd)}" style="display:inline-block;width:8px;height:8px;border-radius:50%"></span> ${lcd !== null ? lcd + 'd' : '-'}</td>
        <td>${lvd !== null ? lvd + 'd' : '-'}</td>
        <td>${pipes.filter(p=>!['lost','delivered','on_hold'].includes(p.status)).length}</td>
        <td>${target ? pct + '%' : '-'}</td>
        <td>${certCount}/4</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div></div>

  <!-- Goal Setting -->
  <div class="card"><h2>🎯 เป้าหมาย ${goalData.quarter.label} <span class="ml"><span style="font-size:.72rem;color:#64748b">เหลือ ${goalData.daysLeft} วัน</span></span></h2>
  <div style="text-align:center;margin-bottom:10px">
    <div style="font-size:1.1rem;font-weight:700">เป้ารวม: <span class="c3">${fmtMoney(goalData.totalTarget)}</span> ฿</div>
    <div style="font-size:.88rem">ยอดจริง: <span class="c2">${fmtMoney(goalData.totalWon)}</span> ฿ (${goalData.totalPct}%)</div>
    <div class="pb" style="height:10px;margin:6px 0"><div class="pf ${goalData.totalPct>=70?'pf-green':goalData.totalPct>=40?'pf-yellow':'pf-red'}" style="width:${Math.min(goalData.totalPct,100)}%"></div></div>
  </div>
  ${goalData.dealers.length ? `<div style="overflow-x:auto"><table class="export-table" id="goalTable">
    <thead><tr><th>Dealer</th><th>Level</th><th>เป้า</th><th>ยอดจริง</th><th>%</th><th>เหลือ</th><th>Pipeline Active</th></tr></thead>
    <tbody>${goalData.dealers.map(g => `<tr onclick="go('dealerDetail',{dealerId:'${g.dealer.id}'})" style="cursor:pointer">
      <td><b>${sanitize(g.dealer.name)}</b></td>
      <td>${levelTag(g.dealer.level)}</td>
      <td style="text-align:right">${fmtMoney(g.target)}</td>
      <td style="text-align:right;color:#22c55e">${fmtMoney(g.won)}</td>
      <td style="text-align:right;font-weight:700;color:${g.pct>=70?'#22c55e':g.pct>=40?'#f59e0b':'#ef4444'}">${g.pct}%</td>
      <td style="text-align:right;color:${g.gap>0?'#ef4444':'#22c55e'}">${g.gap > 0 ? fmtMoneyShort(g.gap) : '✅'}</td>
      <td style="text-align:right">${fmtMoneyShort(g.pipeActive)}</td>
    </tr>`).join('')}</tbody>
  </table></div>` : '<div class="empty"><p>ยังไม่ได้ตั้งเป้า — ไปตั้งที่ Dealer Detail</p></div>'}
  <div class="bg" style="margin-top:6px"><button class="btn bsm bo" onclick="copyTable('goalTable','📋 Copy เป้า')">📋 Copy</button></div>
  </div>`;
}

function copyDealerHealth() { copyTable('healthTable', '📋 Copy Health Score'); }

// ================================================================
// SMART FILTER VIEW
// ================================================================
function rSmartFilter(el) {
  const fid = S.filterId;
  const f = getSmartFilters().find(x => x.id === fid);
  document.getElementById('pgT').textContent = f ? f.icon + ' ' + f.name : '🔍';
  
  let html = '';

  switch(fid) {
    case 'overdue_tasks': {
      const items = getUrgentItems().filter(i => dTo(i.dueDate) < 0);
      html = items.map(i => `<div class="li dlo" onclick="go('taskDetail',{taskId:'${i.refId}'})"><div class="lm"><div class="lt">${sanitize(i.title)}</div><div class="ls">${i.parent?sanitize(i.parent)+' • ':''}${dlB(i.dueDate,false)}</div></div></div>`).join('') || emp('ไม่มี');
      break; }
    case 'bidding_soon': {
      const w = getWeekRange();
      const items = ST.filter('pipeline', p => p.biddingDate && isInRange(p.biddingDate, w.start, w.end) && !['lost','delivered'].includes(p.status));
      html = items.map(p => pipeListItem(p)).join('') || emp('ไม่มี');
      break; }
    case 'stale_pipeline': {
      html = getStalePipelines().map(p => pipeListItem(p)).join('') || emp('ไม่มี');
      break; }
    case 'big_projects': {
      const items = ST.filter('pipeline', p => Number(p.forecastAmount) >= 1500000 && !['lost','delivered','on_hold'].includes(p.status));
      html = items.map(p => pipeListItem(p)).join('') || emp('ไม่มี');
      break; }
    case 'waiting_overdue': {
      go('reminders'); return; }
    case 'no_contact_14d': {
      const items = getDealerContactStatus().filter(d => d.lastContactDays === null || d.lastContactDays > 14);
      html = items.map(d => `<div class="li" onclick="go('dealerDetail',{dealerId:'${d.id}'})"><div class="lm"><div class="lt"><span class="health-dot ${d.contactStatus}"></span> ${sanitize(d.name)} ${levelTag(d.level)}</div><div class="ls">${d.lastContactDate ? contactLabel(d.lastContactDays) : '⚪ ไม่เคยติดต่อ'}</div></div>
      <span class="dealer-act" onclick="event.stopPropagation();showFollowupM('${d.id}')">📞</span></div>`).join('') || emp('ไม่มี');
      break; }
    case 'fu_remaining': {
      go('kpi'); return; }
    case 'low_health': {
      const items = ST.getAll('dealers').filter(d => calcHealthScore(d.id).score < 40).map(d => ({...d, health: calcHealthScore(d.id)}));
      html = items.map(d => `<div class="li" onclick="go('dealerDetail',{dealerId:'${d.id}'})"><div class="lm"><div class="lt">${sanitize(d.name)} ${levelTag(d.level)} <span style="color:#ef4444;font-weight:700">${d.health.score}/100</span></div><div class="ls">${d.health.details.filter(x => x.status === 'bad').map(x => x.label).join(' • ')}</div></div></div>`).join('') || emp('ไม่มี');
      break; }
  }
  el.innerHTML = `<div class="card"><h2>${f ? f.icon + ' ' + f.name : ''}</h2>${html}</div>`;
}

function emp(msg) { return `<div class="empty"><p>✅ ${msg}</p></div>`; }

function pipeListItem(p) {
  const d = ST.getOne('dealers', p.dealerId);
  return `<div class="li ${dlC(p.biddingDate, ['lost','delivered'].includes(p.status))}" onclick="go('pipeDetail',{pipeId:'${p.id}'})"><div class="lm"><div class="lt">${sanitize(p.projectName)} ${pipeTag(p.status)}</div><div class="ls">${d?.name||''} • ${p.model||''} • 💰 ${fmtMoney(p.forecastAmount)} ${p.biddingDate?'• Bid: '+fDShort(p.biddingDate)+' '+dlB(p.biddingDate,['lost','delivered'].includes(p.status)):''}</div></div></div>`;
}

// ================================================================
// CALENDAR
// ================================================================
function rCalendar(el) {
  document.getElementById('pgT').textContent = '📆 ปฏิทิน';
  const dim = new Date(calY, calM+1, 0).getDate();
  const fd = new Date(calY, calM, 1).getDay();
  const tdy = _td();
  const evs = getCalEvents(calY, calM);
  
  let h = `<div class="cal-nav"><button class="btn bo" onclick="calM--;if(calM<0){calM=11;calY--}render()">◀</button><h3>${MONTHS[calM]} ${calY}</h3><button class="btn bo" onclick="calM++;if(calM>11){calM=0;calY++}render()">▶</button></div><div class="cal-grid">`;
  DAYS_S.forEach(d => h += `<div class="cal-hd">${d}</div>`);
  const pv = new Date(calY, calM, 0).getDate();
  for (let i = fd-1; i >= 0; i--) h += `<div class="cal-cell other"><div class="cal-num">${pv-i}</div></div>`;
  for (let d = 1; d <= dim; d++) {
    const iso = `${calY}-${String(calM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const de = evs.filter(e => e.date === iso);
    h += `<div class="cal-cell${iso===tdy?' today':''}" onclick="showCalDay('${iso}')"><div class="cal-num">${d}</div>${de.slice(0,3).map(e => `<div class="cal-ev ev-${e.type}">${sanitize(e.label)}</div>`).join('')}${de.length>3?`<div style="font-size:.48rem;color:#64748b">+${de.length-3}</div>`:''}</div>`;
  }
  const tot = fd + dim, rem = 7 - tot % 7;
  if (rem < 7) for (let i = 1; i <= rem; i++) h += `<div class="cal-cell other"><div class="cal-num">${i}</div></div>`;
  h += `</div>`;
  el.innerHTML = h;
}

function getCalEvents(y, m) {
  let e = [];
  const pf = `${y}-${String(m+1).padStart(2,'0')}`;
  ST.filter('pipeline', p => !['lost','delivered'].includes(p.status)).forEach(p => {
    if (p.biddingDate?.startsWith(pf)) e.push({date:p.biddingDate, type:'bidding', label:'⏳ '+p.projectName?.substr(0,12)});
    if (p.shipmentDate?.startsWith(pf)) e.push({date:p.shipmentDate, type:'deadline', label:'🚚 '+p.projectName?.substr(0,12)});
  });
  ST.filter('tasks', t => t.status === 'active' && t.dueDate?.startsWith(pf)).forEach(t => {
    e.push({date:t.dueDate, type:'deadline', label:'📋 '+t.title?.substr(0,12)});
  });
  ST.filter('meetings', mt => mt.date?.startsWith(pf)).forEach(mt => {
    e.push({date:mt.date, type:'meeting', label:'📅 '+mt.title?.substr(0,12)});
  });
  ST.filter('visits', v => v.date?.startsWith(pf)).forEach(v => {
    const d = ST.getOne('dealers', v.dealerId);
    e.push({date:v.date, type:'visit', label:(v.mode==='offline'?'🤝':'📞')+(d?.name||'').substr(0,10)});
  });
  return e;
}

function showCalDay(iso) {
  let evs = [];
  ST.filter('pipeline', p => p.biddingDate === iso).forEach(p => evs.push({t:`⏳ ${p.projectName}`, a:`go('pipeDetail',{pipeId:'${p.id}'})`}));
  ST.filter('meetings', m => m.date === iso).forEach(m => evs.push({t:`📅 ${m.title} ${m.time||''}`, a:`go('meetingDetail',{meetingId:'${m.id}'})`}));
  ST.filter('visits', v => v.date === iso).forEach(v => { const d = ST.getOne('dealers', v.dealerId); evs.push({t:`🤝 ${d?.name||'?'} ${v.time||''}`, a:`go('visitDetail',{visitId:'${v.id}'})`}); });
  ST.filter('tasks', t => t.status === 'active' && t.dueDate === iso).forEach(t => evs.push({t:`📋 ${t.title}`, a:`go('taskDetail',{taskId:'${t.id}'})`}));
  if (!evs.length) return;
  openM(`📆 ${fD(iso)}`, evs.map(e => `<div class="li" onclick="closeM();${e.a}"><div class="lm"><div class="lt">${sanitize(e.t)}</div></div></div>`).join(''));
}

// ================================================================
// HEATMAP
// ================================================================
function rHeatmap(el) {
  document.getElementById('pgT').textContent = '🗓️ Heatmap';
  const weeks = 12, endDate = _td(), startDate = addD(endDate, -(weeks * 7));
  const counts = {};
  [...ST.getAll('pipeLog'), ...ST.getAll('taskLogs')].forEach(l => { const d = l.date?.split('T')[0]; if (d) counts[d] = (counts[d]||0) + 1; });
  ST.getAll('visits').forEach(v => { if (v.date) counts[v.date] = (counts[v.date]||0) + 1; });
  ST.getAll('followups').forEach(f => { if (f.date) counts[f.date] = (counts[f.date]||0) + 1; });
  ST.getAll('rtChecks').forEach(r => { if (r.done) counts[r.date] = (counts[r.date]||0) + r.done.length; });
  
  const maxC = Math.max(...Object.values(counts), 1);
  let cells = [], cur = startDate;
  while (cur <= endDate) { const c = counts[cur]||0; cells.push({date:cur, count:c, level:c===0?0:c<=maxC*.25?1:c<=maxC*.5?2:c<=maxC*.75?3:4}); cur = addD(cur, 1); }
  const sd = new Date(startDate).getDay();
  for (let i = 0; i < sd; i++) cells.unshift(null);
  
  const totalAct = Object.values(counts).reduce((a,b) => a+b, 0);
  const activeDays = Object.keys(counts).filter(d => d >= startDate).length;
  let streak = 0, d2 = _td();
  while (counts[d2]) { streak++; d2 = addD(d2, -1); }

  el.innerHTML = `<div class="sr">
    <div class="sc"><div class="sn c2">${totalAct}</div><div class="sl">Activities</div></div>
    <div class="sc"><div class="sn c1">${activeDays}</div><div class="sl">Active Days</div></div>
    <div class="sc"><div class="sn c3">${streak}🔥</div><div class="sl">Streak</div></div>
    <div class="sc"><div class="sn c5">${activeDays?(totalAct/activeDays).toFixed(1):0}</div><div class="sl">เฉลี่ย/วัน</div></div>
  </div>
  <div class="card"><h2>🗓️ Heatmap — ${weeks} สัปดาห์</h2>
  <div class="hm-grid">${DAYS_S.map(d => `<div style="font-size:.54rem;color:#475569;text-align:center;padding:2px">${d}</div>`).join('')}
  ${cells.map(c => c ? `<div class="hm-cell hm-${c.level}" title="${fD(c.date)}: ${c.count}">${c.count||''}</div>` : '<div class="hm-cell hm-0"></div>').join('')}</div>
  <div style="display:flex;gap:3px;align-items:center;margin-top:5px;font-size:.6rem;color:#64748b">น้อย ${[0,1,2,3,4].map(l => `<div class="hm-cell hm-${l}" style="width:10px;height:10px;display:inline-block"></div>`).join('')} เยอะ</div></div>`;
}

// ================================================================
// WORKLOAD
// ================================================================
function rWorkload(el) {
  document.getElementById('pgT').textContent = '📊 Workload';
  const wks = 6, now = new Date(), dow = now.getDay();
  const weekStart = addD(_td(), -(dow === 0 ? 6 : dow - 1));
  
  let bars = [];
  for (let w = 0; w < wks; w++) {
    const ws = addD(weekStart, w * 7), we = addD(ws, 6);
    let count = 0;
    count += ST.filter('pipeline', p => p.biddingDate && isInRange(p.biddingDate, ws, we) && !['lost','delivered'].includes(p.status)).length;
    count += ST.filter('tasks', t => t.status === 'active' && t.dueDate && isInRange(t.dueDate, ws, we)).length;
    count += ST.filter('meetings', m => isInRange(m.date, ws, we)).length;
    count += ST.filter('visits', v => isInRange(v.date, ws, we)).length;
    bars.push({label: `${fDShort(ws)}—${fDShort(we)}`, count, isThis: w === 0});
  }
  const maxC = Math.max(...bars.map(b => b.count), 1);
  
  el.innerHTML = `<div class="card"><h2>📊 Workload — ${wks} สัปดาห์</h2>
  ${bars.map(b => { const pct = Math.round(b.count/maxC*100); const cls = b.count > maxC*.8 ? 'wl-overload' : b.count > maxC*.5 ? 'wl-busy' : 'wl-normal';
  return `<div class="wl-bar"><div class="wl-label">${b.label} ${b.isThis?'← นี้':''}</div><div style="flex:1;background:#334155;border-radius:5px;overflow:hidden"><div class="wl-fill ${cls}" style="width:${Math.max(pct,5)}%">${b.count}</div></div></div>`; }).join('')}
  <div style="display:flex;gap:8px;margin-top:6px;font-size:.66rem;color:#64748b"><span>🟦 ปกติ</span><span>🟨 เยอะ</span><span>🟥 ล้น</span></div></div>`;
}

// ================================================================
// REMINDERS
// ================================================================
function rRemind(el) {
  document.getElementById('pgT').textContent = '🔔 แจ้งเตือน';
  const urgTasks = getUrgentItems();
  const bidUrg = ST.filter('pipeline', p => p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 3 && !['lost','delivered'].includes(p.status));
  const waitUrg = ST.filter('waiting', w => !w.resolved && w.dueDate && dTo(w.dueDate) <= 0);
  const waitAll = ST.filter('waiting', w => !w.resolved).sort((a,b) => (a.dueDate||'z').localeCompare(b.dueDate||'z'));
  const mtUrg = ST.filter('meetings', m => dTo(m.date) >= 0 && dTo(m.date) <= 3).sort((a,b) => a.date.localeCompare(b.date));
  const stale = getStalePipelines();
  const noContact = getDealerContactStatus().filter(d => (d.lastContactDays === null || d.lastContactDays > 14) && d.level && d.level !== 'Other');

  el.innerHTML = `
  ${bidUrg.length ? `<div class="card"><h2>⏳ Bidding ใกล้ถึง</h2>${bidUrg.map(p => pipeListItem(p)).join('')}</div>` : ''}
  ${urgTasks.length ? `<div class="card"><h2>📋 งานใกล้/เลย Deadline</h2>${urgTasks.map(i => `<div class="li ${dlC(i.dueDate,false)}" onclick="go('taskDetail',{taskId:'${i.refId}'})"><div class="lm"><div class="lt">${sanitize(i.title)}</div><div class="ls">${dlB(i.dueDate,false)}</div></div></div>`).join('')}</div>` : ''}
  
  <div class="card"><h2>📭 รอคนอื่น (${waitAll.length}) <span class="ml"><button class="btn bsm bp" onclick="showWaitM()">➕</button></span></h2>
  ${waitAll.length ? waitAll.map(w => {
    const isOver = w.dueDate && dTo(w.dueDate) < 0;
    const isWarn = w.dueDate && dTo(w.dueDate) <= 3 && dTo(w.dueDate) >= 0;
    const days = w.sentDate ? daysBetween(w.sentDate, _td()) : 0;
    return `<div class="wait-card ${isOver?'overdue':''} ${isWarn?'warning':''}">
      <div style="flex:1"><div class="wait-title">${sanitize(w.title)}</div>
      <div class="wait-days">${w.person?'👤 '+sanitize(w.person):''} ${w.sentDate?'• ส่ง: '+fDShort(w.sentDate):''} ${days?'• รอ '+days+'d':''} ${w.dueDate?'• กำหนด: '+fDShort(w.dueDate)+' '+dlB(w.dueDate,false):''}</div></div>
      <button class="btn bsm bs" onclick="ST.resolveWaiting('${w.id}');toast('✅');render()">✅</button>
      <button class="btn bsm bd" onclick="ST.delete('waiting','${w.id}');render()">✕</button></div>`;
  }).join('') : emp('ไม่มี')}</div>
  
  ${noContact.length ? `<div class="card"><h2>📞 ไม่ติดต่อ > 14 วัน (${noContact.length})</h2>
  ${noContact.slice(0,10).map(d => `<div class="li" onclick="go('dealerDetail',{dealerId:'${d.id}'})"><div class="lm"><div class="lt"><span class="health-dot ${d.contactStatus}"></span> ${sanitize(d.name)} ${levelTag(d.level)}</div><div class="ls">${contactLabel(d.lastContactDays)}</div></div>
  <span class="dealer-act" onclick="event.stopPropagation();showFollowupM('${d.id}')">📞</span></div>`).join('')}</div>` : ''}
  
  ${stale.length ? `<div class="card"><h2>🔄 Pipeline ไม่อัพเดต > 14 วัน (${stale.length})</h2>${stale.map(p => pipeListItem(p)).join('')}</div>` : ''}
  
  ${mtUrg.length ? `<div class="card"><h2>📅 ประชุมใน 3 วัน</h2>${mtUrg.map(m => `<div class="li" onclick="go('meetingDetail',{meetingId:'${m.id}'})"><div class="lm"><div class="lt">${sanitize(m.title)}</div><div class="ls">${fD(m.date)} ${m.time||''} ${dlB(m.date,false)}</div></div></div>`).join('')}</div>` : ''}
  
  <div class="card"><h2>🔔 Browser Notification</h2>
  <button class="btn bs" onclick="if('Notification' in window)Notification.requestPermission().then(p=>toast(p==='granted'?'✅ เปิดแล้ว':'❌'));else toast('ไม่รองรับ',true)">🔔 เปิดการแจ้งเตือน</button>
  <div style="margin-top:4px;font-size:.7rem;color:#64748b">${'Notification' in window ? 'สถานะ: '+Notification.permission : 'ไม่รองรับ'}</div></div>`;
}

// ================================================================
// INSIGHTS
// ================================================================
function rInsights(el) {
  document.getElementById('pgT').textContent = '🤖 Insights';
  const insights = generateInsights();
  const sf = getSmartFilters();
  
  el.innerHTML = `
  <div class="card"><h2>🔍 Smart Filters</h2>
  <div class="sf-grid">${sf.map(f => `<div class="sf-card" onclick="go('smartFilter',{filterId:'${f.id}'})">
    <div class="sf-icon">${f.icon}</div><div class="sf-info"><div class="sf-name">${f.name}</div></div>
    <div class="sf-count" style="color:${f.color}">${f.count}</div></div>`).join('')}</div></div>

  <div class="card"><h2>🤖 Smart Insights</h2>
  ${insights.length ? insights.map(i => `<div class="insight-card">
    <div class="insight-icon">${i.icon}</div>
    <div class="insight-body">
      <div class="insight-title">${sanitize(i.title)}</div>
      <div class="insight-desc">${sanitize(i.desc)}</div>
      ${i.action ? `<div class="insight-action"><button class="btn bsm bo" onclick="${i.action}">ดู →</button></div>` : ''}
    </div></div>`).join('') : '<div class="empty"><p>ยังไม่มีข้อมูลพอวิเคราะห์</p></div>'}
  </div>

  <!-- Win/Loss Summary -->
  <div class="card"><h2>📊 Win/Loss Analysis</h2>
  ${renderWinLoss()}</div>`;
}

function renderWinLoss() {
  const pipes = ST.getAll('pipeline');
  const won = pipes.filter(p => ['win','ordered','delivered'].includes(p.status));
  const lost = pipes.filter(p => p.status === 'lost');
  const total = won.length + lost.length;
  
  if (total < 1) return '<div class="empty"><p>ยังไม่มีข้อมูล Win/Loss</p></div>';
  
  const winRate = total ? Math.round(won.length / total * 100) : 0;
  const wonAmt = won.reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const lostAmt = lost.reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  
  // Loss reasons
  const reasons = {};
  lost.forEach(p => {
    const r = p.lossReason || 'ไม่ระบุ';
    reasons[r] = (reasons[r]||0) + 1;
  });
  
  return `
  <div class="sr" style="margin-bottom:8px">
    <div class="sc"><div class="sn c2">${won.length}</div><div class="sl">✅ Win</div></div>
    <div class="sc"><div class="sn c4">${lost.length}</div><div class="sl">❌ Lost</div></div>
    <div class="sc"><div class="sn ${winRate>=60?'c2':'c4'}">${winRate}%</div><div class="sl">Win Rate</div></div>
    <div class="sc"><div class="sn c2">${fmtMoneyShort(wonAmt)}</div><div class="sl">Won Value</div></div>
  </div>
  ${Object.keys(reasons).length ? `<div style="font-size:.78rem;color:#94a3b8;margin-bottom:4px">สาเหตุที่แพ้:</div>
  ${Object.entries(reasons).sort((a,b) => b[1]-a[1]).map(([r,c]) => `<div class="wl-reason"><span style="flex:1">${sanitize(r)}</span><span style="font-weight:700;color:#ef4444">${c} ครั้ง</span></div>`).join('')}` : ''}`;
}

// ================================================================
// SUMMARY (Weekly Auto-Report)
// ================================================================
function rSummary(el) {
  document.getElementById('pgT').textContent = '📊 สรุปสัปดาห์';
  const w = getWeekRange();
  el.innerHTML = `<div class="card"><h2>📊 สรุป ${fD(w.start)} — ${fD(w.end)}</h2>
  <div id="sumC">${genSummary(w.start, w.end)}</div>
  <div class="bg" style="margin-top:8px">
    <button class="btn bp" onclick="copySummary()">📋 Copy</button>
    <button class="btn bo" onclick="showDraftSummary()">📧 Draft Email</button>
    <button class="btn bo" onclick="customSummary()">📅 เลือกช่วง</button>
  </div></div>`;
}

function genSummary(from, to) {
  const cfg = getConfig();
  const kpi = getKPIData({start: from, end: to});
  const visits = ST.filter('visits', v => isInRange(v.date, from, to)).sort((a,b) => a.date.localeCompare(b.date));
  const fus = ST.filter('followups', f => isInRange(f.date, from, to));
  const mts = ST.filter('meetings', m => isInRange(m.date, from, to));
  const ps = getPipeSummary();
  const logs = [...ST.getAll('pipeLog'), ...ST.getAll('taskLogs')].filter(l => l.date && isInRange(l.date.split('T')[0], from, to));
  
  let txt = `📊 Weekly Report ${fD(from)} — ${fD(to)}\nSale: ${cfg.saleName}\n${'─'.repeat(35)}\n\n`;
  txt += `KPI:\n`;
  txt += `  📞 Follow-up: ${kpi.followup.current}/${kpi.followup.target} ${kpi.followup.current >= kpi.followup.target ? '✅' : '❌'}\n`;
  txt += `  🤝 Visit: ${kpi.visit.current}/${kpi.visit.target} ${kpi.visit.current >= kpi.visit.target ? '✅' : '❌'}\n`;
  txt += `  📊 Pipeline: ${kpi.pipeUpdated ? '✅ Updated' : '❌'}\n`;
  txt += `  📦 Forecast: ${kpi.fcUpdated ? '✅ Updated' : '❌'}\n\n`;
  
  txt += `Pipeline Summary:\n`;
  txt += `  Total: ${fmtMoney(ps.totalPipeline)} ฿\n`;
  txt += `  Won: ${fmtMoney(ps.totalWon)} ฿\n\n`;
  
  if (visits.length) {
    txt += `Visit (${visits.length}):\n`;
    visits.forEach(v => {
      const d = ST.getOne('dealers', v.dealerId);
      txt += `  ${fD(v.date)} ${v.mode==='offline'?'Onsite':'Online'} — ${d?.name||''}\n`;
    });
    txt += '\n';
  }
  
  if (fus.length) {
    txt += `Follow-up (${fus.length}):\n`;
    fus.forEach(f => {
      const d = ST.getOne('dealers', f.dealerId);
      txt += `  ${fD(f.date)} ${f.method||''} — ${d?.name||''}: ${f.summary?.substr(0,50)||''}\n`;
    });
    txt += '\n';
  }
  
  return `<div class="sum-copy" id="sumTxt">${txt}</div>`;
}

function copySummary() {
  const t = document.getElementById('sumTxt')?.textContent;
  if (t) copyText(t, '📋 Copy สรุปแล้ว!');
}

function showDraftSummary() {
  const cfg = getConfig();
  const body = document.getElementById('sumTxt')?.textContent || '';
  showDraft(
    'Weekly Report — ' + fD(_td()),
    `To: ${cfg.emailRecipients.visitPlan.join('; ')}`,
    body,
    cfg.emailRecipients.visitPlan
  );
}

function customSummary() {
  openM('📅 เลือกช่วง', `
    ${dpH('csf', addD(_td(), -7), 'จาก')}
    ${dpH('cst', _td(), 'ถึง')}
    <button class="btn bp btn-full" onclick="document.getElementById('sumC').innerHTML=genSummary(dpG('csf'),dpG('cst'));closeM()">📊 สรุป</button>
  `);
}

// ================================================================
// FOLLOW-UP LIST
// ================================================================
function rFollowup(el) {
  document.getElementById('pgT').textContent = '📞 Follow-up';
  const kpi = getKPIData();
  const fus = ST.sort('followups', (a,b) => (b.date||'').localeCompare(a.date||''));
  
  el.innerHTML = `
  <div class="card" style="padding:10px 14px"><div style="display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:.82rem">📞 สัปดาห์นี้: <b style="color:${kpi.followup.current>=kpi.followup.target?'#22c55e':'#ef4444'}">${kpi.followup.current}/${kpi.followup.target}</b> ราย</div>
    <button class="btn bp" onclick="showFollowupM()">➕ Follow-up</button>
  </div></div>
  ${fus.length ? fus.slice(0, 50).map(f => {
    const d = ST.getOne('dealers', f.dealerId);
    return `<div class="li"><div class="lm"><div class="lt">${d?.name||'?'} <span class="tag ${f.method==='line'?'tag-active':f.method==='call'?'tag-completed':f.method==='email'?'tag-a':'tag-count'}">${f.method||'?'}</span> ${levelTag(d?.level)}</div>
    <div class="ls">${fD(f.date)} • ${sanitize(f.summary?.substr(0,80)||'')}</div></div>
    <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('followups','${f.id}');render()">✕</button></div>`;
  }).join('') : '<div class="empty"><div class="icon">📞</div><p>ยังไม่มี</p></div>'}`;
}

// ================================================================
// FEEDBACK
// ================================================================
function rFeedback(el) {
  document.getElementById('pgT').textContent = '💡 Feedback รวม';
  const all = ST.sort('feedback', (a,b) => (b.date||'').localeCompare(a.date||''));
  
  el.innerHTML = `<div class="card"><h2>💡 Feedback ทุก Dealer (${all.length}) <span class="ml">
    <button class="btn bsm bo" onclick="copyAllFeedback()">📋 Copy</button>
    <button class="btn bsm bo" onclick="dlFeedbackCSV()">📤 CSV</button>
  </span></h2>
  ${all.length ? all.map(f => {
    const d = ST.getOne('dealers', f.dealerId);
    return `<div class="visit-sub"><div style="display:flex;justify-content:space-between"><b>${d?.name||'?'}</b><span style="font-size:.62rem;color:#64748b">${fD(f.date)} • ${f.source||''}</span></div>
    <div style="font-size:.74rem;margin-top:2px">${sanitize(f.text)}</div></div>`;
  }).join('') : emp('ยังไม่มี')}
  </div>`;
}

function copyAllFeedback() {
  const all = ST.sort('feedback', (a,b) => (b.date||'').localeCompare(a.date||''));
  let tsv = 'วันที่\tDealer\tFeedback\tSource\n';
  all.forEach(f => { const d = ST.getOne('dealers', f.dealerId); tsv += `${fD(f.date)}\t${d?.name||''}\t${f.text||''}\t${f.source||''}\n`; });
  copyText(tsv, '📋 Copy Feedback แล้ว!');
}

function dlFeedbackCSV() {
  const all = ST.sort('feedback', (a,b) => (b.date||'').localeCompare(a.date||''));
  let csv = '\uFEFF"วันที่","Dealer","Feedback","Source"\n';
  all.forEach(f => { const d = ST.getOne('dealers', f.dealerId); csv += `"${fD(f.date)}","${d?.name||''}","${esc(f.text)}","${f.source||''}"\n`; });
  dlBlob(csv, `feedback-${_td()}.csv`);
}

// ================================================================
// FORECAST (Enhanced v2)
// ================================================================
var fcStatusFilter = 'active';
var fcView = 'model';
var fcDealerFilter = 'all';
var fcDealerExpanded = {};

function rForecast(el) {
  document.getElementById('pgT').textContent = '📦 Forecast';
  var allPipes = ST.getAll('pipeline');
  var dealers = ST.getAll('dealers');
  
  // Status filter
  var pipes;
  if (fcStatusFilter === 'all') {
    pipes = allPipes;
  } else if (fcStatusFilter === 'won') {
    pipes = allPipes.filter(function(p) { return ['win','ordered','delivered'].indexOf(p.status) !== -1; });
  } else {
    pipes = allPipes.filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
  }
  
  // Dealer filter
  if (fcDealerFilter !== 'all') {
    pipes = pipes.filter(function(p) { return p.dealerId === fcDealerFilter; });
  }
  
  var totalFc = 0;
  var totalQty = 0;
  pipes.forEach(function(p) {
    totalFc += (Number(p.forecastAmount) || 0);
    totalQty += getPipeTotalQty(p);
  });

  // Group by model (support multi-model items)
  var byModel = {};
  pipes.forEach(function(p) {
    var items = getPipeItems(p);
    if (!items.length) return;
    items.forEach(function(it) {
      var model = it.model || 'ไม่ระบุ';
      if (!byModel[model]) byModel[model] = {model: model, qty: 0, amount: 0, projects: [], dealers: {}};
      byModel[model].qty += (Number(it.qty) || 1);
      byModel[model].amount += (Number(it.total) || (Number(it.qty) || 1) * (Number(it.price) || 0));
      // Add project if not already
      var found = false;
      for (var pi = 0; pi < byModel[model].projects.length; pi++) {
        if (byModel[model].projects[pi].id === p.id) { found = true; break; }
      }
      if (!found) byModel[model].projects.push(p);
      if (p.dealerId) {
        var dd = ST.getOne('dealers', p.dealerId);
        if (dd) byModel[model].dealers[dd.name] = true;
      }
    });
  });

  var modelList = Object.values(byModel).sort(function(a, b) { return b.amount - a.amount; });

  // Get dealers that have pipelines
  var dealerIds = {};
  allPipes.forEach(function(p) { if (p.dealerId) dealerIds[p.dealerId] = true; });
  var pipelineDealers = dealers.filter(function(d) { return dealerIds[d.id]; });

  var h = '';

  // Stats
  h += '<div class="sr">';
  h += '<div class="sc"><div class="sn c1">' + pipes.length + '</div><div class="sl">Projects</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(totalFc) + '</div><div class="sl">Forecast</div></div>';
  h += '<div class="sc"><div class="sn c5">' + totalQty + '</div><div class="sl">จำนวน (ชิ้น)</div></div>';
  h += '<div class="sc"><div class="sn c1">' + modelList.length + '</div><div class="sl">Models</div></div>';
  h += '</div>';

  // Toolbar
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">';
  
  // Status filter
  h += '<div style="display:flex;gap:4px">';
  h += '<button class="btn bsm ' + (fcStatusFilter === 'active' ? 'bp' : 'bo') + '" onclick="fcStatusFilter=\'active\';render()">⚡ Active</button>';
  h += '<button class="btn bsm ' + (fcStatusFilter === 'won' ? 'bp' : 'bo') + '" onclick="fcStatusFilter=\'won\';render()">🏆 Won</button>';
  h += '<button class="btn bsm ' + (fcStatusFilter === 'all' ? 'bp' : 'bo') + '" onclick="fcStatusFilter=\'all\';render()">📊 ทั้งหมด</button>';
  h += '</div>';
  
  // Dealer filter
  h += '<select id="fcDealerSel" onchange="fcDealerFilter=this.value;render()" style="min-width:140px;padding:5px 10px;font-size:12px">';
  h += '<option value="all"' + (fcDealerFilter === 'all' ? ' selected' : '') + '>🏪 ทุก Dealer</option>';
  pipelineDealers.sort(function(a, b) { return a.name.localeCompare(b.name); });
  pipelineDealers.forEach(function(d) {
    var cnt = allPipes.filter(function(p) { return p.dealerId === d.id; }).length;
    h += '<option value="' + d.id + '"' + (fcDealerFilter === d.id ? ' selected' : '') + '>' + sanitize(d.name) + ' (' + cnt + ')</option>';
  });
  h += '</select>';
  
  h += '<div style="flex:1"></div>';
  
  // View toggle
  h += '<div style="display:flex;gap:4px">';
  h += '<button class="btn bsm ' + (fcView === 'model' ? 'bp' : 'bo') + '" onclick="fcView=\'model\';render()">📦 Model</button>';
  h += '<button class="btn bsm ' + (fcView === 'monthly' ? 'bp' : 'bo') + '" onclick="fcView=\'monthly\';render()">📅 รายเดือน</button>';
  h += '<button class="btn bsm ' + (fcView === 'quarterly' ? 'bp' : 'bo') + '" onclick="fcView=\'quarterly\';render()">📊 รายไตรมาส</button>';
  h += '</div>';
  h += '</div>';

  // Current filter label
  if (fcDealerFilter !== 'all') {
    var selDealer = ST.getOne('dealers', fcDealerFilter);
    h += '<div style="text-align:center;margin-bottom:8px;font-size:13px">';
    h += '🏪 กำลังดู: <strong>' + (selDealer ? sanitize(selDealer.name) : '-') + '</strong>';
    h += ' <button class="btn-xs" onclick="fcDealerFilter=\'all\';render()">✕ ดูทั้งหมด</button>';
    h += '</div>';
  }

  // ✅ สรุปตามหมวดหมู่สินค้า (Drone/Software/Payload...) + ตัวเลือกค่าประมาณ
  var _fcYear = new Date().getFullYear();
  h += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
  h += '<h3 style="margin:0">📦 สรุปตามหมวดหมู่ — ' + _fcYear + '</h3>';
  h += fcTentativeToggleHtml();
  h += '</div>';
  h += fcCategorySummaryHtml(pipes, _fcYear);
  if (fcView === 'monthly' || fcView === 'quarterly') h += fcLegendHtml();
  h += '</div>';

  // Views
  if (fcView === 'monthly') {
    h += buildFcMonthly(pipes, dealers);
  } else if (fcView === 'quarterly') {
    h += buildFcQuarterly(pipes, dealers);
  } else {
    h += buildFcModel(modelList, totalFc);
  }

  // Dealer Summary (only show when viewing all dealers)
  if (fcDealerFilter === 'all') {
    h += buildFcDealerSummary(pipes, dealers);
  }

  // Bar Chart
  h += buildFcBarChart(modelList);

  el.innerHTML = h;
}

// ================================================================
// MODEL VIEW
// ================================================================
function buildFcModel(modelList, totalFc) {
  var h = '<div class="card"><h2>📦 Forecast ตาม Model';
  h += '<span class="ml"><button class="btn bsm bo" onclick="copyTable(\'fcTable\')">📋</button>';
  h += '<button class="btn bsm bo" onclick="dlTableCSV(\'fcTable\',\'forecast\')">📤</button></span></h2>';
  h += '<div class="export-wrap"><table class="export-table" id="fcTable">';
  h += '<thead><tr><th>#</th><th>Model</th><th style="text-align:center">QTY</th><th style="text-align:right">มูลค่ารวม (฿)</th><th>Dealer</th><th>โครงการ</th></tr></thead>';
  h += '<tbody>';

  modelList.forEach(function(m, idx) {
    var dealerNames = Object.keys(m.dealers).join(', ');
    var projNames = m.projects.map(function(p) { return sanitize((p.projectName || '').substr(0, 20)); }).join(', ');
    
    h += '<tr>';
    h += '<td class="pipe-row-num">' + (idx + 1) + '</td>';
    h += '<td><strong>' + sanitize(m.model) + '</strong></td>';
    h += '<td style="text-align:center">' + m.qty + '</td>';
    h += '<td style="text-align:right">' + fmtMoneyStyled(m.amount) + '</td>';
    h += '<td style="font-size:.68rem">' + sanitize(dealerNames) + '</td>';
    h += '<td style="font-size:.64rem">' + projNames + '</td>';
    h += '</tr>';
  });

  h += '<tr style="font-weight:700;border-top:2px solid #475569">';
  h += '<td></td><td>รวม</td><td></td>';
  h += '<td style="text-align:right">' + fmtMoneyStyled(totalFc) + '</td>';
  h += '<td></td><td></td></tr>';
  h += '</tbody></table></div></div>';
  return h;
}

// ================================================================
// MONTHLY VIEW
// ================================================================
function buildFcMonthly(pipes, dealers) {
  var now = new Date();
  var year = now.getFullYear();
  var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  
  var models = {};
  var monthTotals = {};
  for (var mi = 0; mi < 12; mi++) monthTotals[mi] = {qty: 0, amt: 0};

  pipes.forEach(function(p) {
    var _ship = getPipeShipDate(p);
    if (!_ship) return;
    if (fcHideTentative && _ship.est) return;
    var shipDate = _ship.date;
    var _est = _ship.est;
    if (shipDate.getFullYear() !== year) return;
    var m = shipDate.getMonth();
    
    var items = getPipeItems(p);
    if (!items.length) return;
    
    items.forEach(function(it) {
      var model = it.model || 'ไม่ระบุ';
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));
      
      if (!models[model]) {
        models[model] = {};
        for (var i = 0; i < 12; i++) models[model][i] = {qty: 0, amt: 0, projects: []};
      }
      
      models[model][m].qty += qty;
      models[model][m].amt += amt;
      if (_est) models[model][m].est = true;  // ช่องนี้มีค่าประมาณ

      var found = false;
      for (var pi = 0; pi < models[model][m].projects.length; pi++) {
        if (models[model][m].projects[pi].id === p.id) { found = true; break; }
      }
      if (!found) models[model][m].projects.push(p);

      monthTotals[m].qty += qty;
      monthTotals[m].amt += amt;
    });
  });

  var modelNames = Object.keys(models).sort();

  var h = '<div class="card"><h2>📅 Forecast รายเดือน — ' + year;
  h += '<span class="ml"><button class="btn bsm bo" onclick="copyTable(\'fcMonthTable\')">📋</button>';
  h += '<button class="btn bsm bo" onclick="dlTableCSV(\'fcMonthTable\',\'forecast-monthly\')">📤</button></span></h2>';
  
  if (!modelNames.length) {
    h += '<div class="empty"><p>ไม่มีข้อมูล (ต้องมี Shipment Date หรือ Bidding Date ในรายการ Pipeline)</p></div></div>';
    return h;
  }

  h += '<div class="export-wrap" style="overflow-x:auto"><table class="export-table" id="fcMonthTable">';
  h += '<thead><tr><th>Model</th>';
  for (var mh = 0; mh < 12; mh++) {
    var isCurrentMonth = mh === now.getMonth();
    h += '<th style="text-align:center;min-width:60px' + (isCurrentMonth ? ';background:rgba(59,130,246,0.15)' : '') + '">' + months[mh] + '</th>';
  }
  h += '<th style="text-align:right">รวม</th></tr></thead>';
  h += '<tbody>';

  modelNames.forEach(function(model) {
    var totalQty = 0;
    var totalAmt = 0;
    h += '<tr>';
    h += '<td><strong>' + sanitize(model) + '</strong></td>';
    for (var mc = 0; mc < 12; mc++) {
      var cell = models[model][mc];
      var isCurrentMonth = mc === now.getMonth();
      var bgStyle = isCurrentMonth ? 'background:rgba(59,130,246,0.08);' : '';
      if (cell.qty > 0) {
        totalQty += cell.qty;
        totalAmt += cell.amt;
        var tooltip = cell.projects.map(function(pp) { return (pp.projectName || '').substr(0, 25); }).join('\n');
        var _es = cell.est ? 'opacity:0.5;' : '';
        var _em = cell.est ? '~' : '';
        h += '<td style="text-align:center;' + bgStyle + _es + '" title="' + sanitize(tooltip) + (cell.est ? ' (ประมาณจาก Bidding + 2 เดือน)' : '') + '">';
        h += '<div style="font-weight:700">' + _em + cell.qty + '</div>';
        h += '<div style="font-size:.58rem;color:var(--text2)">' + fmtMoneyShort(cell.amt) + '</div>';
        h += '</td>';
      } else {
        h += '<td style="text-align:center;color:var(--text2);' + bgStyle + '">-</td>';
      }
    }
    h += '<td style="text-align:right;font-weight:700">' + totalQty + '<div style="font-size:.6rem">' + fmtMoneyShort(totalAmt) + '</div></td>';
    h += '</tr>';
  });

  h += '<tr style="font-weight:700;border-top:2px solid #475569">';
  h += '<td>รวม</td>';
  var grandTotal = 0;
  for (var mt = 0; mt < 12; mt++) {
    var isCurrentMonth = mt === now.getMonth();
    var bgStyle = isCurrentMonth ? 'background:rgba(59,130,246,0.08);' : '';
    grandTotal += monthTotals[mt].amt;
    if (monthTotals[mt].qty > 0) {
      h += '<td style="text-align:center;' + bgStyle + '">' + monthTotals[mt].qty + '<div style="font-size:.6rem">' + fmtMoneyShort(monthTotals[mt].amt) + '</div></td>';
    } else {
      h += '<td style="text-align:center;' + bgStyle + '">-</td>';
    }
  }
  h += '<td style="text-align:right">' + fmtMoneyShort(grandTotal) + '</td>';
  h += '</tr>';

  h += '</tbody></table></div></div>';
  return h;
}

// ================================================================
// QUARTERLY VIEW
// ================================================================
function buildFcQuarterly(pipes, dealers) {
  var now = new Date();
  var year = now.getFullYear();
  var qLabels = ['Q1 (ม.ค.-มี.ค.)', 'Q2 (เม.ย.-มิ.ย.)', 'Q3 (ก.ค.-ก.ย.)', 'Q4 (ต.ค.-ธ.ค.)'];
  
  var models = {};
  var qTotals = [{qty:0,amt:0},{qty:0,amt:0},{qty:0,amt:0},{qty:0,amt:0}];

  pipes.forEach(function(p) {
    var _ship = getPipeShipDate(p);
    if (!_ship) return;
    if (fcHideTentative && _ship.est) return;
    var shipDate = _ship.date;
    var _est = _ship.est;
    if (shipDate.getFullYear() !== year) return;
    var q = Math.floor(shipDate.getMonth() / 3);
    
    var items = getPipeItems(p);
    if (!items.length) return;
    
    items.forEach(function(it) {
      var model = it.model || 'ไม่ระบุ';
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));
      
      if (!models[model]) {
        models[model] = [{qty:0,amt:0,projects:[]},{qty:0,amt:0,projects:[]},{qty:0,amt:0,projects:[]},{qty:0,amt:0,projects:[]}];
      }
      
      models[model][q].qty += qty;
      models[model][q].amt += amt;
      if (_est) models[model][q].est = true;  // ไตรมาสนี้มีค่าประมาณ

      var found = false;
      for (var pi = 0; pi < models[model][q].projects.length; pi++) {
        if (models[model][q].projects[pi].id === p.id) { found = true; break; }
      }
      if (!found) models[model][q].projects.push(p);
      
      qTotals[q].qty += qty;
      qTotals[q].amt += amt;
    });
  });

  var modelNames = Object.keys(models).sort();
  var currentQ = Math.floor(now.getMonth() / 3);

  var h = '<div class="card"><h2>📊 Forecast รายไตรมาส — ' + year;
  h += '<span class="ml"><button class="btn bsm bo" onclick="copyTable(\'fcQTable\')">📋</button>';
  h += '<button class="btn bsm bo" onclick="dlTableCSV(\'fcQTable\',\'forecast-quarterly\')">📤</button></span></h2>';

  if (!modelNames.length) {
    h += '<div class="empty"><p>ไม่มีข้อมูล (ต้องมี Shipment Date หรือ Bidding Date ในรายการ Pipeline)</p></div></div>';
    return h;
  }

  h += '<div class="export-wrap"><table class="export-table" id="fcQTable">';
  h += '<thead><tr><th>Model</th>';
  for (var qh = 0; qh < 4; qh++) {
    var isCurrentQ = qh === currentQ;
    h += '<th style="text-align:center;min-width:100px' + (isCurrentQ ? ';background:rgba(59,130,246,0.15)' : '') + '">' + qLabels[qh] + '</th>';
  }
  h += '<th style="text-align:right">รวม</th></tr></thead>';
  h += '<tbody>';

  modelNames.forEach(function(model) {
    var totalQty = 0;
    var totalAmt = 0;
    h += '<tr>';
    h += '<td><strong>' + sanitize(model) + '</strong></td>';
    for (var qc = 0; qc < 4; qc++) {
      var cell = models[model][qc];
      var isCurrentQ = qc === currentQ;
      var bgStyle = isCurrentQ ? 'background:rgba(59,130,246,0.08);' : '';
      if (cell.qty > 0) {
        totalQty += cell.qty;
        totalAmt += cell.amt;
        var dealerSet = {};
        cell.projects.forEach(function(pp) {
          if (pp.dealerId) {
            var dd = ST.getOne('dealers', pp.dealerId);
            if (dd) dealerSet[dd.name] = true;
          }
        });
        var tooltip = cell.projects.map(function(pp) { return (pp.projectName || '').substr(0, 25); }).join('\n');
        var _es = cell.est ? 'opacity:0.5;' : '';
        var _em = cell.est ? '~' : '';
        h += '<td style="text-align:center;' + bgStyle + _es + '" title="' + sanitize(tooltip) + (cell.est ? ' (ประมาณจาก Bidding + 2 เดือน)' : '') + '">';
        h += '<div style="font-weight:700;font-size:1.1em">' + _em + cell.qty + '</div>';
        h += '<div style="font-size:.62rem">' + fmtMoneyStyled(cell.amt) + '</div>';
        h += '<div style="font-size:.56rem;color:var(--text2)">' + Object.keys(dealerSet).join(', ') + '</div>';
        h += '</td>';
      } else {
        h += '<td style="text-align:center;color:var(--text2);' + bgStyle + '">-</td>';
      }
    }
    h += '<td style="text-align:right;font-weight:700">' + totalQty + '<div style="font-size:.62rem">' + fmtMoneyShort(totalAmt) + '</div></td>';
    h += '</tr>';
  });

  h += '<tr style="font-weight:700;border-top:2px solid #475569">';
  h += '<td>รวม</td>';
  var grandTotal = 0;
  for (var qt = 0; qt < 4; qt++) {
    var isCurrentQ = qt === currentQ;
    var bgStyle = isCurrentQ ? 'background:rgba(59,130,246,0.08);' : '';
    grandTotal += qTotals[qt].amt;
    h += '<td style="text-align:center;' + bgStyle + '">';
    h += '<div>' + qTotals[qt].qty + '</div>';
    h += '<div style="font-size:.62rem">' + fmtMoneyShort(qTotals[qt].amt) + '</div>';
    h += '</td>';
  }
  h += '<td style="text-align:right">' + fmtMoneyShort(grandTotal) + '</td>';
  h += '</tr>';

  h += '</tbody></table></div></div>';
  return h;
}

// ================================================================
// DEALER SUMMARY (Expandable Cards)
// ================================================================
var fcDealerExpanded = {};

function buildFcDealerSummary(pipes, dealers) {
  var dealerData = [];
  dealers.forEach(function(d) {
    var dPipes = pipes.filter(function(p) { return p.dealerId === d.id; });
    if (!dPipes.length) return;
    var dAmt = 0;
    var dTotalQty = 0;
    var dModels = {};
    dPipes.forEach(function(p) {
      dAmt += (Number(p.forecastAmount) || 0);
      var items = getPipeItems(p);
      items.forEach(function(it) {
        var qty = Number(it.qty) || 1;
        dTotalQty += qty;
        var model = it.model || 'ไม่ระบุ';
        if (!dModels[model]) dModels[model] = 0;
        dModels[model] += qty;
      });
      if (!items.length) dTotalQty += (Number(p.modelQty) || 1);
    });
    dealerData.push({dealer: d, pipes: dPipes, amount: dAmt, totalQty: dTotalQty, models: dModels});
  });

  dealerData.sort(function(a, b) { return b.amount - a.amount; });

  if (!dealerData.length) return '';

  var h = '<div class="card"><h2>🏪 Forecast ตาม Dealer (' + dealerData.length + ')</h2>';

  dealerData.forEach(function(dd, idx) {
    var isOpen = fcDealerExpanded[dd.dealer.id] === true;
    var modelSummary = Object.keys(dd.models).map(function(m) {
      return m + ' x' + dd.models[m];
    }).join(', ');

    h += '<div class="fcd-card' + (isOpen ? ' fcd-open' : '') + '">';
    h += '<div class="fcd-header" onclick="toggleFcDealer(\'' + dd.dealer.id + '\')">';
    
    h += '<div class="fcd-top">';
    h += '<div class="fcd-name">';
    h += '<span class="pipe-row-num">#' + (idx + 1) + '</span> ';
    h += sanitize(dd.dealer.name) + ' ' + levelTag(dd.dealer.level);
    h += '</div>';
    h += '<div class="fcd-toggle">' + (isOpen ? '▲' : '▼') + '</div>';
    h += '</div>';

    h += '<div class="fcd-stats">';
    h += '<span class="fcd-stat">' + fmtMoneyStyled(dd.amount) + '</span>';
    h += '<span class="fcd-stat">📦 ' + dd.totalQty + ' ชิ้น</span>';
    h += '<span class="fcd-stat">📊 ' + dd.pipes.length + ' โครงการ</span>';
    h += '</div>';

    h += '<div class="fcd-models">📦 ' + sanitize(modelSummary) + '</div>';
    h += '</div>';

    if (isOpen) {
      var dByModel = {};
      dd.pipes.forEach(function(p) {
        var items = getPipeItems(p);
        items.forEach(function(it) {
          var model = it.model || 'ไม่ระบุ';
          var qty = Number(it.qty) || 1;
          var amt = Number(it.total) || (qty * (Number(it.price) || 0));
          if (!dByModel[model]) dByModel[model] = {model: model, qty: 0, amt: 0, projects: []};
          dByModel[model].qty += qty;
          dByModel[model].amt += amt;
          var found = false;
          for (var fi = 0; fi < dByModel[model].projects.length; fi++) {
            if (dByModel[model].projects[fi].id === p.id) { found = true; break; }
          }
          if (!found) dByModel[model].projects.push(p);
        });
      });
      var dModelList = Object.values(dByModel).sort(function(a, b) { return b.amt - a.amt; });

      h += '<div class="fcd-detail">';

      var maxAmt = dModelList.length > 0 ? dModelList[0].amt || 1 : 1;
      h += '<div class="fcd-mini-chart">';
      dModelList.forEach(function(m) {
        var pct = Math.max(8, Math.round(m.amt / maxAmt * 100));
        h += '<div class="fcd-bar-row">';
        h += '<div class="fcd-bar-label">' + sanitize(m.model) + ' <span style="color:var(--text2)">x' + m.qty + '</span></div>';
        h += '<div class="fcd-bar-track"><div class="fcd-bar-fill" style="width:' + pct + '%">' + fmtMoneyShort(m.amt) + '</div></div>';
        h += '</div>';
      });
      h += '</div>';

      h += '<table class="fcd-table">';
      h += '<thead><tr><th>#</th><th>Project</th><th>Model</th><th style="text-align:center">QTY</th><th style="text-align:right">มูลค่า</th><th>Ship</th><th>Status</th></tr></thead>';
      h += '<tbody>';
      
      dd.pipes.sort(function(a, b) { return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); });
      
      dd.pipes.forEach(function(p, pi) {
        var items = getPipeItems(p);
        var modelText = items.map(function(it) { return sanitize(it.model || '-') + (it.qty > 1 ? ' x' + it.qty : ''); }).join(', ');
        var totalPipeQty = getPipeTotalQty(p);
        
        h += '<tr onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer">';
        h += '<td class="pipe-row-num">' + (pi + 1) + '</td>';
        h += '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis">' + sanitize((p.projectName || '').substr(0, 30)) + '</td>';
        h += '<td style="font-size:.68rem">' + modelText + '</td>';
        h += '<td style="text-align:center">' + totalPipeQty + '</td>';
        h += '<td style="text-align:right">' + fmtMoneyStyled(p.forecastAmount) + '</td>';
        h += '<td>' + (p.shipmentDate ? fDShort(p.shipmentDate) : '-') + '</td>';
        h += '<td>' + pipeTag(p.status) + '</td>';
        h += '</tr>';
      });

      h += '<tr style="font-weight:700;border-top:2px solid var(--border)">';
      h += '<td></td><td>รวม</td><td></td>';
      h += '<td style="text-align:center">' + dd.totalQty + '</td>';
      h += '<td style="text-align:right">' + fmtMoneyStyled(dd.amount) + '</td>';
      h += '<td></td><td></td></tr>';
      h += '</tbody></table>';

      h += '<div style="margin-top:6px;text-align:right">';
      h += '<button class="btn bsm bo" onclick="event.stopPropagation();go(\'dealerDetail\',{dealerId:\'' + dd.dealer.id + '\'})">🏪 ดู Dealer →</button>';
      h += '</div>';

      h += '</div>';
    }

    h += '</div>';
  });

  h += '</div>';
  return h;
}

function toggleFcDealer(dealerId) {
  if (fcDealerExpanded[dealerId]) {
    delete fcDealerExpanded[dealerId];
  } else {
    fcDealerExpanded[dealerId] = true;
  }
  render();
}
// ================================================================
// BAR CHART (Value + QTY)
// ================================================================
function buildFcBarChart(modelList) {
  if (!modelList.length) return '';
  var maxAmt = modelList[0].amount || 1;
  var maxQty = 1;
  modelList.forEach(function(m) { if (m.qty > maxQty) maxQty = m.qty; });

  var h = '<div class="card"><h2>📊 Forecast Chart</h2>';

  // Value chart
  h += '<div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--text2)">💰 มูลค่า</div>';
  h += '<div class="fc-chart">';
  modelList.slice(0, 10).forEach(function(m) {
    var pct = Math.max(8, Math.round(m.amount / maxAmt * 100));
    h += '<div class="fc-chart-row">';
    h += '<div class="fc-chart-label">' + sanitize(m.model) + '</div>';
    h += '<div class="fc-chart-track"><div class="fc-chart-fill" style="width:' + pct + '%">' + fmtMoneyShort(m.amount) + '</div></div>';
    h += '</div>';
  });
  h += '</div>';

  // QTY chart
  h += '<div style="font-size:12px;font-weight:700;margin:12px 0 6px;color:var(--text2)">📦 จำนวน (ชิ้น)</div>';
  h += '<div class="fc-chart">';
  modelList.slice(0, 10).forEach(function(m) {
    var pct = Math.max(8, Math.round(m.qty / maxQty * 100));
    h += '<div class="fc-chart-row">';
    h += '<div class="fc-chart-label">' + sanitize(m.model) + ' <span style="color:var(--text2)">x' + m.qty + '</span></div>';
    h += '<div class="fc-chart-track"><div class="fc-chart-fill fc-chart-fill-qty" style="width:' + pct + '%">x' + m.qty + '</div></div>';
    h += '</div>';
  });
  h += '</div>';

  h += '</div>';
  return h;
}
// ================================================================
// KNOWLEDGE BASE (Enhanced)
// ================================================================
var noteFilter = 'all';
var noteStatusFilter = 'active';
var noteSearch = '';

function rKnowledge(el) {
  document.getElementById('pgT').textContent = '📚 Knowledge Base';
  var cfg = getConfig();
  var cats = cfg.noteCategories || [];
  var allNotes = ST.getAll('notes');
  var notes = allNotes.slice();
  
  // Filter by status
  if (noteStatusFilter !== 'all') {
    notes = notes.filter(function(n) { return (n.status || 'active') === noteStatusFilter; });
  }
  
  // Filter by category
  if (noteFilter !== 'all') {
    notes = notes.filter(function(n) { return n.category === noteFilter; });
  }
  
  // Search
  if (noteSearch) {
    var q = noteSearch.toLowerCase();
    notes = notes.filter(function(n) {
      return (n.title || '').toLowerCase().indexOf(q) !== -1 ||
             (n.content || '').toLowerCase().indexOf(q) !== -1 ||
             (n.tags || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  
  // Sort: pinned first, then by date
  notes.sort(function(a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.created || '').localeCompare(a.created || '');
  });
  
  // Count per category
  var catCounts = {};
  for (var i = 0; i < allNotes.length; i++) {
    var cat = allNotes[i].category || '📌 อื่นๆ';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  
  // Count per status
  var statusCounts = {active: 0, expired: 0, cancelled: 0, draft: 0};
  for (var i = 0; i < allNotes.length; i++) {
    var st = allNotes[i].status || 'active';
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  }
  
  // Check for expired/remind
  var expiredNotes = allNotes.filter(function(n) {
    return (n.status || 'active') === 'active' && n.expireDate && dTo(n.expireDate) <= 0;
  });
  var remindNotes = allNotes.filter(function(n) {
    return (n.status || 'active') === 'active' && n.remindDate && dTo(n.remindDate) <= 3 && dTo(n.remindDate) >= 0;
  });

  el.innerHTML = '' +
    // Alerts
    (expiredNotes.length ? '<div class="card" style="border-color:#ef4444"><h2 style="color:#ef4444">⏰ Note หมดอายุ (' + expiredNotes.length + ')</h2>' +
    expiredNotes.map(function(n) {
      return '<div class="li dlo" onclick="go(\'noteDetail\',{noteId:\'' + n.id + '\'})">' +
        '<div class="lm"><div class="lt">⏰ ' + sanitize(n.title) + '</div>' +
        '<div class="ls">หมดอายุ: ' + fD(n.expireDate) + ' ' + dlB(n.expireDate, false) + '</div></div>' +
        '<button class="btn bsm bw" onclick="event.stopPropagation();markNoteExpired(\'' + n.id + '\')">ทำเครื่องหมาย</button></div>';
    }).join('') + '</div>' : '') +
    
    (remindNotes.length ? '<div class="card" style="border-color:#f59e0b"><h2 style="color:#f59e0b">🔔 เตือน Note (' + remindNotes.length + ')</h2>' +
    remindNotes.map(function(n) {
      return '<div class="li dl3" onclick="go(\'noteDetail\',{noteId:\'' + n.id + '\'})">' +
        '<div class="lm"><div class="lt">🔔 ' + sanitize(n.title) + '</div>' +
        '<div class="ls">เตือน: ' + fD(n.remindDate) + ' ' + dlB(n.remindDate, false) + '</div></div></div>';
    }).join('') + '</div>' : '') +
    
    // Toolbar
    '<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap">' +
    '<button class="btn bp" onclick="showNoteM()">➕ เพิ่ม Note</button>' +
    '</div>' +
    
    // Search
    '<div style="margin-bottom:8px">' +
    '<input type="text" id="noteSrc" value="' + sanitize(noteSearch) + '" placeholder="🔍 ค้นหา Note... (ชื่อ, เนื้อหา, Tags)" oninput="noteSearch=this.value;render()" autocomplete="off">' +
    '</div>' +
    
    // Status Filter
    '<div class="ftabs" style="margin-bottom:4px">' +
    '<div class="ftab ' + (noteStatusFilter === 'all' ? 'act' : '') + '" onclick="noteStatusFilter=\'all\';render()">ทั้งหมด (' + allNotes.length + ')</div>' +
    '<div class="ftab ' + (noteStatusFilter === 'active' ? 'act' : '') + '" onclick="noteStatusFilter=\'active\';render()">✅ ใช้งาน (' + statusCounts.active + ')</div>' +
    '<div class="ftab ' + (noteStatusFilter === 'expired' ? 'act' : '') + '" onclick="noteStatusFilter=\'expired\';render()">⏰ หมดอายุ (' + statusCounts.expired + ')</div>' +
    '<div class="ftab ' + (noteStatusFilter === 'cancelled' ? 'act' : '') + '" onclick="noteStatusFilter=\'cancelled\';render()">❌ ยกเลิก (' + statusCounts.cancelled + ')</div>' +
    '<div class="ftab ' + (noteStatusFilter === 'draft' ? 'act' : '') + '" onclick="noteStatusFilter=\'draft\';render()">📝 Draft (' + statusCounts.draft + ')</div>' +
    '</div>' +
    
    // Category Filter
    '<div class="ftabs">' +
    '<div class="ftab ' + (noteFilter === 'all' ? 'act' : '') + '" onclick="noteFilter=\'all\';render()">ทุกหมวด</div>' +
    cats.map(function(cat) {
      return '<div class="ftab ' + (noteFilter === cat ? 'act' : '') + '" onclick="noteFilter=\'' + cat.replace(/'/g, "\\'") + '\';render()">' + cat + ' (' + (catCounts[cat] || 0) + ')</div>';
    }).join('') +
    '</div>' +
    
    // Notes List
    '<div>' +
    (notes.length ? notes.map(function(n) { return noteCardHTML(n); }).join('') :
    '<div class="empty"><div class="icon">📚</div><p>ไม่มี Note' +
    (noteSearch ? ' ที่ตรงกับ "' + sanitize(noteSearch) + '"' : '') + '</p></div>') +
    '</div>';
  
  // Focus search
  if (noteSearch) {
    var srcEl = document.getElementById('noteSrc');
    if (srcEl) { srcEl.focus(); srcEl.setSelectionRange(noteSearch.length, noteSearch.length); }
  }
}

function noteCardHTML(n) {
  var catClass = 'note-cat-other';
  if ((n.category || '').indexOf('Policy') !== -1) catClass = 'note-cat-policy';
  else if ((n.category || '').indexOf('Product') !== -1) catClass = 'note-cat-product';
  else if ((n.category || '').indexOf('SOP') !== -1) catClass = 'note-cat-sop';
  else if ((n.category || '').indexOf('Meeting') !== -1) catClass = 'note-cat-meeting';
  
  var tags = (n.tags || '').split(',').filter(function(t) { return t.trim(); });
  var status = n.status || 'active';
  var isInactive = status === 'expired' || status === 'cancelled';
  var dealer = n.dealerId ? ST.getOne('dealers', n.dealerId) : null;
  
  // Status badge
  var statusBadge = '';
  if (status === 'expired') statusBadge = '<span class="tag tag-cancelled">⏰ หมดอายุ</span>';
  else if (status === 'cancelled') statusBadge = '<span class="tag tag-cancelled">❌ ยกเลิก</span>';
  else if (status === 'draft') statusBadge = '<span class="tag tag-on-hold">📝 Draft</span>';
  
  return '<div class="note-card ' + (n.pinned ? 'pinned' : '') + '" onclick="go(\'noteDetail\',{noteId:\'' + n.id + '\'})" style="' + (isInactive ? 'opacity:.5;' : '') + '">' +
    '<h3>' + (n.pinned ? '📌 ' : '') + sanitize(n.title || 'ไม่มีชื่อ') + ' ' + statusBadge + '</h3>' +
    '<div class="note-meta">' +
    '<span class="note-cat-badge ' + catClass + '">' + (n.category || 'อื่นๆ') + '</span>' +
    '<span>' + fD(n.created ? n.created.split('T')[0] : '') + '</span>' +
    (dealer ? '<span>🏪 ' + dealer.name + '</span>' : '') +
    (n.expireDate ? '<span>' + (dTo(n.expireDate) <= 0 ? '⏰ หมดอายุ ' : '📅 หมดอายุ ') + fDShort(n.expireDate) + '</span>' : '') +
    (n.remindDate && dTo(n.remindDate) <= 3 && dTo(n.remindDate) >= 0 ? '<span style="color:#f59e0b">🔔 เตือน ' + fDShort(n.remindDate) + '</span>' : '') +
    '</div>' +
    '<div class="note-preview">' + sanitize((n.content || '').substr(0, 120)) + '</div>' +
    (tags.length ? '<div class="note-tags">' + tags.map(function(t) { return '<span class="note-tag">' + sanitize(t.trim()) + '</span>'; }).join('') + '</div>' : '') +
    '</div>';
}

function markNoteExpired(noteId) {
  ST.update('notes', noteId, {status: 'expired'});
  toast('⏰ ทำเครื่องหมายหมดอายุแล้ว');
  render();
}

// ================================================================
// NOTE DETAIL (Enhanced)
// ================================================================
function rNoteDet(el) {
  var n = ST.getOne('notes', S.noteId);
  if (!n) return go('knowledge');
  document.getElementById('pgT').textContent = '📚 ' + (n.title || '').substr(0, 25);
  
  var tags = (n.tags || '').split(',').filter(function(t) { return t.trim(); });
  var catClass = 'note-cat-other';
  if ((n.category || '').indexOf('Policy') !== -1) catClass = 'note-cat-policy';
  else if ((n.category || '').indexOf('Product') !== -1) catClass = 'note-cat-product';
  else if ((n.category || '').indexOf('SOP') !== -1) catClass = 'note-cat-sop';
  else if ((n.category || '').indexOf('Meeting') !== -1) catClass = 'note-cat-meeting';
  
  var status = n.status || 'active';
  var dealer = n.dealerId ? ST.getOne('dealers', n.dealerId) : null;
  var isInactive = status === 'expired' || status === 'cancelled';
  
  // Status badge + action
  var statusBadge = '';
  var statusAction = '';
  if (status === 'active') {
    statusBadge = '<span class="tag tag-completed">✅ ใช้งานอยู่</span>';
    statusAction = '<button class="btn bsm bw" onclick="changeNoteStatus(\'' + n.id + '\',\'expired\')">⏰ หมดอายุ</button>' +
      '<button class="btn bsm bd" onclick="changeNoteStatus(\'' + n.id + '\',\'cancelled\')">❌ ยกเลิก</button>';
  } else if (status === 'expired') {
    statusBadge = '<span class="tag tag-cancelled">⏰ หมดอายุ</span>';
    statusAction = '<button class="btn bsm bs" onclick="changeNoteStatus(\'' + n.id + '\',\'active\')">✅ ใช้งานอีกครั้ง</button>';
  } else if (status === 'cancelled') {
    statusBadge = '<span class="tag tag-cancelled">❌ ยกเลิกแล้ว</span>';
    statusAction = '<button class="btn bsm bs" onclick="changeNoteStatus(\'' + n.id + '\',\'active\')">✅ ใช้งานอีกครั้ง</button>';
  } else if (status === 'draft') {
    statusBadge = '<span class="tag tag-on-hold">📝 Draft</span>';
    statusAction = '<button class="btn bsm bs" onclick="changeNoteStatus(\'' + n.id + '\',\'active\')">✅ เผยแพร่</button>';
  }

  el.innerHTML = '' +
    '<div class="bc"><a onclick="go(\'knowledge\')">📚 Knowledge Base</a><span class="sep">›</span><span class="cur">' + sanitize((n.title || '').substr(0, 35)) + '</span></div>' +
    
    // Header
    '<div class="card" style="' + (isInactive ? 'opacity:.6;' : '') + '">' +
    '<h2>' + sanitize(n.title || 'ไม่มีชื่อ') + ' ' + statusBadge + ' <span class="ml">' +
    '<button class="btn bsm ' + (n.pinned ? 'bw' : 'bo') + '" onclick="toggleNotePin(\'' + n.id + '\')">' + (n.pinned ? '📌' : '📌 Pin') + '</button>' +
    '<button class="btn bsm bo" onclick="copyNoteContent(\'' + n.id + '\')">📋</button>' +
    '<button class="btn bsm bo" onclick="showNoteM(\'' + n.id + '\')">✏️</button>' +
    '<button class="btn bsm bd" onclick="deleteNote(\'' + n.id + '\')">🗑️</button>' +
    '</span></h2>' +
    
    // Meta
    '<div class="note-meta" style="margin-bottom:10px">' +
    '<span class="note-cat-badge ' + catClass + '">' + (n.category || 'อื่นๆ') + '</span>' +
    '<span>สร้าง: ' + fDT(n.created) + '</span>' +
    (n.updated ? '<span>แก้ไข: ' + fDT(n.updated) + '</span>' : '') +
    (dealer ? '<span>🏪 ' + dealer.name + '</span>' : '') +
    '</div>' +
    
    // Dates
    (n.expireDate || n.remindDate ? '<div style="display:flex;gap:10px;margin-bottom:10px;font-size:.76rem">' +
    (n.expireDate ? '<span style="color:' + (dTo(n.expireDate) <= 0 ? '#ef4444' : '#94a3b8') + '">📅 หมดอายุ: ' + fD(n.expireDate) + ' ' + dlB(n.expireDate, false) + '</span>' : '') +
    (n.remindDate ? '<span style="color:' + (dTo(n.remindDate) <= 3 ? '#f59e0b' : '#94a3b8') + '">🔔 เตือน: ' + fD(n.remindDate) + ' ' + dlB(n.remindDate, false) + '</span>' : '') +
    '</div>' : '') +
    
    // Status Actions
    '<div class="bg" style="margin-bottom:10px">' + statusAction + '</div>' +
    
    // Tags
    (tags.length ? '<div class="note-tags" style="margin-bottom:10px">' + tags.map(function(t) { return '<span class="note-tag">' + sanitize(t.trim()) + '</span>'; }).join('') + '</div>' : '') +
    
    // Content
    '<div class="note-content">' + safeText(n.content || '') + '</div>' +
    
    // Links
    (n.links ? '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:8px"><div style="font-size:.76rem;color:var(--text2);margin-bottom:4px">🔗 Links:</div>' +
    n.links.split('\n').filter(function(l) { return l.trim(); }).map(function(l) {
      var url = l.trim();
      return '<div style="margin-bottom:2px"><a href="' + url + '" target="_blank" style="font-size:.76rem">' + url.substr(0, 60) + (url.length > 60 ? '...' : '') + ' ↗</a></div>';
    }).join('') + '</div>' : '') +
    
    '</div>';
}

function changeNoteStatus(noteId, newStatus) {
  var labels = {active: '✅ ใช้งาน', expired: '⏰ หมดอายุ', cancelled: '❌ ยกเลิก', draft: '📝 Draft'};
  ST.update('notes', noteId, {status: newStatus});
  toast(labels[newStatus] || newStatus);
  render();
}

function toggleNotePin(noteId) {
  var n = ST.getOne('notes', noteId);
  if (!n) return;
  ST.update('notes', noteId, {pinned: !n.pinned});
  toast(n.pinned ? '❌ เอาออกจากหมุด' : '📌 ปักหมุดแล้ว');
  render();
}

function copyNoteContent(noteId) {
  var n = ST.getOne('notes', noteId);
  if (!n) return;
  var text = (n.title || '') + '\n\n' + (n.content || '');
  if (n.links) text += '\n\nLinks:\n' + n.links;
  copyText(text, '📋 Copy เนื้อหาแล้ว');
}

function deleteNote(noteId) {
  if (!confirm('ลบ Note นี้?')) return;
  ST.delete('notes', noteId);
  toast('🗑️ ลบแล้ว');
  go('knowledge');
}