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
  {v:'checkbox',   l:'Checkbox'},
  {v:'multicheck', l:'Checkbox หลายตัวเลือก'},
  {v:'date',       l:'วันที่'},
  {v:'rating',   l:'Rating (ดาว 1–5)'},
];

// ---------- State ----------
var _editLeadId = null;
var _lfSec      = {common: [], personal: [], company: []};
var _lfTab      = 'common';
var _lfUseType  = false;
var _ldCache    = null;

// ---------- Main list ----------

function rLeads() {
  var el = document.getElementById('ct');
  el.innerHTML = '<div class="ld-wrap"><div class="ld-top"><h2 class="ld-title">📋 Lead Forms</h2>' +
    '<button onclick="showCreateLeadFormM()" class="btn bp">+ สร้าง Form ใหม่</button></div>' +
    '<div style="padding:24px;color:var(--text2)">กำลังโหลด...</div></div>';

  db.collection(LEAD_FORM_COL).orderBy('createdAt', 'desc').get()
    .then(function(snap) {
      var forms = [];
      snap.forEach(function(d) { forms.push(Object.assign({id: d.id}, d.data())); });
      document.getElementById('ct').innerHTML = _ldListHtml(forms);
    })
    .catch(function(e) {
      document.getElementById('ct').innerHTML = '<div style="padding:24px;color:#ef4444;">โหลดไม่ได้: ' + esc(e.message) + '</div>';
    });
}

function _ldListHtml(forms) {
  var h = '<div class="ld-wrap"><div class="ld-top"><h2 class="ld-title">📋 Lead Forms</h2>' +
    '<button onclick="showCreateLeadFormM()" class="btn bp">+ สร้าง Form ใหม่</button></div>';

  if (!forms.length) {
    return h + '<div style="text-align:center;padding:60px 24px;color:var(--text2);"><div style="font-size:2.5em;margin-bottom:12px;">📋</div>' +
      '<div>ยังไม่มี Form — กด "+ สร้าง Form ใหม่" เพื่อเริ่มต้น</div></div></div>';
  }

  h += '<div class="ld-grid">';
  forms.forEach(function(f) {
    var action = f.submitAction || 'only';
    var aLabel = action === 'email' ? '📧 ส่งอีเมล' : action === 'redirect' ? '🔗 Redirect' : '📥 Submit only';
    var aCls   = action === 'email' ? 'ld-badge-blue' : action === 'redirect' ? 'ld-badge-green' : 'ld-badge-gray';
    var total  = ((f.commonFields || f.fields || []).length) + (f.personalFields || []).length + (f.companyFields || []).length;
    h += '<div class="ld-card">';
    h += '<div class="ld-card-hd"><span class="ld-card-title">' + esc(f.title) + '</span>';
    h += '<span class="ld-badge ' + aCls + '">' + aLabel + '</span></div>';
    if (f.eventName) h += '<div class="ld-card-event">📍 ' + esc(f.eventName) + '</div>';
    h += '<div class="ld-card-stats"><span>' + total + ' fields</span>';
    if (f.useTypeToggle) h += '<span class="ld-badge ld-badge-purple">👤🏢 แยกประเภท</span>';
    h += '<span style="margin-left:auto;">🙋 <b>' + (f.submissionsCount || 0) + '</b></span></div>';
    h += '<div class="ld-card-actions">';
    h += '<button onclick="showLeadFormDetail(\'' + f.id + '\')" class="btn bsm bo">📊 ดูข้อมูล</button>';
    h += '<button onclick="showEditLeadFormM(\'' + f.id + '\')" class="btn bsm bo">✏️ แก้ไข</button>';
    h += '<button onclick="showLeadQR(\'' + f.id + '\')" class="btn bsm bo">📱 QR</button>';
    h += '<button onclick="deleteLeadForm(\'' + f.id + '\')" class="btn bsm bd">🗑️</button>';
    h += '</div></div>';
  });
  return h + '</div></div>';
}

// ---------- ID helper ----------

function _lfId() {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// ---------- Create / Edit ----------

function showCreateLeadFormM() {
  _editLeadId = null;
  _lfUseType  = true;
  _lfTab      = 'common';
  _lfSec = {
    common: [
      {id: _lfId(), label: 'สนใจสินค้า / บริการ', type: 'select', required: false,
       options: ['Drone Enterprise', 'Drone Agriculture', 'Drone Mapping', 'อื่นๆ']},
    ],
    personal: [
      {id: _lfId(), label: 'ชื่อ-นามสกุล',   type: 'text',  required: true,  options: []},
      {id: _lfId(), label: 'เบอร์โทรศัพท์',  type: 'phone', required: true,  options: []},
      {id: _lfId(), label: 'อีเมล',           type: 'email', required: false, options: []},
    ],
    company: [
      {id: _lfId(), label: 'ชื่อบริษัท / องค์กร', type: 'text',  required: true,  options: []},
      {id: _lfId(), label: 'ชื่อ-นามสกุล',         type: 'text',  required: true,  options: []},
      {id: _lfId(), label: 'ตำแหน่ง',              type: 'text',  required: false, options: []},
      {id: _lfId(), label: 'อีเมล',                type: 'email', required: true,  options: []},
      {id: _lfId(), label: 'เบอร์โทรศัพท์',        type: 'phone', required: false, options: []},
    ],
  };
  _openLeadModal(null);
}

function showEditLeadFormM(formId) {
  db.collection(LEAD_FORM_COL).doc(formId).get().then(function(d) {
    if (!d.exists) return;
    var f = Object.assign({id: d.id}, d.data());
    _editLeadId = formId;
    _lfUseType  = !!f.useTypeToggle;
    _lfTab      = 'common';
    _lfSec = {
      common:   JSON.parse(JSON.stringify(f.commonFields   || f.fields || [])),
      personal: JSON.parse(JSON.stringify(f.personalFields || [])),
      company:  JSON.parse(JSON.stringify(f.companyFields  || [])),
    };
    _openLeadModal(f);
  });
}

function _openLeadModal(f) {
  var isEdit = !!f;
  var action = f ? (f.submitAction || 'only') : 'only';
  var eCfg   = (f && f.emailConfig) || {};
  var rUrl   = (f && f.redirectUrl) || '';

  var h = '<div>';
  h += '<div class="fg"><label>ชื่อ Form *</label><input id="lf_title" class="fm-input" value="' + esc(f ? f.title || '' : '') + '" placeholder="เช่น Lead Form — DJI Drone Show 2026"></div>';
  h += '<div class="fg"><label>ชื่องาน / Event</label><input id="lf_event" class="fm-input" value="' + esc(f ? f.eventName || '' : '') + '" placeholder="เช่น DJI Partner Day Bangkok"></div>';

  // Type toggle
  h += '<div class="fg" style="display:flex;align-items:center;gap:10px;background:var(--bg2,#1e293b);padding:12px;border-radius:10px;">';
  h += '<input type="checkbox" id="lf_usetype" ' + (_lfUseType ? 'checked' : '') + ' onchange="_lfToggleType(this.checked)" style="width:18px;height:18px;accent-color:#3b82f6;flex-shrink:0;">';
  h += '<div><div style="font-size:.88em;font-weight:600;">แยก Section บุคคล / บริษัท</div>';
  h += '<div style="font-size:.78em;color:var(--text2);">ลูกค้าเลือกประเภทก่อน แล้ว fields เปลี่ยนตาม</div></div></div>';

  // Post-submit action
  h += '<div class="fg"><label>สิ่งที่เกิดขึ้นหลัง Submit</label>';
  h += '<select id="lf_action" class="fm-input" onchange="lfToggleActionSec()">';
  h += '<option value="only"'     + (action === 'only'     ? ' selected' : '') + '>📥 แสดง "ขอบคุณ" เฉยๆ</option>';
  h += '<option value="redirect"' + (action === 'redirect' ? ' selected' : '') + '>🔗 พาไปที่ Link (Brochure/โปรโมชัน)</option>';
  h += '<option value="email"'    + (action === 'email'    ? ' selected' : '') + '>📧 ส่งอีเมลให้ลูกค้า</option>';
  h += '</select></div>';

  h += '<div id="lf_redir_sec" style="' + (action === 'redirect' ? '' : 'display:none;') + '">';
  h += '<div class="fg"><label>URL ที่จะพาไปหลัง Submit</label>';
  h += '<input id="lf_redir_url" class="fm-input" value="' + esc(rUrl) + '" placeholder="https://..."></div></div>';

  h += '<div id="lf_email_sec" style="' + (action === 'email' ? '' : 'display:none;') + 'background:var(--bg2,#1e293b);border-radius:10px;padding:14px;margin-bottom:12px;">';
  h += '<b style="font-size:.85em;">⚙️ ตั้งค่าอีเมล</b>';
  h += '<div class="fg" style="margin-top:10px;"><label>Field ที่เป็นอีเมลของลูกค้า</label><select id="lf_email_field" class="fm-input"></select></div>';
  h += '<div class="fg"><label>Subject</label><input id="lf_email_subj" class="fm-input" value="' + esc(eCfg.subject || '') + '" placeholder="เช่น ขอบคุณที่สนใจ DJI"></div>';
  h += '<div class="fg"><label>เนื้อหา <small style="color:var(--text2);">(ใช้ {{ชื่อ Field}} แทนข้อมูลที่กรอก)</small></label>';
  h += '<textarea id="lf_email_body" class="fm-input" rows="4" placeholder="สวัสดีคุณ {{ชื่อ-นามสกุล}}\n\nขอบคุณที่สนใจ...">' + esc(eCfg.body || '') + '</textarea></div>';
  h += '</div>';

  // Field builder
  h += '<hr style="border-color:var(--border,#334155);margin:16px 0;">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
  h += '<b>📝 Fields ในฟอร์ม</b><button onclick="lfAddField()" class="btn bsm bp">+ เพิ่ม Field</button></div>';
  h += '<div id="lf_tabs_wrap">' + _lfTabsHtml() + '</div>';
  h += '<div id="lf_fields_wrap">' + _lfSecHtml(_lfTab) + '</div>';

  h += '<div style="display:flex;gap:8px;margin-top:20px;">';
  h += '<button onclick="saveLeadForm()" class="btn bp" style="flex:1;">💾 บันทึก</button>';
  h += '<button onclick="closeMForce()" class="btn bo">ยกเลิก</button></div></div>';

  openM((isEdit ? 'แก้ไข' : 'สร้าง') + ' Lead Form', h);
  setTimeout(_lfSyncEmailDdl, 60);
}

function _lfTabsHtml() {
  var tabs = [{k: 'common', l: '🌐 ทั่วไป (ทุกคน)'}];
  if (_lfUseType) {
    tabs.push({k: 'personal', l: '👤 บุคคล'});
    tabs.push({k: 'company',  l: '🏢 บริษัท'});
  }
  var h = '<div class="lf-tabs">';
  tabs.forEach(function(t) {
    h += '<button onclick="lfSwitchTab(\'' + t.k + '\')" class="lf-tab' + (t.k === _lfTab ? ' act' : '') + '">' +
      t.l + ' <span class="lf-tab-cnt">(' + _lfSec[t.k].length + ')</span></button>';
  });
  return h + '</div>';
}

function lfSwitchTab(tab) {
  _lfTab = tab;
  document.getElementById('lf_tabs_wrap').innerHTML = _lfTabsHtml();
  document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(tab);
}

function _lfToggleType(val) {
  _lfUseType = val;
  if (val && !_lfSec.personal.length) {
    _lfSec.personal = [
      {id: _lfId(), label: 'ชื่อ-นามสกุล',  type: 'text',  required: true,  options: []},
      {id: _lfId(), label: 'เบอร์โทรศัพท์', type: 'phone', required: true,  options: []},
    ];
  }
  if (val && !_lfSec.company.length) {
    _lfSec.company = [
      {id: _lfId(), label: 'ชื่อบริษัท',   type: 'text',  required: true,  options: []},
      {id: _lfId(), label: 'ชื่อ-นามสกุล', type: 'text',  required: true,  options: []},
    ];
  }
  if (!val) _lfTab = 'common';
  document.getElementById('lf_tabs_wrap').innerHTML = _lfTabsHtml();
  document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(_lfTab);
}

function lfToggleActionSec() {
  var a = document.getElementById('lf_action').value;
  document.getElementById('lf_redir_sec').style.display  = a === 'redirect' ? '' : 'none';
  document.getElementById('lf_email_sec').style.display  = a === 'email'    ? '' : 'none';
}

function _lfSecHtml(sec) {
  var fields = _lfSec[sec] || [];
  var secHint = sec === 'common' ? 'Fields แสดงสำหรับทุกคน' : sec === 'personal' ? 'Fields เฉพาะเมื่อลูกค้าเลือก "บุคคล"' : 'Fields เฉพาะเมื่อลูกค้าเลือก "บริษัท"';
  if (!fields.length) {
    return '<div style="color:var(--text2);text-align:center;padding:16px;border:1px dashed var(--border,#334155);border-radius:8px;">' +
      secHint + '<br><small>กด "+ เพิ่ม Field"</small></div>';
  }
  var h = '';
  fields.forEach(function(f) {
    var hasOpts = f.type === 'select' || f.type === 'radio' || f.type === 'multicheck';
    h += '<div class="lf-frow" id="lfrow_' + f.id + '">';
    h += '<div class="lf-frow-top">';
    h += '<input class="fm-input lf-flbl" placeholder="ชื่อ Field เช่น บริษัท" value="' + esc(f.label) + '" oninput="_lfSetLabel(\'' + sec + '\',\'' + f.id + '\',this.value)">';
    h += '<select class="fm-input lf-ftype" onchange="_lfSetType(\'' + sec + '\',\'' + f.id + '\',this.value)">';
    LEAD_FIELD_TYPES.forEach(function(t) {
      h += '<option value="' + t.v + '"' + (f.type === t.v ? ' selected' : '') + '>' + t.l + '</option>';
    });
    h += '</select>';
    h += '<label class="lf-req-chk" title="บังคับกรอก"><input type="checkbox" ' + (f.required ? 'checked' : '') +
      ' onchange="_lfSetReq(\'' + sec + '\',\'' + f.id + '\',this.checked)"> บังคับ</label>';
    h += '<button onclick="_lfDelF(\'' + sec + '\',\'' + f.id + '\')" class="btn bsm bd" title="ลบ">✕</button>';
    h += '</div>';
    if (hasOpts) {
      h += '<div class="lf-opts-wrap"><small style="color:var(--text2);">ตัวเลือก (1 บรรทัด = 1 ตัวเลือก)</small>';
      h += '<textarea class="fm-input" rows="3" oninput="_lfSetOpts(\'' + sec + '\',\'' + f.id + '\',this.value)">' +
        esc((f.options || []).join('\n')) + '</textarea></div>';
    }
    h += '</div>';
  });
  return h;
}

function lfAddField() {
  _lfSec[_lfTab].push({id: _lfId(), label: '', type: 'text', required: false, options: []});
  document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(_lfTab);
  document.getElementById('lf_tabs_wrap').innerHTML   = _lfTabsHtml();
  _lfSyncEmailDdl();
}

function _lfGet(sec, id)       { return (_lfSec[sec] || []).find(function(x) { return x.id === id; }); }
function _lfSetLabel(s, id, v) { var f = _lfGet(s, id); if (f) f.label = v; _lfSyncEmailDdl(); }
function _lfSetReq(s, id, v)   { var f = _lfGet(s, id); if (f) f.required = v; }
function _lfSetOpts(s, id, v)  { var f = _lfGet(s, id); if (f) f.options = v.split('\n').map(function(x) { return x.trim(); }).filter(Boolean); }
function _lfSetType(s, id, v) {
  var f = _lfGet(s, id); if (!f) return;
  f.type = v; f.options = [];
  document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(s);
  _lfSyncEmailDdl();
}
function _lfDelF(s, id) {
  if (_lfSec[s].length <= 1) { alert('ต้องมีอย่างน้อย 1 field'); return; }
  _lfSec[s] = _lfSec[s].filter(function(x) { return x.id !== id; });
  document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(s);
  document.getElementById('lf_tabs_wrap').innerHTML   = _lfTabsHtml();
  _lfSyncEmailDdl();
}

function _lfSyncEmailDdl() {
  var sel = document.getElementById('lf_email_field');
  if (!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">-- เลือก field ที่เป็นอีเมลลูกค้า --</option>';
  _lfSec.common.concat(_lfSec.personal).concat(_lfSec.company).forEach(function(f) {
    if (f.label) sel.innerHTML += '<option value="' + f.id + '"' + (f.id === cur ? ' selected' : '') + '>' + esc(f.label) + '</option>';
  });
}

// ---------- Save / Delete ----------

function saveLeadForm() {
  var title = (document.getElementById('lf_title').value || '').trim();
  if (!title) { alert('กรุณาใส่ชื่อ Form'); return; }

  var action = document.getElementById('lf_action').value;
  var data = {
    title:          title,
    eventName:      (document.getElementById('lf_event').value || '').trim(),
    useTypeToggle:  _lfUseType,
    commonFields:   _lfSec.common.filter(function(f) { return f.label.trim(); }),
    personalFields: _lfSec.personal.filter(function(f) { return f.label.trim(); }),
    companyFields:  _lfSec.company.filter(function(f) { return f.label.trim(); }),
    submitAction:   action,
    active:         true,
    updatedAt:      firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (action === 'redirect') {
    data.redirectUrl = (document.getElementById('lf_redir_url').value || '').trim();
  }
  if (action === 'email') {
    data.emailConfig = {
      toFieldId: document.getElementById('lf_email_field').value,
      subject:   (document.getElementById('lf_email_subj').value || '').trim(),
      body:      (document.getElementById('lf_email_body').value || '').trim(),
    };
  }

  var btn = document.querySelector('#modal-body .btn.bp');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  var prom;
  if (!_editLeadId) {
    data.createdAt        = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy        = CURRENT_USER.email;
    data.submissionsCount = 0;
    prom = db.collection(LEAD_FORM_COL).add(data);
  } else {
    prom = db.collection(LEAD_FORM_COL).doc(_editLeadId).set(data, {merge: true});
  }

  prom.then(function() {
    closeMForce(); rLeads();
    toast('✅ บันทึก Form เรียบร้อย');
  }).catch(function(e) {
    alert('บันทึกไม่ได้: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '💾 บันทึก'; }
  });
}

function deleteLeadForm(formId) {
  if (!confirm('ลบ Form นี้?\n(submissions ที่มีอยู่จะยังคงอยู่ใน Firestore)')) return;
  db.collection(LEAD_FORM_COL).doc(formId).delete().then(function() {
    rLeads(); toast('🗑️ ลบ Form แล้ว');
  });
}

// ---------- QR Modal ----------

function showLeadQR(formId) {
  var base  = window.location.href.replace(/[^/]*$/, '');
  var url   = base + 'lead-form.html?form=' + formId;
  var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?data=' + encodeURIComponent(url) + '&size=220x220&margin=10';
  var h = '<div style="text-align:center;padding:8px;">';
  h += '<img src="' + qrSrc + '" style="border-radius:12px;margin:8px auto;display:block;">';
  h += '<p style="font-size:.78em;color:var(--text2);word-break:break-all;margin:10px 0;">' + esc(url) + '</p>';
  h += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
  h += '<button onclick="navigator.clipboard.writeText(\'' + url.replace(/'/g, "\\'") + '\');toast(\'📋 คัดลอกแล้ว\')" class="btn bo">📋 คัดลอก Link</button>';
  h += '<a href="' + qrSrc + '&format=png" download="qr.png" class="btn bo">⬇️ บันทึก QR</a>';
  h += '</div></div>';
  openM('📱 QR Code & Link', h);
}

// ---------- Analytics ----------

function showLeadFormDetail(formId) {
  var el = document.getElementById('ct');
  el.innerHTML = '<div class="ld-wrap" style="padding:24px;color:var(--text2);">กำลังโหลด...</div>';

  db.collection(LEAD_FORM_COL).doc(formId).get().then(function(fd) {
    if (!fd.exists) return;
    var form = Object.assign({id: fd.id}, fd.data());
    db.collection(LEAD_SUB_COL)
      .where('formId', '==', formId)
      .orderBy('createdAt', 'desc')
      .get()
      .then(function(snap) {
        var subs = [];
        snap.forEach(function(d) { subs.push(Object.assign({id: d.id}, d.data())); });
        _ldCache = {form: form, subs: subs};
        window._ldAllSubs = subs;
        window._ldForm    = form;
        el.innerHTML = _ldAnalyticsHtml(form, subs);
      });
  });
}

function _ldAnalyticsHtml(form, subs) {
  var allFields = (form.commonFields || form.fields || [])
    .concat(form.personalFields || [])
    .concat(form.companyFields  || []);

  var todayStr  = new Date().toISOString().split('T')[0];
  var todayCnt  = subs.filter(function(s) {
    if (!s.createdAt) return false;
    var d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
    return d.toISOString().split('T')[0] === todayStr;
  }).length;
  var pCnt = subs.filter(function(s) { return s.contactType === 'personal'; }).length;
  var cCnt = subs.filter(function(s) { return s.contactType === 'company'; }).length;

  var h = '<div class="ld-wrap">';

  // Header
  h += '<div class="ld-top">';
  h += '<button onclick="rLeads()" class="btn bo" style="margin-right:10px;">← กลับ</button>';
  h += '<h2 class="ld-title" style="flex:1;">' + esc(form.title) + '</h2>';
  if (subs.length) h += '<button onclick="exportLeadSubs()" class="btn bp">📎 Export Excel</button>';
  h += '</div>';

  // Stat cards
  h += '<div class="ld-stats-row">';
  h += _ldStatCard(subs.length, 'ทั้งหมด',  '🙋', '#3b82f6');
  h += _ldStatCard(todayCnt,    'วันนี้',    '📅', '#22c55e');
  if (form.useTypeToggle) {
    h += _ldStatCard(pCnt, 'บุคคล',   '👤', '#a855f7');
    h += _ldStatCard(cCnt, 'บริษัท',  '🏢', '#f97316');
  }
  h += '<div class="ld-stat-actions">';
  h += '<button onclick="showLeadQR(\'' + form.id + '\')" class="btn bsm bo">📱 QR</button>';
  h += '<button onclick="showEditLeadFormM(\'' + form.id + '\')" class="btn bsm bo" style="margin-top:4px;">✏️ แก้ไข</button>';
  h += '</div></div>';

  if (!subs.length) {
    h += '<div style="text-align:center;padding:48px;color:var(--text2);">ยังไม่มีใครกรอกฟอร์มนี้</div>';
    return h + '</div>';
  }

  // Charts
  h += '<div class="ld-charts-row">';

  // Bar chart: submissions per day
  var dayData = _ldDayData(subs, 7);
  h += '<div class="ld-chart-card"><div class="ld-chart-title">📊 Submissions รายวัน (7 วัน)</div>';
  h += _ldBarChartSvg(dayData);
  h += '</div>';

  // Type breakdown
  if (form.useTypeToggle && (pCnt + cCnt > 0)) {
    h += '<div class="ld-chart-card"><div class="ld-chart-title">👥 ประเภทผู้ลงทะเบียน</div>';
    h += _ldTypeBarSvg(pCnt, cCnt);
    h += '</div>';
  }

  // Field insights (select/radio/multicheck)
  var insFields = allFields.filter(function(f) { return f.type === 'select' || f.type === 'radio' || f.type === 'multicheck'; }).slice(0, 3);
  insFields.forEach(function(f) {
    var counts = {};
    subs.forEach(function(s) {
      var v = s.answers && s.answers[f.id];
      if (!v) return;
      // multicheck stores comma-separated values — count each option individually
      if (f.type === 'multicheck') {
        String(v).split(',').forEach(function(part) {
          var p = part.trim(); if (p) counts[p] = (counts[p] || 0) + 1;
        });
      } else {
        counts[v] = (counts[v] || 0) + 1;
      }
    });
    var keys = [];
    for (var k in counts) { if (counts.hasOwnProperty(k)) keys.push(k); }
    if (keys.length) {
      h += '<div class="ld-chart-card"><div class="ld-chart-title">📋 ' + esc(f.label) + '</div>';
      h += _ldFieldBarSvg(counts);
      h += '</div>';
    }
  });

  h += '</div>'; // end charts row

  // Search + table
  h += '<div style="display:flex;align-items:center;gap:10px;margin:20px 0 10px;">';
  h += '<b>ข้อมูลทั้งหมด (' + subs.length + ')</b>';
  h += '<input id="ld_search" class="fm-input" style="max-width:240px;padding:6px 12px;" placeholder="🔍 ค้นหา..." oninput="ldFilterTable(this.value)">';
  h += '</div>';
  h += '<div id="ld_table_wrap" style="overflow-x:auto;">' + _ldTableHtml(form, subs, allFields) + '</div>';
  h += '</div>';
  return h;
}

function _ldStatCard(n, label, icon, color) {
  var c = color || '#3b82f6';
  return '<div class="ld-stat" style="border-top:3px solid ' + c + ';">' +
    '<div class="ld-stat-icon">' + icon + '</div>' +
    '<div class="ld-stat-num" style="color:' + c + ';">' + n + '</div>' +
    '<div class="ld-stat-lbl">' + label + '</div></div>';
}

function ldFilterTable(q) {
  q = (q || '').toLowerCase();
  var filtered = q ? (window._ldAllSubs || []).filter(function(s) {
    return JSON.stringify(s.answers || {}).toLowerCase().indexOf(q) >= 0;
  }) : (window._ldAllSubs || []);
  var allFields = ((window._ldForm.commonFields || window._ldForm.fields || [])
    .concat(window._ldForm.personalFields || [])
    .concat(window._ldForm.companyFields  || []));
  document.getElementById('ld_table_wrap').innerHTML = _ldTableHtml(window._ldForm, filtered, allFields);
}

function _ldTableHtml(form, subs, allFields) {
  if (!subs.length) return '<div style="padding:24px;text-align:center;color:var(--text2);">ไม่พบข้อมูล</div>';
  var h = '<table class="tbl"><thead><tr><th>วันที่</th>';
  if (form.useTypeToggle) h += '<th>ประเภท</th>';
  allFields.forEach(function(f) { h += '<th>' + esc(f.label) + '</th>'; });
  h += '</tr></thead><tbody>';
  subs.forEach(function(s) {
    h += '<tr><td style="white-space:nowrap;font-size:.8em;">' + _ldFmtDate(s.createdAt) + '</td>';
    if (form.useTypeToggle) {
      h += '<td>' + (s.contactType === 'personal' ? '👤 บุคคล' : s.contactType === 'company' ? '🏢 บริษัท' : '—') + '</td>';
    }
    allFields.forEach(function(f) {
      var v = (s.answers && s.answers[f.id] !== undefined) ? s.answers[f.id] : '';
      if (f.type === 'rating')   v = '⭐'.repeat(parseInt(v) || 0) || '—';
      if (f.type === 'checkbox') v = v ? '✅' : '—';
      h += '<td>' + esc(String(v === '' ? '—' : v)) + '</td>';
    });
    h += '</tr>';
  });
  return h + '</tbody></table>';
}

// ---------- SVG Charts ----------

function _ldDayData(subs, days) {
  var result = [];
  for (var i = days - 1; i >= 0; i--) {
    var d   = new Date();
    d.setDate(d.getDate() - i);
    var key = d.toISOString().split('T')[0];
    var lbl = d.getDate() + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
    var cnt = subs.filter(function(s) {
      if (!s.createdAt) return false;
      var sd = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      return sd.toISOString().split('T')[0] === key;
    }).length;
    result.push({lbl: lbl, cnt: cnt});
  }
  return result;
}

function _ldBarChartSvg(data) {
  var W = 320, H = 120, padL = 12, padR = 12, padT = 20, padB = 28;
  var maxV = 1;
  data.forEach(function(d) { if (d.cnt > maxV) maxV = d.cnt; });
  var cols = data.length;
  var slot = (W - padL - padR) / cols;
  var bw   = Math.max(6, Math.floor(slot * 0.6));
  var svg  = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;overflow:visible">';
  // grid lines
  for (var g = 1; g <= 3; g++) {
    var gy = padT + (H - padT - padB) * (1 - g / 3);
    svg += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + gy.toFixed(1) + '" stroke="rgba(255,255,255,.06)" stroke-width="1" stroke-dasharray="3,3"/>';
  }
  // baseline
  svg += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" stroke="rgba(255,255,255,.1)" stroke-width="1"/>';
  data.forEach(function(d, i) {
    var cx  = padL + slot * i + slot / 2;
    var x   = cx - bw / 2;
    var bh  = Math.max(2, (H - padT - padB) * d.cnt / maxV);
    var y   = H - padB - bh;
    var isToday = (i === data.length - 1);
    var fill = isToday ? '#3b82f6' : (d.cnt > 0 ? '#1e4080' : '#1a2744');
    svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + bh.toFixed(1) + '" rx="4" fill="' + fill + '"/>';
    svg += '<text x="' + cx.toFixed(1) + '" y="' + (H - padB + 14) + '" text-anchor="middle" fill="#475569" font-size="9">' + d.lbl + '</text>';
    if (d.cnt > 0) {
      svg += '<text x="' + cx.toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle" fill="' + (isToday ? '#93c5fd' : '#64748b') + '" font-size="10" font-weight="' + (isToday ? '600' : '400') + '">' + d.cnt + '</text>';
    }
  });
  return svg + '</svg>';
}

function _ldTypeBarSvg(pCnt, cCnt) {
  var total = pCnt + cCnt || 1;
  var W = 260, bh = 16, gap = 36;
  var H = gap * 2 + 8;
  var barW = W - 20;
  var pW = Math.max(4, Math.round(barW * pCnt / total));
  var cW = Math.max(4, Math.round(barW * cCnt / total));
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px">';
  // track
  svg += '<rect x="10" y="2" width="' + barW + '" height="' + bh + '" rx="8" fill="rgba(255,255,255,.05)"/>';
  svg += '<rect x="10" y="2" width="' + pW + '" height="' + bh + '" rx="8" fill="#3b82f6"/>';
  svg += '<text x="10" y="32" fill="#94a3b8" font-size="11.5">👤 บุคคล</text>';
  svg += '<text x="' + (W - 10) + '" y="32" text-anchor="end" fill="#60a5fa" font-size="12" font-weight="600">' + pCnt + ' (' + Math.round(pCnt / total * 100) + '%)</text>';
  // track 2
  svg += '<rect x="10" y="' + (gap + 2) + '" width="' + barW + '" height="' + bh + '" rx="8" fill="rgba(255,255,255,.05)"/>';
  svg += '<rect x="10" y="' + (gap + 2) + '" width="' + cW + '" height="' + bh + '" rx="8" fill="#a855f7"/>';
  svg += '<text x="10" y="' + (gap + 32) + '" fill="#94a3b8" font-size="11.5">🏢 บริษัท</text>';
  svg += '<text x="' + (W - 10) + '" y="' + (gap + 32) + '" text-anchor="end" fill="#c084fc" font-size="12" font-weight="600">' + cCnt + ' (' + Math.round(cCnt / total * 100) + '%)</text>';
  return svg + '</svg>';
}

function _ldFieldBarSvg(counts) {
  var entries = [];
  for (var k in counts) { if (counts.hasOwnProperty(k)) entries.push([k, counts[k]]); }
  entries.sort(function(a, b) { return b[1] - a[1]; });
  entries = entries.slice(0, 6);
  var maxV = entries[0] ? entries[0][1] : 1;
  var rowH = 26, padTop = 2, labelW = 88, gap = 8, numW = 28;
  var W    = 260;
  var H    = padTop + entries.length * rowH;
  var barAreaW = W - labelW - gap - numW;
  var svg  = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px">';
  entries.forEach(function(e, i) {
    var y   = padTop + i * rowH;
    var bh  = 14;
    var by  = y + (rowH - bh) / 2;
    var bw  = Math.max(4, Math.round(barAreaW * e[1] / maxV));
    var pct = Math.round(e[1] / maxV * 100);
    // track bg
    svg += '<rect x="' + labelW + '" y="' + by.toFixed(1) + '" width="' + barAreaW + '" height="' + bh + '" rx="7" fill="rgba(255,255,255,.05)"/>';
    // bar (gradient from blue-dark to blue)
    var fillColor = i === 0 ? '#3b82f6' : (i === 1 ? '#2563eb' : '#1e4080');
    svg += '<rect x="' + labelW + '" y="' + by.toFixed(1) + '" width="' + bw + '" height="' + bh + '" rx="7" fill="' + fillColor + '"/>';
    // label
    var lbl = String(e[0]);
    if (lbl.length > 12) lbl = lbl.slice(0, 11) + '…';
    svg += '<text x="' + (labelW - 6) + '" y="' + (by + bh / 2 + 4) + '" text-anchor="end" fill="#94a3b8" font-size="10.5">' + esc(lbl) + '</text>';
    // count
    svg += '<text x="' + (labelW + barAreaW + 4) + '" y="' + (by + bh / 2 + 4) + '" fill="' + (i === 0 ? '#93c5fd' : '#64748b') + '" font-size="11" font-weight="' + (i === 0 ? '600' : '400') + '">' + e[1] + '</text>';
  });
  return svg + '</svg>';
}

// ---------- Date / Export ----------

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
  var fields = (form.commonFields || form.fields || []).concat(form.personalFields || []).concat(form.companyFields || []);
  var header = ['วันที่'];
  if (form.useTypeToggle) header.push('ประเภท');
  header = header.concat(fields.map(function(f) { return f.label; }));
  var rows = [header];
  subs.forEach(function(s) {
    var row = [_ldFmtDate(s.createdAt)];
    if (form.useTypeToggle) row.push(s.contactType === 'personal' ? 'บุคคล' : s.contactType === 'company' ? 'บริษัท' : '');
    fields.forEach(function(f) { row.push((s.answers && s.answers[f.id] !== undefined) ? s.answers[f.id] : ''); });
    rows.push(row);
  });
  var ws = XLSX.utils.aoa_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
  XLSX.writeFile(wb, form.title + '_submissions.xlsx');
}
