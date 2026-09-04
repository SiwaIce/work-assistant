// ================================================================
// features.js — Presentation Mode | LINE Templates | Smart Notifications
// ================================================================

// ================================================================
// HELPERS
// ================================================================
function ftParseDate(str) {
  if (!str) return null;
  if (str instanceof Date) return isNaN(str.getTime()) ? null : str;
  if (typeof str !== 'string') return null;
  var s = str.trim();
  if (!s) return null;
  // ✅ ISO: YYYY-MM-DD (อาจมีเวลา/timezone ต่อท้าย)
  if (s.indexOf('-') !== -1) {
    var datePart = s.split('T')[0].split(' ')[0];
    var a = datePart.split('-');
    if (a.length === 3) {
      var y = parseInt(a[0], 10), mo = parseInt(a[1], 10) - 1, dd = parseInt(a[2], 10);
      if (!isNaN(y) && !isNaN(mo) && !isNaN(dd)) return new Date(y, mo, dd);
    }
    return null;
  }
  // DD/MM/YYYY (รูปแบบเดิม)
  var p = s.split('/');
  if (p.length !== 3) return null;
  var day = parseInt(p[0], 10);
  var month = parseInt(p[1], 10) - 1;
  var year = parseInt(p[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
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

// ---- Build Slides (safe version) ----
function buildPresSlides() {
  var slides = [];
  var dealers = [];
  var pipeline = [];
  var visits = [];
  try { dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]'); } catch(e) { dealers = []; }
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }
  
  var now = new Date();
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  var activePipe = (pipeline || []).filter(function (p) {
    return pipeIsOpen(p);
  });
  var winPipe = (pipeline || []).filter(function (p) {
    return pipeIsWon(p);
  });
  var lostPipe = (pipeline || []).filter(function (p) { return p.status === 'fail_lost'; });

  var totalActive = 0; 
  (activePipe || []).forEach(function (p) { totalActive += parseFloat(p.value) || 0; });
  var totalWin = 0; 
  (winPipe || []).forEach(function (p) { totalWin += parseFloat(p.value) || 0; });
  var winRate = (winPipe.length + lostPipe.length) > 0
    ? Math.round(winPipe.length / (winPipe.length + lostPipe.length) * 100) : 0;

  var thisM = now.getMonth();
  var thisY = now.getFullYear();
  var monthVisits = (visits || []).filter(function (v) {
    var d = ftParseDate(v.date);
    return d && d.getMonth() === thisM && d.getFullYear() === thisY;
  });

  var stageLabels = {
    initial: '01 Initial', on_process: '02 On process', draft_tor: '03 Draft TOR',
    bidding: '04 Bidding', win: '05 Win', fail_lost: '05 Fail & Lost',
    contracting: '06 Contracting', deliver: '07 Deliver'
  };
  var stageColors = {
    initial: '#eab308', on_process: '#f97316', draft_tor: '#f9a8d4',
    bidding: '#94a3b8', win: '#22c55e', fail_lost: '#ef4444',
    contracting: '#0f766e', deliver: '#6366f1'
  };

  // SLIDE 1: TITLE
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

  // SLIDE 2: KPI OVERVIEW
  slides.push({
    html:
      '<div class="ps-content">' +
        '<h2 class="ps-heading">📊 KPI Overview</h2>' +
        '<div class="ps-kpi-grid">' +
          presKpiCard('🏪', (dealers || []).length, 'Authorized Dealers') +
          presKpiCard('📋', (activePipe || []).length, 'Active Deals') +
          presKpiCard('💰', ftFmtVal(totalActive), 'Pipeline Value (฿)') +
          presKpiCard('🏆', winRate + '%', 'Win Rate') +
          presKpiCard('✅', (winPipe || []).length, 'Deals Won') +
          presKpiCard('💵', ftFmtVal(totalWin), 'Revenue Won (฿)') +
          presKpiCard('📍', (monthVisits || []).length, 'Visits This Month') +
          presKpiCard('🎯', (activePipe || []).filter(function (p) { return p.status === 'bidding'; }).length, 'Active Bidding') +
        '</div>' +
      '</div>'
  });

  // SLIDE 3: PIPELINE BY STAGE
  var stageCounts = {};
  var maxStageVal = 1;
  (activePipe || []).forEach(function (p) {
    var s = p.status || 'initial';
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

  // SLIDE 4: TOP DEALS
  var topDeals = (activePipe || []).slice().sort(function (a, b) {
    return (parseFloat(b.value) || 0) - (parseFloat(a.value) || 0);
  }).slice(0, 7);

  var topHTML = '<table class="ps-table"><thead><tr><th>#</th><th>Project</th><th>Dealer</th><th>Stage</th><th>Value (฿)</th></tr></thead><tbody>';
  topDeals.forEach(function (p, i) {
    var dn = '-';
    (dealers || []).forEach(function (d) { if (d.id === p.dealerId) dn = d.name; });
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

  // SLIDE 5: DEALER RANKING
  var dealerStats = [];
  (dealers || []).forEach(function (d) {
    var dPipe = (pipeline || []).filter(function (p) { return p.dealerId === d.id && p.status !== 'fail_lost'; });
    var dVal = 0;
    dPipe.forEach(function (p) { dVal += parseFloat(p.value) || 0; });
    var dVisits = (visits || []).filter(function (v) { return v.dealerId === d.id; });
    var dWin = (pipeline || []).filter(function (p) {
      return p.dealerId === d.id && (pipeIsWon(p));
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

  // SLIDE 6: MONTHLY ACTIVITY
  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  var weekVisits = (visits || []).filter(function (v) {
    var d = ftParseDate(v.date);
    return d && d >= weekStart;
  });

  var uniqueDealersVisited = {};
  (monthVisits || []).forEach(function (v) { if (v.dealerId) uniqueDealersVisited[v.dealerId] = true; });

  slides.push({
    html:
      '<div class="ps-content">' +
        '<h2 class="ps-heading">📅 Activity Summary</h2>' +
        '<div class="ps-kpi-grid">' +
          presKpiCard('📍', (monthVisits || []).length, 'Visits This Month') +
          presKpiCard('📍', (weekVisits || []).length, 'Visits This Week') +
          presKpiCard('🏪', Object.keys(uniqueDealersVisited).length, 'Unique Dealers Visited') +
          presKpiCard('📋', (pipeline || []).filter(function (p) {
            var d = ftParseDate(p.date || p.createdAt);
            return d && d.getMonth() === thisM && d.getFullYear() === thisY;
          }).length, 'New Deals This Month') +
        '</div>' +
        '<div class="ps-activity-note">' +
          '<h3>📌 Coverage</h3>' +
          '<p>Visited <strong>' + Object.keys(uniqueDealersVisited).length + '</strong> out of <strong>' + (dealers || []).length + '</strong> dealers this month (' + ((dealers || []).length > 0 ? Math.round(Object.keys(uniqueDealersVisited).length / (dealers || []).length * 100) : 0) + '% coverage)</p>' +
        '</div>' +
      '</div>'
  });

  // SLIDE 7: ACTION ITEMS
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

  // SLIDE 8: THANK YOU
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

// sanitize() อยู่ใน utils.js เท่านั้น (เดิมมีก๊อปปี้ซ้ำที่นี่ซึ่งโหลดทีหลังเลยชนะ
// แต่ไม่ escape " กับ & ทำให้ค่าที่มี " หลุดออกจาก attribute value="..." ได้ — เอาออก)

// ================================================================
// B) LINE MESSAGE TEMPLATES
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
  var dealers = [];
  var pipeline = [];
  try { dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]'); } catch(e) { dealers = []; }
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }
  var templates = getLineTemplates();
  var dealer = null;
  if (dealerId) {
    for (var i = 0; i < dealers.length; i++) {
      if (dealers[i].id === dealerId) { dealer = dealers[i]; break; }
    }
  }

  var h = '<div class="line-wrap">';

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

  h += '<div class="fm-group"><label>📋 Project (ถ้ามี)</label><select id="linePipeSel" class="fm-input">';
  h += '<option value="">-- ไม่ระบุ --</option>';
  if (dealer) {
    pipeline.forEach(function (p) {
      if (p.dealerId === dealer.id && pipeIsOpen(p)) {
        h += '<option value="' + p.id + '">' + sanitize(p.project || p.name || '-') + '</option>';
      }
    });
  }
  h += '</select></div>';

  h += '<div class="fm-group" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h += '<label style="margin:0">💬 เลือก Template</label>';
  h += '<div style="display:flex;gap:6px">';
  h += '<button class="btn-sm" onclick="openLineTmplManager()" title="จัดการ Template">⚙️ จัดการ</button>';
  h += '</div></div>';

  h += '<div class="line-grid">';
  templates.forEach(function (t, idx) {
    h += '<div class="line-card" onclick="selectLineTmpl(' + idx + ', this)">' +
      '<div class="line-card-icon">' + (t.icon || '📝') + '</div>' +
      '<div class="line-card-name">' + sanitize(t.name || 'Template') + '</div>' +
    '</div>';
  });
  h += '<div class="line-card" onclick="selectLineTmplCustom(this)">' +
    '<div class="line-card-icon">✏️</div>' +
    '<div class="line-card-name">เขียนเอง</div>' +
  '</div>';
  h += '</div>';

  h += '<div class="fm-group"><label>📝 ข้อความ (แก้ไขได้)</label>';
  h += '<textarea id="lineMsg" rows="7" class="fm-input" placeholder="เลือก Template ด้านบน หรือพิมพ์เอง..."></textarea></div>';

  h += '<div style="font-size:11px;color:var(--text2);margin:-8px 0 12px;padding:0 4px">';
  h += '💡 ตัวแปร: <code>{contact}</code> ชื่อผู้ติดต่อ, <code>{dealer}</code> ชื่อร้าน, <code>{project}</code> ชื่อโปรเจค, <code>{product}</code> รุ่นสินค้า';
  h += '</div>';

  h += '<div class="fm-actions" style="gap:8px;display:flex;flex-wrap:wrap">';
  h += '<button class="btn btn-green" onclick="sendLineMsg()" style="flex:1;min-width:120px">📱 เปิด LINE</button>';
  h += '<button class="btn bp" onclick="copyLineMsg()" style="flex:1;min-width:120px">📋 Copy ข้อความ</button>';
  h += '</div>';

  h += '</div>';

  openM('💬 LINE Message', h);
}

function selectLineTmpl(idx, el) {
  var templates = getLineTemplates();
  var tmpl = templates[idx];
  if (!tmpl) return;

  var cards = document.querySelectorAll('.line-card');
  for (var j = 0; j < cards.length; j++) cards[j].classList.remove('selected');
  if (el) el.classList.add('selected');

  var msg = tmpl.msg || '';

  var dId = document.getElementById('lineDealerSel') ? document.getElementById('lineDealerSel').value : '';
  var dealers = [];
  try { dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]'); } catch(e) { dealers = []; }
  var dealer = null;
  for (var k = 0; k < dealers.length; k++) {
    if (dealers[k].id === dId) { dealer = dealers[k]; break; }
  }

  var pId = document.getElementById('linePipeSel') ? document.getElementById('linePipeSel').value : '';
  var pipeline = [];
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }
  var pipe = null;
  for (var m = 0; m < pipeline.length; m++) {
    if (pipeline[m].id === pId) { pipe = pipeline[m]; break; }
  }

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
  var pipeline = [];
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }
  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>';
  pipeline.forEach(function (p) {
    if (p.dealerId === dId && pipeIsOpen(p)) {
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
  h += '<button class="btn bp" onclick="saveNewLineTmpl()">💾 บันทึก</button>';
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
  h += '<button class="btn bp" onclick="saveEditLineTmpl(' + idx + ')">💾 บันทึก</button>';
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
// C) SMART NOTIFICATIONS (SAFE VERSION)
// ================================================================
function getSmartNotifications() {
  var notifs = [];
  var now = new Date();
  var today = now.getDay();
  var dayOfMonth = now.getDate();
  var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  var daysLeft = daysInMonth - dayOfMonth;

  var dealers = [];
  var pipeline = [];
  var visits = [];
  var followups = [];
  var notes = [];
  
  try { dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]'); } catch(e) { dealers = []; }
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }
  try { followups = JSON.parse(localStorage.getItem('v7_followups') || '[]'); } catch(e) { followups = []; }
  try { notes = JSON.parse(localStorage.getItem('v7_notes') || '[]'); } catch(e) { notes = []; }

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
    (dealers || []).forEach(function (d) {
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
  (followups || []).forEach(function (f) {
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
  (pipeline || []).forEach(function (p) {
    if (!pipeIsOpen(p)) return;
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
  (pipeline || []).forEach(function (p) {
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
  // index visits by dealerId ครั้งเดียว — เดิม (visits||[]).filter() ต่อ Dealer ทุกราย กลายเป็น
  // O(dealers×visits) เป็นหนึ่งในคอขวดของ renderSmartNotifPanel
  var _snVisitsByDealer = {};
  (visits || []).forEach(function (v) {
    if (!v.dealerId) return;
    if (!_snVisitsByDealer[v.dealerId]) _snVisitsByDealer[v.dealerId] = [];
    _snVisitsByDealer[v.dealerId].push(v);
  });
  var neglected = [];
  (dealers || []).forEach(function (d) {
    var dVisits = _snVisitsByDealer[d.id] || [];
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
  (notes || []).forEach(function (n) {
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
  (pipeline || []).forEach(function (p) {
    if (!pipeIsOpen(p)) return;
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
  // index งานค้างต่อ pipe ครั้งเดียว — เดิม pipeOpenTasks(p.id) เรียก ST.getAll('tasks') (parse ใหม่ทั้ง
  // collection ไม่มีแคช) ต่อ Pipeline ทุกรายการ ซึ่ง pipeline มีเป็นพันรายการได้ทำให้หน่วงเวลา
  var _snOpenTaskIdx = {};
  ST.getAll('tasks').forEach(function(t) { if (t.status !== 'completed' && t.pipeId) _snOpenTaskIdx[t.pipeId] = true; });
  (pipeline || []).forEach(function (p) {
    if (!pipeIsOpen(p)) return;
    var val = parseFloat(p.value) || 0;
    if (val >= 1000000 && !_snOpenTaskIdx[p.id]) {
      notifs.push({ icon: '💎', type: 'pipeline', priority: 2,
        text: 'Deal มูลค่าสูง "' + (p.project || p.name || '') + '" (฿' + ftFmtVal(val) + ') ยังไม่มี Task ติดตาม' });
    }
  });

  // ---- 10. No visit this week (Wed+) ----
  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  var weekVisits = (visits || []).filter(function (v) {
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
  var paNotifs = [];
  try { paNotifs = getPipeActionNotifications(); } catch(e) { paNotifs = []; }
  for (var pn = 0; pn < paNotifs.length; pn++) {
    notifs.push(paNotifs[pn]);
  }

  notifs.sort(function (a, b) { return a.priority - b.priority; });
  return notifs;
}

function renderSmartNotifPanel() {
  var notifs = getSmartNotifications();
  if (!notifs.length) return '<div class="sn-panel sn-empty"><span>✅</span> ไม่มีเรื่องเร่งด่วน — เยี่ยม!</div>';

  var urgent = (notifs || []).filter(function (n) { return n.priority === 1; });
  var normal = (notifs || []).filter(function (n) { return n.priority === 2; });

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
  var urgent = (notifs || []).filter(function (n) { return n.priority === 1; });
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
// GET STREAK DATA (SAFE VERSION)
// ================================================================
// ================================================================
// GET STREAK DATA (SAFE VERSION)
// ================================================================

// เพิ่มฟังก์ชัน helper ก่อน getStreakData
function safeGetDateString(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.split(' ')[0];
  }
  if (typeof value === 'object' && value !== null) {
    if (value.toDate) {
      var d = value.toDate();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    if (value.seconds) {
      var d2 = new Date(value.seconds * 1000);
      return d2.getFullYear() + '-' + String(d2.getMonth() + 1).padStart(2, '0') + '-' + String(d2.getDate()).padStart(2, '0');
    }
  }
  return '';
}

function getStreakData() {
  var activities = {};

  var visits = [];
  var followups = [];
  var pipelog = [];
  var tasklogs = [];
  var pipeline = [];
  
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }
  try { followups = JSON.parse(localStorage.getItem('v7_followups') || '[]'); } catch(e) { followups = []; }
  try { pipelog = JSON.parse(localStorage.getItem('v7_pipelog') || '[]'); } catch(e) { pipelog = []; }
  try { tasklogs = JSON.parse(localStorage.getItem('v7_tasklogs') || '[]'); } catch(e) { tasklogs = []; }
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }

  (visits || []).forEach(function(v) { if (v && v.date) activities[v.date] = true; });
  (followups || []).forEach(function(f) { var d = f.date || f.dueDate; if (d) activities[d] = true; });
  (pipelog || []).forEach(function(l) { if (l && l.date) activities[l.date.split(' ')[0]] = true; });
  (tasklogs || []).forEach(function(l) { if (l && l.date) activities[l.date.split(' ')[0]] = true; });
  
  // แก้ไขส่วนนี้: ใช้ safeGetDateString
  (pipeline || []).forEach(function(p) {
    if (!p) return;
    var dateStr = safeGetDateString(p.updatedAt);
    if (dateStr) activities[dateStr] = true;
    if (p.date && typeof p.date === 'string') activities[p.date] = true;
  });

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

// fmtDateKey ตัวจริง (คืนค่า ISO YYYY-MM-DD ใช้เป็น object key) อยู่ด้านล่าง ~บรรทัด 4490 — เคยมีสำเนาซ้ำ
// ตรงนี้คืนค่า DD/MM/YYYY ที่ถูกบังอยู่แล้ว ลบทิ้ง (พบ 2026-07-19 ตอนไล่ตรวจฟังก์ชันชื่อซ้ำ)

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
  (data.thisWeek || []).forEach(function (d) {
    var cls = 'streak-day';
    if (d.active) cls += ' streak-active';
    if (d.isToday) cls += ' streak-today';
    h += '<div class="' + cls + '"><div class="streak-dot"></div><div class="streak-dlabel">' + d.label + '</div></div>';
  });
  h += '</div></div>';
  return h;
}

// ================================================================
// RENDER DAILY BRIEFING (SAFE VERSION)
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

  // Urgent items
  var urgentItems = [];
  var pendingActions = [];
  try { pendingActions = getAllPendingPipeActions(); } catch(e) { pendingActions = []; }
  
  var overdueActions = (pendingActions || []).filter(function(p) { return p.urgency === 'overdue'; });
  var todayActions = (pendingActions || []).filter(function(p) { return p.daysLeft === 0; });

  (overdueActions || []).forEach(function(item) {
    urgentItems.push({icon: '🔴', text: sanitize(item.action.text) + ' — ' + sanitize(item.pipe.projectName || ''), type: 'action'});
  });
  (todayActions || []).forEach(function(item) {
    urgentItems.push({icon: '🟠', text: sanitize(item.action.text) + ' — ' + sanitize(item.pipe.projectName || ''), type: 'action'});
  });

  var overdueFu = [];
  try { overdueFu = getAllOverdueFu(); } catch(e) { overdueFu = []; }
  (overdueFu || []).forEach(function(o) {
    urgentItems.push({icon: '📞', text: sanitize(o.stepTitle) + ' — ' + sanitize(o.taskTitle), type: 'followup'});
  });

  var tasksDueToday = [];
  try { tasksDueToday = ST.filter('tasks', function(t) { return t.status === 'active' && t.dueDate === today; }); } catch(e) { tasksDueToday = []; }
  (tasksDueToday || []).forEach(function(t) {
    urgentItems.push({icon: '📋', text: sanitize(t.title), type: 'task'});
  });

  var followups = [];
  try { followups = JSON.parse(localStorage.getItem('v7_followups') || '[]'); } catch(e) { followups = []; }
  var todayFU = (followups || []).filter(function(f) {
    return (f.date === today || f.dueDate === today) && f.status !== 'done';
  });
  (todayFU || []).forEach(function(f) {
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

  // Meetings today
  var meetings = [];
  try { meetings = ST.filter('meetings', function(m) { return m.date === today; }); } catch(e) { meetings = []; }
  if (meetings.length > 0) {
    var sm = '<div class="briefing-section">';
    sm += '<div class="briefing-section-title">📅 ประชุมวันนี้ (' + meetings.length + ')</div>';
    meetings.forEach(function(m) {
      sm += '<div class="briefing-item">📅 ' + (m.time || '') + ' ' + sanitize(m.title || '') + '</div>';
    });
    sm += '</div>';
    sections.push(sm);
  }

  // Visits today
  var visits = [];
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }
  var todayVisits = (visits || []).filter(function(v) { return v.date === today; });
  (todayVisits || []).forEach(function(v) {
    var dd = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
    todayActivities.push({icon: '📍', text: 'Visit ' + (dd ? sanitize(dd.name) : '-') + ' (' + (v.mode || '-') + ')', time: v.time || '', type: 'visit'});
  });

  // Pipeline logs today
  var pipeLogs = [];
  try { pipeLogs = JSON.parse(localStorage.getItem('v7_pipelog') || '[]'); } catch(e) { pipeLogs = []; }
  var todayParts = today.split('/');
  var todayFormatted = todayParts[2] + '-' + todayParts[1] + '-' + todayParts[0];
  
  var todayPipeLogs = (pipeLogs || []).filter(function(l) {
    if (!l.date) return false;
    var logDate = l.date.split('T')[0];
    return logDate === todayFormatted || logDate === today;
  });

  var pipeLogIds = {};
  todayPipeLogs = (todayPipeLogs || []).filter(function(l) {
    if (pipeLogIds[l.id]) return false;
    pipeLogIds[l.id] = true;
    return true;
  });

  (todayPipeLogs || []).forEach(function(l) {
    var pipe = l.pipeId ? ST.getOne('pipeline', l.pipeId) : null;
    todayActivities.push({icon: '📊', text: (pipe ? sanitize((pipe.projectName || '').substr(0, 25)) + ' — ' : '') + sanitize((l.content || '').substr(0, 40)), time: l.date ? l.date.split('T')[1] || '' : '', type: 'pipeline'});
  });

  // Task logs today
  var taskLogs = [];
  try { taskLogs = JSON.parse(localStorage.getItem('v7_tasklogs') || '[]'); } catch(e) { taskLogs = []; }
  var todayTaskLogs = (taskLogs || []).filter(function(l) {
    if (!l.date) return false;
    var d = l.date.split('T')[0];
    return d === todayFormatted || d === today;
  });
  (todayTaskLogs || []).forEach(function(l) {
    var task = l.tid ? ST.getOne('tasks', l.tid) : null;
    todayActivities.push({icon: '📋', text: (task ? sanitize((task.title || '').substr(0, 25)) + ' — ' : '') + sanitize((l.content || '').substr(0, 40)), time: l.date ? l.date.split('T')[1] || '' : '', type: 'task'});
  });

  // Follow-ups done today
  var doneFU = (followups || []).filter(function(f) { return f.date === today && f.status === 'done'; });
  (doneFU || []).forEach(function(f) {
    var dd = f.dealerId ? ST.getOne('dealers', f.dealerId) : null;
    todayActivities.push({icon: '📞', text: 'Follow-up ' + (dd ? sanitize(dd.name) : '') + ' — ' + sanitize(f.content || f.note || ''), time: '', type: 'followup'});
  });

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

  // Upcoming
  var upcomingActions = (pendingActions || []).filter(function(p) { return p.daysLeft > 0 && p.daysLeft <= 3; });
  if (upcomingActions.length > 0) {
    var sup = '<div class="briefing-section">';
    sup += '<div class="briefing-section-title">📌 ใกล้กำหนด (3 วัน)</div>';
    upcomingActions.slice(0, 5).forEach(function(item) {
      sup += '<div class="briefing-item">🟡 ' + sanitize(item.action.text) + ' — ' + sanitize(item.pipe.projectName || '') + ' <span style="font-size:10px;color:var(--text2)">(อีก ' + item.daysLeft + ' วัน)</span></div>';
    });
    sup += '</div>';
    sections.push(sup);
  }

  // Day-of-week routines
  if (dow === 1) {
    sections.push('<div class="briefing-section"><div class="briefing-section-title">📊 วันจันทร์</div><div class="briefing-item">• วางแผน Visit สัปดาห์นี้</div><div class="briefing-item">• เช็ค Pipeline ที่ต้อง Update</div></div>');
  }
  if (dow === 5) {
    sections.push('<div class="briefing-section"><div class="briefing-section-title">📊 วันศุกร์</div><div class="briefing-item">• สรุป Weekly Report</div><div class="briefing-item">• Export Backup ข้อมูล</div><div class="briefing-item">• วางแผนสัปดาห์หน้า</div></div>');
  }

  // Stats
  var allPipes = [];
  try { allPipes = ST.getAll('pipeline'); } catch(e) { allPipes = []; }
  var activePipes = (allPipes || []).filter(function(p) { return pipeIsOpen(p); });
  var activeAmt = 0;
  activePipes.forEach(function(p) { activeAmt += (Number(p.forecastAmount) || 0); });

  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  var weekVisits = (visits || []).filter(function(v) {
    var vd = ftParseDate(v.date);
    return vd && vd >= weekStart;
  });

  var statsHtml = '<div class="briefing-stats">';
  statsHtml += '<div class="briefing-stat"><div class="briefing-stat-val">' + activePipes.length + '</div><div class="briefing-stat-label">Pipeline</div></div>';
  statsHtml += '<div class="briefing-stat"><div class="briefing-stat-val">' + fmtMoneyShort(activeAmt) + '</div><div class="briefing-stat-label">Forecast</div></div>';
  statsHtml += '<div class="briefing-stat"><div class="briefing-stat-val">' + weekVisits.length + '</div><div class="briefing-stat-label">Visit/Wk</div></div>';
  statsHtml += '<div class="briefing-stat"><div class="briefing-stat-val">' + pendingActions.length + '</div><div class="briefing-stat-label">Action</div></div>';
  statsHtml += '</div>';

  if (sections.length === 0) {
    h += '<div class="briefing-clear">✅ ไม่มีเรื่องด่วน — วันนี้เปิดโล่ง!</div>';
  } else {
    h += sections.join('');
  }

  h += statsHtml;
  h += '<div class="briefing-links">';
  h += '<button class="btn bsm bp" onclick="copyDailyBriefing()">📋 Copy สรุปวันนี้</button>';
  h += '<button class="btn bsm bo" onclick="go(\'pipeline\')">📊 Pipeline</button>';
  h += '<button class="btn bsm bo" onclick="go(\'tasks\')">📋 Tasks</button>';
  h += '<button class="btn bsm bo" onclick="go(\'forecast\')">📦 Forecast</button>';
  h += '</div>';
  h += '</div>';
  
  return h;
}

function copyDailyBriefing() {
  var now = new Date();
  var today = _td();
  var dow = now.getDay();
  var dayNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

  var t = '📊 Daily Summary — วัน' + dayNames[dow] + ' ' + today + '\n';
  t += '👤 Siwawong — SIS Distribution (DJI Enterprise)\n';
  t += '━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  var visits = [];
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }
  var todayVisits = (visits || []).filter(function(v) { return v.date === today; });
  if (todayVisits.length) {
    t += '📍 Visit (' + todayVisits.length + '):\n';
    todayVisits.forEach(function(v) {
      var dd = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
      t += '• ' + (dd ? dd.name : '-') + ' (' + (v.mode || '-') + ')\n';
    });
    t += '\n';
  }

  var pipeLogs = [];
  try { pipeLogs = JSON.parse(localStorage.getItem('v7_pipelog') || '[]'); } catch(e) { pipeLogs = []; }
  var todayPL = (pipeLogs || []).filter(function(l) {
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

  var followups = [];
  try { followups = JSON.parse(localStorage.getItem('v7_followups') || '[]'); } catch(e) { followups = []; }
  var todayFU = (followups || []).filter(function(f) { return f.date === today; });
  if (todayFU.length) {
    t += '📞 Follow-up (' + todayFU.length + '):\n';
    todayFU.forEach(function(f) {
      var dd = f.dealerId ? ST.getOne('dealers', f.dealerId) : null;
      t += '• ' + (dd ? dd.name : '-') + ' — ' + (f.content || f.note || '').substr(0, 50) + '\n';
    });
    t += '\n';
  }

  var pendingActions = [];
  try { pendingActions = getAllPendingPipeActions(); } catch(e) { pendingActions = []; }
  var overdueActions = (pendingActions || []).filter(function(p) { return p.urgency === 'overdue' || p.daysLeft === 0; });
  if (overdueActions.length) {
    t += '🔴 Action ด่วน (' + overdueActions.length + '):\n';
    overdueActions.forEach(function(item) {
      t += '• ' + item.action.text + ' — ' + (item.pipe.projectName || '') + '\n';
    });
    t += '\n';
  }

  var allPipes = [];
  try { allPipes = ST.getAll('pipeline'); } catch(e) { allPipes = []; }
  var activePipes = (allPipes || []).filter(function(p) { return pipeIsOpen(p); });
  var activeAmt = 0;
  activePipes.forEach(function(p) { activeAmt += (Number(p.forecastAmount) || 0); });

  t += '━━━━━━━━━━━━━━━━━━━━━━━━\n';
  t += '📊 Pipeline: ' + activePipes.length + ' active • ฿' + fmtMoney(activeAmt) + '\n';
  t += '⏳ Action ค้าง: ' + pendingActions.length + ' รายการ\n';

  copyText(t);
  toast('📋 Copy สรุปวันนี้แล้ว! ส่งหัวหน้าได้เลย');
}

// ================================================================
// RENDER UPCOMING TIMELINE (SAFE VERSION)
// ================================================================
function renderUpcomingTimeline() {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  var today = _td();

  var allItems = [];

  // ST.getOne(collection,id) = ST.getAll(collection).find(...) ทุกครั้ง (parse array ใหม่ทั้งก้อน ไม่มี cache)
  // — ฟังก์ชันนี้เรียก ST.getOne('dealers', ...) ในลูปหลายจุด (task/action/pipeline follow-up/bidding/
  // follow-up) รวมกันหลายร้อยครั้งตามจำนวน record กลายเป็น O(records × dealers) พบว่าเป็นคอขวดตัวจริง (ST.getAll
  // ถูกเรียกซ้ำ 300 ครั้งตอนทดสอบ Pipeline 300 รายการ) ทำ map ไว้ครั้งเดียวแทน
  var _rutDealerMap = {};
  ST.getAll('dealers').forEach(function(d) { _rutDealerMap[d.id] = d; });

  // Tasks
  var tasks = [];
  try { tasks = ST.getAll('tasks'); } catch(e) { tasks = []; }
  (tasks || []).forEach(function(t) {
    if (t.status === 'completed') return;
    if (t.dueDate) {
      var d = ftParseDate(t.dueDate);
      if (d) {
        var dd = t.dealerId ? (_rutDealerMap[t.dealerId] || null) : null;
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

  // Pipeline Actions
  var pipeActions = [];
  try { pipeActions = getPipeActions(); } catch(e) { pipeActions = []; }
  (pipeActions || []).forEach(function(a) {
    if (a.status !== 'pending') return;
    if (!a.dueDate) return;
    var d = ftParseDate(a.dueDate);
    if (!d) return;
    var pipe = null;
    try { pipe = ST.getOne('pipeline', a.pipeId); } catch(e) { pipe = null; }
    if (!pipe) return;
    if (!pipeIsOpen(pipe)) return;
    var dealer = pipe.dealerId ? (_rutDealerMap[pipe.dealerId] || null) : null;
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

  // Pipeline Follow-up Dates
  var pipeline = [];
  try { pipeline = ST.getAll('pipeline'); } catch(e) { pipeline = []; }
  // index ล่วงหน้าก่อนเข้าลูป — เดิมเรียก pipeOpenTasks(p.id) (ST.getAll('tasks').filter() ใหม่ทุกครั้ง, 2 รอบ
  // ต่อรายการด้วย) และวน pipeActions ซ้อนในลูป pipeline อีกที ทั้งคู่กลายเป็น O(pipelines × tasks/actions) —
  // คือคอขวดหลักของ renderUpcomingTimeline (วัดได้ ~190ms ตอน pipeline 300 รายการ)
  var _rutOpenTaskByPipe = {};
  ST.getAll('tasks').forEach(function(t) {
    if (t.status === 'completed' || !t.pipeId) return;
    if (!_rutOpenTaskByPipe[t.pipeId]) _rutOpenTaskByPipe[t.pipeId] = [];
    _rutOpenTaskByPipe[t.pipeId].push(t);
  });
  Object.keys(_rutOpenTaskByPipe).forEach(function(pid) {
    _rutOpenTaskByPipe[pid].sort(function(a, b) { return (a.created || '').localeCompare(b.created || ''); });
  });
  var _rutCoveredKeys = {};
  (pipeActions || []).forEach(function(a) {
    if (a.status === 'pending') _rutCoveredKeys[a.pipeId + '|' + a.dueDate] = true;
  });
  (pipeline || []).forEach(function(p) {
    if (!pipeIsOpen(p)) return;
    if (p.followupDate) {
      var fd = ftParseDate(p.followupDate);
      if (fd) {
        var dealer = p.dealerId ? (_rutDealerMap[p.dealerId] || null) : null;
        var covered = !!_rutCoveredKeys[p.id + '|' + p.followupDate];
        if (!covered) {
          var _firstOpenTask = _rutOpenTaskByPipe[p.id] && _rutOpenTaskByPipe[p.id][0];
          allItems.push({
            date: p.followupDate,
            dateObj: fd,
            icon: '📊',
            text: 'Follow-up: ' + sanitize((p.projectName || '').substr(0, 30)),
            sub: (dealer ? '🏪 ' + sanitize(dealer.name) : '') + (_firstOpenTask ? ' • 🎯 ' + sanitize(_firstOpenTask.title) : ''),
            type: 'pipeline',
            link: "go('pipeDetail',{pipeId:'" + p.id + "'})"
          });
        }
      }
    }
    if (p.biddingDate && pipeIsActive(p)) {
      var bd = ftParseDate(p.biddingDate);
      if (bd) {
        var dealer2 = p.dealerId ? (_rutDealerMap[p.dealerId] || null) : null;
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

  // Follow-ups
  var followups = [];
  try { followups = JSON.parse(localStorage.getItem('v7_followups') || '[]'); } catch(e) { followups = []; }
  (followups || []).forEach(function(f) {
    if (f.status === 'done') return;
    var fDate = f.dueDate || f.date;
    if (!fDate) return;
    var fd = ftParseDate(fDate);
    if (!fd) return;
    var dealer = f.dealerId ? (_rutDealerMap[f.dealerId] || null) : null;
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

  // Meetings
  var meetings = [];
  try { meetings = ST.getAll('meetings'); } catch(e) { meetings = []; }
  (meetings || []).forEach(function(m) {
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

  allItems.sort(function(a, b) { return a.dateObj - b.dateObj; });

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

  var totalCount = overdue.length + todayItems.length + in3Days.length + thisWeek.length + nextWeek.length;
  if (totalCount === 0) return '';

  var h = '<div class="card"><h2>📋 สิ่งที่ต้องทำ <span class="pa-count-badge">' + totalCount + '</span></h2>';

  function renderGroup(items, title, colorClass) {
    if (!items || items.length === 0) return '';
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
// GET PIPE ACTIONS (SAFE VERSION)
// ================================================================
function getPipeActions() {
  var saved = localStorage.getItem('v7_pipeActions');
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      // ✅ กัน null/object ที่ sync มาจาก Firebase — ต้องคืน array เสมอ
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  return [];
}

function savePipeActions(list) {
  localStorage.setItem('v7_pipeActions', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('pipeActions', list);
}

function getPipeActionsByPipe(pipeId) {
  var actions = getPipeActions();
  return (actions || []).filter(function (a) {
    return a.pipeId === pipeId && a.status !== 'dropped';
  });
}

function getAllPendingPipeActions() {
  var actions = getPipeActions();
  var pipeline = [];
  var dealers = [];
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }
  try { dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]'); } catch(e) { dealers = []; }
  var now = new Date();
  now.setHours(0, 0, 0, 0);

  var pending = [];
  
  if (actions && Array.isArray(actions)) {
    actions.forEach(function (a) {
      if (a.status !== 'pending') return;
      
      var pipe = null;
      if (pipeline && Array.isArray(pipeline)) {
        for (var i = 0; i < pipeline.length; i++) {
          if (pipeline[i] && pipeline[i].id === a.pipeId) { 
            pipe = pipeline[i]; 
            break; 
          }
        }
      }
      
      if (!pipe) return;
      if (!pipeIsOpen(pipe)) return;

      var dealer = null;
      if (dealers && Array.isArray(dealers)) {
        for (var j = 0; j < dealers.length; j++) {
          if (dealers[j] && dealers[j].id === pipe.dealerId) { 
            dealer = dealers[j]; 
            break; 
          }
        }
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
  }

  pending.sort(function (a, b) { return a.daysLeft - b.daysLeft; });
  return pending;
}

function autoUpdatePipeNextAction(pipeId) {
  var actions = getPipeActionsByPipe(pipeId);
  var pending = (actions || []).filter(function (a) { return a.status === 'pending'; });

  if (!pending.length) return;

  pending.sort(function (a, b) {
    var da = ftParseDate(a.dueDate);
    var db = ftParseDate(b.dueDate);
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  var nearest = pending[0];
  var pipe = null;
  try { pipe = ST.getOne('pipeline', pipeId); } catch(e) { pipe = null; }
  if (!pipe) return;

  var updates = {};
  if (nearest.text) updates.nextAction = nearest.text;
  if (nearest.dueDate) updates.followupDate = nearest.dueDate;

  try { ST.update('pipeline', pipeId, updates); } catch(e) {}
}

function getPipeActionNotifications() {
  var pending = getAllPendingPipeActions();
  var notifs = [];
  
  if (!pending || pending.length === 0) return notifs;

  var overdue = (pending || []).filter(function (p) { return p.urgency === 'overdue'; });
  var urgent = (pending || []).filter(function (p) { return p.urgency === 'urgent'; });

  if (overdue.length > 0) {
    notifs.push({
      icon: '🔴',
      type: 'pipeline_action',
      priority: 1,
      text: 'Pipeline Action Item เกินกำหนด ' + overdue.length + ' รายการ'
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
// EXPORT FUNCTIONS
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

function ftFmtFull(v) {
  v = parseFloat(v) || 0;
  return v.toLocaleString('th-TH', { minimumFractionDigits: 0 });
}

// ================================================================
// WEEKLY REPORT PAGE
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

  if (data.visits.length) {
    h += '<div class="card"><h2>📍 Visit (' + data.visits.length + ')</h2>';
    data.visits.forEach(function(v) {
      var dn = getDealerName(v.dealerId);
      h += '<div class="li"><div class="lm"><div class="lt">' + sanitize(dn) + '</div>';
      h += '<div class="ls">' + (v.date || '-') + ' • ' + (v.mode || '-') + '</div></div></div>';
    });
    h += '</div>';
  }

  if (data.wins.length) {
    h += '<div class="card"><h2>🏆 Win (' + data.wins.length + ')</h2>';
    data.wins.forEach(function(p) {
      h += '<div class="li"><div class="lm"><div class="lt">' + sanitize(p.project || p.name || '-') + '</div>';
      h += '<div class="ls">' + getDealerName(p.dealerId) + ' • ฿' + ftFmtFull(p.value) + '</div></div></div>';
    });
    h += '</div>';
  }

  if (data.losses.length) {
    h += '<div class="card"><h2>❌ Lost (' + data.losses.length + ')</h2>';
    data.losses.forEach(function(p) {
      h += '<div class="li"><div class="lm"><div class="lt">' + sanitize(p.project || p.name || '-') + '</div>';
      h += '<div class="ls">' + getDealerName(p.dealerId) + ' • ฿' + ftFmtFull(p.value) + '</div></div></div>';
    });
    h += '</div>';
  }

  if (data.visits.length) {
    h += '<div class="card"><h2>📊 Visit Report Table — ' + data.label;
    h += '<span class="ml">';
    h += '<button class="btn bsm bp" onclick="copyWeeklyVisitTable()">📋 Copy (Sheets)</button>';
    h += '<button class="btn bsm bo" onclick="dlWeeklyVisitCSV()">📤 CSV</button>';
    h += '</span></h2>';
    h += '<div class="export-wrap" style="overflow-x:auto"><table class="export-table" id="weekVisitTable">';
    h += '<thead><tr><th>#</th><th>Date</th><th>Sale</th><th>Dealer Name</th><th>Offline/Online</th><th>DJI Dealer<br>(SAB/Other)</th><th>Update</th><th>Location</th><tr></thead>';
    h += '<tbody>';

    var cfg = getConfig();
    data.visits.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });

    data.visits.forEach(function(v, idx) {
      var dealer = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
      var dealerName = dealer ? dealer.name : '-';
      var mode = v.mode === 'offline' ? 'Offline' : 'Online';
      var djiDealer = v.djiDealer || (dealer ? dealer.djiDealer : '') || '-';
      var saleName = v.saleName || (cfg ? cfg.saleName : 'Siwawong') || 'Siwawong';
      var location = v.location || (dealer ? dealer.googleMap : '') || '-';

      var update = buildVisitUpdateForExport(v, cfg);

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

    h += '</tbody><table></div></div>';
  }

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

  var visits = [];
  var pipeline = [];
  var pipelog = [];
  var followups = [];
  
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }
  try { pipelog = JSON.parse(localStorage.getItem('v7_pipelog') || '[]'); } catch(e) { pipelog = []; }
  try { followups = JSON.parse(localStorage.getItem('v7_followups') || '[]'); } catch(e) { followups = []; }

  function inRange(dateStr) {
    var d = ftParseDate(dateStr);
    return d && d >= start && d <= end;
  }
  function inRangeDT(dateStr) {
    if (!dateStr) return false;
    // ✅ รองรับ Firestore Timestamp / Date / object {seconds} ไม่ใช่แค่ string
    if (typeof dateStr !== 'string') {
      if (typeof dateStr.toDate === 'function') dateStr = dateStr.toDate().toISOString();
      else if (dateStr.seconds) dateStr = new Date(dateStr.seconds * 1000).toISOString();
      else if (dateStr instanceof Date) dateStr = dateStr.toISOString();
      else return false;
    }
    var d = ftParseDate(dateStr.split(' ')[0]);
    return d && d >= start && d <= end;
  }

  var wVisits = (visits || []).filter(function(v) { return inRange(v.date); });
  var wPipeLogs = (pipelog || []).filter(function(l) { return inRangeDT(l.date); });
  var wFollowups = (followups || []).filter(function(f) { return inRange(f.date || f.dueDate); });
  var wWins = (pipeline || []).filter(function(p) { return p.status === 'win' && inRangeDT(p.updatedAt || p.date); });
  var wLosses = (pipeline || []).filter(function(p) { return p.status === 'fail_lost' && inRangeDT(p.updatedAt || p.date); });

  var totalWinVal = 0;
  wWins.forEach(function(p) { totalWinVal += parseFloat(p.value) || 0; });

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

function getDealerName(id) {
  try {
    var dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]');
    for (var i = 0; i < dealers.length; i++) {
      if (dealers[i].id === id) return dealers[i].name || '-';
    }
  } catch(e) {}
  return '-';
}

function buildVisitUpdateForExport(v, cfg) {
  if (!v) return '';
  var update = '';

  if (v.topicData && v.topicData.length) {
    var answered = (v.topicData || []).filter(function(td) { return td.answered; });
    answered.forEach(function(td, ti) {
      var topic = null;
      var topics = (cfg && cfg.visitTopics) || [];
      for (var i = 0; i < topics.length; i++) {
        if (topics[i].id === td.topicId) { topic = topics[i]; break; }
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

  if (v.summary) update += 'สรุป: ' + v.summary;

  return update.trim();
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
    var saleName = v.saleName || (cfg ? cfg.saleName : 'Siwawong') || 'Siwawong';
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
    var saleName = v.saleName || (cfg ? cfg.saleName : 'Siwawong') || 'Siwawong';
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

function copyReportBullet() {
  var data = getWeekData(reportRange);
  var t = '';
  t += '📊 Weekly Report — ' + data.label + '\n';
  t += '━━━━━━━━━━━━━━━━━━━━━━━━\n';
  t += '👤 Siwawong — SIS Distribution (DJI Enterprise)\n\n';
  t += '📍 VISIT (' + data.visits.length + ')\n';
  if (data.visits.length) {
    data.visits.forEach(function(v) {
      t += '• ' + (v.date || '-') + ' — ' + getDealerName(v.dealerId) + ' | ' + (v.mode || '-') + '\n';
    });
  } else {
    t += '• ไม่มี\n';
  }
  t += '\n📋 PIPELINE UPDATE: ' + data.pipeUpdates + ' รายการ\n';
  t += '📞 FOLLOW-UP: ' + data.followups + ' ครั้ง\n';
  t += '\n🏆 WIN (' + data.wins.length + ')\n';
  if (data.wins.length) {
    data.wins.forEach(function(p) {
      t += '• ' + sanitize(p.project || p.name || '-') + ' — ' + getDealerName(p.dealerId) + ' — ฿' + ftFmtFull(p.value) + '\n';
    });
  } else {
    t += '• ไม่มี\n';
  }
  t += '\n❌ LOST (' + data.losses.length + ')\n';
  if (data.losses.length) {
    data.losses.forEach(function(p) {
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

  data.visits.forEach(function(v) {
    rows.push(['Visit', v.date || '-', getDealerName(v.dealerId), v.mode || '-'].join('\t'));
  });
  data.wins.forEach(function(p) {
    rows.push(['Win', p.updatedAt || p.date || '-', getDealerName(p.dealerId), (p.project || p.name || '-') + ' ฿' + ftFmtFull(p.value)].join('\t'));
  });
  data.losses.forEach(function(p) {
    rows.push(['Lost', p.updatedAt || p.date || '-', getDealerName(p.dealerId), p.project || p.name || '-'].join('\t'));
  });
  rows.push(['', '', '', ''].join('\t'));
  rows.push(['Summary', 'Visit: ' + data.visits.length, 'Follow-up: ' + data.followups, 'Pipeline Update: ' + data.pipeUpdates].join('\t'));
  rows.push(['', 'Win: ' + data.wins.length, 'Lost: ' + data.losses.length, 'Revenue Won: ฿' + ftFmtFull(data.totalWinVal)].join('\t'));

  copyText(rows.join('\n'));
  toast('📊 Copy Report (Table) แล้ว! วาง Sheets ได้เลย');
}
// ================================================================
// DASHBOARD PAGE
// ================================================================
function rDashboard(el) {
  document.getElementById('pgT').textContent = '📈 Dashboard';
  
  var dealers = [];
  var pipeline = [];
  var visits = [];
  
  try { dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]'); } catch(e) { dealers = []; }
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }

  var h = '<div class="dash-grid">';

  // 1. Pipeline Funnel
  h += '<div class="card"><h2>🔽 Pipeline Funnel</h2>';
  h += buildFunnelChart(pipeline);
  h += '</div>';

  // 2. Win Rate Donut
  h += '<div class="card"><h2>🎯 Win Rate</h2>';
  h += buildDonutChart(pipeline);
  h += '</div>';

  // 3. Revenue vs Target (Top 10)
  h += '<div class="card dash-wide"><h2>💰 Revenue vs Target (Top 10)</h2>';
  h += buildRevenueChart(dealers, pipeline);
  h += '</div>';

  // 4. Visit Trend (8 สัปดาห์)
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
    { key: 'initial', label: '01 Initial', color: '#eab308' },
    { key: 'on_process', label: '02 On process', color: '#f97316' },
    { key: 'draft_tor', label: '03 Draft TOR', color: '#f9a8d4' },
    { key: 'bidding', label: '04 Bidding', color: '#94a3b8' },
    { key: 'win', label: '05 Win', color: '#22c55e' },
    { key: 'fail_lost', label: '05 Fail & Lost', color: '#ef4444' },
    { key: 'contracting', label: '06 Contracting', color: '#0f766e' },
    { key: 'deliver', label: '07 Deliver', color: '#6366f1' }
  ];

  var maxCount = 1;
  stages.forEach(function(s) {
    s.count = (pipeline || []).filter(function(p) { return p.status === s.key; }).length;
    s.value = 0;
    (pipeline || []).forEach(function(p) { if (p.status === s.key) s.value += parseFloat(p.value) || 0; });
    if (s.count > maxCount) maxCount = s.count;
  });

  var h = '<div class="funnel">';
  stages.forEach(function(s) {
    if (s.count === 0) return;
    var pct = Math.max(20, Math.round(s.count / maxCount * 100));
    h += '<div class="funnel-row" style="width:' + pct + '%;background:' + s.color + '">';
    h += '<span class="funnel-label">' + s.label + '</span>';
    h += '<span class="funnel-val">' + s.count + ' (฿' + ftFmtVal(s.value) + ')</span>';
    h += '</div>';
  });
  if (maxCount <= 1 && (!pipeline || pipeline.length === 0)) {
    h += '<div style="text-align:center;padding:20px;color:var(--text2)">ยังไม่มีข้อมูล</div>';
  }
  h += '</div>';
  return h;
}

function buildDonutChart(pipeline) {
  var wins = (pipeline || []).filter(function(p) { return pipeIsWon(p); }).length;
  var losses = (pipeline || []).filter(function(p) { return p.status === 'fail_lost'; }).length;
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
  (dealers || []).forEach(function(d) {
    var target = parseFloat(d.targetRevenue) || 0;
    var achieved = parseFloat(d.achievement) || 0;
    var pipeVal = 0;
    (pipeline || []).forEach(function(p) {
      if (p.dealerId === d.id && p.status !== 'fail_lost') pipeVal += parseFloat(p.value) || 0;
    });
    if (target > 0 || achieved > 0 || pipeVal > 0) {
      stats.push({ name: d.name || '-', target: target, achieved: achieved, pipeline: pipeVal });
    }
  });
  stats.sort(function(a, b) { return b.target - a.target; });
  stats = stats.slice(0, 10);

  if (!stats.length) return '<div style="text-align:center;padding:20px;color:var(--text2)">ยังไม่มีข้อมูล Target</div>';

  var maxVal = 1;
  stats.forEach(function(s) {
    var m = Math.max(s.target, s.achieved, s.pipeline);
    if (m > maxVal) maxVal = m;
  });

  var h = '<div class="rev-chart">';
  stats.forEach(function(s) {
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

    var cnt = (visits || []).filter(function(v) {
      var d = ftParseDate(v.date);
      return d && d >= ws && d <= we;
    }).length;

    var lbl = (ws.getDate()) + '/' + (ws.getMonth() + 1);
    weeks.push({ count: cnt, label: lbl });
  }

  var maxC = 1;
  weeks.forEach(function(w) { if (w.count > maxC) maxC = w.count; });

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
  (dealers || []).forEach(function(d) {
    var val = 0;
    (pipeline || []).forEach(function(p) {
      if (p.dealerId === d.id && pipeIsOpen(p)) val += parseFloat(p.value) || 0;
    });
    if (val > 0) stats.push({ name: d.name || '-', value: val });
  });
  stats.sort(function(a, b) { return b.value - a.value; });
  if (!stats.length) return '<div style="text-align:center;padding:20px;color:var(--text2)">ยังไม่มีข้อมูล</div>';

  var maxV = stats[0].value || 1;
  var h = '<div class="dpipe-chart">';
  stats.forEach(function(s) {
    var pct = Math.max(5, Math.round(s.value / maxV * 100));
    h += '<div class="dpipe-row"><div class="dpipe-name">' + sanitize(s.name).substring(0, 18) + '</div>';
    h += '<div class="dpipe-track"><div class="dpipe-fill" style="width:' + pct + '%">฿' + ftFmtVal(s.value) + '</div></div></div>';
  });
  h += '</div>';
  return h;
}

// ================================================================
// DATA HEALTH CHECK PAGE
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

    var critical = (result.issues || []).filter(function(i) { return i.level === 'critical'; });
    var warning = (result.issues || []).filter(function(i) { return i.level === 'warning'; });
    var info = (result.issues || []).filter(function(i) { return i.level === 'info'; });

    if (critical.length) {
      h += '<div class="health-section">🔴 Critical (' + critical.length + ')</div>';
      critical.forEach(function(i) {
        h += '<div class="health-issue health-critical">' + i.icon + ' ' + sanitize(i.text);
        if (i.action) h += ' <button class="btn-xs" onclick="' + i.action + '">แก้ไข →</button>';
        h += '</div>';
      });
    }
    if (warning.length) {
      h += '<div class="health-section">🟡 Warning (' + warning.length + ')</div>';
      warning.forEach(function(i) {
        h += '<div class="health-issue health-warning">' + i.icon + ' ' + sanitize(i.text);
        if (i.action) h += ' <button class="btn-xs" onclick="' + i.action + '">แก้ไข →</button>';
        h += '</div>';
      });
    }
    if (info.length) {
      h += '<div class="health-section">🔵 Info (' + info.length + ')</div>';
      info.forEach(function(i) {
        h += '<div class="health-issue health-info">' + i.icon + ' ' + sanitize(i.text) + '</div>';
      });
    }
    h += '</div>';
  } else {
    h += '<div class="card" style="text-align:center;padding:24px"><div style="font-size:48px;margin-bottom:8px">🎉</div><div>ข้อมูลสมบูรณ์ 100%!</div></div>';
  }

  // Dealer detail
  h += '<div class="card"><h2>🏪 Dealer Data Detail</h2>';
  var dealers = [];
  try { dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]'); } catch(e) { dealers = []; }
  (dealers || []).forEach(function(d) {
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

  fields.forEach(function(f) {
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
  var dealers = [];
  var pipeline = [];
  var visits = [];
  var issues = [];

  try { dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]'); } catch(e) { dealers = []; }
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }

  // Dealer health
  var dealerTotal = 0;
  (dealers || []).forEach(function(d) {
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
  // index งานค้างต่อ pipe ครั้งเดียว — เดิม pipeOpenTasks(p.id) (→ ST.getAll('tasks') parse ใหม่ทั้ง
  // collection ไม่มีแคช) ถูกเรียก 2 รอบต่อ Pipeline ที่ active ทุกรายการ
  var _ohOpenTaskIdx = {};
  ST.getAll('tasks').forEach(function(t) { if (t.status !== 'completed' && t.pipeId) _ohOpenTaskIdx[t.pipeId] = true; });
  var pipeTotal = 0;
  var activePipe = (pipeline || []).filter(function(p) { return pipeIsOpen(p); });
  (activePipe || []).forEach(function(p) {
    var score = 0;
    var max = 0;
    max += 10; if (p.project || p.name) score += 10;
    max += 10; if (p.dealerId) score += 10;
    max += 10; if (p.value && parseFloat(p.value) > 0) score += 10;
    max += 8; if (p.model) score += 8;
    max += 8; if (_ohOpenTaskIdx[p.id]) score += 8;
    max += 8; if (p.followupDate || p.nextFollowup) score += 8;
    max += 5; if (p.contactName || p.contact) score += 5;
    var pScore = max > 0 ? Math.round(score / max * 100) : 100;
    pipeTotal += pScore;

    if (!_ohOpenTaskIdx[p.id] && (parseFloat(p.value) || 0) >= 500000) {
      issues.push({ level: 'warning', icon: '📋', text: (p.project || p.name || 'Unknown') + ' — ไม่มี Task ติดตาม (฿' + ftFmtVal(p.value) + ')', action: "go('pipeDetail',{pipeId:'" + p.id + "'})" });
    }
    if (!p.followupDate && !p.nextFollowup) {
      issues.push({ level: 'info', icon: '📋', text: (p.project || p.name || 'Unknown') + ' — ไม่มี Follow-up Date' });
    }
  });
  var pipeScore = activePipe.length ? Math.round(pipeTotal / activePipe.length) : 100;

  // Visit health
  var visitTotal = 0;
  var recentVisits = (visits || []).slice(-20);
  recentVisits.forEach(function(v) {
    var score = 0;
    var max = 0;
    max += 10; if (v.date) score += 10;
    max += 10; if (v.dealerId) score += 10;
    max += 8; if (v.mode) score += 8;
    max += 8; if (v.update && v.update.trim().length > 10) score += 8;
    var vScore = max > 0 ? Math.round(score / max * 100) : 100;
    visitTotal += vScore;
  });
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
  var critCount = (result.issues || []).filter(function(i) { return i.level === 'critical'; }).length;

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
// MONTHLY GOAL DASHBOARD
// ================================================================
var goalMonth = '';

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

  var visits = [];
  var pipeline = [];
  var followups = [];
  var dealers = [];
  
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }
  try { pipeline = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) { pipeline = []; }
  try { followups = JSON.parse(localStorage.getItem('v7_followups') || '[]'); } catch(e) { followups = []; }
  try { dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]'); } catch(e) { dealers = []; }

  var monthVisits = (visits || []).filter(function(v) {
    var d = ftParseDate(v.date);
    return d && d >= startDate && d <= endDate;
  });

  var monthWins = (pipeline || []).filter(function(p) {
    if (!pipeIsWon(p)) return false;
    var d = ftParseDate(p.updatedAt || p.date);
    return d && d >= startDate && d <= endDate;
  });

  var monthRevenue = 0;
  monthWins.forEach(function(p) { monthRevenue += (Number(p.forecastAmount) || 0); });

  var monthFollowups = (followups || []).filter(function(f) {
    var d = ftParseDate(f.date || f.dueDate);
    return d && d >= startDate && d <= endDate;
  });

  var monthNewPipe = (pipeline || []).filter(function(p) {
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
  h += '<div class="fm-group"><label>💰 Revenue Target (฿)</label><input type="text" inputmode="decimal" id="gl_rev" class="fm-input js-money" value="' + nmI(t.revenue || '') + '"></div>';
  h += '<div class="fm-group"><label>📍 Visit Target</label><input type="number" id="gl_visit" class="fm-input" value="' + (t.visits || '') + '"></div>';
  h += '<div class="fm-group"><label>📞 Follow-up Target</label><input type="number" id="gl_fu" class="fm-input" value="' + (t.followups || '') + '"></div>';
  h += '<div class="fm-group"><label>📋 Pipeline ใหม่ Target</label><input type="number" id="gl_pipe" class="fm-input" value="' + (t.newPipeline || '') + '"></div>';
  h += '<div class="fm-group"><label>🏪 Dealer Coverage Target</label><input type="number" id="gl_dealer" class="fm-input" value="' + (t.dealerCoverage || '') + '"></div>';
  h += '<div class="fm-group"><label>🏆 Win Deal Target</label><input type="number" id="gl_win" class="fm-input" value="' + (t.wins || '') + '"></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="saveGoalTargets()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('🎯 ตั้งเป้า', h);
}

function saveGoalTargets() {
  var goals = getMonthlyGoals();
  var targets = {
    revenue: parseNum(document.getElementById('gl_rev').value),
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

function getMonthlyGoals() {
  var saved = localStorage.getItem('v7_goals_v2');
  if (saved) { try { return JSON.parse(saved); } catch(e) { return []; } }
  return [];
}

function saveGoalData(list) {
  localStorage.setItem('v7_goals_v2', JSON.stringify(list));
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
// ================================================================
// DEMO EQUIPMENT TRACKER
// ================================================================
function getDemoItems() {
  var saved = localStorage.getItem('v7_demo');
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      // migrate สถานะเดิม "maintenance" -> "unavailable"; เครื่องเก่าที่ยังไม่มี flyable ถือว่าบินได้ (ค่าเดิม
      // ก่อนแยกประเภท เครื่องส่วนใหญ่ในระบบบินได้จริง ปลอดภัยกว่าเดาเป็นโชว์อย่างเดียว)
      var migrated = false;
      parsed.forEach(function(d) {
        if (d.status === 'maintenance') { d.status = 'unavailable'; migrated = true; }
        if (d.flyable === undefined) { d.flyable = true; migrated = true; }
      });
      if (migrated) saveDemoItems(parsed);
      return parsed;
    } catch(e) {
      return [];
    }
  }
  return [];
}

function saveDemoItems(list) {
  if (!list || !Array.isArray(list)) list = [];
  localStorage.setItem('v7_demo', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('demo', list);
  publishDemoCatalog();
}

// ชื่อ doc เปลี่ยนจาก __demoCatalog__ เป็น demoCatalogPublic (2026-09-05) — Firestore สงวนชื่อ document ที่
// ขึ้นต้น-ลงท้ายด้วย __ ไว้ใช้ภายใน สั่ง .doc('__demoCatalog__').get()/.set() จริงจะ error ทันที ("Resource id
// is invalid because it is reserved") แปลว่า path เดิมไม่เคยอ่าน/เขียนสำเร็จเลยตั้งแต่แรก (แต่ .catch() ด้านล่าง
// กลืน error ไว้เงียบๆ เลยไม่มีใครสังเกตเห็น) เจอตอนทดสอบ demo-request.html จริงกับ Firestore — __catalog__
// ของสินค้าใน products.js เจอปัญหาเดียวกัน แต่ยังไม่ได้แก้ในรอบนี้ (นอกขอบเขตงาน Demo)
//
// เผยแพร่สำเนา read-only ของแคตตาล็อก Demo ไปที่ dealerUpdates/demoCatalogPublic — path สาธารณะเดียวกับที่
// publishCatalogToClientView() ใช้กับสินค้า (ดู products.js) เพราะ users/{uid}/... อ่านไม่ได้ถ้าไม่ login
// ตั้งใจไม่ใส่ชื่อผู้ยืม/Dealer เพื่อรักษาความเป็นส่วนตัว (ลูกค้าใน client-view.html เห็นแค่ว่าง/ไม่ว่าง)
// ponytail: ช่วงไม่ว่างคำนวณจาก loan ที่ยืนยันแล้ว (active) เท่านั้น ไม่รวมคำขอที่ยังรออนุมัติ — คำขอใหม่จะ
// ไม่ไปกันคนอื่นเห็นว่าง จนกว่า staff จะกดอนุมัติจริง ถ้าต้องการกันไว้ตั้งแต่ส่งคำขอ ต้อง query demoRequests
// ข้าม dealer ทุกตัวตอน publish ซึ่งมีต้นทุนสูงกว่ามากเทียบกับที่ได้ ไม่คุ้มสำหรับตอนนี้
//
// เพิ่ม sku/serialNumber/rentalDbNo/compliance/category (2026-09-05) ให้ demo-staff.html (หน้าจัดการภายใน
// แบบรหัสผ่านร่วม ไม่ผ่าน Auth) อ่านได้ครบ — ทำให้เอกสารนี้มีรายละเอียดเครื่องที่เดิมตั้งใจไม่เผยแพร่ (S/N,
// SKU) หลุดไปอยู่ใน path ที่อ่านได้โดยไม่ login เลย (เหมือน demoCatalogPublic เดิม) ความเสี่ยงเดียวกับที่ยอมรับ
// อยู่แล้วทั้งระบบ (permission เปิดกว้าง รอผู้ใช้ปิดเองทีหลัง) — demo-request.html (ฝั่งลูกค้า) จะไม่โชว์ฟิลด์
// พวกนี้ แต่ตัวเอกสารเองอ่านได้ถ้ารู้ path ตรงๆ
function publishDemoCatalog() {
  // ต้องล็อกอินอยู่เท่านั้นถึงจะเผยแพร่ได้ — เซสชันที่ไม่ได้ล็อกอิน (โหมด Offline / เครื่องที่ยังไม่ sync)
  // ไม่มีข้อมูลตัวจริงอยู่ในมือ localStorage อาจว่างเปล่าหรือเป็นข้อมูลทดสอบ ถ้าปล่อยให้เขียนได้จะไป
  // ทับแคตตาล็อกสาธารณะ (dealerUpdates/demoCatalogPublic ซึ่ง rules เปิด write: if true) ของจริงทิ้ง
  // ทั้งชุด — เกิดขึ้นจริงตอนทดสอบ 2026-09-03 ข้อมูลทดสอบ 6 เครื่องไปทับของจริงทั้งหมด กันแบบเดียวกับ
  // ที่ products.js กัน publish ทุกเส้นทางด้วย CURRENT_USER อยู่แล้ว
  if (typeof db === 'undefined') return;
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) return;
  try {
    var items = getDemoItems();
    var loans = getDemoLoans();
    var units = items.map(function(d) {
      var ranges = loans.filter(function(l) { return l.demoId === d.id && l.status === 'active' && l.lentDate; })
        .map(function(l) {
          var s = ftParseDate(l.lentDate), e = ftParseDate(l.returnDate) || s;
          return {
            start: s ? s.toISOString().slice(0, 10) : l.lentDate,
            end: e ? e.toISOString().slice(0, 10) : (l.returnDate || l.lentDate),
            borrower: l.borrower || '', purpose: l.purpose || '', approver: l.approver || ''
          };
        });
      return {
        id: d.id, name: d.name, model: d.model || '', flyable: d.flyable !== false, status: getDemoEffectiveStatus(d), busyRanges: ranges,
        category: d.category || '', sku: d.sku || '', serialNumber: d.serialNumber || '', rentalDbNo: d.rentalDbNo || '',
        nbtcRegistered: !!d.nbtcRegistered, droneInsurance: !!d.droneInsurance, caatRegistered: !!d.caatRegistered
      };
    });
    db.collection('dealerUpdates').doc('demoCatalogPublic').set({
      units: units,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(e) { console.warn('publishDemoCatalog error:', e); });
  } catch(e) { console.warn('publishDemoCatalog error:', e); }
}

var DEMO_STATUS_META = {
  available: { label: '✅ Available', cls: 'demo-available', desc: 'พร้อมให้จอง ณ ปัจจุบัน' },
  reserved: { label: '📅 Reserved', cls: 'demo-reserved', desc: 'มีการจองในอนาคต — ดูรายละเอียดที่ปฏิทิน' },
  lent: { label: '📤 On Borrowed', cls: 'demo-lent', desc: 'มีการยืมอยู่ในปัจจุบัน' },
  unavailable: { label: '⛔ Unavailable', cls: 'demo-unavailable', desc: 'ไม่ว่างให้จอง หรือไม่พร้อมใช้งาน' },
  lost: { label: '💔 Lost/Damaged', cls: 'demo-lost', desc: 'มีปัญหาอยู่ ไม่พร้อมให้จอง' }
};

// สีประจำรุ่น (ไม่ใช่ตามสถานะ) ใช้แยกเครื่องรุ่นเดียวกันด้วย S/N ต่างกันในการ์ด/ปฏิทิน
var DEMO_MODEL_PALETTE = ['#3b82f6', '#a855f7', '#06b6d4', '#f97316', '#ec4899', '#22c55e', '#eab308', '#ef4444'];
function demoModelColor(name) {
  var s = name || '';
  var hash = 0;
  for (var i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 997;
  return DEMO_MODEL_PALETTE[Math.abs(hash) % DEMO_MODEL_PALETTE.length];
}

// สถานะที่แสดงจริง: ถ้ากำลังยืมแต่วันยืมยังไม่มาถึง = Reserved, ถ้าวันยืมมาถึงแล้ว = On Borrowed
function getDemoEffectiveStatus(item) {
  if (item.status === 'lost' || item.status === 'unavailable') return item.status;
  if (item.status === 'lent') {
    var lentDate = ftParseDate(item.lentDate);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    if (lentDate && lentDate > today) return 'reserved';
    return 'lent';
  }
  return 'available';
}

// ================================================================
// DEMO LOAN HISTORY — เก็บทุกครั้งที่ยืม/คืน ไม่ลบทิ้ง
// ================================================================
function getDemoLoans() {
  var saved = localStorage.getItem('v7_demoLoans');
  if (saved) {
    try { var p = JSON.parse(saved); return Array.isArray(p) ? p : []; }
    catch (e) { return []; }
  }
  return [];
}
function saveDemoLoans(list) {
  if (!list || !Array.isArray(list)) list = [];
  localStorage.setItem('v7_demoLoans', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('demoLoans', list);
}
function demoLoansByDemo(demoId) {
  return getDemoLoans().filter(function(l) { return l.demoId === demoId; })
    .sort(function(a, b) { return (b.lentDate || '').localeCompare(a.lentDate || ''); });
}

var demoTrackerTab = 'list'; // 'list' | 'jobs' | 'calendar' | 'requests'
var _demoActiveJobCount = 0; // จำนวนใบงานที่ยังยืมอยู่ — โชว์เป็นตัวเลขบนแท็บ 📄 ใบงาน
var demoStatusFilter = 'all'; // 'all' | available | reserved | lent | unavailable | lost
var demoTypeFilter = 'all'; // 'all' | 'fly' | 'display'
var demoModelFilter = 'all';
var demoCategoryFilter = 'all'; // 'all' | category id | '_none'
var demoReadyFilter = 'ready'; // 'ready' (มีหมายเลขเครื่องเช่า = ยืมได้จริง) | 'pending' | 'all'
var demoSort = 'name_asc'; // 'name_asc' | 'status' | 'lent_longest' | 'newest'
var demoOverdueFlt = false; // true = กรองเฉพาะเครื่องที่ยืมเกิน 30 วันยังไม่คืน
var demoDueSoonFlt = false; // true = กรองเฉพาะเครื่องที่ใกล้ครบกำหนดคืน (≤3 วัน)
var demoDupRentalFlt = false; // true = กรองเฉพาะเครื่องที่เลขเครื่องเช่าไปซ้ำกับเครื่องอื่น
var demoSearch = '';
var _demoSearchTimer = null;
function demoSearchInput(v) {
  demoSearch = v;
  clearTimeout(_demoSearchTimer);
  _demoSearchTimer = setTimeout(function() { render(); }, 350);
}

function demoHideHelp() { localStorage.setItem('v7_demoHelpHidden', '1'); render(); }
function demoShowHelp() { localStorage.removeItem('v7_demoHelpHidden'); render(); }

function demoSetStatusFilter(s) { demoStatusFilter = s; render(); }
function demoClearFilters() { demoStatusFilter = 'all'; demoTypeFilter = 'all'; demoModelFilter = 'all'; demoCategoryFilter = 'all'; demoReadyFilter = 'ready'; demoSearch = ''; render(); }

// ================================================================
// จัดการหมวดหมู่ Demo — แก้ config เดียวกับที่ demo-staff.html เขียนผ่าน merge เข้า demoCatalogPublic
// (คนละที่เก็บ — อันนี้คือ config หลักของแอพ getConfig().demoCategories ที่ demoComplianceFieldsHtml ใช้
// เป็น dropdown หมวดหมู่ตอนเพิ่ม/แก้ไขเครื่อง ส่วน demoCatalogPublic.categories คือสำเนาที่เผยแพร่ให้หน้า
// public อ่านผ่าน publishDemoCatalog() อยู่แล้ว)
// ================================================================
function showDemoCatMgrM() {
  var cats = getConfig().demoCategories || [];
  var h = '<div style="max-width:420px">';
  h += '<div class="hint" style="margin-bottom:10px">ใช้จัดกลุ่มอุปกรณ์ในหน้ารายการให้หาง่ายขึ้น และเป็นตัวเลือกหมวดหมู่ตอนเพิ่ม/แก้ไขเครื่อง — ลบหมวดหมู่ไม่ลบเครื่องที่เคยตั้งไว้ แค่กลายเป็น "ไม่ระบุหมวดหมู่"</div>';
  h += '<div id="demoCatMgrRows">' + demoCatMgrRowsHtml(cats) + '</div>';
  h += '<button class="btn bsm bo" onclick="demoCatMgrAddRow()" style="margin-top:6px">➕ เพิ่มหมวดหมู่</button>';
  h += '<div class="fm-actions" style="margin-top:14px"><button class="btn bp" onclick="demoCatMgrSave()">💾 บันทึก</button><button class="btn" onclick="closeM()">ยกเลิก</button></div>';
  h += '</div>';
  openM('⚙️ จัดการหมวดหมู่ Demo', h);
}
function demoCatMgrRowHtml(c) {
  return '<div class="fr" style="gap:6px;margin-bottom:6px;align-items:center" data-id="' + sanitize(c.id || '') + '">' +
    '<input type="text" class="fm-input" style="width:48px;text-align:center;flex:none" value="' + sanitize(c.icon || '') + '" data-f="icon" placeholder="🚁">' +
    '<input type="text" class="fm-input" style="flex:1" value="' + sanitize(c.label || '') + '" data-f="label" placeholder="ชื่อหมวดหมู่">' +
    '<button class="btn bsm bd" onclick="this.parentElement.remove()">🗑️</button>' +
    '</div>';
}
function demoCatMgrRowsHtml(cats) { return cats.map(demoCatMgrRowHtml).join(''); }
function demoCatMgrAddRow() {
  var wrap = document.getElementById('demoCatMgrRows');
  wrap.insertAdjacentHTML('beforeend', demoCatMgrRowHtml({ id: '', icon: '', label: '' }));
}
function demoCatMgrSave() {
  var rows = document.getElementById('demoCatMgrRows').children;
  var cats = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var label = row.querySelector('[data-f="label"]').value.trim();
    if (!label) continue;
    var icon = row.querySelector('[data-f="icon"]').value.trim() || '🚁';
    // เก็บ id เดิมไว้เสมอถ้ามี (แม้เปลี่ยนชื่อ) กันเครื่องที่ผูก category id นี้ไว้อยู่แล้วหลุดหมวดหมู่ทันที
    // ที่แก้ไขแค่ชื่อ — สร้าง id ใหม่เฉพาะแถวที่เพิ่งเพิ่ม (ไม่มี data-id)
    var id = row.getAttribute('data-id') || ('cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    cats.push({ id: id, label: label, icon: icon });
  }
  var cfg = getConfig();
  cfg.demoCategories = cats;
  saveConfig(cfg);
  toast('✅ บันทึกหมวดหมู่แล้ว');
  closeMForce();
  render();
}

// ================================================================
// กรอกหมายเลขเครื่องเช่าทีละหลายเครื่องในหน้าเดียว — ทางลัดแทนการกด ✏️ ทีละเครื่อง หรือ Export/Import
// ผ่าน Excel ซึ่งเกินจำเป็นเมื่อต้องกรอกแค่ฟิลด์เดียว เก็บค่าที่พิมพ์ไว้ใน _demoBulkDraft (ไม่ใช่อ่านจาก DOM
// ตอนกดบันทึกอย่างเดียว) เพื่อให้สลับ "เฉพาะที่ยังไม่กรอก / ทั้งหมด" ได้โดยไม่ทำของที่พิมพ์ค้างไว้หาย
// ================================================================
var _demoBulkDraft = {};
var _demoBulkShowAll = false;
function showDemoBulkRentalM() {
  _demoBulkDraft = {};
  _demoBulkShowAll = false;
  openM('📋 กรอกหมายเลขเครื่องเช่า (หลายเครื่องพร้อมกัน)', demoBulkRentalHtml());
  setMWide(860);
  setTimeout(function() {
    var first = document.querySelector('#demoBulkRows input');
    if (first) first.focus();
  }, 60);
}
function demoBulkRentalRows() {
  var items = getDemoItems();
  var rows = _demoBulkShowAll ? items : items.filter(function(d) { return !(d.rentalDbNo || '').trim(); });
  // เรียงตามรุ่นแล้วต่อด้วย S/N — เครื่องรุ่นเดียวกันอยู่ติดกัน กรอกเลขที่ไล่กันเป็นชุดได้ง่ายกว่า
  return rows.slice().sort(function(a, b) {
    var n = (a.name || '').localeCompare(b.name || '');
    return n !== 0 ? n : (a.serialNumber || '').localeCompare(b.serialNumber || '');
  });
}
function demoBulkRentalHtml() {
  var items = getDemoItems();
  var missing = items.filter(function(d) { return !(d.rentalDbNo || '').trim(); }).length;
  var rows = demoBulkRentalRows();
  var h = '';
  h += '<div class="hint" style="margin-bottom:10px">กรอกแล้วกด Enter เพื่อไปช่องถัดไป — เว้นว่างไว้ได้ ระบบบันทึกเฉพาะช่องที่กรอก และจะเตือนถ้าเลขซ้ำกัน</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center">';
  h += '<button class="demo-filter-chip ' + (!_demoBulkShowAll ? 'act' : '') + '" onclick="demoBulkSetScope(false)">📋 ยังไม่กรอก (' + missing + ')</button>';
  h += '<button class="demo-filter-chip ' + (_demoBulkShowAll ? 'act' : '') + '" onclick="demoBulkSetScope(true)">ทั้งหมด (' + items.length + ')</button>';
  h += '<span style="margin-left:auto;font-size:12px;color:var(--text2)">กรอกไว้แล้ว <b id="demoBulkFilled">0</b> ช่อง</span>';
  h += '</div>';
  if (!rows.length) {
    h += '<div class="card" style="text-align:center;padding:26px"><div style="font-size:38px;margin-bottom:8px">✅</div><p>ทุกเครื่องมีหมายเลขเครื่องเช่าครบแล้ว</p></div>';
    h += '<div class="fm-actions"><button class="btn" onclick="closeMForce()">ปิด</button></div>';
    return h;
  }
  h += '<div style="max-height:52vh;overflow:auto;border:1px solid var(--border);border-radius:8px">';
  h += '<table style="border-collapse:collapse;width:100%;font-size:12px">';
  h += '<thead><tr>';
  ['อุปกรณ์', 'S/N', 'SKU', 'หมายเลขเครื่องเช่า'].forEach(function(hd, i) {
    h += '<th style="padding:7px 9px;text-align:left;border-bottom:2px solid var(--border);background:var(--card);position:sticky;top:0;z-index:1' + (i === 3 ? ';width:190px' : '') + '">' + hd + '</th>';
  });
  h += '</tr></thead><tbody id="demoBulkRows">';
  rows.forEach(function(d, i) {
    var cur = _demoBulkDraft[d.id] !== undefined ? _demoBulkDraft[d.id] : (d.rentalDbNo || '');
    h += '<tr>';
    h += '<td style="padding:5px 9px;border-bottom:1px solid var(--border)">' + sanitize(d.name || '-') + '</td>';
    h += '<td style="padding:5px 9px;border-bottom:1px solid var(--border);font-family:monospace;color:var(--text2)">' + sanitize(d.serialNumber || '-') + '</td>';
    h += '<td style="padding:5px 9px;border-bottom:1px solid var(--border);color:var(--text2)">' + sanitize(d.sku || '-') + '</td>';
    h += '<td style="padding:5px 9px;border-bottom:1px solid var(--border)"><input type="text" class="fm-input" style="padding:5px 8px;font-size:12px" data-id="' + d.id + '" data-idx="' + i + '" value="' + sanitize(cur) + '" oninput="demoBulkOnInput(this)" onkeydown="demoBulkOnKey(event,this)" autocomplete="off"></td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<div id="demoBulkWarn"></div>';
  h += '<div class="fm-actions" style="margin-top:12px">';
  h += '<button class="btn bp" onclick="saveDemoBulkRental()">💾 บันทึกทั้งหมด</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div>';
  return h;
}
function demoBulkSetScope(showAll) {
  _demoBulkShowAll = showAll;
  document.getElementById('mBd').innerHTML = demoBulkRentalHtml();
  demoBulkRefreshCount();
}
function demoBulkOnInput(inp) {
  _demoBulkDraft[inp.getAttribute('data-id')] = inp.value;
  demoBulkRefreshCount();
}
function demoBulkOnKey(e, inp) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  var idx = Number(inp.getAttribute('data-idx'));
  var next = document.querySelector('#demoBulkRows input[data-idx="' + (idx + 1) + '"]');
  if (next) { next.focus(); next.select(); }
}
function demoBulkRefreshCount() {
  var el = document.getElementById('demoBulkFilled');
  if (!el) return;
  var n = 0;
  document.querySelectorAll('#demoBulkRows input').forEach(function(i) { if (i.value.trim()) n++; });
  el.textContent = n;
}
function saveDemoBulkRental() {
  var items = getDemoItems();
  var byId = {}; items.forEach(function(d) { byId[d.id] = d; });

  // รวมค่าที่จะบันทึก: ค่าที่พิมพ์ไว้ (draft) ทับค่าเดิม แล้วเช็คเลขซ้ำจาก "ภาพรวมหลังบันทึก" ทั้งชุด
  // ไม่ใช่เช็คเฉพาะช่องที่เพิ่งกรอก — เลขที่กรอกใหม่อาจไปชนกับเครื่องที่มีเลขนั้นอยู่แล้วและไม่ได้แสดงในหน้านี้
  var finalVals = {}, changed = 0;
  items.forEach(function(d) { finalVals[d.id] = (d.rentalDbNo || '').trim(); });
  Object.keys(_demoBulkDraft).forEach(function(id) {
    if (!byId[id]) return;
    var v = (_demoBulkDraft[id] || '').trim();
    if (v !== finalVals[id]) { finalVals[id] = v; changed++; }
  });
  if (!changed) { toast('ยังไม่มีอะไรเปลี่ยน'); return; }

  var seen = {}, dupes = [];
  Object.keys(finalVals).forEach(function(id) {
    var v = finalVals[id];
    if (!v) return;
    if (seen[v]) dupes.push({ num: v, a: seen[v], b: id }); else seen[v] = id;
  });
  var warnEl = document.getElementById('demoBulkWarn');
  if (dupes.length) {
    var msg = dupes.slice(0, 5).map(function(x) {
      return 'เลข ' + sanitize(x.num) + ' ซ้ำกันระหว่าง "' + sanitize((byId[x.a] || {}).name || '') + '" กับ "' + sanitize((byId[x.b] || {}).name || '') + '"';
    }).join('<br>');
    if (warnEl) warnEl.innerHTML = '<div class="range-warn" style="margin-top:10px;background:#ef444418;color:#ef4444;border-radius:8px;padding:8px 10px;font-size:12px">⚠️ หมายเลขเครื่องเช่าซ้ำ ' + dupes.length + ' คู่ — แก้ก่อนบันทึก<br>' + msg + (dupes.length > 5 ? '<br>…และอีก ' + (dupes.length - 5) + ' คู่' : '') + '</div>';
    return;
  }
  if (warnEl) warnEl.innerHTML = '';

  if (!confirm('บันทึกหมายเลขเครื่องเช่า ' + changed + ' เครื่อง?')) return;
  items.forEach(function(d) { d.rentalDbNo = finalVals[d.id]; });
  saveDemoItems(items);
  _demoBulkDraft = {};
  toast('✅ บันทึกแล้ว ' + changed + ' เครื่อง');
  closeMForce();
  render();
}

// ================================================================
// กรอก Model ทีละรุ่น — ต่างจากเลขเครื่องเช่า (ที่ทุกเครื่องมีเลขไม่ซ้ำกัน ต้องกรอกทีละช่อง) ตรงที่ Model
// ใช้ร่วมกันทั้งรุ่น เครื่องชื่อเดียวกันเป็นสิบๆ ตัวควรได้ Model เดียวกันหมด จึงจัดกลุ่มตามชื่อเครื่องแล้ว
// ให้กรอกกลุ่มละช่องเดียว (130 เครื่องอาจเหลือแค่ 5-6 ช่อง) — Model คือชื่อที่ใช้เป็นหัวข้อกลุ่มในหน้า
// ขอยืมของลูกค้า (demo-request.html) ถ้าว่างจะ fallback ไปใช้ชื่อเครื่องเต็มแทน
// ================================================================
var _demoModelDraft = {};
function showDemoBulkModelM() {
  _demoModelDraft = {};
  openM('📦 กรอก Model (กรอกทีละรุ่น ใช้กับทุกเครื่องในรุ่นนั้น)', demoBulkModelHtml());
  setMWide(780);
}
function demoBulkModelGroups() {
  var items = getDemoItems();
  var by = {}, order = [];
  items.forEach(function(d) {
    var key = (d.name || '').trim() || '(ไม่มีชื่อ)';
    if (!by[key]) { by[key] = []; order.push(key); }
    by[key].push(d);
  });
  order.sort();
  return order.map(function(k) {
    var units = by[k];
    var models = {};
    units.forEach(function(u) { models[(u.model || '').trim()] = 1; });
    var keys = Object.keys(models);
    return { name: k, units: units, current: keys.length === 1 ? keys[0] : '', mixed: keys.length > 1 };
  });
}
// ตัดส่วนที่เป็นหมายเหตุภายในออกให้เหลือชื่อรุ่นสั้นๆ เช่น "DJI Matrice 400 (Demo Unit)" -> "DJI Matrice 400"
// เก็บชื่อแบรนด์ไว้ (ไม่ตัด DJI) เพราะเป็นข้อมูลจริงไม่ใช่ noise — เป็นแค่ค่าแนะนำ ผู้ใช้แก้เองได้ทุกช่อง
function _demoSuggestModel(name) {
  return String(name || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}
function demoBulkModelHtml() {
  var groups = demoBulkModelGroups();
  var missing = groups.filter(function(g) { return !g.current && !g.mixed; }).length;
  var h = '';
  h += '<div class="hint" style="margin-bottom:10px">Model คือชื่อที่ใช้เป็น "หัวข้อรุ่น" ในหน้าขอยืมของลูกค้า — กรอกช่องเดียวใช้กับทุกเครื่องในรุ่นนั้น เว้นว่างไว้ได้ (ลูกค้าจะเห็นชื่อเครื่องเต็มแทน)</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center">';
  h += '<button class="btn bsm bo" onclick="demoBulkModelAutoFill()">⚡ เติมอัตโนมัติจากชื่อเครื่อง</button>';
  h += '<span style="margin-left:auto;font-size:12px;color:var(--text2)">' + groups.length + ' รุ่น' + (missing ? ' · ยังไม่มี Model ' + missing + ' รุ่น' : '') + '</span>';
  h += '</div>';
  h += '<div style="max-height:52vh;overflow:auto;border:1px solid var(--border);border-radius:8px">';
  h += '<table style="border-collapse:collapse;width:100%;font-size:12px">';
  h += '<thead><tr>';
  h += '<th style="padding:7px 9px;text-align:left;border-bottom:2px solid var(--border);background:var(--card);position:sticky;top:0;z-index:1">ชื่อเครื่อง (ตามที่บันทึกไว้)</th>';
  h += '<th style="padding:7px 9px;text-align:right;border-bottom:2px solid var(--border);background:var(--card);position:sticky;top:0;z-index:1;width:70px">จำนวน</th>';
  h += '<th style="padding:7px 9px;text-align:left;border-bottom:2px solid var(--border);background:var(--card);position:sticky;top:0;z-index:1;width:250px">Model (ชื่อรุ่นที่ลูกค้าเห็น)</th>';
  h += '</tr></thead><tbody id="demoModelRows">';
  groups.forEach(function(g, i) {
    var cur = _demoModelDraft[g.name] !== undefined ? _demoModelDraft[g.name] : g.current;
    h += '<tr>';
    h += '<td style="padding:5px 9px;border-bottom:1px solid var(--border)">' + sanitize(g.name) + '</td>';
    h += '<td style="padding:5px 9px;border-bottom:1px solid var(--border);text-align:right;color:var(--text2)">' + g.units.length + '</td>';
    h += '<td style="padding:5px 9px;border-bottom:1px solid var(--border)"><input type="text" class="fm-input" style="padding:5px 8px;font-size:12px" data-name="' + sanitize(g.name) + '" data-idx="' + i + '" value="' + sanitize(cur) + '" placeholder="' + (g.mixed ? 'ตอนนี้ตั้งไว้ไม่เหมือนกัน — กรอกเพื่อตั้งใหม่ทั้งรุ่น' : sanitize(_demoSuggestModel(g.name))) + '" oninput="demoBulkModelOnInput(this)" onkeydown="demoBulkModelOnKey(event,this)" autocomplete="off"></td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<div class="fm-actions" style="margin-top:12px">';
  h += '<button class="btn bp" onclick="saveDemoBulkModel()">💾 บันทึกทั้งหมด</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div>';
  return h;
}
function demoBulkModelOnInput(inp) { _demoModelDraft[inp.getAttribute('data-name')] = inp.value; }
function demoBulkModelOnKey(e, inp) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  var idx = Number(inp.getAttribute('data-idx'));
  var next = document.querySelector('#demoModelRows input[data-idx="' + (idx + 1) + '"]');
  if (next) { next.focus(); next.select(); }
}
function demoBulkModelAutoFill() {
  // เติมเฉพาะช่องที่ยังว่าง ไม่ไปทับค่าที่ตั้งไว้แล้วหรือที่เพิ่งพิมพ์เอง
  document.querySelectorAll('#demoModelRows input').forEach(function(inp) {
    if (inp.value.trim()) return;
    inp.value = _demoSuggestModel(inp.getAttribute('data-name'));
    _demoModelDraft[inp.getAttribute('data-name')] = inp.value;
  });
  toast('⚡ เติมให้แล้ว — ตรวจ/แก้ได้ก่อนบันทึก');
}
function saveDemoBulkModel() {
  var items = getDemoItems();
  var changedGroups = 0, changedUnits = 0;
  Object.keys(_demoModelDraft).forEach(function(name) {
    var v = (_demoModelDraft[name] || '').trim();
    var touched = false;
    items.forEach(function(d) {
      var key = (d.name || '').trim() || '(ไม่มีชื่อ)';
      if (key !== name) return;
      if ((d.model || '').trim() === v) return;
      d.model = v;
      changedUnits++;
      touched = true;
    });
    if (touched) changedGroups++;
  });
  if (!changedUnits) { toast('ยังไม่มีอะไรเปลี่ยน'); return; }
  if (!confirm('ตั้ง Model ให้ ' + changedGroups + ' รุ่น (รวม ' + changedUnits + ' เครื่อง) ยืนยัน?')) return;
  saveDemoItems(items);
  _demoModelDraft = {};
  toast('✅ บันทึกแล้ว ' + changedUnits + ' เครื่อง');
  closeMForce();
  render();
}

// ================================================================
// Import/Export ข้อมูล Demo Equipment — ไฟล์ .xlsx ผ่าน SheetJS (ตัวเดียวกับที่ products.js ใช้ import
// pipeline/products อยู่แล้ว) จับคู่แถวกลับเข้าเครื่องเดิมด้วยคอลัมน์ ID ถ้ามี ไม่มี/ไม่ตรง = สร้างเครื่องใหม่
// ================================================================
function exportDemoItemsExcel() {
  var items = getDemoItems();
  var data = items.map(function(d) {
    return {
      'ID': d.id, 'ชื่ออุปกรณ์': d.name || '', 'Model': d.model || '', 'SKU': d.sku || '',
      'Serial Number': d.serialNumber || '', 'หมายเลขเครื่องเช่า': d.rentalDbNo || '',
      'หมวดหมู่': d.category || '', 'บินได้ (Y/N)': d.flyable !== false ? 'Y' : 'N',
      'สถานะ': d.status || 'available', 'กสทช (Y/N)': d.nbtcRegistered ? 'Y' : 'N',
      'ประกันภัย (Y/N)': d.droneInsurance ? 'Y' : 'N', 'CAAT (Y/N)': d.caatRegistered ? 'Y' : 'N',
      'เลขใบงาน': d.jobNo || '', 'เลขอ้างอิง': d.refNo || '',
      'ผู้ยืม': d.borrower || '', 'วันที่ยืม': d.lentDate || '', 'กำหนดคืน': d.returnDate || '',
      'หมายเหตุ': d.note || ''
    };
  });
  var ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{wch:14},{wch:25},{wch:15},{wch:15},{wch:18},{wch:15},{wch:12},{wch:10},{wch:12},{wch:10},{wch:10},{wch:10},{wch:16},{wch:14},{wch:18},{wch:12},{wch:12},{wch:25}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'demo');
  XLSX.writeFile(wb, 'demo-equipment-' + _td() + '.xlsx');
  toast('📤 Export สำเร็จ');
}
function importDemoItemsExcel() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: 'binary' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        var items = getDemoItems();
        var byId = {}; items.forEach(function(d) { byId[d.id] = d; });
        var updated = 0, created = 0;
        rows.forEach(function(r) {
          var id = String(r['ID'] || '').trim();
          var name = String(r['ชื่ออุปกรณ์'] || '').trim();
          var existing = id && byId[id] ? byId[id] : null;
          if (!name && !existing) return;
          var rec = existing || { id: 'dm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
          rec.name = name || rec.name;
          rec.model = String(r['Model'] || rec.model || '').trim();
          rec.sku = String(r['SKU'] || rec.sku || '').trim();
          rec.serialNumber = String(r['Serial Number'] || rec.serialNumber || '').trim();
          rec.rentalDbNo = String(r['หมายเลขเครื่องเช่า'] || rec.rentalDbNo || '').trim();
          rec.category = String(r['หมวดหมู่'] || rec.category || '').trim();
          rec.flyable = String(r['บินได้ (Y/N)'] || (rec.flyable !== false ? 'Y' : 'N')).trim().toUpperCase() !== 'N';
          rec.status = String(r['สถานะ'] || rec.status || 'available').trim();
          rec.nbtcRegistered = String(r['กสทช (Y/N)'] || '').trim().toUpperCase() === 'Y';
          rec.droneInsurance = String(r['ประกันภัย (Y/N)'] || '').trim().toUpperCase() === 'Y';
          rec.caatRegistered = String(r['CAAT (Y/N)'] || '').trim().toUpperCase() === 'Y';
          rec.jobNo = String(r['เลขใบงาน'] || rec.jobNo || '').trim();
          rec.refNo = String(r['เลขอ้างอิง'] || rec.refNo || '').trim();
          rec.borrower = String(r['ผู้ยืม'] || rec.borrower || '').trim();
          rec.lentDate = String(r['วันที่ยืม'] || rec.lentDate || '').trim();
          rec.returnDate = String(r['กำหนดคืน'] || rec.returnDate || '').trim();
          rec.note = String(r['หมายเหตุ'] || rec.note || '').trim();
          if (existing) { updated++; } else { items.push(rec); created++; byId[rec.id] = rec; }
        });
        if (!updated && !created) { alert('ไม่พบแถวที่นำเข้าได้ — ตรวจว่าคอลัมน์ตรงกับไฟล์ที่ Export ออกมาหรือไม่'); return; }
        if (!confirm('พบ ' + rows.length + ' แถว — จะอัปเดตเครื่องเดิม ' + updated + ' รายการ และเพิ่มใหม่ ' + created + ' รายการ ยืนยันนำเข้า?')) return;
        saveDemoItems(items);
        toast('✅ นำเข้าสำเร็จ (' + updated + ' อัปเดต, ' + created + ' ใหม่)');
        render();
      } catch (err) {
        alert('นำเข้าไม่สำเร็จ: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };
  input.click();
}

function demoComplianceBadges(d) {
  var h = '<div class="demo-compliance">';
  h += '<span>' + (d.nbtcRegistered ? '✅' : '❌') + ' กสทช</span>';
  h += '<span>' + (d.droneInsurance ? '✅' : '❌') + ' ประกันภัย</span>';
  h += '<span>' + (d.caatRegistered ? '✅' : '❌') + ' CAAT</span>';
  h += '</div>';
  return h;
}

function rDemoTracker(el) {
  document.getElementById('pgT').textContent = '🚁 Demo Equipment';
  var allItems = getDemoItems();
  if (!allItems || !Array.isArray(allItems)) allItems = [];

  // เครื่องที่ยังไม่มี "หมายเลขเครื่องเช่า" (rentalDbNo) = ยังไม่ได้ทำเรื่องเข้าเครื่องเช่า ยืมจริงไม่ได้
  // แยกออกจากรายการหลักโดยปริยาย ไม่ให้เกะกะตอนดูว่าเครื่องไหนจองได้ (หน้าลูกค้าก็ซ่อนเช่นกัน — ดู
  // loadCatalog() ใน demo-request.html) แต่ยังกดชิปเข้าไปดู/แก้ไขได้ ไม่ใช่ซ่อนหายไปเฉยๆ
  var readyItems = allItems.filter(function(d) { return !!(d.rentalDbNo || '').trim(); });
  var pendingRentalItems = allItems.filter(function(d) { return !(d.rentalDbNo || '').trim(); });
  var items = demoReadyFilter === 'pending' ? pendingRentalItems
            : demoReadyFilter === 'all' ? allItems
            : readyItems;

  var now = new Date();
  var counts = { available: 0, reserved: 0, lent: 0, unavailable: 0, lost: 0 };
  items.forEach(function(d) { counts[getDemoEffectiveStatus(d)]++; });
  _demoActiveJobCount = demoActiveJobGroups().length;

  // นับเครื่องที่ยืมเกิน 30 วันยังไม่คืน — ใช้ตรรกะเดียวกับ isOverdue ต่อการ์ดด้านล่าง
  // + นับเครื่องใกล้ครบกำหนดคืน (returnDate ภายใน 3 วันข้างหน้า รวมที่เลยกำหนดแล้วด้วย) ให้เตือนก่อนจะเกิน 30 วัน
  var overdueCount = 0, dueSoonCount = 0;
  items.forEach(function(d) {
    var eff = getDemoEffectiveStatus(d);
    if (eff !== 'lent') return;
    var lentDate = ftParseDate(d.lentDate);
    var daysBorrowed = lentDate ? Math.floor((now - lentDate) / 86400000) : 0;
    if (daysBorrowed > 30) overdueCount++;
    var retDate = ftParseDate(d.returnDate);
    if (retDate) {
      var daysToReturn = Math.ceil((retDate - now) / 86400000);
      if (daysToReturn <= 3) dueSoonCount++;
    }
  });

  var h = '';

  // คำอธิบายสำหรับคนเปิดใช้ครั้งแรก — เมนูนี้มีหลายแท็บและหลายสถานะ ถ้าไม่บอกลำดับงานจะเดาไม่ออกว่าต้องเริ่มตรงไหน
  // ซ่อนถาวรได้ (เก็บใน localStorage) และกดเปิดดูใหม่ได้จากปุ่ม ❓ วิธีใช้ ที่แถบเครื่องมือ
  if (localStorage.getItem('v7_demoHelpHidden') !== '1') {
    h += '<div class="card" style="margin-bottom:10px;border-left:4px solid var(--accent)">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">';
    h += '<div style="font-weight:700;font-size:14px">👋 เมนูนี้ใช้ทำอะไร</div>';
    h += '<button class="btn-xs" onclick="demoHideHelp()">✕ ไม่ต้องแสดงอีก</button>';
    h += '</div>';
    h += '<div style="font-size:12.5px;color:var(--text2);line-height:1.8;margin-top:8px">';
    h += 'ใช้ติดตามเครื่อง Demo ว่าตอนนี้เครื่องไหนอยู่ที่ไหน ใครยืมไป ต้องคืนวันไหน<br>';
    h += '<b>ลำดับการใช้งาน:</b> ① <b>➕ เพิ่มอุปกรณ์</b> เข้าระบบ → ② กรอก <b>หมายเลขเครื่องเช่า</b> (เลขที่คีย์เบิกจากคลัง — ไม่มีเลขนี้จะยังให้ยืมไม่ได้) → ③ กด <b>📤 ให้ยืม/จอง</b> พร้อมใส่ <b>เลขใบงาน</b> ถ้ายืมหลายเครื่องพร้อมกัน → ④ พอลูกค้าคืน กด <b>✅ คืนแล้ว</b> หรือคืนทั้งใบงานทีเดียวที่แท็บ 📄 ใบงาน';
    h += '</div>';
    h += '<div style="font-size:12.5px;color:var(--text2);line-height:1.8;margin-top:8px">';
    h += '<b>แท็บต่างๆ:</b> <b>📋 รายการ</b> = เครื่องทั้งหมดแยกตามหมวดหมู่ · <b>📄 ใบงาน</b> = รวมเครื่องที่เบิกใบเดียวกัน กดคืนทีเดียวได้ · <b>🗓️ ปฏิทิน</b> = ดูว่าช่วงไหนเครื่องไหนไม่ว่าง · <b>🟡 คำขอยืม</b> = คำขอที่ลูกค้าส่งมาจากลิงก์สาธารณะ รออนุมัติ';
    h += '</div>';
    h += '<div style="font-size:12px;color:var(--text3);margin-top:8px">💡 ค่าที่มีปุ่ม 📋 (เลขเครื่องเช่า, S/N, เลขใบงาน ฯลฯ) กดคัดลอกไปวางที่อื่นได้ทันที · กดชื่อเครื่องเพื่อดูรายละเอียดทั้งหมด</div>';
    h += '</div>';
  }

  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
  h += '<button class="btn bp" onclick="showAddDemoM()">➕ เพิ่มอุปกรณ์</button>';
  h += '<button class="btn bo" onclick="showDemoLinksM()">🔗 ลิงก์ขอยืม/จัดการ Demo</button>';
  h += '<button class="btn bo" onclick="showDemoCatMgrM()">⚙️ จัดการหมวดหมู่</button>';
  if (pendingRentalItems.length) h += '<button class="btn bo" onclick="showDemoBulkRentalM()">📋 กรอกเลขเครื่องเช่า (' + pendingRentalItems.length + ')</button>';
  var _missingModel = allItems.filter(function(d) { return !(d.model || '').trim(); }).length;
  if (_missingModel) h += '<button class="btn bo" onclick="showDemoBulkModelM()">📦 กรอก Model (' + _missingModel + ')</button>';
  h += '<button class="btn bo" onclick="exportDemoItemsExcel()">📤 Export</button>';
  h += '<button class="btn bo" onclick="importDemoItemsExcel()">📥 Import</button>';
  if (localStorage.getItem('v7_demoHelpHidden') === '1') h += '<button class="btn bo" onclick="demoShowHelp()">❓ วิธีใช้</button>';
  h += '</div>';

  // เลขเครื่องเช่าซ้ำ — เลขนี้ควรชี้เครื่องเดียวเท่านั้น ถ้าซ้ำแปลว่าคีย์ผิดหรือหลายเครื่องถูกลงทะเบียนรวมเป็น
  // รายการเดียว ซึ่งทำให้แยกไม่ออกว่ายืมตัวไหนไปตอนทวงคืน (ผู้ใช้เจอ 2026-09-04: 5 เครื่องใช้เลข 17128 ร่วมกัน)
  var _rentalSeen = {}, _dupRentals = {};
  allItems.forEach(function(d) {
    var v = (d.rentalDbNo || '').trim();
    if (!v) return;
    if (_rentalSeen[v]) _dupRentals[v] = 1; else _rentalSeen[v] = 1;
  });
  var _dupNums = Object.keys(_dupRentals);
  if (_dupNums.length) {
    var _dupUnitCount = allItems.filter(function(d) { return _dupRentals[(d.rentalDbNo || '').trim()]; }).length;
    h += '<div class="demo-duesoon-box" onclick="demoDupRentalFlt=!demoDupRentalFlt;demoReadyFilter=\'all\';render()" style="margin-bottom:10px;background:' + (demoDupRentalFlt ? '#ef444418' : 'var(--bg2)') + ';border:1px solid ' + (demoDupRentalFlt ? '#ef4444' : 'var(--border)') + ';max-width:100%">';
    h += '<div style="font-size:11px;color:#ef4444">⚠️ เลขเครื่องเช่าซ้ำ ' + _dupNums.length + ' เลข (' + _dupUnitCount + ' เครื่อง) — กดดู/แก้</div>';
    h += '<div style="font-size:11.5px;color:var(--text2);margin-top:2px">' + sanitize(_dupNums.slice(0, 6).join(', ')) + (_dupNums.length > 6 ? ' …' : '') + '</div>';
    h += '</div>';
  }

  if (overdueCount || dueSoonCount) {
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
    if (overdueCount) {
      h += '<div class="demo-duesoon-box" onclick="demoOverdueFlt=!demoOverdueFlt;demoDueSoonFlt=false;demoStatusFilter=demoOverdueFlt?\'lent\':demoStatusFilter;render()" style="background:' + (demoOverdueFlt ? '#ef444418' : 'var(--bg2)') + ';border:1px solid ' + (demoOverdueFlt ? '#ef4444' : 'var(--border)') + '">';
      h += '<div style="font-size:11px;color:#ef4444">⚠️ เครื่องเกินกำหนดคืน (&gt;30 วัน)</div>';
      h += '<div style="font-size:20px;font-weight:700;color:#ef4444">' + overdueCount + ' เครื่อง</div>';
      h += '</div>';
    }
    if (dueSoonCount) {
      h += '<div class="demo-duesoon-box" onclick="demoDueSoonFlt=!demoDueSoonFlt;demoOverdueFlt=false;demoStatusFilter=demoDueSoonFlt?\'lent\':demoStatusFilter;render()" style="background:' + (demoDueSoonFlt ? '#f59e0b18' : 'var(--bg2)') + ';border:1px solid ' + (demoDueSoonFlt ? '#f59e0b' : 'var(--border)') + '">';
      h += '<div style="font-size:11px;color:#f59e0b">📅 ใกล้ครบกำหนดคืน (≤3 วัน)</div>';
      h += '<div style="font-size:20px;font-weight:700;color:#f59e0b">' + dueSoonCount + ' เครื่อง</div>';
      h += '</div>';
    }
    h += '</div>';
  }

  // สโคป "พร้อมให้ยืม / ยังไม่ลงทะเบียนเช่า" — วางไว้บนสุดเหนือแท็บ เพราะมันคุมทุกตัวเลขที่อยู่ใต้ลงไป
  // (stat, ชิปสถานะ, ชิปหมวดหมู่ ฯลฯ นับจากสโคปนี้ทั้งหมด) จะได้ไม่งงว่าทำไมยอดรวมไม่ตรงกับที่เคยเห็น
  if (demoTrackerTab === 'list' && pendingRentalItems.length) {
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center">';
    h += '<span style="font-size:11px;color:var(--text2);margin-right:2px">แสดง:</span>';
    h += '<button class="demo-filter-chip ' + (demoReadyFilter === 'ready' ? 'act' : '') + '" onclick="demoReadyFilter=\'ready\';render()">✅ พร้อมให้ยืม (' + readyItems.length + ')</button>';
    h += '<button class="demo-filter-chip ' + (demoReadyFilter === 'pending' ? 'act' : '') + '" onclick="demoReadyFilter=\'pending\';render()">📋 ยังไม่ลงทะเบียนเครื่องเช่า (' + pendingRentalItems.length + ')</button>';
    h += '<button class="demo-filter-chip ' + (demoReadyFilter === 'all' ? 'act' : '') + '" onclick="demoReadyFilter=\'all\';render()">ทั้งหมด (' + allItems.length + ')</button>';
    h += '</div>';
    if (demoReadyFilter === 'pending') {
      h += '<div class="hint" style="margin-bottom:10px;color:#f59e0b">📋 เครื่องกลุ่มนี้ยังไม่มีหมายเลขเครื่องเช่า จึงยังให้ยืมจริงไม่ได้ และไม่แสดงในหน้าขอยืมของลูกค้า — กด <b onclick="showDemoBulkRentalM()" style="cursor:pointer;text-decoration:underline">📋 กรอกเลขเครื่องเช่า</b> เพื่อกรอกทีเดียวหลายเครื่อง แล้วย้ายเข้ากลุ่ม "พร้อมให้ยืม"</div>';
    }
  }

  h += '<div class="today-tabs" style="margin-bottom:10px">';
  h += '<div class="today-tab ' + (demoTrackerTab === 'list' ? 'act' : '') + '" onclick="demoTrackerTab=\'list\';render()">📋 รายการ</div>';
  h += '<div class="today-tab ' + (demoTrackerTab === 'jobs' ? 'act' : '') + '" onclick="demoTrackerTab=\'jobs\';render()">📄 ใบงาน' + (_demoActiveJobCount ? ' (' + _demoActiveJobCount + ')' : '') + '</div>';
  h += '<div class="today-tab ' + (demoTrackerTab === 'calendar' ? 'act' : '') + '" onclick="demoTrackerTab=\'calendar\';render()">🗓️ ปฏิทิน</div>';
  h += '<div class="today-tab ' + (demoTrackerTab === 'requests' ? 'act' : '') + '" onclick="demoTrackerTab=\'requests\';loadDemoRequests();render()">🟡 คำขอยืม' + (_demoReqPendingCount ? ' (' + _demoReqPendingCount + ')' : '') + '</div>';
  h += '</div>';

  if (demoTrackerTab === 'jobs') {
    el.innerHTML = h + renderDemoJobsTab();
    return;
  }
  if (demoTrackerTab === 'calendar') {
    el.innerHTML = h + renderDemoCalendar();
    return;
  }
  if (demoTrackerTab === 'requests') {
    el.innerHTML = h + renderDemoRequestsTab();
    return;
  }

  // Stats
  h += '<div class="sr">';
  h += '<div class="sc"><div class="sn c1">' + items.length + '</div><div class="sl">ทั้งหมด</div></div>';
  h += '<div class="sc"><div class="sn c2">' + counts.available + '</div><div class="sl">✅ Available</div></div>';
  h += '<div class="sc"><div class="sn c5">' + counts.reserved + '</div><div class="sl">📅 Reserved</div></div>';
  h += '<div class="sc"><div class="sn c4">' + counts.lent + '</div><div class="sl">📤 On Borrowed</div></div>';
  h += '<div class="sc"><div class="sn c3">' + counts.unavailable + '</div><div class="sl">⛔ Unavailable</div></div>';
  h += '<div class="sc"><div class="sn c6">' + counts.lost + '</div><div class="sl">💔 Lost/Damaged</div></div>';
  h += '</div>';

  // Status filter chips
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
  h += '<button class="demo-filter-chip ' + (demoStatusFilter === 'all' ? 'act' : '') + '" onclick="demoSetStatusFilter(\'all\')">ทั้งหมด (' + items.length + ')</button>';
  Object.keys(DEMO_STATUS_META).forEach(function(s) {
    h += '<button class="demo-filter-chip ' + (demoStatusFilter === s ? 'act' : '') + '" title="' + sanitize(DEMO_STATUS_META[s].desc) + '" onclick="demoSetStatusFilter(\'' + s + '\')">' + DEMO_STATUS_META[s].label + ' (' + counts[s] + ')</button>';
  });
  h += '</div>';

  // ประเภทการใช้งาน — บินสาธิตได้ vs จัดแสดงสินค้าเท่านั้น (ห้ามบิน)
  var flyCount = items.filter(function(d) { return d.flyable !== false; }).length;
  var displayCount = items.length - flyCount;
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
  h += '<button class="demo-filter-chip ' + (demoTypeFilter === 'all' ? 'act' : '') + '" onclick="demoTypeFilter=\'all\';render()">ทุกประเภท</button>';
  h += '<button class="demo-filter-chip ' + (demoTypeFilter === 'fly' ? 'act' : '') + '" onclick="demoTypeFilter=\'fly\';render()">✈️ บินสาธิตได้ (' + flyCount + ')</button>';
  h += '<button class="demo-filter-chip ' + (demoTypeFilter === 'display' ? 'act' : '') + '" onclick="demoTypeFilter=\'display\';render()">🖼️ จัดแสดงเท่านั้น (' + displayCount + ')</button>';
  h += '</div>';

  // หมวดหมู่ (config ผู้ใช้แก้เองได้ผ่าน ⚙️ จัดการหมวดหมู่) — แสดงชิปเฉพาะหมวดที่มีเครื่องอยู่จริง
  // บวกชิป "ไม่ระบุหมวดหมู่" ถ้ามีเครื่องที่ยังไม่ได้ตั้ง เพื่อให้เห็นว่าเหลือกี่ตัวที่ต้องไปจัดหมวด
  var demoCats = getConfig().demoCategories || [];
  var uncategorized = items.filter(function(d) { return !d.category; }).length;
  if (demoCats.length || uncategorized) {
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
    h += '<button class="demo-filter-chip ' + (demoCategoryFilter === 'all' ? 'act' : '') + '" onclick="demoCategoryFilter=\'all\';render()">📦 ทุกหมวดหมู่</button>';
    demoCats.forEach(function(c) {
      var cnt = items.filter(function(d) { return d.category === c.id; }).length;
      if (!cnt) return;
      h += '<button class="demo-filter-chip ' + (demoCategoryFilter === c.id ? 'act' : '') + '" onclick="demoCategoryFilter=\'' + c.id + '\';render()">' + (c.icon || '') + ' ' + sanitize(c.label) + ' (' + cnt + ')</button>';
    });
    if (uncategorized) h += '<button class="demo-filter-chip ' + (demoCategoryFilter === '_none' ? 'act' : '') + '" onclick="demoCategoryFilter=\'_none\';render()">➖ ไม่ระบุหมวดหมู่ (' + uncategorized + ')</button>';
    h += '</div>';
  }

  // ค้นหา + กรองตามรุ่น + เรียงลำดับ
  var uniqueModels = [];
  items.forEach(function(d) { if (d.name && uniqueModels.indexOf(d.name) === -1) uniqueModels.push(d.name); });
  uniqueModels.sort();
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  h += '<input type="text" id="demoSrc" class="fm-input" style="flex:1;min-width:200px" placeholder="🔍 ค้นหา (ชื่อ, SKU, S/N, เลขเครื่องเช่า, ผู้ยืม, หมายเหตุ)" value="' + sanitize(demoSearch) + '" oninput="demoSearchInput(this.value)" autocomplete="off">';
  h += '<select class="fm-input" style="min-width:180px" onchange="demoModelFilter=this.value;render()">';
  h += '<option value="all"' + (demoModelFilter === 'all' ? ' selected' : '') + '>📦 ทุกรุ่น (' + uniqueModels.length + ')</option>';
  uniqueModels.forEach(function(m) {
    var cnt = items.filter(function(d) { return d.name === m; }).length;
    h += '<option value="' + sanitize(m) + '"' + (demoModelFilter === m ? ' selected' : '') + '>' + sanitize(m) + ' (' + cnt + ')</option>';
  });
  h += '</select>';
  h += '<select class="fm-input" style="min-width:170px" onchange="demoSort=this.value;render()">';
  [['name_asc','🔤 เรียง: ชื่อ A-Z'],['status','🚦 เรียง: ตามสถานะ'],['lent_longest','⏱️ เรียง: ยืมนานสุดก่อน'],['return_soonest','📅 เรียง: ใกล้ครบกำหนดคืน']].forEach(function(o) {
    h += '<option value="' + o[0] + '"' + (demoSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  });
  h += '</select>';
  h += '<button class="btn bsm bo" onclick="demoClearFilters()">✖️ ล้าง</button>';
  h += '</div>';

  var shown = items.filter(function(d) {
    if (demoStatusFilter !== 'all' && getDemoEffectiveStatus(d) !== demoStatusFilter) return false;
    if (demoTypeFilter === 'fly' && d.flyable === false) return false;
    if (demoTypeFilter === 'display' && d.flyable !== false) return false;
    if (demoModelFilter !== 'all' && d.name !== demoModelFilter) return false;
    if (demoCategoryFilter === '_none' && d.category) return false;
    if (demoCategoryFilter !== 'all' && demoCategoryFilter !== '_none' && d.category !== demoCategoryFilter) return false;
    if (demoOverdueFlt) {
      if (getDemoEffectiveStatus(d) !== 'lent') return false;
      var lentDate2 = ftParseDate(d.lentDate);
      var daysBorrowed2 = lentDate2 ? Math.floor((now - lentDate2) / 86400000) : 0;
      if (daysBorrowed2 <= 30) return false;
    }
    if (demoDueSoonFlt) {
      if (getDemoEffectiveStatus(d) !== 'lent') return false;
      var retD = ftParseDate(d.returnDate);
      if (!retD || Math.ceil((retD - now) / 86400000) > 3) return false;
    }
    if (demoDupRentalFlt && !_dupRentals[(d.rentalDbNo || '').trim()]) return false;
    if (demoSearch) {
      var q = demoSearch.toLowerCase();
      var hay = ((d.name || '') + ' ' + (d.sku || '') + ' ' + (d.serialNumber || '') + ' ' + (d.rentalDbNo || '') + ' ' + (d.borrower || '') + ' ' + (d.purpose || '') + ' ' + (d.note || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  var _statusOrder = { lent: 0, reserved: 1, available: 2, unavailable: 3, lost: 4 };
  shown.sort(function(a, b) {
    if (demoSort === 'status') {
      var sa = _statusOrder[getDemoEffectiveStatus(a)], sb = _statusOrder[getDemoEffectiveStatus(b)];
      if (sa !== sb) return sa - sb;
      return (a.name || '').localeCompare(b.name || '');
    }
    if (demoSort === 'lent_longest') {
      // เครื่องที่ไม่ได้ถูกยืมไม่มีวันยืม ดันไปท้ายสุดเสมอ ไม่ให้ปนอยู่กลางกลุ่มที่ยืมนาน
      var la = ftParseDate(a.lentDate), lb = ftParseDate(b.lentDate);
      if (!la && !lb) return (a.name || '').localeCompare(b.name || '');
      if (!la) return 1;
      if (!lb) return -1;
      return la - lb;
    }
    if (demoSort === 'return_soonest') {
      var ra = ftParseDate(a.returnDate), rb = ftParseDate(b.returnDate);
      if (!ra && !rb) return (a.name || '').localeCompare(b.name || '');
      if (!ra) return 1;
      if (!rb) return -1;
      return ra - rb;
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  if (!shown.length) {
    h += '<div class="card" style="text-align:center;padding:30px"><div style="font-size:48px;margin-bottom:10px">🚁</div>';
    if (!allItems.length) {
      h += '<p style="font-weight:600">ยังไม่มีอุปกรณ์ Demo ในระบบ</p>';
      h += '<p style="color:var(--text2);font-size:13px;max-width:420px;margin:6px auto 14px">เริ่มจากเพิ่มเครื่องเข้าระบบก่อน แล้วค่อยกรอกหมายเลขเครื่องเช่าเพื่อให้พร้อมปล่อยยืม</p>';
      h += '<button class="btn bp" onclick="showAddDemoM()">➕ เพิ่มอุปกรณ์เครื่องแรก</button>';
    } else {
      h += '<p style="font-weight:600">ไม่พบอุปกรณ์ที่ตรงกับตัวกรองนี้</p>';
      h += '<p style="color:var(--text2);font-size:13px">ลองเปลี่ยนตัวกรองด้านบน หรือล้างตัวกรองทั้งหมด</p>';
      h += '<button class="btn bo" onclick="demoClearFilters()">✖️ ล้างตัวกรอง</button>';
    }
    h += '</div>';
  }

  // จัดกลุ่มตามหมวดหมู่เป็นกลุ่มพับได้ — ช่วยเวลามีเครื่องเป็นร้อยตัว ไม่ต้องเลื่อนยาวเป็นพืด
  // (ถ้ากรองเหลือหมวดเดียวอยู่แล้ว หรือยังไม่ได้ตั้งหมวดหมู่เลย ก็แสดงเป็น grid เดียวตามเดิม ไม่ต้องมีหัวข้อกลุ่ม)
  // ปิดการจัดกลุ่มเมื่อผู้ใช้เลือก sort อื่นที่ไม่ใช่ค่าเริ่มต้น — ถ้ายังจัดกลุ่มอยู่ ลำดับหมวดหมู่จะครอบลำดับ
  // ที่ sort ไว้ ทำให้กด "เรียงตามยืมนานสุด" แล้วหน้าจอไม่เปลี่ยนอะไรเลย (เรียงข้างในกลุ่มซึ่งมักมีตัวเดียว)
  var groupByCat = demoSort === 'name_asc' && demoCategoryFilter === 'all' && demoCats.length && items.some(function(d) { return d.category; });
  if (!groupByCat) {
    h += '<div class="demo-grid">' + shown.map(function(d) { return demoCardHtml(d, now, _dupRentals); }).join('') + '</div>';
  } else {
    var catBuckets = demoCats.map(function(c) {
      return { cat: c, list: shown.filter(function(d) { return d.category === c.id; }) };
    });
    var noneList = shown.filter(function(d) { return !d.category || !demoCats.some(function(c) { return c.id === d.category; }); });
    if (noneList.length) catBuckets.push({ cat: { icon: '➖', label: 'ไม่ระบุหมวดหมู่' }, list: noneList });
    catBuckets.forEach(function(b) {
      if (!b.list.length) return;
      h += '<details class="demo-cat-group" open><summary>' + (b.cat.icon || '') + ' ' + sanitize(b.cat.label) + ' <span class="cnt">' + b.list.length + '</span></summary>';
      h += '<div class="demo-grid">' + b.list.map(function(d) { return demoCardHtml(d, now, _dupRentals); }).join('') + '</div>';
      h += '</details>';
    });
  }

  el.innerHTML = h;
}

function demoCardHtml(d, now, dupRentals) {
  var eff = getDemoEffectiveStatus(d);
  var meta = DEMO_STATUS_META[eff];
  var dd = d.dealerId ? ST.getOne('dealers', d.dealerId) : null;
  var lentDate = ftParseDate(d.lentDate);
  var daysBorrowed = lentDate ? Math.floor((now - lentDate) / 86400000) : 0;
  var isOverdue = eff === 'lent' && daysBorrowed > 30;
  var retDate = ftParseDate(d.returnDate);
  var daysToReturn = retDate ? Math.ceil((retDate - now) / 86400000) : null;
  var isDueSoon = eff === 'lent' && daysToReturn !== null && daysToReturn <= 3;
  var mColor = demoModelColor(d.name);
  var cat = (getConfig().demoCategories || []).filter(function(c) { return c.id === d.category; })[0];

  var h = '';
  h += '<div class="demo-card2' + (isOverdue ? ' demo-overdue' : '') + '" style="border-left-color:' + mColor + '">';
  h += '<div class="demo-card2-top">';
  h += '<div class="demo-card2-id">';
  h += '<div class="demo-card2-icon" style="background:' + mColor + '22;color:' + mColor + '">' + (cat && cat.icon ? cat.icon : '🚁') + '</div>';
  h += '<div>';
  h += '<div class="demo-card2-name" onclick="go(\'demoDetail\',{demoId:\'' + d.id + '\'})" title="กดเพื่อดูรายละเอียดทั้งหมด">' + sanitize(d.name) + '</div>';
  if (d.serialNumber) h += '<span class="demo-sn-chip" style="background:' + mColor + '22;color:' + mColor + '">S/N ' + qcopyHtml(d.serialNumber) + '</span>';
  if (cat) h += '<div><span class="demo-cat-badge">' + (cat.icon || '') + ' ' + sanitize(cat.label) + '</span></div>';
  h += '</div></div>';
  h += '<span class="demo-status ' + meta.cls + '" title="' + sanitize(meta.desc) + '">' + meta.label + '</span>';
  h += '</div>';
  h += '<div class="demo-card2-info">';
  h += '<div>' + (d.flyable !== false ? '<span style="color:#38bdf8">✈️ บินสาธิตได้</span>' : '<span style="color:var(--text2)">🖼️ จัดแสดงเท่านั้น (ห้ามบิน)</span>') + '</div>';
  if ((d.model || '').trim()) h += '<div>📦 Model: ' + qcopyHtml(d.model) + '</div>';
  if (d.sku) h += '<div>🏷️ SiS Part: ' + qcopyHtml(d.sku) + '</div>';
  // ต้อง .trim() ให้ตรงกับเงื่อนไขที่ใช้แบ่งสโคป "พร้อมให้ยืม/ยังไม่ลงทะเบียน" ใน rDemoTracker() เป๊ะๆ
  // ไม่งั้นค่าที่มีแต่ช่องว่างจะถูกนับเป็น "ยังไม่ลงทะเบียน" ตอนกรอง แต่การ์ดกลับโชว์บรรทัดหมายเลขว่างเปล่า
  var _rental = (d.rentalDbNo || '').trim();
  if (_rental) {
    h += '<div>📋 หมายเลขเครื่องเช่า: ' + qcopyHtml(_rental);
    if (dupRentals && dupRentals[_rental]) h += ' <span style="color:#ef4444;font-weight:700">⚠️ ซ้ำกับเครื่องอื่น</span>';
    h += '</div>';
  }
  else h += '<div style="color:#f59e0b">📋 ยังไม่ลงทะเบียนเครื่องเช่า — ยืมจริงไม่ได้ / ลูกค้าไม่เห็นเครื่องนี้</div>';
  if (eff === 'lent' || eff === 'reserved') {
    if ((d.jobNo || '').trim()) h += '<div>📄 ใบงาน: ' + qcopyHtml(d.jobNo) + ' <button class="btn-xs" onclick="event.stopPropagation();demoTrackerTab=\'jobs\';render()">ดูใบงาน →</button></div>';
    if ((d.refNo || '').trim()) h += '<div>🔖 เลขอ้างอิง: ' + qcopyHtml(d.refNo) + '</div>';
    h += '<div>👤 ' + (dd ? sanitize(dd.name) : sanitize(d.borrower || '-')) + '</div>';
    if (d.purpose) h += '<div>🎯 ' + sanitize(d.purpose) + '</div>';
    h += '<div>📅 ' + (eff === 'reserved' ? 'จองวันที่: ' : 'ยืมตั้งแต่: ') + (d.lentDate || '-') + (eff === 'lent' ? ' (' + daysBorrowed + ' วัน)' : '') + '</div>';
    if (d.returnDate) {
      h += '<div>📅 กำหนดคืน: ' + d.returnDate;
      if (isDueSoon) h += ' <span style="color:#f59e0b;font-weight:700">' + (daysToReturn < 0 ? '(เลยกำหนด ' + Math.abs(daysToReturn) + ' วัน)' : daysToReturn === 0 ? '(ครบวันนี้)' : '(อีก ' + daysToReturn + ' วัน)') + '</span>';
      h += '</div>';
    }
  }
  if (d.note) h += '<div>📝 ' + sanitize(d.note) + '</div>';
  h += '</div>';
  h += demoComplianceBadges(d);
  h += '<div class="demo-card2-actions">';
  h += '<button class="btn bsm bo" onclick="go(\'demoDetail\',{demoId:\'' + d.id + '\'})">📄 รายละเอียด</button>';
  if (eff === 'available') h += '<button class="btn bsm bp" onclick="showLendDemoM(\'' + d.id + '\')">📤 ให้ยืม/จอง</button>';
  if (eff === 'lent' || eff === 'reserved') h += '<button class="btn bsm bp" onclick="returnDemo(\'' + d.id + '\')">✅ คืนแล้ว</button>';
  if (eff === 'unavailable') h += '<button class="btn bsm bp" onclick="demoSetStatus(\'' + d.id + '\',\'available\')">✅ พร้อมใช้</button>';
  h += '<button class="btn bsm bo" onclick="showEditDemoM(\'' + d.id + '\')">✏️</button>';
  if (eff === 'available') h += '<button class="btn bsm bd" onclick="deleteDemo(\'' + d.id + '\')">🗑️</button>';
  if (isOverdue) h += '<span style="color:#ff5252;font-size:11px;font-weight:700">⚠️ เกิน 30 วัน!</span>';
  h += '</div></div>';
  return h;
}

// ================================================================
// DEMO JOB SHEETS (ใบงาน) — รวมเครื่องที่เบิกในใบงานเดียวกัน (jobNo) ให้กดคืนทีเดียวทั้งชุด หรือติ๊กคืน
// เฉพาะบางเครื่องได้ ไม่ต้องไล่กดคืนทีละเครื่องจากหน้ารายการ
// loan ที่ยืมไว้ก่อนมีฟีเจอร์นี้ (ไม่มี jobNo) ไม่ได้ถูกซ่อน — รวมไว้กลุ่ม "ไม่ระบุเลขใบงาน" ให้ยังคืนได้
// เหมือนเดิม แต่ไม่มีปุ่ม "คืนทั้งใบ" เพราะมันไม่ใช่ชุดเดียวกันจริง แค่บังเอิญไม่มีเลขใบงานเหมือนกัน
// ================================================================
function demoActiveJobGroups() {
  var loans = getDemoLoans().filter(function(l) { return l.status === 'active'; });
  var groups = {}, order = [];
  loans.forEach(function(l) {
    var key = (l.jobNo || '').trim() || '_none';
    if (!groups[key]) { groups[key] = { jobNo: key === '_none' ? '' : (l.jobNo || '').trim(), refNo: l.refNo || '', loans: [] }; order.push(key); }
    if (!groups[key].refNo && l.refNo) groups[key].refNo = l.refNo;
    groups[key].loans.push(l);
  });
  // ใบที่ครบกำหนดคืนเร็วสุดขึ้นก่อน (ใบไม่มีกำหนดคืนไปท้าย) ส่วน "ไม่ระบุเลขใบงาน" ปักไว้ท้ายสุดเสมอ
  order.sort(function(a, b) {
    if (a === '_none') return 1;
    if (b === '_none') return -1;
    var ra = groups[a].loans.map(function(l) { return l.returnDate || ''; }).filter(Boolean).sort()[0] || '';
    var rb = groups[b].loans.map(function(l) { return l.returnDate || ''; }).filter(Boolean).sort()[0] || '';
    if (!ra && !rb) return 0;
    if (!ra) return 1;
    if (!rb) return -1;
    var da = ftParseDate(ra), db2 = ftParseDate(rb);
    return (da && db2) ? da - db2 : 0;
  });
  return order.map(function(k) { return groups[k]; });
}

function renderDemoJobsTab() {
  var groups = demoActiveJobGroups();
  if (!groups.length) {
    return '<div class="card" style="text-align:center;padding:34px"><div style="font-size:44px;margin-bottom:10px">📄</div><p>ยังไม่มีใบงานที่ยืมอยู่ — เครื่องที่ให้ยืมพร้อมกันโดยใส่ "เลขใบงาน" เดียวกันจะมารวมกันที่นี่</p></div>';
  }
  var now = new Date();
  var items = getDemoItems();
  var byId = {}; items.forEach(function(d) { byId[d.id] = d; });
  var h = '';
  h += '<div class="hint" style="margin-bottom:10px">ติ๊กเลือกเฉพาะเครื่องที่จะคืน แล้วกด "คืนที่เลือก" หรือกด "คืนทั้งใบ" เพื่อคืนทุกเครื่องในใบงานนั้นทีเดียว</div>';

  groups.forEach(function(g, gi) {
    var isNone = !g.jobNo;
    var retDates = g.loans.map(function(l) { return l.returnDate || ''; }).filter(Boolean).sort();
    var soonest = retDates[0] || '';
    var retD = soonest ? ftParseDate(soonest) : null;
    var daysToReturn = retD ? Math.ceil((retD - now) / 86400000) : null;
    var isLate = daysToReturn !== null && daysToReturn < 0;
    var isSoon = daysToReturn !== null && daysToReturn >= 0 && daysToReturn <= 3;
    var accent = isLate ? '#ef4444' : (isSoon ? '#f59e0b' : 'var(--border)');

    h += '<div class="card" style="margin-bottom:12px;border-left:4px solid ' + accent + '">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">';
    h += '<div>';
    h += '<div style="font-weight:700;font-size:14px">' + (isNone ? '➖ ไม่ระบุเลขใบงาน' : '📄 ' + qcopyHtml(g.jobNo)) + ' <span style="font-size:11px;font-weight:600;color:var(--text2)">' + g.loans.length + ' เครื่อง</span></div>';
    var sub = [];
    if (g.refNo) sub.push('🔖 ' + qcopyHtml(g.refNo));
    var borrower = g.loans[0].dealerId ? ((ST.getOne('dealers', g.loans[0].dealerId) || {}).name || '') : (g.loans[0].borrower || '');
    if (borrower && !isNone) sub.push('👤 ' + sanitize(borrower));
    if (g.loans[0].lentDate && !isNone) sub.push('📅 ยืม ' + sanitize(g.loans[0].lentDate));
    if (soonest) sub.push('📅 คืน ' + sanitize(soonest) + (daysToReturn !== null ? ' <b style="color:' + (isLate ? '#ef4444' : isSoon ? '#f59e0b' : 'var(--text2)') + '">' + (daysToReturn < 0 ? '(เลยกำหนด ' + Math.abs(daysToReturn) + ' วัน)' : daysToReturn === 0 ? '(ครบวันนี้)' : '(อีก ' + daysToReturn + ' วัน)') + '</b>' : ''));
    if (sub.length) h += '<div style="font-size:11.5px;color:var(--text2);margin-top:3px;line-height:1.7">' + sub.join(' &nbsp;·&nbsp; ') + '</div>';
    h += '</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    h += '<button class="btn bsm bo" onclick="demoJobToggleAll(' + gi + ',true)">☑️ เลือกทั้งหมด</button>';
    h += '<button class="btn bsm bp" onclick="demoJobReturnSelected(' + gi + ')">✅ คืนที่เลือก</button>';
    if (!isNone) h += '<button class="btn bsm bp" onclick="demoJobReturnAll(' + gi + ')">📦 คืนทั้งใบ</button>';
    h += '</div>';
    h += '</div>';

    h += '<div style="margin-top:10px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
    g.loans.forEach(function(l, li) {
      var unit = byId[l.demoId] || {};
      h += '<label style="display:flex;align-items:center;gap:9px;padding:8px 10px;font-size:12px;cursor:pointer;' + (li ? 'border-top:1px solid var(--border)' : '') + '">';
      h += '<input type="checkbox" class="demo-job-cb" data-g="' + gi + '" value="' + sanitize(l.demoId) + '">';
      h += '<span style="flex:1">' + sanitize(l.demoName || unit.name || '-');
      if (unit.serialNumber) h += ' <span style="color:var(--text2);font-size:11px">S/N ' + qcopyHtml(unit.serialNumber) + '</span>';
      if (unit.rentalDbNo) h += ' <span style="color:var(--text3);font-size:11px">· เช่า ' + qcopyHtml(unit.rentalDbNo) + '</span>';
      if (unit.id) h += ' <button class="btn-xs" onclick="event.preventDefault();event.stopPropagation();go(\'demoDetail\',{demoId:\'' + unit.id + '\'})">รายละเอียด →</button>';
      h += '</span>';
      if (isNone && l.borrower) h += '<span style="color:var(--text2);font-size:11px">👤 ' + sanitize(l.borrower) + '</span>';
      if (isNone && l.returnDate) h += '<span style="color:var(--text2);font-size:11px">📅 ' + sanitize(l.returnDate) + '</span>';
      h += '</label>';
    });
    h += '</div>';
    if (g.loans[0].purpose && !isNone) h += '<div style="font-size:11.5px;color:var(--text2);margin-top:8px">🎯 ' + sanitize(g.loans[0].purpose) + '</div>';
    h += '</div>';
  });
  return h;
}

function demoJobToggleAll(gi, on) {
  document.querySelectorAll('.demo-job-cb[data-g="' + gi + '"]').forEach(function(cb) { cb.checked = on; });
}
function _demoJobSelectedIds(gi) {
  var ids = [];
  document.querySelectorAll('.demo-job-cb[data-g="' + gi + '"]:checked').forEach(function(cb) { ids.push(cb.value); });
  return ids;
}
function demoJobReturnSelected(gi) {
  var ids = _demoJobSelectedIds(gi);
  if (!ids.length) { toast('ยังไม่ได้เลือกเครื่องที่จะคืน'); return; }
  if (!confirm('ยืนยันคืน ' + ids.length + ' เครื่อง?')) return;
  var n = _returnDemoUnits(ids);
  toast('✅ คืนแล้ว ' + n + ' เครื่อง');
  render();
}
function demoJobReturnAll(gi) {
  var groups = demoActiveJobGroups();
  var g = groups[gi];
  if (!g) return;
  var ids = g.loans.map(function(l) { return l.demoId; });
  if (!confirm('คืนทั้งใบงาน ' + (g.jobNo || '') + ' — ทั้งหมด ' + ids.length + ' เครื่อง ยืนยัน?')) return;
  var n = _returnDemoUnits(ids);
  toast('✅ คืนทั้งใบแล้ว ' + n + ' เครื่อง');
  render();
}

// ================================================================
// DEMO CALENDAR — ภาพรวมว่าวันไหนเครื่องไหนถูกยืม
// ================================================================
var demoCalMonthOffset = 0;
var demoCalUnitFilter = 'all';
function demoCalChangeMonth(delta) { demoCalMonthOffset += delta; render(); }

function renderDemoCalendar() {
  var base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + demoCalMonthOffset);
  var year = base.getFullYear(), month = base.getMonth();
  var monthKey = (month + 1) + '/' + year;
  var totalDays = getDaysInMonth(monthKey);
  var monthStart = new Date(year, month, 1);
  var monthEnd = new Date(year, month, totalDays);
  var todayD = new Date(); todayD.setHours(0, 0, 0, 0);

  var allUnits = getDemoItems();
  var loans = getDemoLoans();
  if (demoCalUnitFilter !== 'all') loans = loans.filter(function(l) { return l.demoId === demoCalUnitFilter; });

  // จัดกลุ่มประวัติยืม/จองตามเครื่อง (1 เครื่อง = 1 แถวเสมอ ไม่ปนกับเครื่องรุ่นเดียวกันตัวอื่น)
  var byUnit = {};
  loans.forEach(function(l) {
    if (!l.lentDate) return;
    var start = ftParseDate(l.lentDate);
    var end = (l.actualReturnDate && ftParseDate(l.actualReturnDate)) || (l.returnDate && ftParseDate(l.returnDate)) || new Date();
    if (!start) return;
    if (end < start) end = start;
    if (end < monthStart || start > monthEnd) return;
    if (!byUnit[l.demoId]) byUnit[l.demoId] = [];
    byUnit[l.demoId].push({ loan: l, start: start, end: end });
  });

  var unitIds = demoCalUnitFilter !== 'all' ? [demoCalUnitFilter] : Object.keys(byUnit);
  var rows = unitIds.map(function(id) {
    var unit = null;
    for (var i = 0; i < allUnits.length; i++) { if (allUnits[i].id === id) { unit = allUnits[i]; break; } }
    return { id: id, unit: unit, bars: byUnit[id] || [] };
  }).filter(function(r) { return r.unit; });
  rows.sort(function(a, b) { return (a.unit.name + (a.unit.serialNumber || '')).localeCompare(b.unit.name + (b.unit.serialNumber || '')); });

  var monthName = getMonthName(month) + ' ' + year;
  var h = '<div class="card" style="padding:10px;margin-bottom:10px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  h += '<button class="btn bsm bo" onclick="demoCalChangeMonth(-1)">◀</button>';
  h += '<b>🚁 ' + monthName + '</b>';
  h += '<button class="btn bsm bo" onclick="demoCalChangeMonth(1)">▶</button>';
  h += '</div>';
  h += '<select class="fm-input" onchange="demoCalUnitFilter=this.value;render()">';
  h += '<option value="all"' + (demoCalUnitFilter === 'all' ? ' selected' : '') + '>🚁 ดูทุกเครื่องที่มีการยืม/จองเดือนนี้</option>';
  allUnits.forEach(function(u) {
    h += '<option value="' + u.id + '"' + (demoCalUnitFilter === u.id ? ' selected' : '') + '>' + sanitize(u.name) + (u.serialNumber ? ' (S/N ' + sanitize(u.serialNumber) + ')' : '') + '</option>';
  });
  h += '</select>';
  h += '</div>';

  if (!rows.length) {
    return h + '<div class="card" style="text-align:center;padding:30px;color:var(--text2)">ไม่มีเครื่องที่ถูกยืม/จองในเดือนนี้</div>';
  }

  h += '<div class="demo-gantt-wrap"><div class="demo-gantt card" style="padding:10px">';
  h += '<div class="demo-gantt-head"><div></div><div class="demo-gantt-head-days">';
  var step = totalDays > 28 ? 2 : 1;
  for (var dnum = 1; dnum <= totalDays; dnum += step) {
    h += '<span style="left:' + ((dnum - 0.5) / totalDays * 100) + '%">' + dnum + '</span>';
  }
  h += '</div></div>';

  var todayPct = (todayD >= monthStart && todayD <= monthEnd) ? ((todayD.getDate() - 0.5) / totalDays * 100) : null;

  rows.forEach(function(r) {
    var mColor = demoModelColor(r.unit.name);
    h += '<div class="demo-gantt-row">';
    h += '<div class="demo-gantt-label"><b>' + sanitize(r.unit.name) + '</b>' + (r.unit.serialNumber ? '<br><span class="demo-gantt-sn" style="color:' + mColor + '">S/N ' + sanitize(r.unit.serialNumber) + '</span>' : '') + '</div>';
    h += '<div class="demo-gantt-track">';
    if (todayPct !== null) h += '<div class="demo-gantt-today-line" style="left:' + todayPct + '%" title="วันนี้"></div>';
    r.bars.forEach(function(b) {
      var clipStart = b.start < monthStart ? monthStart : b.start;
      var clipEnd = b.end > monthEnd ? monthEnd : b.end;
      var leftPct = (clipStart.getDate() - 1) / totalDays * 100;
      var widthPct = Math.max((clipEnd.getDate() - clipStart.getDate() + 1) / totalDays * 100, 100 / totalDays);
      var isFuture = b.start > todayD;
      var label = (isFuture ? '📅 ' : '📤 ') + (b.loan.borrower || '-');
      h += '<div class="demo-gantt-bar' + (isFuture ? ' is-reserved' : '') + '" style="left:' + leftPct + '%;width:' + widthPct + '%;' + (isFuture ? 'color:' + mColor : 'background:' + mColor) + '" onclick="go(\'demoDetail\',{demoId:\'' + r.id + '\'})" title="' + sanitize((r.unit.name || '') + ' - ' + (b.loan.borrower || '')) + '">' + sanitize(label) + '</div>';
    });
    h += '</div></div>';
  });
  h += '</div></div>';

  h += '<div class="demo-gantt-legend">';
  h += '<span><span class="demo-gantt-legend-dot" style="background:var(--accent)"></span>กำลังถูกยืม</span>';
  h += '<span><span class="demo-gantt-legend-dot" style="border:1px dashed var(--accent);background:transparent"></span>จองล่วงหน้า</span>';
  h += '<span style="color:var(--text3)">สีของแถบ = แยกตามรุ่นเครื่อง ไม่ใช่ตามสถานะ</span>';
  h += '</div>';
  return h;
}

// ================================================================
// DEMO REQUESTS — คำขอยืมจาก Dealer ผ่าน client-view.html (dealerUpdates/{dealerId}/demoRequests)
// เขียนจากฝั่งลูกค้าได้เพราะ dealerUpdates/{dealerId}/* เป็น path ที่เปิดให้ Dealer ที่มี PIN เขียนได้อยู่แล้ว
// (path เดียวกับ pipeline/forecast ที่ client-view.html ใช้) ต่างจาก users/{uid}/* ที่ล็อกเฉพาะเจ้าของ
// ================================================================
var _demoRequestsCache = []; // [{id, dealerId, ...data}] เฉพาะ status='pending' เท่านั้น — โหลดสดจาก Firestore
var _demoReqPendingCount = 0;
var _demoReqLoading = false;

// โหลดคำขอที่ยังรออนุมัติจากทุก Dealer — วนอ่าน subcollection ทีละ Dealer เหมือน rCustomerForecastUpdates
// (ไม่มี top-level collection ให้ query รวดเดียวได้ เพราะ path ผูกกับ dealer แต่ละราย)
function loadDemoRequests(cb) {
  if (typeof db === 'undefined' || !CURRENT_USER) { if (cb) cb(); return; }
  _demoReqLoading = true;
  var dealers = ST.getAll('dealers');
  var all = [];
  Promise.all(dealers.map(function(dealer) {
    return db.collection('dealerUpdates').doc(dealer.id).collection('demoRequests')
      .where('status', '==', 'pending').get()
      .then(function(snap) {
        snap.forEach(function(doc) {
          var data = doc.data();
          data.id = doc.id;
          data.dealerId = dealer.id;
          data.dealerName = dealer.name;
          all.push(data);
        });
      })
      .catch(function(e) { console.warn('loadDemoRequests error for dealer', dealer.id, e); });
  })).then(function() {
    all.sort(function(a, b) {
      var ta = a.submittedAt && a.submittedAt.toMillis ? a.submittedAt.toMillis() : 0;
      var tb = b.submittedAt && b.submittedAt.toMillis ? b.submittedAt.toMillis() : 0;
      return ta - tb; // เก่าสุด(ขอก่อน) ก่อน
    });
    _demoRequestsCache = all;
    _demoReqPendingCount = all.length;
    _demoReqLoading = false;
    updateDemoReqBadge();
    if (cb) cb();
  });
}

// ตัวเลขแจ้งเตือนที่ sidebar ข้างเมนู Demo Equipment — pattern เดียวกับ #nBdg ของ Reminders
function updateDemoReqBadge() {
  var el = document.getElementById('demoReqBdg');
  if (el) { el.style.display = _demoReqPendingCount ? 'inline' : 'none'; el.textContent = _demoReqPendingCount; }
}

// สองคำขอ "ชนกัน" ถ้าเป็นเครื่องเดียวกันและช่วงวันที่ทับกัน
function demoReqOverlaps(a, b) { return a.unitId === b.unitId && a.startDate <= b.endDate && b.startDate <= a.endDate; }
function demoReqConflictsOf(req) { return _demoRequestsCache.filter(function(r) { return r.id !== req.id && demoReqOverlaps(req, r); }); }

function renderDemoRequestsTab() {
  if (_demoReqLoading) return '<div class="card" style="text-align:center;padding:30px;color:var(--text2)">⏳ กำลังโหลดคำขอ...</div>';
  if (!_demoRequestsCache.length) {
    return '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px;margin-bottom:8px">✅</div><p style="color:var(--text2)">ไม่มีคำขอค้างตรวจสอบ</p></div>';
  }
  var h = '<div class="card"><h2>🟡 คำขอยืมจาก Dealer (' + _demoRequestsCache.length + ')</h2>';
  h += '<p style="font-size:12px;color:var(--text2);margin:-4px 0 10px">เรียงตามเวลาที่ส่งเข้ามาก่อน-หลัง — แถวที่มีป้าย ⚠️ ชนกัน คือมีคำขออื่นขอเครื่องเดียวกันช่วงเวลาเดียวกันไว้ด้วย</p>';
  _demoRequestsCache.forEach(function(r) {
    var conflicts = demoReqConflictsOf(r);
    var submittedTxt = r.submittedAt && r.submittedAt.toDate ? r.submittedAt.toDate().toLocaleString('th-TH') : '-';
    h += '<div class="li" style="flex-direction:column;align-items:stretch;gap:4px">';
    h += '<div class="lm"><div class="lt">🚁 ' + sanitize(r.unitName || '-') + (conflicts.length ? ' <span class="fu-badge fu-badge-red">⚠️ ชนกัน ' + conflicts.length + ' รายการ</span>' : '') + '</div>';
    h += '<div class="ls">🏪 ' + sanitize(r.dealerName || '-') + ' · 👤 End User: ' + sanitize(r.endUser || '-') + '</div></div>';
    h += '<div class="ls">📅 ' + sanitize(r.startDate || '-') + ' – ' + sanitize(r.endDate || '-') + '</div>';
    if (r.purpose) h += '<div class="ls">🎯 ' + sanitize(r.purpose) + '</div>';
    h += '<div class="ls">👤 ผู้ติดต่อ: ' + sanitize(r.contactName || '-') + ' · ' + sanitize(r.phone || '-') + '</div>';
    h += '<div class="ls" style="color:var(--text3)">ส่งคำขอเมื่อ: ' + submittedTxt + '</div>';
    h += '<div style="display:flex;gap:6px;margin-top:4px">';
    h += '<button class="btn bsm bp" onclick="approveDemoRequest(\'' + r.dealerId + '\',\'' + r.id + '\')">✅ อนุมัติ</button>';
    h += '<button class="btn bsm bd" onclick="rejectDemoRequest(\'' + r.dealerId + '\',\'' + r.id + '\')">✕ ปฏิเสธ</button>';
    h += '</div></div>';
  });
  h += '</div>';
  return h;
}

// อนุมัติคำขอ — เทียบเท่ากับ lendDemo() แต่ใช้ข้อมูลจากคำขอแทนฟอร์ม, ถ้ามีคำขออื่นชนกันจะถามยืนยันก่อนแล้ว
// ปฏิเสธที่ชนกันให้อัตโนมัติ (ป้องกันเครื่องเดียวกันถูกจองซ้อนสองราย)
function approveDemoRequest(dealerId, reqId) {
  var req = _demoRequestsCache.filter(function(r) { return r.id === reqId; })[0];
  if (!req) return;
  var conflicts = demoReqConflictsOf(req);
  if (conflicts.length) {
    if (!confirm('ช่วงเวลานี้มีคำขออื่นชนกันอยู่ ' + conflicts.length + ' รายการ — อนุมัติรายการนี้จะถือว่าปฏิเสธรายการที่ชนกันให้อัตโนมัติ ดำเนินการต่อไหม?')) return;
  } else if (!confirm('อนุมัติคำขอยืม "' + req.unitName + '" จาก ' + req.dealerName + '?')) return;

  var items = getDemoItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === req.unitId) {
      items[i].status = 'lent';
      items[i].dealerId = dealerId;
      items[i].borrower = req.dealerName || '';
      items[i].purpose = (req.purpose || '') + (req.endUser ? ' · End User: ' + req.endUser : '');
      items[i].lentDate = req.startDate || _td();
      items[i].returnDate = req.endDate || '';
      items[i].note = 'อนุมัติจากคำขอลูกค้า — ผู้ติดต่อ ' + (req.contactName || '-') + ' ' + (req.phone || '');
      break;
    }
  }
  saveDemoItems(items);

  var loans = getDemoLoans();
  loans.push({
    id: gid(), demoId: req.unitId, demoName: req.unitName,
    dealerId: dealerId, borrower: req.dealerName || '', purpose: req.purpose || '',
    lentDate: req.startDate || _td(), returnDate: req.endDate || '', actualReturnDate: '',
    note: 'จากคำขอลูกค้า (End User: ' + (req.endUser || '-') + ')', status: 'active', created: _nw()
  });
  saveDemoLoans(loans);

  db.collection('dealerUpdates').doc(dealerId).collection('demoRequests').doc(reqId).set({ status: 'approved' }, { merge: true });
  conflicts.forEach(function(c) {
    db.collection('dealerUpdates').doc(c.dealerId).collection('demoRequests').doc(c.id).set({ status: 'rejected' }, { merge: true });
  });

  toast('✅ อนุมัติแล้ว — เปลี่ยนสถานะเครื่องเป็นให้ยืมแล้ว');
  loadDemoRequests(render);
}

function rejectDemoRequest(dealerId, reqId) {
  var req = _demoRequestsCache.filter(function(r) { return r.id === reqId; })[0];
  if (!req) return;
  if (!confirm('ปฏิเสธคำขอจาก ' + (req.dealerName || 'Dealer') + '?')) return;
  db.collection('dealerUpdates').doc(dealerId).collection('demoRequests').doc(reqId).set({ status: 'rejected' }, { merge: true })
    .then(function() { toast('✕ ปฏิเสธแล้ว'); loadDemoRequests(render); })
    .catch(function(e) { toast('❌ ผิดพลาด: ' + e.message, true); });
}

// ================================================================
// DEMO DETAIL — spec + ประวัติการยืมทั้งหมด
// ================================================================
function rDemoDetail(el) {
  var items = getDemoItems();
  var d = null;
  for (var i = 0; i < items.length; i++) { if (items[i].id === S.demoId) { d = items[i]; break; } }
  if (!d) { go('demoTracker'); return; }

  document.getElementById('pgT').textContent = '🚁 ' + d.name;

  var eff = getDemoEffectiveStatus(d);
  var meta = DEMO_STATUS_META[eff];
  var h = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '<button class="btn bsm bo" onclick="go(\'demoTracker\')" style="margin-bottom:10px">← กลับ</button>';

  // แถบสถานะ + ปุ่มที่ "ทำได้ตอนนี้" อยู่บนสุด — คนที่เพิ่งเปิดใช้ครั้งแรกจะเห็นทันทีว่าเครื่องนี้อยู่สถานะไหน
  // แปลว่าอะไร และกดอะไรต่อได้บ้าง โดยไม่ต้องเดาเอง
  h += '<div class="card">';
  h += '<h2 style="margin-bottom:4px">🚁 ' + sanitize(d.name) + ' <span class="demo-status ' + meta.cls + '" title="' + sanitize(meta.desc) + '">' + meta.label + '</span></h2>';
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">ℹ️ ' + sanitize(meta.desc) + '</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">';
  if (eff === 'available') h += '<button class="btn bsm bp" onclick="showLendDemoM(\'' + d.id + '\')">📤 ให้ยืม / จอง</button>';
  if (eff === 'lent' || eff === 'reserved') h += '<button class="btn bsm bp" onclick="returnDemo(\'' + d.id + '\')">✅ รับคืน</button>';
  if (eff === 'unavailable') h += '<button class="btn bsm bp" onclick="demoSetStatus(\'' + d.id + '\',\'available\')">✅ ตั้งเป็นพร้อมใช้</button>';
  h += '<button class="btn bsm bo" onclick="showEditDemoM(\'' + d.id + '\')">✏️ แก้ไขข้อมูลเครื่อง</button>';
  if (eff === 'available') h += '<button class="btn bsm bd" onclick="deleteDemo(\'' + d.id + '\')">🗑️ ลบ</button>';
  h += '</div>';
  h += '</div>';

  // ข้อมูลระบุตัวเครื่อง — ทุกค่าที่เอาไปใช้ต่อได้ กดปุ่ม 📋 คัดลอกได้ทันที ช่องที่ยังว่างจะมีปุ่มพาไปกรอกให้เลย
  h += '<div class="card"><h2>🔖 ข้อมูลระบุตัวเครื่อง</h2>';
  h += '<div class="demo-info">';
  h += _demoDetailRow('📦', 'Model (ชื่อรุ่นที่ลูกค้าเห็น)', d.model, d.id, 'ยังไม่ได้ตั้ง — ลูกค้าจะเห็นชื่อเครื่องเต็มแทน');
  h += _demoDetailRow('🔢', 'Serial Number', d.serialNumber, d.id, 'ยังไม่ได้กรอก');
  h += _demoDetailRow('🏷️', 'SiS Part (SKU)', d.sku, d.id, 'ยังไม่ได้กรอก');
  h += _demoDetailRow('📋', 'หมายเลขเครื่องเช่า', d.rentalDbNo, d.id, 'ยังไม่ลงทะเบียนเช่า — ยืมจริงไม่ได้ และลูกค้าไม่เห็นเครื่องนี้');
  var _cat = (getConfig().demoCategories || []).filter(function(c) { return c.id === d.category; })[0];
  h += '<div>🗂️ หมวดหมู่: ' + (_cat ? (_cat.icon || '') + ' ' + sanitize(_cat.label) : '<span style="color:var(--text3)">ไม่ระบุ</span> <button class="btn-xs" onclick="showEditDemoM(\'' + d.id + '\')">ตั้งหมวดหมู่</button>') + '</div>';
  h += '<div>' + (d.flyable !== false ? '✈️ บินสาธิตได้' : '🖼️ จัดแสดงเท่านั้น (ห้ามบิน)') + '</div>';
  if (d.note) h += '<div>📝 ' + sanitize(d.note) + '</div>';
  h += '</div>';
  h += '<div style="font-size:12px;color:var(--text2);margin:10px 0 4px">เอกสาร/การจดทะเบียน</div>';
  h += demoComplianceBadges(d);
  h += '</div>';

  // สถานะการยืมปัจจุบัน — โชว์เฉพาะตอนถูกยืม/จองอยู่ พร้อมลิงก์ไปใบงานและ Dealer ที่เกี่ยวข้อง
  if (eff === 'lent' || eff === 'reserved') {
    var dd = d.dealerId ? ST.getOne('dealers', d.dealerId) : null;
    var _now = new Date();
    var _ret = ftParseDate(d.returnDate);
    var _days = _ret ? Math.ceil((_ret - _now) / 86400000) : null;
    h += '<div class="card"><h2>' + (eff === 'reserved' ? '📅 การจองปัจจุบัน' : '📤 กำลังถูกยืมอยู่') + '</h2>';
    h += '<div class="demo-info">';
    if ((d.jobNo || '').trim()) {
      h += '<div>📄 เลขใบงาน: ' + qcopyHtml(d.jobNo) + ' <button class="btn-xs" onclick="demoTrackerTab=\'jobs\';go(\'demoTracker\')">ดูทั้งใบงาน →</button></div>';
    }
    if ((d.refNo || '').trim()) h += '<div>🔖 เลขอ้างอิง: ' + qcopyHtml(d.refNo) + '</div>';
    h += '<div>👤 ผู้ยืม: ' + (dd ? '<b onclick="go(\'dealerDetail\',{dealerId:\'' + dd.id + '\'})" style="cursor:pointer;text-decoration:underline">' + sanitize(dd.name) + '</b>' : sanitize(d.borrower || '-')) + '</div>';
    if (d.purpose) h += '<div>🎯 ใช้งานกับ: ' + sanitize(d.purpose) + '</div>';
    h += '<div>📅 ' + (eff === 'reserved' ? 'จองวันที่: ' : 'ยืมตั้งแต่: ') + sanitize(d.lentDate || '-') + '</div>';
    if (d.returnDate) {
      h += '<div>📅 กำหนดคืน: ' + sanitize(d.returnDate);
      if (_days !== null) h += ' <b style="color:' + (_days < 0 ? '#ef4444' : _days <= 3 ? '#f59e0b' : 'var(--text2)') + '">' + (_days < 0 ? '(เลยกำหนด ' + Math.abs(_days) + ' วัน)' : _days === 0 ? '(ครบวันนี้)' : '(อีก ' + _days + ' วัน)') + '</b>';
      h += '</div>';
    } else {
      h += '<div style="color:#f59e0b">📅 ยังไม่ได้ระบุกำหนดคืน <button class="btn-xs" onclick="showEditDemoM(\'' + d.id + '\')">กรอกกำหนดคืน</button></div>';
    }
    h += '</div></div>';
  }

  var history = demoLoansByDemo(d.id);
  h += '<div class="card"><h2>📜 ประวัติการยืม (' + history.length + ')</h2>';
  if (!history.length) {
    h += '<p style="color:var(--text2)">ยังไม่มีประวัติการยืม — เมื่อเครื่องนี้ถูกให้ยืมและรับคืน รายการจะถูกบันทึกไว้ที่นี่ทุกครั้ง</p>';
  } else {
    history.forEach(function(l) {
      var dd2 = l.dealerId ? ST.getOne('dealers', l.dealerId) : null;
      h += '<div class="li">';
      h += '<div class="lm">';
      h += '<div class="lt">👤 ' + sanitize(dd2 ? dd2.name : (l.borrower || '-')) + ' <span class="fu-badge ' + (l.status === 'active' ? 'fu-badge-red' : '') + '">' + (l.status === 'active' ? '📤 กำลังยืม' : '✅ คืนแล้ว') + '</span></div>';
      if ((l.jobNo || '').trim()) h += '<div class="ls">📄 ใบงาน: ' + qcopyHtml(l.jobNo) + ((l.refNo || '').trim() ? ' · 🔖 ' + qcopyHtml(l.refNo) : '') + '</div>';
      h += '<div class="ls">📅 ยืม: ' + sanitize(l.lentDate || '-') + (l.actualReturnDate ? ' • คืนจริง: ' + sanitize(l.actualReturnDate) : (l.returnDate ? ' • กำหนดคืน: ' + sanitize(l.returnDate) : '')) + '</div>';
      if (l.purpose) h += '<div class="ls">🎯 ' + sanitize(l.purpose) + '</div>';
      if (l.note) h += '<div class="ls">📝 ' + sanitize(l.note) + '</div>';
      h += '</div></div>';
    });
  }
  h += '</div>';

  el.innerHTML = h;
}

// แถวข้อมูลในหน้ารายละเอียด — มีค่า = โชว์พร้อมปุ่มคัดลอก, ไม่มีค่า = บอกว่าขาดอะไรพร้อมปุ่มกดไปแก้ทันที
// (ไม่ปล่อยให้แถวหายไปเงียบๆ เพราะคนใช้ครั้งแรกจะไม่รู้ว่ามีช่องนี้อยู่และควรกรอก)
function _demoDetailRow(icon, label, value, demoId, emptyHint) {
  var v = (value || '').trim();
  if (v) return '<div>' + icon + ' ' + label + ': ' + qcopyHtml(v) + '</div>';
  return '<div style="color:var(--text3)">' + icon + ' ' + label + ': <span style="color:#f59e0b">' + sanitize(emptyHint) + '</span> ' +
    '<button class="btn-xs" onclick="showEditDemoM(\'' + demoId + '\')">กรอกเลย</button></div>';
}

// ตัวเลือก Model ดึงจากสินค้าหมวด Demo Unit ใน Products module พร้อม SKU
function demoUnitOptions(selected) {
  var units = [];
  try { units = getAllDemoUnits(); } catch (e) { units = []; }
  var h = '<option value="">-- เลือก Model --</option>';
  for (var i = 0; i < units.length; i++) {
    var u = units[i];
    var name = u.productName || u.name || '';
    if (!name) continue;
    h += '<option value="' + sanitize(name) + '" data-sku="' + sanitize(u.sku || '') + '"' + (selected === name ? ' selected' : '') + '>' + sanitize(name) + (u.sku ? ' (' + sanitize(u.sku) + ')' : '') + '</option>';
  }
  return h;
}
function fillDemoSku(selectEl) {
  var sel = selectEl.selectedOptions && selectEl.selectedOptions[0];
  var sku = sel ? (sel.dataset.sku || '') : '';
  var skuInput = document.getElementById('dm_sku');
  if (skuInput) skuInput.value = sku;
}

function demoComplianceFieldsHtml(d) {
  d = d || {};
  var cats = (getConfig().demoCategories || []);
  var h = '<div class="fm-group"><label>🏷️ หมวดหมู่ (โชว์เป็นแท็บในหน้ายืม Demo สาธารณะ)</label><select id="dm_category" class="fm-input">';
  h += '<option value=""' + (!d.category ? ' selected' : '') + '>— ไม่ระบุ —</option>';
  cats.forEach(function(c) { h += '<option value="' + c.id + '"' + (d.category === c.id ? ' selected' : '') + '>' + c.icon + ' ' + sanitize(c.label) + '</option>'; });
  h += '</select></div>';
  h += '<div class="fm-group"><label>✈️ ประเภทการใช้งาน</label><select id="dm_flyable" class="fm-input">' +
    '<option value="1"' + (d.flyable !== false ? ' selected' : '') + '>✈️ บินสาธิตได้</option>' +
    '<option value="0"' + (d.flyable === false ? ' selected' : '') + '>🖼️ จัดแสดงสินค้าเท่านั้น (ห้ามบิน)</option></select></div>';
  h += '<div class="fm-group"><label>📋 หมายเลขเครื่องเช่า (DB เครื่องเช่า)</label><input type="text" id="dm_rentaldb" class="fm-input" value="' + sanitize(d.rentalDbNo || '') + '"></div>';
  h += '<div class="fm-group" style="display:flex;gap:14px;flex-wrap:wrap">';
  h += '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="dm_nbtc"' + (d.nbtcRegistered ? ' checked' : '') + '> ขึ้นทะเบียน กสทช</label>';
  h += '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="dm_insurance"' + (d.droneInsurance ? ' checked' : '') + '> ประกันภัยโดรน</label>';
  h += '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="dm_caat"' + (d.caatRegistered ? ' checked' : '') + '> ขึ้นทะเบียน CAAT</label>';
  h += '</div>';
  return h;
}
function readDemoComplianceFields() {
  return {
    category: (document.getElementById('dm_category').value || '').trim(),
    flyable: document.getElementById('dm_flyable').value !== '0',
    rentalDbNo: (document.getElementById('dm_rentaldb').value || '').trim(),
    nbtcRegistered: document.getElementById('dm_nbtc').checked,
    droneInsurance: document.getElementById('dm_insurance').checked,
    caatRegistered: document.getElementById('dm_caat').checked
  };
}

// ลิงก์ 2 หน้าใหม่ (demo-request.html/demo-staff.html) เป็นไฟล์แยกนอก SPA ไม่มีเมนูในแอพลิงก์ตรงไปหาได้
// (ผู้ใช้ถาม 2026-09-05 ว่าเมนูอยู่ไหน) เลยเพิ่มปุ่มนี้ไว้โชว์+copy URL แทน คำนวณ base URL จาก location
// ปัจจุบันเอง กันพิมพ์โดเมนผิดตอน deploy คนละที่ (localhost ตอน dev, โดเมนจริงตอน production)
function showDemoLinksM() {
  var base = location.href.replace(/[^/]*\.html.*$/, '').replace(/#.*$/, '');
  var reqUrl = base + 'demo-request.html';
  var staffUrl = base + 'demo-staff.html';
  var h = '<div style="max-width:420px">';
  h += '<div class="fm-group"><label>🔗 ลิงก์สำหรับลูกค้า (ขอยืม Demo — ส่งให้ใครก็ได้ ไม่ต้องมี Dealer PIN)</label>';
  h += '<div style="display:flex;gap:6px"><input type="text" class="fm-input" readonly value="' + sanitize(reqUrl) + '" id="demoLinkCust" onclick="this.select()"><button class="btn bsm bo" onclick="copyToClip(document.getElementById(\'demoLinkCust\').value)">📋</button></div></div>';
  h += '<div class="fm-group"><label>🔒 ลิงก์สำหรับทีม (อนุมัติ/กรอกยืมเอง/ติดตามคืน — ต้องกรอกรหัสผ่านร่วมก่อน)</label>';
  h += '<div style="display:flex;gap:6px"><input type="text" class="fm-input" readonly value="' + sanitize(staffUrl) + '" id="demoLinkStaff" onclick="this.select()"><button class="btn bsm bo" onclick="copyToClip(document.getElementById(\'demoLinkStaff\').value)">📋</button></div></div>';
  h += '<div style="font-size:11px;color:var(--text2);margin-top:6px">2 หน้านี้เป็นไฟล์แยกนอกแอพหลัก (demo-request.html / demo-staff.html) ไม่ต้อง login แบบเต็มรูปแบบ ใช้ข้อมูลอุปกรณ์ชุดเดียวกับเมนูนี้ผ่าน Firestore</div>';
  h += '</div>';
  openM('🔗 ลิงก์ยืม Demo', h);
}

function showAddDemoM() {
  var h = '<div style="max-width:400px">';
  h += '<div class="fm-group"><label>🚁 ชื่ออุปกรณ์ *</label><input type="text" id="dm_name" class="fm-input" placeholder="เช่น L3 Demo Unit #1"></div>';
  h += '<div class="fm-group"><label>🔢 Serial Number</label><input type="text" id="dm_sn" class="fm-input" placeholder="S/N"></div>';
  h += '<div class="fm-group"><label>📦 Model</label><select id="dm_model" class="fm-input" onchange="fillDemoSku(this)">' + demoUnitOptions('') + '</select></div>';
  h += '<div class="fm-group"><label>🏷️ SKU</label><input type="text" id="dm_sku" class="fm-input" placeholder="ดึงอัตโนมัติจาก Model"></div>';
  h += demoComplianceFieldsHtml({});
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="dm_note" rows="2" class="fm-input"></textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="saveDemo()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('➕ เพิ่มอุปกรณ์ Demo', h);
}

function saveDemo() {
  var name = (document.getElementById('dm_name').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }
  var items = getDemoItems();
  var compliance = readDemoComplianceFields();
  items.push(Object.assign({
    id: 'dm_' + Date.now(),
    name: name,
    serialNumber: (document.getElementById('dm_sn').value || '').trim(),
    model: document.getElementById('dm_model').value || '',
    sku: (document.getElementById('dm_sku').value || '').trim(),
    note: (document.getElementById('dm_note').value || '').trim(),
    status: 'available',
    dealerId: '',
    borrower: '',
    lentDate: '',
    returnDate: ''
  }, compliance));
  saveDemoItems(items);
  toast('✅ เพิ่มอุปกรณ์แล้ว');
  closeMForce();
  render();
}

function showLendDemoM(demoId) {
  var dealers = [];
  try { dealers = ST.getAll('dealers'); } catch(e) { dealers = []; }
  var items = getDemoItems();
  var self = items.filter(function(d) { return d.id === demoId; })[0] || {};
  // เครื่องอื่นที่ยืมพร้อมกันได้ในใบงานเดียวกัน — เฉพาะที่ว่างจริงและลงทะเบียนเครื่องเช่าแล้ว
  // (เงื่อนไขเดียวกับสโคป "พร้อมให้ยืม" ในหน้ารายการ ไม่งั้นจะเลือกเครื่องที่คีย์เบิกไม่ได้เข้ามาปนได้)
  var others = items.filter(function(d) {
    return d.id !== demoId && getDemoEffectiveStatus(d) === 'available' && (d.rentalDbNo || '').trim();
  }).sort(function(a, b) {
    var n = (a.name || '').localeCompare(b.name || '');
    return n !== 0 ? n : (a.serialNumber || '').localeCompare(b.serialNumber || '');
  });

  var h = '<div style="max-width:460px">';
  h += '<div class="fm-group"><label>📄 เลขใบงาน (เลขที่คีย์เบิกจากคลัง)</label><input type="text" id="dm_jobno" class="fm-input" placeholder="เช่น JOB-2569-0912" autocomplete="off"><div class="hint">ใส่เลขเดียวกันให้ทุกเครื่องที่เบิกในใบงานเดียวกัน — แท็บ 📄 ใบงาน จะรวมให้กดคืนทีเดียวได้</div></div>';
  h += '<div class="fm-group"><label>🔖 เลขอ้างอิง</label><input type="text" id="dm_refno" class="fm-input" placeholder="เลขอ้างอิงอื่น (ถ้ามี)" autocomplete="off"></div>';
  h += '<div class="fm-group"><label>🚁 เครื่องที่ยืมในใบงานนี้</label>';
  h += '<div style="font-size:12px;padding:6px 9px;background:var(--bg2);border-radius:7px;margin-bottom:6px">' + sanitize(self.name || '-') + (self.serialNumber ? ' <span style="color:var(--text2);font-family:monospace">S/N ' + sanitize(self.serialNumber) + '</span>' : '') + '</div>';
  if (others.length) {
    h += '<details><summary style="cursor:pointer;font-size:12px;color:var(--accent)">➕ เพิ่มเครื่องอื่นในใบงานเดียวกัน (' + others.length + ' เครื่องว่าง)</summary>';
    h += '<div style="max-height:190px;overflow:auto;border:1px solid var(--border);border-radius:7px;margin-top:6px;padding:4px">';
    others.forEach(function(d) {
      h += '<label style="display:flex;align-items:center;gap:7px;padding:4px 6px;font-size:12px;cursor:pointer">';
      h += '<input type="checkbox" class="dm-extra-unit" value="' + d.id + '">';
      h += '<span>' + sanitize(d.name) + (d.serialNumber ? ' <span style="color:var(--text2);font-family:monospace">S/N ' + sanitize(d.serialNumber) + '</span>' : '') + '</span>';
      h += '</label>';
    });
    h += '</div></details>';
  }
  h += '</div>';
  h += '<div class="fm-group"><label>🏪 ให้ยืมใคร</label><select id="dm_dealer" class="fm-input">';
  h += '<option value="">-- เลือก Dealer --</option>';
  dealers.forEach(function(d) { h += '<option value="' + d.id + '">' + sanitize(d.name) + '</option>'; });
  h += '</select></div>';
  h += '<div class="fm-group"><label>👤 ผู้ยืม (ถ้าไม่ใช่ Dealer)</label><input type="text" id="dm_borrower" class="fm-input" placeholder="ชื่อผู้ยืม"></div>';
  h += '<div class="fm-group"><label>🎯 ใช้งานกับ / End User / วัตถุประสงค์</label><input type="text" id="dm_purpose" class="fm-input" placeholder="เช่น สาธิตให้บริษัท ABC ดู / สำรวจพื้นที่ก่อสร้าง"></div>';
  h += '<div class="fm-group"><label>📅 วันที่ยืม/จอง</label><input type="text" id="dm_lent" class="fm-input dp" value="' + _td() + '"><div class="hint">เลือกวันที่ในอนาคต = ระบบจะแสดงสถานะ "📅 Reserved" อัตโนมัติจนถึงวันนั้น</div></div>';
  h += '<div class="fm-group"><label>📅 กำหนดคืน</label><input type="text" id="dm_return" class="fm-input dp" placeholder="DD/MM/YYYY"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="dm_lnote" rows="2" class="fm-input"></textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="lendDemo(\'' + demoId + '\')">📤 ให้ยืม</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('📤 ให้ยืม / จองล่วงหน้า', h);
}

function lendDemo(demoId) {
  var items = getDemoItems();
  var jobNo = (document.getElementById('dm_jobno').value || '').trim();
  var refNo = (document.getElementById('dm_refno').value || '').trim();
  var dealerId = document.getElementById('dm_dealer').value || '';
  var borrower = (document.getElementById('dm_borrower').value || '').trim();
  var purpose = document.getElementById('dm_purpose') ? document.getElementById('dm_purpose').value.trim() : '';
  var lentDate = (document.getElementById('dm_lent').value || '').trim() || _td();
  var returnDate = (document.getElementById('dm_return').value || '').trim();
  var note = (document.getElementById('dm_lnote').value || '').trim();

  // เครื่องหลัก + เครื่องที่ติ๊กเพิ่มในใบงานเดียวกัน ทุกตัวใช้ผู้ยืม/วันที่/เลขใบงานชุดเดียวกันหมด
  var targetIds = [demoId];
  document.querySelectorAll('.dm-extra-unit:checked').forEach(function(cb) {
    if (targetIds.indexOf(cb.value) === -1) targetIds.push(cb.value);
  });

  var loans = getDemoLoans();
  targetIds.forEach(function(id) {
    var demoName = '';
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items[i].status = 'lent';
        items[i].jobNo = jobNo;
        items[i].refNo = refNo;
        items[i].dealerId = dealerId;
        items[i].borrower = borrower;
        items[i].purpose = purpose;
        items[i].lentDate = lentDate;
        items[i].returnDate = returnDate;
        items[i].note = note;
        demoName = items[i].name;
        break;
      }
    }
    loans.push({
      id: gid(), demoId: id, demoName: demoName,
      jobNo: jobNo, refNo: refNo,
      dealerId: dealerId, borrower: borrower, purpose: purpose,
      lentDate: lentDate, returnDate: returnDate, actualReturnDate: '',
      note: note, status: 'active', created: _nw()
    });
  });
  saveDemoItems(items);
  saveDemoLoans(loans);

  toast(targetIds.length > 1 ? '📤 ให้ยืมแล้ว ' + targetIds.length + ' เครื่อง' : '📤 ให้ยืมแล้ว');
  closeMForce();
  render();
}

// คืนอุปกรณ์หลายเครื่องพร้อมกัน — ตรรกะกลางที่ทั้งปุ่มคืนรายเครื่อง ปุ่มคืนทั้งใบงาน และคืนเฉพาะที่เลือก
// เรียกใช้ร่วมกัน (ไม่ confirm/ไม่ render เอง ให้ผู้เรียกจัดการ) คืนค่าเป็นจำนวนเครื่องที่คืนสำเร็จจริง
function _returnDemoUnits(demoIds) {
  var items = getDemoItems();
  var loans = getDemoLoans();
  var done = 0;
  demoIds.forEach(function(demoId) {
    var hit = false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === demoId) {
        items[i].status = 'available';
        items[i].jobNo = '';
        items[i].refNo = '';
        items[i].dealerId = '';
        items[i].borrower = '';
        items[i].purpose = '';
        items[i].lentDate = '';
        items[i].returnDate = '';
        items[i].note = '';
        hit = true;
        break;
      }
    }
    if (hit) done++;
    for (var j = loans.length - 1; j >= 0; j--) {
      if (loans[j].demoId === demoId && loans[j].status === 'active') {
        loans[j].status = 'returned';
        loans[j].actualReturnDate = _td();
        break;
      }
    }
  });
  saveDemoItems(items);
  saveDemoLoans(loans);
  return done;
}

function returnDemo(demoId) {
  if (!confirm('ยืนยันคืนอุปกรณ์?')) return;
  _returnDemoUnits([demoId]);
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
  h += '<div class="fm-group"><label>📦 Model</label><select id="dm_model" class="fm-input" onchange="fillDemoSku(this)">' + demoUnitOptions(d.model || '') + '</select></div>';
  h += '<div class="fm-group"><label>🏷️ SKU</label><input type="text" id="dm_sku" class="fm-input" value="' + sanitize(d.sku || '') + '" placeholder="ดึงอัตโนมัติจาก Model"></div>';
  h += demoComplianceFieldsHtml(d);
  if (d.status === 'lent') {
    h += '<div class="fm-group"><label>📊 สถานะ</label><div class="hint">📤 On Borrowed / Reserved — จัดการผ่านปุ่ม "คืนแล้ว" ในหน้ารายการ ไม่แก้ตรงนี้</div></div>';
  } else {
    h += '<div class="fm-group"><label>📊 สถานะ</label><select id="dm_status" class="fm-input">';
    h += '<option value="available"' + (d.status === 'available' ? ' selected' : '') + '>✅ Available</option>';
    h += '<option value="unavailable"' + (d.status === 'unavailable' ? ' selected' : '') + '>⛔ Unavailable</option>';
    h += '<option value="lost"' + (d.status === 'lost' ? ' selected' : '') + '>💔 Lost/Damaged</option>';
    h += '</select></div>';
  }
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="dm_note" rows="2" class="fm-input">' + sanitize(d.note || '') + '</textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="updateDemo(\'' + demoId + '\')">💾 บันทึก</button>';
  h += '<button class="btn bd" onclick="deleteDemo(\'' + demoId + '\')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('✏️ แก้ไขอุปกรณ์', h);
}

function updateDemo(demoId) {
  var items = getDemoItems();
  var compliance = readDemoComplianceFields();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === demoId) {
      items[i].name = (document.getElementById('dm_name').value || '').trim();
      items[i].serialNumber = (document.getElementById('dm_sn').value || '').trim();
      items[i].model = document.getElementById('dm_model').value || '';
      items[i].sku = (document.getElementById('dm_sku').value || '').trim();
      items[i].category = compliance.category;
      items[i].flyable = compliance.flyable;
      items[i].rentalDbNo = compliance.rentalDbNo;
      items[i].nbtcRegistered = compliance.nbtcRegistered;
      items[i].droneInsurance = compliance.droneInsurance;
      items[i].caatRegistered = compliance.caatRegistered;
      var statusEl = document.getElementById('dm_status');
      items[i].status = statusEl ? (statusEl.value || 'available') : items[i].status;
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
  if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('demo', demoId);
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
// QUOTATION TRACKER
// ================================================================
function getQuotations() {
  var saved = localStorage.getItem('v7_quotes');
  if (saved) {
    try { 
      var parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) { 
      return []; 
    }
  }
  return [];
}

function saveQuotations(list) {
  localStorage.setItem('v7_quotes', JSON.stringify(list));
}

function rQuotations(el) {
  document.getElementById('pgT').textContent = '💰 Quotation Tracker';
  var quotes = getQuotations();
  var dealers = [];
  try { dealers = scopedDealers(); } catch(e) { dealers = []; }

  if (!quotes || !Array.isArray(quotes)) quotes = [];
  var _scopedIds = {};
  dealers.forEach(function(d) { _scopedIds[d.id] = true; });
  quotes = quotes.filter(function(q) { return !q.dealerId || _scopedIds[q.dealerId]; });

  var pending = (quotes || []).filter(function(q) { return q && q.status === 'pending'; });
  var approved = (quotes || []).filter(function(q) { return q && q.status === 'approved'; });
  var rejected = (quotes || []).filter(function(q) { return q && q.status === 'rejected'; });
  var expired = (quotes || []).filter(function(q) { return q && q.status === 'expired'; });

  var now = new Date();

  var h = '';
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
  h += '<button class="btn bp" onclick="showAddQuoteM()">➕ เพิ่ม Quote</button>';
  h += '</div>';

  // Stats
  var totalVal = 0;
  (quotes || []).forEach(function(q) { if (q && q.amount) totalVal += (Number(q.amount) || 0); });
  var pendingVal = 0;
  (pending || []).forEach(function(q) { if (q && q.amount) pendingVal += (Number(q.amount) || 0); });

  h += '<div class="sr">';
  h += '<div class="sc"><div class="sn c1">' + (quotes || []).length + '</div><div class="sl">ทั้งหมด</div></div>';
  h += '<div class="sc"><div class="sn c5">' + (pending || []).length + '</div><div class="sl">⏳ รอตอบ</div></div>';
  h += '<div class="sc"><div class="sn c2">' + (approved || []).length + '</div><div class="sl">✅ อนุมัติ</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(pendingVal) + '</div><div class="sl">มูลค่ารอ</div></div>';
  h += '</div>';

  // Pending (urgent)
  if (pending && pending.length) {
    h += '<div class="card"><h2>⏳ รอตอบ (' + pending.length + ')</h2>';
    pending.sort(function(a, b) { return (a.sentDate || '').localeCompare(b.sentDate || ''); });
    for (var idx = 0; idx < pending.length; idx++) {
      var q = pending[idx];
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
    }
    h += '</div>';
  }

  // Approved
  if (approved && approved.length) {
    h += '<div class="card"><h2>✅ อนุมัติ (' + approved.length + ')</h2>';
    for (var i = 0; i < approved.length; i++) {
      var q = approved[i];
      var dd = q.dealerId ? ST.getOne('dealers', q.dealerId) : null;
      h += '<div class="quote-card quote-approved-card">';
      h += '<div class="quote-header"><div class="quote-num">' + sanitize(q.quoteNumber || '-') + '</div><span class="quote-status quote-approved">✅</span></div>';
      h += '<div class="quote-info"><div>🏪 ' + (dd ? sanitize(dd.name) : '-') + ' • 💰 ' + fmtMoneyStyled(q.amount) + '</div></div>';
      h += '<div class="demo-actions"><button class="btn bsm bo" onclick="showEditQuoteM(\'' + q.id + '\')">✏️</button></div>';
      h += '</div>';
    }
    h += '</div>';
  }

  // Rejected + Expired
  if ((rejected && rejected.length) || (expired && expired.length)) {
    var totalRejExp = (rejected ? rejected.length : 0) + (expired ? expired.length : 0);
    h += '<div class="card"><h2>❌ ปฏิเสธ/หมดอายุ (' + totalRejExp + ')</h2>';
    var allRejExp = (rejected || []).concat(expired || []);
    for (var i = 0; i < allRejExp.length; i++) {
      var q = allRejExp[i];
      var dd = q.dealerId ? ST.getOne('dealers', q.dealerId) : null;
      h += '<div class="quote-card" style="opacity:0.5">';
      h += '<div class="quote-header"><div class="quote-num">' + sanitize(q.quoteNumber || '-') + '</div><span class="quote-status quote-rejected">' + (q.status === 'expired' ? '⏰' : '❌') + '</span></div>';
      h += '<div class="quote-info"><div>🏪 ' + (dd ? sanitize(dd.name) : '-') + ' • 💰 ' + fmtMoney(q.amount) + '</div></div>';
      h += '</div>';
    }
    h += '</div>';
  }

  if (!quotes || quotes.length === 0) {
    h += '<div class="card" style="text-align:center;padding:30px"><div style="font-size:48px;margin-bottom:10px">💰</div><p>ยังไม่มี Quotation — กด ➕ เพื่อเพิ่ม</p></div>';
  }

  el.innerHTML = h;
}

function showAddQuoteM() {
  var dealers = [];
  try { dealers = ST.getAll('dealers'); } catch(e) { dealers = []; }
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>📄 เลข Quote</label><input type="text" id="qt_num" class="fm-input" placeholder="เช่น QT-2025-001"></div>';
  h += '<div class="fm-group"><label>🏪 Dealer *</label><select id="qt_dealer" class="fm-input" onchange="qtDealerChanged()">';
  h += '<option value="">-- เลือก --</option>';
  dealers.forEach(function(d) { h += '<option value="' + d.id + '">' + sanitize(d.name) + '</option>'; });
  h += '</select></div>';
  h += '<div class="fm-group"><label>📊 Pipeline Project</label><select id="qt_pipe" class="fm-input"><option value="">-- ไม่ระบุ --</option></select></div>';
  h += '<div class="fm-group"><label>📋 รายละเอียด</label><input type="text" id="qt_desc" class="fm-input" placeholder="เช่น M400 x3 + L3 x1"></div>';
  h += '<div class="fm-group"><label>💰 มูลค่า (฿)</label><input type="text" inputmode="decimal" id="qt_amt" class="fm-input js-money"></div>';
  h += '<div class="fm-group"><label>📅 วันที่ส่ง</label><input type="text" id="qt_sent" class="fm-input dp" value="' + _td() + '"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="qt_note" rows="2" class="fm-input"></textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="saveQuote()">💾 บันทึก</button>';
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
  var pipes = [];
  try { pipes = ST.pipelineByDealer(dId); } catch(e) { pipes = []; }
  pipes.forEach(function(p) {
    if (!pipeIsOpen(p)) return;
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
    amount: parseNum(document.getElementById('qt_amt').value),
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

  var dealers = [];
  try { dealers = ST.getAll('dealers'); } catch(e) { dealers = []; }
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>📄 เลข Quote</label><input type="text" id="qt_num" class="fm-input" value="' + sanitize(q.quoteNumber || '') + '"></div>';
  h += '<div class="fm-group"><label>🏪 Dealer</label><select id="qt_dealer" class="fm-input">';
  dealers.forEach(function(d) { h += '<option value="' + d.id + '"' + (q.dealerId === d.id ? ' selected' : '') + '>' + sanitize(d.name) + '</option>'; });
  h += '</select></div>';
  h += '<div class="fm-group"><label>📋 รายละเอียด</label><input type="text" id="qt_desc" class="fm-input" value="' + sanitize(q.projectName || '') + '"></div>';
  h += '<div class="fm-group"><label>💰 มูลค่า</label><input type="text" inputmode="decimal" id="qt_amt" class="fm-input js-money" value="' + nmI(q.amount || '') + '"></div>';
  h += '<div class="fm-group"><label>📅 วันที่ส่ง</label><input type="text" id="qt_sent" class="fm-input dp" value="' + (q.sentDate || '') + '"></div>';
  h += '<div class="fm-group"><label>📊 สถานะ</label><select id="qt_status" class="fm-input">';
  h += '<option value="pending"' + (q.status === 'pending' ? ' selected' : '') + '>⏳ รอตอบ</option>';
  h += '<option value="approved"' + (q.status === 'approved' ? ' selected' : '') + '>✅ อนุมัติ</option>';
  h += '<option value="rejected"' + (q.status === 'rejected' ? ' selected' : '') + '>❌ ปฏิเสธ</option>';
  h += '<option value="expired"' + (q.status === 'expired' ? ' selected' : '') + '>⏰ หมดอายุ</option>';
  h += '</select></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="qt_note" rows="2" class="fm-input">' + sanitize(q.note || '') + '</textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="updateQuote(\'' + quoteId + '\')">💾 บันทึก</button>';
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
      quotes[i].amount = parseNum(document.getElementById('qt_amt').value);
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
// VISIT PLANNING
// ================================================================
var vpWeekOffset = 0;
var vpViewMode = 'month'; // 'month' | 'week'
var vpMonthOffset = 0;
var vpSelectedDay = null;

// แปลงวันที่เก่ารูปแบบ DD/MM/YYYY (ของ fmtDateKey เดิม) ให้เป็น ISO YYYY-MM-DD
// กันพังกับ plan ที่บันทึกไว้ก่อนเปลี่ยนรูปแบบ
function _vpNormalizeDate(s) {
  if (!s) return s;
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return s;
}

// แปลง "HH:MM" เป็นนาที — ไว้เทียบช่วงเวลาว่าทับซ้อนกันไหม
function _vpTimeToMin(t) {
  if (!t) return null;
  var p = t.split(':');
  return parseInt(p[0], 10) * 60 + (parseInt(p[1], 10) || 0);
}
// ถ้าไม่ได้ระบุเวลาสิ้นสุด ใช้ default เริ่ม+30 นาทีสำหรับเช็คชนเวลา
function _vpEffEndMin(start, end) {
  var s = _vpTimeToMin(start), e = _vpTimeToMin(end);
  return e == null ? (s == null ? null : s + 30) : e;
}
// หานัดอื่นในวันเดียวกันที่เวลาทับซ้อนกัน (ข้ามนัดที่ไม่ได้ระบุเวลา)
function vpFindConflicts(date, timeStart, timeEnd, excludeId) {
  var s1 = _vpTimeToMin(timeStart);
  if (s1 == null) return [];
  var e1 = _vpEffEndMin(timeStart, timeEnd);
  return getVisitPlans().filter(function(p) {
    if (p.date !== date || p.id === excludeId || !p.timeStart) return false;
    var s2 = _vpTimeToMin(p.timeStart), e2 = _vpEffEndMin(p.timeStart, p.timeEnd);
    return s1 < e2 && s2 < e1;
  });
}
function _vpPlanLabel(p) {
  var isLead = p.sourceType === 'lead';
  var dd = (!isLead && p.dealerId) ? ST.getOne('dealers', p.dealerId) : null;
  return p.title || (isLead ? p.companyName : (dd ? dd.name : '')) || '-';
}

// การ์ด "Offline Visit เดือนนี้" ตรวจครบตามข้อกำหนดบริษัท (S/A/B ต้อง Visit อย่างน้อย 1 ครั้ง/เดือน) — ใช้
// visitCoverageForMonth (utils.js) แยก 3 กลุ่ม: ยังไม่ได้นัด (แดง ต้องรีบ) / นัดแล้วรอไป (เหลือง) / ไปแล้ว
// (เขียว) กดชื่อ Dealer ไปหน้า Dealer ได้เลย ปุ่มข้างๆ ลัดไปนัด/บันทึก Visit ทันทีไม่ต้องหา Dealer เอง
function rVisitCoverageCardHtml(vcCollapsed) {
  var monthKey = _td().substr(0, 7);
  var cov = (typeof visitCoverageForMonth === 'function') ? visitCoverageForMonth(monthKey) : [];
  if (!cov.length) return '';
  var none = cov.filter(function(c) { return c.state === 'none'; });
  var planned = cov.filter(function(c) { return c.state === 'planned'; });
  var visited = cov.filter(function(c) { return c.state === 'visited'; });
  var pct = Math.round(visited.length / cov.length * 100);
  var monthLabel = (typeof fcMonthLabel === 'function') ? fcMonthLabel(monthKey) : monthKey;

  function rowHtml(c) {
    var d = c.dealer;
    var sub = c.state === 'visited' ? ('✅ ไปเมื่อ ' + fDShort(c.lastVisit.date) + (c.visitCount > 1 ? (' (' + c.visitCount + ' ครั้ง)') : '')) :
      c.state === 'planned' ? ('📅 นัดไว้วันที่ ' + fDShort(c.nextPlan.date)) : '⚠️ ยังไม่มีแผนเลย';
    var actionBtn = c.state === 'none' ? '<button class="btn bsm bp" onclick="event.stopPropagation();showAddVisitPlanM(_td(),\'' + d.id + '\')">📅 นัดเลย</button>' :
      c.state === 'planned' ? '<button class="btn bsm bo" onclick="event.stopPropagation();showVisitM(\'' + d.id + '\')">🤝 บันทึก Visit</button>' : '';
    return '<div class="li" data-name="' + sanitize(d.name).toLowerCase() + '" style="cursor:pointer;display:flex;align-items:center;gap:8px" onclick="go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})">' +
      '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(d.name) + ' ' + levelTag(d.level) + '</div>' +
      '<div style="font-size:11px;color:var(--text2)">' + sub + '</div></div>' + actionBtn + '</div>';
  }
  function section(containerId, label, icon, list) {
    if (!list.length) return '';
    var rows = list.map(rowHtml).join('');
    var s = '<div style="margin-bottom:10px"><div style="font-size:11.5px;font-weight:700;margin-bottom:6px">' + icon + ' ' + label + ' (' + list.length + ')</div>';
    s += mondayModalListWrapHtml(containerId, rows, list.length);
    s += '</div>';
    return s;
  }

  var h = '<div class="card" id="visitCoverageCard"><h2>🏪 Offline Visit เดือนนี้ — SAB/Authorized Dealer' +
    '<span class="ml"><small style="color:var(--text2);font-weight:400">' + monthLabel + '</small></span></h2>' +
    '<div style="font-size:11.5px;color:var(--text2);margin-bottom:8px">ทุก Dealer ระดับ S/A/B ต้องมี Offline Visit อย่างน้อย 1 ครั้ง/เดือน — ' + visited.length + '/' + cov.length + ' บริษัท (' + pct + '%) ทำแล้ว</div>' +
    '<div class="pb" style="margin-bottom:12px"><div class="pf ' + (pct >= 70 ? 'pf-green' : pct >= 40 ? 'pf-yellow' : 'pf-red') + '" style="width:' + pct + '%"></div></div>' +
    section('vcNoneList', 'ยังไม่ได้นัด', '🔴', none) +
    section('vcPlannedList', 'นัดแล้ว รอไป', '🟡', planned) +
    section('vcVisitedList', 'ไปแล้ว', '🟢', visited) +
    '</div>';

  setTimeout(function() {
    if (none.length > 10) mondayListSetup('vcNoneList', 10);
    if (planned.length > 10) mondayListSetup('vcPlannedList', 10);
    if (visited.length > 10) mondayListSetup('vcVisitedList', 10);
  }, 0);
  return h;
}

function rVisitPlan(el) {
  document.getElementById('pgT').textContent = '📅 Visit Planning';

  var toolbar = '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">' +
    '<div style="display:flex;gap:4px;border:1px solid var(--border);border-radius:8px;overflow:hidden">' +
    '<button class="btn-xs" style="border-radius:0;' + (vpViewMode === 'month' ? 'background:var(--accent);color:#fff' : '') + '" onclick="vpViewMode=\'month\';render()">🗓 ปฏิทินเดือน</button>' +
    '<button class="btn-xs" style="border-radius:0;' + (vpViewMode === 'week' ? 'background:var(--accent);color:#fff' : '') + '" onclick="vpViewMode=\'week\';render()">📋 รายสัปดาห์</button>' +
    '</div>' +
    '<div style="flex:1"></div>' +
    '<button class="btn bo" onclick="showAgendaLibraryM()">📚 คลังหัวข้อ Agenda</button>' +
    '<button class="btn bo" onclick="copyVisitPlan()">📋 Copy</button>' +
    '</div>';

  el.innerHTML = rVisitCoverageCardHtml() + toolbar + (vpViewMode === 'week' ? renderVpWeekView() : renderVpMonthView());

  // Deep link จาก task.links (ดู openTaskLink ใน utils.js) — เปิดโมดัลแก้ไข plan นี้ต่อทันทีหลัง render เสร็จ
  if (S.focusPlanId) {
    var _fp = S.focusPlanId;
    S.focusPlanId = null;
    var _p = getVisitPlans().filter(function(p) { return p.id === _fp; })[0];
    if (_p) setTimeout(function() { showAddVisitPlanM(_p.date, '', _fp); }, 0);
  }
}

function renderVpWeekView() {
  var dealers = [];
  var visits = [];
  var plans = getVisitPlans();

  try { dealers = scopedDealers(); } catch(e) { dealers = []; }
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }

  var now = new Date();
  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1 + (vpWeekOffset * 7));
  weekStart.setHours(0, 0, 0, 0);
  var weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59);

  var dayNames = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

  var h = '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">';
  h += '<button class="btn bsm bo" onclick="vpWeekOffset--;render()">◀</button>';
  h += '<span style="font-weight:700;font-size:14px;min-width:180px;text-align:center">';
  h += fD(fmtDateKey(weekStart)) + ' — ' + fD(fmtDateKey(weekEnd));
  h += vpWeekOffset === 0 ? ' (สัปดาห์นี้)' : vpWeekOffset === 1 ? ' (สัปดาห์หน้า)' : '';
  h += '</span>';
  h += '<button class="btn bsm bo" onclick="vpWeekOffset++;render()">▶</button>';
  h += '<button class="btn bsm ' + (vpWeekOffset === 0 ? 'bp' : 'bo') + '" onclick="vpWeekOffset=0;render()">สัปดาห์นี้</button>';
  h += '<button class="btn bsm ' + (vpWeekOffset === 1 ? 'bp' : 'bo') + '" onclick="vpWeekOffset=1;render()">สัปดาห์หน้า</button>';
  h += '</div>';

  for (var di = 0; di < 7; di++) {
    var dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + di);
    var dayKey = fmtDateKey(dayDate);
    var isToday = dayKey === _td();
    var isWeekend = di >= 5;

    var dayVisits = (visits || []).filter(function(v) { return v.date === dayKey; });
    var dayPlans = (plans || []).filter(function(p) { return p.date === dayKey; });
    var dayMeetings = [];
    try { dayMeetings = ST.filter('meetings', function(m) { return m.date === dayKey; }); } catch(e) {}

    var suggestedDealers = [];
    if (!isWeekend && dayVisits.length === 0 && dayPlans.length === 0) {
      (dealers || []).forEach(function(d) {
        var lastVisit = null;
        (visits || []).forEach(function(v) {
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

    dayPlans.forEach(function(p) { h += vpPlanCardHtml(p); });

    dayVisits.forEach(function(v) {
      var dd = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
      h += '<div class="vp-item vp-actual">';
      h += '<span class="vp-item-icon">✅</span>';
      h += '<div class="vp-item-info">';
      h += '<div class="vp-item-dealer">' + (dd ? sanitize(dd.name) : '-') + ' <span style="font-size:10px;color:var(--text2)">(visited)</span>' +
        (dd ? ' <button style="background:transparent;border:none;color:var(--accent);cursor:pointer;padding:0;font-size:10px" onclick="event.stopPropagation();copyToClip(\'' + sanitize(dd.name).replace(/'/g, "\\'") + '\')" title="คัดลอกชื่อบริษัท">📋</button>' : '') + '</div>';
      h += '</div></div>';
    });

    dayMeetings.forEach(function(m) {
      h += '<div class="vp-item vp-meeting">';
      h += '<span class="vp-item-icon">📅</span>';
      h += '<div class="vp-item-info"><div class="vp-item-dealer">' + (m.time || '') + ' ' + sanitize(m.title || '') + '</div></div>';
      h += '</div>';
    });

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

    if (!dayPlans.length && !dayVisits.length && !dayMeetings.length && !suggestedDealers.length) {
      h += '<div class="vp-empty">' + (isWeekend ? '🏖️ วันหยุด' : 'ว่าง') + '</div>';
    }

    h += '</div>';
  }

  return h;
}

// ปฏิทินรายเดือน — เห็นทั้งเดือนในจอเดียว กดวันไหนดูรายละเอียดนัดวันนั้นด้านล่าง
function renderVpMonthView() {
  var plans = getVisitPlans();
  var now = new Date();
  var viewDate = new Date(now.getFullYear(), now.getMonth() + vpMonthOffset, 1);
  var year = viewDate.getFullYear(), month = viewDate.getMonth();
  var monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var dowShort = ['จ','อ','พ','พฤ','ศ','ส','อา'];

  var firstDay = new Date(year, month, 1);
  var startOffset = (firstDay.getDay() + 6) % 7; // จันทร์เป็นวันแรก
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var todayKey = _td();

  var h = '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">';
  h += '<button class="btn bsm bo" onclick="vpMonthOffset--;render()">◀</button>';
  h += '<span style="font-weight:700;font-size:14px;min-width:140px;text-align:center">' + monthNames[month] + ' ' + year + '</span>';
  h += '<button class="btn bsm bo" onclick="vpMonthOffset++;render()">▶</button>';
  h += '<button class="btn bsm ' + (vpMonthOffset === 0 ? 'bp' : 'bo') + '" onclick="vpMonthOffset=0;vpSelectedDay=null;render()">เดือนนี้</button>';
  h += '<button class="btn bs" onclick="showAddVisitPlanM(\'' + (vpSelectedDay || todayKey) + '\')">➕ นัดใหม่</button>';
  h += '</div>';

  h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px">';
  dowShort.forEach(function(dn) { h += '<div style="font-size:10px;color:var(--text2);text-align:center;padding:4px 0">' + dn + '</div>'; });

  for (var i = 0; i < startOffset; i++) h += '<div></div>';

  for (var day = 1; day <= daysInMonth; day++) {
    var dKey = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var dayPlans = plans.filter(function(p) { return p.date === dKey; }).sort(function(a, b) {
      var ta = _vpTimeToMin(a.timeStart), tb = _vpTimeToMin(b.timeStart);
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    });
    var isToday = dKey === todayKey;
    var isSelected = dKey === vpSelectedDay;

    // กล่องวันที่ — สูงคงที่ทุกช่อง (vp-day-cell, ดู style.css) กันแถวเตี้ย/สูงไม่เท่ากันตอนบางวันมีนัดเยอะ
    // ข้อความแต่ละนัดตัดด้วย ellipsis พอดีช่อง ต้องการดูเต็มให้ hover เอา (title=) หรือคลิกกล่องเพื่อดูรายละเอียดด้านล่าง
    h += '<div class="vp-day-cell' + (isSelected ? ' sel' : (isToday ? ' today' : '')) + '" onclick="vpSelectedDay=\'' + dKey + '\';render()">';
    h += '<div class="vp-day-cell-num' + (isToday ? ' today' : '') + '">' + day + '</div>';
    var maxShow = 2;
    dayPlans.slice(0, maxShow).forEach(function(p) {
      var hasConflict = vpFindConflicts(p.date, p.timeStart, p.timeEnd, p.id).length > 0;
      var c = hasConflict ? '#ef4444' : (p.mode === 'offline' ? '#f59e0b' : '#3b82f6');
      var fullLabel = (p.mode === 'offline' ? '🤝' : '📞') + (p.timeStart ? ' ' + p.timeStart : '') + ' ' + (_vpPlanLabel(p) || '') + (hasConflict ? ' ⚠️ ชนเวลา' : '');
      h += '<div class="vp-day-cell-item" style="color:' + c + ';border-left-color:' + c + '" title="' + sanitize(fullLabel) + '">' + sanitize(fullLabel) + '</div>';
    });
    if (dayPlans.length > maxShow) h += '<div class="vp-day-cell-more">+' + (dayPlans.length - maxShow) + ' เพิ่มเติม</div>';
    h += '</div>';
  }
  h += '</div>';

  var selKey = vpSelectedDay || todayKey;
  var selDate = new Date(selKey);
  var selDayName = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'][selDate.getDay()];
  var selPlans = plans.filter(function(p) { return p.date === selKey; }).sort(function(a, b) {
    var ta = _vpTimeToMin(a.timeStart), tb = _vpTimeToMin(b.timeStart);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });

  h += '<div style="font-size:12px;font-weight:700;margin-bottom:8px">📅 ' + selDayName + ' ' + fDShort(selKey) + (selKey === todayKey ? ' (วันนี้)' : '') + ' — ' + selPlans.length + ' นัด</div>';

  if (!selPlans.length) {
    h += '<div class="vp-empty">ยังไม่มีนัดวันนี้ — กด "➕ นัดใหม่" ด้านบนได้เลย</div>';
  } else {
    selPlans.forEach(function(p) {
      var conflicts = vpFindConflicts(p.date, p.timeStart, p.timeEnd, p.id);
      h += vpPlanCardHtml(p, true, conflicts);
    });
  }

  return h;
}

// การ์ดนัด 1 รายการ — ใช้ทั้งใน week view (ย่อ) และ month-day-detail (เต็ม fullDetail=true)
// conflicts: array ของนัดอื่นที่เวลาทับซ้อนกัน (คำนวณจาก vpFindConflicts ก่อนเรียก)
function vpPlanCardHtml(p, fullDetail, conflicts) {
  var isLead = p.sourceType === 'lead';
  var dd = (!isLead && p.dealerId) ? ST.getOne('dealers', p.dealerId) : null;
  var company = isLead ? (p.companyName || '-') : (dd ? dd.name : (p.note || '-'));
  var contact = isLead ? p.contactName : (dd ? (dd.contact || '') : '');
  var phone = isLead ? p.phone : (dd ? (dd.phone || '') : '');
  var email = isLead ? p.email : (dd ? (dd.email || '') : '');
  var location = isLead ? p.location : (dd ? (dd.googleMap || '') : '');
  var timeLabel = p.timeStart ? (p.timeStart + (p.timeEnd ? '–' + p.timeEnd : '')) : '';
  var hasConflict = conflicts && conflicts.length > 0;

  if (!fullDetail) {
    // week view — แบบย่อเหมือนเดิม แต่เพิ่มเวลา/หัวข้อนัด/badge สถานะ
    var h = '<div class="vp-item' + (p.status === 'done' ? ' vp-actual' : '') + '"' + (hasConflict ? ' style="border-left:2px solid #ef4444"' : '') + '>';
    h += '<span class="vp-item-icon">' + (p.mode === 'offline' ? '🤝' : '📞') + '</span>';
    h += '<div class="vp-item-info">';
    h += '<div class="vp-item-dealer">' + (timeLabel ? '<span style="color:var(--text2)">' + timeLabel + '</span> ' : '') + sanitize(p.title || company) + (hasConflict ? ' ⚠️' : '') + '</div>';
    h += '<div class="vp-item-note">🏢 ' + sanitize(company) + (isLead ? ' 🆕' : '') + ' <button style="background:transparent;border:none;color:var(--accent);cursor:pointer;padding:0;font-size:10px" onclick="event.stopPropagation();copyToClip(\'' + sanitize(company).replace(/'/g, "\\'") + '\')" title="คัดลอกชื่อบริษัท">📋</button></div>';
    if (p.status === 'done') h += '<div class="vp-item-note" style="color:#22c55e">✅ บันทึกผลแล้ว</div>';
    h += '</div>';
    h += '<div class="vp-item-actions">';
    if (!isLead && dd) h += '<button class="btn-xs" onclick="event.stopPropagation();vpGoVisit(\'' + p.id + '\')" title="บันทึก Visit Report">📍</button>';
    if (isLead && p.status !== 'done') h += '<button class="btn-xs" onclick="event.stopPropagation();showVpLeadActualM(\'' + p.id + '\')" title="บันทึกผล">📍</button>';
    if (isLead && p.status === 'done' && p.visitId) h += '<button class="btn-xs" onclick="event.stopPropagation();go(\'visitDetail\',{visitId:\'' + p.visitId + '\'})" title="ดู Visit Report">📝</button>';
    h += '<button class="btn-xs" onclick="event.stopPropagation();showVpEmailM(\'' + p.id + '\')" title="ส่ง Email นัด">📧</button>';
    h += '<button class="btn-xs" onclick="event.stopPropagation();showAddVisitPlanM(\'' + p.date + '\',\'\',\'' + p.id + '\')" title="แก้ไข">✏️</button>';
    h += '<button class="btn-xs btn-red" onclick="event.stopPropagation();removeVisitPlan(\'' + p.id + '\')" title="ลบ">✕</button>';
    h += '</div></div>';
    return h;
  }

  // month view day-detail — เต็มรูปแบบ มีก็อปปี้
  var modeBadge = p.mode === 'offline' ?
    '<span style="background:rgba(245,158,11,.18);color:#fbbf24;font-size:10px;padding:2px 8px;border-radius:6px">🤝 Offline</span>' :
    '<span style="background:rgba(59,130,246,.18);color:#60a5fa;font-size:10px;padding:2px 8px;border-radius:6px">📞 Online</span>';
  var statusBadge = p.status === 'done' ?
    '<span style="background:rgba(34,197,94,.18);color:#4ade80;font-size:10px;padding:2px 8px;border-radius:6px;margin-left:4px">✅ บันทึกผลแล้ว</span>' : '';
  var sourceBadge = isLead ?
    '<span style="background:rgba(239,68,68,.15);color:#f87171;padding:1px 6px;border-radius:5px;font-size:9px">🆕 Lead ใหม่</span>' :
    '<span style="background:rgba(59,130,246,.15);color:#60a5fa;padding:1px 6px;border-radius:5px;font-size:9px">Dealer ปัจจุบัน</span>';

  var borderColor = hasConflict ? '#ef4444' : (p.status === 'done' ? 'rgba(34,197,94,.4)' : (p.mode === 'offline' ? '#f59e0b' : '#3b82f6'));

  var h2 = '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-left:3px solid ' + borderColor + ';border-radius:10px;padding:12px;margin-bottom:8px">';
  h2 += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:4px">';
  h2 += '<span style="font-size:13px;font-weight:700">' + (timeLabel ? '🕐 ' + timeLabel + ' · ' : '') + sanitize(p.title || company) + '</span>';
  h2 += '<span>' + modeBadge + statusBadge + '</span>';
  h2 += '</div>';
  if (hasConflict) {
    h2 += '<div style="background:rgba(239,68,68,.15);border-left:3px solid #ef4444;border-radius:0;padding:6px 8px;font-size:11px;color:#f87171;margin-bottom:8px">⚠️ ชนเวลากับ: ' +
      conflicts.map(function(c) { return sanitize(_vpPlanLabel(c)) + ' (' + c.timeStart + (c.timeEnd ? '–' + c.timeEnd : '') + ')'; }).join(', ') + '</div>';
  }
  h2 += '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--text2);margin-bottom:8px">';
  h2 += '<span style="display:flex;align-items:center;gap:4px">🏢 <span style="color:var(--text)">' + sanitize(company) + '</span> <button style="background:transparent;border:none;color:var(--accent);cursor:pointer;padding:0" onclick="copyToClip(\'' + sanitize(company).replace(/'/g, "\\'") + '\')" title="คัดลอกชื่อบริษัท">📋</button> ' + sourceBadge + '</span>';
  if (contact) h2 += '<span>👤 <span style="color:var(--text)">' + sanitize(contact) + '</span></span>';
  h2 += '</div>';
  if (phone || email || location) {
    h2 += '<div style="display:flex;flex-wrap:wrap;gap:14px;font-size:11px;margin-bottom:8px">';
    if (phone) h2 += '<span style="display:flex;align-items:center;gap:4px">📞 ' + sanitize(phone) + ' <button style="background:transparent;border:none;color:var(--accent);cursor:pointer;padding:0" onclick="copyToClip(\'' + sanitize(phone).replace(/'/g, "\\'") + '\')">📋</button></span>';
    if (email) h2 += '<span style="display:flex;align-items:center;gap:4px">✉️ ' + sanitize(email) + ' <button style="background:transparent;border:none;color:var(--accent);cursor:pointer;padding:0" onclick="copyToClip(\'' + sanitize(email).replace(/'/g, "\\'") + '\')">📋</button></span>';
    if (location) h2 += '<span style="display:flex;align-items:center;gap:4px">📍 ' + sanitize(location) + ' <button style="background:transparent;border:none;color:var(--accent);cursor:pointer;padding:0" onclick="copyToClip(\'' + sanitize(location).replace(/'/g, "\\'") + '\')">📋</button>' + (/^https?:\/\//.test(location) ? ' <a href="' + sanitize(location) + '" target="_blank" style="color:var(--accent)">เปิดแผนที่↗</a>' : '') + '</span>';
    h2 += '</div>';
  }
  if (p.note) h2 += '<div style="background:var(--bg,#0f172a);border-radius:8px;padding:8px;font-size:11px;color:var(--text2);margin-bottom:8px">' + sanitize(p.note) + '</div>';
  if (p.actual && p.actual.note) h2 += '<div style="background:var(--bg,#0f172a);border-radius:8px;padding:8px;font-size:11px;margin-bottom:8px"><strong style="color:#4ade80">ผลการนัด:</strong> ' + sanitize(p.actual.note) + '</div>';
  if (p.agenda && p.agenda.length) {
    h2 += '<div style="background:var(--bg,#0f172a);border-radius:8px;padding:8px;margin-bottom:8px">';
    h2 += '<div style="font-size:11px;font-weight:700;margin-bottom:4px">📋 Agenda</div>';
    p.agenda.forEach(function(a, ai) {
      h2 += '<label style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;font-size:11.5px;cursor:pointer">';
      h2 += '<input type="checkbox" style="margin-top:2px" ' + (a.done ? 'checked' : '') + ' onchange="event.stopPropagation();vpToggleAgendaDone(\'' + p.id + '\',' + ai + ',this.checked)">';
      h2 += '<span style="flex:1' + (a.done ? ';text-decoration:line-through;color:var(--text2)' : '') + '">' + sanitize(a.text);
      if (a.srcType) h2 += ' <button style="background:transparent;border:none;color:var(--accent);cursor:pointer;padding:0;font-size:10.5px" onclick="event.stopPropagation();openAgendaSource(\'' + (!isLead && p.dealerId ? p.dealerId : '') + '\',\'' + a.srcType + '\',\'' + sanitize(a.srcValue || '').replace(/'/g, "\\'") + '\')">🔗 เปิด</button>';
      h2 += '</span></label>';
    });
    h2 += '</div>';
  }

  h2 += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  if (!isLead && dd && p.status !== 'done') h2 += '<button class="btn bsm bp" onclick="vpGoVisit(\'' + p.id + '\')">📝 เปิด Visit Report สำหรับนัดนี้</button>';
  if (isLead && p.status !== 'done') h2 += '<button class="btn bsm bp" onclick="vpGoVisitLead(\'' + p.id + '\')">📝 สร้าง Visit Report</button>';
  if (p.status === 'done' && p.visitId) h2 += '<button class="btn bsm bo" onclick="go(\'visitDetail\',{visitId:\'' + p.visitId + '\'})">📝 ดู Visit Report →</button>';
  if (isLead && p.status !== 'done') h2 += '<button class="btn bsm bs" onclick="vpQuickMarkAttended(\'' + p.id + '\')" title="ไปตามนัดแล้ว ไม่มีโน้ตเพิ่ม">✅ ไปตามนัด</button>';
  if (isLead && p.status !== 'done') h2 += '<button class="btn bsm bo" onclick="showVpLeadActualM(\'' + p.id + '\')">📍 บันทึกผลการนัด (เลื่อน/ยกเลิก/ใส่โน้ต)</button>';
  if (isLead) h2 += '<button class="btn bsm bo" onclick="vpConvertLeadToDealer(\'' + p.id + '\')">➕ แปลงเป็น Dealer</button>';
  if (p.status && p.status !== 'planned') h2 += '<button class="btn bsm bo" onclick="resetVisitPlanStatus(\'' + p.id + '\')" title="กดผลผิด / อยากย้อนกลับเป็นวางแผนไว้">↩️ ยกเลิกผล</button>';
  h2 += '<button class="btn bsm bo" onclick="showVpEmailM(\'' + p.id + '\')">📧 ส่ง Email นัด</button>';
  h2 += '<button class="btn bsm bo" onclick="showAddVisitPlanM(\'' + p.date + '\',\'\',\'' + p.id + '\')">✏️ แก้ไข</button>';
  h2 += '<button class="btn bsm bd" onclick="removeVisitPlan(\'' + p.id + '\')">🗑️ ลบ</button>';
  h2 += '</div></div>';
  return h2;
}

function showVpEmailM(planId) {
  var plans = getVisitPlans();
  var p = null;
  for (var i = 0; i < plans.length; i++) { if (plans[i].id === planId) { p = plans[i]; break; } }
  if (!p) return;

  var isLead = p.sourceType === 'lead';
  var dd = (!isLead && p.dealerId) ? ST.getOne('dealers', p.dealerId) : null;
  var company  = isLead ? (p.companyName || '') : (dd ? dd.name : '');
  var contact  = isLead ? (p.contactName || '') : (dd ? (dd.contact || '') : '');
  var toEmail  = isLead ? (p.email || '') : (dd ? (dd.email || '') : '');
  var timeStr  = p.timeStart ? (p.timeStart + (p.timeEnd ? ' – ' + p.timeEnd : '') + ' น.') : '';
  var modeStr  = p.mode === 'online' ? 'Online (โทร/VDO Call)' : ('Offline' + (p.location ? ' — ' + p.location : ''));
  var dateStr  = p.date ? fDShort(p.date) : '';

  var subject = 'นัดพบ — ' + (p.title || company) + (dateStr ? ' วันที่ ' + dateStr : '');
  var body = 'เรียน ' + (contact ? 'คุณ' + contact : 'ทีมงาน') + '\n\n'
    + (p.title ? 'ขอนัดพบเพื่อ' + p.title + '\n\n' : '')
    + 'วันที่: ' + (dateStr || '-') + '\n'
    + (timeStr ? 'เวลา: ' + timeStr + '\n' : '')
    + 'รูปแบบ: ' + modeStr + '\n'
    + (p.note ? '\nรายละเอียดเพิ่มเติม: ' + p.note + '\n' : '')
    + '\nกรุณายืนยันการนัดด้วยนะครับ/ค่ะ'
    + '\nหากมีข้อสงสัยประการใด กรุณาติดต่อกลับได้เลย\n\n'
    + 'ขอบคุณครับ\n'
    + 'SIS Distribution (Thailand) Public Company Limited';

  var h = '<div style="max-width:520px">';
  h += '<div class="fm-group"><label>📨 ถึง (To)</label><input type="email" id="vp_email_to" class="fm-input" value="' + sanitize(toEmail) + '" placeholder="email@example.com"></div>';
  h += '<div class="fm-group"><label>📌 หัวข้อ (Subject)</label><input type="text" id="vp_email_subj" class="fm-input" value="' + sanitize(subject) + '"></div>';
  h += '<div class="fm-group"><label>📝 เนื้อหา (แก้ไขได้)</label><textarea id="vp_email_body" class="fm-input" rows="10" style="font-size:13px;line-height:1.6">' + sanitize(body) + '</textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="vpOpenMailto()">📬 เปิด Email Client</button>';
  h += '<button class="btn bo" onclick="vpCopyEmailBody()">📋 คัดลอกเนื้อหา</button>';
  h += '<button class="btn" onclick="closeM()">ปิด</button>';
  h += '</div></div>';
  openM('📧 ส่ง Email นัด — ' + sanitize(company || p.title || ''), h);
}

function vpOpenMailto() {
  var to   = (document.getElementById('vp_email_to')   || {}).value || '';
  var subj = (document.getElementById('vp_email_subj') || {}).value || '';
  var body = (document.getElementById('vp_email_body') || {}).value || '';
  var url = 'mailto:' + encodeURIComponent(to)
    + '?subject=' + encodeURIComponent(subj)
    + '&body='    + encodeURIComponent(body);
  window.open(url);
}

function vpCopyEmailBody() {
  var body = (document.getElementById('vp_email_body') || {}).value || '';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(body).then(function() { toast('📋 คัดลอกแล้ว'); });
  } else {
    var ta = document.getElementById('vp_email_body');
    if (ta) { ta.select(); document.execCommand('copy'); toast('📋 คัดลอกแล้ว'); }
  }
}

function getVisitPlans() {
  var saved = localStorage.getItem('v7_visitPlans');
  if (!saved) return [];
  try {
    var plans = JSON.parse(saved) || [];
    plans.forEach(function(p) { if (p.date) p.date = _vpNormalizeDate(p.date); });
    return plans;
  } catch(e) { return []; }
}

function saveVisitPlans(list) {
  localStorage.setItem('v7_visitPlans', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('visitPlans', list);
}

// ================================================================
// VISIT AGENDA — คลังหัวข้อ Agenda ส่วนกลาง (ใช้ซ้ำได้ทุก Dealer) เลือกติ๊กใส่ Visit Plan ได้ หรือพิมพ์เฉพาะ
// Dealer นั้นเองก็ได้ — แต่ละหัวข้อแนบ "แหล่งข้อมูล" ได้ (ลิงก์ไปหน้า Dealer แท็บต่างๆ ในแอป หรือ URL ภายนอก
// เช่น ไฟล์ Presentation/Promotion) กดเปิดพูดได้เลยตอนถึงหน้างาน ไม่ต้องสลับหาเมนูเอง (ผู้ใช้ขอ 2026-08-27)
// agenda ที่บันทึกลง Visit Plan เป็นการ "คัดลอกค่า" ตอนเลือกใช้ ไม่ผูกกับ template ต้นฉบับอีก — แก้ template
// ทีหลังไม่กระทบ Visit Plan ที่บันทึกไปแล้ว
// ================================================================
var AGENDA_SOURCE_TYPES = [
  { id: 'pipeline',  label: '📊 เปิด Pipeline ของ Dealer',       tab: 'pipeline' },
  { id: 'quotation', label: '💰 เปิดใบเสนอราคาของ Dealer',        tab: 'quotation' },
  { id: 'demo',      label: '🚁 เปิด Demo Unit ของ Dealer',       tab: 'demo' },
  { id: 'so',        label: '📦 เปิด Sales Order ของ Dealer',     tab: 'so' },
  { id: 'forecast',  label: '📦 เปิด Forecast ของ Dealer',        tab: 'forecast' },
  { id: 'timeline',  label: '📝 เปิด Timeline ของ Dealer',        tab: 'timeline' },
  { id: 'info',      label: '📋 เปิดข้อมูล Dealer',               tab: 'info' }
];

function _agendaGenId() { return 'ag_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

// ชุดหัวข้อตัวอย่างที่น่าจะได้ใช้จริงกับทีมขายโดรน/Dealer — สร้างให้ครั้งแรกที่ยังไม่มีคลังเลยเท่านั้น
// (ผู้ใช้แก้/ลบ/เพิ่มเองได้ทั้งหมดทีหลังผ่าน showAgendaLibraryM)
function _agendaDefaultTemplates() {
  return [
    { id: 'tpl_monthly', name: 'เยี่ยมประจำเดือน', icon: '🗓️', topics: [
      { id: _agendaGenId(), text: 'เช็คสถานะ Demo Unit ที่ยืมไป', sub: '', srcType: 'demo', srcValue: '' },
      { id: _agendaGenId(), text: 'อัปเดต Promotion / ราคาสินค้าใหม่ไตรมาสนี้', sub: '', srcType: '', srcValue: '' },
      { id: _agendaGenId(), text: 'เช็คสต็อกคงเหลือหน้าร้าน', sub: '', srcType: '', srcValue: '' }
    ]},
    { id: 'tpl_newproduct', name: 'เปิดตัวสินค้าใหม่', icon: '🚀', topics: [
      { id: _agendaGenId(), text: 'แนะนำสินค้าใหม่ให้ทีมปฏิบัติการ', sub: '', srcType: '', srcValue: '' },
      { id: _agendaGenId(), text: 'อัปเดต Promotion / ราคาสินค้าใหม่ไตรมาสนี้', sub: '', srcType: '', srcValue: '' },
      { id: _agendaGenId(), text: 'ถามแผนสั่งซื้อไตรมาสหน้า', sub: '', srcType: 'pipeline', srcValue: '' }
    ]},
    { id: 'tpl_debt', name: 'ตามหนี้ค้างชำระ', icon: '⚠️', topics: [
      { id: _agendaGenId(), text: 'แจ้งยอดค้างชำระ + ขอวันที่ชัดเจน', sub: '', srcType: 'so', srcValue: '' },
      { id: _agendaGenId(), text: 'เสนอเงื่อนไขผ่อนชำระถ้าจำเป็น', sub: '', srcType: '', srcValue: '' }
    ]},
    { id: 'tpl_closedeal', name: 'ปิดดีล Pipeline', icon: '🤝', topics: [
      { id: _agendaGenId(), text: 'ทวนสเปค/ราคาล่าสุดของโครงการที่ค้างอยู่', sub: '', srcType: 'pipeline', srcValue: '' },
      { id: _agendaGenId(), text: 'ยื่นใบเสนอราคาล่าสุด / เช็คว่าถึงมือผู้อนุมัติหรือยัง', sub: '', srcType: 'quotation', srcValue: '' },
      { id: _agendaGenId(), text: 'ถามวันที่คาดว่าจะได้ PO', sub: '', srcType: '', srcValue: '' }
    ]},
    { id: 'tpl_newdealer', name: 'Dealer ใหม่ (Visit แรก)', icon: '🆕', topics: [
      { id: _agendaGenId(), text: 'แนะนำโครงสร้างทีม/ช่องทางติดต่อของเรา', sub: '', srcType: '', srcValue: '' },
      { id: _agendaGenId(), text: 'อธิบายเงื่อนไข Level ตัวแทนจำหน่าย', sub: '', srcType: 'info', srcValue: '' },
      { id: _agendaGenId(), text: 'เก็บข้อมูลผู้ติดต่อหลัก + ผู้มีอำนาจอนุมัติ', sub: '', srcType: 'info', srcValue: '' },
      { id: _agendaGenId(), text: 'นัดวัน Training สินค้าเบื้องต้น', sub: '', srcType: '', srcValue: '' }
    ]},
    { id: 'tpl_training', name: 'อบรมสินค้า / Training', icon: '🎓', topics: [
      { id: _agendaGenId(), text: 'สาธิตการใช้งานสินค้าหลัก', sub: '', srcType: 'demo', srcValue: '' },
      { id: _agendaGenId(), text: 'ทบทวนขั้นตอน Maintenance เบื้องต้น', sub: '', srcType: '', srcValue: '' },
      { id: _agendaGenId(), text: 'ตอบคำถามทีมช่างหน้างาน', sub: '', srcType: '', srcValue: '' }
    ]},
    { id: 'tpl_review', name: 'รีวิวยอดขายไตรมาส', icon: '📊', topics: [
      { id: _agendaGenId(), text: 'สรุปยอดขายเทียบเป้าไตรมาสที่ผ่านมา', sub: '', srcType: 'forecast', srcValue: '' },
      { id: _agendaGenId(), text: 'ตั้งเป้ายอดขายไตรมาสหน้าร่วมกัน', sub: '', srcType: '', srcValue: '' },
      { id: _agendaGenId(), text: 'สอบถามแผนงบประมาณจัดซื้อปีถัดไป', sub: '', srcType: '', srcValue: '' }
    ]}
  ];
}

function getAgendaTemplates() {
  var saved = localStorage.getItem('v7_agendaTemplates');
  if (!saved) {
    var defaults = _agendaDefaultTemplates();
    saveAgendaTemplates(defaults);
    return defaults;
  }
  try { return JSON.parse(saved) || []; } catch(e) { return []; }
}
function saveAgendaTemplates(list) {
  localStorage.setItem('v7_agendaTemplates', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('agendaTemplates', list);
}

function _agendaSourceLabel(srcType) {
  var t = AGENDA_SOURCE_TYPES.filter(function(x) { return x.id === srcType; })[0];
  return t ? t.label : '';
}

// เปิดแหล่งข้อมูลของหัวข้อ agenda — 'external' เปิด URL ในแท็บใหม่ / อื่นๆ พาไปหน้า Dealer แท็บที่ตรงกัน
// (agenda ของนัด Lead ที่ไม่ผูก Dealer จะไม่มีปุ่มนี้ให้กด เพราะไม่มี dealerId ให้ไปเปิด)
function openAgendaSource(dealerId, srcType, srcValue) {
  if (srcType === 'external') {
    if (srcValue) window.open(srcValue, '_blank');
    return;
  }
  var meta = AGENDA_SOURCE_TYPES.filter(function(x) { return x.id === srcType; })[0];
  if (!meta || !dealerId) return;
  dealerTab = meta.tab;
  go('dealerDetail', { dealerId: dealerId });
}

// ---- คลังหัวข้อ Agenda (จัดการชุด/หัวข้อ) ----
function showAgendaLibraryM() {
  var templates = getAgendaTemplates();
  var h = '<div style="max-width:560px">';
  h += '<p style="font-size:.75rem;color:var(--text2);margin-bottom:10px">ชุดหัวข้อที่ใช้ร่วมกันได้ทุก Dealer — แก้ไข ทำสำเนา หรือสร้างชุดใหม่ได้อิสระ ไม่กระทบ Agenda ที่บันทึกเข้า Visit Plan ไปแล้ว (คัดลอกค่าไว้ตอนเลือกใช้ ไม่ผูกกับต้นฉบับอีก)</p>';
  h += '<div style="max-height:60vh;overflow-y:auto">';
  if (!templates.length) h += '<div class="empty"><p>ยังไม่มีชุดหัวข้อเลย — สร้างชุดแรกด้านล่าง</p></div>';
  templates.forEach(function(tpl) {
    h += '<div class="card" style="margin-bottom:10px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">';
    h += '<div style="font-weight:700;font-size:13px">' + (tpl.icon || '📋') + ' ' + sanitize(tpl.name) + ' <span style="font-weight:400;color:var(--text2);font-size:11px">(' + tpl.topics.length + ' หัวข้อ)</span></div>';
    h += '<div style="display:flex;gap:4px">';
    h += '<button class="btn btn-xs bo" onclick="_agendaRenameTpl(\'' + tpl.id + '\')">✏️ เปลี่ยนชื่อ</button>';
    h += '<button class="btn btn-xs bo" onclick="_agendaDupTpl(\'' + tpl.id + '\')">⧉ ทำสำเนา</button>';
    h += '<button class="btn btn-xs bd" onclick="_agendaDelTpl(\'' + tpl.id + '\')">🗑️</button>';
    h += '</div></div>';
    tpl.topics.forEach(function(t, idx) {
      h += '<div class="li" style="display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:default">';
      h += '<div><div class="lt">' + sanitize(t.text) + '</div>' + (t.srcType ? '<div class="ls" style="color:var(--accent)">' + sanitize(t.srcType === 'external' ? ('🔗 ' + (t.srcValue || 'ลิงก์ภายนอก')) : _agendaSourceLabel(t.srcType)) + '</div>' : '') + '</div>';
      h += '<div style="display:flex;gap:4px;flex-shrink:0"><button class="btn btn-xs bo" onclick="_agendaEditTopicM(\'' + tpl.id + '\',' + idx + ')">✏️</button><button class="btn btn-xs bd" onclick="_agendaDelTopic(\'' + tpl.id + '\',' + idx + ')">🗑️</button></div>';
      h += '</div>';
    });
    h += '<div style="display:flex;gap:6px;margin-top:8px"><input type="text" id="agenda_newtopic_' + tpl.id + '" placeholder="+ เพิ่มหัวข้อ..." style="flex:1"><button class="btn btn-sm bp" onclick="_agendaAddTopic(\'' + tpl.id + '\')">เพิ่ม</button></div>';
    h += '</div>';
  });
  h += '</div>';
  h += '<div style="display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><input type="text" id="agenda_newtpl_name" placeholder="ชื่อชุดใหม่..." style="flex:1"><button class="btn bp" onclick="_agendaAddTpl()">➕ สร้างชุดใหม่</button></div>';
  h += '</div>';
  openM('📚 คลังหัวข้อ Agenda', h);
}
function _agendaAddTpl() {
  var input = document.getElementById('agenda_newtpl_name');
  var name = ((input && input.value) || '').trim();
  if (!name) { toast('กรอกชื่อชุดก่อน'); return; }
  var templates = getAgendaTemplates();
  templates.push({ id: _agendaGenId(), name: name, icon: '📋', topics: [] });
  saveAgendaTemplates(templates);
  showAgendaLibraryM();
}
function _agendaRenameTpl(tplId) {
  var templates = getAgendaTemplates();
  var tpl = templates.filter(function(t) { return t.id === tplId; })[0];
  if (!tpl) return;
  var name = prompt('ชื่อชุดใหม่:', tpl.name);
  if (!name || !name.trim()) return;
  tpl.name = name.trim();
  saveAgendaTemplates(templates);
  showAgendaLibraryM();
}
function _agendaDupTpl(tplId) {
  var templates = getAgendaTemplates();
  var tpl = templates.filter(function(t) { return t.id === tplId; })[0];
  if (!tpl) return;
  var copy = JSON.parse(JSON.stringify(tpl));
  copy.id = _agendaGenId();
  copy.name = tpl.name + ' (สำเนา)';
  copy.topics.forEach(function(t) { t.id = _agendaGenId(); });
  templates.push(copy);
  saveAgendaTemplates(templates);
  toast('⧉ ทำสำเนาแล้ว');
  showAgendaLibraryM();
}
function _agendaDelTpl(tplId) {
  if (!confirm('ลบชุดหัวข้อนี้ทั้งหมด?')) return;
  var templates = getAgendaTemplates().filter(function(t) { return t.id !== tplId; });
  saveAgendaTemplates(templates);
  showAgendaLibraryM();
}
function _agendaAddTopic(tplId) {
  var input = document.getElementById('agenda_newtopic_' + tplId);
  var text = ((input && input.value) || '').trim();
  if (!text) return;
  var templates = getAgendaTemplates();
  var tpl = templates.filter(function(t) { return t.id === tplId; })[0];
  if (!tpl) return;
  tpl.topics.push({ id: _agendaGenId(), text: text, sub: '', srcType: '', srcValue: '' });
  saveAgendaTemplates(templates);
  showAgendaLibraryM();
}
function _agendaDelTopic(tplId, idx) {
  var templates = getAgendaTemplates();
  var tpl = templates.filter(function(t) { return t.id === tplId; })[0];
  if (!tpl) return;
  tpl.topics.splice(idx, 1);
  saveAgendaTemplates(templates);
  showAgendaLibraryM();
}
function _agendaEditTopicM(tplId, idx) {
  var templates = getAgendaTemplates();
  var tpl = templates.filter(function(t) { return t.id === tplId; })[0];
  if (!tpl) return;
  var topic = tpl.topics[idx];
  if (!topic) return;
  var h = '<div class="fm-group"><label>ข้อความหัวข้อ</label><input type="text" id="agedit_text" class="fm-input" value="' + sanitize(topic.text) + '"></div>';
  h += '<div class="fm-group"><label>หมายเหตุเสริม (ไม่บังคับ)</label><input type="text" id="agedit_sub" class="fm-input" value="' + sanitize(topic.sub || '') + '"></div>';
  h += '<div class="fm-group"><label>แหล่งข้อมูลประกอบ (ไม่บังคับ)</label><select id="agedit_srctype" class="fm-input" onchange="document.getElementById(\'agedit_srcurl_wrap\').style.display=this.value===\'external\'?\'\':\'none\'">';
  h += '<option value="">— ไม่แนบ —</option>';
  h += '<option value="external"' + (topic.srcType === 'external' ? ' selected' : '') + '>🔗 ลิงก์ภายนอก (วาง URL เอง)</option>';
  AGENDA_SOURCE_TYPES.forEach(function(s) { h += '<option value="' + s.id + '"' + (topic.srcType === s.id ? ' selected' : '') + '>' + s.label + '</option>'; });
  h += '</select></div>';
  h += '<div class="fm-group" id="agedit_srcurl_wrap" style="' + (topic.srcType === 'external' ? '' : 'display:none') + '"><label>URL</label><input type="text" id="agedit_srcurl" class="fm-input" value="' + sanitize(topic.srcType === 'external' ? (topic.srcValue || '') : '') + '" placeholder="https://..."></div>';
  h += '<div class="fm-actions"><button class="btn bp" onclick="_agendaSaveTopicEdit(\'' + tplId + '\',' + idx + ')">💾 บันทึก</button><button class="btn" onclick="showAgendaLibraryM()">ยกเลิก</button></div>';
  openM('✏️ แก้ไขหัวข้อ', h);
}
function _agendaSaveTopicEdit(tplId, idx) {
  var templates = getAgendaTemplates();
  var tpl = templates.filter(function(t) { return t.id === tplId; })[0];
  if (!tpl) return;
  var topic = tpl.topics[idx];
  if (!topic) return;
  var text = (document.getElementById('agedit_text').value || '').trim();
  if (!text) { toast('กรอกข้อความหัวข้อก่อน'); return; }
  topic.text = text;
  topic.sub = (document.getElementById('agedit_sub').value || '').trim();
  var srcType = document.getElementById('agedit_srctype').value || '';
  topic.srcType = srcType;
  topic.srcValue = srcType === 'external' ? (document.getElementById('agedit_srcurl').value || '').trim() : '';
  saveAgendaTemplates(templates);
  showAgendaLibraryM();
}

// ---- ตัว Agenda ที่กำลังแก้ในฟอร์ม Visit Plan (state ชั่วคราวระหว่างเปิด modal) ----
var _vpAgendaWorking = [];
function _vpAgendaListHtml() {
  if (!_vpAgendaWorking.length) return '<div style="color:var(--text2);font-size:11.5px;padding:8px 0">ยังไม่มีหัวข้อ — เลือกชุดสำเร็จรูปด้านบน หรือเพิ่มเองด้านล่าง</div>';
  return _vpAgendaWorking.map(function(t, idx) {
    return '<label style="display:flex;align-items:flex-start;gap:8px;padding:5px 4px;border-radius:6px;cursor:pointer" onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">' +
      '<input type="checkbox" style="margin-top:3px" ' + (t.included ? 'checked' : '') + ' onchange="_vpAgendaToggle(' + idx + ',this.checked)">' +
      '<span style="flex:1;font-size:12.5px' + (t.included ? '' : ';color:var(--text2)') + '">' + sanitize(t.text) +
      (t.sub ? '<span style="display:block;color:var(--text2);font-size:11px">' + sanitize(t.sub) + '</span>' : '') +
      (t.srcType ? '<span style="display:block;color:var(--accent);font-size:11px">' + (t.srcType === 'external' ? ('🔗 ' + sanitize(t.srcValue || 'ลิงก์ภายนอก')) : sanitize(_agendaSourceLabel(t.srcType))) + '</span>' : '') +
      '</span>' +
      '<button type="button" style="background:transparent;border:none;color:var(--text2);cursor:pointer;padding:0;font-size:12px;flex-shrink:0" onclick="event.preventDefault();_vpAgendaRemove(' + idx + ')" title="ลบออกจากนัดนี้">✕</button>' +
      '</label>';
  }).join('');
}
function _vpAgendaRerender() {
  var el = document.getElementById('vp_agenda_list');
  if (el) el.innerHTML = _vpAgendaListHtml();
}
// เลือกชุดสำเร็จรูป — เติมหัวข้อที่ยังไม่มี (เทียบด้วยข้อความ) ต่อท้าย ไม่ล้างของเดิม/ที่พิมพ์เพิ่มเองทิ้ง
function _vpApplyTemplate(tplId) {
  var templates = getAgendaTemplates();
  var tpl = templates.filter(function(t) { return t.id === tplId; })[0];
  if (!tpl) return;
  var existingTexts = {};
  _vpAgendaWorking.forEach(function(t) { existingTexts[t.text] = true; });
  tpl.topics.forEach(function(t) {
    if (existingTexts[t.text]) return;
    _vpAgendaWorking.push({ text: t.text, sub: t.sub || '', srcType: t.srcType || '', srcValue: t.srcValue || '', included: true });
  });
  document.querySelectorAll('.vp-tpl-tag').forEach(function(b) { b.classList.toggle('bp', b.dataset.tplid === tplId); b.classList.toggle('bo', b.dataset.tplid !== tplId); });
  _vpAgendaRerender();
}
function _vpAgendaToggle(idx, checked) {
  if (_vpAgendaWorking[idx]) _vpAgendaWorking[idx].included = checked;
  _vpAgendaRerender();
}
function _vpAgendaRemove(idx) {
  _vpAgendaWorking.splice(idx, 1);
  _vpAgendaRerender();
}
function _vpAgendaAddCustom() {
  var input = document.getElementById('vp_agenda_custom');
  var text = ((input && input.value) || '').trim();
  if (!text) return;
  _vpAgendaWorking.push({ text: text, sub: '', srcType: '', srcValue: '', included: true });
  input.value = '';
  _vpAgendaRerender();
}
function vpToggleAgendaDone(planId, idx, checked) {
  var plans = getVisitPlans();
  var p = plans.filter(function(x) { return x.id === planId; })[0];
  if (!p || !p.agenda || !p.agenda[idx]) return;
  p.agenda[idx].done = checked;
  saveVisitPlans(plans);
}

// ฟอร์มเพิ่ม/แก้ไขนัด — เลือกได้ว่าผูกกับ Dealer ที่มีอยู่ (autofill ผู้ติดต่อ/เบอร์/อีเมล/location) หรือ Lead ใหม่ (กรอกเอง)
function showAddVisitPlanM(date, prefillDealerId, editId) {
  window._vpCurrentEditId = editId || '';
  var plan = null;
  if (editId) {
    var plans = getVisitPlans();
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].id === editId) { plan = plans[i]; break; }
    }
  }

  // จำ source-type/mode ที่เลือกล่าสุดไว้เป็นค่าเริ่มต้นของนัดใหม่ — ลดการเลือกซ้ำถ้าทำนัดประเภทเดียวกันต่อกันหลายอัน
  var lastDefaults = {};
  try { lastDefaults = JSON.parse(localStorage.getItem('v7_vpLastDefaults') || '{}') || {}; } catch(e) { lastDefaults = {}; }

  var selDealer = prefillDealerId || (plan ? plan.dealerId : '') || '';
  var sourceType = plan ? (plan.sourceType || 'dealer') : (selDealer ? 'dealer' : (lastDefaults.sourceType || 'dealer'));
  var selMode = plan ? plan.mode : (lastDefaults.mode || 'offline');
  var selTitle = plan ? (plan.title || '') : '';
  var selNote = plan ? (plan.note || '') : '';

  var h = '<div style="max-width:440px">';
  h += (typeof _pendingLinkGuidelineHtml === 'function') ? _pendingLinkGuidelineHtml() : '';
  // นัดเก่าที่มาจาก Task (สร้างผ่าน "รอสร้าง") — โชว์ลิงก์ย้อนกลับตอนเปิดแก้ไขนัดนี้ทีหลัง
  if (plan && plan.sourceTaskId && typeof _sourceTaskBackLinkHtml === 'function') h += _sourceTaskBackLinkHtml(plan.sourceTaskId);
  h += '<div class="fm-group"><label>📅 วันที่นัด</label><input type="date" id="vp_date" class="fm-input" value="' + sanitize(date) + '" onchange="_vpSlotSuggestRender(this.value,\'' + (editId || '') + '\');vpCheckTimeConflict(this.value,\'' + (editId || '') + '\')"></div>';

  h += '<div style="display:flex;gap:6px;margin-bottom:10px">';
  h += '<button type="button" id="vp_src_dealer_btn" class="btn bsm ' + (sourceType === 'dealer' ? 'bp' : 'bo') + '" style="flex:1" onclick="vpSetSourceType(\'dealer\')">🏢 Dealer ที่มีอยู่</button>';
  h += '<button type="button" id="vp_src_lead_btn" class="btn bsm ' + (sourceType === 'lead' ? 'bp' : 'bo') + '" style="flex:1" onclick="vpSetSourceType(\'lead\')">🆕 Lead ใหม่</button>';
  h += '</div>';
  h += '<input type="hidden" id="vp_source_type" value="' + sourceType + '">';

  h += '<div class="fm-group"><label>📝 หัวข้อนัด</label><input type="text" id="vp_title" class="fm-input" value="' + sanitize(selTitle) + '" placeholder="เช่น เสนอราคา Matrice 4E"><div id="vp_title_suggest"></div></div>';

  // โซน Dealer — เปลี่ยนจาก <select> ยาวๆ เป็น search-suggest (พิมพ์ค้นชื่อ) กันต้องไล่สกอลลิ่งหา Dealer เป็น
  // ร้อยราย พอเลือกแล้วดึงข้อมูลจริงมาโชว์เป็น "context card" ให้ทันที (ผู้ติดต่อ/Level/Visit ล่าสุด/Pipeline
  // ค้างอยู่) ไม่ต้องเปิดหน้า Dealer แยกไปเช็คก่อนนัด (ผู้ใช้ขอ 2026-08-27) — vp_dealer ยังเป็น id เดิมที่เก็บ
  // dealerId จริง (แค่เปลี่ยนจาก select เป็น hidden input) กันโค้ด saveVisitPlan ต้องแก้ตาม
  var selDealerObj = selDealer ? ST.getOne('dealers', selDealer) : null;
  h += '<div id="vp_dealer_zone" style="' + (sourceType === 'dealer' ? '' : 'display:none') + '">';
  h += '<div class="fm-group ac-wrap"><label>🏪 Dealer</label>';
  h += '<input type="text" id="vp_dealer_search" class="fm-input" placeholder="🔍 พิมพ์ค้นหา Dealer..." value="' + sanitize(selDealerObj ? selDealerObj.name : '') + '" oninput="_vpDealerSearch(this.value)" onfocus="_vpDealerSearch(this.value)" autocomplete="off">';
  h += '<input type="hidden" id="vp_dealer" value="' + sanitize(selDealer) + '">';
  h += '<div id="vp_dealer_ac_menu"></div>';
  h += '</div>';
  h += '<div id="vp_dealer_preview"></div>';
  h += '</div>';

  // โซน Lead (กรอกเอง หรือดึงจาก Prospect ที่บันทึกไว้ก่อนแล้ว)
  h += '<div id="vp_lead_zone" style="' + (sourceType === 'lead' ? '' : 'display:none') + '">';
  if (typeof getProspects === 'function') {
    var openProspects = getProspects().filter(function(pr) { return pr.stage !== 'converted' && pr.stage !== 'closed'; });
    h += '<div class="fm-group"><label>📋 ดึงจาก Lead ที่บันทึกไว้ (ไม่บังคับ)</label><select id="vp_prospect_select" class="fm-input" onchange="vpProspectPicked()"><option value="">-- พิมพ์เอง --</option>';
    openProspects.forEach(function(pr) {
      var st = _prospectStageInfo(pr.stage);
      h += '<option value="' + pr.id + '"' + (plan && plan.prospectId === pr.id ? ' selected' : '') + '>' + sanitize(pr.companyName) + ' (' + st.icon + ' ' + st.label + ')</option>';
    });
    h += '</select></div>';
    h += '<input type="hidden" id="vp_prospect_id" value="' + sanitize(plan ? (plan.prospectId || '') : '') + '">';
  }
  h += '<div class="fm-group"><label>🏢 ชื่อบริษัท</label><input type="text" id="vp_company" class="fm-input" value="' + sanitize(plan ? (plan.companyName || '') : '') + '"></div>';
  h += '<div class="fr"><div class="fg"><label>👤 ผู้ติดต่อ</label><input type="text" id="vp_contact" class="fm-input" value="' + sanitize(plan ? (plan.contactName || '') : '') + '"></div>';
  h += '<div class="fg"><label>📞 เบอร์</label><input type="text" id="vp_phone" class="fm-input" value="' + sanitize(plan ? (plan.phone || '') : '') + '"></div></div>';
  h += '<div class="fr"><div class="fg"><label>✉️ อีเมล</label><input type="email" id="vp_email" class="fm-input" value="' + sanitize(plan ? (plan.email || '') : '') + '"></div>';
  h += '<div class="fg"><label>📍 Location</label><input type="text" id="vp_location" class="fm-input" value="' + sanitize(plan ? (plan.location || '') : '') + '" placeholder="ที่อยู่ หรือลิงก์ Google Map"></div></div>';
  h += '</div>';

  h += '<div class="fm-group"><label>📍 รูปแบบนัด</label><select id="vp_mode" class="fm-input">';
  h += '<option value="offline"' + (selMode === 'offline' ? ' selected' : '') + '>🤝 Offline (เข้าพบ)</option>';
  h += '<option value="online"' + (selMode === 'online' ? ' selected' : '') + '>📞 Online (โทร/VDO Call)</option>';
  h += '</select></div>';

  h += '<div class="fr"><div class="fg"><label>🕐 เวลาเริ่ม</label><input type="time" id="vp_time_start" class="fm-input" value="' + sanitize(plan ? (plan.timeStart || '') : '') + '" oninput="vpCheckTimeConflict(document.getElementById(\'vp_date\').value||\'' + date + '\',\'' + (editId || '') + '\')"></div>';
  h += '<div class="fg"><label>🕐 เวลาสิ้นสุด</label><input type="time" id="vp_time_end" class="fm-input" value="' + sanitize(plan ? (plan.timeEnd || '') : '') + '" oninput="vpCheckTimeConflict(document.getElementById(\'vp_date\').value||\'' + date + '\',\'' + (editId || '') + '\')"></div></div>';
  h += '<div id="vp_time_conflict_warning"></div>';
  // แนะนำช่วงเวลาว่าง — เทียบกับนัดอื่นในวันเดียวกันให้อัตโนมัติ (ใช้ vpFindConflicts เดิม) กันต้องลองพิมพ์
  // เวลาเองแล้วเจอ "ชนกับ" ทีหลัง (ผู้ใช้ขอ 2026-08-27)
  h += '<div id="vp_slot_suggest"></div>';

  h += '<div class="fm-group ac-wrap"><label>📋 งานที่เกี่ยวข้อง (ค้นหาได้ ไม่บังคับ)</label>';
  var _selTaskObj = (plan && plan.taskId) ? ST.getOne('tasks', plan.taskId) : null;
  h += '<input type="text" id="vp_task_search" class="fm-input" placeholder="🔍 พิมพ์ค้นหางาน..." value="' + sanitize(_selTaskObj ? _selTaskObj.title : '') + '" oninput="_vpTaskSearch(this.value)" onfocus="_vpTaskSearch(this.value)" autocomplete="off">';
  h += '<input type="hidden" id="vp_task" value="' + sanitize(plan ? (plan.taskId || '') : '') + '">';
  h += '<div id="vp_task_ac_menu"></div>';
  h += '</div>';

  // Agenda — เลือกชุดสำเร็จรูปจากคลังกลาง (showAgendaLibraryM) แล้วติ๊กเอา/ถอด หรือพิมพ์เพิ่มเฉพาะนัดนี้เอง —
  // เก็บ state ชั่วคราวใน _vpAgendaWorking ระหว่างเปิดฟอร์ม บันทึกจริงตอนกด "บันทึก" (ดู saveVisitPlan)
  _vpAgendaWorking = (plan && plan.agenda) ? JSON.parse(JSON.stringify(plan.agenda)).map(function(t) { return Object.assign({ included: true }, t); }) : [];
  var agendaTemplatesNow = getAgendaTemplates();
  h += '<div class="fm-group"><label>📋 Agenda (หัวข้อที่จะคุย)</label>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">';
  agendaTemplatesNow.forEach(function(tpl) {
    h += '<button type="button" class="btn btn-xs bo vp-tpl-tag" data-tplid="' + tpl.id + '" onclick="_vpApplyTemplate(\'' + tpl.id + '\')">' + (tpl.icon || '📋') + ' ' + sanitize(tpl.name) + '</button>';
  });
  h += '<button type="button" class="btn btn-xs bo" onclick="closeM();showAgendaLibraryM()">📚 จัดการคลังหัวข้อ</button>';
  h += '</div>';
  h += '<div id="vp_agenda_list" style="max-height:200px;overflow-y:auto;background:var(--bg2);border-radius:8px;padding:6px 8px">' + _vpAgendaListHtml() + '</div>';
  h += '<div style="display:flex;gap:6px;margin-top:6px"><input type="text" id="vp_agenda_custom" placeholder="+ เพิ่มหัวข้อเฉพาะนัดนี้..." class="fm-input" style="flex:1" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_vpAgendaAddCustom();}"><button type="button" class="btn btn-sm bo" onclick="_vpAgendaAddCustom()">เพิ่ม</button></div>';
  h += '</div>';

  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><input type="text" id="vp_note" class="fm-input" value="' + sanitize(selNote) + '" placeholder="เช่น Follow-up M400, Demo L3"></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="saveVisitPlan(document.getElementById(\'vp_date\').value||\'' + date + '\',\'' + (editId || '') + '\')">💾 บันทึก</button>';
  if (editId) h += '<button class="btn bd" onclick="removeVisitPlan(\'' + editId + '\')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM(editId ? '✏️ แก้ไขแผนนัด' : '➕ วางแผนนัดใหม่', h);

  setTimeout(vpDealerPicked, 50);
  setTimeout(function() { vpCheckTimeConflict(date, editId || ''); }, 50);
  setTimeout(function() { _vpSlotSuggestRender(date, editId || ''); }, 50);
}

// เช็คชนเวลาแบบสด — เรียกตอนแก้ช่องเวลาเริ่ม/สิ้นสุดในฟอร์ม
function vpCheckTimeConflict(date, editId) {
  var box = document.getElementById('vp_time_conflict_warning');
  var startEl = document.getElementById('vp_time_start');
  if (!box || !startEl) return;
  var timeStart = startEl.value || '';
  var timeEnd = document.getElementById('vp_time_end') ? document.getElementById('vp_time_end').value : '';
  var conflicts = vpFindConflicts(date, timeStart, timeEnd, editId);
  if (!conflicts.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<div style="background:rgba(239,68,68,.15);border-left:3px solid #ef4444;border-radius:0;padding:6px 8px;font-size:11px;color:#f87171;margin-bottom:8px">⚠️ ชนกับ: ' +
    conflicts.map(function(c) { return sanitize(_vpPlanLabel(c)) + ' (' + c.timeStart + (c.timeEnd ? '–' + c.timeEnd : '') + ')'; }).join(', ') + '</div>';
}

// เลือก Prospect ที่บันทึกไว้ก่อน → ดึงข้อมูลผู้ติดต่อมาเติมให้อัตโนมัติ
function vpProspectPicked() {
  var sel = document.getElementById('vp_prospect_select');
  var idEl = document.getElementById('vp_prospect_id');
  if (!sel || !idEl) return;
  idEl.value = sel.value || '';
  if (!sel.value || typeof getProspect !== 'function') return;
  var pr = getProspect(sel.value);
  if (!pr) return;
  if (document.getElementById('vp_company')) document.getElementById('vp_company').value = pr.companyName || '';
  if (document.getElementById('vp_contact')) document.getElementById('vp_contact').value = pr.contactName || '';
  if (document.getElementById('vp_phone')) document.getElementById('vp_phone').value = pr.phone || '';
  if (document.getElementById('vp_email')) document.getElementById('vp_email').value = pr.email || '';
  if (document.getElementById('vp_location')) document.getElementById('vp_location').value = pr.location || '';
}

function vpSetSourceType(type) {
  document.getElementById('vp_source_type').value = type;
  document.getElementById('vp_src_dealer_btn').className = 'btn bsm ' + (type === 'dealer' ? 'bp' : 'bo');
  document.getElementById('vp_src_lead_btn').className = 'btn bsm ' + (type === 'lead' ? 'bp' : 'bo');
  document.getElementById('vp_dealer_zone').style.display = type === 'dealer' ? '' : 'none';
  document.getElementById('vp_lead_zone').style.display = type === 'lead' ? '' : 'none';
}

// ---- Dealer search-suggest (แทน <select> ยาวๆ) — ดูคอมเมนต์ที่จุดสร้าง HTML ใน showAddVisitPlanM ----
function _vpDealerSearch(q) {
  var menu = document.getElementById('vp_dealer_ac_menu');
  if (!menu) return;
  q = (q || '').trim().toLowerCase();
  if (!q) { menu.innerHTML = ''; return; }
  var matches = ST.getAll('dealers').filter(function(d) { return (d.name || '').toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
  if (!matches.length) { menu.innerHTML = '<div class="ac-menu"><div class="ac-empty">ไม่พบ Dealer ที่ตรงกับคำค้น</div></div>'; return; }
  menu.innerHTML = '<div class="ac-menu">' + matches.map(function(d) {
    var lastDays = (typeof ST.getLastVisitDays === 'function') ? ST.getLastVisitDays(d.id) : null;
    var meta = (d.level ? 'Level ' + d.level + ' · ' : '') + (lastDays !== null ? 'Visit ล่าสุด ' + lastDays + ' วันก่อน' : 'ยังไม่เคย Visit');
    return '<div class="ac-item" onclick="_vpDealerPick(\'' + d.id + '\')"><span class="av">' + sanitize((d.name || '?').slice(0, 2)) + '</span><div class="info"><div class="n">' + sanitize(d.name) + '</div><div class="m">' + sanitize(meta) + '</div></div></div>';
  }).join('') + '</div>';
}
function _vpDealerPick(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  document.getElementById('vp_dealer').value = dealerId;
  document.getElementById('vp_dealer_search').value = d.name;
  document.getElementById('vp_dealer_ac_menu').innerHTML = '';
  vpDealerPicked();
}

// ดึงข้อมูลจริงของ Dealer ที่เลือกมาโชว์เป็น context card ทันที (ผู้ติดต่อ/Level/Visit ล่าสุด/Pipeline ค้างอยู่)
// + แนะนำหัวข้อนัดที่เคยใช้กับ Dealer นี้มาก่อน — ดึงสดทุกครั้งเสมอ ไม่ copy ค่าลงแผน (ผู้ใช้ขอ 2026-08-27)
function vpDealerPicked() {
  var dealerId = document.getElementById('vp_dealer') ? document.getElementById('vp_dealer').value : '';
  var prev = document.getElementById('vp_dealer_preview');
  if (!prev) return;
  if (!dealerId) { prev.innerHTML = ''; _vpTitleSuggestRender([]); return; }
  var d = ST.getOne('dealers', dealerId);
  if (!d) { prev.innerHTML = ''; return; }

  var lines = [];
  if (d.contact) lines.push('👤 ' + d.contact);
  if (d.phone) lines.push('📞 ' + d.phone);
  if (d.email) lines.push('✉️ ' + d.email);

  var lastDays = (typeof ST.getLastVisitDays === 'function') ? ST.getLastVisitDays(dealerId) : null;
  var pipes = (typeof ST.pipelineByDealer === 'function') ? ST.pipelineByDealer(dealerId) : [];
  var openPipes = pipes.filter(function(p) { return (typeof pipeIsOpen === 'function') ? pipeIsOpen(p) : true; });
  var openAmt = openPipes.reduce(function(s, p) { return s + (Number(p.forecastAmount) || 0); }, 0);

  var h = '<div class="vp-context-card">';
  h += '<div class="ctxrow"><span class="k">ติดต่อ</span><span class="v">' + (lines.length ? sanitize(lines.join(' · ')) : '<span style="color:#eab308">⚠️ ยังไม่มีข้อมูล</span>') + '</span></div>';
  if (d.level) h += '<div class="ctxrow"><span class="k">Level</span><span class="v">' + sanitize(d.level) + '</span></div>';
  h += '<div class="ctxrow"><span class="k">Visit ล่าสุด</span><span class="v' + (lastDays !== null && lastDays > 30 ? ' warn' : '') + '">' + (lastDays !== null ? lastDays + ' วันก่อน' : 'ยังไม่เคย') + '</span></div>';
  h += '<div class="ctxrow"><span class="k">Pipeline ค้างอยู่</span><span class="v">' + openPipes.length + ' โครงการ' + (openAmt ? ' · ' + fmtMoneyShort(openAmt) : '') + '</span></div>';
  h += '</div>';
  prev.innerHTML = h;

  var pastTitles = getVisitPlans().filter(function(p) { return p.dealerId === dealerId && p.title; })
    .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); })
    .map(function(p) { return p.title; });
  var uniqueTitles = [];
  pastTitles.forEach(function(t) { if (uniqueTitles.indexOf(t) === -1) uniqueTitles.push(t); });
  _vpTitleSuggestRender(uniqueTitles.slice(0, 4));
}
function _vpTitleSuggestRender(titles) {
  var el = document.getElementById('vp_title_suggest');
  if (!el) return;
  if (!titles.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="vp-suggest-chips"><span style="font-size:10px;color:var(--text3);align-self:center">เคยใช้:</span>' +
    titles.map(function(t) { return '<span class="vp-suggest-chip" onclick="document.getElementById(\'vp_title\').value=\'' + sanitize(t).replace(/'/g, "\\'") + '\'">' + sanitize(t) + '</span>'; }).join('') + '</div>';
}

// ---- Task search-suggest (แทน <select> เดิม) ----
function _vpTaskSearch(q) {
  var menu = document.getElementById('vp_task_ac_menu');
  if (!menu) return;
  q = (q || '').trim().toLowerCase();
  var tasks = [];
  try { tasks = ST.filter('tasks', function(t) { return t.status === 'active'; }); } catch(e) {}
  if (q) tasks = tasks.filter(function(t) { return (t.title || '').toLowerCase().indexOf(q) !== -1; });
  tasks = tasks.slice(0, 8);
  if (!tasks.length) { menu.innerHTML = '<div class="ac-menu"><div class="ac-empty">ไม่พบงานที่ตรงกับคำค้น</div></div>'; return; }
  menu.innerHTML = '<div class="ac-menu">' + tasks.map(function(t) {
    var dd = t.dealerId ? ST.getOne('dealers', t.dealerId) : null;
    return '<div class="ac-item" onclick="_vpTaskPick(\'' + t.id + '\')"><span class="av">📋</span><div class="info"><div class="n">' + sanitize(t.title) + '</div><div class="m">' + (dd ? sanitize(dd.name) : 'ไม่ผูก Dealer') + '</div></div></div>';
  }).join('') + '</div>';
}
function _vpTaskPick(taskId) {
  var t = ST.getOne('tasks', taskId);
  if (!t) return;
  document.getElementById('vp_task').value = taskId;
  document.getElementById('vp_task_search').value = t.title;
  document.getElementById('vp_task_ac_menu').innerHTML = '';
}

// ---- แนะนำช่วงเวลาว่าง — เทียบกับนัดอื่นในวันเดียวกันด้วย vpFindConflicts เดิม ----
var VP_SLOT_CANDIDATES = [['09:00', '10:00'], ['10:30', '11:30'], ['13:00', '14:00'], ['14:30', '15:30'], ['16:00', '17:00']];
function _vpSlotSuggestRender(date, editId) {
  var el = document.getElementById('vp_slot_suggest');
  if (!el || !date) return;
  el.innerHTML = '<div class="hint" style="font-size:10.5px;color:var(--text2);margin:4px 0 2px">💡 ช่วงว่างวันนี้ (เทียบกับนัดอื่นอัตโนมัติ)</div><div class="vp-slot-row">' +
    VP_SLOT_CANDIDATES.map(function(c) {
      var busy = vpFindConflicts(date, c[0], c[1], editId || '').length > 0;
      return '<span class="vp-slot-chip' + (busy ? ' busy' : '') + '"' + (busy ? '' : ' onclick="_vpPickSlot(\'' + c[0] + '\',\'' + c[1] + '\')"') + '>' + c[0] + '–' + c[1] + (busy ? ' (ติดนัด)' : '') + '</span>';
    }).join('') + '</div>';
}
function _vpPickSlot(start, end) {
  document.getElementById('vp_time_start').value = start;
  document.getElementById('vp_time_end').value = end;
  vpCheckTimeConflict(document.getElementById('vp_date').value, window._vpCurrentEditId || '');
}

function saveVisitPlan(date, editId) {
  var sourceType = document.getElementById('vp_source_type').value || 'dealer';
  var title = (document.getElementById('vp_title').value || '').trim();
  var mode = document.getElementById('vp_mode').value || 'offline';
  var taskId = document.getElementById('vp_task') ? document.getElementById('vp_task').value : '';
  var note = (document.getElementById('vp_note').value || '').trim();
  var timeStart = document.getElementById('vp_time_start') ? document.getElementById('vp_time_start').value : '';
  var timeEnd = document.getElementById('vp_time_end') ? document.getElementById('vp_time_end').value : '';

  var agenda = _vpAgendaWorking.filter(function(t) { return t.included; }).map(function(t) {
    return { text: t.text, sub: t.sub || '', srcType: t.srcType || '', srcValue: t.srcValue || '', done: !!t.done };
  });
  var data = { date: date, sourceType: sourceType, title: title, mode: mode, taskId: taskId, note: note, timeStart: timeStart, timeEnd: timeEnd, agenda: agenda };

  if (!editId) { try { localStorage.setItem('v7_vpLastDefaults', JSON.stringify({ sourceType: sourceType, mode: mode })); } catch(e) {} }

  if (sourceType === 'dealer') {
    var dealerId = document.getElementById('vp_dealer').value || '';
    if (!dealerId && !note && !title) { toast('เลือก Dealer หรือใส่หัวข้อนัด/หมายเหตุ'); return; }
    data.dealerId = dealerId;
  } else {
    var company = (document.getElementById('vp_company').value || '').trim();
    if (!company) { toast('กรุณาใส่ชื่อบริษัท (Lead)'); return; }
    data.dealerId = '';
    data.companyName = company;
    data.contactName = (document.getElementById('vp_contact').value || '').trim();
    data.phone = (document.getElementById('vp_phone').value || '').trim();
    data.email = (document.getElementById('vp_email').value || '').trim();
    data.location = (document.getElementById('vp_location').value || '').trim();
    data.prospectId = document.getElementById('vp_prospect_id') ? document.getElementById('vp_prospect_id').value : '';
  }

  var plans = getVisitPlans();

  if (editId) {
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].id === editId) {
        plans[i] = Object.assign({}, plans[i], data);
        break;
      }
    }
  } else {
    data.id = 'vp_' + Date.now();
    data.status = 'planned';
    data.sourceTaskId = (typeof _pendingLinkTaskId !== 'undefined' && _pendingLinkTaskId) || '';
    plans.push(data);
    if (typeof resolveTaskPendingLink === 'function') resolveTaskPendingLink('visitPlan', data.id, fDShort(date) + ' Visit Plan');
  }

  saveVisitPlans(plans);
  if (data.prospectId && typeof advanceProspectStage === 'function') _vpAdvanceProspectIfBehind(data.prospectId, 'scheduled', 'นัดเข้าพบวันที่ ' + fDShort(date));
  toast(editId ? '💾 แก้ไขแล้ว' : '📅 วางแผนแล้ว');
  closeMForce();
  render();
}

// เลื่อน stage ของ Prospect ให้ทันกับนัดที่ผูกไว้ — เลื่อนไปข้างหน้าเท่านั้น ไม่ดึงกลับถ้า stage ปัจจุบันไปไกลกว่าแล้ว
// (แก้ list ตรงๆ ไม่เรียก advanceProspectStage เพราะฟังก์ชันนั้นมี closeM/render สำหรับ flow จากปุ่มในโมดัลโดยเฉพาะ)
function _vpAdvanceProspectIfBehind(prospectId, targetStage, note) {
  if (typeof getProspects !== 'function') return;
  var order = PROSPECT_STAGES.map(function(s) { return s.k; });
  var list = getProspects();
  var changed = false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === prospectId) {
      var pr = list[i];
      if (pr.stage === 'closed' || pr.stage === 'converted') break;
      if (order.indexOf(targetStage) > order.indexOf(pr.stage)) {
        pr.stage = targetStage;
        pr.updatedAt = new Date().toISOString();
        pr.history = pr.history || [];
        pr.history.push({ stage: targetStage, date: _td(), note: note || '' });
        changed = true;
      }
      break;
    }
  }
  if (changed) saveProspects(list);
}

function removeVisitPlan(planId) {
  var plans = getVisitPlans().filter(function(p) { return p.id !== planId; });
  saveVisitPlans(plans);
  if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('visitPlans', planId);
  toast('🗑️ ลบแล้ว');
  render();
}

// เปิด Visit Report เต็มจอแบบแท็บแยก (เหมือนปุ่ม 🪟 ในเมนู Visit Report) สำหรับนัดที่ผูกกับ Dealer
// ส่ง planId ไปด้วย ผูกผล Visit กลับมาที่แผนนัดนี้อัตโนมัติหลังบันทึก (ดู rVisitWindow ใน views-visit.js)
function vpGoVisit(planId) {
  var plan = ST.getOne('visitPlans', planId);
  if (!plan) return;
  if (!plan.dealerId) { toast('นัดนี้ไม่มี Dealer ผูกอยู่ — ใช้ปุ่ม "บันทึกผลการนัด" แทน'); return; }

  if (typeof openVisitWindow === 'function') {
    openVisitWindow(plan.dealerId, '', planId, plan.mode || '');
  } else {
    toast('ฟังก์ชันเปิดแท็บแยกไม่พบ');
  }
}

// เรียกจาก modals.js หลังบันทึก Visit สำเร็จ — ผูกผล Visit กลับเข้าแผนนัดที่เปิดมาจาก vpGoVisit
function vpMarkPlanActualFromVisit(visitId, prospectId) {
  if (!window._vpLinkPlanId) return;
  var planId = window._vpLinkPlanId;
  window._vpLinkPlanId = null;
  var plan = ST.getOne('visitPlans', planId);
  var updates = { status: 'done', visitId: visitId };
  // เขียนสถานะติ๊ก/รายละเอียด Agenda ที่แก้ไว้ใน Visit Report กลับเข้าแผนนัดต้นทางด้วย (ดู
  // _visitAgendaSectionHtml ใน modals.js) — ให้การ์ด Visit Plan (ทั้งในเมนู Visit Planning และแท็บ Dealer)
  // เห็นสถานะติ๊กล่าสุดตรงกับที่กรอกไว้ตอนบันทึกผล ไม่ใช่ค่าติ๊กเก่าตอนวางแผน (ผู้ใช้ขอ 2026-08-27)
  if (window._visitAgendaWorking && window._visitAgendaPlanId === planId) updates.agenda = window._visitAgendaWorking;
  window._visitAgendaWorking = null;
  window._visitAgendaPlanId = null;
  var _updatedPlan = ST.update('visitPlans', planId, updates);
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('visitPlans', _updatedPlan);
  var pid = prospectId || (plan && plan.prospectId) || '';
  if (pid && typeof _vpAdvanceProspectIfBehind === 'function') _vpAdvanceProspectIfBehind(pid, 'visited', 'เข้าพบตามนัดแล้ว');
}

function vpGoVisitLead(planId) {
  var plan = ST.getOne('visitPlans', planId);
  if (!plan) return;
  window._vpLinkPlanId = planId;
  window._visitSourceType = 'lead';
  window._vpPrefillProspectId = plan.prospectId || '';
  // วันที่เริ่มต้นควรเป็นวันที่นัดไว้ ไม่ใช่วันนี้ (เหมือน rVisitWindow ฝั่ง Dealer) — ผ่าน _visitDraftOverride
  if (plan.date) window._visitDraftOverride = { date: plan.date };
  if (typeof showVisitM === 'function') {
    showVisitM('');
    setTimeout(function() {
      var modeEl = document.querySelector('input[name="fv_mode"][value="' + (plan.mode || 'offline') + '"]');
      if (modeEl) modeEl.checked = true;
    }, 200);
  }
}

// บันทึกผลการนัดแบบย่อสำหรับ Lead (ไม่มี Dealer ให้ผูก Visit Report เต็มรูปแบบ)
function showVpLeadActualM(planId) {
  var plan = ST.getOne('visitPlans', planId);
  if (!plan) return;
  var h = '<div style="max-width:380px">';
  h += '<div style="font-weight:700;margin-bottom:10px">' + sanitize(plan.title || plan.companyName || '-') + '</div>';
  h += '<div style="display:flex;gap:6px;margin-bottom:10px">';
  h += '<button class="btn bsm" style="flex:1;background:#22c55e;color:#fff" onclick="saveVpLeadActual(\'' + planId + '\',\'attended\')">✅ ไปตามนัด</button>';
  h += '<button class="btn bsm bo" style="flex:1" onclick="saveVpLeadActual(\'' + planId + '\',\'rescheduled\')">📅 เลื่อนนัด</button>';
  h += '<button class="btn bsm bo" style="flex:1" onclick="saveVpLeadActual(\'' + planId + '\',\'cancelled\')">❌ ยกเลิก</button>';
  h += '</div>';
  h += '<div class="fm-group"><label>📝 บันทึกผลคุย</label><textarea id="vp_actual_note" rows="3" class="fm-input" placeholder="เช่น สนใจ ขอใบเสนอราคา นัดรอบ 2 สัปดาห์หน้า">' + sanitize((plan.actual && plan.actual.note) || '') + '</textarea></div>';
  h += '<div class="fm-actions"><button class="btn" onclick="closeM()">ปิด</button></div>';
  h += '</div>';
  openM('📍 บันทึกผลการนัด (Lead)', h);
}

// ปุ่มลัด — ไปตามนัดแล้วไม่มีโน้ตเพิ่ม กดทีเดียวจบเหมือนฝั่ง Dealer (ของเดิม Lead ต้องเปิด modal เสมอ)
// ยังเปิด modal ปกติได้ถ้าต้องการใส่โน้ต/เลื่อนนัด/ยกเลิก ผ่านปุ่ม "📍 บันทึกผลการนัด" คู่กัน — ไม่ได้ตัดความสามารถนั้นออก
function _createVisitFromPlan(planId, note) {
  var plan = ST.getOne('visitPlans', planId);
  if (!plan || plan.visitId) return; // already linked
  var cfg = getConfig();
  var company = plan.companyName || '';
  if (plan.prospectId) {
    var pr = typeof getProspect === 'function' ? getProspect(plan.prospectId) : ST.getOne('prospects', plan.prospectId);
    if (pr && pr.companyName) company = pr.companyName;
  }
  var summaryText = (company ? '[' + company + '] ' : '') + (note || '');
  var visitObj = ST.add('visits', {
    date: plan.date || _td(),
    time: plan.timeStart || '',
    dealerId: '',
    company: company,
    contact: plan.contactName || '',
    mode: plan.mode || 'offline',
    summary: summaryText.trim(),
    saleName: (cfg.saleName || ''),
    reportMode: 'quick',
    topicData: [], pipelineUpdates: [], forecastNotes: [], feedbackItems: [], attachments: [],
    visitPlanId: planId
  });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('visits', visitObj);
  var _updatedPlan2 = ST.update('visitPlans', planId, { visitId: visitObj.id });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('visitPlans', _updatedPlan2);
}

function vpQuickMarkAttended(planId) {
  var plan = ST.getOne('visitPlans', planId);
  if (!plan) return;
  var _updatedPlan3 = ST.update('visitPlans', planId, {
    status: 'done',
    actual: { status: 'attended', note: (plan.actual && plan.actual.note) || '', date: _td() }
  });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('visitPlans', _updatedPlan3);
  _createVisitFromPlan(planId, (plan.actual && plan.actual.note) || '');
  if (plan.prospectId) _vpAdvanceProspectIfBehind(plan.prospectId, 'visited', 'เข้าพบตามนัดแล้ว');
  toast('✅ บันทึกแล้ว · สร้าง Visit Report แล้ว');
  render();
}

function saveVpLeadActual(planId, status) {
  var note = (document.getElementById('vp_actual_note').value || '').trim();
  var plan = ST.getOne('visitPlans', planId);
  var _updatedPlan4 = ST.update('visitPlans', planId, {
    status: status === 'attended' ? 'done' : status,
    actual: { status: status, note: note, date: _td() }
  });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('visitPlans', _updatedPlan4);
  if (status === 'attended') {
    _createVisitFromPlan(planId, note);
    if (plan && plan.prospectId) _vpAdvanceProspectIfBehind(plan.prospectId, 'visited', note || 'เข้าพบตามนัดแล้ว');
  }
  closeMForce();
  toast('💾 บันทึกผลแล้ว' + (status === 'attended' ? ' · สร้าง Visit Report แล้ว' : ''));
  render();
}

// กดผลผิด / อยากย้อนกลับ — เคลียร์ผลนัด กลับเป็น "วางแผนไว้" เหมือนยังไม่ได้บันทึกผล
// (ไม่ลบ Visit Report ที่ผูกไว้ถ้ามี แค่ปลดสถานะนัดนี้กลับ — ถ้าผูก Prospect ไว้ ต้องไปกดแก้ stage ที่หน้า Lead เอง เพราะระบบเลื่อน stage ไปข้างหน้าอัตโนมัติเท่านั้น ไม่ดึงกลับอัตโนมัติ)
function resetVisitPlanStatus(planId) {
  if (!confirm('ยกเลิกผลของนัดนี้ กลับเป็น "วางแผนไว้"?')) return;
  var _updatedPlan5 = ST.update('visitPlans', planId, { status: 'planned', actual: null });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('visitPlans', _updatedPlan5);
  toast('↩️ ยกเลิกผลแล้ว');
  render();
}

// แปลง Lead ในแผนนัดให้เป็น Dealer จริงในระบบ — เปิดฟอร์ม Dealer เปล่าแล้ว prefill ข้อมูลจาก Lead ให้
function vpConvertLeadToDealer(planId) {
  var plan = ST.getOne('visitPlans', planId);
  if (!plan || plan.sourceType !== 'lead') return;
  if (typeof showDealerM !== 'function') { toast('ฟังก์ชันเพิ่ม Dealer ไม่พบ'); return; }
  showDealerM();
  setTimeout(function() {
    var nameEl = document.getElementById('fd_name');
    var contactEl = document.getElementById('fd_contact');
    var mapEl = document.getElementById('fd_map');
    if (nameEl) nameEl.value = plan.companyName || '';
    if (contactEl) {
      var lines = [];
      if (plan.contactName) lines.push(plan.contactName);
      if (plan.phone) lines.push('โทร ' + plan.phone);
      if (plan.email) lines.push('อีเมล ' + plan.email);
      contactEl.value = lines.join(' / ');
    }
    if (mapEl && /^https?:\/\//.test(plan.location || '')) mapEl.value = plan.location;
  }, 80);
}

function copyVisitPlan() {
  var plans = getVisitPlans();
  var weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 + (vpWeekOffset * 7));
  var dayNames = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

  var t = '📅 Visit Plan — สัปดาห์ ' + fD(fmtDateKey(weekStart)) + '\n';
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
        var isLead = p.sourceType === 'lead';
        var dd = (!isLead && p.dealerId) ? ST.getOne('dealers', p.dealerId) : null;
        var company = isLead ? (p.companyName || '-') : (dd ? dd.name : (p.note || '-'));
        t += '  ' + (p.mode === 'offline' ? '🤝' : '📞') + (p.timeStart ? ' ' + p.timeStart + (p.timeEnd ? '–' + p.timeEnd : '') : '') + ' ' + (p.title || company);
        if (p.title) t += ' (' + company + ')';
        if (p.note) t += ' — ' + p.note;
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

function fmtDateKey(date) {
  var d = date.getDate();
  var m = date.getMonth() + 1;
  var y = date.getFullYear();
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
}
// ================================================================
// SMART FILTER PAGE
// ================================================================
// stale_pipeline เดิม render เป็น list เปล่าๆ ไม่มี sort/filter/ค้นหาเลย — พอมีเป็นร้อยรายการ (เช่น
// "116 Pipeline ไม่อัพเดท 14d") หาของที่อยากดูยากมาก เพิ่มค้นหา/เรียง/กรองตาม Dealer ให้ (2026-08-24)
var sfStaleSearch = '';
var sfStaleSort = 'stale_desc';
var sfStaleDealer = 'all';
function sfStaleSearchInput(v) { sfStaleSearch = v; render(); }
function sfStaleSortChange(v) { sfStaleSort = v; render(); }
function sfStaleDealerChange(v) { sfStaleDealer = v; render(); }
function _sfStalePipelineData() {
  return getStalePipelines().map(function(p) {
    var logs = ST.pipeLogsByPipe(p.id);
    var lastDate = logs.length ? logs[0].date.split('T')[0] : (p.created ? p.created.split('T')[0] : '');
    var d = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    return { p: p, dealerId: p.dealerId || '', dealerName: d ? d.name : '(ไม่มี Dealer)', staleDays: lastDate ? -dTo(lastDate) : 999 };
  });
}
function _sfStalePipelineItem(item) {
  var p = item.p;
  var staleColor = item.staleDays >= 60 ? '#ef4444' : item.staleDays >= 30 ? '#f59e0b' : '#94a3b8';
  return '<div class="li" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">' +
    '<div class="lm">' +
    '<div class="lt">' + sanitize(p.projectName || '-') + ' ' + pipeTag(p.status) + '</div>' +
    '<div class="ls">🏪 ' + sanitize(item.dealerName) + ' • ' + (p.model || '') + ' • 💰 ' + fmtMoney(p.forecastAmount) + (p.biddingDate ? ' • Bid: ' + fDShort(p.biddingDate) : '') + '</div>' +
    '</div>' +
    '<span style="font-size:11px;font-weight:700;color:' + staleColor + ';white-space:nowrap;flex-shrink:0">⏰ ค้าง ' + item.staleDays + ' วัน</span>' +
    '</div>';
}
function rSmartFilter(el) {
  var fid = S.filterId;
  var filters = getSmartFilters();
  var f = null;
  for (var i = 0; i < filters.length; i++) {
    if (filters[i].id === fid) { f = filters[i]; break; }
  }
  document.getElementById('pgT').textContent = f ? f.icon + ' ' + f.name : '🔍 Smart Filter';
  
  var html = '';
  var _sfScopedIds = scopedDealerIdSet();

  switch(fid) {
    case 'overdue_tasks': {
      var items = getUrgentItems().filter(function(i) { return dTo(i.dueDate) < 0; });
      html = items.map(function(i) {
        return '<div class="li dlo" onclick="go(\'taskDetail\',{taskId:\'' + i.refId + '\'})"><div class="lm"><div class="lt">' + sanitize(i.title) + '</div><div class="ls">' + dlB(i.dueDate, false) + '</div></div></div>';
      }).join('') || '<div class="empty"><p>✅ ไม่มีงานที่เลยกำหนด</p></div>';
      break;
    }
    case 'bidding_soon': {
      var w = getWeekRange();
      var items = [];
      try { items = ST.filter('pipeline', function(p) { return p.biddingDate && isInRange(p.biddingDate, w.start, w.end) && pipeIsOpen(p) && (!p.dealerId || _sfScopedIds[p.dealerId]); }); } catch(e) {}
      html = items.map(function(p) { return pipeListItem(p); }).join('') || '<div class="empty"><p>✅ ไม่มี Bidding ในสัปดาห์นี้</p></div>';
      break;
    }
    case 'no_contact_14d': {
      var dealerStatus = getDealerContactStatus();
      var items = (dealerStatus || []).filter(function(d) { return d.lastContactDays === null || d.lastContactDays > 14; });
      html = items.map(function(d) {
        return '<div class="li" onclick="go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})"><div class="lm"><div class="lt"><span class="health-dot ' + d.contactStatus + '"></span> ' + sanitize(d.name) + ' ' + levelTag(d.level) + '</div><div class="ls">' + contactLabel(d.lastContactDays) + '</div></div><span class="dealer-act" onclick="event.stopPropagation();showFollowupM(\'' + d.id + '\')">📞</span></div>';
      }).join('') || '<div class="empty"><p>✅ ติดต่อครบทุก Dealer</p></div>';
      break;
    }
    case 'low_health': {
      var _lhCfg = getConfig(); // ครั้งเดียว — calcHealthScore เดิมเรียก getConfig() เองต่อ Dealer
      var items = scopedDealers().map(function(d) { return Object.assign({}, d, {health: calcHealthScore(d.id, _lhCfg)}); }).filter(function(d) { return d.health.score < 40; });
      html = items.map(function(d) {
        return '<div class="li" onclick="go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})"><div class="lm"><div class="lt">' + sanitize(d.name) + ' ' + levelTag(d.level) + ' <span style="color:#ef4444;font-weight:700">' + d.health.score + '/100</span></div><div class="ls">' + d.health.details.filter(function(x) { return x.status === 'bad'; }).map(function(x) { return x.label; }).join(' • ') + '</div></div></div>';
      }).join('') || '<div class="empty"><p>✅ Dealer Health ดีทุกราย</p></div>';
      break;
    }
    case 'stale_pipeline': {
      var staleData = _sfStalePipelineData();
      var dealerNames = {};
      staleData.forEach(function(it) { dealerNames[it.dealerId || '__none__'] = it.dealerName; });
      var dealerOptions = Object.keys(dealerNames).sort(function(a, b) { return dealerNames[a].localeCompare(dealerNames[b], 'th'); });

      var filtered = staleData.filter(function(it) {
        if (sfStaleDealer !== 'all' && (it.dealerId || '__none__') !== sfStaleDealer) return false;
        if (sfStaleSearch) {
          var q = sfStaleSearch.toLowerCase();
          if ((it.p.projectName || '').toLowerCase().indexOf(q) === -1 && it.dealerName.toLowerCase().indexOf(q) === -1) return false;
        }
        return true;
      });
      if (sfStaleSort === 'stale_desc') filtered.sort(function(a, b) { return b.staleDays - a.staleDays; });
      else if (sfStaleSort === 'stale_asc') filtered.sort(function(a, b) { return a.staleDays - b.staleDays; });
      else if (sfStaleSort === 'dealer_az') filtered.sort(function(a, b) { return a.dealerName.localeCompare(b.dealerName, 'th'); });
      else if (sfStaleSort === 'fc_desc') filtered.sort(function(a, b) { return (Number(b.p.forecastAmount) || 0) - (Number(a.p.forecastAmount) || 0); });

      var toolbar = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
        '<input type="text" placeholder="🔍 ค้นหาชื่อโครงการ/บริษัท..." value="' + sanitize(sfStaleSearch) + '" oninput="sfStaleSearchInput(this.value)" style="flex:1;min-width:160px;font-size:12px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)">' +
        '<select onchange="sfStaleDealerChange(this.value)" style="font-size:12px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)">' +
        '<option value="all">🏪 ทุกบริษัท</option>' +
        dealerOptions.map(function(k) { return '<option value="' + sanitize(k) + '"' + (sfStaleDealer === k ? ' selected' : '') + '>' + sanitize(dealerNames[k]) + '</option>'; }).join('') +
        '</select>' +
        '<select onchange="sfStaleSortChange(this.value)" style="font-size:12px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)">' +
        '<option value="stale_desc"' + (sfStaleSort === 'stale_desc' ? ' selected' : '') + '>⏰ ค้างนานสุดก่อน</option>' +
        '<option value="stale_asc"' + (sfStaleSort === 'stale_asc' ? ' selected' : '') + '>⏰ ค้างน้อยสุดก่อน</option>' +
        '<option value="dealer_az"' + (sfStaleSort === 'dealer_az' ? ' selected' : '') + '>🏪 ชื่อบริษัท A-Z</option>' +
        '<option value="fc_desc"' + (sfStaleSort === 'fc_desc' ? ' selected' : '') + '>💰 Forecast มาก→น้อย</option>' +
        '</select>' +
        '</div>';
      var listHtml = filtered.map(_sfStalePipelineItem).join('') || '<div class="empty"><p>ไม่พบรายการที่ตรงกับตัวกรอง</p></div>';
      html = toolbar + '<div style="font-size:11px;color:var(--text2);margin-bottom:6px">แสดง ' + filtered.length + ' / ' + staleData.length + ' รายการ</div>' + listHtml;
      if (!staleData.length) html = '<div class="empty"><p>✅ ไม่มี Pipeline ค้าง</p></div>';
      break;
    }
    case 'big_projects': {
      var items = [];
      try { items = ST.filter('pipeline', function(p) { return Number(p.forecastAmount) >= 1500000 && pipeIsOpen(p) && (!p.dealerId || _sfScopedIds[p.dealerId]); }); } catch(e) {}
      html = items.map(function(p) { return pipeListItem(p); }).join('') || '<div class="empty"><p>ไม่มี</p></div>';
      break;
    }
    case 'need_action': {
      var items = [];
      try { items = ST.filter('pipeline', function(p) { return p.followupDate && dTo(p.followupDate) <= 3 && pipeIsOpen(p) && (!p.dealerId || _sfScopedIds[p.dealerId]); }); } catch(e) {}
      html = items.map(function(p) { return pipeListItem(p); }).join('') || '<div class="empty"><p>✅ ไม่มีที่ต้องทำ</p></div>';
      break;
    }
    case 'waiting_overdue': {
      go('reminders'); return;
    }
    default:
      html = '<div class="empty"><p>ไม่พบข้อมูล</p></div>';
  }

  el.innerHTML = '<div class="card"><h2>' + (f ? f.icon + ' ' + f.name : '') + '</h2>' + html + '</div>';
}

function pipeListItem(p) {
  var d = null;
  try { d = ST.getOne('dealers', p.dealerId); } catch(e) {}
  return '<div class="li" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})"><div class="lm"><div class="lt">' + sanitize(p.projectName) + ' ' + pipeTag(p.status) + '</div><div class="ls">' + (d ? d.name : '') + ' • ' + (p.model || '') + ' • 💰 ' + fmtMoney(p.forecastAmount) + (p.biddingDate ? ' • Bid: ' + fDShort(p.biddingDate) : '') + '</div></div></div>';
}

// ================================================================
// KNOWLEDGE BASE PAGE
// ================================================================
var noteFilter = 'all';
var noteStatusFilter = 'active';
var noteSearch = '';
var noteView = 'list';
var noteSort = 'created_desc';

var _noteCatColors = ['#3b82f6','#8b5cf6','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'];
function noteCatColor(cat, cats) {
  var idx = cats ? cats.indexOf(cat) : -1;
  return idx !== -1 ? _noteCatColors[idx % _noteCatColors.length] : '#64748b';
}

// emoji นำหน้าชื่อหมวด (เช่น "📋 Policy" → "📋") ใช้เป็นไอคอน avatar ของการ์ด — cfg.noteCategories ทุกตัวมี emoji นำหน้าอยู่แล้ว
function _noteCatIcon(cat) {
  var first = (cat || '📌').split(' ')[0];
  return first || '📌';
}

function _noteHasImage(n) {
  return (n.attachments || []).some(function(a) { return _attachIcon(a) === null; });
}

function rKnowledge(el) {
  document.getElementById('pgT').textContent = '📚 Knowledge Base';
  var cfg = getConfig();
  var cats = (cfg && cfg.noteCategories) || [];
  var allNotes = [];
  try { allNotes = ST.getAll('notes'); } catch(e) { allNotes = []; }
  var notes = allNotes.slice();

  // ไม่โชว์ trash ใน view ปกติ — โชว์เฉพาะเมื่อ filter = 'trash'
  if (noteStatusFilter === 'trash') {
    notes = notes.filter(function(n) { return n.status === 'trash'; });
  } else {
    notes = notes.filter(function(n) { return (n.status || 'active') !== 'trash'; });
    if (noteStatusFilter !== 'all') notes = notes.filter(function(n) { return (n.status || 'active') === noteStatusFilter; });
  }
  if (noteStatusFilter !== 'trash' && noteFilter !== 'all') notes = notes.filter(function(n) { return n.category === noteFilter; });
  if (noteSearch) {
    var q = noteSearch.toLowerCase();
    notes = notes.filter(function(n) {
      return (n.title || '').toLowerCase().indexOf(q) !== -1 ||
             (n.content || '').toLowerCase().indexOf(q) !== -1 ||
             (n.tags || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  notes.sort(function(a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (noteSort === 'updated_desc') return (b.updated || b.created || '').localeCompare(a.updated || a.created || '');
    if (noteSort === 'title_asc') return (a.title || '').localeCompare(b.title || '');
    return (b.created || '').localeCompare(a.created || '');
  });

  var statusCounts = {active: 0, expired: 0, cancelled: 0, draft: 0, trash: 0};
  var catCounts = {};
  var expireSoon = 0;
  allNotes.forEach(function(n) {
    var st = n.status || 'active';
    statusCounts[st] = (statusCounts[st] || 0) + 1;
    var cat = n.category || '📌 อื่นๆ';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
    if (st === 'active' && n.expireDate && dTo(n.expireDate) >= 0 && dTo(n.expireDate) <= 30) expireSoon++;
  });

  var expiredNotes = allNotes.filter(function(n) { return (n.status||'active') === 'active' && n.expireDate && dTo(n.expireDate) <= 0; });
  var remindNotes  = allNotes.filter(function(n) { return (n.status||'active') === 'active' && n.remindDate && dTo(n.remindDate) <= 3 && dTo(n.remindDate) >= 0; });

  var h = '';

  // Alert banners (compact)
  if (expiredNotes.length) {
    h += '<div class="card" style="border-color:#ef4444;padding:8px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font-weight:700;color:#ef4444;font-size:13px">⏰ Note หมดอายุ ' + expiredNotes.length + ' รายการ</span>' +
      '<button class="btn bsm bo" onclick="noteStatusFilter=\'expired\';render()">ดูทั้งหมด</button></div>';
  }
  if (remindNotes.length) {
    h += '<div class="card" style="border-color:#f59e0b;padding:8px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font-weight:700;color:#f59e0b;font-size:13px">🔔 ใกล้ถึงกำหนดเตือน ' + remindNotes.length + ' รายการ</span>' +
      '<button class="btn bsm bo" onclick="noteStatusFilter=\'active\';render()">ดูทั้งหมด</button></div>';
  }

  // Stats bar
  h += '<div class="note-stat-bar">';
  h += '<div class="note-stat"><div class="note-stat-n" style="color:var(--c1,#3b82f6)">' + allNotes.length + '</div><div class="note-stat-l">ทั้งหมด</div></div>';
  h += '<div class="note-stat"><div class="note-stat-n" style="color:#22c55e">' + statusCounts.active + '</div><div class="note-stat-l">ใช้งาน</div></div>';
  if (expireSoon) h += '<div class="note-stat"><div class="note-stat-n" style="color:#f59e0b">' + expireSoon + '</div><div class="note-stat-l">⏰ ใกล้หมด</div></div>';
  if (statusCounts.draft) h += '<div class="note-stat"><div class="note-stat-n" style="color:#8b5cf6">' + statusCounts.draft + '</div><div class="note-stat-l">📝 Draft</div></div>';
  h += '</div>';

  // Toolbar
  h += '<div class="note-toolbar">' +
    '<input type="text" id="noteSrc" value="' + sanitize(noteSearch) + '" placeholder="🔍 ค้นหา Note..." oninput="noteSearchInput(this.value)" autocomplete="off" style="flex:1;min-width:120px">' +
    '<select onchange="noteSort=this.value;render()" style="min-width:110px">' +
    '<option value="created_desc"' + (noteSort==='created_desc'?' selected':'') + '>สร้างล่าสุด</option>' +
    '<option value="updated_desc"' + (noteSort==='updated_desc'?' selected':'') + '>แก้ไขล่าสุด</option>' +
    '<option value="title_asc"'    + (noteSort==='title_asc'?' selected':'')    + '>A-Z</option></select>' +
    '<button class="btn bsm ' + (noteView==='list'?'bp':'bo') + '" onclick="noteView=\'list\';render()" title="List">☰</button>' +
    '<button class="btn bsm ' + (noteView==='grid'?'bp':'bo') + '" onclick="noteView=\'grid\';render()" title="Grid">⊞</button>' +
    '<button class="btn bp" onclick="showNoteM()">➕ เพิ่ม</button>' +
    '</div>';

  // Status filter pills
  h += '<div class="note-cpills">' +
    '<div class="note-cpill ' + (noteStatusFilter==='all'?'act':'') + '" onclick="noteStatusFilter=\'all\';render()">ทั้งหมด</div>' +
    '<div class="note-cpill ' + (noteStatusFilter==='active'?'act':'') + '" onclick="noteStatusFilter=\'active\';render()">✅ ใช้งาน <span class="cpill-cnt">' + statusCounts.active + '</span></div>' +
    '<div class="note-cpill ' + (noteStatusFilter==='expired'?'act':'') + '" onclick="noteStatusFilter=\'expired\';render()">⏰ หมดอายุ <span class="cpill-cnt">' + statusCounts.expired + '</span></div>' +
    (statusCounts.cancelled ? '<div class="note-cpill ' + (noteStatusFilter==='cancelled'?'act':'') + '" onclick="noteStatusFilter=\'cancelled\';render()">❌ ยกเลิก <span class="cpill-cnt">' + statusCounts.cancelled + '</span></div>' : '') +
    (statusCounts.draft ? '<div class="note-cpill ' + (noteStatusFilter==='draft'?'act':'') + '" onclick="noteStatusFilter=\'draft\';render()">📝 Draft <span class="cpill-cnt">' + statusCounts.draft + '</span></div>' : '') +
    (statusCounts.trash ? '<div class="note-cpill ' + (noteStatusFilter==='trash'?'act':'') + '" onclick="noteStatusFilter=\'trash\';render()">🗑️ ถังขยะ <span class="cpill-cnt">' + statusCounts.trash + '</span></div>' : '') +
    '</div>';

  // Category filter pills
  if (cats.length) {
    h += '<div class="note-cpills">' +
      '<div class="note-cpill ' + (noteFilter==='all'?'act':'') + '" onclick="noteFilter=\'all\';render()">ทุกหมวด</div>';
    cats.forEach(function(cat) {
      h += '<div class="note-cpill ' + (noteFilter===cat?'act':'') + '" onclick="noteFilter=\'' + cat.replace(/'/g,"\\'") + '\';render()">' + sanitize(cat) + ' <span class="cpill-cnt">' + (catCounts[cat]||0) + '</span></div>';
    });
    h += '</div>';
  }

  // Notes content
  if (noteStatusFilter === 'trash') {
    if (!notes.length) {
      h += '<div class="empty"><div class="icon">🗑️</div><p>ถังขยะว่างเปล่า</p></div>';
    } else {
      h += '<div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">';
      h += '<span style="font-size:12px;color:var(--text2)">📌 กู้คืนหรือลบถาวรได้</span>';
      h += '<button class="btn bsm bd" onclick="emptyKBTrash()">🗑️ ล้างถังขยะ</button>';
      h += '</div>';
      h += '<div class="note-grid">' + notes.map(function(n) {
        return '<div class="note-grid-card" style="opacity:.8">' +
          '<div style="font-weight:700;font-size:12px;margin-bottom:4px">' + sanitize(n.title || 'ไม่มีชื่อ') + '</div>' +
          '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;max-height:40px;overflow:hidden">' + sanitize((n.content || '').substr(0, 80)) + '</div>' +
          '<div style="display:flex;gap:5px">' +
          '<button class="btn bsm bp btn-full" style="font-size:10px" onclick="restoreKBNote(\'' + n.id + '\')">♻️ กู้คืน</button>' +
          '<button class="btn bsm bd" style="font-size:10px" onclick="hardDelKBNote(\'' + n.id + '\')">🗑️ ลบถาวร</button>' +
          '</div></div>';
      }).join('') + '</div>';
    }
  } else if (!notes.length) {
    h += '<div class="empty"><div class="icon">📚</div><p>ไม่มี Note' + (noteSearch ? ' ที่ตรงกับ "' + sanitize(noteSearch) + '"' : '') + '</p></div>';
  } else if (noteView === 'grid') {
    h += noteGridHTML(notes, cats);
  } else {
    var canGroup = noteFilter === 'all' && !noteSearch && cats.length;
    h += noteListHTML(notes, cats, canGroup);
  }

  h += '<div style="font-size:.64rem;color:var(--text2);margin-top:6px">' + notes.length + ' note' + (noteSearch ? ' · ค้นหา: "' + sanitize(noteSearch) + '"' : '') + '</div>';

  el.innerHTML = h;
  if (noteSearch) {
    var srcEl = document.getElementById('noteSrc');
    if (srcEl) { srcEl.focus(); srcEl.setSelectionRange(noteSearch.length, noteSearch.length); }
  }
}

function noteListHTML(notes, cats, groupByCat) {
  if (!groupByCat) {
    return '<div>' + notes.map(function(n) { return noteCardHTML(n, cats); }).join('') + '</div>';
  }
  var groups = {}, catOrder = [];
  notes.forEach(function(n) {
    var cat = n.category || '📌 อื่นๆ';
    if (!groups[cat]) { groups[cat] = []; catOrder.push(cat); }
    groups[cat].push(n);
  });
  var h = '';
  catOrder.forEach(function(cat) {
    var color = noteCatColor(cat, cats);
    h += '<div class="note-cat-group">' +
      '<div class="note-cat-header">' +
        '<div class="note-cat-accent" style="background:' + color + '"></div>' +
        '<div class="note-cat-name">' + sanitize(cat) + '</div>' +
        '<div class="note-cat-count">' + groups[cat].length + ' note</div>' +
      '</div>' +
      groups[cat].map(function(n) { return noteCardHTML(n, cats); }).join('') +
      '</div>';
  });
  return h;
}

function noteGridHTML(notes, cats) {
  return '<div class="note-grid">' + notes.map(function(n) { return noteGridCardHTML(n, cats); }).join('') + '</div>';
}

function noteGridCardHTML(n, cats) {
  if (!cats) { var cfg2 = getConfig(); cats = (cfg2 && cfg2.noteCategories) || []; }
  var status = n.status || 'active';
  var isInactive = status === 'expired' || status === 'cancelled';
  var color = noteCatColor(n.category || '📌 อื่นๆ', cats);
  var badge = status === 'expired' ? '<span class="note-badge red">⏰ หมด</span>'
    : status === 'cancelled' ? '<span class="note-badge red">❌</span>'
    : status === 'draft'     ? '<span class="note-badge grey">📝</span>'
    : (n.expireDate && dTo(n.expireDate) >= 0 && dTo(n.expireDate) <= 30) ? '<span class="note-badge warn">📅</span>'
    : '<span class="note-badge green">✅</span>';
  return '<div class="note-grid-card' + (n.pinned?' pinned':'') + '" onclick="go(\'noteDetail\',{noteId:\'' + n.id + '\'})" style="' + (isInactive?'opacity:.5;':'') + '">' +
    '<div class="note-gc-top-bar" style="background:' + color + '"></div>' +
    '<div style="padding:10px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">' +
        '<span class="note-badge" style="background:' + color + '22;color:' + color + '">' + sanitize(n.category || '📌 อื่นๆ') + '</span>' +
        '<span style="display:flex;gap:4px;align-items:center">' + (_noteHasImage(n) ? '<span class="note-badge" style="background:rgba(59,130,246,.15);color:#3b82f6" title="มีรูปแนบ">🖼️</span>' : '') + badge + '</span>' +
      '</div>' +
      '<div class="note-gc-title">' + (n.pinned?'📌 ':'') + sanitize(n.title || 'ไม่มีชื่อ') + '</div>' +
      '<div class="note-gc-preview">' + sanitize((n.content||'').substr(0, 100)) + '</div>' +
      '<div class="note-gc-meta">' + fDShort(n.created ? n.created.split('T')[0] : '') + '</div>' +
      (_noteLinksArray(n).length ? '<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:4px">' + _noteLinkBtnsHtml(n) + '</div>' : '') +
    '</div>' +
  '</div>';
}

// ปุ่มลิงก์สั้นๆ บนการ์ด — เดิมต้องกดเข้า noteDetail แล้วเลื่อนไปหาลิงก์ในเนื้อหาก่อนถึงจะกดได้ (ผู้ใช้ขอ
// 2026-09-02 ให้กดจากหน้าการ์ดได้เลย) ใช้ n.links (คั่นบรรทัด เหมือนที่ rNoteDet ใช้อยู่แล้ว) — ไม่ต้อง
// เพิ่ม field ใหม่ stopPropagation กันไม่ให้ลิงก์ก็เด้งเข้า noteDetail ไปด้วย
function _noteLinksArray(n) {
  return (n.links || '').split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
}
function _noteLinkBtnsHtml(n) {
  var links = _noteLinksArray(n);
  if (!links.length) return '';
  return links.map(function(url, i) {
    var safeUrl = sanitize(url).replace(/'/g, "\\'");
    return '<span class="note-badge" style="background:rgba(59,130,246,.15);color:#3b82f6;cursor:pointer" ' +
      'onclick="event.stopPropagation();window.open(\'' + safeUrl + '\',\'_blank\')" title="' + sanitize(url) + '">🔗 Link' + (links.length > 1 ? ' ' + (i + 1) : '') + '</span>';
  }).join('');
}

function noteCardHTML(n, cats) {
  if (!cats) { var cfg2 = getConfig(); cats = (cfg2 && cfg2.noteCategories) || []; }
  var status = n.status || 'active';
  var isInactive = status === 'expired' || status === 'cancelled';
  var color = noteCatColor(n.category || '📌 อื่นๆ', cats);
  var badge = status === 'expired' ? '<span class="note-badge red">⏰ หมด</span>'
    : status === 'cancelled' ? '<span class="note-badge red">❌ ยกเลิก</span>'
    : status === 'draft'     ? '<span class="note-badge grey">📝 Draft</span>'
    : (n.expireDate && dTo(n.expireDate) >= 0 && dTo(n.expireDate) <= 30) ? '<span class="note-badge warn">📅 ใกล้หมด ' + fDShort(n.expireDate) + '</span>'
    : (n.remindDate && dTo(n.remindDate) >= 0 && dTo(n.remindDate) <= 3) ? '<span class="note-badge warn">🔔 ' + fDShort(n.remindDate) + '</span>'
    : '';
  var tags = n.tags ? n.tags.split(',').filter(function(t){return t.trim();}) : [];
  var hasImg = _noteHasImage(n);
  return '<div class="note-list-card' + (n.pinned?' pinned':'') + '" style="' + (isInactive?'opacity:.5;':'') + '">' +
    '<div class="note-lc-icon" style="background:' + color + '22;color:' + color + '">' + _noteCatIcon(n.category) + '</div>' +
    '<div class="note-lc-body" onclick="go(\'noteDetail\',{noteId:\'' + n.id + '\'})">' +
      '<div class="note-lc-top">' +
        '<div class="note-lc-title">' + (n.pinned?'📌 ':'') + sanitize(n.title || 'ไม่มีชื่อ') + '</div>' +
        (hasImg ? '<span class="note-badge" style="background:rgba(59,130,246,.15);color:#3b82f6" title="มีรูปแนบ">🖼️</span>' : '') +
        badge +
      '</div>' +
      '<div class="note-lc-preview">' + sanitize((n.content||'').substr(0,130)) + '</div>' +
      '<div class="note-lc-meta">' +
        '<span class="note-badge" style="background:' + color + '22;color:' + color + '">' + sanitize(n.category||'📌 อื่นๆ') + '</span>' +
        '<span class="nlm-date">' + fDShort(n.created ? n.created.split('T')[0] : '') + '</span>' +
        (tags.length ? tags.map(function(t){return '<span class="note-badge grey">#' + sanitize(t.trim()) + '</span>';}).join('') : '') +
        _noteLinkBtnsHtml(n) +
      '</div>' +
    '</div>' +
    '<div class="note-lc-qs">' +
      '<button class="qs-btn" onclick="event.stopPropagation();showNoteM(\'' + n.id + '\')" title="แก้ไข">✏️</button>' +
      '<button class="qs-btn" onclick="event.stopPropagation();ST.update(\'notes\',\'' + n.id + '\',{pinned:' + (!n.pinned) + '});render()" title="' + (n.pinned?'เอาออกจากปัก':'ปักหมุด') + '">' + (n.pinned?'📌':'📍') + '</button>' +
      '<button class="qs-btn" onclick="event.stopPropagation();trashKBNote(\'' + n.id + '\')" title="ย้ายไปถังขยะ">🗑️</button>' +
    '</div>' +
  '</div>';
}

// รูปแนบขึ้นก่อนแบบใหญ่ (grid tile 1:1 + ไอคอนขยายมุมล่างขวา) กดแล้วเปิด lightbox เดิม — ไฟล์ที่ไม่ใช่รูป
// (PDF/Word/Excel/ลิงก์) ยังใช้ attachGalleryHtml() แบบ chip เล็กเหมือนเดิมด้านล่าง แยกจากกัน
// ใช้ร่วมกันได้ทุกเมนูที่มี attachments array (Knowledge Base, Task, ...) ไม่ผูกกับ note โดยเฉพาะ
function bigAttachGalleryHtml(attachments) {
  if (!attachments || !attachments.length) return '';
  var images = attachments.filter(function(a) { return _attachIcon(a) === null; });
  var files = attachments.filter(function(a) { return _attachIcon(a) !== null; });
  var h = '';
  if (images.length) {
    h += '<div style="font-size:11px;color:var(--text2);margin:12px 0 6px">🖼️ รูปแนบ (' + images.length + ')</div>';
    h += '<div class="note-gallery">';
    images.forEach(function(a) {
      var lbUrl = String(a.url || '').replace(/'/g, "\\'");
      var lbName = String(a.name || 'image.jpg').replace(/'/g, "\\'");
      h += '<div class="note-gallery-tile" style="background-image:url(\'' + a.url + '\')" onclick="showImageLightbox(\'' + lbUrl + '\',\'' + lbName + '\')" title="' + sanitize(a.name || '') + '"><span class="note-gallery-zoom">🔍</span></div>';
    });
    h += '</div>';
  }
  if (files.length) h += '<div style="margin-top:10px">' + attachGalleryHtml(files) + '</div>';
  return h;
}

var _noteContentExpanded = {}; // {noteId: true} — เนื้อหายาวที่กดขยายดูเต็มแล้ว (ดู rNoteDet)
function toggleNoteContentExpand(id) {
  _noteContentExpanded[id] = !_noteContentExpanded[id];
  render();
}

function markNoteExpired(noteId) {
  ST.update('notes', noteId, {status: 'expired'});
  toast('⏰ ทำเครื่องหมายหมดอายุแล้ว');
  render();
}

// ================================================================
// NOTE DETAIL PAGE
// ================================================================
function rNoteDet(el) {
  var n = ST.getOne('notes', S.noteId);
  if (!n) return go('knowledge');
  document.getElementById('pgT').textContent = '📚 ' + (n.title || '').substr(0, 25);
  
  var tags = (n.tags || '').split(',').filter(function(t) { return t.trim(); });
  var status = n.status || 'active';
  var dealer = n.dealerId ? ST.getOne('dealers', n.dealerId) : null;
  var isInactive = status === 'expired' || status === 'cancelled';
  
  var statusBadge = '';
  var statusAction = '';
  if (status === 'active') {
    statusBadge = '<span class="tag tag-completed">✅ ใช้งานอยู่</span>';
    statusAction = '<button class="btn bsm bw" onclick="changeNoteStatus(\'' + n.id + '\',\'expired\')">⏰ หมดอายุ</button>' +
      '<button class="btn bsm bd" onclick="changeNoteStatus(\'' + n.id + '\',\'cancelled\')">❌ ยกเลิก</button>';
  } else if (status === 'expired') {
    statusBadge = '<span class="tag tag-cancelled">⏰ หมดอายุ</span>';
    statusAction = '<button class="btn bsm bs" onclick="changeNoteStatus(\'' + n.id + '\',\'active\')">✅ ใช้งานอีกครั้ง</button>';
  } else if (status === 'cancelled') {
    statusBadge = '<span class="tag tag-cancelled">❌ ยกเลิกแล้ว</span>';
    statusAction = '<button class="btn bsm bs" onclick="changeNoteStatus(\'' + n.id + '\',\'active\')">✅ ใช้งานอีกครั้ง</button>';
  } else if (status === 'draft') {
    statusBadge = '<span class="tag tag-on-hold">📝 Draft</span>';
    statusAction = '<button class="btn bsm bs" onclick="changeNoteStatus(\'' + n.id + '\',\'active\')">✅ เผยแพร่</button>';
  }

  var html = '';
  html += navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '';
  html += '<div class="bc"><a onclick="go(\'knowledge\')">📚 Knowledge Base</a><span class="sep">›</span><span class="cur">' + sanitize((n.title || '').substr(0, 35)) + '</span></div>';
  html += '<div class="card" style="' + (isInactive ? 'opacity:.6;' : '') + '">';
  html += '<h2>' + sanitize(n.title || 'ไม่มีชื่อ') + ' ' + statusBadge + ' <span class="ml">' +
    '<button class="btn bsm ' + (n.pinned ? 'bw' : 'bo') + '" onclick="toggleNotePin(\'' + n.id + '\')">' + (n.pinned ? '📌' : '📌 Pin') + '</button>' +
    '<button class="btn bsm bo" onclick="copyNoteContent(\'' + n.id + '\')">📋</button>' +
    '<button class="btn bsm bo" onclick="showNoteM(\'' + n.id + '\')">✏️</button>' +
    '<button class="btn bsm bd" onclick="trashKBNote(\'' + n.id + '\',true)">🗑️</button>' +
    '</span></h2>';
  html += '<div class="note-meta" style="margin-bottom:10px">' +
    '<span class="note-cat-badge">' + (n.category || 'อื่นๆ') + '</span>' +
    '<span>สร้าง: ' + fDT(n.created) + '</span>' +
    (n.updated ? '<span>แก้ไข: ' + fDT(n.updated) + '</span>' : '') +
    (dealer ? '<span>🏪 ' + dealer.name + '</span>' : '') +
    '</div>';
  
  if (n.expireDate || n.remindDate) {
    html += '<div style="display:flex;gap:10px;margin-bottom:10px;font-size:.76rem">';
    if (n.expireDate) html += '<span style="color:' + (dTo(n.expireDate) <= 0 ? '#ef4444' : '#94a3b8') + '">📅 หมดอายุ: ' + fD(n.expireDate) + ' ' + dlB(n.expireDate, false) + '</span>';
    if (n.remindDate) html += '<span style="color:' + (dTo(n.remindDate) <= 3 ? '#f59e0b' : '#94a3b8') + '">🔔 เตือน: ' + fD(n.remindDate) + ' ' + dlB(n.remindDate, false) + '</span>';
    html += '</div>';
  }
  
  html += '<div class="bg" style="margin-bottom:10px">' + statusAction + '</div>';
  
  if (tags.length) {
    html += '<div class="note-tags" style="margin-bottom:10px">' + tags.map(function(t) { return '<span class="note-tag">' + sanitize(t.trim()) + '</span>'; }).join('') + '</div>';
  }
  
  // เนื้อหายาวมากๆ กินหน้าจอทั้งหมด — พับเก็บไว้ก่อน (max-height + gradient fade) เกิน 500 ตัวอักษรค่อยโชว์ปุ่มขยาย/ย่อ
  var _noteIsLong = (n.content || '').length > 500;
  var _noteExpanded = !!_noteContentExpanded[n.id];
  if (_noteIsLong && !_noteExpanded) {
    html += '<div style="position:relative;max-height:220px;overflow:hidden">' +
      '<div class="note-content">' + safeText(n.content || '') + '</div>' +
      '<div style="position:absolute;left:0;right:0;bottom:0;height:56px;background:linear-gradient(transparent,var(--card,#1e293b))"></div>' +
      '</div>';
    html += '<div style="text-align:center;margin-top:4px"><button class="btn bsm bo" onclick="toggleNoteContentExpand(\'' + n.id + '\')">▾ ดูเพิ่มเติม</button></div>';
  } else {
    html += '<div class="note-content">' + safeText(n.content || '') + '</div>';
    if (_noteIsLong) html += '<div style="text-align:center;margin-top:4px"><button class="btn bsm bo" onclick="toggleNoteContentExpand(\'' + n.id + '\')">▴ ย่อกลับ</button></div>';
  }
  html += bigAttachGalleryHtml(n.attachments);

  if (n.links) {
    html += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:8px"><div style="font-size:.76rem;color:var(--text2);margin-bottom:4px">🔗 Links:</div>';
    n.links.split('\n').filter(function(l) { return l.trim(); }).forEach(function(l) {
      var url = l.trim();
      html += '<div style="margin-bottom:2px"><a href="' + url + '" target="_blank" style="font-size:.76rem">' + url.substr(0, 60) + (url.length > 60 ? '...' : '') + ' ↗</a></div>';
    });
    html += '</div>';
  }
  
  html += '</div>';
  el.innerHTML = html;
}

function changeNoteStatus(noteId, newStatus) {
  var labels = {active: '✅ ใช้งาน', expired: '⏰ หมดอายุ', cancelled: '❌ ยกเลิก', draft: '📝 Draft'};
  ST.update('notes', noteId, {status: newStatus});
  toast(labels[newStatus] || newStatus);
  render();
}

function toggleNotePin(noteId) {
  var n = ST.getOne('notes', noteId);
  if (!n) return;
  ST.update('notes', noteId, {pinned: !n.pinned});
  toast(n.pinned ? '❌ เอาออกจากหมุด' : '📌 ปักหมุดแล้ว');
  render();
}

function copyNoteContent(noteId) {
  var n = ST.getOne('notes', noteId);
  if (!n) return;
  var text = (n.title || '') + '\n\n' + (n.content || '');
  if (n.links) text += '\n\nLinks:\n' + n.links;
  copyText(text, '📋 Copy เนื้อหาแล้ว');
}

function deleteNote(noteId) { trashKBNote(noteId, true); } // backward-compat

function trashKBNote(noteId, navigateBack) {
  ST.update('notes', noteId, { status: 'trash', deletedAt: new Date().toISOString() });
  toast('🗑️ ย้ายไปถังขยะแล้ว — กดถังขยะเพื่อกู้คืน');
  if (navigateBack) go('knowledge'); else render();
}

function restoreKBNote(noteId) {
  ST.update('notes', noteId, { status: 'active', deletedAt: null });
  toast('♻️ กู้คืนแล้ว');
  render();
}

function hardDelKBNote(noteId) {
  if (!confirm('ลบถาวร? ไม่สามารถกู้คืนได้อีก')) return;
  ST.delete('notes', noteId);
  toast('🗑️ ลบถาวรแล้ว');
  render();
}

function emptyKBTrash() {
  if (!confirm('ล้างถังขยะทั้งหมด? ไม่สามารถกู้คืนได้อีก')) return;
  ST.getAll('notes').filter(function(n) { return n.status === 'trash'; })
    .forEach(function(n) { ST.delete('notes', n.id); });
  toast('🗑️ ล้างถังขยะแล้ว');
  render();
}

// ================================================================
// REMINDERS PAGE
// ================================================================
function rRemind(el) {
  document.getElementById('pgT').textContent = '🔔 แจ้งเตือน';
  // ทางลัดไปหน้า Insights — เดิมเป็นเมนูแยกในไซด์บาร์ ยุบมารวมเป็นปุ่มในหน้านี้แทนเพื่อลดจำนวนเมนู (2026-08-31)
  // หน้า insights เองไม่ได้แก้/ย้ายอะไร ยังทำงานเหมือนเดิมทุกอย่าง แค่ไม่มีลิงก์แยกในไซด์บาร์แล้ว
  var h0 = '<div style="margin-bottom:10px"><button class="btn bsm bp">🔔 แจ้งเตือน</button> <button class="btn bsm bo" onclick="go(\'insights\')">🤖 Insights</button></div>';

  var urgTasks = getUrgentItems();
  var bidUrg = [];
  var waitUrg = [];
  var waitAll = [];
  var mtUrg = [];
  var stale = [];
  var noContact = [];
  
  try { bidUrg = ST.filter('pipeline', function(p) { return p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 3 && pipeIsOpen(p); }); } catch(e) {}
  try { waitUrg = ST.filter('waiting', function(w) { return !w.resolved && w.dueDate && dTo(w.dueDate) <= 0; }); } catch(e) {}
  try { waitAll = ST.filter('waiting', function(w) { return !w.resolved; }).sort(function(a,b) { return (a.dueDate||'z').localeCompare(b.dueDate||'z'); }); } catch(e) {}
  try { mtUrg = ST.filter('meetings', function(m) { return dTo(m.date) >= 0 && dTo(m.date) <= 3; }).sort(function(a,b) { return a.date.localeCompare(b.date); }); } catch(e) {}
  try { stale = getStalePipelines(); } catch(e) {}
  
  var dealerStatus = getDealerContactStatus();
  noContact = (dealerStatus || []).filter(function(d) { return (d.lastContactDays === null || d.lastContactDays > 14) && d.level && d.level !== 'Other'; });

  var h = h0;

  if (bidUrg.length) {
    h += '<div class="card"><h2>⏳ Bidding ใกล้ถึง</h2>' + bidUrg.map(function(p) { return pipeListItem(p); }).join('') + '</div>';
  }
  
  if (urgTasks.length) {
    h += '<div class="card"><h2>📋 งานใกล้/เลย Deadline</h2>' + urgTasks.map(function(i) {
      return '<div class="li ' + dlC(i.dueDate, false) + '" onclick="go(\'taskDetail\',{taskId:\'' + i.refId + '\'})"><div class="lm"><div class="lt">' + sanitize(i.title) + '</div><div class="ls">' + dlB(i.dueDate, false) + '</div></div></div>';
    }).join('') + '</div>';
  }
  
  h += '<div class="card"><h2>📭 รอคนอื่น (' + waitAll.length + ') <span class="ml"><button class="btn bsm bp" onclick="showWaitM()">➕</button></span></h2>';
  if (waitAll.length) {
    waitAll.forEach(function(w) {
      var isOver = w.dueDate && dTo(w.dueDate) < 0;
      var isWarn = w.dueDate && dTo(w.dueDate) <= 3 && dTo(w.dueDate) >= 0;
      var days = w.sentDate ? daysBetween(w.sentDate, _td()) : 0;
      h += '<div class="wait-card ' + (isOver ? 'overdue' : '') + (isWarn ? 'warning' : '') + '">' +
        '<div style="flex:1"><div class="wait-title">' + sanitize(w.title) + '</div>' +
        '<div class="wait-days">' + (w.person ? '👤 ' + sanitize(w.person) : '') + (w.sentDate ? '• ส่ง: ' + fDShort(w.sentDate) : '') + (days ? '• รอ ' + days + 'd' : '') + (w.dueDate ? '• กำหนด: ' + fDShort(w.dueDate) + ' ' + dlB(w.dueDate, false) : '') + '</div></div>' +
        '<button class="btn bsm bs" onclick="ST.resolveWaiting(\'' + w.id + '\');toast(\'✅\');render()">✅</button>' +
        '<button class="btn bsm bd" onclick="if(confirm(\'ลบรายการนี้?\'))(ST.delete(\'waiting\',\'' + w.id + '\'),render())">✕</button></div>';
    });
  } else {
    h += '<div class="empty"><p>✅ ไม่มีรายการที่รอ</p></div>';
  }
  h += '</div>';
  
  if (noContact.length) {
    h += '<div class="card"><h2>📞 ไม่ติดต่อ > 14 วัน (' + noContact.length + ')</h2>' +
      noContact.slice(0, 10).map(function(d) {
        return '<div class="li" onclick="go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})"><div class="lm"><div class="lt"><span class="health-dot ' + d.contactStatus + '"></span> ' + sanitize(d.name) + ' ' + levelTag(d.level) + '</div><div class="ls">' + contactLabel(d.lastContactDays) + '</div></div><span class="dealer-act" onclick="event.stopPropagation();showFollowupM(\'' + d.id + '\')">📞</span></div>';
      }).join('') + '</div>';
  }
  
  if (stale.length) {
    h += '<div class="card"><h2>🔄 Pipeline ไม่อัพเดต > 14 วัน (' + stale.length + ')</h2>' + stale.map(function(p) { return pipeListItem(p); }).join('') + '</div>';
  }
  
  if (mtUrg.length) {
    h += '<div class="card"><h2>📅 ประชุมใน 3 วัน</h2>' + mtUrg.map(function(m) {
      return '<div class="li" onclick="go(\'meetingDetail\',{meetingId:\'' + m.id + '\'})"><div class="lm"><div class="lt">' + sanitize(m.title) + '</div><div class="ls">' + fD(m.date) + ' ' + (m.time || '') + ' ' + dlB(m.date, false) + '</div></div></div>';
    }).join('') + '</div>';
  }

  var stockRem = [];
  try { stockRem = stockGetReminders(); } catch(e) {}
  if (stockRem.length) {
    h += '<div class="card"><h2>📦 Stock ต้องติดตาม (' + stockRem.length + ')</h2>' + stockRem.map(function(i) {
      return '<div class="li ' + dlC(i.date, false) + '" onclick="go(\'stockDetail\',{sku:\'' + i.sku + '\',lotId:\'' + i.lotId + '\'})"><div class="lm"><div class="lt">' + sanitize(i.label) + '</div><div class="ls">' + fD(i.date) + ' ' + dlB(i.date, false) + '</div></div></div>';
    }).join('') + '</div>';
  }

  var soReadyRem = [];
  try { soReadyRem = soGetReadyReminders(); } catch(e) {}
  if (soReadyRem.length) {
    h += '<div class="card"><h2>📦 SO พร้อมส่งแล้ว (' + soReadyRem.length + ')</h2>' + soReadyRem.map(function(i) {
      return '<div class="li" onclick="go(\'soDetail\',{soId:\'' + i.soId + '\'})"><div class="lm"><div class="lt">' + sanitize(i.label) + '</div><div class="ls">รอกดเปลี่ยนสถานะเป็นส่งแล้ว</div></div></div>';
    }).join('') + '</div>';
  }
  
  h += '<div class="card"><h2>🔔 Browser Notification</h2>' +
    '<button class="btn bs" onclick="if(\'Notification\' in window)Notification.requestPermission().then(p=>toast(p===\'granted\'?\'✅ เปิดแล้ว\':\'❌\'));else toast(\'ไม่รองรับ\',true)">🔔 เปิดการแจ้งเตือน</button>' +
    '<div style="margin-top:4px;font-size:.7rem;color:var(--text2)">' + ('Notification' in window ? 'สถานะ: ' + Notification.permission : 'ไม่รองรับ') + '</div></div>';
  
  el.innerHTML = h;
}

// ================================================================
// INSIGHTS PAGE
// ================================================================
function rInsights(el) {
  document.getElementById('pgT').textContent = '🤖 Insights';
  var insights = generateInsights();
  var sf = getSmartFilters();
  // ทางลัดกลับไปหน้าแจ้งเตือน — คู่กับปุ่มใน rRemind (ดูคอมเมนต์ที่นั่น)
  var h = '<div style="margin-bottom:10px"><button class="btn bsm bo" onclick="go(\'reminders\')">🔔 แจ้งเตือน</button> <button class="btn bsm bp">🤖 Insights</button></div>';

  h += '<div class="card"><h2>🔍 Smart Filters</h2>' +
    '<div class="sf-grid">' + (sf || []).map(function(f) {
      return '<div class="sf-card" onclick="go(\'smartFilter\',{filterId:\'' + f.id + '\'})">' +
        '<div class="sf-icon">' + f.icon + '</div><div class="sf-info"><div class="sf-name">' + f.name + '</div></div>' +
        '<div class="sf-count" style="color:' + f.color + '">' + f.count + '</div></div>';
    }).join('') + '</div></div>';
  
  h += '<div class="card"><h2>🤖 Smart Insights</h2>';
  if (insights && insights.length) {
    h += insights.map(function(i) {
      return '<div class="insight-card">' +
        '<div class="insight-icon">' + i.icon + '</div>' +
        '<div class="insight-body">' +
        '<div class="insight-title">' + sanitize(i.title) + '</div>' +
        '<div class="insight-desc">' + sanitize(i.desc) + '</div>' +
        '</div></div>';
    }).join('');
  } else {
    h += '<div class="empty"><p>ยังไม่มีข้อมูลพอวิเคราะห์</p></div>';
  }
  h += '</div>';
  
  h += '<div class="card"><h2>📊 Win/Loss Analysis</h2>' + renderWinLoss() + '</div>';
  
  el.innerHTML = h;
}

function renderWinLoss() {
  var pipes = [];
  try { pipes = ST.getAll('pipeline'); } catch(e) { pipes = []; }
  var won = (pipes || []).filter(function(p) { return pipeIsWon(p); });
  var lost = (pipes || []).filter(function(p) { return p.status === 'fail_lost'; });
  var total = won.length + lost.length;
  
  if (total < 1) return '<div class="empty"><p>ยังไม่มีข้อมูล Win/Loss</p></div>';
  
  var winRate = total ? Math.round(won.length / total * 100) : 0;
  var wonAmt = won.reduce(function(a,p) { return a + (Number(p.forecastAmount)||0); }, 0);
  var lostAmt = lost.reduce(function(a,p) { return a + (Number(p.forecastAmount)||0); }, 0);
  
  var reasons = {};
  lost.forEach(function(p) {
    var r = p.lossReason || 'ไม่ระบุ';
    reasons[r] = (reasons[r]||0) + 1;
  });
  
  return '<div class="sr" style="margin-bottom:8px">' +
    '<div class="sc"><div class="sn c2">' + won.length + '</div><div class="sl">✅ Win</div></div>' +
    '<div class="sc"><div class="sn c4">' + lost.length + '</div><div class="sl">❌ Lost</div></div>' +
    '<div class="sc"><div class="sn ' + (winRate >= 60 ? 'c2' : 'c4') + '">' + winRate + '%</div><div class="sl">Win Rate</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(wonAmt) + '</div><div class="sl">Won Value</div></div>' +
    '</div>' +
    (Object.keys(reasons).length ? '<div style="font-size:.78rem;color:var(--text2);margin-bottom:4px">สาเหตุที่แพ้:</div>' +
      Object.entries(reasons).sort(function(a,b) { return b[1]-a[1]; }).map(function(r) {
        return '<div class="wl-reason"><span style="flex:1">' + sanitize(r[0]) + '</span><span style="font-weight:700;color:#ef4444">' + r[1] + ' ครั้ง</span></div>';
      }).join('') : '');
}

function generateInsights() {
  var insights = [];
  var pipes = [];
  var dealers = [];
  try { pipes = ST.getAll('pipeline'); } catch(e) { pipes = []; }
  try { dealers = ST.getAll('dealers'); } catch(e) { dealers = []; }
  
  var totalClosed = (pipes || []).filter(function(p) { return pipeIsWon(p) || pipeIsLost(p); }).length;
  var totalWon = (pipes || []).filter(function(p) { return pipeIsWon(p); }).length;
  if (totalClosed >= 3) {
    var winRate = Math.round(totalWon / totalClosed * 100);
    insights.push({icon: winRate >= 60 ? '📈' : '📉', title: 'Win Rate: ' + winRate + '%', desc: totalWon + ' ชนะ จาก ' + totalClosed + ' ที่จบ', priority: winRate < 50 ? 'high' : 'low'});
  }
  
  var ps = getPipeSummary();
  var totalTarget = (dealers || []).reduce(function(a,d) { return a + (Number(d.targetRevenue) || 0); }, 0);
  if (totalTarget > 0) {
    var pct = Math.round((ps.totalWon || 0) / totalTarget * 100);
    insights.push({icon: pct >= 70 ? '🎯' : '⚠️', title: 'Achievement: ' + pct + '%', desc: fmtMoney(ps.totalWon || 0) + ' / ' + fmtMoney(totalTarget), priority: pct < 50 ? 'high' : 'low'});
  }
  
  var _giCfg = getConfig(); // ครั้งเดียว — calcHealthScore เดิมเรียก getConfig() เองต่อ Dealer
  var badHealth = (dealers || []).filter(function(d) { return calcHealthScore(d.id, _giCfg).score < 40; });
  if (badHealth.length) insights.push({icon: '🏥', title: badHealth.length + ' Dealer ต้องดูแลด่วน', desc: badHealth.map(function(d) { return d.name; }).join(', '), priority: 'high'});
  
  var bids = (pipes || []).filter(function(p) { return p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 14 && pipeIsOpen(p); });
  if (bids.length) {
    var bidAmt = bids.reduce(function(a,p) { return a + (Number(p.forecastAmount) || 0); }, 0);
    insights.push({icon: '⏳', title: bids.length + ' Bidding ใน 2 สัปดาห์', desc: 'มูลค่า ' + fmtMoney(bidAmt), priority: 'medium'});
  }
  
  insights.sort(function(a,b) { var o = {high:0,medium:1,low:2}; return (o[a.priority] || 2) - (o[b.priority] || 2); });
  return insights;
}

function getPipeSummary() {
  var cfg = getConfig();
  var all = [];
  try { all = ST.getAll('pipeline'); } catch(e) { all = []; }
  var summary = {};
  var totalPipeline = 0;
  var totalWon = 0;
  var statuses = (cfg && cfg.pipelineStatuses) || [];
  for (var i = 0; i < statuses.length; i++) {
    var s = statuses[i];
    var items = (all || []).filter(function(p) { return p.status === s.id; });
    var amount = items.reduce(function(a,p) { return a + (Number(p.forecastAmount)||0); }, 0);
    summary[s.id] = {count: items.length, amount: amount, name: s.name, color: s.color};
    if (['fail_lost'].indexOf(s.id) === -1) totalPipeline += amount;
    if (getStatusIdsByCategory('won').indexOf(s.id) !== -1) totalWon += amount;
  }
  return {summary: summary, totalPipeline: totalPipeline, totalWon: totalWon, totalCount: all.length};
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
    } else if (t.type === 'custom' && t.forDealer) {
      h += '<div class="email-tmpl-card" onclick="showDealerEmailPickerM(\'' + t.id + '\')">';
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
    var allPipes = [];
    try { allPipes = ST.getAll('pipeline'); } catch(e) { allPipes = []; }
    var active = allPipes.filter(function(p) { return pipeIsOpen(p); });
    var activeAmt = 0;
    active.forEach(function(p) { activeAmt += (Number(p.forecastAmount) || 0); });
    subject = 'DJI Pipeline Update — ' + today + ' — ' + cfg.saleName;
    to = (cfg.emailRecipients && cfg.emailRecipients.onlinePlan) ? cfg.emailRecipients.onlinePlan.join(', ') : '';
    body = 'Dear DJI Team,\n\n';
    body += 'Pipeline Update:\n';
    body += '• Active Projects: ' + active.length + '\n';
    body += '• Total Forecast: ฿' + fmtMoney(activeAmt) + '\n\n';
    body += 'Key Updates:\n';
    var recentLogs = [];
    try { recentLogs = JSON.parse(localStorage.getItem('v7_pipelog') || '[]'); } catch(e) { recentLogs = []; }
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
    subject = 'Visit Plan — สัปดาห์ ' + fD(fmtDateKey(weekStart)) + ' — ' + cfg.saleName;
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
    var allPipes2 = [];
    try { allPipes2 = ST.getAll('pipeline'); } catch(e) { allPipes2 = []; }
    var active2 = allPipes2.filter(function(p) { return pipeIsOpen(p); });
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

  body += '\n\nBest Regards,\n';
  body += (cfg.saleName || 'Siwawong') + '\n';
  body += 'SIS Distribution (Thailand) PLC\n';
  body += 'DJI Authorized Distributor';

  showEmailPreview(to, subject, body);
}

function showVisitReportEmailM() {
  var dealers = [];
  try { dealers = ST.getAll('dealers'); } catch(e) { dealers = []; }
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
  h += '<button class="btn bp" onclick="generateVisitReportEmail()">📧 สร้าง Email</button>';
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

  var visits = [];
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }
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
  var visits = [];
  try { visits = JSON.parse(localStorage.getItem('v7_visits') || '[]'); } catch(e) { visits = []; }
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
  } else if (visit.topics && typeof visit.topics === 'object') {
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

  if (visit.revenue || visit.expectedRevenue) {
    body += '💰 ยอดขาย:\n';
    if (visit.revenue) body += '• ยอดขายปัจจุบัน: ฿' + fmtMoney(visit.revenue) + '\n';
    if (visit.expectedRevenue) body += '• เป้าที่คาด: ฿' + fmtMoney(visit.expectedRevenue) + '\n';
    if (visit.customerSegment) body += '• กลุ่มลูกค้า: ' + visit.customerSegment + '\n';
    body += '\n';
  }

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

  if (visit.forecastNotes && visit.forecastNotes.length) {
    var hasFc = false;
    visit.forecastNotes.forEach(function(fn) { if (fn.month || fn.amount || fcHasItems(fn)) hasFc = true; });
    if (hasFc) {
      body += '📦 Forecast:\n';
      visit.forecastNotes.forEach(function(fn) {
        if (!fn.month && !fn.amount && !fcHasItems(fn)) return;
        body += '• ' + (typeof fcMonthLabel === 'function' ? fcMonthLabel(fn.month) : (fn.month || '-'));
        if (fn.amount) body += ' — ฿' + fmtMoney(fn.amount);
        if (fcHasItems(fn)) body += ' — ' + fcItemsText(fn);
        body += '\n';
      });
      body += '\n';
    }
  }

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

function generateCustomEmailDraft(tmplId) {
  var templates = getEmailTemplates();
  var tmpl = null;
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].id === tmplId) { tmpl = templates[i]; break; }
  }
  if (!tmpl) return;

  var cfg = getConfig();
  var subject = _applyCustomVars((tmpl.subject || tmpl.name || '').replace(/\{sale\}/g, cfg.saleName || 'Siwawong').replace(/\{date\}/g, _td()));
  var body = _applyCustomVars((tmpl.body || '').replace(/\{sale\}/g, cfg.saleName || 'Siwawong').replace(/\{date\}/g, _td()));

  showEmailPreview(tmpl.to || '', subject, body);
}

// ตัวแปรที่ผู้ใช้ตั้งเอง เช่น {signature} — ข้อความคงที่ที่ใช้ซ้ำได้ทั้ง Template ปกติและ Template Dealer
// เก็บแยกจาก getEmailTemplates() เพราะเป็นคนละ concern (นี่คือ "คำ" ไม่ใช่ "จดหมาย")
function getEmailCustomVars() {
  try { return JSON.parse(localStorage.getItem('v7_emailCustomVars') || '[]'); } catch(e) { return []; }
}
function saveEmailCustomVars(list) { localStorage.setItem('v7_emailCustomVars', JSON.stringify(list)); }
function _applyCustomVars(s) {
  var vars = getEmailCustomVars();
  s = s || '';
  for (var i = 0; i < vars.length; i++) {
    var re = new RegExp('\\{' + vars[i].key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}', 'g');
    s = s.replace(re, vars[i].value);
  }
  return s;
}

function manageEmailCustomVarsM() {
  var vars = getEmailCustomVars();
  var h = '<div style="max-width:420px">';
  h += '<p style="font-size:12px;color:var(--text2);margin-bottom:10px">ตัวแปรของคุณเอง เช่น <code>{signature}</code> — แทรกในหัวเรื่อง/เนื้อหา Template ไหนก็ได้เหมือนตัวแปรทั่วไป</p>';
  h += '<div id="ecvList">';
  if (!vars.length) h += '<div style="font-size:12px;color:var(--text2);padding:6px 0">ยังไม่มีตัวแปรของฉัน</div>';
  vars.forEach(function(v, i) {
    h += '<div class="link-item"><span style="font-family:monospace;font-size:12px;width:110px;overflow:hidden;text-overflow:ellipsis;flex-shrink:0">{' + sanitize(v.key) + '}</span>' +
      '<span style="flex:1;font-size:12px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(v.value) + '</span>' +
      '<button class="btn bsm bd" onclick="_ecvRemove(' + i + ')">✕</button></div>';
  });
  h += '</div>';
  h += '<div style="display:flex;gap:3px;margin-top:6px">' +
    '<input type="text" id="ecv_new_k" placeholder="ชื่อ เช่น signature" style="width:110px">' +
    '<input type="text" id="ecv_new_v" placeholder="ข้อความแทน" style="flex:1">' +
    '<button class="btn bsm bp" onclick="_ecvAdd()">➕</button></div>';
  h += '<button class="btn bp btn-full" style="margin-top:10px" onclick="manageEmailTemplates()">↩️ กลับไปจัดการ Template</button>';
  h += '</div>';
  openM('🧩 ตัวแปรของฉัน', h);
}
function _ecvAdd() {
  var kEl = document.getElementById('ecv_new_k');
  var vEl = document.getElementById('ecv_new_v');
  var k = (kEl.value || '').trim().replace(/[^a-zA-Z0-9_ก-๙]/g, '');
  var val = (vEl.value || '').trim();
  if (!k || !val) return alert('ใส่ชื่อตัวแปรและข้อความแทน');
  var vars = getEmailCustomVars();
  if (vars.some(function(v) { return v.key === k; })) return alert('มีตัวแปรชื่อนี้อยู่แล้ว');
  vars.push({ key: k, value: val });
  saveEmailCustomVars(vars);
  manageEmailCustomVarsM();
}
function _ecvRemove(idx) {
  var vars = getEmailCustomVars();
  vars.splice(idx, 1);
  saveEmailCustomVars(vars);
  manageEmailCustomVarsM();
}

function manageEmailTemplates() {
  var templates = getEmailTemplates();

  var h = '<div style="max-width:500px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<span style="color:var(--text2);font-size:13px">' + templates.length + ' templates</span>';
  h += '<div style="display:flex;gap:6px">';
  h += '<button class="btn-sm btn-blue" onclick="showAddEmailTmplM()">➕ เพิ่ม</button>';
  h += '<button class="btn-sm" onclick="manageEmailCustomVarsM()">🧩 ตัวแปร</button>';
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
      h += '<div class="ltm-preview">' + sanitize(t.desc || '') + ' • ' + (t.type === 'auto' ? 'Auto' : t.type === 'visit' ? 'Visit Report' : t.forDealer ? '📧 Dealer (loop)' : 'Custom') + '</div>';
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

// แผงตัวแปรแบบพับ/ขยายได้ (native <details>, ไม่ต้องเขียน JS toggle เอง) ใช้ร่วมกันทั้งฟอร์ม
// เพิ่ม/แก้ Template — กดชิปเพื่อแทรกตัวแปรที่ตำแหน่งเคอร์เซอร์ของช่องที่โฟกัสล่าสุด (etSubject/etBody)
var _etLastFocused = 'etBody';
function _etTrackFocus(id) { _etLastFocused = id; }
// เมื่อเปิดฟอร์มเพิ่ม/แก้ Template จากปุ่ม ✏️/➕ ในหน้า Email Dealer (views-dealer.js: _dePickerNewTmpl/
// _dePickerEditTmpl ตั้งค่านี้ไว้ก่อนเปิดฟอร์ม) ให้บันทึกเสร็จ/กดกลับแล้วเด้งกลับไปหน้า Email Dealer
// ต่อเลย แทนที่จะไปหน้าจัดการ Template — seamless ไม่ต้องออกจากหน้าที่กำลังส่งอีเมลอยู่
var _etReturnTo = null;
function _etGoBack(tmplId) {
  if (_etReturnTo === 'picker') {
    _etReturnTo = null;
    showDealerEmailPickerM(tmplId || null);
  } else {
    manageEmailTemplates();
  }
}
function _etInsertVar(v) {
  var el = document.getElementById(_etLastFocused) || document.getElementById('etBody');
  if (!el) return;
  var start = el.selectionStart != null ? el.selectionStart : el.value.length;
  var end = el.selectionEnd != null ? el.selectionEnd : el.value.length;
  el.value = el.value.slice(0, start) + v + el.value.slice(end);
  el.focus();
  el.selectionStart = el.selectionEnd = start + v.length;
}
var EMAIL_DEALER_VARS = ['{dealer}', '{contact}', '{contactPhone}', '{contactEmail}', '{sisCode}', '{djiCode}', '{level}', '{saleName}', '{creditTerm}', '{creditLimit}', '{targetRevenue}', '{achieve}', '{googleMap}', '{notes}'];
function _etVarPanelHtml() {
  var customVars = getEmailCustomVars();
  function chip(v) { return '<button type="button" class="btn-xs" onclick="_etInsertVar(\'' + v + '\')" style="font-family:monospace">' + v + '</button>'; }
  var h = '<details style="margin:-4px 0 12px"><summary style="cursor:pointer;font-size:12px;color:var(--text2)">🧩 แทรกตัวแปร (กดเพื่อขยาย)</summary>';
  h += '<div style="margin-top:8px">';
  h += '<div style="font-size:10px;color:var(--text2);margin-bottom:4px">ทั่วไป</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">' + ['{sale}', '{date}'].map(chip).join('') + '</div>';
  h += '<div style="font-size:10px;color:var(--text2);margin-bottom:4px">Dealer (ใช้ได้เฉพาะ Template ที่ติ๊ก "ส่งแยกทีละ Dealer")</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">' + EMAIL_DEALER_VARS.map(chip).join('') + '</div>';
  if (customVars.length) {
    h += '<div style="font-size:10px;color:var(--text2);margin-bottom:4px">ของฉัน</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">' + customVars.map(function(v) { return chip('{' + v.key + '}'); }).join('') + '</div>';
  }
  h += '<button type="button" class="btn-xs" onclick="manageEmailCustomVarsM()">⚙️ ตั้งค่าตัวแปรของฉัน</button>';
  h += '</div></details>';
  return h;
}

function showAddEmailTmplM() {
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>😊 Icon (Emoji)</label>';
  h += '<input type="text" id="etIcon" class="fm-input" value="📧" maxlength="4" style="width:80px;font-size:24px;text-align:center"></div>';
  h += '<div class="fm-group"><label>📌 ชื่อ Template</label>';
  h += '<input type="text" id="etName" class="fm-input" placeholder="เช่น Monthly Report"></div>';
  h += '<div class="fm-group"><label>📝 คำอธิบาย</label>';
  h += '<input type="text" id="etDesc" class="fm-input" placeholder="รายละเอียดสั้นๆ"></div>';
  h += '<div class="fm-group"><label style="display:flex;align-items:center;gap:6px;font-weight:400">';
  h += '<input type="checkbox" id="etForDealer" style="width:auto" onchange="_etToggleDealerHint()"> ส่งแยกทีละ Dealer (เลือกได้จากหน้า Dealer)</label></div>';
  h += '<div class="fm-group" id="etToGroup"><label>📧 To (default)</label>';
  h += '<input type="email" id="etTo" class="fm-input" placeholder="email@company.com"></div>';
  h += _etVarPanelHtml();
  h += '<div class="fm-group"><label>📋 Subject</label>';
  h += '<input type="text" id="etSubject" class="fm-input" placeholder="เช่น Dear {dealer}" onfocus="_etTrackFocus(\'etSubject\')"></div>';
  h += '<div class="fm-group"><label>📝 Body</label>';
  h += '<textarea id="etBody" rows="8" class="fm-input" placeholder="เนื้อหา Email..." onfocus="_etTrackFocus(\'etBody\')"></textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="saveNewEmailTmpl()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="_etGoBack()">↩️ กลับ</button>';
  h += '</div></div>';
  openM('➕ เพิ่ม Email Template', h);
}

function _etToggleDealerHint() {
  var chk = document.getElementById('etForDealer');
  var toGroup = document.getElementById('etToGroup');
  if (!chk) return;
  if (toGroup) toGroup.style.display = chk.checked ? 'none' : '';
}

function saveNewEmailTmpl() {
  var name = (document.getElementById('etName').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }

  var newId = 'et_' + Date.now();
  var templates = getEmailTemplates();
  templates.push({
    id: newId,
    icon: (document.getElementById('etIcon').value || '📧').trim(),
    name: name,
    desc: (document.getElementById('etDesc').value || '').trim(),
    to: (document.getElementById('etTo').value || '').trim(),
    subject: (document.getElementById('etSubject').value || '').trim(),
    body: (document.getElementById('etBody').value || '').trim(),
    forDealer: !!(document.getElementById('etForDealer') && document.getElementById('etForDealer').checked),
    type: 'custom'
  });
  saveEmailTemplates(templates);
  toast('✅ เพิ่ม Template แล้ว');
  _etGoBack(newId);
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
  h += '<div class="fm-group"><label style="display:flex;align-items:center;gap:6px;font-weight:400">';
  h += '<input type="checkbox" id="etForDealer" style="width:auto"' + (t.forDealer ? ' checked' : '') + ' onchange="_etToggleDealerHint()"> ส่งแยกทีละ Dealer (เลือกได้จากหน้า Dealer)</label></div>';
  h += '<div class="fm-group" id="etToGroup" style="display:' + (t.forDealer ? 'none' : '') + '"><label>📧 To</label>';
  h += '<input type="email" id="etTo" class="fm-input" value="' + sanitize(t.to || '') + '"></div>';
  h += _etVarPanelHtml();
  h += '<div class="fm-group"><label>📋 Subject</label>';
  h += '<input type="text" id="etSubject" class="fm-input" value="' + sanitize(t.subject || '') + '" onfocus="_etTrackFocus(\'etSubject\')"></div>';
  h += '<div class="fm-group"><label>📝 Body</label>';
  h += '<textarea id="etBody" rows="8" class="fm-input" onfocus="_etTrackFocus(\'etBody\')">' + sanitize(t.body || '') + '</textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="saveEditEmailTmpl(' + idx + ')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="_etGoBack(\'' + t.id + '\')">↩️ กลับ</button>';
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
  templates[idx].forDealer = !!(document.getElementById('etForDealer') && document.getElementById('etForDealer').checked);
  saveEmailTemplates(templates);
  toast('💾 บันทึกแล้ว');
  _etGoBack(templates[idx].id);
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
// CUSTOM KPI DASHBOARD PAGE (完整版)
// ================================================================
function rCustomKPI(el) {
  document.getElementById('pgT').textContent = '🎯 KPI Dashboard';
  
  var configs = getKpiConfigs();
  var entries = getKpiEntries();
  
  if (!configs || !Array.isArray(configs)) configs = [];
  if (!entries || !Array.isArray(entries)) entries = [];
  
  if (configs.length === 0) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:30px">' +
      '<div style="font-size:48px;margin-bottom:10px">🎯</div>' +
      '<p>ยังไม่มี KPI — กด ➕ เพิ่ม หรือ</p>' +
      '<button class="btn bp" onclick="resetKpiDefaults()">🔄 ใช้ค่าเริ่มต้น</button>' +
      '</div>';
    return;
  }
  
  var h = '<div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap">' +
    '<button class="btn bo" onclick="resetKpiDefaults()">🔄 ใช้ค่าเริ่มต้น</button>' +
    '</div>';
  
  // แยกตาม period
  var weekly = [];
  var monthly = [];
  var quarterly = [];
  
  for (var i = 0; i < configs.length; i++) {
    var k = configs[i];
    if (k.period === 'weekly') weekly.push(k);
    else if (k.period === 'monthly') monthly.push(k);
    else if (k.period === 'quarterly') quarterly.push(k);
  }
  
  if (weekly.length) {
    h += '<div class="card"><h2>📅 รายสัปดาห์ — ' + getPeriodLabel('weekly') + '</h2>';
    for (var i = 0; i < weekly.length; i++) {
      h += renderKpiItem(weekly[i], entries);
    }
    h += '</div>';
  }
  
  if (monthly.length) {
    h += '<div class="card"><h2>📆 รายเดือน — ' + getPeriodLabel('monthly') + '</h2>';
    for (var i = 0; i < monthly.length; i++) {
      h += renderKpiItem(monthly[i], entries);
    }
    h += '</div>';
  }
  
  if (quarterly.length) {
    h += '<div class="card"><h2>📊 รายไตรมาส — ' + getPeriodLabel('quarterly') + '</h2>';
    for (var i = 0; i < quarterly.length; i++) {
      h += renderKpiItem(quarterly[i], entries);
    }
    h += '</div>';
  }
  
  el.innerHTML = h;
}

function getKpiConfigs() {
  var saved = localStorage.getItem('v7_kpiConfig');
  if (saved) {
    try { 
      var parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) { 
      return []; 
    }
  }
  return [];
}

function getKpiEntries() {
  var saved = localStorage.getItem('v7_kpiEntries');
  if (saved) {
    try { 
      var parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) { 
      return []; 
    }
  }
  return [];
}

function getPeriodLabel(period) {
  if (period === 'weekly') return 'สัปดาห์นี้';
  if (period === 'monthly') {
    var now = new Date();
    var months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return months[now.getMonth()] + ' ' + now.getFullYear();
  }
  if (period === 'quarterly') {
    var q = Math.floor(new Date().getMonth() / 3) + 1;
    return 'Q' + q + '/' + new Date().getFullYear();
  }
  return '';
}

function getPeriodRange(period) {
  var now = new Date();
  if (period === 'weekly') {
    var start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    start.setHours(0, 0, 0, 0);
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start: start, end: end };
  }
  if (period === 'monthly') {
    var start = new Date(now.getFullYear(), now.getMonth(), 1);
    var end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start: start, end: end };
  }
  if (period === 'quarterly') {
    var q = Math.floor(now.getMonth() / 3);
    var start = new Date(now.getFullYear(), q * 3, 1);
    var end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
    return { start: start, end: end };
  }
  return { start: now, end: now };
}

function renderKpiItem(kpi, entries) {
  if (!kpi) return '';
  
  if (!entries || !Array.isArray(entries)) entries = [];
  
  var kpiEntries = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (e && e.kpiId === kpi.id && e.status !== 'dropped') {
      kpiEntries.push(e);
    }
  }
  
  var count = kpiEntries.length;
  var target = kpi.target || 1;
  var pct = Math.min(100, Math.round(count / target * 100));
  var color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  
  var h = '<div class="kpi-item">';
  h += '<div class="kpi-header">';
  h += '<div class="kpi-title">' + (kpi.icon || '📊') + ' ' + sanitize(kpi.name) + '</div>';
  h += '<div class="kpi-score" style="color:' + color + '">' + count + '/' + target + '</div>';
  h += '</div>';
  h += '<div class="kpi-bar"><div class="kpi-fill" style="width:' + pct + '%;background:' + color + '"></div></div>';
  
  if (kpiEntries.length > 0) {
    h += '<div class="kpi-details">';
    for (var i = 0; i < kpiEntries.length; i++) {
      var e = kpiEntries[i];
      h += '<div class="kpi-entry">';
      h += '<span class="kpi-entry-date">' + (e.date || '-') + '</span>';
      h += '<span class="kpi-entry-name">' + sanitize(e.name || '-') + '</span>';
      h += '</div>';
    }
    h += '</div>';
  }
  
  if (pct >= 100) h += '<div class="kpi-success">🎉 สำเร็จแล้ว!</div>';
  h += '</div>';
  return h;
}

function resetKpiDefaults() {
  if (!confirm('⚠️ Reset เป็น KPI เริ่มต้น?')) return;
  localStorage.removeItem('v7_kpiConfig');
  toast('🔄 Reset แล้ว');
  render();
}

// ================================================================
// EMAIL DRAFT WITH DEALER SELECTION
// ================================================================

var emailDealerId = '';
var emailTemplateId = '';

function showEmailDraftWithDealer() {
  var dealers = ST.getAll('dealers');
  var cfg = getConfig();
  
  var dealerOptions = '<option value="">-- เลือก Dealer --</option>';
  for (var i = 0; i < dealers.length; i++) {
    dealerOptions += '<option value="' + dealers[i].id + '">' + sanitize(dealers[i].name) + '</option>';
  }
  
  var templateOptions = '<option value="visit_report">📋 Visit Report</option>';
  templateOptions += '<option value="pipeline_update">📊 Pipeline Update</option>';
  templateOptions += '<option value="forecast_summary">📦 Forecast Summary</option>';
  templateOptions += '<option value="custom">✏️ เขียนเอง</option>';
  
  // โหลด templates ที่บันทึกไว้
  var savedTemplates = getEmailTemplates();
  for (var i = 0; i < savedTemplates.length; i++) {
    if (savedTemplates[i].type === 'custom') {
      templateOptions += '<option value="' + savedTemplates[i].id + '">📝 ' + sanitize(savedTemplates[i].name) + '</option>';
    }
  }
  
  var html = `
    <div style="max-width:550px">
      <div class="fg">
        <label>🏪 เลือก Dealer</label>
        <select id="emailDealerSelect" class="fm-input" onchange="loadDealerEmailContacts()">
          ${dealerOptions}
        </select>
      </div>
      <div class="fg">
        <label>📧 ผู้รับ (โหลดจาก Dealer)</label>
        <div id="dealerContactsList" style="margin-bottom:8px; font-size:12px; color:var(--text2)"></div>
        <input type="text" id="emailToInput" class="fm-input" placeholder="email@company.com, another@email.com">
        <div class="hint">💡 สามารถพิมพ์เพิ่มเองได้ คั่นด้วย comma (,)</div>
      </div>
      <div class="fg">
        <label>📋 CC (สำเนา)</label>
        <input type="text" id="emailCcInput" class="fm-input" placeholder="cc@company.com">
      </div>
      <div class="fg">
        <label>📋 เลือก Template</label>
        <select id="emailTemplateSelect" class="fm-input" onchange="previewEmailTemplate()">
          ${templateOptions}
        </select>
      </div>
      <div class="fg">
        <label>📋 หัวข้อ</label>
        <input type="text" id="emailSubject" class="fm-input" placeholder="หัวข้ออีเมล">
      </div>
      <div class="fg">
        <label>📝 เนื้อหา</label>
        <textarea id="emailBody" rows="10" class="fm-input" placeholder="เนื้อหาอีเมล..."></textarea>
      </div>
      <div class="bg" style="margin-top:12px">
        <button class="btn bp" onclick="sendEmailFromDraft()">📧 ส่งอีเมล</button>
        <button class="btn bo" onclick="copyEmailDraft()">📋 Copy</button>
        <button class="btn bo" onclick="saveCurrentEmailTemplate()">💾 บันทึก Template</button>
      </div>
    </div>
  `;
  
  openM('📧 สร้างอีเมล (เลือก Dealer)', html);
}

function loadDealerEmailContacts() {
  var dealerId = document.getElementById('emailDealerSelect').value;
  if (!dealerId) return;
  
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) { toast('❌ ไม่พบ Dealer นี้แล้ว (อาจถูกลบไปแล้ว)', true); return; }
  var contacts = dealer.contacts || [];
  var emails = [];
  
  // ดึงอีเมลจาก contacts
  for (var i = 0; i < contacts.length; i++) {
    if (contacts[i].email) emails.push(contacts[i].email);
  }
  
  // เพิ่มอีเมลจาก dealer โดยตรง (ถ้ามี)
  if (dealer.email) emails.push(dealer.email);
  
  var emailList = emails.join(', ');
  document.getElementById('emailToInput').value = emailList;
  
  // แสดงรายชื่อผู้ติดต่อ
  var contactsHtml = '<div style="font-size:12px;margin-bottom:4px;font-weight:600">📞 ผู้ติดต่อ:</div>';
  if (contacts.length === 0) {
    contactsHtml += '<div class="hint">ไม่มีข้อมูลผู้ติดต่อ กรุณาเพิ่มในหน้า Dealer</div>';
  } else {
    for (var i = 0; i < contacts.length; i++) {
      var c = contacts[i];
      contactsHtml += `<div style="font-size:11px; padding:4px 0; border-bottom:1px solid var(--border)">
        <strong>${sanitize(c.name)}</strong>
        ${c.role ? ' (' + sanitize(c.role) + ')' : ''}<br>
        ${c.email ? '📧 ' + sanitize(c.email) + ' ' : ''}
        ${c.phone ? '📞 ' + sanitize(c.phone) : ''}
      </div>`;
    }
  }
  document.getElementById('dealerContactsList').innerHTML = contactsHtml;
}

function previewEmailTemplate() {
  var template = document.getElementById('emailTemplateSelect').value;
  var dealerId = document.getElementById('emailDealerSelect').value;
  var dealer = dealerId ? ST.getOne('dealers', dealerId) : null;
  var cfg = getConfig();
  var today = _td();
  var formattedDate = fD(today);
  
  var subject = '';
  var body = '';
  
  // ตรวจสอบว่าเป็น template ที่บันทึกไว้หรือไม่
  if (template.indexOf('et_') === 0) {
    var savedTemplates = getEmailTemplates();
    for (var i = 0; i < savedTemplates.length; i++) {
      if (savedTemplates[i].id === template) {
        subject = savedTemplates[i].subject || '';
        body = savedTemplates[i].body || '';
        break;
      }
    }
    // แทนที่ตัวแปร
    subject = subject.replace(/\{dealer\}/g, dealer ? dealer.name : '').replace(/\{date\}/g, formattedDate);
    body = body.replace(/\{dealer\}/g, dealer ? dealer.name : '').replace(/\{date\}/g, formattedDate).replace(/\{sale\}/g, cfg.saleName || 'Siwawong');
    document.getElementById('emailSubject').value = subject;
    document.getElementById('emailBody').value = body;
    return;
  }
  
  // Templates ในตัว
  var contactName = dealer ? (dealer.contactName || dealer.name || '') : '';
  
  if (template === 'visit_report') {
    subject = `Visit Report — ${dealer ? dealer.name : 'Dealer'} ${formattedDate}`;
    body = `เรียนคุณ${contactName},\n\n`;
    body += `ตามที่ได้เข้าเยี่ยมชมและพูดคุยกัน ขอสรุปประเด็นสำคัญดังนี้\n\n`;
    body += `📋 ประเด็นที่คุย:\n`;
    body += `• ...\n\n`;
    body += `📊 Pipeline Update:\n`;
    body += `• ...\n\n`;
    body += `📦 Forecast:\n`;
    body += `• ...\n\n`;
    body += `📝 สรุป:\n`;
    body += `• ...\n\n`;
    body += `ติดต่อสอบถามเพิ่มเติมได้ที่ ${cfg.saleName || 'Siwawong'}\n`;
    body += `SIS Distribution (Thailand) PLC\n`;
    body += `DJI Authorized Distributor`;
  } else if (template === 'pipeline_update') {
    // ดึงข้อมูล pipeline ของ dealer
    var pipes = dealerId ? ST.pipelineByDealer(dealerId) : [];
    var activePipes = pipes.filter(function(p) { return pipeIsOpen(p); });
    var activeCount = activePipes.length;
    var activeAmount = 0;
    for (var i = 0; i < activePipes.length; i++) {
      activeAmount += (Number(activePipes[i].forecastAmount) || 0);
    }
    
    subject = `Pipeline Update — ${dealer ? dealer.name : 'Dealer'} ${formattedDate}`;
    body = `เรียนคุณ${contactName},\n\n`;
    body += `ขออัพเดทความคืบหน้าโครงการดังนี้\n\n`;
    body += `📊 สรุป Pipeline (${activeCount} โครงการ)\n`;
    body += `• มูลค่ารวม: ${fmtMoney(activeAmount)} ฿\n\n`;
    body += `✅ โครงการที่กำลังดำเนินการ:\n`;
    for (var i = 0; i < Math.min(activePipes.length, 5); i++) {
      var p = activePipes[i];
      body += `• ${p.projectName || '-'} — ${fmtMoney(p.forecastAmount)} ฿\n`;
    }
    if (activePipes.length > 5) body += `• ... และอีก ${activePipes.length - 5} โครงการ\n`;
    body += `\n📅 แผนการดำเนินงาน:\n`;
    body += `• ...\n\n`;
    body += `สอบถามเพิ่มเติมได้ที่ ${cfg.saleName || 'Siwawong'}\n`;
    body += `SIS Distribution (Thailand) PLC`;
  } else if (template === 'forecast_summary') {
    subject = `Forecast Summary — ${dealer ? dealer.name : 'Dealer'} ${formattedDate}`;
    body = `เรียนคุณ${contactName},\n\n`;
    body += `สรุปแผนการสั่งซื้อประจำเดือน ${formattedDate}\n\n`;
    body += `📦 Run Rate:\n`;
    body += `• ...\n\n`;
    body += `🏢 โครงการ:\n`;
    body += `• ...\n\n`;
    body += `📝 หมายเหตุ:\n`;
    body += `• ...\n\n`;
    body += `หากต้องการปรับเปลี่ยนแผนกรุณาแจ้งภายในวันที่ ...\n\n`;
    body += `${cfg.saleName || 'Siwawong'}\n`;
    body += `SIS Distribution (Thailand) PLC\n`;
    body += `DJI Authorized Distributor`;
  } else {
    subject = '';
    body = '';
  }
  
  document.getElementById('emailSubject').value = subject;
  document.getElementById('emailBody').value = body;
}

function sendEmailFromDraft() {
  var to = document.getElementById('emailToInput').value.trim();
  var cc = document.getElementById('emailCcInput').value.trim();
  var subject = document.getElementById('emailSubject').value.trim();
  var body = document.getElementById('emailBody').value.trim();
  var dealerId = document.getElementById('emailDealerSelect').value;
  
  if (!to) {
    toast('⚠️ กรุณาใส่ผู้รับ');
    return;
  }
  if (!subject || !body) {
    toast('⚠️ กรุณาใส่หัวข้อและเนื้อหา');
    return;
  }
  
  // ✅ บันทึก Draft ก่อนส่ง
  saveEmailDraft(to, cc, subject, body, dealerId);
  
  // สร้าง mailto link
  var mailtoUrl = 'mailto:' + encodeURIComponent(to);
  if (cc) mailtoUrl += '?cc=' + encodeURIComponent(cc);
  mailtoUrl += '&subject=' + encodeURIComponent(subject);
  mailtoUrl += '&body=' + encodeURIComponent(body);
  
  window.open(mailtoUrl);
  toast('📧 เปิดอีเมลคลายเอ็นท์แล้ว');
  
  // บันทึกประวัติการส่ง
  var dealer = dealerId ? ST.getOne('dealers', dealerId) : null;
  ST.add('emails', {
    type: 'manual',
    to: to,
    cc: cc,
    subject: subject,
    body: body.substring(0, 200),
    sentAt: _nw(),
    dealerId: dealerId,
    dealerName: dealer ? dealer.name : ''
  });
  
  closeM();
}
// ✅ บันทึก Email Draft
// ✅ บันทึก Email Draft
function saveEmailDraft(to, cc, subject, body, dealerId) {
  var drafts = getEmailDrafts();
  var draft = {
    id: 'draft_' + Date.now(),
    to: to || '',
    cc: cc || '',
    subject: subject || '',
    body: body || '',
    dealerId: dealerId || '',
    createdAt: _nw(),
    updatedAt: _nw()
  };
  drafts.unshift(draft);
  // เก็บแค่ 20 draft ล่าสุด
  if (drafts.length > 20) drafts = drafts.slice(0, 20);
  localStorage.setItem('v7_email_drafts', JSON.stringify(drafts));
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('emailDrafts', draft);
  console.log('✅ บันทึก Draft แล้ว:', draft.id);
  return draft;
}
// ✅ อ่าน Email Drafts
function getEmailDrafts() {
  var drafts = localStorage.getItem('v7_email_drafts');
  if (drafts) {
    try { 
      var parsed = JSON.parse(drafts);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) { 
      return []; 
    }
  }
  return [];
}

// ✅ โหลด Draft มาแสดง
function loadEmailDraft(draftId) {
  var drafts = getEmailDrafts();
  var draft = null;
  for (var i = 0; i < drafts.length; i++) {
    if (drafts[i].id === draftId) { draft = drafts[i]; break; }
  }
  if (!draft) {
    toast('❌ ไม่พบ Draft');
    return;
  }
  
  document.getElementById('emailToInput').value = draft.to || '';
  document.getElementById('emailCcInput').value = draft.cc || '';
  document.getElementById('emailSubject').value = draft.subject || '';
  document.getElementById('emailBody').value = draft.body || '';
  
  // เลือก Dealer ที่เกี่ยวข้อง (ถ้ามี)
  if (draft.dealerId) {
    var dealerSelect = document.getElementById('emailDealerSelect');
    if (dealerSelect) {
      dealerSelect.value = draft.dealerId;
      loadDealerEmailContacts();
    }
  }
  
  toast('📂 โหลด Draft: ' + (draft.subject || 'ไม่มีหัวข้อ'));
}
// ✅ ลบ Draft
function deleteEmailDraft(draftId) {
  if (!confirm('ลบ Draft นี้?')) return;
  var drafts = getEmailDrafts();
  drafts = drafts.filter(function(d) { return d.id !== draftId; });
  localStorage.setItem('v7_email_drafts', JSON.stringify(drafts));
  if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('emailDrafts', draftId);
  toast('🗑️ ลบ Draft แล้ว');
  showEmailDraftWithDealer(); // รีเฟรชหน้า
}
function showEmailDraftWithDealer() {
  var dealers = ST.getAll('dealers');
  var cfg = getConfig();
  var drafts = getEmailDrafts();  // ✅ โหลด draft ทุกครั้งที่เปิด
  
  var dealerOptions = '<option value="">-- เลือก Dealer --</option>';
  for (var i = 0; i < dealers.length; i++) {
    dealerOptions += '<option value="' + dealers[i].id + '">' + sanitize(dealers[i].name) + '</option>';
  }
  
  // ✅ สร้างรายการ Drafts (แสดงเฉพาะ 10 รายการล่าสุด)
  var draftsHtml = '';
  if (drafts.length > 0) {
    draftsHtml = '<div class="fg"><label>📂 Drafts ที่บันทึกไว้ (' + drafts.length + ')</label>';
    draftsHtml += '<div style="max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; padding:4px; margin-top:4px">';
    for (var i = 0; i < drafts.length; i++) {
      var d = drafts[i];
      var preview = '';
      if (d.subject) preview = d.subject;
      else if (d.to) preview = 'ถึง: ' + d.to;
      else preview = (d.body || '').substring(0, 30);
      draftsHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid var(--border)">';
      draftsHtml += '<div style="flex:1; cursor:pointer" onclick="loadEmailDraft(\'' + d.id + '\')">';
      draftsHtml += '<div style="font-size:12px; font-weight:500">📄 ' + sanitize(preview.substring(0, 40)) + '</div>';
      draftsHtml += '<div style="font-size:10px; color:var(--text2)">' + (d.to ? 'ถึง: ' + sanitize(d.to.substring(0, 30)) : '') + '</div>';
      draftsHtml += '</div>';
      draftsHtml += '<button class="btn bsm bd" onclick="event.stopPropagation();deleteEmailDraft(\'' + d.id + '\')">🗑️</button>';
      draftsHtml += '</div>';
    }
    draftsHtml += '</div></div>';
  } else {
    draftsHtml = '<div class="fg"><label>📂 Drafts</label><div class="hint" style="padding:8px; text-align:center">ยังไม่มี Draft ที่บันทึกไว้<br>กรอกข้อมูลแล้วกด "💾 บันทึก Draft"</div></div>';
  }
  
  var templateOptions = '<option value="visit_report">📋 Visit Report</option>';
  templateOptions += '<option value="pipeline_update">📊 Pipeline Update</option>';
  templateOptions += '<option value="forecast_summary">📦 Forecast Summary</option>';
  templateOptions += '<option value="custom">✏️ เขียนเอง</option>';
  
  // โหลด templates ที่บันทึกไว้
  var savedTemplates = getEmailTemplates();
  for (var i = 0; i < savedTemplates.length; i++) {
    if (savedTemplates[i].type === 'custom') {
      templateOptions += '<option value="' + savedTemplates[i].id + '">📝 ' + sanitize(savedTemplates[i].name) + '</option>';
    }
  }
  
  var html = `
    <div style="max-width:550px">
      ${draftsHtml}
      <div class="fg">
        <label>🏪 เลือก Dealer</label>
        <select id="emailDealerSelect" class="fm-input" onchange="loadDealerEmailContacts()">
          ${dealerOptions}
        </select>
      </div>
      <div class="fg">
        <label>📧 ผู้รับ (โหลดจาก Dealer)</label>
        <div id="dealerContactsList" style="margin-bottom:8px; font-size:12px; color:var(--text2)"></div>
        <input type="text" id="emailToInput" class="fm-input" placeholder="email@company.com, another@email.com">
        <div class="hint">💡 สามารถพิมพ์เพิ่มเองได้ คั่นด้วย comma (,)</div>
      </div>
      <div class="fg">
        <label>📋 CC (สำเนา)</label>
        <input type="text" id="emailCcInput" class="fm-input" placeholder="cc@company.com">
      </div>
      <div class="fg">
        <label>📋 เลือก Template</label>
        <select id="emailTemplateSelect" class="fm-input" onchange="previewEmailTemplate()">
          ${templateOptions}
        </select>
      </div>
      <div class="fg">
        <label>📋 หัวข้อ</label>
        <input type="text" id="emailSubject" class="fm-input" placeholder="หัวข้ออีเมล">
      </div>
      <div class="fg">
        <label>📝 เนื้อหา</label>
        <textarea id="emailBody" rows="8" class="fm-input" placeholder="เนื้อหาอีเมล..."></textarea>
      </div>
      <div class="bg" style="margin-top:12px; flex-wrap:wrap">
        <button class="btn bp" onclick="sendEmailFromDraft()">📧 ส่งอีเมล</button>
        <button class="btn bs" onclick="saveEmailDraftFromModal()">💾 บันทึก Draft</button>
        <button class="btn bo" onclick="copyEmailDraft()">📋 Copy</button>
        <button class="btn bo" onclick="saveCurrentEmailTemplate()">💾 บันทึก Template</button>
      </div>
    </div>
  `;
  
  openM('📧 สร้างอีเมล (เลือก Dealer)', html);
}
function saveEmailDraftFromModal() {
  var to = document.getElementById('emailToInput').value.trim();
  var cc = document.getElementById('emailCcInput').value.trim();
  var subject = document.getElementById('emailSubject').value.trim();
  var body = document.getElementById('emailBody').value.trim();
  var dealerId = document.getElementById('emailDealerSelect').value;
  
  if (!to && !subject && !body) {
    toast('⚠️ ไม่มีข้อมูลที่จะบันทึก');
    return;
  }
  
  var draft = saveEmailDraft(to, cc, subject, body, dealerId);
  toast('💾 บันทึก Draft เรียบร้อย');
  
  // ปิด modal แล้วเปิดใหม่เพื่อแสดงรายการ
  closeM();
  setTimeout(function() {
    showEmailDraftWithDealer();
  }, 200);
}
function copyEmailDraft() {
  var to = document.getElementById('emailToInput').value;
  var cc = document.getElementById('emailCcInput').value;
  var subject = document.getElementById('emailSubject').value;
  var body = document.getElementById('emailBody').value;
  
  var text = 'ถึง: ' + to + '\n';
  if (cc) text += 'สำเนา: ' + cc + '\n';
  text += 'หัวข้อ: ' + subject + '\n\n';
  text += body;
  
  copyText(text);
  toast('📋 คัดลอกเนื้อหาอีเมลแล้ว');
}

function saveCurrentEmailTemplate() {
  var subject = document.getElementById('emailSubject').value.trim();
  var body = document.getElementById('emailBody').value.trim();
  
  if (!subject && !body) {
    toast('⚠️ ไม่มีเนื้อหาที่จะบันทึก');
    return;
  }
  
  var name = prompt('📝 ชื่อ Template:', subject.substring(0, 30) || 'Template ใหม่');
  if (!name) return;
  
  var templates = getEmailTemplates();
  templates.push({
    id: 'et_' + Date.now(),
    name: name,
    subject: subject,
    body: body,
    type: 'custom',
    createdAt: _nw()
  });
  saveEmailTemplates(templates);
  
  toast('💾 บันทึก Template "' + name + '" เรียบร้อย');
  
  // รีเฟรช dropdown
  var select = document.getElementById('emailTemplateSelect');
  if (select) {
    var newOption = document.createElement('option');
    newOption.value = templates[templates.length - 1].id;
    newOption.textContent = '📝 ' + name;
    select.appendChild(newOption);
  }
}

// getEmailTemplates/saveEmailTemplates ตัวจริงอยู่ด้านบน (~บรรทัด 5125) — เคยมีสำเนาซ้ำอยู่ตรงนี้ที่ไม่มี
// fallback เป็น EMAIL_TEMPLATES_DEFAULT (คืน [] เฉยๆ) เลยบังตัวจริง ทำให้เครื่องใหม่/ล้างค่าไม่มี template
// เริ่มต้นให้เลย ลบสำเนานี้ทิ้ง (พบ 2026-07-19 ตอนไล่ตรวจฟังก์ชันชื่อซ้ำ)