// ================================================================
// KPI QUARTER SCORECARD — เป้า/weight ต่อไตรมาส ต่อเซลล์
// คำนวณ "ทำได้แล้ว" สดจาก Pipeline/Dealer/Visit ที่มีอยู่แล้ว
// ================================================================

// แคช ST.getAll('pipeline'/'dealers') แค่ "ต่อ 1 รอบ render" — หน้านี้เรียกฟังก์ชันคำนวณ KPI ซ้อนกันเยอะมาก
// (ทุก category × เป้ารายเดือน 3 เดือน × การ์ด top-deals/dealer-plan/product ฯลฯ) แต่ละครั้งเดิม vanilla
// ST.getAll() re-parse JSON จาก localStorage ใหม่ทุกครั้ง พอ Pipeline เป็นพันแถวจริงจะช้ามาก (สาเหตุที่หน้า
// KPI โหลดนาน) — ล้างแคชทุกครั้งที่ rKpiScorecard() เริ่ม render ใหม่ ข้อมูลจึงยังสดเหมือนเดิมทุกครั้งที่เข้าหน้า
// แค่ไม่ re-fetch ซ้ำๆ ภายในรอบ render เดียวกัน
var _kpiCache = null;
function _kpiInvalidateCache() { _kpiCache = null; }
function _kpiPipelines() {
  if (!_kpiCache) _kpiCache = {};
  if (!_kpiCache.pipelines) _kpiCache.pipelines = ST.getAll('pipeline');
  return _kpiCache.pipelines;
}
function _kpiDealers() {
  if (!_kpiCache) _kpiCache = {};
  if (!_kpiCache.dealers) _kpiCache.dealers = ST.getAll('dealers');
  return _kpiCache.dealers;
}
// เพิ่ม 2026-09-01 (เจอจากสแกนหาจุดช้าตอนแก้ไข KPI) — getKpiRunRateLogs()/_pipeWonLogIndex() เดิมไม่ได้อยู่ใน
// แคชนี้เลย แม้จะมี _kpiCache อยู่แล้ว ทำให้ _kpiRunRateAutoCovered() (เรียกต่อ log ต่อ category) ยังยิง
// ST.getOne('pipeline', ...) + ST.getAll('pipeLog') ใหม่ทุกครั้งอยู่ดี
function _kpiRunRateLogsCached() {
  if (!_kpiCache) _kpiCache = {};
  if (!_kpiCache.runRateLogs) _kpiCache.runRateLogs = getKpiRunRateLogs();
  return _kpiCache.runRateLogs;
}
function _kpiPipelineById() {
  if (!_kpiCache) _kpiCache = {};
  if (!_kpiCache.pipelineById) {
    var idx = {};
    _kpiPipelines().forEach(function(p) { idx[p.id] = p; });
    _kpiCache.pipelineById = idx;
  }
  return _kpiCache.pipelineById;
}
function _kpiWonLogIndex() {
  if (!_kpiCache) _kpiCache = {};
  if (!_kpiCache.wonLogIdx) _kpiCache.wonLogIdx = (typeof _pipeWonLogIndex === 'function') ? _pipeWonLogIndex() : {};
  return _kpiCache.wonLogIdx;
}

function getKpiQuarterPlans() {
  var saved = localStorage.getItem('v7_kpiQuarterPlans');
  if (saved) {
    try { var p = JSON.parse(saved); return Array.isArray(p) ? p : []; }
    catch (e) { return []; }
  }
  return [];
}
function saveKpiQuarterPlans(list) {
  localStorage.setItem('v7_kpiQuarterPlans', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('kpiQuarterPlans', list);
}
function getKpiQuarterLogs() {
  var saved = localStorage.getItem('v7_kpiQuarterLogs');
  if (saved) {
    try { var p = JSON.parse(saved); return Array.isArray(p) ? p : []; }
    catch (e) { return []; }
  }
  return [];
}
function saveKpiQuarterLogs(list) {
  localStorage.setItem('v7_kpiQuarterLogs', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('kpiQuarterLogs', list);
}

var KPI_DEFAULT_CATEGORIES = [
  { id: 'revenue', label: 'ยอดขาย DJI Product', icon: '💰', type: 'pipelineRevenue', target: 11000000, weight: 40, unit: 'บาท' },
  { id: 'dock3', label: 'จำนวนการขาย Dock 3/4', icon: '🚁', type: 'pipelineModelQty', modelMatch: ['Dock 3', 'Dock 4'], target: 1, weight: 20, unit: 'หน่วย' },
  { id: 'newDealer', label: 'Dealer ใหม่ที่พัฒนาเป็น Authorized', icon: '🤝', type: 'dealerAuthorized', target: 1, weight: 20, unit: 'ราย' },
  { id: 'visit', label: 'จำนวน Visit ทั้งหมด', icon: '📍', type: 'visitCount', target: 40, weight: 10, unit: 'ครั้ง' },
  { id: 'djiScore', label: 'คะแนนประเมินจาก DJI', icon: '⭐', type: 'manualScore', target: 100, weight: 10, unit: 'คะแนน', manualValue: null }
];

function kpiGetCurrentQuarter() {
  var now = new Date();
  var q = Math.floor(now.getMonth() / 3) + 1;
  return { quarter: 'Q' + q + '-' + now.getFullYear(), q: q, year: now.getFullYear() };
}
// ห้ามใช้ d.toISOString() ตรงนี้ — แปลงเป็น UTC ก่อนเสมอ ทำให้วันที่ถอยหลัง 1 วันในโซนเวลา UTC+7 (เที่ยงคืนไทยกลายเป็นเย็นวันก่อนหน้าที่ UTC)
function kpiQuarterRange(q, year) {
  var startMonth = (q - 1) * 3;
  var start = new Date(year, startMonth, 1);
  var end = new Date(year, startMonth + 3, 0);
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  return { startDate: iso(start), endDate: iso(end) };
}

var kpiSelectedSalesId = null;
var kpiSelectedPlanId = null;

// ค้นหา/กรอง/จัดเรียง ตารางดีลที่ควรปิดในการ์ด "🌱 ปิด N ดีลนี้..." — state ระดับหน้า เหมือน sfStale* ใน features.js
var _kpiTdSearch = '';
var _kpiTdStatus = '';
var _kpiTdForecast = '';
var _kpiTdSort = 'amt_desc';
function _kpiTdSearchInput(v) { _kpiTdSearch = v; render(); }
function _kpiTdStatusChange(v) { _kpiTdStatus = v; render(); }
function _kpiTdForecastChange(v) { _kpiTdForecast = v; render(); }
function _kpiTdSortChange(v) { _kpiTdSort = v; render(); }

// เดือนที่คาดว่าจะปิดดีล — ใช้ Shipment Date จริงที่เซลกรอกไว้ (ยืนยัน 2026-08-26 ว่าเป็นฟิลด์ที่ควรใช้
// คำนวณ Forecast ของ KPI แทนการเดาจาก Bidding Date +2 เดือนแบบเดิม) แล้วเทียบว่าอยู่ในช่วงไตรมาสนี้ไหม
function _kpiForecastMonthInfo(p, plan) {
  if (!p.shipmentDate) return null;
  var d = new Date(p.shipmentDate);
  if (isNaN(d.getTime())) return null;
  var year = d.getFullYear(), month = d.getMonth() + 1;
  var midMonth = new Date(year, month - 1, 15);
  var inQuarter = !!(plan && midMonth >= new Date(plan.startDate + 'T00:00:00') && midMonth <= new Date(plan.endDate + 'T23:59:59'));
  return { label: KPI_MONTH_NAMES[month - 1] + ' ' + year, sortKey: year + '-' + String(month).padStart(2, '0'), inQuarter: inQuarter };
}

// ================================================================
// การ์ด "📅 โครงการรายเดือน" — ดูโครงการตามเดือน สลับได้ 3 มุมมอง (Bidding/Forecast Month/Shipment Date)
// (2026-08-26 ตามคำขอ)
// ================================================================
// แท็บล่างของหน้า KPI เซลล์ (ดีลที่ควรปิด/รายเดือน/Dealer/Product) — สลับด้วย CSS display ล้วนๆ ไม่ re-render
// หน้าใหม่ทั้งหน้า (เร็วกว่า + ไม่หลุด focus ช่องค้นหา) กันปัญหาเดิมที่การ์ดทั้ง 4 อันต่อกันยาวต้องเลื่อนจอ
// มากตอนเปิดหน้า (2026-08-27 ตามคำขอ)
var _kpiActiveTab = 'deals';
function _kpiTabClick(tab) {
  _kpiActiveTab = tab;
  document.querySelectorAll('.kpi-tabpane').forEach(function(el) {
    el.style.display = el.getAttribute('data-kpitab') === tab ? '' : 'none';
  });
  document.querySelectorAll('.kpi-tabbtn').forEach(function(b) {
    var on = b.getAttribute('data-kpitab') === tab;
    b.classList.toggle('bp', on);
    b.classList.toggle('bo', !on);
  });
}

var _kpiMoTab = 'bid';
var _kpiMoMonth = null, _kpiMoYear = null;
// ซ่อนดีลที่ปิดแล้ว (Win/Lost) ออกจากรายเดือน — ปิดไว้เป็นค่าเริ่มต้นเหมือนเดิม (แสดงทุกสถานะ) ผู้ใช้เปิดเองได้
// ถ้าอยากโฟกัสเฉพาะดีลที่ยังไม่ปิดในเดือนนั้น (2026-08-26)
var _kpiMoHideClosed = false;
function _kpiMoInit() {
  if (_kpiMoMonth === null) { var n = new Date(); _kpiMoMonth = n.getMonth(); _kpiMoYear = n.getFullYear(); }
}
function _kpiMoSetTab(t) { _kpiMoTab = t; render(); }
function _kpiMoToggleHideClosed(checked) { _kpiMoHideClosed = checked; render(); }
function _kpiMoShift(delta) {
  _kpiMoInit();
  _kpiMoMonth += delta;
  if (_kpiMoMonth < 0) { _kpiMoMonth = 11; _kpiMoYear--; }
  else if (_kpiMoMonth > 11) { _kpiMoMonth = 0; _kpiMoYear++; }
  render();
}

// Forecast Month เป็นข้อความอิสระจากชีท (เช่น "2026 Aug", "Aug-26", "2026-08") — เดาแบบยืดหยุ่นด้วยการหา
// ปี (20xx) กับชื่อเดือนภาษาอังกฤษย่อ/เต็มในข้อความ ไม่ต้อง strict format เดียว
function _kpiParseForecastMonthText(text) {
  if (!text) return null;
  var t = text.trim();
  var iso = t.match(/(\d{4})-(\d{1,2})(?:-|$)/);
  if (iso) return { year: +iso[1], month: +iso[2] };
  var monNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var tl = t.toLowerCase();
  var monIdx = -1;
  for (var i = 0; i < 12; i++) { if (tl.indexOf(monNames[i]) !== -1) { monIdx = i; break; } }
  if (monIdx === -1) return null;
  var yrMatch = tl.match(/(20\d{2})/);
  var year = yrMatch ? +yrMatch[1] : new Date().getFullYear();
  return { year: year, month: monIdx + 1 };
}

function kpiProjectsByMonth(plan, tab, month, year, hideClosed) {
  var cfg = getConfig();
  var pipes = _kpiPipelines().filter(function(p) { return (p.saleName || '') === plan.salesMemberName; });
  return pipes.filter(function(p) {
    if (hideClosed) {
      var st = (cfg.pipelineStatuses || []).filter(function(s) { return s.id === p.status; })[0];
      if (st && st.category !== 'active') return false;
    }
    if (tab === 'bid') {
      if (!p.biddingDate) return false;
      var d = new Date(p.biddingDate);
      return !isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
    }
    if (tab === 'ship') {
      if (!p.shipmentDate) return false;
      var d2 = new Date(p.shipmentDate);
      return !isNaN(d2.getTime()) && d2.getMonth() === month && d2.getFullYear() === year;
    }
    if (tab === 'fc') {
      var info = _kpiParseForecastMonthText(p.forecastMonth);
      return !!info && info.month === (month + 1) && info.year === year;
    }
    return false;
  }).sort(function(a, b) { return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); });
}

// จำนวนโครงการที่มี Forecast Month เป็นข้อความ แต่ parse ไม่ออก (เช่นพิมพ์ผิด/ฟอร์แมตแปลก) — เตือนไว้ในการ์ด
// รายเดือนตอนดูแท็บ Forecast Month กันโครงการหายไปเงียบๆ โดยไม่รู้ตัวว่าเป็นเพราะ parse ไม่ผ่าน (2026-08-26)
function kpiUnparsedForecastMonthProjects(plan) {
  var pipes = _kpiPipelines().filter(function(p) { return (p.saleName || '') === plan.salesMemberName; });
  return pipes.filter(function(p) { return !!(p.forecastMonth && p.forecastMonth.trim()) && !_kpiParseForecastMonthText(p.forecastMonth); });
}

function kpiGetPlansForSales(salesMemberId) {
  return getKpiQuarterPlans().filter(function(p) { return p.salesMemberId === salesMemberId; })
    .sort(function(a, b) { return (a.startDate || '').localeCompare(b.startDate || ''); });
}

function kpiCreateQuarterPlan(salesMemberId, salesMemberName, q, year) {
  var cur = kpiGetCurrentQuarter();
  q = q || cur.q;
  year = year || cur.year;
  var quarter = 'Q' + q + '-' + year;

  var existing = getKpiQuarterPlans().filter(function(p) { return p.salesMemberId === salesMemberId && p.quarter === quarter; })[0];
  if (existing) { toast('⚠️ มีแผน ' + quarter + ' ของเซลล์นี้อยู่แล้ว — ใช้อันเดิม'); return existing; }

  var range = kpiQuarterRange(q, year);
  var prevPlans = kpiGetPlansForSales(salesMemberId);
  var template = prevPlans.length ? prevPlans[prevPlans.length - 1].categories : KPI_DEFAULT_CATEGORIES;
  var plan = {
    id: 'kpiq_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    quarter: quarter, startDate: range.startDate, endDate: range.endDate,
    salesMemberId: salesMemberId, salesMemberName: salesMemberName,
    categories: JSON.parse(JSON.stringify(template)),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  var plans = getKpiQuarterPlans();
  plans.push(plan);
  saveKpiQuarterPlans(plans);
  return plan;
}

function kpiDeleteQuarterPlan(planId) {
  var plans = getKpiQuarterPlans();
  var plan = plans.filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  if (!confirm('⚠️ ลบแผน KPI ' + plan.quarter + ' ของ ' + plan.salesMemberName + '?\n(คะแนน manual และบันทึกที่เกี่ยวข้องจะถูกลบด้วย — ตัวเลขที่คำนวณสดจาก Pipeline/Dealer/Visit จะไม่หาย)')) return;
  var logsToDelete = getKpiQuarterLogs().filter(function(l) { return l.planId === planId; });
  saveKpiQuarterPlans(plans.filter(function(p) { return p.id !== planId; }));
  saveKpiQuarterLogs(getKpiQuarterLogs().filter(function(l) { return l.planId !== planId; }));
  // ลบออกจาก Firestore จริงๆ ด้วย ไม่งั้น listener ดึงกลับมาทุก refresh
  if (typeof syncDeleteFromFirebase === 'function') {
    syncDeleteFromFirebase('kpiQuarterPlans', planId);
    logsToDelete.forEach(function(l) { syncDeleteFromFirebase('kpiQuarterLogs', l.id); });
  }
  if (kpiSelectedPlanId === planId) kpiSelectedPlanId = null;
  toast('🗑️ ลบแผน ' + plan.quarter + ' แล้ว');
  closeMForce();
  render();
}

// ================================================================
// เลือกไตรมาสที่จะสร้าง (ปัจจุบัน/ไตรมาสหน้า/เลือกเอง) — กันสร้างซ้ำโดยไม่ตั้งใจ
// ================================================================
function showKpiNewQuarterM(salesMemberId, salesMemberName) {
  var cur = kpiGetCurrentQuarter();
  var nextQ = cur.q === 4 ? 1 : cur.q + 1;
  var nextYear = cur.q === 4 ? cur.year + 1 : cur.year;

  var h = '<div class="fg"><label>ไตรมาส</label><select id="kpi_new_q" class="fm-input">';
  for (var qq = 1; qq <= 4; qq++) h += '<option value="' + qq + '">Q' + qq + '</option>';
  h += '</select></div>';
  h += '<div class="fg"><label>ปี (ค.ศ.)</label><input type="number" id="kpi_new_year" class="fm-input" value="' + cur.year + '"></div>';
  h += '<div style="display:flex;gap:6px;margin-bottom:10px">';
  h += '<button class="btn bsm bo" style="flex:1" onclick="document.getElementById(\'kpi_new_q\').value=' + cur.q + ';document.getElementById(\'kpi_new_year\').value=' + cur.year + '">📅 ไตรมาสนี้ (Q' + cur.q + '-' + cur.year + ')</button>';
  h += '<button class="btn bsm bo" style="flex:1" onclick="document.getElementById(\'kpi_new_q\').value=' + nextQ + ';document.getElementById(\'kpi_new_year\').value=' + nextYear + '">⏭️ ไตรมาสหน้า (Q' + nextQ + '-' + nextYear + ')</button>';
  h += '</div>';
  h += '<button class="btn bp btn-full" onclick="kpiConfirmCreateQuarter(\'' + salesMemberId + '\',\'' + sanitize(salesMemberName).replace(/'/g, "\\'") + '\')">➕ สร้างแผนไตรมาสนี้</button>';

  openM('📅 เลือกไตรมาสที่จะสร้างแผน KPI', h);
}

function kpiConfirmCreateQuarter(salesMemberId, salesMemberName) {
  var q = Number(document.getElementById('kpi_new_q').value) || 1;
  var year = Number(document.getElementById('kpi_new_year').value) || new Date().getFullYear();
  var plan = kpiCreateQuarterPlan(salesMemberId, salesMemberName, q, year);
  kpiSelectedPlanId = plan.id;
  closeMForce();
  render();
}

// ================================================================
// ยอดขาย/จำนวน Run Rate — ตัวเลขที่ไม่มีโครงการ/Pipeline ผูกอยู่ (เช่น ขายอุปกรณ์เสริมหน้าร้าน) บันทึกเองได้
// จากใน modal ของ category ที่เป็น pipelineRevenue หรือ pipelineModelQty ตัวไหนก็ได้ (2026-08-26) รวมเข้ากับ
// ตัวเลขที่คำนวณจาก Pipeline โดยตรง ไม่ทำเป็น category แยก — field kind แยกว่าเป็น 'revenue' (บาท) หรือ
// 'qty' (หน่วย นับเข้าเฉพาะ category ที่ item ตรงกับ modelMatch ของ category นั้น)
// ================================================================
function getKpiRunRateLogs() {
  var saved = localStorage.getItem('v7_kpiRunRateLogs');
  if (saved) { try { var p = JSON.parse(saved); return Array.isArray(p) ? p : []; } catch (e) { return []; } }
  return [];
}
function saveKpiRunRateLogs(list) {
  localStorage.setItem('v7_kpiRunRateLogs', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('kpiRunRateLogs', list);
  // ล้างแคชต่อ render ทันที (ดู _kpiCache ด้านบน) — ไม่งั้นเรียกฟังก์ชันนี้แล้วเปิด modal ต่อ (showKpiDetailM/
  // showKpiMonthDetailM) จะยังอ่าน _kpiRunRateLogsCached() ตัวเก่าก่อนบันทึกอยู่ ทำให้ยอด/รายการที่เพิ่ง
  // เพิ่ม-แก้-ลบไปไม่ขึ้นทันที (บั๊กที่เจอ 2026-09-01 หลังเพิ่มแคชให้หน้า KPI)
  _kpiInvalidateCache();
}

// Run Rate ผูกกับโครงการจริงได้ (l.pipeId) — ไว้ใช้เวลายอดจากโครงการยังไม่ขึ้นอัตโนมัติ (เช่น สถานะ/
// วันที่/ชื่อเซลยังไม่ถูก) เอาโครงการจริงมานับ manual ไปพลางก่อน พอไปแก้ต้นทางให้ถูกจนโครงการนั้นเข้าเกณฑ์
// อัตโนมัติเองแล้ว ฟังก์ชันนี้จะบอกให้ข้าม log นี้ตอนรวมยอด กันนับซ้ำ — ไม่ต้องมาลบ log เองด้วยมือ (2026-08-26)
function _kpiRunRateAutoCovered(l, plan, cat, startDate, endDate) {
  // log หักปรับจากการแบ่งงวด (ดู _kpiApConfirmPick) ต้องนับเสมอ ไม่งั้นจะโดนข้ามเหมือน log ปกติที่ผูก pipeId
  // เดียวกันในไตรมาสต้นทาง ทำให้หักส่วนต่างไม่ได้จริง (2026-09-01)
  if (l.splitAdjustment) return false;
  if (!l.pipeId) return false;
  var p = _kpiPipelineById()[l.pipeId];
  if (!p || !pipeIsWon(p)) return false;
  if ((p.saleName || '') !== plan.salesMemberName) return false;
  var rd = pipeResolvedCloseDate(p, _kpiWonLogIndex()).date;
  if (rd < startDate || rd > endDate) return false;
  if (cat.type === 'pipelineModelQty') {
    var keywords = (cat.modelMatch || []).map(function(s) { return s.toLowerCase(); });
    return (getPipeItems(p) || []).some(function(it) {
      var m = (it.model || '').toLowerCase();
      return keywords.some(function(k) { return m.indexOf(k) !== -1; });
    });
  }
  return true;
}

// ================================================================
// คำนวณ actual ต่อ category type
// ================================================================
function kpiComputeActualInRange(plan, cat, startDate, endDate) {
  if (cat.type === 'manualScore') return Number(cat.manualValue) || 0;

  if (cat.type === 'pipelineRevenue') {
    var sum = 0;
    var wonLogIdx = _kpiWonLogIndex();
    _kpiPipelines().forEach(function(p) {
      if (!pipeIsWon(p)) return;
      if ((p.saleName || '') !== plan.salesMemberName) return;
      var rd = pipeResolvedCloseDate(p, wonLogIdx).date;
      if (rd < startDate || rd > endDate) return;
      sum += Number(p.forecastAmount) || 0;
    });
    _kpiRunRateLogsCached().forEach(function(l) {
      if ((l.kind || 'revenue') !== 'revenue') return;
      if ((l.salesMemberName || '') !== plan.salesMemberName) return;
      if ((l.date || '') < startDate || (l.date || '') > endDate) return;
      if (_kpiRunRateAutoCovered(l, plan, cat, startDate, endDate)) return;
      sum += Number(l.amount) || 0;
    });
    return sum;
  }

  if (cat.type === 'pipelineModelQty') {
    var qty = 0;
    var keywords = (cat.modelMatch || []).map(function(s) { return s.toLowerCase(); });
    var wonLogIdx2 = _kpiWonLogIndex();
    _kpiPipelines().forEach(function(p) {
      if (!pipeIsWon(p)) return;
      if ((p.saleName || '') !== plan.salesMemberName) return;
      var rd = pipeResolvedCloseDate(p, wonLogIdx2).date;
      if (rd < startDate || rd > endDate) return;
      (getPipeItems(p) || []).forEach(function(it) {
        var m = (it.model || '').toLowerCase();
        if (keywords.some(function(k) { return m.indexOf(k) !== -1; })) qty += Number(it.qty) || 0;
      });
    });
    _kpiRunRateLogsCached().forEach(function(l) {
      if (l.kind !== 'qty') return;
      if ((l.salesMemberName || '') !== plan.salesMemberName) return;
      if ((l.date || '') < startDate || (l.date || '') > endDate) return;
      if (_kpiRunRateAutoCovered(l, plan, cat, startDate, endDate)) return;
      var m = (l.item || '').toLowerCase();
      if (keywords.some(function(k) { return m.indexOf(k) !== -1; })) qty += Number(l.amount) || 0;
    });
    return qty;
  }

  if (cat.type === 'dealerAuthorized') {
    return _kpiDealers().filter(function(d) {
      if (!d.authorizedDate) return false;
      if ((d.authorizedBy || '') !== plan.salesMemberName) return false;
      return d.authorizedDate >= startDate && d.authorizedDate <= endDate;
    }).length;
  }

  if (cat.type === 'visitCount') {
    return ST.getAll('visits').filter(function(v) {
      var vd = v.date || '';
      return vd >= startDate && vd <= endDate;
    }).length;
  }

  return 0;
}
function kpiComputeActual(plan, cat) {
  return kpiComputeActualInRange(plan, cat, plan.startDate, plan.endDate);
}

// ================================================================
// สถานะ Visit เดือนนี้ — แยก Partner (S/A/B ต้อง Offline อย่างน้อยเดือนละครั้ง) กับ
// Non-Partner (Meeting online/offline ไม่บังคับจำนวน) แล้วรวมเทียบเป้า Visit ทั้งไตรมาส
// เป็นแค่การแสดงผล ไม่ได้บังคับ/บล็อกอะไร — ตามที่คุยกันว่าขอแค่ให้เห็นว่าทันจังหวะไหม
// ================================================================
function kpiVisitStatusThisMonth() {
  var now = new Date();
  var ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var visitsThisMonth = ST.getAll('visits').filter(function(v) { return (v.date || '').indexOf(ym) === 0; });
  var partnerDealers = scopedDealers().filter(function(d) { return ['S', 'A', 'B'].indexOf(d.level) !== -1; });
  var partnerVisitedIds = {};
  var nonPartnerCount = 0;
  visitsThisMonth.forEach(function(v) {
    var d = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
    var isPartner = d && ['S', 'A', 'B'].indexOf(d.level) !== -1;
    if (isPartner) { if (v.mode === 'offline') partnerVisitedIds[d.id] = true; }
    else nonPartnerCount++;
  });

  var q = kpiGetCurrentQuarter();
  var plans = getKpiQuarterPlans().filter(function(p) { return p.quarter === q.quarter; });
  var target = 40, startDate, endDate;
  if (plans.length) {
    var cat = (plans[0].categories || []).find(function(c) { return c.type === 'visitCount'; });
    if (cat) target = cat.target;
    startDate = plans[0].startDate; endDate = plans[0].endDate;
  } else {
    var range = kpiQuarterRange(q.q, q.year);
    startDate = range.startDate; endDate = range.endDate;
  }
  var actualQ = ST.getAll('visits').filter(function(v) { var vd = v.date || ''; return vd >= startDate && vd <= endDate; }).length;

  var qStart = new Date(startDate + 'T00:00:00'), qEnd = new Date(endDate + 'T23:59:59');
  var totalDays = (qEnd - qStart) / 86400000;
  var elapsedDays = Math.min(totalDays, Math.max(0, (now - qStart) / 86400000));
  var expectedByNow = target * (totalDays ? elapsedDays / totalDays : 0);
  var onPace = actualQ >= expectedByNow;

  return {
    partnerDone: Object.keys(partnerVisitedIds).length, partnerTotal: partnerDealers.length,
    nonPartnerCount: nonPartnerCount, actualQ: actualQ, target: target, onPace: onPace, quarter: q.quarter
  };
}
function renderVisitTypeStatusCard() {
  var s = kpiVisitStatusThisMonth();
  var partnerMissing = s.partnerTotal - s.partnerDone;
  var pct = s.target ? Math.min(100, Math.round(s.actualQ / s.target * 100)) : 0;
  var ringColor = s.onPace ? 'var(--good)' : 'var(--bad)';
  var h = '<div class="card"><h2>📍 สถานะ Visit เดือนนี้</h2>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
  h += '<div style="background:var(--bg2);border-radius:10px;padding:10px"><div style="font-size:11px;color:var(--text2)">Partner (SAB) Offline</div>' +
    '<div style="font-size:20px;font-weight:700">' + s.partnerDone + ' <span style="font-size:12px;color:var(--text2);font-weight:400">/ ' + s.partnerTotal + ' ราย ครบแล้ว</span></div>' +
    (partnerMissing > 0 ? '<div class="stat-warn-t" style="font-size:11px;margin-top:3px">⚠️ เหลือ ' + partnerMissing + ' ราย ยังไม่ Visit เดือนนี้</div>' : '<div class="stat-good-t" style="font-size:11px;margin-top:3px">✅ ครบทุกราย</div>') +
    '</div>';
  h += '<div style="background:var(--bg2);border-radius:10px;padding:10px"><div style="font-size:11px;color:var(--text2)">Non-Partner Meeting</div>' +
    '<div style="font-size:20px;font-weight:700">' + s.nonPartnerCount + ' <span style="font-size:12px;color:var(--text2);font-weight:400">ครั้งเดือนนี้</span></div>' +
    '<div style="font-size:11px;color:var(--text2);margin-top:3px">ไม่บังคับจำนวนต่อราย</div></div>';
  h += '</div>';
  h += '<div style="background:var(--bg2);border-radius:10px;padding:10px;display:flex;align-items:center;gap:12px">' +
    progressRingHtml(pct, { size: 48, strokeW: 5, color: ringColor }) +
    '<div style="flex:1">' +
    '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:2px"><span>รวมทุก Visit เทียบเป้า ' + s.quarter + '</span><span style="font-weight:700;color:var(--text)">' + s.actualQ + ' / ' + s.target + ' ครั้ง</span></div>' +
    '<div class="' + (s.onPace ? 'stat-good-t' : 'stat-bad-t') + '" style="font-size:11px">' + (s.onPace ? '✅ ตามจังหวะ ทันเป้าไตรมาสนี้' : '⚠️ ตามหลังจังหวะที่ควรถึง') + '</div>' +
    '</div></div></div>';
  return h;
}

// ================================================================
// Monthly breakdown — แบ่งเป้าไตรมาสเป็นรายเดือน (เป้าคงที่ 1/3 ทุกเดือน)
// ================================================================
var KPI_MONTH_NAMES = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function kpiQuarterMonths(plan) {
  var start = new Date(plan.startDate + 'T00:00:00');
  var months = [];
  // ห้ามใช้ d.toISOString() ตรงนี้ — ดูคอมเมนต์ที่ kpiQuarterRange() ด้านบน
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  for (var i = 0; i < 3; i++) {
    var mStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
    // mEnd ใช้ iso() แค่บอกวันที่ (เที่ยงคืน) แต่เทียบ isCurrent ต้องรวมทั้งวันสุดท้ายของเดือนด้วย
    // ไม่งั้นพอเข้าวันสุดท้ายเกิน 00:00 จะหลุดจาก "เดือนนี้" ทันที
    var mEndDay = new Date(start.getFullYear(), start.getMonth() + i + 1, 0);
    var mEnd = new Date(mEndDay.getFullYear(), mEndDay.getMonth(), mEndDay.getDate(), 23, 59, 59, 999);
    months.push({ label: KPI_MONTH_NAMES[mStart.getMonth()], startDate: iso(mStart), endDate: iso(mEndDay), isCurrent: (new Date() >= mStart && new Date() <= mEnd) });
  }
  return months;
}
function kpiMonthlyBreakdown(plan, cat) {
  if (cat.type === 'manualScore') return null;
  var months = kpiQuarterMonths(plan);
  var monthlyTarget = (Number(cat.target) || 0) / 3;
  return months.map(function(m) {
    var actual = kpiComputeActualInRange(plan, cat, m.startDate, m.endDate);
    return { label: m.label, isCurrent: m.isCurrent, startDate: m.startDate, endDate: m.endDate, target: monthlyTarget, actual: actual, pct: monthlyTarget ? (actual / monthlyTarget * 100) : 0 };
  });
}

// ================================================================
// เทียบกับไตรมาสก่อน — เห็นแนวโน้มว่าดีขึ้น/แย่ลง
// ================================================================
function kpiPrevPlan(salesMemberId, currentPlan) {
  var plans = kpiGetPlansForSales(salesMemberId);
  var idx = plans.findIndex(function(p) { return p.id === currentPlan.id; });
  return idx > 0 ? plans[idx - 1] : null;
}

function kpiContributingRecords(plan, cat) {
  if (cat.type === 'pipelineRevenue' || cat.type === 'pipelineModelQty') {
    var keywords = (cat.modelMatch || []).map(function(s) { return s.toLowerCase(); });
    var wonLogIdx3 = _kpiWonLogIndex();
    var records = _kpiPipelines().filter(function(p) {
      if (!pipeIsWon(p)) return false;
      if ((p.saleName || '') !== plan.salesMemberName) return false;
      var rd = pipeResolvedCloseDate(p, wonLogIdx3).date;
      if (rd < plan.startDate || rd > plan.endDate) return false;
      if (cat.type === 'pipelineModelQty') {
        return (getPipeItems(p) || []).some(function(it) {
          var m = (it.model || '').toLowerCase();
          return keywords.some(function(k) { return m.indexOf(k) !== -1; });
        });
      }
      return true;
    });
    _kpiRunRateLogsCached().forEach(function(l) {
      var lKind = l.kind || 'revenue';
      if (cat.type === 'pipelineRevenue' && lKind !== 'revenue') return;
      if (cat.type === 'pipelineModelQty' && lKind !== 'qty') return;
      if ((l.salesMemberName || '') !== plan.salesMemberName) return;
      if ((l.date || '') < plan.startDate || (l.date || '') > plan.endDate) return;
      if (cat.type === 'pipelineModelQty') {
        var m = (l.item || '').toLowerCase();
        if (!keywords.some(function(k) { return m.indexOf(k) !== -1; })) return;
      }
      if (_kpiRunRateAutoCovered(l, plan, cat, plan.startDate, plan.endDate)) return;
      records.push({
        _runRate: true, _qty: cat.type === 'pipelineModelQty', id: l.id, projectName: l.item || 'Run Rate', note: l.note || '',
        registerDate: l.date, forecastAmount: l.amount, status: '', dealerId: null, pipeId: l.pipeId || null
      });
    });
    return records;
  }
  if (cat.type === 'dealerAuthorized') {
    return _kpiDealers().filter(function(d) {
      if (!d.authorizedDate) return false;
      if ((d.authorizedBy || '') !== plan.salesMemberName) return false;
      return d.authorizedDate >= plan.startDate && d.authorizedDate <= plan.endDate;
    });
  }
  if (cat.type === 'visitCount') {
    return ST.getAll('visits').filter(function(v) {
      var vd = v.date || '';
      return vd >= plan.startDate && vd <= plan.endDate;
    });
  }
  return [];
}

// วันที่ "ที่ใช้จริง" ของแต่ละ record จาก kpiContributingRecords() — ใช้ bucket เข้ารายเดือน (showKpiMonthDetailM)
// ต้องแยกตามชนิด record เพราะ field ที่เก็บวันที่ไม่เหมือนกัน (โครงการ Pipeline จริงใช้วันที่ปิดดีลที่ resolve
// ได้ ไม่ใช่ p.registerDate ตรงๆ, ส่วน run-rate log ใช้ l.date ที่ถูก alias มาเป็น r.registerDate ไว้แล้ว)
function _kpiRecordEffectiveDate(r, cat) {
  if (cat.type === 'visitCount') return r.date || '';
  if (cat.type === 'dealerAuthorized') return r.authorizedDate || '';
  if (r._runRate) return r.registerDate || '';
  return pipeResolvedCloseDate(r, _kpiWonLogIndex()).date;
}

// รายละเอียด KPI เฉพาะเดือนที่กด (จากตาราง "เป้ารายเดือน" ใน showKpiDetailM) — ผู้ใช้ขอ 2026-09-01 ให้กดดู
// รายการของเดือนนั้นๆ ได้ตรงๆ แทนที่จะเห็นแค่ตัวเลขรวม พร้อมฟอร์มเพิ่ม/บันทึกที่ตั้งวันที่ให้ล่วงหน้าอยู่ในเดือน
// นั้นแล้ว (ไม่ต้อง fix เป็นวันนี้เสมอ) แก้ปัญหาที่แก้ไข/เพิ่มข้อมูลเดือนก่อนหน้าทำได้ยาก
function showKpiMonthDetailM(planId, categoryId, monthStart, monthEnd) {
  var plan = getKpiQuarterPlans().filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  var cat = plan.categories.filter(function(c) { return c.id === categoryId; })[0];
  if (!cat) return;
  var isMoney = cat.type === 'pipelineRevenue';
  var isQtyCat = cat.type === 'pipelineModelQty';
  var monthLabel = KPI_MONTH_NAMES[new Date(monthStart + 'T00:00:00').getMonth()];
  var actual = kpiComputeActualInRange(plan, cat, monthStart, monthEnd);
  var monthlyTarget = (Number(cat.target) || 0) / 3;
  var monthRecords = kpiContributingRecords(plan, cat).filter(function(r) {
    var d = _kpiRecordEffectiveDate(r, cat);
    return d && d >= monthStart && d <= monthEnd;
  });

  var h = '<button class="btn bsm bo" onclick="showKpiDetailM(\'' + planId + '\',\'' + categoryId + '\')" style="margin-bottom:10px">← กลับไปดูทั้งไตรมาส</button>';
  h += '<div style="text-align:center;margin-bottom:10px">';
  h += '<div style="font-size:24px;font-weight:800">' + (isMoney ? fmtMoney(actual) : actual) + ' <span style="font-size:14px;color:var(--text2);font-weight:400">/ ' + (isMoney ? fmtMoney(monthlyTarget) : (Math.round(monthlyTarget * 10) / 10)) + ' ' + (cat.unit || '') + '</span></div>';
  h += '</div>';

  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">รายการที่นับเข้าเดือนนี้ (' + monthRecords.length + ')</div>';
  h += '<div style="max-height:280px;overflow-y:auto">' + _kpiRecordsListHtml(monthRecords, cat, planId) + '</div>';

  if (cat.type === 'pipelineRevenue' || cat.type === 'pipelineModelQty') {
    h += '<div style="display:flex;gap:6px;margin-top:8px">';
    h += '<button class="btn bp bsm" style="flex:1" onclick="showKpiAddProjectM(\'' + planId + '\',\'' + categoryId + '\',\'' + monthStart + '\')">➕ เพิ่มโครงการเข้าเดือน' + monthLabel + '</button>';
    h += '<button class="btn bo bsm" style="flex:1" onclick="_kpiToggleRunRateForm()">+ บันทึก' + (isQtyCat ? 'จำนวน' : 'ยอด') + 'เอง</button>';
    h += '</div>';
    h += '<div id="kpi_rr_form" style="display:none;margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px">';
    h += '<input type="hidden" id="kpi_rr_kind" value="' + (isQtyCat ? 'qty' : 'revenue') + '">';
    h += '<div class="fg"><label>วันที่</label><input type="date" id="kpi_rr_date" value="' + monthStart + '"></div>';
    if (isQtyCat) {
      h += '<div class="fg"><label>จำนวน (หน่วย)</label><input type="number" id="kpi_rr_amount" placeholder="1"></div>';
      h += '<div class="fg"><label>รุ่นสินค้า</label><select id="kpi_rr_item">' + (cat.modelMatch || []).map(function(k) { return '<option value="' + sanitize(k) + '">' + sanitize(k) + '</option>'; }).join('') + '</select></div>';
    } else {
      h += '<div class="fg"><label>จำนวนเงิน (บาท)</label><input type="number" id="kpi_rr_amount" placeholder="15000"></div>';
      h += '<div class="fg"><label>สินค้า / รายการ (ไม่บังคับ)</label><input type="text" id="kpi_rr_item" placeholder="เช่น TB65 Battery, DJI Care"></div>';
    }
    h += '<div class="fg"><label>หมายเหตุ (ไม่บังคับ)</label><input type="text" id="kpi_rr_note" placeholder="ขายหน้าร้าน / ลูกค้าประจำ"></div>';
    h += '<div style="display:flex;gap:6px"><button class="btn bp" style="flex:1" onclick="saveKpiRunRateLog(\'' + planId + '\',\'' + categoryId + '\')">บันทึก</button><button class="btn bo" style="flex:1" onclick="_kpiToggleRunRateForm()">ยกเลิก</button></div>';
    h += '</div>';
  }

  openM('📅 เดือน' + monthLabel + ' — ' + sanitize(cat.label), h);
}

function kpiAchievementPct(plan, cat) {
  var actual = kpiComputeActual(plan, cat);
  var target = Number(cat.target) || 0;
  if (!target) return 0;
  return actual / target * 100;
}

function kpiOverallScore(plan) {
  var totalWeight = 0, weightedSum = 0;
  (plan.categories || []).forEach(function(cat) {
    var w = Number(cat.weight) || 0;
    var pct = Math.min(Math.max(kpiAchievementPct(plan, cat), 0), 100);
    weightedSum += pct * w;
    totalWeight += w;
  });
  return totalWeight ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
}

// ================================================================
// Pace tracker — เทียบ % เวลาที่ผ่านไปกับ % ที่ทำได้แล้ว + run-rate ที่ต้องทำต่อ
// ================================================================
function kpiQuarterTimeProgress(plan) {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var start = new Date(plan.startDate + 'T00:00:00');
  var end = new Date(plan.endDate + 'T00:00:00');
  var totalDays = Math.max(Math.round((end - start) / 86400000) + 1, 1);
  var elapsed = Math.round((today - start) / 86400000) + 1;
  if (elapsed < 0) elapsed = 0;
  if (elapsed > totalDays) elapsed = totalDays;
  return { totalDays: totalDays, elapsedDays: elapsed, remainingDays: totalDays - elapsed, expectedPct: elapsed / totalDays * 100 };
}

var KPI_PACE_META = {
  ahead: { label: '🚀 ล้ำหน้าเป้า', color: 'var(--good)' },
  onTrack: { label: '🟢 ตามทัน', color: 'var(--status-info)' },
  behind: { label: '🔴 ตามหลังเป้า', color: 'var(--bad)' }
};

function kpiPaceInfo(plan, cat) {
  var time = kpiQuarterTimeProgress(plan);
  var actualPct = kpiAchievementPct(plan, cat);
  var diff = actualPct - time.expectedPct;
  var status = diff >= 5 ? 'ahead' : diff <= -10 ? 'behind' : 'onTrack';
  var actual = kpiComputeActual(plan, cat);
  var target = Number(cat.target) || 0;
  var remainTarget = Math.max(target - actual, 0);
  var perDay = (cat.type !== 'manualScore' && time.remainingDays > 0) ? remainTarget / time.remainingDays : 0;
  return { time: time, actualPct: actualPct, status: status, remainTarget: remainTarget, perDay: perDay, perWeek: perDay * 7 };
}

// ================================================================
// "ดีลที่ยังไม่ปิดแต่มีลุ้น" — pipeline ที่ยัง active ในไตรมาสนี้ ช่วยวางแผนไปต่อ
// ================================================================


function kpiPotentialRecords(plan, cat) {
  if (cat.type !== 'pipelineRevenue' && cat.type !== 'pipelineModelQty') return [];
  var keywords = (cat.modelMatch || []).map(function(s) { return s.toLowerCase(); });
  return _kpiPipelines().filter(function(p) {
    if (!pipeIsActive(p)) return false;
    if ((p.saleName || '') !== plan.salesMemberName) return false;
    var rd = p.registerDate || '';
    if (rd < plan.startDate || rd > plan.endDate) return false;
    if (cat.type === 'pipelineModelQty') {
      return (getPipeItems(p) || []).some(function(it) {
        var m = (it.model || '').toLowerCase();
        return keywords.some(function(k) { return m.indexOf(k) !== -1; });
      });
    }
    return true;
  });
}

function kpiPotentialAmount(plan, cat) {
  var records = kpiPotentialRecords(plan, cat);
  if (cat.type === 'pipelineRevenue') {
    return records.reduce(function(sum, p) { return sum + (Number(p.forecastAmount) || 0); }, 0);
  }
  if (cat.type === 'pipelineModelQty') {
    var keywords = (cat.modelMatch || []).map(function(s) { return s.toLowerCase(); });
    var qty = 0;
    records.forEach(function(p) {
      (getPipeItems(p) || []).forEach(function(it) {
        var m = (it.model || '').toLowerCase();
        if (keywords.some(function(k) { return m.indexOf(k) !== -1; })) qty += Number(it.qty) || 0;
      });
    });
    return qty;
  }
  return 0;
}

// ================================================================
// Top deals — ดีลที่ยังไม่ปิดแต่มูลค่าสูงสุด เรียงแล้วเลือกให้พอดีกับเป้าที่เหลือ
// ================================================================
function kpiTopPotentialDeals(plan) {
  var revCat = (plan.categories || []).filter(function(c) { return c.type === 'pipelineRevenue'; })[0];
  if (!revCat) return null;
  var actual = kpiComputeActual(plan, revCat);
  var target = Number(revCat.target) || 0;
  var remain = Math.max(target - actual, 0);
  if (remain <= 0) return null;
  var records = kpiPotentialRecords(plan, revCat).slice().sort(function(a, b) {
    return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0);
  });
  if (!records.length) return null;
  var picked = [];
  var sum = 0;
  for (var i = 0; i < records.length; i++) {
    picked.push(records[i]);
    sum += Number(records[i].forecastAmount) || 0;
    if (sum >= remain) break;
  }
  return { remain: remain, picked: picked, sum: sum, willHitTarget: sum >= remain, totalCandidates: records.length };
}

// ================================================================
// แผนดัน Dealer ให้ถึงเป้ายอดขาย — จัดกลุ่ม Dealer ที่เซลล์คนนี้ดูแลตามสถานะ "น่าจะช่วยให้ถึง KPI ไหม"
// (2026-08-24 ตามคำขอ: นอกจาก KPI บริษัท ต้องมีมุมมองระดับ Dealer ว่ารายไหนพอดันได้ รายไหนยังไม่ขยับเลย)
// ใช้ field เดียวกับที่ kpiComputeActual/kpiPotentialRecords ใช้อยู่แล้ว (saleName + registerDate ในช่วง
// ไตรมาส) แค่ group ตาม dealerId เพิ่ม แทนที่จะรวมยอดเป็นก้อนเดียว
// ================================================================
function kpiDealerPlanBreakdown(plan) {
  var revCat = (plan.categories || []).filter(function(c) { return c.type === 'pipelineRevenue'; })[0];
  if (!revCat) return null;

  var myDealers = _kpiDealers().filter(function(d) { return (d.saleName || '') === plan.salesMemberName; });
  var wonByDealer = {}, potByDealer = {}, dealsByDealer = {};
  var planCount = 0, winCount = 0, deliverCount = 0;
  var wonLogIdx4 = _kpiWonLogIndex();
  _kpiPipelines().forEach(function(p) {
    if ((p.saleName || '') !== plan.salesMemberName || !p.dealerId) return;
    var won = pipeIsWon(p), active = pipeIsActive(p);
    if (!won && !active) return; // Fail&Lost หรือสถานะอื่นที่ไม่นับใน Plan/Actual — ไม่แสดง
    // ดีล won ใช้วันที่ปิดดีลที่ resolve ได้ (เดียวกับที่ kpiComputeActual ใช้) ส่วนดีลที่ยังเปิดอยู่ (active/Plan)
    // ยังไม่มีวันปิดจริงให้ resolve ได้ ใช้ registerDate เป็นตัวแทนช่วงเวลาเหมือนเดิม
    var rd = won ? pipeResolvedCloseDate(p, wonLogIdx4).date : (p.registerDate || '');
    if (rd < plan.startDate || rd > plan.endDate) return;
    if (won) wonByDealer[p.dealerId] = (wonByDealer[p.dealerId] || 0) + (Number(p.forecastAmount) || 0);
    else potByDealer[p.dealerId] = (potByDealer[p.dealerId] || 0) + (Number(p.forecastAmount) || 0);
    var actualType = p.status === 'deliver' ? 'Deliver' : 'Win';
    if (won) { if (actualType === 'Deliver') deliverCount++; else winCount++; } else planCount++;
    (dealsByDealer[p.dealerId] = dealsByDealer[p.dealerId] || []).push({ p: p, state: won ? 'actual' : 'plan', actualType: actualType });
  });

  var rows = myDealers.map(function(d) {
    var won = wonByDealer[d.id] || 0;
    var potential = potByDealer[d.id] || 0;
    var status = won > 0 ? 'won' : (potential > 0 ? 'active' : 'none');
    return { dealer: d, won: won, potential: potential, status: status, deals: dealsByDealer[d.id] || [] };
  }).sort(function(a, b) { return (b.won + b.potential) - (a.won + a.potential); });

  return {
    target: Number(revCat.target) || 0,
    actual: kpiComputeActual(plan, revCat),
    rows: rows,
    noneCount: rows.filter(function(r) { return r.status === 'none'; }).length,
    planCount: planCount, winCount: winCount, deliverCount: deliverCount
  };
}

// ================================================================
// ยอดขายตาม Product (Win แล้ว) — เฉพาะ Drone/Bundle (Dock) ตามคำขอ 2026-08-26 ไม่รวม Payload/
// Battery/Charger/Software/Service/Other เทียบเป้ากับ KPI หมวด pipelineModelQty ถ้ามีผูกอยู่ (เช่น Dock 3/4)
// จับคู่ it.model (ข้อความอิสระ) กับชื่อสินค้าในแคตตาล็อกแบบ substring ทั้งสองทาง เหมือนที่ modelMatch
// ของ pipelineModelQty ใช้อยู่แล้ว เพราะข้อมูลจริงพิมพ์ไม่ตรงกับชื่อแคตตาล็อกเป๊ะเสมอไป
// ================================================================
function kpiProductSalesBreakdown(plan) {
  if (typeof getAllProducts !== 'function') return null;
  var mainCats = { drone: true, bundle: true };
  var catalog = getAllProducts().filter(function(pr) { return mainCats[pr.category]; });
  if (!catalog.length) return null;

  var qtyByName = {}, dealsByName = {};
  var wonLogIdx5 = _kpiWonLogIndex();
  _kpiPipelines().forEach(function(p) {
    if (!pipeIsWon(p)) return;
    if ((p.saleName || '') !== plan.salesMemberName) return;
    var rd = pipeResolvedCloseDate(p, wonLogIdx5).date;
    if (rd < plan.startDate || rd > plan.endDate) return;
    var actualType = p.status === 'deliver' ? 'Deliver' : 'Win';
    (getPipeItems(p) || []).forEach(function(it) {
      var m = (it.model || '').toLowerCase();
      if (!m) return;
      var match = catalog.filter(function(pr) { var n = pr.name.toLowerCase(); return m.indexOf(n) !== -1 || n.indexOf(m) !== -1; })[0];
      if (!match) return;
      var qty = Number(it.qty) || 0;
      qtyByName[match.name] = (qtyByName[match.name] || 0) + qty;
      (dealsByName[match.name] = dealsByName[match.name] || []).push({ p: p, qty: qty, actualType: actualType });
    });
  });

  var kpiTargets = {};
  (plan.categories || []).forEach(function(cat) {
    if (cat.type !== 'pipelineModelQty') return;
    (cat.modelMatch || []).forEach(function(kw) {
      catalog.forEach(function(pr) { if (pr.name.toLowerCase().indexOf(kw.toLowerCase()) !== -1) kpiTargets[pr.name] = cat; });
    });
  });

  var names = Object.keys(qtyByName);
  catalog.forEach(function(pr) { if (kpiTargets[pr.name] && names.indexOf(pr.name) === -1) names.push(pr.name); });
  if (!names.length) return null;

  var rows = names.map(function(name) {
    var cat = kpiTargets[name];
    var deals = dealsByName[name] || [];
    var winQty = deals.filter(function(d) { return d.actualType === 'Win'; }).reduce(function(s, d) { return s + d.qty; }, 0);
    var deliverQty = deals.filter(function(d) { return d.actualType === 'Deliver'; }).reduce(function(s, d) { return s + d.qty; }, 0);
    return { name: name, qty: qtyByName[name] || 0, target: cat ? (Number(cat.target) || 0) : null, catId: cat ? cat.id : null, deals: deals, winQty: winQty, deliverQty: deliverQty };
  }).sort(function(a, b) { return b.qty - a.qty; });

  return { rows: rows };
}

function _kpiDpToggle(id) {
  var el = document.getElementById(id);
  var icon = document.getElementById(id + '_ic');
  if (!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (icon) icon.textContent = open ? '▶' : '▼';
}

// จัดกลุ่มดีลที่ kpiTopPotentialDeals() เลือกมา (ปิดแล้วจะพอดีเป้า) ตาม Dealer — ช่วยตอบคำถาม "ควรไปดันที่
// เจ้าไหน" แทนที่จะเห็นแค่รายชื่อดีลเดี่ยวๆ
function kpiDealerGapSuggestion(plan) {
  var top = kpiTopPotentialDeals(plan);
  if (!top || !top.picked.length) return null;
  var byDealer = {};
  top.picked.forEach(function(p) {
    var key = p.dealerId || '_none';
    if (!byDealer[key]) {
      var dl = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
      byDealer[key] = { dealerId: p.dealerId, dealerName: dl ? dl.name : (p.dealerName || '-'), amount: 0, count: 0 };
    }
    byDealer[key].amount += Number(p.forecastAmount) || 0;
    byDealer[key].count++;
  });
  var list = Object.keys(byDealer).map(function(k) { return byDealer[k]; }).sort(function(a, b) { return b.amount - a.amount; });
  return { remain: top.remain, sum: top.sum, willHitTarget: top.willHitTarget, list: list };
}

// ================================================================
// Banner เตือนตามหลังเป้า — ใช้แสดงที่หน้า Today (เรียกจาก views-today.js)
// ================================================================
function kpiTodayBehindBanner() {
  if (typeof getSalesMembers !== 'function') return '';
  _kpiInvalidateCache();
  var members = kpiSalesOptions();
  var cur = kpiGetCurrentQuarter();
  var behindItems = [];
  members.forEach(function(m) {
    var plan = kpiGetPlansForSales(m.id).filter(function(p) { return p.quarter === cur.quarter; })[0];
    if (!plan) return;
    (plan.categories || []).forEach(function(cat) {
      if (cat.type === 'manualScore') return;
      var pace = kpiPaceInfo(plan, cat);
      if (pace.status === 'behind') behindItems.push({ plan: plan, cat: cat, member: m });
    });
  });
  if (!behindItems.length) return '';
  var first = behindItems[0];
  var h = '<div class="card kpi-today-banner" onclick="kpiSelectedSalesId=\'' + first.member.id + '\';kpiSelectedPlanId=\'' + first.plan.id + '\';go(\'kpiScorecard\')">';
  h += '<div class="kpi-today-banner-title">⚠️ KPI ตามหลังเป้า ' + behindItems.length + ' หัวข้อ</div>';
  h += '<div class="kpi-today-banner-sub">' + behindItems.slice(0, 3).map(function(b) { return b.cat.icon + ' ' + sanitize(b.cat.label); }).join(' · ') + (behindItems.length > 3 ? ' ...' : '') + ' — กดดูรายละเอียด →</div>';
  h += '</div>';
  return h;
}

// ================================================================
// ลิงก์ไปทำต่อ — กดจาก drill-down ไปหน้าที่เกี่ยวข้องได้ทันที
// ================================================================
function kpiCategoryCTA(cat) {
  if (cat.type === 'visitCount') return { label: '📍 ไปบันทึก Visit Report', action: "go('visits')" };
  if (cat.type === 'dealerAuthorized') return { label: '🏪 ไปดู Dealer ที่ยังไม่ Authorized', action: "dealerFilter='other';go('dealers')" };
  if (cat.type === 'pipelineRevenue' || cat.type === 'pipelineModelQty') return { label: '📊 ไปดู Pipeline ทั้งหมด', action: "go('pipeline')" };
  return null;
}

// ================================================================
// Export สรุป KPI ทุกเซลล์ เป็น Excel ให้หัวหน้าดู
// ================================================================
function exportKpiSummaryExcel() {
  _kpiInvalidateCache();
  var members = kpiSalesOptions();
  if (!members.length) return toast('ไม่มีรายชื่อเซลล์');

  // เก็บ category ที่เจอทั้งหมด (id -> {icon,label}) เรียงตามลำดับที่เจอครั้งแรก ใช้ทำคอลัมน์ dashboard แบบไดนามิก
  var catOrder = [];
  var catMeta = {};

  var dashboardData = []; // { name, quarter, overall, doneCount, total, updated, byCatId: {actual,target} }
  var detailRows = [['เซลล์', 'ไตรมาส', 'หัวข้อ KPI', 'น้ำหนัก (%)', 'เป้า', 'ทำได้แล้ว', 'หน่วย', '% สำเร็จ', 'สถานะ']];
  var visitRows = [['วันที่', 'เซลล์', 'Dealer', 'รูปแบบ', 'หัวข้อที่คุย']];
  var salesRows = [['วันที่ลงทะเบียน', 'เซลล์', 'หมวด KPI', 'โครงการ', 'Dealer', 'มูลค่า/จำนวนที่นับ', 'สถานะ']];
  var dealerRows = [['วันที่ Authorize', 'เซลล์', 'Dealer', 'Level']];

  var hasAny = false;
  members.forEach(function(m) {
    var plans = kpiGetPlansForSales(m.id);
    if (!plans.length) return;
    hasAny = true;
    var plan = plans[plans.length - 1];
    var overall = kpiOverallScore(plan);
    var doneCount = 0;
    var byCatId = {};

    (plan.categories || []).forEach(function(cat) {
      var actual = kpiComputeActual(plan, cat);
      var pct = kpiAchievementPct(plan, cat);
      if (pct >= 100) doneCount++;
      var pace = kpiPaceInfo(plan, cat);
      var paceLabel = KPI_PACE_META[pace.status].label.replace(/[^฀-๿a-zA-Z ]/g, '').trim();
      detailRows.push([
        m.name, plan.quarter, cat.label, cat.weight,
        cat.target, Math.round(actual * 100) / 100, cat.unit || '',
        Math.round(pct), paceLabel
      ]);

      if (catOrder.indexOf(cat.id) === -1) { catOrder.push(cat.id); catMeta[cat.id] = cat; }
      byCatId[cat.id] = (Math.round(actual * 100) / 100) + '/' + cat.target;

      // แท็บรายละเอียดย่อย — ดึงรายการจริงเบื้องหลังแต่ละหมวด
      if (cat.type === 'visitCount') {
        kpiContributingRecords(plan, cat).forEach(function(v) {
          var d = ST.getOne('dealers', v.dealerId);
          var topics = (v.topicData || []).filter(function(t) { return t.answered; }).map(function(t) { return t.topicId; }).join(', ');
          visitRows.push([v.date || '', m.name, d ? d.name : (v.company || '-'), v.mode === 'offline' ? 'Onsite' : 'Online', topics]);
        });
      } else if (cat.type === 'pipelineRevenue' || cat.type === 'pipelineModelQty') {
        kpiContributingRecords(plan, cat).forEach(function(p) {
          var d = ST.getOne('dealers', p.dealerId);
          var counted = cat.type === 'pipelineRevenue'
            ? fmtMoney(Number(p.forecastAmount) || 0)
            : (getPipeItems(p) || []).filter(function(it) {
                var mm = (it.model || '').toLowerCase();
                return (cat.modelMatch || []).some(function(k) { return mm.indexOf(k.toLowerCase()) !== -1; });
              }).reduce(function(s, it) { return s + (Number(it.qty) || 0); }, 0) + ' หน่วย';
          salesRows.push([pipeResolvedCloseDate(p).date, m.name, cat.label, p.projectName || '-', d ? d.name : '-', counted, p.status || '']);
        });
      } else if (cat.type === 'dealerAuthorized') {
        kpiContributingRecords(plan, cat).forEach(function(d) {
          dealerRows.push([d.authorizedDate || '', m.name, d.name || '-', d.level || '']);
        });
      }
    });

    dashboardData.push({ name: m.name, quarter: plan.quarter, overall: overall, doneCount: doneCount, total: (plan.categories || []).length, updated: fD(plan.updatedAt), byCatId: byCatId });
  });

  if (!hasAny) return toast('ยังไม่มีแผน KPI ของเซลล์คนไหนเลย');

  // Dashboard sheet — คอลัมน์คงที่ + คอลัมน์ต่อหมวดแบบไดนามิก (icon+label เป็นหัวตาราง)
  var dashboardHeader = ['เซลล์', 'ไตรมาส', 'คะแนนรวม KPI (%)', 'หัวข้อที่ถึงเป้าแล้ว', 'จำนวนหัวข้อทั้งหมด'].concat(
    catOrder.map(function(id) { return catMeta[id].icon + ' ' + catMeta[id].label + ' (ทำได้/เป้า)'; })
  ).concat(['อัปเดตล่าสุด']);
  var overviewRows = [dashboardHeader];
  dashboardData.forEach(function(row) {
    overviewRows.push([row.name, row.quarter, row.overall, row.doneCount, row.total]
      .concat(catOrder.map(function(id) { return row.byCatId[id] || '-'; }))
      .concat([row.updated]));
  });

  var wb = XLSX.utils.book_new();

  var wsDash = XLSX.utils.aoa_to_sheet(overviewRows);
  wsDash['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 14 }].concat(catOrder.map(function() { return { wch: 20 }; })).concat([{ wch: 14 }]);
  XLSX.utils.book_append_sheet(wb, wsDash, '📊 Dashboard');

  var wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'รายละเอียด KPI');

  if (visitRows.length > 1) {
    var wsVisit = XLSX.utils.aoa_to_sheet(visitRows);
    wsVisit['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsVisit, 'รายละเอียด - Visit');
  }
  if (salesRows.length > 1) {
    var wsSales = XLSX.utils.aoa_to_sheet(salesRows);
    wsSales['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 30 }, { wch: 22 }, { wch: 16 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsSales, 'รายละเอียด - ยอดขาย');
  }
  if (dealerRows.length > 1) {
    var wsDealer = XLSX.utils.aoa_to_sheet(dealerRows);
    wsDealer['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsDealer, 'รายละเอียด - Dealer ใหม่');
  }

  XLSX.writeFile(wb, 'kpi-summary-' + _td() + '.xlsx');
  toast('📊 Export สรุป KPI แล้ว');
}

// ================================================================
// หน้าหลัก: Scorecard
// ================================================================
// รายชื่อเซลล์ให้เลือกใน dropdown ผสาน "ทีม Sales" ที่ลงทะเบียนไว้ (⚙️ ตั้งค่า) เข้ากับชื่อ saleName
// ที่มีอยู่จริงใน Dealer/Pipeline แต่ยังไม่เคยลงทะเบียนเป็นสมาชิกทีม — กันปัญหาเซลจริงที่ดูแล Dealer
// อยู่ไม่ขึ้นในตัวเลือกเลยเพราะไม่เคยไปเพิ่มชื่อไว้ในทีม Sales (ใช้ id ปลอม 'freename_' ได้ปกติ
// เพราะ KPI ทั้งระบบอ้างอิงด้วย salesMemberId/salesMemberName ที่เก็บไว้ในแผนเอง ไม่ได้ join กลับไปหา
// getSalesMembers() ที่ไหนอีก)
function kpiSalesOptions() {
  var registered = (typeof getSalesMembers === 'function' ? getSalesMembers() : []).filter(function(m) { return m.active !== false; });
  var known = {};
  registered.forEach(function(m) { known[m.name] = true; });
  var extra = {};
  _kpiDealers().forEach(function(d) { if (d.saleName && !known[d.saleName]) extra[d.saleName] = true; });
  _kpiPipelines().forEach(function(p) { if (p.saleName && !known[p.saleName]) extra[p.saleName] = true; });
  var extraList = Object.keys(extra).map(function(n) { return { id: 'freename_' + n, name: n, active: true, freeText: true }; });
  return registered.concat(extraList).sort(function(a, b) { return (a.name || '').localeCompare(b.name || '', 'th'); });
}

// ปักหมุดเซลที่จะให้เป็นค่าเริ่มต้นตอนเปิดหน้า KPI เซลล์ — เก็บด้วยชื่อ (ไม่ใช่ id) เพราะรายชื่อจาก
// kpiSalesOptions() ผสมทั้ง id จริงจากทีม Sales และ id ปลอม 'freename_' ที่ไม่คงที่ ชื่อจึงเทียบได้ตรงกว่า
function getKpiDefaultSalesName() { return localStorage.getItem('v7_kpiDefaultSalesName') || ''; }
function kpiSetDefaultSales(name) {
  localStorage.setItem('v7_kpiDefaultSalesName', name);
  toast('📌 ตั้ง "' + name + '" เป็นค่าเริ่มต้นของหน้า KPI แล้ว');
  render();
}

function rKpiScorecard(el) {
  _kpiInvalidateCache();
  document.getElementById('pgT').textContent = '📊 KPI เซลล์';
  var members = kpiSalesOptions();

  if (!members.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:30px">ยังไม่มีรายชื่อเซลล์ — เพิ่มได้ที่เมนู ⚙️ ตั้งค่า &gt; ทีมขาย</div>';
    return;
  }
  if (!kpiSelectedSalesId || !members.some(function(m) { return m.id === kpiSelectedSalesId; })) {
    // เดิม fallback ไป members[0] เฉยๆ (เรียงตามชื่อ ก-ฮ) ทำให้เปิดหน้ามาเจอเซลคนอื่นเป็นค่าเริ่มต้นเสมอ —
    // ตอนนี้เลือกตามลำดับ: ค่าที่ผู้ใช้ปักหมุดไว้เอง > ชื่อ "ของฉัน" จาก dealer scope > members[0] (fallback สุดท้าย)
    var defName = getKpiDefaultSalesName();
    var myName = typeof myDealerScopeName === 'function' ? myDealerScopeName() : '';
    var preferred = members.filter(function(m) { return m.name === defName; })[0]
      || members.filter(function(m) { return m.name === myName; })[0]
      || members[0];
    kpiSelectedSalesId = preferred.id;
  }
  var member = members.filter(function(m) { return m.id === kpiSelectedSalesId; })[0];

  // ชื่อซ้ำกันในทีม Sales — ต่อ PIN ท้ายชื่อกันเลือกผิดคน (ตัวปัญหาจริงต้องไปลบ/เปลี่ยนชื่อที่ 🔍 ตรวจสอบชื่อเซลล์)
  var memberNameCounts = {};
  members.forEach(function(m) { memberNameCounts[m.name] = (memberNameCounts[m.name] || 0) + 1; });

  var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center">';
  h += '<select class="fm-input" style="min-width:160px" onchange="kpiSelectedSalesId=this.value;kpiSelectedPlanId=null;render()">';
  members.forEach(function(m) {
    var label = sanitize(m.name) +
      (memberNameCounts[m.name] > 1 ? ' (PIN:' + sanitize(m.pin || '-') + ')' : '') +
      (m.freeText ? ' — ยังไม่ได้เพิ่มในทีม' : '');
    h += '<option value="' + m.id + '"' + (m.id === kpiSelectedSalesId ? ' selected' : '') + '>' + label + '</option>';
  });
  h += '</select>';
  var isDefaultSales = getKpiDefaultSalesName() === member.name;
  h += '<button class="btn bsm ' + (isDefaultSales ? 'bp' : 'bo') + '" onclick="kpiSetDefaultSales(\'' + sanitize(member.name).replace(/'/g, "\\'") + '\')" title="ตั้งให้เปิดหน้านี้มาเจอ ' + sanitize(member.name) + ' เป็นค่าเริ่มต้นเสมอ">' + (isDefaultSales ? '📌 ค่าเริ่มต้น' : '📌 ตั้งเป็นค่าเริ่มต้น') + '</button>';

  var plans = kpiGetPlansForSales(member.id);
  if (!kpiSelectedPlanId || !plans.some(function(p) { return p.id === kpiSelectedPlanId; })) {
    kpiSelectedPlanId = plans.length ? plans[plans.length - 1].id : null;
  }
  var plan = plans.filter(function(p) { return p.id === kpiSelectedPlanId; })[0];

  if (plans.length) {
    h += '<select class="fm-input" style="min-width:120px" onchange="kpiSelectedPlanId=this.value;render()">';
    plans.forEach(function(p) {
      h += '<option value="' + p.id + '"' + (p.id === kpiSelectedPlanId ? ' selected' : '') + '>' + sanitize(p.quarter) + '</option>';
    });
    h += '</select>';
  }
  h += '<button class="btn bsm bo" onclick="showKpiNewQuarterM(\'' + member.id + '\',\'' + sanitize(member.name).replace(/'/g, "\\'") + '\')">➕ สร้างไตรมาสใหม่</button>';
  if (plan) h += '<button class="btn bsm bo" onclick="showKpiConfigM(\'' + plan.id + '\')">⚙️ ตั้งค่าไตรมาสนี้</button>';
  if (plan) h += '<button class="btn bsm bd" onclick="kpiDeleteQuarterPlan(\'' + plan.id + '\')">🗑️ ลบไตรมาสนี้</button>';
  h += '<button class="btn bsm bo" onclick="exportKpiSummaryExcel()">📊 Export สรุปให้หัวหน้า</button>';
  h += '<button class="btn bsm bo" onclick="showSaleNameMismatchM()" title="ถ้าตัวเลข KPI ขึ้น 0 ทั้งที่มีโครงการจริง มักเกิดจากชื่อเซลล์ในข้อมูลไม่ตรงกับสมาชิกทีม — เช็คได้ที่นี่">🔍 ตรวจสอบชื่อเซลล์</button>';
  var cdmCount = cdmRegisterTierCount();
  h += '<button class="btn bsm bo" onclick="showCloseDateManagerM()" title="ดู/แก้วันที่ปิดดีลที่ใช้คำนวณยอด KPI — ใช้ร่วมกับหน้า Sales Analytics">🧭 จัดการวันที่ปิดดีล' + (cdmCount ? ' (' + cdmCount + ')' : '') + '</button>';
  h += '</div>';

  if (!plan) {
    h += '<div class="card" style="text-align:center;padding:30px">ยังไม่มีแผน KPI ของ ' + sanitize(member.name) + ' — กด "➕ สร้างไตรมาสใหม่"</div>';
    el.innerHTML = h;
    return;
  }

  var overall = kpiOverallScore(plan);
  var overallColor = overall >= 100 ? 'var(--good)' : overall >= 70 ? 'var(--status-info)' : overall >= 40 ? 'var(--status-gold)' : 'var(--bad)';
  var time = kpiQuarterTimeProgress(plan);
  var doneCount = (plan.categories || []).filter(function(cat) { return kpiAchievementPct(plan, cat) >= 100; }).length;

  // เทียบกับไตรมาสก่อน
  var prevPlan = kpiPrevPlan(member.id, plan);
  var trendHtml = '';
  if (prevPlan) {
    var prevScore = kpiOverallScore(prevPlan);
    var delta = Math.round((overall - prevScore) * 10) / 10;
    var trendColor = delta > 0 ? 'var(--good)' : delta < 0 ? 'var(--bad)' : 'var(--neutral)';
    var trendArrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '►';
    trendHtml = '<div class="kpi-trend" style="color:' + trendColor + '">' + trendArrow + ' ' + Math.abs(delta) + '% จาก ' + sanitize(prevPlan.quarter) + ' (' + prevScore + '%)</div>';
  }

  // วงแหวน progress (SVG)
  var ringPct = Math.min(overall, 100);
  var ringR = 52, ringC = 2 * Math.PI * ringR;
  var ringOffset = ringC * (1 - ringPct / 100);

  h += '<div class="card kpi-hero-card">';
  h += '<div class="kpi-hero-row">';
  h += '<div class="kpi-hero-ring-wrap">';
  h += '<svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="' + ringR + '" fill="none" stroke="var(--border)" stroke-width="10"/>';
  h += '<circle cx="60" cy="60" r="' + ringR + '" fill="none" stroke="' + overallColor + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + ringC + '" stroke-dashoffset="' + ringOffset + '" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .6s ease"/></svg>';
  h += '<div class="kpi-hero-ring-num" style="color:' + overallColor + '">' + overall + '%</div>';
  if (overall >= 100) h += '<div class="kpi-hero-ring-badge">🏆</div>';
  h += '</div>';
  h += '<div class="kpi-hero-info">';
  h += '<div class="kpi-hero-title">' + sanitize(plan.quarter) + ' — ' + sanitize(member.name) + '</div>';
  h += '<div class="kpi-hero-stats">';
  h += '<div class="kpi-hero-stat"><b>' + doneCount + '/' + (plan.categories || []).length + '</b><span>หัวข้อถึงเป้า</span></div>';
  h += '<div class="kpi-hero-stat"><b>' + Math.round(time.expectedPct) + '%</b><span>เวลาผ่านไป</span></div>';
  h += '<div class="kpi-hero-stat"><b>' + time.remainingDays + ' วัน</b><span>เหลือในไตรมาส</span></div>';
  h += '</div>';
  h += trendHtml;
  h += '</div>';
  h += '</div>';
  h += '</div>';

  // การ์ด KPI ย่อเป็น "chip" กระชับ 5 อันเรียงแถวเดียว (เดิมการ์ดใหญ่ทำให้หน้ายาวเกินจำเป็น) — คลิกเปิด
  // modal รายละเอียดเดิมทุกอย่างเหมือนเดิม (showKpiDetailM) ไม่ได้ตัดฟีเจอร์อะไรออก แค่ตัวกระตุ้นเล็กลง
  h += '<div class="kpi-chip-row">';
  (plan.categories || []).forEach(function(cat) {
    var actual = kpiComputeActual(plan, cat);
    var pct = kpiAchievementPct(plan, cat);
    var pctShow = Math.min(pct, 100);
    var isDone = pct >= 100;
    var barColor = pct >= 100 ? 'var(--good)' : pct >= 50 ? 'var(--status-info)' : 'var(--bad)';
    var actualShow = cat.type === 'pipelineRevenue' ? fmtMoneyShort(actual) : actual;
    var targetShow = cat.type === 'pipelineRevenue' ? fmtMoneyShort(cat.target) : cat.target;

    h += '<div class="kpi-chip' + (isDone ? ' done' : '') + '" onclick="showKpiDetailM(\'' + plan.id + '\',\'' + cat.id + '\')">';
    h += '<div class="kpi-chip-top"><span>' + cat.icon + '</span>' + (isDone ? '<span>🎉</span>' : '<span class="kpi-chip-w">' + cat.weight + '%</span>') + '</div>';
    h += '<div class="kpi-chip-label">' + sanitize(cat.label) + '</div>';
    h += '<div class="kpi-chip-bar"><div style="width:' + pctShow + '%;background:' + barColor + '"></div></div>';
    h += '<div class="kpi-chip-nums"><span>' + actualShow + '/' + targetShow + '</span><b style="color:' + barColor + '">' + Math.round(pct) + '%</b></div>';
    h += '</div>';
  });
  h += '</div>';

  // แท็บล่าง — เดิมการ์ด "ปิด N ดีลนี้/รายเดือน/Dealer/Product" ต่อกันยาวลงมาเรื่อยๆ ต้องเลื่อนจอมาก
  // ตอนนี้โชว์ทีละแท็บ สลับด้วย _kpiTabClick() (CSS display ล้วนๆ ไม่ re-render หน้าใหม่)
  h += '<div class="kpi-tabbar">';
  [['deals', '🌱 ดีลที่ควรปิด'], ['monthly', '📅 รายเดือน'], ['dealers', '🏪 Dealer'], ['products', '📦 Product']].forEach(function(t) {
    h += '<button class="btn bsm kpi-tabbtn ' + (_kpiActiveTab === t[0] ? 'bp' : 'bo') + '" data-kpitab="' + t[0] + '" onclick="_kpiTabClick(\'' + t[0] + '\')">' + t[1] + '</button>';
  });
  h += '</div>';

  // 🌱 Top deals ที่ควรปิดให้ถึงเป้า — ตารางค้นหา/กรอง/จัดเรียงได้ (2026-08-26 ตามคำขอ)
  var topDeals = kpiTopPotentialDeals(plan);
  if (topDeals) {
    h += '<div class="kpi-tabpane" data-kpitab="deals"' + (_kpiActiveTab !== 'deals' ? ' style="display:none"' : '') + '>';
    h += '<div class="card kpi-topdeals-card">';
    h += '<div class="kpi-topdeals-title">🌱 ปิด ' + topDeals.picked.length + ' ดีลนี้' + (topDeals.willHitTarget ? ' ก็ถึงเป้ายอดขายไตรมาสนี้!' : ' ช่วยลดระยะห่างจากเป้าได้') + '</div>';
    h += '<div class="kpi-topdeals-sub">เป้าที่เหลือ ' + fmtMoneyShort(topDeals.remain) + ' — ดีลที่เลือก รวม ' + fmtMoneyShort(topDeals.sum) + (topDeals.totalCandidates > topDeals.picked.length ? ' (จากทั้งหมด ' + topDeals.totalCandidates + ' ดีลที่มีลุ้น)' : '') + '</div>';

    var tdRows = topDeals.picked.map(function(p) {
      var dl = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
      var items = (getPipeItems(p) || []).map(function(it) { return (it.model || '-') + ' x' + (it.qty || 1); }).join(', ');
      var lastLog = (typeof ST !== 'undefined' && ST.pipeLogsByPipe) ? ST.pipeLogsByPipe(p.id)[0] : null;
      return { p: p, dealer: dl, items: items, fc: _kpiForecastMonthInfo(p, plan), lastLog: lastLog };
    });

    var tdStatuses = [];
    var tdStatusSeen = {};
    tdRows.forEach(function(r) { if (r.p.status && !tdStatusSeen[r.p.status]) { tdStatusSeen[r.p.status] = true; tdStatuses.push(r.p.status); } });

    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">';
    h += '<input type="text" placeholder="🔍 ค้นหาโครงการ/Dealer/End user" style="flex:1;min-width:160px" value="' + sanitize(_kpiTdSearch) + '" oninput="_kpiTdSearchInput(this.value)">';
    h += '<select style="min-width:120px" onchange="_kpiTdStatusChange(this.value)"><option value="">สถานะทั้งหมด</option>';
    tdStatuses.forEach(function(s) { h += '<option value="' + s + '"' + (_kpiTdStatus === s ? ' selected' : '') + '>' + sanitize(typeof getPipeName === 'function' ? getPipeName(s) : s) + '</option>'; });
    h += '</select>';
    h += '<select style="min-width:150px" onchange="_kpiTdForecastChange(this.value)">' +
      '<option value=""' + (!_kpiTdForecast ? ' selected' : '') + '>Forecast: ทั้งหมด</option>' +
      '<option value="in"' + (_kpiTdForecast === 'in' ? ' selected' : '') + '>อยู่ในไตรมาสนี้</option>' +
      '<option value="out"' + (_kpiTdForecast === 'out' ? ' selected' : '') + '>นอกไตรมาสนี้</option></select>';
    h += '<select style="min-width:150px" onchange="_kpiTdSortChange(this.value)">';
    [['amt_desc', 'มูลค่า: มาก→น้อย'], ['amt_asc', 'มูลค่า: น้อย→มาก'], ['upd_desc', 'อัพเดทล่าสุดก่อน'], ['fc_asc', 'Forecast: ใกล้สุดก่อน']].forEach(function(o) {
      h += '<option value="' + o[0] + '"' + (_kpiTdSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    });
    h += '</select></div>';

    var q = _kpiTdSearch.trim().toLowerCase();
    var filtered = tdRows.filter(function(r) {
      if (_kpiTdStatus && r.p.status !== _kpiTdStatus) return false;
      if (_kpiTdForecast === 'in' && !(r.fc && r.fc.inQuarter)) return false;
      if (_kpiTdForecast === 'out' && (r.fc && r.fc.inQuarter)) return false;
      if (!q) return true;
      var hay = [r.p.projectName, r.p.endUserTH, r.p.endUserEN, r.dealer ? r.dealer.name : ''].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    filtered.sort(function(a, b) {
      if (_kpiTdSort === 'amt_asc') return (Number(a.p.forecastAmount) || 0) - (Number(b.p.forecastAmount) || 0);
      if (_kpiTdSort === 'upd_desc') return (b.lastLog ? b.lastLog.date : '').localeCompare(a.lastLog ? a.lastLog.date : '');
      if (_kpiTdSort === 'fc_asc') return (a.fc ? a.fc.sortKey : '9999-99').localeCompare(b.fc ? b.fc.sortKey : '9999-99');
      return (Number(b.p.forecastAmount) || 0) - (Number(a.p.forecastAmount) || 0);
    });

    // table-layout:fixed + width ต่อคอลัมน์ กันคอลัมน์ "รายการสินค้า" (ข้อความยาวไม่จำกัด) ดันตารางล้นจอ —
    // แต่ละช่องตัดด้วย ellipsis บรรทัดเดียว ใช้ title="..." โผล่ข้อความเต็มตอนชี้เมาส์แทน (2026-08-26 ตามคำขอ)
    var TDCOLS = [
      ['No.', 36, 'left'], ['โครงการ', 190, 'left'], ['End user', 120, 'left'], ['Dealer', 120, 'left'],
      ['รายการสินค้า', 220, 'left'], ['มูลค่า', 70, 'right'], ['สถานะ', 90, 'left'], ['Forecast', 100, 'left'], ['อัพเดทล่าสุด', 150, 'left']
    ];
    h += '<div style="overflow-x:auto"><table style="width:100%;min-width:' + TDCOLS.reduce(function(s, c) { return s + c[1]; }, 0) + 'px;border-collapse:collapse;font-size:.74rem;table-layout:fixed">';
    h += '<colgroup>' + TDCOLS.map(function(c) { return '<col style="width:' + c[1] + 'px">'; }).join('') + '</colgroup>';
    h += '<thead><tr style="border-bottom:1px solid var(--border)">' +
      TDCOLS.map(function(c) { return '<th style="text-align:' + c[2] + ';padding:5px 6px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + c[0] + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    if (!filtered.length) {
      h += '<tr><td colspan="' + TDCOLS.length + '" style="text-align:center;padding:14px;color:var(--text2)">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>';
    }
    var tdCell = function(html, align, title) {
      return '<td style="padding:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' + (align ? ';text-align:' + align : '') + '"' + (title ? ' title="' + sanitize(title) + '"' : '') + '>' + html + '</td>';
    };
    filtered.forEach(function(r) {
      var p = r.p;
      var fcBadge = r.fc ? ('<span class="tag" style="background:' + (r.fc.inQuarter ? 'var(--good-tint);color:var(--good-tint-text)' : 'var(--neutral-tint);color:var(--text3)') + '">' + sanitize(r.fc.label) + (r.fc.inQuarter ? ' ✓' : '') + '</span>') : '<span style="color:var(--text2)">-</span>';
      var updText = r.lastLog ? fD(r.lastLog.date) + ' · ' + (r.lastLog.content || '') : '-';
      var updHtml = r.lastLog ? (sanitize((r.lastLog.content || '').substr(0, 30)) + '<div style="color:var(--text2);font-size:.64rem">' + fD(r.lastLog.date) + '</div>') : '<span style="color:var(--text2)">-</span>';
      h += '<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">' +
        tdCell(p.rowNo || '-', null) +
        tdCell(sanitize(p.projectName || '-'), null, p.projectName) +
        tdCell(sanitize(p.endUserTH || p.endUserEN || '-'), null, p.endUserTH || p.endUserEN) +
        tdCell(sanitize(r.dealer ? r.dealer.name : '-'), null, r.dealer ? r.dealer.name : '') +
        tdCell(sanitize(r.items || '-'), null, r.items) +
        tdCell('<b>' + fmtMoneyShort(p.forecastAmount) + '</b>', 'right') +
        tdCell(typeof pipeTag === 'function' ? pipeTag(p.status) : sanitize(p.status || '-'), null) +
        tdCell(fcBadge, null) +
        tdCell(updHtml, null, updText) +
        '</tr>';
    });
    h += '</tbody></table></div>';
    h += '</div>';
    h += '</div>';
  }

  // 📦 ยอดขายตาม Product — การ์ดแยกต่างหาก (2026-08-26 ตามคำขอ)
  var prodSales = kpiProductSalesBreakdown(plan);
  if (prodSales) {
    h += '<div class="kpi-tabpane" data-kpitab="products"' + (_kpiActiveTab !== 'products' ? ' style="display:none"' : '') + '>';
    h += '<div class="card">';
    h += '<h2>📦 ยอดขายตาม Product</h2>';
    h += '<div style="font-size:.68rem;color:var(--text2);margin:-4px 0 8px">เฉพาะ Drone / Dock — ไม่รวมอุปกรณ์เสริม แบตเตอรี่ ซอฟต์แวร์</div>';
    h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.74rem">';
    h += '<thead><tr style="border-bottom:1px solid var(--border)">' +
      '<th style="text-align:left;padding:5px 6px;color:var(--text2)">Product</th>' +
      '<th style="text-align:right;padding:5px 6px;color:var(--text2)">ยอดขาย (หน่วย)</th>' +
      '<th style="text-align:right;padding:5px 6px;color:var(--text2)">เป้า KPI</th>' +
      '<th style="text-align:left;padding:5px 6px;color:var(--text2)">ความคืบหน้า</th></tr></thead><tbody>';
    prodSales.rows.forEach(function(r, ppIdx) {
      var pct = r.target ? Math.min(100, Math.round(r.qty / r.target * 100)) : null;
      var barColor = pct >= 100 ? 'var(--good)' : pct >= 50 ? 'var(--status-info)' : 'var(--bad)';
      var progress = r.target
        ? '<div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + barColor + '"></div></div><span style="font-size:.68rem;color:var(--text2);width:32px;text-align:right">' + pct + '%</span></div>'
        : '<span style="color:var(--text2)">ไม่มี KPI ผูก</span>';
      var rid = 'kpp_' + ppIdx;
      var chevron = r.deals.length ? '<span id="' + rid + '_ic" onclick="_kpiDpToggle(\'' + rid + '\')" style="cursor:pointer;color:var(--text2);margin-right:5px">▶</span>' : '<span style="display:inline-block;width:14px"></span>';
      var nameHtml = r.catId
        ? '<span onclick="event.stopPropagation();showKpiDetailM(\'' + plan.id + '\',\'' + r.catId + '\')" style="cursor:pointer;text-decoration:underline dotted">' + sanitize(r.name) + '</span>'
        : sanitize(r.name);
      h += '<tr style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:6px;font-weight:600">' + chevron + nameHtml + '</td>' +
        '<td style="padding:6px;text-align:right">' + r.qty + (r.deals.length ? '<div style="font-size:.62rem;color:var(--text2);font-weight:400">Win ' + r.winQty + ' · Deliver ' + r.deliverQty + '</div>' : '') + '</td>' +
        '<td style="padding:6px;text-align:right;color:var(--text2)">' + (r.target != null ? r.target : '-') + '</td>' +
        '<td style="padding:6px;min-width:120px">' + progress + '</td></tr>';
      if (r.deals.length) {
        h += '<tr><td colspan="4" style="padding:0">';
        h += '<div id="' + rid + '" style="display:none;padding:2px 6px 6px 22px">';
        r.deals.forEach(function(dl) {
          var p = dl.p;
          var typeColor = dl.actualType === 'Deliver' ? 'var(--deliver)' : 'var(--good)';
          h += '<div style="display:flex;gap:8px;align-items:center;font-size:.7rem;padding:4px;border-top:1px solid var(--border);cursor:pointer" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">' +
            '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(p.projectName || '-') + '</span>' +
            '<span style="width:40px;text-align:right;color:var(--text2)">x' + dl.qty + '</span>' +
            '<span style="width:56px;text-align:right;color:' + typeColor + ';font-weight:600">' + dl.actualType + '</span></div>';
        });
        h += '</div></td></tr>';
      }
    });
    h += '</tbody></table></div></div>';
    h += '</div>';
  }

  // 📅 โครงการรายเดือน — สลับดูตาม Bidding Date / Forecast Month / Shipment Date
  _kpiMoInit();
  h += '<div class="kpi-tabpane" data-kpitab="monthly"' + (_kpiActiveTab !== 'monthly' ? ' style="display:none"' : '') + '>';
  h += '<div class="card">';
  h += '<h2>📅 โครงการรายเดือน</h2>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0">';
  h += '<div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
  [['bid', 'Bidding Date'], ['fc', 'Forecast Month'], ['ship', 'Shipment Date']].forEach(function(t) {
    h += '<button class="btn bsm ' + (_kpiMoTab === t[0] ? 'bp' : 'bo') + '" style="border-radius:0;border:none" onclick="_kpiMoSetTab(\'' + t[0] + '\')">' + t[1] + '</button>';
  });
  h += '</div>';
  h += '<div style="display:flex;align-items:center;gap:6px;margin-left:auto">';
  h += '<button class="btn bsm bo" onclick="_kpiMoShift(-1)">‹</button>';
  h += '<span style="font-size:.8rem;font-weight:600;min-width:80px;text-align:center">' + KPI_MONTH_NAMES[_kpiMoMonth] + ' ' + _kpiMoYear + '</span>';
  h += '<button class="btn bsm bo" onclick="_kpiMoShift(1)">›</button>';
  h += '</div></div>';
  h += '<label style="display:flex;align-items:center;gap:5px;font-size:.7rem;color:var(--text2);margin-bottom:6px;cursor:pointer">' +
    '<input type="checkbox" style="width:auto" ' + (_kpiMoHideClosed ? 'checked' : '') + ' onchange="_kpiMoToggleHideClosed(this.checked)">ซ่อนดีลที่ปิดแล้ว (Win/Lost)</label>';

  if (_kpiMoTab === 'fc') {
    var unparsed = kpiUnparsedForecastMonthProjects(plan);
    if (unparsed.length) {
      h += '<div class="kpi-sc-month" style="margin-bottom:6px">⚠️ ' + unparsed.length + ' โครงการมี Forecast Month แต่อ่านเดือน/ปีไม่ออก (เช่นพิมพ์ผิดฟอร์แมต) จะไม่ขึ้นในรายเดือนแท็บนี้เลย — ' +
        unparsed.slice(0, 5).map(function(p) { return sanitize(p.projectName || '-') + ' ("' + sanitize(p.forecastMonth) + '")'; }).join(', ') +
        (unparsed.length > 5 ? ' ...' : '') + '</div>';
    }
  }

  var moProjects = kpiProjectsByMonth(plan, _kpiMoTab, _kpiMoMonth, _kpiMoYear, _kpiMoHideClosed);
  h += '<div style="font-size:.72rem;color:var(--text2);margin-bottom:8px">' + moProjects.length + ' โครงการ</div>';
  h += '<div style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">';
  if (!moProjects.length) {
    h += '<div style="text-align:center;color:var(--text2);padding:16px;font-size:.78rem">ไม่มีโครงการในเดือนนี้</div>';
  }
  moProjects.forEach(function(p) {
    var dl = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    h += '<div class="kpi-detail-row" style="cursor:pointer" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
    h += '<div style="display:flex;justify-content:space-between;gap:8px">' +
      '<span style="font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
      (p.rowNo ? '<span style="color:var(--text2);font-weight:400">#' + sanitize(String(p.rowNo)) + '</span> ' : '') + sanitize(p.projectName || '-') + '</span>' +
      '<b style="white-space:nowrap">' + fmtMoneyShort(p.forecastAmount) + '</b></div>';
    h += '<div style="font-size:.68rem;color:var(--text2);margin-top:2px;display:flex;gap:6px;align-items:center">' +
      (dl ? '🏪 ' + sanitize(dl.name) : '') + (typeof pipeTag === 'function' ? pipeTag(p.status) : '') + '</div>';
    h += '</div>';
  });
  h += '</div></div>';
  h += '</div>';

  // 🎯 แผนดัน Dealer ให้ถึงเป้ายอดขาย — มุมมองระดับ Dealer (แยกจากมุมมองระดับดีลของการ์ด "Top deals" ด้านบน)
  var dealerPlan = kpiDealerPlanBreakdown(plan);
  if (dealerPlan && dealerPlan.rows.length) {
    var dpRemain = Math.max(dealerPlan.target - dealerPlan.actual, 0);
    h += '<div class="kpi-tabpane" data-kpitab="dealers"' + (_kpiActiveTab !== 'dealers' ? ' style="display:none"' : '') + '>';
    h += '<div class="card">';
    h += '<h2>🎯 แผนดัน Dealer ให้ถึงเป้ายอดขาย <span class="ml" style="font-size:11px;color:var(--text2)">เป้าที่เหลือ ' + fmtMoneyShort(dpRemain) + '</span></h2>';
    h += '<div style="font-size:.68rem;color:var(--text2);margin:-4px 0 8px">Plan ' + dealerPlan.planCount + ' · Actual ' + (dealerPlan.winCount + dealerPlan.deliverCount) + ' (Win ' + dealerPlan.winCount + ', Deliver ' + dealerPlan.deliverCount + ')</div>';
    h += '<div class="kpi-dealer-rows">';
    dealerPlan.rows.forEach(function(r, dpIdx) {
      var badge = r.status === 'won' ? '<span class="tag tag-win">✅ ถึงแล้ว ' + fmtMoneyShort(r.won) + '</span>'
        : r.status === 'active' ? '<span class="tag tag-bidding">🟡 มีลุ้น ' + fmtMoneyShort(r.potential) + '</span>'
        : '<span class="tag tag-lost">🔴 ยังไม่ขยับ</span>';
      var rid = 'kdp_' + dpIdx;
      h += '<div class="kpi-detail-row" style="cursor:default">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
        (r.deals.length ? '<span id="' + rid + '_ic" onclick="_kpiDpToggle(\'' + rid + '\')" style="cursor:pointer;color:var(--text2);width:12px;flex-shrink:0">▶</span>' : '<span style="width:12px;flex-shrink:0"></span>') +
        '<span onclick="go(\'dealerDetail\',{dealerId:\'' + r.dealer.id + '\'})" style="cursor:pointer;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🏪 ' + sanitize(r.dealer.name) + '</span>' +
        badge +
        (r.status === 'none' ? '<button class="btn bsm bo" onclick="event.stopPropagation();showFollowupM(\'' + r.dealer.id + '\')">📞 + Follow-up</button>' : '') +
        '</div>';
      if (r.deals.length) {
        h += '<div id="' + rid + '" style="display:none;margin-top:6px;padding-left:20px">';
        h += '<div style="display:flex;gap:8px;font-size:.6rem;color:var(--text2);padding:2px 4px">' +
          '<span style="flex:1">โครงการ</span><span style="width:70px">สถานะ</span><span style="width:60px;text-align:right">มูลค่า</span>' +
          '<span style="width:36px;text-align:center">Plan</span><span style="width:60px;text-align:center">Actual</span></div>';
        r.deals.forEach(function(dl) {
          var p = dl.p;
          var planMark = dl.state === 'plan' ? '<span style="color:var(--status-info);font-weight:700">✓</span>' : '<span style="color:var(--text2)">–</span>';
          var actualMark = dl.state === 'actual' ? '<span style="color:var(--good);font-weight:600">✓ ' + dl.actualType + '</span>' : '<span style="color:var(--text2)">–</span>';
          h += '<div style="display:flex;gap:8px;align-items:center;font-size:.7rem;padding:4px;border-top:1px solid var(--border);cursor:pointer" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">' +
            '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(p.projectName || '-') + '</span>' +
            '<span style="width:70px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (typeof getPipeName === 'function' ? sanitize(getPipeName(p.status)) : sanitize(p.status || '-')) + '</span>' +
            '<span style="width:60px;text-align:right">' + fmtMoneyShort(p.forecastAmount) + '</span>' +
            '<span style="width:36px;text-align:center">' + planMark + '</span>' +
            '<span style="width:60px;text-align:center">' + actualMark + '</span></div>';
        });
        h += '</div>';
      }
      h += '</div>';
    });
    h += '</div>';
    if (dealerPlan.noneCount) {
      h += '<div class="kpi-sc-month" style="margin-top:6px">⚠️ ' + dealerPlan.noneCount + ' ราย ยังไม่มีความเคลื่อนไหวในไตรมาสนี้เลย — ไม่น่าช่วยให้ถึงเป้าได้ถ้าไม่รีบตามต่อ</div>';
    }

    var gapSug = kpiDealerGapSuggestion(plan);
    if (gapSug) {
      h += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">';
      h += '<div class="kpi-sc-month" style="margin-bottom:6px">💡 ถ้าปิดของ Dealer เหล่านี้ได้ ' + (gapSug.willHitTarget ? 'จะถึงเป้าพอดี' : 'จะช่วยลดระยะห่างจากเป้าได้') + ' (รวม ' + fmtMoneyShort(gapSug.sum) + ' จากเป้าที่เหลือ ' + fmtMoneyShort(gapSug.remain) + ')</div>';
      gapSug.list.forEach(function(g) {
        h += '<div class="kpi-detail-row" ' + (g.dealerId ? 'onclick="go(\'dealerDetail\',{dealerId:\'' + g.dealerId + '\'})"' : '') + '>🏪 ' + sanitize(g.dealerName) + ' — ' + fmtMoneyShort(g.amount) + ' (' + g.count + ' ดีล)</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    h += '</div>';
  }

  el.innerHTML = h;
}

// ================================================================
// Drill-down รายหัวข้อ
// ================================================================
function _kpiToggleVisit(id) {
  var el  = document.getElementById(id);
  var btn = document.getElementById(id + '_btn');
  if (!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : '';
  if (btn) btn.textContent = open ? '▼ ดู' : '▲ ซ่อน';
}

function _kpiRecordRowHtml(r, cat, planId) {
  if (cat.type === 'visitCount') {
    var dl = r.dealerId ? ST.getOne('dealers', r.dealerId) : null;
    var vLabel = sanitize(dl ? dl.name : (r.company || r.summary || '-').substr(0, 40));
    var vid = 'kvi_' + r.id;
    var h = '<div class="kpi-detail-row" style="cursor:default">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center">';
    h += '<span style="cursor:pointer" onclick="closeMForce();go(\'visitDetail\',{visitId:\'' + r.id + '\'})">📍 ' + fD(r.date) + ' — <b>' + vLabel + '</b></span>';
    if (r.summary) h += '<span style="font-size:10px;color:var(--text2);padding:1px 6px;border:1px solid var(--border);border-radius:4px;cursor:pointer;margin-left:8px;white-space:nowrap" id="' + vid + '_btn" onclick="_kpiToggleVisit(\'' + vid + '\')">▼ ดู</span>';
    h += '</div>';
    if (r.summary) h += '<div id="' + vid + '" style="display:none;font-size:11px;color:var(--text2);white-space:pre-wrap;padding:6px 0 2px;border-top:1px solid var(--border);margin-top:5px">' + sanitize(r.summary) + '</div>';
    h += '</div>';
    return h;
  }
  if (cat.type === 'dealerAuthorized') {
    return '<div class="kpi-detail-row" onclick="closeMForce();go(\'dealerDetail\',{dealerId:\'' + r.id + '\'})">🤝 ' + sanitize(r.name) + ' — ' + fD(r.authorizedDate) + '</div>';
  }
  if (r._runRate) {
    var pipeLink = r.pipeId ? ' <span style="cursor:pointer;text-decoration:underline dotted" onclick="event.stopPropagation();closeMForce();go(\'pipeDetail\',{pipeId:\'' + r.pipeId + '\'})" title="ผูกกับโครงการนี้ในระบบ — พอแก้ต้นทาง (สถานะ/วันที่/ชื่อเซล) ให้เข้าเกณฑ์ จะนับอัตโนมัติเองแล้วรายการนี้จะหายไป กันนับซ้ำ">🔗 ไปที่โครงการ</span>' : '';
    return '<div class="kpi-detail-row" style="display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:default">' +
      '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🔁 ' + sanitize(r.projectName) + (r.note ? ' <span style="color:var(--text2)">— ' + sanitize(r.note) + '</span>' : '') + ' <span style="color:var(--text2)">(' + fD(r.registerDate) + ')</span>' + pipeLink + '</span>' +
      '<b>' + (r._qty ? r.forecastAmount + ' หน่วย' : fmtMoneyShort(r.forecastAmount)) + '</b>' +
      '<button class="btn bsm bo" onclick="showEditRunRateM(\'' + r.id + '\',\'' + planId + '\',\'' + cat.id + '\')" title="แก้ไข">✏️</button>' +
      '<button class="btn bsm bd" onclick="deleteKpiRunRateLog(\'' + r.id + '\',\'' + planId + '\',\'' + cat.id + '\')" title="ลบ">🗑️</button>' +
      '</div>';
  }
  var dl2 = r.dealerId ? ST.getOne('dealers', r.dealerId) : null;
  var rowNoTag = r.rowNo ? '<span style="color:var(--text2)">#' + sanitize(String(r.rowNo)) + '</span> ' : '';
  return '<div class="kpi-detail-row" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + r.id + '\'})">📦 ' + rowNoTag + sanitize(r.projectName || (dl2 ? dl2.name : '') || '-') +
    (dl2 ? ' <span style="color:var(--text2)">— ' + sanitize(dl2.name) + '</span>' : '') + ' — ' + fmtMoneyShort(r.forecastAmount) + '</div>';
}

function _kpiRecordMatchesQuery(r, cat, q) {
  if (cat.type === 'visitCount') {
    var d = r.dealerId ? ST.getOne('dealers', r.dealerId) : null;
    return [(d ? d.name : ''), r.company, r.summary].some(function(s) { return (s || '').toLowerCase().indexOf(q) !== -1; });
  }
  if (cat.type === 'dealerAuthorized') {
    return (r.name || '').toLowerCase().indexOf(q) !== -1;
  }
  var dl = r.dealerId ? ST.getOne('dealers', r.dealerId) : null;
  return [String(r.rowNo || ''), r.projectName, r.note, (dl ? dl.name : '')].some(function(s) { return (s || '').toLowerCase().indexOf(q) !== -1; });
}

function _kpiRecordsListHtml(records, cat, planId) {
  if (!records.length) return '<div style="color:var(--text2);font-size:12px;text-align:center;padding:10px">ยังไม่มีรายการ</div>';
  return records.map(function(r) { return _kpiRecordRowHtml(r, cat, planId); }).join('');
}

function _kpiRecordsFilterList(planId, categoryId) {
  var plan = getKpiQuarterPlans().filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  var cat = plan.categories.filter(function(c) { return c.id === categoryId; })[0];
  if (!cat) return;
  var q = (document.getElementById('kpi_records_search').value || '').trim().toLowerCase();
  var all = kpiContributingRecords(plan, cat);
  var filtered = q ? all.filter(function(r) { return _kpiRecordMatchesQuery(r, cat, q); }) : all;
  document.getElementById('kpi_records_list').innerHTML = _kpiRecordsListHtml(filtered, cat, planId);
  document.getElementById('kpi_records_count').textContent = 'รายการที่นับเข้า KPI นี้ (' + filtered.length + (q ? ' / ทั้งหมด ' + all.length : '') + ')';
}

function showKpiDetailM(planId, categoryId) {
  var plans = getKpiQuarterPlans();
  var plan = plans.filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  var cat = plan.categories.filter(function(c) { return c.id === categoryId; })[0];
  if (!cat) return;

  var actual = kpiComputeActual(plan, cat);
  var pct = kpiAchievementPct(plan, cat);
  var remain = Math.max((Number(cat.target) || 0) - actual, 0);
  var isMoney = cat.type === 'pipelineRevenue';

  var h = '<div style="text-align:center;margin-bottom:10px">';
  h += '<div style="font-size:28px;font-weight:800">' + Math.round(pct) + '%</div>';
  h += '<div style="font-size:12px;color:var(--text2)">ทำได้ ' + (isMoney ? fmtMoney(actual) : actual) + ' / เป้า ' + (isMoney ? fmtMoney(cat.target) : cat.target) + ' ' + (cat.unit || '') + '</div>';
  if (cat.type !== 'manualScore') h += '<div style="font-size:12px;color:var(--text2)">เหลืออีก ' + (isMoney ? fmtMoney(remain) : remain) + ' ' + (cat.unit || '') + '</div>';
  h += '</div>';

  var pace = kpiPaceInfo(plan, cat);
  var paceMeta = KPI_PACE_META[pace.status];
  h += '<div class="kpi-pace-box" style="border-color:' + paceMeta.color + '">';
  h += '<div style="color:' + paceMeta.color + ';font-weight:700;font-size:13px">' + paceMeta.label + '</div>';
  if (cat.type !== 'manualScore' && pace.remainTarget > 0 && pace.time.remainingDays > 0) {
    var perDayShow = isMoney ? fmtMoney(Math.round(pace.perDay)) : (Math.round(pace.perDay * 10) / 10);
    var perWeekShow = isMoney ? fmtMoney(Math.round(pace.perWeek)) : (Math.round(pace.perWeek * 10) / 10);
    h += '<div style="font-size:11px;color:var(--text2);margin-top:4px">เหลือ ' + pace.time.remainingDays + ' วัน — ต้องทำเฉลี่ย <b>' + perDayShow + ' ' + (cat.unit || '') + '/วัน</b> (≈' + perWeekShow + '/สัปดาห์) ถึงจะถึงเป้า</div>';
  } else if (cat.type !== 'manualScore' && pace.remainTarget <= 0) {
    h += '<div style="font-size:11px;color:var(--text2);margin-top:4px">ถึงเป้าแล้ว 🎉</div>';
  }
  h += '</div>';

  if (cat.type === 'manualScore') {
    h += '<div class="fg"><label>กรอกคะแนนที่ได้รับจาก DJI</label><input type="number" id="kpi_manual_val" value="' + (cat.manualValue != null ? cat.manualValue : '') + '"></div>';
    h += '<button class="btn bp btn-full" onclick="kpiSaveManualScore(\'' + planId + '\',\'' + categoryId + '\')">💾 บันทึกคะแนน</button>';
  } else {
    // เป้ารายเดือน (แบ่งเป้าไตรมาส 1/3 ทุกเดือน)
    var mb = kpiMonthlyBreakdown(plan, cat);
    if (mb) {
      h += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">📅 เป้ารายเดือน (แบ่งเท่ากันทุกเดือน)</div>';
      h += '<div class="kpi-month-grid">';
      mb.forEach(function(m) {
        var mColor = m.pct >= 100 ? 'var(--good)' : m.pct >= 50 ? 'var(--status-info)' : 'var(--bad)';
        var mActualShow = isMoney ? fmtMoneyShort(m.actual) : Math.round(m.actual * 10) / 10;
        var mTargetShow = isMoney ? fmtMoneyShort(m.target) : Math.round(m.target * 10) / 10;
        h += '<div class="kpi-month-cell' + (m.isCurrent ? ' cur' : '') + '" style="cursor:pointer" onclick="showKpiMonthDetailM(\'' + planId + '\',\'' + categoryId + '\',\'' + m.startDate + '\',\'' + m.endDate + '\')" title="ดูรายละเอียดของเดือนนี้">';
        h += '<div class="kpi-month-label">' + m.label + (m.isCurrent ? ' (เดือนนี้)' : '') + '</div>';
        h += '<div class="kpi-month-val" style="color:' + mColor + '">' + mActualShow + ' / ' + mTargetShow + '</div>';
        h += '</div>';
      });
      h += '</div>';
    }
    var records = kpiContributingRecords(plan, cat);
    if (records.length > 5) {
      h += '<input type="text" id="kpi_records_search" placeholder="🔍 ค้นหา Row No / ชื่อ Dealer / ชื่อโครงการ..." style="width:100%;margin-bottom:6px" oninput="_kpiRecordsFilterList(\'' + planId + '\',\'' + categoryId + '\')">';
    }
    h += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px" id="kpi_records_count">รายการที่นับเข้า KPI นี้ (' + records.length + ')</div>';
    h += '<div style="max-height:240px;overflow-y:auto" id="kpi_records_list">' + _kpiRecordsListHtml(records, cat, planId) + '</div>';

    if (cat.type === 'pipelineRevenue' || cat.type === 'pipelineModelQty') {
      var isQtyCat = cat.type === 'pipelineModelQty';
      h += '<div style="display:flex;gap:6px;margin-top:8px">';
      h += '<button class="btn bp bsm" style="flex:1" onclick="showKpiAddProjectM(\'' + planId + '\',\'' + categoryId + '\')" title="เลือกโครงการที่มีอยู่แล้วมานับเข้า KPI นี้เอง — ค้นได้ทุกช่วงเวลา กรองสถานะ/เดือนได้">➕ เพิ่มโครงการ</button>';
      h += '<button class="btn bo bsm" style="flex:1" id="kpi_rr_addbtn" onclick="_kpiToggleRunRateForm()">+ บันทึก' + (isQtyCat ? 'จำนวน' : 'ยอด') + 'เอง</button>';
      h += '</div>';
      h += '<div id="kpi_rr_form" style="display:none;margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px">';
      h += '<input type="hidden" id="kpi_rr_kind" value="' + (isQtyCat ? 'qty' : 'revenue') + '">';
      h += '<div class="fg"><label>วันที่</label><input type="date" id="kpi_rr_date" value="' + _td() + '"></div>';
      if (isQtyCat) {
        h += '<div class="fg"><label>จำนวน (หน่วย)</label><input type="number" id="kpi_rr_amount" placeholder="1"></div>';
        h += '<div class="fg"><label>รุ่นสินค้า</label><select id="kpi_rr_item">' + (cat.modelMatch || []).map(function(k) { return '<option value="' + sanitize(k) + '">' + sanitize(k) + '</option>'; }).join('') + '</select>' +
          '<div style="font-size:.62rem;color:var(--text2);margin-top:3px">นับเข้า KPI นี้เฉพาะรุ่นในลิสต์ที่ผูกกับหัวข้อนี้เท่านั้น</div></div>';
      } else {
        h += '<div class="fg"><label>จำนวนเงิน (บาท)</label><input type="number" id="kpi_rr_amount" placeholder="15000"></div>';
        h += '<div class="fg"><label>สินค้า / รายการ (ไม่บังคับ)</label><input type="text" id="kpi_rr_item" placeholder="เช่น TB65 Battery, DJI Care"></div>';
      }
      h += '<div class="fg"><label>หมายเหตุ (ไม่บังคับ)</label><input type="text" id="kpi_rr_note" placeholder="ขายหน้าร้าน / ลูกค้าประจำ"></div>';
      h += '<div style="display:flex;gap:6px"><button class="btn bp" style="flex:1" onclick="saveKpiRunRateLog(\'' + planId + '\',\'' + categoryId + '\')">บันทึก</button><button class="btn bo" style="flex:1" onclick="_kpiToggleRunRateForm()">ยกเลิก</button></div>';
      h += '</div>';
    } else if (cat.type === 'dealerAuthorized') {
      h += '<button class="btn bp bsm btn-full" style="margin-top:8px" onclick="showKpiAddDealerAuthorizedM(\'' + planId + '\',\'' + categoryId + '\')" title="เลือก Dealer ที่ Authorize ไปแล้วมานับเข้า KPI นี้เอง เผื่อยังไม่ขึ้นอัตโนมัติ">➕ เพิ่ม Dealer</button>';
    }

    var potentialRecords = kpiPotentialRecords(plan, cat);
    if (potentialRecords.length) {
      var potentialAmt = kpiPotentialAmount(plan, cat);
      h += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">';
      h += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">🌱 ดีลที่ยังไม่ปิด แต่มีลุ้น (' + potentialRecords.length + ' รายการ — รวม ' + (isMoney ? fmtMoneyShort(potentialAmt) : potentialAmt) + ' ' + (cat.unit || '') + ')</div>';
      h += '<div style="max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">';
      potentialRecords.forEach(function(p) {
        var dl3 = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
        var items = (getPipeItems(p) || []).map(function(it) { return (it.model || '-') + ' x' + (it.qty || 1); }).join(', ');
        var fc = _kpiForecastMonthInfo(p, plan);
        var lastLog = (typeof ST !== 'undefined' && ST.pipeLogsByPipe) ? ST.pipeLogsByPipe(p.id)[0] : null;
        var fcBadge = fc ? ('<span class="tag" style="background:' + (fc.inQuarter ? 'var(--good-tint);color:var(--good-tint-text)' : 'var(--neutral-tint);color:var(--text3)') + '">' + sanitize(fc.label) + (fc.inQuarter ? ' ✓' : '') + '</span>') : '';
        h += '<div class="kpi-detail-row" style="cursor:pointer" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
        h += '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">' +
          '<span style="font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(p.projectName || '') + '">' + (p.rowNo ? '<span style="color:var(--text2);font-weight:400">#' + sanitize(String(p.rowNo)) + '</span> ' : '') + '🌱 ' + sanitize(p.projectName || (dl3 ? dl3.name : '') || '-') + '</span>' +
          '<b style="white-space:nowrap">' + fmtMoneyShort(p.forecastAmount) + '</b></div>';
        h += '<div style="font-size:11px;color:var(--text2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          (dl3 ? '🏪 ' + sanitize(dl3.name) : '') + (p.endUserTH || p.endUserEN ? ' · 👤 ' + sanitize(p.endUserTH || p.endUserEN) : '') + '</div>';
        if (items) h += '<div style="font-size:11px;color:var(--text2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(items) + '">📦 ' + sanitize(items) + '</div>';
        h += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">' + (typeof pipeTag === 'function' ? pipeTag(p.status) : '') + fcBadge + '</div>';
        if (lastLog) h += '<div style="font-size:10.5px;color:var(--text2);margin-top:4px;padding-top:4px;border-top:1px dashed var(--border);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📝 ' + fD(lastLog.date) + ' · ' + sanitize((lastLog.content || '').substr(0, 50)) + '</div>';
        h += '</div>';
      });
      h += '</div></div>';
    }
  }

  var cta = kpiCategoryCTA(cat);
  if (cta) h += '<button class="btn bp btn-full" style="margin-top:12px" onclick="closeMForce();' + cta.action + '">' + cta.label + '</button>';

  h += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">';
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">📝 บันทึกเพิ่มเติม / checklist ย่อย (ติ๊กถูกได้)</div>';
  var logs = getKpiQuarterLogs().filter(function(l) { return l.planId === planId && l.categoryId === categoryId; })
    .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
  logs.forEach(function(l) {
    h += '<div class="kpi-log-row' + (l.done ? ' done' : '') + '">';
    h += '<div class="kpi-log-ck" onclick="kpiToggleLogDone(\'' + l.id + '\',\'' + planId + '\',\'' + categoryId + '\')">' + (l.done ? '✅' : '⬜') + '</div>';
    h += '<div class="kpi-log-text"><span style="color:var(--text2)">' + fD(l.date) + '</span> — ' + sanitize(l.note) + '</div>';
    h += '</div>';
  });
  h += '<textarea id="kpi_log_note" rows="2" placeholder="บันทึกว่าทำอะไรไปแล้ว..." style="width:100%;margin-top:6px"></textarea>';
  h += '<button class="btn bsm bo btn-full" style="margin-top:6px" onclick="kpiAddLog(\'' + planId + '\',\'' + categoryId + '\')">➕ เพิ่มบันทึก</button>';
  h += '</div>';

  openM(cat.icon + ' ' + cat.label, h);
}

function kpiSaveManualScore(planId, categoryId) {
  var plans = getKpiQuarterPlans();
  var plan = plans.filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  var cat = plan.categories.filter(function(c) { return c.id === categoryId; })[0];
  if (!cat) return;
  var valEl = document.getElementById('kpi_manual_val');
  cat.manualValue = valEl ? (Number(valEl.value) || 0) : 0;
  plan.updatedAt = new Date().toISOString();
  saveKpiQuarterPlans(plans);
  toast('💾 บันทึกคะแนนแล้ว');
  closeMForce();
  render();
}

// ================================================================
// เพิ่ม/แก้ไข/ลบ ยอดขาย Run Rate — บันทึกอิสระ ไม่ผูก Pipeline รวมเข้ากับ "ยอดขาย DJI Product" โดยตรง
// ================================================================
function _kpiToggleRunRateForm() {
  var form = document.getElementById('kpi_rr_form');
  var btn = document.getElementById('kpi_rr_addbtn');
  if (!form) return;
  var open = form.style.display !== 'none';
  form.style.display = open ? 'none' : 'block';
  if (btn) btn.style.display = open ? '' : 'none';
}

function saveKpiRunRateLog(planId, categoryId) {
  var plans = getKpiQuarterPlans();
  var plan = plans.filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  var kindEl = document.getElementById('kpi_rr_kind');
  var dateEl = document.getElementById('kpi_rr_date');
  var amountEl = document.getElementById('kpi_rr_amount');
  var itemEl = document.getElementById('kpi_rr_item');
  var noteEl = document.getElementById('kpi_rr_note');
  var kind = kindEl ? kindEl.value : 'revenue';
  var amount = amountEl ? Number(amountEl.value) : 0;
  if (!amount || amount <= 0) { toast(kind === 'qty' ? '⚠️ กรอกจำนวนก่อน' : '⚠️ กรอกจำนวนเงินก่อน'); return; }
  var date = (dateEl && dateEl.value) ? dateEl.value : _td();

  var pipeIdEl = document.getElementById('kpi_rr_pipeid');

  var logs = getKpiRunRateLogs();
  logs.push({
    id: 'kpirr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    salesMemberName: plan.salesMemberName, date: date, amount: amount, kind: kind,
    item: itemEl ? itemEl.value.trim() : '', note: noteEl ? noteEl.value.trim() : '',
    pipeId: (pipeIdEl && pipeIdEl.value) ? pipeIdEl.value : null,
    createdAt: new Date().toISOString()
  });
  saveKpiRunRateLogs(logs);
  toast('💾 บันทึก Run Rate แล้ว');
  showKpiDetailM(planId, categoryId);
}

// ================================================================
// ➕ เพิ่มโครงการที่มีอยู่แล้วเข้า KPI นี้เอง — เลือกจากทุกโครงการ ทุกช่วงเวลา กรองสถานะ/เดือนได้ เหมือนหา
// โครงการในเมนู Pipeline (เปลี่ยนจากช่องค้นหาเล็กๆ ในฟอร์ม Run Rate เดิม มาเป็น picker เต็มรูปแบบ 2026-08-27)
// เลือกแล้ว auto-fill ยอด/จำนวนจากข้อมูลจริงของโครงการ เก็บ pipeId ไว้กัน _kpiRunRateAutoCovered() นับซ้ำ
// ================================================================
var _kpiApStatusSel = null;
var _kpiApMonthSel = {}; // multi-select: {monthIdx(0-11): true} — ว่าง = ทุกเดือน แปลงจาก _kpiApMonth (single
// YYYY-MM) เดิม ให้เป็นแบบเดียวกับ Pipeline หลัก/Dealer/Pipeline รวมทีม เพื่อใส่ปุ่มลัด H1/H2/Q1-4 ได้ (ผู้ใช้ขอ
// 2026-09-02) — ไม่ยึดปีอีกต่อไป เข้ากับ modal นี้ที่ตั้งใจค้นได้ "ทุกช่วงเวลา" อยู่แล้ว
var _kpiApSearch = '';
var _kpiApDealerId = ''; // กรองตาม Dealer เพิ่ม (ผู้ใช้ขอ 2026-08-27) — '' = ทุก Dealer
var _kpiApSalesName = ''; // กรองตามชื่อเซล (saleName บนโครงการ) — '' = ทุกเซล (ผู้ใช้ขอ 2026-09-01)
var _kpiApAmountMin = ''; var _kpiApAmountMax = ''; // กรองช่วงยอด Forecast — '' = ไม่จำกัด (ผู้ใช้ขอ 2026-09-01)
var _kpiApExpanded = {}; // pipeId -> true ถ้ากดขยายดูรายละเอียดสินค้าอยู่ — เก็บไว้กันยุบตอน re-render จาก filter อื่น
var _kpiApDockOnly = false; // ติ๊กแล้วโชว์เฉพาะโครงการที่มี Dock (ใช้เกณฑ์เดียวกับคอลัมน์ "Dock" ตอน export —
// g.dock || g.dock3 จาก _pipeModelQtyByGroup) ช่วยหาโครงการมาเพิ่มเข้าหมวด Dock (dock3) ได้ง่ายขึ้น (ผู้ใช้ขอ 2026-08-27)
var _kpiApPicking = null; // {pipeId} ระหว่างเปิดฟอร์มยืนยันยอด/วันที่ก่อนบันทึกจริง (ผู้ใช้ขอ 2026-09-01) — null = ยังไม่ได้กด "+ เลือก"

function _kpiApDefaultStatusSel() {
  var cfg = getConfig();
  var sel = {};
  (cfg.pipelineStatuses || []).forEach(function(s) { sel[s.id] = true; });
  return sel;
}

var _kpiApPresetDate = null; // เดือนที่กดมาจาก showKpiMonthDetailM() (ถ้ามี) — ใช้ตั้งค่าเริ่มต้นของวันที่ใน
// ฟอร์มยืนยันแทนวันนี้เสมอ (ผู้ใช้ขอ 2026-09-01 ให้เพิ่ม/แก้ข้อมูลเดือนก่อนหน้าง่ายขึ้น)
function showKpiAddProjectM(planId, categoryId, presetDate) {
  _kpiApStatusSel = _kpiApDefaultStatusSel();
  _kpiApMonthSel = {};
  _kpiApSearch = '';
  _kpiApDealerId = '';
  _kpiApSalesName = '';
  _kpiApAmountMin = '';
  _kpiApAmountMax = '';
  _kpiApExpanded = {};
  _kpiApDockOnly = false;
  _kpiApPicking = null;
  _kpiApPresetDate = presetDate || null;
  _kpiApRenderModal(planId, categoryId);
  if (typeof setMWide === 'function') setMWide(1100);
}

function _kpiApHasDock(p) {
  var g = (typeof _pipeModelQtyByGroup === 'function') ? _pipeModelQtyByGroup(getPipeItems(p) || []) : null;
  return !!(g && (g.dock || g.dock3));
}

function _kpiApFilteredProjects() {
  var q = (_kpiApSearch || '').trim().toLowerCase();
  var amtMin = _kpiApAmountMin !== '' ? Number(_kpiApAmountMin) : null;
  var amtMax = _kpiApAmountMax !== '' ? Number(_kpiApAmountMax) : null;
  return ST.getAll('pipeline').filter(function(p) {
    if (_kpiApStatusSel && _kpiApStatusSel[p.status] === false) return false;
    if (Object.keys(_kpiApMonthSel).length) {
      var _apM = (typeof _pipeMonthOf === 'function') ? _pipeMonthOf(p, typeof pipeMonthSource !== 'undefined' ? pipeMonthSource : 'biddingDate') : null;
      if (_apM === null || !_kpiApMonthSel[_apM]) return false;
    }
    if (_kpiApDealerId && p.dealerId !== _kpiApDealerId) return false;
    if (_kpiApSalesName && (p.saleName || '') !== _kpiApSalesName) return false;
    if (amtMin !== null && (Number(p.forecastAmount) || 0) < amtMin) return false;
    if (amtMax !== null && (Number(p.forecastAmount) || 0) > amtMax) return false;
    if (_kpiApDockOnly && !_kpiApHasDock(p)) return false;
    if (q) {
      var dl = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
      var hay = ((p.projectName || '') + ' ' + (dl ? dl.name : '') + ' ' + (p.rowNo || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }).sort(function(a, b) { return (b.registerDate || '').localeCompare(a.registerDate || ''); });
}

// รายละเอียดสินค้า (model x qty) ของโครงการ — โชว์ตอนกดขยายแถว กันต้องกด "+ เลือก" มั่วๆ ทั้งที่ยังไม่รู้ว่าใน
// โครงการนั้นมีสินค้าอะไรบ้าง (ผู้ใช้ขอ 2026-08-27 ให้ดูรายละเอียดสินค้าได้ก่อนเลือก)
function _kpiApDetailHtml(p) {
  var items = getPipeItems(p) || [];
  var rows = items.length
    ? items.map(function(it) { return '<div style="display:flex;justify-content:space-between;gap:8px"><span>' + sanitize(it.model || '-') + '</span><span style="color:var(--text2)">x' + (Number(it.qty) || 1) + '</span></div>'; }).join('')
    : '<div style="color:var(--text2)">ไม่มีรายการสินค้า</div>';
  return '<div style="font-size:.72rem;background:var(--bg2);border-radius:6px;padding:8px 10px;margin:2px 0 4px">' +
    rows +
    '<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:2px;color:var(--text2)">' +
    (p.endUserTH ? '<div>👤 ' + sanitize(p.endUserTH) + '</div>' : '') +
    (p.tor ? '<div>📄 TOR: ' + sanitize(p.tor) + '</div>' : '') +
    (p.biddingDate ? '<div>📅 Bidding Date: ' + fD(p.biddingDate) + '</div>' : '') +
    '</div></div>';
}

function _kpiApListHtml(planId, categoryId) {
  var list = _kpiApFilteredProjects().slice(0, 100);
  if (!list.length) return '<div style="text-align:center;color:var(--text2);padding:16px;font-size:.78rem">ไม่พบโครงการที่ตรงกับตัวกรอง</div>';
  return list.map(function(p) {
    var dl = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    var expanded = !!_kpiApExpanded[p.id];
    return '<div>' +
      '<div class="kpi-detail-row" style="display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:default">' +
      '<span style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;overflow:hidden">' +
      '<button class="btn bsm bo" style="flex-shrink:0;padding:1px 7px" onclick="_kpiApToggleExpand(\'' + planId + '\',\'' + categoryId + '\',\'' + p.id + '\')" title="ดูรายละเอียดสินค้า">' + (expanded ? '▲' : '▼') + '</button>' +
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
      (p.rowNo ? '<span style="color:var(--text2)">#' + sanitize(String(p.rowNo)) + '</span> ' : '') + sanitize(p.projectName || (dl ? dl.name : '') || '-') +
      (dl ? ' <span style="color:var(--text2)">— ' + sanitize(dl.name) + '</span>' : '') +
      ' <span style="color:var(--text2)">' + fmtMoneyShort(p.forecastAmount) + '</span> ' +
      (typeof pipeTag === 'function' ? pipeTag(p.status) : '') + '</span></span>' +
      '<button class="btn bp bsm" style="flex-shrink:0" onclick="_kpiApOpenPickForm(\'' + planId + '\',\'' + categoryId + '\',\'' + p.id + '\')">+ เลือก</button></div>' +
      (expanded ? _kpiApDetailHtml(p) : '') +
      '</div>';
  }).join('');
}

function _kpiApSearchInput(planId, categoryId, val) {
  _kpiApSearch = val;
  var listEl = document.getElementById('kpi_ap_list');
  if (listEl) listEl.innerHTML = _kpiApListHtml(planId, categoryId);
}

function _kpiApToggleStatus(planId, categoryId, id, checked) {
  _kpiApStatusSel[id] = checked;
  _kpiApRenderModal(planId, categoryId);
}

// ปุ่มลัด Active/จบแล้ว — ใช้ helper เดียวกับ Pipeline หลัก (ผู้ใช้ขอ 2026-09-02)
// สำคัญ: _kpiApFilteredProjects() เช็ค "=== false" เท่านั้นถึงจะตัดออก (ค่าเริ่มต้น _kpiApDefaultStatusSel()
// ติ๊กทุกสถานะเป็น true หมด = ไม่กรองอะไรเลย) ปุ่มลัดนี้เลยต้องตั้งสถานะที่ไม่ได้เลือกเป็น false ชัดเจน ไม่ใช่แค่
// ปล่อยว่าง ไม่งั้นจะไม่กรองอะไรออกเลยเหมือนเดิม
function _kpiApSetStatusShortcut(planId, categoryId, kind) {
  var allIds = (getConfig().pipelineStatuses || []).map(function(s) { return s.id; });
  var keepIds = kind === 'active' ? _pipeStatusIdsByCategoryOrFallback('active')
    : kind === 'closed' ? _pipeStatusIdsByCategoryOrFallback('won').concat(_pipeStatusIdsByCategoryOrFallback('lost'))
    : allIds; // 'all'
  _kpiApStatusSel = {};
  allIds.forEach(function(id) { _kpiApStatusSel[id] = keepIds.indexOf(id) !== -1; });
  _kpiApRenderModal(planId, categoryId);
}

function _kpiApToggleMonth(planId, categoryId, idx) {
  if (_kpiApMonthSel[idx]) delete _kpiApMonthSel[idx]; else _kpiApMonthSel[idx] = true;
  _kpiApRenderModal(planId, categoryId);
}
function _kpiApSetMonthShortcut(planId, categoryId, kind) {
  _kpiApMonthSel = {};
  (PIPE_MONTH_SHORTCUT_RANGES[kind] || []).forEach(function(m) { _kpiApMonthSel[m] = true; });
  _kpiApRenderModal(planId, categoryId);
}
function _kpiApClearMonth(planId, categoryId) {
  _kpiApMonthSel = {};
  _kpiApRenderModal(planId, categoryId);
}

function _kpiApSetDealer(planId, categoryId, val) {
  _kpiApDealerId = val;
  var listEl = document.getElementById('kpi_ap_list');
  if (listEl) listEl.innerHTML = _kpiApListHtml(planId, categoryId);
}

function _kpiApToggleDockOnly(planId, categoryId, checked) {
  _kpiApDockOnly = checked;
  var listEl = document.getElementById('kpi_ap_list');
  if (listEl) listEl.innerHTML = _kpiApListHtml(planId, categoryId);
}

function _kpiApSetSales(planId, categoryId, val) {
  _kpiApSalesName = val;
  var listEl = document.getElementById('kpi_ap_list');
  if (listEl) listEl.innerHTML = _kpiApListHtml(planId, categoryId);
}

function _kpiApSetAmount(planId, categoryId, which, val) {
  if (which === 'min') _kpiApAmountMin = val; else _kpiApAmountMax = val;
  var listEl = document.getElementById('kpi_ap_list');
  if (listEl) listEl.innerHTML = _kpiApListHtml(planId, categoryId);
}

function _kpiApToggleExpand(planId, categoryId, pipeId) {
  _kpiApExpanded[pipeId] = !_kpiApExpanded[pipeId];
  var listEl = document.getElementById('kpi_ap_list');
  if (listEl) listEl.innerHTML = _kpiApListHtml(planId, categoryId);
}

function _kpiApRenderModal(planId, categoryId) {
  var cfg = getConfig();
  var dealers = ST.getAll('dealers').slice().sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  var salesNames = [];
  ST.getAll('pipeline').forEach(function(p) { if (p.saleName && salesNames.indexOf(p.saleName) === -1) salesNames.push(p.saleName); });
  salesNames.sort();
  var h = '<p style="font-size:.72rem;color:var(--text3);margin-bottom:8px">เลือกโครงการที่มีอยู่แล้วมานับเข้า KPI นี้เอง (เผื่อยอดยังไม่ขึ้นอัตโนมัติ) — ค้นได้จากทุกช่วงเวลา ทุกโครงการ</p>';
  h += '<input type="text" placeholder="🔍 ค้นหาชื่อโครงการ / Dealer / Row No..." value="' + sanitize(_kpiApSearch) + '" oninput="_kpiApSearchInput(\'' + planId + '\',\'' + categoryId + '\',this.value)" style="margin-bottom:8px">';
  h += '<div style="margin-bottom:8px"><div style="font-size:.7rem;font-weight:700;margin-bottom:4px">กรองตามสถานะ</div>';
  h += '<div style="display:flex;gap:6px;margin-bottom:6px">' +
    '<button class="btn bsm bo" onclick="_kpiApSetStatusShortcut(\'' + planId + '\',\'' + categoryId + '\',\'active\')">🟢 Active</button>' +
    '<button class="btn bsm bo" onclick="_kpiApSetStatusShortcut(\'' + planId + '\',\'' + categoryId + '\',\'closed\')">🏁 จบแล้ว</button>' +
    '<button class="btn bsm bo" onclick="_kpiApSetStatusShortcut(\'' + planId + '\',\'' + categoryId + '\',\'all\')">ทั้งหมด</button>' +
    '</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:5px">';
  (cfg.pipelineStatuses || []).forEach(function(s) {
    h += '<label style="display:flex;align-items:center;gap:4px;font-size:.68rem;background:var(--bg2);padding:3px 8px;border-radius:12px;cursor:pointer">' +
      '<input type="checkbox" style="width:auto" ' + (_kpiApStatusSel[s.id] ? 'checked' : '') + ' onchange="_kpiApToggleStatus(\'' + planId + '\',\'' + categoryId + '\',\'' + s.id + '\',this.checked)">' + sanitize(s.name) + '</label>';
  });
  h += '</div></div>';
  h += '<div style="margin-bottom:8px">';
  h += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:5px"><span style="font-size:.7rem;font-weight:700">📅 กรองตามเดือน</span>' + _pipeMonthSourceSelectHtml() + '</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">';
  ['H1', 'H2', 'Q1', 'Q2', 'Q3', 'Q4'].forEach(function(k) {
    h += '<button class="btn bsm bo" onclick="_kpiApSetMonthShortcut(\'' + planId + '\',\'' + categoryId + '\',\'' + k.toLowerCase() + '\')">' + k + '</button>';
  });
  h += '</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">';
  ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'].forEach(function(mn, idx) {
    var on = !!_kpiApMonthSel[idx];
    h += '<span onclick="_kpiApToggleMonth(\'' + planId + '\',\'' + categoryId + '\',' + idx + ')" style="cursor:pointer;font-size:.68rem;padding:3px 8px;border-radius:12px;' +
      (on ? 'background:var(--accent);color:#fff' : 'background:var(--bg2);border:1px solid var(--border);color:var(--text2)') + '">' + mn + '</span>';
  });
  if (Object.keys(_kpiApMonthSel).length) h += '<button class="btn bsm bo" onclick="_kpiApClearMonth(\'' + planId + '\',\'' + categoryId + '\')">✕ ล้าง</button>';
  h += '</div></div>';
  h += '<div style="margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  h += '<span style="display:flex;align-items:center;gap:6px"><label style="font-size:.7rem">Dealer</label>' +
    '<select onchange="_kpiApSetDealer(\'' + planId + '\',\'' + categoryId + '\',this.value)" style="width:auto;max-width:220px">' +
    '<option value="">ทุก Dealer</option>' +
    dealers.map(function(d) { return '<option value="' + sanitize(d.id) + '"' + (_kpiApDealerId === d.id ? ' selected' : '') + '>' + sanitize(d.name) + '</option>'; }).join('') +
    '</select></span>';
  h += '<span style="display:flex;align-items:center;gap:6px"><label style="font-size:.7rem">Sales</label>' +
    '<select onchange="_kpiApSetSales(\'' + planId + '\',\'' + categoryId + '\',this.value)" style="width:auto;max-width:180px">' +
    '<option value="">ทุก Sales</option>' +
    salesNames.map(function(n) { return '<option value="' + sanitize(n) + '"' + (_kpiApSalesName === n ? ' selected' : '') + '>' + sanitize(n) + '</option>'; }).join('') +
    '</select></span>';
  h += '<span style="display:flex;align-items:center;gap:6px"><label style="font-size:.7rem">ยอด Forecast</label>' +
    '<input type="number" placeholder="ต่ำสุด" value="' + sanitize(_kpiApAmountMin) + '" oninput="_kpiApSetAmount(\'' + planId + '\',\'' + categoryId + '\',\'min\',this.value)" style="width:100px">' +
    '<span style="color:var(--text3)">–</span>' +
    '<input type="number" placeholder="สูงสุด" value="' + sanitize(_kpiApAmountMax) + '" oninput="_kpiApSetAmount(\'' + planId + '\',\'' + categoryId + '\',\'max\',this.value)" style="width:100px">' +
    '</span>';
  h += '<label style="display:flex;align-items:center;gap:4px;font-size:.7rem;background:var(--bg2);padding:3px 8px;border-radius:12px;cursor:pointer">' +
    '<input type="checkbox" style="width:auto" ' + (_kpiApDockOnly ? 'checked' : '') + ' onchange="_kpiApToggleDockOnly(\'' + planId + '\',\'' + categoryId + '\',this.checked)">🚁 เฉพาะโครงการที่มี Dock</label>';
  h += '</div>';
  h += '<div id="kpi_ap_list" style="max-height:480px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">' + _kpiApListHtml(planId, categoryId) + '</div>';
  h += '<div id="kpi_ap_pickzone"></div>';
  openM('➕ เพิ่มโครงการเข้า KPI นี้', h);
}

// คำนวณยอด/จำนวนเต็มที่ auto-detect ได้จากตัวโครงการเอง (ไม่ผูกกับวันที่/การแบ่งงวดใดๆ)
function _kpiApComputeAuto(cat, p) {
  var kind = cat.type === 'pipelineModelQty' ? 'qty' : 'revenue';
  var item = '', amount = 0;
  if (kind === 'revenue') {
    amount = Number(p.forecastAmount) || 0;
    item = p.projectName || '';
  } else {
    var items = getPipeItems(p) || [];
    var keywords = cat.modelMatch || [];
    // เดิมเจอ keyword แรกที่แมตช์แล้วหยุดทันที (break) — ถ้าโครงการมีทั้ง Dock 3 และ Dock 4 ปนกัน จะนับแค่
    // ตัวแรกตัวเดียว ตัวที่สองหายไปเงียบๆ (ผู้ใช้เจอ 2026-09-01) เปลี่ยนเป็นรวมทุก keyword ที่แมตช์แทน
    var matchedLabels = [];
    keywords.forEach(function(kwRaw) {
      var kw = (kwRaw || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!kw) return;
      var sum = items.reduce(function(s, it) {
        var m = (it.model || '').toLowerCase().replace(/\s+/g, ' ');
        return m.indexOf(kw) !== -1 ? s + (Number(it.qty) || 0) : s;
      }, 0);
      if (sum > 0) { amount += sum; matchedLabels.push(kwRaw); }
    });
    item = matchedLabels.length ? matchedLabels.join(', ') : (keywords[0] || '');
  }
  return { kind: kind, item: item, amount: amount };
}

// เปิดฟอร์มยืนยันยอด/วันที่ก่อนบันทึกจริง (ผู้ใช้ขอ 2026-09-01) — เดิมกด "+ เลือก" แล้วบันทึกยอดเต็มทันที
// ตอนนี้ต้องมายืนยัน/แก้ยอดก่อน เพื่อรองรับกรณีส่งมอบแบ่งงวด (ไม่เต็มยอดโครงการในไตรมาสเดียว) และให้เลือกวันที่
// ย้อนหลังในไตรมาสนี้ได้ด้วย (แทนที่จะ fix เป็นวันนี้เสมอ)
function _kpiApOpenPickForm(planId, categoryId, pipeId) {
  var plan = getKpiQuarterPlans().filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  var cat = plan.categories.filter(function(c) { return c.id === categoryId; })[0];
  if (!cat) return;
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  var auto = _kpiApComputeAuto(cat, p);
  // เดิม auto.amount = 0 แล้วเด้ง toast บล็อกไปเลย เลือกโครงการนี้ต่อไม่ได้แม้จะเห็นว่ามีสินค้าที่ต้องการอยู่จริง
  // (คำในชื่อโมเดลไม่ตรงกับ modelMatch ของหัวข้อนี้เป๊ะ) ผู้ใช้เจอ 2026-09-01 — เปลี่ยนเป็นเปิดฟอร์มต่อได้เสมอ
  // ให้กรอกจำนวนเองแทน พร้อมโชว์รายชื่อสินค้าจริงในโครงการเทียบกับคำค้นที่ตั้งไว้ให้เห็นว่าทำไมไม่ auto-match
  _kpiApPicking = { pipeId: pipeId };
  var isQty = auto.kind === 'qty';
  var originDate = pipeIsWon(p) ? pipeResolvedCloseDate(p).date : null;
  var originInThisQuarter = originDate && originDate >= plan.startDate && originDate <= plan.endDate;

  var h = '<div style="margin-top:10px;padding:12px;border:1.5px solid var(--accent,#4f6bf0);border-radius:10px;background:var(--bg2)">';
  h += '<div style="font-weight:700;font-size:.8rem;margin-bottom:6px">✅ ' + sanitize(p.projectName || '-') + '</div>';
  if (isQty && !auto.amount) {
    var actualModels = (getPipeItems(p) || []).map(function(it) { return sanitize(it.model || '-') + ' x' + (Number(it.qty) || 1); }).join(', ') || '-';
    // แยกข้อความ 2 แบบ — ถ้าหัวข้อนี้ไม่มีคำค้น (modelMatch ว่าง) เลยไม่มีอะไรให้ match ตั้งแต่ต้น ต่างจากกรณี
    // มีคำค้นแต่ข้อความสินค้าไม่ตรง (เดิม 2 เคสนี้ขึ้นข้อความเดียวกัน ทำให้ตอน modelMatch ว่างขึ้น "()" งงๆ)
    var mmList = cat.modelMatch || [];
    var mmMsg = mmList.length
      ? 'ไม่พบสินค้าที่ตรงกับคำค้นของหัวข้อนี้ (' + sanitize(mmList.join(', ')) + ') ในโครงการนี้ — สินค้าที่มีจริง: ' + actualModels
      : 'หัวข้อนี้ยังไม่ได้ตั้งคำค้นสินค้า (modelMatch) เลย — ไปตั้งค่าที่ "⚙️ ตั้งค่าไตรมาสนี้" ก่อน หรือกรอกจำนวนเองด้านล่างไปพลางๆ ก่อนได้';
    h += '<div style="font-size:.68rem;color:#e08a2c;background:var(--bg);border-radius:6px;padding:6px 8px;margin-bottom:8px">⚠️ ' + mmMsg + ' — กรอกจำนวนเองด้านล่างได้เลย</div>';
  }
  if (originDate && !originInThisQuarter) {
    h += '<div style="font-size:.68rem;color:var(--text2);background:var(--bg);border-radius:6px;padding:6px 8px;margin-bottom:8px">' +
      'ℹ️ โครงการนี้ Win แล้ว ระบบนับยอดเต็ม (' + (isQty ? auto.amount : fmtMoney(auto.amount)) + ') เข้าไตรมาสที่ปิดดีลจริง (' + fD(originDate) + ') อัตโนมัติอยู่แล้ว — ยอดที่ใส่ด้านล่างจะถูกหักออกจากไตรมาสนั้นให้อัตโนมัติเท่ากับที่ย้ายมานับที่นี่ ป้องกันนับซ้ำ</div>';
  }
  // เดิม pre-fill เป็น "0" ตรงๆ ตอน auto.amount=0 (กรณีไม่ auto-match) — ดูเหมือนกรอกไว้แล้วจริงๆ ผู้ใช้กด
  // ยืนยันโดยไม่ทันสังเกตว่ายังเป็น 0 อยู่ แล้วโดนเงื่อนไข "amount<=0" บล็อกเงียบๆ (แค่ toast เตือนแวบเดียว) —
  // ดูเหมือนกด "บันทึก" แล้วไม่มีอะไรเกิดขึ้นเลย (ผู้ใช้เจอ 2026-09-02) ปล่อยว่างแทนพร้อม placeholder ให้ชัดว่า
  // ต้องกรอกเอง
  h += '<div class="fg"><label>' + (isQty ? 'จำนวน (หน่วย)' : 'ยอดเงิน (บาท)') + ' ที่จะนับเข้าไตรมาสนี้</label>' +
    '<input type="number" id="kpi_ap_pick_amount"' + (auto.amount ? ' value="' + auto.amount + '"' : ' placeholder="พิมพ์จำนวนที่จะนับ" style="border-color:#e08a2c"') + '></div>';
  h += '<div class="fg"><label>วันที่จะนับเข้า KPI</label><input type="date" id="kpi_ap_pick_date" value="' + (_kpiApPresetDate || _td()) + '"></div>';
  h += '<div style="display:flex;gap:6px"><button class="btn bp" style="flex:1" onclick="_kpiApConfirmPick(\'' + planId + '\',\'' + categoryId + '\',\'' + pipeId + '\')">💾 ยืนยันบันทึก</button>' +
    '<button class="btn bo" style="flex:1" onclick="_kpiApCancelPick(\'' + planId + '\',\'' + categoryId + '\')">ยกเลิก</button></div>';
  h += '</div>';
  var zone = document.getElementById('kpi_ap_pickzone');
  if (zone) { zone.innerHTML = h; zone.scrollIntoView({ behavior: 'smooth', block: 'end' }); }
}

function _kpiApCancelPick(planId, categoryId) {
  _kpiApPicking = null;
  var zone = document.getElementById('kpi_ap_pickzone');
  if (zone) zone.innerHTML = '';
}

function _kpiApConfirmPick(planId, categoryId, pipeId) {
  var plan = getKpiQuarterPlans().filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  var cat = plan.categories.filter(function(c) { return c.id === categoryId; })[0];
  if (!cat) return;
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  var auto = _kpiApComputeAuto(cat, p);
  var amountEl = document.getElementById('kpi_ap_pick_amount');
  var dateEl = document.getElementById('kpi_ap_pick_date');
  var amount = amountEl ? Number(amountEl.value) : auto.amount;
  var date = (dateEl && dateEl.value) ? dateEl.value : _td();
  if (!amount || amount <= 0) { toast(auto.kind === 'qty' ? '⚠️ กรอกจำนวนก่อน' : '⚠️ กรอกจำนวนเงินก่อน'); return; }

  var logs = getKpiRunRateLogs();
  logs.push({
    id: 'kpirr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    salesMemberName: plan.salesMemberName, date: date, amount: amount, kind: auto.kind,
    item: auto.item, note: '', pipeId: pipeId, createdAt: new Date().toISOString()
  });
  var msg = '➕ เพิ่มโครงการเข้า KPI แล้ว';

  // แบ่งงวด/ย้ายไตรมาส (ผู้ใช้ขอ 2026-09-01): ถ้าไตรมาสที่ปิดดีลจริง (origin) ไม่ใช่ไตรมาสที่กำลังบันทึกอยู่นี้
  // แปลว่ายอดเต็มของโครงการนี้ auto-detect ไปนับที่ไตรมาส origin อยู่แล้ว (ทั้งก้อนเสมอ ไม่ว่าจะย้ายมาบางส่วน
  // หรือทั้งหมด) — ต้องหักยอดที่ย้ายมานับที่นี่ออกจากไตรมาส origin ให้เท่ากันเป๊ะ (ไม่ใช่หักส่วนต่าง) ไม่งั้นยอดรวม
  // ข้ามไตรมาสจะเกินยอดจริงของโครงการ — ใส่ splitAdjustment:true ให้ _kpiRunRateAutoCovered() ไม่ข้ามนับ log นี้
  var originDate = pipeIsWon(p) ? pipeResolvedCloseDate(p).date : null;
  var originInThisQuarter = originDate && originDate >= plan.startDate && originDate <= plan.endDate;
  // หักปรับเฉพาะตอนที่ auto-detect เจอยอดจริง (auto.amount > 0) เท่านั้น — ถ้าไม่เจอ (เช่นชื่อสินค้าไม่ตรงกับ
  // modelMatch เป๊ะ ตามที่แก้ไว้ให้กรอกเองได้แล้ว) แปลว่าไตรมาส origin ไม่เคยถูกนับอัตโนมัติจากโครงการนี้เลย
  // ไม่มีอะไรให้หัก ถ้าหักไปจะทำให้ไตรมาส origin ติดลบผิดๆ (ผู้ใช้เจอ 2026-09-01 หลังแก้ให้กรอกเองได้)
  var crossQuarterMove = !!(originDate && !originInThisQuarter && auto.amount > 0);
  if (crossQuarterMove) {
    logs.push({
      id: 'kpirr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5) + 'adj',
      salesMemberName: plan.salesMemberName, date: originDate, amount: -amount, kind: auto.kind,
      item: auto.item, note: '🔀 หักปรับยอด — ย้ายมานับไตรมาสอื่นแทน', pipeId: pipeId,
      splitAdjustment: true, createdAt: new Date().toISOString()
    });
    msg = '➕ เพิ่มเข้า KPI แล้ว (หักยอดที่ย้ายมาออกจากไตรมาสต้นทางให้แล้ว)';
  }

  // เลือกโครงการเข้าหมวด Dock (dock3) แล้ว — ลิงก์บันทึกเข้าหมวด "ยอดขาย DJI Product" (id 'revenue') ของแผน
  // เดียวกันให้ด้วยเลย ถ้ามีหมวดนี้อยู่ในแผน (ผู้ใช้ขอ 2026-08-27 เพราะโครงการที่ auto-detect Dock พลาด มักจะ
  // พลาดนับยอดขาย Product ไปด้วยเหตุผลเดียวกัน) กันนับซ้ำถ้าเคย pick โครงการนี้เข้าหมวด revenue ไปแล้วก่อนหน้า
  // ข้ามลิงก์อัตโนมัตินี้ถ้ากำลังย้ายไตรมาส/แบ่งงวดอยู่ เพราะยอด revenue เต็มของ origin ไม่ตรงกับส่วนที่ย้ายมา
  if (categoryId === 'dock3' && !crossQuarterMove) {
    var revCat = plan.categories.filter(function(c) { return c.id === 'revenue'; })[0];
    var alreadyLinked = logs.some(function(l) { return l.pipeId === pipeId && l.kind === 'revenue' && l.salesMemberName === plan.salesMemberName; });
    if (revCat && !alreadyLinked) {
      var revAmount = Number(p.forecastAmount) || 0;
      if (revAmount > 0) {
        logs.push({
          id: 'kpirr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5) + 'r',
          salesMemberName: plan.salesMemberName, date: date, amount: revAmount, kind: 'revenue',
          item: p.projectName || '', note: '🔗 ลิงก์อัตโนมัติจากการเพิ่มเข้าหมวด Dock', pipeId: pipeId, createdAt: new Date().toISOString()
        });
        msg = '➕ เพิ่มเข้า KPI Dock + ยอดขาย DJI Product แล้ว';
      }
    }
  }
  saveKpiRunRateLogs(logs);
  toast(msg);
  _kpiApPicking = null;
  showKpiDetailM(planId, categoryId);
}

// ================================================================
// เพิ่ม Dealer เข้า KPI "Dealer ใหม่ Authorized" เอง — เผื่อยอดยังไม่ขึ้นอัตโนมัติ
// (เช่น Authorize ผ่านช่องทางอื่นมาก่อนหน้านี้ หรืออยากผูกเข้าควอเตอร์นี้ตรงๆ)
// ================================================================
var _kpiAdSearch = '';
function showKpiAddDealerAuthorizedM(planId, categoryId) {
  _kpiAdSearch = '';
  _kpiAdRenderModal(planId, categoryId);
}
function _kpiAdFilteredDealers() {
  var q = (_kpiAdSearch || '').trim().toLowerCase();
  return ST.getAll('dealers').filter(function(d) {
    if (!q) return true;
    return (d.name || '').toLowerCase().indexOf(q) !== -1;
  }).sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
}
function _kpiAdListHtml(planId, categoryId) {
  var list = _kpiAdFilteredDealers().slice(0, 100);
  if (!list.length) return '<div style="text-align:center;color:var(--text2);padding:16px;font-size:.78rem">ไม่พบ Dealer</div>';
  return list.map(function(d) {
    return '<div class="kpi-detail-row" style="display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:default">' +
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">' + sanitize(d.name) +
      (d.authorizedDate ? ' <span style="color:var(--text2)">— Authorized แล้ว ' + fD(d.authorizedDate) + (d.authorizedBy ? ' โดย ' + sanitize(d.authorizedBy) : '') + '</span>' : ' <span style="color:var(--text3)">— ยังไม่ Authorize</span>') + '</span>' +
      '<button class="btn bp bsm" style="flex-shrink:0" onclick="_kpiAdPick(\'' + planId + '\',\'' + categoryId + '\',\'' + d.id + '\')">+ เลือก</button></div>';
  }).join('');
}
function _kpiAdSearchInput(planId, categoryId, val) {
  _kpiAdSearch = val;
  var listEl = document.getElementById('kpi_ad_list');
  if (listEl) listEl.innerHTML = _kpiAdListHtml(planId, categoryId);
}
function _kpiAdRenderModal(planId, categoryId) {
  var h = '<p style="font-size:.72rem;color:var(--text3);margin-bottom:8px">เลือก Dealer มานับเข้า KPI นี้เอง — ใช้เวลายอดยังไม่ขึ้นอัตโนมัติ</p>';
  h += '<div class="fg"><label>วันที่นับเข้า KPI (ควอเตอร์นี้)</label><input type="date" id="kpi_ad_date" value="' + _td() + '"></div>';
  h += '<input type="text" placeholder="🔍 ค้นหาชื่อ Dealer..." value="' + sanitize(_kpiAdSearch) + '" oninput="_kpiAdSearchInput(\'' + planId + '\',\'' + categoryId + '\',this.value)" style="margin-bottom:8px">';
  h += '<div id="kpi_ad_list" style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">' + _kpiAdListHtml(planId, categoryId) + '</div>';
  openM('➕ เพิ่ม Dealer เข้า KPI นี้', h);
}
function _kpiAdPick(planId, categoryId, dealerId) {
  var plan = getKpiQuarterPlans().filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  var dateEl = document.getElementById('kpi_ad_date');
  var chosenDate = (dateEl && dateEl.value) ? dateEl.value : _td();
  if (d.authorizedDate && !confirm('"' + d.name + '" มีวันที่ Authorize อยู่แล้ว (' + fD(d.authorizedDate) + (d.authorizedBy ? ' โดย ' + d.authorizedBy : '') + ') — จะทับเป็นวันที่ ' + fD(chosenDate) + ' และนับเข้า KPI ของ ' + plan.salesMemberName + ' แทนใช่ไหม?')) return;
  var updates = { authorizedDate: chosenDate, authorizedBy: plan.salesMemberName };
  if (d.level === 'Other' || !d.level) updates.level = 'B';
  ST.update('dealers', dealerId, updates);
  if (typeof syncDealerToFirebase === 'function') syncDealerToFirebase(dealerId);
  _kpiInvalidateCache(); // _kpiDealers() แคช ST.getAll('dealers') ไว้ — ต้องล้างไม่งั้นตัวเลข KPI ที่รีเฟรชโมดัลจะยังเป็นค่าเก่า
  toast('➕ เพิ่ม ' + d.name + ' เข้า KPI แล้ว');
  showKpiDetailM(planId, categoryId);
}

function showEditRunRateM(id, planId, categoryId) {
  var l = getKpiRunRateLogs().filter(function(x) { return x.id === id; })[0];
  if (!l) return;
  var isQty = l.kind === 'qty';
  var itemField;
  if (isQty) {
    var plan = getKpiQuarterPlans().filter(function(p) { return p.id === planId; })[0];
    var cat = plan ? plan.categories.filter(function(c) { return c.id === categoryId; })[0] : null;
    var opts = (cat && cat.modelMatch || []).map(function(k) { return '<option value="' + sanitize(k) + '"' + (k === l.item ? ' selected' : '') + '>' + sanitize(k) + '</option>'; }).join('');
    itemField = '<div class="fg"><label>รุ่นสินค้า</label><select id="kpi_rr_eitem">' + opts + '</select></div>';
  } else {
    itemField = '<div class="fg"><label>สินค้า / รายการ (ไม่บังคับ)</label><input type="text" id="kpi_rr_eitem" value="' + sanitize(l.item || '') + '"></div>';
  }
  openM('✏️ แก้ไข' + (isQty ? 'จำนวน' : 'ยอด') + ' Run Rate',
    '<div class="fg"><label>วันที่</label><input type="date" id="kpi_rr_edate" value="' + sanitize(l.date || '') + '"></div>' +
    '<div class="fg"><label>' + (isQty ? 'จำนวน (หน่วย)' : 'จำนวนเงิน (บาท)') + '</label><input type="number" id="kpi_rr_eamount" value="' + (l.amount || 0) + '"></div>' +
    itemField +
    '<div class="fg"><label>หมายเหตุ (ไม่บังคับ)</label><input type="text" id="kpi_rr_enote" value="' + sanitize(l.note || '') + '"></div>' +
    '<div class="fm-actions">' +
    '<button class="btn bp" onclick="saveEditRunRateLog(\'' + id + '\',\'' + planId + '\',\'' + categoryId + '\')">💾 บันทึก</button>' +
    '<button class="btn bo" onclick="showKpiDetailM(\'' + planId + '\',\'' + categoryId + '\')">ยกเลิก</button>' +
    '</div>'
  );
}

function saveEditRunRateLog(id, planId, categoryId) {
  var logs = getKpiRunRateLogs();
  var l = logs.filter(function(x) { return x.id === id; })[0];
  if (!l) return;
  var amount = Number(document.getElementById('kpi_rr_eamount').value);
  if (!amount || amount <= 0) { toast(l.kind === 'qty' ? '⚠️ กรอกจำนวนก่อน' : '⚠️ กรอกจำนวนเงินก่อน'); return; }
  l.date = document.getElementById('kpi_rr_edate').value || l.date;
  l.amount = amount;
  l.item = document.getElementById('kpi_rr_eitem').value.trim();
  l.note = document.getElementById('kpi_rr_enote').value.trim();
  saveKpiRunRateLogs(logs);
  toast('💾 แก้ไขแล้ว');
  showKpiDetailM(planId, categoryId);
}

function deleteKpiRunRateLog(id, planId, categoryId) {
  if (!confirm('ลบรายการ Run Rate นี้?')) return;
  var logs = getKpiRunRateLogs();
  saveKpiRunRateLogs(logs.filter(function(l) { return l.id !== id; }));
  if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('kpiRunRateLogs', id);
  toast('🗑️ ลบแล้ว');
  showKpiDetailM(planId, categoryId);
}

function kpiAddLog(planId, categoryId) {
  var noteEl = document.getElementById('kpi_log_note');
  var note = noteEl ? noteEl.value.trim() : '';
  if (!note) return;
  var logs = getKpiQuarterLogs();
  logs.push({
    id: 'kpilog_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    planId: planId, categoryId: categoryId, date: new Date().toISOString().split('T')[0],
    note: note, done: false, createdAt: new Date().toISOString()
  });
  saveKpiQuarterLogs(logs);
  showKpiDetailM(planId, categoryId);
}

function kpiToggleLogDone(logId, planId, categoryId) {
  var logs = getKpiQuarterLogs();
  var log = logs.filter(function(l) { return l.id === logId; })[0];
  if (!log) return;
  log.done = !log.done;
  saveKpiQuarterLogs(logs);
  showKpiDetailM(planId, categoryId);
}

// ================================================================
// ตั้งค่าไตรมาส (เป้า/weight/หัวข้อ แก้ได้อิสระทุกไตรมาส)
// ================================================================
function showKpiConfigM(planId) {
  var plans = getKpiQuarterPlans();
  var plan = plans.filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;

  var h = '<div style="display:flex;gap:8px;margin-bottom:10px">';
  h += dpH('kpi_cfg_start', plan.startDate || '', 'เริ่มไตรมาส');
  h += dpH('kpi_cfg_end', plan.endDate || '', 'สิ้นสุดไตรมาส');
  h += '</div>';
  h += '<div style="font-size:11px;color:var(--text2);margin-bottom:10px">แก้ช่วงวันที่ตรงนี้ได้ถ้าตอนสร้างแผนคำนวณไตรมาสผิด (เช่นสร้าง Q3 แต่ได้ มิ.ย.-ส.ค. แทน ก.ค.-ก.ย.) ไม่กระทบหัวข้อ/คะแนนที่ตั้งไว้</div>';
  h += '<div id="kpi_cfg_rows">';
  (plan.categories || []).forEach(function(cat) { h += kpiConfigRowHtml(cat); });
  h += '</div>';
  h += '<button class="btn bsm bo btn-full" style="margin:8px 0" onclick="kpiConfigAddRow()">➕ เพิ่มหัวข้อ KPI</button>';
  h += '<div style="font-size:11px;color:var(--text2);margin-bottom:8px">รวม weight ของทุกหัวข้อควรเท่ากับ 100%</div>';
  h += '<button class="btn bp btn-full" onclick="kpiConfigSave(\'' + planId + '\')">💾 บันทึกการตั้งค่า</button>';

  openM('⚙️ ตั้งค่า KPI ' + sanitize(plan.quarter), h);
}

function kpiConfigRowHtml(cat) {
  cat = cat || { label: '', target: 0, weight: 0, type: 'manualScore' };
  var h = '<div class="kpi-cfg-row" data-cat="' + sanitize(JSON.stringify(cat)) + '">';
  h += '<input type="text" placeholder="ชื่อหัวข้อ" value="' + sanitize(cat.label || '') + '" data-f="label" class="fm-input">';
  h += '<input type="number" placeholder="เป้า" value="' + (cat.target != null ? cat.target : '') + '" data-f="target" class="fm-input">';
  h += '<input type="number" placeholder="weight%" value="' + (cat.weight != null ? cat.weight : '') + '" data-f="weight" class="fm-input">';
  h += '<select data-f="type" class="fm-input">';
  [['pipelineRevenue', 'ยอดขาย Pipeline'], ['pipelineModelQty', 'จำนวนยูนิตตามรุ่น'], ['dealerAuthorized', 'Dealer ใหม่ Authorized'], ['visitCount', 'จำนวน Visit'], ['manualScore', 'กรอกคะแนนเอง']].forEach(function(t) {
    h += '<option value="' + t[0] + '"' + (cat.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
  });
  h += '</select>';
  h += '<button class="btn bsm bd" onclick="this.closest(\'.kpi-cfg-row\').remove()">🗑️</button>';
  h += '</div>';
  return h;
}

function kpiConfigAddRow() {
  var container = document.getElementById('kpi_cfg_rows');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', kpiConfigRowHtml());
}

function kpiConfigSave(planId) {
  var plans = getKpiQuarterPlans();
  var plan = plans.filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  var rows = document.querySelectorAll('#kpi_cfg_rows .kpi-cfg-row');
  var cats = [];
  rows.forEach(function(row) {
    var label = row.querySelector('[data-f=label]').value.trim();
    if (!label) return;
    var target = Number(row.querySelector('[data-f=target]').value) || 0;
    var weight = Number(row.querySelector('[data-f=weight]').value) || 0;
    var type = row.querySelector('[data-f=type]').value;
    var prev = {};
    try { prev = JSON.parse(row.getAttribute('data-cat')); } catch (e) {}
    cats.push({
      id: prev.id || ('cat_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)),
      label: label, icon: prev.icon || '📌', type: type,
      target: target, weight: weight, unit: prev.unit || '',
      modelMatch: prev.modelMatch || [], manualValue: prev.manualValue != null ? prev.manualValue : null
    });
  });
  var newStart = dpG('kpi_cfg_start');
  var newEnd = dpG('kpi_cfg_end');
  if (newStart) plan.startDate = newStart;
  if (newEnd) plan.endDate = newEnd;
  plan.categories = cats;
  plan.updatedAt = new Date().toISOString();
  saveKpiQuarterPlans(plans);
  toast('⚙️ บันทึกการตั้งค่าแล้ว');
  closeMForce();
  render();
}
