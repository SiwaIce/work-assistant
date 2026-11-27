// ================================================================
// views-customersummary.js — สรุปรายลูกค้า (Dealer A/R Overview)
//
// รวม PO/SO ค้างส่ง + เครดิตที่ใช้ไปแล้ว + กำหนดชำระ ต่อ Dealer ข้ามทุก Sales Order — ไม่มีหน้าไหนรวม
// ยอดข้ามหลาย SO ต่อ Dealer มาก่อน (หน้า Dealers โฟกัส CRM, หน้า Sales Order เป็นรายการทีละใบ)
// ดึงข้อมูลจาก salesOrders ทั้งหมด ไม่เก็บ field ซ้ำ — การ์ดรายละเอียดเขียนครั้งเดียว ใช้ทั้งหน้าเมนูแยก
// ("สรุปรายลูกค้า") และแท็บในหน้า Dealer รายตัว (ดู dealerARSummaryTab ใน views-dealer.js)
//
// ข้อจำกัดที่รู้อยู่แล้ว (ไม่มี field ให้ในระบบตอนนี้ ใช้ค่าประมาณแทน ไม่ใช่ความจริงที่ยืนยันได้):
// - เทอมเครดิต ปกติใช้ dealer.creditTerm (free text เช่น "เครดิต 30 วัน" — parse ตัวเลขแรกที่เจอออกมา
//   เป็นจำนวนวัน ถ้า parse ไม่ได้ จะไม่คำนวณวันครบกำหนดให้) ยกเว้น SO ที่มีคำขอเครดิต (creditRequests)
//   ที่อนุมัติแล้วผูกอยู่ — ถือเป็น "เครดิตโปรเจค" ชั่วคราว ใช้ creditDaysRequested ของคำขอนั้นแทน
//   เฉพาะ SO ที่ผูกอยู่ (ดู _csCreditDaysForSO)
// - ไม่มี field บันทึกว่า invoice/การส่งมอบรอบไหน "ชำระแล้ว" จริงๆ — ใช้สถานะ SO (ปิด = ถือว่าชำระแล้ว)
//   เป็นตัวแทนไปก่อน ซึ่งไม่แม่นเท่าการบันทึกวันที่ชำระจริง
// ================================================================

var csViewMode = 'po'; // 'po' | 'so' | 'product'
var csSelectedDealerId = null;
var csDeliveryFlt = ''; // '' | 'delivered' | 'pending' — กรองว่า "ส่งแล้ว (ครบ)" หรือ "ยังไม่ส่งครบ" (รวม partial ด้วย เพราะถือว่ายังไม่จบงาน)
var csSearch = ''; // ค้นหา PO/SO/Project ID/สินค้า/SKU — ใช้ร่วมกันทั้ง 3 มุมมอง
var csStatusFlt = ''; // กรองสถานะ SO (ใช้เฉพาะมุมมอง "ตาม SO")
// ตัวกรองเดือน PO (ใช้ร่วมกันทั้ง 3 มุมมอง + Export Excel) — array ของ 'YYYY-MM' เทียบกับ pg.poDate/s.customerPODate
// ว่าง = ทุกเดือน เลือกได้พร้อมกันหลายเดือน (เหมือน csCatFilter)
var csMonthFlt = [];
// ตัวกรองหมวดหมู่สินค้า (เฉพาะมุมมอง "ตามสินค้า") — array ของ id หมวด (PRODUCT_CATEGORIES ใน products.js)
// ว่าง = ทุกหมวด เลือกได้พร้อมกันหลายหมวด เหมือนตัวกรองหมวดในหน้า demo-unit (ดู unitCatFilter ใน demo-staff.html)
// ใช้ร่วมกันทั้งแท็บ "ตามสินค้า" ของ Dealer รายตัว และแท็บ "🧰 ตามสินค้า" ใน PO Tracker (views-potracker.js)
var csCatFilter = [];
var CS_DUE_SOON_DAYS = 7;
var CS_STALE_WARN_DAYS = 10;
var CS_STALE_BAD_DAYS = 20;

function _csParseCreditDays(creditTerm) {
  var m = String(creditTerm || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// เทอมเครดิตที่ใช้จริงกับ SO ใบนี้ — ปกติใช้เทอมของ Dealer เอง ยกเว้นมีคำขอเครดิต (creditRequests)
// ที่อนุมัติแล้วผูกกับ SO นี้โดยเฉพาะ (เครดิตโปรเจคชั่วคราว เช่น 75 วัน) ให้ใช้ของคำขอนั้นแทน
function _csCreditDaysForSO(d, so) {
  if (typeof creditRequestsForSO === 'function') {
    var crs = creditRequestsForSO(so.id).filter(function(c) { return c.status === 'อนุมัติแล้ว' && c.creditDaysRequested; });
    crs.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
    if (crs.length) return { days: Number(crs[0].creditDaysRequested), special: true, cr: crs[0] };
  }
  return { days: _csParseCreditDays(d.creditTerm), special: false };
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

// จำนวนที่ "ควรถือว่าส่งแล้ว" ของ sku หนึ่งใน SO — ปกติใช้ยอดจริงจาก shipments[] (รอบส่งมอบที่บันทึกไว้)
// แต่ถ้า SO ปิด/ส่งแล้ว/ออก invoice แล้ว (_soIsDone) ให้ถือว่าส่งครบเต็มจำนวนที่สั่งเสมอ ไม่ว่า shipments[] จะ
// บันทึกครบหรือไม่ — กันเคสที่เพิ่ม serial ส่งมอบตรงๆ โดยไม่ได้สร้าง/แก้ไขรอบส่งมอบให้ตรงจำนวนจริง (serial ส่วนเกิน
// ขึ้น "⚠️ ไม่ทราบรอบ" ในหน้า SO) ทำให้ยอดค้างส่งในสรุปไม่ตรงกับ SO ที่ปิดงานไปแล้วจริงๆ (รายงานโดยผู้ใช้ 2026-11-19)
// — เหมือน logic เดิมที่ใช้กับรายการไม่มี sku อยู่แล้ว (ดูคอมเมนต์ใน _csDealerStats) แค่ขยายให้ครอบคลุมรายการมี sku ด้วย
function _csEffectiveShipped(so, sku, orderedQty) {
  if (typeof _soIsDone === 'function' && _soIsDone(so.status)) return Number(orderedQty) || 0;
  return _csShippedQtyForSku(so, sku);
}

// รวม SO ของ Dealer เป็นกลุ่มตามเลข PO ลูกค้า (customerPO) — 1 PO อาจมีหลาย SO (แบ่งส่ง/ของมาไม่พร้อมกัน)
function _csGroupByPO(sos) {
  var map = {}, order = [];
  sos.forEach(function(s) {
    var key = s.customerPO || ('(ไม่มีเลข PO) ' + (s.soNumber || s.id));
    var pid = (typeof _soDisplayProjectId === 'function') ? _soDisplayProjectId(s) : (s.projectId || '');
    if (!map[key]) { map[key] = { poNo: key, projectId: pid, poDate: s.customerPODate || '', sos: [] }; order.push(key); }
    if (!map[key].projectId && pid) map[key].projectId = pid;
    if (s.customerPODate && (!map[key].poDate || s.customerPODate < map[key].poDate)) map[key].poDate = s.customerPODate;
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
      var soDone = (typeof _soIsDone === 'function') && _soIsDone(s.status);
      (s.items || []).forEach(function(it) {
        var qty = Number(it.qty) || 0;
        // รายการไม่มี SKU (by-order ไม่ track คลัง) ไม่มีทางถูกบันทึกว่า "ส่งแล้ว" ผ่าน shipments[] เลย
        // (soRecordShipmentRound ต้องมี sku) ถ้า SO ปิด/ส่งแล้วถือว่าส่งครบ ไม่งั้นจะค้างโชว์ตลอดไปแม้ปิด SO แล้ว
        // รายการมี SKU ก็ใช้กฎเดียวกัน (ผ่าน _csEffectiveShipped) — กัน SO ที่ปิดแล้วแต่ shipments[] บันทึกจำนวน
        // ไม่ครบ (เช่น เพิ่ม serial ตรงๆ โดยไม่ได้แก้รอบส่งมอบ) ยังค้างโชว์ว่าส่งไม่ครบทั้งที่ปิดงานไปแล้ว
        if (!it.sku) { if (!soDone) remainVal += qty * (Number(it.unitPrice) || 0); return; }
        var shipped = _csEffectiveShipped(s, it.sku, qty);
        var remain = Math.max(0, qty - shipped);
        remainVal += remain * (Number(it.unitPrice) || 0);
      });
    });
    if (remainVal > 0) openPoCount++;
    outstandingValue += remainVal;
  });

  var hasSpecialCredit = false;
  sos.forEach(function(s) {
    var paidProxy = s.status === 'closed';
    var cd = _csCreditDaysForSO(d, s);
    if (cd.special) hasSpecialCredit = true;
    var shipments = (typeof _soMigrateLegacyShipment === 'function') ? _soMigrateLegacyShipment(s) : (s.shipments || []);
    shipments.forEach(function(sh) {
      if (paidProxy) return;
      var amt = _csShipmentAmount(s, sh);
      if (amt <= 0) return;
      creditUsed += amt;
      if (cd.days != null && sh.invoiceDate) {
        var due = _csAddDays(sh.invoiceDate, cd.days);
        if (!nextDue || due < nextDue) nextDue = due;
      }
    });
  });

  var creditLimit = parseFloat(String(d.creditLimit || '').replace(/,/g, '')) || 0;
  return {
    sos: sos, poGroups: poGroups, creditDays: creditDays, hasSpecialCredit: hasSpecialCredit,
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
    sos.forEach(function(s) {
      var paidProxy = s.status === 'closed';
      var cd = _csCreditDaysForSO(d, s);
      if (!paidProxy && cd.days != null) {
        var tag = cd.special ? '🏷️ เครดิตโปรเจค · ' : '';
        var shipments = (typeof _soMigrateLegacyShipment === 'function') ? _soMigrateLegacyShipment(s) : (s.shipments || []);
        shipments.forEach(function(sh) {
          var amt = _csShipmentAmount(s, sh);
          if (amt <= 0 || !sh.invoiceDate) return;
          var due = _csAddDays(sh.invoiceDate, cd.days);
          var diff = _csDaysBetween(_td(), due);
          if (diff < 0) {
            alerts.push({ sev: 'bad', icon: '⏰', dealer: d, so: s, sortKey: diff,
              text: tag + 'เกินกำหนดชำระ ' + Math.abs(diff) + ' วัน · ' + (sh.invoiceNumber || s.soNumber) + ' · ' + fmtMoney(amt) + ' ฿' });
          } else if (diff <= CS_DUE_SOON_DAYS) {
            alerts.push({ sev: 'warn', icon: '📅', dealer: d, so: s, sortKey: diff,
              text: tag + 'ครบกำหนดชำระในอีก ' + diff + ' วัน · ' + (sh.invoiceNumber || s.soNumber) + ' · ' + fmtMoney(amt) + ' ฿' });
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
      '<div style="font-size:11.5px;color:var(--text2)">เทอมเครดิต: ' + (st.creditDays != null ? st.creditDays + ' วัน' : '<span style="color:#eab63f">' + sanitize(d.creditTerm || '(ยังไม่ระบุ)') + ' — parse เป็นตัวเลขไม่ได้ คำนวณวันครบกำหนดให้ไม่ได้</span>') +
        (st.hasSpecialCredit ? ' <span style="color:var(--accent)">· บาง SO ใช้เครดิตโปรเจคพิเศษ (ดูป้าย 🏷️ ในแต่ละ SO)</span>' : '') + '</div></div>' +
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

  h += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;justify-content:space-between;align-items:center">' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    _csViewBtn('po', '📦 ตาม PO ลูกค้า', d.id) +
    _csViewBtn('so', '📋 ตาม SO', d.id) +
    _csViewBtn('product', '🧰 ตามสินค้า', d.id) +
    '</div>' +
    '<button class="btn bo bsm" onclick="_csExportExcel(\'' + d.id + '\')" title="ไฟล์เดียว 3 แท็บ: ตาม PO ลูกค้า / ตาม SO / ตามสินค้า — ใช้ filter ที่เลือกอยู่ทุกแท็บ">📤 Export Excel</button>' +
    '<button class="btn bo bsm" onclick="_csShowImportRemarksModal(\'' + d.id + '\')" title="แก้คอลัมน์ หมายเหตุ ในไฟล์ Export Excel (ชีต ตาม PO ลูกค้า) แล้วนำเข้ากลับมาที่นี่">📥 Import หมายเหตุ</button>' +
    '</div>';

  if (st.sos.length) h += _csRenderFilterBar(st);

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

// ---------------- แถบ filter ร่วม — ค้นหา + ส่งแล้ว/ยังไม่ส่ง + สถานะ SO (เฉพาะมุมมอง "ตาม SO") + เดือน PO ----------------
function _csDeliveryFltBtn(val, label) {
  var act = csDeliveryFlt === val;
  return '<button class="btn bsm ' + (act ? 'bp' : 'bo') + '" onclick="csDeliveryFlt=\'' + val + '\';render()">' + label + '</button>';
}
// เดือน PO ที่มีข้อมูลจริงของ Dealer นี้ (ไม่โชว์เดือนว่าง) — ใช้ pg.poDate (มุมมอง PO/สินค้า) รวมกับ
// s.customerPODate (กัน SO ที่หลุด group ไม่มี poDate เพราะไม่มีเลข PO) เรียงใหม่สุดก่อน
function _csAvailableMonths(st) {
  var set = {};
  st.poGroups.forEach(function(pg) { if (pg.poDate) set[pg.poDate.slice(0, 7)] = true; });
  st.sos.forEach(function(s) { if (s.customerPODate) set[s.customerPODate.slice(0, 7)] = true; });
  return Object.keys(set).sort().reverse();
}
function _csMonthLabel(ym) {
  var parts = String(ym || '').split('-');
  var mi = parseInt(parts[1], 10) - 1;
  return (THAI_MONTHS_SHORT[mi] || '?') + ' ' + parts[0];
}
function csToggleMonthFlt(ym) {
  if (ym === 'all') { csMonthFlt = []; render(); return; }
  var i = csMonthFlt.indexOf(ym);
  if (i === -1) csMonthFlt.push(ym); else csMonthFlt.splice(i, 1);
  render();
}
function _csMonthChipsHtml(st) {
  var months = _csAvailableMonths(st);
  if (!months.length) return '';
  var h = '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;margin-bottom:10px">';
  h += '<button class="btn bsm ' + (!csMonthFlt.length ? 'bp' : 'bo') + '" style="white-space:nowrap" onclick="csToggleMonthFlt(\'all\')">📅 ทุกเดือน</button>';
  months.forEach(function(ym) {
    var on = csMonthFlt.indexOf(ym) !== -1;
    h += '<button class="btn bsm ' + (on ? 'bp' : 'bo') + '" style="white-space:nowrap" onclick="csToggleMonthFlt(\'' + ym + '\')">' + sanitize(_csMonthLabel(ym)) + (on ? ' ✕' : '') + '</button>';
  });
  h += '</div>';
  return h;
}
// แถบสรุปยอดของเดือนที่เลือกไว้ (โชว์เฉพาะตอนเลือกอย่างน้อย 1 เดือน) — รวมยอด/ค้างส่งจาก PO groups ที่ผ่าน
// filter ปัจจุบันทั้งหมด (เดือน/สถานะ/ค้นหา) ใช้ร่วมกันทั้ง 3 มุมมอง เพราะอิงจากข้อมูล PO เดียวกัน
function _csMonthSummaryHtml(st) {
  if (!csMonthFlt.length) return '';
  var groups = _csFilteredPOGroups(st);
  var totalValue = 0, pendingValue = 0;
  groups.forEach(function(g) {
    g.order.forEach(function(k) {
      var it = g.items[k];
      var remain = Math.max(0, it.qty - it.shipped);
      totalValue += it.qty * it.unitPrice;
      pendingValue += remain * it.unitPrice;
    });
  });
  var label = csMonthFlt.slice().sort().map(_csMonthLabel).join(' + ');
  return '<div style="display:flex;gap:16px;flex-wrap:wrap;background:var(--accent-light,#17344a);border:1px solid var(--accent);border-radius:10px;padding:8px 12px;margin-bottom:10px;font-size:12px">' +
    '<span style="font-weight:700;color:var(--accent)">📅 ' + sanitize(label) + '</span>' +
    '<span>PO: <b>' + groups.length + ' ใบ</b></span>' +
    '<span>ยอดรวม: <b>' + fmtMoney(totalValue) + ' ฿</b></span>' +
    '<span>ค้างส่ง: <b style="color:#f0685f">' + fmtMoney(pendingValue) + ' ฿</b></span>' +
    '</div>';
}
function _csRenderFilterBar(st) {
  var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">';
  h += '<input class="inp" style="flex:1;min-width:170px;max-width:280px" placeholder="🔎 ค้นหา PO/SO/Project ID/สินค้า/SKU" value="' + sanitize(csSearch) + '" oninput="csSearch=this.value;render()">';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    _csDeliveryFltBtn('', 'ทั้งหมด') +
    _csDeliveryFltBtn('pending', '🔴 ยังไม่ส่ง') +
    _csDeliveryFltBtn('delivered', '✅ ส่งแล้ว') +
    '</div>';
  if (csViewMode === 'so') {
    h += '<select class="inp" style="max-width:180px" onchange="csStatusFlt=this.value;render()">' +
      '<option value="">สถานะ: ทั้งหมด</option>';
    Object.keys(SO_STATUS).forEach(function(k) {
      h += '<option value="' + k + '"' + (csStatusFlt === k ? ' selected' : '') + '>' + sanitize((SO_STATUS[k] || {}).label || k) + '</option>';
    });
    h += '</select>';
  }
  if (csSearch || csDeliveryFlt || csStatusFlt || csMonthFlt.length) {
    h += '<button class="btn bo bsm" onclick="csSearch=\'\';csDeliveryFlt=\'\';csStatusFlt=\'\';csMonthFlt=[];render()">✕ ล้าง filter</button>';
  }
  h += '</div>';
  h += _csMonthChipsHtml(st);
  h += _csMonthSummaryHtml(st);
  return h;
}

// ---------------- ข้อมูลผ่าน filter ปัจจุบัน (ใช้ร่วมทั้ง render และ export Excel) ----------------
// กรองที่ระดับ "แต่ละบรรทัด sku ต่อ 1 SO" ก่อน แล้วค่อยรวมเป็น item ต่อ PO — กันบรรทัด SO ที่ส่งแล้ว
// หลุดติดมาด้วยตอน filter "ยังไม่ส่ง" (รายการ sku เดียวกันอาจมาจากหลาย SO ในพม่ PO เดียวกัน บาง SO ส่งแล้ว บาง SO ยังไม่ส่ง)
function _csFilteredPOGroups(st) {
  var q = (csSearch || '').trim().toLowerCase();
  var out = [];
  st.poGroups.forEach(function(pg) {
    if (csMonthFlt.length && (!pg.poDate || csMonthFlt.indexOf(pg.poDate.slice(0, 7)) === -1)) return;
    var raw = {}, rawOrder = [];
    pg.sos.forEach(function(s) {
      (s.items || []).forEach(function(it) {
        var key = it.sku || it.model;
        if (!raw[key]) { raw[key] = { model: it.model, sku: it.sku, unitPrice: it.unitPrice || 0, pairs: [] }; rawOrder.push(key); }
        var lineQty = Number(it.qty) || 0;
        var shipped = _csEffectiveShipped(s, it.sku, lineQty);
        raw[key].pairs.push({ so: s, lineQty: lineQty, shipped: shipped, comment: it.comment || '' });
      });
    });

    var items = {}, filteredOrder = [];
    rawOrder.forEach(function(key) {
      var r = raw[key];
      var pairs = r.pairs.filter(function(p) {
        var remain = p.lineQty - p.shipped;
        if (csDeliveryFlt === 'delivered') return remain <= 0 && p.lineQty > 0;
        if (csDeliveryFlt === 'pending') return remain > 0;
        return true;
      });
      if (!pairs.length) return;
      if (q) {
        var soNums = pairs.map(function(p) { return p.so.soNumber; });
        var hay = [r.model, r.sku, pg.poNo, pg.projectId, pg.poDate].concat(soNums).filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return;
      }
      var qty = 0, shipped = 0, remarks = [];
      var perSo = pairs.map(function(p) {
        qty += p.lineQty; shipped += p.shipped;
        if (p.comment && remarks.indexOf(p.comment) === -1) remarks.push(p.comment);
        return { so: p.so, shipped: p.shipped };
      });
      items[key] = { model: r.model, sku: r.sku, qty: qty, shipped: shipped, unitPrice: r.unitPrice, perSo: perSo, remark: remarks.join('; ') };
      filteredOrder.push(key);
    });
    if (!filteredOrder.length) return;
    var totalQty = 0, shippedQty = 0, poValue = 0;
    filteredOrder.forEach(function(k) { totalQty += items[k].qty; shippedQty += items[k].shipped; poValue += items[k].qty * items[k].unitPrice; });
    out.push({ pg: pg, items: items, order: filteredOrder, totalQty: totalQty, shippedQty: shippedQty, poValue: poValue });
  });
  return out;
}

function _csFilteredSOs(st) {
  var q = (csSearch || '').trim().toLowerCase();
  return st.sos.filter(function(s) {
    if (csStatusFlt && s.status !== csStatusFlt) return false;
    if (csMonthFlt.length) {
      var my = (s.customerPODate || '').slice(0, 7);
      if (!my || csMonthFlt.indexOf(my) === -1) return false;
    }
    if (csDeliveryFlt) {
      var totalQty = 0, shipped = 0;
      (s.items || []).forEach(function(it) { var qty = Number(it.qty) || 0; totalQty += qty; shipped += _csEffectiveShipped(s, it.sku, qty); });
      var delivered = totalQty > 0 && shipped >= totalQty;
      if (csDeliveryFlt === 'delivered' && !delivered) return false;
      if (csDeliveryFlt === 'pending' && delivered) return false;
    }
    if (q) {
      var pid = (typeof _soDisplayProjectId === 'function') ? _soDisplayProjectId(s) : (s.projectId || '');
      var hay = [s.soNumber, s.customerPO, pid, s.customerPODate].filter(Boolean).join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }).slice().sort(function(a, b) { return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1; });
}

// กรองที่ระดับ "แต่ละบรรทัด sku ต่อ 1 SO" ก่อน แล้วค่อยรวมเป็น item/PO — ไม่งั้นบรรทัด SO ที่ส่งแล้ว
// จะติดมาแสดงในคอลัมน์ "อยู่ใน PO/SO ไหนบ้าง" ของแถวที่ผ่าน filter "ยังไม่ส่ง" (เพราะ product 1 ตัวมักอยู่หลาย SO)
function _csFilteredProductItems(st) {
  var q = (csSearch || '').trim().toLowerCase();
  var map = {}, order = [];
  st.poGroups.forEach(function(pg) {
    if (csMonthFlt.length && (!pg.poDate || csMonthFlt.indexOf(pg.poDate.slice(0, 7)) === -1)) return;
    pg.sos.forEach(function(s) {
      (s.items || []).forEach(function(it) {
        var key = it.sku || it.model;
        if (!map[key]) { map[key] = { model: it.model, sku: it.sku, pairs: [] }; order.push(key); }
        var lineQty = Number(it.qty) || 0;
        map[key].pairs.push({ poNo: pg.poNo, pg: pg, lineQty: lineQty, so: s, shipped: _csEffectiveShipped(s, it.sku, lineQty) });
      });
    });
  });

  var items = [];
  order.forEach(function(key) {
    var raw = map[key];
    var pairs = raw.pairs.filter(function(p) {
      var remain = p.lineQty - p.shipped;
      if (csDeliveryFlt === 'delivered') return remain <= 0 && p.lineQty > 0;
      if (csDeliveryFlt === 'pending') return remain > 0;
      return true;
    });
    if (!pairs.length) return;
    if (q) {
      var soNums = pairs.map(function(p) { return p.so.soNumber; });
      var poNos = pairs.map(function(p) { return p.poNo; });
      var hay = [raw.model, raw.sku].concat(poNos).concat(soNums).filter(Boolean).join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return;
    }
    var poMap = {}, poOrder = [], totalQty = 0, totalShipped = 0;
    pairs.forEach(function(p) {
      totalQty += p.lineQty; totalShipped += p.shipped;
      if (!poMap[p.poNo]) { poMap[p.poNo] = { pg: p.pg, qty: 0, sos: [] }; poOrder.push(p.poNo); }
      poMap[p.poNo].qty += p.lineQty;
      poMap[p.poNo].sos.push({ so: p.so, shipped: p.shipped });
    });
    // หมวดหมู่สินค้า — มาจาก catalog (products.js) ผูกด้วย sku ไม่ใช่ field ของ SO item เอง ถ้าหา sku ใน
    // catalog ไม่เจอ (เช่น สินค้าที่ลบไปแล้ว หรือ item ไม่มี sku) ถือเป็น 'other' ไปก่อน กันตัวกรองหมวดพังเวลาไม่มีข้อมูล
    var catProd = raw.sku && typeof getProductBySku === 'function' ? getProductBySku(raw.sku) : null;
    items.push({ model: raw.model, sku: raw.sku, category: (catProd && catProd.category) || 'other', totalQty: totalQty, totalShipped: totalShipped, poMap: poMap, poOrder: poOrder });
  });

  return items.sort(function(a, b) { return b.poOrder.length - a.poOrder.length || b.totalQty - a.totalQty; });
}

// ---------------- ตัวกรองหมวดหมู่สินค้า (มุมมอง "ตามสินค้า") — ใช้ร่วมกับ PO Tracker ----------------
// กดหมวด "ทุกหมวด" ล้างตัวเลือกทั้งหมด กดหมวดอื่นติ๊กเข้า/ออกทีละหมวด เลือกพร้อมกันได้หลายหมวด
// (แบบเดียวกับตัวกรองหมวดในหน้า demo-unit — ดู setUnitCat ใน demo-staff.html)
function csSetCatFilter(id) {
  if (id === 'all') { csCatFilter = []; }
  else {
    var i = csCatFilter.indexOf(id);
    if (i === -1) csCatFilter.push(id); else csCatFilter.splice(i, 1);
  }
  render();
}
// นับจาก items ที่ผ่านค้นหา/ยังไม่ส่ง-ส่งแล้วแล้ว (แต่ยังไม่กรองหมวด) ให้ตัวนับสะท้อนสโคปปัจจุบันเสมอ
function _csCategoryTabsHtml(items) {
  if (typeof PRODUCT_CATEGORIES === 'undefined') return '';
  var counts = { all: items.length }, present = [];
  PRODUCT_CATEGORIES.forEach(function(c) {
    var n = items.filter(function(it) { return it.category === c.id; }).length;
    if (n) { counts[c.id] = n; present.push(c); }
  });
  if (!present.length) return '';
  var h = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
  h += '<div class="btn bsm ' + (csCatFilter.length ? 'bo' : 'bp') + '" style="cursor:pointer" onclick="csSetCatFilter(\'all\')">📂 ทุกหมวด <span style="opacity:.7;margin-left:4px">' + counts.all + '</span></div>';
  present.forEach(function(c) {
    var on = csCatFilter.indexOf(c.id) !== -1;
    h += '<div class="btn bsm ' + (on ? 'bp' : 'bo') + '" style="cursor:pointer" onclick="csSetCatFilter(\'' + c.id + '\')">' + c.name + ' <span style="opacity:.7;margin-left:4px">' + counts[c.id] + '</span></div>';
  });
  h += '</div>';
  return h;
}
function _csPassesCatFilter(category) { return !csCatFilter.length || csCatFilter.indexOf(category) !== -1; }

// ---------------- ทางลัดแก้หมวดสินค้าตรงจากแถวในตาราง "ตามสินค้า" — ไม่ต้องเปิด modal "แก้ไขสินค้า" เต็มรูปแบบ ----------------
function _csSetProductCategoryQuick(sku, newCat) {
  if (typeof getProductBySku !== 'function' || typeof updateProduct !== 'function') return;
  var p = getProductBySku(sku);
  if (!p) return;
  updateProduct(p.id, { category: newCat });
  render();
}
function _csQuickCatSelectHtml(sku) {
  if (!sku || typeof PRODUCT_CATEGORIES === 'undefined' || typeof getProductBySku !== 'function') return '';
  var p = getProductBySku(sku);
  if (!p) return '';
  var cur = p.category || 'other';
  var opts = PRODUCT_CATEGORIES.map(function(c) { return '<option value="' + c.id + '"' + (c.id === cur ? ' selected' : '') + '>' + sanitize(c.name) + '</option>'; }).join('');
  return '<select class="inp" style="font-size:10.5px;padding:2px 6px;margin-top:3px;max-width:180px" title="แก้หมวดสินค้านี้ด่วนจากตรงนี้" ' +
    'onclick="event.stopPropagation()" onchange="event.stopPropagation();_csSetProductCategoryQuick(\'' + sku + '\',this.value)">' + opts + '</select>';
}

// ---------------- Export Excel — ไฟล์เดียว 3 แท็บ (ตาม PO ลูกค้า/ตาม SO/ตามสินค้า) ใช้ filter ที่เลือกอยู่ทุกแท็บ ----------------
// ใช้ ExcelJS (ไม่ใช่ SheetJS/XLSX) เพื่อให้ได้หัวตารางตัวหนา/มีสี + freeze แถวหัว + highlight สถานะส่ง ให้อ่านง่าย
// ตอนส่งให้ลูกค้าดู — รูปแบบเดียวกับที่ใช้ใน views-kpiplan.js (ดู KPI_XL_THEME/_kpiAppendDealerDetailTabXl)
var CS_XL_THEME = { navy: 'FF16294F', headBg: 'FFE7ECF7', zebra: 'FFF4F6FB', border: 'FFD7DCE6', white: 'FFFFFFFF', sub: 'FF5B6577',
  green: 'FF1B5E20', greenBg: 'FFE8F5E9', red: 'FFB71C1C', redBg: 'FFFDECEA', amber: 'FF8A5300', amberBg: 'FFFEF3C7' };
function _csXlThinBorder() {
  var side = { style: 'thin', color: { argb: CS_XL_THEME.border } };
  return { top: side, left: side, bottom: side, right: side };
}
function _csXlDownload(buffer, filename) {
  var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}
// คำอธิบาย filter ปัจจุบัน (ใช้โชว์เป็นบรรทัดใต้ชื่อ Dealer ในทุกชีต ให้ลูกค้ารู้ว่าไฟล์นี้กรองอะไรมา)
function _csFilterDescLabel(includeStatus) {
  var parts = [csDeliveryFlt === 'delivered' ? 'สถานะส่ง: ส่งแล้ว' : (csDeliveryFlt === 'pending' ? 'สถานะส่ง: ยังไม่ส่ง' : 'สถานะส่ง: ทั้งหมด')];
  if (includeStatus && csStatusFlt) parts.push('สถานะ SO: ' + ((SO_STATUS[csStatusFlt] || {}).label || csStatusFlt));
  if (csMonthFlt.length) parts.push('เดือน PO: ' + csMonthFlt.slice().sort().map(_csMonthLabel).join(', '));
  if (csSearch) parts.push('ค้นหา: "' + csSearch + '"');
  return parts.join('   ·   ');
}
// สีเขียว/แดง/ส้มให้คอลัมน์ "สถานะ" ตามคำในข้อความ (ส่งแล้ว/ยังไม่ส่ง/บางส่วน) — เช็ค "ยังไม่ส่ง" ก่อนเสมอ
// เพราะ "ส่งแล้ว" เป็น substring ของคำอื่นไม่ได้ แต่กันพลาดกรณีมีคำผสมในอนาคต
function _csXlStatusStyle(cell, text) {
  var v = String(text || '');
  if (v.indexOf('ยังไม่ส่ง') !== -1) {
    cell.font = { bold: true, color: { argb: CS_XL_THEME.red } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_XL_THEME.redBg } };
  } else if (v.indexOf('บางส่วน') !== -1) {
    cell.font = { bold: true, color: { argb: CS_XL_THEME.amber } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_XL_THEME.amberBg } };
  } else if (v.indexOf('ส่งแล้ว') !== -1 || v.indexOf('ปิด') !== -1) {
    cell.font = { bold: true, color: { argb: CS_XL_THEME.green } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_XL_THEME.greenBg } };
  }
}
// สร้าง 1 ชีต: แถบชื่อ Dealer (navy) + บรรทัด filter (italic) + ว่าง 1 แถว + หัวตาราง (navy/ขาว/ตัวหนา, freeze,
// autofilter) + แถวข้อมูล (เส้นขอบ, ลายม้าลาย, คอลัมน์ตัวเลขจัดขวา+คั่นหลักพัน, คอลัมน์สถานะไฮไลต์สี)
function _csXlWriteSheet(wb, sheetName, dealerName, filterDesc, header, rows, colWidths, numCols, statusColIdx) {
  var COLS = header.length;
  var ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  ws.columns = colWidths.map(function(w) { return { width: w }; });

  var titleRow = ws.addRow(['สรุปค้างส่ง/เครดิต — ' + dealerName]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, COLS);
  titleRow.height = 24;
  var tc = titleRow.getCell(1);
  tc.font = { bold: true, size: 13, color: { argb: CS_XL_THEME.white } };
  tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_XL_THEME.navy } };
  tc.alignment = { vertical: 'middle', indent: 1 };

  var metaRow = ws.addRow(['ออกเมื่อ ' + _td() + '   ·   ' + filterDesc]);
  ws.mergeCells(metaRow.number, 1, metaRow.number, COLS);
  metaRow.getCell(1).font = { italic: true, size: 10, color: { argb: CS_XL_THEME.sub } };
  ws.addRow([]);

  var hRow = ws.addRow(header);
  hRow.height = 22;
  hRow.eachCell(function(cell) {
    cell.font = { bold: true, size: 10.5, color: { argb: CS_XL_THEME.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_XL_THEME.navy } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: COLS } };

  if (!rows.length) {
    var er = ws.addRow(['ไม่มีรายการตาม filter ที่เลือก']);
    ws.mergeCells(er.number, 1, er.number, COLS);
    er.getCell(1).font = { italic: true, color: { argb: CS_XL_THEME.sub } };
    return ws;
  }
  rows.forEach(function(row, idx) {
    var r = ws.addRow(row);
    r.eachCell({ includeEmpty: false }, function(cell, colNum) {
      cell.border = _csXlThinBorder();
      cell.alignment = { vertical: 'middle' };
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_XL_THEME.zebra } };
      if ((numCols || []).indexOf(colNum - 1) !== -1) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
      if (statusColIdx != null && colNum - 1 === statusColIdx) _csXlStatusStyle(cell, cell.value);
    });
  });
  return ws;
}

function _csExportExcel(dealerId) {
  ensureExcelJS().then(function() {
    _csExportExcel_impl(dealerId);
  }).catch(function(e) {
    if (typeof toast === 'function') toast('⚠️ โหลดไลบรารีไม่สำเร็จ: ' + (e && e.message || e), true);
  });
}
function _csExportExcel_impl(dealerId) {
  if (typeof ExcelJS === 'undefined') return toast('⚠️ โหลดไลบรารี ExcelJS ไม่สำเร็จ (ต้องต่อเน็ต) ลองใหม่อีกครั้ง', true);
  var d = ST.getAll('dealers').filter(function(x) { return x.id === dealerId; })[0];
  if (!d) { toast('ไม่พบ Dealer'); return; }
  var st = _csDealerStats(d);
  var wb = new ExcelJS.Workbook();
  var filterDesc = _csFilterDescLabel(false);
  var totalRows = 0;

  // แท็บ 1: ตาม PO ลูกค้า
  var groups = _csFilteredPOGroups(st);
  var poHeader = ['PO ลูกค้า', 'Project ID', 'วันที่เปิด PO', 'รายการสินค้า', 'SKU', 'ตาม PO', 'ส่งแล้ว', 'คงค้าง', 'ราคาต่อหน่วย', 'มูลค่าคงค้าง', 'สถานะ', 'หมายเหตุ', 'อยู่ใน SO ไหนบ้าง'];
  var poRows = [];
  groups.forEach(function(g) {
    g.order.forEach(function(k) {
      var it = g.items[k];
      var remain = it.qty - it.shipped;
      var status = remain <= 0 ? 'ส่งแล้ว (ครบ)' : (it.shipped > 0 ? 'ส่งบางส่วน' : 'ยังไม่ส่ง');
      var soTxt = it.perSo.map(function(p) { return p.so.soNumber + (p.shipped > 0 ? ' (ส่งแล้ว ' + p.shipped + ')' : ' (ยังไม่ส่ง)'); }).join('; ');
      poRows.push([g.pg.poNo, g.pg.projectId || '', g.pg.poDate || '', it.model || '', it.sku || '', it.qty, it.shipped, remain, it.unitPrice || 0, remain * (it.unitPrice || 0), status, it.remark || '', soTxt]);
    });
  });
  totalRows += poRows.length;
  _csXlWriteSheet(wb, 'ตาม PO ลูกค้า', d.name, filterDesc, poHeader, poRows,
    [18, 16, 14, 28, 14, 8, 8, 8, 12, 14, 14, 22, 40], [8, 9], 10);

  // แท็บ 2: ตาม SO
  var sos = _csFilteredSOs(st);
  var soHeader = ['SO Number', 'PO ลูกค้า', 'Project ID', 'วันที่เปิด PO', 'สถานะ SO', 'สถานะส่ง', 'สร้างเมื่อ', 'เทอมเครดิต (วัน)', 'Invoice No.'];
  var soRows = sos.map(function(s) {
    var cd = _csCreditDaysForSO(d, s);
    var totalQty = 0, shipped = 0;
    (s.items || []).forEach(function(it) { var qty = Number(it.qty) || 0; totalQty += qty; shipped += _csEffectiveShipped(s, it.sku, qty); });
    var deliveryStatus = totalQty > 0 && shipped >= totalQty ? 'ส่งแล้ว (ครบ)' : (shipped > 0 ? 'ส่งบางส่วน' : 'ยังไม่ส่ง');
    var pid = (typeof _soDisplayProjectId === 'function') ? _soDisplayProjectId(s) : (s.projectId || '');
    var invNums = [];
    var shipRounds = (typeof _soMigrateLegacyShipment === 'function') ? _soMigrateLegacyShipment(s) : (s.shipments || []);
    shipRounds.forEach(function(sh) { if (sh.invoiceNumber && invNums.indexOf(sh.invoiceNumber) === -1) invNums.push(sh.invoiceNumber); });
    return [s.soNumber || '', s.customerPO || '', pid, (s.customerPODate || '').slice(0, 10), (SO_STATUS[s.status] || {}).label || s.status || '', deliveryStatus, (s.createdAt || '').slice(0, 10), cd.days != null ? cd.days : '', invNums.join(', ')];
  });
  totalRows += soRows.length;
  _csXlWriteSheet(wb, 'ตาม SO', d.name, _csFilterDescLabel(true), soHeader, soRows,
    [14, 18, 16, 14, 14, 14, 12, 14, 20], [], 5);

  // แท็บ 3: ตามสินค้า
  var items = _csFilteredProductItems(st);
  var prodHeader = ['รายการสินค้า', 'SKU', 'รวมทุก PO', 'ส่งแล้ว', 'คงค้าง', 'สถานะ', 'อยู่ใน PO ไหนบ้าง', 'อยู่ใน SO ไหนบ้าง'];
  var prodRows = items.map(function(it) {
    var soNums = [];
    it.poOrder.forEach(function(poNo) { it.poMap[poNo].sos.forEach(function(x) { soNums.push(x.so.soNumber + (x.shipped > 0 ? ' (ส่งแล้ว ' + x.shipped + ')' : ' (ยังไม่ส่ง)')); }); });
    var remain = it.totalQty - it.totalShipped;
    var status = remain <= 0 ? 'ส่งแล้ว (ครบ)' : (it.totalShipped > 0 ? 'ส่งบางส่วน' : 'ยังไม่ส่ง');
    return [it.model || '', it.sku || '', it.totalQty, it.totalShipped, remain, status, it.poOrder.join(', '), soNums.join('; ')];
  });
  totalRows += prodRows.length;
  _csXlWriteSheet(wb, 'ตามสินค้า', d.name, filterDesc, prodHeader, prodRows,
    [28, 14, 10, 10, 10, 14, 30, 40], [2, 3, 4], 5);

  if (!totalRows) { toast('ไม่มีรายการให้ export ตาม filter ปัจจุบัน'); return; }
  var safeName = String(d.name || 'dealer').replace(/[\\/:*?"<>|]/g, '_');
  wb.xlsx.writeBuffer().then(function(buffer) {
    _csXlDownload(buffer, 'สรุปค้างส่ง-' + safeName + '-' + _td() + '.xlsx');
    toast('📤 Export Excel แล้ว (3 แท็บ: ตาม PO ลูกค้า ' + poRows.length + ', ตาม SO ' + soRows.length + ', ตามสินค้า ' + prodRows.length + ')');
  }).catch(function(e) {
    toast('⚠️ สร้างไฟล์ Excel ไม่สำเร็จ: ' + (e && e.message || e), true);
  });
}

// ---------------- Import หมายเหตุกลับจากไฟล์ Export Excel (เฉพาะคอลัมน์ "หมายเหตุ" ในชีต "ตาม PO ลูกค้า") ----------------
// ไม่มีคอลัมน์ SO_ID/ITEM_IDX ซ่อนในไฟล์นี้ (เป็นไฟล์ส่งลูกค้าดูได้) เลย match แถวด้วย PO ลูกค้า + SKU (หรือชื่อสินค้าถ้าไม่มี SKU)
// เหมือนที่ _csFilteredPOGroups ใช้จัดกลุ่ม — เขียนค่ากลับผ่าน it.comment ฟิลด์เดิม (ฟิลด์เดียวกับ "คอมเมนต์" ในหน้า SO/PO Tracker)
var _csImportSel = {};
function _csShowImportRemarksModal(dealerId) {
  window._csImportPending = null;
  _csImportSel = {};
  var html = '<div class="hint" style="margin-bottom:8px">ใช้ไฟล์ที่ได้จากปุ่ม "📤 Export Excel" ของ Dealer นี้ (ชีต "ตาม PO ลูกค้า") แก้เฉพาะคอลัมน์ "หมายเหตุ" แล้วอัปโหลดไฟล์กลับมาที่นี่ — คอลัมน์อื่นจะไม่ถูกนำเข้า</div>';
  html += '<input type="file" id="csImpFile" accept=".xlsx,.xls" class="fi" onchange="_csPreviewImportRemarks(this,\'' + dealerId + '\')">';
  html += '<div id="csImpPreview"></div>';
  html += '<label class="hint" id="csImpConfirmWrap" style="display:none;margin-top:10px;display:flex;gap:6px;align-items:flex-start">' +
    '<input type="checkbox" id="csImpConfirm" style="margin-top:3px"> <span>ฉันตรวจสอบรายการเปลี่ยนแปลงหมายเหตุที่ "✅ เลือกไว้" ด้านบนแล้ว และต้องการบันทึกทับข้อมูลเดิม</span></label>';
  html += '<button class="btn bp btn-full" id="csImpBtn" style="margin-top:8px;display:none" onclick="applyCsImportRemarks()">💾 บันทึกหมายเหตุเฉพาะรายการที่เลือกไว้</button>';
  openM('📥 Import หมายเหตุจาก Excel', html);
}

function _csPreviewImportRemarks(input, dealerId) {
  ensureXLSX().then(function() {
    _csImportRemarksParse_impl(input, dealerId);
  }).catch(function(e) {
    if (typeof toast === 'function') toast('⚠️ โหลดไลบรารีไม่สำเร็จ: ' + (e && e.message || e), true);
  });
}

function _csImportRemarksParse_impl(input, dealerId) {
  var file = input.files[0];
  if (!file) return;
  var d = ST.getAll('dealers').filter(function(x) { return x.id === dealerId; })[0];
  if (!d) { toast('ไม่พบ Dealer'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    var prev = document.getElementById('csImpPreview');
    if (!prev) return;
    var wb;
    try { wb = XLSX.read(e.target.result, { type: 'array' }); } catch (err) {
      prev.innerHTML = '<div style="color:#ef4444;font-size:12px">เปิดไฟล์ไม่สำเร็จ: ' + sanitize(err && err.message || String(err)) + '</div>'; return;
    }
    var sheetName = wb.SheetNames.indexOf('ตาม PO ลูกค้า') !== -1 ? 'ตาม PO ลูกค้า' : wb.SheetNames[0];
    var ws = wb.Sheets[sheetName];
    var grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    var headerRowIdx = -1, header = [];
    for (var i = 0; i < grid.length; i++) {
      if (grid[i].indexOf('PO ลูกค้า') !== -1) { headerRowIdx = i; header = grid[i]; break; }
    }
    if (headerRowIdx === -1) { prev.innerHTML = '<div style="color:#ef4444;font-size:12px">ไม่พบหัวตาราง "PO ลูกค้า" ในชีต "' + sanitize(sheetName) + '" — ไฟล์นี้อาจไม่ได้มาจากปุ่ม Export Excel ของหน้านี้</div>'; return; }
    var poCol = header.indexOf('PO ลูกค้า'), skuCol = header.indexOf('SKU'), modelCol = header.indexOf('รายการสินค้า'), remarkCol = header.indexOf('หมายเหตุ');
    if (remarkCol === -1) { prev.innerHTML = '<div style="color:#ef4444;font-size:12px">ไฟล์นี้ไม่มีคอลัมน์ "หมายเหตุ" — ลอง Export ไฟล์ใหม่จากปุ่ม Export Excel ก่อน</div>'; return; }

    var sos = _csSOsForDealer(d.id);
    var noPoPrefix = '(ไม่มีเลข PO) ';
    var changes = [], rejects = [];
    for (var r = headerRowIdx + 1; r < grid.length; r++) {
      var row = grid[r];
      var poNo = String(row[poCol] || '').trim();
      var sku = String(row[skuCol] || '').trim();
      var model = String(row[modelCol] || '').trim();
      var remark = String(row[remarkCol] || '').trim();
      if (!poNo && !sku && !model) continue; // แถวว่าง/บรรทัดข้อความ "ไม่มีรายการ..."
      var matchKey = sku || model;
      if (!poNo || !matchKey) continue;

      var candidates = [];
      sos.forEach(function(s) {
        var key = s.customerPO || (noPoPrefix + (s.soNumber || s.id));
        if (key !== poNo) return;
        (s.items || []).forEach(function(it, idx) {
          if ((it.sku || it.model) === matchKey) candidates.push({ so: s, idx: idx, it: it });
        });
      });
      if (!candidates.length) { rejects.push({ rowNum: r + 1, reason: 'ไม่พบ PO "' + poNo + '" / สินค้า "' + matchKey + '" ของ Dealer นี้ (อาจถูกลบ หรือเลขไม่ตรงกับปัจจุบัน)' }); continue; }

      var oldSet = {};
      candidates.forEach(function(c) { oldSet[String(c.it.comment || '').trim()] = true; });
      var oldKeys = Object.keys(oldSet);
      if (oldKeys.length === 1 && oldKeys[0] === remark) continue; // ไม่มีอะไรเปลี่ยน

      changes.push({ poNo: poNo, sku: sku, model: model, oldSummary: oldKeys.join(' / '), newRemark: remark, candidates: candidates, rowNum: r + 1 });
    }

    window._csImportPending = { dealerId: dealerId, changes: changes, rejects: rejects };
    _csImportSel = {};
    changes.forEach(function(c, i) { _csImportSel[i] = true; });
    _csRenderImportRemarksPreview();
  };
  reader.readAsArrayBuffer(file);
}

function _csRenderImportRemarksPreview() {
  var prev = document.getElementById('csImpPreview');
  var pending = window._csImportPending;
  if (!prev || !pending) return;
  var selCount = pending.changes.filter(function(c, i) { return _csImportSel[i]; }).length;

  var h = '<div style="font-size:12px;color:var(--text2);background:var(--bg2);border-radius:6px;padding:8px;margin:8px 0">' +
    '✅ เลือกไว้ <strong style="color:var(--accent)">' + selCount + '/' + pending.changes.length + ' รายการ</strong> จะแก้หมายเหตุ' +
    (pending.rejects.length ? ' · <span style="color:#ef4444">⚠️ ' + pending.rejects.length + ' แถวถูกข้าม (ดูด้านล่าง)</span>' : '') +
    '</div>';

  if (pending.changes.length) {
    h += '<div style="display:flex;gap:6px;margin-bottom:6px">' +
      '<button class="btn bsm bo" onclick="_csImportRemarksBulkSelect(true)">✅ เลือกทั้งหมด</button>' +
      '<button class="btn bsm bo" onclick="_csImportRemarksBulkSelect(false)">❌ ไม่เลือกเลย</button></div>';
    h += '<div style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">';
    pending.changes.forEach(function(c, i) {
      var checked = !!_csImportSel[i];
      h += '<div style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:11.5px;display:flex;gap:8px;align-items:flex-start">';
      h += '<input type="checkbox" style="margin-top:2px" ' + (checked ? 'checked' : '') + ' onchange="_csImportRemarksToggle(' + i + ',this.checked)">';
      h += '<div' + (checked ? '' : ' style="opacity:.5"') + ' style="flex:1">';
      h += '<div style="font-weight:600;margin-bottom:2px">' + sanitize(c.poNo) + ' — ' + sanitize(c.model || c.sku) +
        (c.candidates.length > 1 ? ' <span style="color:var(--text2);font-weight:400">(' + c.candidates.length + ' รายการ/SO)</span>' : '') + '</div>';
      h += '<div><span style="color:var(--text2)">' + sanitize(c.oldSummary || '(ว่าง)') + '</span> → <span style="color:#22c55e">' + sanitize(c.newRemark || '(ว่าง)') + '</span></div>';
      h += '</div></div>';
    });
    h += '</div>';
  } else {
    h += '<div style="padding:10px;font-size:12px;color:var(--text2)">ไม่มีหมายเหตุที่เปลี่ยนจากเดิม</div>';
  }

  if (pending.rejects.length) {
    h += '<div style="font-weight:600;font-size:12px;margin:10px 0 4px;color:#ef4444">แถวที่ถูกข้าม (ไม่ import)</div>';
    h += '<div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">';
    pending.rejects.forEach(function(rj) {
      h += '<div style="padding:6px 10px;border-bottom:1px solid var(--border);font-size:11.5px;color:#ef4444">แถว ' + rj.rowNum + ': ' + sanitize(rj.reason) + '</div>';
    });
    h += '</div>';
  }
  prev.innerHTML = h;

  var canApply = selCount > 0;
  var wrap = document.getElementById('csImpConfirmWrap');
  var chk = document.getElementById('csImpConfirm');
  var btn = document.getElementById('csImpBtn');
  if (wrap) wrap.style.display = canApply ? 'flex' : 'none';
  if (btn) { btn.style.display = (canApply && chk && chk.checked) ? 'block' : 'none'; btn.disabled = !canApply || !chk || !chk.checked; }
  if (chk) chk.onchange = function() {
    if (btn) { btn.style.display = (canApply && chk.checked) ? 'block' : 'none'; btn.disabled = !canApply || !chk.checked; }
  };
}

function _csImportRemarksToggle(i, checked) { _csImportSel[i] = checked; _csRenderImportRemarksPreview(); }
function _csImportRemarksBulkSelect(val) {
  var pending = window._csImportPending;
  if (!pending) return;
  pending.changes.forEach(function(c, i) { _csImportSel[i] = val; });
  _csRenderImportRemarksPreview();
}

// บันทึกหมายเหตุตรงไปที่ it.comment (ฟิลด์เดียวกับคอมเมนต์ในหน้า SO/PO Tracker) โดยไม่เรียก render หน้า SO Detail
// (ต่างจาก saveSOItemComment ที่สมมติว่ากำลังอยู่หน้า SO Detail อยู่แล้ว) — render ทีเดียวหลัง apply ครบทุกรายการ
function _csApplySingleRemark(soId, idx, value) {
  var s = ST.getOne('salesOrders', soId);
  if (!s || !s.items || !s.items[idx]) return;
  var items = s.items.slice();
  items[idx] = Object.assign({}, items[idx], { comment: value });
  var updated = ST.update('salesOrders', soId, { items: items, updatedAt: new Date().toISOString() });
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('salesOrders', updated);
}

function applyCsImportRemarks() {
  var pending = window._csImportPending;
  if (!pending) return;
  var n = 0;
  pending.changes.forEach(function(c, i) {
    if (!_csImportSel[i]) return;
    c.candidates.forEach(function(cand) { _csApplySingleRemark(cand.so.id, cand.idx, c.newRemark); n++; });
  });
  window._csImportPending = null;
  _csImportSel = {};
  closeM();
  toast('💾 บันทึกหมายเหตุแล้ว (' + n + ' รายการ)');
  render();
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
  var groups = _csFilteredPOGroups(st);
  if (!groups.length) return '<div style="color:var(--text2);font-size:13px;padding:10px 2px">ไม่พบรายการที่ตรงกับ filter</div>';
  var h = '';
  groups.forEach(function(g, idx) {
    var pg = g.pg, items = g.items, order = g.order;
    var totalQty = g.totalQty, shippedQty = g.shippedQty, poValue = g.poValue;
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
  var sos = _csFilteredSOs(st);
  if (!sos.length) return '<div style="color:var(--text2);font-size:13px;padding:10px 2px">ไม่พบรายการที่ตรงกับ filter</div>';
  var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:560px">';
  h += '<thead><tr><th style="text-align:left;padding:0 8px 7px;font-size:10.5px;color:var(--text2)">SO</th><th style="text-align:left;padding:0 8px 7px;font-size:10.5px;color:var(--text2)">PO ลูกค้า</th><th style="text-align:left;padding:0 8px 7px;font-size:10.5px;color:var(--text2)">สถานะ</th><th style="text-align:left;padding:0 8px 7px;font-size:10.5px;color:var(--text2)">สร้างเมื่อ</th><th style="text-align:left;padding:0 8px 7px;font-size:10.5px;color:var(--text2)">เทอมเครดิต</th></tr></thead><tbody>';
  sos.forEach(function(s) {
    var cd = _csCreditDaysForSO(d, s);
    var creditNote = cd.special
      ? '<span style="font-size:10px;padding:2px 7px;border-radius:10px;border:1px solid;white-space:nowrap;background:var(--accent-light,#17344a);border-color:var(--accent);color:var(--accent)">🏷️ เครดิตโปรเจค ' + cd.days + ' วัน</span>'
      : (cd.days != null ? '<span style="font-size:10.5px;color:var(--text2)">' + cd.days + ' วัน</span>' : '');
    h += '<tr style="cursor:pointer" onclick="go(\'soDetail\',{soId:\'' + s.id + '\'})">' +
      '<td style="padding:9px 8px;border-top:1px solid var(--border);font-family:monospace;font-weight:600">' + sanitize(s.soNumber || '-') + '</td>' +
      '<td style="padding:9px 8px;border-top:1px solid var(--border);font-family:monospace">' + sanitize(s.customerPO || '-') + _csProjChip(typeof _soDisplayProjectId === 'function' ? _soDisplayProjectId(s) : s.projectId) + '</td>' +
      '<td style="padding:9px 8px;border-top:1px solid var(--border)">' + _soStatusBadge(s.status) + '</td>' +
      '<td style="padding:9px 8px;border-top:1px solid var(--border)">' + sanitize((s.createdAt || '').slice(0, 10)) + '</td>' +
      '<td style="padding:9px 8px;border-top:1px solid var(--border)">' + creditNote + '</td>' +
      '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

// ---------------- รวมทุก Dealer ตาม PO ลูกค้า / ตาม SO — ใช้โดย PO Tracker (views-potracker.js) ----------------
// ต่างจาก _csAllDealersProductHtml (จัดกลุ่มข้ามทุก Dealer ตามสินค้า) ตรงที่ PO/SO ผูกกับ Dealer เดียวอยู่แล้ว
// โดยธรรมชาติ เลยแค่วนทุก Dealer แล้วเรียก _csRenderByPO/_csRenderBySO เดิมซ้ำต่อ Dealer ใต้หัวข้อชื่อ Dealer
// ไม่ต้องเขียน render ใหม่ — ตัวกรองค้นหา/ยังไม่ส่ง-ส่งแล้ว (csSearch/csDeliveryFlt) มีผลเหมือนกับดู Dealer เดียว
function _csAllDealersPOHtml() {
  var h = '', any = false;
  ST.getAll('dealers').forEach(function(d) {
    if (!_csSOsForDealer(d.id).length) return;
    var st = _csDealerStats(d);
    var groups = _csFilteredPOGroups(st);
    if (!groups.length) return;
    any = true;
    h += '<div style="margin:16px 0 8px;font-size:12.5px;font-weight:700;color:var(--text2)">🏢 ' + sanitize(d.name) + '</div>';
    h += _csRenderByPO(d, st);
  });
  if (!any) return '<div style="color:var(--text2);font-size:13px;padding:10px 2px">ไม่พบรายการที่ตรงกับ filter</div>';
  return h;
}
function _csAllDealersSOHtml() {
  var h = '', any = false;
  ST.getAll('dealers').forEach(function(d) {
    if (!_csSOsForDealer(d.id).length) return;
    var st = _csDealerStats(d);
    var sos = _csFilteredSOs(st);
    if (!sos.length) return;
    any = true;
    h += '<div style="margin:16px 0 8px;font-size:12.5px;font-weight:700;color:var(--text2)">🏢 ' + sanitize(d.name) + '</div>';
    h += _csRenderBySO(d, st);
  });
  if (!any) return '<div style="color:var(--text2);font-size:13px;padding:10px 2px">ไม่พบรายการที่ตรงกับ filter</div>';
  return h;
}

// ---------------- มุมมอง "ตามสินค้า" ----------------
// รวมรายการสินค้าข้ามทุก PO/SO ของ Dealer — สินค้า 1 รายการโผล่ได้หลาย PO พร้อมกัน แยกเป็น PO/SO คนละคอลัมน์ merge แถวให้คู่กัน
function _csRenderByProduct(d, st) {
  var rawItems = _csFilteredProductItems(st);
  var h = _csCategoryTabsHtml(rawItems);
  var items = rawItems.filter(function(it) { return _csPassesCatFilter(it.category); });
  if (!items.length) return h + '<div style="color:var(--text2);font-size:13px;padding:10px 2px">ไม่พบรายการที่ตรงกับ filter</div>';

  h += '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;margin-bottom:8px">รายการสินค้ารวมทุก PO/SO ของ Dealer นี้ (' + items.length + ' รายการ)</div>';
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
        h += '<td rowspan="' + totalRows + '" style="padding:7px 8px;border-top:1px solid var(--border);vertical-align:top">' + sanitize(it.model || '-') + (it.poOrder.length > 1 ? '<div style="font-size:10.5px;color:var(--text2);margin-top:2px">อยู่ ' + it.poOrder.length + ' PO</div>' : '') + _csQuickCatSelectHtml(it.sku) + '</td>';
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

// ---------------- รวมทุก Dealer ตามสินค้า — ใช้โดย PO Tracker (views-potracker.js) แท็บ "🧰 ตามสินค้า" ----------------
// จัดกลุ่มสินค้าเดียวกัน (sku/model) ข้ามทุก Dealer แล้วแตกย่อยเป็น Dealer ใต้สินค้าแต่ละตัว (ไม่ใช่คอลัมน์ Dealer
// เฉยๆ) เพราะสินค้า 1 ตัวมักมีหลาย PO/SO ต่อ 1 Dealer อยู่แล้ว — ใช้ csSearch/csDeliveryFlt/csCatFilter ตัวเดียว
// กับแท็บ "ตามสินค้า" ของ Dealer รายตัว ให้พฤติกรรม filter คุ้นเคยเหมือนเดิม ไม่มีตัวกรองแยกชุดใหม่
function _csAllDealersProductHtml() {
  var groupsMap = {}, groupOrder = [];
  ST.getAll('dealers').forEach(function(d) {
    if (!_csSOsForDealer(d.id).length) return;
    var st = _csDealerStats(d);
    _csFilteredProductItems(st).forEach(function(it) {
      var key = it.sku || it.model;
      if (!groupsMap[key]) { groupsMap[key] = { model: it.model, sku: it.sku, category: it.category, dealerItems: [] }; groupOrder.push(key); }
      groupsMap[key].dealerItems.push({ dealer: d, it: it });
    });
  });
  var groups = groupOrder.map(function(k) { return groupsMap[k]; });

  var h = _csCategoryTabsHtml(groups);
  var filtered = groups.filter(function(g) { return _csPassesCatFilter(g.category); });
  if (!filtered.length) return h + '<div style="color:var(--text2);font-size:13px;padding:10px 2px">ไม่พบรายการที่ตรงกับ filter</div>';

  function _groupTotals(g) {
    var qty = 0, shipped = 0;
    g.dealerItems.forEach(function(di) { qty += di.it.totalQty; shipped += di.it.totalShipped; });
    return { qty: qty, shipped: shipped };
  }

  var kpiQty = 0, kpiRemain = 0, dealersWithRemain = {}, productsWithRemain = 0;
  filtered.forEach(function(g) {
    var t = _groupTotals(g);
    kpiQty += t.qty; kpiRemain += (t.qty - t.shipped);
    if (t.qty - t.shipped > 0) {
      productsWithRemain++;
      g.dealerItems.forEach(function(di) { if (di.it.totalQty - di.it.totalShipped > 0) dealersWithRemain[di.dealer.id] = true; });
    }
  });
  filtered.sort(function(a, b) { var ta = _groupTotals(a), tb = _groupTotals(b); return (tb.qty - tb.shipped) - (ta.qty - ta.shipped); });

  h += '<div class="card-grid" style="margin-bottom:10px">' +
    _csTile('คงค้างรวม', kpiRemain + ' ชิ้น') +
    _csTile('สั่งรวมทั้งหมด', kpiQty + ' ชิ้น') +
    _csTile('สินค้าที่ยังค้าง', productsWithRemain + ' รายการ') +
    _csTile('Dealer ที่มีของค้าง', String(Object.keys(dealersWithRemain).length)) +
    '</div>';
  h += '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;margin-bottom:8px">รายการสินค้ารวมทุก PO/SO ของทุก Dealer (' + filtered.length + ' รายการ)</div>';
  h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">';
  h += '<thead><tr><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">Dealer</th><th style="padding:0 8px 6px;font-size:10.5px;color:var(--text2);text-align:center">รวมทุก PO</th><th style="padding:0 8px 6px;font-size:10.5px;color:var(--text2);text-align:center">ส่งแล้ว</th><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">คงค้าง</th><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">อยู่ใน PO ไหนบ้าง</th><th style="text-align:left;padding:0 8px 6px;font-size:10.5px;color:var(--text2)">อยู่ใน SO ไหนบ้าง</th></tr></thead><tbody>';

  filtered.forEach(function(g) {
    var t = _groupTotals(g);
    var pct = t.qty ? Math.round(t.shipped / t.qty * 100) : 0;
    h += '<tr style="background:var(--bg2)"><td colspan="6" style="padding:8px 8px;border-top:1px solid var(--border)">' +
      '<div style="font-weight:600">' + sanitize(g.model || '-') + ' <span style="font-size:10.5px;color:var(--text2);font-weight:400">' + sanitize(g.sku || '') + '</span></div>' +
      _csQuickCatSelectHtml(g.sku) +
      '<div style="display:flex;align-items:center;gap:7px;margin-top:4px"><div style="flex:1;height:7px;min-width:50px;border-radius:4px;background:var(--bg3,var(--bg));overflow:hidden"><i style="display:block;height:100%;width:' + pct + '%;background:#3ecf8e"></i></div>' +
      '<span style="font-size:11px;color:var(--text2);white-space:nowrap">รวม ' + t.qty + ' ชิ้น · ส่งแล้ว ' + t.shipped + ' · ' + g.dealerItems.length + ' Dealer</span></div>' +
      '</td></tr>';
    g.dealerItems.forEach(function(di) {
      var it = di.it;
      var remain = it.totalQty - it.totalShipped;
      var ipct = it.totalQty ? Math.round(it.totalShipped / it.totalQty * 100) : 0;
      var poHtml = it.poOrder.map(function(poNo) {
        var pe = it.poMap[poNo];
        return '<div><b style="font-family:monospace">' + sanitize(poNo) + '</b> <span style="font-size:10.5px;color:var(--text2)">' + pe.qty + ' ชิ้น</span>' + _csProjChip(pe.pg.projectId) + '</div>';
      }).join('');
      var soHtml = it.poOrder.map(function(poNo) {
        return it.poMap[poNo].sos.map(function(x) {
          return '<div onclick="go(\'soDetail\',{soId:\'' + x.so.id + '\'})" style="cursor:pointer"><span style="font-family:monospace;font-weight:600">' + sanitize(x.so.soNumber || '-') + '</span> ' +
            '<span style="font-size:10px;padding:2px 7px;border-radius:10px;border:1px solid;white-space:nowrap;' + (x.shipped > 0 ? 'background:#3ecf8e22;border-color:#3ecf8e55;color:#3ecf8e' : 'background:var(--bg2);border-color:var(--border);color:var(--text2)') + '">' + (x.shipped > 0 ? 'ส่งแล้ว ' + x.shipped : 'ยังไม่ส่ง') + '</span></div>';
        }).join('');
      }).join('');
      h += '<tr><td style="padding:7px 8px;border-top:1px solid var(--border)"><span style="font-size:10.5px;padding:2px 8px;border-radius:7px;background:var(--accent-light,rgba(59,130,246,.1));color:var(--accent);font-weight:600;white-space:nowrap">🏢 ' + sanitize(di.dealer.name) + '</span></td>' +
        '<td style="padding:7px 8px;border-top:1px solid var(--border);text-align:center">' + it.totalQty + '</td>' +
        '<td style="padding:7px 8px;border-top:1px solid var(--border);text-align:center">' + it.totalShipped + '</td>' +
        '<td style="padding:7px 8px;border-top:1px solid var(--border)"><div style="display:flex;align-items:center;gap:7px"><div style="flex:1;height:7px;min-width:50px;border-radius:4px;background:var(--bg2);overflow:hidden"><i style="display:block;height:100%;width:' + ipct + '%;background:#3ecf8e"></i></div><span style="font-size:11px;color:var(--text2);white-space:nowrap">' + (remain > 0 ? 'เหลือ ' + remain : 'ครบ') + '</span></div></td>' +
        '<td style="padding:7px 8px;border-top:1px solid var(--border)">' + poHtml + '</td>' +
        '<td style="padding:7px 8px;border-top:1px solid var(--border)">' + soHtml + '</td></tr>';
    });
  });
  h += '</tbody></table></div>';
  return h;
}
