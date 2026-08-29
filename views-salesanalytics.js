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

// วันที่ปิดจริงของโครงการ "won" — เอาจาก log "เปลี่ยนสถานะ" (ระบบสร้างอัตโนมัติทุกครั้งที่เปลี่ยนสถานะ) หา
// ครั้งแรกสุดที่เปลี่ยนเข้าสถานะกลุ่ม won เพราะนี่คือวันที่ "ปิดดีลจริง" — ไม่ใช่ expectedCloseDate (แค่ค่าคาดการณ์)
// หรือ registerDate (วันที่ลงทะเบียนโครงการ อาจเป็นปีก่อนหน้าที่ยังไม่ปิด) ไม่งั้นกราฟจะเอายอดไปโผล่ผิดปี
function saPipeWonDate(p) {
  var wonNames = {};
  (getConfig().pipelineStatuses || []).filter(function(s) { return s.category === 'won'; }).forEach(function(s) { wonNames[s.name] = true; });
  var wonLogs = ST.getAll('pipeLog').filter(function(l) {
    if (l.pipeId !== p.id || l.type !== 'status_change' || !l.content) return false;
    var parts = l.content.split('→');
    return parts.length > 1 && wonNames[parts[1].trim()];
  }).sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); }); // เก่า→ใหม่ เอาอันแรกสุด = ปิดดีลครั้งแรก
  if (wonLogs.length) return (wonLogs[0].date || '').split('T')[0];
  return p.expectedCloseDate || p.registerDate || (p.created ? p.created.split('T')[0] : ''); // ไม่มี log เปลี่ยนสถานะ (ข้อมูลเก่า/import) — ใช้ค่าเดิมแทน
}

function saPipelineInRange(category, start, end, saleFilter) {
  var ids = getStatusIdsByCategory(category);
  return ST.getAll('pipeline').filter(function(p) {
    if (ids.indexOf(p.status) === -1) return false;
    if (saleFilter !== 'all' && (p.saleName || '') !== saleFilter) return false;
    var d = category === 'won' ? saPipeWonDate(p) : (p.expectedCloseDate || p.registerDate || (p.created ? p.created.split('T')[0] : ''));
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
  var h = '<div class="card"><h2>📈 Sales Analytics</h2>' +
    '<p class="hint" style="font-size:.7rem;color:var(--text3);margin-bottom:0">ยอดขายรวม/แยกสินค้า/แยก Dealer/แยกเซล — เลือกช่วงเวลาได้ตั้งแต่รายปีถึงรายวัน</p></div>';

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

// ---- แท่งกราฟ SVG แบบง่าย ใช้ร่วมกันทั้งแท็บยอดขายจริง/Plan vs Actual ----
function saBarChartHtml(bars) {
  var W = 1000, H = 200, padB = 26, padT = 8;
  var max = Math.max.apply(null, bars.map(function(b) { return b.v; })) || 1;
  var n = bars.length;
  var gap = 8;
  var barW = (W - gap * (n + 1)) / n;
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:180px" preserveAspectRatio="none">';
  for (var g = 0; g <= 3; g++) {
    var y = padT + (H - padT - padB) * (1 - g / 3);
    svg += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="var(--border)" stroke-width="1"></line>';
  }
  bars.forEach(function(b, i) {
    var x = gap + i * (barW + gap);
    var h = (H - padT - padB) * (b.v / max);
    svg += '<rect x="' + x + '" y="' + (H - padB - h) + '" width="' + barW + '" height="' + h + '" rx="3" fill="var(--accent)" style="cursor:pointer" onclick="' + (b.onclick || '') + '">' +
      '<title>' + sanitize(b.key) + ': ' + fmtMoney(b.v) + ' ฿</title></rect>';
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
    '<div><span class="dot" style="background:#f59e0b"></span><b>Plan</b> = Pipeline ที่ยังเปิดอยู่ (Initial/On Process/Draft TOR/Bidding) ยังไม่แน่นอน</div>' +
    '<div><span class="dot" style="background:#22c55e"></span><b>Committed</b> = ปิดดีลแล้วใน Pipeline (Win/Contracting/Deliver) แต่ยังไม่ตัดยอดบัญชี</div>' +
    '<div><span class="dot" style="background:var(--accent)"></span><b>Actual</b> = ยอดขายจริงที่บันทึกบัญชีแล้ว</div>' +
    '<div style="color:#f59e0b;font-size:.68rem">⚠️ Committed กับ Actual อาจไม่เท่ากันเป๊ะ เพราะมี delay ระหว่างปิดดีลกับตัดยอดบัญชีจริง</div>' +
    '</div>';

  h += '<div class="sa-stats">' +
    '<div class="sa-stat" style="cursor:pointer" onclick="saOpenStageDrillM(\'active\',\'' + start0 + '\',\'' + end0 + '\')"><div class="lbl">🟠 Plan (Pipeline เปิดอยู่)</div><div class="val">' + fmtMoney(totalPlan) + ' ฿</div></div>' +
    '<div class="sa-stat" style="cursor:pointer" onclick="saOpenStageDrillM(\'won\',\'' + start0 + '\',\'' + end0 + '\')"><div class="lbl">🟢 Committed (ปิดแล้ว)</div><div class="val">' + fmtMoney(totalCommitted) + ' ฿</div></div>' +
    '<div class="sa-stat"><div class="lbl">🔵 Actual (ยอดขายจริง)</div><div class="val">' + fmtMoney(totalActual) + ' ฿</div></div>' +
    '<div class="sa-stat"><div class="lbl">ส่วนต่าง Committed − Actual</div><div class="val" style="color:' + (gap >= 0 ? '#22c55e' : '#ef4444') + '">' + (gap >= 0 ? '+' : '-') + fmtMoney(Math.abs(gap)) + ' ฿</div></div>' +
    '</div>';

  h += '<div class="card"><h2>Plan / Committed / Actual แยกรายช่วงเวลา</h2>' + saPlanGroupedChartHtml(period.bars) + '</div>';

  h += '<div class="card"><h2>แยกตาม Dealer</h2>' + saPlanDealerTableHtml(start0, end0) + '</div>';
  return h;
}

function saPlanGroupedChartHtml(bars) {
  var data = bars.map(function(b) {
    var plan = saPipelineInRange('active', b.start, b.end, saSaleFilter).reduce(function(s, p) { return s + saAmt(p); }, 0);
    var committed = saPipelineInRange('won', b.start, b.end, saSaleFilter).reduce(function(s, p) { return s + saAmt(p); }, 0);
    var actual = saActualForRange(b.start, b.end, saSaleFilter).total;
    return { key: b.key, plan: plan, committed: committed, actual: actual, start: b.start, end: b.end };
  });
  var W = 1000, H = 200, padB = 26, padT = 8;
  var max = Math.max.apply(null, data.map(function(b) { return Math.max(b.plan, b.committed, b.actual); })) || 1;
  var n = data.length, groupGap = 8;
  var groupW = (W - groupGap * (n + 1)) / n;
  var barGap = 2, barW = (groupW - barGap * 2) / 3;
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:180px" preserveAspectRatio="none">';
  for (var g = 0; g <= 3; g++) {
    var y = padT + (H - padT - padB) * (1 - g / 3);
    svg += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="var(--border)" stroke-width="1"></line>';
  }
  var SERIES = [{ k: 'plan', c: '#f59e0b', cat: 'active' }, { k: 'committed', c: '#22c55e', cat: 'won' }, { k: 'actual', c: 'var(--accent)', cat: null }];
  data.forEach(function(b, i) {
    var gx = groupGap + i * (groupW + groupGap);
    SERIES.forEach(function(s, si) {
      var v = b[s.k];
      var h = (H - padT - padB) * (v / max);
      var x = gx + si * (barW + barGap);
      var click = s.cat ? "saOpenStageDrillM('" + s.cat + "','" + b.start + "','" + b.end + "')" : '';
      svg += '<rect x="' + x + '" y="' + (H - padB - h) + '" width="' + barW + '" height="' + h + '" rx="2" fill="' + s.c + '" style="cursor:pointer" onclick="' + click + '">' +
        '<title>' + sanitize(b.key) + ' — ' + s.k + ': ' + fmtMoney(v) + ' ฿</title></rect>';
    });
    svg += '<text x="' + (gx + groupW / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--text3)">' + sanitize(b.key) + '</text>';
  });
  svg += '</svg>';
  svg += '<div style="display:flex;gap:14px;font-size:.68rem;color:var(--text2);margin-top:8px">' +
    '<span><span class="dot" style="background:#f59e0b"></span>Plan</span><span><span class="dot" style="background:#22c55e"></span>Committed</span><span><span class="dot" style="background:var(--accent)"></span>Actual</span></div>';
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
      '<td class="num" style="color:' + (r.gap >= 0 ? '#22c55e' : '#ef4444') + '">' + (r.gap >= 0 ? '+' : '-') + fmtMoney(Math.abs(r.gap)) + '</td></tr>';
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
