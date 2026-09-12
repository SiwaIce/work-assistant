// ================================================================
// สมุดเดินของ DJI — ไฟล์ Inbound & Outbound Records ที่ export มาจากระบบ DJI
//
// 1 แถว = 1 การเคลื่อนไหวของสินค้า 1 ชิ้น (หรือ 1 ล็อตถ้าไม่มี SN) ไฟล์เป็น "สมุดเดินของ" ไม่ใช่ภาพนิ่ง
// เครื่องเดียวกันโผล่ได้หลายแถว (ส่งออก → รับคืน → ส่งใหม่) สถานะปัจจุบันจึงต้องเล่นย้อนตามเวลาเอา ไม่ใช่
// อ่านแถวใดแถวหนึ่ง
//
// เราเก็บดิบไว้ทั้งเล่มโดยตั้งใจ แล้วแยก "จับคู่เข้า SO" เป็นอีกขั้นตอนหนึ่ง เพราะสองอย่างนี้ผิดกันคนละแบบ:
// ไฟล์นำเข้าผิดแก้ด้วยการนำเข้าใหม่ ส่วนจับคู่ผิดแก้ที่ SO — ถ้ารวมเป็นขั้นตอนเดียวจะแยกไม่ออกว่าพลาดตรงไหน
//
// ไฟล์ไม่มีคอลัมน์ SO No. (DJI ไม่รู้จักเลข SO ของเรา) สะพานเชื่อมจึงเป็น Invoice No. + EAN:
//   Invoice No.  → so.invoiceNumber       (1 invoice มีได้หลาย SO — EAN เป็นตัวตัดว่าลงใบไหน)
//   EAN          → sku ของเรา = 'DJI-' + EAN
//   Reseller code→ dealer.djiCode
// ================================================================

// ---- ชื่อคอลัมน์ที่ยอมรับ (เผื่อ DJI เปลี่ยนหัวตารางเล็กน้อย จับแบบ normalize ไม่ใช่ตรงตัว) ----
var DJL_COLS = [
  { key: 'name',   label: 'Reseller or Retailer name',  alias: ['reseller or retailer name', 'reseller name', 'retailer name'] },
  { key: 'code',   label: 'Reseller or Retailer code',  alias: ['reseller or retailer code', 'reseller code', 'retailer code'], required: true },
  { key: 'status', label: 'Status',                     alias: ['status'], required: true },
  { key: 'sn',     label: 'SN',                         alias: ['sn', 'serial', 'serial no', 'serial number'] },
  { key: 'qty',    label: 'Quantity',                   alias: ['quantity', 'qty'] },
  { key: 'pid',    label: 'Project ID',                 alias: ['project id', 'projectid'] },
  { key: 'ean',    label: 'EAN',                        alias: ['ean'], required: true },
  { key: 'ship',   label: 'Shipment date',              alias: ['shipment date'] },
  { key: 'type',   label: 'Bill type',                  alias: ['bill type', 'billtype'], required: true },
  { key: 'date',   label: 'Bill date',                  alias: ['bill date', 'billdate'] },
  { key: 'inv',    label: 'Invoice No.',                alias: ['invoice no.', 'invoice no', 'invoice number', 'invoice'], required: true }
];

// รหัสพิเศษที่ DJI ใช้ ไม่ใช่ dealer จริง — ทั้งคู่ชื่อ "Others" เหมือนกันในไฟล์ แต่คนละเรื่องกันสิ้นเชิง
var DJL_CODE_OWN = 'SiS';          // ของเข้าคลังเราเอง (Purchase Receipt) ไม่ใช่การขาย
var DJL_CODE_UNAUTH = '59999999';  // ส่งออกไปแล้วแต่ปลายทางยังไม่ได้เป็น DJI Authorized Dealer

var DJL_BUCKETS = {
  sold:    { label: 'ขายให้ dealer', icon: '📦', hint: 'ปลายทางเป็น Dealer ที่มี DJI Code ตรงกับในระบบ — จับคู่เข้า SO ได้' },
  unauth:  { label: 'ยังไม่ authorized', icon: '⏳', hint: 'DJI บันทึกรวมเป็น "Others" เพราะปลายทางยังไม่ได้เป็น Authorized Dealer — เก็บรอไว้ ไม่นำไปรวมกับยอดขาย' },
  inbound: { label: 'ของเข้าคลังเรา', icon: '📥', hint: 'ของที่รับเข้าคลัง SiS เอง ไม่ใช่การขาย — แยกไว้ไม่ให้ปนกับยอด' }
};

var DJL_SELL_TYPE = 'Distribution Out';   // มีแค่ประเภทนี้ที่นับเป็นการขายออกไปให้ลูกค้า
var DJL_OK_STATUS = 'take effect';        // ที่เหลือคือ 'failure' = DJI ตีกลับ ห้ามนับ

var djlTab = 'sold', djlQ = '', djlLimit = 100;

// ---------------------------------------------------------------- ตัวช่วย
function _djlNorm(v) { return String(v === null || v === undefined ? '' : v).trim(); }
function _djlNormHeader(v) { return _djlNorm(v).toLowerCase().replace(/\s+/g, ' '); }
// เลข invoice จาก DJI เป็นสตริงตัวเลขล้วน ส่วนที่เรากรอกเองอาจมีขีด/ช่องว่าง/ตัวพิมพ์ปน — เทียบที่แก่นเท่านั้น
function _djlNormInv(v) { return _djlNorm(v).replace(/[\s\-_/]/g, '').toUpperCase(); }
// sku ในแอปคือ 'DJI-' + EAN แต่บางรายการกรอกมาเป็นเลขเปล่า — เทียบด้วยตัวเลขล้วนจึงครอบคลุมทั้งสองแบบ
function _djlSkuMatchesEan(sku, ean) {
  var a = _djlNorm(sku).replace(/\D/g, ''), b = _djlNorm(ean).replace(/\D/g, '');
  return !!a && !!b && a === b;
}
function _djlDate(v) {
  if (v instanceof Date && !isNaN(v)) {
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  }
  var s = _djlNorm(v);
  var m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : s.slice(0, 10);
}

// รหัส DJI ของ Dealer ที่มีในระบบ → id — ใช้ตัดสินว่าแถวไหนเป็นการขายที่จับคู่ได้
function _djlDealerByCode() {
  var map = {};
  ST.getAll('dealers').forEach(function(d) {
    var c = _djlNorm(d.djiCode);
    if (c) map[c.toUpperCase()] = d;
  });
  return map;
}

// ถังของแถวนี้ — คิดสดทุกครั้ง ไม่เก็บลงข้อมูล เพราะพอ Dealer รายนั้นได้เป็น Authorized แล้วกรอก DJI Code
// เข้าระบบ แถวเก่าที่เคยอยู่ถัง "ยังไม่ authorized" ต้องย้ายมาถังขายเองโดยไม่ต้อง import ใหม่
function djlBucket(m, dealerMap) {
  var code = _djlNorm(m.code).toUpperCase();
  if (code === DJL_CODE_OWN.toUpperCase() || m.type === 'Purchase Receipt') return 'inbound';
  var map = dealerMap || _djlDealerByCode();
  if (map[code]) return 'sold';
  return 'unauth';
}
function djlDealerOf(m, dealerMap) {
  return (dealerMap || _djlDealerByCode())[_djlNorm(m.code).toUpperCase()] || null;
}

// กุญแจกันซ้ำตอน import ไฟล์งวดถัดไป ซึ่งจะมีข้อมูลเดิมทับมาเสมอ
// ต้องใช้ครบชุดนี้จริงๆ: ทดสอบกับไฟล์จริง 4,541 แถว — inv+sn ชนกัน 528 แถว, เพิ่ม type+date ยังชน 306
// (เครื่องเดียวกันถูกส่ง/คืนในวันเดียวกันได้) ครบชุดนี้เหลือ 0
function _djlKey(m) {
  return [_djlNormInv(m.inv), _djlNorm(m.ean), _djlNorm(m.sn).toUpperCase(), m.type, m.date, m.qty].join('|');
}

// ---------------------------------------------------------------- อ่านไฟล์
function _djlBuildColMap(headerRow) {
  var map = {}, missing = [];
  var norm = (headerRow || []).map(_djlNormHeader);
  DJL_COLS.forEach(function(def) {
    for (var i = 0; i < norm.length; i++) {
      if (def.alias.indexOf(norm[i]) !== -1) { map[def.key] = i; return; }
    }
    if (def.required) missing.push(def.label);
  });
  return { map: map, missing: missing };
}

function importDjiLedgerXlsx() {
  if (typeof XLSX === 'undefined') { toast('⚠️ ตัวอ่านไฟล์ Excel ยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง', true); return; }
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
        // raw:true + แปลงวันที่เอง ด้วยเหตุผลเดียวกับ importPipelineXlsx — ปล่อยให้ SheetJS แปลงเป็นข้อความ
        // เมื่อไหร่ วันที่ ≤12 จะสลับวัน/เดือนได้เงียบๆ
        var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        if (!aoa.length) { toast('⚠️ ไม่พบข้อมูลในไฟล์', true); return; }
        var col = _djlBuildColMap(aoa[0]);
        if (col.missing.length) {
          alert('ไฟล์นี้ไม่มีคอลัมน์ที่จำเป็น:\n\n' + col.missing.map(function(x) { return '· ' + x; }).join('\n') +
                '\n\nต้องเป็นไฟล์ Inbound & Outbound Records ที่ export จากระบบ DJI');
          return;
        }
        var g = function(r, k) { return col.map[k] === undefined ? '' : _djlNorm(r[col.map[k]]); };
        var recs = [];
        aoa.slice(1).forEach(function(r) {
          if (!r || !r.some(function(c) { return _djlNorm(c); })) return;
          var qty = parseInt(g(r, 'qty'), 10);
          recs.push({
            code: g(r, 'code'), name: g(r, 'name'),
            sn: g(r, 'sn').toUpperCase(), ean: g(r, 'ean'),
            qty: isNaN(qty) ? 1 : qty,
            inv: g(r, 'inv'), pid: g(r, 'pid'),
            type: g(r, 'type'), status: g(r, 'status'),
            date: _djlDate(col.map.date === undefined ? '' : r[col.map.date]),
            ship: _djlDate(col.map.ship === undefined ? '' : r[col.map.ship])
          });
        });
        if (!recs.length) { toast('⚠️ ไฟล์ไม่มีแถวข้อมูล', true); return; }
        _djlShowImportPreview(recs, file.name);
      } catch (err) {
        console.error(err);
        alert('อ่านไฟล์ไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      }
    };
    reader.readAsBinaryString(file);
  };
  input.click();
}

function _djlShowImportPreview(recs, filename) {
  var existing = {};
  ST.getAll('djiMovements').forEach(function(m) { existing[_djlKey(m)] = true; });
  var seen = {}, fresh = [], dupFile = 0, dupDb = 0;
  recs.forEach(function(r) {
    var k = _djlKey(r);
    if (seen[k]) { dupFile++; return; }       // ซ้ำกันเองภายในไฟล์
    seen[k] = true;
    if (existing[k]) { dupDb++; return; }     // เคยนำเข้าไปแล้วรอบก่อน
    fresh.push(r);
  });
  window._djlPending = fresh;

  var dmap = _djlDealerByCode();
  var byBucket = { sold: 0, unauth: 0, inbound: 0 };
  var unknownCodes = {};
  fresh.forEach(function(r) {
    var b = djlBucket(r, dmap);
    byBucket[b]++;
    if (b === 'unauth' && _djlNorm(r.code).toUpperCase() !== DJL_CODE_UNAUTH) unknownCodes[r.code + ' — ' + r.name] = (unknownCodes[r.code + ' — ' + r.name] || 0) + 1;
  });
  var dates = fresh.map(function(r) { return r.date; }).filter(Boolean).sort();

  var h = '<div class="hint" style="margin-bottom:10px">📄 ' + sanitize(filename) + '</div>';
  h += '<div class="rr-stats" style="margin-bottom:12px">' +
    '<div class="rr-stat"><div class="n">' + recs.length + '</div><div class="l">แถวในไฟล์</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:#22c55e">' + fresh.length + '</div><div class="l">จะเพิ่มใหม่</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:var(--text2)">' + (dupDb + dupFile) + '</div><div class="l">ซ้ำ ข้ามไป</div></div>' +
    '</div>';
  if (dates.length) h += '<div class="hint" style="margin-bottom:10px">🗓️ ' + dates[0] + ' ถึง ' + dates[dates.length - 1] + '</div>';

  if (!fresh.length) {
    h += '<div class="empty"><p>ไฟล์นี้นำเข้าไปหมดแล้ว ไม่มีอะไรใหม่</p></div>';
    h += '<button class="btn bo btn-full" onclick="closeMForce()">ปิด</button>';
    openM('⬆️ นำเข้าสมุดเดินของ DJI', h);
    return;
  }

  h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">';
  ['sold', 'unauth', 'inbound'].forEach(function(k) {
    var b = DJL_BUCKETS[k];
    h += '<div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px">' +
      '<div style="display:flex;justify-content:space-between;font-weight:600">' +
      '<span>' + b.icon + ' ' + b.label + '</span><span>' + byBucket[k] + ' แถว</span></div>' +
      '<div style="font-size:11px;color:var(--text2);margin-top:2px">' + b.hint + '</div></div>';
  });
  h += '</div>';

  var uk = Object.keys(unknownCodes);
  if (uk.length) {
    h += '<div class="hint" style="color:var(--warn,#f59e0b);margin-bottom:10px">⚠️ มี DJI Code ที่ยังไม่มีใน Dealer ของเรา ' + uk.length + ' รหัส — จะไปอยู่ถัง “ยังไม่ authorized” ก่อน พอกรอก DJI Code ให้ Dealer แล้วแถวจะย้ายมาถังขายเอง:<br>' +
      uk.slice(0, 6).map(function(x) { return '· ' + sanitize(x) + ' (' + unknownCodes[x] + ')'; }).join('<br>') + '</div>';
  }
  if (fresh.length > 1000) {
    h += '<div class="hint" style="margin-bottom:10px">ℹ️ ชุดนี้ใหญ่ — จะเขียนขึ้น Firebase ' + fresh.length + ' รายการ นำเข้าครั้งแรกจะใช้เวลาสักครู่ งวดถัดไปจะเหลือเฉพาะของใหม่</div>';
  }
  h += '<button class="btn bp btn-full" onclick="djlCommitImport()">💾 นำเข้า ' + fresh.length + ' แถว</button>';
  h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="closeMForce()">ยกเลิก</button>';
  openM('⬆️ นำเข้าสมุดเดินของ DJI', h);
}

function djlCommitImport() {
  var fresh = window._djlPending || [];
  if (!fresh.length) { closeMForce(); return; }
  var now = new Date().toISOString();
  // เขียนรวดเดียว ไม่ใช่ ST.add() ทีละแถว — ไฟล์จริงมี 4,500 แถว เรียกทีละรายการจะอ่าน+เขียนทั้ง collection
  // ซ้ำ 4,500 ครั้งจนเบราว์เซอร์ค้าง (ดู addMany ใน storage.js)
  var saved = ST.addMany('djiMovements', fresh.map(function(r) { return Object.assign({ importedAt: now }, r); }));
  window._djlPending = null;
  // ดันขึ้น cloud เฉพาะแถวที่เพิ่งเพิ่ม ไม่ใช่ทั้งเล่ม — งวดถัดไปมีของใหม่ไม่กี่ร้อยแถว ถ้าส่งทั้งเล่มทุกครั้ง
  // จะเขียน Firestore หลักพันครั้งซ้ำๆ โดยเปล่าประโยชน์
  if (saved.length && typeof syncToFirebase === 'function') syncToFirebase('djiMovements', saved);
  closeMForce();
  toast('✅ นำเข้า ' + saved.length + ' แถวแล้ว');
  go('djiLedger');
}

// ---------------------------------------------------------------- จับคู่เข้า SO
// วางแผนก่อนเขียนเสมอ — คืนทั้งสิ่งที่จะทำและสิ่งที่ทำไม่ได้พร้อมเหตุผล เพื่อให้หน้าตัวอย่างบอกได้ครบว่า
// อะไรจะเกิดขึ้น ไม่ใช่เขียนไปเงียบๆ แล้วค่อยมาไล่หาว่าทำไมบางแถวหาย
function djlPlanMatch() {
  var dmap = _djlDealerByCode();
  var moves = ST.getAll('djiMovements').filter(function(m) {
    return m.status === DJL_OK_STATUS && m.type === DJL_SELL_TYPE && djlBucket(m, dmap) === 'sold';
  });

  var soByInv = {};
  ST.getAll('salesOrders').forEach(function(s) {
    var k = _djlNormInv(s.invoiceNumber);
    if (k) (soByInv[k] = soByInv[k] || []).push(s);
  });

  // รวมผลเป็นราย (SO, รายการสินค้า) ไม่ใช่รายแถว — หนึ่งรายการสินค้ารับ SN ได้หลายตัวและรับ qty สะสม
  var targets = {};
  var plan = { targets: targets, already: 0, addSN: 0, noInvoice: {}, noSO: {}, noItem: {}, ambiguous: {} };

  moves.forEach(function(m) {
    var invKey = _djlNormInv(m.inv);
    if (!invKey) { plan.noInvoice[m.sn || m.ean] = 1; return; }
    var list = soByInv[invKey] || [];
    if (!list.length) { plan.noSO[m.inv] = (plan.noSO[m.inv] || 0) + 1; return; }

    var hits = [];
    list.forEach(function(s) {
      (s.items || []).forEach(function(it, idx) {
        if (_djlSkuMatchesEan(it.sku, m.ean)) hits.push({ so: s, idx: idx, item: it });
      });
    });
    if (!hits.length) { plan.noItem[m.inv + ' · EAN ' + m.ean] = (plan.noItem[m.inv + ' · EAN ' + m.ean] || 0) + 1; return; }
    if (hits.length > 1) { plan.ambiguous[m.inv + ' · EAN ' + m.ean] = hits.length; return; }

    var t = hits[0];
    var key = t.so.id + '#' + t.idx;
    var tg = targets[key] || (targets[key] = { soId: t.so.id, soNumber: t.so.soNumber, idx: t.idx,
      model: t.item.model, dealerName: t.so.dealerName, addSN: [], djiQty: 0, soQty: Number(t.item.qty) || 0 });
    tg.djiQty += Number(m.qty) || 0;
    if (m.sn) {
      var have = (typeof _soItemSerials === 'function') ? _soItemSerials(t.item) : (t.item.serials || []);
      if (have.indexOf(m.sn) !== -1 || tg.addSN.indexOf(m.sn) !== -1) plan.already++;
      else { tg.addSN.push(m.sn); plan.addSN++; }
    }
  });
  return plan;
}

function showDjlMatchM() {
  var plan = djlPlanMatch();
  window._djlPlan = plan;
  var keys = Object.keys(plan.targets);
  var touched = keys.filter(function(k) { return plan.targets[k].addSN.length || plan.targets[k].djiQty; });
  var qtyDiff = touched.filter(function(k) { var t = plan.targets[k]; return t.soQty && t.djiQty && t.soQty !== t.djiQty; });

  var h = '<div class="hint" style="margin-bottom:10px">จับคู่ด้วย <b>Invoice No. + EAN</b> เพราะไฟล์ของ DJI ไม่มีเลข SO — 1 invoice มีได้หลาย SO จึงใช้ EAN ตัดว่า SN ลงใบไหน</div>';
  h += '<div class="rr-stats" style="margin-bottom:12px">' +
    '<div class="rr-stat"><div class="n" style="color:#22c55e">' + plan.addSN + '</div><div class="l">SN ที่จะเติม</div></div>' +
    '<div class="rr-stat"><div class="n">' + touched.length + '</div><div class="l">รายการสินค้า</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:var(--text2)">' + plan.already + '</div><div class="l">มีอยู่แล้ว</div></div>' +
    '</div>';

  if (qtyDiff.length) {
    h += '<div class="hint" style="color:var(--warn,#f59e0b);margin-bottom:10px">⚠️ จำนวนใน SO ไม่ตรงกับที่ DJI ส่งจริง ' + qtyDiff.length + ' รายการ (บันทึกไว้ให้ดูเทียบ ไม่แก้จำนวนใน SO ให้):<br>' +
      qtyDiff.slice(0, 5).map(function(k) { var t = plan.targets[k];
        return '· ' + sanitize(t.soNumber || '-') + ' ' + sanitize(String(t.model || '').substr(0, 22)) + ' — SO ' + t.soQty + ' / DJI ' + t.djiQty; }).join('<br>') + '</div>';
  }

  var probs = [
    ['ไม่มี SO ที่ใช้เลข invoice นี้', plan.noSO, 'อาจยังไม่ได้เปิด SO หรือกรอกเลข invoice ไม่ตรง'],
    ['SO เจอ แต่ไม่มีรายการสินค้า EAN นี้', plan.noItem, 'รายการสินค้าใน SO อาจไม่มี SKU หรือ SKU ไม่ตรงกับ EAN'],
    ['ตรงหลายรายการจนตัดสินไม่ได้', plan.ambiguous, 'invoice เดียวมีหลาย SO ที่มีสินค้ารุ่นเดียวกัน — ต้องเลือกเอง ระบบข้ามให้']
  ];
  probs.forEach(function(p) {
    var ks = Object.keys(p[1]);
    if (!ks.length) return;
    h += '<div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px">' +
      '<div style="font-weight:600;font-size:12px">⚠️ ' + p[0] + ' — ' + ks.length + ' รายการ</div>' +
      '<div style="font-size:11px;color:var(--text2);margin:2px 0 4px">' + p[2] + '</div>' +
      '<div style="font-size:11px;font-family:monospace;color:var(--text2)">' +
      ks.slice(0, 6).map(function(k) { return sanitize(k) + ' (' + p[1][k] + ')'; }).join('<br>') +
      (ks.length > 6 ? '<br>… อีก ' + (ks.length - 6) : '') + '</div></div>';
  });

  if (!plan.addSN && !touched.length) {
    h += '<div class="empty"><p>ไม่มีอะไรให้เติม — อาจยังไม่ได้เปิด SO ที่ใช้เลข invoice ตรงกับในสมุด</p></div>';
    h += '<button class="btn bo btn-full" onclick="closeMForce()">ปิด</button>';
  } else {
    h += '<button class="btn bp btn-full" onclick="djlCommitMatch()">🔗 เติมเข้า SO (' + plan.addSN + ' SN)</button>';
    h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="closeMForce()">ยกเลิก</button>';
  }
  openM('🔗 จับคู่สมุดเดินของเข้า SO', h);
}

function djlCommitMatch() {
  var plan = window._djlPlan;
  if (!plan) { closeMForce(); return; }
  var bySO = {};
  Object.keys(plan.targets).forEach(function(k) {
    var t = plan.targets[k];
    (bySO[t.soId] = bySO[t.soId] || []).push(t);
  });

  var nSO = 0, nSN = 0;
  Object.keys(bySO).forEach(function(soId) {
    var so = ST.getOne('salesOrders', soId);
    if (!so) return;
    var items = (so.items || []).map(function(it) { return Object.assign({}, it); });
    var changed = false;
    bySO[soId].forEach(function(t) {
      var it = items[t.idx];
      if (!it) return;
      // รวม serial เก่าทุกที่ให้เหลือรายการเดียว (it.serials) แบบเดียวกับที่หน้าแก้ไข serial ทำอยู่
      var cur = (typeof _soItemSerials === 'function') ? _soItemSerials(it).slice() : (it.serials || []).slice();
      t.addSN.forEach(function(sn) { if (cur.indexOf(sn) === -1) { cur.push(sn); nSN++; changed = true; } });
      it.serials = cur;
      // จำนวนที่ DJI ส่งจริง เก็บไว้เทียบกับจำนวนใน SO — ตั้งใจไม่แก้ it.qty ให้ เพราะ SO เป็นเอกสารของเรา
      // ถ้าไม่ตรงแปลว่ามีเรื่องต้องคุยกัน ไม่ใช่เรื่องที่ระบบควรกลบด้วยการเขียนทับ
      if (t.djiQty && it.djiQty !== t.djiQty) { it.djiQty = t.djiQty; changed = true; }
    });
    if (!changed) return;
    var updated = ST.update('salesOrders', soId, { items: items, djiMatchedAt: new Date().toISOString() });
    if (updated && typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updated);
    nSO++;
  });

  window._djlPlan = null;
  closeMForce();
  toast(nSN ? ('✅ เติม ' + nSN + ' SN เข้า ' + nSO + ' SO แล้ว') : 'ไม่มี SN ใหม่ที่ต้องเติม');
  render();
}

// ---------------------------------------------------------------- ประวัติของ SN หนึ่งตัว
// เล่นย้อนตามเวลาแล้วบอกว่าตอนนี้เครื่องอยู่ไหน — อ่านแถวใดแถวหนึ่งไม่พอ เพราะเครื่องที่ถูกคืนแล้วส่งใหม่
// จะมีทั้งแถว "ส่งออก" และ "รับคืน" ปนกันอยู่
function djlSNStatus(sn) {
  var ev = ST.djiMovesBySN(sn).filter(function(m) { return m.status === DJL_OK_STATUS; });
  if (!ev.length) return null;
  var last = ev[ev.length - 1];
  var label = last.type === DJL_SELL_TYPE ? 'อยู่กับ ' + (last.name || last.code)
            : last.type === 'Distribution Return In' ? 'รับคืนกลับมาแล้ว'
            : last.type === 'Purchase Receipt' ? 'รับเข้าคลัง'
            : 'ตัดออก (' + last.type + ')';
  return { events: ev, last: last, label: label, returned: last.type !== DJL_SELL_TYPE };
}

function djlSNHistoryHtml(sn) {
  var st = djlSNStatus(sn);
  if (!st) return '';
  var h = '<div style="margin-top:8px;border-top:1px dashed var(--border);padding-top:8px">' +
    '<div style="font-size:11px;color:var(--text2);margin-bottom:4px">📖 สมุดเดินของ DJI — <b>' + sanitize(st.label) + '</b></div>';
  st.events.slice().reverse().forEach(function(m) {
    h += '<div style="font-size:11px;color:var(--text2);display:flex;gap:6px;flex-wrap:wrap">' +
      '<span style="font-family:monospace">' + sanitize(m.date) + '</span>' +
      '<span>' + sanitize(m.type) + '</span>' +
      '<span>' + sanitize(String(m.name || m.code).substr(0, 28)) + '</span>' +
      (m.inv ? '<span style="font-family:monospace">inv ' + sanitize(m.inv) + '</span>' : '') +
      (m.pid ? '<span>🗂️ ' + sanitize(m.pid) + '</span>' : '') +
      '</div>';
  });
  return h + '</div>';
}

// ---------------------------------------------------------------- หน้าจอ
function djlSetTab(t) { djlTab = t; djlLimit = 100; render(); }

function _djlFiltered(dmap) {
  var q = djlQ.trim().toLowerCase();
  return ST.getAll('djiMovements').filter(function(m) {
    if (djlBucket(m, dmap) !== djlTab) return false;
    if (!q) return true;
    return (m.sn || '').toLowerCase().indexOf(q) !== -1 ||
           (m.inv || '').toLowerCase().indexOf(q) !== -1 ||
           (m.ean || '').toLowerCase().indexOf(q) !== -1 ||
           (m.pid || '').toLowerCase().indexOf(q) !== -1 ||
           (m.name || '').toLowerCase().indexOf(q) !== -1 ||
           (m.code || '').toLowerCase().indexOf(q) !== -1;
  }).sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
}

function rDjiLedger(el) {
  document.getElementById('pgT').textContent = '📖 สมุดเดินของ DJI';
  var all = ST.getAll('djiMovements');
  var dmap = _djlDealerByCode();

  var h = '<div class="card" style="margin-bottom:12px">';
  h += '<div class="hint" style="margin-bottom:10px">ไฟล์ Inbound &amp; Outbound Records จากระบบ DJI — 1 แถว = การเคลื่อนไหว 1 ครั้ง ' +
    'ใช้ตามรอย SN ย้อนหลังและเติม SN เข้า SO โดยไม่ต้องพิมพ์เอง</div>';

  if (!all.length) {
    h += '<div class="empty"><div class="icon">📖</div><p>ยังไม่มีข้อมูล — กดนำเข้าไฟล์ที่ export จากระบบ DJI</p></div>';
    h += '<button class="btn bp btn-full" onclick="importDjiLedgerXlsx()">⬆️ นำเข้าไฟล์ Excel</button></div>';
    el.innerHTML = h;
    return;
  }

  var counts = { sold: 0, unauth: 0, inbound: 0 };
  var snSet = {}, lastImport = '';
  all.forEach(function(m) {
    counts[djlBucket(m, dmap)]++;
    if (m.sn) snSet[m.sn] = 1;
    if ((m.importedAt || '') > lastImport) lastImport = m.importedAt || '';
  });
  h += '<div class="rr-stats">' +
    '<div class="rr-stat"><div class="n">' + all.length + '</div><div class="l">แถวทั้งหมด</div></div>' +
    '<div class="rr-stat"><div class="n">' + Object.keys(snSet).length + '</div><div class="l">SN ไม่ซ้ำ</div></div>' +
    '<div class="rr-stat"><div class="n" style="font-size:13px">' + (lastImport ? sanitize(lastImport.slice(0, 10)) : '-') + '</div><div class="l">นำเข้าล่าสุด</div></div>' +
    '</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' +
    '<button class="btn bp bsm" onclick="importDjiLedgerXlsx()">⬆️ นำเข้าไฟล์</button>' +
    '<button class="btn bo bsm" onclick="showDjlMatchM()">🔗 จับคู่เข้า SO</button>' +
    '</div></div>';

  h += '<div class="rr-toolbar">';
  ['sold', 'unauth', 'inbound'].forEach(function(k) {
    var b = DJL_BUCKETS[k];
    h += '<button class="btn bsm ' + (djlTab === k ? 'bp' : 'bo') + '" onclick="djlSetTab(\'' + k + '\')">' +
      b.icon + ' ' + b.label + ' (' + counts[k] + ')</button>';
  });
  h += '</div>';
  h += '<div class="hint" style="margin-bottom:8px">' + DJL_BUCKETS[djlTab].hint + '</div>';
  h += '<input type="text" class="inp" style="margin-bottom:10px" placeholder="🔍 ค้นหา SN / Invoice / EAN / Project ID / Dealer" value="' +
    sanitize(djlQ) + '" oninput="djlQ=this.value;djlLimit=100;render()" autocomplete="off">';

  var list = _djlFiltered(dmap);
  if (!list.length) {
    h += '<div class="empty"><p>ไม่พบรายการที่ตรงกับที่ค้น</p></div>';
    el.innerHTML = h;
    return;
  }
  h += '<div style="overflow-x:auto"><table class="rr-tbl" style="min-width:640px"><thead><tr>' +
    '<th>วันที่</th><th>ประเภท</th><th>ปลายทาง</th><th>SN</th><th>EAN</th><th style="text-align:right">จำนวน</th><th>Invoice</th><th>Project ID</th>' +
    '</tr></thead><tbody>';
  list.slice(0, djlLimit).forEach(function(m) {
    var fail = m.status !== DJL_OK_STATUS;
    h += '<tr' + (fail ? ' style="opacity:.5"' : '') + '>' +
      '<td style="font-family:monospace">' + sanitize(m.date) + '</td>' +
      '<td>' + sanitize(m.type) + (fail ? ' <span style="color:var(--danger,#ef4444)">✕ ' + sanitize(m.status) + '</span>' : '') + '</td>' +
      '<td>' + sanitize(String(m.name || m.code).substr(0, 26)) + '</td>' +
      '<td style="font-family:monospace">' + (m.sn ? qcopyHtml(m.sn) : '<span style="color:var(--text2)">— ไม่มี SN</span>') + '</td>' +
      '<td style="font-family:monospace">' + sanitize(m.ean) + '</td>' +
      '<td style="text-align:right">' + (m.qty || 0) + '</td>' +
      '<td style="font-family:monospace">' + sanitize(m.inv) + '</td>' +
      '<td>' + (m.pid ? sanitize(m.pid) : '—') + '</td>' +
      '</tr>';
  });
  h += '</tbody></table></div>';
  if (list.length > djlLimit) {
    h += '<button class="btn bo btn-full" style="margin-top:8px" onclick="djlLimit+=200;render()">โหลดเพิ่ม (เหลืออีก ' + (list.length - djlLimit) + ')</button>';
  }
  el.innerHTML = h;
}

// ---------------------------------------------------------------- ใช้จากหน้าค้นหา Serial
// ค้นแบบบางส่วนเหมือนหน้าค้นหา SO (พิมพ์ท้าย serial ก็เจอ) แล้วยุบเหลือ SN ละรายการ ไม่ใช่แถวละรายการ
function _djlSearchSN(q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return [];
  var hit = {};
  ST.getAll('djiMovements').forEach(function(m) {
    if (m.sn && m.sn.toLowerCase().indexOf(q) !== -1) hit[m.sn] = 1;
  });
  return Object.keys(hit).sort().slice(0, 30);
}

function _djlSNCardHtml(sn) {
  var st = djlSNStatus(sn);
  if (!st) return '';
  var m = st.last;
  var dealer = djlDealerOf(m);
  var h = '<div class="card" style="padding:14px 18px;margin-bottom:10px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
    '<span style="font-family:monospace;font-weight:700;font-size:14px">' + qcopyHtml(sn) + '</span>' +
    '<span style="font-size:11px;color:var(--text2)">EAN ' + sanitize(m.ean) + '</span></div>';
  h += '<table style="width:100%;font-size:12px">';
  h += '<tr><td style="color:var(--text2);padding:3px 0;width:35%">📍 สถานะล่าสุด</td><td style="text-align:right">' + sanitize(st.label) + '</td></tr>';
  h += '<tr><td style="color:var(--text2);padding:3px 0">📅 วันที่</td><td style="text-align:right">' + sanitize(m.date) + '</td></tr>';
  h += '<tr><td style="color:var(--text2);padding:3px 0">🧾 Invoice</td><td style="text-align:right;font-family:monospace">' + qcopyHtml(m.inv) + '</td></tr>';
  if (m.pid) h += '<tr><td style="color:var(--text2);padding:3px 0">🗂️ Project ID</td><td style="text-align:right">' + qcopyHtml(m.pid) + '</td></tr>';
  if (dealer) h += '<tr><td style="color:var(--text2);padding:3px 0">🏪 Dealer</td><td style="text-align:right"><a href="#" onclick="go(\'dealerDetail\',{dealerId:\'' + dealer.id + '\'});return false">' + sanitize(dealer.name) + '</a></td></tr>';
  h += '</table>';
  h += djlSNHistoryHtml(sn);
  return h + '</div>';
}
