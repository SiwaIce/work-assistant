// ================================================================
// FIX MISMATCHED MODEL NAMES IN items[]  (สคริปต์รันครั้งเดียว)
// ไม่ได้ถูกเรียกใช้จากแอปเลย (ไม่มีอ้างอิงใน index.html/sw.js) — ใช้แค่แปะรันใน
// Browser Console ของเว็บจริงตอน login แล้วเท่านั้น
//
// เวอร์ชันนี้เทียบกับ catalog จริงจากหน้า "สินค้าและราคา" (v7_products) แล้ว
// ไม่ใช่ list default เก่าที่ถูกลบทิ้งไปแล้ว — ยืนยันกับผู้ใช้ทีละชื่อก่อนสร้าง map นี้
//
// วิธีใช้:
//   1. เปิดเว็บจริง (production) แล้ว login ให้เรียบร้อย
//   2. เปิด DevTools Console แปะโค้ดทั้งไฟล์นี้ลงไป กด Enter
//   3. รัน  previewModelNameFix()   ← แค่ดูรายงาน ไม่แก้อะไรเลย
//   4. เช็ครายงานให้ดี โดยเฉพาะกลุ่ม "needsReview" ที่ยังกำกวม
//   5. ถ้าโอเค ให้รัน  applyModelNameFix()  เพื่อแก้จริง (แก้เฉพาะชื่อที่อยู่ใน
//      MODEL_NAME_FIX_MAP เท่านั้น ของกำกวมจะไม่ถูกแตะ)
//   6. ชื่อเดิมจะถูกเก็บสำรองไว้ในฟิลด์ items[]._legacyModel ของแต่ละชิ้นเสมอ
// ================================================================

// key = ชื่อเดิมที่เจอจริงใน items[].model (เทียบตรงตัว) → ชื่อ catalog จริงที่ถูกต้อง (ยืนยันกับผู้ใช้แล้วทีละตัว)
var MODEL_NAME_FIX_MAP = {
  'Matrice 4T': 'M4T with Extended Warranty',
  'Matrice 4E': 'M4E with Extended Warranty',
  'Matrice 4TD': 'DJI M4TD with Extended Warranty',
  'Matrice 400': 'Matrice 400 with Extended Warranty',
  'DJI Matrice 400': 'Matrice 400 with Extended Warranty',
  'DJI Matrice 4E': 'M4E with Extended Warranty',
  'DJI Matrice 4TD': 'DJI M4TD with Extended Warranty',
  'Dock 3': 'DJI Dock 3(Overseas Edition)',
  'D-RTK3': 'D-RTK 3 Multifunctional Station',
  'Zenmuse L2': 'ZENMUSE L2',
  'Zenmuse L3': 'Zenmuse L3 with Extended Warranty',
  'Mavic 3 Multispectral': 'Mavic 3 Multispectral Universal Edition',
  // ชื่อรูปแบบเดิมจาก list default เก่าที่เคยฝังในโค้ด (ลบไปแล้ว) — เจอทั้งใน items[] และฟิลด์ model แบบเก่า
  'DJI Matrice 4E (M4E)': 'M4E with Extended Warranty',
  'DJI Matrice 4T (M4T)': 'M4T with Extended Warranty',
  'DJI Matrice 400 (M400)': 'Matrice 400 with Extended Warranty',
  'DJI Matrice 4TD (M4TD)': 'DJI M4TD with Extended Warranty',
  'DJI Mavic 3 Multispectral (M3M)': 'Mavic 3 Multispectral Universal Edition'
};

// ชื่อที่กำกวมเกินจะเดา — ไม่อยู่ใน MODEL_NAME_FIX_MAP โดยตั้งใจ ต้องเลือกเอง:
//   'DJI Terra' — ไม่รู้ tier (Standard/Flagship/Edu) และไม่รู้ระยะเวลา (1 ปี/ถาวร)
//
// รายชื่อต่อไปนี้ตรวจสอบกับ catalog จริงแล้วว่า "ถูกต้องอยู่แล้ว" ไม่ต้องแก้ — เคยเข้าใจผิดว่าต้องแก้เพราะ
// รอบแรกเทียบกับ list default เก่าที่ถูกลบไปแล้ว: D-RTK 3 Multifunctional Station, D-RTK 3 Survey Pole
// and Tripod Kit, DJI Dock 3(Overseas Edition), M4E with Extended Warranty, M4T with Extended Warranty,
// Matrice 400 with Extended Warranty, Zenmuse L3 with Extended Warranty, TB100 Intelligent Flight Battery,
// ZENMUSE L2, Zenmuse H30T, Zenmuse P1, Zenmuse S1, Zenmuse V1, Matrice 350 RTK (General),
// DJI Terra - Edu. - Permanent - 10 Control Devices, DJI Terra - Standard - Permanent,
// DJI Terra Standard + DJI Modify Flagship - Permanent, DJI Matrice 4TD(DJI RC Plus 2 Enterprise
// (Extended Warranty)) SP Plus +

var _modelFixPlan = null;

function previewModelNameFix() {
  var catalog = (typeof Products !== 'undefined' && Products.getAll) ? Products.getAll().map(function(p) { return p.name; }) : [];
  var plan = { fixable: [], needsReview: [] };

  ST.getAll('pipeline').forEach(function(p) {
    if (p.items && p.items.length) {
      p.items.forEach(function(it, idx) {
        if (!it.model || catalog.indexOf(it.model) !== -1) return; // ถูกอยู่แล้ว ข้าม
        var row = { pipeId: p.id, project: p.projectName, itemIndex: idx, oldModel: it.model, isFlatModel: false };
        if (MODEL_NAME_FIX_MAP[it.model]) {
          row.newModel = MODEL_NAME_FIX_MAP[it.model];
          row.newModelExistsInCatalog = catalog.indexOf(row.newModel) !== -1;
          plan.fixable.push(row);
        } else {
          plan.needsReview.push(row);
        }
      });
    } else if (p.model && catalog.indexOf(p.model) === -1) {
      // record แบบเก่า ไม่มี items[] เลย ใช้ฟิลด์ model ตรงๆ
      var frow = { pipeId: p.id, project: p.projectName, itemIndex: -1, oldModel: p.model, isFlatModel: true };
      if (MODEL_NAME_FIX_MAP[p.model]) {
        frow.newModel = MODEL_NAME_FIX_MAP[p.model];
        frow.newModelExistsInCatalog = catalog.indexOf(frow.newModel) !== -1;
        plan.fixable.push(frow);
      } else {
        plan.needsReview.push(frow);
      }
    }
  });

  // ตารางสรุปนับจำนวนต่อคู่ old→new (ดูรวดเดียวว่าแต่ละชื่อเจอกี่รายการ)
  var summary = {};
  plan.fixable.forEach(function(r) {
    var key = r.oldModel + ' → ' + r.newModel;
    summary[key] = (summary[key] || 0) + 1;
  });
  console.log('=== สรุปจำนวนต่อคู่ชื่อ (old → new) ===');
  console.table(Object.keys(summary).map(function(key) { return { mapping: key, จำนวน: summary[key] }; }));

  console.log('=== แก้ได้เลย — รายละเอียดทีละรายการ (จะแก้ถ้ารัน applyModelNameFix()) ===');
  console.table(plan.fixable.map(function(r) { return { pipeId: r.pipeId, project: r.project, old: r.oldModel, new: r.newModel, newExistsInCatalog: r.newModelExistsInCatalog, ฟิลด์: r.isFlatModel ? 'model (เก่า ไม่มี items[])' : 'items[]' }; }));

  console.log('=== ต้องเลือกเอง (สคริปต์ไม่แตะเลย) ===');
  console.table(plan.needsReview.map(function(r) { return { pipeId: r.pipeId, project: r.project, old: r.oldModel, ฟิลด์: r.isFlatModel ? 'model (เก่า ไม่มี items[])' : 'items[]' }; }));

  console.log('fixable: ' + plan.fixable.length + ' | needsReview: ' + plan.needsReview.length);

  _modelFixPlan = plan;
  return plan;
}

function applyModelNameFix() {
  if (!_modelFixPlan) {
    console.warn('⚠️ กรุณารัน previewModelNameFix() ก่อน แล้วค่อยเรียกฟังก์ชันนี้');
    return;
  }
  var toApply = _modelFixPlan.fixable.filter(function(r) { return r.newModelExistsInCatalog; });
  var skipped = _modelFixPlan.fixable.filter(function(r) { return !r.newModelExistsInCatalog; });
  if (skipped.length) {
    console.warn('⚠️ ข้าม ' + skipped.length + ' รายการ เพราะชื่อใหม่ไม่พบใน catalog ปัจจุบัน (catalog อาจเปลี่ยนไปแล้ว):', skipped);
  }
  if (!toApply.length) { console.log('ไม่มีรายการให้แก้'); return; }

  var byPipe = {};
  toApply.forEach(function(r) {
    byPipe[r.pipeId] = byPipe[r.pipeId] || [];
    byPipe[r.pipeId].push(r);
  });

  var fixedCount = 0;
  Object.keys(byPipe).forEach(function(pipeId) {
    var p = ST.getOne('pipeline', pipeId);
    if (!p) return;

    var flatRow = byPipe[pipeId].filter(function(r) { return r.isFlatModel; })[0];
    if (flatRow && p.model === flatRow.oldModel) {
      // record เก่าไม่มี items[] — แก้ฟิลด์ model ตรงๆ เก็บของเดิมไว้ใน _legacyModel ที่ตัว pipeline เอง
      ST.update('pipeline', pipeId, { model: flatRow.newModel, _legacyModel: flatRow.oldModel });
      fixedCount++;
    }

    var itemRows = byPipe[pipeId].filter(function(r) { return !r.isFlatModel; });
    if (itemRows.length && p.items) {
      itemRows.forEach(function(r) {
        var it = p.items[r.itemIndex];
        if (it && it.model === r.oldModel) {
          it._legacyModel = it.model;
          it.model = r.newModel;
          fixedCount++;
        }
      });
      ST.update('pipeline', pipeId, { items: p.items });
    }
  });

  if (typeof syncToFirebase === 'function') syncToFirebase('pipeline', ST.getAll('pipeline'));
  console.log('✅ แก้แล้ว ' + fixedCount + ' รายการ ใน ' + Object.keys(byPipe).length + ' ดีล (ของเดิมสำรองไว้ใน items[]._legacyModel)');
}

// ================================================================
// STEP 2 (แยกต่างหาก รันหลัง applyModelNameFix() เสร็จแล้ว) — ดึงราคาใส่ให้รายการที่เพิ่งแก้ชื่อ
// แก้แค่ชื่อไม่ได้แก้ price/total ที่เก็บไว้เดิม (ตอนชื่อผิดหาไม่เจอในcatalog เลยติด 0 มาแต่แรก)
// ไม่แตะ Forecast Amount รวมของทั้งดีล เพราะอาจเป็นมูลค่าที่เจรจาจริงแยกต่างหาก ให้ผู้ใช้ตรวจสอบเอง
// ================================================================

var _priceBackfillPlan = null;

function previewPriceBackfill() {
  var rows = [];
  ST.getAll('pipeline').forEach(function(p) {
    if (!p.items || !p.items.length) return;
    p.items.forEach(function(it, idx) {
      if (!it._legacyModel) return; // เอาเฉพาะรายการที่เพิ่งถูกแก้ชื่อโดย applyModelNameFix()
      var newPrice = (typeof getModelPrice === 'function') ? getModelPrice(it.model) : 0;
      if (newPrice > 0 && Number(it.price || 0) !== newPrice) {
        rows.push({ pipeId: p.id, project: p.projectName, itemIndex: idx, model: it.model, qty: it.qty, oldPrice: it.price || 0, newPrice: newPrice, newTotal: newPrice * (Number(it.qty) || 1) });
      }
    });
  });
  console.log('=== ราคาที่จะอัปเดต (เฉพาะรายการที่เพิ่งแก้ชื่อ) ===');
  console.table(rows);
  console.log('พบ ' + rows.length + ' รายการ — รันต่อด้วย applyPriceBackfill() ถ้าโอเค (Forecast Amount รวมจะไม่ถูกแก้ ต้องเช็คเองแยกต่างหาก)');
  _priceBackfillPlan = rows;
  return rows;
}

function applyPriceBackfill() {
  if (!_priceBackfillPlan) { console.warn('⚠️ กรุณารัน previewPriceBackfill() ก่อน'); return; }
  if (!_priceBackfillPlan.length) { console.log('ไม่มีรายการให้แก้'); return; }

  var byPipe = {};
  _priceBackfillPlan.forEach(function(r) { byPipe[r.pipeId] = byPipe[r.pipeId] || []; byPipe[r.pipeId].push(r); });

  var fixedCount = 0;
  Object.keys(byPipe).forEach(function(pipeId) {
    var p = ST.getOne('pipeline', pipeId);
    if (!p || !p.items) return;
    byPipe[pipeId].forEach(function(r) {
      var it = p.items[r.itemIndex];
      if (it) { it.price = r.newPrice; it.total = r.newTotal; fixedCount++; }
    });
    ST.update('pipeline', pipeId, { items: p.items });
  });

  if (typeof syncToFirebase === 'function') syncToFirebase('pipeline', ST.getAll('pipeline'));
  console.log('✅ อัปเดตราคาแล้ว ' + fixedCount + ' รายการ ใน ' + Object.keys(byPipe).length + ' ดีล (Forecast Amount รวมยังไม่เปลี่ยน เช็คเองว่าต้องปรับไหม)');
}
