// ================================================================
// VISIT LIST
// ================================================================
function rVisits(el) {
  document.getElementById('pgT').textContent = '🤝 Visit Report';
  let vts = ST.sort('visits', (a,b) => (b.date||'').localeCompare(a.date||''));
  
  if (S.filterDealer) {
    vts = vts.filter(v => v.dealerId === S.filterDealer);
    const fd = ST.getOne('dealers', S.filterDealer);
    if (fd) document.getElementById('pgT').textContent = '🤝 Visit — ' + fd.name;
  }
  if (visitFlt === 'offline') vts = vts.filter(v => v.mode === 'offline');
  else if (visitFlt === 'online') vts = vts.filter(v => v.mode === 'online');

  el.innerHTML = `
  <div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap">
    <button class="btn bp" onclick="showVisitM()">➕ Visit Report</button>
    <button class="btn bo" onclick="openVisitWindow(S.filterDealer||'')" title="เปิดเป็นแท็บแยก เต็มจอ มีสมุดโน้ตเร็วด้านขวา">🪟 เปิดแท็บแยก</button>
    <button class="btn bo" onclick="copyAllVisits()">📋 Copy</button>
    <button class="btn bo" onclick="dlAllVisitsCSV()">📤 CSV</button>
    ${S.filterDealer?`<button class="btn bo" onclick="go('visits')">✕ ล้าง Filter</button>`:''}
  </div>
  <div class="ftabs">
    <div class="ftab ${visitFlt==='all'?'act':''}" onclick="visitFlt='all';render()">ทั้งหมด (${ST.count('visits')})</div>
    <div class="ftab ${visitFlt==='offline'?'act':''}" onclick="visitFlt='offline';render()">🤝 Offline</div>
    <div class="ftab ${visitFlt==='online'?'act':''}" onclick="visitFlt='online';render()">📞 Online</div>
  </div>
  ${vts.length ? vts.slice(0,50).map(v => {
    const d = ST.getOne('dealers', v.dealerId);
    return `<div class="visit-item" onclick="go('visitDetail',{visitId:'${v.id}'})">
      <h4>${fD(v.date)} ${v.time||''} — ${sanitize(d?.name || v.company || (v.prospectId ? '🆕 Lead' : '?'))} ${modeTag(v.mode)} ${v.djiDealer?`<span class="tag tag-count">${v.djiDealer}</span>`:''}</h4>
      <div class="vmeta">${(v.topicData||[]).filter(t=>t.answered).map(t=>t.topicId).join(', ')||''}</div>
      <div class="vbody">${sanitize((v.summary||'').substr(0,180))}${(v.summary||'').length>180?'...':''}</div>
      ${v.revenue?`<div style="font-size:.68rem;color:#22c55e;margin-top:2px">💰 ${fmtMoney(v.revenue)}</div>`:''}
    </div>`;
  }).join('') : '<div class="empty"><div class="icon">🤝</div><p>ยังไม่มี Visit Report</p></div>'}`;
}

// ================================================================
// VISIT DETAIL
// ================================================================
function rVisitDet(el) {
  const v = ST.getOne('visits', S.visitId);
  if (!v) return go('visits');
  const d = ST.getOne('dealers', v.dealerId);
  const cfg = getConfig();
  document.getElementById('pgT').textContent = '🤝 ' + (d?.name||'') + ' — ' + fD(v.date);

  el.innerHTML = `
  <div class="bc"><a onclick="go('visits')">🤝 Visit</a><span class="sep">›</span>
  ${d?`<a onclick="go('dealerDetail',{dealerId:'${d.id}'})">${sanitize(d.name)}</a><span class="sep">›</span>`:''}
  <span class="cur">${fD(v.date)}</span></div>
  ${(typeof _sourceTaskBackLinkHtml === 'function') ? _sourceTaskBackLinkHtml(v.sourceTaskId) : ''}

  <div class="card"><h2>🤝 Visit Report <span class="ml">
    <button class="btn bsm bp" onclick="showVisitDraft('${v.id}')">📧 Draft Email</button>
    <button class="btn bsm bo" onclick="copyVisitRow('${v.id}')">📋 Copy Row</button>
    <button class="btn bsm bo" onclick="copyVisitSAP('${v.id}')">📄 SAP</button>
    <button class="btn bsm bo" onclick="showVisitM('${v.dealerId||''}','${v.id}')">✏️</button>
    <button class="btn bsm bd" onclick="ST.delete('visits','${v.id}');toast('🗑️');go('visits')">🗑️</button>
  </span></h2>
  
  <div class="fr"><div><label style="color:#64748b;font-size:.68rem">วันที่</label><div>${fD(v.date)}</div></div>
  <div><label style="color:#64748b;font-size:.68rem">เวลา</label><div>${v.time||'-'}</div></div></div>
  <div class="fr" style="margin-top:3px"><div><label style="color:#64748b;font-size:.68rem">${v.prospectId ? 'Lead' : 'Dealer'}</label><div>${d?.name || v.company || '-'} ${d?levelTag(d.level):''}</div></div>
  <div><label style="color:#64748b;font-size:.68rem">Mode</label><div>${modeTag(v.mode)}</div></div></div>
  <div class="fr" style="margin-top:3px"><div><label style="color:#64748b;font-size:.68rem">DJI Dealer</label><div>${v.djiDealer||'-'}</div></div>
  <div><label style="color:#64748b;font-size:.68rem">Sale</label><div>${v.saleName||cfg.saleName}</div></div></div>
  ${v.location?`<div style="margin-top:3px"><label style="color:#64748b;font-size:.68rem">📍 Location</label><div><a href="${v.location}" target="_blank">${v.location.substr(0,50)}... ↗</a></div></div>`:''}
  </div>

  <!-- Topic Details -->
  ${(v.topicData||[]).filter(t => t.answered).length ? `<div class="card"><h2>📋 หัวข้อที่คุย</h2>
  ${(v.topicData||[]).filter(t => t.answered).map(t => {
    const topic = cfg.visitTopics.find(vt => vt.id === t.topicId);
    const group = cfg.visitTopicGroups?.find(g => g.id === topic?.group);
    return `<div class="topic-card expanded">
      <div class="topic-hd"><div class="num" style="background:#22c55e;color:#fff">${topic?.group==='sales'?'📊':topic?.group==='projects'?'📁':topic?.group==='cert'?'📋':'💬'}</div>
      <div class="topic-title">${topic?.name||t.topicId}</div></div>
      <div class="topic-body" style="display:block">
        ${renderTopicDetail(t, v)}
      </div>
    </div>`;
  }).join('')}
  </div>` : ''}

  <!-- Revenue -->
  ${v.revenue||v.expectedRevenue?`<div class="card"><h2>💰 ยอดขาย</h2>
  <div class="fr"><div><label style="color:#64748b;font-size:.68rem">ยอดขายปัจจุบัน</label><div style="font-weight:700;color:#22c55e">${v.revenue?fmtMoney(v.revenue)+' ฿':'-'}</div></div>
  <div><label style="color:#64748b;font-size:.68rem">เป้าที่คาด</label><div style="font-weight:700;color:#f59e0b">${v.expectedRevenue?fmtMoney(v.expectedRevenue)+' ฿':'-'}</div></div></div>
  ${v.customerSegment?`<div style="margin-top:3px"><label style="color:#64748b;font-size:.68rem">กลุ่มลูกค้า</label><div>${sanitize(v.customerSegment)}</div></div>`:''}</div>`:''}

  <!-- General Summary -->
  ${v.summary?`<div class="card"><h2>📝 สรุปการคุย</h2><div style="white-space:pre-wrap;font-size:.78rem">${sanitize(v.summary)}</div></div>`:''}

  <!-- Pipeline Updates -->
  ${v.pipelineUpdates?.length?`<div class="card"><h2>📊 Pipeline ที่อัพเดต</h2>
  ${v.pipelineUpdates.map(pu => {
    const pipe = ST.getOne('pipeline', pu.pipeId);
    return `<div class="visit-sub" ${pipe?`onclick="go('pipeDetail',{pipeId:'${pipe.id}'})" style="cursor:pointer"`:''}>
      <div style="display:flex;justify-content:space-between"><b>${pipe?sanitize(pipe.projectName):sanitize(pu.name||'')}</b>${pipe?pipeTag(pipe.status):''}</div>
      <div style="font-size:.72rem;color:#94a3b8">${pu.model?'Model: '+pu.model:''} ${pu.newStatus?'→ '+getPipeName(pu.newStatus):''}</div>
      ${pu.note?`<div style="font-size:.72rem;color:#94a3b8">${sanitize(pu.note)}</div>`:''}
    </div>`;
  }).join('')}</div>`:''}

  <!-- Forecast -->
  ${v.forecastNotes?.length?`<div class="card"><h2>📦 Forecast QTY</h2>
  ${v.forecastNotes.map(fn => `<div class="visit-sub">
    <div style="display:flex;justify-content:space-between"><b>${sanitize(fn.month||'')}</b><span style="color:#22c55e">${fn.amount?fmtMoney(fn.amount)+' ฿':''}</span></div>
    ${fn.items?`<div style="font-size:.72rem;white-space:pre-wrap;color:#94a3b8">${sanitize(fn.items)}</div>`:''}
  </div>`).join('')}</div>`:''}

  <!-- Feedback -->
  ${v.feedbackItems?.length?`<div class="card"><h2>💡 Feedback</h2>
  ${v.feedbackItems.map((f,i) => `<div class="visit-sub">${i+1}. ${sanitize(f)}</div>`).join('')}</div>`:''}
  `;
}

function renderTopicDetail(t, v) {
  let html = '';
  if (t.summary) html += `<div style="font-size:.76rem;white-space:pre-wrap">${sanitize(t.summary)}</div>`;
  
  // Specific fields
  if (t.topicId === 'dsec' || t.topicId === 'fh2') {
    html += `<div style="font-size:.74rem;margin-top:3px">Status: <b>${t.status||'-'}</b> ${t.certCount ? '(' + t.certCount + ' ใบ)' : ''}</div>`;
  }
  if (t.topicId === 'crm' || t.topicId === 'lark') {
    html += `<div style="font-size:.74rem;margin-top:3px">Status: <b>${t.status||'-'}</b></div>`;
  }
  if (t.topicId === 'dock_projects') {
    html += `<div style="font-size:.74rem;margin-top:3px">Interest: <b>${v.dockInterest||t.interest||'-'}</b></div>`;
  }
  
  return html || '<div style="font-size:.74rem;color:#475569">ไม่มีรายละเอียดเพิ่มเติม</div>';
}

// ================================================================
// VISIT DRAFT EMAIL ⭐
// ================================================================
function showVisitDraft(visitId) {
  const v = ST.getOne('visits', visitId);
  if (!v) return;
  const d = ST.getOne('dealers', v.dealerId);
  const cfg = getConfig();
  
  const body = buildVisitUpdateText(v);
  const subject = `Visit Report — ${d?.name||''} ${fD(v.date)}`;
  const recipients = v.mode === 'offline' ? cfg.emailRecipients.visitPlan : cfg.emailRecipients.onlinePlan;
  
  showDraft(
    subject,
    `<div>To: ${recipients.join('; ')}</div><div>Subject: ${subject}</div><div>Date: ${fD(v.date)} | Sale: ${v.saleName||cfg.saleName} | Dealer: ${d?.name||''} | ${v.mode==='offline'?'Offline':'Online'}</div>`,
    body,
    recipients
  );
  
  // Mark email as sent (optional)
  ST.add('emails', {
    subject, type: v.mode === 'offline' ? 'visit_plan' : 'online_plan',
    recipients: recipients.join(', '), sent: false,
    visitId: v.id, dealerId: v.dealerId
  });
}

function _stripEmoji(str) {
  return str
    .replace(/[\p{Extended_Pictographic}\u{2600}-\u{27BF}]/gu, '')
    .replace(/━+/g, '---')
    .replace(/ {2,}/g, ' ')
    .replace(/^ /gm, '')
    .trim();
}

function copyDraftSAP() {
  if (typeof _draftData !== 'undefined' && _draftData) copyText(_stripEmoji(_draftData.body), '📄 Copy SAP แล้ว');
}

function copyVisitSAP(visitId) {
  var v = ST.getOne('visits', visitId); if (!v) return;
  copyText(_stripEmoji(buildVisitUpdateText(v)), '📄 Copy SAP แล้ว');
}

function copyVisitRow(visitId) {
  const v = ST.getOne('visits', visitId); if (!v) return;
  const cfg = getConfig();
  const d = ST.getOne('dealers', v.dealerId);
  const body = buildVisitUpdateText(v);
  const tsv = `${fD(v.date)}\t${v.saleName||cfg.saleName}\t${d?.name||''}\t${v.mode==='offline'?'Offline':'Online'}\t${v.djiDealer||''}\t${body.replace(/[\t]/g,' ')}\t${v.location||''}`;
  copyText(tsv, '📋 Copy Visit Row');
}

function copyAllVisits() {
  const cfg = getConfig();
  let vts = ST.sort('visits', (a,b) => (a.date||'').localeCompare(b.date||''));
  if (S.filterDealer) vts = vts.filter(v => v.dealerId === S.filterDealer);
  let tsv = 'Date\tSale\tDealer Name\tOffline/Online\tDJI Dealer\tUpdate\tLocation\n';
  vts.forEach(v => {
    const d = ST.getOne('dealers', v.dealerId);
    tsv += `${fD(v.date)}\t${v.saleName||cfg.saleName}\t${d?.name||''}\t${v.mode==='offline'?'Offline':'Online'}\t${v.djiDealer||''}\t${buildVisitUpdateText(v).replace(/[\t]/g,' ')}\t${v.location||''}\n`;
  });
  copyText(tsv, '📋 Copy Visit Report');
}

function dlAllVisitsCSV() {
  const cfg = getConfig();
  let vts = ST.sort('visits', (a,b) => (a.date||'').localeCompare(b.date||''));
  if (S.filterDealer) vts = vts.filter(v => v.dealerId === S.filterDealer);
  let csv = '\uFEFF"Date","Sale","Dealer Name","Offline/Online","DJI Dealer (SAB/Other)","Update","Location"\n';
  vts.forEach(v => {
    const d = ST.getOne('dealers', v.dealerId);
    csv += `"${fD(v.date)}","${v.saleName||cfg.saleName}","${d?.name||''}","${v.mode==='offline'?'Offline':'Online'}","${v.djiDealer||''}","${esc(buildVisitUpdateText(v))}","${v.location||''}"\n`;
  });
  dlBlob(csv, `visit-report-${_td()}.csv`);
}

// ================================================================
// VISIT — แท็บแยก (เปิดด้วย openVisitWindow ใน modals.js)
// ซ้าย = ฟอร์ม Visit ปกติ (Quick/Standard/Full), ขวา = สมุดโน้ตเร็วเต็มความสูง
// ================================================================
function rVisitWindow(el) {
  document.getElementById('pgT').textContent = '🤝 Visit Report — แท็บแยก';
  var dealerId = window._vwDealerId || '';
  var eid = window._vwEid || '';
  // มาจากนัดใน Visit Plan (openVisitWindow ส่ง planId มา) — ผูกผล Visit กลับเข้าแผนนัดนี้อัตโนมัติหลังบันทึก
  if (window._vwPlanId) window._vpLinkPlanId = window._vwPlanId;
  var formHtml = buildVisitFormHtml(dealerId, eid, 'rVisitWindowRerender()');

  var h = '<div class="vw-layout">';
  h += '<div class="vw-left">' + formHtml + '</div>';
  h += '<div class="vw-right">';
  h += '<div class="vw-scratch-header"><span style="font-weight:700;font-size:13px">📝 สมุดโน้ตเร็ว</span></div>';
  h += '<textarea id="vw_scratch" class="vw-scratch-textarea" placeholder="พิมพ์อะไรก็ได้ที่คุยกับลูกค้าไว้ตรงนี้ก่อน ยังไม่รู้จะลงหัวข้อไหนก็พิมพ์ไว้ก่อนได้ แล้วกด ➡️ ส่งเข้าสรุปการคุย ด้านล่าง ไปใช้ ✨ AI จัดระเบียบ ฝั่งซ้ายต่อได้เลย"></textarea>';
  // ปุ่มย้ายลงมาไว้ล่างขวาของกล่อง — เดิมอยู่บนหัวกล่อง พอเลื่อนดูโน้ตยาวๆ ต้องเลื่อนขึ้นไปกดทุกครั้ง
  h += '<div style="display:flex;justify-content:flex-end;margin-top:6px">';
  h += '<button type="button" class="btn bsm bo" onclick="vwMoveScratchToSummary()">➡️ ส่งเข้าสรุปการคุย</button></div>';
  h += '<p style="font-size:11px;color:var(--text2);margin-top:6px">ข้อความในกล่องนี้ยังไม่ผูกกับหัวข้อไหน — กดบันทึก Visit ก่อนปิดแท็บนี้ ไม่งั้นข้อความจะหายไป</p>';
  h += '</div></div>';

  el.innerHTML = h;

  // preset โหมด Offline/Online ตามที่ผูกมากับนัด (ถ้ามี) — เฉพาะตอนเปิดครั้งแรกจาก Visit Plan
  if (window._vwMode) {
    var modeEl = document.querySelector('input[name="fv_mode"][value="' + window._vwMode + '"]');
    if (modeEl) modeEl.checked = true;
    window._vwMode = '';
  }
}
function rVisitWindowRerender() { render(); }
function vwMoveScratchToSummary() {
  var t = document.getElementById('vw_scratch');
  var s = document.getElementById('fv_summary');
  if (!t || !s || !t.value.trim()) return;
  s.value = (s.value.trim() ? s.value.trim() + '\n\n' : '') + t.value.trim();
  t.value = '';
  toast('➡️ ย้ายเข้าสรุปการคุยแล้ว');
}