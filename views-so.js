// ================================================================
// views-so.js — Sales Order Management
// ================================================================

var soFlt    = 'all';
var soSearch = '';
var soSelectMode = false;
var soSelected = {};
var _soVisibleIds = [];
var _soTimelineExpandedIdx = null;

// สถานะนี้คือสถานะ "เอกสาร/งานธุรการ" ล้วนๆ — คุมด้วยมือตามปกติ ไม่ผูกกับว่าสินค้าพร้อมส่งจริงหรือยัง
// ความพร้อมส่งจริง (สินค้าบางชิ้นต้อง QI บางชิ้นไม่ต้อง คนละคลังกัน) คำนวณแยกต่างหากแบบ real-time ต่อรายการ ดู soComputeReadiness()
// เดิมมี 14 สถานะไล่ทีละสเต็ปตาม 1 เส้นทางเดียว (ต้องผ่าน QI เสมอ) ใช้ไม่ได้จริงกับ SO ที่มีทั้งสินค้าต้อง QI และไม่ต้อง QI ปนกัน — ยุบเหลือสถานะเอกสารกว้างๆ แทน
var SO_STATUS = {
  po_received: { label:'ได้รับ PO',          color:'#94a3b8', icon:'📄' },
  so_open:     { label:'เปิด SO / รอของ',    color:'#3b82f6', icon:'📋' },
  shipped:     { label:'ส่งแล้ว',            color:'#6366f1', icon:'📦' },
  invoiced:    { label:'ออก Invoice แล้ว',   color:'#8b5cf6', icon:'🧾' },
  closed:      { label:'ปิด',                 color:'#64748b', icon:'✓'  }
};

var _SO_NEXT = {
  po_received: ['so_open'],
  so_open:     ['shipped'],
  shipped:     ['invoiced'],
  invoiced:    ['closed'],
  closed:      []
};

// สถานะเก่าที่ถูกยุบทิ้ง — map ไปสถานะใหม่ที่ใกล้เคียงที่สุด ใช้ตอน migrate ข้อมูลเก่าครั้งเดียว (ดู _soMigrateStatuses)
var _SO_STATUS_MIGRATE_MAP = {
  stock_ok:'so_open', pr_po_open:'so_open', pm_ordered:'so_open', waiting_vendor:'so_open',
  goods_arrived_qi:'so_open', goods_arrived_wh:'so_open', qi_passed:'so_open', reserved:'so_open', ready_ship:'so_open'
};

function _soMigrateStatuses() {
  if (localStorage.getItem('v7_so_status_migrated_v1')) return;
  var changed = false;
  ST.getAll('salesOrders').forEach(function(s) {
    var mapped = _SO_STATUS_MIGRATE_MAP[s.status];
    if (mapped) { ST.update('salesOrders', s.id, { status: mapped }); changed = true; }
  });
  localStorage.setItem('v7_so_status_migrated_v1', '1');
  if (changed && typeof syncToFirebase === 'function') syncToFirebase('salesOrders', ST.getAll('salesOrders'));
}

// จับ 5 สถานะเอกสารเป็นขั้นสำหรับแถบ progress ในตาราง (1 สถานะ = 1 ขั้นพอดี ตอนนี้ไม่ต้องยุบรวมแล้ว)
var _SO_STAGES = [
  { key:'po_received', label:'ได้รับ PO',       statuses:['po_received'] },
  { key:'so_open',      label:'เปิด SO/รอของ',   statuses:['so_open'] },
  { key:'shipped',      label:'ส่งแล้ว',         statuses:['shipped'] },
  { key:'invoiced',     label:'Invoice',         statuses:['invoiced'] },
  { key:'closed',       label:'ปิด',              statuses:['closed'] }
];
function _soStageIndex(status) {
  for (var i = 0; i < _SO_STAGES.length; i++) if (_SO_STAGES[i].statuses.indexOf(status) !== -1) return i;
  return 0;
}
function _soIsDone(status) { return ['shipped','invoiced','closed'].indexOf(status) !== -1; }

// จำนวนวันที่อยู่ในสถานะปัจจุบัน = วันนี้ − วันที่ log ล่าสุด (ที่เปลี่ยนมาสถานะนี้)
function _soDaysInStage(s) {
  var logs = s.logs || [];
  var d = logs.length ? logs[logs.length - 1].date : (s.updatedAt || s.createdAt);
  if (!d) return null;
  d = String(d).split('T')[0];
  return Math.max(0, Math.round((new Date(_td()) - new Date(d)) / 864e5));
}

// แถบขั้น ระบายสีถึงขั้นปัจจุบัน (จำนวนขั้น = _SO_STAGES.length)
function _soProgressBar(status) {
  var cur = _soStageIndex(status);
  var color = _soIsDone(status) ? '#22c55e' : (cur <= 0 ? '#f59e0b' : '#3b82f6');
  var h = '<div style="display:flex;gap:3px;margin-bottom:3px;min-width:120px">';
  for (var i = 0; i < _SO_STAGES.length; i++) h += '<span style="flex:1;height:6px;border-radius:3px;background:' + (i <= cur ? color : 'var(--border)') + '"></span>';
  return h + '</div>';
}

// สรุปความพร้อมส่งของทั้ง SO จากรายการต่อรายการ (real-time จากสต็อกจริง ไม่ใช่ค่าที่ต้องกดตั้งเอง)
// รายการที่ไม่มี SKU (สินค้า by-order ที่ไม่ track ในคลัง) ไม่นับรวม ไม่ถือเป็นตัวบล็อกความพร้อมส่ง
function soComputeReadiness(so) {
  var items = (so.items || []).filter(function(it) { return it.sku; });
  if (!items.length) return { total: 0, readyCount: 0, allReady: true, items: [] };
  var perItem = items.map(function(it) {
    var info = (typeof stockSOItemReadyInfo === 'function') ? stockSOItemReadyInfo(it.sku, it.qty, so) : { ready: true };
    return { model: it.model, ready: info.ready };
  });
  var readyCount = perItem.filter(function(x) { return x.ready; }).length;
  return { total: perItem.length, readyCount: readyCount, allReady: readyCount === perItem.length, items: perItem };
}

// SO ที่เปิดอยู่ (so_open) และพร้อมส่งครบทุกรายการแล้ว แต่ยังไม่มีใครกดเปลี่ยนสถานะเป็น "ส่งแล้ว" — ใช้ต่อยอดในแถบ 🔔 ต้องติดตาม
function soGetReadyReminders() {
  return ST.getAll('salesOrders')
    .filter(function(s) { return s.status === 'so_open'; })
    .map(function(s) { return { so: s, readiness: soComputeReadiness(s) }; })
    .filter(function(x) { return x.readiness.total > 0 && x.readiness.allReady; })
    .map(function(x) {
      return { soId: x.so.id, soNumber: x.so.soNumber, dealerName: x.so.dealerName,
        label: 'พร้อมส่งแล้ว: ' + (x.so.soNumber || '-') + ' (' + (x.so.dealerName || '-') + ')' };
    });
}

// ป้ายเตือน: เลย due date หรือค้างในขั้นนานเกิน (ยกเว้นส่งแล้ว)
function _soWarnBadge(s) {
  if (_soIsDone(s.status)) return '';
  var out = '';
  if (s.dueDate && s.dueDate < _td()) {
    var late = Math.round((new Date(_td()) - new Date(s.dueDate)) / 864e5);
    out += '<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:#ef444422;color:#ef4444;border:1px solid #ef444455;white-space:nowrap">🔴 เลยกำหนด ' + late + ' วัน</span>';
  } else if (s.dueDate) {
    var left = _soDaysTo(s.dueDate);
    if (left <= 3) out += '<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b55;white-space:nowrap">⏰ ตามภายใน ' + left + ' วัน</span>';
  }
  var days = _soDaysInStage(s);
  if (!out && days != null && days >= 7) out += '<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b55;white-space:nowrap">⚠️ ค้าง ' + days + ' วัน</span>';
  return out;
}
function _soDaysTo(dateStr) { return Math.round((new Date(dateStr) - new Date(_td())) / 864e5); }

// SO ที่ต้องตาม: เลย due date หรือค้างในขั้นเดิม ≥ 7 วัน (ยังไม่ส่ง)
function _soNeedsAttention(s) {
  if (_soIsDone(s.status)) return false;
  if (s.dueDate && s.dueDate < _td()) return true;
  var d = _soDaysInStage(s);
  return d != null && d >= 7;
}

// ---------------------------------------------------------------- helpers

function _soStatusBadge(st) {
  var s = SO_STATUS[st] || { label: st, color:'#94a3b8', icon:'?' };
  return '<span style="font-size:10px;padding:2px 8px;border-radius:10px;border:1px solid;white-space:nowrap;background:' +
    s.color + '22;border-color:' + s.color + '55;color:' + s.color + '">' + s.icon + ' ' + s.label + '</span>';
}

function _soNextNum(prefix) {
  var all = ST.getAll('salesOrders');
  var yr  = new Date().getFullYear();
  var re  = new RegExp('^' + prefix + '-\\d{4}-(\\d+)$');
  var max = 0;
  all.forEach(function(s) {
    var src = prefix === 'SO' ? s.soNumber : s.invoiceNumber;
    var m   = (src || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1]));
  });
  return prefix + '-' + yr + '-' + String(max + 1).padStart(3, '0');
}

// รายการ serial แบบเดียว (แทน serialsReceived/serialsShipped เดิม) — ของเก่ายังอ่านได้ผ่าน fallback นี้
// พอบันทึกซ้ำผ่านหน้าแก้ไข serial จะรวมเข้า it.serials ให้เองอัตโนมัติ ไม่ต้อง migrate ล่วงหน้า
function _soItemSerials(it) {
  if (it.serials) return it.serials;
  var merged = (it.serialsReceived || []).concat(it.serialsShipped || []);
  return merged.filter(function(sn, i) { return merged.indexOf(sn) === i; });
}

function _soSerialSpan(sn) {
  return '<span data-serial="' + sanitize(sn) + '" style="display:inline-block;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:1px 6px;margin:1px 2px;font-family:monospace;font-size:11px">' +
    sanitize(sn) + ' <a href="#" onclick="this.parentElement.remove();return false" style="color:var(--text2);text-decoration:none">✕</a></span>';
}

function _collectSerials(idx) {
  var wrap = document.getElementById('soSt_sw_' + idx);
  if (!wrap) return [];
  var out = [];
  wrap.querySelectorAll('[data-serial]').forEach(function(el) { out.push(el.getAttribute('data-serial')); });
  return out;
}

function _addSOSerial(idx) {
  var inp  = document.getElementById('soSt_si_' + idx);
  var wrap = document.getElementById('soSt_sw_' + idx);
  if (!inp || !wrap) return;
  var val = inp.value.trim();
  if (!val) return;
  var span = document.createElement('span');
  span.innerHTML = _soSerialSpan(val);
  wrap.appendChild(span.firstChild);
  inp.value = '';
  inp.focus();
}

// ---------------------------------------------------------------- list

function rSalesOrders(el) {
  _soMigrateStatuses();
  document.getElementById('pgT').textContent = '📦 Sales Order';
  var all = ST.getAll('salesOrders');

  // "พร้อมส่ง"/"รอของ" ไม่ใช่สถานะที่ตั้งเอง — คำนวณสดจากความพร้อมส่งจริงของ SO ที่ยังเปิดอยู่ (so_open)
  var openSOs   = all.filter(function(s){ return s.status==='so_open'; });
  var activeCnt = all.filter(function(s){ return ['closed','invoiced'].indexOf(s.status)===-1; }).length;
  var readyCnt  = openSOs.filter(function(s){ return soComputeReadiness(s).allReady; }).length;
  var waitCnt   = openSOs.filter(function(s){ return !soComputeReadiness(s).allReady; }).length;
  var invCnt    = all.filter(function(s){ return s.status==='invoiced'; }).length;
  var attnCnt   = all.filter(_soNeedsAttention).length;

  var list = all.slice();
  if (soFlt === 'project')    list = list.filter(function(s){ return s.type==='project'; });
  if (soFlt === 'runrate')    list = list.filter(function(s){ return s.type==='runrate'; });
  if (soFlt === 'active')     list = list.filter(function(s){ return ['closed','invoiced'].indexOf(s.status)===-1; });
  if (soFlt === 'ready_ship') list = list.filter(function(s){ return s.status==='so_open' && soComputeReadiness(s).allReady; });
  if (soFlt === 'waiting')    list = list.filter(function(s){ return s.status==='so_open' && !soComputeReadiness(s).allReady; });
  if (soFlt === 'attention')  list = list.filter(_soNeedsAttention);
  if (soSearch) {
    var q = soSearch.toLowerCase();
    list = list.filter(function(s){
      return (s.soNumber||'').toLowerCase().indexOf(q)!==-1 ||
             (s.dealerName||'').toLowerCase().indexOf(q)!==-1 ||
             (s.customerPO||'').toLowerCase().indexOf(q)!==-1 ||
             (s.invoiceNumber||'').toLowerCase().indexOf(q)!==-1 ||
             (s.items||[]).some(function(it){ return (it.model||'').toLowerCase().indexOf(q)!==-1; });
    });
  }
  list.sort(function(a,b){ return (b.createdAt||'')>(a.createdAt||'')?1:-1; });

  _soVisibleIds = list.map(function(s){ return s.id; });

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">' +
    '<h2 style="margin:0;font-size:1.05rem">📦 Sales Order</h2>' +
    '<div style="display:flex;gap:8px">' +
    '<button class="btn ' + (soSelectMode ? 'bd' : 'bo') + '" onclick="toggleSOSelectMode()">☑️ ' + (soSelectMode ? 'ยกเลิก' : 'เลือก') + '</button>' +
    '<button class="btn bp" onclick="showCreateSOModal({})">➕ สร้าง SO</button></div></div>';

  var stats = [
    { label:'ทั้งหมด',      val: all.length,  bg:'var(--bg2)',    fg:'var(--text)'  },
    { label:'Active',       val: activeCnt,   bg:'#3b82f622',     fg:'#3b82f6'      },
    { label:'พร้อมส่ง',     val: readyCnt,    bg:'#22c55e22',     fg:'#22c55e'      },
    { label:'รอสินค้า',     val: waitCnt,     bg:'#f59e0b22',     fg:'#f59e0b'      },
    { label:'ต้องตาม',      val: attnCnt,     bg:'#ef444422',     fg:'#ef4444'      }
  ];
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:16px">';
  stats.forEach(function(st){
    html += '<div style="background:' + st.bg + ';border-radius:10px;padding:12px 14px">' +
      '<div style="font-size:12px;color:' + st.fg + ';opacity:.85;margin-bottom:4px">' + st.label + '</div>' +
      '<div style="font-size:22px;font-weight:600;color:' + st.fg + '">' + st.val + '</div></div>';
  });
  html += '</div>';

  html += '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
    '<input type="text" id="soSrc" placeholder="🔍 ค้นหา SO / Dealer / PO / Invoice / Model..." style="flex:1;min-width:200px" oninput="soSearchInput(this.value)" value="' + sanitize(soSearch) + '" autocomplete="off">' +
    '</div>';

  var chips = [
    ['all','ทั้งหมด', all.length],
    ['active','🔵 Active', activeCnt],
    ['project','📋 Project', all.filter(function(s){return s.type==='project';}).length],
    ['runrate','🏪 Run rate', all.filter(function(s){return s.type==='runrate';}).length],
    ['ready_ship','🚚 พร้อมส่ง', readyCnt],
    ['waiting','⏳ รอสินค้า', waitCnt],
    ['attention','⚠️ ต้องตาม', attnCnt]
  ];
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">';
  chips.forEach(function(c){
    var act = soFlt===c[0];
    html += '<div onclick="soFlt=\'' + c[0] + '\';render()" style="cursor:pointer;padding:5px 12px;border-radius:20px;font-size:12px;white-space:nowrap;border:1px solid ' + (act?'var(--accent)':'var(--border)') + ';background:' + (act?'var(--accent)':'transparent') + ';color:' + (act?'#fff':'var(--text2)') + '">' +
      c[1] + ' <b>' + c[2] + '</b></div>';
  });
  html += '</div>';

  if (!list.length) {
    html += '<div style="text-align:center;color:var(--text2);padding:48px 0">ยังไม่มี Sales Order' + (soSearch||soFlt!=='all'?' (ไม่มีรายการตรงตัวกรอง)':'') + '</div>';
  } else {
    html += '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px"><table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr style="background:var(--bg2);text-align:left">' +
      (soSelectMode ? '<th style="padding:10px 12px;width:32px;text-align:center"><input type="checkbox" id="soSelAll" title="เลือกทั้งหมด" onclick="toggleSOSelectAll(this.checked)"></th>' : '') +
      '<th style="padding:10px 12px;font-weight:600;color:var(--text2)">SO No.</th>' +
      '<th style="padding:10px 12px;font-weight:600;color:var(--text2)">Dealer</th>' +
      '<th style="padding:10px 12px;font-weight:600;color:var(--text2)">สินค้า</th>' +
      '<th style="padding:10px 12px;font-weight:600;color:var(--text2);text-align:right">มูลค่า</th>' +
      '<th style="padding:10px 12px;font-weight:600;color:var(--text2);min-width:190px">ความคืบหน้า</th>' +
      '<th style="padding:10px 12px"></th></tr></thead><tbody>';
    list.forEach(function(s){
      var total  = (s.items||[]).reduce(function(sum,it){ return sum+(Number(it.qty)||0)*(Number(it.unitPrice)||0); },0);
      var models = (s.items||[]).map(function(it){ return it.model; }).filter(Boolean);
      var modelsTxt = models.length ? (models[0] + (models.length>1 ? ', +' + (models.length-1) + ' more' : '')) : '-';
      var days   = _soDaysInStage(s);
      var warn   = _soWarnBadge(s);
      var typeTag = '<span style="font-size:9px;padding:0 4px;border-radius:3px;background:var(--bg2);border:1px solid var(--border)">' + (s.type==='project'?'📋':'🏪') + '</span>';
      var selectCell = soSelectMode
        ? '<td style="padding:10px 12px;text-align:center" onclick="event.stopPropagation();toggleSOSelect(\'' + s.id + '\')">' +
          '<input type="checkbox" id="soChk_' + s.id + '" ' + (soSelected[s.id] ? 'checked' : '') + ' onclick="event.stopPropagation();toggleSOSelect(\'' + s.id + '\')"></td>'
        : '';
      var trOnclick = soSelectMode ? ' onclick="toggleSOSelect(\'' + s.id + '\')"' : ' onclick="go(\'soDetail\',{soId:\'' + s.id + '\'})"';
      html += '<tr style="cursor:pointer;border-top:1px solid var(--border)"' + trOnclick + '">' +
        selectCell +
        '<td style="padding:12px">' + qcopyHtml(s.soNumber||'-') + ' ' + typeTag + '</td>' +
        '<td style="padding:12px">' + (_gvHidden('so_dealerInfo') ? '-' : (sanitize(s.dealerName||'-') + (s.customerPO ? '<div style="color:var(--text2);font-size:11px">' + qcopyHtml(s.customerPO) + '</div>' : ''))) + '</td>' +
        '<td style="padding:12px;color:var(--text2);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(models.join(', ')) + '">' + sanitize(modelsTxt) + '</td>' +
        '<td style="padding:12px;text-align:right">' + (_gvHidden('so_price') ? '-' : (total ? fmtMoneyShort(total) : '-')) + '</td>' +
        '<td style="padding:12px">' + _soProgressBar(s.status) +
          '<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">' + _soStatusBadge(s.status) +
          (!_soIsDone(s.status) && days != null ? '<span style="font-size:10px;color:var(--text2)">' + days + ' วัน</span>' : '') + (warn ? warn : '') + '</div>' +
          // เดิมสถานะ pr_po_open โชว์ข้อมูลนี้อยู่ในตัว พอยุบรวมเป็น so_open แล้วต้องมีบรรทัดนี้แทน ไม่งั้นเลข PR/ETA หายไปจากมุมมอง list เลย
          (s.status === 'so_open' && (s.prNumber || s.expectedDelivery) ?
            '<div style="font-size:10px;color:var(--text2);margin-top:2px">' + (s.prNumber ? 'PR: ' + sanitize(s.prNumber) : '') + (s.prNumber && s.expectedDelivery ? ' · ' : '') + (s.expectedDelivery ? 'ETA: ' + fD(s.expectedDelivery) : '') + '</div>' : '') +
          '</td>' +
        '<td style="padding:12px;text-align:right;color:var(--text2)">' + (soSelectMode ? '' : '›') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
  }

  if (soSelectMode) {
    var selCnt = Object.keys(soSelected).length;
    html += '<div id="soSelBar" style="position:sticky;bottom:0;z-index:50;background:var(--card);border-top:2px solid var(--accent);padding:10px 14px;margin-top:12px;border-radius:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<span id="soSelCount" style="font-size:13px;font-weight:600;min-width:80px">' + selCnt + ' รายการที่เลือก</span>' +
      '<button class="btn bo bsm" onclick="toggleSOSelectAll(true)">เลือกทั้งหมด (' + _soVisibleIds.length + ')</button>' +
      '<button class="btn bo bsm" onclick="toggleSOSelectAll(false)">ยกเลิกเลือก</button>' +
      (function() {
        var opts = Object.keys(SO_STATUS).map(function(k) { return '<option value="' + k + '">' + SO_STATUS[k].icon + ' ' + SO_STATUS[k].label + '</option>'; }).join('');
        return '<select id="soSelStatusSel" ' + (!selCnt ? 'disabled' : '') + ' style="font-size:12px;min-width:140px"><option value="">✏️ เปลี่ยนสถานะ...</option>' + opts + '</select>' +
          '<button class="btn bo bsm" id="soSelStatusBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkChangeSOStatus()">ยืนยัน</button>';
      })() +
      '<button class="btn bo bsm" id="soSelExportBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkExportSO()">📥 Export ที่เลือก</button>' +
      '<button class="btn bd" id="soSelDelBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkDeleteSO()">🗑️ ลบที่เลือก (' + selCnt + ')</button>' +
      '<button class="btn bo bsm" style="margin-left:auto" onclick="toggleSOSelectMode()">✕ ออก</button>' +
      '</div>';
  }

  el.innerHTML = html;
}

function toggleSOSelectMode() {
  soSelectMode = !soSelectMode;
  soSelected = {};
  render();
}

function toggleSOSelect(id) {
  if (soSelected[id]) delete soSelected[id];
  else soSelected[id] = true;
  var cb = document.getElementById('soChk_' + id);
  if (cb) cb.checked = !!soSelected[id];
  var cnt = Object.keys(soSelected).length;
  _soSelBarUpdate(cnt);
  var allCb = document.getElementById('soSelAll');
  if (allCb) allCb.checked = cnt === _soVisibleIds.length && cnt > 0;
}

function toggleSOSelectAll(selectAll) {
  soSelected = {};
  if (selectAll) _soVisibleIds.forEach(function(id) { soSelected[id] = true; });
  _soVisibleIds.forEach(function(id) {
    var cb = document.getElementById('soChk_' + id);
    if (cb) cb.checked = !!soSelected[id];
  });
  _soSelBarUpdate(Object.keys(soSelected).length);
}

function _soSelBarUpdate(cnt) {
  var countEl = document.getElementById('soSelCount');
  if (countEl) countEl.textContent = cnt + ' รายการที่เลือก';
  var delBtn = document.getElementById('soSelDelBtn');
  if (delBtn) { delBtn.disabled = !cnt; delBtn.textContent = '🗑️ ลบที่เลือก (' + cnt + ')'; }
  var exportBtn = document.getElementById('soSelExportBtn');
  if (exportBtn) exportBtn.disabled = !cnt;
  var statusSel = document.getElementById('soSelStatusSel');
  if (statusSel) statusSel.disabled = !cnt;
  var statusBtn = document.getElementById('soSelStatusBtn');
  if (statusBtn) statusBtn.disabled = !cnt;
}
// เปลี่ยนสถานะทีเดียวหลายรายการ — pattern เดียวกับ bulkChangePipeStatus ใน views-pipeline.js (เจอจากการสแกน
// UX 2026-08-23 ว่า SO/Quotation มีแค่ "ลบ" อย่างเดียว ต่างจาก Pipeline ที่มีครบ) ไม่ผ่าน saveSOStatus()
// เดิม (ที่ผูกกับ UI เดี่ยว มี log/readiness check ประกอบ) เพราะ bulk ตรงนี้ตั้งใจให้ override ตรงๆ ได้ทุกสถานะ
// ไม่บังคับตามลำดับ _SO_NEXT เหมือนหน้าแก้ทีละใบ — เหมาะกับกรณีแก้ข้อมูลผิดหลายใบพร้อมกันมากกว่า
function bulkChangeSOStatus() {
  var sel = document.getElementById('soSelStatusSel');
  var statusId = sel ? sel.value : '';
  if (!statusId) { toast('⚠️ เลือกสถานะก่อน'); return; }
  var ids = Object.keys(soSelected);
  if (!ids.length) return;
  var statusObj = SO_STATUS[statusId];
  if (!confirm('เปลี่ยนสถานะ ' + ids.length + ' รายการ เป็น "' + (statusObj ? statusObj.label : statusId) + '"?')) return;
  ids.forEach(function(id) {
    var saved = ST.update('salesOrders', id, { status: statusId });
    if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', saved);
  });
  toast('✏️ เปลี่ยนสถานะแล้ว ' + ids.length + ' รายการ');
  render();
}
function bulkExportSO() {
  var ids = Object.keys(soSelected);
  if (!ids.length) return;
  var list = ids.map(function(id) { return ST.getOne('salesOrders', id); }).filter(Boolean);
  var headers = ['SO No.', 'Dealer', 'สถานะ', 'สินค้า', 'มูลค่า', 'PO', 'Invoice', 'สร้างเมื่อ'];
  var rows = [headers].concat(list.map(function(s) {
    var total = (s.items || []).reduce(function(sum, it) { return sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);
    var models = (s.items || []).map(function(it) { return it.model; }).filter(Boolean).join(', ');
    return [s.soNumber || '', s.dealerName || '', (SO_STATUS[s.status] || {}).label || s.status || '', models, total, s.customerPO || '', s.invoiceNumber || '', s.createdAt ? s.createdAt.slice(0, 10) : ''];
  }));
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Orders');
  XLSX.writeFile(wb, 'so-selected-' + _td() + '.xlsx');
  toast('📥 Export ' + list.length + ' รายการที่เลือก');
}

function bulkDeleteSO() {
  var ids = Object.keys(soSelected);
  if (!ids.length) return;
  if (!confirm('ลบ ' + ids.length + ' Sales Order ที่เลือก?\nไม่สามารถกู้คืนได้')) return;
  ids.forEach(function(id) {
    ST.delete('salesOrders', id);
    if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('salesOrders', id);
  });
  soSelected = {};
  soSelectMode = false;
  toast('🗑️ ลบแล้ว ' + ids.length + ' รายการ');
  render();
}

// ---------------------------------------------------------------- detail

function rSODetail(el) {
  var soId = S.soId;
  var s    = ST.getOne('salesOrders', soId);
  if (!s) { el.innerHTML = '<div class="card">ไม่พบ SO นี้</div>'; return; }
  document.getElementById('pgT').textContent = '📦 ' + (s.soNumber||'SO');

  var pipe   = s.pipelineId   ? ST.getOne('pipeline', s.pipelineId)     : null;
  var dealer = s.dealerId     ? ST.getOne('dealers',  s.dealerId)        : null;
  var total  = (s.items||[]).reduce(function(sum,it){ return sum+(Number(it.qty)||0)*(Number(it.unitPrice)||0); },0);
  var nexts  = _SO_NEXT[s.status] || [];
  var cfg    = getConfig();

  var html = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '<button class="btn bo bsm" onclick="go(\'salesOrders\')" style="margin-bottom:10px">← กลับ</button>';
  html += (typeof _sourceTaskBackLinkHtml === 'function') ? _sourceTaskBackLinkHtml(s.sourceTaskId) : '';

  // ---- header card
  html += '<div class="card" style="margin-bottom:12px;padding:18px">';
  html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:4px">';
  html += '<div>';
  html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">';
  html += '<h2 style="margin:0;font-size:19px">' + qcopyHtml(s.soNumber||'-') + '</h2>';
  html += '<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:var(--bg2);color:var(--text2)">' + (s.type==='project'?'📋 Project':'🏪 Run rate') + '</span>';
  html += _soStatusBadge(s.status);
  html += '</div>';
  if (!_gvHidden('so_dealerInfo')) html += '<div style="font-size:13px;color:var(--text2)">🏪 ' + sanitize(dealer ? dealer.name : (s.dealerName||'-')) + '</div>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  html += '<button class="btn bo bsm" onclick="showSOEditModal(\'' + s.id + '\')">✏️ แก้ไข</button>';
  if (nexts.length) html += '<button class="btn bp bsm" onclick="showSOStatusModal(\'' + s.id + '\')">🔄 อัปเดตสถานะ</button>';
  html += '<button class="btn bd bsm" onclick="deleteSalesOrder(\'' + s.id + '\')" title="ลบ SO">🗑️</button>';
  html += '</div></div>';

  // ความพร้อมส่ง — คำนวณสดจากสต็อกจริงต่อรายการ ไม่ใช่สถานะที่ตั้งเอง (สินค้าบางชิ้นต้อง QI บางชิ้นไม่ต้อง คนละคลังกันได้)
  if (s.status === 'so_open') {
    var readiness = soComputeReadiness(s);
    if (readiness.total) {
      var pct = Math.round(readiness.readyCount / readiness.total * 100);
      html += '<div class="card" style="margin-bottom:12px;padding:14px">';
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
      html += '<div style="flex:1;height:8px;background:var(--bg2);border-radius:999px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + (readiness.allReady ? '#22c55e' : '#f59e0b') + '"></div></div>';
      html += '<span style="font-size:12px;font-weight:600;color:' + (readiness.allReady ? '#22c55e' : '#f59e0b') + ';white-space:nowrap">' + readiness.readyCount + '/' + readiness.total + ' พร้อมส่ง</span>';
      html += '</div>';
      if (readiness.allReady) {
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:8px 10px">';
        html += '<span style="font-size:12px;color:#22c55e">✅ พร้อมส่งครบทุกรายการแล้ว</span>';
        html += '<button class="btn bp bsm" onclick="showSOStatusModal(\'' + s.id + '\')">เปลี่ยนสถานะเป็นส่งแล้ว →</button>';
        html += '</div>';
      } else {
        html += '<div style="font-size:11px;color:var(--text2)">รอ: ' + readiness.items.filter(function(x) { return !x.ready; }).map(function(x) { return sanitize(x.model || '-'); }).join(' · ') + '</div>';
      }
      html += '</div>';
    }
  }

  // info grid — เฉพาะช่องที่มีข้อมูล
  var _soDays = _soDaysInStage(s);
  var infoCells = [];
  if (s.customerPO && !_gvHidden('so_dealerInfo')) infoCells.push({ label:'PO ลูกค้า',    val: qcopyHtml(s.customerPO) });
  if (s.prNumber)         infoCells.push({ label:'PR ภายใน',      val: qcopyHtml(s.prNumber) });
  if (pipe)               infoCells.push({ label:'Pipeline',      val: '<a href="#" onclick="go(\'pipeDetail\',{pipeId:\'' + s.pipelineId + '\'});return false" style="color:var(--accent)">' + sanitize((pipe.projectName||s.pipelineId).substr(0,26)) + '</a>' });
  if (s.quotationId)      infoCells.push({ label:'Quotation',     val: '<span style="color:var(--accent)">' + sanitize(s.quotationId) + '</span>' });
  if (s.invoiceNumber)    infoCells.push({ label:'Invoice',       val: qcopyHtml(s.invoiceNumber) + (s.invoiceDate ? ' <span style="color:var(--text2);font-size:11px">(' + fD(s.invoiceDate) + ')</span>' : '') });
  if (s.expectedDelivery) infoCells.push({ label:'ETA Vendor',    val: fD(s.expectedDelivery) });
  if (!_soIsDone(s.status) && _soDays != null) infoCells.push({ label:'อยู่ในขั้นนี้',   val: _soDays + ' วัน' });
  if (s.dueDate)          infoCells.push({ label:'ต้องติดตามภายใน', val: '<b>' + fD(s.dueDate) + '</b>' });

  if (infoCells.length) {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;padding-top:14px;margin-top:10px;border-top:1px solid var(--border)">';
    infoCells.forEach(function(c){
      html += '<div><div style="font-size:11px;color:var(--text2);margin-bottom:3px">' + c.label + '</div><div style="font-size:13px">' + c.val + '</div></div>';
    });
    html += '</div>';
  }
  var _soWarn = _soWarnBadge(s);
  if (_soWarn) html += '<div style="margin-top:10px">' + _soWarn + '</div>';

  // progress bar พร้อม label ใต้แต่ละขั้น
  html += '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">';
  html += _soProgressBar(s.status);
  html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text2);margin-top:4px">';
  _SO_STAGES.forEach(function(st){ html += '<span>' + st.label + '</span>'; });
  html += '</div></div>';

  if (s.attachments && s.attachments.length) html += '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">' + attachGalleryHtml(s.attachments) + '</div>';
  html += '</div>';

  // items card
  html += '<div class="card" style="margin-bottom:12px;padding:18px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:6px">';
  html += '<h3 style="margin:0;font-size:15px">📦 รายการสินค้า</h3>';
  html += '<span class="ml">';
  if (!_soIsDone(s.status)) html += '<button class="btn bo bsm" onclick="showSOEditItemsModal(\'' + s.id + '\')" title="แก้ไข/เพิ่ม/ลบรายการสินค้า">✏️ แก้ไขรายการ</button>';
  html += '<button class="btn bo bsm" onclick="showSOEditSerialsModal(\'' + s.id + '\')" title="แก้ไข Serial ได้ทุกเมื่อ ไม่ต้องรอเปลี่ยนสถานะ">🔢 แก้ไข Serial</button>';
  html += '</span>';
  html += '</div>';
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<thead><tr style="background:var(--bg2);text-align:left">' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">#</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">สินค้า</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2);text-align:center">จำนวน</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2);text-align:right">ราคา/หน่วย</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2);text-align:right">รวม</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">Serial</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">ความพร้อมส่ง</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">คอมเมนต์</th></tr></thead><tbody>';
  (s.items||[]).forEach(function(it,idx){
    var lineTotal = (Number(it.qty)||0)*(Number(it.unitPrice)||0);
    var sns = _soItemSerials(it);
    var _esc = function(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); };
    html += '<tr style="border-top:1px solid var(--border)">';
    html += '<td style="padding:10px">' + (idx+1) + '</td>';
    html += '<td style="padding:10px"><b>' + sanitize(it.model||'-') + '</b></td>';
    html += '<td style="padding:10px;text-align:center">' + (it.qty||0) + '</td>';
    html += '<td style="padding:10px;text-align:right">' + (_gvHidden('so_price') ? '-' : fmtMoney(Number(it.unitPrice)||0)) + '</td>';
    html += '<td style="padding:10px;text-align:right">' + (_gvHidden('so_price') ? '-' : fmtMoney(lineTotal)) + '</td>';
    html += '<td style="padding:10px;font-size:10px">' + (sns.length ? sns.map(function(sn){ return '<span style="display:inline-block;background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:0 4px;margin:1px;font-family:monospace">'+qcopyHtml(sn)+'</span>'; }).join('') + (sns.length>1?' <button class="qcopy-btn" style="opacity:.6;position:static" title="คัดลอกทั้งหมด" onclick="copyToClip(\''+_esc(sns.join(', '))+'\')">📋all</button>':'') : '<span style="color:var(--text2)">-</span>') + '</td>';
    html += '<td style="padding:10px;min-width:150px">' + (typeof stockSOItemReadinessHtml === 'function' ? stockSOItemReadinessHtml(it.sku, it.qty, s) : '') + '</td>';
    html += '<td style="padding:10px;min-width:140px"><input type="text" value="' + sanitize(it.comment || '') + '" placeholder="พิมพ์โน้ต..." style="width:100%;font-size:11px" onblur="saveSOItemComment(\'' + s.id + '\',' + idx + ',this.value)"></td>';
    html += '</tr>';
  });
  html += '<tr style="font-weight:600;background:var(--bg2);border-top:1px solid var(--border)"><td colspan="4" style="padding:10px;text-align:right">รวมทั้งสิ้น</td>';
  html += '<td style="padding:10px;text-align:right">' + (_gvHidden('so_price') ? '-' : fmtMoney(total)) + '</td><td colspan="3"></td></tr>';
  html += '</tbody></table></div></div>';

  // timeline — กดรายการเพื่อขยายดูรายละเอียด/แก้ไขในหน้าเดียวกัน (ไม่ใช้ modal)
  html += '<div class="card" style="padding:18px">';
  html += '<h3 style="margin:0 0 12px;font-size:15px">📋 Timeline <span style="font-size:11px;font-weight:400;color:var(--text2)">(กดรายการเพื่อดู/แก้ไข)</span></h3>';
  var rawLogs = s.logs || [];
  var logsRev = rawLogs.map(function(lg, idx){ return { lg: lg, idx: idx }; }).slice().reverse();
  if (!logsRev.length) {
    html += '<div style="color:var(--text2);font-size:12px">ยังไม่มี log</div>';
  } else {
    logsRev.forEach(function(entry, i){
      var lg = entry.lg, originalIdx = entry.idx;
      var isFirst = i === 0;
      var isExpanded = _soTimelineExpandedIdx === originalIdx;
      html += '<div style="display:flex;gap:10px;margin-bottom:12px;position:relative">';
      if (i < logsRev.length - 1)
        html += '<div style="position:absolute;left:9px;top:20px;width:1px;bottom:-4px;background:var(--border)"></div>';
      var dotC = isFirst ? 'var(--accent)' : 'var(--bg2)';
      html += '<div style="width:20px;height:20px;border-radius:50%;background:' + dotC + ';border:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:' + (isFirst?'#fff':'var(--text2)') + '">' + (isFirst?'●':'○') + '</div>';
      html += '<div style="flex:1;padding-top:1px">';
      html += '<div style="cursor:pointer" onclick="toggleSOTimelineItem(\'' + s.id + '\',' + originalIdx + ')">';
      html += '<div style="font-size:12px;font-weight:500;display:flex;align-items:center;gap:6px">' + sanitize(lg.action||'') + '<span style="font-size:9px;color:var(--text2)">' + (isExpanded?'▲':'▼') + '</span></div>';
      html += '<div style="font-size:11px;color:var(--text2)">' + (lg.date ? fD(lg.date) : '') + (lg.by ? ' · ' + sanitize(lg.by) : '') + '</div>';
      if (!isExpanded && lg.note) html += '<div style="font-size:11px;margin-top:3px;padding:4px 8px;background:var(--bg2);border-left:2px solid var(--accent);border-radius:0 4px 4px 0">' + sanitize(lg.note) + '</div>';
      if (!isExpanded && lg.serials && lg.serials.length) {
        html += '<div style="margin-top:4px;font-size:10px">' + lg.serials.map(function(sn){
          return '<span style="display:inline-block;background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:0 4px;font-family:monospace;margin:1px">' + sanitize(sn) + '</span>';
        }).join('') + '</div>';
      }
      html += '</div>';

      if (isExpanded) {
        html += '<div style="margin-top:8px;padding:12px;background:var(--bg2);border-radius:8px;border:1px solid var(--border)">';
        html += '<div class="fg"><label class="lbl">การกระทำ</label><input id="soTlAction" class="inp" value="' + sanitize(lg.action||'') + '"></div>';
        html += '<div class="fg"><label class="lbl">วันที่</label><input id="soTlDate" class="inp" type="date" value="' + (lg.date ? String(lg.date).split('T')[0] : '') + '"></div>';
        html += '<div class="fg"><label class="lbl">หมายเหตุ</label><textarea id="soTlNote" class="inp" rows="2" placeholder="หมายเหตุ...">' + sanitize(lg.note||'') + '</textarea></div>';
        if (lg.serials && lg.serials.length) {
          html += '<div class="fg"><label class="lbl">Serial</label><div>' + lg.serials.map(function(sn){
            return '<span style="display:inline-block;background:var(--card);border:1px solid var(--border);border-radius:3px;padding:0 4px;font-family:monospace;margin:1px;font-size:10px">' + sanitize(sn) + '</span>';
          }).join('') + '</div></div>';
        }
        html += '<div style="display:flex;gap:6px;margin-top:8px">';
        html += '<button class="btn bp bsm" onclick="saveSOTimelineEntry(\'' + s.id + '\',' + originalIdx + ')">💾 บันทึก</button>';
        html += '<button class="btn bd bsm" onclick="deleteSOTimelineEntry(\'' + s.id + '\',' + originalIdx + ')">🗑️ ลบรายการนี้</button>';
        html += '<button class="btn bo bsm" onclick="toggleSOTimelineItem(\'' + s.id + '\',' + originalIdx + ')">ยกเลิก</button>';
        html += '</div></div>';
      }
      html += '</div></div>';
    });
  }
  html += '</div>';

  el.innerHTML = html;
}

// ---------------------------------------------------------------- create SO

function showCreateSOModal(opts) {
  opts = opts || {};
  var pipe    = opts.pipelineId ? ST.getOne('pipeline', opts.pipelineId) : null;
  var dealers = ST.getAll('dealers');
  // won projects + project ที่ผูกกับใบเสนอราคา/ที่ส่งมา (แม้ยังไม่ถึงสถานะ won) จะได้ preselect ได้
  var wonPipes = ST.getAll('pipeline').filter(function(p){
    return pipeIsWon(p) || p.id === opts.pipelineId;
  }).sort(function(a,b){ return (a.projectName||'') > (b.projectName||'') ? 1 : -1; });

  var preDealerId = (pipe && pipe.dealerId) || opts.dealerId || '';
  var dealerOpts = '<option value="">-- เลือก Dealer --</option>';
  dealers.forEach(function(d){
    var sel = (preDealerId === d.id) ? ' selected' : '';
    dealerOpts += '<option value="' + d.id + '"' + sel + '>' + sanitize(d.name) + '</option>';
  });

  var pipeOpts = '<option value="">-- ไม่ระบุ / เลือกทีหลัง --</option>';
  wonPipes.filter(function(p){ return !preDealerId || p.dealerId === preDealerId; }).forEach(function(p){
    var d = ST.getOne('dealers', p.dealerId);
    var sel = (opts.pipelineId === p.id) ? ' selected' : '';
    pipeOpts += '<option value="' + p.id + '"' + sel + '>' +
      sanitize((p.projectName||'').substr(0,40)) +
      (d ? ' [' + sanitize(d.name) + ']' : '') +
      '</option>';
  });

  var initType = opts.pipelineId ? 'project' : 'runrate';

  var html = '<div style="display:flex;flex-direction:column;gap:10px">';
  html += (typeof _pendingLinkGuidelineHtml === 'function') ? _pendingLinkGuidelineHtml() : '';

  // SO number + type
  html += '<div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">SO Number</label><input id="soN_soNumber" class="inp" value="' + _soNextNum('SO') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">ประเภท</label><select id="soN_type" class="inp" onchange="_soTypeToggle(this.value)">' +
    '<option value="project"' + (initType==='project'?' selected':'') + '>📋 Project</option>' +
    '<option value="runrate"' + (initType==='runrate'?' selected':'') + '>🏪 Run rate</option>' +
    '</select></div>';
  html += '</div>';

  // Dealer ก่อน — เลือกแล้วกรอง project ให้เฉพาะของ dealer นั้น
  html += '<div><label class="lbl">Dealer *</label><select id="soN_dealerId" class="inp" onchange="_soFilterProjectsByDealer(this.value)">' + dealerOpts + '</select></div>';

  // project picker (แสดงเมื่อ type=project) — กรองตาม dealer
  html += '<div id="soN_pipeSec"' + (initType!=='project'?' style="display:none"':'') + '>';
  html += '<label class="lbl">Pipeline Project <span style="font-size:10px;color:var(--text2)">(เฉพาะ Win / Contracting / Deliver)</span></label>';
  html += '<select id="soN_pipelineId" class="inp" onchange="_soFillFromPipe(this.value)">' + pipeOpts + '</select>';
  html += '</div>';

  // ใบเสนอราคา — กรองตาม dealer/project ที่เลือก เลือกแล้วดึงรายการสินค้ามาเติมให้ ไม่เลือกก็สร้าง SO ตรงได้ (จะสร้างใบเสนอราคาใหม่ให้อัตโนมัติตอนบันทึก)
  html += '<div><label class="lbl">ใบเสนอราคา <span style="font-size:10px;color:var(--text2)">(เลือกเพื่อดึงรายการมา หรือไม่เลือกก็สร้าง SO ตรงได้)</span></label>';
  html += '<select id="soN_quoteSel" class="inp" onchange="_soFillFromQuote(this.value)">' + _soQuotationOptionsHtml(preDealerId, opts.pipelineId) + '</select></div>';
  html += '<input type="hidden" id="soN_quotationId" value="' + sanitize(opts.quotationId||'') + '">';

  html += '<div><label class="lbl">เลข PO ลูกค้า</label><input id="soN_customerPO" class="inp" value="' + sanitize(opts.customerPO||'') + '" placeholder="เช่น PO-ABC-2026-001"></div>';

  // items
  html += buildAdminModelDatalist('soItemModelDL');
  html += '<div><label class="lbl">รายการสินค้า *</label><div id="soN_items">';
  var initItems = (opts.presetItems && opts.presetItems.length) ? opts.presetItems
    : (pipe && pipe.model
      ? [{ model: pipe.model, qty: 1, unitPrice: Number(pipe.forecastAmount)||0 }]
      : [{ model: '', qty: 1, unitPrice: 0 }]);
  initItems.forEach(function(it, idx){ html += _soItemRowHtml(idx, it.model, it.qty, it.unitPrice, it.sku); });
  html += '</div><button class="btn bo bsm" onclick="_soAddItemRow()" style="margin-top:4px">+ เพิ่มสินค้า</button></div>';

  html += '<div><label class="lbl">หมายเหตุ</label><textarea id="soN_note" class="inp" rows="2" placeholder="หมายเหตุเพิ่มเติม..."></textarea></div>';
  html += '<button class="btn bp" onclick="saveCreateSO()">💾 สร้าง SO</button></div>';

  openM('➕ สร้าง Sales Order', html);
  // ถ้ามาจาก "สร้าง SO จากใบเสนอราคา" อยู่แล้ว รายการเริ่มต้น = รายการของใบเสนอราคานั้น เก็บไว้เทียบตอนบันทึกว่าแก้ไปไหม
  window._soQuoteItemsSnapshot = opts.quotationId ? JSON.stringify(initItems) : null;
}

// รายชื่อใบเสนอราคาที่ตรงกับ dealer/project ที่เลือกในฟอร์มสร้าง SO — มี pipelineId ก็กรองด้วย pipeline ก่อน (แม่นกว่า) ไม่งั้นกรองแค่ dealer
function _soQuotationOptionsHtml(dealerId, pipelineId) {
  var all = [];
  try { all = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch (e) {}
  var matches = all.filter(function(q) {
    if (pipelineId) return q.pipelineId === pipelineId;
    return dealerId && q.dealerId === dealerId;
  }).sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  var h = '<option value="">-- ไม่ระบุ / สร้าง SO ตรง --</option>';
  matches.forEach(function(q) {
    h += '<option value="' + q.id + '">' + sanitize(q.quoteNo) + ' · ' + (q.items || []).length + ' รายการ · ฿' + fmtMoney(q.totalAmount || 0) + '</option>';
  });
  return h;
}

function _soFillFromQuote(quoteId) {
  var hidden = document.getElementById('soN_quotationId');
  if (hidden) hidden.value = quoteId || '';
  window._soQuoteItemsSnapshot = null;
  if (!quoteId) return;
  var all = [];
  try { all = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch (e) {}
  var q = all.filter(function(x) { return x.id === quoteId; })[0];
  if (!q) return;
  var wrap = document.getElementById('soN_items');
  if (!wrap) return;
  wrap.innerHTML = '';
  _soIC = 0;
  var items = (q.items && q.items.length) ? q.items.map(function(it) {
    return { model: it.name || it.model || '', qty: Number(it.quantity || it.qty) || 1, unitPrice: Number(it.unitPrice) || 0, sku: it.sku || '' };
  }) : [{ model: '', qty: 1, unitPrice: 0 }];
  items.forEach(function(it, idx) { wrap.innerHTML += _soItemRowHtml(idx, it.model, it.qty, it.unitPrice, it.sku); });
  window._soQuoteItemsSnapshot = JSON.stringify(items);
  var poEl = document.getElementById('soN_customerPO');
  if (poEl && !poEl.value && q.poNo) poEl.value = q.poNo;
}

// เทียบแบบ normalize เฉพาะฟิลด์ที่มีความหมาย (ไม่ใช่ JSON.stringify ตรงๆ) กัน false positive จาก field เกิน/ลำดับต่าง
function _soItemsChangedFromQuote(currentItems) {
  if (!window._soQuoteItemsSnapshot) return false;
  var snap;
  try { snap = JSON.parse(window._soQuoteItemsSnapshot); } catch (e) { return false; }
  if (snap.length !== currentItems.length) return true;
  for (var i = 0; i < snap.length; i++) {
    var a = snap[i], b = currentItems[i];
    if ((a.model || '') !== (b.model || '') || Number(a.qty) !== Number(b.qty) ||
        Number(a.unitPrice) !== Number(b.unitPrice) || (a.sku || '') !== (b.sku || '')) return true;
  }
  return false;
}

// เหมือน _soItemsChangedFromQuote แต่เทียบกับ quote.items ตรงๆ (ฟิลด์ name/quantity แทน model/qty) — ใช้ตอนแก้ไข SO ที่มีอยู่แล้ว
// ไม่มี snapshot ตอนเปิดฟอร์มให้เทียบ (ต่างจากตอนสร้างใหม่) เลยเทียบกับใบเสนอราคาที่ผูกไว้ตรงๆ แทน
function _soItemsDifferFromQuoteItems(currentItems, quoteItems) {
  quoteItems = quoteItems || [];
  if (currentItems.length !== quoteItems.length) return true;
  for (var i = 0; i < currentItems.length; i++) {
    var a = currentItems[i], b = quoteItems[i];
    if ((a.model || '') !== (b.name || b.model || '') || Number(a.qty) !== Number(b.quantity || b.qty) ||
        Number(a.unitPrice) !== Number(b.unitPrice) || (a.sku || '') !== (b.sku || '')) return true;
  }
  return false;
}

function _soNextQuoteNo() {
  var all = [];
  try { all = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch (e) {}
  var today = new Date();
  var prefix = 'QT-' + today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0') + '-';
  var maxSeq = 0;
  all.forEach(function(q) {
    if (q.quoteNo && q.quoteNo.startsWith(prefix)) {
      var seq = parseInt(q.quoteNo.split('-').pop()) || 0;
      if (seq > maxSeq) maxSeq = seq;
    }
  });
  return prefix + String(maxSeq + 1).padStart(3, '0');
}

// สร้างใบเสนอราคาใหม่ให้อัตโนมัติตอนสร้าง SO โดยไม่ได้เลือกใบเสนอราคาไว้ — ทุก SO จะมีใบเสนอราคาผูกอยู่เสมอ
function _soAutoCreateQuotation(fields, items) {
  var all = [];
  try { all = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch (e) {}
  var quoteItems = items.map(function(it) {
    return { name: it.model, sku: it.sku || '', quantity: it.qty, unitPrice: it.unitPrice, amount: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) };
  });
  var gross = quoteItems.reduce(function(s, it) { return s + (Number(it.amount) || 0); }, 0);
  var vat = gross * 7 / 100;
  var cfg = getConfig();
  var newQuote = {
    id: 'qt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    quoteNo: _soNextQuoteNo(), dealerId: fields.dealerId || '', dealerName: fields.dealerName || '',
    dealerLevel: 'B', levelUsed: 'B', createdAt: new Date().toISOString(),
    validFrom: _td(), validTo: addD(_td(), 30), paymentTerm: '', quotedBy: cfg.saleName || '',
    poNo: fields.poNo || '', items: quoteItems, grossTotal: gross, discountPercent: 0, discountAmount: 0,
    netAmount: gross, vatPercent: 7, vatAmount: vat, totalAmount: gross + vat, remark: 'สร้างอัตโนมัติจาก SO',
    contacts: [], status: 'approved', sentDate: null, approvedDate: null, updatedAt: new Date().toISOString(),
    pipelineId: fields.pipelineId || '', projectName: fields.projectName || '', sourceTaskId: ''
  };
  all.push(newQuote);
  localStorage.setItem('v7_quotations_v2', JSON.stringify(all));
  if (typeof quotations !== 'undefined') quotations = all;
  return newQuote;
}

function _soTypeToggle(type) {
  var sec = document.getElementById('soN_pipeSec');
  if (sec) sec.style.display = type === 'project' ? '' : 'none';
  if (type !== 'project') {
    var sel = document.getElementById('soN_pipelineId');
    if (sel) sel.value = '';
  }
}

function _soFillFromPipe(pipeId) {
  if (!pipeId) return;
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;

  // fill dealer
  var dSel = document.getElementById('soN_dealerId');
  if (dSel && p.dealerId) dSel.value = p.dealerId;

  // fill items
  var wrap = document.getElementById('soN_items');
  if (!wrap) return;
  wrap.innerHTML = '';
  _soIC = 0;
  var items = [];
  if (p.items && p.items.length) {
    p.items.forEach(function(it){ items.push({ model: it.model||'', qty: Number(it.qty)||1, unitPrice: 0 }); });
  } else if (p.model) {
    items.push({ model: p.model, qty: Number(p.modelQty)||1, unitPrice: 0 });
  } else {
    items.push({ model: '', qty: 1, unitPrice: 0 });
  }
  items.forEach(function(it, idx){ wrap.innerHTML += _soItemRowHtml(idx, it.model, it.qty, it.unitPrice, it.sku); });

  // เปลี่ยนโครงการแล้ว ใบเสนอราคาที่เคยเลือกไว้ (ถ้ามี) ไม่เกี่ยวข้องแล้ว รีเฟรชตัวเลือกกรองตาม pipeline นี้แทน
  var quoteSel = document.getElementById('soN_quoteSel');
  var quoteHidden = document.getElementById('soN_quotationId');
  if (quoteSel) quoteSel.innerHTML = _soQuotationOptionsHtml(dSel ? dSel.value : '', pipeId);
  if (quoteHidden) quoteHidden.value = '';
  window._soQuoteItemsSnapshot = null;
}

function _soItemRowHtml(idx, model, qty, price, sku) {
  return '<div style="display:flex;gap:6px;margin-bottom:4px;align-items:center" id="soIR_' + idx + '">' +
    '<input type="hidden" id="soI_sku_' + idx + '" value="' + sanitize(sku || '') + '">' +
    '<input class="inp" style="flex:2" placeholder="Model / สินค้า" value="' + sanitize(model||'') + '" id="soI_m_' + idx + '" list="soItemModelDL" autocomplete="off" onchange="_soItemModelChanged(\'' + idx + '\')">' +
    '<input class="inp" type="number" style="width:58px" placeholder="จำนวน" value="' + (qty||1) + '" id="soI_q_' + idx + '" min="1">' +
    '<input class="inp js-money" type="text" inputmode="decimal" style="width:95px" placeholder="ราคา/หน่วย" value="' + (price ? nmI(price) : '') + '" id="soI_p_' + idx + '">' +
    '<button class="btn bd bsm" onclick="this.parentElement.remove()">✕</button></div>';
}

// พิมพ์ตรงชื่อ/SKU ในแคตตาล็อก (buildAdminModelDatalist) → เติม SKU + ราคา RRP ให้อัตโนมัติถ้าช่องราคายังว่าง
function _soItemModelChanged(idx) {
  var mEl = document.getElementById('soI_m_' + idx);
  var pEl = document.getElementById('soI_p_' + idx);
  var skuEl = document.getElementById('soI_sku_' + idx);
  if (!mEl) return;
  var prod = (typeof _pipeResolveProduct === 'function') ? _pipeResolveProduct(mEl.value.trim()) : null;
  if (prod) {
    mEl.value = prod.name;
    if (skuEl) skuEl.value = prod.sku || '';
    if (pEl && !pEl.value) {
      var price = Number(prod.rrpExVat) || Number(prod.price) || 0;
      if (price > 0) pEl.value = nmI(price);
    }
  } else if (skuEl) {
    skuEl.value = '';
  }
}

var _soIC = 0;
function _soAddItemRow() {
  var wrap = document.getElementById('soN_items');
  if (!wrap) return;
  var id = 'n' + (++_soIC);
  var d = document.createElement('div');
  d.innerHTML = _soItemRowHtml(id, '', 1, 0, '');
  wrap.appendChild(d.firstChild);
}

function saveCreateSO() {
  var soNumber    = (document.getElementById('soN_soNumber')  ||{}).value || _soNextNum('SO');
  var type        = (document.getElementById('soN_type')       ||{}).value || 'runrate';
  var dealerId    = (document.getElementById('soN_dealerId')   ||{}).value || '';
  var customerPO  = (document.getElementById('soN_customerPO') ||{}).value || '';
  var pipelineId  = (document.getElementById('soN_pipelineId') ||{}).value || '';
  var quotationId = (document.getElementById('soN_quotationId')||{}).value || '';
  var note        = (document.getElementById('soN_note')       ||{}).value || '';

  if (!dealerId) { alert('กรุณาเลือก Dealer'); return; }

  var items = [];
  document.querySelectorAll('#soN_items > div[id^="soIR_"]').forEach(function(row){
    var mEl = row.querySelector('[id^="soI_m_"]');
    var qEl = row.querySelector('[id^="soI_q_"]');
    var pEl = row.querySelector('[id^="soI_p_"]');
    var skuEl = row.querySelector('[id^="soI_sku_"]');
    if (!mEl || !mEl.value.trim()) return;
    items.push({ model: mEl.value.trim(), sku: skuEl ? skuEl.value.trim() : '', qty: Number(qEl.value)||1, unitPrice: parseNum(pEl.value)||0, serials:[] });
  });
  if (!items.length) { alert('กรุณาใส่รายการสินค้าอย่างน้อย 1 รายการ'); return; }

  var dealer = ST.getOne('dealers', dealerId);
  var cfg    = getConfig();
  var now    = new Date().toISOString();

  // ผูกใบเสนอราคาให้ SO นี้เสมอ — ถ้าเลือกไว้แล้วรายการไม่ตรง ถามว่าจะแก้เป็น revision ไหม, ถ้าไม่ได้เลือกไว้เลยก็สร้างใหม่ให้อัตโนมัติ
  if (quotationId) {
    if (typeof _soItemsChangedFromQuote === 'function' && _soItemsChangedFromQuote(items) &&
        confirm('รายการสินค้าที่กรอกไม่ตรงกับใบเสนอราคาที่เลือกไว้\nต้องการบันทึกเป็นฉบับแก้ไข (revision) ของใบเสนอราคานั้นไหม?\n\nตกลง = สร้างฉบับแก้ไขใหม่ผูกกับ SO นี้\nยกเลิก = สร้าง SO โดยไม่แก้ใบเสนอราคาเดิม')) {
      if (typeof createQuoteRevision === 'function') {
        var revItems = items.map(function(it) { return { name: it.model, sku: it.sku, quantity: it.qty, unitPrice: it.unitPrice, amount: (Number(it.qty)||0)*(Number(it.unitPrice)||0) }; });
        var rev = createQuoteRevision(quotationId, { items: revItems });
        if (rev) { quotationId = rev.id; toast('🆕 สร้างฉบับแก้ไขใบเสนอราคา ' + rev.quoteNo); }
      }
    }
  } else if (typeof _soAutoCreateQuotation === 'function') {
    var pipe2 = pipelineId ? ST.getOne('pipeline', pipelineId) : null;
    var newQ = _soAutoCreateQuotation({ dealerId: dealerId, dealerName: dealer ? dealer.name : '', pipelineId: pipelineId, poNo: customerPO, projectName: pipe2 ? pipe2.projectName : '' }, items);
    if (newQ) quotationId = newQ.id;
  }

  var obj = {
    soNumber: soNumber, type: type, dealerId: dealerId, dealerName: dealer ? dealer.name : '',
    customerPO: customerPO, pipelineId: pipelineId, quotationId: quotationId,
    prNumber: '', poNumber: '', invoiceNumber: '', invoiceDate: '', expectedDelivery: '',
    status: 'po_received', items: items, saleName: cfg.saleName||'',
    logs: [{ date: _td(), action: '📄 สร้าง SO / ได้รับ PO', note: note||'', by: cfg.saleName||'' }],
    createdAt: now, updatedAt: now,
    sourceTaskId: (typeof _pendingLinkTaskId !== 'undefined' && _pendingLinkTaskId) || ''
  };

  var saved = ST.add('salesOrders', obj);
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', saved);
  if (typeof addAuditLog === 'function') addAuditLog('create_so', 'salesOrder', saved.id, soNumber, dealerId, obj.dealerName);
  if (typeof resolveTaskPendingLink === 'function') resolveTaskPendingLink('so', saved.id, saved.soNumber);
  closeMForce();
  toast('✅ สร้าง SO เรียบร้อย');
  go('soDetail', { soId: saved.id });
}

// แก้ไข/เพิ่ม/ลบรายการสินค้าของ SO ที่มีอยู่แล้ว (ก่อนหน้านี้แก้ได้แค่ตอนสร้างเท่านั้น)
// รียูสแถวรายการสินค้า+ปุ่มเพิ่มแถวจากฟอร์มสร้าง SO (id="soN_items" เดิม) เพราะ modal เปิดได้ทีละอัน ไม่ชนกัน
function showSOEditItemsModal(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var body = '<div class="hint" style="margin-bottom:8px">แก้ไข/เพิ่ม/ลบรายการสินค้าได้อิสระ — ถ้าไม่ตรงกับใบเสนอราคาที่ผูกไว้ ตอนบันทึกจะถามว่าจะแก้ใบเสนอราคาด้วยไหม</div>';
  body += buildAdminModelDatalist('soItemModelDL');
  body += '<div id="soN_items">';
  (s.items || []).forEach(function(it, idx) { body += _soItemRowHtml(idx, it.model, it.qty, it.unitPrice, it.sku); });
  body += '</div><button class="btn bo bsm" onclick="_soAddItemRow()" style="margin:8px 0">+ เพิ่มสินค้า</button>';
  body += '<button class="btn bp btn-full" style="margin-top:6px" onclick="saveSOItemsEdit(\'' + soId + '\')">💾 บันทึกรายการสินค้า</button>';
  openM('✏️ แก้ไขรายการสินค้า — ' + sanitize(s.soNumber || ''), body);
  _soIC = (s.items || []).length;
}

function saveSOItemsEdit(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var items = [];
  document.querySelectorAll('#soN_items > div[id^="soIR_"]').forEach(function(row) {
    var mEl = row.querySelector('[id^="soI_m_"]');
    var qEl = row.querySelector('[id^="soI_q_"]');
    var pEl = row.querySelector('[id^="soI_p_"]');
    var skuEl = row.querySelector('[id^="soI_sku_"]');
    if (!mEl || !mEl.value.trim()) return;
    items.push({ model: mEl.value.trim(), sku: skuEl ? skuEl.value.trim() : '', qty: Number(qEl.value) || 1, unitPrice: parseNum(pEl.value) || 0, serials: [] });
  });
  if (!items.length) { alert('กรุณาใส่รายการสินค้าอย่างน้อย 1 รายการ'); return; }

  var quotationId = s.quotationId;
  if (quotationId) {
    var allQuotes = [];
    try { allQuotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch (e) {}
    var quote = allQuotes.filter(function(q) { return q.id === quotationId; })[0];
    if (quote && _soItemsDifferFromQuoteItems(items, quote.items) &&
        confirm('รายการสินค้าที่แก้ไม่ตรงกับใบเสนอราคาที่ผูกไว้ (' + quote.quoteNo + ')\nต้องการบันทึกเป็นฉบับแก้ไข (revision) ของใบเสนอราคานั้นไหม?\n\nตกลง = สร้างฉบับแก้ไขใหม่ผูกกับ SO นี้\nยกเลิก = บันทึก SO โดยไม่แก้ใบเสนอราคาเดิม')) {
      if (typeof createQuoteRevision === 'function') {
        var revItems = items.map(function(it) { return { name: it.model, sku: it.sku, quantity: it.qty, unitPrice: it.unitPrice, amount: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) }; });
        var rev = createQuoteRevision(quotationId, { items: revItems });
        if (rev) { quotationId = rev.id; toast('🆕 สร้างฉบับแก้ไขใบเสนอราคา ' + rev.quoteNo); }
      }
    }
  }

  var cfg = getConfig();
  var logs = (s.logs || []).slice();
  logs.push({ date: _td(), action: '✏️ แก้ไขรายการสินค้า', note: '', by: cfg.saleName || '' });
  var updatedSO = ST.update('salesOrders', soId, { items: items, quotationId: quotationId, updatedAt: new Date().toISOString(), logs: logs });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
  closeMForce();
  toast('💾 บันทึกรายการสินค้าแล้ว');
  go('soDetail', { soId: soId });
}

function deleteSalesOrder(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  if (!confirm('ลบ ' + (s.soNumber||'SO นี้') + '?\nไม่สามารถกู้คืนได้')) return;
  ST.delete('salesOrders', soId);
  if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('salesOrders', soId);
  if (typeof addAuditLog === 'function') addAuditLog('delete_so', 'salesOrder', soId, s.soNumber, s.dealerId, s.dealerName);
  toast('🗑️ ลบ SO แล้ว');
  go('salesOrders');
}

// ---------------------------------------------------------------- timeline (ดู/แก้ไข/ลบ log ในหน้าเดียวกัน)

// re-render หน้า SO detail โดยไม่ scroll กลับบนสุด (ต่างจาก go() ที่ scrollTo(0,0) เสมอ)
function _soRerenderKeepScroll() {
  var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
  var ctEl = document.getElementById('ct');
  if (ctEl) rSODetail(ctEl);
  window.scrollTo(0, scrollY);
}

function toggleSOTimelineItem(soId, idx) {
  _soTimelineExpandedIdx = (_soTimelineExpandedIdx === idx) ? null : idx;
  _soRerenderKeepScroll();
}

function saveSOTimelineEntry(soId, idx) {
  var s = ST.getOne('salesOrders', soId);
  if (!s || !s.logs || !s.logs[idx]) return;
  var action = (document.getElementById('soTlAction')||{}).value || '';
  var date   = (document.getElementById('soTlDate')||{}).value || '';
  var note   = (document.getElementById('soTlNote')||{}).value || '';
  if (!action.trim()) { toast('⚠️ กรอกการกระทำก่อน'); return; }
  var logs = s.logs.slice();
  logs[idx] = Object.assign({}, logs[idx], { action: action.trim(), date: date || logs[idx].date, note: note.trim() });
  var updatedSO = ST.update('salesOrders', soId, { logs: logs, updatedAt: new Date().toISOString() });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
  _soTimelineExpandedIdx = null;
  toast('💾 บันทึกแล้ว');
  _soRerenderKeepScroll();
}

function deleteSOTimelineEntry(soId, idx) {
  var s = ST.getOne('salesOrders', soId);
  if (!s || !s.logs || !s.logs[idx]) return;
  if (!confirm('ลบรายการ Timeline นี้?\nไม่สามารถกู้คืนได้')) return;
  var logs = s.logs.slice();
  logs.splice(idx, 1);
  var updatedSO = ST.update('salesOrders', soId, { logs: logs, updatedAt: new Date().toISOString() });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
  _soTimelineExpandedIdx = null;
  toast('🗑️ ลบรายการแล้ว');
  _soRerenderKeepScroll();
}

// ---------------------------------------------------------------- status update

function showSOStatusModal(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var nexts = _SO_NEXT[s.status] || [];
  if (!nexts.length) { toast('SO นี้ปิดแล้ว ไม่มีสถานะถัดไป'); return; }

  var html = '<div style="display:flex;flex-direction:column;gap:10px">';
  html += '<div style="font-size:12px;color:var(--text2)">สถานะปัจจุบัน: ' + _soStatusBadge(s.status) + '</div>';

  // เตือนถ้ายังมีสินค้าไม่พร้อมส่ง — ไม่บล็อก แค่เตือนก่อนกดยืนยันเปลี่ยนเป็น "ส่งแล้ว" (มี confirm ซ้ำอีกชั้นตอนบันทึกจริง)
  if (s.status === 'so_open') {
    var readiness = soComputeReadiness(s);
    if (!readiness.allReady) {
      html += '<div class="warn-box" style="font-size:11px">⚠️ ยังไม่พร้อมส่ง ' + readiness.readyCount + '/' + readiness.total + ' รายการ</div>';
    }
  }

  html += '<div><label class="lbl">เปลี่ยนเป็น *</label><select id="soSt_next" class="inp" onchange="_toggleSOFields(\'' + soId + '\',this.value)">';
  nexts.forEach(function(st){
    var info = SO_STATUS[st]||{label:st,icon:'?'};
    html += '<option value="' + st + '">' + info.icon + ' ' + info.label + '</option>';
  });
  html += '</select></div>';

  // PR/PO section — โชว์ตอนเปิด SO/รอของ (ไม่บังคับกรอก เผื่อต้องออก PR ภายในหรือมี ETA จาก Vendor)
  html += '<div id="soSt_prSec" style="display:none"><div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">เลข PR ภายใน</label><input id="soSt_prNum" class="inp" placeholder="PR-2026-XXX" value="' + sanitize(s.prNumber||'') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">ETA จาก Vendor</label><input id="soSt_eta" class="inp" type="date" value="' + (s.expectedDelivery||'') + '"></div>';
  html += '</div></div>';

  // Serial section — per item
  html += '<div id="soSt_serSec" style="display:none">';
  html += '<label class="lbl">Serial No. สินค้า</label>';
  (s.items||[]).forEach(function(it, idx){
    var preload = _soItemSerials(it);
    html += '<div style="margin-bottom:8px;padding:8px;background:var(--bg2);border-radius:6px;border:1px solid var(--border)">';
    html += '<div style="font-size:11px;font-weight:500;margin-bottom:5px">' + sanitize(it.model||'-') + ' × ' + (it.qty||0) + ' หน่วย</div>';
    html += '<div id="soSt_sw_' + idx + '" style="min-height:20px">';
    preload.forEach(function(sn){ html += _soSerialSpan(sn); });
    html += '</div>';
    html += '<div style="display:flex;gap:4px;margin-top:5px">';
    html += '<input class="inp" id="soSt_si_' + idx + '" style="flex:1;font-family:monospace;font-size:12px" placeholder="กรอก Serial แล้วกด Enter หรือกด +"';
    html += ' onkeydown="if(event.key===\'Enter\'){_addSOSerial(' + idx + ');event.preventDefault();}">';
    html += '<button class="btn bp bsm" onclick="_addSOSerial(' + idx + ')">+ เพิ่ม</button>';
    html += '</div></div>';
  });
  html += '</div>';

  // Invoice section
  html += '<div id="soSt_invSec" style="display:none"><div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">Invoice Number</label><input id="soSt_invNum" class="inp" placeholder="INV-2026-XXX" value="' + sanitize(s.invoiceNumber||_soNextNum('INV')) + '"></div>';
  html += '<div style="flex:1"><label class="lbl">Invoice Date</label><input id="soSt_invDate" class="inp" type="date" value="' + (s.invoiceDate||_td()) + '"></div>';
  html += '</div></div>';

  html += '<div><label class="lbl">บันทึกเพิ่มเติม</label><textarea id="soSt_note" class="inp" rows="2" placeholder="หมายเหตุ..."></textarea></div>';
  html += '<button class="btn bp" onclick="saveSOStatus(\'' + soId + '\')">💾 บันทึก</button></div>';

  openM('🔄 อัปเดตสถานะ SO', html);
  setTimeout(function(){
    var sel = document.getElementById('soSt_next');
    if (sel) _toggleSOFields(soId, sel.value);
  }, 0);
}

function _toggleSOFields(soId, nextSt) {
  var isPR   = nextSt === 'so_open'; // เปิด SO/รอของ — จุดที่มักต้องออก PR ภายใน หรือมี ETA จาก Vendor
  var isShip = nextSt === 'shipped';
  var isInv  = nextSt === 'invoiced';
  var showSer = isShip || isInv;

  var prSec  = document.getElementById('soSt_prSec');
  var serSec = document.getElementById('soSt_serSec');
  var invSec = document.getElementById('soSt_invSec');
  if (prSec)  prSec.style.display  = isPR    ? '' : 'none';
  if (serSec) serSec.style.display = showSer ? '' : 'none';
  if (invSec) invSec.style.display = (isShip||isInv) ? '' : 'none';
}

function saveSOStatus(soId) {
  var s     = ST.getOne('salesOrders', soId);
  if (!s) return;
  var nextSt = (document.getElementById('soSt_next')||{}).value;
  if (!nextSt) return;
  var note   = (document.getElementById('soSt_note')||{}).value || '';
  var info   = SO_STATUS[nextSt] || { label: nextSt, icon:'?' };
  var cfg    = getConfig();

  // ยังมีสินค้าไม่พร้อมส่งอยู่ แต่จะเปลี่ยนเป็น "ส่งแล้ว" — เตือนอีกชั้น ไม่บล็อก (บางทีส่งบางส่วนก่อนจริงๆ ก็มี)
  if (nextSt === 'shipped') {
    var readiness = soComputeReadiness(s);
    if (!readiness.allReady && !confirm('ยังมีสินค้าไม่พร้อมส่ง ' + (readiness.total - readiness.readyCount) + ' รายการ\nยืนยันจะเปลี่ยนสถานะเป็น "ส่งแล้ว" ไหม?')) return;
  }

  var update = { status: nextSt, updatedAt: new Date().toISOString() };
  var logEntry = { date: _td(), action: info.icon + ' ' + info.label, note: note, by: cfg.saleName||'' };

  // PR/PO fields
  if (nextSt === 'so_open') {
    var prNum = (document.getElementById('soSt_prNum')||{}).value;
    var eta   = (document.getElementById('soSt_eta') ||{}).value;
    if (prNum) update.prNumber = prNum;
    if (eta)   update.expectedDelivery = eta;
  }

  // Invoice fields
  var isShip = ['shipped','invoiced'].indexOf(nextSt) !== -1;
  if (isShip) {
    var invNum  = (document.getElementById('soSt_invNum') ||{}).value;
    var invDate = (document.getElementById('soSt_invDate')||{}).value;
    if (invNum)  update.invoiceNumber = invNum;
    if (invDate) update.invoiceDate   = invDate;
  }

  // Serials
  var showSer = isShip || nextSt === 'invoiced';
  var allSerials = [];
  var newItems = (s.items||[]).map(function(it, idx){
    var clone = JSON.parse(JSON.stringify(it));
    if (showSer) {
      var serials = _collectSerials(idx);
      clone.serials = serials;
      delete clone.serialsReceived;
      delete clone.serialsShipped;
      allSerials = allSerials.concat(serials);
    }
    return clone;
  });
  update.items = newItems;
  if (showSer && allSerials.length) logEntry.serials = allSerials;

  var logs = (s.logs||[]).slice();
  logs.push(logEntry);
  update.logs = logs;

  var updatedSO = ST.update('salesOrders', soId, update);
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
  closeMForce();
  toast('✅ อัปเดตสถานะแล้ว');
  go('soDetail', { soId: soId });
}

// ---------------------------------------------------------------- แก้ไข Serial ย้อนหลัง (ไม่ผูกกับ status — กดได้แม้ SO ปิดจบแล้ว)

function showSOEditSerialsModal(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var html = '<div style="display:flex;flex-direction:column;gap:10px">';
  html += '<div class="hint">แก้ไข Serial รับ/ส่งของแต่ละสินค้าได้ทุกเมื่อ ไม่ต้องรอเปลี่ยนสถานะ</div>';
  (s.items||[]).forEach(function(it, idx){
    html += '<div style="padding:10px;background:var(--bg2);border-radius:8px;border:1px solid var(--border)">';
    html += '<div style="font-size:12px;font-weight:600;margin-bottom:8px">' + sanitize(it.model||'-') + ' × ' + (it.qty||0) + ' หน่วย</div>';

    html += '<label class="lbl" style="font-size:11px">Serial</label>';
    html += '<div id="soEs_' + idx + '" style="min-height:20px;margin-bottom:4px">';
    _soItemSerials(it).forEach(function(sn){ html += _soSerialSpan(sn); });
    html += '</div>';
    html += '<div style="display:flex;gap:4px">';
    html += '<input class="inp" id="soEsi_' + idx + '" style="flex:1;font-family:monospace;font-size:12px" placeholder="กรอก Serial แล้วกด Enter"';
    html += ' onkeydown="if(event.key===\'Enter\'){_addSOSerialEdit(' + idx + ');event.preventDefault();}">';
    html += '<button class="btn bo bsm" onclick="_addSOSerialEdit(' + idx + ')">+ เพิ่ม</button>';
    html += '</div></div>';
  });
  html += '<button class="btn bp" onclick="saveSOEditSerials(\'' + soId + '\')">💾 บันทึก</button></div>';
  openM('🔢 แก้ไข Serial ย้อนหลัง', html);
}

function _addSOSerialEdit(idx) {
  var inp  = document.getElementById('soEsi_' + idx);
  var wrap = document.getElementById('soEs_' + idx);
  if (!inp || !wrap) return;
  var val = inp.value.trim();
  if (!val) return;
  var span = document.createElement('span');
  span.innerHTML = _soSerialSpan(val);
  wrap.appendChild(span.firstChild);
  inp.value = '';
  inp.focus();
}

function _collectSerialsEdit(idx) {
  var wrap = document.getElementById('soEs_' + idx);
  if (!wrap) return [];
  var out = [];
  wrap.querySelectorAll('[data-serial]').forEach(function(el) { out.push(el.getAttribute('data-serial')); });
  return out;
}

function saveSOEditSerials(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var newItems = (s.items||[]).map(function(it, idx){
    var clone = JSON.parse(JSON.stringify(it));
    clone.serials = _collectSerialsEdit(idx);
    delete clone.serialsReceived;
    delete clone.serialsShipped;
    return clone;
  });
  var cfg = getConfig();
  var logs = (s.logs||[]).slice();
  logs.push({ date: _td(), action: '🔢 แก้ไข Serial ย้อนหลัง', note: '', by: cfg.saleName||'' });
  var updatedSO = ST.update('salesOrders', soId, { items: newItems, logs: logs, updatedAt: new Date().toISOString() });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
  closeMForce();
  toast('💾 บันทึก Serial แล้ว');
  go('soDetail', { soId: soId });
}

// โน้ตอิสระต่อรายการสินค้าใน SO (เช่น "แจ้งลูกค้าว่าช้า 3 วัน") — เซฟทันทีตอนออกจากช่อง ไม่ต้องกดปุ่มบันทึกแยก
function saveSOItemComment(soId, idx, value) {
  var s = ST.getOne('salesOrders', soId);
  if (!s || !s.items || !s.items[idx]) return;
  var items = s.items.slice();
  items[idx] = Object.assign({}, items[idx], { comment: value });
  var updatedSO = ST.update('salesOrders', soId, { items: items, updatedAt: new Date().toISOString() });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
}

// ---------------------------------------------------------------- edit modal

function showSOEditModal(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  window._soAttach = (s.attachments || []).slice();
  var dealers = ST.getAll('dealers');
  var dOpts = '<option value="">-- เลือก --</option>';
  dealers.forEach(function(d){
    dOpts += '<option value="' + d.id + '"' + (d.id===s.dealerId?' selected':'') + '>' + sanitize(d.name) + '</option>';
  });

  var html = '<div style="display:flex;flex-direction:column;gap:10px">';
  html += '<div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">SO Number</label><input id="soE_soNum" class="inp" value="' + sanitize(s.soNumber||'') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">Invoice Number</label><input id="soE_invNum" class="inp" value="' + sanitize(s.invoiceNumber||'') + '"></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">Invoice Date</label><input id="soE_invDate" class="inp" type="date" value="' + (s.invoiceDate||'') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">Dealer</label><select id="soE_dealer" class="inp">' + dOpts + '</select></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">PO ลูกค้า</label><input id="soE_po" class="inp" value="' + sanitize(s.customerPO||'') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">PR ภายใน</label><input id="soE_pr" class="inp" value="' + sanitize(s.prNumber||'') + '"></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">ETA จาก Vendor</label><input id="soE_eta" class="inp" type="date" value="' + (s.expectedDelivery||'') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">📌 วันที่ต้องติดตาม (Due)</label><input id="soE_due" class="inp" type="date" value="' + (s.dueDate||'') + '"></div>';
  html += '</div>';
  html += attachUploadHtml('_soAttach', 'salesOrders', '📷 รูปแนบ (PO/Delivery Note/ใบตรวจรับ/สินค้าที่ส่งจริง)');
  html += '<button class="btn bp" onclick="saveSOEdit(\'' + soId + '\')">💾 บันทึก</button></div>';
  openM('✏️ แก้ไข SO', html);
}

function saveSOEdit(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var dealerId = (document.getElementById('soE_dealer')||{}).value || s.dealerId;
  var dealer   = ST.getOne('dealers', dealerId);
  var newSoNumber = (document.getElementById('soE_soNum')||{}).value || s.soNumber;
  var updatedSO = ST.update('salesOrders', soId, {
    soNumber:         newSoNumber,
    invoiceNumber:    (document.getElementById('soE_invNum')||{}).value || '',
    invoiceDate:      (document.getElementById('soE_invDate')||{}).value || '',
    dealerId:         dealerId,
    dealerName:       dealer ? dealer.name : s.dealerName,
    customerPO:       (document.getElementById('soE_po')||{}).value || '',
    prNumber:         (document.getElementById('soE_pr')||{}).value || '',
    expectedDelivery: (document.getElementById('soE_eta')||{}).value || '',
    dueDate:          (document.getElementById('soE_due')||{}).value || '',
    attachments:      window._soAttach || [],
    updatedAt:        new Date().toISOString()
  });
  // เลข SO เปลี่ยน — sync ไปยัง lot ที่จองไว้ใน 1021/PRPO ทุก SKU และ stockReservations ที่ผูก soId นี้ ไม่งั้นจะค้างเลขเก่า
  if (newSoNumber !== s.soNumber && typeof stockSyncSONumber === 'function') stockSyncSONumber(soId, newSoNumber);
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
  closeMForce();
  toast('✅ บันทึกแล้ว');
  go('soDetail', { soId: soId });
}

// ---------------------------------------------------------------- pipeline hook
// เรียกจาก pipeline detail เพื่อสร้าง SO จาก project ที่ win แล้ว
// กรอง project dropdown ตาม dealer ที่เลือก (won projects เท่านั้น)
function _soFilterProjectsByDealer(dealerId) {
  var sel = document.getElementById('soN_pipelineId');
  if (!sel) return;
  var keep = sel.value;
  var won = ST.getAll('pipeline').filter(function(p){ return pipeIsWon(p) && (!dealerId || p.dealerId === dealerId); })
    .sort(function(a,b){ return (a.projectName||'') > (b.projectName||'') ? 1 : -1; });
  var opts = '<option value="">-- ไม่ระบุ / เลือกทีหลัง --</option>';
  won.forEach(function(p){
    var d = ST.getOne('dealers', p.dealerId);
    opts += '<option value="' + p.id + '"' + (keep===p.id?' selected':'') + '>' + sanitize((p.projectName||'').substr(0,50)) + (d && !dealerId ? ' [' + sanitize(d.name) + ']' : '') + '</option>';
  });
  sel.innerHTML = opts;

  // ยังไม่ได้เลือกโครงการ (หรือเปลี่ยน dealer) — กรองใบเสนอราคาตาม dealer อย่างเดียวไปก่อน
  var quoteSel = document.getElementById('soN_quoteSel');
  if (quoteSel && !keep) {
    quoteSel.innerHTML = _soQuotationOptionsHtml(dealerId, '');
    var quoteHidden = document.getElementById('soN_quotationId');
    if (quoteHidden) quoteHidden.value = '';
    window._soQuoteItemsSnapshot = null;
  }
}

// สร้าง SO จากใบเสนอราคา — ดึง dealer / PO / รายการสินค้า+ราคา ไปเลย
function createSOFromQuotation(quoteId) {
  var quotes = [];
  try { quotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch(e) {}
  var q = quotes.filter(function(x){ return x.id === quoteId; })[0];
  if (!q) { toast('❌ ไม่พบใบเสนอราคา'); return; }
  var presetItems = (q.items || []).map(function(it){
    return { model: it.name || it.model || '', sku: it.sku || '', qty: Number(it.quantity) || 1, unitPrice: Number(it.unitPrice) || 0, serials: [] };
  });
  showCreateSOModal({ pipelineId: q.pipelineId || '', quotationId: q.id, dealerId: q.dealerId || '', customerPO: q.poNo || '', presetItems: presetItems });
}

function createSOFromPipeline(pipelineId) {
  showCreateSOModal({ pipelineId: pipelineId });
}

// สร้าง Sales Order ตรงจาก Run Rate — ไม่ต้องผ่าน Pipeline/ใบเสนอราคา (type จะเป็น 'runrate' อัตโนมัติเพราะไม่มี pipelineId)
function createSOFromRunrate(dealerId, model, qty) {
  var unitPrice = (typeof getModelPrice === 'function') ? (getModelPrice(model) || 0) : 0;
  showCreateSOModal({ dealerId: dealerId, presetItems: [{ model: model, qty: qty || 1, unitPrice: unitPrice, serials: [] }] });
}

// ---------------------------------------------------------------- ค้นหา Serial
// รู้ทันทีว่า serial นี้ขายไปโครงการไหน end user คือใคร ขายไปเมื่อไหร่

function rSerialSearch(el) {
  document.getElementById('pgT').textContent = '🔍 ค้นหา Serial';
  el.innerHTML =
    '<div class="card" style="padding:18px">' +
    '<div style="display:flex;gap:8px">' +
    '<input id="serQ" class="inp" style="flex:1;font-family:monospace" placeholder="พิมพ์ serial ที่ต้องการค้นหา" ' +
    'onkeydown="if(event.key===\'Enter\'){runSerialSearch();}">' +
    '<button class="btn bp" onclick="runSerialSearch()">🔍 ค้นหา</button>' +
    '</div></div>' +
    '<div id="serResult" style="margin-top:12px"></div>';
  document.getElementById('serQ').focus();
}

function runSerialSearch() {
  var q = (document.getElementById('serQ').value || '').trim().toLowerCase();
  var out = document.getElementById('serResult');
  if (!q) { out.innerHTML = ''; return; }

  var matches = [];
  ST.getAll('salesOrders').forEach(function(so) {
    (so.items || []).forEach(function(it) {
      _soItemSerials(it).forEach(function(sn) {
        if (sn.toLowerCase().indexOf(q) !== -1) matches.push({ so: so, item: it, serial: sn });
      });
    });
  });

  if (!matches.length) {
    out.innerHTML = '<div class="card"><div class="empty"><div class="icon">📭</div><p>ไม่พบ Serial ที่ตรงกับ "' + sanitize(q) + '"</p></div></div>';
    return;
  }

  var html = '';
  matches.forEach(function(m) {
    var so = m.so;
    var dealer = ST.getOne('dealers', so.dealerId);
    var pipe = so.pipelineId ? ST.getOne('pipeline', so.pipelineId) : null;

    // วันที่ขาย — เอาจาก log ที่บันทึก serial นี้ไว้ ถ้าไม่เจอ fallback เป็นวันที่สร้าง SO
    var soldDate = so.createdAt ? so.createdAt.split('T')[0] : '';
    (so.logs || []).forEach(function(lg) {
      if (lg.serials && lg.serials.indexOf(m.serial) !== -1) soldDate = lg.date;
    });

    html += '<div class="card" style="padding:14px 18px;margin-bottom:10px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    html += '<span style="font-family:monospace;font-weight:700;font-size:14px">' + sanitize(m.serial) + '</span>';
    html += '<span style="font-size:11px;color:var(--text2)">' + sanitize(m.item.model || '-') + '</span>';
    html += '</div>';
    html += '<table style="width:100%;font-size:12px">';
    html += '<tr><td style="color:var(--text2);padding:3px 0;width:35%">📋 โครงการ</td><td style="text-align:right">' + sanitize(pipe ? pipe.projectName : '-') + '</td></tr>';
    html += '<tr><td style="color:var(--text2);padding:3px 0">🏢 End user</td><td style="text-align:right">' + sanitize(pipe ? (pipe.endUserTH || '-') : '-') + '</td></tr>';
    if (!_gvHidden('so_dealerInfo')) html += '<tr><td style="color:var(--text2);padding:3px 0">🏪 Dealer</td><td style="text-align:right">' + sanitize(dealer ? dealer.name : (so.dealerName || '-')) + '</td></tr>';
    html += '<tr><td style="color:var(--text2);padding:3px 0">📅 วันที่ขาย</td><td style="text-align:right">' + sanitize(soldDate || '-') + '</td></tr>';
    html += '<tr><td style="color:var(--text2);padding:3px 0">📄 Sales Order</td><td style="text-align:right"><a href="#" onclick="go(\'soDetail\',{soId:\'' + so.id + '\'});return false">' + sanitize(so.soNumber || '-') + '</a></td></tr>';
    html += '</table></div>';
  });

  out.innerHTML = html;
}
