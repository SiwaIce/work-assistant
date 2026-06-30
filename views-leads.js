// === LEAD FORMS — Event Lead Capture ===

var LEAD_FORM_COL = 'leadForms';
var LEAD_SUB_COL  = 'leadSubmissions';

var LEAD_FIELD_TYPES = [
  {v:'text',       l:'ข้อความสั้น'},
  {v:'textarea',   l:'ข้อความยาว'},
  {v:'email',      l:'อีเมล'},
  {v:'phone',      l:'เบอร์โทรศัพท์'},
  {v:'number',     l:'ตัวเลข'},
  {v:'select',     l:'Dropdown (เลือก 1)'},
  {v:'radio',      l:'Radio (เลือก 1)'},
  {v:'checkbox',   l:'Checkbox'},
  {v:'multicheck', l:'Checkbox หลายตัวเลือก'},
  {v:'date',       l:'วันที่'},
  {v:'rating',     l:'Rating (ดาว 1–5)'},
  {v:'section',    l:'── หัวข้อ Section ──'},
  {v:'image',      l:'🖼️ แสดงรูปภาพ'},
  {v:'video',      l:'▶️ วิดีโอ YouTube'},
];

// ---------- State ----------
var _editLeadId = null;
var _lfSec      = {common: [], personal: [], company: []};
var _lfTab      = 'common';
var _lfUseType  = false;
var _ldCache    = null;
var _ldFilter   = {type: 'all', date: 'all'};

// ---------- Main list ----------

function rLeads() {
  var el = document.getElementById('ct');
  el.innerHTML = '<div class="ld-wrap"><div class="ld-top"><h2 class="ld-title">📋 Lead Forms</h2>' +
    '<button onclick="showCreateLeadFormM()" class="btn bp">+ สร้าง Form ใหม่</button></div>' +
    '<div style="padding:24px;color:var(--text2)">กำลังโหลด...</div></div>';

  Promise.all([
    db.collection(LEAD_FORM_COL).orderBy('createdAt', 'desc').get(),
    db.collection(LEAD_SUB_COL).get()
  ]).then(function(results) {
    var forms = [], counts = {};
    results[0].forEach(function(d) { forms.push(Object.assign({id: d.id}, d.data())); });
    results[1].forEach(function(d) {
      var fid = d.data().formId;
      if (fid) counts[fid] = (counts[fid] || 0) + 1;
    });
    forms.forEach(function(f) { f._realCount = counts[f.id] || 0; });
    document.getElementById('ct').innerHTML = _ldListHtml(forms);
  }).catch(function(e) {
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
    var noSec  = function(arr) { return (arr||[]).filter(function(x){ return x.type!=='section'; }); };
    var total  = noSec(f.commonFields||f.fields).length + noSec(f.personalFields).length + noSec(f.companyFields).length;
    h += '<div class="ld-card">';
    h += '<div class="ld-card-hd"><span class="ld-card-title">' + esc(f.title) + '</span>';
    h += '<span class="ld-badge ' + aCls + '">' + aLabel + '</span></div>';
    if (f.eventName) h += '<div class="ld-card-event">📍 ' + esc(f.eventName) + '</div>';
    h += '<div class="ld-card-stats"><span>' + total + ' fields</span>';
    if (f.useTypeToggle) h += '<span class="ld-badge ld-badge-purple">👤🏢 แยกประเภท</span>';
    h += '<span style="margin-left:auto;">🙋 <b>' + (f._realCount || 0) + '</b></span></div>';
    h += '<div class="ld-card-actions">';
    h += '<button onclick="showLeadFormDetail(\'' + f.id + '\')" class="btn bsm bo">📊 ดูข้อมูล</button>';
    h += '<button onclick="showEditLeadFormM(\'' + f.id + '\')" class="btn bsm bo">✏️ แก้ไข</button>';
    h += '<button onclick="previewLeadForm(\'' + f.id + '\')" class="btn bsm bo" title="ดูตัวอย่างฟอร์ม">👁 Preview</button>';
    h += '<button onclick="showLeadQR(\'' + f.id + '\')" class="btn bsm bo">📱 QR</button>';
    h += '<button onclick="copyLeadForm(\'' + f.id + '\')" class="btn bsm bo" title="คัดลอก Form">📋</button>';
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
  var eCfg = (f && f.emailConfig) || {};
  var rUrl = (f && f.redirectUrl) || '';
  var coverImage = (f && f.coverImage) || '';
  var logoUrl = (f && f.logoUrl) || '';
  var description = (f && f.description) || '';
  var themeColor = (f && f.themeColor) || '#2563eb';
  var countdownEnd = (f && f.countdownEnd) || '';
  var totalF = _lfSec.common.length + _lfSec.personal.length + _lfSec.company.length;

  var h = '<div style="width:100%;display:grid;grid-template-columns:1fr 220px;border-radius:0;min-height:560px">';

  // ─── LEFT PANEL ───
  h += '<div style="display:flex;flex-direction:column;border-right:1px solid var(--border,#334155)">';

  // High-level tab bar
  h += '<div style="display:flex;border-bottom:1px solid var(--border,#334155);background:var(--card,#1e293b)">';
  h += '<button type="button" class="lf-btab on" id="lf-btab-basic" onclick="lfBuilderTab(\'basic\')">ตั้งค่าหลัก</button>';
  h += '<button type="button" class="lf-btab" id="lf-btab-fields" onclick="lfBuilderTab(\'fields\')">Fields <span id="lf-btab-fcnt">(' + totalF + ')</span></button>';
  h += '<button type="button" class="lf-btab" id="lf-btab-design" onclick="lfBuilderTab(\'design\')">ออกแบบ</button>';
  h += '</div>';

  // ── Pane: Basic ──
  h += '<div id="lf-pane-basic" style="flex:1;overflow-y:auto;padding:14px">';
  h += '<div class="fg"><label>ชื่อ Form *</label><input id="lf_title" class="fm-input" value="' + esc(f ? f.title || '' : '') + '" placeholder="เช่น Lead Form — DJI Drone Show 2026" oninput="lfUpdatePreview()"></div>';
  h += '<div class="fg"><label>ชื่องาน / Event</label><input id="lf_event" class="fm-input" value="' + esc(f ? f.eventName || '' : '') + '" placeholder="เช่น DJI Partner Day Bangkok" oninput="lfUpdatePreview()"></div>';
  h += '<div style="display:flex;align-items:center;gap:10px;background:var(--bg,#0f172a);padding:12px;border-radius:10px;margin-bottom:12px">';
  h += '<input type="checkbox" id="lf_usetype" ' + (_lfUseType ? 'checked' : '') + ' onchange="_lfToggleType(this.checked)" style="width:18px;height:18px;accent-color:#3b82f6;flex-shrink:0">';
  h += '<div><div style="font-size:.88em;font-weight:600">แยก Section บุคคล / บริษัท</div><div style="font-size:.78em;color:var(--text2)">ลูกค้าเลือกประเภทก่อน แล้ว fields เปลี่ยนตาม</div></div></div>';
  h += '<div class="fg"><label>หลัง Submit</label><select id="lf_action" class="fm-input" onchange="lfToggleActionSec()">';
  h += '<option value="only"' + (action === 'only' ? ' selected' : '') + '>📥 แสดง "ขอบคุณ" เฉยๆ</option>';
  h += '<option value="redirect"' + (action === 'redirect' ? ' selected' : '') + '>🔗 พาไปที่ Link</option>';
  h += '<option value="email"' + (action === 'email' ? ' selected' : '') + '>📧 ส่งอีเมลให้ลูกค้า</option>';
  h += '</select></div>';
  h += '<div id="lf_redir_sec" style="' + (action !== 'redirect' ? 'display:none;' : '') + '">';
  h += '<div class="fg"><label>URL ปลายทาง</label><input id="lf_redir_url" class="fm-input" value="' + esc(rUrl) + '" placeholder="https://..."></div></div>';
  h += '<div id="lf_email_sec" style="' + (action !== 'email' ? 'display:none;' : '') + 'background:var(--bg,#0f172a);border-radius:10px;padding:14px;margin-bottom:12px">';
  h += '<b style="font-size:.85em">⚙️ ตั้งค่าอีเมล</b>';
  h += '<div class="fg" style="margin-top:10px"><label>Field ที่เป็นอีเมลลูกค้า</label><select id="lf_email_field" class="fm-input"></select></div>';
  h += '<div class="fg"><label>Subject</label><input id="lf_email_subj" class="fm-input" value="' + esc(eCfg.subject || '') + '" placeholder="เช่น ขอบคุณที่สนใจ DJI"></div>';
  h += '<div class="fg"><label>เนื้อหา <small style="color:var(--text2)">(ใช้ {{ชื่อ Field}} แทนข้อมูลที่กรอก)</small></label><textarea id="lf_email_body" class="fm-input" rows="3">' + esc(eCfg.body || '') + '</textarea></div>';
  h += '</div>';
  h += '</div>'; // pane-basic

  // ── Pane: Fields ──
  h += '<div id="lf-pane-fields" style="flex:1;overflow-y:auto;padding:14px;display:none">';
  h += '<div id="lf_tabs_wrap">' + _lfTabsHtml() + '</div>';
  h += '<div id="lf_fields_wrap">' + _lfSecHtml(_lfTab) + '</div>';
  h += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#334155)">';
  h += '<div style="font-size:10px;color:var(--text2);font-weight:600;letter-spacing:.5px;margin-bottom:8px">เพิ่ม FIELD ใหม่</div>';
  h += _lfTypeChipsHtml();
  h += '</div></div>'; // pane-fields

  // ── Pane: Design ──
  h += '<div id="lf-pane-design" style="flex:1;overflow-y:auto;padding:14px;display:none">';
  h += '<div class="fg"><label>🖼️ Cover Image URL <small style="color:var(--text2)">(แบนเนอร์หัวฟอร์ม)</small></label><input id="lf_cover_img" class="fm-input" value="' + esc(coverImage) + '" placeholder="https://..."></div>';
  h += '<div class="fg"><label>🏷️ Logo URL</label><input id="lf_logo_url" class="fm-input" value="' + esc(logoUrl) + '" placeholder="https://..."></div>';
  h += '<div class="fg"><label>📝 คำอธิบายฟอร์ม</label><textarea id="lf_desc" class="fm-input" rows="3" placeholder="รายละเอียดหรือคำชี้แจงสำหรับลูกค้า">' + esc(description) + '</textarea></div>';
  h += '<div class="fg"><label>🎨 สีธีมหลัก</label><div style="display:flex;align-items:center;gap:8px"><input type="color" id="lf_theme_color" value="' + esc(themeColor) + '" style="width:42px;height:36px;padding:2px;border-radius:6px;border:1px solid var(--border,#334155);cursor:pointer"><span style="font-size:.78rem;color:var(--text2)">สีปุ่ม / accent</span></div></div>';
  h += '<div class="fg"><label>⏱️ Countdown ถึงวันที่</label><input type="datetime-local" id="lf_countdown" class="fm-input" value="' + esc(countdownEnd) + '"></div>';
  h += '</div>'; // pane-design

  // Action buttons (bottom of left)
  h += '<div style="padding:10px 14px;border-top:1px solid var(--border,#334155);display:flex;gap:8px">';
  h += '<button onclick="saveLeadForm()" class="btn bp" style="flex:1">💾 บันทึก Form</button>';
  h += '<button onclick="closeMForce()" class="btn bo">ยกเลิก</button>';
  h += '</div>';
  h += '</div>'; // left panel

  // ─── RIGHT PANEL: Preview ───
  h += '<div id="lf-preview-panel" style="background:var(--bg,#0f172a);padding:14px;display:flex;flex-direction:column">';
  h += _lfPreviewPanelHtml();
  h += '</div>';

  h += '</div>'; // grid

  // Inject CSS for new classes
  var sty = document.createElement('style');
  sty.textContent = '.lf-btab{padding:9px 14px;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;font-size:12px;color:var(--text2,#94a3b8);font-family:inherit;transition:.1s}.lf-btab.on{color:var(--blue,#60a5fa);border-bottom-color:var(--blue,#3b82f6)}.lf-btab:hover:not(.on){background:rgba(255,255,255,.04)}.lf-frow2{background:var(--bg,#0f172a);border:1px solid var(--border,#334155);border-radius:8px;margin-bottom:6px;overflow:hidden}.lf-fhd2{display:flex;align-items:center;gap:7px;padding:9px 10px;cursor:pointer;user-select:none}.lf-fhd2:hover{background:rgba(255,255,255,.04)}.lf-fbody{display:none;padding:0 10px 10px;border-top:1px solid var(--border,#334155)}.lf-fbody.open{display:block}.lf-tbadge{padding:2px 6px;border-radius:20px;font-size:9px;font-weight:600;flex-shrink:0}.lf-req-badge{background:rgba(239,68,68,.15);color:#f87171;padding:2px 5px;border-radius:20px;font-size:9px;flex-shrink:0}.lf-type-chip{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 4px;border:1px solid var(--border,#334155);border-radius:8px;cursor:pointer;background:var(--bg,#0f172a);font-size:9px;color:var(--text2,#94a3b8);font-family:inherit;transition:.12s}.lf-type-chip:hover{border-color:var(--blue,#3b82f6);color:var(--blue,#60a5fa);background:rgba(59,130,246,.08)}.lf-btab-fcnt{color:var(--text2,#94a3b8)}';
  document.head.appendChild(sty);

  openM((isEdit ? '✏️ แก้ไข' : '➕ สร้าง') + ' Lead Form', h);
  var _mlb = document.querySelector('.mlb');
  if (_mlb) { _mlb.style.maxWidth = '900px'; _mlb.style.maxHeight = '96vh'; }
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
      secHint + '<br><small>กด chip ด้านล่างเพื่อเพิ่ม Field</small></div>';
  }
  var badgeMap = {
    text:'background:#1e3a5f;color:#60a5fa', phone:'background:#1e3a5f;color:#60a5fa',
    email:'background:#1e3a5f;color:#60a5fa', textarea:'background:#1e3a5f;color:#60a5fa',
    number:'background:#1e3a5f;color:#60a5fa', date:'background:#1e3a5f;color:#60a5fa',
    select:'background:#1a2e1a;color:#4ade80', radio:'background:#1a2e1a;color:#4ade80',
    checkbox:'background:#1a2e1a;color:#4ade80',
    multicheck:'background:#0f2030;color:#38bdf8',
    rating:'background:#2d1f00;color:#fb923c',
    section:'background:#1e1b2e;color:#a78bfa',
    image:'background:#2d1515;color:#f87171', video:'background:#2d1515;color:#f87171'
  };
  var h = '';
  fields.forEach(function(f, idx) {
    var isSec = f.type === 'section';
    var isImg = f.type === 'image';
    var isVid = f.type === 'video';
    var isDisplay = isSec || isImg || isVid;
    var hasOpts = !isDisplay && (f.type === 'select' || f.type === 'radio' || f.type === 'multicheck');
    var bs = badgeMap[f.type] || 'background:var(--border);color:var(--text2)';
    h += '<div class="lf-frow2" id="lfrow_' + f.id + '">';
    // Header
    h += '<div class="lf-fhd2" onclick="lfToggleFRow(\'' + f.id + '\')">';
    h += '<span style="color:var(--text2,#94a3b8);font-size:13px;cursor:grab">⠿</span>';
    h += '<span class="lf-tbadge" style="' + bs + '">' + _lfTypeBadge(f.type) + '</span>';
    h += '<span style="flex:1;font-size:12px;color:' + (f.label ? 'var(--text,#f1f5f9)' : 'var(--text2,#94a3b8)') + '" id="lflbl_' + f.id + '">' + esc(f.label || '(ยังไม่ใส่ชื่อ)') + '</span>';
    if (f.required) h += '<span class="lf-req-badge">*บังคับ</span>';
    h += '<div style="display:flex;gap:3px" onclick="event.stopPropagation()">';
    h += '<button type="button" onclick="_lfMoveF(\'' + sec + '\',\'' + f.id + '\',-1)" class="btn bsm bo" title="เลื่อนขึ้น"' + (idx === 0 ? ' disabled' : '') + '>▲</button>';
    h += '<button type="button" onclick="_lfMoveF(\'' + sec + '\',\'' + f.id + '\',1)" class="btn bsm bo" title="เลื่อนลง"' + (idx === fields.length - 1 ? ' disabled' : '') + '>▼</button>';
    h += '<button type="button" onclick="_lfDupF(\'' + sec + '\',\'' + f.id + '\')" class="btn bsm bo" title="คัดลอก">📋</button>';
    h += '<button type="button" onclick="_lfDelF(\'' + sec + '\',\'' + f.id + '\')" class="btn bsm bd">✕</button>';
    h += '</div>';
    h += '<span style="color:var(--text2,#94a3b8);font-size:11px" id="lf-chev-' + f.id + '">▾</span>';
    h += '</div>';
    // Body (collapsible)
    h += '<div class="lf-fbody" id="lfbody_' + f.id + '">';
    var lblPh = isSec ? 'ชื่อหัวข้อ Section' : isImg ? 'คำอธิบายรูป (ไม่บังคับ)' : isVid ? 'ชื่อวิดีโอ (ไม่บังคับ)' : 'ชื่อ Field เช่น บริษัท';
    h += '<div style="display:flex;gap:6px;margin-top:8px;align-items:center">';
    h += '<input class="fm-input lf-flbl" style="flex:2" placeholder="' + lblPh + '" value="' + esc(f.label) + '" oninput="_lfSetLabel(\'' + sec + '\',\'' + f.id + '\',this.value);var sp=document.getElementById(\'lflbl_' + f.id + '\');if(sp){sp.textContent=this.value||\'(ยังไม่ใส่ชื่อ)\';sp.style.color=this.value?\'var(--text,#f1f5f9)\':\'var(--text2,#94a3b8)\';}lfUpdatePreview()">';
    h += '<select class="fm-input lf-ftype" style="flex:1" onchange="_lfSetType(\'' + sec + '\',\'' + f.id + '\',this.value)">';
    LEAD_FIELD_TYPES.forEach(function(t) { h += '<option value="' + t.v + '"' + (f.type === t.v ? ' selected' : '') + '>' + t.l + '</option>'; });
    h += '</select>';
    if (!isDisplay) h += '<label class="lf-req-chk" title="บังคับกรอก" style="font-size:11px;display:flex;align-items:center;gap:4px;cursor:pointer;flex-shrink:0"><input type="checkbox" ' + (f.required ? 'checked' : '') + ' onchange="_lfSetReq(\'' + sec + '\',\'' + f.id + '\',this.checked)"> บังคับ</label>';
    h += '</div>';
    if (isImg) {
      h += '<div style="margin-top:6px"><input class="fm-input lf-hint-inp" placeholder="🔗 URL รูปภาพ https://..." value="' + esc(f.url || '') + '" oninput="_lfSetUrl(\'' + sec + '\',\'' + f.id + '\',this.value)">';
      if (f.url) h += '<img src="' + esc(f.url) + '" style="max-height:60px;border-radius:5px;margin-top:4px;display:block" onerror="this.style.display=\'none\'">';
      h += '</div>';
    }
    if (isVid) h += '<div style="margin-top:6px"><input class="fm-input lf-hint-inp" placeholder="🎬 YouTube URL" value="' + esc(f.url || '') + '" oninput="_lfSetUrl(\'' + sec + '\',\'' + f.id + '\',this.value)"></div>';
    if (!isDisplay) h += '<div style="margin-top:6px"><input class="fm-input lf-hint-inp" style="font-size:11px" placeholder="💡 hint ให้ลูกค้า (ไม่บังคับ)" value="' + esc(f.hint || '') + '" oninput="_lfSetHint(\'' + sec + '\',\'' + f.id + '\',this.value)"></div>';
    if (f.type === 'rating') {
      var rMax = f.ratingMax || 5;
      h += '<div style="margin-top:6px;display:flex;align-items:center;gap:8px"><span style="font-size:.8em;color:var(--text2)">จำนวนดาวสูงสุด</span><select class="fm-input" style="width:90px" onchange="_lfSetRatingMax(\'' + sec + '\',\'' + f.id + '\',this.value)">';
      [3,5,10].forEach(function(n){ h += '<option value="' + n + '"' + (rMax===n?' selected':'') + '>' + n + ' ดาว</option>'; });
      h += '</select></div>';
    }
    if (hasOpts) {
      if (f.type === 'multicheck') {
        h += _lfMcOptsHtml(sec, f);
      } else {
        h += '<div class="lf-opts-wrap"><small style="color:var(--text2)">ตัวเลือก (1 บรรทัด = 1 ตัวเลือก)</small><textarea class="fm-input" rows="3" oninput="_lfSetOpts(\'' + sec + '\',\'' + f.id + '\',this.value)">' + esc((f.options||[]).map(function(o){return typeof o==='string'?o:(o.label||'');}).join('\n')) + '</textarea></div>';
      }
    }
    var trigFields = fields.filter(function(tf) { return tf.id !== f.id && (tf.type==='radio'||tf.type==='select'||tf.type==='multicheck') && tf.label; });
    if (!isDisplay && trigFields.length) {
      h += '<div class="lf-cond-wrap">';
      h += '<span class="lf-cond-lbl">⚡ แสดงเมื่อ</span>';
      h += '<select class="fm-input lf-cond-sel" onchange="_lfSetCondField(\'' + sec + '\',\'' + f.id + '\',this.value)">';
      h += '<option value="">— ไม่มีเงื่อนไข —</option>';
      trigFields.forEach(function(tf) { h += '<option value="' + tf.id + '"' + (f.condition&&f.condition.fieldId===tf.id?' selected':'') + '>' + esc(tf.label) + '</option>'; });
      h += '</select>';
      if (f.condition && f.condition.fieldId) {
        h += '<span class="lf-cond-eq"> = </span><input class="fm-input lf-cond-val" placeholder="ค่าที่ต้องตรงกัน" value="' + esc(f.condition.value||'') + '" oninput="_lfSetCondVal(\'' + sec + '\',\'' + f.id + '\',this.value)">';
      }
      h += '</div>';
    }
    h += '</div></div>'; // fbody + frow2
  });
  return h;
}

function _lfTypeBadge(type) {
  var m = {text:'ข้อความ',textarea:'ข้อความยาว',email:'อีเมล',phone:'เบอร์โทร',number:'ตัวเลข',select:'Dropdown',radio:'Radio',checkbox:'Checkbox',multicheck:'Checkbox+รูป',date:'วันที่',rating:'Rating',section:'Section',image:'รูปภาพ',video:'วิดีโอ'};
  return m[type] || type;
}
function lfToggleFRow(id) {
  var b = document.getElementById('lfbody_' + id);
  var c = document.getElementById('lf-chev-' + id);
  if (b) { b.classList.toggle('open'); if (c) c.textContent = b.classList.contains('open') ? '▴' : '▾'; }
}
function lfBuilderTab(t) {
  ['basic','fields','design'].forEach(function(k) {
    var p = document.getElementById('lf-pane-' + k);
    var b = document.getElementById('lf-btab-' + k);
    if (p) p.style.display = k === t ? '' : 'none';
    if (b) b.classList.toggle('on', k === t);
  });
  lfUpdatePreview();
}
function _lfTypeChipsHtml() {
  var types = [
    {v:'text',l:'ข้อความ',i:'📝'},{v:'phone',l:'เบอร์โทร',i:'📱'},{v:'email',l:'อีเมล',i:'✉️'},
    {v:'textarea',l:'ข้อความยาว',i:'📄'},{v:'select',l:'Dropdown',i:'▾'},{v:'radio',l:'Radio',i:'⊙'},
    {v:'multicheck',l:'Checkbox+รูป',i:'☑️'},{v:'date',l:'วันที่',i:'📅'},
    {v:'rating',l:'Rating',i:'⭐'},{v:'number',l:'ตัวเลข',i:'#'},{v:'section',l:'Section',i:'—'},{v:'image',l:'รูปภาพ',i:'🖼️'}
  ];
  var h = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">';
  types.forEach(function(t) {
    h += '<button type="button" class="lf-type-chip" onclick="lfAddFieldOfType(\'' + t.v + '\')" title="' + t.l + '"><span style="font-size:14px">' + t.i + '</span><span>' + t.l + '</span></button>';
  });
  return h + '</div>';
}
function lfAddFieldOfType(type) {
  _lfSec[_lfTab].push({id:_lfId(), label:'', type:type, required:false, options:[]});
  document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(_lfTab);
  document.getElementById('lf_tabs_wrap').innerHTML = _lfTabsHtml();
  var cnt = document.getElementById('lf-btab-fcnt');
  if (cnt) cnt.textContent = '(' + (_lfSec.common.length+_lfSec.personal.length+_lfSec.company.length) + ')';
  _lfSyncEmailDdl();
  setTimeout(function() {
    var rows = document.querySelectorAll('.lf-frow2');
    if (rows.length) {
      var last = rows[rows.length - 1];
      var body = last.querySelector('.lf-fbody');
      if (body) body.classList.add('open');
      last.scrollIntoView({behavior:'smooth',block:'nearest'});
      var inp = last.querySelector('.lf-flbl');
      if (inp) inp.focus();
    }
  }, 60);
  lfUpdatePreview();
}
function _lfPreviewPanelHtml() {
  var all = _lfSec.common.concat(_lfSec.personal).concat(_lfSec.company);
  var fc = all.filter(function(f){return f.type!=='section';}).length;
  var rc = all.filter(function(f){return f.required;}).length;
  var h = '<div style="font-size:10px;color:var(--text2,#94a3b8);font-weight:600;letter-spacing:.5px;margin-bottom:10px">PREVIEW</div>';
  h += '<div style="display:flex;gap:8px;margin-bottom:12px">';
  h += '<div style="flex:1;background:var(--card,#1e293b);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--text,#f1f5f9)">' + fc + '</div><div style="font-size:10px;color:var(--text2)">fields</div></div>';
  h += '<div style="flex:1;background:var(--card,#1e293b);border-radius:8px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#f87171">' + rc + '</div><div style="font-size:10px;color:var(--text2)">บังคับ</div></div>';
  h += '</div>';
  h += '<div style="font-size:10px;color:var(--text2);font-weight:600;margin-bottom:6px">FIELD LIST</div>';
  all.slice(0,14).forEach(function(f) {
    if (f.type==='section') {
      h += '<div style="font-size:10px;color:var(--text2);padding:3px 0;border-top:1px solid var(--border,#334155);margin:3px 0;font-weight:600">── ' + esc(f.label||'Section') + '</div>';
    } else {
      h += '<div style="display:flex;gap:5px;align-items:center;padding:4px 0;border-bottom:1px solid var(--border,#334155)">';
      h += '<span style="flex:1;font-size:10px;color:var(--text,#f1f5f9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.label||'(ยังไม่ตั้งชื่อ)') + '</span>';
      h += '<span style="font-size:9px;color:var(--text2)">' + _lfTypeBadge(f.type) + '</span>';
      if (f.required) h += '<span style="font-size:9px;color:#f87171">*</span>';
      h += '</div>';
    }
  });
  if (all.length > 14) h += '<div style="font-size:10px;color:var(--text2);text-align:center;padding:4px 0">... +'+(all.length-14)+' อีก</div>';
  return h;
}
function lfUpdatePreview() {
  var el = document.getElementById('lf-preview-panel'); if (!el) return;
  el.innerHTML = _lfPreviewPanelHtml();
}

function lfAddField() { lfAddFieldOfType('text'); }

function _lfGet(sec, id)       { return (_lfSec[sec] || []).find(function(x) { return x.id === id; }); }
function _lfSetLabel(s, id, v) { var f = _lfGet(s, id); if (f) f.label = v; _lfSyncEmailDdl(); }
function _lfSetReq(s, id, v)   { var f = _lfGet(s, id); if (f) f.required = v; }
function _lfSetOpts(s, id, v)  { var f = _lfGet(s, id); if (f) f.options = v.split('\n').map(function(x) { return x.trim(); }).filter(Boolean); }
function _lfMcOptsHtml(sec, f) {
  var h = '<div class="lf-opts-wrap"><small style="color:var(--text2);">ตัวเลือก + รูปภาพ (ไม่บังคับ)</small>';
  (f.options || []).forEach(function(o, i) {
    var lbl = typeof o === 'string' ? o : (o.label || '');
    var img = typeof o === 'object' ? (o.img || '') : '';
    h += '<div style="display:flex;gap:5px;margin-top:6px;align-items:center">';
    h += '<input class="fm-input" style="flex:2;min-width:0" placeholder="ชื่อตัวเลือก *" value="' + esc(lbl) + '" oninput="_lfMcSetLbl(\'' + sec + '\',\'' + f.id + '\',' + i + ',this.value)">';
    h += '<input class="fm-input" style="flex:3;min-width:0;font-size:11px" placeholder="URL รูปภาพ (ไม่บังคับ)" value="' + esc(img) + '" oninput="_lfMcSetImg(\'' + sec + '\',\'' + f.id + '\',' + i + ',this.value)">';
    h += '<button type="button" class="btn bsm bd" onclick="_lfMcDel(\'' + sec + '\',\'' + f.id + '\',' + i + ')">✕</button>';
    h += '</div>';
  });
  h += '<button type="button" class="btn bsm bo" style="margin-top:8px;width:100%" onclick="_lfMcAdd(\'' + sec + '\',\'' + f.id + '\')">+ เพิ่มตัวเลือก</button>';
  h += '</div>';
  return h;
}
function _lfMcSetLbl(s, id, i, v) {
  var f = _lfGet(s, id); if (!f) return;
  var o = f.options[i];
  f.options[i] = { label: v, img: typeof o === 'object' ? (o.img || '') : '' };
}
function _lfMcSetImg(s, id, i, v) {
  var f = _lfGet(s, id); if (!f) return;
  var o = f.options[i];
  f.options[i] = { label: typeof o === 'string' ? o : (o.label || ''), img: v };
}
function _lfMcAdd(s, id) {
  var f = _lfGet(s, id); if (!f) return;
  f.options.push({ label: '', img: '' });
  document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(s);
}
function _lfMcDel(s, id, i) {
  var f = _lfGet(s, id); if (!f) return;
  f.options.splice(i, 1);
  document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(s);
}
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

function _lfMoveF(s, id, dir) {
  var arr = _lfSec[s];
  var idx = arr.findIndex(function(x) { return x.id === id; });
  if (idx < 0) return;
  var to = idx + dir;
  if (to < 0 || to >= arr.length) return;
  var tmp = arr[idx]; arr[idx] = arr[to]; arr[to] = tmp;
  document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(s);
}

function _lfSetHint(s, id, v)      { var f = _lfGet(s, id); if (f) f.hint = v; }
function _lfSetRatingMax(s, id, v) { var f = _lfGet(s, id); if (f) f.ratingMax = parseInt(v) || 5; }
function _lfSetUrl(s, id, v)       { var f = _lfGet(s, id); if (f) { f.url = v; document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(s); } }
function _lfSetCondField(s, id, v) { var f = _lfGet(s, id); if (!f) return; f.condition = v ? {fieldId: v, value: (f.condition && f.condition.value) || ''} : null; document.getElementById('lf_fields_wrap').innerHTML = _lfSecHtml(s); }
function _lfSetCondVal(s, id, v)   { var f = _lfGet(s, id); if (f && f.condition) f.condition.value = v; }

function _lfDupF(s, id) {
  var arr = _lfSec[s];
  var idx = arr.findIndex(function(x) { return x.id === id; });
  if (idx < 0) return;
  var copy = JSON.parse(JSON.stringify(arr[idx]));
  copy.id = _lfId();
  arr.splice(idx + 1, 0, copy);
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
    if (f.label && f.type !== 'section' && f.type !== 'image' && f.type !== 'video' && f.type !== 'rating') sel.innerHTML += '<option value="' + f.id + '"' + (f.id === cur ? ' selected' : '') + '>' + esc(f.label) + '</option>';
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
    commonFields:   _lfSec.common.filter(function(f) { return f.label.trim() || f.type === 'image' || f.type === 'video'; }),
    personalFields: _lfSec.personal.filter(function(f) { return f.label.trim() || f.type === 'image' || f.type === 'video'; }),
    companyFields:  _lfSec.company.filter(function(f) { return f.label.trim() || f.type === 'image' || f.type === 'video'; }),
    submitAction:   action,
    active:         true,
    updatedAt:      firebase.firestore.FieldValue.serverTimestamp(),
    coverImage:     (document.getElementById('lf_cover_img') ? document.getElementById('lf_cover_img').value.trim() : ''),
    logoUrl:        (document.getElementById('lf_logo_url')  ? document.getElementById('lf_logo_url').value.trim()  : ''),
    description:    (document.getElementById('lf_desc')      ? document.getElementById('lf_desc').value.trim()      : ''),
    themeColor:     (document.getElementById('lf_theme_color') ? document.getElementById('lf_theme_color').value : '#2563eb'),
    countdownEnd:   (document.getElementById('lf_countdown') ? document.getElementById('lf_countdown').value : ''),
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

function copyLeadForm(formId) {
  if (!confirm('คัดลอก Form นี้?')) return;
  db.collection(LEAD_FORM_COL).doc(formId).get().then(function(d) {
    if (!d.exists) return Promise.reject(new Error('ไม่พบ Form'));
    var data = d.data();
    data.title          = 'สำเนา — ' + (data.title || '');
    data.submissionsCount = 0;
    data.createdAt      = firebase.firestore.FieldValue.serverTimestamp();
    data.updatedAt      = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy      = CURRENT_USER.email;
    return db.collection(LEAD_FORM_COL).add(data);
  }).then(function() {
    rLeads(); toast('📋 คัดลอก Form แล้ว');
  }).catch(function(e) { alert('คัดลอกไม่ได้: ' + e.message); });
}

// ---------- Preview Modal ----------

function previewLeadForm(formId) {
  var base = window.location.href.replace(/[^/]*$/, '');
  var url  = base + 'lead-form.html?form=' + formId;
  var h = '<div style="height:72vh;"><iframe src="' + esc(url) + '" style="width:100%;height:100%;border:none;border-radius:8px;"></iframe></div>';
  openM('👁 ดูตัวอย่าง Form', h);
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
    .concat(form.companyFields  || [])
    .filter(function(f) { return f.type !== 'section'; });

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
  h += '<button onclick="rLeads()" class="btn bo bsm">← กลับ</button>';
  h += '<h2 class="ld-title" style="flex:1;margin:0 12px;font-size:1.05em;">' + esc(form.title) + '</h2>';
  h += '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">';
  h += '<button onclick="showLeadQR(\'' + form.id + '\')" class="btn bsm bo">📱 QR</button>';
  h += '<button onclick="showEditLeadFormM(\'' + form.id + '\')" class="btn bsm bo">✏️</button>';
  if (subs.length) h += '<button onclick="exportLeadSubs()" class="btn bsm bp">📎 Export</button>';
  if (subs.length) h += '<button id="ldAiBtn" onclick="aiAnalyzeLeads(this)" class="btn bsm bo">🤖 AI</button>';
  h += '</div></div>';

  // Stat cards
  h += '<div class="ld-stats-row">';
  h += _ldStatCard(subs.length, 'ทั้งหมด', '🙋', '#3b82f6');
  h += _ldStatCard(todayCnt,    'วันนี้',   '📅', '#22c55e');
  if (form.useTypeToggle) {
    h += _ldStatCard(pCnt, 'บุคคล',  '👤', '#a855f7');
    h += _ldStatCard(cCnt, 'บริษัท', '🏢', '#f97316');
  }
  h += '</div>';

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

  // Filter + search
  _ldFilter = {type: 'all', date: 'all'};
  h += '<div class="ld-filter-wrap">';
  if (form.useTypeToggle) {
    h += '<div class="ld-filter-row"><span class="ld-filter-lbl">ประเภท</span><div class="ld-filter-btns" id="ldf_type">';
    h += '<button onclick="ldSetFilter(\'type\',\'all\')" class="ld-fbtn act">ทั้งหมด</button>';
    h += '<button onclick="ldSetFilter(\'type\',\'personal\')" class="ld-fbtn">👤 บุคคล</button>';
    h += '<button onclick="ldSetFilter(\'type\',\'company\')" class="ld-fbtn">🏢 บริษัท</button>';
    h += '</div></div>';
  }
  h += '<div class="ld-filter-row"><span class="ld-filter-lbl">วันที่</span><div class="ld-filter-btns" id="ldf_date">';
  h += '<button onclick="ldSetFilter(\'date\',\'all\')" class="ld-fbtn act">ทั้งหมด</button>';
  h += '<button onclick="ldSetFilter(\'date\',\'today\')" class="ld-fbtn">วันนี้</button>';
  h += '<button onclick="ldSetFilter(\'date\',\'week\')" class="ld-fbtn">สัปดาห์นี้</button>';
  h += '<button onclick="ldSetFilter(\'date\',\'month\')" class="ld-fbtn">เดือนนี้</button>';
  h += '</div></div>';
  h += '</div>';

  h += '<div class="ld-search-row">';
  h += '<div class="ld-count-lbl">แสดง <span class="ld-count-num" id="ld_filtered_count">' + subs.length + '</span> จาก ' + subs.length + ' รายการ</div>';
  h += '<div class="ld-search-box"><span style="color:var(--text2,#64748b);font-size:.88em;">🔍</span>';
  h += '<input id="ld_search" class="ld-search-inp" placeholder="ค้นหา..." oninput="ldApplyFilters()"></div>';
  h += '</div>';
  h += '<div id="ld_table_wrap" style="overflow-x:auto;border-radius:10px;border:1px solid var(--border,#334155);">' + _ldTableHtml(form, subs, allFields) + '</div>';
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

function ldSetFilter(key, val) {
  _ldFilter[key] = val;
  var container = document.getElementById('ldf_' + key);
  if (container) {
    container.querySelectorAll('.ld-fbtn').forEach(function(b) { b.classList.remove('act'); });
    var idxMap = key === 'type'
      ? {all: 0, personal: 1, company: 2}
      : {all: 0, today: 1, week: 2, month: 3};
    var btns = container.querySelectorAll('.ld-fbtn');
    if (btns[idxMap[val] || 0]) btns[idxMap[val] || 0].classList.add('act');
  }
  ldApplyFilters();
}

function ldApplyFilters() {
  var q    = ((document.getElementById('ld_search') || {}).value || '').toLowerCase();
  var subs = window._ldAllSubs || [];
  var form = window._ldForm;
  var now  = new Date();

  var filtered = subs.filter(function(s) {
    if (_ldFilter.type !== 'all' && s.contactType !== _ldFilter.type) return false;
    if (_ldFilter.date !== 'all') {
      if (!s.createdAt) return false;
      var d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      if (_ldFilter.date === 'today' && d.toDateString() !== now.toDateString()) return false;
      if (_ldFilter.date === 'week'  && d < new Date(now - 7 * 864e5)) return false;
      if (_ldFilter.date === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
    }
    if (q) {
      var hay = JSON.stringify(s.answers || {}).toLowerCase() + (s.contactType || '') + _ldFmtDate(s.createdAt).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  var allFields = ((form.commonFields || form.fields || []).concat(form.personalFields || []).concat(form.companyFields || []));
  var countEl = document.getElementById('ld_filtered_count');
  if (countEl) countEl.textContent = filtered.length;
  document.getElementById('ld_table_wrap').innerHTML = _ldTableHtml(form, filtered, allFields);
}

function ldFilterTable(q) { ldApplyFilters(); }

function _ldTableHtml(form, subs, allFields) {
  if (!subs.length) return '<div style="padding:28px;text-align:center;color:var(--text2);">ไม่พบข้อมูล</div>';
  var h = '<table class="tbl ld-tbl"><thead><tr><th style="min-width:90px;">วันที่</th>';
  if (form.useTypeToggle) h += '<th style="min-width:56px;text-align:center;">ประเภท</th>';
  allFields.forEach(function(f) { h += '<th>' + esc(f.label) + '</th>'; });
  h += '</tr></thead><tbody>';
  subs.forEach(function(s, ri) {
    h += '<tr class="' + (ri % 2 === 1 ? 'ld-row-alt' : '') + '">';
    h += '<td class="ld-td-date">' + _ldFmtDate(s.createdAt) + '</td>';
    if (form.useTypeToggle) {
      var tIcon = s.contactType === 'personal' ? '👤' : s.contactType === 'company' ? '🏢' : '—';
      var tTip  = s.contactType === 'personal' ? 'บุคคล' : s.contactType === 'company' ? 'บริษัท' : '';
      h += '<td style="text-align:center;" title="' + tTip + '">' + tIcon + '</td>';
    }
    allFields.forEach(function(f) {
      var v = (s.answers && s.answers[f.id] !== undefined) ? s.answers[f.id] : '';
      var display = String(v);
      if (f.type === 'rating')   display = v ? '★'.repeat(parseInt(v)||0) : '—';
      if (f.type === 'checkbox') display = v ? '✓' : '—';
      if (display === '' || display === 'undefined') display = '—';
      h += '<td title="' + esc(display) + '">' + esc(display) + '</td>';
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
  var fields = (form.commonFields || form.fields || []).concat(form.personalFields || []).concat(form.companyFields || [])
    .filter(function(f) { return f.type !== 'section'; });
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

async function aiAnalyzeLeads(btn) {
  if (!_ldCache) return;
  var form = _ldCache.form;
  var subs = _ldCache.subs;
  if (!subs.length) { toast('ยังไม่มีข้อมูล'); return; }

  var restore = _aiBtnBusy(btn, '⏳ วิเคราะห์...');

  var fields = (form.commonFields || form.fields || []).concat(form.personalFields || []).concat(form.companyFields || [])
    .filter(function(f) { return f.type !== 'section'; });

  // สรุปข้อมูลแต่ละ field
  var fieldSummaries = fields.slice(0, 10).map(function(f) {
    var vals = subs.map(function(s) { return s.answers && s.answers[f.id]; }).filter(function(v) { return v !== undefined && v !== '' && v !== null; });
    if (!vals.length) return null;
    if (f.type === 'select' || f.type === 'radio' || f.type === 'multicheck') {
      var cnt = {};
      vals.forEach(function(v) {
        var items = Array.isArray(v) ? v : [v];
        items.forEach(function(i) { cnt[i] = (cnt[i] || 0) + 1; });
      });
      var top = Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a];}).slice(0,5)
        .map(function(k){ return k + '(' + cnt[k] + ')'; }).join(', ');
      return f.label + ': ' + top;
    }
    return f.label + ': ' + vals.length + ' คำตอบ';
  }).filter(Boolean).join('\n');

  var todayStr = new Date().toISOString().split('T')[0];
  var todayCnt = subs.filter(function(s) {
    if (!s.createdAt) return false;
    var d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
    return d.toISOString().split('T')[0] === todayStr;
  }).length;

  var prompt = 'คุณเป็นนักวิเคราะห์การตลาด ช่วยวิเคราะห์ข้อมูล Lead Form ต่อไปนี้และให้คำแนะนำเป็นภาษาไทย:\n\n' +
    'ชื่อฟอร์ม: ' + form.title + '\n' +
    'จำนวน Submissions ทั้งหมด: ' + subs.length + '\n' +
    'วันนี้: ' + todayCnt + ' คน\n\n' +
    'สรุปข้อมูลที่กรอก:\n' + (fieldSummaries || 'ไม่มีข้อมูล') + '\n\n' +
    'กรุณาวิเคราะห์: 1) กลุ่มลูกค้าหลักที่เห็น 2) Insight ที่น่าสนใจ 3) คำแนะนำ Next Step สำหรับทีมขาย';

  var result = await askGemini(prompt);
  restore();
  if (!result) return;

  openM('🤖 AI วิเคราะห์ Lead — ' + esc(form.title),
    '<div style="white-space:pre-wrap;font-size:.88rem;line-height:1.7;color:var(--text)">' + sanitize(result) + '</div>'
  );
}
