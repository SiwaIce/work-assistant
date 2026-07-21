// ================================================================
// FORECAST HELPERS — เดือนส่งมอบ (tentative) + หมวดหมู่สินค้า
// ================================================================
var fcHideTentative = false;  // toggle: ซ่อนค่าประมาณการ (Bidding + 2 เดือน)

// parser วันที่ที่รองรับทั้ง ISO (YYYY-MM-DD) และ DD/MM/YYYY และ Date object
// (สำคัญ: shipmentDate/biddingDate เก็บเป็น ISO — ftParseDate เดิม parse ได้เฉพาะ DD/MM/YYYY)
function fcParseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v !== 'string') return null;
  var s = v.trim();
  if (!s) return null;
  var d = null;
  if (s.indexOf('-') !== -1) {               // ISO: YYYY-MM-DD (อาจมีเวลา/timezone ต่อท้าย)
    var datePart = s.split('T')[0].split(' ')[0];
    var a = datePart.split('-');
    if (a.length === 3) d = new Date(parseInt(a[0], 10), parseInt(a[1], 10) - 1, parseInt(a[2], 10));
  } else if (s.indexOf('/') !== -1) {        // DD/MM/YYYY
    var b = s.split('/');
    if (b.length === 3) d = new Date(parseInt(b[2], 10), parseInt(b[1], 10) - 1, parseInt(b[0], 10));
  }
  if (d && !isNaN(d.getTime())) return d;
  var fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// เดือนส่งมอบของโครงการ: shipmentDate จริง > biddingDate + 2 เดือน (ประมาณ) > null
function getPipeShipDate(p) {
  if (!p) return null;
  var sd = fcParseDate(p.shipmentDate);
  if (sd) return { date: sd, est: false };
  var bd = fcParseDate(p.biddingDate);
  if (bd) return { date: new Date(bd.getFullYear(), bd.getMonth() + 2, bd.getDate()), est: true };
  return null;
}

// หมวดหมู่ของ model (drone/payload/software/...) จากเมนูสินค้า
function getModelCategory(modelName) {
  if (modelName && typeof getProductByName === 'function') {
    var prod = getProductByName(modelName);
    if (prod && prod.category) return prod.category;
  }
  return 'other';
}

// คำอธิบาย (legend) จริง/ประมาณ — ใช้ร่วมในทุกตาราง forecast
function fcLegendHtml() {
  return '<div style="font-size:.64rem;color:var(--text2);margin:6px 0;line-height:1.5">' +
    '🔢 ตัวเลขปกติ = Shipment Date จริง · ' +
    '<span style="opacity:0.5">~ตัวเลขจาง</span> = ประมาณจาก Bidding Date + 2 เดือน (พอใส่ Shipment จริงจะย้ายไปเดือนจริงเอง)' +
    '</div>';
}

// ปุ่ม toggle ซ่อน/แสดงค่าประมาณ
function fcTentativeToggleHtml() {
  return '<label style="display:inline-flex;align-items:center;gap:6px;font-size:.72rem;cursor:pointer;color:var(--text2)">' +
    '<input type="checkbox" style="width:auto" ' + (fcHideTentative ? 'checked' : '') + ' onchange="fcToggleTentative()"> ' +
    'ซ่อนค่าประมาณ (แสดงเฉพาะ Shipment จริง)</label>';
}
function fcToggleTentative() {
  fcHideTentative = !fcHideTentative;
  if (typeof render === 'function') render();
}

// รวมยอดตามหมวดหมู่สินค้า (สำหรับ "Drone กี่ลำ / Software กี่อัน")
function fcComputeCategoryTotals(pipes, year) {
  var cats = {};
  (pipes || []).forEach(function(p) {
    var ship = getPipeShipDate(p);
    if (!ship) return;
    if (fcHideTentative && ship.est) return;
    if (year && ship.date.getFullYear() !== year) return;
    var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : [];
    items.forEach(function(it) {
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));
      var cat = getModelCategory(it.model);
      if (!cats[cat]) cats[cat] = { qty: 0, amt: 0 };
      cats[cat].qty += qty;
      cats[cat].amt += amt;
    });
  });
  return cats;
}

// ใช้ window[varName] เป็น object เก็บ id หมวดที่ "ปิด" อยู่ (ไม่เลือก) — ว่าง = ไม่มีตัวกรอง (แสดงทั้งหมด)
function fcCatIsVisible(varName, catId) {
  var f = varName && window[varName];
  return !(f && f[catId]);
}
function fcToggleCatFilter(varName, catId) {
  if (!window[varName]) window[varName] = {};
  if (window[varName][catId]) delete window[varName][catId];
  else window[varName][catId] = true;
  if (typeof render === 'function') render();
}
function fcResetCatFilter(varName) {
  window[varName] = {};
  if (typeof render === 'function') render();
}

// การ์ดสรุปตามหมวดหมู่ — ถ้าส่ง filterVarName มา การ์ดจะกดกรองได้ (toggle เปิด/ปิดทีละหมวด)
// ตัวเลขบนการ์ดเป็นยอดรวมจริงเสมอ ไม่ผันตามตัวกรอง (การ์ดคือตัวควบคุม ไม่ใช่ผลลัพธ์ที่ถูกกรอง)
function fcCategorySummaryHtml(pipes, year, filterVarName) {
  var cats = fcComputeCategoryTotals(pipes, year);
  var ids = Object.keys(cats);
  if (!ids.length) return '';
  var order = (typeof PRODUCT_CATEGORIES !== 'undefined') ? PRODUCT_CATEGORIES.map(function(c) { return c.id; }) : ids;
  ids.sort(function(a, b) { return order.indexOf(a) - order.indexOf(b); });
  var hasFilter = filterVarName && window[filterVarName] && Object.keys(window[filterVarName]).length > 0;
  var h = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;align-items:center">';
  ids.forEach(function(id) {
    var name = (typeof getCategoryName === 'function') ? getCategoryName(id) : id;
    var isOn = fcCatIsVisible(filterVarName, id);
    var clickable = !!filterVarName;
    var boxStyle = 'border-radius:10px;padding:8px 12px;min-width:108px' +
      (clickable ? ';cursor:pointer' : '') +
      (clickable && isOn ? ';border:2px solid var(--accent,#3b82f6)' : ';border:1px solid var(--border)') +
      (clickable && !isOn ? ';opacity:.45' : '');
    var onclick = clickable ? ' onclick="fcToggleCatFilter(\'' + filterVarName + '\',\'' + id + '\')"' : '';
    h += '<div style="' + boxStyle + '"' + onclick + '>' +
      '<div style="font-size:.7rem;color:var(--text2)">' + name + '</div>' +
      '<div style="font-weight:800;font-size:1.15rem">' + cats[id].qty + ' <span style="font-size:.58rem;color:var(--text2)">ชิ้น</span></div>' +
      '<div style="font-size:.6rem;color:var(--text2)">' + fmtMoneyShort(cats[id].amt) + '</div>' +
      '</div>';
  });
  if (hasFilter) {
    h += '<button class="btn bsm bo" onclick="fcResetCatFilter(\'' + filterVarName + '\')">✕ แสดงทั้งหมด</button>';
  }
  h += '</div>';
  return h;
}

// ================================================================
// EXPORT FORECAST → EXCEL (รายเดือน/รายไตรมาส) แบบ flat 1 แถว = 1 โครงการ ต่อ Model ต่อ ช่วงเวลา
// ใช้ร่วมกันทั้งเมนู Forecast และแท็บ Forecast ของ Dealer
// ================================================================
function _fcDateStr(d) {
  var p = function(n) { return n < 10 ? '0' + n : String(n); };
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}

// periodType: 'month' | 'quarter' — คืน array ของแถวเรียงตามช่วงเวลา > model > โครงการ
function fcBuildExportRows(pipes, catFilterVarName, periodType, year) {
  year = year || new Date().getFullYear();
  var monthLabels = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var qLabels = ['Q1','Q2','Q3','Q4'];

  var groupTotals = {};   // key: periodIdx+'||'+model -> {qty, amt}
  var lineByKey = {};     // key: periodIdx+'||'+model+'||'+projectId -> merged line

  (pipes || []).forEach(function(p) {
    var ship = getPipeShipDate(p);
    if (!ship) return;
    if (fcHideTentative && ship.est) return;
    if (ship.date.getFullYear() !== year) return;
    var periodIdx = periodType === 'quarter' ? Math.floor(ship.date.getMonth() / 3) : ship.date.getMonth();
    var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : [];
    if (!items.length) return;
    var dealer = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;

    items.forEach(function(it) {
      var model = it.model || 'ไม่ระบุ';
      if (catFilterVarName && !fcCatIsVisible(catFilterVarName, getModelCategory(model))) return;
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));

      var gKey = periodIdx + '||' + model;
      if (!groupTotals[gKey]) groupTotals[gKey] = { qty: 0, amt: 0 };
      groupTotals[gKey].qty += qty;
      groupTotals[gKey].amt += amt;

      var lKey = gKey + '||' + p.id;
      if (!lineByKey[lKey]) {
        lineByKey[lKey] = {
          periodIdx: periodIdx, model: model,
          projectName: p.projectName || '-', dealerName: dealer ? dealer.name : '',
          qty: 0, amt: 0, shipDate: ship.date, est: ship.est, isRunrate: !!p._isRunrate
        };
      }
      lineByKey[lKey].qty += qty;
      lineByKey[lKey].amt += amt;
    });
  });

  var lines = Object.values(lineByKey);
  lines.sort(function(a, b) {
    if (a.periodIdx !== b.periodIdx) return a.periodIdx - b.periodIdx;
    if (a.model !== b.model) return a.model.localeCompare(b.model);
    return a.projectName.localeCompare(b.projectName);
  });

  return lines.map(function(r) {
    var g = groupTotals[r.periodIdx + '||' + r.model];
    var periodLabel = (periodType === 'quarter' ? qLabels[r.periodIdx] : monthLabels[r.periodIdx]) + ' ' + year;
    var note, projectNameOut;
    if (r.isRunrate) {
      // แถวที่มาจาก Run Rate — โน้ตรูปแบบ "ชื่อ Dealer Runrate จำนวน" (ไม่มีชื่อโครงการเพราะ run rate ไม่มีโครงการผูกอยู่)
      note = (r.dealerName ? r.dealerName + ' ' : '') + 'Runrate x' + r.qty;
      projectNameOut = 'Run Rate';
    } else {
      var noteParts = [];
      if (r.dealerName) noteParts.push(r.dealerName);
      noteParts.push(r.projectName);
      note = noteParts.join(' ') + ' x' + r.qty;
      projectNameOut = r.projectName;
    }
    return {
      period: periodLabel, model: r.model,
      modelQty: g.qty, modelAmt: g.amt,
      projectName: projectNameOut, projectQty: r.qty, projectAmt: r.amt,
      shipDateStr: _fcDateStr(r.shipDate), dealerName: r.dealerName,
      note: note,
      status: r.isRunrate ? 'Run Rate' : (r.est ? '~ประมาณ' : 'จริง')
    };
  });
}

// แปลงเดือนแบบ Run Rate ("M/BBBB" พ.ศ. ไม่เติมเลข 0 เช่น "8/2569") เป็นวันที่ 1 ของเดือนนั้น (ค.ศ.) — คืน Date หรือ null
function _rrMonthToDate(monthStr) {
  var parts = (monthStr || '').split('/');
  if (parts.length !== 2) return null;
  var m = parseInt(parts[0], 10);
  var yBE = parseInt(parts[1], 10);
  if (!m || !yBE || m < 1 || m > 12) return null;
  return new Date(yBE - 543, m - 1, 1);
}

// แปลง Run Rate ที่อนุมัติแล้วเป็น "pipe จำลอง" ให้ใช้กับฟังก์ชัน forecast เดิมได้ทันที (fcComputeCategoryTotals,
// buildFcMonthly, buildFcQuarterly, fcBuildExportRows ล้วนอ่านผ่าน getPipeShipDate/getPipeItems ซึ่ง object นี้ตอบสนองครบ)
function fcRunrateToSyntheticPipes(runrateItems) {
  var out = [];
  (runrateItems || []).forEach(function(r) {
    var d = _rrMonthToDate(r.month);
    if (!d) return;
    var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
    out.push({
      id: 'rr_synth_' + r.id,
      dealerId: r.dealerId,
      projectName: '',
      shipmentDate: iso,
      status: 'initial',
      items: [{ model: r.model, qty: Number(r.qty) || 1, price: 0, total: 0 }],
      _isRunrate: true
    });
  });
  return out;
}

function _fcExportRowsToAoa(rows, periodHeader) {
  var aoa = [[periodHeader, 'Model', 'จำนวนรวม (Model)', 'มูลค่ารวม (Model)', 'โครงการ', 'จำนวนโครงการนี้', 'มูลค่าโครงการนี้', 'Shipment Date', 'Dealer', 'โน้ต (ก็อปได้)', 'สถานะ']];
  rows.forEach(function(r) {
    aoa.push([r.period, r.model, r.modelQty, r.modelAmt, r.projectName, r.projectQty, r.projectAmt, r.shipDateStr, r.dealerName, r.note, r.status]);
  });
  return aoa;
}

// สร้างไฟล์ Excel (2 sheet: รายเดือน + รายไตรมาส) แล้วดาวน์โหลดทันที
function fcDownloadExcel(pipes, catFilterVarName, filenamePrefix) {
  var year = new Date().getFullYear();
  var monthRows = fcBuildExportRows(pipes, catFilterVarName, 'month', year);
  var qRows = fcBuildExportRows(pipes, catFilterVarName, 'quarter', year);
  if (!monthRows.length && !qRows.length) { toast('⚠️ ไม่มีข้อมูลให้ export (ต้องมี Shipment/Bidding Date)'); return; }
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(_fcExportRowsToAoa(monthRows, 'เดือน')), 'รายเดือน');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(_fcExportRowsToAoa(qRows, 'ไตรมาส')), 'รายไตรมาส');
  XLSX.writeFile(wb, (filenamePrefix || 'forecast') + '-' + _td() + '.xlsx');
  toast('📥 Export Excel แล้ว');
}

// ================================================================
// RUN RATE ↔ ใบเสนอราคา — คำนวณ "เปิดจริงแล้วกี่ตัว" แบบ derive สดทุกครั้ง ไม่เก็บ ledger แยก
// จับคู่ด้วย dealerId + ชื่อ model (ตัดช่องว่าง/ไม่สนตัวพิมพ์) — กันปัญหา double-count เพราะไม่มี state ค้าง
// นับใบเสนอราคาทุกใบที่ dealer ตรงกัน ไม่ว่าจะสร้างผ่าน builder หรือสร้างเองปกติ ก็นับรวมด้วยเหมือนกัน
// ================================================================
function _fcNorm(s) { return (s || '').toString().trim().replace(/\s+/g, ' ').toLowerCase(); }

function fcGetApprovedRunrate(dealerId) {
  var all = [];
  try { all = JSON.parse(localStorage.getItem('v7_customer_forecasts') || '[]'); } catch (e) {}
  var runrate = all.filter(function(f) { return f.type === 'runrate'; });
  if (dealerId) runrate = runrate.filter(function(f) { return f.dealerId === dealerId; });
  return runrate;
}

function _fcLoadQuotationsRaw() {
  try { return JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch (e) { return []; }
}

// รวมจำนวนที่ถูกใส่ในใบเสนอราคาแล้ว (ทุกสถานะ draft ขึ้นไป) สำหรับ dealer+model ที่กำหนด
function fcRunrateOpenedQty(dealerId, model) {
  var mNorm = _fcNorm(model);
  var qty = 0;
  _fcLoadQuotationsRaw().forEach(function(q) {
    if (q.dealerId !== dealerId) return;
    (q.items || []).forEach(function(it) {
      if (_fcNorm(it.name) === mNorm) qty += Number(it.quantity) || 0;
    });
  });
  return qty;
}

// {forecastQty, openedQty, remainingQty} รวมทุกเดือนของ dealer+model นี้
function fcRunrateConversion(dealerId, model) {
  var mNorm = _fcNorm(model);
  var forecastQty = 0;
  fcGetApprovedRunrate(dealerId).forEach(function(r) {
    if (_fcNorm(r.model) === mNorm) forecastQty += Number(r.qty) || 0;
  });
  var openedQty = fcRunrateOpenedQty(dealerId, model);
  if (openedQty > forecastQty) openedQty = forecastQty; // กันเกิน 100% ในการแสดงผล (ปัดส่วนเกินทิ้งจาก forecast เดิม)
  return { forecastQty: forecastQty, openedQty: openedQty, remainingQty: Math.max(0, forecastQty - openedQty) };
}

function toggleRunrateConfidence(runrateId) {
  var all = [];
  try { all = JSON.parse(localStorage.getItem('v7_customer_forecasts') || '[]'); } catch (e) {}
  var item = all.find(function(f) { return f.id === runrateId; });
  if (!item) return;
  item.confidence = item.confidence === 'confirmed' ? 'estimated' : 'confirmed';
  localStorage.setItem('v7_customer_forecasts', JSON.stringify(all));
  if (typeof syncToFirebase === 'function') syncToFirebase('customerForecasts', all);
  if (typeof loadForecastSummary === 'function') loadForecastSummary();
  toast(item.confidence === 'confirmed' ? '✅ เปลี่ยนเป็นสั่งแน่นอนแล้ว' : '🔵 เปลี่ยนเป็นคาดการณ์แล้ว');
}

// ================================================================
// ช่องค้นหาที่ต้อง debounce ก่อน render() — กันปัญหาพิมพ์ได้ทีละตัว (render() วาด input ใหม่ทุกครั้งที่เรียก
// ทำให้ input เดิมถูกแทนที่/โฟกัสหลุดถ้า re-render ทุกตัวอักษร) ใช้ร่วมกันทุกช่องค้นหาที่มีปัญหานี้ในแอป
// ================================================================
var _noteSearchTimer = null;
function noteSearchInput(v) {
  noteSearch = v;
  clearTimeout(_noteSearchTimer);
  _noteSearchTimer = setTimeout(function() { render(); }, 350);
}
var _soSearchTimer = null;
function soSearchInput(v) {
  soSearch = v;
  clearTimeout(_soSearchTimer);
  _soSearchTimer = setTimeout(function() { render(); }, 350);
}
var _tasksSearchTimer = null;
function tasksSearchInput(v) {
  tasksSearch = v;
  clearTimeout(_tasksSearchTimer);
  _tasksSearchTimer = setTimeout(function() { render(); }, 350);
}

// ================================================================
// ตรวจ "งานชนกัน" ระหว่าง Dealer (similarity ภาษาไทยด้วย bigram)
// ================================================================
// ตัดคำนำหน้า/ต่อท้ายประเภทองค์กรออกก่อนเทียบชื่อ กัน "บริษัท ABC จำกัด" กับ "ABC Co.,Ltd." ได้คะแนน
// ต่ำเกินจริงทั้งที่เป็นหน่วยงานเดียวกัน — ตัดแค่คำที่พบบ่อย ไม่ครอบคลุมทุกกรณี แต่ช่วยกรณีทั่วไปได้เยอะ
var _PIPE_ORG_AFFIXES = [
  /บริษัท/g, /ห้างหุ้นส่วนจำกัด/g, /ห้างหุ้นส่วนสามัญ/g, /จำกัด\s*\(มหาชน\)/g, /จำกัด/g,
  /มหาวิทยาลัย/g, /สำนักงาน/g, /สถาบัน/g, /องค์การ/g, /กรม/g, /กระทรวง/g,
  /public\s*company\s*limited/gi, /company\s*limited/gi, /co\.,?\s*ltd\.?/gi, /pcl\.?/gi, /ltd\.?/gi, /inc\.?/gi, /corp\.?/gi
];
function _pipeNormOrgName(s) {
  s = (s || '').toString();
  _PIPE_ORG_AFFIXES.forEach(function(re) { s = s.replace(re, ''); });
  return s;
}
function fcStrSim(a, b) {
  a = (a || '').toString().toLowerCase().replace(/\s+/g, '');
  b = (b || '').toString().toLowerCase().replace(/\s+/g, '');
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  function grams(s) { var m = {}; for (var i = 0; i < s.length - 1; i++) { var g = s.substr(i, 2); m[g] = (m[g] || 0) + 1; } return m; }
  var ba = grams(a), bb = grams(b), inter = 0, total = 0;
  for (var g in ba) { total += ba[g]; if (bb[g]) inter += Math.min(ba[g], bb[g]); }
  for (var g2 in bb) { total += bb[g2]; }
  return total ? (2 * inter / total) : 0;
}
// จับกลุ่มรุ่นโดรน/อุปกรณ์หลัก กัน "Matrice 4T" กับ "M4T" ไม่ถูกนับว่าตรงกันเพราะสะกดคนละแบบ — ใช้ชุด
// keyword เดียวกับที่ _qResolveItem (views-quotation.js) ใช้จับคู่สินค้าตอนสร้างใบเสนอราคาจาก Pipeline
// keys เก็บทั้งแบบย่อ (M4T) และแบบเต็ม (MATRICE 4T) — เทียบแบบตัด space ออกทั้งคู่ก่อน กัน "Matrice 4T"
// (ชื่อเต็มที่มีเว้นวรรค) ไม่ถูกจับกลุ่มเพราะไม่มี substring "M4T" ตรงๆ (M กับ 4T ไม่ติดกันในชื่อเต็ม)
// ลำดับสำคัญ: M4TD ต้องมาก่อน M4T เสมอ เพราะ "MATRICE4T" เป็น substring ของ "MATRICE4TD" ด้วย
var _PIPE_MODEL_GROUP_KEYS = [
  { keys: ['M3M', 'MULTISPECTRAL', 'MATRICE 3M'], group: 'm3m' },
  { keys: ['M4TD', 'MATRICE 4TD'], group: 'm4td' },
  { keys: ['M4T', 'MATRICE 4T'], group: 'm4t' },
  { keys: ['M4E', 'MATRICE 4E'], group: 'm4e' },
  { keys: ['M400', 'MATRICE 400'], group: 'm400' },
  { keys: ['DOCK'], group: 'dock3' }
];
function _pipeModelGroupKey(modelName) {
  var mu = (modelName || '').toUpperCase().replace(/\s+/g, '');
  for (var i = 0; i < _PIPE_MODEL_GROUP_KEYS.length; i++) {
    var spec = _PIPE_MODEL_GROUP_KEYS[i];
    if (spec.keys.some(function(k) { return mu.indexOf(k.replace(/\s+/g, '')) !== -1; })) return spec.group;
  }
  return null;
}
function pipeModelsSet(p) {
  var s = {};
  var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : (p.items || []);
  function addModel(m) {
    if (!m) return;
    s[(m + '').toLowerCase().replace(/\s+/g, '')] = true;
    var grp = _pipeModelGroupKey(m);
    if (grp) s['group:' + grp] = true; // token กลุ่ม ให้รุ่นที่สะกดต่างกันแต่กลุ่มเดียวกันนับว่าตรงกันได้ด้วย
  }
  (items || []).forEach(function (it) { if (it && it.model) addModel(it.model); });
  if (p.model) addModel(p.model);
  return s;
}
function pipeMatchScore(a, b) {
  var name = fcStrSim(_pipeNormOrgName(a.projectName), _pipeNormOrgName(b.projectName));
  var eu = fcStrSim(_pipeNormOrgName(a.endUserTH || a.endUserEN || ''), _pipeNormOrgName(b.endUserTH || b.endUserEN || ''));
  var am = fcStrSim(_pipeNormOrgName(a.agencyMain), _pipeNormOrgName(b.agencyMain));
  var asb = fcStrSim(_pipeNormOrgName(a.agencySub), _pipeNormOrgName(b.agencySub));
  var sa = pipeModelsSet(a), sb = pipeModelsSet(b), inter = 0, uni = {};
  for (var k in sa) { uni[k] = true; if (sb[k]) inter++; }
  for (var k2 in sb) uni[k2] = true;
  var uniCount = Object.keys(uni).length;
  var model = uniCount ? inter / uniCount : 0;
  var bid = 0;
  var da = fcParseDate(a.biddingDate), db = fcParseDate(b.biddingDate);
  if (da && db) { var diff = Math.abs(da - db) / 86400000; bid = diff <= 30 ? 1 : (diff >= 90 ? 0 : 1 - (diff - 30) / 60); }
  var score = name * 0.35 + eu * 0.25 + am * 0.10 + asb * 0.10 + model * 0.15 + bid * 0.05;
  return Math.round(score * 100);
}
function getDismissedConflicts() {
  try { return JSON.parse(localStorage.getItem('v7_conflict_dismissed') || '{}') || {}; } catch (e) { return {}; }
}
function dismissConflict(key) {
  var d = getDismissedConflicts(); d[key] = true;
  try { localStorage.setItem('v7_conflict_dismissed', JSON.stringify(d)); } catch (e) {}
}
function detectPipelineConflicts(pipes, threshold) {
  threshold = threshold || 60;
  var active = (pipes || []).filter(function (p) { return p && pipeIsOpen(p); });
  var dismissed = getDismissedConflicts();
  var pairs = [];
  for (var i = 0; i < active.length; i++) {
    for (var j = i + 1; j < active.length; j++) {
      if (active[i].dealerId && active[i].dealerId === active[j].dealerId) continue; // ข้าม dealer เดียวกัน
      var key = [active[i].id, active[j].id].sort().join('__');
      if (dismissed[key]) continue;
      var sc = pipeMatchScore(active[i], active[j]);
      if (sc >= threshold) pairs.push({ a: active[i], b: active[j], score: sc, key: key });
    }
  }
  pairs.sort(function (x, y) { return y.score - x.score; });
  return pairs;
}

// กราฟแท่งรายเดือน (CSS ล้วน) — เข้ม=Shipment จริง, จาง=ประมาณการ
function fcMonthlyBarsHtml(pipes, year) {
  var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var data = [];
  for (var i = 0; i < 12; i++) data.push({ conf: 0, est: 0 });
  (pipes || []).forEach(function (p) {
    var ship = getPipeShipDate(p);
    if (!ship) return;
    if (fcHideTentative && ship.est) return;
    if (year && ship.date.getFullYear() !== year) return;
    var m = ship.date.getMonth();
    var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : [];
    var amt = 0;
    items.forEach(function (it) { amt += (Number(it.qty) || 1) * (Number(it.price) || 0); });
    if (!amt) amt = Number(p.forecastAmount) || 0;
    if (ship.est) data[m].est += amt; else data[m].conf += amt;
  });
  var max = 1, hasData = false;
  data.forEach(function (d) { var t = d.conf + d.est; if (t > max) max = t; if (t > 0) hasData = true; });
  if (!hasData) return '';
  var curM = new Date().getMonth();
  var h = '<div class="card" style="margin-bottom:12px"><div style="font-size:13px;font-weight:700;margin-bottom:10px">📊 ภาพรวมรายเดือน — ' + year +
    ' <span style="font-size:11px;font-weight:400;color:var(--text2)">(🟦 เข้ม=Shipment จริง · จาง=ประมาณ)</span></div>';
  h += '<div style="display:flex;align-items:flex-end;gap:4px;height:150px;padding-top:8px">';
  for (var j = 0; j < 12; j++) {
    var d2 = data[j], tot = d2.conf + d2.est;
    var totH = Math.round((tot / max) * 110);
    var confH = tot > 0 ? Math.round((d2.conf / tot) * totH) : 0;
    var estH = totH - confH;
    var isCur = j === curM;
    h += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%" title="' + months[j] + ': ' + fmtMoneyShort(tot) + (d2.est ? (' (ประมาณ ' + fmtMoneyShort(d2.est) + ')') : '') + '">';
    if (tot > 0) h += '<div style="font-size:9px;color:var(--text2);margin-bottom:2px">' + fmtMoneyShort(tot) + '</div>';
    h += '<div style="width:100%;max-width:26px;display:flex;flex-direction:column;justify-content:flex-end;border-radius:4px 4px 0 0;overflow:hidden">';
    if (estH > 0) h += '<div style="height:' + estH + 'px;background:rgba(59,130,246,0.35)"></div>';
    if (confH > 0) h += '<div style="height:' + confH + 'px;background:#3b82f6"></div>';
    h += '</div>';
    h += '<div style="font-size:10px;margin-top:4px;' + (isCur ? 'color:#3b82f6;font-weight:700' : 'color:var(--text2)') + '">' + months[j] + '</div>';
    h += '</div>';
  }
  h += '</div></div>';
  return h;
}

// ================================================================
// PARSE THAI DATE (DD/MM/YYYY)
// ================================================================
function parseThaiDate(str) {
  if (!str) return null;
  var parts = str.split('/');
  if (parts.length !== 3) return null;
  var day = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1;
  var year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}
// ================================================================
// TASK HELPER FUNCTIONS
// ================================================================

function getDaysLeft(dueDate) {
  if (!dueDate) return null;
  return dTo(dueDate);
}

function isOverdue(dueDate, status) {
  if (status === 'completed') return false;
  var days = getDaysLeft(dueDate);
  return days !== null && days < 0;
}

function isDueSoon(dueDate, status) {
  if (status === 'completed') return false;
  var days = getDaysLeft(dueDate);
  return days !== null && days >= 0 && days <= 2;
}

function formatDueDateStatus(dueDate, status) {
  if (!dueDate) return '';
  if (status === 'completed') return '<span class="badge-green">✅ เสร็จแล้ว</span>';
  if (isOverdue(dueDate, status)) return '<span class="badge-red">🔴 เกินกำหนด</span>';
  if (isDueSoon(dueDate, status)) {
    var days = getDaysLeft(dueDate);
    return '<span class="badge-yellow">🟡 เหลือ ' + days + ' วัน</span>';
  }
  return '';
}
// ================================================================
// DATE CONSTANTS
// ================================================================
const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MONTHS_S = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_S = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const DAY_NAMES = {
  mon:'จันทร์', tue:'อังคาร', wed:'พุธ', thu:'พฤหัสบดี',
  fri:'ศุกร์', sat:'เสาร์', sun:'อาทิตย์', daily:'ทุกวัน',
  'mon-wed':'จ.-พ.', 'mon-fri':'จ.-ศ.', 'thu':'พฤ.', 'fri':'ศ.'
};

// ================================================================
// CORE ID / DATE HELPERS
// ================================================================
function gid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function _td() { return new Date().toISOString().split('T')[0]; }
function _nw() { return new Date().toISOString(); }

function getTodayDow() {
  return ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
}

function getCurMonth() { return _td().substring(0, 7); }

function getCurQuarter() {
  const m = new Date().getMonth();
  const q = Math.floor(m / 3) + 1;
  return `Q${q}/${new Date().getFullYear()}`;
}

// ================================================================
// DATE FORMATTING
// ================================================================
function fD(iso) {
  if (!iso) return '-';
  const p = iso.split('T')[0].split('-');
  if (p.length !== 3) return '-';
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function fDShort(iso) {
  if (!iso) return '-';
  const p = iso.split('T')[0].split('-');
  if (p.length !== 3) return '-';
  return `${p[2]}/${p[1]}/${p[0].substr(2)}`;
}

function fDT(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return '-';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fDRelative(iso) {
  if (!iso) return '';
  const days = dTo(iso);
  if (days === 0) return 'วันนี้';
  if (days === 1) return 'พรุ่งนี้';
  if (days === -1) return 'เมื่อวาน';
  if (days < 0) return `${Math.abs(days)} วันที่แล้ว`;
  return `อีก ${days} วัน`;
}

// ================================================================
// DATE CALCULATIONS
// ================================================================
function dTo(ds) {
  if (!ds) return 999;
  const d = ds.split('T')[0];
  return Math.ceil((new Date(d) - new Date(_td())) / 864e5);
}

function daysBetween(d1, d2) {
  if (!d1 || !d2) return 0;
  return Math.ceil((new Date(d2) - new Date(d1)) / 864e5);
}

function addD(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function getWeekRange(refDate) {
  const ref = refDate ? new Date(refDate) : new Date();
  const dow = ref.getDay();
  const diffS = dow === 0 ? 6 : dow - 1;
  const ws = addD(ref.toISOString().split('T')[0], -diffS);
  return { start: ws, end: addD(ws, 6) };
}

// ห้ามใช้ e.toISOString() กับวันที่ที่สร้างจาก local component (new Date(y,m,d)) — แปลงเป็น UTC ก่อนเสมอ
// ทำให้วันที่ถอยหลัง 1 วันในโซนเวลา UTC+7 (เที่ยงคืนไทยกลายเป็นเย็นวันก่อนหน้าที่ UTC) — ใช้ getFullYear/getMonth/getDate แทน
function _localISODate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getMonthRange(refDate) {
  const d = refDate ? new Date(refDate) : new Date();
  const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
  const e = new Date(d.getFullYear(), d.getMonth()+1, 0);
  return { start: s, end: _localISODate(e) };
}

function getQuarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const start = `${now.getFullYear()}-${String(q*3+1).padStart(2,'0')}-01`;
  const endMonth = q * 3 + 3;
  const end = new Date(now.getFullYear(), endMonth, 0);
  return { start, end: _localISODate(end), label: `Q${q+1}/${now.getFullYear()}` };
}

function isInRange(date, start, end) {
  if (!date) return false;
  const d = date.split('T')[0];
  return d >= start && d <= end;
}

// ================================================================
// MONEY FORMATTING
// ================================================================
function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return '-';
  return Number(n).toLocaleString('th-TH');
}

function fmtMoneyShort(n) {
  if (!n) return '-';
  n = Number(n);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return n.toLocaleString('th-TH');
}

// ================================================================
// TIMER FORMATTING
// ================================================================
function fmtTimer(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function fmtDuration(minutes) {
  if (!minutes) return '0 น.';
  if (minutes < 60) return `${minutes} น.`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h} ชม. ${m} น.` : `${h} ชม.`;
}

// ================================================================
// DEADLINE HELPERS
// ================================================================
function dlC(ds, done) {
  if (done) return '';
  const d = dTo(ds);
  if (d < 0) return 'dlo';
  if (d <= 1) return 'dl1';
  if (d <= 3) return 'dl3';
  return '';
}

function dlB(ds, done) {
  if (done) return '';
  const d = dTo(ds);
  if (d < 0) return `<span class="dlb dlbo">เลยกำหนด ${Math.abs(d)} วัน</span>`;
  if (d === 0) return `<span class="dlb dlb1">🔴 วันนี้!</span>`;
  if (d === 1) return `<span class="dlb dlb1">🔴 พรุ่งนี้</span>`;
  if (d <= 3) return `<span class="dlb dlb3">🟡 อีก ${d} วัน</span>`;
  return '';
}

// ================================================================
// CONTACT FRESHNESS (วันที่ติดต่อล่าสุด)
// ================================================================
function contactColor(daysSince) {
  if (daysSince === null || daysSince === undefined) return 'health-none';
  if (daysSince <= 7) return 'health-good';
  if (daysSince <= 14) return 'health-warn';
  return 'health-bad';
}

function contactLabel(daysSince) {
  if (daysSince === null || daysSince === undefined) return '⚪ ไม่เคย';
  if (daysSince === 0) return '🟢 วันนี้';
  if (daysSince <= 7) return `🟢 ${daysSince} วัน`;
  if (daysSince <= 14) return `🟡 ${daysSince} วัน`;
  return `🔴 ${daysSince} วัน`;
}

// ================================================================
// TAG HELPERS
// ================================================================
function sTag(s) {
  const m = {active:'กำลังทำ', completed:'เสร็จ', 'on-hold':'พัก', cancelled:'ยกเลิก'};
  return `<span class="tag tag-${s}">${m[s]||s}</span>`;
}

function pTag(p) {
  return `<span class="tag tag-${p}">${{high:'🔴 สำคัญ', medium:'🟡 กลาง', low:'🟢 ทั่วไป'}[p]||p}</span>`;
}

function levelTag(lv) {
  const cls = {S:'tag-s', A:'tag-a', B:'tag-b'};
  return `<span class="tag ${cls[lv]||'tag-other'}">${lv||'Other'}</span>`;
}

function pipeTag(s) {
  const cfg = getConfig();
  const st = cfg.pipelineStatuses.find(x => x.id === s);
  const cls = {
    prospect:'tag-prospect', tor_review:'tag-bidding', quotation:'tag-bidding',
    bidding:'tag-bidding', negotiation:'tag-bidding', win:'tag-win',
    ordered:'tag-ordered', delivered:'tag-completed', lost:'tag-lost',
    on_hold:'tag-on-hold', recurring:'tag-active'
  };
  return `<span class="tag ${cls[s]||'tag-count'}">${st?.name||s}</span>`;
}

function modeTag(m) {
  return `<span class="tag tag-${m==='offline'?'offline':'online'}">${m==='offline'?'Onsite':'Online'}</span>`;
}

// ================================================================
// PROGRESS
// ================================================================
function prog(o) {
  if (!o.steps || !o.steps.length) return 0;
  return Math.round(o.steps.filter(s => s.done).length / o.steps.length * 100);
}

function isStepLocked(obj, idx) {
  if (!obj.sequential) return false;
  if (idx === 0) return false;
  return !obj.steps[idx - 1]?.done;
}

// ================================================================
// LOG TYPE LABELS
// ================================================================
function logL(t) {
  return {
    progress:'🟢 คืบหน้า', problem:'🔴 ปัญหา', solution:'🟡 แก้ไข',
    visit:'🤝 Visit', followup:'📞 Follow-up', line:'💬 LINE',
    note:'⚪ หมายเหตุ', completed:'✅ เสร็จ', update:'📝 อัพเดท',
    forecast:'📦 Forecast', status_change:'🔄 เปลี่ยนสถานะ',
    win:'✅ Win', lost:'❌ Lost'
  }[t] || t;
}

// ================================================================
// TOAST
// ================================================================
function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ================================================================
// FILE ATTACHMENTS — UI ใช้ร่วมกันทุกเมนู (Note/Task/Visit/Pipeline/Dealer/Feedback/Quotation/Sales Order)
// รองรับรูป (บีบอัดอัตโนมัติ) + PDF/Word/Excel (อัปโหลดตรง ไม่เกิน 10MB) + ลิงก์ (ไม่ต้องอัปโหลด)
// stateVarName = ชื่อ global var (string) ที่เก็บ array attachments ของฟอร์มที่เปิดอยู่
// ================================================================
function _attachExt(name) {
  var m = String(name || '').match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

function _attachIcon(a) {
  if (a.isLink) return '🔗';
  var ext = _attachExt(a.name);
  if ((a.type && a.type.indexOf('image/') === 0) || ['jpg','jpeg','png','gif','webp'].indexOf(ext) !== -1) return null; // null = ให้ render เป็น <img> จริง
  if (ext === 'pdf') return '📄';
  if (['doc','docx'].indexOf(ext) !== -1) return '📝';
  if (['xls','xlsx','csv'].indexOf(ext) !== -1) return '📊';
  return '📎';
}

function _attachItemHtml(a, onClick) {
  var icon = _attachIcon(a);
  if (icon === null) {
    return '<img src="' + a.url + '" style="width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:pointer;display:block" onclick="' + onClick + '">';
  }
  var label = a.name || a.url || '';
  if (label.length > 14) label = label.substr(0, 12) + '…';
  return '<div style="width:64px;height:64px;border-radius:6px;background:var(--bg2);border:1px solid var(--border);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:2px;box-sizing:border-box" onclick="' + onClick + '" title="' + sanitize(a.name || a.url || '') + '">' +
    '<span style="font-size:20px">' + icon + '</span><span style="font-size:8px;color:var(--text2);text-align:center;word-break:break-word;line-height:1.1">' + sanitize(label) + '</span></div>';
}

function attachUploadHtml(stateVarName, folder, label) {
  window[stateVarName] = window[stateVarName] || [];
  var linkInputId = stateVarName + '_linkInput';
  return '<div class="fg"><label>' + (label || '📎 ไฟล์แนบ') + '</label>' +
    '<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onchange="_handleAttachUpload(event,\'' + stateVarName + '\',\'' + folder + '\')" style="font-size:.76rem">' +
    '<div class="hint" style="margin:2px 0 0">รูป/PDF/Word/Excel ไม่เกิน 10MB — รูปจะถูกบีบอัดให้เล็กลงอัตโนมัติ</div>' +
    '<div style="display:flex;gap:4px;margin-top:6px">' +
    '<input type="text" id="' + linkInputId + '" placeholder="🔗 วางลิงก์ (เว็บ หรือ path ไฟล์ในเครื่อง)" style="flex:1;font-size:.76rem" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_addAttachLink(\'' + stateVarName + '\')}">' +
    '<button type="button" class="btn bo bsm" onclick="_addAttachLink(\'' + stateVarName + '\')">เพิ่มลิงก์</button>' +
    '</div>' +
    '<div id="' + stateVarName + '_thumbs">' + attachThumbsHtml(window[stateVarName], stateVarName) + '</div></div>';
}

function attachThumbsHtml(attachments, stateVarName) {
  if (!attachments || !attachments.length) return '';
  return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
    attachments.map(function(a, i) {
      var onClick = "window.open('" + a.url + "','_blank')";
      return '<div style="position:relative;width:64px;height:64px">' +
        _attachItemHtml(a, onClick) +
        '<button type="button" onclick="_removeAttachFromState(\'' + stateVarName + '\',' + i + ')" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1">✕</button></div>';
    }).join('') + '</div>';
}

function _handleAttachUpload(event, stateVarName, folder) {
  var file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  toast('⏳ กำลังอัปโหลด...');
  uploadAttachment(file, folder, function(att) {
    if (!att) return;
    window[stateVarName] = window[stateVarName] || [];
    window[stateVarName].push(att);
    var wrap = document.getElementById(stateVarName + '_thumbs');
    if (wrap) wrap.innerHTML = attachThumbsHtml(window[stateVarName], stateVarName);
    toast('📎 แนบไฟล์แล้ว');
  });
}

// เพิ่มลิงก์ (ไม่ upload) — เติม https:// ให้ถ้าพิมพ์แค่โดเมนมา ไม่แตะ path ไฟล์ในเครื่อง (file://, C:\...) หรือ URL ที่มี scheme อยู่แล้ว
function _addAttachLink(stateVarName) {
  var inp = document.getElementById(stateVarName + '_linkInput');
  if (!inp) return;
  var val = inp.value.trim();
  if (!val) { toast('⚠️ กรอกลิงก์ก่อน'); return; }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(val) && !/^[a-zA-Z]:\\/.test(val) && val.indexOf('\\\\') !== 0) val = 'https://' + val;
  window[stateVarName] = window[stateVarName] || [];
  window[stateVarName].push({ url: val, name: val, isLink: true });
  var wrap = document.getElementById(stateVarName + '_thumbs');
  if (wrap) wrap.innerHTML = attachThumbsHtml(window[stateVarName], stateVarName);
  inp.value = '';
  toast('🔗 เพิ่มลิงก์แล้ว');
}

function _removeAttachFromState(stateVarName, idx) {
  var arr = window[stateVarName];
  if (!arr || !arr[idx]) return;
  if (!confirm('ลบรายการนี้?')) return;
  if (arr[idx].path) deleteAttachment(arr[idx].path);
  arr.splice(idx, 1);
  var wrap = document.getElementById(stateVarName + '_thumbs');
  if (wrap) wrap.innerHTML = attachThumbsHtml(arr, stateVarName);
}

function attachGalleryHtml(attachments) {
  if (!attachments || !attachments.length) return '';
  return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
    attachments.map(function(a) {
      return _attachItemHtml(a, "window.open('" + a.url + "','_blank')");
    }).join('') + '</div>';
}

// ================================================================
// ESCAPE FOR CSV
// ================================================================
function esc(s) {
  return String(s == null ? '' : s).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
}

// ================================================================
// DOWNLOAD BLOB (CSV)
// ================================================================
function dlBlob(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📤 Download แล้ว');
}

// ================================================================
// COPY TO CLIPBOARD
// ================================================================
function copyText(text, msg) {
  navigator.clipboard.writeText(text).then(() => {
    toast(msg || '📋 Copy แล้ว!');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast(msg || '📋 Copy แล้ว!');
  });
}

// Copy table as TSV (Tab-separated for Google Sheets)
function copyTable(tableId, msg) {
  const table = document.getElementById(tableId);
  if (!table) return toast('❌ ไม่พบตาราง', true);
  let tsv = '';
  table.querySelectorAll('tr').forEach(tr => {
    const cells = tr.querySelectorAll('th,td');
    tsv += Array.from(cells).map(c => c.textContent.replace(/[\t\n\r]/g, ' ').trim()).join('\t') + '\n';
  });
  copyText(tsv, msg || '📋 Copy แล้ว! วาง Google Sheets ได้');
}

// Download table as CSV
function dlTableCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return toast('❌', true);
  let csv = '\uFEFF'; // BOM for Thai
  table.querySelectorAll('tr').forEach(tr => {
    const cells = tr.querySelectorAll('th,td');
    csv += Array.from(cells).map(c => `"${esc(c.textContent.trim())}"`).join(',') + '\n';
  });
  dlBlob(csv, `${filename}-${_td()}.csv`);
}

// ================================================================
// DATE PICKER (Typeable + Calendar Dropdown)
// ================================================================
let _dpO = null;

function dpH(id, val, label, req) {
  return `<div class="fg"><label>${label}${req ? ' *' : ''}</label>
<div class="dpw" id="dpw_${id}">
  <input type="text" class="dpi" id="dpi_${id}"
    value="${val ? fD(val) : ''}"
    placeholder="วว/ดด/ปปปป"
    oninput="dpType('${id}')"
    onfocus="this.select()"
    onblur="setTimeout(()=>dpBlur('${id}'),250)"
    maxlength="10" autocomplete="off">
  <div class="dpbs">
    ${val ? `<span class="dpb" onclick="event.stopPropagation();dpClr('${id}')">✕</span>` : ''}
    <span class="dpb" onclick="event.stopPropagation();dpTog('${id}')">📅</span>
  </div>
  <input type="hidden" id="dpv_${id}" value="${val || ''}">
  <div class="dpp" id="dpp_${id}"></div>
</div></div>`;
}

function dpType(id) {
  const inp = document.getElementById('dpi_' + id);
  let v = inp.value.replace(/[^\d\/]/g, '');
  const nums = v.replace(/\//g, '');
  
  // Auto-insert slashes
  if (nums.length >= 2 && v.indexOf('/') === -1) {
    v = nums.substr(0, 2) + '/' + nums.substr(2);
  }
  if (nums.length >= 4) {
    const parts = v.split('/');
    if (parts.length === 2 && parts[1].length > 2) {
      v = parts[0] + '/' + parts[1].substr(0, 2) + '/' + parts[1].substr(2);
    }
  }
  if (v.length > 10) v = v.substr(0, 10);
  inp.value = v;
  
  // Validate complete date
  if (v.length === 10) {
    const parts = v.split('/');
    if (parts.length === 3) {
      const dd = parseInt(parts[0]), mm = parseInt(parts[1]), yyyy = parseInt(parts[2]);
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 2020 && yyyy <= 2099) {
        const testDate = new Date(yyyy, mm - 1, dd);
        if (testDate.getDate() === dd && testDate.getMonth() === mm - 1) {
          const iso = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
          document.getElementById('dpv_' + id).value = iso;
          dpUpdBtns(id, true);
          return;
        }
      }
    }
  }
  if (v.length < 10) document.getElementById('dpv_' + id).value = '';
}

function dpBlur(id) {
  const inp = document.getElementById('dpi_' + id);
  const hid = document.getElementById('dpv_' + id);
  if (inp && inp.value && hid && !hid.value) inp.value = '';
}

function dpUpdBtns(id, hasVal) {
  const w = document.getElementById('dpw_' + id);
  if (!w) return;
  w.querySelector('.dpbs').innerHTML = hasVal
    ? `<span class="dpb" onclick="event.stopPropagation();dpClr('${id}')">✕</span><span class="dpb" onclick="event.stopPropagation();dpTog('${id}')">📅</span>`
    : `<span class="dpb" onclick="event.stopPropagation();dpTog('${id}')">📅</span>`;
}

function dpTog(id) {
  const p = document.getElementById('dpp_' + id);
  if (!p) return;
  if (p.classList.contains('show')) { p.classList.remove('show'); _dpO = null; return; }
  document.querySelectorAll('.dpp.show').forEach(x => x.classList.remove('show'));
  const v = document.getElementById('dpv_' + id)?.value;
  const d = v ? new Date(v) : new Date();
  dpRn(id, d.getFullYear(), d.getMonth());
  p.classList.add('show');
  _dpO = id;
}

function dpRn(id, y, m) {
  const p = document.getElementById('dpp_' + id);
  if (!p) return;
  const fd = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const tdy = _td();
  const sel = document.getElementById('dpv_' + id)?.value || '';
  
  let h = `<div class="dp-hd">
    <button type="button" onclick="event.stopPropagation();dpNv('${id}',${y},${m},-1)">◀</button>
    <span>${MONTHS[m]} ${y}</span>
    <button type="button" onclick="event.stopPropagation();dpNv('${id}',${y},${m},1)">▶</button>
  </div><div class="dp-grid">`;
  
  DAYS_S.forEach(d => h += `<div class="dp-dh">${d}</div>`);
  
  const pv = new Date(y, m, 0).getDate();
  for (let i = fd - 1; i >= 0; i--) h += `<div class="dp-d other">${pv - i}</div>`;
  
  for (let d = 1; d <= dim; d++) {
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    h += `<div class="dp-d${iso===tdy?' today':''}${iso===sel?' sel':''}" onclick="event.stopPropagation();dpSel('${id}','${iso}')">${d}</div>`;
  }
  
  const tot = fd + dim, rem = 7 - tot % 7;
  if (rem < 7) for (let i = 1; i <= rem; i++) h += `<div class="dp-d other">${i}</div>`;
  
  h += `</div><div class="dp-ft">
    <button type="button" onclick="event.stopPropagation();dpSel('${id}','${tdy}')">วันนี้</button>
    <button type="button" onclick="event.stopPropagation();dpSel('${id}','${addD(tdy,1)}')">พรุ่งนี้</button>
    <button type="button" onclick="event.stopPropagation();dpSel('${id}','${addD(tdy,7)}')">+1wk</button>
  </div>`;
  p.innerHTML = h;
}

function dpNv(id, y, m, d) {
  m += d;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  dpRn(id, y, m);
}

function dpSel(id, iso) {
  const vi = document.getElementById('dpv_' + id);
  const di = document.getElementById('dpi_' + id);
  if (vi) vi.value = iso;
  if (di) di.value = fD(iso);
  const p = document.getElementById('dpp_' + id);
  if (p) p.classList.remove('show');
  _dpO = null;
  dpUpdBtns(id, true);
}

function dpClr(id) {
  const vi = document.getElementById('dpv_' + id);
  const di = document.getElementById('dpi_' + id);
  if (vi) vi.value = '';
  if (di) di.value = '';
  dpUpdBtns(id, false);
}

function dpG(id) {
  return document.getElementById('dpv_' + id)?.value || '';
}

// ตั้งค่า date picker ด้วยโค้ด เช่นปุ่ม "วันนี้ / พรุ่งนี้" — iso = 'YYYY-MM-DD'
function dpSet(id, iso) {
  var hid = document.getElementById('dpv_' + id);
  var vis = document.getElementById('dpi_' + id);
  if (hid) hid.value = iso || '';
  if (vis) vis.value = iso ? fD(iso) : '';
  dpUpdBtns(id, !!iso);
}

// วันอาทิตย์ของสัปดาห์นี้ (ถ้าวันนี้เป็นอาทิตย์อยู่แล้ว = วันนี้)
function _qdEndOfWeek() {
  var day = new Date().getDay();
  return addD(_td(), day === 0 ? 0 : 7 - day);
}
// วันศุกร์ของสัปดาห์นี้ (ถ้าเลยศุกร์ไปแล้ว = ศุกร์หน้า)
function _qdThisFriday() {
  var day = new Date().getDay();
  return addD(_td(), (5 - day + 7) % 7);
}

// ขยาย/ย่อ textarea ด้วยปุ่ม ⛶
function toggleExpandTextarea(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var expanded = el.dataset.expanded === '1';
  el.rows = expanded ? 7 : 18;
  el.dataset.expanded = expanded ? '0' : '1';
}

// วาง/ลากรูปลงใน textarea (เหมือนอีเมล) — upload แล้วโชว์ thumbnail ใต้ช่อง
function handlePasteOrDropImage(e, stateVarName, folder) {
  var file = null;
  if (e.type === 'paste' && e.clipboardData) {
    var items = e.clipboardData.items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) { file = items[i].getAsFile(); break; }
    }
  } else if (e.type === 'drop' && e.dataTransfer) {
    var files = e.dataTransfer.files || [];
    for (var i = 0; i < files.length; i++) {
      if (files[i].type && files[i].type.indexOf('image') === 0) { file = files[i]; break; }
    }
  }
  if (!file) return;
  e.preventDefault();
  toast('⏳ กำลังอัปโหลดรูป...');
  uploadAttachment(file, folder, function(att) {
    if (!att) return;
    window[stateVarName] = window[stateVarName] || [];
    window[stateVarName].push(att);
    var wrap = document.getElementById(stateVarName + '_thumbs');
    if (wrap) wrap.innerHTML = attachThumbsHtml(window[stateVarName], stateVarName);
    toast('📷 แนบรูปแล้ว');
  });
}

// Close date picker when clicking outside
document.addEventListener('click', e => {
  if (_dpO && !e.target.closest('.dpw')) {
    document.querySelectorAll('.dpp.show').forEach(x => x.classList.remove('show'));
    _dpO = null;
  }
});

// ================================================================
// HELPER: Generate Dropdown Options
// ================================================================
function optionsHTML(items, selected, emptyLabel) {
  let h = emptyLabel ? `<option value="">${emptyLabel}</option>` : '';
  items.forEach(item => {
    if (typeof item === 'string') {
      h += `<option value="${item}" ${item === selected ? 'selected' : ''}>${item}</option>`;
    } else {
      h += `<option value="${item.id||item.value}" ${(item.id||item.value) === selected ? 'selected' : ''}>${item.name||item.label}</option>`;
    }
  });
  return h;
}

// Dealer dropdown
function dealerOptions(selectedId) {
  const dealers = ST.getAll('dealers');
  return optionsHTML(
    dealers.map(d => ({ id: d.id, name: d.name })),
    selectedId,
    '-- เลือก Dealer --'
  );
}

// ช่อง "Dealer Name" ในฟอร์ม Pipeline — free text พิมพ์อะไรก็ได้ (บริษัทที่เข้าประมูล อาจไม่ใช่ Dealer
// ที่มีอยู่ในระบบเลยก็ได้) แต่ suggest จากชื่อ Dealer ที่มีอยู่แล้วทั้งหมด กันพิมพ์ผิดหลุด
function _dealerNameDatalistHtml(listId) {
  var names = ST.getAll('dealers').map(function(d) { return d.name; }).filter(Boolean);
  var opts = '';
  names.forEach(function(v) { opts += '<option value="' + sanitize(v) + '"></option>'; });
  return '<datalist id="' + listId + '">' + opts + '</datalist>';
}

// Levenshtein distance มาตรฐาน — ใช้เทียบชื่อ Dealer ที่พิมพ์มาว่าใกล้เคียงกับที่มีอยู่แล้วแค่ไหน
// (กันเคสพิมพ์ผิด 1-2 ตัวอักษรแล้วสร้าง Dealer ซ้ำโดยไม่รู้ตัว เช่น "Poladrone" vs "Polardrone")
function levenshteinDistance(a, b) {
  a = a || ''; b = b || '';
  var m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  var prev = [];
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    var cur = [i];
    for (var j2 = 1; j2 <= n; j2++) {
      var cost = a[i - 1] === b[j2 - 1] ? 0 : 1;
      cur[j2] = Math.min(prev[j2] + 1, cur[j2 - 1] + 1, prev[j2 - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// แปลงชื่อ Dealer ที่พิมพ์มาเป็น dealerId — ตรงเป๊ะใช้ตัวเดิมทันที, ใกล้เคียงมากถามยืนยันก่อนว่าใช่ตัวเดิมไหม,
// ไม่เจอเลยถามยืนยันสร้างใหม่ — cb(dealerId) เรียกเมื่อได้ข้อสรุปแล้วเท่านั้น (ไม่เรียกถ้าผู้ใช้ยกเลิก)
function resolveDealerIdByName(typedName, cb) {
  var name = (typedName || '').trim();
  if (!name) return;
  var dealers = ST.getAll('dealers');
  var exact = dealers.find(function(d) { return (d.name || '').trim().toLowerCase() === name.toLowerCase(); });
  if (exact) return cb(exact.id);

  var best = null, bestDist = Infinity;
  dealers.forEach(function(d) {
    var dist = levenshteinDistance(name.toLowerCase(), (d.name || '').trim().toLowerCase());
    if (dist < bestDist) { bestDist = dist; best = d; }
  });
  var threshold = Math.max(2, Math.round(name.length * 0.25));
  if (best && bestDist <= threshold && bestDist > 0) {
    if (confirm('ไม่พบ Dealer ชื่อ "' + name + '" เป๊ะๆ ในระบบ — หมายถึง "' + best.name + '" ที่มีอยู่แล้วใช่ไหม?')) {
      return cb(best.id);
    }
  }
  if (!confirm('ไม่พบ Dealer ชื่อ "' + name + '" ในระบบ — ต้องการสร้าง Dealer ใหม่ชื่อนี้ไหม?')) return;
  var newDealer = ST.add('dealers', { name: name, level: 'Other', showSerial: 'Y' });
  if (typeof syncToFirebase === 'function') syncToFirebase('dealers', ST.getAll('dealers'));
  cb(newDealer.id);
}

// ช่อง "DJI Dealer" ในฟอร์ม Pipeline — free text พิมพ์อะไรก็ได้ แต่ suggest ทั้งประเภทจาก Admin
// (cfg.djiDealerTypes เช่น "SAB") และชื่อ Dealer จริงทั้งหมดในระบบ รวมกันเป็น datalist เดียว
function _djiDealerDatalistHtml(listId) {
  var cfg = getConfig();
  var types = cfg.djiDealerTypes || [];
  var dealerNames = ST.getAll('dealers').map(function(d) { return d.name; }).filter(Boolean);
  var all = types.concat(dealerNames);
  var seen = {};
  var opts = '';
  all.forEach(function(v) {
    if (!v || seen[v]) return;
    seen[v] = true;
    opts += '<option value="' + sanitize(v) + '"></option>';
  });
  return '<datalist id="' + listId + '">' + opts + '</datalist>';
}

function prospectOptions(selectedId) {
  var list = ST.getAll('prospects').filter(function(p) { return p.stage !== 'closed' && p.stage !== 'converted'; });
  var opts = '<option value="">-- เลือก Lead --</option>';
  list.forEach(function(p) {
    opts += '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + sanitize(p.companyName || '-') + '</option>';
  });
  return opts;
}

function toggleVisitSource(val) {
  window._visitSourceType = val;
  var dr = document.getElementById('fv_dealer_row');
  var lr = document.getElementById('fv_lead_row');
  if (dr) dr.style.display = val === 'lead' ? 'none' : '';
  if (lr) lr.style.display = val === 'lead' ? '' : 'none';
}

// Model dropdown (backward compatible with Object models)
function modelOptions(selected) {
  return modelOptionsNew(selected);
}

// ================================================================
// HELPER: Sanitize HTML (prevent XSS)
// ================================================================
function sanitize(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ================================================================
// HELPER: Quick Copy — โชว์ปุ่ม 📋 ตอน hover (มือถือโชว์ถาวร) กดแล้ว copy เข้าคลิปบอร์ด
// ใช้: qcopyHtml(text) แทนที่ sanitize(text) ตรงๆ ในจุดที่อยากให้ copy ได้
// ================================================================
function qcopyHtml(text) {
  if (text === null || text === undefined || text === '') return '';
  return '<span class="qcopy" data-copy="' + sanitize(String(text)) + '">' + sanitize(String(text)) +
    '<button class="qcopy-btn" onclick="event.stopPropagation();copyToClip(this.parentElement.dataset.copy)" title="คัดลอก">📋</button></span>';
}

function copyToClip(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      if (typeof toast === 'function') toast('📋 คัดลอกแล้ว: ' + text);
    }).catch(function() { copyToClipFallback(text); });
  } else {
    copyToClipFallback(text);
  }
}

function copyToClipFallback(text) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (typeof toast === 'function') toast('📋 คัดลอกแล้ว: ' + text);
  } catch (e) {
    if (typeof toast === 'function') toast('❌ คัดลอกไม่สำเร็จ');
  }
}

// Safe render (allow basic HTML but escape user content)
function safeText(str) {
  return sanitize(str).replace(/\n/g, '<br>');
}
// ================================================================
// ICS EXPORT (Outlook / Google Calendar)
// ================================================================
function exportToICS(summary, description, startDate, endDate, location, url) {
  function formatDate(dateStr, isAllDay) {
    if (!dateStr) return '';
    var d = parseThaiDate(dateStr);
    if (!d) return '';
    if (isAllDay) {
      return d.toISOString().split('T')[0].replace(/-/g, '');
    }
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
  
  var now = new Date();
  var uid = Date.now() + '-' + Math.random().toString(36).substr(2, 8) + '@dji-sales';
  
  var icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DJI Sales Assistant//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + formatDate(_td(), false),
    'SUMMARY:' + (summary || '').replace(/[,;]/g, '').substr(0, 100),
    'DESCRIPTION:' + (description || '').replace(/[,;]/g, '').substr(0, 500)
  ];
  
  if (startDate) {
    var isAllDay = startDate.length === 10 && !endDate;
    icsLines.push('DTSTART:' + formatDate(startDate, isAllDay));
    if (endDate) {
      icsLines.push('DTEND:' + formatDate(endDate, isAllDay));
    } else if (isAllDay) {
      var nextDay = addD(startDate, 1);
      icsLines.push('DTEND:' + formatDate(nextDay, true));
    }
  }
  
  if (location) icsLines.push('LOCATION:' + location.replace(/[,;]/g, '').substr(0, 100));
  if (url) icsLines.push('URL:' + url);
  
  icsLines.push('END:VEVENT');
  icsLines.push('END:VCALENDAR');
  
  var blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = (summary || 'event').replace(/[/\\?%*:|"<>]/g, '-') + '.ics';
  link.click();
  URL.revokeObjectURL(link.href);
  
  toast('📅 สร้างไฟล์ .ics แล้ว! เปิดด้วย Outlook หรือ Google Calendar ได้');
}