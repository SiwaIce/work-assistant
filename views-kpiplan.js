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

function rKpiCompanyPlan(el) {
  document.getElementById('pgT').textContent = '🎯 แผนบรรลุเป้า KPI';
  var cfg = getConfig();
  var plans = computeKpiCompanyPlanAll(cfg);

  var h = navHistory.length ? '<div class="bc"><a onclick="goBack()">← กลับ</a></div>' : '';

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
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">เป้า/ยอดขาย SIS จริง/Pipeline ในมือ (ถ่วง POS) ของแต่ละบริษัท พร้อมแผนรายเดือนแยก Project/Runrate — สำหรับสรุปให้ Ryan</div>';
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
  h += '<span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;background:' + st.bg + ';white-space:nowrap" class="' + st.cls + '">' + st.label + '</span>';
  h += '</div>';

  h += '<div style="height:9px;background:var(--bg2);border-radius:99px;overflow:hidden;margin-bottom:3px"><div style="height:100%;width:' + pct + '%;border-radius:99px;background:' + (isOk ? 'linear-gradient(90deg,var(--good,#22c55e),#6ee7a0)' : 'linear-gradient(90deg,#8b5cf6,#b794f6)') + '"></div></div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--text2);margin-bottom:12px"><span>ยอดขาย SIS จริง</span><b style="color:#8b5cf6">' + pct + '%</b></div>';

  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">';
  h += '<div style="background:var(--bg2);border-radius:10px;padding:7px 4px;text-align:center;cursor:pointer" onclick="event.stopPropagation();showKpiPlanTargetsM(\'' + p.dealer.id + '\')" title="กดเพื่อแก้ไขเป้า"><div style="font-size:8.5px;color:var(--text2);font-weight:700;text-transform:uppercase">เป้า ✏️</div><div style="font-size:12.5px;font-weight:800;margin-top:3px">' + fmtMoneyShort(p.target) + '</div></div>';
  h += '<div style="background:rgba(139,92,246,.12);border-radius:10px;padding:7px 4px;text-align:center"><div style="font-size:8.5px;color:var(--text2);font-weight:700;text-transform:uppercase">SIS จริง</div><div style="font-size:12.5px;font-weight:800;margin-top:3px;color:#8b5cf6">' + fmtMoneyShort(sisActual) + '</div></div>';
  h += '<div style="background:var(--bg2);border-radius:10px;padding:7px 4px;text-align:center"><div style="font-size:8.5px;color:var(--text2);font-weight:700;text-transform:uppercase">' + (isOk ? 'เกินเป้า' : 'ยังขาด') + '</div><div style="font-size:12.5px;font-weight:800;margin-top:3px" class="' + (isOk ? 'stat-good-t' : 'stat-bad-t') + '">' + (isOk ? '✓' : fmtMoneyShort(gap)) + '</div></div>';
  h += '</div>';

  h += '<div style="font-size:9px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.02em;margin-bottom:6px;display:flex;align-items:center;gap:6px">🔍 เทียบ DJI (Pipeline) vs SIS (บัญชี)<span style="flex:1;height:1px;background:var(--border)"></span></div>';
  if (hasProjectData) {
    h += '<div style="background:var(--bg2);border-radius:11px;padding:9px 11px;margin-bottom:12px">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
    h += '<span style="font-size:10px;font-weight:700;width:60px;flex:none;color:#0891b2">DJI จริง</span>';
    h += '<div style="flex:1;height:7px;background:var(--card);border-radius:99px;overflow:hidden"><div style="width:' + Math.round(p.djiActual / maxCmp * 100) + '%;height:100%;background:#0891b2;border-radius:99px"></div></div>';
    h += '<span style="font-size:10.5px;font-weight:800;width:50px;text-align:right;flex:none">' + fmtMoneyShort(p.djiActual) + '</span>';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<span style="font-size:10px;font-weight:700;width:60px;flex:none;color:#8b5cf6">SIS จริง</span>';
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
  h += '<div style="display:flex;gap:8px">';
  h += '<div style="flex:1;background:var(--bg2);border:1px dashed var(--border);border-radius:10px;padding:8px 10px;text-align:center"><div style="font-size:9px;color:var(--text2);font-weight:700;text-transform:uppercase">📊 Pipeline เปิดอยู่</div><div style="font-size:13px;font-weight:800;margin-top:3px">' + fmtMoneyShort(p.pipeWeighted) + '</div></div>';
  h += '<div style="flex:1;background:var(--bg2);border:1px dashed var(--border);border-radius:10px;padding:8px 10px;text-align:center"><div style="font-size:9px;color:var(--text2);font-weight:700;text-transform:uppercase">🔁 Runrate คาดไว้</div><div style="font-size:13px;font-weight:800;margin-top:3px">' + fmtMoneyShort(p.runrateForecast) + '</div></div>';
  h += '</div>';

  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:11px;padding-top:10px;border-top:1px solid var(--border)">';
  h += '<div style="display:flex;gap:10px;font-size:10.5px;color:var(--text2)"><span>' + qKeys[0].toUpperCase() + ' <b style="color:var(--text)">' + fmtMoneyShort((p.sisQuarters && p.sisQuarters[qKeys[0]]) || 0) + '</b></span><span>' + qKeys[1].toUpperCase() + ' <b style="color:var(--text)">' + fmtMoneyShort((p.sisQuarters && p.sisQuarters[qKeys[1]]) || 0) + '</b></span></div>';
  h += '<span style="font-size:11px;color:var(--text3)">' + (isOpen ? '▾ ซ่อนรายเดือน' : '▸ ดูรายเดือน') + '</span>';
  h += '</div>';

  h += '</div>';
  if (isOpen) h += kpiPlanDetailHtml(p);
  h += '</div>';
  return h;
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
  copyText(lines.join('\n'), '📋 คัดลอกสรุปแผน KPI แล้ว');
}
