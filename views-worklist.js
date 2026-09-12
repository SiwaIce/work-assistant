// ================================================================
// หน้างานค้าง — รวมทุกอย่างที่ "ยังไม่จบ" ไว้ที่เดียว
// ================================================================
// เดิมงานที่ค้างกระจายอยู่คนละเมนู: SO ที่ยังไม่ใส่ Project ID อยู่หน้า Sales Order, ใบที่ยังไม่ผูก SO
// อยู่ในสมุดเดินของ, โครงการที่ลงทะเบียน CRM ไว้แต่ไม่มีใครตามอยู่ในทะเบียน Project ID — ต้องเปิดไล่ดูเอง
// ทีละเมนูถึงจะรู้ว่ามีอะไรค้าง หน้านี้คำนวณสดจากข้อมูลที่มีอยู่แล้ว ไม่เก็บสถานะเพิ่ม (ไม่มีอะไรให้ค้างเก่า
// ไม่ตรงกับความจริง) แล้วให้กดจากตรงนี้ไปแก้ที่ต้นทางได้เลย
// ================================================================

var WL_STALE_DAYS = 90;   // ลงทะเบียน CRM ไว้นานเท่านี้แล้วยังไม่มีการขาย = ควรโทรถาม
var wlHide = {};          // กลุ่มที่ผู้ใช้ยุบไว้ (แค่การแสดงผล ไม่ได้บันทึก)

function _wlDaysAgo(d) {
  if (!d) return 0;
  var t = Date.parse(d + (d.length === 10 ? 'T00:00:00Z' : ''));
  if (isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}
function _wlDealerName(id) { var d = id ? ST.getOne('dealers', id) : null; return d ? d.name : ''; }
function _wlMoney(n) { return typeof fmtMoneyShort === 'function' ? fmtMoneyShort(n) : String(n || 0); }

// ---- รวบรวมงานค้างทั้งหมด ----
// คำนวณรอบเดียวต่อการวาดจอ แล้วแคชตามเลขรุ่นข้อมูล — หน้านี้อ่าน 6 collection รวมสมุดเดินของหลักพันแถว
var _wlCache = null, _wlRev = -1;
function wlGroups() {
  var rev = (typeof ST.rev === 'function') ? ST.rev() : 0;
  if (_wlCache && rev === _wlRev) return _wlCache;

  var sos = ST.getAll('salesOrders');
  var pipes = ST.getAll('pipeline');
  var regs = ST.getAll('djiProjects');
  var moves = ST.getAll('djiMovements');
  var dealers = ST.getAll('dealers');
  var dealerById = {}; dealers.forEach(function(d) { dealerById[d.id] = d; });
  var codeMap = {}; dealers.forEach(function(d) { if (d.djiCode) codeMap[String(d.djiCode).trim().toUpperCase()] = d; });

  var soByPipe = {}, soPids = {};
  sos.forEach(function(s) {
    if (s.pipelineId) (soByPipe[s.pipelineId] = soByPipe[s.pipelineId] || []).push(s);
    var c = pidCore(s.projectId);
    if (c) soPids[c] = (soPids[c] || 0) + 1;
  });

  var G = [];
  function group(id, icon, title, why, rows, act, actLabel) {
    if (rows.length) G.push({ id: id, icon: icon, title: title, why: why, rows: rows, act: act, actLabel: actLabel });
  }

  // 1) SO ที่ยังไม่มี Project ID และไม่ได้ผูกถัง Run rate
  group('so_nopid', '🔢', 'SO ที่ยังไม่มี Project ID',
    'เลขนี้ใช้เคลมกับ DJI — ใส่ตอนนี้ง่ายกว่าไปตามย้อนหลัง',
    sos.filter(function(s) { return !pidNorm(s.projectId) && !s.runrateId; }).map(function(s) {
      return { label: s.soNumber || '(ยังไม่มีเลข SO)', sub: (s.dealerName || _wlDealerName(s.dealerId)) + ' • ' + _wlMoney(_wlSOTotal(s)),
               act: "go('soDetail',{soId:" + jsArg(s.id) + "})" };
    }), "go('salesOrders')", 'ไปหน้า Sales Order');

  // 2) ส่งของแล้วแต่ยังไม่ได้กรอกเลข Invoice
  group('so_noinv', '🧾', 'ส่งของแล้วแต่ยังไม่มีเลข Invoice',
    'ไม่มีเลขใบกำกับ = จับคู่กับสมุดเดินของ DJI ไม่ได้ เลย SN ไม่เข้า SO',
    sos.filter(function(s) { return (s.status === 'shipped' || s.status === 'invoiced') && !_wlNorm(s.invoiceNumber); }).map(function(s) {
      return { label: s.soNumber || '-', sub: (s.dealerName || _wlDealerName(s.dealerId)) + ' • ' + ((SO_STATUS[s.status] || {}).label || s.status || ''),
               act: "go('soDetail',{soId:" + jsArg(s.id) + "})" };
    }), "go('salesOrders')", 'ไปหน้า Sales Order');

  // 3) มีเลข Invoice แล้ว และสมุดเดินของมี SN ของใบนั้นอยู่ แต่ SO ยังไม่มี SN
  var snByInv = {};
  moves.forEach(function(m) {
    var k = _djlNormInv(m.inv); if (!k || !m.sn) return;
    (snByInv[k] = snByInv[k] || {})[m.sn] = 1;
  });
  group('so_nosn', '🔖', 'SO ที่ยังไม่ได้ใส่ SN ทั้งที่สมุดมีแล้ว',
    'กดจับคู่จากหน้าสมุดเดินของ ระบบเติม SN เข้า SO ให้ทีเดียวทั้งใบ',
    sos.filter(function(s) {
      var k = _djlNormInv(s.invoiceNumber);
      if (!k || !snByInv[k]) return false;
      var got = (s.items || []).reduce(function(t, it) { return t + ((typeof _soItemSerials === 'function' ? _soItemSerials(it) : it.serials) || []).length; }, 0);
      return got === 0;
    }).map(function(s) {
      return { label: s.soNumber || '-', sub: 'Invoice ' + s.invoiceNumber + ' • สมุดมี ' + Object.keys(snByInv[_djlNormInv(s.invoiceNumber)]).length + ' SN',
               act: "go('djiLedger')" };
    }), "go('djiLedger')", 'ไปจับคู่ SN');

  // 4) โครงการที่ Win แล้วแต่ยังไม่ได้เปิด SO
  group('pipe_won_noso', '🏆', 'โครงการที่ Win แล้วแต่ยังไม่ได้เปิด SO',
    'ยอดที่ชนะแล้วยังไม่กลายเป็นออร์เดอร์ — ตกหล่นง่ายที่สุด',
    pipes.filter(function(p) { return pipeIsWon(p) && p.status !== 'deliver' && !(soByPipe[p.id] || []).length; }).map(function(p) {
      return { label: p.projectName || '(ไม่มีชื่อ)', sub: _wlDealerName(p.dealerId) + ' • ' + _wlMoney(p.forecastAmount),
               act: "go('pipeDetail',{pipeId:" + jsArg(p.id) + "})" };
    }), "go('pipeline')", 'ไปหน้า Pipeline');

  // 5) Win แล้วแต่ยังไม่มี Project ID ในโครงการ
  group('pipe_nopid', '📋', 'โครงการที่ Win แล้วแต่ยังไม่มี Project ID',
    'ลูกค้าน่าจะลงทะเบียน CRM ไว้แล้ว — ลองหาจากทะเบียน Project ID',
    pipes.filter(function(p) { return pipeIsWon(p) && !pidNorm(p.projectId); }).map(function(p) {
      return { label: p.projectName || '(ไม่มีชื่อ)', sub: _wlDealerName(p.dealerId) + ' • ' + _wlMoney(p.forecastAmount),
               act: 'wlOpenBoard()' };
    }), "go('djiProjects')", 'เปิดกระดานจับคู่');

  // 6) ทะเบียน Project ID ที่ยังไม่ได้ผูกกับอะไรเลย
  group('djp_unlinked', '🗂️', 'Project ID ที่ยังไม่ได้จับคู่',
    'ลูกค้าลงทะเบียนไว้แต่ยังไม่รู้ว่าเป็นโครงการไหนของเรา',
    regs.filter(function(p) { return !p.pipelineId && !p.runrateId; }).map(function(p) {
      var d = djpDealerOf(p);
      return { label: p.pid + ' · ' + (p.name || ''), sub: (d ? d.name : 'ยังไม่รู้ Dealer') + ' • ลงทะเบียน ' + (p.regDate || '-'),
               act: 'wlOpenBoard(' + jsArg((d && d.id) || '') + ',' + jsArg(p.id) + ')' };
    }), "go('djiProjects')", 'ไปทะเบียน Project ID');

  // 7) ลงทะเบียนไว้นานแล้วแต่ยังไม่มีการขายเลย
  group('djp_stale', '🕰️', 'Project ID ที่ลงทะเบียนเกิน ' + WL_STALE_DAYS + ' วันแล้วยังไม่มีการขาย',
    'ถึงเวลาถาม Dealer ว่างานยังอยู่ไหม หรือแพ้ไปแล้ว',
    regs.filter(function(p) {
      if (_wlDaysAgo(p.regDate) < WL_STALE_DAYS) return false;
      return !(djpSOsOf(p) || []).length;
    }).sort(function(a, b) { return (a.regDate || '').localeCompare(b.regDate || ''); }).map(function(p) {
      var d = djpDealerOf(p);
      return { label: p.pid + ' · ' + (p.name || ''), sub: (d ? d.name : '-') + ' • ผ่านมา ' + _wlDaysAgo(p.regDate) + ' วัน',
               act: "go('djiProjects')" };
    }), "go('djiProjects')", 'ไปทะเบียน Project ID');

  // 8) ใบกำกับในสมุดที่ยังไม่มี Project ID (เฉพาะใบที่ส่งให้ dealer ที่รู้จัก)
  var invAgg = {};
  moves.forEach(function(m) {
    var code = String(m.code || '').trim().toUpperCase();
    if (!codeMap[code]) return;                      // ถังยังไม่ authorized / ของเข้าคลัง ไม่ใช่งานค้างของเรา
    var k = _wlNorm(m.inv); if (!k) return;
    var g = invAgg[k] || (invAgg[k] = { inv: m.inv, pid: '', date: '', name: m.name, rows: 0 });
    g.rows++;
    if (pidNorm(m.pid) && !g.pid) g.pid = m.pid;
    if ((m.date || '') > g.date) g.date = m.date || '';
  });
  var invList = Object.keys(invAgg).map(function(k) { return invAgg[k]; });
  group('inv_nopid', '📖', 'ใบกำกับในสมุด DJI ที่ยังไม่มี Project ID',
    'ใส่ทีเดียวทั้งใบได้จากหน้าสมุด — เลือกหลายใบพร้อมกันก็ได้',
    invList.filter(function(g) { return !pidNorm(g.pid); }).sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); })
      .map(function(g) { return { label: g.inv, sub: (g.name || '') + ' • ' + g.rows + ' แถว • ' + (g.date || '-'), act: "go('djiLedger')" }; }),
    "go('djiLedger')", 'ไปหน้าสมุดเดินของ');

  // 9) ใบกำกับที่หา SO ไม่เจอ — ของออกจาก DJI แล้วแต่ฝั่งเราไม่มีใบสั่งขาย
  var soInv = {}; sos.forEach(function(s) { var k = _djlNormInv(s.invoiceNumber); if (k) soInv[k] = 1; });
  group('inv_noso', '❓', 'ใบกำกับในสมุด DJI ที่ไม่มี SO ในระบบ',
    'DJI ส่งของออกแล้วแต่ฝั่งเราไม่มีใบสั่งขาย — ลืมเปิด SO หรือเลข Invoice พิมพ์ไม่ตรง',
    invList.filter(function(g) { return !soInv[_djlNormInv(g.inv)]; }).sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); })
      .map(function(g) { return { label: g.inv, sub: (g.name || '') + ' • ' + g.rows + ' แถว • ' + (g.date || '-'), act: "go('djiLedger')" }; }),
    "go('djiLedger')", 'ไปหน้าสมุดเดินของ');

  // 10) เลข Project ID ที่พิมพ์ผิดรูปแบบ — ไล่เก็บจากทุกที่ที่กรอกได้
  var bad = [];
  sos.forEach(function(s) {
    if (pidNorm(s.projectId) && !pidLooksValid(s.projectId))
      bad.push({ label: s.projectId, sub: 'SO ' + (s.soNumber || '-'), act: "go('soDetail',{soId:" + jsArg(s.id) + "})" });
  });
  pipes.forEach(function(p) {
    if (pidNorm(p.projectId) && !pidLooksValid(p.projectId))
      bad.push({ label: p.projectId, sub: 'โครงการ ' + (p.projectName || '-'), act: "go('pipeDetail',{pipeId:" + jsArg(p.id) + "})" });
  });
  invList.forEach(function(g) {
    if (pidNorm(g.pid) && !pidLooksValid(g.pid))
      bad.push({ label: g.pid, sub: 'Invoice ' + g.inv, act: "go('djiLedger')" });
  });
  group('badfmt', '⚠️', 'เลข Project ID ที่รูปแบบไม่ถูก', PROJECT_ID_HINT, bad, "go('djiLedger')", 'ไปแก้ที่สมุด');

  _wlCache = G; _wlRev = rev;
  return G;
}

function _wlNorm(v) { return String(v === null || v === undefined ? '' : v).trim(); }
function _wlSOTotal(s) {
  return (s.items || []).reduce(function(t, it) { return t + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);
}

// เปิดกระดานจับคู่พร้อมเลือกให้ถึงตัวที่กดมาเลย — ต้องรอให้หน้าใหม่วาดเสร็จก่อนถึงจะเปิดโมดัลทับได้
function wlOpenBoard(dealerId, projId) {
  go('djiProjects');
  setTimeout(function() {
    if (typeof showDjpMatchBoardM !== 'function') return;
    showDjpMatchBoardM(dealerId || '');
    if (projId && typeof djpBoardPickProj === 'function') djpBoardPickProj(projId);
  }, 300);
}

function wlToggle(id) { if (wlHide[id]) delete wlHide[id]; else wlHide[id] = 1; render(); }

function rWorklist(el) {
  document.getElementById('pgT').textContent = '✅ งานค้าง';
  if (!ST._bigReady) {
    el.innerHTML = '<div class="card"><div class="empty"><div class="icon">⏳</div><p>กำลังรวบรวมงานค้าง…</p></div></div>';
    ST.whenBigReady(function() { if (S && S.view === 'worklist') rWorklist(el); });
    return;
  }
  var G = wlGroups();
  var total = G.reduce(function(t, g) { return t + g.rows.length; }, 0);

  var h = '<div class="card" style="margin-bottom:12px">';
  h += '<div class="hint">รวมทุกอย่างที่ยังไม่จบไว้ที่เดียว คำนวณสดจากข้อมูลจริงทุกครั้งที่เปิดหน้านี้ ' +
       'กดที่แถวไหนก็ไปแก้ที่ต้นทางได้เลย</div>';
  if (!total) {
    h += '<div class="empty"><div class="icon">🎉</div><p>ไม่มีงานค้าง — เคลียร์หมดแล้ว</p></div></div>';
    el.innerHTML = h;
    return;
  }
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">';
  G.forEach(function(g) {
    h += '<a href="#" onclick="document.getElementById(\'wl-' + g.id + '\').scrollIntoView({behavior:\'smooth\'});return false" ' +
         'style="text-decoration:none;padding:4px 10px;border-radius:20px;background:var(--bg2);border:1px solid var(--border);font-size:12px;color:var(--text)">' +
         g.icon + ' ' + g.rows.length + '</a>';
  });
  h += '</div></div>';

  G.forEach(function(g) {
    var open = !wlHide[g.id];
    h += '<div class="card" id="wl-' + g.id + '" style="margin-bottom:12px">';
    h += '<div style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="wlToggle(' + jsArg(g.id) + ')">';
    h += '<span style="font-size:18px">' + g.icon + '</span>';
    h += '<div style="flex:1"><b>' + sanitize(g.title) + '</b>' +
         '<div class="hint" style="margin:2px 0 0">' + sanitize(g.why) + '</div></div>';
    h += '<span style="background:#7f1d1d;color:#fca5a5;padding:2px 9px;border-radius:20px;font-size:12px;font-weight:700">' + g.rows.length + '</span>';
    h += '<span style="color:var(--text2)">' + (open ? '▾' : '▸') + '</span></div>';
    if (open) {
      h += '<div style="margin-top:10px">';
      g.rows.slice(0, 8).forEach(function(r) {
        h += '<div class="li" style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid var(--border)">';
        h += '<div style="flex:1;min-width:0"><div style="font-size:13px;overflow:hidden;text-overflow:ellipsis">' + sanitize(r.label) + '</div>' +
             '<div class="hint" style="margin:0">' + sanitize(r.sub) + '</div></div>';
        h += '<button class="btn bsm bo" onclick="' + r.act + '">แก้</button></div>';
      });
      if (g.rows.length > 8) h += '<div class="hint" style="margin-top:8px">…และอีก ' + (g.rows.length - 8) + ' รายการ</div>';
      h += '<div style="margin-top:10px"><button class="btn bsm" onclick="' + g.act + '">' + sanitize(g.actLabel) + '</button></div>';
      h += '</div>';
    }
    h += '</div>';
  });
  el.innerHTML = h;
}
