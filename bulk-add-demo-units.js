// วางใน Browser Console หน้าไหนก็ได้ (ต้องโหลดแอปแล้ว) แล้วกด Enter
// เติมรายชื่อ "Demo Unit" (เมนูราคา) 14 รุ่น ให้ตรงกับที่มีอยู่ใน Demo Equipment
// รันซ้ำได้ปลอดภัย — ข้าม sku ที่มีอยู่แล้ว ไม่สร้างซ้ำ
(function () {
  var models = [
    { productName: 'DJI Matrice 400 (Demo Unit)', sku: 'DJI-6937224120556' },
    { productName: 'DJI Matrice 4T (Demo Unit)', sku: 'DJI-6941565994219' },
    { productName: 'DJI Matrice 4E (Demo Unit)', sku: 'DJI-6941565998095' },
    { productName: 'DJI Matrice 4TD (Demo Unit)', sku: 'DJI-6937224106369' },
    { productName: 'DJI Dock 3 (Demo Unit)', sku: 'DJI-6937224108073' },
    { productName: 'DJI AL1 SpotLight', sku: 'DJI-6937224105829' },
    { productName: 'DJI AS1 Speaker', sku: 'DJI-6937224105812' },
    { productName: 'Zenmuse L3 (Demo Unit)', sku: 'DJI-ZENMUSEL3DEMO' },
    { productName: 'Zenmuse P1 (Demo Unit)', sku: 'DJI-ZENMUSEP1DEMO' },
    { productName: 'Zenmuse S1 (Demo Unit)', sku: 'DJI-ZENMUSES1DEMO' },
    { productName: 'Zenmuse V1 (Demo Unit)', sku: 'DJI-ZENMUSEV1DEMO' },
    { productName: 'Zenmuse H30T (Demo Unit)', sku: 'DJI-ZENMUSEH30TDEM' },
    { productName: 'D-RTK 3 Multifunctional Station (Demo Unit)', sku: 'DJI-6937224104822' },
    { productName: 'D-RTK 3 Survey Pole and Tripod Kit', sku: 'DJI-6937224104808' }
  ];
  var existing = getAllDemoUnits();
  var existingSkus = {};
  existing.forEach(function (d) { if (d.sku) existingSkus[d.sku] = true; });

  var added = 0;
  models.forEach(function (m) {
    if (existingSkus[m.sku]) return;
    addDemoUnit({ productName: m.productName, sku: m.sku, price: 0, note: '', enabled: true });
    added++;
  });
  console.log('เพิ่ม Demo Unit ใหม่ ' + added + ' รายการ (ข้าม ' + (models.length - added) + ' ที่มีอยู่แล้ว)');
  if (typeof render === 'function') render();
})();
