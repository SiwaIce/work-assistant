// ================================================================
// views-customersummary.js — สรุปรายลูกค้า (Dealer A/R Overview)
//
// รวม PO/SO ค้างส่ง + เครดิตที่ใช้ไปแล้ว + กำหนดชำระ ต่อ Dealer ข้ามทุก Sales Order — ไม่มีหน้าไหนรวม
// ยอดข้ามหลาย SO ต่อ Dealer มาก่อน (หน้า Dealers โฟกัส CRM, หน้า Sales Order เป็นรายการทีละใบ)
// ดึงข้อมูลจาก salesOrders ทั้งหมด ไม่เก็บ field ซ้ำ — การ์ดรายละเอียดเขียนครั้งเดียว ใช้ทั้งหน้าเมนูแยก
// ("สรุปรายลูกค้า") และแท็บในหน้า Dealer รายตัว (ดู dealerARSummaryTab ใน views-dealer.js)
//
// ข้อจำกัดที่รู้อยู่แล้ว (ไม่มี field ให้ในระบบตอนนี้ ใช้ค่าประมาณแทน ไม่ใช่ความจริงที่ยืนยันได้):
// - เทอมเครดิต (dealer.creditTerm) เป็น free text เช่น "เครดิต 30 วัน" — ที่นี่ parse ตัวเลขแรกที่เจอออกมา
//   เป็นจำนวนวัน ถ้า parse ไม่ได้ (เช่น "เงินสด", ว่าง) จะไม่คำนวณวันครบกำหนดให้
// - ไม่มี field บันทึกว่า invoice/การส่งมอบรอบไหน "ชำระแล้ว" จริงๆ — ใช้สถานะ SO (ปิด = ถือว่าชำระแล้ว)
//   เป็นตัวแทนไปก่อน ซึ่งไม่แม่นเท่าการบันทึกวันที่ชำระจริง
// ================================================================

var csViewMode = 'po'; // 'po' | 'so' | 'product'
var csSelectedDealerId = null;
var CS_DUE_SOON_DAYS = 7;
var CS_STALE_WARN_DAYS = 10;
var CS_STALE_BAD_DAYS = 20;

function _csParseCreditDays(creditTerm) {
  var m = String(creditTerm || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function _csSOsForDealer(dealerId) {
  return ST.getAll('salesOrders').filter(function(s) { return s.dealerId === dealerId; });
}

// ยอดเงินของรอบส่งมอบ 1 รอบ — จับคู่ sku ของรายการที่ส่งกับ unitPrice ของรายการเดียวกันใน SO
function _csShipmentAmount(so, shipment) {
  var items = so.items || [];
  return (shipment.items || []).reduce(function(sum, si) {
    var match = items.filter(function(it) { return it.sku && it.sku === si.sku; })[0];
    return sum + (Number(si.qty) || 0) * (match ? (Number(match.unitPrice) || 0) : 0);
  }, 0);
}

function _csShippedQtyForSku(so, sku) {
  var shipments = (typeof _soMigrateLegacyShipment === 'function') ? _soMigrateLegacyShipment(so) : (so.shipments || []);
  var sum = 0;
  shipments.forEach(function(sh) {
    (sh.items || []).forEach(function(si) { if (si.sku === sku) sum += Number(si.qty) || 0; });
  });
  return sum;
}

// รวม SO ของ Dealer เป็นกลุ่มตามเลข PO ลูกค้า (customerPO) — 1 PO อาจมีหลาย SO (แบ่งส่ง/ของมาไม่พร้อมกัน)
function _csGroupByPO(sos) {
  var map = {}, order = [];
  sos.forEach(function(s) {
    var key = s.customerPO || ('(ไม่มีเลข PO) ' + (s.soNumber || s.id));
    if (!map[key]) { map[key] = { poNo: key, projectId: s.projectId || '', sos: [] }; order.push(key); }
    if (!map[key].projectId && s.projectId) map[key].projectId = s.projectId;
    map[key].sos.push(s);
  });
  return order.map(function(k) { return map[k]; });
}

function _csDealerStats(d) {
  var sos = _csSOsForDealer(d.id);
  var creditDays = _csParseCreditDays(d.creditTerm);
  var poGroups = _csGroupByPO(sos);
  var openPoCount = 0, outstandingValue = 0, creditUsed = 0, nextDue = null;

  poGroups.forEach(function(pg) {
    var remainVal = 0;
    pg.sos.forEach(function(s) {
      (s.items || []).forEach(function(it) {
        var shipped = _csShippedQtyForSku(s, it.sku);
        var remain = Math.max(0, (Number(it.qty) || 0) - shipped);
        remainVal += remain * (Number(it.unitPrice) || 0);
      });
    });
    if (remainVal > 0) openPoCount++;
    outstandingValue += remainVal;
  });

  sos.forEach(function(s) {
    var paidProxy = s.status === 'closed';
    var shipments = (typeof _soMigrateLegacyShipment === 'function') ? _soMigrateLegacyShipment(s) : (s.shipments || []);
    shipments.forEach(function(sh) {
      if (paidProxy) return;
      var amt = _csShipmentAmount(s, sh);
      if (amt <= 0) return;
      creditUsed += amt;
      if (creditDays != null && sh.invoiceDate) {
        var due = _csAddDays(sh.invoiceDate, creditDays);
        if (!nextDue || due < nextDue) nextDue = due;
      }
    });
  });

  var creditLimit = parseFloat(String(d.creditLimit || '').replace(/,/g, '')) || 0;
  return {
    sos: sos, poGroups: poGroups, creditDays: creditDays,
    openPoCount: openPoCount, outstandingValue: Math.round(outstandingValue),
    creditLimit: creditLimit, creditUsed: Math.round(creditUsed), creditLeft: Math.round(creditLimit - creditUsed),
    nextDue: nextDue
  };
}

function _csAddDays(iso, n) {
  var dt = new Date(iso + 'T00:00:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}
function _csDaysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
function _csDueBadge(dueIso, sev) {
  if (!dueIso) return '<span class="badge" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:10px;padding:2px 8px;font-size:10px">ไม่มีค้างชำระ</span>';
  var diff = _csDaysBetween(_td(), dueIso);
  var color = diff < 0 ? '#f0685f' : (diff <= CS_DUE_SOON_DAYS ? '#eab63f' : '#64748b');
  var label = diff < 0 ? ('เกินกำหนด ' + Math.abs(diff) + ' วัน') : (diff <= CS_DUE_SOON_DAYS ? ('อีก ' + diff + ' วัน') : fD(dueIso));
  return '<span style="font-size:10px;padding:2px 8px;border-radius:10px;border:1px solid;white-space:nowrap;background:' + color + '22;border-color:' + color + '55;color:' + color + '">' + label + '</span>';
}

// ---------------- ต้องติดตามวันนี้ ----------------
function _csComputeAlerts() {
  var alerts = [];
  ST.getAll('dealers').forEach(function(d) {
    var sos = _csSOsForDealer(d.id);
    var creditDays = _csParseCreditDays(d.creditTerm);
    sos.forEach(function(s) {
      var paidProxy = s.status === 'closed';
      if (!paidProxy && creditDays != null) {
        var shipments = (typeof _soMigrateLegacyShipment === 'function') ? _soMigrateLegacyShipment(s) : (s.shipments || []);
        shipments.forEach(function(sh) {
          var amt = _csShipmentAmount(s, sh);
          if (amt <= 0 || !sh.invoiceDate) return;
          var due = _csAddDays(sh.invoiceDate, creditDays);
          var diff = _csDaysBetween(_td(), due);
          if (diff < 0) {
            alerts.push({ sev: 'bad', icon: '⏰', dealer: d, so: s, sortKey: diff,
              text: 'เกินกำหนดชำระ ' + Math.abs(diff) + ' วัน · ' + (sh.invoiceNumber || s.soNumber) + ' · ' + fmtMoney(amt) + ' ฿' });
          } else if (diff <= CS_DUE_SOON_DAYS) {
            alerts.push({ sev: 'warn', icon: '📅', dealer: d, so: s, sortKey: diff,
              text: 'ครบกำหนดชำระในอีก ' + diff + ' วัน · ' + (sh.invoiceNumber || s.soNumber) + ' · ' + fmtMoney(amt) + ' ฿' });
          }
        });
      }
      if (s.status === 'so_open') {
        var age = _csDaysBetween((s.createdAt || '').slice(0, 10) || _td(), _td());
        if (age >= CS_STALE_WARN_DAYS) {
          alerts.push({ sev: age >= CS_STALE_BAD_DAYS ? 'bad' : 'warn', icon: '🐌', dealer: d, so: s, sortKey: -age,
            text: 'เปิด ' + (s.soNumber || '-') + ' มา ' + age + ' วันแล้ว ยังไม่มีของเข้า' });
        }
      }
    });
  });
  alerts.sort(function(a, b) { return a.sortKey - b.sortKey; });
  return alerts;
}

function _csRenderAlertBox() {
  var alerts = _csComputeAlerts();
  var h = '<div class="card">' +
    '<h2>🔔 ต้องติดตามวันนี้ <span style="font-size:11px;font-weight:400;color:var(--text2);margin-left:auto">รวมทุก Dealer — เรียงจากเร่งด่วนที่สุด</span></h2>';
  if (!alerts.length) {
    h += '<div style="color:var(--text2);font-size:13px;padding:6px 2px">ไม่มีรายการต้องติดตามวันนี้ 🎉</div>';
  } else {
    h += '<div style="display:flex;flex-direction:column;gap:8px">';
    alerts.forEach(function(a) {
      var stripe = a.sev === 'bad' ? '#f0685f' : '#eab63f';
      h += '<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:var(--bg2);border-left:3px solid ' + stripe + ';cursor:pointer" onclick="go(\'soDetail\',{soId:\'' + a.so.id + '\'})">' +
        '<span style="font-size:17px">' + a.icon + '</span>' +
        '<div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:500">' + sanitize(a.text) + '</div>' +
        '<div style="font-size:11.5px;color:var(--text2);margin-top:2px">' + sanitize(a.dealer.name) + ' · ' + sanitize(a.so.customerPO || a.so.soNumber || '') + '</div></div>' +
        '<span style="font-size:11px;color:var(--accent);white-space:nowrap">เปิด SO →</span>' +
        '</div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}

// ---------------- หน้าเมนูแยก "สรุปรายลูกค้า" ----------------
function rCustomerSummary(el) {
  document.getElementById('pgT').textContent = '📊 สรุปรายลูกค้า';
  var dealers = ST.getAll('dealers');
  var rows = dealers.map(function(d) { return { d: d, st: _csDealerStats(d) }; })
    .filter(function(r) { return r.st.sos.length > 0; })
    .sort(function(a, b) { return b.st.outstandingValue - a.st.outstandingValue; });

  if (!csSelectedDealerId && rows.length) csSelectedDealerId = rows[0].d.id;

  var h = _csRenderAlertBox();

  h += '<div class="card"><h2>ภาพรวมทุก Dealer <span style="font-size:11px;font-weight:400;color:var(--text2);margin-left:auto">' + rows.length + ' Dealer มี Sales Order</span></h2>';
  h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:640px;font-size:13px">';
  h += '<thead><tr style="text-align:left">' +
    '<th style="padding:0 8px 8px;font-size:11px;color:var(--text2);text-transform:uppercase">Dealer</th>' +
    '<th style="padding:0 8px 8px;font-size:11px;color:var(--text2);text-transform:uppercase;text-align:center">PO ค้างส่ง</th>' +
    '<th style="padding:0 8px 8px;font-size:11px;color:var(--text2);text-transform:uppercase;text-align:right">ยอดค้างส่งรวม</th>' +
    '<th style="padding:0 8px 8px;font-size:11px;color:var(--text2);text-transform:uppercase">วงเงินเครดิต</th>' +
    '<th style="padding:0 8px 8px;font-size:11px;color:var(--text2);text-transform:uppercase">ครบกำหนดชำระใกล้สุด</th></tr></thead><tbody>';
  rows.forEach(function(r) {
    var pct = r.st.creditLimit ? Math.min(100, Math.round(r.st.creditUsed / r.st.creditLimit * 100)) : 0;
    var barColor = pct >= 90 ? '#f0685f' : pct >= 60 ? '#eab63f' : '#3ecf8e';
    var sel = r.d.id === csSelectedDealerId;
    h += '<tr style="cursor:pointer;' + (sel ? 'background:var(--accent-light,#17344a)' : '') + '" onclick="csSelectedDealerId=\'' + r.d.id + '\';render()">' +
      '<td style="padding:10px 8px;border-top:1px solid var(--border)"><div style="font-weight:600">' + sanitize(r.d.name) + '</div><div style="font-size:11px;color:var(--text2)">' + sanitize(r.d.sisCode || r.d.djiCode || '') + '</div></td>' +
      '<td style="padding:10px 8px;border-top:1px solid var(--border);text-align:center">' + r.st.openPoCount + '</td>' +
      '<td style="padding:10px 8px;border-top:1px solid var(--border);text-align:right">' + fmtMoney(r.st.outstandingValue) + ' ฿</td>' +
      '<td style="padding:10px 8px;border-top:1px solid var(--border)"><div style="height:6px;border-radius:4px;background:var(--bg2);overflow:hidden"><i style="display:block;height:100%;width:' + pct + '%;background:' + barColor + '"></i></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--text2);margin-top:3px"><span>ใช้ ' + fmtMoney(r.st.creditUsed) + '</span><span>วงเงิน ' + fmtMoney(r.st.creditLimit) + '</span></div></td>' +
      '<td style="padding:10px 8px;border-top:1px solid var(--border)">' + _csDueBadge(r.st.nextDue) + '</td>' +
      '</tr>';
  });
  h += '</tbody></table></div></div>';

  h += '<div class="card"><h2>รายละเอียดราย Dealer</h2>';
  if (!csSelectedDealerId) {
    h += '<div style="color:var(--text2);font-size:13px">ยังไม่มี Dealer ที่มี Sales Order</div>';
  } else {
    var sel2 = dealers.filter(function(d) { return d.id === csSelectedDealerId; })[0];
    h += sel2 ? _csRenderDealerCard(sel2, { embedded: false }) : '';
  }
  h += '</div>';

  el.innerHTML = h;
}

// ---------------- แท็บฝังในหน้า Dealer รายตัว (renderDealerTab ใน views-dealer.js เรียกเข้ามา) ----------------
function dealerARSummaryTab(d) {
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
    '<h2 style="margin:0;font-size:1rem">💳 สรุปค้างส่ง/เครดิต</h2>' +
    '<button class="btn bo bsm" onclick="csSelectedDealerId=\'' + d.id + '\';go(\'customerSummary\')">📊 ดูรวมทุก Dealer →</button></div>';
  h += _csRenderDealerCard(d, { embedded: true });
  return h;
}

// ---------------- การ์ดรายละเอียด Dealer — ใช้ทั้งหน้าแยกและแท็บฝังใน Dealer ----------------
function _csRenderDealerCard(d, opts) {
  opts = opts || {};
  var st = _csDealerStats(d);
  var pct = st.creditLimit ? Math.min(100, Math.round(st.creditUsed / st.creditLimit * 100)) : 0;
  var barColor = pct >= 90 ? '#f0685f' : pct >= 60 ? '#eab63f' : '#3ecf8e';

  var h = '';
  if (!opts.embedded) {
    h += '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-bottom:10px">' +
      '<div><div style="font-weight:700;font-size:15px">' + sanitize(d.name) + '</div>' +
      '<div style="font-size:11.5px;color:var(--text2)">เทอมเครดิต: ' + (st.creditDays != null ? st.creditDays + ' วัน' : '<span style="color:#eab63f">' + sanitize(d.creditTerm || '(ยังไม่ระบุ)') + ' — parse เป็นตัวเลขไม่ได้ คำนวณวันครบกำหนดให้ไม่ได้</span>') + '</div></div>' +
      '</div>';
  } else if (st.creditDays == null && d.creditTerm) {
    h += '<div style="font-size:11px;color:#eab63f;margin-bottom:8px">⚠ เทอมเครดิต "' + sanitize(d.creditTerm) + '" ไม่ใช่ตัวเลขวันล้วนๆ คำนวณวันครบกำหนดอัตโนมัติให้ไม่ได้</div>';
  }

  h += '<div class="card-grid" style="margin-bottom:10px">' +
    _csTile('PO ค้างส่ง', st.openPoCount + ' ใบ') +
    _csTile('ยอดค้างส่งรวม', fmtMoney(st.outstandingValue) + ' ฿') +
    _csTile('วงเงินเครดิต', fmtMoney(st.creditLimit) + ' ฿') +
    _csTile('ใช้เครดิตไปแล้ว', fmtMoney(st.creditUsed) + ' ฿') +
    _csTile('เครดิตคงเหลือ', fmtMoney(st.creditLeft) + ' ฿') +
    '</div>';
  h += '<div style="height:7px;border-radius:4px;background:var(--bg2);overflow:hidden;margin-bottom:14px"><i style="display:block;height:100%;width:' + pct + '%;background:' + barColor + '"></i></div>';

  h += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">' +
    _csViewBtn('po', '📦 ตาม PO ลูกค้า', d.id) +
    _csViewBtn('so', '📋 ตาม SO', d.id) +
    _csViewBtn('product', '🧰 ตามสินค้า', d.id) +
    '</div>';

  if (!st.sos.length) {
    h += '<div style="color:var(--text2);font-size:13px">Dealer นี้ยังไม่มี Sales Order</div>';
  } else if (csViewMode === 'po') {
    h += _csRenderByPO(d, st);
  } else if (csViewMode === 'so') {
    h += _csRenderBySO(d, st);
  } else {
    h += _csRenderByProduct(d, st);
  }
  return h;
}

function _csTile(label, val) {
  return '<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--bg2)">' +
    '<div style="font-size:10.5px;color:var(--text2);text-transform:uppercase;letter-spacing:.03em">' + label + '</div>' +
    '<div style="font-size:16px;font-weight:700;margin-top:2px">' + val + '</div></div>';
}
function _csViewBtn(mode, label, dealerId) {
  var act = csViewMode === mode;
  return '<button class="btn bsm ' + (act ? 'bp' : 'bo') + '" onclick="csViewMode=\'' + mode + '\';csSelectedDealerId=\'' + dealerId + '\';render()">' + label + '</button>';
}

function _csProjChip(pid) {
  if (!pid) return '';
  return ' <span onclick="event.stopPropagation();_csShowProjectModal(\'' + sanitize(pid) + '\')" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:var(--accent);background:var(--accent-light,#17344a);border-radius:999px;padding:2px 8px;white-space:nowrap">🗂️ ' + sanitize(pid) + '</span>';
}

function _csShowProjectModal(pid) {
  var p = (typeof djpFindByPid === 'function') ? djpFindByPid(pid) : null;
  var h;
  if (!p) {
    h = '<div style="color:var(--text2);font-size:13px">ไม่พบ Project ID นี้ในทะเบียน (อาจยังไม่ได้ import หรือเลขไม่ตรง)</div>';
  } else {
    h = '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<div><div style="font-weight:700;font-size:14px">' + sanitize(p.name || '-') + '</div>' +
      '<div style="font-size:11.5px;color:var(--text2);margin-top:2px">' + sanitize(pid) + '</div></div>' +
      '<div class="card-grid">' +
      _csTile('Dealer (CRM)', sanitize(p.acct || '-')) +
      _csTile('จังหวัด/ประเทศ', sanitize((p.prov || '') + (p.country ? ' / ' + p.country : '') || '-')) +
      _csTile('POC', sanitize(p.poc || '-')) +
      _csTile('ลงทะเบียนเมื่อ', sanitize(p.created || '-')) +
      '</div>' +
      '<button class="btn bo" onclick="closeM();djpQ=\'' + sanitize(pid) + '\';go(\'djiProjects\')">เปิดในทะเบียน Project ID →</button>' +
      '</div>';
  }
  openM('🗂️ รายละเอียด Project ID', h);
}

// ---------------- มุมมอง "ตาม PO ลูกค้า" ----------------
function _csRenderByPO(d, st) {
  var h = '';
  st.poGroups.forEach(function(pg, idx) {
    var items = {}; // รวม item ข้ามทุก SO ของ PO นี้ (match ด้วย sku ก่อน, ไม่มี sku ใช้ model)
    var order = [];
    pg.sos.forEach(function(s) {
      (s.items || []).forEach(function(it) {
        var key = it.sku || it.model;
        if (!items[key]) { items[key] = { model: it.model, qty: 0, shipped: 0, unitPrice: it.unitPrice || 0, perSo: [] }; order.push(key); }
        var shipped = _csShippedQtyForSku(s, it.sku);
        items[key].qty += Number(it.qty) || 0;
        items[key].shipped += shipped;
        items[key].perSo.push({ so: s, shipped: shipped });
      });
    });
    var totalQty = 0, shippedQty = 0, poValue = 0;
    order.forEach(function(k) { totalQty += items[k].qty; shippedQty += items[k].shipped; poValue += items[k].qty * items[k].unitPrice; });
    var badge = shippedQty === 0 ? _soStatusBadge(pg.sos[0].status) : (shippedQty < totalQty ? _soStatusBadge('partial_shipped') : _soStatusBadge('shipped'));

    h += '<details' + (idx === 0 ? ' open' : '') + ' style="border:1px solid var(--border);border-radius:11px;overflow:hidden;margin-bottom:10px">';
    h += '<summary style="padding:12px 14px;background:var(--bg2);cursor:pointer;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;list-style:none">' +
      '<span><b style="font-family:monospace">' + sanitize(pg.poNo) + '</b> <span style="color:var(--text2);font-size:12px">· ' + order.length + ' รายการ · ' + pg.sos.length + ' SO</span>' + _csProjChip(pg.projectId) + '</span>' +
      '<span style="display:flex;align-items:center;gap:8px">' + badge + '<b>' + fmtMoney(poValue) + ' ฿</b></span></summary>';
    h += '<div style="padding:14px">';

    h += '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;margin-bottom:8px">รายการ เทียบกับ PO ลูกค้า</div>';
    h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">';
    h += '<thead><tr><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">รายการ</th><th style="padding:0 8px 6px;font-size:10.5px;color:var(--text2);text-align:center">ตาม PO</th><th style="padding:0 8px 6px;font-size:10.5px;color:var(--text2);text-align:center">ส่งแล้ว</th><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">คงค้าง</th><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">อยู่ SO ไหน / สถานะ</th></tr></thead><tbody>';
    order.forEach(function(k) {
      var it = items[k];
      var remain = it.qty - it.shipped;
      var pct = it.qty ? Math.round(it.shipped / it.qty * 100) : 0;
      h += '<tr><td style="padding:7px 8px;border-top:1px solid var(--border)">' + sanitize(it.model || '-') + '</td>' +
        '<td style="padding:7px 8px;border-top:1px solid var(--border);text-align:center">' + it.qty + '</td>' +
        '<td style="padding:7px 8px;border-top:1px solid var(--border);text-align:center">' + it.shipped + '</td>' +
        '<td style="padding:7px 8px;border-top:1px solid var(--border)"><div style="display:flex;align-items:center;gap:7px"><div style="flex:1;height:7px;min-width:50px;border-radius:4px;background:var(--bg2);overflow:hidden"><i style="display:block;height:100%;width:' + pct + '%;background:#3ecf8e"></i></div><span style="font-size:11px;color:var(--text2);white-space:nowrap">' + (remain > 0 ? 'เหลือ ' + remain : 'ครบ') + '</span></div></td>' +
        '<td style="padding:7px 8px;border-top:1px solid var(--border)"><div style="display:flex;flex-wrap:wrap;gap:4px">';
      it.perSo.forEach(function(p) {
        h += '<span onclick="event.stopPropagation();go(\'soDetail\',{soId:\'' + p.so.id + '\'})" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-size:10.5px;background:var(--bg2);border:1px solid var(--border);border-radius:999px;padding:2px 7px"><b style="font-family:monospace">' + sanitize(p.so.soNumber || '-') + '</b> ' + (p.shipped > 0 ? 'ส่งแล้ว ' + p.shipped : 'ยังไม่ส่ง') + '</span>';
      });
      h += '</div></td></tr>';
    });
    h += '</tbody></table></div>';

    h += '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;margin:16px 0 8px">SO ที่ผูกกับ PO นี้ (' + pg.sos.length + ')</div>';
    pg.sos.forEach(function(s) {
      h += '<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;cursor:pointer" onclick="go(\'soDetail\',{soId:\'' + s.id + '\'})">' +
        '<span><b style="font-family:monospace">' + sanitize(s.soNumber || '-') + '</b> <span style="color:var(--text2);font-size:11.5px">· สร้าง ' + sanitize((s.createdAt || '').slice(0, 10)) + '</span></span>' +
        '<span style="display:flex;align-items:center;gap:8px">' + _soStatusBadge(s.status) + '<span style="font-size:11px;color:var(--accent)">เปิด SO →</span></span></div>';
    });

    h += '</div></details>';
  });
  return h;
}

// ---------------- มุมมอง "ตาม SO" ----------------
function _csRenderBySO(d, st) {
  var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:560px">';
  h += '<thead><tr><th style="text-align:left;padding:0 8px 7px;font-size:10.5px;color:var(--text2)">SO</th><th style="text-align:left;padding:0 8px 7px;font-size:10.5px;color:var(--text2)">PO ลูกค้า</th><th style="text-align:left;padding:0 8px 7px;font-size:10.5px;color:var(--text2)">สถานะ</th><th style="text-align:left;padding:0 8px 7px;font-size:10.5px;color:var(--text2)">สร้างเมื่อ</th></tr></thead><tbody>';
  st.sos.slice().sort(function(a, b) { return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1; }).forEach(function(s) {
    h += '<tr style="cursor:pointer" onclick="go(\'soDetail\',{soId:\'' + s.id + '\'})">' +
      '<td style="padding:9px 8px;border-top:1px solid var(--border);font-family:monospace;font-weight:600">' + sanitize(s.soNumber || '-') + '</td>' +
      '<td style="padding:9px 8px;border-top:1px solid var(--border);font-family:monospace">' + sanitize(s.customerPO || '-') + _csProjChip(s.projectId) + '</td>' +
      '<td style="padding:9px 8px;border-top:1px solid var(--border)">' + _soStatusBadge(s.status) + '</td>' +
      '<td style="padding:9px 8px;border-top:1px solid var(--border)">' + sanitize((s.createdAt || '').slice(0, 10)) + '</td>' +
      '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

// ---------------- มุมมอง "ตามสินค้า" ----------------
// รวมรายการสินค้าข้ามทุก PO/SO ของ Dealer — สินค้า 1 รายการโผล่ได้หลาย PO พร้อมกัน แยกเป็น PO/SO คนละคอลัมน์ merge แถวให้คู่กัน
function _csRenderByProduct(d, st) {
  var map = {}, order = [];
  st.poGroups.forEach(function(pg) {
    pg.sos.forEach(function(s) {
      (s.items || []).forEach(function(it) {
        var key = it.sku || it.model;
        var shipped = _csShippedQtyForSku(s, it.sku);
        if (!map[key]) { map[key] = { model: it.model, totalQty: 0, totalShipped: 0, poMap: {}, poOrder: [] }; order.push(key); }
        map[key].totalQty += Number(it.qty) || 0;
        map[key].totalShipped += shipped;
        if (!map[key].poMap[pg.poNo]) { map[key].poMap[pg.poNo] = { pg: pg, qty: 0, sos: [] }; map[key].poOrder.push(pg.poNo); }
        map[key].poMap[pg.poNo].qty += Number(it.qty) || 0;
        map[key].poMap[pg.poNo].sos.push({ so: s, shipped: shipped });
      });
    });
  });
  var items = order.map(function(k) { return map[k]; }).sort(function(a, b) { return b.poOrder.length - a.poOrder.length || b.totalQty - a.totalQty; });

  var h = '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;margin-bottom:8px">รายการสินค้ารวมทุก PO/SO ของ Dealer นี้ (' + items.length + ' รายการ)</div>';
  h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">';
  h += '<thead><tr><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">รายการสินค้า</th><th style="padding:0 8px 6px;font-size:10.5px;color:var(--text2);text-align:center">รวมทุก PO</th><th style="padding:0 8px 6px;font-size:10.5px;color:var(--text2);text-align:center">ส่งแล้ว</th><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">คงค้าง</th><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">อยู่ใน PO ไหนบ้าง</th><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">อยู่ใน SO ไหนบ้าง</th></tr></thead><tbody>';

  items.forEach(function(it) {
    var remain = it.totalQty - it.totalShipped;
    var pct = it.totalQty ? Math.round(it.totalShipped / it.totalQty * 100) : 0;
    var pairs = [];
    it.poOrder.forEach(function(poNo) {
      var pe = it.poMap[poNo];
      pe.sos.forEach(function(x, si) { pairs.push({ poNo: poNo, pg: pe.pg, qty: pe.qty, so: x.so, shipped: x.shipped, isFirstSoOfPo: si === 0, soCountOfPo: pe.sos.length }); });
    });
    var totalRows = pairs.length || 1;
    var poGroupIdx = -1;
    pairs.forEach(function(pair, pi) {
      if (pair.isFirstSoOfPo) poGroupIdx++;
      var rowBg = (poGroupIdx % 2 === 1) ? ' style="background:var(--bg2)"' : '';
      h += '<tr' + rowBg + '>';
      if (pi === 0) {
        h += '<td rowspan="' + totalRows + '" style="padding:7px 8px;border-top:1px solid var(--border);vertical-align:top">' + sanitize(it.model || '-') + (it.poOrder.length > 1 ? '<div style="font-size:10.5px;color:var(--text2);margin-top:2px">อยู่ ' + it.poOrder.length + ' PO</div>' : '') + '</td>';
        h += '<td rowspan="' + totalRows + '" style="padding:7px 8px;border-top:1px solid var(--border);text-align:center;vertical-align:top">' + it.totalQty + '</td>';
        h += '<td rowspan="' + totalRows + '" style="padding:7px 8px;border-top:1px solid var(--border);text-align:center;vertical-align:top">' + it.totalShipped + '</td>';
        h += '<td rowspan="' + totalRows + '" style="padding:7px 8px;border-top:1px solid var(--border);vertical-align:top"><div style="display:flex;align-items:center;gap:7px"><div style="flex:1;height:7px;min-width:50px;border-radius:4px;background:var(--bg2);overflow:hidden"><i style="display:block;height:100%;width:' + pct + '%;background:#3ecf8e"></i></div><span style="font-size:11px;color:var(--text2);white-space:nowrap">' + (remain > 0 ? 'เหลือ ' + remain : 'ครบ') + '</span></div></td>';
      }
      if (pair.isFirstSoOfPo) {
        h += '<td rowspan="' + pair.soCountOfPo + '" style="padding:7px 8px;border-top:1px solid var(--border);vertical-align:top">' +
          '<b style="font-family:monospace">' + sanitize(pair.poNo) + '</b><br><span style="font-size:11px;color:var(--text2)">' + pair.qty + ' ชิ้น</span>' + _csProjChip(pair.pg.projectId) + '</td>';
      }
      h += '<td style="padding:7px 8px;border-top:1px solid var(--border);cursor:pointer" onclick="go(\'soDetail\',{soId:\'' + pair.so.id + '\'})">' +
        '<span style="font-family:monospace;font-weight:600">' + sanitize(pair.so.soNumber || '-') + '</span> ' +
        '<span style="font-size:10px;padding:2px 7px;border-radius:10px;border:1px solid;white-space:nowrap;' +
        (pair.shipped > 0 ? 'background:#3ecf8e22;border-color:#3ecf8e55;color:#3ecf8e' : 'background:var(--bg2);border-color:var(--border);color:var(--text2)') + '">' +
        (pair.shipped > 0 ? 'ส่งแล้ว ' + pair.shipped : 'ยังไม่ส่ง') + '</span></td>';
      h += '</tr>';
    });
  });
  h += '</tbody></table></div>';
  return h;
}
