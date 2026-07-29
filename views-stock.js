// ================================================================
// views-stock.js — Stock สินค้า (Phase 1: เมนูหลักในแอป + Import Excel + ประวัติการเปลี่ยนแปลง)
// เก็บจำนวนคงเหลือแยกจาก v7_products โดยตั้งใจ — products มี guard กันข้อมูล sync ทับ/โดนทับอยู่แล้ว
// (เคยเกิดเหตุข้อมูลหาย 2026-07-18) ไม่อยากไปแตะระบบนั้น เลยจับคู่กับ product ด้วย SKU แทน
// Phase 2 (ยังไม่ทำ): ลิงก์ stock-view.html ให้ Admin ภายนอกกรอก/Import เอง
// ================================================================

var stockSearch = '';
var stockCategoryFilters = []; // ว่าง = ทุกหมวด, เลือกได้หลายอัน เช่น Drone + Payload
var stockLowFilter = 'all'; // all | low | out
var stockShowLog = false;
var STOCK_LOW_THRESHOLD = 5;

function _stockCurrentUserName() {
  return (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? (CURRENT_USER.displayName || CURRENT_USER.email || '') : '';
}

// ตั้งจำนวนคงเหลือใหม่ + log ส่วนต่างอัตโนมัติ (ถ้าจำนวนเปลี่ยนจริง) — ใช้จุดเดียวทั้งแก้เองในแอปและ Import Excel
function setStockQty(sku, productName, newQty, source, note) {
  if (!sku) return;
  newQty = Math.max(0, Math.round(Number(newQty) || 0));
  var rec = ST.getAll('stockLevels').find(function(s) { return s.sku === sku; });
  var before = rec ? (Number(rec.qty) || 0) : 0;
  var payload = { sku: sku, productName: productName, qty: newQty, source: source || 'app', updatedBy: _stockCurrentUserName() };
  if (rec) ST.update('stockLevels', rec.id, payload);
  else ST.add('stockLevels', payload);
  if (newQty !== before) {
    ST.add('stockLog', { sku: sku, productName: productName, before: before, after: newQty, delta: newQty - before, source: source || 'app', note: note || '', date: _nw() });
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
    return {
      product: p,
      qty: lvl ? (Number(lvl.qty) || 0) : 0,
      hasLevel: !!lvl,
      updatedAt: lvl ? (lvl.updated || lvl.created) : null,
      updatedBy: lvl ? (lvl.updatedBy || '') : '',
      source: lvl ? lvl.source : ''
    };
  });

  var totalCount = rows.length;
  var lowCount = rows.filter(function(r) { return r.qty > 0 && r.qty < STOCK_LOW_THRESHOLD; }).length;
  var outCount = rows.filter(function(r) { return r.qty <= 0; }).length;

  if (stockSearch) {
    var q = stockSearch.toLowerCase();
    rows = rows.filter(function(r) {
      return (r.product.name || '').toLowerCase().indexOf(q) !== -1 || (r.product.sku || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  if (stockCategoryFilters.length) rows = rows.filter(function(r) { return stockCategoryFilters.indexOf(r.product.category) !== -1; });
  if (stockLowFilter === 'low') rows = rows.filter(function(r) { return r.qty > 0 && r.qty < STOCK_LOW_THRESHOLD; });
  else if (stockLowFilter === 'out') rows = rows.filter(function(r) { return r.qty <= 0; });

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

  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
  h += '<button class="btn bsm ' + (!stockCategoryFilters.length ? 'bp' : 'bo') + '" onclick="stockCategoryFilters=[];render()">📂 ทุกหมวด</button>';
  (typeof PRODUCT_CATEGORIES !== 'undefined' ? PRODUCT_CATEGORIES : []).forEach(function(c) {
    h += '<button class="btn bsm ' + (stockCategoryFilters.indexOf(c.id) !== -1 ? 'bp' : 'bo') + '" onclick="stockToggleCategory(\'' + c.id + '\')">' + sanitize(c.name) + '</button>';
  });
  if (stockLowFilter !== 'all') h += '<button class="btn bsm bo" onclick="stockLowFilter=\'all\';render()">✕ ล้างตัวกรองสถานะ</button>';
  h += '</div>';

  if (!rows.length) {
    h += '<div class="empty"><div class="icon">📦</div><p>ไม่พบสินค้า' + (stockSearch ? ' ที่ตรงกับ "' + sanitize(stockSearch) + '"' : '') + '</p></div>';
  } else {
    h += '<div class="export-wrap"><table class="export-table" style="width:100%"><thead><tr>' +
      '<th>SKU</th><th>สินค้า</th><th>หมวดหมู่</th><th style="text-align:center">คงเหลือ</th><th>อัปเดตล่าสุด</th><th></th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r) {
      var p = r.product;
      var rowStyle = r.qty <= 0 ? 'background:rgba(239,68,68,.08)' : (r.qty < STOCK_LOW_THRESHOLD ? 'background:rgba(245,158,11,.08)' : '');
      h += '<tr style="' + rowStyle + '">';
      h += '<td style="font-size:11px">' + (p.sku ? qcopyHtml(p.sku) : '<span style="color:var(--text2)" title="ไม่มี SKU ตั้งค่า Stock ไม่ได้">-</span>') + '</td>';
      h += '<td>' + sanitize(p.name || '-') + '</td>';
      h += '<td>' + sanitize((typeof getCategoryName === 'function' ? getCategoryName(p.category) : p.category) || '-') + '</td>';
      h += '<td style="text-align:center">' + (p.sku ?
        '<span style="font-weight:700;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px" onclick="showEditStockQtyM(\'' + p.id + '\')" title="กดเพื่อแก้ไขจำนวน">' + r.qty + '</span>' :
        '<span style="font-weight:700">' + r.qty + '</span>') + '</td>';
      h += '<td style="font-size:11px;color:var(--text2)">' + (r.updatedAt ? fDT(r.updatedAt) + (r.updatedBy ? ' · ' + sanitize(r.updatedBy) : '') : '-') + '</td>';
      h += '<td>' + (p.sku ? '<button class="btn bsm bo" onclick="showEditStockQtyM(\'' + p.id + '\')">✏️</button>' : '') + '</td>';
      h += '</tr>';
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
        h += '<div style="flex:1;min-width:0"><div style="font-size:13px">' + sanitize(l.productName || l.sku) + ' <span style="color:var(--text2);font-size:11px">(' + sanitize(l.sku) + ')</span></div>';
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

function showEditStockQtyM(productId) {
  var p = getProductById(productId);
  if (!p || !p.sku) { toast('⚠️ สินค้านี้ไม่มี SKU ตั้งค่า Stock ไม่ได้'); return; }
  var lvl = ST.getAll('stockLevels').find(function(s) { return s.sku === p.sku; });
  var qty = lvl ? (Number(lvl.qty) || 0) : 0;
  openM('✏️ แก้ไขจำนวนคงเหลือ',
    '<div class="fg"><label>' + sanitize(p.name) + ' <span style="color:var(--text2);font-size:.8rem">(' + sanitize(p.sku) + ')</span></label>' +
    '<input type="number" id="stk_qty" value="' + qty + '" min="0"></div>' +
    '<div class="fg"><label>หมายเหตุ <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="stk_note" placeholder="เช่น รับของเข้าคลัง, ขายออก"></div>' +
    '<button class="btn bp btn-full" onclick="saveStockQty(\'' + productId + '\')">💾 บันทึก</button>'
  );
  setTimeout(function() { var el = document.getElementById('stk_qty'); if (el) { el.focus(); el.select(); } }, 50);
}

function saveStockQty(productId) {
  var p = getProductById(productId);
  if (!p || !p.sku) return;
  var qty = document.getElementById('stk_qty').value;
  var note = document.getElementById('stk_note').value.trim();
  setStockQty(p.sku, p.name, qty, 'app', note);
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
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
