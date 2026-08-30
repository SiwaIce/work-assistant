// ================================================================
// 📈 SALES ANALYTICS — ยอดขายจริง (Pipeline: Win/Contracting/Deliver) + Plan vs Actual (Pipeline vs SIS)
// (2026-08-28, แก้ 2026-08-29) เดิมแท็บยอดขายจริงใช้ Sales Order/ยอดขาย SIS เป็นหลัก แต่ใช้งานจริง Sales Order
// แทบไม่มีข้อมูล (ไม่ค่อยได้บันทึก) เลยเปลี่ยนมาใช้ Pipeline สถานะ Win/Contracting/Deliver แทน เพราะเป็น
// เครื่องมือที่ใช้งานทุกวันอยู่แล้ว มีข้อมูลสม่ำเสมอกว่ามาก และมีระดับสินค้าให้แยกได้ (SIS ไม่มี) — แลกมาด้วย
// ตัวเลขเป็น "ยอดที่ปิดแล้วใน Pipeline" ไม่ใช่ยอดตัดบัญชีจริงเป๊ะ ส่วนแท็บ Plan vs Actual ยังคงใช้ Sales
// Order/SIS เป็น Actual เหมือนเดิม (ไม่เปลี่ยน) เพื่อรักษาไว้สำหรับเทียบ gap ระหว่างปิดดีลกับตัดยอดบัญชีจริง
// ================================================================
var saGran = 'year';
var saOffset = { year: 0, quarter: 0, month: 0, week: 0, day: 0 }; // 0 = ช่วงปัจจุบัน, ลบ = ย้อนหลัง
var saTab = 'dealer'; // dealer/sale/product — breakdown ของแท็บยอดขายจริง
var saPage = 'actual'; // actual / plan
var saSaleFilter = 'all';

function saIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// ================================================================
// ช่วงเวลา — สร้างชุดแท่งของแต่ละ granularity (ปี/ไตรมาส/เดือน = เลื่อนทีละปี, สัปดาห์ = เลื่อนทีละเดือน, วัน = เลื่อนทีละสัปดาห์)
// ================================================================
function saPeriodBars(gran, offset) {
  var now = new Date();
  var bars = [];
  if (gran === 'year') {
    var endYear = now.getFullYear() + offset;
    for (var y = endYear - 5; y <= endYear; y++) bars.push({ key: String(y), start: y + '-01-01', end: (y + 1) + '-01-01' });
    return { label: 'ปี ' + (endYear - 5) + '–' + endYear, bars: bars };
  }
  if (gran === 'quarter') {
    var year = now.getFullYear() + offset;
    for (var q = 0; q < 4; q++) {
      var s = new Date(year, q * 3, 1), e = new Date(year, q * 3 + 3, 1);
      bars.push({ key: 'Q' + (q + 1), start: saIso(s), end: saIso(e) });
    }
    return { label: 'ปี ' + year, bars: bars };
  }
  if (gran === 'month') {
    var year2 = now.getFullYear() + offset;
    for (var m = 0; m < 12; m++) {
      var s2 = new Date(year2, m, 1), e2 = new Date(year2, m + 1, 1);
      bars.push({ key: THAI_MONTHS_SHORT[m], start: saIso(s2), end: saIso(e2) });
    }
    return { label: 'ปี ' + year2, bars: bars };
  }
  if (gran === 'week') {
    var base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    var by = base.getFullYear(), bm = base.getMonth();
    var first = new Date(by, bm, 1), last = new Date(by, bm + 1, 0);
    var cur = new Date(first);
    var dow = cur.getDay(); cur.setDate(cur.getDate() + (dow === 0 ? -6 : 1 - dow));
    var wIdx = 1;
    while (cur <= last) {
      var wStart = new Date(cur), wEnd = new Date(cur); wEnd.setDate(wEnd.getDate() + 7);
      bars.push({ key: 'W' + wIdx, start: saIso(wStart), end: saIso(wEnd) });
      wIdx++; cur.setDate(cur.getDate() + 7);
    }
    return { label: THAI_MONTHS_SHORT[bm] + ' ' + by, bars: bars };
  }
  // day
  var day = now.getDay();
  var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7);
  var dayNames = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  for (var i = 0; i < 7; i++) {
    var d3 = new Date(mon); d3.setDate(d3.getDate() + i);
    var e3 = new Date(d3); e3.setDate(e3.getDate() + 1);
    bars.push({ key: dayNames[i], start: saIso(d3), end: saIso(e3) });
  }
  var sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return { label: fD(saIso(mon)) + ' – ' + fD(saIso(sun)), bars: bars };
}

// เดือนที่ [start,end) ครอบคลุมเต็มเดือนพอดี (ไว้ผูก SIS รายเดือน) — week/day ไม่ align เดือนเต็ม จะได้ [] เสมอ (ไม่มี fallback SIS ถูกต้องแล้ว)
function saFullMonthsIn(start, end) {
  var s = new Date(start), e = new Date(end);
  var months = [];
  var cur = new Date(s.getFullYear(), s.getMonth(), 1);
  while (cur < e) {
    var next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    if (cur >= s && next <= e) months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur = next;
  }
  return months;
}

function saDealerSaleMap() {
  var m = {};
  ST.getAll('dealers').forEach(function(d) { m[d.id] = d.saleName || ''; });
  return m;
}
function saOrderTotal(o) { return (o.items || []).reduce(function(s, it) { return s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0); }
function saOrderQty(o) { return (o.items || []).reduce(function(s, it) { return s + (Number(it.qty) || 0); }, 0); }

function saOrdersInRange(start, end, saleFilter) {
  var dsm = saDealerSaleMap();
  return ST.getAll('salesOrders').filter(function(o) {
    var d = (o.createdAt || '').slice(0, 10);
    if (!(d >= start && d < end)) return false;
    if (saleFilter !== 'all' && dsm[o.dealerId] !== saleFilter) return false;
    return true;
  });
}

// ยอดขาย SIS รายเดือน สรุปเข้าช่วง [start,end) — ใช้ได้เฉพาะช่วงที่ align เดือนเต็ม (month/quarter/year) เท่านั้น
// (SIS ไม่มีระดับสัปดาห์/วัน) คืนทั้งยอดรวมและแยกตาม Dealer ไว้ทำ breakdown ต่อ
function saSisRevenueInRange(start, end, saleFilter) {
  var months = saFullMonthsIn(start, end);
  var byDealer = {}, total = 0;
  if (!months.length) return { total: 0, byDealer: byDealer };
  var yearsUsed = {}; months.forEach(function(m) { yearsUsed[m.year] = true; });
  var dsm = saDealerSaleMap();
  ST.getAll('dealers').forEach(function(d) {
    if (saleFilter !== 'all' && dsm[d.id] !== saleFilter) return;
    var sum = 0;
    Object.keys(yearsUsed).forEach(function(y) {
      var rev = getSisRevenueForYear(d, y);
      months.filter(function(m) { return String(m.year) === y; }).forEach(function(m) { sum += Number(rev.monthly[m.month]) || 0; });
    });
    if (sum) { byDealer[d.id] = sum; total += sum; }
  });
  return { total: total, byDealer: byDealer };
}

// ยอดขายจริงของช่วง [start,end) — ใช้ Sales Order เป็นหลักถ้ามีข้อมูลในช่วงนั้น ไม่งั้น fallback ยอดขาย SIS
// (ตัดสินระดับ "ทั้งช่วง" ไม่ผสมสองแหล่งปนกันในช่วงเดียว กันนับซ้ำ/นับขาด)
function saActualForRange(start, end, saleFilter) {
  var orders = saOrdersInRange(start, end, saleFilter);
  if (orders.length) return { source: 'so', total: orders.reduce(function(s, o) { return s + saOrderTotal(o); }, 0), orders: orders };
  var sis = saSisRevenueInRange(start, end, saleFilter);
  return { source: 'sis', total: sis.total, byDealer: sis.byDealer, orders: [] };
}

// วันที่ปิดจริงของโครงการ "won" — ใช้ pipeResolvedCloseDate() (utils.js) ตัวเดียวกับที่ KPI ใช้ ลำดับ 5 ชั้น
// (log ยืนยัน → เดาจาก log → Forecast Month → Shipment Date → Register Date) แทนที่จะคำนวณเองแยกแบบเดิม —
// เดิมหน้านี้กับ KPI ใช้คนละ field กัน (log กับ registerDate) ทำให้ยอด "ปิดแล้ว" ของสองหน้าไม่ตรงกัน (2026-08-29)

// วันที่คาดว่าจะปิด/สั่งซื้อของโครงการที่ยังเปิดอยู่ (Plan) — ลองอ่าน Forecast Month (ที่เซลกรอกเองว่าคาดว่าจะ
// สั่งซื้อเดือนไหน) ก่อน expectedCloseDate เพราะบางโครงการกรอก Forecast Month ไว้แต่ไม่ได้กรอก Expected Close
// Date เป็นวันที่จริง — ไม่มีทั้งคู่ค่อย fallback ไป registerDate (2026-08-29 ตามที่ผู้ใช้พบว่าบางโครงการขึ้นผิดเดือน)
function saForecastMonthDate(p) {
  if (!p.forecastMonth || typeof _kpiParseForecastMonthText !== 'function') return '';
  var info = _kpiParseForecastMonthText(p.forecastMonth);
  if (!info) return '';
  return info.year + '-' + String(info.month).padStart(2, '0') + '-15'; // มีแค่เดือน/ปี ไม่มีวัน ใช้กลางเดือนแทน
}

function saPipelineInRange(category, start, end, saleFilter) {
  var ids = getStatusIdsByCategory(category);
  return ST.getAll('pipeline').filter(function(p) {
    if (ids.indexOf(p.status) === -1) return false;
    if (saleFilter !== 'all' && (p.saleName || '') !== saleFilter) return false;
    var d = category === 'won' ? pipeResolvedCloseDate(p).date : (p.expectedCloseDate || saForecastMonthDate(p) || p.registerDate || (p.created ? p.created.split('T')[0] : ''));
    return d && d >= start && d < end;
  });
}

function saAmt(p) { return Number(p.forecastAmount) || 0; }

// ยอดต่อรายการสินค้าในโครงการเดียว — แจกยอด forecastAmount ของโครงการตามสัดส่วนจำนวนหน่วย (ส่วนใหญ่โครงการไม่ได้
// กรอกราคาต่อหน่วยแยกไว้ มีแต่ยอดรวมทั้งโครงการ) ถ้า item มี .total อยู่แล้วก็ใช้ตรงๆ เลย แม่นกว่า
function saPipeItemRevenue(p) {
  var items = getPipeItems(p) || [];
  if (!items.length) return [];
  var hasExplicitTotal = items.every(function(it) { return it.total != null && it.total !== ''; });
  if (hasExplicitTotal) return items.map(function(it) { return { model: it.model || '-', qty: Number(it.qty) || 1, v: Number(it.total) || 0 }; });
  var totalQty = items.reduce(function(s, it) { return s + (Number(it.qty) || 1); }, 0) || 1;
  var projectTotal = saAmt(p);
  return items.map(function(it) {
    var qty = Number(it.qty) || 1;
    return { model: it.model || '-', qty: qty, v: projectTotal * (qty / totalQty) };
  });
}

// ================================================================
// PAGE ROUTER
// ================================================================
function rSalesAnalytics(el) {
  document.getElementById('pgT').textContent = '📈 Sales Analytics';
  var regCount = cdmRegisterTierCount();
  var h = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
    '<div><h2 style="margin:0">📈 Sales Analytics</h2>' +
    '<p class="hint" style="font-size:.7rem;color:var(--text3);margin:3px 0 0">ยอดขายรวม/แยกสินค้า/แยก Dealer/แยกเซล — เลือกช่วงเวลาได้ตั้งแต่รายปีถึงรายวัน</p></div>' +
    '<button class="btn bsm bo" onclick="showCloseDateManagerM()" title="ดู/แก้วันที่ปิดดีลที่ใช้คำนวณกราฟหน้านี้ — ใช้ร่วมกับหน้า KPI">🧭 จัดการวันที่ปิดดีล' + (regCount ? ' (' + regCount + ')' : '') + '</button>' +
    '</div></div>';

  h += '<div class="sa-pagetabs">' +
    '<button class="sa-pagetab' + (saPage === 'actual' ? ' on' : '') + '" onclick="saSetPage(\'actual\')">💰 ยอดขายจริง</button>' +
    '<button class="sa-pagetab' + (saPage === 'plan' ? ' on' : '') + '" onclick="saSetPage(\'plan\')">🎯 Plan vs Actual</button>' +
    '</div>';

  h += saFilterBarHtml();

  h += '<div id="saPaneBody">' + (saPage === 'actual' ? saActualPaneHtml() : saPlanPaneHtml()) + '</div>';

  el.innerHTML = h;
}

function saSetPage(p) { saPage = p; render(); }
function saSetGran(g) { saGran = g; render(); }
function saShift(delta) { saOffset[saGran] += delta; render(); }
function saSetSale(v) { saSaleFilter = v; render(); }
function saSetTab(t) { saTab = t; render(); }

function saFilterBarHtml() {
  var GRANS = [['year', 'ปี'], ['quarter', 'ไตรมาส'], ['month', 'เดือน'], ['week', 'สัปดาห์'], ['day', 'วัน']];
  var period = saPeriodBars(saGran, saOffset[saGran]);
  var members = (typeof getSalesMembers === 'function' ? getSalesMembers() : []).filter(function(m) { return m.active !== false; });
  return '<div class="card" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
    '<div style="display:flex;gap:4px;background:var(--bg2);border-radius:9px;padding:3px">' +
    GRANS.map(function(g) { return '<button class="btn bsm ' + (saGran === g[0] ? 'bp' : 'bo') + '" style="border:none" onclick="saSetGran(\'' + g[0] + '\')">' + g[1] + '</button>'; }).join('') +
    '</div>' +
    '<select onchange="saSetSale(this.value)" style="font-size:.78rem;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:6px 10px">' +
    '<option value="all">👤 ทุกเซล (ภาพรวมทีม)</option>' +
    members.map(function(m) { return '<option value="' + sanitize(m.name) + '"' + (saSaleFilter === m.name ? ' selected' : '') + '>👤 ' + sanitize(m.name) + '</option>'; }).join('') +
    '</select>' +
    '<div style="display:flex;align-items:center;gap:6px;margin-left:auto">' +
    '<button class="btn bsm bo" onclick="saShift(-1)">◀</button>' +
    '<span style="font-weight:700;font-size:.85rem;min-width:110px;text-align:center">' + period.label + '</span>' +
    '<button class="btn bsm bo" onclick="saShift(1)"' + (saOffset[saGran] >= 0 ? ' disabled' : '') + '>▶</button>' +
    '</div>' +
    '</div>';
}

// ================================================================
// TAB: 💰 ยอดขายจริง — ใช้ Pipeline (Win/Contracting/Deliver) เป็นแหล่งหลัก
// (2026-08-29 เปลี่ยนจาก Sales Order/ยอดขาย SIS ตามคำขอ — Pipeline เป็นเครื่องมือที่ใช้งานจริงทุกวันอยู่แล้ว
// มีข้อมูลสม่ำเสมอกว่า SO มาก และมีระดับสินค้าที่ SIS ไม่มี ข้อแลกเปลี่ยน: เป็นยอดที่ "ปิดแล้วใน Pipeline"
// (ราคาที่เสนอ/รอวางบิล) ไม่ใช่ยอดตัดบัญชีจริงเป๊ะ — อาจมีส่วนต่างจากสินค้า Run Rate/Demo ที่ลูกค้าสั่งเพิ่มเอง
// โดยไม่ได้ลงเป็นโครงการ ดูเทียบกับยอดบัญชีจริง (SIS) ได้ที่แท็บ Plan vs Actual)
// ================================================================
function saActualPaneHtml() {
  var period = saPeriodBars(saGran, saOffset[saGran]);
  var start0 = period.bars[0].start, end0 = period.bars[period.bars.length - 1].end;
  var wholePipes = saPipelineInRange('won', start0, end0, saSaleFilter);
  var wholeTotal = wholePipes.reduce(function(s, p) { return s + saAmt(p); }, 0);
  var avg = wholePipes.length ? wholeTotal / wholePipes.length : 0;

  var h = '<span class="sa-badge so">🚁 ยอดที่ปิดแล้วใน Pipeline (Win/Contracting/Deliver) — อาจต่างจากยอดบัญชีจริงเล็กน้อย (เช่น สินค้า Run Rate/Demo ที่ไม่ได้ลงเป็นโครงการ) เทียบกับยอด SIS ได้ที่แท็บ Plan vs Actual</span>';

  h += '<div class="sa-stats">' +
    '<div class="sa-stat"><div class="lbl">ยอดขายรวม</div><div class="val">' + fmtMoney(wholeTotal) + ' ฿</div></div>' +
    '<div class="sa-stat"><div class="lbl">จำนวนโครงการ</div><div class="val">' + wholePipes.length + '</div></div>' +
    '<div class="sa-stat"><div class="lbl">มูลค่าเฉลี่ย/โครงการ</div><div class="val">' + (wholePipes.length ? fmtMoney(avg) + ' ฿' : '—') + '</div></div>' +
    '</div>';

  h += '<div class="card"><h2>ยอดขายตามช่วงเวลา <span class="hint">คลิกแท่งเพื่อดูรายละเอียดช่วงนั้น</span></h2>' +
    saBarChartHtml(period.bars.map(function(b) {
      var v = saPipelineInRange('won', b.start, b.end, saSaleFilter).reduce(function(s, p) { return s + saAmt(p); }, 0);
      return { key: b.key, v: v, onclick: "saOpenPeriodDrillM('" + b.start + "','" + b.end + "','" + sanitize(b.key).replace(/'/g, "\\'") + "')" };
    })) +
    '</div>';

  h += '<div class="card"><div class="sa-gtabs">' +
    '<button class="sa-gtab' + (saTab === 'dealer' ? ' on' : '') + '" onclick="saSetTab(\'dealer\')">🏪 แยกตาม Dealer</button>' +
    '<button class="sa-gtab' + (saTab === 'sale' ? ' on' : '') + '" onclick="saSetTab(\'sale\')">👤 แยกตามเซล</button>' +
    '<button class="sa-gtab' + (saTab === 'product' ? ' on' : '') + '" onclick="saSetTab(\'product\')">🚁 แยกตามสินค้า</button>' +
    '</div>';

  var rows = saTab === 'dealer' ? saBreakdownDealer(wholePipes)
    : saTab === 'sale' ? saBreakdownSale(wholePipes)
    : saBreakdownProduct(wholePipes);
  h += '<table class="sa-table"><thead><tr><th>#</th><th>' + (saTab === 'dealer' ? 'Dealer' : saTab === 'sale' ? 'เซล' : 'สินค้า') + '</th><th class="num">ยอดขาย</th><th class="num">จำนวน</th></tr></thead><tbody>';
  if (!rows.length) {
    h += '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">ไม่มีข้อมูลช่วงนี้</td></tr>';
  } else {
    rows.slice(0, 30).forEach(function(r, i) {
      var clickAttr = (saTab === 'dealer' && r.id) ? ' style="cursor:pointer" onclick="go(\'dealerDetail\',{dealerId:\'' + r.id + '\'})"' : '';
      h += '<tr' + clickAttr + '><td>' + (i + 1) + '</td><td style="font-weight:600">' + sanitize(r.name) + '</td>' +
        '<td class="num">' + fmtMoney(r.v) + ' ฿</td><td class="num">' + (r.qty || '—') + '</td></tr>';
    });
  }
  h += '</tbody></table>';
  h += '</div>';
  return h;
}

function saBreakdownDealer(pipes) {
  var map = {};
  pipes.forEach(function(p) {
    if (!map[p.dealerId]) { var d = ST.getOne('dealers', p.dealerId); map[p.dealerId] = { id: p.dealerId, name: d ? d.name : '-', v: 0, qty: 0 }; }
    map[p.dealerId].v += saAmt(p);
    map[p.dealerId].qty += saPipeItemRevenue(p).reduce(function(s, it) { return s + it.qty; }, 0);
  });
  return Object.keys(map).map(function(k) { return map[k]; }).sort(function(a, b) { return b.v - a.v; });
}
function saBreakdownSale(pipes) {
  var map = {};
  pipes.forEach(function(p) {
    var sn = p.saleName || '(ไม่ระบุ)';
    if (!map[sn]) map[sn] = { name: sn, v: 0, qty: 0 };
    map[sn].v += saAmt(p);
    map[sn].qty += saPipeItemRevenue(p).reduce(function(s, it) { return s + it.qty; }, 0);
  });
  return Object.keys(map).map(function(k) { return map[k]; }).sort(function(a, b) { return b.v - a.v; });
}
function saBreakdownProduct(pipes) {
  var map = {};
  pipes.forEach(function(p) {
    saPipeItemRevenue(p).forEach(function(it) {
      if (!map[it.model]) map[it.model] = { name: it.model, v: 0, qty: 0 };
      map[it.model].v += it.v;
      map[it.model].qty += it.qty;
    });
  });
  return Object.keys(map).map(function(k) { return map[k]; }).sort(function(a, b) { return b.v - a.v; });
}

// ---- Tooltip ลอยของกราฟแท่ง ใช้ร่วมกันทุกกราฟในหน้านี้ (แทน SVG <title> ที่เป็น native tooltip ของ
// browser — ช้า ไม่มีสไตล์ ไม่ match กับดีไซน์แอป) สร้าง/reuse element เดียวผ่าน .sa-chart-tip (style.css)
// (2026-08-30 ตามคำแนะนำ dataviz — ต้องมี hover layer แทน title เฉยๆ)
function _saChartTooltipShow(evt, html) {
  var el = document.getElementById('saChartTooltipEl');
  if (!el) {
    el = document.createElement('div');
    el.id = 'saChartTooltipEl';
    el.className = 'sa-chart-tip';
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  el.style.display = 'block';
  _saChartTooltipMove(evt);
}
function _saChartTooltipMove(evt) {
  var el = document.getElementById('saChartTooltipEl');
  if (!el) return;
  var x = evt.clientX + 14, y = evt.clientY + 14;
  x = Math.min(x, window.innerWidth - el.offsetWidth - 10);
  y = Math.min(y, window.innerHeight - el.offsetHeight - 10);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}
function _saChartTooltipHide() {
  var el = document.getElementById('saChartTooltipEl');
  if (el) el.style.display = 'none';
}

// เส้น grid + ตัวเลขกำกับแกน Y (0/⅓/⅔/max) — เดิมมีแค่เส้นเฉยๆ ไม่มีตัวเลข ต้อง hover ทุกครั้งถึงจะรู้ค่า
function _saChartAxisSvg(max, W, padT, padH) {
  var svg = '';
  for (var g = 0; g <= 3; g++) {
    var y = padT + padH * (1 - g / 3);
    svg += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="var(--border)" stroke-width="1"></line>';
    svg += '<text x="4" y="' + (y - 3) + '" font-size="9" fill="var(--text3)">' + fmtMoneyShort(max * g / 3) + '</text>';
  }
  return svg;
}

// path ของแท่งกราฟมนแค่มุมบน (ชนพื้น/baseline สนิท) — เดิมใช้ <rect rx="3"> ซึ่งมนทั้ง 4 มุมรวมมุมล่างที่
// ควรปักกับแกนด้วย ทำให้แท่งดูเหมือนลอยจากพื้นเล็กน้อยแทนที่จะเป็นแท่งจริง
function _saBarPath(x, y, w, h, r) {
  if (h <= 0 || w <= 0) return '';
  r = Math.min(r, w / 2, h);
  if (r <= 0) return 'M' + x + ',' + (y + h) + 'h' + w + 'v' + (-h) + 'h' + (-w) + 'z';
  return 'M' + x + ',' + (y + h) +
    'L' + x + ',' + (y + r) +
    'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
    'L' + (x + w - r) + ',' + y +
    'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
    'L' + (x + w) + ',' + (y + h) + 'Z';
}

// ---- แท่งกราฟ SVG แบบง่าย ใช้ร่วมกันทั้งแท็บยอดขายจริง/Plan vs Actual ----
function saBarChartHtml(bars) {
  var W = 1000, H = 200, padB = 26, padT = 8, padH = H - padT - padB;
  var max = Math.max.apply(null, bars.map(function(b) { return b.v; })) || 1;
  var n = bars.length;
  var gap = 8;
  var barW = (W - gap * (n + 1)) / n;
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:180px" preserveAspectRatio="none">';
  svg += _saChartAxisSvg(max, W, padT, padH);
  bars.forEach(function(b, i) {
    var x = gap + i * (barW + gap);
    var h = padH * (b.v / max);
    var tip = "'" + sanitize(b.key).replace(/'/g, "\\'") + "<br><b>" + fmtMoney(b.v).replace(/'/g, "\\'") + " ฿</b>'";
    svg += '<path d="' + _saBarPath(x, H - padB - h, barW, h, 4) + '" fill="var(--accent)" style="cursor:pointer" ' +
      'onclick="' + (b.onclick || '') + '" onmouseenter="_saChartTooltipShow(event,' + tip + ')" onmousemove="_saChartTooltipMove(event)" onmouseleave="_saChartTooltipHide()"></path>';
    svg += '<text x="' + (x + barW / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--text3)">' + sanitize(b.key) + '</text>';
  });
  svg += '</svg>';
  return svg;
}

function saOpenPeriodDrillM(start, end, key) {
  var pipes = saPipelineInRange('won', start, end, saSaleFilter).sort(function(a, b) { return saAmt(b) - saAmt(a); });
  var dealerMap = {}; ST.getAll('dealers').forEach(function(d) { dealerMap[d.id] = d; });
  var h = '<p style="font-size:.72rem;color:var(--text3);margin-bottom:10px">' + sanitize(key) + ' · ' + pipes.length + ' โครงการ · รวม ' + fmtMoney(pipes.reduce(function(s, p) { return s + saAmt(p); }, 0)) + ' ฿</p>';
  if (!pipes.length) {
    h += '<div class="empty"><p>ไม่มีโครงการปิดแล้วในช่วงนี้</p></div>';
  } else {
    h += '<div class="sa-stagegroup">' + pipes.map(function(p) {
      var d = dealerMap[p.dealerId];
      return '<div class="sa-projrow">' +
        (p.rowNo ? '<span class="sa-rowno mono">#' + sanitize(String(p.rowNo)) + '</span>' : '') +
        '<span class="n">' + sanitize(p.projectName || '-') + '</span>' +
        '<span class="d">' + sanitize(d ? d.name : '-') + '</span>' +
        '<span class="v mono">' + fmtMoney(saAmt(p)) + '</span>' +
        '<button class="btn bsm bp" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">เปิด →</button>' +
        '</div>';
    }).join('') + '</div>';
  }
  openM('📅 รายละเอียด — ' + sanitize(key), h);
}

// ================================================================
// TAB: 🎯 Plan vs Actual — 3 ชั้นข้อมูล ไม่บวกกัน: Plan (Pipeline active) / Committed (Pipeline won) / Actual (จริง)
// ================================================================
function saPlanPaneHtml() {
  var period = saPeriodBars(saGran, saOffset[saGran]);
  var start0 = period.bars[0].start, end0 = period.bars[period.bars.length - 1].end;

  var planList = saPipelineInRange('active', start0, end0, saSaleFilter);
  var committedList = saPipelineInRange('won', start0, end0, saSaleFilter);
  var actualRes = saActualForRange(start0, end0, saSaleFilter);
  var totalPlan = planList.reduce(function(s, p) { return s + saAmt(p); }, 0);
  var totalCommitted = committedList.reduce(function(s, p) { return s + saAmt(p); }, 0);
  var totalActual = actualRes.total;
  var gap = totalCommitted - totalActual;

  var h = '<div class="sa-tiernote">' +
    '<b>3 ชั้นข้อมูล ไม่ได้บวกกัน — แต่ละอันเป็นคนละมุมมอง:</b>' +
    '<div><span class="dot" style="background:var(--chart-plan)"></span><b>Plan</b> = Pipeline ที่ยังเปิดอยู่ (Initial/On Process/Draft TOR/Bidding) ยังไม่แน่นอน</div>' +
    '<div><span class="dot" style="background:var(--chart-committed)"></span><b>Committed</b> = ปิดดีลแล้วใน Pipeline (Win/Contracting/Deliver) แต่ยังไม่ตัดยอดบัญชี</div>' +
    '<div><span class="dot" style="background:var(--accent)"></span><b>Actual</b> = ยอดขายจริงที่บันทึกบัญชีแล้ว</div>' +
    '<div style="color:var(--chart-plan);font-size:.68rem">⚠️ Committed กับ Actual อาจไม่เท่ากันเป๊ะ เพราะมี delay ระหว่างปิดดีลกับตัดยอดบัญชีจริง</div>' +
    '</div>';

  h += '<div class="sa-stats">' +
    '<div class="sa-stat" style="cursor:pointer" onclick="saOpenStageDrillM(\'active\',\'' + start0 + '\',\'' + end0 + '\')"><div class="lbl">🟠 Plan (Pipeline เปิดอยู่)</div><div class="val">' + fmtMoney(totalPlan) + ' ฿</div></div>' +
    '<div class="sa-stat" style="cursor:pointer" onclick="saOpenStageDrillM(\'won\',\'' + start0 + '\',\'' + end0 + '\')"><div class="lbl">🟢 Committed (ปิดแล้ว)</div><div class="val">' + fmtMoney(totalCommitted) + ' ฿</div></div>' +
    '<div class="sa-stat"><div class="lbl">🔵 Actual (ยอดขายจริง)</div><div class="val">' + fmtMoney(totalActual) + ' ฿</div></div>' +
    '<div class="sa-stat"><div class="lbl">ส่วนต่าง Committed − Actual</div><div class="val" style="color:' + (gap >= 0 ? 'var(--good)' : 'var(--bad)') + '">' + (gap >= 0 ? '+' : '-') + fmtMoney(Math.abs(gap)) + ' ฿</div></div>' +
    '</div>';

  h += '<div class="card"><h2>Plan / Committed / Actual แยกรายช่วงเวลา</h2>' + saPlanGroupedChartHtml(period.bars) + '</div>';

  h += '<div class="card"><h2>แยกตาม Dealer</h2>' + saPlanDealerTableHtml(start0, end0) + '</div>';
  return h;
}

// 3 series (Plan/Committed/Actual) สีส้ม/เขียว/ฟ้า ผ่านการเช็คแล้วว่าคนตาบอดสี (โดยเฉพาะ protanopia) แยก
// ส้ม-เขียวยาก และในโหมด Light สีเขียว Committed กับสีเขียว accent ของ Actual แยกยากแม้สายตาปกติ (ΔE < 15) —
// เก็บสีเดิมไว้ (ใช้เป็นสีสถานะเดียวกับที่อื่นในแอปมาตลอด เปลี่ยนจะขัดกับทั้งแอป) แต่เพิ่มตัวเลขกำกับบนแท่งตรงๆ
// เป็น secondary encoding แทน (ตามคำแนะนำ dataviz — 3 series อยู่ในเกณฑ์ที่ควร direct-label อยู่แล้วด้วย)
// (2026-08-30)
function saPlanGroupedChartHtml(bars) {
  var data = bars.map(function(b) {
    var plan = saPipelineInRange('active', b.start, b.end, saSaleFilter).reduce(function(s, p) { return s + saAmt(p); }, 0);
    var committed = saPipelineInRange('won', b.start, b.end, saSaleFilter).reduce(function(s, p) { return s + saAmt(p); }, 0);
    var actual = saActualForRange(b.start, b.end, saSaleFilter).total;
    return { key: b.key, plan: plan, committed: committed, actual: actual, start: b.start, end: b.end };
  });
  var W = 1000, H = 200, padB = 26, padT = 8, padH = H - padT - padB;
  var max = Math.max.apply(null, data.map(function(b) { return Math.max(b.plan, b.committed, b.actual); })) || 1;
  var n = data.length, groupGap = 8;
  var groupW = (W - groupGap * (n + 1)) / n;
  var barGap = 2, barW = (groupW - barGap * 2) / 3;
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:180px" preserveAspectRatio="none">';
  svg += _saChartAxisSvg(max, W, padT, padH);
  var SERIES = [
    { k: 'plan', c: 'var(--chart-plan)', label: 'Plan', cat: 'active' },
    { k: 'committed', c: 'var(--chart-committed)', label: 'Committed', cat: 'won' },
    { k: 'actual', c: 'var(--accent)', label: 'Actual', cat: null }
  ];
  data.forEach(function(b, i) {
    var gx = groupGap + i * (groupW + groupGap);
    SERIES.forEach(function(s, si) {
      var v = b[s.k];
      var h = padH * (v / max);
      var x = gx + si * (barW + barGap);
      var y = H - padB - h;
      var click = s.cat ? "saOpenStageDrillM('" + s.cat + "','" + b.start + "','" + b.end + "')" : '';
      var tip = "'" + sanitize(b.key).replace(/'/g, "\\'") + " — " + s.label + "<br><b>" + fmtMoney(v).replace(/'/g, "\\'") + " ฿</b>'";
      svg += '<path d="' + _saBarPath(x, y, barW, h, 2) + '" fill="' + s.c + '" style="cursor:pointer" ' +
        'onclick="' + click + '" onmouseenter="_saChartTooltipShow(event,' + tip + ')" onmousemove="_saChartTooltipMove(event)" onmouseleave="_saChartTooltipHide()"></path>';
      // ตัวเลขกำกับบนแท่ง — โชว์เฉพาะแท่งที่สูงพอ (กันตัวเลขซ้อนกันตอนแท่งเตี้ย/ช่วงเวลาถี่ เช่นมุมมองรายวัน)
      if (h > 22 && v > 0) {
        svg += '<text x="' + (x + barW / 2) + '" y="' + (y - 3) + '" text-anchor="middle" font-size="7.5" fill="var(--text2)">' + fmtMoneyShort(v) + '</text>';
      }
    });
    svg += '<text x="' + (gx + groupW / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--text3)">' + sanitize(b.key) + '</text>';
  });
  svg += '</svg>';
  svg += '<div style="display:flex;gap:14px;font-size:.68rem;color:var(--text2);margin-top:8px">' +
    '<span><span class="dot" style="background:var(--chart-plan)"></span>Plan</span><span><span class="dot" style="background:var(--chart-committed)"></span>Committed</span><span><span class="dot" style="background:var(--accent)"></span>Actual</span></div>';
  return svg;
}

function saPlanDealerTableHtml(start, end) {
  var dealers = ST.getAll('dealers');
  var dsm = {}; dealers.forEach(function(d) { dsm[d.id] = d; });
  var planList = saPipelineInRange('active', start, end, saSaleFilter);
  var committedList = saPipelineInRange('won', start, end, saSaleFilter);
  var actualRes = saActualForRange(start, end, saSaleFilter);

  var map = {};
  function bucket(id) { if (!map[id]) map[id] = { plan: 0, committed: 0, actual: 0 }; return map[id]; }
  planList.forEach(function(p) { bucket(p.dealerId).plan += saAmt(p); });
  committedList.forEach(function(p) { bucket(p.dealerId).committed += saAmt(p); });
  if (actualRes.source === 'so') {
    actualRes.orders.forEach(function(o) { bucket(o.dealerId).actual += saOrderTotal(o); });
  } else {
    Object.keys(actualRes.byDealer || {}).forEach(function(id) { bucket(id).actual += actualRes.byDealer[id]; });
  }

  var rows = Object.keys(map).map(function(id) {
    var d = dsm[id];
    var r = map[id];
    return { id: id, name: d ? d.name : '(ไม่ระบุ)', plan: r.plan, committed: r.committed, actual: r.actual, gap: r.committed - r.actual };
  }).sort(function(a, b) { return (b.plan + b.committed + b.actual) - (a.plan + a.committed + a.actual); });

  if (!rows.length) return '<div class="empty"><p>ไม่มีข้อมูลช่วงนี้</p></div>';

  var h = '<table class="sa-table"><thead><tr><th>#</th><th>Dealer</th><th class="num">🟠 Plan</th><th class="num">🟢 Committed</th><th class="num">🔵 Actual</th><th class="num">ส่วนต่าง</th></tr></thead><tbody>';
  rows.slice(0, 30).forEach(function(r, i) {
    h += '<tr style="cursor:pointer" onclick="go(\'dealerDetail\',{dealerId:\'' + r.id + '\'})"><td>' + (i + 1) + '</td><td style="font-weight:600">' + sanitize(r.name) + '</td>' +
      '<td class="num">' + fmtMoney(r.plan) + '</td><td class="num">' + fmtMoney(r.committed) + '</td><td class="num">' + fmtMoney(r.actual) + '</td>' +
      '<td class="num" style="color:' + (r.gap >= 0 ? 'var(--good)' : 'var(--bad)') + '">' + (r.gap >= 0 ? '+' : '-') + fmtMoney(Math.abs(r.gap)) + '</td></tr>';
  });
  h += '</tbody></table>';
  return h;
}

// เจาะลึกตาม Stage จริง (สถานะจริงของ Pipeline) — เห็นรายชื่อโครงการจริง พร้อม Row No. กด "เปิด →" ไปหน้า Pipeline Detail ได้เลย
function saOpenStageDrillM(category, start, end) {
  var cfg = getConfig();
  var statuses = (cfg.pipelineStatuses || []).filter(function(s) { return s.category === category; });
  var pipes = saPipelineInRange(category, start, end, saSaleFilter);
  var dealerMap = {}; ST.getAll('dealers').forEach(function(d) { dealerMap[d.id] = d; });

  var title = category === 'active' ? '🟠 Plan — Pipeline ที่ยังเปิดอยู่' : '🟢 Committed — ปิดดีลแล้ว';
  var h = '<p style="font-size:.7rem;color:var(--text3);margin-bottom:10px">' + pipes.length + ' โครงการ · รวม ' + fmtMoney(pipes.reduce(function(s, p) { return s + saAmt(p); }, 0)) + ' ฿</p>';

  statuses.forEach(function(st) {
    var list = pipes.filter(function(p) { return p.status === st.id; });
    if (!list.length) return;
    var sum = list.reduce(function(s, p) { return s + saAmt(p); }, 0);
    h += '<div class="form-section" style="cursor:pointer" onclick="_saToggleStageGroup(this)">' + sanitize(st.name) + ' — ' + list.length + ' โครงการ · ' + fmtMoney(sum) + ' ฿ <span style="float:right">▼</span></div>';
    h += '<div class="sa-stagegroup">';
    list.sort(function(a, b) { return saAmt(b) - saAmt(a); }).forEach(function(p) {
      var d = dealerMap[p.dealerId];
      h += '<div class="sa-projrow">' +
        (p.rowNo ? '<span class="sa-rowno mono">#' + sanitize(String(p.rowNo)) + '</span>' : '') +
        '<span class="n">' + sanitize(p.projectName || '-') + '</span>' +
        '<span class="d">' + sanitize(d ? d.name : '-') + '</span>' +
        '<span class="v mono">' + fmtMoney(saAmt(p)) + '</span>' +
        '<button class="btn bsm bp" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">เปิด →</button>' +
        '</div>';
    });
    h += '</div>';
  });

  openM(title, h);
}
function _saToggleStageGroup(hdr) {
  var grp = hdr.nextElementSibling;
  var open = grp.style.display !== 'none';
  grp.style.display = open ? 'none' : '';
  hdr.querySelector('span').textContent = open ? '▶' : '▼';
}

// ================================================================
// 🧭 จัดการวันที่ปิดดีล — ดู/แก้ Forecast Month, Shipment Date และเลือกแหล่งวันที่ที่ใช้จริงเองต่อโครงการ
// (pipeCloseDateSources/pipeResolvedCloseDate ใน utils.js) เข้าถึงได้จากเมนู ⋯ ทั้งหน้านี้และหน้า KPI เพราะ
// ทั้งสองหน้าใช้แหล่งวันที่เดียวกันแล้ว แก้ที่นี่มีผลกับตัวเลขทั้งสองหน้าพร้อมกัน (2026-08-29)
// ================================================================
var _cdmTierSel = null;
var _cdmDealerId = '';
var _cdmSearch = '';
var _cdmSel = {};
var _cdmExpanded = {};
var _cdmBulkMonth = '';
var _cdmBulkShip = '';

function _cdmDefaultTierSel() { return { log: false, guess: false, fc: false, ship: false, register: true }; }

function showCloseDateManagerM() {
  _cdmTierSel = _cdmDefaultTierSel();
  _cdmDealerId = ''; _cdmSearch = ''; _cdmSel = {}; _cdmExpanded = {};
  var n = new Date();
  _cdmBulkMonth = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
  _cdmBulkShip = _td();
  _cdmRenderModal();
}

// จำนวนโครงการทั้งหมดที่กำลัง "ใช้ Register Date อยู่" (แม่นน้อยสุด) — โชว์เป็นตัวเลขต่อท้ายปุ่มเปิดเครื่องมือนี้
function cdmRegisterTierCount() {
  return ST.getAll('pipeline').filter(function(p) { return pipeResolvedCloseDate(p).key === 'register'; }).length;
}

function _cdmFilteredProjects() {
  var q = (_cdmSearch || '').trim().toLowerCase();
  return ST.getAll('pipeline').filter(function(p) {
    if (_cdmTierSel && _cdmTierSel[pipeResolvedCloseDate(p).key] === false) return false;
    if (_cdmDealerId && p.dealerId !== _cdmDealerId) return false;
    if (q) {
      var dl = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
      var hay = ((p.projectName || '') + ' ' + (dl ? dl.name : '') + ' ' + (p.rowNo || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }).sort(function(a, b) { return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); });
}

function _cdmToggleTier(key, checked) { _cdmTierSel[key] = checked; _cdmRenderModal(); }
function _cdmSetDealer(v) { _cdmDealerId = v; _cdmRenderModal(); }
function _cdmSearchInput(v) { _cdmSearch = v; _cdmRenderModal(); }
function _cdmToggleExpand(pipeId) { _cdmExpanded[pipeId] = !_cdmExpanded[pipeId]; _cdmRenderModal(); }

function _cdmToggleSel(pipeId, checked) { if (checked) _cdmSel[pipeId] = true; else delete _cdmSel[pipeId]; _cdmRenderModal(); }
function _cdmToggleSelAll(checked) {
  _cdmFilteredProjects().forEach(function(p) { if (checked) _cdmSel[p.id] = true; else delete _cdmSel[p.id]; });
  _cdmRenderModal();
}

// แก้ Forecast Month / Shipment Date ตรงจากตาราง — ถ้าเคยเลือก source เป็นฟิลด์นี้ไว้เองแล้วเพิ่งลบค่าออกจน
// ว่าง ต้องคืนกลับไปใช้ auto แทน กันเลือก source ที่ไม่มีข้อมูลค้างอยู่ (เห็นผลเหมือนกับใน mockup)
function _cdmSetField(pipeId, field, val) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  var fieldToTier = { forecastMonth: 'fc', shipmentDate: 'ship' };
  var updates = {}; updates[field] = val;
  if (!val && p.closeDateSource === fieldToTier[field]) updates.closeDateSource = '';
  var updated = ST.update('pipeline', pipeId, updates);
  if (updated && typeof syncItemToFirebase === 'function') syncItemToFirebase('pipeline', updated);
  _cdmRenderModal();
}

function _cdmSetSource(pipeId, key) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  var sources = pipeCloseDateSources(p);
  var autoKey = sources[0].key;
  var updated = ST.update('pipeline', pipeId, { closeDateSource: (key === autoKey) ? '' : key });
  if (updated && typeof syncItemToFirebase === 'function') syncItemToFirebase('pipeline', updated);
  _cdmRenderModal();
}

// โชว์เนื้อหา log จริงที่เป็นที่มาของชั้น "Log ยืนยัน"/"เดาจาก Log" (ถ้ามี) — ไม่ใช่แค่โชว์วันที่เฉยๆ เพราะ
// เฉพาะชั้น "เดาจาก Log" เดาจากข้อความอิสระ ผู้ใช้ควรเห็นเนื้อหาจริงที่ระบบใช้ตัดสินเอง จะได้เช็คได้ว่าเดาถูกไหม
// โดยไม่ต้องออกจาก modal นี้ไปหาเองในหน้า Pipeline Detail (2026-08-30 ตามคำขอให้ทุกจุดหาที่มาได้ในตัว)
function _cdmSourceDetailHtml(p) {
  var confirmedLog = _pipeConfirmedWonLog(p);
  var guessedLog = confirmedLog ? null : _pipeGuessedWonLog(p);
  if (!confirmedLog && !guessedLog) return '';
  var l = confirmedLog || guessedLog;
  var label = confirmedLog ? '📌 Log ยืนยัน (ระบบสร้างเองตอนกดเปลี่ยนสถานะ)' : '🔍 เดาจาก Log (ไม่ยืนยัน — เช็คว่าเดาถูกไหม)';
  var color = confirmedLog ? 'var(--good)' : 'var(--guess)';
  return '<div style="font-size:.72rem;background:var(--bg2);border-radius:6px;padding:8px 10px;margin:2px 0 4px;border-left:3px solid ' + color + '">' +
    '<div style="font-weight:700;color:' + color + ';margin-bottom:3px">' + label + '</div>' +
    '<div style="color:var(--text2)">' + fD((l.date || '').split('T')[0]) + ' — "' + sanitize(l.content || '') + '"</div>' +
    '</div>';
}

// p.forecastMonth เก็บเป็น free text ("2026 Aug") ไม่ใช่ ISO "YYYY-MM" ที่ <input type="month"> ต้องการ —
// ถ้าใส่ free text ตรงๆ เป็น value ของ input ชนิดนี้ เบราว์เซอร์จะปฏิเสธค่าที่ format ไม่ตรงแล้วโชว์ช่องว่างเปล่า
// ทั้งที่จริงมีค่าอยู่ ต้องแปลงเป็น ISO ก่อนเสมอ ไม่งั้นดูเหมือนโครงการยังไม่กรอก Forecast Month ทั้งที่กรอกแล้ว
function _cdmForecastMonthIso(text) {
  var info = (text && typeof _kpiParseForecastMonthText === 'function') ? _kpiParseForecastMonthText(text) : null;
  return info ? (info.year + '-' + String(info.month).padStart(2, '0')) : '';
}

function _cdmBulkSetMonth(v) { _cdmBulkMonth = v; }
function _cdmBulkSetShip(v) { _cdmBulkShip = v; }

function _cdmBulkApply(field) {
  var val = field === 'forecastMonth' ? _cdmBulkMonth : _cdmBulkShip;
  if (!val) { toast('⚠️ เลือกค่าที่จะตั้งก่อน'); return; }
  var ids = Object.keys(_cdmSel);
  if (!ids.length) return;
  ids.forEach(function(id) { _cdmSetFieldQuiet(id, field, val); });
  toast('💾 ตั้งค่าให้ ' + ids.length + ' โครงการแล้ว');
  _cdmRenderModal();
}
// เหมือน _cdmSetField แต่ไม่ re-render ทุกครั้ง (ไว้ให้ _cdmBulkApply เรียกวนหลายโครงการแล้ว render ทีเดียวตอนจบ)
function _cdmSetFieldQuiet(pipeId, field, val) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  var updates = {}; updates[field] = val;
  var updated = ST.update('pipeline', pipeId, updates);
  if (updated && typeof syncItemToFirebase === 'function') syncItemToFirebase('pipeline', updated);
}

function _cdmRenderModal() {
  var dealers = ST.getAll('dealers').slice().sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  var TIER_CHIPS = [
    ['log', '📌 มี Log ยืนยัน'], ['guess', '🔍 เดาจาก Log'],
    ['fc', '🔮 มี Forecast Month แล้ว'], ['ship', '🚚 มี Shipment Date แล้ว'],
    ['register', '🗓️ ใช้ Register Date (ต้องกรอก)']
  ];
  var h = '<p style="font-size:.72rem;color:var(--text3);margin-bottom:10px">แก้ Forecast Month / Shipment Date ทีละแถวหรือเลือกหลายแถวพร้อมกันได้ — ถ้าโครงการไหนมีมากกว่า 1 แหล่งพร้อมกัน เลือกแหล่งที่จะใช้จริงเองได้จากดรอปดาวน์ท้ายแถว (มีผลกับยอดทั้งหน้า Sales Analytics และ KPI)</p>';

  h += '<div style="margin-bottom:8px"><div style="font-size:.7rem;font-weight:700;margin-bottom:5px">แหล่งวันที่</div><div style="display:flex;flex-wrap:wrap;gap:5px">';
  TIER_CHIPS.forEach(function(t) {
    h += '<label style="display:flex;align-items:center;gap:4px;font-size:.7rem;background:var(--bg2);padding:3px 8px;border-radius:12px;cursor:pointer">' +
      '<input type="checkbox" style="width:auto" ' + (_cdmTierSel[t[0]] ? 'checked' : '') + ' onchange="_cdmToggleTier(\'' + t[0] + '\',this.checked)">' + t[1] + '</label>';
  });
  h += '</div></div>';

  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
  h += '<select onchange="_cdmSetDealer(this.value)" style="font-size:.76rem"><option value="">🏪 ทุก Dealer</option>' +
    dealers.map(function(d) { return '<option value="' + d.id + '"' + (_cdmDealerId === d.id ? ' selected' : '') + '>' + sanitize(d.name) + '</option>'; }).join('') + '</select>';
  h += '<input type="text" placeholder="🔍 ค้นหาชื่อโครงการ / Row No..." value="' + sanitize(_cdmSearch) + '" oninput="_cdmSearchInput(this.value)" style="flex:1;min-width:160px;font-size:.76rem">';
  h += '</div>';

  var list = _cdmFilteredProjects();
  var selCount = Object.keys(_cdmSel).length;
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--bg2);border-radius:8px;padding:8px 10px;margin-bottom:8px">';
  h += '<label style="display:flex;align-items:center;gap:5px;font-size:.72rem;cursor:pointer"><input type="checkbox" style="width:auto" onchange="_cdmToggleSelAll(this.checked)" ' + (list.length && selCount === list.length ? 'checked' : '') + '>เลือกที่แสดงอยู่ทั้งหมด</label>';
  h += '<span style="font-size:.72rem;color:var(--text2)"><b>' + selCount + '</b> รายการที่เลือก</span>';
  h += '<div style="flex:1"></div>';
  h += '<span style="font-size:.68rem;color:var(--text3)">ตั้ง Forecast Month:</span><input type="month" value="' + sanitize(_cdmBulkMonth) + '" oninput="_cdmBulkSetMonth(this.value)" style="font-size:.72rem">' +
    '<button class="btn bsm bp" ' + (selCount ? '' : 'disabled') + ' onclick="_cdmBulkApply(\'forecastMonth\')">ใช้กับที่เลือก</button>';
  h += '<span style="font-size:.68rem;color:var(--text3)">ตั้ง Shipment Date:</span><input type="date" value="' + sanitize(_cdmBulkShip) + '" oninput="_cdmBulkSetShip(this.value)" style="font-size:.72rem">' +
    '<button class="btn bsm bp" ' + (selCount ? '' : 'disabled') + ' onclick="_cdmBulkApply(\'shipmentDate\')">ใช้กับที่เลือก</button>';
  h += '</div>';

  h += '<div style="font-size:.7rem;color:var(--text3);margin-bottom:6px">' + list.length + ' โครงการ</div>';

  if (!list.length) {
    h += '<div style="text-align:center;padding:20px;color:var(--text3)">🔍 ไม่มีโครงการที่ตรงกับตัวกรองนี้</div>';
  } else {
    h += '<div style="max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">';
    list.slice(0, 150).forEach(function(p) {
      var dl = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
      var sources = pipeCloseDateSources(p);
      var effKey = pipeResolvedCloseDate(p).key;
      var expanded = !!_cdmExpanded[p.id];
      h += '<div class="kpi-detail-row" style="cursor:default">';
      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      h += '<input type="checkbox" style="width:auto" ' + (_cdmSel[p.id] ? 'checked' : '') + ' onchange="_cdmToggleSel(\'' + p.id + '\',this.checked)">';
      h += '<button class="btn bsm bo" style="padding:1px 7px" onclick="_cdmToggleExpand(\'' + p.id + '\')">' + (expanded ? '▲' : '▼') + '</button>';
      h += '<span style="flex:1;min-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;cursor:pointer;text-decoration:underline dotted" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" title="เปิดโครงการนี้เต็มหน้า">' +
        (p.rowNo ? '<span style="color:var(--text2);font-weight:400">#' + sanitize(String(p.rowNo)) + '</span> ' : '') + sanitize(p.projectName || (dl ? dl.name : '') || '-') + '</span>';
      h += pipeTag(p.status);
      h += '<span style="font-size:.72rem;color:var(--text2);white-space:nowrap">' + fmtMoneyShort(p.forecastAmount) + '</span>';
      h += '</div>';
      h += '<div style="font-size:.68rem;color:var(--text3);margin:3px 0 6px">🏪 ' +
        (dl ? '<span style="cursor:pointer;text-decoration:underline dotted" onclick="closeMForce();go(\'dealerDetail\',{dealerId:\'' + dl.id + '\'})" title="เปิดหน้า Dealer นี้">' + sanitize(dl.name) + '</span>' : '-') +
        ' · 🗓️ Register: ' + fD(p.registerDate) + '</div>';
      if (expanded) {
        h += _kpiApDetailHtml(p);
        h += _cdmSourceDetailHtml(p);
        h += '<div style="margin:2px 0 8px"><span style="cursor:pointer;font-size:.7rem;color:var(--accent);text-decoration:underline dotted" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">📂 เปิดโครงการเต็ม (ดู Timeline/แก้ไขทุกฟิลด์) →</span></div>';
      }
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:4px">';
      h += '<div><label style="display:block;font-size:.6rem;color:var(--text3)">Forecast Month</label><input type="month" style="font-size:.72rem;width:120px" value="' + _cdmForecastMonthIso(p.forecastMonth) + '" onchange="_cdmSetField(\'' + p.id + '\',\'forecastMonth\',this.value)"></div>';
      h += '<div><label style="display:block;font-size:.6rem;color:var(--text3)">Shipment Date</label><input type="date" style="font-size:.72rem;width:130px" value="' + (p.shipmentDate || '') + '" onchange="_cdmSetField(\'' + p.id + '\',\'shipmentDate\',this.value)"></div>';
      h += '<div><label style="display:block;font-size:.6rem;color:var(--text3)">แหล่งที่ใช้ (เลือกเองได้)</label><select style="font-size:.72rem" onchange="_cdmSetSource(\'' + p.id + '\',this.value)">' +
        sources.map(function(s) { return '<option value="' + s.key + '"' + (s.key === effKey ? ' selected' : '') + '>' + PIPE_CLOSE_DATE_TIER_META[s.key].label + ' (' + fD(s.date) + ')</option>'; }).join('') +
        '</select></div>';
      h += '</div>';
      h += '</div>';
    });
    if (list.length > 150) h += '<div style="text-align:center;color:var(--text3);font-size:.7rem;padding:6px">...และอีก ' + (list.length - 150) + ' โครงการ — กรองเพิ่มเพื่อดูให้ครบ</div>';
    h += '</div>';
  }

  openM('🧭 จัดการวันที่ปิดดีล', h);
}
