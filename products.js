// ================================================================
// PRODUCTS MANAGEMENT MODULE - COMPLETE & FULL FEATURED
// ================================================================

var PRODUCTS_STORAGE_KEY = 'v7_products';

// ================================================================
// หมวดหมู่สินค้า
// ================================================================

var PRODUCT_CATEGORIES = [
  { id: 'drone', name: '🚁 Drone', icon: '🚁', type: 'main' },
  { id: 'payload', name: '📷 Payload', icon: '📷', type: 'main' },
  { id: 'battery', name: '🔋 Battery', icon: '🔋', type: 'main' },
  { id: 'charger', name: '⚡ Charger/Accessory', icon: '⚡', type: 'main' },
  { id: 'software', name: '💻 Software', icon: '💻', type: 'main' },
  { id: 'service', name: '🛠️ Service', icon: '🛠️', type: 'main' },
  { id: 'bundle', name: '🎁 Bundle', icon: '🎁', type: 'main' },
  { id: 'demo', name: '🚁 Demo Unit', icon: '🎪', type: 'demo' },      // ✅ เพิ่ม Demo
  { id: 'demo_accessory', name: '🔧 Demo Accessory', icon: '🔧', type: 'demo' },  // ✅ เพิ่ม Demo Accessory
  { id: 'other', name: '📦 Other', icon: '📦', type: 'main' }
];

// เช็คว่าเป็นสินค้า Demo หรือไม่
function isDemoProduct(product) {
  if (!product) return false;
  // เช็คจาก category
  if (product.category === 'demo' || product.category === 'demo_accessory') return true;
  // เช็คจากป้าย isDemo
  if (product.isDemo === true) return true;
  // เช็คจากชื่อ
  if (product.name && (product.name.indexOf('(Demo)') !== -1 || product.name.indexOf('Demo Unit') !== -1)) return true;
  return false;
}

// เช็คว่าเป็นสินค้าหลัก (Main Product) หรือไม่
function isMainProduct(product) {
  if (!product) return false;
  if (isDemoProduct(product)) return false;
  // เช็คจาก category
  var mainCategories = ['drone', 'payload', 'battery', 'charger', 'software', 'service', 'bundle', 'other'];
  return mainCategories.indexOf(product.category) !== -1;
}

// ดึงเฉพาะสินค้าหลัก
function getMainProducts() {
  return getAllProducts().filter(isMainProduct);
}

// ดึงเฉพาะสินค้า Demo
function getDemoProducts() {
  return getAllProducts().filter(isDemoProduct);
}
// ================================================================
// CORE DATA MANAGEMENT
// ================================================================

// โค้ดเดิม (มีปัญหา)
function getProductsData() {
  try {
    var saved = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (saved) {
      var parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return { models: parsed, bundles: [], demoUnits: [], lastUpdated: null };
      }
      if (!parsed.models) parsed.models = [];
      if (!parsed.bundles) parsed.bundles = [];
      if (!parsed.demoUnits) parsed.demoUnits = [];
      return parsed;
    }
  } catch(e) {}
  return { models: [], bundles: [], demoUnits: [], lastUpdated: null };
}
// เขียนแค่ localStorage เฉยๆ ไม่ push ขึ้น cloud — ใช้ตอน "รับ" ข้อมูลที่เพิ่ง pull มาจาก cloud เอง
// (ดู loadProductsFromFirebase) ถ้าใช้ saveProductsData ธรรมดาจะ push ข้อมูลที่เพิ่ง pull กลับขึ้นไปทันที
// กลายเป็น echo-push ที่แข่งกับการแก้ไขจริงของผู้ใช้ (เช่น ลบสินค้า) แบบ race condition — ของที่เพิ่งลบ
// อาจถูก echo-push (ซึ่งยังไม่รู้เรื่องการลบ) เขียนทับกลับขึ้น cloud จนวันที่เกิดเหตุมันคือ "ลบแล้ว refresh กลับมา"
function _saveProductsDataLocalOnly(data) {
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(data));
  var cfg = localStorage.getItem('v7_config');
  if (cfg) {
    var config = JSON.parse(cfg);
    config.models = data.models;
    config.bundles = data.bundles;
    if (data.demoUnits) {
      if (!config.demoUnitPrices) config.demoUnitPrices = {};
      config.demoUnitPrices.items = data.demoUnits;
    }
    localStorage.setItem('v7_config', JSON.stringify(config));
  }
}

function saveProductsData(data) {
  _saveProductsDataLocalOnly(data);
  if (typeof db !== 'undefined' && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    syncProductsToFirebase(data);
    publishCatalogToClientView();
  }
}

// ✅ Publish แคตตาล็อก (ชื่อ+หมวด) ไป Firestore ให้ client-view อ่านได้ (ลูกค้าอ่าน localStorage เครื่องเซลล์ไม่ได้)
function publishCatalogToClientView() {
  if (typeof db === 'undefined') return;
  try {
    var src = (typeof getActiveProducts === 'function') ? getActiveProducts() : getAllProducts();
    var models = (src || []).map(function(p) { return { name: p.name, category: p.category || 'other' }; });
    if (!models.length) return;
    db.collection('dealerUpdates').doc('__catalog__').set({
      models: models,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(e) { console.warn('publishCatalog error:', e); });
  } catch(e) { console.warn('publishCatalog error:', e); }
}

function syncProductsToFirebase(data) {
  if (typeof db === 'undefined' || !CURRENT_USER) return;
  // 🛡️ กันข้อมูลจริงบน cloud ถูกลบทับ: sync แบบ "ลบหมดแล้วเขียนใหม่" อันตรายมากถ้าเครื่องนี้
  // ยังไม่เคยดึงข้อมูลจาก cloud สำเร็จ (เช่น เครื่องใหม่ที่มีข้อมูลไม่ครบ) — ห้าม push จนกว่าจะ pull ก่อน
  if (!localStorage.getItem('v7_products_pulled_' + CURRENT_USER.uid)) {
    console.warn('⛔ ข้าม push products ขึ้น cloud — เครื่องนี้ยังไม่เคยดึงข้อมูลสินค้าจาก cloud (กันทับข้อมูลจริง)');
    return;
  }
  var userRef = db.collection('users').doc(CURRENT_USER.uid);
  // ⚠️ Firestore จำกัด batch ละ 500 operations — แคตตาล็อกใหญ่ (ลบเก่า+เขียนใหม่รวมกันหลายร้อยรายการ)
  // ถ้ายัด batch เดียวจะ commit ล้มทั้งก้อนแบบเงียบๆ ทำให้ cloud ค้างเป็นข้อมูลเก่าไม่มีใครรู้ตัว
  // → แบ่ง commit เป็นก้อนละ 400 และแจ้งเตือนดังๆ ถ้าล้ม
  // 🛡️ เดิมลบ-แล้ว-เขียนใหม่ (delete-then-rewrite) เฉพาะ collection 'products' เท่านั้น — 'bundles'/'demoUnits'
  // แค่เขียนทับรายการที่เหลือ ไม่เคยลบ doc ของรายการที่ถูกลบออกจากเครื่องเลย ทำให้ลบ Bundle/Demo Unit แล้ว
  // "ฟื้นคืนชีพ" กลับมาเสมอทุกครั้งที่ pull (พบ 2026-07-19) — ต้อง fetch snapshot ทั้ง 3 collection มาลบให้ครบ
  Promise.all([
    userRef.collection('products').get(),
    userRef.collection('bundles').get(),
    userRef.collection('demoUnits').get()
  ]).then(function(snapshots) {
    var ops = [];
    snapshots[0].forEach(function(doc) { ops.push({ type: 'delete', ref: doc.ref }); });
    snapshots[1].forEach(function(doc) { ops.push({ type: 'delete', ref: doc.ref }); });
    snapshots[2].forEach(function(doc) { ops.push({ type: 'delete', ref: doc.ref }); });
    (data.models || []).forEach(function(p, idx) {
      ops.push({ type: 'set', ref: userRef.collection('products').doc(p.id || ('prod_' + idx)), data: p });
    });
    // 🛡️ doc '_meta' เก็บเวลาบันทึกล่าสุดของ "ทั้งชุด" แยกจาก updatedAt ของสินค้าแต่ละตัว — จำเป็นเพราะการ "ลบ"
    // สินค้าไม่ทิ้งร่องรอย updatedAt ไว้เลย (ตัวที่ถูกลบหายไปจาก data.models ตรงๆ) ถ้าเทียบแค่ updatedAt ของ
    // สินค้าที่เหลือ จะไม่รู้เลยว่าเพิ่งมีการลบเกิดขึ้น ทำให้ pull ครั้งถัดไปเอาของเก่าบน cloud (ที่ยังไม่ถูกลบ)
    // มาทับจนสินค้าที่ลบไปแล้ว "ฟื้นคืนชีพ" ตอน refresh — ดู loadProductsFromFirebase()
    ops.push({ type: 'set', ref: userRef.collection('products').doc('_meta'), data: { lastUpdated: data.lastUpdated || new Date().toISOString() } });
    (data.bundles || []).forEach(function(b) {
      if (b.id) ops.push({ type: 'set', ref: userRef.collection('bundles').doc(b.id), data: b });
    });
    (data.demoUnits || []).forEach(function(d) {
      if (d.id) ops.push({ type: 'set', ref: userRef.collection('demoUnits').doc(d.id), data: d });
    });

    var chunks = [];
    for (var i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
    return chunks.reduce(function(chain, chunk) {
      return chain.then(function() {
        var batch = db.batch();
        chunk.forEach(function(op) {
          if (op.type === 'delete') batch.delete(op.ref);
          else batch.set(op.ref, op.data);
        });
        return batch.commit();
      });
    }, Promise.resolve());
  }).catch(function(e) {
    console.warn('Firebase sync error:', e);
    if (typeof toast === 'function') toast('⚠️ Sync สินค้าขึ้น Cloud ล้มเหลว: ' + e.message);
  });
}

function loadProductsFromFirebase() {
  if (typeof db === 'undefined' || !CURRENT_USER) return Promise.resolve(false);

  var userRef = db.collection('users').doc(CURRENT_USER.uid);
  // ⚠️ เดิมดึงกลับแค่ collection 'products' เท่านั้น — 'bundles'/'demoUnits' push ขึ้น cloud ได้ แต่ไม่เคย
  // ถูกดึงกลับลงมาเลย ทำให้เครื่องใหม่/มือถือ/Incognito ไม่เห็น Bundle หรือ Demo Unit จากเครื่องอื่นเลย
  // (พบ 2026-07-19) ต้องดึงมาทั้ง 3 collection พร้อมกัน
  return Promise.all([
    userRef.collection('products').get(),
    userRef.collection('bundles').get(),
    userRef.collection('demoUnits').get()
  ]).then(function(snapshots) {
    var productSnap = snapshots[0], bundleSnap = snapshots[1], demoSnap = snapshots[2];
    if (productSnap.empty) {
      // cloud ว่าง (บัญชีใหม่/ยังไม่เคย import) → ปลอดภัยที่จะ push จากเครื่องนี้ได้เลย ไม่มีอะไรให้ทับ
      localStorage.setItem('v7_products_pulled_' + CURRENT_USER.uid, '1');
      return false;
    }

    var products = [];
    var cloudMeta = null;
    productSnap.forEach(function(doc) {
      if (doc.id === '_meta') { cloudMeta = doc.data(); return; }
      var data = doc.data();
      // ✅ ป้องกันข้อมูลเสีย
      if (data && !data.id) data.id = doc.id;
      products.push(data);
    });
    var bundles = [];
    bundleSnap.forEach(function(doc) { var b = doc.data(); if (b && !b.id) b.id = doc.id; bundles.push(b); });
    var demoUnits = [];
    demoSnap.forEach(function(doc) { var dm = doc.data(); if (dm && !dm.id) dm.id = doc.id; demoUnits.push(dm); });

    var data = getProductsData();

    // 🛡️ ห้ามเอาข้อมูล cloud ที่ "เก่ากว่า" มาทับของในเครื่อง — เทียบ timestamp ระดับ "ทั้งชุด" (_meta.lastUpdated)
    // ไม่ใช่ updatedAt ของสินค้าแต่ละตัว เพราะการลบสินค้าไม่ทิ้ง updatedAt ไว้ให้เทียบเลย (ดูคอมเมนต์ที่
    // syncProductsToFirebase) ถ้าเครื่องนี้ใหม่กว่า ให้เก็บของเครื่องไว้แล้ว push ขึ้นไปแทน
    var localMax = data.lastUpdated || '';
    var cloudMax = (cloudMeta && cloudMeta.lastUpdated) || '';
    if (data.models && localMax && localMax > cloudMax) {
      console.warn('☁️ ข้อมูลสินค้าในเครื่องใหม่กว่า cloud (' + localMax + ' > ' + cloudMax + ') — เก็บของเครื่องไว้แล้ว push ขึ้น cloud แทน');
      localStorage.setItem('v7_products_pulled_' + CURRENT_USER.uid, '1');
      saveProductsData(data); // push local ที่ใหม่กว่าขึ้นไปทับ cloud เก่า
      return false;
    }

    data.models = products;
    data.bundles = bundles;
    data.demoUnits = demoUnits;
    // ใช้เวลาจาก cloud ตรงๆ (ไม่ใช่ "เดี๋ยวนี้") กัน local ดูใหม่กว่าความเป็นจริงหลัง pull — ถ้า cloud
    // ไม่มี _meta (ไฟล์เก่าก่อนมีระบบนี้) ค่อย fallback เป็นตอนนี้
    data.lastUpdated = cloudMax || new Date().toISOString();
    localStorage.setItem('v7_products_pulled_' + CURRENT_USER.uid, '1');
    _saveProductsDataLocalOnly(data); // เขียนแค่เครื่อง ไม่ push กลับขึ้น cloud (กัน echo-push race)
    return true;
  }).catch(function() { return false; });
}
function ensureProductStructure(p) {
  if (!p) return { name: '', price: 0, rrpInVat: 0, rrpExVat: 0, typePrices: { S:0, A:0, B:0, Other:0 }, category: 'other', eol: false, cost: 0 };
  if (p.rrpInVat === undefined) p.rrpInVat = 0;
  if (p.rrpExVat === undefined) p.rrpExVat = 0;
  if (!p.typePrices) {
    p.typePrices = { S: 0, A: 0, B: p.price || 0, Other: 0 };
  } else {
    if (p.typePrices.S === undefined) p.typePrices.S = 0;
    if (p.typePrices.A === undefined) p.typePrices.A = 0;
    if (p.typePrices.B === undefined) p.typePrices.B = p.price || 0;
    if (p.typePrices.Other === undefined) p.typePrices.Other = 0;
  }
  if (p.price === undefined) p.price = p.typePrices.B;
  if (p.category === undefined) {
    if (p.isSoftware) p.category = 'software';
    else if (p.isService) p.category = 'service';
    else if (p.isBundle) p.category = 'bundle';
    else p.category = 'other';
  }
  if (p.eol === undefined) p.eol = false;
  if (p.cost === undefined) p.cost = 0;
  return p;
}

function ensureProductsStructure() {
  var data = getProductsData();
  if (data.models && data.models.length) {
    var changed = false;
    data.models = data.models.map(function(p) {
      var old = JSON.stringify(p);
      var newP = ensureProductStructure(p);
      if (JSON.stringify(newP) !== old) changed = true;
      return newP;
    });
    if (changed) {
      data.lastUpdated = new Date().toISOString();
      saveProductsData(data);
    }
  }
}

// ================================================================
// CRUD PRODUCTS
// ================================================================

function getAllProducts() {
  var data = getProductsData();
  return data.models || [];
}

function getProductById(id) {
  var products = getAllProducts();
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === id) return products[i];
  }
  return null;
}

function getProductBySku(sku) {
  if (!sku) return null;
  var products = getAllProducts();
  for (var i = 0; i < products.length; i++) {
    if (products[i].sku === sku) return products[i];
  }
  return null;
}

function getProductByEan(ean) {
  if (!ean) return null;
  var products = getAllProducts();
  for (var i = 0; i < products.length; i++) {
    if (products[i].ean === ean) return products[i];
  }
  return null;
}

function getProductByName(name) {
  if (!name) return null;
  var products = getAllProducts();
  for (var i = 0; i < products.length; i++) {
    if (products[i].name === name) return products[i];
  }
  return null;
}

function addProduct(productData) {
  var data = getProductsData();
  if (!data.models) data.models = [];
  var newProduct = {
    id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name: productData.name || '',
    sku: productData.sku || '',
    ean: productData.ean || '',
    rrpInVat: productData.rrpInVat || 0,
    rrpExVat: productData.rrpExVat || 0,
    price: productData.price || 0,
    typePrices: productData.typePrices || { S: 0, A: 0, B: 0, Other: 0 },
    category: productData.category || 'other',
    eol: productData.eol || false,
    isBundle: productData.isBundle || false,
    isSoftware: productData.isSoftware || false,
    isService: productData.isService || false,
    cost: Number(productData.cost) || 0,
    shortName: productData.shortName || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (newProduct.typePrices.B !== newProduct.price) newProduct.typePrices.B = newProduct.price;
  data.models.push(newProduct);
  data.lastUpdated = new Date().toISOString();
  saveProductsData(data);
  return newProduct;
}

function updateProduct(productId, updates) {
  var data = getProductsData();
  if (!data.models) return false;
  for (var i = 0; i < data.models.length; i++) {
    if (data.models[i].id === productId) {
      for (var key in updates) {
        if (!updates.hasOwnProperty(key)) continue;
        if (key === 'typePrices' && typeof updates[key] === 'object') {
          if (!data.models[i].typePrices) data.models[i].typePrices = {};
          for (var level in updates[key]) {
            data.models[i].typePrices[level] = updates[key][level];
          }
        } else {
          data.models[i][key] = updates[key];
        }
      }
      if (data.models[i].typePrices && data.models[i].typePrices.B !== undefined) {
        data.models[i].price = data.models[i].typePrices.B;
      }
      data.models[i].updatedAt = new Date().toISOString();
      data.lastUpdated = new Date().toISOString();
      saveProductsData(data);
      return true;
    }
  }
  return false;
}

function deleteProduct(productId) {
  var data = getProductsData();
  if (!data.models) return false;
  data.models = data.models.filter(function(p) { return p.id !== productId; });
  data.lastUpdated = new Date().toISOString();
  saveProductsData(data);
  return true;
}

// ================================================================
// PRICE & EOL HELPERS
// ================================================================

function getPriceByLevel(productId, level) {
  var p = getProductById(productId);
  if (!p) return 0;
  var map = { S: 'S', A: 'A', B: 'B', Other: 'Other' };
  var target = map[level] || 'B';
  return (p.typePrices && p.typePrices[target] !== undefined) ? p.typePrices[target] : p.price;
}

function updateProductPrice(productId, level, price) {
  var p = getProductById(productId);
  if (!p) return false;
  if (!p.typePrices) p.typePrices = { S: p.price, A: p.price, B: p.price, Other: p.price };
  p.typePrices[level] = price;
  if (level === 'B') p.price = price;
  return updateProduct(productId, { typePrices: p.typePrices, price: p.price });
}

function isProductEOL(productId) {
  var p = getProductById(productId);
  return p ? p.eol === true : false;
}

function setProductEOL(productId, isEOL) {
  return updateProduct(productId, { eol: isEOL });
}

function getActiveProducts() {
  return getAllProducts().filter(function(p) { return !p.eol; });
}

function getEOLProducts() {
  return getAllProducts().filter(function(p) { return p.eol; });
}

// ================================================================
// ฟังก์ชันดึงราคาสำหรับระบบ (แยกตามการใช้งาน)
// ================================================================

// ฟังก์ชันสำหรับ Pipeline และทั่วไป: ดึง RRP Ex Vat (ราคาขายปลีกไม่รวม VAT)
window.getModelPrice = function(modelName) {
  var p = getProductByName(modelName);
  if (!p) return 0;
  // ลำดับ: RRP Ex Vat > ราคา B (Type 3) > 0
  return p.rrpExVat || p.price || 0;
};

// ฟังก์ชันสำหรับดึงราคาตาม Level Dealer (S/A/B/Other)
window.getModelPriceByLevel = function(modelName, level) {
  var p = getProductByName(modelName);
  if (!p) return 0;
  var levelMap = { 'S': 'S', 'A': 'A', 'B': 'B', 'Other': 'Other' };
  var target = levelMap[level] || 'B';
  return (p.typePrices && p.typePrices[target] !== undefined) ? p.typePrices[target] : (p.rrpExVat || p.price || 0);
};

// หาสินค้าจาก model group (m3m/m4t/m4e/dock3/m4td/m400) ด้วย pattern เดียวกับ _pipeModelQtyByGroup
window.getProductForModelGroup = function(group) {
  var products = getAllProducts();
  var specs = {
    m3m:   { inc: ['M3M', 'MULTISPECTRAL'], exc: [] },
    m4td:  { inc: ['M4TD'],                 exc: [] },
    m4t:   { inc: ['M4T'],                  exc: ['M4TD', 'M4TE'] },
    m4e:   { inc: ['M4E'],                  exc: [] },
    m400:  { inc: ['M400'],                 exc: [] },
    dock3: { inc: ['DOCK 3', 'DOCK3'],      exc: [] }
  };
  var spec = specs[group];
  if (!spec) return null;
  for (var i = 0; i < products.length; i++) {
    var name = (products[i].name || '').toUpperCase();
    var match = spec.inc.some(function(p) { return name.indexOf(p) !== -1; });
    var excl  = spec.exc.some(function(e) { return name.indexOf(e) !== -1; });
    if (match && !excl) return products[i];
  }
  return null;
};

// ฟังก์ชันดึงราคา RRP Ex Vat โดยตรง
window.getModelRrpExVat = function(modelName) {
  var p = getProductByName(modelName);
  return p ? (p.rrpExVat || 0) : 0;
};

// ฟังก์ชันดึงราคา RRP In Vat โดยตรง
window.getModelRrpInVat = function(modelName) {
  var p = getProductByName(modelName);
  return p ? (p.rrpInVat || 0) : 0;
};

// ================================================================
// MODEL OPTIONS FOR DROPDOWN (แสดง RRP Ex Vat)
// ================================================================

window.modelOptionsNew = function(selected, showEOLBadge) {
  var products = getAllProducts();
  var html = '<option value="">-- เลือก Model --</option>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var label = p.name;
    // แสดง RRP Ex Vat (หรือราคา B ถ้าไม่มี)
    var displayPrice = p.rrpExVat || p.price;
    if (displayPrice > 0) label += ' (฿' + fmtMoney(displayPrice) + ')';
    if (showEOLBadge && p.eol) label += ' ⏰ EOL';
    if (p.isBundle) label += ' 🎁';
    html += '<option value="' + sanitize(p.name) + '"' + (selected === p.name ? ' selected' : '') + '>' + sanitize(label) + '</option>';
  }
  return html;
};

// ================================================================
// MODAL แก้ไขสินค้า (ครบทุกฟิลด์)
// ================================================================

function showEditProductModal(productId) {
  var p = getProductById(productId);
  if (!p) { toast('ไม่พบสินค้า'); return; }
  
  var categoryOptions = '';
  for (var i = 0; i < PRODUCT_CATEGORIES.length; i++) {
    var cat = PRODUCT_CATEGORIES[i];
    categoryOptions += '<option value="' + cat.id + '"' + (p.category === cat.id ? ' selected' : '') + '>' + cat.name + '</option>';
  }
  
  var html = '<div style="max-width:600px">';
  html += '<div class="form-section">📋 ข้อมูลทั่วไป</div>';
  html += '<div class="fg"><label>ชื่อสินค้า *</label><input type="text" id="edit_name" class="fm-input" value="' + sanitize(p.name) + '"></div>';
  html += '<div class="fg"><label>ชื่อย่อ (ใช้แสดงในการ์ด Pipeline แทนชื่อเต็ม — เว้นว่างได้)</label><input type="text" id="edit_short_name" class="fm-input" value="' + sanitize(p.shortName || '') + '"></div>';
  html += '<div class="fr"><div class="fg"><label>SKU (SiS part)</label><input type="text" id="edit_sku" class="fm-input" value="' + sanitize(p.sku || '') + '"></div>';
  html += '<div class="fg"><label>EAN</label><input type="text" id="edit_ean" class="fm-input" value="' + sanitize(p.ean || '') + '"></div></div>';
  
  html += '<div class="form-section">💰 ราคา</div>';
  html += '<div class="fr"><div class="fg"><label>RRP in Vat (฿)</label><input type="text" inputmode="decimal" id="edit_rrp_in" class="fm-input js-money" value="' + nmI(p.rrpInVat || 0) + '"></div>';
  html += '<div class="fg"><label>RRP Ex Vat (฿)</label><input type="text" inputmode="decimal" id="edit_rrp_ex" class="fm-input js-money" value="' + nmI(p.rrpExVat || 0) + '"></div></div>';
  html += '<div class="fr4">';
  html += '<div class="fg"><label>S (Type 1)</label><input type="text" inputmode="decimal" id="edit_price_s" class="fm-input js-money" value="' + nmI(p.typePrices?.S || 0) + '"></div>';
  html += '<div class="fg"><label>A (Type 2)</label><input type="text" inputmode="decimal" id="edit_price_a" class="fm-input js-money" value="' + nmI(p.typePrices?.A || 0) + '"></div>';
  html += '<div class="fg"><label>B (Type 3)</label><input type="text" inputmode="decimal" id="edit_price_b" class="fm-input js-money" value="' + nmI(p.price || 0) + '"></div>';
  html += '<div class="fg"><label>Other (Type 4)</label><input type="text" inputmode="decimal" id="edit_price_o" class="fm-input js-money" value="' + nmI(p.typePrices?.Other || 0) + '"></div></div>';
  
  html += '<div class="form-section">💸 ต้นทุน</div>';
  html += '<div class="fr"><div class="fg"><label>ต้นทุนสินค้า (฿)</label><input type="text" inputmode="decimal" id="edit_cost" class="fm-input js-money" value="' + nmI(p.cost || 0) + '"></div><div class="fg"></div></div>';

  html += '<div class="form-section">🏷️ หมวดหมู่และสถานะ</div>';
  html += '<div class="fr"><div class="fg"><label>หมวดหมู่</label><select id="edit_category" class="fm-input">' + categoryOptions + '</select></div>';
  html += '<div class="fg"><label>⚡ สถานะ EOL</label><div class="radio-g"><label><input type="radio" name="edit_eol" value="1"' + (p.eol ? ' checked' : '') + '><span>⏰ EOL (หมดอายุ)</span></label><label><input type="radio" name="edit_eol" value="0"' + (!p.eol ? ' checked' : '') + '><span>✅ ปกติ</span></label></div></div></div>';
  
  html += '<div class="form-section">🔧 ประเภทสินค้า (สำหรับระบบ)</div>';
  html += '<div class="fr">';
  html += '<div class="fg"><label><input type="checkbox" id="edit_is_bundle"' + (p.isBundle ? ' checked' : '') + '> 🎁 Bundle/Combo</label></div>';
  html += '<div class="fg"><label><input type="checkbox" id="edit_is_software"' + (p.isSoftware ? ' checked' : '') + '> 💻 Software</label></div>';
  html += '<div class="fg"><label><input type="checkbox" id="edit_is_service"' + (p.isService ? ' checked' : '') + '> 🛠️ Service</label></div>';
  html += '</div>';
  
  html += '<div class="form-section">🖼️ รูปภาพสินค้า</div>';
  html += '<div class="fg"><label>URL รูปภาพ (Direct link)</label><input type="url" id="edit_image_url" class="fm-input" value="' + sanitize(p.imageUrl || '') + '" placeholder="https://..."></div>';
  if (p.imageUrl) html += '<div class="fg" style="margin-top:4px"><img src="' + sanitize(p.imageUrl) + '" style="max-height:80px;border-radius:6px;border:1px solid var(--border)" onerror="this.style.display=\'none\'"></div>';
  html += '<div class="fm-actions" style="margin-top:16px">';
  html += '<button class="btn btn-blue" onclick="saveProductEdit(\'' + p.id + '\')">💾 บันทึก</button>';
  html += '<button class="btn bd" onclick="deleteProductConfirm(\'' + p.id + '\')">🗑️ ลบสินค้า</button>';
  html += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  html += '</div></div>';

  openM('✏️ แก้ไขสินค้า: ' + sanitize(p.name), html);
}

function deleteProductConfirm(productId) {
  var p = getProductById(productId);
  if (!p) return;
  if (!confirm('🗑️ ลบสินค้า "' + p.name + '" ถาวร?\nถ้าสินค้านี้ถูกใช้อ้างอิงในที่อื่น (เช่น Demo Unit, Pipeline) ข้อมูลเดิมจะยังอยู่แต่จะไม่เชื่อมกับสินค้านี้อีก')) return;
  deleteProduct(productId);
  closeMForce();
  toast('🗑️ ลบสินค้าแล้ว');
  render();
}

function saveProductEdit(productId) {
  var name = document.getElementById('edit_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  
  var updates = {
    name: name,
    shortName: document.getElementById('edit_short_name').value.trim(),
    sku: document.getElementById('edit_sku').value.trim(),
    ean: document.getElementById('edit_ean').value.trim(),
    rrpInVat: parseNum(document.getElementById('edit_rrp_in').value),
    rrpExVat: parseNum(document.getElementById('edit_rrp_ex').value),
    category: document.getElementById('edit_category').value,
    eol: document.querySelector('input[name="edit_eol"]:checked') ? document.querySelector('input[name="edit_eol"]:checked').value === '1' : false,
    isBundle: document.getElementById('edit_is_bundle').checked,
    isSoftware: document.getElementById('edit_is_software').checked,
    isService: document.getElementById('edit_is_service').checked,
    imageUrl: (document.getElementById('edit_image_url') ? document.getElementById('edit_image_url').value.trim() : '') || '',
    price: parseNum(document.getElementById('edit_price_b').value),
    typePrices: {
      S: parseNum(document.getElementById('edit_price_s').value),
      A: parseNum(document.getElementById('edit_price_a').value),
      B: parseNum(document.getElementById('edit_price_b').value),
      Other: parseNum(document.getElementById('edit_price_o').value)
    },
    cost: parseNum(document.getElementById('edit_cost').value)
  };
  
  updateProduct(productId, updates);
  closeMForce();
  toast('💾 บันทึกสินค้าเรียบร้อย');
  render();
}

function showImportCostM() {
  var html = '<div style="max-width:480px">';
  html += '<div class="hint" style="margin-bottom:12px">วางข้อมูล 2 คอลัมน์จาก Excel: <b>SKU</b> | <b>ต้นทุน (฿)</b><br>ระบบจะ UPSERT ต้นทุนตาม SKU โดยไม่แตะราคาอื่น</div>';
  html += '<textarea id="costImportTa" class="fm-input" rows="10" placeholder="SKU&#9;ต้นทุน&#10;DRONE-001&#9;150000&#10;..."></textarea>';
  html += '<div class="fm-actions" style="margin-top:12px"><button class="btn bp" onclick="doImportCost()">📥 นำเข้า</button><button class="btn" onclick="closeM()">ยกเลิก</button></div>';
  html += '</div>';
  openM('💸 นำเข้าต้นทุนสินค้า', html);
}

// preview ก่อนนำเข้าต้นทุน — เห็นว่าแถวไหนจะเปลี่ยน/เท่าเดิม/ไม่เจอ SKU ก่อนกดยืนยัน (แบบเดียวกับ import pipeline)
var _costImportMeta = null;

function doImportCost() {
  var raw = (document.getElementById('costImportTa').value || '').trim();
  if (!raw) { toast('ไม่มีข้อมูล'); return; }
  var meta = [];
  raw.split('\n').forEach(function(line) {
    var parts = line.split('\t');
    var sku = (parts[0] || '').trim();
    var cost = parseFloat((parts[1] || '').replace(/,/g, '')) || 0;
    if (!sku || !cost) return; // แถวว่าง/หัวตาราง
    var prod = getProductBySku(sku);
    var state = !prod ? 'notfound' : (Math.abs((Number(prod.cost) || 0) - cost) < 0.001 ? 'same' : 'update');
    meta.push({ sku: sku, cost: cost, prod: prod, state: state });
  });
  if (!meta.length) { toast('⚠️ ไม่พบข้อมูลที่อ่านได้ (ต้องเป็น SKU แท็บ ต้นทุน)'); return; }
  _costImportMeta = meta;

  var cnt = { update: 0, same: 0, notfound: 0 };
  meta.forEach(function(m) { cnt[m.state]++; });

  var h = '<div style="max-width:560px">';
  h += '<div style="font-size:.85rem;margin-bottom:8px">พบ <b>' + meta.length + ' แถว</b> — ';
  if (cnt.update)   h += '<span style="color:#f59e0b;font-weight:700">✏️ จะอัปเดต ' + cnt.update + '</span> ';
  if (cnt.same)     h += '<span style="color:var(--text2);font-weight:700">⏭ เท่าเดิม ' + cnt.same + '</span> ';
  if (cnt.notfound) h += '<span style="color:#ef4444;font-weight:700">❌ ไม่เจอ SKU ' + cnt.notfound + '</span>';
  h += '</div>';
  if (cnt.update) {
    h += '<div style="font-size:11px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:5px 10px;margin-bottom:8px;display:flex;align-items:center;gap:8px">';
    h += '<span style="color:var(--text2)">ปรับทั้งหมด:</span>';
    h += '<button class="btn bsm bo" onclick="_costImportToggleAll(true)">✔ ติ๊กที่จะอัปเดตทั้งหมด</button>';
    h += '<button class="btn bsm bo" onclick="_costImportToggleAll(false)">✕ ไม่ติ๊กเลย</button>';
    h += '</div>';
  }
  h += '<div style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg2)">';
  h += '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="position:sticky;top:0;background:var(--bg2)">' +
    '<th style="padding:4px 8px;text-align:center;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border)"></th>' +
    '<th style="padding:4px 8px;text-align:center;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border)">สถานะ</th>' +
    '<th style="padding:4px 8px;text-align:left;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border)">SKU / สินค้า</th>' +
    '<th style="padding:4px 8px;text-align:right;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border)">ต้นทุนเดิม</th>' +
    '<th style="padding:4px 8px;text-align:right;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border)">ต้นทุนใหม่</th></tr></thead><tbody>';
  meta.forEach(function(m, i) {
    var badge = m.state === 'update' ? '<span style="color:#f59e0b;font-size:10px;font-weight:700">✏️ เปลี่ยน</span>'
      : m.state === 'same' ? '<span style="color:var(--text2);font-size:10px;font-weight:700">⏭ เดิม</span>'
      : '<span style="color:#ef4444;font-size:10px;font-weight:700">❌ ไม่เจอ</span>';
    h += '<tr style="border-bottom:1px solid var(--border)">' +
      '<td style="padding:3px 8px;text-align:center">' + (m.state === 'update' ? '<input type="checkbox" id="costImpChk_' + i + '" checked>' : '') + '</td>' +
      '<td style="padding:3px 8px;text-align:center;white-space:nowrap">' + badge + '</td>' +
      '<td style="padding:3px 8px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(m.sku) + (m.prod ? '<div style="font-size:10px;color:var(--text2);overflow:hidden;text-overflow:ellipsis">' + sanitize(m.prod.name) + '</div>' : '') + '</td>' +
      '<td style="padding:3px 8px;text-align:right;color:' + (m.state === 'update' ? '#ef4444' : 'var(--text2)') + '">' + (m.prod ? fmtMoney(Number(m.prod.cost) || 0) : '-') + '</td>' +
      '<td style="padding:3px 8px;text-align:right;color:' + (m.state === 'update' ? '#22c55e' : 'var(--text2)') + '">' + fmtMoney(m.cost) + '</td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<div class="fm-actions" style="margin-top:12px">' +
    '<button class="btn bp" ' + (cnt.update ? '' : 'disabled ') + 'onclick="applyImportCost()">✔ ยืนยันนำเข้า (' + cnt.update + ' รายการ)</button>' +
    '<button class="btn" onclick="showImportCostM()">← กลับไปแก้</button></div></div>';
  openM('💸 ตรวจสอบก่อนนำเข้าต้นทุน', h);
}

function _costImportToggleAll(checked) {
  if (!_costImportMeta) return;
  _costImportMeta.forEach(function(m, i) {
    if (m.state !== 'update') return;
    var el = document.getElementById('costImpChk_' + i);
    if (el) el.checked = checked;
  });
}

function applyImportCost() {
  if (!_costImportMeta) return;
  var updated = 0;
  _costImportMeta.forEach(function(m, i) {
    if (m.state !== 'update' || !m.prod) return;
    var chk = document.getElementById('costImpChk_' + i);
    if (chk && !chk.checked) return;
    updateProduct(m.prod.id, { cost: m.cost, updatedAt: new Date().toISOString() });
    updated++;
  });
  _costImportMeta = null;
  closeMForce();
  toast('💸 อัปเดตต้นทุน ' + updated + ' รายการ');
  render();
}

// ================================================================
// BUNDLE MANAGEMENT
// ================================================================

function getAllBundles() {
  var data = getProductsData();
  return data.bundles || [];
}

function getBundleById(id) {
  var bundles = getAllBundles();
  for (var i = 0; i < bundles.length; i++) {
    if (bundles[i].id === id) return bundles[i];
  }
  return null;
}

function getBundleByName(name) {
  var bundles = getAllBundles();
  for (var i = 0; i < bundles.length; i++) {
    if (bundles[i].name === name) return bundles[i];
  }
  return null;
}

function addBundle(bundleData) {
  var data = getProductsData();
  if (!data.bundles) data.bundles = [];
  var newBundle = {
    id: 'bundle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name: bundleData.name || '',
    description: bundleData.description || '',
    items: bundleData.items || [],
    typePrices: bundleData.typePrices || { S: 0, A: 0, B: 0, Other: 0 },
    enabled: bundleData.enabled !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.bundles.push(newBundle);
  data.lastUpdated = new Date().toISOString();
  saveProductsData(data);
  return newBundle;
}

function updateBundle(bundleId, updates) {
  var data = getProductsData();
  if (!data.bundles) return false;
  for (var i = 0; i < data.bundles.length; i++) {
    if (data.bundles[i].id === bundleId) {
      for (var key in updates) {
        if (updates.hasOwnProperty(key)) data.bundles[i][key] = updates[key];
      }
      data.bundles[i].updatedAt = new Date().toISOString();
      data.lastUpdated = new Date().toISOString();
      saveProductsData(data);
      return true;
    }
  }
  return false;
}

function deleteBundle(bundleId) {
  var data = getProductsData();
  if (!data.bundles) return false;
  data.bundles = data.bundles.filter(function(b) { return b.id !== bundleId; });
  data.lastUpdated = new Date().toISOString();
  saveProductsData(data);
  return true;
}

function getActiveBundles() {
  return getAllBundles().filter(function(b) { return b.enabled; });
}

// ================================================================
// DEMO UNIT MANAGEMENT
// ================================================================

function getAllDemoUnits() {
  var data = getProductsData();
  return data.demoUnits || [];
}

function getDemoUnitById(id) {
  var demos = getAllDemoUnits();
  for (var i = 0; i < demos.length; i++) {
    if (demos[i].id === id) return demos[i];
  }
  return null;
}

function getDemoUnitByProductId(productId) {
  var demos = getAllDemoUnits();
  for (var i = 0; i < demos.length; i++) {
    if (demos[i].productId === productId) return demos[i];
  }
  return null;
}

function getDemoUnitPrice(productId) {
  var demo = getDemoUnitByProductId(productId);
  return demo ? demo.price : null;
}

function addDemoUnit(demoData) {
  var data = getProductsData();
  if (!data.demoUnits) data.demoUnits = [];
  var newDemo = {
    id: 'demo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    productId: demoData.productId || '',
    productName: demoData.productName || '',
    sku: demoData.sku || '',
    ean: demoData.ean || '',
    price: demoData.price || 0,
    note: demoData.note || '',
    enabled: demoData.enabled !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.demoUnits.push(newDemo);
  data.lastUpdated = new Date().toISOString();
  saveProductsData(data);
  return newDemo;
}

function updateDemoUnit(demoId, updates) {
  var data = getProductsData();
  if (!data.demoUnits) return false;
  for (var i = 0; i < data.demoUnits.length; i++) {
    if (data.demoUnits[i].id === demoId) {
      for (var key in updates) {
        if (updates.hasOwnProperty(key)) data.demoUnits[i][key] = updates[key];
      }
      data.demoUnits[i].updatedAt = new Date().toISOString();
      data.lastUpdated = new Date().toISOString();
      saveProductsData(data);
      return true;
    }
  }
  return false;
}

function deleteDemoUnit(demoId) {
  var data = getProductsData();
  if (!data.demoUnits) return false;
  data.demoUnits = data.demoUnits.filter(function(d) { return d.id !== demoId; });
  data.lastUpdated = new Date().toISOString();
  saveProductsData(data);
  return true;
}

// ================================================================
// IMPORT FROM EXCEL (ใช้ column index ตามไฟล์ที่ให้)
// ================================================================

function importProductsFromSheet(worksheet) {
  // แปลง sheet เป็น JSON array
  var rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rows || rows.length < 2) {
    console.warn('No data rows found');
    return { imported: 0, updated: 0, errors: 0 };
  }

  // อ่าน header row เพื่อหาตำแหน่ง column
  var headers = rows[0] || [];
  var colIndex = {
    sku: -1,
    ean: -1,
    name: -1,
    rrpInVat: -1,
    rrpExVat: -1,
    priceS: -1,
    priceA: -1,
    priceB: -1,
    priceOther: -1
  };
  
  // หา column index (รองรับทั้งภาษาไทยและอังกฤษ)
  for (var i = 0; i < headers.length; i++) {
    var h = (headers[i] || '').toString().toLowerCase().trim();
    if (h.indexOf('sis') !== -1 || h.indexOf('part') !== -1 || h === 'sku') colIndex.sku = i;
    else if (h === 'ean' || h.indexOf('ean') !== -1) colIndex.ean = i;
    else if (h.indexOf('product') !== -1 || h.indexOf('name') !== -1) colIndex.name = i;
    else if (h.indexOf('rrp in vat') !== -1) colIndex.rrpInVat = i;
    else if (h.indexOf('rrp ex vat') !== -1) colIndex.rrpExVat = i;
    else if (h.indexOf('type 1') !== -1 || h.indexOf('type1') !== -1) colIndex.priceS = i;
    else if (h.indexOf('type 2') !== -1 || h.indexOf('type2') !== -1) colIndex.priceA = i;
    else if (h.indexOf('type 3') !== -1 || h.indexOf('type3') !== -1) colIndex.priceB = i;
    else if (h.indexOf('type 4') !== -1 || h.indexOf('type4') !== -1) colIndex.priceOther = i;
  }
  
  // ถ้าหาไม่เจอ ให้ใช้ลำดับ default (ตามไฟล์ Excel ที่ให้มา)
  if (colIndex.sku === -1) colIndex.sku = 0;
  if (colIndex.ean === -1) colIndex.ean = 1;
  if (colIndex.name === -1) colIndex.name = 2;
  if (colIndex.rrpInVat === -1) colIndex.rrpInVat = 3;
  if (colIndex.rrpExVat === -1) colIndex.rrpExVat = 4;
  if (colIndex.priceS === -1) colIndex.priceS = 5;
  if (colIndex.priceA === -1) colIndex.priceA = 6;
  if (colIndex.priceB === -1) colIndex.priceB = 7;
  if (colIndex.priceOther === -1) colIndex.priceOther = 8;
  
  console.log('📋 Column mapping:', colIndex);
  console.log('📊 Found', (rows.length - 1), 'data rows');
  
  var imported = 0, updated = 0, errors = 0;
  var existingProducts = getAllProducts();
  var existingMap = {};
  
  // สร้าง map สำหรับตรวจสอบซ้ำ (ใช้ sku, ean, name)
  for (var i = 0; i < existingProducts.length; i++) {
    var p = existingProducts[i];
    if (p && p.sku) existingMap['sku_' + p.sku] = p;
    if (p && p.ean) existingMap['ean_' + p.ean] = p;
    if (p && p.name) existingMap['name_' + p.name] = p;
  }
  
  for (var i = 1; i < rows.length; i++) {
    try {
      var row = rows[i];
      if (!row || row.length < 3) {
        errors++;
        continue;
      }
      
      var sku = (row[colIndex.sku] !== undefined && row[colIndex.sku] !== null) ? row[colIndex.sku].toString().trim() : '';
      var ean = (row[colIndex.ean] !== undefined && row[colIndex.ean] !== null) ? row[colIndex.ean].toString().trim() : '';
      var name = (row[colIndex.name] !== undefined && row[colIndex.name] !== null) ? row[colIndex.name].toString().trim() : '';
      
      // ข้ามแถวที่ไม่มีชื่อสินค้า
      if (!name || name === '') {
        errors++;
        continue;
      }
      
      // อ่านราคา (จัดการค่าว่าง)
      var rrpInVat = parseFloat(row[colIndex.rrpInVat]) || 0;
      var rrpExVat = parseFloat(row[colIndex.rrpExVat]) || 0;
      var priceS = parseFloat(row[colIndex.priceS]) || 0;
      var priceA = parseFloat(row[colIndex.priceA]) || 0;
      var priceB = parseFloat(row[colIndex.priceB]) || 0;
      var priceOther = parseFloat(row[colIndex.priceOther]) || 0;
      
      // ถ้า priceB เป็น 0 แต่มี rrpExVat ให้ใช้ rrpExVat แทน
      if (priceB === 0 && rrpExVat > 0) priceB = rrpExVat;
      
      // ตรวจสอบว่ามีสินค้านี้อยู่แล้วหรือไม่
      var existing = null;
      if (sku && existingMap['sku_' + sku]) existing = existingMap['sku_' + sku];
      else if (ean && existingMap['ean_' + ean]) existing = existingMap['ean_' + ean];
      else if (existingMap['name_' + name]) existing = existingMap['name_' + name];
      
      // กำหนดหมวดหมู่อัตโนมัติ
      var category = 'other';
      var nameLower = name.toLowerCase();
      if (nameLower.indexOf('matrice') !== -1 || nameLower.indexOf('mavic') !== -1) category = 'drone';
      else if (nameLower.indexOf('zenmuse') !== -1) category = 'payload';
      else if (nameLower.indexOf('battery') !== -1) category = 'battery';
      else if (nameLower.indexOf('charger') !== -1 || nameLower.indexOf('adapter') !== -1 || nameLower.indexOf('propeller') !== -1) category = 'charger';
      else if (nameLower.indexOf('flighthub') !== -1 || nameLower.indexOf('terra') !== -1) category = 'software';
      else if (nameLower.indexOf('service') !== -1 || nameLower.indexOf('staffing') !== -1) category = 'service';
      else if (nameLower.indexOf('dock') !== -1) category = 'bundle';
      
      var productData = {
        name: name,
        sku: sku,
        ean: ean,
        rrpInVat: rrpInVat,
        rrpExVat: rrpExVat,
        price: priceB,
        typePrices: { S: priceS, A: priceA, B: priceB, Other: priceOther },
        category: category,
        eol: false,
        updatedAt: new Date().toISOString()
      };
      
      if (existing) {
        // อัพเดทข้อมูลเดิม (เก็บ id เดิม)
        updateProduct(existing.id, productData);
        updated++;
        if (updated % 50 === 0) console.log('🔄 อัพเดทไปแล้ว', updated, 'รายการ');
      } else {
        // เพิ่มใหม่
        productData.createdAt = new Date().toISOString();
        addProduct(productData);
        imported++;
        if (imported % 50 === 0) console.log('✅ เพิ่มไปแล้ว', imported, 'รายการ');
      }
      
    } catch(e) {
      errors++;
      console.warn('Row', i, 'error:', e);
    }
  }
  
  console.log(`📊 Import products: +${imported}, updated ${updated}, errors ${errors}`);
  return { imported: imported, updated: updated, errors: errors };
}

// ================================================================
// PRODUCT PRICE IMPORT — PREVIEW ก่อนนำเข้า (แบบเดียวกับ Pipeline import)
// ================================================================
var _prodImportPending = null; // { meta: [...], workbook }
var _prodImportDetailIdx = 0;

// parse ชีต 'single' เป็น array ของ { parsed, existing, state, diff } — ไม่เขียนข้อมูลใดๆ (pure)
function _prodParseSingleSheet(worksheet) {
  var rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rows || rows.length < 2) return [];
  var headers = rows[0] || [];
  var colIndex = { sku: -1, ean: -1, name: -1, rrpInVat: -1, rrpExVat: -1, priceS: -1, priceA: -1, priceB: -1, priceOther: -1, cost: -1 };
  for (var i = 0; i < headers.length; i++) {
    var h = (headers[i] || '').toString().toLowerCase().trim();
    if (h.indexOf('sis') !== -1 || h.indexOf('part') !== -1 || h === 'sku') colIndex.sku = i;
    else if (h === 'ean' || h.indexOf('ean') !== -1) colIndex.ean = i;
    else if (h.indexOf('product') !== -1 || h.indexOf('name') !== -1) colIndex.name = i;
    else if (h.indexOf('rrp in vat') !== -1) colIndex.rrpInVat = i;
    else if (h.indexOf('rrp ex vat') !== -1) colIndex.rrpExVat = i;
    else if (h.indexOf('type 1') !== -1 || h.indexOf('type1') !== -1) colIndex.priceS = i;
    else if (h.indexOf('type 2') !== -1 || h.indexOf('type2') !== -1) colIndex.priceA = i;
    else if (h.indexOf('type 3') !== -1 || h.indexOf('type3') !== -1) colIndex.priceB = i;
    else if (h.indexOf('type 4') !== -1 || h.indexOf('type4') !== -1) colIndex.priceOther = i;
    else if (h === 'cost' || h.indexOf('ต้นทุน') !== -1) colIndex.cost = i;
  }
  if (colIndex.sku === -1) colIndex.sku = 0;
  if (colIndex.ean === -1) colIndex.ean = 1;
  if (colIndex.name === -1) colIndex.name = 2;
  if (colIndex.rrpInVat === -1) colIndex.rrpInVat = 3;
  if (colIndex.rrpExVat === -1) colIndex.rrpExVat = 4;
  if (colIndex.priceS === -1) colIndex.priceS = 5;
  if (colIndex.priceA === -1) colIndex.priceA = 6;
  if (colIndex.priceB === -1) colIndex.priceB = 7;
  if (colIndex.priceOther === -1) colIndex.priceOther = 8;

  var existingProducts = getAllProducts();
  var existingMap = {};
  existingProducts.forEach(function(p) {
    if (p && p.sku) existingMap['sku_' + p.sku] = p;
    if (p && p.ean) existingMap['ean_' + p.ean] = p;
    if (p && p.name) existingMap['name_' + p.name] = p;
  });

  var out = [];
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row || row.length < 3) continue;
    var sku = (row[colIndex.sku] != null) ? row[colIndex.sku].toString().trim() : '';
    var ean = (row[colIndex.ean] != null) ? row[colIndex.ean].toString().trim() : '';
    var name = (row[colIndex.name] != null) ? row[colIndex.name].toString().trim() : '';
    if (!name) continue;

    var rrpInVat = parseFloat(row[colIndex.rrpInVat]) || 0;
    var rrpExVat = parseFloat(row[colIndex.rrpExVat]) || 0;
    var priceS = parseFloat(row[colIndex.priceS]) || 0;
    var priceA = parseFloat(row[colIndex.priceA]) || 0;
    var priceB = parseFloat(row[colIndex.priceB]) || 0;
    var priceOther = parseFloat(row[colIndex.priceOther]) || 0;
    if (priceB === 0 && rrpExVat > 0) priceB = rrpExVat;

    var existing = null;
    if (sku && existingMap['sku_' + sku]) existing = existingMap['sku_' + sku];
    else if (ean && existingMap['ean_' + ean]) existing = existingMap['ean_' + ean];
    else if (existingMap['name_' + name]) existing = existingMap['name_' + name];

    var category = 'other';
    var nameLower = name.toLowerCase();
    if (nameLower.indexOf('matrice') !== -1 || nameLower.indexOf('mavic') !== -1) category = 'drone';
    else if (nameLower.indexOf('zenmuse') !== -1) category = 'payload';
    else if (nameLower.indexOf('battery') !== -1) category = 'battery';
    else if (nameLower.indexOf('charger') !== -1 || nameLower.indexOf('adapter') !== -1 || nameLower.indexOf('propeller') !== -1) category = 'charger';
    else if (nameLower.indexOf('flighthub') !== -1 || nameLower.indexOf('terra') !== -1) category = 'software';
    else if (nameLower.indexOf('service') !== -1 || nameLower.indexOf('staffing') !== -1) category = 'service';
    else if (nameLower.indexOf('dock') !== -1) category = 'bundle';

    // cost เป็น optional — มีเฉพาะไฟล์ export รุ่นใหม่; ถ้าไฟล์ไม่มีคอลัมน์ cost ให้เป็น null (จะไม่ไปแตะ cost เดิม)
    var cost = colIndex.cost >= 0 ? (parseFloat(row[colIndex.cost]) || 0) : null;
    var parsed = { sku: sku, ean: ean, name: name, rrpInVat: rrpInVat, rrpExVat: rrpExVat, priceS: priceS, priceA: priceA, priceB: priceB, priceOther: priceOther, category: category, cost: cost, shortName: null };

    var diff = [];
    var state = 'new';
    if (existing) {
      var cmp = [
        { l: 'ชื่อสินค้า', ov: existing.name || '', nv: name, isNum: false },
        { l: 'RRP in VAT', ov: Number(existing.rrpInVat) || 0, nv: rrpInVat, isNum: true },
        { l: 'RRP ex VAT', ov: Number(existing.rrpExVat) || 0, nv: rrpExVat, isNum: true },
        { l: 'Type 1 (S)', ov: Number(existing.typePrices && existing.typePrices.S) || 0, nv: priceS, isNum: true },
        { l: 'Type 2 (A)', ov: Number(existing.typePrices && existing.typePrices.A) || 0, nv: priceA, isNum: true },
        { l: 'Type 3 (B)', ov: Number(existing.typePrices && existing.typePrices.B) || 0, nv: priceB, isNum: true },
        { l: 'Type 4 (Other)', ov: Number(existing.typePrices && existing.typePrices.Other) || 0, nv: priceOther, isNum: true }
      ];
      cmp.forEach(function(f) {
        var changed = f.isNum ? Math.abs(f.ov - f.nv) > 0.001 : (f.ov !== f.nv);
        if (changed) diff.push({ label: f.l, old: f.isNum ? fmtMoney(f.ov) : f.ov, newVal: f.isNum ? fmtMoney(f.nv) : f.nv });
      });
      state = diff.length ? 'changed' : 'same';
    }

    out.push({ parsed: parsed, existing: existing, state: state, diff: diff });
  }
  return out;
}

// อ่านชีต 'cost' แยกต่างหาก (SiS part | EAN | Product Name | Cost) แล้วผสานเข้า meta ที่ parse จากชีต 'single'
// แล้ว — จับคู่ด้วย SKU ก่อน ถ้าไม่เจอค่อย fallback ไป EAN เหมือนตอนจับคู่ product เดิม
function _prodMergeCostSheet(meta, worksheet) {
  if (!worksheet) return meta;
  var rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rows || rows.length < 2) return meta;
  var headers = rows[0] || [];
  var colIndex = { sku: -1, ean: -1, cost: -1 };
  for (var i = 0; i < headers.length; i++) {
    var h = (headers[i] || '').toString().toLowerCase().trim();
    if (h.indexOf('sis') !== -1 || h.indexOf('part') !== -1 || h === 'sku') colIndex.sku = i;
    else if (h === 'ean' || h.indexOf('ean') !== -1) colIndex.ean = i;
    else if (h === 'cost' || h.indexOf('ต้นทุน') !== -1) colIndex.cost = i;
  }
  if (colIndex.sku === -1) colIndex.sku = 0;
  if (colIndex.ean === -1) colIndex.ean = 1;
  if (colIndex.cost === -1) colIndex.cost = 3;

  var bySku = {}, byEan = {};
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row) continue;
    var sku = (row[colIndex.sku] != null) ? row[colIndex.sku].toString().trim() : '';
    var ean = (row[colIndex.ean] != null) ? row[colIndex.ean].toString().trim() : '';
    var cost = parseFloat(row[colIndex.cost]) || 0;
    if (sku) bySku[sku] = cost;
    if (ean) byEan[ean] = cost;
  }

  meta.forEach(function(m) {
    var newCost = null;
    if (m.parsed.sku && bySku.hasOwnProperty(m.parsed.sku)) newCost = bySku[m.parsed.sku];
    else if (m.parsed.ean && byEan.hasOwnProperty(m.parsed.ean)) newCost = byEan[m.parsed.ean];
    if (newCost === null) return;
    m.parsed.cost = newCost;
    // 🐛 บั๊กที่พบ 2026-07-19: state/diff ของแถวถูกคำนวณไปแล้วตอน parse ชีต 'single' (ก่อน merge cost/shortName
    // เข้ามา) และไม่เคยเทียบ cost เลยด้วย ทำให้แถวที่ "ราคาไม่เปลี่ยนแต่ต้นทุนเปลี่ยน" ยังคงเป็น state 'same'
    // (default action = ข้าม) กด "นำเข้า" แล้วเลยไม่มีอะไรถูกบันทึกจริง ต้องอัปเดต state/diff ตรงนี้ด้วย
    if (m.existing) {
      var oldCost = Number(m.existing.cost) || 0;
      if (Math.abs(oldCost - newCost) > 0.001) {
        m.diff.push({ label: 'ต้นทุน (Cost)', old: fmtMoney(oldCost), newVal: fmtMoney(newCost) });
        m.state = 'changed';
      }
    }
  });
  return meta;
}

// อ่านชีต 'ShortName' แยกต่างหาก (SiS part | EAN | Product Name | Short Name) — ใช้แสดงในการ์ด Pipeline
// แทนชื่อเต็มที่ยาวเกินไป — จับคู่แบบเดียวกับ _prodMergeCostSheet (SKU ก่อน แล้วค่อย fallback EAN)
function _prodMergeShortNameSheet(meta, worksheet) {
  if (!worksheet) return meta;
  var rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rows || rows.length < 2) return meta;
  var headers = rows[0] || [];
  var colIndex = { sku: -1, ean: -1, shortName: -1 };
  for (var i = 0; i < headers.length; i++) {
    var h = (headers[i] || '').toString().toLowerCase().trim();
    if (h.indexOf('sis') !== -1 || h.indexOf('part') !== -1 || h === 'sku') colIndex.sku = i;
    else if (h === 'ean' || h.indexOf('ean') !== -1) colIndex.ean = i;
    else if (h.indexOf('short') !== -1 || h.indexOf('ย่อ') !== -1) colIndex.shortName = i;
  }
  if (colIndex.sku === -1) colIndex.sku = 0;
  if (colIndex.ean === -1) colIndex.ean = 1;
  if (colIndex.shortName === -1) colIndex.shortName = 3;

  var bySku = {}, byEan = {};
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row) continue;
    var sku = (row[colIndex.sku] != null) ? row[colIndex.sku].toString().trim() : '';
    var ean = (row[colIndex.ean] != null) ? row[colIndex.ean].toString().trim() : '';
    var shortName = (row[colIndex.shortName] != null) ? row[colIndex.shortName].toString().trim() : '';
    if (!shortName) continue;
    if (sku) bySku[sku] = shortName;
    if (ean) byEan[ean] = shortName;
  }

  meta.forEach(function(m) {
    var newShort = null;
    if (m.parsed.sku && bySku.hasOwnProperty(m.parsed.sku)) newShort = bySku[m.parsed.sku];
    else if (m.parsed.ean && byEan.hasOwnProperty(m.parsed.ean)) newShort = byEan[m.parsed.ean];
    if (newShort === null) return;
    m.parsed.shortName = newShort;
    // 🐛 บั๊กเดียวกับ _prodMergeCostSheet (ดูคอมเมนต์ที่นั่น) — ต้องอัปเดต state/diff เองตรงนี้ด้วย ไม่งั้น
    // แถวที่แก้แค่ชื่อย่อจะยังเป็น 'same' → default ข้าม → import แล้วไม่มีอะไรถูกบันทึกจริง
    if (m.existing) {
      var oldShort = m.existing.shortName || '';
      if (oldShort !== newShort) {
        m.diff.push({ label: 'ชื่อย่อ', old: oldShort || '(ว่าง)', newVal: newShort });
        m.state = 'changed';
      }
    }
  });
  return meta;
}

// อ่านชีต 'demo' แยกต่างหาก (SiS part | EAN | Product Name | Price | EOL) — Demo มีราคาเดียว ไม่มี
// Level S/A/B/Other เหมือนสินค้าหลัก คืน meta รูปแบบเดียวกับ _prodParseSingleSheet (ใส่ price ลง priceB
// ตัวเดียว ตัวอื่นเป็น 0) เพื่อให้ preview/detail panel/import ใช้โค้ดชุดเดียวกันได้เลย ไม่ต้องแยกอีกชุด
function _prodParseDemoSheet(worksheet) {
  if (!worksheet) return [];
  var rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rows || rows.length < 2) return [];
  var headers = rows[0] || [];
  var colIndex = { sku: -1, ean: -1, name: -1, price: -1 };
  for (var i = 0; i < headers.length; i++) {
    var h = (headers[i] || '').toString().toLowerCase().trim();
    if (h.indexOf('sis') !== -1 || h.indexOf('part') !== -1 || h === 'sku') colIndex.sku = i;
    else if (h === 'ean' || h.indexOf('ean') !== -1) colIndex.ean = i;
    else if (h.indexOf('product') !== -1 || h.indexOf('name') !== -1) colIndex.name = i;
    else if (h === 'price' || h.indexOf('ราคา') !== -1) colIndex.price = i;
  }
  if (colIndex.sku === -1) colIndex.sku = 0;
  if (colIndex.ean === -1) colIndex.ean = 1;
  if (colIndex.name === -1) colIndex.name = 2;
  if (colIndex.price === -1) colIndex.price = 3;

  var existingProducts = getAllProducts();
  var existingMap = {};
  existingProducts.forEach(function(p) {
    if (p && p.sku) existingMap['sku_' + p.sku] = p;
    if (p && p.ean) existingMap['ean_' + p.ean] = p;
    if (p && p.name) existingMap['name_' + p.name] = p;
  });

  var out = [];
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row || row.length < 3) continue;
    var sku = (row[colIndex.sku] != null) ? row[colIndex.sku].toString().trim() : '';
    var ean = (row[colIndex.ean] != null) ? row[colIndex.ean].toString().trim() : '';
    var name = (row[colIndex.name] != null) ? row[colIndex.name].toString().trim() : '';
    if (!name) continue;
    var price = parseFloat(row[colIndex.price]) || 0;

    var existing = null;
    if (sku && existingMap['sku_' + sku]) existing = existingMap['sku_' + sku];
    else if (ean && existingMap['ean_' + ean]) existing = existingMap['ean_' + ean];
    else if (existingMap['name_' + name]) existing = existingMap['name_' + name];

    var category = (existing && isDemoProduct(existing)) ? existing.category : 'demo';
    var parsed = { sku: sku, ean: ean, name: name, rrpInVat: 0, rrpExVat: 0, priceS: 0, priceA: 0, priceB: price, priceOther: 0, category: category, cost: null, shortName: null, isDemo: true };

    var diff = [];
    var state = 'new';
    if (existing) {
      var oldPrice = Number(existing.typePrices && existing.typePrices.B) || Number(existing.price) || 0;
      if ((existing.name || '') !== name) diff.push({ label: 'ชื่อสินค้า', old: existing.name || '', newVal: name });
      if (Math.abs(oldPrice - price) > 0.001) diff.push({ label: 'ราคา (Demo)', old: fmtMoney(oldPrice), newVal: fmtMoney(price) });
      state = diff.length ? 'changed' : 'same';
    }

    out.push({ parsed: parsed, existing: existing, state: state, diff: diff });
  }
  return out;
}

var _PROD_IMPORT_DETAIL_FIELDS = [
  { k: 'sku', l: 'SKU', wide: true },
  { k: 'ean', l: 'EAN' },
  { k: 'name', l: 'ชื่อสินค้า', wide: true },
  { k: 'shortName', l: 'ชื่อย่อ (ใช้ในการ์ด Pipeline)', wide: true },
  { k: 'rrpInVat', l: 'RRP in VAT', num: true },
  { k: 'rrpExVat', l: 'RRP ex VAT', num: true },
  { k: 'priceS', l: 'Type 1 (S)', num: true },
  { k: 'priceA', l: 'Type 2 (A)', num: true },
  { k: 'priceB', l: 'Type 3 (B)', num: true },
  { k: 'priceOther', l: 'Type 4 (Other)', num: true },
  { k: 'cost', l: 'ต้นทุน (Cost)', num: true }
];

function showProductXlsxPreview(meta) {
  _prodImportPending = { meta: meta };
  var counts = { new: 0, changed: 0, same: 0 };
  meta.forEach(function(m) { counts[m.state]++; });

  var h = '<div>';
  h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
  h += '<span style="padding:5px 12px;border-radius:6px;background:var(--bg2);color:var(--text);font-size:12px;border:1px solid var(--border-strong,var(--border))">ทั้งหมด ' + meta.length + '</span>';
  if (counts['new']) h += '<span style="padding:5px 12px;border-radius:6px;background:#22c55e18;color:#22c55e;font-size:12px">➕ ใหม่ ' + counts['new'] + '</span>';
  if (counts.changed) h += '<span style="padding:5px 12px;border-radius:6px;background:#f59e0b18;color:#f59e0b;font-size:12px">✏️ เปลี่ยน ' + counts.changed + '</span>';
  if (counts.same) h += '<span style="padding:5px 12px;border-radius:6px;background:var(--bg2);color:var(--text2);font-size:12px">⏭ เดิม ' + counts.same + '</span>';
  h += '</div>';

  if (counts.changed || counts['new']) {
    h += '<div style="font-size:11px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:5px 10px;margin-bottom:8px;display:flex;align-items:center;gap:8px">';
    h += '<span style="color:var(--text2)">ปรับทั้งหมด:</span>';
    h += '<select onchange="_prodImportBulkAct(this.value)" style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">';
    h += '<option value="">— เลือก —</option>';
    h += '<option value="apply">✏️ นำเข้าทุกรายการ (ใหม่+เปลี่ยน)</option>';
    h += '<option value="skip">⏭ ข้ามทุกรายการ</option>';
    h += '</select></div>';
  }

  h += '<div style="max-height:380px;overflow-y:auto;font-size:13px;border:1px solid var(--border);border-radius:6px;background:var(--bg2)">';
  h += '<table style="width:100%;border-collapse:collapse"><thead><tr style="position:sticky;top:0;background:var(--bg2)">' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:center;white-space:nowrap">สถานะ</th>' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:left">SKU</th>' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:left">ชื่อสินค้า</th>' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:right">ราคา (Type 3)</th>' +
    '<th style="padding:6px 10px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);text-align:left">การดำเนินการ</th>' +
    '</tr></thead><tbody>';
  meta.forEach(function(m, i) {
    var badge, defAct;
    if (m.state === 'new')          { badge = '<span style="color:#22c55e;font-size:11px;font-weight:700">➕ ใหม่</span>';       defAct = 'apply'; }
    else if (m.state === 'changed') { badge = '<span style="color:#f59e0b;font-size:11px;font-weight:700">✏️ เปลี่ยน</span>';  defAct = 'apply'; }
    else                            { badge = '<span style="color:var(--text2);font-size:11px;font-weight:700">⏭ เดิม</span>'; defAct = 'skip'; }
    var diffBtn = m.state === 'changed'
      ? ' <button onclick="_prodToggleDiff(' + i + ')" id="prodDiffBtn_' + i + '" style="font-size:10px;padding:1px 5px;border:1px solid var(--border);border-radius:4px;background:var(--bg);cursor:pointer;color:var(--text2)" title="ดูการเปลี่ยนแปลง">🔍 ' + m.diff.length + '</button>'
      : '';
    var sel = '<select id="prodRowAct_' + i + '" style="font-size:12px;padding:3px 5px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">' +
      '<option value="apply"' + (defAct === 'apply' ? ' selected' : '') + '>✔ นำเข้า</option>' +
      '<option value="skip"'  + (defAct === 'skip'  ? ' selected' : '') + '>⏭ ข้าม</option>' +
      '</select>';
    h += '<tr data-pstate="' + m.state + '" style="border-bottom:' + (m.state === 'changed' ? 'none' : '1px solid var(--border)') + '">' +
      '<td style="padding:5px 10px;text-align:center;white-space:nowrap">' + badge + diffBtn + '</td>' +
      '<td style="padding:5px 10px;color:var(--text2);white-space:nowrap" id="prodRowSku_' + i + '">' + sanitize(m.parsed.sku || '-') + '</td>' +
      '<td style="padding:5px 10px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="prodRowName_' + i + '">' + sanitize(m.parsed.name) + '</td>' +
      '<td style="padding:5px 10px;text-align:right;font-size:12px;white-space:nowrap" id="prodRowPrice_' + i + '">' + fmtMoney(m.parsed.priceB) + '</td>' +
      '<td style="padding:5px 10px">' + sel +
        '<button onclick="_prodXlsxOpenDetail(' + i + ')" style="display:block;margin-top:3px;font-size:10px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);cursor:pointer;color:var(--text2);width:100%" title="ดู/แก้ไขทุกคอลัมน์">📝 รายละเอียด</button>' +
      '</td></tr>';
    if (m.state === 'changed' && m.diff.length) {
      h += '<tr data-pstate="changed" id="prodDiffRow_' + i + '" style="display:none;border-bottom:1px solid var(--border)">' +
        '<td colspan="5" style="padding:6px 16px 8px;background:var(--bg)">' +
        '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
        '<thead><tr>' +
          '<th style="padding:2px 8px;text-align:left;color:var(--text2);border-bottom:1px solid var(--border)">Field</th>' +
          '<th style="padding:2px 8px;text-align:left;color:#ef4444;border-bottom:1px solid var(--border)">ค่าเดิม</th>' +
          '<th style="padding:2px 8px;text-align:left;color:#22c55e;border-bottom:1px solid var(--border)">ค่าใหม่</th>' +
        '</tr></thead><tbody>';
      m.diff.forEach(function(d) {
        h += '<tr>' +
          '<td style="padding:2px 8px;color:var(--text2);white-space:nowrap">' + sanitize(d.label) + '</td>' +
          '<td style="padding:2px 8px;color:#ef4444;white-space:nowrap">' + sanitize(String(d.old)) + '</td>' +
          '<td style="padding:2px 8px;color:#22c55e;white-space:nowrap">' + sanitize(String(d.newVal)) + '</td>' +
          '</tr>';
      });
      h += '</tbody></table></td></tr>';
    }
  });
  h += '</tbody></table></div>';

  // ── Detail panel: ดู/แก้ไขทุกคอลัมน์ของแถวเดียว พร้อมปุ่มย้อนกลับ/ถัดไป ──
  h += '<div id="prodXlsxDetailPanel" style="display:none;margin-top:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 14px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h += '<div style="display:flex;align-items:center;gap:8px">';
  h += '<button onclick="_prodXlsxDetailNav(-1)" style="width:30px;padding:4px 0" title="ก่อนหน้า">◀</button>';
  h += '<span style="font-size:12px;color:var(--text2)">แถวที่ <b id="prodXlsxDetailPos" style="color:var(--text)"></b></span>';
  h += '<button onclick="_prodXlsxDetailNav(1)" style="width:30px;padding:4px 0" title="ถัดไป">▶</button>';
  h += '</div>';
  h += '<button onclick="_prodXlsxDetailClose()" style="border:none;background:none;cursor:pointer;font-size:13px;color:var(--text2)">✕</button>';
  h += '</div>';
  h += '<div id="prodXlsxDetailFields" style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px"></div>';
  h += '</div>';

  h += '<div style="display:flex;gap:8px;margin-top:12px">';
  h += '<button class="btn bp" style="flex:1" onclick="_doProductXlsxImport()">📥 นำเข้า (' + (counts['new'] + counts.changed) + ' รายการ)</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '</div></div>';

  openM('📂 Preview: Import ราคาสินค้าจาก Excel', h);
  if (typeof setMWide === 'function') setMWide(960);
}

function _prodToggleDiff(i) {
  var row = document.getElementById('prodDiffRow_' + i);
  var btn = document.getElementById('prodDiffBtn_' + i);
  if (!row) return;
  var open = row.style.display !== 'none';
  row.style.display = open ? 'none' : '';
  if (btn) btn.style.background = open ? '' : 'var(--accent)';
}

function _prodImportBulkAct(val) {
  if (!val) return;
  var i = 0;
  while (document.getElementById('prodRowAct_' + i)) {
    document.getElementById('prodRowAct_' + i).value = val;
    i++;
  }
}

function _prodXlsxOpenDetail(i) {
  _prodImportDetailIdx = i;
  var panel = document.getElementById('prodXlsxDetailPanel');
  if (panel) { panel.style.display = ''; panel.scrollIntoView({ block: 'nearest' }); }
  _prodXlsxRenderDetail();
}

function _prodXlsxDetailNav(delta) {
  if (!_prodImportPending) return;
  var next = _prodImportDetailIdx + delta;
  if (next < 0 || next >= _prodImportPending.meta.length) return;
  _prodImportDetailIdx = next;
  _prodXlsxRenderDetail();
}

function _prodXlsxDetailClose() {
  var panel = document.getElementById('prodXlsxDetailPanel');
  if (panel) panel.style.display = 'none';
}

// แก้ค่า field ใน memory ทันที (ไม่ต้องกดบันทึกแยก) — เขียนกลับเข้า meta[i].parsed ตรงๆ ใช้ตอนกด "นำเข้า" เลย
function _prodXlsxDetailFieldChange(key, value, isNum) {
  if (!_prodImportPending) return;
  var m = _prodImportPending.meta[_prodImportDetailIdx];
  m.parsed[key] = isNum ? (parseFloat(value) || 0) : value;
  // sync ตารางสรุปด้านบนให้ตรงกับค่าที่แก้ (แสดงเฉพาะ sku/name/ราคาหลัก ที่โชว์ในตาราง)
  var skuEl = document.getElementById('prodRowSku_' + _prodImportDetailIdx);
  var nameEl = document.getElementById('prodRowName_' + _prodImportDetailIdx);
  var priceEl = document.getElementById('prodRowPrice_' + _prodImportDetailIdx);
  if (skuEl) skuEl.textContent = m.parsed.sku || '-';
  if (nameEl) nameEl.textContent = m.parsed.name;
  if (priceEl) priceEl.textContent = fmtMoney(m.parsed.priceB);
}

function _prodXlsxRenderDetail() {
  if (!_prodImportPending) return;
  var m = _prodImportPending.meta[_prodImportDetailIdx];
  var posEl = document.getElementById('prodXlsxDetailPos');
  if (posEl) posEl.textContent = (_prodImportDetailIdx + 1) + ' / ' + _prodImportPending.meta.length;
  var grid = document.getElementById('prodXlsxDetailFields');
  if (!grid) return;
  var h = '';
  _PROD_IMPORT_DETAIL_FIELDS.forEach(function(f) {
    var val = m.parsed[f.k];
    h += '<div style="' + (f.wide ? 'grid-column:1 / -1' : '') + '">' +
      '<label style="display:block;font-size:11px;color:var(--text2);margin-bottom:2px">' + f.l + '</label>' +
      '<input type="' + (f.num ? 'number' : 'text') + '" value="' + sanitize(String(val == null ? '' : val)) + '" onchange="_prodXlsxDetailFieldChange(\'' + f.k + '\',this.value,' + (!!f.num) + ')" style="width:100%">' +
      '</div>';
  });
  grid.innerHTML = h;
}

function _doProductXlsxImport() {
  if (!_prodImportPending) return;
  var meta = _prodImportPending.meta;
  var added = 0, updated = 0;
  meta.forEach(function(m, i) {
    var el = document.getElementById('prodRowAct_' + i);
    var action = el ? el.value : (m.state === 'same' ? 'skip' : 'apply');
    if (action !== 'apply') return;
    var productData = {
      name: m.parsed.name,
      sku: m.parsed.sku,
      ean: m.parsed.ean,
      rrpInVat: m.parsed.rrpInVat,
      rrpExVat: m.parsed.rrpExVat,
      price: m.parsed.priceB,
      typePrices: { S: m.parsed.priceS, A: m.parsed.priceA, B: m.parsed.priceB, Other: m.parsed.priceOther },
      category: m.parsed.category,
      eol: false,
      updatedAt: new Date().toISOString()
    };
    if (m.parsed.cost != null) productData.cost = m.parsed.cost;
    if (m.parsed.shortName != null) productData.shortName = m.parsed.shortName;
    if (m.existing) {
      updateProduct(m.existing.id, productData);
      updated++;
    } else {
      productData.createdAt = new Date().toISOString();
      addProduct(productData);
      added++;
    }
  });
  _prodImportPending = null;
  closeMForce();
  toast('✅ นำเข้าราคาสินค้าเสร็จ! +' + added + ' อัปเดต ' + updated);
  if (typeof _prodImportComboDemoIfPresent === 'function') _prodImportComboDemoIfPresent();
  render();
}

function importBundlesFromSheet(worksheet) {
  var rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (!rows || rows.length < 2) return { imported: 0, updated: 0, errors: 0 };
  var imported = 0, updated = 0, errors = 0;
  var bundleMap = {};
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (!row || row.length < 2) continue;
    var comboNo = (row[1] || '').toString().trim();
    var comboName = (row[2] || '').toString().trim();
    var productEan = (row[3] || '').toString().trim();
    var qty = parseInt(row[4]) || 1;
    var priceS = parseFloat(row[8]) || 0;
    var priceA = parseFloat(row[9]) || 0;
    var priceB = parseFloat(row[10]) || 0;
    var priceOther = parseFloat(row[11]) || 0;
    if (!comboNo) continue;
    if (!bundleMap[comboNo]) {
      bundleMap[comboNo] = {
        name: comboName || 'Unnamed Bundle',
        items: [],
        typePrices: { S: priceS, A: priceA, B: priceB, Other: priceOther },
        enabled: true
      };
    }
    if (productEan) {
      var product = getProductByEan(productEan);
      bundleMap[comboNo].items.push({
        productId: product ? product.id : null,
        sku: product ? product.sku : '',
        name: product ? product.name : '',
        qty: qty
      });
    }
  }
  for (var id in bundleMap) {
    var b = bundleMap[id];
    var existing = getBundleByName(b.name);
    if (existing) {
      updateBundle(existing.id, b);
      updated++;
    } else {
      addBundle(b);
      imported++;
    }
  }
  console.log(`Import bundles: +${imported}, updated ${updated}, errors ${errors}`);
  return { imported: imported, updated: updated, errors: errors };
}

function importDemoUnitsFromSheet(worksheet) {
  var rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (!rows || rows.length < 2) return { imported: 0, updated: 0, errors: 0 };
  var imported = 0, updated = 0, errors = 0;
  for (var i = 1; i < rows.length; i++) {
    try {
      var row = rows[i];
      if (!row || row.length < 3) continue;
      var sku = (row[0] || '').toString().trim();
      var ean = (row[1] || '').toString().trim();
      var name = (row[2] || '').toString().trim();
      var price = parseFloat(row[3]) || 0;
      if (!name) continue;
      var product = getProductBySku(sku) || getProductByEan(ean);
      var existingDemo = null;
      var demos = getAllDemoUnits();
      for (var j = 0; j < demos.length; j++) {
        if (demos[j].sku === sku || demos[j].ean === ean) {
          existingDemo = demos[j];
          break;
        }
      }
      var demoData = {
        productId: product ? product.id : null,
        productName: name,
        sku: sku,
        ean: ean,
        price: price,
        enabled: true,
        note: ''
      };
      if (existingDemo) {
        updateDemoUnit(existingDemo.id, demoData);
        updated++;
      } else {
        addDemoUnit(demoData);
        imported++;
      }
    } catch(e) { errors++; }
  }
  console.log(`Import demo units: +${imported}, updated ${updated}, errors ${errors}`);
  return { imported: imported, updated: updated, errors: errors };
}

// ================================================================
// FULL IMPORT (ALL SHEETS)
// ================================================================

function importFullExcel(file, onComplete) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var result = { products: null, bundles: null, demos: null };
      if (workbook.SheetNames.includes('single')) {
        var sheet = workbook.Sheets['single'];
        result.products = importProductsFromSheet(sheet);
      }
      if (workbook.SheetNames.includes('combo')) {
        var sheet = workbook.Sheets['combo'];
        result.bundles = importBundlesFromSheet(sheet);
      }
      if (workbook.SheetNames.includes('demo')) {
        var sheet = workbook.Sheets['demo'];
        result.demos = importDemoUnitsFromSheet(sheet);
      }
      if (onComplete) onComplete({ success: true, result: result });
    } catch(err) {
      if (onComplete) onComplete({ success: false, error: err.message });
    }
  };
  reader.onerror = function() {
    if (onComplete) onComplete({ success: false, error: 'Cannot read file' });
  };
  reader.readAsArrayBuffer(file);
}

function doImportFullExcel() {
  var fileInput = document.getElementById('importFullFile');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    toast('⚠️ กรุณาเลือกไฟล์ Excel');
    return;
  }
  
  toast('🔄 กำลังนำเข้าข้อมูล...');
  
  var file = fileInput.files[0];
  var reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      
      if (!rows || rows.length < 2) {
        toast('❌ ไม่พบข้อมูลในไฟล์');
        return;
      }
      
      // สร้างโครงสร้างข้อมูลใหม่
      var productsData = {
        models: [],
        bundles: [],
        demoUnits: [],
        lastUpdated: new Date().toISOString()
      };
      
      // อ่าน header
      var headers = rows[0];
      var colIdx = { sku: 0, ean: 1, name: 2, rrpInVat: 3, rrpExVat: 4, priceS: 5, priceA: 6, priceB: 7, priceOther: 8 };
      
      // หา column อัตโนมัติ
      for (var i = 0; i < headers.length; i++) {
        var h = String(headers[i] || '').toLowerCase();
        if (h.indexOf('sis') !== -1 || h.indexOf('part') !== -1) colIdx.sku = i;
        if (h.indexOf('ean') !== -1) colIdx.ean = i;
        if (h.indexOf('product') !== -1 || h.indexOf('name') !== -1) colIdx.name = i;
        if (h.indexOf('rrp in vat') !== -1) colIdx.rrpInVat = i;
        if (h.indexOf('rrp ex vat') !== -1) colIdx.rrpExVat = i;
        if (h.indexOf('type 1') !== -1) colIdx.priceS = i;
        if (h.indexOf('type 2') !== -1) colIdx.priceA = i;
        if (h.indexOf('type 3') !== -1) colIdx.priceB = i;
        if (h.indexOf('type 4') !== -1) colIdx.priceOther = i;
      }
      
      var imported = 0;
      var errors = 0;
      
      for (var i = 1; i < rows.length; i++) {
        try {
          var row = rows[i];
          var name = row[colIdx.name] ? String(row[colIdx.name]).trim() : '';
          
          if (!name) {
            errors++;
            continue;
          }
          
          var sku = row[colIdx.sku] ? String(row[colIdx.sku]).trim() : '';
          var ean = row[colIdx.ean] ? String(row[colIdx.ean]).trim() : '';
          var rrpInVat = parseFloat(row[colIdx.rrpInVat]) || 0;
          var rrpExVat = parseFloat(row[colIdx.rrpExVat]) || 0;
          var priceS = parseFloat(row[colIdx.priceS]) || 0;
          var priceA = parseFloat(row[colIdx.priceA]) || 0;
          var priceB = parseFloat(row[colIdx.priceB]) || 0;
          var priceOther = parseFloat(row[colIdx.priceOther]) || 0;
          
          if (priceB === 0 && rrpExVat > 0) priceB = rrpExVat;
          
          // กำหนดหมวดหมู่
          var category = 'other';
          var nameLower = name.toLowerCase();
          if (nameLower.indexOf('matrice') !== -1 || nameLower.indexOf('mavic') !== -1) category = 'drone';
          else if (nameLower.indexOf('zenmuse') !== -1) category = 'payload';
          else if (nameLower.indexOf('battery') !== -1) category = 'battery';
          else if (nameLower.indexOf('flighthub') !== -1 || nameLower.indexOf('terra') !== -1) category = 'software';
          else if (nameLower.indexOf('dock') !== -1) category = 'bundle';
          
          productsData.models.push({
            id: 'prod_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 4),
            name: name,
            sku: sku,
            ean: ean,
            category: category,
            rrpInVat: rrpInVat,
            rrpExVat: rrpExVat,
            price: priceB,
            typePrices: { S: priceS, A: priceA, B: priceB, Other: priceOther },
            eol: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          imported++;
          
        } catch(e) {
          errors++;
        }
      }
      
      localStorage.setItem('v7_products', JSON.stringify(productsData));
      
      // รีเฟรช Products module
      if (typeof Products !== 'undefined' && Products.refresh) {
        Products.refresh();
      }
      
      toast('✅ นำเข้าเสร็จ! ' + imported + ' รายการ');
      
      if (typeof render === 'function') render();
      
    } catch(err) {
      console.error('Import error:', err);
      toast('❌ นำเข้าล้มเหลว: ' + err.message);
    }
  };
  
  reader.onerror = function() {
    toast('❌ ไม่สามารถอ่านไฟล์ได้');
  };
  
  reader.readAsArrayBuffer(file);
}
// ================================================================
// EXPORT TO EXCEL
// ================================================================

function exportProductsToExcel() {
  var allProducts = getAllProducts();
  // แยก Demo ออกจากสินค้าหลัก — Demo ไม่มีราคาแยกตาม Level (S/A/B/Other) เก็บปนกันจะงงเปล่าๆ
  var products = allProducts.filter(function(p) { return !isDemoProduct(p); });
  var demoProducts = allProducts.filter(isDemoProduct);

  var data = products.map(function(p, idx) {
    return {
      'SiS part': p.sku || '',
      'EAN': p.ean || '',
      'Product Name': p.name,
      'RRP in Vat': p.rrpInVat || 0,
      'RRP Ex Vat': p.rrpExVat || 0,
      'Type 1 P EX Tax THB (S)': p.typePrices?.S || 0,
      'Type 2 P EX Tax THB (A)': p.typePrices?.A || 0,
      'Type 3 P EX Tax THB (B)': p.typePrices?.B || 0,
      'Type 4 P EX Tax THB (Other)': p.typePrices?.Other || 0,
      'EOL': p.eol ? 'EOL' : '',
      'Type': p.isSoftware ? 'Software' : (p.isService ? 'Service' : (p.isBundle ? 'Bundle' : 'Hardware')),
      'Category': getCategoryName(p.category)
    };
  });
  var ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{wch:20},{wch:15},{wch:40},{wch:15},{wch:15},{wch:15},{wch:15},{wch:15},{wch:15},{wch:8},{wch:12},{wch:15}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'single');

  // ชีต Demo แยกต่างหาก — ราคาเดียว ไม่มี Level
  var demoData = demoProducts.map(function(p) {
    return { 'SiS part': p.sku || '', 'EAN': p.ean || '', 'Product Name': p.name, 'Price': Number(p.price) || 0, 'EOL': p.eol ? 'EOL' : '' };
  });
  var wsDemo = XLSX.utils.json_to_sheet(demoData);
  wsDemo['!cols'] = [{wch:20},{wch:15},{wch:40},{wch:15},{wch:8}];
  XLSX.utils.book_append_sheet(wb, wsDemo, 'demo');

  // ต้นทุนแยกชีตต่างหาก (ครอบทั้งสินค้าหลัก+Demo) — จับคู่กลับตอน import ด้วย SKU ก่อน แล้วค่อย fallback เป็น EAN
  var costData = allProducts.map(function(p) {
    return { 'SiS part': p.sku || '', 'EAN': p.ean || '', 'Product Name': p.name, 'Cost': Number(p.cost) || 0 };
  });
  var wsCost = XLSX.utils.json_to_sheet(costData);
  wsCost['!cols'] = [{wch:20},{wch:15},{wch:40},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsCost, 'cost');

  // ชื่อย่อแยกชีตต่างหาก (ครอบทั้งสินค้าหลัก+Demo) — ใช้แสดงในการ์ด Pipeline กันชื่อยาวๆ ทำการ์ดรก
  // จับคู่กลับตอน import ด้วย SKU ก่อน แล้วค่อย fallback เป็น EAN เหมือนชีต cost
  var shortNameData = allProducts.map(function(p) {
    return { 'SiS part': p.sku || '', 'EAN': p.ean || '', 'Product Name': p.name, 'Short Name': p.shortName || '' };
  });
  var wsShortName = XLSX.utils.json_to_sheet(shortNameData);
  wsShortName['!cols'] = [{wch:20},{wch:15},{wch:40},{wch:20}];
  XLSX.utils.book_append_sheet(wb, wsShortName, 'shortname');

  XLSX.writeFile(wb, 'products-export-' + _td() + '.xlsx');
  toast('📥 Export Excel สำเร็จ! (มีชีต single + demo + cost + ShortName)');
}

function exportBundlesToExcel() {
  var bundles = getAllBundles();
  var data = bundles.map(function(b, idx) {
    return {
      '#': idx + 1,
      'Bundle Name': b.name,
      'Description': b.description || '',
      'Items': (b.items || []).map(function(it) { return (it.name || it.sku) + (it.qty > 1 ? ' x' + it.qty : ''); }).join(', '),
      'Price S': b.typePrices?.S || 0,
      'Price A': b.typePrices?.A || 0,
      'Price B': b.typePrices?.B || 0,
      'Price Other': b.typePrices?.Other || 0,
      'Enabled': b.enabled ? 'Active' : 'Inactive'
    };
  });
  var ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{wch:5},{wch:30},{wch:40},{wch:50},{wch:12},{wch:12},{wch:12},{wch:12},{wch:10}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'combo');
  XLSX.writeFile(wb, 'bundles-export-' + _td() + '.xlsx');
  toast('📥 Export Bundles สำเร็จ!');
}

function exportDemoUnitsToExcel() {
  var demos = getAllDemoUnits();
  var data = demos.map(function(d, idx) {
    var product = d.productId ? getProductById(d.productId) : null;
    return {
      '#': idx + 1,
      'SKU': d.sku || '',
      'EAN': d.ean || '',
      'Product Name': d.productName || '',
      'Demo Price': d.price || 0,
      'Related Product': product ? product.name : '',
      'Status': d.enabled ? 'Active' : 'Inactive',
      'Note': d.note || ''
    };
  });
  var ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{wch:5},{wch:20},{wch:15},{wch:40},{wch:15},{wch:30},{wch:10},{wch:20}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'demo');
  XLSX.writeFile(wb, 'demo-units-export-' + _td() + '.xlsx');
  toast('📥 Export Demo Units สำเร็จ!');
}

// ================================================================
// CLEAR ALL DATA
// ================================================================

function clearAllProductsData() {
  if (!confirm('⚠️ ยืนยันลบข้อมูลทั้งหมด (สินค้า, Bundle, Demo Unit)? ข้อมูลจะหายไปถาวร')) return;
  var data = getProductsData();
  data.models = [];
  data.bundles = [];
  data.demoUnits = [];
  saveProductsData(data);
  toast('🗑️ ลบข้อมูลทั้งหมดแล้ว');
  render();
}

// ================================================================
// PAGE RENDERERS (พร้อม search + category filter + type filter + EOL checkbox)
// ================================================================

var productSearch = '';
var productCategoryFilter = 'all';
var productTypeFilter = 'all';     // ✅ เพิ่ม: 'all', 'main', 'demo'
var productViewMode = 'table';
var _marginWhatIf = 0; // จำลองส่วนลด % ในมุมมอง Margin (0 = ราคาเต็ม)
var _prodSheetInstance = null;
var _prodSheetIds = [];
var priceSearch = '';
var priceCategoryFilter = 'all';

function rProducts(el) {
  document.getElementById('pgT').textContent = '📦 สินค้าทั้งหมด';
  var products = getAllProducts();

  // ✅ กรองตามคำค้นหา
  if (productSearch) {
    var q = productSearch.toLowerCase();
    products = products.filter(function(p) {
      return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
             (p.sku || '').toLowerCase().indexOf(q) !== -1 ||
             (p.ean || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  
  // ✅ กรองตามหมวดหมู่
  if (productCategoryFilter !== 'all') {
    products = products.filter(function(p) { return p.category === productCategoryFilter; });
  }
  
  // ✅ กรองตามประเภทสินค้า (Main / Demo)
  if (productTypeFilter === 'main') {
    products = products.filter(function(p) { return !isDemoProduct(p); });
  } else if (productTypeFilter === 'demo') {
    products = products.filter(function(p) { return isDemoProduct(p); });
  }
  
  var html = '<div class="card"><h2>📋 สินค้าทั้งหมด <span id="productsCount" style="font-size:.75rem;font-weight:400;color:var(--text2)">พบ ' + products.length + ' รายการ</span><span class="ml"><button class="btn bp" onclick="showAddProductM()">➕ เพิ่มสินค้า</button><button class="btn bo" onclick="exportProductsToExcel()">📥 Export Excel</button><button class="btn bo" onclick="document.getElementById(\'importProductFileList\').click()">📤 นำเข้า Excel</button><input type="file" id="importProductFileList" accept=".xlsx,.xls" style="display:none" onchange="importProductsFromExcelAdmin(event)"><button class="btn bo" onclick="showPasteProductsM()">📋 วาง Excel</button><button class="btn bo" onclick="showImportCostM()">💸 นำเข้าต้นทุน</button></span></h2>';
  
  // ✅ แถบกรอง (เพิ่ม Select สำหรับประเภทสินค้า)
  html += '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
  html += '<input type="text" id="productSearchInput" class="fm-input" placeholder="🔍 ค้นหาสินค้า (ชื่อ, SKU, EAN)" style="flex:1" value="' + sanitize(productSearch) + '" oninput="productSearch=this.value;renderProductsList()">';
  
  // Filter หมวดหมู่
  html += '<select id="productCategorySelect" class="fm-input" style="width:150px" onchange="productCategoryFilter=this.value;renderProductsList()">';
  html += '<option value="all" ' + (productCategoryFilter === 'all' ? 'selected' : '') + '>📂 ทุกหมวด</option>';
  for (var i = 0; i < PRODUCT_CATEGORIES.length; i++) {
    var cat = PRODUCT_CATEGORIES[i];
    html += '<option value="' + cat.id + '" ' + (productCategoryFilter === cat.id ? 'selected' : '') + '>' + cat.name + '</option>';
  }
  html += '</select>';
  
  // ✅ Filter ประเภทสินค้า (เพิ่มตรงนี้)
  html += '<select id="productTypeSelect" class="fm-input" style="width:140px" onchange="productTypeFilter=this.value;renderProductsList()">';
  html += '<option value="all" ' + (productTypeFilter === 'all' ? 'selected' : '') + '>🔧 ทุกประเภท</option>';
  html += '<option value="main" ' + (productTypeFilter === 'main' ? 'selected' : '') + '>📦 Main Product</option>';
  html += '<option value="demo" ' + (productTypeFilter === 'demo' ? 'selected' : '') + '>🎪 Demo Unit</option>';
  html += '</select>';
  
  html += '<button class="btn bsm bo" onclick="resetProductFilters()">✖️ ล้าง</button>';
  html += '<span style="margin-left:auto;display:flex;gap:4px">';
  html += '<button id="btnProdTable" class="btn bsm' + (productViewMode==='table'?' bp':'') + '" onclick="setProductView(\'table\')">📋 Table</button>';
  html += '<button id="btnProdCatalog" class="btn bsm' + (productViewMode==='catalog'?' bp':'') + '" onclick="setProductView(\'catalog\')">🖼️ Catalog</button>';
  html += '<button id="btnProdSheet" class="btn bsm' + (productViewMode==='sheet'?' bp':'') + '" onclick="setProductView(\'sheet\')">🗂️ Sheet</button>';
  html += '<button id="btnProdMargin" class="btn bsm' + (productViewMode==='margin'?' bp':'') + '" onclick="setProductView(\'margin\')">💰 Margin</button>';
  html += '</span>';
  html += '</div>';

  html += '<div id="productsTableWrap"' + (productViewMode!=='table' ? ' style="display:none"' : '') + '>';
  html += '<div class="export-wrap"><table class="export-table" id="productsTable" style="table-layout:fixed;width:100%"><thead><tr>';
  html += '<th style="width:40px">#</th><th style="width:130px">SKU</th><th style="width:120px">EAN</th><th style="width:auto">ชื่อสินค้า</th><th style="width:110px">หมวดหมู่</th>';
  html += '<th style="width:100px">RRP in Vat</th><th style="width:100px">RRP Ex Vat</th>';
  html += '<th style="width:80px">S</th><th style="width:80px">A</th><th style="width:80px">B</th><th style="width:80px">Other</th>';
  html += '<th style="width:160px">สถานะ</th><th style="width:80px"></th>';
  html += '</thead><tbody id="productsTableBody"></tbody></table></div>';
  html += '</div>';
  html += '<div id="productsCatalogWrap"' + (productViewMode!=='catalog' ? ' style="display:none"' : '') + '>';
  html += '<div class="prod-catalog-grid" id="productsCatalogGrid"></div>';
  html += '</div>';
  html += '<div id="productsSheetWrap"' + (productViewMode!=='sheet' ? ' style="display:none;overflow-x:auto"' : ' style="overflow-x:auto"') + '>';
  html += '<div id="productsSheetEl"></div>';
  html += '<div style="margin-top:8px;display:flex;gap:8px;align-items:center">';
  html += '<button class="btn bp" onclick="saveProductsSheet()">💾 บันทึกทั้งหมด</button>';
  html += '<span id="sheetSaveStatus" style="font-size:.8rem;color:var(--text2)"></span>';
  html += '</div></div>';
  html += '<div id="productsMarginWrap"' + (productViewMode!=='margin' ? ' style="display:none;overflow-x:auto"' : ' style="overflow-x:auto"') + '></div>';
  html += '</div>';

  el.innerHTML = html;
  if (productViewMode === 'sheet') {
    setTimeout(function() { initProductsSheet(products); }, 0);
  } else if (productViewMode === 'catalog') {
    renderProductsCatalog(products);
  } else if (productViewMode === 'margin') {
    renderProductsMargin(products);
  } else {
    renderProductsTable(products);
  }
  
  // ✅ ฟังก์ชัน renderProductsList (อัปเดตให้รองรับ type filter)
  window.renderProductsList = function() {
    var newProducts = getAllProducts();
    var q = document.getElementById('productSearchInput') ? document.getElementById('productSearchInput').value.toLowerCase() : '';
    var cat = document.getElementById('productCategorySelect') ? document.getElementById('productCategorySelect').value : 'all';
    var type = document.getElementById('productTypeSelect') ? document.getElementById('productTypeSelect').value : 'all';
    
    if (q) {
      newProducts = newProducts.filter(function(p) {
        return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
               (p.sku || '').toLowerCase().indexOf(q) !== -1 ||
               (p.ean || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (cat !== 'all') {
      newProducts = newProducts.filter(function(p) { return p.category === cat; });
    }
    // ✅ กรองตามประเภท
    if (type === 'main') {
      newProducts = newProducts.filter(function(p) { return !isDemoProduct(p); });
    } else if (type === 'demo') {
      newProducts = newProducts.filter(function(p) { return isDemoProduct(p); });
    }
    
    productSearch = q;
    productCategoryFilter = cat;
    productTypeFilter = type;
    var cnt = document.getElementById('productsCount');
    if (cnt) cnt.textContent = 'พบ ' + newProducts.length + ' รายการ';
    if (productViewMode === 'sheet') { initProductsSheet(newProducts); }
    else if (productViewMode === 'catalog') { renderProductsCatalog(newProducts); }
    else if (productViewMode === 'margin') { renderProductsMargin(newProducts); }
    else { renderProductsTable(newProducts); }
  };
}

// ✅ ฟังก์ชัน reset filters
function resetProductFilters() {
  productSearch = '';
  productCategoryFilter = 'all';
  productTypeFilter = 'all';
  
  var searchInput = document.getElementById('productSearchInput');
  if (searchInput) searchInput.value = '';
  
  var catSelect = document.getElementById('productCategorySelect');
  if (catSelect) catSelect.value = 'all';
  
  var typeSelect = document.getElementById('productTypeSelect');
  if (typeSelect) typeSelect.value = 'all';
  
  renderProductsList();
}

function setProductView(mode) {
  productViewMode = mode;
  var tw = document.getElementById('productsTableWrap');
  var cw = document.getElementById('productsCatalogWrap');
  var sw = document.getElementById('productsSheetWrap');
  var mw = document.getElementById('productsMarginWrap');
  var bt = document.getElementById('btnProdTable');
  var bc = document.getElementById('btnProdCatalog');
  var bs = document.getElementById('btnProdSheet');
  var bm = document.getElementById('btnProdMargin');
  if (tw) tw.style.display = mode === 'table' ? '' : 'none';
  if (cw) cw.style.display = mode === 'catalog' ? '' : 'none';
  if (sw) sw.style.display = mode === 'sheet' ? '' : 'none';
  if (mw) mw.style.display = mode === 'margin' ? '' : 'none';
  if (bt) bt.className = 'btn bsm' + (mode === 'table' ? ' bp' : '');
  if (bc) bc.className = 'btn bsm' + (mode === 'catalog' ? ' bp' : '');
  if (bs) bs.className = 'btn bsm' + (mode === 'sheet' ? ' bp' : '');
  if (bm) bm.className = 'btn bsm' + (mode === 'margin' ? ' bp' : '');
  if (mode === 'sheet') {
    var prods = getAllProducts();
    var q = productSearch, cat = productCategoryFilter, typ = productTypeFilter;
    if (q) prods = prods.filter(function(p) { return (p.name||'').toLowerCase().indexOf(q)!==-1||(p.sku||'').toLowerCase().indexOf(q)!==-1||(p.ean||'').toLowerCase().indexOf(q)!==-1; });
    if (cat !== 'all') prods = prods.filter(function(p) { return p.category === cat; });
    if (typ === 'main') prods = prods.filter(function(p) { return !isDemoProduct(p); });
    else if (typ === 'demo') prods = prods.filter(function(p) { return isDemoProduct(p); });
    initProductsSheet(prods);
  } else {
    if (typeof renderProductsList === 'function') renderProductsList();
  }
}

// มุมมองเปรียบเทียบกำไรทุก level (S/A/B/Other) เทียบต้นทุน — margin% = (ราคา−ต้นทุน)/ราคา ฐาน ex VAT (ตรงกับใบเสนอราคา)
function _marginColor(m) {
  if (m === null) return 'var(--text2)';
  if (m < 0) return '#ef4444';
  if (m < 15) return '#f59e0b';
  if (m < 25) return '#eab308';
  return '#22c55e';
}
function renderProductsMargin(products) {
  var wrap = document.getElementById('productsMarginWrap');
  if (!wrap) return;
  var levels = ['S', 'A', 'B', 'Other'];
  var disc = Number(_marginWhatIf) || 0;
  var eff = function(price) { return price * (1 - disc / 100); }; // ราคาหลังจำลองส่วนลด
  var sum = { S:{t:0,n:0}, A:{t:0,n:0}, B:{t:0,n:0}, Other:{t:0,n:0} };
  var withCost = 0;
  products.forEach(function(p) {
    if (Number(p.cost) > 0) withCost++;
    levels.forEach(function(lv) {
      var price = eff((p.typePrices && Number(p.typePrices[lv])) || 0);
      var cost = Number(p.cost) || 0;
      if (price > 0 && cost > 0) { sum[lv].t += (price - cost) / price * 100; sum[lv].n++; }
    });
  });

  var h = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">';
  h += '<button class="btn bsm bo" onclick="exportProductsMargin()">📥 Export Excel</button>';
  h += '<span style="font-size:12px;color:var(--text2)">💡 จำลองส่วนลด <input type="number" min="0" max="100" value="' + disc + '" onchange="_marginWhatIf=parseFloat(this.value)||0;renderProductsList()" style="width:56px;text-align:right;padding:2px 4px">%</span>';
  h += '<span style="font-size:12px;color:var(--text2)">มีต้นทุน ' + withCost + '/' + products.length + ' • กำไรเฉลี่ย' + (disc ? ' (หลังลด ' + disc + '%)' : '') + ': ' +
    levels.map(function(lv) { var a = sum[lv].n ? (sum[lv].t / sum[lv].n) : 0; return lv + ' ' + a.toFixed(1) + '%'; }).join(' | ') + '</span></div>';

  h += '<table class="export-table" id="productsMarginTable" style="width:100%;font-size:12px"><thead><tr>';
  h += '<th>#</th><th>ชื่อสินค้า</th><th style="text-align:right">ต้นทุน</th>';
  levels.forEach(function(lv) { h += '<th style="text-align:right">' + lv + '</th>'; });
  h += '<th style="text-align:right">RRP</th></tr></thead><tbody>';

  products.forEach(function(p, i) {
    var cost = Number(p.cost) || 0;
    var noCost = cost <= 0;
    h += '<tr' + (noCost ? ' style="background:rgba(127,127,127,.06)"' : '') + '>';
    h += '<td style="text-align:center">' + (i + 1) + '</td>';
    h += '<td style="font-weight:600">' + sanitize(p.name) + (noCost ? ' <span style="font-size:10px;color:#f59e0b">⚠️ ยังไม่มีต้นทุน</span>' : '') + '</td>';
    h += '<td style="text-align:right;color:#f59e0b">' + (cost ? fmtMoney(cost) : '-') + '</td>';
    levels.forEach(function(lv) {
      var listPrice = (p.typePrices && Number(p.typePrices[lv])) || 0;
      var price = eff(listPrice); // ราคาหลังส่วนลดจำลอง
      var m = (price > 0 && cost > 0) ? (price - cost) / price * 100 : null;
      var profit = price > 0 ? price - cost : 0;
      h += '<td style="text-align:right">';
      if (listPrice > 0) {
        h += '<div>' + fmtMoney(disc ? Math.round(price) : listPrice) + (disc ? ' <span style="font-size:9px;color:var(--text2)">-' + disc + '%</span>' : '') + '</div>';
        if (cost > 0) h += '<div style="font-size:10px;color:' + _marginColor(m) + '">' + (profit >= 0 ? '+' : '') + fmtMoneyShort(profit) + ' • ' + m.toFixed(1) + '%</div>';
      } else { h += '<span style="color:var(--text2)">-</span>'; }
      h += '</td>';
    });
    var rrp = Number(p.rrpExVat) || Number(p.price) || 0;
    h += '<td style="text-align:right;color:var(--text2)">' + (rrp ? fmtMoney(rrp) : '-') + '</td></tr>';
  });
  h += '</tbody></table>';
  wrap.innerHTML = h;
}

function _marginFilteredProducts() {
  var prods = getAllProducts();
  var q = productSearch, cat = productCategoryFilter, typ = productTypeFilter;
  if (q) prods = prods.filter(function(p) { return (p.name||'').toLowerCase().indexOf(q)!==-1||(p.sku||'').toLowerCase().indexOf(q)!==-1||(p.ean||'').toLowerCase().indexOf(q)!==-1; });
  if (cat !== 'all') prods = prods.filter(function(p) { return p.category === cat; });
  if (typ === 'main') prods = prods.filter(function(p) { return !isDemoProduct(p); });
  else if (typ === 'demo') prods = prods.filter(function(p) { return isDemoProduct(p); });
  return prods;
}

function exportProductsMargin() {
  if (typeof XLSX === 'undefined') { toast('⚠️ โหลด XLSX ไม่สำเร็จ'); return; }
  var prods = _marginFilteredProducts();
  var levels = ['S', 'A', 'B', 'Other'];
  var head = ['SKU', 'ชื่อสินค้า', 'ต้นทุน'];
  levels.forEach(function(lv) { head.push(lv + ' ราคา', lv + ' กำไร%'); });
  head.push('RRP Ex VAT');
  var rows = [head];
  prods.forEach(function(p) {
    var cost = Number(p.cost) || 0;
    var r = [p.sku || '', p.name || '', cost || ''];
    levels.forEach(function(lv) {
      var price = (p.typePrices && Number(p.typePrices[lv])) || 0;
      var m = (price > 0 && cost > 0) ? ((price - cost) / price * 100) : '';
      r.push(price || '', m === '' ? '' : Number(m.toFixed(1)));
    });
    r.push(Number(p.rrpExVat) || Number(p.price) || '');
    rows.push(r);
  });
  var ws = XLSX.utils.aoa_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Margin');
  XLSX.writeFile(wb, 'product-margin-' + _td() + '.xlsx');
  toast('📥 Export Margin แล้ว (' + prods.length + ' รายการ)');
}

function renderProductsCatalog(products) {
  var grid = document.getElementById('productsCatalogGrid');
  if (!grid) return;
  var html = '';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var catIcon = getCategoryIcon(p.category) || '📦';
    var imgContent;
    if (p.imageUrl) {
      imgContent = '<img src="' + sanitize(p.imageUrl) + '" alt="' + sanitize(p.name) + '" style="width:100%;height:100%;object-fit:contain;padding:10px" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">' +
                   '<div class="prod-card-nopic" style="display:none"><span style="font-size:28px">' + catIcon + '</span></div>';
    } else {
      imgContent = '<div class="prod-card-nopic"><span style="font-size:28px">' + catIcon + '</span></div>';
    }
    var statusTag = p.eol ? '<span class="tag tag-cancelled" style="position:absolute;top:5px;right:5px;font-size:10px;padding:2px 5px">EOL</span>' : '';
    var tp = p.typePrices || {};
    html += '<div class="prod-card" onclick="showProductDetailM(\'' + p.id + '\')">';
    html += '<div class="prod-card-img">' + imgContent + statusTag + '</div>';
    html += '<div class="prod-card-body">';
    html += '<div class="prod-card-name">' + sanitize(p.name) + '</div>';
    if (p.sku) html += '<div class="prod-card-sku">' + sanitize(p.sku) + '</div>';
    html += '<div class="prod-card-price">RRP ฿' + fmtMoney(p.rrpInVat || p.rrpExVat || p.price || 0) + '</div>';
    html += '<div class="prod-card-levels">';
    html += '<span><small>S</small>฿' + fmtMoney(tp.S || 0) + '</span>';
    html += '<span><small>A</small>฿' + fmtMoney(tp.A || 0) + '</span>';
    html += '<span><small>B</small>฿' + fmtMoney(tp.B || p.price || 0) + '</span>';
    html += '</div>';
    html += '</div></div>';
  }
  grid.innerHTML = html || '<div class="empty">ไม่พบสินค้า</div>';
}

function showProductDetailM(productId) {
  var p = getProductById(productId);
  if (!p) return;
  var catIcon = getCategoryIcon(p.category) || '📦';
  var catName = getCategoryName(p.category);
  var tp = p.typePrices || {};
  var statusBadge = p.eol
    ? '<span class="tag tag-cancelled">⏰ EOL</span>'
    : '<span class="tag tag-completed">✅ มีขาย</span>';
  if (isDemoProduct(p)) statusBadge += ' <span class="tag" style="background:#f59e0b;color:#fff">🎪 Demo</span>';

  var imgSection = '';
  if (p.imageUrl) {
    imgSection = '<div style="text-align:center;margin-bottom:14px"><img src="' + sanitize(p.imageUrl) + '" alt="' + sanitize(p.name) + '" style="max-height:180px;max-width:100%;object-fit:contain;border-radius:8px;border:1px solid var(--border)" onerror="this.style.display=\'none\'"></div>';
  } else {
    imgSection = '<div style="text-align:center;font-size:48px;margin-bottom:12px">' + catIcon + '</div>';
  }

  var html = '<div style="max-width:420px">';
  html += imgSection;
  html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">';
  html += '<div><strong style="font-size:15px">' + sanitize(p.name) + '</strong></div>';
  html += '<div style="white-space:nowrap">' + statusBadge + '</div>';
  html += '</div>';

  html += '<div class="prod-detail-row"><span>หมวดหมู่</span><span>' + catIcon + ' ' + sanitize(catName) + '</span></div>';
  if (p.sku) html += '<div class="prod-detail-row"><span>SKU</span><span style="font-family:monospace">' + sanitize(p.sku) + '</span></div>';
  if (p.ean) html += '<div class="prod-detail-row"><span>EAN</span><span style="font-family:monospace">' + sanitize(p.ean) + '</span></div>';

  html += '<div class="prod-detail-section">ราคา</div>';
  html += '<div class="prod-detail-row"><span>RRP in Vat</span><span>฿' + fmtMoney(p.rrpInVat || 0) + '</span></div>';
  html += '<div class="prod-detail-row"><span>RRP Ex Vat</span><span>฿' + fmtMoney(p.rrpExVat || 0) + '</span></div>';
  html += '<div class="prod-detail-row prod-price-s"><span>S (Type 1)</span><span>฿' + fmtMoney(tp.S || 0) + '</span></div>';
  html += '<div class="prod-detail-row prod-price-a"><span>A (Type 2)</span><span>฿' + fmtMoney(tp.A || 0) + '</span></div>';
  html += '<div class="prod-detail-row prod-price-b"><span>B (Type 3)</span><span>฿' + fmtMoney(tp.B || p.price || 0) + '</span></div>';
  html += '<div class="prod-detail-row"><span>Other (Type 4)</span><span>฿' + fmtMoney(tp.Other || 0) + '</span></div>';

  html += '<div class="fm-actions" style="margin-top:14px">';
  html += '<button class="btn btn-blue" onclick="closeMForce();showEditProductModal(\'' + p.id + '\')">✏️ แก้ไข</button>';
  html += '<button class="btn" onclick="closeM()">ปิด</button>';
  html += '</div></div>';

  openM(catIcon + ' ' + sanitize(p.name), html);
}

// ✅ ฟังก์ชัน isDemoProduct (ใช้สำหรับกรอง)
function isDemoProduct(product) {
  if (!product) return false;
  // เช็คจาก category
  if (product.category === 'demo' || product.category === 'demo_accessory') return true;
  // เช็คจากป้าย isDemo
  if (product.isDemo === true) return true;
  // เช็คจากชื่อ
  if (product.name && (product.name.indexOf('(Demo)') !== -1 || product.name.indexOf('Demo Unit') !== -1)) return true;
  return false;
}

function renderProductsTable(products) {
  var tbody = document.getElementById('productsTableBody');
  if (!tbody) return;
  var html = '';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var badge = '';
    if (p.eol) badge += '<span class="tag tag-cancelled">⏰ EOL</span>';
    else badge += '<span class="tag tag-completed">✅ มีขาย</span>';
    
    // ✅ เพิ่มป้าย Demo
    if (isDemoProduct(p)) badge += ' <span class="tag" style="background:#f59e0b;color:#fff">🎪 Demo</span>';
    if (p.isSoftware) badge += ' <span class="tag tag-active">💻 SW</span>';
    if (p.isService) badge += ' <span class="tag tag-on-hold">🛠️ SV</span>';
    if (p.isBundle) badge += ' <span class="tag tag-count">🎁 Bundle</span>';
    
    var categoryName = getCategoryName(p.category);
    var categoryIcon = getCategoryIcon(p.category);
    
    html += '<tr>';
    html += '<td class="pipe-row-num">' + (i+1) + '</td>';
    html += '<td>' + (p.sku ? qcopyHtml(p.sku) : '-') + '</td>';
    html += '<td>' + sanitize(p.ean || '-') + '</td>';
    html += '<td><strong>' + qcopyHtml(p.name) + '</strong></td>';
    html += '<td>' + categoryIcon + ' ' + sanitize(categoryName) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.rrpInVat) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.rrpExVat) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.typePrices?.S) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.typePrices?.A) + '</td>';
    html += '<td style="text-align:right">' + (p.typePrices?.B != null ? qcopyHtml(p.typePrices.B) : fmtMoney(p.typePrices?.B)) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.typePrices?.Other) + '</td>';
    html += '<td>' + badge + '</td>';
    html += '<td><button class="btn bsm bo" onclick="showEditProductModal(\'' + p.id + '\')">✏️</button> ' +
      '<button class="btn bsm bd" onclick="deleteProductConfirm(\'' + p.id + '\')">🗑️</button></td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}
function rProductPrices(el) {
  document.getElementById('pgT').textContent = '💰 ราคาตาม Level';
  var products = getAllProducts();
  
  if (priceSearch) {
    var q = priceSearch.toLowerCase();
    products = products.filter(function(p) {
      return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
             (p.sku || '').toLowerCase().indexOf(q) !== -1 ||
             (p.ean || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  if (priceCategoryFilter !== 'all') {
    products = products.filter(function(p) { return p.category === priceCategoryFilter; });
  }
  
  var html = '<div class="card"><h2>💰 ราคาสินค้าแยกตาม Level</h2>';
  
  html += '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
  html += '<input type="text" id="priceSearchInput" class="fm-input" placeholder="🔍 ค้นหาสินค้า (ชื่อ, SKU, EAN)" style="flex:1" value="' + sanitize(priceSearch) + '" oninput="priceSearch=this.value;renderPriceList()">';
  html += '<select id="priceCategorySelect" class="fm-input" style="width:150px" onchange="priceCategoryFilter=this.value;renderPriceList()">';
  html += '<option value="all" ' + (priceCategoryFilter === 'all' ? 'selected' : '') + '>📂 ทุกหมวด</option>';
  for (var i = 0; i < PRODUCT_CATEGORIES.length; i++) {
    var cat = PRODUCT_CATEGORIES[i];
    html += '<option value="' + cat.id + '" ' + (priceCategoryFilter === cat.id ? 'selected' : '') + '>' + cat.name + '</option>';
  }
  html += '</select>';
  html += '<button class="btn bsm bo" onclick="priceSearch=\'\';priceCategoryFilter=\'all\';renderPriceList()">✖️ ล้าง</button>';
  html += '</div>';
  
  html += '<div class="export-wrap"><table class="export-table"><thead><tr>';
  html += '<th>#</th><th>สินค้า</th><th>หมวดหมู่</th>';
  html += '<th>RRP in Vat</th><th>RRP Ex Vat</th>';
  html += '<th>S</th><th>A</th><th>B</th><th>Other</th>';
  html += '<th>EOL</th><th></th>';
  html += '</tr></thead><tbody id="priceTableBody"></tbody></table></div>';
  html += '<div class="bg" style="margin-top:12px"><button class="btn bp" onclick="saveAllProductPrices()">💾 บันทึกทั้งหมด</button></div>';
  html += '<div class="hint" style="margin-top:6px;text-align:right">พบ ' + products.length + ' รายการ</div>';
  html += '</div>';
  
  el.innerHTML = html;
  renderPriceTable(products);
  
  window.renderPriceList = function() {
    var newProducts = getAllProducts();
    var q = document.getElementById('priceSearchInput') ? document.getElementById('priceSearchInput').value.toLowerCase() : '';
    var cat = document.getElementById('priceCategorySelect') ? document.getElementById('priceCategorySelect').value : 'all';
    if (q) {
      newProducts = newProducts.filter(function(p) {
        return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
               (p.sku || '').toLowerCase().indexOf(q) !== -1 ||
               (p.ean || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (cat !== 'all') {
      newProducts = newProducts.filter(function(p) { return p.category === cat; });
    }
    priceSearch = q;
    priceCategoryFilter = cat;
    renderPriceTable(newProducts);
  };
}

function renderPriceTable(products) {
  var tbody = document.getElementById('priceTableBody');
  if (!tbody) return;
  var html = '';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var categoryName = getCategoryName(p.category);
    var categoryIcon = getCategoryIcon(p.category);
    
    html += '<tr>';
    html += '<td class="pipe-row-num">' + (i+1) + '</td>';
    html += '<td><strong>' + sanitize(p.name) + '</strong></td>';
    html += '<td>' + categoryIcon + ' ' + sanitize(categoryName) + '</td>';
    html += '<td><input type="text" inputmode="decimal" id="rrp_in_vat_' + p.id + '" value="' + nmI(p.rrpInVat || 0) + '" style="width:100px" class="fm-input js-money"></td>';
    html += '<td><input type="text" inputmode="decimal" id="rrp_ex_vat_' + p.id + '" value="' + nmI(p.rrpExVat || 0) + '" style="width:100px" class="fm-input js-money"></td>';
    html += '<td><input type="text" inputmode="decimal" id="price_s_' + p.id + '" value="' + nmI(p.typePrices?.S || 0) + '" style="width:90px" class="fm-input js-money"></td>';
    html += '<td><input type="text" inputmode="decimal" id="price_a_' + p.id + '" value="' + nmI(p.typePrices?.A || 0) + '" style="width:90px" class="fm-input js-money"></td>';
    html += '<td><input type="text" inputmode="decimal" id="price_b_' + p.id + '" value="' + nmI(p.price || 0) + '" style="width:90px" class="fm-input js-money"></td>';
    html += '<td><input type="text" inputmode="decimal" id="price_o_' + p.id + '" value="' + nmI(p.typePrices?.Other || 0) + '" style="width:90px" class="fm-input js-money"></td>';
    html += '<td style="text-align:center"><input type="checkbox" id="eol_chk_' + p.id + '" ' + (p.eol ? 'checked' : '') + ' onchange="toggleEOLFromPrice(\'' + p.id + '\', this.checked)"></td>';
    html += '<td><button class="btn bsm bp" onclick="saveSingleProductPrice(\'' + p.id + '\')">💾</button></td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

function toggleEOLFromPrice(productId, isChecked) {
  setProductEOL(productId, isChecked);
  toast(isChecked ? '⏰ ตั้งค่า EOL แล้ว' : '✅ ยกเลิก EOL แล้ว');
  if (typeof renderProductsList === 'function') renderProductsList();
}

function saveSingleProductPrice(id) {
  var rrpInVat = parseNum(document.getElementById('rrp_in_vat_' + id).value);
  var rrpExVat = parseNum(document.getElementById('rrp_ex_vat_' + id).value);
  var priceS = parseNum(document.getElementById('price_s_' + id).value);
  var priceA = parseNum(document.getElementById('price_a_' + id).value);
  var priceB = parseNum(document.getElementById('price_b_' + id).value);
  var priceO = parseNum(document.getElementById('price_o_' + id).value);
  var eolChk = document.getElementById('eol_chk_' + id);
  var eol = eolChk ? eolChk.checked : false;
  
  updateProduct(id, {
    rrpInVat: rrpInVat,
    rrpExVat: rrpExVat,
    price: priceB,
    typePrices: { S: priceS, A: priceA, B: priceB, Other: priceO },
    eol: eol
  });
  toast('💾 บันทึกแล้ว');
  render();
}

function saveAllProductPrices() {
  var products = getAllProducts();
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var rrpInVat = parseNum(document.getElementById('rrp_in_vat_' + p.id).value);
    var rrpExVat = parseNum(document.getElementById('rrp_ex_vat_' + p.id).value);
    var priceS = parseNum(document.getElementById('price_s_' + p.id).value);
    var priceA = parseNum(document.getElementById('price_a_' + p.id).value);
    var priceB = parseNum(document.getElementById('price_b_' + p.id).value);
    var priceO = parseNum(document.getElementById('price_o_' + p.id).value);
    var eolChk = document.getElementById('eol_chk_' + p.id);
    var eol = eolChk ? eolChk.checked : false;
    updateProduct(p.id, {
      rrpInVat: rrpInVat,
      rrpExVat: rrpExVat,
      price: priceB,
      typePrices: { S: priceS, A: priceA, B: priceB, Other: priceO },
      eol: eol
    });
  }
  toast('💾 บันทึกราคาทั้งหมดแล้ว');
  render();
}

function rProductBundles(el) {
  document.getElementById('pgT').textContent = '🎁 Bundle/Combo';
  var bundles = getAllBundles();
  var html = '<div class="card"><h2>🎁 Bundle/Combo <span class="ml"><button class="btn bp" onclick="showAddBundleM()">➕ เพิ่ม Bundle</button><button class="btn bo" onclick="exportBundlesToExcel()">📥 Export Excel</button></span></h2>';
  if (!bundles.length) {
    html += '<div class="empty"><p>ยังไม่มี Bundle/Combo</p><button class="btn bp" onclick="showAddBundleM()">➕ สร้าง Bundle แรก</button></div>';
  } else {
    for (var i = 0; i < bundles.length; i++) {
      var b = bundles[i];
      var statusBadge = b.enabled ? '<span class="tag tag-completed">✅ เปิดใช้งาน</span>' : '<span class="tag tag-cancelled">⏸ ปิดใช้งาน</span>';
      html += '<div class="card" style="margin-bottom:12px; border-left:4px solid var(--accent)">';
      html += '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap">';
      html += '<div><h3 style="margin:0">' + sanitize(b.name) + ' ' + statusBadge + '</h3>';
      if (b.description) html += '<div class="hint">' + sanitize(b.description) + '</div>';
      html += '</div>';
      html += '<div><button class="btn bsm bo" onclick="editBundle(\'' + b.id + '\')">✏️ แก้ไข</button> ';
      html += '<button class="btn bsm bd" onclick="deleteBundleConfirm(\'' + b.id + '\')">🗑️ ลบ</button></div>';
      html += '</div>';
      if (b.items && b.items.length) {
        html += '<div class="hint" style="margin-top:8px"><strong>สินค้าใน Bundle:</strong><ul>';
        for (var j = 0; j < b.items.length; j++) {
          var it = b.items[j];
          var prodName = it.name || (it.productId ? (getProductById(it.productId)?.name || '') : '');
          html += '<li>' + sanitize(prodName) + (it.qty > 1 ? ' x' + it.qty : '') + '</li>';
        }
        html += '</ul></div>';
      }
      html += '<div class="fr" style="margin-top:8px"><div>S: ' + fmtMoney(b.typePrices?.S) + '</div><div>A: ' + fmtMoney(b.typePrices?.A) + '</div><div>B: ' + fmtMoney(b.typePrices?.B) + '</div><div>Other: ' + fmtMoney(b.typePrices?.Other) + '</div></div>';
      html += '</div>';
    }
  }
  html += '</div>';
  el.innerHTML = html;
}

function rProductDemo(el) {
  document.getElementById('pgT').textContent = '🚁 Demo Unit';
  var demos = getAllDemoUnits();
  
  // ถ้าไม่มีข้อมูล ให้โหลดจาก Products module
  if (!demos.length && typeof Products !== 'undefined') {
    var allProducts = Products.getAll();
    var demoProducts = allProducts.filter(function(p) {
      return p.category === 'demo' || (p.name && p.name.includes('(Demo)'));
    });
    if (demoProducts.length) {
      demos = demoProducts.map(function(p) {
        return {
          id: p.id,
          sku: p.sku || '',
          ean: p.ean || '',
          productName: p.name,
          productId: p.id,
          price: p.demoPrice || p.price || 0,
          enabled: true,
          note: ''
        };
      });
    }
  }
  
  var html = '<div class="card"><h2>🚁 Demo Unit Pricing <span class="ml">' +
    '<button class="btn bp" onclick="showAddDemoUnitM()" style="background:#22c55e">➕ เพิ่ม Demo Unit</button>' +
    '<button class="btn bo" onclick="exportDemoUnitsToExcel()">📥 Export Excel</button>' +
    '<button class="btn bo" onclick="syncDemoFromProducts()">🔄 Sync จาก Products</button>' +
    '</span></h2>';
  
  // ปุ่มล้าง filter และค้นหา
  html += '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
    '<input type="text" id="demoSearchInput" class="fm-input" placeholder="🔍 ค้นหาสินค้า..." style="flex:1;min-width:150px" oninput="filterDemoList()">' +
    '<button class="btn bsm bo" onclick="resetDemoFilter()">✖️ ล้าง</button>' +
    '</div>';
  
  if (!demos.length) {
    html += '<div class="empty"><p>ยังไม่มี Demo Unit</p>' +
      '<div class="hint" style="margin-top:8px">💡 กด "Sync จาก Products" เพื่อโหลดข้อมูล Demo จากสินค้าที่มีอยู่<br>' +
      'หรือกด "➕ เพิ่ม Demo Unit" เพื่อเพิ่มทีละรายการ</div>' +
      '</div>';
  } else {
    html += '<div class="export-wrap" style="overflow-x:auto"><table class="export-table" id="demoTable">' +
      '<thead><tr>' +
      '<th style="width:40px">#</th>' +
      '<th>SKU</th>' +
      '<th>EAN</th>' +
      '<th>สินค้า</th>' +
      '<th style="text-align:right">ราคา Demo (฿)</th>' +
      '<th>สถานะ</th>' +
      '<th style="width:80px"></th>' +
      '</tr></thead>' +
      '<tbody id="demoTableBody"></tbody>' +
      '</table></div>';
  }
  
  html += '<div class="hint" style="margin-top:8px">💡 Demo Unit ที่เพิ่มแล้วจะแสดงในหน้า Dealer Detail → แท็บ Demo</div>';
  html += '</div>';
  
  el.innerHTML = html;
  
  if (demos.length) {
    renderDemoTable(demos);
  }
  
  // ฟังก์ชันกรอง
  window.filterDemoList = function() {
    var search = document.getElementById('demoSearchInput')?.value.toLowerCase() || '';
    var demos2 = getAllDemoUnits();
    if (!demos2.length && typeof Products !== 'undefined') {
      var allProducts = Products.getAll();
      demos2 = allProducts.filter(function(p) {
        return p.category === 'demo' || (p.name && p.name.includes('(Demo)'));
      }).map(function(p) {
        return {
          id: p.id,
          sku: p.sku || '',
          ean: p.ean || '',
          productName: p.name,
          price: p.demoPrice || p.price || 0,
          enabled: true
        };
      });
    }
    if (search) {
      demos2 = demos2.filter(function(d) {
        return (d.productName || '').toLowerCase().indexOf(search) !== -1 ||
               (d.sku || '').toLowerCase().indexOf(search) !== -1 ||
               (d.ean || '').toLowerCase().indexOf(search) !== -1;
      });
    }
    renderDemoTable(demos2);
  };
  
  window.resetDemoFilter = function() {
    var input = document.getElementById('demoSearchInput');
    if (input) input.value = '';
    filterDemoList();
  };
}

function renderDemoTable(demos) {
  var tbody = document.getElementById('demoTableBody');
  if (!tbody) return;
  
  var html = '';
  for (var i = 0; i < demos.length; i++) {
    var d = demos[i];
    html += '<tr>' +
      '<td class="pipe-row-num">' + (i + 1) + '</td>' +
      '<td>' + sanitize(d.sku || '-') + '</td>' +
      '<td>' + sanitize(d.ean || '-') + '</td>' +
      '<td><strong>' + sanitize(d.productName) + '</strong></td>' +
      '<td style="text-align:right;color:#22c55e;font-weight:700">' + fmtMoney(d.price) + '</td>' +
      '<td>' + (d.enabled !== false ? '<span class="tag tag-completed">✅ Active</span>' : '<span class="tag tag-cancelled">⏸ Inactive</span>') + '</td>' +
      '<td><button class="btn bsm bo" onclick="editDemoUnit(\'' + d.id + '\')">✏️</button> ' +
      '<button class="btn bsm bd" onclick="deleteDemoUnitConfirm(\'' + d.id + '\')">🗑️</button></td>' +
      '</tr>';
  }
  tbody.innerHTML = html;
}

// ฟังก์ชัน Sync Demo จาก Products
function syncDemoFromProducts() {
  if (typeof Products === 'undefined') {
    toast('❌ Products module ไม่พร้อม');
    return;
  }
  
  var allProducts = Products.getAll();
  var demoProducts = allProducts.filter(function(p) {
    return p.category === 'demo' || (p.name && p.name.includes('(Demo)'));
  });
  
  var existingDemos = getAllDemoUnits();
  var imported = 0;
  var updated = 0;
  
  demoProducts.forEach(function(p) {
    var existing = null;
    for (var i = 0; i < existingDemos.length; i++) {
      if (existingDemos[i].productId === p.id || existingDemos[i].sku === p.sku) {
        existing = existingDemos[i];
        break;
      }
    }
    
    var demoData = {
      productId: p.id,
      productName: p.name,
      sku: p.sku || '',
      ean: p.ean || '',
      price: p.demoPrice || p.price || 0,
      enabled: true,
      note: ''
    };
    
    if (existing) {
      updateDemoUnit(existing.id, demoData);
      updated++;
    } else {
      addDemoUnit(demoData);
      imported++;
    }
  });
  
  toast('✅ Sync เสร็จ! เพิ่ม ' + imported + ' รายการ, อัพเดท ' + updated + ' รายการ');
  render();
}

// แก้ไขฟังก์ชัน showAddDemoUnitM
function showAddDemoUnitM() {
  // ดึงรายการสินค้าทั้งหมดจาก Products module
  var products = [];
  if (typeof Products !== 'undefined') {
    products = Products.getAll();
  }
  
  var productOptions = '<option value="">-- เลือกสินค้า (หรือพิมพ์ค้นหา) --</option>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    productOptions += '<option value="' + p.id + '" data-name="' + sanitize(p.name) + '" data-sku="' + sanitize(p.sku || '') + '" data-ean="' + sanitize(p.ean || '') + '" data-price="' + (p.demoPrice || p.price || 0) + '">' + 
      sanitize(p.name) + ' (' + (p.sku || p.ean || '-') + ')' + '</option>';
  }
  
  var html = '<div style="max-width:500px">' +
    '<div class="fm-group"><label>🔍 เลือกสินค้า (พิมพ์ค้นหาได้)</label>' +
    '<input type="text" id="newDemoProductSearch" class="fm-input" list="productListDatalist" placeholder="พิมพ์ชื่อสินค้า..." autocomplete="off" onchange="selectDemoProduct()" oninput="filterProductForDemo()">' +
    '<datalist id="productListDatalist">' + productOptions + '</datalist>' +
    '<input type="hidden" id="newDemoProductId">' +
    '</div>' +
    '<div class="fm-group"><label>💰 ราคา Demo (฿)</label>' +
    '<input type="text" inputmode="decimal" id="newDemoPrice" class="fm-input js-money" placeholder="0.00">' +
    '</div>' +
    '<div class="fm-group"><label>📝 หมายเหตุ</label>' +
    '<textarea id="newDemoNote" rows="2" class="fm-input" placeholder="หมายเหตุเพิ่มเติม..."></textarea>' +
    '</div>' +
    '<div class="fm-actions">' +
    '<button class="btn btn-blue" onclick="saveNewDemoUnit()">💾 บันทึก</button>' +
    '<button class="btn" onclick="closeM()">ยกเลิก</button>' +
    '</div></div>';
  
  openM('➕ เพิ่ม Demo Unit', html);
}

function filterProductForDemo() {
  var search = document.getElementById('newDemoProductSearch')?.value.toLowerCase() || '';
  var datalist = document.getElementById('productListDatalist');
  if (!datalist) return;
  
  var options = datalist.querySelectorAll('option');
  for (var i = 0; i < options.length; i++) {
    var opt = options[i];
    if (opt.value && opt.value.toLowerCase().indexOf(search) !== -1) {
      opt.style.display = '';
    } else if (opt.value) {
      opt.style.display = 'none';
    }
  }
}

function selectDemoProduct() {
  var input = document.getElementById('newDemoProductSearch');
  var selectedName = input.value;
  var datalist = document.getElementById('productListDatalist');
  var options = datalist.querySelectorAll('option');
  
  for (var i = 0; i < options.length; i++) {
    var opt = options[i];
    if (opt.value === selectedName) {
      document.getElementById('newDemoProductId').value = opt.value;
      var price = parseFloat(opt.getAttribute('data-price')) || 0;
      document.getElementById('newDemoPrice').value = nmI(price);
      break;
    }
  }
}

function saveNewDemoUnit() {
  var productId = document.getElementById('newDemoProductId').value;
  var productName = document.getElementById('newDemoProductSearch').value.trim();
  var price = parseNum(document.getElementById('newDemoPrice').value);
  var note = document.getElementById('newDemoNote').value.trim();
  
  if (!productId && !productName) {
    toast('⚠️ กรุณาเลือกสินค้า');
    return;
  }
  
  // หาข้อมูลสินค้า
  var sku = '', ean = '';
  if (typeof Products !== 'undefined') {
    var product = Products.getById(productId) || Products.getByName(productName);
    if (product) {
      sku = product.sku || '';
      ean = product.ean || '';
      if (!price) price = product.demoPrice || product.price || 0;
    }
  }
  
  addDemoUnit({
    productId: productId,
    productName: productName,
    sku: sku,
    ean: ean,
    price: price,
    enabled: true,
    note: note
  });
  
  closeMForce();
  toast('✅ เพิ่ม Demo Unit แล้ว');
  render();
}

function deleteDemoUnitConfirm(id) {
  if (confirm('ลบ Demo Unit นี้?')) {
    deleteDemoUnit(id);
    toast('🗑️ ลบแล้ว');
    render();
  }
}

function editDemoUnit(id) {
  var demo = getDemoUnitById(id);
  if (!demo) return;
  
  var html = '<div style="max-width:500px">' +
    '<div class="fm-group"><label>📦 ชื่อสินค้า</label>' +
    '<input type="text" id="editDemoName" class="fm-input" value="' + sanitize(demo.productName) + '">' +
    '</div>' +
    '<div class="fm-group"><label>💰 ราคา Demo (฿)</label>' +
    '<input type="text" inputmode="decimal" id="editDemoPrice" class="fm-input js-money" value="' + nmI(demo.price) + '">' +
    '</div>' +
    '<div class="fm-group"><label>📝 หมายเหตุ</label>' +
    '<textarea id="editDemoNote" rows="2" class="fm-input">' + sanitize(demo.note || '') + '</textarea>' +
    '</div>' +
    '<div class="fm-group"><label>📊 สถานะ</label>' +
    '<select id="editDemoStatus" class="fm-input">' +
    '<option value="true" ' + (demo.enabled !== false ? 'selected' : '') + '>✅ Active</option>' +
    '<option value="false" ' + (demo.enabled === false ? 'selected' : '') + '>⏸ Inactive</option>' +
    '</select>' +
    '</div>' +
    '<div class="fm-actions">' +
    '<button class="btn btn-blue" onclick="saveEditDemoUnit(\'' + id + '\')">💾 บันทึก</button>' +
    '<button class="btn" onclick="closeM()">ยกเลิก</button>' +
    '</div></div>';
  
  openM('✏️ แก้ไข Demo Unit', html);
}

function saveEditDemoUnit(id) {
  var name = document.getElementById('editDemoName').value.trim();
  var price = parseNum(document.getElementById('editDemoPrice').value);
  var note = document.getElementById('editDemoNote').value.trim();
  var enabled = document.getElementById('editDemoStatus').value === 'true';
  
  if (!name) {
    toast('⚠️ กรุณาใส่ชื่อสินค้า');
    return;
  }
  
  updateDemoUnit(id, {
    productName: name,
    price: price,
    note: note,
    enabled: enabled
  });
  
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}
function rProductImport(el) {
  document.getElementById('pgT').textContent = '📥 Import/Export สินค้า';
  var html = '';
  html += '<div class="card"><h2>📤 Export ข้อมูล</h2><div class="bg"><button class="btn bp" onclick="exportProductsToExcel()">📦 Export สินค้าทั้งหมด</button><button class="btn bo" onclick="exportBundlesToExcel()">🎁 Export Bundles</button><button class="btn bo" onclick="exportDemoUnitsToExcel()">🚁 Export Demo Units</button></div></div>';
  html += '<div class="card"><h2>🚀 นำเข้าข้อมูลทั้งหมด (ครั้งเดียวจบ)</h2><div class="fg"><input type="file" id="importFullFile" accept=".xlsx,.xls"><button class="btn bp" onclick="doImportFullExcel()">📤 นำเข้าทั้งหมด</button></div><div id="importFullProgress" style="display:none"><div class="pb"><div class="pf pf-blue" style="width:0%"></div></div><div id="importFullStatus"></div></div></div>';
  html += '<div class="card"><h2>⚠️ การจัดการข้อมูล</h2><div class="bg"><button class="btn bd" onclick="clearAllProductsData()">🗑️ ลบข้อมูลทั้งหมด (สินค้า, Bundle, Demo)</button></div><div class="hint">เมื่อลบแล้วไม่สามารถกู้คืนได้ ยกเว้นมีข้อมูลใน Firebase และล็อกอินอยู่</div></div>';
  html += '<div class="card"><h2>📋 คำแนะนำ</h2><div class="hint">1. กด Export เพื่อดาวน์โหลดไฟล์ Excel สำหรับแก้ไข<br>2. แก้ไขข้อมูลใน Excel (ห้ามเปลี่ยนชื่อคอลัมน์)<br>3. บันทึกแล้วใช้ปุ่ม นำเข้าทั้งหมด เพื่ออัปเดต</div></div>';
  el.innerHTML = html;
}

// ================================================================
// HELPER หมวดหมู่
// ================================================================

function getCategoryName(catId) {
  var cat = PRODUCT_CATEGORIES.find(function(c) { return c.id === catId; });
  return cat ? cat.name : '📦 Other';
}

function getCategoryIcon(catId) {
  var cat = PRODUCT_CATEGORIES.find(function(c) { return c.id === catId; });
  return cat ? cat.icon : '📦';
}

// ================================================================
// ฟังก์ชันอื่นๆ (placeholder)
// ================================================================

function showAddProductM() {
  var categoryOptions = '';
  for (var i = 0; i < PRODUCT_CATEGORIES.length; i++) {
    var cat = PRODUCT_CATEGORIES[i];
    categoryOptions += '<option value="' + cat.id + '">' + cat.name + '</option>';
  }
  
  var html = '<div style="max-width:550px">' +
    '<div class="form-section">📋 ข้อมูลทั่วไป</div>' +
    '<div class="fg"><label>ชื่อสินค้า *</label><input type="text" id="new_p_name" class="fm-input"></div>' +
    '<div class="fr"><div class="fg"><label>SKU (SiS part)</label><input type="text" id="new_p_sku" class="fm-input"></div>' +
    '<div class="fg"><label>EAN</label><input type="text" id="new_p_ean" class="fm-input"></div></div>' +
    
    '<div class="form-section">💰 ราคา</div>' +
    '<div class="fr"><div class="fg"><label>RRP in Vat (฿)</label><input type="text" inputmode="decimal" id="new_rrp_in" class="fm-input js-money" value="0.00"></div>' +
    '<div class="fg"><label>RRP Ex Vat (฿)</label><input type="text" inputmode="decimal" id="new_rrp_ex" class="fm-input js-money" value="0.00"></div></div>' +
    '<div class="fr4">' +
    '<div class="fg"><label>S (Type 1)</label><input type="text" inputmode="decimal" id="new_price_s" class="fm-input js-money" value="0.00"></div>' +
    '<div class="fg"><label>A (Type 2)</label><input type="text" inputmode="decimal" id="new_price_a" class="fm-input js-money" value="0.00"></div>' +
    '<div class="fg"><label>B (Type 3)</label><input type="text" inputmode="decimal" id="new_price_b" class="fm-input js-money" value="0.00"></div>' +
    '<div class="fg"><label>Other (Type 4)</label><input type="text" inputmode="decimal" id="new_price_o" class="fm-input js-money" value="0.00"></div></div>' +
    
    '<div class="form-section">🏷️ หมวดหมู่และสถานะ</div>' +
    '<div class="fr"><div class="fg"><label>หมวดหมู่</label><select id="new_category" class="fm-input">' + categoryOptions + '</select></div>' +
    '<div class="fg"><label>⚡ สถานะ EOL</label><div class="radio-g">' +
    '<label><input type="radio" name="new_eol" value="0" checked><span>✅ ปกติ</span></label>' +
    '<label><input type="radio" name="new_eol" value="1"><span>⏰ EOL</span></label>' +
    '</div></div></div>' +
    
    '<div class="form-section">🔧 ประเภทสินค้า (สำหรับระบบ)</div>' +
    '<div class="fr">' +
    '<div class="fg"><label><input type="checkbox" id="new_is_bundle"> 🎁 Bundle/Combo</label></div>' +
    '<div class="fg"><label><input type="checkbox" id="new_is_software"> 💻 Software</label></div>' +
    '<div class="fg"><label><input type="checkbox" id="new_is_service"> 🛠️ Service</label></div>' +
    '<div class="fg"><label><input type="checkbox" id="new_is_demo"> 🎪 Demo Unit</label></div>' +  // ✅ เพิ่ม checkbox Demo
    '</div>' +
    
    '<div class="form-section">🖼️ รูปภาพสินค้า</div>' +
    '<div class="fg"><label>URL รูปภาพ (Direct link)</label><input type="url" id="new_image_url" class="fm-input" placeholder="https://..."></div>' +
    '<div class="fm-actions" style="margin-top:16px">' +
    '<button class="btn btn-blue" onclick="addProductFromModal()">💾 บันทึก</button>' +
    '<button class="btn" onclick="closeM()">ยกเลิก</button>' +
    '</div></div>';

  openM('➕ เพิ่มสินค้า', html);
}

function addProductFromModal() {
  var name = document.getElementById('new_p_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  
  var isDemo = document.getElementById('new_is_demo') ? document.getElementById('new_is_demo').checked : false;
  var selectedCategory = document.getElementById('new_category').value;
  
  // ถ้าเลือก isDemo ให้เปลี่ยนหมวดหมู่เป็น demo โดยอัตโนมัติ
  var category = selectedCategory;
  if (isDemo && (selectedCategory === 'drone' || selectedCategory === 'payload' || selectedCategory === 'other')) {
    category = 'demo';
  }
  
  var productData = {
    name: name,
    sku: document.getElementById('new_p_sku').value.trim(),
    ean: document.getElementById('new_p_ean').value.trim(),
    category: category,
    rrpInVat: parseNum(document.getElementById('new_rrp_in').value),
    rrpExVat: parseNum(document.getElementById('new_rrp_ex').value),
    price: parseNum(document.getElementById('new_price_b').value),
    typePrices: {
      S: parseNum(document.getElementById('new_price_s').value),
      A: parseNum(document.getElementById('new_price_a').value),
      B: parseNum(document.getElementById('new_price_b').value),
      Other: parseNum(document.getElementById('new_price_o').value)
    },
    eol: document.querySelector('input[name="new_eol"]:checked')?.value === '1',
    isBundle: document.getElementById('new_is_bundle').checked,
    isSoftware: document.getElementById('new_is_software').checked,
    isService: document.getElementById('new_is_service').checked,
    isDemo: isDemo,
    imageUrl: document.getElementById('new_image_url') ? document.getElementById('new_image_url').value.trim() : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  Products.add(productData);
  closeMForce();
  toast('✅ เพิ่มสินค้าเรียบร้อย');
  render();
}
function exportMainProductsToExcel() {
  var products = getMainProducts();
  exportProductsToExcelWithData(products, 'main-products');
}

function exportDemoProductsToExcel() {
  var products = getDemoProducts();
  exportProductsToExcelWithData(products, 'demo-products');
}

function exportProductsToExcelWithData(products, filename) {
  var data = products.map(function(p, idx) {
    return {
      '#': idx + 1,
      'SiS part': p.sku || '',
      'EAN': p.ean || '',
      'Product Name': p.name,
      'RRP in Vat': p.rrpInVat || 0,
      'RRP Ex Vat': p.rrpExVat || 0,
      'Type 1 (S)': p.typePrices?.S || 0,
      'Type 2 (A)': p.typePrices?.A || 0,
      'Type 3 (B)': p.typePrices?.B || 0,
      'Type 4 (Other)': p.typePrices?.Other || 0,
      'EOL': p.eol ? 'EOL' : '',
      'Type': p.isSoftware ? 'Software' : (p.isService ? 'Service' : (p.isBundle ? 'Bundle' : 'Hardware')),
      'Category': getCategoryName(p.category),
      'Is Demo': isDemoProduct(p) ? 'Yes' : 'No'
    };
  });
  var ws = XLSX.utils.json_to_sheet(data);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, filename);
  XLSX.writeFile(wb, filename + '-' + _td() + '.xlsx');
  toast('📥 Export ' + filename + ' สำเร็จ!');
}
function showAddBundleM() {
  // ดึงรายการสินค้าทั้งหมดมาให้เลือกประกอบ Bundle
  var products = getAllProducts();
  var productOptions = '<option value="">-- เลือกสินค้า --</option>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    productOptions += '<option value="' + p.id + '" data-name="' + sanitize(p.name) + '" data-price="' + (p.price || 0) + '">' + 
      sanitize(p.name) + ' (' + fmtMoney(p.price) + ')</option>';
  }
  
  var html = '<div style="max-width:550px">' +
    '<div class="fg"><label>🎁 ชื่อ Bundle *</label><input type="text" id="bundle_name" class="fm-input"></div>' +
    '<div class="fg"><label>📝 รายละเอียด</label><textarea id="bundle_desc" rows="2" class="fm-input"></textarea></div>' +
    '<div class="form-section">📦 สินค้าใน Bundle</div>' +
    '<div id="bundleItemsList">' +
    '<div class="bundle-item-row" style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">' +
    '<select class="bundle-product" style="flex:2;padding:8px;border-radius:8px">' + productOptions + '</select>' +
    '<input type="number" class="bundle-qty" value="1" min="1" style="width:80px;padding:8px;border-radius:8px" placeholder="จำนวน">' +
    '<button class="btn bsm bd" onclick="removeBundleItemRow(this)">🗑️</button>' +
    '</div></div>' +
    '<button class="btn bsm bp" onclick="addBundleItemRow()" style="margin-bottom:12px">➕ เพิ่มสินค้า</button>' +
    '<div class="form-section">💰 ราคา (ตาม Level)</div>' +
    '<div class="fr4">' +
    '<div class="fg"><label>S</label><input type="text" inputmode="decimal" id="bundle_price_s" class="fm-input js-money" value="0.00"></div>' +
    '<div class="fg"><label>A</label><input type="text" inputmode="decimal" id="bundle_price_a" class="fm-input js-money" value="0.00"></div>' +
    '<div class="fg"><label>B</label><input type="text" inputmode="decimal" id="bundle_price_b" class="fm-input js-money" value="0.00"></div>' +
    '<div class="fg"><label>Other</label><input type="text" inputmode="decimal" id="bundle_price_o" class="fm-input js-money" value="0.00"></div></div>' +
    '<div class="fm-actions"><button class="btn btn-blue" onclick="saveNewBundle()">💾 บันทึก</button><button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
  
  openM('🎁 เพิ่ม Bundle/Combo', html);
}

function addBundleItemRow() {
  var products = getAllProducts();
  var productOptions = '<option value="">-- เลือกสินค้า --</option>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    productOptions += '<option value="' + p.id + '" data-name="' + sanitize(p.name) + '" data-price="' + (p.price || 0) + '">' + 
      sanitize(p.name) + ' (' + fmtMoney(p.price) + ')</option>';
  }
  
  var container = document.getElementById('bundleItemsList');
  var newRow = '<div class="bundle-item-row" style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">' +
    '<select class="bundle-product" style="flex:2;padding:8px;border-radius:8px">' + productOptions + '</select>' +
    '<input type="number" class="bundle-qty" value="1" min="1" style="width:80px;padding:8px;border-radius:8px">' +
    '<button class="btn bsm bd" onclick="removeBundleItemRow(this)">🗑️</button>' +
    '</div>';
  container.insertAdjacentHTML('beforeend', newRow);
}

function removeBundleItemRow(btn) {
  var row = btn.closest('.bundle-item-row');
  if (row && document.querySelectorAll('.bundle-item-row').length > 1) {
    row.remove();
  } else {
    toast('ต้องมีสินค้าอย่างน้อย 1 รายการ');
  }
}

function saveNewBundle() {
  var name = document.getElementById('bundle_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อ Bundle'); return; }
  
  var items = [];
  var rows = document.querySelectorAll('#bundleItemsList .bundle-item-row');
  for (var i = 0; i < rows.length; i++) {
    var select = rows[i].querySelector('.bundle-product');
    var qty = rows[i].querySelector('.bundle-qty').value;
    if (select && select.value) {
      items.push({
        productId: select.value,
        name: select.options[select.selectedIndex]?.text.split(' (')[0] || '',
        qty: parseInt(qty) || 1
      });
    }
  }
  
  if (items.length === 0) { toast('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
  
  addBundle({
    name: name,
    description: document.getElementById('bundle_desc').value.trim(),
    items: items,
    typePrices: {
      S: parseNum(document.getElementById('bundle_price_s').value),
      A: parseNum(document.getElementById('bundle_price_a').value),
      B: parseNum(document.getElementById('bundle_price_b').value),
      Other: parseNum(document.getElementById('bundle_price_o').value)
    },
    enabled: true
  });
  
  closeMForce();
  toast('✅ เพิ่ม Bundle แล้ว');
  render();
}
function editBundle(id) {
  var bundle = getBundleById(id);
  if (!bundle) { toast('ไม่พบ Bundle'); return; }
  
  var products = getAllProducts();
  var productOptions = '<option value="">-- เลือกสินค้า --</option>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    productOptions += '<option value="' + p.id + '" data-name="' + sanitize(p.name) + '" data-price="' + (p.price || 0) + '">' + 
      sanitize(p.name) + ' (' + fmtMoney(p.price) + ')</option>';
  }
  
  var itemsHtml = '';
  for (var i = 0; i < (bundle.items || []).length; i++) {
    var it = bundle.items[i];
    itemsHtml += '<div class="bundle-item-row" style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">' +
      '<select class="bundle-product" style="flex:2;padding:8px;border-radius:8px">' + productOptions + '</select>' +
      '<input type="number" class="bundle-qty" value="' + (it.qty || 1) + '" min="1" style="width:80px;padding:8px;border-radius:8px">' +
      '<button class="btn bsm bd" onclick="removeBundleItemRow(this)">🗑️</button>' +
      '</div>';
  }
  if (itemsHtml === '') {
    itemsHtml = '<div class="bundle-item-row" style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">' +
      '<select class="bundle-product" style="flex:2;padding:8px;border-radius:8px">' + productOptions + '</select>' +
      '<input type="number" class="bundle-qty" value="1" min="1" style="width:80px;padding:8px;border-radius:8px">' +
      '<button class="btn bsm bd" onclick="removeBundleItemRow(this)">🗑️</button>' +
      '</div>';
  }
  
  var html = '<div style="max-width:550px">' +
    '<div class="fg"><label>🎁 ชื่อ Bundle *</label><input type="text" id="bundle_name" class="fm-input" value="' + sanitize(bundle.name) + '"></div>' +
    '<div class="fg"><label>📝 รายละเอียด</label><textarea id="bundle_desc" rows="2" class="fm-input">' + sanitize(bundle.description || '') + '</textarea></div>' +
    '<div class="form-section">📦 สินค้าใน Bundle</div>' +
    '<div id="bundleItemsList">' + itemsHtml + '</div>' +
    '<button class="btn bsm bp" onclick="addBundleItemRow()" style="margin-bottom:12px">➕ เพิ่มสินค้า</button>' +
    '<div class="form-section">💰 ราคา (ตาม Level)</div>' +
    '<div class="fr4">' +
    '<div class="fg"><label>S</label><input type="text" inputmode="decimal" id="bundle_price_s" class="fm-input js-money" value="' + nmI(bundle.typePrices?.S || 0) + '"></div>' +
    '<div class="fg"><label>A</label><input type="text" inputmode="decimal" id="bundle_price_a" class="fm-input js-money" value="' + nmI(bundle.typePrices?.A || 0) + '"></div>' +
    '<div class="fg"><label>B</label><input type="text" inputmode="decimal" id="bundle_price_b" class="fm-input js-money" value="' + nmI(bundle.typePrices?.B || 0) + '"></div>' +
    '<div class="fg"><label>Other</label><input type="text" inputmode="decimal" id="bundle_price_o" class="fm-input js-money" value="' + nmI(bundle.typePrices?.Other || 0) + '"></div></div>' +
    '<div class="fm-actions"><button class="btn btn-blue" onclick="updateBundleFromModal(\'' + id + '\')">💾 อัปเดต</button><button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';

  openM('✏️ แก้ไข Bundle', html);
}

// ⚠️ เคยชื่อ updateBundle(id) ซ้ำกับ updateBundle(bundleId, updates) ที่เก็บข้อมูลจริง (บรรทัด ~706)
// ทำให้เรียกตัวเองวนไม่รู้จบ (recursion) และไม่เคยบันทึกอะไรเลย — เปลี่ยนชื่อกันชนกัน ตามแพทเทิร์นเดียวกับ
// editDemoUnit/updateDemoUnitFromModal ที่ทำถูกไว้แล้ว (พบ 2026-07-19 ตอนไล่ตรวจฟังก์ชันชื่อซ้ำทั้งโปรเจกต์)
function updateBundleFromModal(id) {
  var name = document.getElementById('bundle_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อ Bundle'); return; }
  
  var items = [];
  var rows = document.querySelectorAll('#bundleItemsList .bundle-item-row');
  for (var i = 0; i < rows.length; i++) {
    var select = rows[i].querySelector('.bundle-product');
    var qty = rows[i].querySelector('.bundle-qty').value;
    if (select && select.value) {
      items.push({
        productId: select.value,
        name: select.options[select.selectedIndex]?.text.split(' (')[0] || '',
        qty: parseInt(qty) || 1
      });
    }
  }
  
  if (items.length === 0) { toast('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
  
  updateBundle(id, {
    name: name,
    description: document.getElementById('bundle_desc').value.trim(),
    items: items,
    typePrices: {
      S: parseNum(document.getElementById('bundle_price_s').value),
      A: parseNum(document.getElementById('bundle_price_a').value),
      B: parseNum(document.getElementById('bundle_price_b').value),
      Other: parseNum(document.getElementById('bundle_price_o').value)
    }
  });
  
  closeMForce();
  toast('💾 อัปเดต Bundle แล้ว');
  render();
}
function deleteBundleConfirm(id) { if (confirm('ลบ Bundle นี้?')) { deleteBundle(id); toast('🗑️ ลบแล้ว'); render(); } }
function showAddDemoUnitM() {
  var html = '<div style="max-width:500px">' +
    '<div class="fg"><label>📝 ชื่อสินค้า Demo *</label>' +
    '<input type="text" id="demo_name" class="fm-input" placeholder="เช่น DJI Matrice 4E (Demo)"></div>' +
    '<div class="fr">' +
    '<div class="fg"><label>🔢 SKU</label><input type="text" id="demo_sku" class="fm-input" placeholder="(ถ้ามี)"></div>' +
    '<div class="fg"><label>🔢 EAN</label><input type="text" id="demo_ean" class="fm-input" placeholder="(ถ้ามี)"></div>' +
    '</div>' +
    '<div class="fg"><label>💰 ราคา Demo (฿)</label>' +
    '<input type="text" inputmode="decimal" id="demo_price" class="fm-input js-money" value="0.00">' +
    '</div>' +
    '<div class="fg"><label>📝 หมายเหตุ</label>' +
    '<textarea id="demo_note" rows="2" class="fm-input" placeholder="หมายเหตุเพิ่มเติม..."></textarea>' +
    '</div>' +
    '<div class="fm-actions">' +
    '<button class="btn btn-blue" onclick="saveNewDemoUnit()">💾 บันทึก</button>' +
    '<button class="btn" onclick="closeM()">ยกเลิก</button>' +
    '</div></div>';

  openM('➕ เพิ่ม Demo Unit', html);
}

function saveNewDemoUnit() {
  var name = document.getElementById('demo_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }

  var sku = document.getElementById('demo_sku').value.trim();
  var ean = document.getElementById('demo_ean').value.trim();
  var price = parseNum(document.getElementById('demo_price').value) || 0;
  var note = document.getElementById('demo_note').value.trim();

  addDemoUnit({
    productName: name,
    sku: sku,
    ean: ean,
    price: price,
    note: note,
    enabled: true
  });
  toast('✅ เพิ่ม Demo Unit แล้ว');

  closeMForce();
  render();
}

function editDemoUnit(id) {
  var demo = getDemoUnitById(id);
  if (!demo) { toast('ไม่พบ Demo Unit'); return; }

  var html = '<div style="max-width:500px">' +
    '<div class="fg"><label>📝 ชื่อสินค้า Demo *</label>' +
    '<input type="text" id="edit_demo_name" class="fm-input" value="' + sanitize(demo.productName || '') + '"></div>' +
    '<div class="fr">' +
    '<div class="fg"><label>🔢 SKU</label><input type="text" id="edit_demo_sku" class="fm-input" value="' + sanitize(demo.sku || '') + '"></div>' +
    '<div class="fg"><label>🔢 EAN</label><input type="text" id="edit_demo_ean" class="fm-input" value="' + sanitize(demo.ean || '') + '"></div>' +
    '</div>' +
    '<div class="fg"><label>💰 ราคา Demo (฿)</label>' +
    '<input type="text" inputmode="decimal" id="edit_demo_price" class="fm-input js-money" value="' + nmI(demo.price || 0) + '">' +
    '</div>' +
    '<div class="fg"><label>📝 หมายเหตุ</label>' +
    '<textarea id="edit_demo_note" rows="2" class="fm-input">' + sanitize(demo.note || '') + '</textarea>' +
    '</div>' +
    '<div class="fg"><label>📊 สถานะ</label>' +
    '<select id="edit_demo_status" class="fm-input">' +
    '<option value="true" ' + (demo.enabled !== false ? 'selected' : '') + '>✅ Active</option>' +
    '<option value="false" ' + (demo.enabled === false ? 'selected' : '') + '>⏸ Inactive</option>' +
    '</select>' +
    '</div>' +
    '<div class="fm-actions">' +
    '<button class="btn btn-blue" onclick="updateDemoUnitFromModal(\'' + id + '\')">💾 บันทึก</button>' +
    '<button class="btn bd" onclick="deleteDemoUnitConfirm(\'' + id + '\')">🗑️ ลบ</button>' +
    '<button class="btn" onclick="closeM()">ยกเลิก</button>' +
    '</div></div>';

  openM('✏️ แก้ไข Demo Unit', html);
}

function updateDemoUnitFromModal(id) {
  var name = document.getElementById('edit_demo_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }

  var sku = document.getElementById('edit_demo_sku').value.trim();
  var ean = document.getElementById('edit_demo_ean').value.trim();
  var price = parseNum(document.getElementById('edit_demo_price').value);
  var note = document.getElementById('edit_demo_note').value.trim();
  var enabled = document.getElementById('edit_demo_status').value === 'true';

  updateDemoUnit(id, {
    productName: name,
    sku: sku,
    ean: ean,
    price: price,
    note: note,
    enabled: enabled
  });

  closeMForce();
  toast('💾 อัปเดต Demo Unit แล้ว');
  render();
}
// ================================================================
// INITIALIZATION
// ================================================================

function initProductsModule() {
  var data = getProductsData();
  // หมายเหตุ: ตัด migration ที่เคยก็อป config.models (รายชื่อรุ่น default 33 ตัว) มาใส่ products ทิ้งแล้ว
  // เพราะข้อมูลสินค้าจริง (168 รายการจาก import) อยู่บน cloud — เครื่องใหม่ให้รอดึงจาก Firebase หลัง login แทน
  // ไม่งั้นรายการ default จะปนเข้าระบบและเสี่ยงถูก push ไปทับข้อมูลจริง
  ensureProductsStructure();
  if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    loadProductsFromFirebase().then(function(loaded) {
      if (loaded && typeof render === 'function') render();
    });
  }
  console.log('✅ Products Module initialized', data.models.length, 'products');
}

initProductsModule();

// ================================================================
// OVERRIDE GLOBAL FUNCTIONS
// ================================================================

window.Products = {
  getAll: getAllProducts,
  getById: getProductById,
  getBySku: getProductBySku,
  getByEan: getProductByEan,
  getByName: getProductByName,
  add: addProduct,
  update: updateProduct,
  delete: deleteProduct,
  getPriceByLevel: getPriceByLevel,
  updatePrice: updateProductPrice,
  setEOL: setProductEOL,
  isEOL: isProductEOL,
  getActive: getActiveProducts,
  getEOL: getEOLProducts,
  getAllBundles: getAllBundles,
  getBundleById: getBundleById,
  addBundle: addBundle,
  updateBundle: updateBundle,
  deleteBundle: deleteBundle,
  getAllDemoUnits: getAllDemoUnits,
  getDemoUnitById: getDemoUnitById,
  getDemoUnitPrice: getDemoUnitPrice,
  addDemoUnit: addDemoUnit,
  updateDemoUnit: updateDemoUnit,
  deleteDemoUnit: deleteDemoUnit,
  clearAll: clearAllProductsData,
  exportToExcel: exportProductsToExcel,
  importFull: importFullExcel,  // ✅ เพิ่ม comma ตรงนี้
  isDemo: isDemoProduct,
  isMain: isMainProduct,
  getMain: getMainProducts,
  getDemo: getDemoProducts,
  exportMain: exportMainProductsToExcel,
  exportDemo: exportDemoProductsToExcel
};

// ================================================================
// SHEET EDIT (jspreadsheet)
// ================================================================
function initProductsSheet(products) {
  if (typeof jexcel === 'undefined') { toast('⚠️ โหลด jspreadsheet ไม่สำเร็จ (ต้องออนไลน์)'); return; }
  var el = document.getElementById('productsSheetEl');
  if (!el) return;
  if (el.jexcel) { jexcel.destroy(el); el.innerHTML = ''; }

  _prodSheetIds = products.map(function(p) { return p.id; });
  var data = products.map(function(p) {
    var tp = p.typePrices || {};
    return [p.sku||'', p.ean||'', p.name||'', p.category||'other',
            p.rrpInVat||0, p.rrpExVat||0,
            tp.S||0, tp.A||0, tp.B||p.price||0, tp.Other||0,
            p.eol ? 'EOL' : 'Active', p.cost||0];
  });

  _prodSheetInstance = jexcel(el, {
    data: data,
    columns: [
      { title: 'SKU', type: 'text', width: 100 },
      { title: 'EAN', type: 'text', width: 110 },
      { title: 'ชื่อสินค้า', type: 'text', width: 260 },
      { title: 'หมวดหมู่', type: 'dropdown', source: ['drone','payload','battery','charger','software','service','bundle','other'], width: 90 },
      { title: 'RRP InVAT', type: 'numeric', width: 90 },
      { title: 'RRP ExVAT', type: 'numeric', width: 90 },
      { title: 'S', type: 'numeric', width: 80 },
      { title: 'A', type: 'numeric', width: 80 },
      { title: 'B', type: 'numeric', width: 80 },
      { title: 'Other', type: 'numeric', width: 80 },
      { title: 'สถานะ', type: 'dropdown', source: ['Active','EOL'], width: 70 },
      { title: 'ต้นทุน', type: 'numeric', width: 80 }
    ],
    minDimensions: [12, Math.max(data.length, 5)],
    allowInsertRow: true,
    allowDeleteRow: true,
    contextMenu: false
  });
  // stretch ชื่อสินค้า column to fill available width
  requestAnimationFrame(function() { _fitProductSheet(); });
}

function _fitProductSheet() {
  var wrap = document.getElementById('productsSheetWrap');
  if (!wrap || !_prodSheetInstance) return;
  // fixed cols total: SKU100+EAN110+หมวด90+RRPin90+RRPex90+S80+A80+B80+Other80+สถานะ70+ต้นทุน80 = 950, row-num ~40
  var fixedW = 950 + 40;
  var avail = wrap.clientWidth - 4; // 4 for borders/scrollbar
  var nameW = Math.max(200, avail - fixedW);
  _prodSheetInstance.setWidth(2, nameW);
}

function saveProductsSheet() {
  if (!_prodSheetInstance) { toast('⚠️ เปิด Sheet mode ก่อน'); return; }
  var rows = _prodSheetInstance.getData();
  var saved = 0, added = 0;

  rows.forEach(function(r, idx) {
    var name = (r[2] || '').toString().trim();
    if (!name) return;
    var data = {
      sku: (r[0]||'').toString().trim(),
      ean: (r[1]||'').toString().trim(),
      name: name,
      category: r[3] || 'other',
      rrpInVat: parseFloat(r[4]) || 0,
      rrpExVat: parseFloat(r[5]) || 0,
      typePrices: { S: parseFloat(r[6])||0, A: parseFloat(r[7])||0, B: parseFloat(r[8])||0, Other: parseFloat(r[9])||0 },
      price: parseFloat(r[8]) || 0,
      eol: r[10] === 'EOL',
      cost: parseFloat(r[11]) || 0,
      updatedAt: new Date().toISOString()
    };
    var id = _prodSheetIds[idx];
    if (id) { updateProduct(id, data); saved++; }
    else { data.createdAt = new Date().toISOString(); addProduct(data); added++; }
  });

  var st = document.getElementById('sheetSaveStatus');
  if (st) st.textContent = '✅ บันทึก ' + saved + (added ? ', เพิ่ม ' + added : '') + ' รายการ';
  toast('💾 บันทึก ' + (saved + added) + ' รายการ');
}

// ================================================================
// PASTE FROM EXCEL
// ================================================================
function _parseTSVText(text) {
  var rows = [], row = [], field = '', inQ = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === '\t') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(function(r) { return r.length > 1 || (r[0] && r[0].trim()); });
}

function showPasteProductsM() {
  var h = '<div style="max-width:620px">';
  h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:4px">ก็อปช่วงข้อมูลจาก Excel แล้ววางที่นี่ — UPSERT โดยจับคู่ SKU → EAN → ชื่อ (ID คงเดิม)</p>';
  h += '<p style="font-size:.75rem;color:var(--text3);margin-bottom:8px">ลำดับคอลัมน์: <strong>SKU | EAN | Product Name | RRP InVAT | RRP ExVAT | Type1(S) | Type2(A) | Type3(B) | Type4</strong></p>';
  h += '<textarea id="pasteProdTa" style="width:100%;height:200px;font-size:12px;font-family:monospace;border:1px solid var(--border);border-radius:8px;padding:8px;resize:vertical;background:var(--bg2);color:var(--text)" placeholder="วางข้อมูลจาก Excel ที่นี่..."></textarea>';
  h += '<div style="display:flex;gap:8px;margin-top:10px">';
  h += '<button class="btn bp" style="flex:1" onclick="doPasteProducts()">📥 นำเข้า</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '</div></div>';
  openM('📋 วางข้อมูลสินค้าจาก Excel', h);
}

// preview ก่อนวางข้อมูลสินค้า — จำแนก ใหม่/เปลี่ยน(พร้อม diff รายช่อง)/เหมือนเดิม + เลือก action ต่อแถวได้ ก่อนกดยืนยัน
var _pasteProductsMeta = null;

function doPasteProducts() {
  var ta = document.getElementById('pasteProdTa');
  if (!ta) return;
  var rows = _parseTSVText(ta.value.trim());
  if (!rows.length) { toast('⚠️ ไม่พบข้อมูล'); return; }

  var existing = getAllProducts();
  var byKey = {};
  existing.forEach(function(p) {
    if (p.sku) byKey['sku_' + p.sku.trim()] = p;
    if (p.ean) byKey['ean_' + p.ean.trim()] = p;
    if (p.name) byKey['name_' + p.name.trim()] = p;
  });

  var numDiff = function(a, b) { return Math.abs((Number(a) || 0) - (Number(b) || 0)) > 0.001; };
  var meta = [];
  rows.forEach(function(c) {
    var sku = (c[0] || '').trim();
    var ean = (c[1] || '').trim();
    var name = (c[2] || '').trim();
    if (!name) return; // แถวว่าง/ไม่มีชื่อ = ข้ามตั้งแต่ preview

    var rrpInVat = parseFloat(c[3]) || 0;
    var rrpExVat = parseFloat(c[4]) || 0;
    var priceS = parseFloat(c[5]) || 0;
    var priceA = parseFloat(c[6]) || 0;
    var priceB = parseFloat(c[7]) || 0;
    var priceOther = parseFloat(c[8]) || 0;
    if (priceB === 0 && rrpExVat > 0) priceB = rrpExVat;

    var data = { name: name, sku: sku, ean: ean, rrpInVat: rrpInVat, rrpExVat: rrpExVat,
      price: priceB, typePrices: { S: priceS, A: priceA, B: priceB, Other: priceOther } };

    var found = (sku && byKey['sku_' + sku]) || (ean && byKey['ean_' + ean]) || byKey['name_' + name];
    var diffs = [];
    if (found) {
      var tp = found.typePrices || {};
      if ((found.name || '') !== name)            diffs.push({ label: 'ชื่อ',       old: found.name || '-',                newVal: name });
      if ((found.sku || '') !== sku && sku)       diffs.push({ label: 'SKU',        old: found.sku || '-',                 newVal: sku });
      if ((found.ean || '') !== ean && ean)       diffs.push({ label: 'EAN',        old: found.ean || '-',                 newVal: ean });
      if (numDiff(found.rrpInVat, rrpInVat))      diffs.push({ label: 'RRP InVAT',  old: fmtMoney(Number(found.rrpInVat) || 0), newVal: fmtMoney(rrpInVat) });
      if (numDiff(found.rrpExVat, rrpExVat))      diffs.push({ label: 'RRP ExVAT',  old: fmtMoney(Number(found.rrpExVat) || 0), newVal: fmtMoney(rrpExVat) });
      if (numDiff(tp.S, priceS))                  diffs.push({ label: 'S',          old: fmtMoney(Number(tp.S) || 0),       newVal: fmtMoney(priceS) });
      if (numDiff(tp.A, priceA))                  diffs.push({ label: 'A',          old: fmtMoney(Number(tp.A) || 0),       newVal: fmtMoney(priceA) });
      if (numDiff(tp.B, priceB))                  diffs.push({ label: 'B',          old: fmtMoney(Number(tp.B) || 0),       newVal: fmtMoney(priceB) });
      if (numDiff(tp.Other, priceOther))          diffs.push({ label: 'Other',      old: fmtMoney(Number(tp.Other) || 0),   newVal: fmtMoney(priceOther) });
    }
    var state = !found ? 'new' : (diffs.length ? 'changed' : 'same');
    meta.push({ data: data, found: found, state: state, diffs: diffs });
  });
  if (!meta.length) { toast('⚠️ ไม่พบแถวที่มีชื่อสินค้า'); return; }
  _pasteProductsMeta = meta;

  var cnt = { 'new': 0, changed: 0, same: 0 };
  meta.forEach(function(m) { cnt[m.state]++; });

  var h = '<div style="max-width:640px">';
  h += '<div style="font-size:.85rem;margin-bottom:8px">พบ <b>' + meta.length + ' รายการ</b> — ';
  if (cnt['new'])    h += '<span style="color:#22c55e;font-weight:700">➕ ใหม่ ' + cnt['new'] + '</span> ';
  if (cnt.changed)   h += '<span style="color:#f59e0b;font-weight:700">✏️ มีการเปลี่ยน ' + cnt.changed + '</span> ';
  if (cnt.same)      h += '<span style="color:var(--text2);font-weight:700">⏭ เหมือนเดิม ' + cnt.same + '</span>';
  h += '</div>';

  h += '<div style="font-size:11px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:5px 10px;margin-bottom:8px;display:flex;align-items:center;gap:8px">';
  h += '<span style="color:var(--text2)">ปรับทั้งหมด:</span>';
  h += '<select onchange="_pasteProductsBulkAct(this.value)" style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">';
  h += '<option value="">— เลือก —</option>';
  h += '<option value="update">✏️ อัปเดตทุกรายการ</option>';
  h += '<option value="add">➕ เพิ่มใหม่ทุกรายการ (ยอมซ้ำ)</option>';
  h += '<option value="skip">⏭ ข้ามทุกรายการ</option>';
  h += '</select></div>';

  h += '<div style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg2)">';
  h += '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="position:sticky;top:0;background:var(--bg2)">' +
    '<th style="padding:4px 8px;text-align:center;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);white-space:nowrap">สถานะ</th>' +
    '<th style="padding:4px 8px;text-align:left;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border)">สินค้า</th>' +
    '<th style="padding:4px 8px;text-align:left;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border)">การเปลี่ยนแปลง</th>' +
    '<th style="padding:4px 8px;text-align:left;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border)">การดำเนินการ</th></tr></thead><tbody>';
  meta.forEach(function(m, i) {
    var badge, defAct;
    if (m.state === 'new')          { badge = '<span style="color:#22c55e;font-size:10px;font-weight:700">➕ ใหม่</span>';      defAct = 'add'; }
    else if (m.state === 'changed') { badge = '<span style="color:#f59e0b;font-size:10px;font-weight:700">✏️ เปลี่ยน</span>'; defAct = 'update'; }
    else                            { badge = '<span style="color:var(--text2);font-size:10px;font-weight:700">⏭ เดิม</span>'; defAct = 'skip'; }
    var diffTxt = m.diffs.length
      ? m.diffs.map(function(d) { return sanitize(d.label) + ': <span style="color:#ef4444">' + sanitize(String(d.old)) + '</span>→<span style="color:#22c55e">' + sanitize(String(d.newVal)) + '</span>'; }).join('<br>')
      : '<span style="color:var(--text2)">-</span>';
    h += '<tr style="border-bottom:1px solid var(--border)">' +
      '<td style="padding:3px 8px;text-align:center;white-space:nowrap">' + badge + '</td>' +
      '<td style="padding:3px 8px;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(m.data.name) + '">' + sanitize(m.data.name) + (m.data.sku ? '<div style="font-size:10px;color:var(--text2)">' + sanitize(m.data.sku) + '</div>' : '') + '</td>' +
      '<td style="padding:3px 8px;font-size:10px">' + diffTxt + '</td>' +
      '<td style="padding:3px 8px"><select id="pasteProdAct_' + i + '" style="font-size:11px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">' +
        '<option value="add"'    + (defAct === 'add'    ? ' selected' : '') + '>➕ เพิ่มใหม่</option>' +
        '<option value="update"' + (defAct === 'update' ? ' selected' : '') + '>✏️ อัปเดต</option>' +
        '<option value="skip"'   + (defAct === 'skip'   ? ' selected' : '') + '>⏭ ข้าม</option>' +
      '</select></td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<div class="fm-actions" style="margin-top:12px">' +
    '<button class="btn bp" onclick="applyPasteProducts()">✔ ยืนยันนำเข้า</button>' +
    '<button class="btn" onclick="showPasteProductsM()">← กลับไปแก้</button></div></div>';
  openM('📋 ตรวจสอบก่อนนำเข้าสินค้า', h);
}

function _pasteProductsBulkAct(val) {
  if (!val) return;
  var i = 0;
  while (document.getElementById('pasteProdAct_' + i)) {
    document.getElementById('pasteProdAct_' + i).value = val;
    i++;
  }
}

function applyPasteProducts() {
  if (!_pasteProductsMeta) return;
  var imported = 0, updated = 0, skipped = 0;
  _pasteProductsMeta.forEach(function(m, i) {
    var actEl = document.getElementById('pasteProdAct_' + i);
    var action = actEl ? actEl.value : (m.state === 'new' ? 'add' : (m.state === 'changed' ? 'update' : 'skip'));
    if (action === 'skip') { skipped++; return; }
    var data = Object.assign({}, m.data, { updatedAt: new Date().toISOString() });
    if (action === 'update' && m.found) {
      updateProduct(m.found.id, data);
      updated++;
    } else {
      data.createdAt = new Date().toISOString();
      data.eol = false;
      addProduct(data);
      imported++;
    }
  });
  _pasteProductsMeta = null;
  closeMForce();
  toast('✅ เพิ่ม ' + imported + ', อัปเดต ' + updated + (skipped ? ', ข้าม ' + skipped : ''));
  render();
}

// ฟังก์ชัน global สำหรับใช้ในระบบอื่น
window.getModelPrice = getModelPrice;
window.getModelPriceByLevel = getModelPriceByLevel;
window.getModelRrpExVat = getModelRrpExVat;
window.getModelRrpInVat = getModelRrpInVat;
window.modelOptionsNew = modelOptionsNew;