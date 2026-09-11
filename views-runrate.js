// ================================================================
// RUN RATE — สินค้าที่ Dealer ซื้อไปขายต่อ (ไม่ใช่โครงการ จึงไม่อยู่ใน Pipeline)
//
// 1 รายการ = 1 Project ID ที่ลูกค้าสร้างไว้เป็น "ถังรับยอด"
//   · SO แบบ run rate หลายใบผูกเข้าถังเดียวกันได้
//   · ลูกค้าสร้างหลายถังเพื่อแยก PO ได้ ถังจึงไม่ใช่ "1 ถังต่อ 1 Dealer"
//   · ยอดขายของถังมาจากผลรวม SO ที่ผูกไว้ ไม่ได้กรอกเอง — จะได้ไม่มีเลขสองชุดที่ขัดกัน
//
// แยกคอลเลกชันจาก pipeline โดยตั้งใจ (ผู้ใช้ขอว่าไม่ให้ปนกับ Pipeline) และไม่ยุ่งกับแผนสั่งซื้อ
// รายเดือนในแท็บ Forecast (customerForecasts type:'runrate') ซึ่ง KPI ใช้อยู่ — คนละเรื่องกัน
// ================================================================

var RUNRATE_STATUS = {
  active: { label: 'ใช้งานอยู่', color: '#22c55e', icon: '🟢' },
  closed: { label: 'ปิดแล้ว',    color: '#64748b', icon: '✓'  }
};

var runrateQ = '', runrateDealerFilter = 'all', runrateStatusFilter = 'active', runrateOpenId = null;

// ---- ตัวช่วย ----
function _rrSOs(rrId) {
  if (!rrId) return [];
  return ST.filter('salesOrders', function(s) { return s.runrateId === rrId; })
    .sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
}
function _rrSOTotal(s) {
  return (s.items || []).reduce(function(sum, it) { return sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);
}
function _rrTotal(rrId) {
  return _rrSOs(rrId).reduce(function(sum, s) { return sum + _rrSOTotal(s); }, 0);
}
// Project ID ของ run rate ห้ามซ้ำกัน — ถ้าซ้ำ ยอดจะเข้าถังผิดใบโดยไม่มีใครรู้
function _rrFindByProjectId(pid, exceptId) {
  var norm = String(pid || '').trim().toLowerCase();
  if (!norm) return null;
  return ST.getAll('runrate').filter(function(r) {
    return r.id !== exceptId && String(r.projectId || '').trim().toLowerCase() === norm;
  })[0] || null;
}
function _rrDealerName(dealerId) {
  var d = dealerId ? ST.getOne('dealers', dealerId) : null;
  return d ? (d.name || '') : '';
}

// ---- การ์ด 1 ใบ ----
function _rrCardHtml(r, opts) {
  opts = opts || {};
  var sos = _rrSOs(r.id), total = _rrTotal(r.id);
  var st = RUNRATE_STATUS[r.status || 'active'] || RUNRATE_STATUS.active;
  var open = runrateOpenId === r.id;
  var h = '<div class="card rr-card' + (open ? ' open' : '') + '" style="margin-bottom:10px;padding:13px 15px">';
  h += '<div class="rr-top" onclick="rrToggle(\'' + r.id + '\')">';
  h += '<div style="min-width:0;flex:1">';
  h += '<div class="rr-pid">🗂️ ' + (r.projectId ? sanitize(r.projectId) : '<span style="color:var(--warn)">ยังไม่มี Project ID</span>') + '</div>';
  h += '<div class="rr-sub">' + (opts.hideDealer ? '' : sanitize(_rrDealerName(r.dealerId) || '— ไม่ระบุ Dealer —') + ' · ') +
    '<span style="color:' + st.color + '">' + st.icon + ' ' + st.label + '</span>' +
    (r.note ? ' · ' + sanitize(String(r.note).substr(0, 40)) : '') + '</div>';
  h += '</div>';
  h += '<div class="rr-num"><div class="rr-amt">฿' + fmtMoney(total) + '</div>' +
    '<div class="rr-cnt">' + sos.length + ' SO</div></div>';
  h += '<span class="rr-ar">' + (open ? '▾' : '▸') + '</span>';
  h += '</div>';

  if (open) {
    h += '<div class="rr-body">';
    if (r.models) h += '<div class="rr-models">📦 ' + sanitize(r.models) + '</div>';
    if (!sos.length) {
      h += '<div class="rr-empty">ยังไม่มี SO ผูกกับ Project ID นี้ — สร้าง SO แบบ Run rate แล้วเลือก Project ID นี้ ยอดจะมารวมที่นี่เอง</div>';
    } else {
      h += '<table class="rr-tbl"><thead><tr><th>SO</th><th>PO ลูกค้า</th><th>สถานะ</th><th style="text-align:right">ยอด</th></tr></thead><tbody>';
      sos.forEach(function(s) {
        var sst = (typeof SO_STATUS !== 'undefined' && SO_STATUS[s.status]) || { label: s.status || '-', icon: '' };
        h += '<tr onclick="go(\'soDetail\',{soId:\'' + s.id + '\'})" style="cursor:pointer">' +
          '<td><b>' + sanitize(s.soNumber || '-') + '</b></td>' +
          '<td>' + sanitize(s.customerPO || '—') + '</td>' +
          '<td>' + (sst.icon || '') + ' ' + sanitize(sst.label) + '</td>' +
          '<td style="text-align:right">฿' + fmtMoney(_rrSOTotal(s)) + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    h += '<div class="rr-acts">' +
      '<button class="btn bsm bo" onclick="showRunRateM(\'' + r.id + '\')">✏️ แก้ไข</button>' +
      '<button class="btn bsm bo" onclick="rrCopyPid(\'' + r.id + '\')">📋 คัดลอก Project ID</button>' +
      '<button class="btn bsm bp" onclick="rrNewSO(\'' + r.id + '\')">➕ สร้าง SO เข้าถังนี้</button>' +
      '<button class="btn bsm bd" onclick="delRunRate(\'' + r.id + '\')">🗑️</button>' +
      '</div>';
    h += '</div>';
  }
  return h + '</div>';
}

function rrToggle(id) { runrateOpenId = (runrateOpenId === id) ? null : id; render(); }
function rrCopyPid(id) {
  var r = ST.getOne('runrate', id);
  if (!r || !r.projectId) return toast('รายการนี้ยังไม่มี Project ID');
  if (navigator.clipboard) navigator.clipboard.writeText(r.projectId).then(function() { toast('📋 คัดลอกแล้ว: ' + r.projectId); });
}
function rrNewSO(id) {
  var r = ST.getOne('runrate', id);
  if (!r) return;
  if (typeof showCreateSOModal === 'function') showCreateSOModal({ dealerId: r.dealerId, runrateId: r.id });
  else toast('เปิดฟอร์มสร้าง SO ไม่ได้');
}

// ---- รายการที่ผ่านตัวกรอง ----
function _rrFiltered() {
  var list = ST.getAll('runrate');
  if (runrateDealerFilter !== 'all') list = list.filter(function(r) { return r.dealerId === runrateDealerFilter; });
  if (runrateStatusFilter !== 'all') list = list.filter(function(r) { return (r.status || 'active') === runrateStatusFilter; });
  if (runrateQ) {
    var q = runrateQ.toLowerCase();
    list = list.filter(function(r) {
      return (r.projectId || '').toLowerCase().indexOf(q) !== -1 ||
             (r.models || '').toLowerCase().indexOf(q) !== -1 ||
             (r.note || '').toLowerCase().indexOf(q) !== -1 ||
             _rrDealerName(r.dealerId).toLowerCase().indexOf(q) !== -1;
    });
  }
  // ถังที่มียอดเยอะขึ้นก่อน — เป็นถังที่กำลังเดินจริง
  return list.sort(function(a, b) { return _rrTotal(b.id) - _rrTotal(a.id); });
}

// ---- เมนูหลัก ----
function rRunRate(el) {
  document.getElementById('pgT').textContent = '🏪 Run Rate';
  var all = ST.getAll('runrate');
  var list = _rrFiltered();
  var dealers = ST.getAll('dealers').sort(function(a, b) { return (a.name || '') > (b.name || '') ? 1 : -1; });

  var grand = list.reduce(function(s, r) { return s + _rrTotal(r.id); }, 0);
  var soCount = list.reduce(function(s, r) { return s + _rrSOs(r.id).length; }, 0);

  var h = '<div class="card" style="margin-bottom:12px">';
  h += '<div class="hint" style="margin-bottom:10px">สินค้าที่ Dealer ซื้อไปขายต่อ — ไม่ใช่โครงการ จึงแยกจาก Pipeline · ' +
    '1 รายการ = 1 Project ID ที่ลูกค้าสร้างไว้รับยอด · SO แบบ Run rate หลายใบผูกเข้า Project ID เดียวกันได้</div>';
  h += '<div class="rr-stats">' +
    '<div class="rr-stat"><div class="n">' + list.length + '</div><div class="l">Project ID</div></div>' +
    '<div class="rr-stat"><div class="n">' + soCount + '</div><div class="l">SO ที่ผูกไว้</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:#22c55e">฿' + fmtMoney(grand) + '</div><div class="l">ยอดขายรวม</div></div>' +
    '</div></div>';

  h += '<div class="rr-toolbar">';
  h += '<input type="text" id="rrQ_el" class="inp" placeholder="🔍 ค้นหา Project ID / Dealer / รุ่น" value="' + sanitize(runrateQ) + '" oninput="runrateQ=this.value;render()" autocomplete="off">';
  h += '<select class="inp" onchange="runrateDealerFilter=this.value;render()"><option value="all">ทุก Dealer</option>' +
    dealers.map(function(d) {
      return '<option value="' + d.id + '"' + (runrateDealerFilter === d.id ? ' selected' : '') + '>' + sanitize(d.name) + '</option>';
    }).join('') + '</select>';
  h += '<select class="inp" onchange="runrateStatusFilter=this.value;render()">' +
    ['active', 'closed', 'all'].map(function(s) {
      var lbl = s === 'all' ? 'ทุกสถานะ' : RUNRATE_STATUS[s].label;
      return '<option value="' + s + '"' + (runrateStatusFilter === s ? ' selected' : '') + '>' + lbl + '</option>';
    }).join('') + '</select>';
  h += '<button class="btn bp" onclick="showRunRateM()">➕ เพิ่ม Project ID</button>';
  h += '</div>';

  if (!list.length) {
    h += '<div class="empty"><p>' + (all.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' :
      'ยังไม่มี Project ID สำหรับ Run rate — กด “➕ เพิ่ม Project ID” เพื่อบันทึกอันที่ลูกค้าสร้างไว้') + '</p></div>';
  } else {
    h += list.map(function(r) { return _rrCardHtml(r); }).join('');
  }
  el.innerHTML = h;
}

// ---- แท็บในหน้า Dealer ----
function dealerRunRateTab(d) {
  var list = ST.runrateByDealer(d.id).sort(function(a, b) { return _rrTotal(b.id) - _rrTotal(a.id); });
  var total = list.reduce(function(s, r) { return s + _rrTotal(r.id); }, 0);
  var soCount = list.reduce(function(s, r) { return s + _rrSOs(r.id).length; }, 0);

  var h = '<div class="hint" style="margin-bottom:10px">Project ID ที่ลูกค้าสร้างไว้รับยอด Run rate — ไม่ใช่โครงการ จึงไม่อยู่ใน Pipeline</div>';
  h += '<div class="rr-stats" style="margin-bottom:12px">' +
    '<div class="rr-stat"><div class="n">' + list.length + '</div><div class="l">Project ID</div></div>' +
    '<div class="rr-stat"><div class="n">' + soCount + '</div><div class="l">SO ที่ผูกไว้</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:#22c55e">฿' + fmtMoney(total) + '</div><div class="l">ยอดขายรวม</div></div>' +
    '</div>';
  h += '<button class="btn bp bsm" style="margin-bottom:10px" onclick="showRunRateM(null,\'' + d.id + '\')">➕ เพิ่ม Project ID</button>';
  h += list.length ? list.map(function(r) { return _rrCardHtml(r, { hideDealer: true }); }).join('')
    : '<div class="empty"><p>Dealer รายนี้ยังไม่มี Project ID สำหรับ Run rate</p></div>';
  return h;
}

// ---- ฟอร์มเพิ่ม/แก้ไข ----
function showRunRateM(id, presetDealerId) {
  var r = id ? ST.getOne('runrate', id) : null;
  var dealers = ST.getAll('dealers').sort(function(a, b) { return (a.name || '') > (b.name || '') ? 1 : -1; });
  var curDealer = (r && r.dealerId) || presetDealerId || '';

  var h = '<div class="hint" style="margin-bottom:10px">Project ID นี้คือเลขที่ลูกค้าสร้างไว้สำหรับ Run rate — ใช้เป็นถังรับยอด SO หลายใบได้</div>';
  h += '<div class="fg"><label>Dealer *</label><select id="rr_dealer" class="inp"><option value="">-- เลือก Dealer --</option>' +
    dealers.map(function(d) {
      return '<option value="' + d.id + '"' + (curDealer === d.id ? ' selected' : '') + '>' + sanitize(d.name) + '</option>';
    }).join('') + '</select></div>';
  h += '<div class="fg"><label>Project ID (Run rate) *</label>' +
    '<input type="text" id="rr_pid" class="inp" value="' + sanitize((r && r.projectId) || '') + '" placeholder="เลขที่ลูกค้าสร้างไว้สำหรับ Run rate"></div>';
  h += '<div class="fg"><label>รุ่นสินค้า <small style="color:var(--text2)">(ใส่ไว้ให้รู้ว่าถังนี้ใช้กับอะไร — เว้นว่างได้)</small></label>' +
    '<input type="text" id="rr_models" class="inp" value="' + sanitize((r && r.models) || '') + '" placeholder="เช่น Mavic 3E, Mini 4 Pro"></div>';
  h += '<div class="fg"><label>สถานะ</label><select id="rr_status" class="inp">' +
    Object.keys(RUNRATE_STATUS).map(function(k) {
      return '<option value="' + k + '"' + ((r && r.status || 'active') === k ? ' selected' : '') + '>' + RUNRATE_STATUS[k].icon + ' ' + RUNRATE_STATUS[k].label + '</option>';
    }).join('') + '</select></div>';
  h += '<div class="fg"><label>หมายเหตุ</label><textarea id="rr_note" class="inp" rows="2" placeholder="เช่น แยก PO รอบไตรมาส 4">' + sanitize((r && r.note) || '') + '</textarea></div>';
  h += '<button class="btn bp btn-full" onclick="saveRunRate(' + (id ? '\'' + id + '\'' : 'null') + ')">💾 บันทึก</button>';
  openM(id ? '✏️ แก้ไข Project ID (Run rate)' : '➕ เพิ่ม Project ID (Run rate)', h);
}

function saveRunRate(id) {
  var dealerId = (document.getElementById('rr_dealer') || {}).value || '';
  var pid      = ((document.getElementById('rr_pid') || {}).value || '').trim();
  var models   = ((document.getElementById('rr_models') || {}).value || '').trim();
  var status   = (document.getElementById('rr_status') || {}).value || 'active';
  var note     = ((document.getElementById('rr_note') || {}).value || '').trim();

  if (!dealerId) { alert('เลือก Dealer ก่อนนะครับ'); return; }
  if (!pid) { alert('ใส่ Project ID ก่อนนะครับ — เป็นตัวที่ใช้ผูกยอด SO เข้ามา'); return; }
  // กันเลขซ้ำ ไม่งั้น SO จะผูกเข้าถังผิดใบแล้วยอดเพี้ยนโดยไม่มีใครสังเกต
  var dup = _rrFindByProjectId(pid, id);
  if (dup) {
    alert('Project ID "' + pid + '" ถูกใช้อยู่แล้วกับ ' + (_rrDealerName(dup.dealerId) || 'Dealer อื่น') +
          '\n\nเลขนี้ต้องไม่ซ้ำ เพราะใช้ผูกยอด SO เข้าถัง ถ้าซ้ำยอดจะเข้าผิดใบ');
    return;
  }

  var data = { dealerId: dealerId, projectId: pid, models: models, status: status, note: note };
  var saved;
  if (id) {
    saved = ST.update('runrate', id, data);
    toast('💾 บันทึกแล้ว');
  } else {
    saved = ST.add('runrate', Object.assign({ createdAt: new Date().toISOString() }, data));
    toast('✅ เพิ่ม Project ID สำหรับ Run rate แล้ว');
  }
  if (saved && typeof syncItemToFirebase === 'function') syncItemToFirebase('runrate', saved);
  closeMForce();
  render();
}

function delRunRate(id) {
  var r = ST.getOne('runrate', id);
  if (!r) return;
  var n = _rrSOs(id).length;
  // SO ที่ผูกไว้ไม่ถูกลบตาม — แค่หลุดจากถัง ต้องบอกให้ชัดว่าจะเสียการเชื่อมโยงอะไรไป
  if (!confirm('ลบ Project ID "' + (r.projectId || '') + '" ?' +
      (n ? '\n\n⚠️ มี SO ผูกอยู่ ' + n + ' ใบ — SO จะไม่ถูกลบ แต่จะไม่ถูกนับรวมเป็นยอด Run rate ของถังนี้อีก' : ''))) return;
  ST.delete('runrate', id);
  if (typeof deleteItemFromFirebase === 'function') deleteItemFromFirebase('runrate', id);
  if (runrateOpenId === id) runrateOpenId = null;
  toast('🗑️ ลบแล้ว');
  render();
}
