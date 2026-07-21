// ================================================================
// AUDIT LOG SYSTEM - FULL VERSION
// ================================================================

var AUDIT_LOG_KEY = 'v7_audit_logs';

// ================================================================
// CORE FUNCTIONS
// ================================================================

// บันทึก Audit Log
function addAuditLog(action, targetType, targetId, targetName, dealerId, dealerName, details) {
  var logs = getAuditLogs();
  
  var log = {
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8),
    action: action,
    targetType: targetType || '',
    targetId: targetId || '',
    targetName: targetName || '',
    dealerId: dealerId || '',
    dealerName: dealerName || '',
    performedBy: (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.displayName : 'system',
    performedByUid: (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.uid : '',
    performedAt: new Date().toISOString(),
    details: details || {}
  };
  
  // เพิ่ม IP Address (ถ้ามี)
  try {
    fetch('https://api.ipify.org?format=json')
      .then(function(res) { return res.json(); })
      .then(function(data) { if (data.ip) log.ipAddress = data.ip; })
      .catch(function(e) {});
  } catch(e) {}
  
  logs.unshift(log);
  
  // เก็บแค่ 1000 รายการล่าสุด
  if (logs.length > 1000) logs = logs.slice(0, 1000);
  
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
  
  // Sync ไป Firebase ถ้ามี login (ใช้ doc(id).set ไม่ใช่ add — ให้ id ตรงกับ local เพื่อให้ pull listener ทำงานถูก)
  if (typeof db !== 'undefined' && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    db.collection('users').doc(CURRENT_USER.uid).collection('auditLogs').doc(log.id).set(log).catch(function(e) {
      console.warn('Failed to save audit log to Firebase:', e);
    });
  }
  
  console.log('[AUDIT]', action, targetName, 'by', log.performedBy);
  return log;
}

// อ่าน Audit Logs
function getAuditLogs(filter) {
  var logs = [];
  try {
    logs = JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || '[]');
  } catch(e) {}
  // เรียงใหม่สุดก่อนเสมอ — กัน order สับเวลา pull จาก Firebase (ไม่รับประกัน order ใน Firestore)
  logs.sort(function(a, b) { return (b.performedAt || '').localeCompare(a.performedAt || ''); });

  if (filter) {
    if (filter.action) logs = logs.filter(function(l) { return l.action === filter.action; });
    if (filter.targetType) logs = logs.filter(function(l) { return l.targetType === filter.targetType; });
    if (filter.dealerId) logs = logs.filter(function(l) { return l.dealerId === filter.dealerId; });
    if (filter.startDate) logs = logs.filter(function(l) { return l.performedAt >= filter.startDate; });
    if (filter.endDate) logs = logs.filter(function(l) { return l.performedAt <= filter.endDate; });
    if (filter.search) {
      var search = filter.search.toLowerCase();
      logs = logs.filter(function(l) {
        return (l.targetName || '').toLowerCase().indexOf(search) !== -1 ||
               (l.dealerName || '').toLowerCase().indexOf(search) !== -1 ||
               (l.performedBy || '').toLowerCase().indexOf(search) !== -1;
      });
    }
  }
  
  return logs;
}

// ล้าง Audit Logs
function clearAuditLogs() {
  if (!confirm('⚠️ ล้าง Audit Logs ทั้งหมด? ข้อมูลจะหายไปถาวร')) return;
  localStorage.setItem(AUDIT_LOG_KEY, '[]');
  
  // ลบใน Firebase ด้วย
  if (typeof db !== 'undefined' && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    var auditRef = db.collection('users').doc(CURRENT_USER.uid).collection('auditLogs');
    auditRef.get().then(function(snapshot) {
      var batch = db.batch();
      snapshot.forEach(function(doc) { batch.delete(doc.ref); });
      batch.commit().catch(function(e) {});
    });
  }
  
  toast('🗑️ ล้าง Audit Logs แล้ว');
  if (typeof render === 'function') render();
}

// Export Audit Logs เป็น CSV
function exportAuditLogs() {
  var logs = getAuditLogs();
  if (!logs.length) {
    toast('⚠️ ไม่มีข้อมูล Audit Logs');
    return;
  }
  
  var csv = '\uFEFF"วันที่-เวลา","ผู้กระทำ","UID","การกระทำ","ประเภท","ID","ชื่อ","Dealer ID","Dealer Name","IP Address","รายละเอียด"\n';
  
  logs.forEach(function(l) {
    var dateStr = new Date(l.performedAt).toLocaleString('th-TH');
    var detailsStr = '';
    if (l.details) {
      if (l.details.oldValue !== undefined && l.details.newValue !== undefined) {
        detailsStr = (l.details.oldValue || '-') + ' → ' + (l.details.newValue || '-');
      } else if (l.details.reason) {
        detailsStr = l.details.reason;
      } else if (l.details.note) {
        detailsStr = l.details.note;
      }
    }
    
    csv += '"' + dateStr + '",';
    csv += '"' + (l.performedBy || '-') + '",';
    csv += '"' + (l.performedByUid || '-') + '",';
    csv += '"' + l.action + '",';
    csv += '"' + l.targetType + '",';
    csv += '"' + (l.targetId || '-') + '",';
    csv += '"' + (l.targetName || '-').replace(/"/g, '""') + '",';
    csv += '"' + (l.dealerId || '-') + '",';
    csv += '"' + (l.dealerName || '-').replace(/"/g, '""') + '",';
    csv += '"' + (l.ipAddress || '-') + '",';
    csv += '"' + detailsStr.replace(/"/g, '""') + '"';
    csv += '\n';
  });
  
  dlBlob(csv, 'audit-log-' + _td() + '.csv');
}

// ================================================================
// ACTION NAME MAPPING
// ================================================================

function getAuditActionName(action) {
  var names = {
    // Dealer
    'create_dealer': '➕ สร้าง Dealer',
    'update_dealer': '✏️ แก้ไข Dealer',
    'delete_dealer': '🗑️ ลบ Dealer',
    
    // PIN & Link
    'set_pin': '🔒 ตั้ง PIN',
    'remove_pin': '🔓 ลบ PIN',
    'create_link': '🔗 สร้างลิงก์',
    'revoke_link': '🗑️ เพิกถอนลิงก์',
    
    // Pipeline
    'create_pipeline': '📊 สร้าง Pipeline',
    'update_pipeline': '✏️ อัพเดท Pipeline',
    'delete_pipeline': '🗑️ ลบ Pipeline',
    'approve_pipeline': '✅ อนุมัติ Pipeline',
    'reject_pipeline': '❌ ปฏิเสธ Pipeline',
    'status_change_pipeline': '🔄 เปลี่ยนสถานะ Pipeline',
    
    // Forecast
    'create_forecast': '📦 สร้าง Forecast',
    'update_forecast': '✏️ แก้ไข Forecast',
    'delete_forecast': '🗑️ ลบ Forecast',
    'approve_forecast': '✅ อนุมัติ Forecast',
    'reject_forecast': '❌ ปฏิเสธ Forecast',
    'restore_forecast': '🔄 กู้คืน Forecast',
    'resubmit_forecast': '📤 ส่ง Forecast ใหม่',
    
    // Visit
    'create_visit': '🤝 สร้าง Visit',
    'update_visit': '✏️ แก้ไข Visit',
    'delete_visit': '🗑️ ลบ Visit',
    
    // Task
    'create_task': '📋 สร้างงาน',
    'update_task': '✏️ แก้ไขงาน',
    'complete_task': '✅ งานเสร็จ',
    'delete_task': '🗑️ ลบงาน',
    
    // Others
    'sync_data': '🔄 Sync ข้อมูล',
    'import_data': '📥 Import ข้อมูล',
    'export_data': '📤 Export ข้อมูล',
    'login': '🔐 เข้าสู่ระบบ',
    'logout': '🚪 ออกจากระบบ'
  };
  return names[action] || action;
}

function getAuditTypeIcon(type) {
  var icons = {
    'dealer': '🏪',
    'pipeline': '📊',
    'forecast': '📦',
    'pin': '🔒',
    'link': '🔗',
    'visit': '🤝',
    'task': '📋'
  };
  return icons[type] || '📝';
}

// ================================================================
// RENDER AUDIT LOG PAGE
// ================================================================

var auditFilter = {
  action: '',
  targetType: '',
  dealerId: '',
  search: '',
  startDate: '',
  endDate: ''
};

function rAuditLog(el) {
  document.getElementById('pgT').textContent = '📜 Audit Log';
  
  var dealers = [];
  try { dealers = ST.getAll('dealers'); } catch(e) {}
  
  var dealerOptions = '<option value="">🏪 ทุก Dealer</option>';
  for (var i = 0; i < dealers.length; i++) {
    dealerOptions += '<option value="' + dealers[i].id + '">' + sanitize(dealers[i].name) + '</option>';
  }
  
  var actionOptions = [
    { value: '', label: '📌 ทุกการกระทำ' },
    { value: 'create_dealer', label: '➕ สร้าง Dealer' },
    { value: 'update_dealer', label: '✏️ แก้ไข Dealer' },
    { value: 'set_pin', label: '🔒 ตั้ง PIN' },
    { value: 'remove_pin', label: '🔓 ลบ PIN' },
    { value: 'create_link', label: '🔗 สร้างลิงก์' },
    { value: 'create_pipeline', label: '📊 สร้าง Pipeline' },
    { value: 'update_pipeline', label: '✏️ อัพเดท Pipeline' },
    { value: 'approve_pipeline', label: '✅ อนุมัติ Pipeline' },
    { value: 'reject_pipeline', label: '❌ ปฏิเสธ Pipeline' },
    { value: 'create_forecast', label: '📦 สร้าง Forecast' },
    { value: 'approve_forecast', label: '✅ อนุมัติ Forecast' },
    { value: 'reject_forecast', label: '❌ ปฏิเสธ Forecast' },
    { value: 'restore_forecast', label: '🔄 กู้คืน Forecast' },
    { value: 'create_visit', label: '🤝 สร้าง Visit' },
    { value: 'create_task', label: '📋 สร้างงาน' },
    { value: 'import_data', label: '📥 Import ข้อมูล' },
    { value: 'export_data', label: '📤 Export ข้อมูล' }
  ];
  
  var typeOptions = [
    { value: '', label: '📂 ทุกประเภท' },
    { value: 'dealer', label: '🏪 Dealer' },
    { value: 'pipeline', label: '📊 Pipeline' },
    { value: 'forecast', label: '📦 Forecast' },
    { value: 'pin', label: '🔒 PIN' },
    { value: 'link', label: '🔗 ลิงก์' },
    { value: 'visit', label: '🤝 Visit' },
    { value: 'task', label: '📋 งาน' }
  ];
  
  var html = `
    <div class="card">
      <h2>📜 Audit Log 
        <span class="ml">
          <button class="btn bsm bo" onclick="exportAuditLogs()">📤 Export CSV</button>
          <button class="btn bsm bd" onclick="clearAuditLogs()">🗑️ ล้างทั้งหมด</button>
          <button class="btn bsm bs" onclick="refreshAuditLog()">🔄 รีเฟรช</button>
        </span>
      </h2>
      
      <div class="fr" style="margin-bottom:16px; gap:8px">
        <div class="fg"><label>🔍 ค้นหา</label>
          <input type="text" id="auditSearch" placeholder="ชื่อ, Dealer, ผู้กระทำ..." value="${sanitize(auditFilter.search)}" oninput="filterAuditLogs()">
        </div>
        <div class="fg"><label>📌 การกระทำ</label>
          <select id="auditAction" onchange="filterAuditLogs()">
            ${actionOptions.map(function(a) { return '<option value="' + a.value + '"' + (auditFilter.action === a.value ? ' selected' : '') + '>' + a.label + '</option>'; }).join('')}
          </select>
        </div>
        <div class="fg"><label>📂 ประเภท</label>
          <select id="auditType" onchange="filterAuditLogs()">
            ${typeOptions.map(function(t) { return '<option value="' + t.value + '"' + (auditFilter.targetType === t.value ? ' selected' : '') + '>' + t.label + '</option>'; }).join('')}
          </select>
        </div>
        <div class="fg"><label>🏪 Dealer</label>
          <select id="auditDealer" onchange="filterAuditLogs()">
            ${dealerOptions}
          </select>
        </div>
      </div>
      
      <div class="fr" style="margin-bottom:16px; gap:8px">
        <div class="fg">${dpH('auditStartDate', auditFilter.startDate, '📅 เริ่มต้น')}</div>
        <div class="fg">${dpH('auditEndDate', auditFilter.endDate, '📅 สิ้นสุด')}</div>
        <div class="fg" style="display:flex; align-items:flex-end">
          <button class="btn bsm bo" onclick="resetAuditFilters()" style="width:100%">✖️ ล้างตัวกรอง</button>
        </div>
      </div>
      
      <div class="stats-row" style="margin-bottom:12px" id="auditStats"></div>
      
      <div id="auditLogList">
        ${renderAuditLogList(getAuditLogs(), true)}
      </div>
    </div>
  `;
  
  el.innerHTML = html;
  updateAuditStats();
}

function renderAuditLogList(logs, showStats) {
  if (!logs.length) {
    return '<div class="empty"><div class="icon">📭</div><p>ไม่มี Audit Log</p></div>';
  }
  
  var html = '<div class="tl" style="max-height:70vh; overflow-y:auto">';
  
  for (var i = 0; i < logs.length; i++) {
    var l = logs[i];
    var icon = getAuditTypeIcon(l.targetType);
    var actionName = getAuditActionName(l.action);
    var dateStr = new Date(l.performedAt).toLocaleString('th-TH');
    var changeHtml = '';
    
    if (l.details) {
      if (l.details.oldValue !== undefined && l.details.newValue !== undefined && l.details.oldValue !== l.details.newValue) {
        changeHtml = `<div class="ls" style="color:var(--accent);margin-top:4px;padding:4px 8px;background:rgba(59,130,246,0.05);border-radius:6px">
          🔄 ${l.details.oldValue || '-'} → ${l.details.newValue || '-'}
        </div>`;
      } else if (l.details.reason) {
        changeHtml = `<div class="ls" style="color:var(--text2);margin-top:4px">📝 ${sanitize(l.details.reason)}</div>`;
      } else if (l.details.note) {
        changeHtml = `<div class="ls" style="color:var(--text2);margin-top:4px">📝 ${sanitize(l.details.note)}</div>`;
      }
    }
    
    var chipClass = '';
    if (l.action.indexOf('approve') !== -1) chipClass = 'tag-completed';
    else if (l.action.indexOf('reject') !== -1) chipClass = 'tag-cancelled';
    else if (l.action.indexOf('create') !== -1) chipClass = 'tag-active';
    else if (l.action.indexOf('delete') !== -1) chipClass = 'tag-lost';
    else chipClass = 'tag-count';
    
    html += `
      <div class="ti tl-${l.action.replace(/_/g, '-')}" style="margin-bottom:10px">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px">
          <div class="td2" style="display:flex; align-items:center; gap:6px">
            <span class="tag ${chipClass}" style="font-size:10px">${actionName}</span>
            <span>${icon} ${l.targetType ? l.targetType.toUpperCase() : '-'}</span>
          </div>
          <div class="td2">${dateStr}</div>
        </div>
        <div class="tt2" style="margin:6px 0 2px">
          ${l.targetName ? sanitize(l.targetName) : '<span style="color:var(--text2)">-</span>'}
        </div>
        ${l.dealerName ? `<div class="tc2" style="font-size:11px">🏪 ${sanitize(l.dealerName)}</div>` : ''}
        <div class="tc2" style="font-size:11px; color:var(--text3); margin-top:2px">
          👤 ${sanitize(l.performedBy)} 
          ${l.ipAddress ? ` • 🌐 ${l.ipAddress}` : ''}
        </div>
        ${changeHtml}
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

function updateAuditStats() {
  var logs = getAuditLogs();
  var stats = {
    total: logs.length,
    byAction: {}
  };
  
  for (var i = 0; i < logs.length; i++) {
    var action = logs[i].action;
    if (!stats.byAction[action]) stats.byAction[action] = 0;
    stats.byAction[action]++;
  }
  
  var topActions = Object.entries(stats.byAction).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5);
  
  var html = '<div class="sr">';
  html += '<div class="sc"><div class="sn c1">' + stats.total + '</div><div class="sl">ทั้งหมด</div></div>';
  
  for (var i = 0; i < topActions.length; i++) {
    var actionName = getAuditActionName(topActions[i][0]);
    html += '<div class="sc"><div class="sn c5">' + topActions[i][1] + '</div><div class="sl">' + actionName + '</div></div>';
  }
  
  html += '</div>';
  
  var statsEl = document.getElementById('auditStats');
  if (statsEl) statsEl.innerHTML = html;
}

function filterAuditLogs() {
  var search = document.getElementById('auditSearch')?.value || '';
  var action = document.getElementById('auditAction')?.value || '';
  var targetType = document.getElementById('auditType')?.value || '';
  var dealerId = document.getElementById('auditDealer')?.value || '';
  var startDate = dpG('auditStartDate') || '';
  var endDate = dpG('auditEndDate') || '';
  
  auditFilter.search = search;
  auditFilter.action = action;
  auditFilter.targetType = targetType;
  auditFilter.dealerId = dealerId;
  auditFilter.startDate = startDate;
  auditFilter.endDate = endDate;
  
  var filtered = getAuditLogs({
    search: search,
    action: action,
    targetType: targetType,
    dealerId: dealerId,
    startDate: startDate,
    endDate: endDate
  });
  
  var container = document.getElementById('auditLogList');
  if (container) container.innerHTML = renderAuditLogList(filtered);
  updateAuditStats();
}

function resetAuditFilters() {
  auditFilter = { action: '', targetType: '', dealerId: '', search: '', startDate: '', endDate: '' };
  
  var searchEl = document.getElementById('auditSearch');
  if (searchEl) searchEl.value = '';
  
  var actionEl = document.getElementById('auditAction');
  if (actionEl) actionEl.value = '';
  
  var typeEl = document.getElementById('auditType');
  if (typeEl) typeEl.value = '';
  
  var dealerEl = document.getElementById('auditDealer');
  if (dealerEl) dealerEl.value = '';
  
  dpClr('auditStartDate');
  dpClr('auditEndDate');
  
  filterAuditLogs();
}

function refreshAuditLog() {
  filterAuditLogs();
  toast('🔄 รีเฟรช Audit Log แล้ว');
}