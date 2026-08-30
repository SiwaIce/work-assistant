// ================================================================
// DEALER SCOPE — ตัวกรอง "Dealer ที่ดูแล" แบบ global ใช้ร่วมกันทั้งแอพ (แทนที่ dealerSaleFilter เดิมที่เคย
// เป็น local variable เฉพาะหน้า Dealers) ค่าเริ่มต้น (mode 'mine') = เห็นเฉพาะ Dealer ที่ d.saleName ตรงกับ
// cfg.saleName (ชื่อผู้ใช้เอง ตั้งใน Admin) — เลือกดูของคนอื่นเพิ่มได้ (mode 'custom') หรือดูทั้งหมด (mode 'all')
// เก็บ persist ไว้ที่ localStorage ตรงๆ (ไม่ผ่าน ST/sync — เป็นการตั้งค่าส่วนตัวของเบราว์เซอร์นี้ ไม่ต้องแชร์ทีม)
// ================================================================
var DEALER_SCOPE_KEY = 'v7_dealerScope';
function getDealerScope() {
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem(DEALER_SCOPE_KEY)); } catch(e) {}
  if (!raw || !raw.mode) return { mode: 'mine', names: [] };
  return { mode: raw.mode, names: Array.isArray(raw.names) ? raw.names : [] };
}
function setDealerScope(mode, names) {
  localStorage.setItem(DEALER_SCOPE_KEY, JSON.stringify({ mode: mode, names: names || [] }));
  if (typeof render === 'function') render();
}
// ชื่อของฉันเอง (ตั้งใน Admin > ชื่อผู้ใช้) — ใช้เป็นค่าเริ่มต้นของ mode 'mine' เสมอ — อ่านตรงจาก config ที่
// เซฟไว้ ไม่เรียก getConfig() เต็มรูปแบบ (deep-clone DEF_CONFIG ทั้งก้อน + merge ทุก field) เพราะฟังก์ชันนี้
// ถูกเรียกทุก render() (ผ่าน updateDealerScopeBadge/scopedDealers) ทั่วทั้งแอพ ถ้า deep-clone ทุกครั้งจะหน่วง
// สะสมชัดเจนบนมือถือ — saleName เป็น field ธรรมดาไม่มี merge logic พิเศษ (ดู getConfig ใน app.js) ปลอดภัยที่
// จะอ่านลัดแบบนี้
function myDealerScopeName() {
  try {
    var saved = ST.getObj('config');
    if (saved && saved.saleName) return saved.saleName;
  } catch (e) {}
  return 'Siwawong';
}
// รายชื่อ saleName ที่ "เห็นได้ตอนนี้" ตาม mode ปัจจุบัน — mode 'all' คืน null (แปลว่าไม่กรอง)
function dealerScopeActiveNames() {
  var scope = getDealerScope();
  if (scope.mode === 'all') return null;
  if (scope.mode === 'custom') return scope.names.length ? scope.names : [myDealerScopeName()];
  return [myDealerScopeName()];
}
function dealerInScope(d) {
  var names = dealerScopeActiveNames();
  if (!names) return true;
  return names.indexOf((d && d.saleName) || '') !== -1;
}
// Dealer ทั้งหมดที่อยู่ในขอบเขตที่เลือกไว้ตอนนี้ — ใช้แทน ST.getAll('dealers') ตรงๆ ในหน้า dashboard/browsing
// (ไม่ใช้ในจุดที่ต้อง pick Dealer ของใครก็ได้ เช่น dropdown ตอนบันทึก Follow-up/LINE Log/Visit ให้คนอื่น)
function scopedDealers() {
  var all = ST.getAll('dealers');
  var names = dealerScopeActiveNames();
  if (!names) return all;
  return all.filter(function(d) { return names.indexOf(d.saleName || '') !== -1; });
}
// {dealerId: true} ของ Dealer ในขอบเขตปัจจุบัน — ใช้กรอง record อื่น (pipeline/task ฯลฯ) ผ่าน .dealerId โดย
// เร็วกว่าเรียก dealerInScope() (lookup ST.getOne) ในลูปยาวๆ — record ที่ไม่มี dealerId เลย (งานทั่วไป ไม่ผูก
// Dealer) ควรโชว์เสมอ ไม่กรองออก เช็คแยกเองที่จุดเรียกด้วย pattern "!x.dealerId || scopedDealerIdSet()[x.dealerId]"
function scopedDealerIdSet() {
  var set = {};
  scopedDealers().forEach(function(d) { set[d.id] = true; });
  return set;
}
// ข้อความสั้นๆ โชว์บน badge ตัวเลือก scope บน topbar
function dealerScopeLabel() {
  var scope = getDealerScope();
  if (scope.mode === 'all') return '🌐 ทั้งหมด';
  var names = dealerScopeActiveNames() || [];
  var mine = myDealerScopeName();
  if (scope.mode === 'mine' || (names.length === 1 && names[0] === mine)) return '👤 ของฉัน';
  return '👥 ' + names.length + ' คน';
}

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
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('customerForecasts', item);
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
// แคชผลลัพธ์ไว้ด้วยตัว string เดิมเป็น key — ฟังก์ชันนี้ถูกเรียกซ้ำมหาศาลตอนเทียบโครงการทีละคู่แบบ
// O(n²) (ทุกคู่ทุก pipeline) ถ้าไม่แคช ชื่อเดิมจะถูกตัดคำนำหน้าซ้ำๆ หลายพันครั้งโดยไม่จำเป็น ทำให้
// หน้า "เทียบ Project"/ตรวจโครงการชนกันหน่วงเวลาโหลดนานผิดปกติเมื่อมี Pipeline เยอะ (พบว่าเป็นสาเหตุ)
var _pipeOrgNormCache = {};
function _pipeNormOrgName(s) {
  s = (s || '').toString();
  if (_pipeOrgNormCache.hasOwnProperty(s)) return _pipeOrgNormCache[s];
  var out = s;
  _PIPE_ORG_AFFIXES.forEach(function(re) { out = out.replace(re, ''); });
  _pipeOrgNormCache[s] = out;
  return out;
}
// แคช bigram map ด้วย string เดิมเป็น key — เหตุผลเดียวกับแคชด้านบน: ตอนเทียบ Pipeline ทีละคู่แบบ
// O(n²) ชื่อเดิมของ pipeline แต่ละอันจะถูกส่งเข้า fcStrSim ซ้ำเป็นร้อยครั้ง (เทียบกับทุกอันที่เหลือ)
// ถ้าไม่แคชจะ build bigram map ของสตริงเดิมซ้ำๆ โดยไม่จำเป็น เป็นส่วนที่กินเวลามากที่สุดของฟังก์ชันนี้
var _fcGramsCache = {};
function _fcGrams(s) {
  if (_fcGramsCache.hasOwnProperty(s)) return _fcGramsCache[s];
  var m = {};
  for (var i = 0; i < s.length - 1; i++) { var g = s.substr(i, 2); m[g] = (m[g] || 0) + 1; }
  _fcGramsCache[s] = m;
  return m;
}
function fcStrSim(a, b) {
  a = (a || '').toString().toLowerCase().replace(/\s+/g, '');
  b = (b || '').toString().toLowerCase().replace(/\s+/g, '');
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  var ba = _fcGrams(a), bb = _fcGrams(b), inter = 0, total = 0;
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
// แคชด้วย id+updated (invalidate อัตโนมัติเมื่อ pipeline ถูกแก้ไข) — เหตุผลเดียวกับ _pipeOrgNormCache
// ข้างบน ฟังก์ชันนี้ถูกเรียกซ้ำ O(n²) ตอนเทียบโครงการทีละคู่ ถ้าไม่แคชจะคำนวณรายการสินค้าเดิมซ้ำ
// หลายพันครั้งโดยไม่จำเป็นเมื่อมี Pipeline เยอะ
var _pipeModelsSetCache = {};
function pipeModelsSet(p) {
  var cacheKey = p && p.id ? (p.id + ':' + (p.updated || p.created || '')) : null;
  if (cacheKey && _pipeModelsSetCache.hasOwnProperty(cacheKey)) return _pipeModelsSetCache[cacheKey];
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
  if (cacheKey) _pipeModelsSetCache[cacheKey] = s;
  return s;
}
// weights: ส่งเข้ามาได้ (ไม่บังคับ) — ตอนเทียบทีละคู่แบบ O(n²) (detectPipelineConflicts, renderPipeCompareSuggestPanel)
// ต้อง hoist getConfig() ออกมาเรียกครั้งเดียวก่อนเข้าลูป ไม่ใช่เรียกในนี้ทุกคู่ เพราะ getConfig() เป็นฟังก์ชัน
// หนัก (deep-clone DEF_CONFIG ทั้งก้อนด้วย JSON.parse(JSON.stringify(...)) ทุกครั้ง) เรียกซ้ำหลายหมื่นครั้ง
// ตอนมี Pipeline เยอะกลายเป็นคอขวดที่แท้จริง (พบว่าหนักกว่าการคำนวณ similarity เองด้วยซ้ำ)
function pipeMatchScore(a, b, weights) {
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
  // น้ำหนักตั้งค่าเองได้ (cfg.pipeMatchWeights ดูค่า default ที่ DEF_CONFIG ใน app.js, แก้ได้ที่
  // showPipeMatchWeightsM() ใน views-pipeline.js) — End User หนักสุดโดย default เพราะมักเป็นจุดแรกที่
  // เทียบได้ก่อน (ชื่อโปรเจคมักตั้งทีหลัง/เปลี่ยนคำพูดกันคนละแบบ)
  var w = weights || (typeof getConfig === 'function' && getConfig().pipeMatchWeights) || { eu: 35, name: 25, model: 15, agencyMain: 10, agencySub: 10, bidding: 5 };
  var score = eu * (w.eu / 100) + name * (w.name / 100) + model * (w.model / 100) + am * (w.agencyMain / 100) + asb * (w.agencySub / 100) + bid * (w.bidding / 100);
  return Math.round(score * 100);
}
// ตรวจโครงการชนกันแบบ "กดเอง" แทนรันอัตโนมัติทุกครั้งที่เปิดหน้า — detectPipelineConflicts() เป็น O(n²)
// เทียบทุกคู่ Pipeline ใช้เวลาหลายวินาทีเมื่อข้อมูลเยอะ (วัดได้ ~12 วิ ที่ 301 Pipeline) เดิมรันอัตโนมัติ
// ทุก render แล้ว cache หลุดทันทีที่มีการแก้ Pipeline ไหนก็ตาม (key ผูกกับ updated ของทุกตัว) ทำให้หน้า
// Pipeline ค้างบ่อย — ย้ายมาเป็นปุ่มกดเอง หน้าโหลดไวเสมอ ไม่ต้องรอผลตรวจ
var _pipeConflictCacheKey = null;
var _pipeConflictCache = { conflicts: [], map: {} };
function _pipeConflictPoolKey(pool, threshold) {
  return pool.map(function(p) { return p.id + '@' + (p.updated || p.created || ''); }).join('|') + '::' + threshold;
}
// อ่านผลที่เคยตรวจไว้ (ถ้ามีและยังตรงกับข้อมูลปัจจุบัน) — ไม่คำนวณใหม่ตรงนี้เด็ดขาด แค่บอกว่ามีผลอยู่ไหม/
// เก่าหรือเปล่า ให้หน้าตัดสินใจว่าจะโชว์ปุ่ม "ตรวจ" หรือ "ตรวจใหม่"
function pipeConflictLookup(pool, threshold) {
  var key = _pipeConflictPoolKey(pool, threshold);
  var hasCache = !!_pipeConflictCacheKey;
  var stale = _pipeConflictCacheKey !== key;
  return {
    conflicts: hasCache ? _pipeConflictCache.conflicts : [],
    map: hasCache ? _pipeConflictCache.map : {},
    checked: hasCache,
    stale: stale
  };
}
// คำนวณจริง (หนัก) — เรียกเฉพาะตอนผู้ใช้กดปุ่มเท่านั้น
function runPipeConflictCheck(pool, threshold) {
  var conflicts = (typeof detectPipelineConflicts === 'function') ? detectPipelineConflicts(pool, threshold) : [];
  var map = buildConflictMap(conflicts);
  _pipeConflictCacheKey = _pipeConflictPoolKey(pool, threshold);
  _pipeConflictCache = { conflicts: conflicts, map: map };
  render();
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
  var weights = (typeof getConfig === 'function' && getConfig().pipeMatchWeights) || null; // เรียก getConfig() ครั้งเดียวก่อนลูป ไม่ใช่ต่อคู่
  var pairs = [];
  for (var i = 0; i < active.length; i++) {
    for (var j = i + 1; j < active.length; j++) {
      if (active[i].dealerId && active[i].dealerId === active[j].dealerId) continue; // ข้าม dealer เดียวกัน
      var key = [active[i].id, active[j].id].sort().join('__');
      if (dismissed[key]) continue;
      var sc = pipeMatchScore(active[i], active[j], weights);
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
    var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : [];
    // item ที่แบ่งส่งไว้ (shipBatches) — แยกยอดไปตามเดือนของแต่ละล็อตเอง ไม่รวมกับ shipDate เดียวของโปรเจค
    // ที่เหลือ (item ไม่ได้แบ่งส่ง / ไม่มี items เลย) ยังใช้ getPipeShipDate เดิมเป็น bucket เดียว
    var itemsNoBatch = [];
    items.forEach(function (it) {
      if (it.shipBatches && it.shipBatches.length) {
        var amt = (Number(it.qty) || 1) * (Number(it.price) || 0);
        var totalBatchQty = it.shipBatches.reduce(function (s, b) { return s + (Number(b.qty) || 0); }, 0) || (Number(it.qty) || 1);
        it.shipBatches.forEach(function (b) {
          if (!b.month) return;
          var parts = b.month.split('-');
          var by = parseInt(parts[0], 10), bm = parseInt(parts[1], 10) - 1;
          if (isNaN(by) || isNaN(bm) || bm < 0 || bm > 11) return;
          if (year && by !== year) return;
          var bamt = totalBatchQty ? amt * ((Number(b.qty) || 0) / totalBatchQty) : 0;
          data[bm].conf += bamt; // วันที่ระบุเองถือเป็นค่ายืนยัน ไม่ใช่ค่าประมาณ
        });
      } else {
        itemsNoBatch.push(it);
      }
    });

    var ship = getPipeShipDate(p);
    if (!ship) return;
    if (fcHideTentative && ship.est) return;
    if (year && ship.date.getFullYear() !== year) return;
    var m = ship.date.getMonth();
    var amt2 = 0;
    if (items.length) itemsNoBatch.forEach(function (it) { amt2 += (Number(it.qty) || 1) * (Number(it.price) || 0); });
    else amt2 = Number(p.forecastAmount) || 0;
    if (!amt2) return;
    if (ship.est) data[m].est += amt2; else data[m].conf += amt2;
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
// VISIT FORECAST QTY — เดือน key 'YYYY-MM' + รายการสินค้าแบบ {model,qty}[] (utils.js เพราะ
// features.js/views-dealer.js/views-visit.js/modals.js ใช้ร่วมกันหมด)
// ================================================================
var THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// อุตสาหกรรมที่ Dealer ให้บริการ (multi-select) — ตรงตามคอลัมน์ในแท็บ SAB ของ "Dealer Develop.xlsx"
// (2026-08-28) ใช้ร่วมกันระหว่างฟอร์มแก้ไข Dealer (modals.js) กับการแสดงผลแท็บข้อมูล (views-dealer.js)
var DEALER_INDUSTRY_TAGS = ['Police', 'Fire Fighter & Rescue', 'Emergency Response', 'Law Enforcement', 'Construction', 'Survey', 'Mining', 'Utilities', 'Green Energy', 'Oil & Gas', 'Geological exploration', 'Agriculture'];
function fcMonthKey(offset) {
  var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + (offset || 0));
  return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
}
function fcMonthLabel(key) {
  var parts = (key || '').split('-');
  if (parts.length !== 2) return key || '';
  var mi = parseInt(parts[1], 10) - 1;
  return (THAI_MONTHS_SHORT[mi] || '?') + ' ' + (parseInt(parts[0], 10) + 543);
}
// items เดิมเคยเป็น string อิสระ (ก่อนเปลี่ยนเป็นรายการ model+qty แบบมีโครงสร้าง) — เก็บ backward-compat
// ไว้เผื่อ Visit เก่าที่บันทึกไปแล้วยังมีข้อมูลเป็น string อยู่
function fcHasItems(fn) { return Array.isArray(fn.items) ? fn.items.length > 0 : !!fn.items; }
function fcItemsText(fn) {
  if (Array.isArray(fn.items)) return fn.items.map(function(it) { return (it.model || '') + (Number(it.qty) > 1 ? ' x' + it.qty : ''); }).join(', ');
  return fn.items || '';
}
// ดึง Forecast ที่เคย "ยังไม่ถึงเดือน" ไว้จาก Visit ล่าสุดของ Dealer นี้ มาเป็นค่าเริ่มต้นให้ Visit ใหม่ —
// กันต้องพิมพ์ใหม่ทุกครั้งที่ไป Visit ต่อเนื่อง เช่น เดือนนี้ forecast ก.ย.+ต.ค. ไว้ พอเดือนหน้าไป Visit จริง
// (ต.ค.) ก็ควรเห็น forecast ต.ค. ที่เคยประเมินไว้มาปรับเพิ่ม/ลดต่อ ไม่ใช่กรอกใหม่จากศูนย์
function visitCarryForecast(dealerId) {
  if (!dealerId || typeof ST === 'undefined') return null;
  var curKey = fcMonthKey(0);
  var visits = ST.visitsByDealer(dealerId);
  for (var i = 0; i < visits.length; i++) {
    var fcs = (visits[i].forecastNotes || []).filter(function(f) { return f.month && f.month >= curKey; });
    if (fcs.length) return { fromDate: visits[i].date, items: fcs };
  }
  return null;
}

// ================================================================
// PROJECT POS แนะนำ — ไม่บังคับใช้ (sale ยังกรอกเองได้ตามเดิม) คำนวณจากฟิลด์ pipeline ที่มีอยู่แล้วเท่านั้น
// น้ำหนักแต่ละปัจจัยอยู่ใน cfg.posWeights (app.js) แก้ได้จากปุ่ม ⚙️ ข้าง POS แนะนำ ไม่ต้องเข้า Admin
// (ดู showPosWeightsEditorM ใน modals.js) — คืนทั้งคะแนนรวมและ breakdown เพื่อโชว์เหตุผลทีละข้อ/copy ไปแปะ Sheet
// ================================================================
function computeSuggestedPOS(p, cfg, latestLogDate) {
  cfg = cfg || getConfig();
  var w = cfg.posWeights || {};
  var reasons = [];
  var total = 0;

  var stName = (cfg.pipelineStatuses || []).find(function(s) { return s.id === p.status; });
  var base = (w.stageBase || {})[p.status];
  if (base === undefined) {
    base = !stName ? (w.stageBaseActiveDefault || 30)
      : stName.category === 'won' ? (w.stageBaseWon || 95)
      : stName.category === 'lost' ? (w.stageBaseLost || 5)
      : (w.stageBaseActiveDefault || 30);
  }
  total += base;
  reasons.push({ label: 'Stage "' + (stName ? stName.name : p.status) + '"', delta: null, text: 'ฐาน ' + base + '%' });

  if (p.appointmentLetter === 'ออกแล้ว' && w.appointmentIssued) { total += w.appointmentIssued; reasons.push({ label: '✅ ออกหนังสือแต่งตั้งแล้ว', delta: w.appointmentIssued }); }
  if (p.tor === 'Lock' && w.torLock) { total += w.torLock; reasons.push({ label: '📋 TOR Lock แล้ว', delta: w.torLock }); }
  if (p.djiCrmRegistered && w.crmRegistered) { total += w.crmRegistered; reasons.push({ label: '✅ ลงทะเบียน CRM DJI แล้ว', delta: w.crmRegistered }); }
  if (p.hasCompetitor && w.hasCompetitor) { total += w.hasCompetitor; reasons.push({ label: '⚠️ มีคู่แข่ง', delta: w.hasCompetitor }); }
  if (p.pocDone && w.pocDone) { total += w.pocDone; reasons.push({ label: '🛠 ไป POC แล้ว', delta: w.pocDone }); }
  if (p.presentedDone && w.presentedDone) { total += w.presentedDone; reasons.push({ label: '🛠 พรีเซนต์งานให้หน่วยงานแล้ว', delta: w.presentedDone }); }
  if (p.torDraftDone && w.torDraftDone) { total += w.torDraftDone; reasons.push({ label: '🛠 ร่าง TOR ให้หน่วยงานแล้ว', delta: w.torDraftDone }); }

  if (p.followupDate) {
    var fdDays = dTo(p.followupDate);
    if (fdDays < 0 && w.followupOverdue) { total += w.followupOverdue; reasons.push({ label: '⚠️ Follow-up ค้างเกินกำหนด', delta: w.followupOverdue }); }
    else if (fdDays >= 0 && w.followupUpcoming) { total += w.followupUpcoming; reasons.push({ label: '✅ Follow-up ยังไม่ถึงกำหนด', delta: w.followupUpcoming }); }
  }

  if (latestLogDate) {
    var logDays = daysBetween(latestLogDate.split('T')[0], _td());
    if (logDays <= 14 && w.logFresh) { total += w.logFresh; reasons.push({ label: '⏱ อัพเดตล่าสุด ' + logDays + ' วันก่อน', delta: w.logFresh }); }
    else if (logDays > 60 && w.logStale) { total += w.logStale; reasons.push({ label: '⏱ ไม่มีการอัพเดตมา ' + logDays + ' วัน', delta: w.logStale }); }
  } else if (w.logStale) {
    total += w.logStale; reasons.push({ label: '⏱ ไม่เคยมี Log เลย', delta: w.logStale });
  }

  total = Math.max(0, Math.min(100, Math.round(total)));
  return { score: total, reasons: reasons };
}
// เก็บประวัติ POS ทุกครั้งที่มีการเซ็ต/เปลี่ยนค่าจริง (ไม่ใช่แค่ suggested ที่คำนวณสดแล้วไม่ได้บันทึก) — ใช้เป็น
// "ค่าที่เชื่อ ณ เวลานั้น" สำหรับเทียบกับผลจริงตอนปิดโครงการ (ดู computePosCalibration) เรียกจากทุกจุดที่เขียน
// projectPOS จริง: _finishSavePipeline (modals.js), apply-suggested-POS ใน Visit form (modals.js), setPipePos
// (views-pipeline.js) — ไม่ log จาก bulk import เพราะเป็นข้อมูลย้อนหลัง ไม่ใช่การรีวิวจริงตอนนั้น
function appendPosHistory(existingPipe, newPos) {
  var hist = (existingPipe && Array.isArray(existingPipe.posHistory)) ? existingPipe.posHistory.slice() : [];
  var lastPos = hist.length ? hist[hist.length - 1].pos : (existingPipe ? (existingPipe.projectPOS || 0) : undefined);
  if (lastPos !== newPos) {
    hist.push({ date: _nw(), pos: newPos });
    if (hist.length > 50) hist = hist.slice(hist.length - 50);
  }
  return hist;
}
// แปลง breakdown จาก computeSuggestedPOS() เป็นข้อความ copy ไปวางเป็น comment ใน Google Sheet ได้เลย
function posReasonsText(result) {
  var lines = result.reasons.map(function(r) {
    return '• ' + r.label + ' → ' + (r.delta === null ? r.text : (r.delta >= 0 ? '+' : '') + r.delta + '%');
  });
  return '🎯 POS แนะนำ ' + result.score + '% — เหตุผล:\n' + lines.join('\n') + '\nรวม = ' + result.score + '%';
}

// ================================================================
// POS CALIBRATION — เทียบ POS ที่ "เชื่อ ณ ตอนนั้น" (ค่าสุดท้ายใน posHistory ก่อนโครงการปิด) กับผลจริงว่า
// Win กี่ % ของแต่ละช่วง — โครงการเก่าก่อนเริ่มเก็บ posHistory จะ fallback ไปใช้ projectPOS ปัจจุบันตรงๆ (คร่าวๆ
// แต่ดีกว่าไม่มีข้อมูลเลย) ยิ่ง POS ช่วงไหนมี actualRate ใกล้ predictedMid มาก แปลว่า weight ที่ตั้งไว้แม่นดีแล้ว
// ================================================================
var POS_CAL_BUCKETS = [
  { id: 'b0', min: 0,  max: 19,  label: '0-19%' },
  { id: 'b1', min: 20, max: 39,  label: '20-39%' },
  { id: 'b2', min: 40, max: 59,  label: '40-59%' },
  { id: 'b3', min: 60, max: 79,  label: '60-79%' },
  { id: 'b4', min: 80, max: 100, label: '80-100%' }
];
function _posLastKnownBeforeClose(p) {
  if (Array.isArray(p.posHistory) && p.posHistory.length) return p.posHistory[p.posHistory.length - 1].pos;
  return typeof p.projectPOS === 'number' ? p.projectPOS : 0;
}
function computePosCalibration() {
  var closed = ST.getAll('pipeline').filter(function(p) { return pipeIsWon(p) || pipeIsLost(p); });
  var buckets = POS_CAL_BUCKETS.map(function(b) {
    return { id: b.id, min: b.min, max: b.max, label: b.label, predictedMid: Math.round((b.min + b.max) / 2), total: 0, won: 0, pipes: [] };
  });
  closed.forEach(function(p) {
    var pos = _posLastKnownBeforeClose(p);
    var bucket = buckets.filter(function(b) { return pos >= b.min && pos <= b.max; })[0];
    if (!bucket) return;
    bucket.total++;
    if (pipeIsWon(p)) bucket.won++;
    bucket.pipes.push(p);
  });
  buckets.forEach(function(b) { b.actualRate = b.total ? Math.round(b.won / b.total * 100) : null; });
  var withData = buckets.filter(function(b) { return b.total > 0; });
  var totalClosed = closed.length;
  var totalWithHistory = closed.filter(function(p) { return Array.isArray(p.posHistory) && p.posHistory.length; }).length;
  return { buckets: buckets, totalClosed: totalClosed, totalWithHistory: totalWithHistory, hasEnoughData: withData.length > 0 };
}

// ================================================================
// COMPETITOR ROLLUP — รวม p.competitorName (กรอกไว้แล้วในแต่ละ Pipeline ตอน hasCompetitor=true) เป็นภาพรวม
// รายคู่แข่ง: เจอกี่โครงการ มูลค่ารวมเท่าไหร่ ผลแพ้/ชนะกับคู่แข่งรายนั้นกี่ครั้ง — ไม่มีฟิลด์ใหม่ ดึงจากข้อมูล
// เดิมล้วนๆ จำกัดตาม dealer scope (topbar picker) เหมือนหน้าอื่นๆ ทั้งแอพ
// ================================================================
function computeCompetitorStats() {
  var _scopedIds = scopedDealerIdSet();
  var pipes = ST.getAll('pipeline').filter(function(p) {
    return p.hasCompetitor && (p.competitorName || '').trim() && (!p.dealerId || _scopedIds[p.dealerId]);
  });
  var groups = {};
  pipes.forEach(function(p) {
    var name = p.competitorName.trim();
    if (!groups[name]) groups[name] = { name: name, count: 0, totalValue: 0, won: 0, lost: 0, pipes: [] };
    var g = groups[name];
    g.count++;
    g.totalValue += Number(p.forecastAmount) || 0;
    if (pipeIsWon(p)) g.won++;
    else if (pipeIsLost(p)) g.lost++;
    g.pipes.push(p);
  });
  var list = Object.keys(groups).map(function(k) {
    var g = groups[k];
    var closed = g.won + g.lost;
    g.winRate = closed ? Math.round(g.won / closed * 100) : null;
    return g;
  });
  list.sort(function(a, b) { return b.count - a.count; });
  return list;
}

// ================================================================
// VISIT COVERAGE — ข้อกำหนดบริษัท: Dealer ระดับ S/A/B (Authorized) ต้องมี Offline Visit อย่างน้อย 1 ครั้ง/เดือน
// เช็คสถานะแต่ละ Dealer ต่อเดือนที่ระบุ (default เดือนปัจจุบัน): 'visited' (มี Visit Report offline เดือนนี้
// แล้ว) > 'planned' (มีนัด Visit Plan offline เดือนนี้ที่ยังไม่ได้ไป) > 'none' (ยังไม่มีทั้งนัดและ Visit เลย)
// ใช้ร่วมกันทั้งหน้า Visit Plan (การ์ดหลัก) และหน้า Visit Report (badge เตือนสั้นๆ) — จำกัดตาม dealer scope
// (scopedDealers, utils.js) เหมือนหน้าอื่นๆ ทั้งแอพ ค่าเริ่มต้นเห็นเฉพาะ Dealer ของตัวเอง
// ================================================================
function visitCoverageForMonth(monthKey) {
  monthKey = monthKey || _td().substr(0, 7);
  var base = (typeof scopedDealers === 'function') ? scopedDealers() : ST.getAll('dealers');
  var dealers = base.filter(function(d) { return ['S', 'A', 'B'].indexOf(d.level) !== -1; });
  var visits = ST.getAll('visits');
  var plans = (typeof getVisitPlans === 'function') ? getVisitPlans() : [];
  var rows = dealers.map(function(d) {
    var visited = visits.filter(function(v) { return v.dealerId === d.id && v.mode === 'offline' && (v.date || '').substr(0, 7) === monthKey; });
    var planned = plans.filter(function(p) { return p.dealerId === d.id && p.mode === 'offline' && (p.date || '').substr(0, 7) === monthKey && p.status !== 'done'; });
    visited.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    planned.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
    var state = visited.length ? 'visited' : (planned.length ? 'planned' : 'none');
    return { dealer: d, state: state, visitCount: visited.length, lastVisit: visited[0] || null, nextPlan: planned[0] || null };
  });
  return rows;
}

// ================================================================
// MONDAY MEETING — สรุป H1/H2 ต่อบริษัท (ใช้ทั้งหน้าสรุปรวม rMondayMeeting และหน้ารายบริษัท
// rMondayCompany ใน views-pipeline.js) ดึงจากข้อมูลจริงทั้งหมด ไม่มีตัวเลขสมมติ:
//   - Won (H1/H2 · Project) = Pipeline สถานะ Won จริง แบ่งครึ่งปีตาม expectedCloseDate (fallback registerDate)
//   - Won/คาดไว้ (H1/H2 · Runrate) = customerForecasts type:'runrate' แบ่งครึ่งปีตาม month, เดือนที่ผ่านไปแล้ว
//     ถือว่า "ปิดแล้ว" เดือนที่ยังไม่ถึงถือว่า "คาดไว้ที่เหลือ" (ยังไม่มี field อนุมัติแยกต่างหากในระบบตอนนี้)
//   - Pipeline เปิดอยู่ = สถานะยังไม่ Won/Lost ถ่วงด้วย POS (computeSuggestedPOS) แยก bucket สูง/กลาง/ต่ำ
// ================================================================
var MONDAY_STALE_DAYS = 30; // Pipeline เปิดอยู่ที่ไม่มี Log อัพเดตเกินกี่วัน ถือว่า "เงียบ"
// รวมมูลค่า (qty × price) เฉพาะ item ที่เป็น Dock/Dock 3 ในโครงการหนึ่ง — ใช้คำนวณ KPI Dock Target แยกจาก
// ยอดขายรวม (ดู dockWonH1/H2 ใน mondayCompanyStats)
function _pipeDockRevenue(p) {
  var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : (p.items || []);
  var sum = 0;
  (items || []).forEach(function(it) {
    var name = (it.model || '').toUpperCase();
    if (name.indexOf('DOCK') !== -1) sum += (Number(it.qty) || 1) * (Number(it.price) || 0);
  });
  return sum;
}
function _mondayHalf(dateStr) {
  if (!dateStr) return null;
  var y = parseInt(dateStr.substr(0, 4), 10);
  if (y !== new Date().getFullYear()) return null;
  var m = parseInt(dateStr.substr(5, 2), 10);
  return m >= 1 && m <= 6 ? 'H1' : (m >= 7 && m <= 12 ? 'H2' : null);
}
function mondayCompanyStats(dealerId, cfg) {
  cfg = cfg || getConfig();
  var d = ST.getOne('dealers', dealerId);
  var allPipes = ST.pipelineByDealer(dealerId);
  // ตัด p.status !== 'deliver' ทิ้งตรงๆ ไว้เผื่อ config pipelineStatuses ที่ Admin แก้เองไม่ได้ตั้ง category
  // ของ Deliver เป็น 'won' (ปกติ pipeIsWon ควรจะ true ให้ deliver อยู่แล้วจาก DEF_CONFIG แต่ config ที่บันทึก
  // ทับใน localStorage มา replace ทั้งก้อนตอน getConfig() ไม่ merge — เผื่อพลาดจุดนี้ไว้ กันงานที่ส่งมอบแล้ว
  // จริงๆ (จบงานแล้ว ไม่ใช่ "โอกาส" อีกต่อไป) หลุดเข้ามานับเป็น opportunity/POS bucket ทำให้ % เพี้ยน
  var activePipes = allPipes.filter(function(p) { return !pipeIsWon(p) && !pipeIsLost(p) && p.status !== 'deliver'; });
  var wonPipes = allPipes.filter(pipeIsWon);
  var curMonthKey = fcMonthKey(0);

  var wonH1Project = 0, wonH2Project = 0;
  var wonProjectsH1 = [], wonProjectsH2 = [];
  // Dock (Dock/Dock 3 รวมกัน) แยกเป็น KPI ของตัวเอง คู่กับ dockTargetH1/H2 บน Dealer — DJI ผลักดัน Dock เป็น
  // สินค้า strategic ต่างหากจากยอดขายรวม (ดูไฟล์ Dealer_Improve_Plan_2026.xlsx ที่ตั้งเป้า Dock แยกจาก Sales Target)
  var dockWonH1 = 0, dockWonH2 = 0;
  wonPipes.forEach(function(p) {
    var half = _mondayHalf(p.expectedCloseDate || p.registerDate);
    var amt = Number(p.realAmount || p.forecastAmount) || 0;
    var dockAmt = _pipeDockRevenue(p);
    if (half === 'H1') { wonH1Project += amt; wonProjectsH1.push(p); dockWonH1 += dockAmt; }
    else if (half === 'H2') { wonH2Project += amt; wonProjectsH2.push(p); dockWonH2 += dockAmt; }
  });

  var rrEntries = ST.filter('customerForecasts', function(f) { return f.dealerId === dealerId && f.type === 'runrate'; });
  var wonH1Runrate = 0, wonH2RunrateWon = 0, h2RunrateRemaining = 0;
  var rrWonH1 = [], rrWonH2 = [], rrRemainH2 = [];
  rrEntries.forEach(function(r) {
    var half = _mondayHalf((r.month || '') + '-01');
    if (!half) return;
    var val = (getModelPrice(r.model) || 0) * (Number(r.qty) || 0);
    var isPast = r.month && r.month <= curMonthKey;
    if (half === 'H1') { wonH1Runrate += val; rrWonH1.push(r); }
    else if (isPast) { wonH2RunrateWon += val; rrWonH2.push(r); }
    else { h2RunrateRemaining += val; rrRemainH2.push(r); }
  });

  var high = [], mid = [], low = [];
  var openPipelineTotal = 0, openPipelineWeighted = 0;
  // แยก weighted ตามงวดที่ "คาดว่าจะปิด" ด้วย (H1/H2 — ใช้ expectedCloseDate จริงถ้ามี ไม่งั้นเดาจาก Bidding
  // Date +1 เดือน ดู pipeEffectiveCloseDate) เพราะ openPipelineWeighted รวมทุกงวดปนกัน เอาไปบวกตรงๆ กับเป้า
  // ของ "ครึ่งปีเดียว" (เช่น ใน computeKpiCompanyPlan/dealerPeriodRisk) จะทำให้ Pipeline ที่จะปิดปีหน้า/H อื่น
  // ไปช่วยดันตัวเลข Gap ของงวดนี้ผิดๆ (พบจริง 2026-08-21 — ตัวเลข "Pipeline ถ่วง POS" ใน Improvement Plan สูง
  // เกินจริงเพราะรวม Pipeline นอกงวดเข้าไปด้วย) — ตัวที่ไม่มีทั้ง 2 วันที่เลย ไม่รู้จะเดางวดไหน จึงไม่ถูกนับใน
  // ทั้ง H1/H2 split นี้ (แต่ยังนับใน openPipelineWeighted/openPipelineTotal รวมตามเดิม)
  var openPipelineWeightedH1 = 0, openPipelineWeightedH2 = 0;
  // ยอด "ดิบ" (ไม่ถ่วง POS) แยกงวดด้วยเหมือนกัน — ใช้โชว์ "Pipeline Forecast ทั้งหมด" ของ H นั้นๆ คู่กับตัวถ่วง
  // POS ในการ์ด Sales Gap & Capability ให้เห็นทั้งมูลค่าเต็มและมูลค่าที่ประเมินความเสี่ยงแล้ว
  var openPipelineTotalH1 = 0, openPipelineTotalH2 = 0;
  // ตั้ง p._pos ลง object เดิมตรงๆ (ST.pipelineByDealer คืน object ที่ parse ใหม่จาก localStorage ทุกครั้งอยู่
  // แล้ว ไม่ใช่ reference ที่ใครแชร์กัน) กัน activePipes/high/mid/low ชี้คนละชุดกันแล้ว ._pos หายตอนใช้ต่อ
  activePipes.forEach(function(p) {
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    var pos = computeSuggestedPOS(p, cfg, lastLog ? lastLog.date : null).score;
    if (typeof p.projectPOS === 'number' && p.projectPOS) pos = p.projectPOS; // ค่าที่ sale กรอกเองมาก่อนเสมอ ถ้ามี
    p._pos = pos;
    var amt = Number(p.forecastAmount) || 0;
    openPipelineTotal += amt;
    var w = amt * pos / 100;
    openPipelineWeighted += w;
    var half = _mondayHalf(pipeEffectiveCloseDate(p));
    if (half === 'H1') { openPipelineWeightedH1 += w; openPipelineTotalH1 += amt; }
    else if (half === 'H2') { openPipelineWeightedH2 += w; openPipelineTotalH2 += amt; }
    if (pos >= 70) high.push(p); else if (pos >= 40) mid.push(p); else low.push(p);
  });
  var commitAmt = high.reduce(function(s, p) { return s + (Number(p.forecastAmount) || 0); }, 0);
  var bestAmt = commitAmt + mid.reduce(function(s, p) { return s + (Number(p.forecastAmount) || 0); }, 0);

  var staleThreshold = new Date(); staleThreshold.setDate(staleThreshold.getDate() - MONDAY_STALE_DAYS);
  var staleThresholdIso = staleThreshold.toISOString().slice(0, 10);
  var stalePipes = activePipes.filter(function(p) {
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    var lastDate = lastLog ? lastLog.date.split('T')[0] : (p.registerDate || '');
    return !lastDate || lastDate < staleThresholdIso;
  });

  var lastVisitDays = (typeof ST.getLastVisitDays === 'function') ? ST.getLastVisitDays(dealerId) : null;

  var _tgt = getTargetForYear(d, new Date().getFullYear());
  return {
    dealer: d, activePipes: activePipes, wonPipes: wonPipes,
    targetH1: _tgt.h1, targetH2: _tgt.h2,
    dockTargetH1: _tgt.dockH1, dockTargetH2: _tgt.dockH2,
    dockWonH1: dockWonH1, dockWonH2: dockWonH2,
    wonH1Project: wonH1Project, wonH2Project: wonH2Project, wonProjectsH1: wonProjectsH1, wonProjectsH2: wonProjectsH2,
    wonH1Runrate: wonH1Runrate, wonH2RunrateWon: wonH2RunrateWon, h2RunrateRemaining: h2RunrateRemaining,
    rrWonH1: rrWonH1, rrWonH2: rrWonH2, rrRemainH2: rrRemainH2,
    high: high, mid: mid, low: low, commitAmt: commitAmt, bestAmt: bestAmt,
    openPipelineTotal: openPipelineTotal, openPipelineWeighted: openPipelineWeighted,
    openPipelineWeightedH1: openPipelineWeightedH1, openPipelineWeightedH2: openPipelineWeightedH2,
    openPipelineTotalH1: openPipelineTotalH1, openPipelineTotalH2: openPipelineTotalH2,
    stalePipes: stalePipes, lastVisitDays: lastVisitDays
  };
}

// ================================================================
// DEALER RISK RADAR — ประเมินว่า Dealer แต่ละคนกำลัง "เสี่ยงหลุดเป้า" ครึ่งปีปัจจุบันไหม โดยเทียบ pace ที่ต้อง
// เร่งในวันที่เหลือของงวด กับ pace เฉลี่ยที่ตัวเองเคยทำได้จริงมาแล้วในงวดนี้ — ต่างจาก Achieve% ธรรมดา
// (ยอดจริง/เป้า) ตรงที่รู้จัก "เวลา": Achieve 30% ตอนต้นงวดกับตอนใกล้ปิดงวดมีความเสี่ยงไม่เท่ากัน ตัวนี้จับ
// ความต่างนั้นได้ (improvement plan "Dealer Risk Radar" เสนอ 2026-08-20)
// ================================================================
function dealerPeriodRisk(dealerId, cfg) {
  cfg = cfg || getConfig();
  var d = ST.getOne('dealers', dealerId);
  if (!d) return null;

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var year = today.getFullYear();
  var halves = sisComputeHalfMonths(cfg);
  var curMonth = today.getMonth(); // 0-11
  var isH1 = halves.h1.indexOf(curMonth) !== -1;
  var half = isH1 ? halves.h1Period : halves.h2Period;
  var halfKey = isH1 ? 'h1' : 'h2';
  var _tgtRisk = getTargetForYear(d, year);
  var target = isH1 ? _tgtRisk.h1 : _tgtRisk.h2;

  var periodStart = new Date(year, half.startMonth, 1);
  var periodEnd = new Date(year, half.endMonth + 1, 0); // วันสุดท้ายของ endMonth (day 0 ของเดือนถัดไป)
  var msDay = 86400000;
  var daysTotal = Math.round((periodEnd - periodStart) / msDay) + 1;
  var daysElapsed = Math.min(daysTotal, Math.max(0, Math.round((today - periodStart) / msDay) + 1));
  var daysRemaining = Math.max(0, daysTotal - daysElapsed);

  var sis = getSisRevenueForYear(d, year);
  var actual = Number(sis[halfKey]) || 0;
  var stats = mondayCompanyStats(dealerId, cfg);
  var weighted = isH1 ? stats.openPipelineWeightedH1 : stats.openPipelineWeightedH2; // เฉพาะ Pipeline ที่คาดปิดงวดนี้ ถ่วงด้วย POS แล้ว
  var projected = actual + weighted;
  var gap = Math.max(0, target - projected); // ช่องว่างที่ยังขาดหลังหักลบ Pipeline ที่คาดว่าจะปิดได้แล้ว

  var historicalDailyRate = daysElapsed > 0 ? actual / daysElapsed : 0;
  var requiredDailyRate = daysRemaining > 0 ? gap / daysRemaining : (gap > 0 ? Infinity : 0);
  var paceMultiplier;
  if (gap <= 0) paceMultiplier = 0;
  else if (historicalDailyRate <= 0) paceMultiplier = Infinity; // ยังไม่เคยปิดยอดเลยในงวดนี้ แต่ยังมีช่องว่างต้องปิด
  else paceMultiplier = requiredDailyRate / historicalDailyRate;

  // เกณฑ์: ครอบคลุมแล้ว(safe) / ต้องเร่งไม่เกิน 2 เท่าของ pace เดิม(watch) / เกิน 2 เท่าหรือหมดเวลาแล้วยังไม่ถึงเป้า(critical)
  var level = 'none'; // ไม่มีเป้าตั้งไว้ — ไม่นับเป็นความเสี่ยง (เหมือน UI Achieve% เดิมที่ซ่อนถ้ายังไม่ตั้งเป้า)
  if (target > 0) {
    if (gap <= 0) level = 'safe';
    else if (daysRemaining <= 0) level = 'critical';
    else if (paceMultiplier <= 1.3) level = 'safe';
    else if (paceMultiplier <= 2) level = 'watch';
    else level = 'critical';
  }

  return {
    dealer: d, half: isH1 ? 'H1' : 'H2', target: target, actual: actual, weighted: weighted,
    projected: projected, gap: gap, daysTotal: daysTotal, daysElapsed: daysElapsed, daysRemaining: daysRemaining,
    historicalDailyRate: historicalDailyRate, requiredDailyRate: requiredDailyRate, paceMultiplier: paceMultiplier,
    level: level
  };
}

// เดา Expected Close Date จาก Bidding Date + 1 เดือน ถ้าโครงการยังไม่ได้กรอก Expected Close Date เอง (พบบ่อย
// เพราะ field นี้เพิ่งมาทีหลัง Bidding Date) เป็นแค่ค่าประมาณคร่าวๆ ให้พอจัดกลุ่มงวด H1/H2/ปีถัดไปได้ ไม่ใช่ค่า
// ที่แม่นยำจริง (ใช้ใน Project Conversion Plan — kpiImpProjectConversionSection ใน views-kpiplan.js)
function pipeEffectiveCloseDate(p) {
  if (p.expectedCloseDate) return p.expectedCloseDate;
  if (!p.biddingDate) return '';
  var parts = p.biddingDate.split('-');
  if (parts.length !== 3) return '';
  var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
  var dt = new Date(y, m + 1, d); // +1 เดือน
  var mm = dt.getMonth() + 1, dd = dt.getDate();
  return dt.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
}

// ================================================================
// KPI COMPANY PLAN — แผนบรรลุเป้ารายบริษัท (SAB Partner) รายเดือน แยก Project/Runrate
// ต่อยอดจาก mondayCompanyStats: เดือนที่ผ่านไปแล้ว/เดือนนี้ = ยอดจริง (ล็อก แก้ไม่ได้)
// เดือนอนาคต = ค่าแนะนำอัตโนมัติจาก Pipeline เปิดอยู่ (ถ่วง POS ตาม expectedCloseDate) +
// customerForecasts type:runrate เดือนนั้น หรือถ้า sale พิมพ์ทับเอง (v7_kpiMonthlyPlan) ใช้ค่านั้นแทน
// ================================================================
function getKpiMonthlyPlan(dealerId, month) {
  return ST.getAll('kpiMonthlyPlan').find(function(x) { return x.dealerId === dealerId && x.month === month; }) || null;
}
function saveKpiMonthlyPlan(dealerId, month, project, runrate) {
  var existing = getKpiMonthlyPlan(dealerId, month);
  if (existing) return ST.update('kpiMonthlyPlan', existing.id, { project: project, runrate: runrate });
  return ST.add('kpiMonthlyPlan', { dealerId: dealerId, month: month, project: project, runrate: runrate });
}
function kpiCompanyPlanMonths() {
  var curMonth = new Date().getMonth() + 1; // 1-12
  var half = curMonth <= 6 ? 'H1' : 'H2';
  var startOffset = half === 'H1' ? (1 - curMonth) : (7 - curMonth);
  var months = [];
  for (var i = 0; i < 6; i++) months.push(fcMonthKey(startOffset + i));
  return { half: half, months: months };
}
function computeKpiCompanyPlan(dealerId, cfg) {
  cfg = cfg || getConfig();
  var stats = mondayCompanyStats(dealerId, cfg);
  var mm = kpiCompanyPlanMonths();
  var curKey = fcMonthKey(0);
  var target = mm.half === 'H1' ? stats.targetH1 : stats.targetH2;

  var projectActualByMonth = {};
  stats.wonPipes.forEach(function(p) {
    var key = (p.expectedCloseDate || p.registerDate || '').slice(0, 7);
    if (!key) return;
    projectActualByMonth[key] = (projectActualByMonth[key] || 0) + (Number(p.realAmount || p.forecastAmount) || 0);
  });
  var projectForecastByMonth = {};
  stats.activePipes.forEach(function(p) {
    var key = (p.expectedCloseDate || '').slice(0, 7);
    if (!key) return;
    var amt = (Number(p.forecastAmount) || 0) * (p._pos || 0) / 100;
    projectForecastByMonth[key] = (projectForecastByMonth[key] || 0) + amt;
  });
  var runrateByMonth = {};
  ST.filter('customerForecasts', function(f) { return f.dealerId === dealerId && f.type === 'runrate'; }).forEach(function(r) {
    if (!r.month) return;
    var val = (getModelPrice(r.model) || 0) * (Number(r.qty) || 0);
    runrateByMonth[r.month] = (runrateByMonth[r.month] || 0) + val;
  });

  // ยอดขาย SIS จริง (ตัวเลขบัญชีจริง จาก getSisRevenueForYear เดียวกับหน้าแก้ยอดขาย SIS) — เดือน/Q/H ทั้งหมด
  // อยู่ปีเดียวกันเสมอ เพราะ kpiCompanyPlanMonths() ยึด 6 เดือนของ H ปัจจุบัน ไม่ข้ามปี
  var sisYear = mm.months[0].slice(0, 4);
  var sisRev = getSisRevenueForYear(stats.dealer, sisYear);
  var sisQuarters = sisSummarizeMonthly(sisRev.monthly, cfg);

  // โครงการเปิดอยู่ (ยังไม่ Won/Lost) ที่ตั้ง Expected Close Date ไว้ในเดือนนั้น — โชว์ให้เห็นเฉยๆ ว่ามีโอกาส
  // ได้รายได้เดือนไหนบ้างถ้าปิดตามแผน ไม่เอาไปนับรวมในยอดใดๆ ทั้งสิ้น (ยังไม่ปิดงานจริง)
  var closingByMonth = {};
  stats.activePipes.forEach(function(p) {
    var key = (p.expectedCloseDate || '').slice(0, 7);
    if (!key) return;
    if (!closingByMonth[key]) closingByMonth[key] = [];
    closingByMonth[key].push({ id: p.id, rowNo: p.rowNo || '', projectName: p.projectName || '', forecastAmount: Number(p.forecastAmount) || 0, pos: p._pos || 0 });
  });
  Object.keys(closingByMonth).forEach(function(key) {
    closingByMonth[key].sort(function(a, b) { return b.forecastAmount - a.forecastAmount; });
  });

  var monthly = mm.months.map(function(key) {
    var isPast = key < curKey, isCurrent = key === curKey, isFuture = key > curKey;
    var project, runrate, isManual = false;
    if (!isFuture) {
      project = projectActualByMonth[key] || 0;
      runrate = runrateByMonth[key] || 0;
    } else {
      var override = getKpiMonthlyPlan(dealerId, key);
      if (override) { project = Number(override.project) || 0; runrate = Number(override.runrate) || 0; isManual = true; }
      else { project = projectForecastByMonth[key] || 0; runrate = runrateByMonth[key] || 0; }
    }
    var sisActual = Number(sisRev.monthly[parseInt(key.slice(5, 7), 10)]) || 0;
    return { month: key, label: fcMonthLabel(key).split(' ')[0], isPast: isPast, isCurrent: isCurrent, isFuture: isFuture, project: project, runrate: runrate, isManual: isManual, sisActual: sisActual, closingPipes: closingByMonth[key] || [] };
  });

  var forecastTotal = monthly.reduce(function(s, m) { return s + m.project + m.runrate; }, 0);
  var actualSoFar = monthly.filter(function(m) { return !m.isFuture; }).reduce(function(s, m) { return s + m.project + m.runrate; }, 0);
  var gap = target - forecastTotal;

  // แยกคนละแหล่งข้อมูลให้ชัด — djiActual = ยอด Won จริงที่บันทึกใน Pipeline (คนละระบบกับยอดขาย SIS จากบัญชี
  // เอาไว้เทียบกันว่าตรงกันไหม), runrateForecast = Runrate ที่ยังไม่ถึงเดือน (โอกาส ยังไม่ใช่ของจริง เหมือน Pipeline เปิดอยู่)
  var djiActual = monthly.filter(function(m) { return !m.isFuture; }).reduce(function(s, m) { return s + m.project; }, 0);
  var runrateForecast = monthly.filter(function(m) { return m.isFuture; }).reduce(function(s, m) { return s + m.runrate; }, 0);

  // รายละเอียดสำหรับ modal เจาะลึก (กดจาก stat card) — เอามาจาก stats.activePipes/wonPipes ตรงๆ ไม่คำนวณซ้ำ
  var openPipelinesList = stats.activePipes.map(function(p) {
    return { id: p.id, rowNo: p.rowNo || '', projectName: p.projectName || '', forecastAmount: Number(p.forecastAmount) || 0, pos: p._pos || 0, expectedCloseDate: p.expectedCloseDate || '' };
  }).sort(function(a, b) { return b.forecastAmount - a.forecastAmount; });
  var wonPipelinesList = stats.wonPipes.filter(function(p) {
    return _mondayHalf(p.expectedCloseDate || p.registerDate) === mm.half;
  }).map(function(p) {
    return { id: p.id, rowNo: p.rowNo || '', projectName: p.projectName || '', amount: Number(p.realAmount || p.forecastAmount) || 0, closeDate: p.expectedCloseDate || p.registerDate || '' };
  }).sort(function(a, b) { return b.amount - a.amount; });

  // pipeWeighted ต้องเป็น Pipeline ที่คาดปิด "งวดนี้" เท่านั้น (ไม่ใช่รวมทุกงวด) ไม่งั้น Gap จะดูดีเกินจริง
  // เพราะมี Pipeline ที่จะปิด H/ปีอื่นมาช่วยลด Gap ของงวดนี้ผิดๆ (ดูคอมเมนต์ที่ openPipelineWeightedH1/H2 ใน mondayCompanyStats)
  var pipeWeighted = mm.half === 'H1' ? stats.openPipelineWeightedH1 : stats.openPipelineWeightedH2;
  // ยอดดิบ (ไม่ถ่วง POS) เฉพาะงวดนี้ — คนละตัวกับ pipelineRawTotal ด้านล่างที่ตั้งใจให้เป็นยอดรวมทุกงวด (ใช้โชว์
  // "Pipeline มูลค่ารวม" แบบภาพกว้างที่อื่น) ตัวนี้ใช้เฉพาะการ์ด Sales Gap & Capability ที่ต้องพูดถึงงวดนี้เท่านั้น
  var pipelineTotalPeriod = mm.half === 'H1' ? stats.openPipelineTotalH1 : stats.openPipelineTotalH2;
  return {
    dealer: stats.dealer, target: target, half: mm.half, months: mm.months, monthly: monthly,
    actualSoFar: actualSoFar, pipeWeighted: pipeWeighted, pipelineTotalPeriod: pipelineTotalPeriod, pipelineRawTotal: stats.openPipelineTotal, forecastTotal: forecastTotal, gap: gap,
    djiActual: djiActual, runrateForecast: runrateForecast,
    openPipelinesList: openPipelinesList, wonPipelinesList: wonPipelinesList,
    sisQuarters: sisQuarters, sisYear: sisYear,
    stalePipes: stats.stalePipes, lastVisitDays: stats.lastVisitDays
  };
}
// รวมทุกบริษัท SAB Partner (level S/A/B) ที่อยู่ในขอบเขต dealer scope ปัจจุบัน — ใช้หน้า rKpiCompanyPlan
function computeKpiCompanyPlanAll(cfg) {
  cfg = cfg || getConfig();
  var dealers = scopedDealers().filter(function(d) { return ['S', 'A', 'B'].indexOf(d.level) !== -1; });
  return dealers.map(function(d) { return computeKpiCompanyPlan(d.id, cfg); })
    .sort(function(a, b) { return (b.gap) - (a.gap); });
}

// ================================================================
// SALES OVERVIEW — หน้า "📊 ภาพรวมยอดขาย" ต่อยอดจาก computeKpiCompanyPlan ตรงๆ ไม่คำนวณซ้ำ
// ต่างจาก computeKpiCompanyPlanAll ตรงที่ไม่กรองแค่ระดับ S/A/B (ภาพรวมทั้งบริษัทต้องเห็นทุก Dealer)
// และรองรับเลือกดูเป็นรายเดือน/ไตรมาส/ครึ่งปี โดยตัด index จาก monthly[] ของแต่ละบริษัท (ละเอียดสุดที่มีอยู่แล้ว)
// หมายเหตุ: Pipeline (จำนวน/มูลค่าดิบ/ถ่วง POS) เป็นภาพรวม ณ ตอนนี้เสมอ ไม่ scale ตามช่วงเวลาที่เลือก เพราะเป็น
// สแนปช็อตปัจจุบัน ไม่ใช่ยอดสะสมของแต่ละช่วง (ต่างจาก SIS/DJI/Project/Runrate ที่เป็นยอดสะสมตามช่วงเวลาจริง)
// ================================================================
function salesOverviewScopeDealers(scope, subValue) {
  var all = scopedDealers();
  if (scope === 'dealer') return all.filter(function(d) { return d.id === subValue; });
  if (scope === 'sales') return all.filter(function(d) { return (d.saleName || '') === subValue; });
  return all;
}

// คืน index (0-5) ของ monthly[] ที่จะรวม ตาม period — เดือน=เดือนปัจจุบันเดือนเดียว, ไตรมาส=3 เดือนของไตรมาส
// ปัจจุบัน (Q1/Q2 อยู่ H1, Q3/Q4 อยู่ H2), ครึ่งปี=ทั้ง 6 เดือนของ H ปัจจุบัน
function salesOverviewMonthIdx(period) {
  var mm = kpiCompanyPlanMonths();
  var curIdx = mm.months.indexOf(fcMonthKey(0));
  if (curIdx === -1) curIdx = 0;
  if (period === 'month') return [curIdx];
  if (period === 'quarter') { var qStart = curIdx < 3 ? 0 : 3; return [qStart, qStart + 1, qStart + 2]; }
  return [0, 1, 2, 3, 4, 5];
}

function salesOverviewSaleNames() {
  var members = (typeof getSalesMembers === 'function' ? getSalesMembers() : []).map(function(m) { return m.name; }).filter(Boolean);
  if (members.length) return members;
  var set = {};
  scopedDealers().forEach(function(d) { if (d.saleName) set[d.saleName] = true; });
  return Object.keys(set).sort();
}

function computeSalesOverview(scope, subValue, period) {
  var cfg = getConfig();
  var dealers = salesOverviewScopeDealers(scope, subValue);
  var dealerIdSet = {}; dealers.forEach(function(d) { dealerIdSet[d.id] = true; });
  var plans = dealers.map(function(d) { return computeKpiCompanyPlan(d.id, cfg); });
  var mm = kpiCompanyPlanMonths();
  var idxs = salesOverviewMonthIdx(period);
  var monthKeys = idxs.map(function(i) { return mm.months[i]; });
  var rangeStart = monthKeys.length ? monthKeys[0] + '-01' : _td();

  var sis = 0, djiActual = 0, projectTotal = 0, runrateTotal = 0, targetTotal = 0;
  var pipeWeighted = 0, pipelineRawTotal = 0, pipeCount = 0;
  plans.forEach(function(p) {
    idxs.forEach(function(i) {
      var m = p.monthly[i]; if (!m) return;
      sis += m.sisActual;
      if (!m.isFuture) djiActual += m.project;
      projectTotal += m.project; runrateTotal += m.runrate;
    });
    targetTotal += p.target * (idxs.length / 6);
    pipeWeighted += p.pipeWeighted;
    pipelineRawTotal += p.pipelineRawTotal;
    pipeCount += p.openPipelinesList.length;
  });
  var winrate = pipelineRawTotal > 0 ? Math.round(pipeWeighted / pipelineRawTotal * 100) : 0;

  var soCount = ST.filter('salesOrders', function(s) { return dealerIdSet[s.dealerId] && s.createdAt && s.createdAt.slice(0, 10) >= rangeStart; }).length;
  var activeDealerCount = plans.filter(function(p) { return idxs.some(function(i) { return p.monthly[i] && p.monthly[i].sisActual > 0; }); }).length;
  var newDealerCount = dealers.filter(function(d) { return d.created && d.created.slice(0, 10) >= rangeStart; }).length;
  var riskDealerCount = plans.filter(function(p) { return kpiPlanStatus(p).label !== 'ถึงเป้าแล้ว'; }).length;

  return {
    scope: scope, subValue: subValue, period: period, dealers: dealers, plans: plans, mm: mm, idxs: idxs, monthKeys: monthKeys,
    sis: sis, dji: djiActual, so: soCount, activeDealer: activeDealerCount, newDealer: newDealerCount, riskDealer: riskDealerCount,
    pipeCount: pipeCount, pipeRaw: pipelineRawTotal, pipeWeighted: pipeWeighted, winrate: winrate,
    project: projectTotal, runrate: runrateTotal, target: targetTotal
  };
}

function _soItemCategory(item) {
  var p = item.sku && typeof getProductBySku === 'function' ? getProductBySku(item.sku) : null;
  if (!p && item.model && typeof getAllProducts === 'function') {
    p = getAllProducts().find(function(x) { return x.model === item.model || x.name === item.model; });
  }
  return p ? (p.category || 'other') : 'other';
}

// สินค้าขายดี — เรียงตามยอดขาย(บาท) หรือจำนวน(เครื่อง) กรองตามกลุ่มสินค้าได้ — จาก Sales Order items ในขอบเขต+ช่วงเวลาที่เลือก
function salesOverviewTopProducts(ov, mode, category) {
  var dealerIdSet = {}; ov.dealers.forEach(function(d) { dealerIdSet[d.id] = true; });
  var byModel = {};
  ST.getAll('salesOrders').forEach(function(s) {
    if (!dealerIdSet[s.dealerId]) return;
    var mk = (s.createdAt || '').slice(0, 7);
    if (ov.monthKeys.indexOf(mk) === -1) return;
    (s.items || []).forEach(function(it) {
      var cat = _soItemCategory(it);
      if (category !== 'all' && cat !== category) return;
      var key = it.model || it.sku || '-';
      if (!byModel[key]) byModel[key] = { nm: key, cat: cat, value: 0, qty: 0 };
      byModel[key].value += (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
      byModel[key].qty += Number(it.qty) || 0;
    });
  });
  var list = Object.keys(byModel).map(function(k) { return byModel[k]; });
  list.sort(function(a, b) { return mode === 'qty' ? b.qty - a.qty : b.value - a.value; });
  return list.slice(0, 5);
}

// Dealer ยอดขายสูงสุด — แท่งสัดส่วน SIS จริง(ช่วงที่เลือก) / Pipeline ถ่วง POS(สแนปช็อตปัจจุบัน) / เสนอราคาดิบที่เหลือ
function salesOverviewTopDealers(ov) {
  var list = ov.plans.map(function(p) {
    var sisAmt = ov.idxs.reduce(function(s, i) { return s + (p.monthly[i] ? p.monthly[i].sisActual : 0); }, 0);
    var pipeAmt = p.pipeWeighted;
    var quoteAmt = Math.max(0, p.pipelineRawTotal - p.pipeWeighted);
    var tot = sisAmt + pipeAmt + quoteAmt;
    return {
      nm: p.dealer.name, id: p.dealer.id, tot: tot,
      sis: tot ? Math.round(sisAmt / tot * 100) : 0, pipe: tot ? Math.round(pipeAmt / tot * 100) : 0, quote: tot ? Math.round(quoteAmt / tot * 100) : 0
    };
  }).filter(function(x) { return x.tot > 0; });
  list.sort(function(a, b) { return b.tot - a.tot; });
  return list;
}

// โครงการเด่น — รวม openPipelinesList ของทุกบริษัทในขอบเขต เรียงตามยอด หรือตามเดือนคาด Bidding/ปิดได้
function salesOverviewHighlightProjects(ov) {
  var list = [];
  ov.plans.forEach(function(p) {
    p.openPipelinesList.forEach(function(pp) {
      list.push({ id: pp.id, nm: pp.projectName, dealer: p.dealer.name, amt: pp.forecastAmount, pos: pp.pos, closeDate: pp.expectedCloseDate || '' });
    });
  });
  return list;
}

// แนวโน้มยอดขาย SIS รายเดือน — ปีนี้เทียบปีก่อน ตามชุดเดือนของครึ่งปีปัจจุบัน (kpiCompanyPlanMonths) รวมทุก Dealer ในขอบเขต
function salesOverviewTrend(ov) {
  var curYear = parseInt(ov.mm.months[0].slice(0, 4), 10);
  var cur = ov.mm.months.map(function() { return 0; });
  var last = ov.mm.months.map(function() { return 0; });
  ov.dealers.forEach(function(d) {
    var revCur = getSisRevenueForYear(d, String(curYear));
    var revLast = getSisRevenueForYear(d, String(curYear - 1));
    ov.mm.months.forEach(function(mk, i) {
      var mo = parseInt(mk.slice(5, 7), 10);
      cur[i] += Number(revCur.monthly[mo]) || 0;
      last[i] += Number(revLast.monthly[mo]) || 0;
    });
  });
  var curSum = cur.reduce(function(a, b) { return a + b; }, 0);
  var lastSum = last.reduce(function(a, b) { return a + b; }, 0);
  var yoy = lastSum > 0 ? Math.round((curSum - lastSum) / lastSum * 100) : (curSum > 0 ? 100 : 0);
  return { months: ov.mm.months, cur: cur, last: last, yoy: yoy };
}

// Sales Performance — จัดกลุ่มตาม saleName ของ Dealer แต่ละบริษัท นับสถานะ (ถึงเป้าแล้ว/ต้องเร่ง/เสี่ยงสูง) จาก kpiPlanStatus เดิม
function salesOverviewTeamPerf(ov) {
  var byRep = {};
  ov.plans.forEach(function(p) {
    var rep = p.dealer.saleName || '(ไม่ระบุ)';
    if (!byRep[rep]) byRep[rep] = { nm: rep, good: 0, warn: 0, bad: 0 };
    var label = kpiPlanStatus(p).label;
    if (label === 'ถึงเป้าแล้ว') byRep[rep].good++;
    else if (label === 'ต้องเร่ง') byRep[rep].warn++;
    else byRep[rep].bad++;
  });
  var list = Object.keys(byRep).map(function(k) { return byRep[k]; });
  list.sort(function(a, b) { return (b.warn + b.bad) - (a.warn + a.bad); });
  return list;
}

// ไตรมาสปฏิทินปัจจุบัน (Q1=ม.ค.-มี.ค. ฯลฯ) — ต่างจาก Thai Fiscal Year (thaiFYFromISO) ที่ใช้ที่อื่นในแอป
// ใช้เฉพาะจุด "โครงการในไตรมาสนี้" ของ Monday Meeting ที่ Ryan ถามถึงตรงๆ เป็นปฏิทินสากล ไม่ใช่ปีงบ
function mondayQuarterRange() {
  var now = new Date();
  var q = Math.floor(now.getMonth() / 3);
  var start = new Date(now.getFullYear(), q * 3, 1);
  var end = new Date(now.getFullYear(), q * 3 + 3, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: 'Q' + (q + 1) + '/' + now.getFullYear() };
}

// ดีเลย์ = วันที่ตั้งไว้ (Bidding/Expected Close/Shipment) ผ่านมาแล้วแต่โครงการยังไม่ Win/Lost — คืน array
// เผื่อโครงการเดียวดีเลย์หลายจุดพร้อมกัน (เช่น ทั้ง Bidding และ Shipment ผ่านมาแล้ว)
function mondayDelayInfo(p) {
  var today = _td();
  var checks = [{ field: 'biddingDate', label: 'Bidding' }, { field: 'expectedCloseDate', label: 'Expected Close' }, { field: 'shipmentDate', label: 'Shipment' }];
  var delays = [];
  checks.forEach(function(c) {
    var v = p[c.field];
    if (v && v < today) delays.push({ label: c.label, date: v, days: daysBetween(v, today) });
  });
  return delays;
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
// TASK LINKS — เชื่อม Task กับเมนูอื่น (Dealer/Pipeline/Visit/Visit Plan/SO/Meeting/ใบเสนอราคา)
// เก็บเป็น task.links = [{type, id, label}] — label แช่แข็งไว้ตอนเพิ่ม กันต้อง query ชื่อใหม่ทุกครั้งที่ render
// ================================================================
var TASK_LINK_TYPES = {
  dealer:    { icon: '🏪', name: 'Dealer' },
  pipeline:  { icon: '📊', name: 'Pipeline' },
  visit:     { icon: '🤝', name: 'Visit' },
  visitPlan: { icon: '📅', name: 'Visit Plan' },
  so:        { icon: '📦', name: 'Sales Order' },
  meeting:   { icon: '🗓️', name: 'Meeting' },
  quotation: { icon: '💰', name: 'ใบเสนอราคา' }
};

// คืน [{id,label}] ของประเภทที่เลือก ไว้ใช้สร้าง dropdown ตอนเพิ่มลิงก์
function taskLinkList(type) {
  var out = [];
  if (type === 'dealer') {
    ST.getAll('dealers').forEach(function(d) { out.push({ id: d.id, label: d.name || '-' }); });
  } else if (type === 'pipeline') {
    ST.getAll('pipeline').forEach(function(p) {
      var d = ST.getOne('dealers', p.dealerId);
      out.push({ id: p.id, label: (p.projectName || '-') + (d ? ' — ' + d.name : '') });
    });
  } else if (type === 'visit') {
    ST.getAll('visits').forEach(function(v) {
      var d = ST.getOne('dealers', v.dealerId);
      out.push({ id: v.id, label: fD(v.date) + ' — ' + (d ? d.name : (v.company || '?')) });
    });
  } else if (type === 'visitPlan') {
    getVisitPlans().forEach(function(p) {
      var d = ST.getOne('dealers', p.dealerId);
      out.push({ id: p.id, label: fD(p.date) + ' — ' + (d ? d.name : (p.company || '?')) });
    });
  } else if (type === 'so') {
    ST.getAll('salesOrders').forEach(function(s) { out.push({ id: s.id, label: (s.soNumber || '-') + (s.dealerName ? ' — ' + s.dealerName : '') }); });
  } else if (type === 'meeting') {
    ST.getAll('meetings').forEach(function(m) { out.push({ id: m.id, label: m.title || '-' }); });
  } else if (type === 'quotation') {
    var qs = [];
    try { qs = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch (e) {}
    qs.forEach(function(q) { out.push({ id: q.id, label: (q.quoteNo || '-') + (q.dealerName ? ' — ' + q.dealerName : '') }); });
  }
  return out;
}

// เปิดหน้า detail ของสิ่งที่ลิงก์ไว้ — quotation/visitPlan ไม่มี route ตรงๆ ใช้ S.focusQuoteId/S.focusPlanId
// แทน (ดู hook ใน rQuotationV2/rVisitPlan) ให้ render เสร็จก่อนแล้วค่อยเปิดโมดัล/หน้าแก้ไขต่อ
function openTaskLink(type, id) {
  if (type === 'dealer') go('dealerDetail', { dealerId: id });
  else if (type === 'pipeline') go('pipeDetail', { pipeId: id });
  else if (type === 'visit') go('visitDetail', { visitId: id });
  else if (type === 'visitPlan') go('visitPlan', { focusPlanId: id });
  else if (type === 'so') go('soDetail', { soId: id });
  else if (type === 'meeting') go('meetingDetail', { meetingId: id });
  else if (type === 'quotation') go('quotationV2', { focusQuoteId: id });
}

function removeTaskLink(taskId, idx) {
  var t = ST.getOne('tasks', taskId);
  if (!t || !t.links) return;
  t.links.splice(idx, 1);
  ST.update('tasks', taskId, { links: t.links });
  render();
}

// ================================================================
// TASK LINKS — "รอสร้าง" (pending): ผูก Task กับเมนูอื่นได้ล่วงหน้าแม้ยังไม่มีข้อมูลจริง (เช่น อยากผูก
// ใบเสนอราคาแต่ยังไม่ได้ทำ) กด badge แล้วพาไปหน้า "สร้างใหม่" ของเมนูนั้นตรงๆ พร้อมโชว์บริบทงานเป็น
// guideline และผูก id จริงกลับให้อัตโนมัติหลังบันทึกสำเร็จ (ดู resolveTaskPendingLink)
// ================================================================
var _pendingLinkTaskId = null;

function openTaskLinkCreate(type, taskId) {
  _pendingLinkTaskId = taskId;
  var t = ST.getOne('tasks', taskId);
  var dealerId = t ? (t.dealerId || '') : '';
  if (type === 'quotation') showCreateQuotationModal();
  else if (type === 'visitPlan') showAddVisitPlanM(_td(), dealerId, null);
  else if (type === 'so') showCreateSOModal({ dealerId: dealerId });
  else if (type === 'meeting') showMeetingM();
  else if (type === 'visit') showVisitM(dealerId, null);
}

// แบนเนอร์ลิงก์ย้อนกลับ — แปะบนหน้ารายละเอียดของ record ที่มี sourceTaskId (สร้างผ่าน "รอสร้าง" มา)
// ใช้ได้เฉพาะ 5 เมนูที่สร้างจาก pending link เท่านั้น (quotation/so/meeting/visit/visitPlan) — Dealer/Pipeline
// ไม่มีแบบนี้เพราะ 1 Dealer ผูกกับหลาย Task พร้อมกันได้ ไม่มีทาง "งานต้นทาง" เดียวที่ถูกต้องแน่นอน
function _sourceTaskBackLinkHtml(sourceTaskId) {
  if (!sourceTaskId) return '';
  var t = ST.getOne('tasks', sourceTaskId);
  if (!t) return '';
  return '<div style="background:var(--bg2);border:1px solid var(--accent);border-radius:10px;padding:8px 12px;margin-bottom:12px;cursor:pointer" onclick="go(\'taskDetail\',{taskId:\'' + sourceTaskId + '\'})">' +
    '<span style="color:var(--accent);font-size:12px;font-weight:600">◀ มาจากงาน: ' + sanitize(t.title) + '</span></div>';
}

// แบนเนอร์บริบทงาน — แปะบนสุดของฟอร์ม "สร้างใหม่" เมื่อเปิดมาจาก openTaskLinkCreate เท่านั้น
function _pendingLinkGuidelineHtml() {
  if (!_pendingLinkTaskId) return '';
  var t = ST.getOne('tasks', _pendingLinkTaskId);
  if (!t) return '';
  return '<div style="background:var(--bg2);border:1px solid var(--accent);border-radius:10px;padding:10px 12px;margin-bottom:12px">' +
    '<div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:2px">📋 กำลังสร้างให้กับงาน</div>' +
    '<div style="font-size:13px;font-weight:600">' + sanitize(t.title) + '</div>' +
    (t.description ? '<div style="font-size:12px;color:var(--text2);margin-top:3px;white-space:pre-wrap">' + sanitize(t.description) + '</div>' : '') +
    '</div>';
}

// เรียกตอนบันทึก "สร้างใหม่" สำเร็จของแต่ละเมนู (เฉพาะ record ใหม่ ไม่ใช่แก้ไขของเดิม) — ถ้ามี pending
// task ค้างอยู่ (เปิดมาจาก openTaskLinkCreate) จะแทนที่ลิงก์ pending ด้วย id จริง แล้วเคลียร์ตัวแปรทิ้ง
function resolveTaskPendingLink(type, newId, newLabel) {
  var taskId = _pendingLinkTaskId;
  if (!taskId) return;
  _pendingLinkTaskId = null;
  var t = ST.getOne('tasks', taskId);
  if (!t || !t.links) return;
  var idx = -1;
  for (var i = 0; i < t.links.length; i++) {
    if (t.links[i].type === type && t.links[i].pending) { idx = i; break; }
  }
  if (idx === -1) return;
  t.links[idx] = { type: type, id: newId, label: newLabel };
  ST.update('tasks', taskId, { links: t.links });
  toast('🔗 ผูกกับงาน "' + t.title + '" ให้แล้ว');
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

// รวมยอด/จำนวนของ "สถานะที่เลือกไว้" ตอนติ๊กหลายช่องพร้อมกันบนแถบสถานะ (pipe-sum-card) — ใช้ร่วมกันทั้ง
// เมนู Pipeline หลัก, Pipeline รวมทีม, และ Pipeline ในหน้า Dealer (ดูตัวอย่างการเรียกที่ views-pipeline.js/views-dealer.js)
// โชว์เฉพาะตอนเลือกตั้งแต่ 2 สถานะขึ้นไป — เลือก 0 ช่อง = การ์ด "ทั้งหมด" มีให้อยู่แล้ว, เลือก 1 ช่อง = ซ้ำกับตัวการ์ดนั้นเอง
function pipeSelectedSubtotalHtml(fltObj, statusSummary) {
  var keys = Object.keys(fltObj || {});
  if (keys.length < 2) return '';
  var count = 0, amount = 0, names = [];
  keys.forEach(function(k) {
    var v = statusSummary && statusSummary[k];
    if (!v) return;
    count += v.count || 0; amount += v.amount || 0; names.push(v.name || k);
  });
  return '<div style="margin-top:6px;padding:8px 12px;background:rgba(59,111,214,.08);border:1px solid var(--accent);border-radius:9px;font-size:12.5px;font-weight:700;color:var(--accent)">' +
    '✓ รวม ' + keys.length + ' สถานะที่เลือก (' + sanitize(names.join(' + ')) + '): ' + count + ' รายการ · ฿' + fmtMoney(amount) + '</div>';
}

// ================================================================
// SIS REVENUE (H1/H2/Quarter/รายเดือน) — อยู่ที่นี่ (ไม่ใช่ views-dealer.js) เพราะ client-view.html
// (หน้าลูกค้าดูเอง — ไม่โหลด views-dealer.js) ต้องใช้ตัวเดียวกับหน้า Dealer แก้ยอดขาย SIS ในแอปหลัก
// ================================================================

// อ่านยอดขาย SIS (H1/H2 + Q1-Q4 + รายเดือน) ของปีที่ระบุ — ปีที่ไม่เคยตั้งจะได้ 0 เสมอ (ไม่ทับข้อมูลปีก่อน)
// ปีปัจจุบันที่ยังไม่มี sisRevenueByYear จะ fallback ไปอ่านฟิลด์เดิม (สมัยก่อนมีปีเดียว ไม่มี Quarter) ให้อัตโนมัติ
function getSisRevenueForYear(dealer, year) {
  year = String(year);
  if (dealer && dealer.sisRevenueByYear && dealer.sisRevenueByYear[year]) {
    var r = dealer.sisRevenueByYear[year];
    return { h1: r.h1 || 0, h2: r.h2 || 0, q1: r.q1 || 0, q2: r.q2 || 0, q3: r.q3 || 0, q4: r.q4 || 0,
      monthly: r.monthly || _sisEstimateMonthlyFromQuarters(r), hasMonthly: !!r.monthly, note: r.note, updatedAt: r.updatedAt };
  }
  if (dealer && year === String(new Date().getFullYear())) {
    return { h1: dealer.sisRevenue || 0, h2: dealer.sisRevenueH2 || 0, q1: 0, q2: 0, q3: 0, q4: 0, monthly: {}, hasMonthly: false };
  }
  return { h1: 0, h2: 0, q1: 0, q2: 0, q3: 0, q4: 0, monthly: {}, hasMonthly: false };
}

// ยังไม่เคยกรอกรายเดือน — ประมาณให้จาก Quarter เดิม (หารเฉลี่ย 3 เดือน) กันหน้าจอว่างเปล่าตอน migrate จากของเก่า
function _sisEstimateMonthlyFromQuarters(r) {
  var q = [Number(r.q1) || 0, Number(r.q2) || 0, Number(r.q3) || 0, Number(r.q4) || 0];
  var monthly = {};
  for (var qi = 0; qi < 4; qi++) {
    var per = q[qi] / 3;
    for (var mi = 0; mi < 3; mi++) monthly[qi * 3 + mi + 1] = per;
  }
  return monthly;
}

// เดือนไหน (0-11) อยู่ใน H1/H2 ตามช่วงที่ Admin ตั้งไว้จริง (cfg.h1Period/h2Period) — ไม่ผูกกับ Quarter ปฏิทินอีกต่อไป
// รองรับเฉพาะช่วงที่ไม่ข้ามปี (startMonth<=endMonth) — ยังไม่รองรับ H2 ที่ยาวข้ามไปปีถัดไป (เคสส่วนใหญ่ไม่ต้องใช้)
function sisComputeHalfMonths(cfg) {
  var h1 = (cfg && cfg.h1Period) || { startMonth: 0, endMonth: 5 };
  var h2 = (cfg && cfg.h2Period) || { startMonth: (h1.endMonth + 1) % 12, endMonth: 11 };
  var h1Months = [], h2Months = [];
  for (var m = 0; m <= 11; m++) {
    if (m >= h1.startMonth && m <= h1.endMonth) h1Months.push(m);
    else if (m >= h2.startMonth && m <= h2.endMonth) h2Months.push(m);
  }
  return { h1: h1Months, h2: h2Months, h1Period: h1, h2Period: h2 };
}

// รวมยอดรายเดือน (key '1'-'12') เป็น Q1-Q4 (ปฏิทินคงที่) + H1/H2 (ตามช่วงที่ตั้งไว้จริง)
function sisSummarizeMonthly(monthly, cfg) {
  var v = function(mIdx) { return Number(monthly[mIdx + 1]) || 0; }; // mIdx 0-11 → key 1-12
  var q = [0, 0, 0, 0];
  for (var m = 0; m <= 11; m++) q[Math.floor(m / 3)] += v(m);
  var half = sisComputeHalfMonths(cfg);
  var h1 = half.h1.reduce(function(s, m) { return s + v(m); }, 0);
  var h2 = half.h2.reduce(function(s, m) { return s + v(m); }, 0);
  return { q1: q[0], q2: q[1], q3: q[2], q4: q[3], h1: h1, h2: h2, halfMeta: half };
}

// เทียบยอด H1/H2 ปีนี้ กับปีที่แล้วช่วงเดียวกัน — ใช้ทั้ง client-view (คุยกับลูกค้า) และหน้าแผน KPI ในแอปหลัก
function getSisYoy(dealer, year, half) {
  var curYear = parseInt(year, 10);
  var cur = getSisRevenueForYear(dealer, curYear)[half] || 0;
  var prev = getSisRevenueForYear(dealer, curYear - 1)[half] || 0;
  var pct = prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0);
  return { cur: cur, prev: prev, pct: pct };
}

// อ่านเป้ายอดขาย (targetH1/H2 + Dock H1/H2) ของปีที่ระบุ — pattern เดียวกับ getSisRevenueForYear
// ปีปัจจุบันที่ยังไม่มี targetsByYear จะ fallback ไปอ่านฟิลด์เดิม (targetH1/targetH2/dockTargetH1/dockTargetH2) อัตโนมัติ
// ปีอื่นที่ไม่เคยตั้งจะได้ 0 เสมอ (ไม่เอาเป้าปีนี้ไปใช้กับปีก่อน/หลังผิดๆ)
function getTargetForYear(dealer, year) {
  year = String(year);
  if (dealer && dealer.targetsByYear && dealer.targetsByYear[year]) {
    var t = dealer.targetsByYear[year];
    return { h1: Number(t.h1) || 0, h2: Number(t.h2) || 0, dockH1: Number(t.dockH1) || 0, dockH2: Number(t.dockH2) || 0 };
  }
  if (dealer && year === String(new Date().getFullYear())) {
    return { h1: Number(dealer.targetH1) || 0, h2: Number(dealer.targetH2) || 0, dockH1: Number(dealer.dockTargetH1) || 0, dockH2: Number(dealer.dockTargetH2) || 0 };
  }
  return { h1: 0, h2: 0, dockH1: 0, dockH2: 0 };
}

// บันทึกเป้าปีที่ระบุ (เก็บลง targetsByYear[year] + mirror ไปฟิลด์เดิมถ้าเป็นปีปัจจุบัน เพื่อ backward-compat)
// คืนค่า updateData object ไว้ให้ผู้เรียก ST.update เอง (ไม่ update ตรงนี้ กันผูกกับ ST มากไป)
function buildTargetSaveData(dealer, year, vals) {
  year = String(year);
  var byYear = (dealer && dealer.targetsByYear) || {};
  byYear = Object.assign({}, byYear);
  byYear[year] = { h1: vals.h1 || 0, h2: vals.h2 || 0, dockH1: vals.dockH1 || 0, dockH2: vals.dockH2 || 0, updatedAt: Date.now() };
  var updateData = { targetsByYear: byYear };
  if (year === String(new Date().getFullYear())) {
    updateData.targetH1 = vals.h1 || 0;
    updateData.targetH2 = vals.h2 || 0;
    updateData.dockTargetH1 = vals.dockH1 || 0;
    updateData.dockTargetH2 = vals.dockH2 || 0;
    updateData.targetRevenue = (vals.h1 || 0) + (vals.h2 || 0);
  }
  return updateData;
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

// วงแหวน progress แบบ SVG — ใช้แทน progress bar ธรรมดาในจุดที่อยากให้ดูเป็นเกมมากขึ้น (ดู .progress-ring
// ใน style.css) color ใช้ hex ตรงๆ ได้เลย เพราะเป็นเส้นกราฟิกวาดทับพื้นการ์ด ไม่ใช่ text-on-fill ที่ต้อง
// คำนึง contrast ต่างกันตาม theme เหมือน .stat-* — สีเดียวใช้ได้ทั้ง Light/Dark
function progressRingHtml(pct, opts) {
  opts = opts || {};
  var size = opts.size || 40, strokeW = opts.strokeW || 4, color = opts.color || '#3b82f6', label = opts.label;
  pct = Math.max(0, Math.min(100, Number(pct) || 0));
  var r = (size - strokeW) / 2, c = 2 * Math.PI * r, offset = c * (1 - pct / 100), cx = size / 2;
  return '<div class="progress-ring" style="width:' + size + 'px;height:' + size + 'px">' +
    '<svg width="' + size + '" height="' + size + '">' +
    '<circle class="ring-bg" cx="' + cx + '" cy="' + cx + '" r="' + r + '" stroke-width="' + strokeW + '"></circle>' +
    '<circle class="ring-fg" cx="' + cx + '" cy="' + cx + '" r="' + r + '" stroke-width="' + strokeW + '" stroke="' + color + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + offset.toFixed(2) + '"></circle>' +
    '</svg>' +
    '<div class="ring-label" style="font-size:' + Math.round(size * 0.26) + 'px;color:' + color + '">' + (label != null ? label : pct + '%') + '</div>' +
    '</div>';
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
    win:'✅ Win', fail_lost:'❌ Lost'
  }[t] || t;
}

// ================================================================
// TOAST
// ================================================================
var _toastQueue = [];
var _toastBusy = false;
function toast(msg, isError) {
  _toastQueue.push({ msg: msg, isError: isError });
  _toastShowNext();
}
function _toastShowNext() {
  if (_toastBusy || !_toastQueue.length) return;
  _toastBusy = true;
  var item = _toastQueue.shift();
  const t = document.getElementById('toast');
  t.textContent = item.msg;
  t.className = 'toast show' + (item.isError ? ' error' : '');
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { _toastBusy = false; _toastShowNext(); }, 250);
  }, 2500);
}

// toast ปกติเป็น textContent ล้วนใส่ปุ่มไม่ได้ — ใช้กล่องแยก #undoToast (ดู index.html) สำหรับ action ที่
// เผลอกดพลาดแล้วอยากย้อนกลับได้ (เช่น ติ๊กถูกว่างานเสร็จ) undoFn ถูกเรียกครั้งเดียวตอนกด Undo เท่านั้น
var _undoToastFn = null;
var _undoToastTimer = null;
function showUndoToast(msg, undoFn) {
  var box = document.getElementById('undoToast');
  if (!box) { toast(msg); return; }
  document.getElementById('undoToastMsg').textContent = msg;
  _undoToastFn = undoFn;
  box.style.display = 'flex';
  clearTimeout(_undoToastTimer);
  _undoToastTimer = setTimeout(function() { box.style.display = 'none'; _undoToastFn = null; }, 5000);
}
function _undoToastAction() {
  var box = document.getElementById('undoToast');
  if (box) box.style.display = 'none';
  clearTimeout(_undoToastTimer);
  var fn = _undoToastFn;
  _undoToastFn = null;
  if (fn) fn();
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
    // รูปภาพ — เปิด lightbox แทน tab ใหม่ (ไฟล์อื่นๆ เช่น PDF ยังใช้ onClick เดิม = window.open)
    var lbUrl = String(a.url || '').replace(/'/g, "\\'");
    var lbName = String(a.name || 'image.jpg').replace(/'/g, "\\'");
    var lbClick = "showImageLightbox('" + lbUrl + "','" + lbName + "')";
    return '<img src="' + a.url + '" style="width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:pointer;display:block" onclick="' + lbClick + '">';
  }
  var label = a.name || a.url || '';
  if (label.length > 14) label = label.substr(0, 12) + '…';
  return '<div style="width:64px;height:64px;border-radius:6px;background:var(--bg2);border:1px solid var(--border);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:2px;box-sizing:border-box" onclick="' + onClick + '" title="' + sanitize(a.name || a.url || '') + '">' +
    '<span style="font-size:20px">' + icon + '</span><span style="font-size:8px;color:var(--text2);text-align:center;word-break:break-word;line-height:1.1">' + sanitize(label) + '</span></div>';
}

function attachUploadHtml(stateVarName, folder, label) {
  window[stateVarName] = window[stateVarName] || [];
  // จำ widget แนบไฟล์ล่าสุดที่ถูก render ไว้ — ให้ global paste listener (ดู _bindGlobalAttachPaste ท้ายไฟล์นี้)
  // รู้ว่า Ctrl+V ตอนนี้ควรอัปโหลดเข้า stateVarName/folder ไหน โดยไม่ต้องผูก onpaste ทีละจุด
  window._activeAttachTarget = { stateVarName: stateVarName, folder: folder };
  var linkInputId = stateVarName + '_linkInput';
  return '<div class="fg"><label>' + (label || '📎 ไฟล์แนบ') + '</label>' +
    '<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onchange="_handleAttachUpload(event,\'' + stateVarName + '\',\'' + folder + '\')" style="font-size:.76rem">' +
    '<div class="hint" style="margin:2px 0 0">รูป/PDF/Word/Excel ไม่เกิน 10MB — รูปจะถูกบีบอัดให้เล็กลงอัตโนมัติ · หรือ Ctrl+V วางรูปที่คัดลอกไว้ได้เลย</div>' +
    '<div style="display:flex;gap:4px;margin-top:6px">' +
    '<input type="text" id="' + linkInputId + '" placeholder="🔗 วางลิงก์ (เว็บ หรือ path ไฟล์ในเครื่อง)" style="flex:1;font-size:.76rem" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_addAttachLink(\'' + stateVarName + '\')}">' +
    '<button type="button" class="btn bo bsm" onclick="_addAttachLink(\'' + stateVarName + '\')">เพิ่มลิงก์</button>' +
    '</div>' +
    '<div id="' + stateVarName + '_thumbs">' + attachThumbsHtml(window[stateVarName], stateVarName) + '</div></div>';
}

// ================================================================
// IMAGE LIGHTBOX — ดูรูปแนบเต็มจอ แยกจาก #modal เดิม (ดู #imgLightbox ใน index.html) กันปัญหา
// modal เดียวใช้ซ้ำทั้งแอพ เปิด lightbox ทับแล้วไปล้างฟอร์มที่กรอกค้างอยู่ในโมดัลอื่น
// ================================================================
function showImageLightbox(url, name) {
  var box = document.getElementById('imgLightbox');
  if (!box) return;
  document.getElementById('imgLightboxImg').src = url;
  document.getElementById('imgLightboxOpen').href = url;
  var dl = document.getElementById('imgLightboxDownload');
  dl.href = url;
  dl.download = name || 'image.jpg';
  dl.onclick = function(e) {
    // รูปอยู่คนละ origin (Firebase Storage) — attribute download เฉยๆ เบราว์เซอร์จะไม่ยอมโหลดให้ (แค่เปิดแท็บใหม่)
    // ต้อง fetch เป็น blob ก่อนแล้วโหลดจาก blob: URL (same-origin) ถึงจะบังคับดาวน์โหลดได้จริง
    e.preventDefault();
    toast('⏳ กำลังเตรียมไฟล์...');
    fetch(url).then(function(r) { return r.blob(); }).then(function(blob) {
      var blobUrl = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = blobUrl; a.download = name || 'image.jpg';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 4000);
    }).catch(function() {
      toast('❌ ดาวน์โหลดไม่ได้ กำลังเปิดแท็บใหม่แทน', true);
      window.open(url, '_blank');
    });
  };
  box.classList.add('show');
}

function closeImageLightbox() {
  var box = document.getElementById('imgLightbox');
  if (box) box.classList.remove('show');
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
</div>
<div class="dp-ft" style="justify-content:flex-start;margin-top:5px">
  <button type="button" onclick="dpSet('${id}',_td())">วันนี้</button>
  <button type="button" onclick="dpSet('${id}',addD(_td(),1))">พรุ่งนี้</button>
</div>
</div>`;
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

// Ctrl+V วางรูปได้ทุกจุดที่ใช้ attachUploadHtml() — โดยไม่ต้องผูก onpaste ทีละ widget เอง
// attachUploadHtml() จะเซ็ต window._activeAttachTarget ไว้ทุกครั้งที่ widget นั้น render ล่าสุด
// เช็ค e.defaultPrevented กัน double-upload กับจุดที่ผูก handlePasteOrDropImage ไว้เองแล้ว (เช่น textarea รายละเอียดงาน)
document.addEventListener('paste', function(e) {
  if (e.defaultPrevented) return;
  var target = window._activeAttachTarget;
  if (!target) return;
  if (!document.getElementById(target.stateVarName + '_thumbs')) return; // widget ไม่อยู่บนจอแล้ว (ปิด modal/เปลี่ยนหน้าไปแล้ว)
  var items = (e.clipboardData && e.clipboardData.items) || [];
  var file = null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type && items[i].type.indexOf('image') === 0) { file = items[i].getAsFile(); break; }
  }
  if (!file) return;
  e.preventDefault();
  toast('⏳ กำลังอัปโหลดรูป...');
  uploadAttachment(file, target.folder, function(att) {
    if (!att) return;
    window[target.stateVarName] = window[target.stateVarName] || [];
    window[target.stateVarName].push(att);
    var wrap = document.getElementById(target.stateVarName + '_thumbs');
    if (wrap) wrap.innerHTML = attachThumbsHtml(window[target.stateVarName], target.stateVarName);
    toast('📷 แนบรูปแล้ว');
  });
});

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
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('dealers', newDealer);
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
  var or = document.getElementById('fv_other_row');
  if (dr) dr.style.display = val === 'dealer' ? '' : 'none';
  if (lr) lr.style.display = val === 'lead' ? '' : 'none';
  if (or) or.style.display = val === 'other' ? '' : 'none';
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

// ================================================================
// วันที่ปิดดีล — 5 ชั้นตามความน่าเชื่อถือ ใช้ร่วมกันทั้ง Sales Analytics และ KPI แทนที่แต่ละหน้าคำนวณเองคนละ
// แบบ (เดิม Sales Analytics ใช้วันที่จาก log เปลี่ยนสถานะจริง ส่วน KPI ใช้ registerDate เฉยๆ ทำให้ยอด "ปิดแล้ว"
// ของสองหน้าไม่ตรงกัน) ลำดับ:
//   1) log ยืนยัน      — log type='status_change' ที่ระบบสร้างเองตอนกดเปลี่ยนสถานะในแอป (รูปแบบ "เดิม → ใหม่")
//   2) เดาจาก log       — ไม่มี log ยืนยัน (พบมากกับดีลที่ import จาก Sheet — import สร้าง log เป็น type='note'
//                          เสมอ ไม่เคยเป็น status_change) แต่มี log อื่นที่เนื้อหาเอ่ยชื่อสถานะกลุ่ม won ไว้ตรงๆ
//   3) Forecast Month   — เดือนที่เซลกรอกเองว่าคาดว่าจะสั่งซื้อ/ปิด
//   4) Shipment Date    — วันที่คาดว่าจะส่งมอบ
//   5) Register Date    — วันที่ลงทะเบียนโครงการ มีอยู่แล้วแทบทุกโครงการ กันไว้ท้ายสุดไม่ให้ไม่มีข้อมูลเลย
// เลือก override เองต่อโครงการได้ผ่าน p.closeDateSource ('' หรือไม่ตั้ง = auto ตามลำดับข้างบน) 2026-08-29
// ================================================================
var PIPE_CLOSE_DATE_TIER_META = {
  log:      { label: '📌 Log ยืนยัน' },
  guess:    { label: '🔍 เดาจาก Log' },
  fc:       { label: '🔮 Forecast Month' },
  ship:     { label: '🚚 Shipment Date' },
  register: { label: '🗓️ Register Date' }
};

// getConfig() ทำ JSON.parse(JSON.stringify(DEF_CONFIG)) ใหม่ทุกครั้งที่เรียก (deep clone ทั้งก้อน config) —
// ฟังก์ชันนี้ถูกเรียกต่อโครงการในลูปคำนวณวันที่ปิดดีล เรียก getConfig() ซ้ำหลักร้อยครั้งต่อการ render หนึ่งครั้ง
// กลายเป็นต้นทุนหลักของความช้า (มากกว่าการ scan pipeLog เสียอีก) — cache ไว้ ล้างเมื่อ saveConfig() ถูกเรียกเท่านั้น
var _pipeWonStatusNamesCache = null;
function _pipeWonStatusNames() {
  if (_pipeWonStatusNamesCache) return _pipeWonStatusNamesCache;
  var names = {};
  (getConfig().pipelineStatuses || []).filter(function(s) { return s.category === 'won'; }).forEach(function(s) { names[s.name] = true; });
  _pipeWonStatusNamesCache = names;
  return names;
}
function _pipeInvalidateWonStatusCache() { _pipeWonStatusNamesCache = null; }

// index ของ pipeLog แยกตาม pipeId — ST.getAll() ทำ JSON.parse(localStorage) ใหม่ทุกครั้งที่เรียก ไม่มี cache
// ชั้น storage (ตั้งใจ — ดูคอมเมนต์ที่ ST._get ใน storage.js: เคยลองแคชแบบ deep-clone แล้วช้าลงกว่าเดิมสำหรับ
// หน้าที่เรียกไม่ถี่ วิธีที่ถูกต้องคือ "ทำ index ล่วงหน้าแทนเรียกในลูป" ที่จุดเรียกเอง) ฟังก์ชันข้างล่างนี้เดิม
// เรียก ST.getAll('pipeLog') ต่อ "หนึ่งโครงการ" ทำให้หน้า KPI/Sales Analytics ที่วนทุกโครงการกลายเป็น
// parse ข้อมูลทั้งก้อนซ้ำหลักร้อยครั้งต่อการ render เดียว — ต้อง build index ครั้งเดียวที่จุดเรียก (ในลูป)
// แล้วส่ง logIdx เข้ามาแทน ไม่ใช่แคชไว้ในนี้ (ยังต้องเช็ค .length ทุกครั้งอยู่ดี ซึ่ง parse ทั้งก้อนไปแล้ว)
function _pipeWonLogIndex() {
  var idx = {};
  ST.getAll('pipeLog').forEach(function(l) { if (l.pipeId) (idx[l.pipeId] || (idx[l.pipeId] = [])).push(l); });
  return idx;
}

// log ยืนยัน — เฉพาะ log ที่ระบบสร้างเองตอนกดเปลี่ยนสถานะในแอป (changePipeStatus/savePipeUpdate) เนื้อหาจะเป็น
// รูปแบบ "เดิม → ใหม่" เสมอ เอา log แรกสุดที่เปลี่ยนเข้ากลุ่ม won (ปิดดีลครั้งแรก ไม่ใช่ครั้งหลังสุด) — คืน log
// entry เต็ม (ไม่ใช่แค่วันที่) ไว้ให้ UI โชว์เนื้อหาจริงที่ใช้ตัดสินใจได้ ไม่ต้องเชื่อเฉยๆ ว่าวันที่มาจากไหน
// logIdx: ผลลัพธ์ของ _pipeWonLogIndex() ที่ build ไว้ล่วงหน้าแล้ว (ถ้าเรียกในลูป) — ไม่ส่งมาก็ยังทำงานถูกต้อง
// แค่ช้ากว่า (เรียก ST.getAll('pipeLog') ใหม่เอง) เผื่อเรียกครั้งเดียวนอกลูปที่ยังไม่คุ้มทำ index
function _pipeConfirmedWonLog(p, logIdx) {
  var wonNames = _pipeWonStatusNames();
  var myLogs = logIdx ? (logIdx[p.id] || []) : ST.getAll('pipeLog').filter(function(l) { return l.pipeId === p.id; });
  var logs = myLogs.filter(function(l) {
    if (l.type !== 'status_change' || !l.content) return false;
    var parts = l.content.split('→');
    return parts.length > 1 && wonNames[parts[1].trim()];
  }).sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
  return logs.length ? logs[0] : null;
}
function _pipeConfirmedWonLogDate(p, logIdx) {
  var l = _pipeConfirmedWonLog(p, logIdx);
  return l ? (l.date || '').split('T')[0] : '';
}

// เดาจาก log ข้อความ — log อะไรก็ได้ (ปกติ type='note' จาก import) ที่เนื้อหามีชื่อสถานะกลุ่ม won ปรากฏอยู่ตรงๆ
// ไม่ต้องเป๊ะฟอร์แมต "เดิม → ใหม่" เหมือนชั้นบน — เดาได้ไม่แม่นเท่า เรียกเฉพาะตอนไม่มี log ยืนยันเท่านั้น
function _pipeGuessedWonLog(p, logIdx) {
  var wonNames = Object.keys(_pipeWonStatusNames());
  if (!wonNames.length) return null;
  var myLogs = logIdx ? (logIdx[p.id] || []) : ST.getAll('pipeLog').filter(function(l) { return l.pipeId === p.id; });
  var logs = myLogs.filter(function(l) {
    if (!l.content) return false;
    return wonNames.some(function(n) { return l.content.indexOf(n) !== -1; });
  }).sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
  return logs.length ? logs[0] : null;
}
function _pipeGuessedWonLogDate(p, logIdx) {
  var l = _pipeGuessedWonLog(p, logIdx);
  return l ? (l.date || '').split('T')[0] : '';
}

// รายการแหล่งวันที่ที่ "มีข้อมูลจริง" สำหรับโครงการนี้ เรียงตามลำดับความน่าเชื่อถือ — register อยู่ท้ายสุดเสมอ
// เพราะมีข้อมูลอยู่แล้วแทบทุกโครงการ ระบบเลยไม่มีวันไม่มีแหล่งให้เลือกเลยสักอัน
// logIdx: ดู _pipeConfirmedWonLog — เรียกในลูปกับหลายโครงการ ควร build ครั้งเดียวด้วย _pipeWonLogIndex() แล้วส่งมา
function pipeCloseDateSources(p, logIdx) {
  var out = [];
  var logDate = _pipeConfirmedWonLogDate(p, logIdx);
  if (logDate) out.push({ key: 'log', date: logDate });
  var guessDate = logDate ? '' : _pipeGuessedWonLogDate(p, logIdx); // ไม่มี log ยืนยันเท่านั้นถึงจะลองเดา
  if (guessDate) out.push({ key: 'guess', date: guessDate });
  var fcInfo = (p.forecastMonth && typeof _kpiParseForecastMonthText === 'function') ? _kpiParseForecastMonthText(p.forecastMonth) : null;
  if (fcInfo) out.push({ key: 'fc', date: fcInfo.year + '-' + String(fcInfo.month).padStart(2, '0') + '-15' }); // มีแค่เดือน/ปี ใช้กลางเดือนแทนวัน
  if (p.shipmentDate) out.push({ key: 'ship', date: p.shipmentDate });
  out.push({ key: 'register', date: p.registerDate || (p.created ? p.created.split('T')[0] : '') });
  return out;
}

// วันที่ปิดดีลที่ "ใช้จริง" ของโครงการนี้ {key, date} — เคารพ p.closeDateSource ถ้าตั้งไว้และยังมีข้อมูลอยู่จริง
// ไม่งั้น auto (ตัวแรกในลำดับที่มีข้อมูลจริง) — logIdx: ดู pipeCloseDateSources
function pipeResolvedCloseDate(p, logIdx) {
  var sources = pipeCloseDateSources(p, logIdx);
  if (p.closeDateSource) {
    var match = sources.filter(function(s) { return s.key === p.closeDateSource; })[0];
    if (match) return match;
  }
  return sources[0];
}