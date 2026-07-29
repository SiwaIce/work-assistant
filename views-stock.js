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
var stockExpanded = {}; // sku -> เปิด/ปิดแถวสรุปคลังย่อยในหน้ารายการ
var STOCK_LOW_THRESHOLD = 5;

// คลังย่อยทั้งหมด — ชุดเดียวกันทุก SKU (ตามที่กำหนดไว้ก่อน)
// sellable:true = นับเป็น "พร้อมขาย" — ที่เหลือ (ติดจอง/ดาเมจ/รอขึ้นทะเบียน) ไม่นับว่าขายได้จริง
var STOCK_LOCATIONS = [
  { code: '0001', name: 'Normal Good', sellable: true, warehouse: '1001 SiS Main Warehouse' },
  { code: '1021', name: 'Sales Booking', sellable: false, warehouse: '1001 SiS Main Warehouse' },
  { code: '1027', name: 'Damaged Boxes', sellable: false, warehouse: '1001 SiS Main Warehouse' },
  { code: 'QI', name: 'Pending Registration (กสทช. ฯลฯ)', sellable: false, warehouse: 'QI — รอขึ้นทะเบียน' }
];
var STOCK_BOOKING_STATUSES = ['รอส่งมอบ', 'เตรียมส่งมอบ', 'ส่งมอบแล้ว', 'ยกเลิก'];

function stockLocationName(code) {
  var loc = STOCK_LOCATIONS.filter(function(l) { return l.code === code; })[0];
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

function stockLocTotal(lots, code) {
  return lots.filter(function(l) { return l.location === code; }).reduce(function(s, l) { return s + (Number(l.qty) || 0); }, 0);
}

function stockTotalQty(lots) {
  return lots.reduce(function(s, l) { return s + (Number(l.qty) || 0); }, 0);
}

function stockSellableQty(lots) {
  var sellableCodes = STOCK_LOCATIONS.filter(function(l) { return l.sellable; }).map(function(l) { return l.code; });
  return lots.filter(function(l) { return sellableCodes.indexOf(l.location) !== -1; }).reduce(function(s, l) { return s + (Number(l.qty) || 0); }, 0);
}

// เฟส 1: badge สถานะสต็อกแบบ read-only ให้หน้าอื่น (ใบเสนอราคา/SO ฯลฯ) เรียกใช้ตรง — ยังไม่มีปุ่มจองลอยๆ (เฟส 2)
// ไล่ใช้ 0001 (พร้อมส่ง) ก่อน ถ้าไม่พอค่อยดึงจาก QI (รอขึ้นทะเบียน) ที่เหลือหลังจากนั้นคือส่วนที่ต้อง PR/PO
function stockAvailabilityHtml(sku, qty) {
  if (!sku) return '';
  qty = Math.max(0, Math.round(Number(qty) || 0));
  if (qty <= 0) return '';
  var lots = stockGetLots(sku);
  var sellableTotal = stockLocTotal(lots, '0001');
  var qiTotal = stockLocTotal(lots, 'QI');
  var usedSellable = Math.min(qty, sellableTotal);
  var remaining = qty - usedSellable;
  var usedQI = Math.min(remaining, qiTotal);
  var shortfall = remaining - usedQI;
  var qiLeftover = qiTotal - usedQI;

  var h = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;font-weight:400">';
  if (usedSellable > 0) {
    h += '<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(34,197,94,.15);color:#16a34a">✓ พร้อมส่ง ' + usedSellable + '</span>';
  }
  if (usedQI > 0) {
    h += '<a href="#" onclick="event.stopPropagation();go(\'stockDetail\',{sku:\'' + sku + '\'});return false" style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(245,158,11,.15);color:#b45309;text-decoration:none" title="กดดูรายละเอียด QI">⏳ จาก QI ' + usedQI + '</a>';
  }
  if (shortfall > 0) {
    h += '<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(239,68,68,.15);color:#ef4444">✕ ขาดอีก ' + shortfall + ' ต้อง PR/PO</span>';
  }
  h += '</div>';
  if (qiLeftover > 0 && usedQI > 0) {
    h += '<div style="font-size:10px;color:var(--text2);margin-top:2px;font-weight:400">QI เหลืออีก ' + qiLeftover + ' สำรองไว้</div>';
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

// เพิ่ม lot ใหม่เข้าคลังหนึ่ง (รับของเข้า / จองใหม่โดยตรง) — extra ใช้เฉพาะปลายทางเป็น 1021 Sales Booking
function stockAddLot(sku, productName, code, qty, ref, note, extra) {
  if (!sku) return;
  qty = Math.max(0, Math.round(Number(qty) || 0));
  if (qty <= 0) return;
  var lots = stockGetLots(sku).slice();
  var lot = { id: _stockLotId(), location: code, ref: ref || '', qty: qty, dateIn: _nw(), note: note || '' };
  if (code === '1021' && extra) {
    lot.soNumber = extra.ref || ref || '';
    lot.ref = lot.soNumber;
    lot.bookedDate = extra.bookedDate || _nw();
    lot.salesperson = extra.salesperson || '';
    lot.dealerName = extra.dealerName || '';
    lot.projectName = extra.projectName || '';
    lot.status = extra.status || STOCK_BOOKING_STATUSES[0];
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
    newLot.bookedDate = extra.bookedDate || _nw();
    newLot.salesperson = extra.salesperson || '';
    newLot.dealerName = extra.dealerName || '';
    newLot.projectName = extra.projectName || '';
    newLot.status = extra.status || STOCK_BOOKING_STATUSES[0];
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
  lots[idx] = Object.assign({}, lots[idx], { status: status });
  _stockSaveLots(sku, productName, lots);
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

function rStock(el) {
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
    '<button class="btn bsm bo" onclick="document.getElementById(\'stockImportFile\').click()">📤 Import Excel</button>' +
    '<input type="file" id="stockImportFile" accept=".xlsx,.xls" style="display:none" onchange="importStockFromExcel(event)">' +
    '<button class="btn bsm ' + (stockShowLog ? 'bp' : 'bo') + '" onclick="stockShowLog=!stockShowLog;render()">📜 ประวัติ</button>' +
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
      h += '<td>' + (p.sku ?
        '<a href="#" onclick="go(\'stockDetail\',{sku:\'' + p.sku + '\'});return false">' + sanitize(p.name || '-') + '</a>' :
        sanitize(p.name || '-')) + '</td>';
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
  STOCK_LOCATIONS.forEach(function(loc) {
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
  var sku = S.sku;
  var p = sku ? getProductBySku(sku) : null;
  if (!p) { el.innerHTML = '<div class="card"><button class="btn bo bsm" onclick="go(\'stock\')" style="margin-bottom:10px">← กลับ</button><div>ไม่พบสินค้านี้</div></div>'; return; }
  document.getElementById('pgT').textContent = '📦 ' + (p.name || 'สินค้า');

  var lots = stockGetLots(sku);
  var totalAll = stockTotalQty(lots);
  var sellable = stockSellableQty(lots);

  var h = '<button class="btn bo bsm" onclick="go(\'stock\')" style="margin-bottom:10px">← กลับ</button>';

  h += '<div class="card" style="margin-bottom:12px">';
  h += '<h2 style="margin:0 0 2px">' + sanitize(p.name || '-') + '</h2>';
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">' + (p.sku ? qcopyHtml(p.sku) : '-') + ' · ' + sanitize((typeof getCategoryName === 'function' ? getCategoryName(p.category) : p.category) || '-') + '</div>';
  h += '<table style="width:100%;font-size:13px;border-collapse:collapse">';
  h += '<tr><td style="padding:6px 4px;color:var(--text2)">RRP</td><td style="padding:6px 4px;text-align:right;font-weight:700">฿' + fmtMoney(p.rrpInVat || 0) + '</td>' +
       '<td style="padding:6px 4px;color:var(--text2)">Level S</td><td style="padding:6px 4px;text-align:right">฿' + fmtMoney((p.typePrices && p.typePrices.S) || 0) + '</td></tr>';
  h += '<tr><td style="padding:6px 4px;color:var(--text2)">Level A</td><td style="padding:6px 4px;text-align:right">฿' + fmtMoney((p.typePrices && p.typePrices.A) || 0) + '</td>' +
       '<td style="padding:6px 4px;color:var(--text2)">Level B</td><td style="padding:6px 4px;text-align:right">฿' + fmtMoney((p.typePrices && p.typePrices.B) || 0) + '</td></tr>';
  h += '<tr><td style="padding:6px 4px;color:var(--text2)">Other</td><td style="padding:6px 4px;text-align:right">฿' + fmtMoney((p.typePrices && p.typePrices.Other) || 0) + '</td><td></td><td></td></tr>';
  h += '</table>';
  h += '</div>';

  h += '<div class="sr" style="margin-bottom:12px">';
  h += '<div class="sc"><div class="sn c1">' + totalAll + '</div><div class="sl">คงเหลือรวม</div></div>';
  h += '<div class="sc"><div class="sn c2">' + sellable + '</div><div class="sl">พร้อมขาย</div></div>';
  h += '</div>';

  var warehouses = [];
  STOCK_LOCATIONS.forEach(function(l) {
    var wh = warehouses.filter(function(w) { return w.name === l.warehouse; })[0];
    if (!wh) { wh = { name: l.warehouse, locs: [] }; warehouses.push(wh); }
    wh.locs.push(l);
  });

  warehouses.forEach(function(wh) {
    h += '<div class="card" style="margin-bottom:12px">';
    h += '<h3 style="margin:0 0 10px;font-size:14px">' + sanitize(wh.name) + '</h3>';
    wh.locs.forEach(function(loc) {
      var locLots = lots.filter(function(l) { return l.location === loc.code; });
      var locTotal = locLots.reduce(function(s, x) { return s + (Number(x.qty) || 0); }, 0);
      var isBooking = loc.code === '1021';
      h += '<div style="margin-bottom:14px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
      h += '<span style="font-size:12px;font-weight:500">' + loc.code + ' ' + sanitize(loc.name) + ' · รวม ' + locTotal + (loc.sellable ? ' <span style="color:#16a34a">(พร้อมขาย)</span>' : '') + '</span>';
      h += '<button class="btn bsm bo" onclick="showStockAddLotM(\'' + sku + '\',\'' + loc.code + '\')">+ เพิ่ม lot</button>';
      h += '</div>';
      if (!locLots.length) {
        h += '<div style="font-size:12px;color:var(--text2);padding:4px 0">ไม่มีสินค้าในคลังนี้</div>';
      } else {
        h += '<div class="export-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px">';
        h += '<thead><tr>';
        h += isBooking ?
          '<th style="text-align:left;padding:4px">SO No.</th><th style="text-align:center;padding:4px">จำนวน</th><th style="text-align:left;padding:4px">เซล</th><th style="text-align:left;padding:4px">Dealer</th><th style="text-align:left;padding:4px">โครงการ</th><th style="text-align:left;padding:4px">สถานะ</th><th></th>' :
          '<th style="text-align:left;padding:4px">อ้างอิง</th><th style="text-align:center;padding:4px">จำนวน</th><th style="text-align:left;padding:4px">วันที่</th><th></th>';
        h += '</tr></thead><tbody>';
        locLots.forEach(function(lot) {
          h += '<tr style="border-top:1px solid var(--border,#334155)">';
          if (isBooking) {
            h += '<td style="padding:5px 4px">' + sanitize(lot.soNumber || lot.ref || '-') + '</td>';
            h += '<td style="text-align:center;padding:5px 4px;font-weight:700">' + lot.qty + '</td>';
            h += '<td style="padding:5px 4px">' + sanitize(lot.salesperson || '-') + '</td>';
            h += '<td style="padding:5px 4px">' + sanitize(lot.dealerName || '-') + '</td>';
            h += '<td style="padding:5px 4px">' + sanitize(lot.projectName || '-') + '</td>';
            h += '<td style="padding:5px 4px">' +
              '<select style="font-size:11px;padding:2px 4px" onchange="stockSetLotStatus(\'' + sku + '\',\'' + sanitize(p.name || '').replace(/'/g, "\\'") + '\',\'' + lot.id + '\',this.value)">' +
              STOCK_BOOKING_STATUSES.map(function(st) { return '<option' + (st === lot.status ? ' selected' : '') + '>' + st + '</option>'; }).join('') +
              '</select></td>';
          } else {
            h += '<td style="padding:5px 4px">' + sanitize(lot.ref || '-') + '</td>';
            h += '<td style="text-align:center;padding:5px 4px;font-weight:700">' + lot.qty + '</td>';
            h += '<td style="padding:5px 4px;font-size:11px;color:var(--text2)">' + fDT(lot.dateIn) + (lot.fromLocation ? ' · ย้ายจาก ' + sanitize(stockLocationName(lot.fromLocation)) : '') + '</td>';
          }
          h += '<td style="padding:5px 4px;text-align:right"><button class="btn bsm bo" onclick="showStockMoveLotM(\'' + sku + '\',\'' + lot.id + '\')">→ ย้ายคลัง</button></td>';
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

function showStockAddLotM(sku, code) {
  var p = getProductBySku(sku);
  if (!p) return;
  var loc = STOCK_LOCATIONS.filter(function(l) { return l.code === code; })[0];
  var isBooking = code === '1021';
  var today = _nw().substring(0, 10);
  var body = '<div class="fg"><label>จำนวน</label><input type="number" id="lot_qty" min="1" value="1"></div>';
  if (isBooking) {
    body += '<div class="fg"><label>SO No.</label><input type="text" id="lot_so"></div>';
    body += '<div class="fg"><label>วันที่จอง</label><input type="date" id="lot_date" value="' + today + '"></div>';
    body += '<div class="fg"><label>เซลที่จอง</label><input type="text" id="lot_sales" value="' + sanitize(_stockCurrentUserName()) + '"></div>';
    body += '<div class="fg"><label>Dealer</label><input type="text" id="lot_dealer"></div>';
    body += '<div class="fg"><label>โครงการ</label><input type="text" id="lot_project"></div>';
    body += '<div class="fg"><label>สถานะ</label><select id="lot_status">' + STOCK_BOOKING_STATUSES.map(function(s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>';
  } else {
    body += '<div class="fg"><label>อ้างอิง (PR/PO)</label><input type="text" id="lot_ref"></div>';
    body += '<div class="fg"><label>หมายเหตุ <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="lot_note"></div>';
  }
  body += '<button class="btn bp btn-full" onclick="saveStockAddLot(\'' + sku + '\',\'' + code + '\')">💾 บันทึก</button>';
  openM('+ เพิ่มสินค้าเข้าคลัง ' + code + ' ' + sanitize(loc ? loc.name : ''), body);
}

function saveStockAddLot(sku, code) {
  var p = getProductBySku(sku);
  if (!p) return;
  var qty = document.getElementById('lot_qty').value;
  if (code === '1021') {
    var extra = {
      ref: document.getElementById('lot_so').value.trim(),
      bookedDate: document.getElementById('lot_date').value,
      salesperson: document.getElementById('lot_sales').value.trim(),
      dealerName: document.getElementById('lot_dealer').value.trim(),
      projectName: document.getElementById('lot_project').value.trim(),
      status: document.getElementById('lot_status').value
    };
    stockAddLot(sku, p.name, code, qty, extra.ref, '', extra);
  } else {
    var ref = document.getElementById('lot_ref').value.trim();
    var note = document.getElementById('lot_note').value.trim();
    stockAddLot(sku, p.name, code, qty, ref, note);
  }
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

function showStockMoveLotM(sku, lotId) {
  var p = getProductBySku(sku);
  if (!p) return;
  var lots = stockGetLots(sku);
  var lot = lots.filter(function(l) { return l.id === lotId; })[0];
  if (!lot) return;
  var otherLocs = STOCK_LOCATIONS.filter(function(l) { return l.code !== lot.location; });
  var today = _nw().substring(0, 10);

  var body = '<div class="fg"><label>' + sanitize(lot.ref || stockLocationName(lot.location)) + ' — เหลือ ' + lot.qty + '</label></div>';
  body += '<div class="fg"><label>ย้ายไปคลัง</label><select id="mv_dest" onchange="stockMoveDestChanged()">';
  otherLocs.forEach(function(l) { body += '<option value="' + l.code + '">' + l.code + ' ' + sanitize(l.name) + '</option>'; });
  body += '</select></div>';
  body += '<div class="fg"><label>จำนวนที่ย้าย</label><input type="number" id="mv_qty" min="1" max="' + lot.qty + '" value="' + lot.qty + '"></div>';
  body += '<div id="mv_booking_fields" style="display:none">';
  body += '<div class="fg"><label>SO No.</label><input type="text" id="mv_so" value="' + sanitize(lot.ref || '') + '"></div>';
  body += '<div class="fg"><label>วันที่จอง</label><input type="date" id="mv_date" value="' + today + '"></div>';
  body += '<div class="fg"><label>เซลที่จอง</label><input type="text" id="mv_sales" value="' + sanitize(_stockCurrentUserName()) + '"></div>';
  body += '<div class="fg"><label>Dealer</label><input type="text" id="mv_dealer"></div>';
  body += '<div class="fg"><label>โครงการ</label><input type="text" id="mv_project"></div>';
  body += '<div class="fg"><label>สถานะ</label><select id="mv_status">' + STOCK_BOOKING_STATUSES.map(function(s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>';
  body += '</div>';
  body += '<div class="fg"><label>หมายเหตุ <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="mv_note"></div>';
  body += '<button class="btn bp btn-full" onclick="saveStockMoveLot(\'' + sku + '\',\'' + lotId + '\')">→ ยืนยันย้าย</button>';
  openM('ย้ายคลัง', body);
  setTimeout(stockMoveDestChanged, 30);
}

function stockMoveDestChanged() {
  var dest = document.getElementById('mv_dest');
  var fields = document.getElementById('mv_booking_fields');
  if (dest && fields) fields.style.display = dest.value === '1021' ? 'block' : 'none';
}

function saveStockMoveLot(sku, lotId) {
  var p = getProductBySku(sku);
  if (!p) return;
  var dest = document.getElementById('mv_dest').value;
  var qty = document.getElementById('mv_qty').value;
  var note = document.getElementById('mv_note').value.trim();
  var extra = { note: note };
  if (dest === '1021') {
    extra.ref = document.getElementById('mv_so').value.trim();
    extra.bookedDate = document.getElementById('mv_date').value;
    extra.salesperson = document.getElementById('mv_sales').value.trim();
    extra.dealerName = document.getElementById('mv_dealer').value.trim();
    extra.projectName = document.getElementById('mv_project').value.trim();
    extra.status = document.getElementById('mv_status').value;
  }
  stockMoveLot(sku, p.name, lotId, qty, dest, extra);
  closeMForce();
  toast('→ ย้ายแล้ว');
  render();
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
