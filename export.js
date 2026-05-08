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

  <div class="card"><h2>⏱️ Time Tracking</h2>
  <div class="fr" style="margin-bottom:6px">${dpH('xt_f', addD(_td(),-7), 'จาก')}${dpH('xt_t', _td(), 'ถึง')}</div>
  <div class="bg" style="margin-bottom:6px"><button class="btn bp" onclick="xTimer()">📊 แสดง</button></div><div id="xt_area"></div></div>

  <div class="card"><h2>💾 สำรองข้อมูล</h2>
  <p class="hint" style="margin-bottom:6px">Backup ล่าสุด: ${ST.getLastBackup() ? fD(ST.getLastBackup()) + ' (' + ST.getDaysSinceBackup() + ' วันที่แล้ว)' : '❌ ยังไม่เคย'} • ขนาด: ${ST.getStorageSizeFormatted()}</p>
  <div class="bg"><button class="btn bp" onclick="doExportJSON()">📤 Export JSON</button>
  <button class="btn bo" onclick="document.getElementById('impFile').click()">📥 Import JSON</button>
  <input type="file" id="impFile" accept=".json" style="display:none" onchange="doImportJSON(event)">
  <button class="btn bd" onclick="doClearAll()">🗑️ ล้างทั้งหมด</button></div></div>`;
}

function xRender(areaId, headers, rows, filename) {
  const el = document.getElementById(areaId); if (!el) return;
  const tid = areaId + '_tbl';
  el.innerHTML = `<div class="bg" style="margin-bottom:4px"><button class="btn bsm bp" onclick="copyTable('${tid}')">📋 Copy</button><button class="btn bsm bs" onclick="dlTableCSV('${tid}','${filename}')">📤 CSV</button></div>
  <div class="export-wrap"><table class="export-table" id="${tid}"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <div style="font-size:.62rem;color:#64748b;margin-top:3px">${rows.length} รายการ</div>`;
}

function xVisit() {
  const f = dpG('xv_f'), t = dpG('xv_t'); if (!f||!t) return alert('เลือกวันที่');
  const cfg = getConfig();
  const vts = ST.filter('visits', v => isInRange(v.date, f, t)).sort((a,b) => a.date.localeCompare(b.date));
  if (!vts.length) { document.getElementById('xv_area').innerHTML = '<div class="empty"><p>ไม่มีข้อมูล</p></div>'; return; }
  const headers = ['Date','Sale','Dealer Name','Offline/Online','DJI Dealer','Update','Location'];
  const rows = vts.map(v => { const d = ST.getOne('dealers', v.dealerId); return [fD(v.date), v.saleName||cfg.saleName, d?.name||'', v.mode==='offline'?'Offline':'Online', v.djiDealer||'', buildVisitUpdateText(v), v.location||'']; });
  xRender('xv_area', headers, rows, 'visit-report');
}

function xPipe() {
  const pipes = ST.sort('pipeline', (a,b) => (a.registerDate||'').localeCompare(b.registerDate||''));
  if (!pipes.length) { document.getElementById('xp_area').innerHTML = '<div class="empty"><p>ไม่มี</p></div>'; return; }
  let maxUp = 0; pipes.forEach(p => { const c = ST.pipeLogsByPipe(p.id).length; if (c > maxUp) maxUp = c; });
  const headers = ['Register Date','Project Name','End User Name','End User Name Eng','Unit type','Dealer Name','DJI Dealer','Model','Forecast Amount','Real Amount','TOR','Bidding Date','Shipment date','Remark','หนังสือแต่งตั้ง','Status','งานซ้ำ'];
  for (let i = 1; i <= Math.max(maxUp,1); i++) headers.push('Update '+i);
  const rows = pipes.map(p => { const d = ST.getOne('dealers', p.dealerId); const logs = ST.pipeLogsByPipe(p.id).reverse();
    const row = [fD(p.registerDate), p.projectName||'', p.endUserTH||'', p.endUserEN||'', p.unitType||'', d?.name||'', p.djiDealer||'', (p.model||'')+(p.modelQty>1?'*'+p.modelQty:''), p.forecastAmount||'', p.realAmount||'', p.tor||'', fD(p.biddingDate), fD(p.shipmentDate), p.remark||'', p.appointmentLetter||'', getPipeName(p.status), p.recurring?'Yes':''];
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
  const pipes = ST.filter('pipeline', p => !['lost','delivered','on_hold'].includes(p.status));
  if (!pipes.length) { document.getElementById('xfc_area').innerHTML = '<div class="empty"><p>ไม่มี</p></div>'; return; }
  const rows = pipes.map(p => { const d = ST.getOne('dealers', p.dealerId); return [d?.name||'', p.projectName||'', p.endUserTH||'', p.model||'', p.modelQty||1, p.forecastAmount||0, getPipeName(p.status), fD(p.biddingDate)]; });
  xRender('xfc_area', ['Dealer','Project','End User','Model','QTY','Forecast (฿)','Status','Bidding'], rows, 'forecast');
}

function xDealer() {
  const dealers = ST.getAll('dealers');
  if (!dealers.length) { document.getElementById('xd_area').innerHTML = '<div class="empty"><p>ไม่มี</p></div>'; return; }
  const rows = dealers.map(d => { const won = ST.pipelineByDealer(d.id).filter(p=>['win','ordered','delivered'].includes(p.status)).reduce((a,p)=>a+(Number(p.forecastAmount)||0),0); const target = Number(d.targetRevenue)||0; const h = calcHealthScore(d.id);
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
  toast('📤 Export สำเร็จ! Backup วันที่ ' + fD(_td()));
}

function doImportJSON(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = function(ev) {
    try { const d = JSON.parse(ev.target.result); ST.importAll(d); refreshPipeNames(); toast('✅ นำเข้าสำเร็จ!'); render(); }
    catch(err) { alert('❌ ไฟล์ไม่ถูกต้อง: ' + err.message); }
  };
  r.readAsText(f); e.target.value = '';
}

function doClearAll() {
  if (!confirm('⚠️ ล้างข้อมูลทั้งหมด?')) return;
  if (!confirm('⚠️⚠️ ยืนยันอีกครั้ง — ลบทุกอย่าง?')) return;
  ST.clearAll(); toast('🗑️ ล้างแล้ว'); render();
}