// ================================================================
// views-pipeline.js - PIPELINE MANAGEMENT
// ================================================================

var pipeFlt = 'all';
var pipeFY = 'all';
var pipeSearch = '';
var pipeSort = 'date_desc';
var pipeView = 'table';
var pipeGroup = 'none';
var pipeBoardDealer = 'all';
var pipeBoardMode = 'active';
var pipeBoardCollapsed = {};
var pipeBoardFY = 'all';

// ✅ ตัวแปรสำหรับ Forecast Tab (Pending / Rejected)
var forecastTab = 'pending';
var selectedForecastUpdates = {};

var _conflictMap = {}; // pipeId → [{otherId, dealerName, score, key}]
var pipeCompareMode = false;
var pipeCompareSelected = [];
var pipeCompareThreshold = 40;

// ✅ ไฮไลท์แถวที่ bidding ใกล้ถึง — เฉพาะ project ที่ยังไม่จบ (active status)
var PIPE_ACTIVE_STATUSES = ['prospect', 'tor_review', 'quotation', 'bidding', 'negotiation'];
function pipeBidUrgency(p) {
  if (!p || !p.biddingDate) return null;
  if (PIPE_ACTIVE_STATUSES.indexOf(p.status) === -1) return null;
  var d = dTo(p.biddingDate);
  if (d < 0) return null;
  if (d <= 7) return 'urgent';
  if (d <= 30) return 'soon';
  return null;
}

// ✅ ปักหมุด Pipeline — เก็บเป็น field บน record เอง ไม่พึ่งระบบ pins กลาง
// เพื่อให้ sync ไป client-view ผ่าน path เดิม (syncAllPipelinesToFirebase) ได้ตรงๆ
function togglePipePin(pipeId) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  ST.update('pipeline', pipeId, { pinned: !p.pinned });
  toast(p.pinned ? '❌ เอาออกจากหมุดแล้ว' : '📌 ปักหมุดแล้ว');
  render();
}

// ================================================================
// PIPELINE LIST
// ================================================================
// ================================================================
// โซน "งานที่อาจชนกัน" + modal เทียบ (Phase 3)
// ================================================================
// สร้าง lookup map: pipeId → [{otherId, dealerName, score, key, ownerName, isTeam}]
function buildConflictMap(conflicts) {
  var map = {};
  (conflicts || []).forEach(function(c) {
    var aIsTeam = !!c.a._isTeam;
    var bIsTeam = !!c.b._isTeam;
    var aDealer = aIsTeam ? (c.a._dealerName || '?') : (function() { var d = ST.getOne('dealers', c.a.dealerId); return d ? d.name : '?'; })();
    var bDealer = bIsTeam ? (c.b._dealerName || '?') : (function() { var d = ST.getOne('dealers', c.b.dealerId); return d ? d.name : '?'; })();
    if (!aIsTeam) {
      if (!map[c.a.id]) map[c.a.id] = [];
      map[c.a.id].push({ otherId: c.b.id, dealerName: bDealer, score: c.score, key: c.key, ownerName: c.b._ownerName || null, isTeam: bIsTeam });
    }
    if (!bIsTeam) {
      if (!map[c.b.id]) map[c.b.id] = [];
      map[c.b.id].push({ otherId: c.a.id, dealerName: aDealer, score: c.score, key: c.key, ownerName: c.a._ownerName || null, isTeam: aIsTeam });
    }
  });
  return map;
}

// จัดกลุ่ม conflict pairs ที่ซ้อนกันให้เป็น cluster เดียว (Union-Find)
function buildConflictClusters(conflicts) {
  var parent = {};
  function find(x) {
    if (!parent[x]) parent[x] = x;
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  (conflicts || []).forEach(function(c) {
    var px = find(c.a.id), py = find(c.b.id);
    if (px !== py) parent[px] = py;
  });
  var pipeMap = {};
  (conflicts || []).forEach(function(c) { pipeMap[c.a.id] = c.a; pipeMap[c.b.id] = c.b; });
  var groups = {};
  Object.keys(pipeMap).forEach(function(id) {
    var root = find(id);
    if (!groups[root]) groups[root] = [];
    if (groups[root].indexOf(id) === -1) groups[root].push(id);
  });
  var clusters = [];
  Object.keys(groups).forEach(function(root) {
    var ids = groups[root];
    var clPipes = ids.map(function(id) { return pipeMap[id]; });
    var maxScore = 0;
    var clConflicts = [];
    (conflicts || []).forEach(function(c) {
      if (ids.indexOf(c.a.id) !== -1 && ids.indexOf(c.b.id) !== -1) {
        clConflicts.push(c);
        if (c.score > maxScore) maxScore = c.score;
      }
    });
    clusters.push({ pipes: clPipes, maxScore: maxScore, conflicts: clConflicts });
  });
  clusters.sort(function(a, b) { return b.maxScore - a.maxScore; });
  return clusters;
}

// แสดง End User cluster view แทนแบบคู่ๆ เดิม
function buildConflictClusterHtml(conflicts) {
  if (!conflicts || !conflicts.length) return '';
  var clusters = buildConflictClusters(conflicts);
  var h = '<div class="card" style="border:1px solid #f59e0b;margin-bottom:10px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
  h += '<div style="font-weight:700;color:#f59e0b">⚠️ End User ที่มี Dealer หลายเจ้า (' + clusters.length + ' กลุ่ม)</div>';
  h += '<span style="font-size:11px;color:var(--text2)">' + conflicts.length + ' คู่ที่อาจชนกัน</span>';
  h += '</div>';
  clusters.slice(0, 10).forEach(function(cluster) {
    var scColor = cluster.maxScore >= 80 ? '#ef4444' : '#f59e0b';
    var label = '';
    cluster.pipes.forEach(function(p) { if (!label) label = p.endUserTH || p.endUserEN || p.projectName || ''; });
    h += '<div style="border:1px solid var(--border,#334155);border-radius:10px;padding:10px;margin-bottom:8px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">';
    h += '<div style="font-weight:600;font-size:13px">' + sanitize(label || '-') + '</div>';
    h += '<span style="background:' + scColor + '22;color:' + scColor + ';padding:2px 10px;border-radius:8px;font-size:11px;font-weight:700">ตรงกัน ' + cluster.maxScore + '%</span>';
    h += '</div>';
    cluster.pipes.forEach(function(p) {
      var d = ST.getOne('dealers', p.dealerId);
      var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : [];
      var modelText = items.slice(0, 2).map(function(it) { return (it.model || '') + (it.qty > 1 ? '×' + it.qty : ''); }).filter(Boolean).join(', ') || p.model || '-';
      h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--bg2,rgba(0,0,0,.15));border-radius:6px;margin-bottom:4px;flex-wrap:wrap">';
      h += '<div style="width:8px;height:8px;border-radius:50%;background:' + scColor + ';flex-shrink:0"></div>';
      h += '<div style="font-size:12px;font-weight:600;min-width:80px">' + sanitize(d ? d.name : '?') + '</div>';
      h += '<div style="font-size:11px;color:var(--text2);flex:1;min-width:80px">' + sanitize(modelText.substr(0, 30)) + '</div>';
      h += pipeTag(p.status);
      h += '<div style="font-size:11px;color:var(--text2)">' + (p.biddingDate ? 'Bid: ' + fDShort(p.biddingDate) : '') + '</div>';
      h += '<div style="font-size:11px;font-weight:600">' + fmtMoneyShort(Number(p.forecastAmount) || 0) + '</div>';
      h += '</div>';
    });
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
    cluster.conflicts.forEach(function(c) {
      var da2 = ST.getOne('dealers', c.a.dealerId), db2 = ST.getOne('dealers', c.b.dealerId);
      var na = da2 ? da2.name.split(' ')[0] : '?', nb = db2 ? db2.name.split(' ')[0] : '?';
      h += '<button class="btn bsm bp" onclick="compareConflict(\'' + c.a.id + '\',\'' + c.b.id + '\')">🔍 ' + sanitize(na) + ' ↔ ' + sanitize(nb) + '</button>';
    });
    h += '<button class="btn bsm bo" onclick="dismissCluster([' + cluster.conflicts.map(function(c) { return '\'' + c.key + '\''; }).join(',') + '])">✓ ไม่ใช่งานเดียวกัน</button>';
    h += '</div></div>';
  });
  h += '</div>';
  return h;
}

// Dismiss ทุก pair ในกลุ่มพร้อมกัน
function dismissCluster(keys) {
  if (typeof dismissConflict === 'function') keys.forEach(function(k) { dismissConflict(k); });
  toast('✓ ทำเครื่องหมายแล้ว');
  render();
}

// Modal แสดงรายชื่อ Dealer ที่ชนกับ pipe นี้ (กรณีชนหลายเจ้า)
function showConflictListM(pipeId) {
  var cList = _conflictMap[pipeId];
  if (!cList || !cList.length) return;
  var p = ST.getOne('pipeline', pipeId);
  var html = '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">โปรเจค: <strong>' + sanitize(p ? p.projectName : '') + '</strong> อาจชนกับ:</div>';
  cList.forEach(function(c) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border,#334155);border-radius:8px;margin-bottom:6px;flex-wrap:wrap">';
    html += '<div style="flex:1;font-weight:600;font-size:13px">' + sanitize(c.dealerName) + (c.ownerName ? ' <span style="font-size:.65rem;color:#f97316;font-weight:400;background:#f9731618;padding:1px 6px;border-radius:4px">👤 ' + sanitize(c.ownerName) + '</span>' : '') + '</div>';
    html += '<span style="font-size:11px;background:#ef444422;color:#ef4444;padding:2px 8px;border-radius:6px;font-weight:700">' + c.score + '%</span>';
    if (!c.isTeam) html += '<button class="btn bsm bp" onclick="closeM();compareConflict(\'' + pipeId + '\',\'' + c.otherId + '\')">🔍 เทียบ</button>';
    html += '<button class="btn bsm bo" onclick="dismissConflict(\'' + c.key + '\');render();closeM()">✓ ไม่ชน</button>';
    html += '</div>';
  });
  openM('⚠️ งานที่อาจชนกัน', html);
}
function dismissConflictPair(key) {
  if (typeof dismissConflict === 'function') dismissConflict(key);
  toast('✓ ทำเครื่องหมายแล้ว');
  render();
}
function compareConflict(idA, idB) {
  var a = ST.getOne('pipeline', idA), b = ST.getOne('pipeline', idB);
  if (!a || !b) return;
  var da = ST.getOne('dealers', a.dealerId), db = ST.getOne('dealers', b.dealerId);
  function col(p, d) {
    var items = (getPipeItems(p) || []).map(function(it){ return sanitize(it.model) + ' x' + (it.qty || 1); }).join(', ');
    var upd = p.updated ? String(p.updated).slice(0, 10) : '';
    var x = '<div style="flex:1;min-width:200px;border:1px solid var(--border,#334155);border-radius:10px;padding:10px">';
    x += '<div style="font-weight:700">' + sanitize(d ? d.name : '?') + '</div>';
    x += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">' + getPipeName(p.status) + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>โครงการ:</strong> ' + sanitize(p.projectName || '-') + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>End User:</strong> ' + sanitize(p.endUserTH || p.endUserEN || '-') + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>หน่วยงาน:</strong> ' + sanitize((p.agencyMain || '-') + ' / ' + (p.agencySub || '-')) + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>สินค้า:</strong> ' + (items || '-') + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>มูลค่า:</strong> ' + fmtMoney(p.forecastAmount) + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>Bidding:</strong> ' + (p.biddingDate ? fD(p.biddingDate) : '-') + '</div>';
    x += '<div style="font-size:12px;margin:2px 0"><strong>อัปเดตล่าสุด:</strong> ' + (upd ? fD(upd) : '-') + '</div>';
    x += '<div style="margin-top:8px"><button class="btn bsm bo" onclick="closeM();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">เปิดโปรเจค</button></div>';
    x += '</div>';
    return x;
  }
  var html = '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">ความเหมือน ' + pipeMatchScore(a, b) + '% — ดูว่าควรให้ dealer เจ้าไหนทำงานนี้</div>';
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap">' + col(a, da) + col(b, db) + '</div>';
  openM('🔍 เทียบงานที่อาจชนกัน', html);
}

// ================================================================
// เทียบ Project แบบเลือกเอง (สูงสุด 3 รายการ) — ไม่พึ่ง auto-detect อย่างเดียว
// ================================================================
function pipeCompareSetThreshold(val) {
  pipeCompareThreshold = Math.max(20, Math.min(80, val));
  render();
}
function pipeCompareStepThreshold(delta) {
  pipeCompareSetThreshold(pipeCompareThreshold + delta);
}

function togglePipeCompareMode() {
  pipeCompareMode = !pipeCompareMode;
  if (!pipeCompareMode) pipeCompareSelected = [];
  render();
}

function togglePipeCompareSelect(pipeId) {
  var idx = pipeCompareSelected.indexOf(pipeId);
  if (idx !== -1) { pipeCompareSelected.splice(idx, 1); }
  else {
    if (pipeCompareSelected.length >= 3) { toast('⚠️ เลือกได้สูงสุด 3 โปรเจค'); return; }
    pipeCompareSelected.push(pipeId);
  }
  render();
}

function pipeCompareQuickPick(idA, idB) {
  pipeCompareSelected = [idA, idB];
  render();
}

// หาคู่ที่คล้ายที่สุด (เจ้าอื่น, ยัง active) ให้แต่ละแถวเป็น guide ตอนเลือก
function pipeCompareBestMatch(p) {
  var all = ST.getAll('pipeline').filter(function(x) {
    return x.id !== p.id && x.dealerId !== p.dealerId && ['lost', 'delivered'].indexOf(x.status) === -1;
  });
  var best = null;
  all.forEach(function(x) {
    var sc = pipeMatchScore(p, x);
    if (!best || sc > best.score) best = { score: sc, other: x };
  });
  return best;
}

// แผงแนะนำคู่/โครงการที่น่าจะชนกัน — ก่อนเลือกโชว์ Top คู่ทั้งระบบ, หลังเลือกแล้วโชว์โครงการที่เข้ากับที่เลือกไว้
function renderPipeCompareSuggestPanel() {
  var active = ST.getAll('pipeline').filter(function(p) { return ['lost', 'delivered'].indexOf(p.status) === -1; });
  var sliderHtml = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:.72rem;color:var(--text2);flex-wrap:wrap">' +
    '<span>เกณฑ์คะแนนขั้นต่ำ</span>' +
    '<button class="btn bsm bo" style="padding:1px 8px" onclick="pipeCompareStepThreshold(-10)">−</button>' +
    '<input type="range" min="20" max="80" step="10" value="' + pipeCompareThreshold + '" list="pipeCompareTicks" style="width:100px" oninput="pipeCompareSetThreshold(parseInt(this.value))">' +
    '<datalist id="pipeCompareTicks"><option value="20"></option><option value="30"></option><option value="40"></option><option value="50"></option><option value="60"></option><option value="70"></option><option value="80"></option></datalist>' +
    '<button class="btn bsm bo" style="padding:1px 8px" onclick="pipeCompareStepThreshold(10)">+</button>' +
    '<strong style="color:var(--text);min-width:32px">' + pipeCompareThreshold + '%</strong>' +
    [20, 40, 60, 80].map(function(v) {
      return '<button class="btn bsm ' + (pipeCompareThreshold === v ? 'bp' : 'bo') + '" onclick="pipeCompareSetThreshold(' + v + ')">' + v + '%</button>';
    }).join('') +
    '</div>';

  var html = '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:10px 12px;margin-bottom:8px">';

  if (pipeCompareSelected.length === 0) {
    html += '<div style="font-size:.78rem;font-weight:700;margin-bottom:6px">🔥 คู่ที่น่าจะชนกันที่สุด (ทั้งระบบ)</div>' + sliderHtml;
    var pairs = [];
    for (var i = 0; i < active.length; i++) {
      for (var j = i + 1; j < active.length; j++) {
        if (active[i].dealerId === active[j].dealerId) continue;
        var sc = pipeMatchScore(active[i], active[j]);
        if (sc >= pipeCompareThreshold) pairs.push({ a: active[i], b: active[j], score: sc });
      }
    }
    pairs.sort(function(x, y) { return y.score - x.score; });
    pairs = pairs.slice(0, 8);
    if (!pairs.length) {
      html += '<div style="font-size:.72rem;color:var(--text2)">ไม่พบคู่ที่คะแนน ≥ ' + pipeCompareThreshold + '% — ลองลดเกณฑ์ดู</div>';
    } else {
      pairs.forEach(function(pr) {
        var da = ST.getOne('dealers', pr.a.dealerId), db = ST.getOne('dealers', pr.b.dealerId);
        var color = pr.score >= 60 ? '#ef4444' : '#f59e0b';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border,#334155);font-size:.72rem">' +
          '<span style="background:' + color + '22;color:' + color + ';font-weight:700;padding:2px 6px;border-radius:6px;white-space:nowrap">' + pr.score + '%</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize((pr.a.projectName || '-').substr(0, 22)) + ' (' + sanitize(da ? da.name : '?') + ') ↔ ' + sanitize((pr.b.projectName || '-').substr(0, 22)) + ' (' + sanitize(db ? db.name : '?') + ')</span>' +
          '<button class="btn bsm bp" onclick="pipeCompareQuickPick(\'' + pr.a.id + '\',\'' + pr.b.id + '\')">เลือกคู่นี้</button>' +
          '</div>';
      });
    }
  } else {
    html += '<div style="font-size:.78rem;font-weight:700;margin-bottom:6px">💡 แนะนำโครงการที่น่าจะเข้ากับที่เลือกไว้</div>' + sliderHtml;
    var selectedPipes = pipeCompareSelected.map(function(id) { return ST.getOne('pipeline', id); }).filter(Boolean);
    var candidates = [];
    active.forEach(function(p) {
      if (pipeCompareSelected.indexOf(p.id) !== -1) return;
      var best = null;
      selectedPipes.forEach(function(sp) {
        if (sp.dealerId === p.dealerId) return;
        var sc = pipeMatchScore(sp, p);
        if (!best || sc > best.score) best = { score: sc, vs: sp };
      });
      if (best && best.score >= pipeCompareThreshold) candidates.push({ p: p, score: best.score, vs: best.vs });
    });
    candidates.sort(function(x, y) { return y.score - x.score; });
    candidates = candidates.slice(0, 8);
    if (pipeCompareSelected.length >= 3) {
      html += '<div style="font-size:.72rem;color:var(--text2)">เลือกครบ 3 โปรเจคแล้ว — กด "เทียบเลย" ด้านล่างได้เลย</div>';
    } else if (!candidates.length) {
      html += '<div style="font-size:.72rem;color:var(--text2)">ไม่พบโครงการที่คะแนน ≥ ' + pipeCompareThreshold + '% กับที่เลือกไว้ — ลองลดเกณฑ์ดู</div>';
    } else {
      candidates.forEach(function(c) {
        var dc = ST.getOne('dealers', c.p.dealerId);
        var color = c.score >= 60 ? '#ef4444' : '#f59e0b';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border,#334155);font-size:.72rem">' +
          '<span style="background:' + color + '22;color:' + color + ';font-weight:700;padding:2px 6px;border-radius:6px;white-space:nowrap">' + c.score + '%</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize((c.p.projectName || '-').substr(0, 26)) + ' (' + sanitize(dc ? dc.name : '?') + ')</span>' +
          '<button class="btn bsm bp" onclick="togglePipeCompareSelect(\'' + c.p.id + '\')">+ เพิ่มเข้าเทียบ</button>' +
          '</div>';
      });
    }
  }

  html += '</div>';
  return html;
}

function renderPipeCompareBar() {
  var n = pipeCompareSelected.length;
  return '<div style="position:sticky;bottom:0;display:flex;justify-content:space-between;align-items:center;background:var(--card,#1e293b);border:1px solid #3b82f6;border-radius:10px;padding:10px 14px;margin-top:10px">' +
    '<span style="font-size:.78rem">เลือกแล้ว <strong>' + n + '/3</strong> โปรเจค</span>' +
    '<button class="btn bsm bp" ' + (n < 2 ? 'disabled' : '') + ' onclick="openPipeCompareModal()">🔍 เทียบเลย</button>' +
    '</div>';
}

// คำนวณสถิติความเคลื่อนไหว (จำนวน log, ความถี่เฉลี่ย, ล่าสุดกี่วันที่แล้ว)
function pipeActivityStats(pipeId) {
  var logs = ST.pipeLogsByPipe(pipeId); // เรียงใหม่สุดก่อนแล้ว
  if (!logs.length) return { count: 0, recency: 9999, avgGap: null, logs: logs };
  var lastDate = logs[0].date ? logs[0].date.split('T')[0] : null;
  var recency = lastDate ? Math.max(0, Math.round((new Date() - new Date(lastDate)) / 864e5)) : 9999;
  var avgGap = null;
  if (logs.length >= 2) {
    var oldest = logs[logs.length - 1].date ? logs[logs.length - 1].date.split('T')[0] : null;
    if (oldest && lastDate) {
      var span = Math.max(1, Math.round((new Date(lastDate) - new Date(oldest)) / 864e5));
      avgGap = Math.round(span / (logs.length - 1));
    }
  }
  return { count: logs.length, recency: recency, avgGap: avgGap, logs: logs };
}

function openPipeCompareModal() {
  var ids = pipeCompareSelected.slice();
  if (ids.length < 2) { toast('⚠️ เลือกอย่างน้อย 2 โปรเจค'); return; }
  var pipes = ids.map(function(id) { return ST.getOne('pipeline', id); }).filter(Boolean);
  if (pipes.length < 2) return;

  // คะแนนความเหมือนทุกคู่
  var pairBadges = '';
  var colHasMatch = pipes.map(function() { return false; });
  for (var i = 0; i < pipes.length; i++) {
    for (var j = i + 1; j < pipes.length; j++) {
      var sc = pipeMatchScore(pipes[i], pipes[j]);
      if (sc >= 60) { colHasMatch[i] = true; colHasMatch[j] = true; }
      var color = sc >= 60 ? '#ef4444' : (sc >= 40 ? '#f59e0b' : '#64748b');
      var bg = sc >= 60 ? 'rgba(239,68,68,.18)' : (sc >= 40 ? 'rgba(245,158,11,.18)' : 'rgba(100,116,139,.2)');
      pairBadges += '<span style="background:' + bg + ';color:' + color + ';font-size:11px;padding:4px 10px;border-radius:8px;font-weight:600;margin-right:6px;display:inline-block;margin-bottom:6px">' +
        String.fromCharCode(65 + i) + '↔' + String.fromCharCode(65 + j) + ' เหมือน ' + sc + '%</span>';
    }
  }

  function fieldMatchFlags(getter) {
    var vals = pipes.map(getter);
    var flags = vals.map(function() { return false; });
    for (var a = 0; a < vals.length; a++) {
      for (var b = a + 1; b < vals.length; b++) {
        if (fcStrSim(vals[a], vals[b]) >= 0.55) { flags[a] = true; flags[b] = true; }
      }
    }
    return flags;
  }
  var nameFlags = fieldMatchFlags(function(p) { return p.projectName || ''; });
  var euFlags = fieldMatchFlags(function(p) { return p.endUserTH || p.endUserEN || ''; });
  var bidFlags = pipes.map(function() { return false; });
  for (var a2 = 0; a2 < pipes.length; a2++) {
    for (var b2 = a2 + 1; b2 < pipes.length; b2++) {
      var da = fcParseDate(pipes[a2].biddingDate), db2 = fcParseDate(pipes[b2].biddingDate);
      if (da && db2 && Math.abs(da - db2) / 86400000 <= 30) { bidFlags[a2] = true; bidFlags[b2] = true; }
    }
  }

  // หาเจ้าที่อัพเดทถี่ที่สุด (recency น้อยสุด) ใช้เป็นฐานเทียบ "นิ่งนานกว่ามาก"
  var actStats = pipes.map(function(p) { return pipeActivityStats(p.id); });
  var minRecency = Math.min.apply(null, actStats.map(function(s) { return s.recency; }));
  var mostActiveIdx = actStats.findIndex(function(s) { return s.recency === minRecency; });

  var html = '<div style="margin-bottom:10px">' + pairBadges + '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(' + pipes.length + ',1fr);gap:10px">';
  pipes.forEach(function(p, idx) {
    var d = ST.getOne('dealers', p.dealerId);
    var items = (getPipeItems(p) || []).map(function(it) { return sanitize(it.model) + ' x' + (it.qty || 1); }).join(', ');
    var border = colHasMatch[idx] ? 'border:2px solid #ef4444' : 'border:1px solid var(--border,#334155)';
    var stat = actStats[idx];

    html += '<div style="background:var(--card,#1e293b);border-radius:12px;padding:12px;' + border + '">';
    html += '<div style="font-weight:700;font-size:13px">' + sanitize(d ? d.name : '?') + '</div>';
    html += '<div style="font-size:10px;color:var(--text2);margin-bottom:8px">' + String.fromCharCode(65 + idx) + ' · ' + getPipeName(p.status) + '</div>';

    function row(label, val, hl) {
      return '<div style="font-size:11px;color:var(--text2);margin-bottom:2px">' + label + '</div>' +
        '<div style="font-size:12px;' + (hl ? 'background:rgba(239,68,68,.15);border-radius:6px;padding:4px 6px;' : '') + 'margin-bottom:8px">' + (val || '-') + '</div>';
    }
    html += row('โครงการ', sanitize(p.projectName || '-'), nameFlags[idx]);
    html += row('End User', sanitize(p.endUserTH || p.endUserEN || '-'), euFlags[idx]);
    html += row('หน่วยงาน', sanitize((p.agencyMain || '-') + ' / ' + (p.agencySub || '-')), false);
    html += row('สินค้า', items || '-', false);
    html += row('มูลค่า', fmtMoney(p.forecastAmount), false);
    html += row('Bidding', p.biddingDate ? fD(p.biddingDate) : '-', bidFlags[idx]);

    // สรุปความเคลื่อนไหว
    if (stat.count > 0) {
      html += '<div style="background:var(--bg,#0f172a);border-radius:8px;padding:8px;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">' +
        '<span style="color:var(--text2)">📅 ความเคลื่อนไหว</span>' +
        '<span style="font-weight:700;color:' + (stat.recency <= 14 ? '#22c55e' : '#f59e0b') + '">' + (stat.avgGap ? ('ทุก ~' + stat.avgGap + ' วัน') : '-') + '</span></div>' +
        '<div style="font-size:10px;color:var(--text2)">อัพเดท ' + stat.count + ' ครั้ง · ล่าสุด ' + (stat.recency === 0 ? 'วันนี้' : stat.recency + ' วันที่แล้ว') + '</div></div>';
    } else {
      html += '<div style="background:var(--bg,#0f172a);border-radius:8px;padding:8px;margin-bottom:8px;font-size:11px;color:var(--text2)">📅 ยังไม่มีบันทึกความเคลื่อนไหว</div>';
    }

    // เตือนถ้านิ่งนานกว่าเจ้าที่ active สุด ≥2 เท่า (และต่างกัน ≥14 วัน กันสัญญาณรบกวนตัวเลขเล็ก)
    if (idx !== mostActiveIdx && stat.recency >= minRecency * 2 && (stat.recency - minRecency) >= 14) {
      var ownerDealer = ST.getOne('dealers', pipes[mostActiveIdx].dealerId);
      html += '<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:6px 8px;margin-bottom:8px;font-size:10px;color:#f87171">⚠️ นิ่งนานกว่า ' + sanitize(ownerDealer ? ownerDealer.name : '-') + ' มาก — น่าจะไม่ใช่เจ้าของงานจริง</div>';
    }

    var logId = 'pcmpLog_' + p.id;
    html += '<div style="font-size:11px;color:var(--accent,#3b82f6);cursor:pointer;margin-bottom:6px" onclick="var e=document.getElementById(\'' + logId + '\');e.style.display=e.style.display===\'none\'?\'block\':\'none\'">▾ ดู Timeline ทั้งหมด (' + stat.count + ')</div>';
    html += '<div id="' + logId + '" style="display:none;border-left:2px solid var(--border,#334155);padding-left:10px;margin-left:4px;margin-bottom:8px">';
    stat.logs.forEach(function(l, li) {
      var ld = l.date ? l.date.split('T')[0] : '';
      var ldays = ld ? Math.max(0, Math.round((new Date() - new Date(ld)) / 864e5)) : null;
      html += '<div style="margin-bottom:8px;position:relative"><div style="position:absolute;left:-15px;top:3px;width:7px;height:7px;border-radius:50%;background:' + (li === 0 ? '#22c55e' : 'var(--text2)') + '"></div>' +
        '<div style="font-size:10px;color:var(--text2)">' + (ldays === 0 ? 'วันนี้' : (ldays !== null ? ldays + ' วันที่แล้ว' : '')) + '</div>' +
        '<div style="font-size:11px">' + sanitize((l.content || '').substr(0, 80)) + '</div></div>';
    });
    html += '</div>';

    html += '<button class="btn bsm bo" style="width:100%" onclick="closeM();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">เปิดโปรเจคนี้ →</button>';
    html += '</div>';
  });
  html += '</div>';

  openM('🔍 เทียบ Project (' + pipes.length + ')', html);
}

function rPipeline(el) {
  document.getElementById('pgT').textContent = '📊 Pipeline';
  var cfg = getConfig();
  var allPipes = ST.getAll('pipeline');
  
  var pipes = allPipes;
  if (pipeFlt !== 'all') pipes = pipes.filter(function(p) { return p.status === pipeFlt; });
  if (pipeFY !== 'all') pipes = pipes.filter(function(p) {
    var fy = p.budgetFiscalYear || thaiFYFromISO(p.expectedCloseDate || p.biddingDate);
    return String(fy || '') === String(pipeFY);
  });

  if (pipeSearch) {
    var q = pipeSearch.toLowerCase();
    pipes = pipes.filter(function(p) {
      var d = ST.getOne('dealers', p.dealerId);
      return (p.projectName || '').toLowerCase().indexOf(q) !== -1 ||
             (p.endUserTH || '').toLowerCase().indexOf(q) !== -1 ||
             (p.endUserEN || '').toLowerCase().indexOf(q) !== -1 ||
             (p.model || '').toLowerCase().indexOf(q) !== -1 ||
             (d && d.name || '').toLowerCase().indexOf(q) !== -1 ||
             (p.remark || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  
  pipes = sortPipes(pipes, pipeSort);
  
  var ps = getPipeSummary();
  
  var totalAllForecast = 0;
  var activeAmt = 0;
  var wonAmt = 0;
  var lostAmt = 0;
  allPipes.forEach(function(p) {
    var amt = Number(p.forecastAmount) || 0;
    totalAllForecast += amt;
    if (['lost','delivered'].indexOf(p.status) === -1) activeAmt += amt;
    if (['win','ordered','delivered'].indexOf(p.status) !== -1) wonAmt += amt;
    if (p.status === 'lost') lostAmt += amt;
  });
  var biddingSoon = allPipes.filter(function(p) { return p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 30 && ['prospect','tor_review','quotation','bidding','negotiation'].indexOf(p.status) !== -1; });
  var teamPipes = (typeof _teamPipelineData !== 'undefined' && Array.isArray(_teamPipelineData)) ? _teamPipelineData : [];
  var conflicts = (typeof detectPipelineConflicts === 'function') ? detectPipelineConflicts(allPipes.concat(teamPipes), 60) : [];
  _conflictMap = buildConflictMap(conflicts);

  el.innerHTML = '' +
    '<div class="sr">' +
    '<div class="sc"><div class="sn c1">' + allPipes.length + '</div><div class="sl">ทั้งหมด</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(activeAmt) + '</div><div class="sl">Active</div></div>' +
    '<div class="sc"><div class="sn c5">' + fmtMoneyShort(totalAllForecast) + '</div><div class="sl">Total</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(wonAmt) + '</div><div class="sl">Won</div></div>' +
    '<div class="sc"><div class="sn c4">' + fmtMoneyShort(lostAmt) + '</div><div class="sl">Lost</div></div>' +
    '<div class="sc"><div class="sn c3">' + biddingSoon.length + '</div><div class="sl">Bidding 30d</div></div>' +
    (conflicts.length ? '<div class="sc"><div class="sn c4">' + conflicts.length + '</div><div class="sl">⚠️ อาจชนกัน</div></div>' : '') +
    '</div>' +

    buildConflictClusterHtml(conflicts) +

    '<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;align-items:center">' +
    '<button class="btn bp" onclick="showPipelineM()">➕ เพิ่ม</button>' +
    '<button class="btn bo" onclick="showImportPipelineM()">📥 Import</button>' +
    '<button class="btn bo" onclick="showPastePipelineM()">📋 วาง Excel</button>' +
    '<button class="btn bo" onclick="copyPipeTable()">📋 Copy</button>' +
    '<button class="btn bo" onclick="dlPipeCSV()">📤 CSV</button>' +
    '<button class="btn bo" onclick="aiAnalyzePipeline(this)">🤖 AI วิเคราะห์</button>' +
    '<button class="btn ' + (pipeCompareMode ? 'bp' : 'bo') + '" onclick="togglePipeCompareMode()">🔍 ' + (pipeCompareMode ? 'ออกจากโหมดเทียบ' : 'เทียบ Project') + '</button>' +
    '<div style="flex:1"></div>' +
    '<button class="btn bsm ' + (pipeView === 'table' ? 'bp' : 'bo') + '" onclick="pipeView=\'table\';render()" title="ตาราง">📋</button>' +
    '<button class="btn bsm ' + (pipeView === 'card' ? 'bp' : 'bo') + '" onclick="pipeView=\'card\';render()" title="การ์ด">🃏</button>' +
    '<button class="btn bsm ' + (pipeView === 'sheet' ? 'bp' : 'bo') + '" onclick="pipeView=\'sheet\';render()" title="Sheet เต็มคอลัมน์">📊</button>' +
    '<button class="btn bsm ' + (pipeView === 'sheetedit' ? 'bp' : 'bo') + '" onclick="pipeView=\'sheetedit\';render()" title="แก้ไขแบบตาราง">🗂️</button>' +
    '</div>' +

    (pipeCompareMode ? renderPipeCompareSuggestPanel() : '') +

    '<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap">' +
    '<input type="text" id="pipeSrc" value="' + sanitize(pipeSearch) + '" placeholder="🔍 ค้นหา Project / End User / Dealer / Model..." style="flex:1;min-width:150px" oninput="pipeSearch=this.value;render()" autocomplete="off">' +
    '<select id="pipeSortSel" onchange="pipeSort=this.value;render()" style="min-width:120px">' +
    '<option value="date_desc"' + (pipeSort === 'date_desc' ? ' selected' : '') + '>วันที่ ใหม่สุด</option>' +
    '<option value="date_asc"' + (pipeSort === 'date_asc' ? ' selected' : '') + '>วันที่ เก่าสุด</option>' +
    '<option value="amount_desc"' + (pipeSort === 'amount_desc' ? ' selected' : '') + '>มูลค่า มากสุด</option>' +
    '<option value="amount_asc"' + (pipeSort === 'amount_asc' ? ' selected' : '') + '>มูลค่า น้อยสุด</option>' +
    '<option value="bidding"' + (pipeSort === 'bidding' ? ' selected' : '') + '>Bidding ใกล้สุด</option>' +
    '<option value="close"'   + (pipeSort === 'close'   ? ' selected' : '') + '>Expected Close ใกล้สุด</option>' +
    '<option value="dealer"' + (pipeSort === 'dealer' ? ' selected' : '') + '>ตาม Dealer</option>' +
    '<option value="status"' + (pipeSort === 'status' ? ' selected' : '') + '>ตาม Status</option>' +
    '</select>' +
    '<select id="pipeFYSel" onchange="pipeFY=this.value;render()" style="min-width:120px">' +
    '<option value="all"' + (pipeFY === 'all' ? ' selected' : '') + '>🏛️ ทุกปีงบ</option>' +
    (function() {
      var cur = currentThaiFY(); var o = '';
      for (var fy = cur + 2; fy >= cur - 2; fy--) o += '<option value="' + fy + '"' + (String(pipeFY) === String(fy) ? ' selected' : '') + '>ปีงบ ' + fy + (fy === cur ? ' (ปีนี้)' : '') + '</option>';
      return o;
    })() +
    '</select>' +
    '</div>' +

    '<div class="pipe-sum">' + 
    Object.entries(ps.summary).filter(function(e) { return e[1].count > 0; }).map(function(e) {
      var k = e[0], v = e[1];
      return '<div class="pipe-sum-card ' + (pipeFlt === k ? 'act' : '') + '" onclick="pipeFlt=\'' + (pipeFlt === k ? 'all' : k) + '\';render()">' +
        '<div class="stage" style="color:' + (v.color || '#94a3b8') + '">' + v.name + '</div>' +
        '<div class="count">' + v.count + '</div>' +
        '<div class="amount">' + fmtMoneyShort(v.amount) + '</div></div>';
    }).join('') +
    '<div class="pipe-sum-card ' + (pipeFlt === 'all' ? 'act' : '') + '" onclick="pipeFlt=\'all\';render()">' +
    '<div class="stage">📊 ทั้งหมด</div><div class="count">' + ps.totalCount + '</div><div class="amount">' + fmtMoneyShort(ps.totalPipeline) + '</div></div>' +
    '</div>' +

    (pipeView === 'card' ? renderPipeCards(pipes) :
     pipeView === 'sheet' ? renderPipeSheetTable(pipes) :
     pipeView === 'sheetedit' ? '<div id="pipeSheetWrap"><div id="pipeSheetEl" style="overflow-x:auto"></div><div style="margin-top:8px;display:flex;gap:8px;align-items:center"><button class="btn bp" onclick="savePipeSheet()">💾 บันทึกทั้งหมด</button><span id="pipeSheetStatus" style="font-size:.8rem;color:var(--text2)"></span></div></div>' :
     renderPipeTable(pipes)) +

    '<div style="font-size:.64rem;color:#64748b;margin-top:4px">' + pipes.length + ' รายการ' +
    (pipeSearch ? ' (ค้นหา: "' + sanitize(pipeSearch) + '")' : '') +
    '</div>' +

    (pipeCompareMode ? renderPipeCompareBar() : '');

  if (pipeView === 'sheetedit') {
    setTimeout(function() { initPipeSheet(pipes); }, 0);
  }

  var srcEl = document.getElementById('pipeSrc');
  if (srcEl && pipeSearch) {
    srcEl.focus();
    srcEl.setSelectionRange(pipeSearch.length, pipeSearch.length);
  }
}

function sortPipes(pipes, sortBy) {
  var sorted = pipes.slice();
  switch (sortBy) {
    case 'date_desc':
      sorted.sort(function(a, b) { return (b.registerDate || b.created || '').localeCompare(a.registerDate || a.created || ''); });
      break;
    case 'date_asc':
      sorted.sort(function(a, b) { return (a.registerDate || a.created || '').localeCompare(b.registerDate || b.created || ''); });
      break;
    case 'amount_desc':
      sorted.sort(function(a, b) { return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); });
      break;
    case 'amount_asc':
      sorted.sort(function(a, b) { return (Number(a.forecastAmount) || 0) - (Number(b.forecastAmount) || 0); });
      break;
    case 'bidding':
      sorted.sort(function(a, b) {
        var da = a.biddingDate || '9999';
        var db = b.biddingDate || '9999';
        return da.localeCompare(db);
      });
      break;
    case 'close':
      sorted.sort(function(a, b) {
        var da = a.expectedCloseDate || a.biddingDate || '9999';
        var db = b.expectedCloseDate || b.biddingDate || '9999';
        return da.localeCompare(db);
      });
      break;
    case 'dealer':
      sorted.sort(function(a, b) {
        var da = ST.getOne('dealers', a.dealerId);
        var db = ST.getOne('dealers', b.dealerId);
        return (da ? da.name : '').localeCompare(db ? db.name : '');
      });
      break;
    case 'status':
      var statusOrder = ['bidding','negotiation','quotation','tor_review','prospect','win','ordered','delivered','on_hold','lost','recurring'];
      sorted.sort(function(a, b) {
        var ia = statusOrder.indexOf(a.status);
        var ib = statusOrder.indexOf(b.status);
        if (ia === -1) ia = 99;
        if (ib === -1) ib = 99;
        return ia - ib;
      });
      break;
  }
  return sorted;
}

function renderPipeCards(pipes) {
  if (!pipes.length) return '<div class="empty"><div class="icon">📊</div><p>ไม่พบ Pipeline</p></div>';
  pipes = pipes.slice().sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });

  var html = '<div class="card-grid">';
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    var d = ST.getOne('dealers', p.dealerId);
    var amt = Number(p.forecastAmount) || 0;
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    var bidUrgency = pipeBidUrgency(p);
    var cardBorder = p.pinned ? 'border-left:3px solid #3b82f6' : (bidUrgency === 'urgent' ? 'border-left:3px solid #ef4444' : (bidUrgency === 'soon' ? 'border-left:3px solid #f59e0b' : ''));

    var cCard = _conflictMap[p.id];
    var cCardTag = '';
    if (cCard && cCard.length === 1) {
      var cLabel = sanitize((cCard[0].dealerName || '').split(' ')[0]);
      if (cCard[0].ownerName) cLabel += ' (' + sanitize(cCard[0].ownerName) + ')';
      var cCardAction = cCard[0].isTeam ? 'showConflictListM(\'' + p.id + '\')' : 'compareConflict(\'' + p.id + '\',\'' + cCard[0].otherId + '\')';
      cCardTag = '<span style="font-size:10px;background:#ef444418;color:#ef4444;border:1px solid #ef444430;padding:1px 6px;border-radius:4px;cursor:pointer" onclick="event.stopPropagation();' + cCardAction + '">⚠️ ชน ' + cLabel + '</span>';
    } else if (cCard && cCard.length > 1) {
      cCardTag = '<span style="font-size:10px;background:#ef444418;color:#ef4444;border:1px solid #ef444430;padding:1px 6px;border-radius:4px;cursor:pointer" onclick="event.stopPropagation();showConflictListM(\'' + p.id + '\')">⚠️ ชน ' + cCard.length + ' เจ้า</span>';
    }
    html += '<div class="dealer-card" style="' + cardBorder + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
    html += '<div style="display:flex;align-items:center;gap:6px"><span class="pipe-row-num">#' + (i + 1) + '</span>';
    html += '<h3 style="font-size:.78rem;margin:0;flex:1">' + sanitize((p.projectName || '').substr(0, 45)) + '</h3>';
    html += '<button class="pipe-pin-btn' + (p.pinned ? ' on' : '') + '" title="ปักหมุด" onclick="event.stopPropagation();togglePipePin(\'' + p.id + '\')">📌</button></div>';
    html += '<div class="meta">' + (d ? d.name : '-') + ' • ' + (p.unitType || '') + '</div>';
    var _fyCard = pipeFYStatus(p);
    html += '<div class="tr">' + pipeTag(p.status) + (amt >= 1500000 ? ' <span class="tag tag-high">💰 Big</span>' : '') + (cCardTag ? ' ' + cCardTag : '') + (_fyCard ? ' <span class="tag" style="background:' + _fyCard.c + '18;color:' + _fyCard.c + '">' + _fyCard.e + ' ' + _fyCard.t + '</span>' : '') + '</div>';
    html += '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:.76rem;align-items:center">' + fmtMoneyStyled(amt) + '</div>';
    html += '<div class="meta" style="margin-top:2px">' + (p.model ? '📦 ' + sanitize((p.model || '').substr(0, 25)) : '') + (p.biddingDate ? ' • Bid: ' + fDShort(p.biddingDate) : '') + '</div>';
    if (lastLog) html += '<div style="font-size:.6rem;color:#475569;margin-top:3px">📝 ' + fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 35)) + '</div>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderPipeTable(pipes) {
  if (!pipes.length) return '<div class="empty"><div class="icon">📊</div><p>ไม่พบ Pipeline</p></div>';
  pipes = pipes.slice().sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });

  var html = '<div class="pipe-wrap"><table class="pipe-table" id="pipeTable"><thead>' +
    (pipeCompareMode ? '<th style="width:30px">เทียบ</th><th>แนวโน้มชนงาน</th>' : '') +
    '<th style="width:32px">#</th>' +
    '<th>Register</th>' +
    '<th>Project</th>' +
    '<th>End User</th>' +
    '<th>Dealer</th>' +
    '<th>Model</th>' +
    '<th style="text-align:right">Forecast</th>' +
    '<th>TOR</th>' +
    '<th>Bidding</th>' +
    '<th>Status</th>' +
    '<th>Next Action</th>' +
    '<th>Age</th>' +
    '<th>Update</th>' +
    '<th></th>' +
    '</thead><tbody>';
  
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    var d = ST.getOne('dealers', p.dealerId);
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    var amt = Number(p.forecastAmount) || 0;
    var isWon = (p.status === 'win' || p.status === 'ordered' || p.status === 'delivered');
    var isLost = (p.status === 'lost');
    
    var regDate = p.registerDate || (p.created ? p.created.split('T')[0] : '');
    var ageDays = regDate ? daysBetween(regDate, _td()) : 0;
    var ageClass = ageDays > 180 ? 'very-old' : (ageDays > 90 ? 'old' : '');
    
    var modelText = getPipeModelSummary(p);
    
    var nextHtml = '';
    if (p.nextAction) {
      var naClass = '';
      if (p.followupDate) {
        var fd = dTo(p.followupDate);
        if (fd < 0) naClass = 'overdue';
        else if (fd <= 3) naClass = 'soon';
      }
      nextHtml = '<div class="next-action ' + naClass + '">' + sanitize((p.nextAction || '').substr(0, 20)) +
        (p.followupDate ? ' ' + fDShort(p.followupDate) : '') + '</div>';
    }

    var cRow = _conflictMap[p.id];
    var cRowTag = '';
    if (cRow && cRow.length === 1) {
      var rLabel = sanitize((cRow[0].dealerName || '').split(' ')[0]);
      if (cRow[0].ownerName) rLabel += ' (' + sanitize(cRow[0].ownerName) + ')';
      var cRowAction = cRow[0].isTeam ? 'showConflictListM(\'' + p.id + '\')' : 'compareConflict(\'' + p.id + '\',\'' + cRow[0].otherId + '\')';
      cRowTag = '<div style="font-size:10px;background:#ef444418;color:#ef4444;border:1px solid #ef444430;padding:1px 5px;border-radius:4px;margin-top:3px;cursor:pointer;display:inline-block" onclick="event.stopPropagation();' + cRowAction + '">⚠️ ' + rLabel + '</div>';
    } else if (cRow && cRow.length > 1) {
      cRowTag = '<div style="font-size:10px;background:#ef444418;color:#ef4444;border:1px solid #ef444430;padding:1px 5px;border-radius:4px;margin-top:3px;cursor:pointer;display:inline-block" onclick="event.stopPropagation();showConflictListM(\'' + p.id + '\')">⚠️ ชน ' + cRow.length + ' เจ้า</div>';
    }

    var bidUrgency = pipeBidUrgency(p);
    var rowClass = (isWon ? 'pipe-win' : '') + (isLost ? 'pipe-lost' : '') +
      (p.pinned ? ' pipe-pinned' : '') +
      (bidUrgency === 'urgent' ? ' pipe-bid-urgent' : (bidUrgency === 'soon' ? ' pipe-bid-soon' : ''));

    var compareCells = '';
    if (pipeCompareMode) {
      var isSel = pipeCompareSelected.indexOf(p.id) !== -1;
      var best = pipeCompareBestMatch(p);
      var matchBadge = '<span style="color:var(--text3);font-size:10px">— ไม่พบโครงการใกล้เคียง</span>';
      if (best) {
        var bColor = best.score >= 60 ? '#ef4444' : (best.score >= 40 ? '#f59e0b' : '#64748b');
        var bBg = best.score >= 60 ? 'rgba(239,68,68,.18)' : (best.score >= 40 ? 'rgba(245,158,11,.18)' : 'rgba(100,116,139,.2)');
        var bDealer = ST.getOne('dealers', best.other.dealerId);
        matchBadge = '<span style="background:' + bBg + ';color:' + bColor + ';font-size:10px;padding:2px 6px;border-radius:6px;font-weight:700;cursor:pointer" title="กดเพื่อเลือกคู่นี้เข้าเทียบ" onclick="event.stopPropagation();pipeCompareQuickPick(\'' + p.id + '\',\'' + best.other.id + '\')">' + best.score + '% กับ ' + sanitize((bDealer ? bDealer.name : '?').substr(0, 16)) + '</span>';
      }
      compareCells = '<td onclick="event.stopPropagation();togglePipeCompareSelect(\'' + p.id + '\')"><input type="checkbox" ' + (isSel ? 'checked' : '') + ' onclick="event.stopPropagation();togglePipeCompareSelect(\'' + p.id + '\')"></td>' +
        '<td onclick="event.stopPropagation()">' + matchBadge + '</td>';
    }

    html += '<tr class="' + rowClass + '"' +
      ' onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer">' +
      compareCells +
      '<td class="pipe-row-num">' + (i + 1) + '</td>' +
      '<td style="white-space:nowrap">' + fDShort(p.registerDate) + '</td>' +
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="' + sanitize(p.projectName) + '">' + sanitize((p.projectName || '').substr(0, 45)) + '</td>' +
      '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis">' + sanitize((p.endUserTH || '').substr(0, 25)) + '</td>' +
      '<td style="white-space:nowrap">' + (d ? d.name : '-') + '</td>' +
      '<td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;font-size:.7rem">' + sanitize(modelText) + '</td>' +
      '<td style="text-align:right;white-space:nowrap">' + fmtMoneyStyled(amt) + '</td>' +
      '<td style="white-space:nowrap">' + (p.tor || '-') + '</td>' +
      '<td style="white-space:nowrap">' + (p.biddingDate ? fDShort(p.biddingDate) : '-') + ' ' + (p.biddingDate ? dlB(p.biddingDate, isWon || isLost) : '') + '</td>' +
      '<td>' + pipeTag(p.status) + cRowTag + (function() { var f = pipeFYStatus(p); return f ? '<div style="font-size:10px;color:' + f.c + ';margin-top:3px;white-space:nowrap">' + f.e + ' ' + f.t + '</div>' : ''; })() + '</td>' +
      '<td style="max-width:140px">' + nextHtml + '</td>' +
      '<td style="white-space:nowrap"><span class="pipe-age ' + ageClass + '">' + ageDays + 'd</span></td>' +
      '<td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;font-size:.62rem">' +
        (lastLog ? fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 25)) : '-') +
      '</td>' +
      '<td onclick="event.stopPropagation()">' +
        '<button class="pipe-pin-btn' + (p.pinned ? ' on' : '') + '" title="ปักหมุด" onclick="togglePipePin(\'' + p.id + '\')">📌</button>' +
        '<button class="quick-update-btn" onclick="showPipeUpdateM(\'' + p.id + '\')">📝</button>' +
      '</td>' +
      '</tr>';
  }
  
  html += '</tbody></table></div>';
  return html;
}

function copyPipeTable() { copyTable('pipeTable', '📋 Copy Pipeline Table'); }

// คอลัมน์มาตรฐานของตาราง Pipeline แบบเต็ม — ใช้ร่วมกันทั้ง CSV export และมุมมอง Sheet บนจอ
var PIPE_SHEET_HEADERS = ['Register Date','Project Name','End User Name','End User Name Eng','Unit type','Dealer Name','DJI Dealer','Project revenue','Model','M3M Qty.','M4T Qty.','M4E Qty.','Dock 3 Qty.','M4TD Qty.','M400 Qty.','Forecast Amount','Real Amount','TOR','Bidding Date','Forecast Month','Shipment date','Remark','Letter of Authorized หนังสือแต่งตั้ง','Status','Duplicate งานซ้ำ','Update 1','Update 2','Update 3','Update 4','Update 5','Update 6','Sale','DISPLAY (Hide/Show)'];

// ดึงค่าดิบของแต่ละ pipeline ตามลำดับ PIPE_SHEET_HEADERS (ยังไม่ escape) ให้ CSV/HTML เอาไป escape ตามบริบทของตัวเอง
function _pipeRowFields(p) {
  var d = ST.getOne('dealers', p.dealerId);
  var logs = ST.pipeLogsByPipe(p.id).reverse();
  var items = (p.items && p.items.length) ? p.items : (p.model ? [{ model: p.model, qty: p.modelQty || 1 }] : []);
  var modelCell = items.map(function(it) { return (it.model || '') + '*' + (Number(it.qty) || 1); }).join('\n');
  var g = _pipeModelQtyByGroup(items);
  var fields = [
    fD(p.registerDate), p.projectName || '', p.endUserTH || '', p.endUserEN || '', p.unitType || '', d ? d.name : '', p.djiDealer || '', p.projectRevenue || '', modelCell,
    g.m3m || '', g.m4t || '', g.m4e || '', g.dock3 || '', g.m4td || '', g.m400 || '',
    p.forecastAmount || '', p.realAmount || '', p.tor || '', fD(p.biddingDate), _fmtForecastMonth(p.biddingDate), fD(p.shipmentDate), p.remark || '', p.appointmentLetter || '', getPipeName(p.status), p.recurring ? 'Yes' : ''
  ];
  for (var li = 0; li < 6; li++) fields.push(logs[li] ? (fDShort(logs[li].date ? logs[li].date.split('T')[0] : '') + ' ' + logs[li].content) : '');
  fields.push(p.saleName || '', p.sheetDisplay || 'Show');
  return fields;
}

function dlPipeCSV() { _exportPipeCSV(ST.getAll('pipeline'), 'pipeline-' + _td() + '.csv'); }

function dlPipeCSVForDealer(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  var safeName = (d ? d.name : 'dealer').replace(/[^a-zA-Z0-9ก-๙_\-]/g, '_');
  _exportPipeCSV(ST.pipelineByDealer(dealerId), 'pipeline-' + safeName + '-' + _td() + '.csv');
}

function _exportPipeCSV(pipes, filename) {
  pipes = pipes.slice().sort(function(a, b) { return (a.registerDate || '').localeCompare(b.registerDate || ''); });
  var csv = '﻿"' + PIPE_SHEET_HEADERS.join('","') + '"\n';
  pipes.forEach(function(p) {
    var f = _pipeRowFields(p);
    csv += f.map(function(v, idx) {
      // Model cell (idx 8) เก็บ \n ไว้สำหรับสินค้าหลายบรรทัด ส่วนฟิลด์อื่น strip \n ตามมาตรฐาน CSV
      return '"' + (idx === 8 ? _csvKeepNL(v) : esc(v)) + '"';
    }).join(',') + '\n';
  });
  dlBlob(csv, filename);
}

// มุมมอง Sheet — ตารางเต็มคอลัมน์ตรงกับ CSV export ใช้ทั้งหน้า Pipeline หลักและ Pipeline tab ของ Dealer
function renderPipeSheetTable(pipes) {
  var h = '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px"><table style="border-collapse:collapse;font-size:11px;white-space:nowrap;width:100%">';
  h += '<thead><tr>' + PIPE_SHEET_HEADERS.map(function(hd) { return '<th style="padding:6px 8px;text-align:left;border-bottom:2px solid var(--border);background:var(--card);position:sticky;top:0">' + sanitize(hd) + '</th>'; }).join('') + '</tr></thead><tbody>';
  pipes.forEach(function(p) {
    var f = _pipeRowFields(p);
    h += '<tr style="cursor:pointer;border-bottom:1px solid var(--border)" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" onmouseover="this.style.background=\'rgba(59,130,246,.06)\'" onmouseout="this.style.background=\'\'">';
    h += f.map(function(v) { return '<td style="padding:5px 8px;max-width:220px;overflow:hidden;text-overflow:ellipsis">' + sanitize(String(v == null ? '' : v).replace(/\n/g, ' / ')) + '</td>'; }).join('');
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

// เก็บ \n ไว้ (สำหรับเซลล์ Model หลายบรรทัด) แค่ escape "
function _csvKeepNL(s) { return String(s || '').replace(/"/g, '""').replace(/\r/g, ''); }

// แตก qty ตามกลุ่มสินค้าหลัก (M3M/M4T/M4E/M4TD/M400/Dock 3) — เช็คเฉพาะเจาะจงก่อนกว้าง กัน M4TD หลุดไป M4T
// สินค้าที่ไม่ใช่ main drone product (battery, RC, accessory ฯลฯ) ไม่นับ
// M3M = Mavic 3 Multispectral Universal Edition — เช็คทั้งคำย่อ "M3M" และชื่อเต็ม "MULTISPECTRAL" เพราะข้อมูลจริงมีทั้ง 2 แบบ
function _pipeModelQtyByGroup(items) {
  var g = { m3m: 0, m4td: 0, m4t: 0, m4e: 0, m400: 0, dock3: 0 };
  (items || []).forEach(function(it) {
    var name = (it.model || '').toUpperCase();
    var qty = Number(it.qty) || 0;
    if (name.indexOf('M3M') !== -1 || name.indexOf('MULTISPECTRAL') !== -1) g.m3m += qty;
    else if (name.indexOf('M4TD') !== -1) g.m4td += qty;
    else if (name.indexOf('M4T') !== -1) g.m4t += qty;
    else if (name.indexOf('M4E') !== -1) g.m4e += qty;
    else if (name.indexOf('M400') !== -1) g.m400 += qty;
    else if (name.indexOf('DOCK 3') !== -1) g.dock3 += qty;
  });
  return g;
}

// Forecast Month = Bidding Date + 2 เดือน, format "2026 Jun"
function _fmtForecastMonth(biddingDate) {
  if (!biddingDate) return '';
  var d = new Date(biddingDate);
  if (isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + 2);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getFullYear() + ' ' + months[d.getMonth()];
}

async function aiAnalyzePipeline(btn) {
  var allPipes = ST.getAll('pipeline');
  if (!allPipes.length) { toast('ยังไม่มีข้อมูล Pipeline'); return; }

  var restore = _aiBtnBusy(btn, '⏳ กำลังวิเคราะห์...');

  var statusCount = {}, statusAmt = {};
  var totalAmt = 0, biddingSoon = [];
  allPipes.forEach(function(p) {
    var s = p.status || 'unknown';
    var amt = Number(p.forecastAmount) || 0;
    statusCount[s] = (statusCount[s] || 0) + 1;
    statusAmt[s] = (statusAmt[s] || 0) + amt;
    totalAmt += amt;
    if (p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 30)
      biddingSoon.push(p.projectName || 'ไม่ระบุชื่อ');
  });

  var statusLines = Object.keys(statusCount).map(function(s) {
    return s + ': ' + statusCount[s] + ' รายการ มูลค่า ' + fmtMoneyShort(statusAmt[s] || 0);
  }).join('\n');

  var prompt = 'คุณเป็นที่ปรึกษาฝ่ายขาย B2B ช่วยวิเคราะห์สถานะ Pipeline ต่อไปนี้และให้คำแนะนำเป็นภาษาไทย:\n\n' +
    'จำนวนโครงการทั้งหมด: ' + allPipes.length + ' รายการ\n' +
    'มูลค่ารวม: ' + fmtMoneyShort(totalAmt) + '\n\n' +
    'แบ่งตาม Status:\n' + statusLines + '\n\n' +
    (biddingSoon.length ? 'โครงการที่ต้อง Bid ภายใน 30 วัน: ' + biddingSoon.join(', ') + '\n\n' : '') +
    'กรุณาสรุป: 1) จุดแข็ง 2) ความเสี่ยง 3) สิ่งที่ควรทำต่อไป (Next Action) โดยกระชับและเป็นประโยชน์';

  var result = await askGemini(prompt);
  restore();
  if (!result) return;

  openM('🤖 AI วิเคราะห์ Pipeline',
    '<div style="white-space:pre-wrap;font-size:.88rem;line-height:1.7;color:var(--text)">' + sanitize(result) + '</div>'
  );
}

// ================================================================
// PIPELINE DETAIL
// ================================================================
function rPipeDet(el) {
  var p = ST.getOne('pipeline', S.pipeId);
  if (!p) return go('pipeline');
  var d = ST.getOne('dealers', p.dealerId);
  var logs = ST.pipeLogsByPipe(p.id);
  var isPinned = ST.hasPin(p.id);
  var isWon = ['win','ordered','delivered'].indexOf(p.status) !== -1;
  var isLost = p.status === 'lost';
  var amt = Number(p.forecastAmount) || 0;
  
  document.getElementById('pgT').textContent = '📊 ' + (p.projectName || '').substr(0, 25);

  var html = '<div class="bc"><a onclick="go(\'pipeline\')">📊 Pipeline</a><span class="sep">›</span>';
  if (d) html += '<a onclick="go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})">' + sanitize(d.name) + '</a><span class="sep">›</span>';
  html += '<span class="cur">' + sanitize((p.projectName || '').substr(0, 35)) + '</span></div>';

  html += '<div class="card"><h2>📊 ข้อมูลโครงการ <span class="ml">';
  html += '<button class="btn bsm bs" onclick="startTimer(\'pipeline\',\'' + p.id + '\',\'' + sanitize((p.projectName || '').substr(0, 18)) + '\')">⏱️</button>';
  html += '<button class="btn bsm ' + (isPinned ? 'bw' : 'bo') + '" onclick="ST.togglePin(\'pipeline\',\'' + p.id + '\',\'' + sanitize((p.projectName || '').substr(0, 20)) + '\',\'' + (d ? d.name : '') + '\');render()">📌</button>';
  html += '<button class="btn bsm bo" onclick="copyPipeRow(\'' + p.id + '\')">📋 Row</button>';
  html += '<button class="btn bsm bp" onclick="showPipelineM(\'' + (p.dealerId || '') + '\',\'' + p.id + '\')">✏️ แก้ไข</button>';
  html += '<button class="btn bsm bd" onclick="delPipe(\'' + p.id + '\')">🗑️</button>';
  html += '</span></h2>';
  
  html += '<div class="fr"><div><label>Project Name</label><div>' + (p.projectName ? qcopyHtml(p.projectName) : '-') + '</div></div>';
  html += '<div><label>Status</label><div>' + pipeTag(p.status) + '</div></div></div>';
  
  html += '<div class="fr"><div><label>End User (TH)</label><div>' + sanitize(p.endUserTH || '-') + '</div></div>';
  html += '<div><label>End User (EN)</label><div>' + sanitize(p.endUserEN || '-') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Unit Type</label><div>' + (p.unitType || '-') + '</div></div>';
  html += '<div><label>Dealer</label><div>' + (d ? d.name : '-') + ' ' + (d ? levelTag(d.level) : '') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>DJI Dealer</label><div>' + (p.djiDealer || '-') + '</div></div>';
  html += '<div><label>Model</label><div>' + getPipeModelSummary(p) + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Forecast Amount</label><div>' + fmtMoneyStyled(p.forecastAmount) + '</div></div>';
  html += '<div><label>Real Amount</label><div>' + (p.realAmount ? fmtMoney(p.realAmount) + ' ฿' : '-') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Register Date</label><div>' + fD(p.registerDate) + '</div></div>';
  html += '<div><label>TOR</label><div>' + (p.tor || '-') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>Bidding Date</label><div>' + fD(p.biddingDate) + ' ' + dlB(p.biddingDate, isWon || isLost) + '</div></div>';
  html += '<div><label>Shipment Date</label><div>' + fD(p.shipmentDate) + '</div></div></div>';
  
  html += '<div class="fr"><div><label>หนังสือแต่งตั้ง</label><div>' + (p.appointmentLetter || '-') + '</div></div>';
  html += '<div><label>งานซ้ำ</label><div>' + (p.recurring ? '✅ ใช่' : 'ไม่ใช่') + '</div></div></div>';

  var _fyS = pipeFYStatus(p);
  html += '<div class="fr"><div><label>🏛️ ปีงบประมาณ</label><div>' + (p.budgetFiscalYear ? 'ปีงบ ' + p.budgetFiscalYear : '— ไม่ระบุ') + (_fyS ? ' <span style="background:' + _fyS.c + '22;color:' + _fyS.c + ';padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">' + _fyS.e + ' ' + _fyS.t + '</span>' : '') + '</div></div>';
  html += '<div><label></label><div></div></div></div>';
  html += '<div class="fr"><div><label>🗂️ ลงทะเบียน CRM ของ DJI</label><div>' + (p.djiCrmRegistered ? '✅ ลงแล้ว' + (p.djiCrmDate ? ' (' + fD(p.djiCrmDate) + ')' : '') : '⬜ ยังไม่ลง') + '</div></div>';
  html += '<div><label>⚔️ คู่แข่ง</label><div>' + (p.hasCompetitor ? '⚠️ คาดว่ามี' + (p.competitorName ? ' — <span style="color:#f59e0b">' + sanitize(p.competitorName) + '</span> <span style="font-size:10px;color:#475569">🔒 ภายใน</span>' : '') : '— ไม่ระบุ') + '</div></div></div>';
  
  html += '<div class="fr"><div><label>🎯 Next Action</label><div>' + (p.nextAction ? '<span class="next-action">' + sanitize(p.nextAction) + '</span>' : '<span style="color:#475569">ไม่ได้ตั้ง</span>') + '</div></div>';
  html += '<div><label>📅 Follow-up Date</label><div>' + (p.followupDate ? fD(p.followupDate) + ' ' + dlB(p.followupDate, isWon || isLost) : '-') + '</div></div></div>';
  
  if (p.remark) html += '<div><label>Remark</label><div>' + sanitize(p.remark) + '</div></div>';
  if (p.attachments && p.attachments.length) html += '<div><label>📷 รูปแนบ</label>' + attachGalleryHtml(p.attachments) + '</div>';

  if (isWon && p.winReason) html += '<div style="margin-top:8px;padding:8px;background:#14532d;border-radius:6px"><div>✅ Win Reason:</div><div>' + sanitize(p.winReason) + (p.winNote ? ' — ' + sanitize(p.winNote) : '') + '</div></div>';
  if (isLost && p.lossReason) html += '<div style="margin-top:8px;padding:8px;background:#7f1d1d;border-radius:6px"><div>❌ Loss Reason:</div><div>' + sanitize(p.lossReason) + (p.lossCompetitor ? ' — ชนะโดย: ' + sanitize(p.lossCompetitor) : '') + (p.lossNote ? ' — ' + sanitize(p.lossNote) : '') + '</div></div>';
  
  html += '</div>';

  // Action Items
  html += buildPipeActionsHTML(p.id);

  // Quick Status Change
  html += '<div class="card"><h2>🔄 เปลี่ยนสถานะ</h2><div class="bg" style="flex-wrap:wrap">';
  var statuses = getConfig().pipelineStatuses;
  for (var si = 0; si < statuses.length; si++) {
    var st = statuses[si];
    html += '<button class="btn bsm ' + (p.status === st.id ? 'bp' : 'bo') + '" style="' + (p.status === st.id ? '' : 'border-color:' + st.color + ';color:' + st.color) + '" onclick="changePipeStatus(\'' + p.id + '\',\'' + st.id + '\')">' + st.name + '</button>';
  }
  html += '</div></div>';

  // Updates Timeline
  html += '<div class="card"><h2>📝 Updates (' + logs.length + ') <span class="ml"><button class="btn bsm bp" onclick="showPipeUpdateM(\'' + p.id + '\')">➕ Update</button></span></h2>';
  if (logs.length) {
    html += '<div class="tl">';
    for (var li = 0; li < logs.length; li++) {
      var l = logs[li];
      var isEditable = l.type !== 'win' && l.type !== 'lost';
      
      html += '<div class="ti tl-' + (l.type || 'note') + '">';
      html += '<div style="display:flex;justify-content:space-between">';
      html += '<div class="td2">' + fDT(l.date) + '</div>';
      html += '<div style="display:flex;gap:4px">';
      if (isEditable) {
        html += '<button class="btn bsm bo" onclick="event.stopPropagation();editPipelineLog(\'' + l.id + '\', \'' + p.id + '\', \'' + sanitize(l.content || '').replace(/'/g, "\\'") + '\', \'' + (l.type || 'update') + '\', \'' + (l.date || '') + '\')" style="padding:1px 6px" title="แก้ไข">✏️</button>';
        html += '<button class="btn bsm bd" onclick="event.stopPropagation();deletePipelineLog(\'' + l.id + '\', \'' + p.id + '\')" style="padding:1px 4px" title="ลบ">🗑️</button>';
      } else {
        html += '<span style="font-size:10px;color:var(--text2);padding:2px 6px">🔒</span>';
      }
      html += '</div>';
      html += '</div>';
      html += '<div class="tt2">' + logL(l.type) + '</div>';
      html += '<div class="tc2">' + sanitize(l.content) + '</div>';
      if (l.visitId) html += '<div class="ti-link" onclick="go(\'visitDetail\',{visitId:\'' + l.visitId + '\'})">ดู Visit Report →</div>';
      html += '</div>';
    }
    html += '</div>';
  } else {
    html += '<div class="empty"><p>ยังไม่มี Update — กด ➕ เพื่อบันทึก</p></div>';
  }
  html += '</div>';
  
  // Inline Comment
  html += '<div class="card"><div class="inline-comment"><textarea id="quickPipeComment" rows="2" placeholder="พิมพ์ comment ด่วน... (เช่น โทรติดตามแล้ว, ได้รับเอกสารแล้ว)"></textarea>';
  html += '<div class="inline-comment-actions" style="display:flex;gap:6px;margin-top:6px">';
  html += '<button class="btn bsm bp" onclick="addQuickPipeComment(\'' + p.id + '\')">💬 เพิ่ม Comment</button>';
  html += '<button class="btn bsm bs" onclick="addQuickPipeFollowup(\'' + p.id + '\')">📞 + นัดติดตาม</button>';
  html += '</div></div></div>';

  el.innerHTML = html;
}

function changePipeStatus(pipeId, newStatus) {
  var old = ST.getOne('pipeline', pipeId);
  if (!old || old.status === newStatus) return;
  
  if (newStatus === 'win' || newStatus === 'ordered') {
    showWinReasonM(pipeId, newStatus); return;
  }
  if (newStatus === 'lost' && old.status !== 'lost') {
    showLossReasonM(pipeId); return;
  }
  
  ST.update('pipeline', pipeId, {status: newStatus});
  ST.add('pipeLog', {pipeId: pipeId, type: 'status_change', content: 'สถานะ: ' + getPipeName(old.status) + ' → ' + getPipeName(newStatus), date: _nw()});
  toast('📊 ' + getPipeName(newStatus));
  render();
}

function delPipe(id) {
  if (!confirm('ลบ Pipeline นี้?')) return;
  ST.delete('pipeline', id);
  ST.deleteWhere('pipeLog', function(l) { return l.pipeId === id; });
  go('pipeline');
  toast('🗑️ ลบแล้ว');
}

function copyPipeRow(pipeId) {
  var p = ST.getOne('pipeline', pipeId); if (!p) return;
  var d = ST.getOne('dealers', p.dealerId);
  var logs = ST.pipeLogsByPipe(p.id).reverse();
  var tsv = fD(p.registerDate) + '\t' + (p.projectName || '') + '\t' + (p.endUserTH || '') + '\t' + (p.endUserEN || '') + '\t' + (p.unitType || '') + '\t' + (d ? d.name : '') + '\t' + (p.djiDealer || '') + '\t' + (p.model || '') + (p.modelQty > 1 ? '*' + p.modelQty : '') + '\t' + (p.forecastAmount || '') + '\t' + (p.realAmount || '') + '\t' + (p.tor || '') + '\t' + fD(p.biddingDate) + '\t' + fD(p.shipmentDate) + '\t' + (p.remark || '') + '\t' + (p.appointmentLetter || '') + '\t' + getPipeName(p.status) + '\t' + (p.recurring ? 'Yes' : '');
  for (var i = 0; i < logs.length; i++) {
    tsv += '\t' + fDShort(logs[i].date ? logs[i].date.split('T')[0] : '') + ' ' + (logs[i].content || '');
  }
  copyText(tsv, '📋 Copy Pipeline Row');
}

// ================================================================
// PIPELINE BOARD
// ================================================================
function rPipeBoard(el) {
  document.getElementById('pgT').textContent = '📋 Pipeline Board';
  var cfg = getConfig();
  var allPipes = ST.getAll('pipeline');
  var dealers = ST.getAll('dealers');
  
  var pipes = allPipes;
  if (pipeBoardDealer !== 'all') {
    pipes = pipes.filter(function(p) { return p.dealerId === pipeBoardDealer; });
  }
  if (pipeBoardFY !== 'all') {
    pipes = pipes.filter(function(p) { var fy = p.budgetFiscalYear || thaiFYFromISO(p.expectedCloseDate || p.biddingDate); return String(fy || '') === String(pipeBoardFY); });
  }

  var dealerIds = {};
  allPipes.forEach(function(p) { if (p.dealerId) dealerIds[p.dealerId] = true; });
  var pipelineDealers = dealers.filter(function(d) { return dealerIds[d.id]; });
  
  var totalFiltered = 0;
  var activeFiltered = 0;
  pipes.forEach(function(p) {
    var amt = Number(p.forecastAmount) || 0;
    totalFiltered += amt;
    if (['lost','delivered'].indexOf(p.status) === -1) activeFiltered += amt;
  });

  var activeStatuses = ['prospect','tor_review','quotation','bidding','negotiation'];
  var closedStatuses = ['win','ordered','delivered','on_hold','lost','recurring'];
  
  var visibleStatuses = cfg.pipelineStatuses.filter(function(st) {
    if (pipeBoardMode === 'active' && closedStatuses.indexOf(st.id) !== -1) return false;
    var items = pipes.filter(function(p) { return p.status === st.id; });
    if (items.length === 0 && pipeBoardMode !== 'all') return false;
    return true;
  });

  var h = '';
  
  h += '<div class="pb2-toolbar">';
  h += '<button class="btn bp" onclick="showPipelineM()">➕ เพิ่ม</button>';
  h += '<div class="pb2-mode"><button class="btn bsm ' + (pipeBoardMode === 'active' ? 'bp' : 'bo') + '" onclick="pipeBoardMode=\'active\';render()">⚡ Active</button>';
  h += '<button class="btn bsm ' + (pipeBoardMode === 'all' ? 'bp' : 'bo') + '" onclick="pipeBoardMode=\'all\';render()">📊 ทั้งหมด</button></div>';
  h += '<select id="pipeBoardDlr" onchange="pipeBoardDealer=this.value;render()" class="pb2-dealer-sel">';
  h += '<option value="all"' + (pipeBoardDealer === 'all' ? ' selected' : '') + '>🏪 ทุก Dealer (' + allPipes.length + ')</option>';
  pipelineDealers.forEach(function(d) {
    var cnt = allPipes.filter(function(p) { return p.dealerId === d.id; }).length;
    h += '<option value="' + d.id + '"' + (pipeBoardDealer === d.id ? ' selected' : '') + '>' + d.name + ' (' + cnt + ')</option>';
  });
  h += '</select>';
  h += '<select id="pipeBoardFYSel" onchange="pipeBoardFY=this.value;render()" class="pb2-dealer-sel" style="margin-left:6px">';
  h += '<option value="all"' + (pipeBoardFY === 'all' ? ' selected' : '') + '>🏛️ ทุกปีงบ</option>';
  (function() { var cur = currentThaiFY(); for (var fy = cur + 2; fy >= cur - 2; fy--) h += '<option value="' + fy + '"' + (String(pipeBoardFY) === String(fy) ? ' selected' : '') + '>ปีงบ ' + fy + (fy === cur ? ' (ปีนี้)' : '') + '</option>'; })();
  h += '</select></div>';

  h += '<div class="pb2-stats">📊 ' + pipes.length + ' โครงการ • Active: ' + fmtMoneyStyled(activeFiltered) + ' • Total: ' + fmtMoneyStyled(totalFiltered) + '</div>';

  // ===== แถบ "ต้องโฟกัส" =====
  var focus = [], seen = {};
  pipes.forEach(function(p) {
    if (['lost','delivered','on_hold'].indexOf(p.status) !== -1) return;
    var fu = p.followupDate ? dTo(p.followupDate) : null;
    var bd = p.biddingDate ? dTo(p.biddingDate) : null;
    var fy = pipeFYStatus(p);
    var reason = null, color = null;
    if (fu !== null && fu < 0) { reason = '📞 ติดตามเลยกำหนด ' + Math.abs(fu) + 'd'; color = '#ef4444'; }
    else if (bd !== null && bd >= 0 && bd <= 7) { reason = '🔴 Bidding ' + bd + 'd'; color = '#ef4444'; }
    else if (fy && fy.t.indexOf('เสี่ยง') === 0) { reason = '🏛️ เสี่ยงตกปีงบหน้า'; color = '#ef4444'; }
    else if (bd !== null && bd >= 0 && bd <= 30) { reason = '🟡 Bidding ' + bd + 'd'; color = '#f59e0b'; }
    if (reason && !seen[p.id]) { seen[p.id] = 1; focus.push({ p: p, reason: reason, color: color }); }
  });
  focus.sort(function(a, b) { return (a.color === '#ef4444' ? 0 : 1) - (b.color === '#ef4444' ? 0 : 1); });
  if (focus.length) {
    h += '<div class="pb2-focus"><div class="pb2-focus-hd">🎯 ต้องโฟกัส <span class="pb2-focus-cnt">' + focus.length + '</span></div><div class="pb2-focus-row">';
    focus.slice(0, 20).forEach(function(f) {
      var fd = ST.getOne('dealers', f.p.dealerId);
      h += '<div class="pb2-focus-card" style="border-left-color:' + f.color + '" onclick="go(\'pipeDetail\',{pipeId:\'' + f.p.id + '\'})">';
      h += '<div class="pb2-focus-reason" style="color:' + f.color + '">' + f.reason + '</div>';
      h += '<div class="pb2-focus-name">' + sanitize((f.p.projectName || '').substr(0, 34)) + '</div>';
      h += '<div class="pb2-focus-dealer">' + (fd ? sanitize(fd.name) : '-') + ' • ' + fmtMoneyShort(Number(f.p.forecastAmount) || 0) + '</div>';
      h += '</div>';
    });
    h += '</div></div>';
  }

  h += '<div class="pb2-scroll-wrap">';
  h += '<button class="pb2-scroll-btn pb2-scroll-left" onclick="scrollBoard(-1)">◀</button>';
  h += '<div class="pb2-board" id="pb2Board">';
  
  visibleStatuses.forEach(function(st) {
    var items = pipes.filter(function(p) { return p.status === st.id; });
    var amt = 0;
    items.forEach(function(p) { amt += (Number(p.forecastAmount) || 0); });
    
    items.sort(function(a, b) {
      var ba = a.biddingDate || '9999';
      var bb = b.biddingDate || '9999';
      if (ba !== bb) return ba.localeCompare(bb);
      return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0);
    });
    
    var isCollapsed = pipeBoardCollapsed[st.id] === true;
    
    if (isCollapsed) {
      h += '<div class="pb2-col pb2-col-collapsed" onclick="toggleBoardCol(\'' + st.id + '\')">';
      h += '<div class="pb2-col-collapsed-inner" style="border-color:' + st.color + '">';
      h += '<div class="pb2-col-collapsed-name">' + st.name + '</div>';
      h += '<div class="pb2-col-collapsed-count">' + items.length + '</div>';
      h += '<div class="pb2-col-collapsed-amt">' + fmtMoneyShort(amt) + '</div></div></div>';
    } else {
      h += '<div class="pb2-col" data-pipecol="' + st.id + '">';
      h += '<div class="pb2-hd" style="border-bottom-color:' + st.color + '">';
      h += '<div class="pb2-hd-left"><span class="pb2-hd-dot" style="background:' + st.color + '"></span>';
      h += '<span class="pb2-hd-name">' + st.name + '</span>';
      h += '<span class="pb2-hd-cnt">' + items.length + '</span></div>';
      h += '<button class="pb2-hd-collapse" onclick="event.stopPropagation();toggleBoardCol(\'' + st.id + '\')">◀</button></div>';
      h += '<div class="pb2-body">';
      if (items.length === 0) {
        h += '<div class="pb2-empty">ว่าง</div>';
      } else {
        items.forEach(function(p, idx) {
          h += pipeBoardCardV2(p, st, idx);
        });
      }
      h += '</div>';
      h += '<div class="pb2-foot"><span>' + items.length + ' โครงการ</span><span>' + fmtMoneyStyled(amt) + '</span></div></div>';
    }
  });
  
  h += '</div>';
  h += '<button class="pb2-scroll-btn pb2-scroll-right" onclick="scrollBoard(1)">▶</button>';
  h += '</div>';
  h += '<div class="pb2-legend">💡 ลากการ์ดย้าย Status (คอม) • กดปุ่ม ⇄ บนการ์ดเพื่อย้าย (มือถือ) • กดหัวคอลัมน์เพื่อพับ</div>';

  el.innerHTML = h;
  initBoardScroll();
  initBoardDnD();
}

function pipeBoardCardV2(p, st, idx) {
  var d = ST.getOne('dealers', p.dealerId);
  var lastLog = ST.pipeLogsByPipe(p.id)[0];
  var amt = Number(p.forecastAmount) || 0;
  
  var bidHTML = '';
  if (p.biddingDate) {
    var bd = dTo(p.biddingDate);
    if (bd < 0) bidHTML = '<div class="pb2-bid bid-past">Bid: ' + fDShort(p.biddingDate) + ' (เลย)</div>';
    else if (bd <= 7) bidHTML = '<div class="pb2-bid bid-urgent">🔴 Bid ' + fDShort(p.biddingDate) + ' (' + bd + 'd)</div>';
    else if (bd <= 30) bidHTML = '<div class="pb2-bid bid-soon">🟡 Bid ' + fDShort(p.biddingDate) + ' (' + bd + 'd)</div>';
  }

  // ค้างนาน (จาก activity ล่าสุด)
  var lastDate = (lastLog && lastLog.date) ? lastLog.date.split('T')[0] : (p.registerDate || '');
  var staleHTML = '';
  if (lastDate) {
    var dsl = daysBetween(lastDate, _td());
    if (dsl >= 30) staleHTML = '<div class="pb2-chip" style="color:#ef4444">⏰ ค้าง ' + dsl + 'd</div>';
    else if (dsl >= 14) staleHTML = '<div class="pb2-chip" style="color:#f59e0b">⏰ ค้าง ' + dsl + 'd</div>';
  }
  // badge ปีงบ
  var fySt = pipeFYStatus(p);
  var fyHTML = fySt ? '<div class="pb2-chip" style="color:' + fySt.c + '">' + fySt.e + ' ' + fySt.t + '</div>' : '';

  var h = '<div class="pb2-card" draggable="true" data-pipeid="' + p.id + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
  h += '<div class="pb2-card-head"><span class="pb2-card-num">#' + (idx + 1) + '</span><span class="pb2-card-title">' + sanitize((p.projectName || '').substr(0, 32)) + '</span>';
  h += '<button class="pb2-move-btn" draggable="false" title="ย้ายสถานะ" onclick="event.stopPropagation();showMoveStatusM(\'' + p.id + '\')">⇄</button></div>';
  h += '<div class="pb2-card-dealer">' + (d ? d.name : '-') + '</div>';
  if (p.model) h += '<div class="pb2-card-model">📦 ' + sanitize((p.model || '').substr(0, 20)) + (p.modelQty > 1 ? ' x' + p.modelQty : '') + '</div>';
  h += '<div class="pb2-card-amt">' + fmtMoneyStyled(amt) + '</div>';
  h += bidHTML;
  if (fyHTML || staleHTML) h += '<div class="pb2-chips">' + fyHTML + staleHTML + '</div>';
  if (p.nextAction) {
    var naClass = '';
    if (p.followupDate) {
      var fd = dTo(p.followupDate);
      if (fd < 0) naClass = ' na-overdue';
      else if (fd <= 3) naClass = ' na-soon';
    }
    h += '<div class="pb2-card-na' + naClass + '">🎯 ' + sanitize((p.nextAction || '').substr(0, 20)) + '</div>';
  }
  if (lastLog) h += '<div class="pb2-card-log">📝 ' + fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 25)) + '</div>';
  h += '</div>';
  return h;
}

function toggleBoardCol(statusId) {
  if (pipeBoardCollapsed[statusId]) delete pipeBoardCollapsed[statusId];
  else pipeBoardCollapsed[statusId] = true;
  render();
}

function scrollBoard(dir) {
  var board = document.getElementById('pb2Board');
  if (!board) return;
  board.scrollBy({ left: dir * 280, behavior: 'smooth' });
}

function initBoardScroll() {
  var board = document.getElementById('pb2Board');
  if (!board) return;
  var isDown = false, startX = 0, scrollLeft = 0;
  board.addEventListener('mousedown', function(e) {
    if (e.target.closest('.pb2-card')) return;
    isDown = true;
    board.classList.add('pb2-grabbing');
    startX = e.pageX - board.offsetLeft;
    scrollLeft = board.scrollLeft;
  });
  board.addEventListener('mouseleave', function() { isDown = false; board.classList.remove('pb2-grabbing'); });
  board.addEventListener('mouseup', function() { isDown = false; board.classList.remove('pb2-grabbing'); });
  board.addEventListener('mousemove', function(e) {
    if (!isDown) return;
    e.preventDefault();
    var x = e.pageX - board.offsetLeft;
    var walk = (x - startX) * 1.5;
    board.scrollLeft = scrollLeft - walk;
  });
}

// เปิดเมนูเลือกสถานะ (สำหรับมือถือ/สำรอง)
function showMoveStatusM(pipeId) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  var cfg = getConfig();
  var h = '<div style="display:flex;flex-direction:column;gap:6px">';
  cfg.pipelineStatuses.forEach(function(st) {
    var cur = p.status === st.id;
    h += '<button class="btn ' + (cur ? 'bp' : 'bo') + '" style="justify-content:flex-start;text-align:left;' + (cur ? '' : 'border-color:' + st.color + ';color:' + st.color) + '"' + (cur ? ' disabled' : '') + ' onclick="closeMForce();changePipeStatus(\'' + pipeId + '\',\'' + st.id + '\')">' + st.name + (cur ? ' • ปัจจุบัน' : '') + '</button>';
  });
  h += '</div>';
  openM('⇄ ย้ายสถานะ: ' + sanitize((p.projectName || '').substr(0, 40)), h);
}

// ต่อ drag-and-drop ย้าย Status จริง (เดิมมีแต่ draggable ไม่มี handler)
function initBoardDnD() {
  var board = document.getElementById('pb2Board');
  if (!board) return;
  var dragId = null;
  board.addEventListener('dragstart', function(e) {
    var card = e.target.closest('.pb2-card');
    if (!card) return;
    dragId = card.getAttribute('data-pipeid');
    card.classList.add('dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (_) {} }
  });
  board.addEventListener('dragend', function(e) {
    var card = e.target.closest('.pb2-card');
    if (card) card.classList.remove('dragging');
    var cols = board.querySelectorAll('.pb2-col.drag-over');
    for (var i = 0; i < cols.length; i++) cols[i].classList.remove('drag-over');
    dragId = null;
  });
  board.addEventListener('dragover', function(e) {
    var col = e.target.closest('.pb2-col[data-pipecol]');
    if (!col) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    var cols = board.querySelectorAll('.pb2-col.drag-over');
    for (var i = 0; i < cols.length; i++) if (cols[i] !== col) cols[i].classList.remove('drag-over');
    col.classList.add('drag-over');
  });
  board.addEventListener('drop', function(e) {
    var col = e.target.closest('.pb2-col[data-pipecol]');
    if (!col) return;
    e.preventDefault();
    var sid = col.getAttribute('data-pipecol');
    var id = dragId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
    col.classList.remove('drag-over');
    if (id && sid) changePipeStatus(id, sid); // จัดการ win/lost + log + render ในตัว
  });
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================
function getPipeSummary() {
  var cfg = getConfig();
  var all = ST.getAll('pipeline');
  var summary = {};
  var totalPipeline = 0;
  var totalWon = 0;
  for (var i = 0; i < cfg.pipelineStatuses.length; i++) {
    var s = cfg.pipelineStatuses[i];
    var items = all.filter(function(p) { return p.status === s.id; });
    var amount = items.reduce(function(a,p) { return a + (Number(p.forecastAmount)||0); }, 0);
    summary[s.id] = {count: items.length, amount: amount, name: s.name, color: s.color};
    if (['lost','on_hold'].indexOf(s.id) === -1) totalPipeline += amount;
    if (['win','ordered','delivered'].indexOf(s.id) !== -1) totalWon += amount;
  }
  return {summary: summary, totalPipeline: totalPipeline, totalWon: totalWon, totalCount: all.length};
}

function getPipeName(statusId) {
  var cfg = getConfig();
  for (var i = 0; i < cfg.pipelineStatuses.length; i++) {
    if (cfg.pipelineStatuses[i].id === statusId) return cfg.pipelineStatuses[i].name;
  }
  return statusId;
}

function addQuickPipeComment(pipeId) {
  var text = document.getElementById('quickPipeComment')?.value.trim();
  if (!text) { toast('กรุณาพิมพ์ comment'); return; }
  ST.add('pipeLog', { pipeId: pipeId, type: 'note', content: text, date: _nw() });
  document.getElementById('quickPipeComment').value = '';
  toast('💬 เพิ่ม comment แล้ว');
  render();
}

// รวม 2 prompt() (รายละเอียด + วันนัดติดตาม) เป็น modal เดียว เห็นทั้ง 2 ช่องพร้อมกัน
function addQuickPipeFollowup(pipeId) {
  openM('📞 ตั้งนัดติดตาม', '' +
    '<div class="fg"><label>📞 รายละเอียดการติดตาม *</label><textarea id="qfu_note" rows="3"></textarea></div>' +
    dpH('qfu_date', addD(_td(), 3), 'นัดติดตามอีกครั้ง') +
    '<button class="btn bp btn-full" onclick="saveQuickPipeFollowup(\'' + pipeId + '\')">💾 บันทึก</button>');
}

function saveQuickPipeFollowup(pipeId) {
  var note = document.getElementById('qfu_note').value.trim();
  if (!note) return alert('ใส่รายละเอียดการติดตาม');
  var dueDate = dpG('qfu_date');
  ST.add('pipeLog', { pipeId: pipeId, type: 'followup', content: note + (dueDate ? ' (นัดติดตาม ' + dueDate + ')' : ''), date: _nw() });
  if (dueDate) ST.update('pipeline', pipeId, { followupDate: dueDate });
  closeMForce();
  toast('📞 บันทึกนัดติดตามแล้ว');
  render();
}

function rPipeDashboard(el) {
  document.getElementById('pgT').textContent = '📊 Pipeline Dashboard';
  var allPipes = ST.getAll('pipeline');
  var today = _td();
  var thisYM = today.substr(0, 7);

  var active = [], won = [], lost = [];
  var activeAmt = 0, wonAmt = 0;
  allPipes.forEach(function(p) {
    var amt = Number(p.forecastAmount) || 0;
    if (['win','ordered','delivered'].indexOf(p.status) !== -1) { won.push(p); wonAmt += amt; }
    else if (p.status === 'lost') { lost.push(p); }
    else if (p.status !== 'on_hold') { active.push(p); activeAmt += amt; }
  });
  var closedCount = won.length + lost.length;
  var winRate = closedCount > 0 ? Math.round(won.length / closedCount * 100) : 0;
  var wrColor = winRate >= 70 ? '#22c55e' : winRate >= 50 ? '#f59e0b' : '#ef4444';
  var closingThis = active.filter(function(p) {
    var cd = p.expectedCloseDate || p.biddingDate;
    return cd && cd.substr(0,7) === thisYM;
  });

  // ── Zone A: Stats ──
  var h = '<div class="sr" style="margin-bottom:12px">' +
    '<div class="sc"><div class="sn c1">' + allPipes.length + '</div><div class="sl">ทั้งหมด</div></div>' +
    '<div class="sc"><div class="sn c2">' + active.length + '</div><div class="sl">Active</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(activeAmt) + '</div><div class="sl">มูลค่า Active</div></div>' +
    '<div class="sc"><div class="sn c5">' + closingThis.length + '</div><div class="sl">ปิดเดือนนี้</div></div>' +
    '<div class="sc"><div class="sn c2">' + won.length + '</div><div class="sl">Won</div></div>' +
    '<div class="sc"><div class="sn" style="color:' + wrColor + '">' + winRate + '%</div><div class="sl">Win Rate</div></div>' +
    '</div>';

  // ── Zone B: Monthly Timeline (6 months) ──
  var thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var months = [];
  var d = new Date(today + 'T00:00:00');
  d.setDate(1);
  for (var mi = 0; mi < 6; mi++) {
    var y = d.getFullYear(), m = d.getMonth();
    var ym = y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1);
    months.push({ ym: ym, year: y, month: m, pipes: [], amt: 0 });
    d.setMonth(d.getMonth() + 1);
  }
  active.forEach(function(p) {
    var cd = p.expectedCloseDate || p.biddingDate;
    if (!cd) return;
    var ym = cd.substr(0, 7);
    for (var i = 0; i < months.length; i++) {
      if (months[i].ym === ym) { months[i].pipes.push(p); months[i].amt += Number(p.forecastAmount) || 0; break; }
    }
  });
  var maxAmt = 0;
  months.forEach(function(mo) { if (mo.amt > maxAmt) maxAmt = mo.amt; });

  h += '<div class="card" style="margin-bottom:10px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h += '<h2 style="margin:0">📅 Timeline 6 เดือน</h2>';
  h += '<span style="font-size:.68rem;color:#64748b">Expected Close / Bidding Date</span></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';

  months.forEach(function(mo) {
    var thaiYr = String(mo.year + 543).substr(2);
    var label = thMonths[mo.month] + ' ' + thaiYr;
    var isThis = mo.ym === thisYM;
    var barPct = maxAmt > 0 ? Math.round(mo.amt / maxAmt * 100) : 0;
    var borderCol = isThis ? '#3b82f6' : 'rgba(255,255,255,.06)';
    var bgCol = isThis ? 'rgba(59,130,246,.1)' : 'rgba(255,255,255,.03)';

    h += '<div style="background:' + bgCol + ';border:1px solid ' + borderCol + ';border-radius:10px;padding:10px;' + (mo.pipes.length ? 'cursor:pointer' : '') + '"' +
      (mo.pipes.length ? ' onclick="showPipeMonthM(\'' + mo.ym + '\')"' : '') + '>';
    h += '<div style="font-size:.72rem;font-weight:700;color:' + (isThis ? '#3b82f6' : '#64748b') + ';margin-bottom:4px">' + label + (isThis ? ' ◀' : '') + '</div>';
    h += '<div style="font-size:1.15rem;font-weight:800;color:' + (mo.pipes.length ? '#e2e8f0' : '#334155') + '">' + mo.pipes.length + ' <span style="font-size:.62rem;font-weight:400;color:#475569">โครงการ</span></div>';
    h += '<div style="font-size:.7rem;color:#22c55e;margin:2px 0 4px">' + (mo.amt ? fmtMoneyShort(mo.amt) : '—') + '</div>';
    if (mo.pipes.length) {
      h += '<div style="height:3px;background:rgba(255,255,255,.06);border-radius:2px;margin-bottom:5px"><div style="height:3px;background:#3b82f6;border-radius:2px;width:' + barPct + '%"></div></div>';
      mo.pipes.slice(0, 2).forEach(function(p) {
        h += '<div style="font-size:.6rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">• ' + sanitize((p.projectName || '').substr(0, 22)) + '</div>';
      });
      if (mo.pipes.length > 2) h += '<div style="font-size:.58rem;color:#334155">+' + (mo.pipes.length - 2) + ' เพิ่มเติม</div>';
    }
    h += '</div>';
  });
  h += '</div></div>';

  // ── Zone C: Action needed ──
  var actionItems = active.filter(function(p) {
    var fd = p.followupDate ? dTo(p.followupDate) : null;
    var bd = p.biddingDate ? dTo(p.biddingDate) : null;
    var cd = p.expectedCloseDate ? dTo(p.expectedCloseDate) : null;
    return (fd !== null && fd <= 14) ||
           (bd !== null && bd >= 0 && bd <= 14) ||
           (cd !== null && cd >= 0 && cd <= 14);
  });
  actionItems.sort(function(a, b) {
    var da = Math.min(
      a.followupDate ? dTo(a.followupDate) : 999,
      a.biddingDate  ? Math.max(0, dTo(a.biddingDate)) : 999,
      a.expectedCloseDate ? Math.max(0, dTo(a.expectedCloseDate)) : 999
    );
    var db = Math.min(
      b.followupDate ? dTo(b.followupDate) : 999,
      b.biddingDate  ? Math.max(0, dTo(b.biddingDate)) : 999,
      b.expectedCloseDate ? Math.max(0, dTo(b.expectedCloseDate)) : 999
    );
    return da - db;
  });

  h += '<div class="card" style="margin-bottom:10px">';
  h += '<h2>🔔 ต้องจัดการ <span style="font-size:.7rem;font-weight:400;color:#64748b">Followup / Bidding / Close ภายใน 14 วัน</span></h2>';
  if (!actionItems.length) {
    h += '<div style="text-align:center;padding:16px;color:#475569;font-size:.85rem">ไม่มีรายการเร่งด่วน ✅</div>';
  } else {
    actionItems.slice(0, 8).forEach(function(p) {
      var dealer = ST.getOne('dealers', p.dealerId);
      var fd = p.followupDate ? dTo(p.followupDate) : null;
      var bd = p.biddingDate  ? dTo(p.biddingDate)  : null;
      var cd = p.expectedCloseDate ? dTo(p.expectedCloseDate) : null;
      h += '<div class="li" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer">';
      h += '<div class="lm">';
      h += '<div class="lt">' + sanitize((p.projectName || '').substr(0, 45)) + '</div>';
      h += '<div class="ls">' + (dealer ? dealer.name : '-') + (p.nextAction ? ' • ' + sanitize(p.nextAction) : '') + '</div>';
      h += '<div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap">';
      if (fd !== null) h += dlB(p.followupDate, false);
      if (bd !== null && bd >= 0 && bd <= 14) h += '<span style="font-size:.62rem;background:rgba(124,58,237,.15);color:#a78bfa;padding:1px 6px;border-radius:4px">🎯 Bid ' + fDShort(p.biddingDate) + '</span>';
      if (cd !== null && cd >= 0 && cd <= 14) h += '<span style="font-size:.62rem;background:rgba(34,197,94,.12);color:#22c55e;padding:1px 6px;border-radius:4px">✅ Close ' + fDShort(p.expectedCloseDate) + '</span>';
      h += '</div></div></div>';
    });
    if (actionItems.length > 8) {
      h += '<div style="text-align:center;padding:6px"><button class="btn bsm bo" onclick="go(\'pipeline\')">ดูทั้งหมด (' + actionItems.length + ')</button></div>';
    }
  }
  h += '</div>';

  h += '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    '<button class="btn bp" onclick="go(\'pipeline\')">📋 ดู Pipeline ทั้งหมด</button>' +
    '<button class="btn bo" onclick="go(\'pipeBoard\')">🃏 Board View</button>' +
    '</div>';

  el.innerHTML = h;
}

function showPipeMonthM(ym) {
  var allPipes = ST.getAll('pipeline');
  var pipes = allPipes.filter(function(p) {
    if (['win','ordered','delivered','lost'].indexOf(p.status) !== -1) return false;
    var cd = p.expectedCloseDate || p.biddingDate;
    return cd && cd.substr(0, 7) === ym;
  });
  pipes.sort(function(a, b) { return (Number(b.forecastAmount)||0) - (Number(a.forecastAmount)||0); });

  var thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var parts = ym.split('-');
  var label = thMonths[parseInt(parts[1]) - 1] + ' ' + (parseInt(parts[0]) + 543);
  var totalAmt = pipes.reduce(function(a, p) { return a + (Number(p.forecastAmount)||0); }, 0);

  var h = '<div style="font-size:.78rem;color:#64748b;margin-bottom:10px">' + pipes.length + ' โครงการ • รวม ' + fmtMoneyShort(totalAmt) + '</div>';
  if (!pipes.length) { h += '<div style="text-align:center;padding:20px;color:#475569">ไม่มีโครงการในเดือนนี้</div>'; }
  pipes.forEach(function(p) {
    var dealer = ST.getOne('dealers', p.dealerId);
    var hasClose = p.expectedCloseDate && p.expectedCloseDate.substr(0,7) === ym;
    h += '<div class="li" onclick="closeMForce();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})" style="cursor:pointer">' +
      '<div class="lm">' +
      '<div class="lt">' + sanitize(p.projectName || '') + '</div>' +
      '<div class="ls">' + (dealer ? dealer.name : '-') + ' • ' + sanitize(p.endUserTH || '-') + '</div>' +
      '<div style="display:flex;gap:5px;align-items:center;margin-top:3px;flex-wrap:wrap">' +
      pipeTag(p.status) + ' ' + fmtMoneyStyled(Number(p.forecastAmount)||0) +
      (hasClose ? ' <span style="font-size:.62rem;background:rgba(34,197,94,.12);color:#22c55e;padding:1px 6px;border-radius:4px">🎯 ' + fDShort(p.expectedCloseDate) + '</span>' : '') +
      '</div>' +
      '</div></div>';
  });
  openM('📅 โครงการเดือน ' + label, h);
}

// ================================================================
// PIPELINE ACTION ITEMS
// ================================================================
function getPipeActions() {
  var saved = localStorage.getItem('v7_pipeActions');
  if (saved) {
    try { return JSON.parse(saved); } catch(e) { return []; }
  }
  return [];
}

function savePipeActions(list) {
  localStorage.setItem('v7_pipeActions', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('pipeActions', list);
}

function getPipeActionsByPipe(pipeId) {
  var actions = getPipeActions();
  return (actions || []).filter(function(a) {
    return a.pipeId === pipeId && a.status !== 'dropped';
  });
}

function autoUpdatePipeNextAction(pipeId) {
  var actions = getPipeActionsByPipe(pipeId);
  var pending = (actions || []).filter(function(a) { return a.status === 'pending'; });
  if (!pending.length) return;
  pending.sort(function(a, b) {
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
  if (pipeId) autoUpdatePipeNextAction(pipeId);
  toast('✅ เสร็จแล้ว!');
  render();
}

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

function buildPipeActionsHTML(pipeId) {
  var actions = getPipeActionsByPipe(pipeId);
  var pending = (actions || []).filter(function(a) { return a.status === 'pending'; });
  var done = (actions || []).filter(function(a) { return a.status === 'done'; });
  var now = new Date();
  now.setHours(0, 0, 0, 0);

  pending.sort(function(a, b) {
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
    h += '<div class="empty"><p>ไม่มี Action Item — กด ➕ เพื่อเพิ่ม</p></div></div>';
    return h;
  }

  if (pending.length) {
    pending.forEach(function(a) {
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
      h += '<div class="pa-header"><span class="pa-text">' + sanitize(a.text) + '</span>' + (a.priority === 1 ? ' <span class="pa-priority">🔴 เร่งด่วน</span>' : '') + '</div>';
      h += '<div class="pa-meta">📅 กำหนด: <strong>' + (a.dueDate || '-') + '</strong> ' + urgLabel + '</div>';
      if (a.note) h += '<div class="pa-note">' + sanitize(a.note) + '</div>';
      h += '<div class="pa-actions">';
      h += '<button class="btn-xs pa-btn-done" onclick="markPipeActionDone(\'' + a.id + '\')">✅ เสร็จแล้ว</button>';
      h += '<button class="btn-xs pa-btn-extend" onclick="extendPipeAction(\'' + a.id + '\')">📅 เลื่อนกำหนด</button>';
      h += '<button class="btn-xs pa-btn-drop" onclick="dropPipeAction(\'' + a.id + '\')">✕</button>';
      h += '</div></div></div>';
    });
  }

  if (done.length) {
    h += '<div class="pa-done-toggle" onclick="togglePaDone()">✅ เสร็จแล้ว (' + done.length + ') <span id="paDoneArrow">▶</span></div>';
    h += '<div class="pa-done-list" id="paDoneList" style="display:none">';
    done.sort(function(a, b) {
      var da = ftParseDate(a.doneDate || a.createdDate);
      var db = ftParseDate(b.doneDate || b.createdDate);
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
    done.forEach(function(a) {
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
// PIPELINE MULTI-MODEL HELPERS
// ================================================================
function getPipeItems(p) {
  if (p.items && p.items.length > 0) return p.items;
  if (p.model) {
    return [{
      model: p.model,
      qty: Number(p.modelQty) || 1,
      price: getModelPrice(p.model),
      total: Number(p.forecastAmount) || 0
    }];
  }
  return [];
}

function getPipeTotalQty(p) {
  var items = getPipeItems(p);
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total += (Number(items[i].qty) || 1);
  }
  return total;
}

function getPipeModelSummary(p) {
  if (!p) return '';
  if (p.items && p.items.length > 0) {
    return p.items.map(function(it) {
      return (it.model || '-') + (it.qty > 1 ? ' x' + it.qty : '');
    }).join(', ');
  }
  return (p.model || '') + (p.modelQty > 1 ? ' x' + p.modelQty : '');
}

function showAddPipeActionM(pipeId) {
  var pipe = ST.getOne('pipeline', pipeId);
  if (!pipe) return;
  var h = '<div style="max-width:450px">';
  h += '<div style="padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:12px">';
  h += '<div style="font-weight:600">📊 ' + sanitize(pipe.projectName || pipe.name || '-') + '</div></div>';
  h += '<div class="fm-group"><label>⚡ Quick Action</label><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอเอกสารจากลูกค้า\')">📄 รอเอกสาร</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอลูกค้าตอบ Quote\')">💰 รอตอบ Quote</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอ TOR\')">📋 รอ TOR</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'นัด Demo\')">🎯 นัด Demo</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'ส่ง Spec เพิ่มเติม\')">🚁 ส่ง Spec</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'ติดต่อ DJI\')">📞 ติดต่อ DJI</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'เตรียมเอกสาร Bidding\')">📊 เตรียม Bidding</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'Follow-up ลูกค้า\')">🔄 Follow-up</button>';
  h += '</div></div>';
  h += '<div class="fm-group"><label>📝 สิ่งที่ต้องทำ / ติดตาม</label><input type="text" id="paText" class="fm-input" placeholder="เช่น รอ TOR จากลูกค้า..."></div>';
  h += '<div class="fm-group"><label>📅 กำหนดวัน</label><input type="text" id="paDueDate" class="fm-input dp" placeholder="DD/MM/YYYY"></div>';
  h += '<div class="fm-group"><label>🔴 ความเร่งด่วน</label><select id="paPriority" class="fm-input"><option value="2">ปกติ</option><option value="1">🔴 เร่งด่วน</option></select></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ (ถ้ามี)</label><textarea id="paNote" rows="2" class="fm-input" placeholder="รายละเอียดเพิ่มเติม..."></textarea></div>';
  h += '<div class="fm-actions"><button class="btn btn-blue" onclick="savePipeAction(\'' + pipeId + '\')">💾 บันทึก</button><button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
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
  autoUpdatePipeNextAction(pipeId);
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

// ================================================================
// EDIT PIPELINE LOG
// ================================================================
function editPipelineLog(logId, pipeId, currentText, currentType, currentDate) {
  var logTypes = [
    { value: 'update', label: '📝 อัพเดท' },
    { value: 'progress', label: '🟢 คืบหน้า' },
    { value: 'problem', label: '🔴 ปัญหา' },
    { value: 'solution', label: '🟡 แก้ไข' },
    { value: 'note', label: '⚪ หมายเหตุ' },
    { value: 'followup', label: '📞 ติดตาม' }
  ];
  
  var typeOptions = '';
  for (var i = 0; i < logTypes.length; i++) {
    typeOptions += '<option value="' + logTypes[i].value + '"' + (currentType === logTypes[i].value ? ' selected' : '') + '>' + logTypes[i].label + '</option>';
  }
  
  openM('✏️ แก้ไข Log', `
    <div class="fg">
      <label>📊 ประเภท</label>
      <select id="el_type" class="fm-input">${typeOptions}</select>
    </div>
    <div class="fg">
      <label>📅 วันที่</label>
      <input type="text" id="el_date" class="fm-input dp" value="${fD(currentDate)}">
    </div>
    <div class="fg">
      <label>📝 รายละเอียด</label>
      <textarea id="el_content" rows="4" class="fm-input">${sanitize(currentText)}</textarea>
    </div>
    <div class="fm-actions">
      <button class="btn btn-blue" onclick="savePipelineLogEdit('${logId}', '${pipeId}')">💾 บันทึก</button>
      <button class="btn bd" onclick="deletePipelineLog('${logId}', '${pipeId}')">🗑️ ลบ</button>
      <button class="btn" onclick="closeM()">ยกเลิก</button>
    </div>
  `);
}

function savePipelineLogEdit(logId, pipeId) {
  var newType = document.getElementById('el_type').value;
  var newDate = dpG('el_date') || _td();
  var newContent = document.getElementById('el_content').value.trim();
  
  if (!newContent) { toast('กรุณาใส่รายละเอียด'); return; }
  
  ST.update('pipeLog', logId, {
    type: newType,
    content: newContent,
    date: newDate + 'T' + new Date().toTimeString().slice(0, 8)
  });
  
  closeMForce();
  toast('💾 แก้ไขแล้ว');
  render();
}

function deletePipelineLog(logId, pipeId) {
  if (!confirm('ลบ Log นี้?')) return;
  ST.delete('pipeLog', logId);
  closeMForce();
  toast('🗑️ ลบแล้ว');
  render();
}

// ================================================================
// CUSTOMER FORECAST UPDATES (APPROVE PAGE)
// ================================================================

// ✅ ฟังก์ชันสำหรับ client (ลูกค้ากดส่งใหม่)
async function resubmitForecast(dealerId, updateId) {
  if (!confirm('ส่งแผนการสั่งซื้อนี้ให้พนักงานขายตรวจสอบใหม่อีกครั้ง?')) return;
  
  try {
    var updateRef = db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(updateId);
    await updateRef.update({
      _status: 'pending',
      _resubmittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      _previousStatus: 'rejected'
    });
    
    toast('✅ ส่งคำขอใหม่เรียบร้อยแล้ว รอการอนุมัติจากพนักงานขาย');
    setTimeout(function() { location.reload(); }, 1000);
  } catch(err) {
    toast('❌ เกิดข้อผิดพลาด: ' + err.message);
  }
}

// ✅ ฟังก์ชันสำหรับ admin (กด restore)
async function restoreForecastUpdate(dealerId, updateId) {
  if (!confirm('ส่งคำขอนี้กลับไปให้ตรวจสอบใหม่อีกครั้ง?')) return;
  
  try {
    var updateRef = db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(updateId);
    await updateRef.update({
      _status: 'pending',
      _restoredAt: firebase.firestore.FieldValue.serverTimestamp(),
      _restoredBy: CURRENT_USER ? CURRENT_USER.uid : 'admin'
    });
 // ✅ Audit Log
  var dealer = ST.getOne('dealers', dealerId);
  addAuditLog(
    'restore_forecast',
    'forecast',
    updateId,
    'Restore forecast',
    dealerId,
    dealer ? dealer.name : '',
    { oldValue: 'rejected', newValue: 'pending' }
  );
    
    toast('🔄 ส่งกลับไปตรวจสอบใหม่แล้ว');
    rCustomerForecastUpdates(document.getElementById('ct'));
  } catch(err) {
    toast('❌ เกิดข้อผิดพลาด: ' + err.message);
  }
}

function rCustomerForecastUpdates(el) {
  document.getElementById('pgT').textContent = '📦 แผนการสั่งซื้อจากลูกค้า';
  
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    el.innerHTML = '<div class="card"><div class="empty"><p>กรุณา login เพื่อดูคำขอ</p></div></div>';
    return;
  }
  
  var dealers = ST.getAll('dealers');
  if (!dealers.length) {
    el.innerHTML = '<div class="card"><div class="empty"><p>ไม่มี Dealer ในระบบ</p></div></div>';
    return;
  }
  
  selectedForecastUpdates = {};
  var allUpdates = [];
  var pendingCount = 0;
  var rejectedCount = 0;
  
  var promises = dealers.map(function(dealer) {
    return db.collection('dealerUpdates').doc(dealer.id).collection('forecast')
      .get()
      .then(function(snapshot) {
        snapshot.forEach(function(doc) {
          var data = doc.data();
          data.id = doc.id;
          data.dealerName = dealer.name;
          data.dealerId = dealer.id;
          allUpdates.push(data);
          if (data._status === 'pending') pendingCount++;
          if (data._status === 'rejected') rejectedCount++;
        });
      })
      .catch(function(err) { 
        console.warn('Error checking forecast for dealer:', dealer.name, err);
        return Promise.resolve();
      });
  });
  
  Promise.all(promises).then(function() {
    var badge = document.getElementById('forecastUpdateBadge');
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount ? 'inline' : 'none';
    }
    
    var pendingUpdates = allUpdates.filter(function(u) { return u._status === 'pending'; });
    var rejectedUpdates = allUpdates.filter(function(u) { return u._status === 'rejected'; });
    
    if (pendingUpdates.length === 0 && rejectedUpdates.length === 0) {
      el.innerHTML = '<div class="card"><div class="empty"><div class="icon">📭</div><p>ไม่มีคำขอแผนการสั่งซื้อจากลูกค้า</p></div></div>';
      return;
    }
    
    var html = '<div class="card"><h2>📦 แผนการสั่งซื้อจากลูกค้า</h2>';
    
    // แท็บ
    html += '<div class="ftabs" style="margin-bottom:12px">';
    html += '<div class="ftab ' + (forecastTab === 'pending' ? 'act' : '') + '" onclick="forecastTab=\'pending\'; rCustomerForecastUpdates(document.getElementById(\'ct\'))">⏳ รอตรวจสอบ (' + pendingUpdates.length + ')</div>';
    html += '<div class="ftab ' + (forecastTab === 'rejected' ? 'act' : '') + '" onclick="forecastTab=\'rejected\'; rCustomerForecastUpdates(document.getElementById(\'ct\'))">❌ ปฏิเสธ (' + rejectedUpdates.length + ')</div>';
    html += '</div>';
    
    if (forecastTab === 'pending') {
      html += '<div class="bg" style="margin-bottom:12px">';
      html += '<button class="btn bp" onclick="batchApproveForecastSelected()" style="background:#22c55e">✅ Approve ที่เลือก</button>';
      html += '<button class="btn bs" onclick="batchApproveForecastAll()" style="background:#3b82f6">✅ Approve ทั้งหมด (' + pendingUpdates.length + ')</button>';
      html += '<button class="btn bsm bo" onclick="toggleSelectAllForecast()">☑️ เลือกทั้งหมด</button>';
      html += '</div>';
    }
    
    html += '<div id="forecastUpdatesList">';
    
    if (forecastTab === 'pending') {
      for (var i = 0; i < pendingUpdates.length; i++) {
        var u = pendingUpdates[i];
        var isSelected = selectedForecastUpdates[u.id] === true;
        var updateDate = u._updatedAt ? (u._updatedAt.seconds ? new Date(u._updatedAt.seconds * 1000).toLocaleString() : u._updatedAt) : '-';
        var typeIcon = u.type === 'runrate' ? '📦' : '🏢';
        var typeText = u.type === 'runrate' ? 'Run Rate' : 'โครงการ';
        
        html += '<div class="li" style="border-left:3px solid #f59e0b; margin-bottom:8px; display:flex; flex-wrap:wrap">';
        html += '<div style="margin-right:10px">';
        html += '<input type="checkbox" class="forecast-checkbox" data-id="' + u.id + '" data-dealer="' + u.dealerId + '" ' + (isSelected ? 'checked' : '') + ' onchange="toggleForecastSelection(\'' + u.id + '\', this.checked)">';
        html += '</div>';
        html += '<div class="lm" style="flex:1">';
        html += '<div class="lt">' + typeIcon + ' <strong>' + sanitize(u.dealerName) + '</strong> - ' + typeText + ' <span class="tag tag-active">รอตรวจสอบ</span></div>';
        
        if (u.type === 'runrate') {
          html += '<div class="ls">📦 ' + sanitize(u.model || '-') + ' x' + (u.qty || 0) + ' ชิ้น • เดือน ' + (u.month || '-') + '</div>';
        } else {
          html += '<div class="ls">📋 ' + sanitize(u.projectName || '-') + '</div>';
          if (u.endUser) html += '<div class="ls">👤 ' + sanitize(u.endUser) + '</div>';
          html += '<div class="ls">📦 ' + (u.items || []).map(function(it) { return it.model + ' x' + it.qty; }).join(', ') + '</div>';
          html += '<div class="ls">📅 เดือน ' + (u.month || '-') + '</div>';
        }
        
        html += '<div class="ls">⏰ ' + updateDate + '</div>';
        html += '</div>';
        html += '<div class="bg" style="flex-shrink:0">';
        html += '<button class="btn bsm bs" onclick="approveForecastUpdate(\'' + u.dealerId + '\', \'' + u.id + '\')">✅ อนุมัติ</button>';
        html += '<button class="btn bsm bd" onclick="rejectForecastUpdate(\'' + u.dealerId + '\', \'' + u.id + '\')">❌ ปฏิเสธ</button>';
        html += '<button class="btn bsm bo" onclick="viewForecastDetail(\'' + u.dealerId + '\', \'' + u.id + '\')">👁️ รายละเอียด</button>';
        html += '</div></div>';
      }
    } else {
      // แสดง rejected updates
      for (var i = 0; i < rejectedUpdates.length; i++) {
        var u = rejectedUpdates[i];
        var updateDate = u._updatedAt ? (u._updatedAt.seconds ? new Date(u._updatedAt.seconds * 1000).toLocaleString() : u._updatedAt) : '-';
        var rejectDate = u._rejectedAt ? (u._rejectedAt.seconds ? new Date(u._rejectedAt.seconds * 1000).toLocaleString() : u._rejectedAt) : '-';
        var typeIcon = u.type === 'runrate' ? '📦' : '🏢';
        var typeText = u.type === 'runrate' ? 'Run Rate' : 'โครงการ';
        
        html += '<div class="li" style="border-left:3px solid #ef4444; margin-bottom:8px; display:flex; flex-wrap:wrap; background:rgba(239,68,68,0.03)">';
        html += '<div class="lm" style="flex:1">';
        html += '<div class="lt">' + typeIcon + ' <strong>' + sanitize(u.dealerName) + '</strong> - ' + typeText + ' <span class="tag tag-cancelled" style="background:#ef4444; color:white">❌ ปฏิเสธ</span></div>';
        
        if (u.type === 'runrate') {
          html += '<div class="ls">📦 ' + sanitize(u.model || '-') + ' x' + (u.qty || 0) + ' ชิ้น • เดือน ' + (u.month || '-') + '</div>';
        } else {
          html += '<div class="ls">📋 ' + sanitize(u.projectName || '-') + '</div>';
          if (u.endUser) html += '<div class="ls">👤 ' + sanitize(u.endUser) + '</div>';
          html += '<div class="ls">📦 ' + (u.items || []).map(function(it) { return it.model + ' x' + it.qty; }).join(', ') + '</div>';
          html += '<div class="ls">📅 เดือน ' + (u.month || '-') + '</div>';
        }
        
        html += '<div class="ls">⏰ ส่งเมื่อ: ' + updateDate + '</div>';
        html += '<div class="ls">❌ ปฏิเสธเมื่อ: ' + rejectDate + '</div>';
        html += '</div>';
        html += '<div class="bg" style="flex-shrink:0">';
        html += '<button class="btn bsm bs" onclick="restoreForecastUpdate(\'' + u.dealerId + '\', \'' + u.id + '\')">🔄 ส่งกลับไปตรวจสอบใหม่</button>';
        html += '<button class="btn bsm bo" onclick="viewForecastDetail(\'' + u.dealerId + '\', \'' + u.id + '\')">👁️ รายละเอียด</button>';
        html += '</div></div>';
      }
    }
    
    html += '</div></div>';
    el.innerHTML = html;
  });
}

function toggleForecastSelection(updateId, isChecked) {
  selectedForecastUpdates[updateId] = isChecked;
  updateForecastBatchButtonBadge();
}

function updateForecastBatchButtonBadge() {
  var count = 0;
  for (var k in selectedForecastUpdates) if (selectedForecastUpdates[k]) count++;
  var btn = document.querySelector('button[onclick="batchApproveForecastSelected()"]');
  if (btn) btn.innerHTML = '✅ Approve ที่เลือก (' + count + ')';
}

function toggleSelectAllForecast() {
  var checkboxes = document.querySelectorAll('.forecast-checkbox');
  var allChecked = true;
  for (var i = 0; i < checkboxes.length; i++) {
    if (!checkboxes[i].checked) { allChecked = false; break; }
  }
  var newState = !allChecked;
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].checked = newState;
    selectedForecastUpdates[checkboxes[i].dataset.id] = newState;
  }
  updateForecastBatchButtonBadge();
}

function batchApproveForecastSelected() {
  var selectedIds = [];
  var selectedDealers = {};
  var checkboxes = document.querySelectorAll('.forecast-checkbox:checked');
  
  for (var i = 0; i < checkboxes.length; i++) {
    var updateId = checkboxes[i].dataset.id;
    var dealerId = checkboxes[i].dataset.dealer;
    if (!selectedDealers[dealerId]) selectedDealers[dealerId] = [];
    selectedDealers[dealerId].push(updateId);
    selectedIds.push(updateId);
  }
  
  if (selectedIds.length === 0) { toast('⚠️ กรุณาเลือกรายการ'); return; }
  if (!confirm('✅ อนุมัติ ' + selectedIds.length + ' รายการ?')) return;
  
  var completed = 0, errors = 0;
  
  for (var dealerId in selectedDealers) {
    selectedDealers[dealerId].forEach(function(updateId) {
      approveForecastUpdate(dealerId, updateId, function(success) {
        completed++;
        if (!success) errors++;
        if (completed === selectedIds.length) {
          toast('✅ อนุมัติ ' + (selectedIds.length - errors) + ' รายการ');
          setTimeout(function() { render(); }, 1000);
        }
      });
    });
  }
}

function batchApproveForecastAll() {
  var checkboxes = document.querySelectorAll('.forecast-checkbox');
  if (checkboxes.length === 0) { toast('⚠️ ไม่มีรายการ'); return; }
  if (!confirm('✅ อนุมัติทั้งหมด ' + checkboxes.length + ' รายการ?')) return;
  
  var completed = 0, errors = 0;
  
  for (var i = 0; i < checkboxes.length; i++) {
    var updateId = checkboxes[i].dataset.id;
    var dealerId = checkboxes[i].dataset.dealer;
    approveForecastUpdate(dealerId, updateId, function(success) {
      completed++;
      if (!success) errors++;
      if (completed === checkboxes.length) {
        toast('✅ อนุมัติทั้งหมด ' + (checkboxes.length - errors) + ' รายการ');
        setTimeout(function() { render(); }, 1000);
      }
    });
  }
}

// approveForecastUpdate / rejectForecastUpdate ถูกย้ายไปรวมที่ app.js (เวอร์ชันเดียว มี audit log)
// เดิมเวอร์ชันที่นี่มีบั๊ก (var dealer ตกหาย) และถูก app.js override อยู่แล้ว
function viewForecastDetail(dealerId, updateId) {
  db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(updateId).get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    
    var html = '<div style="max-width:500px">';
    html += '<h3>📦 รายละเอียดแผนการสั่งซื้อ</h3>';
    html += '<div><strong>🏪 Dealer:</strong> ' + sanitize(data.dealerName || dealerId) + '</div>';
    html += '<div><strong>📅 เดือน:</strong> ' + (data.month || '-') + '</div>';
    html += '<div><strong>📊 ประเภท:</strong> ' + (data.type === 'runrate' ? 'Run Rate' : 'โครงการ') + '</div>';
    
    if (data.type === 'runrate') {
      html += '<div><strong>📦 Model:</strong> ' + sanitize(data.model || '-') + '</div>';
      html += '<div><strong>🔢 จำนวน:</strong> ' + (data.qty || 0) + ' ชิ้น</div>';
    } else {
      html += '<div><strong>📋 โครงการ:</strong> ' + sanitize(data.projectName || '-') + '</div>';
      if (data.endUser) html += '<div><strong>👤 End User:</strong> ' + sanitize(data.endUser) + '</div>';
      html += '<div><strong>📦 สินค้า:</strong></div><ul>';
      if (data.items && data.items.length) {
        for (var i = 0; i < data.items.length; i++) {
          html += '<li>' + sanitize(data.items[i].model) + ' x' + (data.items[i].qty || 1) + '</li>';
        }
      } else {
        html += '<li>ไม่มีข้อมูลสินค้า</li>';
      }
      html += '</ul>';
    }
    
    // แสดงสถานะปัจจุบัน
    var statusText = '';
    if (data._status === 'pending') statusText = '<span class="tag tag-active">⏳ รอตรวจสอบ</span>';
    else if (data._status === 'approved') statusText = '<span class="tag tag-completed">✅ อนุมัติแล้ว</span>';
    else if (data._status === 'rejected') statusText = '<span class="tag tag-cancelled">❌ ปฏิเสธ</span>';
    html += '<div><strong>📊 สถานะ:</strong> ' + statusText + '</div>';
    
    html += '<div class="fm-actions" style="margin-top:16px">';
    
    // แสดงปุ่มตามสถานะ
    if (data._status === 'pending') {
      html += '<button class="btn bs" onclick="closeM();approveForecastUpdate(\'' + dealerId + '\', \'' + updateId + '\')">✅ อนุมัติ</button>';
      html += '<button class="btn bd" onclick="closeM();rejectForecastUpdate(\'' + dealerId + '\', \'' + updateId + '\')">❌ ปฏิเสธ</button>';
    } else if (data._status === 'rejected') {
      html += '<button class="btn bs" onclick="closeM();restoreForecastUpdate(\'' + dealerId + '\', \'' + updateId + '\')">🔄 ส่งกลับไปตรวจสอบใหม่</button>';
    }
    
    html += '<button class="btn" onclick="closeM()">ปิด</button>';
    html += '</div></div>';
    
    openM('📦 รายละเอียด', html);
  }).catch(function(err) {
    console.error('View forecast detail error:', err);
    toast('❌ ไม่สามารถโหลดรายละเอียดได้');
  });
}

// ================================================================
// SHEET EDIT (jspreadsheet — Pipeline)
// ================================================================
var _pipeSheetInstance = null;
var _pipeSheetIds = [];

function initPipeSheet(pipes) {
  if (typeof jspreadsheet === 'undefined') { toast('⚠️ โหลด jspreadsheet ไม่สำเร็จ (ต้องออนไลน์)'); return; }
  var el = document.getElementById('pipeSheetEl');
  if (!el) return;
  if (el.jspreadsheet) { el.jspreadsheet.destroy(); el.innerHTML = ''; }

  var cfg = getConfig();
  var statusNames = (cfg.pipelineStatuses || []).map(function(s) { return s.name; });
  if (!statusNames.length) statusNames = ['Prospect','TOR Review','Quotation','Bidding','Negotiation','Win','Lost'];

  var dealers = ST.getAll('dealers');
  var dealerById = {};
  dealers.forEach(function(d) { dealerById[d.id] = d.name || ''; });

  function fmtDate(s) {
    if (!s) return '';
    var p = (s || '').slice(0,10).split('-');
    if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
    return s;
  }

  _pipeSheetIds = pipes.map(function(p) { return p.id; });
  var data = pipes.map(function(p) {
    var statusObj = (cfg.pipelineStatuses || []).find(function(s) { return s.id === p.status; });
    return [
      fmtDate(p.registerDate), p.projectName||'', p.endUserTH||'', p.endUserEN||'',
      p.unitType||'', dealerById[p.dealerId]||'', p.djiDealer||'',
      p.forecastAmount||0, p.realAmount||0,
      fmtDate(p.biddingDate), fmtDate(p.shipmentDate),
      statusObj ? statusObj.name : (p.status||''),
      p.saleName||'', p.remark||''
    ];
  });

  _pipeSheetInstance = jspreadsheet(el, {
    data: data,
    columns: [
      { title: 'Register Date', type: 'text', width: 95 },
      { title: 'Project Name', type: 'text', width: 220 },
      { title: 'End User TH', type: 'text', width: 150 },
      { title: 'End User EN', type: 'text', width: 130 },
      { title: 'Unit type', type: 'text', width: 80 },
      { title: 'Dealer', type: 'text', width: 130 },
      { title: 'DJI Dealer', type: 'text', width: 110 },
      { title: 'Forecast', type: 'numeric', width: 100 },
      { title: 'Real Amount', type: 'numeric', width: 100 },
      { title: 'Bidding Date', type: 'text', width: 95 },
      { title: 'Shipment Date', type: 'text', width: 100 },
      { title: 'Status', type: 'dropdown', source: statusNames, width: 110 },
      { title: 'Sale', type: 'text', width: 80 },
      { title: 'Remark', type: 'text', width: 180 }
    ],
    minDimensions: [14, Math.max(data.length, 5)],
    allowInsertRow: false,
    allowDeleteRow: false,
    contextMenu: false
  });
}

function savePipeSheet() {
  if (!_pipeSheetInstance) { toast('⚠️ เปิด Sheet mode ก่อน'); return; }
  var rows = _pipeSheetInstance.getData();
  var cfg = getConfig();
  var dealers = ST.getAll('dealers');
  var dealerByName = {};
  dealers.forEach(function(d) { if (d.name) dealerByName[d.name.trim().toLowerCase()] = d; });

  var saved = 0;
  rows.forEach(function(r, idx) {
    var id = _pipeSheetIds[idx];
    if (!id) return;
    var dealerName = (r[5]||'').trim();
    var dealer = dealerByName[dealerName.toLowerCase()];
    var statusName = (r[11]||'').trim();
    var statusObj = (cfg.pipelineStatuses||[]).find(function(s){ return s.name === statusName; });

    ST.update('pipeline', id, {
      registerDate: _pipeDateFromPaste(r[0]),
      projectName: (r[1]||'').trim(),
      endUserTH: (r[2]||'').trim(),
      endUserEN: (r[3]||'').trim(),
      unitType: (r[4]||'').trim(),
      dealerId: dealer ? dealer.id : (ST.getOne('pipeline', id)||{}).dealerId || '',
      djiDealer: (r[6]||'').trim(),
      forecastAmount: parseFloat(r[7])||0,
      realAmount: parseFloat(r[8])||0,
      biddingDate: _pipeDateFromPaste(r[9]),
      shipmentDate: _pipeDateFromPaste(r[10]),
      status: statusObj ? statusObj.id : (r[11]||'prospect'),
      saleName: (r[12]||'').trim(),
      remark: (r[13]||'').trim(),
      updatedAt: new Date().toISOString()
    });
    saved++;
  });

  var st = document.getElementById('pipeSheetStatus');
  if (st) st.textContent = '✅ บันทึก ' + saved + ' รายการ';
  toast('💾 บันทึก Pipeline ' + saved + ' รายการ');
}

// ================================================================
// PASTE FROM EXCEL (Pipeline)
// ================================================================
function _pipeParseTSV(text) {
  var rows = [], row = [], field = '', inQ = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === '\t') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(function(r) { return r.length > 1 || (r[0] && r[0].trim()); });
}

function _pipeDateFromPaste(s) {
  s = (s || '').toString().trim();
  if (!s || s === '-') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var p = s.split('/');
  if (p.length === 3) {
    var y = p[2].length === 2 ? '20' + p[2] : p[2];
    return y + '-' + ('' + p[1]).padStart(2, '0') + '-' + ('' + p[0]).padStart(2, '0');
  }
  return '';
}

function showPastePipelineM() {
  var h = '<div style="max-width:640px">';
  h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:4px">ก็อปช่วงข้อมูลจาก Excel แล้ววางที่นี่ — เพิ่มใหม่ทุก row (ไม่ UPSERT)</p>';
  h += '<p style="font-size:.75rem;color:var(--text3);margin-bottom:8px">ลำดับคอลัมน์: <strong>Register Date | Project Name | End User TH | End User EN | Unit type | Dealer Name | DJI Dealer | Project Revenue | Model | M3M Qty | M4T Qty | M4E Qty | Dock3 Qty | M4TD Qty | M400 Qty | Forecast Amount | Real Amount | TOR | Bidding Date | Forecast Month | Shipment Date | Remark | Letter | Status | Duplicate | Update 1–6 | Sale | DISPLAY</strong></p>';
  h += '<textarea id="pastePipeTa" style="width:100%;height:220px;font-size:12px;font-family:monospace;border:1px solid var(--border);border-radius:8px;padding:8px;resize:vertical;background:var(--bg2);color:var(--text)" placeholder="วางข้อมูลจาก Excel ที่นี่..."></textarea>';
  h += '<div style="display:flex;gap:8px;margin-top:10px">';
  h += '<button class="btn bp" style="flex:1" onclick="doPastePipeline()">📥 นำเข้า</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '</div></div>';
  openM('📋 วางข้อมูล Pipeline จาก Excel', h);
}

function doPastePipeline() {
  var ta = document.getElementById('pastePipeTa');
  if (!ta) return;
  var rows = _pipeParseTSV(ta.value.trim());
  if (!rows.length) { toast('⚠️ ไม่พบข้อมูล'); return; }

  var dealers = ST.getAll('dealers');
  var dealerByName = {};
  dealers.forEach(function(d) { if (d.name) dealerByName[d.name.trim().toLowerCase()] = d; });

  // col 9-14: M3M, M4T, M4E, Dock3, M4TD, M400
  var modelCols = [
    { idx: 9,  model: 'Matrice 3M' },
    { idx: 10, model: 'Matrice 4T' },
    { idx: 11, model: 'Matrice 4E' },
    { idx: 12, model: 'Dock 3' },
    { idx: 13, model: 'Matrice 4TD' },
    { idx: 14, model: 'Matrice 400' }
  ];

  var added = 0, skipped = 0;
  rows.forEach(function(c) {
    var projectName = (c[1] || '').trim();
    if (!projectName) { skipped++; return; }

    var dealerName = (c[5] || '').trim();
    var dealer = dealerByName[dealerName.toLowerCase()];

    var items = [];
    modelCols.forEach(function(m) {
      var qty = parseInt(c[m.idx]) || 0;
      if (qty > 0) items.push({ model: m.model, qty: qty });
    });

    var statusRaw = (c[23] || '').trim();
    var status = (typeof _csvStatusToId === 'function') ? _csvStatusToId(statusRaw) : 'prospect';
    if (!status) status = 'prospect';

    var pipeData = {
      registerDate: _pipeDateFromPaste(c[0]),
      projectName: projectName,
      endUserTH: (c[2] || '').trim(),
      endUserEN: (c[3] || '').trim(),
      unitType: (c[4] || '').trim(),
      dealerId: dealer ? dealer.id : '',
      djiDealer: (c[6] || '').trim(),
      projectRevenue: parseFloat(c[7]) || 0,
      items: items,
      model: items[0] ? items[0].model : '',
      modelQty: items[0] ? items[0].qty : 1,
      forecastAmount: parseFloat(c[15]) || 0,
      realAmount: parseFloat(c[16]) || 0,
      tor: (c[17] || '').trim(),
      biddingDate: _pipeDateFromPaste(c[18]),
      // c[19] = Forecast Month (calculated, skip)
      shipmentDate: _pipeDateFromPaste(c[20]),
      remark: (c[21] || '').trim(),
      appointmentLetter: (c[22] || '').trim(),
      status: status,
      recurring: (c[24] || '').trim().toLowerCase() === 'yes',
      saleName: (c[31] || '').trim(),
      sheetDisplay: (c[32] || 'Show').trim() || 'Show',
      nextAction: '', followupDate: ''
    };

    var pipe = ST.add('pipeline', pipeData);
    added++;

    for (var u = 0; u < 6; u++) {
      var upd = (c[25 + u] || '').trim();
      if (upd) ST.add('pipeLog', { pipeId: pipe.id, type: 'note', content: upd, date: pipeData.registerDate || new Date().toISOString() });
    }
  });

  closeMForce();
  toast('✅ นำเข้าแล้ว: ' + added + ' โครงการ' + (skipped ? ' (ข้าม ' + skipped + ')' : ''));
  render();
}