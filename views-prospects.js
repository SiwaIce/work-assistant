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

  var h = '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;align-items:center">';
  h += '<div class="btn bsm ' + (prospectFilterStage === 'all' ? 'bp' : 'bo') + '" onclick="prospectFilterStage=\'all\';render()">ทั้งหมด (' + counts.all + ')</div>';
  PROSPECT_STAGES.forEach(function(s) {
    h += '<div class="btn bsm ' + (prospectFilterStage === s.k ? 'bp' : 'bo') + '" onclick="prospectFilterStage=\'' + s.k + '\';render()">' + s.icon + ' ' + s.label + ' (' + counts[s.k] + ')</div>';
  });
  h += '<div class="btn bsm ' + (prospectFilterStage === 'closed' ? 'bp' : 'bo') + '" onclick="prospectFilterStage=\'closed\';render()">✕ ปิด (' + counts.closed + ')</div>';
  h += '<div style="flex:1"></div>';
  h += '<button class="btn" style="background:#22c55e" onclick="showAddProspectM()">➕ เพิ่ม Lead</button>';
  h += '</div>';

  var shown = prospectFilterStage === 'all' ? prospects : prospects.filter(function(p) { return p.stage === prospectFilterStage; });
  shown = shown.slice().sort(function(a, b) { return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''); });

  if (!shown.length) {
    h += '<div class="vp-empty">ยังไม่มี Lead ในกลุ่มนี้ — กด "➕ เพิ่ม Lead" เพื่อเริ่มบันทึก</div>';
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
    h += '<div style="display:flex;align-items:center;margin-bottom:14px">';
    PROSPECT_STAGES.forEach(function(s, i) {
      var done = i <= stageIdx;
      var current = i === stageIdx;
      var bg = done ? (current ? '#3b82f6' : '#22c55e') : '#334155';
      var fg = done ? (current ? '#fff' : '#06210f') : '#94a3b8';
      h += '<div style="text-align:center;flex:1">';
      h += '<div style="width:22px;height:22px;border-radius:50%;background:' + bg + ';color:' + fg + ';font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 4px">' + (done && !current ? '✓' : (i + 1)) + '</div>';
      h += '<div style="font-size:9px;color:' + (current ? 'var(--text)' : 'var(--text2)') + ';font-weight:' + (current ? '700' : '400') + '">' + s.label + '</div>';
      h += '</div>';
      if (i < PROSPECT_STAGES.length - 1) h += '<div style="flex:1;height:2px;background:' + (i < stageIdx ? '#22c55e' : '#334155') + '"></div>';
    });
    h += '</div>';
  } else {
    h += '<div style="background:rgba(148,163,184,.15);border-radius:8px;padding:8px;font-size:12px;color:#94a3b8;margin-bottom:14px">✕ Lead นี้ปิดแล้ว (ไม่สนใจ)</div>';
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
    if (stageIdx < PROSPECT_STAGES.length - 1) {
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

function showProspectAdvanceM(id, newStage) {
  var info = _prospectStageInfo(newStage);
  var h = '<div style="max-width:360px">';
  h += '<div class="fm-group"><label>📝 บันทึกหมายเหตุ (ไม่บังคับ)</label><textarea id="pr_advance_note" rows="3" class="fm-input" placeholder="เช่น คุยแล้วสนใจ Dock 3"></textarea></div>';
  h += '<div class="fm-actions"><button class="btn btn-blue" onclick="advanceProspectStage(\'' + id + '\',\'' + newStage + '\',document.getElementById(\'pr_advance_note\').value)">' + info.icon + ' เลื่อนเป็น ' + info.label + '</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
  openM('➡️ เลื่อน Stage', h);
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
  toast('➡️ เลื่อน stage แล้ว');
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
