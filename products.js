// ================================================================
// PRODUCTS MANAGEMENT MODULE
// ================================================================
// รองรับ Firebase Sync, Import/Export Excel, และเข้ากันได้กับระบบเก่า
// ================================================================

var PRODUCTS_STORAGE_KEY = 'v7_products';

// ================================================================
// CORE DATA MANAGEMENT
// ================================================================

function getProductsData() {
  try {
    var saved = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch(e) {}
  
  // ถ้าไม่มี ให้สร้างจาก config เดิม
  var cfg = getConfigFromLocalStorage();
  var defaultData = {
    models: [],
    bundles: [],
    demoUnits: [],
    levelPrices: { S: {}, A: {}, B: {}, Other: {} },
    lastUpdated: null,
    version: '1.0'
  };
  
  if (cfg && cfg.models) {
    defaultData.models = JSON.parse(JSON.stringify(cfg.models));
    // เพิ่มฟิลด์ที่อาจขาด
    for (var i = 0; i < defaultData.models.length; i++) {
      var m = defaultData.models[i];
      if (typeof m === 'object') {
        if (m.eol === undefined) m.eol = false;
        if (m.ean === undefined) m.ean = '';
        if (m.sku === undefined) m.sku = '';
        if (m.isSoftware === undefined) m.isSoftware = false;
        if (m.isService === undefined) m.isService = false;
        if (!m.typePrices) {
          m.typePrices = {
            S: m.price || 0,
            A: m.price || 0,
            B: m.price || 0,
            Other: m.price || 0
          };
        }
      }
    }
  }
  
  return defaultData;
}

function getConfigFromLocalStorage() {
  try {
    var saved = localStorage.getItem('v7_config');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return null;
}

// ================================================================
// FIREBASE SYNC
// ================================================================

function syncProductsToFirebase(data) {
  if (typeof db === 'undefined' || typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    return;
  }
  
  var userRef = db.collection('users').doc(CURRENT_USER.uid);
  var batch = db.batch();
  
  userRef.collection('products').get().then(function(snapshot) {
    snapshot.forEach(function(doc) {
      batch.delete(doc.ref);
    });
    
    if (data.models && data.models.length) {
      for (var i = 0; i < data.models.length; i++) {
        var p = data.models[i];
        var productRef = userRef.collection('products').doc(p.id || ('prod_' + i));
        batch.set(productRef, p);
      }
    }
    
    if (data.bundles && data.bundles.length) {
      for (var i = 0; i < data.bundles.length; i++) {
        var b = data.bundles[i];
        var bundleRef = userRef.collection('bundles').doc(b.id);
        batch.set(bundleRef, b);
      }
    }
    
    if (data.demoUnits && data.demoUnits.length) {
      for (var i = 0; i < data.demoUnits.length; i++) {
        var d = data.demoUnits[i];
        var demoRef = userRef.collection('demoUnits').doc(d.id);
        batch.set(demoRef, d);
      }
    }
    
    return batch.commit();
  }).then(function() {
    console.log('✅ Products synced to Firebase');
  }).catch(function(err) {
    console.warn('Firebase sync error:', err);
  });
}

function loadProductsFromFirebase() {
  if (typeof db === 'undefined' || typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    console.log('No Firebase user, using localStorage only');
    return Promise.resolve(false);
  }
  
  var userRef = db.collection('users').doc(CURRENT_USER.uid);
  
  return userRef.collection('products').get().then(function(snapshot) {
    if (snapshot.empty) {
      console.log('No products in Firebase');
      return false;
    }
    
    var products = [];
    snapshot.forEach(function(doc) {
      products.push(doc.data());
    });
    
    var data = getProductsData();
    data.models = products;
    data.lastUpdated = new Date().toISOString();
    saveProductsData(data);
    
    console.log('✅ Loaded', products.length, 'products from Firebase');
    return true;
  }).catch(function(err) {
    console.warn('Error loading products from Firebase:', err);
    return false;
  });
}

// ================================================================
// SAVE PRODUCTS DATA (sync to config and firebase)
// ================================================================

function saveProductsData(data) {
  // บันทึก localStorage หลัก
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(data));
  
  // Sync ไป config เดิม เพื่อให้ระบบเก่า (modelOptionsNew) ทำงานได้
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
  
  // Sync ไป Firebase
  syncProductsToFirebase(data);
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
    var p = products[i];
    var pId = (p && p.id) ? p.id : (typeof p === 'object' ? i.toString() : null);
    if (pId === id) return p;
    if (!p.id && i.toString() === id) return p;
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
    var p = products[i];
    var pName = typeof p === 'object' ? p.name : p;
    if (pName === name) return p;
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
    price: productData.price || 0,
    typePrices: productData.typePrices || {
      S: productData.price || 0,
      A: productData.price || 0,
      B: productData.price || 0,
      Other: productData.price || 0
    },
    eol: productData.eol || false,
    isSoftware: productData.isSoftware || false,
    isService: productData.isService || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.models.push(newProduct);
  data.lastUpdated = new Date().toISOString();
  saveProductsData(data);
  
  return newProduct;
}

function updateProduct(productId, updates) {
  var data = getProductsData();
  if (!data.models) return false;
  
  for (var i = 0; i < data.models.length; i++) {
    var p = data.models[i];
    var pId = (p && p.id) ? p.id : (typeof p === 'object' ? i.toString() : null);
    
    if (pId === productId) {
      for (var key in updates) {
        if (updates.hasOwnProperty(key)) {
          if (key === 'typePrices' && typeof updates[key] === 'object') {
            if (!p.typePrices) p.typePrices = {};
            for (var level in updates[key]) {
              if (updates[key].hasOwnProperty(level)) {
                p.typePrices[level] = updates[key][level];
              }
            }
          } else {
            p[key] = updates[key];
          }
        }
      }
      p.updatedAt = new Date().toISOString();
      data.lastUpdated = new Date().toISOString();
      saveProductsData(data);
      return true;
    }
  }
  
  // ถ้าไม่พบ ให้สร้างใหม่
  var newProduct = {
    id: productId || ('prod_' + Date.now() + '_' + Math.random()),
    name: updates.name || 'Unknown',
    sku: updates.sku || '',
    ean: updates.ean || '',
    price: updates.price || 0,
    typePrices: updates.typePrices || { S: 0, A: 0, B: 0, Other: 0 },
    eol: updates.eol || false,
    isSoftware: updates.isSoftware || false,
    isService: updates.isService || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.models.push(newProduct);
  data.lastUpdated = new Date().toISOString();
  saveProductsData(data);
  return true;
}

function deleteProduct(productId) {
  var data = getProductsData();
  if (!data.models) return false;
  
  var newModels = [];
  for (var i = 0; i < data.models.length; i++) {
    var p = data.models[i];
    var pId = p.id || i.toString();
    if (pId !== productId) {
      newModels.push(p);
    }
  }
  
  if (newModels.length !== data.models.length) {
    data.models = newModels;
    data.lastUpdated = new Date().toISOString();
    saveProductsData(data);
    return true;
  }
  return false;
}

// ================================================================
// PRICE BY LEVEL
// ================================================================

function getPriceByLevel(productId, level) {
  var product = getProductById(productId);
  if (!product) return 0;
  
  var levelMap = { S: 'S', A: 'A', B: 'B', Other: 'Other' };
  var targetLevel = levelMap[level] || 'B';
  
  if (product.typePrices && product.typePrices[targetLevel] !== undefined) {
    return product.typePrices[targetLevel];
  }
  return product.price || 0;
}

function updateProductPrice(productId, level, price) {
  var product = getProductById(productId);
  if (!product) return false;
  
  if (!product.typePrices) product.typePrices = {};
  product.typePrices[level] = price;
  
  if (level === 'B') {
    product.price = price;
  }
  
  return updateProduct(productId, { typePrices: product.typePrices, price: product.price });
}

function getAllLevelPrices() {
  var products = getAllProducts();
  var result = { S: {}, A: {}, B: {}, Other: {} };
  
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var productKey = p.sku || p.ean || p.name;
    if (p.typePrices) {
      if (p.typePrices.S !== undefined) result.S[productKey] = p.typePrices.S;
      if (p.typePrices.A !== undefined) result.A[productKey] = p.typePrices.A;
      if (p.typePrices.B !== undefined) result.B[productKey] = p.typePrices.B;
      if (p.typePrices.Other !== undefined) result.Other[productKey] = p.typePrices.Other;
    }
  }
  
  return result;
}

// ================================================================
// EOL (END OF LIFE)
// ================================================================

function isProductEOL(productId) {
  var product = getProductById(productId);
  return product ? product.eol === true : false;
}

function isProductEOLByName(productName) {
  var product = getProductByName(productName);
  return product ? product.eol === true : false;
}

function setProductEOL(productId, isEOL) {
  return updateProduct(productId, { eol: isEOL });
}

function getActiveProducts() {
  var all = getAllProducts();
  var active = [];
  for (var i = 0; i < all.length; i++) {
    if (!all[i].eol) active.push(all[i]);
  }
  return active;
}

function getEOLProducts() {
  var all = getAllProducts();
  var eol = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].eol) eol.push(all[i]);
  }
  return eol;
}

// ================================================================
// BUNDLES
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
        if (updates.hasOwnProperty(key)) {
          data.bundles[i][key] = updates[key];
        }
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
  
  var newBundles = [];
  for (var i = 0; i < data.bundles.length; i++) {
    if (data.bundles[i].id !== bundleId) {
      newBundles.push(data.bundles[i]);
    }
  }
  
  if (newBundles.length !== data.bundles.length) {
    data.bundles = newBundles;
    data.lastUpdated = new Date().toISOString();
    saveProductsData(data);
    return true;
  }
  return false;
}

function getActiveBundles() {
  var all = getAllBundles();
  var active = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].enabled) active.push(all[i]);
  }
  return active;
}

// ================================================================
// DEMO UNITS
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
        if (updates.hasOwnProperty(key)) {
          data.demoUnits[i][key] = updates[key];
        }
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
  
  var newDemos = [];
  for (var i = 0; i < data.demoUnits.length; i++) {
    if (data.demoUnits[i].id !== demoId) {
      newDemos.push(data.demoUnits[i]);
    }
  }
  
  if (newDemos.length !== data.demoUnits.length) {
    data.demoUnits = newDemos;
    data.lastUpdated = new Date().toISOString();
    saveProductsData(data);
    return true;
  }
  return false;
}

// ================================================================
// UTILITIES (Model Options สำหรับ dropdown ทั่วไป)
// ================================================================

function getModelOptionsHtml(selected, showEOLBadge) {
  var products = getAllProducts();
  var html = '<option value="">-- เลือก Model --</option>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var name = p.name;
    var price = p.price || 0;
    var isEOL = p.eol === true;
    var label = name;
    if (price > 0) label += ' (฿' + fmtMoney(price) + ')';
    if (showEOLBadge && isEOL) label += ' ⏰ EOL';
    html += '<option value="' + sanitize(name) + '"' + (selected === name ? ' selected' : '') + '>' + sanitize(label) + '</option>';
  }
  return html;
}

function getModelListForDropdown() {
  var products = getAllProducts();
  var list = [];
  for (var i = 0; i < products.length; i++) {
    list.push(products[i].name);
  }
  return list;
}

// ================================================================
// CLEANUP (ลบข้อมูลเก่าใน config เมื่อไม่ต้องการแล้ว)
// ================================================================

function cleanOldConfigModels() {
  var cfg = localStorage.getItem('v7_config');
  if (cfg) {
    var config = JSON.parse(cfg);
    if (config.models) {
      delete config.models;
      localStorage.setItem('v7_config', JSON.stringify(config));
      console.log('✅ ลบข้อมูลสินค้าเก่า (v7_config.models) แล้ว');
    } else {
      console.log('ℹ️ ไม่พบข้อมูลสินค้าเก่าใน v7_config');
    }
  }
}

// ================================================================
// INITIALIZE
// ================================================================

function initProductsModule() {
  var data = getProductsData();
  
  // ถ้า products ว่าง แต่มี config เก่า ให้ย้ายมา
  if ((!data.models || data.models.length === 0)) {
    var cfg = getConfigFromLocalStorage();
    if (cfg && cfg.models && cfg.models.length) {
      console.log('🔄 Migrating old config.models to products...');
      data.models = JSON.parse(JSON.stringify(cfg.models));
      for (var i = 0; i < data.models.length; i++) {
        var m = data.models[i];
        if (typeof m === 'object') {
          if (m.eol === undefined) m.eol = false;
          if (m.ean === undefined) m.ean = '';
          if (m.sku === undefined) m.sku = '';
          if (!m.typePrices) {
            m.typePrices = { S: m.price || 0, A: m.price || 0, B: m.price || 0, Other: m.price || 0 };
          }
        }
      }
      saveProductsData(data);
    }
  }
  
  // พยายามโหลดจาก Firebase ถ้ามี login
  if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    loadProductsFromFirebase().then(function(loaded) {
      if (loaded && typeof render === 'function') render();
    });
  }
  
  console.log('✅ Products Module initialized', data.models.length, 'products');
}

// เริ่มต้น
initProductsModule();

// ================================================================
// OVERRIDE ฟังก์ชันระบบเก่า (modelOptionsNew, getModelPrice)
// ================================================================

window.modelOptionsNew = function(selected, showEOLBadge) {
  return getModelOptionsHtml(selected, showEOLBadge);
};

window.getModelPrice = function(modelName) {
  var product = getProductByName(modelName);
  return product ? product.price : 0;
};

// ================================================================
// EXPORT GLOBAL OBJECT
// ================================================================

var Products = {
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
  getAllLevelPrices: getAllLevelPrices,
  
  isEOL: isProductEOL,
  isEOLByName: isProductEOLByName,
  setEOL: setProductEOL,
  getActive: getActiveProducts,
  getEOL: getEOLProducts,
  
  getAllBundles: getAllBundles,
  getBundleById: getBundleById,
  getBundleByName: getBundleByName,
  addBundle: addBundle,
  updateBundle: updateBundle,
  deleteBundle: deleteBundle,
  getActiveBundles: getActiveBundles,
  
  getAllDemoUnits: getAllDemoUnits,
  getDemoUnitById: getDemoUnitById,
  getDemoUnitByProductId: getDemoUnitByProductId,
  getDemoUnitPrice: getDemoUnitPrice,
  addDemoUnit: addDemoUnit,
  updateDemoUnit: updateDemoUnit,
  deleteDemoUnit: deleteDemoUnit,
  
  getModelOptions: getModelOptionsHtml,
  getModelList: getModelListForDropdown,
  
  cleanOldConfigModels: cleanOldConfigModels,
  forceSync: syncProductsToFirebase
};

// เผื่อเรียกผ่าน window
window.Products = Products;