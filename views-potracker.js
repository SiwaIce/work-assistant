// ================================================================
// views-potracker.js — PO Tracker: ภาพรวมการติดตาม PO → SO → DO ทั้งหมด (และแยกตาม Dealer)
// อ่านข้อมูลจาก salesOrders/creditRequests/stock ที่มีอยู่แล้วเท่านั้น ไม่มี collection ใหม่ของตัวเอง
// ================================================================

var poTrackerFlt = 'all'; // all | notdone | done
var poTrackerDealerFlt = '';
var poTrackerSearch = '';
var poTrackerExpandedItems = {}; // soId -> เปิด/ปิดแผงรายการสินค้า + ปรับยอด Stock ด่วน
var poTrackerStockSnapshot = {}; // "soId|sku" -> เวลา stockLog ล่าสุดตอนเปิดแผง ใช้เช็ค conflict ก่อนบันทึกทับ

// รายการสินค้าที่ต้อง PR/PO เพิ่ม หรือจองจากคลังยังไม่ครบ ใช้สรุป remark ต่อรายการ (คล้าย mockup เดิม)
function _poTrackerItemRemark(it, so) {
  var qty = Number(it.qty) || 0;
  if (it.sourceType === 'pr_po') {
    var bits = ['🛒 PR/PO ' + qty + ' ชิ้น'];
    if (it.prpoStatus) bits.push(it.prpoStatus);
    if (it.prpoExpectedDate) bits.push('คาดว่าได้ ' + fD(it.prpoExpectedDate));
    return bits.join(' — ');
  }
  if (it.sourceType === 'reserve_1021') return '📌 จองคลัง 1021 ' + qty + ' ชิ้น';
  if (it.sourceType === 'reserve_8d01') return '🧳 จองคลัง 8D01 ' + qty + ' ชิ้น';
  if (it.sourceType === 'central_wh') return '🏢 ส่งจากคลังกลาง';
  // ยังไม่ระบุ sourceType — fallback ไปดูความพร้อมส่งจริงจากสต็อก
  if (it.sku && typeof stockSOItemReadyInfo === 'function') {
    var info = stockSOItemReadyInfo(it.sku, qty, so);
    if (info.ready) return '✅ พร้อมส่ง';
    if (info.shortfall > 0) return '⚠️ ขาดอีก ' + info.shortfall + ' ชิ้น';
  }
  return '—';
}

function _poTrackerSOTotal(s) {
  return (s.items || []).reduce(function(sum, it) { return sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);
}

function _poTrackerBuildRow(s) {
  var readiness = soComputeReadiness(s);
  var credit = creditRequestOpenForSO(s.id);
  var total = _poTrackerSOTotal(s);
  var pendingPRPO = (s.items || []).filter(function(it) { return it.sourceType === 'pr_po'; }).length;
  return {
    so: s,
    total: total,
    readiness: readiness,
    credit: credit,
    pendingPRPO: pendingPRPO,
    done: _soIsDone(s.status)
  };
}

function rPOTracker(el) {
  document.getElementById('pgT').textContent = '🗺️ PO Tracker';
  var all = ST.getAll('salesOrders').slice().sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  var rows = all.map(_poTrackerBuildRow);

  var dealers = Array.from(new Set(rows.map(function(r) { return r.so.dealerName || ''; }).filter(Boolean))).sort();

  var doneCount = rows.filter(function(r) { return r.done; }).length;
  var notDoneCount = rows.length - doneCount;

  var html = '<div class="card" style="margin-bottom:12px;padding:16px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  html += '<button class="btn bp" onclick="showCreateSOModal({})">➕ สร้าง PO/SO ใหม่</button>';
  html += '</div>';
  html += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px">';
  html += '<div><div style="font-size:22px;font-weight:600">' + rows.length + '</div><div style="font-size:11px;color:var(--text2)">ทั้งหมด</div></div>';
  html += '<div><div style="font-size:22px;font-weight:600;color:#22c55e">' + doneCount + '</div><div style="font-size:11px;color:var(--text2)">เสร็จแล้ว</div></div>';
  html += '<div><div style="font-size:22px;font-weight:600;color:#f59e0b">' + notDoneCount + '</div><div style="font-size:11px;color:var(--text2)">ยังไม่เสร็จ</div></div>';
  html += '</div>';

  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  ['all', 'notdone', 'done'].forEach(function(f) {
    var label = f === 'all' ? 'ทั้งหมด' : (f === 'notdone' ? 'ยังไม่เสร็จ' : 'เสร็จแล้ว');
    html += '<button class="btn bsm ' + (poTrackerFlt === f ? 'bp' : 'bo') + '" onclick="poTrackerFlt=\'' + f + '\';render()">' + label + '</button>';
  });
  html += '</div>';

  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  html += '<input class="inp" style="flex:1;min-width:160px" placeholder="ค้นหา PO / SO / Dealer" value="' + sanitize(poTrackerSearch) + '" oninput="poTrackerSearch=this.value;render()">';
  html += '<select class="inp" style="max-width:200px" onchange="poTrackerDealerFlt=this.value;render()">';
  html += '<option value="">-- ทุก Dealer --</option>';
  dealers.forEach(function(d) { html += '<option value="' + sanitize(d) + '"' + (poTrackerDealerFlt === d ? ' selected' : '') + '>' + sanitize(d) + '</option>'; });
  html += '</select>';
  html += '<button class="btn bo" onclick="poTrackerExportXlsx()">📤 Export Excel</button>';
  html += '</div>';
  html += '</div>';

  var q = poTrackerSearch.trim().toLowerCase();
  var filtered = rows.filter(function(r) {
    if (poTrackerFlt === 'done' && !r.done) return false;
    if (poTrackerFlt === 'notdone' && r.done) return false;
    if (poTrackerDealerFlt && r.so.dealerName !== poTrackerDealerFlt) return false;
    if (q) {
      var hay = ((r.so.soNumber || '') + ' ' + (r.so.customerPO || '') + ' ' + (r.so.dealerName || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  if (!filtered.length) {
    html += '<div class="card" style="padding:20px;text-align:center;color:var(--text2)">ไม่พบรายการ</div>';
    el.innerHTML = html;
    return;
  }

  filtered.forEach(function(r) {
    var s = r.so;
    html += '<div class="card" style="margin-bottom:10px;padding:14px;cursor:pointer" onclick="go(\'soDetail\',{soId:\'' + s.id + '\'})">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">';
    html += '<div>';
    html += '<div style="font-weight:600;font-size:14px">' + sanitize(s.soNumber || '-') + (s.customerPO ? ' <span style="font-weight:400;color:var(--text2);font-size:12px">· PO ' + sanitize(s.customerPO) + '</span>' : '') + '</div>';
    html += '<div style="font-size:12px;color:var(--text2)">🏪 ' + sanitize(s.dealerName || '-') + '</div>';
    html += '<div onclick="event.stopPropagation()" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">';
    if (s.dealerId) html += '<a href="#" onclick="go(\'dealerDetail\',{dealerId:\'' + s.dealerId + '\'});return false" style="font-size:11px;color:var(--accent)">🏪 Dealer</a>';
    if (s.pipelineId) html += '<a href="#" onclick="go(\'pipeDetail\',{pipeId:\'' + s.pipelineId + '\'});return false" style="font-size:11px;color:var(--accent)">📋 Pipeline</a>';
    if (s.quotationId) html += '<a href="#" onclick="editQuotation(\'' + s.quotationId + '\');return false" style="font-size:11px;color:var(--accent)">💰 Quotation</a>';
    html += '</div>';
    html += '</div>';
    html += '<div style="text-align:right">' + _soStatusBadge(s.status) + '</div>';
    html += '</div>';

    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:11px">';
    if (r.readiness.total) {
      html += '<span style="padding:2px 8px;border-radius:8px;background:' + (r.readiness.allReady ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)') + ';color:' + (r.readiness.allReady ? '#22c55e' : '#f59e0b') + '">📦 ' + r.readiness.readyCount + '/' + r.readiness.total + ' พร้อมส่ง</span>';
    }
    if (r.pendingPRPO) html += '<span style="padding:2px 8px;border-radius:8px;background:rgba(239,68,68,.12);color:#ef4444">🛒 รอ PR/PO ' + r.pendingPRPO + ' รายการ</span>';
    html += '<span style="padding:2px 8px;border-radius:8px;background:' + (r.credit ? 'rgba(37,99,235,.12);color:#2563eb' : 'var(--bg2);color:var(--text2)') + '">💳 ' + (r.credit ? sanitize(r.credit.status) : 'ไม่ได้ขอเครดิต') + '</span>';
    if (s.doNumber) html += '<span style="padding:2px 8px;border-radius:8px;background:rgba(139,92,246,.12);color:#8b5cf6">🚚 DO ' + sanitize(s.doNumber) + '</span>';
    if (s.pendingSoNumber) html += '<span style="padding:2px 8px;border-radius:8px;background:rgba(245,158,11,.12);color:#f59e0b">🕗 รอเลข SO</span>';
    html += '<span style="padding:2px 8px;border-radius:8px;background:var(--bg2);color:var(--text2)">฿' + nmI(r.total) + '</span>';
    html += '</div>';

    html += '<div onclick="event.stopPropagation()">';
    html += '<button class="btn bsm bo" style="margin-top:8px" onclick="copySOSummaryForSalesSupport(\'' + s.id + '\')">📋 Copy สรุปส่ง Sales Support</button>';
    html += '<button class="btn bsm bo" style="margin-top:8px" onclick="poTrackerToggleItems(\'' + s.id + '\',event)">' + (poTrackerExpandedItems[s.id] ? '▲ ซ่อนรายการสินค้า' : '▼ รายการสินค้า / ปรับยอด Stock') + '</button>';
    if (poTrackerExpandedItems[s.id]) html += _poTrackerItemsPanelHtml(s);
    html += '</div>';

    html += '</div>';
  });

  el.innerHTML = html;
}

// เปิด/ปิดแผงรายการสินค้า+ปรับยอด Stock ด่วนของ SO ใบนี้ — ตอนเปิดครั้งแรก จำเวลา stockLog ล่าสุดของแต่ละ SKU ไว้เช็ค conflict ตอนบันทึก
function poTrackerToggleItems(soId, ev) {
  if (ev) ev.stopPropagation();
  var opening = !poTrackerExpandedItems[soId];
  poTrackerExpandedItems[soId] = opening;
  if (opening) {
    var so = ST.getAll('salesOrders').find(function(s) { return s.id === soId; });
    (so && so.items || []).forEach(function(it) {
      if (it.sku) poTrackerStockSnapshot[soId + '|' + it.sku] = stockLastLogTime(it.sku);
    });
  }
  render();
}

// แผงต่อรายการสินค้าของ SO: ช่องกรอกยอดต่อคลัง (ดึงคลังจริงจาก getStockLocations() ไม่ hardcode) + ปุ่มบันทึกกลับไป Stock
function _poTrackerItemsPanelHtml(s) {
  var locs = getStockLocations();
  var html = '<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">';
  (s.items || []).forEach(function(it, idx) {
    if (!it.sku) return;
    var lots = stockGetLots(it.sku);
    var inputId = 'poqa_' + s.id + '_' + idx;
    html += '<div style="margin-bottom:10px;padding:8px;background:var(--bg2);border-radius:8px">';
    html += '<div style="font-size:12px;font-weight:600;margin-bottom:6px">' + sanitize(it.model || it.sku) + ' <span style="color:var(--text2);font-weight:400">(' + sanitize(it.sku) + ')</span></div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end">';
    locs.forEach(function(loc) {
      var cur = stockLocTotal(lots, loc.code);
      html += '<div style="min-width:90px">';
      html += '<div style="font-size:10px;color:var(--text2)">' + sanitize(loc.name) + ' (' + sanitize(loc.code) + ')</div>';
      html += '<input type="number" min="0" class="inp" id="' + inputId + '_' + sanitize(loc.code) + '" value="' + cur + '" style="width:90px">';
      html += '</div>';
    });
    html += '<button class="btn bsm bp" onclick="poTrackerSaveStockQuick(\'' + s.id + '\',' + idx + ')">💾 บันทึกกลับไป Stock</button>';
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

// อ่านค่าที่พิมพ์ในแผง เทียบกับยอดปัจจุบัน ส่งเฉพาะคลังที่เปลี่ยนไปให้ stockQuickAdjust (สร้าง lot ปรับยอดแยก ไม่แก้ lot เดิม)
function poTrackerSaveStockQuick(soId, idx) {
  var so = ST.getAll('salesOrders').find(function(s) { return s.id === soId; });
  if (!so) return;
  var it = (so.items || [])[idx];
  if (!it || !it.sku) return;
  var locs = getStockLocations();
  var inputId = 'poqa_' + soId + '_' + idx;
  var lots = stockGetLots(it.sku);
  var deltas = {};
  locs.forEach(function(loc) {
    var elInp = document.getElementById(inputId + '_' + loc.code);
    if (!elInp) return;
    var val = Math.max(0, Math.round(Number(elInp.value) || 0));
    var cur = stockLocTotal(lots, loc.code);
    if (val !== cur) deltas[loc.code] = val;
  });
  if (!Object.keys(deltas).length) { toast('ไม่มีอะไรเปลี่ยน'); return; }
  var p = getProductBySku(it.sku);
  var productName = it.model || (p && p.name) || it.sku;
  var ref = so.customerPO ? so.customerPO : (so.soNumber ? ('SO ' + so.soNumber) : soId);
  var sinceTs = poTrackerStockSnapshot[soId + '|' + it.sku];
  var ok = stockQuickAdjust(it.sku, productName, deltas, { note: 'ปรับยอดด่วนจากหน้า PO ' + ref, sinceTs: sinceTs });
  if (ok) {
    poTrackerStockSnapshot[soId + '|' + it.sku] = stockLastLogTime(it.sku);
    toast('💾 บันทึกยอด Stock แล้ว');
    render();
  }
}

// ---------------------------------------------------------------- export .xlsx จริง (ไม่ใช่ copy/TSV เหมือน mockup)

function poTrackerExportXlsx() {
  ensureXLSX().then(function() {
    _poTrackerExportXlsxImpl();
  }).catch(function(e) {
    if (typeof toast === 'function') toast('⚠️ โหลดไลบรารีไม่สำเร็จ: ' + (e && e.message || e), true);
  });
}

function _poTrackerExportXlsxImpl() {
  var all = ST.getAll('salesOrders').slice().sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  if (!all.length) { toast('ไม่มี SO ให้ export'); return; }

  // ชีต 1: ภาพรวมต่อ PO/SO
  var overviewHeader = ['PO ลูกค้า', 'SO Number', 'Dealer', 'สถานะ', 'พร้อมส่ง', 'เครดิต', 'จำนวนวันเครดิต', 'ผู้อนุมัติเครดิต', 'PR ภายใน', 'DO Number', 'Invoice Number', 'วันที่ Invoice', 'ยอดรวม (ไม่รวม VAT)', 'สร้างเมื่อ'];
  var overviewRows = all.map(function(s) {
    var readiness = soComputeReadiness(s);
    var credit = creditRequestOpenForSO(s.id);
    return [
      s.customerPO || '', s.soNumber || '', s.dealerName || '', (SO_STATUS[s.status] || {}).label || s.status || '',
      readiness.total ? (readiness.readyCount + '/' + readiness.total) : '-',
      credit ? credit.status : 'ยังไม่ได้ขอ',
      credit ? (credit.creditDaysRequested || '') : '',
      credit ? (credit.approvedBy || '') : '',
      s.prNumber || '', s.doNumber || '', s.invoiceNumber || '', s.invoiceDate ? fD(s.invoiceDate) : '',
      _poTrackerSOTotal(s),
      s.createdAt ? s.createdAt.slice(0, 10) : ''
    ];
  });
  var wsOverview = XLSX.utils.aoa_to_sheet([overviewHeader].concat(overviewRows));
  wsOverview['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];

  // ชีต 2: รายการสินค้าต่อบรรทัด — คอลัมน์ตรงกับ Excel ที่ทีมใช้จริง (No/SKU/รายการสินค้า/จำนวน/ราคาต่อหน่วย/ราคารวม/Remark)
  var itemHeader = ['PO ลูกค้า', 'SO Number', 'No.', 'SKU', 'รายการสินค้า', 'จำนวน', 'ราคาต่อหน่วย', 'ราคารวม', 'Remark'];
  var itemRows = [];
  all.forEach(function(s) {
    (s.items || []).forEach(function(it, idx) {
      var qty = Number(it.qty) || 0;
      var price = Number(it.unitPrice) || 0;
      itemRows.push([s.customerPO || '', s.soNumber || '', idx + 1, it.sku || '', it.model || '', qty, price, qty * price, _poTrackerItemRemark(it, s)]);
    });
  });
  var wsItems = XLSX.utils.aoa_to_sheet([itemHeader].concat(itemRows));
  wsItems['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 5 }, { wch: 14 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 34 }];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsOverview, 'ภาพรวม');
  XLSX.utils.book_append_sheet(wb, wsItems, 'รายการสินค้า');
  XLSX.writeFile(wb, 'po-tracker-export-' + _td() + '.xlsx');
  toast('📤 Export PO Tracker แล้ว (' + all.length + ' PO/SO, ' + itemRows.length + ' รายการ)');
}
