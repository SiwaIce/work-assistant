// === LEAD FORMS — Event Lead Capture ===

var LEAD_FORM_COL = 'leadForms';
var LEAD_SUB_COL  = 'leadSubmissions';

var LEAD_FIELD_TYPES = [
  {v:'text',     l:'ข้อความสั้น'},
  {v:'textarea', l:'ข้อความยาว'},
  {v:'email',    l:'อีเมล'},
  {v:'phone',    l:'เบอร์โทรศัพท์'},
  {v:'number',   l:'ตัวเลข'},
  {v:'select',   l:'Dropdown (เลือก 1)'},
  {v:'radio',    l:'Radio (เลือก 1)'},
  {v:'checkbox', l:'Checkbox (ใช่/ไม่)'},
  {v:'date',     l:'วันที่'},
  {v:'rating',   l:'Rating (ดาว 1–5)'},
];

// ---------- Main list ----------

function rLeads() {
  var el = document.getElementById('ct');
  el.innerHTML = '<div class="ld-wrap"><div class="ld-top"><h2 class="ld-title">📋 Lead Forms</h2><button onclick="showCreateLeadFormM()" class="btn bp">+ สร้าง Form ใหม่</button></div><div style="padding:24px;color:var(--text2)">กำลังโหลด...</div></div>';

  db.collection(LEAD_FORM_COL)
    .orderBy('createdAt', 'desc')
    .get()
    .then(function(snap) {
      var forms = [];
      snap.forEach(function(d) { forms.push(Object.assign({id: d.id}, d.data())); });
      document.getElementById('ct').innerHTML = _renderLeadList(forms);
    })
    .catch(function(e) {
      document.getElementById('ct').innerHTML = '<div style="padding:24px;color:#ef4444;">โหลดไม่ได้: ' + esc(e.message) + '</div>';
    });
}

function _renderLeadList(forms) {
  var h = '<div class="ld-wrap">';
  h += '<div class="ld-top"><h2 class="ld-title">📋 Lead Forms</h2>';
  h += '<button onclick="showCreateLeadFormM()" class="btn bp">+ สร้าง Form ใหม่</button></div>';

  if (!forms.length) {
    h += '<div style="text-align:center;padding:60px 24px;color:var(--text2);">';
    h += '<div style="font-size:2.5em;margin-bottom:12px;">📋</div>';
    h += '<div>ยังไม่มี Form — กด "+ สร้าง Form ใหม่" เพื่อเริ่มต้น</div></div>';
    return h + '</div>';
  }

  h += '<div class="ld-grid">';
  forms.forEach(function(f) {
    var isEmail = f.submitMode === 'email';
    h += '<div class="ld-card">';
    h += '<div class="ld-card-hd">';
    h += '<span class="ld-card-title">' + esc(f.title) + '</span>';
    h += '<span class="ld-badge ' + (isEmail ? 'ld-badge-blue' : 'ld-badge-gray') + '">' + (isEmail ? '📧 ส่งอีเมล' : '📥 Submit only') + '</span>';
    h += '</div>';
    if (f.eventName) h += '<div class="ld-card-event">📍 ' + esc(f.eventName) + '</div>';
    h += '<div class="ld-card-stats">';
    h += '<span>' + ((f.fields || []).length) + ' fields</span>';
    h += '<span>🙋 <b>' + (f.submissionsCount || 0) + '</b> submissions</span>';
    h += '</div>';
    h += '<div class="ld-card-actions">';
    h += '<button onclick="showLeadFormDetail(\'' + f.id + '\')" class="btn bsm bo">📊 ดูข้อมูล</button>';
    h += '<button onclick="showEditLeadFormM(\'' + f.id + '\')" class="btn bsm bo">✏️ แก้ไข</button>';
    h += '<button onclick="showLeadQR(\'' + f.id + '\')" class="btn bsm bo">📱 QR</button>';
    h += '<button onclick="deleteLeadForm(\'' + f.id + '\')" class="btn bsm bd">🗑️</button>';
    h += '</div></div>';
  });
  h += '</div></div>';
  return h;
}

// ---------- Field ID helper ----------

function _lfNewId() {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// ---------- Create / Edit modal ----------

var _editLeadId  = null;
var _lfFields    = [];

function showCreateLeadFormM() {
  _editLeadId = null;
  _lfFields = [{id: _lfNewId(), label: 'ชื่อ-นามสกุล', type: 'text', required: true, options: []}];
  _openLeadModal(null);
}

function showEditLeadFormM(formId) {
  db.collection(LEAD_FORM_COL).doc(formId).get().then(function(d) {
    if (!d.exists) return;
    var f = Object.assign({id: d.id}, d.data());
    _editLeadId  = formId;
    _lfFields    = JSON.parse(JSON.stringify(f.fields || []));
    _openLeadModal(f);
  });
}

function _openLeadModal(f) {
  var isEdit    = !!f;
  var emailMode = f && f.submitMode === 'email';
  var eCfg      = (f && f.emailConfig) || {};

  var h = '<div>';

  h += '<div class="fg"><label>ชื่อ Form *</label><input id="lf_title" class="fm-input" value="' + esc(f ? f.title || '' : '') + '" placeholder="เช่น Lead Form — DJI Drone Show 2026"></div>';
  h += '<div class="fg"><label>ชื่องาน / Event</label><input id="lf_event" class="fm-input" value="' + esc(f ? f.eventName || '' : '') + '" placeholder="เช่น DJI Partner Day Bangkok"></div>';

  h += '<div class="fg"><label>รูปแบบหลัง Submit</label>';
  h += '<select id="lf_mode" class="fm-input" onchange="lfToggleEmailSec()">';
  h += '<option value="only"' + (!emailMode ? ' selected' : '') + '>📥 เก็บข้อมูลอย่างเดียว</option>';
  h += '<option value="email"' + (emailMode ? ' selected' : '') + '>📧 เก็บข้อมูล + ส่งอีเมลให้ลูกค้า</option>';
  h += '</select></div>';

  // Email config block
  h += '<div id="lf_email_sec" style="' + (emailMode ? '' : 'display:none;') + 'background:var(--bg2,#1e293b);border-radius:10px;padding:14px;margin-bottom:12px;">';
  h += '<b style="font-size:.85em;">⚙️ ตั้งค่าอีเมล</b>';
  h += '<div class="fg" style="margin-top:10px;"><label>Field ที่เป็นอีเมลลูกค้า (ใช้ส่งถึง)</label>';
  h += '<select id="lf_email_field" class="fm-input"></select></div>';
  h += '<div class="fg"><label>Subject</label><input id="lf_email_subj" class="fm-input" value="' + esc(eCfg.subject || '') + '" placeholder="เช่น ขอบคุณที่สนใจผลิตภัณฑ์ DJI"></div>';
  h += '<div class="fg"><label>เนื้อหา <small style="color:var(--text2);">(ใช้ {{ชื่อ Field}} แทนข้อมูลที่ลูกค้ากรอก)</small></label>';
  h += '<textarea id="lf_email_body" class="fm-input" rows="5" placeholder="สวัสดีคุณ {{ชื่อ-นามสกุล}}\n\nขอบคุณที่สนใจ...\nดู Brochure ได้ที่: https://...">' + esc(eCfg.body || '') + '</textarea></div>';
  h += '</div>';

  // Field builder
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 8px;">';
  h += '<b>📝 Fields ในฟอร์ม</b>';
  h += '<button onclick="lfAddField()" class="btn bsm bp">+ เพิ่ม Field</button></div>';
  h += '<div id="lf_fields_wrap">' + _lfBuildHtml() + '</div>';

  h += '<div style="display:flex;gap:8px;margin-top:20px;">';
  h += '<button onclick="saveLeadForm()" class="btn bp" style="flex:1;">💾 บันทึก</button>';
  h += '<button onclick="closeMForce()" class="btn bo">ยกเลิก</button></div>';
  h += '</div>';

  openM((isEdit ? 'แก้ไข' : 'สร้าง') + ' Lead Form', h);
  setTimeout(_lfSyncEmailDdl, 50);
}

function lfToggleEmailSec() {
  var mode = document.getElementById('lf_mode').value;
  document.getElementById('lf_email_sec').style.display = mode === 'email' ? '' : 'none';
}

function _lfBuildHtml() {
  if (!_lfFields.length) return '<div style="color:var(--text2);text-align:center;padding:16px;">กด "+ เพิ่ม Field"</div>';
  var h = '';
  _lfFields.forEach(function(f) {
    var hasOpts = f.type === 'select' || f.type === 'radio';
    h += '<div class="lf-frow" id="lfrow_' + f.id + '">';
    h += '<div class="lf-frow-top">';
    h += '<input class="fm-input lf-flbl" placeholder="ชื่อ Field เช่น บริษัท" value="' + esc(f.label) + '" oninput="_lfSetLabel(\'' + f.id + '\',this.value)">';
    h += '<select class="fm-input lf-ftype" onchange="_lfSetType(\'' + f.id + '\',this.value)">';
    LEAD_FIELD_TYPES.forEach(function(t) {
      h += '<option value="' + t.v + '"' + (f.type === t.v ? ' selected' : '') + '>' + t.l + '</option>';
    });
    h += '</select>';
    h += '<label class="lf-req-chk" title="จำเป็นต้องกรอก"><input type="checkbox" ' + (f.required ? 'checked' : '') + ' onchange="_lfSetReq(\'' + f.id + '\',this.checked)"> *</label>';
    h += '<button onclick="_lfDelField(\'' + f.id + '\')" class="btn bsm bd" title="ลบ">✕</button>';
    h += '</div>';
    if (hasOpts) {
      h += '<div class="lf-opts-wrap">';
      h += '<small style="color:var(--text2);">ตัวเลือก (1 บรรทัด = 1 ตัวเลือก)</small>';
      h += '<textarea class="fm-input" rows="3" oninput="_lfSetOpts(\'' + f.id + '\',this.value)" placeholder="Enterprise\nAgriculture\nMapping">' + esc((f.options || []).join('\n')) + '</textarea>';
      h += '</div>';
    }
    h += '</div>';
  });
  return h;
}

function lfAddField() {
  _lfFields.push({id: _lfNewId(), label: '', type: 'text', required: false, options: []});
  document.getElementById('lf_fields_wrap').innerHTML = _lfBuildHtml();
  _lfSyncEmailDdl();
}

function _lfGet(id)         { return _lfFields.find(function(x) { return x.id === id; }); }
function _lfSetLabel(id, v) { var f = _lfGet(id); if (f) { f.label = v; _lfSyncEmailDdl(); } }
function _lfSetReq(id, v)   { var f = _lfGet(id); if (f) f.required = v; }
function _lfSetOpts(id, v)  { var f = _lfGet(id); if (f) f.options = v.split('\n').map(function(s) { return s.trim(); }).filter(Boolean); }
function _lfSetType(id, v) {
  var f = _lfGet(id);
  if (!f) return;
  f.type = v; f.options = [];
  document.getElementById('lf_fields_wrap').innerHTML = _lfBuildHtml();
  _lfSyncEmailDdl();
}
function _lfDelField(id) {
  if (_lfFields.length <= 1) { alert('ต้องมีอย่างน้อย 1 field'); return; }
  _lfFields = _lfFields.filter(function(x) { return x.id !== id; });
  document.getElementById('lf_fields_wrap').innerHTML = _lfBuildHtml();
  _lfSyncEmailDdl();
}

function _lfSyncEmailDdl() {
  var sel = document.getElementById('lf_email_field');
  if (!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">-- เลือก field ที่เป็นอีเมลของลูกค้า --</option>';
  _lfFields.forEach(function(f) {
    if (f.label) sel.innerHTML += '<option value="' + f.id + '"' + (f.id === cur ? ' selected' : '') + '>' + esc(f.label) + '</option>';
  });
}

// ---------- Save / Delete ----------

function saveLeadForm() {
  var title  = (document.getElementById('lf_title').value || '').trim();
  if (!title) { alert('กรุณาใส่ชื่อ Form'); return; }
  var fields = _lfFields.filter(function(f) { return f.label.trim(); });
  if (!fields.length) { alert('กรุณาเพิ่มอย่างน้อย 1 field ที่มีชื่อ'); return; }

  var mode = document.getElementById('lf_mode').value;
  var data  = {
    title:     title,
    eventName: (document.getElementById('lf_event').value || '').trim(),
    fields:    fields,
    submitMode: mode,
    active:    true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (mode === 'email') {
    data.emailConfig = {
      toFieldId: document.getElementById('lf_email_field').value,
      subject:   (document.getElementById('lf_email_subj').value || '').trim(),
      body:      (document.getElementById('lf_email_body').value || '').trim(),
    };
  }

  var saveBtn = document.querySelector('#modal-body .btn.bp');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'กำลังบันทึก...'; }

  var prom;
  if (!_editLeadId) {
    data.createdAt  = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy  = CURRENT_USER.email;
    data.submissionsCount = 0;
    prom = db.collection(LEAD_FORM_COL).add(data);
  } else {
    prom = db.collection(LEAD_FORM_COL).doc(_editLeadId).set(data, {merge: true});
  }

  prom.then(function() {
    closeMForce();
    rLeads();
    toast('✅ บันทึก Form เรียบร้อย');
  }).catch(function(e) {
    alert('บันทึกไม่ได้: ' + e.message);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 บันทึก'; }
  });
}

function deleteLeadForm(formId) {
  if (!confirm('ลบ Form นี้?\n(submissions ที่มีอยู่จะยังคงอยู่ใน Firestore)')) return;
  db.collection(LEAD_FORM_COL).doc(formId).delete().then(function() {
    rLeads();
    toast('🗑️ ลบ Form แล้ว');
  });
}

// ---------- QR Modal ----------

function showLeadQR(formId) {
  var base   = window.location.href.replace(/[^/]*$/, '');
  var url    = base + 'lead-form.html?form=' + formId;
  var qrSrc  = 'https://api.qrserver.com/v1/create-qr-code/?data=' + encodeURIComponent(url) + '&size=220x220&margin=10';

  var h = '<div style="text-align:center;padding:8px;">';
  h += '<img src="' + qrSrc + '" style="border-radius:12px;margin:8px auto;display:block;" onerror="this.alt=\'QR ไม่โหลด (ต้องออนไลน์)\'">';
  h += '<p style="font-size:.78em;color:var(--text2);word-break:break-all;margin:10px 0;">' + esc(url) + '</p>';
  h += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
  h += '<button onclick="navigator.clipboard.writeText(\'' + url.replace(/'/g, "\\'") + '\');toast(\'📋 คัดลอกแล้ว\')" class="btn bo">📋 คัดลอก Link</button>';
  h += '<a href="' + qrSrc + '&format=png" download="qr-leadform.png" class="btn bo">⬇️ บันทึก QR</a>';
  h += '</div></div>';

  openM('📱 QR Code & Link', h);
}

// ---------- Submissions detail ----------

var _ldCache = null;

function showLeadFormDetail(formId) {
  var el = document.getElementById('ct');
  el.innerHTML = '<div class="ld-wrap" style="padding:24px;color:var(--text2);">กำลังโหลด...</div>';

  db.collection(LEAD_FORM_COL).doc(formId).get().then(function(fd) {
    if (!fd.exists) { el.innerHTML = '<div style="padding:24px;color:#ef4444;">ไม่พบ Form</div>'; return; }
    var form = Object.assign({id: fd.id}, fd.data());

    db.collection(LEAD_SUB_COL)
      .where('formId', '==', formId)
      .orderBy('createdAt', 'desc')
      .get()
      .then(function(snap) {
        var subs = [];
        snap.forEach(function(d) { subs.push(Object.assign({id: d.id}, d.data())); });
        _ldCache = {form: form, subs: subs};
        el.innerHTML = _renderSubsPage(form, subs);
      });
  });
}

function _renderSubsPage(form, subs) {
  var fields = form.fields || [];
  var h = '<div class="ld-wrap">';

  // Header
  h += '<div class="ld-top">';
  h += '<button onclick="rLeads()" class="btn bo" style="margin-right:10px;">← กลับ</button>';
  h += '<h2 class="ld-title" style="flex:1;">' + esc(form.title) + '</h2>';
  if (subs.length) h += '<button onclick="exportLeadSubs()" class="btn bp">📎 Export Excel</button>';
  h += '</div>';

  // Stats
  h += '<div class="ld-stats-row">';
  h += '<div class="ld-stat"><div class="ld-stat-num">' + subs.length + '</div><div class="ld-stat-lbl">Submissions</div></div>';
  h += '<div class="ld-stat"><div class="ld-stat-num">' + fields.length + '</div><div class="ld-stat-lbl">Fields</div></div>';
  if (form.submitMode === 'email') {
    var sent = subs.filter(function(s) { return s.emailSent; }).length;
    h += '<div class="ld-stat"><div class="ld-stat-num">' + sent + '</div><div class="ld-stat-lbl">ส่งอีเมลแล้ว</div></div>';
  }
  h += '<div class="ld-stat-actions">';
  h += '<button onclick="showLeadQR(\'' + form.id + '\')" class="btn bsm bo">📱 QR Code</button>';
  h += '<button onclick="showEditLeadFormM(\'' + form.id + '\')" class="btn bsm bo" style="margin-top:4px;">✏️ แก้ไข Form</button>';
  h += '</div>';
  h += '</div>';

  if (!subs.length) {
    h += '<div style="text-align:center;padding:48px;color:var(--text2);">ยังไม่มีใครกรอกฟอร์มนี้</div>';
    return h + '</div>';
  }

  // Table
  h += '<div style="overflow-x:auto;"><table class="tbl"><thead><tr>';
  h += '<th style="white-space:nowrap;">วันที่</th>';
  fields.forEach(function(f) { h += '<th>' + esc(f.label) + '</th>'; });
  if (form.submitMode === 'email') h += '<th>อีเมล</th>';
  h += '</tr></thead><tbody>';

  subs.forEach(function(s) {
    h += '<tr>';
    h += '<td style="white-space:nowrap;font-size:.8em;">' + _ldFmtDate(s.createdAt) + '</td>';
    fields.forEach(function(f) {
      var v = (s.answers && s.answers[f.id] !== undefined) ? s.answers[f.id] : '';
      if (f.type === 'rating')   v = '⭐'.repeat(parseInt(v) || 0) || '—';
      if (f.type === 'checkbox') v = v ? '✅' : '—';
      h += '<td>' + esc(String(v === '' ? '—' : v)) + '</td>';
    });
    if (form.submitMode === 'email') {
      h += '<td>' + (s.emailSent ? '<span style="color:#4ade80;">✅</span>' : '<span style="color:#475569;">—</span>') + '</td>';
    }
    h += '</tr>';
  });

  h += '</tbody></table></div></div>';
  return h;
}

function _ldFmtDate(ts) {
  if (!ts) return '—';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('th-TH', {day: '2-digit', month: '2-digit', year: '2-digit'}) + ' ' +
         d.toLocaleTimeString('th-TH', {hour: '2-digit', minute: '2-digit'});
}

function exportLeadSubs() {
  if (!_ldCache) return;
  var form   = _ldCache.form;
  var subs   = _ldCache.subs;
  var fields = form.fields || [];
  var header = ['วันที่'].concat(fields.map(function(f) { return f.label; }));
  if (form.submitMode === 'email') header.push('ส่งอีเมล');

  var rows = [header];
  subs.forEach(function(s) {
    var row = [_ldFmtDate(s.createdAt)];
    fields.forEach(function(f) { row.push((s.answers && s.answers[f.id] !== undefined) ? s.answers[f.id] : ''); });
    if (form.submitMode === 'email') row.push(s.emailSent ? 'Yes' : 'No');
    rows.push(row);
  });

  var ws = XLSX.utils.aoa_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
  XLSX.writeFile(wb, form.title + '_submissions.xlsx');
}
