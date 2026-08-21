// ================================================================
// KPI COMPANY PLAN — แผนบรรลุเป้ารายบริษัท (SAB Partner) โจทย์จาก Ryan: รวบรวมว่าบริษัทไหนเป้าเท่าไหร่
// ทำได้เท่าไหร่ ต้องทำอีกเท่าไหร่ + แผนรายเดือนแยก Project/Runrate เพื่อดูว่าจะถึงเป้าไหม เดือนไหนต้องเร่ง
// ตัวเลขทั้งหมดคำนวณจาก computeKpiCompanyPlan/computeKpiCompanyPlanAll (utils.js) — ไม่มีตัวเลขสมมติ
// ================================================================
var kpiPlanExpandedId = null;
var kpiPlanClosingOpen = {}; // key = dealerId+'|'+month → true ถ้าขยายดูรายการ "โครงการคาดปิด" ของเดือนนั้นอยู่

// สถานะ/เปอร์เซ็นต์อิงยอดขาย SIS จริงล้วนๆ (ตัวเลขบัญชี น่าเชื่อถือสุด) — ไม่ผสม Pipeline/Runrate เข้ามาคำนวณอีกแล้ว
// เพราะเป็นคนละแหล่งข้อมูล โชว์แยกเป็น "โอกาสเพิ่มเติม" ต่างหากแทน (ดู kpiPlanRowHtml)
function kpiPlanSisActual(p) {
  var hKey = p.half === 'H1' ? 'h1' : 'h2';
  return (p.sisQuarters && p.sisQuarters[hKey]) || 0;
}
function kpiPlanStatus(p) {
  var sisActual = kpiPlanSisActual(p);
  var ratio = p.target ? sisActual / p.target : 1;
  if (ratio >= 1) return { cls: 'stat-good-t', bg: 'rgba(74,222,128,.12)', label: 'ถึงเป้าแล้ว' };
  if (ratio >= 0.75) return { cls: 'stat-warn-t', bg: 'rgba(251,191,36,.12)', label: 'ต้องเร่ง' };
  return { cls: 'stat-bad-t', bg: 'rgba(248,113,113,.12)', label: 'เสี่ยงสูง' };
}

// ================================================================
// แถบเตือนที่หน้า "วันนี้" — เรียกจาก views-today.js (rToday, แท็บสรุป) แบบเดียวกับ kpiTodayBehindBanner
// ของระบบ KPI เซล ใช้ style class .kpi-today-banner ตัวเดียวกัน ไม่ต้องเพิ่ม CSS ใหม่
// แจ้ง 2 เรื่อง: บริษัทเสี่ยงไม่ถึงเป้า (SIS จริง) และบริษัทที่ยอด DJI(Pipeline)/SIS ต่างกันเกิน 10%
// ================================================================
function kpiPlanTodayBanner() {
  if (typeof computeKpiCompanyPlanAll !== 'function') return '';
  var plans;
  try { plans = computeKpiCompanyPlanAll(getConfig()); } catch (e) { return ''; }
  if (!plans.length) return '';

  var riskItems = [], mismatchItems = [], noPlanItems = [];
  plans.forEach(function(p) {
    var isRisk = kpiPlanStatus(p).label !== 'ถึงเป้าแล้ว';
    if (isRisk) riskItems.push(p);
    if (isRisk && typeof getImprovementActions === 'function' && !getImprovementActions(p.dealer.id).length) noPlanItems.push(p);
    var sisActual = kpiPlanSisActual(p);
    var hasProjectData = p.djiActual > 0 || p.pipeWeighted > 0;
    if (hasProjectData && sisActual > 0) {
      var deltaPct = Math.round(Math.abs(p.djiActual - sisActual) / sisActual * 100);
      if (deltaPct > 10) mismatchItems.push(p);
    }
  });
  if (!riskItems.length && !mismatchItems.length) return '';

  var titleParts = [];
  if (riskItems.length) titleParts.push(riskItems.length + ' บริษัทเสี่ยงไม่ถึงเป้า');
  if (noPlanItems.length) titleParts.push(noPlanItems.length + ' บริษัทยังไม่มี Improvement Plan');
  if (mismatchItems.length) titleParts.push(mismatchItems.length + ' บริษัท DJI/SIS ไม่ตรงกัน');
  var subList = noPlanItems.length ? noPlanItems : (riskItems.length ? riskItems : mismatchItems);
  var subNames = subList.slice(0, 3).map(function(p) { return sanitize(p.dealer.name); });

  var h = '<div class="card kpi-today-banner" onclick="go(\'kpiCompanyPlan\')">';
  h += '<div class="kpi-today-banner-title">⚠️ แผนบรรลุเป้า KPI — ' + titleParts.join(' · ') + '</div>';
  h += '<div class="kpi-today-banner-sub">' + subNames.join(' · ') + (subList.length > 3 ? ' ...' : '') + ' — กดดูรายละเอียด →</div>';
  h += '</div>';
  return h;
}

function rKpiCompanyPlan(el) {
  document.getElementById('pgT').textContent = '🎯 แผนบรรลุเป้า KPI';
  var cfg = getConfig();
  var plans = computeKpiCompanyPlanAll(cfg);

  var h = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '';

  if (!plans.length) {
    h += '<div class="card"><div class="empty"><p>ยังไม่มีบริษัทระดับ S/A/B ในขอบเขตที่ดูอยู่ตอนนี้</p></div></div>';
    el.innerHTML = h;
    return;
  }

  var half = plans[0].half;
  var hKey = half === 'H1' ? 'h1' : 'h2';
  var totalTarget = 0, totalPipe = 0, totalSis = 0, riskCount = 0;
  var yoyCur = 0, yoyPrev = 0;
  plans.forEach(function(p) {
    totalTarget += p.target; totalPipe += p.pipeWeighted;
    totalSis += (p.sisQuarters && p.sisQuarters[hKey]) || 0;
    var yoy = getSisYoy(p.dealer, p.sisYear, hKey);
    yoyCur += yoy.cur; yoyPrev += yoy.prev;
    if (kpiPlanStatus(p).label !== 'ถึงเป้าแล้ว') riskCount++;
  });
  var totalGap = Math.max(0, totalTarget - totalSis);
  var yoyPct = yoyPrev > 0 ? Math.round((yoyCur - yoyPrev) / yoyPrev * 100) : (yoyCur > 0 ? 100 : 0);

  h += '<div class="card"><h2>🎯 แผนบรรลุเป้า KPI — SAB Partner (' + half + ')</h2>';
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">เป้า/ยอดขาย SIS จริง/Pipeline ในมือ (ถ่วง POS) ของแต่ละบริษัท พร้อมแผนรายเดือนแยก Project/Runrate — สำหรับสรุปให้ Ryan</div>';
  h += '<div style="font-size:11px;color:var(--text3);line-height:1.7;background:var(--bg2);border-radius:9px;padding:8px 12px;margin-bottom:12px">' +
    '<b style="color:#0891b2">DJI จริง</b> = ยอดในระบบ CRM ของ DJI (Sell-in) &nbsp;·&nbsp; ' +
    '<b style="color:#8b5cf6">SIS จริง</b> = ยอดขายจริงในระบบ SIS (Sell-out) — ใช้ค่านี้เป็นหลักในการคำนวณ % และเป้า &nbsp;·&nbsp; ' +
    '<b>Pipeline</b> = โครงการที่มี แต่ยังปิดงานไม่ได้ ยังนับเป็นยอดขายไม่ได้ (มี "Forecast ถ่วง POS" แสดงแยกให้ในแต่ละบริษัท)' +
    '</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px">';
  h += kpiPlanSumCard('🎯 เป้ารวม ' + half + ' ✏️', fmtMoneyShort(totalTarget), '', 'showKpiPlanTargetsM()');
  h += kpiPlanSumCard('💰 ยอดขาย SIS จริง', fmtMoneyShort(totalSis), 'kpi-sum-sis', '', totalTarget ? Math.round(totalSis / totalTarget * 100) + '% ของเป้า' : '');
  h += kpiPlanSumCard('📊 Pipeline ในมือ', fmtMoneyShort(totalPipe));
  h += kpiPlanSumCard('ยังขาดอีก', totalGap > 0 ? fmtMoneyShort(totalGap) : 'ถึงเป้าแล้ว', totalGap > 0 ? 'stat-bad-t' : 'stat-good-t');
  h += kpiPlanSumCard('⚠️ เสี่ยงไม่ถึงเป้า', riskCount + ' / ' + plans.length, riskCount ? 'stat-bad-t' : 'stat-good-t');
  h += kpiPlanSumCard('📈 YoY', (yoyPct >= 0 ? '+' : '') + yoyPct + '%', yoyPct >= 0 ? 'stat-good-t' : 'stat-bad-t', '', 'เทียบ ' + half + ' ปีที่แล้ว');
  h += '</div>';
  h += '<button class="btn bsm bo" onclick="copyKpiPlanSummary()">📋 คัดลอกสรุปส่ง Ryan</button>';
  h += '</div>';

  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px">';
  plans.forEach(function(p) { h += kpiPlanRowHtml(p); });
  h += '</div>';

  el.innerHTML = h;
}

function kpiPlanSumCard(label, val, colorCls, onclick, sub) {
  var isSis = colorCls === 'kpi-sum-sis';
  var valStyle = 'font-size:17px;font-weight:700;margin-top:2px' + (isSis ? ';color:#8b5cf6' : '');
  return '<div style="background:var(--bg2);border-radius:10px;padding:10px 12px' + (onclick ? ';cursor:pointer' : '') + (isSis ? ';background:linear-gradient(135deg,rgba(139,92,246,.12),var(--bg2))' : '') + '"' + (onclick ? ' onclick="' + onclick + '"' : '') + '>' +
    '<div style="font-size:10.5px;color:var(--text2);text-transform:uppercase;letter-spacing:.02em">' + label + '</div>' +
    '<div style="' + valStyle + '" class="' + (isSis ? '' : (colorCls || '')) + '">' + val + '</div>' +
    (sub ? '<div style="font-size:10px;color:var(--text3);margin-top:1px">' + sub + '</div>' : '') +
    '</div>';
}

// ================================================================
// ตั้ง/แก้ไขเป้ายอดขาย H1/H2 รายบริษัท — แก้ตรงนี้เขียนกลับไปที่ dealer.targetH1/targetH2 โดยตรง
// (ต้นทางเดียวกับฟอร์ม Dealer เต็ม ⁠— ดู showDealerM ใน modals.js) ไม่ได้เก็บซ้ำที่อื่น
// ================================================================
function showKpiPlanTargetsM(focusDealerId) {
  var plans = computeKpiCompanyPlanAll(getConfig());
  if (!plans.length) return toast('ยังไม่มีบริษัทระดับ S/A/B ในขอบเขตนี้');
  var cfg = getConfig();
  var h = '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">แก้ตรงนี้จะบันทึกไปที่ข้อมูลบริษัท (ต้นทาง) โดยตรง — กด 🔗 เพื่อเปิดฟอร์มบริษัทเต็มถ้าต้องแก้ข้อมูลอื่นด้วย</div>';
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">แถวไหนมีเป้าตาม Level (S/A/B) ตั้งไว้ กดปุ่ม "↺ ใช้เป้า Level" เพื่อดึงมาใส่ให้เลย — จะไปแก้ตัวเลขเป้าตาม Level เอง กด "⚙️ ตั้งค่าเป้าตาม Level (ต้นทาง)" ด้านล่าง</div>';
  h += '<div style="display:flex;font-size:10.5px;color:var(--text2);padding:0 0 4px;gap:8px"><div style="flex:1">บริษัท</div><div style="width:100px">H1 (฿)</div><div style="width:100px">H2 (฿)</div></div>';
  h += plans.map(function(p) {
    var d = p.dealer;
    var lvlReq = cfg.levelRequirements && cfg.levelRequirements[d.level];
    var lvlLine = '';
    if (lvlReq && (lvlReq.h1Target || lvlReq.h2Target)) {
      lvlLine = '<div style="font-size:10.5px;color:var(--text2);margin-top:2px">เป้า Level ' + sanitize(d.level) + ': ฿' + fmtMoneyShort(lvlReq.h1Target || 0) + ' / ฿' + fmtMoneyShort(lvlReq.h2Target || 0) +
        ' <a style="color:var(--accent);cursor:pointer;font-weight:600" onclick="kpiPlanApplyLevelTarget(\'' + d.id + '\',' + (Number(lvlReq.h1Target) || 0) + ',' + (Number(lvlReq.h2Target) || 0) + ')">↺ ใช้เป้า Level</a></div>';
    }
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)" id="kpitgt_row_' + d.id + '">' +
      '<div style="flex:1;font-size:12.5px;font-weight:600;min-width:0">' + sanitize(d.name) +
      ' <a style="font-size:11px;font-weight:400;color:var(--accent);cursor:pointer;white-space:nowrap" onclick="closeMForce();showDealerM(\'' + d.id + '\')">🔗 ไปหน้าบริษัท</a>' + lvlLine + '</div>' +
      '<input type="text" inputmode="decimal" class="js-money" style="width:100px" id="kpitgt_h1_' + d.id + '" value="' + nmI(d.targetH1 || 0) + '">' +
      '<input type="text" inputmode="decimal" class="js-money" style="width:100px" id="kpitgt_h2_' + d.id + '" value="' + nmI(d.targetH2 || 0) + '">' +
      '</div>';
  }).join('');
  h += '<button class="btn bp btn-full" style="margin-top:10px" onclick="saveKpiPlanTargets()">💾 บันทึกเป้าทั้งหมด</button>';
  h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="kpiPlanGotoLevelSource()">⚙️ ตั้งค่าเป้าตาม Level (ต้นทาง)</button>';
  openM('🎯 ตั้งเป้ายอดขาย H1/H2 รายบริษัท', h);
  if (focusDealerId) {
    var row = document.getElementById('kpitgt_row_' + focusDealerId);
    if (row) { row.style.background = 'var(--accent-light)'; row.scrollIntoView({ block: 'center' }); }
  }
}

function kpiPlanApplyLevelTarget(dealerId, h1, h2) {
  var h1El = document.getElementById('kpitgt_h1_' + dealerId);
  var h2El = document.getElementById('kpitgt_h2_' + dealerId);
  if (h1El) h1El.value = nmI(h1);
  if (h2El) h2El.value = nmI(h2);
  toast('↺ ใส่เป้าตาม Level แล้ว — อย่าลืมกด "บันทึกเป้าทั้งหมด"');
}

// เปิด Admin > แท็บข้อมูล > การ์ด Partner Level Requirements (ต้นทางจริงของเป้าตาม Level) พร้อมสลับไปแท็บ level ที่ระบุ
function kpiPlanGotoLevelSource(level) {
  closeMForce();
  localStorage.setItem('v7_admin_tab', 'data');
  go('admin');
  setTimeout(function() {
    if (level) {
      var tab = document.querySelector('#reqLevelTabs .ftab[data-level="' + level + '"]');
      if (tab) tab.click();
    }
    var anchor = document.getElementById('reqLevelTabs');
    if (anchor) anchor.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 150);
}

function saveKpiPlanTargets() {
  var plans = computeKpiCompanyPlanAll(getConfig());
  var changed = 0;
  plans.forEach(function(p) {
    var d = p.dealer;
    var h1El = document.getElementById('kpitgt_h1_' + d.id);
    var h2El = document.getElementById('kpitgt_h2_' + d.id);
    if (!h1El || !h2El) return;
    var h1 = parseNum(h1El.value), h2 = parseNum(h2El.value);
    if (h1 !== (Number(d.targetH1) || 0) || h2 !== (Number(d.targetH2) || 0)) {
      ST.update('dealers', d.id, { targetH1: h1, targetH2: h2, targetRevenue: h1 + h2 });
      changed++;
    }
  });
  toast(changed ? '💾 บันทึกเป้า ' + changed + ' บริษัทแล้ว' : 'ไม่มีอะไรเปลี่ยนแปลง');
  closeMForce();
  render();
}

var KPI_LEVEL_DOT_COLOR = { S: '#c9a227', A: 'var(--accent)', B: 'var(--text3)', Other: 'var(--text3)' };

function kpiPlanRowHtml(p) {
  var st = kpiPlanStatus(p);
  var sisActual = kpiPlanSisActual(p);
  var gap = p.target - sisActual;
  var isOk = gap <= 0;
  var pct = p.target ? Math.min(100, Math.round(sisActual / p.target * 100)) : 100;
  var isOpen = kpiPlanExpandedId === p.dealer.id;
  var qKeys = p.half === 'H1' ? ['q1', 'q2'] : ['q3', 'q4'];
  var lvlColor = KPI_LEVEL_DOT_COLOR[p.dealer.level] || 'var(--text3)';
  var hasProjectData = p.djiActual > 0 || p.pipeWeighted > 0;
  var maxCmp = Math.max(p.djiActual, sisActual, 1);
  var deltaPct = sisActual > 0 ? Math.round(Math.abs(p.djiActual - sisActual) / sisActual * 100) : 0;

  var h = '<div class="card" style="padding:0;overflow:hidden;grid-column:' + (isOpen ? '1 / -1' : 'auto') + '">';
  h += '<div style="padding:14px 15px;cursor:pointer" onclick="kpiPlanToggleRow(\'' + p.dealer.id + '\')">';

  h += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">';
  h += '<div style="min-width:0"><div style="font-size:15px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(p.dealer.name) + '</div>' +
    '<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text2);margin-top:3px"><span style="width:6px;height:6px;border-radius:50%;background:' + lvlColor + ';display:inline-block"></span>Level ' + sanitize(p.dealer.level || '-') + '</div></div>';
  h += '<div style="display:flex;gap:4px;flex-shrink:0">';
  h += '<span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;background:' + st.bg + ';white-space:nowrap" class="' + st.cls + '" title="คำนวณอัตโนมัติจากตัวเลข">' + st.label + '</span>';
  if (p.dealer.kpiStatusManual) {
    var _mst = KPI_MANUAL_STATUS_OPTS.find(function(o) { return o.key === p.dealer.kpiStatusManual; });
    if (_mst) h += '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:20px;background:' + _mst.bg + ';color:' + _mst.color + ';white-space:nowrap" title="ประเมินเองโดย Sale">' + _mst.icon + '</span>';
  }
  h += '</div>';
  h += '</div>';

  h += '<div style="height:9px;background:var(--bg2);border-radius:99px;overflow:hidden;margin-bottom:3px"><div style="height:100%;width:' + pct + '%;border-radius:99px;background:' + (isOk ? 'linear-gradient(90deg,var(--good,#22c55e),#6ee7a0)' : 'linear-gradient(90deg,#8b5cf6,#b794f6)') + '"></div></div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--text2);margin-bottom:12px"><span>ยอดขาย SIS จริง</span><b style="color:#8b5cf6">' + pct + '%</b></div>';

  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">';
  h += '<div style="background:var(--bg2);border-radius:10px;padding:7px 4px;text-align:center;cursor:pointer" onclick="event.stopPropagation();showKpiPlanTargetsM(\'' + p.dealer.id + '\')" title="กดเพื่อแก้ไขเป้า"><div style="font-size:8.5px;color:var(--text2);font-weight:700;text-transform:uppercase">เป้า ✏️</div><div style="font-size:12.5px;font-weight:800;margin-top:3px">' + fmtMoneyShort(p.target) + '</div></div>';
  h += '<div style="background:rgba(139,92,246,.12);border-radius:10px;padding:7px 4px;text-align:center;cursor:pointer" onclick="event.stopPropagation();kpiPlanShowDrilldown(\'' + p.dealer.id + '\',\'sis\')" title="กดดูรายละเอียดรายเดือน"><div style="font-size:8.5px;color:var(--text2);font-weight:700;text-transform:uppercase">SIS จริง</div><div style="font-size:12.5px;font-weight:800;margin-top:3px;color:#8b5cf6">' + fmtMoneyShort(sisActual) + '</div></div>';
  h += '<div style="background:var(--bg2);border-radius:10px;padding:7px 4px;text-align:center;cursor:pointer" onclick="event.stopPropagation();kpiPlanShowDrilldown(\'' + p.dealer.id + '\',\'gap\')" title="กดดูรายละเอียด"><div style="font-size:8.5px;color:var(--text2);font-weight:700;text-transform:uppercase">' + (isOk ? 'เกินเป้า' : 'ยังขาด') + '</div><div style="font-size:12.5px;font-weight:800;margin-top:3px" class="' + (isOk ? 'stat-good-t' : 'stat-bad-t') + '">' + (isOk ? '✓' : fmtMoneyShort(gap)) + '</div></div>';
  h += '</div>';

  h += '<div style="font-size:9px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.02em;margin-bottom:6px;display:flex;align-items:center;gap:6px">🔍 เทียบ DJI จริง (Sell-in) vs SIS จริง (Sell-out)<span style="flex:1;height:1px;background:var(--border)"></span></div>';
  if (hasProjectData) {
    h += '<div style="background:var(--bg2);border-radius:11px;padding:9px 11px;margin-bottom:12px">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer" onclick="event.stopPropagation();kpiPlanShowDrilldown(\'' + p.dealer.id + '\',\'dji\')" title="กดดูรายการโครงการที่ Won">';
    h += '<span style="font-size:10px;font-weight:700;width:80px;flex:none;color:#0891b2">DJI (Sell-in)</span>';
    h += '<div style="flex:1;height:7px;background:var(--card);border-radius:99px;overflow:hidden"><div style="width:' + Math.round(p.djiActual / maxCmp * 100) + '%;height:100%;background:#0891b2;border-radius:99px"></div></div>';
    h += '<span style="font-size:10.5px;font-weight:800;width:50px;text-align:right;flex:none">' + fmtMoneyShort(p.djiActual) + '</span>';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="event.stopPropagation();kpiPlanShowDrilldown(\'' + p.dealer.id + '\',\'sis\')" title="กดดูรายละเอียดรายเดือน">';
    h += '<span style="font-size:10px;font-weight:700;width:80px;flex:none;color:#8b5cf6">SIS (Sell-out)</span>';
    h += '<div style="flex:1;height:7px;background:var(--card);border-radius:99px;overflow:hidden"><div style="width:' + Math.round(sisActual / maxCmp * 100) + '%;height:100%;background:#8b5cf6;border-radius:99px"></div></div>';
    h += '<span style="font-size:10.5px;font-weight:800;width:50px;text-align:right;flex:none">' + fmtMoneyShort(sisActual) + '</span>';
    h += '</div>';
    h += '<div style="margin-top:7px;padding-top:7px;border-top:1px dashed var(--border);font-size:10.5px;text-align:center;font-weight:700" class="' + (deltaPct <= 10 ? 'stat-good-t' : 'stat-warn-t') + '">' +
      (deltaPct <= 10 ? '✓ ตัวเลขใกล้เคียงกัน' : '⚠️ ต่างกัน ' + deltaPct + '% — เช็ค Pipeline ว่าอัพเดทครบไหม') + '</div>';
    h += '</div>';
  } else {
    h += '<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px 0;margin-bottom:12px">— บริษัทนี้ไม่มีโครงการ (Project) ในระบบ ขายแบบ Runrate อย่างเดียว —</div>';
  }

  h += '<div style="font-size:9px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.02em;margin-bottom:6px;display:flex;align-items:center;gap:6px">💡 โอกาสเพิ่มเติม (ยังไม่นับเป็นยอด)<span style="flex:1;height:1px;background:var(--border)"></span></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
  h += '<div style="background:var(--bg2);border:1px dashed var(--border);border-radius:10px;padding:8px 6px;text-align:center;cursor:pointer" onclick="event.stopPropagation();kpiPlanShowDrilldown(\'' + p.dealer.id + '\',\'pipeline\')" title="กดดูรายการโครงการเปิดอยู่ทั้งหมด"><div style="font-size:8.5px;color:var(--text2);font-weight:700;text-transform:uppercase">📊 Pipeline มูลค่ารวม</div><div style="font-size:12.5px;font-weight:800;margin-top:3px">' + fmtMoneyShort(p.pipelineRawTotal) + '</div></div>';
  h += '<div style="background:var(--bg2);border:1px dashed var(--border);border-radius:10px;padding:8px 6px;text-align:center;cursor:pointer" onclick="event.stopPropagation();kpiPlanShowDrilldown(\'' + p.dealer.id + '\',\'forecast\')" title="มูลค่า Pipeline × POS ของแต่ละโครงการ — กดดูวิธีคำนวณ"><div style="font-size:8.5px;color:var(--text2);font-weight:700;text-transform:uppercase">🎯 Forecast (ถ่วง POS)</div><div style="font-size:12.5px;font-weight:800;margin-top:3px">' + fmtMoneyShort(p.pipeWeighted) + '</div></div>';
  h += '<div style="background:var(--bg2);border:1px dashed var(--border);border-radius:10px;padding:8px 6px;text-align:center;cursor:pointer" onclick="event.stopPropagation();kpiPlanShowDrilldown(\'' + p.dealer.id + '\',\'runrate\')" title="กดดูรายเดือน"><div style="font-size:8.5px;color:var(--text2);font-weight:700;text-transform:uppercase">🔁 Runrate คาดไว้</div><div style="font-size:12.5px;font-weight:800;margin-top:3px">' + fmtMoneyShort(p.runrateForecast) + '</div></div>';
  h += '</div>';

  if (st.label !== 'ถึงเป้าแล้ว') {
    var impActions = getImprovementActions(p.dealer.id);
    var impTotal = improvementActionsTotal(p.dealer.id);
    h += '<div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(248,113,113,.1);border:1px dashed rgba(248,113,113,.4);border-radius:10px;padding:9px 12px;cursor:pointer" onclick="event.stopPropagation();go(\'kpiImprovementPlan\',{dealerId:\'' + p.dealer.id + '\'})">';
    h += '<span style="font-size:11.5px;font-weight:700" class="stat-bad-t">🚀 ' + (impActions.length ? impActions.length + ' Action · คาดเพิ่ม ' + fmtMoneyShort(impTotal) : 'ยังไม่มี Improvement Plan') + '</span>';
    h += '<span style="font-size:11px;font-weight:700" class="stat-bad-t">' + (impActions.length ? 'ดูแผน' : 'สร้างแผน') + ' →</span>';
    h += '</div>';
  }

  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:11px;padding-top:10px;border-top:1px solid var(--border)">';
  h += '<div style="display:flex;gap:10px;font-size:10.5px;color:var(--text2)"><span>' + qKeys[0].toUpperCase() + ' <b style="color:var(--text)">' + fmtMoneyShort((p.sisQuarters && p.sisQuarters[qKeys[0]]) || 0) + '</b></span><span>' + qKeys[1].toUpperCase() + ' <b style="color:var(--text)">' + fmtMoneyShort((p.sisQuarters && p.sisQuarters[qKeys[1]]) || 0) + '</b></span></div>';
  h += '<span style="font-size:11px;color:var(--text3)">' + (isOpen ? '▾ ซ่อนรายเดือน' : '▸ ดูรายเดือน') + '</span>';
  h += '</div>';

  h += '</div>';
  if (isOpen) h += kpiPlanDetailHtml(p);
  h += '</div>';
  return h;
}

// ================================================================
// Modal เจาะลึกจากจุดกดในการ์ด — ใช้ข้อมูลจาก computeKpiCompanyPlan ตรงๆ ไม่คำนวณซ้ำ
// ================================================================
function kpiPlanPipeRowHtml(pp, showCalc) {
  var posColor = pp.pos >= 70 ? 'stat-good-t' : pp.pos >= 40 ? 'stat-warn-t' : 'stat-bad-t';
  var weighted = pp.forecastAmount * pp.pos / 100;
  return '<div style="display:flex;align-items:center;gap:9px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:9px 10px;cursor:pointer" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + pp.id + '\'})">' +
    '<span style="font-size:10px;color:var(--text3);font-family:monospace;min-width:32px">' + (pp.rowNo ? '#' + sanitize(String(pp.rowNo)) : '—') + '</span>' +
    '<span style="flex:1;font-size:12px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(pp.projectName || '(ไม่มีชื่อ)') + '</span>' +
    '<span style="font-size:10px;font-weight:700" class="' + posColor + '">POS ' + pp.pos + '%</span>' +
    (showCalc ? '<span style="font-size:10px;color:var(--text3);min-width:100px;text-align:right">' + fmtMoneyShort(pp.forecastAmount) + ' × ' + pp.pos + '%</span>' : '') +
    '<span style="font-size:12px;font-weight:800;min-width:58px;text-align:right">' + fmtMoneyShort(showCalc ? weighted : pp.forecastAmount) + '</span>' +
    '<span style="color:var(--text3)">→</span></div>';
}
function kpiPlanDrillTotal(label, val) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border);font-size:13px;font-weight:800"><span>' + label + '</span><span style="color:#8b5cf6">' + fmtMoneyShort(val) + '</span></div>';
}
function kpiPlanEmptyNote(text) {
  return '<div style="font-size:11.5px;color:var(--text3);text-align:center;padding:16px 0">' + text + '</div>';
}
function kpiPlanMonthBarHtml(label, val, maxVal, color, overrideText) {
  var pct = maxVal ? Math.round(Math.min(100, val / maxVal * 100)) : 0;
  return '<div style="display:flex;align-items:center;gap:9px;background:var(--bg2);border-radius:10px;padding:8px 10px">' +
    '<span style="font-size:11.5px;font-weight:700;width:56px;flex:none">' + label + '</span>' +
    '<div style="flex:1;height:7px;background:var(--card);border-radius:99px;overflow:hidden"><div style="width:' + pct + '%;height:100%;border-radius:99px;background:' + color + '"></div></div>' +
    '<span style="font-size:11.5px;font-weight:800;min-width:70px;text-align:right">' + (overrideText || fmtMoneyShort(val)) + '</span></div>';
}

function kpiPlanShowDrilldown(dealerId, kind) {
  var p = computeKpiCompanyPlan(dealerId, getConfig());
  var title = '', h = '';

  if (kind === 'forecast') {
    title = '🎯 Forecast (ถ่วง POS)';
    h += '<div style="font-size:11.5px;color:var(--text2);line-height:1.6;background:var(--bg2);border-radius:10px;padding:10px 12px;margin-bottom:12px">POS คือความมั่นใจว่าโครงการจะปิดได้ — ยิ่งมั่นใจสูงยิ่งนับน้ำหนักเข้า Forecast มาก เช่น โครงการ 1,000,000 บาท ที่ POS 60% → นับเป็น Forecast <b>600,000</b></div>';
    if (!p.openPipelinesList.length) { h += kpiPlanEmptyNote('ไม่มีโครงการเปิดอยู่'); }
    else {
      h += '<div style="display:flex;flex-direction:column;gap:7px">' + p.openPipelinesList.map(function(pp) { return kpiPlanPipeRowHtml(pp, true); }).join('') + '</div>';
      h += kpiPlanDrillTotal('รวม Forecast (ถ่วง POS)', p.pipeWeighted);
    }
  } else if (kind === 'pipeline') {
    title = '📊 Pipeline มูลค่ารวม';
    if (!p.openPipelinesList.length) { h += kpiPlanEmptyNote('ไม่มีโครงการเปิดอยู่'); }
    else {
      h += '<div style="display:flex;flex-direction:column;gap:7px">' + p.openPipelinesList.map(function(pp) { return kpiPlanPipeRowHtml(pp, false); }).join('') + '</div>';
      h += kpiPlanDrillTotal('รวม Pipeline ดิบ (ไม่ถ่วง POS)', p.pipelineRawTotal);
    }
  } else if (kind === 'runrate') {
    title = '🔁 Runrate คาดไว้';
    h += '<div style="font-size:11.5px;color:var(--text2);line-height:1.6;background:var(--bg2);border-radius:10px;padding:10px 12px;margin-bottom:12px">ยอดขายทั่วไปที่ไม่ผูกกับโครงการ คาดไว้รายเดือนที่เหลือของครึ่งปีนี้ — เป็นค่าแนะนำอัตโนมัติ หรือแผนที่กรอกเอง (แก้ได้ที่ "ดูรายเดือน" ในการ์ด)</div>';
    var futureMonths = p.monthly.filter(function(m) { return m.isFuture; });
    if (!futureMonths.length) { h += kpiPlanEmptyNote('ไม่มีเดือนที่เหลือในครึ่งปีนี้'); }
    else {
      var maxV = Math.max.apply(null, futureMonths.map(function(m) { return m.runrate; }).concat([1]));
      h += '<div style="display:flex;flex-direction:column;gap:7px">' + futureMonths.map(function(m) { return kpiPlanMonthBarHtml(m.label, m.runrate, maxV, 'var(--accent)'); }).join('') + '</div>';
      h += kpiPlanDrillTotal('รวม Runrate คาดไว้', p.runrateForecast);
    }
  } else if (kind === 'sis') {
    title = '💰 SIS จริง (Sell-out)';
    var maxV2 = Math.max.apply(null, p.monthly.map(function(m) { return m.sisActual; }).concat([1]));
    h += '<div style="display:flex;flex-direction:column;gap:7px">' + p.monthly.map(function(m) { return kpiPlanMonthBarHtml(m.label, m.sisActual, maxV2, '#8b5cf6'); }).join('') + '</div>';
    h += kpiPlanDrillTotal('รวม SIS จริง (' + p.half + ')', kpiPlanSisActual(p));
    h += '<div style="text-align:center;margin-top:12px"><a style="font-size:11px;color:var(--accent);font-weight:700;cursor:pointer" onclick="closeMForce();go(\'exports\')">ไปหน้านำเข้า/แก้ไขยอดขาย SIS →</a></div>';
  } else if (kind === 'dji') {
    title = '🏆 DJI จริง (Sell-in)';
    if (!p.wonPipelinesList.length) { h += kpiPlanEmptyNote('ยังไม่มีโครงการ Won ในครึ่งปีนี้'); }
    else {
      h += '<div style="display:flex;flex-direction:column;gap:7px">' + p.wonPipelinesList.map(function(pp) {
        return '<div style="display:flex;align-items:center;gap:9px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:9px 10px;cursor:pointer" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + pp.id + '\'})">' +
          '<span style="font-size:10px;color:var(--text3);font-family:monospace;min-width:32px">' + (pp.rowNo ? '#' + sanitize(String(pp.rowNo)) : '—') + '</span>' +
          '<span style="flex:1;font-size:12px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(pp.projectName || '(ไม่มีชื่อ)') + '</span>' +
          '<span style="font-size:10px;color:var(--text3)">' + sanitize(pp.closeDate || '') + '</span>' +
          '<span style="font-size:12px;font-weight:800;min-width:58px;text-align:right">' + fmtMoneyShort(pp.amount) + '</span>' +
          '<span style="color:var(--text3)">→</span></div>';
      }).join('') + '</div>';
      h += kpiPlanDrillTotal('รวม DJI จริง (Sell-in)', p.djiActual);
    }
  } else if (kind === 'gap') {
    title = '📉 ยังขาดอีกเท่าไหร่';
    var sisActual = kpiPlanSisActual(p);
    var gapAmt = p.target - sisActual;
    var remainMonths = p.monthly.filter(function(m) { return m.isFuture || m.isCurrent; });
    h += '<div style="font-size:11.5px;color:var(--text2);line-height:1.6;background:var(--bg2);border-radius:10px;padding:10px 12px;margin-bottom:12px">เป้า ' + fmtMoneyShort(p.target) + ' − SIS จริงสะสม ' + fmtMoneyShort(sisActual) + ' = ' +
      (gapAmt > 0 ? 'ขาดอีก <b>' + fmtMoneyShort(gapAmt) + '</b>' : 'เกินเป้าแล้ว <b>' + fmtMoneyShort(-gapAmt) + '</b>') +
      (gapAmt > 0 && remainMonths.length ? ' ในเดือนที่เหลือของ ' + p.half + ' (เฉลี่ยต้องทำเดือนละ ~' + fmtMoneyShort(gapAmt / remainMonths.length) + ')' : '') + '</div>';
    if (gapAmt > 0 && remainMonths.length) {
      var perMonth = gapAmt / remainMonths.length;
      h += '<div style="display:flex;flex-direction:column;gap:7px">' + remainMonths.map(function(m) { return kpiPlanMonthBarHtml(m.label, perMonth, perMonth, '#f87171', 'ต้อง ' + fmtMoneyShort(perMonth)); }).join('') + '</div>';
    }
  }

  openM(title, h);
}

function kpiPlanDetailHtml(p) {
  var reqPerMonth = p.target / p.monthly.length;
  var h = '<div style="padding:14px;border-top:1px solid var(--border);background:var(--bg2)">';

  if (p.stalePipes.length || p.lastVisitDays === null || p.lastVisitDays > 30) {
    h += '<div class="stat-warn-t" style="font-size:11.5px;margin-bottom:10px">⚠️ ' +
      (p.stalePipes.length ? p.stalePipes.length + ' โครงการเงียบเกิน 30 วัน' : '') +
      ((p.stalePipes.length && (p.lastVisitDays === null || p.lastVisitDays > 30)) ? ' · ' : '') +
      ((p.lastVisitDays === null || p.lastVisitDays > 30) ? 'ยังไม่มี Visit ล่าสุด' + (p.lastVisitDays != null ? ' (' + p.lastVisitDays + ' วันที่แล้ว)' : '') : '') +
      '</div>';
  }

  // ยอดขาย SIS จริง — สรุป Quarter/H ของครึ่งปีนี้ (ตัวเลขจริงจากบัญชี ไม่ใช่ตัวเลขคาดการณ์)
  var q = p.sisQuarters || {};
  var qKeys = p.half === 'H1' ? ['q1', 'q2'] : ['q3', 'q4'];
  var hKey = p.half === 'H1' ? 'h1' : 'h2';
  h += '<div style="font-size:11.5px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.02em;margin-bottom:6px">💰 ยอดขาย SIS จริง — ' + p.sisYear + '</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px">';
  qKeys.forEach(function(qk) {
    h += '<div style="background:var(--card2);border-radius:9px;padding:8px 6px;text-align:center"><div style="font-size:9px;color:var(--text2);font-weight:700;text-transform:uppercase">' + qk.toUpperCase() + '</div><div style="font-size:12.5px;font-weight:800;margin-top:2px">' + fmtMoneyShort(q[qk] || 0) + '</div></div>';
  });
  h += '<div style="background:var(--accent-light,var(--bg2));border-radius:9px;padding:8px 6px;text-align:center"><div style="font-size:9px;color:var(--accent);font-weight:700;text-transform:uppercase">' + p.half + ' รวม</div><div style="font-size:12.5px;font-weight:800;color:var(--accent);margin-top:2px">' + fmtMoneyShort(q[hKey] || 0) + '</div></div>';
  h += '</div>';

  h += '<div style="font-size:11.5px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.02em;margin-bottom:8px">ยอดรายเดือน — SIS จริง / Project / Runrate (จังหวะที่ต้องทำ ' + fmtMoneyShort(reqPerMonth) + '/เดือน)</div>';
  h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:680px">';
  h += '<thead><tr>' +
    '<th style="text-align:left;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">เดือน</th>' +
    '<th style="text-align:right;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">ยอด SIS จริง</th>' +
    '<th style="text-align:right;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">Project (แผน)</th>' +
    '<th style="text-align:right;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">Runrate (แผน)</th>' +
    '<th style="text-align:left;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">โครงการคาดปิด</th>' +
    '<th style="text-align:right;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">สถานะ</th></tr></thead><tbody>';
  p.monthly.forEach(function(m) {
    var total = m.project + m.runrate;
    var ckey = p.dealer.id + '|' + m.month;
    var isOpen = !!kpiPlanClosingOpen[ckey];
    var tag = m.isCurrent ? '<span style="font-size:9px;border:1px solid var(--border);border-radius:8px;padding:1px 6px;margin-left:6px;color:var(--text2)">เดือนนี้</span>'
      : m.isFuture ? '<span style="font-size:9px;border:1px solid var(--border);border-radius:8px;padding:1px 6px;margin-left:6px;color:var(--text2)">' + (m.isManual ? 'แผน' : 'แนะนำ') + '</span>'
      : '<span style="font-size:9px;border:1px solid var(--border);border-radius:8px;padding:1px 6px;margin-left:6px;color:var(--text2)">จริง</span>';
    h += '<tr' + (m.isCurrent ? ' style="background:rgba(59,111,214,.08)"' : '') + '>';
    h += '<td style="padding:6px 8px;font-weight:600;font-size:12.5px">' + m.label + tag + '</td>';
    h += '<td style="text-align:right;padding:6px 8px;font-weight:800;font-size:12.5px">' + fmtMoneyShort(m.sisActual) + '</td>';
    if (m.isFuture) {
      h += '<td style="text-align:right;padding:4px 8px"><input type="number" step="1000" class="fm-input" style="width:90px;text-align:right;padding:4px 6px;font-size:12px" id="kpiplan_p_' + p.dealer.id + '_' + m.month + '" value="' + Math.round(m.project) + '"></td>';
      h += '<td style="text-align:right;padding:4px 8px"><input type="number" step="1000" class="fm-input" style="width:90px;text-align:right;padding:4px 6px;font-size:12px" id="kpiplan_r_' + p.dealer.id + '_' + m.month + '" value="' + Math.round(m.runrate) + '"></td>';
    } else {
      h += '<td style="text-align:right;padding:6px 8px;font-size:12.5px">' + fmtMoneyShort(m.project) + '</td>';
      h += '<td style="text-align:right;padding:6px 8px;font-size:12.5px">' + fmtMoneyShort(m.runrate) + '</td>';
    }
    h += '<td style="padding:6px 8px">';
    if (m.closingPipes.length) {
      h += '<button class="btn bsm bo" style="font-size:10.5px;padding:3px 8px" onclick="kpiPlanToggleClosing(\'' + p.dealer.id + '\',\'' + m.month + '\')">📁 ' + m.closingPipes.length + ' โครงการ ' + (isOpen ? '▴' : '▾') + '</button>';
    } else {
      h += '<span style="color:var(--text3);font-size:11px">—</span>';
    }
    h += '</td>';
    h += '<td style="text-align:right;padding:6px 8px;font-size:11px" class="' + (total >= reqPerMonth ? 'stat-good-t' : 'stat-bad-t') + '">' + (total >= reqPerMonth ? '✓ ทันจังหวะ' : '▼ ต่ำกว่าจังหวะ') + '</td>';
    h += '</tr>';
    if (isOpen && m.closingPipes.length) {
      h += '<tr><td colspan="6" style="padding:0;border-bottom:1px solid var(--border)"><div style="padding:8px 12px 10px 28px;background:var(--card2);display:flex;flex-direction:column;gap:6px">';
      m.closingPipes.forEach(function(cp) {
        var posColor = cp.pos >= 70 ? 'stat-good-t' : cp.pos >= 40 ? 'stat-warn-t' : 'stat-bad-t';
        h += '<div style="display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:6px 9px;cursor:pointer" onclick="go(\'pipeDetail\',{pipeId:\'' + cp.id + '\'})">';
        h += '<span style="font-size:10px;color:var(--text3);font-family:monospace;min-width:34px">' + (cp.rowNo ? '#' + sanitize(String(cp.rowNo)) : '—') + '</span>';
        h += '<span style="flex:1;font-size:12px;font-weight:600">' + sanitize(cp.projectName || '(ไม่มีชื่อ)') + '</span>';
        h += '<span style="font-size:10.5px;font-weight:700" class="' + posColor + '">POS ' + cp.pos + '%</span>';
        h += '<span style="font-size:12px;font-weight:700;min-width:64px;text-align:right">' + fmtMoneyShort(cp.forecastAmount) + '</span>';
        h += '<span style="color:var(--text3)">→</span>';
        h += '</div>';
      });
      h += '<div style="font-size:10.5px;color:var(--text3);font-style:italic">💡 ยังไม่นับเป็นยอดขาย SIS จนกว่าโครงการจะปิดและออกใบแจ้งหนี้จริง — กดที่รายการเพื่อไปหน้า Pipeline</div>';
      h += '</div></td></tr>';
    }
  });
  h += '</tbody></table></div>';

  h += '<div style="display:flex;gap:8px;margin-top:10px">';
  h += '<button class="btn bsm bp" onclick="kpiPlanSaveMonths(\'' + p.dealer.id + '\')">💾 บันทึกแผน</button>';
  h += '<button class="btn bsm bo" onclick="kpiPlanResetMonths(\'' + p.dealer.id + '\')">🔄 ใช้ค่าแนะนำอัตโนมัติ</button>';
  h += '<button class="btn bsm bo" onclick="go(\'mondayCompany\',{dealerId:\'' + p.dealer.id + '\'})">🗓️ ดูหน้าประชุมจันทร์บริษัทนี้</button>';
  h += '</div>';

  var gap = p.target - p.forecastTotal;
  h += '<div style="margin-top:10px;font-size:12px;padding:9px 12px;border-radius:9px;background:' + (gap <= 0 ? 'rgba(74,222,128,.12)' : 'rgba(248,113,113,.12)') + '" class="' + (gap <= 0 ? 'stat-good-t' : 'stat-bad-t') + '">' +
    (gap <= 0 ? '📈 ตามแผนที่กรอก + Pipeline ที่คาดปิด → คาดจบ ' + p.half + ' ที่ ' + fmtMoneyShort(p.forecastTotal) + ' เกินเป้า ' + fmtMoneyShort(-gap)
      : '📉 ตามแผนที่กรอก + Pipeline ที่คาดปิด → คาดจบ ' + p.half + ' ที่ ' + fmtMoneyShort(p.forecastTotal) + ' ขาดอีก ' + fmtMoneyShort(gap)) +
    '</div>';

  h += '</div>';
  return h;
}

function kpiPlanSaveMonths(dealerId) {
  var plan = computeKpiCompanyPlan(dealerId, getConfig());
  plan.monthly.filter(function(m) { return m.isFuture; }).forEach(function(m) {
    var pIn = document.getElementById('kpiplan_p_' + dealerId + '_' + m.month);
    var rIn = document.getElementById('kpiplan_r_' + dealerId + '_' + m.month);
    if (!pIn || !rIn) return;
    saveKpiMonthlyPlan(dealerId, m.month, Number(pIn.value) || 0, Number(rIn.value) || 0);
  });
  toast('💾 บันทึกแผนแล้ว');
  render();
}

function kpiPlanResetMonths(dealerId) {
  var plan = computeKpiCompanyPlan(dealerId, getConfig());
  plan.monthly.filter(function(m) { return m.isFuture; }).forEach(function(m) {
    ST.deleteWhere('kpiMonthlyPlan', function(x) { return x.dealerId === dealerId && x.month === m.month; });
  });
  toast('🔄 กลับไปใช้ค่าแนะนำอัตโนมัติแล้ว');
  render();
}

function kpiPlanToggleRow(dealerId) {
  kpiPlanExpandedId = kpiPlanExpandedId === dealerId ? null : dealerId;
  render();
}

function kpiPlanToggleClosing(dealerId, month) {
  var key = dealerId + '|' + month;
  kpiPlanClosingOpen[key] = !kpiPlanClosingOpen[key];
  render();
}

function copyKpiPlanSummary() {
  var plans = computeKpiCompanyPlanAll(getConfig());
  if (!plans.length) return toast('ไม่มีข้อมูล');
  var half = plans[0].half;
  var lines = ['🎯 แผนบรรลุเป้า KPI — SAB Partner (' + half + ') · ' + fD(_td()), ''];
  var totalTarget = 0, totalActual = 0, totalPipe = 0;
  plans.forEach(function(p) { totalTarget += p.target; totalActual += p.actualSoFar; totalPipe += p.pipeWeighted; });
  lines.push('รวม: เป้า ฿' + fmtMoney(totalTarget) + ' · ทำได้แล้ว ฿' + fmtMoney(totalActual) + ' · Pipeline ฿' + fmtMoney(totalPipe) + ' · ขาด ฿' + fmtMoney(Math.max(0, totalTarget - totalActual - totalPipe)));
  lines.push('');
  plans.forEach(function(p) {
    var st = kpiPlanStatus(p);
    var gap = p.target - p.actualSoFar - p.pipeWeighted;
    lines.push((gap > 0 ? '🔴' : '🟢') + ' ' + p.dealer.name + ' — เป้า ฿' + fmtMoney(p.target) + ' · ทำได้+Pipeline ฿' + fmtMoney(p.actualSoFar + p.pipeWeighted) +
      (gap > 0 ? ' · ขาด ฿' + fmtMoney(gap) : ' · เกินเป้า') + ' — ' + st.label);
  });

  var riskPlans = plans.filter(function(p) { return kpiPlanStatus(p).label !== 'ถึงเป้าแล้ว'; });
  if (riskPlans.length) {
    lines.push('');
    lines.push('🚀 Improvement Plan — บริษัทเสี่ยง');
    riskPlans.forEach(function(p) {
      var actions = getImprovementActions(p.dealer.id);
      var total = improvementActionsTotal(p.dealer.id);
      lines.push('');
      lines.push('■ ' + p.dealer.name + (actions.length ? ' (คาดเพิ่ม ฿' + fmtMoney(total) + ')' : ' — ยังไม่มี Improvement Plan'));
      actions.forEach(function(a) {
        lines.push('  · ' + (a.action || '(ไม่มีชื่อ Action)') + ' — ' + (a.who || '-') + ' · ' + (a.when || '-') + ' · คาด ฿' + fmtMoney(Number(a.expectedSales) || 0));
      });
    });
  }

  copyText(lines.join('\n'), '📋 คัดลอกสรุปแผน KPI แล้ว');
}

// ================================================================
// IMPROVEMENT PLAN — แผนเพิ่มยอดต่อบริษัทเสี่ยง (โจทย์จาก Ryan: Who/What/When/Expected Result ไม่ใช่แค่
// ติดตาม Pipeline เดิม) เก็บใน improvementActions ตัวเดียว — "Growth Plan" (เดิมแยก End User Mapping/
// Demo-POC/New Product Expansion/Action Plan เป็น 4 ส่วน ยุบรวมเป็นตารางเดียว 2026-08-21 เพราะ Sale งงว่า
// จะกรอกช่องไหน — แต่ละแถวมี relatedTo แบบข้อความอิสระ ไม่บังคับผูกกับ End User/โครงการใดๆ เผื่อเป็นแผนทั่วไป
// เช่น รับรอง Dealer/Partner หรือโปรแกรมยืม Payload) — สาเหตุหลัก (reason chips) เก็บที่ dealer.improvementReasons
// ตรงๆ (pattern เดียวกับ sisRevenueByYear ที่ผูกกับ dealer อยู่แล้ว ไม่ต้องเปิด collection แยกสำหรับ field เดียว)
// Gap/Target/Pipeline ทั้งหมดดึงจาก computeKpiCompanyPlan ตรงๆ ไม่คำนวณซ้ำ/ไม่เก็บสำเนา
// ================================================================
var IMPROVEMENT_REASONS = ['Pipeline ยังน้อย', 'Budget ยังไม่มา', 'ยังไม่มี Demo', 'เข้าถึง End User ไม่ได้', 'มีคู่แข่ง', 'ขายแต่ Product เดิม', 'Technical Solution ยังไม่พร้อม', 'ไม่มี New End User', 'กระทบราคาไม่เอา', 'เสนอราคาออนไลน์ไม่ได้'];

// สถานะที่ Sale ประเมินเอง (มาจากไฟล์ Dealer_Improve_Plan_2026.xlsx คอลัมน์ "KPI Status/Progress") — คู่กับ
// badge auto (kpiPlanStatus) ที่คำนวณจากตัวเลขล้วนๆ ไม่จำเป็นต้องตรงกันเสมอ เพราะ Sale อาจรู้บริบทที่ตัวเลข
// ยังไม่สะท้อน (เช่น กำลังจะปิดดีลใหญ่เร็วๆ นี้ทั้งที่ Gap ยังสูงอยู่)
var KPI_MANUAL_STATUS_OPTS = [
  { key: 'on_track', label: 'On Track', icon: '🟢', color: '#22c55e', bg: 'rgba(34,197,94,.12)' },
  { key: 'needs_focus', label: 'Needs Focus', icon: '🟡', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  { key: 'at_risk', label: 'At Risk', icon: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,.12)' }
];
function kpiSetManualStatus(dealerId, key) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  var cur = d.kpiStatusManual || '';
  ST.update('dealers', dealerId, { kpiStatusManual: cur === key ? '' : key }); // กดซ้ำอันที่เลือกอยู่ = ยกเลิก
  render();
}

function getImprovementActions(dealerId) {
  return ST.filter('improvementActions', function(a) { return a.dealerId === dealerId; });
}
// นับเฉพาะแผนที่ "ไม่ได้" ผูกกับ Pipeline โดยตรง (ไม่มี pipeId) — ตัดแผนที่ผูก pipeId ออก (สร้างจากปุ่ม "+
// Action" ใน Project Conversion Plan) เพราะมูลค่าของโครงการนั้นถูกนับไปแล้วใน "Pipeline (POS-Weighted)" ที่ใช้
// คำนวณ Current Forecast อยู่แล้ว — ถ้าเอา expectedSales (เต็มจำนวน ไม่ถ่วง POS) มาบวกซ้ำอีกทีใน New
// Opportunity/Revised Forecast จะนับมูลค่าโครงการนั้นซ้อนกัน 2 รอบ ทำให้ตัวเลขสูงเกินจริง (พบ 2026-08-21)
function improvementActionsTotal(dealerId) {
  return getImprovementActions(dealerId).filter(function(a) { return !a.pipeId; }).reduce(function(s, a) { return s + (Number(a.expectedSales) || 0); }, 0);
}

function kpiImpToggleReason(dealerId, reason) {
  var d = ST.getOne('dealers', dealerId);
  var reasons = (d.improvementReasons || []).slice();
  var idx = reasons.indexOf(reason);
  if (idx === -1) reasons.push(reason); else reasons.splice(idx, 1);
  ST.update('dealers', dealerId, { improvementReasons: reasons });
  render();
}
// เซฟ field ที่เก็บตรงบน Dealer เอง (เช่น improvementSummary) ต่างจาก kpiImpSaveField ที่เซฟ field บน record
// ของ collection ย่อย (improvementActions) ที่ระบุ id แถวแยกต่างหาก
function kpiImpSaveDealerField(dealerId, field, value) {
  var patch = {};
  patch[field] = value;
  ST.update('dealers', dealerId, patch);
}
function kpiImpSaveField(coll, id, field, value) {
  var patch = {};
  patch[field] = field === 'expectedSales' ? (Number(value) || 0) : value;
  ST.update(coll, id, patch);
  render();
}
function kpiImpDeleteRow(coll, id) {
  ST.delete(coll, id);
  render();
}
function kpiImpAddAction(dealerId) {
  ST.add('improvementActions', { dealerId: dealerId, action: '', who: '', what: '', when: '', expectedResult: '', expectedSales: 0 });
  render();
}

function kpiImpTh(label, width, title) {
  return '<th style="text-align:left;font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--border)' + (width ? ';width:' + width + 'px' : '') + '"' + (title ? ' title="' + sanitize(title) + '"' : '') + '>' + label + '</th>';
}
function kpiImpTextCell(coll, id, field, val, placeholder) {
  return '<td style="padding:4px 8px"><input class="fm-input" style="font-size:11.5px;width:100%" value="' + sanitize(val || '') + '"' + (placeholder ? ' placeholder="' + sanitize(placeholder) + '"' : '') + ' onchange="kpiImpSaveField(\'' + coll + '\',\'' + id + '\',\'' + field + '\',this.value)"></td>';
}
function kpiImpDelBtn(coll, id) {
  return '<td style="padding:4px 6px;text-align:center"><button class="btn bsm bo" style="padding:2px 7px" onclick="kpiImpDeleteRow(\'' + coll + '\',\'' + id + '\')">✕</button></td>';
}

// "Related to" ไม่บังคับผูกกับใคร — ปล่อยว่างได้ถ้าเป็นแผนทั่วไปไม่เจาะจง (เช่น รับรอง Dealer/Partner, โปรแกรม
// ยืม Payload ให้ลูกค้าไปสาธิตเอง) ถ้าเพิ่มมาจากปุ่ม "+ Action" ใน Project Conversion Plan จะผูก pipeId ไว้ให้
// อัตโนมัติ (แสดงเป็น chip กดไปหน้าโครงการได้) ส่วนกรอกเองพิมพ์ได้อิสระ ไม่บังคับรูปแบบ
function kpiImpRelatedToCell(r) {
  if (r.pipeId) {
    var pipeObj = ST.getOne('pipeline', r.pipeId);
    var label = pipeObj ? (pipeObj.projectName || '(ไม่มีชื่อ)') : (r.relatedTo || '(โครงการถูกลบไปแล้ว)');
    return '<td style="padding:4px 8px"><span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:4px 9px;border-radius:20px;background:var(--bg2);border:1px solid var(--border);' + (pipeObj ? 'cursor:pointer' : '') + '"' + (pipeObj ? ' onclick="go(\'pipeDetail\',{pipeId:\'' + r.pipeId + '\'})"' : '') + ' title="ผูกกับ Pipeline โดยตรง">🔗 ' + sanitize(label) + '</span></td>';
  }
  return kpiImpTextCell('improvementActions', r.id, 'relatedTo', r.relatedTo, 'ชื่อ End User / อ้างอิงโครงการ / เว้นว่างถ้าเป็นแผนทั่วไป');
}
function kpiImpGrowthPlanTable(dealerId) {
  var rows = getImprovementActions(dealerId);
  var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:880px">';
  h += '<thead><tr>' + kpiImpTh('What', 140) + kpiImpTh('Related to', 160, 'ผูกกับ End User/โครงการก็ได้ หรือเว้นว่างถ้าเป็นแผนทั่วไป ไม่บังคับรูปแบบ') + kpiImpTh('Who', 90) + kpiImpTh('When', 80) + kpiImpTh('Expected Result', 150) + kpiImpTh('Expected Sales', 100, 'แผนที่ผูก Pipeline (มี 🔗) ไม่ถูกนับใน "New Opportunity" ของ Rollup ด้านล่าง เพราะมูลค่าโครงการนั้นถูกนับใน Pipeline ถ่วง POS ไปแล้ว — กันนับซ้ำ') + '<th style="width:26px;border-bottom:1px solid var(--border)"></th></tr></thead><tbody>';
  if (!rows.length) h += '<tr><td colspan="7" style="padding:14px;text-align:center;color:var(--text3);font-size:11.5px">ยังไม่มีแผน — กด "+ เพิ่มแผน" ด้านล่าง</td></tr>';
  rows.forEach(function(r) {
    h += '<tr>' + kpiImpTextCell('improvementActions', r.id, 'action', r.action) +
      kpiImpRelatedToCell(r) +
      kpiImpTextCell('improvementActions', r.id, 'who', r.who) + kpiImpTextCell('improvementActions', r.id, 'when', r.when) +
      kpiImpTextCell('improvementActions', r.id, 'expectedResult', r.expectedResult) +
      '<td style="padding:4px 8px"><input type="number" step="10000" class="fm-input" style="font-size:11.5px;width:100%;text-align:right" value="' + (Number(r.expectedSales) || 0) + '" onchange="kpiImpSaveField(\'improvementActions\',\'' + r.id + '\',\'expectedSales\',this.value)">' +
      (r.pipeId ? '<div style="font-size:9.5px;color:var(--text3);text-align:right;margin-top:2px">นับใน Pipeline แล้ว</div>' : '') + '</td>' +
      kpiImpDelBtn('improvementActions', r.id) + '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<button class="btn bsm bo" style="margin-top:8px" onclick="kpiImpAddAction(\'' + dealerId + '\')">+ เพิ่มแผน</button>';
  return h;
}

function kpiImpStat(label, val, colorCls) {
  return '<div style="background:var(--bg2);border-radius:10px;padding:9px 8px;text-align:center"><div style="font-size:8.5px;color:var(--text2);font-weight:700;text-transform:uppercase">' + label + '</div><div style="font-size:13.5px;font-weight:800;margin-top:3px" class="' + (colorCls || '') + '">' + val + '</div></div>';
}
function kpiImpRollupRow(label, val, colorCls) {
  return '<div style="display:flex;justify-content:space-between"><span style="color:var(--text2)">' + label + '</span><span style="font-weight:800" class="' + (colorCls || '') + '">' + val + '</span></div>';
}

// ดึง Pipeline ที่เปิดอยู่จริงของบริษัทนี้ (p.openPipelinesList จาก computeKpiCompanyPlan) มาให้กดแปลงเป็น
// Growth Plan ทันที (prefill ชื่อโครงการ + มูลค่า, ผูก pipeId กันเพิ่มซ้ำ) ไม่มีตาราง/collection แยกต่างหาก —
// ใช้ improvementActions ตัวเดียวกับตาราง Growth Plan ตรงๆ
// แต่ละแถวต้อง "รู้งวด" ของตัวเอง — ใช้ Expected Close Date ถ้ามี ไม่งั้นเดาจาก Bidding Date +1 เดือน (ดู
// pipeEffectiveCloseDate ใน utils.js) โครงการที่ไม่ตรงกับงวดที่หน้านี้กำลังพูดถึง (p.half/p.sisYear) ถูกตัดออก
// จากยอดรวม (totalForecast/totalWeighted) กันไปรวมเข้าเป้างวดนี้ผิดๆ — ใช้ร่วมกันทั้งตารางแบบ interactive
// (kpiImpProjectConversionSection) และตาราง print (printImprovementPlan) กันตรรกะเพี้ยนไปคนละทางกัน
// สรุป "รุ่นสินค้า × Qty" ของโครงการ เฉพาะรายการที่เป็น Drone/Payload (ไม่เอา accessory/battery/software/service
// ปนมา) — เช็ค category จาก catalog สินค้าก่อน (getProductByName/_pipeResolveProduct) ถ้าหาไม่เจอ (สินค้าเก่า/
// พิมพ์เองไม่ตรงชื่อ catalog เป๊ะ) fallback เดาจากชื่อรุ่น (Matrice/Mavic/Zenmuse/Dock) ถ้ากรองแล้วไม่เหลือ
// รายการที่เข้าเกณฑ์เลย (เช่น ยังไม่ผูกสินค้าไว้) แสดงทุกรายการที่มีแทน ดีกว่าโชว์ว่างเปล่า
function _pipeItemsDroneProductQty(pipeObj) {
  if (!pipeObj) return '';
  var items = (typeof getPipeItems === 'function') ? getPipeItems(pipeObj) : (pipeObj.items || []);
  if (!items.length) return '';
  var isDroneOrPayload = function(it) {
    var prod = (typeof _pipeResolveProduct === 'function') ? _pipeResolveProduct(it.model) : (typeof getProductByName === 'function' ? getProductByName(it.model) : null);
    if (prod && prod.category) return prod.category === 'drone' || prod.category === 'payload';
    var n = (it.model || '').toUpperCase();
    return n.indexOf('MATRICE') !== -1 || n.indexOf('MAVIC') !== -1 || n.indexOf('ZENMUSE') !== -1 || n.indexOf('DOCK') !== -1;
  };
  var filtered = items.filter(isDroneOrPayload);
  var list = filtered.length ? filtered : items;
  return list.map(function(it) { return (it.model || '?') + ' ×' + (Number(it.qty) || 1); }).join(', ');
}
function _kpiConvBuildRows(dealerId, p) {
  var cfg = getConfig();
  var halves = sisComputeHalfMonths(cfg);
  var curPeriodKey = p.sisYear + '-' + p.half;
  var rows = p.openPipelinesList.map(function(pp) {
    var pipeObj = ST.getOne('pipeline', pp.id);
    var closeDate = pipeObj ? (pipeObj.expectedCloseDate || pipeEffectiveCloseDate(pipeObj)) : '';
    var isGuessed = !!(pipeObj && !pipeObj.expectedCloseDate && closeDate);
    var periodKey = 'unknown', periodLabel = 'ไม่ระบุวันที่';
    if (closeDate) {
      var y = parseInt(closeDate.slice(0, 4), 10);
      var m = parseInt(closeDate.slice(5, 7), 10) - 1;
      var half = halves.h1.indexOf(m) !== -1 ? 'H1' : (halves.h2.indexOf(m) !== -1 ? 'H2' : null);
      periodKey = y + '-' + (half || '?');
      periodLabel = half ? (half + ' ' + y) : ('ปี ' + y);
    }
    var pos = Number(pp.pos) || 0;
    var forecast = Number(pp.forecastAmount) || 0;
    var productQty = _pipeItemsDroneProductQty(pipeObj);
    return { pp: pp, pipeObj: pipeObj, isGuessed: isGuessed, periodLabel: periodLabel, isCurrent: periodKey === curPeriodKey, pos: pos, forecast: forecast, weighted: forecast * pos / 100, productQty: productQty };
  });
  var totalForecast = 0, totalWeighted = 0;
  rows.forEach(function(r) { if (r.isCurrent) { totalForecast += r.forecast; totalWeighted += r.weighted; } });
  return { rows: rows, curPeriodKey: curPeriodKey, totalForecast: totalForecast, totalWeighted: totalWeighted };
}

function kpiImpProjectConversionSection(dealerId, p) {
  if (!p.openPipelinesList.length) return '<div style="font-size:11.5px;color:var(--text3);text-align:center;padding:10px 0">ไม่มีโครงการเปิดอยู่ในระบบตอนนี้</div>';
  var actions = getImprovementActions(dealerId);
  var built = _kpiConvBuildRows(dealerId, p);
  var rows = built.rows, curPeriodKey = built.curPeriodKey, totalForecast = built.totalForecast, totalWeighted = built.totalWeighted;
  var outCount = rows.filter(function(r) { return !r.isCurrent; }).length;

  var tblId = 'kpiConvTbl_' + dealerId;
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">';
  h += '<div style="font-size:10.5px;color:var(--text3)">งวดปัจจุบัน: ' + sanitize(curPeriodKey) + ' · ⏱ = เดาวันที่คาดปิดจาก Bidding Date +1 เดือน (ยังไม่ได้กรอก Expected Close Date เอง)</div>';
  if (outCount) h += '<button class="btn bsm bo" id="' + tblId + '_toggle" onclick="_kpiConvToggleOtherPeriod(\'' + tblId + '\')">👁️ แสดงทั้งหมด (' + outCount + ' นอกงวดนี้ซ่อนอยู่)</button>';
  h += '</div>';

  h += '<div style="overflow-x:auto"><table id="' + tblId + '" style="width:100%;border-collapse:collapse;font-size:11.5px">';
  h += '<thead><tr style="border-bottom:1px solid var(--border)">' +
    '<th style="text-align:left;padding:6px 8px;color:var(--text2);font-weight:700;white-space:nowrap">#</th>' +
    '<th style="text-align:left;padding:6px 8px;color:var(--text2);font-weight:700">โครงการ</th>' +
    '<th style="text-align:left;padding:6px 8px;color:var(--text2);font-weight:700;white-space:nowrap">หน่วยงาน</th>' +
    '<th style="text-align:left;padding:6px 8px;color:var(--text2);font-weight:700;white-space:nowrap">สถานะ</th>' +
    '<th style="text-align:left;padding:6px 8px;color:var(--text2);font-weight:700;white-space:nowrap">งวดที่คาดปิด</th>' +
    '<th style="text-align:left;padding:6px 8px;color:var(--text2);font-weight:700;white-space:nowrap">สินค้าที่คาดขาย</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--text2);font-weight:700;white-space:nowrap">POS%</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--text2);font-weight:700;white-space:nowrap">Forecast</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--text2);font-weight:700;white-space:nowrap" title="Forecast × POS%">ยอดเป้าคำนวณ</th>' +
    '<th style="padding:6px 8px"></th>' +
    '</tr></thead><tbody>';
  rows.forEach(function(r) {
    var pp = r.pp, pipeObj = r.pipeObj;
    var statusLabel = (pipeObj && typeof PIPE_NAMES !== 'undefined' && PIPE_NAMES[pipeObj.status]) || (pipeObj ? pipeObj.status : '');
    var agency = pipeObj ? (pipeObj.agencyMain || pipeObj.endUserTH || pipeObj.endUserEN || '-') : '-';
    var pos = r.pos, forecast = r.forecast, weighted = r.weighted;
    var linked = actions.some(function(a) { return a.pipeId === pp.id; });
    var dim = r.isCurrent ? '' : 'opacity:.55;';
    h += '<tr class="' + (r.isCurrent ? '' : 'kpiConvOtherPeriod') + '" style="border-bottom:1px solid var(--border);' + dim + (r.isCurrent ? '' : 'display:none') + '">';
    h += '<td style="padding:7px 8px;color:var(--text3);font-family:monospace;white-space:nowrap">' + (pp.rowNo ? '#' + sanitize(String(pp.rowNo)) : '—') + '</td>';
    h += '<td style="padding:7px 8px;font-weight:600;cursor:pointer;color:var(--accent);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" onclick="go(\'pipeDetail\',{pipeId:\'' + pp.id + '\'})" title="' + sanitize(pp.projectName || '') + '">' + sanitize(pp.projectName || '(ไม่มีชื่อ)') + ' →</td>';
    h += '<td style="padding:7px 8px;color:var(--text2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(agency) + '">' + sanitize(agency) + '</td>';
    h += '<td style="padding:7px 8px;white-space:nowrap"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--card2);border:1px solid var(--border);color:var(--text2)">' + sanitize(statusLabel) + '</span></td>';
    h += '<td style="padding:7px 8px;white-space:nowrap">' + sanitize(r.periodLabel) + (r.isGuessed ? ' <span title="เดาจาก Bidding Date +1 เดือน">⏱</span>' : '') + '</td>';
    h += '<td style="padding:7px 8px;color:var(--text2);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(r.productQty) + '">' + sanitize(r.productQty || '-') + '</td>';
    h += '<td style="padding:7px 8px;text-align:right;font-weight:600;white-space:nowrap">' + pos + '%</td>';
    h += '<td style="padding:7px 8px;text-align:right;font-weight:600;white-space:nowrap">' + fmtMoneyShort(forecast) + '</td>';
    h += '<td style="padding:7px 8px;text-align:right;font-weight:700;white-space:nowrap" class="stat-good-t">' + fmtMoneyShort(weighted) + '</td>';
    h += '<td style="padding:7px 8px;white-space:nowrap">' + (linked
      ? '<span style="font-size:10px;font-weight:700" class="stat-good-t">✓ อยู่ใน Action Plan</span>'
      : '<button class="btn bsm bo" onclick="kpiImpAddActionFromPipeline(\'' + dealerId + '\',\'' + pp.id + '\',\'' + sanitize(pp.projectName || '').replace(/'/g, "\\'") + '\',' + forecast + ')">+ Action</button>') + '</td>';
    h += '</tr>';
  });
  h += '<tr><td colspan="7" style="padding:7px 8px;text-align:right;font-weight:700;color:var(--text2)">รวม (เฉพาะงวด ' + sanitize(curPeriodKey) + ')</td>' +
    '<td style="padding:7px 8px;text-align:right;font-weight:700">' + fmtMoneyShort(totalForecast) + '</td>' +
    '<td style="padding:7px 8px;text-align:right;font-weight:800" class="stat-good-t">' + fmtMoneyShort(totalWeighted) + '</td>' +
    '<td></td></tr>';
  h += '</tbody></table></div>';
  return h;
}
// สลับโชว์/ซ่อนแถวโครงการที่อยู่นอกงวดปัจจุบันในตาราง Project Conversion Plan
function _kpiConvToggleOtherPeriod(tblId) {
  var tbl = document.getElementById(tblId);
  var btn = document.getElementById(tblId + '_toggle');
  if (!tbl) return;
  var rows = tbl.querySelectorAll('.kpiConvOtherPeriod');
  if (!rows.length) return;
  var isHidden = rows[0].style.display === 'none';
  rows.forEach(function(tr) { tr.style.display = isHidden ? '' : 'none'; });
  if (btn) btn.textContent = isHidden ? '🙈 ซ่อนนอกงวดนี้' : '👁️ แสดงทั้งหมด (' + rows.length + ' นอกงวดนี้ซ่อนอยู่)';
}
function kpiImpAddActionFromPipeline(dealerId, pipeId, projectName, forecastAmount) {
  var existing = getImprovementActions(dealerId).filter(function(a) { return a.pipeId === pipeId; });
  if (existing.length) { toast('มีแผนสำหรับโครงการนี้อยู่แล้ว — ดูในตาราง Plan ด้านล่าง'); return; }
  ST.add('improvementActions', { dealerId: dealerId, action: 'แปลง Pipeline: ' + projectName, relatedTo: projectName, who: '', when: '', expectedResult: '', expectedSales: Number(forecastAmount) || 0, pipeId: pipeId });
  toast('➕ เพิ่มแผนจากโครงการแล้ว — แก้รายละเอียดในตาราง Plan ด้านล่าง');
  render();
}

function rKpiImprovementPlan(el) {
  var d = ST.getOne('dealers', S.dealerId);
  if (!d) return go('kpiCompanyPlan');
  var p = computeKpiCompanyPlan(d.id, getConfig());
  document.getElementById('pgT').textContent = '🚀 Improvement Plan — ' + d.name;
  var st = kpiPlanStatus(p);
  var sisActual = kpiPlanSisActual(p);
  var gap = p.target - sisActual;
  var currentForecast = sisActual + p.pipeWeighted;
  var opportunityTotal = improvementActionsTotal(d.id);
  var revised = currentForecast + opportunityTotal;
  var reasons = d.improvementReasons || [];

  var h = '<div class="bc"><a class="back-btn" onclick="go(\'kpiCompanyPlan\')"><span class="ic">←</span> กลับแผนบรรลุเป้า KPI</a></div>';
  h += '<div class="card" style="padding:0;overflow:hidden">';

  h += '<div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">';
  h += '<div><div style="font-size:16px;font-weight:800">' + sanitize(d.name) + ' — Improvement Plan ' + p.half + '</div><div style="font-size:11px;color:var(--text2);margin-top:3px">Level ' + sanitize(d.level || '-') + '</div></div>';
  h += '<span style="font-size:11px;font-weight:800;padding:5px 12px;border-radius:20px;background:' + st.bg + '" class="' + st.cls + '" title="คำนวณอัตโนมัติจากตัวเลข">' + st.label + ' (auto)</span>';
  h += '</div>';

  h += '<div style="padding:10px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
  h += '<span style="font-size:10.5px;color:var(--text2);font-weight:600">📝 ประเมินเอง:</span>';
  KPI_MANUAL_STATUS_OPTS.forEach(function(opt) {
    var on = (d.kpiStatusManual || '') === opt.key;
    h += '<span onclick="kpiSetManualStatus(\'' + d.id + '\',\'' + opt.key + '\')" style="cursor:pointer;font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:20px;border:1px solid ' + (on ? opt.color : 'var(--border)') + ';background:' + (on ? opt.bg : 'var(--bg2)') + ';color:' + (on ? opt.color : 'var(--text2)') + '">' + opt.icon + ' ' + opt.label + '</span>';
  });
  h += '</div>';

  h += '<div style="padding:16px 18px;border-bottom:1px solid var(--border)">';
  h += '<div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:8px">📋 Summary <span style="font-weight:400;font-size:10.5px;color:var(--text3)">— สรุปสั้นๆ เผื่อพิมพ์แยกส่งให้ Ryan (ไม่บังคับ กรอกไว้จะโชว์ในหน้า Print/English View ด้วย)</span></div>';
  h += '<textarea class="fm-input" rows="3" style="width:100%;font-size:12px" placeholder="เช่น สรุปสถานการณ์, ความเสี่ยงหลัก, สิ่งที่ต้องการจาก Ryan..." onchange="kpiImpSaveDealerField(\'' + d.id + '\',\'improvementSummary\',this.value)">' + sanitize(d.improvementSummary || '') + '</textarea>';
  h += '</div>';

  h += '<div style="padding:16px 18px;border-bottom:1px solid var(--border)">';
  h += '<div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:10px">1) Sales Gap & Capability (ดึงจากระบบอัตโนมัติ)</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">';
  h += kpiImpStat('H2 Target', fmtMoneyShort(p.target));
  h += kpiImpStat('SIS จริง', fmtMoneyShort(sisActual));
  h += kpiImpStat('Gap', fmtMoneyShort(Math.max(0, gap)), gap > 0 ? 'stat-bad-t' : 'stat-good-t');
  h += kpiImpStat('Pipeline ถ่วง POS', fmtMoneyShort(p.pipeWeighted));
  h += '</div>';
  h += '<div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:6px">สาเหตุหลักที่ Pipeline ปัจจุบันอาจไม่พอ (เลือกได้หลายข้อ)</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
  IMPROVEMENT_REASONS.forEach(function(r) {
    var on = reasons.indexOf(r) !== -1;
    h += '<span style="cursor:pointer;font-size:10.5px;padding:5px 10px;border-radius:20px;border:1px solid ' + (on ? 'var(--accent)' : 'var(--border)') + ';background:var(--bg2);font-weight:' + (on ? '700' : '400') + '"' + (on ? ' class="stat-good-t"' : '') + ' onclick="kpiImpToggleReason(\'' + d.id + '\',\'' + r.replace(/'/g, "\\'") + '\')">' + (on ? '✓ ' : '') + sanitize(r) + '</span>';
  });
  h += '</div></div>';

  h += '<div style="padding:16px 18px;border-bottom:1px solid var(--border)">';
  h += '<div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:10px">2) Project Conversion Plan (จาก Pipeline ที่เปิดอยู่)</div>';
  h += kpiImpProjectConversionSection(d.id, p);
  h += '</div>';

  h += '<div style="padding:16px 18px;border-bottom:1px solid var(--border)">';
  h += '<div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:10px">3) Plan <span style="font-weight:400;font-size:10.5px;color:var(--text3)">— แผนเพิ่มยอดทุกทาง: เจาะ End User ใหม่, ผลักดันสินค้าใหม่, สนับสนุน Dealer, หรือช่วยดันโครงการใน Pipeline ให้ปิดได้ — ไม่ต้องผูกกับใครก็ได้ ถ้าเป็นแผนทั่วไป</span></div>';
  h += kpiImpGrowthPlanTable(d.id);
  h += '</div>';

  h += '<div style="padding:16px 18px">';
  h += '<div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:10px">4) Gap vs Opportunity Rollup</div>';
  h += '<div style="background:var(--bg2);border-radius:11px;padding:12px 14px;display:flex;flex-direction:column;gap:7px;font-size:12.5px">';
  // ตัว Gap ที่ใช้ใน Rollup ต้อง "หัก Pipeline ออกแล้ว" (ต่างจาก Gap ในการ์ด Sales Gap & Capability ข้อ 1 ที่
  // เป็นแค่ Target - SIS จริง เฉยๆ ไม่เกี่ยวกับ Pipeline) เพราะ Rollup เรียงเป็นเนื้อเรื่องต่อกัน (Target →
  // Current Forecast ที่รวม Pipeline แล้ว → เหลือขาดเท่าไหร่ → New Opportunity จะมาช่วยปิดส่วนที่เหลือนี้) ถ้าใช้
  // Gap แบบไม่หัก Pipeline จะเห็นค่าที่สูงกว่าความเป็นจริง ทั้งที่ Current Forecast ข้างบนอาจจะเกินเป้าไปแล้วก็ได้
  // ทำให้ตัวเลขดูขัดกันเอง (พบจากที่ผู้ใช้ทักว่า Rollup ดูไม่ตรง 2026-08-21)
  var remainingGap = Math.max(0, p.target - currentForecast);
  h += kpiImpRollupRow('H2 Target', fmtMoneyShort(p.target));
  h += kpiImpRollupRow('Current Forecast (SIS จริง + Pipeline ถ่วง POS)', fmtMoneyShort(currentForecast));
  h += kpiImpRollupRow('เหลือขาด (หลังหัก Pipeline แล้ว)', fmtMoneyShort(remainingGap), remainingGap > 0 ? 'stat-bad-t' : 'stat-good-t');
  h += kpiImpRollupRow('New Opportunity จาก Plan (ไม่รวมแผนที่ผูก Pipeline — นับใน Pipeline ถ่วง POS ไปแล้ว)', fmtMoneyShort(opportunityTotal));
  h += '<div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px dashed var(--border);font-size:13.5px;font-weight:800"><span>Revised Forecast (ถ้าทำตามแผนสำเร็จ)</span><span class="' + (revised >= p.target ? 'stat-good-t' : 'stat-bad-t') + '">' + fmtMoneyShort(revised) + (revised >= p.target ? ' ✓ เกินเป้า' : ' ยังขาด ' + fmtMoneyShort(p.target - revised)) + '</span></div>';
  h += '</div></div>';

  h += '<div style="padding:16px 18px;background:var(--bg2);display:flex;gap:8px;flex-wrap:wrap">';
  h += '<button class="btn bsm bp" onclick="kpiImpCreateFollowupTasks(\'' + d.id + '\')">🗓️ สร้าง Task ติดตามรายสัปดาห์</button>';
  h += '<button class="btn bsm bo" onclick="exportImprovementPlanXlsx()">📤 Export Excel (ทุกบริษัทเสี่ยง)</button>';
  h += '<button class="btn bsm bo" onclick="printImprovementPlan(\'' + d.id + '\')">🖨️ พิมพ์ / บันทึกเป็น PDF</button>';
  h += '<button class="btn bsm bo" onclick="viewImprovementPlanEN(\'' + d.id + '\')" title="เปิดหน้านี้เป็นภาษาอังกฤษล้วน สำหรับโชว์ Ryan/ผู้บริหารต่างชาติ">🇬🇧 English View</button>';
  h += '</div>';

  h += '</div>';
  el.innerHTML = h;
}

// สร้าง Task จริงในระบบ Task (v7_tasks) ผูก dealerId จาก Action ที่ยังไม่เคยสร้าง Task มาก่อน (กันสร้างซ้ำด้วย
// a.taskId) — เจตนาให้ขึ้นในหน้า Tasks/วันนี้ปกติ ไม่ต้องมีระบบติดตามซ้อนอีกอัน
function kpiImpCreateFollowupTasks(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  var actions = getImprovementActions(dealerId).filter(function(a) { return !a.taskId && a.action; });
  if (!actions.length) return toast('ไม่มี Action ใหม่ที่ต้องสร้าง Task (ต้องมีชื่อ Action และยังไม่เคยสร้าง Task มาก่อน)');
  var count = 0;
  actions.forEach(function(a) {
    var t = ST.add('tasks', {
      title: '🚀 ' + a.action + (d ? ' — ' + d.name : ''),
      description: (a.relatedTo ? 'เกี่ยวกับ: ' + a.relatedTo + ' — ' : '') + (a.expectedResult || ''),
      startDate: _td(), dueDate: _td(), priority: 'high', category: 'Improvement Plan',
      status: 'active', sequential: false, url: '', dealerId: dealerId, pipeId: '', steps: []
    });
    ST.update('improvementActions', a.id, { taskId: t.id });
    count++;
  });
  toast('🗓️ สร้าง Task ติดตามแล้ว ' + count + ' รายการ — ปรับวันที่ในหน้า Task ได้ตามจริง');
  render();
}

// Export Excel — รวม Action Plan ของทุกบริษัทเสี่ยง (ไม่ใช่แค่บริษัทที่กำลังเปิดอยู่) เพราะ Ryan น่าจะอยาก
// เห็นภาพรวมทั้งหมดทีเดียวเวลาเปิดไฟล์ ใช้ SheetJS (XLSX) ตัวเดียวกับ Import/Export ยอดขาย SIS
// ตัดชื่อ Dealer ให้เป็นชื่อ sheet ที่ Excel ยอมรับ (≤31 ตัวอักษร, ห้ามมี \/?*[]:） กันชื่อซ้ำด้วยเลขต่อท้าย
function _kpiSafeSheetName(name, used) {
  var safe = (name || 'Dealer').replace(/[\\\/\?\*\[\]:]/g, ' ').trim().slice(0, 28) || 'Dealer';
  var final = safe, n = 2;
  while (used[final]) { final = safe.slice(0, 28 - String(n).length - 1) + '_' + n; n++; }
  used[final] = true;
  return final;
}
// Export ให้ครบเหมือนหน้า Print/PDF (ดู printImprovementPlan) — Summary tab 1 แถวต่อบริษัท รวมเป้า Dock/สถานะ
// manual ด้วย + tab แยกรายบริษัทที่มีทุก section เหมือน PDF (Sales Gap/End User/Project Conversion/Action Plan/Rollup)
function exportImprovementPlanXlsx() {
  var cfg = getConfig();
  var plans = computeKpiCompanyPlanAll(cfg).filter(function(p) { return kpiPlanStatus(p).label !== 'ถึงเป้าแล้ว'; });
  if (!plans.length) return toast('ไม่มีบริษัทเสี่ยง');
  var wb = XLSX.utils.book_new();

  // ---- Summary tab ----
  var sumHeader = ['Dealer', 'Level', 'Auto Risk', 'Manual Status', 'Period', 'Target', 'SIS Sell-out (Actual)', 'Sales Gap', 'Pipeline (POS-Weighted)', 'Current Forecast', 'New Opportunity', 'Revised Forecast', 'Dock Target H1', 'Dock Won H1', 'Dock Target H2', 'Dock Won H2', 'Key Blockers', 'Summary'];
  var sumRows = [sumHeader];
  plans.forEach(function(p) {
    var d = p.dealer;
    var sisActual = kpiPlanSisActual(p);
    var gap = Math.max(0, p.target - sisActual);
    var currentForecast = sisActual + p.pipeWeighted;
    var oppTotal = improvementActionsTotal(d.id);
    var manualSt = KPI_MANUAL_STATUS_OPTS.find(function(o) { return o.key === d.kpiStatusManual; });
    var stats = mondayCompanyStats(d.id, cfg);
    sumRows.push([
      d.name, d.level || '', kpiPlanStatus(p).label, manualSt ? manualSt.label : '', p.half + ' ' + p.sisYear,
      p.target, sisActual, gap, p.pipeWeighted, currentForecast, oppTotal, currentForecast + oppTotal,
      d.dockTargetH1 || 0, stats.dockWonH1 || 0, d.dockTargetH2 || 0, stats.dockWonH2 || 0,
      (d.improvementReasons || []).map(_kpiPrintEn).join(', '), d.improvementSummary || ''
    ]);
  });
  var wsSum = XLSX.utils.aoa_to_sheet(sumRows);
  wsSum['!cols'] = [{ wch: 22 }, { wch: 7 }, { wch: 12 }, { wch: 13 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsSum, 'Summary');

  // ---- per-dealer detail tabs ----
  var usedNames = {};
  plans.forEach(function(p) {
    var d = p.dealer;
    var sheetName = _kpiSafeSheetName(d.name, usedNames);
    var conv = _kpiConvBuildRows(d.id, p);
    var actions = getImprovementActions(d.id);
    var sisActual = kpiPlanSisActual(p);
    var gap = Math.max(0, p.target - sisActual);
    var total = improvementActionsTotal(d.id);
    var curRows = conv.rows.filter(function(r) { return r.isCurrent; });

    var aoa = [];
    aoa.push(['Dealer Improvement Plan', d.name]);
    aoa.push(['Level', d.level || '', 'Period', p.half + ' ' + p.sisYear]);
    aoa.push([]);
    if (d.improvementSummary) { aoa.push(['Summary', d.improvementSummary]); aoa.push([]); }
    aoa.push(['1) Sales Gap']);
    aoa.push(['Target', 'SIS Sell-out (Actual)', 'Gap', 'Pipeline (POS-Weighted)']);
    aoa.push([p.target, sisActual, gap, p.pipeWeighted]);
    if ((d.improvementReasons || []).length) aoa.push(['Key blockers', d.improvementReasons.map(_kpiPrintEn).join(', ')]);
    aoa.push([]);
    aoa.push(['2) Project Conversion Plan (' + conv.curPeriodKey + ')']);
    aoa.push(['#', 'Project', 'End-User', 'Status', 'Expected Period', 'Forecast Product', 'POS%', 'Forecast', 'Weighted Target']);
    if (curRows.length) {
      curRows.forEach(function(r) {
        var pp = r.pp, pipeObj = r.pipeObj;
        var statusLabel = (pipeObj && typeof PIPE_NAMES !== 'undefined' && PIPE_NAMES[pipeObj.status]) || (pipeObj ? pipeObj.status : '');
        var agency = pipeObj ? (pipeObj.agencyMain || pipeObj.endUserTH || pipeObj.endUserEN || '-') : '-';
        aoa.push([pp.rowNo || '', pp.projectName || '', agency, statusLabel, _kpiPrintEn(r.periodLabel) + (r.isGuessed ? ' (est.)' : ''), r.productQty || '-', r.pos, r.forecast, r.weighted]);
      });
    } else { aoa.push(['—']); }
    aoa.push(['Total', '', '', '', '', '', '', conv.totalForecast, conv.totalWeighted]);
    aoa.push([]);
    aoa.push(['3) Plan']);
    aoa.push(['What', 'Related to', 'Who', 'When', 'Expected Result', 'Expected Sales']);
    if (actions.length) actions.forEach(function(a) {
      var relatedTo = a.pipeId ? ((ST.getOne('pipeline', a.pipeId) || {}).projectName || a.relatedTo || '') : (a.relatedTo || '');
      aoa.push([a.action || '', relatedTo, a.who || '', a.when || '', a.expectedResult || '', Number(a.expectedSales) || 0]);
    });
    else aoa.push(['—']);
    aoa.push([]);
    aoa.push(['4) Rollup']);
    aoa.push(['Current Forecast', sisActual + p.pipeWeighted]);
    aoa.push(['New Opportunity (Plan Total, excl. Pipeline-linked)', total]);
    aoa.push(['Revised Forecast', sisActual + p.pipeWeighted + total]);

    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 13 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, 'Improvement_Plan_' + plans[0].half + '_' + _td() + '.xlsx');
  toast('📤 Export Excel แล้ว (' + (plans.length + 1) + ' tabs)');
}

// หน้าพิมพ์/PDF — เปิดแท็บใหม่ด้วย HTML ธรรมดา + window.print() แทนการเพิ่ม PDF library ใหม่ (เบากว่า และ
// เบราว์เซอร์ทำ "บันทึกเป็น PDF" ในตัวได้อยู่แล้วจากกล่อง Print)
// แปล label ที่มาจาก config/data ภายใน (สถานะ Pipeline, สาเหตุ Improve reason) เป็นอังกฤษคร่าวๆ สำหรับเอกสาร
// พิมพ์ที่ส่งให้ผู้บริหาร/ต่างชาติ (Ryan) — ถ้าไม่รู้จักคำ ก็ปล่อยข้อความเดิมผ่านไป (ดีกว่าแสดงค่าว่าง)
var KPI_PRINT_EN_MAP = {
  'ไม่ระบุวันที่': 'No date', 'ปี ': 'FY ',
  'Pipeline ยังน้อย': 'Pipeline too thin', 'Budget ยังไม่มา': 'Budget not released',
  'ยังไม่มี Demo': 'No demo yet', 'เข้าถึง End User ไม่ได้': 'Cannot reach end user',
  'มีคู่แข่ง': 'Competitor present', 'ขายแต่ Product เดิม': 'Selling same product only',
  'Technical Solution ยังไม่พร้อม': 'Technical solution not ready', 'ไม่มี New End User': 'No new end user',
  'กระทบราคาไม่เอา': 'Price objection', 'เสนอราคาออนไลน์ไม่ได้': 'Cannot quote online'
};
function _kpiPrintEn(s) {
  if (!s) return s;
  if (KPI_PRINT_EN_MAP[s]) return KPI_PRINT_EN_MAP[s];
  if (s.indexOf('ปี ') === 0) return 'FY ' + s.slice(3);
  return s;
}
// สร้าง HTML เต็มหน้า (ไม่รวม script/tag ปิดท้าย) ใช้ร่วมกันทั้งปุ่ม "พิมพ์/PDF" (เพิ่ม auto window.print())
// และปุ่ม "English View" (เปิดดูเฉยๆ ไม่สั่งพิมพ์ทันที — ไว้โชว์ Ryan แบบหน้าเว็บปกติ) คืน null ถ้าไม่มี Dealer
function _buildImprovementPlanEnHtml(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return null;
  var p = computeKpiCompanyPlan(dealerId, getConfig());
  var sisActual = kpiPlanSisActual(p);
  var gap = Math.max(0, p.target - sisActual);
  var actions = getImprovementActions(dealerId);
  var total = improvementActionsTotal(dealerId);
  var conv = _kpiConvBuildRows(dealerId, p);
  var manualSt = KPI_MANUAL_STATUS_OPTS.find(function(o) { return o.key === d.kpiStatusManual; });

  var html = '<!doctype html><html><head><meta charset="utf-8"><title>Improvement Plan - ' + sanitize(d.name) + '</title>' +
    '<style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 2px}h2{font-size:13px;margin:22px 0 8px;padding-bottom:4px;border-bottom:1px solid #ddd}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}th{background:#f0f0f0}' +
    '.stats{display:flex;gap:10px;margin:8px 0 4px}.stat{border:1px solid #ccc;border-radius:6px;padding:6px 10px;flex:1;text-align:center}' +
    '.stat b{display:block;font-size:14px;margin-top:2px}.sub{color:#555;font-size:11px}</style></head><body>';
  html += '<h1>Dealer Improvement Plan — ' + sanitize(d.name) + '</h1><div class="sub">Level ' + sanitize(d.level || '-') + ' · ' + p.half + ' ' + p.sisYear + (manualSt ? ' · Status: ' + manualSt.label : '') + ' · Printed on ' + fD(_td()) + '</div>';

  if (d.improvementSummary) {
    html += '<h2>Summary</h2><div style="font-size:11.5px;color:#333;white-space:pre-wrap;line-height:1.6">' + sanitize(d.improvementSummary) + '</div>';
  }

  html += '<h2>Sales Gap</h2><div class="stats">' +
    '<div class="stat">' + p.half + ' Target<b>' + fmtMoneyShort(p.target) + '</b></div>' +
    '<div class="stat">SIS Sell-out (Actual)<b>' + fmtMoneyShort(sisActual) + '</b></div>' +
    '<div class="stat">Gap<b>' + fmtMoneyShort(gap) + '</b></div>' +
    '<div class="stat">Pipeline (POS-Weighted)<b>' + fmtMoneyShort(p.pipeWeighted) + '</b></div></div>';
  if ((d.improvementReasons || []).length) html += '<div class="sub">Key blockers: ' + sanitize(d.improvementReasons.map(_kpiPrintEn).join(', ')) + '</div>';

  // ซ่อน section ที่ไม่มีข้อมูลเลยทิ้งไปทั้ง header (แสดงตารางว่างๆ แค่ "—" ไม่มีประโยชน์ รกตาเปล่าๆ)
  var curRows = conv.rows.filter(function(r) { return r.isCurrent; });
  if (curRows.length) {
    html += '<h2>Project Conversion Plan (Open Pipeline — ' + sanitize(conv.curPeriodKey) + ')</h2><table><tr><th>#</th><th>Project</th><th>End-User</th><th>Status</th><th>Expected Period</th><th>Forecast Product</th><th>POS%</th><th>Forecast</th><th>Weighted Target</th></tr>';
    html += curRows.map(function(r) {
      var pp = r.pp, pipeObj = r.pipeObj;
      var statusLabel = (pipeObj && typeof PIPE_NAMES !== 'undefined' && PIPE_NAMES[pipeObj.status]) || (pipeObj ? pipeObj.status : '');
      var agency = pipeObj ? (pipeObj.agencyMain || pipeObj.endUserTH || pipeObj.endUserEN || '-') : '-';
      return '<tr><td>' + (pp.rowNo ? '#' + sanitize(String(pp.rowNo)) : '—') + '</td><td>' + sanitize(pp.projectName || '(no name)') + '</td><td>' + sanitize(agency) + '</td><td>' + sanitize(statusLabel) + '</td><td>' + sanitize(_kpiPrintEn(r.periodLabel)) + (r.isGuessed ? ' (est.)' : '') + '</td><td>' + sanitize(r.productQty || '-') + '</td><td>' + r.pos + '%</td><td>' + fmtMoneyShort(r.forecast) + '</td><td>' + fmtMoneyShort(r.weighted) + '</td></tr>';
    }).join('');
    html += '<tr><td colspan="7"><b>Total</b></td><td><b>' + fmtMoneyShort(conv.totalForecast) + '</b></td><td><b>' + fmtMoneyShort(conv.totalWeighted) + '</b></td></tr>';
    html += '</table>';
  }

  if (actions.length) {
    html += '<h2>Plan</h2><table><tr><th>What</th><th>Related to</th><th>Who</th><th>When</th><th>Expected Result</th><th>Expected Sales</th></tr>';
    html += actions.map(function(a) {
      var relatedTo = a.pipeId ? ((ST.getOne('pipeline', a.pipeId) || {}).projectName || a.relatedTo || '') : (a.relatedTo || '');
      var sales = Number(a.expectedSales) || 0;
      return '<tr><td>' + sanitize(a.action || '(unnamed action)') + '</td><td>' + sanitize(relatedTo || '-') + '</td><td>' + sanitize(a.who || '-') + '</td><td>' + sanitize(a.when || '-') + '</td><td>' + sanitize(a.expectedResult || '-') + '</td><td>' + (sales ? fmtMoneyShort(sales) : '-') + (a.pipeId ? ' <span style="color:#888;font-size:10px">(in Pipeline)</span>' : '') + '</td></tr>';
    }).join('');
    html += '</table>';
  }

  html += '<h2>Rollup</h2><table><tr><td>Current Forecast</td><td>' + fmtMoneyShort(sisActual + p.pipeWeighted) + '</td></tr>' +
    '<tr><td>New Opportunity (Plan Total, excl. Pipeline-linked)</td><td>' + fmtMoneyShort(total) + '</td></tr>' +
    '<tr><td><b>Revised Forecast</b></td><td><b>' + fmtMoneyShort(sisActual + p.pipeWeighted + total) + '</b></td></tr></table>';
  return html;
}
function _kpiOpenPlanWindow(html) {
  var win = window.open('', '_blank');
  if (!win) { toast('⚠️ เบราว์เซอร์บล็อก popup — อนุญาต popup แล้วลองใหม่'); return; }
  win.document.write(html);
  win.document.close();
}
function printImprovementPlan(dealerId) {
  var html = _buildImprovementPlanEnHtml(dealerId);
  if (html === null) return;
  _kpiOpenPlanWindow(html + '<script>window.onload=function(){window.print();}</script></body></html>');
}
// เปิดดูหน้า Improvement Plan ภาษาอังกฤษล้วนแบบหน้าเว็บปกติ (ไม่สั่งพิมพ์ทันที) — สำหรับโชว์ Ryan/ผู้บริหาร
// ต่างชาติที่อยากดูตรงๆ ไม่ต้องผ่านกล่อง Print ก่อน ใช้ builder ตัวเดียวกับปุ่มพิมพ์เป๊ะๆ กันข้อความเพี้ยนกันคนละทาง
function viewImprovementPlanEN(dealerId) {
  var html = _buildImprovementPlanEnHtml(dealerId);
  if (html === null) return;
  _kpiOpenPlanWindow(html + '</body></html>');
}
