// ================================================================
// KPI COMPANY PLAN — แผนบรรลุเป้ารายบริษัท (SAB Partner) โจทย์จาก Ryan: รวบรวมว่าบริษัทไหนเป้าเท่าไหร่
// ทำได้เท่าไหร่ ต้องทำอีกเท่าไหร่ + แผนรายเดือนแยก Project/Runrate เพื่อดูว่าจะถึงเป้าไหม เดือนไหนต้องเร่ง
// ตัวเลขทั้งหมดคำนวณจาก computeKpiCompanyPlan/computeKpiCompanyPlanAll (utils.js) — ไม่มีตัวเลขสมมติ
// ================================================================
var kpiPlanExpandedId = null;

function kpiPlanStatus(p) {
  var ratio = p.target ? (p.actualSoFar + p.pipeWeighted) / p.target : 1;
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
  var totalTarget = 0, totalActual = 0, totalPipe = 0, riskCount = 0;
  plans.forEach(function(p) {
    totalTarget += p.target; totalActual += p.actualSoFar; totalPipe += p.pipeWeighted;
    if (kpiPlanStatus(p).label !== 'ถึงเป้าแล้ว') riskCount++;
  });
  var totalGap = Math.max(0, totalTarget - totalActual - totalPipe);

  h += '<div class="card"><h2>🎯 แผนบรรลุเป้า KPI — SAB Partner (' + half + ')</h2>';
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">เป้า/ยอดจริง/Pipeline ในมือ (ถ่วง POS) ของแต่ละบริษัท พร้อมแผนรายเดือนแยก Project/Runrate — สำหรับสรุปให้ Ryan</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px">';
  h += kpiPlanSumCard('เป้ารวม ' + half, fmtMoneyShort(totalTarget));
  h += kpiPlanSumCard('ทำได้แล้ว', fmtMoneyShort(totalActual), 'stat-good-t');
  h += kpiPlanSumCard('Pipeline ในมือ', fmtMoneyShort(totalPipe));
  h += kpiPlanSumCard('ยังขาดอีก', totalGap > 0 ? fmtMoneyShort(totalGap) : 'ถึงเป้าแล้ว', totalGap > 0 ? 'stat-bad-t' : 'stat-good-t');
  h += kpiPlanSumCard('บริษัทเสี่ยงไม่ถึงเป้า', riskCount + ' / ' + plans.length, riskCount ? 'stat-bad-t' : 'stat-good-t');
  h += '</div>';
  h += '<button class="btn bsm bo" onclick="copyKpiPlanSummary()">📋 คัดลอกสรุปส่ง Ryan</button>';
  h += '</div>';

  plans.forEach(function(p) { h += kpiPlanRowHtml(p); });

  el.innerHTML = h;
}

function kpiPlanSumCard(label, val, colorCls) {
  return '<div style="background:var(--bg2);border-radius:10px;padding:10px 12px">' +
    '<div style="font-size:10.5px;color:var(--text2);text-transform:uppercase;letter-spacing:.02em">' + label + '</div>' +
    '<div style="font-size:17px;font-weight:700;margin-top:2px" class="' + (colorCls || '') + '">' + val + '</div></div>';
}

function kpiPlanRowHtml(p) {
  var st = kpiPlanStatus(p);
  var gap = p.target - p.actualSoFar - p.pipeWeighted;
  var pct = p.target ? Math.min(100, Math.round((p.actualSoFar + p.pipeWeighted) / p.target * 100)) : 0;
  var isOpen = kpiPlanExpandedId === p.dealer.id;
  var h = '<div class="card" style="padding:0;overflow:hidden">';
  h += '<div style="padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;flex-wrap:wrap" onclick="kpiPlanToggleRow(\'' + p.dealer.id + '\')">';
  h += '<div style="flex:1;min-width:160px"><div style="font-weight:700;font-size:14px">' + sanitize(p.dealer.name) + '</div>' +
    '<div style="font-size:11px;color:var(--text2)">' + sanitize(p.dealer.level || '') + '</div></div>';
  h += '<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:' + st.bg + '" class="' + st.cls + '">' + st.label + '</span>';
  h += '<div style="text-align:right;min-width:80px"><div style="font-size:10px;color:var(--text2)">เป้า</div><div style="font-weight:600">' + fmtMoneyShort(p.target) + '</div></div>';
  h += '<div style="text-align:right;min-width:80px"><div style="font-size:10px;color:var(--text2)">ทำได้+Pipeline</div><div style="font-weight:600">' + fmtMoneyShort(p.actualSoFar + p.pipeWeighted) + ' (' + pct + '%)</div></div>';
  h += '<div style="text-align:right;min-width:90px"><div style="font-size:10px;color:var(--text2)">ยังขาด</div><div style="font-weight:700" class="' + (gap > 0 ? 'stat-bad-t' : 'stat-good-t') + '">' + (gap > 0 ? fmtMoneyShort(gap) : 'เกินเป้า ✓') + '</div></div>';
  h += '<span style="font-size:11px;color:var(--text2)">' + (isOpen ? '▼' : '▶') + '</span>';
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

  h += '<div style="font-size:11.5px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.02em;margin-bottom:8px">ยอดรายเดือน — Project / Runrate (จังหวะที่ต้องทำ ' + fmtMoneyShort(reqPerMonth) + '/เดือน)</div>';
  h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:600px">';
  h += '<thead><tr>' +
    '<th style="text-align:left;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">เดือน</th>' +
    '<th style="text-align:right;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">รวม</th>' +
    '<th style="text-align:right;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">Project</th>' +
    '<th style="text-align:right;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">Runrate</th>' +
    '<th style="text-align:right;font-size:10px;color:var(--text2);padding:5px 8px;border-bottom:1px solid var(--border)">สถานะ</th></tr></thead><tbody>';
  p.monthly.forEach(function(m) {
    var total = m.project + m.runrate;
    var tag = m.isCurrent ? '<span style="font-size:9px;border:1px solid var(--border);border-radius:8px;padding:1px 6px;margin-left:6px;color:var(--text2)">เดือนนี้</span>'
      : m.isFuture ? '<span style="font-size:9px;border:1px solid var(--border);border-radius:8px;padding:1px 6px;margin-left:6px;color:var(--text2)">' + (m.isManual ? 'แผน' : 'แนะนำ') + '</span>'
      : '<span style="font-size:9px;border:1px solid var(--border);border-radius:8px;padding:1px 6px;margin-left:6px;color:var(--text2)">จริง</span>';
    h += '<tr' + (m.isCurrent ? ' style="background:rgba(59,111,214,.08)"' : '') + '>';
    h += '<td style="padding:6px 8px;font-weight:600;font-size:12.5px">' + m.label + tag + '</td>';
    h += '<td style="text-align:right;padding:6px 8px;font-weight:700;font-size:12.5px">' + fmtMoneyShort(total) + '</td>';
    if (m.isFuture) {
      h += '<td style="text-align:right;padding:4px 8px"><input type="number" step="1000" class="fm-input" style="width:90px;text-align:right;padding:4px 6px;font-size:12px" id="kpiplan_p_' + p.dealer.id + '_' + m.month + '" value="' + Math.round(m.project) + '"></td>';
      h += '<td style="text-align:right;padding:4px 8px"><input type="number" step="1000" class="fm-input" style="width:90px;text-align:right;padding:4px 6px;font-size:12px" id="kpiplan_r_' + p.dealer.id + '_' + m.month + '" value="' + Math.round(m.runrate) + '"></td>';
    } else {
      h += '<td style="text-align:right;padding:6px 8px;font-size:12.5px">' + fmtMoneyShort(m.project) + '</td>';
      h += '<td style="text-align:right;padding:6px 8px;font-size:12.5px">' + fmtMoneyShort(m.runrate) + '</td>';
    }
    h += '<td style="text-align:right;padding:6px 8px;font-size:11px" class="' + (total >= reqPerMonth ? 'stat-good-t' : 'stat-bad-t') + '">' + (total >= reqPerMonth ? '✓ ทันจังหวะ' : '▼ ต่ำกว่าจังหวะ') + '</td>';
    h += '</tr>';
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
