// ================================================================
// PIPELINE HEALTH DASHBOARD — เช็คทุกวันจันทร์: ใครมีโครงการใหม่/ค้างอัปเดตนาน + ยอด Order รายสัปดาห์
// แทนที่สูตร Excel มือ (COUNTIF/SUMIFS) ที่ label กับสูตรไม่ตรงกัน ด้วยข้อมูลสดจากแอป (2026-08-28)
// ================================================================
var _pipeHealthActiveTab = 'health';
var _pipeHealthWeekOffset = 0;
var _pipeHealthWkTab = 'bid';
var PIPEHEALTH_STALE_DAYS = 14;

function rPipeHealth(el) {
  document.getElementById('pgT').textContent = '🚦 Pipeline Health';

  var h = '<div class="card" style="margin-bottom:10px">' +
    '<h2 style="margin:0">🚦 Pipeline Health</h2>' +
    '<div style="font-size:12px;color:var(--text2);margin-top:3px">เช็คทุกวันจันทร์ — ใครมีโครงการใหม่บ้าง ใครค้างอัปเดตนาน และยอด Order แยกรายสัปดาห์</div>' +
    '</div>';

  h += '<div class="ph-tabbar">' +
    '<button class="ph-tab-btn' + (_pipeHealthActiveTab === 'health' ? ' active' : '') + '" onclick="_pipeHealthTabClick(\'health\')">🚦 สุขภาพ Pipeline รายเซล</button>' +
    '<button class="ph-tab-btn' + (_pipeHealthActiveTab === 'weekly' ? ' active' : '') + '" onclick="_pipeHealthTabClick(\'weekly\')">📅 มุมมองรายสัปดาห์</button>' +
    '</div>';

  h += _pipeHealthActiveTab === 'health' ? _pipeHealthHealthPaneHtml() : _pipeHealthWeeklyPaneHtml();

  el.innerHTML = h;
}

function _pipeHealthTabClick(t) { _pipeHealthActiveTab = t; render(); }

// ================================================================
// สัปดาห์ (จันทร์–อาทิตย์) — offset เป็นจำนวนสัปดาห์จากสัปดาห์ปัจจุบัน
// ================================================================
function pipeHealthWeekRange(offset) {
  var now = new Date();
  var day = now.getDay();
  var diffToMon = (day === 0 ? -6 : 1 - day);
  var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon + (offset || 0) * 7);
  var sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var s = iso(mon), e = iso(sun);
  return { start: s, end: e, label: fD(s) + ' – ' + fD(e), monthDate: mon };
}

// ================================================================
// TAB 1: สุขภาพ Pipeline รายเซล
// ================================================================
function pipeHealthStatsBySale() {
  var wk = pipeHealthWeekRange(0);
  var pipes = ST.getAll('pipeline');
  var lastLogMap = {};
  ST.getAll('pipeLog').forEach(function(l) {
    var cur = lastLogMap[l.pipeId];
    if (!cur || (l.date || '') > (cur.date || '')) lastLogMap[l.pipeId] = l;
  });
  var visits = ST.getAll('visits');
  var lastVisitMap = {};
  visits.forEach(function(v) {
    var nm = v.saleName || '';
    if (!nm) return;
    if (!lastVisitMap[nm] || (v.date || '') > lastVisitMap[nm]) lastVisitMap[nm] = v.date || '';
  });

  var names = (typeof getSalesMembers === 'function' ? getSalesMembers() : [])
    .filter(function(m) { return m.active !== false; }).map(function(m) { return m.name; });
  pipes.forEach(function(p) {
    if (p.saleName && names.indexOf(p.saleName) === -1 && pipeIsOpen(p)) names.push(p.saleName);
  });

  function lastActivityDate(p) {
    var l = lastLogMap[p.id];
    return (l && l.date) ? l.date.split('T')[0] : (p.registerDate || (p.created ? p.created.split('T')[0] : ''));
  }

  var reps = names.map(function(name) {
    var mine = pipes.filter(function(p) { return (p.saleName || '') === name; });
    var openPipes = mine.filter(pipeIsOpen);
    var newThisWeek = openPipes.filter(function(p) {
      var rd = p.registerDate || (p.created ? p.created.split('T')[0] : '');
      return rd >= wk.start && rd <= wk.end;
    }).sort(function(a, b) { return (b.registerDate || '').localeCompare(a.registerDate || ''); });
    var stale = openPipes.filter(function(p) {
      var d = lastActivityDate(p);
      return d && daysBetween(d, _td()) > PIPEHEALTH_STALE_DAYS;
    }).sort(function(a, b) { return lastActivityDate(a).localeCompare(lastActivityDate(b)); });
    var lastVisitDate = lastVisitMap[name] || '';
    return {
      name: name,
      total: openPipes.length,
      newThisWeek: newThisWeek,
      stale: stale,
      lastVisitDate: lastVisitDate,
      lastVisitDays: lastVisitDate ? daysBetween(lastVisitDate, _td()) : null
    };
  });
  reps.sort(function(a, b) { return b.total - a.total; });
  return { weekRange: wk, reps: reps };
}

function _pipeHealthHealthPaneHtml() {
  var stats = pipeHealthStatsBySale();
  var h = '<div class="card">' +
    '<h2>🚦 สุขภาพ Pipeline รายเซล <span style="font-weight:400;color:var(--text3);font-size:12px">สัปดาห์ของ ' + stats.weekRange.label + '</span></h2>' +
    '<p class="ph-hint">"โครงการใหม่" นับจาก Register Date ในสัปดาห์นี้ · "ค้างอัปเดต" นับจากวันที่ Timeline ล่าสุดของโครงการ เกิน ' + PIPEHEALTH_STALE_DAYS + ' วัน — กดตัวเลขเพื่อดูรายชื่อโครงการ</p>' +
    '<div style="overflow-x:auto"><table class="ph-rep-table"><thead><tr>' +
    '<th>เซล</th><th class="num">Pipeline ทั้งหมด</th><th class="num">🆕 ใหม่สัปดาห์นี้</th>' +
    '<th class="num">⚠️ ค้างอัปเดต &gt;' + PIPEHEALTH_STALE_DAYS + ' วัน</th><th class="num ph-hide-sm">Visit ล่าสุด</th>' +
    '</tr></thead><tbody>';

  if (!stats.reps.length) {
    h += '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">ยังไม่มีข้อมูลทีม Sales</td></tr>';
  } else {
    stats.reps.forEach(function(rep, idx) { h += _pipeHealthRepRowHtml(rep, idx); });
  }
  h += '</tbody></table></div></div>';
  return h;
}

function _pipeHealthRepRowHtml(rep, idx) {
  var initials = (rep.name || '?').trim().split(/\s+/).map(function(w) { return w.charAt(0); }).slice(0, 2).join('').toUpperCase();
  var newCount = rep.newThisWeek.length;
  var staleCount = rep.stale.length;
  var newCls = newCount === 0 ? 'zero' : 'good';
  var staleCls = staleCount === 0 ? 'zero' : (staleCount >= 10 ? 'bad' : 'warn');
  var lastVisitTxt = rep.lastVisitDays === null ? '—' : rep.lastVisitDays + ' วันก่อน';
  var lastVisitColor = (rep.lastVisitDays !== null && rep.lastVisitDays > 30) ? 'var(--c4,#ef4444)' : 'var(--text2)';
  var newDrillId = 'ph_new_' + idx, staleDrillId = 'ph_stale_' + idx;

  var h = '<tr>' +
    '<td><div class="ph-rep-name"><span class="ph-avatar">' + sanitize(initials) + '</span>' + sanitize(rep.name) + '</div></td>' +
    '<td class="ph-td-center mono">' + rep.total + '</td>' +
    '<td class="ph-td-center">' + (newCount ? '<span class="ph-pill ' + newCls + '" onclick="_pipeHealthToggleDrill(\'' + newDrillId + '\')">' + newCount + '</span>' : '<span class="ph-pill zero">0</span>') + '</td>' +
    '<td class="ph-td-center">' + (staleCount ? '<span class="ph-pill ' + staleCls + '" onclick="_pipeHealthToggleDrill(\'' + staleDrillId + '\')">' + staleCount + '</span>' : '<span class="ph-pill zero">0</span>') + '</td>' +
    '<td class="ph-td-center mono ph-hide-sm" style="color:' + lastVisitColor + '">' + lastVisitTxt + '</td>' +
    '</tr>';

  h += '<tr><td colspan="5" style="padding:0;border:none">';
  var safeName = sanitize(rep.name).replace(/'/g, "\\'");
  if (newCount) {
    h += '<div class="ph-drill" id="' + newDrillId + '">' + rep.newThisWeek.slice(0, 5).map(function(p) { return _pipeHealthRowHtml(p, 'new'); }).join('');
    if (newCount > 5) h += '<div class="ph-drill-more">+ อีก ' + (newCount - 5) + ' โครงการ — <a href="javascript:void(0)" onclick="_pipeHealthShowAllM(\'' + safeName + '\',\'new\')">ดูทั้งหมด →</a></div>';
    h += '</div>';
  }
  if (staleCount) {
    h += '<div class="ph-drill" id="' + staleDrillId + '">' + rep.stale.slice(0, 5).map(function(p) { return _pipeHealthRowHtml(p, 'stale'); }).join('');
    if (staleCount > 5) h += '<div class="ph-drill-more">+ อีก ' + (staleCount - 5) + ' โครงการ — <a href="javascript:void(0)" onclick="_pipeHealthShowAllM(\'' + safeName + '\',\'stale\')">ดูทั้งหมด →</a></div>';
    h += '</div>';
  }
  h += '</td></tr>';
  return h;
}

// แถวโครงการในลิสต์ย่อย (ใหม่/ค้างอัปเดต) — ใช้ _kpiApDetailHtml เดียวกับตัวเลือกโครงการใน KPI (รายละเอียดสินค้า/End User/TOR)
function _pipeHealthRowHtml(p, kind) {
  var dl = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
  var when;
  if (kind === 'new') {
    var rd = p.registerDate || (p.created ? p.created.split('T')[0] : '');
    when = 'Register ' + fD(rd);
  } else {
    var lastLog = null;
    ST.pipeLogsByPipe(p.id).forEach(function(l) { if (!lastLog || (l.date || '') > (lastLog.date || '')) lastLog = l; });
    var lastDate = (lastLog && lastLog.date) ? lastLog.date.split('T')[0] : (p.registerDate || '');
    when = lastDate ? 'ค้าง ' + daysBetween(lastDate, _td()) + ' วัน' : '—';
  }
  return '<div class="ph-drill-item">' +
    '<div class="ph-drill-row">' +
    '<button class="ph-expand" onclick="_pipeHealthToggleDetail(this)">▼</button>' +
    (p.rowNo ? '<span class="ph-rowno">#' + sanitize(String(p.rowNo)) + '</span>' : '') +
    '<span class="ph-n">' + sanitize(p.projectName || '-') + '</span>' +
    '<span class="ph-dealer">' + sanitize(dl ? dl.name : '') + '</span>' +
    '<span class="ph-d">' + when + '</span>' +
    '<a class="ph-lnk" href="javascript:void(0)" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">เปิด →</a>' +
    '</div>' +
    '<div class="ph-drill-detail">' + _kpiApDetailHtml(p) + '</div>' +
    '</div>';
}

function _pipeHealthToggleDrill(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var wasOpen = el.classList.contains('open');
  document.querySelectorAll('.ph-drill').forEach(function(d) { d.classList.remove('open'); });
  if (!wasOpen) el.classList.add('open');
}

function _pipeHealthToggleDetail(btn) {
  var item = btn.closest('.ph-drill-item');
  var det = item.querySelector('.ph-drill-detail');
  var open = det.classList.toggle('open');
  btn.textContent = open ? '▲' : '▼';
}

function _pipeHealthShowAllM(saleName, kind) {
  var stats = pipeHealthStatsBySale();
  var rep = stats.reps.filter(function(r) { return r.name === saleName; })[0];
  if (!rep) return;
  var list = kind === 'new' ? rep.newThisWeek : rep.stale;
  var title = (kind === 'new' ? '🆕 โครงการใหม่สัปดาห์นี้ — ' : '⚠️ ค้างอัปเดต >' + PIPEHEALTH_STALE_DAYS + ' วัน — ') + saleName;
  openM(title, '<div class="ph-drill open" style="margin:0">' + list.map(function(p) { return _pipeHealthRowHtml(p, kind); }).join('') + '</div>');
}

// ================================================================
// TAB 2: มุมมองรายสัปดาห์ — ต่อยอด "โครงการรายเดือน" ของ KPI (Bidding/Forecast Month/Shipment Date)
// แค่ปรับหน่วยเป็นสัปดาห์แทนเดือน
// ================================================================
function _pipeHealthWeekShift(delta) { _pipeHealthWeekOffset += delta; render(); }
function _pipeHealthWeekReset() { _pipeHealthWeekOffset = 0; render(); }
function _pipeHealthWkTabClick(t) { _pipeHealthWkTab = t; render(); }

function pipeHealthProjectsByWeek(tab, wk) {
  var pipes = ST.getAll('pipeline');
  return pipes.filter(function(p) {
    if (tab === 'bid') return !!p.biddingDate && p.biddingDate >= wk.start && p.biddingDate <= wk.end;
    if (tab === 'ship') return !!p.shipmentDate && p.shipmentDate >= wk.start && p.shipmentDate <= wk.end;
    if (tab === 'fc') {
      var info = _kpiParseForecastMonthText(p.forecastMonth);
      return !!info && info.month === (wk.monthDate.getMonth() + 1) && info.year === wk.monthDate.getFullYear();
    }
    return false;
  }).sort(function(a, b) { return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); });
}

function _pipeHealthWeeklyPaneHtml() {
  var wk = pipeHealthWeekRange(_pipeHealthWeekOffset);
  var cfg = getConfig();
  var list = pipeHealthProjectsByWeek(_pipeHealthWkTab, wk);
  var total = list.reduce(function(s, p) { return s + (Number(p.forecastAmount) || 0); }, 0);
  var tabLabels = { bid: '📄 Bidding Date', fc: '🔮 Forecast Month', ship: '🚚 Shipment Date' };
  var tabOrder = ['bid', 'fc', 'ship'];

  var h = '<div class="card">' +
    '<div class="ph-week-nav">' +
    '<button onclick="_pipeHealthWeekShift(-1)">◀ สัปดาห์ก่อน</button>' +
    '<span class="ph-week-label">' + wk.label + '</span>' +
    '<button onclick="_pipeHealthWeekShift(1)">สัปดาห์ถัดไป ▶</button>' +
    (_pipeHealthWeekOffset !== 0 ? '<button onclick="_pipeHealthWeekReset()">สัปดาห์นี้</button>' : '') +
    '<span class="ph-week-total">' + list.length + ' โครงการ · รวม <b>' + fmtMoney(total) + '</b></span>' +
    '</div>' +
    '<div class="ph-wk-tabs">' +
    tabOrder.map(function(k) { return '<button class="ph-wk-tab' + (_pipeHealthWkTab === k ? ' active' : '') + '" onclick="_pipeHealthWkTabClick(\'' + k + '\')">' + tabLabels[k] + '</button>'; }).join('') +
    '</div>';

  if (!list.length) {
    h += '<div class="ph-empty-wk">ไม่มีโครงการในสัปดาห์นี้</div>';
  } else {
    list.forEach(function(p) {
      var dl = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
      var st = (cfg.pipelineStatuses || []).filter(function(s) { return s.id === p.status; })[0];
      var color = st ? st.color : '#94a3b8';
      h += '<div class="ph-proj-row">' +
        '<span class="ph-dot" style="background:' + color + '"></span>' +
        '<div class="ph-main"><div class="t">' + sanitize(p.projectName || '-') + '</div>' +
        '<div class="s">🏢 ' + sanitize(dl ? dl.name : '-') + ' · ' + sanitize(st ? st.name : '-') + '</div></div>' +
        '<span class="ph-rep">' + sanitize(p.saleName || '-') + '</span>' +
        '<span class="ph-amt mono">' + fmtMoney(p.forecastAmount) + '</span>' +
        '</div>';
    });
  }
  h += '</div>';
  return h;
}
