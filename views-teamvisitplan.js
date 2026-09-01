// ================================================================
// VISIT PLAN ทีม — ตาราง วัน/สัปดาห์/เดือน แชร์กันทั้งทีม แยกจาก Visit Plan ส่วนตัว (v7_visitPlans) เดิม
// เก็บที่ Firestore collection แบน "teamVisitPlans" ตรงๆ (ไม่ผ่าน ST/users/{uid}) เหมือน teamPipeline —
// เป็น source of truth เดียว ไม่ mirror จาก Visit Plan ส่วนตัว กันข้อมูลปนกันตามที่ผู้ใช้กังวล (2026-09-01)
// แต่ละคนแก้ไข/ลบได้เฉพาะแผนของตัวเอง (เช็คด้วย ownerId ฝั่ง client เท่านั้น — เหมือน guest view, ไม่ใช่
// data-layer security จริง แต่ collection นี้ก็ไม่มีข้อมูลอ่อนไหวเทียบเท่า pipeline/dealers อยู่แล้ว)
// ================================================================
var _tvpItems = [];
var _tvpLoading = true;
var _tvpListenerStarted = false;
var tvpView = 'week'; // 'day' | 'week' | 'month'
var tvpAnchor = _td();

function _tvpMyId() {
  if (typeof SALES_MODE !== 'undefined' && SALES_MODE && typeof SALES_ID !== 'undefined') return 'sales_' + SALES_ID;
  return (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.uid : 'anon';
}
function _tvpMyName() {
  if (typeof SALES_MODE !== 'undefined' && SALES_MODE && typeof SALES_PROFILE !== 'undefined' && SALES_PROFILE) return SALES_PROFILE.name;
  return (typeof getConfig === 'function' && getConfig().saleName) || (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.displayName) || 'ฉัน';
}

function _tvpStartListener() {
  if (_tvpListenerStarted) return;
  if (typeof db === 'undefined') { _tvpLoading = false; return; }
  _tvpListenerStarted = true;
  db.collection('teamVisitPlans').onSnapshot(function(snap) {
    var items = [];
    snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; items.push(d); });
    _tvpItems = items;
    _tvpLoading = false;
    if (typeof S !== 'undefined' && S.view === 'teamVisitPlan' && typeof render === 'function') render();
  }, function(err) {
    console.warn('teamVisitPlans listener error:', err);
    _tvpLoading = false;
  });
}

function tvpSave(entry) {
  if (typeof db === 'undefined') { toast('❌ ไม่มีการเชื่อมต่อ Firebase — ใช้งานโหมด Offline อยู่หรือเปล่า?', true); return; }
  var id = entry.id || ('tvp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5));
  var data = {
    ownerId: _tvpMyId(), ownerName: _tvpMyName(), date: entry.date, mode: entry.mode,
    company: entry.company, start: entry.start || '', end: entry.end || '', note: entry.note || '',
    updatedAt: new Date().toISOString()
  };
  db.collection('teamVisitPlans').doc(id).set(data)
    .then(function() { toast(entry.id ? '✅ บันทึกการแก้ไขแล้ว' : '✅ เพิ่มแผนแล้ว'); })
    .catch(function(e) { toast('❌ บันทึกไม่สำเร็จ: ' + e.message, true); });
}

function tvpDelete(id) {
  if (!confirm('🗑️ ลบแผนนี้?')) return;
  db.collection('teamVisitPlans').doc(id).delete()
    .then(function() { toast('🗑️ ลบแล้ว'); closeMForce(); })
    .catch(function(e) { toast('❌ ลบไม่สำเร็จ: ' + e.message, true); });
}

// ---- date helpers (ห้ามใช้ toISOString ตรงนี้ — เลื่อนถอยหลัง 1 วันใน UTC+7 ดู views-kpi.js กรณีเดียวกัน) ----
function _tvpToISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function _tvpAddDays(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return _tvpToISO(d); }
function _tvpAddMonths(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n); return _tvpToISO(d); }
function _tvpStartOfWeek(iso) { var d = new Date(iso + 'T00:00:00'); var dow = d.getDay(); var diff = (dow === 0 ? -6 : 1) - dow; d.setDate(d.getDate() + diff); return _tvpToISO(d); }
function _tvpStartOfMonth(iso) { var d = new Date(iso + 'T00:00:00'); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
var TVP_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
function _tvpDowLabel(iso) { return TVP_DOW[new Date(iso + 'T00:00:00').getDay()]; }
function _tvpDayNum(iso) { return new Date(iso + 'T00:00:00').getDate(); }
function _tvpFmtLong(iso) { return fD(iso); }

function _tvpModeIcon(m) { return m === 'online' ? '💻' : '🚗'; }
function _tvpModeLabel(m) { return m === 'online' ? 'ประชุม/นัดออนไลน์' : 'ออกพบลูกค้า'; }

function _tvpRoster() {
  // รายชื่อคนในตาราง = ใครก็ตามที่เคยมีแผนอยู่ใน teamVisitPlans (ไม่ต้องพึ่ง config ทีมที่เป็นข้อมูลส่วนตัว
  // ต่อ user แต่ละคนอยู่แล้ว) + ตัวเองเสมอแม้ยังไม่เคยลงแผนเลย จะได้กดเพิ่มแผนแรกได้
  var byId = {};
  _tvpItems.forEach(function(it) { if (!byId[it.ownerId]) byId[it.ownerId] = { id: it.ownerId, name: it.ownerName || it.ownerId }; });
  var myId = _tvpMyId();
  if (!byId[myId]) byId[myId] = { id: myId, name: _tvpMyName() };
  var list = Object.keys(byId).map(function(k) { return byId[k]; });
  list.sort(function(a, b) { if (a.id === myId) return -1; if (b.id === myId) return 1; return (a.name || '').localeCompare(b.name || '', 'th'); });
  return list;
}

var TVP_AVA_COLORS = ['#4f6bf0', '#e0637e', '#17a673', '#e08a2c', '#a558d6', '#2fb0c9', '#f97316', '#0ea5e9'];
function _tvpAvaColor(id, idx) { return TVP_AVA_COLORS[idx % TVP_AVA_COLORS.length]; }
function _tvpInitials(name) { return String(name || '?').replace(/\(.*?\)/g, '').trim().slice(0, 1) || '?'; }

function _tvpPlansFor(ownerId, dateIso) {
  return _tvpItems.filter(function(it) { return it.ownerId === ownerId && it.date === dateIso; });
}

function rTeamVisitPlan(el) {
  document.getElementById('pgT').textContent = '🧭 Visit Plan ทีม';
  _tvpStartListener();

  if (_tvpLoading) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:30px;color:var(--text2)">⏳ กำลังโหลดแผนทีม...</div>';
    return;
  }

  var h = '<div class="card" style="margin-bottom:10px">';
  h += '<div class="tvp-toolbar">';
  h += '<div><b style="font-size:.9rem">🧭 Visit Plan ทีม</b><div style="font-size:.68rem;color:var(--text2);margin-top:2px">ดูแผนออกตลาดของทั้งทีมในที่เดียว — แก้ไขได้เฉพาะแผนของตัวเอง</div></div>';
  h += '<button class="btn bsm bo" onclick="tvpShareLink()">🔗 ส่งลิงก์ให้ทีม</button>';
  h += '</div>';

  h += '<div class="tvp-toolbar">';
  h += '<div class="tvp-viewtabs">';
  ['day', 'week', 'month'].forEach(function(v) {
    var label = v === 'day' ? 'รายวัน' : v === 'week' ? 'รายสัปดาห์' : 'รายเดือน';
    h += '<button class="' + (tvpView === v ? 'act' : '') + '" onclick="tvpView=\'' + v + '\';render()">' + label + '</button>';
  });
  h += '</div>';
  h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
  h += '<div class="tvp-nav"><button class="navb" onclick="tvpNav(-1)">‹</button><div class="rng">' + _tvpRangeLabel() + '</div><button class="navb" onclick="tvpNav(1)">›</button></div>';
  h += '<button class="btn bsm bo" onclick="tvpAnchor=_td();render()">📍 วันนี้</button>';
  h += '</div></div>';

  h += '<div class="tvp-legend">';
  h += '<span><span class="tvp-swatch" style="background:#4f6bf0"></span>ออกพบลูกค้า</span>';
  h += '<span><span class="tvp-swatch" style="background:#a558d6"></span>ประชุม/ออนไลน์</span>';
  h += '<span><span class="tvp-swatch" style="border:1.5px dashed var(--text3);background:transparent"></span>ว่าง</span>';
  h += '</div>';

  h += '</div>';

  if (tvpView === 'month') {
    h += '<div class="card">' + _tvpMonthHtml() + '</div>';
  } else {
    h += '<div class="card"><div class="tvp-scroll">' + _tvpGridHtml() + '</div></div>';
  }

  h += '<div class="card" style="margin-top:10px">';
  h += '<b style="font-size:.8rem">💡 วันที่ทีมว่างพร้อมกันมากที่สุด</b>';
  h += '<div style="font-size:.66rem;color:var(--text2);margin:3px 0 8px">นับจากจำนวนคนที่ไม่มีนัดหมายในสัปดาห์นี้ เหมาะสำหรับนัดประชุมทีมหรือกิจกรรมรวม</div>';
  h += '<div class="tvp-insight">' + _tvpInsightHtml() + '</div>';
  h += '</div>';

  el.innerHTML = h;
}

function _tvpRangeLabel() {
  if (tvpView === 'day') return _tvpFmtLong(tvpAnchor);
  if (tvpView === 'week') { var ws = _tvpStartOfWeek(tvpAnchor); return fD(ws) + ' – ' + fD(_tvpAddDays(ws, 6)); }
  var d = new Date(tvpAnchor + 'T00:00:00');
  var TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return TH_MONTH[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

function tvpNav(dir) {
  if (tvpView === 'day') tvpAnchor = _tvpAddDays(tvpAnchor, dir);
  else if (tvpView === 'week') tvpAnchor = _tvpAddDays(tvpAnchor, dir * 7);
  else tvpAnchor = _tvpAddMonths(tvpAnchor, dir);
  render();
}

function tvpShareLink() {
  // ไม่มีระบบ hash-routing ในแอปนี้ — ลิงก์ที่คัดลอกได้คือ URL หลักของแอปเท่านั้น ทีมต้อง login แล้วกดเข้า
  // เมนู "🧭 Visit Plan ทีม" เอง (ไม่ต้องมี PIN/ลิงก์พิเศษแบบลูกค้า เพราะทุกคนมีบัญชีเข้าแอปนี้อยู่แล้ว)
  var url = location.origin + location.pathname;
  var msg = '🔗 คัดลอกลิงก์แอปแล้ว — ส่งให้ทีม แล้วบอกให้กดเข้าเมนู "🧭 Visit Plan ทีม" ได้เลย (login คนละบัญชีตามปกติ)';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function() { toast(msg); }).catch(function() { toast('🔗 ลิงก์: ' + url); });
  } else {
    toast('🔗 ลิงก์: ' + url);
  }
}

function _tvpChipHtml(it) {
  return '<div class="tvp-chip ' + it.mode + '" onclick="tvpOpenDetail(\'' + it.ownerId + '\',null,\'' + it.id + '\')">' +
    '<span class="tt">' + _tvpModeIcon(it.mode) + ' ' + sanitize(it.company) + '</span>' +
    (it.start ? '<span class="tm">' + sanitize(it.start) + (it.end ? '–' + sanitize(it.end) : '') + '</span>' : '') +
    '</div>';
}

function _tvpGridHtml() {
  var days = [];
  if (tvpView === 'day') { days = [tvpAnchor]; }
  else { var ws = _tvpStartOfWeek(tvpAnchor); for (var i = 0; i < 7; i++) days.push(_tvpAddDays(ws, i)); }
  var t = _td();
  var roster = _tvpRoster();
  var myId = _tvpMyId();

  var h = '<table class="tvp-table"><thead><tr><th class="namecol">ทีมงาน</th>';
  days.forEach(function(d) {
    h += '<th class="' + (d === t ? 'today' : '') + '">' + _tvpDowLabel(d) + '<span class="dn">' + _tvpDayNum(d) + '</span></th>';
  });
  h += '</tr></thead><tbody>';

  roster.forEach(function(person, idx) {
    h += '<tr><td class="tvp-namecell"><div class="tvp-person"><div class="tvp-avatar" style="background:' + _tvpAvaColor(person.id, idx) + '">' + sanitize(_tvpInitials(person.name)) + '</div><div><div style="font-weight:600;font-size:.76rem">' + sanitize(person.name) + (person.id === myId ? '<span class="tvp-me">ฉัน</span>' : '') + '</div></div></div></td>';
    days.forEach(function(d) {
      var items = _tvpPlansFor(person.id, d);
      h += '<td class="tvp-daycell">';
      if (items.length) {
        items.forEach(function(it) { h += _tvpChipHtml(it); });
      } else {
        h += '<div class="tvp-free" onclick="tvpOpenDetail(\'' + person.id + '\',\'' + d + '\',null)">ว่าง</div>';
      }
      h += '</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table>';
  return h;
}

function _tvpMonthHtml() {
  var first = _tvpStartOfMonth(tvpAnchor);
  var gridStart = _tvpStartOfWeek(first);
  var curMonth = new Date(first + 'T00:00:00').getMonth();
  var t = _td();
  var roster = _tvpRoster();

  var h = '<div class="tvp-month">' + TVP_DOW.map(function(d) { return '<div class="tvp-mdow">' + d + '</div>'; }).join('') + '</div>';
  h += '<div class="tvp-month">';
  var cursor = gridStart;
  for (var i = 0; i < 42; i++) {
    var inMonth = new Date(cursor + 'T00:00:00').getMonth() === curMonth;
    var isToday = cursor === t;
    var busyPeople = roster.filter(function(p) { return _tvpPlansFor(p.id, cursor).length > 0; });
    h += '<div class="tvp-mcell' + (inMonth ? '' : ' other') + (isToday ? ' today' : '') + '" onclick="tvpOpenDayDetail(\'' + cursor + '\')">';
    h += '<div class="tvp-mn">' + new Date(cursor + 'T00:00:00').getDate() + '</div>';
    if (busyPeople.length) {
      h += '<div class="tvp-mavatars">';
      busyPeople.slice(0, 5).forEach(function(p) {
        var idx = roster.indexOf(p);
        h += '<div class="tvp-avatar" style="width:16px;height:16px;font-size:.55rem;background:' + _tvpAvaColor(p.id, idx) + '" title="' + sanitize(p.name) + '">' + sanitize(_tvpInitials(p.name)) + '</div>';
      });
      if (busyPeople.length > 5) h += '<span style="font-size:.6rem;color:var(--text3)">+' + (busyPeople.length - 5) + '</span>';
      h += '</div>';
    }
    h += '</div>';
    cursor = _tvpAddDays(cursor, 1);
  }
  h += '</div>';
  return h;
}

function _tvpInsightHtml() {
  var roster = _tvpRoster();
  var ws = _tvpStartOfWeek(tvpAnchor);
  var wdays = []; for (var i = 0; i < 7; i++) wdays.push(_tvpAddDays(ws, i));
  var counts = wdays.map(function(d) {
    var busy = 0;
    roster.forEach(function(p) { if (_tvpPlansFor(p.id, d).length) busy++; });
    return roster.length - busy;
  });
  var maxFree = Math.max.apply(null, counts);
  return wdays.map(function(d, i) {
    var isBest = counts[i] === maxFree && maxFree > 0;
    return '<div class="tvp-fbar' + (isBest ? ' best' : '') + '"><div class="fd">' + _tvpDowLabel(d) + ' ' + _tvpDayNum(d) + '</div><div class="fc">' + counts[i] + '/' + roster.length + '</div><div style="font-size:.6rem;color:var(--text3)">' + (isBest ? '⭐ ว่างมากสุด' : 'คนว่าง') + '</div></div>';
  }).join('');
}

// ---- Detail (read-only) — กดได้ทุกจุด ทุกคน ทุกวัน ----
function tvpOpenDetail(ownerId, dateIso, planId) {
  var roster = _tvpRoster();
  var person = roster.filter(function(p) { return p.id === ownerId; })[0];
  if (!person) return;
  var date = dateIso;
  if (planId) { var item = _tvpItems.filter(function(p) { return p.id === planId; })[0]; if (item) date = item.date; }

  var dayItems = _tvpPlansFor(ownerId, date);
  var h = '<div style="font-weight:700;margin-bottom:8px">📅 ' + _tvpFmtLong(date) + ' — ' + sanitize(person.name) + '</div>';
  if (!dayItems.length) {
    h += '<div style="text-align:center;padding:16px;color:var(--text2)">🟢 ว่างทั้งวัน — ไม่มีนัดหมาย</div>';
  } else {
    var myId = _tvpMyId();
    dayItems.forEach(function(it) {
      var clickable = it.ownerId === myId;
      h += '<div class="tvp-detail-row' + (clickable ? ' clickable' : '') + '"' + (clickable ? ' onclick="closeMForce();tvpOpenEditM(\'' + it.id + '\')"' : '') + '>';
      h += '<div style="font-size:18px">' + _tvpModeIcon(it.mode) + '</div><div style="flex:1;min-width:0">';
      h += '<div style="font-weight:700;font-size:.8rem">' + sanitize(it.company) + '</div>';
      h += '<div style="font-size:.68rem;color:var(--text2)">' + sanitize(it.start || '') + (it.end ? ' – ' + sanitize(it.end) : '') + ' · ' + _tvpModeLabel(it.mode) + '</div>';
      if (it.note) h += '<div style="font-size:.68rem;color:var(--text3);font-style:italic">' + sanitize(it.note) + '</div>';
      h += '</div></div>';
    });
  }
  if (ownerId === _tvpMyId()) {
    h += '<button class="btn bp btn-full" style="margin-top:10px" onclick="closeMForce();tvpOpenEditM(null,\'' + date + '\')">➕ เพิ่มแผนวันนี้</button>';
  }
  openM('📅 รายละเอียด', h);
}

function tvpOpenDayDetail(dateIso) {
  var roster = _tvpRoster();
  var myId = _tvpMyId();
  var h = '';
  roster.forEach(function(person, idx) {
    var items = _tvpPlansFor(person.id, dateIso);
    h += '<div class="tvp-detail-row clickable" onclick="closeMForce();tvpOpenDetail(\'' + person.id + '\',\'' + dateIso + '\',null)">';
    h += '<div class="tvp-avatar" style="background:' + _tvpAvaColor(person.id, idx) + '">' + sanitize(_tvpInitials(person.name)) + '</div><div style="flex:1;min-width:0">';
    h += '<div style="font-weight:700;font-size:.8rem">' + sanitize(person.name) + (person.id === myId ? '<span class="tvp-me">ฉัน</span>' : '') + '</div>';
    if (!items.length) {
      h += '<div style="font-size:.68rem;color:#22c55e">🟢 ว่างทั้งวัน</div>';
    } else {
      items.forEach(function(it) {
        h += '<div style="font-size:.68rem;color:var(--text2)">' + _tvpModeIcon(it.mode) + ' ' + sanitize(it.company) + ' (' + sanitize(it.start || '') + (it.end ? '–' + sanitize(it.end) : '') + ')</div>';
      });
    }
    h += '</div></div>';
  });
  openM('📅 ' + _tvpFmtLong(dateIso), h);
}

// ---- Edit modal (เฉพาะแผนของฉัน) ----
function tvpOpenEditM(planId, presetDate) {
  var plan = planId ? _tvpItems.filter(function(p) { return p.id === planId; })[0] : null;
  var h = '<div class="fg"><label>📅 วันที่</label><input type="date" id="tvp_f_date" value="' + sanitize(plan ? plan.date : (presetDate || _td())) + '"></div>';
  h += '<div class="fg"><label>รูปแบบ</label><select id="tvp_f_mode"><option value="offline"' + (!plan || plan.mode === 'offline' ? ' selected' : '') + '>🚗 ออกพบลูกค้า</option><option value="online"' + (plan && plan.mode === 'online' ? ' selected' : '') + '>💻 ประชุม/ออนไลน์</option></select></div>';
  h += '<div class="fg"><label>🏢 ชื่อลูกค้า/บริษัท</label><input type="text" id="tvp_f_company" value="' + sanitize(plan ? plan.company : '') + '" placeholder="เช่น บริษัท สยามโดรนเทค จำกัด"></div>';
  h += '<div style="display:flex;gap:8px">';
  h += '<div class="fg" style="flex:1"><label>⏰ เวลาเริ่ม</label><input type="time" id="tvp_f_start" value="' + sanitize(plan ? plan.start : '09:00') + '"></div>';
  h += '<div class="fg" style="flex:1"><label>⏰ เวลาสิ้นสุด</label><input type="time" id="tvp_f_end" value="' + sanitize(plan ? plan.end : '11:00') + '"></div>';
  h += '</div>';
  h += '<div class="fg"><label>📝 หมายเหตุ (ไม่บังคับ)</label><textarea id="tvp_f_note" placeholder="วัตถุประสงค์ / เรื่องที่จะคุย">' + sanitize(plan ? plan.note : '') + '</textarea></div>';
  h += '<button class="btn bp btn-full" onclick="tvpSubmitEdit(' + (plan ? "'" + plan.id + "'" : 'null') + ')">💾 บันทึก</button>';
  if (plan) h += '<button class="btn bd btn-full" style="margin-top:6px" onclick="tvpDelete(\'' + plan.id + '\')">🗑️ ลบแผนนี้</button>';
  openM(plan ? '✏️ แก้ไขแผนของฉัน' : '➕ เพิ่มแผนของฉัน', h);
}

function tvpSubmitEdit(planId) {
  var date = document.getElementById('tvp_f_date').value;
  var company = document.getElementById('tvp_f_company').value.trim();
  if (!date || !company) { toast('⚠️ กรุณากรอกวันที่และชื่อลูกค้า', true); return; }
  tvpSave({
    id: planId, date: date, mode: document.getElementById('tvp_f_mode').value, company: company,
    start: document.getElementById('tvp_f_start').value, end: document.getElementById('tvp_f_end').value,
    note: document.getElementById('tvp_f_note').value.trim()
  });
  closeMForce();
}
