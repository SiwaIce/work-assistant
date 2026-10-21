// ================================================================
// views-potracker.js — PO Tracker: ภาพรวมการติดตาม PO → SO → DO ทั้งหมด (และแยกตาม Dealer)
// อ่านข้อมูลจาก salesOrders/creditRequests/stock ที่มีอยู่แล้วเท่านั้น ไม่มี collection ใหม่ของตัวเอง
// ================================================================

var poTrackerFlt = 'all'; // all | notdone | done
var poTrackerDealerFlt = '';
var poTrackerTypeFlt = ''; // '' | project | runrate — แยก SO โครงการ กับ Run rate
var poTrackerMainTab = 'summary'; // summary | cards — แยก tab สรุปรายการสินค้า กับ การ์ด PO/SO (แสดงเฉพาะตอนเลือก Dealer แล้ว) | reserve1021 — แท็บติดตามการจองคลัง 1021 (แสดงได้ทุกเมื่อ ไม่ต้องเลือก Dealer)
var poTrackerSearch = '';
var poTrackerStatusFlt = ''; // '' = ทุกสถานะ, ไม่งั้นตรงกับ key ใน SO_STATUS
var poTrackerReadyFlt = '';  // '' | ready | notready
var poTrackerCreditFlt = ''; // '' | yes | no
var poTrackerPrpoFlt = '';   // '' | pending
var poTrackerRestockFlt = ''; // '' | pending
var poTrackerDateFrom = '';  // createdAt >= (YYYY-MM-DD)
var poTrackerDateTo = '';    // createdAt <= (YYYY-MM-DD)
var poTrackerSort = 'newest'; // newest | oldest | amount_desc | amount_asc | dealer | urgent
var poTrackerMoreFlt = false; // เปิด/ปิดแผงตัวกรองเพิ่มเติม
var poTrackerExpandedItems = {}; // soId -> เปิด/ปิดแผงรายการสินค้า (สรุปสไตล์ Pipeline + ปรับยอด Stock ด่วน)
var poTrackerExpandedStockEdit = {}; // soId -> เปิด/ปิดแผงปรับยอด Stock ด่วน (ซ้อนอยู่ในแผงรายการสินค้า ซ่อนไว้โดยปริยายกันรก)
var poTrackerStockSnapshot = {}; // "soId|sku" -> เวลา stockLog ล่าสุดตอนเปิดแผง ใช้เช็ค conflict ก่อนบันทึกทับ
var poTrackerSummarySelectedBuckets = []; // แท็ปสถานะที่เลือกไว้ในแผงสรุปรายการสินค้า — [] = เลือกทุกสถานะ (แท็ป "ทั้งหมด") เลือกได้พร้อมกันหลายแท็ป
var POTRACKER_SUMMARY_VIEWMODE_LS_KEY = 'v7_poTracker_summaryViewMode';
var poTrackerSummaryViewMode = 'product'; // product | so — จัดกลุ่มแผงสรุปรายการสินค้า จำค่าไว้ (localStorage) ต่อเครื่อง ค่าเริ่มต้น "สินค้า" กันพฤติกรรมเดิมเปลี่ยน
try { poTrackerSummaryViewMode = localStorage.getItem(POTRACKER_SUMMARY_VIEWMODE_LS_KEY) || 'product'; } catch (e) {}
var POTRACKER_SUMMARY_COLLAPSED_LS_KEY = 'v7_poTracker_summaryCollapsedSO';
var poTrackerSummaryCollapsedSO = {}; // soId -> พับ/กางอยู่ (เฉพาะโหมดดูตาม SO) ไม่มี key = กางอยู่ (ค่าเริ่มต้น) — จำข้าม session ด้วย localStorage
try { poTrackerSummaryCollapsedSO = JSON.parse(localStorage.getItem(POTRACKER_SUMMARY_COLLAPSED_LS_KEY) || '{}') || {}; } catch (e) { poTrackerSummaryCollapsedSO = {}; }
var poTrackerSummaryMinWaitDays = ''; // '' = ไม่กรอง, ไม่งั้นแสดงเฉพาะ SO ที่รอ >= ค่านี้ (วัน) ในแผงสรุปรายการสินค้า
var poTrackerSelectMode = false; // โหมดเลือกหลายใบ — ใช้สำหรับปุ่ม "📦 สรุปของพร้อมส่งให้ลูกค้า" (เหมือนหน้า Sales Orders)
var poTrackerSelected = {};
var _poTrackerVisibleIds = [];

// 5 สถานะสรุปต่อรายการสินค้า (ใช้ในแผงสรุปตามบริษัท และหน้าแยก Dealer) — เรียงตามลำดับที่ควรแสดง
var POTRACKER_ITEM_BUCKETS = [
  { key: 'not_sent',        label: 'ยังไม่ส่ง',   icon: '⬜', color: '#94a3b8' },
  { key: 'pending_prpo',    label: 'รอ PR/PO',    icon: '🛒', color: '#ef4444' },
  { key: 'pending_restock', label: 'รอของเข้า',   icon: '⏳', color: '#d97706' },
  { key: 'reserved',        label: 'จอง',         icon: '📌', color: '#f59e0b' },
  { key: 'ready',           label: 'พร้อมส่ง',    icon: '📦', color: '#3b82f6' },
  { key: 'shipped',         label: 'ส่งแล้ว',     icon: '✅', color: '#22c55e' }
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
  if (it.sourceType === 'restock') return 'pending_restock';
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
  if (it.sourceType === 'restock') {
    var rbits = ['⏳ รอของเข้า (Run rate) ' + qty + ' ชิ้น'];
    if (it.restockExpectedDate) rbits.push('คาดว่าเข้า stock ' + fD(it.restockExpectedDate));
    return rbits.join(' — ');
  }
  if (it.sourceType === 'reserve_1021') return '📌 จองคลัง 1021 ' + qty + ' ชิ้น';
  if (it.sourceType === 'reserve_8d01') return '🧳 จองคลัง 8D01 ' + qty + ' ชิ้น';
  if (it.sourceType === 'central_wh') return '🏢 ส่งจากคลังกลาง';
  // ยังไม่ระบุ sourceType — fallback ไปดูความพร้อมส่งจริงจากสต็อก
  if (it.sku && typeof stockSOItemReadyInfo === 'function') {
    var info = stockSOItemReadyInfo(it.sku, qty, so);
    if (qty > 0 && info.deliveredForThisSO >= qty) return '✅ ส่งแล้ว';
    if (info.ready) return '✅ พร้อมส่ง';
    if (info.shortfall > 0) return '⚠️ ขาดอีก ' + info.shortfall + ' ชิ้น';
  }
  return '—';
}

// ลำดับความสำคัญของ bucket เวลาต้องเรียงให้รายการที่พร้อมส่ง/ส่งแล้วขึ้นก่อน (ใช้ตอน export Excel ชีต Dealer)
var POTRACKER_BUCKET_SORT_PRIORITY = { shipped: 0, ready: 1, reserved: 2, pending_restock: 3, pending_prpo: 4, not_sent: 5 };

// ข้อมูลความพร้อมส่งของ 1 รายการ สำหรับ export Excel — ใช้ bucket เดียวกับหน้าจอ (_poTrackerItemBucket) และดึงจำนวน/วันที่จาก stockSOItemReadyInfo
function _poTrackerItemReadinessForExport(it, so) {
  var qty = Number(it.qty) || 0;
  var bucket = _poTrackerItemBucket(it, so);
  var b = _poTrackerBucketInfo(bucket);
  var info = (it.sku && typeof stockSOItemReadyInfo === 'function') ? stockSOItemReadyInfo(it.sku, qty, so) : null;
  var delivered = info ? info.deliveredForThisSO : 0;
  var remainingQty = Math.max(0, qty - delivered);
  var readyNowQty = info ? Math.min(remainingQty, info.bookedForThisSO) : 0;
  var shortageQty = info ? info.shortfall : remainingQty;
  var canAcceptFirst = (bucket === 'ready' || bucket === 'shipped');
  return {
    bucket: bucket,
    statusLabel: b.icon + ' ' + b.label,
    canAcceptFirst: canAcceptFirst ? '✅ รับก่อนได้' : '',
    readyNowQty: readyNowQty,
    shortageQty: shortageQty,
    waitUntilDate: (info && info.bookingExpiryDate) ? fD(info.bookingExpiryDate) : ''
  };
}

function _poTrackerSOTotal(s) {
  return (s.items || []).reduce(function(sum, it) { return sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);
}

function _poTrackerBuildRow(s) {
  var readiness = soComputeReadiness(s);
  var credit = creditRequestOpenForSO(s.id);
  var total = _poTrackerSOTotal(s);
  var pendingPRPO = (s.items || []).filter(function(it) { return it.sourceType === 'pr_po'; }).length;
  var pendingRestock = (s.items || []).filter(function(it) { return it.sourceType === 'restock'; }).length;
  return {
    so: s,
    total: total,
    readiness: readiness,
    credit: credit,
    pendingPRPO: pendingPRPO,
    pendingRestock: pendingRestock,
    done: _soIsDone(s.status)
  };
}

// หาหมวดหมู่สินค้าของรายการ 1 ชิ้นในแผงสรุป — ดึงจาก products.js ถ้ามี sku ตรงกับสินค้าที่ลงทะเบียนไว้
// ไม่เจอก็เดาจากชื่อรุ่นแบบเดียวกับ heuristic ที่ใช้ตอน import สินค้า (ดู products.js บรรทัด ~1047)
function _poTrackerItemCategory(it) {
  if (it.sku && typeof getProductBySku === 'function') {
    var p = getProductBySku(it.sku);
    if (p && p.category) return p.category;
  }
  var n = (it.model || '').toLowerCase();
  if (n.indexOf('matrice') !== -1 || n.indexOf('mavic') !== -1 || n.indexOf('dock') !== -1) return 'drone';
  if (n.indexOf('zenmuse') !== -1 || n.indexOf('speaker') !== -1) return 'payload';
  if (n.indexOf('battery') !== -1) return 'battery';
  if (n.indexOf('charger') !== -1 || n.indexOf('propeller') !== -1 || n.indexOf('station') !== -1 || n.indexOf('rtk') !== -1 || n.indexOf('adapter') !== -1) return 'charger';
  if (n.indexOf('flighthub') !== -1 || n.indexOf('terra') !== -1) return 'software';
  if (n.indexOf('warranty') !== -1 || n.indexOf('service') !== -1 || n.indexOf('staffing') !== -1) return 'service';
  return 'other';
}

// จำนวนวันที่ลูกค้ารอมาแล้ว นับจากวันที่ PO ลูกค้าก่อน (จุดที่ลูกค้าเริ่มรอจริง) ไม่มีก็ fallback เป็นวันสร้าง SO
function _poTrackerSoWaitDays(so) {
  var ref = so.customerPODate || so.createdAt;
  return ref ? (_poTrackerDaysSince(ref) || 0) : 0;
}
function _poTrackerSoWaitColor(days) {
  return days >= 14 ? '#ef4444' : (days >= 7 ? '#f59e0b' : '#22c55e');
}
function _poTrackerWaitBadgeHtml(so) {
  var days = _poTrackerSoWaitDays(so);
  var color = _poTrackerSoWaitColor(days);
  var icon = days >= 14 ? '🔥' : (days >= 7 ? '⏳' : '🕐');
  var title = [so.customerPODate ? 'PO ลูกค้า ' + fD(so.customerPODate) : '', so.createdAt ? 'สร้าง SO ' + fD(so.createdAt) : ''].filter(Boolean).join(' · ');
  return '<span title="' + sanitize(title) + '" style="font-size:10px;font-weight:700;color:' + color + ';background:' + color + '1f;border-radius:6px;padding:2px 7px;white-space:nowrap">' + icon + ' รอ ' + days + ' วัน</span>';
}
function _poTrackerDateLineHtml(so) {
  var bits = [];
  if (so.customerPODate) bits.push('PO ลูกค้า ' + fD(so.customerPODate));
  if (so.createdAt) bits.push('สร้าง SO ' + fD(so.createdAt));
  return bits.length ? '<div style="font-size:10px;color:var(--text3,var(--text2));margin-top:1px">' + bits.join(' · ') + '</div>' : '';
}
function _poTrackerSoLinksHtml(so) {
  var html = '<a href="#" onclick="go(\'soDetail\',{soId:\'' + so.id + '\'});return false" style="font-size:11px;color:var(--accent)">📋 ' + sanitize(so.soNumber || so.customerPO || '-') + '</a>';
  if (so.pipelineId) html += ' <a href="#" onclick="go(\'pipeDetail\',{pipeId:\'' + so.pipelineId + '\'});return false" style="font-size:11px;color:var(--accent)">📋 Pipeline</a>';
  if (so.quotationId) html += ' <a href="#" onclick="editQuotation(\'' + so.quotationId + '\');return false" style="font-size:11px;color:var(--accent)">💰 Quotation</a>';
  return html;
}
// ป้าย Project/Run rate บนการ์ด PO/SO — ดูง่ายว่า SO ใบนี้เป็นโครงการหรือถัง Run rate พร้อมเลข Project ID (ถ้ามี)
function _poTrackerTypeBadgeHtml(s) {
  var type = s.type || (s.runrateId ? 'runrate' : 'project');
  var pid = (typeof _soDisplayProjectId === 'function' ? _soDisplayProjectId(s) : (s.projectId || s.runrateProjectId || ''));
  var isProject = type === 'project';
  var label = (isProject ? '📋 Project' : '🏪 Run rate') + (pid ? ' · ' + sanitize(pid) : '');
  var color = isProject ? '#2563eb' : '#f59e0b';
  return '<span style="display:inline-block;margin-top:3px;font-size:10px;font-weight:700;color:' + color + ';background:' + color + '1f;border-radius:6px;padding:2px 7px;white-space:nowrap">' + label + '</span>';
}

function _poTrackerBucketInfo(key) {
  for (var i = 0; i < POTRACKER_ITEM_BUCKETS.length; i++) if (POTRACKER_ITEM_BUCKETS[i].key === key) return POTRACKER_ITEM_BUCKETS[i];
  return POTRACKER_ITEM_BUCKETS[0];
}

// แถวสินค้าปกติ — อยู่สถานะเดียว SO เดียว
function _poTrackerSimpleRowHtml(sg) {
  var p = sg.parts[0];
  var html = '<div data-potrk-bk="' + p.bucket + '" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 10px;border-radius:7px;background:var(--bg2);margin-bottom:5px;flex-wrap:wrap">';
  html += '<div style="min-width:0">';
  html += '<div style="font-size:12px;font-weight:600">' + sanitize(sg.name) + (sg.sku ? ' <span style="font-weight:400;color:var(--text3,var(--text2));font-size:10px">' + sanitize(sg.sku) + '</span>' : '') + '</div>';
  html += _poTrackerDateLineHtml(sg.so);
  html += '</div>';
  html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">';
  html += '<span style="font-weight:700;font-size:11px;background:var(--card,var(--bg));border:1px solid var(--border);border-radius:6px;padding:3px 8px;min-width:36px;text-align:center">×' + p.qty + '</span>';
  html += _poTrackerWaitBadgeHtml(sg.so);
  html += _poTrackerSoLinksHtml(sg.so);
  html += '</div></div>';
  return html;
}

// สินค้าที่ถูกแบ่งส่งหลายสถานะในใบเดียวกัน — แท่ง progress ตามสัดส่วนจริง + ชิปสรุปทีละสถานะ
function _poTrackerSplitRowHtml(sg, selectedBuckets) {
  var bks = sg.parts.map(function(p) { return p.bucket; }).join(' ');
  var html = '<div data-potrk-bk="' + bks + '" style="padding:8px 10px;border-radius:7px;background:var(--bg2);margin-bottom:5px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">';
  html += '<div style="min-width:0"><div style="font-size:12px;font-weight:600">' + sanitize(sg.name) + (sg.sku ? ' <span style="font-weight:400;color:var(--text3,var(--text2));font-size:10px">' + sanitize(sg.sku) + '</span>' : '') + '</div>' + _poTrackerDateLineHtml(sg.so) + '</div>';
  html += '<div style="font-size:10px;color:var(--text3,var(--text2));font-weight:600;white-space:nowrap">รวม ' + sg.total + ' ชิ้น</div>';
  html += '</div>';
  html += '<div style="display:flex;width:100%;height:6px;border-radius:999px;overflow:hidden;background:var(--card,var(--bg));margin:6px 0">';
  sg.parts.forEach(function(p) {
    var b = _poTrackerBucketInfo(p.bucket);
    var pct = (p.qty / sg.total * 100).toFixed(2);
    var op = selectedBuckets.indexOf(p.bucket) !== -1 ? '1' : '.25';
    html += '<div style="width:' + pct + '%;background:' + b.color + ';opacity:' + op + '" title="' + b.label + ' ' + p.qty + '"></div>';
  });
  html += '</div>';
  html += '<div style="display:flex;gap:7px;flex-wrap:wrap">';
  sg.parts.forEach(function(p) {
    var b = _poTrackerBucketInfo(p.bucket);
    var op = selectedBuckets.indexOf(p.bucket) !== -1 ? '1' : '.35';
    html += '<span style="font-size:10px;font-weight:600;color:' + b.color + ';opacity:' + op + '">' + b.icon + ' ' + b.label + ' ' + p.qty + '/' + sg.total + '</span>';
  });
  html += '</div>';
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">' + _poTrackerWaitBadgeHtml(sg.so) + _poTrackerSoLinksHtml(sg.so) + '</div>';
  html += '</div>';
  return html;
}

// สินค้าตัวเดียวกันแต่มาจากหลาย SO คนละใบ — ชื่อขึ้นครั้งเดียวบนหัวการ์ด แตกเป็นบรรทัดย่อยทีละ SO
// (เรียงใบที่ลูกค้ารอนานสุดขึ้นก่อน) กันสับสนกับ "แบ่งส่งในใบเดียว" ของ _poTrackerSplitRowHtml ด้านบน
function _poTrackerClusterRowHtml(c, selectedBuckets) {
  var html = '<div style="border-radius:7px;background:var(--bg2);margin-bottom:5px;overflow:hidden">';
  html += '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:6px 10px;background:var(--card,var(--bg));border-bottom:1px solid var(--border)">';
  html += '<div style="font-size:12px;font-weight:600">' + sanitize(c.name) + (c.sku ? ' <span style="font-weight:400;color:var(--text3,var(--text2));font-size:10px">' + sanitize(c.sku) + '</span>' : '') + '</div>';
  html += '<div style="display:flex;gap:6px;align-items:center;white-space:nowrap">';
  html += '<span style="font-size:10px;font-weight:700;color:var(--text3,var(--text2));border:1px solid var(--border);border-radius:5px;padding:1px 6px">' + c.soGroups.length + ' SO</span>';
  html += '<span style="font-size:10px;color:var(--text3,var(--text2));font-weight:600">รวม ' + c.total + ' ชิ้น</span>';
  html += '</div></div>';
  var ordered = c.soGroups.slice().sort(function(a, b) { return _poTrackerSoWaitDays(b.so) - _poTrackerSoWaitDays(a.so); });
  ordered.forEach(function(sg, i) {
    var bks = sg.parts.map(function(p) { return p.bucket; }).join(' ');
    html += '<div data-potrk-bk="' + bks + '" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 10px;flex-wrap:wrap;' + (i > 0 ? 'border-top:1px solid var(--border-light,var(--border))' : '') + '">';
    html += '<div style="min-width:0">' + _poTrackerSoLinksHtml(sg.so) + _poTrackerDateLineHtml(sg.so) + '</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">';
    sg.parts.forEach(function(p) {
      var b = _poTrackerBucketInfo(p.bucket);
      var op = selectedBuckets.indexOf(p.bucket) !== -1 ? '1' : '.35';
      html += '<span style="font-size:10px;font-weight:600;color:' + b.color + ';opacity:' + op + '">' + b.icon + ' ' + (sg.parts.length > 1 ? p.qty : b.label) + '</span>';
    });
    html += '<span style="font-weight:700;font-size:11px;background:var(--card,var(--bg));border:1px solid var(--border);border-radius:6px;padding:3px 8px;min-width:30px;text-align:center">×' + sg.total + '</span>';
    html += _poTrackerWaitBadgeHtml(sg.so);
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

// แผงสรุปรายการสินค้าของ Dealer ที่กำลังกรองอยู่ — แบ่งแท็ปตามสถานะ (เลือกได้พร้อมกันหลายแท็ป) แล้วจัดกลุ่มตามหมวดหมู่สินค้า
// สินค้าที่แบ่งส่งหลายสถานะในใบเดียวกันจะโชว์เป็น progress bar ส่วนสินค้าเดียวกันที่มาจากหลาย SO จะรวมหัวข้อเดียวแล้วแตกเป็น
// บรรทัดย่อยทีละ SO เรียงตามจำนวนวันที่ลูกค้ารอมากสุดก่อน จะได้รู้ว่าต้องเร่งติดตามรายการไหนก่อน
function _poTrackerCompanySummaryHtml(dealerName, dealerRows) {
  var sq = (poTrackerSearch || '').trim().toLowerCase();
  var minWait = Number(poTrackerSummaryMinWaitDays) || 0;
  var flat = [];
  dealerRows.forEach(function(r) {
    if (minWait && _poTrackerSoWaitDays(r.so) < minWait) return;
    (r.so.items || []).forEach(function(it) {
      if (sq && !_poTrackerSummaryItemMatchesSearch(it, r.so, sq)) return;
      flat.push({ it: it, so: r.so, bucket: _poTrackerItemBucket(it, r.so) });
    });
  });

  // ชั้นที่ 1: รวมตาม SO + sku/model เดียวกัน เผื่อสินค้าชิ้นเดียวกันถูกแบ่งเข้าหลายสถานะในใบเดียว
  var soMap = {}, soOrder = [];
  flat.forEach(function(x) {
    var key = x.so.id + '|' + (x.it.sku || x.it.model);
    if (!soMap[key]) {
      soMap[key] = { name: x.it.model || x.it.sku || '-', sku: x.it.sku || '', cat: _poTrackerItemCategory(x.it), so: x.so, parts: [], total: 0 };
      soOrder.push(key);
    }
    soMap[key].parts.push({ bucket: x.bucket, qty: Number(x.it.qty) || 0 });
    soMap[key].total += Number(x.it.qty) || 0;
  });
  var soGroups = soOrder.map(function(k) { return soMap[k]; });

  var allKeys = POTRACKER_ITEM_BUCKETS.map(function(b) { return b.key; });
  var selectedBuckets = (poTrackerSummarySelectedBuckets && poTrackerSummarySelectedBuckets.length) ? poTrackerSummarySelectedBuckets : allKeys;
  var allActive = selectedBuckets.length === allKeys.length;

  var html = '<div class="card" style="margin-bottom:10px;padding:14px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  html += '<div style="font-weight:600">📊 สรุปรายการสินค้า — ' + sanitize(dealerName) + '</div>';
  html += '<div style="display:flex;gap:4px;align-items:center;font-size:11px;color:var(--text2)">';
  html += 'จัดกลุ่มตาม:';
  html += ' <button class="btn bsm ' + (poTrackerSummaryViewMode === 'product' ? 'bp' : 'bo') + '" onclick="poTrackerSetSummaryViewMode(\'product\')">สินค้า</button>';
  html += ' <button class="btn bsm ' + (poTrackerSummaryViewMode === 'so' ? 'bp' : 'bo') + '" onclick="poTrackerSetSummaryViewMode(\'so\')">SO</button>';
  html += '</div></div>';

  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
  html += '<button class="btn bsm ' + (allActive ? 'bp' : 'bo') + '" onclick="poTrackerSummarySelectedBuckets=[];render()">ทั้งหมด (' + flat.length + ')</button>';
  POTRACKER_ITEM_BUCKETS.forEach(function(b) {
    var cnt = flat.filter(function(x) { return x.bucket === b.key; }).length;
    var active = selectedBuckets.indexOf(b.key) !== -1;
    html += '<button class="btn bsm ' + (active ? 'bp' : 'bo') + '" ' + (active ? 'style="background:' + b.color + ';border-color:' + b.color + '"' : '') +
      ' onclick="poTrackerToggleSummaryBucketAndScroll(\'' + b.key + '\')">' + b.icon + ' ' + b.label + ' (' + cnt + ')</button>';
  });
  html += '</div>';
  if (!allActive) html += '<div style="font-size:11px;color:var(--text2);margin-bottom:8px">กำลังดู ' + selectedBuckets.length + ' สถานะพร้อมกัน — กด "ทั้งหมด" เพื่อล้างตัวกรอง — กดชิปสถานะเดิมซ้ำเพื่อเลื่อนไปหารายการนั้น</div>';

  html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:10px">';
  html += '<label class="lbl" style="margin:0;font-size:11px;color:var(--text2)">แสดงเฉพาะ SO ที่รอเกิน</label>';
  html += '<input type="number" min="0" class="inp bsm" style="width:60px" value="' + sanitize(String(poTrackerSummaryMinWaitDays || '')) + '" placeholder="0" oninput="poTrackerSummaryMinWaitDays=this.value;render()">';
  html += '<label class="lbl" style="margin:0;font-size:11px;color:var(--text2)">วัน</label>';
  if (poTrackerSummaryMinWaitDays) html += '<button class="btn bsm bo" onclick="poTrackerSummaryMinWaitDays=\'\';render()">✕ ล้าง</button>';
  html += '</div>';

  if (!flat.length) {
    var emptyMsg = sq ? ('ไม่พบรายการสินค้าที่ตรงกับ "' + sanitize(sq) + '"') : 'ไม่มีรายการสินค้าตรงเงื่อนไข';
    html += '<div style="font-size:12px;color:var(--text2)">' + emptyMsg + '</div></div>';
    return html;
  }

  html += (poTrackerSummaryViewMode === 'so')
    ? _poTrackerSummaryBySOHtml(soGroups, selectedBuckets)
    : _poTrackerSummaryByProductHtml(soGroups, selectedBuckets);

  html += '</div>';
  return html;
}

// เทียบ 1 รายการสินค้ากับคำค้นในช่องค้นหาของ PO Tracker (ชื่อ/SKU สินค้า หรือเลข SO/PO ลูกค้าของใบที่สินค้านั้นอยู่)
function _poTrackerSummaryItemMatchesSearch(it, so, sq) {
  var hay = ((it.model || '') + ' ' + (it.sku || '') + ' ' + (so.soNumber || '') + ' ' + (so.customerPO || '')).toLowerCase();
  return hay.indexOf(sq) !== -1;
}

// โหมด "จัดกลุ่มตาม: สินค้า" (ค่าเริ่มต้นเดิม) — รวมสินค้าเดียวกันข้าม SO เป็นหัวข้อเดียว จัดหมวดหมู่สินค้า เรียงตามรอนานสุดก่อน
function _poTrackerSummaryByProductHtml(soGroups, selectedBuckets) {
  var clusterMap = {}, clusterOrder = [];
  soGroups.forEach(function(sg) {
    var key = sg.sku || sg.name;
    if (!clusterMap[key]) { clusterMap[key] = { name: sg.name, sku: sg.sku, cat: sg.cat, soGroups: [], total: 0 }; clusterOrder.push(key); }
    clusterMap[key].soGroups.push(sg);
    clusterMap[key].total += sg.total;
  });
  var clusters = clusterOrder.map(function(k) { return clusterMap[k]; });
  clusters.forEach(function(c) {
    c.maxWait = Math.max.apply(null, c.soGroups.map(function(sg) { return _poTrackerSoWaitDays(sg.so); }));
  });

  var shown = clusters.filter(function(c) {
    return c.soGroups.some(function(sg) { return sg.parts.some(function(p) { return selectedBuckets.indexOf(p.bucket) !== -1; }); });
  });

  if (!shown.length) return '<div style="font-size:12px;color:var(--text2)">ไม่มีรายการสินค้าในสถานะที่เลือก</div>';

  var byCat = {};
  shown.forEach(function(c) {
    var k = c.cat || 'other';
    if (!byCat[k]) byCat[k] = [];
    byCat[k].push(c);
  });
  Object.keys(byCat).forEach(function(k) { byCat[k].sort(function(a, b) { return b.maxWait - a.maxWait; }); });

  var html = '';
  PRODUCT_CATEGORIES.forEach(function(cat) {
    var list = byCat[cat.id];
    if (!list || !list.length) return;
    html += '<div style="margin-bottom:12px">';
    html += '<div style="font-size:12px;font-weight:700;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border-light,var(--border))">' + sanitize(cat.name) + ' <span style="color:var(--text3,var(--text2));font-weight:400">(' + list.length + ')</span></div>';
    list.forEach(function(c) {
      if (c.soGroups.length > 1) { html += _poTrackerClusterRowHtml(c, selectedBuckets); return; }
      var sg = c.soGroups[0];
      html += sg.parts.length > 1 ? _poTrackerSplitRowHtml(sg, selectedBuckets) : _poTrackerSimpleRowHtml(sg);
    });
    html += '</div>';
  });
  return html;
}

// โหมด "จัดกลุ่มตาม: SO" — หัวข้อละ 1 SO (เลข SO/PO ลูกค้า/Project ID ถ้ามี + จำนวนรายการแยกตามสถานะ + ยอดรวม) พับ/กางได้ทีละใบหรือทั้งหมด
function _poTrackerSummaryBySOHtml(soGroups, selectedBuckets) {
  var bySO = {}, soOrder = [];
  soGroups.forEach(function(sg) {
    var id = sg.so.id;
    if (!bySO[id]) { bySO[id] = { so: sg.so, items: [] }; soOrder.push(id); }
    bySO[id].items.push(sg);
  });
  soOrder.sort(function(a, b) { return _poTrackerSoWaitDays(bySO[b].so) - _poTrackerSoWaitDays(bySO[a].so); });

  var groups = soOrder.map(function(id) { return bySO[id]; }).filter(function(g) {
    return g.items.some(function(sg) { return sg.parts.some(function(p) { return selectedBuckets.indexOf(p.bucket) !== -1; }); });
  });

  if (!groups.length) return '<div style="font-size:12px;color:var(--text2)">ไม่มีรายการสินค้าในสถานะที่เลือก</div>';

  var itemCount = groups.reduce(function(sum, g) { return sum + g.items.length; }, 0);
  var ids = groups.map(function(g) { return g.so.id; });

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
  html += '<div style="font-size:11px;color:var(--text2)">📦 ' + groups.length + ' SO / ' + itemCount + ' รายการ</div>';
  html += '<div style="display:flex;gap:6px">';
  html += '<button class="btn bsm bo" onclick="poTrackerSetAllSummarySOCollapse(' + JSON.stringify(ids) + ',false)">▼ กางทั้งหมด</button>';
  html += '<button class="btn bsm bo" onclick="poTrackerSetAllSummarySOCollapse(' + JSON.stringify(ids) + ',true)">▶ พับทั้งหมด</button>';
  html += '</div></div>';

  groups.forEach(function(g) {
    html += _poTrackerSOGroupHtml(g.so, g.items, selectedBuckets);
  });
  return html;
}

// 1 หัวข้อ SO ในโหมด "จัดกลุ่มตาม: SO" — คลิกหัวข้อเพื่อพับ/กาง รายการสินค้าข้างใต้ใช้ชิปสถานะเดียวกับโหมดสินค้า
function _poTrackerSOGroupHtml(so, items, selectedBuckets) {
  var collapsed = !!poTrackerSummaryCollapsedSO[so.id];
  var counts = {};
  items.forEach(function(sg) { sg.parts.forEach(function(p) { counts[p.bucket] = (counts[p.bucket] || 0) + 1; }); });
  var totalQty = items.reduce(function(s, sg) { return s + sg.total; }, 0);
  var pid = (typeof _soDisplayProjectId === 'function') ? _soDisplayProjectId(so) : '';

  var html = '<div data-potrk-bk="' + Object.keys(counts).join(' ') + '" style="border-radius:7px;background:var(--bg2);margin-bottom:6px;overflow:hidden">';
  html += '<div style="padding:8px 10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap" onclick="poTrackerToggleSummarySOCollapse(\'' + so.id + '\')">';
  html += '<div style="min-width:0;display:flex;align-items:center;gap:6px">';
  html += '<span style="font-size:10px;color:var(--text3,var(--text2))">' + (collapsed ? '▶' : '▼') + '</span>';
  html += '<div>';
  html += '<div style="font-size:12px;font-weight:700" onclick="event.stopPropagation()">' + _poTrackerSoLinksHtml(so) + (so.customerPO ? ' <span style="font-weight:400;color:var(--text2);font-size:11px">· PO ' + sanitize(so.customerPO) + '</span>' : '') + '</div>';
  var sub = [];
  if (pid) sub.push('Project ID ' + sanitize(pid));
  if (sub.length) html += '<div style="font-size:10px;color:var(--text3,var(--text2));margin-top:1px">' + sub.join(' · ') + '</div>';
  html += _poTrackerDateLineHtml(so);
  html += '</div></div>';
  html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">';
  POTRACKER_ITEM_BUCKETS.forEach(function(b) {
    if (!counts[b.key]) return;
    html += '<span style="font-size:10px;font-weight:600;color:' + b.color + '">' + b.icon + ' ' + counts[b.key] + '</span>';
  });
  html += '<span style="font-weight:700;font-size:11px;background:var(--card,var(--bg));border:1px solid var(--border);border-radius:6px;padding:3px 8px;white-space:nowrap">รวม ' + totalQty + ' ชิ้น</span>';
  html += _poTrackerWaitBadgeHtml(so);
  html += '</div></div>';

  if (!collapsed) {
    html += '<div style="padding:0 10px 8px">';
    items.forEach(function(sg) {
      html += sg.parts.length > 1 ? _poTrackerSOItemSplitRowHtml(sg, selectedBuckets) : _poTrackerSOItemSimpleRowHtml(sg, selectedBuckets);
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// แถวสินค้า 1 รายการใต้หัวข้อ SO — สถานะเดียว (ไม่ต้องซ้ำลิงก์ SO/วันที่รอ เพราะหัวข้อข้างบนมีแล้ว)
function _poTrackerSOItemSimpleRowHtml(sg, selectedBuckets) {
  var p = sg.parts[0];
  var b = _poTrackerBucketInfo(p.bucket);
  var op = selectedBuckets.indexOf(p.bucket) !== -1 ? '1' : '.4';
  var html = '<div data-potrk-bk="' + p.bucket + '" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;background:var(--card,var(--bg));margin-bottom:4px;flex-wrap:wrap;opacity:' + op + '">';
  html += '<div style="font-size:12px;font-weight:600;min-width:0">' + sanitize(sg.name) + (sg.sku ? ' <span style="font-weight:400;color:var(--text3,var(--text2));font-size:10px">' + sanitize(sg.sku) + '</span>' : '') + '</div>';
  html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">';
  html += '<span style="font-size:10px;font-weight:600;color:' + b.color + '">' + b.icon + ' ' + b.label + '</span>';
  html += '<span style="font-weight:700;font-size:11px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:2px 7px;min-width:30px;text-align:center">×' + p.qty + '</span>';
  html += '</div></div>';
  return html;
}

// แถวสินค้า 1 รายการใต้หัวข้อ SO — แบ่งส่งหลายสถานะในใบเดียวกัน
function _poTrackerSOItemSplitRowHtml(sg, selectedBuckets) {
  var bks = sg.parts.map(function(p) { return p.bucket; }).join(' ');
  var html = '<div data-potrk-bk="' + bks + '" style="padding:6px 8px;border-radius:6px;background:var(--card,var(--bg));margin-bottom:4px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">';
  html += '<div style="font-size:12px;font-weight:600;min-width:0">' + sanitize(sg.name) + (sg.sku ? ' <span style="font-weight:400;color:var(--text3,var(--text2));font-size:10px">' + sanitize(sg.sku) + '</span>' : '') + '</div>';
  html += '<div style="display:flex;gap:7px;flex-wrap:wrap">';
  sg.parts.forEach(function(p) {
    var b = _poTrackerBucketInfo(p.bucket);
    var op = selectedBuckets.indexOf(p.bucket) !== -1 ? '1' : '.4';
    html += '<span style="font-size:10px;font-weight:600;color:' + b.color + ';opacity:' + op + '">' + b.icon + ' ' + p.qty + '</span>';
  });
  html += '</div></div></div>';
  return html;
}

// บันทึก poTrackerSummaryCollapsedSO ลง localStorage — จำพับ/กางไว้ข้าม session กันรกจนรีเฟรชแล้วหาย
function _poTrackerSaveSummaryCollapsedSO() {
  try { localStorage.setItem(POTRACKER_SUMMARY_COLLAPSED_LS_KEY, JSON.stringify(poTrackerSummaryCollapsedSO)); } catch (e) {}
}

// toggle พับ/กางหัวข้อ 1 SO ในโหมด "จัดกลุ่มตาม: SO"
function poTrackerToggleSummarySOCollapse(soId) {
  poTrackerSummaryCollapsedSO[soId] = !poTrackerSummaryCollapsedSO[soId];
  _poTrackerSaveSummaryCollapsedSO();
  render();
}

// พับ/กางหัวข้อ SO ทั้งหมดที่กำลังแสดงอยู่ในคราวเดียว (ปุ่ม "กางทั้งหมด"/"พับทั้งหมด")
function poTrackerSetAllSummarySOCollapse(soIds, collapsed) {
  soIds.forEach(function(id) { poTrackerSummaryCollapsedSO[id] = collapsed; });
  _poTrackerSaveSummaryCollapsedSO();
  render();
}

// สลับโหมดจัดกลุ่มแผงสรุปรายการสินค้า (สินค้า/SO) — จำค่าไว้ต่อเครื่องด้วย localStorage
function poTrackerSetSummaryViewMode(mode) {
  poTrackerSummaryViewMode = mode;
  try { localStorage.setItem(POTRACKER_SUMMARY_VIEWMODE_LS_KEY, mode); } catch (e) {}
  render();
}

// toggle แท็ปสถานะในแผงสรุป — เลือกได้พร้อมกันหลายแท็ป ถ้าเลือกครบทุกสถานะแล้วกลับเป็นโหมด "ทั้งหมด" ให้อัตโนมัติ
function poTrackerToggleSummaryBucket(key) {
  var all = POTRACKER_ITEM_BUCKETS.map(function(b) { return b.key; });
  var cur = (poTrackerSummarySelectedBuckets && poTrackerSummarySelectedBuckets.length) ? poTrackerSummarySelectedBuckets.slice() : all.slice();
  var idx = cur.indexOf(key);
  if (idx !== -1) { if (cur.length > 1) cur.splice(idx, 1); }
  else cur.push(key);
  poTrackerSummarySelectedBuckets = (cur.length === all.length) ? [] : cur;
  render();
}

// เหมือน poTrackerToggleSummaryBucket แต่เลื่อนจอไปหารายการแรกของสถานะนั้นในแผงสรุปด้วย (กันต้องไล่หาเองเวลารายการเยอะ)
// ใช้ data-potrk-bk ที่แปะไว้บนแถวสินค้า/หัวข้อ SO ของแต่ละโหมดมุมมอง — หาไม่เจอ (เช่นกดสถานะที่ถูกซ่อนไปแล้ว) ก็แค่ไม่เลื่อน
function poTrackerToggleSummaryBucketAndScroll(key) {
  poTrackerToggleSummaryBucket(key);
  var el = document.querySelector('[data-potrk-bk~="' + key + '"]');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function poTrackerResetFilters() {
  poTrackerStatusFlt = ''; poTrackerReadyFlt = ''; poTrackerCreditFlt = ''; poTrackerPrpoFlt = ''; poTrackerRestockFlt = '';
  poTrackerDateFrom = ''; poTrackerDateTo = ''; poTrackerDealerFlt = ''; poTrackerTypeFlt = '';
  poTrackerSummarySelectedBuckets = []; poTrackerSummaryMinWaitDays = '';
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
  html += '<button class="btn ' + (poTrackerSelectMode ? 'bd' : 'bo') + '" onclick="togglePOTrackerSelectMode()">☑️ ' + (poTrackerSelectMode ? 'ยกเลิก' : 'เลือก') + '</button>';
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
  html += '<select class="inp" style="max-width:150px" onchange="poTrackerTypeFlt=this.value;render()">';
  html += '<option value="">-- ทุกประเภท --</option>';
  html += '<option value="project"' + (poTrackerTypeFlt === 'project' ? ' selected' : '') + '>📋 Project</option>';
  html += '<option value="runrate"' + (poTrackerTypeFlt === 'runrate' ? ' selected' : '') + '>🏪 Run rate</option>';
  html += '</select>';
  html += '<select class="inp" style="max-width:190px" onchange="poTrackerSort=this.value;render()">';
  [['newest','🕒 ใหม่ล่าสุด'],['oldest','🕒 เก่าสุด'],['urgent','🔥 รอนานสุดก่อน (PO ลูกค้า)'],['amount_desc','💰 ยอดมาก → น้อย'],['amount_asc','💰 ยอดน้อย → มาก'],['dealer','🏪 Dealer A-Z']].forEach(function(o) {
    html += '<option value="' + o[0] + '"' + (poTrackerSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  });
  html += '</select>';
  html += '<button class="btn bo" onclick="poTrackerMoreFlt=!poTrackerMoreFlt;render()">' + (poTrackerMoreFlt ? '▲ ซ่อนตัวกรอง' : '▼ ตัวกรองเพิ่มเติม') + '</button>';
  html += '<button class="btn bo" onclick="go(\'poTrackerDealer\'' + (poTrackerDealerFlt ? ',{dealerName:\'' + sanitize(poTrackerDealerFlt).replace(/'/g, "\\'") + '\'}' : '') + ')">🏪 ดูแยกตาม Dealer</button>';
  html += '<button class="btn bo" onclick="poTrackerExportXlsx()">📤 Export Excel</button>';
  html += '<button class="btn ' + (poTrackerMainTab === 'reserve1021' ? 'bp' : 'bo') + '" onclick="poTrackerMainTab=(poTrackerMainTab===\'reserve1021\'?\'summary\':\'reserve1021\');render()">🔖 จองคลัง 1021</button>';
  html += '<button class="btn ' + (poTrackerMainTab === 'invoice' ? 'bp' : 'bo') + '" onclick="poTrackerMainTab=(poTrackerMainTab===\'invoice\'?\'summary\':\'invoice\');render()">🧾 Track Invoice</button>';
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
    html += '<select class="inp" style="max-width:170px" onchange="poTrackerRestockFlt=this.value;render()">';
    html += '<option value="">-- รอของเข้า: ทั้งหมด --</option>';
    html += '<option value="pending"' + (poTrackerRestockFlt === 'pending' ? ' selected' : '') + '>⏳ รอของเข้า</option>';
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

  if (poTrackerMainTab === 'reserve1021') {
    var rsvQ = poTrackerSearch.trim().toLowerCase();
    var rsvBaseRows = rows.filter(function(r) {
      if (poTrackerDealerFlt && r.so.dealerName !== poTrackerDealerFlt) return false;
      if (rsvQ) {
        var hay = ((r.so.soNumber || '') + ' ' + (r.so.customerPO || '') + ' ' + (r.so.dealerName || '')).toLowerCase();
        if (hay.indexOf(rsvQ) === -1) return false;
      }
      return true;
    });
    html += _poTrackerReserve1021Html(rsvBaseRows);
    el.innerHTML = html;
    return;
  }

  if (poTrackerMainTab === 'invoice') {
    html += _poTrackerInvoiceTrackHtml();
    el.innerHTML = html;
    return;
  }

  if (poTrackerDealerFlt) {
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
    html += '<button class="btn bsm ' + (poTrackerMainTab === 'summary' ? 'bp' : 'bo') + '" onclick="poTrackerMainTab=\'summary\';render()">📊 สรุปรายการสินค้า</button>';
    html += '<button class="btn bsm ' + (poTrackerMainTab === 'cards' ? 'bp' : 'bo') + '" onclick="poTrackerMainTab=\'cards\';render()">🗂️ PO/SO Cards</button>';
    html += '</div>';
    if (poTrackerMainTab === 'summary') {
      var dealerRows = rows.filter(function(r) { return r.so.dealerName === poTrackerDealerFlt; });
      html += _poTrackerCompanySummaryHtml(poTrackerDealerFlt, dealerRows);
      el.innerHTML = html;
      return;
    }
  }

  var q = poTrackerSearch.trim().toLowerCase();
  var filtered = rows.filter(function(r) {
    if (poTrackerFlt === 'done' && !r.done) return false;
    if (poTrackerFlt === 'notdone' && r.done) return false;
    if (poTrackerDealerFlt && r.so.dealerName !== poTrackerDealerFlt) return false;
    if (poTrackerTypeFlt && (r.so.type || (r.so.runrateId ? 'runrate' : 'project')) !== poTrackerTypeFlt) return false;
    if (poTrackerStatusFlt && r.so.status !== poTrackerStatusFlt) return false;
    if (poTrackerReadyFlt === 'ready' && !(r.readiness.total && r.readiness.allReady)) return false;
    if (poTrackerReadyFlt === 'notready' && !(r.readiness.total && !r.readiness.allReady)) return false;
    if (poTrackerCreditFlt === 'yes' && !r.credit) return false;
    if (poTrackerCreditFlt === 'no' && r.credit) return false;
    if (poTrackerPrpoFlt === 'pending' && !r.pendingPRPO) return false;
    if (poTrackerRestockFlt === 'pending' && !r.pendingRestock) return false;
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
    if (poTrackerSort === 'urgent') return (a.so.customerPODate || a.so.createdAt || '').localeCompare(b.so.customerPODate || b.so.createdAt || '');
    if (poTrackerSort === 'amount_desc') return b.total - a.total;
    if (poTrackerSort === 'amount_asc') return a.total - b.total;
    if (poTrackerSort === 'dealer') return (a.so.dealerName || '').localeCompare(b.so.dealerName || '');
    return (b.so.createdAt || '').localeCompare(a.so.createdAt || ''); // newest (ค่าเริ่มต้น)
  });

  _poTrackerVisibleIds = filtered.map(function(r) { return r.so.id; });

  if (!filtered.length) {
    html += '<div class="card" style="padding:20px;text-align:center;color:var(--text2)">ไม่พบรายการ</div>';
    el.innerHTML = html;
    return;
  }

  filtered.forEach(function(r) {
    var s = r.so;
    var cardClick = poTrackerSelectMode ? "togglePOTrackerSelect('" + s.id + "')" : "go('soDetail',{soId:'" + s.id + "'})";
    html += '<div class="card" style="position:relative;margin-bottom:10px;padding:14px;cursor:pointer;border:1px solid ' + (poTrackerSelected[s.id] ? 'var(--accent)' : 'var(--border)') + '" onclick="' + cardClick + '">';
    if (poTrackerSelectMode) html += '<input type="checkbox" id="poTrkChk_' + s.id + '" ' + (poTrackerSelected[s.id] ? 'checked' : '') + ' onclick="event.stopPropagation();togglePOTrackerSelect(\'' + s.id + '\')" style="position:absolute;top:12px;right:12px;width:18px;height:18px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">';
    html += '<div>';
    html += '<div style="font-weight:600;font-size:14px">' + sanitize(s.soNumber || '-') + (s.customerPO ? ' <span style="font-weight:400;color:var(--text2);font-size:12px">· PO ' + sanitize(s.customerPO) + '</span>' : '') + '</div>';
    html += '<div style="font-size:12px;color:var(--text2)">🏪 ' + sanitize(s.dealerName || '-') + '</div>';
    html += _poTrackerTypeBadgeHtml(s);
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

    html += '<div onclick="event.stopPropagation()" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">';
    html += _poTrackerAttachSectionHtml(s, 'customerPO', 'PO ลูกค้า', '📄');
    html += _poTrackerAttachSectionHtml(s, 'invoice', 'Invoice', '🧾');
    html += '</div>';

    html += '<div onclick="event.stopPropagation()" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
    html += '<button class="btn bsm bo" onclick="copySOSummaryForSalesSupport(\'' + s.id + '\')">📋 Copy สรุป</button>';
    html += '<button class="btn bsm bo" onclick="poTrackerToggleItems(\'' + s.id + '\',event)">' + (poTrackerExpandedItems[s.id] ? '▲ ซ่อนรายการสินค้า' : '▼ รายการสินค้า') + '</button>';
    html += '</div>';
    if (poTrackerExpandedItems[s.id]) html += '<div onclick="event.stopPropagation()" style="margin-top:8px">' + _poTrackerCardSummaryHtml(s) + '</div>';

    html += '</div>';
  });

  if (poTrackerSelectMode) {
    var selCnt = Object.keys(poTrackerSelected).length;
    html += '<div id="poTrkSelBar" class="sel-bar" style="background:var(--card);border-top:2px solid var(--accent);padding:10px 14px;margin-top:12px;border-radius:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<span id="poTrkSelCount" style="font-size:13px;font-weight:600;min-width:80px">' + selCnt + ' รายการที่เลือก</span>' +
      '<button class="btn bo bsm" onclick="togglePOTrackerSelectAll(true)">เลือกทั้งหมด (' + _poTrackerVisibleIds.length + ')</button>' +
      '<button class="btn bo bsm" onclick="togglePOTrackerSelectAll(false)">ยกเลิกเลือก</button>' +
      '<button class="btn bo bsm" id="poTrkSelReadyBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="showReadySummaryForSelectedPOTracker()">📦 สรุปของพร้อมส่งให้ลูกค้า</button>' +
      '<button class="btn bo bsm" style="margin-left:auto" onclick="togglePOTrackerSelectMode()">✕ ออก</button>' +
      '</div>';
  }

  el.innerHTML = html;
}

function togglePOTrackerSelectMode() {
  poTrackerSelectMode = !poTrackerSelectMode;
  poTrackerSelected = {};
  render();
}

function togglePOTrackerSelect(id) {
  if (poTrackerSelected[id]) delete poTrackerSelected[id];
  else poTrackerSelected[id] = true;
  render();
}

function togglePOTrackerSelectAll(selectAll) {
  if (selectAll) _poTrackerVisibleIds.forEach(function(id) { poTrackerSelected[id] = true; });
  else poTrackerSelected = {};
  render();
}

// ปุ่ม "📦 สรุปของพร้อมส่งให้ลูกค้า" ใน PO Tracker — ใช้ modal/logic เดิมจาก views-so.js (showReadySummaryModal)
// เพราะอ่าน/บันทึกจาก collection salesOrders เดียวกัน ไม่ต้องสร้างใหม่ซ้ำ จำกัดดีลเลอร์เดียวกันเหมือนหน้า Sales Orders
function showReadySummaryForSelectedPOTracker() {
  var ids = Object.keys(poTrackerSelected);
  if (!ids.length) return;
  var list = ids.map(function(id) { return ST.getOne('salesOrders', id); }).filter(Boolean);
  var dealerKeys = {};
  list.forEach(function(s) { dealerKeys[s.dealerId || s.dealerName || '-'] = true; });
  if (Object.keys(dealerKeys).length > 1) { toast('⚠️ เลือก PO/SO ของดีลเลอร์เดียวกันเท่านั้น'); return; }
  showReadySummaryModal(ids);
}

// ไฟล์แนบต่อ PO/SO แยกประเภท (PO ลูกค้า / Invoice) — ใช้ attachments[] เดิมของ SO ร่วมกับหน้า SO Detail
// (ดู attachGalleryHtml ใน utils.js) เพียงเติม category ต่อไฟล์ เพื่อกรองแสดงแยกช่องในหน้านี้
// ช่องลากวาง (drop) + คลิกเลือกไฟล์ในปุ่มเดียวกัน แบบย่อ — ข้อความ MB/Cloud Storage ย้ายไปเป็น tooltip (title) แทนที่จะโชว์ค้างเต็มการ์ด
var POTRACKER_ATTACH_HINT = 'รูป/PDF/Word/Excel ไม่เกิน 10MB ต่อไฟล์ — ลากไฟล์มาวางหรือคลิกเพื่อเลือก (เก็บบน Cloud Storage ต้อง login คลาวด์ก่อน)';
function _poTrackerAttachSectionHtml(s, category, label, icon) {
  var atts = s.attachments || [];
  var dzId = 'podz_' + s.id + '_' + category;
  var html = '<div style="flex:1;min-width:150px">';
  html += '<div id="' + dzId + '" class="potracker-dz" title="' + sanitize(POTRACKER_ATTACH_HINT) + '" ' +
    'ondragover="event.preventDefault();this.classList.add(\'potracker-dz-over\')" ' +
    'ondragleave="this.classList.remove(\'potracker-dz-over\')" ' +
    'ondrop="poTrackerDropAttach(event,\'' + s.id + '\',\'' + category + '\',this)">';
  html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 8px">';
  html += '<span style="font-size:14px">' + icon + '</span>';
  html += '<span style="font-size:11px;color:var(--text2);flex:1">' + label + '</span>';
  html += '<span style="font-size:10px;font-weight:700;color:var(--text2)">' + (atts.filter(function(a) { return a.category === category; }).length || '📎') + '</span>';
  html += '<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none" onchange="poTrackerAttachFile(\'' + s.id + '\',\'' + category + '\',this)">';
  html += '</label>';
  var thumbs = '';
  atts.forEach(function(a, idx) {
    if (a.category !== category) return;
    thumbs += '<div style="position:relative;width:40px;height:40px">' +
      _attachItemHtml(a, "window.open('" + a.url + "','_blank')") +
      '<button type="button" onclick="event.stopPropagation();poTrackerRemoveAttach(\'' + s.id + '\',' + idx + ')" class="potracker-dz-thumb-remove">✕</button></div>';
  });
  if (thumbs) html += '<div style="display:flex;gap:6px;flex-wrap:wrap;padding:0 8px 6px">' + thumbs + '</div>';
  html += '</div></div>';
  return html;
}

function _poTrackerUploadAttach(soId, category, file) {
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

function poTrackerAttachFile(soId, category, inputEl) {
  var file = inputEl.files && inputEl.files[0];
  inputEl.value = '';
  _poTrackerUploadAttach(soId, category, file);
}

// ลากไฟล์มาวางบนช่องแนบ — รับไฟล์แรกที่ถูกวาง ชนิดเดียวกับที่ปุ่มคลิกเลือกไฟล์รับ (รูป/PDF/Word/Excel)
function poTrackerDropAttach(ev, soId, category, zoneEl) {
  ev.preventDefault();
  if (zoneEl) zoneEl.classList.remove('potracker-dz-over');
  var files = ev.dataTransfer && ev.dataTransfer.files;
  var file = files && files[0];
  if (!file) return;
  _poTrackerUploadAttach(soId, category, file);
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

// สรุปรายการสินค้าของ SO ใบเดียว ตอนกดขยายการ์ด — หน้าตาเดียวกับ "สรุปรายการสินค้า" ใน Pipeline
// (ชิปหมวดหมู่ + ตาราง SKU/Model/QTY/มูลค่า + แถวรวม) ต่างกันตรงเติมคอลัมน์ "สถานะ" ต่อรายการ (bucket เดียวกับแผงสรุป Dealer)
function _poTrackerCardSummaryHtml(s) {
  var items = s.items || [];
  if (!items.length) return '<div style="font-size:12px;color:var(--text2);padding:4px 0 8px">ไม่มีรายการสินค้า</div>';

  var catTotals = {}, totalQty = 0, totalAmt = 0;
  items.forEach(function(it) {
    var qty = Number(it.qty) || 0;
    var cat = _poTrackerItemCategory(it);
    catTotals[cat] = (catTotals[cat] || 0) + qty;
    totalQty += qty;
    totalAmt += qty * (Number(it.unitPrice) || 0);
  });
  var catOrder = (typeof PRODUCT_CATEGORIES !== 'undefined') ? PRODUCT_CATEGORIES.map(function(c) { return c.id; }) : Object.keys(catTotals);
  var catIds = Object.keys(catTotals).sort(function(a, b) { return catOrder.indexOf(a) - catOrder.indexOf(b); });

  var html = '';
  if (catIds.length > 1) {
    html += '<div class="fcd-cats" style="margin-bottom:8px">';
    catIds.forEach(function(cid) {
      var name = (typeof getCategoryName === 'function') ? getCategoryName(cid) : cid;
      html += '<div class="fcd-cat-chip"><span class="fcd-cat-chip-name">' + sanitize(name) + '</span><span class="fcd-cat-chip-qty">' + catTotals[cid] + ' ชิ้น</span></div>';
    });
    html += '</div>';
  }

  html += '<button class="btn bsm bo" style="margin-bottom:6px" onclick="poTrackerCopyItemsTableTSV(\'' + s.id + '\',event)" title="คัดลอกตารางนี้แบบ TSV ไปวางต่อใน Excel/Google Sheets ได้เลย">📋 Copy ตาราง (วางลง Excel ได้)</button>';
  html += '<div style="overflow-x:auto"><table class="fcd-table" style="min-width:100%">';
  html += '<thead><tr><th>SKU</th><th>Model</th><th style="text-align:center">QTY</th><th style="text-align:right">มูลค่า</th><th>สถานะ</th><th style="min-width:140px">คอมเมนต์</th></tr></thead><tbody>';
  items.forEach(function(it, idx) {
    var qty = Number(it.qty) || 0;
    var amt = qty * (Number(it.unitPrice) || 0);
    var b = _poTrackerBucketInfo(_poTrackerItemBucket(it, s));
    html += '<tr>';
    html += '<td style="font-size:11px">' + (it.sku ? sanitize(it.sku) : '-') + '</td>';
    html += '<td>' + sanitize(it.model || '-') + '</td>';
    html += '<td style="text-align:center">' + qty + '</td>';
    html += '<td style="text-align:right">฿' + nmI(amt) + '</td>';
    html += '<td><span style="font-size:10px;font-weight:600;color:' + b.color + '">' + b.icon + ' ' + b.label + '</span>' +
      (!_soIsDone(s.status) ? ' <a href="#" onclick="event.stopPropagation();showSOItemStatusM(\'' + s.id + '\',' + idx + ');return false" style="font-size:10px;color:var(--accent)" title="แก้ไขสถานะรายการนี้">✏️</a>' : '') + '</td>';
    html += '<td><input type="text" value="' + sanitize(it.comment || '') + '" placeholder="พิมพ์โน้ต..." style="width:100%;font-size:11px" onclick="event.stopPropagation()" onblur="poTrackerDealerUpdateItemField(\'' + s.id + '\',' + idx + ',\'comment\',this.value)"></td>';
    html += '</tr>';
  });
  html += '<tr style="font-weight:700;border-top:2px solid var(--border)"><td colspan="2">รวม</td><td style="text-align:center">' + totalQty + '</td><td style="text-align:right">฿' + nmI(totalAmt) + '</td><td></td><td></td></tr>';
  html += '</tbody></table></div>';

  var stockOpen = !!poTrackerExpandedStockEdit[s.id];
  html += '<button class="btn bsm bo" style="margin-top:8px" onclick="poTrackerToggleStockEdit(\'' + s.id + '\',event)">' + (stockOpen ? '▲ ซ่อนช่องปรับยอด Stock' : '🔧 ปรับยอด Stock') + '</button>';
  if (stockOpen) html += _poTrackerItemsPanelHtml(s);
  return html;
}

// คัดลอกตารางรายการสินค้าของ SO ใบนี้เป็น TSV (คั่นด้วย Tab) — วางลง Excel/Google Sheets ได้เลยทั้งตาราง รวมแถวหัวและแถวรวม
function poTrackerCopyItemsTableTSV(soId, ev) {
  if (ev) ev.stopPropagation();
  var s = ST.getOne('salesOrders', soId);
  if (!s || !(s.items || []).length) { toast('ไม่มีรายการสินค้า'); return; }
  var clean = function(v) { return String(v == null ? '' : v).replace(/[\t\n\r]+/g, ' ').trim(); };
  var totalQty = 0, totalAmt = 0;
  var lines = [['SKU', 'Model', 'QTY', 'มูลค่า', 'สถานะ', 'คอมเมนต์'].join('\t')];
  s.items.forEach(function(it) {
    var qty = Number(it.qty) || 0;
    var amt = qty * (Number(it.unitPrice) || 0);
    totalQty += qty;
    totalAmt += amt;
    var b = _poTrackerBucketInfo(_poTrackerItemBucket(it, s));
    lines.push([clean(it.sku || '-'), clean(it.model || '-'), qty, amt, b.label, clean(it.comment || '')].join('\t'));
  });
  lines.push(['รวม', '', totalQty, totalAmt, '', ''].join('\t'));
  copyText(lines.join('\n'), '📋 คัดลอกตารางรายการสินค้าแล้ว (วางลง Excel ได้เลย)');
}

// เปิด/ปิดแผงปรับยอด Stock ด่วน (ซ้อนในแผงสรุปรายการสินค้า) — เปิดครั้งแรกจำเวลา stockLog ล่าสุดไว้เช็ค conflict เหมือนเดิม
function poTrackerToggleStockEdit(soId, ev) {
  if (ev) ev.stopPropagation();
  var opening = !poTrackerExpandedStockEdit[soId];
  poTrackerExpandedStockEdit[soId] = opening;
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

// soList: ให้มาเอง (เช่นจากปุ่ม export เฉพาะ Dealer) ไม่งั้นดึงทั้งหมด — filenameSuffix ต่อท้ายชื่อไฟล์ (เช่น '-ชื่อDealer')
function _poTrackerExportXlsxImpl(soList, filenameSuffix) {
  var all = soList || ST.getAll('salesOrders').slice().sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  if (!all.length) { toast('ไม่มี SO ให้ export'); return; }

  // ชีต 1: ภาพรวมต่อ PO/SO
  var overviewHeader = ['PO ลูกค้า', 'SO Number', 'Dealer', 'เลขที่โครงการ (Project ID)', 'ชื่อโครงการ', 'สถานะ', 'พร้อมส่ง', 'เครดิต', 'จำนวนวันเครดิต', 'ผู้อนุมัติเครดิต', 'PR ภายใน', 'DO Number', 'Invoice Number', 'วันที่ Invoice', 'ยอดรวม (ไม่รวม VAT)', 'สร้างเมื่อ'];
  var overviewRows = all.map(function(s) {
    var readiness = soComputeReadiness(s);
    var credit = creditRequestOpenForSO(s.id);
    return [
      s.customerPO || '', s.soNumber || '', s.dealerName || '',
      (typeof _soDisplayProjectId === 'function' ? _soDisplayProjectId(s) : (s.projectId || s.runrateProjectId || '')), s.projectName || '',
      (SO_STATUS[s.status] || {}).label || s.status || '',
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
  wsOverview['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];

  // ชีต 2: รายการสินค้าต่อบรรทัด — คอลัมน์ตรงกับ Excel ที่ทีมใช้จริง (No/SKU/รายการสินค้า/จำนวน/ราคาต่อหน่วย/ราคารวม/Remark)
  // + คอลัมน์ความพร้อมส่ง (สถานะ/รับก่อนได้/พร้อมส่งตอนนี้/ขาดอีก/วันที่จองถึง) ใช้ตัดสินใจตอนส่งสรุปให้ลูกค้าว่ารับอันไหนก่อนได้
  var itemHeader = ['PO ลูกค้า', 'SO Number', 'Dealer', 'เลขที่โครงการ (Project ID)', 'ชื่อโครงการ', 'No.', 'SKU', 'รายการสินค้า', 'จำนวน', 'ราคาต่อหน่วย', 'ราคารวม',
    'สถานะความพร้อม', 'รับก่อนได้', 'จำนวนพร้อมส่งตอนนี้', 'จำนวนค้าง/ขาดอีก', 'วันที่พร้อม/จองถึง', 'Remark'];
  var itemRows = [];
  all.forEach(function(s) {
    var pid = (typeof _soDisplayProjectId === 'function' ? _soDisplayProjectId(s) : (s.projectId || s.runrateProjectId || ''));
    (s.items || []).forEach(function(it, idx) {
      var qty = Number(it.qty) || 0;
      var price = Number(it.unitPrice) || 0;
      var r = _poTrackerItemReadinessForExport(it, s);
      itemRows.push([s.customerPO || '', s.soNumber || '', s.dealerName || '', pid, s.projectName || '', idx + 1, it.sku || '', it.model || '', qty, price, qty * price,
        r.statusLabel, r.canAcceptFirst, r.readyNowQty, r.shortageQty, r.waitUntilDate, _poTrackerItemRemark(it, s)]);
    });
  });
  var wsItems = XLSX.utils.aoa_to_sheet([itemHeader].concat(itemRows));
  wsItems['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 5 }, { wch: 14 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 14 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 34 }];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsOverview, 'ภาพรวม');
  XLSX.utils.book_append_sheet(wb, wsItems, 'รายการสินค้า');
  _poTrackerAddDealerSheets(wb, all);
  XLSX.writeFile(wb, 'po-tracker-export' + (filenameSuffix || '') + '-' + _td() + '.xlsx');
  toast('📤 Export PO Tracker แล้ว (' + all.length + ' PO/SO, ' + itemRows.length + ' รายการ)');
}

// เพิ่ม 1 ชีตต่อ Dealer สรุปรายการสินค้า จัดกลุ่มตาม PO ลูกค้า (เรียง PO ก่อน แล้วค่อยรายการในนั้น) มีแถวหัว PO + แถวรวมท้ายกลุ่ม
// ชื่อชีตตัดให้ไม่เกิน 31 ตัวอักษร (ข้อจำกัดของ Excel) และกันชื่อซ้ำกันหลัง normalize/ตัด
function _poTrackerAddDealerSheets(wb, all) {
  var byDealer = {};
  var dealerOrder = [];
  all.forEach(function(s) {
    var d = s.dealerName || '(ไม่ระบุ Dealer)';
    if (!byDealer[d]) { byDealer[d] = []; dealerOrder.push(d); }
    byDealer[d].push(s);
  });
  dealerOrder.sort();

  // + คอลัมน์ความพร้อมส่ง เหมือนชีตรายการสินค้าหลัก — และเรียงรายการพร้อมส่ง/ส่งแล้วขึ้นก่อนในแต่ละ PO พร้อมสรุปจำนวนพร้อมส่งต่อ PO
  // ใช้ตัดสินใจได้ไวตอนส่งสรุปให้ลูกค้าว่ารับอันไหนก่อนได้
  var header = ['No.', 'SKU', 'รายการสินค้า', 'จำนวน', 'ราคาต่อหน่วย', 'ราคารวม', 'ส่งแล้ว', 'คงเหลือ',
    'สถานะความพร้อม', 'รับก่อนได้', 'จำนวนพร้อมส่งตอนนี้', 'จำนวนค้าง/ขาดอีก', 'วันที่พร้อม/จองถึง', 'Remark', 'เลขที่โครงการ (Project ID)', 'ชื่อโครงการ'];
  var usedNames = {};
  dealerOrder.forEach(function(dealerName) {
    var sos = byDealer[dealerName].slice().sort(function(a, b) { return (a.customerPO || '').localeCompare(b.customerPO || ''); });
    var rows = [header];
    sos.forEach(function(s) {
      var pid = (typeof _soDisplayProjectId === 'function' ? _soDisplayProjectId(s) : (s.projectId || s.runrateProjectId || ''));
      rows.push(['PO ' + (s.customerPO || '-') + (s.soNumber ? ' / SO ' + s.soNumber : ''), '', '', '', '', '', '', '', '', '', '', '', '', '', pid, s.projectName || '']);
      var subtotal = 0;
      var readyItemCount = 0, readyQtySum = 0;
      var itemsWithReadiness = (s.items || []).map(function(it, idx) {
        var qty = Number(it.qty) || 0;
        var price = Number(it.unitPrice) || 0;
        var info = (it.sku && typeof stockSOItemReadyInfo === 'function') ? stockSOItemReadyInfo(it.sku, qty, s) : null;
        var delivered = Math.min(qty, (info && info.deliveredForThisSO) || 0);
        var r = _poTrackerItemReadinessForExport(it, s);
        return { idx: idx, it: it, qty: qty, price: price, delivered: delivered, r: r };
      }).sort(function(a, b) { return POTRACKER_BUCKET_SORT_PRIORITY[a.r.bucket] - POTRACKER_BUCKET_SORT_PRIORITY[b.r.bucket]; });
      itemsWithReadiness.forEach(function(x) {
        var amount = x.qty * x.price;
        subtotal += amount;
        if (x.r.canAcceptFirst) { readyItemCount++; readyQtySum += x.qty; }
        rows.push([x.idx + 1, x.it.sku || '', x.it.model || '', x.qty, x.price, amount, x.delivered, x.qty - x.delivered,
          x.r.statusLabel, x.r.canAcceptFirst, x.r.readyNowQty, x.r.shortageQty, x.r.waitUntilDate, _poTrackerItemRemark(x.it, s), pid, s.projectName || '']);
      });
      rows.push(['', '', 'รวม PO นี้', '', '', subtotal, '', '',
        readyItemCount ? '📦 พร้อมส่งแล้ว ' + readyItemCount + '/' + itemsWithReadiness.length + ' รายการ (' + readyQtySum + ' ชิ้น)' : 'ยังไม่มีรายการพร้อมส่ง', '', '', '', '', '', '', '']);
    });

    var sheetName = dealerName.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Dealer';
    if (usedNames[sheetName]) {
      usedNames[sheetName]++;
      sheetName = sheetName.slice(0, 28) + '-' + usedNames[sheetName];
    } else {
      usedNames[sheetName] = 1;
    }

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 9 }, { wch: 9 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 34 }, { wch: 18 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
}

// ---------------------------------------------------------------- แท็บ "จองคลัง 1021" — สรุปรายการสินค้าที่จองคลัง 1021 ทุก SO เรียงใกล้ครบกำหนดก่อน
// ดึงจาก item.reserveDate/reserveExpiryDate/link ที่กรอกไว้ในแต่ละรายการอยู่แล้ว (sync กับ lot จริงผ่าน stockSOItemReadyInfo เหมือนหน้า SO) ไม่มี collection ใหม่
function _poTrackerReserve1021Days(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - new Date(_td())) / 86400000);
}
function _poTrackerReserve1021Status(days) {
  if (days === null) return { key: 'unknown', color: '#94a3b8', label: 'ไม่ระบุวันครบกำหนด' };
  if (days <= 2) return { key: 'danger', color: '#ef4444', label: days < 0 ? 'เลยกำหนด ' + Math.abs(days) + ' วัน' : (days === 0 ? 'ครบกำหนดวันนี้' : 'เหลือ ' + days + ' วัน') };
  if (days <= 7) return { key: 'warn', color: '#d97706', label: 'เหลือ ' + days + ' วัน' };
  return { key: 'ok', color: '#16a34a', label: 'เหลือ ' + days + ' วัน' };
}
function _poTrackerReserve1021Flatten(baseRows) {
  var list = [];
  baseRows.forEach(function(r) {
    var so = r.so;
    (so.items || []).forEach(function(it, idx) {
      if (it.sourceType !== 'reserve_1021') return;
      var qty = Number(it.qty) || 0;
      var reserveDate = it.reserveDate || '';
      var reserveExpiryDate = it.reserveExpiryDate || '';
      if (it.sku && typeof stockSOItemReadyInfo === 'function') {
        var info = stockSOItemReadyInfo(it.sku, qty, so);
        if (info) {
          reserveDate = info.reserveDate || reserveDate;
          reserveExpiryDate = info.bookingExpiryDate || reserveExpiryDate;
        }
      }
      list.push({ so: so, idx: idx, name: it.model || it.sku || '-', sku: it.sku || '', qty: qty, reserveDate: reserveDate, reserveExpiryDate: reserveExpiryDate, link: it.link || '' });
    });
  });
  list.sort(function(a, b) {
    var da = _poTrackerReserve1021Days(a.reserveExpiryDate), db = _poTrackerReserve1021Days(b.reserveExpiryDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
  return list;
}
// หน้า Track ตาม Invoice — group ทุกรอบส่งมอบ (shipments[]) ข้ามทุก SO ตามเลข Invoice เดียวกัน พร้อม SKU/ราคา/รวม ต่อรายการ
function _poTrackerInvoiceTrackHtml() {
  var groups = (typeof soGroupShipmentsByInvoice === 'function') ? soGroupShipmentsByInvoice() : [];
  var q = poTrackerSearch.trim().toLowerCase();
  if (q) {
    groups = groups.filter(function(g) {
      var hay = (g.invoiceNumber + ' ' + g.rounds.map(function(r) { return (r.soNumber || '') + ' ' + (r.dealerName || ''); }).join(' ')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }
  var html = '<div class="card" style="padding:16px">';
  html += '<div style="font-weight:600;margin-bottom:10px">🧾 Track ตาม Invoice (รวมข้ามหลาย SO ที่ใช้เลขเดียวกัน)</div>';
  if (!groups.length) {
    html += '<div class="hint">ยังไม่มี Invoice ที่บันทึกไว้' + (q ? ' ตรงกับคำค้นหา' : '') + '</div></div>';
    return html;
  }
  groups.forEach(function(g) {
    var soSet = {};
    var grandTotal = 0;
    g.rounds.forEach(function(r) { soSet[r.soNumber] = true; });
    html += '<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:12px">';
    html += '<div style="padding:10px 14px;background:var(--bg2);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">';
    html += '<div style="font-weight:700">' + qcopyHtml(g.invoiceNumber) + (g.invoiceDate ? ' <span style="color:var(--text2);font-size:11px">(' + fD(g.invoiceDate) + ')</span>' : '') + '</div>';
    html += '<div style="font-size:11px;color:var(--text2)">' + Object.keys(soSet).length + ' SO</div>';
    html += '</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr style="text-align:left;background:var(--bg2)">' +
      '<th style="padding:6px 10px;font-weight:600;color:var(--text2)">SO</th>' +
      '<th style="padding:6px 10px;font-weight:600;color:var(--text2)">Dealer</th>' +
      '<th style="padding:6px 10px;font-weight:600;color:var(--text2)">SKU</th>' +
      '<th style="padding:6px 10px;font-weight:600;color:var(--text2)">สินค้า</th>' +
      '<th style="padding:6px 10px;font-weight:600;color:var(--text2);text-align:center">จำนวน</th>' +
      '<th style="padding:6px 10px;font-weight:600;color:var(--text2);text-align:right">ราคา/หน่วย</th>' +
      '<th style="padding:6px 10px;font-weight:600;color:var(--text2);text-align:right">ราคารวม</th>' +
      '<th style="padding:6px 10px;font-weight:600;color:var(--text2)">DO</th></tr></thead><tbody>';
    g.rounds.forEach(function(r) {
      var items = (typeof _soShipRoundItemsWithPrice === 'function') ? _soShipRoundItemsWithPrice(r) : [];
      items.forEach(function(it) {
        grandTotal += it.total;
        html += '<tr style="border-top:1px solid var(--border)">';
        html += '<td style="padding:6px 10px">' + sanitize(r.soNumber || '-') + '</td>';
        html += '<td style="padding:6px 10px">' + sanitize(r.dealerName || '-') + '</td>';
        html += '<td style="padding:6px 10px">' + sanitize(it.sku || '-') + '</td>';
        html += '<td style="padding:6px 10px">' + sanitize(it.model || '-') + '</td>';
        html += '<td style="padding:6px 10px;text-align:center">' + (it.qty || 0) + '</td>';
        html += '<td style="padding:6px 10px;text-align:right">' + fmtMoney(it.unitPrice) + '</td>';
        html += '<td style="padding:6px 10px;text-align:right">' + fmtMoney(it.total) + '</td>';
        html += '<td style="padding:6px 10px">' + sanitize(r.doNumber || '-') + '</td>';
        html += '</tr>';
      });
    });
    html += '<tr style="font-weight:600;background:var(--bg2);border-top:1px solid var(--border)">' +
      '<td colspan="6" style="padding:6px 10px;text-align:right">รวม</td>' +
      '<td style="padding:6px 10px;text-align:right">' + fmtMoney(grandTotal) + '</td><td></td></tr>';
    html += '</tbody></table></div></div>';
  });
  html += '</div>';
  return html;
}

function _poTrackerReserve1021Html(baseRows) {
  var list = _poTrackerReserve1021Flatten(baseRows);
  var cDanger = 0, cWarn = 0, cOk = 0, cNoLink = 0;
  list.forEach(function(x) {
    var s = _poTrackerReserve1021Status(_poTrackerReserve1021Days(x.reserveExpiryDate)).key;
    if (s === 'danger') cDanger++;
    if (s === 'warn') cWarn++;
    if (s === 'ok') cOk++;
    if (!x.link) cNoLink++;
  });
  var html = '<div class="card" style="margin-bottom:12px;padding:16px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  html += '<div style="font-weight:600;font-size:14px">🔖 รายการจองคลัง 1021 ทั้งหมด (' + list.length + ' รายการ)</div>';
  html += '<button class="btn bo" onclick="poTrackerExportReserve1021Xlsx()">📤 Export Excel</button>';
  html += '</div>';
  html += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px">';
  html += '<div><div style="font-size:20px;font-weight:600;color:#ef4444">' + cDanger + '</div><div style="font-size:11px;color:var(--text2)">เลยกำหนด / เหลือ ≤2 วัน</div></div>';
  html += '<div><div style="font-size:20px;font-weight:600;color:#d97706">' + cWarn + '</div><div style="font-size:11px;color:var(--text2)">ใกล้ครบกำหนด (≤7 วัน)</div></div>';
  html += '<div><div style="font-size:20px;font-weight:600;color:#16a34a">' + cOk + '</div><div style="font-size:11px;color:var(--text2)">ยังมีเวลา</div></div>';
  html += '<div><div style="font-size:20px;font-weight:600;color:var(--text2)">' + cNoLink + '</div><div style="font-size:11px;color:var(--text2)">ยังไม่มีลิงก์แนบ</div></div>';
  html += '</div>';
  if (!list.length) {
    html += '<div style="color:var(--text2);font-size:12.5px;padding:10px 0">ไม่มีรายการที่จองคลัง 1021 อยู่ตามตัวกรองด้านบน (เลือก Dealer/ค้นหาใหม่ หรือยังไม่มีรายการที่ตั้ง "แหล่งที่มา" เป็นจองคลัง 1021)</div>';
    html += '</div>';
    return html;
  }
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:720px">';
  html += '<thead><tr style="text-align:left;color:var(--text2);font-size:11px">';
  ['สินค้า', 'SKU', 'จำนวน', 'SO / Dealer', 'จองวันที่ → ถึงวันที่', 'เหลือเวลา', 'ลิงก์แนบ', ''].forEach(function(h) {
    html += '<th style="padding:7px 8px;border-bottom:1px solid var(--border);white-space:nowrap">' + h + '</th>';
  });
  html += '</tr></thead><tbody>';
  list.forEach(function(x) {
    var days = _poTrackerReserve1021Days(x.reserveExpiryDate);
    var st = _poTrackerReserve1021Status(days);
    var rowBg = st.key === 'danger' ? 'background:#ef44441a' : (st.key === 'warn' ? 'background:#d977061a' : '');
    html += '<tr style="' + rowBg + '">';
    html += '<td style="padding:7px 8px;border-bottom:1px solid var(--border);font-weight:600">' + sanitize(x.name) + '</td>';
    html += '<td style="padding:7px 8px;border-bottom:1px solid var(--border);font-family:monospace;font-size:11px;color:var(--text2)">' + sanitize(x.sku) + '</td>';
    html += '<td style="padding:7px 8px;border-bottom:1px solid var(--border);text-align:center">' + x.qty + '</td>';
    html += '<td style="padding:7px 8px;border-bottom:1px solid var(--border)">' + _poTrackerSoLinksHtml(x.so) + '<div style="font-size:10px;color:var(--text2);margin-top:1px">' + sanitize(x.so.dealerName || '-') + '</div></td>';
    html += '<td style="padding:7px 8px;border-bottom:1px solid var(--border);white-space:nowrap">' + (x.reserveDate ? fD(x.reserveDate) : '-') + ' → ' + (x.reserveExpiryDate ? fD(x.reserveExpiryDate) : '-') + '</td>';
    html += '<td style="padding:7px 8px;border-bottom:1px solid var(--border)"><span style="font-weight:700;color:' + st.color + '">' + st.label + '</span></td>';
    html += '<td style="padding:7px 8px;border-bottom:1px solid var(--border)">' + (x.link ? '<a href="' + sanitize(x.link) + '" target="_blank" rel="noopener" style="color:var(--accent)">🔗 เปิดลิงก์</a>' : '<span style="color:var(--text2);font-size:11px">—</span>') + '</td>';
    html += '<td style="padding:7px 8px;border-bottom:1px solid var(--border)"><a href="#" onclick="showSOEditItemsModal(\'' + x.so.id + '\');return false" style="font-size:11px;color:var(--accent)">✏️ แก้ไขวันจอง</a></td>';
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';
  return html;
}

function poTrackerExportReserve1021Xlsx() {
  ensureXLSX().then(function() {
    _poTrackerExportReserve1021XlsxImpl();
  }).catch(function(e) {
    if (typeof toast === 'function') toast('⚠️ โหลดไลบรารีไม่สำเร็จ: ' + (e && e.message || e), true);
  });
}
function _poTrackerExportReserve1021XlsxImpl() {
  var all = ST.getAll('salesOrders').slice();
  var baseRows = all.map(_poTrackerBuildRow);
  var list = _poTrackerReserve1021Flatten(baseRows);
  if (!list.length) { toast('ไม่มีรายการจองคลัง 1021'); return; }
  var header = ['SKU', 'รายการสินค้า', 'จำนวน', 'SO Number', 'PO ลูกค้า', 'Dealer', 'จองวันที่', 'จองถึงวันที่', 'เหลือเวลา (วัน)', 'สถานะ', 'ลิงก์แนบ'];
  var dataRows = list.map(function(x) {
    var days = _poTrackerReserve1021Days(x.reserveExpiryDate);
    var st = _poTrackerReserve1021Status(days);
    return [x.sku, x.name, x.qty, x.so.soNumber || '', x.so.customerPO || '', x.so.dealerName || '',
      x.reserveDate ? fD(x.reserveDate) : '', x.reserveExpiryDate ? fD(x.reserveExpiryDate) : '',
      days === null ? '' : days, st.label, x.link || ''];
  });
  var ws = XLSX.utils.aoa_to_sheet([header].concat(dataRows));
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 34 }];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'จองคลัง 1021');
  XLSX.writeFile(wb, 'po-tracker-จองคลัง-1021-' + _td() + '.xlsx');
  toast('📤 Export รายการจองคลัง 1021 แล้ว (' + list.length + ' รายการ)');
}

// ================================================================
// หน้าแยกตาม Dealer — รวมสินค้าทุก PO ของ Dealer เดียวกันเข้าด้วยกันต่อ product (เช่น Matrice 400 รวม 5 ลำ
// จาก PO 123 3 ลำ รอ PR/PO + PO 124 2 ลำ ส่งแล้ว) ให้เห็นงานค้างทั้งหมดของ Dealer นี้ในที่เดียว
// ================================================================

var poTrackerDealerPageFlt = ''; // Dealer ที่เลือกดูอยู่ในหน้านี้ — จำค่าไว้ข้ามการ render ภายในหน้าเดียวกัน
var poTrackerDealerViewMode = 'table'; // table | card — ตารางเป็นค่าเริ่มต้น (ผู้ใช้ขอให้ดูง่ายกว่าการ์ด 2026-10-08)
var poTrackerDealerDetailFlt = 'all';  // all | outstanding — กรองตารางรายละเอียดต่อ PO/SO
var poTrackerDealerSort = 'product';   // product | date_desc | date_asc — เรียงตารางรายละเอียด (product = จัดกลุ่มตามสินค้า)
var poTrackerDealerSearch = '';        // ค้นหาสินค้าตาม SKU/ชื่อ ในหน้านี้
var POTRACKER_DEALER_LS_KEY = 'v7_poTrackerDealer_lastDealer'; // จำ Dealer ล่าสุดที่เปิดดู (ต่อเครื่อง)

function poTrackerDealerSelect(v) {
  poTrackerDealerPageFlt = v;
  try { localStorage.setItem(POTRACKER_DEALER_LS_KEY, v || ''); } catch (e) {}
  render();
}

// รวมสินค้าทุก PO/SO ของ Dealer หนึ่งเป็น product เดียวกัน + เก็บยอดแยกตาม bucket (ส่งแล้ว/รอPR-PO/จองรอส่ง/อื่นๆ)
// แยกออกมาเป็นฟังก์ชันกลาง ใช้ร่วมกันทั้งหน้า render, ปุ่มคัดลอกสรุป, และปุ่ม export Excel เฉพาะ Dealer นี้
function _poTrackerDealerBuildProducts(dealerName) {
  var dealerSOs = ST.getAll('salesOrders').filter(function(s) { return s.dealerName === dealerName; });
  var productMap = {};
  dealerSOs.forEach(function(s) {
    (s.items || []).forEach(function(it, idx) {
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
      productMap[key].pos.push({ so: s, idx: idx, item: it, qty: qty, bucket: bucket, model: it.model || it.sku || '-', sku: it.sku || '' });
    });
  });
  var products = Object.keys(productMap).map(function(k) { return productMap[k]; })
    .sort(function(a, b) { return b.totalQty - a.totalQty; });
  return { dealerSOs: dealerSOs, products: products };
}

function rPOTrackerDealer(el) {
  document.getElementById('pgT').textContent = '🏪 สินค้าตาม Dealer';
  if (S.dealerName) {
    // มาจากลิงก์ภายนอก (เช่นหน้า PO Tracker) — ใช้ค่านี้ครั้งเดียวแล้วลบทิ้ง ไม่งั้นจะทับการเลือก Dealer เองทุกครั้งที่ render
    poTrackerDealerPageFlt = S.dealerName;
    delete S.dealerName;
    try { localStorage.setItem(POTRACKER_DEALER_LS_KEY, poTrackerDealerPageFlt); } catch (e) {}
  } else if (!poTrackerDealerPageFlt) {
    try { poTrackerDealerPageFlt = localStorage.getItem(POTRACKER_DEALER_LS_KEY) || ''; } catch (e) {}
  }

  var all = ST.getAll('salesOrders');
  var dealers = Array.from(new Set(all.map(function(s) { return s.dealerName || ''; }).filter(Boolean))).sort();
  if (poTrackerDealerPageFlt && dealers.indexOf(poTrackerDealerPageFlt) === -1) poTrackerDealerPageFlt = ''; // Dealer ที่จำไว้ไม่มีข้อมูลแล้ว

  var html = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '<button class="btn bo bsm" onclick="go(\'poTracker\')" style="margin-bottom:10px">← กลับ PO Tracker</button>';

  html += '<div class="card" style="margin-bottom:12px;padding:16px">';
  html += '<div style="font-weight:600;margin-bottom:8px">เลือก Dealer</div>';
  html += '<select class="inp" style="max-width:280px" onchange="poTrackerDealerSelect(this.value)">';
  html += '<option value="">-- เลือก Dealer --</option>';
  dealers.forEach(function(d) { html += '<option value="' + sanitize(d) + '"' + (poTrackerDealerPageFlt === d ? ' selected' : '') + '>' + sanitize(d) + '</option>'; });
  html += '</select>';
  html += '</div>';

  if (!poTrackerDealerPageFlt) {
    html += '<div class="card" style="padding:20px;text-align:center;color:var(--text2)">เลือก Dealer ด้านบนเพื่อดูสินค้าค้าง/ส่งแล้วทั้งหมด</div>';
    el.innerHTML = html;
    return;
  }

  var built = _poTrackerDealerBuildProducts(poTrackerDealerPageFlt);
  var allProducts = built.products;

  var grandTotal = allProducts.reduce(function(sum, p) { return sum + p.totalQty; }, 0);
  var grandDelivered = allProducts.reduce(function(sum, p) { return sum + p.deliveredQty; }, 0);

  html += '<div class="card" style="margin-bottom:12px;padding:16px">';
  html += '<div style="display:flex;gap:16px;flex-wrap:wrap">';
  html += '<div><div style="font-size:22px;font-weight:600">' + grandTotal + '</div><div style="font-size:11px;color:var(--text2)">รวมทุกรายการ (ชิ้น)</div></div>';
  html += '<div><div style="font-size:22px;font-weight:600;color:#22c55e">' + grandDelivered + '</div><div style="font-size:11px;color:var(--text2)">ส่งแล้ว</div></div>';
  html += '<div><div style="font-size:22px;font-weight:600;color:#f59e0b">' + (grandTotal - grandDelivered) + '</div><div style="font-size:11px;color:var(--text2)">ค้างอยู่</div></div>';
  html += '</div></div>';

  if (!allProducts.length) {
    html += '<div class="card" style="padding:20px;text-align:center;color:var(--text2)">Dealer นี้ยังไม่มีรายการสินค้า</div>';
    el.innerHTML = html;
    return;
  }

  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">';
  html += '<button class="btn bsm ' + (poTrackerDealerViewMode === 'table' ? 'bp' : 'bo') + '" onclick="poTrackerDealerViewMode=\'table\';render()">📋 ตาราง</button>';
  html += '<button class="btn bsm ' + (poTrackerDealerViewMode === 'card' ? 'bp' : 'bo') + '" onclick="poTrackerDealerViewMode=\'card\';render()">🗂️ การ์ด</button>';
  html += '<button class="btn bsm bo" onclick="poTrackerDealerCopySummary()">📋 คัดลอกสรุปของค้าง</button>';
  html += '<button class="btn bsm bo" onclick="poTrackerDealerExportXlsx()">📤 Export Excel (Dealer นี้)</button>';
  html += '<input class="inp" style="flex:1;min-width:160px;max-width:260px" placeholder="🔎 ค้นหาสินค้า/SKU" value="' + sanitize(poTrackerDealerSearch) + '" oninput="poTrackerDealerSearch=this.value;render()">';
  html += '</div>';

  var q = poTrackerDealerSearch.trim().toLowerCase();
  var products = !q ? allProducts : allProducts.filter(function(p) {
    return (p.model || '').toLowerCase().indexOf(q) !== -1 || (p.sku || '').toLowerCase().indexOf(q) !== -1;
  });

  if (!products.length) {
    html += '<div class="card" style="padding:20px;text-align:center;color:var(--text2)">ไม่พบสินค้าที่ค้นหา</div>';
    el.innerHTML = html;
    return;
  }

  html += (poTrackerDealerViewMode === 'table') ? _poTrackerDealerTableHtml(products) : _poTrackerDealerCardHtml(products);

  el.innerHTML = html;
}

// วันนับจากวันที่ที่ให้มา ถึงวันนี้ — ใช้เช็คว่ารอ PR/PO นานผิดปกติหรือยัง (>= 7 วัน ไฮไลต์เตือน)
function _poTrackerDaysSince(dateStr) {
  if (!dateStr) return null;
  var d = String(dateStr).split('T')[0];
  return Math.max(0, Math.round((new Date(_td()) - new Date(d)) / 864e5));
}

// แก้ field เดียวของรายการสินค้า 1 ชิ้นใน SO แล้วบันทึกทันที — ใช้กับการแก้สถานะ/วันที่ PR/PO ตรงในตาราง Dealer
function poTrackerDealerUpdateItemField(soId, idx, field, value) {
  var so = ST.getOne('salesOrders', soId);
  if (!so || !so.items || !so.items[idx]) return;
  var items = so.items.slice();
  items[idx] = Object.assign({}, items[idx]);
  items[idx][field] = value;
  ST.update('salesOrders', soId, { items: items });
  toast('💾 บันทึกแล้ว');
  render();
}

function poTrackerDealerPrpoStatusChanged(selectEl, soId, idx) {
  if (selectEl.value === '__new__') {
    var nm = (prompt('ชื่อสถานะ PR/PO ใหม่') || '').trim();
    if (!nm || typeof admAddPrpoStQuick !== 'function') { selectEl.value = ''; return; }
    var id = admAddPrpoStQuick(nm);
    poTrackerDealerUpdateItemField(soId, idx, 'prpoStatusId', id);
    return;
  }
  poTrackerDealerUpdateItemField(soId, idx, 'prpoStatusId', selectEl.value);
}

// คัดลอกสรุปสินค้าค้างส่งทั้งหมดของ Dealer ที่เลือกอยู่ (แยกตามสถานะ) เป็นข้อความ — วางส่งลูกค้า/Sales Support ได้เลย
function poTrackerDealerCopySummary() {
  if (!poTrackerDealerPageFlt || typeof copyText !== 'function') return;
  var built = _poTrackerDealerBuildProducts(poTrackerDealerPageFlt);
  var lines = ['📊 สรุปสินค้า — ' + poTrackerDealerPageFlt, ''];
  var any = false;
  POTRACKER_ITEM_BUCKETS.forEach(function(b) {
    var rows = [];
    built.products.forEach(function(p) { p.pos.forEach(function(x) { if (x.bucket === b.key) rows.push(x); }); });
    if (!rows.length) return;
    any = true;
    lines.push(b.icon + ' ' + b.label + ' (' + rows.length + ' รายการ)');
    rows.forEach(function(x) {
      var comment = (x.item && x.item.comment) ? String(x.item.comment).replace(/[\t\n\r]+/g, ' ').trim() : '';
      var pid = (typeof _soDisplayProjectId === 'function') ? _soDisplayProjectId(x.so) : '';
      lines.push('- ' + x.model + ' x' + x.qty + ' — SO ' + (x.so.soNumber || x.so.customerPO || '-') + (x.so.createdAt ? ' (' + fD(x.so.createdAt) + ')' : '') +
        (pid ? ' — Project ID: ' + pid : '') +
        (comment ? ' — 📝 ' + comment : ''));
    });
    lines.push('');
  });
  if (!any) { toast('ไม่มีรายการ'); return; }
  copyText(lines.join('\n'), '📋 คัดลอกสรุปของ ' + poTrackerDealerPageFlt + ' แล้ว');
}

// export Excel เฉพาะ SO ของ Dealer ที่เลือกอยู่ — ใช้ตัวสร้างไฟล์เดียวกับปุ่ม export รวมในหน้า PO Tracker
function poTrackerDealerExportXlsx() {
  if (!poTrackerDealerPageFlt) return;
  var dealerSOs = ST.getAll('salesOrders').filter(function(s) { return s.dealerName === poTrackerDealerPageFlt; })
    .sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  if (!dealerSOs.length) { toast('ไม่มี SO ให้ export'); return; }
  var slug = poTrackerDealerPageFlt.replace(/[^a-zA-Z0-9ก-๙]+/g, '-').slice(0, 40);
  ensureXLSX().then(function() {
    _poTrackerExportXlsxImpl(dealerSOs, '-' + slug);
  }).catch(function(e) {
    if (typeof toast === 'function') toast('⚠️ โหลดไลบรารีไม่สำเร็จ: ' + (e && e.message || e), true);
  });
}

// มุมมองตาราง — ตารางสรุปต่อสินค้า (รวม/ส่งแล้ว/รอ PR/PO/จองรอส่ง/อื่นๆ) + ตารางรายละเอียดต่อ PO/SO แยกบรรทัด พร้อมวันที่
// แก้สถานะ/วันที่คาดว่าจะได้ของของรายการที่รอ PR/PO ได้ตรงนี้เลย และไฮไลต์แถวที่รอนานเกิน 7 วัน
function _poTrackerDealerTableHtml(products) {
  var html = '';

  // ---- ตารางสรุปต่อสินค้า
  html += '<div class="card" style="margin-bottom:12px;padding:0;overflow-x:auto">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap">';
  html += '<thead><tr style="border-bottom:1px solid var(--border);text-align:left">';
  ['สินค้า', 'รวม', 'ส่งแล้ว', '🛒 รอ PR/PO', '⏳ รอของเข้า', '📌 จองรอส่ง', 'อื่นๆ'].forEach(function(h, i) {
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
    html += '<td style="padding:7px 10px;text-align:right;color:#d97706">' + (p.byBucket.pending_restock || '-') + '</td>';
    html += '<td style="padding:7px 10px;text-align:right;color:#f59e0b">' + (p.byBucket.reserved || '-') + '</td>';
    html += '<td style="padding:7px 10px;text-align:right;color:var(--text2)">' + (other || '-') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  // ---- ตารางรายละเอียดต่อ PO/SO — แถวละ 1 รายการสินค้าของ 1 PO/SO พร้อมวันที่และสถานะ
  html += '<div class="card" style="padding:14px">';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  html += '<button class="btn bsm ' + (poTrackerDealerDetailFlt === 'all' ? 'bp' : 'bo') + '" onclick="poTrackerDealerDetailFlt=\'all\';render()">ทั้งหมด</button>';
  html += '<button class="btn bsm ' + (poTrackerDealerDetailFlt === 'outstanding' ? 'bp' : 'bo') + '" onclick="poTrackerDealerDetailFlt=\'outstanding\';render()">ค้างส่งเท่านั้น</button>';
  html += '<select class="inp" style="max-width:170px;margin-left:auto" onchange="poTrackerDealerSort=this.value;render()">';
  [['product', 'จัดกลุ่มตามสินค้า'], ['date_desc', 'วันที่ใหม่สุด'], ['date_asc', 'วันที่เก่าสุด']].forEach(function(o) {
    html += '<option value="' + o[0] + '"' + (poTrackerDealerSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  });
  html += '</select>';
  html += '</div>';

  var headerCols = ['สินค้า', 'PO', 'SO', 'วันที่', 'จำนวน', 'สถานะ'];
  var rowFn = function(l) {
    var b = POTRACKER_ITEM_BUCKETS.filter(function(bb) { return bb.key === l.bucket; })[0] || POTRACKER_ITEM_BUCKETS[0];
    var overdueDays = null;
    if (l.bucket === 'pending_prpo') overdueDays = _poTrackerDaysSince(l.item.prpoSubmittedDate || l.so.createdAt);
    var overdue = overdueDays !== null && overdueDays >= 7;
    var row = '<tr style="border-bottom:1px solid var(--border)' + (overdue ? ';background:rgba(239,68,68,.08)' : '') + '">';
    row += '<td style="padding:7px 10px;white-space:normal">' + sanitize(l.model) + '</td>';
    row += '<td style="padding:7px 10px">' + sanitize(l.so.customerPO || '-') + '</td>';
    row += '<td style="padding:7px 10px"><a href="#" onclick="go(\'soDetail\',{soId:\'' + l.so.id + '\'});return false" style="color:var(--accent)">' + sanitize(l.so.soNumber || '-') + '</a></td>';
    row += '<td style="padding:7px 10px">' + (l.so.createdAt ? fD(l.so.createdAt) : '-') + '</td>';
    row += '<td style="padding:7px 10px">x' + l.qty + '</td>';
    if (l.bucket === 'pending_prpo') {
      row += '<td style="padding:7px 10px;white-space:normal"><div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">';
      row += '<select class="inp bsm" style="font-size:11px;padding:2px 4px" onchange="poTrackerDealerPrpoStatusChanged(this,\'' + l.so.id + '\',' + l.idx + ')">' + _soPrpoStatusOptionsHtml(l.item.prpoStatusId || '') + '</select>';
      row += '<input type="date" class="inp bsm" style="font-size:11px;padding:2px 4px;width:120px" title="วันที่คาดว่าจะได้ของ" value="' + sanitize(l.item.prpoExpectedDate || '') + '" onchange="poTrackerDealerUpdateItemField(\'' + l.so.id + '\',' + l.idx + ',\'prpoExpectedDate\',this.value)">';
      if (overdue) row += '<span style="color:#ef4444;font-weight:600">⚠️ ค้าง ' + overdueDays + ' วัน</span>';
      row += '</div></td>';
    } else {
      row += '<td style="padding:7px 10px;white-space:normal"><span style="color:' + b.color + '">' + b.icon + ' ' + b.label + '</span>' +
        ' <a href="#" onclick="go(\'soDetail\',{soId:\'' + l.so.id + '\'});return false" style="font-size:11px;color:var(--accent);margin-left:6px;white-space:nowrap">✏️ แก้ไขใน SO</a></td>';
    }
    row += '</tr>';
    return row;
  };

  if (poTrackerDealerSort === 'product') {
    // จัดกลุ่มตามสินค้า — sub-header ต่อ product แล้วค่อยแถวรายละเอียดเรียงวันที่ใหม่สุดก่อนในกลุ่มนั้น
    var anyLine = false;
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap">';
    products.forEach(function(p) {
      var lines = p.pos.slice();
      if (poTrackerDealerDetailFlt === 'outstanding') lines = lines.filter(function(l) { return l.bucket !== 'shipped'; });
      if (!lines.length) return;
      anyLine = true;
      lines.sort(function(a, b) { return (b.so.createdAt || '').localeCompare(a.so.createdAt || ''); });
      html += '<thead><tr style="background:var(--bg2)"><th colspan="6" style="padding:6px 10px;text-align:left;font-weight:600">' + sanitize(p.model) + (p.sku ? ' <span style="font-size:10px;color:var(--text2);font-weight:400">(' + sanitize(p.sku) + ')</span>' : '') + '</th></tr>';
      html += '<tr style="border-bottom:1px solid var(--border);text-align:left">';
      headerCols.forEach(function(h) { html += '<th style="padding:6px 10px;color:var(--text2);font-weight:600;font-size:11px">' + h + '</th>'; });
      html += '</tr></thead><tbody>';
      lines.forEach(function(l) { html += rowFn(l); });
      html += '</tbody>';
    });
    if (!anyLine) html += '<tbody><tr><td style="padding:10px;text-align:center;color:var(--text2)">ไม่มีรายการ</td></tr></tbody>';
    html += '</table></div></div>';
    return html;
  }

  // เรียงตามวันที่ — แสดงเป็นตารางแบนราบ ไม่แบ่งกลุ่ม
  var flatLines = [];
  products.forEach(function(p) { p.pos.forEach(function(x) { flatLines.push(x); }); });
  if (poTrackerDealerDetailFlt === 'outstanding') flatLines = flatLines.filter(function(l) { return l.bucket !== 'shipped'; });
  flatLines.sort(function(a, b) {
    if (poTrackerDealerSort === 'date_asc') return (a.so.createdAt || '').localeCompare(b.so.createdAt || '');
    return (b.so.createdAt || '').localeCompare(a.so.createdAt || '');
  });

  if (!flatLines.length) {
    html += '<div style="padding:10px;text-align:center;color:var(--text2);font-size:12px">ไม่มีรายการ</div></div>';
    return html;
  }

  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap">';
  html += '<thead><tr style="border-bottom:1px solid var(--border);text-align:left">';
  headerCols.forEach(function(h) { html += '<th style="padding:8px 10px;color:var(--text2);font-weight:600">' + h + '</th>'; });
  html += '</tr></thead><tbody>';
  flatLines.forEach(function(l) { html += rowFn(l); });
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
