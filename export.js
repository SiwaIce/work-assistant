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

// เพิ่มปุ่มนี้เข้าไปใน card สำรองข้อมูล
<div class="bg">
  <button class="btn bp" onclick="doExportJSON()">📤 Export JSON</button>
  <button class="btn bo" onclick="document.getElementById('impFile').click()">📥 Import JSON</button>
  <button class="btn bo" onclick="showMergeImportM()">🔄 Merge Import (ไม่ซ้ำ)</button>
  <button class="btn bd" onclick="doClearAll()">🗑️ ล้างทั้งหมด</button>
</div>

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
  if (!mergeData) {
    toast('❌ กรุณาเลือกไฟล์ JSON ก่อน');
    return;
  }
  
  var checked = [];
  var chks = document.querySelectorAll('#mergeTypes input:checked');
  for (var i = 0; i < chks.length; i++) {
    checked.push(chks[i].value);
  }
  
  var dupAction = document.getElementById('mergeDupAction').value;
  
  var results = {
    dealers: { added: 0, skipped: 0, updated: 0 },
    pipeline: { added: 0, skipped: 0, updated: 0 },
    visits: { added: 0, skipped: 0, updated: 0 },
    followups: { added: 0, skipped: 0, updated: 0 },
    feedback: { added: 0, skipped: 0, updated: 0 },
    tasks: { added: 0, skipped: 0, updated: 0 },
    notes: { added: 0, skipped: 0, updated: 0 }
  };
  
  // 1. Import Dealers (ใช้ name เป็น key ตรวจสอบซ้ำ)
  if (checked.indexOf('dealers') !== -1 && mergeData.v7_dealers) {
    var existingDealers = ST.getAll('dealers');
    var existingNames = {};
    for (var i = 0; i < existingDealers.length; i++) {
      existingNames[existingDealers[i].name] = existingDealers[i];
    }
    
    for (var i = 0; i < mergeData.v7_dealers.length; i++) {
      var newD = mergeData.v7_dealers[i];
      if (!newD.name) continue;
      
      var existing = existingNames[newD.name];
      
      if (existing) {
        if (dupAction === 'overwrite') {
          // อัพเดทข้อมูลเดิม (เก็บ id เดิม)
          ST.update('dealers', existing.id, newD);
          results.dealers.updated++;
        } else if (dupAction === 'rename') {
          newD.name = newD.name + '_v2';
          ST.add('dealers', newD);
          results.dealers.added++;
        } else {
          results.dealers.skipped++;
        }
      } else {
        ST.add('dealers', newD);
        results.dealers.added++;
        existingNames[newD.name] = newD;
      }
    }
  }
  
  // 2. Import Pipeline (ใช้ dealerName + projectName + forecastAmount ตรวจสอบซ้ำ)
  if (checked.indexOf('pipeline') !== -1 && mergeData.v7_pipeline) {
    var existingPipes = ST.getAll('pipeline');
    var dealersList = ST.getAll('dealers');
    var dealerByName = {};
    for (var i = 0; i < dealersList.length; i++) {
      dealerByName[dealersList[i].name] = dealersList[i].id;
    }
    
    // สร้าง fingerprint สำหรับ pipeline ที่มีอยู่
    var existingFingerprints = {};
    for (var i = 0; i < existingPipes.length; i++) {
      var p = existingPipes[i];
      var dealer = ST.getOne('dealers', p.dealerId);
      var fp = (dealer ? dealer.name : '') + '|' + (p.projectName || '') + '|' + (p.forecastAmount || 0);
      existingFingerprints[fp] = p;
    }
    
    for (var i = 0; i < mergeData.v7_pipeline.length; i++) {
      var newP = mergeData.v7_pipeline[i];
      var dealerId = dealerByName[newP.dealerName] || '';
      
      var fp = (newP.dealerName || '') + '|' + (newP.projectName || '') + '|' + (newP.forecastAmount || 0);
      var existing = existingFingerprints[fp];
      
      if (existing) {
        if (dupAction === 'overwrite') {
          // อัพเดท แต่ต้อง map dealerId
          newP.dealerId = existing.dealerId;
          ST.update('pipeline', existing.id, newP);
          results.pipeline.updated++;
        } else {
          results.pipeline.skipped++;
        }
      } else if (dealerId) {
        newP.dealerId = dealerId;
        ST.add('pipeline', newP);
        results.pipeline.added++;
      } else {
        results.pipeline.skipped++;
      }
    }
  }
  
  // 3. Import Visits (ใช้ dealerId + date ตรวจสอบซ้ำ)
  if (checked.indexOf('visits') !== -1 && mergeData.v7_visits) {
    var existingVisits = ST.getAll('visits');
    var dealersList2 = ST.getAll('dealers');
    var dealerByName2 = {};
    for (var i = 0; i < dealersList2.length; i++) {
      dealerByName2[dealersList2[i].name] = dealersList2[i].id;
    }
    
    var existingVisitKeys = {};
    for (var i = 0; i < existingVisits.length; i++) {
      var v = existingVisits[i];
      existingVisitKeys[v.dealerId + '|' + v.date] = v;
    }
    
    for (var i = 0; i < mergeData.v7_visits.length; i++) {
      var newV = mergeData.v7_visits[i];
      var dealerId = dealerByName2[newV.dealerName] || '';
      var key = dealerId + '|' + newV.date;
      
      if (existingVisitKeys[key]) {
        if (dupAction === 'overwrite') {
          newV.dealerId = dealerId;
          ST.update('visits', existingVisitKeys[key].id, newV);
          results.visits.updated++;
        } else {
          results.visits.skipped++;
        }
      } else if (dealerId) {
        newV.dealerId = dealerId;
        ST.add('visits', newV);
        results.visits.added++;
      } else {
        results.visits.skipped++;
      }
    }
  }
  
  // 4. Import Follow-ups (ใช้ dealerId + date ตรวจสอบซ้ำ)
  if (checked.indexOf('followups') !== -1 && mergeData.v7_followups) {
    var existingFUs = ST.getAll('followups');
    var dealersList3 = ST.getAll('dealers');
    var dealerByName3 = {};
    for (var i = 0; i < dealersList3.length; i++) {
      dealerByName3[dealersList3[i].name] = dealersList3[i].id;
    }
    
    var existingFUKeys = {};
    for (var i = 0; i < existingFUs.length; i++) {
      var fu = existingFUs[i];
      existingFUKeys[fu.dealerId + '|' + fu.date] = fu;
    }
    
    for (var i = 0; i < mergeData.v7_followups.length; i++) {
      var newF = mergeData.v7_followups[i];
      var dealerId = dealerByName3[newF.dealerName] || '';
      var key = dealerId + '|' + newF.date;
      
      if (!existingFUKeys[key] && dealerId) {
        newF.dealerId = dealerId;
        ST.add('followups', newF);
        results.followups.added++;
      } else {
        results.followups.skipped++;
      }
    }
  }
  
  // 5. Import Feedback (ใช้ dealerId + text + date ตรวจสอบคร่าว)
  if (checked.indexOf('feedback') !== -1 && mergeData.v7_feedback) {
    var existingFB = ST.getAll('feedback');
    var dealersList4 = ST.getAll('dealers');
    var dealerByName4 = {};
    for (var i = 0; i < dealersList4.length; i++) {
      dealerByName4[dealersList4[i].name] = dealersList4[i].id;
    }
    
    for (var i = 0; i < mergeData.v7_feedback.length; i++) {
      var newFb = mergeData.v7_feedback[i];
      var dealerId = dealerByName4[newFb.dealerName] || '';
      
      if (dealerId) {
        newFb.dealerId = dealerId;
        ST.add('feedback', newFb);
        results.feedback.added++;
      } else {
        results.feedback.skipped++;
      }
    }
  }
  
  // 6. Import Tasks (ใช้ title ตรวจสอบซ้ำ)
  if (checked.indexOf('tasks') !== -1 && mergeData.v7_tasks) {
    var existingTasks = ST.getAll('tasks');
    var existingTaskTitles = {};
    for (var i = 0; i < existingTasks.length; i++) {
      existingTaskTitles[existingTasks[i].title] = existingTasks[i];
    }
    
    for (var i = 0; i < mergeData.v7_tasks.length; i++) {
      var newT = mergeData.v7_tasks[i];
      if (!existingTaskTitles[newT.title]) {
        ST.add('tasks', newT);
        results.tasks.added++;
      } else {
        results.tasks.skipped++;
      }
    }
  }
  
  // สรุปผล
  var summary = '✅ Import เสร็จสิ้น!\n\n';
  if (results.dealers.added || results.dealers.updated) summary += '🏪 Dealer: +' + results.dealers.added + ' ราย' + (results.dealers.updated ? ' (อัพเดท ' + results.dealers.updated + ')' : '') + (results.dealers.skipped ? ' (ข้าม ' + results.dealers.skipped + ' ซ้ำ)' : '') + '\n';
  if (results.pipeline.added) summary += '📊 Pipeline: +' + results.pipeline.added + ' ราย' + (results.pipeline.skipped ? ' (ข้าม ' + results.pipeline.skipped + ' ซ้ำ)' : '') + '\n';
  if (results.visits.added) summary += '🤝 Visit: +' + results.visits.added + ' ราย\n';
  if (results.followups.added) summary += '📞 Follow-up: +' + results.followups.added + ' ราย\n';
  if (results.feedback.added) summary += '💡 Feedback: +' + results.feedback.added + ' ราย\n';
  if (results.tasks.added) summary += '📋 Task: +' + results.tasks.added + ' ราย\n';
  
  alert(summary);
  toast('📥 Import เสร็จ! ' + (results.dealers.added + results.pipeline.added + results.visits.added) + ' รายการใหม่');
  closeMForce();
  mergeData = null;
  render();
}