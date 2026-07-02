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

// การ์ดสรุปตามหมวดหมู่
function fcCategorySummaryHtml(pipes, year) {
  var cats = fcComputeCategoryTotals(pipes, year);
  var ids = Object.keys(cats);
  if (!ids.length) return '';
  var order = (typeof PRODUCT_CATEGORIES !== 'undefined') ? PRODUCT_CATEGORIES.map(function(c) { return c.id; }) : ids;
  ids.sort(function(a, b) { return order.indexOf(a) - order.indexOf(b); });
  var h = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">';
  ids.forEach(function(id) {
    var name = (typeof getCategoryName === 'function') ? getCategoryName(id) : id;
    h += '<div style="border:1px solid var(--border);border-radius:10px;padding:8px 12px;min-width:108px">' +
      '<div style="font-size:.7rem;color:var(--text2)">' + name + '</div>' +
      '<div style="font-weight:800;font-size:1.15rem">' + cats[id].qty + ' <span style="font-size:.58rem;color:var(--text2)">ชิ้น</span></div>' +
      '<div style="font-size:.6rem;color:var(--text2)">' + fmtMoneyShort(cats[id].amt) + '</div>' +
      '</div>';
  });
  h += '</div>';
  return h;
}

// ================================================================
// ตรวจ "งานชนกัน" ระหว่าง Dealer (similarity ภาษาไทยด้วย bigram)
// ================================================================
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
function pipeModelsSet(p) {
  var s = {};
  var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : (p.items || []);
  (items || []).forEach(function (it) { if (it && it.model) s[(it.model + '').toLowerCase().replace(/\s+/g, '')] = true; });
  if (p.model) s[(p.model + '').toLowerCase().replace(/\s+/g, '')] = true;
  return s;
}
function pipeMatchScore(a, b) {
  var name = fcStrSim(a.projectName, b.projectName);
  var eu = fcStrSim(a.endUserTH || a.endUserEN || '', b.endUserTH || b.endUserEN || '');
  var am = fcStrSim(a.agencyMain, b.agencyMain);
  var asb = fcStrSim(a.agencySub, b.agencySub);
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
  var active = (pipes || []).filter(function (p) { return p && ['lost', 'delivered'].indexOf(p.status) === -1; });
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

function getMonthRange(refDate) {
  const d = refDate ? new Date(refDate) : new Date();
  const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
  const e = new Date(d.getFullYear(), d.getMonth()+1, 0);
  return { start: s, end: e.toISOString().split('T')[0] };
}

function getQuarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const start = `${now.getFullYear()}-${String(q*3+1).padStart(2,'0')}-01`;
  const endMonth = q * 3 + 3;
  const end = new Date(now.getFullYear(), endMonth, 0);
  return { start, end: end.toISOString().split('T')[0], label: `Q${q+1}/${now.getFullYear()}` };
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
// IMAGE ATTACHMENTS — UI ใช้ร่วมกันทุกเมนู (Note/Step/Visit/Pipeline/Dealer/Feedback)
// stateVarName = ชื่อ global var (string) ที่เก็บ array attachments ของฟอร์มที่เปิดอยู่
// ================================================================
function attachUploadHtml(stateVarName, folder, label) {
  window[stateVarName] = window[stateVarName] || [];
  return '<div class="fg"><label>' + (label || '📷 รูปแนบ') + '</label>' +
    '<input type="file" accept="image/*" onchange="_handleAttachUpload(event,\'' + stateVarName + '\',\'' + folder + '\')" style="font-size:.76rem">' +
    '<div id="' + stateVarName + '_thumbs">' + attachThumbsHtml(window[stateVarName], stateVarName) + '</div></div>';
}

function attachThumbsHtml(attachments, stateVarName) {
  if (!attachments || !attachments.length) return '';
  return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
    attachments.map(function(a, i) {
      return '<div style="position:relative;width:64px;height:64px">' +
        '<img src="' + a.url + '" style="width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:pointer;display:block" onclick="window.open(\'' + a.url + '\',\'_blank\')">' +
        '<button type="button" onclick="_removeAttachFromState(\'' + stateVarName + '\',' + i + ')" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1">✕</button></div>';
    }).join('') + '</div>';
}

function _handleAttachUpload(event, stateVarName, folder) {
  var file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
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

function _removeAttachFromState(stateVarName, idx) {
  var arr = window[stateVarName];
  if (!arr || !arr[idx]) return;
  if (!confirm('ลบรูปนี้?')) return;
  deleteAttachment(arr[idx].path);
  arr.splice(idx, 1);
  var wrap = document.getElementById(stateVarName + '_thumbs');
  if (wrap) wrap.innerHTML = attachThumbsHtml(arr, stateVarName);
}

function attachGalleryHtml(attachments) {
  if (!attachments || !attachments.length) return '';
  return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
    attachments.map(function(a) {
      return '<img src="' + a.url + '" style="width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="window.open(\'' + a.url + '\',\'_blank\')">';
    }).join('') + '</div>';
}

// ================================================================
// ESCAPE FOR CSV
// ================================================================
function esc(s) {
  return (s || '').replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
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