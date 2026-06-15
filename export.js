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
  <div class="bg" style="gap:6px;flex-wrap:wrap">
    <button class="btn bp" onclick="doExportJSON()">📤 Export JSON</button>
    <button class="btn bo" onclick="document.getElementById('impFile').click()">📥 Import (วางทับ)</button>
    <button class="btn bo" onclick="showMergeImportM()">🔄 Merge Import (ไม่ซ้ำ)</button>
    <button class="btn bd" onclick="doClearAll()">🗑️ ล้างทั้งหมด</button>
  </div>
  <input type="file" id="impFile" accept=".json" style="display:none" onchange="doImportJSON(event)">
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
// ================================================================
// MERGE IMPORT — ไม่ทับของเดิม
// ================================================================

function showMergeImportM() {
  openM('📥 Merge Import (ไม่ซ้ำ)', `
    <div style="max-width:450px">
      <div class="fg">
        <label>เลือกไฟล์ JSON (Backup)</label>
        <input type="file" id="mergeFile" accept=".json" onchange="mergeImportFile(event)">
      </div>
      <div class="fg">
        <label>เลือกประเภทที่ต้องการ Import</label>
        <div class="check-g" id="mergeTypes">
          <label><input type="checkbox" value="dealers" checked> 🏪 Dealer</label>
          <label><input type="checkbox" value="pipeline" checked> 📊 Pipeline</label>
          <label><input type="checkbox" value="visits" checked> 🤝 Visit</label>
          <label><input type="checkbox" value="followups" checked> 📞 Follow-up</label>
          <label><input type="checkbox" value="feedback" checked> 💡 Feedback</label>
          <label><input type="checkbox" value="tasks" checked> 📋 Task</label>
          <label><input type="checkbox" value="notes" checked> 📚 Note</label>
        </div>
      </div>
      <div class="fg">
        <label>📌 วิธีจัดการข้อมูลซ้ำ</label>
        <select id="mergeDupAction" class="fm-input">
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

function showMergePreview() {
  var preview = document.getElementById('mergePreview');
  if (!preview || !mergeData) return;
  
  var types = ['dealers', 'pipeline', 'visits', 'followups', 'feedback', 'tasks', 'notes'];
  var html = '<div style="border-top:1px solid var(--border);padding-top:8px">📄 ไฟล์มีข้อมูล:<br>';
  
  types.forEach(function(t) {
    var key = 'v7_' + t;
    if (mergeData[key] && mergeData[key].length) {
      html += ' • ' + t + ': ' + mergeData[key].length + ' รายการ<br>';
    }
  });
  
  html += '</div>';
  preview.innerHTML = html;
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