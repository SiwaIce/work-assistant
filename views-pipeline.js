// ================================================================
// PIPELINE DASHBOARD (NEW)
// ================================================================
function rPipeDashboard(el) {
  document.getElementById('pgT').textContent = '📊 Pipeline Dashboard';
  var dash = getPipelineDashboard();
  var ps = getPipeSummary();
  
  var wrColor = dash.winRate >= 70 ? '#22c55e' : dash.winRate >= 50 ? '#f59e0b' : '#ef4444';
  var wrBg = dash.winRate >= 70 ? '#14532d' : dash.winRate >= 50 ? '#78350f' : '#7f1d1d';

  // Calculate ALL pipeline total (every status)
  var allPipes = ST.getAll('pipeline');
  var totalAllAmt = 0;
  allPipes.forEach(function(p) { totalAllAmt += (Number(p.forecastAmount) || 0); });

  el.innerHTML = '' +
    '<div class="pipe-dash"><div class="pipe-dash-row">' +
'<div class="pipe-dash-card"><div class="val c1">' + dash.total + '</div><div class="lbl">ทั้งหมด</div></div>' +
'<div class="pipe-dash-card"><div class="val c2">' + fmtMoneyShort(dash.activeAmt) + '</div><div class="lbl">Active (' + dash.activeCount + ')</div></div>' +
'<div class="pipe-dash-card"><div class="val c5">' + fmtMoneyShort(totalAllAmt) + '</div><div class="lbl">Total</div></div>' +
'<div class="pipe-dash-card"><div class="val c2">' + fmtMoneyShort(dash.wonAmt) + '</div><div class="lbl">Won (' + dash.wonCount + ')</div></div>' +
'<div class="pipe-dash-card"><div class="val c4">' + fmtMoneyShort(dash.lostAmt) + '</div><div class="lbl">Lost (' + dash.lostCount + ')</div></div>' +
'</div>' +

    '<div class="pipe-winrate">' +
    '<div class="wr-circle" style="background:' + wrBg + ';color:' + wrColor + '">' + dash.winRate + '%</div>' +
    '<div class="wr-detail">Win Rate<br>' + dash.wonCount + ' ชนะ / ' + dash.closedCount + ' ที่จบ<br>Won: ' + fmtMoney(dash.wonAmt) + ' ฿</div>' +
    '</div>' +

    '<div class="card"><h2>📊 ตาม Status</h2>' +
    '<div class="pipe-sum">' + Object.entries(ps.summary).filter(function(e) { return e[1].count > 0; }).map(function(e) {
      return '<div class="pipe-sum-card" onclick="pipeFlt=\'' + e[0] + '\';go(\'pipeline\')">' +
        '<div class="stage" style="color:' + (e[1].color || '#94a3b8') + '">' + e[1].name + '</div>' +
        '<div class="count">' + e[1].count + '</div>' +
        '<div class="amount">' + fmtMoneyShort(e[1].amount) + '</div></div>';
    }).join('') + '</div></div>' +

    '<div class="card"><h2>🏪 Top Dealer</h2>' +
    Object.entries(dash.byDealer).sort(function(a, b) { return b[1].amount - a[1].amount; }).slice(0, 5).map(function(e) {
      var d = ST.getOne('dealers', e[0]);
      if (!d) return '';
      return '<div class="li" onclick="go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})">' +
        '<div class="lm"><div class="lt">' + sanitize(d.name) + ' ' + levelTag(d.level) + '</div>' +
        '<div class="ls">' + e[1].count + ' โครงการ • Pipeline: ' + fmtMoneyShort(e[1].amount) + ' • Won: ' + fmtMoneyShort(e[1].won) + '</div></div></div>';
    }).join('') + '</div>' +

    (dash.biddingSoon.length ? '<div class="card"><h2>⏳ Bidding ใน 30 วัน (' + dash.biddingSoon.length + ')</h2>' +
    dash.biddingSoon.map(function(p) {
      var d = ST.getOne('dealers', p.dealerId);
      var bd = dTo(p.biddingDate);
      return '<div class="li ' + dlC(p.biddingDate, false) + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">' +
        '<div class="lm"><div class="lt">' + sanitize((p.projectName || '').substr(0, 40)) + ' ' + pipeTag(p.status) + '</div>' +
        '<div class="ls">' + (d ? d.name : '') + ' • ' + fmtMoneyStyled(p.forecastAmount) + ' • Bid: ' + fDShort(p.biddingDate) + ' ' + dlB(p.biddingDate, false) + '</div>' +
        (p.nextAction ? '<div class="next-action ' + (bd <= 7 ? 'soon' : '') + '">🎯 ' + sanitize(p.nextAction) + '</div>' : '') +
        '</div></div>';
    }).join('') + '</div>' : '') +

    (dash.needUpdate.length ? '<div class="card"><h2>🔄 ต้องอัพเดต (' + dash.needUpdate.length + ')</h2>' +
    dash.needUpdate.slice(0, 8).map(function(item) {
      var p = item.pipe;
      var d = ST.getOne('dealers', p.dealerId);
      var ageClass = item.days > 30 ? 'very-old' : item.days > 14 ? 'old' : '';
      return '<div class="li" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">' +
        '<div class="lm"><div class="lt">' + sanitize((p.projectName || '').substr(0, 35)) + ' <span class="pipe-age ' + ageClass + '">' + item.days + 'd</span></div>' +
        '<div class="ls">' + (d ? d.name : '') + ' • ' + pipeTag(p.status) + ' • ' + fmtMoneyStyled(p.forecastAmount) + '</div></div>' +
        '<button class="quick-update-btn" onclick="event.stopPropagation();showQuickUpdateM(\'' + p.id + '\')">📝 Update</button>' +
        '</div>';
    }).join('') + '</div>' : '') +

    (dash.needAction.length ? '<div class="card"><h2>🎯 ต้องทำ Next Action (' + dash.needAction.length + ')</h2>' +
    dash.needAction.map(function(p) {
      var d = ST.getOne('dealers', p.dealerId);
      var isOverdue = dTo(p.followupDate) < 0;
      return '<div class="li" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">' +
        '<div class="lm"><div class="lt">' + sanitize((p.projectName || '').substr(0, 35)) + '</div>' +
        '<div class="ls">' + (d ? d.name : '') + ' • ' + pipeTag(p.status) + ' • ' + fmtMoneyStyled(p.forecastAmount) + '</div>' +
        '<div class="next-action ' + (isOverdue ? 'overdue' : 'soon') + '">🎯 ' + sanitize(p.nextAction || '') + ' • ' + fDShort(p.followupDate) + ' ' + dlB(p.followupDate, false) + '</div>' +
        '</div></div>';
    }).join('') + '</div>' : '') +

    '<div class="bg" style="margin-top:8px">' +
    '<button class="btn bp" onclick="go(\'pipeline\')">📊 ตาราง</button>' +
    '<button class="btn bo" onclick="go(\'pipeBoard\')">📋 Board</button>' +
    '<button class="btn bo" onclick="go(\'forecast\')">📦 Forecast</button>' +
    '</div></div>';
}

// ================================================================
// PIPELINE LIST (Enhanced)
// ================================================================
var pipeSearch = '';
var pipeSort = 'date_desc';
var pipeView = 'table';
var pipeGroup = 'none';

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
  
  // Calculate ALL totals (every status)
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

// ================================================================
// SORT PIPES
// ================================================================
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

// ================================================================
// PIPE CARDS (Enhanced)
// ================================================================
function renderPipeCards(pipes) {
  if (!pipes.length) return '<div class="empty"><div class="icon">📊</div><p>ไม่พบ Pipeline</p></div>';
  
  var html = '<div class="card-grid">';
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    var d = ST.getOne('dealers', p.dealerId);
    var isWon = ['win','ordered','delivered'].indexOf(p.status) !== -1;
    var isLost = p.status === 'lost';
    var amt = Number(p.forecastAmount) || 0;
    var isBig = amt >= 1500000;
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    
    var regDate = p.registerDate || (p.created ? p.created.split('T')[0] : '');
    var ageDays = regDate ? daysBetween(regDate, _td()) : 0;
    var ageClass = ageDays > 180 ? 'very-old' : ageDays > 90 ? 'old' : '';
    
    var borderStyle = '';
    if (amt >= 10000000) borderStyle = 'border-left:3px solid #ef4444;';
    else if (amt >= 5000000) borderStyle = 'border-left:3px solid #f97316;';
    else if (isBig) borderStyle = 'border-left:3px solid #f59e0b;';
    
    var nextHTML = '';
    if (p.nextAction) {
      var naClass = '';
      if (p.followupDate) {
        var fd = dTo(p.followupDate);
        if (fd < 0) naClass = 'overdue';
        else if (fd <= 3) naClass = 'soon';
      }
      nextHTML = '<div class="next-action ' + naClass + '">🎯 ' + sanitize((p.nextAction || '').substr(0, 25)) +
        (p.followupDate ? ' ' + fDShort(p.followupDate) : '') + '</div>';
    }
    
    html += '<div class="dealer-card ' + dlC(p.biddingDate, isWon || isLost) + '" ' +
      'onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" ' +
      'style="' + (isLost ? 'opacity:.4;' : '') + borderStyle + '">' +
      '<div style="display:flex;align-items:center;gap:6px"><span class="pipe-row-num">#' + (i + 1) + '</span>' +
      '<h3 style="font-size:.78rem;margin:0">' + sanitize((p.projectName || '').substr(0, 45)) + '</h3></div>' +
      '<div class="meta">' + (d ? d.name : '-') + ' • ' + (p.unitType || '') +
        ' <span class="pipe-age ' + ageClass + '">' + ageDays + 'd</span></div>' +
      '<div class="tr">' + pipeTag(p.status) + (isBig ? ' <span class="tag tag-high">💰 Big</span>' : '') + '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:.76rem;align-items:center">' +
      fmtMoneyStyled(amt) +
      '<button class="quick-update-btn" onclick="event.stopPropagation();showQuickUpdateM(\'' + p.id + '\')">📝 Update</button>' +
      '</div>' +
      '<div class="meta" style="margin-top:2px">' +
      (p.model ? '📦 ' + sanitize((p.model || '').substr(0, 25)) : '') +
      (p.biddingDate ? ' • Bid: ' + fDShort(p.biddingDate) + ' ' + dlB(p.biddingDate, isWon || isLost) : '') +
      '</div>' +
      nextHTML +
      (lastLog ? '<div style="font-size:.6rem;color:#475569;margin-top:3px;border-top:1px solid #334155;padding-top:2px">📝 ' + fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 35)) + '</div>' : '') +
      '</div>';
  }
  html += '</div>';
  return html;
}

// ================================================================
// PIPE TABLE (Enhanced)
// ================================================================
function renderPipeTable(pipes) {
  if (!pipes.length) return '<div class="empty"><div class="icon">📊</div><p>ไม่พบ Pipeline</p></div>';
  
  var html = '<div class="pipe-wrap"><table class="pipe-table" id="pipeTable"><thead><tr>' +
    '<th style="width:32px">#</th><th>Register</th><th>Project</th><th>End User</th><th>Dealer</th><th>Model</th>' +
    '<th style="text-align:right">Forecast</th><th>TOR</th><th>Bidding</th>' +
    '<th>Status</th><th>Next Action</th><th>Age</th><th>Update</th><th></th>' +
    '</tr></thead><tbody>';
  
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    var d = ST.getOne('dealers', p.dealerId);
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    var isWon = ['win','ordered','delivered'].indexOf(p.status) !== -1;
    var isLost = p.status === 'lost';
    var amt = Number(p.forecastAmount) || 0;
    
    var regDate = p.registerDate || (p.created ? p.created.split('T')[0] : '');
    var ageDays = regDate ? daysBetween(regDate, _td()) : 0;
    var ageClass = ageDays > 180 ? 'very-old' : ageDays > 90 ? 'old' : '';
    
    var nextHTML = '';
    if (p.nextAction) {
      var naClass = '';
      if (p.followupDate) {
        var fd = dTo(p.followupDate);
        if (fd < 0) naClass = 'overdue';
        else if (fd <= 3) naClass = 'soon';
      }
      nextHTML = '<div class="next-action ' + naClass + '">' + sanitize((p.nextAction || '').substr(0, 20)) +
        (p.followupDate ? ' ' + fDShort(p.followupDate) : '') + '</div>';
    }
    
    html += '<tr class="' + (isWon ? 'pipe-win' : '') + (isLost ? 'pipe-lost' : '') + '" ' +
      'onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer">' +
      '<td class="pipe-row-num">' + (i + 1) + '</td>' +
      '<td>' + fDShort(p.registerDate) + '</td>' +
      '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis" title="' + sanitize(p.projectName) + '">' + sanitize((p.projectName || '').substr(0, 40)) + '</td>' +
      '<td style="max-width:100px;overflow:hidden;text-overflow:ellipsis">' + sanitize((p.endUserTH || '').substr(0, 20)) + '</td>' +
      '<td>' + (d ? d.name : '-') + '</td>' +
      '<td style="max-width:80px;overflow:hidden;text-overflow:ellipsis">' + sanitize((p.model || '').substr(0, 18)) + '</td>' +
      '<td style="text-align:right">' + fmtMoneyStyled(amt) + '</td>' +
      '<td>' + (p.tor || '') + '</td>' +
      '<td>' + fDShort(p.biddingDate) + ' ' + dlB(p.biddingDate, isWon || isLost) + '</td>' +
      '<td>' + pipeTag(p.status) + '</td>' +
      '<td>' + nextHTML + '</td>' +
      '<td><span class="pipe-age ' + ageClass + '">' + ageDays + 'd</span></td>' +
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
// PIPELINE KANBAN BOARD (Enhanced)
// ================================================================
var pipeBoardFilter = 'all';
var pipeBoardDealer = 'all';

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
  
  // Calculate ALL totals (every status)
  var totalAll = 0;
  allPipes.forEach(function(p) { totalAll += (Number(p.forecastAmount) || 0); });
 var totalFiltered = 0;
var activeFiltered = 0;
pipes.forEach(function(p) {
  var amt = Number(p.forecastAmount) || 0;
  totalFiltered += amt;
  if (['lost','delivered'].indexOf(p.status) === -1) activeFiltered += amt;
});

  el.innerHTML = '' +
    '<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;align-items:center">' +
    '<button class="btn bp" onclick="showPipelineM()">➕ เพิ่ม</button>' +
    '<div style="flex:1"></div>' +
    '<select id="pipeBoardDlr" onchange="pipeBoardDealer=this.value;render()" style="min-width:130px;padding:4px 8px;font-size:.72rem">' +
    '<option value="all"' + (pipeBoardDealer === 'all' ? ' selected' : '') + '>🏪 ทุก Dealer (' + allPipes.length + ')</option>' +
    pipelineDealers.map(function(d) {
      var cnt = allPipes.filter(function(p) { return p.dealerId === d.id; }).length;
      return '<option value="' + d.id + '"' + (pipeBoardDealer === d.id ? ' selected' : '') + '>' + d.name + ' (' + cnt + ')</option>';
    }).join('') +
    '</select>' +
    '</div>' +
    
   '<div style="text-align:center;margin-bottom:8px;font-size:.76rem;color:#94a3b8">' +
    '📊 แสดง ' + pipes.length + '/' + allPipes.length + ' โครงการ • ' +
    'Active: ' + fmtMoneyStyled(activeFiltered) + ' • ' +
    'Total: ' + fmtMoneyStyled(totalFiltered) +
    '</div>' +
    
    '<div class="pipe-kb">' + cfg.pipelineStatuses.map(function(st) {
      var items = pipes.filter(function(p) { return p.status === st.id; });
      var amt = 0;
      items.forEach(function(p) { amt += (Number(p.forecastAmount) || 0); });
      
      items.sort(function(a, b) {
        var ba = a.biddingDate || '9999';
        var bb = b.biddingDate || '9999';
        if (ba !== bb) return ba.localeCompare(bb);
        return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0);
      });
      
      return '<div class="pipe-kb-col" data-pipecol="' + st.id + '"' +
        ' ondragover="event.preventDefault();this.classList.add(\'drag-over\')"' +
        ' ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove(\'drag-over\')"' +
        ' ondrop="event.preventDefault();this.classList.remove(\'drag-over\');pipeDrop(event,\'' + st.id + '\')">' +
        '<div class="pipe-kb-hd" style="border-bottom-color:' + st.color + '">' +
        st.name + ' <span class="pipe-kb-cnt">' + items.length + '</span></div>' +
        '<div class="pipe-kb-body">' + items.map(function(p, idx) {
          return '<div class="pipe-kb-card-num">' + (idx + 1) + '</div>' + pipeBoardCardHTML(p, st);
        }).join('') + '</div>' +
        '<div class="pipe-kb-sum">' + items.length + ' โครงการ • ' +
        fmtMoneyStyled(amt) + '</div>' +
        '</div>';
    }).join('') + '</div>';
}
// ================================================================
// PIPELINE BOARD (Enhanced v2)
// ================================================================
var pipeBoardDealer = 'all';
var pipeBoardMode = 'active';
var pipeBoardCollapsed = {};

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

  // Determine which statuses to show
  var activeStatuses = ['prospect','tor_review','quotation','bidding','negotiation'];
  var closedStatuses = ['win','ordered','delivered','on_hold','lost','recurring'];
  
  var visibleStatuses = cfg.pipelineStatuses.filter(function(st) {
    // In active mode, show only active statuses
    if (pipeBoardMode === 'active' && closedStatuses.indexOf(st.id) !== -1) return false;
    // Hide empty columns (unless mode is 'all')
    var items = pipes.filter(function(p) { return p.status === st.id; });
    if (items.length === 0 && pipeBoardMode !== 'all') return false;
    return true;
  });

  var h = '';
  
  // Toolbar
  h += '<div class="pb2-toolbar">';
  h += '<button class="btn bp" onclick="showPipelineM()">➕ เพิ่ม</button>';
  
  // Mode toggle
  h += '<div class="pb2-mode">';
  h += '<button class="btn bsm ' + (pipeBoardMode === 'active' ? 'bp' : 'bo') + '" onclick="pipeBoardMode=\'active\';render()">⚡ Active</button>';
  h += '<button class="btn bsm ' + (pipeBoardMode === 'all' ? 'bp' : 'bo') + '" onclick="pipeBoardMode=\'all\';render()">📊 ทั้งหมด</button>';
  h += '</div>';
  
  // Dealer filter
  h += '<select id="pipeBoardDlr" onchange="pipeBoardDealer=this.value;render()" class="pb2-dealer-sel">';
  h += '<option value="all"' + (pipeBoardDealer === 'all' ? ' selected' : '') + '>🏪 ทุก Dealer (' + allPipes.length + ')</option>';
  pipelineDealers.forEach(function(d) {
    var cnt = allPipes.filter(function(p) { return p.dealerId === d.id; }).length;
    h += '<option value="' + d.id + '"' + (pipeBoardDealer === d.id ? ' selected' : '') + '>' + d.name + ' (' + cnt + ')</option>';
  });
  h += '</select>';
  h += '</div>';
  
  // Stats
  h += '<div class="pb2-stats">';
  h += '📊 ' + pipes.length + ' โครงการ • ';
  h += 'Active: ' + fmtMoneyStyled(activeFiltered) + ' • ';
  h += 'Total: ' + fmtMoneyStyled(totalFiltered);
  h += '</div>';

  // Scroll buttons + Board
  h += '<div class="pb2-scroll-wrap">';
  h += '<button class="pb2-scroll-btn pb2-scroll-left" onclick="scrollBoard(-1)" title="เลื่อนซ้าย">◀</button>';
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
      // Collapsed column
      h += '<div class="pb2-col pb2-col-collapsed" onclick="toggleBoardCol(\'' + st.id + '\')"';
      h += ' data-pipecol="' + st.id + '">';
      h += '<div class="pb2-col-collapsed-inner" style="border-color:' + st.color + '">';
      h += '<div class="pb2-col-collapsed-name">' + st.name + '</div>';
      h += '<div class="pb2-col-collapsed-count">' + items.length + '</div>';
      h += '<div class="pb2-col-collapsed-amt">' + fmtMoneyShort(amt) + '</div>';
      h += '</div></div>';
    } else {
      // Expanded column
      h += '<div class="pb2-col" data-pipecol="' + st.id + '"';
      h += ' ondragover="event.preventDefault();this.classList.add(\'drag-over\')"';
      h += ' ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove(\'drag-over\')"';
      h += ' ondrop="event.preventDefault();this.classList.remove(\'drag-over\');pipeDrop(event,\'' + st.id + '\')">';
      
      // Header
      h += '<div class="pb2-hd" style="border-bottom-color:' + st.color + '">';
      h += '<div class="pb2-hd-left">';
      h += '<span class="pb2-hd-dot" style="background:' + st.color + '"></span>';
      h += '<span class="pb2-hd-name">' + st.name + '</span>';
      h += '<span class="pb2-hd-cnt">' + items.length + '</span>';
      h += '</div>';
      h += '<button class="pb2-hd-collapse" onclick="event.stopPropagation();toggleBoardCol(\'' + st.id + '\')" title="พับ">◀</button>';
      h += '</div>';
      
      // Cards
      h += '<div class="pb2-body">';
      if (items.length === 0) {
        h += '<div class="pb2-empty">ว่าง</div>';
      } else {
        items.forEach(function(p, idx) {
          h += pipeBoardCardV2(p, st, idx);
        });
      }
      h += '</div>';
      
      // Footer
      h += '<div class="pb2-foot">';
      h += '<span>' + items.length + ' โครงการ</span>';
      h += '<span>' + fmtMoneyStyled(amt) + '</span>';
      h += '</div>';
      
      h += '</div>';
    }
  });
  
  h += '</div>';
  h += '<button class="pb2-scroll-btn pb2-scroll-right" onclick="scrollBoard(1)" title="เลื่อนขวา">▶</button>';
  h += '</div>';

  // Legend
  h += '<div class="pb2-legend">';
  h += '<span>💡 ลากการ์ดย้าย Status • กดหัวคอลัมน์เพื่อพับ • เลื่อนซ้ายขวาด้วย ◀▶ หรือลากนิ้ว</span>';
  h += '</div>';

  el.innerHTML = h;
  
  // Init touch scroll
  initBoardScroll();
}

function pipeBoardCardV2(p, st, idx) {
  var d = ST.getOne('dealers', p.dealerId);
  var lastLog = ST.pipeLogsByPipe(p.id)[0];
  var isWon = ['win', 'ordered', 'delivered'].indexOf(p.status) !== -1;
  var isLost = p.status === 'lost';
  var amt = Number(p.forecastAmount) || 0;
  
  var bidHTML = '';
  if (p.biddingDate && !isWon && !isLost) {
    var bd = dTo(p.biddingDate);
    if (bd < 0) {
      bidHTML = '<div class="pb2-bid bid-past">Bid: ' + fDShort(p.biddingDate) + ' (เลย)</div>';
    } else if (bd <= 7) {
      bidHTML = '<div class="pb2-bid bid-urgent">🔴 Bid ' + fDShort(p.biddingDate) + ' (' + bd + 'd)</div>';
    } else if (bd <= 30) {
      bidHTML = '<div class="pb2-bid bid-soon">🟡 Bid ' + fDShort(p.biddingDate) + ' (' + bd + 'd)</div>';
    }
  }

  var h = '<div class="pb2-card"';
  h += ' draggable="true" data-pipeid="' + p.id + '"';
  h += ' ondragstart="event.dataTransfer.setData(\'pipeid\',\'' + p.id + '\');this.classList.add(\'dragging\')"';
  h += ' ondragend="this.classList.remove(\'dragging\')"';
  h += ' onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})"';
  h += ' style="' + (isLost ? 'opacity:.5;' : '') + '">';
  
  h += '<div class="pb2-card-head">';
  h += '<span class="pb2-card-num">#' + (idx + 1) + '</span>';
  h += '<span class="pb2-card-title">' + sanitize((p.projectName || '').substr(0, 30)) + '</span>';
  h += '</div>';
  
  h += '<div class="pb2-card-dealer">' + (d ? d.name : '-') + '</div>';
  
  if (p.model) {
    h += '<div class="pb2-card-model">📦 ' + sanitize((p.model || '').substr(0, 20)) + (p.modelQty > 1 ? ' x' + p.modelQty : '') + '</div>';
  }
  
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
  
  if (lastLog) {
    h += '<div class="pb2-card-log">📝 ' + fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 25)) + '</div>';
  }
  
  h += '</div>';
  return h;
}

function toggleBoardCol(statusId) {
  if (pipeBoardCollapsed[statusId]) {
    delete pipeBoardCollapsed[statusId];
  } else {
    pipeBoardCollapsed[statusId] = true;
  }
  render();
}

function scrollBoard(dir) {
  var board = document.getElementById('pb2Board');
  if (!board) return;
  var scrollAmt = 280;
  board.scrollBy({ left: dir * scrollAmt, behavior: 'smooth' });
}

function initBoardScroll() {
  var board = document.getElementById('pb2Board');
  if (!board) return;
  
  var isDown = false;
  var startX = 0;
  var scrollLeft = 0;
  
  board.addEventListener('mousedown', function(e) {
    if (e.target.closest('.pb2-card')) return;
    isDown = true;
    board.classList.add('pb2-grabbing');
    startX = e.pageX - board.offsetLeft;
    scrollLeft = board.scrollLeft;
  });
  
  board.addEventListener('mouseleave', function() {
    isDown = false;
    board.classList.remove('pb2-grabbing');
  });
  
  board.addEventListener('mouseup', function() {
    isDown = false;
    board.classList.remove('pb2-grabbing');
  });
  
  board.addEventListener('mousemove', function(e) {
    if (!isDown) return;
    e.preventDefault();
    var x = e.pageX - board.offsetLeft;
    var walk = (x - startX) * 1.5;
    board.scrollLeft = scrollLeft - walk;
  });
  
  // Touch scroll
  var touchStartX = 0;
  var touchScrollLeft = 0;
  
  board.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].pageX;
    touchScrollLeft = board.scrollLeft;
  }, { passive: true });
  
  board.addEventListener('touchmove', function(e) {
    var x = e.touches[0].pageX;
    var walk = (touchStartX - x) * 1.2;
    board.scrollLeft = touchScrollLeft + walk;
  }, { passive: true });
}
function pipeBoardCardHTML(p, st) {
  var d = ST.getOne('dealers', p.dealerId);
  var lastLog = ST.pipeLogsByPipe(p.id)[0];
  var isWon = ['win', 'ordered', 'delivered'].indexOf(p.status) !== -1;
  var isLost = p.status === 'lost';
  var amt = Number(p.forecastAmount) || 0;
  
  var bidHTML = '';
  if (p.biddingDate && !isWon && !isLost) {
    var bd = dTo(p.biddingDate);
    if (bd < 0) {
      bidHTML = '<div class="card-bidding bid-past">Bid: ' + fDShort(p.biddingDate) + ' (เลย)</div>';
    } else if (bd <= 7) {
      bidHTML = '<div class="card-bidding bid-urgent">🔴 Bid: ' + fDShort(p.biddingDate) + ' (' + bd + 'd)</div>';
    } else if (bd <= 30) {
      bidHTML = '<div class="card-bidding bid-soon">🟡 Bid: ' + fDShort(p.biddingDate) + ' (' + bd + 'd)</div>';
    } else {
      bidHTML = '<div style="font-size:.58rem;color:#64748b;margin-top:2px">Bid: ' + fDShort(p.biddingDate) + '</div>';
    }
  }
  
  var updateHTML = '';
  if (lastLog) {
    updateHTML = '<div class="card-update">📝 ' + fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 35)) + '</div>';
  }

  return '<div class="pipe-kb-card"' +
    ' draggable="true" data-pipeid="' + p.id + '"' +
    ' ondragstart="event.dataTransfer.setData(\'pipeid\',\'' + p.id + '\');this.classList.add(\'dragging\')"' +
    ' ondragend="this.classList.remove(\'dragging\')"' +
    ' onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})"' +
    ' style="' + (isLost ? 'opacity:.4;' : '') + '">' +
    '<h4>' + sanitize((p.projectName || '').substr(0, 35)) + '</h4>' +
    '<div class="meta">' + (d ? d.name : '-') + (p.unitType ? ' • ' + p.unitType : '') + '</div>' +
    (p.model ? '<div class="card-model">📦 ' + sanitize((p.model || '').substr(0, 25)) + (p.modelQty > 1 ? ' x' + p.modelQty : '') + '</div>' : '') +
    '<div class="amt">' + fmtMoneyStyled(amt) + '</div>' +
    bidHTML +
    (p.appointmentLetter === 'ออกแล้ว' ? '<div style="font-size:.56rem;color:#86efac;margin-top:1px">📄 แต่งตั้ง ✅</div>' : '') +
    updateHTML +
    '</div>';
}

function pipeDrop(e, newStatus) {
  var pipeId = e.dataTransfer.getData('pipeid');
  if (!pipeId) return;
  var oldPipe = ST.getOne('pipeline', pipeId);
  if (!oldPipe) return;
  
  if (['win','ordered'].indexOf(newStatus) !== -1 && ['win','ordered','delivered'].indexOf(oldPipe.status) === -1) {
    showWinReasonM(pipeId, newStatus);
    return;
  }
  if (newStatus === 'lost' && oldPipe.status !== 'lost') {
    showLossReasonM(pipeId);
    return;
  }
  
  ST.update('pipeline', pipeId, {status: newStatus});
  ST.add('pipeLog', {pipeId: pipeId, type: 'status_change', content: 'สถานะเปลี่ยนเป็น ' + getPipeName(newStatus), date: _nw()});
  toast('📊 ย้ายเป็น ' + getPipeName(newStatus));
  render();
}

function showWinReasonM(pipeId, newStatus) {
  var cfg = getConfig();
  var h = '<div class="fg"><label>สาเหตุ</label><div class="check-g">';
  cfg.winReasons.forEach(function(r) {
    h += '<label><input type="checkbox" name="wr" value="' + sanitize(r) + '"><span>' + sanitize(r) + '</span></label>';
  });
  h += '</div></div>';
  h += '<div class="fg"><label>หมายเหตุ</label><textarea id="wr_note" rows="2"></textarea></div>';
  h += '<div class="fg"><label>Real Amount (฿)</label><input type="number" id="wr_amt" value=""></div>';
  h += '<button class="btn bp btn-full" onclick="saveWinReason(\'' + pipeId + '\',\'' + newStatus + '\')">💾 บันทึก</button>';
  openM('✅ Win — สาเหตุที่ได้งาน', h);
}

function saveWinReason(pipeId, newStatus) {
  var checks = document.querySelectorAll('input[name="wr"]:checked');
  var reasons = [];
  for (var i = 0; i < checks.length; i++) reasons.push(checks[i].value);
  var note = (document.getElementById('wr_note') ? document.getElementById('wr_note').value : '').trim();
  var amt = parseFloat(document.getElementById('wr_amt') ? document.getElementById('wr_amt').value : '') || 0;
  
  var updates = {status: newStatus, winReason: reasons.join(', '), winNote: note};
  if (amt) updates.realAmount = amt;
  
  ST.update('pipeline', pipeId, updates);
  ST.add('pipeLog', {pipeId: pipeId, type: 'win', content: '✅ Win: ' + reasons.join(', ') + (note ? ' — ' + note : ''), date: _nw()});
  closeM();
  toast('✅ Win!');
  render();
}

function showLossReasonM(pipeId) {
  var cfg = getConfig();
  var h = '<div class="fg"><label>สาเหตุ</label><div class="check-g">';
  cfg.lossReasons.forEach(function(r) {
    h += '<label><input type="checkbox" name="lr" value="' + sanitize(r) + '"><span>' + sanitize(r) + '</span></label>';
  });
  h += '</div></div>';
  h += '<div class="fg"><label>คู่แข่งที่ชนะ</label><input type="text" id="lr_comp"></div>';
  h += '<div class="fg"><label>ราคาคู่แข่ง</label><input type="number" id="lr_price"></div>';
  h += '<div class="fg"><label>บทเรียน</label><textarea id="lr_note" rows="2"></textarea></div>';
  h += '<button class="btn bp btn-full" onclick="saveLossReason(\'' + pipeId + '\')">💾 บันทึก</button>';
  openM('❌ Lost — สาเหตุที่ไม่ได้งาน', h);
}

function saveLossReason(pipeId) {
  var checks = document.querySelectorAll('input[name="lr"]:checked');
  var reasons = [];
  for (var i = 0; i < checks.length; i++) reasons.push(checks[i].value);
  var competitor = (document.getElementById('lr_comp') ? document.getElementById('lr_comp').value : '').trim();
  var price = document.getElementById('lr_price') ? document.getElementById('lr_price').value : '';
  var note = (document.getElementById('lr_note') ? document.getElementById('lr_note').value : '').trim();
  
  ST.update('pipeline', pipeId, {
    status: 'lost', lossReason: reasons.join(', '),
    lossCompetitor: competitor, lossCompetitorPrice: price, lossNote: note
  });
  ST.add('pipeLog', {pipeId: pipeId, type: 'lost', content: '❌ Lost: ' + reasons.join(', ') + (competitor ? ' — ชนะโดย: ' + competitor : '') + (note ? ' — ' + note : ''), date: _nw()});
  closeM();
  toast('❌ บันทึก Lost');
  render();
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
  html += '<button class="btn bsm bo" onclick="showPipelineM(\'' + (p.dealerId || '') + '\',\'' + p.id + '\')">✏️</button>';
  html += '<button class="btn bsm bd" onclick="delPipe(\'' + p.id + '\')">🗑️</button>';
  html += '</span></h2>';

  html += '<div class="fr"><div><label style="color:#64748b;font-size:.68rem">Project Name</label><div style="font-size:.84rem">' + sanitize(p.projectName || '-') + '</div></div>';
  html += '<div><label style="color:#64748b;font-size:.68rem">Status</label><div>' + pipeTag(p.status) + '</div></div></div>';
  
  html += '<div class="fr" style="margin-top:4px"><div><label style="color:#64748b;font-size:.68rem">End User (TH)</label><div>' + sanitize(p.endUserTH || '-') + '</div></div>';
  html += '<div><label style="color:#64748b;font-size:.68rem">End User (EN)</label><div>' + sanitize(p.endUserEN || '-') + '</div></div></div>';
  
  html += '<div class="fr" style="margin-top:4px"><div><label style="color:#64748b;font-size:.68rem">Unit Type</label><div>' + (p.unitType || '-') + '</div></div>';
  html += '<div><label style="color:#64748b;font-size:.68rem">Dealer</label><div>' + (d ? d.name : '-') + ' ' + (d ? levelTag(d.level) : '') + '</div></div></div>';
  
  html += '<div class="fr" style="margin-top:4px"><div><label style="color:#64748b;font-size:.68rem">DJI Dealer</label><div>' + (p.djiDealer || '-') + '</div></div>';
html += '<div><label style="color:#64748b;font-size:.68rem">Model</label><div>' + getPipeModelSummary(p) + '</div></div></div>';

// Items list (if multi-model)
var pItems = getPipeItems(p);
if (pItems.length > 1) {
  html += '<div style="margin-top:6px"><label style="color:#64748b;font-size:.68rem">📦 รายการสินค้า (' + pItems.length + ' รายการ)</label>';
  html += '<div class="pipe-items-list" style="margin-top:4px">';
  var itemsTotal = 0;
  var itemsQty = 0;
  for (var ii = 0; ii < pItems.length; ii++) {
    var it = pItems[ii];
    var itQty = Number(it.qty) || 1;
    var itPrice = Number(it.price) || 0;
    var itTotal = Number(it.total) || (itQty * itPrice);
    itemsTotal += itTotal;
    itemsQty += itQty;
    html += '<div class="pipe-item-row">';
    html += '<span class="pipe-row-num">' + (ii + 1) + '</span>';
    html += '<span class="pipe-item-name">' + sanitize(it.model || '-') + '</span>';
    html += '<span class="pipe-item-qty">x' + itQty + '</span>';
    html += '<span class="pipe-item-price">' + (itPrice > 0 ? fmtMoney(itPrice) : '-') + '</span>';
    html += '<span class="pipe-item-total">' + fmtMoneyStyled(itTotal) + '</span>';
    html += '</div>';
  }
  html += '<div class="pipe-item-summary">';
  html += '<span>รวม ' + pItems.length + ' รายการ • ' + itemsQty + ' ชิ้น</span>';
  html += '<span>' + fmtMoneyStyled(itemsTotal) + '</span>';
  html += '</div></div></div>';
}
  
  html += '<div class="fr" style="margin-top:4px"><div><label style="color:#64748b;font-size:.68rem">Forecast Amount</label><div style="font-size:.94rem">' + fmtMoneyStyled(p.forecastAmount) + '</div></div>';
  html += '<div><label style="color:#64748b;font-size:.68rem">Real Amount</label><div style="font-size:.94rem;font-weight:700;color:#22c55e">' + (p.realAmount ? fmtMoney(p.realAmount) + ' ฿' : '-') + '</div></div></div>';
  
  html += '<div class="fr" style="margin-top:4px"><div><label style="color:#64748b;font-size:.68rem">Register Date</label><div>' + fD(p.registerDate) + '</div></div>';
  html += '<div><label style="color:#64748b;font-size:.68rem">TOR</label><div>' + (p.tor || '-') + '</div></div></div>';
  
  html += '<div class="fr" style="margin-top:4px"><div><label style="color:#64748b;font-size:.68rem">Bidding Date</label><div>' + fD(p.biddingDate) + ' ' + dlB(p.biddingDate, isWon || isLost) + '</div></div>';
  html += '<div><label style="color:#64748b;font-size:.68rem">Shipment Date</label><div>' + fD(p.shipmentDate) + '</div></div></div>';
  
  html += '<div class="fr" style="margin-top:4px"><div><label style="color:#64748b;font-size:.68rem">หนังสือแต่งตั้ง</label><div>' + (p.appointmentLetter || '-') + '</div></div>';
  html += '<div><label style="color:#64748b;font-size:.68rem">งานซ้ำ</label><div>' + (p.recurring ? '✅ ใช่' : 'ไม่ใช่') + '</div></div></div>';
  
  html += '<div class="fr" style="margin-top:4px">';
  html += '<div><label style="color:#64748b;font-size:.68rem">🎯 Next Action</label><div>' + (p.nextAction ? '<span class="next-action">' + sanitize(p.nextAction) + '</span>' : '<span style="color:#475569">ไม่ได้ตั้ง</span>') + '</div></div>';
  html += '<div><label style="color:#64748b;font-size:.68rem">📅 Follow-up Date</label><div>' + (p.followupDate ? fD(p.followupDate) + ' ' + dlB(p.followupDate, isWon || isLost) : '-') + '</div></div></div>';
  
  if (p.remark) html += '<div style="margin-top:4px"><label style="color:#64748b;font-size:.68rem">Remark</label><div style="white-space:pre-wrap;font-size:.76rem">' + sanitize(p.remark) + '</div></div>';
  
  if (isWon && p.winReason) html += '<div style="margin-top:8px;padding:8px;background:#14532d;border-radius:6px"><div style="font-size:.72rem;color:#86efac;font-weight:600">✅ Win Reason:</div><div style="font-size:.76rem;color:#86efac">' + sanitize(p.winReason) + (p.winNote ? ' — ' + sanitize(p.winNote) : '') + '</div></div>';
  
  if (isLost && p.lossReason) html += '<div style="margin-top:8px;padding:8px;background:#7f1d1d;border-radius:6px"><div style="font-size:.72rem;color:#fca5a5;font-weight:600">❌ Loss Reason:</div><div style="font-size:.76rem;color:#fca5a5">' + sanitize(p.lossReason) + (p.lossCompetitor ? ' — ชนะโดย: ' + sanitize(p.lossCompetitor) : '') + (p.lossNote ? ' — ' + sanitize(p.lossNote) : '') + '</div></div>';
  
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
      html += '<div class="ti tl-' + (l.type || 'note') + '">';
      html += '<div style="display:flex;justify-content:space-between">';
      html += '<div class="td2">' + fDT(l.date) + '</div>';
      html += '<button class="btn bsm bd" onclick="event.stopPropagation();ST.delete(\'pipeLog\',\'' + l.id + '\');render()" style="padding:1px 4px">✕</button>';
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

  el.innerHTML = html;
}

function changePipeStatus(pipeId, newStatus) {
  var old = ST.getOne('pipeline', pipeId);
  if (!old || old.status === newStatus) return;
  
  if (['win','ordered'].indexOf(newStatus) !== -1 && ['win','ordered','delivered'].indexOf(old.status) === -1) {
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