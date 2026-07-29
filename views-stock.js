// ================================================================
// views-stock.js — Stock สินค้า (Phase 1: เมนูหลักในแอป + Import Excel + ประวัติการเปลี่ยนแปลง)
// เก็บจำนวนคงเหลือแยกจาก v7_products โดยตั้งใจ — products มี guard กันข้อมูล sync ทับ/โดนทับอยู่แล้ว
// (เคยเกิดเหตุข้อมูลหาย 2026-07-18) ไม่อยากไปแตะระบบนั้น เลยจับคู่กับ product ด้วย SKU แทน
// Phase 2 (ยังไม่ทำ): ลิงก์ stock-view.html ให้ Admin ภายนอกกรอก/Import เอง
// ================================================================

var stockSearch = '';
var stockCategoryFilters = []; // ว่าง = ทุกหมวด, เลือกได้หลายอัน เช่น Drone + Payload
var stockFavOnly = false;
var stockLowFilter = 'all'; // all | low | out
var stockTypeFilter = 'all'; // all | stock | order
var stockShowLog = false;
var stockExpanded = {}; // sku -> เปิด/ปิดแถวรายละเอียดคลังย่อย
var STOCK_LOW_THRESHOLD = 5;

// คลังย่อยของ 1001 SiS Main Warehouse — ชุดเดียวกันทุก SKU (ตามที่กำหนดไว้ก่อน)
// sellable:true = นับเป็น "พร้อมขาย" (ของปกติ) — ที่เหลือ (ติดจอง/ดาเมจ) ไม่นับว่าขายได้จริง
var STOCK_LOCATIONS = [
  { code: '0001', name: 'Normal Good', sellable: true },
  { code: '1021', name: 'Sales Booking', sellable: false },
  { code: '1027', name: 'Damaged Boxes', sellable: false }
];

function stockLocationName(code) {
  var loc = STOCK_LOCATIONS.filter(function(l) { return l.code === code; })[0];
  return loc ? loc.name : code;
}

// รองรับ record เก่าที่มี qty แบบตัวเลขเดียว (ก่อนมีคลังย่อย) — ยกไปไว้ที่ 0001 Normal Good ให้อัตโนมัติ
function stockGetLocations(sku) {
  if (!sku) return {};
  var rec = ST.getAll('stockLevels').find(function(s) { return s.sku === sku; });
  if (!rec) return {};
  if (rec.locations) return rec.locations;
  if (rec.qty) return { '0001': Number(rec.qty) || 0 };
  return {};
}

function stockTotalQty(locs) {
  return Object.keys(locs).reduce(function(sum, k) { return sum + (Number(locs[k]) || 0); }, 0);
}

function stockSellableQty(locs) {
  return STOCK_LOCATIONS.filter(function(l) { return l.sellable; })
    .reduce(function(sum, l) { return sum + (Number(locs[l.code]) || 0); }, 0);
}

function stockToggleExpand(sku) {
  stockExpanded[sku] = !stockExpanded[sku];
  render();
}

// ประเภทสินค้า: 'stock' = นับ/ติดตามจำนวนคงเหลือจริง, 'order' = สั่งตามออเดอร์ (default — ยังไม่ตั้งค่าไว้)
function getStockOrderType(sku) {
  if (!sku) return 'order';
  var rec = ST.getAll('stockLevels').find(function(s) { return s.sku === sku; });
  return (rec && rec.orderType) || 'order';
}

function toggleStockOrderType(sku, productName) {
  if (!sku) return;
  var newType = getStockOrderType(sku) === 'stock' ? 'order' : 'stock';
  var rec = ST.getAll('stockLevels').find(function(s) { return s.sku === sku; });
  if (rec) ST.update('stockLevels', rec.id, { orderType: newType });
  else ST.add('stockLevels', { sku: sku, productName: productName, locations: {}, orderType: newType });
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

// ตั้งจำนวนคงเหลือของคลังย่อยหนึ่งอัน + log ส่วนต่างอัตโนมัติ (ถ้าจำนวนเปลี่ยนจริง)
function setStockLocationQty(sku, productName, code, newQty, source, note) {
  if (!sku) return;
  newQty = Math.max(0, Math.round(Number(newQty) || 0));
  var rec = ST.getAll('stockLevels').find(function(s) { return s.sku === sku; });
  var locs = {};
  if (rec) {
    if (rec.locations) { for (var k in rec.locations) locs[k] = rec.locations[k]; }
    else if (rec.qty) locs['0001'] = Number(rec.qty) || 0;
  }
  var before = Number(locs[code]) || 0;
  locs[code] = newQty;
  var payload = { sku: sku, productName: productName, locations: locs, source: source || 'app', updatedBy: _stockCurrentUserName() };
  if (rec) ST.update('stockLevels', rec.id, payload);
  else ST.add('stockLevels', payload);
  if (newQty !== before) {
    ST.add('stockLog', {
      sku: sku, productName: productName, locationCode: code, locationName: stockLocationName(code),
      before: before, after: newQty, delta: newQty - before, source: source || 'app', note: note || '', date: _nw()
    });
  }
}

// เข้ากันได้กับของเดิม (Import Excel) — ตั้งจำนวนที่คลัง 0001 Normal Good (ของปกติ พร้อมขาย) เป็นค่าเริ่มต้น
function setStockQty(sku, productName, newQty, source, note) {
  setStockLocationQty(sku, productName, '0001', newQty, source, note);
}

function stockEditLocationInline(el, sku, code, productName) {
  if (el.tagName === 'INPUT') return;
  var cur = parseInt(el.textContent, 10) || 0;
  var input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.value = cur;
  input.style.width = '64px';
  input.onclick = function(e) { e.stopPropagation(); };
  input.onblur = function() {
    setStockLocationQty(sku, productName, code, input.value, 'app', '');
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
    var locs = p.sku ? stockGetLocations(p.sku) : {};
    return {
      product: p,
      locations: locs,
      qty: stockTotalQty(locs), // คงเหลือรวมทุกคลังย่อย
      sellable: stockSellableQty(locs), // พร้อมขายจริง (เฉพาะคลังที่ flag sellable)
      hasLevel: !!lvl,
      orderType: (lvl && lvl.orderType) || 'order',
      updatedAt: lvl ? (lvl.updated || lvl.created) : null,
      updatedBy: lvl ? (lvl.updatedBy || '') : '',
      source: lvl ? lvl.source : ''
    };
  });

  // นับใกล้หมด/หมดสต็อก จากจำนวน "พร้อมขาย" เท่านั้น (ไม่รวมของติดจอง/ดาเมจ) และเฉพาะสินค้าประเภท Stock
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
        '<span style="cursor:pointer;color:var(--text2)" onclick="stockToggleExpand(\'' + p.sku + '\')" title="ดูรายละเอียดคลังย่อย">' + (expanded ? '▾' : '▸') + '</span>' :
        '') + '</td>';
      h += '<td style="text-align:center">' + (p.sku ?
        '<span style="cursor:pointer;font-size:15px" onclick="toggleStockFav(\'' + p.sku + '\',\'' + sanitize(p.name || '').replace(/'/g, "\\'") + '\')" title="' + (fav ? 'เอาออกจาก Favorite' : 'เพิ่มเป็น Favorite') + '">' + (fav ? '⭐' : '☆') + '</span>' :
        '') + '</td>';
      h += '<td style="font-size:11px">' + (p.sku ? qcopyHtml(p.sku) : '<span style="color:var(--text2)" title="ไม่มี SKU ตั้งค่า Stock ไม่ได้">-</span>') + '</td>';
      h += '<td>' + sanitize(p.name || '-') + '</td>';
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
        h += '<tr><td></td><td colspan="8" style="padding:0">' + stockLocationBreakdownHtml(p) + '</td></tr>';
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
        var up = l.delta > 0;
        h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border,#334155)">';
        h += '<span style="font-size:16px;color:' + (up ? '#22c55e' : '#ef4444') + '">' + (up ? '▲' : '▼') + '</span>';
        h += '<div style="flex:1;min-width:0"><div style="font-size:13px">' + sanitize(l.productName || l.sku) + ' <span style="color:var(--text2);font-size:11px">(' + sanitize(l.sku) + (l.locationName ? ' · ' + sanitize(l.locationCode) + ' ' + sanitize(l.locationName) : '') + ')</span></div>';
        h += '<div style="font-size:11px;color:var(--text2)">' + fDT(l.date) + ' · ' + _stockSourceLabel(l.source) + (l.note ? ' · ' + sanitize(l.note) : '') + '</div></div>';
        h += '<div style="text-align:right;flex-shrink:0"><div style="font-weight:700;color:' + (up ? '#22c55e' : '#ef4444') + '">' + (up ? '+' : '') + l.delta + '</div>';
        h += '<div style="font-size:11px;color:var(--text2)">' + l.before + ' → ' + l.after + '</div></div>';
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

function stockLocationBreakdownHtml(p) {
  var locs = stockGetLocations(p.sku);
  var nameEsc = sanitize(p.name || '').replace(/'/g, "\\'");
  var h = '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:4px 0 8px">';
  h += '<thead><tr>' +
    '<th style="text-align:left;padding:4px 4px 4px 30px;font-weight:400;color:var(--text2)">คลังย่อย (1001 SiS Main Warehouse)</th>' +
    '<th style="text-align:center;padding:4px;font-weight:400;color:var(--text2)">จำนวน</th>' +
    '<th style="text-align:left;padding:4px;font-weight:400;color:var(--text2)">นับพร้อมขาย</th>' +
    '</tr></thead><tbody>';
  STOCK_LOCATIONS.forEach(function(loc) {
    var v = Number(locs[loc.code]) || 0;
    h += '<tr>';
    h += '<td style="padding:4px 4px 4px 30px">' + loc.code + ' ' + sanitize(loc.name) + '</td>';
    h += '<td style="text-align:center;padding:4px"><span style="display:inline-block;padding:2px 10px;border:1px dashed var(--border,#475569);border-radius:6px;cursor:pointer" title="ดับเบิ้ลคลิกเพื่อแก้ไข" ondblclick="stockEditLocationInline(this,\'' + p.sku + '\',\'' + loc.code + '\',\'' + nameEsc + '\')">' + v + '</span></td>';
    h += '<td style="padding:4px">' + (loc.sellable ?
      '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(34,197,94,.15);color:#16a34a">ใช่</span>' :
      '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(107,114,128,.15);color:#6b7280">ไม่</span>') + '</td>';
    h += '</tr>';
  });
  h += '</tbody></table>';
  return h;
}

// Import Excel — sheet แรก, หา column SKU/จำนวน จาก header (รองรับทั้งไทย/อังกฤษ) fallback คอลัมน์ 0/1
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
