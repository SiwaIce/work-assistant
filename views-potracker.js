// ================================================================
// views-potracker.js — PO Tracker: ภาพรวมการติดตาม PO → SO → DO ทั้งหมด (และแยกตาม Dealer)
// อ่านข้อมูลจาก salesOrders/creditRequests/stock ที่มีอยู่แล้วเท่านั้น ไม่มี collection ใหม่ของตัวเอง
// ================================================================

var poTrackerFlt = 'all'; // all | notdone | done
var poTrackerDealerFlt = '';
var poTrackerSearch = '';
var poTrackerStatusFlt = ''; // '' = ทุกสถานะ, ไม่งั้นตรงกับ key ใน SO_STATUS
var poTrackerReadyFlt = '';  // '' | ready | notready
var poTrackerCreditFlt = ''; // '' | yes | no
var poTrackerPrpoFlt = '';   // '' | pending
var poTrackerDateFrom = '';  // createdAt >= (YYYY-MM-DD)
var poTrackerDateTo = '';    // createdAt <= (YYYY-MM-DD)
var poTrackerSort = 'newest'; // newest | oldest | amount_desc | amount_asc | dealer | urgent
var poTrackerMoreFlt = false; // เปิด/ปิดแผงตัวกรองเพิ่มเติม
var poTrackerExpandedItems = {}; // soId -> เปิด/ปิดแผงรายการสินค้า + ปรับยอด Stock ด่วน
var poTrackerStockSnapshot = {}; // "soId|sku" -> เวลา stockLog ล่าสุดตอนเปิดแผง ใช้เช็ค conflict ก่อนบันทึกทับ

// 5 สถานะสรุปต่อรายการสินค้า (ใช้ในแผงสรุปตามบริษัท และหน้าแยก Dealer) — เรียงตามลำดับที่ควรแสดง
var POTRACKER_ITEM_BUCKETS = [
  { key: 'not_sent',     label: 'ยังไม่ส่ง',  icon: '⬜', color: '#94a3b8' },
  { key: 'pending_prpo', label: 'รอ PR/PO',   icon: '🛒', color: '#ef4444' },
  { key: 'reserved',     label: 'จอง',        icon: '📌', color: '#f59e0b' },
  { key: 'ready',        label: 'พร้อมส่ง',   icon: '📦', color: '#3b82f6' },
  { key: 'shipped',      label: 'ส่งแล้ว',    icon: '✅', color: '#22c55e' }
];

// จัดรายการสินค้า 1 ชิ้นเข้า 1 ใน 5 bucket ด้านบน — ใช้ข้อมูลเดียวกับ _poTrackerItemRemark/_soSummaryItemStatusInfo
// แต่บีบให้เหลือ key คงที่ 5 ค่า เพื่อเอาไปกรุ๊ปและนับจำนวนได้ (ต่างจากสองฟังก์ชันนั้นที่ทำข้อความอธิบายอย่างเดียว)
function _poTrackerItemBucket(it, so) {
  var qty = Number(it.qty) || 0;
  var info = (it.sku && typeof stockSOItemReadyInfo === 'function') ? stockSOItemReadyInfo(it.sku, qty, so) : null;
  if (info) {
    if (qty > 0 && info.deliveredForThisSO >= qty) return 'shipped';
    if (info.bookedForThisSO > 0) return 'reserved';
  }
  if (it.sourceType === 'pr_po') return 'pending_prpo';
  if (it.sourceType === 'reserve_1021' || it.sourceType === 'reserve_8d01') return 'reserved';
  if (it.sourceType === 'central_wh') return 'ready';
  if (info && info.shortfall === 0) return 'ready';
  return 'not_sent';
}

// รายการสินค้าที่ต้อง PR/PO เพิ่ม หรือจองจากคลังยังไม่ครบ ใช้สรุป remark ต่อรายการ (คล้าย mockup เดิม)
function _poTrackerItemRemark(it, so) {
  var qty = Number(it.qty) || 0;
  if (it.sourceType === 'pr_po') {
    var bits = ['🛒 PR/PO ' + qty + ' ชิ้น'];
    var stLabel = (typeof _soPrpoStatusLabel === 'function') ? _soPrpoStatusLabel(it) : (it.prpoStatus || '');
    if (stLabel) bits.push(stLabel);
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

// แผงสรุปรายการสินค้าของ Dealer ที่กำลังกรองอยู่ แยกตามสถานะ (5 bucket) — ใช้ตอนเลือก Dealer เดียวในหน้า PO Tracker
// เพื่อดูว่าของเหลืออะไรบ้าง ยังไม่ส่ง/รอ PR/PO/จอง/พร้อมส่ง/ส่งแล้ว พร้อมลิงก์ไป SO/Pipeline/Quotation ต้นทาง
function _poTrackerCompanySummaryHtml(dealerName, dealerRows) {
  var groups = {};
  POTRACKER_ITEM_BUCKETS.forEach(function(b) { groups[b.key] = []; });
  dealerRows.forEach(function(r) {
    (r.so.items || []).forEach(function(it) {
      var bucket = _poTrackerItemBucket(it, r.so);
      groups[bucket].push({ it: it, so: r.so });
    });
  });

  var html = '<div class="card" style="margin-bottom:10px;padding:14px">';
  html += '<div style="font-weight:600;margin-bottom:8px">📊 สรุปรายการสินค้า — ' + sanitize(dealerName) + '</div>';

  var any = false;
  POTRACKER_ITEM_BUCKETS.forEach(function(b) {
    var items = groups[b.key];
    if (!items.length) return;
    any = true;
    html += '<div style="margin-bottom:10px">';
    html += '<div style="font-size:12px;font-weight:600;color:' + b.color + ';margin-bottom:4px">' + b.icon + ' ' + b.label + ' (' + items.length + ')</div>';
    items.forEach(function(x) {
      var it = x.it, so = x.so;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;background:var(--bg2);margin-bottom:3px;font-size:12px">';
      html += '<div>' + sanitize(it.model || it.sku || '-') + ' <span style="color:var(--text2)">x' + (Number(it.qty) || 0) + '</span></div>';
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
      html += '<a href="#" onclick="go(\'soDetail\',{soId:\'' + so.id + '\'});return false" style="font-size:11px;color:var(--accent)">📋 ' + sanitize(so.soNumber || so.customerPO || '-') + '</a>';
      if (so.pipelineId) html += '<a href="#" onclick="go(\'pipeDetail\',{pipeId:\'' + so.pipelineId + '\'});return false" style="font-size:11px;color:var(--accent)">📋 Pipeline</a>';
      if (so.quotationId) html += '<a href="#" onclick="editQuotation(\'' + so.quotationId + '\');return false" style="font-size:11px;color:var(--accent)">💰 Quotation</a>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  });
  if (!any) html += '<div style="font-size:12px;color:var(--text2)">ไม่มีรายการสินค้า</div>';
  html += '</div>';
  return html;
}

function poTrackerResetFilters() {
  poTrackerStatusFlt = ''; poTrackerReadyFlt = ''; poTrackerCreditFlt = ''; poTrackerPrpoFlt = '';
  poTrackerDateFrom = ''; poTrackerDateTo = ''; poTrackerDealerFlt = '';
  render();
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

  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
  html += '<input class="inp" style="flex:1;min-width:160px" placeholder="ค้นหา PO / SO / Dealer" value="' + sanitize(poTrackerSearch) + '" oninput="poTrackerSearch=this.value;render()">';
  html += '<select class="inp" style="max-width:200px" onchange="poTrackerDealerFlt=this.value;render()">';
  html += '<option value="">-- ทุก Dealer --</option>';
  dealers.forEach(function(d) { html += '<option value="' + sanitize(d) + '"' + (poTrackerDealerFlt === d ? ' selected' : '') + '>' + sanitize(d) + '</option>'; });
  html += '</select>';
  html += '<select class="inp" style="max-width:190px" onchange="poTrackerSort=this.value;render()">';
  [['newest','🕒 ใหม่ล่าสุด'],['oldest','🕒 เก่าสุด'],['amount_desc','💰 ยอดมาก → น้อย'],['amount_asc','💰 ยอดน้อย → มาก'],['dealer','🏪 Dealer A-Z']].forEach(function(o) {
    html += '<option value="' + o[0] + '"' + (poTrackerSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  });
  html += '</select>';
  html += '<button class="btn bo" onclick="poTrackerMoreFlt=!poTrackerMoreFlt;render()">' + (poTrackerMoreFlt ? '▲ ซ่อนตัวกรอง' : '▼ ตัวกรองเพิ่มเติม') + '</button>';
  html += '<button class="btn bo" onclick="go(\'poTrackerDealer\'' + (poTrackerDealerFlt ? ',{dealerName:\'' + sanitize(poTrackerDealerFlt).replace(/'/g, "\\'") + '\'}' : '') + ')">🏪 ดูแยกตาม Dealer</button>';
  html += '<button class="btn bo" onclick="poTrackerExportXlsx()">📤 Export Excel</button>';
  html += '</div>';

  if (poTrackerMoreFlt) {
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;padding:10px;background:var(--bg2);border-radius:8px">';
    html += '<select class="inp" style="max-width:180px" onchange="poTrackerStatusFlt=this.value;render()">';
    html += '<option value="">-- ทุกสถานะ --</option>';
    Object.keys(SO_STATUS).forEach(function(k) { html += '<option value="' + k + '"' + (poTrackerStatusFlt === k ? ' selected' : '') + '>' + SO_STATUS[k].icon + ' ' + SO_STATUS[k].label + '</option>'; });
    html += '</select>';
    html += '<select class="inp" style="max-width:160px" onchange="poTrackerReadyFlt=this.value;render()">';
    html += '<option value="">-- พร้อมส่ง: ทั้งหมด --</option>';
    html += '<option value="ready"' + (poTrackerReadyFlt === 'ready' ? ' selected' : '') + '>📦 พร้อมส่งครบ</option>';
    html += '<option value="notready"' + (poTrackerReadyFlt === 'notready' ? ' selected' : '') + '>📦 ยังขาด</option>';
    html += '</select>';
    html += '<select class="inp" style="max-width:160px" onchange="poTrackerCreditFlt=this.value;render()">';
    html += '<option value="">-- เครดิต: ทั้งหมด --</option>';
    html += '<option value="yes"' + (poTrackerCreditFlt === 'yes' ? ' selected' : '') + '>💳 ขอเครดิตแล้ว</option>';
    html += '<option value="no"' + (poTrackerCreditFlt === 'no' ? ' selected' : '') + '>💳 ยังไม่ขอ</option>';
    html += '</select>';
    html += '<select class="inp" style="max-width:170px" onchange="poTrackerPrpoFlt=this.value;render()">';
    html += '<option value="">-- PR/PO: ทั้งหมด --</option>';
    html += '<option value="pending"' + (poTrackerPrpoFlt === 'pending' ? ' selected' : '') + '>🛒 รอ PR/PO</option>';
    html += '</select>';
    html += '<div style="display:flex;gap:4px;align-items:center">';
    html += '<label class="lbl" style="margin:0;font-size:11px;color:var(--text2)">สร้างเมื่อ</label>';
    html += '<input type="date" class="inp" style="width:140px" value="' + sanitize(poTrackerDateFrom) + '" onchange="poTrackerDateFrom=this.value;render()">';
    html += '<span style="color:var(--text2)">–</span>';
    html += '<input type="date" class="inp" style="width:140px" value="' + sanitize(poTrackerDateTo) + '" onchange="poTrackerDateTo=this.value;render()">';
    html += '</div>';
    html += '<button class="btn bsm bo" onclick="poTrackerResetFilters()">↺ ล้างตัวกรอง</button>';
    html += '</div>';
  }
  html += '</div>';

  if (poTrackerDealerFlt) {
    var dealerRows = rows.filter(function(r) { return r.so.dealerName === poTrackerDealerFlt; });
    html += _poTrackerCompanySummaryHtml(poTrackerDealerFlt, dealerRows);
  }

  var q = poTrackerSearch.trim().toLowerCase();
  var filtered = rows.filter(function(r) {
    if (poTrackerFlt === 'done' && !r.done) return false;
    if (poTrackerFlt === 'notdone' && r.done) return false;
    if (poTrackerDealerFlt && r.so.dealerName !== poTrackerDealerFlt) return false;
    if (poTrackerStatusFlt && r.so.status !== poTrackerStatusFlt) return false;
    if (poTrackerReadyFlt === 'ready' && !(r.readiness.total && r.readiness.allReady)) return false;
    if (poTrackerReadyFlt === 'notready' && !(r.readiness.total && !r.readiness.allReady)) return false;
    if (poTrackerCreditFlt === 'yes' && !r.credit) return false;
    if (poTrackerCreditFlt === 'no' && r.credit) return false;
    if (poTrackerPrpoFlt === 'pending' && !r.pendingPRPO) return false;
    if (poTrackerDateFrom && (!r.so.createdAt || r.so.createdAt.slice(0, 10) < poTrackerDateFrom)) return false;
    if (poTrackerDateTo && (!r.so.createdAt || r.so.createdAt.slice(0, 10) > poTrackerDateTo)) return false;
    if (q) {
      var hay = ((r.so.soNumber || '') + ' ' + (r.so.customerPO || '') + ' ' + (r.so.dealerName || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  filtered.sort(function(a, b) {
    if (poTrackerSort === 'oldest') return (a.so.createdAt || '').localeCompare(b.so.createdAt || '');
    if (poTrackerSort === 'amount_desc') return b.total - a.total;
    if (poTrackerSort === 'amount_asc') return a.total - b.total;
    if (poTrackerSort === 'dealer') return (a.so.dealerName || '').localeCompare(b.so.dealerName || '');
    return (b.so.createdAt || '').localeCompare(a.so.createdAt || ''); // newest (ค่าเริ่มต้น)
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

    html += '<div onclick="event.stopPropagation()" style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px">';
    html += _poTrackerAttachSectionHtml(s, 'customerPO', 'PO ลูกค้า', '📄');
    html += _poTrackerAttachSectionHtml(s, 'invoice', 'Invoice', '🧾');
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

// ไฟล์แนบต่อ PO/SO แยกประเภท (PO ลูกค้า / Invoice) — ใช้ attachments[] เดิมของ SO ร่วมกับหน้า SO Detail
// (ดู attachGalleryHtml ใน utils.js) เพียงเติม category ต่อไฟล์ เพื่อกรองแสดงแยกช่องในหน้านี้
function _poTrackerAttachSectionHtml(s, category, label, icon) {
  var atts = s.attachments || [];
  var html = '<div style="min-width:120px">';
  html += '<div style="font-size:11px;color:var(--text2);margin-bottom:4px">' + icon + ' ' + label + '</div>';
  var has = false;
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">';
  atts.forEach(function(a, idx) {
    if (a.category !== category) return;
    has = true;
    html += '<div style="position:relative;width:56px;height:56px">' +
      _attachItemHtml(a, "window.open('" + a.url + "','_blank')") +
      '<button type="button" onclick="poTrackerRemoveAttach(\'' + s.id + '\',' + idx + ')" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:9px;cursor:pointer;line-height:1">✕</button></div>';
  });
  if (!has) html += '<div style="font-size:11px;color:var(--text2)">ยังไม่มีไฟล์</div>';
  html += '</div>';
  html += '<label class="btn bsm bo" style="cursor:pointer;display:inline-block">📎 แนบไฟล์<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none" onchange="poTrackerAttachFile(\'' + s.id + '\',\'' + category + '\',this)"></label>';
  html += '<div class="hint" style="margin:2px 0 0">รูป/PDF/Word/Excel ไม่เกิน 10MB ต่อไฟล์ (เก็บบน Cloud Storage ต้อง login คลาวด์ก่อน)</div>';
  html += '</div>';
  return html;
}

function poTrackerAttachFile(soId, category, inputEl) {
  var file = inputEl.files && inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  toast('⏳ กำลังอัปโหลด...');
  uploadAttachment(file, 'salesOrders', function(att) {
    if (!att) return;
    att.category = category;
    var so = ST.getOne('salesOrders', soId);
    if (!so) return;
    var attachments = (so.attachments || []).concat([att]);
    ST.update('salesOrders', soId, { attachments: attachments });
    toast('📎 แนบไฟล์แล้ว');
    render();
  });
}

function poTrackerRemoveAttach(soId, idx) {
  var so = ST.getOne('salesOrders', soId);
  if (!so) return;
  var attachments = (so.attachments || []).slice();
  var a = attachments[idx];
  if (!a) return;
  if (!confirm('ลบไฟล์นี้?')) return;
  if (a.path) deleteAttachment(a.path);
  attachments.splice(idx, 1);
  ST.update('salesOrders', soId, { attachments: attachments });
  render();
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
  var itemHeader = ['PO ลูกค้า', 'SO Number', 'Dealer', 'No.', 'SKU', 'รายการสินค้า', 'จำนวน', 'ราคาต่อหน่วย', 'ราคารวม', 'Remark'];
  var itemRows = [];
  all.forEach(function(s) {
    (s.items || []).forEach(function(it, idx) {
      var qty = Number(it.qty) || 0;
      var price = Number(it.unitPrice) || 0;
      itemRows.push([s.customerPO || '', s.soNumber || '', s.dealerName || '', idx + 1, it.sku || '', it.model || '', qty, price, qty * price, _poTrackerItemRemark(it, s)]);
    });
  });
  var wsItems = XLSX.utils.aoa_to_sheet([itemHeader].concat(itemRows));
  wsItems['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 5 }, { wch: 14 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 34 }];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsOverview, 'ภาพรวม');
  XLSX.utils.book_append_sheet(wb, wsItems, 'รายการสินค้า');
  XLSX.writeFile(wb, 'po-tracker-export-' + _td() + '.xlsx');
  toast('📤 Export PO Tracker แล้ว (' + all.length + ' PO/SO, ' + itemRows.length + ' รายการ)');
}

// ================================================================
// หน้าแยกตาม Dealer — รวมสินค้าทุก PO ของ Dealer เดียวกันเข้าด้วยกันต่อ product (เช่น Matrice 400 รวม 5 ลำ
// จาก PO 123 3 ลำ รอ PR/PO + PO 124 2 ลำ ส่งแล้ว) ให้เห็นงานค้างทั้งหมดของ Dealer นี้ในที่เดียว
// ================================================================

var poTrackerDealerPageFlt = ''; // Dealer ที่เลือกดูอยู่ในหน้านี้ — จำค่าไว้ข้ามการ render ภายในหน้าเดียวกัน
var poTrackerDealerViewMode = 'table'; // table | card — ตารางเป็นค่าเริ่มต้น (ผู้ใช้ขอให้ดูง่ายกว่าการ์ด 2026-10-08)
var poTrackerDealerDetailFlt = 'all';  // all | outstanding — กรองตารางรายละเอียดต่อ PO/SO
var poTrackerDealerSort = 'product';   // product | date_desc | date_asc — เรียงตารางรายละเอียด

function rPOTrackerDealer(el) {
  document.getElementById('pgT').textContent = '🏪 สินค้าตาม Dealer';
  if (S.dealerName) poTrackerDealerPageFlt = S.dealerName;

  var all = ST.getAll('salesOrders');
  var dealers = Array.from(new Set(all.map(function(s) { return s.dealerName || ''; }).filter(Boolean))).sort();

  var html = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '<button class="btn bo bsm" onclick="go(\'poTracker\')" style="margin-bottom:10px">← กลับ PO Tracker</button>';

  html += '<div class="card" style="margin-bottom:12px;padding:16px">';
  html += '<div style="font-weight:600;margin-bottom:8px">เลือก Dealer</div>';
  html += '<select class="inp" style="max-width:280px" onchange="poTrackerDealerPageFlt=this.value;render()">';
  html += '<option value="">-- เลือก Dealer --</option>';
  dealers.forEach(function(d) { html += '<option value="' + sanitize(d) + '"' + (poTrackerDealerPageFlt === d ? ' selected' : '') + '>' + sanitize(d) + '</option>'; });
  html += '</select>';
  html += '</div>';

  if (!poTrackerDealerPageFlt) {
    html += '<div class="card" style="padding:20px;text-align:center;color:var(--text2)">เลือก Dealer ด้านบนเพื่อดูสินค้าค้าง/ส่งแล้วทั้งหมด</div>';
    el.innerHTML = html;
    return;
  }

  var dealerSOs = all.filter(function(s) { return s.dealerName === poTrackerDealerPageFlt; });

  // รวมสินค้าต่อ product (key = sku ถ้ามี ไม่งั้นใช้ชื่อ model) ข้าม PO/SO ทั้งหมดของ Dealer นี้
  // เก็บยอดแยกตาม bucket ไว้ด้วย (ไม่ใช่แค่ ส่งแล้ว/ไม่ส่งแล้ว) เพื่อโชว์คอลัมน์ รอ PR/PO กับ จองรอส่ง แยกกันในตาราง
  var productMap = {};
  dealerSOs.forEach(function(s) {
    (s.items || []).forEach(function(it) {
      var key = it.sku || it.model || '-';
      if (!productMap[key]) {
        productMap[key] = { model: it.model || it.sku || '-', sku: it.sku || '', totalQty: 0, deliveredQty: 0, pos: [], byBucket: {} };
        POTRACKER_ITEM_BUCKETS.forEach(function(b) { productMap[key].byBucket[b.key] = 0; });
      }
      var qty = Number(it.qty) || 0;
      var bucket = _poTrackerItemBucket(it, s);
      productMap[key].totalQty += qty;
      productMap[key].byBucket[bucket] += qty;
      if (bucket === 'shipped') productMap[key].deliveredQty += qty;
      productMap[key].pos.push({ so: s, qty: qty, bucket: bucket, model: it.model || it.sku || '-', sku: it.sku || '' });
    });
  });

  var products = Object.keys(productMap).map(function(k) { return productMap[k]; })
    .sort(function(a, b) { return b.totalQty - a.totalQty; });

  var grandTotal = products.reduce(function(sum, p) { return sum + p.totalQty; }, 0);
  var grandDelivered = products.reduce(function(sum, p) { return sum + p.deliveredQty; }, 0);

  html += '<div class="card" style="margin-bottom:12px;padding:16px">';
  html += '<div style="display:flex;gap:16px;flex-wrap:wrap">';
  html += '<div><div style="font-size:22px;font-weight:600">' + grandTotal + '</div><div style="font-size:11px;color:var(--text2)">รวมทุกรายการ (ชิ้น)</div></div>';
  html += '<div><div style="font-size:22px;font-weight:600;color:#22c55e">' + grandDelivered + '</div><div style="font-size:11px;color:var(--text2)">ส่งแล้ว</div></div>';
  html += '<div><div style="font-size:22px;font-weight:600;color:#f59e0b">' + (grandTotal - grandDelivered) + '</div><div style="font-size:11px;color:var(--text2)">ค้างอยู่</div></div>';
  html += '</div></div>';

  if (!products.length) {
    html += '<div class="card" style="padding:20px;text-align:center;color:var(--text2)">Dealer นี้ยังไม่มีรายการสินค้า</div>';
    el.innerHTML = html;
    return;
  }

  html += '<div style="display:flex;gap:8px;margin-bottom:10px">';
  html += '<button class="btn bsm ' + (poTrackerDealerViewMode === 'table' ? 'bp' : 'bo') + '" onclick="poTrackerDealerViewMode=\'table\';render()">📋 ตาราง</button>';
  html += '<button class="btn bsm ' + (poTrackerDealerViewMode === 'card' ? 'bp' : 'bo') + '" onclick="poTrackerDealerViewMode=\'card\';render()">🗂️ การ์ด</button>';
  html += '</div>';

  html += (poTrackerDealerViewMode === 'table') ? _poTrackerDealerTableHtml(products) : _poTrackerDealerCardHtml(products);

  el.innerHTML = html;
}

// มุมมองตาราง — ตารางสรุปต่อสินค้า (รวม/ส่งแล้ว/รอ PR/PO/จองรอส่ง/อื่นๆ) + ตารางรายละเอียดต่อ PO/SO แยกบรรทัด พร้อมวันที่
function _poTrackerDealerTableHtml(products) {
  var html = '';

  // ---- ตารางสรุปต่อสินค้า
  html += '<div class="card" style="margin-bottom:12px;padding:0;overflow-x:auto">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap">';
  html += '<thead><tr style="border-bottom:1px solid var(--border);text-align:left">';
  ['สินค้า', 'รวม', 'ส่งแล้ว', '🛒 รอ PR/PO', '📌 จองรอส่ง', 'อื่นๆ'].forEach(function(h, i) {
    html += '<th style="padding:8px 10px;color:var(--text2);font-weight:600' + (i > 0 ? ';text-align:right' : '') + '">' + h + '</th>';
  });
  html += '</tr></thead><tbody>';
  products.forEach(function(p) {
    var other = (p.byBucket.not_sent || 0) + (p.byBucket.ready || 0);
    html += '<tr style="border-bottom:1px solid var(--border)">';
    html += '<td style="padding:7px 10px;white-space:normal">' + sanitize(p.model) + (p.sku ? ' <span style="font-size:10px;color:var(--text2)">(' + sanitize(p.sku) + ')</span>' : '') + '</td>';
    html += '<td style="padding:7px 10px;text-align:right">' + p.totalQty + '</td>';
    html += '<td style="padding:7px 10px;text-align:right;color:#22c55e">' + (p.deliveredQty || '-') + '</td>';
    html += '<td style="padding:7px 10px;text-align:right;color:#ef4444">' + (p.byBucket.pending_prpo || '-') + '</td>';
    html += '<td style="padding:7px 10px;text-align:right;color:#f59e0b">' + (p.byBucket.reserved || '-') + '</td>';
    html += '<td style="padding:7px 10px;text-align:right;color:var(--text2)">' + (other || '-') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  // ---- ตารางรายละเอียดต่อ PO/SO — แถวละ 1 รายการสินค้าของ 1 PO/SO พร้อมวันที่และสถานะ
  var lines = [];
  products.forEach(function(p) {
    p.pos.forEach(function(x) { lines.push({ model: x.model, sku: x.sku, so: x.so, qty: x.qty, bucket: x.bucket }); });
  });

  if (poTrackerDealerDetailFlt === 'outstanding') lines = lines.filter(function(l) { return l.bucket !== 'shipped'; });

  lines.sort(function(a, b) {
    if (poTrackerDealerSort === 'date_desc') return (b.so.createdAt || '').localeCompare(a.so.createdAt || '');
    if (poTrackerDealerSort === 'date_asc') return (a.so.createdAt || '').localeCompare(b.so.createdAt || '');
    return a.model.localeCompare(b.model, 'th');
  });

  html += '<div class="card" style="padding:14px">';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  html += '<button class="btn bsm ' + (poTrackerDealerDetailFlt === 'all' ? 'bp' : 'bo') + '" onclick="poTrackerDealerDetailFlt=\'all\';render()">ทั้งหมด</button>';
  html += '<button class="btn bsm ' + (poTrackerDealerDetailFlt === 'outstanding' ? 'bp' : 'bo') + '" onclick="poTrackerDealerDetailFlt=\'outstanding\';render()">ค้างส่งเท่านั้น</button>';
  html += '<select class="inp" style="max-width:160px;margin-left:auto" onchange="poTrackerDealerSort=this.value;render()">';
  [['product', 'เรียงตามสินค้า'], ['date_desc', 'วันที่ใหม่สุด'], ['date_asc', 'วันที่เก่าสุด']].forEach(function(o) {
    html += '<option value="' + o[0] + '"' + (poTrackerDealerSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  });
  html += '</select>';
  html += '</div>';

  if (!lines.length) {
    html += '<div style="padding:10px;text-align:center;color:var(--text2);font-size:12px">ไม่มีรายการ</div></div>';
    return html;
  }

  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap">';
  html += '<thead><tr style="border-bottom:1px solid var(--border);text-align:left">';
  ['สินค้า', 'PO', 'SO', 'วันที่', 'จำนวน', 'สถานะ'].forEach(function(h) {
    html += '<th style="padding:8px 10px;color:var(--text2);font-weight:600">' + h + '</th>';
  });
  html += '</tr></thead><tbody>';
  lines.forEach(function(l) {
    var b = POTRACKER_ITEM_BUCKETS.filter(function(bb) { return bb.key === l.bucket; })[0] || POTRACKER_ITEM_BUCKETS[0];
    html += '<tr style="border-bottom:1px solid var(--border)">';
    html += '<td style="padding:7px 10px;white-space:normal">' + sanitize(l.model) + '</td>';
    html += '<td style="padding:7px 10px">' + sanitize(l.so.customerPO || '-') + '</td>';
    html += '<td style="padding:7px 10px"><a href="#" onclick="go(\'soDetail\',{soId:\'' + l.so.id + '\'});return false" style="color:var(--accent)">' + sanitize(l.so.soNumber || '-') + '</a></td>';
    html += '<td style="padding:7px 10px">' + (l.so.createdAt ? fD(l.so.createdAt) : '-') + '</td>';
    html += '<td style="padding:7px 10px">x' + l.qty + '</td>';
    html += '<td style="padding:7px 10px;color:' + b.color + '">' + b.icon + ' ' + b.label + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';
  return html;
}

// มุมมองการ์ด (ของเดิม) — การ์ดต่อสินค้า พร้อมรายการ PO/SO ย่อยด้านใน
function _poTrackerDealerCardHtml(products) {
  var html = '';
  products.forEach(function(p) {
    var outstanding = p.totalQty - p.deliveredQty;
    html += '<div class="card" style="margin-bottom:10px;padding:14px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
    html += '<div><div style="font-weight:600;font-size:14px">' + sanitize(p.model) + (p.sku ? ' <span style="font-size:11px;color:var(--text2)">(' + sanitize(p.sku) + ')</span>' : '') + '</div></div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    html += '<span style="padding:2px 8px;border-radius:8px;background:var(--bg2);color:var(--text2);font-size:11px">รวม ' + p.totalQty + ' ชิ้น</span>';
    html += '<span style="padding:2px 8px;border-radius:8px;background:rgba(34,197,94,.12);color:#22c55e;font-size:11px">✅ ส่งแล้ว ' + p.deliveredQty + '</span>';
    if (outstanding > 0) html += '<span style="padding:2px 8px;border-radius:8px;background:rgba(245,158,11,.12);color:#f59e0b;font-size:11px">⏳ ค้าง ' + outstanding + '</span>';
    html += '</div></div>';

    html += '<div style="border-top:1px solid var(--border);padding-top:8px">';
    p.pos.forEach(function(x) {
      var b = POTRACKER_ITEM_BUCKETS.filter(function(bb) { return bb.key === x.bucket; })[0] || POTRACKER_ITEM_BUCKETS[0];
      html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;background:var(--bg2);margin-bottom:3px;font-size:12px">';
      html += '<div><a href="#" onclick="go(\'soDetail\',{soId:\'' + x.so.id + '\'});return false" style="color:var(--accent)">📋 ' + sanitize(x.so.soNumber || x.so.customerPO || '-') + '</a>' +
        (x.so.customerPO && x.so.soNumber ? ' <span style="color:var(--text2)">· PO ' + sanitize(x.so.customerPO) + '</span>' : '') +
        (x.so.createdAt ? ' <span style="color:var(--text2)">· ' + fD(x.so.createdAt) + '</span>' : '') + '</div>';
      html += '<div style="display:flex;gap:8px;align-items:center">';
      html += '<span>x' + x.qty + '</span>';
      html += '<span style="color:' + b.color + '">' + b.icon + ' ' + b.label + '</span>';
      html += '</div></div>';
    });
    html += '</div></div>';
  });
  return html;
}
