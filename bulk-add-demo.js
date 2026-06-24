// วางสคริปต์นี้ใน Browser Console ขณะเปิดหน้า Demo Equipment แล้วกด Enter
// รันได้ซ้ำได้อย่างปลอดภัย — สคริปต์จะลบของเดิมที่ตรงกับรายการชุดนี้ (เทียบจาก ชื่อ+SKU+S/N+เลขเครื่องเช่า)
// ออกก่อนเสมอ แล้วค่อยใส่ข้อมูลที่ถูกต้องล่าสุดใหม่ทั้งหมด — อุปกรณ์ Demo อื่นที่ไม่เกี่ยวกับชุดนี้ไม่ถูกแตะต้อง

(function () {
  // แต่ละ unit: name, sku, sn, rentalDb, nbtc, ins, caat, note, status, loans:[{person,range,status,remark}]
  var units = [
    // ---- DJI Matrice 400 ----
    { name: 'DJI Matrice 400 (Demo Unit)', sku: 'DJI-6937224120556', sn: '1581F8DBW25AD00A31JV', db: '17183', nbtc: true, ins: true, caat: true, note: 'สถานะอ้างอิงเดิม: Reserved (ไม่มีรายละเอียดผู้ยืม/วันที่)', status: 'available', loans: [] },
    { name: 'DJI Matrice 400 (Demo Unit)', sku: 'DJI-6937224120556', sn: '1581F8DBW25AD00A31GW', db: '17726', nbtc: false, ins: false, caat: false, note: 'ห้ามบิน / แสดงสินค้าอย่างเดียว', status: 'available', loans: [] },
    { name: 'DJI Matrice 400 (Demo Unit)', sku: 'DJI-6937224120556', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'DJI Matrice 400 (Demo Unit)', sku: 'DJI-6937224120556', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- DJI Matrice 4T ----
    { name: 'DJI Matrice 4T (Demo Unit)', sku: 'DJI-6941565994219', sn: '1581F7K3C25BU00DPL7A', db: '17144', nbtc: true, ins: true, caat: true, note: 'ห้ามบิน / แสดงสินค้าอย่างเดียว — สถานะอ้างอิงเดิม: Returned (ไม่มีวันที่)', status: 'available', loans: [] },
    { name: 'DJI Matrice 4T (Demo Unit)', sku: 'DJI-6941565994219', sn: '1581F7K3C257R00D03YU', db: '17727', nbtc: false, ins: false, caat: false, note: 'สถานะอ้างอิงเดิม: Returned (ไม่มีวันที่)', status: 'available', loans: [] },
    { name: 'DJI Matrice 4T (Demo Unit)', sku: 'DJI-6941565994219', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'DJI Matrice 4T (Demo Unit)', sku: 'DJI-6941565994219', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- DJI Matrice 4E ----
    { name: 'DJI Matrice 4E (Demo Unit)', sku: 'DJI-6941565998095', sn: '1581F7FVC255E00DTY82', db: '17587', nbtc: false, ins: false, caat: false, note: 'ห้ามบิน / แสดงสินค้าอย่างเดียว — สถานะอ้างอิงเดิม: Returned (ไม่มีวันที่)', status: 'available', loans: [] },
    { name: 'DJI Matrice 4E (Demo Unit)', sku: 'DJI-6941565998095', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'DJI Matrice 4E (Demo Unit)', sku: 'DJI-6941565998095', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'DJI Matrice 4E (Demo Unit)', sku: 'DJI-6941565998095', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- DJI Matrice 4TD ----
    { name: 'DJI Matrice 4TD (Demo Unit)', sku: 'DJI-6937224106369', sn: '1581F8HGX256P00A0KUG', db: '17129', nbtc: true, ins: true, caat: true, note: '', status: 'lent', loans: [
      { person: 'อุ้ย/เคน', range: '20-22/05/2026', status: 'Returned', remark: 'งานการเกษตร PDA' },
      { person: 'อุ้ย/เคน', range: '28/05-30/07/2026', status: 'Borrowed', remark: 'DJI ขอให้ พี่ยอด ยืมไปใช้ ทำ Use case' }
    ] },
    { name: 'DJI Matrice 4TD (Demo Unit)', sku: 'DJI-6937224106369', sn: '1581F8HGX25BU00A15TZ', db: '17702', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' },
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'DJI Matrice 4TD (Demo Unit)', sku: 'DJI-6937224106369', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'DJI Matrice 4TD (Demo Unit)', sku: 'DJI-6937224106369', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- DJI Dock 3 ----
    { name: 'DJI Dock 3 (Demo Unit)', sku: 'DJI-6937224108073', sn: '8HEXN6600AR1BU', db: '17184', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'อุ้ย/เคน', range: '20-22/05/2026', status: 'Returned', remark: 'งานการเกษตร PDA' },
      { person: 'อุ้ย/เคน', range: '28/05-30/07/2026', status: 'Borrowed', remark: 'DJI ขอให้ พี่ยอด ยืมไปใช้ ทำ Use case' }
    ] },
    { name: 'DJI Dock 3 (Demo Unit)', sku: 'DJI-6937224108073', sn: '', db: '17707', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' }
    ] },
    { name: 'DJI Dock 3 (Demo Unit)', sku: 'DJI-6937224108073', sn: '', db: '', nbtc: false, ins: false, caat: false, note: 'เตรียมมาเป็น demo', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'DJI Dock 3 (Demo Unit)', sku: 'DJI-6937224108073', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- DJI AL1 SpotLight ----
    { name: 'DJI AL1 SpotLight', sku: 'DJI-6937224105829', sn: '8Q4CN7100A15UW', db: '17145', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '11-13/06/2026', status: 'Returned', remark: 'Showcase chaingmai' },
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' },
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'DJI AL1 SpotLight', sku: 'DJI-6937224105829', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'DJI AL1 SpotLight', sku: 'DJI-6937224105829', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'DJI AL1 SpotLight', sku: 'DJI-6937224105829', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- DJI AS1 Speaker ----
    { name: 'DJI AS1 Speaker', sku: 'DJI-6937224105812', sn: '8V2CN8K00A1AJR', db: '17146', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '11-13/06/2026', status: 'Returned', remark: 'Showcase chaingmai' },
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' },
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'DJI AS1 Speaker', sku: 'DJI-6937224105812', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'DJI AS1 Speaker', sku: 'DJI-6937224105812', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'DJI AS1 Speaker', sku: 'DJI-6937224105812', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- Zenmuse L3 ----
    { name: 'Zenmuse L3 (Demo Unit)', sku: 'DJI-ZENMUSEL3DEMO', sn: 'ACYDNAM001KJF3', db: '17131', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'ตั๊ก/อุ้ย', range: '15/05/2026', status: 'Returned', remark: 'กรมยุทธโยธาทหารบก UNITED BUSINESS SOLUTIONS LIMITED (UBS)' },
      { person: 'ไอซ์', range: '26-29/05/2026', status: 'Reserved', remark: 'Aonic ขอยืม L3+Gimbal งานที่เพชรบูรณ์ ทำแผนที่ End user: ตำรวจ' },
      { person: 'ตั๊ก', range: '11-13/06/2026', status: 'Reserved', remark: 'Showcase chaingmai' },
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' },
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'Zenmuse L3 (Demo Unit)', sku: 'DJI-ZENMUSEL3DEMO', sn: 'ACYDP14001J788', db: '17729', nbtc: false, ins: false, caat: false, note: '', status: 'available', loans: [] },
    { name: 'Zenmuse L3 (Demo Unit)', sku: 'DJI-ZENMUSEL3DEMO', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- Zenmuse P1 ----
    { name: 'Zenmuse P1 (Demo Unit)', sku: 'DJI-ZENMUSEP1DEMO', sn: '3XMDNAB0012FE5', db: '17132', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '11-13/06/2026', status: 'Returned', remark: 'Showcase chaingmai' },
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' },
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'Zenmuse P1 (Demo Unit)', sku: 'DJI-ZENMUSEP1DEMO', sn: '3XMDP15001M04M', db: '17730', nbtc: false, ins: false, caat: false, note: '', status: 'available', loans: [] },
    { name: 'Zenmuse P1 (Demo Unit)', sku: 'DJI-ZENMUSEP1DEMO', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- Zenmuse S1 ----
    { name: 'Zenmuse S1 (Demo Unit)', sku: 'DJI-ZENMUSES1DEMO', sn: '9BXUNAF0017CG0', db: '17133', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '11-13/06/2026', status: 'Returned', remark: 'Showcase chaingmai' },
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' },
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'Zenmuse S1 (Demo Unit)', sku: 'DJI-ZENMUSES1DEMO', sn: '9BXUN9D001J5Q7', db: '17731', nbtc: false, ins: false, caat: false, note: '', status: 'available', loans: [] },
    { name: 'Zenmuse S1 (Demo Unit)', sku: 'DJI-ZENMUSES1DEMO', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- Zenmuse V1 ----
    { name: 'Zenmuse V1 (Demo Unit)', sku: 'DJI-ZENMUSEV1DEMO', sn: '9BWUNBK001K4ST', db: '17134', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '11-13/06/2026', status: 'Returned', remark: 'Showcase chaingmai' },
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' },
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'Zenmuse V1 (Demo Unit)', sku: 'DJI-ZENMUSEV1DEMO', sn: '9BWUNBK001004N', db: '17732', nbtc: false, ins: false, caat: false, note: '', status: 'available', loans: [] },
    { name: 'Zenmuse V1 (Demo Unit)', sku: 'DJI-ZENMUSEV1DEMO', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- Zenmuse H30T ----
    { name: 'Zenmuse H30T (Demo Unit)', sku: 'DJI-ZENMUSEH30TDEM', sn: '6WHDM580016YDR', db: '17130', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '11-13/06/2026', status: 'Returned', remark: 'Showcase chaingmai' },
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' },
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'Zenmuse H30T (Demo Unit)', sku: 'DJI-ZENMUSEH30TDEM', sn: '6WHXNC600303K2', db: '17728', nbtc: false, ins: false, caat: false, note: '', status: 'available', loans: [] },
    { name: 'Zenmuse H30T (Demo Unit)', sku: 'DJI-ZENMUSEH30TDEM', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- D-RTK 3 Multifunctional Station ----
    { name: 'D-RTK 3 Multifunctional Station (Demo Unit)', sku: 'DJI-6937224104822', sn: '8PHDN6T00ANJH4', db: '17128', nbtc: false, ins: false, caat: false, note: '', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '11-13/06/2026', status: 'Returned', remark: 'Showcase chaingmai' },
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' },
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'D-RTK 3 Multifunctional Station (Demo Unit)', sku: 'DJI-6937224104822', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'D-RTK 3 Multifunctional Station (Demo Unit)', sku: 'DJI-6937224104822', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    { name: 'D-RTK 3 Multifunctional Station (Demo Unit)', sku: 'DJI-6937224104822', sn: '', db: '', nbtc: false, ins: false, caat: false, note: '', status: 'unavailable', loans: [] },
    // ---- D-RTK 3 Survey Pole and Tripod Kit ----
    { name: 'D-RTK 3 Survey Pole and Tripod Kit', sku: 'DJI-6937224104808', sn: '', db: '17658', nbtc: false, ins: false, caat: false, note: 'No serials (อุปกรณ์ไม่มี S/N)', status: 'lent', loans: [
      { person: 'ตั๊ก', range: '11-13/06/2026', status: 'Returned', remark: 'Showcase chaingmai' },
      { person: 'ตั๊ก', range: '16-18/07/2026', status: 'Reserved', remark: 'Showcase Hatyai' },
      { person: 'ตั๊ก', range: '21-25/07/2026', status: 'Reserved', remark: 'International Engineering Expo 2026' }
    ] },
    { name: 'D-RTK 3 Survey Pole and Tripod Kit', sku: 'DJI-6937224104808', sn: '', db: '17659', nbtc: false, ins: false, caat: false, note: '', status: 'available', loans: [] },
    { name: 'D-RTK 3 Survey Pole and Tripod Kit', sku: 'DJI-6937224104808', sn: '', db: '17660', nbtc: false, ins: false, caat: false, note: '', status: 'available', loans: [] },
    { name: 'D-RTK 3 Survey Pole and Tripod Kit', sku: 'DJI-6937224104808', sn: '', db: '17661', nbtc: false, ins: false, caat: false, note: '', status: 'available', loans: [] }
  ];

  // แปลง "20-22/05/2026" หรือ "28/05-30/07/2026" หรือ "15/05/2026" -> {start:'DD/MM/YYYY', end:'DD/MM/YYYY'}
  function parseRange(s) {
    if (!s) return { start: '', end: '' };
    var parts = s.split('-');
    if (parts.length === 1) {
      return { start: s.trim(), end: s.trim() };
    }
    var a = parts[0].trim(), b = parts[1].trim();
    var bParts = b.split('/');
    var aSlashCount = a.split('/').length - 1;
    if (aSlashCount === 0) {
      // a เป็นแค่วัน (เช่น "20") ใช้เดือน/ปีจาก b
      a = a + '/' + bParts[1] + '/' + bParts[2];
    } else if (aSlashCount === 1) {
      // a เป็น "วัน/เดือน" (เช่น "28/05") ขาดปี ใช้ปีจาก b
      a = a + '/' + bParts[bParts.length - 1];
    }
    return { start: a, end: b };
  }

  // ลบของเดิมที่ตรงกับชุดนี้ทุกตัว (เทียบ ชื่อ+SKU+S/N+เลขเครื่องเช่า) ก่อนใส่ใหม่ — กันรันซ้ำซ้อน
  function unitKey(o) { return [o.name || '', o.sku || '', o.serialNumber || o.sn || '', o.rentalDbNo || o.db || ''].join('|'); }
  var importKeys = {};
  units.forEach(function (u) { importKeys[unitKey(u)] = true; });

  var oldItems = getDemoItems();
  var removedIds = {};
  var keptItems = oldItems.filter(function (d) {
    if (importKeys[unitKey(d)]) { removedIds[d.id] = true; return false; }
    return true;
  });
  var keptLoans = getDemoLoans().filter(function (l) { return !removedIds[l.demoId]; });
  if (oldItems.length !== keptItems.length) {
    console.log('ลบของเดิมที่ซ้ำกับชุดนี้ออก ' + (oldItems.length - keptItems.length) + ' เครื่อง ก่อนใส่ใหม่');
  }

  var items = keptItems;
  var loans = keptLoans;
  var ts = Date.now();

  units.forEach(function (u, idx) {
    var demoId = 'dm_' + (ts + idx);
    items.push({
      id: demoId,
      name: u.name,
      sku: u.sku,
      serialNumber: u.sn,
      rentalDbNo: u.db,
      model: '',
      note: u.note,
      status: u.status,
      dealerId: '',
      borrower: u.loans.length ? u.loans[u.loans.length - 1].person : '',
      purpose: u.loans.length ? u.loans[u.loans.length - 1].remark : '',
      lentDate: '',
      returnDate: '',
      nbtcRegistered: u.nbtc,
      droneInsurance: u.ins,
      caatRegistered: u.caat
    });

    var todayD = new Date(); todayD.setHours(0, 0, 0, 0);
    var ongoing = null, future = null, staleFallback = null; // เลือก loan ที่จะใช้แทนสถานะปัจจุบันของเครื่อง
    u.loans.forEach(function (l, li) {
      var rng = parseRange(l.range);
      var isReturned = l.status === 'Returned';
      loans.push({
        id: 'dmloan_' + ts + '_' + idx + '_' + li,
        demoId: demoId, demoName: u.name,
        dealerId: '', borrower: l.person, purpose: l.remark,
        lentDate: rng.start, returnDate: rng.end,
        actualReturnDate: isReturned ? rng.end : '',
        note: '', status: isReturned ? 'returned' : 'active', created: new Date().toISOString()
      });
      if (!isReturned) {
        var s = ftParseDate(rng.start), e = ftParseDate(rng.end) || s;
        if (s && e && s <= todayD && e >= todayD) {
          ongoing = rng; // กำลังยืมอยู่จริงตอนนี้
        } else if (s && s > todayD) {
          if (!future || s < ftParseDate(future.start)) future = rng; // จองอนาคตที่ใกล้สุด
        } else {
          staleFallback = rng; // ข้อมูลเก่าที่ยังไม่ได้ปิด (ผ่านวันไปแล้วแต่ยังไม่ Returned ในชีตเดิม)
        }
      }
    });
    var pick = ongoing || future || staleFallback;
    if (pick) {
      var it = items[items.length - 1];
      it.lentDate = pick.start;
      it.returnDate = pick.end;
    }
  });

  saveDemoItems(items);
  saveDemoLoans(loans);
  console.log('เพิ่มอุปกรณ์ Demo ' + units.length + ' รายการ พร้อมประวัติยืม ' + (loans.length) + ' รายการ (รวมของเดิม) — รีเฟรชหน้าเพื่อดูผล');
  if (typeof render === 'function') render();
})();
