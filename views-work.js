// ================================================================
// TASKS
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

  <!-- Steps -->
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

  <!-- Logs -->
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

// Meeting Actions
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

// Get follow-up status text
function fuStatusTag(st) {
  if (st === 'received') return '<span class="tag tag-green">✅ ได้รับแล้ว</span>';
  if (st === 'overdue') return '<span class="tag tag-red">🔴 เกินกำหนด</span>';
  if (st === 'cancelled') return '<span class="tag tag-gray">⚫ ยกเลิก</span>';
  return '<span class="tag tag-yellow">⏳ รอตอบกลับ</span>';
}

// Check and auto-update overdue followups
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

function parseThaiDate(str) {
  if (!str) return null;
  var p = str.split('/');
  if (p.length !== 3) return null;
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
}

// Count active (waiting/overdue) followups
function countActiveFu(step) {
  if (!step.followups) return 0;
  return step.followups.filter(function (f) {
    return f.status === 'waiting' || f.status === 'overdue';
  }).length;
}

// Build follow-up timeline HTML for a step
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
    // Action buttons for waiting/overdue
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

// Build follow-up badge for step list
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

// ---- MODAL: Add Follow-up to Step ----
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

  // Quick action buttons
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

  // Also add to task log
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

// ---- Mark Follow-up as Received ----
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

// ---- Mark Follow-up as Cancelled ----
function markFuCancelled(taskId, stepIdx, fuIdx) {
  if (!confirm('ยกเลิกการติดตามนี้?')) return;
  var t = ST.getOne('tasks', taskId);
  if (!t || !t.steps[stepIdx] || !t.steps[stepIdx].followups[fuIdx]) return;

  t.steps[stepIdx].followups[fuIdx].status = 'cancelled';
  ST.update('tasks', taskId, { steps: t.steps });
  render();
}

// ---- Quick Follow-up Again (from existing overdue) ----
function quickFuAgain(taskId, stepIdx) {
  var t = ST.getOne('tasks', taskId);
  if (!t || !t.steps || !t.steps[stepIdx]) return;
  var step = t.steps[stepIdx];
  var lastFu = step.followups ? step.followups[step.followups.length - 1] : null;

  // Pre-fill with context from last followup
  showStepFuM(taskId, stepIdx);

  // After modal opens, fill note
  setTimeout(function () {
    var noteEl = document.getElementById('fuNote');
    if (noteEl && lastFu) {
      noteEl.value = 'ติดตามซ้ำ — ' + (lastFu.note || '').substring(0, 50);
    }
  }, 100);
}

// ---- Get all overdue followups across all tasks (for Today page) ----
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