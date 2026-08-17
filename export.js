// ================================================================
// EXPORT CENTER
// ================================================================
function rExports(el) {
  document.getElementById('pgT').textContent = '📤 Export Center';
  el.innerHTML = `
  <div class="card"><h2>🤝 Visit Report</h2><p class="hint" style="margin-bottom:6px">Copy วาง Google Sheets ได้เลย — format ตรง Email</p>
  <div class="fr" style="margin-bottom:6px">${dpH('xv_f', addD(_td(),-30), 'จาก')}${dpH('xv_t', _td(), 'ถึง')}</div>
  <div class="bg" style="margin-bottom:6px"><button class="btn bp" onclick="xVisit()">📊 แสดง</button></div><div id="xv_area"></div></div>

  <div class="card"><h2>📊 Pipeline Report</h2><p class="hint" style="margin-bottom:6px">Export ตรง format Excel — มี Update 1,2,3...</p>
  <div class="bg" style="margin-bottom:6px"><button class="btn bp" onclick="xPipe()">📊 แสดง</button></div><div id="xp_area"></div></div>

  <div class="card"><h2>📞 Follow-up Report</h2>
  <div class="fr" style="margin-bottom:6px">${dpH('xf_f', addD(_td(),-30), 'จาก')}${dpH('xf_t', _td(), 'ถึง')}</div>
  <div class="bg" style="margin-bottom:6px"><button class="btn bp" onclick="xFU()">📊 แสดง</button></div><div id="xf_area"></div></div>

  <div class="card"><h2>📦 Forecast Report</h2>
  <div class="bg" style="margin-bottom:6px"><button class="btn bp" onclick="xForecast()">📊 แสดง</button></div><div id="xfc_area"></div></div>

  <div class="card"><h2>🏪 Dealer Summary</h2>
  <div class="bg" style="margin-bottom:6px"><button class="btn bp" onclick="xDealer()">📊 แสดง</button></div><div id="xd_area"></div></div>

  <div class="card"><h2>💰 ยอดขาย SIS</h2>
  <p class="hint" style="margin-bottom:6px">Import ไฟล์ Excel รูปแบบเดียวกับที่ทีมใช้อยู่แล้ว (คอลัมน์ Customer Code/Customer Name/Month(Billing Date)/Total Sales/Total Adj Profit — ระบบหาแถวหัวตารางเองอัตโนมัติ ไม่ต้องตรงเลขแถวเป๊ะ) — จับคู่บริษัทด้วย Customer Code = SIS Code แล้วมี preview ให้ตรวจสอบก่อน import จริง</p>
  <div class="bg" style="gap:6px;flex-wrap:wrap">
    <button class="btn bp" onclick="importSisRevenueXlsx()">📥 Import จาก Excel</button>
    <button class="btn bo" onclick="exportSisRevenueXlsx()">📤 Export เป็น Excel</button>
  </div></div>

  <div class="card"><h2>⏱️ Time Tracking</h2>
  <div class="fr" style="margin-bottom:6px">${dpH('xt_f', addD(_td(),-7), 'จาก')}${dpH('xt_t', _td(), 'ถึง')}</div>
  <div class="bg" style="margin-bottom:6px"><button class="btn bp" onclick="xTimer()">📊 แสดง</button></div><div id="xt_area"></div></div>

  <div class="card"><h2>💾 สำรองข้อมูล</h2>
  <p class="hint" style="margin-bottom:6px">Backup ล่าสุด: ${ST.getLastBackup() ? fD(ST.getLastBackup()) + ' (' + ST.getDaysSinceBackup() + ' วันที่แล้ว)' : '❌ ยังไม่เคย'} • ขนาด: ${ST.getStorageSizeFormatted()}</p>
  <div class="bg" style="gap:6px;flex-wrap:wrap">
    <button class="btn bp" onclick="doExportJSON()">📤 Export JSON</button>
    <button class="btn bo" onclick="document.getElementById('impFile').click()">📥 Import (วางทับ)</button>
    <button class="btn bo" onclick="showMergeImportM()">🔄 Merge Import (ไม่ซ้ำ)</button>
    <button class="btn bd" onclick="doClearAll()">🗑️ ล้างทั้งหมด</button>
  </div>
  <input type="file" id="impFile" accept=".json" style="display:none" onchange="showRestorePreview(event)">
  <p class="hint" style="margin-top:6px">Export JSON = สำรองครบทุกข้อมูล · Import (วางทับ) = กู้คืนทั้งหมด · Merge = เพิ่มเฉพาะข้อมูลใหม่โดยไม่ลบของเดิม</p>
  </div>`;
}

function xRender(areaId, headers, rows, filename) {
  const el = document.getElementById(areaId); if (!el) return;
  const tid = areaId + '_tbl';
  el.innerHTML = `<div class="bg" style="margin-bottom:4px"><button class="btn bsm bp" onclick="copyTable('${tid}')">📋 Copy</button><button class="btn bsm bs" onclick="dlTableCSV('${tid}','${filename}')">📤 CSV</button></div>
  <div class="export-wrap"><table class="export-table" id="${tid}"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <div style="font-size:.62rem;color:#64748b;margin-top:3px">${rows.length} รายการ</div>`;
}

// รูปแบบคอลัมน์ตรงตามชีตปลายทางที่ทีมใช้อยู่แล้ว: Date เป็น DD/MM/YY, Year/Month เว้นว่าง (ฝั่งชีตมีสูตรคำนวณ
// จาก Date เอง), Update = ข้อความ "สรุปการคุย" ตัวจริงจากหน้า Visit Report (v.summary) ไม่ใช่ข้อความสรุปสำหรับอีเมล
var XV_HEADERS = ['Date','Year','Month','Sale','Dealer Name','Offline/Online','DJI Dealer\n(SAB / Other)','Update','Location'];
var _xVisitRows = [];

function _xv2Date(iso) {
  if (!iso) return '';
  var p = iso.split('T')[0].split('-');
  if (p.length !== 3) return '';
  return p[2] + '/' + p[1] + '/' + p[0].slice(2);
}

// แปลง visit records ดิบเป็นแถวตาราง XV_HEADERS — ใช้ร่วมกันทั้ง Export > Visit Report (xVisit, กรองตามช่วงวันที่)
// และมุมมองตารางในหน้า Visit Report หลัก (rVisits, กรองตาม filter ของหน้านั้นเอง) กันโค้ดซ้ำ
function buildXVisitRows(vts) {
  const cfg = getConfig();
  return vts.map(function(v) {
    const d = ST.getOne('dealers', v.dealerId);
    return { id: v.id, cells: [_xv2Date(v.date), '', '', v.saleName||cfg.saleName, d?.name||v.company||'', v.mode==='offline'?'Offline':'Online', v.djiDealer||'', v.summary||'', v.location||''] };
  });
}

function xVisit() {
  const f = dpG('xv_f'), t = dpG('xv_t'); if (!f||!t) return alert('เลือกวันที่');
  const vts = ST.filter('visits', v => isInRange(v.date, f, t)).sort((a,b) => a.date.localeCompare(b.date));
  _xVisitRows = buildXVisitRows(vts);
  if (!_xVisitRows.length) { document.getElementById('xv_area').innerHTML = '<div class="empty"><p>ไม่มีข้อมูล</p></div>'; return; }
  xRenderVisit();
}

// ตารางเฉพาะ Visit Report — มี checkbox เลือกแถว (copy ได้ทีละแถว/หลายแถว/ทั้งหมด) และตัวเลือกไม่รวมคอลัมน์
// Location ตอน copy (คอลัมน์ยังโชว์บนตารางปกติ แค่ไม่ติดไปตอนวาง) แยกจาก xRender() ทั่วไปเพราะ interaction
// เฉพาะตัวนี้ ไม่อยากทำให้ export อื่นๆ ที่ใช้ xRender() ร่วมซับซ้อนตามไปด้วย
function xRenderVisit() {
  var el = document.getElementById('xv_area'); if (!el) return;
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px">';
  html += '<div style="display:flex;gap:14px;flex-wrap:wrap">';
  html += '<label style="display:flex;align-items:center;gap:5px;font-size:.72rem;cursor:pointer"><input type="checkbox" id="xv_noloc" style="width:auto"> ไม่รวมคอลัมน์ Location ตอน copy</label>';
  html += '<label style="display:flex;align-items:center;gap:5px;font-size:.72rem;cursor:pointer"><input type="checkbox" id="xv_incHeader" style="width:auto"> รวมหัวตารางตอน copy</label>';
  html += '</div>';
  html += '<div class="bg" style="gap:6px">';
  html += '<button class="btn bsm bo" onclick="copyVisitExport(true)">📋 Copy ที่เลือก (<span id="xv_selCount">0</span>)</button>';
  html += '<button class="btn bsm bp" onclick="copyVisitExport(false)">📋 Copy ทั้งหมด</button>';
  html += '<button class="btn bsm bs" onclick="dlVisitExportCSV()">📤 CSV</button>';
  html += '</div></div>';

  html += '<div class="export-wrap"><table class="export-table" id="xv_tbl"><thead><tr>';
  html += '<th style="width:26px"><input type="checkbox" id="xv_selAll" style="width:auto" onchange="xvToggleAll(this.checked)"></th>';
  XV_HEADERS.forEach(function(h) { html += '<th>' + sanitize(h).replace(/\n/g, '<br>') + '</th>'; });
  html += '</tr></thead><tbody>';
  // Update (index 7) ตัดเหลือบรรทัดเดียวเป็นค่าเริ่มต้น (กันแถวสูงไม่เท่ากันตอนบางรายการมีสรุปยาวหลายย่อหน้า —
  // เลือก/copy ทั้งแถวยากตอนแถวสูงๆ ต่ำๆ ปนกัน) คลิกที่ช่องนั้นเพื่อขยายดูเต็มทีละแถวได้ ไม่กระทบข้อมูลที่ copy จริง
  // (copyVisitExport ใช้ _xVisitRows ตรงๆ ไม่ได้อ่านจาก DOM ที่ตัดบรรทัดไว้)
  _xVisitRows.forEach(function(r, i) {
    html += '<tr><td><input type="checkbox" class="xv-row-chk" style="width:auto" data-idx="' + i + '" onchange="xvUpdSelCount()"></td>';
    r.cells.forEach(function(c, ci) {
      if (ci === 7) html += '<td class="xv-cell-trunc" onclick="this.classList.toggle(\'expanded\')" title="คลิกเพื่อขยาย/ย่อ">' + sanitize(String(c)) + '</td>';
      else html += '<td>' + sanitize(String(c)).replace(/\n/g, ' ') + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  html += '<div style="font-size:.62rem;color:#64748b;margin-top:3px">' + _xVisitRows.length + ' รายการ</div>';
  el.innerHTML = html;
}

function xvToggleAll(checked) {
  document.querySelectorAll('.xv-row-chk').forEach(function(c) { c.checked = checked; });
  xvUpdSelCount();
}

function xvUpdSelCount() {
  var n = document.querySelectorAll('.xv-row-chk:checked').length;
  var el = document.getElementById('xv_selCount'); if (el) el.textContent = n;
}

// CSV-style quoting สำหรับ copy ลง clipboard — คงบรรทัดใหม่ในเซลล์ไว้ (ห่อด้วย "..." ตาม convention ที่
// Google Sheets/Excel เข้าใจตอนวาง) ต่างจาก copyTable() เดิมที่ตัดบรรทัดใหม่ทิ้งเป็นบรรทัดเดียวเสมอ
function _csvQuote(v) {
  v = String(v == null ? '' : v).replace(/\r\n/g, '\n');
  if (/[\t\n"]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}

function copyVisitExport(onlySelected) {
  var noLoc = document.getElementById('xv_noloc') && document.getElementById('xv_noloc').checked;
  var incHeader = document.getElementById('xv_incHeader') && document.getElementById('xv_incHeader').checked;
  var idxs;
  if (onlySelected) {
    idxs = Array.from(document.querySelectorAll('.xv-row-chk:checked')).map(function(c) { return parseInt(c.dataset.idx, 10); });
    if (!idxs.length) return toast('❌ ยังไม่ได้เลือกแถวไหนเลย', true);
  } else {
    idxs = _xVisitRows.map(function(_, i) { return i; });
  }
  var headers = XV_HEADERS.slice();
  if (noLoc) headers.pop();
  var lines = incHeader ? [headers.map(_csvQuote).join('\t')] : [];
  idxs.forEach(function(i) {
    var cells = _xVisitRows[i].cells.slice();
    if (noLoc) cells.pop();
    lines.push(cells.map(_csvQuote).join('\t'));
  });
  copyText(lines.join('\n'), '📋 Copy แล้ว! วาง Google Sheets ได้ (' + idxs.length + ' แถว)');
}

// ปุ่มลัดบนหน้า Visit List — copy Visit เดือนนี้เป็น TSV วางลง Sheet ได้เลยโดยไม่ต้องสลับไปมุมมองตาราง
// แล้วเลือกแถวเอง (มุมมองตาราง + copyVisitExport ยังอยู่เหมือนเดิม อันนี้เป็นทางลัดเสริม ไม่ได้แทนที่)
function copyVisitsThisMonthTSV() {
  var now = new Date();
  var ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var vts = ST.getAll('visits').filter(function(v) { return (v.date || '').indexOf(ym) === 0; })
    .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
  if (!vts.length) return toast('ไม่มี Visit เดือนนี้', true);
  var rows = buildXVisitRows(vts);
  var lines = [XV_HEADERS.map(_csvQuote).join('\t')];
  rows.forEach(function(r) { lines.push(r.cells.map(_csvQuote).join('\t')); });
  copyText(lines.join('\n'), '📋 Copy แล้ว! วาง Google Sheets ได้ (' + vts.length + ' แถว — เดือนนี้)');
}

function dlVisitExportCSV() {
  var noLoc = document.getElementById('xv_noloc') && document.getElementById('xv_noloc').checked;
  var headers = XV_HEADERS.slice(); if (noLoc) headers.pop();
  var csv = '﻿' + headers.map(function(h) { return '"' + esc(h.replace(/\n/g, ' ')) + '"'; }).join(',') + '\n';
  _xVisitRows.forEach(function(r) {
    var cells = r.cells.slice(); if (noLoc) cells.pop();
    csv += cells.map(function(c) { return '"' + esc(String(c)) + '"'; }).join(',') + '\n';
  });
  dlBlob(csv, 'visit-report-' + _td() + '.csv');
}

function xPipe() {
  const pipes = ST.sort('pipeline', (a,b) => (a.registerDate||'').localeCompare(b.registerDate||''));
  if (!pipes.length) { document.getElementById('xp_area').innerHTML = '<div class="empty"><p>ไม่มี</p></div>'; return; }
  let maxUp = 0; pipes.forEach(p => { const c = ST.pipeLogsByPipe(p.id).length; if (c > maxUp) maxUp = c; });
  const headers = ['Register Date','Project Name','End User Name','End User Name Eng','Unit type','Dealer Name','DJI Dealer','Model','Forecast Amount','Real Amount','TOR','Bidding Date','Shipment date','Expected Close Date','Remark','หนังสือแต่งตั้ง','Status','งานซ้ำ'];
  for (let i = 1; i <= Math.max(maxUp,1); i++) headers.push('Update '+i);
  const rows = pipes.map(p => { const d = ST.getOne('dealers', p.dealerId); const logs = ST.pipeLogsByPipe(p.id).reverse();
    const row = [fD(p.registerDate), p.projectName||'', p.endUserTH||'', p.endUserEN||'', p.unitType||'', d?.name||'', p.djiDealer||'', (p.model||'')+(p.modelQty>1?'*'+p.modelQty:''), p.forecastAmount||'', p.realAmount||'', p.tor||'', fD(p.biddingDate), fD(p.shipmentDate), fD(p.expectedCloseDate||''), p.remark||'', p.appointmentLetter||'', getPipeName(p.status), p.recurring?'Yes':''];
    for (let i = 0; i < Math.max(maxUp,1); i++) row.push(logs[i]?fDShort(logs[i].date?.split('T')[0])+' '+logs[i].content:'');
    return row; });
  xRender('xp_area', headers, rows, 'pipeline');
}

function xFU() {
  const f = dpG('xf_f'), t = dpG('xf_t'); if (!f||!t) return alert('เลือกวันที่');
  const cfg = getConfig();
  const fus = ST.filter('followups', fu => isInRange(fu.date, f, t)).sort((a,b) => a.date.localeCompare(b.date));
  if (!fus.length) { document.getElementById('xf_area').innerHTML = '<div class="empty"><p>ไม่มี</p></div>'; return; }
  const rows = fus.map(fu => { const d = ST.getOne('dealers', fu.dealerId); return [fD(fu.date), cfg.saleName, d?.name||'', fu.method||'', fu.summary||'']; });
  xRender('xf_area', ['Date','Sale','Dealer','Method','Summary'], rows, 'followup');
}

function xForecast() {
  const pipes = ST.filter('pipeline', p => pipeIsOpen(p));
  if (!pipes.length) { document.getElementById('xfc_area').innerHTML = '<div class="empty"><p>ไม่มี</p></div>'; return; }
  const rows = pipes.map(p => { const d = ST.getOne('dealers', p.dealerId); return [d?.name||'', p.projectName||'', p.endUserTH||'', p.model||'', p.modelQty||1, p.forecastAmount||0, getPipeName(p.status), fD(p.biddingDate)]; });
  xRender('xfc_area', ['Dealer','Project','End User','Model','QTY','Forecast (฿)','Status','Bidding'], rows, 'forecast');
}

function xDealer() {
  const dealers = ST.getAll('dealers');
  if (!dealers.length) { document.getElementById('xd_area').innerHTML = '<div class="empty"><p>ไม่มี</p></div>'; return; }
  const rows = dealers.map(d => { const won = ST.pipelineByDealer(d.id).filter(p=>pipeIsWon(p)).reduce((a,p)=>a+(Number(p.forecastAmount)||0),0); const target = Number(d.targetRevenue)||0; const h = calcHealthScore(d.id);
    return [d.sisCode||'', d.djiCode||'', d.name, d.level||'', (d.contact||'').replace(/[\n\t]/g,' ').substr(0,50), d.creditTerm||'', d.creditLimit||'', target, won, target?Math.round(won/target*100)+'%':'-', h.score, d.dsecStatus==='pass'?'Y':'N', d.crmStatus==='yes'?'Y':'N', d.fh2Status==='pass'?'Y':'N', d.larkStatus==='added'?'Y':'N']; });
  xRender('xd_area', ['SIS','DJI','Name','Level','Contact','Term','Credit','Target','Won','%','Health','DSEC','CRM','FH2','Lark'], rows, 'dealer-summary');
}

function xTimer() {
  const f = dpG('xt_f'), t = dpG('xt_t'); if (!f||!t) return alert('เลือกวันที่');
  const logs = ST.filter('timerLogs', l => isInRange(l.date, f, t)).sort((a,b) => a.date.localeCompare(b.date));
  if (!logs.length) { document.getElementById('xt_area').innerHTML = '<div class="empty"><p>ไม่มี</p></div>'; return; }
  const rows = logs.map(l => [fD(l.date), l.label||'', l.minutes||0, fmtDuration(l.minutes||0)]);
  xRender('xt_area', ['Date','Task','Minutes','Duration'], rows, 'timer');
}

// Full Backup
function doExportJSON() {
  const data = ST.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `dji-sales-v7-${_td()}.json`; a.click(); URL.revokeObjectURL(a.href);
  ST.setLastBackup();
  if (typeof checkBackupReminder === 'function') checkBackupReminder();
  toast('📤 Export สำเร็จ! Backup วันที่ ' + fD(_td()));
}

// ป้ายชื่อไทยสำหรับสรุปก่อน restore — ไม่มีในนี้ก็ยัง fallback แสดงชื่อ key ตรงๆ ได้ ไม่หลุดจาก preview
var _RESTORE_LABELS = {
  dealers: '🏪 Dealer', pipeline: '📊 Pipeline', pipeLog: '📝 Pipeline History', visits: '🤝 Visit',
  followups: '📞 Follow-up', feedback: '💡 Feedback', tasks: '📋 Task', notes: '📚 Note',
  stockLevels: '📦 Stock', stockLog: '📦 Stock Log', stockReservations: '📦 Stock จอง', stockLocations: '📦 Stock ที่เก็บ',
  salesOrders: '📋 Sales Order', products: '🗂️ สินค้า (Products)', quotations: '📄 Quotation', quotes: '📄 Quote เก่า',
  meetings: '📅 Meeting', lineLog: '💬 LINE', emails: '📧 Email', timerLogs: '⏱️ Timer Log', notesQ: '📚 Note',
  waiting: '⏳ Waiting', goals: '🎯 Goal', goalsV2: '🎯 Goal', kpiEntries: '📊 KPI', customerForecasts: '📈 Customer Forecast',
  prospects: '🔍 Prospect', config: '⚙️ ตั้งค่าแอป (Config)', appearance: '🎨 ธีม/หน้าตา'
};

// อ่านไฟล์ backup แล้วโชว์ preview ก่อนทับจริงเสมอ (เดิม Restore ทับทันทีไม่มี preview เลย) — เทียบ "จำนวนในไฟล์"
// กับ "จำนวนปัจจุบันในเครื่อง" ต่อเมนู ไม่ใช่ new/changed/same แบบ Merge เพราะ Restore คือทับทั้งหมดเสมอ ไม่ใช่
// การผสาน ป้ายที่มีประโยชน์กว่าคือเตือนว่าเมนูไหนจะ "ลดลง" จากปัจจุบัน (เสี่ยงข้อมูลหายถ้ากดยืนยันแบบไม่ทันดู)
var _restorePendingData = null;
function showRestorePreview(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    try {
      var d = JSON.parse(ev.target.result);
      if (!d || !d.version) throw new Error('ไฟล์นี้ไม่ใช่ backup ของแอปนี้');
      _restorePendingData = d;
      renderRestorePreview(d);
    } catch (err) {
      alert('❌ ไฟล์ไม่ถูกต้อง: ' + err.message);
    }
  };
  r.readAsText(f);
  e.target.value = '';
}

function _restoreParseVal(raw) {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch (e) { return raw; }
}

function renderRestorePreview(d) {
  var rows = []; // { name, label, fileCount, curCount, isArray }
  if (d.raw) {
    Object.keys(d.raw).forEach(function(k) {
      var name = k.indexOf('v7_') === 0 ? k.slice(3) : k;
      var fileVal = _restoreParseVal(d.raw[k]);
      var curVal = _restoreParseVal(localStorage.getItem(k));
      rows.push({ name: name, label: _RESTORE_LABELS[name] || name, fileCount: Array.isArray(fileVal) ? fileVal.length : null, curCount: Array.isArray(curVal) ? curVal.length : null, isArray: Array.isArray(fileVal) });
    });
  } else {
    // ไฟล์ backup รุ่นเก่า (version 'v7') — key ตรงกับ ST._keys โดยตรง ไม่ใช่ v7_ prefix
    Object.keys(ST._keys).forEach(function(name) {
      if (d[name] === undefined) return;
      var fileVal = d[name];
      var curVal = _restoreParseVal(localStorage.getItem(ST._keys[name]));
      rows.push({ name: name, label: _RESTORE_LABELS[name] || name, fileCount: Array.isArray(fileVal) ? fileVal.length : null, curCount: Array.isArray(curVal) ? curVal.length : null, isArray: Array.isArray(fileVal) });
    });
  }
  rows.sort(function(a, b) { return a.label.localeCompare(b.label); });

  var h = '<div style="max-width:520px">';
  h += '<div style="background:#ef444418;border:1px solid #ef444440;border-radius:6px;padding:8px 10px;margin-bottom:10px;font-size:12px;color:#ef4444">⚠️ Restore จะ<strong>แทนที่ข้อมูลทั้งหมดในเครื่องนี้</strong>ด้วยไฟล์นี้ทันที ไม่ใช่การผสาน — รายการที่มีอยู่แต่ไม่มีในไฟล์จะหายไป ถ้าต้องการแค่เพิ่มข้อมูลใหม่โดยไม่ลบของเดิม ใช้ "🔄 Merge Import" แทน</div>';
  h += '<div style="max-height:340px;overflow-y:auto;font-size:12px;border:1px solid var(--border);border-radius:6px">';
  h += '<table style="width:100%;border-collapse:collapse"><thead><tr style="position:sticky;top:0;background:var(--bg2)">' +
    '<th style="padding:5px 8px;text-align:left;color:var(--text2);border-bottom:1px solid var(--border)">เมนู</th>' +
    '<th style="padding:5px 8px;text-align:right;color:var(--text2);border-bottom:1px solid var(--border)">ในไฟล์</th>' +
    '<th style="padding:5px 8px;text-align:right;color:var(--text2);border-bottom:1px solid var(--border)">ตอนนี้</th>' +
    '</tr></thead><tbody>';
  rows.forEach(function(r) {
    var shrink = r.isArray && r.curCount !== null && r.fileCount < r.curCount;
    h += '<tr style="border-top:1px solid var(--border)' + (shrink ? ';background:#ef444410' : '') + '">';
    h += '<td style="padding:4px 8px">' + sanitize(r.label) + (shrink ? ' <span style="color:#ef4444;font-size:10px" title="ในไฟล์น้อยกว่าปัจจุบัน — ข้อมูลที่มีอยู่ตอนนี้แต่ไม่มีในไฟล์จะหายหลัง restore">⚠️ น้อยลง</span>' : '') + '</td>';
    h += '<td style="padding:4px 8px;text-align:right">' + (r.isArray ? r.fileCount : 'จะถูกแทนที่') + '</td>';
    h += '<td style="padding:4px 8px;text-align:right;color:var(--text2)">' + (r.isArray ? (r.curCount === null ? 0 : r.curCount) : '-') + '</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<div style="display:flex;gap:8px;margin-top:12px">';
  h += '<button class="btn bd" style="flex:1" onclick="confirmRestore()">⚠️ ยืนยันแทนที่ข้อมูลทั้งหมด</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '</div></div>';
  openM('📥 Preview: Restore จาก Backup', h);
  setMWide(600);
}

function confirmRestore() {
  if (!_restorePendingData) return;
  try {
    ST.importAll(_restorePendingData);
    refreshPipeNames();
    toast('✅ นำเข้าสำเร็จ!');
    closeMForce();
    render();
  } catch (err) {
    alert('❌ Restore ไม่สำเร็จ: ' + err.message);
  }
  _restorePendingData = null;
}

function doClearAll() {
  if (!confirm('⚠️ ล้างข้อมูลทั้งหมด?')) return;
  if (!confirm('⚠️⚠️ ยืนยันอีกครั้ง — ลบทุกอย่าง?')) return;
  ST.clearAll(); toast('🗑️ ล้างแล้ว'); render();
}
// ================================================================
// MERGE IMPORT — ไม่ทับของเดิม
// ================================================================

function showMergeImportM() {
  openM('📥 Merge Import (ไม่ซ้ำ)', `
    <div style="max-width:640px">
      <div class="fg">
        <label>เลือกไฟล์ JSON (Backup)</label>
        <input type="file" id="mergeFile" accept=".json" onchange="mergeImportFile(event)">
      </div>
      <div class="fg">
        <label>เลือกประเภทที่ต้องการ Import</label>
        <div class="check-g" id="mergeTypes">
          <label><input type="checkbox" value="dealers" checked onchange="showMergePreview()"> 🏪 Dealer</label>
          <label><input type="checkbox" value="pipeline" checked onchange="showMergePreview()"> 📊 Pipeline</label>
          <label><input type="checkbox" value="visits" checked onchange="showMergePreview()"> 🤝 Visit</label>
          <label><input type="checkbox" value="followups" checked onchange="showMergePreview()"> 📞 Follow-up</label>
          <label><input type="checkbox" value="feedback" checked onchange="showMergePreview()"> 💡 Feedback</label>
          <label><input type="checkbox" value="tasks" checked onchange="showMergePreview()"> 📋 Task</label>
          <label><input type="checkbox" value="notes" checked onchange="showMergePreview()"> 📚 Note</label>
        </div>
      </div>
      <div class="fg">
        <label>📌 วิธีจัดการข้อมูลซ้ำ</label>
        <select id="mergeDupAction" class="fm-input" onchange="showMergePreview()">
          <option value="skip">⏭️ ข้าม (ไม่เพิ่มถ้ามีชื่อซ้ำ)</option>
          <option value="overwrite">📝 ทับ (อัพเดทข้อมูลเดิม)</option>
          <option value="rename">📌 เปลี่ยนชื่อ (เพิ่ม _v2)</option>
        </select>
      </div>
      <div id="mergePreview" style="font-size:12px;color:var(--text2);margin:8px 0"></div>
      <div class="fm-actions">
        <button class="btn btn-blue" onclick="doMergeImport()">📥 เริ่ม Import (ไม่ซ้ำ)</button>
        <button class="btn" onclick="closeM()">ยกเลิก</button>
      </div>
    </div>
  `);
}

var mergeData = null;

function mergeImportFile(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      mergeData = JSON.parse(e.target.result);
      showMergePreview();
    } catch(err) {
      toast('❌ ไฟล์ไม่ถูกต้อง: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// เทียบ 2 record แบบทั่วไป ไม่ต้องเขียน diff เฉพาะทีละประเภท (ต่างจาก Pipeline ที่ field ตายตัว ที่นี่มี 7
// ประเภท shape ไม่เหมือนกันเลย) — ข้าม key ที่เป็น metadata ไม่มีความหมายให้ดู เทียบด้วย JSON.stringify กันเคส
// เป็น array/object ซ้อนอยู่ข้างใน (เช่น items ของ pipeline)
var _MERGE_DIFF_SKIP_KEYS = ['id', 'created', 'updated', 'createdAt', 'updatedAt'];
function _genericDiffFields(oldObj, newObj) {
  var diffs = [];
  var keys = Object.keys(newObj || {}).filter(function(k) { return _MERGE_DIFF_SKIP_KEYS.indexOf(k) === -1; });
  keys.forEach(function(k) {
    var oldV = oldObj ? oldObj[k] : undefined;
    var newV = newObj[k];
    var oldStr = JSON.stringify(oldV === undefined ? null : oldV);
    var newStr = JSON.stringify(newV === undefined ? null : newV);
    if (oldStr !== newStr) diffs.push({ field: k, old: oldV, newVal: newV });
  });
  return diffs;
}

// คำนวณ "แผน" ก่อนเขียนจริง (dry-run) — จับคู่ fingerprint แบบเดียวกับ doMergeImport() เป๊ะๆ ทุกตัว (ถ้าแก้
// fingerprint ต้องแก้ทั้ง 2 จุดให้ตรงกัน ไม่งั้น preview กับผลจริงจะไม่ตรงกัน) แต่ที่นี่แค่ "ดู" ไม่เขียนอะไรเลย
function _buildMergePlan(mergeData, checkedTypes, dupAction) {
  var plan = {};
  var has = function(t) { return checkedTypes.indexOf(t) !== -1; };

  var existingDealers = ST.getAll('dealers');
  var existingDealerNameMap = {};
  existingDealers.forEach(function(d) { existingDealerNameMap[d.name] = d; });

  // ── Dealers (fingerprint = name) ──
  plan.dealers = [];
  if (has('dealers') && mergeData.v7_dealers) {
    mergeData.v7_dealers.forEach(function(newD) {
      if (!newD.name) return;
      var ex = existingDealerNameMap[newD.name];
      if (ex) {
        var action = dupAction === 'overwrite' ? 'overwrite' : (dupAction === 'rename' ? 'rename' : 'skip');
        plan.dealers.push({ label: newD.name, action: action, diffs: action === 'overwrite' ? _genericDiffFields(ex, newD) : [] });
      } else {
        plan.dealers.push({ label: newD.name, action: 'new', diffs: [] });
      }
    });
  }

  // ── Pipeline (fingerprint = projectName + registerDate) ──
  plan.pipeline = [];
  if (has('pipeline') && mergeData.v7_pipeline) {
    var existingPipes = ST.getAll('pipeline');
    var existingPipeFP = {};
    existingPipes.forEach(function(p) {
      var fp = (p.projectName || '') + '|' + (p.registerDate || (p.created || '').split('T')[0]);
      existingPipeFP[fp] = p;
    });
    mergeData.v7_pipeline.forEach(function(newP) {
      var fp = (newP.projectName || '') + '|' + (newP.registerDate || (newP.created || '').split('T')[0]);
      var ex = existingPipeFP[fp];
      var label = newP.projectName || newP.endUserTH || '(ไม่มีชื่อ)';
      if (ex) {
        var action = dupAction === 'overwrite' ? 'overwrite' : 'skip'; // pipeline ไม่รองรับ rename เหมือน dealers
        plan.pipeline.push({ label: label, action: action, diffs: action === 'overwrite' ? _genericDiffFields(ex, newP) : [] });
      } else if (newP.dealerId) {
        plan.pipeline.push({ label: label, action: 'new', diffs: [] });
      } else {
        // doMergeImport ข้ามแถวใหม่ที่ไม่มี dealerId ติดมาเลยเงียบๆ (ไม่รู้จะผูกกับ Dealer ไหน) — ต้องเตือนไว้ก่อน
        // ไม่งั้น preview จะบอกว่า "ใหม่" ทั้งที่จริงจะไม่ถูกเพิ่มเลย
        plan.pipeline.push({ label: label, action: 'skip-no-dealer', diffs: [] });
      }
    });
  }

  // ── pipeLog (นับรวมเฉยๆ ไม่โชว์ทีละแถว เพราะเยอะเกินไปและไม่มีความหมายให้ดูทีละอัน) ──
  var pipeLogNew = 0, pipeLogSkip = 0;
  if (has('pipeline') && mergeData.v7_pipelog) {
    var exLogSet = {};
    ST.getAll('pipeLog').forEach(function(l) { exLogSet[(l.pipeId || '') + '|' + (l.date || '') + '|' + (l.content || '').substr(0, 20)] = true; });
    mergeData.v7_pipelog.forEach(function(newL) {
      var lk = (newL.pipeId || '') + '|' + (newL.date || '') + '|' + (newL.content || '').substr(0, 20);
      if (exLogSet[lk]) pipeLogSkip++; else { pipeLogNew++; exLogSet[lk] = true; }
    });
  }
  plan.pipeLog = { newCount: pipeLogNew, skipCount: pipeLogSkip };

  // ── Visits (fingerprint = dealerId + date) ──
  plan.visits = [];
  if (has('visits') && mergeData.v7_visits) {
    var exVSet = {};
    ST.getAll('visits').forEach(function(v) { exVSet[(v.dealerId || '') + '|' + (v.date || '')] = v; });
    mergeData.v7_visits.forEach(function(newV) {
      var vk = (newV.dealerId || '') + '|' + (newV.date || '');
      var ex = exVSet[vk];
      var label = fD(newV.date);
      if (ex) {
        var action = dupAction === 'overwrite' ? 'overwrite' : 'skip';
        plan.visits.push({ label: label, action: action, diffs: action === 'overwrite' ? _genericDiffFields(ex, newV) : [] });
      } else if (newV.dealerId) {
        plan.visits.push({ label: label, action: 'new', diffs: [] });
      } else {
        plan.visits.push({ label: label, action: 'skip-no-dealer', diffs: [] });
      }
    });
  }

  // ── Follow-ups (fingerprint = dealerId + date) ──
  plan.followups = [];
  if (has('followups') && mergeData.v7_followups) {
    var exFUSet = {};
    ST.getAll('followups').forEach(function(fu) { exFUSet[(fu.dealerId || '') + '|' + (fu.date || '')] = fu; });
    mergeData.v7_followups.forEach(function(newFu) {
      var fuk = (newFu.dealerId || '') + '|' + (newFu.date || '');
      var ex = exFUSet[fuk];
      var label = fD(newFu.date);
      if (ex) {
        var action = dupAction === 'overwrite' ? 'overwrite' : 'skip';
        plan.followups.push({ label: label, action: action, diffs: action === 'overwrite' ? _genericDiffFields(ex, newFu) : [] });
      } else if (newFu.dealerId) {
        plan.followups.push({ label: label, action: 'new', diffs: [] });
      } else {
        plan.followups.push({ label: label, action: 'skip-no-dealer', diffs: [] });
      }
    });
  }

  // ── Feedback (fingerprint = dealerId + ข้อความ 30 ตัวแรก) — ไม่รองรับ overwrite เสมอ (ตาม doMergeImport) ──
  plan.feedback = [];
  if (has('feedback') && mergeData.v7_feedback) {
    var exFBSet = {};
    ST.getAll('feedback').forEach(function(f) { exFBSet[(f.dealerId || '') + '|' + (f.text || '').substr(0, 30)] = true; });
    mergeData.v7_feedback.forEach(function(newFb) {
      var fbk = (newFb.dealerId || '') + '|' + (newFb.text || '').substr(0, 30);
      var action = exFBSet[fbk] ? 'skip' : (newFb.dealerId ? 'new' : 'skip-no-dealer');
      plan.feedback.push({ label: (newFb.text || '').substr(0, 40), action: action, diffs: [] });
    });
  }

  // ── Tasks (fingerprint = title) — ไม่รองรับ overwrite เสมอ ──
  plan.tasks = [];
  if (has('tasks') && mergeData.v7_tasks) {
    var exTaskT = {};
    ST.getAll('tasks').forEach(function(t) { exTaskT[t.title || ''] = true; });
    mergeData.v7_tasks.forEach(function(newT) {
      plan.tasks.push({ label: newT.title || '(ไม่มีชื่อ)', action: exTaskT[newT.title || ''] ? 'skip' : 'new', diffs: [] });
    });
  }

  // ── Notes (fingerprint = dealerId + ข้อความ 30 ตัวแรก) — ไม่รองรับ overwrite เสมอ ──
  plan.notes = [];
  if (has('notes') && mergeData.v7_notes) {
    var exNoteSet = {};
    ST.getAll('notes').forEach(function(n) { exNoteSet[(n.dealerId || '') + '|' + (n.text || '').substr(0, 30)] = true; });
    mergeData.v7_notes.forEach(function(newN) {
      var nk = (newN.dealerId || '') + '|' + (newN.text || '').substr(0, 30);
      plan.notes.push({ label: (newN.text || '').substr(0, 40), action: exNoteSet[nk] ? 'skip' : 'new', diffs: [] });
    });
  }

  return plan;
}

var _MERGE_TYPE_META = {
  dealers:   { label: '🏪 Dealer',     canOverwrite: true  },
  pipeline:  { label: '📊 Pipeline',   canOverwrite: true  },
  visits:    { label: '🤝 Visit',      canOverwrite: true  },
  followups: { label: '📞 Follow-up',  canOverwrite: true  },
  feedback:  { label: '💡 Feedback',   canOverwrite: false },
  tasks:     { label: '📋 Task',       canOverwrite: false },
  notes:     { label: '📚 Note',       canOverwrite: false }
};
var _mergeActionBadge = {
  new:            { text: '➕ ใหม่',        bg: '#22c55e18', color: '#22c55e' },
  overwrite:      { text: '📝 ซ้ำ — จะทับ', bg: '#f59e0b18', color: '#f59e0b' },
  skip:           { text: '⏭ ซ้ำ — ข้าม',  bg: 'var(--bg2)', color: 'var(--text2)' },
  rename:         { text: '📌 ซ้ำ — เปลี่ยนชื่อ', bg: '#3b82f618', color: '#3b82f6' },
  'skip-no-dealer': { text: '⚠️ ข้าม — หา Dealer ไม่เจอ', bg: '#ef444418', color: '#ef4444' }
};

// dry-run แล้วโชว์ตารางแบบเดียวกับ Pipeline import preview — ต่อรายการมี badge ว่าใหม่/ซ้ำ (จะทับ/ข้าม/
// เปลี่ยนชื่อ ตาม dupAction ที่เลือกไว้ตอนนี้) พร้อมปุ่มดู diff รายฟิลด์เฉพาะรายการที่จะถูกทับจริง
function showMergePreview() {
  var preview = document.getElementById('mergePreview');
  if (!preview || !mergeData) return;

  var checked = [];
  document.querySelectorAll('#mergeTypes input:checked').forEach(function(el) { checked.push(el.value); });
  var dupAction = (document.getElementById('mergeDupAction') || {}).value || 'skip';
  var plan = _buildMergePlan(mergeData, checked, dupAction);

  var html = '';
  var diffIdx = 0;
  Object.keys(_MERGE_TYPE_META).forEach(function(type) {
    var items = plan[type] || [];
    if (!items.length) return;
    var meta = _MERGE_TYPE_META[type];
    var counts = { new: 0, overwrite: 0, skip: 0, rename: 0, 'skip-no-dealer': 0 };
    items.forEach(function(it) { counts[it.action]++; });
    var summary = ['new', 'overwrite', 'skip', 'rename', 'skip-no-dealer'].filter(function(k) { return counts[k]; })
      .map(function(k) { return _mergeActionBadge[k].text.replace(/^\S+\s/, '') + ' ' + counts[k]; }).join(' · ');
    html += '<div style="margin-top:8px;border:1px solid var(--border);border-radius:6px;overflow:hidden">';
    html += '<div style="padding:6px 10px;background:var(--bg2);font-weight:700;color:var(--text)">' + meta.label + ' — ' + items.length + ' รายการในไฟล์ <span style="font-weight:400;color:var(--text2)">(' + summary + ')</span></div>';
    html += '<div style="max-height:160px;overflow-y:auto">';
    items.forEach(function(it) {
      var badge = _mergeActionBadge[it.action];
      html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 10px;border-top:1px solid var(--border);font-size:11px">';
      html += '<span style="background:' + badge.bg + ';color:' + badge.color + ';padding:1px 7px;border-radius:8px;white-space:nowrap">' + badge.text + '</span>';
      html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)" title="' + sanitize(it.label) + '">' + sanitize(it.label) + '</span>';
      if (it.action === 'overwrite' && it.diffs.length) {
        var thisIdx = diffIdx++;
        window['_mergeDiff_' + thisIdx] = it.diffs;
        html += '<button onclick="_toggleMergeDiff(' + thisIdx + ')" id="mergeDiffBtn_' + thisIdx + '" style="font-size:10px;padding:1px 5px;border:1px solid var(--border);border-radius:4px;background:var(--bg);cursor:pointer;color:var(--text2)">🔍 ' + it.diffs.length + '</button>';
      }
      html += '</div>';
      if (it.action === 'overwrite' && it.diffs.length) {
        html += '<div id="mergeDiffRow_' + (diffIdx - 1) + '" style="display:none;padding:4px 10px 6px 30px;border-top:1px dashed var(--border);font-size:10px;color:var(--text2)">';
        it.diffs.forEach(function(d) {
          html += '<div>' + sanitize(d.field) + ': <span style="color:#ef4444">' + sanitize(String(d.old == null ? '(ว่าง)' : d.old)) + '</span> → <span style="color:#22c55e">' + sanitize(String(d.newVal == null ? '(ว่าง)' : d.newVal)) + '</span></div>';
        });
        html += '</div>';
      }
    });
    html += '</div></div>';
  });

  if (plan.pipeLog && (plan.pipeLog.newCount || plan.pipeLog.skipCount)) {
    html += '<div style="margin-top:8px;font-size:11px;color:var(--text2)">📝 Pipeline History: ใหม่ ' + plan.pipeLog.newCount + ' · ซ้ำ-ข้าม ' + plan.pipeLog.skipCount + ' (รวมไปกับ Pipeline อัตโนมัติ ไม่แยกโชว์ทีละรายการ)</div>';
  }

  if (!html) html = '<div style="color:var(--text2)">ไม่พบข้อมูลที่เลือกในไฟล์นี้</div>';
  preview.innerHTML = html;
}

function _toggleMergeDiff(idx) {
  var row = document.getElementById('mergeDiffRow_' + idx);
  var btn = document.getElementById('mergeDiffBtn_' + idx);
  if (!row) return;
  var open = row.style.display !== 'none';
  row.style.display = open ? 'none' : 'block';
  if (btn) btn.style.background = open ? '' : 'var(--accent)';
}

function doMergeImport() {
  if (!mergeData) { toast('❌ กรุณาเลือกไฟล์ JSON ก่อน'); return; }

  var checked = [];
  var chks = document.querySelectorAll('#mergeTypes input:checked');
  for (var i = 0; i < chks.length; i++) checked.push(chks[i].value);

  var dupAction = document.getElementById('mergeDupAction').value;

  var results = {
    dealers:   { added: 0, skipped: 0, updated: 0 },
    pipeline:  { added: 0, skipped: 0, updated: 0 },
    pipeLog:   { added: 0, skipped: 0 },
    visits:    { added: 0, skipped: 0, updated: 0 },
    followups: { added: 0, skipped: 0, updated: 0 },
    feedback:  { added: 0, skipped: 0 },
    tasks:     { added: 0, skipped: 0 },
    notes:     { added: 0, skipped: 0 }
  };

  // ── สร้าง dealer ID map: old dealerId → new dealerId (จับคู่ด้วยชื่อ) ──
  var dealerIdMap = {};
  var existingDealers = ST.getAll('dealers');
  var existingNameMap = {};
  existingDealers.forEach(function(d) { existingNameMap[d.name] = d.id; });
  if (mergeData.v7_dealers) {
    mergeData.v7_dealers.forEach(function(od) {
      if (od.id && od.name && existingNameMap[od.name]) dealerIdMap[od.id] = existingNameMap[od.name];
    });
  }

  // ── 1. Dealers ──
  if (checked.indexOf('dealers') !== -1 && mergeData.v7_dealers) {
    for (var i = 0; i < mergeData.v7_dealers.length; i++) {
      var newD = mergeData.v7_dealers[i];
      if (!newD.name) continue;
      var existId = existingNameMap[newD.name];
      if (existId) {
        if (dupAction === 'overwrite') {
          ST.update('dealers', existId, newD);
          results.dealers.updated++;
        } else if (dupAction === 'rename') {
          var ren = Object.assign({}, newD); delete ren.id; ren.name += '_v2';
          var rd = ST.add('dealers', ren);
          dealerIdMap[newD.id] = rd.id; existingNameMap[ren.name] = rd.id;
          results.dealers.added++;
        } else {
          results.dealers.skipped++;
        }
      } else {
        var nd = Object.assign({}, newD); delete nd.id;
        var adD = ST.add('dealers', nd);
        dealerIdMap[newD.id] = adD.id; existingNameMap[newD.name] = adD.id;
        results.dealers.added++;
      }
    }
  }

  // ── 2. Pipeline (fingerprint = projectName + registerDate) ──
  var pipelineIdMap = {};
  if (checked.indexOf('pipeline') !== -1 && mergeData.v7_pipeline) {
    var existingPipes = ST.getAll('pipeline');
    var existingPipeFP = {};
    existingPipes.forEach(function(p) {
      var fp = (p.projectName || '') + '|' + (p.registerDate || (p.created || '').split('T')[0]);
      existingPipeFP[fp] = p;
    });
    for (var i = 0; i < mergeData.v7_pipeline.length; i++) {
      var newP = mergeData.v7_pipeline[i];
      var fp = (newP.projectName || '') + '|' + (newP.registerDate || (newP.created || '').split('T')[0]);
      var existP = existingPipeFP[fp];
      var resolvedDid = dealerIdMap[newP.dealerId] || newP.dealerId;
      if (existP) {
        pipelineIdMap[newP.id] = existP.id;
        if (dupAction === 'overwrite') {
          ST.update('pipeline', existP.id, Object.assign({}, newP, { dealerId: existP.dealerId }));
          results.pipeline.updated++;
        } else {
          results.pipeline.skipped++;
        }
      } else if (resolvedDid) {
        var np = Object.assign({}, newP, { dealerId: resolvedDid }); delete np.id;
        var adP = ST.add('pipeline', np);
        pipelineIdMap[newP.id] = adP.id;
        results.pipeline.added++;
      } else {
        results.pipeline.skipped++;
      }
    }
  }

  // ── 3. pipeLog (import อัตโนมัติเมื่อเลือก pipeline — แมป pipeId) ──
  if (checked.indexOf('pipeline') !== -1 && mergeData.v7_pipelog) {
    var exLogs = ST.getAll('pipeLog');
    var exLogSet = {};
    exLogs.forEach(function(l) {
      exLogSet[(l.pipeId || '') + '|' + (l.date || '') + '|' + (l.content || '').substr(0, 20)] = true;
    });
    for (var i = 0; i < mergeData.v7_pipelog.length; i++) {
      var newL = mergeData.v7_pipelog[i];
      var newPid = pipelineIdMap[newL.pipeId] || newL.pipeId;
      var lk = newPid + '|' + (newL.date || '') + '|' + (newL.content || '').substr(0, 20);
      if (!exLogSet[lk]) {
        var nl = Object.assign({}, newL, { pipeId: newPid }); delete nl.id;
        ST.add('pipeLog', nl);
        exLogSet[lk] = true;
        results.pipeLog.added++;
      } else {
        results.pipeLog.skipped++;
      }
    }
  }

  // ── 4. Visits (dealerId + date) ──
  if (checked.indexOf('visits') !== -1 && mergeData.v7_visits) {
    var exVisits = ST.getAll('visits');
    var exVSet = {};
    exVisits.forEach(function(v) { exVSet[(v.dealerId || '') + '|' + (v.date || '')] = v; });
    for (var i = 0; i < mergeData.v7_visits.length; i++) {
      var newV = mergeData.v7_visits[i];
      var vid = dealerIdMap[newV.dealerId] || newV.dealerId;
      var vk = (vid || '') + '|' + (newV.date || '');
      if (exVSet[vk]) {
        if (dupAction === 'overwrite') {
          ST.update('visits', exVSet[vk].id, Object.assign({}, newV, { dealerId: vid }));
          results.visits.updated++;
        } else { results.visits.skipped++; }
      } else if (vid) {
        var nv = Object.assign({}, newV, { dealerId: vid }); delete nv.id;
        ST.add('visits', nv);
        results.visits.added++;
      } else { results.visits.skipped++; }
    }
  }

  // ── 5. Follow-ups (dealerId + date) ──
  if (checked.indexOf('followups') !== -1 && mergeData.v7_followups) {
    var exFUs = ST.getAll('followups');
    var exFUSet = {};
    exFUs.forEach(function(fu) { exFUSet[(fu.dealerId || '') + '|' + (fu.date || '')] = fu; });
    for (var i = 0; i < mergeData.v7_followups.length; i++) {
      var newFu = mergeData.v7_followups[i];
      var fuid = dealerIdMap[newFu.dealerId] || newFu.dealerId;
      var fuk = (fuid || '') + '|' + (newFu.date || '');
      if (exFUSet[fuk]) {
        if (dupAction === 'overwrite') {
          ST.update('followups', exFUSet[fuk].id, Object.assign({}, newFu, { dealerId: fuid }));
          results.followups.updated++;
        } else { results.followups.skipped++; }
      } else if (fuid) {
        var nfu = Object.assign({}, newFu, { dealerId: fuid }); delete nfu.id;
        ST.add('followups', nfu);
        results.followups.added++;
      } else { results.followups.skipped++; }
    }
  }

  // ── 6. Feedback (dealerId + text 30 ตัวแรก) ──
  if (checked.indexOf('feedback') !== -1 && mergeData.v7_feedback) {
    var exFB = ST.getAll('feedback');
    var exFBSet = {};
    exFB.forEach(function(f) { exFBSet[(f.dealerId || '') + '|' + (f.text || '').substr(0, 30)] = true; });
    for (var i = 0; i < mergeData.v7_feedback.length; i++) {
      var newFb = mergeData.v7_feedback[i];
      var fbid = dealerIdMap[newFb.dealerId] || newFb.dealerId;
      var fbk = (fbid || '') + '|' + (newFb.text || '').substr(0, 30);
      if (!exFBSet[fbk] && fbid) {
        var nfb = Object.assign({}, newFb, { dealerId: fbid }); delete nfb.id;
        ST.add('feedback', nfb);
        exFBSet[fbk] = true;
        results.feedback.added++;
      } else { results.feedback.skipped++; }
    }
  }

  // ── 7. Tasks (title) ──
  if (checked.indexOf('tasks') !== -1 && mergeData.v7_tasks) {
    var exTasks = ST.getAll('tasks');
    var exTaskT = {};
    exTasks.forEach(function(t) { exTaskT[t.title || ''] = true; });
    for (var i = 0; i < mergeData.v7_tasks.length; i++) {
      var newT = mergeData.v7_tasks[i];
      if (!exTaskT[newT.title || '']) {
        var nt = Object.assign({}, newT); delete nt.id;
        ST.add('tasks', nt);
        results.tasks.added++;
      } else { results.tasks.skipped++; }
    }
  }

  // ── 8. Notes (dealerId + text 30 ตัวแรก) ──
  if (checked.indexOf('notes') !== -1 && mergeData.v7_notes) {
    var exNotes = ST.getAll('notes');
    var exNoteSet = {};
    exNotes.forEach(function(n) { exNoteSet[(n.dealerId || '') + '|' + (n.text || '').substr(0, 30)] = true; });
    for (var i = 0; i < mergeData.v7_notes.length; i++) {
      var newN = mergeData.v7_notes[i];
      var nid = newN.dealerId ? (dealerIdMap[newN.dealerId] || newN.dealerId) : '';
      var nk = nid + '|' + (newN.text || '').substr(0, 30);
      if (!exNoteSet[nk]) {
        var nn = Object.assign({}, newN, { dealerId: nid || newN.dealerId }); delete nn.id;
        ST.add('notes', nn);
        exNoteSet[nk] = true;
        results.notes.added++;
      } else { results.notes.skipped++; }
    }
  }

  // ── สรุปผล ──
  var totalAdded = 0;
  function rLine(icon, key, label) {
    var r = results[key]; if (!r) return '';
    totalAdded += r.added;
    if (!r.added && !r.updated && !r.skipped) return '';
    var s = icon + ' ' + label + ': +' + r.added;
    if (r.updated) s += ' (อัพเดท ' + r.updated + ')';
    if (r.skipped) s += ' (ข้าม ' + r.skipped + ' ซ้ำ)';
    return s;
  }
  var lines = ['✅ Merge Import เสร็จสิ้น!\n',
    rLine('🏪', 'dealers',   'Dealer'),
    rLine('📊', 'pipeline',  'Pipeline'),
    rLine('📝', 'pipeLog',   'Pipeline History'),
    rLine('🤝', 'visits',    'Visit'),
    rLine('📞', 'followups', 'Follow-up'),
    rLine('💡', 'feedback',  'Feedback'),
    rLine('📋', 'tasks',     'Task'),
    rLine('📚', 'notes',     'Note')
  ].filter(Boolean);
  alert(lines.join('\n'));
  toast('📥 Import เสร็จ! ' + totalAdded + ' รายการใหม่');
  closeMForce();
  mergeData = null;
  render();
}