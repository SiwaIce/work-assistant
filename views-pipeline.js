// ================================================================
// views-pipeline.js - PIPELINE MANAGEMENT
// ================================================================

var pipeCardCols = 1; // 1 หรือ 2 — จำนวนคอลัมน์การ์ดในเมนู Pipeline หลัก (เหมือน pipeTeamCardCols ของ Pipeline รวมทีม)
var pipeFlt = {}; // multi-select: {statusId: true, ...} — ว่าง = แสดงทุกสถานะ (เดิมเป็น string เดี่ยว)
var pipeBidMonthFilter = {}; // multi-select: {monthIdx(0-11): true, ...} — ว่าง = ทุกเดือน กรองจาก biddingDate
function togglePipeStatus(k) { if (pipeFlt[k]) delete pipeFlt[k]; else pipeFlt[k] = true; render(); }
function clearPipeStatusFlt() { pipeFlt = {}; render(); }
function togglePipeBidMonth(idx) { if (pipeBidMonthFilter[idx]) delete pipeBidMonthFilter[idx]; else pipeBidMonthFilter[idx] = true; render(); }
function clearPipeBidMonthFilter() { pipeBidMonthFilter = {}; render(); }
var pipeFY = 'all';
var pipeTaskFlt = false; // true = แสดงเฉพาะโครงการที่มี Task เปิดค้างอยู่ (ดู pipeOpenTasks ใน app.js)
function togglePipeTaskFlt() { pipeTaskFlt = !pipeTaskFlt; render(); }
var pipeSale = 'all';
var pipeDisplayFlt = 'all';
var pipeSearch = '';
var pipeSearchMode = 'all'; // 'all'|'rowno'|'project'|'dealer' — เลือกฟิลด์ที่จะค้นหา กันพิมพ์ Row No. แล้วขึ้นทุกอย่างเพราะไปแมตช์ endUser/model/remark ด้วย (เหมือน pcSearchMode ในหน้าเปรียบเทียบโครงการ)
var _pipeSearchTimer = null;
// หน่วงเวลาก่อน re-render — render() วาด #pipeSrc ใหม่ทุกครั้ง (สร้าง input element ใหม่แทนที่ตัวเดิม)
// ถ้า re-render ทุกตัวอักษรที่พิมพ์ จะรบกวนการพิมพ์ต่อเนื่อง (คีย์บอร์ดมือถือกระพริบ/โฟกัสหลุด) ต้องรอให้พิมพ์หยุดก่อนค่อย render
function pipeSearchInput(v) {
  pipeSearch = v;
  clearTimeout(_pipeSearchTimer);
  _pipeSearchTimer = setTimeout(function() { render(); }, 350);
}
function pipeSearchSetMode(mode) { pipeSearchMode = mode; render(); }
var pipeSort = 'updated_desc';
var pipeView = (typeof window !== 'undefined' && window.innerWidth < 768) ? 'card' : 'table'; // มือถือ: ตารางกว้าง 1245px ต้องเลื่อนแนวนอนในกล่อง 335px ใช้งานยาก เริ่มด้วยการ์ดแทน
var pipeSelectMode = false;

// ================================================================
// PIPELINE รวมทีม — หน้าดูอย่างเดียว รวม Pipeline ของทุกคน (เจ้าของแอปหลัก + เซลทุกลิงก์) จาก
// teamPipeline (collection กลางเดิมที่ใช้เช็ค "โครงการชนกัน" อยู่แล้ว และ gm-view.html ก็อ่านตัวนี้)
// แก้ไขไม่ได้จากหน้านี้ — ใครจะแก้ต้องไปแก้ที่ Pipeline ของตัวเอง แล้วมันจะ sync ขึ้นมาที่นี่เอง
// ================================================================
var pipeTeamOwnerFlt = 'all';
var pipeTeamStatusFlt = {}; // multi-select: {statusId: true, ...} — ว่าง = แสดงทุกสถานะ
var pipeTeamBidMonthFilter = {}; // multi-select: {monthIdx(0-11): true, ...} — ว่าง = ทุกเดือน (กรองจาก biddingDate)
var pipeTeamCardCols = 1; // 1 หรือ 2 — จำนวนคอลัมน์การ์ดตอนดูมุมมองการ์ด (เหมือน taskCardCols ของหน้า Task)
var pipeTeamSort = 'amount_desc';
var pipeTeamView = 'card';
var pipeTeamFY = 'all';
// ✅ collapsible sections + urgent bar — เลียนแบบโครงหน้า Pipeline หลัก (pipeDash/pipeFilter/pipeUrgent)
var pipeTeamDashOpen = localStorage.getItem('pipeTeamDashOpen') !== '0';
var pipeTeamFilterOpen = localStorage.getItem('pipeTeamFilterOpen') !== '0';
var pipeTeamUrgentOpen = localStorage.getItem('pipeTeamUrgentOpen') !== '0';
var pipeTeamUrgentFlt = ''; // '', 'bid7', 'bid30'

function togglePipeTeamStatus(k) {
  if (pipeTeamStatusFlt[k]) delete pipeTeamStatusFlt[k]; else pipeTeamStatusFlt[k] = true;
  render();
}
function clearPipeTeamStatusFlt() { pipeTeamStatusFlt = {}; render(); }

function togglePipeTeamBidMonth(idx) {
  if (pipeTeamBidMonthFilter[idx]) delete pipeTeamBidMonthFilter[idx]; else pipeTeamBidMonthFilter[idx] = true;
  render();
}
function clearPipeTeamBidMonthFilter() { pipeTeamBidMonthFilter = {}; render(); }

function _pipeTeamMergedList() {
  var mine = ST.getAll('pipeline').filter(function(p) { return pipeIsOpen(p); }).map(function(p) {
    var d = ST.getOne('dealers', p.dealerId);
    return {
      id: p.id, dealerName: d ? d.name : '', projectName: p.projectName || '', endUserTH: p.endUserTH || '',
      rowNo: p.rowNo || '',
      forecastAmount: Number(p.forecastAmount) || 0, status: p.status || 'initial',
      model: getPipeModelSummary(p), biddingDate: p.biddingDate || '',
      budgetFiscalYear: p.budgetFiscalYear || '', expectedCloseDate: p.expectedCloseDate || '',
      ownerName: (typeof SALES_MODE !== 'undefined' && SALES_MODE && typeof SALES_PROFILE !== 'undefined' && SALES_PROFILE) ? SALES_PROFILE.name : (getConfig().saleName || 'Main'),
      _mine: true
    };
  });
  var others = (typeof _teamPipelineData !== 'undefined' ? _teamPipelineData : []).map(function(p) {
    return { id: p.id, dealerName: p.dealerName || p._dealerName || '', projectName: p.projectName || '', rowNo: p.rowNo || '', endUserTH: p.endUserTH || '',
      forecastAmount: Number(p.forecastAmount) || 0, status: p.status || 'initial', model: p.model || '', biddingDate: p.biddingDate || '',
      ownerName: p.ownerName || p._ownerName || '?', _mine: false };
  });
  return mine.concat(others);
}

function _pipeTeamStatusSummary(list) {
  var cfg = getConfig();
  var summary = {};
  cfg.pipelineStatuses.forEach(function(s) {
    var items = list.filter(function(p) { return p.status === s.id; });
    summary[s.id] = { count: items.length, amount: items.reduce(function(a, p) { return a + p.forecastAmount; }, 0), name: s.name, color: s.color };
  });
  return summary;
}

function _sortPipeTeamList(list, sortBy) {
  var sorted = list.slice();
  switch (sortBy) {
    case 'amount_asc': sorted.sort(function(a, b) { return a.forecastAmount - b.forecastAmount; }); break;
    case 'project': sorted.sort(function(a, b) { return (a.projectName || '').localeCompare(b.projectName || ''); }); break;
    case 'dealer': sorted.sort(function(a, b) { return (a.dealerName || '').localeCompare(b.dealerName || ''); }); break;
    case 'owner': sorted.sort(function(a, b) { return (a.ownerName || '').localeCompare(b.ownerName || ''); }); break;
    case 'status':
      var order = ['bidding', 'on_process', 'draft_tor', 'initial', 'win', 'contracting', 'deliver', 'fail_lost'];
      sorted.sort(function(a, b) { var ia = order.indexOf(a.status); var ib = order.indexOf(b.status); if (ia === -1) ia = 99; if (ib === -1) ib = 99; return ia - ib; });
      break;
    default: sorted.sort(function(a, b) { return b.forecastAmount - a.forecastAmount; }); // amount_desc
  }
  return sorted;
}

function rPipelineTeam(el) {
  document.getElementById('pgT').textContent = '📊 Pipeline รวมทีม';
  var fullList = _pipeTeamMergedList();
  var ps = _pipeTeamStatusSummary(fullList);

  var owners = [];
  fullList.forEach(function(p) { if (p.ownerName && owners.indexOf(p.ownerName) === -1) owners.push(p.ownerName); });
  owners.sort();

  var list = fullList;
  if (pipeTeamSearch) {
    var q = pipeTeamSearch.toLowerCase();
    list = list.filter(function(p) {
      return (p.projectName || '').toLowerCase().indexOf(q) !== -1 ||
             (p.endUserTH || '').toLowerCase().indexOf(q) !== -1 ||
             (p.dealerName || '').toLowerCase().indexOf(q) !== -1 ||
             (p.model || '').toLowerCase().indexOf(q) !== -1 ||
             String(p.rowNo || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  if (pipeTeamOwnerFlt !== 'all') list = list.filter(function(p) { return p.ownerName === pipeTeamOwnerFlt; });
  if (Object.keys(pipeTeamStatusFlt).length) list = list.filter(function(p) { return pipeTeamStatusFlt[p.status]; });
  if (Object.keys(pipeTeamBidMonthFilter).length) {
    list = list.filter(function(p) {
      var d = fcParseDate(p.biddingDate);
      return d && pipeTeamBidMonthFilter[d.getMonth()];
    });
  }
  if (pipeTeamFY !== 'all') {
    list = list.filter(function(p) {
      var fy = p.budgetFiscalYear || thaiFYFromISO(p.expectedCloseDate || p.biddingDate);
      return String(fy || '') === String(pipeTeamFY);
    });
  }
  if (pipeTeamUrgentFlt) {
    list = list.filter(function(p) {
      if (!pipeIsActive(p) || !p.biddingDate) return false;
      var bd = dTo(p.biddingDate);
      return pipeTeamUrgentFlt === 'bid7' ? (bd >= 0 && bd <= 7) : (bd > 7 && bd <= 30);
    });
  }
  list = _sortPipeTeamList(list, pipeTeamSort);

  var totalAmt = fullList.reduce(function(s, p) { return s + p.forecastAmount; }, 0);
  var mineCount = fullList.filter(function(p) { return p._mine; }).length;
  var activeAmt = 0, wonAmt = 0;
  fullList.forEach(function(p) { if (pipeIsWon(p)) wonAmt += p.forecastAmount; else if (pipeIsOpen(p)) activeAmt += p.forecastAmount; });
  var biddingSoon = fullList.filter(function(p) { return p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 30 && pipeIsActive(p); });

  // ⚠️ ตรวจโครงการชนกัน — ใช้ pool + cache เดียวกับ Dashboard ของ Pipeline หลัก (allPipes ของตัวเอง + teamPipes)
  // กดตรวจเอง ไม่รันอัตโนมัติ (O(n²) หนักเมื่อข้อมูลเยอะ ดู pipeConflictLookup/runPipeConflictCheck ใน utils.js)
  var allPipesRaw = ST.getAll('pipeline');
  var teamPipesRaw = (typeof _teamPipelineData !== 'undefined' && Array.isArray(_teamPipelineData)) ? _teamPipelineData : [];
  var _dashPool = allPipesRaw.concat(teamPipesRaw);
  var _teamConflictLookup = pipeConflictLookup(_dashPool, 60);
  var conflicts = _teamConflictLookup.conflicts;
  _conflictMap = _teamConflictLookup.map;
  var conflictCheckBtn = '<button class="btn bsm bo" onclick="runPipeConflictCheck(ST.getAll(\'pipeline\').concat(typeof _teamPipelineData!==\'undefined\'&&Array.isArray(_teamPipelineData)?_teamPipelineData:[]),60)">' +
    (!_teamConflictLookup.checked ? '🔍 ตรวจโครงการชนกัน' : (_teamConflictLookup.stale ? '🔄 ตรวจใหม่ (ข้อมูลเปลี่ยนไปแล้ว)' : '🔄 ตรวจใหม่')) + '</button>';

  // Dashboard — collapsible เหมือนเมนู Pipeline หลัก
  var h = _pipeSectionHeader('📊 Dashboard', 'pipeTeamDash', pipeTeamDashOpen,
    !pipeTeamDashOpen ? (fullList.length + ' รายการ · ' + fmtMoneyShort(activeAmt) + ' active') : '');
  h += '<div id="pipeTeamDashWrap"' + (!pipeTeamDashOpen ? ' style="display:none"' : '') + '>';
  h += '<div class="sr">';
  h += '<div class="sc"><div class="sn c1">' + fullList.length + '</div><div class="sl">ทั้งหมด (ทีม)</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(activeAmt) + '</div><div class="sl">Active</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(wonAmt) + '</div><div class="sl">Won</div></div>';
  h += '<div class="sc"><div class="sn c3">' + biddingSoon.length + '</div><div class="sl">Bidding 30d</div></div>';
  h += '<div class="sc"><div class="sn c3">' + mineCount + '</div><div class="sl">ของฉัน</div></div>';
  h += '<div class="sc"><div class="sn c5">' + owners.length + '</div><div class="sl">จำนวนคน</div></div>';
  if (conflicts.length) h += '<div class="sc"><div class="sn c4">' + conflicts.length + '</div><div class="sl">⚠️ อาจชนกัน</div></div>';
  h += '</div>';
  h += '<div style="margin-bottom:6px">' + conflictCheckBtn + '</div>';
  h += buildConflictClusterHtml(conflicts);
  h += '</div>';

  h += '<div class="hint" style="margin:8px 0">👁 ดูอย่างเดียว — แก้ไขต้องไปที่ Pipeline ของตัวเอง แล้วจะ sync กลับมาที่นี่เอง (ข้อมูลของคนอื่นเป็นสรุปย่อ ไม่มี TOR/Board)</div>';

  // ปุ่มมุมมอง + รีเฟรช — แถบเดียวกับ toolbar บนสุดของ Pipeline หลัก
  h += '<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;align-items:center">';
  h += '<button class="btn bo bsm" onclick="_pipeTeamRefresh()">🔄 รีเฟรช</button>';
  h += '<div style="flex:1"></div>';
  h += '<button class="btn bsm ' + (pipeTeamView === 'table' ? 'bp' : 'bo') + '" onclick="pipeTeamView=\'table\';render()" title="ตาราง">📋</button>';
  h += '<button class="btn bsm ' + (pipeTeamView === 'card' ? 'bp' : 'bo') + '" onclick="pipeTeamView=\'card\';render()" title="การ์ด">🃏</button>';
  if (pipeTeamView === 'card') {
    h += '<div style="display:flex;gap:4px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
    h += '<button class="btn-xs" style="border-radius:0;' + (pipeTeamCardCols === 1 ? 'background:var(--accent);color:#fff' : '') + '" onclick="pipeTeamCardCols=1;render()" title="1 การ์ดต่อแถว">⚏1</button>';
    h += '<button class="btn-xs" style="border-radius:0;' + (pipeTeamCardCols === 2 ? 'background:var(--accent);color:#fff' : '') + '" onclick="pipeTeamCardCols=2;render()" title="2 การ์ดต่อแถว">⚏2</button>';
    h += '</div>';
  }
  h += '</div>';

  h += _pipeTeamUrgentBarHtml(fullList);

  // ตัวกรอง — collapsible เหมือนเมนู Pipeline หลัก
  h += _pipeSectionHeader('🔍 ตัวกรอง', 'pipeTeamFilter', pipeTeamFilterOpen,
    !pipeTeamFilterOpen ? [(Object.keys(pipeTeamStatusFlt).length ? '● ' + Object.keys(pipeTeamStatusFlt).length + ' สถานะ' : ''), (pipeTeamSearch ? '"' + sanitize(pipeTeamSearch) + '"' : '')].filter(Boolean).join(' ') : '');
  h += '<div id="pipeTeamFilterWrap"' + (!pipeTeamFilterOpen ? ' style="display:none"' : '') + '>';

  h += '<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap">';
  h += '<input type="text" id="pipeTeamSrc" value="' + sanitize(pipeTeamSearch) + '" placeholder="🔍 ค้นหา Row No. / Project / End User / Dealer / Model..." style="flex:1;min-width:150px" oninput="pipeTeamSearchInput(this.value)" autocomplete="off">';
  h += '<select onchange="pipeTeamSort=this.value;render()" style="min-width:130px">';
  h += '<option value="amount_desc"' + (pipeTeamSort === 'amount_desc' ? ' selected' : '') + '>มูลค่า มากสุด</option>';
  h += '<option value="amount_asc"' + (pipeTeamSort === 'amount_asc' ? ' selected' : '') + '>มูลค่า น้อยสุด</option>';
  h += '<option value="project"' + (pipeTeamSort === 'project' ? ' selected' : '') + '>ชื่อโครงการ</option>';
  h += '<option value="dealer"' + (pipeTeamSort === 'dealer' ? ' selected' : '') + '>ตาม Dealer</option>';
  h += '<option value="owner"' + (pipeTeamSort === 'owner' ? ' selected' : '') + '>ตามเจ้าของ</option>';
  h += '<option value="status"' + (pipeTeamSort === 'status' ? ' selected' : '') + '>ตาม Status</option>';
  h += '</select>';
  h += '<select onchange="pipeTeamOwnerFlt=this.value;render()" style="min-width:120px">';
  h += '<option value="all"' + (pipeTeamOwnerFlt === 'all' ? ' selected' : '') + '>👤 ทุกคน</option>';
  owners.forEach(function(o) { h += '<option value="' + sanitize(o) + '"' + (pipeTeamOwnerFlt === o ? ' selected' : '') + '>' + sanitize(o) + '</option>'; });
  h += '</select>';
  h += '<select onchange="pipeTeamFY=this.value;render()" style="min-width:120px">';
  h += '<option value="all"' + (pipeTeamFY === 'all' ? ' selected' : '') + '>🏛️ ทุกปีงบ</option>';
  (function() {
    var cur = currentThaiFY();
    for (var fy = cur + 2; fy >= cur - 2; fy--) h += '<option value="' + fy + '"' + (String(pipeTeamFY) === String(fy) ? ' selected' : '') + '>ปีงบ ' + fy + (fy === cur ? ' (ปีนี้)' : '') + '</option>';
  })();
  h += '</select>';
  h += '</div>';

  // แถบสถานะ — เลือกได้หลายช่อง (ไม่เลือกเลย = แสดงทุกสถานะ) กดที่ช่องเดิมซ้ำเพื่อยกเลิกเฉพาะช่องนั้น
  h += '<div class="hint" style="margin-bottom:4px">สถานะ (เลือกได้หลายช่อง — ไม่เลือกเลย = ทั้งหมด)</div>';
  h += '<div class="pipe-sum">';
  Object.entries(ps).filter(function(e) { return e[1].count > 0; }).forEach(function(e) {
    var k = e[0], v = e[1];
    h += '<div class="pipe-sum-card ' + (pipeTeamStatusFlt[k] ? 'act' : '') + '" onclick="togglePipeTeamStatus(\'' + k + '\')">' +
      '<div class="stage" style="color:' + (v.color || '#94a3b8') + '">' + v.name + '</div>' +
      '<div class="count">' + v.count + '</div>' +
      '<div class="amount">' + fmtMoneyShort(v.amount) + '</div></div>';
  });
  h += '<div class="pipe-sum-card ' + (Object.keys(pipeTeamStatusFlt).length === 0 ? 'act' : '') + '" onclick="clearPipeTeamStatusFlt()">' +
    '<div class="stage">📊 ทั้งหมด</div><div class="count">' + fullList.length + '</div><div class="amount">' + fmtMoneyShort(totalAmt) + '</div></div>';
  h += '</div>';
  h += pipeSelectedSubtotalHtml(pipeTeamStatusFlt, ps);

  // แถบเดือน — กรองจาก Bidding Date (เลือกได้หลายเดือน ไม่เลือกเลย = ทุกเดือน) เหมือนแพทเทิร์นที่ใช้ใน Forecast ตาม Model
  h += '<div class="hint" style="margin:8px 0 4px">📅 Bidding Date เดือนไหนบ้าง (ไม่เลือก = ทุกเดือน)</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px">';
  var _pipeTeamMonthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  _pipeTeamMonthNames.forEach(function(mn, idx) {
    var on = !!pipeTeamBidMonthFilter[idx];
    h += '<span onclick="togglePipeTeamBidMonth(' + idx + ')" style="cursor:pointer;font-size:.72rem;padding:4px 10px;border-radius:14px;' +
      (on ? 'background:var(--accent);color:#fff' : 'background:var(--bg2);border:1px solid var(--border);color:var(--text2)') + '">' + mn + '</span>';
  });
  if (Object.keys(pipeTeamBidMonthFilter).length) h += '<button class="btn bsm bo" onclick="clearPipeTeamBidMonthFilter()">✕ ล้าง</button>';
  h += '</div>';
  h += '</div>'; // end pipeTeamFilterWrap

  var pipeTeamCardGridClass = pipeTeamCardCols === 2 ? ' pcg-2col' : ' pcg-1col';
  el.innerHTML = h + (pipeTeamView === 'table' ? _renderPipeTeamTable(list) : _renderPipeTeamCards(list, pipeTeamCardGridClass)) +
    '<div style="font-size:.64rem;color:#64748b;margin-top:4px">' + list.length + ' รายการ' +
    (pipeTeamSearch ? ' (ค้นหา: "' + sanitize(pipeTeamSearch) + '")' : '') + '</div>';

  var srcEl = document.getElementById('pipeTeamSrc');
  if (srcEl && pipeTeamSearch) { srcEl.focus(); srcEl.setSelectionRange(pipeTeamSearch.length, pipeTeamSearch.length); }
}

function _renderPipeTeamTable(list) {
  if (!list.length) return '<div class="empty"><div class="icon">📊</div><p>ไม่พบ Pipeline</p></div>';
  var h = '<div class="pipe-wrap"><table class="pipe-table"><thead><tr>' +
    '<th>เจ้าของ</th><th>Project</th><th>End User</th><th>Dealer</th><th>Model</th>' +
    '<th style="text-align:right">Forecast</th><th>Status</th></tr></thead><tbody>';
  list.forEach(function(p) {
    var rowAttrs = p._mine ? (' onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"') : '';
    h += '<tr' + rowAttrs + '>' +
      '<td style="white-space:nowrap">' + (p._mine ? '⭐ ' : '👤 ') + sanitize(p.ownerName) + '</td>' +
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(p.projectName) + '">' + sanitize(p.projectName || '-') + '</td>' +
      '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(p.endUserTH) + '">' + sanitize(p.endUserTH || '-') + '</td>' +
      '<td style="white-space:nowrap">' + sanitize(p.dealerName || '-') + '</td>' +
      '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.7rem" title="' + sanitize(p.model) + '">' + sanitize(p.model || '-') + '</td>' +
      '<td style="text-align:right;white-space:nowrap">' + (_gvHidden('pipeline_forecast') ? '-' : fmtMoneyStyled(p.forecastAmount)) + '</td>' +
      '<td>' + pipeTag(p.status) + '</td>' +
      '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

var pipeTeamSearch = '';
var _pipeTeamSearchTimer = null;
function pipeTeamSearchInput(v) {
  pipeTeamSearch = v;
  clearTimeout(_pipeTeamSearchTimer);
  _pipeTeamSearchTimer = setTimeout(function() { render(); }, 350);
}

// การ์ด Pipeline รวมทีม — เลียนแบบหน้าตา/โครงสร้าง 4 แถวของ renderPipeCards (การ์ดเมนู Pipeline หลัก)
// แต่ไม่พึ่ง ST.getOne('dealers',...)/ST.pipeLogsByPipe(...) เพราะข้อมูลของคนอื่นเป็นสรุปที่ sync มาจาก
// teamPipeline เท่านั้น ไม่ใช่ record เต็มในเครื่องเรา — เลยแยกฟังก์ชันต่างหาก ไม่ไปแก้ renderPipeCards เดิม
function _renderPipeTeamCards(list, gridClass) {
  if (!list.length) return '<div class="empty"><div class="icon">📊</div><p>ไม่พบ Pipeline</p></div>';
  var html = '<div class="pipe-card-grid' + (gridClass || '') + '">';
  list.forEach(function(p) {
    var amt = p.forecastAmount;
    var cardOnclick = p._mine ? ('go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})') : '';
    html += '<div class="dealer-card"' + (cardOnclick ? ' onclick="' + cardOnclick + '"' : ' style="cursor:default"') + '>';
    html += '<div style="display:flex;align-items:baseline;gap:8px">';
    html += '<span style="font-size:.85rem;font-weight:600;flex:1;min-width:0;color:var(--text,#e2e8f0)">' + sanitize((p.projectName || '-').substr(0, 80)) + '</span>';
    if (p.endUserTH) html += '<span style="font-size:.72rem;font-weight:600;color:var(--text2,#94a3b8);flex-shrink:0;white-space:nowrap">' + sanitize(p.endUserTH.substr(0, 30)) + '</span>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:6px">';
    html += '<span class="meta" style="margin:0">🏪 ' + sanitize(p.dealerName || '-') + '</span>';
    if (p.model) html += '<span class="meta" style="margin:0;font-weight:600;text-align:right;white-space:nowrap">📦 ' + sanitize(p.model.substr(0, 45)) + '</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">' + pipeTag(p.status) + (amt >= 1500000 ? ' <span class="tag tag-high">💰 Big</span>' : '') + '</div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;margin-top:8px;border-top:1px solid var(--border,#334155)">';
    html += '<span style="font-size:.72rem;color:var(--text2,#94a3b8)">' + (p._mine ? '⭐ ' : '👤 ') + sanitize(p.ownerName) + '</span>';
    html += '<span style="font-size:.92rem;font-weight:700;color:#22c55e">' + fmtMoneyStyled(amt) + '</span>';
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

// ⏰ แถบ "ต้องรีบทำวันนี้" ของ Pipeline รวมทีม — เฉพาะ Bid ใกล้ครบ (bid7/bid30) เพราะข้อมูลของคนอื่นที่ sync
// มาไม่มี registerDate/log กิจกรรม เลยคำนวณ "ค้างนาน >90 วัน" (stale90) แบบเดียวกับ Pipeline หลักไม่ได้
function _pipeTeamUrgentCounts(list) {
  var bid7 = 0, bid30 = 0;
  list.forEach(function(p) {
    if (!pipeIsActive(p) || !p.biddingDate) return;
    var bd = dTo(p.biddingDate);
    if (bd >= 0 && bd <= 7) bid7++;
    else if (bd > 7 && bd <= 30) bid30++;
  });
  return { bid7: bid7, bid30: bid30 };
}

function _pipeTeamUrgentBarHtml(list) {
  var c = _pipeTeamUrgentCounts(list);
  if (!c.bid7 && !c.bid30) return '';
  function card(key, count, label, bg, color) {
    if (!count) return '';
    var act = pipeTeamUrgentFlt === key;
    return '<div onclick="_pipeTeamToggleUrgentFlt(\'' + key + '\')" style="cursor:pointer;flex:1;min-width:130px;background:' + bg + ';border:1px solid ' + (act ? color : 'transparent') + ';border-radius:8px;padding:8px 10px">' +
      '<div style="font-size:11px;color:' + color + '">' + label + '</div>' +
      '<div style="font-size:20px;font-weight:700;color:' + color + '">' + count + ' รายการ</div></div>';
  }
  return _pipeSectionHeader('⏰ ต้องรีบทำวันนี้ (ทีม)', 'pipeTeamUrgent', pipeTeamUrgentOpen,
    !pipeTeamUrgentOpen ? [c.bid7 && (c.bid7 + ' ด่วน')].filter(Boolean).join(' · ') : '') +
    '<div id="pipeTeamUrgentWrap"' + (!pipeTeamUrgentOpen ? ' style="display:none"' : '') + '>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
    card('bid7', c.bid7, 'Bid ภายใน 7 วัน', '#ef444418', '#ef4444') +
    card('bid30', c.bid30, 'Bid ใน 8-30 วัน', '#f59e0b18', '#f59e0b') +
    '</div></div>';
}

function _pipeTeamToggleUrgentFlt(key) {
  pipeTeamUrgentFlt = pipeTeamUrgentFlt === key ? '' : key;
  render();
}

function _pipeTeamRefresh() {
  if (typeof syncMainPipelineToShared === 'function') syncMainPipelineToShared();
  toast('🔄 กำลังรีเฟรช...');
  if (typeof loadSharedTeamPipeline === 'function') {
    db.collection('teamPipeline').get().then(function(snapshot) {
      var myUid = CURRENT_USER ? CURRENT_USER.uid : null;
      var items = [];
      snapshot.forEach(function(doc) {
        var d = doc.data();
        if (!d || d.ownerId === myUid) return;
        d._isTeam = true; d._ownerName = d.ownerName || ''; d._dealerName = d.dealerName || '';
        items.push(d);
      });
      _teamPipelineData = items;
      render();
      toast('✅ รีเฟรชแล้ว');
    }).catch(function(e) { toast('❌ รีเฟรชไม่สำเร็จ: ' + e.message); });
  }
}
var pipeSelected = {};
var _pipeVisibleIds = [];
var pipeGroup = 'none';
var pipeFilterOpen = localStorage.getItem('pipeFilterOpen') !== '0';
var pipeDashOpen = localStorage.getItem('pipeDashOpen') !== '0';
var pipeUrgentOpen = localStorage.getItem('pipeUrgentOpen') !== '0';
var pipeUrgentFlt = ''; // '', 'bid7', 'bid30', 'stale90' — คลิกการ์ดในแถบ "ต้องรีบทำ" เพื่อกรอง
var _pipeHiddenCols = (function() { try { return JSON.parse(localStorage.getItem('pipeHiddenCols') || '{}'); } catch(e) { return {}; } })();
var pipeBoardDealer = 'all';
var pipeBoardMode = 'active';
var pipeBoardCollapsed = {};
var pipeBoardFY = 'all';

// ✅ ตัวแปรสำหรับ Forecast Tab (Pending / Rejected)
var forecastTab = 'pending';
var selectedForecastUpdates = {};

var _conflictMap = {}; // pipeId → [{otherId, dealerName, score, key}]
var pipeCompareMode = false;
var pipeCompareSelected = [];
var pipeCompareThreshold = 40;
var _pipeCompareAllPairsCacheKey = null; // แคชผลลัพธ์คู่ Pipeline ทั้งระบบ ดู renderPipeCompareSuggestPanel
var _pipeCompareAllPairsCache = null;

// ✅ ไฮไลท์แถวที่ bidding ใกล้ถึง — เฉพาะ project ที่ยังไม่จบ (active status)
function PIPE_ACTIVE_STATUSES() { return getStatusIdsByCategory('active'); }
// ป้าย Row No. (เลขแถวจาก Google Sheet ตอน import) — เอาไว้ให้จับคู่กลับไฟล์ต้นทางได้ตรงๆ
// ต่างจากเลขลำดับ #1,#2... ในลิสต์ที่เปลี่ยนไปตามการเรียง/กรอง ไม่ใช่เลขเดิมจากไฟล์
function _pipeRowNoBadge(p) {
  if (!p.rowNo) return '';
  return '<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:var(--bg2,#334155);color:var(--text,#e2e8f0);border:1px solid var(--border,#475569);white-space:nowrap">No. ' + sanitize(String(p.rowNo)) + '</span>';
}

// ป้ายวันที่ Bidding ไล่สีตามความใกล้กำหนด — แดง (≤7 วัน/เลยกำหนด) / เหลือง (8-30 วัน) / เทาเรียบ (ไกลกว่านั้น)
function _pipeBidDateBadge(p, done) {
  if (!p.biddingDate) return '';
  var dateStr = fDShort(p.biddingDate);
  if (done) return '<span style="padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;background:var(--bg2,#334155);color:var(--text2,#94a3b8)">Bid ' + dateStr + '</span>';
  var d = dTo(p.biddingDate);
  var label, bg, fg;
  if (d < 0) { label = '🔴 Bid ' + dateStr + ' (เลย ' + Math.abs(d) + ' วัน)'; bg = '#7f1d1d'; fg = '#fca5a5'; }
  else if (d <= 7) { label = '🔴 Bid ' + dateStr + ' (อีก ' + d + ' วัน)'; bg = '#7f1d1d'; fg = '#fca5a5'; }
  else if (d <= 30) { label = '🟡 Bid ' + dateStr + ' (อีก ' + d + ' วัน)'; bg = '#78350f'; fg = '#fcd34d'; }
  else { label = 'Bid ' + dateStr; bg = 'var(--bg2,#334155)'; fg = 'var(--text2,#94a3b8)'; }
  return '<span style="padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;background:' + bg + ';color:' + fg + ';white-space:nowrap">' + label + '</span>';
}

function pipeBidUrgency(p) {
  if (!p || !p.biddingDate) return null;
  if (!pipeIsActive(p)) return null;
  var d = dTo(p.biddingDate);
  if (d < 0) return null;
  if (d <= 7) return 'urgent';
  if (d <= 30) return 'soon';
  return null;
}

// ✅ ปักหมุด Pipeline — เก็บเป็น field บน record เอง ไม่พึ่งระบบ pins กลาง
// เพื่อให้ sync ไป client-view ผ่าน path เดิม (syncAllPipelinesToFirebase) ได้ตรงๆ
function togglePipePin(pipeId) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  ST.update('pipeline', pipeId, { pinned: !p.pinned });
  toast(p.pinned ? '❌ เอาออกจากหมุดแล้ว' : '📌 ปักหมุดแล้ว');
  render();
}

// ================================================================
// PROJECT POS % — โอกาสได้งาน แก้ไขเร็วได้จากการ์ด/หน้ารายละเอียดเลย ไม่ต้องเปิดฟอร์มทั้งใบ
// สีไล่ตามช่วง (แดง <50 / ส้ม 50-75 / เขียว ≥75) ให้กวาดตาเห็นภาพรวมได้ไวตอนดูลิสต์
// ================================================================
function _pipePosColor(v) {
  v = v || 0;
  return v >= 75 ? '#22c55e' : (v >= 50 ? '#f59e0b' : '#ef4444');
}
function _pipePosBadgeHtml(p) {
  var v = p.projectPOS || 0;
  var c = _pipePosColor(v);
  return '<span class="pipe-pos-badge" style="font-size:10.5px;padding:2px 8px;border-radius:20px;font-weight:700;cursor:pointer;background:' + c + '18;color:' + c + '" onclick="event.stopPropagation();togglePipePosPicker(\'' + p.id + '\')" title="กดเพื่อแก้ไข">🎯 POS ' + v + '%</span>';
}
// ตัวเลือกเร็ว 25/50/75/100 (เกณฑ์ที่ตกลงกันไว้) + ช่องกำหนดเองเผื่อค่ากลางๆ — ซ่อนไว้ก่อน กดที่ badge ถึงโผล่
function _pipePosPickerHtml(p) {
  var cur = p.projectPOS || 0;
  var h = '<div class="pipe-pos-picker" id="pipePosPicker_' + p.id + '" style="display:none;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border,#334155)" onclick="event.stopPropagation()">';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';
  [25, 50, 75, 100].forEach(function(v) {
    h += '<button type="button" class="btn bsm ' + (cur === v ? 'bp' : 'bo') + '" onclick="setPipePos(\'' + p.id + '\',' + v + ')">' + v + '%</button>';
  });
  h += '<input type="number" min="0" max="100" placeholder="อื่นๆ" style="width:56px;font-size:11px" onkeydown="if(event.key===\'Enter\')setPipePos(\'' + p.id + '\',this.value)">';
  h += '</div></div>';
  return h;
}
function togglePipePosPicker(pipeId) {
  var el = document.getElementById('pipePosPicker_' + pipeId);
  if (!el) return;
  var willOpen = el.style.display === 'none';
  document.querySelectorAll('.pipe-pos-picker').forEach(function(e) { e.style.display = 'none'; });
  el.style.display = willOpen ? 'block' : 'none';
}
function setPipePos(pipeId, val) {
  val = Math.max(0, Math.min(100, parseInt(val) || 0));
  var oldP = ST.getOne('pipeline', pipeId);
  ST.update('pipeline', pipeId, { projectPOS: val, posHistory: appendPosHistory(oldP, val) });
  toast('🎯 อัปเดต POS เป็น ' + val + '% แล้ว');
  render();
}
document.addEventListener('click', function(e) {
  if (e.target.closest('.pipe-pos-badge') || e.target.closest('.pipe-pos-picker')) return;
  document.querySelectorAll('.pipe-pos-picker').forEach(function(el) { el.style.display = 'none'; });
});

// แก้ไข Forecast / Bidding Date / Status ตรงในตารางแบบไม่ต้องเปิดหน้ารายละเอียด (คลิกที่ cell — มี
// event.stopPropagation() ที่ตัว cell กันไม่ให้ไปกระตุ้น onclick ของทั้งแถวที่พาไปหน้า detail)
function _pipeInlineEdit(pipeId, field) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  var ids = { forecastAmount: 'pfc_', biddingDate: 'pbd_', status: 'pst_' };
  var cell = document.getElementById(ids[field] + pipeId);
  if (!cell || cell.querySelector('input,select')) return;
  var html = '';
  if (field === 'forecastAmount') {
    html = '<input type="text" inputmode="decimal" class="js-money" value="' + nmI(p.forecastAmount || 0) + '" style="width:100px;text-align:right;padding:2px" onclick="event.stopPropagation()" onchange="_pipeInlineSave(\'' + pipeId + '\',\'forecastAmount\',this.value)" onkeydown="if(event.key===\'Enter\')this.blur()">';
  } else if (field === 'biddingDate') {
    html = '<input type="date" value="' + (p.biddingDate || '') + '" style="padding:2px" onclick="event.stopPropagation()" onchange="_pipeInlineSave(\'' + pipeId + '\',\'biddingDate\',this.value)">';
  } else if (field === 'status') {
    var cfg = getConfig();
    var opts = (cfg.pipelineStatuses || []).map(function(s) { return '<option value="' + sanitize(s.id) + '"' + (s.id === p.status ? ' selected' : '') + '>' + sanitize(s.name) + '</option>'; }).join('');
    html = '<select onclick="event.stopPropagation()" onchange="_pipeInlineSave(\'' + pipeId + '\',\'status\',this.value)" style="padding:2px">' + opts + '</select>';
  }
  if (!html) return;
  cell.innerHTML = html;
  var input = cell.querySelector('input,select');
  if (input) { input.focus(); if (input.select) input.select(); }
}

function _pipeInlineSave(pipeId, field, value) {
  var updates = {};
  if (field === 'forecastAmount') updates.forecastAmount = parseNum(value);
  else if (field === 'biddingDate') updates.biddingDate = value;
  else if (field === 'status') updates.status = value;
  ST.update('pipeline', pipeId, updates);
  render();
}

// ================================================================
// PIPELINE LIST
// ================================================================
// ================================================================
// โซน "งานที่อาจชนกัน" + modal เทียบ (Phase 3)
// ================================================================
// สร้าง lookup map: pipeId → [{otherId, dealerName, score, key, ownerName, isTeam}]
function buildConflictMap(conflicts) {
  var map = {};
  // เดิมเรียก ST.getOne('dealers', id) ต่อคู่ (×2) — getOne อ่าน+parse localStorage ทั้งก้อนแล้วไล่หาทีละตัว
  // ทุกครั้ง ถ้ามีคู่ที่ชนกันเยอะ (หลักพัน) จะกลายเป็นคอขวดหนักกว่าตัวคำนวณคะแนนเองอีก — สร้าง index
  // ครั้งเดียวไว้ล่วงหน้าแทน
  var dealerNameById = {};
  ST.getAll('dealers').forEach(function(d) { dealerNameById[d.id] = d.name; });
  (conflicts || []).forEach(function(c) {
    var aIsTeam = !!c.a._isTeam;
    var bIsTeam = !!c.b._isTeam;
    var aDealer = aIsTeam ? (c.a._dealerName || '?') : (dealerNameById[c.a.dealerId] || '?');
    var bDealer = bIsTeam ? (c.b._dealerName || '?') : (dealerNameById[c.b.dealerId] || '?');
    if (!aIsTeam) {
      if (!map[c.a.id]) map[c.a.id] = [];
      map[c.a.id].push({ otherId: c.b.id, dealerName: bDealer, score: c.score, key: c.key, ownerName: c.b._ownerName || null, isTeam: bIsTeam });
    }
    if (!bIsTeam) {
      if (!map[c.b.id]) map[c.b.id] = [];
      map[c.b.id].push({ otherId: c.a.id, dealerName: aDealer, score: c.score, key: c.key, ownerName: c.a._ownerName || null, isTeam: aIsTeam });
    }
  });
  return map;
}

// จัดกลุ่ม conflict pairs ที่ซ้อนกันให้เป็น cluster เดียว (Union-Find)
function buildConflictClusters(conflicts) {
  var parent = {};
  function find(x) {
    if (!parent[x]) parent[x] = x;
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  (conflicts || []).forEach(function(c) {
    var px = find(c.a.id), py = find(c.b.id);
    if (px !== py) parent[px] = py;
  });
  var pipeMap = {};
  (conflicts || []).forEach(function(c) { pipeMap[c.a.id] = c.a; pipeMap[c.b.id] = c.b; });
  var groups = {};
  Object.keys(pipeMap).forEach(function(id) {
    var root = find(id);
    if (!groups[root]) groups[root] = [];
    if (groups[root].indexOf(id) === -1) groups[root].push(id);
  });
  var clusters = [];
  Object.keys(groups).forEach(function(root) {
    var ids = groups[root];
    var clPipes = ids.map(function(id) { return pipeMap[id]; });
    var maxScore = 0;
    var clConflicts = [];
    (conflicts || []).forEach(function(c) {
      if (ids.indexOf(c.a.id) !== -1 && ids.indexOf(c.b.id) !== -1) {
        clConflicts.push(c);
        if (c.score > maxScore) maxScore = c.score;
      }
    });
    clusters.push({ pipes: clPipes, maxScore: maxScore, conflicts: clConflicts });
  });
  clusters.sort(function(a, b) { return b.maxScore - a.maxScore; });
  return clusters;
}

// แสดง End User cluster view แทนแบบคู่ๆ เดิม
function buildConflictClusterHtml(conflicts) {
  if (!conflicts || !conflicts.length) return '';
  var clusters = buildConflictClusters(conflicts);
  // เดิมเรียก ST.getOne('dealers', id) ในลูปซ้อน (ทั้งต่อ pipe และต่อคู่ conflict ภายใน cluster) — ถ้ามี
  // cluster ใหญ่ (หลายร้อย pipe ชนกันเป็นกลุ่มเดียว) จะเรียกซ้ำเป็นหมื่นครั้งต่อการ render 1 รอบ สร้าง index ไว้ล่วงหน้า
  var dealerNameById = {};
  ST.getAll('dealers').forEach(function(d) { dealerNameById[d.id] = d.name; });
  var h = '<div class="card" style="border:1px solid #f59e0b;margin-bottom:10px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
  h += '<div style="font-weight:700;color:#f59e0b">⚠️ End User ที่มี Dealer หลายเจ้า (' + clusters.length + ' กลุ่ม)</div>';
  h += '<span style="font-size:11px;color:var(--text2)">' + conflicts.length + ' คู่ที่อาจชนกัน</span>';
  h += '</div>';
  clusters.slice(0, 10).forEach(function(cluster) {
    var scColor = cluster.maxScore >= 80 ? '#ef4444' : '#f59e0b';
    var label = '';
    cluster.pipes.forEach(function(p) { if (!label) label = p.endUserTH || p.endUserEN || p.projectName || ''; });
    h += '<div style="border:1px solid var(--border,#334155);border-radius:10px;padding:10px;margin-bottom:8px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">';
    h += '<div style="font-weight:600;font-size:13px">' + sanitize(label || '-') + '</div>';
    h += '<span style="background:' + scColor + '22;color:' + scColor + ';padding:2px 10px;border-radius:8px;font-size:11px;font-weight:700">ตรงกัน ' + cluster.maxScore + '%</span>';
    h += '</div>';
    cluster.pipes.forEach(function(p) {
      var dName = dealerNameById[p.dealerId];
      var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : [];
      var modelText = items.slice(0, 2).map(function(it) { return (it.model || '') + (it.qty > 1 ? '×' + it.qty : ''); }).filter(Boolean).join(', ') || p.model || '-';
      h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--bg2,rgba(0,0,0,.15));border-radius:6px;margin-bottom:4px;flex-wrap:wrap">';
      h += '<div style="width:8px;height:8px;border-radius:50%;background:' + scColor + ';flex-shrink:0"></div>';
      h += '<div style="font-size:12px;font-weight:600;min-width:80px">' + sanitize(dName || '?') + '</div>';
      h += '<div style="font-size:11px;color:var(--text2);flex:1;min-width:80px">' + sanitize(modelText.substr(0, 30)) + '</div>';
      h += pipeTag(p.status);
      h += '<div style="font-size:11px;color:var(--text2)">' + (p.biddingDate ? 'Bid: ' + fDShort(p.biddingDate) : '') + '</div>';
      if (!_gvHidden('pipeline_forecast')) h += '<div style="font-size:11px;font-weight:600">' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</div>';
      h += '</div>';
    });
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
    // จำกัดปุ่มที่โชว์ กัน cluster ใหญ่ผิดปกติ (คู่ชนกันเป็นร้อย) render ปุ่มเป็นพันจนหน้าเว็บอืด/ล้น
    cluster.conflicts.slice(0, 30).forEach(function(c) {
      var na2 = dealerNameById[c.a.dealerId], nb2 = dealerNameById[c.b.dealerId];
      var na = na2 ? na2.split(' ')[0] : '?', nb = nb2 ? nb2.split(' ')[0] : '?';
      h += '<button class="btn bsm bp" onclick="compareConflict(\'' + c.a.id + '\',\'' + c.b.id + '\')">🔍 ' + sanitize(na) + ' ↔ ' + sanitize(nb) + '</button>';
    });
    if (cluster.conflicts.length > 30) {
      h += '<span style="font-size:11px;color:var(--text2);align-self:center">+' + (cluster.conflicts.length - 30) + ' คู่</span>';
    }
    h += '<button class="btn bsm bo" onclick="dismissCluster([' + cluster.conflicts.map(function(c) { return '\'' + c.key + '\''; }).join(',') + '])">✓ ไม่ใช่งานเดียวกัน</button>';
    h += '</div></div>';
  });
  h += '</div>';
  return h;
}

// Dismiss ทุก pair ในกลุ่มพร้อมกัน
function dismissCluster(keys) {
  if (typeof dismissConflict === 'function') keys.forEach(function(k) { dismissConflict(k); });
  toast('✓ ทำเครื่องหมายแล้ว');
  render();
}

// Modal แสดงรายชื่อ Dealer ที่ชนกับ pipe นี้ (กรณีชนหลายเจ้า)
function showConflictListM(pipeId) {
  var cList = _conflictMap[pipeId];
  if (!cList || !cList.length) return;
  var p = ST.getOne('pipeline', pipeId);
  var html = '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">โปรเจค: <strong>' + sanitize(p ? p.projectName : '') + '</strong> อาจชนกับ:</div>';
  cList.forEach(function(c) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border,#334155);border-radius:8px;margin-bottom:6px;flex-wrap:wrap">';
    html += '<div style="flex:1;font-weight:600;font-size:13px">' + sanitize(c.dealerName) + (c.ownerName ? ' <span style="font-size:.65rem;color:#f97316;font-weight:400;background:#f9731618;padding:1px 6px;border-radius:4px">👤 ' + sanitize(c.ownerName) + '</span>' : '') + '</div>';
    html += '<span style="font-size:11px;background:#ef444422;color:#ef4444;padding:2px 8px;border-radius:6px;font-weight:700">' + c.score + '%</span>';
    if (!c.isTeam) html += '<button class="btn bsm bp" onclick="closeM();compareConflict(\'' + pipeId + '\',\'' + c.otherId + '\')">🔍 เทียบ</button>';
    html += '<button class="btn bsm bo" onclick="dismissConflict(\'' + c.key + '\');render();closeM()">✓ ไม่ชน</button>';
    html += '</div>';
  });
  openM('⚠️ งานที่อาจชนกัน', html);
}
function dismissConflictPair(key) {
  if (typeof dismissConflict === 'function') dismissConflict(key);
  toast('✓ ทำเครื่องหมายแล้ว');
  render();
}
function compareConflict(idA, idB) {
  var a = ST.getOne('pipeline', idA), b = ST.getOne('pipeline', idB);
  if (!a || !b) return;
  var da = ST.getOne('dealers', a.dealerId), db = ST.getOne('dealers', b.dealerId);
  function col(p, d) {
    var items = (getPipeItems(p) || []).map(function(it){ return sanitize(it.model) + ' x' + (it.qty || 1); }).join(', ');
    var upd = p.updated ? String(p.updated).slice(0, 10) : '';
    var x = '<div style="flex:1;min-width:200px;border:1px solid var(--border,#334155);border-radius:10px;padding:10px">';
    x += '<div style="font-weight:700">' + sanitize(d ? d.name : '?') + '</div>';
    x += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">' + getPipeName(p.status) + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>โครงการ:</strong> ' + sanitize(p.projectName || '-') + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>End User:</strong> ' + sanitize(p.endUserTH || p.endUserEN || '-') + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>หน่วยงาน:</strong> ' + sanitize((p.agencyMain || '-') + ' / ' + (p.agencySub || '-')) + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>สินค้า:</strong> ' + (items || '-') + '</div>';
    if (!_gvHidden('pipeline_forecast')) x += '<div style="font-size:12px;margin:2px 0"><strong>มูลค่า:</strong> ' + fmtMoney(p.forecastAmount) + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>Bidding:</strong> ' + (p.biddingDate ? fD(p.biddingDate) : '-') + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>อัปเดตล่าสุด:</strong> ' + (upd ? fD(upd) : '-') + '</div>';
    x += '<div style="margin-top:8px"><button class="btn bsm bo" onclick="closeM();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">เปิดโปรเจค</button></div>';
    x += '</div>';
    return x;
  }
  var html = '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">ความเหมือน ' + pipeMatchScore(a, b) + '% — ดูว่าควรให้ dealer เจ้าไหนทำงานนี้</div>';
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap">' + col(a, da) + col(b, db) + '</div>';
  openM('🔍 เทียบงานที่อาจชนกัน', html);
}

// ================================================================
// ตั้งน้ำหนัก % ของแต่ละปัจจัยใน pipeMatchScore() เอง (ค่า default อยู่ที่ DEF_CONFIG.pipeMatchWeights
// ใน app.js) — บันทึกลง cfg แล้วมีผลทันทีทั้งแถบ "งานที่อาจชนกัน" และ modal เทียบ Project
var PIPE_MATCH_WEIGHT_FIELDS = [
  { key: 'eu', label: '👤 End User' },
  { key: 'name', label: '📋 ชื่อโครงการ' },
  { key: 'model', label: '📦 สินค้าตรงกัน' },
  { key: 'agencyMain', label: '🏛️ หน่วยงานใหญ่' },
  { key: 'agencySub', label: '🏢 หน่วยงานย่อย' },
  { key: 'bidding', label: '📅 วันประมูลใกล้กัน' }
];

function showPipeMatchWeightsM() {
  var w = getConfig().pipeMatchWeights;
  var total = 0;
  var html = '<div style="max-width:420px">';
  html += '<div class="hint" style="margin-bottom:10px">กำหนดน้ำหนัก % ของแต่ละปัจจัยที่ใช้เทียบว่า 2 โปรเจคน่าจะเป็นงานเดียวกันไหม (ต้องรวมกันได้ 100%)</div>';
  PIPE_MATCH_WEIGHT_FIELDS.forEach(function(f) {
    var v = Number(w[f.key]) || 0;
    total += v;
    html += '<div class="fg" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">' +
      '<label style="flex:1">' + f.label + '</label>' +
      '<input type="number" id="pmw_' + f.key + '" value="' + v + '" min="0" max="100" style="width:70px;text-align:right" oninput="updatePmwTotal()"> %' +
      '</div>';
  });
  html += '<div style="display:flex;justify-content:space-between;font-weight:700;margin:10px 0;padding-top:8px;border-top:1px solid var(--border)">' +
    '<span>รวม</span><span id="pmwTotal" style="color:' + (total === 100 ? '' : '#ef4444') + '">' + total + '%</span></div>';
  html += '<div style="display:flex;gap:6px">' +
    '<button class="btn bp" style="flex:1" onclick="savePipeMatchWeights()">💾 บันทึก</button>' +
    '<button class="btn bo" onclick="resetPipeMatchWeights()">↩️ ค่าเริ่มต้น</button>' +
    '</div>';
  html += '</div>';
  openM('⚙️ ตั้งน้ำหนักการเทียบ Project', html);
}

function updatePmwTotal() {
  var total = 0;
  PIPE_MATCH_WEIGHT_FIELDS.forEach(function(f) { total += Number(document.getElementById('pmw_' + f.key).value) || 0; });
  var el = document.getElementById('pmwTotal');
  el.textContent = total + '%';
  el.style.color = total === 100 ? '' : '#ef4444';
}

function savePipeMatchWeights() {
  var w = {};
  var total = 0;
  PIPE_MATCH_WEIGHT_FIELDS.forEach(function(f) {
    var v = Number(document.getElementById('pmw_' + f.key).value) || 0;
    w[f.key] = v;
    total += v;
  });
  if (total !== 100) { alert('รวมต้องได้ 100% (ตอนนี้ ' + total + '%)'); return; }
  var cfg = getConfig();
  cfg.pipeMatchWeights = w;
  saveConfig(cfg);
  closeMForce();
  toast('💾 บันทึกน้ำหนักแล้ว');
  render();
}

function resetPipeMatchWeights() {
  var cfg = getConfig();
  cfg.pipeMatchWeights = { eu: 35, name: 25, model: 15, agencyMain: 10, agencySub: 10, bidding: 5 };
  saveConfig(cfg);
  toast('↩️ กลับเป็นค่าเริ่มต้นแล้ว');
  showPipeMatchWeightsM();
}

// ================================================================
// เทียบ Project แบบเลือกเอง (สูงสุด 3 รายการ) — ไม่พึ่ง auto-detect อย่างเดียว
// ================================================================
function pipeCompareSetThreshold(val) {
  pipeCompareThreshold = Math.max(20, Math.min(80, val));
  render();
}
function pipeCompareStepThreshold(delta) {
  pipeCompareSetThreshold(pipeCompareThreshold + delta);
}

function togglePipeCompareMode() {
  pipeCompareMode = !pipeCompareMode;
  if (!pipeCompareMode) pipeCompareSelected = [];
  render();
}

function togglePipeCompareSelect(pipeId) {
  var idx = pipeCompareSelected.indexOf(pipeId);
  if (idx !== -1) { pipeCompareSelected.splice(idx, 1); }
  else {
    if (pipeCompareSelected.length >= 3) { toast('⚠️ เลือกได้สูงสุด 3 โปรเจค'); return; }
    pipeCompareSelected.push(pipeId);
  }
  render();
}

function pipeCompareQuickPick(idA, idB) {
  pipeCompareSelected = [idA, idB];
  render();
}

// หาคู่ที่คล้ายที่สุด (เจ้าอื่น, ยัง active) ให้แต่ละแถวเป็น guide ตอนเลือก — ถูกเรียกต่อแถวในตาราง
// sheet ตอนอยู่ในโหมดเทียบ (O(n) ต่อครั้ง วนทุกแถว = O(n²) รวม)
// activePool: ส่งลิสต์ Pipeline ที่ยัง active (กรอง pipeIsOpen ไว้แล้ว) เข้ามาได้ — ถ้าไม่ส่งจะไปดึง+กรองเอง
// (ค่า default นี้เผื่อโค้ดที่อื่นเรียกแบบเดิม) แต่ตอนเรียกต่อแถวควรส่งมาเสมอ เพราะ pipeIsOpen() เรียก
// getConfig() ข้างในทุกครั้ง (deep-clone config ทั้งก้อน) กรองใหม่ทุกแถว 300 แถว = getConfig() เกือบแสน
// ครั้งจนหน้าค้าง — ต้องกรองแค่ครั้งเดียวข้างนอกลูปแล้วส่ง pool เดิมมาใช้ซ้ำทุกแถว
// weights: ส่งเข้ามาได้เพื่อเลี่ยงเรียก getConfig() ซ้ำต่อคู่เช่นกัน — ดูคอมเมนต์ pipeMatchScore() ใน utils.js
function pipeCompareBestMatch(p, weights, activePool) {
  var pool = activePool || ST.getAll('pipeline').filter(function(x) { return pipeIsOpen(x); });
  var best = null;
  pool.forEach(function(x) {
    if (x.id === p.id || x.dealerId === p.dealerId) return;
    var sc = pipeMatchScore(p, x, weights);
    if (!best || sc > best.score) best = { score: sc, other: x };
  });
  return best;
}

// แผงแนะนำคู่/โครงการที่น่าจะชนกัน — ก่อนเลือกโชว์ Top คู่ทั้งระบบ, หลังเลือกแล้วโชว์โครงการที่เข้ากับที่เลือกไว้
function renderPipeCompareSuggestPanel() {
  var active = ST.getAll('pipeline').filter(function(p) { return pipeIsOpen(p); });
  // เรียก getConfig() ครั้งเดียวก่อนเข้าลูปเทียบคู่ — เดิม pipeMatchScore() เรียก getConfig() (deep-clone
  // config ทั้งก้อน) เองทุกคู่ พบว่าเป็นคอขวดหลักที่ทำให้ "เทียบ Project" ค้างตอนมี Pipeline เยอะ
  var _cmpWeights = (typeof getConfig === 'function' && getConfig().pipeMatchWeights) || null;
  var sliderHtml = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:.72rem;color:var(--text2);flex-wrap:wrap">' +
    '<span>เกณฑ์คะแนนขั้นต่ำ</span>' +
    '<button class="btn bsm bo" style="padding:1px 8px" onclick="pipeCompareStepThreshold(-10)">−</button>' +
    '<input type="range" min="20" max="80" step="10" value="' + pipeCompareThreshold + '" list="pipeCompareTicks" style="width:100px" oninput="pipeCompareSetThreshold(parseInt(this.value))">' +
    '<datalist id="pipeCompareTicks"><option value="20"></option><option value="30"></option><option value="40"></option><option value="50"></option><option value="60"></option><option value="70"></option><option value="80"></option></datalist>' +
    '<button class="btn bsm bo" style="padding:1px 8px" onclick="pipeCompareStepThreshold(10)">+</button>' +
    '<strong style="color:var(--text);min-width:32px">' + pipeCompareThreshold + '%</strong>' +
    [20, 40, 60, 80].map(function(v) {
      return '<button class="btn bsm ' + (pipeCompareThreshold === v ? 'bp' : 'bo') + '" onclick="pipeCompareSetThreshold(' + v + ')">' + v + '%</button>';
    }).join('') +
    '</div>';

  var html = '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:10px 12px;margin-bottom:8px">';

  if (pipeCompareSelected.length === 0) {
    html += '<div style="font-size:.78rem;font-weight:700;margin-bottom:6px">🔥 คู่ที่น่าจะชนกันที่สุด (ทั้งระบบ)</div>' + sliderHtml;
    // เช็คทุกคู่เป็น O(n²) — แคชผลลัพธ์ไว้ด้วย key จาก id+เวลาแก้ไขล่าสุดของทุก pipeline + threshold
    // ที่ใช้ กัน render() ซ้ำๆ (เช่นลากแถบ threshold, สลับหน้า) คำนวณ O(n²) ใหม่ทั้งหมดทุกครั้งโดยไม่จำเป็น
    // ถ้าไม่มีอะไรเปลี่ยนจริง (ข้อมูล pipeline เดิม, threshold เดิม) key จะตรงกัน ใช้ผลลัพธ์เดิมได้เลย
    var cacheKey = active.map(function(p) { return p.id + '@' + (p.updated || p.created || ''); }).join('|') + '::' + pipeCompareThreshold;
    var pairs;
    if (_pipeCompareAllPairsCacheKey === cacheKey) {
      pairs = _pipeCompareAllPairsCache;
    } else {
      pairs = [];
      for (var i = 0; i < active.length; i++) {
        for (var j = i + 1; j < active.length; j++) {
          if (active[i].dealerId === active[j].dealerId) continue;
          var sc = pipeMatchScore(active[i], active[j], _cmpWeights);
          if (sc >= pipeCompareThreshold) pairs.push({ a: active[i], b: active[j], score: sc });
        }
      }
      pairs.sort(function(x, y) { return y.score - x.score; });
      pairs = pairs.slice(0, 8);
      _pipeCompareAllPairsCacheKey = cacheKey;
      _pipeCompareAllPairsCache = pairs;
    }
    if (!pairs.length) {
      html += '<div style="font-size:.72rem;color:var(--text2)">ไม่พบคู่ที่คะแนน ≥ ' + pipeCompareThreshold + '% — ลองลดเกณฑ์ดู</div>';
    } else {
      pairs.forEach(function(pr) {
        var da = ST.getOne('dealers', pr.a.dealerId), db = ST.getOne('dealers', pr.b.dealerId);
        var color = pr.score >= 60 ? '#ef4444' : '#f59e0b';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border,#334155);font-size:.72rem">' +
          '<span style="background:' + color + '22;color:' + color + ';font-weight:700;padding:2px 6px;border-radius:6px;white-space:nowrap">' + pr.score + '%</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize((pr.a.projectName || '-').substr(0, 22)) + ' (' + sanitize(da ? da.name : '?') + ') ↔ ' + sanitize((pr.b.projectName || '-').substr(0, 22)) + ' (' + sanitize(db ? db.name : '?') + ')</span>' +
          '<button class="btn bsm bp" onclick="pipeCompareQuickPick(\'' + pr.a.id + '\',\'' + pr.b.id + '\')">เลือกคู่นี้</button>' +
          '</div>';
      });
    }
  } else {
    html += '<div style="font-size:.78rem;font-weight:700;margin-bottom:6px">💡 แนะนำโครงการที่น่าจะเข้ากับที่เลือกไว้</div>' + sliderHtml;
    var selectedPipes = pipeCompareSelected.map(function(id) { return ST.getOne('pipeline', id); }).filter(Boolean);
    var candidates = [];
    active.forEach(function(p) {
      if (pipeCompareSelected.indexOf(p.id) !== -1) return;
      var best = null;
      selectedPipes.forEach(function(sp) {
        if (sp.dealerId === p.dealerId) return;
        var sc = pipeMatchScore(sp, p, _cmpWeights);
        if (!best || sc > best.score) best = { score: sc, vs: sp };
      });
      if (best && best.score >= pipeCompareThreshold) candidates.push({ p: p, score: best.score, vs: best.vs });
    });
    candidates.sort(function(x, y) { return y.score - x.score; });
    candidates = candidates.slice(0, 8);
    if (pipeCompareSelected.length >= 3) {
      html += '<div style="font-size:.72rem;color:var(--text2)">เลือกครบ 3 โปรเจคแล้ว — กด "เทียบเลย" ด้านล่างได้เลย</div>';
    } else if (!candidates.length) {
      html += '<div style="font-size:.72rem;color:var(--text2)">ไม่พบโครงการที่คะแนน ≥ ' + pipeCompareThreshold + '% กับที่เลือกไว้ — ลองลดเกณฑ์ดู</div>';
    } else {
      candidates.forEach(function(c) {
        var dc = ST.getOne('dealers', c.p.dealerId);
        var color = c.score >= 60 ? '#ef4444' : '#f59e0b';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border,#334155);font-size:.72rem">' +
          '<span style="background:' + color + '22;color:' + color + ';font-weight:700;padding:2px 6px;border-radius:6px;white-space:nowrap">' + c.score + '%</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize((c.p.projectName || '-').substr(0, 26)) + ' (' + sanitize(dc ? dc.name : '?') + ')</span>' +
          '<button class="btn bsm bp" onclick="togglePipeCompareSelect(\'' + c.p.id + '\')">+ เพิ่มเข้าเทียบ</button>' +
          '</div>';
      });
    }
  }

  html += '</div>';
  return html;
}

function renderPipeCompareBar() {
  var n = pipeCompareSelected.length;
  return '<div style="position:sticky;bottom:0;display:flex;justify-content:space-between;align-items:center;background:var(--card);border:1px solid var(--accent);border-radius:10px;padding:10px 14px;margin-top:10px">' +
    '<span style="font-size:.78rem">เลือกแล้ว <strong>' + n + '/3</strong> โปรเจค</span>' +
    '<button class="btn bsm bp" ' + (n < 2 ? 'disabled' : '') + ' onclick="openPipeCompareModal()">🔍 เทียบเลย</button>' +
    '</div>';
}

// คำนวณสถิติความเคลื่อนไหว (จำนวน log, ความถี่เฉลี่ย, ล่าสุดกี่วันที่แล้ว)
function pipeActivityStats(pipeId) {
  var logs = ST.pipeLogsByPipe(pipeId); // เรียงใหม่สุดก่อนแล้ว
  if (!logs.length) return { count: 0, recency: 9999, avgGap: null, logs: logs };
  var lastDate = logs[0].date ? logs[0].date.split('T')[0] : null;
  var recency = lastDate ? Math.max(0, Math.round((new Date() - new Date(lastDate)) / 864e5)) : 9999;
  var avgGap = null;
  if (logs.length >= 2) {
    var oldest = logs[logs.length - 1].date ? logs[logs.length - 1].date.split('T')[0] : null;
    if (oldest && lastDate) {
      var span = Math.max(1, Math.round((new Date(lastDate) - new Date(oldest)) / 864e5));
      avgGap = Math.round(span / (logs.length - 1));
    }
  }
  return { count: logs.length, recency: recency, avgGap: avgGap, logs: logs };
}

function openPipeCompareModal() {
  var ids = pipeCompareSelected.slice();
  if (ids.length < 2) { toast('⚠️ เลือกอย่างน้อย 2 โปรเจค'); return; }
  var pipes = ids.map(function(id) { return ST.getOne('pipeline', id); }).filter(Boolean);
  if (pipes.length < 2) return;

  // คะแนนความเหมือนทุกคู่
  var pairBadges = '';
  var colHasMatch = pipes.map(function() { return false; });
  for (var i = 0; i < pipes.length; i++) {
    for (var j = i + 1; j < pipes.length; j++) {
      var sc = pipeMatchScore(pipes[i], pipes[j]);
      if (sc >= 60) { colHasMatch[i] = true; colHasMatch[j] = true; }
      var color = sc >= 60 ? '#ef4444' : (sc >= 40 ? '#f59e0b' : '#64748b');
      var bg = sc >= 60 ? 'rgba(239,68,68,.18)' : (sc >= 40 ? 'rgba(245,158,11,.18)' : 'rgba(100,116,139,.2)');
      pairBadges += '<span style="background:' + bg + ';color:' + color + ';font-size:11px;padding:4px 10px;border-radius:8px;font-weight:600;margin-right:6px;display:inline-block;margin-bottom:6px">' +
        String.fromCharCode(65 + i) + '↔' + String.fromCharCode(65 + j) + ' เหมือน ' + sc + '%</span>';
    }
  }

  function fieldMatchFlags(getter) {
    var vals = pipes.map(getter);
    var flags = vals.map(function() { return false; });
    for (var a = 0; a < vals.length; a++) {
      for (var b = a + 1; b < vals.length; b++) {
        if (fcStrSim(vals[a], vals[b]) >= 0.55) { flags[a] = true; flags[b] = true; }
      }
    }
    return flags;
  }
  var nameFlags = fieldMatchFlags(function(p) { return p.projectName || ''; });
  var euFlags = fieldMatchFlags(function(p) { return p.endUserTH || p.endUserEN || ''; });
  var bidFlags = pipes.map(function() { return false; });
  for (var a2 = 0; a2 < pipes.length; a2++) {
    for (var b2 = a2 + 1; b2 < pipes.length; b2++) {
      var da = fcParseDate(pipes[a2].biddingDate), db2 = fcParseDate(pipes[b2].biddingDate);
      if (da && db2 && Math.abs(da - db2) / 86400000 <= 30) { bidFlags[a2] = true; bidFlags[b2] = true; }
    }
  }

  // หาเจ้าที่อัพเดทถี่ที่สุด (recency น้อยสุด) ใช้เป็นฐานเทียบ "นิ่งนานกว่ามาก"
  var actStats = pipes.map(function(p) { return pipeActivityStats(p.id); });
  var minRecency = Math.min.apply(null, actStats.map(function(s) { return s.recency; }));
  var mostActiveIdx = actStats.findIndex(function(s) { return s.recency === minRecency; });

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">';
  html += '<div>' + pairBadges + '</div>';
  html += '<button class="btn bsm bo" onclick="togglePipeSummaryFullValue()">' + (pipeSummaryFullValue ? '🔍 แสดงแบบย่อ' : '🔍 แสดงมูลค่าเต็ม') + '</button>';
  html += '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(' + pipes.length + ',1fr);gap:16px">';
  pipes.forEach(function(p, idx) {
    var d = ST.getOne('dealers', p.dealerId);
    var border = colHasMatch[idx] ? 'border:2px solid #ef4444' : 'border:1px solid var(--border,#334155)';
    var stat = actStats[idx];

    html += '<div style="background:var(--card,#1e293b);border-radius:12px;padding:16px;' + border + '">';
    html += '<div style="font-weight:700;font-size:14px">' + sanitize(d ? d.name : '?') + '</div>';
    html += '<div style="font-size:11px;color:var(--text2);margin-bottom:12px">' + String.fromCharCode(65 + idx) + ' · ' + getPipeName(p.status) + '</div>';

    function row(label, val, hl) {
      return '<div style="font-size:11px;color:var(--text2);margin-bottom:2px">' + label + '</div>' +
        '<div style="font-size:12px;' + (hl ? 'background:rgba(239,68,68,.15);border-radius:6px;padding:4px 6px;' : '') + 'margin-bottom:8px">' + (val || '-') + '</div>';
    }
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    html += row('โครงการ', sanitize(p.projectName || '-'), nameFlags[idx]);
    html += row('End User', sanitize(p.endUserTH || p.endUserEN || '-'), euFlags[idx]);
    html += row('หน่วยงาน', sanitize((p.agencyMain || '-') + ' / ' + (p.agencySub || '-')), false);
    html += row('มูลค่า', fmtMoney(p.forecastAmount), false);
    html += row('Bidding', p.biddingDate ? fD(p.biddingDate) : '-', bidFlags[idx]);
    html += '</div>';
    html += _pipeCompareProductBreakdownHtml(p);

    // สรุปความเคลื่อนไหว
    if (stat.count > 0) {
      html += '<div style="background:var(--bg,#0f172a);border-radius:8px;padding:8px;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">' +
        '<span style="color:var(--text2)">📅 ความเคลื่อนไหว</span>' +
        '<span style="font-weight:700;color:' + (stat.recency <= 14 ? '#22c55e' : '#f59e0b') + '">' + (stat.avgGap ? ('ทุก ~' + stat.avgGap + ' วัน') : '-') + '</span></div>' +
        '<div style="font-size:10px;color:var(--text2)">อัพเดท ' + stat.count + ' ครั้ง · ล่าสุด ' + (stat.recency === 0 ? 'วันนี้' : stat.recency + ' วันที่แล้ว') + '</div></div>';
    } else {
      html += '<div style="background:var(--bg,#0f172a);border-radius:8px;padding:8px;margin-bottom:8px;font-size:11px;color:var(--text2)">📅 ยังไม่มีบันทึกความเคลื่อนไหว</div>';
    }

    // เตือนถ้านิ่งนานกว่าเจ้าที่ active สุด ≥2 เท่า (และต่างกัน ≥14 วัน กันสัญญาณรบกวนตัวเลขเล็ก)
    if (idx !== mostActiveIdx && stat.recency >= minRecency * 2 && (stat.recency - minRecency) >= 14) {
      var ownerDealer = ST.getOne('dealers', pipes[mostActiveIdx].dealerId);
      html += '<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:6px 8px;margin-bottom:8px;font-size:10px;color:#f87171">⚠️ นิ่งนานกว่า ' + sanitize(ownerDealer ? ownerDealer.name : '-') + ' มาก — น่าจะไม่ใช่เจ้าของงานจริง</div>';
    }

    var logId = 'pcmpLog_' + p.id;
    html += '<div style="font-size:11px;color:var(--accent,#3b82f6);cursor:pointer;margin-bottom:6px" onclick="var e=document.getElementById(\'' + logId + '\');e.style.display=e.style.display===\'none\'?\'block\':\'none\'">▾ ดู Timeline ทั้งหมด (' + stat.count + ')</div>';
    html += '<div id="' + logId + '" style="display:none;border-left:2px solid var(--border,#334155);padding-left:10px;margin-left:4px;margin-bottom:8px">';
    stat.logs.forEach(function(l, li) {
      var ld = l.date ? l.date.split('T')[0] : '';
      var ldays = ld ? Math.max(0, Math.round((new Date() - new Date(ld)) / 864e5)) : null;
      html += '<div style="margin-bottom:8px;position:relative"><div style="position:absolute;left:-15px;top:3px;width:7px;height:7px;border-radius:50%;background:' + (li === 0 ? '#22c55e' : 'var(--text2)') + '"></div>' +
        '<div style="font-size:10px;color:var(--text2)">' + (ldays === 0 ? 'วันนี้' : (ldays !== null ? ldays + ' วันที่แล้ว' : '')) + '</div>' +
        '<div style="font-size:11px">' + sanitize((l.content || '').substr(0, 80)) + '</div></div>';
    });
    html += '</div>';

    html += '<button class="btn bsm bo" style="width:100%" onclick="closeM();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">เปิดโปรเจคนี้ →</button>';
    html += '</div>';
  });
  html += '</div>';

  openM('🔍 เทียบ Project (' + pipes.length + ')', html);
  setMWide(pipes.length >= 3 ? 1300 : 1000); // ขยาย modal กว้างขึ้นสำหรับ desktop กันตารางสินค้า/ฟิลด์ต่างๆ บีบแคบเกินไป
}

// สรุปรายการสินค้าแบบย่อ (ชิปหมวดหมู่ + ตาราง Model/QTY/มูลค่า) สำหรับใช้ในคอลัมน์ modal เทียบ Project —
// เวอร์ชันกระชับกว่า pipeModelSummaryCardHtml() (ไม่มี card wrapper/หัวข้อ) เพราะอยู่ในคอลัมน์แคบอยู่แล้ว
// ใช้ pipeSummaryFullValue ตัวเดียวกับหน้ารายละเอียดโครงการ ควบคุมจากปุ่มเดียวที่หัว modal
function _pipeCompareProductBreakdownHtml(p) {
  var items = getPipeItems(p);
  if (!items.length) return '';

  var catTotals = {};
  var byModel = {};
  items.forEach(function(it) {
    var model = it.model || 'ไม่ระบุ';
    var qty = Number(it.qty) || 1;
    var amt = Number(it.total) || (qty * (Number(it.price) || 0));
    var cat = getModelCategory(model);
    catTotals[cat] = (catTotals[cat] || 0) + qty;
    if (!byModel[model]) byModel[model] = { model: model, qty: 0, amount: 0, batches: [] };
    byModel[model].qty += qty;
    byModel[model].amount += amt;
    if (it.shipBatches && it.shipBatches.length) byModel[model].batches = byModel[model].batches.concat(it.shipBatches);
  });

  var catOrder = (typeof PRODUCT_CATEGORIES !== 'undefined') ? PRODUCT_CATEGORIES.map(function(c) { return c.id; }) : Object.keys(catTotals);
  var catIds = Object.keys(catTotals).sort(function(a, b) { return catOrder.indexOf(a) - catOrder.indexOf(b); });
  var catChipsHtml = catIds.map(function(cid) {
    var name = (typeof getCategoryName === 'function') ? getCategoryName(cid) : cid;
    return '<span style="background:var(--bg2);border-radius:8px;padding:4px 10px;font-size:11px;margin-right:6px;display:inline-block;margin-bottom:6px"><span style="color:var(--text2)">' + sanitize(name) + '</span> <b>' + catTotals[cid] + '</b></span>';
  }).join('');

  var fmtAmt = pipeSummaryFullValue ? function(v) { return fmtMoney(v) + ' ฿'; } : fmtMoneyShort;
  var modelList = Object.values(byModel);

  var h = '<div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:6px">📦 สรุปรายการสินค้า</div>';
  h += '<div style="margin-bottom:8px">' + catChipsHtml + '</div>';
  h += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px">';
  h += '<tr style="color:var(--text2)"><td style="padding:3px 0">Model</td><td style="text-align:center">QTY</td><td style="text-align:right">มูลค่า</td></tr>';
  var _batchMonthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  modelList.forEach(function(m) {
    h += '<tr style="border-top:1px solid var(--border,#334155)"><td style="padding:3px 0">' + sanitize(m.model) + '</td><td style="text-align:center">' + m.qty + '</td><td style="text-align:right">' + fmtAmt(m.amount) + '</td></tr>';
    if (m.batches && m.batches.length) {
      var batchLabel = m.batches.map(function(b) {
        var parts = (b.month || '').split('-');
        var mLabel = (parts.length === 2) ? (_batchMonthNames[parseInt(parts[1], 10) - 1] + ' ' + (parseInt(parts[0], 10) + 543 - 2500)) : '?';
        return mLabel + ' x' + (Number(b.qty) || 0);
      }).join(', ');
      h += '<tr><td colspan="3" style="padding:0 0 4px 0;font-size:10px;color:var(--text2)">🚚 แบ่งส่ง: ' + sanitize(batchLabel) + '</td></tr>';
    }
  });
  h += '</table>';
  return h;
}

function rPipeline(el) {
  document.getElementById('pgT').textContent = '📊 Pipeline';
  var cfg = getConfig();
  var allPipes = ST.getAll('pipeline');
  // index งานค้างต่อ pipe ครั้งเดียวตรงนี้ — เดิม taskCnt/pipeTaskFlt เรียก pipeOpenTasks(p.id) ต่อ pipe
  // (แปลง JSON ทั้ง collection ทาสก์ใหม่ทุกครั้ง ไม่มีแคช) วนทุกโปรเจกต์ = O(n²) ตอนข้อมูลเยอะ
  var _pipeOpenTaskIdx = {};
  ST.getAll('tasks').forEach(function(t) { if (t.status !== 'completed' && t.pipeId) _pipeOpenTaskIdx[t.pipeId] = true; });

  var pipes = allPipes;
  if (Object.keys(pipeFlt).length) pipes = pipes.filter(function(p) { return pipeFlt[p.status]; });
  if (Object.keys(pipeBidMonthFilter).length) {
    pipes = pipes.filter(function(p) {
      var bd = fcParseDate(p.biddingDate);
      return bd && pipeBidMonthFilter[bd.getMonth()];
    });
  }
  if (pipeFY !== 'all') pipes = pipes.filter(function(p) {
    var fy = p.budgetFiscalYear || thaiFYFromISO(p.expectedCloseDate || p.biddingDate);
    return String(fy || '') === String(pipeFY);
  });
  if (pipeSale !== 'all') pipes = pipes.filter(function(p) { return (p.saleName || '') === pipeSale; });
  if (pipeDisplayFlt === 'show') pipes = pipes.filter(function(p) { return (p.sheetDisplay || 'Show') !== 'Hide'; });
  else if (pipeDisplayFlt === 'hide') pipes = pipes.filter(function(p) { return (p.sheetDisplay || 'Show') === 'Hide'; });
  if (pipeTaskFlt) pipes = pipes.filter(function(p) { return _pipeOpenTaskIdx[p.id]; });

  if (pipeUrgentFlt) {
    var _todayISO2 = _td();
    pipes = pipes.filter(function(p) {
      if (!pipeIsActive(p)) return false;
      if (pipeUrgentFlt === 'bid7' || pipeUrgentFlt === 'bid30') {
        if (!p.biddingDate) return false;
        var bd = dTo(p.biddingDate);
        return pipeUrgentFlt === 'bid7' ? (bd >= 0 && bd <= 7) : (bd > 7 && bd <= 30);
      }
      if (pipeUrgentFlt === 'stale90') {
        var lastLog = ST.pipeLogsByPipe(p.id)[0];
        var lastActivityDate = (lastLog && lastLog.date) ? lastLog.date.split('T')[0] : (p.registerDate || (p.created ? p.created.split('T')[0] : ''));
        return lastActivityDate && daysBetween(lastActivityDate, _todayISO2) > 90;
      }
      return true;
    });
  }

  if (pipeSearch) {
    var q = pipeSearch.toLowerCase();
    pipes = pipes.filter(function(p) {
      var d = ST.getOne('dealers', p.dealerId);
      if (pipeSearchMode === 'rowno') return String(p.rowNo || '').toLowerCase().indexOf(q) !== -1;
      if (pipeSearchMode === 'project') return (p.projectName || '').toLowerCase().indexOf(q) !== -1;
      if (pipeSearchMode === 'dealer') return ((d && d.name) || '').toLowerCase().indexOf(q) !== -1;
      return (p.projectName || '').toLowerCase().indexOf(q) !== -1 ||
             (p.endUserTH || '').toLowerCase().indexOf(q) !== -1 ||
             (p.endUserEN || '').toLowerCase().indexOf(q) !== -1 ||
             (p.model || '').toLowerCase().indexOf(q) !== -1 ||
             (d && d.name || '').toLowerCase().indexOf(q) !== -1 ||
             (p.remark || '').toLowerCase().indexOf(q) !== -1 ||
             String(p.rowNo || '').toLowerCase().indexOf(q) !== -1;
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
    if (pipeIsOpen(p)) activeAmt += amt;
    if (pipeIsWon(p)) wonAmt += amt;
    if (p.status === 'fail_lost') lostAmt += amt;
  });
  var biddingSoon = allPipes.filter(function(p) { return p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 30 && pipeIsActive(p); });
  var teamPipes = (typeof _teamPipelineData !== 'undefined' && Array.isArray(_teamPipelineData)) ? _teamPipelineData : [];
  var _dashConflictPool = allPipes.concat(teamPipes);
  var _conflictLookup = pipeConflictLookup(_dashConflictPool, 60);
  var conflicts = _conflictLookup.conflicts;
  _conflictMap = _conflictLookup.map;
  var conflictCheckBtn = '<button class="btn bsm bo" onclick="runPipeConflictCheck(ST.getAll(\'pipeline\').concat(typeof _teamPipelineData!==\'undefined\'&&Array.isArray(_teamPipelineData)?_teamPipelineData:[]),60)">' +
    (!_conflictLookup.checked ? '🔍 ตรวจโครงการชนกัน' : (_conflictLookup.stale ? '🔄 ตรวจใหม่ (ข้อมูลเปลี่ยนไปแล้ว)' : '🔄 ตรวจใหม่')) + '</button>';

  el.innerHTML = '' +
    _pipeSectionHeader('📊 Dashboard', 'pipeDash', pipeDashOpen,
      !pipeDashOpen ? (allPipes.length + ' รายการ · ' + fmtMoneyShort(activeAmt) + ' active') : '') +
    '<div id="pipeDashWrap"' + (!pipeDashOpen ? ' style="display:none"' : '') + '>' +
    '<div class="sr">' +
    '<div class="sc"><div class="sn c1">' + allPipes.length + '</div><div class="sl">ทั้งหมด</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(activeAmt) + '</div><div class="sl">Active</div></div>' +
    '<div class="sc"><div class="sn c5">' + fmtMoneyShort(totalAllForecast) + '</div><div class="sl">Total</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(wonAmt) + '</div><div class="sl">Won</div></div>' +
    '<div class="sc"><div class="sn c4">' + fmtMoneyShort(lostAmt) + '</div><div class="sl">Lost</div></div>' +
    '<div class="sc"><div class="sn c3">' + biddingSoon.length + '</div><div class="sl">Bidding 30d</div></div>' +
    (conflicts.length ? '<div class="sc"><div class="sn c4">' + conflicts.length + '</div><div class="sl">⚠️ อาจชนกัน</div></div>' : '') +
    '</div>' +
    '<div style="margin-bottom:6px">' + conflictCheckBtn + '</div>' +
    buildConflictClusterHtml(conflicts) +
    '</div>' +

    '<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;align-items:center">' +
    '<button class="btn bp" onclick="showPipelineM()">➕ เพิ่ม</button>' +
    '<button class="btn bo" onclick="showImportPipelineM()">📥 Import</button>' +
    '<button class="btn bo" onclick="importPipelineXlsx(\'\')">📂 xlsx</button>' +
    '<button class="btn bo" onclick="showPastePipelineM()">📋 วาง</button>' +
    '<button class="btn bo" onclick="showPipeExportLogFilterM(\'csv\')">📤 CSV</button>' +
    '<button class="btn bo" onclick="showPipeExportLogFilterM(\'xlsx\')">📤 xlsx</button>' +
    '<button class="btn bo" onclick="copyPipeTable()">📋 Copy</button>' +
    (AI_FEATURES_ENABLED ? '<button class="btn bo" onclick="aiAnalyzePipeline(this)">🤖 AI วิเคราะห์</button>' : '') +
    '<button class="btn ' + (pipeCompareMode ? 'bp' : 'bo') + '" onclick="togglePipeCompareMode()">🔍 ' + (pipeCompareMode ? 'ออกจากโหมดเทียบ' : 'เทียบ Project') + '</button>' +
    '<button class="btn bo" onclick="showPipeMatchWeightsM()" title="ตั้งน้ำหนักการเทียบ">⚙️</button>' +
    '<button class="btn ' + (pipeSelectMode ? 'bd' : 'bo') + '" onclick="togglePipeSelectMode()">☑️ ' + (pipeSelectMode ? 'ยกเลิก' : 'เลือก') + '</button>' +
    '<div style="flex:1"></div>' +
    '<button class="btn bsm ' + (pipeView === 'table' ? 'bp' : 'bo') + '" onclick="pipeView=\'table\';render()" title="ตาราง">📋</button>' +
    '<button class="btn bsm ' + (pipeView === 'card' ? 'bp' : 'bo') + '" onclick="pipeView=\'card\';render()" title="การ์ด">🃏</button>' +
    '<button class="btn bsm ' + (pipeView === 'sheet' ? 'bp' : 'bo') + '" onclick="pipeView=\'sheet\';render()" title="Sheet เต็มคอลัมน์">📊</button>' +
    '<button class="btn bsm ' + (pipeView === 'sheetedit' ? 'bp' : 'bo') + '" onclick="pipeView=\'sheetedit\';render()" title="แก้ไขแบบตาราง">🗂️</button>' +
    (pipeView === 'card' ? (
      '<div style="display:flex;gap:4px;border:1px solid var(--border);border-radius:8px;overflow:hidden">' +
      '<button class="btn-xs" style="border-radius:0;' + (pipeCardCols === 1 ? 'background:var(--accent);color:#fff' : '') + '" onclick="pipeCardCols=1;render()" title="1 การ์ดต่อแถว">⚏1</button>' +
      '<button class="btn-xs" style="border-radius:0;' + (pipeCardCols === 2 ? 'background:var(--accent);color:#fff' : '') + '" onclick="pipeCardCols=2;render()" title="2 การ์ดต่อแถว">⚏2</button>' +
      '</div>'
    ) : '') +
    '</div>' +

    _pipeUrgentBarHtml(allPipes) +

    (pipeCompareMode ? renderPipeCompareSuggestPanel() : '') +

    _pipeSectionHeader('🔍 ตัวกรอง', 'pipeFilter', pipeFilterOpen,
      !pipeFilterOpen ? [(Object.keys(pipeFlt).length ? '● ' + Object.keys(pipeFlt).length + ' สถานะ' : ''), (pipeSearch ? '"' + sanitize(pipeSearch) + '"' : '')].filter(Boolean).join(' ') : '') +

    '<div id="pipeFilterWrap"' + (!pipeFilterOpen ? ' style="display:none"' : '') + '>' +
    (function() {
      var pipeSearchModeLabels = { all: 'ทั้งหมด', rowno: 'Row No.', project: 'ชื่อโครงการ', dealer: 'บริษัท' };
      return '<div class="ftabs" style="margin-bottom:6px">' + Object.keys(pipeSearchModeLabels).map(function(mk) {
        return '<div class="ftab ' + (pipeSearchMode === mk ? 'act' : '') + '" onclick="pipeSearchSetMode(\'' + mk + '\')">' + pipeSearchModeLabels[mk] + '</div>';
      }).join('') + '</div>';
    })() +
    '<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap">' +
    '<input type="text" id="pipeSrc" value="' + sanitize(pipeSearch) + '" placeholder="🔍 ค้นหาจาก' + ({ all: 'Row No./ชื่อโครงการ/End User/Dealer/Model', rowno: 'Row No.', project: 'ชื่อโครงการ', dealer: 'บริษัท' }[pipeSearchMode]) + '..." style="flex:1;min-width:150px" oninput="pipeSearchInput(this.value)" autocomplete="off">' +
    '<select id="pipeSortSel" onchange="pipeSort=this.value;render()" style="min-width:120px">' +
    '<option value="updated_desc"' + (pipeSort === 'updated_desc' ? ' selected' : '') + '>🔄 อัพเดทล่าสุด</option>' +
    '<option value="date_desc"' + (pipeSort === 'date_desc' ? ' selected' : '') + '>วันที่ลงทะเบียน ใหม่สุด</option>' +
    '<option value="date_asc"' + (pipeSort === 'date_asc' ? ' selected' : '') + '>วันที่ลงทะเบียน เก่าสุด</option>' +
    '<option value="amount_desc"' + (pipeSort === 'amount_desc' ? ' selected' : '') + '>มูลค่า มากสุด</option>' +
    '<option value="amount_asc"' + (pipeSort === 'amount_asc' ? ' selected' : '') + '>มูลค่า น้อยสุด</option>' +
    '<option value="bidding"' + (pipeSort === 'bidding' ? ' selected' : '') + '>Bidding ใกล้สุด</option>' +
    '<option value="close"'   + (pipeSort === 'close'   ? ' selected' : '') + '>Expected Close ใกล้สุด</option>' +
    '<option value="dealer"' + (pipeSort === 'dealer' ? ' selected' : '') + '>ตาม Dealer</option>' +
    '<option value="status"' + (pipeSort === 'status' ? ' selected' : '') + '>ตาม Status</option>' +
    '<option value="rowno_asc"' + (pipeSort === 'rowno_asc' ? ' selected' : '') + '>🔢 Row No. น้อย→มาก</option>' +
    '<option value="rowno_desc"' + (pipeSort === 'rowno_desc' ? ' selected' : '') + '>🔢 Row No. มาก→น้อย</option>' +
    '</select>' +
    '<select id="pipeFYSel" onchange="pipeFY=this.value;render()" style="min-width:120px">' +
    '<option value="all"' + (pipeFY === 'all' ? ' selected' : '') + '>🏛️ ทุกปีงบ</option>' +
    (function() {
      var cur = currentThaiFY(); var o = '';
      for (var fy = cur + 2; fy >= cur - 2; fy--) o += '<option value="' + fy + '"' + (String(pipeFY) === String(fy) ? ' selected' : '') + '>ปีงบ ' + fy + (fy === cur ? ' (ปีนี้)' : '') + '</option>';
      return o;
    })() +
    '</select>' +
    (function() {
      var sales = []; var seen = {};
      ST.getAll('pipeline').forEach(function(p) { if (p.saleName && !seen[p.saleName]) { seen[p.saleName] = true; sales.push(p.saleName); } });
      if (!sales.length) return '';
      return '<select onchange="pipeSale=this.value;render()" style="min-width:100px">' +
        '<option value="all"' + (pipeSale === 'all' ? ' selected' : '') + '>👤 ทุก Sale</option>' +
        sales.map(function(s) { return '<option value="' + sanitize(s) + '"' + (pipeSale === s ? ' selected' : '') + '>' + sanitize(s) + '</option>'; }).join('') +
        '</select>';
    })() +
    '<select onchange="pipeDisplayFlt=this.value;render()" style="min-width:105px">' +
    '<option value="all"' + (pipeDisplayFlt === 'all' ? ' selected' : '') + '>👁 ทั้งหมด</option>' +
    '<option value="show"' + (pipeDisplayFlt === 'show' ? ' selected' : '') + '>✅ Focus (Show)</option>' +
    '<option value="hide"' + (pipeDisplayFlt === 'hide' ? ' selected' : '') + '>🙈 ซ่อน (Hide)</option>' +
    '</select>' +
    '</div>' +

    '<div class="hint" style="margin-bottom:4px">สถานะ (เลือกได้หลายช่อง — ไม่เลือกเลย = ทั้งหมด)</div>' +
    '<div class="pipe-sum">' +
    Object.entries(ps.summary).filter(function(e) { return e[1].count > 0; }).map(function(e) {
      var k = e[0], v = e[1];
      return '<div class="pipe-sum-card ' + (pipeFlt[k] ? 'act' : '') + '" onclick="togglePipeStatus(\'' + k + '\')">' +
        '<div class="stage" style="color:' + (v.color || '#94a3b8') + '">' + v.name + '</div>' +
        '<div class="count">' + v.count + '</div>' +
        '<div class="amount">' + fmtMoneyShort(v.amount) + '</div></div>';
    }).join('') +
    '<div class="pipe-sum-card ' + (Object.keys(pipeFlt).length === 0 ? 'act' : '') + '" onclick="clearPipeStatusFlt()">' +
    '<div class="stage">📊 ทั้งหมด</div><div class="count">' + ps.totalCount + '</div><div class="amount">' + fmtMoneyShort(ps.totalPipeline) + '</div></div>' +
    '</div>' +
    pipeSelectedSubtotalHtml(pipeFlt, ps.summary) +
    (function() {
      var taskCnt = allPipes.filter(function(p) { return _pipeOpenTaskIdx[p.id]; }).length;
      if (!taskCnt) return '';
      return '<div class="hint" style="margin:8px 0 4px">งานค้าง</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px">' +
        '<span onclick="togglePipeTaskFlt()" style="cursor:pointer;font-size:.72rem;padding:4px 10px;border-radius:14px;display:inline-flex;align-items:center;gap:4px;' +
        (pipeTaskFlt ? 'background:#ef4444;color:#fff' : 'background:var(--bg2);border:1px solid var(--border);color:var(--text2)') + '">📋 มีงานค้าง (' + taskCnt + ')</span></div>';
    })() +
    '<div class="hint" style="margin:8px 0 4px">📅 Bidding Date เดือนไหนบ้าง (ไม่เลือก = ทุกเดือน)</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px">' +
    ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'].map(function(mn, idx) {
      var on = !!pipeBidMonthFilter[idx];
      return '<span onclick="togglePipeBidMonth(' + idx + ')" style="cursor:pointer;font-size:.72rem;padding:4px 10px;border-radius:14px;' +
        (on ? 'background:var(--accent);color:#fff' : 'background:var(--bg2);border:1px solid var(--border);color:var(--text2)') + '">' + mn + '</span>';
    }).join('') +
    (Object.keys(pipeBidMonthFilter).length ? '<button class="btn bsm bo" onclick="clearPipeBidMonthFilter()">✕ ล้าง</button>' : '') +
    '</div>' +
    '</div>' +

    (pipeView === 'card' ? renderPipeCards(pipes, { cardCols: pipeCardCols }) :
     pipeView === 'sheet' ? renderPipeSheetTable(pipes) :
     pipeView === 'sheetedit' ? '<div id="pipeSheetWrap">' +
       '<div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center">' +
       '<input id="pipeSheetSearch" type="text" placeholder="🔍 ค้นหาในชีท..." style="flex:1;min-width:150px;font-size:12px" oninput="searchPipeSheet()" autocomplete="off">' +
       '<select id="pipeSheetSortSel" style="font-size:12px" onchange="sortPipeSheetBy(this.value)">' +
       '<option value="">⇅ Multi-sort...</option>' +
       '<option value="forecast_desc">💰 Forecast มากสุด</option>' +
       '<option value="forecast_asc">💰 Forecast น้อยสุด</option>' +
       '<option value="bidding_asc">📅 Bidding ใกล้สุด</option>' +
       '<option value="status">📊 ตาม Status</option>' +
       '<option value="real_desc">✅ Real Amount มากสุด</option>' +
       '</select>' +
       '<button class="btn bsm bo" onclick="showPipeColPanel(this)" title="แสดง/ซ่อนคอลัมน์" style="font-size:12px">👁 คอลัมน์</button>' +
       '</div>' +
       '<div id="pipeSheetEl"></div>' +
       '<div id="pipeSheetSumRow" style="margin-top:4px;padding:6px 10px;background:var(--card);border:1px solid var(--border);border-radius:6px;font-size:11px;display:flex;gap:12px;flex-wrap:wrap"></div>' +
       '<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
       '<button class="btn bp" onclick="savePipeSheet()">💾 บันทึกทั้งหมด</button>' +
       '<button class="btn bo" onclick="recalcAllPipeQty()" title="คำนวณ Qty ทั้งหมดจากช่อง Model">🔄 Qty</button>' +
       '<button class="btn bo" onclick="calcAllPipeRevenue()" title="คำนวณ Revenue จาก Qty × ราคา RRP Ex VAT">💰 Revenue</button>' +
       '<button id="btnPipeUndo" class="btn bo" style="display:none" onclick="undoPipeSheet()" title="คืนค่าก่อน recalc ครั้งล่าสุด">↩️ Undo</button>' +
       '<span id="pipeSheetStatus" style="font-size:.8rem;color:var(--text2)"></span></div></div>' :
     renderPipeTable(pipes)) +

    '<div style="font-size:.64rem;color:#64748b;margin-top:4px">' + pipes.length + ' รายการ' +
    (pipeSearch ? ' (ค้นหา: "' + sanitize(pipeSearch) + '")' : '') +
    '</div>' +

    (pipeCompareMode ? renderPipeCompareBar() : '');

  if (pipeView === 'sheetedit') {
    setTimeout(function() { initPipeSheet(pipes); }, 0);
  }

  var srcEl = document.getElementById('pipeSrc');
  if (srcEl && pipeSearch) {
    srcEl.focus();
    srcEl.setSelectionRange(pipeSearch.length, pipeSearch.length);
  }
}

function sortPipes(pipes, sortBy) {
  var sorted = pipes.slice();
  switch (sortBy) {
    case 'updated_desc':
      sorted.sort(function(a, b) { return (b.updated || b.created || '').localeCompare(a.updated || a.created || ''); });
      break;
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
    case 'close':
      sorted.sort(function(a, b) {
        var da = a.expectedCloseDate || a.biddingDate || '9999';
        var db = b.expectedCloseDate || b.biddingDate || '9999';
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
      var statusOrder = ['bidding','on_process','draft_tor','initial','win','contracting','deliver','fail_lost'];
      sorted.sort(function(a, b) {
        var ia = statusOrder.indexOf(a.status);
        var ib = statusOrder.indexOf(b.status);
        if (ia === -1) ia = 99;
        if (ib === -1) ib = 99;
        return ia - ib;
      });
      break;
    case 'rowno_asc':
    case 'rowno_desc':
      // ไม่มี Row No. (ไม่ได้มาจาก import) ให้ไปท้ายสุดเสมอ ไม่ว่าจะเรียงทิศไหน
      sorted.sort(function(a, b) {
        var ra = parseFloat(a.rowNo), rb = parseFloat(b.rowNo);
        var na = isNaN(ra), nb = isNaN(rb);
        if (na && nb) return 0;
        if (na) return 1;
        if (nb) return -1;
        return sortBy === 'rowno_asc' ? ra - rb : rb - ra;
      });
      break;
  }
  return sorted;
}

// เอาชื่อสินค้าเต็ม (ตามที่เก็บใน pipeline item ตรงๆ เป็น text ไม่ผูก id) ไปเทียบชื่อเป๊ะกับสินค้าในคลัง
// ถ้ามี ShortName ตั้งไว้ → ใช้ ShortName แทน ถ้าไม่เจอ/ไม่ตรงเป๊ะ/ไม่มี ShortName → ใช้ชื่อเต็มเดิม (fallback ปลอดภัย)
function _pipeShortNameMap() {
  var map = {};
  getAllProducts().forEach(function(p) { if (p.shortName) map[p.name] = p.shortName; });
  return map;
}
function _pipeModelSummaryShort(p, shortMap) {
  var items = getPipeItems(p);
  return items.map(function(it) {
    var name = (it.model && shortMap[it.model]) ? shortMap[it.model] : (it.model || '-');
    return name + (it.qty > 1 ? ' x' + it.qty : '');
  }).join(', ');
}

// การ์ดโครงการ Pipeline — ใช้ร่วมกันทั้งเมนู Pipeline หลักและแท็บ Dealer > Pipeline (เรียกฟังก์ชันเดียวกัน
// เพื่อให้หน้าตาตรงกันเป๊ะ ไม่ต้องดูแล 2 ชุดโค้ด) opts.selectMode เปิดโหมดเลือกหลายรายการ (ใช้ใน Dealer tab)
function renderPipeCards(pipes, opts) {
  if (!pipes.length) return '<div class="empty"><div class="icon">📊</div><p>ไม่พบ Pipeline</p></div>';
  opts = opts || {};
  var selectMode = !!opts.selectMode;
  var selectedMap = opts.selectedMap || {};
  var toggleFn = opts.toggleFn || 'togglePipeSelectInCard';
  var gridClass = opts.cardCols === 2 ? ' pcg-2col' : ' pcg-1col'; // 1/2 การ์ดต่อแถว — ดู .pcg-1col/.pcg-2col ใน style.css
  if (!selectMode) pipes = pipes.slice().sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
  var _qtMap = _buildQtMap();
  var shortMap = _pipeShortNameMap();
  // Index Dealer/Log/Task ล่วงหน้าครั้งเดียวก่อนเข้าลูป แทนเรียก ST.getOne/getAll ต่อการ์ด — ST.getAll()
  // แปลง JSON ทั้ง collection ใหม่ทุกครั้งที่เรียก ไม่มีแคช เรียกซ้ำในลูป N การ์ด = O(n²) ค้างตอนข้อมูลเยอะ
  // (ตาม pattern เดียวกับ _conflictMap ด้านล่างที่ทำ index ไว้ก่อนอยู่แล้ว)
  var _dealerMap = {};
  ST.getAll('dealers').forEach(function(dl) { _dealerMap[dl.id] = dl; });
  var _lastLogMap = {};
  ST.getAll('pipeLog').forEach(function(l) {
    var cur = _lastLogMap[l.pipeId];
    if (!cur || (l.date || '') > (cur.date || '')) _lastLogMap[l.pipeId] = l;
  });
  var _openTaskCountMap = {};
  ST.getAll('tasks').forEach(function(t) {
    if (t.status === 'completed') return;
    _openTaskCountMap[t.pipeId] = (_openTaskCountMap[t.pipeId] || 0) + 1;
  });

  var html = '<div class="pipe-card-grid' + gridClass + '">';
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    var d = _dealerMap[p.dealerId];
    var amt = Number(p.forecastAmount) || 0;
    var lastLog = _lastLogMap[p.id];
    var bidUrgency = pipeBidUrgency(p);
    var cardBorder = p.pinned ? 'border-left:3px solid var(--accent)' : (bidUrgency === 'urgent' ? 'border-left:3px solid #ef4444' : (bidUrgency === 'soon' ? 'border-left:3px solid #f59e0b' : ''));
    var cardIsWon = pipeIsWon(p);
    var cardIsLost = p.status === 'fail_lost';

    var cCard = _conflictMap[p.id];
    var cCardTag = '';
    if (cCard && cCard.length === 1) {
      var cLabel = sanitize((cCard[0].dealerName || '').split(' ')[0]);
      if (cCard[0].ownerName) cLabel += ' (' + sanitize(cCard[0].ownerName) + ')';
      var cCardAction = cCard[0].isTeam ? 'showConflictListM(\'' + p.id + '\')' : 'compareConflict(\'' + p.id + '\',\'' + cCard[0].otherId + '\')';
      cCardTag = '<span style="font-size:10px;background:#ef444418;color:#ef4444;border:1px solid #ef444430;padding:2px 8px;border-radius:20px;cursor:pointer" onclick="event.stopPropagation();' + cCardAction + '">⚠️ ชน ' + cLabel + '</span>';
    } else if (cCard && cCard.length > 1) {
      cCardTag = '<span style="font-size:10px;background:#ef444418;color:#ef4444;border:1px solid #ef444430;padding:2px 8px;border-radius:20px;cursor:pointer" onclick="event.stopPropagation();showConflictListM(\'' + p.id + '\')">⚠️ ชน ' + cCard.length + ' เจ้า</span>';
    }
    var _fyCard = pipeFYStatus(p);
    var modelSummary = _pipeModelSummaryShort(p, shortMap);
    var cardOnclick = selectMode ? (toggleFn + '(\'' + p.id + '\')') : ('go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})');
    var _openTaskCnt = _openTaskCountMap[p.id] || 0;

    html += '<div class="dealer-card" style="position:relative;' + cardBorder + '" onclick="' + cardOnclick + '">';
    if (_openTaskCnt) {
      html += '<span title="' + _openTaskCnt + ' Task ค้างอยู่" style="position:absolute;top:-7px;right:-7px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;min-width:19px;height:19px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 4px;box-shadow:0 0 0 2px var(--bg,#0f172a)">' + _openTaskCnt + '</span>';
    }
    if (selectMode) {
      html += '<div style="margin-bottom:6px"><input type="checkbox" id="dpChk_' + p.id + '" ' + (selectedMap[p.id] ? 'checked' : '') + ' onclick="event.stopPropagation();' + toggleFn + '(\'' + p.id + '\')" style="width:auto"></div>';
    }
    // แถว 1: Row No. + ชื่อโครงการ (ยืดเต็ม) + หน่วยงาน (End User, ชิดขวาตายตัว) + ปักหมุด/ใบเสนอราคา
    html += '<div style="display:flex;align-items:baseline;gap:8px">' + (p.rowNo ? _pipeRowNoBadge(p) : '<span class="pipe-row-num">#' + (i + 1) + '</span>');
    html += '<span style="font-size:.85rem;font-weight:600;flex:1;min-width:0;color:var(--text,#e2e8f0)">' + sanitize((p.projectName || '').substr(0, 80)) + '</span>';
    if (p.endUserTH) html += '<span style="font-size:.72rem;font-weight:600;color:var(--text2,#94a3b8);flex-shrink:0;white-space:nowrap">' + sanitize((p.endUserTH || '').substr(0, 30)) + '</span>';
    html += '<span style="display:flex;gap:2px;flex-shrink:0">';
    html += '<button class="pipe-pin-btn' + (p.pinned ? ' on' : '') + '" title="ปักหมุด" onclick="event.stopPropagation();togglePipePin(\'' + p.id + '\')">📌</button>';
    html += '<button class="quick-update-btn" title="ใบเสนอราคา" onclick="event.stopPropagation();showPipelineQuotesM(\'' + p.id + '\')">' + (_qtMap[p.id] ? '📄 ' + _qtMap[p.id] : '📄') + '</button></span></div>';
    // แถว 2: Dealer (ซ้าย) + รายการสินค้า/จำนวน ใช้ ShortName ถ้ามี (ขวา ใต้หน่วยงาน)
    html += '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:6px">';
    html += '<span class="meta" style="margin:0">🏪 ' + sanitize(d ? d.name : '-') + '</span>';
    if (modelSummary) html += '<span class="meta" style="margin:0;font-weight:600;text-align:right;white-space:nowrap">📦 ' + sanitize(modelSummary.substr(0, 45)) + '</span>';
    html += '</div>';
    // แถว 3: แท็กสถานะ/หมวดต่างๆ + POS% (กดแล้วเลือกเปอร์เซ็นต์ได้ทันทีไม่ต้องเปิดฟอร์ม)
    html += '<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:8px">' + pipeTag(p.status) + (amt >= 1500000 ? ' <span class="tag tag-high">💰 Big</span>' : '') + (cCardTag ? ' ' + cCardTag : '') + (_fyCard ? ' <span class="tag" style="background:' + _fyCard.c + '18;color:' + _fyCard.c + '">' + _fyCard.e + ' ' + _fyCard.t + '</span>' : '') + ' ' + _pipePosBadgeHtml(p) + '</div>';
    html += _pipePosPickerHtml(p);
    // แถว 4: Bid badge (ซ้าย) + อัปเดตล่าสุด (กลาง) + มูลค่า (ขวา) คั่นเส้นบน
    html += '<div style="display:grid;grid-template-columns:150px 1fr 130px;gap:10px;align-items:center;padding-top:8px;margin-top:8px;border-top:1px solid var(--border,#334155)">';
    html += '<span style="justify-self:start">' + (p.biddingDate ? _pipeBidDateBadge(p, cardIsWon || cardIsLost) : '') + '</span>';
    html += '<span style="font-size:10.5px;color:var(--text3,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (lastLog && !_gvHidden('pipeline_notes') ? '📝 ' + fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' · ' + sanitize((lastLog.content || '').substr(0, 45)) : '') + '</span>';
    html += '<span style="text-align:right;font-size:.92rem;font-weight:700;color:#22c55e">' + (_gvHidden('pipeline_forecast') ? '-' : fmtMoneyStyled(amt)) + '</span>';
    html += '</div>';

    // ลิงก์ขยายดูรายละเอียดสินค้า (Next Action + สรุปรายการสินค้า) ในตัวการ์ดเลย ไม่ต้องเข้าไปหน้ารายละเอียด
    // — คลิกแยกจากตัวการ์ด (stopPropagation) กันชนกับ cardOnclick ที่พาไปหน้า pipeDetail
    var _pcExpanded = !!_pipeCardExpanded[p.id];
    html += '<div style="display:flex;justify-content:center;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border,#334155)">' +
      '<span style="cursor:pointer;color:var(--accent,#3b82f6);font-size:11px" onclick="event.stopPropagation();togglePipeCardExpand(\'' + p.id + '\')">' +
      (_pcExpanded ? '▴ ย่อกลับ' : '▾ ดูรายละเอียดสินค้า') + '</span></div>';
    if (_pcExpanded) html += _pipeCardExpandedDetailHtml(p);

    html += '</div>';
  }
  html += '</div>';
  return html;
}

var _pipeCardExpanded = {}; // {pipeId: true} — การ์ดไหนกำลังขยายดูรายละเอียดสินค้าอยู่ (renderPipeCards)
function togglePipeCardExpand(id, ev) {
  if (ev) ev.stopPropagation();
  _pipeCardExpanded[id] = !_pipeCardExpanded[id];
  render();
}

// Next Action + สรุปรายการสินค้า (ชิปหมวดหมู่ + ตาราง Model/QTY/มูลค่า) แบบเดียวกับที่ใช้ใน modal เทียบ
// Project — ใช้ _pipeCompareProductBreakdownHtml() ร่วมกัน (คุมด้วย pipeSummaryFullValue ตัวเดียวกัน)
function _pipeCardExpandedDetailHtml(p) {
  var h = '<div style="border-top:1px dashed var(--border,#334155);padding-top:10px;margin-top:2px">';
  h += '<div style="font-size:11px;color:var(--text2,#94a3b8);margin-bottom:8px">🎯 Next Action: ' +
    (pipeNextActionHtml(p, true) || '<span style="color:var(--text3,#64748b)">ไม่ได้ตั้ง</span>') + '</div>';
  h += _pipeCompareProductBreakdownHtml(p);
  h += '</div>';
  return h;
}

function _buildQtMap() {
  var m = {};
  try {
    var qs = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]');
    qs.forEach(function(q) { if (q.pipelineId) m[q.pipelineId] = (m[q.pipelineId]||0)+1; });
  } catch(e) {}
  return m;
}

function renderPipeTable(pipes) {
  if (!pipes.length) return '<div class="empty"><div class="icon">📊</div><p>ไม่พบ Pipeline</p></div>';
  pipes = pipes.slice().sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
  var _qtMap = _buildQtMap();
  var _tblShortMap = _pipeShortNameMap();
  // index Dealer/Log ล่วงหน้าครั้งเดียว — เหตุผลเดียวกับ renderPipeCards() ด้านล่าง (ST.getOne/getAll
  // ไม่แคช เรียกต่อแถวกลายเป็น O(n²)) และ hoist น้ำหนัก pipeMatchScore ออกมาก่อนลูปด้วย เพราะโหมด
  // "เทียบ Project" เรียก pipeCompareBestMatch ต่อแถว (O(n) ต่อแถว) ซึ่งเดิมเรียก getConfig() ในนั้นอีกที
  var _tblDealerMap = {};
  ST.getAll('dealers').forEach(function(dl) { _tblDealerMap[dl.id] = dl; });
  var _tblLastLogMap = {};
  ST.getAll('pipeLog').forEach(function(l) {
    var cur = _tblLastLogMap[l.pipeId];
    if (!cur || (l.date || '') > (cur.date || '')) _tblLastLogMap[l.pipeId] = l;
  });
  var _tblCmpWeights = pipeCompareMode ? ((typeof getConfig === 'function' && getConfig().pipeMatchWeights) || null) : null;
  var _tblCmpActivePool = pipeCompareMode ? ST.getAll('pipeline').filter(function(x) { return pipeIsOpen(x); }) : null;

  _pipeVisibleIds = pipes.map(function(p) { return p.id; });
  var html = '<div class="pipe-wrap"><table class="pipe-table" id="pipeTable"><thead>' +
    (pipeCompareMode ? '<th style="width:30px">เทียบ</th><th>แนวโน้มชนงาน</th>' : '') +
    (pipeSelectMode ? '<th style="width:32px;text-align:center"><input type="checkbox" id="pipeSelAll" title="เลือกทั้งหมด" onclick="togglePipeSelectAll(this.checked)"></th>' : '') +
    '<th style="width:48px" title="Row No. จากไฟล์ import (fallback เป็นเลขลำดับถ้าไม่มี)">No.</th>' +
    '<th>Register</th>' +
    '<th>Project</th>' +
    '<th>End User</th>' +
    '<th>Dealer</th>' +
    '<th>Model</th>' +
    '<th style="text-align:right">Forecast</th>' +
    '<th>TOR</th>' +
    '<th>Bidding</th>' +
    '<th>Status</th>' +
    '<th>Age</th>' +
    '<th>Update</th>' +
    '<th></th>' +
    '</thead><tbody>';
  
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    var d = _tblDealerMap[p.dealerId];
    var lastLog = _tblLastLogMap[p.id];
    var amt = Number(p.forecastAmount) || 0;
    var isWon = pipeIsWon(p);
    var isLost = (p.status === 'fail_lost');
    
    var regDate = p.registerDate || (p.created ? p.created.split('T')[0] : '');
    var lastActivityDate = (lastLog && lastLog.date) ? lastLog.date.split('T')[0] : regDate;
    var ageDays = lastActivityDate ? daysBetween(lastActivityDate, _td()) : 0;
    var ageClass = ageDays > 180 ? 'very-old' : (ageDays > 90 ? 'old' : '');
    
    var modelText = _pipeModelSummaryShort(p, _tblShortMap);

    var cRow = _conflictMap[p.id];
    var cRowTag = '';
    if (cRow && cRow.length === 1) {
      var rLabel = sanitize((cRow[0].dealerName || '').split(' ')[0]);
      if (cRow[0].ownerName) rLabel += ' (' + sanitize(cRow[0].ownerName) + ')';
      var cRowAction = cRow[0].isTeam ? 'showConflictListM(\'' + p.id + '\')' : 'compareConflict(\'' + p.id + '\',\'' + cRow[0].otherId + '\')';
      cRowTag = '<div style="font-size:10px;background:#ef444418;color:#ef4444;border:1px solid #ef444430;padding:1px 5px;border-radius:4px;margin-top:3px;cursor:pointer;display:inline-block" onclick="event.stopPropagation();' + cRowAction + '">⚠️ ' + rLabel + '</div>';
    } else if (cRow && cRow.length > 1) {
      cRowTag = '<div style="font-size:10px;background:#ef444418;color:#ef4444;border:1px solid #ef444430;padding:1px 5px;border-radius:4px;margin-top:3px;cursor:pointer;display:inline-block" onclick="event.stopPropagation();showConflictListM(\'' + p.id + '\')">⚠️ ชน ' + cRow.length + ' เจ้า</div>';
    }

    var bidUrgency = pipeBidUrgency(p);
    var rowClass = (isWon ? 'pipe-win' : '') + (isLost ? 'pipe-lost' : '') +
      (p.pinned ? ' pipe-pinned' : '') +
      (bidUrgency === 'urgent' ? ' pipe-bid-urgent' : (bidUrgency === 'soon' ? ' pipe-bid-soon' : ''));

    var compareCells = '';
    if (pipeCompareMode) {
      var isSel = pipeCompareSelected.indexOf(p.id) !== -1;
      var best = pipeCompareBestMatch(p, _tblCmpWeights, _tblCmpActivePool);
      var matchBadge = '<span style="color:var(--text3);font-size:10px">— ไม่พบโครงการใกล้เคียง</span>';
      if (best) {
        var bColor = best.score >= 60 ? '#ef4444' : (best.score >= 40 ? '#f59e0b' : '#64748b');
        var bBg = best.score >= 60 ? 'rgba(239,68,68,.18)' : (best.score >= 40 ? 'rgba(245,158,11,.18)' : 'rgba(100,116,139,.2)');
        var bDealer = ST.getOne('dealers', best.other.dealerId);
        matchBadge = '<span style="background:' + bBg + ';color:' + bColor + ';font-size:10px;padding:2px 6px;border-radius:6px;font-weight:700;cursor:pointer" title="กดเพื่อเลือกคู่นี้เข้าเทียบ" onclick="event.stopPropagation();pipeCompareQuickPick(\'' + p.id + '\',\'' + best.other.id + '\')">' + best.score + '% กับ ' + sanitize((bDealer ? bDealer.name : '?').substr(0, 16)) + '</span>';
      }
      compareCells = '<td onclick="event.stopPropagation();togglePipeCompareSelect(\'' + p.id + '\')"><input type="checkbox" ' + (isSel ? 'checked' : '') + ' onclick="event.stopPropagation();togglePipeCompareSelect(\'' + p.id + '\')"></td>' +
        '<td onclick="event.stopPropagation()">' + matchBadge + '</td>';
    }

    var selectCell = pipeSelectMode
      ? '<td style="text-align:center" onclick="event.stopPropagation();togglePipeSelect(\'' + p.id + '\')">' +
        '<input type="checkbox" id="pipeChk_' + p.id + '" ' + (pipeSelected[p.id] ? 'checked' : '') + ' onclick="event.stopPropagation();togglePipeSelect(\'' + p.id + '\')"></td>'
      : '';
    var trOnclick = pipeSelectMode
      ? ' onclick="togglePipeSelect(\'' + p.id + '\')"'
      : ' onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})"';
    html += '<tr class="' + rowClass + '"' + trOnclick + ' style="cursor:pointer">' +
      compareCells +
      selectCell +
      '<td class="pipe-row-num" title="ลำดับ #' + (i + 1) + '">' + (p.rowNo ? sanitize(String(p.rowNo)) : (i + 1)) + '</td>' +
      '<td style="white-space:nowrap">' + fDShort(p.registerDate) + '</td>' +
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis' + (isLost ? ';text-decoration:line-through' : '') + '" title="' + sanitize(p.projectName) + '">' +
      (isWon ? '✅ ' : (isLost ? '❌ ' : '')) + sanitize((p.projectName || '').substr(0, 45)) + '</td>' +
      '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis" title="' + sanitize(p.endUserTH || '') + '">' + sanitize((p.endUserTH || '').substr(0, 25)) + '</td>' +
      '<td style="white-space:nowrap" title="' + sanitize(d ? d.name : '') + '"><strong>' + (d ? sanitize(d.name) : '-') + '</strong></td>' +
      '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.72rem" title="' + sanitize(modelText) + '">' + sanitize(modelText) + '</td>' +
      (_gvHidden('pipeline_forecast')
        ? '<td style="text-align:right;white-space:nowrap">-</td>'
        : '<td id="pfc_' + p.id + '" onclick="event.stopPropagation();_pipeInlineEdit(\'' + p.id + '\',\'forecastAmount\')" style="text-align:right;white-space:nowrap;cursor:text" title="คลิกเพื่อแก้ไข">' + fmtMoneyStyled(amt) + '</td>') +
      '<td style="white-space:nowrap" title="' + sanitize(p.tor || '') + '">' + (p.tor || '-') + '</td>' +
      '<td id="pbd_' + p.id + '" onclick="event.stopPropagation();_pipeInlineEdit(\'' + p.id + '\',\'biddingDate\')" style="white-space:nowrap;cursor:text" title="คลิกเพื่อแก้ไข">' + (p.biddingDate ? _pipeBidDateBadge(p, isWon || isLost) : '-') + '</td>' +
      '<td id="pst_' + p.id + '" onclick="event.stopPropagation();_pipeInlineEdit(\'' + p.id + '\',\'status\')" style="cursor:text" title="คลิกเพื่อแก้ไข">' + pipeTag(p.status) + cRowTag + (function() { var f = pipeFYStatus(p); return f ? '<div style="font-size:10px;color:' + f.c + ';margin-top:3px;white-space:nowrap">' + f.e + ' ' + f.t + '</div>' : ''; })() + '</td>' +
      '<td style="white-space:nowrap"><span class="pipe-age ' + ageClass + '">' + ageDays + 'd</span></td>' +
      '<td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;font-size:.62rem" title="' + (_gvHidden('pipeline_notes') ? '' : sanitize(lastLog ? (lastLog.content || '') : '')) + '">' +
        (_gvHidden('pipeline_notes') ? '-' : (lastLog ? fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 25)) : '-')) +
      '</td>' +
      '<td onclick="event.stopPropagation()">' +
        '<button class="pipe-pin-btn' + (p.pinned ? ' on' : '') + '" title="ปักหมุด" onclick="togglePipePin(\'' + p.id + '\')">📌</button>' +
        '<button class="quick-update-btn" title="ใบเสนอราคา" onclick="showPipelineQuotesM(\'' + p.id + '\')">' + (_qtMap[p.id] ? '📄 ' + _qtMap[p.id] : '📄') + '</button>' +
        '<button class="quick-update-btn" onclick="showPipeUpdateM(\'' + p.id + '\')">📝</button>' +
      '</td>' +
      '</tr>';
  }
  
  html += '</tbody></table></div>';

  if (pipeSelectMode) {
    var selCnt = Object.keys(pipeSelected).length;
    html += '<div id="pipeSelBar" style="position:sticky;bottom:0;z-index:50;background:var(--card);border-top:2px solid var(--accent);padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<span id="pipeSelCount" style="font-size:13px;font-weight:600;min-width:80px">' + selCnt + ' รายการที่เลือก</span>' +
      '<button class="btn bo bsm" onclick="togglePipeSelectAll(true)">เลือกทั้งหมด (' + _pipeVisibleIds.length + ')</button>' +
      '<button class="btn bo bsm" onclick="togglePipeSelectAll(false)">ยกเลิกเลือก</button>' +
      (function() {
        var cfg = getConfig(); var opts = (cfg.pipelineStatuses || []).map(function(s) { return '<option value="' + sanitize(s.id) + '">' + sanitize(s.name) + '</option>'; }).join('');
        return '<select id="pipeSelStatusSel" ' + (!selCnt ? 'disabled' : '') + ' style="font-size:12px;min-width:110px"><option value="">✏️ เปลี่ยนสถานะ...</option>' + opts + '</select>' +
          '<button class="btn bo bsm" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkChangePipeStatus()">ยืนยัน</button>';
      })() +
      '<button class="btn bo bsm" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkExportPipes()">📥 Export ที่เลือก</button>' +
      '<button class="btn bd" id="pipeSelDelBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkDeletePipes()">🗑️ ลบที่เลือก (' + selCnt + ')</button>' +
      '<button class="btn bo bsm" style="margin-left:auto" onclick="togglePipeSelectMode()">✕ ออก</button>' +
      '</div>';
  }

  return html;
}

function copyPipeTable() { copyTable('pipeTable', '📋 Copy Pipeline Table'); }

// คอลัมน์มาตรฐานของตาราง Pipeline แบบเต็ม — ใช้ร่วมกันทั้ง CSV export และมุมมอง Sheet บนจอ
var PIPE_SHEET_HEADERS = ['ROW NO.','Register Date','Project ID','Project Name','End User Name','End User Name Eng','Unit type','Dealer Name','DJI Dealer','Project revenue','Model','M3M Qty.','M4T Qty.','M4E Qty.','Dock 3 Qty.','M4TD Qty.','M400 Qty.','Forecast Amount','Real Amount','TOR','Bidding Date','Forecast Month','Shipment date','Remark','Letter of Authorized หนังสือแต่งตั้ง','Project POS','Status','Duplicate งานซ้ำ','Update 1','Update 2','Update 3','Update 4','Update 5','Update 6','Sale','DISPLAY (Hide/Show)'];

// แปลง ROW NO. (คอลัมน์แรก) เป็นชนิดตัวเลขจริงก่อนเขียนไฟล์ xlsx เฉพาะที่เป็นตัวเลขล้วนๆ
// เหตุผล: aoa_to_sheet เดา cell type จาก JS type ของค่า — p.rowNo เก็บเป็น string เสมอ ถ้าไม่แปลง
// Google Sheets จะ import เป็น text ทำให้ VLOOKUP กับตัวเลขในชีตอื่นจับคู่ไม่ติดจนกว่าจะกด Convert to number
function _pipeXlsxFixRowNoType(wsData) {
  for (var i = 1; i < wsData.length; i++) {
    var v = wsData[i][0];
    if (v && /^\d+$/.test(v)) wsData[i][0] = Number(v);
  }
  return wsData;
}

// ดึงค่าดิบของแต่ละ pipeline ตามลำดับ PIPE_SHEET_HEADERS (ยังไม่ escape) ให้ CSV/HTML เอาไป escape ตามบริบทของตัวเอง
// excludeTypes: array ของ pipeLog.type ที่ไม่เอาไปโชว์ใน Update 1-6 (undefined = เอาทุกประเภทเหมือนเดิม)
function _pipeRowFields(p, excludeTypes) {
  var d = ST.getOne('dealers', p.dealerId);
  var logs = ST.pipeLogsByPipe(p.id);
  if (excludeTypes && excludeTypes.length) logs = logs.filter(function(l) { return excludeTypes.indexOf(l.type) === -1; });
  logs = logs.slice().reverse();
  var items = (p.items && p.items.length) ? p.items : (p.model ? [{ model: p.model, qty: p.modelQty || 1 }] : []);
  var modelCell = items.map(function(it) { return (it.model || '') + '*' + (Number(it.qty) || 1); }).join('\n');
  var g = _pipeModelQtyByGroup(items);
  var fields = [
    p.rowNo || '', fD(p.registerDate), p.projectId || '', p.projectName || '', p.endUserTH || '', p.endUserEN || '', p.unitType || '', d ? d.name : '', p.djiDealer || '', p.projectRevenue || '', modelCell,
    g.m3m || '', g.m4t || '', g.m4e || '', g.dock3 || '', g.m4td || '', g.m400 || '',
    p.forecastAmount || '', p.realAmount || '', p.tor || '', fD(p.biddingDate), _fmtForecastMonth(p.biddingDate), fD(p.shipmentDate), p.remark || '', p.appointmentLetter || '', p.projectPOS || '', getPipeName(p.status), p.recurring ? 'Yes' : ''
  ];
  // Update 1 = รวมทุก log ยกเว้นตัวล่าสุดเสมอ 1 ก้อน, Update 2 = เฉพาะตัวล่าสุด, Update 3-6 = ว่างเสมอ
  // คำนวณสดทุกครั้งตอน export เท่านั้น (ไม่แตะ ST.pipeLog จริง) — timeline ในแอปยังเห็นทุก log แยกรายการปกติ
  // customerNoteOnly (ถ้ามี) = ข้อความที่ลูกค้าพิมพ์มาจริงๆ ล้วนๆ ไม่มีสรุปอัตโนมัติปน — export ใส่คำนำหน้าสั้นๆ
  // "อัพเดทจากลูกค้า:" ให้รู้ที่มา (ตัด "✅ อนุมัติการ" ออก เหลือแค่ระบุแหล่งที่มา) ส่วน log เก่าก่อนแก้ที่ไม่มี
  // field นี้ (ยังเป็น "✅ อนุมัติการอัพเดทจากลูกค้า: ...") ก็ตัดคำนำหน้าให้สั้นลงแบบเดียวกัน — timeline ในแอปไม่กระทบ
  var logFmt = function(l) {
    var text;
    if (l.customerNoteOnly !== undefined) {
      text = l.customerNoteOnly ? 'อัพเดทจากลูกค้า: ' + l.customerNoteOnly : 'อัพเดทจากลูกค้า';
    } else if (/^✅\s*อนุมัติการอัพเดทจากลูกค้า:\s*/.test(l.content || '')) {
      text = (l.content || '').replace(/^✅\s*อนุมัติการอัพเดทจากลูกค้า:\s*/, 'อัพเดทจากลูกค้า: ');
    } else {
      text = l.content;
    }
    return fDShort(l.date ? l.date.split('T')[0] : '') + ' ' + text;
  };
  if (logs.length === 0) {
    for (var li = 0; li < 6; li++) fields.push('');
  } else if (logs.length === 1) {
    fields.push(logFmt(logs[0]));
    for (var li2 = 0; li2 < 5; li2++) fields.push('');
  } else {
    var older = logs.slice(0, logs.length - 1);
    var latest = logs[logs.length - 1];
    fields.push(older.map(logFmt).join('\n'));
    fields.push(logFmt(latest));
    for (var li3 = 0; li3 < 4; li3++) fields.push('');
  }
  fields.push(p.saleName || '', p.sheetDisplay || 'Show');
  return fields;
}

// ================================================================
// เลือกประเภท Update ที่จะรวมในคอลัมน์ Update 1-6 ตอน export/copy — ถามทุกครั้งที่กด (จำค่าล่าสุดไว้เป็น default)
// ================================================================
var PIPE_LOG_TYPE_META = [
  { key: 'update',        label: '📝 อัพเดท (ข้อความจากลูกค้า/เซลล์)', defaultOn: true },
  { key: 'note',           label: '⚪ หมายเหตุ', defaultOn: true },
  { key: 'progress',       label: '🟢 คืบหน้า', defaultOn: true },
  { key: 'problem',        label: '🔴 ปัญหา', defaultOn: true },
  { key: 'solution',       label: '🟡 แก้ไข', defaultOn: true },
  { key: 'win',            label: '✅ Win', defaultOn: true },
  { key: 'lost',           label: '❌ Lost', defaultOn: true },
  { key: 'visit',          label: '🤝 Visit (ระบบสร้างอัตโนมัติจากการเข้าพบ)', defaultOn: false },
  { key: 'status_change',  label: '🔄 เปลี่ยนสถานะ (ระบบสร้างอัตโนมัติ)', defaultOn: false },
  { key: 'action',         label: '➕ Action Item', defaultOn: false },
  { key: 'followup',       label: '📞 ติดตาม/นัดหมาย', defaultOn: false }
];
function _getPipeLogTypeFilterDefaults() {
  try {
    var saved = JSON.parse(localStorage.getItem('pipe_export_log_types') || 'null');
    if (saved) return saved;
  } catch (e) {}
  var st = {};
  PIPE_LOG_TYPE_META.forEach(function(m) { st[m.key] = m.defaultOn; });
  return st;
}
function showPipeExportLogFilterM(action, arg) {
  var st = _getPipeLogTypeFilterDefaults();
  var rows = PIPE_LOG_TYPE_META.map(function(m) {
    return '<label style="display:flex;align-items:center;gap:8px;padding:5px 0"><input type="checkbox" class="expLogTypeChk" value="' + m.key + '"' + (st[m.key] ? ' checked' : '') + '> ' + m.label + '</label>';
  }).join('');
  openM('📤 เลือก Update ที่จะรวมใน Export', `
    <div style="font-size:.76rem;color:#94a3b8;margin-bottom:8px">เลือกประเภท Update ที่จะไปโผล่ในคอลัมน์ Update 1-6 ของไฟล์ที่ export/copy ครั้งนี้ (ไม่กระทบ log จริงในระบบ)</div>
    <div style="max-height:280px;overflow-y:auto">${rows}</div>
    <div class="fm-actions" style="margin-top:10px">
      <button class="btn bp" onclick="runPipeExportWithLogFilter('${action}','${arg || ''}')">📤 Export</button>
      <button class="btn" onclick="closeM()">ยกเลิก</button>
    </div>
  `);
}
function runPipeExportWithLogFilter(action, arg) {
  var chks = Array.prototype.slice.call(document.querySelectorAll('.expLogTypeChk'));
  var st = {};
  chks.forEach(function(c) { st[c.value] = c.checked; });
  try { localStorage.setItem('pipe_export_log_types', JSON.stringify(st)); } catch (e) {}
  var excludeTypes = Object.keys(st).filter(function(k) { return !st[k]; });
  closeMForce();
  if (action === 'csv') dlPipeCSV(excludeTypes);
  else if (action === 'xlsx') dlPipeXlsx(excludeTypes);
  else if (action === 'csvDealer') dlPipeCSVForDealer(arg, excludeTypes);
  else if (action === 'xlsxDealer') dlPipeXlsxForDealer(arg, excludeTypes);
  else if (action === 'copyRow') copyPipeRow(arg, excludeTypes);
}

function dlPipeCSV(excludeTypes) { _exportPipeCSV(ST.getAll('pipeline'), 'pipeline-' + _td() + '.csv', excludeTypes); }

function dlPipeXlsx(excludeTypes) {
  var pipes = ST.getAll('pipeline').slice().sort(function(a, b) { return (a.registerDate || '').localeCompare(b.registerDate || ''); });
  var wsData = _pipeXlsxFixRowNoType([PIPE_SHEET_HEADERS].concat(pipes.map(function(p) { return _pipeRowFields(p, excludeTypes); })));
  var ws = XLSX.utils.aoa_to_sheet(wsData);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline');
  XLSX.writeFile(wb, 'pipeline-all-' + _td() + '.xlsx');
  var overflowCnt = pipes.filter(function(p) { return ST.pipeLogsByPipe(p.id).length > 6; }).length;
  toast('📥 Export Excel แล้ว (' + pipes.length + ' รายการ)' + (overflowCnt ? ' ⚠️ ' + overflowCnt + ' โครงการมี Update >6 รายการ — รายการที่ 7 เป็นต้นไปไม่ถูก export' : ''));
}

function dlPipeCSVForDealer(dealerId, excludeTypes) {
  var d = ST.getOne('dealers', dealerId);
  var safeName = (d ? d.name : 'dealer').replace(/[^a-zA-Z0-9ก-๙_\-]/g, '_');
  _exportPipeCSV(ST.pipelineByDealer(dealerId), 'pipeline-' + safeName + '-' + _td() + '.csv', excludeTypes);
}

function dlPipeXlsxForDealer(dealerId, excludeTypes) {
  var d = ST.getOne('dealers', dealerId);
  var safeName = (d ? d.name : 'dealer').replace(/[^a-zA-Z0-9ก-๙_\-]/g, '_');
  var pipes = ST.pipelineByDealer(dealerId).slice().sort(function(a, b) {
    return (a.registerDate || '').localeCompare(b.registerDate || '');
  });
  var wsData = _pipeXlsxFixRowNoType([PIPE_SHEET_HEADERS].concat(pipes.map(function(p) { return _pipeRowFields(p, excludeTypes); })));
  var ws = XLSX.utils.aoa_to_sheet(wsData);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline');
  XLSX.writeFile(wb, 'pipeline-' + safeName + '-' + _td() + '.xlsx');
  var overflowCnt = pipes.filter(function(p) { return ST.pipeLogsByPipe(p.id).length > 6; }).length;
  toast('📥 Export Excel แล้ว (' + pipes.length + ' รายการ)' + (overflowCnt ? ' ⚠️ ' + overflowCnt + ' โครงการมี Update >6 รายการ — รายการที่ 7+ ไม่ถูก export' : ''));
}

function _exportPipeCSV(pipes, filename, excludeTypes) {
  pipes = pipes.slice().sort(function(a, b) { return (a.registerDate || '').localeCompare(b.registerDate || ''); });
  var csv = '﻿"' + PIPE_SHEET_HEADERS.join('","') + '"\n';
  pipes.forEach(function(p) {
    var f = _pipeRowFields(p, excludeTypes);
    csv += f.map(function(v, idx) {
      // Model cell (idx 9 — เลื่อน +1 จากเดิมเพราะเพิ่มคอลัมน์ ROW NO. เข้ามาเป็นตัวแรก) เก็บ \n ไว้สำหรับสินค้าหลายบรรทัด ส่วนฟิลด์อื่น strip \n ตามมาตรฐาน CSV
      return '"' + (idx === 9 ? _csvKeepNL(v) : esc(v)) + '"';
    }).join(',') + '\n';
  });
  dlBlob(csv, filename);
}

// มุมมอง Sheet — ตารางเต็มคอลัมน์ตรงกับ CSV export ใช้ทั้งหน้า Pipeline หลักและ Pipeline tab ของ Dealer
function renderPipeSheetTable(pipes) {
  // คอลัมน์ที่เป็นตัวเลขเงิน (right-align + comma) และ qty (right-align + comma) — index เลื่อน +1 ทั้งหมด
  // จากเดิม เพราะเพิ่มคอลัมน์ ROW NO. เข้ามาเป็นคอลัมน์แรกสุด
  var _moneyIdx = { 8: true, 16: true, 17: true };
  var _qtyIdx   = { 10: true, 11: true, 12: true, 13: true, 14: true, 15: true };
  var h = '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px"><table style="border-collapse:collapse;font-size:11px;white-space:nowrap;width:100%">';
  h += '<thead><tr>' + PIPE_SHEET_HEADERS.map(function(hd, ci) {
    var align = (_moneyIdx[ci] || _qtyIdx[ci]) ? 'right' : 'left';
    return '<th style="padding:6px 8px;text-align:' + align + ';border-bottom:2px solid var(--border);background:var(--card);position:sticky;top:0">' + sanitize(hd) + '</th>';
  }).join('') + '</tr></thead><tbody>';
  pipes.forEach(function(p) {
    var f = _pipeRowFields(p);
    h += '<tr style="cursor:pointer;border-bottom:1px solid var(--border)" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" onmouseover="this.style.background=\'rgba(59,130,246,.06)\'" onmouseout="this.style.background=\'\'">';
    h += f.map(function(v, ci) {
      var raw = v == null ? '' : v;
      var display;
      if (_moneyIdx[ci] && raw !== '') display = fmtMoney(raw);
      else if (_qtyIdx[ci] && raw !== '') display = (Number(raw) || 0).toLocaleString('th-TH');
      else display = sanitize(String(raw).replace(/\n/g, ' / '));
      var align = (_moneyIdx[ci] || _qtyIdx[ci]) ? 'right' : 'left';
      return '<td style="padding:5px 8px;max-width:220px;overflow:hidden;text-overflow:ellipsis;text-align:' + align + '">' +
        ((_moneyIdx[ci] || _qtyIdx[ci]) ? sanitize(display) : display) + '</td>';
    }).join('');
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

// เก็บ \n ไว้ (สำหรับเซลล์ Model หลายบรรทัด) แค่ escape "
function _csvKeepNL(s) { return String(s || '').replace(/"/g, '""').replace(/\r/g, ''); }

// แตก qty ตามกลุ่มสินค้าหลัก (M3M/M4T/M4E/M4TD/M400/Dock 3) — เช็คเฉพาะเจาะจงก่อนกว้าง กัน M4TD หลุดไป M4T
// สินค้าที่ไม่ใช่ main drone product (battery, RC, accessory ฯลฯ) ไม่นับ
// M3M = Mavic 3 Multispectral Universal Edition — เช็คทั้งคำย่อ "M3M" และชื่อเต็ม "MULTISPECTRAL" เพราะข้อมูลจริงมีทั้ง 2 แบบ
function _pipeModelQtyByGroup(items) {
  var g = { m3m: 0, m4td: 0, m4t: 0, m4e: 0, m400: 0, dock3: 0 };
  (items || []).forEach(function(it) {
    var name = (it.model || '').toUpperCase();
    var qty = Number(it.qty) || 0;
    // รองรับทั้งชื่อย่อ (M3M, M4T...) และชื่อเต็มที่ xlsx import เก็บไว้ (MATRICE 3M, MATRICE 4T...)
    if      (name.indexOf('M3M') !== -1 || name.indexOf('MULTISPECTRAL') !== -1 || name.indexOf('MATRICE 3M') !== -1) g.m3m  += qty;
    else if (name.indexOf('M4TD') !== -1 || name.indexOf('MATRICE 4TD') !== -1)                                       g.m4td += qty;
    else if (name.indexOf('M4T') !== -1  || name.indexOf('MATRICE 4T') !== -1)                                        g.m4t  += qty;
    else if (name.indexOf('M4E') !== -1  || name.indexOf('MATRICE 4E') !== -1)                                        g.m4e  += qty;
    else if (name.indexOf('M400') !== -1 || name.indexOf('MATRICE 400') !== -1)                                       g.m400 += qty;
    else if (name.indexOf('DOCK 3') !== -1)                                                                            g.dock3 += qty;
  });
  return g;
}

// Forecast Month = Bidding Date + 2 เดือน, format "2026 Jun"
function _fmtForecastMonth(biddingDate) {
  if (!biddingDate) return '';
  var d = new Date(biddingDate);
  if (isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + 2);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getFullYear() + ' ' + months[d.getMonth()];
}

async function aiAnalyzePipeline(btn) {
  var allPipes = ST.getAll('pipeline');
  if (!allPipes.length) { toast('ยังไม่มีข้อมูล Pipeline'); return; }

  var restore = _aiBtnBusy(btn, '⏳ กำลังวิเคราะห์...');

  var statusCount = {}, statusAmt = {};
  var totalAmt = 0, biddingSoon = [];
  allPipes.forEach(function(p) {
    var s = p.status || 'unknown';
    var amt = Number(p.forecastAmount) || 0;
    statusCount[s] = (statusCount[s] || 0) + 1;
    statusAmt[s] = (statusAmt[s] || 0) + amt;
    totalAmt += amt;
    if (p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 30)
      biddingSoon.push(p.projectName || 'ไม่ระบุชื่อ');
  });

  var statusLines = Object.keys(statusCount).map(function(s) {
    return s + ': ' + statusCount[s] + ' รายการ มูลค่า ' + fmtMoneyShort(statusAmt[s] || 0);
  }).join('\n');

  var prompt = 'คุณเป็นที่ปรึกษาฝ่ายขาย B2B ช่วยวิเคราะห์สถานะ Pipeline ต่อไปนี้และให้คำแนะนำเป็นภาษาไทย:\n\n' +
    'จำนวนโครงการทั้งหมด: ' + allPipes.length + ' รายการ\n' +
    'มูลค่ารวม: ' + fmtMoneyShort(totalAmt) + '\n\n' +
    'แบ่งตาม Status:\n' + statusLines + '\n\n' +
    (biddingSoon.length ? 'โครงการที่ต้อง Bid ภายใน 30 วัน: ' + biddingSoon.join(', ') + '\n\n' : '') +
    'กรุณาสรุป: 1) จุดแข็ง 2) ความเสี่ยง 3) สิ่งที่ควรทำต่อไป (Next Action) โดยกระชับและเป็นประโยชน์';

  var result = await askGemini(prompt);
  restore();
  if (!result) return;

  openM('🤖 AI วิเคราะห์ Pipeline',
    '<div style="white-space:pre-wrap;font-size:.88rem;line-height:1.7;color:var(--text)">' + sanitize(result) + '</div>'
  );
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
  var isWon = pipeIsWon(p);
  var isLost = p.status === 'fail_lost';
  var amt = Number(p.forecastAmount) || 0;
  
  document.getElementById('pgT').textContent = '📊 ' + (p.projectName || '').substr(0, 25);

  var html = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '';
  html += '<div class="bc">';
  html += '<a onclick="go(\'pipeline\')">📊 Pipeline</a><span class="sep">›</span>';
  if (d) html += '<a onclick="go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})">' + sanitize(d.name) + '</a><span class="sep">›</span>';
  html += '<span class="cur">' + sanitize((p.projectName || '').substr(0, 35)) + '</span></div>';

  html += '<div class="card"><h2>📊 ข้อมูลโครงการ ' + (p.rowNo ? _pipeRowNoBadge(p) + ' ' : '') + '<span class="ml">';
  html += '<button class="btn bsm bs" onclick="startTimer(\'pipeline\',\'' + p.id + '\',\'' + sanitize((p.projectName || '').substr(0, 18)) + '\')">⏱️</button>';
  html += '<button class="btn bsm ' + (isPinned ? 'bw' : 'bo') + '" onclick="ST.togglePin(\'pipeline\',\'' + p.id + '\',\'' + sanitize((p.projectName || '').substr(0, 20)) + '\',\'' + (d ? d.name : '') + '\');render()">📌</button>';
  html += '<button class="btn bsm bo" onclick="showPipeExportLogFilterM(\'copyRow\',\'' + p.id + '\')">📋 Row</button>';
  html += '<button class="btn bsm bp" onclick="showPipelineM(\'' + (p.dealerId || '') + '\',\'' + p.id + '\')">✏️ แก้ไข</button>';
  html += '<button class="btn bsm bo" onclick="showTaskM(null,\'' + (p.dealerId || '') + '\',null,\'' + p.id + '\')" title="สร้าง Task ผูกกับโครงการนี้">📋 เพิ่ม Task</button>';
  html += '<button class="btn bsm bd" onclick="delPipe(\'' + p.id + '\')">🗑️</button>';
  html += '</span></h2>';
  
  html += '<div class="fr"><div><label>Project Name</label><div>' + (p.projectName ? qcopyHtml(p.projectName) : '-') + '</div></div>';
  html += '<div><label>Status</label><div>' + pipeTag(p.status) + '</div></div></div>';

  html += '<div class="fr"><div><label>🎯 Project POS (โอกาสได้งาน)</label><div>' + _pipePosBadgeHtml(p) + '</div></div>';
  html += '<div><label></label><div></div></div></div>';
  html += _pipePosPickerHtml(p);

  html += '<div class="fr"><div><label>Project ID</label><div>' + (p.projectId ? qcopyHtml(p.projectId) : '<span style="color:var(--text2)">— ยังไม่ลงทะเบียน CRM</span>') + '</div></div>';
  html += '<div><label></label><div></div></div></div>';
  
  html += '<div class="fr"><div><label>End User (TH)</label><div>' + sanitize(p.endUserTH || '-') + '</div></div>';
  html += '<div><label>End User (EN)</label><div>' + sanitize(p.endUserEN || '-') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Unit Type</label><div>' + (p.unitType || '-') + '</div></div>';
  html += '<div><label>Dealer</label><div>🏪 <strong>' + (d ? sanitize(d.name) : '-') + '</strong> ' + (d ? levelTag(d.level) : '') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>DJI Dealer</label><div>' + (p.djiDealer || '-') + '</div></div>';
  html += '<div><label>Model</label><div>' + getPipeModelSummary(p) + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Forecast Amount</label><div>' + (_gvHidden('pipeline_forecast') ? '-' : fmtMoneyStyled(p.forecastAmount)) + '</div></div>';
  html += '<div><label>Real Amount</label><div>' + (p.realAmount ? fmtMoney(p.realAmount) + ' ฿' : '-') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Register Date</label><div>' + fD(p.registerDate) + '</div></div>';
  html += '<div><label>TOR</label><div>' + (p.tor || '-') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Bidding Date</label><div>' + fD(p.biddingDate) + ' ' + (p.biddingDate ? _pipeBidDateBadge(p, isWon || isLost) : '') + '</div></div>';
  html += '<div><label>Shipment Date</label><div>' + fD(p.shipmentDate) + '</div></div></div>';
  
  html += '<div class="fr"><div><label>หนังสือแต่งตั้ง</label><div>' + (p.appointmentLetter || '-') + '</div></div>';
  html += '<div><label>งานซ้ำ</label><div>' + (p.recurring ? '✅ ใช่' : 'ไม่ใช่') + '</div></div></div>';

  var _fyS = pipeFYStatus(p);
  html += '<div class="fr"><div><label>🏛️ ปีงบประมาณ</label><div>' + (p.budgetFiscalYear ? 'ปีงบ ' + p.budgetFiscalYear : '— ไม่ระบุ') + (_fyS ? ' <span style="background:' + _fyS.c + '22;color:' + _fyS.c + ';padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">' + _fyS.e + ' ' + _fyS.t + '</span>' : '') + '</div></div>';
  html += '<div><label></label><div></div></div></div>';
  html += '<div class="fr"><div><label>🗂️ ลงทะเบียน CRM ของ DJI</label><div>' + (p.djiCrmRegistered ? '✅ ลงแล้ว' + (p.djiCrmDate ? ' (' + fD(p.djiCrmDate) + ')' : '') : '⬜ ยังไม่ลง') + '</div></div>';
  html += '<div><label>⚔️ คู่แข่ง</label><div>' + (p.hasCompetitor ? '⚠️ คาดว่ามี' + (p.competitorName ? ' — <span style="color:#f59e0b">' + sanitize(p.competitorName) + '</span> <span style="font-size:10px;color:#475569">🔒 ภายใน</span>' : '') : '— ไม่ระบุ') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>🎯 Next Action</label><div>' + pipeNextActionHtml(p, false) + '</div></div>';
  html += '<div><label>📅 Follow-up Date</label><div>' + (p.followupDate ? fD(p.followupDate) + ' ' + dlB(p.followupDate, isWon || isLost) : '-') + '</div></div></div>';
  
  if (p.remark && !_gvHidden('pipeline_notes')) html += '<div><label>Remark</label><div>' + sanitize(p.remark) + '</div></div>';
  if (p.attachments && p.attachments.length) html += '<div><label>📷 รูปแนบ</label>' + attachGalleryHtml(p.attachments) + '</div>';

  if (isWon && p.winReason) html += '<div style="margin-top:8px;padding:8px;background:#14532d;border-radius:6px"><div>✅ Win Reason:</div><div>' + sanitize(p.winReason) + (p.winNote && !_gvHidden('pipeline_notes') ? ' — ' + sanitize(p.winNote) : '') + '</div></div>';
  if (isLost && p.lossReason) html += '<div style="margin-top:8px;padding:8px;background:#7f1d1d;border-radius:6px"><div>❌ Loss Reason:</div><div>' + sanitize(p.lossReason) + (p.lossCompetitor ? ' — ชนะโดย: ' + sanitize(p.lossCompetitor) : '') + (p.lossNote && !_gvHidden('pipeline_notes') ? ' — ' + sanitize(p.lossNote) : '') + '</div></div>';

  if (isWon) html += '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">' +
    '<button class="btn bp" onclick="createSOFromPipeline(\'' + p.id + '\')">📦 สร้าง Sales Order จาก Project นี้</button>' +
    '<button class="btn bo" onclick="showCreateForecastFromPipelineM(\'' + p.id + '\')">📊 สร้าง Product Forecast จากโครงการนี้</button>' +
    '</div>';

  html += '</div>';

  // Serial ที่ผูกกับโครงการนี้ — ดึงจาก Sales Order ที่สร้างจาก pipeline นี้โดยตรง ไม่ต้องไปค้นหาแยก
  if (typeof _soItemSerials === 'function') {
    var linkedSOs = ST.getAll('salesOrders').filter(function(so) { return so.pipelineId === p.id; });
    var serialRows = [];
    linkedSOs.forEach(function(so) {
      (so.items || []).forEach(function(it) {
        _soItemSerials(it).forEach(function(sn) { serialRows.push({ so: so, model: it.model, serial: sn }); });
      });
    });
    if (serialRows.length) {
      html += '<div class="card"><h2>🔢 Serial ของโครงการนี้ (' + serialRows.length + ')</h2>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      serialRows.forEach(function(r) {
        html += '<span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:4px 10px;font-size:12px">' +
          '<span style="font-family:monospace;font-weight:700">' + sanitize(r.serial) + '</span>' +
          '<span style="color:var(--text2)">' + sanitize(r.model || '-') + '</span></span>';
      });
      html += '</div>';
      html += '<div style="margin-top:8px"><a href="#" onclick="go(\'soDetail\',{soId:\'' + linkedSOs[0].id + '\'});return false" style="font-size:12px">📄 ไปหน้า Sales Order →</a></div>';
      html += '</div>';
    }
  }

  // Task ที่ผูกกับ Pipeline นี้ — คือตัว "Next Action" ในตัวเอง (ดู pipeNextActionHtml/pipeOpenTasks ใน app.js)
  // Task ที่ยังไม่เสร็จ = โชว์เป็น Next Action ด้านบน, การ์ดนี้ list ครบทุกอัน (รวมที่เสร็จแล้ว) ไว้ดูประวัติ
  // ตั้งใจไม่ log อะไรลง pipeLog/Updates เพราะ export CSV/xlsx ดึง Update ได้แค่ 6 รายการล่าสุด ไม่อยากแย่งที่ Update จริง
  var linkedTasks = ST.getAll('tasks').filter(function(t) { return t.pipeId === p.id; });
  if (linkedTasks.length) {
    linkedTasks.sort(function(a, b) { return (b.created || '').localeCompare(a.created || ''); });
    html += '<div class="card"><h2>📋 Task ที่เกี่ยวข้อง / ประวัติ Next Action (' + linkedTasks.length + ')</h2>';
    linkedTasks.forEach(function(t) {
      var doneSteps = (t.steps || []).filter(function(s) { return s.done; }).length;
      var totalSteps = (t.steps || []).length;
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border,#334155);cursor:pointer" onclick="go(\'taskDetail\',{taskId:\'' + t.id + '\'})">';
      html += '<input type="checkbox" class="task-complete-chk" ' + (t.status === 'completed' ? 'checked' : '') + ' onclick="event.stopPropagation();toggleTaskComplete(\'' + t.id + '\', this.checked)" title="ทำเครื่องหมายเสร็จ">';
      html += '<div style="flex:1;min-width:0"><div style="font-size:13px' + (t.status === 'completed' ? ';text-decoration:line-through;color:var(--text2)' : '') + '">' + sanitize(t.title) + '</div>' +
        '<div style="font-size:10px;color:var(--text2)">' + fDT(t.created) + '</div></div>';
      if (totalSteps) html += '<span style="font-size:11px;color:var(--text2)">' + doneSteps + '/' + totalSteps + ' step</span>';
      html += sTag(t.status);
      html += '</div>';
    });
    html += '</div>';
  }

  // สรุปรายการสินค้า — ชิปตามหมวดหมู่ + ตาราง Model/QTY/มูลค่า หน้าตาเดียวกับการ์ด Forecast ตาม Dealer
  // (ดู buildFcDealerSummary ใน views-today.js) แต่สโคปแค่รายการของโครงการนี้โครงการเดียว
  html += pipeModelSummaryCardHtml(p);

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

  // Updates Timeline — ซ่อนทั้งการ์ดเลยถ้า pipeline_notes ถูกซ่อน (ปุ่มแก้ไขแต่ละรายการมี content เดิมฝัง
  // อยู่ใน onclick ด้วย ถ้าซ่อนแค่ข้อความที่โชว์แต่ยังเปิดปุ่มแก้ไขไว้ เนื้อหาจริงก็ยังหลุดออกมาทาง onclick อยู่ดี)
  if (!_gvHidden('pipeline_notes')) {
  html += '<div class="card"><h2>📝 Updates (' + logs.length + ') <span class="ml">' +
    (logs.length >= 2 ? '<button class="btn bsm bo" onclick="showMergePipeLogsM(\'' + p.id + '\')" title="รวม Update เก่าให้เหลือรายการเดียว กันไม่ให้หลุดจากช่อง Update 1-6 ตอน export">🔗 รวม Update เก่า</button> ' : '') +
    '<button class="btn bsm bp" onclick="showPipeUpdateM(\'' + p.id + '\')">➕ Update</button></span></h2>';
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
  }

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
  
  if (newStatus === 'win' || newStatus === 'contracting') {
    showWinReasonM(pipeId, newStatus); return;
  }
  if (newStatus === 'fail_lost' && old.status !== 'fail_lost') {
    showLossReasonM(pipeId); return;
  }
  
  ST.update('pipeline', pipeId, {status: newStatus});
  ST.add('pipeLog', {pipeId: pipeId, type: 'status_change', content: 'สถานะ: ' + getPipeName(old.status) + ' → ' + getPipeName(newStatus), date: _nw()});
  toast('📊 ' + getPipeName(newStatus));
  render();
}

function delPipe(id) {
  if (!confirm('ลบ Pipeline นี้?')) return;
  var p = ST.getOne('pipeline', id);
  var dealerId = p && p.dealerId;
  ST.delete('pipeline', id);
  ST.deleteWhere('pipeLog', function(l) { return l.pipeId === id; });
  if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('pipeline', id);
  toast('🗑️ ลบแล้ว');
  if (dealerId) go('dealerDetail', { dealerId: dealerId });
  else go('pipeline');
}

function copyPipeRow(pipeId, excludeTypes) {
  var p = ST.getOne('pipeline', pipeId); if (!p) return;
  // ใช้คอลัมน์ชุดเดียวกับ CSV/xlsx export (PIPE_SHEET_HEADERS) เพื่อให้วางใน Google Sheets ตรงหัวตารางเป๊ะ
  var tsv = _pipeRowFields(p, excludeTypes).join('\t');
  copyText(tsv, '📋 Copy Pipeline Row');
}

// ================================================================
// PIPELINE BOARD
// ================================================================
function rPipeBoard(el) {
  document.getElementById('pgT').textContent = '📋 Pipeline Board';
  var cfg = getConfig();
  // จำกัดตาม dealer scope (topbar picker) — โครงการที่ไม่มี dealerId (เคสหายาก) โชว์เสมอไม่กรองออก
  var dealers = scopedDealers();
  var _scopedIds = {};
  dealers.forEach(function(d) { _scopedIds[d.id] = true; });
  var allPipes = ST.getAll('pipeline').filter(function(p) { return !p.dealerId || _scopedIds[p.dealerId]; });

  var pipes = allPipes;
  if (pipeBoardDealer !== 'all') {
    pipes = pipes.filter(function(p) { return p.dealerId === pipeBoardDealer; });
  }
  if (pipeBoardFY !== 'all') {
    pipes = pipes.filter(function(p) { var fy = p.budgetFiscalYear || thaiFYFromISO(p.expectedCloseDate || p.biddingDate); return String(fy || '') === String(pipeBoardFY); });
  }

  var dealerIds = {};
  allPipes.forEach(function(p) { if (p.dealerId) dealerIds[p.dealerId] = true; });
  var pipelineDealers = dealers.filter(function(d) { return dealerIds[d.id]; });
  
  var totalFiltered = 0;
  var activeFiltered = 0;
  pipes.forEach(function(p) {
    var amt = Number(p.forecastAmount) || 0;
    totalFiltered += amt;
    if (pipeIsOpen(p)) activeFiltered += amt;
  });

  var activeStatuses = getStatusIdsByCategory('active');
  var closedStatuses = getStatusIdsByCategory('won').concat(getStatusIdsByCategory('lost'));
  
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
  h += '</select>';
  h += '<select id="pipeBoardFYSel" onchange="pipeBoardFY=this.value;render()" class="pb2-dealer-sel" style="margin-left:6px">';
  h += '<option value="all"' + (pipeBoardFY === 'all' ? ' selected' : '') + '>🏛️ ทุกปีงบ</option>';
  (function() { var cur = currentThaiFY(); for (var fy = cur + 2; fy >= cur - 2; fy--) h += '<option value="' + fy + '"' + (String(pipeBoardFY) === String(fy) ? ' selected' : '') + '>ปีงบ ' + fy + (fy === cur ? ' (ปีนี้)' : '') + '</option>'; })();
  h += '</select></div>';

  h += '<div class="pb2-stats">📊 ' + pipes.length + ' โครงการ • Active: ' + fmtMoneyStyled(activeFiltered) + ' • Total: ' + fmtMoneyStyled(totalFiltered) + '</div>';

  // ===== แถบ "ต้องโฟกัส" =====
  var focus = [], seen = {};
  pipes.forEach(function(p) {
    if (!pipeIsOpen(p)) return;
    var fu = p.followupDate ? dTo(p.followupDate) : null;
    var bd = p.biddingDate ? dTo(p.biddingDate) : null;
    var fy = pipeFYStatus(p);
    var reason = null, color = null;
    if (fu !== null && fu < 0) { reason = '📞 ติดตามเลยกำหนด ' + Math.abs(fu) + 'd'; color = '#ef4444'; }
    else if (bd !== null && bd >= 0 && bd <= 7) { reason = '🔴 Bidding ' + bd + 'd'; color = '#ef4444'; }
    else if (fy && fy.t.indexOf('เสี่ยง') === 0) { reason = '🏛️ เสี่ยงตกปีงบหน้า'; color = '#ef4444'; }
    else if (bd !== null && bd >= 0 && bd <= 30) { reason = '🟡 Bidding ' + bd + 'd'; color = '#f59e0b'; }
    if (reason && !seen[p.id]) { seen[p.id] = 1; focus.push({ p: p, reason: reason, color: color }); }
  });
  focus.sort(function(a, b) { return (a.color === '#ef4444' ? 0 : 1) - (b.color === '#ef4444' ? 0 : 1); });
  if (focus.length) {
    h += '<div class="pb2-focus"><div class="pb2-focus-hd">🎯 ต้องโฟกัส <span class="pb2-focus-cnt">' + focus.length + '</span></div><div class="pb2-focus-row">';
    focus.slice(0, 20).forEach(function(f) {
      var fd = ST.getOne('dealers', f.p.dealerId);
      h += '<div class="pb2-focus-card" style="border-left-color:' + f.color + '" onclick="go(\'pipeDetail\',{pipeId:\'' + f.p.id + '\'})">';
      h += '<div class="pb2-focus-reason" style="color:' + f.color + '">' + f.reason + '</div>';
      h += '<div class="pb2-focus-name">' + sanitize((f.p.projectName || '').substr(0, 34)) + '</div>';
      h += '<div class="pb2-focus-dealer">' + (fd ? sanitize(fd.name) : '-') + (_gvHidden('pipeline_forecast') ? '' : (' • ' + fmtMoneyShort(Number(f.p.forecastAmount) || 0))) + '</div>';
      h += '</div>';
    });
    h += '</div></div>';
  }

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
  h += '<div class="pb2-legend">💡 ลากการ์ดย้าย Status (คอม) • กดปุ่ม ⇄ บนการ์ดเพื่อย้าย (มือถือ) • กดหัวคอลัมน์เพื่อพับ</div>';

  el.innerHTML = h;
  initBoardScroll();
  initBoardDnD();
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

  // ค้างนาน (จาก activity ล่าสุด)
  var lastDate = (lastLog && lastLog.date) ? lastLog.date.split('T')[0] : (p.registerDate || '');
  var staleHTML = '';
  if (lastDate) {
    var dsl = daysBetween(lastDate, _td());
    if (dsl >= 30) staleHTML = '<div class="pb2-chip" style="color:#ef4444">⏰ ค้าง ' + dsl + 'd</div>';
    else if (dsl >= 14) staleHTML = '<div class="pb2-chip" style="color:#f59e0b">⏰ ค้าง ' + dsl + 'd</div>';
  }
  // badge ปีงบ
  var fySt = pipeFYStatus(p);
  var fyHTML = fySt ? '<div class="pb2-chip" style="color:' + fySt.c + '">' + fySt.e + ' ' + fySt.t + '</div>' : '';

  var h = '<div class="pb2-card" draggable="true" data-pipeid="' + p.id + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
  h += '<div class="pb2-card-head"><span class="pb2-card-num">#' + (idx + 1) + '</span><span class="pb2-card-title">' + sanitize((p.projectName || '').substr(0, 32)) + '</span>';
  h += '<button class="pb2-move-btn" draggable="false" title="ย้ายสถานะ" onclick="event.stopPropagation();showMoveStatusM(\'' + p.id + '\')">⇄</button></div>';
  h += '<div class="pb2-card-dealer">' + (d ? d.name : '-') + '</div>';
  if (p.model) h += '<div class="pb2-card-model">📦 ' + sanitize((p.model || '').substr(0, 20)) + (p.modelQty > 1 ? ' x' + p.modelQty : '') + '</div>';
  h += '<div class="pb2-card-amt">' + fmtMoneyStyled(amt) + '</div>';
  h += bidHTML;
  if (fyHTML || staleHTML) h += '<div class="pb2-chips">' + fyHTML + staleHTML + '</div>';
  var _naHtml = pipeNextActionHtml(p, true);
  if (_naHtml) {
    var naClass = '';
    if (p.followupDate) {
      var fd = dTo(p.followupDate);
      if (fd < 0) naClass = ' na-overdue';
      else if (fd <= 3) naClass = ' na-soon';
    }
    h += '<div class="pb2-card-na' + naClass + '" onclick="event.stopPropagation()">🎯 ' + _naHtml + '</div>';
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

// เปิดเมนูเลือกสถานะ (สำหรับมือถือ/สำรอง)
function showMoveStatusM(pipeId) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  var cfg = getConfig();
  var h = '<div style="display:flex;flex-direction:column;gap:6px">';
  cfg.pipelineStatuses.forEach(function(st) {
    var cur = p.status === st.id;
    h += '<button class="btn ' + (cur ? 'bp' : 'bo') + '" style="justify-content:flex-start;text-align:left;' + (cur ? '' : 'border-color:' + st.color + ';color:' + st.color) + '"' + (cur ? ' disabled' : '') + ' onclick="closeMForce();changePipeStatus(\'' + pipeId + '\',\'' + st.id + '\')">' + st.name + (cur ? ' • ปัจจุบัน' : '') + '</button>';
  });
  h += '</div>';
  openM('⇄ ย้ายสถานะ: ' + sanitize((p.projectName || '').substr(0, 40)), h);
}

// ต่อ drag-and-drop ย้าย Status จริง (เดิมมีแต่ draggable ไม่มี handler)
function initBoardDnD() {
  var board = document.getElementById('pb2Board');
  if (!board) return;
  var dragId = null;
  board.addEventListener('dragstart', function(e) {
    var card = e.target.closest('.pb2-card');
    if (!card) return;
    dragId = card.getAttribute('data-pipeid');
    card.classList.add('dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (_) {} }
  });
  board.addEventListener('dragend', function(e) {
    var card = e.target.closest('.pb2-card');
    if (card) card.classList.remove('dragging');
    var cols = board.querySelectorAll('.pb2-col.drag-over');
    for (var i = 0; i < cols.length; i++) cols[i].classList.remove('drag-over');
    dragId = null;
  });
  board.addEventListener('dragover', function(e) {
    var col = e.target.closest('.pb2-col[data-pipecol]');
    if (!col) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    var cols = board.querySelectorAll('.pb2-col.drag-over');
    for (var i = 0; i < cols.length; i++) if (cols[i] !== col) cols[i].classList.remove('drag-over');
    col.classList.add('drag-over');
  });
  board.addEventListener('drop', function(e) {
    var col = e.target.closest('.pb2-col[data-pipecol]');
    if (!col) return;
    e.preventDefault();
    var sid = col.getAttribute('data-pipecol');
    var id = dragId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
    col.classList.remove('drag-over');
    if (id && sid) changePipeStatus(id, sid); // จัดการ win/lost + log + render ในตัว
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
    if (['fail_lost'].indexOf(s.id) === -1) totalPipeline += amount;
    if (getStatusIdsByCategory('won').indexOf(s.id) !== -1) totalWon += amount;
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

// รวม 2 prompt() (รายละเอียด + วันนัดติดตาม) เป็น modal เดียว เห็นทั้ง 2 ช่องพร้อมกัน
function addQuickPipeFollowup(pipeId) {
  openM('📞 ตั้งนัดติดตาม', '' +
    '<div class="fg"><label>📞 รายละเอียดการติดตาม *</label><textarea id="qfu_note" rows="3"></textarea></div>' +
    dpH('qfu_date', addD(_td(), 3), 'นัดติดตามอีกครั้ง') +
    '<button class="btn bp btn-full" onclick="saveQuickPipeFollowup(\'' + pipeId + '\')">💾 บันทึก</button>');
}

function saveQuickPipeFollowup(pipeId) {
  var note = document.getElementById('qfu_note').value.trim();
  if (!note) return alert('ใส่รายละเอียดการติดตาม');
  var dueDate = dpG('qfu_date');
  ST.add('pipeLog', { pipeId: pipeId, type: 'followup', content: note + (dueDate ? ' (นัดติดตาม ' + dueDate + ')' : ''), date: _nw() });
  if (dueDate) ST.update('pipeline', pipeId, { followupDate: dueDate });
  closeMForce();
  toast('📞 บันทึกนัดติดตามแล้ว');
  render();
}

// ================================================================
// MONDAY MEETING — สรุปสำหรับประชุมกับ Ryan ทุกวันจันทร์: กี่บริษัท กี่โครงการ พยากรณ์ 3 ระดับ
// (Commit/Best Case/Weighted), เป้า H1/H2 แยกรายบริษัท (Project vs Runrate), Forecast by Model,
// Insight ที่ต้องพูดคุย — ทุกจุดกดเจาะลึกได้ ใช้ go()/openM() ปกติของแอป กด "← กลับ" (goBack, navHistory
// มาตรฐานเดิม) ไล่ย้อนกลับมาที่นี่ได้จากทุกหน้าที่กดเข้าไป (ดู mondayCompanyStats ใน utils.js)
// ================================================================
function rMondayMeeting(el) {
  document.getElementById('pgT').textContent = '🗓️ ประชุมจันทร์';
  var cfg = getConfig();
  var dealers = scopedDealers();
  window._mondayStats = {};
  dealers.forEach(function(d) { window._mondayStats[d.id] = mondayCompanyStats(d.id, cfg); });

  var allActive = [], allHigh = [], allMid = [], allLow = [], allStale = [];
  var openTotal = 0, weightedTotal = 0;
  dealers.forEach(function(d) {
    var s = window._mondayStats[d.id];
    allActive = allActive.concat(s.activePipes);
    allHigh = allHigh.concat(s.high);
    allMid = allMid.concat(s.mid);
    allLow = allLow.concat(s.low);
    allStale = allStale.concat(s.stalePipes);
    openTotal += s.openPipelineTotal;
    weightedTotal += s.openPipelineWeighted;
  });
  var commitAmt = allHigh.reduce(function(s, p) { return s + (Number(p.forecastAmount) || 0); }, 0);
  var bestAmt = commitAmt + allMid.reduce(function(s, p) { return s + (Number(p.forecastAmount) || 0); }, 0);
  var expWins = allActive.reduce(function(s, p) { return s + ((p._pos || 0) / 100); }, 0);
  var overdueDays = (typeof DEALER_VISIT_OVERDUE_DAYS !== 'undefined') ? DEALER_VISIT_OVERDUE_DAYS : 60;
  var overdueDealers = dealers.filter(function(d) { var lv = window._mondayStats[d.id].lastVisitDays; return lv === null || lv > overdueDays; });

  // allActive = เฉพาะโครงการที่ยังไม่ตัดสิน (ไม่ใช่ won-category) ใช้กับ POS/3-tier เท่านั้น — แต่ Quarter/Delay/
  // Waiting ต้องเห็น "รอเซ็นสัญญา" (contracting) / "รอดำเนินการหลังชนะ" (win) ด้วย เลยต้องใช้ชุดกว้างกว่านั้น
  // (pipeIsOpen = ยังไม่ Lost และยังไม่ Deliver) แยกต่างหาก
  var allInProgress = [];
  dealers.forEach(function(d) { allInProgress = allInProgress.concat(ST.pipelineByDealer(d.id).filter(pipeIsOpen)); });

  var h = '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:14px">' +
    '<div><h2 style="margin:0">🗓️ ประชุมจันทร์ — สรุป Pipeline</h2><div style="font-size:12px;color:var(--text2)">ข้อมูล ณ ' + fD(_td()) + (cfg.saleName ? ' · ' + sanitize(cfg.saleName) : '') + '</div></div>' +
    '<div style="display:flex;gap:6px"><button class="btn bo" onclick="go(\'posCalibration\')">🎯 POS Calibration</button><button class="btn bo" onclick="copyMondaySummary()">📋 คัดลอกสรุปทั้งหมด</button></div>' +
    '</div>';

  // Sticky quick-nav — ข้อมูลยาวเลื่อนหาลำบาก กดชิพกระโดดตรงไปแต่ละส่วนได้เลย ไม่ต้องเลื่อนเอง (top:50px กัน
  // ทับกับ .topbar ของแอปที่ sticky top:0 อยู่แล้ว)
  h += '<div style="position:sticky;top:50px;z-index:20;background:var(--bg);margin:0 -12px 10px;padding:8px 12px;border-bottom:1px solid var(--border)">' +
    '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px" id="mondayQuickNav">' +
    [['sec-tier', '📐 พยากรณ์'], ['sec-pos', '🎯 POS'], ['sec-model', '📦 Model'], ['sec-quarter', '📆 ไตรมาสนี้'], ['sec-delay', '🐢 ดีเลย์'], ['sec-waiting', '📌 สถานะ'], ['sec-company', '🏢 บริษัท'], ['sec-insight', '💡 Insight']].map(function(n) {
      return '<div onclick="document.getElementById(\'' + n[0] + '\').scrollIntoView({behavior:\'smooth\',block:\'start\'})" style="flex-shrink:0;cursor:pointer;font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;background:var(--bg2);border:1px solid var(--border);color:var(--text2);white-space:nowrap">' + n[1] + '</div>';
    }).join('') + '</div></div>';

  h += '<div class="card" style="padding:10px 14px"><div style="font-size:11px;color:var(--text2);margin-bottom:6px">🔎 ดูสรุปแยกรายบริษัท</div><div style="display:flex;gap:6px;flex-wrap:wrap">' +
    dealers.slice().sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); }).map(function(d) {
      return '<span onclick="go(\'mondayCompany\',{dealerId:\'' + d.id + '\'})" style="cursor:pointer;font-size:12px;padding:5px 12px;border-radius:999px;background:var(--bg2);border:1px solid var(--border);font-weight:600">' + sanitize(d.name) + '</span>';
    }).join('') + '</div></div>';

  h += '<div class="sr" style="margin-bottom:12px">' +
    '<div class="sc"><div class="sn c1" id="mondayCnt1">0</div><div class="sl">บริษัทที่ดูแล</div></div>' +
    '<div class="sc"><div class="sn c1" id="mondayCnt2">0</div><div class="sl">โครงการเปิดอยู่</div></div>' +
    '<div class="sc"><div class="sn c2" id="mondayCnt3">฿0</div><div class="sl">มูลค่า Pipeline รวม</div></div>' +
    '<div class="sc"><div class="sn c5" id="mondayCnt4">0</div><div class="sl">โครงการมั่นใจสูง</div></div>' +
    '<div class="sc"><div class="sn c2" id="mondayCnt5">~0</div><div class="sl">คาดว่าจะปิดได้ (โครงการ)</div></div>' +
    '</div>';

  // 3-tier forecast
  var rangeMax = Math.max(bestAmt, openTotal, 1) * 1.05;
  h += '<div class="card" id="sec-tier"><h2>📐 พยากรณ์ยอดขาย 3 ระดับ</h2>' +
    '<div style="font-size:11px;color:var(--text2);margin-bottom:10px">แทนตัวเลขเดียวที่เหวี่ยงง่าย — แต่ละโครงการได้ทั้งหมดหรือ 0 จริงๆ ไม่มีทางได้ตามเปอร์เซ็นต์ Commit/Best Case เลยนับมูลค่าเต็มของกลุ่มความเชื่อมั่นแทน กดแต่ละกล่องดูรายชื่อโครงการได้</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">' +
    '<div style="cursor:pointer;border-radius:11px;padding:12px;background:var(--good-bg,rgba(34,197,94,.12));border:1px solid #22c55e" onclick="showPosBucketM(\'high\')"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#22c55e">🎯 Commit</div><div style="font-size:20px;font-weight:800;color:#22c55e">฿' + fmtMoneyShort(commitAmt) + '</div><div style="font-size:10.5px;color:#22c55e">' + allHigh.length + ' โครงการ POS ≥70%</div></div>' +
    '<div style="cursor:pointer;border-radius:11px;padding:12px;background:var(--accent-light,rgba(59,130,246,.1));border:1px solid var(--accent)" onclick="showPosBucketM(\'bestcase\')"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--accent)">📈 Best Case</div><div style="font-size:20px;font-weight:800;color:var(--accent)">฿' + fmtMoneyShort(bestAmt) + '</div><div style="font-size:10.5px;color:var(--accent)">Commit + POS 40-69%</div></div>' +
    '<div style="cursor:pointer;border-radius:11px;padding:12px;background:var(--bg2);border:1px dashed var(--border)" onclick="showPosBucketM(\'all\')"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text2)">📊 Weighted</div><div style="font-size:20px;font-weight:800;color:var(--text2)">฿' + fmtMoneyShort(weightedTotal) + '</div><div style="font-size:10.5px;color:var(--text2)">มูลค่า × POS ทุกโครงการ</div></div>' +
    '</div>';
  h += '<div style="position:relative;height:22px;background:var(--bg2);border-radius:7px;overflow:hidden;margin-bottom:4px">' +
    '<div style="position:absolute;left:0;top:0;height:100%;background:#22c55e;opacity:.85;width:' + (commitAmt / rangeMax * 100) + '%"></div>' +
    '<div style="position:absolute;top:0;height:100%;background:repeating-linear-gradient(45deg,var(--accent),var(--accent) 6px,transparent 6px,transparent 12px);opacity:.35;left:' + (commitAmt / rangeMax * 100) + '%;width:' + ((bestAmt - commitAmt) / rangeMax * 100) + '%"></div>' +
    '<div style="position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--text);left:' + (weightedTotal / rangeMax * 100) + '%" title="Weighted ฿' + fmtMoneyShort(weightedTotal) + '"></div>' +
    '</div><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text2)"><span>฿0</span><span>◆ Weighted</span><span>฿' + fmtMoneyShort(rangeMax) + '</span></div></div>';

  // POS bucket detail
  h += '<div class="card" id="sec-pos"><h2>🎯 โอกาสได้งาน แบ่งตามระดับ POS</h2>';
  [['high', allHigh, 'สูง (≥70%)', '#22c55e'], ['mid', allMid, 'กลาง (40-69%)', '#f59e0b'], ['low', allLow, 'ต่ำ (<40%)', '#ef4444']].forEach(function(b) {
    var amt = b[1].reduce(function(s, p) { return s + (Number(p.forecastAmount) || 0); }, 0);
    var pct = openTotal ? Math.round(amt / openTotal * 100) : 0;
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;cursor:pointer" onclick="showPosBucketM(\'' + b[0] + '\')">' +
      '<div style="width:110px;flex-shrink:0;font-size:12px;font-weight:600">' + b[2] + '</div>' +
      '<div style="flex:1;height:18px;background:var(--bg2);border-radius:5px;overflow:hidden"><div style="height:100%;background:' + b[3] + ';width:' + pct + '%;display:flex;align-items:center;padding-left:6px;font-size:10px;font-weight:700;color:#fff;white-space:nowrap">' + b[1].length + ' โครงการ</div></div>' +
      '<div style="width:80px;text-align:right;font-size:11px;color:var(--text2)">฿' + fmtMoneyShort(amt) + '</div></div>';
  });
  h += '</div>';

  h += rMondayForecastByModelHtml(allActive);
  h += rMondayQuarterHtml(allInProgress);
  h += rMondayDelayHtml(allInProgress);
  h += rMondayWaitingHtml(allInProgress);

  // company table
  var companyRows = dealers.filter(function(d) { var s = window._mondayStats[d.id]; return s.activePipes.length || s.wonPipes.length; });
  var LONG_LIST_THRESHOLD = 10;
  h += '<div class="card" id="sec-company"><h2>🏢 สรุปรายบริษัท' +
    (companyRows.length > 4 ? '<span class="ml"><select style="width:auto;font-size:11px;padding:3px 6px" onchange="mondaySortList(\'mondayCompanyList\',this.value)"><option value="amt_desc">เรียง: มูลค่ามาก→น้อย</option><option value="weighted_desc">เรียง: Weighted มาก→น้อย</option><option value="name_asc">เรียง: ชื่อ ก-ฮ</option></select></span>' : '') +
    '</h2>';
  if (companyRows.length > LONG_LIST_THRESHOLD) {
    h += '<input type="text" placeholder="🔍 ค้นหาชื่อบริษัท..." style="margin-bottom:8px" oninput="mondayListSearch(\'mondayCompanyList\',this.value)">' +
      '<div style="font-size:11px;color:var(--text2);margin-bottom:8px" id="mondayCompanyListMeta"></div>';
  }
  h += '<div id="mondayCompanyList">';
  companyRows.sort(function(a, b) { return window._mondayStats[b.id].openPipelineTotal - window._mondayStats[a.id].openPipelineTotal; }).forEach(function(d) {
    var s = window._mondayStats[d.id];
    var lvlCls = d.level === 'SAB' ? 'good' : (d.level === 'Authorized' || d.level === 'A' || d.level === 'B') ? 'accent' : 'text3';
    var initials = (d.name || '').trim().split(/\s+/).slice(0, 2).map(function(w) { return w.charAt(0); }).join('').toUpperCase() || '?';
    h += '<div class="li" data-amt="' + s.openPipelineTotal + '" data-weighted="' + s.openPipelineWeighted + '" data-name="' + sanitize(d.name).toLowerCase() + '" onclick="go(\'mondayCompany\',{dealerId:\'' + d.id + '\'})" style="cursor:pointer;display:flex;align-items:center;gap:10px;position:relative;overflow:hidden;border-left:4px solid var(--' + lvlCls + ',var(--accent))">' +
      '<div style="width:34px;height:34px;border-radius:50%;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:var(--accent);flex-shrink:0">' + sanitize(initials) + '</div>' +
      '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(d.name) + '</div><div style="font-size:11px;color:var(--text2)">' + levelTag(d.level) + ' · ' + s.activePipes.length + ' โครงการ</div></div>' +
      '<div style="text-align:right;flex-shrink:0"><div style="font-weight:700;font-size:13px">฿' + fmtMoneyShort(s.openPipelineTotal) + '</div><div style="font-size:10.5px;color:var(--accent)">Weighted ฿' + fmtMoneyShort(s.openPipelineWeighted) + '</div></div>' +
      '</div>';
  });
  h += '</div>';
  if (companyRows.length > LONG_LIST_THRESHOLD) h += '<button type="button" class="btn bo btn-full" id="mondayCompanyListMore" onclick="mondayListMore(\'mondayCompanyList\')" style="margin-top:6px">⬇️ แสดงเพิ่ม</button>';
  h += '</div>';

  h += rMondayInsightsHtml(dealers, allActive, allStale, overdueDealers, overdueDays);

  el.innerHTML = h;

  // ตัวเลข stat tile นับขึ้น + เปิดใช้ค้นหา/แสดงเพิ่มสำหรับ list ที่อาจยาว (เรียกหลัง innerHTML เซ็ตแล้วเท่านั้น
  // element ถึงจะมีอยู่จริงใน DOM)
  mondayCountUp('mondayCnt1', dealers.length);
  mondayCountUp('mondayCnt2', allActive.length);
  mondayCountUp('mondayCnt3', openTotal, function(v) { return '฿' + fmtMoneyShort(v); });
  mondayCountUp('mondayCnt4', allHigh.length);
  mondayCountUp('mondayCnt5', expWins, function(v) { return '~' + v.toFixed(1); });
  mondayListSetup('mondayQuarterList', 10);
  mondayListSetup('mondayDelayList', 10);
  mondayListSetup('mondayCompanyList', 10);
}

// Forecast by Model (this month / next month) — ใช้ร่วมกันทั้งหน้าสรุปรวม (pipes = ทุกบริษัท) และหน้ารายบริษัท
// chip กรองหมวดสินค้า (🚁 Drone ฯลฯ) เฉพาะการ์ด Forecast by Model ของหน้าประชุมจันทร์ — คำนวณจาก buckets
// เดือนนี้/เดือนหน้าที่มีอยู่แล้ว ไม่ query ซ้ำ, ใช้ fcCatIsVisible/fcToggleCatFilter/fcResetCatFilter ตัวเดียวกับ
// หน้า Forecast เต็ม (window.mondayFcCatFilter) เพื่อไม่ให้มีกลไกกรองซ้ำซ้อนสองระบบ
function _mondayFcCatChipsHtml(buckets, curKey, nextKey) {
  var cats = {};
  [curKey, nextKey].forEach(function(key) {
    Object.keys(buckets[key]).forEach(function(m) {
      var cat = getModelCategory(m);
      if (!cats[cat]) cats[cat] = 0;
      cats[cat] += buckets[key][m].qty;
    });
  });
  var ids = Object.keys(cats);
  if (!ids.length) return '';
  var order = (typeof PRODUCT_CATEGORIES !== 'undefined') ? PRODUCT_CATEGORIES.map(function(c) { return c.id; }) : ids;
  ids.sort(function(a, b) { return order.indexOf(a) - order.indexOf(b); });
  var hasFilter = window.mondayFcCatFilter && Object.keys(window.mondayFcCatFilter).length > 0;
  var h = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center">';
  ids.forEach(function(id) {
    var name = (typeof getCategoryName === 'function') ? getCategoryName(id) : id;
    var isOn = fcCatIsVisible('mondayFcCatFilter', id);
    h += '<div style="border-radius:999px;padding:5px 11px;font-size:11.5px;font-weight:600;cursor:pointer' +
      (isOn ? ';border:2px solid var(--accent,#3b82f6);color:var(--accent)' : ';border:1px solid var(--border);color:var(--text2);opacity:.5') +
      '" onclick="fcToggleCatFilter(\'mondayFcCatFilter\',\'' + id + '\')">' + name + ' <span style="opacity:.7">(' + cats[id] + ')</span></div>';
  });
  if (hasFilter) h += '<button class="btn bsm bo" onclick="fcResetCatFilter(\'mondayFcCatFilter\')">✕ แสดงทั้งหมด</button>';
  h += '</div>';
  return h;
}
function rMondayForecastByModelHtml(pipes) {
  var curKey = fcMonthKey(0), nextKey = fcMonthKey(1);
  var buckets = {}; buckets[curKey] = {}; buckets[nextKey] = {};
  pipes.forEach(function(p) {
    var ship = getPipeShipDate(p);
    if (!ship) return;
    var key = ship.date.getFullYear() + '-' + (ship.date.getMonth() + 1 < 10 ? '0' : '') + (ship.date.getMonth() + 1);
    if (key !== curKey && key !== nextKey) return;
    getPipeItems(p).forEach(function(it) {
      if (!buckets[key][it.model]) buckets[key][it.model] = { qty: 0, pipes: {} };
      buckets[key][it.model].qty += Number(it.qty) || 1;
      buckets[key][it.model].pipes[p.id] = p;
    });
  });
  var curModelsAll = Object.keys(buckets[curKey]);
  var curModels = curModelsAll.filter(function(m) { return fcCatIsVisible('mondayFcCatFilter', getModelCategory(m)); });
  var curProjects = {}; curModels.forEach(function(m) { Object.keys(buckets[curKey][m].pipes).forEach(function(pid) { curProjects[pid] = true; }); });
  var curQty = curModels.reduce(function(s, m) { return s + buckets[curKey][m].qty; }, 0);
  var h = '<div class="card" id="sec-model"><h2>📦 สินค้าที่คาดว่าจะออกเดือนนี้/เดือนหน้า <span class="ml"><button class="btn bsm bo" onclick="go(\'forecast\')">🔗 ดู Forecast แบบเต็ม</button></span></h2>' +
    '<div style="font-size:11px;color:var(--text2);margin-bottom:8px">สรุปสั้นๆ เฉพาะเดือนนี้/เดือนหน้า — อยากกรอง/เรียง/ดูรายเดือน-รายไตรมาสเต็มรูปแบบ กดปุ่มด้านบนไปเมนู Forecast โดยตรง</div>' +
    _mondayFcCatChipsHtml(buckets, curKey, nextKey) +
    '<div style="font-size:12.5px;font-weight:600;background:var(--bg2);border-radius:8px;padding:8px 10px;margin-bottom:10px">เดือนนี้: ' + Object.keys(curProjects).length + ' โครงการ · ' + curModels.length + ' รุ่นสินค้า · รวม ' + curQty + ' ชิ้น</div>';
  [[curKey, 'เดือนนี้'], [nextKey, 'เดือนหน้า']].forEach(function(mk) {
    var key = mk[0], label = fcMonthLabel(key) + ' (' + mk[1] + ')';
    var models = Object.keys(buckets[key]).filter(function(m) { return fcCatIsVisible('mondayFcCatFilter', getModelCategory(m)); });
    h += '<div style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--accent-light);color:var(--accent);display:inline-block;margin-bottom:6px">' + label + '</div>';
    if (!models.length) { h += '<div style="font-size:12px;color:var(--text2);padding:6px 0 10px">ยังไม่มีกำหนดส่งมอบเดือนนี้</div>'; return; }
    h += '<div style="overflow-x:auto;margin-bottom:10px"><table style="width:100%;border-collapse:collapse;font-size:12.5px">' +
      '<tr><th style="text-align:left;padding:5px 8px;font-size:10.5px;color:var(--text2);border-bottom:1px solid var(--border)">Model</th><th style="text-align:right;padding:5px 8px;font-size:10.5px;color:var(--text2);border-bottom:1px solid var(--border)">จำนวน</th><th style="text-align:left;padding:5px 8px;font-size:10.5px;color:var(--text2);border-bottom:1px solid var(--border)">โครงการ</th></tr>';
    models.forEach(function(m) {
      var b = buckets[key][m];
      var pipeList = Object.keys(b.pipes).map(function(k) { return b.pipes[k]; });
      var names = pipeList.map(function(p) { var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null; return (d ? d.name + ' — ' : '') + (p.projectName || ''); }).join(', ');
      h += '<tr' + (pipeList.length === 1 ? ' onclick="go(\'pipeDetail\',{pipeId:\'' + pipeList[0].id + '\'})" style="cursor:pointer"' : '') + '>' +
        '<td style="padding:6px 8px;border-bottom:1px solid var(--border-light)">' + sanitize(m) + '</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid var(--border-light);text-align:right">' + b.qty + '</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid var(--border-light);font-size:11.5px;color:var(--text2)">' + sanitize(names) + '</td></tr>';
    });
    h += '</table></div>';
  });
  h += '</div>';
  return h;
}

// โครงการที่คาดว่าจะปิด (Expected Close หรือ Bidding ถ้ายังไม่กำหนด) อยู่ในไตรมาสปฏิทินนี้ — "which project,
// check status, progress within this quarter" ที่ Ryan ถามตรงๆ
function rMondayQuarterHtml(pipes) {
  var q = mondayQuarterRange();
  var cfg = getConfig();
  var list = pipes.filter(function(p) {
    var d = p.expectedCloseDate || p.biddingDate;
    return d && d >= q.start && d <= q.end;
  });
  list.sort(function(a, b) { return (a.expectedCloseDate || a.biddingDate || '').localeCompare(b.expectedCloseDate || b.biddingDate || ''); });
  var h = '<div class="card" id="sec-quarter"><h2>📆 โครงการในไตรมาสนี้ (' + q.label + ')' +
    (list.length > 4 ? '<span class="ml"><select style="width:auto;font-size:11px;padding:3px 6px" onchange="mondaySortList(\'mondayQuarterList\',this.value)"><option value="date_asc">เรียง: วันที่ใกล้สุด</option><option value="amt_desc">เรียง: มูลค่ามาก→น้อย</option></select></span>' : '') +
    '</h2><div style="font-size:11px;color:var(--text2);margin-bottom:8px">กรองจาก Expected Close Date (หรือ Bidding Date ถ้ายังไม่กำหนด) — ' + list.length + ' โครงการ</div>';
  if (list.length > 10) h += '<input type="text" placeholder="🔍 ค้นหาชื่อโครงการ/บริษัท..." style="margin-bottom:8px" oninput="mondayListSearch(\'mondayQuarterList\',this.value)"><div style="font-size:11px;color:var(--text2);margin-bottom:8px" id="mondayQuarterListMeta"></div>';
  h += '<div id="mondayQuarterList">';
  list.forEach(function(p) {
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    var statusName = ((cfg.pipelineStatuses || []).find(function(x) { return x.id === p.status; }) || {}).name || p.status;
    var dateShown = p.expectedCloseDate || p.biddingDate;
    h += '<div class="li" data-amt="' + (Number(p.forecastAmount) || 0) + '" data-date="' + (dateShown || '') + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize((p.rowNo ? p.rowNo + ' ' : '') + (p.projectName || '')) + '</div><div class="ls">' + sanitize(d ? d.name : '-') + ' · ' + sanitize(statusName) + ' · ' + fDShort(dateShown) + ' · ฿' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</div></div></div>';
  });
  h += '</div>';
  if (list.length > 10) h += '<button type="button" class="btn bo btn-full" id="mondayQuarterListMore" onclick="mondayListMore(\'mondayQuarterList\')" style="margin-top:6px">⬇️ แสดงเพิ่ม</button>';
  if (!list.length) h += '<div class="empty"><p>ไม่มีโครงการคาดว่าจะปิดในไตรมาสนี้</p></div>';
  h += '</div>';
  return h;
}

// โครงการที่วันที่ตั้งไว้ (Bidding/Expected Close/Shipment) ผ่านมาแล้วแต่ยังไม่ Win/Lost — "delay, why delay"
// เหตุผล: ระบบไม่มีฟิลด์ "เหตุผลดีเลย์" แยกต่างหาก ใช้บันทึกล่าสุดใน Pipeline Log แทนไปก่อน (ถ้า sale เคยพิมพ์
// เหตุผลไว้ตอนอัพเดตแล้วจะเห็นตรงนี้อัตโนมัติ)
function rMondayDelayHtml(pipes) {
  var rows = [];
  pipes.forEach(function(p) {
    var delays = mondayDelayInfo(p);
    if (delays.length) rows.push({ p: p, delays: delays });
  });
  rows.sort(function(a, b) {
    var maxA = Math.max.apply(null, a.delays.map(function(x) { return x.days; }));
    var maxB = Math.max.apply(null, b.delays.map(function(x) { return x.days; }));
    return maxB - maxA;
  });
  var h = '<div class="card" id="sec-delay"><h2>🐢 โครงการดีเลย์' +
    (rows.length > 4 ? '<span class="ml"><select style="width:auto;font-size:11px;padding:3px 6px" onchange="mondaySortList(\'mondayDelayList\',this.value)"><option value="days_desc">เรียง: ดีเลย์นานสุด</option><option value="amt_desc">เรียง: มูลค่ามาก→น้อย</option></select></span>' : '') +
    '</h2><div style="font-size:11px;color:var(--text2);margin-bottom:8px">วันที่ตั้งไว้ผ่านมาแล้วแต่ยังไม่ Win/Lost — ' + rows.length + ' โครงการ</div>';
  if (rows.length > 10) h += '<input type="text" placeholder="🔍 ค้นหาชื่อโครงการ/บริษัท..." style="margin-bottom:8px" oninput="mondayListSearch(\'mondayDelayList\',this.value)"><div style="font-size:11px;color:var(--text2);margin-bottom:8px" id="mondayDelayListMeta"></div>';
  h += '<div id="mondayDelayList">';
  rows.forEach(function(r) {
    var p = r.p;
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    var delayText = r.delays.map(function(x) { return x.label + ' ล่าช้า ' + x.days + ' วัน'; }).join(', ');
    var maxDays = Math.max.apply(null, r.delays.map(function(x) { return x.days; }));
    h += '<div class="li" data-amt="' + (Number(p.forecastAmount) || 0) + '" data-days="' + maxDays + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize((p.rowNo ? p.rowNo + ' ' : '') + (p.projectName || '')) + '</div>' +
      '<div class="ls" style="color:#ef4444">⏰ ' + delayText + '</div>' +
      '<div class="ls">' + sanitize(d ? d.name : '-') + (lastLog ? ' · เหตุผลล่าสุด: ' + sanitize((lastLog.content || '').substr(0, 60)) : ' · ยังไม่มีบันทึกเหตุผล') + '</div></div></div>';
  });
  h += '</div>';
  if (rows.length > 10) h += '<button type="button" class="btn bo btn-full" id="mondayDelayListMore" onclick="mondayListMore(\'mondayDelayList\')" style="margin-top:6px">⬇️ แสดงเพิ่ม</button>';
  if (!rows.length) h += '<div class="empty"><p>ไม่มีโครงการดีเลย์ ✅</p></div>';
  h += '</div>';
  return h;
}

// สถานะโครงการ — กำลังรออะไรอยู่ (ต่อยอดจาก status จริงของ pipeline ไม่ได้เพิ่มฟิลด์ใหม่)
var MONDAY_STATUS_WAIT_LABEL = {
  initial: 'รอยืนยันงบ/ความสนใจเบื้องต้น', on_process: 'รอเจรจา/ปรับสเปค', draft_tor: 'รอ TOR ประกาศ/ยืนยันงบ',
  bidding: 'รอผลประมูล', win: 'รอดำเนินการหลังชนะ', contracting: 'รอเซ็นสัญญา', deliver: 'รอส่งมอบ'
};
function rMondayWaitingHtml(pipes) {
  var cfg = getConfig();
  var groups = {};
  pipes.forEach(function(p) { if (!groups[p.status]) groups[p.status] = []; groups[p.status].push(p); });
  var statusOrder = (cfg.pipelineStatuses || []).map(function(s) { return s.id; });
  var h = '<div class="card" id="sec-waiting"><h2>📌 สถานะโครงการ — กำลังรออะไรอยู่</h2>';
  var any = false;
  statusOrder.forEach(function(sid) {
    var list = groups[sid];
    if (!list || !list.length) return;
    any = true;
    var name = ((cfg.pipelineStatuses || []).find(function(x) { return x.id === sid; }) || {}).name || sid;
    var waitLabel = MONDAY_STATUS_WAIT_LABEL[sid] || 'รอดำเนินการขั้นถัดไป';
    var amt = list.reduce(function(s, p) { return s + (Number(p.forecastAmount) || 0); }, 0);
    h += '<div onclick="showMondayStatusM(\'' + sid + '\')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid var(--border-light)">' +
      '<div><b style="font-size:12.5px">' + sanitize(name) + '</b><div style="font-size:11px;color:var(--text2)">' + waitLabel + '</div></div>' +
      '<div style="text-align:right"><div style="font-weight:700;font-size:13px">' + list.length + ' โครงการ</div><div style="font-size:11px;color:var(--text2)">฿' + fmtMoneyShort(amt) + '</div></div></div>';
  });
  if (!any) h += '<div class="empty"><p>ไม่มีโครงการเปิดอยู่</p></div>';
  h += '</div>';
  return h;
}
function showMondayStatusM(statusId) {
  var _scopedIds = {};
  scopedDealers().forEach(function(d) { _scopedIds[d.id] = true; });
  var list = ST.getAll('pipeline').filter(function(p) { return pipeIsOpen(p) && p.status === statusId && (!p.dealerId || _scopedIds[p.dealerId]); });
  var cfg = getConfig();
  var name = ((cfg.pipelineStatuses || []).find(function(x) { return x.id === statusId; }) || {}).name || statusId;
  var rows = '';
  var dealerOpts = {};
  list.forEach(function(p) {
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    if (d) dealerOpts[d.id] = d.name;
    rows += '<div class="li" data-dealer="' + (p.dealerId || '') + '" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize((p.rowNo ? p.rowNo + ' ' : '') + (p.projectName || '')) + '</div><div class="ls">' + sanitize(d ? d.name : '-') + ' · ฿' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</div></div></div>';
  });
  if (!list.length) rows = '<div class="empty"><p>ไม่มี</p></div>';
  var facets = _mondayFacetSelectHtml('mondayStatusList', 'mondayListFilterDealer', '🏢 บริษัท', Object.keys(dealerOpts).map(function(id) { return { value: id, text: dealerOpts[id] }; }).sort(function(a, b) { return a.text.localeCompare(b.text, 'th'); }));
  var h = '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">' + list.length + ' โครงการ</div>' + mondayModalListWrapHtml('mondayStatusList', rows, list.length, facets);
  openM('📌 ' + name, h);
  if (list.length > 10) mondayListSetup('mondayStatusList', 10);
}

// เรียงลำดับ list/table ยาวๆ ในหน้าประชุมจันทร์ — จัดเรียง DOM node ที่มีอยู่แล้วตรงๆ (data-amt/data-date/
// data-days/data-weighted/data-name บนแต่ละแถว) ไม่ rebuild HTML ใหม่ ใช้ pattern เดียวกับ pipePickerSort
// ในฟอร์ม Visit — containerId เป็นได้ทั้ง <div> (list การ์ด) หรือ <tbody> (ตารางบริษัท)
function mondaySortList(containerId, mode) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var items = Array.prototype.slice.call(container.children);
  items.sort(function(a, b) {
    if (mode === 'amt_desc') return (Number(b.dataset.amt) || 0) - (Number(a.dataset.amt) || 0);
    if (mode === 'weighted_desc') return (Number(b.dataset.weighted) || 0) - (Number(a.dataset.weighted) || 0);
    if (mode === 'date_asc') return (a.dataset.date || '').localeCompare(b.dataset.date || '');
    if (mode === 'days_desc') return (Number(b.dataset.days) || 0) - (Number(a.dataset.days) || 0);
    if (mode === 'name_asc') return (a.dataset.name || '').localeCompare(b.dataset.name || '');
    return 0;
  });
  items.forEach(function(el) { container.appendChild(el); });
  // เรียงใหม่แล้วเริ่มแบ่งหน้าใหม่ตามลำดับล่าสุด (ล้างช่องค้นหาที่พิมพ์ค้างไว้ด้วย กันสับสนว่าทำไม list ไม่ตรง)
  if (container.dataset.pageSize) {
    var searchEl = document.getElementById(containerId + 'Search');
    if (searchEl) searchEl.value = '';
    mondayListSetup(containerId, parseInt(container.dataset.pageSize, 10));
  }
}

// ================================================================
// LIST ยาว (ไตรมาสนี้/ดีเลย์/บริษัท อาจมีเป็นสิบๆ ร้อยรายการ) — ค้นหา + "แสดงเพิ่ม" ทีละหน้า แทนที่จะโชว์
// ทั้งหมดพร้อมกันแล้วต้องเลื่อนหาเอง ทำงานบน DOM ตรงๆ (เหมือน mondaySortList) ไม่ต้องเก็บ array แยกต่างหาก
// เรียก mondayListSetup() ครั้งเดียวหลัง render เสร็จ (เฉพาะ container ที่แถวเกิน threshold ถึงจะมีช่องค้นหา/
// ปุ่มแสดงเพิ่มโผล่ในโค้ด HTML อยู่แล้ว — ฟังก์ชันนี้แค่ทำให้มันทำงานจริง)
// ================================================================
function mondayListSetup(containerId, pageSize) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.dataset.pageSize = pageSize;
  container.dataset.shown = pageSize;
  container.dataset.query = '';
  container.dataset.dealerFilter = '';
  container.dataset.statusFilter = '';
  var rows = Array.prototype.slice.call(container.children);
  rows.forEach(function(r, i) { r.style.display = i < pageSize ? '' : 'none'; });
  mondayListUpdateMeta(containerId, rows.length, Math.min(pageSize, rows.length));
}
// รองรับ "กรองซ้อน" (dealer + status + คำค้น พร้อมกันได้) — data-dealer/data-status เป็น attribute ที่แต่ละแถว
// ต้องใส่ไว้เอง (ดู showPosBucketM/showStalePipesM/showMondayStatusM) ถ้าไม่ใส่ก็แค่ไม่กรองมิตินั้น ไม่พัง
function mondayListMatched(containerId) {
  var container = document.getElementById(containerId);
  var query = (container.dataset.query || '').toLowerCase();
  var dealerF = container.dataset.dealerFilter || '';
  var statusF = container.dataset.statusFilter || '';
  return Array.prototype.filter.call(container.children, function(r) {
    if (dealerF && r.dataset.dealer !== dealerF) return false;
    if (statusF && r.dataset.status !== statusF) return false;
    return !query || (r.textContent || '').toLowerCase().indexOf(query) !== -1;
  });
}
// ใช้ร่วมกันหลังเปลี่ยนตัวกรองมิติไหนก็ตาม (คำค้น/dealer/status) — รีเซ็ตกลับไปหน้า 1 เสมอกันโชว์ผลลัพธ์
// เพี้ยนจากรายการหน้าก่อนที่ยังค้างโชว์อยู่
function _mondayListApplyFilter(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var pageSize = parseInt(container.dataset.pageSize, 10) || 10;
  var all = Array.prototype.slice.call(container.children);
  var matched = mondayListMatched(containerId);
  all.forEach(function(r) { r.style.display = 'none'; });
  matched.slice(0, pageSize).forEach(function(r) { r.style.display = ''; });
  container.dataset.shown = Math.min(pageSize, matched.length);
  mondayListUpdateMeta(containerId, matched.length, Math.min(pageSize, matched.length));
}
function mondayListSearch(containerId, query) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.dataset.query = query || '';
  _mondayListApplyFilter(containerId);
}
function mondayListFilterDealer(containerId, dealerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.dataset.dealerFilter = dealerId || '';
  _mondayListApplyFilter(containerId);
}
function mondayListFilterStatus(containerId, status) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.dataset.statusFilter = status || '';
  _mondayListApplyFilter(containerId);
}
// สร้าง <select> กรองแยกตาม Dealer/Status จากค่าจริงที่มีอยู่ใน list เท่านั้น (ไม่ใช่ทุก Dealer/Status ในระบบ)
// กันตัวเลือกที่กดแล้วไม่มีผลลัพธ์เลยโผล่ปนอยู่ในดรอปดาวน์
function _mondayFacetSelectHtml(containerId, fn, label, options) {
  if (options.length < 2) return '';
  var h = '<select style="font-size:11px;padding:4px 6px;width:auto" onchange="' + fn + '(\'' + containerId + '\',this.value)"><option value="">' + label + ': ทั้งหมด</option>';
  options.forEach(function(o) { h += '<option value="' + sanitize(o.value) + '">' + sanitize(o.text) + '</option>'; });
  h += '</select>';
  return h;
}
function mondayListMore(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var pageSize = parseInt(container.dataset.pageSize, 10) || 10;
  var shown = parseInt(container.dataset.shown, 10) || pageSize;
  var matched = mondayListMatched(containerId);
  matched.slice(shown, shown + pageSize).forEach(function(r) { r.style.display = ''; });
  var newShown = Math.min(shown + pageSize, matched.length);
  container.dataset.shown = newShown;
  mondayListUpdateMeta(containerId, matched.length, newShown);
}
function mondayListUpdateMeta(containerId, total, shown) {
  var metaEl = document.getElementById(containerId + 'Meta');
  if (metaEl) metaEl.textContent = total ? ('แสดง ' + shown + ' จาก ' + total + ' รายการ') : 'ไม่พบรายการที่ค้นหา';
  var btn = document.getElementById(containerId + 'More');
  if (btn) btn.style.display = shown >= total ? 'none' : '';
}
// ครอบ list ยาวๆ ในหน้า modal (POS bucket / โครงการเงียบ / Dealer ยังไม่ได้ Visit ฯลฯ) ด้วยช่องค้นหา +
// "แสดงเพิ่ม" ถ้ารายการเกิน 10 — ใช้ mondayListSetup(containerId,10) ต่อทันทีหลัง openM() เพราะ innerHTML
// set เป็น sync อยู่แล้ว (ดู mondayListSetup ด้านบน)
function mondayModalListWrapHtml(containerId, rowsHtml, count, facetsHtml) {
  var h = '';
  if (count > 10 && facetsHtml) h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + facetsHtml + '</div>';
  if (count > 10) h += '<div style="margin-bottom:8px"><input type="text" id="' + containerId + 'Search" placeholder="🔍 ค้นหา..." oninput="mondayListSearch(\'' + containerId + '\',this.value)" style="width:100%"></div>';
  h += '<div id="' + containerId + '">' + rowsHtml + '</div>';
  if (count > 10) {
    h += '<div id="' + containerId + 'Meta" style="font-size:11px;color:var(--text2);margin:8px 0 4px"></div>';
    h += '<button class="btn bsm bo" id="' + containerId + 'More" onclick="mondayListMore(\'' + containerId + '\')" style="width:100%">แสดงเพิ่ม</button>';
  }
  return h;
}
// ตัวเลข stat tile นับขึ้นจาก 0 ตอนโหลดหน้า (เอฟเฟกต์เล็กๆ ให้ dashboard ดูมีชีวิตขึ้น) — fmt(v) ถ้าใส่มาจะ
// เรียกทุกเฟรมเพื่อจัดรูปแบบ (เช่น ใส่ ฿/fmtMoneyShort/ทศนิยม), ไม่ใส่ = จำนวนเต็มธรรมดา
function mondayCountUp(id, target, fmt) {
  var el = document.getElementById(id);
  if (!el) return;
  var t0 = null, dur = 800;
  function tick(t) {
    if (!t0) t0 = t;
    var p = Math.min(1, (t - t0) / dur);
    var ease = 1 - Math.pow(1 - p, 3);
    var v = target * ease;
    el.textContent = fmt ? fmt(v) : Math.round(v);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function rMondayInsightsHtml(dealers, allActive, allStale, overdueDealers, overdueDays) {
  var h = '<div class="card" id="sec-insight"><h2>💡 Insight สำหรับพูดคุย</h2>';
  var rows = [];
  var top = allActive.slice().sort(function(a, b) { return ((b._pos || 0) / 100 * (Number(b.forecastAmount) || 0)) - ((a._pos || 0) / 100 * (Number(a.forecastAmount) || 0)); })[0];
  if (top) {
    var td = top.dealerId ? ST.getOne('dealers', top.dealerId) : null;
    rows.push({ ic: '🔥', title: sanitize((top.rowNo ? top.rowNo + ' ' : '') + (top.projectName || '')) + ' (' + sanitize(td ? td.name : '-') + ')', sub: 'มูลค่าคาดการณ์สูงสุด ฿' + fmtMoneyShort((Number(top.forecastAmount) || 0) * (top._pos || 0) / 100) + ' (POS ' + (top._pos || 0) + '%)', go: "go('pipeDetail',{pipeId:'" + top.id + "'})" });
  }
  if (allStale.length) rows.push({ ic: '⚠️', title: allStale.length + ' โครงการเงียบมา >' + MONDAY_STALE_DAYS + ' วัน', sub: 'ไม่มีอัพเดตเลย — กดดูรายการ', go: 'showStalePipesM()' });
  if (overdueDealers.length) rows.push({ ic: '📅', title: overdueDealers.length + ' Dealer ยังไม่ได้ Visit เกิน ' + overdueDays + ' วัน', sub: 'กดดูรายชื่อ', go: 'showOverdueDealersM()' });
  var topDealer = dealers.slice().sort(function(a, b) { return window._mondayStats[b.id].openPipelineWeighted - window._mondayStats[a.id].openPipelineWeighted; })[0];
  if (topDealer && window._mondayStats[topDealer.id].openPipelineWeighted > 0) {
    rows.push({ ic: '📈', title: sanitize(topDealer.name) + ' มูลค่าคาดการณ์สูงสุดตอนนี้', sub: '฿' + fmtMoneyShort(window._mondayStats[topDealer.id].openPipelineWeighted) + ' — กดดูสรุปบริษัท', go: "go('mondayCompany',{dealerId:'" + topDealer.id + "'})" });
  }
  if (!rows.length) h += '<div style="text-align:center;padding:16px;color:var(--text2)">ไม่มีข้อสังเกตพิเศษ</div>';
  rows.forEach(function(r) {
    h += '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 4px;border-bottom:1px solid var(--border-light);cursor:pointer" onclick="' + r.go + '"><div style="font-size:16px">' + r.ic + '</div><div style="font-size:12.5px"><b>' + r.title + '</b><div style="color:var(--text2);font-size:11.5px">' + r.sub + '</div></div></div>';
  });
  h += '</div>';
  return h;
}

function copyMondaySummary() {
  var dealers = scopedDealers();
  var lines = ['🗓️ ประชุมจันทร์ — สรุป Pipeline (' + fD(_td()) + ')', ''];
  var openTotal = 0, weightedTotal = 0, count = 0;
  dealers.forEach(function(d) { var s = window._mondayStats[d.id]; if (!s) return; count += s.activePipes.length; openTotal += s.openPipelineTotal; weightedTotal += s.openPipelineWeighted; });
  lines.push('บริษัทที่ดูแล: ' + dealers.length + ' · โครงการเปิดอยู่: ' + count + ' · มูลค่ารวม: ฿' + fmtMoney(openTotal) + ' · Weighted: ฿' + fmtMoney(weightedTotal));
  lines.push('');
  dealers.forEach(function(d) {
    var s = window._mondayStats[d.id];
    if (!s || !s.activePipes.length) return;
    lines.push('🏢 ' + d.name + ' (' + s.activePipes.length + ' โครงการ, ฿' + fmtMoneyShort(s.openPipelineTotal) + ')');
  });
  copyText(lines.join('\n'), '📋 คัดลอกสรุปประชุมแล้ว');
}

// ================================================================
// POS CALIBRATION — เพจแยก (go('posCalibration')) โชว์ผล computePosCalibration() เป็นแท่งเทียบ "ทำนาย" vs
// "ผลจริง" ต่อช่วง POS — เป้าหมายคือช่วยตัดสินใจว่าน้ำหนัก posWeights (⚙️) ที่ตั้งไว้แม่นพอหรือยัง
// ================================================================
function rPosCalibration(el) {
  document.getElementById('pgT').textContent = '🎯 POS Calibration';
  var cal = computePosCalibration();
  window._posCal = cal;
  var h = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '';
  h += '<div class="card"><h2>🎯 POS Calibration — ทำนายแม่นแค่ไหน</h2>' +
    '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">เทียบ POS ที่บันทึกไว้ล่าสุดก่อนโครงการปิด กับผลจริงว่า Win กี่ % ของแต่ละช่วง — เช่นช่วง 60-79% ถ้าตั้งไว้แม่น ควรจะ Win จริงประมาณ 70% ถ้าห่างกันมาก ลองปรับน้ำหนักใน ⚙️ POS Weights ดู</div>' +
    '<div style="font-size:11px;color:var(--text2);margin-bottom:12px">โครงการปิดแล้วทั้งหมด (Won/Lost): ' + cal.totalClosed + ' · มีประวัติ POS เก็บไว้จริง: ' + cal.totalWithHistory +
    (cal.totalClosed > cal.totalWithHistory ? ' <span title="โครงการที่ปิดไปก่อนเริ่มเก็บ posHistory ใช้ POS ปัจจุบันแทนแบบคร่าวๆ">(ที่เหลือใช้ POS ปัจจุบันแทน ⓘ)</span>' : '') + '</div>';
  if (!cal.hasEnoughData) {
    h += '<div class="empty"><p>ยังไม่มีโครงการที่ปิด (Won/Lost) พอให้วิเคราะห์ — ต้องรอให้มีโครงการปิดจริงสักพักก่อนถึงจะเห็นผล</p></div></div>';
    el.innerHTML = h;
    return;
  }
  h += '<div style="display:flex;flex-direction:column;gap:10px">';
  cal.buckets.forEach(function(b) {
    if (!b.total) { h += '<div style="opacity:.4;font-size:12px;padding:6px 4px">' + b.label + ' — ไม่มีข้อมูล</div>'; return; }
    var diff = b.actualRate - b.predictedMid;
    var diffColor = Math.abs(diff) <= 15 ? 'var(--good,#22c55e)' : Math.abs(diff) <= 30 ? 'var(--warn,#f59e0b)' : 'var(--bad,#ef4444)';
    var lowN = b.total < 5;
    h += '<div style="border:1px solid var(--border);border-radius:10px;padding:12px;cursor:pointer" onclick="showPosCalBucketM(\'' + b.id + '\')">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<b style="font-size:13px">ทำนาย ' + b.label + ' <span style="color:var(--text2);font-weight:400">(กึ่งกลาง ' + b.predictedMid + '%)</span></b>' +
      '<span style="font-size:11px;color:var(--text2)">' + b.total + ' โครงการ' + (lowN ? ' ⚠️ ตัวอย่างน้อย' : '') + '</span></div>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<div style="flex:1;height:10px;background:var(--bg2);border-radius:6px;overflow:hidden;position:relative">' +
      '<div style="position:absolute;left:' + b.predictedMid + '%;top:-3px;width:2px;height:16px;background:var(--text3)"></div>' +
      '<div style="height:100%;width:' + b.actualRate + '%;background:' + diffColor + '"></div>' +
      '</div><b style="font-size:14px;color:' + diffColor + '">' + b.actualRate + '%</b></div>' +
      '<div style="font-size:10.5px;color:var(--text2);margin-top:4px">Win จริง ' + b.won + '/' + b.total + ' · ห่างจากทำนาย ' + (diff >= 0 ? '+' : '') + diff + 'pt</div>' +
      '</div>';
  });
  h += '</div></div>';
  el.innerHTML = h;
}
function showPosCalBucketM(bucketId) {
  var cal = window._posCal || computePosCalibration();
  var b = cal.buckets.filter(function(x) { return x.id === bucketId; })[0];
  if (!b) return;
  var rows = '';
  b.pipes.slice().sort(function(a, c) { return (Number(c.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); }).forEach(function(p) {
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    var won = pipeIsWon(p);
    rows += '<div class="li" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize((p.rowNo ? p.rowNo + ' ' : '') + (p.projectName || '')) + '</div><div class="ls">' + sanitize(d ? d.name : '-') + ' · POS ' + _posLastKnownBeforeClose(p) + '% · ' + (won ? '✅ Won' : '❌ Lost') + ' · ฿' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</div></div></div>';
  });
  openM('🎯 ' + b.label + ' — รายละเอียด', '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">Win จริง ' + b.won + '/' + b.total + ' (' + b.actualRate + '%)</div>' + rows);
}

// ---- Drill-down modals (เลือกกลุ่ม POS / โครงการเงียบ / Dealer ยังไม่ได้ Visit) ----
function showPosBucketM(level) {
  var dealers = scopedDealers();
  var cfg = getConfig();
  var list = [];
  dealers.forEach(function(d) {
    var s = window._mondayStats[d.id];
    if (!s) return;
    var arr = level === 'high' ? s.high : level === 'mid' ? s.mid : level === 'low' ? s.low : level === 'bestcase' ? s.high.concat(s.mid) : s.high.concat(s.mid, s.low);
    list = list.concat(arr);
  });
  var label = level === 'high' ? 'สูง (≥70%)' : level === 'mid' ? 'กลาง (40-69%)' : level === 'low' ? 'ต่ำ (<40%)' : level === 'bestcase' ? 'Best Case (POS ≥40%)' : 'ทั้งหมด (Weighted)';
  list.sort(function(a, b) { return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); });
  var rows = '';
  var dealerOpts = {}, statusOpts = {};
  list.forEach(function(p) {
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    if (d) dealerOpts[d.id] = d.name;
    var stName = ((cfg.pipelineStatuses || []).find(function(x) { return x.id === p.status; }) || {}).name || p.status;
    statusOpts[p.status] = stName;
    rows += '<div class="li" data-dealer="' + (p.dealerId || '') + '" data-status="' + sanitize(p.status || '') + '" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize((p.rowNo ? p.rowNo + ' ' : '') + (p.projectName || '')) + '</div><div class="ls">' + sanitize(d ? d.name : '-') + ' · POS ' + (p._pos || 0) + '% · ฿' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</div></div></div>';
  });
  if (!list.length) rows = '<div class="empty"><p>ไม่มีโครงการในกลุ่มนี้</p></div>';
  var facets = _mondayFacetSelectHtml('mondayPosBucketList', 'mondayListFilterDealer', '🏢 บริษัท', Object.keys(dealerOpts).map(function(id) { return { value: id, text: dealerOpts[id] }; }).sort(function(a, b) { return a.text.localeCompare(b.text, 'th'); })) +
    _mondayFacetSelectHtml('mondayPosBucketList', 'mondayListFilterStatus', '📌 สถานะ', Object.keys(statusOpts).map(function(id) { return { value: id, text: statusOpts[id] }; }));
  var h = '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">' + list.length + ' โครงการ · รวม ฿' + fmtMoney(list.reduce(function(s, p) { return s + (Number(p.forecastAmount) || 0); }, 0)) + '</div>' + mondayModalListWrapHtml('mondayPosBucketList', rows, list.length, facets);
  openM('🎯 โอกาส ' + label, h);
  if (list.length > 10) mondayListSetup('mondayPosBucketList', 10);
}
function showStalePipesM() {
  var dealers = scopedDealers();
  var cfg = getConfig();
  var list = [];
  dealers.forEach(function(d) { var s = window._mondayStats[d.id]; if (s) list = list.concat(s.stalePipes); });
  var rows = '';
  var dealerOpts = {}, statusOpts = {};
  list.forEach(function(p) {
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    if (d) dealerOpts[d.id] = d.name;
    var stName = ((cfg.pipelineStatuses || []).find(function(x) { return x.id === p.status; }) || {}).name || p.status;
    statusOpts[p.status] = stName;
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    rows += '<div class="li" data-dealer="' + (p.dealerId || '') + '" data-status="' + sanitize(p.status || '') + '" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize((p.rowNo ? p.rowNo + ' ' : '') + (p.projectName || '')) + '</div><div class="ls">' + sanitize(d ? d.name : '-') + ' · อัพเดตล่าสุด: ' + (lastLog ? fDShort(lastLog.date) : 'ไม่เคยมี Log') + '</div></div></div>';
  });
  if (!list.length) rows = '<div class="empty"><p>ไม่มีโครงการเงียบ</p></div>';
  var facets = _mondayFacetSelectHtml('mondayStaleList', 'mondayListFilterDealer', '🏢 บริษัท', Object.keys(dealerOpts).map(function(id) { return { value: id, text: dealerOpts[id] }; }).sort(function(a, b) { return a.text.localeCompare(b.text, 'th'); })) +
    _mondayFacetSelectHtml('mondayStaleList', 'mondayListFilterStatus', '📌 สถานะ', Object.keys(statusOpts).map(function(id) { return { value: id, text: statusOpts[id] }; }));
  var h = '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">' + list.length + ' โครงการ ไม่มีอัพเดตเกิน ' + MONDAY_STALE_DAYS + ' วัน</div>' + mondayModalListWrapHtml('mondayStaleList', rows, list.length, facets);
  openM('⚠️ โครงการเงียบ', h);
  if (list.length > 10) mondayListSetup('mondayStaleList', 10);
}
function showOverdueDealersM() {
  var overdueDays = (typeof DEALER_VISIT_OVERDUE_DAYS !== 'undefined') ? DEALER_VISIT_OVERDUE_DAYS : 60;
  var list = scopedDealers().filter(function(d) { var lv = (typeof ST.getLastVisitDays === 'function') ? ST.getLastVisitDays(d.id) : null; return lv === null || lv > overdueDays; });
  var rows = '';
  list.forEach(function(d) {
    var lv = (typeof ST.getLastVisitDays === 'function') ? ST.getLastVisitDays(d.id) : null;
    rows += '<div class="li" onclick="closeMForce();go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize(d.name) + '</div><div class="ls">' + (lv === null ? 'ยังไม่เคย Visit' : 'Visit ล่าสุด ' + lv + ' วันก่อน') + '</div></div></div>';
  });
  if (!list.length) rows = '<div class="empty"><p>ไม่มี</p></div>';
  var h = '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">' + list.length + ' บริษัท ยังไม่ได้ Visit เกิน ' + overdueDays + ' วัน</div>' + mondayModalListWrapHtml('mondayOverdueList', rows, list.length);
  openM('📅 ยังไม่ได้ Visit', h);
  if (list.length > 10) mondayListSetup('mondayOverdueList', 10);
}

// ================================================================
// MONDAY MEETING — หน้าสรุปรายบริษัท (go('mondayCompany',{dealerId})) เจาะลึกจากหน้าสรุปรวม กด
// "← กลับ" (goBack มาตรฐานของแอป) กลับไปหน้าสรุปรวมได้เสมอ
// ================================================================
function rMondayCompany(el) {
  var d = ST.getOne('dealers', S.dealerId);
  if (!d) return go('mondayMeeting');
  document.getElementById('pgT').textContent = '🏢 ' + d.name;
  var cfg = getConfig();
  var s = mondayCompanyStats(d.id, cfg);
  window._mondayCompanyStat = s;

  var h = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '';
  h += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
    '<div><h2 style="margin:0 0 4px">🏢 ' + sanitize(d.name) + ' ' + levelTag(d.level) + '</h2>' +
    '<div style="font-size:12px;color:var(--text2)">📅 Visit ล่าสุด: ' + (s.lastVisitDays === null ? 'ยังไม่เคย' : s.lastVisitDays + ' วันก่อน') + '</div></div>' +
    '<div style="display:flex;gap:6px"><button class="btn bsm bo" onclick="showVisitM(\'' + d.id + '\')">🤝 บันทึก Visit</button><button class="btn bsm bo" onclick="go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})">📋 หน้า Dealer เต็ม</button></div>' +
    '</div></div>';

  h += '<div class="sr" style="margin-bottom:12px">' +
    '<div class="sc"><div class="sn c1">' + s.activePipes.length + '</div><div class="sl">โครงการเปิดอยู่</div></div>' +
    '<div class="sc"><div class="sn c2">฿' + fmtMoneyShort(s.openPipelineTotal) + '</div><div class="sl">มูลค่า Pipeline</div></div>' +
    '<div class="sc"><div class="sn" style="color:var(--accent)">฿' + fmtMoneyShort(s.openPipelineWeighted) + '</div><div class="sl">Weighted</div></div>' +
    '<div class="sc"><div class="sn c3">฿' + fmtMoneyShort(s.targetH1 + s.targetH2) + '</div><div class="sl">เป้ารวมทั้งปี</div></div>' +
    '</div>';

  var h1Won = s.wonH1Project + s.wonH1Runrate;
  var h1Pct = s.targetH1 ? Math.round(h1Won / s.targetH1 * 100) : 0;
  var h2ProjectTotal = s.wonH2Project + s.openPipelineWeighted;
  var h2RunrateTotal = s.wonH2RunrateWon + s.h2RunrateRemaining;
  var h2Projected = h2ProjectTotal + h2RunrateTotal;
  var h2Pct = s.targetH2 ? Math.round(h2Projected / s.targetH2 * 100) : 0;
  function _mondayVerdict(pct, isCurrent) {
    if (pct >= 100) return { bg: 'var(--good-bg)', fg: 'var(--good-fg)', label: '✅ ถึงเป้าแล้ว' };
    if (isCurrent) return pct >= 70 ? { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)', label: '⏳ ตามจังหวะ ลุ้นถึงเป้า' } : { bg: 'var(--bad-bg)', fg: 'var(--bad-fg)', label: '⚠️ ตามหลังจังหวะ เสี่ยงไม่ถึงเป้า' };
    return pct >= 90 ? { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)', label: '🔶 เกือบถึงเป้า (ปิดรอบแล้ว)' } : { bg: 'var(--bad-bg)', fg: 'var(--bad-fg)', label: '❌ ไม่ถึงเป้า (ปิดรอบแล้ว)' };
  }
  var v1 = _mondayVerdict(h1Pct, false), v2 = _mondayVerdict(h2Pct, true);
  // ยอดขาย SIS จริงรายไตรมาส (Q1-Q4) — คนละชุดกับเป้า H1/H2 ข้างบน (เป้ามีแค่ระดับครึ่งปี ไม่มี breakdown
  // รายไตรมาส) เอามาโชว์เสริมให้เห็นจังหวะการมาของยอดขายในแต่ละครึ่งปีละเอียดขึ้น กดแล้วไปหน้าแก้ไขได้เลย
  var _sisRev = (typeof getSisRevenueForYear === 'function') ? getSisRevenueForYear(d, new Date().getFullYear()) : { q1: 0, q2: 0, q3: 0, q4: 0 };

  h += '<div class="card"><h2>📊 เป้ายอดขาย H1 / H2</h2>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  var h1RingColor = h1Pct >= 100 ? '#22c55e' : '#ef4444';
  var h2RingColor = h2Pct >= 100 ? '#22c55e' : h2Pct >= 70 ? '#f59e0b' : '#ef4444';
  h += '<div style="border:1px solid var(--border);border-radius:11px;padding:13px">' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><b style="font-size:13px">H1 (ม.ค.–มิ.ย.)</b><span style="font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--bg2);color:var(--text2)">ปิดรอบแล้ว</span></div>' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' + progressRingHtml(h1Pct, { size: 44, strokeW: 5, color: h1RingColor }) +
    '<div style="flex:1;font-size:11.5px;color:var(--text2)"><span>Won จริง</span><br><b style="color:var(--text);font-size:12.5px">฿' + fmtMoneyShort(h1Won) + ' / ฿' + fmtMoneyShort(s.targetH1) + '</b></div></div>' +
    '<div onclick="showMondayHalfM(\'' + d.id + '\',\'H1\',\'project\')" style="cursor:pointer;font-size:11px;color:var(--text2);display:flex;justify-content:space-between;padding:3px 4px;border-radius:6px"><span>📁 Project ›</span><b style="color:var(--text)">฿' + fmtMoneyShort(s.wonH1Project) + '</b></div>' +
    '<div onclick="showMondayHalfM(\'' + d.id + '\',\'H1\',\'runrate\')" style="cursor:pointer;font-size:11px;color:var(--text2);display:flex;justify-content:space-between;padding:3px 4px;border-radius:6px"><span>🔁 Runrate ›</span><b style="color:var(--text)">฿' + fmtMoneyShort(s.wonH1Runrate) + '</b></div>' +
    '<div style="font-size:11.5px;font-weight:700;margin-top:6px;padding:6px 8px;border-radius:7px;background:' + v1.bg + ';color:' + v1.fg + '">' + v1.label + '</div>' +
    '<div onclick="showEditSisRevenueModal(\'' + d.id + '\')" style="cursor:pointer;font-size:10.5px;color:var(--text3);margin-top:6px;padding-top:6px;border-top:1px dashed var(--border)">💰 ยอดขาย SIS จริง — Q1: ' + fmtMoneyShort(_sisRev.q1 || 0) + ' · Q2: ' + fmtMoneyShort(_sisRev.q2 || 0) + ' <span style="color:var(--accent)">✏️</span></div>' +
    '</div>';
  h += '<div style="border:1px solid var(--accent);border-radius:11px;padding:13px;background:var(--accent-light)">' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><b style="font-size:13px">H2 (ก.ค.–ธ.ค.)</b><span style="font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--accent);color:#fff">กำลังดำเนินอยู่</span></div>' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' + progressRingHtml(h2Pct, { size: 44, strokeW: 5, color: h2RingColor }) +
    '<div style="flex:1;font-size:11.5px;color:var(--text2)"><span>Won + คาดว่าจะได้</span><br><b style="color:var(--text);font-size:12.5px">฿' + fmtMoneyShort(h2Projected) + ' / ฿' + fmtMoneyShort(s.targetH2) + '</b></div></div>' +
    '<div onclick="showMondayHalfM(\'' + d.id + '\',\'H2\',\'project\')" style="cursor:pointer;font-size:11px;color:var(--text2);display:flex;justify-content:space-between;padding:3px 4px;border-radius:6px"><span>📁 Project (Won ฿' + fmtMoneyShort(s.wonH2Project) + ' + Pipeline ฿' + fmtMoneyShort(s.openPipelineWeighted) + ') ›</span><b style="color:var(--text)">฿' + fmtMoneyShort(h2ProjectTotal) + '</b></div>' +
    '<div onclick="showMondayHalfM(\'' + d.id + '\',\'H2\',\'runrate\')" style="cursor:pointer;font-size:11px;color:var(--text2);display:flex;justify-content:space-between;padding:3px 4px;border-radius:6px"><span>🔁 Runrate (Won ฿' + fmtMoneyShort(s.wonH2RunrateWon) + ' + คาดไว้ ฿' + fmtMoneyShort(s.h2RunrateRemaining) + ') ›</span><b style="color:var(--text)">฿' + fmtMoneyShort(h2RunrateTotal) + '</b></div>' +
    '<div style="font-size:11.5px;font-weight:700;margin-top:6px;padding:6px 8px;border-radius:7px;background:' + v2.bg + ';color:' + v2.fg + '">' + v2.label + (h2Pct < 100 ? ' — ขาดอีก ฿' + fmtMoneyShort(s.targetH2 - h2Projected) : '') + '</div>' +
    '<div onclick="showEditSisRevenueModal(\'' + d.id + '\')" style="cursor:pointer;font-size:10.5px;color:var(--text3);margin-top:6px;padding-top:6px;border-top:1px dashed var(--border)">💰 ยอดขาย SIS จริง — Q3: ' + fmtMoneyShort(_sisRev.q3 || 0) + ' · Q4: ' + fmtMoneyShort(_sisRev.q4 || 0) + ' <span style="color:var(--accent)">✏️</span></div>' +
    '</div>';
  h += '</div></div>';

  // funnel by status
  h += '<div class="card"><h2>🔻 Pipeline แยกตามสถานะ</h2>';
  var statusGroups = {};
  s.activePipes.forEach(function(p) {
    var key = p.status;
    if (!statusGroups[key]) statusGroups[key] = { amt: 0, name: ((cfg.pipelineStatuses || []).find(function(x) { return x.id === key; }) || {}).name || key };
    statusGroups[key].amt += Number(p.forecastAmount) || 0;
  });
  var statusKeys = Object.keys(statusGroups);
  var maxStageAmt = Math.max.apply(null, statusKeys.map(function(k) { return statusGroups[k].amt; }).concat([0.01]));
  statusKeys.forEach(function(k) {
    var g = statusGroups[k];
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px"><div style="width:100px;flex-shrink:0;color:var(--text2)">' + sanitize(g.name) + '</div><div style="flex:1;height:16px;background:var(--bg2);border-radius:5px;overflow:hidden"><div style="height:100%;background:var(--accent);border-radius:5px;width:' + Math.round(g.amt / maxStageAmt * 100) + '%"></div></div><div style="width:70px;text-align:right;color:var(--text2)">฿' + fmtMoneyShort(g.amt) + '</div></div>';
  });
  if (!statusKeys.length) h += '<div style="text-align:center;color:var(--text2);padding:10px">ไม่มีโครงการเปิดอยู่</div>';
  h += '</div>';

  h += rMondayForecastByModelHtml(s.activePipes);

  h += '<div class="card"><h2>📋 โครงการทั้งหมด (' + s.activePipes.length + ')</h2>';
  if (s.activePipes.length > 10) h += '<input type="text" placeholder="🔍 ค้นหาชื่อโครงการ..." style="margin-bottom:8px" oninput="mondayListSearch(\'mondayCoProjectList\',this.value)"><div style="font-size:11px;color:var(--text2);margin-bottom:8px" id="mondayCoProjectListMeta"></div>';
  h += '<div id="mondayCoProjectList">';
  s.activePipes.slice().sort(function(a, b) { return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); }).forEach(function(p) {
    h += '<div class="li" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize((p.rowNo ? p.rowNo + ' ' : '') + (p.projectName || '')) + '</div><div class="ls">' + sanitize(((cfg.pipelineStatuses || []).find(function(x) { return x.id === p.status; }) || {}).name || p.status || '') + ' · POS ' + (p._pos || 0) + '% · ฿' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</div></div></div>';
  });
  h += '</div>';
  if (s.activePipes.length > 10) h += '<button type="button" class="btn bo btn-full" id="mondayCoProjectListMore" onclick="mondayListMore(\'mondayCoProjectList\')" style="margin-top:6px">⬇️ แสดงเพิ่ม</button>';
  if (!s.activePipes.length) h += '<div class="empty"><p>ไม่มีโครงการเปิดอยู่</p></div>';
  h += '</div>';

  el.innerHTML = h;
  mondayListSetup('mondayCoProjectList', 10);
}

function showMondayHalfM(dealerId, half, source) {
  var s = window._mondayCompanyStat || mondayCompanyStats(dealerId, getConfig());
  var h = '';
  var setupIds = [];
  if (source === 'project') {
    var won = half === 'H1' ? s.wonProjectsH1 : s.wonProjectsH2;
    var wonRows = '';
    won.forEach(function(p) { wonRows += '<div class="li" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize(p.projectName || '') + '</div><div class="ls">฿' + fmtMoneyShort(Number(p.realAmount || p.forecastAmount) || 0) + '</div></div></div>'; });
    if (!won.length) wonRows = '<div style="font-size:12px;color:var(--text2);padding:8px 0">ไม่มีรายการ</div>';
    h += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">✅ ปิดแล้ว (Won) — ' + won.length + ' โครงการ</div>' + mondayModalListWrapHtml('mondayHalfWonList', wonRows, won.length);
    if (won.length > 10) setupIds.push('mondayHalfWonList');
    if (half === 'H2') {
      var openRows = '';
      var cfg = getConfig();
      var statusOpts = {};
      s.activePipes.forEach(function(p) {
        var stName = ((cfg.pipelineStatuses || []).find(function(x) { return x.id === p.status; }) || {}).name || p.status;
        statusOpts[p.status] = stName;
        openRows += '<div class="li" data-status="' + sanitize(p.status || '') + '" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize(p.projectName || '') + '</div><div class="ls">POS ' + (p._pos || 0) + '% · ฿' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</div></div></div>';
      });
      if (!s.activePipes.length) openRows = '<div style="font-size:12px;color:var(--text2);padding:8px 0">ไม่มีรายการ</div>';
      var openFacets = _mondayFacetSelectHtml('mondayHalfOpenList', 'mondayListFilterStatus', '📌 สถานะ', Object.keys(statusOpts).map(function(id) { return { value: id, text: statusOpts[id] }; }));
      h += '<div style="font-size:12px;color:var(--text2);margin:14px 0 6px">📊 Pipeline เปิดอยู่ (ยังไม่ปิด — ถ่วง POS) — ' + s.activePipes.length + ' โครงการ</div>' + mondayModalListWrapHtml('mondayHalfOpenList', openRows, s.activePipes.length, openFacets);
      if (s.activePipes.length > 10) setupIds.push('mondayHalfOpenList');
    }
  } else {
    var wonRR = half === 'H1' ? s.rrWonH1 : s.rrWonH2;
    var remain = half === 'H2' ? s.rrRemainH2 : [];
    var wonRRRows = '';
    wonRR.forEach(function(r) { wonRRRows += _mondayRunrateRowHtml(r); });
    if (!wonRR.length) wonRRRows = '<div style="font-size:12px;color:var(--text2);padding:8px 0">ไม่มีรายการ</div>';
    h += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">✅ ปิดแล้ว — ' + wonRR.length + ' รายการ</div>' + mondayModalListWrapHtml('mondayHalfRRWonList', wonRRRows, wonRR.length);
    if (wonRR.length > 10) setupIds.push('mondayHalfRRWonList');
    if (half === 'H2') {
      var remainRows = '';
      remain.forEach(function(r) { remainRows += _mondayRunrateRowHtml(r); });
      if (!remain.length) remainRows = '<div style="font-size:12px;color:var(--text2);padding:8px 0">ไม่มีรายการ</div>';
      h += '<div style="font-size:12px;color:var(--text2);margin:14px 0 6px">📅 คาดไว้ (ยังไม่ปิด) — ' + remain.length + ' รายการ</div>' + mondayModalListWrapHtml('mondayHalfRRRemainList', remainRows, remain.length);
      if (remain.length > 10) setupIds.push('mondayHalfRRRemainList');
    }
  }
  h += '<div style="font-size:.62rem;color:var(--text2);margin-top:10px;text-align:center">— ในของจริงแต่ละแถวกดต่อได้: โครงการ → หน้า Pipeline เต็ม, Runrate → รายการ Sales Forecast ในหน้า Dealer แก้ไข/ลบได้เลย —</div>';
  openM((source === 'project' ? '📁 Project' : '🔁 Runrate') + ' — ' + half, h);
  setupIds.forEach(function(id) { mondayListSetup(id, 10); });
}
function _mondayRunrateRowHtml(r) {
  var price = getModelPrice(r.model) || 0;
  return '<div class="li" style="cursor:default"><div class="lm"><div class="lt">' + sanitize(r.model || '-') + ' ×' + (r.qty || 0) + '</div><div class="ls">' + sanitize(r.month || '') + (price ? ' · ฿' + fmtMoneyShort(price * (r.qty || 0)) : '') + '</div></div></div>';
}

// ================================================================
// PIPELINE COMPARE — เปรียบเทียบโครงการที่แข่งกัน/คล้ายกันแบบเคียงข้างกัน (สูงสุด 4) + สรุปคู่แข่งที่เจอบ่อย
// (go('pipelineCompare')) ทั้งสองการ์ดดึงจากข้อมูล Pipeline เดิมล้วนๆ ไม่มีฟิลด์ใหม่
// ================================================================
var pcSelected = []; // array ของ pipeId ที่เลือกมาเทียบ (สูงสุด 4)
var pcQuery = '';
var pcSearchMode = 'all'; // 'all'|'rowno'|'project'|'dealer' — เลือกฟิลด์ที่จะค้นหา กันพิมพ์ Row No. แล้วขึ้นทุกอย่างเพราะไปแมตช์ชื่อ/บริษัทด้วย

function rPipelineCompare(el) {
  document.getElementById('pgT').textContent = '📊 เปรียบเทียบโครงการ';
  var cfg = getConfig();
  var h = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '';

  h += '<div class="card"><h2>🆚 เปรียบเทียบโครงการ</h2>';
  h += '<div style="font-size:11.5px;color:var(--text2);margin-bottom:10px">เลือกโครงการที่จะเทียบ (สูงสุด 4 โครงการ)</div>';

  // ---- picker ----
  var pcModeLabels = { all: 'ทั้งหมด', rowno: 'Row No.', project: 'ชื่อโครงการ', dealer: 'บริษัท' };
  h += '<div class="ftabs" style="margin-bottom:8px">' + Object.keys(pcModeLabels).map(function(mk) {
    return '<div class="ftab ' + (pcSearchMode === mk ? 'act' : '') + '" onclick="pcSetSearchMode(\'' + mk + '\')">' + pcModeLabels[mk] + '</div>';
  }).join('') + '</div>';
  h += '<input type="text" id="pcSearchInput" placeholder="🔍 ค้นหาจาก' + pcModeLabels[pcSearchMode] + '..." style="margin-bottom:8px" value="' + sanitize(pcQuery) + '" oninput="pcSearch(this.value)">';
  h += '<div id="pcSearchResults" style="margin-bottom:10px"></div>';

  h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px" id="pcChips">' + pcChipsHtml() + '</div>';

  h += '<div id="pcTableArea">' + pcTableHtml(cfg) + '</div>';
  h += '</div>';

  h += rCompetitorOverviewHtml();

  el.innerHTML = h;
}

function pcChipsHtml() {
  if (!pcSelected.length) return '<div style="font-size:11.5px;color:var(--text3)">ยังไม่ได้เลือกโครงการ</div>';
  return pcSelected.map(function(id) {
    var p = ST.getOne('pipeline', id);
    if (!p) return '';
    return '<div style="font-size:11.5px;font-weight:600;padding:5px 10px;border-radius:999px;background:var(--accent-light);color:var(--accent);display:flex;align-items:center;gap:6px">' +
      sanitize((p.rowNo ? p.rowNo + ' · ' : '') + (p.projectName || '-')) +
      '<span style="cursor:pointer" onclick="pcRemove(\'' + id + '\')">✕</span></div>';
  }).join('');
}

function pcSetSearchMode(mode) {
  pcSearchMode = mode;
  render();
}
function pcSearch(q) {
  pcQuery = q || '';
  var el = document.getElementById('pcSearchResults');
  if (!el) return;
  if (!pcQuery.trim()) { el.innerHTML = ''; return; }
  var qlc = pcQuery.toLowerCase();
  var results = ST.getAll('pipeline').filter(function(p) {
    if (pcSelected.indexOf(p.id) !== -1) return false;
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    if (pcSearchMode === 'rowno') return String(p.rowNo || '').toLowerCase().indexOf(qlc) !== -1;
    if (pcSearchMode === 'project') return (p.projectName || '').toLowerCase().indexOf(qlc) !== -1;
    if (pcSearchMode === 'dealer') return ((d && d.name) || '').toLowerCase().indexOf(qlc) !== -1;
    return (p.projectName || '').toLowerCase().indexOf(qlc) !== -1 ||
      String(p.rowNo || '').toLowerCase().indexOf(qlc) !== -1 ||
      (d && d.name || '').toLowerCase().indexOf(qlc) !== -1;
  }).slice(0, 8);
  if (!results.length) { el.innerHTML = '<div style="font-size:11.5px;color:var(--text3);padding:6px 0">ไม่พบโครงการ</div>'; return; }
  el.innerHTML = results.map(function(p) {
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    return '<div class="li" style="cursor:pointer" onclick="pcAdd(\'' + p.id + '\')"><div class="lm"><div class="lt">' + sanitize((p.rowNo ? p.rowNo + ' · ' : '') + (p.projectName || '-')) + '</div><div class="ls">' + sanitize(d ? d.name : '-') + '</div></div></div>';
  }).join('');
}

function pcAdd(pipeId) {
  if (pcSelected.indexOf(pipeId) !== -1) return;
  if (pcSelected.length >= 4) { toast('เทียบได้สูงสุด 4 โครงการ'); return; }
  pcSelected.push(pipeId);
  pcQuery = '';
  render();
}
function pcRemove(pipeId) {
  pcSelected = pcSelected.filter(function(id) { return id !== pipeId; });
  render();
}

function pcTableHtml(cfg) {
  if (pcSelected.length < 2) return '<div class="empty"><p>เลือกอย่างน้อย 2 โครงการเพื่อเปรียบเทียบ</p></div>';
  var pipes = pcSelected.map(function(id) { return ST.getOne('pipeline', id); }).filter(Boolean);
  if (pipes.length < 2) return '<div class="empty"><p>เลือกอย่างน้อย 2 โครงการเพื่อเปรียบเทียบ</p></div>';

  var maxAmt = Math.max.apply(null, pipes.map(function(p) { return Number(p.forecastAmount) || 0; }));
  var bestId = null, bestPos = -1;
  pipes.forEach(function(p) {
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    var pos = computeSuggestedPOS(p, cfg, lastLog ? lastLog.date : null).score;
    if (typeof p.projectPOS === 'number' && p.projectPOS) pos = p.projectPOS;
    p._pcPos = pos;
    if (pos > bestPos) { bestPos = pos; bestId = p.id; }
  });

  function td(fn) { return pipes.map(function(p) { return '<td>' + fn(p) + '</td>'; }).join(''); }

  var h = '<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:' + (140 + pipes.length * 190) + 'px">';
  h += '<thead><tr><th style="text-align:left;padding:9px 12px;font-size:10.5px;color:var(--text2);background:var(--bg2);width:130px"></th>';
  h += pipes.map(function(p) {
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    var crown = p.id === bestId ? '🏆 ' : '';
    return '<th style="text-align:left;padding:9px 12px;background:var(--bg2);min-width:190px;cursor:pointer" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">' +
      '<div style="font-weight:700;font-size:13px">' + crown + sanitize((p.rowNo ? p.rowNo + ' · ' : '') + (p.projectName || '-')) + '</div>' +
      '<div style="font-size:11px;color:var(--text2);font-weight:400">🏪 ' + sanitize(d ? d.name : '-') + '</div></th>';
  }).join('');
  h += '</tr></thead><tbody>';

  function row(label, fn) {
    return '<tr><td style="padding:9px 12px;border-bottom:1px solid var(--border-light);color:var(--text2);font-weight:600;font-size:12px;background:var(--bg3,var(--bg2));white-space:nowrap">' + label + '</td>' +
      pipes.map(function(p) { return '<td style="padding:9px 12px;border-bottom:1px solid var(--border-light);font-size:12.5px;vertical-align:top">' + fn(p) + '</td>'; }).join('') + '</tr>';
  }

  h += row('สถานะ', function(p) { return pipeTag(p.status); });
  h += row('มูลค่า', function(p) { var amt = Number(p.forecastAmount) || 0; return '<b>฿' + fmtMoney(amt) + '</b>'; });
  h += row('POS (โอกาสได้งาน)', function(p) {
    var pos = p._pcPos || 0;
    var c = pos >= 70 ? '#22c55e' : pos >= 40 ? '#f59e0b' : '#ef4444';
    return pos + '%<div style="height:6px;background:var(--bg2);border-radius:4px;overflow:hidden;margin-top:4px;width:70px"><div style="height:100%;width:' + pos + '%;background:' + c + '"></div></div>';
  });
  h += row('วันยื่นซอง (Bidding)', function(p) { return p.biddingDate ? fDShort(p.biddingDate) : '<span style="color:var(--text3)">ยังไม่กำหนด</span>'; });
  h += row('รุ่นสินค้าที่เสนอ', function(p) {
    var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : [];
    if (items.length) return sanitize(items.map(function(it) { return it.model; }).join(', '));
    return sanitize(p.model || '-');
  });
  h += row('⚠️ คู่แข่ง', function(p) {
    if (!p.hasCompetitor || !p.competitorName) return '<span style="color:var(--text3)">— ไม่มี —</span>';
    return sanitize(p.competitorName);
  });
  h += row('หนังสือแต่งตั้ง', function(p) { return p.appointmentLetter === 'ออกแล้ว' ? '✅ ออกแล้ว' : '❌ ยังไม่ออก'; });
  h += row('ลงทะเบียน CRM DJI', function(p) { return p.djiCrmRegistered ? '✅ แล้ว' : '❌ ยังไม่ได้'; });
  h += row('อัพเดตล่าสุด', function(p) {
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    if (!lastLog) return '<span style="color:var(--text3)">ไม่เคยมี Log</span>';
    var days = daysBetween(lastLog.date.split('T')[0], _td());
    return days + ' วันก่อน' + (days > 14 ? ' ⚠️' : '');
  });

  h += '</tbody></table></div>';
  return h;
}

// รวม p.competitorName เป็นภาพรวมรายคู่แข่ง — ใช้ computeCompetitorStats() (utils.js)
function rCompetitorOverviewHtml() {
  var list = computeCompetitorStats();
  var h = '<div class="card"><h2>🎯 คู่แข่งที่เจอบ่อย</h2>';
  h += '<div style="font-size:11.5px;color:var(--text2);margin-bottom:10px">รวมจากช่อง "คู่แข่ง" ที่กรอกไว้ในแต่ละโครงการ</div>';
  if (!list.length) { h += '<div class="empty"><p>ยังไม่มีโครงการที่ระบุคู่แข่งไว้</p></div></div>'; return h; }

  h += '<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%">';
  h += '<thead><tr>' +
    '<th style="text-align:left;padding:8px 10px;font-size:10.5px;color:var(--text2);text-transform:uppercase">คู่แข่ง</th>' +
    '<th style="text-align:right;padding:8px 10px;font-size:10.5px;color:var(--text2);text-transform:uppercase">เจอกี่โครงการ</th>' +
    '<th style="text-align:right;padding:8px 10px;font-size:10.5px;color:var(--text2);text-transform:uppercase">มูลค่ารวม</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:10.5px;color:var(--text2);text-transform:uppercase">ผลแพ้/ชนะ</th>' +
    '<th style="text-align:right;padding:8px 10px;font-size:10.5px;color:var(--text2);text-transform:uppercase">Win Rate</th>' +
    '</tr></thead><tbody>';
  list.forEach(function(g) {
    var closed = g.won + g.lost;
    var wPct = closed ? Math.round(g.won / closed * 100) : 0;
    var rateColor = g.winRate === null ? 'var(--text3)' : g.winRate >= 60 ? '#22c55e' : g.winRate >= 40 ? '#f59e0b' : '#ef4444';
    h += '<tr style="cursor:pointer" onclick="showCompetitorPipesM(\'' + sanitize(g.name).replace(/'/g, "\\'") + '\')">' +
      '<td style="padding:8px 10px;border-bottom:1px solid var(--border-light);font-weight:600">' + sanitize(g.name) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid var(--border-light);text-align:right">' + g.count + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid var(--border-light);text-align:right">฿' + fmtMoneyShort(g.totalValue) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid var(--border-light)">' + (closed ? '<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;width:90px;background:var(--bg2)"><div style="background:#22c55e;width:' + wPct + '%"></div><div style="background:#ef4444;width:' + (100 - wPct) + '%"></div></div>' : '<span style="color:var(--text3);font-size:11px">ยังไม่ปิด</span>') + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid var(--border-light);text-align:right;color:' + rateColor + ';font-weight:700">' + (g.winRate === null ? '—' : g.winRate + '%') + '</td>' +
      '</tr>';
  });
  h += '</tbody></table></div>';

  var worst = list.filter(function(g) { return g.winRate !== null; }).sort(function(a, b) { return a.winRate - b.winRate; })[0];
  if (worst && worst.winRate < 50) {
    h += '<div style="font-size:10.5px;color:var(--text3);margin-top:10px">⚠️ ' + sanitize(worst.name) + ' แพ้บ่อยสุด (' + (100 - worst.winRate) + '%) — ลองดูโครงการที่เจอคู่นี้ว่าติดปัญหาอะไรร่วมกันไหม (เช่น ราคา/สเปก)</div>';
  }
  h += '</div>';
  return h;
}

function showCompetitorPipesM(name) {
  var list = computeCompetitorStats().filter(function(g) { return g.name === name; })[0];
  if (!list) return;
  var rows = list.pipes.map(function(p) {
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    var outcome = pipeIsWon(p) ? '✅ Won' : pipeIsLost(p) ? '❌ Lost' : '⏳ ' + (p.status || '');
    return '<div class="li" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer"><div class="lm"><div class="lt">' + sanitize((p.rowNo ? p.rowNo + ' ' : '') + (p.projectName || '')) + '</div><div class="ls">' + sanitize(d ? d.name : '-') + ' · ' + outcome + ' · ฿' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</div></div></div>';
  }).join('');
  openM('🎯 ' + name + ' — โครงการที่เจอ', rows || '<div class="empty"><p>ไม่มี</p></div>');
}

function rPipeDashboard(el) {
  document.getElementById('pgT').textContent = '📊 Pipeline Dashboard';
  var allPipes = ST.getAll('pipeline');
  var today = _td();
  var thisYM = today.substr(0, 7);

  var active = [], won = [], lost = [];
  var activeAmt = 0, wonAmt = 0;
  allPipes.forEach(function(p) {
    var amt = Number(p.forecastAmount) || 0;
    // เช็ค status === 'deliver' ตรงๆ ควบคู่กับ pipeIsWon — งานที่ส่งมอบแล้วจบแล้วจริงๆ ไม่ควรไปนับเป็น
    // "Active" แม้ config category ของ Deliver จะถูกแก้จน pipeIsWon คืน false ก็ตาม (กันเปอร์เซ็นต์เพี้ยน)
    if (pipeIsWon(p) || p.status === 'deliver') { won.push(p); wonAmt += amt; }
    else if (p.status === 'fail_lost' || pipeIsLost(p)) { lost.push(p); }
    else { active.push(p); activeAmt += amt; }
  });
  var closedCount = won.length + lost.length;
  var winRate = closedCount > 0 ? Math.round(won.length / closedCount * 100) : 0;
  var wrColor = winRate >= 70 ? '#22c55e' : winRate >= 50 ? '#f59e0b' : '#ef4444';
  var closingThis = active.filter(function(p) {
    var cd = p.expectedCloseDate || p.biddingDate;
    return cd && cd.substr(0,7) === thisYM;
  });

  // ── Zone A: Stats ──
  var h = '<div class="sr" style="margin-bottom:12px">' +
    '<div class="sc"><div class="sn c1">' + allPipes.length + '</div><div class="sl">ทั้งหมด</div></div>' +
    '<div class="sc"><div class="sn c2">' + active.length + '</div><div class="sl">Active</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(activeAmt) + '</div><div class="sl">มูลค่า Active</div></div>' +
    '<div class="sc"><div class="sn c5">' + closingThis.length + '</div><div class="sl">ปิดเดือนนี้</div></div>' +
    '<div class="sc"><div class="sn c2">' + won.length + '</div><div class="sl">Won</div></div>' +
    '<div class="sc"><div class="sn" style="color:' + wrColor + '">' + winRate + '%</div><div class="sl">Win Rate</div></div>' +
    '</div>';

  // ── Zone B: Monthly Timeline (6 months) ──
  var thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var months = [];
  var d = new Date(today + 'T00:00:00');
  d.setDate(1);
  for (var mi = 0; mi < 6; mi++) {
    var y = d.getFullYear(), m = d.getMonth();
    var ym = y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1);
    months.push({ ym: ym, year: y, month: m, pipes: [], amt: 0 });
    d.setMonth(d.getMonth() + 1);
  }
  active.forEach(function(p) {
    var cd = p.expectedCloseDate || p.biddingDate;
    if (!cd) return;
    var ym = cd.substr(0, 7);
    for (var i = 0; i < months.length; i++) {
      if (months[i].ym === ym) { months[i].pipes.push(p); months[i].amt += Number(p.forecastAmount) || 0; break; }
    }
  });
  var maxAmt = 0;
  months.forEach(function(mo) { if (mo.amt > maxAmt) maxAmt = mo.amt; });

  h += '<div class="card" style="margin-bottom:10px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h += '<h2 style="margin:0">📅 Timeline 6 เดือน</h2>';
  h += '<span style="font-size:.68rem;color:var(--text3)">Expected Close / Bidding Date</span></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';

  months.forEach(function(mo) {
    var thaiYr = String(mo.year + 543).substr(2);
    var label = thMonths[mo.month] + ' ' + thaiYr;
    var isThis = mo.ym === thisYM;
    var barPct = maxAmt > 0 ? Math.round(mo.amt / maxAmt * 100) : 0;
    var borderCol = isThis ? 'var(--accent)' : 'var(--border)';
    var bgCol = isThis ? 'var(--accent-light)' : 'var(--bg2)';

    h += '<div style="background:' + bgCol + ';border:1px solid ' + borderCol + ';border-radius:10px;padding:10px;' + (mo.pipes.length ? 'cursor:pointer' : '') + '"' +
      (mo.pipes.length ? ' onclick="showPipeMonthM(\'' + mo.ym + '\')"' : '') + '>';
    h += '<div style="font-size:.72rem;font-weight:700;color:' + (isThis ? 'var(--accent)' : 'var(--text3)') + ';margin-bottom:4px">' + label + (isThis ? ' ◀' : '') + '</div>';
    h += '<div style="font-size:1.15rem;font-weight:800;color:' + (mo.pipes.length ? 'var(--text)' : 'var(--text3)') + '">' + mo.pipes.length + ' <span style="font-size:.62rem;font-weight:400;color:var(--text3)">โครงการ</span></div>';
    h += '<div style="font-size:.7rem;color:#22c55e;margin:2px 0 4px">' + (mo.amt ? fmtMoneyShort(mo.amt) : '—') + '</div>';
    if (mo.pipes.length) {
      h += '<div style="height:3px;background:var(--border);border-radius:2px;margin-bottom:5px"><div style="height:3px;background:var(--accent);border-radius:2px;width:' + barPct + '%"></div></div>';
      mo.pipes.slice(0, 2).forEach(function(p) {
        h += '<div style="font-size:.6rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">• ' + sanitize((p.projectName || '').substr(0, 22)) + '</div>';
      });
      if (mo.pipes.length > 2) h += '<div style="font-size:.58rem;color:var(--text3)">+' + (mo.pipes.length - 2) + ' เพิ่มเติม</div>';
    }
    h += '</div>';
  });
  h += '</div></div>';

  // ── Zone C: Action needed ──
  var actionItems = active.filter(function(p) {
    var fd = p.followupDate ? dTo(p.followupDate) : null;
    var bd = p.biddingDate ? dTo(p.biddingDate) : null;
    var cd = p.expectedCloseDate ? dTo(p.expectedCloseDate) : null;
    return (fd !== null && fd <= 14) ||
           (bd !== null && bd >= 0 && bd <= 14) ||
           (cd !== null && cd >= 0 && cd <= 14);
  });
  actionItems.sort(function(a, b) {
    var da = Math.min(
      a.followupDate ? dTo(a.followupDate) : 999,
      a.biddingDate  ? Math.max(0, dTo(a.biddingDate)) : 999,
      a.expectedCloseDate ? Math.max(0, dTo(a.expectedCloseDate)) : 999
    );
    var db = Math.min(
      b.followupDate ? dTo(b.followupDate) : 999,
      b.biddingDate  ? Math.max(0, dTo(b.biddingDate)) : 999,
      b.expectedCloseDate ? Math.max(0, dTo(b.expectedCloseDate)) : 999
    );
    return da - db;
  });

  h += '<div class="card" style="margin-bottom:10px">';
  h += '<h2>🔔 ต้องจัดการ <span style="font-size:.7rem;font-weight:400;color:#64748b">Followup / Bidding / Close ภายใน 14 วัน</span></h2>';
  if (!actionItems.length) {
    h += '<div style="text-align:center;padding:16px;color:#475569;font-size:.85rem">ไม่มีรายการเร่งด่วน ✅</div>';
  } else {
    actionItems.slice(0, 8).forEach(function(p) {
      var dealer = ST.getOne('dealers', p.dealerId);
      var fd = p.followupDate ? dTo(p.followupDate) : null;
      var bd = p.biddingDate  ? dTo(p.biddingDate)  : null;
      var cd = p.expectedCloseDate ? dTo(p.expectedCloseDate) : null;
      h += '<div class="li" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer">';
      h += '<div class="lm">';
      h += '<div class="lt">' + sanitize((p.projectName || '').substr(0, 45)) + '</div>';
      var _naC = pipeNextActionHtml(p, true);
      h += '<div class="ls">' + (dealer ? dealer.name : '-') + (_naC ? ' • ' + _naC : '') + '</div>';
      h += '<div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap">';
      if (fd !== null) h += dlB(p.followupDate, false);
      if (bd !== null && bd >= 0 && bd <= 14) h += '<span style="font-size:.62rem;background:rgba(124,58,237,.15);color:#a78bfa;padding:1px 6px;border-radius:4px">🎯 Bid ' + fDShort(p.biddingDate) + '</span>';
      if (cd !== null && cd >= 0 && cd <= 14) h += '<span style="font-size:.62rem;background:rgba(34,197,94,.12);color:#22c55e;padding:1px 6px;border-radius:4px">✅ Close ' + fDShort(p.expectedCloseDate) + '</span>';
      h += '</div></div></div>';
    });
    if (actionItems.length > 8) {
      h += '<div style="text-align:center;padding:6px"><button class="btn bsm bo" onclick="go(\'pipeline\')">ดูทั้งหมด (' + actionItems.length + ')</button></div>';
    }
  }
  h += '</div>';

  h += '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    '<button class="btn bp" onclick="go(\'pipeline\')">📋 ดู Pipeline ทั้งหมด</button>' +
    '<button class="btn bo" onclick="go(\'pipeBoard\')">🃏 Board View</button>' +
    '</div>';

  el.innerHTML = h;
}

function showPipeMonthM(ym) {
  var allPipes = ST.getAll('pipeline');
  var pipes = allPipes.filter(function(p) {
    if (pipeIsWon(p) || pipeIsLost(p) || p.status === 'deliver') return false;
    var cd = p.expectedCloseDate || p.biddingDate;
    return cd && cd.substr(0, 7) === ym;
  });
  pipes.sort(function(a, b) { return (Number(b.forecastAmount)||0) - (Number(a.forecastAmount)||0); });

  var thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var parts = ym.split('-');
  var label = thMonths[parseInt(parts[1]) - 1] + ' ' + (parseInt(parts[0]) + 543);
  var totalAmt = pipes.reduce(function(a, p) { return a + (Number(p.forecastAmount)||0); }, 0);

  var h = '<div style="font-size:.78rem;color:#64748b;margin-bottom:10px">' + pipes.length + ' โครงการ • รวม ' + fmtMoneyShort(totalAmt) + '</div>';
  if (!pipes.length) { h += '<div style="text-align:center;padding:20px;color:#475569">ไม่มีโครงการในเดือนนี้</div>'; }
  pipes.forEach(function(p) {
    var dealer = ST.getOne('dealers', p.dealerId);
    var hasClose = p.expectedCloseDate && p.expectedCloseDate.substr(0,7) === ym;
    h += '<div class="li" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer">' +
      '<div class="lm">' +
      '<div class="lt">' + sanitize(p.projectName || '') + '</div>' +
      '<div class="ls">' + (dealer ? dealer.name : '-') + ' • ' + sanitize(p.endUserTH || '-') + '</div>' +
      '<div style="display:flex;gap:5px;align-items:center;margin-top:3px;flex-wrap:wrap">' +
      pipeTag(p.status) + (_gvHidden('pipeline_forecast') ? '' : (' ' + fmtMoneyStyled(Number(p.forecastAmount)||0))) +
      (hasClose ? ' <span style="font-size:.62rem;background:rgba(34,197,94,.12);color:#22c55e;padding:1px 6px;border-radius:4px">🎯 ' + fDShort(p.expectedCloseDate) + '</span>' : '') +
      '</div>' +
      '</div></div>';
  });
  openM('📅 โครงการเดือน ' + label, h);
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
  if (typeof syncToFirebase === 'function') syncToFirebase('pipeActions', list);
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

var pipeSummaryFullValue = false; // toggle: มูลค่าเต็ม (มีคอมมา) หรือแบบย่อ (K/M) — ใช้ร่วมกันทั้งการ์ด
// "สรุปรายการสินค้า" ในหน้ารายละเอียดโครงการ และ modal เทียบ Project (คุมด้วยปุ่มเดียว)
function togglePipeSummaryFullValue() {
  pipeSummaryFullValue = !pipeSummaryFullValue;
  // ถ้า modal เทียบ Project เปิดอยู่ ให้ re-render modal นั้นแทนหน้าเดิม (openM() แค่เขียนทับ innerHTML
  // ไม่มี re-render อัตโนมัติแบบหน้าเพจปกติ)
  if (pipeCompareSelected.length >= 2 && document.getElementById('modal').classList.contains('show')) {
    openPipeCompareModal();
  } else {
    render();
  }
}

// เทียบราคา — เปิด/ปิดทั้งชุด + เลือกเป็นคอลัมน์ (ประหยัดที่ ไม่ต้องโชว์ทุก Level พร้อมกัน)
// default เปิดแค่ B (Level ที่ใช้บ่อยสุด) กับ "เสนอราคาจริง" — คุมด้วยปุ่มเดียวกันทุกโครงการที่เปิดดู
var pipeCompareOn = false;
var pipeCompareCols = { rrp: false, s: false, a: false, b: true, other: false, quoted: true };
function togglePipeCompare() { pipeCompareOn = !pipeCompareOn; render(); }
function togglePipeCompareCol(key) { pipeCompareCols[key] = !pipeCompareCols[key]; render(); }

// ใบเสนอราคาล่าสุดที่ผูกกับ pipeline นี้ (ถ้ามีหลายใบ เอาใบล่าสุดตาม createdAt)
function _pipeLatestQuote(pipeId) {
  var allQuotes = [];
  try { allQuotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch(e) {}
  var quotes = allQuotes.filter(function(q) { return q.pipelineId === pipeId; });
  if (!quotes.length) return null;
  quotes.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  return quotes[0];
}
// ราคา/หน่วยที่เสนอจริงในใบนั้น จับคู่ด้วย SKU ก่อน ไม่เจอค่อย fallback ไปจับคู่ด้วยชื่อ model
function _pipeQuotedUnitPrice(quote, sku, model) {
  if (!quote || !quote.items) return null;
  var skuKey = (sku || '').toLowerCase();
  var nameKey = (model || '').trim().toLowerCase();
  var byName = null;
  for (var i = 0; i < quote.items.length; i++) {
    var it = quote.items[i];
    if (skuKey && (it.sku || '').toLowerCase() === skuKey) return Number(it.unitPrice) || 0;
    if (!byName && (it.name || '').trim().toLowerCase() === nameKey) byName = Number(it.unitPrice) || 0;
  }
  return byName;
}

// สรุปรายการสินค้าของโครงการนี้ — ชิปตามหมวดหมู่ (Drone/Payload/...) + ตาราง SKU/Model/QTY/มูลค่า
// หน้าตาเดียวกับการ์ด Forecast ตาม Dealer (buildFcDealerSummary ใน views-today.js) แต่ดึงจาก getPipeItems(p)
// ของโครงการเดียวแทนที่จะรวมทั้ง dealer — ต่อยอดเพิ่มโหมด "เทียบราคา" (RRP/S/A/B/Other + ราคาที่เสนอจริง)
function pipeModelSummaryCardHtml(p) {
  var items = getPipeItems(p);
  if (!items.length) return '';

  var catTotals = {};
  var byModel = {};
  var totalQty = 0, totalAmt = 0;
  items.forEach(function(it) {
    var model = it.model || 'ไม่ระบุ';
    var qty = Number(it.qty) || 1;
    var amt = Number(it.total) || (qty * (Number(it.price) || 0));
    var cat = getModelCategory(model);
    catTotals[cat] = (catTotals[cat] || 0) + qty;
    if (!byModel[model]) byModel[model] = { model: model, sku: it.sku || '', qty: 0, amount: 0, unitPrice: Number(it.price) || 0, batches: [] };
    byModel[model].qty += qty;
    byModel[model].amount += amt;
    if (it.shipBatches && it.shipBatches.length) byModel[model].batches = byModel[model].batches.concat(it.shipBatches);
    totalQty += qty;
    totalAmt += amt;
  });

  var catOrder = (typeof PRODUCT_CATEGORIES !== 'undefined') ? PRODUCT_CATEGORIES.map(function(c) { return c.id; }) : Object.keys(catTotals);
  var catIds = Object.keys(catTotals).sort(function(a, b) { return catOrder.indexOf(a) - catOrder.indexOf(b); });
  var catChipsHtml = catIds.map(function(cid) {
    var name = (typeof getCategoryName === 'function') ? getCategoryName(cid) : cid;
    return '<div class="fcd-cat-chip"><span class="fcd-cat-chip-name">' + sanitize(name) + '</span><span class="fcd-cat-chip-qty">' + catTotals[cid] + ' ชิ้น</span></div>';
  }).join('');

  var modelList = Object.values(byModel);
  var fmtAmt = pipeSummaryFullValue ? function(v) { return fmtMoney(v) + ' ฿'; } : fmtMoneyShort;

  var latestQuote = _pipeLatestQuote(p.id);

  var h = '<div class="card"><h2>📦 สรุปรายการสินค้า <span class="ml">' +
    '<button class="btn bsm bo" onclick="togglePipeSummaryFullValue()">' + (pipeSummaryFullValue ? '🔍 แสดงแบบย่อ' : '🔍 แสดงมูลค่าเต็ม') + '</button>' +
    '<button class="btn bsm ' + (pipeCompareOn ? 'bp' : 'bo') + '" onclick="togglePipeCompare()">⚖️ เทียบราคา</button>' +
    (latestQuote ? '<button class="btn bsm bo" onclick="renderEditQuotationPage(getQuoteById(\'' + latestQuote.id + '\'))">📄 ' + sanitize(latestQuote.quoteNo) + ' ↗</button>' : '') +
    '</span></h2>';
  h += '<div class="fcd-cats" style="margin-bottom:12px">' + catChipsHtml + '</div>';

  var CMP_COLS = [
    { key: 'rrp', label: 'RRP ex VAT' }, { key: 's', label: 'S' }, { key: 'a', label: 'A' },
    { key: 'b', label: 'B' }, { key: 'other', label: 'Other' }, { key: 'quoted', label: 'เสนอราคาจริง' }
  ];
  if (pipeCompareOn) {
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed var(--border,#334155)">';
    h += '<span style="font-size:11px;color:var(--text2);align-self:center;margin-right:2px">เทียบ:</span>';
    CMP_COLS.forEach(function(c) {
      var on = !!pipeCompareCols[c.key];
      h += '<span onclick="togglePipeCompareCol(\'' + c.key + '\')" style="cursor:pointer;padding:3px 10px;border-radius:14px;font-size:11px;' +
        (on ? 'border:2px solid var(--accent);background:var(--accent-light);color:var(--accent)' : 'border:1px solid var(--border);color:var(--text2)') + '">' + c.label + '</span>';
    });
    h += '</div>';
  }

  var showCol = function(key) { return pipeCompareOn && pipeCompareCols[key]; };

  h += '<div style="overflow-x:auto"><table class="fcd-table" style="min-width:100%">';
  h += '<thead><tr><th>SKU</th><th>Model</th><th style="text-align:center">QTY</th><th style="text-align:right">มูลค่า</th>';
  CMP_COLS.forEach(function(c) { if (showCol(c.key)) h += '<th style="text-align:right' + (c.key === 'b' ? ';background:var(--accent-light)' : '') + '">' + c.label + '</th>'; });
  h += '</tr></thead><tbody>';

  var _pmMonthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var cmpTotals = { rrp: 0, s: 0, a: 0, b: 0, other: 0, quoted: 0 };
  var cmpHasAny = { rrp: false, s: false, a: false, b: false, other: false, quoted: false };

  modelList.forEach(function(m) {
    var prod = pipeCompareOn ? _pipeResolveProduct(m.sku || m.model) : null;
    var tp = prod ? (prod.typePrices || {}) : null;

    h += '<tr>';
    h += '<td style="font-size:11px">' + (m.sku ? qcopyHtml(m.sku) : '-') + '</td>';
    h += '<td>' + sanitize(m.model) + '</td>';
    h += '<td style="text-align:center">' + m.qty + '</td>';
    h += '<td style="text-align:right">' + fmtAmt(m.amount) + '</td>';

    if (pipeCompareOn) {
      if (!prod) {
        var colCount = CMP_COLS.filter(function(c) { return showCol(c.key); }).length;
        if (colCount) h += '<td colspan="' + colCount + '" style="text-align:center;color:var(--text2);font-size:11px">ไม่พบในแคตตาล็อก</td>';
      } else {
        CMP_COLS.forEach(function(c) {
          if (!showCol(c.key)) return;
          var unitVal, cellAmt;
          if (c.key === 'rrp') unitVal = Number(prod.rrpExVat) || 0;
          else if (c.key === 'quoted') unitVal = _pipeQuotedUnitPrice(latestQuote, m.sku, m.model);
          else unitVal = Number(tp[c.key === 's' ? 'S' : c.key === 'a' ? 'A' : c.key === 'b' ? 'B' : 'Other']) || 0;
          if (unitVal == null) { h += '<td style="text-align:center;color:var(--text2)">-</td>'; return; }
          cellAmt = unitVal * m.qty;
          cmpTotals[c.key] += cellAmt;
          cmpHasAny[c.key] = true;
          var isCurLevel = c.key !== 'rrp' && c.key !== 'quoted' && Math.round(unitVal) === Math.round(m.unitPrice);
          h += '<td style="text-align:right' + (c.key === 'b' ? ';background:var(--accent-light)' : '') + (c.key === 'quoted' ? ';color:#22c55e' : '') + (isCurLevel ? ';font-weight:700' : '') + '" title="' + (isCurLevel ? 'ตรงกับราคาที่ใช้อยู่ในโครงการนี้' : '') + '">' + fmtAmt(cellAmt) + '</td>';
        });
      }
    }
    h += '</tr>';

    if (m.batches && m.batches.length) {
      var batchLabel = m.batches.map(function(b) {
        var parts = (b.month || '').split('-');
        var mLabel = (parts.length === 2) ? (_pmMonthNames[parseInt(parts[1], 10) - 1] + ' ' + (parseInt(parts[0], 10) + 543 - 2500)) : '?';
        return mLabel + ' x' + (Number(b.qty) || 0);
      }).join(', ');
      var _colspanAll = 4 + CMP_COLS.filter(function(c) { return showCol(c.key); }).length;
      h += '<tr><td colspan="' + _colspanAll + '" style="font-size:10px;color:var(--text2);padding-top:0">🚚 แบ่งส่ง: ' + sanitize(batchLabel) + '</td></tr>';
    }
  });

  h += '<tr style="font-weight:700;border-top:2px solid var(--border)"><td colspan="2">รวม</td><td style="text-align:center">' + totalQty + '</td><td style="text-align:right">' + fmtAmt(totalAmt) + '</td>';
  CMP_COLS.forEach(function(c) {
    if (!showCol(c.key)) return;
    h += '<td style="text-align:right' + (c.key === 'b' ? ';background:var(--accent-light)' : '') + (c.key === 'quoted' ? ';color:#22c55e' : '') + '">' + (cmpHasAny[c.key] ? fmtAmt(cmpTotals[c.key]) : '-') + '</td>';
  });
  h += '</tr>';
  h += '</tbody></table></div></div>';
  return h;
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
  h += '<div class="fm-actions"><button class="btn bp" onclick="savePipeAction(\'' + pipeId + '\')">💾 บันทึก</button><button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
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
      <button class="btn bp" onclick="savePipelineLogEdit('${logId}', '${pipeId}')">💾 บันทึก</button>
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
// รวม Update เก่าให้เหลือรายการเดียว — คอลัมน์ Update 1-6 ตอน export/copy row
// เก็บได้แค่ 6 รายการแรก (เรียงเก่า→ใหม่) พอเกิน 6 รายการที่ 7 เป็นต้นไปจะหลุดไม่ถูก export
// ปุ่มนี้ให้เลือก Update เก่าๆ มารวมเป็นรายการเดียว (คงวันที่เก่าสุดไว้) เพื่อเปิดช่องว่างให้ Update ใหม่เข้ามาแทนได้
// ================================================================
function showMergePipeLogsM(pipeId) {
  var logs = ST.pipeLogsByPipe(pipeId).slice().reverse(); // เก่า→ใหม่ ให้ตรงลำดับ Update 1,2,3...
  var lastIdx = logs.length - 1; // ตัวล่าสุด — default ไม่ติ๊ก ให้ยังเห็นเดี่ยวๆ ในช่อง Update ถัดไปหลังรวม
  var rows = logs.map(function(l, idx) {
    return '<label style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer">' +
      '<input type="checkbox" class="mergeLogChk" value="' + l.id + '" style="margin-top:3px"' + (idx === lastIdx ? '' : ' checked') + '>' +
      '<div><div style="font-size:11px;color:var(--text2)">Update ' + (idx + 1) + ' — ' + fDT(l.date) + (idx === lastIdx ? ' <span style="color:var(--accent)">(ล่าสุด)</span>' : '') + '</div>' +
      '<div style="font-size:.85rem">' + sanitize(l.content) + '</div></div></label>';
  }).join('');
  openM('🔗 รวม Update เก่า', `
    <div style="font-size:.78rem;color:var(--text2);margin-bottom:8px">Default ติ๊กรวมทุกรายการยกเว้นตัวล่าสุด — กด "รวมที่เลือก" ตรงๆ ได้เลย ก็จะได้ Update ล่าสุดโชว์เดี่ยวๆ อยู่ช่องถัดจากก้อนที่รวม (ปรับติ๊กเองได้ตามต้องการ)</div>
    <div style="max-height:340px;overflow-y:auto">${rows}</div>
    <div class="fm-actions" style="margin-top:10px">
      <button class="btn bp" onclick="mergeSelectedPipeLogs('${pipeId}')">🔗 รวมที่เลือก</button>
      <button class="btn" onclick="closeM()">ยกเลิก</button>
    </div>
  `);
}

function mergeSelectedPipeLogs(pipeId) {
  var checked = Array.prototype.slice.call(document.querySelectorAll('.mergeLogChk:checked')).map(function(c) { return c.value; });
  if (checked.length < 2) { toast('เลือกอย่างน้อย 2 รายการเพื่อรวม'); return; }
  var logs = ST.pipeLogsByPipe(pipeId).filter(function(l) { return checked.indexOf(l.id) !== -1; });
  logs.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); }); // เก่า→ใหม่
  var combined = logs.map(function(l) { return '[' + fDT(l.date) + '] ' + (l.content || ''); }).join('\n');
  var earliestDate = logs[0].date;
  logs.forEach(function(l) { ST.delete('pipeLog', l.id); });
  ST.add('pipeLog', {
    pipeId: pipeId,
    type: 'note',
    content: '🔗 รวม Update เก่า (' + logs.length + ' รายการ):\n' + combined,
    date: earliestDate
  });
  closeMForce();
  toast('🔗 รวม ' + logs.length + ' Update เป็นรายการเดียวแล้ว');
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
      html += '<button class="btn bs" onclick="batchApproveForecastSelected()">✅ Approve ที่เลือก</button>';
      html += '<button class="btn bp" onclick="batchApproveForecastAll()">✅ Approve ทั้งหมด (' + pendingUpdates.length + ')</button>';
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

// batchApproveForecastSelected / batchApproveForecastAll / approveForecastUpdate / rejectForecastUpdate
// ถูกย้ายไปรวมที่ app.js ทั้งหมด (เวอร์ชันเดียว มี audit log + อนุมัติทีละรายการตามลำดับกันชนกัน)
// เดิมเวอร์ชันที่นี่ยิงอนุมัติพร้อมกันหมด (race condition) และถูก app.js override อยู่แล้วเสมอ (โหลดทีหลัง)
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

// ================================================================
// SHEET EDIT (jexcel — Pipeline)
// ================================================================
var _pipeSheetInstance = null;
var _pipeSheetIds = [];
var _pipeDeletedIds = [];

// cols: 0=RegDate,1=ProjName,2=EUTH,3=EUEN,4=Unit,5=Dealer,6=DJI,7=Revenue,
//       8=Model,9=M3M,10=M4T,11=M4E,12=Dock3,13=M4TD,14=M400,
//       15=Forecast,16=Real,17=BidDate,18=ShipDate,19=Status,20=Sale,21=Remark

// Parses "Name*qty\n..." Model cell text → fills 6 qty cells via jexcel
function _autoCalcPipeQty(el, rowIdx, modelText, qtyStartCol) {
  var g = { m3m: 0, m4t: 0, m4e: 0, dock3: 0, m4td: 0, m400: 0 };
  (modelText || '').split('\n').filter(Boolean).forEach(function(line) {
    var parts = line.split('*');
    var name = (parts[0] || '').trim().toUpperCase();
    var qty = parseInt(parts[1]) || 1;
    if      (name.indexOf('M3M') !== -1 || name.indexOf('MULTISPECTRAL') !== -1 || name.indexOf('MATRICE 3M') !== -1) g.m3m  += qty;
    else if (name.indexOf('M4TD') !== -1 || name.indexOf('MATRICE 4TD') !== -1)                                       g.m4td += qty;
    else if (name.indexOf('M4T') !== -1  || name.indexOf('MATRICE 4T') !== -1)                                        g.m4t  += qty;
    else if (name.indexOf('M4E') !== -1  || name.indexOf('MATRICE 4E') !== -1)                                        g.m4e  += qty;
    else if (name.indexOf('M400') !== -1 || name.indexOf('MATRICE 400') !== -1)                                       g.m400 += qty;
    else if (name.indexOf('DOCK') !== -1)                                                                              g.dock3 += qty;
  });
  var sheet = el.jexcel;
  if (!sheet) return;
  [g.m3m, g.m4t, g.m4e, g.dock3, g.m4td, g.m400].forEach(function(qty, i) {
    sheet.setValueFromCoords(qtyStartCol + i, rowIdx, qty || '', true);
  });
}

var _pipeSheetUndo = null;

function _snapPipeSheet() {
  var el = document.getElementById('pipeSheetEl');
  if (!el || !el.jexcel) return;
  _pipeSheetUndo = el.jexcel.getData().map(function(r) { return r.slice(); });
  var btn = document.getElementById('btnPipeUndo');
  if (btn) btn.style.display = '';
}

function undoPipeSheet() {
  if (!_pipeSheetUndo) return;
  var el = document.getElementById('pipeSheetEl');
  if (!el || !el.jexcel) return;
  var sheet = el.jexcel;
  _pipeSheetUndo.forEach(function(row, r) {
    row.forEach(function(val, c) { sheet.setValueFromCoords(c, r, val, true); });
  });
  _pipeSheetUndo = null;
  var btn = document.getElementById('btnPipeUndo');
  if (btn) btn.style.display = 'none';
  setTimeout(_refreshPipeSheetStyles, 100);
  toast('↩️ คืนค่าเดิมแล้ว');
}

function recalcAllPipeQty() {
  var el = document.getElementById('pipeSheetEl');
  if (!el || !el.jexcel) { toast('⚠️ เปิด Sheet mode ก่อน'); return; }
  _snapPipeSheet();
  el.jexcel.getData().forEach(function(row, idx) {
    if (row[8]) _autoCalcPipeQty(el, idx, row[8], 9);
  });
  setTimeout(_refreshPipeSheetStyles, 100);
  toast('🔄 คำนวณ Qty จาก Model แล้ว — กด ↩️ Undo เพื่อคืนค่า');
}

// ราคาต่อหน่วยของ product ตามเรทที่เลือก — level มาจาก dealer ของแถวนั้นๆ
function _pipeRevUnitPrice(product, rate, level) {
  if (rate === 'rrpIn') return Number(product.rrpInVat) || 0;
  if (rate === 'level') return window.getModelPriceByLevel(product.name, level) || 0;
  return Number(product.rrpExVat) || Number(product.price) || 0; // rrpEx (default)
}

// ดึงรายการสินค้าจริงของแถวนั้น (ทุกชนิด ไม่จำกัดแค่ 6 กลุ่มเดิม) จาก pipeline object จริง
// ใช้ _pipeSheetIds (row index → pipeline id) + getPipeItems() ที่รองรับทั้ง items[] และ model/modelQty แบบเก่า
function _pipeRevItemsForRow(idx) {
  var pipeId = _pipeSheetIds && _pipeSheetIds[idx];
  var p = pipeId ? ST.getOne('pipeline', pipeId) : null;
  if (!p) return [];
  return getPipeItems(p);
}

// รวมยอดทั้งชีทแยกตามเรท + ต้นทุน สำหรับตารางเปรียบเทียบ — คำนวณจากสินค้าจริงในแต่ละโครงการ ไม่จำกัดกลุ่ม
function _pipeRevCompareData() {
  var el = document.getElementById('pipeSheetEl');
  var dealers = ST.getAll('dealers');
  var dealerByName = {};
  dealers.forEach(function(d) { if (d.name) dealerByName[d.name.trim().toLowerCase()] = d; });
  var tot = { rrpEx: 0, rrpIn: 0, level: 0, cost: 0, noCostNames: {}, unmatchedNames: {} };
  el.jexcel.getData().forEach(function(row, idx) {
    var dealer = dealerByName[((row[5] || '').trim()).toLowerCase()];
    var lvl = (dealer && dealer.level) || 'Other';
    _pipeRevItemsForRow(idx).forEach(function(it) {
      var qty = Number(it.qty) || 0;
      if (!qty || !it.model) return;
      var p = Products.getByName(it.model);
      if (!p) { tot.unmatchedNames[it.model] = true; return; }
      tot.rrpEx += qty * _pipeRevUnitPrice(p, 'rrpEx');
      tot.rrpIn += qty * _pipeRevUnitPrice(p, 'rrpIn');
      tot.level += qty * _pipeRevUnitPrice(p, 'level', lvl);
      if (Number(p.cost) > 0) tot.cost += qty * Number(p.cost);
      else tot.noCostNames[p.name] = true;
    });
  });
  return tot;
}

function calcAllPipeRevenue() {
  var el = document.getElementById('pipeSheetEl');
  if (!el || !el.jexcel) { toast('⚠️ เปิด Sheet mode ก่อน'); return; }
  if (typeof Products === 'undefined' || !Products.getByName) { toast('⚠️ โหลดข้อมูลสินค้าไม่สำเร็จ'); return; }

  var c = _pipeRevCompareData();
  var diff = c.level - c.rrpEx;
  var diffPct = c.rrpEx ? (diff / c.rrpEx * 100) : 0;
  var profit = c.level - c.cost;
  var profitPct = c.level ? (profit / c.level * 100) : 0;
  var noCostList = Object.keys(c.noCostNames);
  var unmatchedList = Object.keys(c.unmatchedNames);

  function rowH(label, val, extra, color) {
    return '<tr><td style="padding:4px 10px;color:var(--text2)">' + label + '</td>' +
      '<td style="padding:4px 10px;text-align:right;font-weight:600' + (color ? ';color:' + color : '') + '">' + fmtMoney(val) + ' ฿' + (extra || '') + '</td></tr>';
  }

  var h = '<div style="max-width:440px">';
  h += '<div class="fg"><label>เลือกเรทที่จะเติมลงคอลัมน์ Revenue</label><div class="radio-g" style="flex-direction:column;gap:4px">' +
    '<label><input type="radio" name="pipeRevRate" value="rrpEx" checked><span>RRP Ex VAT (ราคาตลาด ไม่รวม VAT) — ค่าเริ่มต้น</span></label>' +
    '<label><input type="radio" name="pipeRevRate" value="rrpIn"><span>RRP In VAT (ราคาตลาด รวม VAT)</span></label>' +
    '<label><input type="radio" name="pipeRevRate" value="level"><span>ราคาตาม Dealer Level (ของแต่ละแถว)</span></label>' +
    '</div></div>';

  h += '<div style="margin-top:10px;border:1px solid var(--border);border-radius:8px;overflow:hidden">' +
    '<div style="padding:6px 10px;background:var(--bg2);font-size:.8rem;font-weight:700">📊 เปรียบเทียบ (รวมทั้งชีท จาก Qty ปัจจุบัน)</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.82rem">' +
    rowH('RRP Ex VAT รวม', c.rrpEx) +
    rowH('RRP In VAT รวม', c.rrpIn) +
    rowH('ราคาตาม Level รวม', c.level) +
    rowH('ส่วนต่าง Level vs RRP Ex', diff, ' (' + (diffPct >= 0 ? '+' : '') + diffPct.toFixed(1) + '%)', diff < 0 ? '#ef4444' : '#22c55e') +
    rowH('ต้นทุนรวม', c.cost) +
    rowH('กำไร (Level − ต้นทุน)', profit, ' (' + profitPct.toFixed(1) + '%)', profit >= 0 ? '#22c55e' : '#ef4444') +
    '</table></div>';

  if (noCostList.length) {
    h += '<div style="margin-top:8px;font-size:11px;background:#f59e0b18;border:1px solid #f59e0b40;border-radius:6px;padding:6px 10px">⚠️ สินค้ายังไม่มีต้นทุนในแคตตาล็อก: ' + noCostList.map(sanitize).join(', ') + ' — แถวกำไรจึงสูงกว่าจริง</div>';
  }
  if (unmatchedList.length) {
    h += '<div style="margin-top:8px;font-size:11px;background:#ef444418;border:1px solid #ef444440;border-radius:6px;padding:6px 10px">⚠️ ชื่อสินค้าไม่พบใน catalog เลย (ไม่ถูกนับเข้า Revenue): ' + unmatchedList.map(sanitize).join(', ') + '</div>';
  }

  h += '<div class="fm-actions" style="margin-top:12px">' +
    '<button class="btn bp" onclick="applyPipeRevenueRate(document.querySelector(\'input[name=pipeRevRate]:checked\').value)">✔ คำนวณและเติมลงชีท</button>' +
    '<button class="btn" onclick="closeM()">ปิด</button></div></div>';

  openM('💰 คำนวณ Revenue', h);
}

function applyPipeRevenueRate(rate) {
  closeM();
  var el = document.getElementById('pipeSheetEl');
  if (!el || !el.jexcel) return;
  _snapPipeSheet();
  var dealers = ST.getAll('dealers');
  var dealerByName = {};
  dealers.forEach(function(d) { if (d.name) dealerByName[d.name.trim().toLowerCase()] = d; });

  var rateLabel = rate === 'rrpIn' ? 'RRP In VAT' : (rate === 'level' ? 'ราคาตาม Level' : 'RRP Ex VAT');
  var filled = 0;
  el.jexcel.getData().forEach(function(row, idx) {
    var dealer = dealerByName[((row[5] || '').trim()).toLowerCase()];
    var lvl = (dealer && dealer.level) || 'Other';
    var total = 0;
    _pipeRevItemsForRow(idx).forEach(function(it) {
      var qty = Number(it.qty) || 0;
      if (!qty || !it.model) return;
      var product = Products.getByName(it.model);
      if (!product) return;
      total += qty * _pipeRevUnitPrice(product, rate, lvl);
    });

    if (total > 0) {
      el.jexcel.setValueFromCoords(7, idx, total, true); // col 7 = Revenue
      filled++;
    }
  });
  setTimeout(_refreshPipeSheetStyles, 100);
  toast('💰 เติม Revenue (' + rateLabel + ') ' + filled + ' รายการ — กด ↩️ Undo เพื่อคืนค่า');
}

function initPipeSheet(pipes) {
  if (typeof jexcel === 'undefined') { toast('⚠️ โหลด jspreadsheet ไม่สำเร็จ (ต้องออนไลน์)'); return; }
  var el = document.getElementById('pipeSheetEl');
  if (!el) return;
  if (el.jexcel) { jexcel.destroy(el); el.innerHTML = ''; }

  var cfg = getConfig();
  var statusNames = (cfg.pipelineStatuses || []).map(function(s) { return s.name; });
  if (!statusNames.length) statusNames = ['Prospect','TOR Review','Quotation','Bidding','Negotiation','Win','Lost'];

  var dealers = ST.getAll('dealers');
  var dealerById = {};
  dealers.forEach(function(d) { dealerById[d.id] = d.name || ''; });

  function fmtDate(s) {
    if (!s) return '';
    var p = (s || '').slice(0,10).split('-');
    if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
    return s;
  }

  _pipeSheetIds = pipes.map(function(p) { return p.id; });
  _pipeDeletedIds = [];
  var data = pipes.map(function(p) {
    var statusObj = (cfg.pipelineStatuses || []).find(function(s) { return s.id === p.status; });
    var items = (p.items && p.items.length) ? p.items : (p.model ? [{ model: p.model, qty: p.modelQty || 1 }] : []);
    var g = _pipeModelQtyByGroup(items);
    var modelCell = items.map(function(it) { return (it.model || '') + '*' + (Number(it.qty) || 1); }).join('\n');
    return [
      fmtDate(p.registerDate), p.projectName||'', p.endUserTH||'', p.endUserEN||'',
      p.unitType||'', dealerById[p.dealerId]||'', p.djiDealer||'',
      p.projectRevenue||0, modelCell,
      g.m3m||0, g.m4t||0, g.m4e||0, g.dock3||0, g.m4td||0, g.m400||0,
      p.forecastAmount||0, p.realAmount||0,
      fmtDate(p.biddingDate), fmtDate(p.shipmentDate),
      statusObj ? statusObj.name : (p.status||''),
      p.saleName||'', p.remark||''
    ];
  });

  _pipeSheetInstance = jexcel(el, {
    data: data,
    columns: [
      { title: 'Register Date',  type: 'text',     width: 95  },
      { title: 'Project Name',   type: 'text',     width: 200 },
      { title: 'End User TH',    type: 'text',     width: 140 },
      { title: 'End User EN',    type: 'text',     width: 120 },
      { title: 'Unit type',      type: 'text',     width: 70  },
      { title: 'Dealer',         type: 'text',     width: 120 },
      { title: 'DJI Dealer',     type: 'text',     width: 100 },
      { title: 'Revenue',        type: 'numeric',  width: 100, mask: '#,##0' },
      { title: 'Model',          type: 'text',     width: 160 },
      { title: 'M3M',            type: 'numeric',  width: 50,  mask: '#,##0' },
      { title: 'M4T',            type: 'numeric',  width: 50,  mask: '#,##0' },
      { title: 'M4E',            type: 'numeric',  width: 50,  mask: '#,##0' },
      { title: 'Dock3',          type: 'numeric',  width: 50,  mask: '#,##0' },
      { title: 'M4TD',           type: 'numeric',  width: 50,  mask: '#,##0' },
      { title: 'M400',           type: 'numeric',  width: 50,  mask: '#,##0' },
      { title: 'Forecast',       type: 'numeric',  width: 105, mask: '#,##0' },
      { title: 'Real Amount',    type: 'numeric',  width: 105, mask: '#,##0' },
      { title: 'Bidding Date',   type: 'text',     width: 95  },
      { title: 'Shipment Date',  type: 'text',     width: 95  },
      { title: 'Status',         type: 'dropdown', source: statusNames, width: 110 },
      { title: 'Sale',           type: 'text',     width: 80  },
      { title: 'Remark',         type: 'text',     width: 160 }
    ],
    minDimensions: [22, Math.max(data.length, 5)],
    allowInsertRow: false,
    allowDeleteRow: true,
    contextMenu: false,
    ondeleterow: function(el, rowNumber, numRows) {
      // capture IDs of deleted rows before _pipeSheetIds shifts
      for (var i = 0; i < numRows; i++) {
        var deletedId = _pipeSheetIds[rowNumber + i];
        if (deletedId) _pipeDeletedIds.push(deletedId);
      }
      _pipeSheetIds.splice(rowNumber, numRows);
    },
    filters: true,
    columnSorting: true,
    freezeColumns: 2,
    onchange: function(el, cell, x, y, value) {
      if (parseInt(x) === 8) _autoCalcPipeQty(el, parseInt(y), value, 9);
      setTimeout(_refreshPipeSheetStyles, 50);
    },
    onload: function() {
      _refreshPipeSheetStyles();
      // re-apply saved column visibility (CSS persists in <head> but re-inject if missing)
      Object.keys(_pipeHiddenCols).forEach(function(ci) {
        if (_pipeHiddenCols[ci]) togglePipeSheetColVis(parseInt(ci), false);
      });
    }
  });
}

function _hexToRgba(hex, alpha) {
  if (!hex) return '';
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(function(c) { return c+c; }).join('');
  var r = parseInt(hex.substr(0,2),16), g = parseInt(hex.substr(2,2),16), b = parseInt(hex.substr(4,2),16);
  return isNaN(r) ? '' : 'rgba('+r+','+g+','+b+','+alpha+')';
}

function _stylePipeSheetRows() {
  var el = document.getElementById('pipeSheetEl');
  if (!el || !el.jexcel) return;
  var data = el.jexcel.getData();
  var cfg = getConfig();
  var statusColorMap = {};
  (cfg.pipelineStatuses || []).forEach(function(s) { statusColorMap[s.name] = s.color || ''; });
  var table = el.querySelector('table.jexcel');
  if (!table) return;
  // col 9-14 (M3M,M4T,M4E,Dock3,M4TD,M400) → td index = col+1 (row-header offset)
  var autoCalcTdIdx = [10,11,12,13,14,15];
  table.querySelectorAll('tbody tr').forEach(function(tr, idx) {
    if (idx >= data.length) { tr.style.background = ''; return; }
    var st = data[idx][19] || '';
    var hex = statusColorMap[st] || '';
    tr.style.background = hex ? _hexToRgba(hex, 0.12) : '';
    var cells = tr.querySelectorAll('td');
    autoCalcTdIdx.forEach(function(ci) {
      if (cells[ci]) cells[ci].style.background = 'rgba(100,116,139,0.08)';
    });
  });
}

function _applyPipeConditionalFormat() {
  var el = document.getElementById('pipeSheetEl');
  if (!el || !el.jexcel) return;
  var data = el.jexcel.getData();
  var today = new Date(); today.setHours(0,0,0,0);
  var table = el.querySelector('table.jexcel');
  if (!table) return;
  table.querySelectorAll('tbody tr').forEach(function(tr, idx) {
    if (idx >= data.length) return;
    var raw = data[idx][17] || ''; // Bidding Date DD/MM/YYYY
    var cells = tr.querySelectorAll('td');
    var cell = cells[18]; // col 17 + 1 for row-header
    if (!cell) return;
    cell.style.color = ''; cell.style.fontWeight = '';
    if (!raw) return;
    var p = raw.split('/');
    if (p.length !== 3) return;
    var d = new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
    var diff = Math.ceil((d - today) / 86400000);
    if (diff < 0)       { cell.style.color = '#ef4444'; cell.style.fontWeight = '700'; }
    else if (diff <= 7) { cell.style.color = '#f97316'; cell.style.fontWeight = '700'; }
    else if (diff <= 30){ cell.style.color = '#eab308'; }
  });
}

function _updatePipeSheetSum() {
  var el = document.getElementById('pipeSheetEl');
  var sumEl = document.getElementById('pipeSheetSumRow');
  if (!el || !el.jexcel || !sumEl) return;
  var data = el.jexcel.getData();
  var tot = { m3m:0, m4t:0, m4e:0, dock3:0, m4td:0, m400:0, fc:0, real:0, count:0 };
  data.forEach(function(r) {
    if (!(r[0] || r[1])) return; // skip empty rows
    tot.count++;
    tot.m3m  += parseFloat(r[9])  || 0;
    tot.m4t  += parseFloat(r[10]) || 0;
    tot.m4e  += parseFloat(r[11]) || 0;
    tot.dock3+= parseFloat(r[12]) || 0;
    tot.m4td += parseFloat(r[13]) || 0;
    tot.m400 += parseFloat(r[14]) || 0;
    tot.fc   += parseFloat(r[15]) || 0;
    tot.real += parseFloat(r[16]) || 0;
  });
  function s(label, val, isMoney) {
    return '<span style="white-space:nowrap"><span style="color:var(--text2)">' + label + ':</span> <b>' + (isMoney ? fmtMoneyShort(val) : val) + '</b></span>';
  }
  sumEl.innerHTML = s('Rows', tot.count) + s('M3M', tot.m3m) + s('M4T', tot.m4t) + s('M4E', tot.m4e) +
    s('Dock3', tot.dock3) + s('M4TD', tot.m4td) + s('M400', tot.m400) +
    s('Forecast', tot.fc, true) + s('Real', tot.real, true);
}

function _refreshPipeSheetStyles() {
  _stylePipeSheetRows();
  _applyPipeConditionalFormat();
  _updatePipeSheetSum();
}

function _pipeSectionHeader(label, key, isOpen, hint) {
  return '<div class="pipe-sec-hdr" onclick="_togglePipeSection(\'' + key + '\')" style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;margin-bottom:6px;border-bottom:1px solid var(--border);cursor:pointer">' +
    '<span style="font-size:11px;font-weight:500;color:var(--text2);display:flex;align-items:center;gap:6px">' + label +
    (hint ? '<span style="font-size:10px;font-weight:400;color:var(--accent);background:var(--bg2);padding:1px 6px;border-radius:4px;border:1px solid var(--border)">' + hint + '</span>' : '') +
    '</span>' +
    '<span id="pipeSec_' + key + '_btn" style="font-size:10px;color:var(--text2);background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:1px 8px">' + (isOpen ? '▲ ซ่อน' : '▼ แสดง') + '</span>' +
    '</div>';
}

function _togglePipeSection(key) {
  var isOpen, wrapId, lsKey;
  if (key === 'pipeDash') {
    pipeDashOpen = !pipeDashOpen; isOpen = pipeDashOpen; wrapId = 'pipeDashWrap'; lsKey = 'pipeDashOpen';
  } else if (key === 'pipeUrgent') {
    pipeUrgentOpen = !pipeUrgentOpen; isOpen = pipeUrgentOpen; wrapId = 'pipeUrgentWrap'; lsKey = 'pipeUrgentOpen';
  } else if (key === 'pipeTeamDash') {
    pipeTeamDashOpen = !pipeTeamDashOpen; isOpen = pipeTeamDashOpen; wrapId = 'pipeTeamDashWrap'; lsKey = 'pipeTeamDashOpen';
  } else if (key === 'pipeTeamUrgent') {
    pipeTeamUrgentOpen = !pipeTeamUrgentOpen; isOpen = pipeTeamUrgentOpen; wrapId = 'pipeTeamUrgentWrap'; lsKey = 'pipeTeamUrgentOpen';
  } else if (key === 'pipeTeamFilter') {
    pipeTeamFilterOpen = !pipeTeamFilterOpen; isOpen = pipeTeamFilterOpen; wrapId = 'pipeTeamFilterWrap'; lsKey = 'pipeTeamFilterOpen';
  } else {
    pipeFilterOpen = !pipeFilterOpen; isOpen = pipeFilterOpen; wrapId = 'pipeFilterWrap'; lsKey = 'pipeFilterOpen';
  }
  localStorage.setItem(lsKey, isOpen ? '1' : '0');
  var wrap = document.getElementById(wrapId);
  if (wrap) wrap.style.display = isOpen ? '' : 'none';
  var btn = document.getElementById('pipeSec_' + key + '_btn');
  if (btn) btn.textContent = isOpen ? '▲ ซ่อน' : '▼ แสดง';
}

// แถบสรุป "ต้องรีบทำวันนี้" — Bid ใกล้ครบ + ค้างนานไม่มีอัปเดต กดการ์ดเพื่อกรองตาราง กดซ้ำเพื่อยกเลิกกรอง
function _pipeUrgentCounts(allPipes) {
  var bid7 = 0, bid30 = 0, stale90 = 0;
  var todayISO = _td();
  allPipes.forEach(function(p) {
    if (!pipeIsActive(p)) return;
    if (p.biddingDate) {
      var bd = dTo(p.biddingDate);
      if (bd >= 0 && bd <= 7) bid7++;
      else if (bd > 7 && bd <= 30) bid30++;
    }
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    var lastActivityDate = (lastLog && lastLog.date) ? lastLog.date.split('T')[0] : (p.registerDate || (p.created ? p.created.split('T')[0] : ''));
    if (lastActivityDate && daysBetween(lastActivityDate, todayISO) > 90) stale90++;
  });
  return { bid7: bid7, bid30: bid30, stale90: stale90 };
}

function _pipeUrgentBarHtml(allPipes) {
  var c = _pipeUrgentCounts(allPipes);
  if (!c.bid7 && !c.bid30 && !c.stale90) return '';
  function card(key, count, label, bg, color) {
    if (!count) return '';
    var act = pipeUrgentFlt === key;
    return '<div onclick="_pipeToggleUrgentFlt(\'' + key + '\')" style="cursor:pointer;flex:1;min-width:130px;background:' + bg + ';border:1px solid ' + (act ? color : 'transparent') + ';border-radius:8px;padding:8px 10px">' +
      '<div style="font-size:11px;color:' + color + '">' + label + '</div>' +
      '<div style="font-size:20px;font-weight:700;color:' + color + '">' + count + ' รายการ</div></div>';
  }
  return _pipeSectionHeader('⏰ ต้องรีบทำวันนี้', 'pipeUrgent', pipeUrgentOpen, !pipeUrgentOpen ? [c.bid7 && (c.bid7 + ' ด่วน'), c.stale90 && (c.stale90 + ' ค้าง')].filter(Boolean).join(' · ') : '') +
    '<div id="pipeUrgentWrap"' + (!pipeUrgentOpen ? ' style="display:none"' : '') + '>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
    card('bid7', c.bid7, 'Bid ภายใน 7 วัน', '#ef444418', '#ef4444') +
    card('bid30', c.bid30, 'Bid ใน 8-30 วัน', '#f59e0b18', '#f59e0b') +
    card('stale90', c.stale90, 'ค้างนาน >90 วัน', 'var(--bg2)', 'var(--text2)') +
    '</div></div>';
}

function togglePipeFilter() { _togglePipeSection('pipeFilter'); }
function togglePipeDash()   { _togglePipeSection('pipeDash'); }

function _pipeToggleUrgentFlt(key) {
  pipeUrgentFlt = pipeUrgentFlt === key ? '' : key;
  render();
}

var _PIPE_COL_NAMES = [
  'Register Date','Project Name','End User TH','End User EN','Unit type',
  'Dealer','DJI Dealer','Revenue','Model',
  'M3M','M4T','M4E','Dock3','M4TD','M400',
  'Forecast','Real Amount','Bidding Date','Shipment Date','Status','Sale','Remark'
];

function showPipeColPanel(btn) {
  var existing = document.getElementById('pipeColPanel');
  if (existing) { existing.remove(); return; }
  var panel = document.createElement('div');
  panel.id = 'pipeColPanel';
  panel.style.cssText = 'position:fixed;z-index:9999;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;box-shadow:0 4px 20px rgba(0,0,0,.25);display:grid;grid-template-columns:1fr 1fr;gap:5px 16px;min-width:260px;max-height:320px;overflow-y:auto;font-size:12px';
  var rect = btn.getBoundingClientRect();
  panel.style.top = Math.min(rect.bottom + 4, window.innerHeight - 340) + 'px';
  panel.style.left = Math.max(rect.left, 4) + 'px';
  _PIPE_COL_NAMES.forEach(function(name, ci) {
    var label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;color:var(--text)';
    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !_pipeHiddenCols[ci];
    chk.onchange = function() { togglePipeSheetColVis(ci, chk.checked); };
    label.appendChild(chk);
    label.appendChild(document.createTextNode(name));
    panel.appendChild(label);
  });
  document.body.appendChild(panel);
  setTimeout(function() {
    document.addEventListener('click', function _close(e) {
      if (!panel.contains(e.target) && e.target !== btn) {
        panel.remove();
        document.removeEventListener('click', _close);
      }
    });
  }, 0);
}

function togglePipeSheetColVis(ci, visible) {
  _pipeHiddenCols[ci] = !visible;
  var styleId = 'psHideCol_' + ci;
  if (!visible) {
    if (!document.getElementById(styleId)) {
      var s = document.createElement('style');
      s.id = styleId;
      s.textContent = '#pipeSheetEl [data-x="' + ci + '"]{display:none!important}';
      document.head.appendChild(s);
    }
  } else {
    var s = document.getElementById(styleId);
    if (s) s.remove();
  }
  localStorage.setItem('pipeHiddenCols', JSON.stringify(_pipeHiddenCols));
}

function searchPipeSheet() {
  var q = ((document.getElementById('pipeSheetSearch') || {}).value || '').toLowerCase().trim();
  var el = document.getElementById('pipeSheetEl');
  if (!el || !el.jexcel) return;
  var data = el.jexcel.getData();
  var table = el.querySelector('table.jexcel');
  if (!table) return;
  table.querySelectorAll('tbody tr').forEach(function(tr, idx) {
    if (idx >= data.length) { tr.style.display = ''; return; }
    if (!q) { tr.style.display = ''; return; }
    tr.style.display = data[idx].join(' ').toLowerCase().indexOf(q) >= 0 ? '' : 'none';
  });
}

function sortPipeSheetBy(val) {
  if (!val) return;
  var el = document.getElementById('pipeSheetEl');
  if (!el || !el.jexcel) return;
  var colMap = { forecast_desc: [15, true], forecast_asc: [15, false], bidding_asc: [17, false], status: [19, false], real_desc: [16, true] };
  var cfg = colMap[val];
  if (!cfg) return;
  var col = cfg[0], desc = cfg[1];
  var data = el.jexcel.getData();
  data.sort(function(a, b) {
    var va = a[col] || '', vb = b[col] || '';
    if (col === 17) { // date DD/MM/YYYY → sort as YYYY-MM-DD
      var pa = va.split('/'), pb = vb.split('/');
      va = pa.length === 3 ? pa[2]+pa[1]+pa[0] : '00000000';
      vb = pb.length === 3 ? pb[2]+pb[1]+pb[0] : '99999999';
    } else {
      var na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) { va = na; vb = nb; }
    }
    if (va < vb) return desc ? 1 : -1;
    if (va > vb) return desc ? -1 : 1;
    return 0;
  });
  data.forEach(function(row, r) {
    row.forEach(function(val, c) { el.jexcel.setValueFromCoords(c, r, val, true); });
  });
  setTimeout(_refreshPipeSheetStyles, 100);
  var sel = document.getElementById('pipeSheetSortSel');
  if (sel) sel.value = '';
}

function savePipeSheet() {
  if (!_pipeSheetInstance) { toast('⚠️ เปิด Sheet mode ก่อน'); return; }
  var rows = _pipeSheetInstance.getData();
  var cfg = getConfig();
  var dealers = ST.getAll('dealers');
  var dealerByName = {};
  dealers.forEach(function(d) { if (d.name) dealerByName[d.name.trim().toLowerCase()] = d; });

  var qtyDefs = [
    {col:9,  model:'M3M'},   {col:10, model:'M4T'},
    {col:11, model:'M4E'},   {col:12, model:'Dock 3'},
    {col:13, model:'M4TD'},  {col:14, model:'M400'}
  ];

  var saved = 0;
  rows.forEach(function(r, idx) {
    var id = _pipeSheetIds[idx];
    if (!id) return;
    var dealerName = (r[5]||'').trim();
    var dealer = dealerByName[dealerName.toLowerCase()];
    var statusName = (r[19]||'').trim();
    var statusObj = (cfg.pipelineStatuses||[]).find(function(s){ return s.name === statusName; });

    var items = [];
    qtyDefs.forEach(function(def) {
      var qty = parseInt(r[def.col]) || 0;
      if (qty > 0) items.push({ model: def.model, qty: qty });
    });
    // fallback: parse Model text column if no qty cells filled
    if (!items.length && r[8]) {
      (r[8]||'').split('\n').filter(Boolean).forEach(function(line) {
        var p = line.split('*'); var m = (p[0]||'').trim(); var q = parseInt(p[1])||1;
        if (m) items.push({ model: m, qty: q });
      });
    }

    ST.update('pipeline', id, {
      registerDate: _pipeDateFromPaste(r[0]),
      projectName: (r[1]||'').trim(),
      endUserTH: (r[2]||'').trim(),
      endUserEN: (r[3]||'').trim(),
      unitType: (r[4]||'').trim(),
      dealerId: dealer ? dealer.id : (ST.getOne('pipeline', id)||{}).dealerId || '',
      djiDealer: (r[6]||'').trim(),
      projectRevenue: parseFloat(r[7])||0,
      items: items,
      forecastAmount: parseFloat(r[15])||0,
      realAmount: parseFloat(r[16])||0,
      biddingDate: _pipeDateFromPaste(r[17]),
      shipmentDate: _pipeDateFromPaste(r[18], _pipeDateFromPaste(r[17])),
      status: statusObj ? statusObj.id : (r[19]||'initial'),
      saleName: (r[20]||'').trim(),
      remark: (r[21]||'').trim(),
      updatedAt: new Date().toISOString()
    });
    saved++;
  });

  var deleted = 0;
  _pipeDeletedIds.forEach(function(id) {
    ST.delete('pipeline', id);
    ST.deleteWhere('pipeLog', function(l) { return l.pipeId === id; });
    if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('pipeline', id);
    deleted++;
  });
  _pipeDeletedIds = [];

  var st = document.getElementById('pipeSheetStatus');
  var msg = '✅ บันทึก ' + saved + ' รายการ' + (deleted ? ' · ลบ ' + deleted + ' รายการ' : '');
  if (st) st.textContent = msg;
  toast('💾 ' + msg);
}

// ================================================================
// PASTE FROM EXCEL (Pipeline)
// ================================================================
function _pipeParseTSV(text) {
  var rows = [], row = [], field = '', inQ = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === '\t') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(function(r) { return r.length > 1 || (r[0] && r[0].trim()); });
}

// refDateISO (ไม่บังคับ) — ใช้เฉพาะตอนเจอค่าที่เป็น "ชื่อเดือนย่อล้วนๆ ไม่มีวัน/ไม่มีปี" (เช่น Shipment date ใน
// Google Sheet ต้นฉบับที่ทีมกรอกแค่เดือนคาดว่าจะส่งมอบ) เพื่อเดาปีให้: ถ้าเดือนที่เจอ >= เดือนของ refDate ใช้
// ปีเดียวกับ refDate, ถ้าน้อยกว่า (เดือนผ่านไปแล้วเทียบกับ ref) ให้เลื่อนเป็นปีถัดไป (ref ปกติคือ Bidding Date
// ของแถวเดียวกัน เพราะ Shipment ต้องอยู่หลัง Bidding เสมอ) ไม่ส่ง ref มา = ใช้วันนี้แทน
function _pipeDateFromPaste(s, refDateISO) {
  s = (s || '').toString().trim();
  if (!s || s === '-') return '';
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // D-Mon-YY or D-Mon-YYYY  (e.g. 1-Mar-25, 15-Nov-2026)
  var _mon = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  var mHit = s.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{2,4})$/);
  if (mHit) {
    var y3 = mHit[3].length === 2 ? '20' + mHit[3] : mHit[3];
    return y3 + '-' + (_mon[mHit[2].toLowerCase()] || '01') + '-' + mHit[1].padStart(2, '0');
  }
  var p = s.split('/');
  if (p.length === 3) {
    // YYYY/MM/DD  (e.g. 2026/11/01)
    if (p[0].length === 4) return p[0] + '-' + p[1].padStart(2, '0') + '-' + p[2].padStart(2, '0');
    // DD/MM/YYYY or DD/MM/YY
    var y = p[2].length === 2 ? '20' + p[2] : p[2];
    return y + '-' + p[1].padStart(2, '0') + '-' + p[0].padStart(2, '0');
  }
  // ชื่อเดือนย่อ/เต็มล้วนๆ ไม่มีวัน ไม่มีปี (เช่น "Sep", "September") — เดาปีจาก refDateISO
  var bareMon = s.match(/^([A-Za-z]{3,9})\.?$/);
  if (bareMon && _mon.hasOwnProperty(bareMon[1].slice(0, 3).toLowerCase())) {
    var mIdx = parseInt(_mon[bareMon[1].slice(0, 3).toLowerCase()], 10) - 1;
    var ref = refDateISO ? new Date(refDateISO) : new Date();
    var refYear = ref.getFullYear();
    var year = mIdx < ref.getMonth() ? refYear + 1 : refYear;
    return year + '-' + String(mIdx + 1).padStart(2, '0') + '-01';
  }
  return '';
}

// ================================================================
// COLUMN MAPPING (จับคู่ตามชื่อหัวข้อ แทนตำแหน่งคงที่) — แก้ปัญหาเดิมที่ทุกครั้งที่ Google Sheet ต้นฉบับ
// สลับ/แทรก/ลบคอลัมน์ ต้องไล่แก้เลข index เองทุกจุดในไฟล์นี้ (เสี่ยงพลาดจุดใดจุดหนึ่งแล้วข้อมูลเงียบๆ ไม่อัปเดต)
// ตอนนี้ import จะอ่านแถวหัวตารางจริงจากไฟล์ก่อนเสมอ จับคู่ชื่อหัวข้อ (exact/startsWith แบบ normalize
// เท่านั้น ไม่มีการเดา/fuzzy) กับรายชื่อที่รู้จัก แล้วค่อยไปหยิบค่าตามตำแหน่งที่จับคู่ได้จริง — สลับ/แทรก/ลบ
// คอลัมน์ที่ไม่ได้ track ในชีตแล้วไม่ต้องแก้โค้ดจุดไหนเลย ส่วน export (PIPE_SHEET_HEADERS/_pipeRowFields)
// ยังคงสร้างหัวตารางตามลำดับคงที่เหมือนเดิม (ไม่จำเป็นต้องยืดหยุ่นฝั่ง export เพราะแอปเป็นคนสร้างเองทุกครั้ง)
// ================================================================
var _PIPE_IMPORT_COLS = [
  { key: 'rowNo',             label: 'ROW NO.' },
  { key: 'registerDate',      label: 'Register Date' },
  { key: 'projectId',         label: 'Project ID' },
  { key: 'projectName',       label: 'Project Name', required: true },
  { key: 'endUserTH',         label: 'End User Name' },
  { key: 'endUserEN',         label: 'End User Name Eng' },
  { key: 'unitType',          label: 'Unit type' },
  { key: 'dealerName',        label: 'Dealer Name' },
  { key: 'djiDealer',         label: 'DJI Dealer' },
  { key: 'projectRevenue',    label: 'Project revenue' },
  { key: 'model',             label: 'Model' },
  { key: 'm3m',                label: 'M3M Qty.' },
  { key: 'm4t',                label: 'M4T Qty.' },
  { key: 'm4e',                label: 'M4E Qty.' },
  { key: 'dock3',              label: 'Dock 3 Qty.' },
  { key: 'm4td',               label: 'M4TD Qty.' },
  { key: 'm400',               label: 'M400 Qty.' },
  { key: 'forecastAmount',    label: 'Forecast Amount' },
  { key: 'realAmount',        label: 'Real Amount' },
  { key: 'tor',                label: 'TOR' },
  { key: 'biddingDate',       label: 'Bidding Date' },
  { key: 'forecastMonth',     label: 'Forecast Month' },
  { key: 'shipmentDate',      label: 'Shipment date' },
  { key: 'remark',             label: 'Remark' },
  { key: 'appointmentLetter', label: 'Letter of Authorized' },
  { key: 'projectPOS',         label: 'Project POS' },
  { key: 'status',             label: 'Status' },
  { key: 'recurring',          label: 'Duplicate' },
  { key: 'update1',            label: 'Update 1' },
  { key: 'update2',            label: 'Update 2' },
  { key: 'update3',            label: 'Update 3' },
  { key: 'update4',            label: 'Update 4' },
  { key: 'update5',            label: 'Update 5' },
  { key: 'update6',            label: 'Update 6' },
  { key: 'saleName',           label: 'Sale' },
  { key: 'sheetDisplay',       label: 'DISPLAY' }
];

// 6 คอลัมน์ Qty ต่อรุ่นโดรน — แยกจาก _PIPE_IMPORT_COLS เพื่อผูก model name/gKey ไว้ใช้ต่อง่ายๆ
var _PIPE_MODEL_KEYS = [
  { key: 'm3m',   model: 'Matrice 3M',  gKey: 'm3m'   },
  { key: 'm4t',   model: 'Matrice 4T',  gKey: 'm4t'   },
  { key: 'm4e',   model: 'Matrice 4E',  gKey: 'm4e'   },
  { key: 'dock3', model: 'Dock 3',      gKey: 'dock3' },
  { key: 'm4td',  model: 'Matrice 4TD', gKey: 'm4td'  },
  { key: 'm400',  model: 'Matrice 400', gKey: 'm400'  }
];

function _pipeNormHeader(s) {
  return (s || '').toString().replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

// สร้าง { map: {key: colIndex}, missingRequired: [label,...] } จากแถวหัวตารางจริงในไฟล์
// จับคู่แบบ exact หรือ startsWith เท่านั้น (หลัง normalize ตัด \n/เว้นวรรคซ้ำ/ตัวพิมพ์) ไม่มีการเดาข้าม
function _pipeBuildColMap(headerRow) {
  var map = {};
  var used = {};
  var missingRequired = [];
  _PIPE_IMPORT_COLS.forEach(function(def) {
    var want = _pipeNormHeader(def.label);
    var foundIdx = -1;
    for (var i = 0; i < headerRow.length; i++) {
      if (used[i]) continue;
      var cell = _pipeNormHeader(headerRow[i]);
      if (cell && (cell === want || cell.indexOf(want) === 0)) { foundIdx = i; break; }
    }
    if (foundIdx !== -1) { map[def.key] = foundIdx; used[foundIdx] = true; }
    else if (def.required) missingRequired.push(def.label);
  });
  return { map: map, missingRequired: missingRequired };
}

// อ่านค่าจากแถวข้อมูลตาม key ที่จับคู่ไว้แล้วใน colMap — คืน '' เสมอถ้าคอลัมน์นั้นไม่พบในไฟล์ (ไม่ throw)
function _pipeCol(row, colMap, key) {
  var idx = colMap ? colMap[key] : undefined;
  return (idx === undefined || idx === -1) ? '' : (row[idx] || '');
}

function showPastePipelineM(lockDealerId) {
  var lockDealer = lockDealerId ? ST.getOne('dealers', lockDealerId) : null;
  var h = '<div style="max-width:640px">';
  if (lockDealer) {
    h += '<div style="font-size:.8rem;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;margin-bottom:8px">🏪 Dealer: <b>' + sanitize(lockDealer.name) + '</b> — จะถูก set ให้ทุก row อัตโนมัติ (ไม่ต้องมีคอลัมน์ Dealer ใน Excel)</div>';
  }
  h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:4px">ก็อปมาแบบ "รวมแถวหัวตาราง" ด้วยเสมอ แล้ววางที่นี่ — ระบบจับคู่คอลัมน์จากชื่อหัวข้อ ไม่สนลำดับ/ตำแหน่ง สลับหรือแทรกคอลัมน์อื่นในชีตได้อิสระ</p>';
  h += '<p style="font-size:.75rem;color:var(--text3);margin-bottom:8px">ต้องมีคอลัมน์ชื่อ <strong>Project Name</strong> เป็นอย่างน้อย ส่วนคอลัมน์อื่นที่รู้จัก: ROW NO. / Register Date / Project ID / End User Name / End User Name Eng / Unit type / Dealer Name / DJI Dealer / Project revenue / Model / M3M-M400 Qty. / Forecast Amount / Real Amount / TOR / Bidding Date / Shipment date / Remark / Letter of Authorized / Project POS / Status / Duplicate / Update 1-6 / Sale / DISPLAY</p>';
  h += '<input type="hidden" id="pastePipeLockDealer" value="' + sanitize(lockDealerId || '') + '">';
  h += '<textarea id="pastePipeTa" style="width:100%;height:220px;font-size:12px;font-family:monospace;border:1px solid var(--border);border-radius:8px;padding:8px;resize:vertical;background:var(--bg2);color:var(--text)" placeholder="วางข้อมูลจาก Excel ที่นี่..."></textarea>';
  h += '<div style="display:flex;gap:8px;margin-top:10px">';
  h += '<button class="btn bp" style="flex:1" onclick="doPastePipeline()">📥 นำเข้า</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '</div></div>';
  openM('📋 วางข้อมูล Pipeline จาก Excel', h);
}

function doPastePipeline() {
  var ta = document.getElementById('pastePipeTa');
  if (!ta) return;
  var lockDealerId = (document.getElementById('pastePipeLockDealer') || {}).value || '';
  var rows = _pipeParseTSV(ta.value.trim());
  if (!rows.length) { toast('⚠️ ไม่พบข้อมูล'); return; }
  var headerRow = rows[0];
  var dataRows = rows.slice(1);
  if (!dataRows.length) { toast('⚠️ ไม่พบข้อมูลหลังแถวหัวตาราง'); return; }
  var colRes = _pipeBuildColMap(headerRow);
  if (colRes.missingRequired.length) {
    toast('❌ ไม่พบคอลัมน์ที่จำเป็น: ' + colRes.missingRequired.join(', ') + ' — เช็คว่าวางแถวหัวตารางมาด้วยไหม');
    return;
  }
  closeMForce();
  _pipeResolveUnknownDealersUI(dataRows, lockDealerId, colRes.map, function(resolvedRows) {
    _processPipeImportRows(resolvedRows, lockDealerId, null, null, colRes.map);
  });
}

// ก่อนนำเข้าจริง เช็คก่อนว่าชื่อ Dealer ในไฟล์มีชื่อไหนที่ไม่ตรงกับ Dealer ที่มีอยู่แล้วบ้าง
// (สะกดเพี้ยน/พิมพ์ไม่ตรง หรือเป็น Dealer ใหม่จริงๆ) ถ้ามี ให้เลือกก่อนว่าจะสร้างใหม่ หรือจับคู่กับของเดิม —
// กันปัญหา Dealer เพี้ยนแล้ว dealerId ว่างเปล่าไปเงียบๆ ซึ่งทำให้จับคู่โครงการเดิมไม่เจอ (ได้โครงการซ้ำ) ด้วย
// ถ้าล็อก Dealer ไว้อยู่แล้ว (lockDealerId) ทุกแถวใช้ Dealer เดียวกันหมด ไม่ต้องเช็คชื่อในไฟล์เลย
function _pipeResolveUnknownDealersUI(rows, lockDealerId, colMap, cb) {
  if (lockDealerId) { cb(rows); return; }
  var dealers = ST.getAll('dealers');
  var dealerByName = {};
  dealers.forEach(function(d) { if (d.name) dealerByName[d.name.trim().toLowerCase()] = d; });
  var unknownNames = [];
  var seen = {};
  rows.forEach(function(r) {
    var name = _pipeCol(r, colMap, 'dealerName').trim();
    if (!name) return;
    var key = name.toLowerCase();
    if (dealerByName[key] || seen[key]) return;
    seen[key] = true;
    unknownNames.push(name);
  });
  if (!unknownNames.length) { cb(rows); return; }

  var dealerOptions = dealers.slice().sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); })
    .map(function(d) { return '<option value="' + sanitize(d.id) + '">' + sanitize(d.name) + '</option>'; }).join('');

  var h = '<div style="max-width:520px">';
  h += '<div class="hint" style="margin-bottom:10px">พบชื่อ Dealer ' + unknownNames.length + ' ราย ในไฟล์ที่ยังไม่มีในระบบ — เลือกว่าจะสร้างใหม่ หรือจับคู่กับ Dealer ที่มีอยู่แล้ว (เผื่อสะกดเพี้ยน/พิมพ์ไม่ตรงกับของเดิม)</div>';
  unknownNames.forEach(function(name, i) {
    h += '<div class="fg" style="margin-bottom:8px"><label>' + sanitize(name) + '</label>';
    h += '<select id="pipeDealerFix_' + i + '" data-name="' + sanitize(name) + '">';
    h += '<option value="__new__">➕ สร้าง Dealer ใหม่ชื่อนี้</option>';
    h += dealerOptions;
    h += '</select></div>';
  });
  h += '<div style="display:flex;gap:8px;margin-top:10px">';
  h += '<button class="btn bp" style="flex:1" onclick="_pipeApplyDealerFix(' + unknownNames.length + ')">✅ ยืนยันแล้วนำเข้าต่อ</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '</div></div>';

  window._pipeDealerFixRows = rows;
  window._pipeDealerFixColMap = colMap;
  window._pipeDealerFixCb = cb;
  openM('🏪 Dealer ที่ยังไม่มีในระบบ', h);
}

function _pipeApplyDealerFix(count) {
  var rows = window._pipeDealerFixRows;
  var colMap = window._pipeDealerFixColMap;
  var cb = window._pipeDealerFixCb;
  if (!rows) return;
  var dealerColIdx = colMap ? colMap.dealerName : undefined;
  var nameFix = {}; // ชื่อเดิม (lowercase) → ชื่อจริงที่ควรเขียนกลับเข้าแถว (ของใหม่ที่สร้าง หรือของเดิมที่จับคู่)
  for (var i = 0; i < count; i++) {
    var sel = document.getElementById('pipeDealerFix_' + i);
    if (!sel) continue;
    var origName = sel.getAttribute('data-name');
    var val = sel.value;
    if (val === '__new__') {
      var created = ST.add('dealers', { name: origName });
      nameFix[origName.toLowerCase()] = created.name;
    } else {
      var existDealer = ST.getOne('dealers', val);
      if (existDealer) nameFix[origName.toLowerCase()] = existDealer.name;
    }
  }
  if (dealerColIdx !== undefined) {
    rows.forEach(function(r) {
      var key = (r[dealerColIdx] || '').trim().toLowerCase();
      if (nameFix[key]) r[dealerColIdx] = nameFix[key];
    });
  }
  closeMForce();
  window._pipeDealerFixRows = null;
  window._pipeDealerFixColMap = null;
  window._pipeDealerFixCb = null;
  if (typeof cb === 'function') cb(rows);
}

// แปลงค่าเซลล์ xlsx เป็นข้อความ — เซลล์ที่เป็น Date object จริง (จาก cellDates:true) จะถูกแปลงเป็น
// YYYY-MM-DD ด้วยค่า local date ตรงๆ (ไม่ผ่าน toISOString ที่แปลงเป็น UTC อาจเลื่อนวันผิดได้) กันปัญหา
// วัน/เดือนสลับกันจากการแปลงกลับเป็นข้อความแบบกำกวมของ SheetJS
function _pipeXlsxCellToStr(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    var y = v.getFullYear();
    var m = String(v.getMonth() + 1).padStart(2, '0');
    var d = String(v.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  return String(v == null ? '' : v);
}

// ---- xlsx file import ----
function importPipelineXlsx(dealerId) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: 'binary', cellDates: true });
        var ws = wb.Sheets[wb.SheetNames[0]];
        // raw:true (ไม่ใช่ raw:false) — กันปัญหาเซลล์ที่เป็น "วันที่จริง" ถูกแปลงกลับเป็นข้อความแบบ
        // เดือน/วัน/ปี (M/D/YYYY, ไม่เติมเลข 0) ของ SheetJS ที่ทำให้วัน≤12 ถูกตีความสลับวัน/เดือนผิด
        // (เช่น 1 ต.ค. กลายเป็น "10/1/2026" แล้วถูกอ่านเป็น 10 ม.ค.) — อ่าน Date object ตรงๆ แล้วแปลงเป็น
        // YYYY-MM-DD เองแทน ไม่ผ่านขั้นตอนแปลงเป็นข้อความที่กำกวมเลย
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        rows = rows.map(function(r) { return r.map(_pipeXlsxCellToStr); });
        if (!rows.length) { toast('⚠️ ไม่พบข้อมูลในไฟล์'); return; }
        var headerRow = rows[0];
        var dataRows = rows.slice(1);
        var colRes = _pipeBuildColMap(headerRow);
        if (colRes.missingRequired.length) {
          toast('❌ ไม่พบคอลัมน์ที่จำเป็น: ' + colRes.missingRequired.join(', ') + ' — เช็คหัวตารางแถวแรกของไฟล์');
          return;
        }
        // drop rows with no projectName AND no endUserTH (truly empty)
        dataRows = dataRows.filter(function(r) { return _pipeCol(r, colRes.map, 'projectName').trim() || _pipeCol(r, colRes.map, 'endUserTH').trim(); });
        if (!dataRows.length) { toast('⚠️ ไม่พบข้อมูลในไฟล์'); return; }
        _pipeResolveUnknownDealersUI(dataRows, dealerId || '', colRes.map, function(resolvedRows) {
          _showPipeXlsxPreview(resolvedRows, dealerId || '', colRes.map);
        });
      } catch(err) {
        toast('❌ อ่านไฟล์ไม่ได้: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };
  input.click();
}

// คอลัมน์ Model ไม่มีราคาติดมาตอน export (ตั้งใจ) — ตอน import ต้องหาราคาคืนเอง กันราคาโดนล้างเป็น 0
// ลำดับหา: 1) item เดิมของ pipeline นี้ที่ชื่อโมเดลตรงกัน (คงราคาที่เคยตั้งไว้เป๊ะ) 2) แคตตาล็อกสินค้า (โมเดลใหม่ที่ไม่เคยมีมาก่อน)
function _pipeImportLookupPrice(model, existingItems) {
  var norm = (model || '').trim().toLowerCase();
  if (existingItems) {
    for (var i = 0; i < existingItems.length; i++) {
      if ((existingItems[i].model || '').trim().toLowerCase() === norm) {
        return { price: Number(existingItems[i].price) || 0, sku: existingItems[i].sku || '' };
      }
    }
  }
  var prod = (typeof _pipeResolveProduct === 'function') ? _pipeResolveProduct(model) : null;
  if (prod) return { price: Number(prod.rrpExVat) || Number(prod.price) || 0, sku: prod.sku || '' };
  return { price: 0, sku: '' };
}

// key สำหรับ match duplicate: projectName + endUserTH composite
// ใช้ทั้งคู่เพื่อให้โครงการชื่อเดียวกันแต่ endUser ต่างกันไม่ถูก merge กัน
function _pipeImportKey(projectName, endUserTH, dealerId) {
  var pn = (projectName || '').replace(/\r\n|\r/g, '\n').trim();
  var eu = (endUserTH  || '').replace(/\r\n|\r/g, '\n').trim();
  var name = pn ? (eu ? pn + '\x01' + eu : pn) : eu;
  return name ? name.toLowerCase() + '||' + (dealerId || '') : null;
}

// จับคู่ import row กับ pipeline เดิมโดยให้ ROW NO. เป็นตัวจับคู่หลัก (ถ้ามีเลขและมีอยู่ในระบบแล้ว)
// ถ้าไม่มี ROW NO. มาด้วยเลย (แถวไม่เคยใส่เลข) → fallback ไปจับคู่ด้วย projectName+endUserTH+dealerId แบบเดิม
// ถ้ามี ROW NO. มาด้วยแต่ไม่ตรงกับใคร แล้วชื่อ/ข้อมูลไปตรงกับ pipeline ที่ "มี ROW NO. อื่นอยู่แล้ว"
// → ถือเป็นคนละโครงการ ไม่จับคู่ (กันชื่อซ้ำแต่เลขคนละเลขโดนวางทับผิดตัว) — จับคู่ด้วยชื่อได้เฉพาะกรณี
// pipeline เดิมยังไม่เคยมี ROW NO. เท่านั้น (ถือว่าเพิ่งได้เลขอ้างอิงครั้งแรก)
function _pipeFindExistingForImport(rowNo, projectName, endUserTH, dealerId, pipeByRowNo, pipeByKey) {
  var rn = (rowNo || '').trim();
  if (rn && pipeByRowNo[rn]) return pipeByRowNo[rn];
  var key = _pipeImportKey(projectName, endUserTH, dealerId);
  var byKey = key ? (pipeByKey[key] || null) : null;
  if (!byKey) return null;
  if (rn && byKey.rowNo && String(byKey.rowNo).trim() && String(byKey.rowNo).trim() !== rn) return null;
  return byKey;
}

// helpers สำหรับ normalize ก่อนเปรียบเทียบ
function _pipeNormText(s) { return (s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/ /g, ' ').trim(); }
function _pipeNormNum(v)  { return parseFloat(String(v || '').replace(/,/g, '')) || 0; }

// เปรียบเทียบ field สำคัญระหว่าง existing record กับ import row
// returns 'same' | 'changed'
// colMap: {key: colIndex} จาก _pipeBuildColMap — อ่านค่าผ่าน _pipeCol(c, colMap, key) เสมอ ไม่ใช้ index ตรงๆ
// หาข้อความในคอลัมน์ Update 1-6 ของแถว import ที่ "ยังไม่มี" อยู่ในประวัติ log ของ pipeline เดิมเลย — ใช้ทั้งเช็ค
// ว่า state ควรเป็น 'changed' ไหม, โชว์ diff preview, และตอน import จริงค่อยเพิ่มเป็น pipeLog ใหม่ (ดู
// _processPipeImportRows) เกิดจากเคส: ระบบ export แบบ "รวบ" log เก่าเข้า Update 1/2 (ดู _pipeRowFields) แต่
// ถ้าในชีทที่เอามา import ยังเป็น log แยกทีละอันไม่ได้รวบ (เช่นแก้ในชีทเอง/ไฟล์เก่า) ให้ import ตามที่ชีทมี
// เข้าไปเป็น log ใหม่เลย ไม่ต้องพยายามจับคู่กับตัวรวบเดิม — ถ้าจะรวบให้ตรงกันอีกทีก็แค่ export จากแอปใหม่
// ตัดวันที่นำหน้าออกก่อนเทียบ (export ใส่ dd/mm/yy ไว้หน้าข้อความเสมอ ดู logFmt ใน _pipeRowFields)
function _pipeImportNewUpdateLines(existing, c, colMap) {
  var existingContents = ST.pipeLogsByPipe(existing.id).map(function(l) { return (l.content || '').trim(); });
  var out = [];
  for (var u = 1; u <= 6; u++) {
    var raw = _pipeCol(c, colMap, 'update' + u).trim();
    if (!raw) continue;
    raw.split('\n').forEach(function(line) {
      line = line.trim();
      if (!line) return;
      var content = line.replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*/, '');
      if (existingContents.indexOf(content) === -1 && out.indexOf(content) === -1) out.push(content);
    });
  }
  return out;
}

function _pipeImportState(existing, c, dealer, colMap) {
  var statusRaw = _pipeCol(c, colMap, 'status').trim();
  var status = (typeof _csvStatusToId === 'function') ? _csvStatusToId(statusRaw) : 'initial';
  if (!status) status = 'initial';
  var textPairs = [
    [(existing.projectId || ''),          _pipeCol(c, colMap, 'projectId')],
    [(existing.projectName || ''),        _pipeCol(c, colMap, 'projectName')],
    [(existing.endUserTH || ''),          _pipeCol(c, colMap, 'endUserTH')],
    [(existing.endUserEN || ''),          _pipeCol(c, colMap, 'endUserEN')],
    [(existing.unitType || ''),           _pipeCol(c, colMap, 'unitType')],
    [(existing.djiDealer || ''),          _pipeCol(c, colMap, 'djiDealer')],
    [(existing.tor || ''),                _pipeCol(c, colMap, 'tor')],
    [(existing.remark || ''),             _pipeCol(c, colMap, 'remark')],
    [(existing.appointmentLetter || ''),  _pipeCol(c, colMap, 'appointmentLetter')],
    [(existing.saleName || ''),           _pipeCol(c, colMap, 'saleName')],
    [(existing.sheetDisplay || 'Show'),   _pipeCol(c, colMap, 'sheetDisplay') || 'Show'],
    [(existing.rowNo || ''),              _pipeCol(c, colMap, 'rowNo')],
  ];
  for (var i = 0; i < textPairs.length; i++) {
    if (_pipeNormText(textPairs[i][0]) !== _pipeNormText(textPairs[i][1])) return 'changed';
  }
  if ((existing.dealerId || '') !== (dealer ? dealer.id : '')) return 'changed';
  if ((existing.status || '') !== status) return 'changed';
  if (!!existing.recurring !== (_pipeCol(c, colMap, 'recurring').trim().toLowerCase() === 'yes')) return 'changed';
  if (Math.abs(_pipeNormNum(existing.projectRevenue) - _pipeNormNum(_pipeCol(c, colMap, 'projectRevenue')))  > 0.001) return 'changed';
  if (Math.abs(_pipeNormNum(existing.forecastAmount) - _pipeNormNum(_pipeCol(c, colMap, 'forecastAmount'))) > 0.001) return 'changed';
  if (Math.abs(_pipeNormNum(existing.realAmount)     - _pipeNormNum(_pipeCol(c, colMap, 'realAmount'))) > 0.001) return 'changed';
  var impBiddingDate = _pipeDateFromPaste(_pipeCol(c, colMap, 'biddingDate'));
  if ((existing.registerDate || '') !== _pipeDateFromPaste(_pipeCol(c, colMap, 'registerDate'))) return 'changed';
  if ((existing.biddingDate || '') !== impBiddingDate) return 'changed';
  if ((existing.shipmentDate || '') !== _pipeDateFromPaste(_pipeCol(c, colMap, 'shipmentDate'), impBiddingDate)) return 'changed';
  // ใช้ fallback เดียวกับ _pipeRowFields — record เก่าที่เก็บ qty ใน model/modelQty แทน items
  var _ei = (existing.items && existing.items.length) ? existing.items : (existing.model ? [{model: existing.model, qty: existing.modelQty || 1}] : []);
  var existG = _pipeModelQtyByGroup(_ei);
  for (var mi = 0; mi < _PIPE_MODEL_KEYS.length; mi++) {
    var mc = _PIPE_MODEL_KEYS[mi];
    var importQty = parseInt(_pipeCol(c, colMap, mc.key)) || 0;
    var existQty  = existG[mc.gKey] || 0;
    if (importQty !== existQty) return 'changed';
  }
  if (_pipeImportNewUpdateLines(existing, c, colMap).length) return 'changed';
  return 'same';
}

// คืน array ของ field ที่เปลี่ยน [{label, old, newVal}]
// colMap: {key: colIndex} จาก _pipeBuildColMap — อ่านค่าผ่าน _pipeCol(c, colMap, key) เสมอ ไม่ใช้ index ตรงๆ
function _pipeImportDiff(existing, c, dealer, colMap) {
  var statusRaw = _pipeCol(c, colMap, 'status').trim();
  var status = (typeof _csvStatusToId === 'function') ? _csvStatusToId(statusRaw) : 'initial';
  if (!status) status = 'initial';
  var pairs = [
    { label: 'Row No.',         old: _pipeNormText(existing.rowNo),             newVal: _pipeNormText(_pipeCol(c, colMap, 'rowNo')) },
    { label: 'Project ID',      old: _pipeNormText(existing.projectId),         newVal: _pipeNormText(_pipeCol(c, colMap, 'projectId')) },
    { label: 'Project Name',    old: _pipeNormText(existing.projectName),      newVal: _pipeNormText(_pipeCol(c, colMap, 'projectName')) },
    { label: 'End User (TH)',   old: _pipeNormText(existing.endUserTH),         newVal: _pipeNormText(_pipeCol(c, colMap, 'endUserTH')) },
    { label: 'End User (EN)',   old: _pipeNormText(existing.endUserEN),         newVal: _pipeNormText(_pipeCol(c, colMap, 'endUserEN')) },
    { label: 'Unit Type',       old: _pipeNormText(existing.unitType),          newVal: _pipeNormText(_pipeCol(c, colMap, 'unitType')) },
    { label: 'Dealer',          old: _pipeNormText((ST.getOne('dealers', existing.dealerId) || {}).name), newVal: _pipeNormText(dealer ? dealer.name : '') },
    { label: 'DJI Dealer',      old: _pipeNormText(existing.djiDealer),         newVal: _pipeNormText(_pipeCol(c, colMap, 'djiDealer')) },
    { label: 'TOR',             old: _pipeNormText(existing.tor),               newVal: _pipeNormText(_pipeCol(c, colMap, 'tor')) },
    { label: 'Remark',          old: _pipeNormText(existing.remark),            newVal: _pipeNormText(_pipeCol(c, colMap, 'remark')) },
    { label: 'Appointment',     old: _pipeNormText(existing.appointmentLetter), newVal: _pipeNormText(_pipeCol(c, colMap, 'appointmentLetter')) },
    { label: 'Sale Name',       old: _pipeNormText(existing.saleName),          newVal: _pipeNormText(_pipeCol(c, colMap, 'saleName')) },
    { label: 'Sheet Display',   old: _pipeNormText(existing.sheetDisplay) || 'Show', newVal: _pipeNormText(_pipeCol(c, colMap, 'sheetDisplay')) || 'Show' },
    { label: 'Status',          old: (existing.status || ''),                   newVal: status },
    { label: 'Recurring',       old: String(!!existing.recurring),              newVal: String(_pipeCol(c, colMap, 'recurring').trim().toLowerCase() === 'yes') },
  ];
  var numPairs = [
    { label: 'Project Revenue', oldN: _pipeNormNum(existing.projectRevenue), newN: _pipeNormNum(_pipeCol(c, colMap, 'projectRevenue')) },
    { label: 'Forecast',        oldN: _pipeNormNum(existing.forecastAmount),  newN: _pipeNormNum(_pipeCol(c, colMap, 'forecastAmount')) },
    { label: 'Real Amount',     oldN: _pipeNormNum(existing.realAmount),      newN: _pipeNormNum(_pipeCol(c, colMap, 'realAmount')) },
    { label: 'Project POS',     oldN: _pipeNormNum(existing.projectPOS),      newN: _pipeNormNum(_pipeCol(c, colMap, 'projectPOS')) },
  ];
  var diffs = pairs.filter(function(p) { return p.old !== p.newVal; });
  numPairs.forEach(function(p) {
    if (Math.abs(p.oldN - p.newN) > 0.001) diffs.push({ label: p.label, old: fmtMoney(p.oldN) || '0', newVal: fmtMoney(p.newN) || '0' });
  });
  var impBiddingDate = _pipeDateFromPaste(_pipeCol(c, colMap, 'biddingDate'));
  var datePairs = [
    { label: 'Register Date', oldISO: existing.registerDate || '', newISO: _pipeDateFromPaste(_pipeCol(c, colMap, 'registerDate')) },
    { label: 'Bidding Date',  oldISO: existing.biddingDate  || '', newISO: impBiddingDate },
    { label: 'Shipment Date', oldISO: existing.shipmentDate || '', newISO: _pipeDateFromPaste(_pipeCol(c, colMap, 'shipmentDate'), impBiddingDate) }
  ];
  datePairs.forEach(function(p) {
    if (p.oldISO !== p.newISO) diffs.push({ label: p.label, old: p.oldISO ? fD(p.oldISO) : '', newVal: p.newISO ? fD(p.newISO) : '' });
  });
  var _ei2 = (existing.items && existing.items.length) ? existing.items : (existing.model ? [{model: existing.model, qty: existing.modelQty || 1}] : []);
  var existG = _pipeModelQtyByGroup(_ei2);
  _PIPE_MODEL_KEYS.forEach(function(mc) {
    var importQty = parseInt(_pipeCol(c, colMap, mc.key)) || 0;
    var existQty  = existG[mc.gKey] || 0;
    if (importQty !== existQty) diffs.push({ label: mc.model + ' (qty)', old: String(existQty), newVal: String(importQty) });
  });
  var newUpdateLines = _pipeImportNewUpdateLines(existing, c, colMap);
  if (newUpdateLines.length) {
    diffs.push({ label: '📝 Update (จะเพิ่มเป็น log ใหม่)', old: '-', newVal: newUpdateLines.join(' | ') });
  }
  return diffs;
}


function _showPipeXlsxPreview(rows, dealerId, colMap) {
  var dealer = dealerId ? ST.getOne('dealers', dealerId) : null;
  var dealers = ST.getAll('dealers');
  var dealerByName = {};
  dealers.forEach(function(d) { if (d.name) dealerByName[d.name.trim().toLowerCase()] = d; });

  var allPipes = ST.getAll('pipeline');
  var pipeByKey = {};
  var pipeByRowNo = {};
  allPipes.forEach(function(p) {
    var k = _pipeImportKey(p.projectName, p.endUserTH, p.dealerId);
    if (k) pipeByKey[k] = p;
    if (p.rowNo && String(p.rowNo).trim()) pipeByRowNo[String(p.rowNo).trim()] = p;
  });

  var counts = { 'new': 0, changed: 0, same: 0 };
  var matchedIds = {};
  // เตือน "Row No. ไม่พบของเดิม" มีความหมายก็ต่อเมื่อระบบมีโครงการที่เคยผูก Row No. ไว้อยู่แล้วบ้าง — ถ้ายังไม่
  // มีเลยสักโครงการ (เช่น import ทั้งชีตครั้งแรกสุด) ทุกแถวก็จะเป็น "ใหม่" จริงๆ ทั้งหมด ไม่ใช่เคสจับคู่พลาด
  var hasAnyRowNoInSystem = Object.keys(pipeByRowNo).length > 0;
  var rowMeta = rows.map(function(r) {
    var d = dealer || dealerByName[(_pipeCol(r, colMap, 'dealerName').trim()).toLowerCase()];
    var existing = _pipeFindExistingForImport(_pipeCol(r, colMap, 'rowNo'), _pipeCol(r, colMap, 'projectName'), _pipeCol(r, colMap, 'endUserTH'), d ? d.id : '', pipeByRowNo, pipeByKey);
    var state = existing ? _pipeImportState(existing, r, d, colMap) : 'new';
    var diff = state === 'changed' ? _pipeImportDiff(existing, r, d, colMap) : [];
    if (existing) matchedIds[existing.id] = true;
    counts[state]++;
    // แถวที่มีเลข Row No. มาด้วยในไฟล์ แต่จับคู่กับโครงการเดิมไม่ได้เลย (ทั้งด้วย Row No. และด้วยชื่อ/End
    // User/Dealer) — เสี่ยงเป็นเคส "จับคู่พลาด" มากกว่าโครงการใหม่จริง (เช่น ชื่อ Dealer สะกดไม่ตรงกับที่มี
    // ในระบบ) ถ้าปล่อยให้ import แบบ "เพิ่มใหม่" ไปเฉยๆ จะได้โครงการซ้ำ ส่วนของเดิมที่ควรถูกอัปเดตจะไม่ขยับเลย
    var unmatchedRowNo = (hasAnyRowNoInSystem && !existing && _pipeCol(r, colMap, 'rowNo').trim()) ? _pipeCol(r, colMap, 'rowNo').trim() : '';
    return { row: r, dealer: d, existing: existing, state: state, diff: diff, unmatchedRowNo: unmatchedRowNo };
  });

  // หา pipeline ที่มีในระบบแต่ไม่มีในไฟล์ (scoped ตาม dealer ถ้าล็อกไว้)
  var missingPipes = [];
  allPipes.forEach(function(p) {
    if (dealerId && p.dealerId !== dealerId) return;
    var hasIdentity = (p.rowNo && String(p.rowNo).trim()) || _pipeImportKey(p.projectName, p.endUserTH, p.dealerId);
    if (hasIdentity && !matchedIds[p.id]) missingPipes.push(p);
  });

  // เช็คว่ามี model ในช่อง "Model" ที่ไม่ตรงกับ 6 กลุ่มหลัก (จะสูญหายหลัง import)
  var unknownModelRows = [];
  rowMeta.forEach(function(m, i) {
    var modelCell = _pipeCol(m.row, colMap, 'model').trim();
    var hasUnknown = false;
    if (modelCell) {
      hasUnknown = modelCell.split('\n').some(function(line) {
        var n = (line.split('*')[0] || '').trim().toUpperCase();
        if (!n) return false;
        return !(n.indexOf('M3M') !== -1 || n.indexOf('MULTISPECTRAL') !== -1 || n.indexOf('MATRICE 3M') !== -1 ||
                 n.indexOf('M4TD') !== -1 || n.indexOf('MATRICE 4TD') !== -1 ||
                 n.indexOf('M4T') !== -1  || n.indexOf('MATRICE 4T') !== -1 ||
                 n.indexOf('M4E') !== -1  || n.indexOf('MATRICE 4E') !== -1 ||
                 n.indexOf('M400') !== -1 || n.indexOf('MATRICE 400') !== -1 ||
                 n.indexOf('DOCK') !== -1);
      });
    }
    m.hasIssue = hasUnknown || !!m.unmatchedRowNo;
    if (hasUnknown) unknownModelRows.push(i + 1);
  });

  // กลุ่ม Dealer ที่พบในไฟล์นี้ (รวมแถวที่จับคู่ Dealer ไม่ได้เลยเป็นกลุ่ม "(ไม่มี Dealer)") — ใช้สร้าง chip กรอง
  var dealerBuckets = {};
  var dealerBucketOrder = [];
  rowMeta.forEach(function(m) {
    var key = m.dealer ? m.dealer.id : '__none__';
    if (!dealerBuckets[key]) {
      dealerBuckets[key] = { label: m.dealer ? m.dealer.name : '(ไม่มี Dealer)', count: 0 };
      dealerBucketOrder.push(key);
    }
    dealerBuckets[key].count++;
    m.dealerKey = key;
  });

  var h = '<div>';
  if (dealer) h += '<div style="font-size:.8rem;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;margin-bottom:8px">🏪 Dealer: <b>' + sanitize(dealer.name) + '</b> — จะถูก set ให้ทุก row</div>';
  if (unknownModelRows.length) h += '<div style="font-size:11px;background:#f59e0b18;border:1px solid #f59e0b40;border-radius:6px;padding:6px 10px;margin-bottom:8px">⚠️ แถวที่ ' + unknownModelRows.join(', ') + ' มีสินค้าที่ไม่ใช่ 6 รุ่นหลัก (M3M/M4T/M4E/M4TD/M400/Dock3) — จะสูญหายหลัง import เพราะไม่มีคอลัมน์รองรับ</div>';

  // ── แท็บกรองสถานะ ──────────────────────────────────────────────
  var tabDefs = [
    { key: 'all',     label: 'ทั้งหมด',            count: rows.length,             bg: 'var(--bg2)',      color: 'var(--text)' },
    { key: 'new',     label: '➕ ใหม่',             count: counts['new'],           bg: '#22c55e18',       color: '#22c55e' },
    { key: 'changed', label: '✏️ เปลี่ยน',          count: counts['changed'],       bg: '#f59e0b18',       color: '#f59e0b' },
    { key: 'same',    label: '⏭ เดิม',              count: counts['same'],          bg: 'var(--bg2)',      color: 'var(--text2)' },
    { key: 'missing', label: '🗑️ ไม่มีในไฟล์',      count: missingPipes.length,     bg: '#ef444418',       color: '#ef4444' }
  ];
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
  tabDefs.forEach(function(t) {
    if (t.key !== 'all' && t.key !== 'missing' && !t.count) return;
    if (t.key === 'missing' && !t.count) return;
    h += '<button id="pipeFTab_' + t.key + '" onclick="_pipeImportSetFilter(\'' + t.key + '\')" style="padding:5px 12px;border-radius:6px;background:' + t.bg + ';color:' + t.color + ';font-size:12px;border:1px solid ' + (t.key === 'all' ? 'var(--border-strong,var(--border))' : 'transparent') + ';cursor:pointer">' + sanitize(t.label) + ' ' + t.count + '</button>';
  });
  h += '</div>';

  // ── กรองตาม Dealer (chip เลือกได้หลายอัน) — โชว์เฉพาะตอนมีมากกว่า 1 Dealer ในไฟล์ ไม่งั้นไม่มีอะไรให้กรอง ──
  if (dealerBucketOrder.length > 1) {
    h += '<div style="font-size:11px;color:var(--text2);margin-bottom:5px">🏪 กรองตาม Dealer</div>';
    h += '<div id="pipeDealerChips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:5px">';
    dealerBucketOrder.forEach(function(key) {
      var b = dealerBuckets[key];
      h += '<button class="pipe-dealer-chip" data-key="' + sanitize(key) + '" onclick="_pipeToggleDealerFilterChip(\'' + key.replace(/'/g, "\\'") + '\')" style="padding:4px 10px;border-radius:999px;font-size:11px;border:1px solid var(--border-strong,var(--border));background:var(--accent,#3b82f6);color:#fff;cursor:pointer">' + sanitize(b.label) + ' (' + b.count + ')</button>';
    });
    h += '</div>';
    h += '<div style="display:flex;gap:10px;margin-bottom:10px">';
    h += '<button onclick="_pipeDealerFilterAll()" style="font-size:11px;background:none;border:none;color:var(--accent,#3b82f6);cursor:pointer;padding:0">เลือกทั้งหมด</button>';
    h += '<button onclick="_pipeDealerFilterNone()" style="font-size:11px;background:none;border:none;color:var(--accent,#3b82f6);cursor:pointer;padding:0">ล้างทั้งหมด</button>';
    h += '</div>';
  }

  // ── ตัวกรอง/ค้นหา/เรียงเพิ่มเติม ──────────────────────────────────
  h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">';
  h += '<input type="text" id="pipeImportSearch" placeholder="🔍 ค้นหา Project Name / Row No." oninput="_pipeImportSearchInput(this.value)" style="flex:1;min-width:160px;font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)">';
  h += '<select id="pipeImportSort" onchange="_pipeImportSortChange(this.value)" style="font-size:12px;padding:5px 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)">';
  h += '<option value="rowno">เรียง: Row No.</option>';
  h += '<option value="fc_desc">เรียง: Forecast มาก→น้อย</option>';
  h += '<option value="fc_asc">เรียง: Forecast น้อย→มาก</option>';
  h += '</select>';
  h += '<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2);cursor:pointer"><input type="checkbox" id="pipeImportIssuesOnly" onchange="_pipeApplyImportFilters()" style="width:auto">แสดงเฉพาะแถวที่มีปัญหา</label>';
  h += '</div>';

  // ── การ์ดสรุปตามตัวกรองปัจจุบัน (อัปเดตสดทุกครั้งที่กรอง) ──────────
  h += '<div id="pipeImportSummary" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px"></div>';

  if (counts['changed'] || counts['same']) {
    h += '<div style="font-size:11px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:5px 10px;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
    h += '<span style="color:var(--text2)">ปรับทั้งหมด:</span>';
    h += '<select onchange="_pipeImportBulkAct(this.value)" style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">';
    h += '<option value="">— เลือก —</option>';
    h += '<option value="update">✏️ อัปเดตทุกรายการ</option>';
    h += '<option value="add">➕ เพิ่มใหม่ทุกรายการ (ยอมซ้ำ)</option>';
    h += '<option value="skip">⏭ ข้ามทุกรายการ</option>';
    h += '</select>';
    h += '<select id="pipeBulkScope" style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">';
    h += '<option value="filtered">เฉพาะแถวที่กรองอยู่</option>';
    h += '<option value="all">ทั้งไฟล์</option>';
    h += '</select>';
    h += '</div>';
  }

  h += '<div style="max-height:420px;overflow-y:auto;font-size:13px;border:1px solid var(--border);border-radius:6px;background:var(--bg2)">';
  h += '<table style="width:100%;border-collapse:collapse"><thead><tr style="position:sticky;top:0;background:var(--bg2)">' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:center;white-space:nowrap">สถานะ</th>' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:left;white-space:nowrap">Row No.</th>' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:left">Project Name</th>' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:left">Dealer</th>' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:right">Forecast</th>' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:left">การดำเนินการ</th>' +
    '</tr></thead><tbody id="pipeImportRowsBody">';
  rowMeta.forEach(function(m, i) {
    var r = m.row;
    var fc = parseFloat((_pipeCol(r, colMap, 'forecastAmount') || '').replace(/,/g, '')) || 0;
    var badge, defAct;
    if (m.state === 'new')          { badge = '<span style="color:#22c55e;font-size:11px;font-weight:700">➕ ใหม่</span>';       defAct = 'add'; }
    else if (m.state === 'changed') { badge = '<span style="color:#f59e0b;font-size:11px;font-weight:700">✏️ เปลี่ยน</span>';  defAct = 'update'; }
    else                            { badge = '<span style="color:var(--text2);font-size:11px;font-weight:700">⏭ เดิม</span>'; defAct = 'skip'; }
    if (m.unmatchedRowNo) {
      badge += ' <span style="color:#ef4444;font-size:10px;font-weight:700" title="แถวนี้มี Row No. ' + sanitize(m.unmatchedRowNo) + ' มาในไฟล์ แต่หาโครงการเดิมที่ตรงกันในระบบไม่เจอเลย (เช็ค Row No./ชื่อ Dealer ให้ตรงกัน ไม่งั้นจะได้โครงการซ้ำแทนที่จะอัปเดตของเดิม)">⚠️ Row No. ไม่พบของเดิม</span>';
    }
    var rProjectName = _pipeCol(r, colMap, 'projectName');
    var rEndUserTH = _pipeCol(r, colMap, 'endUserTH');
    var nameDisplay = rProjectName.trim()
      ? sanitize(rProjectName)
      : '<i style="color:var(--text2)">' + sanitize(rEndUserTH || '-') + '</i>';
    var diffBtn = m.state === 'changed'
      ? ' <button onclick="_pipeToggleDiff(' + i + ')" id="pipeDiffBtn_' + i + '" style="font-size:10px;padding:1px 5px;border:1px solid var(--border);border-radius:4px;background:var(--bg);cursor:pointer;color:var(--text2)" title="ดูการเปลี่ยนแปลง">🔍 ' + m.diff.length + '</button>'
      : '';
    var sel =
      '<select id="pipeRowAct_' + i + '" style="font-size:12px;padding:3px 5px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">' +
        '<option value="add"'    + (defAct === 'add'    ? ' selected' : '') + '>➕ เพิ่มใหม่</option>' +
        '<option value="update"' + (defAct === 'update' ? ' selected' : '') + '>✏️ อัปเดต</option>' +
        '<option value="skip"'   + (defAct === 'skip'   ? ' selected' : '') + '>⏭ ข้าม</option>' +
      '</select>';
    h += '<tr data-pstate="' + m.state + '" data-idx="' + i + '" data-dealer="' + sanitize(m.dealerKey) + '" data-issue="' + (m.hasIssue ? '1' : '0') + '" data-name="' + sanitize((rProjectName || rEndUserTH || '').toLowerCase()) + '" data-rowno="' + sanitize(_pipeCol(r, colMap, 'rowNo') || '') + '" data-forecast="' + fc + '" style="border-bottom:' + (m.state === 'changed' ? 'none' : '1px solid var(--border)') + '">' +
      '<td style="padding:5px 10px;text-align:center;white-space:nowrap">' + badge + diffBtn + '</td>' +
      '<td style="padding:5px 10px;color:var(--text2);white-space:nowrap">' + sanitize(_pipeCol(r, colMap, 'rowNo') || '-') + '</td>' +
      '<td style="padding:5px 10px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize((rProjectName || rEndUserTH || '')) + '">' + nameDisplay + '</td>' +
      '<td style="padding:5px 10px;font-size:12px;color:var(--text2);white-space:nowrap">' + sanitize(m.dealer ? m.dealer.name : (_pipeCol(r, colMap, 'dealerName')||'-')) + '</td>' +
      '<td style="padding:5px 10px;text-align:right;font-size:12px;white-space:nowrap">' + (fc ? fmtMoneyShort(fc) : '-') + '</td>' +
      '<td style="padding:5px 10px">' + sel +
        '<button onclick="_pipeXlsxOpenDetail(' + i + ')" style="display:block;margin-top:3px;font-size:10px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);cursor:pointer;color:var(--text2);width:100%" title="ดู/แก้ไขทุกคอลัมน์">📝 รายละเอียด</button>' +
      '</td>' +
      '</tr>';
    if (m.state === 'changed' && m.diff.length) {
      h += '<tr data-pstate="changed" id="pipeDiffRow_' + i + '" style="display:none;border-bottom:1px solid var(--border)">' +
        '<td colspan="6" style="padding:6px 16px 8px;background:var(--bg)">' +
        '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
        '<thead><tr>' +
          '<th style="padding:2px 8px;text-align:left;color:var(--text2);border-bottom:1px solid var(--border)">Field</th>' +
          '<th style="padding:2px 8px;text-align:left;color:#ef4444;border-bottom:1px solid var(--border)">ค่าเดิม</th>' +
          '<th style="padding:2px 8px;text-align:left;color:#22c55e;border-bottom:1px solid var(--border)">ค่าใหม่</th>' +
        '</tr></thead><tbody>';
      m.diff.forEach(function(d) {
        h += '<tr>' +
          '<td style="padding:2px 8px;color:var(--text2);white-space:nowrap">' + sanitize(d.label) + '</td>' +
          '<td style="padding:2px 8px;color:#ef4444;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(d.old) + '">' + sanitize(d.old || '(ว่าง)') + '</td>' +
          '<td style="padding:2px 8px;color:#22c55e;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(d.newVal) + '">' + sanitize(d.newVal || '(ว่าง)') + '</td>' +
          '</tr>';
      });
      h += '</tbody></table></td></tr>';
    }
  });
  h += '</tbody></table></div>';

  // ── Detail panel: ดู/แก้ไขทุกคอลัมน์ของแถวเดียว พร้อมปุ่มย้อนกลับ/ถัดไป ──
  h += '<div id="pipeXlsxDetailPanel" style="display:none;margin-top:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 14px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h += '<div style="display:flex;align-items:center;gap:8px">';
  h += '<button onclick="_pipeXlsxDetailNav(-1)" style="width:30px;padding:4px 0" title="ก่อนหน้า">◀</button>';
  h += '<span style="font-size:12px;color:var(--text2)">แถวที่ <b id="pipeXlsxDetailPos" style="color:var(--text)"></b></span>';
  h += '<button onclick="_pipeXlsxDetailNav(1)" style="width:30px;padding:4px 0" title="ถัดไป">▶</button>';
  h += '</div>';
  h += '<button onclick="_pipeXlsxDetailClose()" style="border:none;background:none;cursor:pointer;font-size:13px;color:var(--text2)">✕</button>';
  h += '</div>';
  h += '<div id="pipeXlsxDetailFields" style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px"></div>';
  h += '</div>';

  // ── Missing section ──────────────────────────────────────────────
  if (missingPipes.length) {
    var dealerMap = {};
    dealers.forEach(function(d) { dealerMap[d.id] = d; });
    h += '<div id="pipeMissingBlock" style="margin-top:12px;border:1px solid #ef444440;border-radius:6px;background:#ef444408;padding:10px">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
    h += '<span style="font-size:.8rem;font-weight:700;color:#ef4444">🗑️ ไม่มีในไฟล์ Excel: ' + missingPipes.length + ' โครงการ</span>';
    if (!dealerId) h += '<span style="font-size:10px;color:var(--text2)">(ไฟล์นี้อาจเป็นแค่ส่วนหนึ่ง ตรวจสอบก่อนลบ)</span>';
    h += '<label style="margin-left:auto;font-size:11px;color:var(--text2);cursor:pointer"><input type="checkbox" onchange="_pipeMissingChkAll(this.checked)" style="margin-right:4px">เลือกทั้งหมด</label>';
    h += '</div>';
    h += '<div style="max-height:180px;overflow-y:auto;font-size:12px">';
    missingPipes.forEach(function(mp) {
      var mpDealer = dealerMap[mp.dealerId];
      h += '<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer">' +
        '<input type="checkbox" id="pipeMissingChk_' + mp.id + '" style="flex-shrink:0">' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          sanitize((mp.projectName || mp.endUserTH || '-')) +
          (mpDealer ? ' <span style="color:var(--text2);font-size:10px">(' + sanitize(mpDealer.name) + ')</span>' : '') +
          ' <span style="color:var(--text2);font-size:10px">— ' + sanitize(mp.status || '-') + '</span>' +
        '</span>' +
        '</label>';
    });
    h += '</div>';
    h += '<div style="font-size:10px;color:#ef4444;margin-top:6px">⚠️ รายการที่ติ๊กจะถูกลบถาวรพร้อมกับการ import — ไม่สามารถกู้คืนได้</div>';
    h += '</div>';
  }

  h += '<div style="display:flex;gap:8px;margin-top:12px">';
  h += '<button class="btn bp" style="flex:1" onclick="_doPipeXlsxImport()">📥 นำเข้า ' + rows.length + ' โครงการ</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '</div></div>';
  window._pipeXlsxPending = { rows: rows, dealerId: dealerId, rowMeta: rowMeta, missing: missingPipes, colMap: colMap };
  openM('📂 Preview: Import Pipeline จาก Excel', h);
  setMWide(960);
  _pipeImportFilter = { status: 'all', dealers: null, sort: 'rowno', search: '' }; // dealers: null = ทุกตัวถูกเลือก
  _pipeImportSetFilter('all');
}

// สถานะตัวกรองปัจจุบันของ preview import — reset ใหม่ทุกครั้งที่เปิด preview (ดู _showPipeXlsxPreview)
// dealers: null = ทุก Dealer ถูกเลือกอยู่ (ค่าเริ่มต้น), object {key: false} = ตัวที่ถูกเอาออกจากตัวกรอง
var _pipeImportFilter = { status: 'all', dealers: null, sort: 'rowno', search: '' };

// สลับ tab กรองสถานะ — ยังทำงานร่วมกับตัวกรองอื่น (Dealer/ค้นหา/มีปัญหา) ผ่าน _pipeApplyImportFilters
function _pipeImportSetFilter(state) {
  _pipeImportFilter.status = state;
  var missingBlock = document.getElementById('pipeMissingBlock');
  if (missingBlock) missingBlock.style.display = (state === 'all' || state === 'missing') ? '' : 'none';
  ['all', 'new', 'changed', 'same', 'missing'].forEach(function(k) {
    var btn = document.getElementById('pipeFTab_' + k);
    if (btn) btn.style.border = (k === state) ? '1px solid var(--border-strong,var(--border))' : '1px solid transparent';
  });
  _pipeApplyImportFilters();
}

function _pipeRenderDealerChips() {
  document.querySelectorAll('.pipe-dealer-chip').forEach(function(el) {
    var key = el.getAttribute('data-key');
    var on = !_pipeImportFilter.dealers || _pipeImportFilter.dealers[key] !== false;
    el.style.background = on ? 'var(--accent,#3b82f6)' : 'var(--bg)';
    el.style.color = on ? '#fff' : 'var(--text2)';
    el.style.borderColor = on ? 'var(--accent,#3b82f6)' : 'var(--border-strong,var(--border))';
  });
}

function _pipeToggleDealerFilterChip(key) {
  if (!_pipeImportFilter.dealers) {
    var all = {};
    document.querySelectorAll('.pipe-dealer-chip').forEach(function(el) { all[el.getAttribute('data-key')] = true; });
    _pipeImportFilter.dealers = all;
  }
  _pipeImportFilter.dealers[key] = !_pipeImportFilter.dealers[key];
  _pipeRenderDealerChips();
  _pipeApplyImportFilters();
}

function _pipeDealerFilterAll() {
  _pipeImportFilter.dealers = null;
  _pipeRenderDealerChips();
  _pipeApplyImportFilters();
}

function _pipeDealerFilterNone() {
  var none = {};
  document.querySelectorAll('.pipe-dealer-chip').forEach(function(el) { none[el.getAttribute('data-key')] = false; });
  _pipeImportFilter.dealers = none;
  _pipeRenderDealerChips();
  _pipeApplyImportFilters();
}

function _pipeImportSearchInput(v) {
  _pipeImportFilter.search = (v || '').trim().toLowerCase();
  _pipeApplyImportFilters();
}

function _pipeImportSortChange(v) {
  _pipeImportFilter.sort = v;
  _pipeApplyImportFilters();
}

// ตัวกรองรวม (สถานะ/Dealer/ค้นหา/เฉพาะแถวมีปัญหา) + เรียงลำดับ + อัปเดตการ์ดสรุป — เรียกทุกครั้งที่ตัวกรองไหนเปลี่ยน
// พับ diff row (🔍 ดูการเปลี่ยนแปลง) กลับเสมอทุกครั้งที่กรองใหม่ เหมือนพฤติกรรมเดิม ไม่ได้ตัดปุ่มนี้ออก
function _pipeApplyImportFilters() {
  var st = _pipeImportFilter;
  var tbody = document.getElementById('pipeImportRowsBody');
  if (!tbody) return;
  var mainRows = Array.prototype.slice.call(tbody.querySelectorAll('tr[data-pstate]')).filter(function(tr) {
    return tr.id.indexOf('pipeDiffRow_') !== 0;
  });

  // เรียงลำดับก่อน (ย้ายทั้งแถวหลัก + แถว diff คู่กันไปด้วย)
  var sorted = mainRows.slice();
  if (st.sort === 'fc_desc') sorted.sort(function(a, b) { return (parseFloat(b.getAttribute('data-forecast')) || 0) - (parseFloat(a.getAttribute('data-forecast')) || 0); });
  else if (st.sort === 'fc_asc') sorted.sort(function(a, b) { return (parseFloat(a.getAttribute('data-forecast')) || 0) - (parseFloat(b.getAttribute('data-forecast')) || 0); });
  else sorted.sort(function(a, b) { return (a.getAttribute('data-rowno') || '').localeCompare(b.getAttribute('data-rowno') || '', undefined, { numeric: true }); });
  sorted.forEach(function(tr) {
    tbody.appendChild(tr);
    var diffTr = document.getElementById('pipeDiffRow_' + tr.getAttribute('data-idx'));
    if (diffTr) tbody.appendChild(diffTr);
  });

  var issuesOnlyEl = document.getElementById('pipeImportIssuesOnly');
  var issuesOnly = issuesOnlyEl && issuesOnlyEl.checked;
  var visibleCount = 0, visibleForecast = 0;
  mainRows.forEach(function(tr) {
    var dealerOk = !st.dealers || st.dealers[tr.getAttribute('data-dealer')] !== false;
    var statusOk = st.status === 'all' || tr.getAttribute('data-pstate') === st.status;
    var issueOk = !issuesOnly || tr.getAttribute('data-issue') === '1';
    var searchOk = !st.search || tr.getAttribute('data-name').indexOf(st.search) !== -1 || tr.getAttribute('data-rowno').toLowerCase().indexOf(st.search) !== -1;
    var show = dealerOk && statusOk && issueOk && searchOk;
    tr.style.display = show ? '' : 'none';
    if (show) { visibleCount++; visibleForecast += parseFloat(tr.getAttribute('data-forecast')) || 0; }
    var diffTr = document.getElementById('pipeDiffRow_' + tr.getAttribute('data-idx'));
    if (diffTr) diffTr.style.display = 'none'; // พับกลับทุกครั้งที่กรองใหม่
  });

  var summaryEl = document.getElementById('pipeImportSummary');
  if (summaryEl) {
    summaryEl.innerHTML =
      '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:8px 10px"><div style="font-size:10px;color:var(--text2)">โครงการที่กรองอยู่</div><div style="font-size:18px;font-weight:700">' + visibleCount + '</div></div>' +
      '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:8px 10px"><div style="font-size:10px;color:var(--text2)">รวม Forecast</div><div style="font-size:18px;font-weight:700">' + fmtMoneyShort(visibleForecast) + '</div></div>';
  }
}

function _pipeMissingChkAll(checked) {
  var p = window._pipeXlsxPending;
  if (!p || !p.missing) return;
  p.missing.forEach(function(mp) {
    var el = document.getElementById('pipeMissingChk_' + mp.id);
    if (el) el.checked = checked;
  });
}

function _pipeImportBulkAct(val) {
  if (!val) return;
  var scopeEl = document.getElementById('pipeBulkScope');
  var scope = scopeEl ? scopeEl.value : 'filtered';
  var i = 0;
  while (document.getElementById('pipeRowAct_' + i)) {
    var sel = document.getElementById('pipeRowAct_' + i);
    var tr = sel.closest('tr');
    var visible = !tr || tr.style.display !== 'none';
    if (scope === 'all' || visible) sel.value = val;
    i++;
  }
}

function _pipeToggleDiff(i) {
  var row = document.getElementById('pipeDiffRow_' + i);
  var btn = document.getElementById('pipeDiffBtn_' + i);
  if (!row) return;
  var open = row.style.display !== 'none';
  row.style.display = open ? 'none' : '';
  if (btn) btn.style.background = open ? '' : 'var(--accent)';
}

// ── Detail panel: ดู/แก้ไขทุกคอลัมน์ของแถว xlsx preview ──────────
// idx ต่อ field ได้จาก colMap ของไฟล์ที่กำลัง import อยู่ (ไม่ใช่ตำแหน่งคงที่) — field ไหนไม่มีคอลัมน์ในไฟล์
// (colMap ไม่มี key นั้น) จะถูกข้าม ไม่มีให้แก้ในหน้านี้ เพราะไม่รู้จะเขียนกลับตำแหน่งไหน
var _pipeXlsxDetailIdx = 0;
var _PIPE_DETAIL_FIELD_DEFS = [
  { key: 'rowNo',             label: 'Row No.' },
  { key: 'registerDate',      label: 'Register Date', date: true },
  { key: 'projectId',         label: 'Project ID' },
  { key: 'projectName',       label: 'Project Name', wide: true },
  { key: 'endUserTH',         label: 'End User TH' },
  { key: 'endUserEN',         label: 'End User EN' },
  { key: 'unitType',          label: 'Unit type' },
  { key: 'dealerName',        label: 'Dealer Name' },
  { key: 'djiDealer',         label: 'DJI Dealer' },
  { key: 'projectRevenue',    label: 'Project Revenue' },
  { key: 'model',             label: 'Model', wide: true },
  { key: 'm3m',                label: 'M3M Qty' },
  { key: 'm4t',                label: 'M4T Qty' },
  { key: 'm4e',                label: 'M4E Qty' },
  { key: 'dock3',              label: 'Dock3 Qty' },
  { key: 'm4td',               label: 'M4TD Qty' },
  { key: 'm400',               label: 'M400 Qty' },
  { key: 'forecastAmount',    label: 'Forecast Amount' },
  { key: 'realAmount',        label: 'Real Amount' },
  { key: 'tor',                label: 'TOR' },
  { key: 'biddingDate',       label: 'Bidding Date', date: true },
  { key: 'forecastMonth',     label: 'Forecast Month' },
  { key: 'shipmentDate',      label: 'Shipment Date', date: true },
  { key: 'remark',             label: 'Remark', wide: true },
  { key: 'appointmentLetter', label: 'Letter' },
  { key: 'projectPOS',         label: 'Project POS' },
  { key: 'status',             label: 'Status' },
  { key: 'saleName',           label: 'Sale' }
];
function _pipeXlsxDetailFields(colMap) {
  var out = [];
  _PIPE_DETAIL_FIELD_DEFS.forEach(function(def) {
    var idx = colMap ? colMap[def.key] : undefined;
    if (idx === undefined) return;
    out.push({ idx: idx, label: def.label, date: def.date, wide: def.wide });
  });
  return out;
}

function _pipeXlsxOpenDetail(i) {
  _pipeXlsxDetailIdx = i;
  var panel = document.getElementById('pipeXlsxDetailPanel');
  if (panel) panel.style.display = '';
  _pipeXlsxRenderDetail();
  var panelEl = document.getElementById('pipeXlsxDetailPanel');
  if (panelEl) panelEl.scrollIntoView({ block: 'nearest' });
}

function _pipeXlsxDetailNav(delta) {
  var p = window._pipeXlsxPending;
  if (!p) return;
  var next = _pipeXlsxDetailIdx + delta;
  if (next < 0 || next >= p.rows.length) return;
  _pipeXlsxDetailIdx = next;
  _pipeXlsxRenderDetail();
}

function _pipeXlsxDetailClose() {
  var panel = document.getElementById('pipeXlsxDetailPanel');
  if (panel) panel.style.display = 'none';
}

// แก้ค่า field ใน memory ทันทีที่พิมพ์/เลือก (ไม่ต้องกดบันทึกแยก) — เขียนกลับเข้า p.rows[i] ตรงๆ
// เพราะ rowMeta[i].row อ้างอิง object เดียวกับ p.rows[i] จะถูกใช้ตอนกด "นำเข้า" ที่ปุ่มหลักทันที
// ponytail: ไม่ recompute diff/badge ของแถวหลังแก้ไข — ยอมรับได้ เพราะยังเห็นค่าล่าสุดในช่องอยู่แล้ว
function _pipeXlsxDetailFieldChange(colIdx, value) {
  var p = window._pipeXlsxPending;
  if (!p) return;
  p.rows[_pipeXlsxDetailIdx][colIdx] = value;
}

function _pipeXlsxRenderDetail() {
  var p = window._pipeXlsxPending;
  if (!p) return;
  var row = p.rows[_pipeXlsxDetailIdx];
  var posEl = document.getElementById('pipeXlsxDetailPos');
  if (posEl) posEl.textContent = (_pipeXlsxDetailIdx + 1) + ' / ' + p.rows.length;
  var grid = document.getElementById('pipeXlsxDetailFields');
  if (!grid) return;
  var h = '';
  _pipeXlsxDetailFields(p.colMap).forEach(function(f) {
    var raw = row[f.idx] || '';
    var inputHtml;
    if (f.date) {
      var iso = _pipeDateFromPaste(raw);
      inputHtml = '<input type="date" value="' + iso + '" onchange="_pipeXlsxDetailFieldChange(' + f.idx + ',this.value)" style="width:100%">';
    } else {
      inputHtml = '<input type="text" value="' + sanitize(raw) + '" oninput="_pipeXlsxDetailFieldChange(' + f.idx + ',this.value)" style="width:100%">';
    }
    h += '<div style="' + (f.wide ? 'grid-column:1 / -1' : '') + '">' +
      '<label style="display:block;font-size:11px;color:var(--text2);margin-bottom:2px">' + f.label + '</label>' +
      inputHtml +
      '</div>';
  });
  grid.innerHTML = h;
}

function _doPipeXlsxImport() {
  var p = window._pipeXlsxPending;
  window._pipeXlsxPending = null;
  if (!p) return;
  var actions = (p.rowMeta || []).map(function(m, i) {
    var el = document.getElementById('pipeRowAct_' + i);
    if (el) return el.value;
    return m.state === 'same' ? 'skip' : m.state === 'changed' ? 'update' : 'add';
  });
  var deleteIds = (p.missing || []).filter(function(mp) {
    var el = document.getElementById('pipeMissingChk_' + mp.id);
    return el && el.checked;
  }).map(function(mp) { return mp.id; });
  closeMForce();
  _processPipeImportRows(p.rows, p.dealerId, actions, deleteIds, p.colMap);
}

// ---- core row processor (shared by paste + xlsx) ----
// actions[i]: null=auto, 'update'=อัปเดตทับ, 'add'=เพิ่มใหม่ยอมซ้ำ, 'skip'=ข้าม
// deleteIds: array of pipeline IDs to delete (missing from Excel, user-selected)
// colMap: {key: colIndex} จาก _pipeBuildColMap
// สร้าง id แบบเดียวกับ ST.add() ทุกประการ — ใช้ตอน batch เขียนเองแทนเรียก ST.add ทีละแถว (ดูเหตุผลด้านล่าง)
function _pipeGenId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}
function _processPipeImportRows(rows, lockDealerId, actions, deleteIds, colMap) {
  if (typeof ST._guestBlocked === 'function' && ST._guestBlocked('pipeline')) return;
  var lockDealer = lockDealerId ? ST.getOne('dealers', lockDealerId) : null;
  var dealers = ST.getAll('dealers');
  var dealerByName = {};
  dealers.forEach(function(d) { if (d.name) dealerByName[d.name.trim().toLowerCase()] = d; });

  // เขียนลง array ในหน่วยความจำระหว่าง loop แล้ว ST._set() แค่ครั้งเดียวตอนจบ (ดูคอมเมนต์ล่างสุดของ
  // ฟังก์ชันนี้ตรง "เขียนครั้งเดียว") แทนที่จะเรียก ST.add/ST.update ทีละแถวเหมือนเดิม — ของเดิม ST._set()
  // ถูกเรียกทุกแถว และ firebase-sync.js override ไว้ให้ push "ทั้ง collection" ขึ้น Firestore ใหม่ทุกครั้ง
  // ที่ _set() ถูกเรียก ไม่ใช่แค่ record ที่เปลี่ยน — import 500 แถวเข้า Pipeline ที่มี 2000 รายการอยู่แล้ว
  // เลยกลายเป็นดัน Firestore ~2000 doc ซ้ำ 500 รอบ (~1,000,000 ครั้ง) ทำให้ import ค้างนานเวลาข้อมูลเยอะ
  var allPipes = ST.getAll('pipeline');
  var pipeByKey = {};
  var pipeByRowNo = {};
  var pipeIndexById = {};
  allPipes.forEach(function(p, idx) {
    var k = _pipeImportKey(p.projectName, p.endUserTH, p.dealerId);
    if (k) pipeByKey[k] = p;
    if (p.rowNo && String(p.rowNo).trim()) pipeByRowNo[String(p.rowNo).trim()] = p;
    pipeIndexById[p.id] = idx;
  });
  var pipeLogs = ST.getAll('pipeLog');

  // เก็บ Sale ล่าสุดที่เจอต่อ Dealer ระหว่าง import — เอาไว้ผูกกลับเข้า "เซลที่ดูแล" ของ Dealer หลัง loop จบ
  // (แถวหลังสุดของ dealer เดียวกันชนะ ถ้าชีทมีหลายแถวค่าไม่ตรงกัน)
  var dealerSaleSync = {};
  var added = 0, updated = 0, skipped = 0;
  rows.forEach(function(c, idx) {
    var projectId   = _pipeCol(c, colMap, 'projectId').trim();
    var projectName = _pipeCol(c, colMap, 'projectName').trim();
    var endUserTH   = _pipeCol(c, colMap, 'endUserTH').trim();
    if (!projectName && !endUserTH) { skipped++; return; }

    var dealer = lockDealer || dealerByName[(_pipeCol(c, colMap, 'dealerName').trim()).toLowerCase()];
    var existing = _pipeFindExistingForImport(_pipeCol(c, colMap, 'rowNo'), projectName, endUserTH, dealer ? dealer.id : '', pipeByRowNo, pipeByKey);
    var existingItems = existing ? existing.items : null;

    // คอลัมน์ Model เก็บชื่อเต็ม + จำนวนจริง ("ชื่อ*จำนวน" ต่อบรรทัด) — ใช้เป็นแหล่งหลักเสมอถ้ามีข้อมูล
    // fallback ไปอ่าน 6 คอลัมน์ Qty สรุปกลุ่ม (ชื่อกลุ่มทั่วไป) เฉพาะกรณีคอลัมน์ Model ว่าง เช่น ไฟล์เก่า/ทีมแก้แต่ตัวเลขสรุปในชีต
    var items = [];
    var modelCellText = _pipeCol(c, colMap, 'model').trim();
    if (modelCellText) {
      modelCellText.split('\n').forEach(function(line) {
        line = line.trim();
        if (!line) return;
        var parts = line.split('*');
        var model = (parts[0] || '').trim();
        var qty = parseInt(parts[1]) || 1;
        if (!model) return;
        var pr = _pipeImportLookupPrice(model, existingItems);
        items.push({ model: model, qty: qty, price: pr.price, total: qty * pr.price, sku: pr.sku });
      });
    } else {
      _PIPE_MODEL_KEYS.forEach(function(m) {
        var qty = parseInt(_pipeCol(c, colMap, m.key)) || 0;
        if (qty > 0) {
          var pr = _pipeImportLookupPrice(m.model, existingItems);
          items.push({ model: m.model, qty: qty, price: pr.price, total: qty * pr.price, sku: pr.sku });
        }
      });
    }

    var statusRaw = _pipeCol(c, colMap, 'status').trim();
    var status = (typeof _csvStatusToId === 'function') ? _csvStatusToId(statusRaw) : 'initial';
    if (!status) status = 'initial';

    var regDate = _pipeDateFromPaste(_pipeCol(c, colMap, 'registerDate'));
    var pipeBiddingDate = _pipeDateFromPaste(_pipeCol(c, colMap, 'biddingDate'));
    // มี Project ID = ถือว่าลงทะเบียน CRM แล้วเสมอ (Project ID ได้มาจากตอนลงทะเบียนเท่านั้น) — คงค่า djiCrmDate เดิมไว้ถ้ามีอยู่แล้ว
    var crmRegistered = projectId ? true : (existing ? !!existing.djiCrmRegistered : false);
    var crmDate = projectId ? ((existing && existing.djiCrmDate) || regDate || _td()) : (existing ? (existing.djiCrmDate || '') : '');

    var pipeData = {
      rowNo: _pipeCol(c, colMap, 'rowNo').trim(),
      registerDate: regDate,
      projectId: projectId,
      projectName: projectName,
      endUserTH: endUserTH,
      endUserEN: _pipeCol(c, colMap, 'endUserEN').trim(),
      unitType: _pipeCol(c, colMap, 'unitType').trim(),
      dealerId: dealer ? dealer.id : '',
      djiDealer: _pipeCol(c, colMap, 'djiDealer').trim(),
      projectRevenue: parseFloat(_pipeCol(c, colMap, 'projectRevenue').replace(/,/g, '')) || 0,
      items: items,
      model: items[0] ? items[0].model : '',
      modelQty: items[0] ? items[0].qty : 1,
      forecastAmount: parseFloat(_pipeCol(c, colMap, 'forecastAmount').replace(/,/g, '')) || 0,
      realAmount: parseFloat(_pipeCol(c, colMap, 'realAmount').replace(/,/g, '')) || 0,
      tor: _pipeCol(c, colMap, 'tor').trim(),
      biddingDate: pipeBiddingDate,
      shipmentDate: _pipeDateFromPaste(_pipeCol(c, colMap, 'shipmentDate'), pipeBiddingDate),
      remark: _pipeCol(c, colMap, 'remark').trim(),
      appointmentLetter: _pipeCol(c, colMap, 'appointmentLetter').trim(),
      projectPOS: parseInt(_pipeCol(c, colMap, 'projectPOS')) || 0,
      status: status,
      recurring: _pipeCol(c, colMap, 'recurring').trim().toLowerCase() === 'yes',
      djiCrmRegistered: crmRegistered,
      djiCrmDate: crmDate,
      saleName: _pipeCol(c, colMap, 'saleName').trim(),
      sheetDisplay: _pipeCol(c, colMap, 'sheetDisplay').trim() || 'Show',
      nextAction: '', followupDate: ''
    };

    var action = actions ? actions[idx] : (existing ? 'update' : 'add');

    if (action === 'skip') { skipped++; return; }
    if (dealer && pipeData.saleName) dealerSaleSync[dealer.id] = { dealer: dealer, saleName: pipeData.saleName };
    if (action === 'update' && existing) {
      // คอลัมน์ Update 1-6 ที่มีข้อความยังไม่เคยอยู่ใน log เดิมเลย (เช่น ชีทยังไม่ได้รวบ แต่แอป export แบบรวบ
      // ไปแล้ว) ให้เพิ่มเป็น pipeLog ใหม่ตามที่ชีทมีเลย ไม่พยายามจับคู่กับตัวรวบเดิม — กันข้อความหายตอน import
      var newUpdateLines = _pipeImportNewUpdateLines(existing, c, colMap);
      var pIdx = pipeIndexById[existing.id];
      allPipes[pIdx] = Object.assign({}, allPipes[pIdx], pipeData, { updated: new Date().toISOString() });
      updated++;
      newUpdateLines.forEach(function(line) {
        pipeLogs.push({ id: _pipeGenId(), pipeId: existing.id, type: 'note', content: line, date: pipeData.registerDate || new Date().toISOString(), created: new Date().toISOString() });
      });
    } else {
      var newPipeId = _pipeGenId();
      var newPipe = Object.assign({ id: newPipeId, created: new Date().toISOString() }, pipeData);
      allPipes.push(newPipe);
      pipeIndexById[newPipeId] = allPipes.length - 1;
      added++;
      for (var u = 1; u <= 6; u++) {
        var upd = _pipeCol(c, colMap, 'update' + u).trim();
        if (upd) pipeLogs.push({ id: _pipeGenId(), pipeId: newPipeId, type: 'note', content: upd, date: pipeData.registerDate || new Date().toISOString(), created: new Date().toISOString() });
      }
    }
  });

  // เขียนครั้งเดียว — ดูคอมเมนต์ที่ต้นฟังก์ชัน (แทนที่จะเขียนทีละแถว ลด Firestore full-collection push
  // จาก N ครั้งเหลือครั้งเดียว) ต้องเขียนก่อน deleteIds loop ด้านล่าง เพราะ ST.delete() อ่านจาก
  // localStorage ปัจจุบัน ถ้ายังไม่เขียน batch นี้ลงไปก่อน การลบจะไปอ่านข้อมูลเก่าที่ยังไม่รวมแถวที่เพิ่ง import
  if (added || updated) {
    ST._set(ST._keys.pipeline, allPipes);
    ST._set(ST._keys.pipeLog, pipeLogs);
  }

  var deleted = 0;
  if (deleteIds && deleteIds.length) {
    deleteIds.forEach(function(id) {
      ST.delete('pipeline', id);
      ST.deleteWhere('pipeLog', function(l) { return l.pipeId === id; });
      deleted++;
    });
  }

  // ผูกช่อง Sale ใน Excel กลับเข้า "เซลที่ดูแล" ของ Dealer — ถ้าไม่ตรงกับที่มีอยู่ ให้ import ทับ (ถือ Excel
  // เป็น source of truth) แล้วทับ Sale ของ Pipeline อื่นๆ ที่เหลือของ Dealer เดียวกันให้ตรงกันด้วย (เหมือน
  // ตอนแก้ "เซลที่ดูแล" จากฟอร์ม Dealer ตรงๆ — ดู cascadeDealerSaleNameToPipelines ใน views-dealer.js)
  var dealersSynced = 0;
  Object.keys(dealerSaleSync).forEach(function(dealerId) {
    var s = dealerSaleSync[dealerId];
    if (s.dealer.saleName === s.saleName) return;
    ST.update('dealers', dealerId, { saleName: s.saleName });
    if (typeof cascadeDealerSaleNameToPipelines === 'function') cascadeDealerSaleNameToPipelines(dealerId, s.saleName);
    dealersSynced++;
  });

  var msg = '✅ นำเข้าแล้ว';
  if (added)   msg += ' ➕' + added + ' ใหม่';
  if (updated) msg += ' ✏️' + updated + ' อัปเดต';
  if (deleted) msg += ' 🗑️' + deleted + ' ลบ';
  if (dealersSynced) msg += ' 👤' + dealersSynced + ' Dealer อัปเดตเซลที่ดูแล';
  if (skipped) msg += ' (ข้าม ' + skipped + ')';
  toast(msg);
  render();
}

// ================================================================
// BULK SELECT & DELETE
// ================================================================
function togglePipeSelectMode() {
  pipeSelectMode = !pipeSelectMode;
  pipeSelected = {};
  render();
}

function togglePipeSelect(id) {
  if (pipeSelected[id]) delete pipeSelected[id];
  else pipeSelected[id] = true;
  var cb = document.getElementById('pipeChk_' + id);
  if (cb) cb.checked = !!pipeSelected[id];
  var cnt = Object.keys(pipeSelected).length;
  _pipeSelBarUpdate(cnt);
  var allCb = document.getElementById('pipeSelAll');
  if (allCb) allCb.checked = cnt === _pipeVisibleIds.length && cnt > 0;
}

function togglePipeSelectAll(selectAll) {
  pipeSelected = {};
  if (selectAll) _pipeVisibleIds.forEach(function(id) { pipeSelected[id] = true; });
  _pipeVisibleIds.forEach(function(id) {
    var cb = document.getElementById('pipeChk_' + id);
    if (cb) cb.checked = !!pipeSelected[id];
  });
  _pipeSelBarUpdate(Object.keys(pipeSelected).length);
}

function _pipeSelBarUpdate(cnt) {
  var countEl = document.getElementById('pipeSelCount');
  if (countEl) countEl.textContent = cnt + ' รายการที่เลือก';
  var delBtn = document.getElementById('pipeSelDelBtn');
  if (delBtn) { delBtn.disabled = !cnt; delBtn.textContent = '🗑️ ลบที่เลือก (' + cnt + ')'; }
  var statusSel = document.getElementById('pipeSelStatusSel');
  if (statusSel) statusSel.disabled = !cnt;
}

function bulkDeletePipes() {
  var ids = Object.keys(pipeSelected);
  if (!ids.length) return;
  if (!confirm('ลบ ' + ids.length + ' Pipeline ที่เลือก?\nไม่สามารถกู้คืนได้')) return;
  ids.forEach(function(id) {
    ST.delete('pipeline', id);
    ST.deleteWhere('pipeLog', function(l) { return l.pipeId === id; });
    if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('pipeline', id);
  });
  pipeSelected = {};
  pipeSelectMode = false;
  toast('🗑️ ลบแล้ว ' + ids.length + ' รายการ');
  render();
}

function bulkChangePipeStatus() {
  var sel = document.getElementById('pipeSelStatusSel');
  var statusId = sel ? sel.value : '';
  if (!statusId) { toast('⚠️ เลือกสถานะก่อน'); return; }
  var ids = Object.keys(pipeSelected);
  if (!ids.length) return;
  var cfg = getConfig();
  var statusObj = (cfg.pipelineStatuses || []).find(function(s) { return s.id === statusId; });
  if (!confirm('เปลี่ยนสถานะ ' + ids.length + ' รายการ เป็น "' + (statusObj ? statusObj.name : statusId) + '"?')) return;
  ids.forEach(function(id) { ST.update('pipeline', id, { status: statusId, updatedAt: new Date().toISOString() }); });
  toast('✏️ เปลี่ยนสถานะแล้ว ' + ids.length + ' รายการ');
  render();
}

function bulkExportPipes() {
  var ids = Object.keys(pipeSelected);
  if (!ids.length) return;
  var pipes = ids.map(function(id) { return ST.getOne('pipeline', id); }).filter(Boolean);
  var wsData = _pipeXlsxFixRowNoType([PIPE_SHEET_HEADERS].concat(pipes.map(_pipeRowFields)));
  var ws = XLSX.utils.aoa_to_sheet(wsData);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline');
  XLSX.writeFile(wb, 'pipeline-selected-' + _td() + '.xlsx');
  toast('📥 Export ' + pipes.length + ' รายการที่เลือก');
}

// ================================================================
// DATA MIGRATION — รันครั้งเดียวเพื่อแปลง status ID เก่า → ใหม่
// เรียกได้จาก console: migratePipelineStatuses()
// ================================================================
function migratePipelineStatuses() {
  var map = {
    prospect:    'initial',
    tor_review:  'draft_tor',
    quotation:   'on_process',
    negotiation: 'on_process',
    ordered:     'contracting',
    delivered:   'deliver',
    lost:        'fail_lost',
    on_hold:     'initial',
    recurring:   'deliver'
  };
  var all = ST.getAll('pipeline');
  var count = 0;
  all.forEach(function(p) {
    if (map[p.status]) {
      ST.update('pipeline', p.id, {status: map[p.status]});
      if (typeof syncToFirebase === 'function') syncToFirebase('pipeline', ST.getAll('pipeline'));
      count++;
    }
  });
  if (count === 0) {
    toast('✅ ไม่มี status ที่ต้องแปลง');
  } else {
    toast('✅ แปลงแล้ว ' + count + ' โครงการ กด Refresh เพื่อดูผล');
    render();
  }
}