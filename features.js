// ================================================================
// features.js — Presentation Mode | LINE Templates | Smart Notifications
// ================================================================

// ================================================================
// HELPERS
// ================================================================
function ftParseDate(str) {
  if (!str) return null;
  var p = str.split('/');
  if (p.length !== 3) return null;
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
}
function ftDaysBetween(d1, d2) {
  return Math.floor(Math.abs(d2 - d1) / 86400000);
}
function ftFmtVal(v) {
  v = parseFloat(v) || 0;
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return Math.round(v / 1000) + 'K';
  return v.toLocaleString();
}
function ftFmtFull(v) {
  v = parseFloat(v) || 0;
  return v.toLocaleString('th-TH', { minimumFractionDigits: 0 });
}

// ================================================================
// A) PRESENTATION MODE
// ================================================================
var PRES = { slides: [], current: 0 };

function openPresentation() {
  PRES.slides = buildPresSlides();
  PRES.current = 0;
  if (!PRES.slides.length) {
    toast('ไม่มีข้อมูลสำหรับ Presentation', 'warning');
    return;
  }

  var el = document.getElementById('presOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'presOverlay';
    el.className = 'pres-overlay';
    document.body.appendChild(el);
  }

  el.innerHTML =
    '<div class="pres-container">' +
      '<div class="pres-topbar">' +
        '<span class="pres-brand">SIS Distribution — DJI Enterprise</span>' +
        '<span class="pres-close" onclick="closePresentation()">✕ ESC</span>' +
      '</div>' +
      '<div class="pres-slide" id="presSlide"></div>' +
      '<div class="pres-nav">' +
        '<button class="pres-btn" onclick="presNav(-1)">◀ Prev</button>' +
        '<span id="presCounter" class="pres-counter">1 / ' + PRES.slides.length + '</span>' +
        '<button class="pres-btn" onclick="presNav(1)">Next ▶</button>' +
      '</div>' +
      '<div class="pres-progress"><div class="pres-progress-bar" id="presProgress"></div></div>' +
    '</div>';

  el.style.display = 'flex';
  renderPresSlide();
  document.addEventListener('keydown', presKeyHandler);

  try {
    var c = el;
    if (c.requestFullscreen) c.requestFullscreen();
    else if (c.webkitRequestFullscreen) c.webkitRequestFullscreen();
  } catch (e) {}
}

function closePresentation() {
  var el = document.getElementById('presOverlay');
  if (el) el.style.display = 'none';
  document.removeEventListener('keydown', presKeyHandler);
  try {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch (e) {}
}

function presKeyHandler(e) {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); presNav(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); presNav(-1); }
  else if (e.key === 'Escape') closePresentation();
}

function presNav(dir) {
  PRES.current += dir;
  if (PRES.current < 0) PRES.current = 0;
  if (PRES.current >= PRES.slides.length) PRES.current = PRES.slides.length - 1;
  renderPresSlide();
}

function renderPresSlide() {
  var slide = PRES.slides[PRES.current];
  var el = document.getElementById('presSlide');
  if (!el || !slide) return;
  el.classList.add('pres-fade-out');
  setTimeout(function () {
    el.innerHTML = slide.html;
    el.classList.remove('pres-fade-out');
    el.classList.add('pres-fade-in');
    setTimeout(function () { el.classList.remove('pres-fade-in'); }, 400);
  }, 200);
  var counter = document.getElementById('presCounter');
  if (counter) counter.textContent = (PRES.current + 1) + ' / ' + PRES.slides.length;
  var prog = document.getElementById('presProgress');
  if (prog) prog.style.width = ((PRES.current + 1) / PRES.slides.length * 100) + '%';
}

// Touch swipe support
(function () {
  var startX = 0;
  document.addEventListener('touchstart', function (e) {
    var ov = document.getElementById('presOverlay');
    if (ov && ov.style.display === 'flex') startX = e.touches[0].clientX;
  });
  document.addEventListener('touchend', function (e) {
    var ov = document.getElementById('presOverlay');
    if (!ov || ov.style.display !== 'flex') return;
    var diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 60) {
      if (diff < 0) presNav(1);
      else presNav(-1);
    }
  });
})();

// ---- Build Slides ----
function buildPresSlides() {
  var slides = [];
  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var now = new Date();
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  var activePipe = pipeline.filter(function (p) {
    return p.status !== 'lost' && p.status !== 'delivered';
  });
  var winPipe = pipeline.filter(function (p) {
    return p.status === 'win' || p.status === 'ordered' || p.status === 'delivered';
  });
  var lostPipe = pipeline.filter(function (p) { return p.status === 'lost'; });

  var totalActive = 0; activePipe.forEach(function (p) { totalActive += parseFloat(p.value) || 0; });
  var totalWin = 0; winPipe.forEach(function (p) { totalWin += parseFloat(p.value) || 0; });
  var winRate = (winPipe.length + lostPipe.length) > 0
    ? Math.round(winPipe.length / (winPipe.length + lostPipe.length) * 100) : 0;

  var thisM = now.getMonth();
  var thisY = now.getFullYear();
  var monthVisits = visits.filter(function (v) {
    var d = ftParseDate(v.date);
    return d && d.getMonth() === thisM && d.getFullYear() === thisY;
  });

  var stageLabels = {
    prospect: 'Prospect', tor_review: 'TOR Review', quotation: 'Quotation',
    bidding: 'Bidding', negotiation: 'Negotiation', win: 'Win',
    ordered: 'Ordered', on_hold: 'On Hold', recurring: 'Recurring'
  };
  var stageColors = {
    prospect: '#64b5f6', tor_review: '#ba68c8', quotation: '#ffb74d',
    bidding: '#ff8a65', negotiation: '#4dd0e1', win: '#81c784',
    ordered: '#4caf50', on_hold: '#90a4ae', recurring: '#7986cb'
  };

  // ---- SLIDE 1: TITLE ----
  slides.push({
    html:
      '<div class="ps-title">' +
        '<div class="ps-title-icon">🚁</div>' +
        '<h1>DJI Enterprise</h1>' +
        '<h2>Business Review</h2>' +
        '<div class="ps-title-date">' + months[thisM] + ' ' + thisY + '</div>' +
        '<div class="ps-title-author">Siwawong — Sales Executive<br>SIS Distribution (Thailand) PLC</div>' +
      '</div>'
  });

  // ---- SLIDE 2: KPI OVERVIEW ----
  slides.push({
    html:
      '<div class="ps-content">' +
        '<h2 class="ps-heading">📊 KPI Overview</h2>' +
        '<div class="ps-kpi-grid">' +
          presKpiCard('🏪', dealers.length, 'Authorized Dealers') +
          presKpiCard('📋', activePipe.length, 'Active Deals') +
          presKpiCard('💰', ftFmtVal(totalActive), 'Pipeline Value (฿)') +
          presKpiCard('🏆', winRate + '%', 'Win Rate') +
          presKpiCard('✅', winPipe.length, 'Deals Won') +
          presKpiCard('💵', ftFmtVal(totalWin), 'Revenue Won (฿)') +
          presKpiCard('📍', monthVisits.length, 'Visits This Month') +
          presKpiCard('🎯', activePipe.filter(function (p) { return p.status === 'bidding'; }).length, 'Active Bidding') +
        '</div>' +
      '</div>'
  });

  // ---- SLIDE 3: PIPELINE BY STAGE ----
  var stageCounts = {};
  var maxStageVal = 1;
  activePipe.forEach(function (p) {
    var s = p.status || 'prospect';
    if (!stageCounts[s]) stageCounts[s] = { count: 0, value: 0 };
    stageCounts[s].count++;
    stageCounts[s].value += parseFloat(p.value) || 0;
  });
  Object.keys(stageCounts).forEach(function (k) {
    if (stageCounts[k].value > maxStageVal) maxStageVal = stageCounts[k].value;
  });

  var barHTML = '';
  Object.keys(stageLabels).forEach(function (k) {
    if (!stageCounts[k]) return;
    var pct = Math.max(8, Math.round(stageCounts[k].value / maxStageVal * 100));
    var color = stageColors[k] || '#64b5f6';
    barHTML +=
      '<div class="ps-bar-row">' +
        '<div class="ps-bar-label">' + stageLabels[k] + ' <span class="ps-bar-count">(' + stageCounts[k].count + ')</span></div>' +
        '<div class="ps-bar-track">' +
          '<div class="ps-bar-fill" style="width:' + pct + '%;background:' + color + '">' +
            '฿' + ftFmtVal(stageCounts[k].value) +
          '</div>' +
        '</div>' +
      '</div>';
  });

  slides.push({
    html:
      '<div class="ps-content">' +
        '<h2 class="ps-heading">📈 Pipeline by Stage</h2>' +
        barHTML +
      '</div>'
  });

  // ---- SLIDE 4: TOP DEALS ----
  var topDeals = activePipe.slice().sort(function (a, b) {
    return (parseFloat(b.value) || 0) - (parseFloat(a.value) || 0);
  }).slice(0, 7);

  var topHTML = '<table class="ps-table"><thead><tr><th>#</th><th>Project</th><th>Dealer</th><th>Stage</th><th>Value (฿)</th></tr></thead><tbody>';
  topDeals.forEach(function (p, i) {
    var dn = '-';
    dealers.forEach(function (d) { if (d.id === p.dealerId) dn = d.name; });
    topHTML += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + sanitize(p.project || p.name || '-') + '</td>' +
      '<td>' + sanitize(dn) + '</td>' +
      '<td><span class="ps-stage" style="background:' + (stageColors[p.status] || '#888') + '">' + (stageLabels[p.status] || p.status) + '</span></td>' +
      '<td class="ps-val">฿' + ftFmtFull(p.value) + '</td>' +
    '</tr>';
  });
  topHTML += '</tbody></table>';

  slides.push({
    html:
      '<div class="ps-content">' +
        '<h2 class="ps-heading">🏆 Top Deals</h2>' +
        topHTML +
      '</div>'
  });

  // ---- SLIDE 5: DEALER RANKING ----
  var dealerStats = [];
  dealers.forEach(function (d) {
    var dPipe = pipeline.filter(function (p) { return p.dealerId === d.id && p.status !== 'lost'; });
    var dVal = 0;
    dPipe.forEach(function (p) { dVal += parseFloat(p.value) || 0; });
    var dVisits = visits.filter(function (v) { return v.dealerId === d.id; });
    var dWin = pipeline.filter(function (p) {
      return p.dealerId === d.id && (p.status === 'win' || p.status === 'ordered' || p.status === 'delivered');
    });
    var dWinVal = 0;
    dWin.forEach(function (p) { dWinVal += parseFloat(p.value) || 0; });
    dealerStats.push({
      name: d.name || '-',
      level: d.level || '-',
      deals: dPipe.length,
      value: dVal,
      winVal: dWinVal,
      visits: dVisits.length
    });
  });
  dealerStats.sort(function (a, b) { return b.value - a.value; });

  var dlrHTML = '<table class="ps-table"><thead><tr><th>#</th><th>Dealer</th><th>Level</th><th>Deals</th><th>Pipeline (฿)</th><th>Won (฿)</th><th>Visits</th></tr></thead><tbody>';
  dealerStats.slice(0, 10).forEach(function (d, i) {
    dlrHTML += '<tr><td>' + (i + 1) + '</td><td>' + sanitize(d.name) + '</td><td>' + d.level + '</td><td>' + d.deals + '</td><td class="ps-val">฿' + ftFmtVal(d.value) + '</td><td class="ps-val">฿' + ftFmtVal(d.winVal) + '</td><td>' + d.visits + '</td></tr>';
  });
  dlrHTML += '</tbody></table>';

  slides.push({
    html:
      '<div class="ps-content">' +
        '<h2 class="ps-heading">🏪 Dealer Ranking</h2>' +
        dlrHTML +
      '</div>'
  });

  // ---- SLIDE 6: MONTHLY ACTIVITY ----
  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  var weekVisits = visits.filter(function (v) {
    var d = ftParseDate(v.date);
    return d && d >= weekStart;
  });

  var uniqueDealersVisited = {};
  monthVisits.forEach(function (v) { if (v.dealerId) uniqueDealersVisited[v.dealerId] = true; });

  slides.push({
    html:
      '<div class="ps-content">' +
        '<h2 class="ps-heading">📅 Activity Summary</h2>' +
        '<div class="ps-kpi-grid">' +
          presKpiCard('📍', monthVisits.length, 'Visits This Month') +
          presKpiCard('📍', weekVisits.length, 'Visits This Week') +
          presKpiCard('🏪', Object.keys(uniqueDealersVisited).length, 'Unique Dealers Visited') +
          presKpiCard('📋', pipeline.filter(function (p) {
            var d = ftParseDate(p.date || p.createdAt);
            return d && d.getMonth() === thisM && d.getFullYear() === thisY;
          }).length, 'New Deals This Month') +
        '</div>' +
        '<div class="ps-activity-note">' +
          '<h3>📌 Coverage</h3>' +
          '<p>Visited <strong>' + Object.keys(uniqueDealersVisited).length + '</strong> out of <strong>' + dealers.length + '</strong> dealers this month (' + (dealers.length > 0 ? Math.round(Object.keys(uniqueDealersVisited).length / dealers.length * 100) : 0) + '% coverage)</p>' +
        '</div>' +
      '</div>'
  });

  // ---- SLIDE 7: ACTION ITEMS ----
  var actions = getSmartNotifications();
  var actHTML = '';
  if (actions.length === 0) {
    actHTML = '<div class="ps-action-item ps-action-ok"><span class="ps-action-icon">✅</span><span>All clear — no urgent actions!</span></div>';
  } else {
    actions.slice(0, 8).forEach(function (a) {
      var cls = a.priority === 1 ? 'ps-action-urgent' : 'ps-action-normal';
      actHTML += '<div class="ps-action-item ' + cls + '"><span class="ps-action-icon">' + a.icon + '</span><span>' + a.text + '</span></div>';
    });
  }

  slides.push({
    html:
      '<div class="ps-content">' +
        '<h2 class="ps-heading">🎯 Action Items & Priorities</h2>' +
        actHTML +
      '</div>'
  });

  // ---- SLIDE 8: THANK YOU ----
  slides.push({
    html:
      '<div class="ps-title">' +
        '<div class="ps-title-icon">🙏</div>' +
        '<h1>Thank You</h1>' +
        '<h2>Questions & Discussion</h2>' +
        '<div class="ps-title-author">Siwawong — SIS Distribution (Thailand) PLC<br>DJI Authorized Distributor</div>' +
      '</div>'
  });

  return slides;
}

function presKpiCard(icon, value, label) {
  return '<div class="ps-kpi-card"><div class="ps-kpi-icon">' + icon + '</div><div class="ps-kpi-val">' + value + '</div><div class="ps-kpi-label">' + label + '</div></div>';
}

function sanitize(s) {
  if (!s) return '';
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// ================================================================
// B) LINE MESSAGE TEMPLATES
// ================================================================
// ================================================================
// LINE TEMPLATES — Customizable (stored in localStorage)
// ================================================================
var LINE_TEMPLATES_DEFAULT = [
  { id: 'followup_visit', name: 'Follow-up หลัง Visit', icon: '🤝',
    msg: 'สวัสดีครับ {contact}\n\nขอบคุณที่ให้เวลาพบกันวันนี้ครับ ตามที่คุยกัน ผมจะดำเนินการและอัพเดทให้ทราบครับ\n\nSiwawong\nSIS Distribution — DJI Enterprise' },
  { id: 'followup_quote', name: 'Follow-up ใบเสนอราคา', icon: '💰',
    msg: 'สวัสดีครับ {contact}\n\nFollow-up เรื่องใบเสนอราคา {project} ที่ส่งไปครับ ไม่ทราบมีข้อสงสัยหรือต้องการข้อมูลเพิ่มเติมไหมครับ?\n\nSiwawong\nSIS Distribution' },
  { id: 'followup_bidding', name: 'อัพเดท Bidding', icon: '📊',
    msg: 'สวัสดีครับ {contact}\n\nอัพเดทความคืบหน้าเรื่อง {project} ครับ\n\n- สถานะ: ...\n- Next Step: ...\n\nหากต้องการข้อมูลเพิ่มเติมแจ้งได้เลยครับ\n\nSiwawong\nSIS Distribution' },
  { id: 'meeting_req', name: 'นัด Meeting', icon: '📅',
    msg: 'สวัสดีครับ {contact}\n\nอยากขอนัดเข้าพบเพื่ออัพเดทเรื่อง DJI ครับ ไม่ทราบว่าสะดวกวัน-เวลาไหนบ้างครับ?\n\nSiwawong\nSIS Distribution' },
  { id: 'thank_order', name: 'ขอบคุณ Order', icon: '🎉',
    msg: 'สวัสดีครับ {contact}\n\nขอบคุณสำหรับ Order {project} มากครับ! 🙏 ผมจะติดตามให้ส่งมอบตามกำหนดนะครับ\n\nSiwawong\nSIS Distribution' },
  { id: 'product_info', name: 'ส่งข้อมูลสินค้า', icon: '🚁',
    msg: 'สวัสดีครับ {contact}\n\nส่งข้อมูล {product} ให้ตามที่ขอครับ\n\n• Model: {product}\n• จุดเด่น: ...\n• ราคา: ...\n\nสนใจสอบถามเพิ่มได้เลยครับ\n\nSiwawong\nSIS Distribution' },
  { id: 'checkin', name: 'ทักทาย / เช็คอิน', icon: '👋',
    msg: 'สวัสดีครับ {contact}\n\nSiwawong จาก SIS ครับ 😊 สอบถามว่ามีอะไรให้ช่วยเหลือเรื่อง DJI ไหมครับ? มีสินค้าใหม่/โปรโมชั่นอัพเดทได้ครับ\n\nSiwawong\nSIS Distribution' },
  { id: 'reminder', name: 'Reminder นัดหมาย', icon: '⏰',
    msg: 'สวัสดีครับ {contact}\n\nแจ้งเตือนนัดหมายวันที่ ... เวลา ... น. ครับ\n\nรายละเอียด: ...\n\nยืนยันนัดหมายด้วยนะครับ 🙏\n\nSiwawong\nSIS Distribution' }
];

function getLineTemplates() {
  var saved = localStorage.getItem('v7_lineTmpl');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return LINE_TEMPLATES_DEFAULT.slice();
}

function saveLineTemplates(list) {
  localStorage.setItem('v7_lineTmpl', JSON.stringify(list));
}

function resetLineTemplates() {
  if (confirm('⚠️ Reset เป็น Template เริ่มต้น?')) {
    localStorage.removeItem('v7_lineTmpl');
    toast('Reset Template แล้ว', 'success');
    openLineTemplates();
  }
}

function openLineTemplates(dealerId) {
  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  var templates = getLineTemplates();
  var dealer = null;
  if (dealerId) {
    for (var i = 0; i < dealers.length; i++) {
      if (dealers[i].id === dealerId) { dealer = dealers[i]; break; }
    }
  }

  var h = '<div class="line-wrap">';

  // Dealer selector
  if (!dealer) {
    h += '<div class="fm-group"><label>🏪 Dealer</label><select id="lineDealerSel" onchange="lineUpdateDealer()" class="fm-input">';
    h += '<option value="">-- เลือก Dealer --</option>';
    dealers.forEach(function (d) {
      h += '<option value="' + d.id + '">' + sanitize(d.name || '') + '</option>';
    });
    h += '</select></div>';
  } else {
    h += '<div class="fm-group"><label>🏪 Dealer</label>';
    h += '<div style="padding:8px;background:var(--card);border-radius:8px;font-weight:600">' + sanitize(dealer.name) + '</div>';
    h += '<input type="hidden" id="lineDealerSel" value="' + dealer.id + '"></div>';
  }

  // Pipeline selector
  h += '<div class="fm-group"><label>📋 Project (ถ้ามี)</label><select id="linePipeSel" class="fm-input">';
  h += '<option value="">-- ไม่ระบุ --</option>';
  if (dealer) {
    pipeline.forEach(function (p) {
      if (p.dealerId === dealer.id && p.status !== 'lost' && p.status !== 'delivered') {
        h += '<option value="' + p.id + '">' + sanitize(p.project || p.name || '-') + '</option>';
      }
    });
  }
  h += '</select></div>';

  // Template header with manage button
  h += '<div class="fm-group" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h += '<label style="margin:0">💬 เลือก Template</label>';
  h += '<div style="display:flex;gap:6px">';
  h += '<button class="btn-sm" onclick="openLineTmplManager()" title="จัดการ Template">⚙️ จัดการ</button>';
  h += '</div></div>';

  // Template grid
  h += '<div class="line-grid">';
  templates.forEach(function (t, idx) {
    h += '<div class="line-card" onclick="selectLineTmpl(' + idx + ', this)">' +
      '<div class="line-card-icon">' + (t.icon || '📝') + '</div>' +
      '<div class="line-card-name">' + sanitize(t.name || 'Template') + '</div>' +
    '</div>';
  });
  // Always add "เขียนเอง" at the end
  h += '<div class="line-card" onclick="selectLineTmplCustom(this)">' +
    '<div class="line-card-icon">✏️</div>' +
    '<div class="line-card-name">เขียนเอง</div>' +
  '</div>';
  h += '</div>';

  // Message preview
  h += '<div class="fm-group"><label>📝 ข้อความ (แก้ไขได้)</label>';
  h += '<textarea id="lineMsg" rows="7" class="fm-input" placeholder="เลือก Template ด้านบน หรือพิมพ์เอง..."></textarea></div>';

  // Placeholders hint
  h += '<div style="font-size:11px;color:var(--text2);margin:-8px 0 12px;padding:0 4px">';
  h += '💡 ตัวแปร: <code>{contact}</code> ชื่อผู้ติดต่อ, <code>{dealer}</code> ชื่อร้าน, <code>{project}</code> ชื่อโปรเจค, <code>{product}</code> รุ่นสินค้า';
  h += '</div>';

  // Actions
  h += '<div class="fm-actions" style="gap:8px;display:flex;flex-wrap:wrap">';
  h += '<button class="btn btn-green" onclick="sendLineMsg()" style="flex:1;min-width:120px">📱 เปิด LINE</button>';
  h += '<button class="btn btn-blue" onclick="copyLineMsg()" style="flex:1;min-width:120px">📋 Copy ข้อความ</button>';
  h += '</div>';

  h += '</div>';

  openM('💬 LINE Message', h);
}

function selectLineTmpl(idx, el) {
  var templates = getLineTemplates();
  var tmpl = templates[idx];
  if (!tmpl) return;

  // Highlight
  var cards = document.querySelectorAll('.line-card');
  for (var j = 0; j < cards.length; j++) cards[j].classList.remove('selected');
  if (el) el.classList.add('selected');

  var msg = tmpl.msg || '';

  // Get dealer info
  var dId = document.getElementById('lineDealerSel') ? document.getElementById('lineDealerSel').value : '';
  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
  var dealer = null;
  for (var k = 0; k < dealers.length; k++) {
    if (dealers[k].id === dId) { dealer = dealers[k]; break; }
  }

  // Get pipeline info
  var pId = document.getElementById('linePipeSel') ? document.getElementById('linePipeSel').value : '';
  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  var pipe = null;
  for (var m = 0; m < pipeline.length; m++) {
    if (pipeline[m].id === pId) { pipe = pipeline[m]; break; }
  }

  // Replace placeholders
  var contactName = dealer ? (dealer.contactName || dealer.contact || dealer.name || '...') : '...';
  msg = msg.replace(/\{contact\}/g, contactName);
  msg = msg.replace(/\{dealer\}/g, dealer ? (dealer.name || '...') : '...');
  msg = msg.replace(/\{project\}/g, pipe ? (pipe.project || pipe.name || '...') : '...');
  msg = msg.replace(/\{product\}/g, pipe ? (pipe.model || '...') : '...');

  document.getElementById('lineMsg').value = msg;
}

function selectLineTmplCustom(el) {
  var cards = document.querySelectorAll('.line-card');
  for (var j = 0; j < cards.length; j++) cards[j].classList.remove('selected');
  if (el) el.classList.add('selected');
  document.getElementById('lineMsg').value = '';
  document.getElementById('lineMsg').focus();
}

function lineUpdateDealer() {
  var dId = document.getElementById('lineDealerSel').value;
  var sel = document.getElementById('linePipeSel');
  if (!sel) return;
  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>';
  pipeline.forEach(function (p) {
    if (p.dealerId === dId && p.status !== 'lost' && p.status !== 'delivered') {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.project || p.name || '-';
      sel.appendChild(opt);
    }
  });
}

function sendLineMsg() {
  var msg = (document.getElementById('lineMsg').value || '').trim();
  if (!msg) { toast('กรุณาเลือก Template หรือพิมพ์ข้อความ', 'warning'); return; }
  var encoded = encodeURIComponent(msg);
  window.open('https://line.me/R/share?text=' + encoded, '_blank');
  toast('เปิด LINE แล้ว!', 'success');
}

function copyLineMsg() {
  var msg = (document.getElementById('lineMsg').value || '').trim();
  if (!msg) { toast('ไม่มีข้อความ', 'warning'); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(function () {
      toast('📋 Copy แล้ว! วางใน LINE ได้เลย', 'success');
    });
  } else {
    var ta = document.createElement('textarea');
    ta.value = msg;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('📋 Copy แล้ว!', 'success');
  }
}

// ================================================================
// LINE TEMPLATE MANAGER
// ================================================================
function openLineTmplManager() {
  var templates = getLineTemplates();

  var h = '<div style="max-width:500px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
  h += '<span style="font-size:13px;color:var(--text2)">' + templates.length + ' templates</span>';
  h += '<div style="display:flex;gap:6px">';
  h += '<button class="btn-sm btn-blue" onclick="addLineTmpl()">➕ เพิ่ม</button>';
  h += '<button class="btn-sm" onclick="resetLineTemplates()">🔄 Reset</button>';
  h += '</div></div>';

  if (templates.length === 0) {
    h += '<div style="text-align:center;padding:24px;color:var(--text2)">ยังไม่มี Template — กด ➕ เพิ่ม หรือ 🔄 Reset</div>';
  } else {
    h += '<div class="ltm-list">';
    templates.forEach(function (t, i) {
      h += '<div class="ltm-item">';
      h += '<div class="ltm-left">';
      h += '<span class="ltm-icon">' + (t.icon || '📝') + '</span>';
      h += '<div>';
      h += '<div class="ltm-name">' + sanitize(t.name || 'Template') + '</div>';
      h += '<div class="ltm-preview">' + sanitize((t.msg || '').substring(0, 60)) + '...</div>';
      h += '</div></div>';
      h += '<div class="ltm-actions">';
      h += '<button class="btn-xs" onclick="editLineTmpl(' + i + ')" title="แก้ไข">✏️</button>';
      h += '<button class="btn-xs" onclick="moveLineTmpl(' + i + ',-1)" title="ขึ้น">⬆️</button>';
      h += '<button class="btn-xs" onclick="moveLineTmpl(' + i + ',1)" title="ลง">⬇️</button>';
      h += '<button class="btn-xs btn-red" onclick="delLineTmpl(' + i + ')" title="ลบ">🗑️</button>';
      h += '</div></div>';
    });
    h += '</div>';
  }

  h += '</div>';
  openM('⚙️ จัดการ LINE Template', h);
}

function addLineTmpl() {
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>😊 Icon (Emoji)</label>';
  h += '<input type="text" id="ltIcon" class="fm-input" value="📝" maxlength="4" style="width:80px;font-size:24px;text-align:center"></div>';
  h += '<div class="fm-group"><label>📌 ชื่อ Template</label>';
  h += '<input type="text" id="ltName" class="fm-input" placeholder="เช่น Follow-up หลังส่งใบเสนอราคา"></div>';
  h += '<div class="fm-group"><label>📝 ข้อความ</label>';
  h += '<textarea id="ltMsg" rows="8" class="fm-input" placeholder="พิมพ์ข้อความ..."></textarea></div>';
  h += '<div style="font-size:11px;color:var(--text2);margin:-8px 0 12px">';
  h += '💡 ตัวแปร: <code>{contact}</code> <code>{dealer}</code> <code>{project}</code> <code>{product}</code></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveNewLineTmpl()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="openLineTmplManager()">↩️ กลับ</button>';
  h += '</div></div>';
  openM('➕ เพิ่ม LINE Template', h);
}

function saveNewLineTmpl() {
  var icon = (document.getElementById('ltIcon').value || '📝').trim();
  var name = (document.getElementById('ltName').value || '').trim();
  var msg = (document.getElementById('ltMsg').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ Template', 'warning'); return; }
  if (!msg) { toast('กรุณาใส่ข้อความ', 'warning'); return; }

  var templates = getLineTemplates();
  templates.push({
    id: 'custom_' + Date.now(),
    name: name,
    icon: icon,
    msg: msg
  });
  saveLineTemplates(templates);
  toast('✅ เพิ่ม Template แล้ว', 'success');
  openLineTmplManager();
}

function editLineTmpl(idx) {
  var templates = getLineTemplates();
  var t = templates[idx];
  if (!t) return;

  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>😊 Icon (Emoji)</label>';
  h += '<input type="text" id="ltIcon" class="fm-input" value="' + sanitize(t.icon || '📝') + '" maxlength="4" style="width:80px;font-size:24px;text-align:center"></div>';
  h += '<div class="fm-group"><label>📌 ชื่อ Template</label>';
  h += '<input type="text" id="ltName" class="fm-input" value="' + sanitize(t.name || '') + '"></div>';
  h += '<div class="fm-group"><label>📝 ข้อความ</label>';
  h += '<textarea id="ltMsg" rows="8" class="fm-input">' + sanitize(t.msg || '') + '</textarea></div>';
  h += '<div style="font-size:11px;color:var(--text2);margin:-8px 0 12px">';
  h += '💡 ตัวแปร: <code>{contact}</code> <code>{dealer}</code> <code>{project}</code> <code>{product}</code></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveEditLineTmpl(' + idx + ')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="openLineTmplManager()">↩️ กลับ</button>';
  h += '</div></div>';
  openM('✏️ แก้ไข Template', h);
}

function saveEditLineTmpl(idx) {
  var icon = (document.getElementById('ltIcon').value || '📝').trim();
  var name = (document.getElementById('ltName').value || '').trim();
  var msg = (document.getElementById('ltMsg').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ Template', 'warning'); return; }
  if (!msg) { toast('กรุณาใส่ข้อความ', 'warning'); return; }

  var templates = getLineTemplates();
  templates[idx].icon = icon;
  templates[idx].name = name;
  templates[idx].msg = msg;
  saveLineTemplates(templates);
  toast('✅ บันทึกแล้ว', 'success');
  openLineTmplManager();
}

function delLineTmpl(idx) {
  var templates = getLineTemplates();
  var name = templates[idx] ? templates[idx].name : '';
  if (!confirm('ลบ "' + name + '"?')) return;
  templates.splice(idx, 1);
  saveLineTemplates(templates);
  toast('🗑️ ลบแล้ว', 'success');
  openLineTmplManager();
}

function moveLineTmpl(idx, dir) {
  var templates = getLineTemplates();
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= templates.length) return;
  var tmp = templates[idx];
  templates[idx] = templates[newIdx];
  templates[newIdx] = tmp;
  saveLineTemplates(templates);
  openLineTmplManager();
}

// ================================================================
// C) SMART NOTIFICATIONS
// ================================================================
function getSmartNotifications() {
  var notifs = [];
  var now = new Date();
  var today = now.getDay(); // 0=Sun
  var dayOfMonth = now.getDate();
  var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  var daysLeft = daysInMonth - dayOfMonth;

  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var followups = JSON.parse(localStorage.getItem('v7_followups') || '[]');
  var notes = JSON.parse(localStorage.getItem('v7_notes') || '[]');

  // ---- 1. Day-of-week ----
  if (today === 1) {
    notifs.push({ icon: '📋', type: 'routine', priority: 2,
      text: 'วันจันทร์ — ทำ Weekly Plan & เช็ค Pipeline ทั้งหมด' });
  }
  if (today === 5) {
    notifs.push({ icon: '📊', type: 'routine', priority: 2,
      text: 'วันศุกร์ — สรุป Weekly Report & วางแผนสัปดาห์หน้า' });
  }

  // ---- 2. End of month ----
  if (daysLeft <= 5 && daysLeft > 0) {
    var targetRev = 0; var achievedRev = 0;
    dealers.forEach(function (d) {
      targetRev += parseFloat(d.targetRevenue) || 0;
      achievedRev += parseFloat(d.achievement) || 0;
    });
    var gap = targetRev - achievedRev;
    if (gap > 0) {
      notifs.push({ icon: '⚠️', type: 'target', priority: 1,
        text: 'เหลืออีก ' + daysLeft + ' วันสิ้นเดือน — Target gap: ฿' + ftFmtVal(gap) });
    }
  }
  if (daysLeft === 0) {
    notifs.push({ icon: '🔴', type: 'target', priority: 1,
      text: 'วันสุดท้ายของเดือน! เช็ค Target & ปิด Deal ด่วน!' });
  }

  // ---- 3. Overdue follow-ups ----
  var overdueCount = 0;
  followups.forEach(function (f) {
    if (f.status === 'done') return;
    var d = ftParseDate(f.dueDate || f.date);
    if (d && d < now) overdueCount++;
  });
  if (overdueCount > 0) {
    notifs.push({ icon: '📞', type: 'followup', priority: 1,
      text: 'Follow-up เกินกำหนด ' + overdueCount + ' รายการ — ควรติดต่อวันนี้!' });
  }

  // ---- 4. Pipeline aging > 14 days ----
  var agingDeals = [];
  pipeline.forEach(function (p) {
    if (p.status === 'lost' || p.status === 'delivered') return;
    var lu = ftParseDate(p.lastUpdate || p.updatedAt || p.date);
    if (lu && ftDaysBetween(lu, now) > 14) {
      agingDeals.push(p.project || p.name || 'Unknown');
    }
  });
  if (agingDeals.length > 0) {
    notifs.push({ icon: '⏰', type: 'aging', priority: 1,
      text: agingDeals.length + ' Deal ไม่ update เกิน 14 วัน: ' + agingDeals.slice(0, 3).join(', ') + (agingDeals.length > 3 ? '...' : '') });
  }

  // ---- 5. Bidding deadline < 7 days ----
  var urgentBids = [];
  pipeline.forEach(function (p) {
    if (p.status !== 'bidding') return;
    var dl = ftParseDate(p.biddingDate || p.deadline);
    if (dl) {
      var dLeft = Math.ceil((dl - now) / 86400000);
      if (dLeft >= 0 && dLeft <= 7) {
        urgentBids.push((p.project || p.name || '') + ' (' + dLeft + ' วัน)');
      }
    }
  });
  if (urgentBids.length > 0) {
    notifs.push({ icon: '🏷️', type: 'bidding', priority: 1,
      text: 'Bidding ใกล้ Deadline: ' + urgentBids.join(', ') });
  }

  // ---- 6. Dealers not visited 30+ days ----
  var neglected = [];
  dealers.forEach(function (d) {
    var dVisits = visits.filter(function (v) { return v.dealerId === d.id; });
    if (dVisits.length === 0) { neglected.push(d.name); return; }
    var latest = null;
    dVisits.forEach(function (v) {
      var vd = ftParseDate(v.date);
      if (vd && (!latest || vd > latest)) latest = vd;
    });
    if (latest && ftDaysBetween(latest, now) > 30) neglected.push(d.name);
  });
  if (neglected.length > 0) {
    notifs.push({ icon: '🏪', type: 'visit', priority: 2,
      text: 'ไม่ได้ Visit ' + neglected.length + ' ร้าน เกิน 30 วัน: ' + neglected.slice(0, 3).join(', ') + (neglected.length > 3 ? '...' : '') });
  }

  // ---- 7. Notes expiring / reminding ----
  notes.forEach(function (n) {
    if (n.status !== 'active') return;
    var exp = ftParseDate(n.expireDate);
    if (exp) {
      var dL = Math.ceil((exp - now) / 86400000);
      if (dL >= 0 && dL <= 3) {
        notifs.push({ icon: '📝', type: 'note', priority: 2,
          text: 'Note "' + (n.title || '').substring(0, 30) + '" หมดอายุใน ' + dL + ' วัน' });
      }
    }
    var rem = ftParseDate(n.remindDate);
    if (rem) {
      var rL = Math.ceil((rem - now) / 86400000);
      if (rL >= 0 && rL <= 1) {
        notifs.push({ icon: '🔔', type: 'remind', priority: 1,
          text: 'Reminder: ' + (n.title || '').substring(0, 40) });
      }
    }
  });

  // ---- 8. Pipeline follow-up due ----
  pipeline.forEach(function (p) {
    if (p.status === 'lost' || p.status === 'delivered') return;
    var fu = ftParseDate(p.followupDate || p.nextFollowup);
    if (!fu) return;
    var dL = Math.ceil((fu - now) / 86400000);
    if (dL === 0) {
      notifs.push({ icon: '🎯', type: 'pipeline', priority: 1,
        text: 'วันนี้ต้อง Follow-up: ' + (p.project || p.name || '') });
    } else if (dL === 1) {
      notifs.push({ icon: '📌', type: 'pipeline', priority: 2,
        text: 'พรุ่งนี้ Follow-up: ' + (p.project || p.name || '') });
    } else if (dL < 0 && dL >= -3) {
      notifs.push({ icon: '🔴', type: 'pipeline', priority: 1,
        text: 'เลยกำหนด Follow-up ' + Math.abs(dL) + ' วัน: ' + (p.project || p.name || '') });
    }
  });

  // ---- 9. High value deal without next action ----
  pipeline.forEach(function (p) {
    if (p.status === 'lost' || p.status === 'delivered') return;
    var val = parseFloat(p.value) || 0;
    if (val >= 1000000 && !p.nextAction) {
      notifs.push({ icon: '💎', type: 'pipeline', priority: 2,
        text: 'Deal มูลค่าสูง "' + (p.project || p.name || '') + '" (฿' + ftFmtVal(val) + ') ยังไม่มี Next Action' });
    }
  });

  // ---- 10. No visit this week (Wed+) ----
  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  var weekVisits = visits.filter(function (v) {
    var d = ftParseDate(v.date);
    return d && d >= weekStart;
  });
  if (weekVisits.length === 0 && today >= 3) {
    notifs.push({ icon: '🚗', type: 'visit', priority: 2,
      text: 'สัปดาห์นี้ยังไม่ได้ Visit — ควรนัดอย่างน้อย 1 ราย' });
  }

  // ---- 11. First day of month ----
  if (dayOfMonth === 1) {
    notifs.push({ icon: '📆', type: 'routine', priority: 2,
      text: 'เดือนใหม่! ตั้ง Target & วางแผน Monthly Visit' });
  }

  // ---- Pipeline Action Items ----
  var paNotifs = getPipeActionNotifications();
  for (var pn = 0; pn < paNotifs.length; pn++) {
    notifs.push(paNotifs[pn]);
  }

  // Sort: priority 1 first
  notifs.sort(function (a, b) { return a.priority - b.priority; });
  return notifs;
}

function renderSmartNotifPanel() {
  var notifs = getSmartNotifications();
  if (!notifs.length) return '<div class="sn-panel sn-empty"><span>✅</span> ไม่มีเรื่องเร่งด่วน — เยี่ยม!</div>';

  var urgent = notifs.filter(function (n) { return n.priority === 1; });
  var normal = notifs.filter(function (n) { return n.priority === 2; });

  var h = '<div class="sn-panel">';
  h += '<div class="sn-header" onclick="toggleSNPanel()">';
  h += '<span>🔔 Smart Notifications</span>';
  if (urgent.length > 0) h += '<span class="sn-badge sn-badge-red">' + urgent.length + ' ด่วน</span>';
  h += '<span class="sn-badge">' + notifs.length + ' ทั้งหมด</span>';
  h += '<span class="sn-toggle" id="snToggle">▼</span>';
  h += '</div>';

  h += '<div class="sn-list" id="snList">';

  if (urgent.length > 0) {
    h += '<div class="sn-section-title">🔴 ด่วน</div>';
    urgent.forEach(function (n) {
      h += '<div class="sn-item sn-urgent"><span class="sn-icon">' + n.icon + '</span><span class="sn-text">' + n.text + '</span></div>';
    });
  }

  if (normal.length > 0) {
    h += '<div class="sn-section-title">📌 ควรดำเนินการ</div>';
    normal.forEach(function (n) {
      h += '<div class="sn-item sn-normal"><span class="sn-icon">' + n.icon + '</span><span class="sn-text">' + n.text + '</span></div>';
    });
  }

  h += '</div></div>';
  return h;
}

function toggleSNPanel() {
  var el = document.getElementById('snList');
  var tog = document.getElementById('snToggle');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (tog) tog.textContent = '▼';
  } else {
    el.style.display = 'none';
    if (tog) tog.textContent = '▶';
  }
}

function updateNotifBadge() {
  var notifs = getSmartNotifications();
  var urgent = notifs.filter(function (n) { return n.priority === 1; });
  var badge = document.getElementById('notifBadge');
  if (badge) {
    if (urgent.length > 0) {
      badge.textContent = urgent.length;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}
// ================================================================
// FEATURE 1: WEEKLY REPORT GENERATOR
// ================================================================
var reportRange = 'thisWeek';

function rWeeklyReport(el) {
  document.getElementById('pgT').textContent = '📊 Weekly Report';
  var data = getWeekData(reportRange);

  var h = '<div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap">';
  h += '<button class="btn ' + (reportRange === 'thisWeek' ? 'bp' : 'bo') + '" onclick="reportRange=\'thisWeek\';render()">สัปดาห์นี้</button>';
  h += '<button class="btn ' + (reportRange === 'lastWeek' ? 'bp' : 'bo') + '" onclick="reportRange=\'lastWeek\';render()">สัปดาห์ที่แล้ว</button>';
  h += '<button class="btn ' + (reportRange === 'thisMonth' ? 'bp' : 'bo') + '" onclick="reportRange=\'thisMonth\';render()">เดือนนี้</button>';
  h += '</div>';

  h += '<div class="card"><h2>📋 สรุป ' + data.label + '</h2>';
  h += '<div class="rpt-grid">';
  h += rptCard('📍', data.visits.length, 'Visit');
  h += rptCard('📞', data.followups, 'Follow-up');
  h += rptCard('📋', data.pipeUpdates, 'Pipeline Update');
  h += rptCard('🏆', data.wins.length, 'Win');
  h += rptCard('❌', data.losses.length, 'Lost');
  h += rptCard('💰', ftFmtVal(data.totalWinVal), 'Revenue Won');
  h += '</div></div>';

  // Visit details
  if (data.visits.length) {
    h += '<div class="card"><h2>📍 Visit (' + data.visits.length + ')</h2>';
    data.visits.forEach(function (v) {
      var dn = getDealerName(v.dealerId);
      h += '<div class="li"><div class="lm"><div class="lt">' + sanitize(dn) + '</div>';
      h += '<div class="ls">' + (v.date || '-') + ' • ' + (v.mode || '-') + '</div></div></div>';
    });
    h += '</div>';
  }

  // Wins
  if (data.wins.length) {
    h += '<div class="card"><h2>🏆 Win (' + data.wins.length + ')</h2>';
    data.wins.forEach(function (p) {
      h += '<div class="li"><div class="lm"><div class="lt">' + sanitize(p.project || p.name || '-') + '</div>';
      h += '<div class="ls">' + getDealerName(p.dealerId) + ' • ฿' + ftFmtFull(p.value) + '</div></div></div>';
    });
    h += '</div>';
  }

  // Losses
  if (data.losses.length) {
    h += '<div class="card"><h2>❌ Lost (' + data.losses.length + ')</h2>';
    data.losses.forEach(function (p) {
      h += '<div class="li"><div class="lm"><div class="lt">' + sanitize(p.project || p.name || '-') + '</div>';
      h += '<div class="ls">' + getDealerName(p.dealerId) + ' • ฿' + ftFmtFull(p.value) + '</div></div></div>';
    });
    h += '</div>';
  }

// Visit Table (Excel format)
  if (data.visits.length) {
    h += '<div class="card"><h2>📊 Visit Report Table — ' + data.label + ' <span class="ml">';
    h += '<button class="btn bsm bp" onclick="copyWeeklyVisitTable()">📋 Copy (Sheets)</button>';
    h += '<button class="btn bsm bo" onclick="dlWeeklyVisitCSV()">📤 CSV</button>';
    h += '</span></h2>';
    h += '<div class="export-wrap" style="overflow-x:auto"><table class="export-table" id="weekVisitTable">';
    h += '<thead><tr><th>#</th><th>Date</th><th>Sale</th><th>Dealer Name</th><th>Offline/Online</th><th>DJI Dealer<br>(SAB/Other)</th><th>Update</th><th>Location</th></tr></thead>';
    h += '<tbody>';

    var cfg = getConfig();
    data.visits.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });

    data.visits.forEach(function(v, idx) {
      var dealer = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
      var dealerName = dealer ? dealer.name : '-';
      var mode = v.mode === 'offline' ? 'Offline' : 'Online';
      var djiDealer = v.djiDealer || (dealer ? dealer.djiDealer : '') || '-';
      var saleName = v.saleName || cfg.saleName || 'Siwawong';
      var location = v.location || (dealer ? dealer.googleMap : '') || '-';

      // Build update text from topicData
      var update = '';
      if (v.topicData && v.topicData.length) {
        var answered = v.topicData.filter(function(td) { return td.answered; });
        answered.forEach(function(td, ti) {
          var topic = null;
          for (var i = 0; i < (cfg.visitTopics || []).length; i++) {
            if (cfg.visitTopics[i].id === td.topicId) { topic = cfg.visitTopics[i]; break; }
          }
          var topicName = topic ? topic.name : td.topicId;
          var content = td.content || td.summary || td.value || '';

          update += (ti + 1) + '.' + topicName;
          if (content) update += ': ' + content;
          update += '\n';

          // Topic-specific data
          if (td.topicId === 'sales_perf' && v.revenue) {
            update += '  ยอด: ' + fmtMoney(v.revenue) + ' บาท\n';
          }
          if (td.topicId === 'downstream' && v.customerSegment) {
            update += '  กลุ่มลูกค้า: ' + v.customerSegment + '\n';
          }
        });
      }

      // Pipeline updates
      if (v.pipelineUpdates && v.pipelineUpdates.length) {
        update += '\nPipeline:\n';
        v.pipelineUpdates.forEach(function(pu) {
          var pipe = pu.pipeId ? ST.getOne('pipeline', pu.pipeId) : null;
          update += '- ' + (pipe ? (pipe.projectName || '') : (pu.name || '-'));
          if (pu.newStatus) update += ' (' + getPipeName(pu.newStatus) + ')';
          if (pu.note) update += ' — ' + pu.note;
          update += '\n';
        });
      }

      // Summary
      if (v.summary) update += '\nสรุป: ' + v.summary;

      h += '<tr>';
      h += '<td class="pipe-row-num">' + (idx + 1) + '</td>';
      h += '<td style="white-space:nowrap">' + (v.date || '-') + '</td>';
      h += '<td>' + sanitize(saleName) + '</td>';
      h += '<td>' + sanitize(dealerName) + '</td>';
      h += '<td>' + mode + '</td>';
      h += '<td>' + sanitize(djiDealer) + '</td>';
      h += '<td style="max-width:300px;white-space:pre-wrap;font-size:.68rem">' + sanitize(update.trim()) + '</td>';
      h += '<td style="max-width:150px;font-size:.66rem;word-break:break-all">' + (location !== '-' ? '<a href="' + sanitize(location) + '" target="_blank" style="color:var(--accent)" onclick="event.stopPropagation()">📍 Map</a>' : '-') + '</td>';
      h += '</tr>';
    });

    h += '</tbody></table></div></div>';
  }

  // Copy buttons
  h += '<div class="card"><h2>📤 Export Report</h2>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h += '<button class="btn bp" onclick="copyReportBullet()">📋 Copy Bullet (LINE)</button>';
  h += '<button class="btn bo" onclick="copyReportTable()">📊 Copy Summary (Sheets)</button>';
  h += '<button class="btn bo" onclick="copyWeeklyVisitTable()">📋 Copy Visit Table</button>';
  h += '<button class="btn bo" onclick="dlWeeklyVisitCSV()">📤 Visit CSV</button>';
  h += '</div></div>';

  el.innerHTML = h;
}

function rptCard(icon, val, label) {
  return '<div class="rpt-card"><div class="rpt-icon">' + icon + '</div><div class="rpt-val">' + val + '</div><div class="rpt-label">' + label + '</div></div>';
}

function getDealerName(id) {
  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
  for (var i = 0; i < dealers.length; i++) {
    if (dealers[i].id === id) return dealers[i].name || '-';
  }
  return '-';
}

function getWeekData(range) {
  var now = new Date();
  var start, end, label;

  if (range === 'lastWeek') {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - 7);
    end = new Date(start);
    end.setDate(start.getDate() + 7);
    label = 'สัปดาห์ที่แล้ว';
  } else if (range === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    label = 'เดือนนี้';
  } else {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    label = 'สัปดาห์นี้';
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  var pipelog = JSON.parse(localStorage.getItem('v7_pipelog') || '[]');
  var followups = JSON.parse(localStorage.getItem('v7_followups') || '[]');

  function inRange(dateStr) {
    var d = ftParseDate(dateStr);
    return d && d >= start && d <= end;
  }
  function inRangeDT(dateStr) {
    if (!dateStr) return false;
    var d = ftParseDate(dateStr.split(' ')[0]);
    return d && d >= start && d <= end;
  }

  var wVisits = visits.filter(function (v) { return inRange(v.date); });
  var wPipeLogs = pipelog.filter(function (l) { return inRangeDT(l.date); });
  var wFollowups = followups.filter(function (f) { return inRange(f.date || f.dueDate); });
  var wWins = pipeline.filter(function (p) { return p.status === 'win' && inRangeDT(p.updatedAt || p.date); });
  var wLosses = pipeline.filter(function (p) { return p.status === 'lost' && inRangeDT(p.updatedAt || p.date); });

  var totalWinVal = 0;
  wWins.forEach(function (p) { totalWinVal += parseFloat(p.value) || 0; });

  return {
    label: label,
    start: start,
    end: end,
    visits: wVisits,
    pipeUpdates: wPipeLogs.length,
    followups: wFollowups.length,
    wins: wWins,
    losses: wLosses,
    totalWinVal: totalWinVal
  };
}

function copyReportBullet() {
  var data = getWeekData(reportRange);
  var t = '';
  t += '📊 Weekly Report — ' + data.label + '\n';
  t += '━━━━━━━━━━━━━━━━━━━━━━━━\n';
  t += '👤 Siwawong — SIS Distribution (DJI Enterprise)\n\n';
  t += '📍 VISIT (' + data.visits.length + ')\n';
  if (data.visits.length) {
    data.visits.forEach(function (v) {
      t += '• ' + (v.date || '-') + ' — ' + getDealerName(v.dealerId) + ' | ' + (v.mode || '-') + '\n';
    });
  } else {
    t += '• ไม่มี\n';
  }
  t += '\n📋 PIPELINE UPDATE: ' + data.pipeUpdates + ' รายการ\n';
  t += '📞 FOLLOW-UP: ' + data.followups + ' ครั้ง\n';
  t += '\n🏆 WIN (' + data.wins.length + ')\n';
  if (data.wins.length) {
    data.wins.forEach(function (p) {
      t += '• ' + sanitize(p.project || p.name || '-') + ' — ' + getDealerName(p.dealerId) + ' — ฿' + ftFmtFull(p.value) + '\n';
    });
  } else {
    t += '• ไม่มี\n';
  }
  t += '\n❌ LOST (' + data.losses.length + ')\n';
  if (data.losses.length) {
    data.losses.forEach(function (p) {
      t += '• ' + sanitize(p.project || p.name || '-') + ' — ' + getDealerName(p.dealerId) + '\n';
    });
  } else {
    t += '• ไม่มี\n';
  }
  t += '\n💰 Revenue Won: ฿' + ftFmtFull(data.totalWinVal) + '\n';
  t += '━━━━━━━━━━━━━━━━━━━━━━━━\n';

  copyText(t);
  toast('📋 Copy Report (Bullet) แล้ว!');
}

function copyReportTable() {
  var data = getWeekData(reportRange);
  var rows = [];
  rows.push(['Weekly Report', data.label, '', ''].join('\t'));
  rows.push(['Sale', 'Siwawong', '', ''].join('\t'));
  rows.push(['', '', '', ''].join('\t'));
  rows.push(['Type', 'Date', 'Dealer', 'Detail'].join('\t'));

  data.visits.forEach(function (v) {
    rows.push(['Visit', v.date || '-', getDealerName(v.dealerId), v.mode || '-'].join('\t'));
  });
  data.wins.forEach(function (p) {
    rows.push(['Win', p.updatedAt || p.date || '-', getDealerName(p.dealerId), (p.project || p.name || '-') + ' ฿' + ftFmtFull(p.value)].join('\t'));
  });
  data.losses.forEach(function (p) {
    rows.push(['Lost', p.updatedAt || p.date || '-', getDealerName(p.dealerId), p.project || p.name || '-'].join('\t'));
  });
  rows.push(['', '', '', ''].join('\t'));
  rows.push(['Summary', 'Visit: ' + data.visits.length, 'Follow-up: ' + data.followups, 'Pipeline Update: ' + data.pipeUpdates].join('\t'));
  rows.push(['', 'Win: ' + data.wins.length, 'Lost: ' + data.losses.length, 'Revenue Won: ฿' + ftFmtFull(data.totalWinVal)].join('\t'));

  copyText(rows.join('\n'));
  toast('📊 Copy Report (Table) แล้ว! วาง Sheets ได้เลย');
}

function copyWeeklyVisitTable() {
  var data = getWeekData(reportRange);
  var cfg = getConfig();

  var header = 'Date\tSale\tDealer Name\tOffline/Online\tDJI Dealer (SAB/Other)\tUpdate\tLocation';
  var rows = [header];

  data.visits.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });

  data.visits.forEach(function(v) {
    var dealer = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
    var dealerName = dealer ? dealer.name : '-';
    var mode = v.mode === 'offline' ? 'Offline' : 'Online';
    var djiDealer = v.djiDealer || (dealer ? dealer.djiDealer : '') || '-';
    var saleName = v.saleName || cfg.saleName || 'Siwawong';
    var location = v.location || (dealer ? dealer.googleMap : '') || '-';

    var update = buildVisitUpdateForExport(v, cfg);

    rows.push(
      (v.date || '-') + '\t' +
      saleName + '\t' +
      dealerName + '\t' +
      mode + '\t' +
      djiDealer + '\t' +
      update.replace(/\t/g, ' ').replace(/\n/g, ' | ') + '\t' +
      location
    );
  });

  copyText(rows.join('\n'));
  toast('📋 Copy Visit Table แล้ว! วาง Sheets ได้เลย');
}

function dlWeeklyVisitCSV() {
  var data = getWeekData(reportRange);
  var cfg = getConfig();

  var csv = '\uFEFF"Date","Sale","Dealer Name","Offline/Online","DJI Dealer (SAB/Other)","Update","Location"\n';

  data.visits.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });

  data.visits.forEach(function(v) {
    var dealer = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
    var dealerName = dealer ? dealer.name : '-';
    var mode = v.mode === 'offline' ? 'Offline' : 'Online';
    var djiDealer = v.djiDealer || (dealer ? dealer.djiDealer : '') || '-';
    var saleName = v.saleName || cfg.saleName || 'Siwawong';
    var location = v.location || (dealer ? dealer.googleMap : '') || '-';

    var update = buildVisitUpdateForExport(v, cfg);

    csv += '"' + (v.date || '-') + '","' +
      saleName + '","' +
      dealerName.replace(/"/g, '""') + '","' +
      mode + '","' +
      djiDealer + '","' +
      update.replace(/"/g, '""') + '","' +
      location.replace(/"/g, '""') + '"\n';
  });

  dlBlob(csv, 'visit-report-' + reportRange + '-' + _td() + '.csv');
  toast('📤 Download CSV แล้ว!');
}

function buildVisitUpdateForExport(v, cfg) {
  var update = '';

  // Topics
  if (v.topicData && v.topicData.length) {
    var answered = v.topicData.filter(function(td) { return td.answered; });
    answered.forEach(function(td, ti) {
      var topic = null;
      for (var i = 0; i < (cfg.visitTopics || []).length; i++) {
        if (cfg.visitTopics[i].id === td.topicId) { topic = cfg.visitTopics[i]; break; }
      }
      var topicName = topic ? topic.name : td.topicId;
      var content = td.content || td.summary || td.value || '';

      update += (ti + 1) + '.' + topicName;
      if (content) update += ': ' + content;
      update += '\n';

      if (td.topicId === 'sales_perf' && v.revenue) {
        update += '  ยอด: ' + fmtMoney(v.revenue) + ' บาท\n';
      }
      if (td.topicId === 'downstream' && v.customerSegment) {
        update += '  กลุ่มลูกค้า: ' + v.customerSegment + '\n';
      }
    });
  }

  // Pipeline
  if (v.pipelineUpdates && v.pipelineUpdates.length) {
    update += 'Pipeline: ';
    v.pipelineUpdates.forEach(function(pu) {
      var pipe = pu.pipeId ? ST.getOne('pipeline', pu.pipeId) : null;
      update += (pipe ? (pipe.projectName || '') : (pu.name || '-'));
      if (pu.newStatus) update += '(' + getPipeName(pu.newStatus) + ')';
      update += ', ';
    });
    update += '\n';
  }

  // Summary
  if (v.summary) update += 'สรุป: ' + v.summary;

  return update.trim();
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}


// ================================================================
// FEATURE 2: DASHBOARD WITH CHARTS
// ================================================================
function rDashboard(el) {
  document.getElementById('pgT').textContent = '📈 Dashboard';
  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');

  var h = '<div class="dash-grid">';

  // 1. Pipeline Funnel
  h += '<div class="card"><h2>🔽 Pipeline Funnel</h2>';
  h += buildFunnelChart(pipeline);
  h += '</div>';

  // 2. Win Rate Donut
  h += '<div class="card"><h2>🎯 Win Rate</h2>';
  h += buildDonutChart(pipeline);
  h += '</div>';

  // 3. Revenue vs Target
  h += '<div class="card dash-wide"><h2>💰 Revenue vs Target (Top 10)</h2>';
  h += buildRevenueChart(dealers, pipeline);
  h += '</div>';

  // 4. Visit Trend
  h += '<div class="card dash-wide"><h2>📍 Visit Trend (8 สัปดาห์)</h2>';
  h += buildVisitTrend(visits);
  h += '</div>';

  // 5. Pipeline Value by Dealer
  h += '<div class="card dash-wide"><h2>🏪 Pipeline Value by Dealer</h2>';
  h += buildDealerPipeChart(dealers, pipeline);
  h += '</div>';

  h += '</div>';
  el.innerHTML = h;
}

function buildFunnelChart(pipeline) {
  var stages = [
    { key: 'prospect', label: 'Prospect', color: '#64b5f6' },
    { key: 'tor_review', label: 'TOR Review', color: '#ba68c8' },
    { key: 'quotation', label: 'Quotation', color: '#ffb74d' },
    { key: 'bidding', label: 'Bidding', color: '#ff8a65' },
    { key: 'negotiation', label: 'Negotiation', color: '#4dd0e1' },
    { key: 'win', label: 'Win', color: '#81c784' },
    { key: 'ordered', label: 'Ordered', color: '#4caf50' }
  ];

  var maxCount = 1;
  stages.forEach(function (s) {
    s.count = pipeline.filter(function (p) { return p.status === s.key; }).length;
    s.value = 0;
    pipeline.forEach(function (p) { if (p.status === s.key) s.value += parseFloat(p.value) || 0; });
    if (s.count > maxCount) maxCount = s.count;
  });

  var h = '<div class="funnel">';
  stages.forEach(function (s) {
    if (s.count === 0) return;
    var pct = Math.max(20, Math.round(s.count / maxCount * 100));
    h += '<div class="funnel-row" style="width:' + pct + '%;background:' + s.color + '">';
    h += '<span class="funnel-label">' + s.label + '</span>';
    h += '<span class="funnel-val">' + s.count + ' (฿' + ftFmtVal(s.value) + ')</span>';
    h += '</div>';
  });
  if (maxCount <= 1 && pipeline.length === 0) {
    h += '<div style="text-align:center;padding:20px;color:var(--text2)">ยังไม่มีข้อมูล</div>';
  }
  h += '</div>';
  return h;
}

function buildDonutChart(pipeline) {
  var wins = pipeline.filter(function (p) { return p.status === 'win' || p.status === 'ordered' || p.status === 'delivered'; }).length;
  var losses = pipeline.filter(function (p) { return p.status === 'lost'; }).length;
  var total = wins + losses;
  var pct = total > 0 ? Math.round(wins / total * 100) : 0;
  var color = pct >= 60 ? '#81c784' : pct >= 40 ? '#ffb74d' : '#ff5252';

  var h = '<div class="donut-wrap">';
  h += '<div class="donut" style="background:conic-gradient(' + color + ' 0% ' + pct + '%, rgba(255,255,255,0.08) ' + pct + '% 100%)">';
  h += '<div class="donut-inner"><div class="donut-pct">' + pct + '%</div><div class="donut-label">Win Rate</div></div>';
  h += '</div>';
  h += '<div class="donut-legend">';
  h += '<div>🏆 Win: ' + wins + '</div>';
  h += '<div>❌ Lost: ' + losses + '</div>';
  h += '<div>📋 Total: ' + total + '</div>';
  h += '</div></div>';
  return h;
}

function buildRevenueChart(dealers, pipeline) {
  var stats = [];
  dealers.forEach(function (d) {
    var target = parseFloat(d.targetRevenue) || 0;
    var achieved = parseFloat(d.achievement) || 0;
    var pipeVal = 0;
    pipeline.forEach(function (p) {
      if (p.dealerId === d.id && p.status !== 'lost') pipeVal += parseFloat(p.value) || 0;
    });
    if (target > 0 || achieved > 0 || pipeVal > 0) {
      stats.push({ name: d.name || '-', target: target, achieved: achieved, pipeline: pipeVal });
    }
  });
  stats.sort(function (a, b) { return b.target - a.target; });
  stats = stats.slice(0, 10);

  if (!stats.length) return '<div style="text-align:center;padding:20px;color:var(--text2)">ยังไม่มีข้อมูล Target</div>';

  var maxVal = 1;
  stats.forEach(function (s) {
    var m = Math.max(s.target, s.achieved, s.pipeline);
    if (m > maxVal) maxVal = m;
  });

  var h = '<div class="rev-chart">';
  stats.forEach(function (s) {
    var tPct = Math.max(2, Math.round(s.target / maxVal * 100));
    var aPct = Math.max(2, Math.round(s.achieved / maxVal * 100));
    h += '<div class="rev-row">';
    h += '<div class="rev-name">' + sanitize(s.name).substring(0, 15) + '</div>';
    h += '<div class="rev-bars">';
    h += '<div class="rev-bar rev-target" style="width:' + tPct + '%" title="Target: ฿' + ftFmtFull(s.target) + '">T: ฿' + ftFmtVal(s.target) + '</div>';
    h += '<div class="rev-bar rev-actual" style="width:' + aPct + '%" title="Achieved: ฿' + ftFmtFull(s.achieved) + '">A: ฿' + ftFmtVal(s.achieved) + '</div>';
    h += '</div></div>';
  });
  h += '<div class="rev-legend"><span class="rev-leg-t">■ Target</span> <span class="rev-leg-a">■ Achieved</span></div>';
  h += '</div>';
  return h;
}

function buildVisitTrend(visits) {
  var now = new Date();
  var weeks = [];
  for (var w = 7; w >= 0; w--) {
    var ws = new Date(now);
    ws.setDate(now.getDate() - (w * 7) - now.getDay() + 1);
    ws.setHours(0, 0, 0, 0);
    var we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    we.setHours(23, 59, 59);

    var cnt = visits.filter(function (v) {
      var d = ftParseDate(v.date);
      return d && d >= ws && d <= we;
    }).length;

    var lbl = (ws.getDate()) + '/' + (ws.getMonth() + 1);
    weeks.push({ count: cnt, label: lbl });
  }

  var maxC = 1;
  weeks.forEach(function (w) { if (w.count > maxC) maxC = w.count; });

  var svgW = 400, svgH = 180, pad = 40;
  var cW = svgW - pad * 2, cH = svgH - pad * 2;
  var pts = [];
  for (var i = 0; i < weeks.length; i++) {
    var x = pad + (i / Math.max(weeks.length - 1, 1)) * cW;
    var y = pad + cH - (weeks[i].count / maxC * cH);
    pts.push(x + ',' + y);
  }

  var svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" class="svg-chart">';
  svg += '<defs><linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">';
  svg += '<stop offset="0%" stop-color="rgba(100,181,246,0.3)"/><stop offset="100%" stop-color="rgba(100,181,246,0)"/>';
  svg += '</linearGradient></defs>';

  for (var g = 0; g <= 4; g++) {
    var gy = pad + (g / 4) * cH;
    svg += '<line x1="' + pad + '" y1="' + gy + '" x2="' + (svgW - pad) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.06)"/>';
    svg += '<text x="' + (pad - 5) + '" y="' + (gy + 4) + '" fill="#8892b0" font-size="10" text-anchor="end">' + Math.round(maxC * (1 - g / 4)) + '</text>';
  }

  svg += '<polygon points="' + pad + ',' + (pad + cH) + ' ' + pts.join(' ') + ' ' + (svgW - pad) + ',' + (pad + cH) + '" fill="url(#vGrad)"/>';
  svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#64b5f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';

  for (var d = 0; d < weeks.length; d++) {
    var px = pad + (d / Math.max(weeks.length - 1, 1)) * cW;
    var py = pad + cH - (weeks[d].count / maxC * cH);
    svg += '<circle cx="' + px + '" cy="' + py + '" r="4" fill="#64b5f6" stroke="#0a1628" stroke-width="2"/>';
    svg += '<text x="' + px + '" y="' + (svgH - 5) + '" fill="#8892b0" font-size="9" text-anchor="middle">' + weeks[d].label + '</text>';
    if (weeks[d].count > 0) {
      svg += '<text x="' + px + '" y="' + (py - 10) + '" fill="#e0e6f0" font-size="11" text-anchor="middle" font-weight="600">' + weeks[d].count + '</text>';
    }
  }
  svg += '</svg>';
  return svg;
}

function buildDealerPipeChart(dealers, pipeline) {
  var stats = [];
  dealers.forEach(function (d) {
    var val = 0;
    pipeline.forEach(function (p) {
      if (p.dealerId === d.id && p.status !== 'lost' && p.status !== 'delivered') val += parseFloat(p.value) || 0;
    });
    if (val > 0) stats.push({ name: d.name || '-', value: val });
  });
  stats.sort(function (a, b) { return b.value - a.value; });
  if (!stats.length) return '<div style="text-align:center;padding:20px;color:var(--text2)">ยังไม่มีข้อมูล</div>';

  var maxV = stats[0].value || 1;
  var h = '<div class="dpipe-chart">';
  stats.forEach(function (s) {
    var pct = Math.max(5, Math.round(s.value / maxV * 100));
    h += '<div class="dpipe-row"><div class="dpipe-name">' + sanitize(s.name).substring(0, 18) + '</div>';
    h += '<div class="dpipe-track"><div class="dpipe-fill" style="width:' + pct + '%">฿' + ftFmtVal(s.value) + '</div></div></div>';
  });
  h += '</div>';
  return h;
}


// ================================================================
// FEATURE 3: QUICK COMMAND (Ctrl+K)
// ================================================================
var qCmdOpen = false;

function openQCmd() {
  var ov = document.getElementById('qcmdOverlay');
  if (!ov) return;
  ov.style.display = 'flex';
  qCmdOpen = true;
  var inp = document.getElementById('qcmdInput');
  if (inp) { inp.value = ''; inp.focus(); }
  qCmdSearch('');
}

function closeQCmd() {
  var ov = document.getElementById('qcmdOverlay');
  if (ov) ov.style.display = 'none';
  qCmdOpen = false;
}

function qCmdSearch(q) {
  q = (q || '').toLowerCase().trim();
  var results = [];

  // Navigation
  var navs = [
    { icon: '📌', name: 'Today', cmd: 'go:today' },
    { icon: '🏪', name: 'Dealers', cmd: 'go:dealers' },
    { icon: '📋', name: 'Pipeline', cmd: 'go:pipeline' },
    { icon: '📋', name: 'Pipeline Board', cmd: 'go:pipeBoard' },
    { icon: '📍', name: 'Visit Reports', cmd: 'go:visits' },
    { icon: '📋', name: 'Tasks / งานอื่นๆ', cmd: 'go:tasks' },
    { icon: '📋', name: 'Kanban', cmd: 'go:kanban' },
    { icon: '📅', name: 'Meetings / ประชุม', cmd: 'go:meetings' },
    { icon: '📆', name: 'Calendar / ปฏิทิน', cmd: 'go:calendar' },
    { icon: '📤', name: 'Export', cmd: 'go:exports' },
    { icon: '📚', name: 'Knowledge Base', cmd: 'go:knowledge' },
    { icon: '📊', name: 'Weekly Report', cmd: 'go:report' },
    { icon: '📈', name: 'Dashboard', cmd: 'go:dashboard' },
    { icon: '🏥', name: 'Data Health', cmd: 'go:health' },
    { icon: '⚙️', name: 'Admin', cmd: 'go:admin' }
  ];

  // Actions
  var acts = [
    { icon: '➕', name: 'เพิ่ม Visit', cmd: 'act:showVisitM' },
    { icon: '➕', name: 'เพิ่ม Pipeline', cmd: 'act:showPipeM' },
    { icon: '➕', name: 'เพิ่ม Dealer', cmd: 'act:showDealerM' },
    { icon: '➕', name: 'เพิ่ม Task / งาน', cmd: 'act:showTaskM' },
    { icon: '💬', name: 'LINE Message', cmd: 'act:openLineTemplates' },
    { icon: '🎬', name: 'Presentation', cmd: 'act:openPresentation' }
  ];

  navs.forEach(function (n) {
    if (!q || n.name.toLowerCase().indexOf(q) !== -1) {
      results.push({ type: 'nav', icon: n.icon, name: n.name, cmd: n.cmd });
    }
  });
  acts.forEach(function (a) {
    if (!q || a.name.toLowerCase().indexOf(q) !== -1) {
      results.push({ type: 'action', icon: a.icon, name: a.name, cmd: a.cmd });
    }
  });

  // Dealers
  if (q.length >= 1) {
    var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
    dealers.forEach(function (d) {
      if ((d.name || '').toLowerCase().indexOf(q) !== -1) {
        results.push({ type: 'dealer', icon: '🏪', name: d.name, cmd: 'dealer:' + d.id });
      }
    });

    var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
    pipeline.forEach(function (p) {
      var pname = p.project || p.name || '';
      if (pname.toLowerCase().indexOf(q) !== -1) {
        results.push({ type: 'pipeline', icon: '📋', name: pname + ' (฿' + ftFmtVal(p.value) + ')', cmd: 'pipe:' + p.id });
      }
    });
  }

  // Render
  var el = document.getElementById('qcmdResults');
  if (!el) return;

  if (!results.length) {
    el.innerHTML = '<div class="qcmd-empty">ไม่พบผลลัพธ์</div>';
    return;
  }

  var h = '';
  var lastType = '';
  results.slice(0, 15).forEach(function (r, i) {
    if (r.type !== lastType) {
      var typeLabel = { nav: '📌 Navigation', action: '⚡ Actions', dealer: '🏪 Dealers', pipeline: '📋 Pipeline' };
      h += '<div class="qcmd-section">' + (typeLabel[r.type] || '') + '</div>';
      lastType = r.type;
    }
    h += '<div class="qcmd-item' + (i === 0 ? ' qcmd-active' : '') + '" onclick="qCmdExec(\'' + r.cmd + '\')" data-idx="' + i + '">';
    h += '<span class="qcmd-icon">' + r.icon + '</span>';
    h += '<span class="qcmd-name">' + sanitize(r.name) + '</span>';
    h += '<span class="qcmd-type">' + r.type + '</span>';
    h += '</div>';
  });
  el.innerHTML = h;
}

function qCmdExec(cmd) {
  closeQCmd();
  var parts = cmd.split(':');
  var type = parts[0];
  var val = parts.slice(1).join(':');

  if (type === 'go') {
    go(val);
  } else if (type === 'act') {
    if (typeof window[val] === 'function') window[val]();
  } else if (type === 'dealer') {
    go('dealerDetail', { dealerId: val });
  } else if (type === 'pipe') {
    go('pipeDetail', { pipeId: val });
  }
}

// Keyboard navigation in command palette
function qCmdKeydown(e) {
  var items = document.querySelectorAll('.qcmd-item');
  if (!items.length) return;

  var active = document.querySelector('.qcmd-active');
  var idx = 0;
  if (active) idx = parseInt(active.getAttribute('data-idx')) || 0;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    idx = Math.min(idx + 1, items.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    idx = Math.max(idx - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (active) active.click();
    return;
  } else if (e.key === 'Escape') {
    closeQCmd();
    return;
  } else {
    return;
  }

  for (var i = 0; i < items.length; i++) items[i].classList.remove('qcmd-active');
  items[idx].classList.add('qcmd-active');
  items[idx].scrollIntoView({ block: 'nearest' });
}

// Init Ctrl+K
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (qCmdOpen) closeQCmd();
    else openQCmd();
  }
  if (e.key === 'Escape' && qCmdOpen) closeQCmd();
});


// ================================================================
// FEATURE 4: ACTIVITY STREAK
// ================================================================
function fmtDateKey(date) {
  var d = date.getDate();
  var m = date.getMonth() + 1;
  var y = date.getFullYear();
  return (d < 10 ? '0' + d : d) + '/' + (m < 10 ? '0' + m : m) + '/' + y;
}

function getStreakData() {
  var activities = {};

  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  visits.forEach(function (v) { if (v.date) activities[v.date] = true; });

  var followups = JSON.parse(localStorage.getItem('v7_followups') || '[]');
  followups.forEach(function (f) {
    var d = f.date || f.dueDate;
    if (d) activities[d] = true;
  });

  var pipelog = JSON.parse(localStorage.getItem('v7_pipelog') || '[]');
  pipelog.forEach(function (l) {
    if (l.date) activities[l.date.split(' ')[0]] = true;
  });

  var tasklogs = JSON.parse(localStorage.getItem('v7_tasklogs') || '[]');
  tasklogs.forEach(function (l) {
    if (l.date) activities[l.date.split(' ')[0]] = true;
  });

  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  pipeline.forEach(function (p) {
    if (p.updatedAt) activities[p.updatedAt.split(' ')[0]] = true;
    if (p.date) activities[p.date] = true;
  });

  // Count streak
  var now = new Date();
  var today = fmtDateKey(now);
  var streak = 0;

  if (activities[today]) {
    streak = 1;
  } else {
    var yd = new Date(now);
    yd.setDate(yd.getDate() - 1);
    if (!activities[fmtDateKey(yd)]) {
      return { streak: 0, thisWeek: getWeekActivity(activities) };
    }
  }

  for (var i = 1; i < 365; i++) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    if (activities[fmtDateKey(d)]) streak++;
    else break;
  }

  return { streak: streak, thisWeek: getWeekActivity(activities) };
}

function getWeekActivity(activities) {
  var now = new Date();
  var today = fmtDateKey(now);
  var days = [];
  var labels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  var start = new Date(now);
  start.setDate(now.getDate() - now.getDay());

  for (var i = 0; i < 7; i++) {
    var d = new Date(start);
    d.setDate(start.getDate() + i);
    var key = fmtDateKey(d);
    days.push({ label: labels[i], active: !!activities[key], isToday: key === today });
  }
  return days;
}

function renderStreakCard() {
  var data = getStreakData();
  var fire = data.streak >= 7 ? '🔥🔥🔥' : data.streak >= 3 ? '🔥🔥' : data.streak >= 1 ? '🔥' : '❄️';

  var h = '<div class="streak-card">';
  h += '<div class="streak-top">';
  h += '<div class="streak-fire">' + fire + '</div>';
  h += '<div class="streak-num">' + data.streak + '</div>';
  h += '<div class="streak-label">วันติดต่อกัน</div>';
  h += '</div>';

  h += '<div class="streak-week">';
  data.thisWeek.forEach(function (d) {
    var cls = 'streak-day';
    if (d.active) cls += ' streak-active';
    if (d.isToday) cls += ' streak-today';
    h += '<div class="' + cls + '"><div class="streak-dot"></div><div class="streak-dlabel">' + d.label + '</div></div>';
  });
  h += '</div></div>';
  return h;
}


// ================================================================
// FEATURE 5: DATA HEALTH CHECK
// ================================================================
function rDataHealth(el) {
  document.getElementById('pgT').textContent = '🏥 Data Health Check';
  var result = getOverallHealth();

  var h = '';

  // Overall score
  var scoreColor = result.score >= 80 ? '#81c784' : result.score >= 50 ? '#ffb74d' : '#ff5252';
  h += '<div class="card" style="text-align:center">';
  h += '<div class="health-score-big" style="color:' + scoreColor + '">' + result.score + '%</div>';
  h += '<div style="font-size:14px;color:var(--text2);margin-bottom:12px">Overall Data Health</div>';
  h += '<div class="health-bar-big"><div class="health-fill-big" style="width:' + result.score + '%;background:' + scoreColor + '"></div></div>';
  h += '</div>';

  // Summary cards
  h += '<div class="rpt-grid">';
  h += rptCard('🏪', result.dealerScore + '%', 'Dealer Data');
  h += rptCard('📋', result.pipeScore + '%', 'Pipeline Data');
  h += rptCard('📍', result.visitScore + '%', 'Visit Data');
  h += rptCard('⚠️', result.issues.length, 'Issues Found');
  h += '</div>';

  // Issues list
  if (result.issues.length) {
    h += '<div class="card"><h2>⚠️ Issues (' + result.issues.length + ')</h2>';

    var critical = result.issues.filter(function (i) { return i.level === 'critical'; });
    var warning = result.issues.filter(function (i) { return i.level === 'warning'; });
    var info = result.issues.filter(function (i) { return i.level === 'info'; });

    if (critical.length) {
      h += '<div class="health-section">🔴 Critical (' + critical.length + ')</div>';
      critical.forEach(function (i) {
        h += '<div class="health-issue health-critical">' + i.icon + ' ' + sanitize(i.text);
        if (i.action) h += ' <button class="btn-xs" onclick="' + i.action + '">แก้ไข →</button>';
        h += '</div>';
      });
    }
    if (warning.length) {
      h += '<div class="health-section">🟡 Warning (' + warning.length + ')</div>';
      warning.forEach(function (i) {
        h += '<div class="health-issue health-warning">' + i.icon + ' ' + sanitize(i.text);
        if (i.action) h += ' <button class="btn-xs" onclick="' + i.action + '">แก้ไข →</button>';
        h += '</div>';
      });
    }
    if (info.length) {
      h += '<div class="health-section">🔵 Info (' + info.length + ')</div>';
      info.forEach(function (i) {
        h += '<div class="health-issue health-info">' + i.icon + ' ' + sanitize(i.text) + '</div>';
      });
    }
    h += '</div>';
  } else {
    h += '<div class="card" style="text-align:center;padding:24px"><div style="font-size:48px;margin-bottom:8px">🎉</div><div>ข้อมูลสมบูรณ์ 100%!</div></div>';
  }

  // Dealer detail
  h += '<div class="card"><h2>🏪 Dealer Data Detail</h2>';
  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
  dealers.forEach(function (d) {
    var dh = getDealerHealthScore(d);
    var dColor = dh.score >= 80 ? '#81c784' : dh.score >= 50 ? '#ffb74d' : '#ff5252';
    h += '<div class="health-dealer" onclick="go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})">';
    h += '<div style="flex:1"><div style="font-weight:600">' + sanitize(d.name || '-') + '</div>';
    h += '<div style="font-size:11px;color:var(--text2)">' + dh.missing.join(', ') + '</div></div>';
    h += '<div class="health-mini" style="color:' + dColor + '">' + dh.score + '%</div>';
    h += '</div>';
  });
  h += '</div>';

  el.innerHTML = h;
}

function getDealerHealthScore(dealer) {
  var fields = [
    { key: 'name', label: 'ชื่อ', weight: 10 },
    { key: 'level', label: 'Level', weight: 10 },
    { key: 'djiDealerType', label: 'DJI Dealer Type', weight: 8 },
    { key: 'contactName', label: 'ผู้ติดต่อ', weight: 8 },
    { key: 'phone', label: 'เบอร์โทร', weight: 8 },
    { key: 'email', label: 'Email', weight: 5 },
    { key: 'address', label: 'ที่อยู่', weight: 5 },
    { key: 'googleMap', label: 'Google Map', weight: 3 },
    { key: 'targetRevenue', label: 'Target Revenue', weight: 8 },
    { key: 'sisCode', label: 'SIS Code', weight: 5 },
    { key: 'djiCode', label: 'DJI Code', weight: 5 }
  ];

  var totalWeight = 0;
  var earnedWeight = 0;
  var missing = [];

  fields.forEach(function (f) {
    totalWeight += f.weight;
    var val = dealer[f.key];
    if (val && String(val).trim()) {
      earnedWeight += f.weight;
    } else {
      missing.push(f.label);
    }
  });

  return {
    score: totalWeight > 0 ? Math.round(earnedWeight / totalWeight * 100) : 0,
    missing: missing
  };
}

function getOverallHealth() {
  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var issues = [];

  // Dealer health
  var dealerTotal = 0;
  dealers.forEach(function (d) {
    var dh = getDealerHealthScore(d);
    dealerTotal += dh.score;
    if (dh.score < 50) {
      issues.push({ level: 'critical', icon: '🏪', text: (d.name || 'Unknown') + ' — ข้อมูลน้อยมาก (' + dh.score + '%)', action: "go('dealerDetail',{dealerId:'" + d.id + "'})" });
    } else if (dh.score < 80) {
      issues.push({ level: 'warning', icon: '🏪', text: (d.name || 'Unknown') + ' — ขาด: ' + dh.missing.slice(0, 3).join(', '), action: "go('dealerDetail',{dealerId:'" + d.id + "'})" });
    }
  });
  var dealerScore = dealers.length ? Math.round(dealerTotal / dealers.length) : 100;

  // Pipeline health
  var pipeTotal = 0;
  var activePipe = pipeline.filter(function (p) { return p.status !== 'lost' && p.status !== 'delivered'; });
  activePipe.forEach(function (p) {
    var score = 0;
    var max = 0;
    max += 10; if (p.project || p.name) score += 10;
    max += 10; if (p.dealerId) score += 10;
    max += 10; if (p.value && parseFloat(p.value) > 0) score += 10;
    max += 8; if (p.model) score += 8;
    max += 8; if (p.nextAction) score += 8;
    max += 8; if (p.followupDate || p.nextFollowup) score += 8;
    max += 5; if (p.contactName || p.contact) score += 5;
    var pScore = max > 0 ? Math.round(score / max * 100) : 100;
    pipeTotal += pScore;

    if (!p.nextAction && (parseFloat(p.value) || 0) >= 500000) {
      issues.push({ level: 'warning', icon: '📋', text: (p.project || p.name || 'Unknown') + ' — ไม่มี Next Action (฿' + ftFmtVal(p.value) + ')', action: "go('pipeDetail',{pipeId:'" + p.id + "'})" });
    }
    if (!p.followupDate && !p.nextFollowup) {
      issues.push({ level: 'info', icon: '📋', text: (p.project || p.name || 'Unknown') + ' — ไม่มี Follow-up Date' });
    }
  });
  var pipeScore = activePipe.length ? Math.round(pipeTotal / activePipe.length) : 100;

  // Visit health
  var visitTotal = 0;
  visits.slice(-20).forEach(function (v) {
    var score = 0;
    var max = 0;
    max += 10; if (v.date) score += 10;
    max += 10; if (v.dealerId) score += 10;
    max += 8; if (v.mode) score += 8;
    max += 8; if (v.update && v.update.trim().length > 10) score += 8;
    var vScore = max > 0 ? Math.round(score / max * 100) : 100;
    visitTotal += vScore;
  });
  var recentVisits = visits.slice(-20);
  var visitScore = recentVisits.length ? Math.round(visitTotal / recentVisits.length) : 100;

  // Empty data warnings
  if (dealers.length === 0) {
    issues.push({ level: 'critical', icon: '🏪', text: 'ยังไม่มี Dealer — เพิ่มอย่างน้อย 1 ราย' });
  }
  if (pipeline.length === 0) {
    issues.push({ level: 'warning', icon: '📋', text: 'ยังไม่มี Pipeline — เพิ่มหรือ Import ข้อมูล' });
  }

  var overall = Math.round((dealerScore + pipeScore + visitScore) / 3);

  return {
    score: overall,
    dealerScore: dealerScore,
    pipeScore: pipeScore,
    visitScore: visitScore,
    issues: issues
  };
}

function renderHealthSummary() {
  var result = getOverallHealth();
  var scoreColor = result.score >= 80 ? '#81c784' : result.score >= 50 ? '#ffb74d' : '#ff5252';
  var critCount = result.issues.filter(function (i) { return i.level === 'critical'; }).length;

  var h = '<div class="health-mini-card" onclick="go(\'health\')" style="cursor:pointer">';
  h += '<div class="health-mini-left">';
  h += '<span style="font-size:18px">🏥</span>';
  h += '<span style="font-weight:600">Data Health</span>';
  h += '<span class="health-mini-score" style="color:' + scoreColor + '">' + result.score + '%</span>';
  h += '</div>';
  if (critCount > 0) {
    h += '<span class="sn-badge sn-badge-red">' + critCount + ' issues</span>';
  }
  h += '</div>';
  return h;
}
// ================================================================
// CUSTOM KPI SYSTEM
// ================================================================
var KPI_DEFAULTS = [
  {
    id: 'kpi_new_dealer',
    name: 'หาลูกค้าใหม่ + Authorized Dealer',
    icon: '🏪',
    period: 'quarterly',
    type: 'funnel',
    steps: [
      { id: 'prospect', name: 'Prospect (หาลูกค้าใหม่)', target: 10, color: '#64b5f6' },
      { id: 'submit_doc', name: 'สนใจ + ส่งเอกสารให้ DJI พิจารณา', target: 3, color: '#ffb74d' },
      { id: 'approved', name: 'ผ่านเป็น Authorized Dealer', target: 1, color: '#81c784' }
    ]
  },
  {
    id: 'kpi_visit_total',
    name: 'Visit ลูกค้า (รวม Online+Offline)',
    icon: '📍',
    target: 4,
    period: 'weekly',
    type: 'auto',
    autoSource: 'visit_total'
  },
  {
    id: 'kpi_visit_offline',
    name: 'Visit Offline (เข้าพบจริง)',
    icon: '🚗',
    target: 1,
    period: 'weekly',
    type: 'auto',
    autoSource: 'visit_offline'
  }
];

function getKpiConfigs() {
  var saved = localStorage.getItem('v7_kpiConfig');
  if (saved) { try { return JSON.parse(saved); } catch (e) {} }
  return KPI_DEFAULTS.slice();
}

function saveKpiConfigs(list) {
  localStorage.setItem('v7_kpiConfig', JSON.stringify(list));
}

function getKpiEntries() {
  var saved = localStorage.getItem('v7_kpiEntries');
  if (saved) { try { return JSON.parse(saved); } catch (e) {} }
  return [];
}

function saveKpiEntries(list) {
  localStorage.setItem('v7_kpiEntries', JSON.stringify(list));
}

// ---- Period Helpers ----
function getCurrentQuarter() {
  var now = new Date();
  var q = Math.floor(now.getMonth() / 3) + 1;
  return { q: q, year: now.getFullYear(), label: 'Q' + q + '/' + now.getFullYear() };
}

function getQuarterRange() {
  var now = new Date();
  var q = Math.floor(now.getMonth() / 3);
  var start = new Date(now.getFullYear(), q * 3, 1);
  var end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
  return { start: start, end: end };
}

function getCurrentWeekRange() {
  var now = new Date();
  var start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1); // Monday
  start.setHours(0, 0, 0, 0);
  var end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start, end: end, label: fmtDateKey(start) + ' — ' + fmtDateKey(end) };
}

function getCurrentMonthRange() {
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), 1);
  var end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  var months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return { start: start, end: end, label: months[now.getMonth()] + ' ' + now.getFullYear() };
}

function getPeriodRange(period) {
  if (period === 'weekly') return getCurrentWeekRange();
  if (period === 'monthly') return getCurrentMonthRange();
  if (period === 'quarterly') return getQuarterRange();
  return getCurrentMonthRange();
}

function getPeriodLabel(period) {
  if (period === 'weekly') return 'สัปดาห์นี้';
  if (period === 'monthly') return getCurrentMonthRange().label;
  if (period === 'quarterly') return getCurrentQuarter().label;
  return '';
}

function isInPeriodRange(dateStr, range) {
  var d = ftParseDate(dateStr);
  if (!d) return false;
  return d >= range.start && d <= range.end;
}

// ---- Auto Count ----
function getAutoKpiCount(source, range) {
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');

  if (source === 'visit_total') {
    return visits.filter(function (v) {
      return isInPeriodRange(v.date, range);
    }).length;
  }

  if (source === 'visit_offline') {
    return visits.filter(function (v) {
      if (!isInPeriodRange(v.date, range)) return false;
      var mode = (v.mode || '').toLowerCase();
      return mode.indexOf('offline') !== -1 || mode.indexOf('onsite') !== -1 || mode.indexOf('เข้าพบ') !== -1 || mode.indexOf('visit') !== -1;
    }).length;
  }

  if (source === 'visit_online') {
    return visits.filter(function (v) {
      if (!isInPeriodRange(v.date, range)) return false;
      var mode = (v.mode || '').toLowerCase();
      return mode.indexOf('online') !== -1 || mode.indexOf('call') !== -1 || mode.indexOf('โทร') !== -1;
    }).length;
  }

  if (source === 'followup') {
    var followups = JSON.parse(localStorage.getItem('v7_followups') || '[]');
    return followups.filter(function (f) {
      return isInPeriodRange(f.date || f.dueDate, range);
    }).length;
  }

  if (source === 'pipeline_win') {
    var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
    return pipeline.filter(function (p) {
      return p.status === 'win' && isInPeriodRange(p.updatedAt || p.date, range);
    }).length;
  }

  if (source === 'pipeline_new') {
    var pipeline2 = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
    return pipeline2.filter(function (p) {
      return isInPeriodRange(p.registerDate || p.date, range);
    }).length;
  }

  return 0;
}

// ---- Get Auto Visit Details ----
function getAutoVisitDetails(source, range) {
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
  var result = [];

  var filtered;
  if (source === 'visit_total') {
    filtered = visits.filter(function (v) { return isInPeriodRange(v.date, range); });
  } else if (source === 'visit_offline') {
    filtered = visits.filter(function (v) {
      if (!isInPeriodRange(v.date, range)) return false;
      var mode = (v.mode || '').toLowerCase();
      return mode.indexOf('offline') !== -1 || mode.indexOf('onsite') !== -1 || mode.indexOf('เข้าพบ') !== -1 || mode.indexOf('visit') !== -1;
    });
  } else {
    return result;
  }

  filtered.forEach(function (v) {
    var dn = '-';
    for (var i = 0; i < dealers.length; i++) {
      if (dealers[i].id === v.dealerId) { dn = dealers[i].name; break; }
    }
    result.push({ date: v.date, name: dn, mode: v.mode || '-', id: v.id });
  });

  return result;
}


// ================================================================
// KPI DASHBOARD PAGE
// ================================================================
function rCustomKPI(el) {
  document.getElementById('pgT').textContent = '🎯 KPI Dashboard';
  var configs = getKpiConfigs();
  var entries = getKpiEntries();

  var h = '<div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap">';
  h += '<button class="btn bp" onclick="showAddKpiM()">➕ เพิ่ม KPI</button>';
  h += '<button class="btn bo" onclick="manageKpiConfigs()">⚙️ จัดการ KPI</button>';
  h += '</div>';

  if (!configs.length) {
    h += '<div class="card" style="text-align:center;padding:30px">';
    h += '<div style="font-size:48px;margin-bottom:10px">🎯</div>';
    h += '<p>ยังไม่มี KPI — กด ➕ เพิ่ม หรือ</p>';
    h += '<button class="btn bp" onclick="resetKpiDefaults()">🔄 ใช้ค่าเริ่มต้น</button>';
    h += '</div>';
    el.innerHTML = h;
    return;
  }

  // Separate by period
  var weekly = configs.filter(function (k) { return k.period === 'weekly'; });
  var monthly = configs.filter(function (k) { return k.period === 'monthly'; });
  var quarterly = configs.filter(function (k) { return k.period === 'quarterly'; });

  if (weekly.length) {
    h += '<div class="card"><h2>📅 รายสัปดาห์ — ' + getPeriodLabel('weekly') + '</h2>';
    weekly.forEach(function (kpi) { h += renderKpiItem(kpi, entries); });
    h += '</div>';
  }

  if (monthly.length) {
    h += '<div class="card"><h2>📆 รายเดือน — ' + getPeriodLabel('monthly') + '</h2>';
    monthly.forEach(function (kpi) { h += renderKpiItem(kpi, entries); });
    h += '</div>';
  }

  if (quarterly.length) {
    h += '<div class="card"><h2>📊 รายไตรมาส — ' + getPeriodLabel('quarterly') + '</h2>';
    quarterly.forEach(function (kpi) { h += renderKpiItem(kpi, entries); });
    h += '</div>';
  }

  el.innerHTML = h;
}

function renderKpiItem(kpi, entries) {
  var range = getPeriodRange(kpi.period);
  var h = '';

  if (kpi.type === 'funnel') {
    h += renderFunnelKpi(kpi, entries, range);
  } else if (kpi.type === 'auto') {
    h += renderAutoKpi(kpi, range);
  } else {
    h += renderSimpleKpi(kpi, entries, range);
  }

  return h;
}

// ---- Render Auto KPI ----
function renderAutoKpi(kpi, range) {
  var count = getAutoKpiCount(kpi.autoSource, range);
  var target = kpi.target || 1;
  var pct = Math.min(100, Math.round(count / target * 100));
  var color = pct >= 100 ? '#81c784' : pct >= 50 ? '#ffb74d' : '#ff5252';

  var h = '<div class="kpi-item">';
  h += '<div class="kpi-header">';
  h += '<div class="kpi-title">' + (kpi.icon || '📊') + ' ' + sanitize(kpi.name) + '</div>';
  h += '<div class="kpi-score" style="color:' + color + '">' + count + '/' + target + '</div>';
  h += '</div>';
  h += '<div class="kpi-bar"><div class="kpi-fill" style="width:' + pct + '%;background:' + color + '"></div></div>';

  // Show details
  var details = getAutoVisitDetails(kpi.autoSource, range);
  if (details.length > 0) {
    h += '<div class="kpi-details">';
    details.forEach(function (d) {
      h += '<div class="kpi-entry">';
      h += '<span class="kpi-entry-date">' + (d.date || '-') + '</span>';
      h += '<span class="kpi-entry-name">' + sanitize(d.name) + '</span>';
      h += '<span class="kpi-entry-mode">' + sanitize(d.mode) + '</span>';
      h += '</div>';
    });
    h += '</div>';
  }

  if (pct >= 100) h += '<div class="kpi-success">🎉 สำเร็จแล้ว!</div>';
  h += '</div>';
  return h;
}

// ---- Render Funnel KPI ----
function renderFunnelKpi(kpi, allEntries, range) {
  var kpiEntries = allEntries.filter(function (e) {
    return e.kpiId === kpi.id && e.status !== 'dropped' && isInPeriodRange(e.createdDate || e.date, range);
  });

  var h = '<div class="kpi-item kpi-funnel">';
  h += '<div class="kpi-header">';
  h += '<div class="kpi-title">' + (kpi.icon || '📊') + ' ' + sanitize(kpi.name) + '</div>';
  h += '<div class="kpi-period">' + getPeriodLabel(kpi.period) + '</div>';
  h += '</div>';

  // Funnel visualization
  h += '<div class="funnel-steps">';
  var maxTarget = 1;
  (kpi.steps || []).forEach(function (s) { if (s.target > maxTarget) maxTarget = s.target; });

  (kpi.steps || []).forEach(function (step, si) {
    var stepEntries = kpiEntries.filter(function (e) { return e.currentStep === step.id; });
    // Also count entries that passed this step
    var atOrBeyond = kpiEntries.filter(function (e) {
      var eIdx = getStepIndex(kpi, e.currentStep);
      return eIdx >= si;
    });

    var count = atOrBeyond.length;
    var target = step.target || 0;
    var pct = target > 0 ? Math.min(100, Math.round(count / target * 100)) : (count > 0 ? 100 : 0);
    var barPct = Math.max(20, Math.round(target / maxTarget * 100));
    var color = step.color || '#64b5f6';

    h += '<div class="funnel-step">';
    h += '<div class="funnel-step-bar" style="width:' + barPct + '%;background:' + color + '">';
    h += '<div class="funnel-step-info">';
    h += '<span>' + sanitize(step.name) + '</span>';
    h += '<span class="funnel-step-count">' + count + '/' + target + '</span>';
    h += '</div>';
    h += '</div>';

    // Mini progress
    if (target > 0) {
      h += '<div class="kpi-bar" style="margin:3px 0"><div class="kpi-fill" style="width:' + pct + '%;background:' + color + '"></div></div>';
    }

    // List entries at this step
    if (stepEntries.length > 0) {
      h += '<div class="kpi-details">';
      stepEntries.forEach(function (e) {
        h += '<div class="kpi-entry">';
        h += '<span class="kpi-entry-date">' + (e.date || '-') + '</span>';
        h += '<span class="kpi-entry-name">' + sanitize(e.name || '-') + '</span>';
        if (si < (kpi.steps || []).length - 1) {
          h += '<button class="btn-xs kpi-promote" onclick="promoteKpiEntry(\'' + e.id + '\',\'' + kpi.id + '\')" title="เลื่อนขั้น">⬆️</button>';
        }
        h += '<button class="btn-xs" onclick="editKpiEntry(\'' + e.id + '\')" title="แก้ไข">✏️</button>';
        h += '<button class="btn-xs btn-red" onclick="dropKpiEntry(\'' + e.id + '\')" title="ลบ">✕</button>';
        h += '</div>';
      });
      h += '</div>';
    }

    // Arrow between steps
    if (si < (kpi.steps || []).length - 1) {
      h += '<div class="funnel-arrow">▼</div>';
    }

    h += '</div>';
  });

  h += '</div>';

  // Add entry button
  h += '<div style="margin-top:8px">';
  h += '<button class="btn bp" onclick="showAddKpiEntryM(\'' + kpi.id + '\')">➕ เพิ่มรายชื่อ</button>';
  h += '</div>';

  // Conversion rate
  if (kpi.steps && kpi.steps.length >= 2) {
    var first = kpiEntries.length;
    var last = kpiEntries.filter(function (e) {
      return e.currentStep === kpi.steps[kpi.steps.length - 1].id;
    }).length;
    if (first > 0) {
      h += '<div class="kpi-conversion">📈 Conversion: ' + first + ' → ' + last + ' (' + Math.round(last / first * 100) + '%)</div>';
    }
  }

  h += '</div>';
  return h;
}

function getStepIndex(kpi, stepId) {
  for (var i = 0; i < (kpi.steps || []).length; i++) {
    if (kpi.steps[i].id === stepId) return i;
  }
  return 0;
}

// ---- Render Simple KPI (manual count) ----
function renderSimpleKpi(kpi, allEntries, range) {
  var kpiEntries = allEntries.filter(function (e) {
    return e.kpiId === kpi.id && e.status !== 'dropped' && isInPeriodRange(e.date, range);
  });
  var count = kpiEntries.length;
  var target = kpi.target || 1;
  var pct = Math.min(100, Math.round(count / target * 100));
  var color = pct >= 100 ? '#81c784' : pct >= 50 ? '#ffb74d' : '#ff5252';

  var h = '<div class="kpi-item">';
  h += '<div class="kpi-header">';
  h += '<div class="kpi-title">' + (kpi.icon || '📊') + ' ' + sanitize(kpi.name) + '</div>';
  h += '<div class="kpi-score" style="color:' + color + '">' + count + '/' + target + '</div>';
  h += '</div>';
  h += '<div class="kpi-bar"><div class="kpi-fill" style="width:' + pct + '%;background:' + color + '"></div></div>';

  if (kpiEntries.length > 0) {
    h += '<div class="kpi-details">';
    kpiEntries.forEach(function (e) {
      h += '<div class="kpi-entry">';
      h += '<span class="kpi-entry-date">' + (e.date || '-') + '</span>';
      h += '<span class="kpi-entry-name">' + sanitize(e.name || '-') + '</span>';
      h += '<button class="btn-xs btn-red" onclick="dropKpiEntry(\'' + e.id + '\')">✕</button>';
      h += '</div>';
    });
    h += '</div>';
  }

  h += '<button class="btn-sm bp" onclick="showAddKpiEntryM(\'' + kpi.id + '\')" style="margin-top:6px">➕ เพิ่ม</button>';
  if (pct >= 100) h += '<div class="kpi-success">🎉 สำเร็จแล้ว!</div>';
  h += '</div>';
  return h;
}


// ================================================================
// KPI ENTRY ACTIONS
// ================================================================
function showAddKpiEntryM(kpiId) {
  var configs = getKpiConfigs();
  var kpi = null;
  for (var i = 0; i < configs.length; i++) {
    if (configs[i].id === kpiId) { kpi = configs[i]; break; }
  }
  if (!kpi) return;

  var today = _td();
  var h = '<div style="max-width:450px">';
  h += '<div style="padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:12px">';
  h += '<div style="font-weight:600">' + (kpi.icon || '') + ' ' + sanitize(kpi.name) + '</div>';
  h += '</div>';

  h += '<div class="fm-group"><label>🏢 ชื่อบริษัท/ลูกค้า</label>';
  h += '<input type="text" id="keNameInput" class="fm-input" placeholder="เช่น บริษัท ABC จำกัด"></div>';

  h += '<div class="fm-group"><label>📅 วันที่</label>';
  h += '<input type="text" id="keDateInput" class="fm-input dp" value="' + today + '" placeholder="DD/MM/YYYY"></div>';

  // Step selector for funnel
  if (kpi.type === 'funnel' && kpi.steps && kpi.steps.length > 0) {
    h += '<div class="fm-group"><label>📊 ขั้นตอน</label>';
    h += '<select id="keStepInput" class="fm-input">';
    kpi.steps.forEach(function (s) {
      h += '<option value="' + s.id + '">' + sanitize(s.name) + '</option>';
    });
    h += '</select></div>';
  }

  h += '<div class="fm-group"><label>📝 หมายเหตุ (ถ้ามี)</label>';
  h += '<textarea id="keNoteInput" rows="2" class="fm-input" placeholder="เช่น เจอที่งาน Drone Show..."></textarea></div>';

  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveKpiEntry(\'' + kpiId + '\')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('➕ เพิ่มรายชื่อ — ' + sanitize(kpi.name), h);
}

function saveKpiEntry(kpiId) {
  var name = (document.getElementById('keNameInput').value || '').trim();
  var date = (document.getElementById('keDateInput').value || '').trim();
  var note = (document.getElementById('keNoteInput').value || '').trim();
  var stepEl = document.getElementById('keStepInput');
  var stepId = stepEl ? stepEl.value : '';

  if (!name) { toast('กรุณาใส่ชื่อบริษัท'); return; }

  var entries = getKpiEntries();
  entries.push({
    id: 'ke_' + Date.now(),
    kpiId: kpiId,
    currentStep: stepId,
    name: name,
    date: date || _td(),
    createdDate: _td(),
    note: note,
    status: 'active',
    stepDates: stepId ? (function () { var o = {}; o[stepId] = date || _td(); return o; })() : {}
  });
  saveKpiEntries(entries);
  toast('✅ เพิ่มแล้ว: ' + name);
  closeMForce();
  render();
}

function promoteKpiEntry(entryId, kpiId) {
  var entries = getKpiEntries();
  var configs = getKpiConfigs();
  var kpi = null;
  var entry = null;

  for (var i = 0; i < configs.length; i++) {
    if (configs[i].id === kpiId) { kpi = configs[i]; break; }
  }
  for (var j = 0; j < entries.length; j++) {
    if (entries[j].id === entryId) { entry = entries[j]; break; }
  }
  if (!kpi || !entry || !kpi.steps) return;

  var currentIdx = getStepIndex(kpi, entry.currentStep);
  if (currentIdx >= kpi.steps.length - 1) {
    toast('อยู่ขั้นสุดท้ายแล้ว');
    return;
  }

  var nextStep = kpi.steps[currentIdx + 1];
  if (!confirm('เลื่อน "' + entry.name + '" ไป\n→ ' + nextStep.name + '?')) return;

  entry.currentStep = nextStep.id;
  if (!entry.stepDates) entry.stepDates = {};
  entry.stepDates[nextStep.id] = _td();

  saveKpiEntries(entries);
  toast('⬆️ เลื่อนไป: ' + nextStep.name);
  render();
}

function editKpiEntry(entryId) {
  var entries = getKpiEntries();
  var entry = null;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].id === entryId) { entry = entries[i]; break; }
  }
  if (!entry) return;

  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>🏢 ชื่อบริษัท</label>';
  h += '<input type="text" id="keNameInput" class="fm-input" value="' + sanitize(entry.name || '') + '"></div>';
  h += '<div class="fm-group"><label>📅 วันที่</label>';
  h += '<input type="text" id="keDateInput" class="fm-input dp" value="' + (entry.date || '') + '"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label>';
  h += '<textarea id="keNoteInput" rows="2" class="fm-input">' + sanitize(entry.note || '') + '</textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveEditKpiEntry(\'' + entryId + '\')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('✏️ แก้ไข', h);
}

function saveEditKpiEntry(entryId) {
  var entries = getKpiEntries();
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].id === entryId) {
      entries[i].name = (document.getElementById('keNameInput').value || '').trim();
      entries[i].date = (document.getElementById('keDateInput').value || '').trim();
      entries[i].note = (document.getElementById('keNoteInput').value || '').trim();
      break;
    }
  }
  saveKpiEntries(entries);
  toast('✅ บันทึกแล้ว');
  closeMForce();
  render();
}

function dropKpiEntry(entryId) {
  if (!confirm('ลบรายการนี้?')) return;
  var entries = getKpiEntries();
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].id === entryId) {
      entries[i].status = 'dropped';
      break;
    }
  }
  saveKpiEntries(entries);
  toast('🗑️ ลบแล้ว');
  render();
}


// ================================================================
// KPI CONFIG MANAGEMENT
// ================================================================
function showAddKpiM() {
  var h = '<div style="max-width:480px">';
  h += '<div class="fm-group"><label>😊 Icon (Emoji)</label>';
  h += '<input type="text" id="kpiIcon" class="fm-input" value="📊" maxlength="4" style="width:80px;font-size:24px;text-align:center"></div>';
  h += '<div class="fm-group"><label>📌 ชื่อ KPI</label>';
  h += '<input type="text" id="kpiName" class="fm-input" placeholder="เช่น หาลูกค้าใหม่"></div>';
  h += '<div class="fm-group"><label>📅 ช่วงเวลา</label>';
  h += '<select id="kpiPeriod" class="fm-input">';
  h += '<option value="weekly">รายสัปดาห์</option>';
  h += '<option value="monthly">รายเดือน</option>';
  h += '<option value="quarterly">รายไตรมาส</option>';
  h += '</select></div>';
  h += '<div class="fm-group"><label>📊 ประเภท</label>';
  h += '<select id="kpiType" class="fm-input" onchange="toggleKpiTypeFields()">';
  h += '<option value="simple">Simple (นับมือ)</option>';
  h += '<option value="funnel">Funnel (มีขั้นตอน)</option>';
  h += '<option value="auto">Auto (นับอัตโนมัติ)</option>';
  h += '</select></div>';

  // Simple/Auto target
  h += '<div id="kpiTargetWrap"><div class="fm-group"><label>🎯 Target</label>';
  h += '<input type="number" id="kpiTarget" class="fm-input" value="1" min="1"></div></div>';

  // Auto source
  h += '<div id="kpiAutoWrap" style="display:none"><div class="fm-group"><label>🔗 นับจาก</label>';
  h += '<select id="kpiAutoSource" class="fm-input">';
  h += '<option value="visit_total">Visit ทั้งหมด</option>';
  h += '<option value="visit_offline">Visit Offline</option>';
  h += '<option value="visit_online">Visit Online</option>';
  h += '<option value="followup">Follow-up</option>';
  h += '<option value="pipeline_win">Pipeline Win</option>';
  h += '<option value="pipeline_new">Pipeline ใหม่</option>';
  h += '</select></div></div>';

  // Funnel steps
  h += '<div id="kpiFunnelWrap" style="display:none">';
  h += '<div class="fm-group"><label>📊 ขั้นตอน (Funnel Steps)</label>';
  h += '<div id="kpiFunnelSteps"></div>';
  h += '<button class="btn-sm bp" onclick="addFunnelStepRow()" style="margin-top:4px">➕ เพิ่มขั้นตอน</button>';
  h += '</div></div>';

  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveNewKpi()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('➕ เพิ่ม KPI ใหม่', h);
}

var funnelStepCounter = 0;

function toggleKpiTypeFields() {
  var type = document.getElementById('kpiType').value;
  document.getElementById('kpiTargetWrap').style.display = (type === 'funnel') ? 'none' : 'block';
  document.getElementById('kpiAutoWrap').style.display = (type === 'auto') ? 'block' : 'none';
  document.getElementById('kpiFunnelWrap').style.display = (type === 'funnel') ? 'block' : 'none';

  if (type === 'funnel' && document.getElementById('kpiFunnelSteps').children.length === 0) {
    addFunnelStepRow();
    addFunnelStepRow();
  }
}

function addFunnelStepRow() {
  funnelStepCounter++;
  var el = document.getElementById('kpiFunnelSteps');
  if (!el) return;
  var row = document.createElement('div');
  row.className = 'funnel-step-row';
  row.id = 'fsr_' + funnelStepCounter;
  row.innerHTML =
    '<input type="text" class="fm-input fs-name" placeholder="ชื่อขั้นตอน" style="flex:1">' +
    '<input type="number" class="fm-input fs-target" placeholder="Target" style="width:70px" min="0" value="1">' +
    '<input type="color" class="fs-color" value="#64b5f6" style="width:36px;height:36px;border:none;cursor:pointer">' +
    '<button class="btn-xs btn-red" onclick="document.getElementById(\'fsr_' + funnelStepCounter + '\').remove()">✕</button>';
  el.appendChild(row);
}

function saveNewKpi() {
  var icon = (document.getElementById('kpiIcon').value || '📊').trim();
  var name = (document.getElementById('kpiName').value || '').trim();
  var period = document.getElementById('kpiPeriod').value;
  var type = document.getElementById('kpiType').value;

  if (!name) { toast('กรุณาใส่ชื่อ KPI'); return; }

  var kpi = {
    id: 'kpi_' + Date.now(),
    name: name,
    icon: icon,
    period: period,
    type: type
  };

  if (type === 'auto') {
    kpi.target = parseInt(document.getElementById('kpiTarget').value) || 1;
    kpi.autoSource = document.getElementById('kpiAutoSource').value;
  } else if (type === 'simple') {
    kpi.target = parseInt(document.getElementById('kpiTarget').value) || 1;
  } else if (type === 'funnel') {
    kpi.steps = [];
    var rows = document.querySelectorAll('.funnel-step-row');
    for (var i = 0; i < rows.length; i++) {
      var sName = rows[i].querySelector('.fs-name').value.trim();
      var sTarget = parseInt(rows[i].querySelector('.fs-target').value) || 0;
      var sColor = rows[i].querySelector('.fs-color').value || '#64b5f6';
      if (sName) {
        kpi.steps.push({ id: 'step_' + Date.now() + '_' + i, name: sName, target: sTarget, color: sColor });
      }
    }
    if (!kpi.steps.length) { toast('กรุณาเพิ่มอย่างน้อย 1 ขั้นตอน'); return; }
  }

  var configs = getKpiConfigs();
  configs.push(kpi);
  saveKpiConfigs(configs);
  toast('✅ เพิ่ม KPI: ' + name);
  closeMForce();
  render();
}

function manageKpiConfigs() {
  var configs = getKpiConfigs();
  var h = '<div style="max-width:500px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<span style="color:var(--text2);font-size:13px">' + configs.length + ' KPIs</span>';
  h += '<div style="display:flex;gap:6px">';
  h += '<button class="btn-sm bp" onclick="showAddKpiM()">➕ เพิ่ม</button>';
  h += '<button class="btn-sm" onclick="resetKpiDefaults()">🔄 Reset</button>';
  h += '</div></div>';

  if (!configs.length) {
    h += '<div style="text-align:center;padding:20px;color:var(--text2)">ยังไม่มี KPI</div>';
  } else {
    configs.forEach(function (k, i) {
      var periodLabel = { weekly: '📅 สัปดาห์', monthly: '📆 เดือน', quarterly: '📊 ไตรมาส' };
      var typeLabel = { simple: 'นับมือ', funnel: 'Funnel', auto: 'Auto' };
      h += '<div class="ltm-item">';
      h += '<div class="ltm-left"><span class="ltm-icon">' + (k.icon || '📊') + '</span>';
      h += '<div><div class="ltm-name">' + sanitize(k.name) + '</div>';
      h += '<div class="ltm-preview">' + (periodLabel[k.period] || '') + ' • ' + (typeLabel[k.type] || '') + '</div>';
      h += '</div></div>';
      h += '<div class="ltm-actions">';
      h += '<button class="btn-xs" onclick="moveKpiConfig(' + i + ',-1)">⬆️</button>';
      h += '<button class="btn-xs" onclick="moveKpiConfig(' + i + ',1)">⬇️</button>';
      h += '<button class="btn-xs btn-red" onclick="deleteKpiConfig(' + i + ')">🗑️</button>';
      h += '</div></div>';
    });
  }

  h += '</div>';
  openM('⚙️ จัดการ KPI', h);
}

function deleteKpiConfig(idx) {
  var configs = getKpiConfigs();
  var name = configs[idx] ? configs[idx].name : '';
  if (!confirm('ลบ KPI "' + name + '"?')) return;
  configs.splice(idx, 1);
  saveKpiConfigs(configs);
  toast('🗑️ ลบแล้ว');
  manageKpiConfigs();
}

function moveKpiConfig(idx, dir) {
  var configs = getKpiConfigs();
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= configs.length) return;
  var tmp = configs[idx];
  configs[idx] = configs[newIdx];
  configs[newIdx] = tmp;
  saveKpiConfigs(configs);
  manageKpiConfigs();
}

function resetKpiDefaults() {
  if (!confirm('⚠️ Reset เป็น KPI เริ่มต้น?')) return;
  localStorage.removeItem('v7_kpiConfig');
  toast('🔄 Reset แล้ว');
  closeMForce();
  render();
}
// ================================================================
// PIPELINE ACTION ITEMS
// ================================================================

function getPipeActions() {
  var saved = localStorage.getItem('v7_pipeActions');
  if (saved) { try { return JSON.parse(saved); } catch (e) {} }
  return [];
}

function savePipeActions(list) {
  localStorage.setItem('v7_pipeActions', JSON.stringify(list));
}

// Get pending actions for a specific pipeline
function getPipeActionsByPipe(pipeId) {
  return getPipeActions().filter(function (a) {
    return a.pipeId === pipeId && a.status !== 'dropped';
  });
}

// Get all pending (not done) actions across all pipelines
function getAllPendingPipeActions() {
  var actions = getPipeActions();
  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
  var now = new Date();
  now.setHours(0, 0, 0, 0);

  var pending = [];
  actions.forEach(function (a) {
    if (a.status !== 'pending') return;
    var pipe = null;
    for (var i = 0; i < pipeline.length; i++) {
      if (pipeline[i].id === a.pipeId) { pipe = pipeline[i]; break; }
    }
    if (!pipe) return;
    if (pipe.status === 'lost' || pipe.status === 'delivered') return;

    var dealer = null;
    for (var j = 0; j < dealers.length; j++) {
      if (dealers[j].id === pipe.dealerId) { dealer = dealers[j]; break; }
    }

    var due = ftParseDate(a.dueDate);
    var daysLeft = due ? Math.ceil((due - now) / 86400000) : 999;
    var urgency = 'normal';
    if (daysLeft < 0) urgency = 'overdue';
    else if (daysLeft <= 2) urgency = 'urgent';
    else if (daysLeft <= 5) urgency = 'soon';

    pending.push({
      action: a,
      pipe: pipe,
      dealer: dealer,
      daysLeft: daysLeft,
      urgency: urgency
    });
  });

  pending.sort(function (a, b) { return a.daysLeft - b.daysLeft; });
  return pending;
}

// Auto-update Next Action + Follow-up Date from action items
function autoUpdatePipeNextAction(pipeId) {
  var actions = getPipeActionsByPipe(pipeId);
  var pending = actions.filter(function (a) { return a.status === 'pending'; });

  if (!pending.length) return;

  // Sort by due date (earliest first)
  pending.sort(function (a, b) {
    var da = ftParseDate(a.dueDate);
    var db = ftParseDate(b.dueDate);
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  var nearest = pending[0];
  var pipe = ST.getOne('pipeline', pipeId);
  if (!pipe) return;

  var updates = {};
  if (nearest.text) updates.nextAction = nearest.text;
  if (nearest.dueDate) updates.followupDate = nearest.dueDate;

  ST.update('pipeline', pipeId, updates);
}


// ================================================================
// MODALS — Action Items
// ================================================================

// Add Action Item (standalone)
function showAddPipeActionM(pipeId) {
  var pipe = ST.getOne('pipeline', pipeId);
  if (!pipe) return;
  var today = _td();

  var h = '<div style="max-width:450px">';
  h += '<div style="padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:12px">';
  h += '<div style="font-weight:600">📊 ' + sanitize(pipe.projectName || pipe.name || '-') + '</div>';
  h += '</div>';

  // Quick actions
  h += '<div class="fm-group"><label>⚡ Quick Action</label>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอเอกสารจากลูกค้า\')">📄 รอเอกสาร</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอลูกค้าตอบ Quote\')">💰 รอตอบ Quote</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอ TOR\')">📋 รอ TOR</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'นัด Demo\')">🎯 นัด Demo</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'ส่ง Spec เพิ่มเติม\')">🚁 ส่ง Spec</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'ติดต่อ DJI\')">📞 ติดต่อ DJI</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'เตรียมเอกสาร Bidding\')">📊 เตรียม Bidding</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'Follow-up ลูกค้า\')">🔄 Follow-up</button>';
  h += '</div></div>';

  h += '<div class="fm-group"><label>📝 สิ่งที่ต้องทำ / ติดตาม</label>';
  h += '<input type="text" id="paText" class="fm-input" placeholder="เช่น รอ TOR จากลูกค้า..."></div>';

  h += '<div class="fm-group"><label>📅 กำหนดวัน</label>';
  h += '<input type="text" id="paDueDate" class="fm-input dp" placeholder="DD/MM/YYYY"></div>';

  h += '<div class="fm-group"><label>🔴 ความเร่งด่วน</label>';
  h += '<select id="paPriority" class="fm-input">';
  h += '<option value="2">ปกติ</option>';
  h += '<option value="1">🔴 เร่งด่วน</option>';
  h += '</select></div>';

  h += '<div class="fm-group"><label>📝 หมายเหตุ (ถ้ามี)</label>';
  h += '<textarea id="paNote" rows="2" class="fm-input" placeholder="รายละเอียดเพิ่มเติม..."></textarea></div>';

  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="savePipeAction(\'' + pipeId + '\')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('➕ Action Item', h);
}

function paQuickFill(text) {
  var el = document.getElementById('paText');
  if (el) el.value = text;
}

function savePipeAction(pipeId) {
  var text = (document.getElementById('paText').value || '').trim();
  var dueDate = (document.getElementById('paDueDate').value || '').trim();
  var priority = parseInt(document.getElementById('paPriority').value) || 2;
  var note = (document.getElementById('paNote').value || '').trim();

  if (!text) { toast('กรุณาใส่สิ่งที่ต้องทำ'); return; }

  var actions = getPipeActions();
  actions.push({
    id: 'pa_' + Date.now(),
    pipeId: pipeId,
    text: text,
    dueDate: dueDate,
    priority: priority,
    note: note,
    status: 'pending',
    createdDate: _td(),
    doneDate: '',
    response: ''
  });
  savePipeActions(actions);

  // Auto update Next Action
  autoUpdatePipeNextAction(pipeId);

  // Also add to pipe log
  ST.add('pipeLog', {
    pipeId: pipeId,
    type: 'action',
    content: '➕ Action Item: ' + text + (dueDate ? ' (กำหนด ' + dueDate + ')' : ''),
    date: _nw()
  });

  toast('✅ เพิ่ม Action Item แล้ว');
  closeMForce();
  render();
}

// Mark action as done
function markPipeActionDone(actionId) {
  var response = prompt('💬 ผลลัพธ์ / ตอบกลับ (ถ้ามี):');
  var actions = getPipeActions();
  var pipeId = '';

  for (var i = 0; i < actions.length; i++) {
    if (actions[i].id === actionId) {
      actions[i].status = 'done';
      actions[i].doneDate = _td();
      if (response) actions[i].response = response;
      pipeId = actions[i].pipeId;

      // Log it
      ST.add('pipeLog', {
        pipeId: pipeId,
        type: 'progress',
        content: '✅ เสร็จ: ' + actions[i].text + (response ? ' — ' + response : ''),
        date: _nw()
      });
      break;
    }
  }
  savePipeActions(actions);

  // Auto update to next pending action
  if (pipeId) autoUpdatePipeNextAction(pipeId);

  toast('✅ เสร็จแล้ว!');
  render();
}

// Extend due date (follow-up again)
function extendPipeAction(actionId) {
  var newDate = prompt('📅 กำหนดใหม่ (DD/MM/YYYY):');
  if (!newDate) return;

  var actions = getPipeActions();
  var pipeId = '';

  for (var i = 0; i < actions.length; i++) {
    if (actions[i].id === actionId) {
      var oldDate = actions[i].dueDate;
      actions[i].dueDate = newDate;
      pipeId = actions[i].pipeId;

      ST.add('pipeLog', {
        pipeId: pipeId,
        type: 'followup',
        content: '🔄 เลื่อนกำหนด: ' + actions[i].text + ' (' + oldDate + ' → ' + newDate + ')',
        date: _nw()
      });
      break;
    }
  }
  savePipeActions(actions);

  if (pipeId) autoUpdatePipeNextAction(pipeId);

  toast('📅 เลื่อนกำหนดแล้ว');
  render();
}

// Drop action
function dropPipeAction(actionId) {
  if (!confirm('ยกเลิก Action Item นี้?')) return;
  var actions = getPipeActions();
  var pipeId = '';

  for (var i = 0; i < actions.length; i++) {
    if (actions[i].id === actionId) {
      actions[i].status = 'dropped';
      pipeId = actions[i].pipeId;
      break;
    }
  }
  savePipeActions(actions);

  if (pipeId) autoUpdatePipeNextAction(pipeId);
  toast('🗑️ ยกเลิกแล้ว');
  render();
}

// Add action from Pipeline Update modal (called after saving log)
function showAddActionAfterLog(pipeId) {
  if (confirm('📋 มี Action Item ที่ต้องติดตามไหม?')) {
    showAddPipeActionM(pipeId);
  }
}


// ================================================================
// RENDER — Action Items in Pipeline Detail
// ================================================================
function buildPipeActionsHTML(pipeId) {
  var actions = getPipeActionsByPipe(pipeId);
  var pending = actions.filter(function (a) { return a.status === 'pending'; });
  var done = actions.filter(function (a) { return a.status === 'done'; });
  var now = new Date();
  now.setHours(0, 0, 0, 0);

  // Sort pending by due date
  pending.sort(function (a, b) {
    var da = ftParseDate(a.dueDate);
    var db = ftParseDate(b.dueDate);
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  var h = '<div class="card"><h2>⏳ Action Items';
  if (pending.length > 0) h += ' <span class="pa-count-badge">' + pending.length + ' ค้าง</span>';
  h += ' <span class="ml"><button class="btn bsm bp" onclick="showAddPipeActionM(\'' + pipeId + '\')">➕</button></span></h2>';

  if (!pending.length && !done.length) {
    h += '<div class="empty"><p>ไม่มี Action Item — กด ➕ เพื่อเพิ่ม</p></div>';
    h += '</div>';
    return h;
  }

  // Pending actions
  if (pending.length) {
    pending.forEach(function (a) {
      var due = ftParseDate(a.dueDate);
      var daysLeft = due ? Math.ceil((due - now) / 86400000) : 999;
      var urgClass = 'pa-normal';
      var urgLabel = '';

      if (daysLeft < 0) {
        urgClass = 'pa-overdue';
        urgLabel = '<span class="pa-urg pa-urg-red">🔴 เกิน ' + Math.abs(daysLeft) + ' วัน</span>';
      } else if (daysLeft === 0) {
        urgClass = 'pa-overdue';
        urgLabel = '<span class="pa-urg pa-urg-red">🔴 วันนี้!</span>';
      } else if (daysLeft <= 2) {
        urgClass = 'pa-urgent';
        urgLabel = '<span class="pa-urg pa-urg-orange">🟠 อีก ' + daysLeft + ' วัน</span>';
      } else if (daysLeft <= 5) {
        urgClass = 'pa-soon';
        urgLabel = '<span class="pa-urg pa-urg-yellow">🟡 อีก ' + daysLeft + ' วัน</span>';
      } else {
        urgLabel = '<span class="pa-urg pa-urg-green">🟢 อีก ' + daysLeft + ' วัน</span>';
      }

      h += '<div class="pa-item ' + urgClass + '">';
      h += '<div class="pa-dot"></div>';
      h += '<div class="pa-content">';
      h += '<div class="pa-header">';
      h += '<span class="pa-text">' + sanitize(a.text) + '</span>';
      h += (a.priority === 1 ? ' <span class="pa-priority">🔴 เร่งด่วน</span>' : '');
      h += '</div>';
      h += '<div class="pa-meta">';
      h += '📅 กำหนด: <strong>' + (a.dueDate || '-') + '</strong> ' + urgLabel;
      h += '</div>';
      if (a.note) h += '<div class="pa-note">' + sanitize(a.note) + '</div>';
      h += '<div class="pa-actions">';
      h += '<button class="btn-xs pa-btn-done" onclick="markPipeActionDone(\'' + a.id + '\')">✅ เสร็จแล้ว</button>';
      h += '<button class="btn-xs pa-btn-extend" onclick="extendPipeAction(\'' + a.id + '\')">📅 เลื่อนกำหนด</button>';
      h += '<button class="btn-xs pa-btn-drop" onclick="dropPipeAction(\'' + a.id + '\')">✕</button>';
      h += '</div>';
      h += '</div></div>';
    });
  }

  // Done actions (collapsible)
  if (done.length) {
    h += '<div class="pa-done-toggle" onclick="togglePaDone()">✅ เสร็จแล้ว (' + done.length + ') <span id="paDoneArrow">▶</span></div>';
    h += '<div class="pa-done-list" id="paDoneList" style="display:none">';
    done.sort(function (a, b) {
      var da = ftParseDate(a.doneDate || a.createdDate);
      var db = ftParseDate(b.doneDate || b.createdDate);
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
    done.forEach(function (a) {
      h += '<div class="pa-item pa-done">';
      h += '<div class="pa-dot pa-dot-done"></div>';
      h += '<div class="pa-content">';
      h += '<div class="pa-text" style="text-decoration:line-through;opacity:0.6">' + sanitize(a.text) + '</div>';
      h += '<div class="pa-meta" style="opacity:0.5">✅ ' + (a.doneDate || '-');
      if (a.response) h += ' — ' + sanitize(a.response);
      h += '</div></div></div>';
    });
    h += '</div>';
  }

  h += '</div>';
  return h;
}

function togglePaDone() {
  var el = document.getElementById('paDoneList');
  var arrow = document.getElementById('paDoneArrow');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (arrow) arrow.textContent = '▼';
  } else {
    el.style.display = 'none';
    if (arrow) arrow.textContent = '▶';
  }
}


// ================================================================
// RENDER — Pending Actions in Today Page
// ================================================================
function renderPendingActionsToday() {
  var pending = getAllPendingPipeActions();
  if (!pending.length) return '';

  var overdue = pending.filter(function (p) { return p.urgency === 'overdue'; });
  var urgent = pending.filter(function (p) { return p.urgency === 'urgent'; });
  var soon = pending.filter(function (p) { return p.urgency === 'soon'; });
  var normal = pending.filter(function (p) { return p.urgency === 'normal'; });

  var h = '<div class="card"><h2>⏳ Pipeline Action Items ';
  if (overdue.length) h += '<span class="pa-count-badge pa-count-red">' + overdue.length + ' เลยกำหนด</span> ';
  h += '<span class="pa-count-badge">' + pending.length + ' ทั้งหมด</span>';
  h += '</h2>';

  function renderGroup(items, title) {
    if (!items.length) return '';
    var gh = '<div class="pa-group-title">' + title + '</div>';
    items.forEach(function (item) {
      var a = item.action;
      var p = item.pipe;
      var d = item.dealer;
      gh += '<div class="pa-today-item" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer">';
      gh += '<div class="pa-today-left">';
      gh += '<div class="pa-today-text">' + sanitize(a.text) + '</div>';
      gh += '<div class="pa-today-meta">📊 ' + sanitize(p.projectName || p.name || '-') + ' • ' + (d ? sanitize(d.name) : '-') + '</div>';
      gh += '</div>';
      gh += '<div class="pa-today-right">';
      gh += '<div class="pa-today-date">' + (a.dueDate || '-') + '</div>';
      if (item.daysLeft < 0) {
        gh += '<div class="pa-today-days" style="color:#ff5252">เกิน ' + Math.abs(item.daysLeft) + ' วัน</div>';
      } else if (item.daysLeft === 0) {
        gh += '<div class="pa-today-days" style="color:#ff5252">วันนี้!</div>';
      } else {
        gh += '<div class="pa-today-days">อีก ' + item.daysLeft + ' วัน</div>';
      }
      gh += '</div>';
      gh += '<button class="btn-xs pa-btn-done" onclick="event.stopPropagation();markPipeActionDone(\'' + a.id + '\')" title="เสร็จแล้ว">✅</button>';
      gh += '</div>';
    });
    return gh;
  }

  h += renderGroup(overdue, '🔴 เลยกำหนด');
  h += renderGroup(urgent, '🟠 เร่งด่วน (1-2 วัน)');
  h += renderGroup(soon, '🟡 ใกล้กำหนด (3-5 วัน)');
  h += renderGroup(normal, '🟢 ยังมีเวลา');

  h += '</div>';
  return h;
}


// ================================================================
// SMART NOTIFICATIONS — Pipeline Actions
// ================================================================
function getPipeActionNotifications() {
  var pending = getAllPendingPipeActions();
  var notifs = [];

  var overdue = pending.filter(function (p) { return p.urgency === 'overdue'; });
  var urgent = pending.filter(function (p) { return p.urgency === 'urgent'; });

  if (overdue.length > 0) {
    notifs.push({
      icon: '🔴',
      type: 'pipeline_action',
      priority: 1,
      text: 'Pipeline Action Item เกินกำหนด ' + overdue.length + ' รายการ: ' +
        overdue.slice(0, 2).map(function (o) { return o.action.text; }).join(', ') +
        (overdue.length > 2 ? '...' : '')
    });
  }

  if (urgent.length > 0) {
    notifs.push({
      icon: '🟠',
      type: 'pipeline_action',
      priority: 1,
      text: 'Pipeline Action ใกล้กำหนด ' + urgent.length + ' รายการ (1-2 วัน)'
    });
  }

  return notifs;
}
// ================================================================
// PIPELINE VALUE STYLING
// ================================================================
function fmtMoneyStyled(amount) {
  var v = parseFloat(amount) || 0;
  var text = fmtMoney(v);
  if (v >= 10000000) {
    return '<span class="val-mega">' + text + ' ฿</span>';
  } else if (v >= 1500000) {
    return '<span class="val-big">' + text + ' ฿</span>';
  }
  return '<span class="val-normal">' + text + ' ฿</span>';
}

function valClass(amount) {
  var v = parseFloat(amount) || 0;
  if (v >= 10000000) return 'val-mega';
  if (v >= 1500000) return 'val-big';
  return 'val-normal';
}
// ================================================================
// TASK — DEALER INTEGRATION
// ================================================================

// Get tasks by dealer
function getTasksByDealer(dealerId) {
  return ST.filter('tasks', function(t) {
    return t.dealerId === dealerId;
  });
}

// Get tasks by pipeline
function getTasksByPipe(pipeId) {
  return ST.filter('tasks', function(t) {
    return t.pipeId === pipeId;
  });
}

// Dealer Tasks Tab
function dealerTasksTab(d) {
  var tasks = getTasksByDealer(d.id);
  var active = tasks.filter(function(t) { return t.status === 'active'; });
  var completed = tasks.filter(function(t) { return t.status === 'completed'; });

  var h = '<div class="card"><h2>📋 งาน (' + active.length + ' active / ' + tasks.length + ' total)';
  h += '<span class="ml">';
  h += '<button class="btn bsm bp" onclick="showTaskM(\'\',\'' + d.id + '\')">➕</button>';
  h += '</span></h2>';

  if (!tasks.length) {
    h += '<div class="empty"><p>ยังไม่มีงาน — กด ➕ เพื่อเพิ่ม</p></div>';
    h += '</div>';
    return h;
  }

  // Active tasks
  if (active.length) {
    active.forEach(function(t, idx) {
      var pipe = t.pipeId ? ST.getOne('pipeline', t.pipeId) : null;
      var pg = typeof prog === 'function' ? prog(t) : 0;
      h += '<div class="li ' + dlC(t.dueDate, false) + '" onclick="go(\'taskDetail\',{taskId:\'' + t.id + '\'})">';
      h += '<div class="lm">';
      h += '<div class="lt">' + sanitize(t.title) + ' ' + sTag(t.status) + ' ' + pTag(t.priority);
      if (t.sequential) h += ' <span class="tag tag-count">⚡</span>';
      h += '</div>';
      h += '<div class="ls">';
      if (t.category) h += '📂 ' + t.category + ' • ';
      if (pipe) h += '📊 ' + sanitize(pipe.projectName || '') + ' • ';
      h += fD(t.dueDate) + ' ' + dlB(t.dueDate, false);
      h += '</div>';
      if (t.steps && t.steps.length) {
        h += '<div class="pb"><div class="pf pf-blue" style="width:' + pg + '%"></div></div>';
        h += '<div class="ls">' + pg + '%</div>';
      }
      h += '</div></div>';
    });
  }

  // Completed tasks (collapsible)
  if (completed.length) {
    h += '<div class="pa-done-toggle" onclick="toggleDealerDoneTasks()">✅ เสร็จแล้ว (' + completed.length + ') <span id="ddtArrow">▶</span></div>';
    h += '<div id="ddtList" style="display:none">';
    completed.forEach(function(t) {
      h += '<div class="li dlo" onclick="go(\'taskDetail\',{taskId:\'' + t.id + '\'})">';
      h += '<div class="lm"><div class="lt" style="text-decoration:line-through;opacity:0.6">' + sanitize(t.title) + '</div>';
      h += '<div class="ls">' + fD(t.dueDate) + '</div></div></div>';
    });
    h += '</div>';
  }

  h += '</div>';
  return h;
}

function toggleDealerDoneTasks() {
  var el = document.getElementById('ddtList');
  var arrow = document.getElementById('ddtArrow');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (arrow) arrow.textContent = '▼';
  } else {
    el.style.display = 'none';
    if (arrow) arrow.textContent = '▶';
  }
}
// ================================================================
// FEATURE: QUICK DAILY LOG
// ================================================================
var dailyLogDate = '';

function getDailyLogs() {
  var saved = localStorage.getItem('v7_dailylog');
  if (saved) { try { return JSON.parse(saved); } catch(e) {} }
  return [];
}

function saveDailyLogs(list) {
  localStorage.setItem('v7_dailylog', JSON.stringify(list));
}

function getDailyLogByDate(date) {
  var logs = getDailyLogs();
  for (var i = 0; i < logs.length; i++) {
    if (logs[i].date === date) return logs[i];
  }
  return null;
}

function rDailyLog(el) {
  document.getElementById('pgT').textContent = '📝 Daily Log';
  if (!dailyLogDate) dailyLogDate = _td();
  var log = getDailyLogByDate(dailyLogDate);

  var h = '';

  // Date selector
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">';
  h += '<button class="btn bsm bo" onclick="dlNavDay(-1)">◀</button>';
  h += '<input type="text" id="dlDatePick" value="' + dailyLogDate + '" class="fm-input dp" style="width:120px;text-align:center" onchange="dailyLogDate=this.value;render()">';
  h += '<button class="btn bsm bo" onclick="dlNavDay(1)">▶</button>';
  h += '<button class="btn bsm ' + (dailyLogDate === _td() ? 'bp' : 'bo') + '" onclick="dailyLogDate=_td();render()">วันนี้</button>';
  h += '<div style="flex:1"></div>';
  h += '<button class="btn bp" onclick="showDailyLogM()">✏️ แก้ไข</button>';
  h += '<button class="btn bo" onclick="copyDailyLog()">📋 Copy</button>';
  h += '</div>';

  if (!log) {
    h += '<div class="card" style="text-align:center;padding:30px">';
    h += '<div style="font-size:48px;margin-bottom:10px">📝</div>';
    h += '<p>ยังไม่มีบันทึกวันนี้</p>';
    h += '<button class="btn bp" onclick="showDailyLogM()">✏️ เริ่มบันทึก</button>';
    h += '</div>';
    el.innerHTML = h;
    return;
  }

  // Today's activities
  h += '<div class="card"><h2>✅ สิ่งที่ทำวันนี้ (' + (log.items ? log.items.length : 0) + ')</h2>';
  if (log.items && log.items.length) {
    log.items.forEach(function(item, idx) {
      var icon = item.type === 'call' ? '📞' : item.type === 'visit' ? '📍' : item.type === 'email' ? '📧' : item.type === 'meeting' ? '📅' : '📝';
      h += '<div class="dl-item' + (item.done ? ' dl-done' : '') + '">';
      h += '<div class="dl-check ' + (item.done ? 'dl-checked' : '') + '" onclick="toggleDLItem(\'' + dailyLogDate + '\',' + idx + ')"></div>';
      h += '<span class="dl-icon">' + icon + '</span>';
      h += '<span class="dl-text' + (item.done ? ' dl-text-done' : '') + '">' + sanitize(item.text) + '</span>';
      h += '</div>';
    });
  } else {
    h += '<div class="empty"><p>ยังไม่มีรายการ</p></div>';
  }
  h += '</div>';

  // Tomorrow
  if (log.tomorrow && log.tomorrow.length) {
    h += '<div class="card"><h2>📌 สิ่งที่ต้องทำพรุ่งนี้</h2>';
    log.tomorrow.forEach(function(item) {
      h += '<div class="dl-item"><span class="dl-icon">▸</span><span class="dl-text">' + sanitize(item.text || item) + '</span></div>';
    });
    h += '</div>';
  }

  // Notes
  if (log.notes) {
    h += '<div class="card"><h2>📝 หมายเหตุ</h2>';
    h += '<div style="white-space:pre-wrap;font-size:13px">' + sanitize(log.notes) + '</div>';
    h += '</div>';
  }

  el.innerHTML = h;
}

function dlNavDay(dir) {
  var parts = dailyLogDate.split('/');
  var d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  d.setDate(d.getDate() + dir);
  dailyLogDate = fmtDateKey(d);
  render();
}

function toggleDLItem(date, idx) {
  var logs = getDailyLogs();
  for (var i = 0; i < logs.length; i++) {
    if (logs[i].date === date && logs[i].items && logs[i].items[idx] !== undefined) {
      logs[i].items[idx].done = !logs[i].items[idx].done;
      break;
    }
  }
  saveDailyLogs(logs);
  render();
}

function showDailyLogM() {
  var date = dailyLogDate || _td();
  var log = getDailyLogByDate(date) || {date: date, items: [], tomorrow: [], notes: ''};

  var itemsText = (log.items || []).map(function(it) {
    return (it.type ? '[' + it.type + '] ' : '') + it.text;
  }).join('\n');
  var tomorrowText = (log.tomorrow || []).map(function(it) {
    return typeof it === 'string' ? it : it.text;
  }).join('\n');

  var h = '<div style="max-width:500px">';
  h += '<div style="padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:12px;text-align:center;font-weight:600">📝 ' + date + '</div>';

  // Quick add buttons
  h += '<div class="fm-group"><label>⚡ Quick Add</label>';
  h += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">';
  h += '<button class="btn-sm" onclick="dlQuickAdd(\'📞 โทร...\',\'call\')">📞 โทร</button>';
  h += '<button class="btn-sm" onclick="dlQuickAdd(\'📍 Visit...\',\'visit\')">📍 Visit</button>';
  h += '<button class="btn-sm" onclick="dlQuickAdd(\'📧 ส่ง Email...\',\'email\')">📧 Email</button>';
  h += '<button class="btn-sm" onclick="dlQuickAdd(\'📅 ประชุม...\',\'meeting\')">📅 ประชุม</button>';
  h += '<button class="btn-sm" onclick="dlQuickAdd(\'📝 ...\',\'note\')">📝 อื่นๆ</button>';
  h += '</div></div>';

  h += '<div class="fm-group"><label>✅ สิ่งที่ทำวันนี้ (บรรทัดละ 1 รายการ)</label>';
  h += '<textarea id="dl_items" rows="6" class="fm-input" placeholder="โทร Poladrone เรื่อง M400\nส่ง Quote B Innovation\nประชุม DJI เรื่อง Pricing...">' + sanitize(itemsText) + '</textarea></div>';

  h += '<div class="fm-group"><label>📌 สิ่งที่ต้องทำพรุ่งนี้ (บรรทัดละ 1)</label>';
  h += '<textarea id="dl_tomorrow" rows="4" class="fm-input" placeholder="Follow-up VSK เรื่อง TOR\nเตรียมเอกสาร Bidding...">' + sanitize(tomorrowText) + '</textarea></div>';

  h += '<div class="fm-group"><label>📝 หมายเหตุ</label>';
  h += '<textarea id="dl_notes" rows="3" class="fm-input" placeholder="โน้ตเพิ่มเติม...">' + sanitize(log.notes || '') + '</textarea></div>';

  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveDailyLog(\'' + date + '\')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('📝 Daily Log — ' + date, h);
}

function dlQuickAdd(text, type) {
  var el = document.getElementById('dl_items');
  if (!el) return;
  var prefix = type === 'call' ? '[call] ' : type === 'visit' ? '[visit] ' : type === 'email' ? '[email] ' : type === 'meeting' ? '[meeting] ' : '';
  if (el.value && el.value.trim()) el.value += '\n';
  el.value += prefix;
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
}

function saveDailyLog(date) {
  var itemsRaw = (document.getElementById('dl_items').value || '').trim();
  var tomorrowRaw = (document.getElementById('dl_tomorrow').value || '').trim();
  var notes = (document.getElementById('dl_notes').value || '').trim();

  var items = itemsRaw ? itemsRaw.split('\n').filter(function(s) { return s.trim(); }).map(function(s) {
    var text = s.trim();
    var type = 'note';
    if (text.indexOf('[call]') === 0) { type = 'call'; text = text.replace('[call]', '').trim(); }
    else if (text.indexOf('[visit]') === 0) { type = 'visit'; text = text.replace('[visit]', '').trim(); }
    else if (text.indexOf('[email]') === 0) { type = 'email'; text = text.replace('[email]', '').trim(); }
    else if (text.indexOf('[meeting]') === 0) { type = 'meeting'; text = text.replace('[meeting]', '').trim(); }
    return {text: text, type: type, done: false};
  }) : [];

  var tomorrow = tomorrowRaw ? tomorrowRaw.split('\n').filter(function(s) { return s.trim(); }).map(function(s) {
    return {text: s.trim()};
  }) : [];

  // Preserve done status from existing items
  var existing = getDailyLogByDate(date);
  if (existing && existing.items) {
    items.forEach(function(newItem, idx) {
      if (existing.items[idx] && existing.items[idx].text === newItem.text) {
        newItem.done = existing.items[idx].done;
      }
    });
  }

  var logs = getDailyLogs();
  var found = false;
  for (var i = 0; i < logs.length; i++) {
    if (logs[i].date === date) {
      logs[i].items = items;
      logs[i].tomorrow = tomorrow;
      logs[i].notes = notes;
      found = true;
      break;
    }
  }
  if (!found) {
    logs.push({id: 'dl_' + Date.now(), date: date, items: items, tomorrow: tomorrow, notes: notes});
  }

  saveDailyLogs(logs);
  toast('💾 บันทึก Daily Log แล้ว');
  closeMForce();
  render();
}

function copyDailyLog() {
  var log = getDailyLogByDate(dailyLogDate);
  if (!log) { toast('ไม่มีข้อมูล'); return; }

  var t = '📝 Daily Log — ' + log.date + '\n';
  t += '━━━━━━━━━━━━━━━━━━━━\n';
  t += '👤 Siwawong — SIS Distribution (DJI)\n\n';

  if (log.items && log.items.length) {
    t += '✅ สิ่งที่ทำวันนี้:\n';
    log.items.forEach(function(it) {
      t += (it.done ? '☑️' : '☐') + ' ' + it.text + '\n';
    });
    t += '\n';
  }

  if (log.tomorrow && log.tomorrow.length) {
    t += '📌 สิ่งที่ต้องทำพรุ่งนี้:\n';
    log.tomorrow.forEach(function(it) {
      t += '• ' + (it.text || it) + '\n';
    });
    t += '\n';
  }

  if (log.notes) t += '📝 หมายเหตุ:\n' + log.notes + '\n';

  copyText(t);
  toast('📋 Copy Daily Log แล้ว!');
}


// ================================================================
// SMART DAILY BRIEFING (Auto from all sources)
// ================================================================
function renderDailyBriefing() {
  var now = new Date();
  var today = _td();
  var dow = now.getDay();
  var dayNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

  var h = '<div class="briefing-card">';
  h += '<div class="briefing-header">';
  h += '<div class="briefing-greeting">☀️ สวัสดีครับ Siwawong!</div>';
  h += '<div class="briefing-date">วัน' + dayNames[dow] + ' ' + today + '</div>';
  h += '</div>';

  var sections = [];
  var todayActivities = [];

  // ============================================================
  // 1. URGENT — ด่วนวันนี้
  // ============================================================
  var urgentItems = [];

  // Pipeline Actions overdue + today
  var pendingActions = getAllPendingPipeActions();
  var overdueActions = pendingActions.filter(function(p) { return p.urgency === 'overdue'; });
  var todayActions = pendingActions.filter(function(p) { return p.daysLeft === 0; });

  overdueActions.forEach(function(item) {
    urgentItems.push({icon: '🔴', text: sanitize(item.action.text) + ' — ' + sanitize(item.pipe.projectName || ''), type: 'action'});
  });
  todayActions.forEach(function(item) {
    urgentItems.push({icon: '🟠', text: sanitize(item.action.text) + ' — ' + sanitize(item.pipe.projectName || ''), type: 'action'});
  });

  // Task Follow-ups overdue
  var overdueFu = [];
  try { overdueFu = getAllOverdueFu(); } catch(e) {}
  overdueFu.forEach(function(o) {
    urgentItems.push({icon: '📞', text: sanitize(o.stepTitle) + ' — ' + sanitize(o.taskTitle), type: 'followup'});
  });

  // Tasks due today
  var tasksDueToday = ST.filter('tasks', function(t) { return t.status === 'active' && t.dueDate === today; });
  tasksDueToday.forEach(function(t) {
    urgentItems.push({icon: '📋', text: sanitize(t.title), type: 'task'});
  });

  // Follow-ups due today
  var followups = JSON.parse(localStorage.getItem('v7_followups') || '[]');
  var todayFU = followups.filter(function(f) {
    return (f.date === today || f.dueDate === today) && f.status !== 'done';
  });
  todayFU.forEach(function(f) {
    var dd = f.dealerId ? ST.getOne('dealers', f.dealerId) : null;
    urgentItems.push({icon: '📞', text: (dd ? sanitize(dd.name) + ' — ' : '') + sanitize(f.content || f.note || ''), type: 'followup'});
  });

  if (urgentItems.length > 0) {
    var su = '<div class="briefing-section briefing-urgent">';
    su += '<div class="briefing-section-title">🔴 ต้องทำวันนี้ (' + urgentItems.length + ')</div>';
    urgentItems.slice(0, 8).forEach(function(item) {
      su += '<div class="briefing-item">' + item.icon + ' ' + item.text + '</div>';
    });
    su += '</div>';
    sections.push(su);
  }

  // ============================================================
  // 2. MEETINGS — ประชุมวันนี้
  // ============================================================
  var meetings = [];
  try { meetings = ST.filter('meetings', function(m) { return m.date === today; }); } catch(e) {}
  if (meetings.length > 0) {
    var sm = '<div class="briefing-section">';
    sm += '<div class="briefing-section-title">📅 ประชุมวันนี้ (' + meetings.length + ')</div>';
    meetings.forEach(function(m) {
      sm += '<div class="briefing-item">📅 ' + (m.time || '') + ' ' + sanitize(m.title || '') + '</div>';
    });
    sm += '</div>';
    sections.push(sm);
  }

  // ============================================================
  // 3. TODAY'S ACTIVITIES (Auto from system)
  // ============================================================
  
  // Visits today
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var todayVisits = visits.filter(function(v) { return v.date === today; });
  todayVisits.forEach(function(v) {
    var dd = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
    todayActivities.push({icon: '📍', text: 'Visit ' + (dd ? sanitize(dd.name) : '-') + ' (' + (v.mode || '-') + ')', time: v.time || '', type: 'visit'});
  });

  // Pipeline logs today
  var pipeLogs = JSON.parse(localStorage.getItem('v7_pipelog') || '[]');
  var todayPipeLogs = pipeLogs.filter(function(l) {
    return l.date && l.date.split('T')[0] === today.split('/').reverse().join('-');
  });
  // Also check DD/MM/YYYY format
  todayPipeLogs = todayPipeLogs.concat(pipeLogs.filter(function(l) {
    if (!l.date) return false;
    var d = l.date.split('T')[0];
    if (d === today) return true;
    return false;
  }));
  // Deduplicate
  var pipeLogIds = {};
  todayPipeLogs = todayPipeLogs.filter(function(l) {
    if (pipeLogIds[l.id]) return false;
    pipeLogIds[l.id] = true;
    return true;
  });

  todayPipeLogs.forEach(function(l) {
    var pipe = l.pipeId ? ST.getOne('pipeline', l.pipeId) : null;
    todayActivities.push({icon: '📊', text: (pipe ? sanitize((pipe.projectName || '').substr(0, 25)) + ' — ' : '') + sanitize((l.content || '').substr(0, 40)), time: l.date ? l.date.split('T')[1] || '' : '', type: 'pipeline'});
  });

  // Task logs today
  var taskLogs = JSON.parse(localStorage.getItem('v7_tasklogs') || '[]');
  var todayTaskLogs = taskLogs.filter(function(l) {
    if (!l.date) return false;
    var d = l.date.split('T')[0];
    return d === today;
  });
  todayTaskLogs.forEach(function(l) {
    var task = l.tid ? ST.getOne('tasks', l.tid) : null;
    todayActivities.push({icon: '📋', text: (task ? sanitize((task.title || '').substr(0, 25)) + ' — ' : '') + sanitize((l.content || '').substr(0, 40)), time: l.date ? l.date.split('T')[1] || '' : '', type: 'task'});
  });

  // Follow-ups done today
  var doneFU = followups.filter(function(f) { return f.date === today && f.status === 'done'; });
  doneFU.forEach(function(f) {
    var dd = f.dealerId ? ST.getOne('dealers', f.dealerId) : null;
    todayActivities.push({icon: '📞', text: 'Follow-up ' + (dd ? sanitize(dd.name) : '') + ' — ' + sanitize(f.content || f.note || ''), time: '', type: 'followup'});
  });

  // Sort by time
  todayActivities.sort(function(a, b) { return (a.time || '').localeCompare(b.time || ''); });

  if (todayActivities.length > 0) {
    var sa = '<div class="briefing-section">';
    sa += '<div class="briefing-section-title">✅ กิจกรรมวันนี้ (' + todayActivities.length + ')</div>';
    todayActivities.forEach(function(act) {
      sa += '<div class="briefing-item">' + act.icon + ' ';
      if (act.time) sa += '<span style="color:var(--accent);font-size:11px">' + act.time.substr(0, 5) + '</span> ';
      sa += act.text + '</div>';
    });
    sa += '</div>';
    sections.push(sa);
  }

  // ============================================================
  // 4. UPCOMING (Next 3 days)
  // ============================================================
  var upcomingActions = pendingActions.filter(function(p) { return p.daysLeft > 0 && p.daysLeft <= 3; });
  if (upcomingActions.length > 0) {
    var sup = '<div class="briefing-section">';
    sup += '<div class="briefing-section-title">📌 ใกล้กำหนด (3 วัน)</div>';
    upcomingActions.slice(0, 5).forEach(function(item) {
      sup += '<div class="briefing-item">🟡 ' + sanitize(item.action.text) + ' — ' + sanitize(item.pipe.projectName || '') + ' <span style="font-size:10px;color:var(--text2)">(อีก ' + item.daysLeft + ' วัน)</span></div>';
    });
    sup += '</div>';
    sections.push(sup);
  }

  // ============================================================
  // 5. DAY-OF-WEEK ROUTINES
  // ============================================================
  if (dow === 1) {
    sections.push('<div class="briefing-section"><div class="briefing-section-title">📊 วันจันทร์</div><div class="briefing-item">• วางแผน Visit สัปดาห์นี้</div><div class="briefing-item">• เช็ค Pipeline ที่ต้อง Update</div></div>');
  }
  if (dow === 5) {
    sections.push('<div class="briefing-section"><div class="briefing-section-title">📊 วันศุกร์</div><div class="briefing-item">• สรุป Weekly Report</div><div class="briefing-item">• Export Backup ข้อมูล</div><div class="briefing-item">• วางแผนสัปดาห์หน้า</div></div>');
  }

  // ============================================================
  // STATS BAR
  // ============================================================
  var allPipes = ST.getAll('pipeline');
  var activePipes = allPipes.filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
  var activeAmt = 0;
  activePipes.forEach(function(p) { activeAmt += (Number(p.forecastAmount) || 0); });

  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  var weekVisits = visits.filter(function(v) {
    var vd = ftParseDate(v.date);
    return vd && vd >= weekStart;
  });

  var statsHtml = '<div class="briefing-stats">';
  statsHtml += '<div class="briefing-stat"><div class="briefing-stat-val">' + activePipes.length + '</div><div class="briefing-stat-label">Pipeline</div></div>';
  statsHtml += '<div class="briefing-stat"><div class="briefing-stat-val">' + fmtMoneyShort(activeAmt) + '</div><div class="briefing-stat-label">Forecast</div></div>';
  statsHtml += '<div class="briefing-stat"><div class="briefing-stat-val">' + weekVisits.length + '</div><div class="briefing-stat-label">Visit/Wk</div></div>';
  statsHtml += '<div class="briefing-stat"><div class="briefing-stat-val">' + pendingActions.length + '</div><div class="briefing-stat-label">Action</div></div>';
  statsHtml += '</div>';

  // ============================================================
  // RENDER
  // ============================================================
  if (sections.length === 0) {
    h += '<div class="briefing-clear">✅ ไม่มีเรื่องด่วน — วันนี้เปิดโล่ง!</div>';
  } else {
    h += sections.join('');
  }

  h += statsHtml;

  // Quick links + Copy
  h += '<div class="briefing-links">';
  h += '<button class="btn bsm bp" onclick="copyDailyBriefing()">📋 Copy สรุปวันนี้</button>';
  h += '<button class="btn bsm bo" onclick="go(\'pipeline\')">📊 Pipeline</button>';
  h += '<button class="btn bsm bo" onclick="go(\'tasks\')">📋 Tasks</button>';
  h += '<button class="btn bsm bo" onclick="go(\'forecast\')">📦 Forecast</button>';
  h += '</div>';

  h += '</div>';
  return h;
}

// ============================================================
// COPY DAILY BRIEFING
// ============================================================
function copyDailyBriefing() {
  var now = new Date();
  var today = _td();
  var dow = now.getDay();
  var dayNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

  var t = '📊 Daily Summary — วัน' + dayNames[dow] + ' ' + today + '\n';
  t += '👤 Siwawong — SIS Distribution (DJI Enterprise)\n';
  t += '━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // Visits today
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var todayVisits = visits.filter(function(v) { return v.date === today; });
  if (todayVisits.length) {
    t += '📍 Visit (' + todayVisits.length + '):\n';
    todayVisits.forEach(function(v) {
      var dd = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
      t += '• ' + (dd ? dd.name : '-') + ' (' + (v.mode || '-') + ')\n';
    });
    t += '\n';
  }

  // Pipeline updates today
  var pipeLogs = JSON.parse(localStorage.getItem('v7_pipelog') || '[]');
  var todayPL = pipeLogs.filter(function(l) {
    return l.date && (l.date.split('T')[0] === today || l.date.indexOf(today) === 0);
  });
  if (todayPL.length) {
    t += '📊 Pipeline Update (' + todayPL.length + '):\n';
    todayPL.forEach(function(l) {
      var pipe = l.pipeId ? ST.getOne('pipeline', l.pipeId) : null;
      t += '• ' + (pipe ? (pipe.projectName || '').substr(0, 30) : '-') + ' — ' + (l.content || '').substr(0, 50) + '\n';
    });
    t += '\n';
  }

  // Follow-ups
  var followups = JSON.parse(localStorage.getItem('v7_followups') || '[]');
  var todayFU = followups.filter(function(f) { return f.date === today; });
  if (todayFU.length) {
    t += '📞 Follow-up (' + todayFU.length + '):\n';
    todayFU.forEach(function(f) {
      var dd = f.dealerId ? ST.getOne('dealers', f.dealerId) : null;
      t += '• ' + (dd ? dd.name : '-') + ' — ' + (f.content || f.note || '').substr(0, 50) + '\n';
    });
    t += '\n';
  }

  // Pending actions
  var pendingActions = getAllPendingPipeActions();
  var overdueActions = pendingActions.filter(function(p) { return p.urgency === 'overdue' || p.daysLeft === 0; });
  if (overdueActions.length) {
    t += '🔴 Action ด่วน (' + overdueActions.length + '):\n';
    overdueActions.forEach(function(item) {
      t += '• ' + item.action.text + ' — ' + (item.pipe.projectName || '') + '\n';
    });
    t += '\n';
  }

  // Stats
  var allPipes = ST.getAll('pipeline');
  var activePipes = allPipes.filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
  var activeAmt = 0;
  activePipes.forEach(function(p) { activeAmt += (Number(p.forecastAmount) || 0); });

  t += '━━━━━━━━━━━━━━━━━━━━━━━━\n';
  t += '📊 Pipeline: ' + activePipes.length + ' active • ฿' + fmtMoney(activeAmt) + '\n';
  t += '⏳ Action ค้าง: ' + pendingActions.length + ' รายการ\n';

  copyText(t);
  toast('📋 Copy สรุปวันนี้แล้ว! ส่งหัวหน้าได้เลย');
}

// ================================================================
// FEATURE: CONTACT MANAGEMENT
// ================================================================
function getDealerContacts(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  return (d && d.contacts) ? d.contacts : [];
}

function showAddContactM(dealerId) {
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>👤 ชื่อ *</label><input type="text" id="ct_name" class="fm-input" placeholder="เช่น คุณสมชาย"></div>';
  h += '<div class="fm-group"><label>💼 ตำแหน่ง/บทบาท</label><input type="text" id="ct_role" class="fm-input" placeholder="เช่น MD, Purchase, Technical"></div>';
  h += '<div class="fr">';
  h += '<div class="fm-group"><label>📞 เบอร์โทร</label><input type="tel" id="ct_phone" class="fm-input" placeholder="081-xxx-xxxx"></div>';
  h += '<div class="fm-group"><label>💬 LINE ID</label><input type="text" id="ct_line" class="fm-input" placeholder="LINE ID"></div>';
  h += '</div>';
  h += '<div class="fm-group"><label>📧 Email</label><input type="email" id="ct_email" class="fm-input" placeholder="email@company.com"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="ct_note" rows="2" class="fm-input" placeholder="เช่น ติดต่อเรื่อง Technical ได้ดี"></textarea></div>';
  h += '<div class="fm-group"><label>⭐ ผู้ติดต่อหลัก</label><div class="radio-g"><label><input type="radio" name="ct_primary" value="1"><span>ใช่</span></label><label><input type="radio" name="ct_primary" value="0" checked><span>ไม่</span></label></div></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveContact(\'' + dealerId + '\')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('➕ เพิ่มผู้ติดต่อ', h);
}

function saveContact(dealerId) {
  var name = (document.getElementById('ct_name').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }

  var contact = {
    id: 'ct_' + Date.now(),
    name: name,
    role: (document.getElementById('ct_role').value || '').trim(),
    phone: (document.getElementById('ct_phone').value || '').trim(),
    line: (document.getElementById('ct_line').value || '').trim(),
    email: (document.getElementById('ct_email').value || '').trim(),
    note: (document.getElementById('ct_note').value || '').trim(),
    primary: document.querySelector('input[name="ct_primary"]:checked') ? document.querySelector('input[name="ct_primary"]:checked').value === '1' : false
  };

  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  if (!d.contacts) d.contacts = [];
  d.contacts.push(contact);
  ST.update('dealers', dealerId, {contacts: d.contacts});
  toast('✅ เพิ่มผู้ติดต่อ: ' + name);
  closeMForce();
  render();
}

function showEditContactM(dealerId, ctIdx) {
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.contacts || !d.contacts[ctIdx]) return;
  var c = d.contacts[ctIdx];

  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>👤 ชื่อ *</label><input type="text" id="ct_name" class="fm-input" value="' + sanitize(c.name || '') + '"></div>';
  h += '<div class="fm-group"><label>💼 ตำแหน่ง/บทบาท</label><input type="text" id="ct_role" class="fm-input" value="' + sanitize(c.role || '') + '"></div>';
  h += '<div class="fr">';
  h += '<div class="fm-group"><label>📞 เบอร์โทร</label><input type="tel" id="ct_phone" class="fm-input" value="' + sanitize(c.phone || '') + '"></div>';
  h += '<div class="fm-group"><label>💬 LINE ID</label><input type="text" id="ct_line" class="fm-input" value="' + sanitize(c.line || '') + '"></div>';
  h += '</div>';
  h += '<div class="fm-group"><label>📧 Email</label><input type="email" id="ct_email" class="fm-input" value="' + sanitize(c.email || '') + '"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="ct_note" rows="2" class="fm-input">' + sanitize(c.note || '') + '</textarea></div>';
  h += '<div class="fm-group"><label>⭐ ผู้ติดต่อหลัก</label><div class="radio-g"><label><input type="radio" name="ct_primary" value="1"' + (c.primary ? ' checked' : '') + '><span>ใช่</span></label><label><input type="radio" name="ct_primary" value="0"' + (!c.primary ? ' checked' : '') + '><span>ไม่</span></label></div></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="updateContact(\'' + dealerId + '\',' + ctIdx + ')">💾 บันทึก</button>';
  h += '<button class="btn bd" onclick="deleteContact(\'' + dealerId + '\',' + ctIdx + ')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('✏️ แก้ไขผู้ติดต่อ', h);
}

function updateContact(dealerId, ctIdx) {
  var name = (document.getElementById('ct_name').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }

  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.contacts || !d.contacts[ctIdx]) return;

  d.contacts[ctIdx].name = name;
  d.contacts[ctIdx].role = (document.getElementById('ct_role').value || '').trim();
  d.contacts[ctIdx].phone = (document.getElementById('ct_phone').value || '').trim();
  d.contacts[ctIdx].line = (document.getElementById('ct_line').value || '').trim();
  d.contacts[ctIdx].email = (document.getElementById('ct_email').value || '').trim();
  d.contacts[ctIdx].note = (document.getElementById('ct_note').value || '').trim();
  d.contacts[ctIdx].primary = document.querySelector('input[name="ct_primary"]:checked') ? document.querySelector('input[name="ct_primary"]:checked').value === '1' : false;

  ST.update('dealers', dealerId, {contacts: d.contacts});
  toast('💾 บันทึกแล้ว');
  closeMForce();
  render();
}

function deleteContact(dealerId, ctIdx) {
  if (!confirm('ลบผู้ติดต่อนี้?')) return;
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.contacts) return;
  d.contacts.splice(ctIdx, 1);
  ST.update('dealers', dealerId, {contacts: d.contacts});
  toast('🗑️ ลบแล้ว');
  closeMForce();
  render();
}

function renderDealerContacts(d) {
  var contacts = d.contacts || [];

  var h = '<div class="card"><h2>📞 ผู้ติดต่อ (' + contacts.length + ')';
  h += '<span class="ml"><button class="btn bsm bp" onclick="showAddContactM(\'' + d.id + '\')">➕</button></span></h2>';

  if (!contacts.length) {
    h += '<div class="empty"><p>ยังไม่มีผู้ติดต่อ — กด ➕ เพื่อเพิ่ม</p></div>';
    h += '</div>';
    return h;
  }

  contacts.forEach(function(c, idx) {
    h += '<div class="contact-card' + (c.primary ? ' contact-primary' : '') + '">';
    h += '<div class="contact-header">';
    h += '<div class="contact-name">' + (c.primary ? '⭐ ' : '') + sanitize(c.name) + '</div>';
    if (c.role) h += '<div class="contact-role">' + sanitize(c.role) + '</div>';
    h += '<button class="btn-xs" onclick="showEditContactM(\'' + d.id + '\',' + idx + ')">✏️</button>';
    h += '</div>';

    h += '<div class="contact-actions">';
    if (c.phone) h += '<a href="tel:' + c.phone + '" class="contact-btn" onclick="event.stopPropagation()">📞 ' + sanitize(c.phone) + '</a>';
    if (c.line) h += '<span class="contact-btn">💬 ' + sanitize(c.line) + '</span>';
    if (c.email) h += '<a href="mailto:' + c.email + '" class="contact-btn" onclick="event.stopPropagation()">📧 ' + sanitize(c.email) + '</a>';
    h += '</div>';

    if (c.note) h += '<div class="contact-note">' + sanitize(c.note) + '</div>';
    h += '</div>';
  });

  h += '</div>';
  return h;
}
// ================================================================
// TIMELINE — สิ่งที่ต้องทำ (Today Page)
// ================================================================
function renderUpcomingTimeline() {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  var today = _td();

  // Collect all items with due dates
  var allItems = [];

  // 1. Tasks
  var tasks = ST.getAll('tasks');
  tasks.forEach(function(t) {
    if (t.status === 'completed') return;
    if (t.dueDate) {
      var d = ftParseDate(t.dueDate);
      if (d) {
        var dd = t.dealerId ? ST.getOne('dealers', t.dealerId) : null;
        allItems.push({
          date: t.dueDate,
          dateObj: d,
          icon: '📋',
          text: sanitize(t.title),
          sub: (dd ? '🏪 ' + sanitize(dd.name) + ' • ' : '') + (t.category ? '📂 ' + t.category : ''),
          type: 'task',
          link: "go('taskDetail',{taskId:'" + t.id + "'})"
        });
      }
    }
    // Steps with due dates
    if (t.steps && t.steps.length) {
      t.steps.forEach(function(s) {
        if (s.done) return;
        if (s.dueDate) {
          var sd = ftParseDate(s.dueDate);
          if (sd) {
            allItems.push({
              date: s.dueDate,
              dateObj: sd,
              icon: '✅',
              text: sanitize(s.title),
              sub: '📋 ' + sanitize(t.title),
              type: 'step',
              link: "go('taskDetail',{taskId:'" + t.id + "'})"
            });
          }
        }
      });
    }
  });

  // 2. Pipeline Actions
  var pipeActions = getPipeActions();
  pipeActions.forEach(function(a) {
    if (a.status !== 'pending') return;
    if (!a.dueDate) return;
    var d = ftParseDate(a.dueDate);
    if (!d) return;
    var pipe = ST.getOne('pipeline', a.pipeId);
    if (!pipe) return;
    if (pipe.status === 'lost' || pipe.status === 'delivered') return;
    var dealer = pipe.dealerId ? ST.getOne('dealers', pipe.dealerId) : null;
    allItems.push({
      date: a.dueDate,
      dateObj: d,
      icon: '⏳',
      text: sanitize(a.text),
      sub: '📊 ' + sanitize(pipe.projectName || '') + (dealer ? ' • 🏪 ' + sanitize(dealer.name) : ''),
      type: 'action',
      link: "go('pipeDetail',{pipeId:'" + pipe.id + "'})"
    });
  });

  // 3. Pipeline Follow-up Dates
  var pipeline = ST.getAll('pipeline');
  pipeline.forEach(function(p) {
    if (p.status === 'lost' || p.status === 'delivered') return;
    if (p.followupDate) {
      var fd = ftParseDate(p.followupDate);
      if (fd) {
        var dealer = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
        // Check not already covered by action items
        var covered = false;
        pipeActions.forEach(function(a) {
          if (a.pipeId === p.id && a.status === 'pending' && a.dueDate === p.followupDate) covered = true;
        });
        if (!covered) {
          allItems.push({
            date: p.followupDate,
            dateObj: fd,
            icon: '📊',
            text: 'Follow-up: ' + sanitize((p.projectName || '').substr(0, 30)),
            sub: (dealer ? '🏪 ' + sanitize(dealer.name) : '') + (p.nextAction ? ' • 🎯 ' + sanitize(p.nextAction) : ''),
            type: 'pipeline',
            link: "go('pipeDetail',{pipeId:'" + p.id + "'})"
          });
        }
      }
    }
    // Bidding dates
    if (p.biddingDate && ['prospect', 'tor_review', 'quotation', 'bidding', 'negotiation'].indexOf(p.status) !== -1) {
      var bd = ftParseDate(p.biddingDate);
      if (bd) {
        var dealer2 = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
        allItems.push({
          date: p.biddingDate,
          dateObj: bd,
          icon: '🏷️',
          text: 'Bidding: ' + sanitize((p.projectName || '').substr(0, 30)),
          sub: (dealer2 ? '🏪 ' + sanitize(dealer2.name) : '') + ' • ' + fmtMoneyStyled(p.forecastAmount),
          type: 'bidding',
          link: "go('pipeDetail',{pipeId:'" + p.id + "'})"
        });
      }
    }
  });

  // 4. Follow-ups
  var followups = JSON.parse(localStorage.getItem('v7_followups') || '[]');
  followups.forEach(function(f) {
    if (f.status === 'done') return;
    var fDate = f.dueDate || f.date;
    if (!fDate) return;
    var fd = ftParseDate(fDate);
    if (!fd) return;
    var dealer = f.dealerId ? ST.getOne('dealers', f.dealerId) : null;
    allItems.push({
      date: fDate,
      dateObj: fd,
      icon: '📞',
      text: sanitize((f.content || f.note || 'Follow-up').substr(0, 40)),
      sub: dealer ? '🏪 ' + sanitize(dealer.name) : '',
      type: 'followup',
      link: dealer ? "go('dealerDetail',{dealerId:'" + dealer.id + "'})" : ''
    });
  });

  // 5. Meetings
  var meetings = [];
  try { meetings = ST.getAll('meetings'); } catch(e) {}
  meetings.forEach(function(m) {
    if (!m.date) return;
    var md = ftParseDate(m.date);
    if (!md) return;
    allItems.push({
      date: m.date,
      dateObj: md,
      icon: '📅',
      text: sanitize(m.title || 'ประชุม'),
      sub: (m.time || '') + (m.location ? ' • ' + sanitize(m.location) : ''),
      type: 'meeting',
      link: m.id ? "go('meetingDetail',{meetingId:'" + m.id + "'})" : ''
    });
  });

  // Sort by date
  allItems.sort(function(a, b) { return a.dateObj - b.dateObj; });

  // Group items
  var thisWeekEnd = new Date(now);
  thisWeekEnd.setDate(now.getDate() + (7 - now.getDay()));
  thisWeekEnd.setHours(23, 59, 59);

  var nextWeekEnd = new Date(thisWeekEnd);
  nextWeekEnd.setDate(thisWeekEnd.getDate() + 7);

  var overdue = [];
  var todayItems = [];
  var in3Days = [];
  var thisWeek = [];
  var nextWeek = [];

  allItems.forEach(function(item) {
    var diff = Math.ceil((item.dateObj - now) / 86400000);
    if (diff < 0) {
      overdue.push(item);
    } else if (diff === 0) {
      todayItems.push(item);
    } else if (diff <= 3) {
      in3Days.push(item);
    } else if (item.dateObj <= thisWeekEnd) {
      thisWeek.push(item);
    } else if (item.dateObj <= nextWeekEnd) {
      nextWeek.push(item);
    }
  });

  // Don't show if nothing
  var totalCount = overdue.length + todayItems.length + in3Days.length + thisWeek.length + nextWeek.length;
  if (totalCount === 0) return '';

  // Render
  var h = '<div class="card"><h2>📋 สิ่งที่ต้องทำ <span class="pa-count-badge">' + totalCount + '</span></h2>';

  function renderGroup(items, title, colorClass) {
    if (!items.length) return '';
    var gh = '<div class="tl-group">';
    gh += '<div class="tl-group-title ' + colorClass + '">' + title + ' (' + items.length + ')</div>';
    items.forEach(function(item) {
      var diffDays = Math.ceil((item.dateObj - now) / 86400000);
      var dateLabel = '';
      if (diffDays < 0) dateLabel = 'เกิน ' + Math.abs(diffDays) + ' วัน';
      else if (diffDays === 0) dateLabel = 'วันนี้';
      else if (diffDays === 1) dateLabel = 'พรุ่งนี้';
      else dateLabel = item.date;

      gh += '<div class="tl-item ' + colorClass + '"' + (item.link ? ' onclick="' + item.link + '" style="cursor:pointer"' : '') + '>';
      gh += '<span class="tl-item-icon">' + item.icon + '</span>';
      gh += '<div class="tl-item-content">';
      gh += '<div class="tl-item-text">' + item.text + '</div>';
      if (item.sub) gh += '<div class="tl-item-sub">' + item.sub + '</div>';
      gh += '</div>';
      gh += '<div class="tl-item-date">' + dateLabel + '</div>';
      gh += '</div>';
    });
    gh += '</div>';
    return gh;
  }

  h += renderGroup(overdue, '🔴 เลยกำหนด', 'tl-overdue');
  h += renderGroup(todayItems, '🟠 วันนี้', 'tl-today');
  h += renderGroup(in3Days, '🟡 3 วันนี้', 'tl-soon');
  h += renderGroup(thisWeek, '📅 สัปดาห์นี้', 'tl-week');
  h += renderGroup(nextWeek, '📆 สัปดาห์หน้า', 'tl-next');

  h += '</div>';
  return h;
}
// ================================================================
// FEATURE: MONTHLY GOAL DASHBOARD
// ================================================================
var goalMonth = '';

function getGoalData() {
  var saved = localStorage.getItem('v7_goals');
  if (saved) { try { return JSON.parse(saved); } catch(e) {} }
  return [];
}

function saveGoalData(list) {
  localStorage.setItem('v7_goals_v2', JSON.stringify(list));
}

function getMonthlyGoals() {
  var saved = localStorage.getItem('v7_goals_v2');
  if (saved) { try { return JSON.parse(saved); } catch(e) {} }
  return [];
}

function getGoalForMonth(monthKey) {
  var goals = getMonthlyGoals();
  for (var i = 0; i < goals.length; i++) {
    if (goals[i].monthKey === monthKey) return goals[i];
  }
  return null;
}

function getCurrentMonthKey() {
  var now = new Date();
  var m = now.getMonth() + 1;
  return (m < 10 ? '0' + m : m) + '/' + now.getFullYear();
}

function rMonthlyGoal(el) {
  document.getElementById('pgT').textContent = '🎯 Monthly Goal';
  if (!goalMonth) goalMonth = getCurrentMonthKey();
  
  var goal = getGoalForMonth(goalMonth);
  var parts = goalMonth.split('/');
  var monthNum = parseInt(parts[0]) - 1;
  var yearNum = parseInt(parts[1]);
  var monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  // Calculate actuals from data
  var startDate = new Date(yearNum, monthNum, 1);
  var endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59);

  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]');
  var followups = JSON.parse(localStorage.getItem('v7_followups') || '[]');
  var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');

  var monthVisits = visits.filter(function(v) {
    var d = ftParseDate(v.date);
    return d && d >= startDate && d <= endDate;
  });

  var monthWins = pipeline.filter(function(p) {
    if (['win','ordered','delivered'].indexOf(p.status) === -1) return false;
    var d = ftParseDate(p.updatedAt || p.date);
    return d && d >= startDate && d <= endDate;
  });

  var monthRevenue = 0;
  monthWins.forEach(function(p) { monthRevenue += (Number(p.forecastAmount) || 0); });

  var monthFollowups = followups.filter(function(f) {
    var d = ftParseDate(f.date || f.dueDate);
    return d && d >= startDate && d <= endDate;
  });

  var monthNewPipe = pipeline.filter(function(p) {
    var d = ftParseDate(p.registerDate || p.date);
    return d && d >= startDate && d <= endDate;
  });

  var uniqueDealersVisited = {};
  monthVisits.forEach(function(v) { if (v.dealerId) uniqueDealersVisited[v.dealerId] = true; });

  // Default targets
  var targets = goal ? goal.targets : {
    revenue: 0,
    visits: 8,
    followups: 16,
    newPipeline: 5,
    dealerCoverage: dealers.length,
    wins: 2
  };

  var actuals = {
    revenue: monthRevenue,
    visits: monthVisits.length,
    followups: monthFollowups.length,
    newPipeline: monthNewPipe.length,
    dealerCoverage: Object.keys(uniqueDealersVisited).length,
    wins: monthWins.length
  };

  var h = '';

  // Month selector
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">';
  h += '<button class="btn bsm bo" onclick="goalNavMonth(-1)">◀</button>';
  h += '<span style="font-weight:700;font-size:16px;min-width:100px;text-align:center">' + monthNames[monthNum] + ' ' + yearNum + '</span>';
  h += '<button class="btn bsm bo" onclick="goalNavMonth(1)">▶</button>';
  h += '<button class="btn bsm ' + (goalMonth === getCurrentMonthKey() ? 'bp' : 'bo') + '" onclick="goalMonth=getCurrentMonthKey();render()">เดือนนี้</button>';
  h += '<div style="flex:1"></div>';
  h += '<button class="btn bp" onclick="showSetGoalM()">⚙️ ตั้งเป้า</button>';
  h += '</div>';

  // Goal cards
  var goalItems = [
    {key: 'revenue', icon: '💰', label: 'Revenue', actual: fmtMoneyShort(actuals.revenue), target: targets.revenue ? fmtMoneyShort(targets.revenue) : 'ไม่ได้ตั้ง', pct: targets.revenue ? Math.round(actuals.revenue / targets.revenue * 100) : 0, color: '#22c55e'},
    {key: 'visits', icon: '📍', label: 'Visit', actual: actuals.visits, target: targets.visits || 0, pct: targets.visits ? Math.round(actuals.visits / targets.visits * 100) : 0, color: '#3b82f6'},
    {key: 'followups', icon: '📞', label: 'Follow-up', actual: actuals.followups, target: targets.followups || 0, pct: targets.followups ? Math.round(actuals.followups / targets.followups * 100) : 0, color: '#8b5cf6'},
    {key: 'newPipeline', icon: '📋', label: 'Pipeline ใหม่', actual: actuals.newPipeline, target: targets.newPipeline || 0, pct: targets.newPipeline ? Math.round(actuals.newPipeline / targets.newPipeline * 100) : 0, color: '#f59e0b'},
    {key: 'dealerCoverage', icon: '🏪', label: 'Dealer Coverage', actual: actuals.dealerCoverage, target: targets.dealerCoverage || dealers.length, pct: targets.dealerCoverage ? Math.round(actuals.dealerCoverage / targets.dealerCoverage * 100) : 0, color: '#ec4899'},
    {key: 'wins', icon: '🏆', label: 'Win Deal', actual: actuals.wins, target: targets.wins || 0, pct: targets.wins ? Math.round(actuals.wins / targets.wins * 100) : 0, color: '#14b8a6'}
  ];

  h += '<div class="goal-grid">';
  goalItems.forEach(function(g) {
    var pct = Math.min(g.pct, 100);
    var status = pct >= 100 ? 'goal-done' : pct >= 70 ? 'goal-good' : pct >= 40 ? 'goal-warn' : 'goal-bad';
    h += '<div class="goal-card ' + status + '">';
    h += '<div class="goal-icon">' + g.icon + '</div>';
    h += '<div class="goal-info">';
    h += '<div class="goal-label">' + g.label + '</div>';
    h += '<div class="goal-numbers"><span class="goal-actual">' + g.actual + '</span> / <span class="goal-target">' + g.target + '</span></div>';
    h += '</div>';
    h += '<div class="goal-pct" style="color:' + g.color + '">' + g.pct + '%</div>';
    h += '<div class="goal-bar"><div class="goal-fill" style="width:' + pct + '%;background:' + g.color + '"></div></div>';
    if (pct >= 100) h += '<div class="goal-badge">🎉</div>';
    h += '</div>';
  });
  h += '</div>';

  // Visit detail
  if (monthVisits.length) {
    h += '<div class="card"><h2>📍 Visit เดือนนี้ (' + monthVisits.length + ')</h2>';
    monthVisits.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
    monthVisits.forEach(function(v) {
      var dd = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
      h += '<div class="li" onclick="go(\'visitDetail\',{visitId:\'' + v.id + '\'})">';
      h += '<div class="lm"><div class="lt">' + (v.date || '-') + ' — ' + (dd ? sanitize(dd.name) : '-') + '</div>';
      h += '<div class="ls">' + (v.mode || '-') + '</div></div></div>';
    });
    h += '</div>';
  }

  // Wins
  if (monthWins.length) {
    h += '<div class="card"><h2>🏆 Win เดือนนี้ (' + monthWins.length + ')</h2>';
    monthWins.forEach(function(p) {
      var dd = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
      h += '<div class="li" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
      h += '<div class="lm"><div class="lt">' + sanitize(p.projectName || '-') + '</div>';
      h += '<div class="ls">' + (dd ? sanitize(dd.name) : '-') + ' • ' + fmtMoneyStyled(p.forecastAmount) + '</div></div></div>';
    });
    h += '</div>';
  }

  el.innerHTML = h;
}

function goalNavMonth(dir) {
  var parts = goalMonth.split('/');
  var m = parseInt(parts[0]) - 1 + dir;
  var y = parseInt(parts[1]);
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  goalMonth = ((m + 1) < 10 ? '0' + (m + 1) : (m + 1)) + '/' + y;
  render();
}

function showSetGoalM() {
  var goal = getGoalForMonth(goalMonth) || {};
  var t = goal.targets || {revenue: 0, visits: 8, followups: 16, newPipeline: 5, dealerCoverage: 0, wins: 2};

  var h = '<div style="max-width:400px">';
  h += '<div style="text-align:center;font-weight:700;margin-bottom:12px">🎯 ตั้งเป้าเดือน ' + goalMonth + '</div>';
  h += '<div class="fm-group"><label>💰 Revenue Target (฿)</label><input type="number" id="gl_rev" class="fm-input" value="' + (t.revenue || '') + '"></div>';
  h += '<div class="fm-group"><label>📍 Visit Target</label><input type="number" id="gl_visit" class="fm-input" value="' + (t.visits || '') + '"></div>';
  h += '<div class="fm-group"><label>📞 Follow-up Target</label><input type="number" id="gl_fu" class="fm-input" value="' + (t.followups || '') + '"></div>';
  h += '<div class="fm-group"><label>📋 Pipeline ใหม่ Target</label><input type="number" id="gl_pipe" class="fm-input" value="' + (t.newPipeline || '') + '"></div>';
  h += '<div class="fm-group"><label>🏪 Dealer Coverage Target</label><input type="number" id="gl_dealer" class="fm-input" value="' + (t.dealerCoverage || '') + '"></div>';
  h += '<div class="fm-group"><label>🏆 Win Deal Target</label><input type="number" id="gl_win" class="fm-input" value="' + (t.wins || '') + '"></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveGoalTargets()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('🎯 ตั้งเป้า', h);
}

function saveGoalTargets() {
  var goals = getMonthlyGoals();
  var targets = {
    revenue: parseFloat(document.getElementById('gl_rev').value) || 0,
    visits: parseInt(document.getElementById('gl_visit').value) || 0,
    followups: parseInt(document.getElementById('gl_fu').value) || 0,
    newPipeline: parseInt(document.getElementById('gl_pipe').value) || 0,
    dealerCoverage: parseInt(document.getElementById('gl_dealer').value) || 0,
    wins: parseInt(document.getElementById('gl_win').value) || 0
  };

  var found = false;
  for (var i = 0; i < goals.length; i++) {
    if (goals[i].monthKey === goalMonth) {
      goals[i].targets = targets;
      found = true;
      break;
    }
  }
  if (!found) goals.push({monthKey: goalMonth, targets: targets});

  saveGoalData(goals);
  toast('🎯 บันทึกเป้าหมายแล้ว');
  closeMForce();
  render();
}


// ================================================================
// FEATURE: DEMO EQUIPMENT TRACKER
// ================================================================
function getDemoItems() {
  var saved = localStorage.getItem('v7_demo');
  if (saved) { try { return JSON.parse(saved); } catch(e) {} }
  return [];
}

function saveDemoItems(list) {
  localStorage.setItem('v7_demo', JSON.stringify(list));
}

function rDemoTracker(el) {
  document.getElementById('pgT').textContent = '🚁 Demo Equipment';
  var items = getDemoItems();
  var dealers = ST.getAll('dealers');

  var available = items.filter(function(d) { return d.status === 'available'; });
  var lent = items.filter(function(d) { return d.status === 'lent'; });
  var maintenance = items.filter(function(d) { return d.status === 'maintenance'; });

  var now = new Date();

  var h = '';
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
  h += '<button class="btn bp" onclick="showAddDemoM()">➕ เพิ่มอุปกรณ์</button>';
  h += '</div>';

  // Stats
  h += '<div class="sr">';
  h += '<div class="sc"><div class="sn c1">' + items.length + '</div><div class="sl">ทั้งหมด</div></div>';
  h += '<div class="sc"><div class="sn c2">' + available.length + '</div><div class="sl">✅ ว่าง</div></div>';
  h += '<div class="sc"><div class="sn c4">' + lent.length + '</div><div class="sl">📤 ให้ยืม</div></div>';
  h += '<div class="sc"><div class="sn c3">' + maintenance.length + '</div><div class="sl">🔧 ซ่อม</div></div>';
  h += '</div>';

  // Lent items (urgent)
  if (lent.length) {
    h += '<div class="card"><h2>📤 ให้ยืมอยู่ (' + lent.length + ')</h2>';
    lent.forEach(function(d) {
      var dd = d.dealerId ? ST.getOne('dealers', d.dealerId) : null;
      var lentDate = ftParseDate(d.lentDate);
      var daysBorrowed = lentDate ? Math.floor((now - lentDate) / 86400000) : 0;
      var isOverdue = daysBorrowed > 30;

      h += '<div class="demo-card' + (isOverdue ? ' demo-overdue' : '') + '">';
      h += '<div class="demo-header">';
      h += '<div class="demo-name">🚁 ' + sanitize(d.name) + '</div>';
      h += '<span class="demo-status demo-lent">📤 ให้ยืม</span>';
      h += '</div>';
      h += '<div class="demo-info">';
      h += '<div>🏪 ' + (dd ? sanitize(dd.name) : sanitize(d.borrower || '-')) + '</div>';
      h += '<div>📅 ยืมตั้งแต่: ' + (d.lentDate || '-') + ' (' + daysBorrowed + ' วัน)</div>';
      if (d.returnDate) h += '<div>📅 กำหนดคืน: ' + d.returnDate + '</div>';
      if (d.note) h += '<div>📝 ' + sanitize(d.note) + '</div>';
      h += '</div>';
      h += '<div class="demo-actions">';
      h += '<button class="btn bsm bp" onclick="returnDemo(\'' + d.id + '\')">✅ คืนแล้ว</button>';
      h += '<button class="btn bsm bo" onclick="showEditDemoM(\'' + d.id + '\')">✏️</button>';
      if (isOverdue) h += '<span style="color:#ff5252;font-size:11px;font-weight:700">⚠️ เกิน 30 วัน!</span>';
      h += '</div></div>';
    });
    h += '</div>';
  }

  // Available
  if (available.length) {
    h += '<div class="card"><h2>✅ ว่าง (' + available.length + ')</h2>';
    available.forEach(function(d) {
      h += '<div class="demo-card">';
      h += '<div class="demo-header">';
      h += '<div class="demo-name">🚁 ' + sanitize(d.name) + '</div>';
      h += '<span class="demo-status demo-available">✅ ว่าง</span>';
      h += '</div>';
      if (d.serialNumber) h += '<div class="demo-info"><div>🔢 S/N: ' + sanitize(d.serialNumber) + '</div></div>';
      h += '<div class="demo-actions">';
      h += '<button class="btn bsm bp" onclick="showLendDemoM(\'' + d.id + '\')">📤 ให้ยืม</button>';
      h += '<button class="btn bsm bo" onclick="showEditDemoM(\'' + d.id + '\')">✏️</button>';
      h += '<button class="btn bsm bd" onclick="deleteDemo(\'' + d.id + '\')">🗑️</button>';
      h += '</div></div>';
    });
    h += '</div>';
  }

  // Maintenance
  if (maintenance.length) {
    h += '<div class="card"><h2>🔧 ซ่อม/บำรุง (' + maintenance.length + ')</h2>';
    maintenance.forEach(function(d) {
      h += '<div class="demo-card">';
      h += '<div class="demo-header">';
      h += '<div class="demo-name">🚁 ' + sanitize(d.name) + '</div>';
      h += '<span class="demo-status demo-maint">🔧 ซ่อม</span>';
      h += '</div>';
      if (d.note) h += '<div class="demo-info"><div>📝 ' + sanitize(d.note) + '</div></div>';
      h += '<div class="demo-actions">';
      h += '<button class="btn bsm bp" onclick="demoSetStatus(\'' + d.id + '\',\'available\')">✅ พร้อมใช้</button>';
      h += '<button class="btn bsm bo" onclick="showEditDemoM(\'' + d.id + '\')">✏️</button>';
      h += '</div></div>';
    });
    h += '</div>';
  }

  if (!items.length) {
    h += '<div class="card" style="text-align:center;padding:30px"><div style="font-size:48px;margin-bottom:10px">🚁</div><p>ยังไม่มีอุปกรณ์ Demo — กด ➕ เพื่อเพิ่ม</p></div>';
  }

  el.innerHTML = h;
}

function showAddDemoM() {
  var h = '<div style="max-width:400px">';
  h += '<div class="fm-group"><label>🚁 ชื่ออุปกรณ์ *</label><input type="text" id="dm_name" class="fm-input" placeholder="เช่น L3 Demo Unit #1"></div>';
  h += '<div class="fm-group"><label>🔢 Serial Number</label><input type="text" id="dm_sn" class="fm-input" placeholder="S/N"></div>';
  h += '<div class="fm-group"><label>📦 Model</label><select id="dm_model" class="fm-input">' + modelOptionsNew('') + '</select></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="dm_note" rows="2" class="fm-input"></textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveDemo()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('➕ เพิ่มอุปกรณ์ Demo', h);
}

function saveDemo() {
  var name = (document.getElementById('dm_name').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }
  var items = getDemoItems();
  items.push({
    id: 'dm_' + Date.now(),
    name: name,
    serialNumber: (document.getElementById('dm_sn').value || '').trim(),
    model: document.getElementById('dm_model').value || '',
    note: (document.getElementById('dm_note').value || '').trim(),
    status: 'available',
    dealerId: '',
    borrower: '',
    lentDate: '',
    returnDate: ''
  });
  saveDemoItems(items);
  toast('✅ เพิ่มอุปกรณ์แล้ว');
  closeMForce();
  render();
}

function showLendDemoM(demoId) {
  var dealers = ST.getAll('dealers');
  var h = '<div style="max-width:400px">';
  h += '<div class="fm-group"><label>🏪 ให้ยืมใคร</label><select id="dm_dealer" class="fm-input">';
  h += '<option value="">-- เลือก Dealer --</option>';
  dealers.forEach(function(d) { h += '<option value="' + d.id + '">' + sanitize(d.name) + '</option>'; });
  h += '</select></div>';
  h += '<div class="fm-group"><label>👤 ผู้ยืม (ถ้าไม่ใช่ Dealer)</label><input type="text" id="dm_borrower" class="fm-input" placeholder="ชื่อผู้ยืม"></div>';
  h += '<div class="fm-group"><label>📅 วันที่ยืม</label><input type="text" id="dm_lent" class="fm-input dp" value="' + _td() + '"></div>';
  h += '<div class="fm-group"><label>📅 กำหนดคืน</label><input type="text" id="dm_return" class="fm-input dp" placeholder="DD/MM/YYYY"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="dm_lnote" rows="2" class="fm-input"></textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="lendDemo(\'' + demoId + '\')">📤 ให้ยืม</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('📤 ให้ยืมอุปกรณ์', h);
}

function lendDemo(demoId) {
  var items = getDemoItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === demoId) {
      items[i].status = 'lent';
      items[i].dealerId = document.getElementById('dm_dealer').value || '';
      items[i].borrower = (document.getElementById('dm_borrower').value || '').trim();
      items[i].lentDate = (document.getElementById('dm_lent').value || '').trim() || _td();
      items[i].returnDate = (document.getElementById('dm_return').value || '').trim();
      items[i].note = (document.getElementById('dm_lnote').value || '').trim();
      break;
    }
  }
  saveDemoItems(items);
  toast('📤 ให้ยืมแล้ว');
  closeMForce();
  render();
}

function returnDemo(demoId) {
  if (!confirm('ยืนยันคืนอุปกรณ์?')) return;
  var items = getDemoItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === demoId) {
      items[i].status = 'available';
      items[i].dealerId = '';
      items[i].borrower = '';
      items[i].lentDate = '';
      items[i].returnDate = '';
      items[i].note = '';
      break;
    }
  }
  saveDemoItems(items);
  toast('✅ คืนอุปกรณ์แล้ว');
  render();
}

function showEditDemoM(demoId) {
  var items = getDemoItems();
  var d = null;
  for (var i = 0; i < items.length; i++) { if (items[i].id === demoId) { d = items[i]; break; } }
  if (!d) return;

  var h = '<div style="max-width:400px">';
  h += '<div class="fm-group"><label>🚁 ชื่อ</label><input type="text" id="dm_name" class="fm-input" value="' + sanitize(d.name || '') + '"></div>';
  h += '<div class="fm-group"><label>🔢 S/N</label><input type="text" id="dm_sn" class="fm-input" value="' + sanitize(d.serialNumber || '') + '"></div>';
  h += '<div class="fm-group"><label>📦 Model</label><select id="dm_model" class="fm-input">' + modelOptionsNew(d.model || '') + '</select></div>';
  h += '<div class="fm-group"><label>📊 สถานะ</label><select id="dm_status" class="fm-input">';
  h += '<option value="available"' + (d.status === 'available' ? ' selected' : '') + '>✅ ว่าง</option>';
  h += '<option value="lent"' + (d.status === 'lent' ? ' selected' : '') + '>📤 ให้ยืม</option>';
  h += '<option value="maintenance"' + (d.status === 'maintenance' ? ' selected' : '') + '>🔧 ซ่อม</option>';
  h += '</select></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="dm_note" rows="2" class="fm-input">' + sanitize(d.note || '') + '</textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="updateDemo(\'' + demoId + '\')">💾 บันทึก</button>';
  h += '<button class="btn bd" onclick="deleteDemo(\'' + demoId + '\')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('✏️ แก้ไขอุปกรณ์', h);
}

function updateDemo(demoId) {
  var items = getDemoItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === demoId) {
      items[i].name = (document.getElementById('dm_name').value || '').trim();
      items[i].serialNumber = (document.getElementById('dm_sn').value || '').trim();
      items[i].model = document.getElementById('dm_model').value || '';
      items[i].status = document.getElementById('dm_status').value || 'available';
      items[i].note = (document.getElementById('dm_note').value || '').trim();
      break;
    }
  }
  saveDemoItems(items);
  toast('💾 บันทึกแล้ว');
  closeMForce();
  render();
}

function deleteDemo(demoId) {
  if (!confirm('ลบอุปกรณ์นี้?')) return;
  var items = getDemoItems().filter(function(d) { return d.id !== demoId; });
  saveDemoItems(items);
  toast('🗑️ ลบแล้ว');
  closeMForce();
  render();
}

function demoSetStatus(demoId, status) {
  var items = getDemoItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === demoId) { items[i].status = status; break; }
  }
  saveDemoItems(items);
  toast('✅ อัพเดทแล้ว');
  render();
}


// ================================================================
// FEATURE: QUOTATION TRACKER
// ================================================================
function getQuotations() {
  var saved = localStorage.getItem('v7_quotes');
  if (saved) { try { return JSON.parse(saved); } catch(e) {} }
  return [];
}

function saveQuotations(list) {
  localStorage.setItem('v7_quotes', JSON.stringify(list));
}

function rQuotations(el) {
  document.getElementById('pgT').textContent = '💰 Quotation Tracker';
  var quotes = getQuotations();
  var dealers = ST.getAll('dealers');

  var pending = quotes.filter(function(q) { return q.status === 'pending'; });
  var approved = quotes.filter(function(q) { return q.status === 'approved'; });
  var rejected = quotes.filter(function(q) { return q.status === 'rejected'; });
  var expired = quotes.filter(function(q) { return q.status === 'expired'; });

  var now = new Date();

  var h = '';
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
  h += '<button class="btn bp" onclick="showAddQuoteM()">➕ เพิ่ม Quote</button>';
  h += '</div>';

  // Stats
  var totalVal = 0;
  quotes.forEach(function(q) { totalVal += (Number(q.amount) || 0); });
  var pendingVal = 0;
  pending.forEach(function(q) { pendingVal += (Number(q.amount) || 0); });

  h += '<div class="sr">';
  h += '<div class="sc"><div class="sn c1">' + quotes.length + '</div><div class="sl">ทั้งหมด</div></div>';
  h += '<div class="sc"><div class="sn c5">' + pending.length + '</div><div class="sl">⏳ รอตอบ</div></div>';
  h += '<div class="sc"><div class="sn c2">' + approved.length + '</div><div class="sl">✅ อนุมัติ</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(pendingVal) + '</div><div class="sl">มูลค่ารอ</div></div>';
  h += '</div>';

  // Pending (urgent)
  if (pending.length) {
    h += '<div class="card"><h2>⏳ รอตอบ (' + pending.length + ')</h2>';
    pending.sort(function(a, b) { return (a.sentDate || '').localeCompare(b.sentDate || ''); });
    pending.forEach(function(q, idx) {
      var dd = q.dealerId ? ST.getOne('dealers', q.dealerId) : null;
      var sentDate = ftParseDate(q.sentDate);
      var daysSent = sentDate ? Math.floor((now - sentDate) / 86400000) : 0;
      var isOld = daysSent > 7;

      h += '<div class="quote-card' + (isOld ? ' quote-old' : '') + '">';
      h += '<div class="quote-header">';
      h += '<div class="quote-num">#' + (idx + 1) + ' ' + sanitize(q.quoteNumber || '-') + '</div>';
      h += '<span class="quote-status quote-pending">⏳ รอตอบ</span>';
      h += '</div>';
      h += '<div class="quote-info">';
      h += '<div>🏪 ' + (dd ? sanitize(dd.name) : '-') + '</div>';
      h += '<div>📋 ' + sanitize(q.projectName || '-') + '</div>';
      h += '<div>💰 ' + fmtMoneyStyled(q.amount) + '</div>';
      h += '<div>📅 ส่ง: ' + (q.sentDate || '-') + ' (' + daysSent + ' วัน)' + (isOld ? ' <span style="color:#ff5252">⚠️ เกิน 7 วัน</span>' : '') + '</div>';
      h += '</div>';
      h += '<div class="demo-actions">';
      h += '<button class="btn bsm bp" onclick="setQuoteStatus(\'' + q.id + '\',\'approved\')">✅ อนุมัติ</button>';
      h += '<button class="btn bsm bd" onclick="setQuoteStatus(\'' + q.id + '\',\'rejected\')">❌ ปฏิเสธ</button>';
      h += '<button class="btn bsm bo" onclick="showEditQuoteM(\'' + q.id + '\')">✏️</button>';
      h += '</div></div>';
    });
    h += '</div>';
  }

  // Approved
  if (approved.length) {
    h += '<div class="card"><h2>✅ อนุมัติ (' + approved.length + ')</h2>';
    approved.forEach(function(q) {
      var dd = q.dealerId ? ST.getOne('dealers', q.dealerId) : null;
      h += '<div class="quote-card quote-approved-card">';
      h += '<div class="quote-header"><div class="quote-num">' + sanitize(q.quoteNumber || '-') + '</div><span class="quote-status quote-approved">✅</span></div>';
      h += '<div class="quote-info"><div>🏪 ' + (dd ? sanitize(dd.name) : '-') + ' • 💰 ' + fmtMoneyStyled(q.amount) + '</div></div>';
      h += '<div class="demo-actions"><button class="btn bsm bo" onclick="showEditQuoteM(\'' + q.id + '\')">✏️</button></div>';
      h += '</div>';
    });
    h += '</div>';
  }

  // Rejected + Expired
  if (rejected.length || expired.length) {
    h += '<div class="card"><h2>❌ ปฏิเสธ/หมดอายุ (' + (rejected.length + expired.length) + ')</h2>';
    rejected.concat(expired).forEach(function(q) {
      var dd = q.dealerId ? ST.getOne('dealers', q.dealerId) : null;
      h += '<div class="quote-card" style="opacity:0.5">';
      h += '<div class="quote-header"><div class="quote-num">' + sanitize(q.quoteNumber || '-') + '</div><span class="quote-status quote-rejected">' + (q.status === 'expired' ? '⏰' : '❌') + '</span></div>';
      h += '<div class="quote-info"><div>🏪 ' + (dd ? sanitize(dd.name) : '-') + ' • 💰 ' + fmtMoney(q.amount) + '</div></div>';
      h += '</div>';
    });
    h += '</div>';
  }

  if (!quotes.length) {
    h += '<div class="card" style="text-align:center;padding:30px"><div style="font-size:48px;margin-bottom:10px">💰</div><p>ยังไม่มี Quotation — กด ➕ เพื่อเพิ่ม</p></div>';
  }

  el.innerHTML = h;
}

function showAddQuoteM() {
  var dealers = ST.getAll('dealers');
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>📄 เลข Quote</label><input type="text" id="qt_num" class="fm-input" placeholder="เช่น QT-2025-001"></div>';
  h += '<div class="fm-group"><label>🏪 Dealer *</label><select id="qt_dealer" class="fm-input" onchange="qtDealerChanged()">';
  h += '<option value="">-- เลือก --</option>';
  dealers.forEach(function(d) { h += '<option value="' + d.id + '">' + sanitize(d.name) + '</option>'; });
  h += '</select></div>';
  h += '<div class="fm-group"><label>📊 Pipeline Project</label><select id="qt_pipe" class="fm-input"><option value="">-- ไม่ระบุ --</option></select></div>';
  h += '<div class="fm-group"><label>📋 รายละเอียด</label><input type="text" id="qt_desc" class="fm-input" placeholder="เช่น M400 x3 + L3 x1"></div>';
  h += '<div class="fm-group"><label>💰 มูลค่า (฿)</label><input type="number" id="qt_amt" class="fm-input"></div>';
  h += '<div class="fm-group"><label>📅 วันที่ส่ง</label><input type="text" id="qt_sent" class="fm-input dp" value="' + _td() + '"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="qt_note" rows="2" class="fm-input"></textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveQuote()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('➕ เพิ่ม Quotation', h);
}

function qtDealerChanged() {
  var dId = document.getElementById('qt_dealer').value;
  var sel = document.getElementById('qt_pipe');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>';
  if (!dId) return;
  var pipes = ST.pipelineByDealer(dId);
  pipes.forEach(function(p) {
    if (p.status === 'lost' || p.status === 'delivered') return;
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = (p.projectName || '-') + ' (' + fmtMoneyShort(p.forecastAmount) + ')';
    sel.appendChild(opt);
  });
}

function saveQuote() {
  var dealerId = document.getElementById('qt_dealer').value;
  if (!dealerId) { toast('เลือก Dealer'); return; }

  var quotes = getQuotations();
  quotes.push({
    id: 'qt_' + Date.now(),
    quoteNumber: (document.getElementById('qt_num').value || '').trim(),
    dealerId: dealerId,
    pipeId: document.getElementById('qt_pipe').value || '',
    projectName: (document.getElementById('qt_desc').value || '').trim(),
    amount: parseFloat(document.getElementById('qt_amt').value) || 0,
    sentDate: (document.getElementById('qt_sent').value || '').trim() || _td(),
    note: (document.getElementById('qt_note').value || '').trim(),
    status: 'pending'
  });
  saveQuotations(quotes);
  toast('✅ เพิ่ม Quote แล้ว');
  closeMForce();
  render();
}

function setQuoteStatus(quoteId, status) {
  var quotes = getQuotations();
  for (var i = 0; i < quotes.length; i++) {
    if (quotes[i].id === quoteId) { quotes[i].status = status; break; }
  }
  saveQuotations(quotes);
  toast(status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธแล้ว');
  render();
}

function showEditQuoteM(quoteId) {
  var quotes = getQuotations();
  var q = null;
  for (var i = 0; i < quotes.length; i++) { if (quotes[i].id === quoteId) { q = quotes[i]; break; } }
  if (!q) return;

  var dealers = ST.getAll('dealers');
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>📄 เลข Quote</label><input type="text" id="qt_num" class="fm-input" value="' + sanitize(q.quoteNumber || '') + '"></div>';
  h += '<div class="fm-group"><label>🏪 Dealer</label><select id="qt_dealer" class="fm-input">';
  dealers.forEach(function(d) { h += '<option value="' + d.id + '"' + (q.dealerId === d.id ? ' selected' : '') + '>' + sanitize(d.name) + '</option>'; });
  h += '</select></div>';
  h += '<div class="fm-group"><label>📋 รายละเอียด</label><input type="text" id="qt_desc" class="fm-input" value="' + sanitize(q.projectName || '') + '"></div>';
  h += '<div class="fm-group"><label>💰 มูลค่า</label><input type="number" id="qt_amt" class="fm-input" value="' + (q.amount || '') + '"></div>';
  h += '<div class="fm-group"><label>📅 วันที่ส่ง</label><input type="text" id="qt_sent" class="fm-input dp" value="' + (q.sentDate || '') + '"></div>';
  h += '<div class="fm-group"><label>📊 สถานะ</label><select id="qt_status" class="fm-input">';
  h += '<option value="pending"' + (q.status === 'pending' ? ' selected' : '') + '>⏳ รอตอบ</option>';
  h += '<option value="approved"' + (q.status === 'approved' ? ' selected' : '') + '>✅ อนุมัติ</option>';
  h += '<option value="rejected"' + (q.status === 'rejected' ? ' selected' : '') + '>❌ ปฏิเสธ</option>';
  h += '<option value="expired"' + (q.status === 'expired' ? ' selected' : '') + '>⏰ หมดอายุ</option>';
  h += '</select></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="qt_note" rows="2" class="fm-input">' + sanitize(q.note || '') + '</textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="updateQuote(\'' + quoteId + '\')">💾 บันทึก</button>';
  h += '<button class="btn bd" onclick="deleteQuote(\'' + quoteId + '\')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('✏️ แก้ไข Quote', h);
}

function updateQuote(quoteId) {
  var quotes = getQuotations();
  for (var i = 0; i < quotes.length; i++) {
    if (quotes[i].id === quoteId) {
      quotes[i].quoteNumber = (document.getElementById('qt_num').value || '').trim();
      quotes[i].dealerId = document.getElementById('qt_dealer').value || '';
      quotes[i].projectName = (document.getElementById('qt_desc').value || '').trim();
      quotes[i].amount = parseFloat(document.getElementById('qt_amt').value) || 0;
      quotes[i].sentDate = (document.getElementById('qt_sent').value || '').trim();
      quotes[i].status = document.getElementById('qt_status').value || 'pending';
      quotes[i].note = (document.getElementById('qt_note').value || '').trim();
      break;
    }
  }
  saveQuotations(quotes);
  toast('💾 บันทึกแล้ว');
  closeMForce();
  render();
}

function deleteQuote(quoteId) {
  if (!confirm('ลบ Quote นี้?')) return;
  var quotes = getQuotations().filter(function(q) { return q.id !== quoteId; });
  saveQuotations(quotes);
  toast('🗑️ ลบแล้ว');
  closeMForce();
  render();
}
// ================================================================
// FEATURE: VISIT PLANNING
// ================================================================
var vpWeekOffset = 0;

function rVisitPlan(el) {
  document.getElementById('pgT').textContent = '📅 Visit Planning';
  var dealers = ST.getAll('dealers');
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var plans = getVisitPlans();
  var now = new Date();

  // Calculate week
  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1 + (vpWeekOffset * 7));
  weekStart.setHours(0, 0, 0, 0);
  var weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59);

  var dayNames = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  var dayShort = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

  var h = '';

  // Week selector
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">';
  h += '<button class="btn bsm bo" onclick="vpWeekOffset--;render()">◀</button>';
  h += '<span style="font-weight:700;font-size:14px;min-width:180px;text-align:center">';
  h += fmtDateKey(weekStart) + ' — ' + fmtDateKey(weekEnd);
  h += vpWeekOffset === 0 ? ' (สัปดาห์นี้)' : vpWeekOffset === 1 ? ' (สัปดาห์หน้า)' : '';
  h += '</span>';
  h += '<button class="btn bsm bo" onclick="vpWeekOffset++;render()">▶</button>';
  h += '<button class="btn bsm ' + (vpWeekOffset === 0 ? 'bp' : 'bo') + '" onclick="vpWeekOffset=0;render()">สัปดาห์นี้</button>';
  h += '<button class="btn bsm ' + (vpWeekOffset === 1 ? 'bp' : 'bo') + '" onclick="vpWeekOffset=1;render()">สัปดาห์หน้า</button>';
  h += '<div style="flex:1"></div>';
  h += '<button class="btn bo" onclick="copyVisitPlan()">📋 Copy</button>';
  h += '</div>';

  // Day cards
  for (var di = 0; di < 7; di++) {
    var dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + di);
    var dayKey = fmtDateKey(dayDate);
    var isToday = dayKey === _td();
    var isWeekend = di >= 5;

    // Get visits for this day
    var dayVisits = visits.filter(function(v) { return v.date === dayKey; });

    // Get plans for this day
    var dayPlans = plans.filter(function(p) { return p.date === dayKey; });

    // Meetings
    var dayMeetings = [];
    try { dayMeetings = ST.filter('meetings', function(m) { return m.date === dayKey; }); } catch(e) {}

    // Suggest dealers not visited in 30+ days
    var suggestedDealers = [];
    if (!isWeekend && dayVisits.length === 0 && dayPlans.length === 0) {
      dealers.forEach(function(d) {
        var lastVisit = null;
        visits.forEach(function(v) {
          if (v.dealerId === d.id) {
            var vd = ftParseDate(v.date);
            if (vd && (!lastVisit || vd > lastVisit)) lastVisit = vd;
          }
        });
        var daysSince = lastVisit ? Math.floor((new Date() - lastVisit) / 86400000) : 999;
        if (daysSince > 30) suggestedDealers.push({dealer: d, daysSince: daysSince});
      });
      suggestedDealers.sort(function(a, b) { return b.daysSince - a.daysSince; });
      suggestedDealers = suggestedDealers.slice(0, 3);
    }

    h += '<div class="vp-day' + (isToday ? ' vp-today' : '') + (isWeekend ? ' vp-weekend' : '') + '">';
    h += '<div class="vp-day-header">';
    h += '<span class="vp-day-name">' + dayNames[di] + '</span>';
    h += '<span class="vp-day-date">' + dayKey + '</span>';
    if (isToday) h += '<span class="vp-today-badge">วันนี้</span>';
    h += '<button class="btn-xs" onclick="showAddVisitPlanM(\'' + dayKey + '\')">➕</button>';
    h += '</div>';

   // Plans
    dayPlans.forEach(function(p) {
      var dd = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
      var taskLinked = p.taskId ? ST.getOne('tasks', p.taskId) : null;

      h += '<div class="vp-item">';
      h += '<span class="vp-item-icon">' + (p.mode === 'offline' ? '🤝' : '📞') + '</span>';
      h += '<div class="vp-item-info">';
      h += '<div class="vp-item-dealer">' + (dd ? sanitize(dd.name) : sanitize(p.note || '-')) + '</div>';
      if (p.note && dd) h += '<div class="vp-item-note">' + sanitize(p.note) + '</div>';
      if (taskLinked) h += '<div class="vp-item-note">📋 ' + sanitize(taskLinked.title) + '</div>';
      h += '</div>';
      h += '<div class="vp-item-actions">';
      if (dd) h += '<button class="btn-xs" onclick="event.stopPropagation();vpGoVisit(\'' + p.id + '\')" title="บันทึก Visit">📍</button>';
      h += '<button class="btn-xs" onclick="event.stopPropagation();showAddVisitPlanM(\'' + p.date + '\',\'\',\'' + p.id + '\')" title="แก้ไข">✏️</button>';
      h += '<button class="btn-xs btn-red" onclick="event.stopPropagation();removeVisitPlan(\'' + p.id + '\')" title="ลบ">✕</button>';
      h += '</div></div>';
    });

    // Actual visits
    dayVisits.forEach(function(v) {
      var dd = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
      h += '<div class="vp-item vp-actual">';
      h += '<span class="vp-item-icon">✅</span>';
      h += '<div class="vp-item-info">';
      h += '<div class="vp-item-dealer">' + (dd ? sanitize(dd.name) : '-') + ' <span style="font-size:10px;color:var(--text2)">(visited)</span></div>';
      h += '</div></div>';
    });

    // Meetings
    dayMeetings.forEach(function(m) {
      h += '<div class="vp-item vp-meeting">';
      h += '<span class="vp-item-icon">📅</span>';
      h += '<div class="vp-item-info"><div class="vp-item-dealer">' + (m.time || '') + ' ' + sanitize(m.title || '') + '</div></div>';
      h += '</div>';
    });

    // Suggestions
    if (suggestedDealers.length && !dayPlans.length && !dayVisits.length) {
      h += '<div class="vp-suggest">';
      h += '<div style="font-size:10px;color:var(--text2);margin-bottom:3px">💡 แนะนำ:</div>';
      suggestedDealers.forEach(function(s) {
        h += '<div class="vp-suggest-item" onclick="showAddVisitPlanM(\'' + dayKey + '\',\'' + s.dealer.id + '\')">';
h += '🏪 ' + sanitize(s.dealer.name) + ' <span style="color:var(--text2)">(' + s.daysSince + ' วัน)</span> <span style="color:var(--accent)">➕ เพิ่มแผน</span>';
        h += '</div>';
      });
      h += '</div>';
    }

    // Empty day
    if (!dayPlans.length && !dayVisits.length && !dayMeetings.length && !suggestedDealers.length) {
      h += '<div class="vp-empty">' + (isWeekend ? '🏖️ วันหยุด' : 'ว่าง') + '</div>';
    }

    h += '</div>';
  }

  el.innerHTML = h;
}

function getVisitPlans() {
  var saved = localStorage.getItem('v7_visitPlans');
  if (saved) { try { return JSON.parse(saved); } catch(e) {} }
  return [];
}

function saveVisitPlans(list) {
  localStorage.setItem('v7_visitPlans', JSON.stringify(list));
}

function showAddVisitPlanM(date, prefillDealerId, editId) {
  var dealers = ST.getAll('dealers');
  var plan = null;
  if (editId) {
    var plans = getVisitPlans();
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].id === editId) { plan = plans[i]; break; }
    }
  }

  var selDealer = prefillDealerId || (plan ? plan.dealerId : '') || '';
  var selMode = plan ? plan.mode : 'offline';
  var selNote = plan ? plan.note : '';

  var h = '<div style="max-width:400px">';
  h += '<div style="text-align:center;font-weight:700;margin-bottom:10px">📅 ' + date + '</div>';
  h += '<div class="fm-group"><label>🏪 Dealer</label><select id="vp_dealer" class="fm-input">';
  h += '<option value="">-- เลือก --</option>';
  dealers.forEach(function(d) {
    h += '<option value="' + d.id + '"' + (selDealer === d.id ? ' selected' : '') + '>' + sanitize(d.name) + '</option>';
  });
  h += '</select></div>';
  h += '<div class="fm-group"><label>📍 Mode</label><select id="vp_mode" class="fm-input">';
  h += '<option value="offline"' + (selMode === 'offline' ? ' selected' : '') + '>🤝 Offline (เข้าพบ)</option>';
  h += '<option value="online"' + (selMode === 'online' ? ' selected' : '') + '>📞 Online (โทร/VDO Call)</option>';
  h += '</select></div>';

  // Link to Task (optional)
  h += '<div class="fm-group"><label>📋 งานที่เกี่ยวข้อง (ถ้ามี)</label><select id="vp_task" class="fm-input">';
  h += '<option value="">-- ไม่ระบุ --</option>';
  var tasks = ST.filter('tasks', function(t) { return t.status === 'active'; });
  tasks.forEach(function(t) {
    var dd = t.dealerId ? ST.getOne('dealers', t.dealerId) : null;
    var label = sanitize(t.title) + (dd ? ' (' + sanitize(dd.name) + ')' : '');
    h += '<option value="' + t.id + '"' + (plan && plan.taskId === t.id ? ' selected' : '') + '>' + label + '</option>';
  });
  h += '</select></div>';

  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><input type="text" id="vp_note" class="fm-input" value="' + sanitize(selNote) + '" placeholder="เช่น Follow-up M400, Demo L3"></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveVisitPlan(\'' + date + '\',\'' + (editId || '') + '\')">💾 บันทึก</button>';
  if (editId) h += '<button class="btn bd" onclick="removeVisitPlan(\'' + editId + '\')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM(editId ? '✏️ แก้ไขแผน Visit' : '➕ วางแผน Visit', h);
}

function saveVisitPlan(date, editId) {
  var dealerId = document.getElementById('vp_dealer').value || '';
  var mode = document.getElementById('vp_mode').value || 'offline';
  var taskId = document.getElementById('vp_task') ? document.getElementById('vp_task').value : '';
  var note = (document.getElementById('vp_note').value || '').trim();

  if (!dealerId && !note) { toast('เลือก Dealer หรือใส่หมายเหตุ'); return; }

  var plans = getVisitPlans();

  if (editId) {
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].id === editId) {
        plans[i].date = date;
        plans[i].dealerId = dealerId;
        plans[i].mode = mode;
        plans[i].taskId = taskId;
        plans[i].note = note;
        break;
      }
    }
  } else {
    plans.push({
      id: 'vp_' + Date.now(),
      date: date,
      dealerId: dealerId,
      mode: mode,
      taskId: taskId,
      note: note
    });
  }

  saveVisitPlans(plans);
  toast(editId ? '💾 แก้ไขแล้ว' : '📅 วางแผนแล้ว');
  closeMForce();
  render();
}

function removeVisitPlan(planId) {
  var plans = getVisitPlans().filter(function(p) { return p.id !== planId; });
  saveVisitPlans(plans);
  toast('🗑️ ลบแล้ว');
  render();
}

function vpGoVisit(planId) {
  var plans = getVisitPlans();
  var plan = null;
  for (var i = 0; i < plans.length; i++) {
    if (plans[i].id === planId) { plan = plans[i]; break; }
  }
  if (!plan) return;

  // Open Visit Form with pre-filled data
  if (typeof showVisitM === 'function') {
    showVisitM(plan.dealerId || '');
    
    // Auto-fill mode after modal opens
    setTimeout(function() {
      var modeEl = document.getElementById('fv_mode');
      if (modeEl && plan.mode) modeEl.value = plan.mode;
    }, 200);
  } else {
    toast('ฟังก์ชัน Visit Form ไม่พบ');
  }
}

function copyVisitPlan() {
  var plans = getVisitPlans();
  var weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 + (vpWeekOffset * 7));
  var dayNames = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

  var t = '📅 Visit Plan — สัปดาห์ ' + fmtDateKey(weekStart) + '\n';
  t += '👤 Siwawong — SIS Distribution (DJI)\n';
  t += '━━━━━━━━━━━━━━━━━━━━\n\n';

  for (var di = 0; di < 5; di++) {
    var dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + di);
    var dayKey = fmtDateKey(dayDate);
    var dayPlans = plans.filter(function(p) { return p.date === dayKey; });

    t += dayNames[di] + ' (' + dayKey + '):\n';
    if (dayPlans.length) {
      dayPlans.forEach(function(p) {
        var dd = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
        t += '  ' + (p.mode === 'offline' ? '🤝' : '📞') + ' ' + (dd ? dd.name : (p.note || '-'));
        if (p.note && dd) t += ' — ' + p.note;
        t += '\n';
      });
    } else {
      t += '  — ว่าง\n';
    }
    t += '\n';
  }

  copyText(t);
  toast('📋 Copy Visit Plan แล้ว!');
}

// ================================================================
// EMAIL DRAFT v2 — Visit Report + Template Management
// ================================================================
var EMAIL_TEMPLATES_DEFAULT = [
  {id: 'visit_summary', icon: '📍', name: 'Visit Summary', desc: 'สรุป Visit สัปดาห์นี้', type: 'auto'},
  {id: 'visit_report', icon: '📋', name: 'Visit Report Email', desc: 'ดึงจาก Visit Report', type: 'visit'},
  {id: 'pipeline_update', icon: '📊', name: 'Pipeline Update', desc: 'อัพเดท Pipeline ส่ง DJI', type: 'auto'},
  {id: 'weekly_report', icon: '📋', name: 'Weekly Report', desc: 'รายงานประจำสัปดาห์', type: 'auto'},
  {id: 'visit_plan', icon: '📅', name: 'Visit Plan', desc: 'แผน Visit สัปดาห์หน้า', type: 'auto'},
  {id: 'forecast_summary', icon: '📦', name: 'Forecast Summary', desc: 'สรุป Forecast ส่ง DJI', type: 'auto'},
  {id: 'quote_followup', icon: '💰', name: 'Quote Follow-up', desc: 'ติดตาม Quotation', type: 'auto'}
];

function getEmailTemplates() {
  var saved = localStorage.getItem('v7_emailTmpl');
  if (saved) { try { return JSON.parse(saved); } catch(e) {} }
  return EMAIL_TEMPLATES_DEFAULT.slice();
}

function saveEmailTemplates(list) {
  localStorage.setItem('v7_emailTmpl', JSON.stringify(list));
}

function rEmailDrafts(el) {
  document.getElementById('pgT').textContent = '📧 Email Draft';
  var templates = getEmailTemplates();

  var h = '';
  h += '<div class="card"><h2>📧 สร้าง Email อัตโนมัติ';
  h += '<span class="ml"><button class="btn bsm bo" onclick="manageEmailTemplates()">⚙️ จัดการ</button></span></h2>';
  h += '<p style="font-size:13px;color:var(--text2);margin-bottom:12px">เลือกประเภท Email → ระบบจะสร้างเนื้อหาให้อัตโนมัติ</p>';

  h += '<div class="email-grid">';
  templates.forEach(function(t) {
    if (t.type === 'visit') {
      h += '<div class="email-tmpl-card" onclick="showVisitReportEmailM()">';
    } else if (t.type === 'custom') {
      h += '<div class="email-tmpl-card" onclick="generateCustomEmailDraft(\'' + t.id + '\')">';
    } else {
      h += '<div class="email-tmpl-card" onclick="generateEmailDraft(\'' + t.id + '\')">';
    }
    h += '<div class="email-tmpl-icon">' + (t.icon || '📧') + '</div>';
    h += '<div class="email-tmpl-name">' + sanitize(t.name || '') + '</div>';
    h += '<div class="email-tmpl-desc">' + sanitize(t.desc || '') + '</div>';
    h += '</div>';
  });
  h += '</div></div>';

  h += '<div id="emailPreview"></div>';

  el.innerHTML = h;
}

function generateEmailDraft(type) {
  var cfg = getConfig();
  var now = new Date();
  var today = _td();
  var subject = '';
  var body = '';
  var to = '';

  if (type === 'visit_summary') {
    var weekData = getWeekData('thisWeek');
    subject = 'Visit Summary — ' + weekData.label + ' — ' + cfg.saleName;
    to = (cfg.emailRecipients && cfg.emailRecipients.visitPlan) ? cfg.emailRecipients.visitPlan.join(', ') : '';
    body = 'Dear All,\n\n';
    body += 'สรุปการ Visit สัปดาห์นี้:\n\n';
    if (weekData.visits.length) {
      weekData.visits.forEach(function(v) {
        var dd = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
        body += '• ' + (v.date || '-') + ' — ' + (dd ? dd.name : '-') + ' (' + (v.mode || '-') + ')\n';
      });
    } else {
      body += '• ไม่มี Visit สัปดาห์นี้\n';
    }
    body += '\nPipeline Update: ' + weekData.pipeUpdates + ' รายการ\n';
    body += 'Follow-up: ' + weekData.followups + ' ครั้ง\n';

  } else if (type === 'pipeline_update') {
    var allPipes = ST.getAll('pipeline');
    var active = allPipes.filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
    var activeAmt = 0;
    active.forEach(function(p) { activeAmt += (Number(p.forecastAmount) || 0); });
    subject = 'DJI Pipeline Update — ' + today + ' — ' + cfg.saleName;
    to = (cfg.emailRecipients && cfg.emailRecipients.onlinePlan) ? cfg.emailRecipients.onlinePlan.join(', ') : '';
    body = 'Dear DJI Team,\n\n';
    body += 'Pipeline Update:\n';
    body += '• Active Projects: ' + active.length + '\n';
    body += '• Total Forecast: ฿' + fmtMoney(activeAmt) + '\n\n';
    body += 'Key Updates:\n';
    var recentLogs = JSON.parse(localStorage.getItem('v7_pipelog') || '[]');
    recentLogs.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    recentLogs.slice(0, 5).forEach(function(l) {
      var pipe = l.pipeId ? ST.getOne('pipeline', l.pipeId) : null;
      body += '• ' + (pipe ? (pipe.projectName || '').substr(0, 30) : '-') + ' — ' + (l.content || '').substr(0, 50) + '\n';
    });

  } else if (type === 'weekly_report') {
    var weekData2 = getWeekData('thisWeek');
    subject = 'Weekly Report — ' + weekData2.label + ' — ' + cfg.saleName;
    body = 'Dear All,\n\n';
    body += '📊 Weekly Report — ' + weekData2.label + '\n\n';
    body += '📍 Visit: ' + weekData2.visits.length + ' ครั้ง\n';
    body += '📞 Follow-up: ' + weekData2.followups + ' ครั้ง\n';
    body += '📋 Pipeline Update: ' + weekData2.pipeUpdates + ' รายการ\n';
    body += '🏆 Win: ' + weekData2.wins.length + ' (฿' + fmtMoney(weekData2.totalWinVal) + ')\n';
    body += '❌ Lost: ' + weekData2.losses.length + '\n';

  } else if (type === 'visit_plan') {
    var plans = getVisitPlans();
    var weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 8);
    var dayNames = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
    subject = 'Visit Plan — สัปดาห์ ' + fmtDateKey(weekStart) + ' — ' + cfg.saleName;
    to = (cfg.emailRecipients && cfg.emailRecipients.visitPlan) ? cfg.emailRecipients.visitPlan.join(', ') : '';
    body = 'Dear All,\n\n';
    body += 'แผน Visit สัปดาห์หน้า:\n\n';
    for (var di = 0; di < 5; di++) {
      var dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + di);
      var dayKey = fmtDateKey(dayDate);
      var dayPlans = plans.filter(function(p) { return p.date === dayKey; });
      body += dayNames[di] + ' (' + dayKey + '):\n';
      if (dayPlans.length) {
        dayPlans.forEach(function(p) {
          var dd = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
          body += '  ' + (p.mode === 'offline' ? '🤝' : '📞') + ' ' + (dd ? dd.name : (p.note || '-')) + '\n';
        });
      } else {
        body += '  — ว่าง\n';
      }
    }

  } else if (type === 'forecast_summary') {
    var allPipes2 = ST.getAll('pipeline');
    var active2 = allPipes2.filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
    subject = 'DJI Forecast Summary — ' + today;
    body = 'Dear DJI Team,\n\n';
    body += 'Forecast Summary:\n\n';
    var byModel = {};
    active2.forEach(function(p) {
      var items = getPipeItems(p);
      items.forEach(function(it) {
        var model = it.model || 'Other';
        if (!byModel[model]) byModel[model] = {qty: 0, amt: 0};
        byModel[model].qty += (Number(it.qty) || 1);
        byModel[model].amt += (Number(it.total) || 0);
      });
    });
    Object.keys(byModel).sort().forEach(function(model) {
      body += '• ' + model + ' x' + byModel[model].qty + ' — ฿' + fmtMoney(byModel[model].amt) + '\n';
    });

  } else if (type === 'quote_followup') {
    var quotes = getQuotations();
    var pending = quotes.filter(function(q) { return q.status === 'pending'; });
    subject = 'Quotation Follow-up — ' + today;
    body = 'Dear Team,\n\n';
    body += 'Quotation ที่ยังรอตอบ (' + pending.length + '):\n\n';
    pending.forEach(function(q) {
      var dd = q.dealerId ? ST.getOne('dealers', q.dealerId) : null;
      body += '• ' + (q.quoteNumber || '-') + ' — ' + (dd ? dd.name : '-') + ' — ฿' + fmtMoney(q.amount) + ' (ส่ง ' + (q.sentDate || '-') + ')\n';
    });
  }

  // Footer
  body += '\n\nBest Regards,\n';
  body += (cfg.saleName || 'Siwawong') + '\n';
  body += 'SIS Distribution (Thailand) PLC\n';
  body += 'DJI Authorized Distributor';

  showEmailPreview(to, subject, body);
}

// ================================================================
// VISIT REPORT EMAIL
// ================================================================
function showVisitReportEmailM() {
  var dealers = ST.getAll('dealers');
  var h = '<div style="max-width:480px">';
  h += '<div class="fm-group"><label>🏪 Dealer *</label><select id="vre_dealer" class="fm-input" onchange="vreLoadVisits()">';
  h += '<option value="">-- เลือก Dealer --</option>';
  dealers.forEach(function(d) {
    h += '<option value="' + d.id + '">' + sanitize(d.name) + '</option>';
  });
  h += '</select></div>';

  h += '<div class="fm-group"><label>📋 Visit Report *</label><select id="vre_visit" class="fm-input">';
  h += '<option value="">-- เลือก Dealer ก่อน --</option>';
  h += '</select></div>';

  h += '<div class="fm-group"><label>📧 To</label><input type="text" id="vre_to" class="fm-input" value="" placeholder="email@company.com"></div>';

  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="generateVisitReportEmail()">📧 สร้าง Email</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('📋 Visit Report Email', h);
}

function vreLoadVisits() {
  var dealerId = document.getElementById('vre_dealer').value;
  var sel = document.getElementById('vre_visit');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- เลือก Visit --</option>';
  if (!dealerId) return;

  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var dVisits = visits.filter(function(v) { return v.dealerId === dealerId; });
  dVisits.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

  dVisits.forEach(function(v) {
    var opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = (v.date || '-') + ' — ' + (v.mode || '-');
    sel.appendChild(opt);
  });
}

function generateVisitReportEmail() {
  var dealerId = document.getElementById('vre_dealer').value;
  var visitId = document.getElementById('vre_visit').value;
  var toEmail = (document.getElementById('vre_to').value || '').trim();

  if (!dealerId || !visitId) { toast('เลือก Dealer และ Visit Report'); return; }

  var dealer = ST.getOne('dealers', dealerId);
  var visit = null;
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  for (var i = 0; i < visits.length; i++) {
    if (visits[i].id === visitId) { visit = visits[i]; break; }
  }
  if (!visit || !dealer) { toast('ไม่พบข้อมูล'); return; }

  var cfg = getConfig();
  var subject = 'Visit Report — ' + sanitize(dealer.name) + ' — ' + (visit.date || '');

  var body = 'Dear All,\n\n';
  body += '📍 Visit Report\n';
  body += '━━━━━━━━━━━━━━━━━━━━\n\n';
  body += 'Dealer: ' + dealer.name + '\n';
  body += 'Date: ' + (visit.date || '-') + '\n';
  body += 'Mode: ' + (visit.mode || '-') + '\n';
  body += 'Sale: ' + (cfg.saleName || 'Siwawong') + '\n\n';

// Topics from topicData (new format)
  if (visit.topicData && visit.topicData.length) {
    body += '📋 ประเด็นที่คุย:\n';
    body += '━━━━━━━━━━━━━━━━━━━━\n\n';
    var cfg2 = getConfig();
    var topicNum = 0;
    visit.topicData.forEach(function(td) {
      if (!td.answered) return;
      topicNum++;
      var topic = null;
      for (var ti = 0; ti < (cfg2.visitTopics || []).length; ti++) {
        if (cfg2.visitTopics[ti].id === td.topicId) { topic = cfg2.visitTopics[ti]; break; }
      }
      var topicName = topic ? topic.name : td.topicId;
      var topicPrompt = topic ? topic.prompt : '';
      var topicIcon = '📝';
      if (topic) {
        if (topic.group === 'sales') topicIcon = '📊';
        else if (topic.group === 'projects') topicIcon = '📁';
        else if (topic.group === 'cert') topicIcon = '📋';
        else if (topic.group === 'feedback') topicIcon = '💬';
        else if (topic.group === 'activities') topicIcon = '📅';
      }

      body += topicNum + '. ' + topicIcon + ' ' + topicName + '\n';
      if (topicPrompt) body += '💡 ' + topicPrompt + '\n';
      var topicContent = td.content || td.summary || td.value || '';
      if (topicContent) body += '📝 ' + topicContent + '\n';
      body += '\n';
    });

  // Fallback: old topics format
  } else if (visit.topics && typeof visit.topics === 'object') {
    body += '📋 ประเด็นที่คุย:\n';
    body += '━━━━━━━━━━━━━━━━━━━━\n\n';
    var topicNames = {
      salesPerformance: 'Sales Performance',
      downstreamPartners: 'Downstream Partners',
      existingSalesOpp: 'Existing Sales Opportunity',
      orderingPlan: 'Ordering Plan',
      upcomingProjects: 'Upcoming Big Projects',
      dockProjects: 'Dock Projects',
      competitorInfo: 'Competitor Info',
      antiDrone: 'Anti-drone',
      eventPlan: 'Event Plan',
      feedback: 'Feedback to SIS & DJI',
      dsec: 'DSEC',
      crm: 'CRM',
      flighthub: 'FlightHub 2',
      lark: 'Lark'
    };

    Object.keys(visit.topics).forEach(function(key) {
      var val = visit.topics[key];
      if (!val) return;
      var topicName = topicNames[key] || key;
      if (typeof val === 'object') {
        if (val.checked || val.content) {
          body += '• ' + topicName + ':\n';
          if (val.content) body += '  ' + val.content + '\n';
          body += '\n';
        }
      } else if (typeof val === 'string' && val.trim()) {
        body += '• ' + topicName + ':\n';
        body += '  ' + val + '\n\n';
      }
    });
  }

   // Revenue
  if (visit.revenue || visit.expectedRevenue) {
    body += '💰 ยอดขาย:\n';
    if (visit.revenue) body += '• ยอดขายปัจจุบัน: ฿' + fmtMoney(visit.revenue) + '\n';
    if (visit.expectedRevenue) body += '• เป้าที่คาด: ฿' + fmtMoney(visit.expectedRevenue) + '\n';
    if (visit.customerSegment) body += '• กลุ่มลูกค้า: ' + visit.customerSegment + '\n';
    body += '\n';
  }
// Pipeline Updates
  if (visit.pipelineUpdates && visit.pipelineUpdates.length) {
    body += '📊 Pipeline Updates:\n';
    visit.pipelineUpdates.forEach(function(pu) {
      var pipe = pu.pipeId ? ST.getOne('pipeline', pu.pipeId) : null;
      body += '• ' + (pipe ? (pipe.projectName || '') : (pu.name || '-'));
      if (pu.newStatus) body += ' — ' + getPipeName(pu.newStatus);
      if (pu.note) body += ' — ' + pu.note;
      body += '\n';
    });
    body += '\n';
  }

  // Forecast
  if (visit.forecastNotes && visit.forecastNotes.length) {
    var hasFc = false;
    visit.forecastNotes.forEach(function(fn) { if (fn.month || fn.amount || fn.items) hasFc = true; });
    if (hasFc) {
      body += '📦 Forecast:\n';
      visit.forecastNotes.forEach(function(fn) {
        if (!fn.month && !fn.amount && !fn.items) return;
        body += '• ' + (fn.month || '-');
        if (fn.amount) body += ' — ฿' + fmtMoney(fn.amount);
        if (fn.items) body += ' — ' + fn.items;
        body += '\n';
      });
      body += '\n';
    }
  }

  // Feedback
  if (visit.feedbackItems && visit.feedbackItems.length) {
    var hasFb = false;
    visit.feedbackItems.forEach(function(f) { if (f && f.trim()) hasFb = true; });
    if (hasFb) {
      body += '💡 Feedback:\n';
      visit.feedbackItems.forEach(function(f, idx) {
        if (!f || !f.trim()) return;
        body += (idx + 1) + '. ' + f + '\n';
      });
      body += '\n';
    }
  }

  // Summary
  if (visit.summary) {
    body += '📝 สรุป:\n';
    body += visit.summary + '\n\n';
  }

  body += '━━━━━━━━━━━━━━━━━━━━\n';
  body += 'Best Regards,\n';
  body += (cfg.saleName || 'Siwawong') + '\n';
  body += 'SIS Distribution (Thailand) PLC\n';
  body += 'DJI Authorized Distributor';

  closeMForce();
  showEmailPreview(toEmail, subject, body);
}

// ================================================================
// EMAIL PREVIEW (shared)
// ================================================================
function showEmailPreview(to, subject, body) {
  var preview = document.getElementById('emailPreview');
  if (!preview) return;

  var ph = '<div class="card"><h2>📧 Email Preview</h2>';
  ph += '<div class="email-field"><label>To:</label><input type="text" id="emailTo" value="' + sanitize(to) + '" class="fm-input"></div>';
  ph += '<div class="email-field"><label>Subject:</label><input type="text" id="emailSubject" value="' + sanitize(subject) + '" class="fm-input"></div>';
  ph += '<div class="email-field"><label>Body:</label><textarea id="emailBody" rows="15" class="fm-input">' + sanitize(body) + '</textarea></div>';
  ph += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  ph += '<button class="btn bp" onclick="copyEmailDraft()">📋 Copy ทั้งหมด</button>';
  ph += '<button class="btn bo" onclick="copyEmailBody()">📋 Copy Body</button>';
  ph += '<button class="btn bo" onclick="openEmailClient()">📧 เปิด Email</button>';
  ph += '</div></div>';

  preview.innerHTML = ph;

  // Scroll to preview
  preview.scrollIntoView({behavior: 'smooth'});
}

function copyEmailDraft() {
  var subject = document.getElementById('emailSubject').value || '';
  var body = document.getElementById('emailBody').value || '';
  var text = 'Subject: ' + subject + '\n\n' + body;
  copyText(text);
  toast('📋 Copy Email แล้ว!');
}

function copyEmailBody() {
  var body = document.getElementById('emailBody').value || '';
  copyText(body);
  toast('📋 Copy Body แล้ว!');
}

function openEmailClient() {
  var to = document.getElementById('emailTo').value || '';
  var subject = encodeURIComponent(document.getElementById('emailSubject').value || '');
  var body = encodeURIComponent(document.getElementById('emailBody').value || '');
  window.open('mailto:' + to + '?subject=' + subject + '&body=' + body);
  toast('📧 เปิด Email Client แล้ว');
}

// ================================================================
// CUSTOM EMAIL TEMPLATE
// ================================================================
function generateCustomEmailDraft(tmplId) {
  var templates = getEmailTemplates();
  var tmpl = null;
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].id === tmplId) { tmpl = templates[i]; break; }
  }
  if (!tmpl) return;

  var cfg = getConfig();
  var subject = (tmpl.subject || tmpl.name || '').replace(/\{sale\}/g, cfg.saleName || 'Siwawong').replace(/\{date\}/g, _td());
  var body = (tmpl.body || '').replace(/\{sale\}/g, cfg.saleName || 'Siwawong').replace(/\{date\}/g, _td());

  showEmailPreview(tmpl.to || '', subject, body);
}

// ================================================================
// EMAIL TEMPLATE MANAGEMENT
// ================================================================
function manageEmailTemplates() {
  var templates = getEmailTemplates();

  var h = '<div style="max-width:500px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<span style="color:var(--text2);font-size:13px">' + templates.length + ' templates</span>';
  h += '<div style="display:flex;gap:6px">';
  h += '<button class="btn-sm btn-blue" onclick="showAddEmailTmplM()">➕ เพิ่ม</button>';
  h += '<button class="btn-sm" onclick="resetEmailTemplates()">🔄 Reset</button>';
  h += '</div></div>';

  if (!templates.length) {
    h += '<div style="text-align:center;padding:20px;color:var(--text2)">ยังไม่มี Template</div>';
  } else {
    h += '<div class="ltm-list">';
    templates.forEach(function(t, i) {
      h += '<div class="ltm-item">';
      h += '<div class="ltm-left"><span class="ltm-icon">' + (t.icon || '📧') + '</span>';
      h += '<div><div class="ltm-name">' + sanitize(t.name || '') + '</div>';
      h += '<div class="ltm-preview">' + sanitize(t.desc || '') + ' • ' + (t.type === 'auto' ? 'Auto' : t.type === 'visit' ? 'Visit Report' : 'Custom') + '</div>';
      h += '</div></div>';
      h += '<div class="ltm-actions">';
      if (t.type === 'custom') h += '<button class="btn-xs" onclick="showEditEmailTmplM(' + i + ')">✏️</button>';
      h += '<button class="btn-xs" onclick="moveEmailTmpl(' + i + ',-1)">⬆️</button>';
      h += '<button class="btn-xs" onclick="moveEmailTmpl(' + i + ',1)">⬇️</button>';
      h += '<button class="btn-xs btn-red" onclick="deleteEmailTmpl(' + i + ')">🗑️</button>';
      h += '</div></div>';
    });
    h += '</div>';
  }

  h += '</div>';
  openM('⚙️ จัดการ Email Template', h);
}

function showAddEmailTmplM() {
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>😊 Icon (Emoji)</label>';
  h += '<input type="text" id="etIcon" class="fm-input" value="📧" maxlength="4" style="width:80px;font-size:24px;text-align:center"></div>';
  h += '<div class="fm-group"><label>📌 ชื่อ Template</label>';
  h += '<input type="text" id="etName" class="fm-input" placeholder="เช่น Monthly Report"></div>';
  h += '<div class="fm-group"><label>📝 คำอธิบาย</label>';
  h += '<input type="text" id="etDesc" class="fm-input" placeholder="รายละเอียดสั้นๆ"></div>';
  h += '<div class="fm-group"><label>📧 To (default)</label>';
  h += '<input type="email" id="etTo" class="fm-input" placeholder="email@company.com"></div>';
  h += '<div class="fm-group"><label>📋 Subject</label>';
  h += '<input type="text" id="etSubject" class="fm-input" placeholder="ใช้ {sale} = ชื่อ Sales, {date} = วันนี้"></div>';
  h += '<div class="fm-group"><label>📝 Body</label>';
  h += '<textarea id="etBody" rows="8" class="fm-input" placeholder="เนื้อหา Email...\n\nใช้ {sale} = ชื่อ Sales\n{date} = วันนี้"></textarea></div>';
  h += '<div style="font-size:11px;color:var(--text2);margin:-8px 0 12px">💡 ตัวแปร: <code>{sale}</code> ชื่อ Sales, <code>{date}</code> วันนี้</div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveNewEmailTmpl()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="manageEmailTemplates()">↩️ กลับ</button>';
  h += '</div></div>';
  openM('➕ เพิ่ม Email Template', h);
}

function saveNewEmailTmpl() {
  var name = (document.getElementById('etName').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }

  var templates = getEmailTemplates();
  templates.push({
    id: 'et_' + Date.now(),
    icon: (document.getElementById('etIcon').value || '📧').trim(),
    name: name,
    desc: (document.getElementById('etDesc').value || '').trim(),
    to: (document.getElementById('etTo').value || '').trim(),
    subject: (document.getElementById('etSubject').value || '').trim(),
    body: (document.getElementById('etBody').value || '').trim(),
    type: 'custom'
  });
  saveEmailTemplates(templates);
  toast('✅ เพิ่ม Template แล้ว');
  manageEmailTemplates();
}

function showEditEmailTmplM(idx) {
  var templates = getEmailTemplates();
  var t = templates[idx];
  if (!t) return;

  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>😊 Icon</label>';
  h += '<input type="text" id="etIcon" class="fm-input" value="' + sanitize(t.icon || '📧') + '" maxlength="4" style="width:80px;font-size:24px;text-align:center"></div>';
  h += '<div class="fm-group"><label>📌 ชื่อ</label>';
  h += '<input type="text" id="etName" class="fm-input" value="' + sanitize(t.name || '') + '"></div>';
  h += '<div class="fm-group"><label>📝 คำอธิบาย</label>';
  h += '<input type="text" id="etDesc" class="fm-input" value="' + sanitize(t.desc || '') + '"></div>';
  h += '<div class="fm-group"><label>📧 To</label>';
  h += '<input type="email" id="etTo" class="fm-input" value="' + sanitize(t.to || '') + '"></div>';
  h += '<div class="fm-group"><label>📋 Subject</label>';
  h += '<input type="text" id="etSubject" class="fm-input" value="' + sanitize(t.subject || '') + '"></div>';
  h += '<div class="fm-group"><label>📝 Body</label>';
  h += '<textarea id="etBody" rows="8" class="fm-input">' + sanitize(t.body || '') + '</textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveEditEmailTmpl(' + idx + ')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="manageEmailTemplates()">↩️ กลับ</button>';
  h += '</div></div>';
  openM('✏️ แก้ไข Email Template', h);
}

function saveEditEmailTmpl(idx) {
  var templates = getEmailTemplates();
  if (!templates[idx]) return;
  templates[idx].icon = (document.getElementById('etIcon').value || '📧').trim();
  templates[idx].name = (document.getElementById('etName').value || '').trim();
  templates[idx].desc = (document.getElementById('etDesc').value || '').trim();
  templates[idx].to = (document.getElementById('etTo').value || '').trim();
  templates[idx].subject = (document.getElementById('etSubject').value || '').trim();
  templates[idx].body = (document.getElementById('etBody').value || '').trim();
  saveEmailTemplates(templates);
  toast('💾 บันทึกแล้ว');
  manageEmailTemplates();
}

function deleteEmailTmpl(idx) {
  var templates = getEmailTemplates();
  var name = templates[idx] ? templates[idx].name : '';
  if (!confirm('ลบ "' + name + '"?')) return;
  templates.splice(idx, 1);
  saveEmailTemplates(templates);
  toast('🗑️ ลบแล้ว');
  manageEmailTemplates();
}

function moveEmailTmpl(idx, dir) {
  var templates = getEmailTemplates();
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= templates.length) return;
  var tmp = templates[idx];
  templates[idx] = templates[newIdx];
  templates[newIdx] = tmp;
  saveEmailTemplates(templates);
  manageEmailTemplates();
}

function resetEmailTemplates() {
  if (!confirm('⚠️ Reset เป็น Template เริ่มต้น?')) return;
  localStorage.removeItem('v7_emailTmpl');
  toast('🔄 Reset แล้ว');
  manageEmailTemplates();
}
// ================================================================
// ADMIN: VISIT TOPICS MANAGEMENT
// ================================================================
function showAdminVisitTopics() {
  var cfg = getConfig();
  var groups = cfg.visitTopicGroups || [];
  var topics = cfg.visitTopics || [];

  var h = '<div style="max-width:550px">';

  // Groups
  h += '<div style="font-weight:700;margin-bottom:8px">📂 Groups</div>';
  groups.forEach(function(g, gi) {
    h += '<div class="admin-row" style="display:flex;align-items:center;gap:4px">';
    h += '<span style="color:var(--text2);font-size:11px;font-weight:700;min-width:20px;text-align:center">' + (gi + 1) + '</span>';
    h += '<input type="text" value="' + sanitize(g.id) + '" id="vtg_id_' + gi + '" style="width:60px" readonly>';
    h += '<input type="text" value="' + sanitize(g.name) + '" id="vtg_nm_' + gi + '" style="flex:1">';
    h += '<label style="font-size:10px;white-space:nowrap"><input type="checkbox" id="vtg_req_' + gi + '"' + (g.alwaysAsk ? ' checked' : '') + '> Always</label>';
    h += '<button class="btn bsm bo" onclick="moveVTGroup(' + gi + ',-1)" style="padding:2px 6px">⬆️</button>';
    h += '<button class="btn bsm bo" onclick="moveVTGroup(' + gi + ',1)" style="padding:2px 6px">⬇️</button>';
    h += '<button class="btn bsm bd" onclick="removeVTGroup(' + gi + ')">✕</button>';
    h += '</div>';
  });
  h += '<button class="btn-sm bp" onclick="addVTGroup()" style="margin:6px 0">➕ เพิ่ม Group</button>';

  h += '<div style="border-top:1px solid var(--border);margin:12px 0"></div>';

  // Topics
  h += '<div style="font-weight:700;margin-bottom:8px">📋 Topics</div>';
  
  groups.forEach(function(g) {
    var grpTopics = topics.filter(function(t) { return t.group === g.id; });
    h += '<div style="font-size:12px;font-weight:600;color:var(--accent);margin:10px 0 4px">' + sanitize(g.name) + ' (' + grpTopics.length + ')</div>';
    
    grpTopics.forEach(function(t) {
      var tIdx = topics.indexOf(t);
      h += '<div class="admin-row" style="display:flex;align-items:flex-start;gap:4px;padding:6px">';
      h += '<span style="color:var(--text2);font-size:11px;font-weight:700;min-width:20px;text-align:center;margin-top:8px">' + (tIdx + 1) + '</span>';
      h += '<div style="flex:1">';
      h += '<div style="display:flex;gap:4px;margin-bottom:3px">';
      h += '<input type="text" value="' + sanitize(t.name) + '" id="vt_nm_' + tIdx + '" style="flex:1" placeholder="ชื่อหัวข้อ">';
      h += '<select id="vt_grp_' + tIdx + '" style="width:80px">';
      groups.forEach(function(gg) {
        h += '<option value="' + gg.id + '"' + (t.group === gg.id ? ' selected' : '') + '>' + sanitize(gg.name.replace(/[📊📁📋💬]/g, '').trim()) + '</option>';
      });
      h += '</select>';
      h += '</div>';
      h += '<input type="text" value="' + sanitize(t.prompt) + '" id="vt_pr_' + tIdx + '" style="width:100%;font-size:11px" placeholder="💡 Prompt">';
      h += '</div>';
      h += '<label style="font-size:10px;white-space:nowrap;margin-top:8px"><input type="checkbox" id="vt_req_' + tIdx + '"' + (t.required ? ' checked' : '') + '> Required</label>';
      h += '<button class="btn bsm bo" onclick="moveVTopic(' + tIdx + ',-1)" style="padding:2px 6px">⬆️</button>';
      h += '<button class="btn bsm bo" onclick="moveVTopic(' + tIdx + ',1)" style="padding:2px 6px">⬇️</button>';
      h += '<button class="btn bsm bd" onclick="removeVTopic(' + tIdx + ')">✕</button>';
      h += '</div>';
    });
  });

  h += '<div style="display:flex;gap:6px;margin-top:8px">';
  h += '<button class="btn-sm bp" onclick="addVTopic()">➕ เพิ่ม Topic</button>';
  h += '</div>';

  h += '<div style="border-top:1px solid var(--border);margin:12px 0"></div>';
  h += '<div style="display:flex;gap:6px">';
  h += '<button class="btn btn-blue" onclick="saveVisitTopicsAdmin()">💾 บันทึกทั้งหมด</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '<button class="btn bo" onclick="resetVisitTopics()">🔄 Reset</button>';
  h += '</div></div>';

  openM('⚙️ จัดการ Visit Topics', h);
}

function saveVisitTopicsAdmin() {
  var cfg = getConfig();
  
  // Save groups
  var newGroups = [];
  for (var gi = 0; gi < (cfg.visitTopicGroups || []).length; gi++) {
    var gId = document.getElementById('vtg_id_' + gi);
    var gName = document.getElementById('vtg_nm_' + gi);
    var gReq = document.getElementById('vtg_req_' + gi);
    if (!gId || !gName) continue;
    newGroups.push({
      id: gId.value.trim(),
      name: gName.value.trim(),
      alwaysAsk: gReq ? gReq.checked : false
    });
  }

  // Save topics
  var newTopics = [];
  for (var ti = 0; ti < (cfg.visitTopics || []).length; ti++) {
    var tName = document.getElementById('vt_nm_' + ti);
    var tGrp = document.getElementById('vt_grp_' + ti);
    var tPr = document.getElementById('vt_pr_' + ti);
    var tReq = document.getElementById('vt_req_' + ti);
    if (!tName) continue;
    var name = tName.value.trim();
    if (!name) continue;
    newTopics.push({
      id: cfg.visitTopics[ti].id,
      name: name,
      group: tGrp ? tGrp.value : '',
      prompt: tPr ? tPr.value.trim() : '',
      required: tReq ? tReq.checked : false
    });
  }

  cfg.visitTopicGroups = newGroups;
  cfg.visitTopics = newTopics;
  saveConfig(cfg);
  toast('💾 บันทึก Visit Topics แล้ว');
  closeMForce();
  render();
}

function addVTGroup() {
  var cfg = getConfig();
  var id = 'grp_' + Date.now();
  if (!cfg.visitTopicGroups) cfg.visitTopicGroups = [];
  cfg.visitTopicGroups.push({id: id, name: '📋 New Group', alwaysAsk: false});
  saveConfig(cfg);
  showAdminVisitTopics();
}

function removeVTGroup(idx) {
  var cfg = getConfig();
  var name = cfg.visitTopicGroups[idx] ? cfg.visitTopicGroups[idx].name : '';
  if (!confirm('ลบ Group "' + name + '"? (Topics ในกลุ่มจะไม่ถูกลบ)')) return;
  cfg.visitTopicGroups.splice(idx, 1);
  saveConfig(cfg);
  showAdminVisitTopics();
}

function moveVTGroup(idx, dir) {
  var cfg = getConfig();
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= cfg.visitTopicGroups.length) return;
  var tmp = cfg.visitTopicGroups[idx];
  cfg.visitTopicGroups[idx] = cfg.visitTopicGroups[newIdx];
  cfg.visitTopicGroups[newIdx] = tmp;
  saveConfig(cfg);
  showAdminVisitTopics();
}

function addVTopic() {
  var cfg = getConfig();
  var id = 'topic_' + Date.now();
  var firstGroup = cfg.visitTopicGroups && cfg.visitTopicGroups.length ? cfg.visitTopicGroups[0].id : '';
  if (!cfg.visitTopics) cfg.visitTopics = [];
  cfg.visitTopics.push({id: id, name: 'New Topic', group: firstGroup, prompt: '', required: false});
  saveConfig(cfg);
  showAdminVisitTopics();
}

function removeVTopic(idx) {
  var cfg = getConfig();
  var name = cfg.visitTopics[idx] ? cfg.visitTopics[idx].name : '';
  if (!confirm('ลบ Topic "' + name + '"?')) return;
  cfg.visitTopics.splice(idx, 1);
  saveConfig(cfg);
  showAdminVisitTopics();
}

function moveVTopic(idx, dir) {
  var cfg = getConfig();
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= cfg.visitTopics.length) return;
  var tmp = cfg.visitTopics[idx];
  cfg.visitTopics[idx] = cfg.visitTopics[newIdx];
  cfg.visitTopics[newIdx] = tmp;
  saveConfig(cfg);
  showAdminVisitTopics();
}

function resetVisitTopics() {
  if (!confirm('⚠️ Reset เป็นค่าเริ่มต้น?')) return;
  var cfg = getConfig();
  var def = JSON.parse(JSON.stringify(DEF_CONFIG));
  cfg.visitTopics = def.visitTopics;
  cfg.visitTopicGroups = def.visitTopicGroups;
  saveConfig(cfg);
  toast('🔄 Reset แล้ว');
  showAdminVisitTopics();
}
// ================================================================
// CLIENT PRESENTATION VIEW
// ================================================================
var clientViewPipeId = '';

function openClientView(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  
  var url = window.location.href.split('?')[0] + '?clientView=' + dealerId;
  var win = window.open('', '_blank');
  if (!win) { toast('กรุณาอนุญาต Popup'); return; }
  
  var html = buildClientViewHTML(dealerId, '');
  win.document.write(html);
  win.document.close();
}

function buildClientViewHTML(dealerId, pipeId) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return '<h1>Not Found</h1>';
  
  var allPipes = ST.pipelineByDealer(dealerId);
  var activePipes = allPipes.filter(function(p) { return ['lost','on_hold'].indexOf(p.status) === -1; });
  var cfg = getConfig();
  
  // Collect models
  var modelSummary = {};
  var totalQty = 0;
  activePipes.forEach(function(p) {
    var items = getPipeItems(p);
    items.forEach(function(it) {
      var model = it.model || 'Other';
      if (!modelSummary[model]) modelSummary[model] = 0;
      var qty = Number(it.qty) || 1;
      modelSummary[model] += qty;
      totalQty += qty;
    });
  });

  // Build page
  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
  h += '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
  h += '<title>Pipeline — ' + d.name + '</title>';
  h += '<style>' + getClientViewCSS() + '</style>';
  h += '</head><body>';
  
  h += '<div class="cv-container">';
  
  // Header
  h += '<div class="cv-header">';
  h += '<div class="cv-logo">🚁 DJI Enterprise</div>';
  h += '<div class="cv-dealer-name">' + sanitize(d.name) + '</div>';
  h += '<div class="cv-dealer-sub">DJI Authorized Dealer</div>';
  h += '</div>';

  if (pipeId) {
    // ============ PROJECT DETAIL VIEW ============
    h += buildClientProjectDetail(pipeId, dealerId);
  } else {
    // ============ OVERVIEW VIEW ============
    
    // Stats
    h += '<div class="cv-stats">';
    h += '<div class="cv-stat"><div class="cv-stat-val">' + activePipes.length + '</div><div class="cv-stat-label">Projects</div></div>';
    h += '<div class="cv-stat"><div class="cv-stat-val">' + totalQty + '</div><div class="cv-stat-label">Units</div></div>';
    h += '<div class="cv-stat"><div class="cv-stat-val">' + Object.keys(modelSummary).length + '</div><div class="cv-stat-label">Models</div></div>';
    h += '</div>';

    // Projects Table
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">📊 Projects Overview</div>';
    h += '<table class="cv-table">';
    h += '<div style="margin-bottom:8px;text-align:right"><button class="cv-toggle-btn" onclick="toggleCVValue()">💰 <span id="cvValLabel">แสดงมูลค่า</span></button></div>';
h += '<table class="cv-table">';
h += '<thead><tr><th>#</th><th>Project</th><th>End User</th><th>Products</th><th class="cv-val-col" style="display:none">Value</th><th>Status</th><th>Bidding</th><th>Shipment</th><th>Action</th></tr></thead>';
    h += '<tbody>';
    
    activePipes.sort(function(a, b) {
      var statusOrder = ['bidding','negotiation','quotation','tor_review','prospect','win','ordered','delivered','recurring'];
      var ia = statusOrder.indexOf(a.status); if (ia === -1) ia = 99;
      var ib = statusOrder.indexOf(b.status); if (ib === -1) ib = 99;
      return ia - ib;
    });

    activePipes.forEach(function(p, idx) {
      var items = getPipeItems(p);
      var modelText = items.map(function(it) { return (it.model || '-') + (it.qty > 1 ? ' x' + it.qty : ''); }).join(', ');
      var statusLabel = getClientStatusLabel(p.status);
      
      h += '<tr class="cv-row" onclick="showCVDetail(\'' + p.id + '\',\'' + dealerId + '\')">';
      h += '<td class="cv-num">' + (idx + 1) + '</td>';
      h += '<td class="cv-project">' + sanitize((p.projectName || '').substr(0, 40)) + '</td>';
      h += '<td>' + sanitize((p.endUserTH || p.endUserEN || '').substr(0, 25)) + '</td>';
      h += '<td class="cv-model">' + sanitize(modelText) + '</td>';
      h += '<td class="cv-val-col" style="display:none">' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</td>';
      h += '<td>' + statusLabel + '</td>';
      h += '<td>' + (p.biddingDate ? fDShort(p.biddingDate) : '-') + '</td>';
      h += '<td>' + (p.shipmentDate ? fDShort(p.shipmentDate) : '-') + '</td>';
      h += '<td>' + (p.nextAction ? sanitize((p.nextAction || '').substr(0, 20)) : '-') + '</td>';
      h += '</tr>';
    });
    
    h += '</tbody></table></div>';

    // Products Summary
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">📦 Products Summary</div>';
    h += '<div class="cv-products">';
    var modelList = Object.keys(modelSummary).sort(function(a, b) { return modelSummary[b] - modelSummary[a]; });
    var maxQty = modelList.length ? modelSummary[modelList[0]] : 1;
    modelList.forEach(function(model) {
      var qty = modelSummary[model];
      var pct = Math.max(10, Math.round(qty / maxQty * 100));
      h += '<div class="cv-product-row">';
      h += '<div class="cv-product-name">' + sanitize(model) + ' <span class="cv-product-qty">x' + qty + '</span></div>';
      h += '<div class="cv-product-bar"><div class="cv-product-fill" style="width:' + pct + '%"></div></div>';
      h += '</div>';
    });
    h += '</div></div>';

    // Action Items
    var actions = getPipeActions().filter(function(a) {
      return a.status === 'pending';
    });
    var dealerActions = [];
    actions.forEach(function(a) {
      var pipe = ST.getOne('pipeline', a.pipeId);
      if (pipe && pipe.dealerId === dealerId) {
        dealerActions.push({action: a, pipe: pipe});
      }
    });

    if (dealerActions.length) {
      h += '<div class="cv-section">';
      h += '<div class="cv-section-title">🎯 Action Items (' + dealerActions.length + ')</div>';
      dealerActions.forEach(function(da) {
        var now = new Date();
        now.setHours(0, 0, 0, 0);
        var due = ftParseDate(da.action.dueDate);
        var daysLeft = due ? Math.ceil((due - now) / 86400000) : 999;
        var urgClass = daysLeft < 0 ? 'cv-action-overdue' : daysLeft <= 3 ? 'cv-action-urgent' : '';

        h += '<div class="cv-action ' + urgClass + '">';
        h += '<div class="cv-action-text">⏳ ' + sanitize(da.action.text) + '</div>';
        h += '<div class="cv-action-meta">📊 ' + sanitize((da.pipe.projectName || '').substr(0, 30));
        if (da.action.dueDate) h += ' • 📅 ' + da.action.dueDate;
        if (daysLeft < 0) h += ' <span class="cv-overdue-badge">เกิน ' + Math.abs(daysLeft) + ' วัน</span>';
        else if (daysLeft <= 3) h += ' <span class="cv-urgent-badge">อีก ' + daysLeft + ' วัน</span>';
        h += '</div></div>';
      });
      h += '</div>';
    }
  }

  // Footer
  h += '<div class="cv-footer">';
  h += '<div>Powered by SIS Distribution (Thailand) PLC — DJI Authorized Distributor</div>';
  h += '<div>' + (cfg.saleName || 'Siwawong') + ' | ' + _td() + '</div>';
  h += '</div>';

  // Embed data + functions for client view
  h += '<script>';
  h += 'var CV_DATA = ' + JSON.stringify({
    dealer: d,
    pipes: activePipes.map(function(p) {
      return {
        id: p.id,
        projectName: p.projectName,
        endUserTH: p.endUserTH,
        endUserEN: p.endUserEN,
        unitType: p.unitType,
        status: p.status,
        biddingDate: p.biddingDate,
        shipmentDate: p.shipmentDate,
        tor: p.tor,
        nextAction: p.nextAction,
        items: getPipeItems(p),
        actions: getPipeActions().filter(function(a) { return a.pipeId === p.id && a.status === 'pending'; }),
        logs: ST.pipeLogsByPipe(p.id).filter(function(l) {
          var safeTypes = ["update","progress","status_change","win","action"];
          if (safeTypes.indexOf(l.type) === -1) return false;
          var c = (l.content || "").toLowerCase();
          if (c.indexOf("forecast") !== -1 || c.indexOf("ราคา") !== -1 || c.indexOf("price") !== -1 || c.indexOf("lost") !== -1 || c.indexOf("หมายเหตุ") !== -1) return false;
          return true;
        }).slice(0, 10)
      };
    }),
    config: {saleName: cfg.saleName}
  }) + ';';

  h += 'function showCVDetail(pipeId, dealerId) {';
  h += '  var p = null;';
  h += '  for (var i = 0; i < CV_DATA.pipes.length; i++) { if (CV_DATA.pipes[i].id === pipeId) { p = CV_DATA.pipes[i]; break; } }';
  h += '  if (!p) return;';
  h += '  var container = document.querySelector(".cv-container");';
  h += '  var headerHtml = document.querySelector(".cv-header").outerHTML;';
  h += '  var footerHtml = document.querySelector(".cv-footer").outerHTML;';
  h += '  var h = headerHtml;';
  h += '  h += \'<div class="cv-back" onclick="showCVOverview()">← กลับ</div>\';';
  h += '  h += \'<div class="cv-section"><div class="cv-section-title">📊 \' + esc(p.projectName || "-") + \'</div>\';';
  h += '  h += \'<div class="cv-detail-grid">\';';
  h += '  h += \'<div class="cv-detail-item"><div class="cv-detail-label">Status</div><div class="cv-detail-val">\' + getStatusLabel(p.status) + \'</div></div>\';';
  h += '  h += \'<div class="cv-detail-item"><div class="cv-detail-label">End User</div><div class="cv-detail-val">\' + esc(p.endUserTH || p.endUserEN || "-") + \'</div></div>\';';
  h += '  h += \'<div class="cv-detail-item"><div class="cv-detail-label">Unit Type</div><div class="cv-detail-val">\' + (p.unitType || "-") + \'</div></div>\';';
  h += '  h += \'<div class="cv-detail-item"><div class="cv-detail-label">Bidding</div><div class="cv-detail-val">\' + (p.biddingDate || "-") + \'</div></div>\';';
  h += '  h += \'<div class="cv-detail-item"><div class="cv-detail-label">Shipment</div><div class="cv-detail-val">\' + (p.shipmentDate || "-") + \'</div></div>\';';
  h += '  h += \'<div class="cv-detail-item"><div class="cv-detail-label">TOR</div><div class="cv-detail-val">\' + (p.tor || "-") + \'</div></div>\';';
  h += '  h += \'</div></div>\';';
  
  // Products
  h += '  if (p.items && p.items.length) {';
  h += '    h += \'<div class="cv-section"><div class="cv-section-title">📦 Products (\' + p.items.length + \')</div>\';';
  h += '    h += \'<table class="cv-table"><thead><tr><th>#</th><th>Model</th><th>QTY</th></tr></thead><tbody>\';';
  h += '    p.items.forEach(function(it, idx) {';
  h += '      h += \'<tr><td class="cv-num">\' + (idx+1) + \'</td><td>\' + esc(it.model || "-") + \'</td><td>\' + (it.qty || 1) + \'</td></tr>\';';
  h += '    });';
  h += '    h += \'</tbody></table></div>\';';
  h += '  }';
  
  // Actions
  h += '  if (p.actions && p.actions.length) {';
  h += '    h += \'<div class="cv-section"><div class="cv-section-title">🎯 Action Items (\' + p.actions.length + \')</div>\';';
  h += '    p.actions.forEach(function(a) {';
  h += '      h += \'<div class="cv-action"><div class="cv-action-text">⏳ \' + esc(a.text) + \'</div>\';';
  h += '      if (a.dueDate) h += \'<div class="cv-action-meta">📅 กำหนด: \' + a.dueDate + \'</div>\';';
  h += '      h += \'</div>\';';
  h += '    });';
  h += '    h += \'</div>\';';
  h += '  }';
  
  // Logs
  h += '  if (p.logs && p.logs.length) {';
  h += '    h += \'<div class="cv-section"><div class="cv-section-title">📝 Updates (\' + p.logs.length + \')</div>\';';
  h += '    p.logs.forEach(function(l) {';
  h += '      var icon = l.type==="progress"?"🟢":l.type==="win"?"✅":l.type==="status_change"?"🔄":"📝";';
  h += '      var dateStr = l.date ? l.date.split("T")[0] : "-";';
  h += '      h += \'<div class="cv-log"><span class="cv-log-date">\' + dateStr + \'</span><span class="cv-log-icon">\' + icon + \'</span><span class="cv-log-text">\' + esc((l.content||"").substr(0,80)) + \'</span></div>\';';
  h += '    });';
  h += '    h += \'</div>\';';
  h += '  }';
h += '  h += \'<div class="cv-section"><div class="cv-section-title">✏️ เพิ่ม Update</div>\';';
h += '  h += \'<div style="display:flex;gap:6px"><input type="text" id="cvUpdateInput" placeholder="พิมพ์ Update..." style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#e0e6f0;font-size:13px"><button onclick="saveCVUpdate(\\x27\'+p.id+\'\\x27)" style="padding:8px 16px;border-radius:8px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-size:13px">💾 Save</button></div>\';';
h += '  h += \'<div style="font-size:11px;color:#8892b0;margin-top:4px">💡 Update จะบันทึกไป Pipeline Log อัตโนมัติ</div>\';';
h += '  h += \'</div>\';';
  
  h += '  h += footerHtml;';
  h += '  container.innerHTML = h;';
  h += '}';
  
h += 'function showCVOverview(){var c=document.querySelector(".cv-container");var header=CV_DATA.dealer;var cfg=CV_DATA.config;var pipes=CV_DATA.pipes;var h2="";';
h += 'h2+=\'<div class="cv-header"><div class="cv-logo">🚁 DJI Enterprise</div><div class="cv-dealer-name">\'+esc(header.name)+\'</div><div class="cv-dealer-sub">DJI Authorized Dealer</div></div>\';';
h += 'var totalQty=0;var models={};pipes.forEach(function(p){(p.items||[]).forEach(function(it){var m=it.model||"Other";if(!models[m])models[m]=0;var q=it.qty||1;models[m]+=q;totalQty+=q;});});';
h += 'h2+=\'<div class="cv-stats"><div class="cv-stat"><div class="cv-stat-val">\'+pipes.length+\'</div><div class="cv-stat-label">Projects</div></div><div class="cv-stat"><div class="cv-stat-val">\'+totalQty+\'</div><div class="cv-stat-label">Units</div></div><div class="cv-stat"><div class="cv-stat-val">\'+Object.keys(models).length+\'</div><div class="cv-stat-label">Models</div></div></div>\';';
h += 'h2+=\'<div class="cv-section"><div class="cv-section-title">📊 Projects Overview</div><table class="cv-table"><thead><tr><th>#</th><th>Project</th><th>End User</th><th>Products</th><th>Status</th><th>Bidding</th><th>Shipment</th><th>Action</th></tr></thead><tbody>\';';
h += 'pipes.forEach(function(p,idx){var mt=(p.items||[]).map(function(it){return(it.model||"-")+(it.qty>1?" x"+it.qty:"");}).join(", ");';
h += 'h2+=\'<tr class="cv-row" onclick="showCVDetail(\\x27\'+p.id+\'\\x27,\\x27\'+header.id+\'\\x27)"><td class="cv-num">\'+(idx+1)+\'</td><td class="cv-project">\'+esc((p.projectName||"").substr(0,40))+\'</td><td>\'+esc((p.endUserTH||p.endUserEN||"").substr(0,25))+\'</td><td class="cv-model">\'+esc(mt)+\'</td><td>\'+getStatusLabel(p.status)+\'</td><td>\'+(p.biddingDate||"-")+\'</td><td>\'+(p.shipmentDate||"-")+\'</td><td>\'+(p.nextAction?esc((p.nextAction||"").substr(0,20)):"-")+\'</td></tr>\';});';
h += 'h2+=\'</tbody></table></div>\';';
h += 'h2+=\'<div class="cv-section"><div class="cv-section-title">📦 Products Summary</div><div class="cv-products">\';';
h += 'var ml=Object.keys(models).sort(function(a,b){return models[b]-models[a];});var mx=ml.length?models[ml[0]]:1;';
h += 'ml.forEach(function(m){var pct=Math.max(10,Math.round(models[m]/mx*100));h2+=\'<div class="cv-product-row"><div class="cv-product-name">\'+esc(m)+\' <span class="cv-product-qty">x\'+models[m]+\'</span></div><div class="cv-product-bar"><div class="cv-product-fill" style="width:\'+pct+\'%"></div></div></div>\';});';
h += 'h2+=\'</div></div>\';';
h += 'h2+=\'<div class="cv-footer"><div>Powered by SIS Distribution (Thailand) PLC — DJI Authorized Distributor</div><div>\'+(cfg.saleName||"Siwawong")+\'</div></div>\';';
h += 'c.innerHTML=h2;}';
  h += 'var cvShowVal=false;';
  h += 'function toggleCVValue(){cvShowVal=!cvShowVal;var cols=document.querySelectorAll(".cv-val-col");for(var i=0;i<cols.length;i++){cols[i].style.display=cvShowVal?"table-cell":"none";}var lbl=document.getElementById("cvValLabel");if(lbl)lbl.textContent=cvShowVal?"ซ่อนมูลค่า":"แสดงมูลค่า";}';
h += 'var cvShowVal=false;';
h += 'function toggleCVValue(){cvShowVal=!cvShowVal;var cols=document.querySelectorAll(".cv-val-col");for(var i=0;i<cols.length;i++){cols[i].style.display=cvShowVal?"table-cell":"none";}var lbl=document.getElementById("cvValLabel");if(lbl)lbl.textContent=cvShowVal?"ซ่อนมูลค่า":"แสดงมูลค่า";}';
h += 'function saveCVUpdate(pipeId){var inp=document.getElementById("cvUpdateInput");if(!inp||!inp.value.trim()){alert("กรุณาใส่ข้อมูล");return;}var content=inp.value.trim();';
h += 'var allData=JSON.parse(localStorage.getItem("v7_pipelog")||"[]");';
h += 'var now=new Date();var date=now.getFullYear()+"-"+(now.getMonth()+1<10?"0":"")+(now.getMonth()+1)+"-"+(now.getDate()<10?"0":"")+now.getDate()+"T"+now.toTimeString().slice(0,8);';
h += 'allData.unshift({id:"pl_"+Date.now(),pipeId:pipeId,type:"update",content:"📝 "+content,date:date});';
h += 'localStorage.setItem("v7_pipelog",JSON.stringify(allData));';
h += 'inp.value="";';
h += 'var p=null;for(var i=0;i<CV_DATA.pipes.length;i++){if(CV_DATA.pipes[i].id===pipeId){p=CV_DATA.pipes[i];break;}}';
h += 'if(p){p.logs.unshift({type:"update",content:"📝 "+content,date:date});showCVDetail(pipeId,CV_DATA.dealer.id);}';
h += 'alert("✅ บันทึก Update แล้ว!");}';
  h += 'function esc(s){if(!s)return"";return String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;");}';
  h += 'function getStatusLabel(s){var m={"prospect":"🔵 Prospect","tor_review":"🟣 TOR Review","quotation":"🟠 Quotation","bidding":"🟡 Bidding","negotiation":"🔵 Negotiation","win":"🟢 Win","ordered":"🟢 Ordered","delivered":"✅ Delivered","recurring":"🔄 Recurring"};return\'<span class="cv-status cv-st-\'+(s||"")+"\\\">"+(m[s]||s)+"</span>";}';
  h += '<\/script>';
  h += '</body></html>';
  return h;
}

function buildClientProjectDetail(pipeId, dealerId) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return '<div class="cv-section"><div class="cv-section-title">ไม่พบข้อมูล</div></div>';
  
  var cfg = getConfig();
  var items = getPipeItems(p);
  var logs = ST.pipeLogsByPipe(p.id);
  var actions = getPipeActions().filter(function(a) { return a.pipeId === pipeId && a.status === 'pending'; });

  var h = '';

  // Back button
  h += '<div class="cv-back" onclick="location.reload()">← กลับ</div>';

  // Project Header
  h += '<div class="cv-section">';
  h += '<div class="cv-section-title">📊 ' + sanitize(p.projectName || '-') + '</div>';
  
  h += '<div class="cv-detail-grid">';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Status</div><div class="cv-detail-val">' + getClientStatusLabel(p.status) + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">End User</div><div class="cv-detail-val">' + sanitize(p.endUserTH || p.endUserEN || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Unit Type</div><div class="cv-detail-val">' + (p.unitType || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Bidding Date</div><div class="cv-detail-val">' + (p.biddingDate || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">Shipment Date</div><div class="cv-detail-val">' + (p.shipmentDate || '-') + '</div></div>';
  h += '<div class="cv-detail-item"><div class="cv-detail-label">TOR</div><div class="cv-detail-val">' + (p.tor || '-') + '</div></div>';
  h += '</div></div>';

  // Products
  if (items.length) {
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">📦 Products (' + items.length + ')</div>';
    h += '<table class="cv-table"><thead><tr><th>#</th><th>Model</th><th>QTY</th></tr></thead><tbody>';
    items.forEach(function(it, idx) {
      h += '<tr><td class="cv-num">' + (idx + 1) + '</td><td>' + sanitize(it.model || '-') + '</td><td>' + (it.qty || 1) + '</td></tr>';
    });
    h += '</tbody></table></div>';
  }

  // Action Items
  if (actions.length) {
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">🎯 Action Items (' + actions.length + ')</div>';
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    actions.forEach(function(a) {
      var due = ftParseDate(a.dueDate);
      var daysLeft = due ? Math.ceil((due - now) / 86400000) : 999;
      var urgClass = daysLeft < 0 ? 'cv-action-overdue' : daysLeft <= 3 ? 'cv-action-urgent' : '';
      h += '<div class="cv-action ' + urgClass + '">';
      h += '<div class="cv-action-text">⏳ ' + sanitize(a.text) + '</div>';
      if (a.dueDate) h += '<div class="cv-action-meta">📅 กำหนด: ' + a.dueDate + '</div>';
      h += '</div>';
    });
    h += '</div>';
  }

  // Update Log (filtered)
  var safeTypes = ['update', 'progress', 'status_change', 'win', 'action'];
  var filteredLogs = logs.filter(function(l) {
    if (safeTypes.indexOf(l.type) === -1 && l.type !== 'note') return false;
    if (l.type === 'note') return false;
    var content = (l.content || '').toLowerCase();
    if (content.indexOf('forecast') !== -1) return false;
    if (content.indexOf('ราคา') !== -1) return false;
    if (content.indexOf('price') !== -1) return false;
    if (content.indexOf('lost') !== -1) return false;
    if (content.indexOf('หมายเหตุ') !== -1) return false;
    if (content.indexOf('remark') !== -1) return false;
    return true;
  });

  if (filteredLogs.length) {
    h += '<div class="cv-section">';
    h += '<div class="cv-section-title">📝 Updates (' + filteredLogs.length + ')</div>';
    filteredLogs.slice(0, 10).forEach(function(l) {
      var dateStr = l.date ? l.date.split('T')[0] : '-';
      var icon = l.type === 'progress' ? '🟢' : l.type === 'win' ? '✅' : l.type === 'status_change' ? '🔄' : l.type === 'action' ? '⏳' : '📝';
      h += '<div class="cv-log">';
      h += '<span class="cv-log-date">' + dateStr + '</span>';
      h += '<span class="cv-log-icon">' + icon + '</span>';
      h += '<span class="cv-log-text">' + sanitize((l.content || '').substr(0, 80)) + '</span>';
      h += '</div>';
    });
    h += '</div>';
  }

  return h;
}

function getClientStatusLabel(status) {
  var labels = {
    prospect: '<span class="cv-status cv-st-prospect">🔵 Prospect</span>',
    tor_review: '<span class="cv-status cv-st-tor">🟣 TOR Review</span>',
    quotation: '<span class="cv-status cv-st-quote">🟠 Quotation</span>',
    bidding: '<span class="cv-status cv-st-bidding">🟡 Bidding</span>',
    negotiation: '<span class="cv-status cv-st-nego">🔵 Negotiation</span>',
    win: '<span class="cv-status cv-st-win">🟢 Win</span>',
    ordered: '<span class="cv-status cv-st-ordered">🟢 Ordered</span>',
    delivered: '<span class="cv-status cv-st-delivered">✅ Delivered</span>',
    recurring: '<span class="cv-status cv-st-recur">🔄 Recurring</span>'
  };
  return labels[status] || '<span class="cv-status">' + status + '</span>';
}

function getClientViewCSS() {
  return '' +
  '* { margin:0; padding:0; box-sizing:border-box; }' +
  'body { font-family: "Segoe UI", "Noto Sans Thai", sans-serif; background: #0a0e27; color: #e0e6f0; }' +
  '.cv-container { max-width: 1000px; margin: 0 auto; padding: 24px; }' +
  
  '.cv-header { text-align: center; padding: 32px 0; margin-bottom: 24px; border-bottom: 2px solid rgba(100,181,246,0.2); }' +
  '.cv-logo { font-size: 14px; color: #64b5f6; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }' +
  '.cv-dealer-name { font-size: 32px; font-weight: 800; background: linear-gradient(90deg, #64b5f6, #42a5f5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 4px; }' +
  '.cv-dealer-sub { font-size: 14px; color: #8892b0; }' +
  
  '.cv-stats { display: flex; gap: 16px; justify-content: center; margin-bottom: 24px; }' +
  '.cv-stat { text-align: center; padding: 16px 24px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; min-width: 100px; }' +
  '.cv-stat-val { font-size: 28px; font-weight: 800; color: #64b5f6; }' +
  '.cv-stat-label { font-size: 12px; color: #8892b0; margin-top: 2px; }' +
  
  '.cv-section { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 20px; margin-bottom: 16px; }' +
  '.cv-section-title { font-size: 18px; font-weight: 700; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }' +
  
  '.cv-table { width: 100%; border-collapse: collapse; }' +
  '.cv-table th { text-align: left; padding: 10px 12px; font-size: 11px; color: #8892b0; text-transform: uppercase; border-bottom: 2px solid rgba(255,255,255,0.08); }' +
  '.cv-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; }' +
  '.cv-row { cursor: pointer; transition: 0.15s; }' +
  '.cv-row:hover td { background: rgba(100,181,246,0.06); }' +
  '.cv-num { color: #8892b0; font-weight: 700; font-size: 12px; width: 32px; }' +
  '.cv-project { font-weight: 600; }' +
  '.cv-model { font-size: 12px; color: #8892b0; }' +
  
  '.cv-status { padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }' +
  '.cv-st-prospect { background: rgba(100,181,246,0.12); color: #64b5f6; }' +
  '.cv-st-tor { background: rgba(186,104,200,0.12); color: #ba68c8; }' +
  '.cv-st-quote { background: rgba(255,183,77,0.12); color: #ffb74d; }' +
  '.cv-st-bidding { background: rgba(255,235,59,0.12); color: #fdd835; }' +
  '.cv-st-nego { background: rgba(77,208,225,0.12); color: #4dd0e1; }' +
  '.cv-st-win { background: rgba(129,199,132,0.12); color: #81c784; }' +
  '.cv-st-ordered { background: rgba(76,175,80,0.12); color: #4caf50; }' +
  '.cv-st-delivered { background: rgba(76,175,80,0.15); color: #66bb6a; }' +
  '.cv-st-recur { background: rgba(121,134,203,0.12); color: #7986cb; }' +
  
  '.cv-products { }' +
  '.cv-product-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }' +
  '.cv-product-name { width: 180px; font-size: 13px; font-weight: 600; text-align: right; }' +
  '.cv-product-qty { color: #64b5f6; font-weight: 700; }' +
  '.cv-product-bar { flex: 1; height: 24px; background: rgba(255,255,255,0.04); border-radius: 6px; overflow: hidden; }' +
  '.cv-product-fill { height: 100%; background: linear-gradient(90deg, #42a5f5, #64b5f6); border-radius: 6px; transition: width 0.5s; }' +
  
  '.cv-action { padding: 10px 14px; border-radius: 8px; margin-bottom: 6px; border-left: 3px solid #64b5f6; background: rgba(255,255,255,0.02); }' +
  '.cv-action-overdue { border-left-color: #ff5252; background: rgba(255,82,82,0.06); }' +
  '.cv-action-urgent { border-left-color: #ff9800; background: rgba(255,152,0,0.04); }' +
  '.cv-action-text { font-size: 14px; font-weight: 600; margin-bottom: 2px; }' +
  '.cv-action-meta { font-size: 12px; color: #8892b0; }' +
  '.cv-overdue-badge { background: rgba(255,82,82,0.2); color: #ff5252; padding: 1px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; }' +
  '.cv-urgent-badge { background: rgba(255,152,0,0.2); color: #ff9800; padding: 1px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; }' +
  
  '.cv-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }' +
  '.cv-detail-item { }' +
  '.cv-detail-label { font-size: 11px; color: #8892b0; margin-bottom: 2px; }' +
  '.cv-detail-val { font-size: 14px; font-weight: 600; }' +
  
  '.cv-log { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; }' +
  '.cv-log-date { color: #8892b0; font-size: 12px; min-width: 70px; }' +
  '.cv-log-icon { font-size: 14px; }' +
  '.cv-log-text { flex: 1; line-height: 1.5; }' +
  
  '.cv-back { display: inline-block; padding: 8px 16px; margin-bottom: 16px; cursor: pointer; color: #64b5f6; font-size: 14px; border-radius: 8px; transition: 0.15s; }' +
  '.cv-back:hover { background: rgba(100,181,246,0.1); }' +
  
  '.cv-footer { text-align: center; padding: 24px 0; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #8892b0; }' +
'.cv-toggle-btn { padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #8892b0; cursor: pointer; font-size: 12px; transition: 0.15s; }' +
  '.cv-toggle-btn:hover { background: rgba(100,181,246,0.1); color: #64b5f6; border-color: #64b5f6; }' +
  
  '@media (max-width: 768px) {' +
  '  .cv-container { padding: 12px; }' +
  '  .cv-dealer-name { font-size: 24px; }' +
  '  .cv-stats { flex-wrap: wrap; }' +
  '  .cv-detail-grid { grid-template-columns: repeat(2, 1fr); }' +
  '  .cv-product-name { width: 120px; }' +
  '}';
}
// ================================================================
// SIDEBAR — GROUP TOGGLE + FAVORITES
// ================================================================
var SB_COLLAPSED = {};

function toggleSBGroup(groupId) {
  var el = document.getElementById('sbg_' + groupId);
  var arrow = document.getElementById('sba_' + groupId);
  if (!el) return;

  if (SB_COLLAPSED[groupId]) {
    delete SB_COLLAPSED[groupId];
    el.classList.remove('collapsed');
    if (arrow) arrow.classList.remove('collapsed');
  } else {
    SB_COLLAPSED[groupId] = true;
    el.classList.add('collapsed');
    if (arrow) arrow.classList.add('collapsed');
  }

  // Save state
  localStorage.setItem('v7_sbCollapsed', JSON.stringify(SB_COLLAPSED));
}

// Load collapsed state on init
(function() {
  var saved = localStorage.getItem('v7_sbCollapsed');
  if (saved) {
    try { SB_COLLAPSED = JSON.parse(saved); } catch(e) {}
    Object.keys(SB_COLLAPSED).forEach(function(id) {
      var el = document.getElementById('sbg_' + id);
      var arrow = document.getElementById('sba_' + id);
      if (el) el.classList.add('collapsed');
      if (arrow) arrow.classList.add('collapsed');
    });
  }
})();

// ================================================================
// FAVORITES
// ================================================================
var ALL_MENU_ITEMS = [
  {id: 'today', icon: '📌', name: 'วันนี้', action: "go('today')"},
  {id: 'dealers', icon: '🏪', name: 'Dealers', action: "go('dealers')"},
  {id: 'pipeline', icon: '📊', name: 'Pipeline', action: "go('pipeline')"},
  {id: 'pipeBoard', icon: '📋', name: 'Pipeline Board', action: "go('pipeBoard')"},
  {id: 'pipeDash', icon: '📊', name: 'Pipeline Overview', action: "go('pipeDash')"},
  {id: 'tasks', icon: '📋', name: 'Tasks', action: "go('tasks')"},
  {id: 'kanban', icon: '📋', name: 'Kanban', action: "go('kanban')"},
  {id: 'visitPlan', icon: '📅', name: 'Visit Plan', action: "go('visitPlan')"},
  {id: 'meetings', icon: '📅', name: 'ประชุม', action: "go('meetings')"},
  {id: 'calendar', icon: '📆', name: 'ปฏิทิน', action: "go('calendar')"},
  {id: 'visits', icon: '🤝', name: 'Visit Report', action: "go('visits')"},
  {id: 'followup', icon: '📞', name: 'Follow-up', action: "go('followup')"},
  {id: 'forecast', icon: '📦', name: 'Forecast', action: "go('forecast')"},
  {id: 'report', icon: '📊', name: 'Weekly Report', action: "go('report')"},
  {id: 'dashboard', icon: '📈', name: 'Dashboard', action: "go('dashboard')"},
  {id: 'line', icon: '💬', name: 'LINE Message', action: "openLineTemplates()"},
  {id: 'emailDrafts', icon: '📧', name: 'Email Draft', action: "go('emailDrafts')"},
  {id: 'presentation', icon: '🎬', name: 'Presentation', action: "openPresentation()"},
  {id: 'feedback', icon: '💡', name: 'Feedback', action: "go('feedback')"},
  {id: 'kpi', icon: '🎯', name: 'KPI', action: "go('kpi')"},
  {id: 'customKpi', icon: '🎯', name: 'KPI Dashboard', action: "go('customKpi')"},
  {id: 'monthlyGoal', icon: '🎯', name: 'Monthly Goal', action: "go('monthlyGoal')"},
  {id: 'demoTracker', icon: '🚁', name: 'Demo Equipment', action: "go('demoTracker')"},
  {id: 'quotations', icon: '💰', name: 'Quotation', action: "go('quotations')"},
  {id: 'knowledge', icon: '📚', name: 'Knowledge', action: "go('knowledge')"},
  {id: 'exports', icon: '📤', name: 'Export', action: "go('exports')"},
  {id: 'health', icon: '🏥', name: 'Data Health', action: "go('health')"},
  {id: 'admin', icon: '⚙️', name: 'ตั้งค่า', action: "go('admin')"}
];

function getFavorites() {
  var saved = localStorage.getItem('v7_favorites');
  if (saved) { try { return JSON.parse(saved); } catch(e) {} }
  return ['today', 'dealers', 'pipeline', 'tasks', 'visits'];
}

function saveFavorites(list) {
  localStorage.setItem('v7_favorites', JSON.stringify(list));
  if (typeof SYNC_ENABLED !== 'undefined' && SYNC_ENABLED && CURRENT_USER) {
    db.collection('users').doc(CURRENT_USER.uid).collection('favorites').doc('_data').set({value: list});
  }
}

function renderFavorites() {
  var favs = getFavorites();
  var el = document.getElementById('sbFavorites');
  if (!el) return;

  var h = '';
  favs.forEach(function(favId) {
    var menu = null;
    for (var i = 0; i < ALL_MENU_ITEMS.length; i++) {
      if (ALL_MENU_ITEMS[i].id === favId) { menu = ALL_MENU_ITEMS[i]; break; }
    }
    if (!menu) return;
    var isActive = S && S.view === favId;
    h += '<div class="sb-fav-item' + (isActive ? ' act' : '') + '" onclick="' + menu.action + '">';
    h += menu.icon + ' ' + menu.name;
    h += '</div>';
  });

  el.innerHTML = h;
}

function showEditFavorites() {
  var favs = getFavorites();
  var h = '<div style="max-width:400px">';
  h += '<div style="font-size:13px;color:var(--text2);margin-bottom:10px">กดเลือกเมนูที่ใช้บ่อย (แนะนำ 3-6 อัน)</div>';

  ALL_MENU_ITEMS.forEach(function(item) {
    var isFav = favs.indexOf(item.id) !== -1;
    h += '<div class="fav-edit-item" onclick="toggleFavItem(\'' + item.id + '\',this)">';
    h += '<input type="checkbox" ' + (isFav ? 'checked' : '') + ' onclick="event.stopPropagation();toggleFavItem(\'' + item.id + '\',this.parentElement)">';
    h += '<span>' + item.icon + ' ' + item.name + '</span>';
    h += '</div>';
  });

  h += '<div class="fm-actions" style="margin-top:12px">';
  h += '<button class="btn btn-blue" onclick="saveFavFromModal()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('⭐ แก้ไข Favorites', h);
}

function toggleFavItem(itemId, el) {
  var chk = el.querySelector('input[type=checkbox]');
  if (chk) chk.checked = !chk.checked;
}

function saveFavFromModal() {
  var checks = document.querySelectorAll('.fav-edit-item input[type=checkbox]:checked');
  var favs = [];
  for (var i = 0; i < checks.length; i++) {
    var parent = checks[i].parentElement;
    var onclick = parent.getAttribute('onclick') || '';
    var match = onclick.match(/toggleFavItem\('([^']+)'/);
    if (match) favs.push(match[1]);
  }
  saveFavorites(favs);
  toast('⭐ บันทึก Favorites แล้ว');
  closeMForce();
  renderFavorites();
}

// Auto render favorites on page load
setTimeout(function() { renderFavorites(); }, 100);

// Re-render favorites on navigation
var _origGo = typeof go === 'function' ? go : null;
if (_origGo) {
  // Will be called after render
}
// ================================================================
// FULL SYNC — Force push all localStorage to Firebase
// ================================================================
function forceSyncAll() {
  if (!SYNC_ENABLED || !CURRENT_USER) {
    toast('❌ ต้อง Login ก่อน');
    return;
  }

  if (!confirm('⚠️ Sync ข้อมูลทั้งหมดไป Firebase?\nข้อมูลบน Cloud จะถูกเขียนทับ')) return;

  toast('🔄 กำลัง Sync ทั้งหมด...');
  var count = 0;

  Object.keys(localStorage).forEach(function(key) {
    if (key.indexOf('v7_') !== 0) return;
    if (key === 'v7_config') return; // config sync แยก
    if (key.indexOf('v7_migrated') === 0) return;
    if (key === 'v7_sbCollapsed') return;
    if (key === 'v7_theme') return;

    var shortKey = key.replace('v7_', '');
    var data = localStorage.getItem(key);
    if (!data) return;

    try {
      var parsed = JSON.parse(data);
      var ref = db.collection('users').doc(CURRENT_USER.uid).collection(shortKey);

      if (Array.isArray(parsed)) {
        parsed.forEach(function(item) {
          if (item && item.id) {
            ref.doc(item.id).set(item).catch(function(e) {
              console.warn('Sync error:', shortKey, item.id, e);
            });
          }
        });
      } else {
        ref.doc('_data').set({value: parsed}).catch(function(e) {
          console.warn('Sync error:', shortKey, e);
        });
      }
      count++;
    } catch(e) {
      console.warn('Parse error:', key, e);
    }
  });

  // Config
  var cfg = localStorage.getItem('v7_config');
  if (cfg) {
    try {
      db.collection('users').doc(CURRENT_USER.uid).collection('_config').doc('main').set(JSON.parse(cfg));
    } catch(e) {}
  }

  setTimeout(function() {
    toast('✅ Sync เสร็จ! ' + count + ' collections');
  }, 2000);
}

// ================================================================
// FULL IMPORT — Import backup + sync to Firebase
// ================================================================
function importFullBackup() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        var count = 0;
        Object.keys(data).forEach(function(k) {
          localStorage.setItem(k, JSON.stringify(data[k]));
          count++;
        });
        toast('✅ Import สำเร็จ! ' + count + ' keys');

        // Auto sync to Firebase
        if (SYNC_ENABLED && CURRENT_USER) {
          localStorage.removeItem('v7_migrated_' + CURRENT_USER.uid);
          setTimeout(function() {
            forceSyncAll();
          }, 1000);
        }

        setTimeout(function() {
          location.reload();
        }, 3000);
      } catch(err) {
        toast('❌ Error: ' + err.message);
      }
    };
    reader.readAsText(e.target.files[0]);
  };
  input.click();
}

// ================================================================
// FULL EXPORT — Export all localStorage
// ================================================================
function exportFullBackup() {
  var allData = {};
  Object.keys(localStorage).forEach(function(k) {
    if (k.indexOf('v7_') === 0) {
      try { allData[k] = JSON.parse(localStorage.getItem(k)); } catch(e) { allData[k] = localStorage.getItem(k); }
    }
  });
  var blob = new Blob([JSON.stringify(allData, null, 2)], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'full-backup-' + _td() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('📥 Export Full Backup แล้ว!');
}
// ================================================================
// MOBILE MODE
// ================================================================
var viewMode = localStorage.getItem('v7_viewMode') || 'desktop';

function toggleViewMode() {
  viewMode = viewMode === 'mobile' ? 'desktop' : 'mobile';
  localStorage.setItem('v7_viewMode', viewMode);
  applyViewMode();
  render();
}

function applyViewMode() {
  if (viewMode === 'mobile') {
    document.body.classList.add('mobile-mode');
  } else {
    document.body.classList.remove('mobile-mode');
  }
  var icon = document.getElementById('modeIcon');
  if (icon) icon.textContent = viewMode === 'mobile' ? '🖥️' : '📱';
  
  // Update bottom nav active
  updateMbNav();
}

function updateMbNav() {
  var items = document.querySelectorAll('.mb-nav-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('act');
  }
  var current = S ? S.view : 'today';
  var navItems = document.querySelectorAll('.mb-nav-item');
  for (var j = 0; j < navItems.length; j++) {
    var onclick = navItems[j].getAttribute('onclick') || '';
    if (onclick.indexOf(current) !== -1) {
      navItems[j].classList.add('act');
    }
    if (current === 'mbHome' && onclick.indexOf('mbHome') !== -1) {
      navItems[j].classList.add('act');
    }
  }
}

function mbGo(view) {
  if (view === 'mbHome') {
    renderMbHome();
    return;
  }
  go(view);
  updateMbNav();
}

// Apply on load
setTimeout(function() {
  applyViewMode();
  // Auto detect mobile
  if (window.innerWidth <= 768 && !localStorage.getItem('v7_viewMode')) {
    viewMode = 'mobile';
    localStorage.setItem('v7_viewMode', 'mobile');
    applyViewMode();
  }
}, 200);

// ================================================================
// MOBILE HOME SCREEN
// ================================================================
function renderMbHome() {
  var el = document.getElementById('ct');
  if (!el) return;
  document.getElementById('pgT').textContent = '🏠 Home';
  
  var cfg = getConfig();
  var now = new Date();
  var dayNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  
  var dealers = ST.getAll('dealers');
  var pipeline = ST.getAll('pipeline');
  var activePipe = pipeline.filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
  var tasks = ST.filter('tasks', function(t) { return t.status === 'active'; });
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var todayVisits = visits.filter(function(v) { return v.date === _td(); });
  
  // Pending actions
  var pendingActions = [];
  try { pendingActions = getAllPendingPipeActions(); } catch(e) {}
  var overdueActions = pendingActions.filter(function(p) { return p.urgency === 'overdue'; });

  var h = '<div class="mb-home">';
  
  // Greeting
  h += '<div class="mb-home-header">';
  h += '<div class="mb-home-greeting">👋 สวัสดี ' + sanitize(cfg.saleName || 'Siwawong') + '</div>';
  h += '<div class="mb-home-date">วัน' + dayNames[now.getDay()] + ' ' + _td() + '</div>';
  h += '</div>';

  // Urgent
  if (overdueActions.length) {
    h += '<div class="mb-urgent">';
    h += '<div class="mb-urgent-title">🔴 ด่วน (' + overdueActions.length + ')</div>';
    overdueActions.slice(0, 3).forEach(function(item) {
      h += '<div class="mb-urgent-item" onclick="go(\'pipeDetail\',{pipeId:\'' + item.pipe.id + '\'})">⏳ ' + sanitize(item.action.text) + '</div>';
    });
    h += '</div>';
  }

  // Quick Actions
  h += '<div class="mb-actions">';
  h += '<div class="mb-action-btn" onclick="showVisitM()"><span class="mb-action-icon">🤝</span>เพิ่ม Visit</div>';
  h += '<div class="mb-action-btn" onclick="showTaskM()"><span class="mb-action-icon">📋</span>เพิ่มงาน</div>';
  h += '<div class="mb-action-btn" onclick="showPipelineM()"><span class="mb-action-icon">📊</span>เพิ่ม Pipeline</div>';
  h += '<div class="mb-action-btn" onclick="showQNote()"><span class="mb-action-icon">📝</span>Quick Note</div>';
  h += '<div class="mb-action-btn" onclick="openLineTemplates()"><span class="mb-action-icon">💬</span>LINE</div>';
  h += '<div class="mb-action-btn" onclick="go(\'visitPlan\')"><span class="mb-action-icon">📅</span>Visit Plan</div>';
  h += '</div>';

  // Stats Grid
  h += '<div class="mb-grid">';
  h += '<div class="mb-tile" onclick="go(\'dealers\')"><div class="mb-tile-icon">🏪</div><div class="mb-tile-count">' + dealers.length + '</div><div class="mb-tile-name">Dealers</div></div>';
  h += '<div class="mb-tile" onclick="go(\'pipeline\')"><div class="mb-tile-icon">📊</div><div class="mb-tile-count">' + activePipe.length + '</div><div class="mb-tile-name">Pipeline</div></div>';
  h += '<div class="mb-tile" onclick="go(\'tasks\')"><div class="mb-tile-icon">📋</div><div class="mb-tile-count">' + tasks.length + '</div><div class="mb-tile-name">Tasks</div></div>';
  h += '<div class="mb-tile" onclick="go(\'visits\')"><div class="mb-tile-icon">🤝</div><div class="mb-tile-count">' + todayVisits.length + '</div><div class="mb-tile-name">Visit วันนี้</div></div>';
  h += '<div class="mb-tile" onclick="go(\'forecast\')"><div class="mb-tile-icon">📦</div><div class="mb-tile-count">' + pipeline.length + '</div><div class="mb-tile-name">Forecast</div></div>';
  h += '<div class="mb-tile" onclick="go(\'knowledge\')"><div class="mb-tile-icon">📚</div><div class="mb-tile-count">' + ST.getAll('notes').length + '</div><div class="mb-tile-name">Knowledge</div></div>';
  h += '</div>';

  // More Menu
  h += '<div class="card"><h2>📂 เมนูเพิ่มเติม</h2>';
  h += '<div class="mb-actions">';
  h += '<div class="mb-action-btn" onclick="go(\'report\')"><span class="mb-action-icon">📊</span>Weekly Report</div>';
  h += '<div class="mb-action-btn" onclick="go(\'dashboard\')"><span class="mb-action-icon">📈</span>Dashboard</div>';
  h += '<div class="mb-action-btn" onclick="go(\'calendar\')"><span class="mb-action-icon">📆</span>ปฏิทิน</div>';
  h += '<div class="mb-action-btn" onclick="go(\'customKpi\')"><span class="mb-action-icon">🎯</span>KPI</div>';
  h += '<div class="mb-action-btn" onclick="go(\'demoTracker\')"><span class="mb-action-icon">🚁</span>Demo</div>';
  h += '<div class="mb-action-btn" onclick="go(\'quotations\')"><span class="mb-action-icon">💰</span>Quotation</div>';
  h += '<div class="mb-action-btn" onclick="go(\'emailDrafts\')"><span class="mb-action-icon">📧</span>Email Draft</div>';
  h += '<div class="mb-action-btn" onclick="go(\'admin\')"><span class="mb-action-icon">⚙️</span>ตั้งค่า</div>';
  h += '</div></div>';

  h += '</div>';
  el.innerHTML = h;
  updateMbNav();
}