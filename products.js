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
function saveProductsData(data) {
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
  var userRef = db.collection('users').doc(CURRENT_USER.uid);
  var batch = db.batch();
  userRef.collection('products').get().then(function(snapshot) {
    snapshot.forEach(function(doc) { batch.delete(doc.ref); });
    if (data.models && data.models.length) {
      data.models.forEach(function(p, idx) {
        var productRef = userRef.collection('products').doc(p.id || ('prod_' + idx));
        batch.set(productRef, p);
      });
    }
    if (data.bundles && data.bundles.length) {
      data.bundles.forEach(function(b) {
        var bundleRef = userRef.collection('bundles').doc(b.id);
        batch.set(bundleRef, b);
      });
    }
    if (data.demoUnits && data.demoUnits.length) {
      data.demoUnits.forEach(function(d) {
        var demoRef = userRef.collection('demoUnits').doc(d.id);
        batch.set(demoRef, d);
      });
    }
    return batch.commit();
  }).catch(function(e) { console.warn('Firebase sync error:', e); });
}

function loadProductsFromFirebase() {
  if (typeof db === 'undefined' || !CURRENT_USER) return Promise.resolve(false);
  
  var userRef = db.collection('users').doc(CURRENT_USER.uid);
  return userRef.collection('products').get().then(function(snapshot) {
    if (snapshot.empty) return false;
    
    var products = [];
    snapshot.forEach(function(doc) { 
      var data = doc.data();
      // ✅ ป้องกันข้อมูลเสีย
      if (data && !data.id) data.id = doc.id;
      products.push(data); 
    });
    
    // ✅ ถ้าได้ Array ให้แปลงเป็น Object structure
    var data = getProductsData();
    if (Array.isArray(products)) {
      data.models = products;
    } else if (products.models) {
      data.models = products.models;
    } else {
      data.models = products;
    }
    
    data.lastUpdated = new Date().toISOString();
    saveProductsData(data);
    return true;
  }).catch(function() { return false; });
}
function ensureProductStructure(p) {
  if (!p) return { name: '', price: 0, rrpInVat: 0, rrpExVat: 0, typePrices: { S:0, A:0, B:0, Other:0 }, category: 'other', eol: false };
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
  
  html += '<div class="form-section">🏷️ หมวดหมู่และสถานะ</div>';
  html += '<div class="fr"><div class="fg"><label>หมวดหมู่</label><select id="edit_category" class="fm-input">' + categoryOptions + '</select></div>';
  html += '<div class="fg"><label>⚡ สถานะ EOL</label><div class="radio-g"><label><input type="radio" name="edit_eol" value="1"' + (p.eol ? ' checked' : '') + '><span>⏰ EOL (หมดอายุ)</span></label><label><input type="radio" name="edit_eol" value="0"' + (!p.eol ? ' checked' : '') + '><span>✅ ปกติ</span></label></div></div></div>';
  
  html += '<div class="form-section">🔧 ประเภทสินค้า (สำหรับระบบ)</div>';
  html += '<div class="fr">';
  html += '<div class="fg"><label><input type="checkbox" id="edit_is_bundle"' + (p.isBundle ? ' checked' : '') + '> 🎁 Bundle/Combo</label></div>';
  html += '<div class="fg"><label><input type="checkbox" id="edit_is_software"' + (p.isSoftware ? ' checked' : '') + '> 💻 Software</label></div>';
  html += '<div class="fg"><label><input type="checkbox" id="edit_is_service"' + (p.isService ? ' checked' : '') + '> 🛠️ Service</label></div>';
  html += '</div>';
  
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
    sku: document.getElementById('edit_sku').value.trim(),
    ean: document.getElementById('edit_ean').value.trim(),
    rrpInVat: parseNum(document.getElementById('edit_rrp_in').value),
    rrpExVat: parseNum(document.getElementById('edit_rrp_ex').value),
    category: document.getElementById('edit_category').value,
    eol: document.querySelector('input[name="edit_eol"]:checked') ? document.querySelector('input[name="edit_eol"]:checked').value === '1' : false,
    isBundle: document.getElementById('edit_is_bundle').checked,
    isSoftware: document.getElementById('edit_is_software').checked,
    isService: document.getElementById('edit_is_service').checked,
    price: parseNum(document.getElementById('edit_price_b').value),
    typePrices: {
      S: parseNum(document.getElementById('edit_price_s').value),
      A: parseNum(document.getElementById('edit_price_a').value),
      B: parseNum(document.getElementById('edit_price_b').value),
      Other: parseNum(document.getElementById('edit_price_o').value)
    }
  };
  
  updateProduct(productId, updates);
  closeMForce();
  toast('💾 บันทึกสินค้าเรียบร้อย');
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
  var products = getAllProducts();
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
  XLSX.writeFile(wb, 'products-export-' + _td() + '.xlsx');
  toast('📥 Export Excel สำเร็จ!');
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
  
  var html = '<div class="card"><h2>📋 สินค้าทั้งหมด <span class="ml"><button class="btn bp" onclick="showAddProductM()">➕ เพิ่มสินค้า</button><button class="btn bo" onclick="exportProductsToExcel()">📥 Export Excel</button></span></h2>';
  
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
  html += '</div>';
  
  html += '<div class="export-wrap"><table class="export-table" id="productsTable"><thead><tr>';
  html += '<th>#</th><th>SKU</th><th>EAN</th><th>ชื่อสินค้า</th><th>หมวดหมู่</th>';
  html += '<th>RRP in Vat</th><th>RRP Ex Vat</th>';
  html += '<th>S</th><th>A</th><th>B</th><th>Other</th>';
  html += '<th>สถานะ</th><th></th>';
  html += '</thead><tbody id="productsTableBody"></tbody></table></div>';
  html += '<div class="hint" style="margin-top:6px;text-align:right">พบ ' + products.length + ' รายการ</div>';
  html += '</div>';
  
  el.innerHTML = html;
  renderProductsTable(products);
  
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
    renderProductsTable(newProducts);
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
    '<div class="fm-actions"><button class="btn btn-blue" onclick="updateBundle(\'' + id + '\')">💾 อัปเดต</button><button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
  
  openM('✏️ แก้ไข Bundle', html);
}

function updateBundle(id) {
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
  if (data.models.length === 0) {
    var cfg = localStorage.getItem('v7_config');
    if (cfg) {
      var config = JSON.parse(cfg);
      if (config.models && config.models.length) {
        console.log('Migrating old config.models to products...');
        data.models = JSON.parse(JSON.stringify(config.models));
        saveProductsData(data);
      }
    }
  }
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

// ฟังก์ชัน global สำหรับใช้ในระบบอื่น
window.getModelPrice = getModelPrice;
window.getModelPriceByLevel = getModelPriceByLevel;
window.getModelRrpExVat = getModelRrpExVat;
window.getModelRrpInVat = getModelRrpInVat;
window.modelOptionsNew = modelOptionsNew;