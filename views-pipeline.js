// ================================================================
// views-pipeline.js - PIPELINE MANAGEMENT
// ================================================================

var pipeFlt = 'all';
var pipeSearch = '';
var pipeSort = 'date_desc';
var pipeView = 'table';
var pipeGroup = 'none';
var pipeBoardDealer = 'all';
var pipeBoardMode = 'active';
var pipeBoardCollapsed = {};

// ✅ ตัวแปรสำหรับ Forecast Tab (Pending / Rejected)
var forecastTab = 'pending';
var selectedForecastUpdates = {};

// ================================================================
// PIPELINE LIST
// ================================================================
function rPipeline(el) {
  document.getElementById('pgT').textContent = '📊 Pipeline';
  var cfg = getConfig();
  var allPipes = ST.getAll('pipeline');
  
  var pipes = allPipes;
  if (pipeFlt !== 'all') pipes = pipes.filter(function(p) { return p.status === pipeFlt; });
  
  if (pipeSearch) {
    var q = pipeSearch.toLowerCase();
    pipes = pipes.filter(function(p) {
      var d = ST.getOne('dealers', p.dealerId);
      return (p.projectName || '').toLowerCase().indexOf(q) !== -1 ||
             (p.endUserTH || '').toLowerCase().indexOf(q) !== -1 ||
             (p.endUserEN || '').toLowerCase().indexOf(q) !== -1 ||
             (p.model || '').toLowerCase().indexOf(q) !== -1 ||
             (d && d.name || '').toLowerCase().indexOf(q) !== -1 ||
             (p.remark || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  
  pipes = sortPipes(pipes, pipeSort);
  
  var ps = getPipeSummary();
  
  var totalAllForecast = 0;
  var activeAmt = 0;
  var wonAmt = 0;
  var lostAmt = 0;
  allPipes.forEach(function(p) {
    var amt = Number(p.forecastAmount) || 0;
    totalAllForecast += amt;
    if (['lost','delivered'].indexOf(p.status) === -1) activeAmt += amt;
    if (['win','ordered','delivered'].indexOf(p.status) !== -1) wonAmt += amt;
    if (p.status === 'lost') lostAmt += amt;
  });
  var biddingSoon = allPipes.filter(function(p) { return p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 30 && ['prospect','tor_review','quotation','bidding','negotiation'].indexOf(p.status) !== -1; });

  el.innerHTML = '' +
    '<div class="sr">' +
    '<div class="sc"><div class="sn c1">' + allPipes.length + '</div><div class="sl">ทั้งหมด</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(activeAmt) + '</div><div class="sl">Active</div></div>' +
    '<div class="sc"><div class="sn c5">' + fmtMoneyShort(totalAllForecast) + '</div><div class="sl">Total</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(wonAmt) + '</div><div class="sl">Won</div></div>' +
    '<div class="sc"><div class="sn c4">' + fmtMoneyShort(lostAmt) + '</div><div class="sl">Lost</div></div>' +
    '<div class="sc"><div class="sn c3">' + biddingSoon.length + '</div><div class="sl">Bidding 30d</div></div>' +
    '</div>' +

    '<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;align-items:center">' +
    '<button class="btn bp" onclick="showPipelineM()">➕ เพิ่ม</button>' +
    '<button class="btn bo" onclick="showImportPipelineM()">📥 Import</button>' +
    '<button class="btn bo" onclick="copyPipeTable()">📋 Copy</button>' +
    '<button class="btn bo" onclick="dlPipeCSV()">📤 CSV</button>' +
    '<div style="flex:1"></div>' +
    '<button class="btn bsm ' + (pipeView === 'table' ? 'bp' : 'bo') + '" onclick="pipeView=\'table\';render()">📋</button>' +
    '<button class="btn bsm ' + (pipeView === 'card' ? 'bp' : 'bo') + '" onclick="pipeView=\'card\';render()">🃏</button>' +
    '</div>' +

    '<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap">' +
    '<input type="text" id="pipeSrc" value="' + sanitize(pipeSearch) + '" placeholder="🔍 ค้นหา Project / End User / Dealer / Model..." style="flex:1;min-width:150px" oninput="pipeSearch=this.value;render()" autocomplete="off">' +
    '<select id="pipeSortSel" onchange="pipeSort=this.value;render()" style="min-width:120px">' +
    '<option value="date_desc"' + (pipeSort === 'date_desc' ? ' selected' : '') + '>วันที่ ใหม่สุด</option>' +
    '<option value="date_asc"' + (pipeSort === 'date_asc' ? ' selected' : '') + '>วันที่ เก่าสุด</option>' +
    '<option value="amount_desc"' + (pipeSort === 'amount_desc' ? ' selected' : '') + '>มูลค่า มากสุด</option>' +
    '<option value="amount_asc"' + (pipeSort === 'amount_asc' ? ' selected' : '') + '>มูลค่า น้อยสุด</option>' +
    '<option value="bidding"' + (pipeSort === 'bidding' ? ' selected' : '') + '>Bidding ใกล้สุด</option>' +
    '<option value="dealer"' + (pipeSort === 'dealer' ? ' selected' : '') + '>ตาม Dealer</option>' +
    '<option value="status"' + (pipeSort === 'status' ? ' selected' : '') + '>ตาม Status</option>' +
    '</select>' +
    '</div>' +

    '<div class="pipe-sum">' + 
    Object.entries(ps.summary).filter(function(e) { return e[1].count > 0; }).map(function(e) {
      var k = e[0], v = e[1];
      return '<div class="pipe-sum-card ' + (pipeFlt === k ? 'act' : '') + '" onclick="pipeFlt=\'' + (pipeFlt === k ? 'all' : k) + '\';render()">' +
        '<div class="stage" style="color:' + (v.color || '#94a3b8') + '">' + v.name + '</div>' +
        '<div class="count">' + v.count + '</div>' +
        '<div class="amount">' + fmtMoneyShort(v.amount) + '</div></div>';
    }).join('') +
    '<div class="pipe-sum-card ' + (pipeFlt === 'all' ? 'act' : '') + '" onclick="pipeFlt=\'all\';render()">' +
    '<div class="stage">📊 ทั้งหมด</div><div class="count">' + ps.totalCount + '</div><div class="amount">' + fmtMoneyShort(ps.totalPipeline) + '</div></div>' +
    '</div>' +

    (pipeView === 'card' ? renderPipeCards(pipes) : renderPipeTable(pipes)) +

    '<div style="font-size:.64rem;color:#64748b;margin-top:4px">' + pipes.length + ' รายการ' +
    (pipeSearch ? ' (ค้นหา: "' + sanitize(pipeSearch) + '")' : '') +
    '</div>';
  
  var srcEl = document.getElementById('pipeSrc');
  if (srcEl && pipeSearch) {
    srcEl.focus();
    srcEl.setSelectionRange(pipeSearch.length, pipeSearch.length);
  }
}

function sortPipes(pipes, sortBy) {
  var sorted = pipes.slice();
  switch (sortBy) {
    case 'date_desc':
      sorted.sort(function(a, b) { return (b.registerDate || b.created || '').localeCompare(a.registerDate || a.created || ''); });
      break;
    case 'date_asc':
      sorted.sort(function(a, b) { return (a.registerDate || a.created || '').localeCompare(b.registerDate || b.created || ''); });
      break;
    case 'amount_desc':
      sorted.sort(function(a, b) { return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); });
      break;
    case 'amount_asc':
      sorted.sort(function(a, b) { return (Number(a.forecastAmount) || 0) - (Number(b.forecastAmount) || 0); });
      break;
    case 'bidding':
      sorted.sort(function(a, b) {
        var da = a.biddingDate || '9999';
        var db = b.biddingDate || '9999';
        return da.localeCompare(db);
      });
      break;
    case 'dealer':
      sorted.sort(function(a, b) {
        var da = ST.getOne('dealers', a.dealerId);
        var db = ST.getOne('dealers', b.dealerId);
        return (da ? da.name : '').localeCompare(db ? db.name : '');
      });
      break;
    case 'status':
      var statusOrder = ['bidding','negotiation','quotation','tor_review','prospect','win','ordered','delivered','on_hold','lost','recurring'];
      sorted.sort(function(a, b) {
        var ia = statusOrder.indexOf(a.status);
        var ib = statusOrder.indexOf(b.status);
        if (ia === -1) ia = 99;
        if (ib === -1) ib = 99;
        return ia - ib;
      });
      break;
  }
  return sorted;
}

function renderPipeCards(pipes) {
  if (!pipes.length) return '<div class="empty"><div class="icon">📊</div><p>ไม่พบ Pipeline</p></div>';
  
  var html = '<div class="card-grid">';
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    var d = ST.getOne('dealers', p.dealerId);
    var amt = Number(p.forecastAmount) || 0;
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    
    html += '<div class="dealer-card" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
    html += '<div style="display:flex;align-items:center;gap:6px"><span class="pipe-row-num">#' + (i + 1) + '</span>';
    html += '<h3 style="font-size:.78rem;margin:0">' + sanitize((p.projectName || '').substr(0, 45)) + '</h3></div>';
    html += '<div class="meta">' + (d ? d.name : '-') + ' • ' + (p.unitType || '') + '</div>';
    html += '<div class="tr">' + pipeTag(p.status) + (amt >= 1500000 ? ' <span class="tag tag-high">💰 Big</span>' : '') + '</div>';
    html += '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:.76rem;align-items:center">' + fmtMoneyStyled(amt) + '</div>';
    html += '<div class="meta" style="margin-top:2px">' + (p.model ? '📦 ' + sanitize((p.model || '').substr(0, 25)) : '') + (p.biddingDate ? ' • Bid: ' + fDShort(p.biddingDate) : '') + '</div>';
    if (lastLog) html += '<div style="font-size:.6rem;color:#475569;margin-top:3px">📝 ' + fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 35)) + '</div>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderPipeTable(pipes) {
  if (!pipes.length) return '<div class="empty"><div class="icon">📊</div><p>ไม่พบ Pipeline</p></div>';
  
  var html = '<div class="pipe-wrap"><table class="pipe-table" id="pipeTable"><thead>' +
    '<th style="width:32px">#</th>' +
    '<th>Register</th>' +
    '<th>Project</th>' +
    '<th>End User</th>' +
    '<th>Dealer</th>' +
    '<th>Model</th>' +
    '<th style="text-align:right">Forecast</th>' +
    '<th>TOR</th>' +
    '<th>Bidding</th>' +
    '<th>Status</th>' +
    '<th>Next Action</th>' +
    '<th>Age</th>' +
    '<th>Update</th>' +
    '<th></th>' +
    '</thead><tbody>';
  
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    var d = ST.getOne('dealers', p.dealerId);
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    var amt = Number(p.forecastAmount) || 0;
    var isWon = (p.status === 'win' || p.status === 'ordered' || p.status === 'delivered');
    var isLost = (p.status === 'lost');
    
    var regDate = p.registerDate || (p.created ? p.created.split('T')[0] : '');
    var ageDays = regDate ? daysBetween(regDate, _td()) : 0;
    var ageClass = ageDays > 180 ? 'very-old' : (ageDays > 90 ? 'old' : '');
    
    var modelText = getPipeModelSummary(p);
    
    var nextHtml = '';
    if (p.nextAction) {
      var naClass = '';
      if (p.followupDate) {
        var fd = dTo(p.followupDate);
        if (fd < 0) naClass = 'overdue';
        else if (fd <= 3) naClass = 'soon';
      }
      nextHtml = '<div class="next-action ' + naClass + '">' + sanitize((p.nextAction || '').substr(0, 20)) +
        (p.followupDate ? ' ' + fDShort(p.followupDate) : '') + '</div>';
    }
    
    html += '<tr class="' + (isWon ? 'pipe-win' : '') + (isLost ? 'pipe-lost' : '') + '"' +
      ' onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer">' +
      '<td class="pipe-row-num">' + (i + 1) + '</td>' +
      '<td style="white-space:nowrap">' + fDShort(p.registerDate) + '</td>' +
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="' + sanitize(p.projectName) + '">' + sanitize((p.projectName || '').substr(0, 45)) + '</td>' +
      '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis">' + sanitize((p.endUserTH || '').substr(0, 25)) + '</td>' +
      '<td style="white-space:nowrap">' + (d ? d.name : '-') + '</td>' +
      '<td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;font-size:.7rem">' + sanitize(modelText) + '</td>' +
      '<td style="text-align:right;white-space:nowrap">' + fmtMoneyStyled(amt) + '</td>' +
      '<td style="white-space:nowrap">' + (p.tor || '-') + '</td>' +
      '<td style="white-space:nowrap">' + (p.biddingDate ? fDShort(p.biddingDate) : '-') + ' ' + (p.biddingDate ? dlB(p.biddingDate, isWon || isLost) : '') + '</td>' +
      '<td style="white-space:nowrap">' + pipeTag(p.status) + '</td>' +
      '<td style="max-width:140px">' + nextHtml + '</td>' +
      '<td style="white-space:nowrap"><span class="pipe-age ' + ageClass + '">' + ageDays + 'd</span></td>' +
      '<td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;font-size:.62rem">' +
        (lastLog ? fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 25)) : '-') +
      '</td>' +
      '<td onclick="event.stopPropagation()"><button class="quick-update-btn" onclick="showQuickUpdateM(\'' + p.id + '\')">📝</button></td>' +
      '</tr>';
  }
  
  html += '</tbody></table></div>';
  return html;
}

function copyPipeTable() { copyTable('pipeTable', '📋 Copy Pipeline Table'); }

function dlPipeCSV() {
  var pipes = ST.getAll('pipeline').sort(function(a, b) { return (a.registerDate || '').localeCompare(b.registerDate || ''); });
  var maxUp = 0;
  pipes.forEach(function(p) { var c = ST.pipeLogsByPipe(p.id).length; if (c > maxUp) maxUp = c; });
  
  var csv = '\uFEFF"#","Register Date","Project Name","End User Name","End User Name Eng","Unit type","Dealer Name","DJI Dealer","Model","Forecast Amount","Real Amount","TOR","Bidding Date","Shipment date","Remark","หนังสือแต่งตั้ง","Status","งานซ้ำ"';
  for (var u = 1; u <= Math.max(maxUp, 1); u++) csv += ',"Update ' + u + '"';
  csv += '\n';
  
  pipes.forEach(function(p, idx) {
    var d = ST.getOne('dealers', p.dealerId);
    var logs = ST.pipeLogsByPipe(p.id).reverse();
    csv += '"' + (idx + 1) + '","' + fD(p.registerDate) + '","' + esc(p.projectName) + '","' + esc(p.endUserTH) + '","' + esc(p.endUserEN) + '","' + (p.unitType || '') + '","' + (d ? d.name : '') + '","' + (p.djiDealer || '') + '","' + (p.model || '') + (p.modelQty > 1 ? '*' + p.modelQty : '') + '","' + (p.forecastAmount || '') + '","' + (p.realAmount || '') + '","' + (p.tor || '') + '","' + fD(p.biddingDate) + '","' + fD(p.shipmentDate) + '","' + esc(p.remark) + '","' + (p.appointmentLetter || '') + '","' + getPipeName(p.status) + '","' + (p.recurring ? 'Yes' : '') + '"';
    for (var li = 0; li < Math.max(maxUp, 1); li++) {
      csv += ',"' + (logs[li] ? esc(fDShort(logs[li].date ? logs[li].date.split('T')[0] : '') + ' ' + logs[li].content) : '') + '"';
    }
    csv += '\n';
  });
  dlBlob(csv, 'pipeline-' + _td() + '.csv');
}

// ================================================================
// PIPELINE DETAIL
// ================================================================
function rPipeDet(el) {
  var p = ST.getOne('pipeline', S.pipeId);
  if (!p) return go('pipeline');
  var d = ST.getOne('dealers', p.dealerId);
  var logs = ST.pipeLogsByPipe(p.id);
  var isPinned = ST.hasPin(p.id);
  var isWon = ['win','ordered','delivered'].indexOf(p.status) !== -1;
  var isLost = p.status === 'lost';
  var amt = Number(p.forecastAmount) || 0;
  
  document.getElementById('pgT').textContent = '📊 ' + (p.projectName || '').substr(0, 25);

  var html = '<div class="bc"><a onclick="go(\'pipeline\')">📊 Pipeline</a><span class="sep">›</span>';
  if (d) html += '<a onclick="go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})">' + sanitize(d.name) + '</a><span class="sep">›</span>';
  html += '<span class="cur">' + sanitize((p.projectName || '').substr(0, 35)) + '</span></div>';

  html += '<div class="card"><h2>📊 ข้อมูลโครงการ <span class="ml">';
  html += '<button class="btn bsm bs" onclick="startTimer(\'pipeline\',\'' + p.id + '\',\'' + sanitize((p.projectName || '').substr(0, 18)) + '\')">⏱️</button>';
  html += '<button class="btn bsm ' + (isPinned ? 'bw' : 'bo') + '" onclick="ST.togglePin(\'pipeline\',\'' + p.id + '\',\'' + sanitize((p.projectName || '').substr(0, 20)) + '\',\'' + (d ? d.name : '') + '\');render()">📌</button>';
  html += '<button class="btn bsm bo" onclick="copyPipeRow(\'' + p.id + '\')">📋 Row</button>';
  html += '<button class="btn bsm bp" onclick="showUnifiedPipelineUpdate(\'' + p.id + '\')">✏️ อัพเดท</button>';
  html += '<button class="btn bsm bo" onclick="showPipelineM(\'' + (p.dealerId || '') + '\',\'' + p.id + '\')">📝 แก้ไขทั้งหมด</button>';
  html += '<button class="btn bsm bd" onclick="delPipe(\'' + p.id + '\')">🗑️</button>';
  html += '</span></h2>';
  
  html += '<div class="fr"><div><label>Project Name</label><div>' + sanitize(p.projectName || '-') + '</div></div>';
  html += '<div><label>Status</label><div>' + pipeTag(p.status) + '</div></div></div>';
  
  html += '<div class="fr"><div><label>End User (TH)</label><div>' + sanitize(p.endUserTH || '-') + '</div></div>';
  html += '<div><label>End User (EN)</label><div>' + sanitize(p.endUserEN || '-') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Unit Type</label><div>' + (p.unitType || '-') + '</div></div>';
  html += '<div><label>Dealer</label><div>' + (d ? d.name : '-') + ' ' + (d ? levelTag(d.level) : '') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>DJI Dealer</label><div>' + (p.djiDealer || '-') + '</div></div>';
  html += '<div><label>Model</label><div>' + getPipeModelSummary(p) + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Forecast Amount</label><div>' + fmtMoneyStyled(p.forecastAmount) + '</div></div>';
  html += '<div><label>Real Amount</label><div>' + (p.realAmount ? fmtMoney(p.realAmount) + ' ฿' : '-') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Register Date</label><div>' + fD(p.registerDate) + '</div></div>';
  html += '<div><label>TOR</label><div>' + (p.tor || '-') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Bidding Date</label><div>' + fD(p.biddingDate) + ' ' + dlB(p.biddingDate, isWon || isLost) + '</div></div>';
  html += '<div><label>Shipment Date</label><div>' + fD(p.shipmentDate) + '</div></div></div>';
  
  html += '<div class="fr"><div><label>หนังสือแต่งตั้ง</label><div>' + (p.appointmentLetter || '-') + '</div></div>';
  html += '<div><label>งานซ้ำ</label><div>' + (p.recurring ? '✅ ใช่' : 'ไม่ใช่') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>🎯 Next Action</label><div>' + (p.nextAction ? '<span class="next-action">' + sanitize(p.nextAction) + '</span>' : '<span style="color:#475569">ไม่ได้ตั้ง</span>') + '</div></div>';
  html += '<div><label>📅 Follow-up Date</label><div>' + (p.followupDate ? fD(p.followupDate) + ' ' + dlB(p.followupDate, isWon || isLost) : '-') + '</div></div></div>';
  
  if (p.remark) html += '<div><label>Remark</label><div>' + sanitize(p.remark) + '</div></div>';
  
  if (isWon && p.winReason) html += '<div style="margin-top:8px;padding:8px;background:#14532d;border-radius:6px"><div>✅ Win Reason:</div><div>' + sanitize(p.winReason) + (p.winNote ? ' — ' + sanitize(p.winNote) : '') + '</div></div>';
  if (isLost && p.lossReason) html += '<div style="margin-top:8px;padding:8px;background:#7f1d1d;border-radius:6px"><div>❌ Loss Reason:</div><div>' + sanitize(p.lossReason) + (p.lossCompetitor ? ' — ชนะโดย: ' + sanitize(p.lossCompetitor) : '') + (p.lossNote ? ' — ' + sanitize(p.lossNote) : '') + '</div></div>';
  
  html += '</div>';

  // Action Items
  html += buildPipeActionsHTML(p.id);

  // Quick Status Change
  html += '<div class="card"><h2>🔄 เปลี่ยนสถานะ</h2><div class="bg" style="flex-wrap:wrap">';
  var statuses = getConfig().pipelineStatuses;
  for (var si = 0; si < statuses.length; si++) {
    var st = statuses[si];
    html += '<button class="btn bsm ' + (p.status === st.id ? 'bp' : 'bo') + '" style="' + (p.status === st.id ? '' : 'border-color:' + st.color + ';color:' + st.color) + '" onclick="changePipeStatus(\'' + p.id + '\',\'' + st.id + '\')">' + st.name + '</button>';
  }
  html += '</div></div>';

  // Updates Timeline
  html += '<div class="card"><h2>📝 Updates (' + logs.length + ') <span class="ml"><button class="btn bsm bp" onclick="showPipeLogM(\'' + p.id + '\')">➕ Update</button></span></h2>';
  if (logs.length) {
    html += '<div class="tl">';
    for (var li = 0; li < logs.length; li++) {
      var l = logs[li];
      var isEditable = l.type !== 'win' && l.type !== 'lost';
      
      html += '<div class="ti tl-' + (l.type || 'note') + '">';
      html += '<div style="display:flex;justify-content:space-between">';
      html += '<div class="td2">' + fDT(l.date) + '</div>';
      html += '<div style="display:flex;gap:4px">';
      if (isEditable) {
        html += '<button class="btn bsm bo" onclick="event.stopPropagation();editPipelineLog(\'' + l.id + '\', \'' + p.id + '\', \'' + sanitize(l.content || '').replace(/'/g, "\\'") + '\', \'' + (l.type || 'update') + '\', \'' + (l.date || '') + '\')" style="padding:1px 6px" title="แก้ไข">✏️</button>';
        html += '<button class="btn bsm bd" onclick="event.stopPropagation();deletePipelineLog(\'' + l.id + '\', \'' + p.id + '\')" style="padding:1px 4px" title="ลบ">🗑️</button>';
      } else {
        html += '<span style="font-size:10px;color:var(--text2);padding:2px 6px">🔒</span>';
      }
      html += '</div>';
      html += '</div>';
      html += '<div class="tt2">' + logL(l.type) + '</div>';
      html += '<div class="tc2">' + sanitize(l.content) + '</div>';
      if (l.visitId) html += '<div class="ti-link" onclick="go(\'visitDetail\',{visitId:\'' + l.visitId + '\'})">ดู Visit Report →</div>';
      html += '</div>';
    }
    html += '</div>';
  } else {
    html += '<div class="empty"><p>ยังไม่มี Update — กด ➕ เพื่อบันทึก</p></div>';
  }
  html += '</div>';
  
  // Inline Comment
  html += '<div class="card"><div class="inline-comment"><textarea id="quickPipeComment" rows="2" placeholder="พิมพ์ comment ด่วน... (เช่น โทรติดตามแล้ว, ได้รับเอกสารแล้ว)"></textarea>';
  html += '<div class="inline-comment-actions" style="display:flex;gap:6px;margin-top:6px">';
  html += '<button class="btn bsm bp" onclick="addQuickPipeComment(\'' + p.id + '\')">💬 เพิ่ม Comment</button>';
  html += '<button class="btn bsm bs" onclick="addQuickPipeFollowup(\'' + p.id + '\')">📞 + นัดติดตาม</button>';
  html += '</div></div></div>';

  el.innerHTML = html;
}

function changePipeStatus(pipeId, newStatus) {
  var old = ST.getOne('pipeline', pipeId);
  if (!old || old.status === newStatus) return;
  
  if (newStatus === 'win' || newStatus === 'ordered') {
    showWinReasonM(pipeId, newStatus); return;
  }
  if (newStatus === 'lost' && old.status !== 'lost') {
    showLossReasonM(pipeId); return;
  }
  
  ST.update('pipeline', pipeId, {status: newStatus});
  ST.add('pipeLog', {pipeId: pipeId, type: 'status_change', content: 'สถานะ: ' + getPipeName(old.status) + ' → ' + getPipeName(newStatus), date: _nw()});
  toast('📊 ' + getPipeName(newStatus));
  render();
}

function delPipe(id) {
  if (!confirm('ลบ Pipeline นี้?')) return;
  ST.delete('pipeline', id);
  ST.deleteWhere('pipeLog', function(l) { return l.pipeId === id; });
  go('pipeline');
  toast('🗑️ ลบแล้ว');
}

function copyPipeRow(pipeId) {
  var p = ST.getOne('pipeline', pipeId); if (!p) return;
  var d = ST.getOne('dealers', p.dealerId);
  var logs = ST.pipeLogsByPipe(p.id).reverse();
  var tsv = fD(p.registerDate) + '\t' + (p.projectName || '') + '\t' + (p.endUserTH || '') + '\t' + (p.endUserEN || '') + '\t' + (p.unitType || '') + '\t' + (d ? d.name : '') + '\t' + (p.djiDealer || '') + '\t' + (p.model || '') + (p.modelQty > 1 ? '*' + p.modelQty : '') + '\t' + (p.forecastAmount || '') + '\t' + (p.realAmount || '') + '\t' + (p.tor || '') + '\t' + fD(p.biddingDate) + '\t' + fD(p.shipmentDate) + '\t' + (p.remark || '') + '\t' + (p.appointmentLetter || '') + '\t' + getPipeName(p.status) + '\t' + (p.recurring ? 'Yes' : '');
  for (var i = 0; i < logs.length; i++) {
    tsv += '\t' + fDShort(logs[i].date ? logs[i].date.split('T')[0] : '') + ' ' + (logs[i].content || '');
  }
  copyText(tsv, '📋 Copy Pipeline Row');
}

// ================================================================
// PIPELINE BOARD
// ================================================================
function rPipeBoard(el) {
  document.getElementById('pgT').textContent = '📋 Pipeline Board';
  var cfg = getConfig();
  var allPipes = ST.getAll('pipeline');
  var dealers = ST.getAll('dealers');
  
  var pipes = allPipes;
  if (pipeBoardDealer !== 'all') {
    pipes = pipes.filter(function(p) { return p.dealerId === pipeBoardDealer; });
  }
  
  var dealerIds = {};
  allPipes.forEach(function(p) { if (p.dealerId) dealerIds[p.dealerId] = true; });
  var pipelineDealers = dealers.filter(function(d) { return dealerIds[d.id]; });
  
  var totalFiltered = 0;
  var activeFiltered = 0;
  pipes.forEach(function(p) {
    var amt = Number(p.forecastAmount) || 0;
    totalFiltered += amt;
    if (['lost','delivered'].indexOf(p.status) === -1) activeFiltered += amt;
  });

  var activeStatuses = ['prospect','tor_review','quotation','bidding','negotiation'];
  var closedStatuses = ['win','ordered','delivered','on_hold','lost','recurring'];
  
  var visibleStatuses = cfg.pipelineStatuses.filter(function(st) {
    if (pipeBoardMode === 'active' && closedStatuses.indexOf(st.id) !== -1) return false;
    var items = pipes.filter(function(p) { return p.status === st.id; });
    if (items.length === 0 && pipeBoardMode !== 'all') return false;
    return true;
  });

  var h = '';
  
  h += '<div class="pb2-toolbar">';
  h += '<button class="btn bp" onclick="showPipelineM()">➕ เพิ่ม</button>';
  h += '<div class="pb2-mode"><button class="btn bsm ' + (pipeBoardMode === 'active' ? 'bp' : 'bo') + '" onclick="pipeBoardMode=\'active\';render()">⚡ Active</button>';
  h += '<button class="btn bsm ' + (pipeBoardMode === 'all' ? 'bp' : 'bo') + '" onclick="pipeBoardMode=\'all\';render()">📊 ทั้งหมด</button></div>';
  h += '<select id="pipeBoardDlr" onchange="pipeBoardDealer=this.value;render()" class="pb2-dealer-sel">';
  h += '<option value="all"' + (pipeBoardDealer === 'all' ? ' selected' : '') + '>🏪 ทุก Dealer (' + allPipes.length + ')</option>';
  pipelineDealers.forEach(function(d) {
    var cnt = allPipes.filter(function(p) { return p.dealerId === d.id; }).length;
    h += '<option value="' + d.id + '"' + (pipeBoardDealer === d.id ? ' selected' : '') + '>' + d.name + ' (' + cnt + ')</option>';
  });
  h += '</select></div>';
  
  h += '<div class="pb2-stats">📊 ' + pipes.length + ' โครงการ • Active: ' + fmtMoneyStyled(activeFiltered) + ' • Total: ' + fmtMoneyStyled(totalFiltered) + '</div>';

  h += '<div class="pb2-scroll-wrap">';
  h += '<button class="pb2-scroll-btn pb2-scroll-left" onclick="scrollBoard(-1)">◀</button>';
  h += '<div class="pb2-board" id="pb2Board">';
  
  visibleStatuses.forEach(function(st) {
    var items = pipes.filter(function(p) { return p.status === st.id; });
    var amt = 0;
    items.forEach(function(p) { amt += (Number(p.forecastAmount) || 0); });
    
    items.sort(function(a, b) {
      var ba = a.biddingDate || '9999';
      var bb = b.biddingDate || '9999';
      if (ba !== bb) return ba.localeCompare(bb);
      return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0);
    });
    
    var isCollapsed = pipeBoardCollapsed[st.id] === true;
    
    if (isCollapsed) {
      h += '<div class="pb2-col pb2-col-collapsed" onclick="toggleBoardCol(\'' + st.id + '\')">';
      h += '<div class="pb2-col-collapsed-inner" style="border-color:' + st.color + '">';
      h += '<div class="pb2-col-collapsed-name">' + st.name + '</div>';
      h += '<div class="pb2-col-collapsed-count">' + items.length + '</div>';
      h += '<div class="pb2-col-collapsed-amt">' + fmtMoneyShort(amt) + '</div></div></div>';
    } else {
      h += '<div class="pb2-col" data-pipecol="' + st.id + '">';
      h += '<div class="pb2-hd" style="border-bottom-color:' + st.color + '">';
      h += '<div class="pb2-hd-left"><span class="pb2-hd-dot" style="background:' + st.color + '"></span>';
      h += '<span class="pb2-hd-name">' + st.name + '</span>';
      h += '<span class="pb2-hd-cnt">' + items.length + '</span></div>';
      h += '<button class="pb2-hd-collapse" onclick="event.stopPropagation();toggleBoardCol(\'' + st.id + '\')">◀</button></div>';
      h += '<div class="pb2-body">';
      if (items.length === 0) {
        h += '<div class="pb2-empty">ว่าง</div>';
      } else {
        items.forEach(function(p, idx) {
          h += pipeBoardCardV2(p, st, idx);
        });
      }
      h += '</div>';
      h += '<div class="pb2-foot"><span>' + items.length + ' โครงการ</span><span>' + fmtMoneyStyled(amt) + '</span></div></div>';
    }
  });
  
  h += '</div>';
  h += '<button class="pb2-scroll-btn pb2-scroll-right" onclick="scrollBoard(1)">▶</button>';
  h += '</div>';
  h += '<div class="pb2-legend">💡 ลากการ์ดย้าย Status • กดหัวคอลัมน์เพื่อพับ • เลื่อนซ้ายขวาด้วย ◀▶ หรือลากนิ้ว</div>';

  el.innerHTML = h;
  initBoardScroll();
}

function pipeBoardCardV2(p, st, idx) {
  var d = ST.getOne('dealers', p.dealerId);
  var lastLog = ST.pipeLogsByPipe(p.id)[0];
  var amt = Number(p.forecastAmount) || 0;
  
  var bidHTML = '';
  if (p.biddingDate) {
    var bd = dTo(p.biddingDate);
    if (bd < 0) bidHTML = '<div class="pb2-bid bid-past">Bid: ' + fDShort(p.biddingDate) + ' (เลย)</div>';
    else if (bd <= 7) bidHTML = '<div class="pb2-bid bid-urgent">🔴 Bid ' + fDShort(p.biddingDate) + ' (' + bd + 'd)</div>';
    else if (bd <= 30) bidHTML = '<div class="pb2-bid bid-soon">🟡 Bid ' + fDShort(p.biddingDate) + ' (' + bd + 'd)</div>';
  }

  var h = '<div class="pb2-card" draggable="true" data-pipeid="' + p.id + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
  h += '<div class="pb2-card-head"><span class="pb2-card-num">#' + (idx + 1) + '</span><span class="pb2-card-title">' + sanitize((p.projectName || '').substr(0, 30)) + '</span></div>';
  h += '<div class="pb2-card-dealer">' + (d ? d.name : '-') + '</div>';
  if (p.model) h += '<div class="pb2-card-model">📦 ' + sanitize((p.model || '').substr(0, 20)) + (p.modelQty > 1 ? ' x' + p.modelQty : '') + '</div>';
  h += '<div class="pb2-card-amt">' + fmtMoneyStyled(amt) + '</div>';
  h += bidHTML;
  if (p.nextAction) {
    var naClass = '';
    if (p.followupDate) {
      var fd = dTo(p.followupDate);
      if (fd < 0) naClass = ' na-overdue';
      else if (fd <= 3) naClass = ' na-soon';
    }
    h += '<div class="pb2-card-na' + naClass + '">🎯 ' + sanitize((p.nextAction || '').substr(0, 20)) + '</div>';
  }
  if (lastLog) h += '<div class="pb2-card-log">📝 ' + fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 25)) + '</div>';
  h += '</div>';
  return h;
}

function toggleBoardCol(statusId) {
  if (pipeBoardCollapsed[statusId]) delete pipeBoardCollapsed[statusId];
  else pipeBoardCollapsed[statusId] = true;
  render();
}

function scrollBoard(dir) {
  var board = document.getElementById('pb2Board');
  if (!board) return;
  board.scrollBy({ left: dir * 280, behavior: 'smooth' });
}

function initBoardScroll() {
  var board = document.getElementById('pb2Board');
  if (!board) return;
  var isDown = false, startX = 0, scrollLeft = 0;
  board.addEventListener('mousedown', function(e) {
    if (e.target.closest('.pb2-card')) return;
    isDown = true;
    board.classList.add('pb2-grabbing');
    startX = e.pageX - board.offsetLeft;
    scrollLeft = board.scrollLeft;
  });
  board.addEventListener('mouseleave', function() { isDown = false; board.classList.remove('pb2-grabbing'); });
  board.addEventListener('mouseup', function() { isDown = false; board.classList.remove('pb2-grabbing'); });
  board.addEventListener('mousemove', function(e) {
    if (!isDown) return;
    e.preventDefault();
    var x = e.pageX - board.offsetLeft;
    var walk = (x - startX) * 1.5;
    board.scrollLeft = scrollLeft - walk;
  });
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================
function getPipeSummary() {
  var cfg = getConfig();
  var all = ST.getAll('pipeline');
  var summary = {};
  var totalPipeline = 0;
  var totalWon = 0;
  for (var i = 0; i < cfg.pipelineStatuses.length; i++) {
    var s = cfg.pipelineStatuses[i];
    var items = all.filter(function(p) { return p.status === s.id; });
    var amount = items.reduce(function(a,p) { return a + (Number(p.forecastAmount)||0); }, 0);
    summary[s.id] = {count: items.length, amount: amount, name: s.name, color: s.color};
    if (['lost','on_hold'].indexOf(s.id) === -1) totalPipeline += amount;
    if (['win','ordered','delivered'].indexOf(s.id) !== -1) totalWon += amount;
  }
  return {summary: summary, totalPipeline: totalPipeline, totalWon: totalWon, totalCount: all.length};
}

function getPipeName(statusId) {
  var cfg = getConfig();
  for (var i = 0; i < cfg.pipelineStatuses.length; i++) {
    if (cfg.pipelineStatuses[i].id === statusId) return cfg.pipelineStatuses[i].name;
  }
  return statusId;
}

function addQuickPipeComment(pipeId) {
  var text = document.getElementById('quickPipeComment')?.value.trim();
  if (!text) { toast('กรุณาพิมพ์ comment'); return; }
  ST.add('pipeLog', { pipeId: pipeId, type: 'note', content: text, date: _nw() });
  document.getElementById('quickPipeComment').value = '';
  toast('💬 เพิ่ม comment แล้ว');
  render();
}

function addQuickPipeFollowup(pipeId) {
  var note = prompt('📞 รายละเอียดการติดตาม:', '');
  if (!note) return;
  var dueDate = prompt('📅 นัดติดตามอีกครั้ง (DD/MM/YYYY):', addD(_td(), 3));
  ST.add('pipeLog', { pipeId: pipeId, type: 'followup', content: note + (dueDate ? ' (นัดติดตาม ' + dueDate + ')' : ''), date: _nw() });
  if (dueDate) ST.update('pipeline', pipeId, { followupDate: dueDate });
  toast('📞 บันทึกนัดติดตามแล้ว');
  render();
}

function rPipeDashboard(el) {
  document.getElementById('pgT').textContent = '📊 Pipeline Dashboard';
  var allPipes = ST.getAll('pipeline');
  var activeCount = 0, activeAmt = 0, wonCount = 0, wonAmt = 0, lostCount = 0, lostAmt = 0;
  for (var i = 0; i < allPipes.length; i++) {
    var amt = Number(allPipes[i].forecastAmount) || 0;
    if (allPipes[i].status === 'win' || allPipes[i].status === 'ordered' || allPipes[i].status === 'delivered') {
      wonCount++; wonAmt += amt;
    } else if (allPipes[i].status === 'lost') {
      lostCount++; lostAmt += amt;
    } else if (allPipes[i].status !== 'on_hold') {
      activeCount++; activeAmt += amt;
    }
  }
  var closedCount = wonCount + lostCount;
  var winRate = closedCount > 0 ? Math.round(wonCount / closedCount * 100) : 0;
  var wrColor = winRate >= 70 ? '#22c55e' : winRate >= 50 ? '#f59e0b' : '#ef4444';
  
  el.innerHTML = '<div class="card"><h2>📊 Pipeline Dashboard</h2>' +
    '<div class="sr"><div class="sc"><div class="sn c1">' + allPipes.length + '</div><div class="sl">ทั้งหมด</div></div>' +
    '<div class="sc"><div class="sn c2">' + activeCount + '</div><div class="sl">Active</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(activeAmt) + '</div><div class="sl">มูลค่า Active</div></div>' +
    '<div class="sc"><div class="sn c2">' + wonCount + '</div><div class="sl">Won</div></div>' +
    '<div class="sc"><div class="sn c4">' + lostCount + '</div><div class="sl">Lost</div></div>' +
    '<div class="sc"><div class="sn" style="color:' + wrColor + '">' + winRate + '%</div><div class="sl">Win Rate</div></div></div>' +
    '<div class="bg"><button class="btn bp" onclick="go(\'pipeline\')">📊 ดูทั้งหมด</button>' +
    '<button class="btn bo" onclick="go(\'pipeBoard\')">📋 Board</button></div></div>';
}

// ================================================================
// PIPELINE ACTION ITEMS
// ================================================================
function getPipeActions() {
  var saved = localStorage.getItem('v7_pipeActions');
  if (saved) {
    try { return JSON.parse(saved); } catch(e) { return []; }
  }
  return [];
}

function savePipeActions(list) {
  localStorage.setItem('v7_pipeActions', JSON.stringify(list));
}

function getPipeActionsByPipe(pipeId) {
  var actions = getPipeActions();
  return (actions || []).filter(function(a) {
    return a.pipeId === pipeId && a.status !== 'dropped';
  });
}

function autoUpdatePipeNextAction(pipeId) {
  var actions = getPipeActionsByPipe(pipeId);
  var pending = (actions || []).filter(function(a) { return a.status === 'pending'; });
  if (!pending.length) return;
  pending.sort(function(a, b) {
    var da = ftParseDate(a.dueDate);
    var db = ftParseDate(b.dueDate);
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });
  var nearest = pending[0];
  var pipe = ST.getOne('pipeline', pipeId);
  if (!pipe) return;
  var updates = {};
  if (nearest.text) updates.nextAction = nearest.text;
  if (nearest.dueDate) updates.followupDate = nearest.dueDate;
  ST.update('pipeline', pipeId, updates);
}

function markPipeActionDone(actionId) {
  var response = prompt('💬 ผลลัพธ์ / ตอบกลับ (ถ้ามี):');
  var actions = getPipeActions();
  var pipeId = '';
  for (var i = 0; i < actions.length; i++) {
    if (actions[i].id === actionId) {
      actions[i].status = 'done';
      actions[i].doneDate = _td();
      if (response) actions[i].response = response;
      pipeId = actions[i].pipeId;
      ST.add('pipeLog', {
        pipeId: pipeId,
        type: 'progress',
        content: '✅ เสร็จ: ' + actions[i].text + (response ? ' — ' + response : ''),
        date: _nw()
      });
      break;
    }
  }
  savePipeActions(actions);
  if (pipeId) autoUpdatePipeNextAction(pipeId);
  toast('✅ เสร็จแล้ว!');
  render();
}

function extendPipeAction(actionId) {
  var newDate = prompt('📅 กำหนดใหม่ (DD/MM/YYYY):');
  if (!newDate) return;
  var actions = getPipeActions();
  var pipeId = '';
  for (var i = 0; i < actions.length; i++) {
    if (actions[i].id === actionId) {
      var oldDate = actions[i].dueDate;
      actions[i].dueDate = newDate;
      pipeId = actions[i].pipeId;
      ST.add('pipeLog', {
        pipeId: pipeId,
        type: 'followup',
        content: '🔄 เลื่อนกำหนด: ' + actions[i].text + ' (' + oldDate + ' → ' + newDate + ')',
        date: _nw()
      });
      break;
    }
  }
  savePipeActions(actions);
  if (pipeId) autoUpdatePipeNextAction(pipeId);
  toast('📅 เลื่อนกำหนดแล้ว');
  render();
}

function dropPipeAction(actionId) {
  if (!confirm('ยกเลิก Action Item นี้?')) return;
  var actions = getPipeActions();
  var pipeId = '';
  for (var i = 0; i < actions.length; i++) {
    if (actions[i].id === actionId) {
      actions[i].status = 'dropped';
      pipeId = actions[i].pipeId;
      break;
    }
  }
  savePipeActions(actions);
  if (pipeId) autoUpdatePipeNextAction(pipeId);
  toast('🗑️ ยกเลิกแล้ว');
  render();
}

function buildPipeActionsHTML(pipeId) {
  var actions = getPipeActionsByPipe(pipeId);
  var pending = (actions || []).filter(function(a) { return a.status === 'pending'; });
  var done = (actions || []).filter(function(a) { return a.status === 'done'; });
  var now = new Date();
  now.setHours(0, 0, 0, 0);

  pending.sort(function(a, b) {
    var da = ftParseDate(a.dueDate);
    var db = ftParseDate(b.dueDate);
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  var h = '<div class="card"><h2>⏳ Action Items';
  if (pending.length > 0) h += ' <span class="pa-count-badge">' + pending.length + ' ค้าง</span>';
  h += ' <span class="ml"><button class="btn bsm bp" onclick="showAddPipeActionM(\'' + pipeId + '\')">➕</button></span></h2>';

  if (!pending.length && !done.length) {
    h += '<div class="empty"><p>ไม่มี Action Item — กด ➕ เพื่อเพิ่ม</p></div></div>';
    return h;
  }

  if (pending.length) {
    pending.forEach(function(a) {
      var due = ftParseDate(a.dueDate);
      var daysLeft = due ? Math.ceil((due - now) / 86400000) : 999;
      var urgClass = 'pa-normal';
      var urgLabel = '';
      if (daysLeft < 0) {
        urgClass = 'pa-overdue';
        urgLabel = '<span class="pa-urg pa-urg-red">🔴 เกิน ' + Math.abs(daysLeft) + ' วัน</span>';
      } else if (daysLeft === 0) {
        urgClass = 'pa-overdue';
        urgLabel = '<span class="pa-urg pa-urg-red">🔴 วันนี้!</span>';
      } else if (daysLeft <= 2) {
        urgClass = 'pa-urgent';
        urgLabel = '<span class="pa-urg pa-urg-orange">🟠 อีก ' + daysLeft + ' วัน</span>';
      } else if (daysLeft <= 5) {
        urgClass = 'pa-soon';
        urgLabel = '<span class="pa-urg pa-urg-yellow">🟡 อีก ' + daysLeft + ' วัน</span>';
      } else {
        urgLabel = '<span class="pa-urg pa-urg-green">🟢 อีก ' + daysLeft + ' วัน</span>';
      }
      h += '<div class="pa-item ' + urgClass + '">';
      h += '<div class="pa-dot"></div>';
      h += '<div class="pa-content">';
      h += '<div class="pa-header"><span class="pa-text">' + sanitize(a.text) + '</span>' + (a.priority === 1 ? ' <span class="pa-priority">🔴 เร่งด่วน</span>' : '') + '</div>';
      h += '<div class="pa-meta">📅 กำหนด: <strong>' + (a.dueDate || '-') + '</strong> ' + urgLabel + '</div>';
      if (a.note) h += '<div class="pa-note">' + sanitize(a.note) + '</div>';
      h += '<div class="pa-actions">';
      h += '<button class="btn-xs pa-btn-done" onclick="markPipeActionDone(\'' + a.id + '\')">✅ เสร็จแล้ว</button>';
      h += '<button class="btn-xs pa-btn-extend" onclick="extendPipeAction(\'' + a.id + '\')">📅 เลื่อนกำหนด</button>';
      h += '<button class="btn-xs pa-btn-drop" onclick="dropPipeAction(\'' + a.id + '\')">✕</button>';
      h += '</div></div></div>';
    });
  }

  if (done.length) {
    h += '<div class="pa-done-toggle" onclick="togglePaDone()">✅ เสร็จแล้ว (' + done.length + ') <span id="paDoneArrow">▶</span></div>';
    h += '<div class="pa-done-list" id="paDoneList" style="display:none">';
    done.sort(function(a, b) {
      var da = ftParseDate(a.doneDate || a.createdDate);
      var db = ftParseDate(b.doneDate || b.createdDate);
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
    done.forEach(function(a) {
      h += '<div class="pa-item pa-done">';
      h += '<div class="pa-dot pa-dot-done"></div>';
      h += '<div class="pa-content">';
      h += '<div class="pa-text" style="text-decoration:line-through;opacity:0.6">' + sanitize(a.text) + '</div>';
      h += '<div class="pa-meta" style="opacity:0.5">✅ ' + (a.doneDate || '-');
      if (a.response) h += ' — ' + sanitize(a.response);
      h += '</div></div></div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function togglePaDone() {
  var el = document.getElementById('paDoneList');
  var arrow = document.getElementById('paDoneArrow');
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
// PIPELINE MULTI-MODEL HELPERS
// ================================================================
function getPipeItems(p) {
  if (p.items && p.items.length > 0) return p.items;
  if (p.model) {
    return [{
      model: p.model,
      qty: Number(p.modelQty) || 1,
      price: getModelPrice(p.model),
      total: Number(p.forecastAmount) || 0
    }];
  }
  return [];
}

function getPipeTotalQty(p) {
  var items = getPipeItems(p);
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total += (Number(items[i].qty) || 1);
  }
  return total;
}

function getPipeModelSummary(p) {
  if (!p) return '';
  if (p.items && p.items.length > 0) {
    return p.items.map(function(it) {
      return (it.model || '-') + (it.qty > 1 ? ' x' + it.qty : '');
    }).join(', ');
  }
  return (p.model || '') + (p.modelQty > 1 ? ' x' + p.modelQty : '');
}

function showAddPipeActionM(pipeId) {
  var pipe = ST.getOne('pipeline', pipeId);
  if (!pipe) return;
  var h = '<div style="max-width:450px">';
  h += '<div style="padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:12px">';
  h += '<div style="font-weight:600">📊 ' + sanitize(pipe.projectName || pipe.name || '-') + '</div></div>';
  h += '<div class="fm-group"><label>⚡ Quick Action</label><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอเอกสารจากลูกค้า\')">📄 รอเอกสาร</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอลูกค้าตอบ Quote\')">💰 รอตอบ Quote</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอ TOR\')">📋 รอ TOR</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'นัด Demo\')">🎯 นัด Demo</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'ส่ง Spec เพิ่มเติม\')">🚁 ส่ง Spec</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'ติดต่อ DJI\')">📞 ติดต่อ DJI</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'เตรียมเอกสาร Bidding\')">📊 เตรียม Bidding</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'Follow-up ลูกค้า\')">🔄 Follow-up</button>';
  h += '</div></div>';
  h += '<div class="fm-group"><label>📝 สิ่งที่ต้องทำ / ติดตาม</label><input type="text" id="paText" class="fm-input" placeholder="เช่น รอ TOR จากลูกค้า..."></div>';
  h += '<div class="fm-group"><label>📅 กำหนดวัน</label><input type="text" id="paDueDate" class="fm-input dp" placeholder="DD/MM/YYYY"></div>';
  h += '<div class="fm-group"><label>🔴 ความเร่งด่วน</label><select id="paPriority" class="fm-input"><option value="2">ปกติ</option><option value="1">🔴 เร่งด่วน</option></select></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ (ถ้ามี)</label><textarea id="paNote" rows="2" class="fm-input" placeholder="รายละเอียดเพิ่มเติม..."></textarea></div>';
  h += '<div class="fm-actions"><button class="btn btn-blue" onclick="savePipeAction(\'' + pipeId + '\')">💾 บันทึก</button><button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
  openM('➕ Action Item', h);
}

function paQuickFill(text) {
  var el = document.getElementById('paText');
  if (el) el.value = text;
}

function savePipeAction(pipeId) {
  var text = (document.getElementById('paText').value || '').trim();
  var dueDate = (document.getElementById('paDueDate').value || '').trim();
  var priority = parseInt(document.getElementById('paPriority').value) || 2;
  var note = (document.getElementById('paNote').value || '').trim();
  if (!text) { toast('กรุณาใส่สิ่งที่ต้องทำ'); return; }
  var actions = getPipeActions();
  actions.push({
    id: 'pa_' + Date.now(),
    pipeId: pipeId,
    text: text,
    dueDate: dueDate,
    priority: priority,
    note: note,
    status: 'pending',
    createdDate: _td(),
    doneDate: '',
    response: ''
  });
  savePipeActions(actions);
  autoUpdatePipeNextAction(pipeId);
  ST.add('pipeLog', {
    pipeId: pipeId,
    type: 'action',
    content: '➕ Action Item: ' + text + (dueDate ? ' (กำหนด ' + dueDate + ')' : ''),
    date: _nw()
  });
  toast('✅ เพิ่ม Action Item แล้ว');
  closeMForce();
  render();
}
function fmtMoneyStyled(amount) {
  var v = parseFloat(amount) || 0;
  var text = fmtMoney(v);
  if (v >= 10000000) {
    return '<span class="val-mega">' + text + ' ฿</span>';
  } else if (v >= 1500000) {
    return '<span class="val-big">' + text + ' ฿</span>';
  }
  return '<span class="val-normal">' + text + ' ฿</span>';
}

// ================================================================
// EDIT PIPELINE LOG
// ================================================================
function editPipelineLog(logId, pipeId, currentText, currentType, currentDate) {
  var logTypes = [
    { value: 'update', label: '📝 อัพเดท' },
    { value: 'progress', label: '🟢 คืบหน้า' },
    { value: 'problem', label: '🔴 ปัญหา' },
    { value: 'solution', label: '🟡 แก้ไข' },
    { value: 'note', label: '⚪ หมายเหตุ' },
    { value: 'followup', label: '📞 ติดตาม' }
  ];
  
  var typeOptions = '';
  for (var i = 0; i < logTypes.length; i++) {
    typeOptions += '<option value="' + logTypes[i].value + '"' + (currentType === logTypes[i].value ? ' selected' : '') + '>' + logTypes[i].label + '</option>';
  }
  
  openM('✏️ แก้ไข Log', `
    <div class="fg">
      <label>📊 ประเภท</label>
      <select id="el_type" class="fm-input">${typeOptions}</select>
    </div>
    <div class="fg">
      <label>📅 วันที่</label>
      <input type="text" id="el_date" class="fm-input dp" value="${fD(currentDate)}">
    </div>
    <div class="fg">
      <label>📝 รายละเอียด</label>
      <textarea id="el_content" rows="4" class="fm-input">${sanitize(currentText)}</textarea>
    </div>
    <div class="fm-actions">
      <button class="btn btn-blue" onclick="savePipelineLogEdit('${logId}', '${pipeId}')">💾 บันทึก</button>
      <button class="btn bd" onclick="deletePipelineLog('${logId}', '${pipeId}')">🗑️ ลบ</button>
      <button class="btn" onclick="closeM()">ยกเลิก</button>
    </div>
  `);
}

function savePipelineLogEdit(logId, pipeId) {
  var newType = document.getElementById('el_type').value;
  var newDate = dpG('el_date') || _td();
  var newContent = document.getElementById('el_content').value.trim();
  
  if (!newContent) { toast('กรุณาใส่รายละเอียด'); return; }
  
  ST.update('pipeLog', logId, {
    type: newType,
    content: newContent,
    date: newDate + 'T' + new Date().toTimeString().slice(0, 8)
  });
  
  closeMForce();
  toast('💾 แก้ไขแล้ว');
  render();
}

function deletePipelineLog(logId, pipeId) {
  if (!confirm('ลบ Log นี้?')) return;
  ST.delete('pipeLog', logId);
  closeMForce();
  toast('🗑️ ลบแล้ว');
  render();
}

// ================================================================
// CUSTOMER FORECAST UPDATES (APPROVE PAGE)
// ================================================================

// ✅ ฟังก์ชันสำหรับ client (ลูกค้ากดส่งใหม่)
async function resubmitForecast(dealerId, updateId) {
  if (!confirm('ส่งแผนการสั่งซื้อนี้ให้พนักงานขายตรวจสอบใหม่อีกครั้ง?')) return;
  
  try {
    var updateRef = db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(updateId);
    await updateRef.update({
      _status: 'pending',
      _resubmittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      _previousStatus: 'rejected'
    });
    
    toast('✅ ส่งคำขอใหม่เรียบร้อยแล้ว รอการอนุมัติจากพนักงานขาย');
    setTimeout(function() { location.reload(); }, 1000);
  } catch(err) {
    toast('❌ เกิดข้อผิดพลาด: ' + err.message);
  }
}

// ✅ ฟังก์ชันสำหรับ admin (กด restore)
async function restoreForecastUpdate(dealerId, updateId) {
  if (!confirm('ส่งคำขอนี้กลับไปให้ตรวจสอบใหม่อีกครั้ง?')) return;
  
  try {
    var updateRef = db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(updateId);
    await updateRef.update({
      _status: 'pending',
      _restoredAt: firebase.firestore.FieldValue.serverTimestamp(),
      _restoredBy: CURRENT_USER ? CURRENT_USER.uid : 'admin'
    });
 // ✅ Audit Log
  var dealer = ST.getOne('dealers', dealerId);
  addAuditLog(
    'restore_forecast',
    'forecast',
    updateId,
    'Restore forecast',
    dealerId,
    dealer ? dealer.name : '',
    { oldValue: 'rejected', newValue: 'pending' }
  );
    
    toast('🔄 ส่งกลับไปตรวจสอบใหม่แล้ว');
    rCustomerForecastUpdates(document.getElementById('ct'));
  } catch(err) {
    toast('❌ เกิดข้อผิดพลาด: ' + err.message);
  }
}

function rCustomerForecastUpdates(el) {
  document.getElementById('pgT').textContent = '📦 แผนการสั่งซื้อจากลูกค้า';
  
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    el.innerHTML = '<div class="card"><div class="empty"><p>กรุณา login เพื่อดูคำขอ</p></div></div>';
    return;
  }
  
  var dealers = ST.getAll('dealers');
  if (!dealers.length) {
    el.innerHTML = '<div class="card"><div class="empty"><p>ไม่มี Dealer ในระบบ</p></div></div>';
    return;
  }
  
  selectedForecastUpdates = {};
  var allUpdates = [];
  var pendingCount = 0;
  var rejectedCount = 0;
  
  var promises = dealers.map(function(dealer) {
    return db.collection('dealerUpdates').doc(dealer.id).collection('forecast')
      .get()
      .then(function(snapshot) {
        snapshot.forEach(function(doc) {
          var data = doc.data();
          data.id = doc.id;
          data.dealerName = dealer.name;
          data.dealerId = dealer.id;
          allUpdates.push(data);
          if (data._status === 'pending') pendingCount++;
          if (data._status === 'rejected') rejectedCount++;
        });
      })
      .catch(function(err) { 
        console.warn('Error checking forecast for dealer:', dealer.name, err);
        return Promise.resolve();
      });
  });
  
  Promise.all(promises).then(function() {
    var badge = document.getElementById('forecastUpdateBadge');
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount ? 'inline' : 'none';
    }
    
    var pendingUpdates = allUpdates.filter(function(u) { return u._status === 'pending'; });
    var rejectedUpdates = allUpdates.filter(function(u) { return u._status === 'rejected'; });
    
    if (pendingUpdates.length === 0 && rejectedUpdates.length === 0) {
      el.innerHTML = '<div class="card"><div class="empty"><div class="icon">📭</div><p>ไม่มีคำขอแผนการสั่งซื้อจากลูกค้า</p></div></div>';
      return;
    }
    
    var html = '<div class="card"><h2>📦 แผนการสั่งซื้อจากลูกค้า</h2>';
    
    // แท็บ
    html += '<div class="ftabs" style="margin-bottom:12px">';
    html += '<div class="ftab ' + (forecastTab === 'pending' ? 'act' : '') + '" onclick="forecastTab=\'pending\'; rCustomerForecastUpdates(document.getElementById(\'ct\'))">⏳ รอตรวจสอบ (' + pendingUpdates.length + ')</div>';
    html += '<div class="ftab ' + (forecastTab === 'rejected' ? 'act' : '') + '" onclick="forecastTab=\'rejected\'; rCustomerForecastUpdates(document.getElementById(\'ct\'))">❌ ปฏิเสธ (' + rejectedUpdates.length + ')</div>';
    html += '</div>';
    
    if (forecastTab === 'pending') {
      html += '<div class="bg" style="margin-bottom:12px">';
      html += '<button class="btn bp" onclick="batchApproveForecastSelected()" style="background:#22c55e">✅ Approve ที่เลือก</button>';
      html += '<button class="btn bs" onclick="batchApproveForecastAll()" style="background:#3b82f6">✅ Approve ทั้งหมด (' + pendingUpdates.length + ')</button>';
      html += '<button class="btn bsm bo" onclick="toggleSelectAllForecast()">☑️ เลือกทั้งหมด</button>';
      html += '</div>';
    }
    
    html += '<div id="forecastUpdatesList">';
    
    if (forecastTab === 'pending') {
      for (var i = 0; i < pendingUpdates.length; i++) {
        var u = pendingUpdates[i];
        var isSelected = selectedForecastUpdates[u.id] === true;
        var updateDate = u._updatedAt ? (u._updatedAt.seconds ? new Date(u._updatedAt.seconds * 1000).toLocaleString() : u._updatedAt) : '-';
        var typeIcon = u.type === 'runrate' ? '📦' : '🏢';
        var typeText = u.type === 'runrate' ? 'Run Rate' : 'โครงการ';
        
        html += '<div class="li" style="border-left:3px solid #f59e0b; margin-bottom:8px; display:flex; flex-wrap:wrap">';
        html += '<div style="margin-right:10px">';
        html += '<input type="checkbox" class="forecast-checkbox" data-id="' + u.id + '" data-dealer="' + u.dealerId + '" ' + (isSelected ? 'checked' : '') + ' onchange="toggleForecastSelection(\'' + u.id + '\', this.checked)">';
        html += '</div>';
        html += '<div class="lm" style="flex:1">';
        html += '<div class="lt">' + typeIcon + ' <strong>' + sanitize(u.dealerName) + '</strong> - ' + typeText + ' <span class="tag tag-active">รอตรวจสอบ</span></div>';
        
        if (u.type === 'runrate') {
          html += '<div class="ls">📦 ' + sanitize(u.model || '-') + ' x' + (u.qty || 0) + ' ชิ้น • เดือน ' + (u.month || '-') + '</div>';
        } else {
          html += '<div class="ls">📋 ' + sanitize(u.projectName || '-') + '</div>';
          if (u.endUser) html += '<div class="ls">👤 ' + sanitize(u.endUser) + '</div>';
          html += '<div class="ls">📦 ' + (u.items || []).map(function(it) { return it.model + ' x' + it.qty; }).join(', ') + '</div>';
          html += '<div class="ls">📅 เดือน ' + (u.month || '-') + '</div>';
        }
        
        html += '<div class="ls">⏰ ' + updateDate + '</div>';
        html += '</div>';
        html += '<div class="bg" style="flex-shrink:0">';
        html += '<button class="btn bsm bs" onclick="approveForecastUpdate(\'' + u.dealerId + '\', \'' + u.id + '\')">✅ อนุมัติ</button>';
        html += '<button class="btn bsm bd" onclick="rejectForecastUpdate(\'' + u.dealerId + '\', \'' + u.id + '\')">❌ ปฏิเสธ</button>';
        html += '<button class="btn bsm bo" onclick="viewForecastDetail(\'' + u.dealerId + '\', \'' + u.id + '\')">👁️ รายละเอียด</button>';
        html += '</div></div>';
      }
    } else {
      // แสดง rejected updates
      for (var i = 0; i < rejectedUpdates.length; i++) {
        var u = rejectedUpdates[i];
        var updateDate = u._updatedAt ? (u._updatedAt.seconds ? new Date(u._updatedAt.seconds * 1000).toLocaleString() : u._updatedAt) : '-';
        var rejectDate = u._rejectedAt ? (u._rejectedAt.seconds ? new Date(u._rejectedAt.seconds * 1000).toLocaleString() : u._rejectedAt) : '-';
        var typeIcon = u.type === 'runrate' ? '📦' : '🏢';
        var typeText = u.type === 'runrate' ? 'Run Rate' : 'โครงการ';
        
        html += '<div class="li" style="border-left:3px solid #ef4444; margin-bottom:8px; display:flex; flex-wrap:wrap; background:rgba(239,68,68,0.03)">';
        html += '<div class="lm" style="flex:1">';
        html += '<div class="lt">' + typeIcon + ' <strong>' + sanitize(u.dealerName) + '</strong> - ' + typeText + ' <span class="tag tag-cancelled" style="background:#ef4444; color:white">❌ ปฏิเสธ</span></div>';
        
        if (u.type === 'runrate') {
          html += '<div class="ls">📦 ' + sanitize(u.model || '-') + ' x' + (u.qty || 0) + ' ชิ้น • เดือน ' + (u.month || '-') + '</div>';
        } else {
          html += '<div class="ls">📋 ' + sanitize(u.projectName || '-') + '</div>';
          if (u.endUser) html += '<div class="ls">👤 ' + sanitize(u.endUser) + '</div>';
          html += '<div class="ls">📦 ' + (u.items || []).map(function(it) { return it.model + ' x' + it.qty; }).join(', ') + '</div>';
          html += '<div class="ls">📅 เดือน ' + (u.month || '-') + '</div>';
        }
        
        html += '<div class="ls">⏰ ส่งเมื่อ: ' + updateDate + '</div>';
        html += '<div class="ls">❌ ปฏิเสธเมื่อ: ' + rejectDate + '</div>';
        html += '</div>';
        html += '<div class="bg" style="flex-shrink:0">';
        html += '<button class="btn bsm bs" onclick="restoreForecastUpdate(\'' + u.dealerId + '\', \'' + u.id + '\')">🔄 ส่งกลับไปตรวจสอบใหม่</button>';
        html += '<button class="btn bsm bo" onclick="viewForecastDetail(\'' + u.dealerId + '\', \'' + u.id + '\')">👁️ รายละเอียด</button>';
        html += '</div></div>';
      }
    }
    
    html += '</div></div>';
    el.innerHTML = html;
  });
}

function toggleForecastSelection(updateId, isChecked) {
  selectedForecastUpdates[updateId] = isChecked;
  updateForecastBatchButtonBadge();
}

function updateForecastBatchButtonBadge() {
  var count = 0;
  for (var k in selectedForecastUpdates) if (selectedForecastUpdates[k]) count++;
  var btn = document.querySelector('button[onclick="batchApproveForecastSelected()"]');
  if (btn) btn.innerHTML = '✅ Approve ที่เลือก (' + count + ')';
}

function toggleSelectAllForecast() {
  var checkboxes = document.querySelectorAll('.forecast-checkbox');
  var allChecked = true;
  for (var i = 0; i < checkboxes.length; i++) {
    if (!checkboxes[i].checked) { allChecked = false; break; }
  }
  var newState = !allChecked;
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].checked = newState;
    selectedForecastUpdates[checkboxes[i].dataset.id] = newState;
  }
  updateForecastBatchButtonBadge();
}

function batchApproveForecastSelected() {
  var selectedIds = [];
  var selectedDealers = {};
  var checkboxes = document.querySelectorAll('.forecast-checkbox:checked');
  
  for (var i = 0; i < checkboxes.length; i++) {
    var updateId = checkboxes[i].dataset.id;
    var dealerId = checkboxes[i].dataset.dealer;
    if (!selectedDealers[dealerId]) selectedDealers[dealerId] = [];
    selectedDealers[dealerId].push(updateId);
    selectedIds.push(updateId);
  }
  
  if (selectedIds.length === 0) { toast('⚠️ กรุณาเลือกรายการ'); return; }
  if (!confirm('✅ อนุมัติ ' + selectedIds.length + ' รายการ?')) return;
  
  var completed = 0, errors = 0;
  
  for (var dealerId in selectedDealers) {
    selectedDealers[dealerId].forEach(function(updateId) {
      approveForecastUpdate(dealerId, updateId, function(success) {
        completed++;
        if (!success) errors++;
        if (completed === selectedIds.length) {
          toast('✅ อนุมัติ ' + (selectedIds.length - errors) + ' รายการ');
          setTimeout(function() { render(); }, 1000);
        }
      });
    });
  }
}

function batchApproveForecastAll() {
  var checkboxes = document.querySelectorAll('.forecast-checkbox');
  if (checkboxes.length === 0) { toast('⚠️ ไม่มีรายการ'); return; }
  if (!confirm('✅ อนุมัติทั้งหมด ' + checkboxes.length + ' รายการ?')) return;
  
  var completed = 0, errors = 0;
  
  for (var i = 0; i < checkboxes.length; i++) {
    var updateId = checkboxes[i].dataset.id;
    var dealerId = checkboxes[i].dataset.dealer;
    approveForecastUpdate(dealerId, updateId, function(success) {
      completed++;
      if (!success) errors++;
      if (completed === checkboxes.length) {
        toast('✅ อนุมัติทั้งหมด ' + (checkboxes.length - errors) + ' รายการ');
        setTimeout(function() { render(); }, 1000);
      }
    });
  }
}

// approveForecastUpdate / rejectForecastUpdate ถูกย้ายไปรวมที่ app.js (เวอร์ชันเดียว มี audit log)
// เดิมเวอร์ชันที่นี่มีบั๊ก (var dealer ตกหาย) และถูก app.js override อยู่แล้ว
function viewForecastDetail(dealerId, updateId) {
  db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(updateId).get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    
    var html = '<div style="max-width:500px">';
    html += '<h3>📦 รายละเอียดแผนการสั่งซื้อ</h3>';
    html += '<div><strong>🏪 Dealer:</strong> ' + sanitize(data.dealerName || dealerId) + '</div>';
    html += '<div><strong>📅 เดือน:</strong> ' + (data.month || '-') + '</div>';
    html += '<div><strong>📊 ประเภท:</strong> ' + (data.type === 'runrate' ? 'Run Rate' : 'โครงการ') + '</div>';
    
    if (data.type === 'runrate') {
      html += '<div><strong>📦 Model:</strong> ' + sanitize(data.model || '-') + '</div>';
      html += '<div><strong>🔢 จำนวน:</strong> ' + (data.qty || 0) + ' ชิ้น</div>';
    } else {
      html += '<div><strong>📋 โครงการ:</strong> ' + sanitize(data.projectName || '-') + '</div>';
      if (data.endUser) html += '<div><strong>👤 End User:</strong> ' + sanitize(data.endUser) + '</div>';
      html += '<div><strong>📦 สินค้า:</strong></div><ul>';
      if (data.items && data.items.length) {
        for (var i = 0; i < data.items.length; i++) {
          html += '<li>' + sanitize(data.items[i].model) + ' x' + (data.items[i].qty || 1) + '</li>';
        }
      } else {
        html += '<li>ไม่มีข้อมูลสินค้า</li>';
      }
      html += '</ul>';
    }
    
    // แสดงสถานะปัจจุบัน
    var statusText = '';
    if (data._status === 'pending') statusText = '<span class="tag tag-active">⏳ รอตรวจสอบ</span>';
    else if (data._status === 'approved') statusText = '<span class="tag tag-completed">✅ อนุมัติแล้ว</span>';
    else if (data._status === 'rejected') statusText = '<span class="tag tag-cancelled">❌ ปฏิเสธ</span>';
    html += '<div><strong>📊 สถานะ:</strong> ' + statusText + '</div>';
    
    html += '<div class="fm-actions" style="margin-top:16px">';
    
    // แสดงปุ่มตามสถานะ
    if (data._status === 'pending') {
      html += '<button class="btn bs" onclick="closeM();approveForecastUpdate(\'' + dealerId + '\', \'' + updateId + '\')">✅ อนุมัติ</button>';
      html += '<button class="btn bd" onclick="closeM();rejectForecastUpdate(\'' + dealerId + '\', \'' + updateId + '\')">❌ ปฏิเสธ</button>';
    } else if (data._status === 'rejected') {
      html += '<button class="btn bs" onclick="closeM();restoreForecastUpdate(\'' + dealerId + '\', \'' + updateId + '\')">🔄 ส่งกลับไปตรวจสอบใหม่</button>';
    }
    
    html += '<button class="btn" onclick="closeM()">ปิด</button>';
    html += '</div></div>';
    
    openM('📦 รายละเอียด', html);
  }).catch(function(err) {
    console.error('View forecast detail error:', err);
    toast('❌ ไม่สามารถโหลดรายละเอียดได้');
  });
}