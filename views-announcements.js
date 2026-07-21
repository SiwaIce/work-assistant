// ================================================================
// VIEWS-ANNOUNCEMENTS.JS - Announcement & Policy Management
// ================================================================

var _annData = null;
var _annFilter = 'active';
var _annLoading = false;

var ANN_BADGES = {
  'ด่วน':      { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  'ใหม่':      { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  'สำคัญ':    { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  'นโยบาย':   { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  'สินค้า':   { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  'โปรโมชั่น': { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' }
};
var ANN_BADGE_OPTS = ['ด่วน','ใหม่','สำคัญ','นโยบาย','สินค้า','โปรโมชั่น'];

function annBadgeHtml(badges) {
  if (!badges || !badges.length) return '';
  return badges.map(function(b) {
    var s = ANN_BADGES[b] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:0.3px;color:' + s.color + ';background:' + s.bg + ';margin-right:3px">' + b + '</span>';
  }).join('');
}

function annStatusHtml(status) {
  var map = { active: ['#22c55e','เผยแพร่'], draft: ['#94a3b8','แบบร่าง'], inactive: ['#ef4444','ปิด'] };
  var s = map[status] || map['draft'];
  return '<span style="color:' + s[0] + ';font-size:11px;font-weight:600">● ' + s[1] + '</span>';
}

function annTargetLabel(ann) {
  if (ann.targetMode === 'selected' && ann.targetDealerIds && ann.targetDealerIds.length) {
    return ann.targetDealerIds.length + ' Dealer';
  }
  return 'ทุก Dealer';
}

function fmtAnnDate(ts) {
  if (!ts) return '-';
  var d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

function _annLoadData(cb) {
  if (_annLoading) return;
  _annLoading = true;
  db.collection('announcements').orderBy('createdAt', 'desc').get()
    .then(function(snap) {
      _annData = snap.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
      _annLoading = false;
      if (cb) cb();
    })
    .catch(function(e) {
      _annLoading = false;
      console.warn('announcements load error:', e);
      _annData = [];
      if (cb) cb();
    });
}

// ================================================================
// MAIN LIST VIEW
// ================================================================
function rAnnouncements(el) {
  if (S.annId) { rAnnDetail(el); return; }

  if (!_annData) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text2)">กำลังโหลด...</div>';
    _annLoadData(function() { render(); });
    return;
  }

  var now = Date.now();
  var counts = { all: _annData.length, active: 0, draft: 0, inactive: 0 };
  _annData.forEach(function(a) { if (counts[a.status] !== undefined) counts[a.status]++; });

  var filtered = _annData.filter(function(a) {
    if (_annFilter === 'all') return true;
    return a.status === _annFilter;
  });

  var h = '<div class="pg">';
  h += '<div class="pgh" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">';
  h += '<div><h2 style="margin:0;font-size:20px">📢 ประกาศ & นโยบาย</h2>';
  h += '<div style="font-size:13px;color:var(--text2);margin-top:2px">ติดตามการส่งข้อมูลและประกาศถึง Dealer</div></div>';
  h += '<button class="btn bpr" onclick="showAnnModal(null)">+ สร้างประกาศ</button></div>';

  h += '<div class="ftabs" style="margin:12px 0">';
  ['active','draft','inactive','all'].forEach(function(f) {
    var label = {active:'เผยแพร่',draft:'แบบร่าง',inactive:'ปิด',all:'ทั้งหมด'}[f];
    h += '<div class="ftab ' + (_annFilter===f?'act':'') + '" onclick="_annFilter=\'' + f + '\';_annData=null;render()">' + label + ' (' + counts[f] + ')</div>';
  });
  h += '</div>';

  if (!filtered.length) {
    h += '<div class="bg" style="padding:32px;text-align:center;color:var(--text2)">ไม่มีประกาศในหมวดนี้ — <button class="btn bsm bo" onclick="showAnnModal(null)">+ สร้างใหม่</button></div>';
    el.innerHTML = h + '</div>';
    return;
  }

  var dealers = ST.getAll('dealers');

  filtered.forEach(function(ann) {
    var expMs = ann.expireAt ? (ann.expireAt.seconds ? ann.expireAt.seconds * 1000 : new Date(ann.expireAt).getTime()) : null;
    var isExpired = expMs !== null && expMs < now;
    var daysLeft = (expMs !== null && !isExpired) ? Math.ceil((expMs - now) / 86400000) : null;
    var warnExpiry = daysLeft !== null && daysLeft <= 7;
    var borderColor = isExpired ? '#ef4444' : warnExpiry ? '#f59e0b' : ann.status === 'active' ? '#22c55e' : '#475569';

    h += '<div class="bg" style="margin-bottom:10px;padding:14px 16px;border-left:4px solid ' + borderColor + ';cursor:pointer" onclick="go(\'announcements\',{annId:\'' + ann.id + '\'})">';
    h += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="margin-bottom:5px">' + annBadgeHtml(ann.badges) + '</div>';
    h += '<div style="font-weight:600;font-size:15px;line-height:1.4">' + sanitize(ann.title || '') + '</div>';
    h += '<div style="font-size:12px;color:var(--text2);margin-top:5px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">';
    h += annStatusHtml(ann.status);
    if (isExpired) h += '<span style="color:#ef4444;font-size:11px">⚠️ หมดอายุ</span>';
    else if (warnExpiry) h += '<span style="color:#f59e0b;font-size:11px">⏰ เหลือ ' + daysLeft + ' วัน</span>';
    h += '<span>🎯 ' + annTargetLabel(ann) + '</span>';
    h += '<span>v' + (ann.version || 1) + '</span>';
    h += '<span>' + fmtAnnDate(ann.updatedAt || ann.createdAt) + '</span>';
    h += '<span id="ann-stat-' + ann.id + '" style="color:var(--text2)">…</span>';
    h += '</div>';
    if (ann.content) {
      h += '<div style="font-size:12px;color:var(--text2);margin-top:6px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + sanitize(ann.content).replace(/\n/g, ' ') + '</div>';
    }
    h += '</div>';
    h += '<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">';
    h += '<button class="btn bsm bo" onclick="event.stopPropagation();showAnnModal(\'' + ann.id + '\')" style="font-size:11px;padding:4px 9px">✏️ แก้ไข</button>';
    h += '<button class="btn bsm bo" onclick="event.stopPropagation();duplicateAnn(\'' + ann.id + '\')" style="font-size:11px;padding:4px 9px">⧉ Clone</button>';
    h += '<button class="btn bsm bo" onclick="event.stopPropagation();showAnnDeliveryModal(\'' + ann.id + '\')" style="font-size:11px;padding:4px 9px">📤 ส่ง</button>';
    h += '</div></div></div>';
  });

  el.innerHTML = h + '</div>';
  _loadAnnListStats(filtered, dealers);
}

// ================================================================
// DETAIL VIEW
// ================================================================
function rAnnDetail(el) {
  if (!_annData && !_annLoading) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text2)">กำลังโหลด...</div>';
    _annLoadData(function() { render(); });
    return;
  }
  if (!_annData) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text2)">กำลังโหลด...</div>';
    return;
  }

  var ann = _annData.find(function(a) { return a.id === S.annId; });
  if (!ann) { go('announcements'); return; }

  var dealers = ST.getAll('dealers');
  var targetDealers = ann.targetMode === 'selected'
    ? dealers.filter(function(d) { return (ann.targetDealerIds || []).indexOf(d.id) >= 0; })
    : dealers;

  var h = '<div class="pg">';
  h += '<div class="pgh" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  h += '<button class="btn bsm bo" onclick="go(\'announcements\')">← กลับ</button>';
  h += '<div style="flex:1;min-width:0"><div style="font-size:12px;color:var(--text2)">ประกาศ</div>';
  h += '<div style="font-weight:700;font-size:17px;line-height:1.3">' + sanitize(ann.title || '') + '</div></div>';
  h += '<button class="btn bsm bo" onclick="duplicateAnn(\'' + ann.id + '\')">⧉ Clone</button>';
  h += '<button class="btn bsm bo" onclick="showAnnModal(\'' + ann.id + '\')">✏️ แก้ไข</button>';
  h += '</div>';

  // Meta card
  h += '<div class="bg" style="margin-bottom:12px;padding:14px 16px">';
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' + annBadgeHtml(ann.badges) + annStatusHtml(ann.status) + '</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;font-size:13px">';
  h += '<div><div style="color:var(--text2);font-size:11px;margin-bottom:2px">เป้าหมาย</div><div>' + annTargetLabel(ann) + '</div></div>';
  h += '<div><div style="color:var(--text2);font-size:11px;margin-bottom:2px">เวอร์ชัน</div><div>v' + (ann.version || 1) + '</div></div>';
  if (ann.publishAt) h += '<div><div style="color:var(--text2);font-size:11px;margin-bottom:2px">เผยแพร่เมื่อ</div><div>' + fmtAnnDate(ann.publishAt) + '</div></div>';
  if (ann.expireAt) h += '<div><div style="color:var(--text2);font-size:11px;margin-bottom:2px">หมดอายุ</div><div>' + fmtAnnDate(ann.expireAt) + '</div></div>';
  h += '<div><div style="color:var(--text2);font-size:11px;margin-bottom:2px">แก้ไขล่าสุด</div><div>' + fmtAnnDate(ann.updatedAt || ann.createdAt) + '</div></div>';
  h += '</div>';
  if (ann.lastChangeNote) {
    h += '<div style="margin-top:10px;padding:8px 10px;background:rgba(245,158,11,0.08);border-radius:6px;font-size:12px;color:var(--text2)">📝 ' + sanitize(ann.lastChangeNote) + '</div>';
  }
  h += '<div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">';
  h += '<button class="btn bsm bpr" onclick="showAnnDeliveryModal(\'' + ann.id + '\')">📤 บันทึกการส่ง</button>';
  h += '<button class="btn bsm bo" onclick="showMarkAllSentModal(\'' + ann.id + '\')">📤 ส่งทั้งหมด</button>';
  h += '<button class="btn bsm bo" onclick="showDraftAnnEmail(\'' + ann.id + '\')">📧 Draft Email</button>';
  h += '<button class="btn bsm bo" onclick="showAnnChangelogModal(\'' + ann.id + '\')">📋 Changelog</button>';
  h += '</div></div>';

  // Content card
  h += '<div class="bg" style="margin-bottom:12px;padding:16px">';
  h += '<div style="font-size:12px;color:var(--text2);margin-bottom:8px;font-weight:600">เนื้อหาประกาศ</div>';
  h += '<div style="white-space:pre-wrap;line-height:1.8;font-size:14px">' + sanitize(ann.content || '-') + '</div>';
  if (ann.link) {
    h += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
    h += '<a href="' + sanitize(ann.link) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-size:13px;word-break:break-all">🔗 ' + sanitize(ann.link) + '</a>';
    h += '</div>';
  }
  h += '</div>';

  // Delivery matrix
  h += '<div class="bg" style="padding:14px 16px">';
  h += '<div style="font-weight:600;margin-bottom:12px">📊 สถานะการส่ง (' + targetDealers.length + ' Dealers)</div>';
  h += '<div id="annDeliveryMatrix"><div style="text-align:center;color:var(--text2);padding:20px">กำลังโหลด...</div></div>';
  h += '</div></div>';

  el.innerHTML = h;

  // Async load delivery data
  _annLoadDeliveries(ann.id, targetDealers, function(deliveries) {
    var tbl = '<div style="overflow-x:auto"><table class="data-table" style="min-width:460px"><thead><tr>';
    tbl += '<th>Dealer</th><th style="text-align:center">LINE</th><th style="text-align:center">Email</th><th style="text-align:center">Portal อ่าน</th><th>หมายเหตุ</th></tr></thead><tbody>';
    targetDealers.forEach(function(d) {
      var dlv = deliveries[d.id] || {};
      var ch = dlv.channels || {};
      tbl += '<tr>';
      tbl += '<td style="font-size:13px">' + sanitize(d.name || d.id) + '</td>';
      tbl += '<td style="text-align:center">' + _dlvIcon(ch['LINE'], ann.version) + '</td>';
      tbl += '<td style="text-align:center">' + _dlvIcon(ch['Email'], ann.version) + '</td>';
      tbl += '<td style="text-align:center">' + _dlvPortalIcon(dlv, ann.version) + '</td>';
      tbl += '<td style="font-size:12px;color:var(--text2)">' + sanitize(dlv.note || '') + '</td>';
      tbl += '</tr>';
    });
    tbl += '</tbody></table></div>';
    var mx = document.getElementById('annDeliveryMatrix');
    if (mx) mx.innerHTML = tbl;
  });
}

function _dlvIcon(entry, annVersion) {
  if (!entry || !entry.sentAt) return '<span style="color:var(--text2);font-size:16px">⬜</span>';
  var stale = annVersion && (entry.sentVersion || 0) < annVersion;
  return stale
    ? '<span style="color:#f59e0b;font-size:16px" title="ส่งแล้ว (เวอร์ชันเก่า)">⚠️</span>'
    : '<span style="color:#22c55e;font-size:16px" title="ส่งแล้ว ' + fmtAnnDate(entry.sentAt) + '">✅</span>';
}

function _dlvPortalIcon(dlv, annVersion) {
  if (!dlv.portalReadAt) return '<span style="color:var(--text2);font-size:16px">⬜</span>';
  var stale = annVersion && (dlv.portalReadVersion || 0) < annVersion;
  return stale
    ? '<span style="color:#f59e0b;font-size:16px" title="อ่านแล้ว (เวอร์ชันเก่า)">⚠️</span>'
    : '<span style="color:#22c55e;font-size:16px" title="อ่านแล้ว">✅</span>';
}

function _annLoadDeliveries(annId, dealers, cb) {
  var result = {};
  var pending = dealers.length;
  if (!pending) { cb(result); return; }
  var done = 0;
  dealers.forEach(function(d) {
    db.collection('dealers').doc(d.id).collection('announcementDeliveries').doc(annId).get()
      .then(function(doc) { if (doc.exists) result[d.id] = doc.data(); })
      .catch(function(e) { console.warn('dlv load err', d.id, e); })
      .finally(function() { done++; if (done === pending) cb(result); });
  });
}

// ================================================================
// ANNOUNCEMENT MODALS
// ================================================================

function showAnnModal(annId) {
  var ann = annId && _annData ? _annData.find(function(a) { return a.id === annId; }) : null;
  var dealers = ST.getAll('dealers');
  var selectedBadges = ann ? (ann.badges || []) : [];
  var selectedDealers = ann ? (ann.targetDealerIds || []) : [];

  var h = '<div style="display:flex;flex-direction:column;gap:12px">';

  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">ชื่อประกาศ *</label>';
  h += '<input type="text" id="annTitle" class="inp" value="' + sanitize(ann ? ann.title || '' : '') + '" placeholder="ชื่อประกาศ..." style="width:100%;box-sizing:border-box;margin-top:3px"></div>';

  // Badges
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">ป้ายกำกับ</label>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px" id="annBadgeRow">';
  ANN_BADGE_OPTS.forEach(function(b) {
    var checked = selectedBadges.indexOf(b) >= 0;
    var s = ANN_BADGES[b];
    h += '<label id="bl_' + b + '" style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:4px 10px;border-radius:20px;border:1px solid ' + (checked ? s.color : 'var(--border)') + ';background:' + (checked ? s.bg : 'transparent') + ';font-size:12px;color:' + (checked ? s.color : 'var(--text2)') + ';transition:all 0.15s" onclick="toggleAnnBadge(this,\'' + b + '\')">';
    h += '<input type="checkbox" name="annBadge" value="' + b + '"' + (checked ? ' checked' : '') + ' style="display:none">' + b + '</label>';
  });
  h += '</div></div>';

  // Status + Target mode
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">สถานะ</label>';
  h += '<select id="annStatus" class="inp" style="width:100%;margin-top:3px">';
  [['draft','แบบร่าง'],['active','เผยแพร่'],['inactive','ปิด']].forEach(function(pair) {
    var sel = ann ? ann.status === pair[0] : pair[0] === 'draft';
    h += '<option value="' + pair[0] + '"' + (sel ? ' selected' : '') + '>' + pair[1] + '</option>';
  });
  h += '</select></div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">เป้าหมาย</label>';
  h += '<select id="annTargetMode" class="inp" onchange="toggleAnnDealerPicker(this.value)" style="width:100%;margin-top:3px">';
  h += '<option value="all"' + (!ann || ann.targetMode !== 'selected' ? ' selected' : '') + '>ทุก Dealer</option>';
  h += '<option value="selected"' + (ann && ann.targetMode === 'selected' ? ' selected' : '') + '>เลือก Dealer</option>';
  h += '</select></div></div>';

  // Dealer picker
  h += '<div id="annDealerPicker" style="' + (ann && ann.targetMode === 'selected' ? '' : 'display:none') + '">';
  h += '<label style="font-size:11px;color:var(--text2);font-weight:600">เลือก Dealer</label>';
  h += '<div style="max-height:150px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px;margin-top:4px;display:flex;flex-direction:column;gap:4px">';
  dealers.forEach(function(d) {
    var checked = selectedDealers.indexOf(d.id) >= 0;
    h += '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;padding:2px 0">';
    h += '<input type="checkbox" name="annDealer" value="' + d.id + '"' + (checked ? ' checked' : '') + '> ' + sanitize(d.name || d.id) + '</label>';
  });
  h += '</div></div>';

  // Content
  h += '<div><div style="display:flex;justify-content:space-between;align-items:center"><label style="font-size:11px;color:var(--text2);font-weight:600">เนื้อหา *</label>';
  if (AI_FEATURES_ENABLED) h += '<button type="button" id="annAiBtn" class="btn bsm" onclick="aiDraftAnnouncement()" style="font-size:11px;padding:3px 8px" title="ให้ AI เรียบเรียงจากหัวข้อ + ร่างคร่าวๆ">✨ AI ช่วยร่าง</button>';
  h += '</div>';
  h += '<textarea id="annContent" class="inp" rows="5" placeholder="พิมพ์ร่างคร่าวๆ หรือหัวข้อ แล้วกด ✨ AI ช่วยร่าง..." style="width:100%;box-sizing:border-box;resize:vertical;margin-top:3px">' + sanitize(ann ? ann.content || '' : '') + '</textarea></div>';

  // Link
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">ลิงก์แนบ (ถ้ามี)</label>';
  h += '<input type="url" id="annLink" class="inp" value="' + sanitize(ann ? ann.link || '' : '') + '" placeholder="https://..." style="width:100%;box-sizing:border-box;margin-top:3px"></div>';

  // Dates
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">วันเผยแพร่</label>';
  var pub = ann && ann.publishAt ? (ann.publishAt.seconds ? new Date(ann.publishAt.seconds*1000) : new Date(ann.publishAt)).toISOString().slice(0,10) : '';
  h += '<input type="date" id="annPublishAt" class="inp" value="' + pub + '" style="width:100%;box-sizing:border-box;margin-top:3px"></div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">หมดอายุ</label>';
  var exp = ann && ann.expireAt ? (ann.expireAt.seconds ? new Date(ann.expireAt.seconds*1000) : new Date(ann.expireAt)).toISOString().slice(0,10) : '';
  h += '<input type="date" id="annExpireAt" class="inp" value="' + exp + '" style="width:100%;box-sizing:border-box;margin-top:3px"></div></div>';

  // Changelog (edit only)
  if (annId) {
    h += '<div style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:10px">';
    h += '<label style="font-size:11px;color:#f59e0b;font-weight:600">📋 บันทึกการเปลี่ยนแปลง (Changelog)</label>';
    h += '<textarea id="annChangeNote" class="inp" rows="2" placeholder="อธิบายสิ่งที่เปลี่ยนแปลง เช่น ปรับราคา, เพิ่มข้อกำหนด..." style="width:100%;box-sizing:border-box;margin-top:4px"></textarea>';
    h += '<div style="font-size:11px;color:var(--text2);margin-top:4px">* หากกรอก จะเพิ่มเวอร์ชันและบันทึกใน Changelog</div>';
    h += '</div>';
  }

  h += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">';
  if (annId) h += '<button class="btn bo" style="color:#ef4444;border-color:rgba(239,68,68,0.4)" onclick="deleteAnn(\'' + annId + '\')">🗑️ ลบ</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '<button class="btn bpr" onclick="saveAnn(' + (annId ? '\'' + annId + '\'' : 'null') + ')">💾 บันทึก</button>';
  h += '</div></div>';

  openM(annId ? 'แก้ไขประกาศ' : 'สร้างประกาศใหม่', h);
}

async function aiDraftAnnouncement() {
  var titleEl = document.getElementById('annTitle');
  var contentEl = document.getElementById('annContent');
  if (!contentEl) return;
  var title = (titleEl && titleEl.value || '').trim();
  var rough = (contentEl.value || '').trim();
  if (!title && !rough) { toast('💡 พิมพ์หัวข้อหรือร่างคร่าวๆ ก่อน'); return; }
  var restore = _aiBtnBusy(document.getElementById('annAiBtn'), '⏳ กำลังร่าง...');
  var prompt = 'คุณเป็นผู้ช่วยฝ่ายขายของบริษัทตัวแทนจำหน่ายโดรน DJI ในไทย ' +
    'ช่วยเรียบเรียงเป็น "ประกาศถึงตัวแทนจำหน่าย (dealer)" เป็นภาษาไทยที่สุภาพ กระชับ เป็นทางการ อ่านง่าย ' +
    'จัดเป็นย่อหน้า/หัวข้อย่อยตามเหมาะสม ไม่ต้องใส่หัวจดหมายหรือคำลงท้ายเซ็นชื่อ ตอบเฉพาะเนื้อหาประกาศ\n\n' +
    'หัวข้อ: ' + (title || '(ไม่ระบุ)') + '\n' +
    'ร่างคร่าวๆ/ประเด็นที่ต้องการสื่อ:\n' + (rough || title);
  var out = await askGemini(prompt);
  restore();
  if (out) { contentEl.value = out; toast('✨ ร่างเสร็จแล้ว — ตรวจทานก่อนบันทึกได้'); }
}

function toggleAnnBadge(labelEl, badge) {
  var cb = labelEl.querySelector('input');
  cb.checked = !cb.checked;
  var s = ANN_BADGES[badge] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
  labelEl.style.borderColor = cb.checked ? s.color : 'var(--border)';
  labelEl.style.background  = cb.checked ? s.bg : 'transparent';
  labelEl.style.color        = cb.checked ? s.color : 'var(--text2)';
}

function toggleAnnDealerPicker(val) {
  var el = document.getElementById('annDealerPicker');
  if (el) el.style.display = val === 'selected' ? '' : 'none';
}

async function saveAnn(annId) {
  var title   = (document.getElementById('annTitle').value || '').trim();
  var content = (document.getElementById('annContent').value || '').trim();
  if (!title || !content) { toast('❌ กรุณากรอกชื่อและเนื้อหา'); return; }

  var badges = Array.from(document.querySelectorAll('input[name=annBadge]:checked')).map(function(c){ return c.value; });
  var targetMode = document.getElementById('annTargetMode').value;
  var targetDealerIds = targetMode === 'selected'
    ? Array.from(document.querySelectorAll('input[name=annDealer]:checked')).map(function(c){ return c.value; })
    : [];
  var status     = document.getElementById('annStatus').value;
  var publishAt  = document.getElementById('annPublishAt').value;
  var expireAt   = document.getElementById('annExpireAt').value;
  var link       = (document.getElementById('annLink').value || '').trim();
  var cnEl       = document.getElementById('annChangeNote');
  var changeNote = cnEl ? (cnEl.value || '').trim() : '';

  var now = firebase.firestore.FieldValue.serverTimestamp();
  var user = typeof CURRENT_USER !== 'undefined' && CURRENT_USER
    ? (CURRENT_USER.displayName || CURRENT_USER.email || 'unknown') : 'unknown';

  var data = {
    title: title,
    content: content,
    badges: badges,
    targetMode: targetMode,
    targetDealerIds: targetDealerIds,
    status: status,
    publishAt: publishAt ? new Date(publishAt) : null,
    expireAt: expireAt ? new Date(expireAt) : null,
    link: link || null,
    updatedAt: now,
    updatedBy: user
  };

  try {
    if (annId) {
      var existing = _annData && _annData.find(function(a){ return a.id === annId; });
      var prevVersion = (existing && existing.version) || 1;
      var newVersion = changeNote ? prevVersion + 1 : prevVersion;
      data.version = newVersion;
      data.lastChangeNote = changeNote || (existing ? existing.lastChangeNote || '' : '');
      await db.collection('announcements').doc(annId).update(data);
      if (changeNote) {
        await db.collection('announcements').doc(annId).collection('changelog').add({
          version: newVersion,
          changeNote: changeNote,
          contentSnapshot: content,
          updatedAt: now,
          updatedBy: user
        });
      }
    } else {
      data.version = 1;
      data.lastChangeNote = '';
      data.createdAt = now;
      data.createdBy = user;
      await db.collection('announcements').add(data);
    }
    _annData = null;
    closeMForce();
    toast('✅ บันทึกสำเร็จ');
    render();
  } catch(e) {
    console.warn('saveAnn error:', e);
    toast('❌ เกิดข้อผิดพลาด: ' + e.message);
  }
}

async function deleteAnn(annId) {
  if (!confirm('⚠️ ลบประกาศนี้จริงๆ? ข้อมูลจะหายถาวร')) return;
  try {
    await db.collection('announcements').doc(annId).delete();
    _annData = null;
    closeMForce();
    go('announcements');
    toast('✅ ลบประกาศแล้ว');
  } catch(e) {
    toast('❌ ' + e.message);
  }
}

// ================================================================
// DELIVERY MODAL
// ================================================================

function showAnnDeliveryModal(annId) {
  var ann = _annData && _annData.find(function(a){ return a.id === annId; });
  if (!ann) { toast('ไม่พบข้อมูลประกาศ'); return; }
  var dealers = ST.getAll('dealers');
  var targetDealers = ann.targetMode === 'selected'
    ? dealers.filter(function(d){ return (ann.targetDealerIds||[]).indexOf(d.id) >= 0; })
    : dealers;

  var h = '<div style="display:flex;flex-direction:column;gap:12px">';
  h += '<div style="font-size:13px;padding:8px 10px;background:var(--bg2);border-radius:6px">📢 <strong>' + sanitize(ann.title) + '</strong></div>';

  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">Dealer *</label>';
  h += '<select id="dlvDealer" class="inp" style="width:100%;margin-top:3px">';
  targetDealers.forEach(function(d){ h += '<option value="' + d.id + '">' + sanitize(d.name || d.id) + '</option>'; });
  h += '</select></div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">ช่องทาง *</label>';
  h += '<select id="dlvChannel" class="inp" style="width:100%;margin-top:3px">';
  h += '<option value="LINE">LINE</option><option value="Email">Email</option>';
  h += '</select></div></div>';

  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">หมายเหตุ</label>';
  h += '<input type="text" id="dlvNote" class="inp" placeholder="ส่งให้คุณ... / รายละเอียดเพิ่มเติม..." style="width:100%;box-sizing:border-box;margin-top:3px"></div>';

  h += '<div style="font-size:11px;color:var(--text2);padding:6px 8px;background:var(--bg2);border-radius:6px">⏺ บันทึกการส่งเวอร์ชัน v' + (ann.version || 1) + '</div>';

  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '<button class="btn bpr" onclick="saveAnnDelivery(\'' + annId + '\',' + (ann.version || 1) + ')">📤 บันทึกการส่ง</button>';
  h += '</div></div>';

  openM('บันทึกการส่งประกาศ', h);
}

async function saveAnnDelivery(annId, version) {
  var dealerId = document.getElementById('dlvDealer').value;
  var channel  = document.getElementById('dlvChannel').value;
  var note     = (document.getElementById('dlvNote').value || '').trim();
  if (!dealerId || !channel) { toast('❌ กรุณาเลือก Dealer และช่องทาง'); return; }

  var now  = firebase.firestore.FieldValue.serverTimestamp();
  var user = typeof CURRENT_USER !== 'undefined' && CURRENT_USER
    ? (CURRENT_USER.displayName || CURRENT_USER.email || 'unknown') : 'unknown';

  var update = {};
  update['channels.' + channel + '.sentAt']      = now;
  update['channels.' + channel + '.sentVersion'] = version || 1;
  update['channels.' + channel + '.sentBy']      = user;
  if (note) update.note = note;

  try {
    await db.collection('dealers').doc(dealerId).collection('announcementDeliveries').doc(annId).set(update, { merge: true });
    closeMForce();
    toast('✅ บันทึกการส่งแล้ว');
    render();
  } catch(e) {
    toast('❌ ' + e.message);
  }
}

// ================================================================
// CHANGELOG MODAL
// ================================================================

function showAnnChangelogModal(annId) {
  var ann = _annData && _annData.find(function(a){ return a.id === annId; });
  var title = ann ? ann.title : annId;
  openM('Changelog: ' + sanitize(title || ''), '<div style="text-align:center;padding:20px;color:var(--text2)">กำลังโหลด...</div>');

  db.collection('announcements').doc(annId).collection('changelog').orderBy('updatedAt','desc').get()
    .then(function(snap) {
      var h = '<div style="display:flex;flex-direction:column;gap:10px">';
      if (!snap.docs.length) {
        h += '<div style="text-align:center;color:var(--text2);padding:20px">ยังไม่มี Changelog</div>';
      } else {
        snap.docs.forEach(function(doc) {
          var log = doc.data();
          h += '<div style="border-left:3px solid var(--accent);padding:8px 12px;background:var(--bg2);border-radius:4px">';
          h += '<div style="font-size:11px;color:var(--text2);margin-bottom:4px">v' + (log.version||'?') + ' · ' + fmtAnnDate(log.updatedAt) + ' · ' + sanitize(log.updatedBy||'') + '</div>';
          h += '<div style="font-size:13px;font-weight:600">' + sanitize(log.changeNote||'') + '</div>';
          h += '</div>';
        });
      }
      h += '</div>';
      var bd = document.getElementById('mBd');
      if (bd) bd.innerHTML = h;
    })
    .catch(function(e) {
      var bd = document.getElementById('mBd');
      if (bd) bd.innerHTML = '<div style="color:#ef4444">เกิดข้อผิดพลาด: ' + e.message + '</div>';
    });
}

// ================================================================
// DEALER ANNOUNCEMENT TAB (called from views-dealer.js)
// ================================================================

var _dealerAnnCache = {};

function dealerAnnouncementsTab(d) {
  var h = '<div class="card">';
  h += '<h2 style="display:flex;justify-content:space-between;align-items:center">📢 ประกาศ <button class="btn bsm bpr" onclick="go(\'announcements\')">จัดการประกาศ ↗</button></h2>';
  h += '<div id="dealerAnnList"><div style="text-align:center;color:var(--text2);padding:20px">กำลังโหลด...</div></div>';
  h += '</div>';

  // Load announcements for this dealer
  if (!_annData) {
    _annLoadData(function() { _renderDealerAnnList(d); });
  } else {
    setTimeout(function() { _renderDealerAnnList(d); }, 0);
  }

  return h;
}

function _renderDealerAnnList(d) {
  var el = document.getElementById('dealerAnnList');
  if (!el || !_annData) return;

  var relevant = _annData.filter(function(a) {
    if (a.status !== 'active') return false;
    if (a.targetMode === 'selected') return (a.targetDealerIds||[]).indexOf(d.id) >= 0;
    return true;
  });

  if (!relevant.length) {
    el.innerHTML = '<div style="color:var(--text2);padding:16px;text-align:center">ยังไม่มีประกาศสำหรับ Dealer นี้</div>';
    return;
  }

  // Load deliveries for this dealer
  var promises = relevant.map(function(ann) {
    return db.collection('dealers').doc(d.id).collection('announcementDeliveries').doc(ann.id).get()
      .then(function(doc) { return { annId: ann.id, data: doc.exists ? doc.data() : {} }; })
      .catch(function() { return { annId: ann.id, data: {} }; });
  });

  Promise.all(promises).then(function(results) {
    var delivMap = {};
    results.forEach(function(r) { delivMap[r.annId] = r.data; });

    var h = '';
    relevant.forEach(function(ann) {
      var dlv = delivMap[ann.id] || {};
      var ch = dlv.channels || {};
      var lineOk = ch['LINE'] && ch['LINE'].sentAt;
      var emailOk = ch['Email'] && ch['Email'].sentAt;
      var portalOk = dlv.portalReadAt;

      h += '<div style="padding:12px 0;border-bottom:1px solid var(--border)">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="margin-bottom:4px">' + annBadgeHtml(ann.badges) + '</div>';
      h += '<div style="font-weight:600;font-size:14px">' + sanitize(ann.title||'') + '</div>';
      h += '<div style="font-size:11px;color:var(--text2);margin-top:4px">v' + (ann.version||1) + ' · ' + fmtAnnDate(ann.updatedAt||ann.createdAt) + '</div>';
      h += '</div>';
      h += '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0;font-size:15px">';
      h += '<span title="LINE ' + (lineOk?'ส่งแล้ว':'ยังไม่ส่ง') + '">' + (lineOk ? '✅' : '⬜') + ' LINE</span>';
      h += '<span title="Email ' + (emailOk?'ส่งแล้ว':'ยังไม่ส่ง') + '">' + (emailOk ? '✅' : '⬜') + ' Email</span>';
      h += '</div></div>';
      h += '<div style="margin-top:8px;display:flex;gap:6px">';
      h += '<button class="btn bsm bo" style="font-size:11px" onclick="showAnnDeliveryModalForDealer(\'' + ann.id + '\',\'' + d.id + '\')">📤 บันทึกส่ง</button>';
      h += '<button class="btn bsm bo" style="font-size:11px" onclick="go(\'announcements\',{annId:\'' + ann.id + '\'})">ดูรายละเอียด ↗</button>';
      h += '</div></div>';
    });

    var el2 = document.getElementById('dealerAnnList');
    if (el2) el2.innerHTML = h;
  });
}

function showAnnDeliveryModalForDealer(annId, dealerId) {
  var ann = _annData && _annData.find(function(a){ return a.id === annId; });
  if (!ann) { toast('ไม่พบข้อมูลประกาศ'); return; }
  var dealers = ST.getAll('dealers');
  var dealer = dealers.find(function(d){ return d.id === dealerId; });

  var h = '<div style="display:flex;flex-direction:column;gap:12px">';
  h += '<div style="font-size:13px;padding:8px 10px;background:var(--bg2);border-radius:6px">📢 <strong>' + sanitize(ann.title) + '</strong></div>';
  h += '<div style="font-size:13px">Dealer: <strong>' + sanitize(dealer ? dealer.name : dealerId) + '</strong></div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">ช่องทาง *</label>';
  h += '<select id="dlvChannel" class="inp" style="width:100%;margin-top:3px">';
  h += '<option value="LINE">LINE</option><option value="Email">Email</option>';
  h += '</select></div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">หมายเหตุ</label>';
  h += '<input type="text" id="dlvNote" class="inp" placeholder="รายละเอียดเพิ่มเติม..." style="width:100%;box-sizing:border-box;margin-top:3px"></div>';
  h += '<input type="hidden" id="dlvDealer" value="' + dealerId + '">';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '<button class="btn bpr" onclick="saveAnnDelivery(\'' + annId + '\',' + (ann.version||1) + ')">📤 บันทึก</button>';
  h += '</div></div>';

  openM('บันทึกการส่ง', h);
}

// ================================================================
// 1. STATS IN LIST VIEW
// ================================================================
function _loadAnnListStats(anns, dealers) {
  if (!anns.length || !dealers.length) return;
  // Query one subcollection per dealer, gather all deliveries
  var stats = {};
  anns.forEach(function(ann) {
    var total = ann.targetMode === 'selected'
      ? (ann.targetDealerIds || []).length
      : dealers.length;
    stats[ann.id] = { read: 0, lineSent: 0, emailSent: 0, total: total };
  });

  var done = 0;
  dealers.forEach(function(d) {
    db.collection('dealers').doc(d.id).collection('announcementDeliveries').get()
      .then(function(snap) {
        snap.docs.forEach(function(doc) {
          var s = stats[doc.id];
          if (!s) return;
          // Only count if this dealer is a target
          var ann = anns.find(function(a) { return a.id === doc.id; });
          if (!ann) return;
          if (ann.targetMode === 'selected' && (ann.targetDealerIds || []).indexOf(d.id) < 0) return;
          var dlv = doc.data();
          if (dlv.portalReadAt) s.read++;
          if (dlv.channels && dlv.channels.LINE && dlv.channels.LINE.sentAt) s.lineSent++;
          if (dlv.channels && dlv.channels.Email && dlv.channels.Email.sentAt) s.emailSent++;
        });
      })
      .catch(function() {})
      .finally(function() {
        done++;
        if (done === dealers.length) {
          // Fill placeholders
          Object.keys(stats).forEach(function(annId) {
            var el = document.getElementById('ann-stat-' + annId);
            if (!el) return;
            var s = stats[annId];
            var parts = [];
            if (s.lineSent > 0 || s.emailSent > 0) parts.push('📤 LINE ' + s.lineSent + '/' + s.total + ' · Email ' + s.emailSent + '/' + s.total);
            parts.push('👁 อ่าน ' + s.read + '/' + s.total);
            el.textContent = parts.join(' · ');
          });
        }
      });
  });
}

// ================================================================
// 2. DUPLICATE ANNOUNCEMENT
// ================================================================
async function duplicateAnn(annId) {
  var ann = _annData && _annData.find(function(a) { return a.id === annId; });
  if (!ann) { toast('ไม่พบข้อมูลประกาศ'); return; }
  var now = firebase.firestore.FieldValue.serverTimestamp();
  var user = typeof CURRENT_USER !== 'undefined' && CURRENT_USER
    ? (CURRENT_USER.displayName || CURRENT_USER.email || 'unknown') : 'unknown';
  var data = {
    title: 'Copy of ' + (ann.title || ''),
    content: ann.content || '',
    badges: ann.badges || [],
    targetMode: ann.targetMode || 'all',
    targetDealerIds: ann.targetDealerIds || [],
    status: 'draft',
    publishAt: null,
    expireAt: null,
    link: ann.link || null,
    version: 1,
    lastChangeNote: '',
    createdAt: now,
    createdBy: user,
    updatedAt: now,
    updatedBy: user
  };
  try {
    await db.collection('announcements').add(data);
    _annData = null;
    toast('✅ Clone แล้ว — บันทึกเป็น Draft');
    render();
  } catch(e) {
    toast('❌ ' + e.message);
  }
}

// ================================================================
// 3. EMAIL DRAFT FROM ANNOUNCEMENT
// ================================================================
function showDraftAnnEmail(annId) {
  var ann = _annData && _annData.find(function(a) { return a.id === annId; });
  if (!ann) { toast('ไม่พบข้อมูลประกาศ'); return; }
  var dealers = ST.getAll('dealers');
  var targetDealers = ann.targetMode === 'selected'
    ? dealers.filter(function(d) { return (ann.targetDealerIds || []).indexOf(d.id) >= 0; })
    : dealers;

  var h = '<div style="display:flex;flex-direction:column;gap:12px">';
  h += '<div style="font-size:13px;padding:8px 10px;background:var(--bg2);border-radius:6px">📢 <strong>' + sanitize(ann.title) + '</strong></div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">ส่งถึง Dealer</label>';
  h += '<select id="dae_dealer" class="inp" onchange="updateDraftAnnEmailTo(this)" style="width:100%;margin-top:3px">';
  h += '<option value="">-- เลือก Dealer --</option>';
  targetDealers.forEach(function(d) {
    var email = _getDealerEmail(d);
    h += '<option value="' + d.id + '" data-email="' + sanitize(email) + '">' + sanitize(d.name || d.id) + (email ? ' (' + email + ')' : ' (ไม่มี email)') + '</option>';
  });
  h += '</select></div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">To (email)</label>';
  h += '<input type="text" id="dae_to" class="inp" placeholder="email@company.com" style="width:100%;box-sizing:border-box;margin-top:3px"></div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">Subject</label>';
  h += '<input type="text" id="dae_subject" class="inp" value="' + sanitize('[แจ้ง] ' + (ann.title || '')) + '" style="width:100%;box-sizing:border-box;margin-top:3px"></div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">เนื้อหา</label>';
  var body = _buildAnnEmailBody(ann);
  h += '<textarea id="dae_body" class="inp" rows="8" style="width:100%;box-sizing:border-box;resize:vertical;margin-top:3px">' + sanitize(body) + '</textarea></div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '<button class="btn bo" onclick="copyDraftAnnEmail()">📋 Copy</button>';
  h += '<button class="btn bpr" onclick="openDraftAnnEmail()">📧 เปิด Email</button>';
  h += '</div></div>';
  openM('📧 Draft Email ประกาศ', h);
}

function _getDealerEmail(d) {
  if (d.contacts && d.contacts.length) {
    for (var i = 0; i < d.contacts.length; i++) {
      if (d.contacts[i].email) return d.contacts[i].email;
    }
  }
  return d.email || '';
}

function _buildAnnEmailBody(ann) {
  var cfg = typeof getConfig === 'function' ? getConfig() : {};
  var body = 'เรียน ทีมงาน,\n\n';
  body += '━━━━━━━━━━━━━━━━━━━━\n';
  body += '📢 ' + (ann.title || '') + '\n';
  body += '━━━━━━━━━━━━━━━━━━━━\n\n';
  body += (ann.content || '') + '\n';
  if (ann.link) body += '\n🔗 ลิงก์เพิ่มเติม: ' + ann.link + '\n';
  body += '\n━━━━━━━━━━━━━━━━━━━━\n';
  body += 'ขอบคุณครับ/ค่ะ\n';
  body += (cfg.saleName || '') + '\n';
  body += 'SIS Distribution (Thailand) PLC\n';
  body += 'DJI Authorized Distributor';
  return body;
}

function updateDraftAnnEmailTo(sel) {
  var email = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].dataset.email : '';
  var toEl = document.getElementById('dae_to');
  if (toEl) toEl.value = email || '';
}

function copyDraftAnnEmail() {
  var subject = (document.getElementById('dae_subject').value || '');
  var body = (document.getElementById('dae_body').value || '');
  if (typeof copyText === 'function') copyText('Subject: ' + subject + '\n\n' + body);
  toast('📋 Copy แล้ว');
}

function openDraftAnnEmail() {
  var to = encodeURIComponent(document.getElementById('dae_to').value || '');
  var subject = encodeURIComponent(document.getElementById('dae_subject').value || '');
  var body = encodeURIComponent(document.getElementById('dae_body').value || '');
  window.open('mailto:' + to + '?subject=' + subject + '&body=' + body);
  toast('📧 เปิด Email Client แล้ว');
}

// ================================================================
// 4. MARK ALL AS SENT
// ================================================================
function showMarkAllSentModal(annId) {
  var ann = _annData && _annData.find(function(a) { return a.id === annId; });
  if (!ann) { toast('ไม่พบข้อมูลประกาศ'); return; }
  var dealers = ST.getAll('dealers');
  var targetDealers = ann.targetMode === 'selected'
    ? dealers.filter(function(d) { return (ann.targetDealerIds || []).indexOf(d.id) >= 0; })
    : dealers;

  var h = '<div style="display:flex;flex-direction:column;gap:12px">';
  h += '<div style="font-size:13px;padding:8px 10px;background:var(--bg2);border-radius:6px">📢 <strong>' + sanitize(ann.title) + '</strong></div>';
  h += '<div style="padding:10px;background:rgba(59,130,246,0.08);border-radius:8px;font-size:13px">จะบันทึกว่าส่งให้ <strong>' + targetDealers.length + ' Dealer</strong> ทั้งหมด</div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">ช่องทาง *</label>';
  h += '<select id="mas_channel" class="inp" style="width:100%;margin-top:3px">';
  h += '<option value="LINE">LINE</option><option value="Email">Email</option>';
  h += '</select></div>';
  h += '<div><label style="font-size:11px;color:var(--text2);font-weight:600">หมายเหตุ</label>';
  h += '<input type="text" id="mas_note" class="inp" placeholder="เช่น ส่ง LINE Official, Broadcast..." style="width:100%;box-sizing:border-box;margin-top:3px"></div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '<button class="btn bpr" onclick="markAllAnnDelivered(\'' + annId + '\',' + (ann.version || 1) + ')">📤 บันทึกทั้งหมด</button>';
  h += '</div></div>';
  openM('📤 ส่งทั้งหมด', h);
}

async function markAllAnnDelivered(annId, version) {
  var channel = document.getElementById('mas_channel').value;
  var note = (document.getElementById('mas_note').value || '').trim();
  if (!channel) { toast('เลือกช่องทางก่อน'); return; }

  var ann = _annData && _annData.find(function(a) { return a.id === annId; });
  if (!ann) { toast('ไม่พบข้อมูลประกาศ'); return; }
  var dealers = ST.getAll('dealers');
  var targetDealers = ann.targetMode === 'selected'
    ? dealers.filter(function(d) { return (ann.targetDealerIds || []).indexOf(d.id) >= 0; })
    : dealers;

  var now = firebase.firestore.FieldValue.serverTimestamp();
  var user = typeof CURRENT_USER !== 'undefined' && CURRENT_USER
    ? (CURRENT_USER.displayName || CURRENT_USER.email || 'unknown') : 'unknown';

  var update = {};
  update['channels.' + channel + '.sentAt'] = now;
  update['channels.' + channel + '.sentVersion'] = version || 1;
  update['channels.' + channel + '.sentBy'] = user;
  if (note) update.note = note;

  try {
    // Firestore batch max 500 — split if needed
    var batch = db.batch();
    var count = 0;
    for (var i = 0; i < targetDealers.length; i++) {
      var ref = db.collection('dealers').doc(targetDealers[i].id).collection('announcementDeliveries').doc(annId);
      batch.set(ref, update, { merge: true });
      count++;
      if (count === 490 && i < targetDealers.length - 1) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    await batch.commit();
    closeMForce();
    toast('✅ บันทึก ' + targetDealers.length + ' Dealers แล้ว');
    render();
  } catch(e) {
    toast('❌ ' + e.message);
  }
}
