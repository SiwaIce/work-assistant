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

function sanitize(s) {
  if (!s) return '';
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
  h += '<button class="btn btn-blue" onclick="copyLineMsg()" style="flex:1;min-width:120px">📋 Copy ข้อความ</button>';
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
  var neglected = [];
  (dealers || []).forEach(function (d) {
    var dVisits = (visits || []).filter(function (v) { return v.dealerId === d.id; });
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
  (pipeline || []).forEach(function (p) {
    if (!pipeIsOpen(p)) return;
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

  // Tasks
  var tasks = [];
  try { tasks = ST.getAll('tasks'); } catch(e) { tasks = []; }
  (tasks || []).forEach(function(t) {
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

  // Pipeline Follow-up Dates
  var pipeline = [];
  try { pipeline = ST.getAll('pipeline'); } catch(e) { pipeline = []; }
  (pipeline || []).forEach(function(p) {
    if (!pipeIsOpen(p)) return;
    if (p.followupDate) {
      var fd = ftParseDate(p.followupDate);
      if (fd) {
        var dealer = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
        var covered = false;
        (pipeActions || []).forEach(function(a) {
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
    if (p.biddingDate && pipeIsActive(p)) {
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

  // Follow-ups
  var followups = [];
  try { followups = JSON.parse(localStorage.getItem('v7_followups') || '[]'); } catch(e) { followups = []; }
  (followups || []).forEach(function(f) {
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
  var pipeTotal = 0;
  var activePipe = (pipeline || []).filter(function(p) { return pipeIsOpen(p); });
  (activePipe || []).forEach(function(p) {
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
  h += '<button class="btn btn-blue" onclick="saveGoalTargets()">💾 บันทึก</button>';
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
      // migrate สถานะเดิม "maintenance" -> "unavailable"
      var migrated = false;
      parsed.forEach(function(d) { if (d.status === 'maintenance') { d.status = 'unavailable'; migrated = true; } });
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

var demoTrackerTab = 'list'; // 'list' | 'calendar'
var demoStatusFilter = 'all'; // 'all' | available | reserved | lent | unavailable | lost
var demoModelFilter = 'all';
var demoOverdueFlt = false; // true = กรองเฉพาะเครื่องที่ยืมเกิน 30 วันยังไม่คืน
var demoSearch = '';
var _demoSearchTimer = null;
function demoSearchInput(v) {
  demoSearch = v;
  clearTimeout(_demoSearchTimer);
  _demoSearchTimer = setTimeout(function() { render(); }, 350);
}

function demoSetStatusFilter(s) { demoStatusFilter = s; render(); }
function demoClearFilters() { demoStatusFilter = 'all'; demoModelFilter = 'all'; demoSearch = ''; render(); }

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
  var items = getDemoItems();
  if (!items || !Array.isArray(items)) items = [];

  var now = new Date();
  var counts = { available: 0, reserved: 0, lent: 0, unavailable: 0, lost: 0 };
  items.forEach(function(d) { counts[getDemoEffectiveStatus(d)]++; });

  // นับเครื่องที่ยืมเกิน 30 วันยังไม่คืน — ใช้ตรรกะเดียวกับ isOverdue ต่อการ์ดด้านล่าง
  var overdueCount = 0;
  items.forEach(function(d) {
    var eff = getDemoEffectiveStatus(d);
    if (eff !== 'lent') return;
    var lentDate = ftParseDate(d.lentDate);
    var daysBorrowed = lentDate ? Math.floor((now - lentDate) / 86400000) : 0;
    if (daysBorrowed > 30) overdueCount++;
  });

  var h = '';
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
  h += '<button class="btn bp" onclick="showAddDemoM()">➕ เพิ่มอุปกรณ์</button>';
  h += '</div>';

  if (overdueCount) {
    h += '<div onclick="demoOverdueFlt=!demoOverdueFlt;demoStatusFilter=demoOverdueFlt?\'lent\':demoStatusFilter;render()" style="cursor:pointer;background:' + (demoOverdueFlt ? '#ef444418' : 'var(--bg2)') + ';border:1px solid ' + (demoOverdueFlt ? '#ef4444' : 'var(--border)') + ';border-radius:8px;padding:8px 10px;margin-bottom:10px;max-width:240px">';
    h += '<div style="font-size:11px;color:#ef4444">⚠️ เครื่องเกินกำหนดคืน (&gt;30 วัน)</div>';
    h += '<div style="font-size:20px;font-weight:700;color:#ef4444">' + overdueCount + ' เครื่อง</div>';
    h += '</div>';
  }

  h += '<div class="today-tabs" style="margin-bottom:10px">';
  h += '<div class="today-tab ' + (demoTrackerTab === 'list' ? 'act' : '') + '" onclick="demoTrackerTab=\'list\';render()">📋 รายการ</div>';
  h += '<div class="today-tab ' + (demoTrackerTab === 'calendar' ? 'act' : '') + '" onclick="demoTrackerTab=\'calendar\';render()">🗓️ ปฏิทิน</div>';
  h += '</div>';

  if (demoTrackerTab === 'calendar') {
    el.innerHTML = h + renderDemoCalendar();
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
    h += '<button class="demo-filter-chip ' + (demoStatusFilter === s ? 'act' : '') + '" onclick="demoSetStatusFilter(\'' + s + '\')">' + DEMO_STATUS_META[s].label + ' (' + counts[s] + ')</button>';
  });
  h += '</div>';

  // ค้นหา + กรองตามรุ่น
  var uniqueModels = [];
  items.forEach(function(d) { if (d.name && uniqueModels.indexOf(d.name) === -1) uniqueModels.push(d.name); });
  uniqueModels.sort();
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  h += '<input type="text" class="fm-input" style="flex:1;min-width:200px" placeholder="🔍 ค้นหา (ชื่อ, SKU, S/N, เลขเครื่องเช่า)" value="' + sanitize(demoSearch) + '" oninput="demoSearchInput(this.value)">';
  h += '<select class="fm-input" style="min-width:200px" onchange="demoModelFilter=this.value;render()">';
  h += '<option value="all"' + (demoModelFilter === 'all' ? ' selected' : '') + '>📦 ทุกรุ่น (' + uniqueModels.length + ')</option>';
  uniqueModels.forEach(function(m) {
    var cnt = items.filter(function(d) { return d.name === m; }).length;
    h += '<option value="' + sanitize(m) + '"' + (demoModelFilter === m ? ' selected' : '') + '>' + sanitize(m) + ' (' + cnt + ')</option>';
  });
  h += '</select>';
  h += '<button class="btn bsm bo" onclick="demoClearFilters()">✖️ ล้าง</button>';
  h += '</div>';

  var shown = items.filter(function(d) {
    if (demoStatusFilter !== 'all' && getDemoEffectiveStatus(d) !== demoStatusFilter) return false;
    if (demoModelFilter !== 'all' && d.name !== demoModelFilter) return false;
    if (demoOverdueFlt) {
      if (getDemoEffectiveStatus(d) !== 'lent') return false;
      var lentDate2 = ftParseDate(d.lentDate);
      var daysBorrowed2 = lentDate2 ? Math.floor((now - lentDate2) / 86400000) : 0;
      if (daysBorrowed2 <= 30) return false;
    }
    if (demoSearch) {
      var q = demoSearch.toLowerCase();
      var hay = ((d.name || '') + ' ' + (d.sku || '') + ' ' + (d.serialNumber || '') + ' ' + (d.rentalDbNo || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  if (!shown.length) {
    h += '<div class="card" style="text-align:center;padding:30px"><div style="font-size:48px;margin-bottom:10px">🚁</div><p>' + (items.length ? 'ไม่พบอุปกรณ์ในสถานะนี้' : 'ยังไม่มีอุปกรณ์ Demo — กด ➕ เพื่อเพิ่ม') + '</p></div>';
  }

  h += '<div class="demo-grid">';
  for (var i = 0; i < shown.length; i++) {
    var d = shown[i];
    var eff = getDemoEffectiveStatus(d);
    var meta = DEMO_STATUS_META[eff];
    var dd = d.dealerId ? ST.getOne('dealers', d.dealerId) : null;
    var lentDate = ftParseDate(d.lentDate);
    var daysBorrowed = lentDate ? Math.floor((now - lentDate) / 86400000) : 0;
    var isOverdue = eff === 'lent' && daysBorrowed > 30;
    var mColor = demoModelColor(d.name);

    h += '<div class="demo-card2' + (isOverdue ? ' demo-overdue' : '') + '" style="border-left-color:' + mColor + '">';
    h += '<div class="demo-card2-top">';
    h += '<div class="demo-card2-id">';
    h += '<div class="demo-card2-icon" style="background:' + mColor + '22;color:' + mColor + '">🚁</div>';
    h += '<div>';
    h += '<div class="demo-card2-name" onclick="go(\'demoDetail\',{demoId:\'' + d.id + '\'})">' + sanitize(d.name) + '</div>';
    if (d.serialNumber) h += '<span class="demo-sn-chip" style="background:' + mColor + '22;color:' + mColor + '">S/N ' + qcopyHtml(d.serialNumber) + '</span>';
    h += '</div></div>';
    h += '<span class="demo-status ' + meta.cls + '">' + meta.label + '</span>';
    h += '</div>';
    h += '<div class="demo-card2-info">';
    if (d.sku) h += '<div>🏷️ SiS Part: ' + qcopyHtml(d.sku) + '</div>';
    if (d.rentalDbNo) h += '<div>📋 หมายเลขเครื่องเช่า: ' + qcopyHtml(d.rentalDbNo) + '</div>';
    if (eff === 'lent' || eff === 'reserved') {
      h += '<div>👤 ' + (dd ? sanitize(dd.name) : sanitize(d.borrower || '-')) + '</div>';
      if (d.purpose) h += '<div>🎯 ' + sanitize(d.purpose) + '</div>';
      h += '<div>📅 ' + (eff === 'reserved' ? 'จองวันที่: ' : 'ยืมตั้งแต่: ') + (d.lentDate || '-') + (eff === 'lent' ? ' (' + daysBorrowed + ' วัน)' : '') + '</div>';
      if (d.returnDate) h += '<div>📅 กำหนดคืน: ' + d.returnDate + '</div>';
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
  }
  h += '</div>';

  el.innerHTML = h;
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
  var h = '<button class="btn bsm bo" onclick="go(\'demoTracker\')" style="margin-bottom:10px">← กลับ</button>';

  h += '<div class="card">';
  h += '<h2>🚁 ' + sanitize(d.name) + ' <span class="demo-status ' + meta.cls + '">' + meta.label + '</span></h2>';
  h += '<div class="demo-info">';
  if (d.serialNumber) h += '<div>🔢 S/N: ' + sanitize(d.serialNumber) + '</div>';
  if (d.model) h += '<div>📦 Model: ' + sanitize(d.model) + '</div>';
  if (d.sku) h += '<div>🏷️ SiS Part: ' + sanitize(d.sku) + '</div>';
  if (d.rentalDbNo) h += '<div>📋 หมายเลขเครื่องเช่า: ' + sanitize(d.rentalDbNo) + '</div>';
  h += '<div style="color:var(--text2)">ℹ️ ' + meta.desc + '</div>';
  if (eff === 'lent' || eff === 'reserved') {
    var dd = d.dealerId ? ST.getOne('dealers', d.dealerId) : null;
    h += '<div>👤 ผู้ยืม: ' + (dd ? sanitize(dd.name) : sanitize(d.borrower || '-')) + '</div>';
    if (d.purpose) h += '<div>🎯 ใช้งานกับ: ' + sanitize(d.purpose) + '</div>';
    h += '<div>📅 ' + (eff === 'reserved' ? 'จองวันที่: ' : 'ยืมตั้งแต่: ') + (d.lentDate || '-') + (d.returnDate ? ' • กำหนดคืน: ' + d.returnDate : '') + '</div>';
  }
  if (d.note) h += '<div>📝 ' + sanitize(d.note) + '</div>';
  h += '</div>';
  h += demoComplianceBadges(d);
  h += '</div>';

  var history = demoLoansByDemo(d.id);
  h += '<div class="card"><h2>📜 ประวัติการยืม (' + history.length + ')</h2>';
  if (!history.length) {
    h += '<p style="color:var(--text2)">ยังไม่มีประวัติการยืม</p>';
  } else {
    history.forEach(function(l) {
      var dd = l.dealerId ? ST.getOne('dealers', l.dealerId) : null;
      h += '<div class="li">';
      h += '<div class="lm">';
      h += '<div class="lt">👤 ' + sanitize(dd ? dd.name : (l.borrower || '-')) + ' <span class="fu-badge ' + (l.status === 'active' ? 'fu-badge-red' : '') + '">' + (l.status === 'active' ? '📤 กำลังยืม' : '✅ คืนแล้ว') + '</span></div>';
      h += '<div class="ls">📅 ยืม: ' + (l.lentDate || '-') + (l.actualReturnDate ? ' • คืนจริง: ' + l.actualReturnDate : (l.returnDate ? ' • กำหนดคืน: ' + l.returnDate : '')) + '</div>';
      if (l.purpose) h += '<div class="ls">🎯 ' + sanitize(l.purpose) + '</div>';
      if (l.note) h += '<div class="ls">📝 ' + sanitize(l.note) + '</div>';
      h += '</div></div>';
    });
  }
  h += '</div>';

  el.innerHTML = h;
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
  var h = '<div class="fm-group"><label>📋 หมายเลขเครื่องเช่า (DB เครื่องเช่า)</label><input type="text" id="dm_rentaldb" class="fm-input" value="' + sanitize(d.rentalDbNo || '') + '"></div>';
  h += '<div class="fm-group" style="display:flex;gap:14px;flex-wrap:wrap">';
  h += '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="dm_nbtc"' + (d.nbtcRegistered ? ' checked' : '') + '> ขึ้นทะเบียน กสทช</label>';
  h += '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="dm_insurance"' + (d.droneInsurance ? ' checked' : '') + '> ประกันภัยโดรน</label>';
  h += '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="dm_caat"' + (d.caatRegistered ? ' checked' : '') + '> ขึ้นทะเบียน CAAT</label>';
  h += '</div>';
  return h;
}
function readDemoComplianceFields() {
  return {
    rentalDbNo: (document.getElementById('dm_rentaldb').value || '').trim(),
    nbtcRegistered: document.getElementById('dm_nbtc').checked,
    droneInsurance: document.getElementById('dm_insurance').checked,
    caatRegistered: document.getElementById('dm_caat').checked
  };
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
  h += '<button class="btn btn-blue" onclick="saveDemo()">💾 บันทึก</button>';
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
  var h = '<div style="max-width:400px">';
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
  h += '<button class="btn btn-blue" onclick="lendDemo(\'' + demoId + '\')">📤 ให้ยืม</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('📤 ให้ยืม / จองล่วงหน้า', h);
}

function lendDemo(demoId) {
  var items = getDemoItems();
  var dealerId = document.getElementById('dm_dealer').value || '';
  var borrower = (document.getElementById('dm_borrower').value || '').trim();
  var purpose = document.getElementById('dm_purpose') ? document.getElementById('dm_purpose').value.trim() : '';
  var lentDate = (document.getElementById('dm_lent').value || '').trim() || _td();
  var returnDate = (document.getElementById('dm_return').value || '').trim();
  var note = (document.getElementById('dm_lnote').value || '').trim();
  var demoName = '';

  for (var i = 0; i < items.length; i++) {
    if (items[i].id === demoId) {
      items[i].status = 'lent';
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
  saveDemoItems(items);

  var loans = getDemoLoans();
  loans.push({
    id: gid(), demoId: demoId, demoName: demoName,
    dealerId: dealerId, borrower: borrower, purpose: purpose,
    lentDate: lentDate, returnDate: returnDate, actualReturnDate: '',
    note: note, status: 'active', created: _nw()
  });
  saveDemoLoans(loans);

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
      items[i].purpose = '';
      items[i].lentDate = '';
      items[i].returnDate = '';
      items[i].note = '';
      break;
    }
  }
  saveDemoItems(items);

  var loans = getDemoLoans();
  for (var j = loans.length - 1; j >= 0; j--) {
    if (loans[j].demoId === demoId && loans[j].status === 'active') {
      loans[j].status = 'returned';
      loans[j].actualReturnDate = _td();
      break;
    }
  }
  saveDemoLoans(loans);

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
  h += '<button class="btn btn-blue" onclick="updateDemo(\'' + demoId + '\')">💾 บันทึก</button>';
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
  try { dealers = ST.getAll('dealers'); } catch(e) { dealers = []; }
  
  if (!quotes || !Array.isArray(quotes)) quotes = [];
  
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

function rVisitPlan(el) {
  document.getElementById('pgT').textContent = '📅 Visit Planning';

  var toolbar = '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">' +
    '<div style="display:flex;gap:4px;border:1px solid var(--border);border-radius:8px;overflow:hidden">' +
    '<button class="btn-xs" style="border-radius:0;' + (vpViewMode === 'month' ? 'background:var(--accent);color:#fff' : '') + '" onclick="vpViewMode=\'month\';render()">🗓 ปฏิทินเดือน</button>' +
    '<button class="btn-xs" style="border-radius:0;' + (vpViewMode === 'week' ? 'background:var(--accent);color:#fff' : '') + '" onclick="vpViewMode=\'week\';render()">📋 รายสัปดาห์</button>' +
    '</div>' +
    '<div style="flex:1"></div>' +
    '<button class="btn bo" onclick="copyVisitPlan()">📋 Copy</button>' +
    '</div>';

  el.innerHTML = toolbar + (vpViewMode === 'week' ? renderVpWeekView() : renderVpMonthView());
}

function renderVpWeekView() {
  var dealers = [];
  var visits = [];
  var plans = getVisitPlans();

  try { dealers = ST.getAll('dealers'); } catch(e) { dealers = []; }
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
      h += '<div class="vp-item-dealer">' + (dd ? sanitize(dd.name) : '-') + ' <span style="font-size:10px;color:var(--text2)">(visited)</span></div>';
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
  h += '<button class="btn bp" style="background:#22c55e" onclick="showAddVisitPlanM(\'' + (vpSelectedDay || todayKey) + '\')">➕ นัดใหม่</button>';
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

    h += '<div onclick="vpSelectedDay=\'' + dKey + '\';render()" style="background:var(--card,#1e293b);border-radius:8px;padding:6px;min-height:54px;font-size:10px;cursor:pointer;' +
      (isSelected ? 'border:1px solid var(--accent)' : (isToday ? 'border:1px solid #f59e0b' : 'border:1px solid transparent')) + '">';
    h += '<div style="color:' + (isToday ? '#f59e0b' : 'var(--text)') + ';font-weight:' + (isToday ? '700' : '400') + '">' + day + '</div>';
    var maxShow = 2;
    dayPlans.slice(0, maxShow).forEach(function(p) {
      var hasConflict = vpFindConflicts(p.date, p.timeStart, p.timeEnd, p.id).length > 0;
      var c = hasConflict ? '#ef4444' : (p.mode === 'offline' ? '#f59e0b' : '#3b82f6');
      h += '<div style="margin-top:2px;font-size:9px;color:' + c + ';border-left:2px solid ' + c + ';padding-left:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        (p.mode === 'offline' ? '🤝' : '📞') + (p.timeStart ? ' ' + p.timeStart : '') + ' ' + sanitize(_vpPlanLabel(p)) + (hasConflict ? ' ⚠️' : '') + '</div>';
    });
    if (dayPlans.length > maxShow) h += '<div style="font-size:9px;color:var(--text2);margin-top:2px">+' + (dayPlans.length - maxShow) + ' เพิ่มเติม</div>';
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
    h += '<div class="vp-item-note">🏢 ' + sanitize(company) + (isLead ? ' 🆕' : '') + '</div>';
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
  h2 += '<span>🏢 <span style="color:var(--text)">' + sanitize(company) + '</span> ' + sourceBadge + '</span>';
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

  h2 += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  if (!isLead && dd && p.status !== 'done') h2 += '<button class="btn bsm bp" onclick="vpGoVisit(\'' + p.id + '\')">📝 เปิด Visit Report สำหรับนัดนี้</button>';
  if (isLead && p.status !== 'done') h2 += '<button class="btn bsm bp" onclick="vpGoVisitLead(\'' + p.id + '\')">📝 สร้าง Visit Report</button>';
  if (p.status === 'done' && p.visitId) h2 += '<button class="btn bsm bo" onclick="go(\'visitDetail\',{visitId:\'' + p.visitId + '\'})">📝 ดู Visit Report →</button>';
  if (isLead && p.status !== 'done') h2 += '<button class="btn bsm" style="background:#22c55e;color:#fff" onclick="vpQuickMarkAttended(\'' + p.id + '\')" title="ไปตามนัดแล้ว ไม่มีโน้ตเพิ่ม">✅ ไปตามนัด</button>';
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
  h += '<button class="btn btn-blue" onclick="vpOpenMailto()">📬 เปิด Email Client</button>';
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

// ฟอร์มเพิ่ม/แก้ไขนัด — เลือกได้ว่าผูกกับ Dealer ที่มีอยู่ (autofill ผู้ติดต่อ/เบอร์/อีเมล/location) หรือ Lead ใหม่ (กรอกเอง)
function showAddVisitPlanM(date, prefillDealerId, editId) {
  var dealers = [];
  try { dealers = ST.getAll('dealers'); } catch(e) { dealers = []; }
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
  h += '<div class="fm-group"><label>📅 วันที่นัด</label><input type="date" id="vp_date" class="fm-input" value="' + sanitize(date) + '"></div>';

  h += '<div style="display:flex;gap:6px;margin-bottom:10px">';
  h += '<button type="button" id="vp_src_dealer_btn" class="btn bsm ' + (sourceType === 'dealer' ? 'bp' : 'bo') + '" style="flex:1" onclick="vpSetSourceType(\'dealer\')">🏢 Dealer ที่มีอยู่</button>';
  h += '<button type="button" id="vp_src_lead_btn" class="btn bsm ' + (sourceType === 'lead' ? 'bp' : 'bo') + '" style="flex:1" onclick="vpSetSourceType(\'lead\')">🆕 Lead ใหม่</button>';
  h += '</div>';
  h += '<input type="hidden" id="vp_source_type" value="' + sourceType + '">';

  h += '<div class="fm-group"><label>📝 หัวข้อนัด</label><input type="text" id="vp_title" class="fm-input" value="' + sanitize(selTitle) + '" placeholder="เช่น เสนอราคา Matrice 4E"></div>';

  // โซน Dealer
  h += '<div id="vp_dealer_zone" style="' + (sourceType === 'dealer' ? '' : 'display:none') + '">';
  h += '<div class="fm-group"><label>🏪 Dealer</label><select id="vp_dealer" class="fm-input" onchange="vpDealerPicked()">';
  h += '<option value="">-- เลือก --</option>';
  dealers.forEach(function(d) {
    h += '<option value="' + d.id + '"' +
      ' data-contact="' + sanitize(d.contact || '') + '" data-phone="' + sanitize(d.phone || '') + '" data-email="' + sanitize(d.email || '') + '" data-map="' + sanitize(d.googleMap || '') + '"' +
      (selDealer === d.id ? ' selected' : '') + '>' + sanitize(d.name) + '</option>';
  });
  h += '</select></div>';
  h += '<div id="vp_dealer_preview" style="font-size:11px;color:var(--text2);margin-bottom:8px"></div>';
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

  h += '<div class="fm-group"><label>📋 งานที่เกี่ยวข้อง (ถ้ามี)</label><select id="vp_task" class="fm-input">';
  h += '<option value="">-- ไม่ระบุ --</option>';
  var tasks = [];
  try { tasks = ST.filter('tasks', function(t) { return t.status === 'active'; }); } catch(e) {}
  tasks.forEach(function(t) {
    var dd = t.dealerId ? ST.getOne('dealers', t.dealerId) : null;
    var label = sanitize(t.title) + (dd ? ' (' + sanitize(dd.name) + ')' : '');
    h += '<option value="' + t.id + '"' + (plan && plan.taskId === t.id ? ' selected' : '') + '>' + label + '</option>';
  });
  h += '</select></div>';

  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><input type="text" id="vp_note" class="fm-input" value="' + sanitize(selNote) + '" placeholder="เช่น Follow-up M400, Demo L3"></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveVisitPlan(document.getElementById(\'vp_date\').value||\'' + date + '\',\'' + (editId || '') + '\')">💾 บันทึก</button>';
  if (editId) h += '<button class="btn bd" onclick="removeVisitPlan(\'' + editId + '\')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM(editId ? '✏️ แก้ไขแผนนัด' : '➕ วางแผนนัดใหม่', h);

  setTimeout(vpDealerPicked, 50);
  setTimeout(function() { vpCheckTimeConflict(date, editId || ''); }, 50);
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

// โชว์ preview ข้อมูลผู้ติดต่อของ Dealer ที่เลือก (ดึงสดจากข้อมูล Dealer เสมอ ไม่ copy ลงแผน)
function vpDealerPicked() {
  var sel = document.getElementById('vp_dealer');
  var prev = document.getElementById('vp_dealer_preview');
  if (!sel || !prev) return;
  if (!sel.value) { prev.innerHTML = ''; return; }
  var opt = sel.options[sel.selectedIndex];
  var lines = [];
  if (opt.getAttribute('data-contact')) lines.push('👤 ' + opt.getAttribute('data-contact'));
  if (opt.getAttribute('data-phone')) lines.push('📞 ' + opt.getAttribute('data-phone'));
  if (opt.getAttribute('data-email')) lines.push('✉️ ' + opt.getAttribute('data-email'));
  if (opt.getAttribute('data-map')) lines.push('📍 ' + opt.getAttribute('data-map'));
  prev.innerHTML = lines.length ? ('💡 ดึงจากข้อมูล Dealer: ' + lines.join(' · ')) : '<span style="color:#f59e0b">⚠️ Dealer นี้ยังไม่มีข้อมูลผู้ติดต่อ — แก้ไขเพิ่มได้ที่หน้า Dealer</span>';
}

function saveVisitPlan(date, editId) {
  var sourceType = document.getElementById('vp_source_type').value || 'dealer';
  var title = (document.getElementById('vp_title').value || '').trim();
  var mode = document.getElementById('vp_mode').value || 'offline';
  var taskId = document.getElementById('vp_task') ? document.getElementById('vp_task').value : '';
  var note = (document.getElementById('vp_note').value || '').trim();
  var timeStart = document.getElementById('vp_time_start') ? document.getElementById('vp_time_start').value : '';
  var timeEnd = document.getElementById('vp_time_end') ? document.getElementById('vp_time_end').value : '';

  var data = { date: date, sourceType: sourceType, title: title, mode: mode, taskId: taskId, note: note, timeStart: timeStart, timeEnd: timeEnd };

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
    plans.push(data);
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
  ST.update('visitPlans', planId, { status: 'done', visitId: visitId });
  if (typeof syncToFirebase === 'function') syncToFirebase('visitPlans', ST.getAll('visitPlans'));
  var pid = prospectId || (plan && plan.prospectId) || '';
  if (pid && typeof _vpAdvanceProspectIfBehind === 'function') _vpAdvanceProspectIfBehind(pid, 'visited', 'เข้าพบตามนัดแล้ว');
}

function vpGoVisitLead(planId) {
  var plan = ST.getOne('visitPlans', planId);
  if (!plan) return;
  window._vpLinkPlanId = planId;
  window._visitSourceType = 'lead';
  window._vpPrefillProspectId = plan.prospectId || '';
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
  if (typeof syncToFirebase === 'function') syncToFirebase('visits', ST.getAll('visits'));
  ST.update('visitPlans', planId, { visitId: visitObj.id });
  if (typeof syncToFirebase === 'function') syncToFirebase('visitPlans', ST.getAll('visitPlans'));
}

function vpQuickMarkAttended(planId) {
  var plan = ST.getOne('visitPlans', planId);
  if (!plan) return;
  ST.update('visitPlans', planId, {
    status: 'done',
    actual: { status: 'attended', note: (plan.actual && plan.actual.note) || '', date: _td() }
  });
  if (typeof syncToFirebase === 'function') syncToFirebase('visitPlans', ST.getAll('visitPlans'));
  _createVisitFromPlan(planId, (plan.actual && plan.actual.note) || '');
  if (plan.prospectId) _vpAdvanceProspectIfBehind(plan.prospectId, 'visited', 'เข้าพบตามนัดแล้ว');
  toast('✅ บันทึกแล้ว · สร้าง Visit Report แล้ว');
  render();
}

function saveVpLeadActual(planId, status) {
  var note = (document.getElementById('vp_actual_note').value || '').trim();
  var plan = ST.getOne('visitPlans', planId);
  ST.update('visitPlans', planId, {
    status: status === 'attended' ? 'done' : status,
    actual: { status: status, note: note, date: _td() }
  });
  if (typeof syncToFirebase === 'function') syncToFirebase('visitPlans', ST.getAll('visitPlans'));
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
  ST.update('visitPlans', planId, { status: 'planned', actual: null });
  if (typeof syncToFirebase === 'function') syncToFirebase('visitPlans', ST.getAll('visitPlans'));
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
function rSmartFilter(el) {
  var fid = S.filterId;
  var filters = getSmartFilters();
  var f = null;
  for (var i = 0; i < filters.length; i++) {
    if (filters[i].id === fid) { f = filters[i]; break; }
  }
  document.getElementById('pgT').textContent = f ? f.icon + ' ' + f.name : '🔍 Smart Filter';
  
  var html = '';

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
      try { items = ST.filter('pipeline', function(p) { return p.biddingDate && isInRange(p.biddingDate, w.start, w.end) && pipeIsOpen(p); }); } catch(e) {}
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

  h += '<div style="font-size:.64rem;color:#64748b;margin-top:6px">' + notes.length + ' note' + (noteSearch ? ' · ค้นหา: "' + sanitize(noteSearch) + '"' : '') + '</div>';

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
        badge +
      '</div>' +
      '<div class="note-gc-title">' + (n.pinned?'📌 ':'') + sanitize(n.title || 'ไม่มีชื่อ') + '</div>' +
      '<div class="note-gc-preview">' + sanitize((n.content||'').substr(0, 100)) + '</div>' +
      '<div class="note-gc-meta">' + fDShort(n.created ? n.created.split('T')[0] : '') + '</div>' +
    '</div>' +
  '</div>';
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
  return '<div class="note-list-card' + (n.pinned?' pinned':'') + '" style="' + (isInactive?'opacity:.5;':'') + '">' +
    '<div class="note-lc-bar" style="background:' + color + '"></div>' +
    '<div class="note-lc-body" onclick="go(\'noteDetail\',{noteId:\'' + n.id + '\'})">' +
      '<div class="note-lc-top">' +
        '<div class="note-lc-title">' + (n.pinned?'📌 ':'') + sanitize(n.title || 'ไม่มีชื่อ') + '</div>' +
        badge +
      '</div>' +
      '<div class="note-lc-preview">' + sanitize((n.content||'').substr(0,130)) + '</div>' +
      '<div class="note-lc-meta">' +
        '<span class="note-badge" style="background:' + color + '22;color:' + color + '">' + sanitize(n.category||'📌 อื่นๆ') + '</span>' +
        '<span class="nlm-date">' + fDShort(n.created ? n.created.split('T')[0] : '') + '</span>' +
        (tags.length ? tags.map(function(t){return '<span class="note-badge grey">#' + sanitize(t.trim()) + '</span>';}).join('') : '') +
      '</div>' +
    '</div>' +
    '<div class="note-lc-qs">' +
      '<button class="qs-btn" onclick="event.stopPropagation();showNoteM(\'' + n.id + '\')" title="แก้ไข">✏️</button>' +
      '<button class="qs-btn" onclick="event.stopPropagation();ST.update(\'notes\',\'' + n.id + '\',{pinned:' + (!n.pinned) + '});render()" title="' + (n.pinned?'เอาออกจากปัก':'ปักหมุด') + '">' + (n.pinned?'📌':'📍') + '</button>' +
      '<button class="qs-btn" onclick="event.stopPropagation();trashKBNote(\'' + n.id + '\')" title="ย้ายไปถังขยะ">🗑️</button>' +
    '</div>' +
  '</div>';
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
  
  html += '<div class="note-content">' + safeText(n.content || '') + '</div>';
  html += attachGalleryHtml(n.attachments);

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

  var h = '';
  
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
        '<button class="btn bsm bd" onclick="ST.delete(\'waiting\',\'' + w.id + '\');render()">✕</button></div>';
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
  
  h += '<div class="card"><h2>🔔 Browser Notification</h2>' +
    '<button class="btn bs" onclick="if(\'Notification\' in window)Notification.requestPermission().then(p=>toast(p===\'granted\'?\'✅ เปิดแล้ว\':\'❌\'));else toast(\'ไม่รองรับ\',true)">🔔 เปิดการแจ้งเตือน</button>' +
    '<div style="margin-top:4px;font-size:.7rem;color:#64748b">' + ('Notification' in window ? 'สถานะ: ' + Notification.permission : 'ไม่รองรับ') + '</div></div>';
  
  el.innerHTML = h;
}

// ================================================================
// INSIGHTS PAGE
// ================================================================
function rInsights(el) {
  document.getElementById('pgT').textContent = '🤖 Insights';
  var insights = generateInsights();
  var sf = getSmartFilters();
  
  var h = '<div class="card"><h2>🔍 Smart Filters</h2>' +
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
    (Object.keys(reasons).length ? '<div style="font-size:.78rem;color:#94a3b8;margin-bottom:4px">สาเหตุที่แพ้:</div>' +
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
  
  var badHealth = (dealers || []).filter(function(d) { return calcHealthScore(d.id).score < 40; });
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
  var subject = (tmpl.subject || tmpl.name || '').replace(/\{sale\}/g, cfg.saleName || 'Siwawong').replace(/\{date\}/g, _td());
  var body = (tmpl.body || '').replace(/\{sale\}/g, cfg.saleName || 'Siwawong').replace(/\{date\}/g, _td());

  showEmailPreview(tmpl.to || '', subject, body);
}

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
  if (typeof syncToFirebase === 'function') syncToFirebase('emailDrafts', drafts);
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
  if (typeof syncToFirebase === 'function') syncToFirebase('emailDrafts', drafts);
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