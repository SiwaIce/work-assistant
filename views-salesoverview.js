// ================================================================
// SALES OVERVIEW — หน้า "📊 ภาพรวมยอดขาย" สรุปเดือน/ไตรมาส/ครึ่งปี ดูได้ทั้งบริษัท เฉพาะ Dealer หรือ
// เฉพาะ Sales คนเดียว มีการ์ดสรุป (เลือกเองได้ว่าจะโชว์อะไร) + พาเนลย่อยหลายอัน ทุกตัวเลขมาจาก
// computeSalesOverview/salesOverviewXxx (utils.js) ซึ่งต่อยอดจาก computeKpiCompanyPlan ตรงๆ ไม่มีเลขสมมติ
// บันทึกการตั้งค่าการ์ดที่เลือกไว้ต่อเครื่อง (localStorage) แบบเดียวกับ hideFields ที่มีอยู่แล้ว
// ================================================================
var SO_CARD_META = {
  sis:          { lbl: 'ยอดขาย SIS (Sell-out)', hasTarget: true },
  dji:          { lbl: 'ยอดขาย DJI (Sell-in)', hasTarget: false },
  so:           { lbl: 'จำนวน Sales Order', isCount: true },
  activeDealer: { lbl: 'Dealer ที่มียอดขาย', isCount: true },
  newDealer:    { lbl: 'Dealer ใหม่', isCount: true },
  riskDealer:   { lbl: 'Dealer เสี่ยงไม่ถึงเป้า', isCount: true },
  pipeCount:    { lbl: 'Pipeline เปิดอยู่', isCount: true },
  pipeRaw:      { lbl: 'Pipeline มูลค่ารวม (ดิบ)' },
  pipeWeighted: { lbl: 'Pipeline ถ่วง Win Rate' },
  winrate:      { lbl: 'Win Rate เฉลี่ย', isPct: true },
  project:      { lbl: 'ยอดจาก Project (Won)' },
  runrate:      { lbl: 'ยอดจาก Run Rate' }
};
var SO_CARD_DEFAULT = ['sis', 'so', 'activeDealer', 'newDealer'];
var SO_PANEL_DEFAULT = ['products', 'dealers', 'highlight', 'trend', 'djisis', 'team'];
var SO_CATEGORIES = null; // เติมจาก PRODUCT_CATEGORIES ตอน render ครั้งแรก

var soState = { scope: 'all', sub: null, period: 'quarter', prodCat: 'all', prodMode: 'value', dealersExpanded: false, hlSort: 'amt', hlExpanded: false };

function soLoadConfig() {
  try {
    var raw = JSON.parse(localStorage.getItem('v7_salesOverviewCfg') || 'null');
    if (raw && raw.cards && raw.panels) return raw;
  } catch (e) {}
  return { cards: SO_CARD_DEFAULT.slice(), panels: SO_PANEL_DEFAULT.slice() };
}
function soSaveConfig(cfg) { localStorage.setItem('v7_salesOverviewCfg', JSON.stringify(cfg)); }

function rSalesOverview(el) {
  document.getElementById('pgT').textContent = '📊 ภาพรวมยอดขาย';
  if (!SO_CATEGORIES) {
    SO_CATEGORIES = [{ k: 'all', lbl: 'ทั้งหมด' }].concat((typeof PRODUCT_CATEGORIES !== 'undefined' ? PRODUCT_CATEGORIES : []).map(function(c) { return { k: c.id, lbl: c.name }; }));
  }
  var cfg = soLoadConfig();
  soState.cards = cfg.cards; soState.panels = cfg.panels;

  var h = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '';
  h += '<div class="card">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap">';
  h += '<h2 style="margin:0">🎯 ภาพรวมยอดขาย</h2>';
  h += '<button class="btn bsm bo" onclick="soOpenCfg()">⚙️ ปรับแต่งหน้านี้</button>';
  h += '</div>';

  h += '<div id="soRiskBanner"></div>';
  h += '<div id="soExecLine"></div>';

  h += '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:10px">';
  h += '<div style="display:flex;flex-direction:column;gap:5px"><label style="font-size:9.5px;color:var(--text3);font-weight:700;text-transform:uppercase">ระดับที่ดู</label>' +
    '<div id="soScopeSeg" style="display:inline-flex;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:2px;gap:2px">' +
    soSegBtn('scope', 'all', '🌍 ทั้งหมด') + soSegBtn('scope', 'dealer', '🏪 เฉพาะ Dealer') + soSegBtn('scope', 'sales', '👤 เฉพาะ Sales') + '</div></div>';
  h += '<div style="display:flex;flex-direction:column;gap:5px;position:relative"><label style="font-size:9.5px;color:var(--text3);font-weight:700;text-transform:uppercase">เลือก Dealer/Sales</label>' +
    '<input type="text" id="soSubInput" class="fm-input" style="min-width:180px" placeholder="— ไม่ต้องระบุ —" disabled autocomplete="off" ' +
    'oninput="soOnSubInput()" onfocus="soOnSubInput()" onkeydown="soOnSubKeydown(event)" onblur="soOnSubBlur()">' +
    '<div id="soSubList" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--card);border:1px solid var(--border);border-radius:9px;box-shadow:0 8px 24px rgba(0,0,0,.15);max-height:220px;overflow-y:auto;z-index:40;margin-top:2px"></div></div>';
  h += '<div style="display:flex;flex-direction:column;gap:5px"><label style="font-size:9.5px;color:var(--text3);font-weight:700;text-transform:uppercase">ช่วงเวลา</label>' +
    '<div id="soPeriodSeg" style="display:inline-flex;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:2px;gap:2px">' +
    soSegBtn('period', 'month', 'รายเดือน') + soSegBtn('period', 'quarter', 'รายไตรมาส') + soSegBtn('period', 'half', 'รายครึ่งปี') + '</div></div>';
  h += '</div>';

  h += '<div id="soScopeLine" style="font-size:12px;color:var(--text2);margin-bottom:14px;padding-bottom:12px;border-bottom:1px dashed var(--border)"></div>';

  h += '<div id="soStatsRow" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:12px"></div>';
  h += '<div id="soPanelsFlow" style="display:flex;flex-wrap:wrap;gap:12px"></div>';
  h += '</div>';

  el.innerHTML = h;
  soRenderAll();
}

function soSegBtn(group, val, lbl) {
  return '<button data-' + group + '="' + val + '" onclick="soSet' + (group === 'scope' ? 'Scope' : 'Period') + '(\'' + val + '\')" style="border:none;background:transparent;padding:6px 12px;border-radius:8px;font-size:11.5px;font-weight:700;color:var(--text2);cursor:pointer">' + lbl + '</button>';
}

// ---- scope / period / combobox ----
var soSubOptions = [];
var soSubHighlight = -1;

function soSetScope(s) {
  soState.scope = s; soState.dealersExpanded = false;
  soMarkSeg('soScopeSeg', 'scope', s);
  var input = document.getElementById('soSubInput');
  soCloseSubList();
  if (s === 'all') {
    input.disabled = true; input.value = ''; input.placeholder = '— ไม่ต้องระบุ —'; soState.sub = null; soSubOptions = [];
  } else if (s === 'dealer') {
    input.disabled = false; input.placeholder = 'พิมพ์ชื่อ Dealer...';
    soSubOptions = scopedDealers().map(function(d) { return d.name; }).sort();
    soState.sub = null; input.value = '';
  } else {
    input.disabled = false; input.placeholder = 'พิมพ์ชื่อ Sales...';
    soSubOptions = salesOverviewSaleNames();
    soState.sub = null; input.value = '';
  }
  soRenderAll();
}
function soSetPeriod(p) {
  soState.period = p;
  soMarkSeg('soPeriodSeg', 'period', p);
  soRenderAll();
}
function soMarkSeg(containerId, group, val) {
  var c = document.getElementById(containerId); if (!c) return;
  c.querySelectorAll('button').forEach(function(b) { b.style.background = (b.dataset[group] === val) ? 'var(--card)' : 'transparent'; b.style.color = (b.dataset[group] === val) ? 'var(--text)' : 'var(--text2)'; b.style.boxShadow = (b.dataset[group] === val) ? '0 1px 3px rgba(0,0,0,.08)' : 'none'; });
}

// พิมพ์ค้นหาแล้วอัปเดตแค่กล่องแนะนำ (#soSubList) เท่านั้น ไม่แตะช่อง input เลย — พิมพ์ต่อเนื่องได้ปกติไม่มีอาการ
// โฟกัสหลุดหรือต้องพิมพ์ทีละตัว (ปัญหาที่เคยเจอตอน render() รีเฟรชทั้งก้อนกลางคัน)
function soOnSubInput() {
  var input = document.getElementById('soSubInput');
  var q = input.value.trim().toLowerCase();
  var list = document.getElementById('soSubList');
  var matches = soSubOptions.filter(function(n) { return n.toLowerCase().indexOf(q) !== -1; });
  soSubHighlight = matches.length ? 0 : -1;
  if (!matches.length) {
    list.innerHTML = '<div style="padding:10px 12px;font-size:11px;color:var(--text3);text-align:center">ไม่พบชื่อที่ตรงกัน</div>';
  } else {
    list.innerHTML = matches.map(function(n, i) {
      var idx = q ? n.toLowerCase().indexOf(q) : -1;
      var marked = idx !== -1 ? sanitize(n.slice(0, idx)) + '<mark style="background:var(--accent-light,rgba(159,232,112,.15));color:var(--accent)">' + sanitize(n.slice(idx, idx + q.length)) + '</mark>' + sanitize(n.slice(idx + q.length)) : sanitize(n);
      return '<div style="padding:8px 12px;font-size:11.5px;cursor:pointer' + (i === 0 ? ';background:var(--bg2)' : '') + '" data-name="' + n.replace(/"/g, '&quot;') + '" onmousedown="soSelectSub(\'' + n.replace(/'/g, "\\'") + '\')">' + marked + '</div>';
    }).join('');
  }
  list.style.display = 'block';
}
function soOnSubBlur() { setTimeout(soCloseSubList, 150); }
function soCloseSubList() { var l = document.getElementById('soSubList'); if (l) l.style.display = 'none'; }
function soSelectSub(name) {
  soState.sub = name;
  var input = document.getElementById('soSubInput');
  input.value = name;
  soCloseSubList();
  soRenderAll();
  input.focus();
}
function soOnSubKeydown(e) {
  var list = document.getElementById('soSubList');
  var items = list.querySelectorAll('[data-name]');
  if (!items.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); soSubHighlight = Math.min(soSubHighlight + 1, items.length - 1); soUpdateSubHl(items); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); soSubHighlight = Math.max(soSubHighlight - 1, 0); soUpdateSubHl(items); }
  else if (e.key === 'Enter') { e.preventDefault(); if (soSubHighlight >= 0) soSelectSub(items[soSubHighlight].dataset.name); }
  else if (e.key === 'Escape') { soCloseSubList(); }
}
function soUpdateSubHl(items) {
  items.forEach(function(it, i) { it.style.background = (i === soSubHighlight) ? 'var(--bg2)' : 'transparent'; });
  if (items[soSubHighlight]) items[soSubHighlight].scrollIntoView({ block: 'nearest' });
}

// ---- main render ----
function soCurrentOv() {
  var subId = soState.scope === 'dealer' && soState.sub ? (scopedDealers().find(function(d) { return d.name === soState.sub; }) || {}).id : soState.sub;
  return computeSalesOverview(soState.scope, soState.scope === 'dealer' ? subId : soState.sub, soState.period);
}

function soRenderAll() {
  var ov = soCurrentOv();
  var periodLbl = soState.period === 'month' ? 'รายเดือน' : soState.period === 'quarter' ? 'รายไตรมาส' : 'รายครึ่งปี';
  var scopeLbl = soState.scope === 'all' ? 'ทั้งหมดทุกบริษัท' : soState.scope === 'dealer' ? (soState.sub ? 'เฉพาะบริษัท ' + soState.sub : 'ยังไม่ได้เลือก Dealer') : (soState.sub ? 'เฉพาะ Sales ' + soState.sub : 'ยังไม่ได้เลือก Sales');
  document.getElementById('soScopeLine').innerHTML = 'กำลังดู: <b style="color:var(--text)">' + sanitize(scopeLbl) + '</b> · <span style="background:var(--accent-light,rgba(159,232,112,.15));color:var(--accent);font-weight:700;padding:2px 10px;border-radius:20px;font-size:11px">' + periodLbl + ' (' + ov.mm.half + ')</span>';

  soRenderExecLine(ov);
  soRenderRiskBanner(ov);
  soRenderStats(ov);
  soRenderPanelsShell();
  if (soState.panels.indexOf('products') !== -1) soRenderProducts(ov);
  if (soState.panels.indexOf('dealers') !== -1) soRenderDealers(ov);
  if (soState.panels.indexOf('highlight') !== -1) soRenderHighlight(ov);
  if (soState.panels.indexOf('trend') !== -1) soRenderTrend(ov);
  if (soState.panels.indexOf('djisis') !== -1) soRenderDjiSis(ov);
  if (soState.panels.indexOf('team') !== -1) soRenderTeam(ov);
}

function soFmt(v, meta) {
  if (meta && meta.isPct) return v + '%';
  if (meta && meta.isCount) return Math.round(v);
  return '฿' + fmtMoneyShort(v);
}

function soRenderExecLine(ov) {
  var el = document.getElementById('soExecLine'); if (!el) return;
  if (!ov.target) { el.innerHTML = ''; return; }
  var pctNow = Math.round(ov.sis / ov.target * 100);
  var forecastEnd = ov.sis + ov.pipeWeighted;
  var pctForecast = Math.round(forecastEnd / ov.target * 100);
  var ok = pctForecast >= 100;
  el.innerHTML = '<div style="font-size:13px;font-weight:600;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:11px 15px;margin-bottom:10px;line-height:1.6">' +
    '💡 ยอดขาย SIS ตอนนี้ <b>฿' + fmtMoneyShort(ov.sis) + '</b> (' + pctNow + '% ของเป้า ฿' + fmtMoneyShort(ov.target) + ') — ตามอัตราปัจจุบัน + Pipeline ที่เหลือ คาดจบงวดที่ <b>฿' + fmtMoneyShort(forecastEnd) + '</b> ' +
    '<span class="' + (ok ? 'stat-good-t' : 'stat-bad-t') + '" style="font-weight:800">(' + pctForecast + '% ของเป้า ' + (ok ? '✅ คาดถึงเป้า' : '⚠️ คาดไม่ถึงเป้า') + ')</span></div>';
}

function soRenderRiskBanner(ov) {
  var el = document.getElementById('soRiskBanner'); if (!el) return;
  if (soState.scope === 'dealer') {
    if (!ov.target || !soState.sub) { el.innerHTML = ''; return; }
    var pctForecast = Math.round((ov.sis + ov.pipeWeighted) / ov.target * 100);
    if (pctForecast >= 100) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="bad-box" style="cursor:pointer;display:flex;align-items:center;gap:10px" onclick="go(\'kpiCompanyPlan\')">' +
      '<span>⚠️</span><span style="flex:1">บริษัทนี้เสี่ยงไม่ถึงเป้า — คาดจบงวดที่ ' + pctForecast + '% ของเป้า</span><span>→</span></div>';
    return;
  }
  var team = salesOverviewTeamPerf(ov);
  var riskReps = team.filter(function(t) { return (t.warn + t.bad) > 0; });
  var riskCount = riskReps.reduce(function(s, t) { return s + t.warn + t.bad; }, 0);
  if (!riskCount) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="bad-box" style="cursor:pointer;display:flex;align-items:center;gap:10px" onclick="go(\'kpiCompanyPlan\')">' +
    '<span>⚠️</span><span style="flex:1">' + riskCount + ' บริษัทเสี่ยง/ต้องเร่งเป้า <span style="opacity:.85;font-weight:400">— ' + riskReps.map(function(t) { return sanitize(t.nm); }).join(', ') + '</span></span><span>→</span></div>';
}

function soRenderStats(ov) {
  var row = document.getElementById('soStatsRow');
  if (!soState.cards.length) { row.innerHTML = '<div style="text-align:center;padding:24px 10px;color:var(--text3);font-size:12px;border:1px dashed var(--border);border-radius:12px;grid-column:1/-1">ยังไม่ได้เลือกการ์ด — กด ⚙️ ปรับแต่งหน้านี้ เพื่อเลือก</div>'; return; }
  row.innerHTML = soState.cards.map(function(key) {
    var meta = SO_CARD_META[key]; if (!meta) return '';
    var val = ov[key];
    var tgtHtml = (meta.hasTarget && ov.target) ? ('<span style="color:var(--text3)">🎯 ' + Math.round(val / ov.target * 100) + '% ของเป้า</span>') : '<span style="color:var(--text3)">ช่วงที่เลือก</span>';
    return '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;cursor:pointer" onclick="go(\'kpiCompanyPlan\')">' +
      '<div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.02em">' + meta.lbl + '</div>' +
      '<div style="font-size:21px;font-weight:800;margin:5px 0 6px;font-variant-numeric:tabular-nums">' + soFmt(val, meta) + '</div>' +
      '<div style="display:flex;gap:10px;font-size:10.5px">' + tgtHtml + '</div></div>';
  }).join('');
}

function soRenderPanelsShell() {
  var wrap = document.getElementById('soPanelsFlow');
  var html = '';
  if (soState.panels.indexOf('products') !== -1) html += '<div class="card" style="flex:1 1 340px;margin:0" id="soPanelProducts"></div>';
  if (soState.panels.indexOf('dealers') !== -1) html += '<div class="card" style="flex:1 1 340px;margin:0" id="soPanelDealers"></div>';
  if (soState.panels.indexOf('trend') !== -1) html += '<div class="card" style="flex:1 1 340px;margin:0" id="soPanelTrend"></div>';
  if (soState.panels.indexOf('highlight') !== -1) html += '<div class="card" style="flex:1 1 100%;margin:0" id="soPanelHighlight"></div>';
  if (soState.panels.indexOf('djisis') !== -1) html += '<div class="card" style="flex:1 1 340px;margin:0" id="soPanelDjiSis"></div>';
  if (soState.panels.indexOf('team') !== -1) html += '<div class="card" style="flex:2 1 620px;margin:0" id="soPanelTeam"></div>';
  wrap.innerHTML = html;
}

function soPanelH(icon, title, right) {
  return '<div style="font-size:11.5px;font-weight:800;color:var(--text2);margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px"><span>' + icon + ' ' + title + '</span>' + (right || '') + '</div>';
}
function soMiniSeg(items) {
  return '<span style="display:inline-flex;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:2px">' + items + '</span>';
}
function soMiniBtn(active, onclick, lbl) {
  return '<button onclick="' + onclick + '" style="border:none;background:' + (active ? 'var(--card)' : 'transparent') + ';color:' + (active ? 'var(--accent)' : 'var(--text2)') + ';padding:3px 9px;border-radius:6px;font-size:9.5px;font-weight:700;cursor:pointer">' + lbl + '</button>';
}

function soRenderProducts(ov) {
  var el = document.getElementById('soPanelProducts'); if (!el) return;
  var rows = salesOverviewTopProducts(ov, soState.prodMode, soState.prodCat);
  var maxV = rows.length ? Math.max.apply(null, rows.map(function(r) { return soState.prodMode === 'qty' ? r.qty : r.value; })) : 1;
  var h = soPanelH('📦', 'สินค้าขายดี', soMiniSeg(soMiniBtn(soState.prodMode === 'value', "soSetProdMode('value')", '฿ ยอดขาย') + soMiniBtn(soState.prodMode === 'qty', "soSetProdMode('qty')", '# จำนวน')));
  h += '<div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;margin-bottom:10px">' + SO_CATEGORIES.map(function(c) {
    return '<span onclick="soSetProdCat(\'' + c.k + '\')" style="flex:none;white-space:nowrap;font-size:10px;padding:4px 9px;border-radius:20px;border:1px solid ' + (soState.prodCat === c.k ? 'var(--accent)' : 'var(--border)') + ';background:' + (soState.prodCat === c.k ? 'var(--accent-light,rgba(159,232,112,.15))' : 'var(--card2)') + ';color:' + (soState.prodCat === c.k ? 'var(--accent)' : 'var(--text2)') + ';cursor:pointer;font-weight:600">' + sanitize(c.lbl) + '</span>';
  }).join('') + '</div>';
  if (!rows.length) { h += '<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px 0">ไม่มีข้อมูลในกลุ่มนี้ช่วงนี้</div>'; }
  else {
    h += rows.map(function(r) {
      var pct = Math.round((soState.prodMode === 'qty' ? r.qty : r.value) / maxV * 100);
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;cursor:pointer" onclick="go(\'salesOrders\')"><div style="width:80px;flex:none;font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(r.nm) + '</div>' +
        '<div style="flex:1;height:9px;background:var(--card2);border-radius:99px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:99px"></div></div>' +
        '<div style="width:60px;flex:none;text-align:right;font-size:10.5px;font-weight:700">' + (soState.prodMode === 'qty' ? r.qty + ' เครื่อง' : '฿' + fmtMoneyShort(r.value)) + '</div></div>';
    }).join('');
  }
  el.innerHTML = h;
}
function soSetProdMode(m) { soState.prodMode = m; soRenderProducts(soCurrentOv()); }
function soSetProdCat(c) { soState.prodCat = c; soRenderProducts(soCurrentOv()); }

function soRenderDealers(ov) {
  var el = document.getElementById('soPanelDealers'); if (!el) return;
  var list = salesOverviewTopDealers(ov);
  var shown = soState.dealersExpanded ? list.slice(0, 10) : list.slice(0, 5);
  var title = soState.scope === 'sales' ? '🏪 Dealer ในความดูแล' : '🏆 Dealer ยอดขายสูงสุด';
  var h = soPanelH('', title, '<span style="font-size:9.5px;color:var(--text3);font-weight:400">SIS จริง / Pipeline รอปิด / เสนอราคา</span>');
  if (!shown.length) { h += '<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px 0">ไม่มี Dealer ที่มียอดในช่วงนี้</div>'; }
  else {
    h += shown.map(function(x, i) {
      return '<div style="margin-bottom:11px;cursor:pointer" onclick="go(\'dealerDetail\',{dealerId:\'' + x.id + '\'})"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="font-weight:600">' + (i + 1) + '. ' + sanitize(x.nm) + '</span><span style="color:var(--text3);font-variant-numeric:tabular-nums">฿' + fmtMoneyShort(x.tot) + '</span></div>' +
        '<div style="display:flex;height:10px;border-radius:99px;overflow:hidden;background:var(--card2)"><span style="width:' + x.sis + '%;background:var(--accent)"></span><span style="width:' + x.pipe + '%;background:var(--text3)"></span><span style="width:' + x.quote + '%;background:var(--border)"></span></div></div>';
    }).join('');
    h += '<div style="display:flex;gap:12px;margin-top:6px;font-size:10px;color:var(--text2)"><span>🟩 SIS จริง</span><span>◼ Pipeline รอปิด</span><span>▫ เสนอราคา</span></div>';
    if (list.length > 5) h += '<button class="btn bsm bo" style="width:100%;margin-top:10px" onclick="soToggleDealersExpand()">' + (soState.dealersExpanded ? '▴ ย่อกลับ' : '▾ ดูเพิ่มเติม (สูงสุด ' + Math.min(list.length, 10) + ' บริษัท)') + '</button>';
  }
  el.innerHTML = h;
}
function soToggleDealersExpand() { soState.dealersExpanded = !soState.dealersExpanded; soRenderDealers(soCurrentOv()); }

function soPosClass(pos) { return pos >= 70 ? 'stat-good-t' : pos >= 40 ? 'stat-warn-t' : 'stat-bad-t'; }
function soRenderHighlight(ov) {
  var el = document.getElementById('soPanelHighlight'); if (!el) return;
  var rows = salesOverviewHighlightProjects(ov);
  if (soState.hlSort === 'amt') rows.sort(function(a, b) { return b.amt - a.amt; });
  else rows.sort(function(a, b) { return (a.closeDate || '9999').localeCompare(b.closeDate || '9999') || b.amt - a.amt; });
  var capped = rows.slice(0, 10);
  var shown = soState.hlExpanded ? capped : capped.slice(0, 5);
  var h = soPanelH('🎯', 'โครงการเด่น (Highlight Projects)', soMiniSeg(soMiniBtn(soState.hlSort === 'amt', "soSetHlSort('amt')", '฿ ยอดขาย') + soMiniBtn(soState.hlSort === 'month', "soSetHlSort('month')", '📅 เดือนคาด Bidding')));
  if (!shown.length) { h += '<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px 0">ไม่มีโครงการเปิดอยู่ในขอบเขตนี้</div>'; }
  else {
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px">' + shown.map(function(p, i) {
      return '<div style="display:flex;align-items:center;gap:10px;background:var(--bg2);border-radius:9px;padding:8px 10px;cursor:pointer" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">' +
        '<span style="width:16px;flex:none;font-size:10px;color:var(--text3);font-family:monospace">#' + (i + 1) + '</span>' +
        '<span class="' + soPosClass(p.pos) + '" style="font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:20px;flex:none">POS ' + p.pos + '%</span>' +
        '<div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(p.nm || '(ไม่มีชื่อ)') + '</div><div style="font-size:9.5px;color:var(--text3);margin-top:1px">🏪 ' + sanitize(p.dealer) + (p.closeDate ? ' · 📅 คาดปิด ' + fD(p.closeDate) : '') + '</div></div>' +
        '<span style="width:64px;flex:none;text-align:right;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums">฿' + fmtMoneyShort(p.amt) + '</span></div>';
    }).join('') + '</div>';
    if (capped.length > 5) h += '<button class="btn bsm bo" style="width:100%;margin-top:10px" onclick="soToggleHlExpand()">' + (soState.hlExpanded ? '▴ ย่อกลับ' : '▾ ดูเพิ่มเติม (สูงสุด ' + capped.length + ' โครงการ)') + '</button>';
  }
  el.innerHTML = h;
}
function soSetHlSort(m) { soState.hlSort = m; soRenderHighlight(soCurrentOv()); }
function soToggleHlExpand() { soState.hlExpanded = !soState.hlExpanded; soRenderHighlight(soCurrentOv()); }

function soRenderTrend(ov) {
  var el = document.getElementById('soPanelTrend'); if (!el) return;
  var t = salesOverviewTrend(ov);
  var maxV = Math.max.apply(null, t.cur.concat(t.last).concat([1]));
  var n = t.months.length;
  var pt = function(arr, i) { return (10 + i * (220 / Math.max(1, n - 1))).toFixed(0) + ',' + (95 - (arr[i] / maxV * 80)).toFixed(0); };
  var curPts = t.cur.map(function(v, i) { return pt(t.cur, i); }).join(' ');
  var lastPts = t.last.map(function(v, i) { return pt(t.last, i); }).join(' ');
  var okYoy = t.yoy >= 0;
  var h = soPanelH('📈', 'แนวโน้มยอดขาย', '<span style="font-size:9.5px;color:var(--text3);font-weight:400">SIS รายเดือน</span>');
  h += '<svg viewBox="0 0 240 110" preserveAspectRatio="none" style="width:100%;height:130px">' +
    '<line x1="0" y1="90" x2="240" y2="90" stroke="var(--border)" stroke-width="1"/>' +
    '<polyline points="' + lastPts + '" fill="none" stroke="var(--text3)" stroke-width="2" opacity=".55"/>' +
    '<polyline points="' + curPts + '" fill="none" stroke="var(--accent)" stroke-width="2.5"/></svg>';
  h += '<div style="display:flex;gap:12px;font-size:10px;color:var(--text2);margin-top:8px"><span>─ ปีที่แล้ว</span><span style="color:var(--accent)">─ ปีนี้</span></div>';
  h += '<div style="margin-top:10px"><span class="' + (okYoy ? 'stat-good-t' : 'stat-bad-t') + '" style="font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:20px;background:' + (okYoy ? 'var(--good-bg,rgba(74,222,128,.14))' : 'var(--bad-bg,rgba(248,113,113,.14))') + '">' + (okYoy ? '▲' : '▼') + ' YoY ' + (okYoy ? '+' : '') + t.yoy + '%</span></div>';
  el.innerHTML = h;
}

function soRenderDjiSis(ov) {
  var el = document.getElementById('soPanelDjiSis'); if (!el) return;
  var maxV = Math.max(ov.dji, ov.sis, 1);
  var delta = ov.sis > 0 ? Math.round(Math.abs(ov.dji - ov.sis) / ov.sis * 100) : 0;
  var ok = delta <= 15;
  var h = soPanelH('🎯', 'DJI vs SIS', '<span style="font-size:9.5px;color:var(--text3);font-weight:400">Sell-in / Sell-out</span>');
  h += '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="font-weight:600">DJI (Sell-in)</span><span style="color:var(--text3)">฿' + fmtMoneyShort(ov.dji) + '</span></div><div style="height:10px;background:var(--card2);border-radius:99px;overflow:hidden"><div style="height:100%;width:' + Math.round(ov.dji / maxV * 100) + '%;background:#0891b2;border-radius:99px"></div></div></div>';
  h += '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="font-weight:600">SIS (Sell-out)</span><span style="color:var(--text3)">฿' + fmtMoneyShort(ov.sis) + '</span></div><div style="height:10px;background:var(--card2);border-radius:99px;overflow:hidden"><div style="height:100%;width:' + Math.round(ov.sis / maxV * 100) + '%;background:var(--accent);border-radius:99px"></div></div></div>';
  h += '<div style="margin-top:8px;font-size:10.5px;font-weight:700" class="' + (ok ? 'stat-good-t' : 'stat-warn-t') + '">' + (ok ? '✓ ใกล้เคียงกัน' : '⚠️ ต่างกัน ' + delta + '%') + '</div>';
  el.innerHTML = h;
}

function soRenderTeam(ov) {
  var el = document.getElementById('soPanelTeam'); if (!el) return;
  if (soState.scope === 'dealer') { el.innerHTML = soPanelH('👥', 'Sales Performance') + '<div style="font-size:11px;color:var(--text3);text-align:center;padding:16px 6px">ดูข้อมูลทีมไม่ได้เมื่อเลือกดูเฉพาะ Dealer เดียว — สลับเป็น "ทั้งหมด" หรือ "เฉพาะ Sales" ก่อน</div>'; return; }
  var team = salesOverviewTeamPerf(ov);
  var h = soPanelH('👥', 'Sales Performance', '<span style="font-size:9.5px;color:var(--text3);font-weight:400">สถานะ Dealer เทียบเป้า</span>');
  if (!team.length) { h += '<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px 0">ไม่มีข้อมูลในขอบเขตนี้</div>'; }
  else {
    h += team.map(function(t) {
      var total = t.good + t.warn + t.bad;
      return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:pointer" onclick="go(\'salesRepDashboard\',{saleName:\'' + t.nm.replace(/'/g, "\\'") + '\'})"><span style="width:76px;flex:none;font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(t.nm) + '</span>' +
        '<div style="flex:1;display:flex;height:16px;border-radius:6px;overflow:hidden;background:var(--card2)">' +
        (t.good ? '<span style="width:' + Math.round(t.good / total * 100) + '%;background:var(--good,#16a34a);display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:700">' + t.good + '</span>' : '') +
        (t.warn ? '<span style="width:' + Math.round(t.warn / total * 100) + '%;background:var(--warn,#d97706);display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:700">' + t.warn + '</span>' : '') +
        (t.bad ? '<span style="width:' + Math.round(t.bad / total * 100) + '%;background:var(--bad,#dc2626);display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:700">' + t.bad + '</span>' : '') +
        '</div><span style="width:52px;flex:none;text-align:right;font-size:10.5px;color:var(--text3)">' + total + ' บริษัท</span></div>';
    }).join('');
    h += '<div style="display:flex;gap:12px;margin-top:2px;font-size:10px;color:var(--text2)"><span class="stat-good-t">🟩 ถึงเป้าแล้ว</span><span class="stat-warn-t">🟨 ต้องเร่ง</span><span class="stat-bad-t">🟥 เสี่ยงสูง</span></div>';
  }
  el.innerHTML = h;
}

// ---- config drawer (ใช้ modal มาตรฐานของแอปแทนการทำ slide-over เอง) ----
function soOpenCfg() {
  var h = '<div style="font-size:11px;color:var(--text2);margin-bottom:12px">เลือกได้สูงสุด 4 การ์ดสรุป และเลือกพาเนลที่จะแสดง — บันทึกไว้ในเครื่องนี้ ครั้งหน้าเปิดมาเจอแบบเดิม</div>';
  h += '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;margin-bottom:8px">การ์ดสรุป (<span id="soCfgCount">' + soState.cards.length + '</span>/4)</div>';
  h += Object.keys(SO_CARD_META).map(function(k) {
    var checked = soState.cards.indexOf(k) !== -1;
    return '<label style="display:flex;align-items:center;gap:10px;padding:7px 4px;cursor:pointer"><input type="checkbox" data-so-card="' + k + '" ' + (checked ? 'checked' : '') + ' onchange="soCfgUpdateCount()" style="width:16px;height:16px;accent-color:var(--accent)"><span style="font-size:12px;font-weight:600">' + SO_CARD_META[k].lbl + '</span></label>';
  }).join('');
  h += '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;margin:14px 0 8px">พาเนล (แสดง/ซ่อน)</div>';
  var panelLbl = { products: '📦 สินค้าขายดี', dealers: '🏆 Top Dealer', highlight: '🎯 โครงการเด่น', trend: '📈 แนวโน้มยอดขาย', djisis: '🎯 DJI vs SIS', team: '👥 Sales Performance' };
  h += Object.keys(panelLbl).map(function(k) {
    var checked = soState.panels.indexOf(k) !== -1;
    return '<label style="display:flex;align-items:center;gap:10px;padding:7px 4px;cursor:pointer"><input type="checkbox" data-so-panel="' + k + '" ' + (checked ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:var(--accent)"><span style="font-size:12px;font-weight:600">' + panelLbl[k] + '</span></label>';
  }).join('');
  h += '<button class="btn bp btn-full" style="margin-top:14px" onclick="soApplyCfg()">💾 บันทึกและแสดงผล</button>';
  openM('⚙️ ปรับแต่งการ์ดที่แสดง', h);
}
function soCfgUpdateCount() {
  var boxes = document.querySelectorAll('[data-so-card]');
  var n = 0; boxes.forEach(function(b) { if (b.checked) n++; });
  document.getElementById('soCfgCount').textContent = n;
  boxes.forEach(function(b) { b.disabled = (n >= 4 && !b.checked); });
}
function soApplyCfg() {
  var cards = Array.from(document.querySelectorAll('[data-so-card]:checked')).map(function(b) { return b.dataset.soCard; });
  var panels = Array.from(document.querySelectorAll('[data-so-panel]:checked')).map(function(b) { return b.dataset.soPanel; });
  soSaveConfig({ cards: cards, panels: panels });
  soState.cards = cards; soState.panels = panels;
  closeMForce();
  toast('💾 บันทึกการตั้งค่าแล้ว');
  soRenderAll();
}
