// views-notes.js — Post-it Note พร้อม Copy ทีละ Field
// ใช้ collection 'postit' (v7_postit) แยกจาก Knowledge Base (v7_notes)
// type: 'text' = freetext | type: 'fields' = structured (copy ทีละ field ได้)

var notesQ = '';
var notesShowTrash = false;
var _structFields = [];

var _noteColors = [
  { id: 'yellow', bg: 'rgba(253,224,71,.13)', border: 'rgba(253,224,71,.35)', dot: '#fef08a' },
  { id: 'blue',   bg: 'rgba(59,130,246,.13)', border: 'rgba(59,130,246,.35)', dot: '#93c5fd' },
  { id: 'green',  bg: 'rgba(34,197,94,.13)',  border: 'rgba(34,197,94,.35)',  dot: '#86efac' },
  { id: 'pink',   bg: 'rgba(236,72,153,.13)', border: 'rgba(236,72,153,.35)', dot: '#f9a8d4' },
];

function _noteCS(colorId) {
  var c = _noteColors.find(function(x) { return x.id === colorId; }) || _noteColors[0];
  return 'background:' + c.bg + ';border:1px solid ' + c.border + ';';
}

function _noteColorPicker(radioName, selected) {
  return _noteColors.map(function(c) {
    return '<label style="cursor:pointer;margin-right:6px"><input type="radio" name="' + radioName + '" value="' + c.id + '" style="display:none"' +
      (c.id === (selected || 'yellow') ? ' checked' : '') + '>' +
      '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:' + c.bg + ';border:2px solid ' + c.dot + '" title="' + c.id + '"></span></label>';
  }).join('');
}

// ================================================================
// MAIN PAGE
// ================================================================
function rNotes(el) {
  document.getElementById('pgT').textContent = '📓 Note';
  var all = ST.getAll('postit');

  var trashItems = all.filter(function(n) { return n.status === 'trash'; });
  var activeItems = all.filter(function(n) { return (n.status || 'active') === 'active'; });

  var viewList = notesShowTrash ? trashItems : activeItems;

  if (notesQ && !notesShowTrash) {
    var q = notesQ.toLowerCase();
    viewList = viewList.filter(function(n) {
      return (n.title || '').toLowerCase().indexOf(q) !== -1 ||
             (n.content || '').toLowerCase().indexOf(q) !== -1 ||
             ((n.fields || []).some(function(f) { return ((f.label || '') + ' ' + (f.value || '')).toLowerCase().indexOf(q) !== -1; }));
    });
  }

  viewList.sort(function(a, b) {
    if (!notesShowTrash) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
    }
    return (b.updated || b.created || '').localeCompare(a.updated || a.created || '');
  });

  // Toolbar
  var h = '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">';
  if (!notesShowTrash) {
    h += '<button class="btn bp" onclick="showAddNoteM()">📝 Note ใหม่</button>';
    h += '<button class="btn bo" onclick="showAddFieldsNoteM()">📋 Note แบบ Fields</button>';
    h += '<input type="text" id="notesQ_el" placeholder="🔍 ค้นหา..." style="flex:1;min-width:100px" oninput="notesQ=this.value;render()" autocomplete="off" value="' + sanitize(notesQ) + '">';
  }
  var trashLabel = '🗑️ ถังขยะ' + (trashItems.length ? ' (' + trashItems.length + ')' : '');
  h += '<button class="btn ' + (notesShowTrash ? 'bd' : 'bo') + '" onclick="notesShowTrash=!notesShowTrash;notesQ=\'\';render()">' + (notesShowTrash ? '← กลับ' : trashLabel) + '</button>';
  h += '</div>';

  if (notesShowTrash) {
    h += '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">📌 Note ในถังขยะ — กู้คืนหรือลบถาวรได้</div>';
    if (trashItems.length > 1) {
      h += '<button class="btn bd" style="margin-bottom:10px;font-size:11px" onclick="emptyNoteTrash()">🗑️ ล้างถังขยะทั้งหมด</button>';
    }
  }

  if (!viewList.length) {
    h += '<div style="text-align:center;padding:40px 20px;color:var(--text2)">';
    if (notesShowTrash) {
      h += '<div style="font-size:2.5rem;margin-bottom:10px">🗑️</div><div>ถังขยะว่างเปล่า</div>';
    } else {
      h += '<div style="font-size:3.5rem;margin-bottom:12px">📓</div>';
      h += '<div style="font-size:15px;font-weight:700;margin-bottom:6px">' + (notesQ ? 'ไม่พบ Note ที่ค้นหา' : 'ยังไม่มี Note') + '</div>';
      if (!notesQ) h += '<div style="font-size:12px;margin-bottom:16px">เพิ่ม Note ข้อความ หรือ Note แบบ Fields สำหรับ copy ทีละช่อง</div><button class="btn bp" onclick="showAddNoteM()">📝 เพิ่ม Note แรก</button>';
    }
    h += '</div>';
  } else {
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">';
    viewList.forEach(function(n) {
      h += notesShowTrash ? _noteTrashCard(n) : _noteCard(n);
    });
    h += '</div>';
  }

  el.innerHTML = h;
  if (!notesShowTrash) {
    var qEl = document.getElementById('notesQ_el');
    if (qEl && notesQ) { qEl.focus(); qEl.setSelectionRange(notesQ.length, notesQ.length); }
  }
}

// ================================================================
// NOTE CARDS
// ================================================================
function _noteCard(n) {
  var cs = _noteCS(n.color);
  var h = '<div style="' + cs + 'border-radius:10px;padding:12px;position:relative;min-height:110px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:4px">';
  h += '<div style="font-weight:700;font-size:12px;flex:1;word-break:break-word">' + sanitize(n.title || (n.type === 'fields' ? '📋 Fields Note' : '📝 Note')) + (n.pinned ? ' 📌' : '') + '</div>';
  h += '<div style="display:flex;gap:3px;flex-shrink:0">';
  h += '<button class="btn bsm bo" style="padding:2px 5px;font-size:10px" onclick="_openNoteEdit(\'' + n.id + '\')">✏️</button>';
  h += '<button class="btn bsm bd" style="padding:2px 5px;font-size:10px" onclick="trashNote(\'' + n.id + '\')">🗑️</button>';
  h += '</div></div>';

  if (n.type === 'fields' && n.fields && n.fields.length) {
    n.fields.forEach(function(f, fi) {
      h += '<div style="margin-bottom:6px">';
      if (f.label) h += '<div style="font-size:9px;color:var(--text2);margin-bottom:2px;text-transform:uppercase;letter-spacing:.4px">' + sanitize(f.label) + '</div>';
      h += '<div style="display:flex;gap:4px;align-items:flex-start">';
      h += '<div style="flex:1;font-size:11.5px;background:rgba(0,0,0,.25);border-radius:5px;padding:4px 7px;word-break:break-word;white-space:pre-wrap;min-height:22px">' + sanitize(f.value || '') + '</div>';
      if (f.value) h += '<button class="btn bsm bo" style="flex-shrink:0;padding:3px 6px;font-size:10px" onclick="cpNoteField(\'' + n.id + '\',' + fi + ')" title="Copy ' + sanitize(f.label || 'field') + '">📋</button>';
      h += '</div></div>';
    });
    h += '<button class="btn bsm bo" style="margin-top:6px;font-size:10px;width:100%;text-align:center" onclick="cpAllNoteFields(\'' + n.id + '\')">📋 Copy ทั้งหมด</button>';
  } else {
    var preview = (n.content || '').substr(0, 180);
    h += '<div style="font-size:11.5px;white-space:pre-wrap;word-break:break-word;max-height:110px;overflow:hidden;color:var(--text)">' + sanitize(preview) + (n.content && n.content.length > 180 ? '…' : '') + '</div>';
    h += '<button class="btn bsm bo" style="margin-top:8px;font-size:10px;width:100%;text-align:center" onclick="cpNote(\'' + n.id + '\')">📋 Copy</button>';
  }
  h += '</div>';
  return h;
}

function _noteTrashCard(n) {
  var cs = _noteCS(n.color);
  var preview = n.type === 'fields'
    ? (n.fields || []).map(function(f) { return (f.label ? f.label + ': ' : '') + f.value; }).join(' | ').substr(0, 80)
    : (n.content || '').substr(0, 80);
  var h = '<div style="' + cs + 'border-radius:10px;padding:12px;opacity:.8">';
  h += '<div style="font-weight:700;font-size:12px;margin-bottom:4px;word-break:break-word">' + sanitize(n.title || (n.type === 'fields' ? 'Fields Note' : 'Note')) + '</div>';
  if (preview) h += '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;word-break:break-word">' + sanitize(preview) + (preview.length >= 80 ? '…' : '') + '</div>';
  h += '<div style="display:flex;gap:6px;margin-top:4px">';
  h += '<button class="btn bsm bp btn-full" style="font-size:10px" onclick="restoreNote(\'' + n.id + '\')">♻️ กู้คืน</button>';
  h += '<button class="btn bsm bd" style="font-size:10px" onclick="hardDelNote(\'' + n.id + '\')">🗑️ ลบถาวร</button>';
  h += '</div></div>';
  return h;
}

// ================================================================
// FREE-TEXT NOTE MODAL
// ================================================================
function showAddNoteM() { _openNoteTextM(null); }

function _openNoteTextM(n) {
  var id = n ? n.id : '';
  openM((id ? '✏️ แก้ไข Note' : '📝 Note ใหม่'),
    '<div class="fg"><label>ชื่อ <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="nt_title" value="' + sanitize(n ? n.title || '' : '') + '" placeholder="ชื่อ Note..."></div>' +
    '<div class="fg"><label>เนื้อหา</label><textarea id="nt_body" rows="7" style="font-family:inherit" placeholder="จดอะไรก็ได้...">' + sanitize(n ? n.content || '' : '') + '</textarea></div>' +
    '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">' +
    '<span style="font-size:12px;color:var(--text2)">สี</span>' + _noteColorPicker('nt_color', n ? n.color : 'yellow') +
    (id ? '<label style="display:flex;gap:5px;align-items:center;font-size:12px;cursor:pointer;margin-left:auto"><input type="checkbox" id="nt_pin"' + (n && n.pinned ? ' checked' : '') + '> 📌 ปักหมุด</label>' : '') +
    '</div>' +
    '<button class="btn bp btn-full" onclick="saveNoteText(\'' + id + '\')">💾 บันทึก</button>'
  );
  setTimeout(function() { var el = document.getElementById('nt_body'); if (el) el.focus(); }, 50);
}

function saveNoteText(id) {
  var title = document.getElementById('nt_title').value.trim();
  var body = document.getElementById('nt_body').value.trim();
  if (!title && !body) return alert('ใส่เนื้อหา Note อย่างน้อย');
  var colorEl = document.querySelector('input[name="nt_color"]:checked');
  var color = colorEl ? colorEl.value : 'yellow';
  var pinEl = document.getElementById('nt_pin');
  var now = new Date().toISOString();
  if (id) {
    var upd = { title: title, content: body, color: color, updated: now };
    if (pinEl) upd.pinned = pinEl.checked;
    ST.update('postit', id, upd);
  } else {
    ST.add('postit', { title: title, content: body, type: 'text', color: color, pinned: false, status: 'active', created: now, updated: now });
  }
  closeMForce(); toast('💾 บันทึกแล้ว'); render();
}

// ================================================================
// STRUCTURED (FIELDS) NOTE MODAL
// ================================================================
function showAddFieldsNoteM() {
  _structFields = [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }];
  _renderFieldsModal('', 'yellow', false);
}

function _openFieldsNoteEditM(n) {
  _structFields = (n.fields || []).map(function(f) { return { label: f.label || '', value: f.value || '' }; });
  if (!_structFields.length) _structFields.push({ label: '', value: '' });
  _renderFieldsModal(n.id, n.color || 'yellow', !!n.pinned, n.title || '');
}

function _renderFieldsModal(id, color, pinned, title) {
  title = title || '';
  var fieldsHtml = _structFields.map(function(f, i) {
    return '<div style="display:flex;gap:5px;margin-bottom:6px">' +
      '<input type="text" placeholder="ชื่อช่อง เช่น ชื่อบริษัท" value="' + sanitize(f.label) + '" style="width:38%;font-size:11px" oninput="_structFields[' + i + '].label=this.value">' +
      '<input type="text" placeholder="ข้อมูล" value="' + sanitize(f.value) + '" style="flex:1;font-size:11px" oninput="_structFields[' + i + '].value=this.value">' +
      '<button class="btn bsm bd" style="padding:2px 5px;font-size:10px" onclick="_sfDel(' + i + ',\'' + id + '\',\'' + color + '\',' + pinned + ')">🗑️</button>' +
      '</div>';
  }).join('');

  openM((id ? '✏️ แก้ไข Fields Note' : '📋 Note แบบ Fields'),
    '<div class="fg"><label>ชื่อ <small style="color:var(--text2)">(ไม่บังคับ)</small></label><input type="text" id="sf_title" value="' + sanitize(title) + '" placeholder="เช่น SAP Visit Plan..."></div>' +
    '<div class="fg"><label>Fields <small style="color:var(--text2)">(ชื่อช่อง + ข้อมูล)</small></label>' +
    fieldsHtml +
    '<button class="btn bsm bo btn-full" style="margin-top:2px;font-size:11px" onclick="_sfAdd(\'' + id + '\',\'' + color + '\',' + pinned + ')">+ เพิ่ม Field</button></div>' +
    '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">' +
    '<span style="font-size:12px;color:var(--text2)">สี</span>' + _noteColorPicker('sf_color', color) +
    (id ? '<label style="display:flex;gap:5px;align-items:center;font-size:12px;cursor:pointer;margin-left:auto"><input type="checkbox" id="sf_pin"' + (pinned ? ' checked' : '') + '> 📌 ปักหมุด</label>' : '') +
    '</div>' +
    '<button class="btn bp btn-full" onclick="saveFieldsNote(\'' + id + '\')">💾 บันทึก</button>'
  );
}

function _sfAdd(id, color, pinned) {
  _structFields.push({ label: '', value: '' });
  _syncSFFromDOM();
  _renderFieldsModal(id, _getCurrentColor('sf_color') || color, pinned, (document.getElementById('sf_title') || {}).value || '');
}

function _sfDel(idx, id, color, pinned) {
  _syncSFFromDOM();
  _structFields.splice(idx, 1);
  _renderFieldsModal(id, _getCurrentColor('sf_color') || color, pinned, (document.getElementById('sf_title') || {}).value || '');
}

function _syncSFFromDOM() {
  var labels = document.querySelectorAll('input[oninput^="_structFields"][oninput*=".label"]');
  var values = document.querySelectorAll('input[oninput^="_structFields"][oninput*=".value"]');
  labels.forEach(function(el, i) { if (_structFields[i]) _structFields[i].label = el.value; });
  values.forEach(function(el, i) { if (_structFields[i]) _structFields[i].value = el.value; });
}

function _getCurrentColor(radioName) {
  var el = document.querySelector('input[name="' + radioName + '"]:checked');
  return el ? el.value : 'yellow';
}

function saveFieldsNote(id) {
  _syncSFFromDOM();
  var title = (document.getElementById('sf_title') || {}).value || '';
  title = title.trim();
  var fields = _structFields.filter(function(f) { return f.label || f.value; });
  if (!title && !fields.length) return alert('ใส่ชื่อหรือ Field อย่างน้อยหนึ่งอย่าง');
  var color = _getCurrentColor('sf_color');
  var pinEl = document.getElementById('sf_pin');
  var now = new Date().toISOString();
  if (id) {
    var upd = { title: title, fields: fields, color: color, updated: now };
    if (pinEl) upd.pinned = pinEl.checked;
    ST.update('postit', id, upd);
  } else {
    ST.add('postit', { title: title, type: 'fields', fields: fields, color: color, pinned: false, status: 'active', created: now, updated: now });
  }
  _structFields = [];
  closeMForce(); toast('💾 บันทึกแล้ว'); render();
}

// ================================================================
// EDIT DISPATCHER
// ================================================================
function _openNoteEdit(id) {
  var n = ST.getOne('postit', id);
  if (!n) return;
  if (n.type === 'fields') _openFieldsNoteEditM(n);
  else _openNoteTextM(n);
}

// ================================================================
// COPY FUNCTIONS
// ================================================================
function cpNoteField(noteId, fieldIdx) {
  var n = ST.getOne('postit', noteId);
  if (!n || !n.fields || !n.fields[fieldIdx]) return;
  var f = n.fields[fieldIdx];
  copyText(f.value || '', '📋 Copy "' + (f.label || 'field') + '" แล้ว');
}

function cpAllNoteFields(noteId) {
  var n = ST.getOne('postit', noteId);
  if (!n || !n.fields) return;
  var lines = n.fields
    .filter(function(f) { return f.value; })
    .map(function(f) { return (f.label ? f.label + ': ' : '') + f.value; });
  var text = (n.title ? n.title + '\n\n' : '') + lines.join('\n');
  copyText(text, '📋 Copy ทั้งหมดแล้ว');
}

function cpNote(noteId) {
  var n = ST.getOne('postit', noteId);
  if (!n) return;
  var text = (n.title ? n.title + '\n\n' : '') + (n.content || '');
  copyText(text, '📋 Copy แล้ว');
}

// ================================================================
// DELETE / TRASH
// ================================================================
function trashNote(id) {
  ST.update('postit', id, { status: 'trash', deletedAt: new Date().toISOString() });
  toast('🗑️ ย้ายไปถังขยะแล้ว — เปิดถังขยะเพื่อกู้คืน');
  render();
}

function restoreNote(id) {
  ST.update('postit', id, { status: 'active', deletedAt: null });
  toast('♻️ กู้คืนแล้ว');
  render();
}

function hardDelNote(id) {
  if (!confirm('ลบถาวร? ไม่สามารถกู้คืนได้อีก')) return;
  ST.delete('postit', id);
  toast('🗑️ ลบถาวรแล้ว');
  render();
}

function emptyNoteTrash() {
  if (!confirm('ล้างถังขยะทั้งหมด? ไม่สามารถกู้คืนได้อีก')) return;
  var trash = ST.getAll('postit').filter(function(n) { return n.status === 'trash'; });
  trash.forEach(function(n) { ST.delete('postit', n.id); });
  toast('🗑️ ล้างถังขยะแล้ว');
  render();
}
