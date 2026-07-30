// ================================================================
// views-stock.js — Stock สินค้า (Phase 1: เมนูหลักในแอป + Import Excel + ประวัติการเปลี่ยนแปลง)
// เก็บจำนวนคงเหลือแยกจาก v7_products โดยตั้งใจ — products มี guard กันข้อมูล sync ทับ/โดนทับอยู่แล้ว
// (เคยเกิดเหตุข้อมูลหาย 2026-07-18) ไม่อยากไปแตะระบบนั้น เลยจับคู่กับ product ด้วย SKU แทน
// Phase 2 (ยังไม่ทำ): ลิงก์ stock-view.html ให้ Admin ภายนอกกรอก/Import เอง
//
// โมเดลข้อมูล: แต่ละ SKU เก็บเป็น "lot" หลายก้อน (rec.lots[]) แทนตัวเลขเดียว — แต่ละ lot มี location
// (โค้ดคลังย่อย), จำนวน, และอ้างอิง (PR/PO หรือ SO No.) การย้าย lot ระหว่างคลัง (เช่น QI → 0001 → 1021)
// จะหักจาก lot ต้นทางแล้วสร้าง lot ใหม่ที่ปลายทาง เก็บ fromLocation/fromLotId ไว้สืบย้อนได้
// ================================================================

var stockSearch = '';
var stockCategoryFilters = []; // ว่าง = ทุกหมวด, เลือกได้หลายอัน เช่น Drone + Payload
var stockFavOnly = false;
var stockLowFilter = 'all'; // all | low | out
var stockTypeFilter = 'all'; // all | stock | order
var stockShowLog = false;
var stockShowAging = false;
var stockAgingThreshold = 60; // วัน
var stockExpanded = {}; // sku -> เปิด/ปิดแถวสรุปคลังย่อยในหน้ารายการ
var STOCK_LOW_THRESHOLD = 5;

// คลังย่อยทั้งหมด — ชุดเดียวกันทุก SKU ตั้งค่าได้ (เก็บใน ST 'stockLocations' เพิ่มคลังใหม่ได้จากปุ่ม "+ เพิ่มคลัง" ในเมนู Stock)
// sellable:true = นับเป็น "พร้อมขาย" — ที่เหลือ (ติดจอง/ดาเมจ/รอขึ้นทะเบียน ฯลฯ) ไม่นับว่าขายได้จริง
var STOCK_DEFAULT_LOCATIONS = [
  { code: '0001', name: 'Normal Good', sellable: true, warehouse: '1001 SiS Main Warehouse' },
  { code: '1021', name: 'Sales Booking', sellable: false, warehouse: '1001 SiS Main Warehouse' },
  { code: '1027', name: 'Damaged Boxes', sellable: false, warehouse: '1001 SiS Main Warehouse' },
  { code: 'QI', name: 'Pending Registration (กสทช. ฯลฯ)', sellable: false, warehouse: 'QI — รอขึ้นทะเบียน' },
  { code: 'PRPO', name: 'PR/PO Backlog', sellable: false, warehouse: 'PR/PO — รอสั่งซื้อ' }
];
var STOCK_BOOKING_STATUSES = ['รอส่งมอบ', 'เตรียมส่งมอบ', 'ส่งมอบแล้ว', 'ยกเลิก'];

// เซ็ตค่าเริ่มต้นครั้งแรกถ้ายังไม่เคยมีคลังเก็บไว้ — หลังจากนั้นแก้/เพิ่มได้จากในแอป ไม่ต้องแก้โค้ด
// ถ้ามีคลัง default ตัวใหม่เพิ่มมาทีหลัง (เช่น PRPO) แต่ผู้ใช้มีคลังเก่าอยู่แล้ว จะเติมให้อัตโนมัติโดยไม่ทับของเดิม
function getStockLocations() {
  var saved = ST.getAll('stockLocations');
  if (!saved.length) {
    STOCK_DEFAULT_LOCATIONS.forEach(function(l) { ST.add('stockLocations', l); });
    saved = ST.getAll('stockLocations');
  }
  var codes = saved.map(function(l) { return l.code; });
  STOCK_DEFAULT_LOCATIONS.forEach(function(def) {
    if (codes.indexOf(def.code) === -1) { ST.add('stockLocations', def); saved.push(def); }
  });
  return saved;
}

// bookingExpiry ของคลัง: 'none' = ไม่มีกำหนดจอง | 'penalty' = มีกำหนด เลื่อนได้ แต่โดนหักถ้าไม่เลื่อน | 'free' = มีกำหนด เลื่อนไม่ได้ ไม่โดนหัก
function stockAddLocationDef(code, name, sellable, warehouse, bookingExpiry) {
  code = (code || '').trim();
  name = (name || '').trim();
  warehouse = (warehouse || '').trim();
  if (!code || !name || !warehouse) { toast('⚠️ กรอกให้ครบทุกช่อง'); return false; }
  var exists = getStockLocations().some(function(l) { return l.code === code; });
  if (exists) { toast('⚠️ มีโค้ดคลัง ' + code + ' อยู่แล้ว'); return false; }
  ST.add('stockLocations', { code: code, name: name, sellable: !!sellable, warehouse: warehouse, bookingExpiry: bookingExpiry || 'none' });
  return true;
}

// แก้ไขคลังที่มีอยู่แล้ว (ชื่อ/สังกัดคลังหลัก/นับพร้อมขาย/กำหนดจอง) — แก้โค้ดคลังไม่ได้ เพราะ lot เดิมผูก location ด้วยโค้ดนี้อยู่
function stockUpdateLocationDef(code, name, sellable, warehouse, bookingExpiry) {
  name = (name || '').trim();
  warehouse = (warehouse || '').trim();
  if (!name || !warehouse) { toast('⚠️ กรอกให้ครบทุกช่อง'); return false; }
  var rec = ST.getAll('stockLocations').filter(function(l) { return l.code === code; })[0];
  if (!rec) return false;
  ST.update('stockLocations', rec.id, { name: name, sellable: !!sellable, warehouse: warehouse, bookingExpiry: bookingExpiry || 'none' });
  return true;
}

function stockLocationName(code) {
  var loc = getStockLocations().filter(function(l) { return l.code === code; })[0];
  return loc ? loc.name : code;
}

function _stockLotId() { return 'lot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

function _stockRec(sku) {
  return ST.getAll('stockLevels').find(function(s) { return s.sku === sku; });
}

// รองรับ record เก่า: ก่อนมี lot เคยเก็บเป็น locations{code:qty} แล้วก่อนหน้านั้นเคยเก็บ qty ตัวเดียว
// แปลงเป็น lot เดียวต่อคลัง ชื่ออ้างอิง "(ยอดเดิม)" ให้อัตโนมัติ ไม่มีข้อมูลหาย
function stockGetLots(sku) {
  if (!sku) return [];
  var rec = _stockRec(sku);
  if (!rec) return [];
  if (rec.lots) return rec.lots;
  var locs = rec.locations || (rec.qty ? { '0001': Number(rec.qty) || 0 } : {});
  var lots = [];
  Object.keys(locs).forEach(function(code) {
    var q = Number(locs[code]) || 0;
    if (q > 0) lots.push({ id: 'legacy_' + code, location: code, ref: '(ยอดเดิม)', qty: q, dateIn: rec.updated || rec.created || _nw() });
  });
  return lots;
}

// lot ที่สถานะ "ส่งมอบแล้ว" ถือว่าออกจากคลังไปแล้วจริง — ไม่นับรวมในยอดคงเหลือ (แต่ยัง็บไว้ในรายการเพื่อดูประวัติ)
function _stockIsActiveLot(l) { return l.status !== 'ส่งมอบแล้ว'; }

function stockLocTotal(lots, code) {
  return lots.filter(function(l) { return l.location === code && _stockIsActiveLot(l); }).reduce(function(s, l) { return s + (Number(l.qty) || 0); }, 0);
}

// PRPO ยังไม่ถึงจริง ไม่นับรวมใน "คงเหลือรวม" ของ SKU (แต่ยังโชว์ยอดของตัวเองแยกในการ์ด PR/PO Backlog ได้ตามปกติ)
function stockTotalQty(lots) {
  return lots.filter(function(l) { return _stockIsActiveLot(l) && l.location !== 'PRPO'; })
    .reduce(function(s, l) { return s + (Number(l.qty) || 0); }, 0);
}

function stockSellableQty(lots) {
  var sellableCodes = getStockLocations().filter(function(l) { return l.sellable; }).map(function(l) { return l.code; });
  return lots.filter(function(l) { return sellableCodes.indexOf(l.location) !== -1; }).reduce(function(s, l) { return s + (Number(l.qty) || 0); }, 0);
}

// ================================================================
// เฟส 2/3: จองลอยๆ แบบคิว FIFO — หลาย quotation จองสินค้าตัวเดียวกันพร้อมกันได้
// จองก่อนได้ก่อน: คำนวณจากสต็อกจริง (0001 ก่อน แล้ว QI) ลบด้วยรายการจองที่มาก่อนหน้าตามลำดับเวลา
// ================================================================

function stockGetReservations(sku) {
  return ST.getAll('stockReservations')
    .filter(function(r) { return r.sku === sku && r.status === 'active'; })
    .sort(function(a, b) { return (a.createdAt || '').localeCompare(b.createdAt || ''); });
}

function stockGetReservationFor(sku, quotationId) {
  if (!quotationId) return null;
  return ST.getAll('stockReservations').filter(function(r) {
    return r.sku === sku && r.quotationId === quotationId && r.status === 'active';
  })[0] || null;
}

// ไล่จัดสรรสต็อกจริงให้แต่ละรายการจองตามลำดับคิว (มาก่อนได้ก่อน) — ใช้ทั้งแสดงผลและตอนย้าย stock จริงตอนสร้าง SO
function stockComputeQueue(sku) {
  var lots = stockGetLots(sku);
  var pool0001 = stockLocTotal(lots, '0001');
  var poolQI = stockLocTotal(lots, 'QI');
  return stockGetReservations(sku).map(function(r) {
    var need = Number(r.qty) || 0;
    var from0001 = Math.min(need, pool0001); pool0001 -= from0001; need -= from0001;
    var fromQI = Math.min(need, poolQI); poolQI -= fromQI; need -= fromQI;
    return { reservation: r, from0001: from0001, fromQI: fromQI, allocated: from0001 + fromQI, shortfall: need };
  });
}

// พรีวิว: ถ้าจะจองจำนวนนี้ตอนนี้ (ยังไม่กดจองจริง) จะได้เท่าไหร่ — หักรายการจองที่มีอยู่ก่อนแล้วออกจาก pool ก่อนเสมอ
function stockPreviewAllocation(sku, qty) {
  var lots = stockGetLots(sku);
  var pool0001 = stockLocTotal(lots, '0001');
  var poolQI = stockLocTotal(lots, 'QI');
  stockGetReservations(sku).forEach(function(r) {
    var need = Number(r.qty) || 0;
    var from0001 = Math.min(need, pool0001); pool0001 -= from0001; need -= from0001;
    var fromQI = Math.min(need, poolQI); poolQI -= fromQI; need -= fromQI;
  });
  var need = Math.max(0, Math.round(Number(qty) || 0));
  var from0001 = Math.min(need, pool0001); pool0001 -= from0001; need -= from0001;
  var fromQI = Math.min(need, poolQI); poolQI -= fromQI; need -= fromQI;
  return { from0001: from0001, fromQI: fromQI, shortfall: need, qiLeftover: poolQI };
}

function stockCreateReservation(sku, productName, qty, opts) {
  opts = opts || {};
  return ST.add('stockReservations', {
    sku: sku, productName: productName, qty: Math.max(0, Math.round(Number(qty) || 0)),
    quotationId: opts.quotationId || '', quoteNo: opts.quoteNo || '',
    dealerName: opts.dealerName || '', salesperson: opts.salesperson || _stockCurrentUserName(),
    projectName: opts.projectName || '', soId: '', soNumber: '',
    status: 'active', createdAt: _nw()
  });
}

function stockCancelReservation(id) {
  ST.update('stockReservations', id, { status: 'cancelled' });
}

// รายการที่อยู่ใน PRPO Backlog เป็นแค่ข้อมูลเสริม (ยังไม่ถึงจริง) ไม่ถูกนับเข้าไปในสูตรจัดสรร from0001/fromQI/shortfall
function _stockPRPOInfoHtml(sku) {
  var lots = stockGetLots(sku).filter(function(l) { return l.location === 'PRPO' && _stockIsActiveLot(l); });
  if (!lots.length) return '';
  var total = lots.reduce(function(s, l) { return s + (Number(l.qty) || 0); }, 0);
  var dates = lots.filter(function(l) { return l.expectedDate; }).map(function(l) { return l.expectedDate; }).sort();
  var dateLabel = dates.length ? fD(dates[0]) : 'ยังไม่ระบุวันที่';
  return '<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(217,119,6,.15);color:#d97706">🚚 กำลังสั่ง ' + total + ' (คาด ' + dateLabel + ')</span>';
}

function _stockAllocBadgesHtml(sku, alloc) {
  var h = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;font-weight:400">';
  if (alloc.from0001 > 0) {
    h += '<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(34,197,94,.15);color:#16a34a">✓ พร้อมส่ง ' + alloc.from0001 + '</span>';
  }
  if (alloc.fromQI > 0) {
    h += '<a href="#" onclick="event.stopPropagation();go(\'stockDetail\',{sku:\'' + sku + '\'});return false" style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(245,158,11,.15);color:#b45309;text-decoration:none" title="กดดูรายละเอียด QI">⏳ จาก QI ' + alloc.fromQI + '</a>';
  }
  if (alloc.shortfall > 0) {
    var _p = getProductBySku(sku);
    h += _p && _p.eol ?
      '<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(107,114,128,.15);color:#6b7280">⛔ ขาดอีก ' + alloc.shortfall + ' — EOL สั่งเพิ่มไม่ได้แล้ว</span>' :
      '<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(239,68,68,.15);color:#ef4444">✕ ขาดอีก ' + alloc.shortfall + ' ต้อง PR/PO</span>';
  }
  h += _stockPRPOInfoHtml(sku);
  h += '</div>';
  if (alloc.qiLeftover > 0 && alloc.fromQI > 0) {
    h += '<div style="font-size:10px;color:var(--text2);margin-top:2px;font-weight:400">QI เหลืออีก ' + alloc.qiLeftover + ' สำรองไว้</div>';
  }
  return h;
}

// เฟส 1: badge สถานะสต็อกแบบ read-only (ไม่มีปุ่ม) ให้หน้าอื่นเรียกใช้ตรงๆ — คิดรวมรายการจองที่มีอยู่แล้วด้วย
function stockAvailabilityHtml(sku, qty) {
  if (!sku) return '';
  qty = Math.max(0, Math.round(Number(qty) || 0));
  if (qty <= 0) return '';
  return _stockAllocBadgesHtml(sku, stockPreviewAllocation(sku, qty));
}

// เฟส 2: badge + ปุ่มจองลอยๆ/ยกเลิกจอง สำหรับหน้าใบเสนอราคาโดยเฉพาะ (ผูกกับ quotationId)
function stockQuoteAvailabilityHtml(sku, qty, quote) {
  if (!sku) return '';
  qty = Math.max(0, Math.round(Number(qty) || 0));
  if (qty <= 0) return '';
  var quotationId = quote ? quote.id : '';
  var existing = quotationId ? stockGetReservationFor(sku, quotationId) : null;

  if (existing) {
    if (existing.qty !== qty) { ST.update('stockReservations', existing.id, { qty: qty }); existing.qty = qty; }
    var queue = stockComputeQueue(sku);
    var idx = -1;
    for (var i = 0; i < queue.length; i++) { if (queue[i].reservation.id === existing.id) { idx = i; break; } }
    var entry = idx !== -1 ? queue[idx] : { from0001: 0, fromQI: 0, shortfall: qty };
    var h = _stockAllocBadgesHtml(sku, { from0001: entry.from0001, fromQI: entry.fromQI, shortfall: entry.shortfall, qiLeftover: 0 });
    h += '<div style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
    h += '<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(59,130,246,.15);color:#2563eb">🔒 จองแล้ว (คิวที่ ' + (idx + 1) + ')</span>';
    h += '<button class="btn bsm bd" style="font-size:10px;padding:2px 8px" onclick="event.stopPropagation();stockCancelReservationAndRefresh(\'' + existing.id + '\')">✕ ยกเลิกจอง</button>';
    h += '</div>';
    return h;
  }

  var alloc = stockPreviewAllocation(sku, qty);
  var h2 = _stockAllocBadgesHtml(sku, alloc);
  h2 += '<button class="btn bsm bo" style="font-size:10px;padding:2px 8px;margin-top:4px" onclick="event.stopPropagation();stockReserveFromQuote(\'' + sku + '\',' + qty + (quotationId ? ",'" + quotationId + "'" : ',null') + ')">🔒 จองลอยๆ</button>';
  return h2;
}

function stockReserveFromQuote(sku, qty, quotationId) {
  var p = getProductBySku(sku);
  var quote = quotationId ? getQuoteById(quotationId) : null;
  stockCreateReservation(sku, p ? p.name : '', qty, {
    quotationId: quotationId || '', quoteNo: quote ? quote.quoteNo : '',
    dealerName: quote ? quote.dealerName : '', salesperson: quote ? quote.quotedBy : _stockCurrentUserName(),
    projectName: quote ? quote.projectName : ''
  });
  toast('🔒 จองลอยๆ แล้ว');
  if (typeof renderQuotationItemsTable === 'function') renderQuotationItemsTable();
}

function stockCancelReservationAndRefresh(id) {
  stockCancelReservation(id);
  toast('✕ ยกเลิกจองแล้ว');
  if (typeof renderQuotationItemsTable === 'function') renderQuotationItemsTable();
}

// เฟส 3: ย้ายส่วนที่ "พร้อมส่ง" (จาก 0001) ของรายการจองนี้เข้า 1021 จริง ผูกกับเลข SO
// ส่วนที่ยังติด QI (รอขึ้นทะเบียน) จะไม่ย้าย รอ admin ย้าย QI -> 0001 เองก่อน แล้วค่อยกดยืนยันซ้ำ
function stockFulfillReservationToSO(sku, so) {
  var p = getProductBySku(sku);
  var productName = p ? p.name : sku;
  var reservation = stockGetReservationFor(sku, so.quotationId);
  if (!reservation) { toast('⚠️ ไม่พบรายการจองของสินค้านี้'); return; }
  var queue = stockComputeQueue(sku);
  var entry = null;
  for (var i = 0; i < queue.length; i++) { if (queue[i].reservation.id === reservation.id) { entry = queue[i]; break; } }
  if (!entry || entry.from0001 <= 0) { toast('⚠️ ยังไม่มีของพร้อมส่งจาก 0001 ให้ย้าย'); return; }

  var moveQty = entry.from0001;
  var lots = stockGetLots(sku).slice();
  var sourceLots = lots.filter(function(l) { return l.location === '0001'; })
    .sort(function(a, b) { return (a.dateIn || '').localeCompare(b.dateIn || ''); });
  var remaining = moveQty;
  for (var j = 0; j < sourceLots.length && remaining > 0; j++) {
    var lot = sourceLots[j];
    var idx = lots.findIndex(function(l) { return l.id === lot.id; });
    var take = Math.min(remaining, Number(lot.qty) || 0);
    if (take <= 0) continue;
    remaining -= take;
    if (take >= (Number(lot.qty) || 0)) lots.splice(idx, 1);
    else lots[idx] = Object.assign({}, lot, { qty: lot.qty - take });
  }
  var actuallyMoved = moveQty - remaining;
  if (actuallyMoved <= 0) { toast('⚠️ ของใน 0001 ไม่พออีกแล้ว'); return; }

  lots.push({
    id: _stockLotId(), location: '1021', ref: so.soNumber, qty: actuallyMoved, dateIn: _nw(),
    note: 'ยืนยันจาก SO', fromLocation: '0001',
    soNumber: so.soNumber, soId: so.id, bookedDate: _nw(),
    salesperson: reservation.salesperson || '', dealerName: reservation.dealerName || so.dealerName || '',
    projectName: reservation.projectName || '', status: 'เตรียมส่งมอบ'
  });
  _stockSaveLots(sku, productName, lots);
  ST.add('stockLog', {
    sku: sku, productName: productName, locationCode: '0001', locationName: stockLocationName('0001'),
    toLocationCode: '1021', toLocationName: stockLocationName('1021'),
    qty: actuallyMoved, note: 'ยืนยันจาก SO ' + (so.soNumber || ''), date: _nw(), type: 'transfer'
  });

  // ส่วนที่ย้ายแล้วตัดออกจากรายการจอง — ถ้าเหลือ 0 ถือว่าจองนี้สำเร็จสมบูรณ์ ถ้ายังเหลือ (ติด QI) คงไว้ในคิวต่อ
  var newQty = (Number(reservation.qty) || 0) - actuallyMoved;
  if (newQty <= 0) ST.update('stockReservations', reservation.id, { status: 'confirmed', soId: so.id, soNumber: so.soNumber, qty: 0 });
  else ST.update('stockReservations', reservation.id, { qty: newQty, soId: so.id, soNumber: so.soNumber });

  toast('📦 ย้ายเข้า 1021 แล้ว ' + actuallyMoved + ' หน่วย');
  if (typeof rSODetail === 'function') rSODetail(document.getElementById('ct'));
}

// เฟส 3: badge ความพร้อมส่งต่อรายการใน SO — ใช้รายการจองของ quotation ต้นทาง (ถ้ามี) ไม่งั้น fallback เป็นสถานะสต็อกสดทั่วไป
// มีปุ่ม "ยืนยัน & ย้ายเข้า 1021" เมื่อมีส่วนที่พร้อมส่งจาก 0001 ให้ย้ายจริง
function stockSOItemReadinessHtml(sku, qty, so) {
  if (!sku) return '<span style="color:var(--text2);font-size:11px">ไม่มี SKU ผูกไว้</span>';
  qty = Math.max(0, Math.round(Number(qty) || 0));

  // ส่วนที่ถูกจองเข้า 1021 ผูกกับ SO นี้โดยตรงแล้ว (ไม่ว่าจะมาจาก reservation หรือกดจอง/ลากเข้า 1021 เองแล้วเลือก SO นี้)
  var lots = stockGetLots(sku);
  var soLots = lots.filter(function(l) { return l.location === '1021' && l.soId === so.id; });
  var deliveredForThisSO = soLots.filter(function(l) { return l.status === 'ส่งมอบแล้ว'; })
    .reduce(function(s, l) { return s + (Number(l.qty) || 0); }, 0);
  var bookedForThisSO = soLots.filter(_stockIsActiveLot)
    .reduce(function(s, l) { return s + (Number(l.qty) || 0); }, 0);
  var remainingQty = Math.max(0, qty - bookedForThisSO - deliveredForThisSO);

  var reservation = so.quotationId ? stockGetReservationFor(sku, so.quotationId) : null;
  var from0001 = 0, fromQI = 0, shortfall = 0;
  if (remainingQty > 0) {
    if (reservation) {
      var queue = stockComputeQueue(sku);
      var entry = null;
      for (var i = 0; i < queue.length; i++) { if (queue[i].reservation.id === reservation.id) { entry = queue[i]; break; } }
      from0001 = entry ? entry.from0001 : 0;
      fromQI = entry ? entry.fromQI : 0;
      shortfall = entry ? entry.shortfall : remainingQty;
    } else {
      var alloc = stockPreviewAllocation(sku, remainingQty);
      from0001 = alloc.from0001; fromQI = alloc.fromQI; shortfall = alloc.shortfall;
    }
  }

  var h = '';
  if (deliveredForThisSO > 0) {
    h += '<div style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(107,114,128,.15);color:#6b7280;display:inline-block;margin-bottom:3px">✔ ส่งมอบแล้ว ' + deliveredForThisSO + '</div><br>';
  }
  if (bookedForThisSO > 0) {
    h += '<div style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(34,197,94,.15);color:#16a34a;display:inline-block;margin-bottom:3px">✓ พร้อมส่ง ' + bookedForThisSO + ' (จองใน 1021 แล้ว)</div><br>';
  }
  h += _stockAllocBadgesHtml(sku, { from0001: from0001, fromQI: fromQI, shortfall: shortfall, qiLeftover: 0 });
  if (reservation && from0001 > 0) {
    h += '<button class="btn bsm bp" style="font-size:10px;padding:2px 8px;margin-top:4px" onclick="stockFulfillReservationToSO(\'' + sku + '\',ST.getOne(\'salesOrders\',\'' + so.id + '\'))">📦 ยืนยัน & ย้ายเข้า 1021</button>';
  }
  return h;
}

function _stockSaveLots(sku, productName, lots) {
  var rec = _stockRec(sku);
  var payload = { sku: sku, productName: productName, lots: lots, source: 'app', updatedBy: _stockCurrentUserName() };
  if (rec) ST.update('stockLevels', rec.id, payload);
  else ST.add('stockLevels', payload);
}

function stockToggleExpand(sku) {
  stockExpanded[sku] = !stockExpanded[sku];
  render();
}

// ประเภทสินค้า: 'stock' = นับ/ติดตามจำนวนคงเหลือจริง, 'order' = สั่งตามออเดอร์ (default — ยังไม่ตั้งค่าไว้)
function getStockOrderType(sku) {
  if (!sku) return 'order';
  var rec = _stockRec(sku);
  return (rec && rec.orderType) || 'order';
}

function toggleStockOrderType(sku, productName) {
  if (!sku) return;
  var newType = getStockOrderType(sku) === 'stock' ? 'order' : 'stock';
  var rec = _stockRec(sku);
  if (rec) ST.update('stockLevels', rec.id, { orderType: newType });
  else ST.add('stockLevels', { sku: sku, productName: productName, lots: [], orderType: newType });
  render();
}

function isStockFav(sku) {
  return !!sku && ST.getAll('stockFavs').some(function(f) { return f.sku === sku; });
}

function toggleStockFav(sku, name) {
  if (!sku) return;
  var rec = ST.getAll('stockFavs').find(function(f) { return f.sku === sku; });
  if (rec) ST.delete('stockFavs', rec.id);
  else ST.add('stockFavs', { sku: sku, name: name || '' });
  render();
}

function _stockCurrentUserName() {
  return (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? (CURRENT_USER.displayName || CURRENT_USER.email || '') : '';
}

// เพิ่ม lot ใหม่เข้าคลังหนึ่ง (รับของเข้า / จองใหม่โดยตรง) — extra ใช้เฉพาะปลายทางเป็น 1021 Sales Booking หรือ PRPO Backlog
function stockAddLot(sku, productName, code, qty, ref, note, extra) {
  if (!sku) return;
  qty = Math.max(0, Math.round(Number(qty) || 0));
  if (qty <= 0) return;
  var lots = stockGetLots(sku).slice();
  var lot = { id: _stockLotId(), location: code, ref: ref || '', qty: qty, dateIn: _nw(), note: note || '' };
  if (code === '1021' && extra) {
    lot.soNumber = extra.ref || ref || '';
    lot.ref = lot.soNumber;
    lot.soId = extra.soId || '';
    lot.bookedDate = extra.bookedDate || _nw();
    lot.salesperson = extra.salesperson || '';
    lot.dealerName = extra.dealerName || '';
    lot.projectName = extra.projectName || '';
    lot.status = extra.status || STOCK_BOOKING_STATUSES[0];
  } else if (code === 'PRPO' && extra) {
    lot.soNumber = extra.soNumber || '';
    lot.soId = extra.soId || '';
    lot.expectedDate = extra.expectedDate || '';
  } else if (code === 'QI' && extra) {
    lot.submittedDate = extra.submittedDate || '';
    lot.estimateDays = extra.estimateDays || '';
    lot.expectedCompleteDate = extra.expectedCompleteDate || '';
    lot.registrationComplete = false;
    // รหัสอ้างอิงชุดขึ้นทะเบียน สร้างเองอัตโนมัติตอนเข้า QI ครั้งแรก — ใช้ตามรอย lot ที่ถูกแบ่ง/ย้ายไปหลายคลัง
    // ไม่ผูกกับเลข PO หรือวันที่ เพราะซ้ำกันได้ กด "✅ สำเร็จ" ที่ไหนก็ปลดป้ายทุกก้อนที่มีรหัสเดียวกันพร้อมกัน
    lot.qiRegId = 'qireg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }
  // กำหนดจอง — ใช้ได้กับคลังไหนก็ได้ที่ตั้งค่า bookingExpiry ไว้ (ไม่ผูกกับโค้ดคลังตายตัว)
  var addLoc = getStockLocations().filter(function(l) { return l.code === code; })[0];
  if (addLoc && addLoc.bookingExpiry && addLoc.bookingExpiry !== 'none' && extra && extra.bookingExpiryDate) {
    lot.bookingExpiryDate = extra.bookingExpiryDate;
  }
  lots.push(lot);
  _stockSaveLots(sku, productName, lots);
  ST.add('stockLog', {
    sku: sku, productName: productName, locationCode: code, locationName: stockLocationName(code),
    before: 0, after: qty, delta: qty, source: 'app', note: note || '', date: _nw(), type: 'in'
  });
}

// ย้าย lot (บางส่วนหรือทั้งหมด) จากคลังหนึ่งไปอีกคลัง — ถ้าปลายทางคือ 1021 ต้องมี extra (รายละเอียดการจอง)
function stockMoveLot(sku, productName, lotId, moveQty, destCode, extra) {
  if (!sku) return;
  extra = extra || {};
  var lots = stockGetLots(sku).slice();
  var idx = lots.findIndex(function(l) { return l.id === lotId; });
  if (idx === -1) return;
  var lot = lots[idx];
  moveQty = Math.max(0, Math.min(Math.round(Number(moveQty) || 0), Number(lot.qty) || 0));
  if (moveQty <= 0) return;
  var remaining = (Number(lot.qty) || 0) - moveQty;
  if (remaining > 0) lots[idx] = Object.assign({}, lot, { qty: remaining });
  else lots.splice(idx, 1);

  var newLot = {
    id: _stockLotId(), location: destCode, ref: extra.ref || lot.ref, qty: moveQty, dateIn: _nw(),
    note: extra.note || '', fromLocation: lot.location, fromLotId: lot.id
  };
  if (destCode === '1021') {
    newLot.soNumber = extra.ref || lot.ref || '';
    newLot.ref = newLot.soNumber;
    newLot.soId = extra.soId || '';
    newLot.bookedDate = extra.bookedDate || _nw();
    newLot.salesperson = extra.salesperson || '';
    newLot.dealerName = extra.dealerName || '';
    newLot.projectName = extra.projectName || '';
    newLot.status = extra.status || STOCK_BOOKING_STATUSES[0];
  } else if (destCode === 'PRPO') {
    newLot.soNumber = extra.soNumber || '';
    newLot.soId = extra.soId || '';
    newLot.expectedDate = extra.expectedDate || '';
  } else if (destCode === 'QI') {
    newLot.submittedDate = extra.submittedDate || '';
    newLot.estimateDays = extra.estimateDays || '';
    newLot.expectedCompleteDate = extra.expectedCompleteDate || '';
    newLot.registrationComplete = false;
    newLot.qiRegId = 'qireg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }
  // กำหนดจอง — ใช้ได้กับคลังไหนก็ได้ที่ตั้งค่า bookingExpiry ไว้ (ไม่ผูกกับโค้ดคลังตายตัว)
  var mvLoc = getStockLocations().filter(function(l) { return l.code === destCode; })[0];
  if (mvLoc && mvLoc.bookingExpiry && mvLoc.bookingExpiry !== 'none' && extra.bookingExpiryDate) {
    newLot.bookingExpiryDate = extra.bookingExpiryDate;
  }

  // ลูกค้าขอรับสินค้าก่อนขึ้นทะเบียน กสทช. เสร็จ — ป้ายเตือน "ยังบินไม่ได้" ต้องติดตามไปกับ lot ทุกครั้งที่ย้าย
  // จนกว่าจะกด "✅ ขึ้นทะเบียนสำเร็จ" ไม่ว่า lot จะอยู่คลังไหนก็ตาม (ไม่ต้องย้อนกลับไป QI ก่อน)
  if (destCode !== 'QI' && !lot.registrationComplete && (lot.location === 'QI' || lot.qiPending)) {
    newLot.qiPending = true;
    newLot.submittedDate = lot.submittedDate || '';
    newLot.expectedCompleteDate = lot.expectedCompleteDate || '';
    newLot.registrationComplete = false;
    newLot.qiRegId = lot.qiRegId || '';
  }

  lots.push(newLot);
  _stockSaveLots(sku, productName, lots);

  ST.add('stockLog', {
    sku: sku, productName: productName,
    locationCode: lot.location, locationName: stockLocationName(lot.location),
    toLocationCode: destCode, toLocationName: stockLocationName(destCode),
    qty: moveQty, note: extra.note || '', date: _nw(), type: 'transfer'
  });
}

function stockSetLotStatus(sku, productName, lotId, status) {
  var lots = stockGetLots(sku).slice();
  var idx = lots.findIndex(function(l) { return l.id === lotId; });
  if (idx === -1) return;
  var lot = lots[idx];
  lots[idx] = Object.assign({}, lot, { status: status });
  _stockSaveLots(sku, productName, lots);
  if (status === 'ส่งมอบแล้ว' && lot.soId) _stockCheckSOFullyDelivered(lot.soId);
  render();
}

// กดได้ทั้งจาก QI เองหรือจาก lot ที่ถูกแบ่งไปคลังอื่นแล้ว (qiPending) — ไม่ต้องย้อนกลับไป QI ก่อน
// lot ก้อนนี้แชร์ qiRegId เดียวกับก้อนอื่นที่แบ่ง/ย้ายมาจาก QI ครั้งเดียวกัน — กดสำเร็จที่ก้อนไหนก็ปลดป้ายให้ทุกก้อนที่เหลืออยู่พร้อมกัน ไม่ต้องไล่กดทีละคลัง
function stockMarkRegistrationComplete(sku, productName, lotId) {
  var lots = stockGetLots(sku).slice();
  var idx = lots.findIndex(function(l) { return l.id === lotId; });
  if (idx === -1) return;
  var regId = lots[idx].qiRegId;
  // เก็บสถานะเดิมของทุกก้อนที่จะโดนแก้ไว้ก่อน เผื่อกด Undo ต้องคืนค่าที่ถูกต้องของแต่ละก้อน (ไม่ใช่ตั้งค่าตายตัว)
  var snapshot = lots.filter(function(l) { return regId ? l.qiRegId === regId : l.id === lotId; })
    .map(function(l) { return { id: l.id, registrationComplete: l.registrationComplete, qiPending: l.qiPending }; });
  var updated = lots.map(function(l) {
    var match = regId ? l.qiRegId === regId : l.id === lotId;
    return match ? Object.assign({}, l, { registrationComplete: true, qiPending: false }) : l;
  });
  _stockSaveLots(sku, productName, updated);
  var count = snapshot.length;
  showUndoToast('✅ ขึ้นทะเบียนสำเร็จแล้ว' + (count > 1 ? ' (ปลดป้าย ' + count + ' รายการ)' : ''), function() {
    stockUndoMarkRegistrationComplete(sku, productName, snapshot);
  });
  render();
}

function stockUndoMarkRegistrationComplete(sku, productName, snapshot) {
  var lots = stockGetLots(sku).slice();
  var updated = lots.map(function(l) {
    var snap = snapshot.filter(function(s) { return s.id === l.id; })[0];
    return snap ? Object.assign({}, l, { registrationComplete: snap.registrationComplete, qiPending: snap.qiPending }) : l;
  });
  _stockSaveLots(sku, productName, updated);
  toast('↩️ ยกเลิกแล้ว');
  render();
}

// เลื่อนกำหนดจอง — ใช้ได้เฉพาะคลังที่ตั้งเป็น 'penalty' (เลื่อนได้) เท่านั้น คลังแบบ 'free' เลื่อนไม่ได้ตามที่ตั้งใจ
function stockExtendBooking(sku, productName, lotId, newDate) {
  if (!newDate) return;
  var lots = stockGetLots(sku).slice();
  var idx = lots.findIndex(function(l) { return l.id === lotId; });
  if (idx === -1) return;
  lots[idx] = Object.assign({}, lots[idx], { bookingExpiryDate: newDate });
  _stockSaveLots(sku, productName, lots);
  toast('🔄 เลื่อนกำหนดจองแล้ว');
  render();
}

function showStockExtendBookingM(sku, lotId) {
  var lots = stockGetLots(sku);
  var lot = lots.filter(function(l) { return l.id === lotId; })[0];
  if (!lot) return;
  var body = '<div class="fg"><label>กำหนดจองใหม่</label><input type="date" id="ext_date" value="' + sanitize(lot.bookingExpiryDate || '') + '"></div>';
  body += '<button class="btn bp btn-full" onclick="stockExtendBooking(\'' + sku + '\',\'' + sanitize((getProductBySku(sku) || {}).name || '').replace(/'/g, "\\'") + '\',\'' + lotId + '\',document.getElementById(\'ext_date\').value);closeMForce()">💾 บันทึก</button>';
  openM('🔄 เลื่อนกำหนดจอง', body);
}

// ตรวจ lot ทุกตัวที่จองเกินกำหนดแล้ว "ดีด" กลับเข้า 0001 อัตโนมัติ — เช็คครั้งเดียวต่อวันตอนเปิดหน้า Stock/รายละเอียดสินค้า
// (ไม่มี server คอยรันตอนเที่ยงคืนจริงๆ ประมวลผลตอนมีคนเปิดแอปครั้งถัดไปหลังเลยกำหนดเท่านั้น)
var _stockExpiryLastChecked = '';
function stockProcessExpiredBookings() {
  var today = _nw().substring(0, 10);
  if (_stockExpiryLastChecked === today) return;
  _stockExpiryLastChecked = today;
  var locsByCode = {};
  getStockLocations().forEach(function(l) { locsByCode[l.code] = l; });
  getAllProducts().filter(function(p) { return p && p.sku; }).forEach(function(p) {
    var lots = stockGetLots(p.sku);
    lots.forEach(function(lot) {
      if (!lot.bookingExpiryDate || !_stockIsActiveLot(lot)) return;
      var loc = locsByCode[lot.location];
      if (!loc || !loc.bookingExpiry || loc.bookingExpiry === 'none') return;
      if (lot.bookingExpiryDate >= today) return; // ยังไม่ถึงกำหนด
      var penalty = loc.bookingExpiry === 'penalty';
      stockMoveLot(p.sku, p.name, lot.id, lot.qty, '0001', {
        note: penalty ? 'หมดเวลาจอง (' + loc.name + ') — มีค่าธรรมเนียม' : 'หมดเวลาจอง (' + loc.name + ')'
      });
    });
  });
}

// เมื่อทุกบรรทัดสินค้าของ SO นี้ถูกจอง+ส่งมอบครบตามจำนวนแล้ว ถามก่อนว่าจะอัปเดตสถานะ SO (และ Pipeline ถ้าผูกไว้) เป็นส่งมอบแล้วไหม
// ไม่ auto เงียบๆ — ให้ผู้ใช้กดยืนยันเอง เพราะ SO มีหลายบรรทัด ต้องครบทุกบรรทัดถึงจะถือว่า SO นี้ส่งมอบเสร็จจริง
function _stockCheckSOFullyDelivered(soId) {
  var so = ST.getOne('salesOrders', soId);
  if (!so || !so.items || !so.items.length) return;
  var allDelivered = so.items.every(function(it) {
    if (!it.sku) return false;
    var deliveredQty = stockGetLots(it.sku).filter(function(l) {
      return l.location === '1021' && l.soId === soId && l.status === 'ส่งมอบแล้ว';
    }).reduce(function(s, l) { return s + (Number(l.qty) || 0); }, 0);
    return deliveredQty >= (Number(it.qty) || 0);
  });
  if (!allDelivered) return;

  var pipe = so.pipelineId ? ST.getOne('pipeline', so.pipelineId) : null;
  var msg = 'ทุกรายการของ SO ' + (so.soNumber || '') + ' ส่งมอบครบแล้ว\nต้องการอัปเดตสถานะ SO' + (pipe ? ' และ Pipeline' : '') + ' เป็นส่งมอบแล้วไหม?';
  if (!confirm(msg)) return;

  if (typeof showSOStatusModal === 'function') showSOStatusModal(soId);

  if (pipe) {
    var cfg = getConfig();
    var deliverStatus = (cfg.pipelineStatuses || []).filter(function(s) {
      return /deliver|ส่งมอบ/i.test(s.name || '') || /deliver/i.test(s.id || '');
    })[0];
    if (deliverStatus && typeof changePipeStatus === 'function') changePipeStatus(pipe.id, deliverStatus.id);
    else if (!deliverStatus) toast('⚠️ ไม่พบสถานะ Pipeline "Deliver" ในระบบ ข้ามการอัปเดต Pipeline');
  }
}

// แก้ไขจำนวน/รายละเอียดของ lot ที่กรอกผิด (ไม่ใช่การย้ายคลัง) — log เป็น adjust ถ้าจำนวนเปลี่ยน
function stockUpdateLot(sku, productName, lotId, fields) {
  var lots = stockGetLots(sku).slice();
  var idx = lots.findIndex(function(l) { return l.id === lotId; });
  if (idx === -1) return;
  var before = Number(lots[idx].qty) || 0;
  var after = fields.qty !== undefined ? Math.max(0, Math.round(Number(fields.qty) || 0)) : before;
  lots[idx] = Object.assign({}, lots[idx], fields, { qty: after });
  _stockSaveLots(sku, productName, lots);
  if (after !== before) {
    ST.add('stockLog', {
      sku: sku, productName: productName, locationCode: lots[idx].location, locationName: stockLocationName(lots[idx].location),
      before: before, after: after, delta: after - before, source: 'app', note: 'แก้ไขรายการ', date: _nw(), type: 'adjust'
    });
  }
}

// ลบ lot ที่เผลอกรอกผิดทิ้งทั้งรายการ
function stockDeleteLot(sku, lotId) {
  if (!confirm('ลบรายการนี้ทิ้ง?\nใช้ตอนกรอกผิดเท่านั้น ไม่สามารถกู้คืนได้')) return;
  var p = getProductBySku(sku);
  var productName = p ? p.name : sku;
  var lots = stockGetLots(sku).slice();
  var idx = lots.findIndex(function(l) { return l.id === lotId; });
  if (idx === -1) return;
  var removed = lots[idx];
  lots.splice(idx, 1);
  _stockSaveLots(sku, productName, lots);
  ST.add('stockLog', {
    sku: sku, productName: productName, locationCode: removed.location, locationName: stockLocationName(removed.location),
    before: Number(removed.qty) || 0, after: 0, delta: -(Number(removed.qty) || 0), source: 'app', note: 'ลบรายการที่กรอกผิด', date: _nw(), type: 'adjust'
  });
  toast('🗑️ ลบแล้ว');
  render();
}

function showStockEditLotM(sku, lotId) {
  var p = getProductBySku(sku);
  var lots = stockGetLots(sku);
  var lot = lots.filter(function(l) { return l.id === lotId; })[0];
  if (!p || !lot) return;
  var isBooking = lot.location === '1021';
  var isPRPO = lot.location === 'PRPO';
  var isQI = lot.location === 'QI';
  var body = '<div class="fg"><label>จำนวน</label><input type="number" id="elot_qty" min="0" value="' + lot.qty + '"></div>';
  if (isBooking) {
    body += _stockSODatalistHtml();
    body += '<div class="fg"><label>SO No.</label><input type="text" id="elot_so" list="stockSODL" oninput="stockSOInputChanged(this,\'elot\')" data-so-id="' + sanitize(lot.soId || '') + '" value="' + sanitize(lot.soNumber || lot.ref || '') + '"></div>';
    body += '<div class="fg"><label>เซลที่จอง</label><input type="text" id="elot_sales" value="' + sanitize(lot.salesperson || '') + '"></div>';
    body += '<div class="fg"><label>Dealer</label><input type="text" id="elot_dealer" value="' + sanitize(lot.dealerName || '') + '"></div>';
    body += '<div class="fg"><label>โครงการ</label><input type="text" id="elot_project" value="' + sanitize(lot.projectName || '') + '"></div>';
    body += '<div class="fg"><label>สถานะ</label><select id="elot_status">' + STOCK_BOOKING_STATUSES.map(function(st) { return '<option' + (st === lot.status ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select></div>';
  } else if (isPRPO) {
    body += '<div class="fg"><label>อ้างอิง (PO)</label><input type="text" id="elot_ref" value="' + sanitize(lot.ref || '') + '"></div>';
    body += _stockSODatalistHtml();
    body += '<div class="fg"><label>ผูก SO <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="elot_so" list="stockSODL" oninput="stockSOInputChanged(this,\'elot\')" data-so-id="' + sanitize(lot.soId || '') + '" value="' + sanitize(lot.soNumber || '') + '"></div>';
    body += '<div class="fg"><label>คาดว่าจะถึง</label><input type="date" id="elot_expected" value="' + sanitize(lot.expectedDate || '') + '"></div>';
    body += '<div class="fg"><label>หมายเหตุ</label><input type="text" id="elot_note" value="' + sanitize(lot.note || '') + '"></div>';
  } else if (isQI) {
    body += '<div class="fg"><label>อ้างอิง (PO)</label><input type="text" id="elot_ref" value="' + sanitize(lot.ref || '') + '"></div>';
    body += _stockQIFieldsHtml('elot', lot);
    body += '<div class="fg"><label>หมายเหตุ / เลขอ้างอิงการลงทะเบียน</label><input type="text" id="elot_note" value="' + sanitize(lot.note || '') + '"></div>';
    if (!lot.registrationComplete) {
      body += '<button class="btn bo btn-full" style="margin-top:4px" onclick="closeMForce();stockMarkRegistrationComplete(\'' + sku + '\',\'' + sanitize(p.name || '').replace(/'/g, "\\'") + '\',\'' + lotId + '\')">✅ ขึ้นทะเบียนสำเร็จ</button>';
    }
  } else {
    body += '<div class="fg"><label>อ้างอิง (PR/PO)</label><input type="text" id="elot_ref" value="' + sanitize(lot.ref || '') + '"></div>';
    body += '<div class="fg"><label>หมายเหตุ</label><input type="text" id="elot_note" value="' + sanitize(lot.note || '') + '"></div>';
    if (lot.qiPending) {
      body += '<button class="btn bo btn-full" style="margin-top:4px" onclick="closeMForce();stockMarkRegistrationComplete(\'' + sku + '\',\'' + sanitize(p.name || '').replace(/'/g, "\\'") + '\',\'' + lotId + '\')">✅ ขึ้นทะเบียนสำเร็จ (ปลดป้ายเตือน)</button>';
    }
  }
  var elLoc = getStockLocations().filter(function(l) { return l.code === lot.location; })[0];
  if (elLoc && elLoc.bookingExpiry && elLoc.bookingExpiry !== 'none') {
    body += '<div class="fg"><label>จองถึงวันที่ <small style="color:var(--text2)">(' + (elLoc.bookingExpiry === 'penalty' ? 'เลื่อนได้ ไม่งั้นโดนหักค่าธรรมเนียม' : 'เลื่อนไม่ได้') + ')</small></label><input type="date" id="elot_bexp" value="' + sanitize(lot.bookingExpiryDate || '') + '"></div>';
  }
  body += '<div style="display:flex;gap:8px;margin-top:8px">';
  body += '<button class="btn bp" style="flex:1" onclick="saveStockEditLot(\'' + sku + '\',\'' + lotId + '\')">💾 บันทึก</button>';
  body += '<button class="btn bd" onclick="closeMForce();stockDeleteLot(\'' + sku + '\',\'' + lotId + '\')">🗑️ ลบรายการนี้</button>';
  body += '</div>';
  openM('✏️ แก้ไขรายการ', body);
}

function saveStockEditLot(sku, lotId) {
  var p = getProductBySku(sku);
  if (!p) return;
  var lots = stockGetLots(sku);
  var lot = lots.filter(function(l) { return l.id === lotId; })[0];
  if (!lot) return;
  var qty = document.getElementById('elot_qty').value;
  var fields = { qty: qty };
  if (lot.location === '1021') {
    var soEl = document.getElementById('elot_so');
    var so = soEl.value.trim();
    fields.soNumber = so; fields.ref = so;
    fields.soId = soEl.dataset.soId || '';
    fields.salesperson = document.getElementById('elot_sales').value.trim();
    fields.dealerName = document.getElementById('elot_dealer').value.trim();
    fields.projectName = document.getElementById('elot_project').value.trim();
    fields.status = document.getElementById('elot_status').value;
  } else if (lot.location === 'PRPO') {
    fields.ref = document.getElementById('elot_ref').value.trim();
    var prpoSoEl = document.getElementById('elot_so');
    fields.soNumber = prpoSoEl.value.trim();
    fields.soId = prpoSoEl.dataset.soId || '';
    fields.expectedDate = document.getElementById('elot_expected').value;
    fields.note = document.getElementById('elot_note').value.trim();
  } else if (lot.location === 'QI') {
    fields.ref = document.getElementById('elot_ref').value.trim();
    fields.submittedDate = document.getElementById('elot_submitted').value;
    fields.estimateDays = document.getElementById('elot_estimate').value;
    fields.expectedCompleteDate = document.getElementById('elot_expected').value;
    fields.note = document.getElementById('elot_note').value.trim();
  } else {
    fields.ref = document.getElementById('elot_ref').value.trim();
    fields.note = document.getElementById('elot_note').value.trim();
  }
  var bexpEl = document.getElementById('elot_bexp');
  if (bexpEl) fields.bookingExpiryDate = bexpEl.value;
  stockUpdateLot(sku, p.name, lotId, fields);
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

// สีเน้นต่อคลังหลัก — เดาจากชื่อให้ดูสอดคล้อง (Main Warehouse = ฟ้า, QI = ม่วง) คลังใหม่ที่เพิ่มเองจะวนสีจากพาเลตนี้
function _stockWarehouseColor(name) {
  if (/main warehouse/i.test(name)) return '#2563eb';
  if (/^QI/i.test(name)) return '#7c3aed';
  if (/PR\/PO/i.test(name)) return '#d97706';
  var palette = ['#0d9488', '#db2777', '#d97706', '#059669', '#dc2626'];
  var hash = 0;
  for (var i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function _stockLocationIcon(code) {
  if (code === '0001') return '📦';
  if (code === '1021') return '🔖';
  if (code === '1027') return '🗑️';
  if (code === 'QI') return '🛂';
  if (code === 'PRPO') return '🛒';
  return '📍';
}

function showStockAddLocationM() {
  var existingWarehouses = getStockLocations().map(function(l) { return l.warehouse; })
    .filter(function(v, i, arr) { return arr.indexOf(v) === i; });
  var body = '<div class="fg"><label>รหัสคลัง (โค้ด)</label><input type="text" id="loc_code" placeholder="เช่น 1030"></div>';
  body += '<div class="fg"><label>ชื่อคลัง</label><input type="text" id="loc_name" placeholder="เช่น Returned Goods"></div>';
  body += '<div class="fg"><label>อยู่ภายใต้คลังหลัก</label><input type="text" id="loc_warehouse" list="loc_wh_dl" placeholder="เช่น 1001 SiS Main Warehouse">' +
    '<datalist id="loc_wh_dl">' + existingWarehouses.map(function(w) { return '<option value="' + sanitize(w) + '">'; }).join('') + '</datalist></div>';
  body += '<div class="fg"><label><input type="checkbox" id="loc_sellable"> นับเป็น "พร้อมขาย"</label></div>';
  body += '<div class="fg"><label>กำหนดจอง</label><select id="loc_expiry">' +
    '<option value="none">ไม่มีกำหนด (จองไว้ได้เรื่อยๆ)</option>' +
    '<option value="penalty">มีกำหนด — เลื่อนได้ แต่โดนหักค่าธรรมเนียมถ้าไม่เลื่อน</option>' +
    '<option value="free">มีกำหนด — เลื่อนไม่ได้ ไม่มีค่าธรรมเนียม</option>' +
    '</select></div>';
  body += '<button class="btn bp btn-full" onclick="saveStockAddLocation()">💾 บันทึก</button>';
  openM('🏢 เพิ่มคลังย่อยใหม่', body);
}

function saveStockAddLocation() {
  var code = document.getElementById('loc_code').value;
  var name = document.getElementById('loc_name').value;
  var warehouse = document.getElementById('loc_warehouse').value;
  var sellable = document.getElementById('loc_sellable').checked;
  var bookingExpiry = document.getElementById('loc_expiry').value;
  if (!stockAddLocationDef(code, name, sellable, warehouse, bookingExpiry)) return;
  closeMForce();
  toast('🏢 เพิ่มคลังแล้ว');
  render();
}

function showStockEditLocationM(code) {
  var loc = getStockLocations().filter(function(l) { return l.code === code; })[0];
  if (!loc) return;
  var existingWarehouses = getStockLocations().map(function(l) { return l.warehouse; })
    .filter(function(v, i, arr) { return arr.indexOf(v) === i; });
  var body = '<div class="fg"><label>รหัสคลัง (โค้ด)</label><input type="text" value="' + sanitize(code) + '" disabled></div>';
  body += '<div class="fg"><label>ชื่อคลัง</label><input type="text" id="eloc_name" value="' + sanitize(loc.name) + '"></div>';
  body += '<div class="fg"><label>อยู่ภายใต้คลังหลัก</label><input type="text" id="eloc_warehouse" list="loc_wh_dl" value="' + sanitize(loc.warehouse) + '">' +
    '<datalist id="loc_wh_dl">' + existingWarehouses.map(function(w) { return '<option value="' + sanitize(w) + '">'; }).join('') + '</datalist></div>';
  body += '<div class="fg"><label><input type="checkbox" id="eloc_sellable"' + (loc.sellable ? ' checked' : '') + '> นับเป็น "พร้อมขาย"</label></div>';
  var curExpiry = loc.bookingExpiry || 'none';
  body += '<div class="fg"><label>กำหนดจอง</label><select id="eloc_expiry">' +
    '<option value="none"' + (curExpiry === 'none' ? ' selected' : '') + '>ไม่มีกำหนด (จองไว้ได้เรื่อยๆ)</option>' +
    '<option value="penalty"' + (curExpiry === 'penalty' ? ' selected' : '') + '>มีกำหนด — เลื่อนได้ แต่โดนหักค่าธรรมเนียมถ้าไม่เลื่อน</option>' +
    '<option value="free"' + (curExpiry === 'free' ? ' selected' : '') + '>มีกำหนด — เลื่อนไม่ได้ ไม่มีค่าธรรมเนียม</option>' +
    '</select></div>';
  body += '<button class="btn bp btn-full" onclick="saveStockEditLocation(\'' + code + '\')">💾 บันทึก</button>';
  openM('✏️ แก้ไขคลัง ' + sanitize(code), body);
}

function saveStockEditLocation(code) {
  var name = document.getElementById('eloc_name').value;
  var warehouse = document.getElementById('eloc_warehouse').value;
  var sellable = document.getElementById('eloc_sellable').checked;
  var bookingExpiry = document.getElementById('eloc_expiry').value;
  if (!stockUpdateLocationDef(code, name, sellable, warehouse, bookingExpiry)) return;
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

// เข้ากันได้กับของเดิม (Import Excel) — ใช้ lot คงที่ id 'import_0001' อัปเดตซ้ำได้ทุกครั้งที่ import ไม่สร้าง lot ซ้ำ
function setStockQty(sku, productName, newQty, source, note) {
  if (!sku) return;
  newQty = Math.max(0, Math.round(Number(newQty) || 0));
  var lots = stockGetLots(sku).slice();
  var idx = lots.findIndex(function(l) { return l.id === 'import_0001'; });
  var before = idx !== -1 ? (Number(lots[idx].qty) || 0) : 0;
  if (idx !== -1) {
    if (newQty > 0) lots[idx] = Object.assign({}, lots[idx], { qty: newQty, dateIn: _nw() });
    else lots.splice(idx, 1);
  } else if (newQty > 0) {
    lots.push({ id: 'import_0001', location: '0001', ref: '(Import Excel)', qty: newQty, dateIn: _nw(), note: note || '' });
  }
  _stockSaveLots(sku, productName, lots);
  if (newQty !== before) {
    ST.add('stockLog', {
      sku: sku, productName: productName, locationCode: '0001', locationName: stockLocationName('0001'),
      before: before, after: newQty, delta: newQty - before, source: source || 'app', note: note || '', date: _nw(), type: 'adjust'
    });
  }
}

function stockToggleCategory(catId) {
  var i = stockCategoryFilters.indexOf(catId);
  if (i === -1) stockCategoryFilters.push(catId);
  else stockCategoryFilters.splice(i, 1);
  render();
}

function _stockSourceLabel(s) {
  if (s === 'import') return '📤 Import Excel';
  if (s === 'admin_link') return '🔗 ลิงก์ Admin';
  return '✏️ แก้ไขในแอป';
}

// สินค้าค้างนาน — นับอายุเป็นระดับ lot (dateIn ของ lot นั้นเทียบวันนี้) ไม่ใช่ระดับ SKU เพราะแต่ละ lot เข้าคลังคนละวัน
// lot ที่ถูกย้ายคลัง (fromLocation) จะนับอายุใหม่ตั้งแต่วันที่ย้ายเข้า ไม่สืบอายุจาก lot ต้นทาง — ไม่รวม PRPO (ยังไม่ถึงจริง) และ lot ที่ส่งมอบแล้ว
function stockAgingLots(thresholdDays) {
  var now = Date.now();
  var result = [];
  getAllProducts().filter(function(p) { return p && p.sku; }).forEach(function(p) {
    stockGetLots(p.sku).forEach(function(l) {
      if (l.location === 'PRPO' || !_stockIsActiveLot(l)) return;
      var inTime = new Date(l.dateIn).getTime();
      if (isNaN(inTime)) return;
      var days = Math.floor((now - inTime) / 86400000);
      if (days >= thresholdDays) {
        result.push({
          sku: p.sku, productName: p.name, ref: l.ref || l.soNumber || '-', location: l.location,
          qty: Number(l.qty) || 0, days: days, value: (Number(l.qty) || 0) * (Number(p.cost) || 0)
        });
      }
    });
  });
  result.sort(function(a, b) { return b.days - a.days; });
  return result;
}

function rStock(el) {
  stockProcessExpiredBookings();
  document.getElementById('pgT').textContent = '📦 Stock สินค้า';
  var products = getAllProducts().filter(function(p) { return !!p; }); // รวมทุกสินค้ารวมถึง Bundle — Bundle บางตัว (เช่น Extended Warranty) มี SKU ของตัวเองและต้องนับ stock แยก
  var levelMap = {};
  ST.getAll('stockLevels').forEach(function(l) { levelMap[l.sku] = l; });

  var rows = products.map(function(p) {
    var lvl = p.sku ? levelMap[p.sku] : null;
    var lots = p.sku ? stockGetLots(p.sku) : [];
    return {
      product: p,
      lots: lots,
      qty: stockTotalQty(lots), // คงเหลือรวมทุกคลังย่อย
      sellable: stockSellableQty(lots), // พร้อมขายจริง (เฉพาะคลังที่ flag sellable)
      hasLevel: !!lvl,
      orderType: (lvl && lvl.orderType) || 'order',
      updatedAt: lvl ? (lvl.updated || lvl.created) : null,
      updatedBy: lvl ? (lvl.updatedBy || '') : '',
      source: lvl ? lvl.source : ''
    };
  });

  // นับใกล้หมด/หมดสต็อก จากจำนวน "พร้อมขาย" เท่านั้น (ไม่รวมของติดจอง/ดาเมจ/รอขึ้นทะเบียน) และเฉพาะสินค้าประเภท Stock
  var stockRows = rows.filter(function(r) { return r.orderType === 'stock'; });
  var totalCount = rows.length;
  var lowCount = stockRows.filter(function(r) { return r.sellable > 0 && r.sellable < STOCK_LOW_THRESHOLD; }).length;
  var outCount = stockRows.filter(function(r) { return r.sellable <= 0; }).length;

  if (stockSearch) {
    var q = stockSearch.toLowerCase();
    rows = rows.filter(function(r) {
      return (r.product.name || '').toLowerCase().indexOf(q) !== -1 || (r.product.sku || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  if (stockCategoryFilters.length) rows = rows.filter(function(r) { return stockCategoryFilters.indexOf(r.product.category) !== -1; });
  if (stockFavOnly) rows = rows.filter(function(r) { return isStockFav(r.product.sku); });
  if (stockTypeFilter !== 'all') rows = rows.filter(function(r) { return r.orderType === stockTypeFilter; });
  if (stockLowFilter === 'low') rows = rows.filter(function(r) { return r.orderType === 'stock' && r.sellable > 0 && r.sellable < STOCK_LOW_THRESHOLD; });
  else if (stockLowFilter === 'out') rows = rows.filter(function(r) { return r.orderType === 'stock' && r.sellable <= 0; });

  rows.sort(function(a, b) { return (a.product.name || '').localeCompare(b.product.name || ''); });

  var h = '<div class="card"><h2>📦 Stock สินค้า <span class="ml">' +
    '<button class="btn bsm bo" onclick="showStockAddLocationM()" title="เพิ่มโค้ดคลังย่อยใหม่ (ใช้ร่วมกันทุก SKU)">🏢 เพิ่มคลัง</button>' +
    '<button class="btn bsm bo" onclick="document.getElementById(\'stockImportFile\').click()">📤 Import Excel</button>' +
    '<input type="file" id="stockImportFile" accept=".xlsx,.xls" style="display:none" onchange="importStockFromExcel(event)">' +
    '<button class="btn bsm ' + (stockShowLog ? 'bp' : 'bo') + '" onclick="stockShowLog=!stockShowLog;render()">📜 ประวัติ</button>' +
    '<button class="btn bsm ' + (stockShowAging ? 'bp' : 'bo') + '" onclick="stockShowAging=!stockShowAging;render()">📅 ค้างนาน</button>' +
    '</span></h2>';

  h += '<div class="hint" style="margin-bottom:10px">📌 Phase 1 — แก้จำนวนเองในแอป หรือ Import Excel เท่านั้น (ยังไม่มีลิงก์ให้ Admin ภายนอกกรอกเอง)</div>';

  h += '<div class="sr" style="margin-bottom:10px">';
  h += '<div class="sc" style="cursor:pointer' + (stockLowFilter === 'all' ? ';border-color:var(--accent)' : '') + '" onclick="stockLowFilter=\'all\';render()"><div class="sn c1">' + totalCount + '</div><div class="sl">สินค้าทั้งหมด</div></div>';
  h += '<div class="sc" style="cursor:pointer' + (stockLowFilter === 'low' ? ';border-color:var(--accent)' : '') + '" onclick="stockLowFilter=\'low\';render()"><div class="sn c3">' + lowCount + '</div><div class="sl">ใกล้หมด (&lt;' + STOCK_LOW_THRESHOLD + ')</div></div>';
  h += '<div class="sc" style="cursor:pointer' + (stockLowFilter === 'out' ? ';border-color:var(--accent)' : '') + '" onclick="stockLowFilter=\'out\';render()"><div class="sn c4">' + outCount + '</div><div class="sl">หมดสต็อก</div></div>';
  h += '</div>';

  h += '<div style="margin-bottom:10px">';
  h += '<input type="text" id="stockSrc" value="' + sanitize(stockSearch) + '" placeholder="🔍 ค้นหาสินค้า/SKU" style="width:100%" oninput="stockSearch=this.value;render()" autocomplete="off">';
  h += '</div>';

  var favCount = ST.getAll('stockFavs').length;
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
  h += '<button class="btn bsm ' + (!stockCategoryFilters.length && !stockFavOnly ? 'bp' : 'bo') + '" onclick="stockCategoryFilters=[];stockFavOnly=false;render()">📂 ทุกหมวด</button>';
  h += '<button class="btn bsm ' + (stockFavOnly ? 'bp' : 'bo') + '" onclick="stockFavOnly=!stockFavOnly;render()">⭐ Favorite (' + favCount + ')</button>';
  (typeof PRODUCT_CATEGORIES !== 'undefined' ? PRODUCT_CATEGORIES : []).forEach(function(c) {
    h += '<button class="btn bsm ' + (stockCategoryFilters.indexOf(c.id) !== -1 ? 'bp' : 'bo') + '" onclick="stockToggleCategory(\'' + c.id + '\')">' + sanitize(c.name) + '</button>';
  });
  if (stockLowFilter !== 'all') h += '<button class="btn bsm bo" onclick="stockLowFilter=\'all\';render()">✕ ล้างตัวกรองสถานะ</button>';
  h += '</div>';

  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">';
  h += '<span style="font-size:11px;color:var(--text2)">ประเภท:</span>';
  h += '<button class="btn bsm ' + (stockTypeFilter === 'all' ? 'bp' : 'bo') + '" onclick="stockTypeFilter=\'all\';render()">ทั้งหมด</button>';
  h += '<button class="btn bsm ' + (stockTypeFilter === 'stock' ? 'bp' : 'bo') + '" onclick="stockTypeFilter=\'stock\';render()">📦 Stock</button>';
  h += '<button class="btn bsm ' + (stockTypeFilter === 'order' ? 'bp' : 'bo') + '" onclick="stockTypeFilter=\'order\';render()">🛒 By order</button>';
  h += '</div>';

  if (!rows.length) {
    h += '<div class="empty"><div class="icon">📦</div><p>ไม่พบสินค้า' + (stockSearch ? ' ที่ตรงกับ "' + sanitize(stockSearch) + '"' : '') + '</p></div>';
  } else {
    h += '<div class="export-wrap"><table class="export-table" style="width:100%"><thead><tr>' +
      '<th></th><th></th><th>SKU</th><th>สินค้า</th><th>หมวดหมู่</th><th>ประเภท</th><th style="text-align:center">คงเหลือรวม</th><th style="text-align:center">พร้อมขาย</th><th>อัปเดตล่าสุด</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r) {
      var p = r.product;
      var fav = isStockFav(p.sku);
      var isStockType = r.orderType === 'stock';
      var expanded = !!stockExpanded[p.sku];
      var rowStyle = isStockType ? (r.sellable <= 0 ? 'background:rgba(239,68,68,.08)' : (r.sellable < STOCK_LOW_THRESHOLD ? 'background:rgba(245,158,11,.08)' : '')) : '';
      h += '<tr style="' + rowStyle + '">';
      h += '<td style="text-align:center">' + (isStockType && p.sku ?
        '<span style="cursor:pointer;color:var(--text2)" onclick="stockToggleExpand(\'' + p.sku + '\')" title="ดูสรุปคลังย่อย">' + (expanded ? '▾' : '▸') + '</span>' :
        '') + '</td>';
      h += '<td style="text-align:center">' + (p.sku ?
        '<span style="cursor:pointer;font-size:15px" onclick="toggleStockFav(\'' + p.sku + '\',\'' + sanitize(p.name || '').replace(/'/g, "\\'") + '\')" title="' + (fav ? 'เอาออกจาก Favorite' : 'เพิ่มเป็น Favorite') + '">' + (fav ? '⭐' : '☆') + '</span>' :
        '') + '</td>';
      h += '<td style="font-size:11px">' + (p.sku ? qcopyHtml(p.sku) : '<span style="color:var(--text2)" title="ไม่มี SKU ตั้งค่า Stock ไม่ได้">-</span>') + '</td>';
      var eolBadge = '';
      if (p.eol) {
        eolBadge = r.sellable > 0 ?
          ' <span style="font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(245,158,11,.15);color:#b45309" title="เลิกผลิตแล้ว แต่ยังมีของเหลือขายได้">EOL</span>' :
          ' <span style="font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(107,114,128,.2);color:#6b7280" title="เลิกผลิตแล้วและหมดสต็อก">⛔ EOL หมด</span>';
      }
      h += '<td>' + (p.sku ?
        '<a href="#" onclick="go(\'stockDetail\',{sku:\'' + p.sku + '\'});return false">' + sanitize(p.name || '-') + '</a>' :
        sanitize(p.name || '-')) + eolBadge + '</td>';
      h += '<td>' + sanitize((typeof getCategoryName === 'function' ? getCategoryName(p.category) : p.category) || '-') + '</td>';
      h += '<td>' + (p.sku ?
        '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 8px;border-radius:999px;cursor:pointer;' +
          (isStockType ? 'background:rgba(34,197,94,.15);color:#16a34a' : 'background:rgba(245,158,11,.15);color:#b45309') +
          '" onclick="toggleStockOrderType(\'' + p.sku + '\',\'' + sanitize(p.name || '').replace(/'/g, "\\'") + '\')" title="กดเพื่อสลับประเภท">' +
          (isStockType ? '📦 Stock' : '🛒 By order') + '</span>' : '') + '</td>';
      h += '<td style="text-align:center">' + (isStockType ? r.qty : '<span style="color:var(--text2)">-</span>') + '</td>';
      h += '<td style="text-align:center">' + (isStockType ?
        '<span style="font-weight:700;color:' + (r.sellable <= 0 ? '#ef4444' : (r.sellable < STOCK_LOW_THRESHOLD ? '#b45309' : '#16a34a')) + '">' + r.sellable + '</span>' :
        '<span style="color:var(--text2)">-</span>') + '</td>';
      h += '<td style="font-size:11px;color:var(--text2)">' + (r.updatedAt ? fDT(r.updatedAt) + (r.updatedBy ? ' · ' + sanitize(r.updatedBy) : '') : '-') + '</td>';
      h += '</tr>';
      if (isStockType && expanded) {
        h += '<tr><td></td><td colspan="8" style="padding:0">' + stockLocationSummaryHtml(p) + '</td></tr>';
      }
    });
    h += '</tbody></table></div>';
    h += '<div style="font-size:.64rem;color:#64748b;margin-top:4px">' + rows.length + ' รายการ</div>';
  }

  if (stockShowAging) {
    var agingLots = stockAgingLots(stockAgingThreshold);
    var agingValue = agingLots.reduce(function(s, l) { return s + l.value; }, 0);
    h += '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">';
    h += '<h3 style="margin:0">📅 สินค้าค้างนาน</h3>';
    h += '<select onchange="stockAgingThreshold=Number(this.value);render()" style="font-size:12px">';
    [30, 60, 90, 120].forEach(function(d) { h += '<option value="' + d + '"' + (stockAgingThreshold === d ? ' selected' : '') + '>ค้างเกิน ' + d + ' วัน</option>'; });
    h += '</select>';
    h += '</div>';
    h += '<div class="sr" style="margin-bottom:10px">';
    h += '<div class="sc"><div class="sn c3">฿' + fmtMoney(Math.round(agingValue)) + '</div><div class="sl">มูลค่ารวม (lot ที่ค้าง)</div></div>';
    h += '<div class="sc"><div class="sn c4">' + agingLots.length + '</div><div class="sl">จำนวน lot ที่ค้าง</div></div>';
    h += '</div>';
    if (!agingLots.length) {
      h += '<div class="empty"><p>ไม่มีสินค้าค้างเกิน ' + stockAgingThreshold + ' วัน</p></div>';
    } else {
      h += '<div class="export-wrap"><table class="export-table" style="width:100%"><thead><tr>' +
        '<th>สินค้า</th><th>อ้างอิง</th><th>คลัง</th><th style="text-align:center">จำนวน</th><th style="text-align:right">ค้างมา</th>' +
        '</tr></thead><tbody>';
      agingLots.forEach(function(al) {
        h += '<tr>';
        h += '<td><a href="#" onclick="go(\'stockDetail\',{sku:\'' + al.sku + '\'});return false">' + sanitize(al.productName) + '</a></td>';
        h += '<td style="font-size:11px">' + sanitize(al.ref) + '</td>';
        h += '<td>' + sanitize(stockLocationName(al.location)) + '</td>';
        h += '<td style="text-align:center;font-weight:700">' + al.qty + '</td>';
        h += '<td style="text-align:right;font-weight:700;color:' + (al.days >= 120 ? '#ef4444' : (al.days >= 90 ? '#b45309' : '#64748b')) + '">' + al.days + ' วัน</td>';
        h += '</tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '</div>';
  }

  if (stockShowLog) {
    var logs = ST.getAll('stockLog').slice().sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 100);
    h += '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">';
    h += '<h3 style="margin-bottom:10px">📜 ประวัติการเปลี่ยนแปลง (100 รายการล่าสุด)</h3>';
    if (!logs.length) {
      h += '<div class="empty"><p>ยังไม่มีประวัติการเปลี่ยนแปลง</p></div>';
    } else {
      logs.forEach(function(l) {
        var isTransfer = l.type === 'transfer';
        h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border,#334155)">';
        if (isTransfer) {
          h += '<span style="font-size:16px;color:#3b82f6">↔</span>';
          h += '<div style="flex:1;min-width:0"><div style="font-size:13px">' + sanitize(l.productName || l.sku) + ' <span style="color:var(--text2);font-size:11px">(' + sanitize(l.sku) + ')</span></div>';
          h += '<div style="font-size:11px;color:var(--text2)">' + fDT(l.date) + ' · ย้าย ' + sanitize(l.locationName) + ' → ' + sanitize(l.toLocationName) + (l.note ? ' · ' + sanitize(l.note) : '') + '</div></div>';
          h += '<div style="text-align:right;flex-shrink:0"><div style="font-weight:700;color:#3b82f6">' + l.qty + '</div></div>';
        } else {
          var up = l.delta > 0;
          h += '<span style="font-size:16px;color:' + (up ? '#22c55e' : '#ef4444') + '">' + (up ? '▲' : '▼') + '</span>';
          h += '<div style="flex:1;min-width:0"><div style="font-size:13px">' + sanitize(l.productName || l.sku) + ' <span style="color:var(--text2);font-size:11px">(' + sanitize(l.sku) + (l.locationName ? ' · ' + sanitize(l.locationCode) + ' ' + sanitize(l.locationName) : '') + ')</span></div>';
          h += '<div style="font-size:11px;color:var(--text2)">' + fDT(l.date) + ' · ' + _stockSourceLabel(l.source) + (l.note ? ' · ' + sanitize(l.note) : '') + '</div></div>';
          h += '<div style="text-align:right;flex-shrink:0"><div style="font-weight:700;color:' + (up ? '#22c55e' : '#ef4444') + '">' + (up ? '+' : '') + l.delta + '</div>';
          h += '<div style="font-size:11px;color:var(--text2)">' + l.before + ' → ' + l.after + '</div></div>';
        }
        h += '</div>';
      });
    }
    h += '</div>';
  }

  h += '</div>';
  el.innerHTML = h;

  var srcEl = document.getElementById('stockSrc');
  if (srcEl && stockSearch) { srcEl.focus(); srcEl.setSelectionRange(stockSearch.length, stockSearch.length); }
}

// สรุปย่อคลังย่อยในหน้ารายการ (อ่านอย่างเดียว) — จัดการจริง (เพิ่ม/ย้าย lot) ทำในหน้ารายละเอียด
function stockLocationSummaryHtml(p) {
  var lots = stockGetLots(p.sku);
  var h = '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:4px 0 4px">';
  h += '<thead><tr>' +
    '<th style="text-align:left;padding:4px 4px 4px 30px;font-weight:400;color:var(--text2)">คลังย่อย</th>' +
    '<th style="text-align:center;padding:4px;font-weight:400;color:var(--text2)">จำนวน</th>' +
    '<th style="text-align:left;padding:4px;font-weight:400;color:var(--text2)">นับพร้อมขาย</th>' +
    '</tr></thead><tbody>';
  getStockLocations().forEach(function(loc) {
    var v = stockLocTotal(lots, loc.code);
    h += '<tr>';
    h += '<td style="padding:4px 4px 4px 30px">' + loc.code + ' ' + sanitize(loc.name) + '</td>';
    h += '<td style="text-align:center;padding:4px;font-weight:700">' + v + '</td>';
    h += '<td style="padding:4px">' + (loc.sellable ?
      '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(34,197,94,.15);color:#16a34a">ใช่</span>' :
      '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(107,114,128,.15);color:#6b7280">ไม่</span>') + '</td>';
    h += '</tr>';
  });
  h += '</tbody></table>';
  h += '<div style="padding:0 4px 10px 30px"><a href="#" onclick="go(\'stockDetail\',{sku:\'' + p.sku + '\'});return false" style="font-size:12px">📋 ดูรายละเอียด/จัดการคลัง →</a></div>';
  return h;
}

// ================================================================
// หน้ารายละเอียดสินค้า — ราคาแต่ละ Level + คลังย่อยแยกตาม warehouse + จัดการ lot (เพิ่ม/ย้าย)
// ================================================================
function rStockDetail(el) {
  stockProcessExpiredBookings();
  var sku = S.sku;
  var p = sku ? getProductBySku(sku) : null;
  if (!p) { el.innerHTML = '<div class="card"><button class="btn bo bsm" onclick="go(\'stock\')" style="margin-bottom:10px">← กลับ</button><div>ไม่พบสินค้านี้</div></div>'; return; }
  document.getElementById('pgT').textContent = '📦 ' + (p.name || 'สินค้า');

  var lots = stockGetLots(sku);
  var totalAll = stockTotalQty(lots);
  var sellable = stockSellableQty(lots);

  var h = '<button class="btn bo bsm" onclick="go(\'stock\')" style="margin-bottom:10px">← กลับ</button>';

  h += '<div class="card" style="margin-bottom:12px">';
  h += '<h2 style="margin:0 0 2px">' + sanitize(p.name || '-') + (p.eol ?
    (sellable > 0 ?
      ' <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,.15);color:#b45309;vertical-align:middle" title="เลิกผลิตแล้ว แต่ยังมีของเหลือขายได้">EOL</span>' :
      ' <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(107,114,128,.2);color:#6b7280;vertical-align:middle" title="เลิกผลิตแล้วและหมดสต็อก">⛔ EOL หมด</span>') : '') + '</h2>';
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:14px">' + (p.sku ? qcopyHtml(p.sku) : '-') + ' · ' + sanitize((typeof getCategoryName === 'function' ? getCategoryName(p.category) : p.category) || '-') + '</div>';
  h += '<div style="font-size:11px;color:var(--text2);margin-bottom:8px">ราคาตามเลเวล</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px">';
  [
    { label: 'RRP', value: p.rrpInVat || 0, accent: '#2563eb' },
    { label: 'Level S', value: (p.typePrices && p.typePrices.S) || 0, accent: '#16a34a' },
    { label: 'Level A', value: (p.typePrices && p.typePrices.A) || 0, accent: '#16a34a' },
    { label: 'Level B', value: (p.typePrices && p.typePrices.B) || 0, accent: '#16a34a' },
    { label: 'Other', value: (p.typePrices && p.typePrices.Other) || 0, accent: '#64748b' }
  ].forEach(function(lv) {
    h += '<div style="background:rgba(148,163,184,.08);border-left:3px solid ' + lv.accent + ';border-radius:8px;padding:8px 10px;position:relative">';
    h += '<div style="font-size:10px;color:' + lv.accent + ';font-weight:500">' + lv.label + '</div>';
    h += '<div style="font-size:15px;font-weight:700;margin-top:2px">฿' + fmtMoney(lv.value) + '</div>';
    h += '<button class="btn bsm bo" style="position:absolute;top:6px;right:6px;padding:1px 5px;font-size:10px;line-height:1.4" onclick="copyToClip(\'' + lv.value + '\')" title="คัดลอกราคา">📋</button>';
    h += '</div>';
  });
  h += '</div></div>';

  h += '<div class="sr" style="margin-bottom:12px">';
  h += '<div class="sc"><div class="sn c1">' + totalAll + '</div><div class="sl">คงเหลือรวม</div></div>';
  h += '<div class="sc"><div class="sn c2">' + sellable + '</div><div class="sl">พร้อมขาย</div></div>';
  h += '</div>';

  var queue = stockComputeQueue(sku);
  if (queue.length) {
    h += '<div class="card" style="margin-bottom:12px">';
    h += '<div style="font-size:12px;color:var(--text2);margin-bottom:2px">คิวจองลอยๆ (มีทั้งหมด ' + totalAll + ')</div>';
    h += '<div style="font-size:11px;color:var(--text2);margin-bottom:10px">เรียงตามเวลาที่กดจอง (มาก่อนได้ก่อน)</div>';
    h += '<div class="export-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px">';
    h += '<thead><tr>' +
      '<th style="text-align:left;padding:4px">#</th><th style="text-align:left;padding:4px">บริษัท</th><th style="text-align:left;padding:4px">เซล</th>' +
      '<th style="text-align:center;padding:4px">ต้องการ</th><th style="text-align:center;padding:4px">จัดสรร</th><th style="text-align:center;padding:4px">ขาด</th>' +
      '<th style="text-align:left;padding:4px">สถานะ</th><th></th>' +
      '</tr></thead><tbody>';
    queue.forEach(function(qe, qi) {
      var r = qe.reservation;
      var fullyOk = qe.shortfall <= 0;
      var partialOk = qe.allocated > 0 && qe.shortfall > 0;
      var noneOk = qe.allocated <= 0;
      var statusHtml = fullyOk ?
        '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(34,197,94,.15);color:#16a34a">ได้เต็ม</span>' :
        (partialOk ?
          '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,.15);color:#b45309">ได้บางส่วน</span><div style="font-size:11px;color:#ef4444;margin-top:3px">แนะนำ PR/PO ' + qe.shortfall + '</div>' :
          '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(239,68,68,.15);color:#ef4444">ต้อง PR/PO</span><div style="font-size:11px;color:#ef4444;margin-top:3px">แนะนำ PR/PO ' + qe.shortfall + '</div>');
      h += '<tr style="border-top:1px solid var(--border,#334155)">';
      h += '<td style="padding:5px 4px">' + (qi + 1) + '</td>';
      h += '<td style="padding:5px 4px">' + sanitize(r.dealerName || '-') + (r.quoteNo ? ' <span style="font-size:10px;color:var(--text2)">(' + sanitize(r.quoteNo) + ')</span>' : '') + '</td>';
      h += '<td style="padding:5px 4px">' + sanitize(r.salesperson || '-') + '</td>';
      h += '<td style="text-align:center;padding:5px 4px">' + r.qty + '</td>';
      h += '<td style="text-align:center;padding:5px 4px;font-weight:700;color:' + (noneOk ? 'var(--text2)' : (fullyOk ? '#16a34a' : '#b45309')) + '">' + qe.allocated + '</td>';
      h += '<td style="text-align:center;padding:5px 4px;font-weight:700;color:' + (qe.shortfall > 0 ? '#ef4444' : 'var(--text2)') + '">' + (qe.shortfall > 0 ? qe.shortfall : '-') + '</td>';
      h += '<td style="padding:5px 4px">' + statusHtml + '</td>';
      h += '<td style="padding:5px 4px;text-align:right"><button class="btn bsm bd" onclick="stockCancelReservationAndRefresh(\'' + r.id + '\');rStockDetail(document.getElementById(\'ct\'))">✕</button></td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    h += '</div>';
  }

  var allLocs = getStockLocations();
  var warehouses = [];
  allLocs.forEach(function(l) {
    var wh = warehouses.filter(function(w) { return w.name === l.warehouse; })[0];
    if (!wh) { wh = { name: l.warehouse, locs: [] }; warehouses.push(wh); }
    wh.locs.push(l);
  });

  // สรุปคลัง — กดเพื่อเลื่อนไปหัวข้อคลังนั้น เกิดขึ้นอัตโนมัติตามคลังที่มีจริง (เพิ่มคลังใหม่ก็ขึ้นกล่องเพิ่มเอง)
  h += '<div class="card" style="margin-bottom:12px">';
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">สรุปคลัง — กดเพื่อไปที่หัวข้อ</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">';
  allLocs.forEach(function(loc) {
    var locTotal = lots.filter(function(l) { return l.location === loc.code && _stockIsActiveLot(l); }).reduce(function(s, x) { return s + (Number(x.qty) || 0); }, 0);
    var accentC = loc.sellable ? '#16a34a' : '#64748b';
    var tintBg = loc.sellable ? 'rgba(34,197,94,.08)' : 'rgba(148,163,184,.08)';
    h += '<div style="background:' + tintBg + ';border-radius:8px;padding:10px;cursor:pointer;border-left:3px solid ' + accentC + '" ' +
      'onclick="var el=document.getElementById(\'stockloc-' + loc.code + '\');if(el)el.scrollIntoView({behavior:\'smooth\',block:\'center\'})">' +
      '<div style="font-size:11px;color:' + accentC + ';font-weight:500">' + _stockLocationIcon(loc.code) + ' ' + loc.code + '</div>' +
      '<div style="font-size:20px;font-weight:500;color:' + accentC + '">' + locTotal + '</div>' +
      '</div>';
  });
  h += '</div></div>';

  warehouses.forEach(function(wh) {
    var whColor = _stockWarehouseColor(wh.name);
    h += '<div class="card" style="margin-bottom:12px;border-left:4px solid ' + whColor + '">';
    h += '<h3 style="margin:0 0 10px;font-size:14px;color:' + whColor + '">🏢 ' + sanitize(wh.name) + '</h3>';

    // ลูกค้ารับสินค้าก่อนขึ้นทะเบียน กสทช. เสร็จ — เตือนไว้ให้เห็นชัดๆ ระดับคลังหลัก ถ้ามี lot แบบนี้ตกค้างอยู่
    var whCodes = wh.locs.map(function(l) { return l.code; });
    var hasQiPendingHere = lots.some(function(l) { return whCodes.indexOf(l.location) !== -1 && l.qiPending && !l.registrationComplete && _stockIsActiveLot(l); });
    if (hasQiPendingHere) {
      h += '<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:10px;margin-bottom:10px">' +
        '<div style="font-size:12px;color:#ef4444;font-weight:500">⚠️ มีสินค้าที่ยังขึ้นทะเบียนไม่สำเร็จอยู่ในคลังนี้ — ส่งมอบลูกค้าได้ แต่ยังบินไม่ได้จนกว่าจะขึ้นทะเบียนสำเร็จ</div></div>';
    }

    wh.locs.forEach(function(loc) {
      var locLots = lots.filter(function(l) { return l.location === loc.code; });
      var locTotal = locLots.filter(_stockIsActiveLot).reduce(function(s, x) { return s + (Number(x.qty) || 0); }, 0);
      var isBooking = loc.code === '1021';
      var isPRPO = loc.code === 'PRPO';
      var isQI = loc.code === 'QI';
      var tint = loc.sellable ? 'rgba(34,197,94,.08)' : 'rgba(148,163,184,.08)';
      var accentC = loc.sellable ? '#16a34a' : '#64748b';
      var nameEsc = sanitize(p.name || '').replace(/'/g, "\\'");
      h += '<div id="stockloc-' + loc.code + '" style="margin-bottom:14px;background:' + tint + ';border-radius:8px;padding:10px;scroll-margin-top:12px" ' +
        'ondragover="stockLotDragOver(event,\'' + accentC + '\')" ondragleave="stockLotDragLeave(event)" ondrop="stockLotDrop(event,\'' + loc.code + '\')">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px">';
      h += '<span style="font-size:13px;font-weight:700;color:' + accentC + '">' + _stockLocationIcon(loc.code) + ' ' + loc.code + ' ' + sanitize(loc.name) + '</span>';
      h += '<span style="font-size:16px;font-weight:700;color:' + accentC + '">' + locTotal + (loc.sellable ? ' <span style="font-size:10px;font-weight:400;padding:2px 6px;border-radius:999px;background:rgba(34,197,94,.15);color:#16a34a">พร้อมขาย</span>' : '') + '</span>';
      h += '<span>' +
        '<button class="btn bsm bo" onclick="showStockEditLocationM(\'' + loc.code + '\')" title="แก้ไขคลังนี้">✏️ คลัง</button> ' +
        '<button class="btn bsm bo" onclick="showStockAddLotM(\'' + sku + '\',\'' + loc.code + '\')">+ เพิ่ม lot</button>' +
        '</span>';
      h += '</div>';
      if (!locLots.length) {
        h += '<div style="font-size:12px;color:var(--text2);padding:8px 4px;text-align:center;border:1px dashed var(--border,#475569);border-radius:6px">ไม่มีสินค้าในคลังนี้ — ลากรายการมาวางที่นี่ได้</div>';
      } else {
        h += '<div class="export-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px;background:var(--card,transparent)">';
        h += '<colgroup><col style="width:22px"><col><col style="width:64px">' + (isBooking ? '<col><col><col><col>' : (isPRPO || isQI ? '<col><col>' : '<col>')) + '<col style="width:96px"></colgroup>';
        h += '<thead><tr>';
        h += isBooking ?
          '<th></th><th style="text-align:left;padding:4px">SO No.</th><th style="text-align:right;padding:4px">จำนวน</th><th style="text-align:left;padding:4px">เซล</th><th style="text-align:left;padding:4px">Dealer</th><th style="text-align:left;padding:4px">โครงการ</th><th style="text-align:left;padding:4px">สถานะ</th><th></th>' :
          (isPRPO ?
            '<th></th><th style="text-align:left;padding:4px">อ้างอิง (PO)</th><th style="text-align:right;padding:4px">จำนวน</th><th style="text-align:left;padding:4px">ผูก SO</th><th style="text-align:left;padding:4px">คาดว่าจะถึง</th><th></th>' :
            (isQI ?
              '<th></th><th style="text-align:left;padding:4px">อ้างอิง</th><th style="text-align:right;padding:4px">จำนวน</th><th style="text-align:left;padding:4px">ส่งลงทะเบียน</th><th style="text-align:left;padding:4px">คาดสำเร็จ</th><th></th>' :
              '<th></th><th style="text-align:left;padding:4px">อ้างอิง</th><th style="text-align:right;padding:4px">จำนวน</th><th style="text-align:left;padding:4px">วันที่</th><th></th>'));
        h += '</tr></thead><tbody>';
        locLots.forEach(function(lot) {
          var delivered = !_stockIsActiveLot(lot);
          var qtyCellHtml = '<span style="font-weight:700;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;font-variant-numeric:tabular-nums" title="กดเพื่อแก้ไขจำนวน" onclick="stockEditLotQtyInline(this,\'' + sku + '\',\'' + lot.id + '\',\'' + nameEsc + '\')">' + lot.qty + '</span>';
          h += '<tr style="border-top:1px solid var(--border,#334155);cursor:grab' + (delivered ? ';opacity:.55' : '') + '" draggable="true" ondragstart="stockLotDragStart(event,\'' + sku + '\',\'' + lot.id + '\')" title="' + (delivered ? 'ส่งมอบแล้ว — ไม่นับรวมในยอดคงเหลือ' : 'ลากไปวางที่คลังอื่นเพื่อย้าย') + '">';
          h += '<td style="padding:5px 4px;color:var(--text2)">⠿</td>';
          if (isBooking) {
            h += '<td style="padding:5px 4px">' + sanitize(lot.soNumber || lot.ref || '-') + '</td>';
            h += '<td style="text-align:right;padding:5px 4px">' + qtyCellHtml + '</td>';
            h += '<td style="padding:5px 4px">' + sanitize(lot.salesperson || '-') + '</td>';
            h += '<td style="padding:5px 4px">' + sanitize(lot.dealerName || '-') + '</td>';
            h += '<td style="padding:5px 4px">' + sanitize(lot.projectName || '-') + '</td>';
            h += '<td style="padding:5px 4px">' +
              '<select style="font-size:11px;padding:2px 4px" onchange="stockSetLotStatus(\'' + sku + '\',\'' + nameEsc + '\',\'' + lot.id + '\',this.value)" onclick="event.stopPropagation()">' +
              STOCK_BOOKING_STATUSES.map(function(st) { return '<option' + (st === lot.status ? ' selected' : '') + '>' + st + '</option>'; }).join('') +
              '</select></td>';
          } else if (isPRPO) {
            h += '<td style="padding:5px 4px">' + sanitize(lot.ref || '-') + '</td>';
            h += '<td style="text-align:right;padding:5px 4px">' + qtyCellHtml + '</td>';
            h += '<td style="padding:5px 4px">' + (lot.soNumber ? sanitize(lot.soNumber) : '<span style="color:var(--text2)">-</span>') + '</td>';
            h += '<td style="padding:5px 4px;' + (lot.expectedDate ? '' : 'color:var(--text2)') + '">' + (lot.expectedDate ? fD(lot.expectedDate) : '-') + '</td>';
          } else if (isQI) {
            var overdue = lot.expectedCompleteDate && !lot.registrationComplete && new Date(lot.expectedCompleteDate) < new Date();
            h += '<td style="padding:5px 4px">' + sanitize(lot.ref || '-') + '</td>';
            h += '<td style="text-align:right;padding:5px 4px">' + qtyCellHtml + '</td>';
            h += '<td style="padding:5px 4px;font-size:11px;color:var(--text2)">' + (lot.submittedDate ? fD(lot.submittedDate) : '-') + '</td>';
            h += '<td style="padding:5px 4px;font-size:11px;' + (overdue ? 'color:#ef4444' : 'color:var(--text2)') + '">' + (lot.expectedCompleteDate ? fD(lot.expectedCompleteDate) : '-') + (overdue ? ' (เลยกำหนด)' : '') + '</td>';
          } else {
            h += '<td style="padding:5px 4px">' + sanitize(lot.ref || '-') + '</td>';
            h += '<td style="text-align:right;padding:5px 4px">' + qtyCellHtml + '</td>';
            h += '<td style="padding:5px 4px">' + (lot.qiPending && !lot.registrationComplete ?
              '<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(239,68,68,.15);color:#ef4444" title="ลูกค้ารับสินค้าก่อนขึ้นทะเบียนเสร็จ">⚠️ ยังบินไม่ได้ — รอขึ้นทะเบียน</span>' :
              '<span style="font-size:11px;color:var(--text2)">' + fDT(lot.dateIn) + (lot.fromLocation ? ' · ย้ายจาก ' + sanitize(stockLocationName(lot.fromLocation)) : '') + '</span>') + '</td>';
          }
          var bexpHtml = '';
          if (lot.bookingExpiryDate && loc.bookingExpiry && loc.bookingExpiry !== 'none') {
            var bexpDays = Math.ceil((new Date(lot.bookingExpiryDate) - new Date(_nw().substring(0, 10))) / 86400000);
            var bexpOverdue = bexpDays < 0;
            var bexpColor = bexpOverdue ? '#ef4444' : (bexpDays <= 3 ? '#b45309' : '#16a34a');
            var bexpBg = bexpOverdue ? 'rgba(239,68,68,.15)' : (bexpDays <= 3 ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)');
            bexpHtml = '<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:' + bexpBg + ';color:' + bexpColor + '" title="จองถึง ' + fD(lot.bookingExpiryDate) + '">' +
              (bexpOverdue ? '⏰ เลยกำหนด ' + Math.abs(bexpDays) + ' วัน' : (bexpDays === 0 ? '⏰ วันนี้' : '⏳ อีก ' + bexpDays + ' วัน')) + '</span> ';
            if (loc.bookingExpiry === 'penalty') {
              bexpHtml += '<button class="btn bsm bo" onclick="showStockExtendBookingM(\'' + sku + '\',\'' + lot.id + '\')" title="เลื่อนกำหนดจอง">🔄 เลื่อน</button> ';
            }
          }
          h += '<td style="padding:5px 4px;text-align:right;white-space:nowrap">' +
            bexpHtml +
            (isQI && !lot.registrationComplete ? '<button class="btn bsm bp" onclick="stockMarkRegistrationComplete(\'' + sku + '\',\'' + nameEsc + '\',\'' + lot.id + '\')" title="ขึ้นทะเบียนสำเร็จแล้ว">✅ สำเร็จ</button> ' : '') +
            (!isQI && lot.qiPending && !lot.registrationComplete ? '<button class="btn bsm bp" onclick="stockMarkRegistrationComplete(\'' + sku + '\',\'' + nameEsc + '\',\'' + lot.id + '\')" title="ขึ้นทะเบียนสำเร็จแล้ว">✅ สำเร็จ</button> ' : '') +
            '<button class="btn bsm bo" onclick="showStockMoveLotM(\'' + sku + '\',\'' + lot.id + '\')">→ ย้ายคลัง</button> ' +
            '<button class="btn bsm bo" onclick="showStockEditLotM(\'' + sku + '\',\'' + lot.id + '\')" title="แก้ไข">✏️</button> ' +
            '<button class="btn bsm bd" onclick="stockDeleteLot(\'' + sku + '\',\'' + lot.id + '\')" title="ลบรายการนี้">🗑️</button>' +
            '</td>';
          h += '</tr>';
        });
        h += '</tbody></table></div>';
      }
      h += '</div>';
    });
    h += '</div>';
  });

  el.innerHTML = h;
}

// SO No. ผูกกับ SO จริงในระบบได้ (พิมพ์แล้วเลือกจาก dropdown) หรือพิมพ์ free text เองถ้ายังไม่มี SO
// เลือก SO จริงแล้วจะดึง Dealer/โครงการมาเติมให้อัตโนมัติ + เก็บ soId ไว้ผูกกับ SO นั้น เพื่อให้หน้า SO ขึ้นสถานะ "พร้อมส่ง" ได้ถูกต้อง
function _stockSODatalistHtml() {
  var list = ST.getAll('salesOrders');
  var h = '<datalist id="stockSODL">';
  list.forEach(function(s) {
    h += '<option value="' + sanitize(s.soNumber || '') + '" data-so-id="' + s.id + '">';
  });
  h += '</datalist>';
  return h;
}

function stockSOInputChanged(el, prefix) {
  var dl = document.getElementById('stockSODL');
  el.dataset.soId = '';
  if (!dl) return;
  var opts = Array.prototype.slice.call(dl.options);
  var match = opts.filter(function(o) { return o.value === el.value; })[0];
  if (!match) return;
  var so = ST.getOne('salesOrders', match.dataset.soId);
  if (!so) return;
  el.dataset.soId = so.id;
  var dealerEl = document.getElementById(prefix + '_dealer');
  if (dealerEl && !dealerEl.value) dealerEl.value = so.dealerName || '';
  var projEl = document.getElementById(prefix + '_project');
  if (projEl && !projEl.value && so.pipelineId) {
    var pipe = ST.getOne('pipeline', so.pipelineId);
    if (pipe) projEl.value = pipe.projectName || '';
  }
}

var STOCK_QI_DEFAULT_ESTIMATE_DAYS = 30; // ประมาณการคร่าวๆ ใช้คำนวณ "วันที่คาดว่าจะสำเร็จ" เริ่มต้น — ปรับ/แก้วันที่เองทีหลังได้เสมอ

// วันคาดสำเร็จ = วันที่ส่งลงทะเบียน + ประมาณการ(วัน) — คำนวณให้อัตโนมัติตอนแก้วันที่ส่ง/จำนวนวัน แต่ยังแก้ช่องวันที่คาดสำเร็จเองได้เสมอถ้าไม่ตรง
function stockQIRecalcExpected(prefix) {
  var subEl = document.getElementById(prefix + '_submitted');
  var estEl = document.getElementById(prefix + '_estimate');
  var expEl = document.getElementById(prefix + '_expected');
  if (!subEl || !estEl || !expEl || !subEl.value) return;
  var d = new Date(subEl.value);
  d.setDate(d.getDate() + (Number(estEl.value) || 0));
  expEl.value = d.toISOString().substring(0, 10);
}

function _stockQIFieldsHtml(prefix, lot) {
  lot = lot || {};
  var today = _nw().substring(0, 10);
  var submitted = lot.submittedDate || today;
  var days = lot.estimateDays || STOCK_QI_DEFAULT_ESTIMATE_DAYS;
  var expected = lot.expectedCompleteDate;
  if (!expected) {
    var d = new Date(submitted);
    d.setDate(d.getDate() + Number(days));
    expected = d.toISOString().substring(0, 10);
  }
  var h = '<div class="fg"><label>วันที่ส่งลงทะเบียน</label><input type="date" id="' + prefix + '_submitted" value="' + sanitize(submitted) + '" onchange="stockQIRecalcExpected(\'' + prefix + '\')"></div>';
  h += '<div class="fg"><label>ประมาณการ (วัน) <small style="color:var(--text2)">คำนวณวันคาดสำเร็จให้อัตโนมัติ</small></label><input type="number" id="' + prefix + '_estimate" value="' + days + '" onchange="stockQIRecalcExpected(\'' + prefix + '\')"></div>';
  h += '<div class="fg"><label>วันที่คาดว่าจะสำเร็จ <small style="color:var(--text2)">(แก้เองได้ถ้าไม่ตรง)</small></label><input type="date" id="' + prefix + '_expected" value="' + sanitize(expected) + '"></div>';
  return h;
}

function showStockAddLotM(sku, code) {
  var p = getProductBySku(sku);
  if (!p) return;
  var loc = getStockLocations().filter(function(l) { return l.code === code; })[0];
  var isBooking = code === '1021';
  var isPRPO = code === 'PRPO';
  var isQI = code === 'QI';
  var today = _nw().substring(0, 10);
  var body = '<div class="fg"><label>จำนวน</label><input type="number" id="lot_qty" min="1" value="1"></div>';
  if (isBooking) {
    body += _stockSODatalistHtml();
    body += '<div class="fg"><label>SO No. <small style="color:var(--text2)">(เลือกจาก SO จริงในระบบ หรือพิมพ์เองถ้ายังไม่มี)</small></label><input type="text" id="lot_so" list="stockSODL" oninput="stockSOInputChanged(this,\'lot\')"></div>';
    body += '<div class="fg"><label>วันที่จอง</label><input type="date" id="lot_date" value="' + today + '"></div>';
    body += '<div class="fg"><label>เซลที่จอง</label><input type="text" id="lot_sales" value="' + sanitize(_stockCurrentUserName()) + '"></div>';
    body += '<div class="fg"><label>Dealer</label><input type="text" id="lot_dealer"></div>';
    body += '<div class="fg"><label>โครงการ</label><input type="text" id="lot_project"></div>';
    body += '<div class="fg"><label>สถานะ</label><select id="lot_status">' + STOCK_BOOKING_STATUSES.map(function(s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>';
  } else if (isPRPO) {
    body += '<div class="fg"><label>อ้างอิง (PO)</label><input type="text" id="lot_ref"></div>';
    body += _stockSODatalistHtml();
    body += '<div class="fg"><label>ผูก SO <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="lot_so" list="stockSODL" oninput="stockSOInputChanged(this,\'lot\')"></div>';
    body += '<div class="fg"><label>คาดว่าจะถึง</label><input type="date" id="lot_expected"></div>';
    body += '<div class="fg"><label>หมายเหตุ <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="lot_note"></div>';
  } else if (isQI) {
    body += '<div class="fg"><label>อ้างอิง (PO)</label><input type="text" id="lot_ref"></div>';
    body += _stockQIFieldsHtml('lot', {});
    body += '<div class="fg"><label>หมายเหตุ / เลขอ้างอิงการลงทะเบียน <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="lot_note"></div>';
  } else {
    body += '<div class="fg"><label>อ้างอิง (PR/PO)</label><input type="text" id="lot_ref"></div>';
    body += '<div class="fg"><label>หมายเหตุ <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="lot_note"></div>';
  }
  if (loc && loc.bookingExpiry && loc.bookingExpiry !== 'none') {
    body += '<div class="fg"><label>จองถึงวันที่ <small style="color:var(--text2)">(' + (loc.bookingExpiry === 'penalty' ? 'เลื่อนได้ ไม่งั้นโดนหักค่าธรรมเนียม' : 'เลื่อนไม่ได้') + ')</small></label><input type="date" id="lot_bexp"></div>';
  }
  body += '<button class="btn bp btn-full" onclick="saveStockAddLot(\'' + sku + '\',\'' + code + '\')">💾 บันทึก</button>';
  openM('+ เพิ่มสินค้าเข้าคลัง ' + code + ' ' + sanitize(loc ? loc.name : ''), body);
}

function saveStockAddLot(sku, code) {
  var p = getProductBySku(sku);
  if (!p) return;
  var qty = document.getElementById('lot_qty').value;
  var bexpEl = document.getElementById('lot_bexp');
  var bexpVal = bexpEl ? bexpEl.value : '';
  if (code === '1021') {
    var soEl = document.getElementById('lot_so');
    var extra = {
      ref: soEl.value.trim(),
      soId: soEl.dataset.soId || '',
      bookedDate: document.getElementById('lot_date').value,
      salesperson: document.getElementById('lot_sales').value.trim(),
      dealerName: document.getElementById('lot_dealer').value.trim(),
      projectName: document.getElementById('lot_project').value.trim(),
      status: document.getElementById('lot_status').value,
      bookingExpiryDate: bexpVal
    };
    stockAddLot(sku, p.name, code, qty, extra.ref, '', extra);
  } else if (code === 'PRPO') {
    var ref = document.getElementById('lot_ref').value.trim();
    var note = document.getElementById('lot_note').value.trim();
    var prpoSoEl = document.getElementById('lot_so');
    var extraPR = {
      soNumber: prpoSoEl.value.trim(),
      soId: prpoSoEl.dataset.soId || '',
      expectedDate: document.getElementById('lot_expected').value,
      bookingExpiryDate: bexpVal
    };
    stockAddLot(sku, p.name, code, qty, ref, note, extraPR);
  } else if (code === 'QI') {
    var refQ = document.getElementById('lot_ref').value.trim();
    var noteQ = document.getElementById('lot_note').value.trim();
    var extraQ = {
      submittedDate: document.getElementById('lot_submitted').value,
      estimateDays: document.getElementById('lot_estimate').value,
      expectedCompleteDate: document.getElementById('lot_expected').value,
      bookingExpiryDate: bexpVal
    };
    stockAddLot(sku, p.name, code, qty, refQ, noteQ, extraQ);
  } else {
    var refP = document.getElementById('lot_ref').value.trim();
    var noteP = document.getElementById('lot_note').value.trim();
    stockAddLot(sku, p.name, code, qty, refP, noteP, { bookingExpiryDate: bexpVal });
  }
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

function showStockMoveLotM(sku, lotId, presetDest) {
  var p = getProductBySku(sku);
  if (!p) return;
  var lots = stockGetLots(sku);
  var lot = lots.filter(function(l) { return l.id === lotId; })[0];
  if (!lot) return;
  var otherLocs = getStockLocations().filter(function(l) { return l.code !== lot.location; });
  var today = _nw().substring(0, 10);

  var body = '<div class="fg"><label>' + sanitize(lot.ref || stockLocationName(lot.location)) + ' — เหลือ ' + lot.qty + '</label></div>';
  body += '<div class="fg"><label>ย้ายไปคลัง</label><select id="mv_dest" onchange="stockMoveDestChanged()">';
  otherLocs.forEach(function(l) { body += '<option value="' + l.code + '"' + (presetDest === l.code ? ' selected' : '') + '>' + l.code + ' ' + sanitize(l.name) + '</option>'; });
  body += '</select></div>';
  body += '<div class="fg"><label>จำนวนที่ย้าย</label><input type="number" id="mv_qty" min="1" max="' + lot.qty + '" value="' + lot.qty + '"></div>';
  body += '<div id="mv_booking_fields" style="display:none">';
  body += _stockSODatalistHtml();
  body += '<div class="fg"><label>SO No. <small style="color:var(--text2)">(เลือกจาก SO จริงในระบบ หรือพิมพ์เองถ้ายังไม่มี)</small></label><input type="text" id="mv_so" list="stockSODL" oninput="stockSOInputChanged(this,\'mv\')" value="' + sanitize(lot.ref || '') + '"></div>';
  body += '<div class="fg"><label>วันที่จอง</label><input type="date" id="mv_date" value="' + today + '"></div>';
  body += '<div class="fg"><label>เซลที่จอง</label><input type="text" id="mv_sales" value="' + sanitize(_stockCurrentUserName()) + '"></div>';
  body += '<div class="fg"><label>Dealer</label><input type="text" id="mv_dealer"></div>';
  body += '<div class="fg"><label>โครงการ</label><input type="text" id="mv_project"></div>';
  body += '<div class="fg"><label>สถานะ</label><select id="mv_status">' + STOCK_BOOKING_STATUSES.map(function(s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>';
  body += '</div>';
  body += '<div id="mv_prpo_fields" style="display:none">';
  body += '<div class="fg"><label>ผูก SO <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="mv_prpo_so" list="stockSODL" oninput="stockSOInputChanged(this,\'mv_prpo\')"></div>';
  body += '<div class="fg"><label>คาดว่าจะถึง</label><input type="date" id="mv_expected"></div>';
  body += '</div>';
  body += '<div id="mv_qi_fields" style="display:none">' + _stockQIFieldsHtml('mv_qi', {}) + '</div>';
  body += '<div id="mv_bexp_fields" style="display:none"><div class="fg"><label id="mv_bexp_label">จองถึงวันที่</label><input type="date" id="mv_bexp"></div></div>';
  body += '<div class="fg"><label>หมายเหตุ <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="mv_note"></div>';
  body += '<button class="btn bp btn-full" onclick="saveStockMoveLot(\'' + sku + '\',\'' + lotId + '\')">→ ยืนยันย้าย</button>';
  openM('ย้ายคลัง', body);
  setTimeout(stockMoveDestChanged, 30);
}

function stockMoveDestChanged() {
  var dest = document.getElementById('mv_dest');
  var bookingFields = document.getElementById('mv_booking_fields');
  var prpoFields = document.getElementById('mv_prpo_fields');
  var qiFields = document.getElementById('mv_qi_fields');
  var bexpFields = document.getElementById('mv_bexp_fields');
  if (!dest) return;
  if (bookingFields) bookingFields.style.display = dest.value === '1021' ? 'block' : 'none';
  if (prpoFields) prpoFields.style.display = dest.value === 'PRPO' ? 'block' : 'none';
  if (qiFields) qiFields.style.display = dest.value === 'QI' ? 'block' : 'none';
  if (bexpFields) {
    var loc = getStockLocations().filter(function(l) { return l.code === dest.value; })[0];
    if (loc && loc.bookingExpiry && loc.bookingExpiry !== 'none') {
      bexpFields.style.display = 'block';
      document.getElementById('mv_bexp_label').textContent = 'จองถึงวันที่ (' + (loc.bookingExpiry === 'penalty' ? 'เลื่อนได้ ไม่งั้นโดนหักค่าธรรมเนียม' : 'เลื่อนไม่ได้') + ')';
    } else {
      bexpFields.style.display = 'none';
    }
  }
}

function saveStockMoveLot(sku, lotId) {
  var p = getProductBySku(sku);
  if (!p) return;
  var dest = document.getElementById('mv_dest').value;
  var qty = document.getElementById('mv_qty').value;
  var note = document.getElementById('mv_note').value.trim();
  var bexpEl = document.getElementById('mv_bexp');
  var extra = { note: note, bookingExpiryDate: bexpEl ? bexpEl.value : '' };
  if (dest === '1021') {
    var mvSoEl = document.getElementById('mv_so');
    extra.ref = mvSoEl.value.trim();
    extra.soId = mvSoEl.dataset.soId || '';
    extra.bookedDate = document.getElementById('mv_date').value;
    extra.salesperson = document.getElementById('mv_sales').value.trim();
    extra.dealerName = document.getElementById('mv_dealer').value.trim();
    extra.projectName = document.getElementById('mv_project').value.trim();
    extra.status = document.getElementById('mv_status').value;
  } else if (dest === 'PRPO') {
    var prpoSoEl = document.getElementById('mv_prpo_so');
    extra.soNumber = prpoSoEl.value.trim();
    extra.soId = prpoSoEl.dataset.soId || '';
    extra.expectedDate = document.getElementById('mv_expected').value;
  } else if (dest === 'QI') {
    extra.submittedDate = document.getElementById('mv_qi_submitted').value;
    extra.estimateDays = document.getElementById('mv_qi_estimate').value;
    extra.expectedCompleteDate = document.getElementById('mv_qi_expected').value;
  }
  stockMoveLot(sku, p.name, lotId, qty, dest, extra);
  closeMForce();
  toast('→ ย้ายแล้ว');
  render();
}

// ================================================================
// ลาก lot ไปวางบนคลังปลายทางได้เลย — ปลายทางธรรมดา (ไม่ใช่ 1021) เปิด popup เล็กแค่จำนวน+หมายเหตุ
// ปลายทางเป็น 1021 Sales Booking ยังต้องกรอกรายละเอียดจอง เลยเปิดฟอร์มเต็มแบบเดิม (พรีเซ็ตปลายทางไว้ให้)
// ================================================================

function stockLotDragStart(ev, sku, lotId) {
  ev.dataTransfer.setData('text/plain', JSON.stringify({ sku: sku, lotId: lotId }));
  ev.dataTransfer.effectAllowed = 'move';
}

function stockLotDragOver(ev, accentColor) {
  ev.preventDefault();
  ev.currentTarget.style.outline = '2px dashed ' + (accentColor || '#2563eb');
  ev.currentTarget.style.outlineOffset = '-2px';
}

function stockLotDragLeave(ev) {
  ev.currentTarget.style.outline = '';
}

function stockLotDrop(ev, destCode) {
  ev.preventDefault();
  ev.currentTarget.style.outline = '';
  var data;
  try { data = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch (e) { return; }
  if (!data || !data.sku || !data.lotId) return;
  var lot = stockGetLots(data.sku).filter(function(l) { return l.id === data.lotId; })[0];
  if (!lot || lot.location === destCode) return;
  if (destCode === '1021' || destCode === 'PRPO') {
    showStockMoveLotM(data.sku, data.lotId, destCode);
  } else {
    showStockQuickMoveM(data.sku, data.lotId, destCode);
  }
}

// popup ย้ายแบบเบาๆ สำหรับปลายทางที่ไม่ต้องกรอกรายละเอียดจอง — จำนวน (ปุ่ม "ทั้งหมด" เติมให้) + หมายเหตุ
function showStockQuickMoveM(sku, lotId, destCode) {
  var p = getProductBySku(sku);
  var lot = stockGetLots(sku).filter(function(l) { return l.id === lotId; })[0];
  if (!p || !lot) return;
  var body = '<div class="fg"><label>' + sanitize(lot.ref || stockLocationName(lot.location)) + ' → ' + sanitize(stockLocationName(destCode)) + ' (เหลือ ' + lot.qty + ')</label></div>';
  body += '<div style="display:flex;gap:8px;margin-bottom:8px">';
  body += '<input type="number" id="qmv_qty" min="1" max="' + lot.qty + '" value="' + lot.qty + '" style="flex:1">';
  body += '<button class="btn bo" type="button" onclick="document.getElementById(\'qmv_qty\').value=' + lot.qty + '">ทั้งหมด</button>';
  body += '</div>';
  body += '<div class="fg"><label>หมายเหตุ <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="qmv_note"></div>';
  body += '<button class="btn bp btn-full" onclick="saveStockQuickMove(\'' + sku + '\',\'' + lotId + '\',\'' + destCode + '\')">→ ยืนยันย้าย</button>';
  openM('ย้ายคลัง', body);
  setTimeout(function() { var el = document.getElementById('qmv_qty'); if (el) { el.focus(); el.select(); } }, 50);
}

function saveStockQuickMove(sku, lotId, destCode) {
  var p = getProductBySku(sku);
  if (!p) return;
  var qty = document.getElementById('qmv_qty').value;
  var note = document.getElementById('qmv_note').value.trim();
  stockMoveLot(sku, p.name, lotId, qty, destCode, { note: note });
  closeMForce();
  toast('→ ย้ายแล้ว');
  render();
}

// กดตัวเลขจำนวนของ lot แก้ไขได้ทันที ไม่ต้องเปิด modal (แก้ฟิลด์อื่น เช่น อ้างอิง/รายละเอียดจอง ยังใช้ปุ่ม ✏️ เหมือนเดิม)
function stockEditLotQtyInline(el, sku, lotId, productName) {
  if (el.tagName === 'INPUT') return;
  var cur = parseInt(el.textContent, 10) || 0;
  var input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.value = cur;
  input.style.width = '70px';
  input.onclick = function(e) { e.stopPropagation(); };
  input.onblur = function() {
    stockUpdateLot(sku, productName, lotId, { qty: input.value });
    render();
  };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') render();
  };
  el.replaceWith(input);
  input.focus();
  input.select();
}

// Import Excel — sheet แรก, หา column SKU/จำนวน จาก header (รองรับทั้งไทย/อังกฤษ) fallback คอลัมน์ 0/1
// นำเข้าเป็น lot คงที่ id 'import_0001' ในคลัง 0001 Normal Good — import ซ้ำจะอัปเดต lot เดิม ไม่สร้างซ้ำ
function importStockFromExcel(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rows || rows.length < 2) { toast('❌ ไม่พบข้อมูลในไฟล์'); return; }

      var headers = rows[0] || [];
      var colSku = -1, colQty = -1;
      headers.forEach(function(hh, i) {
        var hLow = (hh || '').toString().toLowerCase().trim();
        if (colSku === -1 && (hLow.indexOf('sku') !== -1 || hLow.indexOf('part') !== -1)) colSku = i;
        if (colQty === -1 && (hLow.indexOf('qty') !== -1 || hLow.indexOf('stock') !== -1 || hLow.indexOf('จำนวน') !== -1 || hLow.indexOf('คงเหลือ') !== -1)) colQty = i;
      });
      if (colSku === -1) colSku = 0;
      if (colQty === -1) colQty = 1;

      var bySku = {};
      getAllProducts().forEach(function(p) { if (p.sku) bySku[p.sku.toLowerCase()] = p; });

      var updated = 0, skipped = 0;
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (!row || !row.length) continue;
        var sku = (row[colSku] || '').toString().trim();
        var qtyVal = row[colQty];
        if (!sku || qtyVal === '' || qtyVal === undefined) { skipped++; continue; }
        var prod = bySku[sku.toLowerCase()];
        if (!prod) { skipped++; continue; }
        setStockQty(prod.sku, prod.name, qtyVal, 'import', file.name);
        updated++;
      }
      toast('📤 Import สำเร็จ: อัปเดต ' + updated + ' รายการ' + (skipped ? ' (ข้าม ' + skipped + ' แถวที่จับคู่ SKU ไม่ได้)' : ''));
      render();
    } catch (err) {
      toast('❌ อ่านไฟล์ไม่ได้: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}
