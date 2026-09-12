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
            ship: _djlDate(col.map.ship === undefined ? '' : r[col.map.ship]),
            // ลำดับแถวในไฟล์ — วันที่ในไฟล์ละเอียดแค่ระดับวัน เครื่องที่ถูกส่งออกแล้วรับคืนในวันเดียวกัน
            // (ในไฟล์จริงมี 306 คู่) จึงเรียงด้วยวันที่อย่างเดียวไม่ได้ ต้องใช้ลำดับที่ DJI เรียงมาช่วย
            seq: recs.length
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
  if (!saved.length) {
    // เขียนลงเครื่องไม่สำเร็จ (พื้นที่เต็ม) — หยุดตรงนี้ ห้ามดันของเดิมขึ้น cloud ทับของจริง
    closeMForce();
    toast('❌ นำเข้าไม่สำเร็จ — เนื้อที่เก็บข้อมูลในเบราว์เซอร์ไม่พอ', true);
    return;
  }
  window._djlPending = null;

  // ต้องรอให้เขียนขึ้น cloud เสร็จจริงก่อนบอกว่าสำเร็จ — เดิมยิงแบบไม่รอผลแล้วปิดหน้าต่างทันที ผู้ใช้กด
  // refresh ตอนเขียนยังไม่เสร็จ listener ก็เอา "เท่าที่ลงแล้ว" มาเขียนทับ ข้อมูล 4,541 แถวเหลือ 10
  // (เจอจริง 2026-09-12) ระหว่างรอจึงล็อกปุ่มไว้และบอกว่ากำลังทำอะไรอยู่
  _djlImportBusy('กำลังบันทึกขึ้น Cloud — อย่าเพิ่งปิดหรือรีเฟรชหน้านี้');
  var done = function(okCloud) {
    closeMForce();
    toast(okCloud === false
      ? '✅ นำเข้า ' + saved.length + ' แถวในเครื่องแล้ว — แต่ยังไม่ขึ้น Cloud'
      : '✅ นำเข้า ' + saved.length + ' แถวแล้ว');
    go('djiLedger');
  };
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiMovements').then(done, function() { done(false); });
  else done();
}

// ล็อกหน้าต่างระหว่างเขียนขึ้น cloud — ปุ่มกดไม่ได้ และบอกให้ชัดว่าอย่าเพิ่งรีเฟรช
function _djlImportBusy(msg) {
  var body = document.getElementById('mBd');
  if (!body) return;
  body.innerHTML = '<div style="padding:18px;text-align:center">' +
    '<div style="font-size:26px;margin-bottom:8px">⏳</div>' +
    '<div style="font-size:13px">' + sanitize(msg) + '</div></div>';
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
    _djlBust();
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
  // เรียงด้วยวันที่ก่อน แล้วค่อยลำดับในไฟล์ — วันเดียวกันเรียงตามที่ DJI ส่งมา ซึ่งเป็นสัญญาณที่ดีที่สุดที่มี
  ev = ev.slice().sort(function(a, b) {
    var d = (a.date || '').localeCompare(b.date || '');
    return d !== 0 ? d : ((Number(a.seq) || 0) - (Number(b.seq) || 0));
  });
  var last = ev[ev.length - 1];
  // วันเดียวกันและไม่มีลำดับให้เทียบ (ข้อมูลนำเข้าก่อนมี seq) → บอกตรงๆ ว่าฟันธงไม่ได้ ดีกว่าเดา
  var tiedUnknown = ev.length > 1 && ev[ev.length - 2].date === last.date &&
                    ev[ev.length - 2].type !== last.type &&
                    !(Number(last.seq) || Number(ev[ev.length - 2].seq));
  var label = last.type === DJL_SELL_TYPE ? 'อยู่กับ ' + (last.name || last.code)
            : last.type === 'Distribution Return In' ? 'รับคืนกลับมาแล้ว'
            : last.type === 'Purchase Receipt' ? 'รับเข้าคลัง'
            : 'ตัดออก (' + last.type + ')';
  if (tiedUnknown) label += ' (วันเดียวกันมีหลายรายการ — เช็คในประวัติอีกที)';
  return { events: ev, last: last, label: label, returned: last.type !== DJL_SELL_TYPE, uncertain: tiedUnknown };
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
  _djlBust();
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
  var noPid = 0, invSeen = {};
  all.forEach(function(m) {
    if (djlBucket(m, dmap) !== 'sold' || m.status !== DJL_OK_STATUS || m.type !== DJL_SELL_TYPE) return;
    var k = _djlNormInv(m.inv);
    if (!k || invSeen[k]) return;
    invSeen[k] = 1;
    if (!pidNorm(m.pid)) noPid++;
  });
  var autoPid = djlAutoPidPlan().length;
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' +
    '<button class="btn bp bsm" onclick="importDjiLedgerXlsx()">⬆️ นำเข้าไฟล์</button>' +
    '<button class="btn bo bsm" onclick="showDjlMatchM()">🔗 จับคู่เข้า SO</button>' +
    (autoPid ? '<button class="btn bsm bo" style="border-color:var(--ok,#22c55e);color:var(--ok,#22c55e)" onclick="showDjlAutoPidM()">⚡ ดึง Project ID จาก SO ได้ ' + autoPid + ' ใบ</button>' : '') +
    '</div>';
  if (noPid) h += '<div class="hint" style="margin-top:8px">🗂️ ยังไม่มี Project ID อยู่ ' + noPid + ' ใบ — กดดู “รายใบ Invoice” แล้วใส่ทีเดียวได้ทั้งใบ (หนึ่ง invoice มีได้โครงการเดียว)</div>';
  h += '</div>';

  h += '<div class="rr-toolbar">';
  ['sold', 'unauth', 'inbound'].forEach(function(k) {
    var b = DJL_BUCKETS[k];
    h += '<button class="btn bsm ' + (djlTab === k ? 'bp' : 'bo') + '" onclick="djlSetTab(\'' + k + '\')">' +
      b.icon + ' ' + b.label + ' (' + counts[k] + ')</button>';
  });
  h += '</div>';
  h += '<div class="hint" style="margin-bottom:8px">' + DJL_BUCKETS[djlTab].hint + '</div>';
  h += '<div class="rr-toolbar">' +
    '<span style="font-size:11px;color:var(--text2);align-self:center">ดูเป็น</span>' +
    '<button class="btn bsm ' + (djlView === 'row' ? 'bp' : 'bo') + '" onclick="djlSetView(\'row\')">รายแถว</button>' +
    '<button class="btn bsm ' + (djlView === 'invoice' ? 'bp' : 'bo') + '" onclick="djlSetView(\'invoice\')">🧾 รายใบ Invoice</button>' +
    '</div>';
  if (djlView === 'invoice') {
    var fc = _djlFilterCounts(dmap);
    h += '<div class="rr-toolbar">' +
      '<span style="font-size:11px;color:var(--text2);align-self:center">กรอง</span>' +
      [['all', 'ทั้งหมด', fc.all], ['nopid', 'ยังไม่มี Project ID', fc.nopid],
       ['prefixed', 'มีคำนำหน้า ID/ProjectID', fc.prefixed], ['badfmt', 'รูปแบบผิด', fc.badfmt]]
      .map(function(f) {
        return '<button class="btn bsm ' + (djlInvFilter === f[0] ? 'bp' : 'bo') + '" onclick="djlSetInvFilter(\'' + f[0] + '\')">' +
          f[1] + ' (' + f[2] + ')</button>';
      }).join('') +
      (fc.prefixed ? '<button class="btn bsm bo" style="border-color:var(--ok,#22c55e);color:var(--ok,#22c55e)" onclick="showDjlNormalizeM()">✨ จัดรูปแบบให้เป็นมาตรฐาน</button>' : '') +
      '</div>';
  }
  h += '<input type="text" class="inp" style="margin-bottom:10px" placeholder="🔍 ค้นหา SN / Invoice / EAN / Project ID / Dealer" value="' +
    sanitize(djlQ) + '" oninput="djlQ=this.value;djlLimit=100;render()" autocomplete="off">';

  if (djlView === 'invoice') { _djlRenderInvoiceView(el, h, dmap); return; }

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

// ================================================================
// มุมมองรายใบ Invoice — สำหรับเติม Project ID ที่ DJI ไม่ได้ใส่มาให้
//
// ในไฟล์จริง Project ID ติดมาแค่ 474 จาก 4,541 แถว ที่เหลือว่าง แต่ไม่ต้องเติมทีละแถว: ตรวจกับข้อมูลจริง
// แล้ว "ไม่มี invoice ใบไหนเลยที่มีหลาย Project ID" (0 จาก 336 ใบ) และใบที่ DJI ใส่มาก็ใส่ครบทุกแถวเสมอ
// หนึ่งใบจึงเท่ากับหนึ่งโครงการ เติมทีเดียวทั้งใบได้ — งานจาก 3,387 แถวเหลือ 329 ใบ
//
// เลขเดียวกันใช้ได้หลายใบ (ในไฟล์มี ID20260611-0022 กระจาย 3 ใบ) ตัวเลือกจึงจำเลขที่เพิ่งใช้ไว้ให้กดซ้ำ
// ================================================================
var djlView = 'row', djlInvSel = {}, djlInvFilter = 'all', djlLastPid = '';
// เก็บชื่อเดิมไว้ เผื่อโค้ด/เทสต์เก่ายังอ้างอยู่
Object.defineProperty(window, 'djlInvOnly', {
  get: function() { return djlInvFilter === 'nopid'; },
  set: function(v) { djlInvFilter = v ? 'nopid' : 'all'; },
  configurable: true
});

function djlSetView(v) { djlView = v; djlLimit = 100; render(); }
function djlSetInvFilter(v) { djlInvFilter = v; djlLimit = 100; render(); }
function djlToggleInvOnly() { djlSetInvFilter(djlInvFilter === 'nopid' ? 'all' : 'nopid'); }

// ดัชนี invoice → SO สร้างครั้งเดียวต่อรอบวาดจอ — เดิมเรียก ST.getAll('salesOrders') ใหม่ทุกใบ
// (อ่าน+parse localStorage ทั้งก้อน) คูณ 300 กว่าใบ คูณอีกทุกตัวอักษรที่พิมพ์ในช่องค้นหา จอค้างเป็นวินาที
// ล้างด้วย _djlBust() ทุกครั้งที่แก้ SO หรือเริ่มวาดจอใหม่ จะได้ไม่อ่านของเก่า
// ผูกกับเลขรุ่นของข้อมูล (ST.rev()) ด้วย เผื่อมีการเขียน SO ระหว่างที่ยังอยู่หน้าเดิม
var _djlSOIndex = null, _djlIdxRev = -1;
function _djlBust() { _djlSOIndex = null; _djlIdxRev = -1; }
function _djlSOByInvoice() {
  var r = (typeof ST.rev === 'function') ? ST.rev() : 0;
  if (r !== _djlIdxRev) { _djlSOIndex = null; _djlIdxRev = r; }
  if (_djlSOIndex) return _djlSOIndex;
  var idx = {};
  ST.getAll('salesOrders').forEach(function(s) {
    var k = _djlNormInv(s.invoiceNumber);
    if (k) (idx[k] = idx[k] || []).push(s);
  });
  _djlSOIndex = idx;
  return idx;
}

// SO ที่ใช้เลข invoice ใบนี้ — สะพานเดียวกับที่ใช้เติม SN (ดู djlPlanMatch)
function _djlSOsForInvoice(inv) {
  var k = _djlNormInv(inv);
  if (!k) return [];
  return _djlSOByInvoice()[k] || [];
}
// Project ID ที่ SO ฝั่งเรารู้อยู่แล้ว — แบบโครงการอ่านจาก so.projectId แบบ run rate อ่านจากถังที่ผูก
function _djlPidFromSO(inv) {
  var found = '';
  _djlSOsForInvoice(inv).forEach(function(s) {
    if (found) return;
    if (pidNorm(s.projectId)) { found = s.projectId; return; }
    if (s.runrateId) {
      var r = ST.getOne('runrate', s.runrateId);
      if (r && pidNorm(r.projectId)) found = r.projectId;
    }
  });
  return found;
}

function _djlInvoiceGroups(dmap) {
  var by = {};
  ST.getAll('djiMovements').forEach(function(m) {
    if (djlBucket(m, dmap) !== djlTab) return;
    var k = _djlNorm(m.inv) || '(ไม่มีเลข)';
    var g = by[k] || (by[k] = { inv: m.inv, ids: [], rows: 0, qty: 0, sns: {}, eans: {}, pid: '', date: '', name: m.name, code: m.code, types: {}, fail: 0 });
    g.ids.push(m.id);
    g.rows++;
    g.qty += Number(m.qty) || 0;
    if (m.sn) g.sns[m.sn] = 1;
    if (m.ean) g.eans[m.ean] = 1;
    if (m.type) g.types[m.type] = 1;
    if (m.status !== DJL_OK_STATUS) g.fail++;
    if (pidNorm(m.pid) && !g.pid) g.pid = m.pid;
    if ((m.date || '') > g.date) g.date = m.date || '';
  });
  var q = djlQ.trim().toLowerCase();
  return Object.keys(by).map(function(k) { return by[k]; }).filter(function(g) {
    if (djlInvFilter === 'nopid' && pidNorm(g.pid)) return false;
    // "รูปแบบผิด" = มีเลขแล้วแต่ไม่เข้ารูปแบบ YYYYMMDD-NNNN เลย (คำนำหน้า ID/ProjectID ไม่นับว่าผิด
    // เพราะ pidLooksValid มองทะลุคำนำหน้าให้อยู่แล้ว — ตัวที่ติดกรองนี้คือเลขที่พิมพ์ผิดจริงๆ)
    if (djlInvFilter === 'badfmt' && (!pidNorm(g.pid) || pidLooksValid(g.pid))) return false;
    // "มีคำนำหน้า" = เลขอ่านออก (มีไส้ใน) แต่เขียนติดคำว่า ID/ProjectID มา — จัดให้เป็นมาตรฐานได้
    // ต้องเช็คว่ามีไส้ในก่อน ไม่งั้นเลขที่อ่านไม่ออก (pidCore คืน '') จะหลุดเข้ามาด้วยเพราะ '' ไม่เท่ากับตัวมันเอง
    if (djlInvFilter === 'prefixed') {
      var core = pidCore(g.pid);
      if (!core || core === pidNorm(g.pid)) return false;
    }
    if (!q) return true;
    return (g.inv || '').toLowerCase().indexOf(q) !== -1 ||
           (g.name || '').toLowerCase().indexOf(q) !== -1 ||
           (g.pid || '').toLowerCase().indexOf(q) !== -1 ||
           Object.keys(g.sns).some(function(x) { return x.toLowerCase().indexOf(q) !== -1; }) ||
           Object.keys(g.eans).some(function(x) { return x.indexOf(q) !== -1; });
  }).sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
}

// เขียนเลขลงทุกแถวของใบนั้นทีเดียว — updateMany อ่าน/เขียน collection รอบเดียว ไม่ใช่ทีละแถว
// silent = ผู้เรียกกำลังวนหลายใบอยู่ → ไม่ toast และ "ไม่ดันขึ้น cloud รายใบ" เพราะ pushDjiDataToCloud เขียน
// ทั้งคอลเลกชันทุกครั้ง เรียกในลูป 300 รอบคือเขียนทับกันเอง 300 ชุดแบบไม่เรียงลำดับ ชุดเก่าอาจลงทีหลัง
// แล้ว login ครั้งถัดไปดึงของเก่ากลับมาทับ — ผู้เรียกต้องเรียก pushDjiDataToCloud เองครั้งเดียวตอนจบ
function djlSetInvoicePid(inv, pid, silent) {
  var k = _djlNormInv(inv);
  var ids = ST.filter('djiMovements', function(m) { return _djlNormInv(m.inv) === k; }).map(function(m) { return m.id; });
  if (!ids.length) return 0;
  var changed = ST.updateMany('djiMovements', ids, { pid: pidNorm(pid) });
  if (pidNorm(pid)) djlLastPid = pidNorm(pid);
  if (!silent) {
    if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiMovements');
    toast('🗂️ ใส่ ' + (pidNorm(pid) || '(ล้างเลข)') + ' ให้ ' + changed.length + ' แถวของใบนี้แล้ว');
  }
  return changed.length;
}

// ---- ดึงจาก SO ที่ผูกไว้แล้ว: ไม่ต้องพิมพ์อะไรเลย ----
function djlAutoPidPlan() {
  _djlBust();
  var dmap = _djlDealerByCode();
  var seen = {}, out = [];
  ST.getAll('djiMovements').forEach(function(m) {
    if (djlBucket(m, dmap) !== 'sold' || pidNorm(m.pid)) return;
    var k = _djlNormInv(m.inv);
    if (!k || seen[k]) return;
    seen[k] = 1;
    var pid = _djlPidFromSO(m.inv);
    if (pid) out.push({ inv: m.inv, pid: pid });
  });
  return out;
}
function showDjlAutoPidM() {
  var plan = djlAutoPidPlan();
  window._djlPidPlan = plan;
  var h = '<div class="hint" style="margin-bottom:10px">ใบไหนที่เราเปิด SO ไว้แล้วและ SO นั้นรู้ Project ID อยู่แล้ว ก็ไม่ต้องพิมพ์ซ้ำ — ดึงมาใส่ให้เลย</div>';
  if (!plan.length) {
    h += '<div class="empty"><p>ไม่มีใบไหนที่ดึงจาก SO ได้ตอนนี้ — อาจยังไม่ได้เปิด SO หรือ SO ยังไม่มี Project ID</p></div>' +
      '<button class="btn bo btn-full" onclick="closeMForce()">ปิด</button>';
  } else {
    h += '<div style="max-height:240px;overflow:auto;display:flex;flex-direction:column;gap:5px;margin-bottom:10px">';
    plan.slice(0, 40).forEach(function(x) {
      h += '<div style="border:1px solid var(--border);border-radius:7px;padding:6px 9px;display:flex;justify-content:space-between;gap:8px;font-size:12px">' +
        '<span style="font-family:monospace">' + sanitize(x.inv) + '</span>' +
        '<span style="font-family:monospace;color:var(--ok,#22c55e)">' + sanitize(x.pid) + '</span></div>';
    });
    if (plan.length > 40) h += '<div style="font-size:11px;color:var(--text2);padding:4px">…อีก ' + (plan.length - 40) + '</div>';
    h += '</div>';
    h += '<button class="btn bp btn-full" onclick="djlCommitAutoPid()">🗂️ ใส่ให้ ' + plan.length + ' ใบ</button>';
    h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="closeMForce()">ยกเลิก</button>';
  }
  openM('⚡ ดึง Project ID จาก SO', h);
}
function djlCommitAutoPid() {
  var plan = window._djlPidPlan || [];
  var n = 0;
  plan.forEach(function(x) { n += djlSetInvoicePid(x.inv, x.pid, true) ? 1 : 0; });
  window._djlPidPlan = null;
  if (n && typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiMovements');
  closeMForce();
  toast('✅ ใส่ Project ID ให้ ' + n + ' ใบแล้ว');
  render();
}

// ---- ตัวเลือกเลข: กดเอา ไม่ต้องพิมพ์ 13 ตัว ----
function _djlPidChoices(dealerId) {
  var out = [], seen = {};
  var add = function(pid, label, src, owner) {
    var c = pidNorm(pid);
    if (!c || seen[c.toLowerCase()]) return;
    seen[c.toLowerCase()] = 1;
    out.push({ pid: c, label: label, src: src, owner: dealerId ? '' : (owner || '') });
  };
  if (djlLastPid) add(djlLastPid, 'เลขที่เพิ่งใช้', '🕘');
  // ทะเบียนจาก CRM ของ dealer รายนี้ — แหล่งที่ตรงที่สุด เพราะเลขมาจากที่เดียวกัน
  ST.getAll('djiProjects').forEach(function(p) {
    var d = (typeof djpDealerOf === 'function') ? djpDealerOf(p) : null;
    if (dealerId && (!d || d.id !== dealerId)) return;
    add(p.pid, String(p.name || '').substr(0, 44), '🗂️', d ? d.name : p.dealerName);
  });
  ST.getAll('runrate').forEach(function(r) {
    if (dealerId && r.dealerId !== dealerId) return;
    add(r.projectId, 'ถัง Run rate' + (r.models ? ' · ' + String(r.models).substr(0, 22) : ''), '🏪',
        (ST.getOne('dealers', r.dealerId) || {}).name);
  });
  ST.getAll('pipeline').forEach(function(pipe) {
    if (dealerId && pipe.dealerId !== dealerId) return;
    add(pipe.projectId, String(pipe.projectName || '').substr(0, 44), '📋',
        (ST.getOne('dealers', pipe.dealerId) || {}).name);
  });
  return out;
}

function showDjlPidM(inv) {
  var dmap = _djlDealerByCode();
  var rows = ST.djiMovesByInvoice(inv);
  if (!rows.length) return;
  var first = rows[0];
  var dealer = djlDealerOf(first, dmap);
  var cur = '';
  rows.forEach(function(m) { if (!cur && pidNorm(m.pid)) cur = m.pid; });
  var fromSO = _djlPidFromSO(inv);
  var sos = _djlSOsForInvoice(inv);

  var h = '<div style="border:1px solid var(--border);border-radius:8px;padding:9px 11px;margin-bottom:10px">' +
    '<div style="font-family:monospace;font-weight:700">🧾 ' + sanitize(inv) + '</div>' +
    '<div style="font-size:11px;color:var(--text2);margin-top:2px">' + sanitize(first.name || first.code) +
    ' · ' + rows.length + ' แถว · ' + Object.keys(rows.reduce(function(a, m) { if (m.sn) a[m.sn] = 1; return a; }, {})).length + ' SN' +
    (first.date ? ' · ' + sanitize(first.date) : '') + '</div>' +
    (sos.length ? '<div style="font-size:11px;color:var(--text2);margin-top:2px">📦 SO: ' +
      sos.map(function(s) { return sanitize(s.soNumber || '-'); }).join(', ') + '</div>' : '') +
    '</div>';
  h += '<div class="hint" style="margin-bottom:8px">ใส่ทีเดียวใช้กับทุกแถวของใบนี้ — ตรวจกับข้อมูลจริงแล้วหนึ่ง invoice มีได้โครงการเดียวเสมอ</div>';

  if (fromSO && !pidSame(fromSO, cur)) {
    h += '<div style="border:1px solid var(--ok,#22c55e);border-radius:8px;padding:9px 11px;margin-bottom:8px;cursor:pointer" onclick="djlApplyPid(' + jsArg(inv) + ',' + jsArg(fromSO) + ')">' +
      '<div style="font-size:12.5px;font-weight:600">✓ SO ของใบนี้รู้เลขอยู่แล้ว — กดใช้ได้เลย</div>' +
      '<div style="font-family:monospace;font-size:12px;margin-top:2px">' + sanitize(fromSO) + '</div></div>';
  }

  h += '<div class="fg"><label>Project ID <small style="color:var(--text2)">(' + PROJECT_ID_HINT + ')</small></label>' +
    '<input type="text" id="djlPidInput" class="inp" value="' + sanitize(cur) + '" placeholder="20260912-0005"></div>';
  h += '<button class="btn bp btn-full" style="margin:8px 0" onclick="djlApplyPid(' + jsArg(inv) + ')">💾 บันทึก</button>';

  // กรองตาม Dealer ก่อนเพราะตรงที่สุด แต่ถ้า Dealer รายนั้นไม่มีเลขเลย อย่าโชว์ว่างเปล่า — ถอยไปโชว์ทั้งหมด
  // (เจอตอนรันจริง: SYSTRONICS ไม่มีโครงการในทะเบียน แล้วหน้าไปบอกว่า "ยังไม่ได้นำเข้าทะเบียน" ทั้งที่นำเข้าแล้ว)
  var choices = _djlPidChoices(dealer ? dealer.id : '');
  var narrowed = true;
  if (!choices.length && dealer) { choices = _djlPidChoices(''); narrowed = false; }
  if (choices.length) {
    h += '<div class="hint" style="margin-bottom:6px">' + (narrowed
      ? 'หรือเลือกจากเลขที่มีอยู่แล้วของ ' + sanitize(dealer ? dealer.name : 'Dealer รายนี้')
      : '⚠️ ' + sanitize(dealer.name) + ' ยังไม่มีเลขในระบบเลย — แสดงเลขของทุก Dealer ให้เลือก เช็คให้ดีก่อนกด') + '</div>';
    h += '<div style="max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:5px">';
    choices.slice(0, 40).forEach(function(c) {
      h += '<div style="border:1px solid var(--border);border-radius:7px;padding:6px 9px;cursor:pointer" onclick="djlApplyPid(' + jsArg(inv) + ',' + jsArg(c.pid) + ')">' +
        '<div style="font-family:monospace;font-size:12px;font-weight:600">' + c.src + ' ' + sanitize(c.pid) + '</div>' +
        '<div style="font-size:11px;color:var(--text2)">' + sanitize(c.label) + (c.owner ? ' · ' + sanitize(c.owner) : '') + '</div></div>';
    });
    h += '</div>';
  } else {
    var hasReg = ST.getAll('djiProjects').length;
    h += '<div class="hint">' + (hasReg
      ? 'ยังไม่มีเลขไหนในระบบให้เลือก — พิมพ์เองได้ที่ช่องด้านบน'
      : 'ยังไม่ได้นำเข้าทะเบียน Project ID จาก DJI CRM — นำเข้าแล้วจะมีเลขให้กดเลือกที่นี่') + '</div>';
  }
  if (cur) h += '<button class="btn bd btn-full" style="margin-top:8px" onclick="djlApplyPid(' + jsArg(inv) + ',\'\',1)">🗑️ ล้างเลขออกจากใบนี้</button>';
  openM('🗂️ ใส่ Project ID ให้ใบ Invoice', h);
}

function djlApplyPid(inv, pid, allowEmpty) {
  var v = pid !== undefined ? pid : ((document.getElementById('djlPidInput') || {}).value || '');
  v = pidNorm(v);
  if (!v && !allowEmpty) { alert('ใส่เลขก่อนนะครับ'); return; }
  if (v) {
    var warn = pidFormatWarning(v);
    if (warn && !confirm('⚠️ ' + warn + '\n\nที่กรอก: ' + v + '\n\nตกลง = บันทึกตามนี้  ยกเลิก = กลับไปแก้')) return;
  }
  djlSetInvoicePid(inv, v);

  // SO ฝั่งเรายังไม่มีเลข แต่เพิ่งได้จากสมุด — เขียนกลับให้ด้วย จะได้ไม่ต้องไปกรอกซ้ำอีกที่
  if (v) {
    _djlSOsForInvoice(inv).forEach(function(s) {
      if (s.type === 'runrate' || pidNorm(s.projectId)) return;
      if (!confirm('SO ' + (s.soNumber || '') + ' ยังไม่มี Project ID\n\nใส่ ' + v + ' ให้ด้วยไหม?')) return;
      var up = ST.update('salesOrders', s.id, { projectId: v });
      _djlBust();
      if (up && typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', up);
      if (up && up.pipelineId && typeof pidWriteBackToPipeline === 'function') {
        pidWriteBackToPipeline(up.pipelineId, v, 'ใส่จากสมุดเดินของ invoice ' + inv);
      }
    });
  }
  closeMForce();
  render();
}

// ---- ทำทีเดียวหลายใบ (เลขเดียวใช้ได้หลายใบจริงในข้อมูล) ----
function djlToggleInv(inv, el) { if (el && el.checked) djlInvSel[inv] = 1; else delete djlInvSel[inv]; render(); }
function djlClearInvSel() { djlInvSel = {}; render(); }
function djlBulkPid() {
  var invs = Object.keys(djlInvSel);
  if (!invs.length) return;
  var first = ST.djiMovesByInvoice(invs[0])[0];
  var dealer = first ? djlDealerOf(first) : null;
  var choices = _djlPidChoices(dealer ? dealer.id : '');
  var h = '<div class="hint" style="margin-bottom:10px">ใส่เลขเดียวกันให้ ' + invs.length + ' ใบที่เลือก — เลขเดียวใช้ได้หลายใบ (ในไฟล์จริงมีเลขที่กระจาย 3 ใบ)</div>';
  h += '<div class="fg"><label>Project ID</label><input type="text" id="djlBulkPidInput" class="inp" value="' + sanitize(djlLastPid) + '" placeholder="20260912-0005"></div>';
  h += '<button class="btn bp btn-full" style="margin:8px 0" onclick="djlCommitBulkPid()">💾 ใส่ให้ทั้ง ' + invs.length + ' ใบ</button>';
  if (choices.length) {
    h += '<div class="hint" style="margin-bottom:6px">หรือเลือกจากเลขที่มีอยู่</div><div style="max-height:200px;overflow:auto;display:flex;flex-direction:column;gap:5px">';
    choices.slice(0, 30).forEach(function(c) {
      h += '<div style="border:1px solid var(--border);border-radius:7px;padding:6px 9px;cursor:pointer" onclick="document.getElementById(\'djlBulkPidInput\').value=' + jsArg(c.pid) + '">' +
        '<div style="font-family:monospace;font-size:12px">' + c.src + ' ' + sanitize(c.pid) + '</div>' +
        '<div style="font-size:11px;color:var(--text2)">' + sanitize(c.label) + '</div></div>';
    });
    h += '</div>';
  }
  openM('🗂️ ใส่ Project ID หลายใบ', h);
}
function djlCommitBulkPid() {
  var v = pidNorm((document.getElementById('djlBulkPidInput') || {}).value);
  if (!v) { alert('ใส่เลขก่อนนะครับ'); return; }
  var warn = pidFormatWarning(v);
  if (warn && !confirm('⚠️ ' + warn + '\n\nตกลง = บันทึกตามนี้')) return;
  var n = 0;
  Object.keys(djlInvSel).forEach(function(inv) { if (djlSetInvoicePid(inv, v, true)) n++; });
  djlInvSel = {};
  if (n && typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiMovements');
  closeMForce();
  toast('✅ ใส่ ' + v + ' ให้ ' + n + ' ใบแล้ว');
  render();
}

// ---- มุมมองรายใบ: หนึ่งการ์ดต่อหนึ่ง invoice พร้อมช่องใส่ Project ID ----
function _djlRenderInvoiceView(el, h, dmap) {
  var groups = _djlInvoiceGroups(dmap);
  var selN = Object.keys(djlInvSel).length;
  h += '<div class="card" style="padding:9px 12px;margin-bottom:10px;gap:8px;flex-wrap:wrap;align-items:center;display:' +
    (selN ? 'flex' : 'none') + '">' +
    '<b style="font-size:12px">เลือกไว้ ' + selN + ' ใบ</b>' +
    '<button class="btn bsm bp" onclick="djlBulkPid()">🗂️ ใส่ Project ID เดียวกัน</button>' +
    '<button class="btn bsm bo" onclick="djlClearInvSel()">ล้างที่เลือก</button></div>';

  if (!groups.length) {
    var emptyMsg = { nopid: 'ใส่ Project ID ครบทุกใบแล้ว 🎉',
                     prefixed: 'ไม่มีเลขที่ติดคำนำหน้าเหลือแล้ว 🎉',
                     badfmt: 'ไม่มีเลขที่รูปแบบผิดเหลือแล้ว 🎉' }[djlInvFilter] || 'ไม่พบใบที่ตรงกับที่ค้น';
    h += '<div class="empty"><p>' + emptyMsg + '</p></div>';
    el.innerHTML = h;
    return;
  }
  h += '<div style="font-size:11px;color:var(--text2);margin-bottom:6px">' + groups.length + ' ใบ' +
    (djlLimit < groups.length ? ' · แสดง ' + djlLimit + ' ใบแรก' : '') + '</div>';
  h += '<div style="display:flex;flex-direction:column;gap:8px">';
  groups.slice(0, djlLimit).forEach(function(g) {
    var nsn = Object.keys(g.sns).length, nean = Object.keys(g.eans).length;
    var has = pidNorm(g.pid);
    h += '<div class="card" style="padding:11px 13px">';
    h += '<div style="display:flex;gap:9px;align-items:flex-start">';
    h += '<input type="checkbox" style="margin-top:3px"' + (djlInvSel[g.inv] ? ' checked' : '') +
      ' onchange="djlToggleInv(' + jsArg(g.inv) + ',this)">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline">' +
      '<span style="font-family:monospace;font-weight:700;font-size:13px">🧾 ' + qcopyHtml(g.inv) + '</span>' +
      '<span style="font-size:11px;color:var(--text2)">' + sanitize(g.date) + '</span></div>';
    h += '<div style="font-size:11.5px;color:var(--text2);margin-top:2px">' + sanitize(String(g.name || g.code).substr(0, 34)) +
      ' · ' + (nsn ? nsn + ' SN' : g.qty + ' ชิ้น') + ' · ' + nean + ' รุ่น' +
      (g.fail ? ' · <span style="color:var(--danger,#ef4444)">' + g.fail + ' แถวถูกตีกลับ</span>' : '') + '</div>';
    // แถวที่ไฟล์ไม่ได้ให้เลข invoice มา ผูก Project ID รายใบไม่ได้ (ไม่มีอะไรให้ผูกด้วย) — บอกไปตรงๆ
    // ดีกว่าโชว์ปุ่มที่กดแล้วไม่เกิดอะไรขึ้น
    var noInv = !_djlNorm(g.inv) || g.inv === '(ไม่มีเลข)';
    h += '<div style="margin-top:7px">' + (noInv
      ? '<span style="font-size:11px;color:var(--text2)">— ไฟล์ไม่ได้ให้เลข Invoice มา จึงใส่ Project ID รายใบไม่ได้</span>'
      : has
        ? '<span style="font-family:monospace;font-size:12px;color:var(--ok,#22c55e)">🗂️ ' + sanitize(g.pid) + '</span>' +
          ' <a href="#" onclick="showDjlPidM(' + jsArg(g.inv) + ');return false" style="font-size:11px;color:var(--text2)">แก้</a>'
        : '<button class="btn bsm bo" onclick="showDjlPidM(' + jsArg(g.inv) + ')">+ ใส่ Project ID</button>') + '</div>';
    h += '</div></div></div>';
  });
  h += '</div>';
  if (groups.length > djlLimit) {
    h += '<button class="btn bo btn-full" style="margin-top:8px" onclick="djlLimit+=200;render()">โหลดเพิ่ม (เหลืออีก ' + (groups.length - djlLimit) + ')</button>';
  }
  el.innerHTML = h;
}

// ---- นับจำนวนต่อตัวกรอง ----
function _djlFilterCounts(dmap) {
  dmap = dmap || _djlDealerByCode();
  var seen = {}, c = { all: 0, nopid: 0, prefixed: 0, badfmt: 0 };
  ST.getAll('djiMovements').forEach(function(m) {
    if (djlBucket(m, dmap) !== djlTab) return;
    var k = _djlNorm(m.inv) || '(ไม่มีเลข)';
    if (seen[k]) { if (pidNorm(m.pid) && !seen[k].pid) seen[k].pid = m.pid; return; }
    seen[k] = { pid: pidNorm(m.pid) };
  });
  Object.keys(seen).forEach(function(k) {
    var pid = seen[k].pid;
    c.all++;
    if (!pid) { c.nopid++; return; }
    if (!pidLooksValid(pid)) c.badfmt++;
    else if (pid !== pidCore(pid)) c.prefixed++;
  });
  return c;
}

// ---- จัดรูปแบบเลขให้เป็นมาตรฐาน ----
// ไฟล์ DJI เขียนเลขเดียวกันสามแบบ: 20260525-0016 / ID20260611-0022 / ProjectID20260615-0008
// ระบบเทียบทะลุคำนำหน้าให้อยู่แล้ว แต่การเก็บให้เป็นแบบเดียวทำให้ค้นหา คัดลอก และส่งต่อไม่สับสน
// ตัดเฉพาะคำนำหน้า ไม่แตะไส้ใน และไม่ยุ่งกับเลขที่อ่านไม่ออก (พวกนั้นต้องให้คนแก้เอง)
function djlNormalizePlan() {
  var dmap = _djlDealerByCode(), seen = {}, out = [];
  ST.getAll('djiMovements').forEach(function(m) {
    if (djlBucket(m, dmap) !== djlTab) return;
    var pid = pidNorm(m.pid);
    if (!pid) return;
    var core = pidCore(pid);
    if (!core || core === pid) return;
    var k = _djlNormInv(m.inv);
    if (seen[k]) return;
    seen[k] = 1;
    out.push({ inv: m.inv, from: pid, to: core });
  });
  return out;
}

function showDjlNormalizeM() {
  var plan = djlNormalizePlan();
  window._djlNormPlan = plan;
  var h = '<div class="hint" style="margin-bottom:10px">ไฟล์ DJI เขียนเลขเดียวกันหลายแบบปนกัน — ตัดคำนำหน้า <span style="font-family:monospace">ID</span> / <span style="font-family:monospace">ProjectID</span> ออกให้เหลือรูปแบบเดียว <span style="font-family:monospace">' + PROJECT_ID_HINT.replace('รูปแบบ ', '') + '</span><br>ไส้ในไม่ถูกแตะ และเลขที่อ่านไม่ออกจะไม่ถูกยุ่ง</div>';
  if (!plan.length) {
    h += '<div class="empty"><p>เลขทุกใบเป็นรูปแบบมาตรฐานอยู่แล้ว</p></div><button class="btn bo btn-full" onclick="closeMForce()">ปิด</button>';
  } else {
    h += '<div style="max-height:250px;overflow:auto;display:flex;flex-direction:column;gap:5px;margin-bottom:10px">';
    plan.slice(0, 40).forEach(function(x) {
      h += '<div style="border:1px solid var(--border);border-radius:7px;padding:6px 9px;font-size:12px">' +
        '<div style="font-family:monospace;color:var(--text2);font-size:11px">🧾 ' + sanitize(x.inv) + '</div>' +
        '<div style="font-family:monospace"><span style="color:var(--text2);text-decoration:line-through">' + sanitize(x.from) + '</span>' +
        ' → <b style="color:var(--ok,#22c55e)">' + sanitize(x.to) + '</b></div></div>';
    });
    if (plan.length > 40) h += '<div style="font-size:11px;color:var(--text2);padding:4px">…อีก ' + (plan.length - 40) + '</div>';
    h += '</div>';
    h += '<button class="btn bp btn-full" onclick="djlCommitNormalize()">✨ จัดรูปแบบให้ ' + plan.length + ' ใบ</button>';
    h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="closeMForce()">ยกเลิก</button>';
  }
  openM('✨ จัดรูปแบบ Project ID', h);
}

function djlCommitNormalize() {
  var plan = window._djlNormPlan || [];
  var n = 0;
  plan.forEach(function(x) { if (djlSetInvoicePid(x.inv, x.to, true)) n++; });
  window._djlNormPlan = null;
  if (n && typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiMovements');
  closeMForce();
  toast(n ? ('✨ จัดรูปแบบให้ ' + n + ' ใบแล้ว') : 'ไม่มีอะไรต้องแก้');
  render();
}
