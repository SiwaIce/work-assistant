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
function kpiQuarterRange(q, year) {
  var startMonth = (q - 1) * 3;
  var start = new Date(year, startMonth, 1);
  var end = new Date(year, startMonth + 3, 0);
  function iso(d) { return d.toISOString().split('T')[0]; }
  return { startDate: iso(start), endDate: iso(end) };
}

var kpiSelectedSalesId = null;
var kpiSelectedPlanId = null;

function kpiGetPlansForSales(salesMemberId) {
  return getKpiQuarterPlans().filter(function(p) { return p.salesMemberId === salesMemberId; })
    .sort(function(a, b) { return (a.startDate || '').localeCompare(b.startDate || ''); });
}

function kpiCreateQuarterPlan(salesMemberId, salesMemberName) {
  var cur = kpiGetCurrentQuarter();
  var range = kpiQuarterRange(cur.q, cur.year);
  var prevPlans = kpiGetPlansForSales(salesMemberId);
  var template = prevPlans.length ? prevPlans[prevPlans.length - 1].categories : KPI_DEFAULT_CATEGORIES;
  var plan = {
    id: 'kpiq_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    quarter: cur.quarter, startDate: range.startDate, endDate: range.endDate,
    salesMemberId: salesMemberId, salesMemberName: salesMemberName,
    categories: JSON.parse(JSON.stringify(template)),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  var plans = getKpiQuarterPlans();
  plans.push(plan);
  saveKpiQuarterPlans(plans);
  return plan;
}

// ================================================================
// คำนวณ actual ต่อ category type
// ================================================================
function kpiComputeActual(plan, cat) {
  if (cat.type === 'manualScore') return Number(cat.manualValue) || 0;

  if (cat.type === 'pipelineRevenue') {
    var sum = 0;
    ST.getAll('pipeline').forEach(function(p) {
      if (['win', 'ordered', 'delivered'].indexOf(p.status) === -1) return;
      if ((p.saleName || '') !== plan.salesMemberName) return;
      var rd = p.registerDate || '';
      if (rd < plan.startDate || rd > plan.endDate) return;
      sum += Number(p.forecastAmount) || 0;
    });
    return sum;
  }

  if (cat.type === 'pipelineModelQty') {
    var qty = 0;
    var keywords = (cat.modelMatch || []).map(function(s) { return s.toLowerCase(); });
    ST.getAll('pipeline').forEach(function(p) {
      if (['win', 'ordered', 'delivered'].indexOf(p.status) === -1) return;
      if ((p.saleName || '') !== plan.salesMemberName) return;
      var rd = p.registerDate || '';
      if (rd < plan.startDate || rd > plan.endDate) return;
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
      return d.authorizedDate >= plan.startDate && d.authorizedDate <= plan.endDate;
    }).length;
  }

  if (cat.type === 'visitCount') {
    return ST.getAll('visits').filter(function(v) {
      var vd = v.date || '';
      return vd >= plan.startDate && vd <= plan.endDate;
    }).length;
  }

  return 0;
}

function kpiContributingRecords(plan, cat) {
  if (cat.type === 'pipelineRevenue' || cat.type === 'pipelineModelQty') {
    var keywords = (cat.modelMatch || []).map(function(s) { return s.toLowerCase(); });
    return ST.getAll('pipeline').filter(function(p) {
      if (['win', 'ordered', 'delivered'].indexOf(p.status) === -1) return false;
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
var KPI_PIPE_ACTIVE_STATUSES = ['prospect', 'tor_review', 'quotation', 'bidding', 'negotiation'];

function kpiPotentialRecords(plan, cat) {
  if (cat.type !== 'pipelineRevenue' && cat.type !== 'pipelineModelQty') return [];
  var keywords = (cat.modelMatch || []).map(function(s) { return s.toLowerCase(); });
  return ST.getAll('pipeline').filter(function(p) {
    if (KPI_PIPE_ACTIVE_STATUSES.indexOf(p.status) === -1) return false;
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
// ลิงก์ไปทำต่อ — กดจาก drill-down ไปหน้าที่เกี่ยวข้องได้ทันที
// ================================================================
function kpiCategoryCTA(cat) {
  if (cat.type === 'visitCount') return { label: '📍 ไปบันทึก Visit Report', action: "go('visits')" };
  if (cat.type === 'dealerAuthorized') return { label: '🏪 ไปดู Dealer ที่ยังไม่ Authorized', action: "dealerFilter='other';go('dealers')" };
  if (cat.type === 'pipelineRevenue' || cat.type === 'pipelineModelQty') return { label: '📊 ไปดู Pipeline ทั้งหมด', action: "go('pipeline')" };
  return null;
}

// ================================================================
// หน้าหลัก: Scorecard
// ================================================================
function rKpiScorecard(el) {
  document.getElementById('pgT').textContent = '📊 KPI เซลล์';
  var members = (typeof getSalesMembers === 'function' ? getSalesMembers() : []).filter(function(m) { return m.active !== false; });

  if (!members.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:30px">ยังไม่มีรายชื่อเซลล์ — เพิ่มได้ที่เมนู ⚙️ ตั้งค่า &gt; ทีมขาย</div>';
    return;
  }
  if (!kpiSelectedSalesId || !members.some(function(m) { return m.id === kpiSelectedSalesId; })) {
    kpiSelectedSalesId = members[0].id;
  }
  var member = members.filter(function(m) { return m.id === kpiSelectedSalesId; })[0];

  var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center">';
  h += '<select class="fm-input" style="min-width:160px" onchange="kpiSelectedSalesId=this.value;kpiSelectedPlanId=null;render()">';
  members.forEach(function(m) {
    h += '<option value="' + m.id + '"' + (m.id === kpiSelectedSalesId ? ' selected' : '') + '>' + sanitize(m.name) + '</option>';
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
  h += '<button class="btn bsm bo" onclick="kpiSelectedPlanId=kpiCreateQuarterPlan(\'' + member.id + '\',\'' + sanitize(member.name).replace(/'/g, "\\'") + '\').id;render()">➕ สร้างไตรมาสใหม่</button>';
  if (plan) h += '<button class="btn bsm bo" onclick="showKpiConfigM(\'' + plan.id + '\')">⚙️ ตั้งค่าไตรมาสนี้</button>';
  h += '</div>';

  if (!plan) {
    h += '<div class="card" style="text-align:center;padding:30px">ยังไม่มีแผน KPI ของ ' + sanitize(member.name) + ' — กด "➕ สร้างไตรมาสใหม่"</div>';
    el.innerHTML = h;
    return;
  }

  var overall = kpiOverallScore(plan);
  var overallColor = overall >= 100 ? '#22c55e' : overall >= 70 ? '#3b82f6' : overall >= 40 ? '#eab308' : '#ef4444';
  var time = kpiQuarterTimeProgress(plan);
  h += '<div class="card kpi-overall-card">';
  h += '<div class="kpi-overall-row">';
  h += '<div class="kpi-overall-block"><div class="kpi-overall-num" style="color:' + overallColor + '">' + overall + '%</div><div class="kpi-overall-label">คะแนนรวม KPI</div></div>';
  h += '<div class="kpi-overall-divider"></div>';
  h += '<div class="kpi-overall-block"><div class="kpi-overall-num kpi-time-num">' + Math.round(time.expectedPct) + '%</div><div class="kpi-overall-label">เวลาผ่านไป — เหลือ ' + time.remainingDays + ' วัน</div></div>';
  h += '</div>';
  h += '<div class="kpi-overall-sub">' + sanitize(plan.quarter) + ' — ' + sanitize(member.name) + '</div>';
  h += '</div>';

  h += '<div class="kpi-sc-grid">';
  (plan.categories || []).forEach(function(cat) {
    var actual = kpiComputeActual(plan, cat);
    var pct = kpiAchievementPct(plan, cat);
    var pctShow = Math.min(pct, 100);
    var barColor = pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#ef4444';
    var actualShow = cat.type === 'pipelineRevenue' ? fmtMoneyShort(actual) : actual;
    var targetShow = cat.type === 'pipelineRevenue' ? fmtMoneyShort(cat.target) : cat.target;
    var pace = kpiPaceInfo(plan, cat);
    var paceMeta = KPI_PACE_META[pace.status];
    var potential = (cat.type === 'pipelineRevenue' || cat.type === 'pipelineModelQty') ? kpiPotentialAmount(plan, cat) : 0;
    var potentialPct = potential ? Math.min((actual + potential) / (Number(cat.target) || 1) * 100, 100) : 0;

    h += '<div class="kpi-sc-card" onclick="showKpiDetailM(\'' + plan.id + '\',\'' + cat.id + '\')">';
    h += '<div class="kpi-sc-top"><span class="kpi-sc-icon">' + cat.icon + '</span><span class="kpi-sc-weight">น้ำหนัก ' + cat.weight + '%</span></div>';
    h += '<div class="kpi-sc-label">' + sanitize(cat.label) + '</div>';
    h += '<div class="kpi-sc-bar">';
    if (potentialPct > pctShow) h += '<div class="kpi-sc-bar-potential" style="width:' + potentialPct + '%"></div>';
    h += '<div class="kpi-sc-bar-fill" style="width:' + pctShow + '%;background:' + barColor + '"></div>';
    h += '</div>';
    h += '<div class="kpi-sc-nums"><span>' + actualShow + ' / ' + targetShow + ' ' + (cat.unit || '') + '</span><b style="color:' + barColor + '">' + Math.round(pct) + '%</b></div>';
    h += '<div class="kpi-sc-pace" style="color:' + paceMeta.color + '">' + paceMeta.label + '</div>';
    h += '</div>';
  });
  h += '</div>';

  el.innerHTML = h;
}

// ================================================================
// Drill-down รายหัวข้อ
// ================================================================
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
    var records = kpiContributingRecords(plan, cat);
    h += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">รายการที่นับเข้า KPI นี้ (' + records.length + ')</div>';
    h += '<div style="max-height:240px;overflow-y:auto">';
    if (!records.length) h += '<div style="color:var(--text2);font-size:12px;text-align:center;padding:10px">ยังไม่มีรายการ</div>';
    records.forEach(function(r) {
      if (cat.type === 'visitCount') {
        var dl = r.dealerId ? ST.getOne('dealers', r.dealerId) : null;
        h += '<div class="kpi-detail-row" onclick="closeMForce();go(\'dealerDetail\',{dealerId:\'' + (r.dealerId || '') + '\'})">📍 ' + fD(r.date) + ' — ' + sanitize(dl ? dl.name : (r.summary || '-')) + '</div>';
      } else if (cat.type === 'dealerAuthorized') {
        h += '<div class="kpi-detail-row" onclick="closeMForce();go(\'dealerDetail\',{dealerId:\'' + r.id + '\'})">🤝 ' + sanitize(r.name) + ' — ' + fD(r.authorizedDate) + '</div>';
      } else {
        var dl2 = r.dealerId ? ST.getOne('dealers', r.dealerId) : null;
        h += '<div class="kpi-detail-row" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + r.id + '\'})">📦 ' + sanitize(r.projectName || (dl2 ? dl2.name : '') || '-') + ' — ' + fmtMoneyShort(r.forecastAmount) + '</div>';
      }
    });
    h += '</div>';

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
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">📝 บันทึกเพิ่มเติม</div>';
  var logs = getKpiQuarterLogs().filter(function(l) { return l.planId === planId && l.categoryId === categoryId; })
    .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
  logs.forEach(function(l) {
    h += '<div style="font-size:11px;color:var(--text2);padding:4px 0;border-bottom:1px solid var(--border-light)">' + fD(l.date) + ' — ' + sanitize(l.note) + '</div>';
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
    note: note, createdAt: new Date().toISOString()
  });
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

  var h = '<div id="kpi_cfg_rows">';
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
  plan.categories = cats;
  plan.updatedAt = new Date().toISOString();
  saveKpiQuarterPlans(plans);
  toast('⚙️ บันทึกการตั้งค่าแล้ว');
  closeMForce();
  render();
}
