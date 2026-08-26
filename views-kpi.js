// ================================================================
// KPI QUARTER SCORECARD — เป้า/weight ต่อไตรมาส ต่อเซลล์
// คำนวณ "ทำได้แล้ว" สดจาก Pipeline/Dealer/Visit ที่มีอยู่แล้ว ไม่เก็บ cache
// ================================================================

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

// เดือนที่คาดว่าจะปิดดีล — ประมาณจาก Bidding Date + 2 เดือน (กติกาเดียวกับ _pipeForecastMonthNum ใน
// views-pipeline.js ที่ใช้คำนวณคอลัมน์ "Month" ตอน export) แล้วเทียบว่าอยู่ในช่วงไตรมาส KPI นี้ไหม
function _kpiForecastMonthInfo(p, plan) {
  if (!p.biddingDate) return null;
  var d = new Date(p.biddingDate);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + 2);
  var year = d.getFullYear(), month = d.getMonth() + 1;
  var midMonth = new Date(year, month - 1, 15);
  var inQuarter = !!(plan && midMonth >= new Date(plan.startDate + 'T00:00:00') && midMonth <= new Date(plan.endDate + 'T23:59:59'));
  return { label: KPI_MONTH_NAMES[month - 1] + ' ' + year, sortKey: year + '-' + String(month).padStart(2, '0'), inQuarter: inQuarter };
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
// คำนวณ actual ต่อ category type
// ================================================================
function kpiComputeActualInRange(plan, cat, startDate, endDate) {
  if (cat.type === 'manualScore') return Number(cat.manualValue) || 0;

  if (cat.type === 'pipelineRevenue') {
    var sum = 0;
    ST.getAll('pipeline').forEach(function(p) {
      if (!pipeIsWon(p)) return;
      if ((p.saleName || '') !== plan.salesMemberName) return;
      var rd = p.registerDate || '';
      if (rd < startDate || rd > endDate) return;
      sum += Number(p.forecastAmount) || 0;
    });
    return sum;
  }

  if (cat.type === 'pipelineModelQty') {
    var qty = 0;
    var keywords = (cat.modelMatch || []).map(function(s) { return s.toLowerCase(); });
    ST.getAll('pipeline').forEach(function(p) {
      if (!pipeIsWon(p)) return;
      if ((p.saleName || '') !== plan.salesMemberName) return;
      var rd = p.registerDate || '';
      if (rd < startDate || rd > endDate) return;
      (getPipeItems(p) || []).forEach(function(it) {
        var m = (it.model || '').toLowerCase();
        if (keywords.some(function(k) { return m.indexOf(k) !== -1; })) qty += Number(it.qty) || 0;
      });
    });
    return qty;
  }

  if (cat.type === 'dealerAuthorized') {
    return ST.getAll('dealers').filter(function(d) {
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
  var ringColor = s.onPace ? '#22c55e' : '#ef4444';
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
    return { label: m.label, isCurrent: m.isCurrent, target: monthlyTarget, actual: actual, pct: monthlyTarget ? (actual / monthlyTarget * 100) : 0 };
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
    return ST.getAll('pipeline').filter(function(p) {
      if (!pipeIsWon(p)) return false;
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
  if (cat.type === 'dealerAuthorized') {
    return ST.getAll('dealers').filter(function(d) {
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
  ahead: { label: '🚀 ล้ำหน้าเป้า', color: '#22c55e' },
  onTrack: { label: '🟢 ตามทัน', color: '#3b82f6' },
  behind: { label: '🔴 ตามหลังเป้า', color: '#ef4444' }
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
  return ST.getAll('pipeline').filter(function(p) {
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

  var myDealers = ST.getAll('dealers').filter(function(d) { return (d.saleName || '') === plan.salesMemberName; });
  var wonByDealer = {}, potByDealer = {}, dealsByDealer = {};
  var planCount = 0, winCount = 0, deliverCount = 0;
  ST.getAll('pipeline').forEach(function(p) {
    if ((p.saleName || '') !== plan.salesMemberName || !p.dealerId) return;
    var rd = p.registerDate || '';
    if (rd < plan.startDate || rd > plan.endDate) return;
    var won = pipeIsWon(p), active = pipeIsActive(p);
    if (!won && !active) return; // Fail&Lost หรือสถานะอื่นที่ไม่นับใน Plan/Actual — ไม่แสดง
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
          salesRows.push([p.registerDate || '', m.name, cat.label, p.projectName || '-', d ? d.name : '-', counted, p.status || '']);
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
  ST.getAll('dealers').forEach(function(d) { if (d.saleName && !known[d.saleName]) extra[d.saleName] = true; });
  ST.getAll('pipeline').forEach(function(p) { if (p.saleName && !known[p.saleName]) extra[p.saleName] = true; });
  var extraList = Object.keys(extra).map(function(n) { return { id: 'freename_' + n, name: n, active: true, freeText: true }; });
  return registered.concat(extraList).sort(function(a, b) { return (a.name || '').localeCompare(b.name || '', 'th'); });
}

function rKpiScorecard(el) {
  document.getElementById('pgT').textContent = '📊 KPI เซลล์';
  var members = kpiSalesOptions();

  if (!members.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:30px">ยังไม่มีรายชื่อเซลล์ — เพิ่มได้ที่เมนู ⚙️ ตั้งค่า &gt; ทีมขาย</div>';
    return;
  }
  if (!kpiSelectedSalesId || !members.some(function(m) { return m.id === kpiSelectedSalesId; })) {
    kpiSelectedSalesId = members[0].id;
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
  h += '</div>';

  if (!plan) {
    h += '<div class="card" style="text-align:center;padding:30px">ยังไม่มีแผน KPI ของ ' + sanitize(member.name) + ' — กด "➕ สร้างไตรมาสใหม่"</div>';
    el.innerHTML = h;
    return;
  }

  var overall = kpiOverallScore(plan);
  var overallColor = overall >= 100 ? '#22c55e' : overall >= 70 ? '#3b82f6' : overall >= 40 ? '#eab308' : '#ef4444';
  var time = kpiQuarterTimeProgress(plan);
  var doneCount = (plan.categories || []).filter(function(cat) { return kpiAchievementPct(plan, cat) >= 100; }).length;

  // เทียบกับไตรมาสก่อน
  var prevPlan = kpiPrevPlan(member.id, plan);
  var trendHtml = '';
  if (prevPlan) {
    var prevScore = kpiOverallScore(prevPlan);
    var delta = Math.round((overall - prevScore) * 10) / 10;
    var trendColor = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#94a3b8';
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

  h += '<div class="kpi-sc-grid">';
  (plan.categories || []).forEach(function(cat) {
    var actual = kpiComputeActual(plan, cat);
    var pct = kpiAchievementPct(plan, cat);
    var pctShow = Math.min(pct, 100);
    var isDone = pct >= 100;
    var barColor = pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#ef4444';
    var actualShow = cat.type === 'pipelineRevenue' ? fmtMoneyShort(actual) : actual;
    var targetShow = cat.type === 'pipelineRevenue' ? fmtMoneyShort(cat.target) : cat.target;
    var pace = kpiPaceInfo(plan, cat);
    var paceMeta = KPI_PACE_META[pace.status];
    var potential = (cat.type === 'pipelineRevenue' || cat.type === 'pipelineModelQty') ? kpiPotentialAmount(plan, cat) : 0;
    var potentialPct = potential ? Math.min((actual + potential) / (Number(cat.target) || 1) * 100, 100) : 0;

    // เดือนนี้ — เป้า/ทำได้ (รายเดือน 1/3)
    var monthHtml = '';
    var mb = kpiMonthlyBreakdown(plan, cat);
    if (mb) {
      var curMonth = mb.filter(function(m) { return m.isCurrent; })[0];
      if (curMonth) {
        var mShow = cat.type === 'pipelineRevenue' ? fmtMoneyShort(curMonth.actual) + '/' + fmtMoneyShort(curMonth.target) : Math.round(curMonth.actual) + '/' + Math.round(curMonth.target);
        monthHtml = '<div class="kpi-sc-month">📅 เดือนนี้: ' + mShow + ' ' + (cat.unit || '') + '</div>';
      }
    }

    h += '<div class="kpi-sc-card' + (isDone ? ' done' : '') + '" onclick="showKpiDetailM(\'' + plan.id + '\',\'' + cat.id + '\')">';
    if (isDone) h += '<div class="kpi-sc-ribbon">🎉</div>';
    h += '<div class="kpi-sc-top"><span class="kpi-sc-icon">' + cat.icon + '</span><span class="kpi-sc-weight">น้ำหนัก ' + cat.weight + '%</span></div>';
    h += '<div class="kpi-sc-label">' + sanitize(cat.label) + '</div>';
    h += '<div class="kpi-sc-bar">';
    if (potentialPct > pctShow) h += '<div class="kpi-sc-bar-potential" style="width:' + potentialPct + '%"></div>';
    h += '<div class="kpi-sc-bar-fill" style="width:' + pctShow + '%;background:' + barColor + '"></div>';
    h += '</div>';
    h += '<div class="kpi-sc-nums"><span>' + actualShow + ' / ' + targetShow + ' ' + (cat.unit || '') + '</span><b style="color:' + barColor + '">' + Math.round(pct) + '%</b></div>';
    h += '<div class="kpi-sc-pace" style="color:' + paceMeta.color + '">' + paceMeta.label + '</div>';
    h += monthHtml;
    h += '</div>';
  });
  h += '</div>';

  // 🌱 Top deals ที่ควรปิดให้ถึงเป้า — ตารางค้นหา/กรอง/จัดเรียงได้ (2026-08-26 ตามคำขอ)
  var topDeals = kpiTopPotentialDeals(plan);
  if (topDeals) {
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

    h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.74rem;white-space:nowrap">';
    h += '<thead><tr style="border-bottom:1px solid var(--border)">' +
      '<th style="text-align:left;padding:5px 6px;color:var(--text2)">No.</th>' +
      '<th style="text-align:left;padding:5px 6px;color:var(--text2)">โครงการ</th>' +
      '<th style="text-align:left;padding:5px 6px;color:var(--text2)">End user</th>' +
      '<th style="text-align:left;padding:5px 6px;color:var(--text2)">Dealer</th>' +
      '<th style="text-align:left;padding:5px 6px;color:var(--text2)">รายการสินค้า</th>' +
      '<th style="text-align:right;padding:5px 6px;color:var(--text2)">มูลค่า</th>' +
      '<th style="text-align:left;padding:5px 6px;color:var(--text2)">สถานะ</th>' +
      '<th style="text-align:left;padding:5px 6px;color:var(--text2)">Forecast</th>' +
      '<th style="text-align:left;padding:5px 6px;color:var(--text2)">อัพเดทล่าสุด</th></tr></thead><tbody>';
    if (!filtered.length) {
      h += '<tr><td colspan="9" style="text-align:center;padding:14px;color:var(--text2)">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>';
    }
    filtered.forEach(function(r) {
      var p = r.p;
      var fcBadge = r.fc ? ('<span class="tag" style="background:' + (r.fc.inQuarter ? '#22c55e18;color:#16803c' : '#94a3b818;color:#64748b') + '">' + sanitize(r.fc.label) + (r.fc.inQuarter ? ' ✓' : '') + '</span>') : '<span style="color:var(--text2)">-</span>';
      var updHtml = r.lastLog ? (sanitize((r.lastLog.content || '').substr(0, 40)) + '<div style="color:var(--text2);font-size:.64rem">' + fD(r.lastLog.date) + '</div>') : '<span style="color:var(--text2)">-</span>';
      h += '<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">' +
        '<td style="padding:6px;color:var(--text2)">' + (p.rowNo || '-') + '</td>' +
        '<td style="padding:6px;max-width:200px;white-space:normal">' + sanitize(p.projectName || '-') + '</td>' +
        '<td style="padding:6px;color:var(--text2)">' + sanitize(p.endUserTH || p.endUserEN || '-') + '</td>' +
        '<td style="padding:6px">' + sanitize(r.dealer ? r.dealer.name : '-') + '</td>' +
        '<td style="padding:6px;color:var(--text2)">' + sanitize(r.items || '-') + '</td>' +
        '<td style="padding:6px;text-align:right;font-weight:600">' + fmtMoneyShort(p.forecastAmount) + '</td>' +
        '<td style="padding:6px">' + (typeof pipeTag === 'function' ? pipeTag(p.status) : sanitize(p.status || '-')) + '</td>' +
        '<td style="padding:6px">' + fcBadge + '</td>' +
        '<td style="padding:6px;color:var(--text2)">' + updHtml + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '</div>';
  }

  // 🎯 แผนดัน Dealer ให้ถึงเป้ายอดขาย — มุมมองระดับ Dealer (แยกจากมุมมองระดับดีลของการ์ด "Top deals" ด้านบน)
  var dealerPlan = kpiDealerPlanBreakdown(plan);
  if (dealerPlan && dealerPlan.rows.length) {
    var dpRemain = Math.max(dealerPlan.target - dealerPlan.actual, 0);
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
          var planMark = dl.state === 'plan' ? '<span style="color:#3b82f6;font-weight:700">✓</span>' : '<span style="color:var(--text2)">–</span>';
          var actualMark = dl.state === 'actual' ? '<span style="color:#22c55e;font-weight:600">✓ ' + dl.actualType + '</span>' : '<span style="color:var(--text2)">–</span>';
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

function _kpiRecordRowHtml(r, cat) {
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
  return [String(r.rowNo || ''), r.projectName, (dl ? dl.name : '')].some(function(s) { return (s || '').toLowerCase().indexOf(q) !== -1; });
}

function _kpiRecordsListHtml(records, cat) {
  if (!records.length) return '<div style="color:var(--text2);font-size:12px;text-align:center;padding:10px">ยังไม่มีรายการ</div>';
  return records.map(function(r) { return _kpiRecordRowHtml(r, cat); }).join('');
}

function _kpiRecordsFilterList(planId, categoryId) {
  var plan = getKpiQuarterPlans().filter(function(p) { return p.id === planId; })[0];
  if (!plan) return;
  var cat = plan.categories.filter(function(c) { return c.id === categoryId; })[0];
  if (!cat) return;
  var q = (document.getElementById('kpi_records_search').value || '').trim().toLowerCase();
  var all = kpiContributingRecords(plan, cat);
  var filtered = q ? all.filter(function(r) { return _kpiRecordMatchesQuery(r, cat, q); }) : all;
  document.getElementById('kpi_records_list').innerHTML = _kpiRecordsListHtml(filtered, cat);
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
        var mColor = m.pct >= 100 ? '#22c55e' : m.pct >= 50 ? '#3b82f6' : '#ef4444';
        var mActualShow = isMoney ? fmtMoneyShort(m.actual) : Math.round(m.actual * 10) / 10;
        var mTargetShow = isMoney ? fmtMoneyShort(m.target) : Math.round(m.target * 10) / 10;
        h += '<div class="kpi-month-cell' + (m.isCurrent ? ' cur' : '') + '">';
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
    h += '<div style="max-height:240px;overflow-y:auto" id="kpi_records_list">' + _kpiRecordsListHtml(records, cat) + '</div>';

    var potentialRecords = kpiPotentialRecords(plan, cat);
    if (potentialRecords.length) {
      var potentialAmt = kpiPotentialAmount(plan, cat);
      h += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">';
      h += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">🌱 ดีลที่ยังไม่ปิด แต่มีลุ้น (' + potentialRecords.length + ' รายการ — รวม ' + (isMoney ? fmtMoneyShort(potentialAmt) : potentialAmt) + ' ' + (cat.unit || '') + ')</div>';
      h += '<div style="max-height:200px;overflow-y:auto">';
      potentialRecords.forEach(function(p) {
        var dl3 = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
        h += '<div class="kpi-detail-row" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">🌱 ' + sanitize(p.projectName || (dl3 ? dl3.name : '') || '-') + ' — ' + fmtMoneyShort(p.forecastAmount) + '</div>';
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
