// ================================================================
// PROSPECT TRACKER — ลงข้อมูล Lead ลูกค้าไว้ก่อน พร้อม stage tracking
// (แยกจาก "Lead Forms" ในเมนูเครื่องมือ ซึ่งเป็นฟอร์มเก็บข้อมูลหน้างาน/อีเวนต์)
// ================================================================

var PROSPECT_STAGES = [
  { k: 'new',        icon: '🆕', label: 'ใหม่' },
  { k: 'contacted',  icon: '📧', label: 'ติดต่อแล้ว' },
  { k: 'scheduled',  icon: '📅', label: 'นัดวันเข้าพบ' },
  { k: 'visited',    icon: '🤝', label: 'เข้าพบแล้ว' },
  { k: 'interested', icon: '⭐', label: 'สนใจเป็น Partner' },
  { k: 'converted',  icon: '🏪', label: 'แปลงเป็น Dealer' }
];
var PROSPECT_STAGE_COLOR = {
  new: '#60a5fa', contacted: '#60a5fa', scheduled: '#fbbf24',
  visited: '#fb923c', interested: '#c084fc', converted: '#4ade80', closed: '#94a3b8'
};
var prospectFilterStage = 'all';
var prospectViewMode = 'card'; // 'card' | 'table' | 'dash'

function _prospectStageInfo(k) {
  return PROSPECT_STAGES.find(function(s) { return s.k === k; }) ||
    (k === 'closed' ? { k: 'closed', icon: '✕', label: 'ปิด (ไม่สนใจ)' } : PROSPECT_STAGES[0]);
}

function getProspects() {
  var saved = localStorage.getItem('v7_prospects');
  if (!saved) return [];
  try { return JSON.parse(saved) || []; } catch(e) { return []; }
}

function saveProspects(list) {
  localStorage.setItem('v7_prospects', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('prospects', list);
}

function getProspect(id) {
  var list = getProspects();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

// ---------------- หน้า list หลัก ----------------
function rProspectList(el) {
  document.getElementById('pgT').textContent = '🆕 Lead ที่ติดตาม';
  var prospects = getProspects();

  var counts = { all: prospects.length, closed: 0 };
  PROSPECT_STAGES.forEach(function(s) { counts[s.k] = 0; });
  prospects.forEach(function(p) {
    if (p.stage === 'closed') counts.closed++;
    else if (counts[p.stage] !== undefined) counts[p.stage]++;
  });

  // toolbar row: stage filters + view toggle + add button
  var h = '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">';
  if (prospectViewMode !== 'dash') {
    h += '<div class="btn bsm ' + (prospectFilterStage === 'all' ? 'bp' : 'bo') + '" onclick="prospectFilterStage=\'all\';render()">ทั้งหมด (' + counts.all + ')</div>';
    PROSPECT_STAGES.forEach(function(s) {
      h += '<div class="btn bsm ' + (prospectFilterStage === s.k ? 'bp' : 'bo') + '" onclick="prospectFilterStage=\'' + s.k + '\';render()">' + s.icon + ' ' + s.label + ' (' + counts[s.k] + ')</div>';
    });
    h += '<div class="btn bsm ' + (prospectFilterStage === 'closed' ? 'bp' : 'bo') + '" onclick="prospectFilterStage=\'closed\';render()">✕ ปิด (' + counts.closed + ')</div>';
  }
  h += '<div style="flex:1"></div>';
  // view mode toggle
  h += '<div style="display:flex;gap:4px;background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:8px;padding:3px">';
  h += '<div class="btn bsm ' + (prospectViewMode === 'card' ? 'bp' : '') + '" style="padding:4px 10px" onclick="prospectViewMode=\'card\';render()" title="Card View">🗂️</div>';
  h += '<div class="btn bsm ' + (prospectViewMode === 'table' ? 'bp' : '') + '" style="padding:4px 10px" onclick="prospectViewMode=\'table\';render()" title="Table View">📋</div>';
  h += '<div class="btn bsm ' + (prospectViewMode === 'dash' ? 'bp' : '') + '" style="padding:4px 10px" onclick="prospectViewMode=\'dash\';render()" title="Dashboard">📊</div>';
  h += '</div>';
  h += '<button class="btn" style="background:#22c55e" onclick="showAddProspectM()">➕ เพิ่ม Lead</button>';
  h += '</div>';

  if (prospectViewMode === 'dash') {
    h += _prospectDashboardHtml(prospects, counts);
    el.innerHTML = h;
    return;
  }

  var shown = prospectFilterStage === 'all' ? prospects : prospects.filter(function(p) { return p.stage === prospectFilterStage; });
  shown = shown.slice().sort(function(a, b) { return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''); });

  if (!shown.length) {
    h += '<div class="vp-empty">ยังไม่มี Lead ในกลุ่มนี้ — กด "➕ เพิ่ม Lead" เพื่อเริ่มบันทึก</div>';
  } else if (prospectViewMode === 'table') {
    h += _prospectTableHtml(shown);
  } else {
    shown.forEach(function(p) { h += _prospectCardHtml(p); });
  }

  el.innerHTML = h;
}

function _prospectCardHtml(p) {
  var info = _prospectStageInfo(p.stage);
  var color = PROSPECT_STAGE_COLOR[p.stage] || '#60a5fa';
  var h = '<div onclick="showProspectDetailM(\'' + p.id + '\')" style="display:flex;justify-content:space-between;align-items:center;background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-left:3px solid ' + color + ';border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer">';
  h += '<div>';
  h += '<div style="font-size:13px;font-weight:700">' + sanitize(p.companyName || '-') + '</div>';
  h += '<div style="font-size:11px;color:var(--text2);margin-top:2px">';
  var bits = [];
  if (p.contactName) bits.push('👤 ' + sanitize(p.contactName));
  if (p.phone) bits.push('📞 ' + sanitize(p.phone));
  if (p.source) bits.push('🌐 ' + sanitize(p.source));
  h += bits.join(' · ');
  h += '</div></div>';
  h += '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">';
  h += '<span style="background:' + color + '22;color:' + color + ';font-size:10px;padding:3px 9px;border-radius:6px;white-space:nowrap">' + info.icon + ' ' + info.label + '</span>';
  h += '<span style="color:var(--text2)">›</span>';
  h += '</div></div>';
  return h;
}

// ---------------- Table View ----------------
function _prospectTableHtml(shown) {
  var h = '<div style="overflow-x:auto;border:1px solid var(--border,#334155);border-radius:10px">';
  h += '<table style="width:100%;border-collapse:collapse;font-size:12.5px">';
  h += '<thead><tr style="background:var(--card,#1e293b);border-bottom:1px solid var(--border,#334155)">';
  h += '<th style="padding:8px 10px;text-align:center;color:var(--text2);font-weight:500;font-size:11px;width:36px">#</th>';
  h += '<th style="padding:8px 10px;text-align:left;color:var(--text2);font-weight:500;font-size:11px">บริษัท</th>';
  h += '<th style="padding:8px 10px;text-align:left;color:var(--text2);font-weight:500;font-size:11px">ผู้ติดต่อ</th>';
  h += '<th style="padding:8px 10px;text-align:left;color:var(--text2);font-weight:500;font-size:11px">เบอร์</th>';
  h += '<th style="padding:8px 10px;text-align:left;color:var(--text2);font-weight:500;font-size:11px">ที่มา</th>';
  h += '<th style="padding:8px 10px;text-align:left;color:var(--text2);font-weight:500;font-size:11px">Stage</th>';
  h += '<th style="padding:8px 10px;text-align:left;color:var(--text2);font-weight:500;font-size:11px">อัปเดต</th>';
  h += '</tr></thead><tbody>';
  shown.forEach(function(p, idx) {
    var info = _prospectStageInfo(p.stage);
    var color = PROSPECT_STAGE_COLOR[p.stage] || '#60a5fa';
    var updStr = p.updatedAt ? _prospectDaysAgo(p.updatedAt) : '-';
    h += '<tr onclick="showProspectDetailM(\'' + p.id + '\')" style="border-bottom:1px solid var(--border,#334155);cursor:pointer" onmouseover="this.style.background=\'var(--hover,rgba(255,255,255,.04))\'" onmouseout="this.style.background=\'\'">';
    h += '<td style="padding:8px 10px;text-align:center;color:var(--text2);font-size:11px">' + (idx + 1) + '</td>';
    h += '<td style="padding:8px 10px;font-weight:600;font-size:13px">' + sanitize(p.companyName || '-') + '</td>';
    h += '<td style="padding:8px 10px;font-size:12px;color:var(--text2)">' + sanitize(p.contactName || '-') + '</td>';
    h += '<td style="padding:8px 10px;font-size:12px">';
    if (p.phone) {
      h += sanitize(p.phone) + ' <button onclick="event.stopPropagation();copyToClip(\'' + sanitize(p.phone).replace(/'/g,"\\'") + '\')" style="background:transparent;border:none;cursor:pointer;color:var(--accent,#60a5fa);font-size:11px;padding:0 2px">📋</button>';
    } else { h += '<span style="color:var(--text2)">-</span>'; }
    h += '</td>';
    h += '<td style="padding:8px 10px;font-size:12px;color:var(--text2)">' + sanitize(p.source || '-') + '</td>';
    h += '<td style="padding:8px 10px"><span style="background:' + color + '22;color:' + color + ';font-size:10px;padding:3px 8px;border-radius:6px;white-space:nowrap">' + info.icon + ' ' + info.label + '</span></td>';
    h += '<td style="padding:8px 10px;font-size:11px;color:var(--text2)">' + updStr + '</td>';
    h += '</tr>';
  });
  h += '</tbody></table>';
  h += '<div style="padding:6px 12px;font-size:11px;color:var(--text2);border-top:1px solid var(--border,#334155)">' + shown.length + ' รายการ · คลิกแถวเพื่อดูรายละเอียด</div>';
  h += '</div>';
  return h;
}

function _prospectDaysAgo(iso) {
  if (!iso) return '-';
  var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return 'วันนี้';
  if (diff === 1) return 'เมื่อวาน';
  if (diff < 30) return diff + ' วันที่แล้ว';
  if (diff < 365) return Math.floor(diff / 30) + ' เดือนที่แล้ว';
  return Math.floor(diff / 365) + ' ปีที่แล้ว';
}

// ---------------- Dashboard ----------------
function _prospectDashboardHtml(prospects, counts) {
  var active = prospects.filter(function(p) { return p.stage !== 'closed' && p.stage !== 'converted'; });
  var converted = counts['converted'] || 0;
  var closed = counts['closed'] || 0;
  var total = prospects.length;

  // source breakdown
  var srcMap = {};
  prospects.forEach(function(p) {
    var s = p.source || 'ไม่ระบุ';
    srcMap[s] = (srcMap[s] || 0) + 1;
  });
  var srcArr = Object.keys(srcMap).map(function(k) { return { label: k, n: srcMap[k] }; });
  srcArr.sort(function(a, b) { return b.n - a.n; });

  // recent activity (last 6 updates)
  var recent = prospects.slice().sort(function(a, b) {
    return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
  }).slice(0, 6);

  // funnel — count per ordered stage
  var stageOrder = PROSPECT_STAGES.map(function(s) { return s.k; });
  var maxFunnel = Math.max.apply(null, PROSPECT_STAGES.map(function(s) { return counts[s.k] || 0; })) || 1;

  // conversion step-to-step
  var convRates = [];
  for (var i = 0; i < PROSPECT_STAGES.length - 1; i++) {
    var fromN = counts[PROSPECT_STAGES[i].k] || 0;
    var toN = counts[PROSPECT_STAGES[i + 1].k] || 0;
    // cumulative: how many reached "to" out of those that reached "from"
    var fromCum = 0, toCum = 0;
    for (var j = i; j < PROSPECT_STAGES.length; j++) fromCum += (counts[PROSPECT_STAGES[j].k] || 0);
    for (var j2 = i + 1; j2 < PROSPECT_STAGES.length; j2++) toCum += (counts[PROSPECT_STAGES[j2].k] || 0);
    toCum += converted;
    fromCum += converted;
    var rate = fromCum > 0 ? Math.round(toCum / fromCum * 100) : 0;
    convRates.push({ from: PROSPECT_STAGES[i].label, to: PROSPECT_STAGES[i + 1].label, rate: rate });
  }

  var srcColors = ['#3b82f6','#8b5cf6','#f59e0b','#22c55e','#ec4899','#94a3b8'];

  var h = '';

  // metric summary row
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">';
  var metrics = [
    { label: 'Lead ทั้งหมด', val: total, sub: '' },
    { label: 'กำลังติดตาม', val: active.length, sub: 'ยังไม่ปิด', color: '#60a5fa' },
    { label: 'แปลงเป็น Dealer', val: converted, sub: total > 0 ? Math.round(converted / total * 100) + '% conversion' : '', color: '#4ade80' },
    { label: 'ปิด / ไม่สนใจ', val: closed, sub: total > 0 ? Math.round(closed / total * 100) + '% lost' : '', color: '#fb923c' }
  ];
  metrics.forEach(function(m) {
    h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px 14px">';
    h += '<div style="font-size:11px;color:var(--text2);margin-bottom:4px">' + m.label + '</div>';
    h += '<div style="font-size:24px;font-weight:700;color:' + (m.color || 'var(--text)') + ';line-height:1">' + m.val + '</div>';
    if (m.sub) h += '<div style="font-size:11px;color:var(--text2);margin-top:3px">' + m.sub + '</div>';
    h += '</div>';
  });
  h += '</div>';

  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">';

  // funnel
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px">';
  h += '<div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:12px;letter-spacing:.3px">LEAD FUNNEL</div>';
  PROSPECT_STAGES.forEach(function(s) {
    var n = counts[s.k] || 0;
    var barW = Math.max(4, Math.round(n / maxFunnel * 100));
    var color = PROSPECT_STAGE_COLOR[s.k] || '#60a5fa';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">';
    h += '<div style="font-size:11px;color:var(--text2);width:100px;flex-shrink:0;white-space:nowrap">' + s.icon + ' ' + s.label + '</div>';
    h += '<div style="flex:1;background:rgba(255,255,255,.06);border-radius:4px;height:18px;overflow:hidden">';
    h += '<div style="width:' + barW + '%;height:100%;background:' + color + '33;border-right:2px solid ' + color + ';display:flex;align-items:center;padding-left:6px;font-size:10px;color:' + color + ';font-weight:600">' + (n > 0 ? n : '') + '</div>';
    h += '</div>';
    h += '<div style="font-size:11px;color:var(--text2);width:20px;text-align:right">' + n + '</div>';
    h += '</div>';
  });
  h += '</div>';

  // source breakdown
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px">';
  h += '<div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:12px;letter-spacing:.3px">ที่มาของ LEAD</div>';
  if (srcArr.length === 0) {
    h += '<div style="font-size:12px;color:var(--text2)">ยังไม่มีข้อมูล</div>';
  } else {
    var maxSrc = srcArr[0].n;
    srcArr.slice(0, 6).forEach(function(s, i) {
      var pct = total > 0 ? Math.round(s.n / total * 100) : 0;
      var barW = Math.max(4, Math.round(s.n / maxSrc * 100));
      var color = srcColors[i % srcColors.length];
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">';
      h += '<div style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0"></div>';
      h += '<div style="font-size:11px;color:var(--text2);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + sanitize(s.label) + '</div>';
      h += '<div style="width:70px;background:rgba(255,255,255,.06);border-radius:4px;height:6px;flex-shrink:0"><div style="width:' + barW + '%;height:6px;border-radius:4px;background:' + color + '"></div></div>';
      h += '<div style="font-size:11px;color:var(--text2);width:26px;text-align:right">' + pct + '%</div>';
      h += '</div>';
    });
  }
  h += '</div>';
  h += '</div>';

  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';

  // conversion rate
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px">';
  h += '<div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:12px;letter-spacing:.3px">STAGE CONVERSION</div>';
  convRates.forEach(function(c) {
    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border,#334155)">';
    h += '<div style="font-size:11px;color:var(--text2)">' + c.from + ' → ' + c.to + '</div>';
    var rcolor = c.rate >= 70 ? '#4ade80' : c.rate >= 40 ? '#fbbf24' : '#fb923c';
    h += '<div style="font-size:13px;font-weight:700;color:' + rcolor + '">' + c.rate + '%</div>';
    h += '</div>';
  });
  if (total > 0) {
    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">';
    h += '<div style="font-size:11px;color:var(--text2)">Overall (→ Dealer)</div>';
    h += '<div style="font-size:13px;font-weight:700;color:#4ade80">' + Math.round(converted / total * 100) + '%</div>';
    h += '</div>';
  }
  h += '</div>';

  // recent activity
  h += '<div style="background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:14px">';
  h += '<div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:12px;letter-spacing:.3px">อัปเดตล่าสุด</div>';
  if (recent.length === 0) {
    h += '<div style="font-size:12px;color:var(--text2)">ยังไม่มีข้อมูล</div>';
  } else {
    recent.forEach(function(p) {
      var info = _prospectStageInfo(p.stage);
      var color = PROSPECT_STAGE_COLOR[p.stage] || '#60a5fa';
      var ago = _prospectDaysAgo(p.updatedAt || p.createdAt);
      h += '<div onclick="showProspectDetailM(\'' + p.id + '\')" style="display:flex;gap:8px;margin-bottom:8px;cursor:pointer;align-items:flex-start">';
      h += '<div style="width:8px;height:8px;border-radius:50%;background:' + color + ';margin-top:4px;flex-shrink:0"></div>';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(p.companyName || '-') + '</div>';
      h += '<div style="font-size:11px;color:var(--text2)">' + info.icon + ' ' + info.label + ' · ' + ago + '</div>';
      h += '</div></div>';
    });
  }
  h += '</div>';
  h += '</div>';

  return h;
}

// ---------------- เพิ่ม / แก้ไข ----------------
function showAddProspectM(editId) {
  var p = editId ? getProspect(editId) : null;
  var h = '<div style="max-width:420px">';
  h += '<div class="fm-group"><label>🏢 ชื่อบริษัท *</label><input type="text" id="pr_company" class="fm-input" value="' + sanitize(p ? p.companyName : '') + '"></div>';
  h += '<div class="fr"><div class="fg"><label>👤 ผู้ติดต่อ</label><input type="text" id="pr_contact" class="fm-input" value="' + sanitize(p ? (p.contactName || '') : '') + '"></div>';
  h += '<div class="fg"><label>📞 เบอร์</label><input type="text" id="pr_phone" class="fm-input" value="' + sanitize(p ? (p.phone || '') : '') + '"></div></div>';
  h += '<div class="fr"><div class="fg"><label>✉️ อีเมล</label><input type="email" id="pr_email" class="fm-input" value="' + sanitize(p ? (p.email || '') : '') + '"></div>';
  h += '<div class="fg"><label>📍 Location</label><input type="text" id="pr_location" class="fm-input" value="' + sanitize(p ? (p.location || '') : '') + '" placeholder="ที่อยู่ หรือลิงก์ Google Map"></div></div>';
  h += '<div class="fm-group"><label>🌐 ที่มา (ไม่บังคับ)</label><input type="text" id="pr_source" class="fm-input" value="' + sanitize(p ? (p.source || '') : '') + '" placeholder="เช่น Facebook Ads, Roadshow, Referral"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="pr_note" rows="2" class="fm-input" placeholder="เช่น สนใจ Dock 3 พื้นที่เกษตร">' + sanitize(p ? (p.note || '') : '') + '</textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveProspect(\'' + (editId || '') + '\')">💾 บันทึก</button>';
  if (editId) h += '<button class="btn bd" onclick="removeProspect(\'' + editId + '\')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM(editId ? '✏️ แก้ไข Lead' : '➕ เพิ่ม Lead ใหม่', h);
}

function saveProspect(editId) {
  var company = (document.getElementById('pr_company').value || '').trim();
  if (!company) { toast('กรุณาใส่ชื่อบริษัท'); return; }
  var data = {
    companyName: company,
    contactName: (document.getElementById('pr_contact').value || '').trim(),
    phone: (document.getElementById('pr_phone').value || '').trim(),
    email: (document.getElementById('pr_email').value || '').trim(),
    location: (document.getElementById('pr_location').value || '').trim(),
    source: (document.getElementById('pr_source').value || '').trim(),
    note: (document.getElementById('pr_note').value || '').trim(),
    updatedAt: new Date().toISOString()
  };

  var list = getProspects();
  if (editId) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === editId) { list[i] = Object.assign({}, list[i], data); break; }
    }
  } else {
    data.id = 'pr_' + Date.now();
    data.stage = 'new';
    data.createdAt = data.updatedAt;
    data.history = [{ stage: 'new', date: _td(), note: data.source ? ('สร้างจาก ' + data.source) : 'สร้าง Lead ใหม่' }];
    list.push(data);
  }

  saveProspects(list);
  toast(editId ? '💾 แก้ไขแล้ว' : '🆕 เพิ่ม Lead แล้ว');
  closeMForce();
  render();
}

function removeProspect(id) {
  var list = getProspects().filter(function(p) { return p.id !== id; });
  saveProspects(list);
  if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('prospects', id);
  toast('🗑️ ลบแล้ว');
  closeMForce();
  render();
}

// ---------------- รายละเอียด + step tracker ----------------
function showProspectDetailM(id) {
  var p = getProspect(id);
  if (!p) return;
  var stageIdx = PROSPECT_STAGES.findIndex(function(s) { return s.k === p.stage; });
  var isClosed = p.stage === 'closed';
  var isConverted = p.stage === 'converted';

  var h = '<div style="max-width:460px">';
  h += '<div style="font-weight:700;font-size:15px">' + sanitize(p.companyName) + '</div>';
  h += '<div style="font-size:11px;color:var(--text2);margin-bottom:14px">';
  var bits = [];
  if (p.contactName) bits.push('👤 ' + sanitize(p.contactName));
  if (p.phone) bits.push('📞 ' + sanitize(p.phone) + ' <button style="background:transparent;border:none;color:var(--accent);cursor:pointer" onclick="copyToClip(\'' + sanitize(p.phone).replace(/'/g, "\\'") + '\')">📋</button>');
  if (p.email) bits.push('✉️ ' + sanitize(p.email));
  if (p.location) bits.push('📍 ' + sanitize(p.location));
  h += bits.join(' · ') + '</div>';

  if (!isClosed) {
    h += '<div style="display:flex;align-items:center;margin-bottom:6px">';
    PROSPECT_STAGES.forEach(function(s, i) {
      var done = i <= stageIdx;
      var current = i === stageIdx;
      var bg = done ? (current ? '#3b82f6' : '#22c55e') : '#334155';
      var fg = done ? (current ? '#fff' : '#06210f') : '#94a3b8';
      h += '<div style="text-align:center;flex:1;cursor:pointer" onclick="showProspectAdvanceM(\'' + p.id + '\',\'' + s.k + '\')" title="กดเพื่อเปลี่ยนเป็น ' + sanitize(s.label) + '">';
      h += '<div style="width:22px;height:22px;border-radius:50%;background:' + bg + ';color:' + fg + ';font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 4px">' + (done && !current ? '✓' : (i + 1)) + '</div>';
      h += '<div style="font-size:9px;color:' + (current ? 'var(--text)' : 'var(--text2)') + ';font-weight:' + (current ? '700' : '400') + '">' + s.label + '</div>';
      h += '</div>';
      if (i < PROSPECT_STAGES.length - 1) h += '<div style="flex:1;height:2px;background:' + (i < stageIdx ? '#22c55e' : '#334155') + '"></div>';
    });
    h += '</div>';
    h += '<div style="font-size:9.5px;color:var(--text2);margin-bottom:14px">💡 กดที่จุดไหนก็ได้เพื่อเปลี่ยน stage — ย้อนกลับได้ ไม่จำเป็นต้องเรียงตามลำดับ</div>';
  } else {
    h += '<div style="background:rgba(148,163,184,.15);border-radius:8px;padding:8px;font-size:12px;color:#94a3b8;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">✕ Lead นี้ปิดแล้ว (ไม่สนใจ)<button class="btn bsm bo" onclick="reopenProspect(\'' + p.id + '\')">↩️ เปิดกลับมาใหม่</button></div>';
  }

  h += '<div style="background:var(--bg,#0f172a);border-radius:8px;padding:8px;margin-bottom:12px">';
  h += '<div style="font-size:10px;color:var(--text2);margin-bottom:6px">ประวัติ</div>';
  (p.history || []).slice().reverse().forEach(function(hist) {
    var hi = _prospectStageInfo(hist.stage);
    h += '<div style="font-size:11px;margin-bottom:3px">' + hi.icon + ' ' + fDShort(hist.date) + ' — ' + (hist.note ? sanitize(hist.note) : hi.label) + '</div>';
  });
  h += '</div>';

  h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  if (!isClosed && !isConverted) {
    h += '<button class="btn bsm bp" onclick="closeM();showAddVisitPlanFromProspect(\'' + p.id + '\')">📅 สร้างนัด Visit Plan</button>';
    if (stageIdx > 0) {
      var prev = PROSPECT_STAGES[stageIdx - 1];
      h += '<button class="btn bsm bo" onclick="showProspectAdvanceM(\'' + p.id + '\',\'' + prev.k + '\')">⬅️ ย้อนกลับเป็น "' + prev.label + '"</button>';
    }
    if (stageIdx >= 0 && stageIdx < PROSPECT_STAGES.length - 1) {
      var next = PROSPECT_STAGES[stageIdx + 1];
      h += '<button class="btn bsm bo" onclick="showProspectAdvanceM(\'' + p.id + '\',\'' + next.k + '\')">➡️ เลื่อนเป็น "' + next.label + '"</button>';
    }
    if (p.stage === 'interested') h += '<button class="btn bsm" style="background:#22c55e" onclick="convertProspectToDealer(\'' + p.id + '\')">🏪 แปลงเป็น Dealer</button>';
  }
  if (isConverted && p.dealerId) h += '<button class="btn bsm bo" onclick="closeM();go(\'dealerDetail\',{dealerId:\'' + p.dealerId + '\'})">🏪 ดู Dealer →</button>';
  h += '<button class="btn bsm bo" onclick="closeM();showAddProspectM(\'' + p.id + '\')">✏️ แก้ไขข้อมูล</button>';
  if (!isClosed && !isConverted) h += '<button class="btn bsm" style="border:1px solid #ef4444;color:#f87171;background:transparent" onclick="closeProspectLost(\'' + p.id + '\')">✕ ปิด Lead (ไม่สนใจ)</button>';
  h += '</div></div>';

  openM('🆕 รายละเอียด Lead', h);
}

// ใช้เปลี่ยน stage ได้ทั้งสองทาง (เลื่อนไปข้างหน้า หรือย้อนกลับ) — กดจุดไหนใน tracker หรือปุ่มลัดก็เรียกอันนี้เหมือนกัน
function showProspectAdvanceM(id, newStage) {
  var p = getProspect(id);
  if (!p || p.stage === newStage) return; // กดจุดเดิม — ไม่ต้องทำอะไร
  var order = PROSPECT_STAGES.map(function(s) { return s.k; });
  var isBack = order.indexOf(newStage) < order.indexOf(p.stage);
  var info = _prospectStageInfo(newStage);
  var h = '<div style="max-width:360px">';
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">จาก "' + _prospectStageInfo(p.stage).label + '" → "' + info.label + '"' + (isBack ? ' (ย้อนกลับ)' : '') + '</div>';
  h += '<div class="fm-group"><label>📝 บันทึกหมายเหตุ (ไม่บังคับ)</label><textarea id="pr_advance_note" rows="3" class="fm-input" placeholder="เช่น กดผิด ขอย้อนกลับ"></textarea></div>';
  h += '<div class="fm-actions"><button class="btn btn-blue" onclick="advanceProspectStage(\'' + id + '\',\'' + newStage + '\',document.getElementById(\'pr_advance_note\').value)">' + info.icon + ' เปลี่ยนเป็น ' + info.label + '</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
  openM((isBack ? '⬅️' : '➡️') + ' เปลี่ยน Stage', h);
}

function advanceProspectStage(id, newStage, note) {
  var list = getProspects();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i].stage = newStage;
      list[i].updatedAt = new Date().toISOString();
      list[i].history = list[i].history || [];
      list[i].history.push({ stage: newStage, date: _td(), note: (note || '').trim() });
      break;
    }
  }
  saveProspects(list);
  closeMForce();
  toast('💾 เปลี่ยน stage แล้ว');
  render();
}

// เปิด Lead ที่ปิดไปแล้วกลับมาใหม่ — ย้อนไปยัง stage ล่าสุดก่อนปิด (ถ้าหาไม่เจอ กลับไป "ใหม่")
function reopenProspect(id) {
  var list = getProspects();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      var pr = list[i];
      var hist = pr.history || [];
      var lastStage = 'new';
      for (var j = hist.length - 1; j >= 0; j--) {
        if (hist[j].stage !== 'closed') { lastStage = hist[j].stage; break; }
      }
      pr.stage = lastStage;
      pr.updatedAt = new Date().toISOString();
      pr.history = hist;
      pr.history.push({ stage: lastStage, date: _td(), note: 'เปิด Lead กลับมาใหม่' });
      break;
    }
  }
  saveProspects(list);
  closeMForce();
  toast('↩️ เปิด Lead กลับมาแล้ว');
  render();
}

function closeProspectLost(id) {
  if (!confirm('ปิด Lead นี้ (ไม่สนใจ)?')) return;
  advanceProspectStage(id, 'closed', 'ปิด — ไม่สนใจ');
}

// แปลง Prospect ที่สนใจเป็น Partner ให้เป็น Dealer จริง — prefill ฟอร์ม Dealer จากข้อมูล Lead
function convertProspectToDealer(id) {
  var p = getProspect(id);
  if (!p) return;
  if (typeof showDealerM !== 'function') { toast('ฟังก์ชันเพิ่ม Dealer ไม่พบ'); return; }
  closeMForce();
  showDealerM();
  setTimeout(function() {
    var nameEl = document.getElementById('fd_name');
    var contactEl = document.getElementById('fd_contact');
    var mapEl = document.getElementById('fd_map');
    if (nameEl) nameEl.value = p.companyName || '';
    if (contactEl) {
      var lines = [];
      if (p.contactName) lines.push(p.contactName);
      if (p.phone) lines.push('โทร ' + p.phone);
      if (p.email) lines.push('อีเมล ' + p.email);
      contactEl.value = lines.join(' / ');
    }
    if (mapEl && /^https?:\/\//.test(p.location || '')) mapEl.value = p.location;
  }, 80);
  window._prospectPendingConvertId = id;
}

// เรียกจาก saveDealer() (modals.js) หลังบันทึก Dealer สำเร็จ ถ้ามาจากการแปลง Prospect
function prospectMarkConvertedFromDealer(dealerId) {
  var pid = window._prospectPendingConvertId;
  if (!pid) return;
  window._prospectPendingConvertId = null;
  var list = getProspects();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === pid) {
      list[i].stage = 'converted';
      list[i].dealerId = dealerId;
      list[i].updatedAt = new Date().toISOString();
      list[i].history = list[i].history || [];
      list[i].history.push({ stage: 'converted', date: _td(), note: 'แปลงเป็น Dealer แล้ว' });
      break;
    }
  }
  saveProspects(list);
}

// เปิดฟอร์ม Visit Plan โดยเลือก source "Lead" และดึงข้อมูลจาก Prospect นี้มาให้อัตโนมัติ
function showAddVisitPlanFromProspect(id) {
  if (typeof showAddVisitPlanM !== 'function') { toast('เมนู Visit Plan ไม่พบ'); return; }
  showAddVisitPlanM(_td(), '', '');
  setTimeout(function() {
    if (typeof vpSetSourceType === 'function') vpSetSourceType('lead');
    var sel = document.getElementById('vp_prospect_select');
    if (sel) { sel.value = id; if (typeof vpProspectPicked === 'function') vpProspectPicked(); }
  }, 80);
}
