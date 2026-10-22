// ================================================================
// views-so.js — Sales Order Management
// ================================================================

var soFlt    = 'all';
var soSearch = '';
var soSelectMode = false;
var soSelected = {};
var _soVisibleIds = [];
var _soTimelineExpandedIdx = null;
// เดิมมีแต่ตาราง 6-7 คอลัมน์ ไม่มี card view เลย ต่างจาก Dealer/Quotation/Pipeline ที่มีให้สลับ — บนมือถือ
// ต้อง scroll แนวนอนในกล่องแคบๆ ใช้งานยาก (เจอจากการสแกน UX 2026-08-23) เริ่มด้วย card อัตโนมัติถ้าจอแคบ
// เหมือน pipeView/productViewMode ที่ทำ pattern นี้ไว้แล้ว
var soViewMode = (typeof window !== 'undefined' && window.innerWidth < 768) ? 'card' : 'table';

// สถานะนี้คือสถานะ "เอกสาร/งานธุรการ" ล้วนๆ — คุมด้วยมือตามปกติ ไม่ผูกกับว่าสินค้าพร้อมส่งจริงหรือยัง
// ความพร้อมส่งจริง (สินค้าบางชิ้นต้อง QI บางชิ้นไม่ต้อง คนละคลังกัน) คำนวณแยกต่างหากแบบ real-time ต่อรายการ ดู soComputeReadiness()
// เดิมมี 14 สถานะไล่ทีละสเต็ปตาม 1 เส้นทางเดียว (ต้องผ่าน QI เสมอ) ใช้ไม่ได้จริงกับ SO ที่มีทั้งสินค้าต้อง QI และไม่ต้อง QI ปนกัน — ยุบเหลือสถานะเอกสารกว้างๆ แทน
var SO_STATUS = {
  po_received:     { label:'ได้รับ PO',          color:'#94a3b8', icon:'📄' },
  so_open:         { label:'เปิด SO / รอของ',    color:'#3b82f6', icon:'📋' },
  partial_shipped: { label:'ส่งแล้วบางส่วน',     color:'#f59e0b', icon:'🚚' },
  shipped:         { label:'ส่งแล้ว',            color:'#6366f1', icon:'📦' },
  invoiced:        { label:'ออก Invoice แล้ว',   color:'#8b5cf6', icon:'🧾' },
  closed:          { label:'ปิด',                 color:'#64748b', icon:'✓'  }
};

// หมายเหตุ: 'partial_shipped' ไม่อยู่ในตัวเลือกถัดไปของ so_open ที่นี่โดยตั้งใจ — เข้าสถานะนี้อัตโนมัติจาก
// soRecordShipmentRound() ตอนบันทึกส่งมอบรอบแรกเท่านั้น (ดูการ์ด "🚚 การส่งมอบ" ในหน้า SO) ไม่ใช่ตัวเลือกที่กดเปลี่ยนเอง
var _SO_NEXT = {
  po_received:     ['so_open'],
  so_open:         ['shipped'],
  partial_shipped: ['shipped'],
  shipped:         ['invoiced'],
  invoiced:        ['closed'],
  closed:          []
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
  { key:'po_received',     label:'ได้รับ PO',        statuses:['po_received'] },
  { key:'so_open',         label:'เปิด SO/รอของ',    statuses:['so_open'] },
  { key:'partial_shipped', label:'ส่งแล้วบางส่วน',   statuses:['partial_shipped'] },
  { key:'shipped',         label:'ส่งแล้ว',          statuses:['shipped'] },
  { key:'invoiced',        label:'Invoice',          statuses:['invoiced'] },
  { key:'closed',          label:'ปิด',               statuses:['closed'] }
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

// ---------------------------------------------------------------- แบ่งส่งบางส่วน (partial shipment)

// ความคืบหน้าการส่งมอบต่อรายการ เทียบกับจำนวนที่ลูกค้าสั่งใน PO (it.qty) — ใช้ deliveredForThisSO/bookedForThisSO ที่มีอยู่แล้วจากฝั่งสต็อก
// รายการที่ไม่มี SKU (by-order ไม่ track คลัง) ถือว่าส่งพร้อมกับรายการอื่นเสมอ ไม่บล็อกความคืบหน้า
function soComputeShipmentProgress(so) {
  var items = (so.items || []).map(function(it, idx) {
    if (!it.sku) return { idx: idx, sku: '', model: it.model, poQty: Number(it.qty) || 0, deliveredQty: 0, readyToShipQty: 0, remainingQty: 0, tracked: false };
    var info = (typeof stockSOItemReadyInfo === 'function') ? stockSOItemReadyInfo(it.sku, it.qty, so) : { deliveredForThisSO: 0, bookedForThisSO: 0 };
    var poQty = Number(it.qty) || 0;
    var deliveredQty = info.deliveredForThisSO || 0;
    return {
      idx: idx, sku: it.sku, model: it.model, poQty: poQty, deliveredQty: deliveredQty,
      readyToShipQty: info.bookedForThisSO || 0, // พร้อมส่งแล้ว (จองใน 1021) แต่ยังไม่เคยบันทึกว่าส่ง
      remainingQty: Math.max(0, poQty - deliveredQty), tracked: true
    };
  });
  var allDelivered = items.every(function(x) { return !x.tracked || x.deliveredQty >= x.poQty; });
  var anyDelivered = items.some(function(x) { return x.deliveredQty > 0; });
  return { items: items, allDelivered: allDelivered, anyDelivered: anyDelivered };
}

// ข้อมูล DO/Invoice เดิมเป็น field เดี่ยวผูก 1:1 กับ SO (สมัยที่ยังไม่รองรับแบ่งส่ง) — ย้ายเป็น "รอบที่ 1" ของ shipments[] อัตโนมัติครั้งเดียว
// ไม่ลบ field เดิมทิ้ง (ยังอ่านแสดงผลที่อื่นอยู่) แค่ทำให้ shipments[] มีประวัติครบตั้งแต่รอบแรก
function _soMigrateLegacyShipment(s) {
  if (s.shipments) return s.shipments;
  if (!s.doNumber && !s.invoiceNumber) return [];
  var legacy = [{
    id: 'legacy', date: s.invoiceDate || s.updatedAt || s.createdAt || '', doNumber: s.doNumber || '',
    invoiceNumber: s.invoiceNumber || '', invoiceDate: s.invoiceDate || '', note: 'ย้ายจากข้อมูลเดิมก่อนรองรับแบ่งส่ง', items: []
  }];
  ST.update('salesOrders', s.id, { shipments: legacy });
  return legacy;
}

// เลข DO รัน format DO-YYYYMMDD-NNN (รันใหม่ทุกวัน) อ่านง่ายกว่า DO-ปี-เลขรันยาวทั้งปี — สแกนทั้ง shipments[] ทุก SO และ field เดิม
function _soNextDONum() {
  var today = _td().replace(/-/g, '');
  var re = new RegExp('^DO-' + today + '-(\\d+)$');
  var max = 0;
  soAllShipmentRounds().forEach(function(r) {
    var m = (r.doNumber || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  ST.getAll('salesOrders').forEach(function(s) {
    var m = (s.doNumber || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'DO-' + today + '-' + String(max + 1).padStart(3, '0');
}

// รวบรวมทุกรอบส่งมอบของทุก SO เป็น flat list พร้อมข้อมูล SO ที่ผูกด้วย (soNumber/dealerName/รายการราคาต้นฉบับ)
// ใช้ทั้ง autocomplete เลข Invoice เดิมตอนบันทึกส่งมอบ และหน้า Track ตาม Invoice ใน PO Tracker
function soAllShipmentRounds() {
  var out = [];
  ST.getAll('salesOrders').forEach(function(s) {
    var shipments = _soMigrateLegacyShipment(s);
    shipments.forEach(function(sh) {
      out.push({
        id: sh.id, soId: s.id, soNumber: s.soNumber, dealerName: s.dealerName,
        date: sh.date, doNumber: sh.doNumber || '', invoiceNumber: sh.invoiceNumber || '', invoiceDate: sh.invoiceDate || '',
        note: sh.note || '', items: sh.items || [], soItems: s.items || []
      });
    });
  });
  return out;
}

// sh.items เก็บแค่ sku/model/qty ที่ส่งจริง (ไม่มีราคา) — จับคู่ราคาต่อหน่วยจาก s.items ปัจจุบันของ SO นั้น
// รอบเก่าที่ย้ายมาจากข้อมูลก่อนรองรับแบ่งส่ง (legacy) ไม่มี items[] เลย — fallback ไปใช้รายการทั้งหมดของ SO แทน (ตั้ง estimated:true) กันโชว์ 0 รายการ/0 บาททั้งที่มีของจริง
function _soShipRoundItemsWithPrice(round) {
  var items = round.items || [];
  if (!items.length && (round.soItems || []).length) {
    return (round.soItems || []).filter(function(x) { return x.sku; }).map(function(src) {
      var price = Number(src.unitPrice) || 0;
      var qty = Number(src.qty) || 0;
      return { sku: src.sku, model: src.model, qty: qty, unitPrice: price, total: price * qty, estimated: true };
    });
  }
  return items.map(function(it) {
    var src = (round.soItems || []).filter(function(x) { return x.sku === it.sku; })[0];
    var price = src ? (Number(src.unitPrice) || 0) : 0;
    return { sku: it.sku, model: it.model, qty: it.qty || 0, unitPrice: price, total: price * (it.qty || 0) };
  });
}

// ลำดับรอบส่งมอบของ SKU หนึ่งใน SO เดียว เรียงตามลำดับที่บันทึกจริงใน shipments[] — ใช้จับคู่ "หน่วยที่เท่าไหร่" ของ it.serials (flat list ไม่แยกรอบ) ว่าอยู่ในรอบ/Invoice ไหน ตอน export/import SN จากหน้า Track Invoice
function soSkuShipmentTimeline(soId, sku) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return [];
  var shipments = _soMigrateLegacyShipment(s);
  var out = [];
  shipments.forEach(function(sh) {
    (sh.items || []).forEach(function(it) {
      if (it.sku === sku && (it.qty || 0) > 0) {
        out.push({ roundId: sh.id, qty: it.qty, invoiceNumber: sh.invoiceNumber || '', doNumber: sh.doNumber || '', invoiceDate: sh.invoiceDate || '', date: sh.date || '' });
      }
    });
  });
  return out;
}

// แก้ไขข้อมูลรอบส่งมอบที่บันทึกไว้แล้ว (DO/Invoice/วันที่/หมายเหตุ) — ใช้จากหน้า Track Invoice
// ตั้งเลข Invoice ให้ตรงกับรอบอื่นได้เพื่อรวมเข้า invoice เดียวกัน (soGroupShipmentsByInvoice group ตามเลขอัตโนมัติ)
// field เดิมระดับ SO (s.doNumber/invoiceNumber/invoiceDate) มีไว้ mirror รอบล่าสุดเสมอ (ตามที่ soRecordShipmentRound ทำ) — คำนวณใหม่จากรอบสุดท้ายทุกครั้งที่แก้ กันข้อมูลสองที่ไม่ตรงกัน
function soUpdateShipmentRound(soId, roundId, fields) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var shipments = _soMigrateLegacyShipment(s).slice();
  var idx = -1;
  shipments.forEach(function(sh, i) { if (sh.id === roundId) idx = i; });
  if (idx === -1) return;
  shipments[idx] = Object.assign({}, shipments[idx], fields);
  var last = shipments[shipments.length - 1];
  var update = {
    shipments: shipments,
    doNumber: last.doNumber || '',
    invoiceNumber: last.invoiceNumber || '',
    invoiceDate: last.invoiceDate || ''
  };
  var updated = ST.update('salesOrders', soId, update);
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updated);
  return updated;
}

// ---------------------------------------------------------------- แก้ไขรอบส่งมอบ (จากหน้า Track Invoice)

function showSOEditShipmentRoundModal(soId, roundId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var shipments = _soMigrateLegacyShipment(s);
  var sh = shipments.filter(function(x) { return x.id === roundId; })[0];
  if (!sh) { toast('⚠️ ไม่พบรอบส่งมอบนี้แล้ว'); return; }
  var itemsLine = (sh.items || []).length
    ? (sh.items || []).map(function(it) { return sanitize(it.model || it.sku) + ' ×' + (it.qty || 0); }).join(', ')
    : '<span style="color:var(--text2)">ไม่มีรายละเอียดรายการ (ย้ายจากข้อมูลเดิมก่อนรองรับแบ่งส่ง)</span>';
  var html = '<div class="hint" style="margin-bottom:10px">' + sanitize(s.soNumber || '') + (sh.date ? ' · ส่งวันที่ ' + fD(sh.date) : '') + '<br>' + itemsLine + '</div>';
  html += '<div style="display:flex;gap:8px"><div style="flex:1"><label class="lbl">DO Number</label><input id="soEr_do" class="inp" value="' + sanitize(sh.doNumber || '') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">Invoice Number</label><input id="soEr_inv" class="inp" value="' + sanitize(sh.invoiceNumber || '') + '" list="soEr_invList"></div></div>';
  var allInv = {};
  soAllShipmentRounds().forEach(function(r) { if (r.invoiceNumber) allInv[r.invoiceNumber] = true; });
  html += '<datalist id="soEr_invList">' + Object.keys(allInv).map(function(n) { return '<option value="' + sanitize(n) + '">'; }).join('') + '</datalist>';
  html += '<div style="display:flex;gap:8px;margin-top:8px"><div style="flex:1"><label class="lbl">Invoice Date</label><input id="soEr_invDate" type="date" class="inp" value="' + sanitize(sh.invoiceDate || '') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">หมายเหตุ</label><input id="soEr_note" class="inp" value="' + sanitize(sh.note || '') + '"></div></div>';
  html += '<div class="hint" style="margin-top:6px;font-size:11px">💡 ตั้งเลข Invoice ให้ตรงกับ Invoice ที่มีอยู่แล้ว เพื่อรวมรอบนี้เข้า Invoice เดียวกัน</div>';
  html += '<button class="btn bp btn-full" style="margin-top:12px" onclick="_saveSOEditShipmentRound(\'' + soId + '\',\'' + roundId + '\')">💾 บันทึก</button>';
  openM('✏️ แก้ไขข้อมูลรอบส่งมอบ', html);
}

// เปิดดูรายละเอียด Invoice ของรอบส่งมอบหนึ่งจากหน้า SO Detail โดยตรง (เดิมดูได้แค่เลข/copy)
// รวมรายการสินค้า+ราคา+Serial ของรอบนั้น พร้อมปุ่มแก้ไขรอบนี้/แก้ไข Serial เหมือนในหน้า Track Invoice
function showInvoiceDetailModal(soId, roundId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var shipments = _soMigrateLegacyShipment(s);
  var sh = shipments.filter(function(x) { return x.id === roundId; })[0];
  if (!sh) { toast('⚠️ ไม่พบรอบส่งมอบนี้แล้ว'); return; }
  var items = (typeof _soShipRoundItemsWithPrice === 'function') ? _soShipRoundItemsWithPrice({ items: sh.items || [], soItems: s.items || [] }) : [];
  var grandTotal = items.reduce(function(sum, it) { return sum + (it.total || 0); }, 0);

  var html = '<div style="margin-bottom:10px"><b>' + sanitize(s.soNumber || '') + '</b> — ' + sanitize(s.dealerName || '') +
    (sh.date ? '<div style="font-size:12px;color:var(--text2)">ส่งวันที่ ' + fD(sh.date) + '</div>' : '') + '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:10px">';
  html += '<div><div style="font-size:11px;color:var(--text2)">Invoice</div><div>' + (sh.invoiceNumber ? qcopyHtml(sh.invoiceNumber) : '-') + '</div></div>';
  html += '<div><div style="font-size:11px;color:var(--text2)">วันที่ Invoice</div><div>' + (sh.invoiceDate ? fD(sh.invoiceDate) : '-') + '</div></div>';
  html += '<div><div style="font-size:11px;color:var(--text2)">DO</div><div>' + (sh.doNumber ? qcopyHtml(sh.doNumber) : '-') + '</div></div>';
  html += '</div>';
  if (sh.note) html += '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">📝 ' + sanitize(sh.note) + '</div>';

  if (items.length) {
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr style="background:var(--bg2);text-align:left">' +
      '<th style="padding:6px 8px;color:var(--text2)">สินค้า</th>' +
      '<th style="padding:6px 8px;color:var(--text2)">SKU</th>' +
      '<th style="padding:6px 8px;color:var(--text2);text-align:center">จำนวน</th>' +
      '<th style="padding:6px 8px;color:var(--text2);text-align:right">ราคา/หน่วย</th>' +
      '<th style="padding:6px 8px;color:var(--text2);text-align:right">รวม</th>' +
      '<th style="padding:6px 8px;color:var(--text2)">Serial</th></tr></thead><tbody>';
    items.forEach(function(it) {
      var soItem = (s.items || []).filter(function(x) { return x.sku === it.sku; })[0];
      var allSns = soItem ? ((typeof _soItemSerials === 'function') ? _soItemSerials(soItem) : (soItem.serials || [])) : [];
      var sns = it.estimated ? allSns : _soRoundItemSerials(soId, roundId, it.sku, allSns);
      html += '<tr style="border-top:1px solid var(--border)">';
      html += '<td style="padding:6px 8px">' + sanitize(it.model || '-') + (it.estimated ? ' <span style="font-size:10px;color:var(--text2)" title="รอบนี้ไม่มีรายละเอียดจริง แสดงประมาณจากรายการ SO">~ประมาณ</span>' : '') + '</td>';
      html += '<td style="padding:6px 8px;font-family:monospace;font-size:11px">' + sanitize(it.sku || '-') + '</td>';
      html += '<td style="padding:6px 8px;text-align:center">' + (it.qty || 0) + '</td>';
      html += '<td style="padding:6px 8px;text-align:right">' + fmtMoney(it.unitPrice) + '</td>';
      html += '<td style="padding:6px 8px;text-align:right">' + fmtMoney(it.total) + '</td>';
      html += '<td style="padding:6px 8px;font-size:10px">' + (sns.length ? sanitize(sns.join(', ')) : '<span style="color:var(--text2)">-</span>') + '</td>';
      html += '</tr>';
    });
    html += '<tr style="font-weight:600;background:var(--bg2);border-top:1px solid var(--border)"><td colspan="4" style="padding:6px 8px;text-align:right">รวม</td><td style="padding:6px 8px;text-align:right">' + fmtMoney(grandTotal) + '</td><td></td></tr>';
    html += '</tbody></table></div>';
    if (items.some(function(it) { return it.estimated; })) {
      html += '<div class="hint" style="font-size:10px;margin-top:4px">~ประมาณ = รอบนี้ไม่มีรายละเอียดจริง (ข้อมูลเก่าก่อนรองรับแบ่งส่ง) จึงโชว์ Serial ทั้งหมดของ SKU นี้ใน SO — ตรวจซ้ำก่อนใช้ ถ้า SKU นี้เคยส่งมากกว่า 1 รอบ</div>';
    }
  } else {
    html += '<div class="hint">ไม่มีรายละเอียดรายการสินค้าของรอบนี้</div>';
  }

  html += '<div style="display:flex;gap:8px;margin-top:12px">';
  html += '<button class="btn bo bsm" style="flex:1" onclick="closeMForce();showSOEditShipmentRoundModal(\'' + soId + '\',\'' + roundId + '\')">✏️ แก้ไขข้อมูลรอบนี้</button>';
  html += '<button class="btn bo bsm" style="flex:1" onclick="closeMForce();showSOEditSerialsModal(\'' + soId + '\')">🔢 แก้ไข Serial</button>';
  html += '</div>';
  if (sh.invoiceNumber) {
    html += '<button class="btn bo btn-full bsm" style="margin-top:6px" onclick="_soGoToTrackInvoice(\'' + _jsEsc(sh.invoiceNumber) + '\')">🧾 ดูรวมทุก SO ที่ใช้ Invoice นี้</button>';
  }

  openM('🧾 รายละเอียด Invoice — ' + sanitize(s.soNumber || ''), html);
}

// หารอบส่งมอบที่ field ระดับ SO (s.doNumber/invoiceNumber) กำลัง mirror อยู่ — ใช้ให้ช่อง Invoice/DO บนหัว SO detail กดดูรายละเอียดรอบนั้นได้ (ไม่ใช่แค่ copy เลขเหมือนเดิม)
function _soHeaderShipmentRound(s) {
  var shipments = _soMigrateLegacyShipment(s);
  var matches = shipments.filter(function(sh) {
    return (s.invoiceNumber && sh.invoiceNumber === s.invoiceNumber) || (s.doNumber && sh.doNumber === s.doNumber);
  });
  return matches.length ? matches[matches.length - 1] : null;
}

// escape ค่าที่จะฝังใน onclick='...' โดยตรง (กันเลข Invoice ที่อาจมีเครื่องหมาย ' ปนมาทำ syntax พัง)
function _jsEsc(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ไปหน้า PO Tracker แท็บ Track Invoice พร้อมค้นหาด้วยเลข Invoice นี้ทันที — ใช้จากปุ่ม "ดูรวมทุก SO" ใน modal รายละเอียด Invoice
function _soGoToTrackInvoice(invNum) {
  closeMForce();
  if (typeof poTrackerSearch !== 'undefined') poTrackerSearch = invNum;
  if (typeof poTrackerMainTab !== 'undefined') poTrackerMainTab = 'invoice';
  if (typeof go === 'function') go('poTracker');
}

function _saveSOEditShipmentRound(soId, roundId) {
  var fields = {
    doNumber: (document.getElementById('soEr_do').value || '').trim(),
    invoiceNumber: (document.getElementById('soEr_inv').value || '').trim(),
    invoiceDate: document.getElementById('soEr_invDate').value || '',
    note: (document.getElementById('soEr_note').value || '').trim()
  };
  soUpdateShipmentRound(soId, roundId, fields);
  closeMForce();
  toast('💾 บันทึกข้อมูลรอบส่งมอบแล้ว');
  if (typeof render === 'function') render();
}

// group ทุกรอบส่งมอบ (ที่มีเลข Invoice) ข้ามทุก SO ตามเลข Invoice เดียวกัน — ใหม่สุดก่อน — ใช้โดยหน้า Track ตาม Invoice
function soGroupShipmentsByInvoice() {
  var rounds = soAllShipmentRounds().filter(function(r) { return r.invoiceNumber; });
  var byInv = {};
  rounds.forEach(function(r) {
    var g = byInv[r.invoiceNumber] = byInv[r.invoiceNumber] || { invoiceNumber: r.invoiceNumber, invoiceDate: '', rounds: [] };
    if (!g.invoiceDate) g.invoiceDate = r.invoiceDate;
    g.rounds.push(r);
  });
  return Object.keys(byInv).map(function(k) { return byInv[k]; })
    .sort(function(a, b) { return (b.invoiceDate || '').localeCompare(a.invoiceDate || ''); });
}

// เลข Invoice ที่ถูกใช้ "วันนี้" ในรอบของ SO ใดก็ได้ พร้อมสรุปสั้นๆ (กี่ SO/รายการ/dealer ไหน) — ให้เลือกใช้ซ้ำ กันพิมพ์เลขผิด/สร้างซ้ำตอนรวมหลาย SO เข้า invoice เดียวกัน
function soTodayInvoiceOptions() {
  var today = _td();
  var rounds = soAllShipmentRounds().filter(function(r) { return r.invoiceNumber && r.date === today; });
  var byInv = {};
  rounds.forEach(function(r) {
    var g = byInv[r.invoiceNumber] = byInv[r.invoiceNumber] || { invoiceNumber: r.invoiceNumber, soSet: {}, dealerSet: {}, itemCount: 0 };
    g.soSet[r.soNumber] = true;
    g.dealerSet[r.dealerName] = true;
    g.itemCount += (r.items || []).length;
  });
  return Object.keys(byInv).map(function(k) {
    var g = byInv[k];
    return { invoiceNumber: k, soCount: Object.keys(g.soSet).length, itemCount: g.itemCount, dealerNames: Object.keys(g.dealerSet).filter(Boolean).join(', ') };
  });
}

// บันทึกการส่งมอบ 1 รอบ — roundItems: [{sku, qty1021, qty0001}] เฉพาะที่ผู้ใช้กรอก qty > 0
// qty1021 = ส่งจากของที่จองใน 1021 ไว้แล้ว, qty0001 = ส่งตรงจากคลัง 1001 (ยังไม่เคยจอง) ในรอบเดียวกัน
// มาร์ค lot เป็นส่งมอบแล้วตามจำนวนจริง แล้วเลื่อนสถานะ SO อัตโนมัติ (ไม่ถอยสถานะที่ไปไกลกว่าแล้ว)
function soRecordShipmentRound(soId, roundItems, doNumber, invoiceNumber, invoiceDate, note) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var shipments = _soMigrateLegacyShipment(s).slice();
  var shippedItems = [];
  roundItems.forEach(function(ri) {
    var qty1021 = Math.max(0, Math.round(Number(ri.qty1021) || 0));
    var qty0001 = Math.max(0, Math.round(Number(ri.qty0001) || 0));
    var qtyShortage = Math.max(0, Math.round(Number(ri.qtyShortage) || 0));
    if ((qty1021 <= 0 && qty0001 <= 0 && qtyShortage <= 0) || !ri.sku) return;
    var it = (s.items || []).filter(function(x) { return x.sku === ri.sku; })[0];
    var productName = it ? it.model : ri.sku;
    var delivered = 0;
    if (qty1021 > 0 && typeof stockDeliverSOItemQty === 'function') delivered += stockDeliverSOItemQty(ri.sku, productName, soId, qty1021);
    if (qty0001 > 0 && typeof stockDeliverSOItemFrom0001 === 'function') delivered += stockDeliverSOItemFrom0001(ri.sku, productName, s, qty0001);
    if (qtyShortage > 0 && typeof stockDeliverSOItemBackdated === 'function') delivered += stockDeliverSOItemBackdated(ri.sku, productName, s, qtyShortage);
    if (delivered > 0) shippedItems.push({ sku: ri.sku, model: productName, qty: delivered });
  });
  if (!shippedItems.length) { toast('⚠️ ไม่มีรายการที่พร้อมส่งให้บันทึก'); return; }

  shipments.push({
    id: 'ship_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    date: _td(), doNumber: doNumber || '', invoiceNumber: invoiceNumber || '', invoiceDate: invoiceDate || '',
    note: note || '', items: shippedItems, createdAt: _nw()
  });

  var update = { shipments: shipments, doNumber: doNumber || s.doNumber || '', invoiceNumber: invoiceNumber || s.invoiceNumber || '', invoiceDate: invoiceDate || s.invoiceDate || '' };
  var progress = soComputeShipmentProgress(Object.assign({}, s, update));
  var order = ['po_received', 'so_open', 'partial_shipped', 'shipped', 'invoiced', 'closed'];
  var curIdx = order.indexOf(s.status);
  var target = progress.allDelivered ? 'shipped' : (progress.anyDelivered ? 'partial_shipped' : s.status);
  var targetIdx = order.indexOf(target);
  if (targetIdx > curIdx) {
    update.status = target;
    var cfg = getConfig();
    var targetInfo = SO_STATUS[target] || { label: target, icon: '?' };
    var logs = (s.logs || []).slice();
    logs.push({ date: _td(), action: targetInfo.icon + ' ' + targetInfo.label, note: 'อัตโนมัติจากการบันทึกส่งมอบ', by: cfg.saleName || '', fromStatus: s.status, toStatus: target });
    update.logs = logs;
  }

  var updated = ST.update('salesOrders', soId, update);
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updated);
  toast('💾 บันทึกการส่งมอบแล้ว (' + shippedItems.reduce(function(sum, x) { return sum + x.qty; }, 0) + ' ชิ้น)');
  closeMForce();
  _soRerenderKeepScroll();
}

function showSORecordShipmentModal(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var trackedItems = (s.items || []).filter(function(it) { return it.sku; });
  if (!trackedItems.length) { toast('⚠️ SO นี้ไม่มีรายการที่ผูก SKU ให้ตรวจสต็อก'); return; }

  // โชว์ทุกรายการที่มี SKU พร้อมสต็อกแบบละเอียด (ส่งแล้ว/พร้อมส่งจาก 1021/มีใน 1001 แต่ยังไม่จอง/ขาดต้อง PR-PO)
  // เลือกได้ว่าจะส่งรอบนี้จากคลังไหนเท่าไหร่ — จากของที่จองใน 1021 ไว้แล้ว และ/หรือ ตรงจากคลัง 1001 ที่ยังไม่เคยจอง (ย้าย+ส่งมอบให้ในขั้นตอนเดียว ไม่ต้องไปกดจองเข้า 1021 แยกก่อน)
  var anyReady = false;
  var body = '<div class="hint" style="margin-bottom:8px">เลือกจำนวนและคลังที่จะส่งรอบนี้ต่อรายการ — ส่งจากของที่จองใน 1021 ไว้แล้ว และ/หรือตรงจากคลัง 1001 ก็ได้ในรอบเดียวกัน</div>';
  body += '<div style="display:flex;gap:6px;margin-bottom:8px">';
  body += '<button type="button" class="btn bsm" style="flex:1" onclick="_soShipFillAll(\'' + soId + '\')">✅ ส่งทั้งหมดทุกรายการ</button>';
  body += '<button type="button" class="btn bsm" style="flex:1" onclick="_soShipClearAll(\'' + soId + '\')">🧹 ล้างทั้งหมด</button>';
  body += '</div>';
  trackedItems.forEach(function(it, idx) {
    var info = (typeof stockSOItemReadyInfo === 'function') ? stockSOItemReadyInfo(it.sku, it.qty, s) : { deliveredForThisSO: 0, bookedForThisSO: 0, from0001: 0, shortfall: 0 };
    var qty1021 = info.bookedForThisSO || 0;
    var qty0001 = info.from0001 || 0;
    var shortfall = info.shortfall || 0;
    body += '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">';
    body += '<div style="margin-bottom:4px"><b>' + sanitize(it.model || it.sku) + '</b> <span style="color:var(--text2);font-size:11px">(สั่ง ' + (it.qty || 0) + ')</span></div>';
    if (qty1021 > 0 || qty0001 > 0) {
      body += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;align-items:flex-end">';
      if (qty1021 > 0) {
        body += '<div><label class="lbl" style="font-size:10px;color:#16a34a">✓ จาก 1021 (จองไว้แล้ว — พร้อมส่งทันที) สูงสุด ' + qty1021 + '</label>';
        body += '<input type="number" class="inp" style="width:80px" id="soShip_q1021_' + idx + '" data-sku="' + sanitize(it.sku) + '" value="' + qty1021 + '" min="0" max="' + qty1021 + '" oninput="_soShipUpdateTotals(\'' + soId + '\')"></div>';
      }
      if (qty0001 > 0) {
        body += '<div><label class="lbl" style="font-size:10px;color:#2563eb">📦 จาก 1001 (มีของแล้วแต่ยังไม่จอง) สูงสุด ' + qty0001 + '</label>';
        body += '<div style="display:flex;gap:4px"><input type="number" class="inp" style="width:80px" id="soShip_q0001_' + idx + '" data-sku="' + sanitize(it.sku) + '" value="0" min="0" max="' + qty0001 + '" oninput="_soShipUpdateTotals(\'' + soId + '\')">';
        body += '<button type="button" class="btn bsm" style="padding:0 8px" onclick="_soShipFillItem(\'' + soId + '\',' + idx + ')">ส่งทั้งหมด</button></div></div>';
      }
      body += '</div>';
    }
    body += '<div style="display:flex;gap:4px;flex-wrap:wrap;font-size:10px;margin-bottom:4px">';
    if (info.deliveredForThisSO > 0) body += '<span style="padding:2px 7px;border-radius:999px;background:rgba(107,114,128,.15);color:#6b7280">✔ ส่งมอบแล้ว ' + info.deliveredForThisSO + '</span>';
    if (shortfall > 0) body += '<span style="padding:2px 7px;border-radius:999px;background:rgba(239,68,68,.15);color:#ef4444">✕ ขาดอีก ' + shortfall + ' ต้อง PR/PO</span>';
    body += '</div>';
    if (shortfall > 0) {
      body += '<div><label class="lbl" style="font-size:10px;color:#ea580c">⚠️ บันทึกย้อนหลัง (ของยังไม่มีในคลังจริง) สูงสุด ' + shortfall + '</label>';
      body += '<input type="number" class="inp" style="width:80px" id="soShip_qShort_' + idx + '" data-sku="' + sanitize(it.sku) + '" value="0" min="0" max="' + shortfall + '" oninput="_soShipUpdateTotals(\'' + soId + '\')"></div>';
      body += '<div class="hint" style="font-size:10px;margin-top:2px">ใช้เมื่อส่งของให้ลูกค้าไปแล้วจริงแต่ยังไม่ได้เพิ่มสต็อกในระบบ — บันทึกจำนวนนี้แล้วยอด "ขาดอีก" ที่ต้องสั่ง PR/PO จะลดลงตามจำนวนที่กรอก</div>';
    }
    body += '</div>';
    if (qty1021 > 0 || qty0001 > 0) anyReady = true;
  });
  if (!anyReady) body += '<div class="warn-box" style="font-size:11px;margin-top:8px">⚠️ ยังไม่มีของพร้อมส่งเลย ทั้งที่จองใน 1021 และในคลัง 1001</div>';
  body += '<div id="soShip_totals" class="hint" style="margin-top:8px;font-weight:600"></div>';
  body += '<div style="display:flex;gap:8px;margin-top:10px">';
  body += '<div style="flex:1"><label class="lbl">DO Number รอบนี้</label><input id="soShip_do" class="inp" placeholder="DO-20261021-XXX" value="' + sanitize(_soNextDONum()) + '"></div>';
  body += '<div style="flex:1"><label class="lbl">Invoice Number รอบนี้</label>';
  var todayInvOpts = (typeof soTodayInvoiceOptions === 'function') ? soTodayInvoiceOptions() : [];
  if (todayInvOpts.length) {
    body += '<select id="soShip_invPick" class="inp" style="margin-bottom:4px" onchange="_soPickTodayInvoice(this.value,\'' + soId + '\')">';
    body += '<option value="">➕ สร้างเลขใหม่ (' + sanitize(_soNextNum('INV')) + ')</option>';
    todayInvOpts.forEach(function(o) {
      body += '<option value="' + sanitize(o.invoiceNumber) + '">🔁 ' + sanitize(o.invoiceNumber) + ' — ' + sanitize(o.dealerNames || '-') + ' · ' + o.soCount + ' SO, ' + o.itemCount + ' รายการ</option>';
    });
    body += '</select>';
  }
  body += '<input id="soShip_inv" class="inp" placeholder="INV-2026-XXX" value="' + sanitize(_soNextNum('INV')) + '" oninput="_soUpdateInvoicePreview(\'' + soId + '\')"></div>';
  body += '</div>';
  body += '<div id="soShip_invPreview"></div>';
  body += '<div style="display:flex;gap:8px;margin-top:8px">';
  body += '<div style="flex:1"><label class="lbl">Invoice Date</label><input id="soShip_invDate" class="inp" type="date" value="' + _td() + '"></div>';
  body += '<div style="flex:1"><label class="lbl">หมายเหตุ</label><input id="soShip_note" class="inp" placeholder="ไม่บังคับ"></div>';
  body += '</div>';
  body += '<button class="btn bp btn-full" style="margin-top:12px" id="soShip_saveBtn" onclick="_saveSORecordShipment(\'' + soId + '\')">💾 บันทึกการส่งมอบรอบนี้</button>';
  openM('🚚 บันทึกการส่งมอบรอบนี้ — ' + sanitize(s.soNumber || ''), body);
  _soShipUpdateTotals(soId);
}

// ปุ่ม "ส่งทั้งหมด" ต่อรายการ — กรอกจำนวนช่อง 1001 (ยังไม่จอง) ให้เต็มสูงสุดทันที (ช่อง 1021 เต็มอยู่แล้วโดยปริยาย)
function _soShipFillItem(soId, idx) {
  var inp = document.getElementById('soShip_q0001_' + idx);
  if (inp) inp.value = inp.getAttribute('max') || 0;
  _soShipUpdateTotals(soId);
}
// กรอกทุกรายการให้เต็มสูงสุดทั้งช่อง 1021 และ 1001 ในคลิกเดียว (ไม่รวมช่องบันทึกย้อนหลัง ต้องตัดสินใจเป็นรายรายการ)
function _soShipFillAll(soId) {
  document.querySelectorAll('[id^="soShip_q1021_"], [id^="soShip_q0001_"]').forEach(function(inp) {
    inp.value = inp.getAttribute('max') || 0;
  });
  _soShipUpdateTotals(soId);
}
// ล้างทุกช่อง (1021/1001/บันทึกย้อนหลัง) เป็น 0
function _soShipClearAll(soId) {
  document.querySelectorAll('[id^="soShip_q1021_"], [id^="soShip_q0001_"], [id^="soShip_qShort_"]').forEach(function(inp) {
    inp.value = 0;
  });
  _soShipUpdateTotals(soId);
}
// สรุปจำนวนรวมที่กำลังจะบันทึกรอบนี้ + ปิดปุ่มบันทึกถ้ายังไม่ได้กรอกอะไรเลย กันกดพลาด
function _soShipUpdateTotals(soId) {
  var bySku = {}, totalQty = 0;
  document.querySelectorAll('[id^="soShip_q1021_"], [id^="soShip_q0001_"], [id^="soShip_qShort_"]').forEach(function(inp) {
    var v = Math.max(0, Math.round(Number(inp.value) || 0));
    if (v > 0) { bySku[inp.getAttribute('data-sku')] = true; totalQty += v; }
  });
  var itemCount = Object.keys(bySku).length;
  var box = document.getElementById('soShip_totals');
  if (box) box.textContent = totalQty > 0 ? ('รวมรอบนี้: ' + itemCount + ' รายการ, ' + totalQty + ' ชิ้น') : 'ยังไม่ได้เลือกจำนวนที่จะส่ง';
  var btn = document.getElementById('soShip_saveBtn');
  if (btn) btn.disabled = totalQty <= 0;
}

// รายการ SO/สินค้าที่อยู่ใน Invoice เลขนี้แล้ว (จากรอบของ SO อื่น) — โชว์เตือนก่อนบันทึก กันพิมพ์เลขผิด/เผลอรวมผิดใบ
function _soInvoicePreviewHtml(invNum, excludeSoId) {
  if (!invNum) return '';
  var rounds = soAllShipmentRounds().filter(function(r) { return r.invoiceNumber === invNum && r.soId !== excludeSoId; });
  if (!rounds.length) return '';
  var lines = rounds.map(function(r) {
    var itemsTxt = (r.items || []).map(function(it) { return sanitize(it.model || it.sku) + ' × ' + it.qty; }).join(', ');
    return '• ' + sanitize(r.soNumber || '-') + ' (' + sanitize(r.dealerName || '-') + ') — ' + itemsTxt;
  }).join('<br>');
  return '<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 12px;margin-top:6px;font-size:11px">' +
    '<div style="font-weight:700;color:#5b21b6;margin-bottom:4px">🔎 กำลังจะรวมเข้า Invoice ' + sanitize(invNum) + ' ซึ่งมีอยู่แล้ว:</div>' +
    '<div style="color:#4c1d95;line-height:1.6">' + lines + '</div></div>';
}
function _soUpdateInvoicePreview(soId) {
  var inv = (document.getElementById('soShip_inv') || {}).value || '';
  var box = document.getElementById('soShip_invPreview');
  if (box) box.innerHTML = _soInvoicePreviewHtml(inv, soId);
}
function _soPickTodayInvoice(v, soId) {
  var input = document.getElementById('soShip_inv');
  if (input) input.value = v || _soNextNum('INV');
  _soUpdateInvoicePreview(soId);
}

function _saveSORecordShipment(soId) {
  var bySku = {};
  document.querySelectorAll('[id^="soShip_q1021_"]').forEach(function(input) {
    var sku = input.getAttribute('data-sku');
    bySku[sku] = bySku[sku] || { sku: sku, qty1021: 0, qty0001: 0, qtyShortage: 0 };
    bySku[sku].qty1021 = input.value;
  });
  document.querySelectorAll('[id^="soShip_q0001_"]').forEach(function(input) {
    var sku = input.getAttribute('data-sku');
    bySku[sku] = bySku[sku] || { sku: sku, qty1021: 0, qty0001: 0, qtyShortage: 0 };
    bySku[sku].qty0001 = input.value;
  });
  document.querySelectorAll('[id^="soShip_qShort_"]').forEach(function(input) {
    var sku = input.getAttribute('data-sku');
    bySku[sku] = bySku[sku] || { sku: sku, qty1021: 0, qty0001: 0, qtyShortage: 0 };
    bySku[sku].qtyShortage = input.value;
  });
  var roundItems = Object.keys(bySku).map(function(sku) { return bySku[sku]; });
  var doNumber = (document.getElementById('soShip_do') || {}).value || '';
  var invoiceNumber = (document.getElementById('soShip_inv') || {}).value || '';
  var invoiceDate = (document.getElementById('soShip_invDate') || {}).value || '';
  var note = (document.getElementById('soShip_note') || {}).value || '';
  soRecordShipmentRound(soId, roundItems, doNumber, invoiceNumber, invoiceDate, note);
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

// สถานะการจอง/หมายเหตุ/อ้างอิง ของสินค้า 1 รายการ — ใช้ในตาราง copy สรุปส่ง Sales Support
// แยกจาก _poTrackerItemRemark เพราะตรงนั้นรวม status+note เป็นข้อความเดียว ส่วนตารางต้องการแยกคอลัมน์
function _soSummaryItemStatusInfo(it, s) {
  var qty = Number(it.qty) || 0;
  var status = '—', note = '';
  // เช็คว่าส่งมอบจริงครบแล้วหรือยังก่อนเสมอ (เหมือน _poTrackerItemBucket) — ไม่งั้นรายการที่ส่งแล้วจะโผล่เป็น "พร้อมส่ง" ตาม sourceType เดิมที่ยังไม่ได้ลบ
  var readyInfo = (it.sku && typeof stockSOItemReadyInfo === 'function') ? stockSOItemReadyInfo(it.sku, qty, s) : null;
  // จองคลังจริงมาแล้วบางส่วน (partial lock) — สถานะ/qty ด้านล่างอธิบายแค่ "ส่วนที่เหลือ" ไม่ใช่ทั้งรายการ (ดูเหตุผลเดียวกับ _poTrackerItemRemark)
  var bookedNote = (readyInfo && readyInfo.bookedForThisSO > 0 && readyInfo.bookedForThisSO < qty) ? ' (จองคลังแล้ว ' + readyInfo.bookedForThisSO + '/' + qty + ' ชิ้น)' : '';
  var remQty = (readyInfo && readyInfo.bookedForThisSO > 0) ? Math.max(0, qty - readyInfo.bookedForThisSO - readyInfo.deliveredForThisSO) : qty;
  if (readyInfo && qty > 0 && readyInfo.deliveredForThisSO >= qty) {
    status = '✅ ส่งแล้ว';
  } else if (it.sourceType === 'pr_po') {
    status = '🛒 รอ PR/PO ' + remQty + ' ชิ้น' + bookedNote;
    var stLabel = (typeof _soPrpoStatusLabel === 'function') ? _soPrpoStatusLabel(it) : (it.prpoStatus || '');
    if (stLabel) note = stLabel;
    if (it.prpoExpectedDate) note = (note ? note + ' — ' : '') + 'คาดว่าได้ ' + fD(it.prpoExpectedDate);
  } else if (it.sourceType === 'restock') {
    status = '⏳ รอของเข้า (Run rate) ' + remQty + ' ชิ้น' + bookedNote;
    if (it.restockExpectedDate) note = 'คาดว่าเข้า stock ' + fD(it.restockExpectedDate);
  } else if (it.sourceType === 'reserve_1021') {
    status = '📌 จองคลัง 1021 (' + remQty + ' ชิ้น)' + bookedNote;
    if (it.reserveExpiryDate) note = 'จองถึง ' + fD(it.reserveExpiryDate);
  } else if (it.sourceType === 'reserve_8d01') {
    status = '🧳 จองคลัง 8D01 (' + remQty + ' ชิ้น)' + bookedNote;
    if (it.reserveExpiryDate) note = 'จองถึง ' + fD(it.reserveExpiryDate);
  } else if (it.sourceType === 'central_wh') {
    status = '🏢 ส่งจากคลังกลาง';
  } else if (readyInfo) {
    if (readyInfo.ready) status = '✅ พร้อมส่ง';
    else if (readyInfo.shortfall > 0) status = '⚠️ ขาดอีก ' + readyInfo.shortfall + ' ชิ้น';
    if (readyInfo.bookingExpiryDate) note = 'จองถึง ' + fD(readyInfo.bookingExpiryDate);
  }
  // ลิงก์จอง/อ้างอิง — ใช้ลิงก์ที่พิมพ์ไว้ในช่อง "ลิงก์" ของรายการนี้ก่อน (it.link) ถ้าไม่มีค่อย fallback เป็นเลข SO/PO ของใบนี้
  var ref = it.link || s.soNumber || s.customerPO || '-';
  if (!it.link && s.pendingSoNumber) ref += ' (ร่าง)';
  return { status: status, note: note, ref: ref };
}

// Project ID ที่จะโชว์/คัดลอกของ SO ใบนี้ — SO แบบโครงการเก็บไว้ที่ s.projectId ตรง ๆ แต่ SO แบบ Run rate
// เลข Project ID เป็นของถัง ไม่ใช่ของ SO (s.projectId จะถูกล้างทิ้งเสมอ ดู saveCreateSO/saveSOEdit) จึงต้องอ่านจาก s.runrateProjectId แทน
function _soDisplayProjectId(s) {
  return (s && (s.projectId || s.runrateProjectId)) || '';
}

// สรุปข้อมูล PO/SO ใบเดียว เป็นข้อความ copy วางส่งให้ Sales Support ได้เลย — ส่วนหัว/ยอดรวมเป็นข้อความตามเดิม
// ส่วนรายการสินค้าเป็น TSV (tab-separated) เพื่อวางใน Excel แล้วแยกคอลัมน์ได้ทันที (ต่อยอดจากไอเดีย mockup เดิม — ก่อนหน้านี้มีแต่ export รวมทุก SO)
function _soSummaryTextForSalesSupport(s) {
  var lines = [];
  lines.push('📄 สรุป PO/SO สำหรับ Sales Support');
  lines.push('SO/ร่าง: ' + (s.soNumber || '-') + (s.pendingSoNumber ? ' (ยังไม่ได้เลข SO จริง)' : ''));
  if (s.customerPO) lines.push('PO ลูกค้า: ' + s.customerPO);
  lines.push('Dealer: ' + (s.dealerName || '-'));
  if (s.projectName) lines.push('ชื่อโครงการ: ' + s.projectName);
  if (s.projectNumber) lines.push('เลขที่โครงการ: ' + s.projectNumber);
  var _soSumPid = _soDisplayProjectId(s);
  if (_soSumPid) lines.push('Project ID: ' + _soSumPid);
  if (s.remark) lines.push('Remark: ' + s.remark);
  if (s.deliveryAddress) lines.push('ที่อยู่จัดส่ง: ' + s.deliveryAddress);
  var creditReq = creditRequestOpenForSO(s.id);
  if (creditReq) {
    lines.push('เครดิต: ' + creditReq.status +
      (creditReq.creditDaysRequested ? ' ' + creditReq.creditDaysRequested + ' วัน' : '') +
      (creditReq.approvedBy ? ' (' + creditReq.approvedBy + ')' : ''));
  }
  lines.push('');
  lines.push('รายการสินค้า:');
  lines.push(['SKU', 'รายการสินค้า', 'จำนวน', 'ราคา/หน่วย', 'ราคารวม', 'สถานะสินค้า', 'หมายเหตุ', 'คอมเมนต์', 'ลิงก์จอง/อ้างอิง'].join('\t'));
  (s.items || []).forEach(function(it) {
    var qty = Number(it.qty) || 0;
    var price = Number(it.unitPrice) || 0;
    var info = _soSummaryItemStatusInfo(it, s);
    lines.push([
      it.sku || '-',
      it.model || '-',
      qty,
      price.toFixed(2),
      (qty * price).toFixed(2),
      info.status,
      info.note,
      (it.comment || '-').replace(/[\t\n\r]+/g, ' '),
      info.ref
    ].join('\t'));
  });
  var total = _poTrackerSOTotal(s);
  var vat = total * 7 / 100;
  lines.push('');
  lines.push('ยอดรวม (ไม่รวม VAT): ฿' + nmI(total));
  lines.push('VAT 7%: ฿' + nmI(vat));
  lines.push('ยอดรวม (รวม VAT): ฿' + nmI(total + vat));
  if (s.note) lines.push('หมายเหตุ: ' + s.note);
  return lines.join('\n');
}

function copySOSummaryForSalesSupport(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  copyText(_soSummaryTextForSalesSupport(s), '📋 คัดลอกสรุป PO/SO แล้ว — วางส่งให้ Sales Support ได้เลย');
}

// ยืนยันเลข SO จริงที่ได้กลับมาจาก Sales Support — ปิดสถานะร่าง pendingSoNumber
function showConfirmSoNumberM(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var h = '<div class="fm-group"><label>เลข SO จริง *</label><input type="text" id="cfSoNum" class="fm-input" value="' + sanitize(s.soNumber || '') + '"></div>' +
    '<button class="btn bp btn-full" onclick="confirmSoNumberFromSalesSupport(\'' + soId + '\')">✅ บันทึก</button>';
  openM('✅ ยืนยันเลข SO จาก Sales Support', h);
}

function confirmSoNumberFromSalesSupport(soId) {
  var soNumber = (document.getElementById('cfSoNum').value || '').trim();
  if (!soNumber) { toast('กรุณาใส่เลข SO'); return; }
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var logs = (s.logs || []).concat([{ date: _td(), action: '✅ ได้เลข SO จริงจาก Sales Support: ' + soNumber, note: '', by: (getConfig().saleName || '') }]);
  ST.update('salesOrders', soId, { soNumber: soNumber, pendingSoNumber: false, logs: logs, updatedAt: new Date().toISOString() });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', ST.getOne('salesOrders', soId));
  closeMForce();
  toast('✅ บันทึกเลข SO แล้ว');
  render();
}

var _SO_NUM_FIELD_BY_PREFIX = { SO: 'soNumber', INV: 'invoiceNumber', DO: 'doNumber' };
function _soNextNum(prefix) {
  var all = ST.getAll('salesOrders');
  var yr  = new Date().getFullYear();
  var re  = new RegExp('^' + prefix + '-\\d{4}-(\\d+)$');
  var max = 0;
  var field = _SO_NUM_FIELD_BY_PREFIX[prefix] || 'invoiceNumber';
  all.forEach(function(s) {
    var src = s[field];
    var m   = (src || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1]));
  });
  return prefix + '-' + yr + '-' + String(max + 1).padStart(3, '0');
}

// ================================================================
// Credit requests — แยกจาก salesOrders ตั้งใจ เพราะ 1 คำขออาจผูกได้หลาย SO/PO พร้อมกัน
// (เช่น ขอเครดิตรวม 3 โครงการ เทอมเดียวกัน อนุมัติเป็นเอกสารเดียว)
// ================================================================
var CREDIT_REQUEST_STATUSES = ['รอเสนอ', 'รออนุมัติ', 'อนุมัติแล้ว', 'ไม่อนุมัติ'];

function creditRequestsForSO(soId) {
  return ST.getAll('creditRequests').filter(function(cr) { return (cr.soIds || []).indexOf(soId) !== -1; });
}

// คำขอเครดิตล่าสุดที่ยังไม่ถูกปฏิเสธ ผูกกับ SO นี้ (ถ้ามีหลายใบเอาที่สร้างล่าสุด)
function creditRequestOpenForSO(soId) {
  var list = creditRequestsForSO(soId).filter(function(cr) { return cr.status !== 'ไม่อนุมัติ'; });
  list.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  return list[0] || null;
}

function _creditStatusColor(status) {
  if (status === 'อนุมัติแล้ว') return '#22c55e';
  if (status === 'ไม่อนุมัติ') return '#ef4444';
  if (status === 'รออนุมัติ') return '#f59e0b';
  return '#94a3b8';
}

function showSOCreditModal(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var existing = creditRequestOpenForSO(soId);
  var total = (s.items || []).reduce(function(sum, it) { return sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);

  // SO อื่นของ dealer เดียวกันที่ยังไม่ปิด — เลือกรวมขอเครดิตพร้อมกันได้ (เทอมเดียวกัน)
  var siblings = ST.getAll('salesOrders').filter(function(o) {
    return o.id !== soId && o.dealerId === s.dealerId && !_soIsDone(o.status);
  });

  var html = '<div style="display:flex;flex-direction:column;gap:10px">';
  if (existing) {
    html += '<div style="font-size:12px;color:var(--text2)">คำขอปัจจุบัน: <b style="color:' + _creditStatusColor(existing.status) + '">' + sanitize(existing.status) + '</b>' +
      (existing.approvedBy ? ' · ผู้อนุมัติ: ' + sanitize(existing.approvedBy) : '') + '</div>';
  }
  html += '<div><label class="lbl">จำนวนวันเครดิตที่ขอ</label><input id="cr_days" class="inp" type="number" min="0" value="' + (existing ? (existing.creditDaysRequested || '') : (s.creditDaysRequested || '')) + '"></div>';
  html += '<div><label class="lbl">ยอดรวม (THB)</label><input id="cr_amount" class="inp js-money" type="text" inputmode="decimal" value="' + nmI(existing ? existing.totalAmount : total) + '"></div>';
  if (siblings.length) {
    html += '<div><label class="lbl">รวมขอเครดิตพร้อมกับ SO อื่น (เลือกได้หลายรายการ)</label>';
    html += '<div style="max-height:140px;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:6px">';
    siblings.forEach(function(o) {
      var checked = existing && (existing.soIds || []).indexOf(o.id) !== -1 ? ' checked' : '';
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0"><input type="checkbox" class="cr_sib" value="' + o.id + '"' + checked + '> ' + sanitize(o.soNumber || o.id) + ' — ' + sanitize(o.customerPO || '-') + '</label>';
    });
    html += '</div></div>';
  }
  html += '<div><label class="lbl">สถานะ</label><select id="cr_status" class="inp">' +
    CREDIT_REQUEST_STATUSES.map(function(st) { return '<option' + (existing && existing.status === st ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select></div>';
  html += '<div><label class="lbl">ผู้อนุมัติ <small style="color:var(--text2)">(พิมพ์เอง เช่น "รอหัวหน้าอนุมัติ" หรือชื่อผู้อนุมัติ)</small></label><input id="cr_approver" class="inp" value="' + sanitize(existing ? (existing.approvedBy || '') : '') + '"></div>';
  html += '<button class="btn bp" onclick="saveSOCredit(\'' + soId + '\',\'' + (existing ? existing.id : '') + '\')">💾 บันทึก</button>';
  html += '</div>';
  openM('💳 คำขอเครดิต', html);
}

function saveSOCredit(soId, existingId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var soIds = [soId];
  document.querySelectorAll('.cr_sib:checked').forEach(function(el) { soIds.push(el.value); });
  var poNumbers = soIds.map(function(id) { var o = ST.getOne('salesOrders', id); return o ? (o.customerPO || o.soNumber || '') : ''; }).filter(Boolean);
  var fields = {
    soIds: soIds,
    poNumbers: poNumbers,
    creditDaysRequested: Number((document.getElementById('cr_days') || {}).value) || 0,
    totalAmount: parseNum((document.getElementById('cr_amount') || {}).value) || 0,
    status: (document.getElementById('cr_status') || {}).value,
    approvedBy: (document.getElementById('cr_approver') || {}).value.trim()
  };
  if (existingId) {
    ST.update('creditRequests', existingId, fields);
  } else {
    fields.createdAt = new Date().toISOString();
    ST.add('creditRequests', fields);
  }
  closeMForce();
  toast('💾 บันทึกคำขอเครดิตแล้ว');
  if (typeof rSODetail === 'function') rSODetail(document.getElementById('ct'));
}

// รายการ serial แบบเดียว (แทน serialsReceived/serialsShipped เดิม) — ของเก่ายังอ่านได้ผ่าน fallback นี้
// พอบันทึกซ้ำผ่านหน้าแก้ไข serial จะรวมเข้า it.serials ให้เองอัตโนมัติ ไม่ต้อง migrate ล่วงหน้า
function _soItemSerials(it) {
  if (it.serials) return it.serials;
  var merged = (it.serialsReceived || []).concat(it.serialsShipped || []);
  return merged.filter(function(sn, i) { return merged.indexOf(sn) === i; });
}

// Serial เฉพาะของรอบส่งมอบหนึ่ง (ไม่ใช่ทั้งหมดของ SO+SKU) — it.serials เป็น flat list ไม่แยกรอบ จึงอิงตำแหน่งสะสม
// เรียงตามลำดับรอบจริงจาก soSkuShipmentTimeline เหมือนที่ poTrackerExportInvoiceSNXlsx ใช้ (views-potracker.js) กันโชว์ serial ปนรอบกันเมื่อ SKU เดียวกันส่งมากกว่า 1 รอบ
function _soRoundItemSerials(soId, roundId, sku, allSerials) {
  var timeline = (typeof soSkuShipmentTimeline === 'function') ? soSkuShipmentTimeline(soId, sku) : [];
  var start = 0, qty = 0, found = false;
  timeline.forEach(function(round) {
    if (round.roundId === roundId) { qty = round.qty; found = true; }
    else if (!found) { start += round.qty; }
  });
  if (!found) return allSerials || [];
  return (allSerials || []).slice(start, start + qty);
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
    '<div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">' +
    '<button class="btn bsm' + (soViewMode==='card'?' bp':'') + '" style="border-radius:0" onclick="soViewMode=\'card\';render()">🗂️ Card</button>' +
    '<button class="btn bsm' + (soViewMode==='table'?' bp':'') + '" style="border-radius:0" onclick="soViewMode=\'table\';render()">📋 Table</button>' +
    '</div>' +
    '<button class="btn ' + (soSelectMode ? 'bd' : 'bo') + '" onclick="toggleSOSelectMode()">☑️ ' + (soSelectMode ? 'ยกเลิก' : 'เลือก') + '</button>' +
    '<button class="btn bp" onclick="showCreateSOModal({})">➕ สร้าง SO</button></div></div>';

  // ใช้ class .stat-good/.stat-warn/.stat-bad/.stat-info (มีอยู่แล้วใน style.css พร้อม Light Theme override)
  // แทนการเขียน hex+alpha ตรงๆ — ของเดิมไม่เคยมี Light Theme override เลยเพราะ hardcode ไว้ในโค้ด (2026-08-24 UI audit)
  var stats = [
    { label:'ทั้งหมด',      val: all.length,  cls:'stat-neutral' },
    { label:'Active',       val: activeCnt,   cls:'stat-info'    },
    { label:'พร้อมส่ง',     val: readyCnt,    cls:'stat-good'    },
    { label:'รอสินค้า',     val: waitCnt,     cls:'stat-warn'    },
    { label:'ต้องตาม',      val: attnCnt,     cls:'stat-bad'     }
  ];
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:16px">';
  stats.forEach(function(st){
    html += '<div class="' + st.cls + '" style="border-radius:10px;padding:12px 14px">' +
      '<div style="font-size:12px;opacity:.85;margin-bottom:4px">' + st.label + '</div>' +
      '<div style="font-size:22px;font-weight:600">' + st.val + '</div></div>';
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
  } else if (soViewMode === 'card') {
    html += _soCardsHtml(list);
  } else {
    html += _soTableHtml(list);
  }

  if (soSelectMode) {
    var selCnt = Object.keys(soSelected).length;
    html += '<div id="soSelBar" class="sel-bar" style="background:var(--card);border-top:2px solid var(--accent);padding:10px 14px;margin-top:12px;border-radius:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<span id="soSelCount" style="font-size:13px;font-weight:600;min-width:80px">' + selCnt + ' รายการที่เลือก</span>' +
      '<button class="btn bo bsm" onclick="toggleSOSelectAll(true)">เลือกทั้งหมด (' + _soVisibleIds.length + ')</button>' +
      '<button class="btn bo bsm" onclick="toggleSOSelectAll(false)">ยกเลิกเลือก</button>' +
      (function() {
        var opts = Object.keys(SO_STATUS).map(function(k) { return '<option value="' + k + '">' + SO_STATUS[k].icon + ' ' + SO_STATUS[k].label + '</option>'; }).join('');
        return '<select id="soSelStatusSel" ' + (!selCnt ? 'disabled' : '') + ' style="font-size:12px;min-width:140px"><option value="">✏️ เปลี่ยนสถานะ...</option>' + opts + '</select>' +
          '<button class="btn bo bsm" id="soSelStatusBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkChangeSOStatus()">ยืนยัน</button>';
      })() +
      '<button class="btn bo bsm" id="soSelExportBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkExportSO()">📥 Export ที่เลือก</button>' +
      '<button class="btn bo bsm" id="soSelReadyBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="showReadySummaryForSelectedSO()">📦 สรุปของพร้อมส่งให้ลูกค้า</button>' +
      '<button class="btn bd" id="soSelDelBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkDeleteSO()">🗑️ ลบที่เลือก (' + selCnt + ')</button>' +
      '<button class="btn bo bsm" style="margin-left:auto" onclick="toggleSOSelectMode()">✕ ออก</button>' +
      '</div>';
  }

  el.innerHTML = html;
}

// ตาราง SO — แยกออกมาจาก rSalesOrders() เดิม (ไม่เปลี่ยนพฤติกรรม) เพื่อสลับกับ _soCardsHtml() ได้
function _soTableHtml(list) {
  var html = '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px"><table style="width:100%;border-collapse:collapse;font-size:12px">';
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
        (s.status === 'so_open' && (s.prNumber || s.expectedDelivery) ?
          '<div style="font-size:10px;color:var(--text2);margin-top:2px">' + (s.prNumber ? 'PR: ' + sanitize(s.prNumber) : '') + (s.prNumber && s.expectedDelivery ? ' · ' : '') + (s.expectedDelivery ? 'ETA: ' + fD(s.expectedDelivery) : '') + '</div>' : '') +
        '</td>' +
      '<td style="padding:12px;text-align:right;color:var(--text2)">' + (soSelectMode ? '' : '›') + '</td>' +
      '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}
// มุมมองการ์ด — สำหรับมือถือ/จอแคบ ที่ scroll ตารางแนวนอนใช้งานยาก (เจอจากการสแกน UX 2026-08-23) เนื้อหา
// เดียวกับตาราง แค่จัดเป็นการ์ดต่อ SO 1 ใบ แทนแถวตาราง
function _soCardsHtml(list) {
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
  list.forEach(function(s) {
    var total  = (s.items||[]).reduce(function(sum,it){ return sum+(Number(it.qty)||0)*(Number(it.unitPrice)||0); },0);
    var models = (s.items||[]).map(function(it){ return it.model; }).filter(Boolean);
    var modelsTxt = models.length ? (models[0] + (models.length>1 ? ', +' + (models.length-1) + ' more' : '')) : '-';
    var days   = _soDaysInStage(s);
    var warn   = _soWarnBadge(s);
    var cardClick = soSelectMode ? "toggleSOSelect('" + s.id + "')" : "go('soDetail',{soId:'" + s.id + "'})";
    html += '<div class="card" style="position:relative;padding:14px;cursor:pointer;border:1px solid ' + (soSelected[s.id] ? 'var(--accent)' : 'var(--border)') + '" onclick="' + cardClick + '">';
    if (soSelectMode) html += '<input type="checkbox" id="soChk_' + s.id + '" ' + (soSelected[s.id] ? 'checked' : '') + ' onclick="event.stopPropagation();toggleSOSelect(\'' + s.id + '\')" style="position:absolute;top:12px;right:12px;width:18px;height:18px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">';
    html += '<div style="font-weight:800;font-size:14px">' + sanitize(s.soNumber || '-') + ' <span style="font-size:9px;padding:0 4px;border-radius:3px;background:var(--bg2);border:1px solid var(--border);font-weight:400">' + (s.type==='project'?'📋':'🏪') + '</span></div>';
    if (!soSelectMode) html += '<span style="color:var(--text2)">›</span>';
    html += '</div>';
    if (!_gvHidden('so_dealerInfo')) html += '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">' + sanitize(s.dealerName || '-') + (s.customerPO ? ' · PO ' + sanitize(s.customerPO) : '') + '</div>';
    html += '<div style="font-size:12px;color:var(--text2);margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(models.join(', ')) + '">📦 ' + sanitize(modelsTxt) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    html += '<div>' + _soStatusBadge(s.status) + (!_soIsDone(s.status) && days != null ? ' <span style="font-size:10px;color:var(--text2)">' + days + ' วัน</span>' : '') + (warn ? ' ' + warn : '') + '</div>';
    if (!_gvHidden('so_price')) html += '<div style="font-weight:800;color:#22c55e;font-size:14px">' + (total ? fmtMoneyShort(total) : '-') + '</div>';
    html += '</div>';
    html += _soProgressBar(s.status);
    if (s.status === 'so_open' && (s.prNumber || s.expectedDelivery)) {
      html += '<div style="font-size:10px;color:var(--text2);margin-top:6px">' + (s.prNumber ? 'PR: ' + sanitize(s.prNumber) : '') + (s.prNumber && s.expectedDelivery ? ' · ' : '') + (s.expectedDelivery ? 'ETA: ' + fD(s.expectedDelivery) : '') + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
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
  var readyBtn = document.getElementById('soSelReadyBtn');
  if (readyBtn) readyBtn.disabled = !cnt;
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
  ensureXLSX().then(function() {
    _bulkExportSO_impl();
  }).catch(function(e) {
    if (typeof toast === 'function') toast('⚠️ โหลดไลบรารีไม่สำเร็จ: ' + (e && e.message || e), true);
  });
}

function _bulkExportSO_impl() {
  var ids = Object.keys(soSelected);
  if (!ids.length) return;
  var list = ids.map(function(id) { return ST.getOne('salesOrders', id); }).filter(Boolean);
  var headers = ['SO No.', 'Dealer', 'เลขที่โครงการ (Project ID)', 'ชื่อโครงการ', 'สถานะ', 'สินค้า', 'มูลค่า', 'PO', 'Invoice', 'สร้างเมื่อ'];
  var rows = [headers].concat(list.map(function(s) {
    var total = (s.items || []).reduce(function(sum, it) { return sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);
    var models = (s.items || []).map(function(it) { return it.model; }).filter(Boolean).join(', ');
    var pid = (typeof _soDisplayProjectId === 'function' ? _soDisplayProjectId(s) : (s.projectId || s.runrateProjectId || ''));
    return [s.soNumber || '', s.dealerName || '', pid, s.projectName || '', (SO_STATUS[s.status] || {}).label || s.status || '', models, total, s.customerPO || '', s.invoiceNumber || '', s.createdAt ? s.createdAt.slice(0, 10) : ''];
  }));
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
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
  if (typeof _stockLastSOId !== 'undefined') _stockLastSOId = soId; // จำ SO ล่าสุดที่เปิดดู ไว้แนะนำตอนย้ายคลังจากหน้า Stock หลัก
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
  if (s.pendingSoNumber) html += '<span style="font-size:10px;padding:2px 8px;border-radius:10px;border:1px solid #f59e0b55;background:#f59e0b22;color:#f59e0b;white-space:nowrap">🕗 รอเลข SO จาก Sales Support</span>';
  html += '</div>';
  if (!_gvHidden('so_dealerInfo')) html += '<div style="font-size:13px;color:var(--text2)">🏪 ' + sanitize(dealer ? dealer.name : (s.dealerName||'-')) + '</div>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  html += '<button class="btn bo bsm" onclick="showSOEditModal(\'' + s.id + '\')">✏️ แก้ไข</button>';
  if (nexts.length) html += '<button class="btn bp bsm" onclick="showSOStatusModal(\'' + s.id + '\')">🔄 อัปเดตสถานะ</button>';
  if (_soPrevStatusFromLogs(s)) html += '<button class="btn bo bsm" onclick="revertSOStatus(\'' + s.id + '\')" title="ย้อนสถานะกลับไปขั้นก่อนหน้า เผื่อกดผิด">↩️ ย้อนกลับสถานะ</button>';
  html += '<button class="btn bo bsm" onclick="copySOSummaryForSalesSupport(\'' + s.id + '\')">📋 Copy สรุปส่ง Sales Support</button>';
  html += '<button class="btn bd bsm" onclick="deleteSalesOrder(\'' + s.id + '\')" title="ลบ SO">🗑️</button>';
  html += '</div></div>';
  if (s.pendingSoNumber) {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:8px 10px;margin-top:8px">';
    html += '<span style="font-size:12px;color:#f59e0b">🕗 ใบนี้ยังเป็นร่าง รอเลข SO จริงจาก Sales Support — เลขที่กรอกไว้ตอนนี้เป็นแค่เลขชั่วคราว</span>';
    html += '<button class="btn bp bsm" onclick="showConfirmSoNumberM(\'' + s.id + '\')">✅ ได้เลข SO แล้ว</button>';
    html += '</div>';
  }

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
  if (s.customerPODate && !_gvHidden('so_dealerInfo')) infoCells.push({ label:'📅 วันที่ PO ลูกค้า', val: fD(s.customerPODate) });
  var _soDetailPid = _soDisplayProjectId(s);
  if (_soDetailPid)       infoCells.push({ label:'Project ID',    val: qcopyHtml(_soDetailPid) });
  if (s.prNumber)         infoCells.push({ label:'PR ภายใน',      val: qcopyHtml(s.prNumber) });
  if (s.projectName)      infoCells.push({ label:'📁 ชื่อโครงการ',   val: sanitize(s.projectName) });
  if (s.projectNumber)    infoCells.push({ label:'🔢 เลขที่โครงการ', val: sanitize(s.projectNumber) });
  if (pipe)               infoCells.push({ label:'Pipeline',      val: '<a href="#" onclick="go(\'pipeDetail\',{pipeId:\'' + s.pipelineId + '\'});return false" style="color:var(--accent)">' + sanitize((pipe.projectName||s.pipelineId).substr(0,26)) + '</a>' });
  if (s.quotationId) {
    var _soQuote = (typeof getQuoteById === 'function') ? getQuoteById(s.quotationId) : null;
    infoCells.push({ label:'Quotation', val: '<a href="#" onclick="editQuotation(\'' + s.quotationId + '\');return false" style="color:var(--accent)">' + sanitize(_soQuote ? _soQuote.quoteNo : s.quotationId) + '</a>' });
  }
  if (s.deliveryAddress)  infoCells.push({ label:'📍 ที่อยู่จัดส่ง', val: '<span style="white-space:pre-wrap">' + sanitize(s.deliveryAddress) + '</span>' });
  var _soHdrRound = (s.doNumber || s.invoiceNumber) ? _soHeaderShipmentRound(s) : null;
  var _soHdrViewLink = _soHdrRound ? ' <a href="#" onclick="showInvoiceDetailModal(\'' + s.id + '\',\'' + _soHdrRound.id + '\');return false" title="ดูรายละเอียด Invoice/DO รอบนี้ (รายการ+ราคา+Serial)" style="margin-left:2px">🔎</a>' : '';
  if (s.doNumber)         infoCells.push({ label:'DO',            val: qcopyHtml(s.doNumber) + _soHdrViewLink });
  if (s.invoiceNumber)    infoCells.push({ label:'Invoice',       val: qcopyHtml(s.invoiceNumber) + (s.invoiceDate ? ' <span style="color:var(--text2);font-size:11px">(' + fD(s.invoiceDate) + ')</span>' : '') + _soHdrViewLink });
  if (s.expectedDelivery) infoCells.push({ label:'ETA Vendor',    val: fD(s.expectedDelivery) });
  if (!_soIsDone(s.status) && _soDays != null) infoCells.push({ label:'อยู่ในขั้นนี้',   val: _soDays + ' วัน' });
  if (s.dueDate)          infoCells.push({ label:'ต้องติดตามภายใน', val: '<b>' + fD(s.dueDate) + '</b>' });
  if (s.remark)            infoCells.push({ label:'📝 Remark',       val: '<span style="white-space:pre-wrap">' + sanitize(s.remark) + '</span>' });

  if (infoCells.length) {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;padding-top:14px;margin-top:10px;border-top:1px solid var(--border)">';
    infoCells.forEach(function(c){
      html += '<div><div style="font-size:11px;color:var(--text2);margin-bottom:3px">' + c.label + '</div><div style="font-size:13px">' + c.val + '</div></div>';
    });
    html += '</div>';
  }
  // คำขอเครดิต — ผูกได้กับหลาย SO พร้อมกัน (ดู creditRequestsForSO)
  var creditReq = creditRequestOpenForSO(s.id);
  html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-top:14px;margin-top:10px;border-top:1px solid var(--border)">';
  html += '<div style="font-size:12px">💳 เครดิต: ' + (creditReq ?
    '<b style="color:' + _creditStatusColor(creditReq.status) + '">' + sanitize(creditReq.status) + '</b>' +
    (creditReq.creditDaysRequested ? ' · ' + creditReq.creditDaysRequested + ' วัน' : '') +
    (creditReq.approvedBy ? ' · ' + sanitize(creditReq.approvedBy) : '') +
    (creditReq.soIds && creditReq.soIds.length > 1 ? ' · รวม ' + creditReq.soIds.length + ' SO' : '') :
    '<span style="color:var(--text2)">ยังไม่ได้ขอ</span>') + '</div>';
  html += '<button class="btn bo bsm" onclick="showSOCreditModal(\'' + s.id + '\')">' + (creditReq ? '✏️ แก้ไขคำขอเครดิต' : '💳 ขอเครดิต') + '</button>';
  html += '</div>';

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
  if (!_soIsDone(s.status)) html += '<button class="btn bo bsm" onclick="showSOBulkExtendBookingM(\'' + s.id + '\')" title="เลื่อนกำหนดจองคลังหลายรายการพร้อมกันในครั้งเดียว">📅 เลื่อนจองหลายรายการ</button>';
  html += '<button class="btn bo bsm" onclick="showSOEditSerialsModal(\'' + s.id + '\')" title="แก้ไข Serial ได้ทุกเมื่อ ไม่ต้องรอเปลี่ยนสถานะ">🔢 แก้ไข Serial</button>';
  html += '</span>';
  html += '</div>';
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<thead><tr style="background:var(--bg2);text-align:left">' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">#</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">สินค้า</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">SKU</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2);text-align:center">จำนวน</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2);text-align:right">ราคา/หน่วย</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2);text-align:right">รวม</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">Serial</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">ความพร้อมส่ง</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">คอมเมนต์</th>' +
    '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">ลิงก์</th></tr></thead><tbody>';
  (s.items||[]).forEach(function(it,idx){
    var lineTotal = (Number(it.qty)||0)*(Number(it.unitPrice)||0);
    var sns = _soItemSerials(it);
    var _esc = function(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); };
    html += '<tr style="border-top:1px solid var(--border)">';
    html += '<td style="padding:10px">' + (idx+1) + '</td>';
    html += '<td style="padding:10px"><b>' + sanitize(it.model||'-') + '</b></td>';
    html += '<td style="padding:10px;font-size:11px;font-family:monospace">' + (it.sku ? qcopyHtml(it.sku) : '<span style="color:var(--text2)">-</span>') + '</td>';
    html += '<td style="padding:10px;text-align:center">' + (it.qty||0) + '</td>';
    html += '<td style="padding:10px;text-align:right">' + (_gvHidden('so_price') ? '-' : fmtMoney(Number(it.unitPrice)||0)) + '</td>';
    html += '<td style="padding:10px;text-align:right">' + (_gvHidden('so_price') ? '-' : fmtMoney(lineTotal)) + '</td>';
    html += '<td style="padding:10px;font-size:10px">' + (sns.length ? sns.map(function(sn){ return '<span style="display:inline-block;background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:0 4px;margin:1px;font-family:monospace">'+qcopyHtml(sn)+'</span>'; }).join('') + (sns.length>1?' <button class="qcopy-btn" style="opacity:.6;position:static" title="คัดลอกทั้งหมด" onclick="copyToClip(\''+_esc(sns.join(', '))+'\')">📋all</button>':'') : '<span style="color:var(--text2)">-</span>') + '</td>';
    html += '<td style="padding:10px;min-width:150px">' + (typeof stockSOItemReadinessHtml === 'function' ? stockSOItemReadinessHtml(it.sku, it.qty, s, it) : '') +
      (!_soIsDone(s.status) ? '<button class="btn bsm bo" style="font-size:10px;padding:2px 7px;margin-top:4px" onclick="showSOItemStatusM(\'' + s.id + '\',' + idx + ')" title="อัปเดตสถานะรายการนี้โดยไม่ต้องเปิดหน้าแก้ไขรายการทั้งหมด">🏷️ อัปเดตสถานะ</button>' : '') +
      '</td>';
    html += '<td style="padding:10px;min-width:140px"><input type="text" value="' + sanitize(it.comment || '') + '" placeholder="พิมพ์โน้ต..." style="width:100%;font-size:11px" onblur="saveSOItemComment(\'' + s.id + '\',' + idx + ',this.value)"></td>';
    var itLinkSafe = /^https?:\/\//i.test(it.link || '') ? it.link : '';
    html += '<td style="padding:10px;min-width:150px"><input type="text" value="' + sanitize(it.link || '') + '" placeholder="วางลิงก์..." style="width:100%;font-size:11px" onblur="saveSOItemLink(\'' + s.id + '\',' + idx + ',this.value)">' +
      (itLinkSafe ? '<a href="' + sanitize(itLinkSafe) + '" target="_blank" rel="noopener" style="font-size:10px;color:var(--accent);display:inline-block;margin-top:3px">🔗 เปิดลิงก์</a>' : '') + '</td>';
    html += '</tr>';
  });
  html += '<tr style="font-weight:600;background:var(--bg2);border-top:1px solid var(--border)"><td colspan="5" style="padding:10px;text-align:right">รวมทั้งสิ้น</td>';
  html += '<td style="padding:10px;text-align:right">' + (_gvHidden('so_price') ? '-' : fmtMoney(total)) + '</td><td colspan="4"></td></tr>';
  html += '</tbody></table></div></div>';

  // การส่งมอบ — เทียบจำนวนตาม PO ลูกค้ากับที่ส่งไปแล้วจริงต่อรายการ รองรับแบ่งส่งหลายรอบ (ไม่ต้องรอของครบ)
  if ((s.items || []).some(function(it) { return it.sku; }) && !_soIsDone(s.status)) {
    var shipProg = soComputeShipmentProgress(s);
    var shipments = _soMigrateLegacyShipment(s);
    html += '<div class="card" style="margin-bottom:12px;padding:18px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:6px">';
    html += '<h3 style="margin:0;font-size:15px">🚚 การส่งมอบ</h3>';
    if (!shipProg.allDelivered) html += '<button class="btn bp bsm" onclick="showSORecordShipmentModal(\'' + s.id + '\')">📦 บันทึกการส่งมอบรอบนี้</button>';
    html += '</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr style="background:var(--bg2);text-align:left">' +
      '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">สินค้า</th>' +
      '<th style="padding:8px 10px;font-weight:600;color:var(--text2);text-align:center">ตาม PO</th>' +
      '<th style="padding:8px 10px;font-weight:600;color:var(--text2);text-align:center">ส่งแล้ว</th>' +
      '<th style="padding:8px 10px;font-weight:600;color:var(--text2);text-align:center">คงค้าง</th>' +
      '<th style="padding:8px 10px;font-weight:600;color:var(--text2)">ความคืบหน้า</th></tr></thead><tbody>';
    shipProg.items.forEach(function(x) {
      if (!x.tracked) return;
      var pct = x.poQty ? Math.round(x.deliveredQty / x.poQty * 100) : 100;
      var barColor = x.deliveredQty >= x.poQty ? '#22c55e' : (x.deliveredQty > 0 ? '#f59e0b' : 'var(--border)');
      html += '<tr style="border-top:1px solid var(--border)">';
      html += '<td style="padding:8px 10px"><b>' + sanitize(x.model || '-') + '</b></td>';
      html += '<td style="padding:8px 10px;text-align:center">' + x.poQty + '</td>';
      html += '<td style="padding:8px 10px;text-align:center">' + x.deliveredQty + '</td>';
      html += '<td style="padding:8px 10px;text-align:center;' + (x.remainingQty > 0 ? 'color:#f59e0b;font-weight:600' : '') + '">' + x.remainingQty + '</td>';
      html += '<td style="padding:8px 10px;min-width:140px"><div style="height:6px;border-radius:3px;background:var(--bg2);overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + barColor + '"></div></div>';
      if (x.remainingQty > 0 && x.readyToShipQty > 0) html += '<div style="font-size:10px;color:var(--text2);margin-top:3px">พร้อมส่งอีก ' + x.readyToShipQty + '</div>';
      html += '</td></tr>';
    });
    html += '</tbody></table></div>';
    if (shipments.length) {
      html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
      html += '<div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">ประวัติการส่งมอบ</div>';
      shipments.slice().reverse().forEach(function(sh, i) {
        var roundNo = shipments.length - i;
        var itemsTxt = (sh.items || []).map(function(it) { return sanitize(it.model || it.sku) + ' × ' + it.qty; }).join(', ');
        html += '<div style="font-size:11.5px;padding:6px 0;' + (i < shipments.length - 1 ? 'border-bottom:1px solid var(--border)' : '') + '">';
        html += '<b>รอบที่ ' + roundNo + '</b> — ' + (sh.date ? fD(sh.date) : '-');
        if (sh.doNumber) html += ' · DO ' + qcopyHtml(sh.doNumber);
        if (sh.invoiceNumber) html += ' · INV ' + qcopyHtml(sh.invoiceNumber);
        if (sh.doNumber || sh.invoiceNumber) html += ' <a href="#" onclick="showInvoiceDetailModal(\'' + s.id + '\',\'' + sh.id + '\');return false" title="ดูรายละเอียดรอบนี้">🔎</a>';
        if (itemsTxt) html += '<div style="color:var(--text2)">' + itemsTxt + '</div>';
        if (sh.note) html += '<div style="color:var(--text2)">📝 ' + sanitize(sh.note) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
  }

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
  // won projects + project ที่ผูกกับใบเสนอราคา/ที่ส่งมา (แม้ยังไม่ถึงสถานะ won) จะได้ preselect ได้
  var wonPipes = ST.getAll('pipeline').filter(function(p){
    return pipeIsWon(p) || p.id === opts.pipelineId;
  }).sort(function(a,b){ return (a.projectName||'') > (b.projectName||'') ? 1 : -1; });

  var preDealerId = (pipe && pipe.dealerId) || opts.dealerId || '';
  var preDealer = preDealerId ? ST.getOne('dealers', preDealerId) : null;
  var preRunrate = opts.runrateId ? ST.getOne('runrate', opts.runrateId) : null;
  // เปิดฟอร์มมาพร้อม quotationId อยู่แล้ว (เช่นจากปุ่ม "สร้าง SO" ในหน้าใบเสนอราคา) — โหลดมาเช็คส่วนลด/
  // เงื่อนไขชำระเงินเริ่มต้นให้ตรงกับใบเสนอราคาตั้งแต่เปิดฟอร์ม ไม่ต้องรอ onchange ของ select ใบเสนอราคา
  var preQuote = null;
  if (opts.quotationId) {
    try {
      var _preQAll = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]');
      preQuote = _preQAll.filter(function(x) { return x.id === opts.quotationId; })[0] || null;
    } catch (e) {}
  }

  var pipeOpts = '<option value="">-- ไม่ระบุ / เลือกทีหลัง --</option>';
  wonPipes.filter(function(p){ return !preDealerId || p.dealerId === preDealerId; }).forEach(function(p){
    var d = ST.getOne('dealers', p.dealerId);
    var sel = (opts.pipelineId === p.id) ? ' selected' : '';
    pipeOpts += '<option value="' + p.id + '"' + sel + '>' +
      sanitize(pipeRowPrefix(p) + (p.projectName||'').substr(0,40)) +
      (d ? ' [' + sanitize(d.name) + ']' : '') +
      '</option>';
  });

  // ประเภทที่ส่งมาจากใบเสนอราคามาก่อน แล้วค่อยเดาจาก pipelineId ที่ส่งมา — ไม่งั้นใบเสนอราคาแบบ run rate
  // ที่ยังไม่ได้ผูกถังจะเปิดมาเป็นโหมดโครงการแล้วเลขที่กรอกไว้หาย
  var initType = opts.linkType || (opts.pipelineId ? 'project' : 'runrate');

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

  // Dealer ก่อน — พิมพ์ชื่อได้ search & suggest แบบ dropdown ที่ขึ้นทันทีตั้งแต่พิมพ์ตัวแรก (ac-wrap/ac-menu
  // เดียวกับที่ใช้ในฟอร์ม Visit Plan ไม่ใช่ native <datalist> ที่บางเบราว์เซอร์ต้องกดลูกศรเองก่อนถึงจะโชว์)
  // กรองแล้วเติม project ให้เฉพาะของ dealer นั้น เลือก dealer ที่มีอยู่แล้ว → hidden soN_dealerId จะถูกเติมให้
  // (ดู _soDealerNameChanged) พิมพ์ชื่อใหม่ที่ไม่มีในระบบก็ปล่อยไว้ — ตอนกด "สร้าง SO" จะถามว่าต้องการสร้าง
  // Dealer ใหม่ไหม (level Other ไว้ก่อน)
  html += '<div class="ac-wrap"><label class="lbl">Dealer *</label>' +
    '<input id="soN_dealerName" class="inp" autocomplete="off" placeholder="พิมพ์ชื่อ Dealer..." value="' + sanitize(preDealer ? preDealer.name : '') + '" oninput="_soDealerNameChanged(this.value);_soDealerSearch(this.value)" onfocus="_soDealerSearch(this.value)" onchange="_soDealerNameChanged(this.value)">' +
    '<div id="soN_dealerAcMenu"></div>' +
    '<input type="hidden" id="soN_dealerId" value="' + sanitize(preDealerId) + '"></div>';

  // project picker (แสดงเมื่อ type=project) — กรองตาม dealer
  html += '<div id="soN_pipeSec"' + (initType!=='project'?' style="display:none"':'') + '>';
  html += '<label class="lbl">Pipeline Project <span style="font-size:10px;color:var(--text2)">(เฉพาะ Win / Contracting / Deliver)</span></label>';
  html += '<select id="soN_pipelineId" class="inp" onchange="_soFillFromPipe(this.value)">' + pipeOpts + '</select>';
  // Project ID — ดึงมาจาก Pipeline ที่เลือก ถ้าโครงการนั้นยังไม่มี กรอกตรงนี้ได้เลยแล้วเขียนกลับไปให้
  // (ในแอปนี้ "มี Project ID = ถือว่าลงทะเบียน CRM แล้ว" จึงต้องตั้ง djiCrmRegistered ตามไปด้วยเสมอ)
  html += '<div class="ac-wrap" style="margin-top:8px"><label class="lbl">Project ID ' +
    '<span style="font-size:10px;color:var(--text2)">(' + PROJECT_ID_HINT + ' — พิมพ์เองได้เลย หรือเลือกจาก Project ID เดิมที่เคยใช้กับ Dealer นี้)</span></label>' +
    '<input id="soN_projectId" class="inp" autocomplete="off" value="' + sanitize(pidNorm(opts.projectId) || (pipe && pipe.projectId) || '') + '" placeholder="20260912-0005 — ยังไม่มีจนกว่าจะลงทะเบียน CRM" oninput="_soProjIdTouched();_soProjectIdSearch(this.value)" onfocus="_soProjectIdSearch(this.value)">' +
    '<div id="soN_projectIdAcMenu"></div>' +
    '<div id="soN_projIdNote" class="hint" style="font-size:11px;margin-top:3px"></div></div>';
  html += '</div>';

  // ถัง Run rate — SO แบบ run rate ผูกเข้า Project ID ที่ลูกค้าสร้างไว้รับยอด (ถังเดียวมีได้หลาย SO)
  // แสดงเฉพาะตอน type = runrate เพราะ SO แบบโครงการใช้ Pipeline Project แทน
  html += '<div id="soN_rrSec"' + (initType !== 'runrate' ? ' style="display:none"' : '') + '>';
  html += '<div class="ac-wrap"><label class="lbl">Project ID (Run rate) ' +
    '<span style="font-size:10px;color:var(--text2)">(เลขที่ลูกค้าสร้างไว้รับยอด — พิมพ์เลขเดิมที่เคยใช้กับ Dealer นี้เพื่อเลือก หรือพิมพ์เลขใหม่เพื่อสร้างถังใหม่ตอนบันทึก)</span></label>' +
    '<input id="soN_runrateProjectId" class="inp" autocomplete="off" value="' + sanitize((preRunrate && preRunrate.projectId) || (initType === 'runrate' ? pidNorm(opts.projectId) : '') || '') + '" placeholder="20260912-0005" oninput="_soRunrateProjIdTouched();_soRunrateSearch(this.value)" onfocus="_soRunrateSearch(this.value)">' +
    '<div id="soN_runrateAcMenu"></div>' +
    '<input type="hidden" id="soN_runrateId" value="' + sanitize(opts.runrateId || '') + '"></div>';
  html += '<div id="soN_rrNote" class="hint" style="font-size:11px;margin-top:3px"></div></div>';

  // ใบเสนอราคา — กรองตาม dealer/project ที่เลือก เลือกแล้วดึงรายการสินค้ามาเติมให้ ไม่เลือกก็สร้าง SO ตรงได้ (จะสร้างใบเสนอราคาใหม่ให้อัตโนมัติตอนบันทึก)
  html += '<div><label class="lbl">ใบเสนอราคา <span style="font-size:10px;color:var(--text2)">(เลือกเพื่อดึงรายการมา หรือไม่เลือกก็สร้าง SO ตรงได้)</span></label>';
  html += '<select id="soN_quoteSel" class="inp" onchange="_soFillFromQuote(this.value)">' + _soQuotationOptionsHtml(preDealerId, opts.pipelineId) + '</select></div>';
  html += '<input type="hidden" id="soN_quotationId" value="' + sanitize(opts.quotationId||'') + '">';

  html += '<div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">เลข PO ลูกค้า</label><input id="soN_customerPO" class="inp" value="' + sanitize(opts.customerPO||'') + '" placeholder="เช่น PO-ABC-2026-001"></div>';
  html += '<div style="flex:1"><label class="lbl">📅 วันที่ PO ลูกค้า</label><input id="soN_customerPODate" class="inp" type="date" value="' + sanitize(opts.customerPODate||'') + '"></div>';
  html += '</div>';

  // เงื่อนไขชำระเงิน — เลือกใบเสนอราคาแล้วดึงมาจากใบนั้นก่อน (ดู _soFillFromQuote) ไม่งั้นดึงจาก Dealer ที่เลือก
  // เป็นค่าเริ่มต้น (ดู _soDealerNameChanged) แก้ตรงนี้ได้ แล้วตอนบันทึกจะเขียนกลับไปทั้งใบเสนอราคาและ Dealer
  // (ดู saveCreateSO) — ป้าย "ส่วนลด" ขึ้นเองเมื่อใบเสนอราคาที่เลือกมีส่วนลด (ดู _soUpdateDiscountBadge)
  html += '<div><label class="lbl">💳 เงื่อนไขชำระเงิน <span id="soN_discountBadge">' + _soDiscountBadgeHtml(preQuote) + '</span></label><input id="soN_paymentTerm" class="inp" list="soN_paymentTermDL" autocomplete="off" value="' +
    sanitize(opts.paymentTerm || (preQuote && preQuote.paymentTerm) || (preDealer && preDealer.creditTerm) || '') + '" placeholder="เช่น เครดิต 30 วัน">' +
    _soPaymentTermDatalistHtml('soN_paymentTermDL') + '</div>';

  // ที่อยู่จัดส่ง — ดึงจากที่อยู่ที่บันทึกไว้ที่ dealer (เลือกได้หลายที่ ถ้ามี) หรือพิมพ์เองก็ได้ถ้ายังไม่มีในระบบ
  // พิมพ์เองแล้วบันทึก SO จะเก็บที่อยู่นี้ไว้ที่ Dealer ให้ด้วย (ดู saveCreateSO) ครั้งหน้าจะเลือกจาก dropdown ได้เลย
  html += '<div><label class="lbl">📍 ที่อยู่จัดส่ง</label><select id="soN_addressSel" class="inp" onchange="_soAddressSelChanged(this.value)">' + _soAddressOptionsHtml(preDealerId, opts.deliveryAddress) + '</select>';
  html += '<textarea id="soN_deliveryAddress" class="inp" rows="2" style="margin-top:6px" placeholder="หรือพิมพ์ที่อยู่จัดส่งเอง...">' + sanitize(opts.deliveryAddress||'') + '</textarea></div>';

  // สถานะ "ยังไม่ได้เลข SO จริง" — ใช้ตอนกรอกข้อมูลส่งให้ Sales Support ก่อน ยังไม่ได้เลข SO กลับมา (กันชนกับเลขจริงที่จะออกทีหลัง)
  html += '<div class="fm-group" style="background:var(--bg2);border-radius:8px;padding:8px 10px">' +
    '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="soN_pendingSoNum"> <span>🕗 ยังไม่ได้เลข SO จริงจาก Sales Support (กรอกไว้เป็นร่างก่อน ใส่เลขจริงได้ทีหลัง)</span></label></div>';

  // items
  html += buildAdminModelDatalist('soItemModelDL');
  html += '<div><label class="lbl">รายการสินค้า *</label><div id="soN_items">';
  var initItems = (opts.presetItems && opts.presetItems.length) ? opts.presetItems
    : (pipe && pipe.model
      ? [{ model: pipe.model, qty: 1, unitPrice: Number(pipe.forecastAmount)||0 }]
      : [{ model: '', qty: 1, unitPrice: 0 }]);
  initItems.forEach(function(it, idx){ html += _soItemRowHtml(idx, it.model, it.qty, it.unitPrice, it.sku, it); });
  html += '</div><button class="btn bo bsm" onclick="_soAddItemRow()" style="margin-top:4px">+ เพิ่มสินค้า</button> ' +
    '<button class="btn bo bsm" onclick="_soCheckStockNow()" style="margin-top:4px">🔎 เช็คสต็อกตอนนี้</button>' +
    '<div id="soN_stockCheck" style="margin-top:8px"></div></div>';

  html += '<div><label class="lbl">หมายเหตุ</label><textarea id="soN_note" class="inp" rows="2" placeholder="หมายเหตุเพิ่มเติม..."></textarea></div>';
  html += '<button class="btn bp" onclick="saveCreateSO()">💾 สร้าง SO</button></div>';

  openM('➕ สร้าง Sales Order', html);
  // ถ้ามาจาก "สร้าง SO จากใบเสนอราคา" อยู่แล้ว รายการเริ่มต้น = รายการของใบเสนอราคานั้น เก็บไว้เทียบตอนบันทึกว่าแก้ไปไหม
  window._soQuoteItemsSnapshot = opts.quotationId ? JSON.stringify(initItems) : null;
  _soProjIdDirty = false;
  _soProjIdNote();
  _soRunrateProjIdDirty = false;
  if (preRunrate) _soRRPick(preRunrate.id);
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
  if (!quoteId) { _soUpdateDiscountBadge(null); return; }
  var all = [];
  try { all = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch (e) {}
  var q = all.filter(function(x) { return x.id === quoteId; })[0];
  if (!q) { _soUpdateDiscountBadge(null); return; }
  var wrap = document.getElementById('soN_items');
  if (!wrap) return;
  wrap.innerHTML = '';
  _soIC = 0;
  // ใช้รายการสินค้าหลังหักส่วนลด (เงินสดต่อรายการ + ส่วนลดอื่นๆ + ส่วนลดท้ายบิล) ให้ตรงกับยอดในใบเสนอราคา
  // เป๊ะๆ — คำนวณด้วยสูตรเดียวกับหน้าใบเสนอราคา (ดู _soQuoteDiscountedItems / computeQuoteTotals)
  var discItems = (typeof _soQuoteDiscountedItems === 'function') ? _soQuoteDiscountedItems(q) : (q.items || []);
  var items = (discItems && discItems.length) ? discItems.map(function(it) {
    // เก็บ cashDiscountPercent/_origUnitPrice ที่ _soQuoteDiscountedItems คำนวณไว้ต่อด้วย ไม่งั้นข้อมูลส่วนลด
    // เงินสดต่อรายการจะหายไปตรงนี้ เหลือแต่ราคาสุทธิเฉยๆ ให้แถวสินค้าโชว์ไม่ได้ว่าลดไปแล้วเท่าไหร่ (ดู _soItemRowHtml)
    return { model: it.name || it.model || '', qty: Number(it.quantity || it.qty) || 1, unitPrice: Number(it.unitPrice) || 0, sku: it.sku || '',
      cashDiscountPercent: Number(it.cashDiscountPercent) || 0, _origUnitPrice: Number(it._origUnitPrice) || 0 };
  }) : [{ model: '', qty: 1, unitPrice: 0 }];
  items.forEach(function(it, idx) { wrap.innerHTML += _soItemRowHtml(idx, it.model, it.qty, it.unitPrice, it.sku, it); });
  window._soQuoteItemsSnapshot = JSON.stringify(items);
  var poEl = document.getElementById('soN_customerPO');
  if (poEl && !poEl.value && q.poNo) poEl.value = q.poNo;

  // เงื่อนไขชำระเงิน — ใบเสนอราคามีระบุไว้แล้วก็ดึงมาเลย ถ้าไม่มีก็ปล่อยให้เลือก/พิมพ์เองที่หน้านี้ (ตอนบันทึก
  // จะเขียนกลับไปที่ใบเสนอราคาให้ด้วย ดู _soSyncQuoteItems)
  var ptEl = document.getElementById('soN_paymentTerm');
  if (ptEl && q.paymentTerm) ptEl.value = q.paymentTerm;
  _soUpdateDiscountBadge(q);

  // ใบเสนอราคาถือการผูกงานไว้แล้ว (โครงการ/ถัง + Project ID) — ดึงตามมาให้ครบ ไม่ต้องเลือกซ้ำ
  // ไม่ทับ Project ID ที่ผู้ใช้พิมพ์เองไว้ ด้วยเหตุผลเดียวกับตอนเลือกโครงการ (_soFillFromPipe)
  var qType = q.linkType || (q.runrateId ? 'runrate' : (q.pipelineId ? 'project' : ''));
  if (qType) {
    var tSel = document.getElementById('soN_type');
    if (tSel && tSel.value !== qType) { tSel.value = qType; _soTypeToggle(qType); }
  }
  // ตั้ง select.value ที่ไม่มี option นั้นอยู่จริง เบราว์เซอร์จะเงียบๆ เปลี่ยนเป็นค่าว่าง — เกิดได้จริงเมื่อ
  // ใบเสนอราคาผูกโครงการที่ยังไม่ Win (ลิสต์เอาเฉพาะ Win/Contracting/Deliver) หรือผูกถังที่ถูกปิดไปแล้ว
  // ถ้าไม่บอก ผู้ใช้จะเปิด SO โดยคิดว่าผูกอยู่ทั้งที่หลุดไปแล้ว
  var lost = [];
  if (q.pipelineId) {
    var pSel = document.getElementById('soN_pipelineId');
    if (pSel) {
      pSel.value = q.pipelineId;
      if (pSel.value !== q.pipelineId) {
        var lp = ST.getOne('pipeline', q.pipelineId);
        lost.push('โครงการ "' + ((lp && lp.projectName) || q.pipelineId) + '" (ยังไม่อยู่ในสถานะที่เปิด SO ได้)');
      }
    }
  }
  // ถัง Run rate — ใบเสนอราคาผูกถังจริงไว้แล้วก็ดึงมาเลย ไม่งั้นถ้าใบเสนอราคามี Project ID ของตัวเอง
  // (พิมพ์ไว้ตรงๆ ไม่ได้ผูกถังจริง) ก็เติมเลขนั้นให้ในช่องนี้ก่อน — ยังไม่มีถังก็จะสร้างให้อัตโนมัติตอนกด "สร้าง SO"
  // (ดู saveCreateSO) ไม่ปล่อยให้เลข Project ID ของใบเสนอราคาหายไปเฉยๆ เหมือนเดิม
  var rrPidEl = document.getElementById('soN_runrateProjectId');
  if (q.runrateId) {
    var rr = ST.getOne('runrate', q.runrateId);
    if (rr) {
      _soRRPick(rr.id);
    } else {
      lost.push('ถัง Run rate "' + (q.runrateProjectId || q.runrateId) + '" (อาจถูกลบไปแล้ว)');
    }
  } else if (qType === 'runrate' && rrPidEl && !_soRunrateProjIdDirty && pidNorm(q.projectId)) {
    rrPidEl.value = q.projectId;
    var curDealerId = (document.getElementById('soN_dealerId') || {}).value || '';
    var existingRR = ST.getAll('runrate').filter(function(r) {
      return r.dealerId === curDealerId && pidSame(r.projectId, q.projectId);
    })[0];
    if (existingRR) _soRRPick(existingRR.id); else { var idEl3 = document.getElementById('soN_runrateId'); if (idEl3) idEl3.value = ''; _soRunrateNote(); }
  }
  if (lost.length) toast('⚠️ ดึงจากใบเสนอราคาไม่ครบ — ' + lost.join(' · ') + ' เลือกเองอีกที', true);
  var pidEl2 = document.getElementById('soN_projectId');
  if (pidEl2 && !_soProjIdDirty && pidNorm(q.projectId)) pidEl2.value = q.projectId;
  _soProjIdNote();
}

// เทียบแบบ normalize เฉพาะฟิลด์ที่มีความหมาย (ไม่ใช่ JSON.stringify ตรงๆ) กัน false positive จาก field เกิน/ลำดับต่าง —
// ใช้เทียบรายการสินค้าในฟอร์มกับ quote.items ตรงๆ (ฟิลด์ name/quantity แทน model/qty)
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
    validFrom: _td(), validTo: addD(_td(), 30), paymentTerm: fields.paymentTerm || '', quotedBy: cfg.saleName || '',
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

// คำนวณรายการสินค้าหลังหักส่วนลดของใบเสนอราคา (เงินสดต่อรายการ + ส่วนลดอื่นๆ แบบกำหนดเอง + ส่วนลดท้ายบิล %)
// ให้ unitPrice ต่อแถวตรงกับยอดสุทธิจริง — ใช้สูตรเดียวกับหน้าใบเสนอราคา (computeQuoteTotals ใน
// views-quotation.js) โดยหารส่วนลดเงินสดต่อรายการแยกตามแถวนั้นๆ ก่อน แล้วกระจายส่วนลดอื่นๆ/ท้ายบิล
// (ซึ่งคิดเป็นยอดรวมทั้งใบ) แบบ pro-rata ตามสัดส่วนยอดหลังหักเงินสดของแต่ละแถว กันผลรวมรายการไม่ตรงกับยอดใบเสนอราคา
function _soQuoteDiscountedItems(q) {
  var items = (q && q.items) || [];
  if (!items.length) return items;
  var grossTotal = 0, cashDiscountTotal = 0;
  items.forEach(function(it) {
    var amt = Number(it.amount) || (Number(it.unitPrice) || 0) * (Number(it.quantity || it.qty) || 1);
    grossTotal += amt;
    cashDiscountTotal += amt * (Number(it.cashDiscountPercent) || 0) / 100;
  });
  var afterCashTotal = grossTotal - cashDiscountTotal;
  // computeQuoteTotals (views-quotation.js) รวมส่วนลดอื่นๆ แบบกำหนดเอง (extraDiscounts) เข้ามาด้วยถ้ามี —
  // ยังไม่มีก็ใช้สูตรเดิม (หลังเงินสด × (1 - ส่วนลดท้ายบิล%)) เอง ไม่พังถ้าฟังก์ชันนั้นยังไม่ถูกรวมเข้ามา
  var netAmount = (typeof computeQuoteTotals === 'function')
    ? computeQuoteTotals(items, q.extraDiscounts || [], q.discountPercent || 0).netAmount
    : afterCashTotal * (1 - (Number(q.discountPercent) || 0) / 100);
  var ratio = afterCashTotal > 0 ? (netAmount / afterCashTotal) : 1;
  return items.map(function(it) {
    var cashPct = Number(it.cashDiscountPercent) || 0;
    var origUnit = Number(it.unitPrice) || 0;
    var afterCashUnit = origUnit * (1 - cashPct / 100);
    var finalUnit = Math.round(afterCashUnit * ratio * 100) / 100;
    // เก็บราคาเดิม/ % ส่วนลดเงินสดต่อรายการไว้ด้วย (ไม่ใช่แค่ unitPrice สุทธิ) ให้ฟอร์ม SO โชว์ให้เห็นว่าราคา
    // ที่เติมให้นี้หักส่วนลดเงินสดไปแล้วเท่าไหร่ ไม่ใช่ราคาที่ดูเหมือนลดเงินสดหายไปเงียบๆ (ดู _soItemRowHtml)
    return Object.assign({}, it, { unitPrice: finalUnit, _origUnitPrice: origUnit, cashDiscountPercent: cashPct });
  });
}

// ป้าย "ส่วนลด" ข้างเงื่อนไขชำระเงิน — ขึ้นเมื่อใบเสนอราคาที่เลือกมีส่วนลดเงินสดต่อรายการ/ส่วนลดอื่นๆ/ส่วนลดท้ายบิล
// อย่างใดอย่างหนึ่ง จะได้รู้ตั้งแต่หน้าสร้าง SO โดยไม่ต้องเปิดใบเสนอราคาไปดูก่อน — โชว์ยอดรวมส่วนลดด้วยเลย ไม่ใช่
// แค่บอกว่า "มีส่วนลด" เฉยๆ (ผู้ใช้ต้องเปิดใบเสนอราคาไปดูเองก่อนหน้านี้ถึงจะรู้ว่าลดไปเท่าไหร่)
function _soDiscountBadgeHtml(q) {
  var cash = q ? (Number(q.cashDiscountTotal) || 0) : 0;
  var extra = q ? (Number(q.extraDiscountTotal) || 0) : 0;
  var bill = q ? (Number(q.discountAmount) || 0) : 0;
  var total = cash + extra + bill;
  if (total <= 0) return '';
  return '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:#f59e0b22;color:#f59e0b" title="ส่วนลดเงินสดต่อรายการ ' + fmtMoney(cash) + ' ฿ + ส่วนลดอื่นๆ ' + fmtMoney(extra) + ' ฿ + ส่วนลดท้ายบิล ' + fmtMoney(bill) + ' ฿">🏷️ มีส่วนลด -' + fmtMoney(total) + ' ฿</span>';
}
function _soUpdateDiscountBadge(q) {
  var el = document.getElementById('soN_discountBadge');
  if (el) el.innerHTML = _soDiscountBadgeHtml(q);
}

// sync รายการสินค้า + เงื่อนไขชำระเงินกลับเข้าใบเสนอราคาที่ผูกไว้โดยตรง (ไม่ถาม ไม่สร้าง revision) —
// ใบเสนอราคาที่ผูกกับ SO ถือเป็น single source of truth เดียวกัน แก้ที่ฟอร์มสร้าง/แก้ไข SO แล้วอัปเดตตรงนี้เลย
function _soSyncQuoteItems(quotationId, items, paymentTerm) {
  var all = [];
  try { all = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch (e) {}
  var idx = -1;
  for (var i = 0; i < all.length; i++) { if (all[i].id === quotationId) { idx = i; break; } }
  if (idx === -1) return;
  var q = all[idx];
  // ฟอร์ม SO โชว์ราคาหลังหักส่วนลดของใบเสนอราคาอยู่แล้ว (ดู _soQuoteDiscountedItems) — เทียบกับรายการที่แสดงนั้น
  // (ไม่ใช่ q.items ดิบก่อนหักส่วนลด) เพื่อจับว่าผู้ใช้ "แก้ไขจริง" หรือแค่ดึงมาเฉยๆ ไม่ได้แก้อะไร ถ้าไม่ได้แก้เลย
  // ไม่ต้องเขียนอะไรกลับไปทับใบเสนอราคา กันโครงสร้างส่วนลด (เงินสดต่อรายการ/ส่วนลดอื่นๆ) เดิมหายไปโดยไม่ตั้งใจ
  var shownItems = (typeof _soQuoteDiscountedItems === 'function') ? _soQuoteDiscountedItems(q) : (q.items || []);
  var changed = _soItemsDifferFromQuoteItems(items, shownItems.map(function(it) { return { name: it.name || it.model, quantity: it.quantity || it.qty, unitPrice: it.unitPrice, sku: it.sku || '' }; }));
  if (!changed) {
    if (paymentTerm && paymentTerm !== q.paymentTerm) {
      q.paymentTerm = paymentTerm; q.updatedAt = new Date().toISOString();
      all[idx] = q;
      localStorage.setItem('v7_quotations_v2', JSON.stringify(all));
      if (typeof quotations !== 'undefined') quotations = all;
      if (typeof syncItemToFirebase === 'function') syncItemToFirebase('quotations_v2', q);
    }
    return;
  }
  // ผู้ใช้แก้/เพิ่มรายการจริงในฟอร์ม SO — เขียนรายการใหม่ (ราคาที่กรอกไว้) กลับเข้าใบเสนอราคาตรงๆ ไม่มีข้อมูล
  // ส่วนลดต่อรายการเดิมให้สืบทอด (ผู้ใช้แก้รายการเองแล้ว ถือว่าราคาที่กรอกคือราคาสุทธิใหม่)
  var quoteItems = items.map(function(it) {
    return { name: it.model, sku: it.sku || '', quantity: it.qty, unitPrice: it.unitPrice, amount: (Number(it.qty)||0) * (Number(it.unitPrice)||0) };
  });
  var gross = quoteItems.reduce(function(s, it) { return s + (Number(it.amount)||0); }, 0);
  var vat = gross * 7 / 100;
  q.items = quoteItems;
  q.grossTotal = gross;
  q.cashDiscountTotal = 0;
  q.extraDiscountTotal = 0;
  q.extraDiscounts = [];
  q.discountPercent = 0;
  q.discountAmount = 0;
  q.netAmount = gross;
  q.vatAmount = vat;
  q.totalAmount = gross + vat;
  if (paymentTerm) q.paymentTerm = paymentTerm;
  q.updatedAt = new Date().toISOString();
  all[idx] = q;
  localStorage.setItem('v7_quotations_v2', JSON.stringify(all));
  if (typeof quotations !== 'undefined') quotations = all;
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('quotations_v2', q);
  toast('🔄 อัปเดตรายการในใบเสนอราคา ' + (q.quoteNo||'') + ' ตามนี้ด้วยแล้ว (ล้างส่วนลดเดิม เพราะแก้รายการใหม่)');
}

// บันทึก Project ID / เงื่อนไขชำระเงิน / ที่อยู่จัดส่งที่กรอกในฟอร์ม SO กลับเข้าข้อมูล Dealer — ให้ครั้งหน้า
// เลือก Dealer นี้แล้ว suggest ค่าที่เคยใช้ได้เลย ไม่ต้องพิมพ์ซ้ำ (เรียกจาก saveCreateSO/saveSOEdit)
function _soSaveBackToDealer(dealerId, fields) {
  var d = dealerId ? ST.getOne('dealers', dealerId) : null;
  if (!d) return;
  var updates = {};
  if (fields.projectId) {
    var ids = (d.projectIds || []).slice();
    if (ids.indexOf(fields.projectId) === -1) { ids.push(fields.projectId); updates.projectIds = ids; }
  }
  // หมายเหตุ: ไม่ sync paymentTerm กลับไปเป็น d.creditTerm อีกต่อไป — paymentTerm เป็นค่าต่อ SO ที่แก้ได้อิสระ
  // (เช่น ใบนี้ตกลง COD เป็นกรณีพิเศษ) การเขียนทับ d.creditTerm จะไปพังการคำนวณวันครบกำหนด/เครดิตของ SO ใบอื่น
  // ของ dealer เดียวกันในหน้าสรุปรายลูกค้า (ดู _csParseCreditDays ใน views-customersummary.js) เทอมเครดิตมาตรฐาน
  // ของ dealer ต้องแก้ที่หน้า Dealer โดยตรงเท่านั้น
  if (fields.deliveryAddress) {
    var addresses = (d.addresses || []).slice();
    var exists = addresses.some(function(a) { return (a.address||'').trim() === fields.deliveryAddress; });
    if (!exists) {
      addresses.push({ label: 'ที่อยู่จาก SO ' + _td(), address: fields.deliveryAddress, isDefault: addresses.length === 0 });
      updates.addresses = addresses;
    }
  }
  if (Object.keys(updates).length) {
    var updated = ST.update('dealers', dealerId, updates);
    if (typeof syncItemToFirebase === 'function') syncItemToFirebase('dealers', updated);
  }
}

function _soTypeToggle(type) {
  var sec = document.getElementById('soN_pipeSec');
  if (sec) sec.style.display = type === 'project' ? '' : 'none';
  if (type !== 'project') {
    var sel = document.getElementById('soN_pipelineId');
    if (sel) sel.value = '';
  }
  // Run rate ใช้ถังของตัวเอง ไม่ใช่ Pipeline Project — สลับกันคนละโหมด ไม่ให้ผูกทั้งสองทางพร้อมกัน
  var rrSec = document.getElementById('soN_rrSec');
  if (rrSec) rrSec.style.display = type === 'runrate' ? '' : 'none';
  if (type !== 'runrate') {
    var rrIdEl = document.getElementById('soN_runrateId');
    var rrPidEl = document.getElementById('soN_runrateProjectId');
    if (rrIdEl) rrIdEl.value = '';
    if (rrPidEl) rrPidEl.value = '';
  }
  _soRunrateNote();
}

// ตัวเลือกถัง Run rate ของ dealer ที่เลือกไว้ — ใช้กับ <select> ของฟอร์มแก้ไข SO (soE_runrateId) เท่านั้น
// ฟอร์มสร้าง SO ใหม่ใช้ช่องพิมพ์ค้นหา/สร้างใหม่แทนแล้ว (ดู _soRunrateSearch/_soRunratePick ด้านล่าง)
function _soRunrateOptionsHtml(dealerId, keepId) {
  var list = ST.getAll('runrate').filter(function(r) {
    if ((r.status || 'active') !== 'active' && r.id !== keepId) return false;
    return !dealerId || r.dealerId === dealerId;
  }).sort(function(a, b) { return (a.projectId || '') > (b.projectId || '') ? 1 : -1; });
  var h = '<option value="">-- ไม่ระบุ --</option>';
  list.forEach(function(r) {
    var n = (typeof _rrSOs === 'function') ? _rrSOs(r.id).length : 0;
    var amt = (typeof _rrTotal === 'function') ? _rrTotal(r.id) : 0;
    h += '<option value="' + r.id + '"' + (keepId === r.id ? ' selected' : '') + '>' +
      sanitize(r.projectId || '(ไม่มีเลข)') + (r.models ? ' · ' + sanitize(String(r.models).substr(0, 24)) : '') +
      ' · มี ' + n + ' SO ฿' + fmtMoney(amt) + '</option>';
  });
  return h;
}
// เลือกถัง Run rate ที่มีอยู่แล้วจริง (rrId ต้องมีอยู่จริงใน ST) — เติมทั้งช่องพิมพ์และ hidden id ให้ตรงกัน
function _soRRPick(rrId) {
  var r = rrId ? ST.getOne('runrate', rrId) : null;
  if (!r) { _soRunrateNote(); return; }
  var pidEl = document.getElementById('soN_runrateProjectId');
  var idEl = document.getElementById('soN_runrateId');
  if (pidEl) pidEl.value = r.projectId || '';
  if (idEl) idEl.value = r.id;
  _soRunrateNote();
}
// คำเตือน/คำอธิบายสดใต้ช่อง Project ID (Run rate) — อ่านสถานะปัจจุบันของช่องพิมพ์ + hidden id มาสรุปให้เห็นว่า
// กดบันทึกแล้วจะเกิดอะไร: ผูกถังเดิม หรือสร้างถังใหม่ให้ (ตรงกับที่ _soProjIdNote ทำให้ Project ID ของโครงการ)
function _soRunrateNote() {
  var note = document.getElementById('soN_rrNote');
  if (!note) return;
  var idEl = document.getElementById('soN_runrateId');
  var pidEl = document.getElementById('soN_runrateProjectId');
  var typed = pidNorm(pidEl ? pidEl.value : '');
  var r = (idEl && idEl.value) ? ST.getOne('runrate', idEl.value) : null;
  if (r) {
    var n = (typeof _rrSOs === 'function') ? _rrSOs(r.id).length : 0;
    note.textContent = 'ยอดของ SO ใบนี้จะไปรวมใน ' + (r.projectId || '(ไม่มีเลข)') + ' — ตอนนี้มี ' + n + ' ใบอยู่ในถังแล้ว' +
      ((r.status || 'active') !== 'active' ? '  ·  ⚠️ ถังนี้ปิดอยู่' : '');
    note.style.color = 'var(--text2)';
  } else if (typed) {
    note.textContent = '↩︎ ยังไม่มีถังนี้ — ตอนกด "สร้าง SO" จะสร้างถัง Run rate ใหม่เลขนี้ให้อัตโนมัติ';
    note.style.color = 'var(--ok, #10b981)';
  } else {
    note.textContent = '';
  }
}
// ช่อง Project ID (Run rate) แบบพิมพ์ค้นหา/สร้างใหม่ได้เลย เหมือนช่อง Project ID ของโครงการ (ดู
// _soProjectIdSearchCore) ต่างกันตรงตัวเลือกมาจาก collection 'runrate' เอง — เลือกจากลิสต์ = ผูกถังเดิม
// พิมพ์เลขที่ยังไม่มีถังของ Dealer นี้ = เคลียร์ hidden id ไว้ก่อน รอสร้างถังใหม่ให้ตอนกด "สร้าง SO" (ดู saveCreateSO)
var _soRunrateProjIdDirty = false;
function _soRunrateProjIdTouched() { _soRunrateProjIdDirty = true; }
// แกนกลางของช่อง Project ID (Run rate) แบบพิมพ์ค้นหา/สร้างใหม่ — ใช้ร่วมกันทั้งฟอร์มสร้าง SO (soN_*) และ
// ฟอร์มแก้ไข SO (soE_*) ต่างกันแค่ id ของ input/menu/hidden-field และชื่อฟังก์ชัน pick ที่จะเรียกตอนคลิกเลือก
function _soRunrateSearchCore(inputId, menuId, idInputId, dealerId, pickFnName) {
  var menu = document.getElementById(menuId);
  var idEl = document.getElementById(idInputId);
  var inp  = document.getElementById(inputId);
  if (!menu || !inp) return;
  var typed = (inp.value || '').trim();
  // พิมพ์เปลี่ยนจนไม่ตรงกับถังที่ hidden id ชี้อยู่แล้ว — เคลียร์ไว้ก่อน กันผูกผิดถังเงียบๆ (เลือกใหม่จากลิสต์ค่อยผูกใหม่)
  if (idEl && idEl.value) {
    var cur = ST.getOne('runrate', idEl.value);
    if (!cur || pidNorm(cur.projectId).toLowerCase() !== typed.toLowerCase()) idEl.value = '';
  }
  if (!typed) { menu.innerHTML = ''; return; }
  var matches = ST.getAll('runrate').filter(function(r) {
    return (!dealerId || r.dealerId === dealerId) && (r.projectId || '').toLowerCase().indexOf(typed.toLowerCase()) !== -1;
  }).slice(0, 8);
  if (!matches.length) {
    menu.innerHTML = '<div class="ac-menu"><div class="ac-empty">ไม่พบถังเดิมที่ตรงกับเลขนี้ — เลขใหม่จะสร้างถัง Run rate ให้อัตโนมัติตอนบันทึก</div></div>';
    return;
  }
  menu.innerHTML = '<div class="ac-menu">' + matches.map(function(r) {
    var n = (typeof _rrSOs === 'function') ? _rrSOs(r.id).length : 0;
    var amt = (typeof _rrTotal === 'function') ? _rrTotal(r.id) : 0;
    var closed = (r.status || 'active') !== 'active' ? ' · 🔒 ปิดแล้ว' : '';
    return '<div class="ac-item" onclick="' + pickFnName + '(\'' + r.id + '\')"><div class="info"><div class="n">' + sanitize(r.projectId || '(ไม่มีเลข)') + '</div><div class="m">มี ' + n + ' SO ฿' + fmtMoney(amt) + closed + '</div></div></div>';
  }).join('') + '</div>';
}
function _soRunratePickCore(inputId, menuId, idInputId, rrId) {
  var r = rrId ? ST.getOne('runrate', rrId) : null;
  var inp = document.getElementById(inputId), idEl = document.getElementById(idInputId), menu = document.getElementById(menuId);
  if (inp)  inp.value  = r ? (r.projectId || '') : '';
  if (idEl) idEl.value = r ? r.id : '';
  if (menu) menu.innerHTML = '';
}
function _soRunrateSearch(q) {
  _soRunrateSearchCore('soN_runrateProjectId', 'soN_runrateAcMenu', 'soN_runrateId', (document.getElementById('soN_dealerId') || {}).value || '', '_soRunratePick');
  _soRunrateNote();
}
function _soEditRunrateSearch(q) {
  _soRunrateSearchCore('soE_runrateProjectId', 'soE_runrateAcMenu', 'soE_runrateId', (document.getElementById('soE_dealer') || {}).value || '', '_soEditRunratePick');
  _soEditLinkNote();
}
function _soRunratePick(rrId) {
  _soRunrateProjIdDirty = true;
  _soRunratePickCore('soN_runrateProjectId', 'soN_runrateAcMenu', 'soN_runrateId', rrId);
  _soRunrateNote();
}
function _soEditRunratePick(rrId) {
  _soRunratePickCore('soE_runrateProjectId', 'soE_runrateAcMenu', 'soE_runrateId', rrId);
  _soEditLinkNote();
}
// ช่อง Dealer แบบพิมพ์ค้นหา (soN_dealerName) — พิมพ์ตรงกับชื่อ dealer ที่มีอยู่แล้วเป๊ะๆ (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
// ก็ถือว่าเลือก dealer นั้น เติม hidden soN_dealerId ให้ แล้วกรอง project/run rate/ที่อยู่ตามเดิม — พิมพ์ชื่อที่ยังไม่
// ตรงกับใครเลย (dealer ใหม่) ก็เคลียร์ hidden id ไว้ก่อน รอไปสร้างจริงตอนกด "สร้าง SO" (ดู saveCreateSO)
function _soDealerNameChanged(name) {
  var idEl = document.getElementById('soN_dealerId');
  if (!idEl) return;
  var typed = (name || '').trim().toLowerCase();
  var match = typed ? ST.getAll('dealers').find(function(d){ return (d.name||'').trim().toLowerCase() === typed; }) : null;
  var dealerId = match ? match.id : '';
  idEl.value = dealerId;
  _soFilterProjectsByDealer(dealerId);
  _soFilterRunrateByDealer(dealerId);
  _soFilterAddressByDealer(dealerId);
  // เงื่อนไขชำระเงิน — เติมค่าเริ่มต้นจาก Dealer ที่เลือกใหม่ให้ (ผู้ใช้แก้ต่อได้)
  var ptEl = document.getElementById('soN_paymentTerm');
  if (ptEl) ptEl.value = (match && match.creditTerm) || '';
}

// Dealer เป็น ac-menu dropdown เหมือน Visit Plan — ขึ้นทันทีตั้งแต่พิมพ์ตัวแรก ไม่ต้องกดลูกศร (ต่างจาก
// native <datalist> ที่บางเบราว์เซอร์/มือถือต้องกดลูกศรเองก่อนถึงจะโชว์ตัวเลือก)
function _soDealerSearch(q) {
  var menu = document.getElementById('soN_dealerAcMenu');
  if (!menu) return;
  var typed = (q || '').trim().toLowerCase();
  if (!typed) { menu.innerHTML = ''; return; }
  var matches = ST.getAll('dealers').filter(function(d) { return (d.name || '').toLowerCase().indexOf(typed) !== -1; }).slice(0, 8);
  if (!matches.length) { menu.innerHTML = '<div class="ac-menu"><div class="ac-empty">ไม่พบ Dealer ที่ตรงกับคำค้น — พิมพ์ชื่อใหม่แล้วกด "สร้าง SO" จะถามสร้างให้</div></div>'; return; }
  menu.innerHTML = '<div class="ac-menu">' + matches.map(function(d) {
    return '<div class="ac-item" onclick="_soDealerPick(\'' + d.id + '\')"><span class="av">' + sanitize((d.name || '?').slice(0, 2)) + '</span><div class="info"><div class="n">' + sanitize(d.name) + (d.level ? '</div><div class="m">Level ' + sanitize(d.level) + '</div>' : '</div>') + '</div></div>';
  }).join('') + '</div>';
}

function _soDealerPick(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  var nameEl = document.getElementById('soN_dealerName');
  if (nameEl) nameEl.value = d.name;
  var menu = document.getElementById('soN_dealerAcMenu');
  if (menu) menu.innerHTML = '';
  _soDealerNameChanged(d.name);
}

// Project ID แบบ ac-menu เหมือน Dealer — suggest เฉพาะ Project ID ที่เคยใช้กับ Dealer ที่เลือกไว้ (เปลี่ยน
// Dealer แล้ว suggest จะตามเปลี่ยนให้เอง เพราะอ่าน dealerId สดจาก hidden field ทุกครั้งที่เปิด/พิมพ์) — พิมพ์เอง
// ได้อิสระเหมือนเดิม ไม่ได้บังคับเลือกจากลิสต์ (ใช้ร่วมกันทั้งฟอร์มสร้าง soN_* และแก้ไข soE_*)
function _soProjectIdSearchCore(inputId, menuId, dealerId) {
  var menu = document.getElementById(menuId);
  var inp = document.getElementById(inputId);
  if (!menu || !inp) return;
  var d = dealerId ? ST.getOne('dealers', dealerId) : null;
  var ids = (d && d.projectIds) || [];
  var typed = (inp.value || '').trim().toLowerCase();
  var matches = typed ? ids.filter(function(id) { return id.toLowerCase().indexOf(typed) !== -1; }) : ids;
  if (!matches.length) { menu.innerHTML = ''; return; }
  menu.innerHTML = '<div class="ac-menu">' + matches.slice(0, 8).map(function(id) {
    return '<div class="ac-item" onclick="_soProjectIdPick(\'' + inputId + '\',\'' + menuId + '\',\'' + id.replace(/'/g, "\\'") + '\')"><div class="info"><div class="n">' + sanitize(id) + '</div></div></div>';
  }).join('') + '</div>';
}

function _soProjectIdPick(inputId, menuId, id) {
  var inp = document.getElementById(inputId);
  if (inp) inp.value = id;
  var menu = document.getElementById(menuId);
  if (menu) menu.innerHTML = '';
  if (inputId === 'soN_projectId') _soProjIdTouched();
  else if (typeof _soEditLinkNote === 'function') _soEditLinkNote();
}

function _soProjectIdSearch(q) {
  _soProjectIdSearchCore('soN_projectId', 'soN_projectIdAcMenu', (document.getElementById('soN_dealerId') || {}).value || '');
}

function _soEditProjectIdSearch(q) {
  _soProjectIdSearchCore('soE_projectId', 'soE_projectIdAcMenu', (document.getElementById('soE_dealer') || {}).value || '');
}

// เงื่อนไขชำระเงินที่ตั้งไว้ใน Admin (cfg.creditTerms) — suggest ให้พิมพ์ตรงกับของเดิมที่มีอยู่แล้ว
function _soPaymentTermDatalistHtml(listId) {
  var cfg = getConfig();
  var terms = (cfg.creditTerms || []).filter(Boolean);
  var opts = '';
  terms.forEach(function(v) { opts += '<option value="' + sanitize(v) + '"></option>'; });
  return '<datalist id="' + listId + '">' + opts + '</datalist>';
}

// เปลี่ยน Dealer แล้วต้องกรองถัง Run rate ตามไปด้วย เหมือนที่กรอง Pipeline Project
// เปลี่ยน Dealer ใหม่แล้ว — ถ้าถัง Run rate ที่ผูกอยู่ไม่ใช่ของ Dealer ใหม่นี้ ให้เคลียร์ทิ้ง (เลือก/พิมพ์ใหม่เอง)
function _soFilterRunrateByDealer(dealerId) {
  var idEl = document.getElementById('soN_runrateId');
  if (!idEl) return;
  var r = idEl.value ? ST.getOne('runrate', idEl.value) : null;
  if (r && r.dealerId !== dealerId) {
    idEl.value = '';
    var pidEl = document.getElementById('soN_runrateProjectId');
    if (pidEl) pidEl.value = '';
  }
  _soRunrateNote();
}

// ผู้ใช้พิมพ์ Project ID เองแล้ว — อย่าให้การเลือก Pipeline ใหม่มาทับของที่พิมพ์ไว้เงียบๆ
var _soProjIdDirty = false;
function _soProjIdTouched() { _soProjIdDirty = true; _soProjIdNote(); }
function _soProjIdNote() {
  var el = document.getElementById('soN_projectId'), note = document.getElementById('soN_projIdNote');
  if (!el || !note) return;
  var pipeId = (document.getElementById('soN_pipelineId') || {}).value || '';
  var p = pipeId ? ST.getOne('pipeline', pipeId) : null;
  var typed = (el.value || '').trim();
  var onPipe = p ? String(p.projectId || '').trim() : '';
  // รูปแบบเลขผิดปกติ/เลขนี้มีเจ้าของอยู่แล้ว — ต่อท้ายข้อความหลัก ไม่ไปแทนที่ เพราะเรื่องการผูกสำคัญกว่า
  var extra = '';
  if (typed) {
    var fmt = pidFormatWarning(typed);
    if (fmt) extra += '  ·  ⚠️ ' + fmt;
    var owners = pidOwners(typed, { pipeId: pipeId });
    if (owners.buckets.length) extra += '  ·  ⚠️ เลขนี้เป็นถัง Run rate อยู่แล้ว';
    else if (owners.pipelines.length) extra += '  ·  ⚠️ เลขนี้ใช้กับโครงการอื่นอยู่แล้ว';
  }

  if (!p) { note.textContent = (typed ? 'จะบันทึกไว้กับ SO ใบนี้' : '') + extra; note.style.color = extra ? 'var(--warn, #f59e0b)' : ''; return; }
  if (!typed) { note.textContent = onPipe ? '' : 'โครงการนี้ยังไม่มี Project ID'; note.style.color = ''; return; }
  if (typed === onPipe) { note.textContent = '✓ ตรงกับที่บันทึกไว้ในโครงการแล้ว' + extra; note.style.color = extra ? 'var(--warn, #f59e0b)' : 'var(--text2)'; return; }
  note.textContent = (onPipe
    ? '⚠️ ไม่ตรงกับของเดิมในโครงการ (' + onPipe + ') — ตอนบันทึกจะถามก่อนว่าจะแก้ต้นทางไหม'
    : '↩︎ ตอนบันทึกจะเขียนกลับไปที่โครงการให้ด้วย (นับเป็นลงทะเบียน CRM แล้ว)') + extra;
  note.style.color = (onPipe || extra) ? 'var(--warn, #f59e0b)' : 'var(--ok, #10b981)';
}

function _soFillFromPipe(pipeId) {
  if (!pipeId) return;
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;

  // fill dealer
  var dSel = document.getElementById('soN_dealerId');
  if (dSel && p.dealerId) {
    dSel.value = p.dealerId;
    var dNameEl = document.getElementById('soN_dealerName');
    var dObj = ST.getOne('dealers', p.dealerId);
    if (dNameEl && dObj) dNameEl.value = dObj.name || '';
    var ptEl2 = document.getElementById('soN_paymentTerm');
    if (ptEl2 && !ptEl2.value) ptEl2.value = (dObj && dObj.creditTerm) || '';
  }

  // Project ID ของโครงการที่เลือก — ไม่ทับถ้าผู้ใช้พิมพ์เองไว้แล้ว
  var pidEl = document.getElementById('soN_projectId');
  if (pidEl && !_soProjIdDirty) pidEl.value = p.projectId || '';
  _soProjIdNote();

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
  items.forEach(function(it, idx){ wrap.innerHTML += _soItemRowHtml(idx, it.model, it.qty, it.unitPrice, it.sku, it); });

  // เปลี่ยนโครงการแล้ว ใบเสนอราคาที่เคยเลือกไว้ (ถ้ามี) ไม่เกี่ยวข้องแล้ว รีเฟรชตัวเลือกกรองตาม pipeline นี้แทน
  var quoteSel = document.getElementById('soN_quoteSel');
  var quoteHidden = document.getElementById('soN_quotationId');
  if (quoteSel) quoteSel.innerHTML = _soQuotationOptionsHtml(dSel ? dSel.value : '', pipeId);
  if (quoteHidden) quoteHidden.value = '';
  window._soQuoteItemsSnapshot = null;
}

// sourceType ต่อรายการ: reserve_1021 (จองจากคลัง 1021) | reserve_8d01 (จองจากคลัง 8D01) | central_wh (ส่งจากคลังกลางเลย) | pr_po (ต้องเปิด PR/PO เพิ่ม) | restock (สินค้า Run rate รอรอบสั่งเข้า stock ปกติ ไม่ได้เปิด PR/PO ต่อใบ)
var SO_ITEM_SOURCE_TYPES = {
  '':            { label: '— ยังไม่ระบุ —' },
  reserve_1021:  { label: '📌 จองจากคลัง 1021' },
  reserve_8d01:  { label: '🧳 จองจากคลัง 8D01' },
  central_wh:    { label: '🏢 ส่งจากคลังกลาง' },
  pr_po:         { label: '🛒 ต้องเปิด PR/PO เพิ่ม' },
  restock:       { label: '⏳ รอของเข้า (Run rate)' }
};

// ตัวเลือก "สถานะ PR/PO" ดึงจาก cfg.prpoStatuses (แก้ไข/เพิ่ม/ลบ/เรียงลำดับได้ที่ ⚙️ ตั้งค่า) — ให้เพิ่มสถานะใหม่สดๆ
// จากตรงนี้ได้เลยผ่านตัวเลือก "+ เพิ่มสถานะใหม่..." ไม่ต้องออกไปหน้า Admin
function _soPrpoStatusOptionsHtml(selectedId) {
  var cfg = getConfig();
  var list = cfg.prpoStatuses || [];
  var opts = '<option value=""' + (!selectedId ? ' selected' : '') + '>— ยังไม่ระบุ —</option>';
  opts += list.map(function(s) {
    return '<option value="' + sanitize(s.id) + '"' + (s.id === selectedId ? ' selected' : '') + '>' + sanitize(s.name) + '</option>';
  }).join('');
  opts += '<option value="__new__">+ เพิ่มสถานะใหม่...</option>';
  return opts;
}

function _soPrpoStatusChanged(idx) {
  var sel = document.getElementById('soI_prpoStatus_' + idx);
  if (!sel || sel.value !== '__new__') return;
  var nm = (prompt('ชื่อสถานะ PR/PO ใหม่') || '').trim();
  if (!nm || typeof admAddPrpoStQuick !== 'function') { sel.value = ''; return; }
  var id = admAddPrpoStQuick(nm);
  sel.innerHTML = _soPrpoStatusOptionsHtml(id);
}

// so (ไม่บังคับ): ส่งมาเมื่อแก้ไขรายการของ SO ที่มีอยู่แล้ว — ใช้เช็คว่ามี lot จองใน 1021 จริงผูกกับ SO
// นี้อยู่หรือไม่ (จัดการคลัง) ถ้ามี ให้ sourceType/วันจองถึง "ตามคลังจริง" เป็นหลักเสมอ (ล็อกไว้ ไม่ให้พิมพ์ทับมือ)
// เพื่อไม่ให้ฟอร์มนี้โชว์ "ยังไม่ระบุ" ทั้งที่จัดการคลังจองไปแล้วจริง (ดูที่มาปัญหานี้ในข้อความ user ที่ขอให้แก้)
//
// แบ่งจำนวนต่อแหล่ง (เช่น สั่ง 24 ชิ้น จองใน 1021 จริงแค่ 12 อีก 12 ต้อง PR/PO): ถ้าจองจริงไม่ครบจำนวน (partial lock)
// ไม่ล็อก dropdown ทั้งแถวอีกต่อไป — ล็อกเฉพาะ "ส่วนที่จองจริงแล้ว" (กล่องแยกต่างหาก มีแค่วันจอง/วันจองถึงให้แก้ ซิงก์
// กลับ lot จริงเหมือนเดิม) ส่วน dropdown + ฟิลด์ย่อยเดิม (soI_src_*) ใช้บอกสถานะของ "ส่วนที่เหลือ" แทน (เช่น pr_po/restock)
// เพื่อให้มีที่กรอกว่าอีกกี่ชิ้นต้อง PR/PO — ถ้าจองจริงครบจำนวนพอดี (full lock) ยังล็อกทั้งแถวเหมือนเดิมทุกประการ
// ข้อความ "เหลือ N วัน" ต่อจากป้ายคลังจอง ① ให้เห็นชัดว่าต้องรีบเลื่อนจองไหมโดยไม่ต้องเปิดปุ่ม 🔄 เลื่อนดูก่อน
function _soLockDaysLeftLabel(realLock) {
  if (!realLock || !realLock.bookingExpiryDate) return '';
  var daysLeft = Math.ceil((new Date(realLock.bookingExpiryDate) - new Date(_td())) / 864e5);
  var label = daysLeft >= 0 ? 'เหลือ ' + daysLeft + ' วัน' : 'เกินกำหนด ' + (-daysLeft) + ' วัน';
  return ' (ถึง ' + fD(realLock.bookingExpiryDate) + ' — ' + label + ')';
}

function _soItemRowHtml(idx, model, qty, price, sku, item, so) {
  item = item || {};
  var sourceType = item.sourceType || '';
  var reserveDate = item.reserveDate || '';
  var reserveExpiryDate = item.reserveExpiryDate || '';
  var realLock = null, lockRemainingQty = 0;
  if (so && sku && typeof stockSOItemReadyInfo === 'function') {
    var stockInfo = stockSOItemReadyInfo(sku, qty, so);
    if (stockInfo && stockInfo.tracked && stockInfo.bookedForThisSO > 0) {
      realLock = stockInfo;
      lockRemainingQty = Math.max(0, (Number(qty) || 0) - stockInfo.bookedForThisSO);
      if (lockRemainingQty <= 0) {
        sourceType = stockInfo.bookedLocation === '8D01' ? 'reserve_8d01' : 'reserve_1021';
        reserveDate = stockInfo.reserveDate || reserveDate;
        reserveExpiryDate = stockInfo.bookingExpiryDate || reserveExpiryDate;
      }
    }
  }
  var isPartialLock = realLock && lockRemainingQty > 0;
  var realLockLabel = realLock ? (realLock.bookedLocation || '1021') + ' ' + stockLocationName(realLock.bookedLocation || '1021') : '';
  var srcOptions = Object.keys(SO_ITEM_SOURCE_TYPES).map(function(k) {
    return '<option value="' + k + '"' + (k === sourceType ? ' selected' : '') + '>' + SO_ITEM_SOURCE_TYPES[k].label + '</option>';
  }).join('');
  var h = '<div style="border:1px solid var(--border);border-radius:8px;padding:6px;margin-bottom:6px" id="soIR_' + idx + '">';
  h += '<div style="display:flex;gap:6px;align-items:center">' +
    '<input type="hidden" id="soI_sku_' + idx + '" value="' + sanitize(sku || '') + '">' +
    '<input class="inp" style="flex:2" placeholder="Model / สินค้า" value="' + sanitize(model||'') + '" id="soI_m_' + idx + '" list="soItemModelDL" autocomplete="off" onchange="_soItemModelChanged(\'' + idx + '\')">' +
    '<input class="inp" type="number" style="width:58px" placeholder="จำนวน" value="' + (qty||1) + '" id="soI_q_' + idx + '" min="1">' +
    '<input class="inp js-money" type="text" inputmode="decimal" style="width:95px" placeholder="ราคา/หน่วย" value="' + (price ? nmI(price) : '') + '" id="soI_p_' + idx + '">' +
    '<button class="btn bd bsm" onclick="this.closest(\'[id^=soIR_]\').remove()">✕</button></div>';
  // ราคาที่เติมให้แถวนี้หักส่วนลดเงินสดต่อรายการจากใบเสนอราคาไปแล้ว (ดู _soQuoteDiscountedItems) — โชว์ % และ
  // ราคาเดิมก่อนหักไว้ให้เห็นตรงนี้เลย ไม่งั้นดูจากฟอร์มนี้อย่างเดียวจะไม่รู้ว่าราคาลดไปแล้วเท่าไหร่ (เห็นแค่ยอดสุทธิ)
  if (Number(item.cashDiscountPercent) > 0) {
    h += '<div class="hint" style="font-size:10px;color:#f59e0b;margin:2px 0 0 2px">💵 ราคานี้หักส่วนลดเงินสด ' + item.cashDiscountPercent + '% แล้ว (ราคาเดิม ฿' + fmtMoney(item._origUnitPrice || 0) + '/หน่วย)</div>';
  }
  // ถ้าจองคลังจริงไว้แล้ว (ไม่ว่าครบหรือบางส่วน) โชว์เป็น "รายการย่อย ①" แยกบรรทัดชัดเจนก่อนเสมอ — ไม่งั้นจะดู
  // ปนกับช่องสถานะ/วันที่ของส่วนที่เหลือด้านล่าง (ไลน์ ②) จนแยกไม่ออกว่าเป็นคนละส่วนกัน (ปัญหาที่ user แจ้งมา)
  if (realLock) {
    h += '<div style="border:1px solid #86efac55;background:#86efac11;border-radius:6px;padding:5px 7px;margin-top:4px">' +
      '<div class="hint" style="font-size:10px;color:#16a34a;font-weight:600">① 🔒 จองคลัง ' + realLockLabel + ' จริงแล้ว ' + realLock.bookedForThisSO + (isPartialLock ? ' จาก ' + qty : '') + ' ชิ้น' + _soLockDaysLeftLabel(realLock) + ' — ล็อกไว้ (ยกเลิก/ย้ายที่หน้า "📦 จัดการคลัง" เท่านั้น)</div>' +
      '<div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">' +
      '<input class="inp" type="date" style="flex:1;min-width:110px" placeholder="จองวันที่" title="จองวันที่ (ส่วนที่จองคลังจริง)" value="' + sanitize(realLock.reserveDate || '') + '" id="soI_lockResDate_' + idx + '">' +
      '<input class="inp" type="date" style="flex:1;min-width:110px" placeholder="จองถึงวันที่" title="จองถึงวันที่ (ส่วนที่จองคลังจริง)" value="' + sanitize(realLock.bookingExpiryDate || '') + '" id="soI_lockResExp_' + idx + '">';
    if (realLock.lotId) {
      h += '<button type="button" class="btn bsm bo" onclick="closeMForce();showStockExtendBookingM(\'' + sanitize(sku) + '\',\'' + sanitize(realLock.lotId) + '\')" title="เลื่อนกำหนดจอง (บันทึกผู้อนุมัติ+ประวัติ — ปิดฟอร์มนี้ก่อน)">🔄 เลื่อน</button>';
    }
    h += '</div></div>';
  }
  var srcDisabledAttr = (realLock && !isPartialLock) ? ' disabled title="ล็อกไว้ตามคลังจริง — แก้ได้ที่หน้า จัดการคลัง เท่านั้น"' : '';
  if (isPartialLock) {
    h += '<div class="hint" style="font-size:10px;margin:5px 0 2px 2px;font-weight:600">② อีก ' + lockRemainingQty + ' ชิ้นที่เหลือ — ยังไม่จองจริง ระบุสถานะ:</div>';
  } else if (realLock) {
    h += '<div class="hint" style="font-size:10px;margin:5px 0 2px 2px;color:var(--text2)">ครบจำนวนแล้ว — ไม่มีส่วนที่เหลือต้องระบุเพิ่ม</div>';
  }
  h += '<div style="display:flex;gap:6px;align-items:center;margin-top:4px">' +
    '<select class="inp" style="flex:1" id="soI_src_' + idx + '"' + srcDisabledAttr + ' onchange="_soItemSourceChanged(\'' + idx + '\')">' + srcOptions + '</select></div>';
  var prpoDisplay = sourceType === 'pr_po' ? 'flex' : 'none';
  h += '<div id="soI_prpo_' + idx + '" style="display:' + prpoDisplay + ';gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">' +
    '<input class="inp" type="date" style="flex:1;min-width:110px" placeholder="วันที่ยื่น PR/PO" title="วันที่ยื่น PR/PO" value="' + sanitize(item.prpoSubmittedDate || '') + '" id="soI_prpoDate_' + idx + '">' +
    '<select class="inp" style="flex:2;min-width:160px" id="soI_prpoStatus_' + idx + '" onchange="_soPrpoStatusChanged(\'' + idx + '\')">' + _soPrpoStatusOptionsHtml(item.prpoStatusId || '') + '</select>' +
    '<input class="inp" type="date" style="flex:1;min-width:110px" placeholder="คาดว่าจะถึง" title="วันที่คาดว่าจะได้ของ" value="' + sanitize(item.prpoExpectedDate || '') + '" id="soI_prpoExp_' + idx + '">' +
    '</div>';
  var restockDisplay = sourceType === 'restock' ? 'flex' : 'none';
  h += '<div id="soI_restock_' + idx + '" style="display:' + restockDisplay + ';gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">' +
    '<input class="inp" type="date" style="flex:1;min-width:110px" placeholder="คาดว่าจะเข้า stock" title="วันที่คาดว่าสินค้าจะเข้า stock รอบนี้ (ไม่บังคับ)" value="' + sanitize(item.restockExpectedDate || '') + '" id="soI_restockExp_' + idx + '">' +
    '<span class="hint" style="font-size:10px">สินค้า Run rate — รอรอบสั่งเข้า stock ปกติ ไม่ต้องเปิด PR/PO ต่อใบ</span>' +
    '</div>';
  // เต็มล็อก (full lock) ไม่ต้องโชว์กล่องนี้ซ้ำ เพราะกล่อง ① ด้านบนมีช่องแก้วันจอง+ปุ่มเลื่อนของ lot จริงให้แล้ว
  // (โชว์ซ้ำจะดูเหมือนมี 2 ช่องแก้วันที่คนละที่สำหรับ lot เดียวกัน)
  var resDisplay = ((sourceType === 'reserve_1021' || sourceType === 'reserve_8d01') && !(realLock && !isPartialLock)) ? 'flex' : 'none';
  if (!(realLock && !isPartialLock)) {
    h += '<div id="soI_res_' + idx + '" style="display:' + resDisplay + ';gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">' +
      '<input class="inp" type="date" style="flex:1;min-width:110px" placeholder="จองวันที่" title="จองวันที่ (ไม่บังคับ)" value="' + sanitize(reserveDate || '') + '" id="soI_resDate_' + idx + '">' +
      '<input class="inp" type="date" style="flex:1;min-width:110px" placeholder="จองถึงวันที่" title="จองถึงวันที่ (ไม่บังคับ)" value="' + sanitize(reserveExpiryDate || '') + '" id="soI_resExp_' + idx + '">' +
      '</div>';
  }
  h += '</div>';
  return h;
}

function _soItemSourceChanged(idx) {
  var sel = document.getElementById('soI_src_' + idx);
  var prpoBox = document.getElementById('soI_prpo_' + idx);
  var resBox = document.getElementById('soI_res_' + idx);
  var restockBox = document.getElementById('soI_restock_' + idx);
  if (!sel) return;
  if (prpoBox) prpoBox.style.display = sel.value === 'pr_po' ? 'flex' : 'none';
  if (resBox) resBox.style.display = (sel.value === 'reserve_1021' || sel.value === 'reserve_8d01') ? 'flex' : 'none';
  if (restockBox) restockBox.style.display = sel.value === 'restock' ? 'flex' : 'none';
}

// อ่านฟิลด์ sourceType/PR-PO/วันจองถึง จากแถวรายการสินค้า — ใช้ร่วมกันตอนบันทึกทั้งสร้างใหม่และแก้ไข
function _soReadItemSourceFields(row) {
  var srcEl = row.querySelector('[id^="soI_src_"]');
  var out = { sourceType: srcEl ? srcEl.value : '' };
  if (out.sourceType === 'pr_po') {
    var dateEl = row.querySelector('[id^="soI_prpoDate_"]');
    var statusEl = row.querySelector('[id^="soI_prpoStatus_"]');
    var expEl = row.querySelector('[id^="soI_prpoExp_"]');
    out.prpoSubmittedDate = dateEl ? dateEl.value : '';
    out.prpoStatusId = (statusEl && statusEl.value !== '__new__') ? statusEl.value : '';
    out.prpoExpectedDate = expEl ? expEl.value : '';
  } else if (out.sourceType === 'restock') {
    var restockExpEl = row.querySelector('[id^="soI_restockExp_"]');
    out.restockExpectedDate = restockExpEl ? restockExpEl.value : '';
  } else if (out.sourceType === 'reserve_1021' || out.sourceType === 'reserve_8d01') {
    var resDateEl = row.querySelector('[id^="soI_resDate_"]');
    var resExpEl = row.querySelector('[id^="soI_resExp_"]');
    // เพิ่งเลือกจองครั้งแรก (ยังไม่มีวันจอง) — เซ็ตเป็นวันนี้ให้เลยอัตโนมัติ ไม่ต้องให้ผู้ใช้กรอกเอง
    out.reserveDate = (resDateEl && resDateEl.value) ? resDateEl.value : _td();
    out.reserveExpiryDate = resExpEl ? resExpEl.value : '';
  }
  // ส่วนที่จองคลังจริงแล้วบางส่วน (partial lock, ดู _soItemRowHtml) มีกล่องวันจองแยกต่างหากเสมอไม่ว่า
  // dropdown ด้านบนจะเลือกสถานะอะไรไว้สำหรับส่วนที่เหลือ (reserveDate/reserveExpiryDate ของรายการนี้ผูกกับ
  // lot จริงใน 1021 เสมอ ต้องอ่านแยกไม่งั้นค่าจะหายไปทับด้วยค่าจากสาขา sourceType ด้านบน)
  var lockDateEl = row.querySelector('[id^="soI_lockResDate_"]');
  if (lockDateEl) {
    var lockExpEl = row.querySelector('[id^="soI_lockResExp_"]');
    out.reserveDate = lockDateEl.value || out.reserveDate || _td();
    out.reserveExpiryDate = (lockExpEl ? lockExpEl.value : '') || out.reserveExpiryDate || '';
  }
  return out;
}

// ปุ่ม "🏷️ อัปเดตสถานะ" ต่อแถวในหน้า SO detail — modal ย่อ มีแค่ dropdown สถานะ + ฟิลด์ย่อยเดียวกับฟอร์ม
// "✏️ แก้ไขรายการสินค้า" (รียูส id แบบเดียวกันแต่ fix suffix เป็น "qs" แทน idx ของแถว เพื่อรียูส
// _soItemSourceChanged/_soPrpoStatusChanged/_soReadItemSourceFields ตรงๆได้โดยไม่ต้องเขียนซ้ำ) ไม่ต้องเปิดฟอร์มแก้ไขทั้งชุด
// (model/จำนวน/ราคา) แค่จะเปลี่ยนสถานะอย่างเดียว
function showSOItemStatusM(soId, idx) {
  var s = ST.getOne('salesOrders', soId);
  if (!s || !s.items || !s.items[idx]) return;
  var it = s.items[idx];
  var sourceType = it.sourceType || '';
  var reserveDate = it.reserveDate || '';
  var reserveExpiryDate = it.reserveExpiryDate || '';
  var realLock = null, lockRemainingQty = 0;
  if (it.sku && typeof stockSOItemReadyInfo === 'function') {
    var stockInfo = stockSOItemReadyInfo(it.sku, it.qty, s);
    if (stockInfo && stockInfo.tracked && stockInfo.bookedForThisSO > 0) {
      realLock = stockInfo;
      lockRemainingQty = Math.max(0, (Number(it.qty) || 0) - stockInfo.bookedForThisSO);
      if (lockRemainingQty <= 0) {
        sourceType = stockInfo.bookedLocation === '8D01' ? 'reserve_8d01' : 'reserve_1021';
        reserveDate = stockInfo.reserveDate || reserveDate;
        reserveExpiryDate = stockInfo.bookingExpiryDate || reserveExpiryDate;
      }
    }
  }
  var isPartialLock = realLock && lockRemainingQty > 0;
  var realLockLabel = realLock ? (realLock.bookedLocation || '1021') + ' ' + stockLocationName(realLock.bookedLocation || '1021') : '';
  var srcOptions = Object.keys(SO_ITEM_SOURCE_TYPES).map(function(k) {
    return '<option value="' + k + '"' + (k === sourceType ? ' selected' : '') + '>' + SO_ITEM_SOURCE_TYPES[k].label + '</option>';
  }).join('');
  var body = '<div style="font-size:12px;margin-bottom:8px"><b>' + sanitize(it.model || '') + '</b> × ' + (it.qty||0) + '</div>';
  if (realLock) {
    body += '<div style="border:1px solid #86efac55;background:#86efac11;border-radius:6px;padding:5px 7px;margin-bottom:8px">' +
      '<div class="hint" style="font-size:10px;color:#16a34a;font-weight:600">① 🔒 จองคลัง ' + realLockLabel + ' จริงแล้ว ' + realLock.bookedForThisSO + (isPartialLock ? ' จาก ' + (it.qty||0) : '') + ' ชิ้น' + _soLockDaysLeftLabel(realLock) + ' — ล็อกไว้ (ยกเลิก/ย้ายที่หน้า "📦 จัดการคลัง" เท่านั้น)</div>' +
      '<div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">' +
      '<input class="inp" type="date" style="flex:1;min-width:110px" title="จองวันที่ (ส่วนที่จองคลังจริง)" value="' + sanitize(realLock.reserveDate || '') + '" id="soI_lockResDate_qs">' +
      '<input class="inp" type="date" style="flex:1;min-width:110px" title="จองถึงวันที่ (ส่วนที่จองคลังจริง)" value="' + sanitize(realLock.bookingExpiryDate || '') + '" id="soI_lockResExp_qs">';
    if (realLock.lotId) {
      body += '<button type="button" class="btn bsm bo" onclick="closeMForce();showStockExtendBookingM(\'' + sanitize(it.sku) + '\',\'' + sanitize(realLock.lotId) + '\')" title="เลื่อนกำหนดจอง (บันทึกผู้อนุมัติ+ประวัติ — ปิดฟอร์มนี้ก่อน)">🔄 เลื่อน</button>';
    }
    body += '</div></div>';
  }
  var srcDisabledAttr = (realLock && !isPartialLock) ? ' disabled title="ล็อกไว้ตามคลังจริง — แก้ได้ที่หน้า จัดการคลัง เท่านั้น"' : '';
  if (isPartialLock) {
    body += '<div class="hint" style="font-size:10px;margin:0 0 4px 2px;font-weight:600">② อีก ' + lockRemainingQty + ' ชิ้นที่เหลือ — ยังไม่จองจริง ระบุสถานะ:</div>';
  } else if (realLock) {
    body += '<div class="hint" style="font-size:10px;margin:0 0 4px 2px;color:var(--text2)">ครบจำนวนแล้ว — ไม่มีส่วนที่เหลือต้องระบุเพิ่ม</div>';
  }
  body += '<div class="fg"><label>สถานะ</label><select class="inp" id="soI_src_qs"' + srcDisabledAttr + ' onchange="_soItemSourceChanged(\'qs\')">' + srcOptions + '</select></div>';
  var prpoDisplay = sourceType === 'pr_po' ? 'flex' : 'none';
  body += '<div id="soI_prpo_qs" style="display:' + prpoDisplay + ';gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">' +
    '<input class="inp" type="date" style="flex:1;min-width:110px" title="วันที่ยื่น PR/PO" value="' + sanitize(it.prpoSubmittedDate || '') + '" id="soI_prpoDate_qs">' +
    '<select class="inp" style="flex:2;min-width:160px" id="soI_prpoStatus_qs" onchange="_soPrpoStatusChanged(\'qs\')">' + _soPrpoStatusOptionsHtml(it.prpoStatusId || '') + '</select>' +
    '<input class="inp" type="date" style="flex:1;min-width:110px" title="วันที่คาดว่าจะได้ของ" value="' + sanitize(it.prpoExpectedDate || '') + '" id="soI_prpoExp_qs">' +
    '</div>';
  var restockDisplay = sourceType === 'restock' ? 'flex' : 'none';
  body += '<div id="soI_restock_qs" style="display:' + restockDisplay + ';gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">' +
    '<input class="inp" type="date" style="flex:1;min-width:110px" title="วันที่คาดว่าสินค้าจะเข้า stock" value="' + sanitize(it.restockExpectedDate || '') + '" id="soI_restockExp_qs">' +
    '<span class="hint" style="font-size:10px">สินค้า Run rate — รอรอบสั่งเข้า stock ปกติ ไม่ต้องเปิด PR/PO ต่อใบ</span>' +
    '</div>';
  // เต็มล็อก (full lock) ไม่ต้องโชว์กล่องนี้ซ้ำ เพราะกล่อง ① ด้านบนมีช่องแก้วันจอง+ปุ่มเลื่อนของ lot จริงให้แล้ว
  var resDisplay = ((sourceType === 'reserve_1021' || sourceType === 'reserve_8d01') && !(realLock && !isPartialLock)) ? 'flex' : 'none';
  if (!(realLock && !isPartialLock)) {
    body += '<div id="soI_res_qs" style="display:' + resDisplay + ';gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">' +
      '<input class="inp" type="date" style="flex:1;min-width:110px" title="จองวันที่" value="' + sanitize(reserveDate || '') + '" id="soI_resDate_qs">' +
      '<input class="inp" type="date" style="flex:1;min-width:110px" title="จองถึงวันที่" value="' + sanitize(reserveExpiryDate || '') + '" id="soI_resExp_qs">' +
      '</div>';
  }
  if (!realLock && it.sku) {
    body += '<div class="hint" style="font-size:10px;margin-top:6px">เลือก "จองจากคลัง 1021/8D01" แล้วบันทึก ถ้ายังไม่มีการจองจริงในคลัง ระบบจะเปิดหน้า "📦 จัดการคลัง" ให้ต่อเพื่อทำการจองจริงทันที</div>';
  }
  body += '<button class="btn bp btn-full" style="margin-top:10px" onclick="saveSOItemStatus(\'' + soId + '\',' + idx + ')">💾 บันทึกสถานะ</button>';
  openM('🏷️ อัปเดตสถานะ — ' + sanitize(it.model || ''), body);
}

// บันทึกจาก modal ด้านบน — รียูส _soReadItemSourceFields อ่านจาก #mBd (เนื้อ modal) ตรงๆ แทนแถวในฟอร์มแก้ไขรายการทั้งชุด
// ถ้าเลือกจองจากคลัง 1021/8D01 แต่ยังไม่มี lot จริงผูกไว้กับ SO นี้ (bookedForThisSO<=0) ต่อด้วยเปิดหน้า "จัดการคลัง"
// (showStockAddLotM พรีฟิลด์ตำแหน่ง+SO ให้) ให้ทำการจองจริงต่อทันที ไม่ต้องกดปุ่มซ้ำอีกที — คลังจริงยังเป็น source
// of truth เดิม ปุ่มนี้แค่ช่วยประกาศแผน/นำทางไปจองจริงให้สะดวกขึ้น ไม่ได้เขียนทับตรรกะคลังที่มีอยู่
function saveSOItemStatus(soId, idx) {
  var s = ST.getOne('salesOrders', soId);
  if (!s || !s.items || !s.items[idx]) return;
  var it = s.items[idx];
  var row = document.getElementById('mBd');
  var fields = _soReadItemSourceFields(row);
  var items = s.items.slice();
  items[idx] = Object.assign({}, it, fields);

  // ไม่เช็คแค่ sourceType==='reserve_1021' อีกต่อไป — ถ้าจองคลังจริงบางส่วน (partial lock) ฟิลด์
  // reserveDate มาจากกล่องล็อกเสมอแม้ dropdown จะเลือกสถานะอื่นไว้สำหรับส่วนที่เหลือ (ดู _soReadItemSourceFields)
  if (it.sku && fields.reserveDate && typeof stockSyncSOItemReservation === 'function') {
    stockSyncSOItemReservation(it.sku, soId, fields.reserveDate, fields.reserveExpiryDate);
  }

  var quotationId = s.quotationId;
  if (quotationId && typeof _soSyncQuoteItems === 'function') _soSyncQuoteItems(quotationId, items);

  var cfg = getConfig();
  var logs = (s.logs || []).slice();
  var stLabel = SO_ITEM_SOURCE_TYPES[fields.sourceType] ? SO_ITEM_SOURCE_TYPES[fields.sourceType].label : '— ยังไม่ระบุ —';
  logs.push({ date: _td(), action: '🏷️ อัปเดตสถานะสินค้า ' + (it.model || ''), note: stLabel, by: cfg.saleName || '' });
  var updatedSO = ST.update('salesOrders', soId, { items: items, quotationId: quotationId, updatedAt: new Date().toISOString(), logs: logs });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
  closeMForce();
  toast('💾 บันทึกสถานะแล้ว');

  var needsRealStock = (fields.sourceType === 'reserve_1021' || fields.sourceType === 'reserve_8d01') && it.sku;
  var alreadyBooked = false;
  if (needsRealStock && typeof stockSOItemReadyInfo === 'function') {
    var info = stockSOItemReadyInfo(it.sku, it.qty, s);
    alreadyBooked = info && info.bookedForThisSO > 0;
  }
  if (needsRealStock && !alreadyBooked && typeof showStockAddLotM === 'function') {
    showStockAddLotM(it.sku, fields.sourceType === 'reserve_1021' ? '1021' : '8D01', soId);
  } else {
    go('soDetail', { soId: soId });
  }
}

// ชื่อสถานะ PR/PO ที่แสดงผล — ใช้ prpoStatusId ผูกกับ cfg.prpoStatuses ปัจจุบันก่อน ถ้าไม่มี (รายการเก่าก่อน
// เปลี่ยนเป็น dropdown) ค่อย fallback ไปข้อความอิสระเดิมที่เคยพิมพ์ไว้ใน item.prpoStatus
function _soPrpoStatusLabel(item) {
  if (item.prpoStatusId) {
    var cfg = getConfig();
    var s = (cfg.prpoStatuses || []).filter(function(x) { return x.id === item.prpoStatusId; })[0];
    if (s) return s.name;
  }
  return item.prpoStatus || '';
}

// พิมพ์ตรงชื่อ/SKU ในแคตตาล็อก (buildAdminModelDatalist) → เติม SKU + ราคาให้อัตโนมัติถ้าช่องราคายังว่าง
// ราคาที่เติมให้ต้องตามเลเวลของ Dealer ที่เลือกไว้ (เหมือนตอนสร้างใบเสนอราคา ดู getModelPriceByLevelForQuote
// ใน views-quotation.js) ไม่ใช่ราคา RRP เฉยๆ เพราะงั้นสินค้าที่เพิ่มเองโดยไม่ได้ดึงจากใบเสนอราคา (เช่น Dealer
// เลเวล S) จะได้ราคา RRP เต็มแทนที่จะเป็นราคา S — หา dealerId จาก soN_dealerId (ฟอร์มสร้าง SO ใหม่) ก่อน ถ้าไม่มี
// (เช่นฟอร์มแก้ไขรายการสินค้า showSOEditItemsModal) ก็มี hidden field เดียวกันแทรกไว้ให้ชี้ dealer ของ SO ใบนั้น
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
      var dealerId = (document.getElementById('soN_dealerId') || {}).value || '';
      var dealer = dealerId ? ST.getOne('dealers', dealerId) : null;
      var level = (dealer && dealer.level) || 'B';
      var price = (typeof getModelPriceByLevelForQuote === 'function')
        ? getModelPriceByLevelForQuote(prod.name, level)
        : (Number(prod.rrpExVat) || Number(prod.price) || 0);
      if (price > 0) pEl.value = nmI(price);
    }
  } else if (skuEl) {
    skuEl.value = '';
  }
}

var _soIC = 0;
// รายชื่อที่อยู่จัดส่งที่บันทึกไว้ใน dealer นั้น — ใช้ทั้งตอนสร้างและแก้ไข SO (ดู _soFilterAddressByDealer)
function _soAddressOptionsHtml(dealerId, keepAddress) {
  var d = dealerId ? ST.getOne('dealers', dealerId) : null;
  var addresses = (d && d.addresses) || [];
  var h = '<option value="">-- พิมพ์ที่อยู่เอง (ด้านล่าง) --</option>';
  addresses.forEach(function(a) {
    var sel = (keepAddress && keepAddress === a.address) ? ' selected' : '';
    h += '<option value="' + sanitize(a.address) + '"' + sel + '>' + sanitize(a.label) + (a.isDefault ? ' ⭐' : '') + '</option>';
  });
  return h;
}

function _soAddressSelChanged(val) {
  var ta = document.getElementById('soN_deliveryAddress');
  if (ta && val) ta.value = val;
}

// เปลี่ยน dealer ตอนสร้าง/แก้ไข SO → รีเฟรชตัวเลือกที่อยู่จัดส่งให้ตรงกับ dealer ที่เลือกใหม่
function _soFilterAddressByDealer(dealerId) {
  var sel = document.getElementById('soN_addressSel');
  if (!sel) return;
  sel.innerHTML = _soAddressOptionsHtml(dealerId);
  var ta = document.getElementById('soN_deliveryAddress');
  if (ta) ta.value = '';
}

// เช็คสต็อกสด ต่อรายการที่กรอกไว้ในฟอร์ม — ก่อนที่ SO จะมี id จริง (ใช้ so จำลองที่มีแค่ quotationId ไว้เทียบ reservation)
function _soCheckStockNow() {
  var wrap = document.getElementById('soN_stockCheck');
  if (!wrap) return;
  var quotationId = (document.getElementById('soN_quotationId') || {}).value || '';
  var stubSO = { id: null, quotationId: quotationId };
  var rows = [];
  document.querySelectorAll('#soN_items > div[id^="soIR_"]').forEach(function(row) {
    var mEl = row.querySelector('[id^="soI_m_"]');
    var qEl = row.querySelector('[id^="soI_q_"]');
    var skuEl = row.querySelector('[id^="soI_sku_"]');
    if (!mEl || !mEl.value.trim()) return;
    var sku = skuEl ? skuEl.value.trim() : '';
    var qty = Number(qEl.value) || 1;
    var label = mEl.value.trim();
    var badge = sku && typeof stockSOItemReadinessHtml === 'function' ? stockSOItemReadinessHtml(sku, qty, stubSO) : '<span style="color:var(--text2);font-size:11px">ไม่มี SKU ผูกไว้ — ตรวจสต็อกไม่ได้</span>';
    // ยังไม่มี SO จริง (id ยังไม่เกิด) — ตัดปุ่ม "ยืนยัน & ย้ายเข้า 1021" ออก เพราะปุ่มนั้นต้องมี SO จริงให้ผูกก่อน บันทึก SO แล้วค่อยมายืนยันที่หน้า SO detail ได้
    badge = badge.replace(/<button[^>]*stockFulfillReservationToSO[^<]*<\/button><br>/, '');
    rows.push('<div style="margin-bottom:8px;padding:8px;background:var(--bg2);border-radius:8px"><div style="font-size:12px;font-weight:600;margin-bottom:4px">' + sanitize(label) + ' × ' + qty + '</div>' + badge + '</div>');
  });
  wrap.innerHTML = rows.length ? rows.join('') : '<div style="font-size:11px;color:var(--text2)">ยังไม่มีรายการสินค้าให้เช็ค</div>';
}

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
  var dealerName  = ((document.getElementById('soN_dealerName')||{}).value || '').trim();
  var customerPO  = (document.getElementById('soN_customerPO') ||{}).value || '';
  var customerPODate = (document.getElementById('soN_customerPODate') ||{}).value || '';
  var pipelineId  = (document.getElementById('soN_pipelineId') ||{}).value || '';
  var quotationId = (document.getElementById('soN_quotationId')||{}).value || '';
  var note        = (document.getElementById('soN_note')       ||{}).value || '';
  var projectId   = ((document.getElementById('soN_projectId') ||{}).value || '').trim();
  var runrateId   = (document.getElementById('soN_runrateId')  ||{}).value || '';
  var runrateProjectId = ((document.getElementById('soN_runrateProjectId') ||{}).value || '').trim();
  var deliveryAddress = ((document.getElementById('soN_deliveryAddress') ||{}).value || '').trim();
  var paymentTerm = ((document.getElementById('soN_paymentTerm') ||{}).value || '').trim();
  var pendingSoNumber = !!((document.getElementById('soN_pendingSoNum') || {}).checked);
  // SO เป็นได้อย่างใดอย่างหนึ่ง — โครงการ หรือ run rate ไม่ใช่ทั้งสอง ไม่งั้นยอดจะถูกนับซ้ำสองที่
  if (type === 'runrate') { pipelineId = ''; projectId = ''; } else { runrateId = ''; }

  // พิมพ์ชื่อ Dealer ที่ยังไม่มีในระบบไว้ (hidden soN_dealerId ไม่ถูกเติม เพราะไม่ตรงกับ dealer เดิมตัวไหนเป๊ะๆ)
  // — ถามยืนยันตรงนี้เลยตอนกดสร้าง SO ว่าจะสร้าง Dealer ใหม่ให้ไหม ตั้ง level เป็น Other ไว้ก่อน แก้ทีหลังได้
  if (!dealerId && dealerName) {
    if (!confirm('ยังไม่มีข้อมูล Dealer นี้ ต้องการสร้างไหม')) return;
    var newDealer = ST.add('dealers', { name: dealerName, level: 'Other' });
    if (typeof syncItemToFirebase === 'function') syncItemToFirebase('dealers', newDealer);
    dealerId = newDealer.id;
  }
  if (!dealerId) { alert('กรุณาเลือก Dealer'); return; }

  var items = [];
  document.querySelectorAll('#soN_items > div[id^="soIR_"]').forEach(function(row){
    var mEl = row.querySelector('[id^="soI_m_"]');
    var qEl = row.querySelector('[id^="soI_q_"]');
    var pEl = row.querySelector('[id^="soI_p_"]');
    var skuEl = row.querySelector('[id^="soI_sku_"]');
    if (!mEl || !mEl.value.trim()) return;
    items.push(Object.assign({ model: mEl.value.trim(), sku: skuEl ? skuEl.value.trim() : '', qty: Number(qEl.value)||1, unitPrice: parseNum(pEl.value)||0, serials:[] }, _soReadItemSourceFields(row)));
  });
  if (!items.length) { alert('กรุณาใส่รายการสินค้าอย่างน้อย 1 รายการ'); return; }

  var dealer = ST.getOne('dealers', dealerId);
  var cfg    = getConfig();
  var now    = new Date().toISOString();

  // ถัง Run rate: ช่อง Project ID อาจชี้ถังเดิม (runrateId มี hidden id มาแล้ว) หรือพิมพ์เลขใหม่ที่ยังไม่มีถัง —
  // หาถังเดิมของ Dealer นี้ที่ตรงเลขก่อน ไม่เจอค่อยสร้างถังใหม่ให้อัตโนมัติ (เลขซ้ำกับ Dealer อื่นจะถามก่อนว่าจะ
  // แยกถังใหม่จริงไหม เพราะ Project ID ปกติไม่ควรซ้ำข้าม Dealer — ดู saveRunRate ในviews-runrate.js)
  if (type === 'runrate' && runrateProjectId) {
    var rrMatch = runrateId ? ST.getOne('runrate', runrateId) : null;
    if (!rrMatch || pidNorm(rrMatch.projectId) !== pidNorm(runrateProjectId)) {
      rrMatch = ST.getAll('runrate').filter(function(r) { return r.dealerId === dealerId && pidSame(r.projectId, runrateProjectId); })[0] || null;
    }
    if (!rrMatch) {
      var dupRR = (typeof _rrFindByProjectId === 'function') ? _rrFindByProjectId(runrateProjectId, null) : null;
      if (dupRR && !confirm('Project ID "' + runrateProjectId + '" ถูกใช้เป็นถัง Run rate ของ ' +
          ((typeof _rrDealerName === 'function' && _rrDealerName(dupRR.dealerId)) || 'Dealer อื่น') + ' อยู่แล้ว\n\n' +
          'ต้องการสร้างถังใหม่เลขเดียวกันนี้แยกให้ ' + (dealer ? dealer.name : 'Dealer นี้') + 'ไหม?\n\n' +
          'ตกลง = สร้างถังใหม่ (เลขซ้ำกันคนละถัง)  ยกเลิก = กลับไปแก้เลข')) return;
      var newRR = ST.add('runrate', { dealerId: dealerId, projectId: runrateProjectId, status: 'active', createdAt: now });
      if (typeof syncItemToFirebase === 'function') syncItemToFirebase('runrate', newRR);
      rrMatch = newRR;
    }
    runrateId = rrMatch.id;
  }

  // ผูกใบเสนอราคาให้ SO นี้เสมอ — เลือกไว้แล้วรายการไม่ตรง (แก้/เพิ่มสินค้าในฟอร์มนี้) ก็ sync กลับเข้าใบเสนอราคา
  // ตัวนั้นทันทีโดยไม่ต้องถาม (ใบเสนอราคา = single source of truth เดียวกับ SO ไม่ต้องไปแก้คนละที่)
  // ไม่ได้เลือกไว้เลยก็สร้างใบเสนอราคาใหม่ให้อัตโนมัติ พร้อมเงื่อนไขชำระเงินที่กรอกในฟอร์มนี้
  if (quotationId) {
    if (typeof _soSyncQuoteItems === 'function') _soSyncQuoteItems(quotationId, items, paymentTerm);
  } else if (typeof _soAutoCreateQuotation === 'function') {
    var pipe2 = pipelineId ? ST.getOne('pipeline', pipelineId) : null;
    var newQ = _soAutoCreateQuotation({ dealerId: dealerId, dealerName: dealer ? dealer.name : '', pipelineId: pipelineId, poNo: customerPO, projectName: pipe2 ? pipe2.projectName : '', paymentTerm: paymentTerm }, items);
    if (newQ) quotationId = newQ.id;
  }

  // บันทึก Project ID / เงื่อนไขชำระเงิน / ที่อยู่จัดส่งที่พิมพ์เองไว้กลับเข้าข้อมูล Dealer — ครั้งหน้าจะดึง
  // มา suggest ได้เลยไม่ต้องพิมพ์ซ้ำ (ดู _soSaveBackToDealer)
  _soSaveBackToDealer(dealerId, { projectId: projectId, paymentTerm: paymentTerm, deliveryAddress: deliveryAddress });

  // ---- Project ID: เขียนกลับไปที่โครงการต้นทางให้ด้วย ----
  // Project ID เป็นของโครงการ ไม่ใช่ของ SO — เก็บไว้บน SO เพื่ออ้างอิงได้เร็ว แต่ต้นทางคือ pipeline
  // กติกาการเขียนกลับอยู่ใน pidWriteBackToPipeline (utils.js) ใช้ร่วมกับใบเสนอราคา จะได้ไม่มีสองมาตรฐาน
  if (projectId && pipelineId) pidWriteBackToPipeline(pipelineId, projectId, 'กรอกตอนสร้าง SO ' + soNumber);

  // เอกสารใบนี้ระบุไปแล้วว่าเลขนี้เป็นโครงการหรือ run rate — ถ้าทะเบียน Project ID ยังไม่รู้ ก็ถือว่ารู้แล้ว
  // (เลข run rate อยู่ที่ถัง ไม่ได้อยู่บน SO จึงต้องหยิบจากถังที่ผูก)
  if (typeof djpNoteKindFromDoc === 'function') {
    if (type === 'runrate') djpNoteKindFromDoc(((runrateId && ST.getOne('runrate', runrateId)) || {}).projectId, 'runrate');
    else djpNoteKindFromDoc(projectId, 'project');
  }

  var obj = {
    soNumber: soNumber, type: type, dealerId: dealerId, dealerName: dealer ? dealer.name : '',
    customerPO: customerPO, customerPODate: customerPODate, pipelineId: pipelineId, quotationId: quotationId, projectId: projectId,
    deliveryAddress: deliveryAddress, paymentTerm: paymentTerm,
    // ยังไม่ได้เลข SO จริงจาก Sales Support — soNumber ที่กรอกไว้เป็นแค่เลขร่างชั่วคราว กันชนกับเลขจริงที่จะออกมาทีหลัง (ดู confirmSoNumberFromSalesSupport)
    pendingSoNumber: pendingSoNumber,
    // ถัง Run rate ที่ SO ใบนี้ผูกอยู่ — ยอดของใบนี้จะถูกนับรวมในถังนั้น (ดู _rrTotal ใน views-runrate.js)
    runrateId: runrateId,
    runrateProjectId: runrateId ? ((ST.getOne('runrate', runrateId) || {}).projectId || '') : '',
    prNumber: '', poNumber: '', invoiceNumber: '', invoiceDate: '', doNumber: '', expectedDelivery: '',
    status: 'po_received', items: items, saleName: cfg.saleName||'',
    logs: [{ date: _td(), action: pendingSoNumber ? '📄 ส่งรายละเอียดให้ Sales Support (รอเลข SO)' : '📄 สร้าง SO / ได้รับ PO', note: note||'', by: cfg.saleName||'' }],
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
  body += '<button type="button" class="btn bo bsm" style="margin-bottom:8px" onclick="closeMForce();showSOBulkExtendBookingM(\'' + soId + '\')" title="เลื่อนกำหนดจองคลังหลายรายการพร้อมกันในครั้งเดียว (ปิดฟอร์มนี้ก่อน)">📅 เลื่อนจองหลายรายการ</button>';
  // hidden dealerId ไว้ให้ _soItemModelChanged รู้เลเวลของ Dealer เวลาเติมราคาอัตโนมัติให้สินค้าที่พิมพ์/เพิ่มใหม่ (ใช้ id เดียวกับฟอร์มสร้าง SO)
  body += '<input type="hidden" id="soN_dealerId" value="' + sanitize(s.dealerId || '') + '">';
  body += buildAdminModelDatalist('soItemModelDL');
  body += '<div id="soN_items">';
  (s.items || []).forEach(function(it, idx) { body += _soItemRowHtml(idx, it.model, it.qty, it.unitPrice, it.sku, it, s); });
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
    // แถวที่มาจาก s.items เดิม (id="soIR_<index ของ s.items>") ต้อง merge ทับของเดิมไว้ ไม่งั้นฟิลด์ที่ไม่มีในฟอร์มนี้
    // (คอมเมนต์ ลิงก์ serials ส่วนลดเงินสดต่อรายการ ฯลฯ — ดู saveSOItemComment/saveSOItemLink/saveSOStatus) จะหายทุกครั้งที่กดบันทึก
    var rowIdx = row.id.replace('soIR_', '');
    var existing = /^\d+$/.test(rowIdx) ? (s.items || [])[Number(rowIdx)] : null;
    var base = existing ? Object.assign({}, existing) : { serials: [] };
    items.push(Object.assign(base, { model: mEl.value.trim(), sku: skuEl ? skuEl.value.trim() : '', qty: Number(qEl.value) || 1, unitPrice: parseNum(pEl.value) || 0 }, _soReadItemSourceFields(row)));
  });
  if (!items.length) { alert('กรุณาใส่รายการสินค้าอย่างน้อย 1 รายการ'); return; }

  // แก้วันจอง/วันจองถึงของรายการที่จองจาก 1021 ตรงนี้ได้เลย — sync กลับเข้า lot จริงในคลังให้ด้วย (ซิงก์ 2 ทาง
  // กับหน้าจัดการคลัง ไม่ต้องไปเปิดอีกหน้าแยกแค่เพื่อแก้วันที่) ไม่เช็คแค่ sourceType==='reserve_1021' อีกต่อไป
  // เพราะตอนจองคลังจริงบางส่วน (partial lock) dropdown ด้านบนอาจเลือกสถานะอื่นไว้สำหรับส่วนที่เหลือ (เช่น pr_po)
  // แต่ reserveDate/reserveExpiryDate ที่อ่านมาจากกล่องล็อกยังต้อง sync กลับ lot จริงเสมอ — ฟังก์ชันนี้แตะเฉพาะ
  // lot ที่ผูกกับ SO นี้จริงใน 1021 อยู่แล้ว ไม่มีผลถ้าไม่มี lot จริง จึงเรียกแบบไม่มีเงื่อนไขได้อย่างปลอดภัย
  if (typeof stockSyncSOItemReservation === 'function') {
    items.forEach(function(it) {
      if (it.sku && it.reserveDate) stockSyncSOItemReservation(it.sku, soId, it.reserveDate, it.reserveExpiryDate);
    });
  }

  // ใบเสนอราคาที่ผูกไว้ = single source of truth เดียวกับ SO — แก้รายการตรงนี้แล้ว sync กลับไปตรงนั้นทันที ไม่ถาม ไม่สร้าง revision
  var quotationId = s.quotationId;
  if (quotationId && typeof _soSyncQuoteItems === 'function') _soSyncQuoteItems(quotationId, items);

  var cfg = getConfig();
  var logs = (s.logs || []).slice();
  logs.push({ date: _td(), action: '✏️ แก้ไขรายการสินค้า', note: '', by: cfg.saleName || '' });
  var updatedSO = ST.update('salesOrders', soId, { items: items, quotationId: quotationId, updatedAt: new Date().toISOString(), logs: logs });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
  closeMForce();
  toast('💾 บันทึกรายการสินค้าแล้ว');
  go('soDetail', { soId: soId });
}

// เลื่อนกำหนดจองหลายรายการของ SO เดียวกันพร้อมกันในครั้งเดียว — ส่วนใหญ่ของ SO เดียวกันจองพร้อมกัน
// วันเลื่อนเลยมักจะเหมือนกันทุกรายการ ไม่ต้องกด "🔄 เลื่อน" ทีละรายการแบบเดิม (showStockExtendBookingM)
// เลือกได้ว่าจะตั้งวันเดียวกันทุกรายการที่เลือก (ปุ่ม "ใช้วันเดียวกันทุกรายการ" คัดลอกวันจากช่องบนลงทุกแถวที่ติ๊ก)
// หรือจะกำหนดวันแยกเป็นรายการไปก็ได้
//
// รวม "รายการที่จองจริง" 2 แบบที่มีอยู่ในระบบ (เดิมเช็คแบบแรกอย่างเดียว ทำให้ SO ที่มีทั้ง 2 แบบปนกันเลื่อนได้
// แค่บางรายการ ทั้งที่หน้า SO detail โชว์ชิปจองให้ดูเหมือนจองแล้วทุกรายการ — ดู [[so-bulk-extend-booking-2026-10-21]]):
//  kind:'lot'  — มี lot จริงผูกคลัง (stockSOItemReadyInfo .lotId) → เลื่อนผ่าน stockExtendBooking ต่อ lot
//               เหมือนเดิม จึงได้ประวัติเลื่อนจอง (bookingHistory) แยกต่อรายการครบเหมือนปุ่มเดี่ยว
//  kind:'self' — แค่ประกาศแผนเอง (item.sourceType='reserve_1021'/'reserve_8d01' + reserveExpiryDate พิมพ์เอง
//               ในฟอร์มแก้ไขรายการ) ไม่มี lot จริงผูกอยู่ (ปุ่ม "🔄 เลื่อน" เดี่ยวก็ไม่มีให้กดแบบนี้เหมือนกัน) →
//               เลื่อนด้วยการเขียนทับ item.reserveExpiryDate ตรงๆ แล้วบันทึก SO ครั้งเดียว ไม่มี lot ให้ล็อก history ต่อ lot
function showSOBulkExtendBookingM(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s || !s.items || !s.items.length) return;
  var rows = [];
  (s.items || []).forEach(function(it, idx) {
    var info = (it.sku && typeof stockSOItemReadyInfo === 'function') ? stockSOItemReadyInfo(it.sku, it.qty, s) : null;
    var bookedForThisSO = info ? info.bookedForThisSO : 0;
    if (info && info.tracked && bookedForThisSO > 0 && info.lotId) {
      rows.push({ kind: 'lot', sku: it.sku, model: it.model || it.sku, qty: bookedForThisSO, lotId: info.lotId, expiry: info.bookingExpiryDate || '', location: info.bookedLocation || '1021' });
    }
    var deliveredForThisSO = info ? info.deliveredForThisSO : 0;
    var unbookedQty = Math.max(0, (Number(it.qty) || 0) - bookedForThisSO - deliveredForThisSO);
    var selfDeclared = (it.sourceType === 'reserve_1021' && unbookedQty > 0) || it.sourceType === 'reserve_8d01';
    if (selfDeclared) {
      rows.push({ kind: 'self', idx: idx, model: it.model || it.sku, qty: unbookedQty, expiry: it.reserveExpiryDate || '', location: it.sourceType === 'reserve_1021' ? '1021' : '8D01' });
    }
  });
  if (!rows.length) { alert('SO นี้ไม่มีรายการที่จองคลังไว้ให้เลื่อน'); return; }
  var body = '<div class="hint" style="margin-bottom:8px">เลือกรายการที่ต้องการเลื่อนกำหนดจอง — ตั้งวันเดียวกันทุกรายการที่เลือก หรือกำหนดวันแยกเป็นรายการก็ได้</div>';
  body += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;padding:6px;border:1px solid var(--border);border-radius:6px;flex-wrap:wrap">' +
    '<input type="date" class="inp" id="soBulkExt_globalDate" style="flex:1;min-width:130px">' +
    '<button type="button" class="btn bo bsm" onclick="_soBulkExtApplySameDate()">ใช้วันเดียวกันทุกรายการ</button>' +
    '</div>';
  body += '<label style="display:flex;gap:6px;align-items:center;font-size:12px;margin-bottom:6px"><input type="checkbox" id="soBulkExt_all" checked onchange="_soBulkExtToggleAll(this.checked)"> เลือกทั้งหมด</label>';
  body += '<div id="soBulkExt_rows">';
  rows.forEach(function(r) {
    var chkAttrs = r.kind === 'lot'
      ? ' data-kind="lot" data-lotid="' + sanitize(r.lotId) + '" data-sku="' + sanitize(r.sku) + '"'
      : ' data-kind="self" data-idx="' + r.idx + '"';
    body += '<div style="border:1px solid var(--border);border-radius:6px;padding:6px;margin-bottom:6px">' +
      '<label style="display:flex;gap:6px;align-items:center;font-size:12px">' +
      '<input type="checkbox" class="soBulkExt_chk" checked' + chkAttrs + '>' +
      '<b>' + sanitize(r.model) + '</b> <span style="color:var(--text2)">(' + r.qty + ' ชิ้น — ' + sanitize(r.location) + (r.kind === 'self' ? ' · แผนที่ประกาศไว้ ยังไม่มี lot จริง' : '') + ')</span>' +
      '</label>' +
      '<div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">' +
      '<span class="hint" style="font-size:10px;min-width:95px">เดิมถึง ' + (r.expiry ? fD(r.expiry) : '—') + '</span>' +
      '<input type="date" class="inp soBulkExt_date" style="flex:1;min-width:130px" value="' + sanitize(r.expiry) + '">' +
      '</div></div>';
  });
  body += '</div>';
  body += '<div class="fg" style="margin-top:6px"><label>ผู้อนุมัติเลื่อนจอง <small style="color:var(--text2)">(ใช้ร่วมทุกรายการที่บันทึกครั้งนี้ — มีผลเฉพาะรายการที่มี lot จริง)</small></label><input class="inp" type="text" id="soBulkExt_approved"></div>';
  body += '<button class="btn bp btn-full" style="margin-top:10px" onclick="saveSOBulkExtendBooking(\'' + soId + '\')">💾 บันทึกเลื่อนจองที่เลือก</button>';
  openM('📅 เลื่อนวันจองหลายรายการ — ' + sanitize(s.soNumber || ''), body);
}

function _soBulkExtToggleAll(checked) {
  document.querySelectorAll('.soBulkExt_chk').forEach(function(c) { c.checked = checked; });
}

function _soBulkExtApplySameDate() {
  var g = document.getElementById('soBulkExt_globalDate');
  if (!g || !g.value) { alert('กรุณาเลือกวันที่ในช่องด้านบนก่อน'); return; }
  document.querySelectorAll('#soBulkExt_rows > div').forEach(function(row) {
    var chk = row.querySelector('.soBulkExt_chk');
    var dateEl = row.querySelector('.soBulkExt_date');
    if (chk && chk.checked && dateEl) dateEl.value = g.value;
  });
}

function saveSOBulkExtendBooking(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var approvedEl = document.getElementById('soBulkExt_approved');
  var approved = approvedEl ? approvedEl.value.trim() : '';
  var items = (s.items || []).slice();
  var selfChanged = false;
  var count = 0;
  document.querySelectorAll('#soBulkExt_rows > div').forEach(function(row) {
    var chk = row.querySelector('.soBulkExt_chk');
    var dateEl = row.querySelector('.soBulkExt_date');
    if (!chk || !chk.checked || !dateEl || !dateEl.value) return;
    if (chk.getAttribute('data-kind') === 'self') {
      var idx = Number(chk.getAttribute('data-idx'));
      if (items[idx]) { items[idx] = Object.assign({}, items[idx], { reserveExpiryDate: dateEl.value }); selfChanged = true; }
    } else {
      var sku = chk.getAttribute('data-sku');
      var lotId = chk.getAttribute('data-lotid');
      var productName = (typeof getProductBySku === 'function' && getProductBySku(sku) || {}).name || '';
      stockExtendBooking(sku, productName, lotId, dateEl.value, approved, true);
    }
    count++;
  });
  if (!count) { alert('กรุณาเลือกอย่างน้อย 1 รายการ และระบุวันที่ให้ครบ'); return; }
  // รายการแผนที่ประกาศเอง (ไม่มี lot จริง) ไม่มี history ต่อ lot ให้ผูก — บันทึก log เดียวลง SO แทน เพื่อให้รู้ว่าเลื่อนไปวันไหนเมื่อไหร่
  if (selfChanged) {
    var cfg = typeof getConfig === 'function' ? getConfig() : {};
    var logs = (s.logs || []).slice();
    logs.push({ date: _td(), action: '📅 เลื่อนวันจองหลายรายการ (แผนที่ประกาศไว้)', note: approved ? 'ผู้อนุมัติ: ' + approved : '', by: (cfg && cfg.saleName) || '' });
    var updated = ST.update('salesOrders', soId, { items: items, updatedAt: new Date().toISOString(), logs: logs });
    if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updated);
  }
  closeMForce();
  toast('🔄 เลื่อนกำหนดจอง ' + count + ' รายการแล้ว');
  go('soDetail', { soId: soId });
}

function deleteSalesOrder(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  if (!confirm('ลบ ' + (s.soNumber||'SO นี้') + '?')) return;
  ST.delete('salesOrders', soId);
  if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('salesOrders', soId);
  if (typeof addAuditLog === 'function') addAuditLog('delete_so', 'salesOrder', soId, s.soNumber, s.dealerId, s.dealerName);
  go('salesOrders');
  showUndoToast('🗑️ ลบ ' + (s.soNumber||'SO') + ' แล้ว', function() {
    ST.add('salesOrders', s);
    if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', s);
    go('soDetail', { soId: soId });
    toast('↩️ กู้คืน SO แล้ว');
  });
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

  // Invoice + DO section — DO:Invoice ผูก 1:1 กับ SO นี้เสมอ (ไม่รองรับส่งบางส่วนหลายรอบ)
  html += '<div id="soSt_invSec" style="display:none"><div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">DO Number</label><input id="soSt_doNum" class="inp" placeholder="DO-20261021-XXX" value="' + sanitize(s.doNumber||_soNextDONum()) + '"></div>';
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
  var logEntry = { date: _td(), action: info.icon + ' ' + info.label, note: note, by: cfg.saleName||'', fromStatus: s.status, toStatus: nextSt };

  // PR/PO fields
  if (nextSt === 'so_open') {
    var prNum = (document.getElementById('soSt_prNum')||{}).value;
    var eta   = (document.getElementById('soSt_eta') ||{}).value;
    if (prNum) update.prNumber = prNum;
    if (eta)   update.expectedDelivery = eta;
  }

  // Invoice + DO fields — DO:Invoice ผูก 1:1 กับ SO นี้เสมอ
  var isShip = ['shipped','invoiced'].indexOf(nextSt) !== -1;
  if (isShip) {
    var doNum   = (document.getElementById('soSt_doNum')  ||{}).value;
    var invNum  = (document.getElementById('soSt_invNum') ||{}).value;
    var invDate = (document.getElementById('soSt_invDate')||{}).value;
    if (doNum)   update.doNumber      = doNum;
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

// ---------------------------------------------------------------- ย้อนกลับสถานะ (กันกดผิด)

var _SO_ORDER = ['po_received', 'so_open', 'partial_shipped', 'shipped', 'invoiced', 'closed'];

// หาสถานะก่อนหน้าจาก log จริง (fromStatus ที่บันทึกไว้ตอนเปลี่ยนสถานะ) — แม่นกว่าไล่ตามลำดับเฉยๆ เพราะบางเส้นทาง
// ข้ามขั้นได้ (เช่น so_open -> shipped ตรงๆ ไม่ผ่าน partial_shipped) ถ้าไม่มี log เก่าพอ (ข้อมูลก่อนมีฟีเจอร์นี้) ค่อย fallback ไปไล่ลำดับแทน
function _soPrevStatusFromLogs(s) {
  var logs = s.logs || [];
  for (var i = logs.length - 1; i >= 0; i--) {
    if (logs[i].toStatus === s.status && logs[i].fromStatus) return logs[i].fromStatus;
  }
  var idx = _SO_ORDER.indexOf(s.status);
  return idx > 0 ? _SO_ORDER[idx - 1] : null;
}

function revertSOStatus(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var prev = _soPrevStatusFromLogs(s);
  if (!prev) { toast('⚠️ ไม่มีสถานะก่อนหน้าให้ย้อนกลับ'); return; }
  var curInfo  = SO_STATUS[s.status] || { label: s.status, icon: '?' };
  var prevInfo = SO_STATUS[prev]     || { label: prev,     icon: '?' };
  if (!confirm('ย้อนสถานะจาก "' + curInfo.label + '" กลับไปเป็น "' + prevInfo.label + '" ใช่หรือไม่?\n(ย้อนได้ทีละขั้น และบันทึกไว้ใน Timeline)')) return;

  var cfg  = getConfig();
  var logs = (s.logs || []).slice();
  logs.push({ date: _td(), action: '↩️ ย้อนกลับสถานะ → ' + prevInfo.icon + ' ' + prevInfo.label, note: 'ย้อนจาก ' + curInfo.label, by: cfg.saleName || '', fromStatus: s.status, toStatus: prev });
  var updatedSO = ST.update('salesOrders', soId, { status: prev, logs: logs, updatedAt: new Date().toISOString() });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
  toast('↩️ ย้อนสถานะแล้ว');
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
  _soRerenderKeepScroll();
}

// ลิงก์อิสระต่อรายการสินค้าใน SO (เช่น ลิงก์จองของ 1021, ลิงก์คุย Vendor) — ไม่ผูกกับระบบไหน วางอะไรก็ได้
function saveSOItemLink(soId, idx, value) {
  var s = ST.getOne('salesOrders', soId);
  if (!s || !s.items || !s.items[idx]) return;
  var items = s.items.slice();
  items[idx] = Object.assign({}, items[idx], { link: value.trim() });
  var updatedSO = ST.update('salesOrders', soId, { items: items, updatedAt: new Date().toISOString() });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updatedSO);
}

// ---------------------------------------------------------------- edit modal

// ตัวเลือกโครงการสำหรับหน้าแก้ไข SO — เกณฑ์เดียวกับฟอร์มสร้าง (เฉพาะที่ Win แล้ว) บวกอันที่ SO ใบนี้ผูกอยู่
// เผื่อสถานะโครงการถูกย้อนกลับไปหลังเปิด SO ไปแล้ว จะได้ไม่หลุดออกจากรายการจนแก้อะไรไม่ได้
function _soPipelineOptionsHtml(dealerId, keepId) {
  var list = ST.getAll('pipeline').filter(function(p) {
    if (p.id === keepId) return true;
    if (!pipeIsWon(p)) return false;
    return !dealerId || p.dealerId === dealerId;
  }).sort(function(a, b) { return (a.projectName || '') > (b.projectName || '') ? 1 : -1; });
  var h = '<option value="">-- ไม่ระบุ / เลือกทีหลัง --</option>';
  list.forEach(function(p) {
    var d = ST.getOne('dealers', p.dealerId);
    h += '<option value="' + p.id + '"' + (keepId === p.id ? ' selected' : '') + '>' +
      sanitize(pipeRowPrefix(p) + (p.projectName || '(ไม่มีชื่อ)').substr(0, 40)) + (d ? ' [' + sanitize(d.name) + ']' : '') + '</option>';
  });
  return h;
}

// ชื่อที่มนุษย์อ่านรู้เรื่องว่ายอดของ SO ใบนี้ไปเข้าที่ไหน — ใช้ในข้อความยืนยันตอนย้ายการผูก
function _soLinkLabel(type, pipelineId, runrateId) {
  if (type === 'runrate') {
    var r = runrateId ? ST.getOne('runrate', runrateId) : null;
    return r ? ('ถัง Run rate ' + (r.projectId || '(ไม่มีเลข)')) : 'Run rate (ยังไม่ผูกถัง)';
  }
  var p = pipelineId ? ST.getOne('pipeline', pipelineId) : null;
  return p ? ('โครงการ ' + (p.projectName || '(ไม่มีชื่อ)')) : 'โครงการ (ยังไม่ผูก)';
}

function _soEditTypeToggle(type) {
  var pipeSec = document.getElementById('soE_pipeSec');
  var rrSec = document.getElementById('soE_rrSec');
  if (pipeSec) pipeSec.style.display = type === 'project' ? '' : 'none';
  if (rrSec) rrSec.style.display = type === 'runrate' ? '' : 'none';
  // ตั้งใจ "ไม่" ล้างค่าของฝั่งที่ซ่อน — saveSOEdit ล้างให้ตามประเภทตอนบันทึกอยู่แล้ว ถ้ามาล้างตรงนี้ด้วย
  // แค่สลับโหมดดูแล้วสลับกลับ โครงการ/ถังที่ผูกไว้เดิมจะหายทันทีทั้งที่ยังไม่ได้กดบันทึกอะไรเลย
  _soEditLinkNote();
}

// เปลี่ยน Dealer ในหน้าแก้ไข → รายการโครงการ/ถังต้องกรองตามไปด้วย ไม่งั้นค้างของเจ้าเดิมให้เลือกผิด
function _soEditDealerChanged(dealerId) {
  var pSel = document.getElementById('soE_pipelineId');
  if (pSel) { var kp = pSel.value; pSel.innerHTML = _soPipelineOptionsHtml(dealerId, kp); if (pSel.value !== kp) pSel.value = ''; }
  // เปลี่ยน Dealer ใหม่แล้ว — ถ้าถัง Run rate ที่ผูกอยู่ไม่ใช่ของ Dealer ใหม่นี้ ให้เคลียร์ทิ้ง (เลือก/พิมพ์ใหม่เอง)
  var rrIdEl = document.getElementById('soE_runrateId');
  if (rrIdEl && rrIdEl.value) {
    var rr = ST.getOne('runrate', rrIdEl.value);
    if (!rr || rr.dealerId !== dealerId) {
      rrIdEl.value = '';
      var rrPidEl = document.getElementById('soE_runrateProjectId');
      if (rrPidEl) rrPidEl.value = '';
    }
  }
  _soFilterAddressByDealer(dealerId);
  _soEditLinkNote();
}

// คำเตือนสดใต้ส่วนการผูกงาน — บอกก่อนกดบันทึกว่ายอดกำลังจะย้ายไปไหน และเลข Project ID มีปัญหาอะไรไหม
function _soEditLinkNote() {
  var note = document.getElementById('soE_linkNote');
  if (!note) return;
  var s = window._soEditOrig || {};
  var type = (document.getElementById('soE_type') || {}).value || 'project';
  var pipeId = (document.getElementById('soE_pipelineId') || {}).value || '';
  var rrId = (document.getElementById('soE_runrateId') || {}).value || '';
  var rrTyped = pidNorm((document.getElementById('soE_runrateProjectId') || {}).value);
  var pidEl = document.getElementById('soE_projectId');
  var typed = pidNorm((pidEl || {}).value);

  var msgs = [], hasWarn = false;
  var oldType = s.type || (s.runrateId ? 'runrate' : 'project');
  var moved = (oldType !== type) || (type === 'runrate' && (s.runrateId || '') !== rrId) ||
              (type === 'project' && (s.pipelineId || '') !== pipeId);
  if (moved) {
    var amt = (typeof _rrSOTotal === 'function') ? _rrSOTotal(s) : 0;
    msgs.push('↔️ ยอด ฿' + fmtMoney(amt) + ' จะย้าย: ' +
      _soLinkLabel(oldType, s.pipelineId, s.runrateId) + ' → ' + _soLinkLabel(type, pipeId, rrId));
    hasWarn = true;
  }
  if (type === 'runrate') {
    var rr = rrId ? ST.getOne('runrate', rrId) : null;
    if (rr) {
      var n = (typeof _rrSOs === 'function') ? _rrSOs(rr.id).length : 0;
      msgs.push('ℹ️ ยอดของ SO ใบนี้จะไปรวมใน ' + (rr.projectId || '(ไม่มีเลข)') + ' — ตอนนี้มี ' + n + ' ใบอยู่ในถังแล้ว' +
        ((rr.status || 'active') !== 'active' ? '  ·  ⚠️ ถังนี้ปิดอยู่' : ''));
    } else if (rrTyped) {
      msgs.push('↩︎ ยังไม่มีถังนี้ — ตอนกด "บันทึก" จะสร้างถัง Run rate ใหม่เลขนี้ให้อัตโนมัติ');
    }
    var fmtRR = pidFormatWarning(rrTyped);
    if (fmtRR) { msgs.push('⚠️ ' + fmtRR); hasWarn = true; }
  }
  if (type === 'project' && typed) {
    var p = pipeId ? ST.getOne('pipeline', pipeId) : null;
    var onPipe = p ? pidNorm(p.projectId) : '';
    if (p && !onPipe) msgs.push('↩︎ ตอนบันทึกจะเขียน Project ID กลับไปที่โครงการให้ด้วย');
    else if (p && !pidSame(onPipe, typed)) { msgs.push('⚠️ ไม่ตรงกับของเดิมในโครงการ (' + onPipe + ') — ตอนบันทึกจะถามก่อน'); hasWarn = true; }
    var fmt = pidFormatWarning(typed);
    if (fmt) { msgs.push('⚠️ ' + fmt); hasWarn = true; }
  }
  note.textContent = msgs.join('\n');
  note.style.whiteSpace = 'pre-line';
  note.style.color = hasWarn ? 'var(--warn, #f59e0b)' : 'var(--text2)';
}

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
  html += '<div style="flex:1"><label class="lbl">DO Number</label><input id="soE_doNum" class="inp" value="' + sanitize(s.doNumber||'') + '"></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">Dealer</label><select id="soE_dealer" class="inp" onchange="_soEditDealerChanged(this.value)">' + dOpts + '</select></div>';
  html += '</div>';
  html += '<div><label class="lbl">📍 ที่อยู่จัดส่ง</label><select id="soN_addressSel" class="inp" onchange="_soAddressSelChanged(this.value)">' + _soAddressOptionsHtml(s.dealerId, s.deliveryAddress) + '</select>';
  html += '<textarea id="soN_deliveryAddress" class="inp" rows="2" style="margin-top:6px">' + sanitize(s.deliveryAddress||'') + '</textarea></div>';

  // ---- ชื่อโครงการ / เลขที่โครงการ / Remark — คนละช่องกับ Project ID (เลขทะเบียน CRM) ด้านล่าง ----
  html += '<div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">📁 ชื่อโครงการ</label><input id="soE_projectName" class="inp" value="' + sanitize(s.projectName||'') + '" placeholder="เช่น ติดตั้งระบบโดรนตรวจสต็อก คลัง BKK3"></div>';
  html += '<div style="flex:1"><label class="lbl">🔢 เลขที่โครงการ</label><input id="soE_projectNumber" class="inp" value="' + sanitize(s.projectNumber||'') + '" placeholder="เช่น PRJ-2026-0142"></div>';
  html += '</div>';
  html += '<div><label class="lbl">📝 Remark <span style="font-size:10px;color:var(--text2)">(เช่น timeline ที่ลูกค้าต้องการส่งมอบ หรือข้อความอื่นๆ)</span></label><textarea id="soE_remark" class="inp" rows="2">' + sanitize(s.remark||'') + '</textarea></div>';

  // ---- การผูกงาน: โครงการ หรือ Run rate + Project ID ----
  // เดิมแก้ได้แค่ตอนสร้าง SO เท่านั้น พอได้เลข CRM มาทีหลัง (ซึ่งเป็นเรื่องปกติ) เลยเติมไม่ได้ ต้องไปแก้ที่
  // Pipeline แทน — และ SO ที่ผูกถังผิดก็ย้ายถังไม่ได้เลย ต้องลบทิ้งแล้วเปิดใหม่
  var curType = s.type || (s.runrateId ? 'runrate' : 'project');
  var curRRProjectId = s.runrateProjectId || ((s.runrateId && (ST.getOne('runrate', s.runrateId) || {}).projectId) || '');
  html += '<div style="border:1px solid var(--border);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px">';
  html += '<div><label class="lbl">ประเภท</label><select id="soE_type" class="inp" onchange="_soEditTypeToggle(this.value)">' +
    '<option value="project"' + (curType === 'project' ? ' selected' : '') + '>📋 Project</option>' +
    '<option value="runrate"' + (curType === 'runrate' ? ' selected' : '') + '>🏪 Run rate</option>' +
    '</select></div>';
  html += '<div id="soE_pipeSec"' + (curType !== 'project' ? ' style="display:none"' : '') + '>' +
    '<label class="lbl">Pipeline Project</label>' +
    '<select id="soE_pipelineId" class="inp" onchange="_soEditLinkNote()">' + _soPipelineOptionsHtml(s.dealerId, s.pipelineId || '') + '</select>' +
    '<div class="ac-wrap" style="margin-top:8px"><label class="lbl">Project ID <span style="font-size:10px;color:var(--text2)">(' + PROJECT_ID_HINT + ')</span></label>' +
    '<input id="soE_projectId" class="inp" autocomplete="off" value="' + sanitize(curType !== 'runrate' ? (s.projectId || '') : '') + '" placeholder="20260912-0005" oninput="_soEditLinkNote();_soEditProjectIdSearch(this.value)" onfocus="_soEditProjectIdSearch(this.value)">' +
    '<div id="soE_projectIdAcMenu"></div></div>' +
    '</div>';
  // ช่อง Project ID (Run rate) แบบพิมพ์ค้นหา/สร้างใหม่ได้เลย เหมือนฟอร์มสร้าง SO (ดู _soRunrateSearchCore) —
  // เดิมเป็น <select> เลือกได้แต่ถังที่มีอยู่แล้ว พิมพ์เลขใหม่เองไม่ได้ ต้องไปสร้างถังที่เมนู Run Rate ก่อน
  html += '<div id="soE_rrSec"' + (curType !== 'runrate' ? ' style="display:none"' : '') + '>' +
    '<div class="ac-wrap"><label class="lbl">Project ID (Run rate) <span style="font-size:10px;color:var(--text2)">(เลขที่ลูกค้าสร้างไว้รับยอด — พิมพ์เลขเดิมที่เคยใช้กับ Dealer นี้เพื่อเลือก หรือพิมพ์เลขใหม่เพื่อสร้างถังใหม่ตอนบันทึก)</span></label>' +
    '<input id="soE_runrateProjectId" class="inp" autocomplete="off" value="' + sanitize(curRRProjectId) + '" placeholder="20260912-0005" oninput="_soEditLinkNote();_soEditRunrateSearch(this.value)" onfocus="_soEditRunrateSearch(this.value)">' +
    '<div id="soE_runrateAcMenu"></div>' +
    '<input type="hidden" id="soE_runrateId" value="' + sanitize(s.runrateId || '') + '"></div>' +
    '</div>';
  html += '<div id="soE_linkNote" class="hint" style="font-size:11px"></div>';
  html += '</div>';

  html += '<div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">PO ลูกค้า</label><input id="soE_po" class="inp" value="' + sanitize(s.customerPO||'') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">📅 วันที่ PO ลูกค้า</label><input id="soE_poDate" class="inp" type="date" value="' + (s.customerPODate||'') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">PR ภายใน</label><input id="soE_pr" class="inp" value="' + sanitize(s.prNumber||'') + '"></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<div style="flex:1"><label class="lbl">ETA จาก Vendor</label><input id="soE_eta" class="inp" type="date" value="' + (s.expectedDelivery||'') + '"></div>';
  html += '<div style="flex:1"><label class="lbl">📌 วันที่ต้องติดตาม (Due)</label><input id="soE_due" class="inp" type="date" value="' + (s.dueDate||'') + '"></div>';
  html += '</div>';
  html += attachUploadHtml('_soAttach', 'salesOrders', '📷 รูปแนบ (PO/Delivery Note/ใบตรวจรับ/สินค้าที่ส่งจริง)');
  html += '<button class="btn bp" onclick="saveSOEdit(\'' + soId + '\')">💾 บันทึก</button></div>';
  openM('✏️ แก้ไข SO', html);
  // เก็บสภาพเดิมไว้เทียบว่าการผูกงานเปลี่ยนไปไหม — อ่านจากฟอร์มอย่างเดียวไม่รู้ว่าย้ายมาจากไหน
  window._soEditOrig = s;
  _soEditLinkNote();
}

function saveSOEdit(soId) {
  var s = ST.getOne('salesOrders', soId);
  if (!s) return;
  var dealerId = (document.getElementById('soE_dealer')||{}).value || s.dealerId;
  var dealer   = ST.getOne('dealers', dealerId);
  var newSoNumber = (document.getElementById('soE_soNum')||{}).value || s.soNumber;

  // ---- การผูกงาน: โครงการ หรือ Run rate อย่างใดอย่างหนึ่ง (กติกาเดียวกับ saveCreateSO) ----
  var linkType   = (document.getElementById('soE_type')||{}).value || s.type || (s.runrateId ? 'runrate' : 'project');
  var pipelineId = (document.getElementById('soE_pipelineId')||{}).value || '';
  var runrateId  = (document.getElementById('soE_runrateId') ||{}).value || '';
  var runrateProjectId = ((document.getElementById('soE_runrateProjectId')||{}).value || '').trim();
  var projectId  = pidNorm((document.getElementById('soE_projectId')||{}).value);
  if (linkType === 'runrate') { pipelineId = ''; projectId = ''; } else { runrateId = ''; }

  // ถัง Run rate: ช่อง Project ID อาจชี้ถังเดิม (runrateId มี hidden id มาแล้ว) หรือพิมพ์เลขใหม่ที่ยังไม่มีถัง —
  // หาถังเดิมของ Dealer นี้ที่ตรงเลขก่อน ไม่เจอค่อยสร้างถังใหม่ให้อัตโนมัติ (กติกาเดียวกับ saveCreateSO)
  if (linkType === 'runrate' && runrateProjectId) {
    var rrMatch = runrateId ? ST.getOne('runrate', runrateId) : null;
    if (!rrMatch || pidNorm(rrMatch.projectId) !== pidNorm(runrateProjectId)) {
      rrMatch = ST.getAll('runrate').filter(function(r) { return r.dealerId === dealerId && pidSame(r.projectId, runrateProjectId); })[0] || null;
    }
    if (!rrMatch) {
      var dupRR = (typeof _rrFindByProjectId === 'function') ? _rrFindByProjectId(runrateProjectId, null) : null;
      if (dupRR && !confirm('Project ID "' + runrateProjectId + '" ถูกใช้เป็นถัง Run rate ของ ' +
          ((typeof _rrDealerName === 'function' && _rrDealerName(dupRR.dealerId)) || 'Dealer อื่น') + ' อยู่แล้ว\n\n' +
          'ต้องการสร้างถังใหม่เลขเดียวกันนี้แยกให้ ' + (dealer ? dealer.name : 'Dealer นี้') + 'ไหม?\n\n' +
          'ตกลง = สร้างถังใหม่ (เลขซ้ำกันคนละถัง)  ยกเลิก = กลับไปแก้เลข')) return;
      var newRR = ST.add('runrate', { dealerId: dealerId, projectId: runrateProjectId, status: 'active', createdAt: new Date().toISOString() });
      if (typeof syncItemToFirebase === 'function') syncItemToFirebase('runrate', newRR);
      rrMatch = newRR;
    }
    runrateId = rrMatch.id;
  }

  // ยอดของถัง/โครงการคำนวณสดจาก SO ที่ผูกอยู่ (ดู _rrTotal) การย้ายจึงมีผลทันทีกับตัวเลขสองฝั่ง
  // — ต้องบอกให้ชัดก่อนว่าเงินก้อนไหนกำลังย้ายจากไหนไปไหน ไม่ใช่เปลี่ยนเงียบๆ
  var oldType = s.type || (s.runrateId ? 'runrate' : 'project');
  var linkMoved = (oldType !== linkType) ||
                  (linkType === 'runrate' && (s.runrateId || '') !== runrateId) ||
                  (linkType === 'project' && (s.pipelineId || '') !== pipelineId);
  if (linkMoved) {
    var movedAmt = (typeof _rrSOTotal === 'function') ? _rrSOTotal(s) : 0;
    if (!confirm('ย้ายการผูกยอดของ SO ' + (s.soNumber || '') + '\n\n' +
        'ยอด ฿' + fmtMoney(movedAmt) + '\n' +
        'จาก: ' + _soLinkLabel(oldType, s.pipelineId, s.runrateId) + '\n' +
        'ไป: ' + _soLinkLabel(linkType, pipelineId, runrateId) + '\n\n' +
        'ตกลง = ย้ายตามนี้  ยกเลิก = ไม่บันทึก')) return;
  }

  // รูปแบบเลขแปลก = เตือนแล้วให้ตัดสินใจ ไม่บล็อก (พิมพ์ไว้ก่อนแล้วมาแก้ทีหลังได้)
  var pidWarn = pidFormatWarning(projectId);
  if (pidWarn && !confirm('⚠️ ' + pidWarn + '\n\nที่กรอก: ' + projectId + '\n\nตกลง = บันทึกตามนี้  ยกเลิก = กลับไปแก้')) return;

  // เขียนกลับไปที่โครงการต้นทาง — ตัวกลางเดียวกับฟอร์มสร้าง SO และใบเสนอราคา
  if (linkType === 'project' && projectId && pipelineId) {
    pidWriteBackToPipeline(pipelineId, projectId, 'แก้ไข SO ' + newSoNumber);
  }
  if (typeof djpNoteKindFromDoc === 'function') {
    if (linkType === 'runrate') djpNoteKindFromDoc(((runrateId && ST.getOne('runrate', runrateId)) || {}).projectId, 'runrate');
    else djpNoteKindFromDoc(projectId, 'project');
  }

  var editedAddress = ((document.getElementById('soN_deliveryAddress')||{}).value || '').trim();
  if (typeof _soSaveBackToDealer === 'function') _soSaveBackToDealer(dealerId, { projectId: projectId, deliveryAddress: editedAddress });

  var updatedSO = ST.update('salesOrders', soId, {
    soNumber:         newSoNumber,
    type:             linkType,
    pipelineId:       pipelineId,
    projectId:        projectId,
    runrateId:        runrateId,
    // เลขของถังที่ denormalize ไว้ตอนสร้าง SO — ต้องอัปเดตตามถังใหม่ ไม่งั้นจะค้างเลขถังเดิมไว้หลอกตา
    runrateProjectId: runrateId ? ((ST.getOne('runrate', runrateId) || {}).projectId || '') : '',
    invoiceNumber:    (document.getElementById('soE_invNum')||{}).value || '',
    invoiceDate:      (document.getElementById('soE_invDate')||{}).value || '',
    doNumber:         (document.getElementById('soE_doNum')||{}).value || '',
    dealerId:         dealerId,
    dealerName:       dealer ? dealer.name : s.dealerName,
    customerPO:       (document.getElementById('soE_po')||{}).value || '',
    customerPODate:   (document.getElementById('soE_poDate')||{}).value || '',
    prNumber:         (document.getElementById('soE_pr')||{}).value || '',
    projectName:      (document.getElementById('soE_projectName')||{}).value || '',
    projectNumber:    (document.getElementById('soE_projectNumber')||{}).value || '',
    remark:           (document.getElementById('soE_remark')||{}).value || '',
    deliveryAddress:  ((document.getElementById('soN_deliveryAddress')||{}).value || '').trim(),
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
  // ใช้ราคาหลังหักส่วนลด (เงินสดต่อรายการ/ส่วนลดอื่นๆ/ส่วนลดท้ายบิล) ตรงกับที่ _soFillFromQuote ใช้ เพื่อให้
  // รายการสินค้าในฟอร์ม SO ตรงกับยอดในใบเสนอราคาเสมอ ไม่ว่าจะเข้าทางไหน
  var discItems = (typeof _soQuoteDiscountedItems === 'function') ? _soQuoteDiscountedItems(q) : (q.items || []);
  var presetItems = (discItems || []).map(function(it){
    return { model: it.name || it.model || '', sku: it.sku || '', qty: Number(it.quantity) || 1, unitPrice: Number(it.unitPrice) || 0, serials: [],
      cashDiscountPercent: Number(it.cashDiscountPercent) || 0, _origUnitPrice: Number(it._origUnitPrice) || 0 };
  });
  // สืบทอดการผูกงานจากใบเสนอราคามาเลย ไม่ต้องมาเลือก/พิมพ์เลขซ้ำอีกรอบ — ใบเสนอราคาเป็นจุดที่มักได้
  // Project ID มาก่อน SO อยู่แล้ว (ดู _quoteLinkSectionHtml ใน views-quotation.js)
  showCreateSOModal({
    pipelineId: q.pipelineId || '', quotationId: q.id, dealerId: q.dealerId || '',
    customerPO: q.poNo || '', presetItems: presetItems, paymentTerm: q.paymentTerm || '',
    linkType: q.linkType || (q.runrateId ? 'runrate' : (q.pipelineId ? 'project' : '')),
    projectId: q.projectId || '', runrateId: q.runrateId || ''
  });
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
  // มาจากผลค้นหา (Ctrl+K) — เติมเลขให้แล้วค้นเลย ไม่ต้องพิมพ์ซ้ำ
  if (S && S.serial) {
    document.getElementById('serQ').value = S.serial;
    runSerialSearch();
  }
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

  // ไม่เจอใน SO ไม่ได้แปลว่าไม่เคยขาย — SO ในแอปมี serial เฉพาะที่มีคนพิมพ์ใส่ไว้เอง ส่วนสมุดเดินของ DJI
  // มีทุกเครื่องที่เคยออกจากคลัง จึงเป็นด่านที่สอง ไม่ใช่ของเสริม (ดู views-djiledger.js)
  if (!matches.length) {
    var led = (typeof _djlSearchSN === 'function') ? _djlSearchSN(q) : [];
    if (led.length) {
      out.innerHTML = '<div class="hint" style="margin-bottom:10px">ไม่พบใน Sales Order ของเรา แต่เจอในสมุดเดินของ DJI — ' +
        'แปลว่าเครื่องออกจากคลังไปแล้วแต่ยังไม่ได้ผูกกับ SO ใบไหน</div>' +
        led.map(_djlSNCardHtml).join('');
      return;
    }
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
    html += '</table>';
    // ประวัติจากฝั่ง DJI — บอกได้ว่าเครื่องนี้เคยถูกคืนแล้วส่งใหม่ไหม ซึ่ง SO ใบเดียวไม่มีทางบอก
    if (typeof djlSNHistoryHtml === 'function') html += djlSNHistoryHtml(m.serial);
    html += '</div>';
  });

  out.innerHTML = html;
}

// ================================================================
// สรุปของพร้อมส่งให้ลูกค้า (รวมหลาย SO/PO ของดีลเลอร์เดียวกัน) — เลือกรายการที่จะส่งวันนี้ ปรับจำนวนได้
// ดูพรีวิวข้อความ/ตารางแล้วคัดลอกส่งลูกค้าหรือเซลได้ จากนั้นคอนเฟิร์มบันทึกส่งมอบรวดเดียวทุก PO ผ่าน
// soRecordShipmentRound() ตัวเดิมที่มีอยู่แล้ว (ไม่ต้องไปเปิดทีละ SO) — มาจาก mockup ที่ยืนยันแบบกับผู้ใช้แล้ว
// ================================================================

function showReadySummaryForSelectedSO() {
  var ids = Object.keys(soSelected);
  if (!ids.length) return;
  var list = ids.map(function(id) { return ST.getOne('salesOrders', id); }).filter(Boolean);
  var dealerKeys = {};
  list.forEach(function(s) { dealerKeys[s.dealerId || s.dealerName || '-'] = true; });
  if (Object.keys(dealerKeys).length > 1) { toast('⚠️ เลือก SO ของดีลเลอร์เดียวกันเท่านั้น'); return; }
  showReadySummaryModal(ids);
}

// ทุกรายการมี SKU ที่ยังส่งไม่ครบ (remainingQty > 0) — รวมรายการที่ยังไม่มีของพร้อมส่งเลยด้วย (โชว์ไว้ให้เห็น ไม่ซ่อน)
// readyQty = จองใน 1021 แล้ว + มีใน 1001 ที่ยังไม่จอง (ของจริงที่ส่งได้ตอนนี้โดยไม่ต้องรอ QI ขึ้นทะเบียน/PR-PO)
// shortfall = ส่วนที่เกินกว่าของจริงที่มี ต้องจองคลัง/สั่งซื้อเพิ่มก่อนถึงจะส่งได้
function _readySummaryCollectData(soIds) {
  var out = [];
  soIds.forEach(function(soId) {
    var s = ST.getOne('salesOrders', soId);
    if (!s) return;
    var rows = [];
    (s.items || []).forEach(function(it) {
      if (!it.sku) return;
      var info = (typeof stockSOItemReadyInfo === 'function') ? stockSOItemReadyInfo(it.sku, it.qty, s) : null;
      if (!info) return;
      var orderedQty = Number(it.qty) || 0;
      var deliveredQty = info.deliveredForThisSO || 0;
      var remainingQty = Math.max(0, orderedQty - deliveredQty);
      if (remainingQty <= 0) return; // ส่งครบแล้ว ไม่ต้องโชว์อีก
      var qty1021 = info.bookedForThisSO || 0;
      var qty0001 = info.from0001 || 0;
      var readyQty = Math.min(qty1021 + qty0001, remainingQty);
      rows.push({
        sku: it.sku, model: it.model || it.sku, orderedQty: orderedQty, deliveredQty: deliveredQty,
        remainingQty: remainingQty, readyQty: readyQty, qty1021: qty1021, qty0001: qty0001,
        shortfall: Math.max(0, remainingQty - readyQty),
        unitPrice: Number(it.unitPrice) || 0,
        comment: it.comment || ''
      });
    });
    if (rows.length) out.push({ so: s, rows: rows });
  });
  return out;
}

function showReadySummaryModal(soIds) {
  var data = _readySummaryCollectData(soIds);
  if (!data.length) { toast('✅ ใบที่เลือกส่งครบทุกรายการแล้ว ไม่มีอะไรเหลือให้ส่ง'); return; }
  var dealerName = data[0].so.dealerName || '-';
  var html = '<div id="rsPick">';
  html += '<div class="hint" style="margin-bottom:8px">🏢 ' + sanitize(dealerName) + ' — เลือกรายการที่จะส่งวันนี้ ปรับจำนวนได้ไม่เกินของจริงที่มี (รายการที่ยังไม่มีของพร้อมส่งจะถูกบล็อกไว้)</div>';
  data.forEach(function(d) {
    var s = d.so;
    var _rsPid = _soDisplayProjectId(s);
    html += '<div class="rs-po" data-soid="' + s.id + '" data-sonumber="' + sanitize(s.soNumber || '') + '" data-po="' + sanitize(s.customerPO || '') +
      '" data-project="' + sanitize(s.projectName || '') + '" data-projectid="' + sanitize(_rsPid) +
      '" data-term="' + sanitize(s.paymentTerm || 'ไม่ระบุเงื่อนไขชำระ') + '" style="border:1px solid var(--border);border-radius:10px;margin-bottom:10px;overflow:hidden">';
    html += '<div style="padding:8px 10px;background:var(--bg2)">';
    html += '<b>' + sanitize(s.soNumber || s.customerPO || '-') + '</b>' + (s.customerPO ? ' · PO ' + sanitize(s.customerPO) : '') +
      (s.projectName ? ' · ' + sanitize(s.projectName) : '');
    html += '<div style="font-size:11px;color:var(--text2);margin-top:2px">' +
      (_rsPid ? 'Project ID: ' + sanitize(_rsPid) + ' · ' : '') +
      '💳 ' + sanitize(s.paymentTerm || 'ไม่ระบุเงื่อนไขชำระ') + '</div>';
    html += '</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>' +
      '<th style="padding:6px 8px;text-align:center;width:28px"></th><th style="padding:6px 8px;text-align:left">สินค้า</th>' +
      '<th style="padding:6px 8px;text-align:right">สั่งทั้งหมด</th><th style="padding:6px 8px;text-align:right">พร้อมส่ง</th>' +
      '<th style="padding:6px 8px;text-align:right">คงเหลือ</th><th style="padding:6px 8px;text-align:right">ราคา/หน่วย</th>' +
      '<th style="padding:6px 8px;text-align:right">รวม</th>' +
      '</tr></thead><tbody>';
    d.rows.forEach(function(r) {
      var hasStock = r.readyQty > 0;
      html += '<tr class="rs-item" data-sku="' + sanitize(r.sku) + '" data-model="' + sanitize(r.model) + '" data-ordered="' + r.orderedQty +
        '" data-q1021max="' + r.qty1021 + '" data-q0001max="' + r.qty0001 + '" data-price="' + r.unitPrice +
        '" data-shortfall="' + r.shortfall + '" data-comment="' + sanitize(r.comment || '') + '" style="border-top:1px solid var(--border)">';
      html += '<td style="padding:6px 8px;text-align:center"><input type="checkbox" ' + (hasStock ? 'checked' : 'disabled') + ' onchange="_rsRecalc()"></td>';
      html += '<td style="padding:6px 8px">' + sanitize(r.model) + ' <span style="color:var(--text2);font-size:10px">(' + sanitize(r.sku) + ')</span></td>';
      html += '<td style="padding:6px 8px;text-align:right">' + r.orderedQty + '</td>';
      html += '<td style="padding:6px 8px;text-align:right">';
      html += '<input type="number" class="inp rs-qty" style="width:64px;text-align:right" value="' + r.readyQty + '" min="0" max="' + r.readyQty + '" oninput="_rsClampQty(this)"' + (hasStock ? '' : ' disabled') + '>';
      if (!hasStock) {
        html += '<div style="font-size:9px;color:#ef4444;margin-top:2px;font-weight:600">❌ ไม่มีสต็อกให้ส่ง ต้องจองคลัง/สั่งซื้อก่อน</div>';
      } else if (r.shortfall > 0) {
        html += '<div style="font-size:9px;color:#b45309;margin-top:2px;font-weight:600">⚠️ ขาดอีก ' + r.shortfall + ' ต้องจองคลัง/สั่งซื้อเพิ่ม</div>';
      }
      html += '</td>';
      html += '<td class="rs-remain" style="padding:6px 8px;text-align:right"></td>';
      html += '<td style="padding:6px 8px;text-align:right">฿' + fmtMoney(r.unitPrice) + '</td>';
      html += '<td class="rs-linetotal" style="padding:6px 8px;text-align:right;font-weight:600"></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div style="padding:6px 10px;background:var(--bg2);text-align:right;font-size:12px">ยอดพร้อมส่ง (ใบนี้): <b class="rs-posubtotal">—</b></div>';
    html += '</div>';
  });
  html += '<button class="btn bp btn-full" style="margin-top:6px" onclick="_rsShowPreview()">👁️ ดูพรีวิว &amp; คัดลอกสรุป</button>';
  html += '</div>';

  html += '<div id="rsPreview" style="display:none">';
  html += '<div class="hint" style="margin-bottom:8px">💬 ข้อความสรุปส่งลูกค้า</div>';
  html += '<div id="rsPreviewText" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px;white-space:pre-wrap;max-height:260px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Consolas,monospace"></div>';
  html += '<button class="btn bo btn-full" style="margin-top:8px" onclick="_rsCopyMessage()">📋 คัดลอกข้อความ</button>';
  html += '<div style="margin-top:14px;font-size:12px;font-weight:600">📊 รายละเอียดจัดส่ง — แยก PO / เงื่อนไขเครดิต / รวมทั้งหมด</div>';
  html += '<div style="overflow-x:auto;margin-top:6px"><table id="rsDetailTable" style="width:100%;border-collapse:collapse;font-size:12px;min-width:840px"></table></div>';
  html += '<button class="btn bo btn-full" style="margin-top:8px" onclick="_rsCopyExcel()">📋 คัดลอกเป็นตาราง (วางใน Excel ได้เลย — ใช้ส่งเซลได้ด้วย)</button>';
  html += '<div style="display:flex;gap:8px;margin-top:14px">';
  html += '<button class="btn bo" style="flex:1" onclick="_rsBackToPick()">← กลับไปแก้รายการ</button>';
  html += '<button class="btn bp" style="flex:1" onclick="_rsConfirm()">✅ คอนเฟิร์ม — บันทึกส่งมอบ</button>';
  html += '</div>';
  html += '</div>';

  openM('📦 สรุปของพร้อมส่งให้ลูกค้า', html);
  if (typeof setMWide === 'function') setMWide(760);
  _rsRecalc();
}

function _rsClampQty(input) {
  var max = Number(input.max) || 0;
  var v = Math.max(0, Math.min(max, Math.round(Number(input.value) || 0)));
  input.value = v;
  _rsRecalc();
}

function _rsRecalc() {
  document.querySelectorAll('.rs-po').forEach(function(po) {
    var subtotal = 0;
    po.querySelectorAll('.rs-item').forEach(function(row) {
      var cb = row.querySelector('input[type=checkbox]');
      var qtyInput = row.querySelector('.rs-qty');
      var ordered = Number(row.dataset.ordered) || 0;
      var qty = cb.checked ? (Number(qtyInput.value) || 0) : 0;
      var price = Number(row.dataset.price) || 0;
      var lineTotal = qty * price;
      var remain = Math.max(0, ordered - qty);
      row.querySelector('.rs-remain').textContent = remain;
      row.querySelector('.rs-linetotal').textContent = '฿' + fmtMoney(lineTotal);
      if (cb.checked && qty > 0) subtotal += lineTotal;
    });
    var subtotalEl = po.querySelector('.rs-posubtotal');
    if (subtotalEl) subtotalEl.textContent = '฿' + fmtMoney(subtotal);
  });
}

function _rsCollectSelection() {
  var byTerm = {};
  var poLines = [];
  document.querySelectorAll('.rs-po').forEach(function(po) {
    var rows = []; var poTotal = 0;
    po.querySelectorAll('.rs-item').forEach(function(row) {
      var cb = row.querySelector('input[type=checkbox]');
      var qty = Number(row.querySelector('.rs-qty').value) || 0;
      if (!cb.checked || qty <= 0) return;
      var ordered = Number(row.dataset.ordered) || 0;
      var price = Number(row.dataset.price) || 0;
      var lineTotal = qty * price;
      rows.push({
        sku: row.dataset.sku, model: row.dataset.model, qty: qty, ordered: ordered,
        remain: Math.max(0, ordered - qty), price: price, lineTotal: lineTotal,
        q1021max: Number(row.dataset.q1021max) || 0, q0001max: Number(row.dataset.q0001max) || 0,
        shortfall: Number(row.dataset.shortfall) || 0, comment: row.dataset.comment || ''
      });
      poTotal += lineTotal;
    });
    if (rows.length) {
      var term = po.dataset.term || 'ไม่ระบุเงื่อนไขชำระ';
      poLines.push({
        soId: po.dataset.soid, soNumber: po.dataset.sonumber, poNumber: po.dataset.po,
        project: po.dataset.project, projectId: po.dataset.projectid, term: term, rows: rows, poTotal: poTotal
      });
      byTerm[term] = (byTerm[term] || 0) + poTotal;
    }
  });
  return { poLines: poLines, byTerm: byTerm };
}

function _rsHeadLabel(po) {
  var head = po.poNumber ? ('PO ' + po.poNumber) : ('SO ' + (po.soNumber || '-'));
  if (po.project) head += ' · ' + po.project;
  return head;
}

function _rsBuildPreviewText(sel) {
  var lines = [];
  lines.push('สวัสดีครับ/ค่ะ วันนี้มีของพร้อมส่งดังนี้ครับ/ค่ะ 👇');
  lines.push('');
  sel.poLines.forEach(function(po) {
    var itemsTxt = po.rows.map(function(r) { return 'สินค้า ' + r.model + ' ' + r.qty + ' ชิ้น'; }).join(' ');
    lines.push('📦 ' + _rsHeadLabel(po) + (po.projectId ? ' · Project ID: ' + po.projectId : '') + '  ' + itemsTxt);
  });
  lines.push('');
  lines.push('รวมยอดตามเงื่อนไขชำระ:');
  Object.keys(sel.byTerm).forEach(function(term) {
    lines.push('• ' + term + '  ฿' + fmtMoney(sel.byTerm[term]));
  });
  lines.push('');
  lines.push('รบกวนลูกค้าเตรียมเช็คตามเงื่อนไขด้านบน แล้วคอนเฟิร์มรับของตามนี้ได้เลยไหมครับ/คะ 🙏');
  return lines.join('\n');
}

// สถานะพร้อมส่งต่อแถว — ใช้ shortfall ที่ผ่านมากับ dataset ของ modal (ดู _rsCollectSelection) ไม่ต้องคำนวณใหม่
function _rsRowStatusText(r) {
  return r.shortfall > 0 ? '⚠️ ขาดอีก ' + r.shortfall : '✅ พร้อมส่ง';
}

function _rsBuildDetailHtml(sel) {
  var html = '<thead><tr><th style="text-align:left;padding:6px 8px;font-size:10.5px;color:var(--text2)">PO / SO</th>' +
    '<th style="text-align:left;padding:6px 8px;font-size:10.5px;color:var(--text2)">Project ID / ชื่อโครงการ</th>' +
    '<th style="text-align:left;padding:6px 8px;font-size:10.5px;color:var(--text2)">สินค้า</th>' +
    '<th style="text-align:left;padding:6px 8px;font-size:10.5px;color:var(--text2)">สถานะ</th>' +
    '<th style="text-align:left;padding:6px 8px;font-size:10.5px;color:var(--text2)">คอมเมนต์</th>' +
    '<th style="text-align:right;padding:6px 8px;font-size:10.5px;color:var(--text2)">สั่งทั้งหมด</th>' +
    '<th style="text-align:right;padding:6px 8px;font-size:10.5px;color:var(--text2)">พร้อมส่ง</th>' +
    '<th style="text-align:right;padding:6px 8px;font-size:10.5px;color:var(--text2)">คงเหลือ</th>' +
    '<th style="text-align:right;padding:6px 8px;font-size:10.5px;color:var(--text2)">ราคา/หน่วย</th>' +
    '<th style="text-align:right;padding:6px 8px;font-size:10.5px;color:var(--text2)">รวม</th></tr></thead><tbody>';
  var grand = 0;
  var byTermOrder = [];
  sel.poLines.forEach(function(po) { if (byTermOrder.indexOf(po.term) === -1) byTermOrder.push(po.term); });
  byTermOrder.forEach(function(term) {
    html += '<tr style="background:var(--accent-bg,rgba(37,99,235,.08))"><td colspan="10" style="padding:6px 8px;font-weight:700">💳 ' + sanitize(term) + '</td></tr>';
    sel.poLines.filter(function(po) { return po.term === term; }).forEach(function(po) {
      po.rows.forEach(function(r, idx) {
        html += '<tr style="border-top:1px solid var(--border)">';
        html += idx === 0 ? ('<td style="padding:6px 8px">' + sanitize(_rsHeadLabel(po).split(' · ')[0]) + '<span style="color:var(--text2);font-size:10px;display:block">' + sanitize(po.soNumber || '') + '</span></td>') : '<td></td>';
        html += idx === 0 ? ('<td style="padding:6px 8px">' + sanitize(po.projectId || '-') + '<span style="color:var(--text2);font-size:10px;display:block">' + sanitize(po.project || '') + '</span></td>') : '<td></td>';
        html += '<td style="padding:6px 8px">' + sanitize(r.model) + '</td>';
        html += '<td style="padding:6px 8px">' + sanitize(_rsRowStatusText(r)) + '</td>';
        html += '<td style="padding:6px 8px">' + sanitize(r.comment || '') + '</td>';
        html += '<td style="padding:6px 8px;text-align:right">' + r.ordered + '</td>';
        html += '<td style="padding:6px 8px;text-align:right">' + r.qty + '</td>';
        html += '<td style="padding:6px 8px;text-align:right">' + r.remain + '</td>';
        html += '<td style="padding:6px 8px;text-align:right">฿' + fmtMoney(r.price) + '</td>';
        html += '<td style="padding:6px 8px;text-align:right">฿' + fmtMoney(r.lineTotal) + '</td>';
        html += '</tr>';
      });
      html += '<tr><td colspan="9" style="padding:6px 8px;text-align:right;color:var(--text2)">รวม ' + sanitize(_rsHeadLabel(po)) + '</td><td style="padding:6px 8px;text-align:right;font-weight:600">฿' + fmtMoney(po.poTotal) + '</td></tr>';
    });
    html += '<tr style="background:var(--accent-bg,rgba(37,99,235,.08))"><td colspan="9" style="padding:6px 8px;text-align:right;font-weight:700">รวม ' + sanitize(term) + '</td><td style="padding:6px 8px;text-align:right;font-weight:700">฿' + fmtMoney(sel.byTerm[term]) + '</td></tr>';
    grand += sel.byTerm[term];
  });
  html += '<tr style="border-top:1.5px solid var(--text)"><td colspan="9" style="padding:7px 8px;text-align:right;font-weight:700">รวมทั้งหมดทุก PO</td><td style="padding:7px 8px;text-align:right;font-weight:700">฿' + fmtMoney(grand) + '</td></tr>';
  html += '</tbody>';
  return html;
}

function _rsBuildExcelTSV(sel) {
  var lines = [];
  lines.push(['PO / SO', 'Project ID / ชื่อโครงการ', 'สินค้า', 'สถานะ', 'คอมเมนต์', 'สั่งทั้งหมด', 'พร้อมส่ง', 'คงเหลือ', 'ราคา/หน่วย', 'รวม'].join('\t'));
  var grand = 0;
  var byTermOrder = [];
  sel.poLines.forEach(function(po) { if (byTermOrder.indexOf(po.term) === -1) byTermOrder.push(po.term); });
  byTermOrder.forEach(function(term) {
    lines.push('💳 ' + term);
    sel.poLines.filter(function(po) { return po.term === term; }).forEach(function(po) {
      po.rows.forEach(function(r, idx) {
        lines.push([
          idx === 0 ? (_rsHeadLabel(po).split(' · ')[0] + ' (' + (po.soNumber || '') + ')') : '',
          idx === 0 ? ((po.projectId || '-') + ' (' + (po.project || '') + ')') : '',
          r.model, _rsRowStatusText(r), (r.comment || '').replace(/[\t\n\r]+/g, ' '),
          r.ordered, r.qty, r.remain, r.price.toFixed(2), r.lineTotal.toFixed(2)
        ].join('\t'));
      });
      lines.push(['', '', '', '', '', '', '', '', 'รวม ' + _rsHeadLabel(po), po.poTotal.toFixed(2)].join('\t'));
    });
    lines.push(['', '', '', '', '', '', '', '', 'รวม ' + term, sel.byTerm[term].toFixed(2)].join('\t'));
    grand += sel.byTerm[term];
  });
  lines.push(['', '', '', '', '', '', '', '', 'รวมทั้งหมดทุก PO', grand.toFixed(2)].join('\t'));
  return lines.join('\n');
}

var _rsLastSel = null;
function _rsShowPreview() {
  var sel = _rsCollectSelection();
  if (!sel.poLines.length) { toast('⚠️ ยังไม่ได้เลือกรายการที่จะส่ง'); return; }
  _rsLastSel = sel;
  document.getElementById('rsPreviewText').textContent = _rsBuildPreviewText(sel);
  document.getElementById('rsDetailTable').innerHTML = _rsBuildDetailHtml(sel);
  document.getElementById('rsPick').style.display = 'none';
  document.getElementById('rsPreview').style.display = 'block';
}
function _rsBackToPick() {
  document.getElementById('rsPick').style.display = 'block';
  document.getElementById('rsPreview').style.display = 'none';
}
function _rsCopyMessage() {
  if (!_rsLastSel) return;
  copyText(_rsBuildPreviewText(_rsLastSel), '📋 คัดลอกข้อความแล้ว — วางส่งลูกค้าได้เลย');
}
function _rsCopyExcel() {
  if (!_rsLastSel) return;
  copyText(_rsBuildExcelTSV(_rsLastSel), '📋 คัดลอกตารางแล้ว — วางใน Excel ได้เลย');
}

// คอนเฟิร์ม = บันทึกส่งมอบจริงทุก PO ที่เลือกไว้ในทีเดียว ผ่าน soRecordShipmentRound() ตัวเดิม (อัปเดตสต็อก,
// ประวัติการส่งมอบ, และเลื่อนสถานะ SO ให้อัตโนมัติ — เหมือนกดปุ่ม "บันทึกการส่งมอบรอบนี้" ทีละใบ แต่ทำรวดเดียวหลาย PO)
function _rsConfirm() {
  var sel = _rsCollectSelection();
  if (!sel.poLines.length) { toast('⚠️ ไม่มีรายการที่จะบันทึก'); return; }
  var totalQty = 0;
  sel.poLines.forEach(function(po) { po.rows.forEach(function(r) { totalQty += r.qty; }); });
  if (!confirm('คอนเฟิร์มว่าได้ส่งตามรายการนี้แล้ว?\nระบบจะบันทึกเป็นส่งมอบจริงในสต็อก รวม ' + sel.poLines.length + ' PO / ' + totalQty + ' ชิ้น\nดำเนินการต่อ?')) return;
  sel.poLines.forEach(function(po) {
    var roundItems = po.rows.map(function(r) {
      var q1021 = Math.min(r.qty, r.q1021max);
      var q0001 = r.qty - q1021;
      return { sku: r.sku, qty1021: q1021, qty0001: q0001 };
    });
    soRecordShipmentRound(po.soId, roundItems, '', '', '', 'บันทึกจากสรุปของพร้อมส่งลูกค้า (รวมหลาย PO)');
  });
  soSelected = {};
  soSelectMode = false;
  if (typeof poTrackerSelected !== 'undefined') poTrackerSelected = {};
  if (typeof poTrackerSelectMode !== 'undefined') poTrackerSelectMode = false;
  toast('✅ บันทึกส่งมอบแล้ว ' + sel.poLines.length + ' PO / ' + totalQty + ' ชิ้น');
  closeMForce();
  render();
}
