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