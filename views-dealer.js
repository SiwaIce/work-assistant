// ================================================================
// DEALER LIST
// ================================================================
let dealerFilter = 'all';

function rDealers(el) {
  document.getElementById('pgT').textContent = '🏪 Dealer';
  let dealers = ST.getAll('dealers');
  
  // Filter by level
  if (dealerFilter !== 'all') {
    if (dealerFilter === 'authorized') dealers = dealers.filter(d => ['S','A','B'].includes(d.level));
    else if (dealerFilter === 'other') dealers = dealers.filter(d => !['S','A','B'].includes(d.level));
    else dealers = dealers.filter(d => d.level === dealerFilter);
  }
  
  // Sort by health score (worst first)
  dealers = dealers.map(d => ({...d, _health: calcHealthScore(d.id)}))
    .sort((a, b) => {
      // Level priority: S > A > B > Other
      const lOrder = {S:0, A:1, B:2};
      const la = lOrder[a.level] ?? 3, lb = lOrder[b.level] ?? 3;
      if (la !== lb) return la - lb;
      return a._health.score - b._health.score;
    });

  const counts = {
    all: ST.count('dealers'),
    S: ST.count('dealers', d => d.level === 'S'),
    A: ST.count('dealers', d => d.level === 'A'),
    B: ST.count('dealers', d => d.level === 'B'),
    other: ST.count('dealers', d => !['S','A','B'].includes(d.level))
  };

  el.innerHTML = `
  <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
    <input type="text" id="dSrc" placeholder="🔍 ค้นหา Dealer..." style="flex:1;min-width:140px" oninput="filterDealerList()" autocomplete="off">
    <button class="btn bp" onclick="showDealerM()">➕ เพิ่ม Dealer</button>
    <button class="btn bo" onclick="showImportDealerM()">📥 Import</button>
  </div>
  
  <div class="ftabs">
    <div class="ftab ${dealerFilter==='all'?'act':''}" onclick="dealerFilter='all';render()">ทั้งหมด (${counts.all})</div>
    <div class="ftab ${dealerFilter==='S'?'act':''}" onclick="dealerFilter='S';render()">S (${counts.S})</div>
    <div class="ftab ${dealerFilter==='A'?'act':''}" onclick="dealerFilter='A';render()">A (${counts.A})</div>
    <div class="ftab ${dealerFilter==='B'?'act':''}" onclick="dealerFilter='B';render()">B (${counts.B})</div>
    <div class="ftab ${dealerFilter==='other'?'act':''}" onclick="dealerFilter='other';render()">Other (${counts.other})</div>
  </div>

  <div class="bg" style="margin-bottom:8px">
    <button class="btn bsm bo" onclick="copyDealerSummary()">📋 Copy ตาราง</button>
    <button class="btn bsm bo" onclick="dlDealerCSV()">📤 CSV</button>
  </div>

  <div class="card-grid" id="dGrid">
    ${dealers.length ? dealers.map(d => dealerCardHTML(d, d._health)).join('') : '<div class="empty" style="grid-column:1/-1"><div class="icon">🏪</div><p>ยังไม่มี Dealer<br><button class="btn bp" onclick="showDealerM()" style="margin-top:6px">➕ เพิ่ม Dealer</button></p></div>'}
  </div>`;
}

function dealerCardHTML(d, health) {
  const h = health || calcHealthScore(d.id);
  const pipes = ST.pipelineByDealer(d.id);
  const activePipes = pipes.filter(p => !['lost','delivered','on_hold'].includes(p.status));
  const wonAmt = pipes.filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const targetAmt = Number(d.targetRevenue) || 0;
  const pct = targetAmt ? Math.round(wonAmt / targetAmt * 100) : 0;
  const lcd = ST.getLastContactDays(d.id);
  const lvd = ST.getLastVisitDays(d.id);
  
  const certCount = ['dsec','crm','fh2','lark'].filter(c => {
    const v = d[c + 'Status'];
    return v === 'pass' || v === 'yes' || v === 'added';
  }).length;

  return `<div class="dealer-card" onclick="go('dealerDetail',{dealerId:'${d.id}'})">
    <h3>${levelTag(d.level)} ${sanitize(d.name)}</h3>
    <div class="meta">${d.contact ? '👤 ' + sanitize(d.contact).substr(0,30) : ''} ${d.sisCode ? '• SIS: ' + d.sisCode : ''}</div>
    
    <div class="dealer-stats">
      <div class="dealer-stat"><div class="val c2">${fmtMoneyShort(wonAmt)}</div><div class="lbl">ยอดขาย</div></div>
      <div class="dealer-stat"><div class="val c3">${fmtMoneyShort(targetAmt)}</div><div class="lbl">เป้า</div></div>
      <div class="dealer-stat"><div class="val ${pct>=70?'c2':pct>=40?'c3':'c4'}">${pct}%</div><div class="lbl">Achieve</div></div>
      <div class="dealer-stat"><div class="val" style="color:${h.level==='good'?'#22c55e':h.level==='warn'?'#f59e0b':'#ef4444'}">${h.score}</div><div class="lbl">Health</div></div>
    </div>
    
    ${targetAmt ? `<div class="pb"><div class="pf ${pct>=70?'pf-green':pct>=40?'pf-yellow':'pf-red'}" style="width:${Math.min(pct,100)}%"></div></div>` : ''}
    
    <div class="dealer-health">
      <span class="health-dot ${contactColor(lcd)}"></span>
      <span style="font-size:.62rem;color:#64748b">ติดต่อ: ${lcd !== null ? lcd + 'd' : '-'}</span>
      <span style="font-size:.62rem;color:#64748b">Visit: ${lvd !== null ? lvd + 'd' : '-'}</span>
      <span style="font-size:.62rem;color:#64748b">📊 ${activePipes.length}</span>
    </div>
    
    <div class="cert-row">
      <span class="cert-item ${d.dsecStatus==='pass'?'pass':'fail'}">DSEC ${d.dsecStatus==='pass'?'✅':'❌'}</span>
      <span class="cert-item ${d.crmStatus==='yes'?'pass':'fail'}">CRM ${d.crmStatus==='yes'?'✅':'❌'}</span>
      <span class="cert-item ${d.fh2Status==='pass'?'pass':'fail'}">FH2 ${d.fh2Status==='pass'?'✅':'❌'}</span>
      <span class="cert-item ${d.larkStatus==='added'?'pass':'fail'}">Lark ${d.larkStatus==='added'?'✅':'❌'}</span>
    </div>
  </div>`;
}

function filterDealerList() {
  const q = document.getElementById('dSrc')?.value.toLowerCase() || '';
  let dealers = ST.getAll('dealers');
  if (dealerFilter !== 'all') {
    if (dealerFilter === 'authorized') dealers = dealers.filter(d => ['S','A','B'].includes(d.level));
    else if (dealerFilter === 'other') dealers = dealers.filter(d => !['S','A','B'].includes(d.level));
    else dealers = dealers.filter(d => d.level === dealerFilter);
  }
  if (q) dealers = dealers.filter(d => d.name?.toLowerCase().includes(q) || d.contact?.toLowerCase().includes(q) || d.sisCode?.toLowerCase().includes(q));
  
  const grid = document.getElementById('dGrid');
  if (grid) grid.innerHTML = dealers.length
    ? dealers.map(d => dealerCardHTML(d)).join('')
    : '<div class="empty" style="grid-column:1/-1"><p>ไม่พบ Dealer</p></div>';
}

// ================================================================
// DEALER DETAIL (Tab View)
// ================================================================
let dealerTab = 'info';

function rDealerDet(el) {
  const d = ST.getOne('dealers', S.dealerId);
  if (!d) return go('dealers');
  document.getElementById('pgT').textContent = '🏪 ' + d.name;
  
  // Store dealerId for context-aware FAB
  S.dealerId = d.id;
  
  const isPinned = ST.hasPin(d.id);
  const h = calcHealthScore(d.id);

  el.innerHTML = `
  <div class="bc">
    <a onclick="go('dealers')">🏪 Dealer</a><span class="sep">›</span>
    <span class="cur">${sanitize(d.name)}</span>
  </div>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px">
    <div style="display:flex;align-items:center;gap:6px">
      ${levelTag(d.level)}
      <span style="font-size:.72rem;font-weight:700;color:${h.level==='good'?'#22c55e':h.level==='warn'?'#f59e0b':'#ef4444'}">Health: ${h.score}/100</span>
    </div>
    <div class="bg">
      <button class="btn bsm bs" onclick="startTimer('dealer','${d.id}','${sanitize(d.name)}')">⏱️</button>
      <button class="btn bsm ${isPinned?'bw':'bo'}" onclick="ST.togglePin('dealer','${d.id}','${sanitize(d.name)}','');render()">📌</button>
      <button class="btn bsm bo" onclick="showPreVisitBrief('${d.id}')">📋 เตรียม Visit</button>
            <button class="btn bsm bo" onclick="openClientView('${d.id}')" title="Present ให้ลูกค้าดู">🖥️</button>
      <button class="btn bsm bo" onclick="showDealerM('${d.id}')">✏️</button>
      <button class="btn bsm bd" onclick="delDealer('${d.id}')">🗑️</button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tab-bar">
    <div class="tab-btn ${dealerTab==='info'?'act':''}" onclick="dealerTab='info';render()">📋 ข้อมูล</div>
    <div class="tab-btn ${dealerTab==='pipeline'?'act':''}" onclick="dealerTab='pipeline';render()">📊 Pipeline</div>
    <div class="tab-btn ${dealerTab==='visit'?'act':''}" onclick="dealerTab='visit';render()">🤝 Visit</div>
    <div class="tab-btn ${dealerTab==='timeline'?'act':''}" onclick="dealerTab='timeline';render()">📝 Timeline</div>
    <div class="tab-btn ${dealerTab==='forecast'?'act':''}" onclick="dealerTab='forecast';render()">📦 Forecast</div>
    <div class="tab-btn ${dealerTab==='tasks'?'act':''}" onclick="dealerTab='tasks';render()">📋 งาน</div>
    <div class="tab-btn ' + (dealerTab==='onboard'?'act':'') + '" onclick="dealerTab=\'onboard\';render()">🔄 Onboard</div>
  </div>

  <!-- Tab Content -->
  <div id="dealerTabContent">${renderDealerTab(d)}</div>`;
}

function renderDealerTab(d) {
  switch (dealerTab) {
    case 'info': return dealerInfoTab(d);
    case 'pipeline': return dealerPipelineTab(d);
    case 'visit': return dealerVisitTab(d);
    case 'timeline': return dealerTimelineTab(d);
    case 'forecast': return dealerForecastTab(d);
        case 'tasks': return dealerTasksTab(d);
    case 'onboard': return dealerOnboardTab(d);
    default: return dealerInfoTab(d);
  }
}

// ================================================================
// TAB: INFO
// ================================================================
function dealerInfoTab(d) {
  const pipes = ST.pipelineByDealer(d.id);
  const wonAmt = pipes.filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const targetAmt = Number(d.targetRevenue) || 0;
  const pct = targetAmt ? Math.round(wonAmt / targetAmt * 100) : 0;
  const h = calcHealthScore(d.id);
  const lcd = ST.getLastContactDays(d.id);
  const lvd = ST.getLastVisitDays(d.id);

  return `
  <!-- Company Info -->
  <div class="card"><h2>🏢 ข้อมูลบริษัท</h2>
  <div class="fr">
    <div><label style="color:#64748b;font-size:.68rem">SIS Code</label><div style="font-size:.82rem">${d.sisCode||'-'}</div></div>
    <div><label style="color:#64748b;font-size:.68rem">DJI Code</label><div style="font-size:.82rem">${d.djiCode||'-'}</div></div>
  </div>
  <div class="fr" style="margin-top:4px">
    <div><label style="color:#64748b;font-size:.68rem">Level</label><div>${levelTag(d.level)} ${d.showSerial?'โชว์ซีเรียล: '+d.showSerial:''}</div></div>
    <div><label style="color:#64748b;font-size:.68rem">DJI Dealer</label><div>${d.djiDealer||'-'}</div></div>
  </div>
  <div class="fr" style="margin-top:4px">
    <div><label style="color:#64748b;font-size:.68rem">Term</label><div>${d.creditTerm||'-'}</div></div>
    <div><label style="color:#64748b;font-size:.68rem">วงเงินเครดิต</label><div>${d.creditLimit ? fmtMoney(d.creditLimit) + ' ฿' : '-'}</div></div>
  </div>
  ${d.paymentCondition?`<div style="margin-top:4px"><label style="color:#64748b;font-size:.68rem">เงื่อนไขชำระเงิน</label><div style="font-size:.78rem;white-space:pre-wrap">${sanitize(d.paymentCondition)}</div></div>`:''}
  </div>

  <!-- Contact -->
  <div class="card"><h2>👤 ผู้ติดต่อ</h2>
  ${d.contact?`<div style="font-size:.82rem;white-space:pre-wrap">${sanitize(d.contact)}</div>`:'<div style="color:#64748b">-</div>'}
  ${d.customerDetail?`<div style="margin-top:6px"><label style="color:#64748b;font-size:.68rem">รายละเอียดลูกค้า</label><div style="font-size:.78rem;white-space:pre-wrap;color:#94a3b8">${sanitize(d.customerDetail)}</div></div>`:''}
  <div class="fr" style="margin-top:6px">
    <div><label style="color:#64748b;font-size:.68rem">Shippto</label><div>${d.shippto||'NO'}</div></div>
    <div><label style="color:#64748b;font-size:.68rem">📍 Google Map</label>
    ${d.googleMap ? `<a href="${d.googleMap}" target="_blank" style="font-size:.76rem">เปิดแผนที่ ↗</a>` : '<div>-</div>'}</div>
  </div>
  </div>

  <!-- Revenue -->
  <div class="card"><h2>💰 ยอดขาย</h2>
  <div class="fr">
    <div><label style="color:#64748b;font-size:.68rem">เป้ายอดขาย</label><div style="font-size:1rem;font-weight:700;color:#f59e0b">${targetAmt ? fmtMoney(targetAmt) + ' ฿' : 'ยังไม่ตั้ง'}</div></div>
    <div><label style="color:#64748b;font-size:.68rem">ยอดขายจริง (Won)</label><div style="font-size:1rem;font-weight:700;color:#22c55e">${fmtMoney(wonAmt)} ฿</div></div>
  </div>
  ${targetAmt ? `<div style="margin-top:6px"><div style="display:flex;justify-content:space-between;font-size:.72rem;color:#94a3b8"><span>Achievement</span><span>${pct}%</span></div>
  <div class="pb" style="height:10px"><div class="pf ${pct>=70?'pf-green':pct>=40?'pf-yellow':'pf-red'}" style="width:${Math.min(pct,100)}%"></div></div></div>` : ''}
  </div>

  <!-- Certification -->
  <div class="card"><h2>📋 Certification</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
    ${certField('DSEC', d.dsecStatus, d.dsecCertCount, d.dsecLastCheck)}
    ${certField('CRM System', d.crmStatus, null, d.crmLastCheck)}
    ${certField('FlightHub 2', d.fh2Status, d.fh2CertCount, d.fh2LastCheck)}
    ${certField('Lark', d.larkStatus, null, d.larkLastCheck)}
  </div></div>

  <!-- Business Info -->
  <div class="card"><h2>💼 ข้อมูลธุรกิจ</h2>
  <div class="fr">
    <div><label style="color:#64748b;font-size:.68rem">กลุ่มลูกค้าหลัก</label><div style="font-size:.82rem">${d.customerSegment||'-'}</div></div>
    <div><label style="color:#64748b;font-size:.68rem">Dock Interest</label><div style="font-size:.82rem">${d.dockInterest||'-'}</div></div>
  </div>
  <div class="fr" style="margin-top:4px">
    <div><label style="color:#64748b;font-size:.68rem">Demo Unit</label><div style="font-size:.82rem">${d.demoUnit||'-'}</div></div>
    <div><label style="color:#64748b;font-size:.68rem">หนังสือแต่งตั้ง</label><div style="font-size:.82rem">${d.appointmentLetter||'-'} ${d.appointmentDate?'('+fD(d.appointmentDate)+')':''}</div></div>
  </div>
  ${d.notes?`<div style="margin-top:4px"><label style="color:#64748b;font-size:.68rem">หมายเหตุ</label><div style="font-size:.78rem;white-space:pre-wrap">${sanitize(d.notes)}</div></div>`:''}
  </div>

  <!-- Health Score Detail -->
  <div class="card"><h2>🏥 Health Score: <span style="color:${h.level==='good'?'#22c55e':h.level==='warn'?'#f59e0b':'#ef4444'}">${h.score}/100</span></h2>
  ${h.details.map(det => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:.76rem">
    <span class="health-dot ${det.status === 'good' ? 'health-good' : det.status === 'warn' ? 'health-warn' : 'health-bad'}"></span>
    <span style="flex:1">${det.label}</span>
    <span style="color:#64748b">${det.score}/${det.max}</span>
  </div>`).join('')}
  <div style="margin-top:6px;font-size:.68rem;color:#64748b">
    📞 ติดต่อล่าสุด: ${lcd !== null ? lcd + ' วัน (' + fD(ST.getLastContactDate(d.id)) + ')' : 'ไม่เคย'}
    • 🤝 Visit ล่าสุด: ${lvd !== null ? lvd + ' วัน (' + fD(ST.getLastVisitDate(d.id)) + ')' : 'ไม่เคย'}
  </div></div>

 ${renderDealerContacts(d)}

  <!-- LINE Log -->
  <div class="card"><h2>💬 LINE Support <span class="ml"><button class="btn bsm bp" onclick="showLineLogM('${d.id}')">➕</button></span></h2>
  ${renderLineLog(d.id, 5)}
  </div>`;
}

function certField(name, status, count, lastCheck) {
  const pass = status === 'pass' || status === 'yes' || status === 'added';
  return `<div style="padding:6px 8px;background:#0f172a;border:1px solid ${pass?'#22c55e':'#475569'};border-radius:6px">
    <div style="font-size:.72rem;display:flex;justify-content:space-between"><span>${name}</span><span>${pass?'✅':'❌'}</span></div>
    ${count ? `<div style="font-size:.66rem;color:#64748b">${count} ใบ</div>` : ''}
    ${lastCheck ? `<div style="font-size:.62rem;color:#475569">เช็ค: ${fDShort(lastCheck)}</div>` : ''}
  </div>`;
}

function renderLineLog(dealerId, limit) {
  const cfg = getConfig();
  const logs = ST.lineLogByDealer(dealerId).slice(0, limit || 999);
  if (!logs.length) return '<div class="empty"><p>ยังไม่มี</p></div>';
  return logs.map(l => {
    const lt = cfg.lineLogTypes.find(t => t.id === l.logType) || {};
    return `<div class="line-item" style="padding:6px 8px">
      <div class="line-type ${lt.cls||'line-type-info'}" style="min-width:60px">${lt.name||l.logType}</div>
      <div style="flex:1"><div style="font-size:.76rem">${sanitize(l.summary||'')}</div>
      <div style="font-size:.6rem;color:#64748b">${fD(l.date)} ${l.time||''}</div></div>
      <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('lineLog','${l.id}');render()">✕</button>
    </div>`;
  }).join('');
}

// ================================================================
// TAB: PIPELINE
// ================================================================
function dealerPipelineTab(d) {
  var pipes = ST.pipelineByDealer(d.id);
  var activeCount = 0;
  var activeAmt = 0;
  var totalAmt = 0;
  var wonAmt = 0;
  var lostAmt = 0;
  var wonCount = 0;
  var lostCount = 0;

  pipes.forEach(function(p) {
    var amt = Number(p.forecastAmount) || 0;
    totalAmt += amt;
    if (['lost','delivered'].indexOf(p.status) === -1) {
      activeCount++;
      activeAmt += amt;
    }
    if (['win','ordered','delivered'].indexOf(p.status) !== -1) {
      wonCount++;
      wonAmt += amt;
    }
    if (p.status === 'lost') {
      lostCount++;
      lostAmt += amt;
    }
  });

  var h = '<div class="card"><h2>📊 Pipeline (' + activeCount + ' active / ' + pipes.length + ' total)';
  h += '<span class="ml">';
  h += '<button class="btn bsm bo" onclick="copyDealerPipeline(\'' + d.id + '\')">📋</button>';
  h += '<button class="btn bsm bp" onclick="showPipelineM(\'' + d.id + '\')">➕</button>';
  h += '</span></h2>';

  h += '<div class="sr" style="margin-bottom:8px">';
  h += '<div class="sc"><div class="sn c1">' + pipes.length + '</div><div class="sl">ทั้งหมด</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(activeAmt) + '</div><div class="sl">Active (' + activeCount + ')</div></div>';
  h += '<div class="sc"><div class="sn c5">' + fmtMoneyShort(totalAmt) + '</div><div class="sl">Total</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(wonAmt) + '</div><div class="sl">Won (' + wonCount + ')</div></div>';
  h += '<div class="sc"><div class="sn c4">' + fmtMoneyShort(lostAmt) + '</div><div class="sl">Lost (' + lostCount + ')</div></div>';
  h += '</div>';

  if (pipes.length) {
    pipes.forEach(function(p, idx) {
      var lastLog = ST.pipeLogsByPipe(p.id)[0];
      var isEnd = ['delivered','lost'].indexOf(p.status) !== -1;
      var amt = Number(p.forecastAmount) || 0;

      h += '<div class="li ' + dlC(p.biddingDate, isEnd) + (p.status === 'lost' ? ' dlo' : '') + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
      h += '<div class="lm">';
      h += '<div class="lt"><span class="pipe-row-num">#' + (idx + 1) + '</span> ' + sanitize(p.projectName) + ' ' + pipeTag(p.status) + '</div>';
      h += '<div class="ls">';
      h += (p.endUserTH || '') + ' • ' + (p.model || '') + (p.modelQty > 1 ? 'x' + p.modelQty : '') + ' • ';
      h += fmtMoneyStyled(amt);
      if (p.biddingDate) h += ' • Bid: ' + fDShort(p.biddingDate) + ' ' + dlB(p.biddingDate, isEnd);
      h += '</div>';
      if (lastLog) {
        h += '<div class="ls" style="color:#475569;margin-top:1px">📝 ' + fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 40)) + '</div>';
      }
      h += '</div></div>';
    });
  } else {
    h += '<div class="empty"><p>ยังไม่มี Pipeline</p></div>';
  }

  h += '</div>';
  return h;
}

function copyDealerPipeline(dealerId) {
  var pipes = ST.pipelineByDealer(dealerId);
  var d = ST.getOne('dealers', dealerId);
  var tsv = '#\tProject\tEnd User\tModel\tQTY\tForecast\tStatus\tBidding\n';
  pipes.forEach(function(p, idx) {
    tsv += (idx + 1) + '\t' + (p.projectName || '') + '\t' + (p.endUserTH || '') + '\t' + (p.model || '') + '\t' + (p.modelQty || 1) + '\t' + (p.forecastAmount || '') + '\t' + getPipeName(p.status) + '\t' + fD(p.biddingDate) + '\n';
  });
  copyText(tsv, '📋 Copy Pipeline ' + (d ? d.name : ''));
}
// ================================================================
// TAB: VISIT
// ================================================================
function dealerVisitTab(d) {
  const vts = ST.visitsByDealer(d.id);
  const fus = ST.followupsByDealer(d.id);

  return `
  <div class="card"><h2>🤝 Visit / Meeting (${vts.length})
    <span class="ml">
      <button class="btn bsm bo" onclick="copyDealerVisits('${d.id}')">📋 Copy</button>
      <button class="btn bsm bo" onclick="dlDealerVisitsCSV('${d.id}')">📤 CSV</button>
      <button class="btn bsm bp" onclick="showVisitM('${d.id}')">➕ Visit</button>
    </span></h2>
  ${vts.length ? vts.slice(0, 20).map(v => visitItemHTML(v)).join('') : '<div class="empty"><p>ยังไม่มี Visit</p></div>'}
  ${vts.length > 20 ? `<div style="text-align:center;padding:6px"><button class="btn bo" onclick="go('visits',{filterDealer:'${d.id}'})">ดูทั้งหมด (${vts.length}) →</button></div>` : ''}
  </div>

  <div class="card"><h2>📞 Follow-up (${fus.length})
    <span class="ml"><button class="btn bsm bp" onclick="showFollowupM('${d.id}')">➕</button></span></h2>
  ${fus.length ? fus.slice(0, 10).map(f => `<div class="li">
    <div class="lm"><div class="lt"><span class="tag ${f.method==='line'?'tag-active':f.method==='call'?'tag-completed':'tag-a'}">${f.method||'?'}</span> ${fD(f.date)}</div>
    <div class="ls">${sanitize(f.summary?.substr(0,80)||'')}</div></div>
    <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('followups','${f.id}');render()">✕</button>
  </div>`).join('') : '<div class="empty"><p>ยังไม่มี Follow-up</p></div>'}
  </div>

  <!-- Feedback -->
  <div class="card"><h2>💡 Feedback (${ST.feedbackByDealer(d.id).length})
    <span class="ml"><button class="btn bsm bp" onclick="showFeedbackM('${d.id}')">➕</button></span></h2>
  ${ST.feedbackByDealer(d.id).length ? ST.feedbackByDealer(d.id).map(f => `<div class="visit-sub">
    <div style="display:flex;justify-content:space-between"><span style="font-size:.62rem;color:#64748b">${fD(f.date)} • ${f.source||''}</span>
    <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('feedback','${f.id}');render()">✕</button></div>
    <div style="font-size:.74rem;margin-top:1px">${sanitize(f.text)}</div>
  </div>`).join('') : '<div class="empty"><p>ยังไม่มี Feedback</p></div>'}
  </div>`;
}

function visitItemHTML(v) {
  const d = ST.getOne('dealers', v.dealerId);
  const topicStr = (v.topicData || []).filter(t => t.answered).map(t => t.topicId).join(', ');
  
  return `<div class="visit-item" onclick="go('visitDetail',{visitId:'${v.id}'})">
    <h4>${fD(v.date)} ${v.time||''} ${modeTag(v.mode)} ${v.djiDealer?`<span class="tag tag-count">${v.djiDealer}</span>`:''}</h4>
    <div class="vmeta">${topicStr ? 'Topics: ' + topicStr : ''} ${v.location?'📍 <a href="'+v.location+'" target="_blank" onclick="event.stopPropagation()">Map</a>':''}</div>
    <div class="vbody">${sanitize((v.summary||'').substr(0,150))}${(v.summary||'').length>150?'...':''}</div>
    ${v.revenue ? `<div style="font-size:.68rem;color:#22c55e;margin-top:2px">💰 ยอดขาย: ${fmtMoney(v.revenue)}</div>` : ''}
  </div>`;
}

// ================================================================
// TAB: TIMELINE
// ================================================================
let timelineFilter = 'all';

function dealerTimelineTab(d) {
  let items = ST.getDealerTimeline(d.id, 50);
  
  if (timelineFilter !== 'all') {
    items = items.filter(i => i.type === timelineFilter);
  }

  return `
  <div class="card"><h2>📝 Timeline
    <span class="ml"><button class="btn bsm bo" onclick="copyDealerTimeline('${d.id}')">📋 Copy</button></span></h2>
  
  <div class="ftabs" style="margin-bottom:8px">
    <div class="ftab ${timelineFilter==='all'?'act':''}" onclick="timelineFilter='all';render()">ทั้งหมด</div>
    <div class="ftab ${timelineFilter==='visit'?'act':''}" onclick="timelineFilter='visit';render()">🤝 Visit</div>
    <div class="ftab ${timelineFilter==='followup'?'act':''}" onclick="timelineFilter='followup';render()">📞 FU</div>
    <div class="ftab ${timelineFilter==='line'?'act':''}" onclick="timelineFilter='line';render()">💬 LINE</div>
    <div class="ftab ${timelineFilter==='update'?'act':''}" onclick="timelineFilter='update';render()">📊 Pipeline</div>
    <div class="ftab ${timelineFilter==='note'?'act':''}" onclick="timelineFilter='note';render()">💡 FB</div>
  </div>

  ${items.length ? `<div class="tl">${items.map(i => {
    let onclick = '';
    if (i.refType === 'visit') onclick = `onclick="go('visitDetail',{visitId:'${i.refId}'})"`;
    else if (i.refType === 'pipeline') onclick = `onclick="go('pipeDetail',{pipeId:'${i.refId}'})"`;
    
    return `<div class="ti tl-${i.type}" ${onclick} style="${onclick?'cursor:pointer':''}">
      <div class="td2">${fDT(i.date)}</div>
      <div class="tt2">${sanitize(i.title)}</div>
      <div class="tc2">${sanitize(i.desc)}</div>
      ${onclick ? `<div class="ti-link">ดูรายละเอียด →</div>` : ''}
    </div>`;
  }).join('')}</div>` : '<div class="empty"><p>ยังไม่มีกิจกรรม</p></div>'}
  </div>`;
}

function copyDealerTimeline(dealerId) {
  const d = ST.getOne('dealers', dealerId);
  const items = ST.getDealerTimeline(dealerId, 100);
  let txt = `Timeline — ${d?.name||''}\n${'─'.repeat(30)}\n`;
  items.forEach(i => {
    txt += `${fD(i.date?.split('T')[0])} ${i.title} ${i.desc}\n`;
  });
  copyText(txt, '📋 Copy Timeline');
}

// ================================================================
// TAB: FORECAST (Enhanced v2)
// ================================================================
var dlrFcView = 'model';
var dlrFcStatus = 'active';

function dealerForecastTab(d) {
  var allPipes = ST.pipelineByDealer(d.id);
  
  var pipes;
  if (dlrFcStatus === 'all') {
    pipes = allPipes;
  } else if (dlrFcStatus === 'won') {
    pipes = allPipes.filter(function(p) { return ['win','ordered','delivered'].indexOf(p.status) !== -1; });
  } else {
    pipes = allPipes.filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
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
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));
      if (!byModel[model]) byModel[model] = {model: model, qty: 0, amount: 0, projects: []};
      byModel[model].qty += qty;
      byModel[model].amount += amt;
      var found = false;
      for (var fi = 0; fi < byModel[model].projects.length; fi++) {
        if (byModel[model].projects[fi].id === p.id) { found = true; break; }
      }
      if (!found) byModel[model].projects.push(p);
    });
  });
  var modelList = Object.values(byModel).sort(function(a, b) { return b.amount - a.amount; });

  var h = '<div class="card"><h2>📦 Forecast — ' + sanitize(d.name);
  h += '<span class="ml"><button class="btn bsm bo" onclick="copyDealerForecast(\'' + d.id + '\')">📋</button></span></h2>';

  h += '<div class="sr" style="margin-bottom:8px">';
  h += '<div class="sc"><div class="sn c1">' + pipes.length + '</div><div class="sl">Projects</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(totalFc) + '</div><div class="sl">Forecast</div></div>';
  h += '<div class="sc"><div class="sn c5">' + totalQty + '</div><div class="sl">จำนวน (ชิ้น)</div></div>';
  h += '<div class="sc"><div class="sn c1">' + modelList.length + '</div><div class="sl">Models</div></div>';
  h += '</div>';

  h += '<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">';
  h += '<button class="btn bsm ' + (dlrFcStatus === 'active' ? 'bp' : 'bo') + '" onclick="dlrFcStatus=\'active\';render()">⚡ Active</button>';
  h += '<button class="btn bsm ' + (dlrFcStatus === 'won' ? 'bp' : 'bo') + '" onclick="dlrFcStatus=\'won\';render()">🏆 Won</button>';
  h += '<button class="btn bsm ' + (dlrFcStatus === 'all' ? 'bp' : 'bo') + '" onclick="dlrFcStatus=\'all\';render()">📊 ทั้งหมด</button>';
  h += '<div style="flex:1"></div>';
  h += '<button class="btn bsm ' + (dlrFcView === 'model' ? 'bp' : 'bo') + '" onclick="dlrFcView=\'model\';render()">📦 Model</button>';
  h += '<button class="btn bsm ' + (dlrFcView === 'monthly' ? 'bp' : 'bo') + '" onclick="dlrFcView=\'monthly\';render()">📅 เดือน</button>';
  h += '<button class="btn bsm ' + (dlrFcView === 'quarterly' ? 'bp' : 'bo') + '" onclick="dlrFcView=\'quarterly\';render()">📊 ไตรมาส</button>';
  h += '</div>';

  if (dlrFcView === 'monthly') {
    h += buildDlrFcMonthly(pipes, d);
  } else if (dlrFcView === 'quarterly') {
    h += buildDlrFcQuarterly(pipes, d);
  } else {
    h += buildDlrFcModel(modelList, totalFc, totalQty, d);
  }

  h += '</div>';

  // Chart
  if (modelList.length) {
    h += '<div class="card"><h2>📊 Chart — ' + sanitize(d.name) + '</h2>';
    var maxAmt = modelList[0].amount || 1;
    var maxQty = 1;
    modelList.forEach(function(m) { if (m.qty > maxQty) maxQty = m.qty; });

    h += '<div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--text2)">💰 มูลค่า</div>';
    h += '<div class="fc-chart">';
    modelList.forEach(function(m) {
      var pct = Math.max(8, Math.round(m.amount / maxAmt * 100));
      h += '<div class="fc-chart-row">';
      h += '<div class="fc-chart-label">' + sanitize(m.model) + '</div>';
      h += '<div class="fc-chart-track"><div class="fc-chart-fill" style="width:' + pct + '%">' + fmtMoneyShort(m.amount) + '</div></div>';
      h += '</div>';
    });
    h += '</div>';

    h += '<div style="font-size:12px;font-weight:700;margin:12px 0 6px;color:var(--text2)">📦 จำนวน (ชิ้น)</div>';
    h += '<div class="fc-chart">';
    modelList.forEach(function(m) {
      var pct = Math.max(8, Math.round(m.qty / maxQty * 100));
      h += '<div class="fc-chart-row">';
      h += '<div class="fc-chart-label">' + sanitize(m.model) + ' <span style="color:var(--text2)">x' + m.qty + '</span></div>';
      h += '<div class="fc-chart-track"><div class="fc-chart-fill fc-chart-fill-qty" style="width:' + pct + '%">x' + m.qty + '</div></div>';
      h += '</div>';
    });
    h += '</div>';
    h += '</div>';
  }

  // Pipeline List
  h += '<div class="card"><h2>📊 Pipeline (' + pipes.length + ')</h2>';
  if (pipes.length) {
    pipes.sort(function(a, b) { return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); });
    pipes.forEach(function(p, idx) {
      var modelText = getPipeModelSummary(p);
      h += '<div class="li ' + dlC(p.biddingDate, ['delivered','lost'].indexOf(p.status) !== -1) + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
      h += '<div class="lm">';
      h += '<div class="lt"><span class="pipe-row-num">#' + (idx + 1) + '</span> ' + sanitize(p.projectName || '-') + ' ' + pipeTag(p.status) + '</div>';
      h += '<div class="ls">📦 ' + modelText + ' • ' + fmtMoneyStyled(p.forecastAmount);
      if (p.biddingDate) h += ' • Bid: ' + fDShort(p.biddingDate);
      if (p.shipmentDate) h += ' • Ship: ' + fDShort(p.shipmentDate);
      h += '</div></div></div>';
    });
  } else {
    h += '<div class="empty"><p>ไม่มี Pipeline</p></div>';
  }
  h += '</div>';

  return h;
}

// ================================================================
// DEALER FORECAST — MODEL VIEW
// ================================================================
function buildDlrFcModel(modelList, totalFc, totalQty, d) {
  if (!modelList.length) return '<div class="empty"><p>ไม่มีข้อมูล</p></div>';

  var h = '<div class="export-wrap"><table class="export-table" id="fcDlr_' + d.id + '">';
  h += '<thead><tr><th>#</th><th>Model</th><th style="text-align:center">QTY</th><th style="text-align:right">มูลค่า</th><th>Project</th></tr></thead>';
  h += '<tbody>';

  modelList.forEach(function(m, idx) {
    var projNames = m.projects.map(function(p) { return sanitize((p.projectName || '').substr(0, 20)); }).join(', ');
    h += '<tr>';
    h += '<td class="pipe-row-num">' + (idx + 1) + '</td>';
    h += '<td><strong>' + sanitize(m.model) + '</strong></td>';
    h += '<td style="text-align:center">' + m.qty + '</td>';
    h += '<td style="text-align:right">' + fmtMoneyStyled(m.amount) + '</td>';
    h += '<td style="font-size:.64rem">' + projNames + '</td>';
    h += '</tr>';
  });

  h += '<tr style="font-weight:700;border-top:2px solid var(--border)">';
  h += '<td></td><td>รวม</td>';
  h += '<td style="text-align:center">' + totalQty + '</td>';
  h += '<td style="text-align:right">' + fmtMoneyStyled(totalFc) + '</td>';
  h += '<td></td></tr>';
  h += '</tbody></table></div>';
  return h;
}

function buildDlrFcMonthly(pipes, d) {
  var now = new Date();
  var year = now.getFullYear();
  var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  var models = {};
  var monthTotals = {};
  for (var mi = 0; mi < 12; mi++) monthTotals[mi] = {qty: 0, amt: 0};

  pipes.forEach(function(p) {
    var shipDate = ftParseDate(p.shipmentDate);
    if (!shipDate) return;
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
      
      var found = false;
      for (var fi = 0; fi < models[model][m].projects.length; fi++) {
        if (models[model][m].projects[fi].id === p.id) { found = true; break; }
      }
      if (!found) models[model][m].projects.push(p);
      
      monthTotals[m].qty += qty;
      monthTotals[m].amt += amt;
    });
  });

  var modelNames = Object.keys(models).sort();

  if (!modelNames.length) {
    return '<div class="empty"><p>ไม่มีข้อมูล — ต้องใส่ Shipment Date ใน Pipeline</p></div>';
  }

  var h = '<div class="export-wrap" style="overflow-x:auto"><table class="export-table" id="fcDlrM_' + d.id + '">';
  h += '<thead><tr><th>Model</th>';
  for (var mh = 0; mh < 12; mh++) {
    var isCur = mh === now.getMonth();
    h += '<th style="text-align:center;min-width:55px' + (isCur ? ';background:rgba(59,130,246,0.15)' : '') + '">' + months[mh] + '</th>';
  }
  h += '<th style="text-align:right">รวม</th></tr></thead>';
  h += '<tbody>';

  modelNames.forEach(function(model) {
    var tQty = 0;
    var tAmt = 0;
    h += '<tr>';
    h += '<td><strong>' + sanitize(model) + '</strong></td>';
    for (var mc = 0; mc < 12; mc++) {
      var cell = models[model][mc];
      var isCur = mc === now.getMonth();
      var bg = isCur ? 'background:rgba(59,130,246,0.08);' : '';
      if (cell.qty > 0) {
        tQty += cell.qty;
        tAmt += cell.amt;
        var tip = cell.projects.map(function(pp) { return (pp.projectName || '').substr(0, 25); }).join('\n');
        h += '<td style="text-align:center;' + bg + '" title="' + sanitize(tip) + '">';
        h += '<div style="font-weight:700">' + cell.qty + '</div>';
        h += '<div style="font-size:.56rem;color:var(--text2)">' + fmtMoneyShort(cell.amt) + '</div>';
        h += '</td>';
      } else {
        h += '<td style="text-align:center;color:var(--text2);' + bg + '">-</td>';
      }
    }
    h += '<td style="text-align:right;font-weight:700">' + tQty + '<div style="font-size:.58rem">' + fmtMoneyShort(tAmt) + '</div></td>';
    h += '</tr>';
  });

  h += '<tr style="font-weight:700;border-top:2px solid var(--border)">';
  h += '<td>รวม</td>';
  var grand = 0;
  for (var mt = 0; mt < 12; mt++) {
    var isCur = mt === now.getMonth();
    var bg = isCur ? 'background:rgba(59,130,246,0.08);' : '';
    grand += monthTotals[mt].amt;
    if (monthTotals[mt].qty > 0) {
      h += '<td style="text-align:center;' + bg + '">' + monthTotals[mt].qty + '<div style="font-size:.56rem">' + fmtMoneyShort(monthTotals[mt].amt) + '</div></td>';
    } else {
      h += '<td style="text-align:center;' + bg + '">-</td>';
    }
  }
  h += '<td style="text-align:right">' + fmtMoneyShort(grand) + '</td>';
  h += '</tr>';
  h += '</tbody></table></div>';
  return h;
}

// ================================================================
// DEALER FORECAST — QUARTERLY VIEW
// ================================================================
function buildDlrFcQuarterly(pipes, d) {
  var now = new Date();
  var year = now.getFullYear();
  var qLabels = ['Q1','Q2','Q3','Q4'];

  var models = {};
  var qTotals = [{qty:0,amt:0},{qty:0,amt:0},{qty:0,amt:0},{qty:0,amt:0}];

  pipes.forEach(function(p) {
    var shipDate = ftParseDate(p.shipmentDate);
    if (!shipDate) return;
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
      
      var found = false;
      for (var fi = 0; fi < models[model][q].projects.length; fi++) {
        if (models[model][q].projects[fi].id === p.id) { found = true; break; }
      }
      if (!found) models[model][q].projects.push(p);
      
      qTotals[q].qty += qty;
      qTotals[q].amt += amt;
    });
  });

  var modelNames = Object.keys(models).sort();
  var currentQ = Math.floor(now.getMonth() / 3);

  if (!modelNames.length) {
    return '<div class="empty"><p>ไม่มีข้อมูล — ต้องใส่ Shipment Date ใน Pipeline</p></div>';
  }

  var h = '<div class="export-wrap"><table class="export-table" id="fcDlrQ_' + d.id + '">';
  h += '<thead><tr><th>Model</th>';
  for (var qh = 0; qh < 4; qh++) {
    var isCur = qh === currentQ;
    h += '<th style="text-align:center;min-width:80px' + (isCur ? ';background:rgba(59,130,246,0.15)' : '') + '">' + qLabels[qh] + '</th>';
  }
  h += '<th style="text-align:right">รวม</th></tr></thead>';
  h += '<tbody>';

  modelNames.forEach(function(model) {
    var tQty = 0;
    var tAmt = 0;
    h += '<tr>';
    h += '<td><strong>' + sanitize(model) + '</strong></td>';
    for (var qc = 0; qc < 4; qc++) {
      var cell = models[model][qc];
      var isCur = qc === currentQ;
      var bg = isCur ? 'background:rgba(59,130,246,0.08);' : '';
      if (cell.qty > 0) {
        tQty += cell.qty;
        tAmt += cell.amt;
        var tip = cell.projects.map(function(pp) { return (pp.projectName || '').substr(0, 25); }).join('\n');
        h += '<td style="text-align:center;' + bg + '" title="' + sanitize(tip) + '">';
        h += '<div style="font-weight:700;font-size:1.1em">' + cell.qty + '</div>';
        h += '<div style="font-size:.58rem">' + fmtMoneyStyled(cell.amt) + '</div>';
        h += '</td>';
      } else {
        h += '<td style="text-align:center;color:var(--text2);' + bg + '">-</td>';
      }
    }
    h += '<td style="text-align:right;font-weight:700">' + tQty + '<div style="font-size:.58rem">' + fmtMoneyShort(tAmt) + '</div></td>';
    h += '</tr>';
  });

  h += '<tr style="font-weight:700;border-top:2px solid var(--border)">';
  h += '<td>รวม</td>';
  var grand = 0;
  for (var qt = 0; qt < 4; qt++) {
    var isCur = qt === currentQ;
    var bg = isCur ? 'background:rgba(59,130,246,0.08);' : '';
    grand += qTotals[qt].amt;
    h += '<td style="text-align:center;' + bg + '">';
    h += '<div>' + qTotals[qt].qty + '</div>';
    h += '<div style="font-size:.58rem">' + fmtMoneyShort(qTotals[qt].amt) + '</div>';
    h += '</td>';
  }
  h += '<td style="text-align:right">' + fmtMoneyShort(grand) + '</td>';
  h += '</tr>';
  h += '</tbody></table></div>';
  return h;
}

function copyDealerForecast(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  var allPipes = ST.pipelineByDealer(dealerId);
  var pipes;
  if (dlrFcStatus === 'all') {
    pipes = allPipes;
  } else if (dlrFcStatus === 'won') {
    pipes = allPipes.filter(function(p) { return ['win','ordered','delivered'].indexOf(p.status) !== -1; });
  } else {
    pipes = allPipes.filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
  }
  
  var tsv = 'Forecast — ' + (d ? d.name : '') + '\n';
  tsv += '#\tModel\tQTY\tAmount\tProject\tShipment\tStatus\n';
  pipes.forEach(function(p, idx) {
    var items = getPipeItems(p);
    if (items.length > 1) {
      // Multi-model: 1 row per item
      items.forEach(function(it, ii) {
        var amt = Number(it.total) || ((Number(it.qty) || 1) * (Number(it.price) || 0));
        tsv += (idx + 1) + (ii > 0 ? '.' + (ii + 1) : '') + '\t' + (it.model || '') + '\t' + (it.qty || 1) + '\t' + amt + '\t' + (ii === 0 ? (p.projectName || '') : '') + '\t' + (ii === 0 ? (p.shipmentDate || '') : '') + '\t' + (ii === 0 ? getPipeName(p.status) : '') + '\n';
      });
    } else {
      var modelText = getPipeModelSummary(p);
      tsv += (idx + 1) + '\t' + modelText + '\t' + getPipeTotalQty(p) + '\t' + (p.forecastAmount || '') + '\t' + (p.projectName || '') + '\t' + (p.shipmentDate || '') + '\t' + getPipeName(p.status) + '\n';
    }
  });
  copyText(tsv, '📋 Copy Forecast');
}

// ================================================================
// PRE-VISIT BRIEF
// ================================================================
function showPreVisitBrief(dealerId) {
  const d = ST.getOne('dealers', dealerId);
  if (!d) return;
  const cfg = getConfig();
  const h = calcHealthScore(dealerId);
  const pipes = ST.pipelineByDealer(dealerId).filter(p => !['lost','delivered','on_hold'].includes(p.status));
  const wonAmt = ST.pipelineByDealer(dealerId).filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const lastVisit = ST.visitsByDealer(dealerId)[0];
  const lastFU = ST.followupsByDealer(dealerId)[0];
  const fbs = ST.feedbackByDealer(dealerId).slice(0, 5);
  const waits = ST.filter('waiting', w => !w.resolved && w.dealerId === dealerId);
  
  // Check cert gaps
  const certGaps = [];
  if (d.dsecStatus !== 'pass') certGaps.push('DSEC');
  if (d.crmStatus !== 'yes') certGaps.push('CRM');
  if (d.fh2Status !== 'pass') certGaps.push('FH2');
  if (d.larkStatus !== 'added') certGaps.push('Lark');

  const briefText = buildBriefText(d, pipes, wonAmt, lastVisit, fbs, certGaps, waits);

  openM('📋 Pre-Visit Brief — ' + d.name, `
  <div class="brief-card">
    <h3>🏪 ${sanitize(d.name)} ${levelTag(d.level)}</h3>
    <div class="brief-section"><h4>👤 ผู้ติดต่อ</h4><div class="val" style="white-space:pre-wrap">${sanitize(d.contact||'-')}</div></div>
    ${d.googleMap ? `<div class="brief-section"><h4>📍 Location</h4><a href="${d.googleMap}" target="_blank">เปิดแผนที่ ↗</a></div>` : ''}
    <div class="brief-section"><h4>💰 ยอดขาย</h4><div class="val">${fmtMoney(wonAmt)} / ${fmtMoney(d.targetRevenue||0)} ฿ (${d.targetRevenue ? Math.round(wonAmt/(Number(d.targetRevenue))*100) : 0}%)</div></div>
    ${d.customerSegment ? `<div class="brief-section"><h4>กลุ่มลูกค้า</h4><div class="val">${sanitize(d.customerSegment)}</div></div>` : ''}
  </div>

  ${pipes.length ? `<div class="brief-card"><h3>📊 Pipeline Active (${pipes.length})</h3>
  ${pipes.map(p => `<div style="font-size:.76rem;padding:3px 0;border-bottom:1px solid #334155">
    • ${sanitize(p.projectName)} — ${p.model||''} — ${fmtMoney(p.forecastAmount)} — ${getPipeName(p.status)}
    ${p.biddingDate ? ' — Bid: '+fD(p.biddingDate) : ''}</div>`).join('')}
  </div>` : ''}

  ${lastVisit ? `<div class="brief-card"><h3>🤝 Visit ล่าสุด (${fD(lastVisit.date)})</h3>
  <div style="font-size:.76rem;white-space:pre-wrap;max-height:100px;overflow:auto">${sanitize(lastVisit.summary?.substr(0,300)||'-')}</div></div>` : ''}

  ${fbs.length ? `<div class="brief-card"><h3>💡 Feedback ครั้งก่อน</h3>
  ${fbs.map(f => `<div style="font-size:.74rem;padding:2px 0">• ${sanitize(f.text)}</div>`).join('')}</div>` : ''}

  ${certGaps.length ? `<div class="brief-card" style="border-color:#f59e0b"><h3>⚠️ Cert ที่ควรถาม</h3>
  <div style="font-size:.78rem">${certGaps.join(', ')} — ยังไม่ผ่าน/ไม่มี</div></div>` : ''}

  ${waits.length ? `<div class="brief-card" style="border-color:#ef4444"><h3>📭 สิ่งที่ค้างอยู่</h3>
  ${waits.map(w => `<div style="font-size:.74rem;padding:2px 0">• ${sanitize(w.title)} ${w.dueDate?'(กำหนด: '+fD(w.dueDate)+')':''}</div>`).join('')}</div>` : ''}

  <div class="bg" style="margin-top:8px">
    <button class="btn bp" onclick="copyPreVisitBrief('${dealerId}')">📋 Copy Brief</button>
    <button class="btn bs" onclick="closeM();showVisitM('${dealerId}')">🤝 เริ่ม Visit</button>
  </div>`);
}

function buildBriefText(d, pipes, wonAmt, lastVisit, fbs, certGaps, waits) {
  let txt = `Pre-Visit Brief — ${d.name}\n${'─'.repeat(30)}\n`;
  txt += `Level: ${d.level || '-'}\n`;
  txt += `ผู้ติดต่อ: ${d.contact || '-'}\n`;
  txt += `ยอดขาย: ${fmtMoney(wonAmt)} / ${fmtMoney(d.targetRevenue||0)} ฿\n`;
  if (d.customerSegment) txt += `กลุ่มลูกค้า: ${d.customerSegment}\n`;
  if (pipes.length) {
    txt += `\nPipeline Active (${pipes.length}):\n`;
    pipes.forEach(p => { txt += `  • ${p.projectName} — ${p.model||''} — ${fmtMoney(p.forecastAmount)} — ${getPipeName(p.status)}\n`; });
  }
  if (lastVisit) txt += `\nVisit ล่าสุด (${fD(lastVisit.date)}): ${lastVisit.summary?.substr(0,200)||'-'}\n`;
  if (fbs.length) { txt += `\nFeedback ครั้งก่อน:\n`; fbs.forEach(f => { txt += `  • ${f.text}\n`; }); }
  if (certGaps.length) txt += `\n⚠️ Cert ที่ยังไม่ผ่าน: ${certGaps.join(', ')}\n`;
  if (waits.length) { txt += `\n📭 ค้าง:\n`; waits.forEach(w => { txt += `  • ${w.title}\n`; }); }
  return txt;
}

function copyPreVisitBrief(dealerId) {
  const d = ST.getOne('dealers', dealerId);
  if (!d) return;
  const pipes = ST.pipelineByDealer(dealerId).filter(p => !['lost','delivered','on_hold'].includes(p.status));
  const wonAmt = ST.pipelineByDealer(dealerId).filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const lastVisit = ST.visitsByDealer(dealerId)[0];
  const fbs = ST.feedbackByDealer(dealerId).slice(0, 5);
  const certGaps = [];
  if (d.dsecStatus !== 'pass') certGaps.push('DSEC');
  if (d.crmStatus !== 'yes') certGaps.push('CRM');
  if (d.fh2Status !== 'pass') certGaps.push('FH2');
  if (d.larkStatus !== 'added') certGaps.push('Lark');
  const waits = ST.filter('waiting', w => !w.resolved && w.dealerId === dealerId);
  
  const txt = buildBriefText(d, pipes, wonAmt, lastVisit, fbs, certGaps, waits);
  copyText(txt, '📋 Copy Brief แล้ว!');
}

// ================================================================
// DELETE DEALER
// ================================================================
function delDealer(id) {
  if (!confirm('⚠️ ลบ Dealer นี้?\n(Pipeline, Visit, Follow-up, Feedback จะถูกลบด้วย)')) return;
  if (!confirm('⚠️⚠️ ยืนยันอีกครั้ง — ลบทุกอย่าง?')) return;
  
  ST.delete('dealers', id);
  ST.deleteWhere('pipeline', p => p.dealerId === id);
  ST.deleteWhere('pipeLog', l => {
    const p = ST.getOne('pipeline', l.pipeId);
    return !p; // Delete orphaned logs
  });
  ST.deleteWhere('visits', v => v.dealerId === id);
  ST.deleteWhere('followups', f => f.dealerId === id);
  ST.deleteWhere('lineLog', l => l.dealerId === id);
  ST.deleteWhere('feedback', f => f.dealerId === id);
  
  dealerTab = 'info';
  go('dealers');
  toast('🗑️ ลบ Dealer แล้ว');
}

// ================================================================
// DEALER COPY/EXPORT
// ================================================================
function copyDealerSummary() {
  const dealers = ST.getAll('dealers');
  let tsv = 'SIS Code\tDJI Code\tName\tLevel\tContact\tTerm\tCredit Limit\tTarget\tWon\tAchieve%\tHealth\tLast Contact\tLast Visit\tDSEC\tCRM\tFH2\tLark\n';
  dealers.forEach(d => {
    const won = ST.pipelineByDealer(d.id).filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
    const target = Number(d.targetRevenue) || 0;
    const pct = target ? Math.round(won/target*100) : 0;
    const h = calcHealthScore(d.id);
    const lcd = ST.getLastContactDays(d.id);
    const lvd = ST.getLastVisitDays(d.id);
    tsv += `${d.sisCode||''}\t${d.djiCode||''}\t${d.name}\t${d.level||''}\t${(d.contact||'').replace(/[\t\n]/g,' ')}\t${d.creditTerm||''}\t${d.creditLimit||''}\t${target}\t${won}\t${pct}%\t${h.score}\t${lcd!==null?lcd+'d':'-'}\t${lvd!==null?lvd+'d':'-'}\t${d.dsecStatus==='pass'?'Y':'N'}\t${d.crmStatus==='yes'?'Y':'N'}\t${d.fh2Status==='pass'?'Y':'N'}\t${d.larkStatus==='added'?'Y':'N'}\n`;
  });
  copyText(tsv, '📋 Copy Dealer Summary');
}

function dlDealerCSV() {
  const dealers = ST.getAll('dealers');
  let csv = '\uFEFF"SIS Code","DJI Code","Name","Level","Contact","Phone","Email","Term","Credit Limit","Target Revenue","Won Revenue","Achieve%","DSEC","CRM","FH2","Lark","Google Map"\n';
  dealers.forEach(d => {
    const won = ST.pipelineByDealer(d.id).filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
    const target = Number(d.targetRevenue) || 0;
    csv += `"${d.sisCode||''}","${d.djiCode||''}","${esc(d.name)}","${d.level||''}","${esc(d.contact)}","${d.phone||''}","${d.email||''}","${d.creditTerm||''}","${d.creditLimit||''}","${target}","${won}","${target?Math.round(won/target*100):0}%","${d.dsecStatus||''}","${d.crmStatus||''}","${d.fh2Status||''}","${d.larkStatus||''}","${d.googleMap||''}"\n`;
  });
  dlBlob(csv, `dealers-${_td()}.csv`);
}

function copyDealerVisits(dealerId) {
  const cfg = getConfig();
  const d = ST.getOne('dealers', dealerId);
  const vts = ST.visitsByDealer(dealerId);
  let tsv = 'Date\tSale\tDealer Name\tOffline/Online\tDJI Dealer\tUpdate\tLocation\n';
  vts.forEach(v => {
    tsv += `${fD(v.date)}\t${v.saleName||cfg.saleName}\t${d?.name||''}\t${v.mode==='offline'?'Offline':'Online'}\t${v.djiDealer||''}\t${buildVisitUpdateText(v).replace(/[\t]/g,' ')}\t${v.location||''}\n`;
  });
  copyText(tsv, `📋 Copy Visit ${d?.name||''}`);
}

function dlDealerVisitsCSV(dealerId) {
  const cfg = getConfig();
  const d = ST.getOne('dealers', dealerId);
  const vts = ST.visitsByDealer(dealerId);
  let csv = '\uFEFF"Date","Sale","Dealer Name","Offline/Online","DJI Dealer","Update","Location"\n';
  vts.forEach(v => {
    csv += `"${fD(v.date)}","${v.saleName||cfg.saleName}","${d?.name||''}","${v.mode==='offline'?'Offline':'Online'}","${v.djiDealer||''}","${esc(buildVisitUpdateText(v))}","${v.location||''}"\n`;
  });
  dlBlob(csv, `visits-${d?.name||'dealer'}-${_td()}.csv`);
}

function buildVisitUpdateText(v) {
  var cfg = getConfig();
  var d = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
  var txt = '';

  // Header
  txt += '📍 Visit Report\n';
  txt += '━━━━━━━━━━━━━━━━━━━━\n\n';
  txt += 'Dealer: ' + (d ? d.name : '-') + '\n';
  txt += 'Date: ' + (v.date || '-') + '\n';
  if (v.time) txt += 'Time: ' + v.time + '\n';
  txt += 'Mode: ' + (v.mode === 'offline' ? 'Onsite' : 'Online') + '\n';
  txt += 'Sale: ' + (v.saleName || cfg.saleName || 'Siwawong') + '\n\n';

  // Topics
  if (v.topicData && v.topicData.length) {
    txt += '📋 ประเด็นที่คุย:\n';
    txt += '━━━━━━━━━━━━━━━━━━━━\n\n';
    var topicNum = 0;
    v.topicData.forEach(function(td) {
      if (!td.answered) return;
      topicNum++;
      var topic = null;
      for (var ti = 0; ti < (cfg.visitTopics || []).length; ti++) {
        if (cfg.visitTopics[ti].id === td.topicId) { topic = cfg.visitTopics[ti]; break; }
      }
      var topicName = topic ? topic.name : td.topicId;
      var topicPrompt = topic ? topic.prompt : '';
      var topicIcon = '📝';
      if (topic) {
        if (topic.group === 'sales') topicIcon = '📊';
        else if (topic.group === 'projects') topicIcon = '📁';
        else if (topic.group === 'cert') topicIcon = '📋';
        else if (topic.group === 'feedback') topicIcon = '💬';
        else if (topic.group === 'activities') topicIcon = '📅';
      }

      txt += topicNum + '. ' + topicIcon + ' ' + topicName + '\n';
      if (topicPrompt) txt += '💡 ' + topicPrompt + '\n';

      // Topic-specific data
      if (td.topicId === 'sales_perf') {
        if (v.revenue) txt += '📝 ยอดคำสั่งซื้อรวม: ฿' + fmtMoney(v.revenue) + '\n';
        if (v.expectedRevenue) txt += '📝 คาดว่า: ฿' + fmtMoney(v.expectedRevenue) + '\n';
      } else if (td.topicId === 'downstream') {
        if (v.customerSegment) txt += '📝 กลุ่มลูกค้า: ' + v.customerSegment + '\n';
      } else if (td.topicId === 'dsec') {
        if (td.status) txt += '📝 DSEC: ' + td.status + (td.certCount ? ' (' + td.certCount + ' ใบ)' : '') + '\n';
      } else if (td.topicId === 'crm') {
        if (td.status) txt += '📝 CRM: ' + td.status + '\n';
      } else if (td.topicId === 'fh2') {
        if (td.status) txt += '📝 FH2: ' + td.status + (td.certCount ? ' (' + td.certCount + ' ใบ)' : '') + '\n';
      } else if (td.topicId === 'lark') {
        if (td.status) txt += '📝 Lark: ' + td.status + '\n';
      }

      // Summary/Content
      var topicContent = td.content || td.summary || td.value || '';
      if (topicContent) txt += '📝 ' + topicContent + '\n';
      txt += '\n';
    });
  }

  // Revenue
  if (v.revenue || v.expectedRevenue) {
    txt += '💰 ยอดขาย:\n';
    if (v.revenue) txt += '• ยอดขายปัจจุบัน: ฿' + fmtMoney(v.revenue) + '\n';
    if (v.expectedRevenue) txt += '• เป้าที่คาด: ฿' + fmtMoney(v.expectedRevenue) + '\n';
    if (v.customerSegment) txt += '• กลุ่มลูกค้า: ' + v.customerSegment + '\n';
    txt += '\n';
  }

  // Pipeline Updates
  if (v.pipelineUpdates && v.pipelineUpdates.length) {
    txt += '📊 Pipeline Updates:\n';
    v.pipelineUpdates.forEach(function(pu) {
      var pipe = pu.pipeId ? ST.getOne('pipeline', pu.pipeId) : null;
      txt += '• ' + (pipe ? (pipe.projectName || '') : (pu.name || '-'));
      if (pu.model) txt += ' — ' + pu.model;
      if (pu.newStatus) txt += ' — ' + getPipeName(pu.newStatus);
      if (pu.note) txt += ' — ' + pu.note;
      txt += '\n';
    });
    txt += '\n';
  }

  // Forecast
  if (v.forecastNotes && v.forecastNotes.length) {
    var hasFc = false;
    v.forecastNotes.forEach(function(fn) { if (fn.month || fn.amount || fn.items) hasFc = true; });
    if (hasFc) {
      txt += '📦 Forecast:\n';
      v.forecastNotes.forEach(function(fn) {
        if (!fn.month && !fn.amount && !fn.items) return;
        txt += '• ' + (fn.month || '-');
        if (fn.amount) txt += ' — ฿' + fmtMoney(fn.amount);
        if (fn.items) txt += ' — ' + fn.items;
        txt += '\n';
      });
      txt += '\n';
    }
  }

  // Feedback
  if (v.feedbackItems && v.feedbackItems.length) {
    var hasFb = false;
    v.feedbackItems.forEach(function(f) { if (f && f.trim()) hasFb = true; });
    if (hasFb) {
      txt += '💡 Feedback:\n';
      v.feedbackItems.forEach(function(f, idx) {
        if (!f || !f.trim()) return;
        txt += (idx + 1) + '. ' + f + '\n';
      });
      txt += '\n';
    }
  }

  // Summary
  if (v.summary) {
    txt += '📝 สรุป:\n';
    txt += v.summary + '\n\n';
  }

  txt += '━━━━━━━━━━━━━━━━━━━━\n';
  txt += 'Best Regards,\n';
  txt += (v.saleName || cfg.saleName || 'Siwawong') + '\n';
  txt += 'SIS Distribution (Thailand) PLC\n';
  txt += 'DJI Authorized Distributor';

  return txt.trim();
}
// ================================================================
// TAB: ONBOARD
// ================================================================
function dealerOnboardTab(d) {
  var cfg = getConfig();
  var ob = d.onboarding || null;
  
  // Not started
  if (!ob || !ob.steps || !ob.steps.length) {
    return '<div class="card"><h2>🔄 Dealer Onboarding</h2>' +
      '<div class="empty"><div class="icon">🔄</div>' +
      '<p>ยังไม่ได้เริ่ม Onboarding</p>' +
      '<button class="btn bp" style="margin-top:8px" onclick="startOnboarding(\'' + d.id + '\')">🚀 เริ่ม Onboarding</button>' +
      '</div></div>';
  }
  
  // Calculate progress
  var total = ob.steps.length;
  var done = 0;
  var currentIdx = -1;
  for (var i = 0; i < ob.steps.length; i++) {
    if (ob.steps[i].done) done++;
    else if (currentIdx === -1) currentIdx = i;
  }
  var pct = total ? Math.round(done / total * 100) : 0;
  var isComplete = done === total;
  
  // Group steps
  var onboardSteps = [];
  var afterSteps = [];
  for (var i = 0; i < ob.steps.length; i++) {
    if (ob.steps[i].group === 'after') afterSteps.push({step: ob.steps[i], idx: i});
    else onboardSteps.push({step: ob.steps[i], idx: i});
  }

  var html = '<div class="card"><h2>🔄 Dealer Onboarding ' +
    (isComplete ? '<span class="tag tag-completed">✅ เสร็จสมบูรณ์</span>' : '<span class="tag tag-active">🔄 กำลังดำเนินการ</span>') +
    ' <span class="ml">' +
    '<button class="btn bsm bo" onclick="resetOnboarding(\'' + d.id + '\')">🔄 Reset</button>' +
    '</span></h2>' +
    
    // Summary
    '<div class="ob-summary">' +
    '<div class="ob-summary-card"><div class="val c2">' + done + '</div><div class="lbl">เสร็จแล้ว</div></div>' +
    '<div class="ob-summary-card"><div class="val c3">' + (total - done) + '</div><div class="lbl">เหลือ</div></div>' +
    '<div class="ob-summary-card"><div class="val ' + (pct >= 80 ? 'c2' : pct >= 50 ? 'c3' : 'c4') + '">' + pct + '%</div><div class="lbl">Progress</div></div>' +
    '</div>' +
    
    // Progress bar
    '<div class="ob-progress">' +
    '<div class="pb" style="flex:1;height:10px"><div class="pf ' + (pct >= 80 ? 'pf-green' : pct >= 50 ? 'pf-yellow' : 'pf-blue') + '" style="width:' + pct + '%"></div></div>' +
    '<div class="pct">' + pct + '%</div></div>' +
    
    (ob.startDate ? '<div style="font-size:.7rem;color:var(--text3);margin-bottom:10px">เริ่ม: ' + fD(ob.startDate) + ' (' + daysBetween(ob.startDate, _td()) + ' วันที่แล้ว)</div>' : '');

  // Onboard Steps
  html += '<div class="ob-group-label">📋 ขั้นตอน Onboarding</div>';
  for (var i = 0; i < onboardSteps.length; i++) {
    html += renderOnboardStep(d.id, onboardSteps[i].step, onboardSteps[i].idx, currentIdx);
  }
  
  // After Onboard Steps
  html += '<div class="ob-group-label">📋 หลัง Onboard</div>';
  for (var i = 0; i < afterSteps.length; i++) {
    html += renderOnboardStep(d.id, afterSteps[i].step, afterSteps[i].idx, currentIdx);
  }
  
  html += '</div>';
  return html;
}

function renderOnboardStep(dealerId, step, idx, currentIdx) {
  var isCurrent = idx === currentIdx;
  var cls = step.done ? 'done' : isCurrent ? 'current' : '';
  
  return '<div class="onboard-step ' + cls + '">' +
    '<div class="ob-num" onclick="toggleOnboardStep(\'' + dealerId + '\',' + idx + ')" style="cursor:pointer">' + 
    (step.done ? '✓' : (idx + 1)) + '</div>' +
    '<div class="ob-content">' +
    '<div class="ob-title">' + sanitize(step.title) + '</div>' +
    '<div class="ob-meta">' +
    (step.done && step.date ? '✅ ' + fD(step.date) : '') +
    (isCurrent ? '🔄 ขั้นตอนปัจจุบัน' : '') +
    (!step.done && !isCurrent ? '☐ ยังไม่ได้ทำ' : '') +
    '</div>' +
    (step.note ? '<div class="ob-note">' + sanitize(step.note) + '</div>' : '') +
    '</div>' +
    '<button class="btn bsm bo" onclick="editOnboardStep(\'' + dealerId + '\',' + idx + ')" style="flex-shrink:0">📝</button>' +
    '</div>';
}

// ================================================================
// ONBOARDING ACTIONS
// ================================================================
function startOnboarding(dealerId) {
  var cfg = getConfig();
  var templateSteps = cfg.onboardingSteps || [];
  var steps = [];
  for (var i = 0; i < templateSteps.length; i++) {
    steps.push({
      id: templateSteps[i].id,
      title: templateSteps[i].title,
      group: templateSteps[i].group || 'onboard',
      done: false,
      date: '',
      note: ''
    });
  }
  
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  
  ST.update('dealers', dealerId, {
    onboarding: {
      active: true,
      startDate: _td(),
      steps: steps
    }
  });
  
  toast('🚀 เริ่ม Onboarding!');
  render();
}

function toggleOnboardStep(dealerId, stepIdx) {
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.onboarding || !d.onboarding.steps || !d.onboarding.steps[stepIdx]) return;
  
  var step = d.onboarding.steps[stepIdx];
  step.done = !step.done;
  step.date = step.done ? _td() : '';
  
  // Auto-update Dealer cert status
  if (step.done) {
    var updates = {};
    if (step.id === 'dsec') updates.dsecStatus = 'pass';
    if (step.id === 'crm') updates.crmStatus = 'yes';
    if (step.id === 'fh2') updates.fh2Status = 'pass';
    if (step.id === 'lark') updates.larkStatus = 'added';
    if (step.id === 'authorized') {
      updates.level = d.level === 'Other' ? 'B' : d.level;
      updates.appointmentLetter = 'ออกแล้ว';
      updates.appointmentDate = _td();
    }
    if (Object.keys(updates).length) {
      for (var k in updates) d[k] = updates[k];
    }
  }
  
  ST.update('dealers', dealerId, {onboarding: d.onboarding});
  toast(step.done ? '✅ ' + step.title : '↩️ ยกเลิก ' + step.title);
  render();
}

function editOnboardStep(dealerId, stepIdx) {
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.onboarding || !d.onboarding.steps || !d.onboarding.steps[stepIdx]) return;
  var step = d.onboarding.steps[stepIdx];
  
  openM('📝 ' + step.title, '' +
    '<div class="fg"><label>สถานะ</label><div class="radio-g">' +
    '<label><input type="radio" name="obs_done" value="0"' + (!step.done ? ' checked' : '') + '><span>☐ ยังไม่เสร็จ</span></label>' +
    '<label><input type="radio" name="obs_done" value="1"' + (step.done ? ' checked' : '') + '><span>✅ เสร็จแล้ว</span></label>' +
    '</div></div>' +
    dpH('obs_date', step.date || _td(), 'วันที่เสร็จ') +
    '<div class="fg"><label>หมายเหตุ</label><textarea id="obs_note" rows="3">' + sanitize(step.note || '') + '</textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveOnboardStep(\'' + dealerId + '\',' + stepIdx + ')">💾 บันทึก</button>');
}

function saveOnboardStep(dealerId, stepIdx) {
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.onboarding || !d.onboarding.steps || !d.onboarding.steps[stepIdx]) return;
  
  var doneEl = document.querySelector('input[name="obs_done"]:checked');
  var noteEl = document.getElementById('obs_note');
  
  d.onboarding.steps[stepIdx].done = doneEl ? doneEl.value === '1' : false;
  d.onboarding.steps[stepIdx].date = dpG('obs_date') || '';
  d.onboarding.steps[stepIdx].note = noteEl ? noteEl.value.trim() : '';
  
  // Auto-update cert
  if (d.onboarding.steps[stepIdx].done) {
    var sid = d.onboarding.steps[stepIdx].id;
    if (sid === 'dsec') d.dsecStatus = 'pass';
    if (sid === 'crm') d.crmStatus = 'yes';
    if (sid === 'fh2') d.fh2Status = 'pass';
    if (sid === 'lark') d.larkStatus = 'added';
    if (sid === 'authorized') {
      if (d.level === 'Other') d.level = 'B';
      d.appointmentLetter = 'ออกแล้ว';
      d.appointmentDate = d.onboarding.steps[stepIdx].date || _td();
    }
  }
  
  ST.update('dealers', dealerId, d);
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

function resetOnboarding(dealerId) {
  if (!confirm('⚠️ Reset Onboarding? ข้อมูลขั้นตอนจะถูกลบ')) return;
  ST.update('dealers', dealerId, {onboarding: null});
  toast('🔄 Reset แล้ว');
  render();
}
// ================================================================
// RENDER DEALER CONTACTS (แสดงรายชื่อผู้ติดต่อของ Dealer)
// ================================================================
function renderDealerContacts(d) {
  var contacts = d.contacts || [];
  
  var h = '<div class="card"><h2>📞 ผู้ติดต่อ (' + contacts.length + ')';
  h += '<span class="ml"><button class="btn bsm bp" onclick="showAddContactM(\'' + d.id + '\')">➕</button></span></h2>';
  
  if (!contacts.length) {
    h += '<div class="empty"><p>ยังไม่มีผู้ติดต่อ — กด ➕ เพื่อเพิ่ม</p></div>';
    h += '</div>';
    return h;
  }
  
  for (var i = 0; i < contacts.length; i++) {
    var c = contacts[i];
    h += '<div class="contact-card' + (c.primary ? ' contact-primary' : '') + '">';
    h += '<div class="contact-header">';
    h += '<div class="contact-name">' + (c.primary ? '⭐ ' : '') + sanitize(c.name) + '</div>';
    if (c.role) h += '<div class="contact-role">' + sanitize(c.role) + '</div>';
    h += '<button class="btn-xs" onclick="showEditContactM(\'' + d.id + '\',' + i + ')">✏️</button>';
    h += '</div>';
    
    h += '<div class="contact-actions">';
    if (c.phone) h += '<a href="tel:' + c.phone + '" class="contact-btn" onclick="event.stopPropagation()">📞 ' + sanitize(c.phone) + '</a>';
    if (c.line) h += '<span class="contact-btn">💬 ' + sanitize(c.line) + '</span>';
    if (c.email) h += '<a href="mailto:' + c.email + '" class="contact-btn" onclick="event.stopPropagation()">📧 ' + sanitize(c.email) + '</a>';
    h += '</div>';
    
    if (c.note) h += '<div class="contact-note">' + sanitize(c.note) + '</div>';
    h += '</div>';
  }
  
  h += '</div>';
  return h;
}

// ================================================================
// SHOW ADD CONTACT MODAL
// ================================================================
function showAddContactM(dealerId) {
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>👤 ชื่อ *</label><input type="text" id="ct_name" class="fm-input" placeholder="เช่น คุณสมชาย"></div>';
  h += '<div class="fm-group"><label>💼 ตำแหน่ง/บทบาท</label><input type="text" id="ct_role" class="fm-input" placeholder="เช่น MD, Purchase, Technical"></div>';
  h += '<div class="fr">';
  h += '<div class="fm-group"><label>📞 เบอร์โทร</label><input type="tel" id="ct_phone" class="fm-input" placeholder="081-xxx-xxxx"></div>';
  h += '<div class="fm-group"><label>💬 LINE ID</label><input type="text" id="ct_line" class="fm-input" placeholder="LINE ID"></div>';
  h += '</div>';
  h += '<div class="fm-group"><label>📧 Email</label><input type="email" id="ct_email" class="fm-input" placeholder="email@company.com"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="ct_note" rows="2" class="fm-input" placeholder="เช่น ติดต่อเรื่อง Technical ได้ดี"></textarea></div>';
  h += '<div class="fm-group"><label>⭐ ผู้ติดต่อหลัก</label><div class="radio-g"><label><input type="radio" name="ct_primary" value="1"><span>ใช่</span></label><label><input type="radio" name="ct_primary" value="0" checked><span>ไม่</span></label></div></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveContact(\'' + dealerId + '\')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  
  openM('➕ เพิ่มผู้ติดต่อ', h);
}

// ================================================================
// SAVE CONTACT
// ================================================================
function saveContact(dealerId) {
  var name = (document.getElementById('ct_name').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }
  
  var contact = {
    id: 'ct_' + Date.now(),
    name: name,
    role: (document.getElementById('ct_role').value || '').trim(),
    phone: (document.getElementById('ct_phone').value || '').trim(),
    line: (document.getElementById('ct_line').value || '').trim(),
    email: (document.getElementById('ct_email').value || '').trim(),
    note: (document.getElementById('ct_note').value || '').trim(),
    primary: document.querySelector('input[name="ct_primary"]:checked') ? document.querySelector('input[name="ct_primary"]:checked').value === '1' : false
  };
  
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  if (!d.contacts) d.contacts = [];
  d.contacts.push(contact);
  ST.update('dealers', dealerId, {contacts: d.contacts});
  toast('✅ เพิ่มผู้ติดต่อ: ' + name);
  closeMForce();
  render();
}

// ================================================================
// SHOW EDIT CONTACT MODAL
// ================================================================
function showEditContactM(dealerId, ctIdx) {
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.contacts || !d.contacts[ctIdx]) return;
  var c = d.contacts[ctIdx];
  
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>👤 ชื่อ *</label><input type="text" id="ct_name" class="fm-input" value="' + sanitize(c.name || '') + '"></div>';
  h += '<div class="fm-group"><label>💼 ตำแหน่ง/บทบาท</label><input type="text" id="ct_role" class="fm-input" value="' + sanitize(c.role || '') + '"></div>';
  h += '<div class="fr">';
  h += '<div class="fm-group"><label>📞 เบอร์โทร</label><input type="tel" id="ct_phone" class="fm-input" value="' + sanitize(c.phone || '') + '"></div>';
  h += '<div class="fm-group"><label>💬 LINE ID</label><input type="text" id="ct_line" class="fm-input" value="' + sanitize(c.line || '') + '"></div>';
  h += '</div>';
  h += '<div class="fm-group"><label>📧 Email</label><input type="email" id="ct_email" class="fm-input" value="' + sanitize(c.email || '') + '"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="ct_note" rows="2" class="fm-input">' + sanitize(c.note || '') + '</textarea></div>';
  h += '<div class="fm-group"><label>⭐ ผู้ติดต่อหลัก</label><div class="radio-g"><label><input type="radio" name="ct_primary" value="1"' + (c.primary ? ' checked' : '') + '><span>ใช่</span></label><label><input type="radio" name="ct_primary" value="0"' + (!c.primary ? ' checked' : '') + '><span>ไม่</span></label></div></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="updateContact(\'' + dealerId + '\',' + ctIdx + ')">💾 บันทึก</button>';
  h += '<button class="btn bd" onclick="deleteContact(\'' + dealerId + '\',' + ctIdx + ')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  
  openM('✏️ แก้ไขผู้ติดต่อ', h);
}

// ================================================================
// UPDATE CONTACT
// ================================================================
function updateContact(dealerId, ctIdx) {
  var name = (document.getElementById('ct_name').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }
  
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.contacts || !d.contacts[ctIdx]) return;
  
  d.contacts[ctIdx].name = name;
  d.contacts[ctIdx].role = (document.getElementById('ct_role').value || '').trim();
  d.contacts[ctIdx].phone = (document.getElementById('ct_phone').value || '').trim();
  d.contacts[ctIdx].line = (document.getElementById('ct_line').value || '').trim();
  d.contacts[ctIdx].email = (document.getElementById('ct_email').value || '').trim();
  d.contacts[ctIdx].note = (document.getElementById('ct_note').value || '').trim();
  d.contacts[ctIdx].primary = document.querySelector('input[name="ct_primary"]:checked') ? document.querySelector('input[name="ct_primary"]:checked').value === '1' : false;
  
  ST.update('dealers', dealerId, {contacts: d.contacts});
  toast('💾 บันทึกแล้ว');
  closeMForce();
  render();
}

// ================================================================
// DELETE CONTACT
// ================================================================
function deleteContact(dealerId, ctIdx) {
  if (!confirm('ลบผู้ติดต่อนี้?')) return;
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.contacts) return;
  d.contacts.splice(ctIdx, 1);
  ST.update('dealers', dealerId, {contacts: d.contacts});
  toast('🗑️ ลบแล้ว');
  closeMForce();
  render();
}
// ================================================================
// TAB: TASKS (งานของ Dealer)
// ================================================================
function dealerTasksTab(d) {
  var tasks = getTasksByDealer(d.id);
  var active = tasks.filter(function(t) { return t.status === 'active'; });
  var completed = tasks.filter(function(t) { return t.status === 'completed'; });

  var h = '<div class="card"><h2>📋 งาน (' + active.length + ' active / ' + tasks.length + ' total)';
  h += '<span class="ml">';
  h += '<button class="btn bsm bp" onclick="showTaskM(\'\',\'' + d.id + '\')">➕</button>';
  h += '</span></h2>';

  if (!tasks.length) {
    h += '<div class="empty"><p>ยังไม่มีงาน — กด ➕ เพื่อเพิ่ม</p></div>';
    h += '</div>';
    return h;
  }

  // Active tasks
  if (active.length) {
    for (var i = 0; i < active.length; i++) {
      var t = active[i];
      var pipe = t.pipeId ? ST.getOne('pipeline', t.pipeId) : null;
      var pg = prog(t);
      h += '<div class="li ' + dlC(t.dueDate, false) + '" onclick="go(\'taskDetail\',{taskId:\'' + t.id + '\'})">';
      h += '<div class="lm">';
      h += '<div class="lt">' + sanitize(t.title) + ' ' + sTag(t.status) + ' ' + pTag(t.priority);
      if (t.sequential) h += ' <span class="tag tag-count">⚡</span>';
      h += '</div>';
      h += '<div class="ls">';
      if (t.category) h += '📂 ' + t.category + ' • ';
      if (pipe) h += '📊 ' + sanitize(pipe.projectName || '') + ' • ';
      h += fD(t.dueDate) + ' ' + dlB(t.dueDate, false);
      h += '</div>';
      if (t.steps && t.steps.length) {
        h += '<div class="pb"><div class="pf pf-blue" style="width:' + pg + '%"></div></div>';
        h += '<div class="ls">' + pg + '%</div>';
      }
      h += '</div></div>';
    }
  }

  // Completed tasks (collapsible)
  if (completed.length) {
    h += '<div class="pa-done-toggle" onclick="toggleDealerDoneTasks()">✅ เสร็จแล้ว (' + completed.length + ') <span id="ddtArrow">▶</span></div>';
    h += '<div id="ddtList" style="display:none">';
    for (var i = 0; i < completed.length; i++) {
      var t = completed[i];
      h += '<div class="li dlo" onclick="go(\'taskDetail\',{taskId:\'' + t.id + '\'})">';
      h += '<div class="lm"><div class="lt" style="text-decoration:line-through;opacity:0.6">' + sanitize(t.title) + '</div>';
      h += '<div class="ls">' + fD(t.dueDate) + '</div></div></div>';
    }
    h += '</div>';
  }

  h += '</div>';
  return h;
}

// ================================================================
// HELPER: GET TASKS BY DEALER
// ================================================================
function getTasksByDealer(dealerId) {
  return ST.filter('tasks', function(t) {
    return t.dealerId === dealerId;
  });
}

// ================================================================
// TOGGLE DONE TASKS (สำหรับ Dealer Detail)
// ================================================================
function toggleDealerDoneTasks() {
  var el = document.getElementById('ddtList');
  var arrow = document.getElementById('ddtArrow');
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
// CLIENT PRESENTATION VIEW (Popup สำหรับลูกค้าดู) - FINAL STABLE VERSION
// ================================================================
function openClientView(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  
  var win = window.open('', '_blank');
  if (!win) { toast('กรุณาอนุญาต Popup'); return; }
  
  var html = buildClientViewHTML(dealerId, '');
  win.document.write(html);
  win.document.close();
}

function buildClientViewHTML(dealerId, pipeId) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return '<h1>Not Found</h1>';
  
  var allPipes = ST.pipelineByDealer(dealerId);
  var activePipes = allPipes.filter(function(p) { return ['lost','on_hold'].indexOf(p.status) === -1; });
  var cfg = getConfig();
  
  // Collect models
  var modelSummary = {};
  var totalQty = 0;
  activePipes.forEach(function(p) {
    var items = getPipeItems(p);
    items.forEach(function(it) {
      var model = it.model || 'Other';
      if (!modelSummary[model]) modelSummary[model] = 0;
      var qty = Number(it.qty) || 1;
      modelSummary[model] += qty;
      totalQty += qty;
    });
  });

  // เตรียมข้อมูล pipeline สำหรับใส่ใน JavaScript
  var pipesData = [];
  for (var i = 0; i < activePipes.length; i++) {
    var p = activePipes[i];
    pipesData.push({
      id: p.id,
      projectName: p.projectName,
      endUserTH: p.endUserTH,
      endUserEN: p.endUserEN,
      unitType: p.unitType,
      status: p.status,
      biddingDate: p.biddingDate,
      shipmentDate: p.shipmentDate,
      tor: p.tor,
      nextAction: p.nextAction,
      forecastAmount: p.forecastAmount,
      items: getPipeItems(p),
      actions: getPipeActions().filter(function(a) { return a.pipeId === p.id && a.status === "pending"; }),
      logs: (function(pid) {
        var logs = ST.pipeLogsByPipe(pid);
        var filtered = [];
        var safeTypes = ["update","progress","status_change","win","action"];
        for (var j = 0; j < logs.length; j++) {
          var l = logs[j];
          if (safeTypes.indexOf(l.type) === -1) continue;
          var c = (l.content || "").toLowerCase();
          if (c.indexOf("forecast") !== -1 || c.indexOf("ราคา") !== -1 || c.indexOf("price") !== -1 || c.indexOf("lost") !== -1 || c.indexOf("หมายเหตุ") !== -1) continue;
          filtered.push(l);
        }
        return filtered.slice(0, 10);
      })(p.id)
    });
  }

  // Build page
  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
  h += '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
  h += '<title>Pipeline — ' + d.name + '</title>';
  h += '<style>' + getClientViewCSS() + '</style>';
  h += '</head><body>';
  
  h += '<div class="cv-container" id="cvContainer">';
  
  // Header
  h += '<div class="cv-header" id="cvHeader">';
  h += '<div class="cv-logo">🚁 DJI Enterprise</div>';
  h += '<div class="cv-dealer-name">' + sanitize(d.name) + '</div>';
  h += '<div class="cv-dealer-sub">DJI Authorized Dealer</div>';
  h += '</div>';

  // Main content
  h += '<div id="cvMainContent">';
  if (pipeId) {
    var foundPipe = null;
    for (var i = 0; i < pipesData.length; i++) {
      if (pipesData[i].id === pipeId) { foundPipe = pipesData[i]; break; }
    }
    h += buildDetailPageHTML(foundPipe || pipesData[0], dealerId);
  } else {
    h += buildOverviewPageHTML(d, activePipes, modelSummary, totalQty, dealerId);
  }
  h += '</div>';

  // Footer
  h += '<div class="cv-footer" id="cvFooter">';
  h += '<div>Powered by SIS Distribution (Thailand) PLC — DJI Authorized Distributor</div>';
  h += '<div>' + (cfg.saleName || 'Siwawong') + ' | ' + _td() + '</div>';
  h += '</div>';

  h += '</div>';

  // JavaScript functions
  h += '<script>';
  h += 'var CV_PIPES = ' + JSON.stringify(pipesData) + ';';
  h += 'var CV_DEALER_ID = "' + dealerId + '";';
  h += 'var cvShowVal=false;';
  
  h += 'function esc(s){if(!s)return"";return String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;");}';
  h += 'function fDShort(iso){if(!iso)return"-";var p=iso.split("T")[0].split("-");return p[2]+"/"+p[1];}';
  h += 'function fmtMoneyShort(n){if(!n)return"-";n=Number(n);if(n>=1000000)return(n/1000000).toFixed(1)+"M";if(n>=1000)return Math.round(n/1000)+"K";return n.toLocaleString();}';
  h += 'function ftParseDate(str){if(!str)return null;var p=str.split("/");if(p.length!==3)return null;return new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));}';
  h += 'function getStatusLabel(s){var m={"prospect":"🔵 Prospect","tor_review":"🟣 TOR Review","quotation":"🟠 Quotation","bidding":"🟡 Bidding","negotiation":"🔵 Negotiation","win":"🟢 Win","ordered":"🟢 Ordered","delivered":"✅ Delivered","recurring":"🔄 Recurring"};return"<span class=\"cv-status cv-st-\"+s+"\">"+(m[s]||s)+"</span>";}';
  
  h += 'function toggleCVValue(){cvShowVal=!cvShowVal;var cols=document.querySelectorAll(".cv-val-col");for(var i=0;i<cols.length;i++){cols[i].style.display=cvShowVal?"table-cell":"none";}var lbl=document.getElementById("cvValLabel");if(lbl)lbl.textContent=cvShowVal?"ซ่อนมูลค่า":"แสดงมูลค่า";}';
  
  h += 'function saveCVUpdate(pipeId, dealerId){var text=document.getElementById("cvUpdateInput").value.trim();if(!text){alert("กรุณาพิมพ์ข้อความ");return;}if(window.opener){window.opener.postMessage({type:"CV_UPDATE",pipeId:pipeId,dealerId:dealerId,text:text},"*");alert("✅ ส่งอัพเดทเรียบร้อยแล้ว! ขอบคุณครับ");document.getElementById("cvUpdateInput").value="";}else{alert("ไม่สามารถส่งอัพเดทได้ กรุณาแจ้งพนักงานขาย");}}';
  
  h += 'function showCVDetail(pipeId, dealerId){var p=null;for(var i=0;i<CV_PIPES.length;i++){if(CV_PIPES[i].id===pipeId){p=CV_PIPES[i];break;}}if(!p){alert("ไม่พบข้อมูล");return;}var headerHtml=document.getElementById("cvHeader").outerHTML;var footerHtml=document.getElementById("cvFooter").outerHTML;var h2=headerHtml;h2+="<div class=\"cv-back\" onclick=\"location.reload()\">← กลับ</div>";h2+=buildDetailPage(p, dealerId);h2+=footerHtml;document.getElementById("cvContainer").innerHTML=h2;}';
  
  h += 'function buildDetailPage(p, dealerId){var h2="";h2+="<div class=\"cv-section\"><div class=\"cv-section-title\">📊 "+esc(p.projectName||"-")+"</div>";h2+="<div class=\"cv-detail-grid\">";h2+="<div class=\"cv-detail-item\"><div class=\"cv-detail-label\">Status</div><div class=\"cv-detail-val\">"+getStatusLabel(p.status)+"</div></div>";h2+="<div class=\"cv-detail-item\"><div class=\"cv-detail-label\">End User</div><div class=\"cv-detail-val\">"+esc(p.endUserTH||p.endUserEN||"-")+"</div></div>";h2+="<div class=\"cv-detail-item\"><div class=\"cv-detail-label\">Unit Type</div><div class=\"cv-detail-val\">"+(p.unitType||"-")+"</div></div>";h2+="<div class=\"cv-detail-item\"><div class=\"cv-detail-label\">Bidding</div><div class=\"cv-detail-val\">"+(p.biddingDate||"-")+"</div></div>";h2+="<div class=\"cv-detail-item\"><div class=\"cv-detail-label\">Shipment</div><div class=\"cv-detail-val\">"+(p.shipmentDate||"-")+"</div></div>";h2+="<div class=\"cv-detail-item\"><div class=\"cv-detail-label\">TOR</div><div class=\"cv-detail-val\">"+(p.tor||"-")+"</div></div>";h2+="</div></div>";if(p.items&&p.items.length){h2+="<div class=\"cv-section\"><div class=\"cv-section-title\">📦 Products ("+p.items.length+")</div><table class=\"cv-table\"><thead><tr><th>#</th><th>Model</th><th>QTY</th></tr></thead><tbody>";for(var i=0;i<p.items.length;i++){var it=p.items[i];h2+="<td><td class=\"cv-num\">"+(i+1)+"</td>";h2+="<td>"+esc(it.model||"-")+"</td>";h2+="<td>"+(it.qty||1)+"</td>";h2+="</tr>";}h2+="</tbody></table></div>";}if(p.actions&&p.actions.length){h2+="<div class=\"cv-section\"><div class=\"cv-section-title\">🎯 Action Items ("+p.actions.length+")</div>";for(var i=0;i<p.actions.length;i++){var a=p.actions[i];h2+="<div class=\"cv-action\"><div class=\"cv-action-text\">⏳ "+esc(a.text)+"</div>";if(a.dueDate)h2+="<div class=\"cv-action-meta\">📅 กำหนด: "+a.dueDate+"</div>";h2+="</div>";}h2+="</div>";}if(p.logs&&p.logs.length){h2+="<div class=\"cv-section\"><div class=\"cv-section-title\">📝 Updates ("+p.logs.length+")</div>";for(var i=0;i<p.logs.length;i++){var l=p.logs[i];var icon=l.type==="progress"?"🟢":l.type==="win"?"✅":l.type==="status_change"?"🔄":"📝";var dateStr=l.date?l.date.split("T")[0]:"-";h2+="<div class=\"cv-log\"><span class=\"cv-log-date\">"+dateStr+"</span><span class=\"cv-log-icon\">"+icon+"</span><span class=\"cv-log-text\">"+esc((l.content||"").substr(0,80))+"</span></div>";}h2+="</div>";}h2+="<div class=\"cv-section\"><div class=\"cv-section-title\">✏️ สอบถามเพิ่มเติม / อัพเดท</div><div style=\"display:flex;gap:6px\"><input type=\"text\" id=\"cvUpdateInput\" placeholder=\"พิมพ์ข้อความอัพเดท...\" style=\"flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#e0e6f0;font-size:13px\"><button onclick=\"saveCVUpdate(\'"+p.id+"\', \'"+dealerId+"\')\" style=\"padding:8px 16px;border-radius:8px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-size:13px\">💾 ส่งอัพเดท</button></div><div style=\"font-size:11px;color:#8892b0;margin-top:4px\">💡 อัพเดทจะถูกบันทึกทันที</div></div>";return h2;}';
  
  h += '<\/script>';
  h += '</body></html>';
  
  return h;
}

function buildOverviewPageHTML(d, activePipes, modelSummary, totalQty, dealerId) {
  var modelList = Object.keys(modelSummary).sort(function(a, b) { return modelSummary[b] - modelSummary[a]; });
  var maxQty = modelList.length ? modelSummary[modelList[0]] : 1;
  
  var h = '';
  
  h += '<div class="cv-stats">';
  h += '<div class="cv-stat"><div class="cv-stat-val">' + activePipes.length + '</div><div class="cv-stat-label">Projects</div></div>';
  h += '<div class="cv-stat"><div class="cv-stat-val">' + totalQty + '</div><div class="cv-stat-label">Units</div></div>';
  h += '<div class="cv-stat"><div class="cv-stat-val">' + modelList.length + '</div><div class="cv-stat-label">Models</div></div>';
  h += '</div>';

  h += '<div class="cv-section">';
  h += '<div class="cv-section-title">📊 Projects Overview</div>';
  h += '<div style="margin-bottom:8px;text-align:right"><button class="cv-toggle-btn" onclick="toggleCVValue()">💰 <span id="cvValLabel">แสดงมูลค่า</span></button></div>';
  h += '<table class="cv-table">';
  h += '<thead><tr><th>#</th><th>Project</th><th>End User</th><th>Products</th><th class="cv-val-col" style="display:none">Value</th><th>Status</th><th>Bidding</th><th>Shipment</th><th>Action</th></tr></thead>';
  h += '<tbody>';
  
  var statusOrder = ['bidding','negotiation','quotation','tor_review','prospect','win','ordered','delivered','recurring'];
  activePipes.sort(function(a, b) {
    var ia = statusOrder.indexOf(a.status); if (ia === -1) ia = 99;
    var ib = statusOrder.indexOf(b.status); if (ib === -1) ib = 99;
    if (ia !== ib) return ia - ib;
    return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0);
  });

  for (var i = 0; i < activePipes.length; i++) {
    var p = activePipes[i];
    var items = getPipeItems(p);
    var modelText = items.map(function(it) { return (it.model || '-') + (it.qty > 1 ? ' x' + it.qty : ''); }).join(', ');
    
    h += '<tr class="cv-row" onclick="showCVDetail(\'' + p.id + '\', \'' + dealerId + '\')">';
    h += '<td class="cv-num">' + (i + 1) + '</td>';
    h += '<td class="cv-project">' + sanitize((p.projectName || '').substr(0, 40)) + '</td>';
    h += '<td>' + sanitize((p.endUserTH || p.endUserEN || '').substr(0, 25)) + '</td>';
    h += '<td class="cv-model">' + sanitize(modelText) + '</td>';
    h += '<td class="cv-val-col" style="display:none">' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</td>';
    h += '<td>' + getClientStatusLabel(p.status) + '</td>';
    h += '<td>' + (p.biddingDate ? fDShort(p.biddingDate) : '-') + '</td>';
    h += '<td>' + (p.shipmentDate ? fDShort(p.shipmentDate) : '-') + '</td>';
    h += '<td>' + (p.nextAction ? sanitize((p.nextAction || '').substr(0, 20)) : '-') + '</td>';
    h += '</tr>';
  }
  
  h += '</tbody></table></div>';

  h += '<div class="cv-section">';
  h += '<div class="cv-section-title">📦 Products Summary</div>';
  h += '<div class="cv-products">';
  for (var i = 0; i < modelList.length; i++) {
    var model = modelList[i];
    var qty = modelSummary[model];
    var pct = Math.max(10, Math.round(qty / maxQty * 100));
    h += '<div class="cv-product-row">';
    h += '<div class="cv-product-name">' + sanitize(model) + ' <span class="cv-product-qty">x' + qty + '</span></div>';
    h += '<div class="cv-product-bar"><div class="cv-product-fill" style="width:' + pct + '%"></div></div>';
    h += '</div>';
  }
  h += '</div></div>';

  var actions = getPipeActions().filter(function(a) { return a.status === 'pending'; });
  var dealerActions = [];
  for (var i = 0; i < actions.length; i++) {
    var pipe = ST.getOne('pipeline', actions[i].pipeId);
    if (pipe && pipe.dealerId === dealerId) {
      dealerActions.push({action: actions[i], pipe: pipe});
    }
  }

  if (dealerActions.length) {
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">🎯 Action Items (' + dealerActions.length + ')</div>';
    var nowDate = new Date();
    nowDate.setHours(0, 0, 0, 0);
    for (var i = 0; i < dealerActions.length; i++) {
      var da = dealerActions[i];
      var due = ftParseDate(da.action.dueDate);
      var daysLeft = due ? Math.ceil((due - nowDate) / 86400000) : 999;
      var urgClass = daysLeft < 0 ? 'cv-action-overdue' : daysLeft <= 3 ? 'cv-action-urgent' : '';
      h += '<div class="cv-action ' + urgClass + '">';
      h += '<div class="cv-action-text">⏳ ' + sanitize(da.action.text) + '</div>';
      h += '<div class="cv-action-meta">📊 ' + sanitize((da.pipe.projectName || '').substr(0, 30));
      if (da.action.dueDate) h += ' • 📅 ' + da.action.dueDate;
      if (daysLeft < 0) h += ' <span class="cv-overdue-badge">เกิน ' + Math.abs(daysLeft) + ' วัน</span>';
      else if (daysLeft <= 3) h += ' <span class="cv-urgent-badge">อีก ' + daysLeft + ' วัน</span>';
      h += '</div></div>';
    }
    h += '</div>';
  }
  
  return h;
}

function buildDetailPageHTML(p, dealerId) {
  if (!p) return '<div class="cv-section"><div class="cv-section-title">ไม่พบข้อมูล</div></div>';
  
  var h = '';
  h += '<div class="cv-back" onclick="location.reload()">← กลับ</div>';
  h += '<div class="cv-section">';
  h += '<div class="cv-section-title">📊 ' + sanitize(p.projectName || '-') + '</div>';
  h += '<div class="cv-detail-grid">';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Status</div><div class="cv-detail-val">' + getClientStatusLabel(p.status) + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">End User</div><div class="cv-detail-val">' + sanitize(p.endUserTH || p.endUserEN || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Unit Type</div><div class="cv-detail-val">' + (p.unitType || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Bidding Date</div><div class="cv-detail-val">' + (p.biddingDate || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Shipment Date</div><div class="cv-detail-val">' + (p.shipmentDate || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">TOR</div><div class="cv-detail-val">' + (p.tor || '-') + '</div></div>';
  h += '</div></div>';

  if (p.items && p.items.length) {
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">📦 Products (' + p.items.length + ')</div>';
    h += '<table class="cv-table"><thead><tr><th>#</th><th>Model</th><th>QTY</th></tr></thead><tbody>';
    for (var i = 0; i < p.items.length; i++) {
      var it = p.items[i];
      h += '<tr>';
      h += '<td class="cv-num">' + (i + 1) + '</td>';
      h += '<td>' + sanitize(it.model || '-') + '</td>';
      h += '<td>' + (it.qty || 1) + '</td>';
      h += '</tr>';
    }
    h += '</tbody></table></div>';
  }

  if (p.actions && p.actions.length) {
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">🎯 Action Items (' + p.actions.length + ')</div>';
    for (var i = 0; i < p.actions.length; i++) {
      var a = p.actions[i];
      h += '<div class="cv-action">';
      h += '<div class="cv-action-text">⏳ ' + sanitize(a.text) + '</div>';
      if (a.dueDate) h += '<div class="cv-action-meta">📅 กำหนด: ' + a.dueDate + '</div>';
      h += '</div>';
    }
    h += '</div>';
  }

  if (p.logs && p.logs.length) {
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">📝 Updates (' + p.logs.length + ')</div>';
    for (var i = 0; i < p.logs.length; i++) {
      var l = p.logs[i];
      var icon = l.type === 'progress' ? '🟢' : l.type === 'win' ? '✅' : l.type === 'status_change' ? '🔄' : '📝';
      var dateStr = l.date ? l.date.split('T')[0] : '-';
      h += '<div class="cv-log">';
      h += '<span class="cv-log-date">' + dateStr + '</span>';
      h += '<span class="cv-log-icon">' + icon + '</span>';
      h += '<span class="cv-log-text">' + sanitize((l.content || '').substr(0, 80)) + '</span>';
      h += '</div>';
    }
    h += '</div>';
  }

  h += '<div class="cv-section">';
  h += '<div class="cv-section-title">✏️ สอบถามเพิ่มเติม / อัพเดท</div>';
  h += '<div style="display:flex;gap:6px">';
  h += '<input type="text" id="cvUpdateInput" placeholder="พิมพ์ข้อความอัพเดท..." style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#e0e6f0;font-size:13px">';
  h += '<button onclick="saveCVUpdate(\'' + p.id + '\', \'' + dealerId + '\')" style="padding:8px 16px;border-radius:8px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-size:13px">💾 ส่งอัพเดท</button>';
  h += '</div>';
  h += '<div style="font-size:11px;color:#8892b0;margin-top:4px">💡 อัพเดทจะถูกบันทึกทันที</div>';
  h += '</div>';
  
  return h;
}

function buildClientProjectDetail(pipeId, dealerId) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return '<div class="cv-section"><div class="cv-section-title">ไม่พบข้อมูล</div></div>';
  
  var items = getPipeItems(p);
  var logs = ST.pipeLogsByPipe(p.id);
  var actions = getPipeActions().filter(function(a) { return a.pipeId === pipeId && a.status === 'pending'; });

  var h = '';
  h += '<div class="cv-back" onclick="location.reload()">← กลับ</div>';
  h += '<div class="cv-section">';
  h += '<div class="cv-section-title">📊 ' + sanitize(p.projectName || '-') + '</div>';
  h += '<div class="cv-detail-grid">';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Status</div><div class="cv-detail-val">' + getClientStatusLabel(p.status) + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">End User</div><div class="cv-detail-val">' + sanitize(p.endUserTH || p.endUserEN || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Unit Type</div><div class="cv-detail-val">' + (p.unitType || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Bidding Date</div><div class="cv-detail-val">' + (p.biddingDate || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Shipment Date</div><div class="cv-detail-val">' + (p.shipmentDate || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">TOR</div><div class="cv-detail-val">' + (p.tor || '-') + '</div></div>';
  h += '</div></div>';

  if (items.length) {
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">📦 Products (' + items.length + ')</div>';
    h += '<table class="cv-table"><thead><tr><th>#</th><th>Model</th><th>QTY</th></tr></thead><tbody>';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      h += '<tr>';
      h += '<td class="cv-num">' + (i + 1) + '</td>';
      h += '<td>' + sanitize(it.model || '-') + '</td>';
      h += '<td>' + (it.qty || 1) + '</td>';
      h += '</tr>';
    }
    h += '</tbody></table></div>';
  }

  if (actions.length) {
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">🎯 Action Items (' + actions.length + ')</div>';
    var nowDate = new Date();
    nowDate.setHours(0, 0, 0, 0);
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i];
      var due = ftParseDate(a.dueDate);
      var daysLeft = due ? Math.ceil((due - nowDate) / 86400000) : 999;
      var urgClass = daysLeft < 0 ? 'cv-action-overdue' : daysLeft <= 3 ? 'cv-action-urgent' : '';
      h += '<div class="cv-action ' + urgClass + '">';
      h += '<div class="cv-action-text">⏳ ' + sanitize(a.text) + '</div>';
      if (a.dueDate) h += '<div class="cv-action-meta">📅 กำหนด: ' + a.dueDate + '</div>';
      h += '</div>';
    }
    h += '</div>';
  }

  var safeTypes = ['update', 'progress', 'status_change', 'win', 'action'];
  var filteredLogs = [];
  for (var i = 0; i < logs.length; i++) {
    var l = logs[i];
    if (safeTypes.indexOf(l.type) === -1 && l.type !== 'note') continue;
    if (l.type === 'note') continue;
    var content = (l.content || '').toLowerCase();
    if (content.indexOf('forecast') !== -1) continue;
    if (content.indexOf('ราคา') !== -1) continue;
    if (content.indexOf('price') !== -1) continue;
    if (content.indexOf('lost') !== -1) continue;
    if (content.indexOf('หมายเหตุ') !== -1) continue;
    filteredLogs.push(l);
  }

  if (filteredLogs.length) {
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">📝 Updates (' + filteredLogs.length + ')</div>';
    for (var i = 0; i < Math.min(filteredLogs.length, 10); i++) {
      var l = filteredLogs[i];
      var dateStr = l.date ? l.date.split('T')[0] : '-';
      var icon = l.type === 'progress' ? '🟢' : l.type === 'win' ? '✅' : l.type === 'status_change' ? '🔄' : l.type === 'action' ? '⏳' : '📝';
      h += '<div class="cv-log">';
      h += '<span class="cv-log-date">' + dateStr + '</span>';
      h += '<span class="cv-log-icon">' + icon + '</span>';
      h += '<span class="cv-log-text">' + sanitize((l.content || '').substr(0, 80)) + '</span>';
      h += '</div>';
    }
    h += '</div>';
  }

  h += '<div class="cv-section">';
  h += '<div class="cv-section-title">✏️ สอบถามเพิ่มเติม / อัพเดท</div>';
  h += '<div style="display:flex;gap:6px">';
  h += '<input type="text" id="cvUpdateInput" placeholder="พิมพ์ข้อความอัพเดท..." style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#e0e6f0;font-size:13px">';
  h += '<button onclick="saveCVUpdate(\'' + pipeId + '\', \'' + dealerId + '\')" style="padding:8px 16px;border-radius:8px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-size:13px">💾 ส่งอัพเดท</button>';
  h += '</div>';
  h += '<div style="font-size:11px;color:#8892b0;margin-top:4px">💡 อัพเดทจะถูกบันทึกทันที</div>';
  h += '</div>';
  
  return h;
}

function saveCVUpdate(pipeId, dealerId) {
  var text = document.getElementById('cvUpdateInput') ? document.getElementById('cvUpdateInput').value.trim() : '';
  if (!text) { alert('กรุณาพิมพ์ข้อความ'); return; }
  if (window.opener) {
    window.opener.postMessage({ type: 'CV_UPDATE', pipeId: pipeId, dealerId: dealerId, text: text }, '*');
    alert('✅ ส่งอัพเดทเรียบร้อยแล้ว! ขอบคุณครับ');
    if (document.getElementById('cvUpdateInput')) document.getElementById('cvUpdateInput').value = '';
  } else {
    alert('ไม่สามารถส่งอัพเดทได้ กรุณาแจ้งพนักงานขาย');
  }
}

function getClientStatusLabel(status) {
  var labels = {
    prospect: '<span class="cv-status cv-st-prospect">🔵 Prospect</span>',
    tor_review: '<span class="cv-status cv-st-tor">🟣 TOR Review</span>',
    quotation: '<span class="cv-status cv-st-quote">🟠 Quotation</span>',
    bidding: '<span class="cv-status cv-st-bidding">🟡 Bidding</span>',
    negotiation: '<span class="cv-status cv-st-nego">🔵 Negotiation</span>',
    win: '<span class="cv-status cv-st-win">🟢 Win</span>',
    ordered: '<span class="cv-status cv-st-ordered">🟢 Ordered</span>',
    delivered: '<span class="cv-status cv-st-delivered">✅ Delivered</span>',
    recurring: '<span class="cv-status cv-st-recur">🔄 Recurring</span>'
  };
  return labels[status] || '<span class="cv-status">' + status + '</span>';
}

function getClientViewCSS() {
  return '*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Segoe UI","Noto Sans Thai",sans-serif;background:#0a0e27;color:#e0e6f0}.cv-container{max-width:1000px;margin:0 auto;padding:24px}.cv-header{text-align:center;padding:32px 0;margin-bottom:24px;border-bottom:2px solid rgba(100,181,246,0.2)}.cv-logo{font-size:14px;color:#64b5f6;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}.cv-dealer-name{font-size:32px;font-weight:800;background:linear-gradient(90deg,#64b5f6,#42a5f5);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}.cv-dealer-sub{font-size:14px;color:#8892b0}.cv-stats{display:flex;gap:16px;justify-content:center;margin-bottom:24px}.cv-stat{text-align:center;padding:16px 24px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;min-width:100px}.cv-stat-val{font-size:28px;font-weight:800;color:#64b5f6}.cv-stat-label{font-size:12px;color:#8892b0;margin-top:2px}.cv-section{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px;margin-bottom:16px}.cv-section-title{font-size:18px;font-weight:700;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08)}.cv-table{width:100%;border-collapse:collapse}.cv-table th{text-align:left;padding:10px 12px;font-size:11px;color:#8892b0;text-transform:uppercase;border-bottom:2px solid rgba(255,255,255,0.08)}.cv-table td{padding:12px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px}.cv-row{cursor:pointer;transition:0.15s}.cv-row:hover td{background:rgba(100,181,246,0.06)}.cv-num{color:#8892b0;font-weight:700;font-size:12px;width:32px}.cv-project{font-weight:600}.cv-model{font-size:12px;color:#8892b0}.cv-status{padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600}.cv-st-prospect{background:rgba(100,181,246,0.12);color:#64b5f6}.cv-st-tor{background:rgba(186,104,200,0.12);color:#ba68c8}.cv-st-quote{background:rgba(255,183,77,0.12);color:#ffb74d}.cv-st-bidding{background:rgba(255,235,59,0.12);color:#fdd835}.cv-st-nego{background:rgba(77,208,225,0.12);color:#4dd0e1}.cv-st-win{background:rgba(129,199,132,0.12);color:#81c784}.cv-st-ordered{background:rgba(76,175,80,0.12);color:#4caf50}.cv-st-delivered{background:rgba(76,175,80,0.15);color:#66bb6a}.cv-st-recur{background:rgba(121,134,203,0.12);color:#7986cb}.cv-products{}.cv-product-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}.cv-product-name{width:180px;font-size:13px;font-weight:600;text-align:right}.cv-product-qty{color:#64b5f6;font-weight:700}.cv-product-bar{flex:1;height:24px;background:rgba(255,255,255,0.04);border-radius:6px;overflow:hidden}.cv-product-fill{height:100%;background:linear-gradient(90deg,#42a5f5,#64b5f6);border-radius:6px;transition:width 0.5s}.cv-action{padding:10px 14px;border-radius:8px;margin-bottom:6px;border-left:3px solid #64b5f6;background:rgba(255,255,255,0.02)}.cv-action-overdue{border-left-color:#ff5252;background:rgba(255,82,82,0.06)}.cv-action-urgent{border-left-color:#ff9800;background:rgba(255,152,0,0.04)}.cv-action-text{font-size:14px;font-weight:600;margin-bottom:2px}.cv-action-meta{font-size:12px;color:#8892b0}.cv-overdue-badge{background:rgba(255,82,82,0.2);color:#ff5252;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:700}.cv-urgent-badge{background:rgba(255,152,0,0.2);color:#ff9800;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:700}.cv-detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.cv-detail-label{font-size:11px;color:#8892b0;margin-bottom:2px}.cv-detail-val{font-size:14px;font-weight:600}.cv-log{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px}.cv-log-date{color:#8892b0;font-size:12px;min-width:70px}.cv-log-icon{font-size:14px}.cv-log-text{flex:1;line-height:1.5}.cv-back{display:inline-block;padding:8px 16px;margin-bottom:16px;cursor:pointer;color:#64b5f6;font-size:14px;border-radius:8px;transition:0.15s}.cv-back:hover{background:rgba(100,181,246,0.1)}.cv-footer{text-align:center;padding:24px 0;margin-top:32px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;color:#8892b0}.cv-toggle-btn{padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#8892b0;cursor:pointer;font-size:12px}.cv-toggle-btn:hover{background:rgba(100,181,246,0.1);color:#64b5f6;border-color:#64b5f6}@media(max-width:768px){.cv-container{padding:12px}.cv-dealer-name{font-size:24px}.cv-stats{flex-wrap:wrap}.cv-detail-grid{grid-template-columns:repeat(2,1fr)}.cv-product-name{width:120px}}';
}