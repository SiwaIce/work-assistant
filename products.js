// ================================================================
// PRODUCTS MANAGEMENT MODULE
// ================================================================
// ไฟล์นี้เป็นอิสระ ไม่กระทบระบบเดิม
// ฟังก์ชันเดิม (modelOptionsNew, getModelPrice) ยังทำงานเหมือนเดิม
// ================================================================

var PRODUCTS_STORAGE_KEY = 'v7_products';

// ================================================================
// CORE DATA MANAGEMENT (SYNC WITH EXISTING CONFIG)
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

function saveProductsData(data) {
  // บันทึก localStorage
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(data));
  
  // Sync ไป config เดิม
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
  
  // ✅ เพิ่ม: Sync ไป Firebase (ถ้ามีการ login)
  if (typeof db !== 'undefined' && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    var userRef = db.collection('users').doc(CURRENT_USER.uid);
    
    // บันทึก products ไปที่ subcollection
    var batch = db.batch();
    
    // ลบเก่าก่อน (หรือจะอัปเดตทีละตัว)
    userRef.collection('products').get().then(function(snapshot) {
      snapshot.forEach(function(doc) {
        batch.delete(doc.ref);
      });
      
      // เพิ่มใหม่
      for (var i = 0; i < data.models.length; i++) {
        var productRef = userRef.collection('products').doc(data.models[i].id || ('prod_' + i));
        batch.set(productRef, data.models[i]);
      }
      
      // บันทึก bundles
      if (data.bundles) {
        for (var i = 0; i < data.bundles.length; i++) {
          var bundleRef = userRef.collection('bundles').doc(data.bundles[i].id);
          batch.set(bundleRef, data.bundles[i]);
        }
      }
      
      // บันทึก demo units
      if (data.demoUnits) {
        for (var i = 0; i < data.demoUnits.length; i++) {
          var demoRef = userRef.collection('demoUnits').doc(data.demoUnits[i].id);
          batch.set(demoRef, data.demoUnits[i]);
        }
      }
      
      batch.commit().then(function() {
        console.log('✅ Synced products to Firebase');
      }).catch(function(err) {
        console.warn('Firebase sync error:', err);
      });
    });
  }
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
    
    // บันทึก localStorage
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(data));
    
    // Sync to config
    var cfg = localStorage.getItem('v7_config');
    if (cfg) {
      var config = JSON.parse(cfg);
      config.models = products;
      localStorage.setItem('v7_config', JSON.stringify(config));
    }
    
    console.log('✅ Loaded', products.length, 'products from Firebase');
    return true;
  }).catch(function(err) {
    console.warn('Error loading products from Firebase:', err);
    return false;
  });
}

// เรียกตอนเริ่มต้น (หลัง login)
function initProductsSync() {
  if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    loadProductsFromFirebase();
  }
}

function getConfigFromLocalStorage() {
  try {
    var saved = localStorage.getItem('v7_config');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return null;
}

// ================================================================
// PRODUCTS (MODELS) CRUD
// ================================================================

function getAllProducts() {
  var data = getProductsData();
  return data.models || [];
}

function getProductById(id) {
  var products = getAllProducts();
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    // ✅ รองรับทั้ง id และ index fallback
    var pId = p.id || (typeof p === 'object' ? i.toString() : null);
    if (pId === id) return p;
    // backward compatible: ถ้าไม่มี id ให้ใช้ index แทน
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
    // ✅ แก้ไข: รองรับทั้ง id และ index fallback
    var pId = p.id || (typeof p === 'object' ? i.toString() : null);
    
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
  
  // ✅ ถ้าไม่พบ id ให้ลองสร้างใหม่
  var newProduct = {
    id: productId,
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
  
  // ถ้าเป็น level B ให้อัพเดท price ด้วย
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
// BUNDLE / COMBO MANAGEMENT
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
// IMPORT / EXPORT (Excel format)
// ================================================================

function importProductsFromExcelData(excelRows) {
  var imported = 0;
  var updated = 0;
  var skipped = 0;
  
  for (var i = 0; i < excelRows.length; i++) {
    var row = excelRows[i];
    var sku = row['SiS part'] || row['sku'] || '';
    var ean = row['EAN'] || row['ean'] || '';
    var name = row['Product Name'] || row['productName'] || row['name'] || '';
    
    if (!name) {
      skipped++;
      continue;
    }
    
    var existing = getProductBySku(sku) || getProductByEan(ean) || getProductByName(name);
    
    var productData = {
      name: name,
      sku: sku,
      ean: ean,
      price: parseFloat(row['Type 3 P EX Tax THB'] || row['price'] || row['RRP Ex Vat'] || 0),
      typePrices: {
        S: parseFloat(row['Type 1 P EX Tax THB'] || 0),
        A: parseFloat(row['Type 2 P EX Tax THB'] || 0),
        B: parseFloat(row['Type 3 P EX Tax THB'] || row['price'] || 0),
        Other: parseFloat(row['Type 4 P EX Tax THB'] || 0)
      },
      eol: (row['EOL Status'] === 'EOL' || row['eol'] === true || row['eol'] === 'EOL'),
      isSoftware: (name.indexOf('FlightHub') !== -1 || name.indexOf('Terra') !== -1 || name.indexOf('Software') !== -1),
      isService: (name.indexOf('Warranty') !== -1 || name.indexOf('Service') !== -1)
    };
    
    if (existing) {
      updateProduct(existing.id, productData);
      updated++;
    } else {
      addProduct(productData);
      imported++;
    }
  }
  
  return { imported: imported, updated: updated, skipped: skipped, total: excelRows.length };
}

function exportProductsToExcelFormat() {
  var products = getAllProducts();
  var result = [];
  
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    result.push({
      'SiS part': p.sku || '',
      'EAN': p.ean || '',
      'Product Name': p.name,
      'RRP Ex Vat': p.price,
      'Type 1 P EX Tax THB (S)': p.typePrices?.S || '',
      'Type 2 P EX Tax THB (A)': p.typePrices?.A || '',
      'Type 3 P EX Tax THB (B)': p.typePrices?.B || '',
      'Type 4 P EX Tax THB (Other)': p.typePrices?.Other || '',
      'EOL Status': p.eol ? 'EOL' : '',
      'Type': p.isSoftware ? 'Software' : (p.isService ? 'Service' : 'Hardware')
    });
  }
  
  return result;
}

// ================================================================
// UTILITIES (Model Options for Dropdown - ฟังก์ชันเสริม)
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
// INITIALIZE - SYNC WITH EXISTING DATA
// ================================================================

function initProductsModule() {
  var data = getProductsData();
  var cfg = getConfigFromLocalStorage();
  
  // ตรวจสอบและ sync ข้อมูล
  if (cfg && cfg.models && (!data.models || data.models.length === 0)) {
    data.models = JSON.parse(JSON.stringify(cfg.models));
    // เพิ่มฟิลด์ที่ขาด
    for (var i = 0; i < data.models.length; i++) {
      var m = data.models[i];
      if (typeof m === 'object') {
        if (m.eol === undefined) m.eol = false;
        if (m.ean === undefined) m.ean = '';
        if (m.sku === undefined) m.sku = '';
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
    saveProductsData(data);
  }
  
  // ✅ พยายามโหลดจาก Firebase ถ้ามี login
  if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    loadProductsFromFirebase().then(function(loaded) {
      if (loaded) {
        // รีเฟรชหน้า ถ้าจำเป็น
        if (typeof render === 'function') render();
      }
    });
  }
  
  console.log('✅ Products Module initialized', data.models.length, 'products');
}
// Auto initialize
initProductsModule();

// ================================================================
// EXPORT TO GLOBAL (สำหรับเรียกใช้จากที่อื่น)
// ================================================================

window.Products = {
  // Products
  getAll: getAllProducts,
  getById: getProductById,
  getBySku: getProductBySku,
  getByEan: getProductByEan,
  getByName: getProductByName,
  add: addProduct,
  update: updateProduct,
  delete: deleteProduct,
  
  // Prices
  getPriceByLevel: getPriceByLevel,
  updatePrice: updateProductPrice,
  getAllLevelPrices: getAllLevelPrices,
  
  // EOL
  isEOL: isProductEOL,
  isEOLByName: isProductEOLByName,
  setEOL: setProductEOL,
  getActive: getActiveProducts,
  getEOL: getEOLProducts,
  
  // Bundles
  getAllBundles: getAllBundles,
  getBundleById: getBundleById,
  getBundleByName: getBundleByName,
  addBundle: addBundle,
  updateBundle: updateBundle,
  deleteBundle: deleteBundle,
  getActiveBundles: getActiveBundles,
  
  // Demo Units
  getAllDemoUnits: getAllDemoUnits,
  getDemoUnitById: getDemoUnitById,
  getDemoUnitByProductId: getDemoUnitByProductId,
  getDemoUnitPrice: getDemoUnitPrice,
  addDemoUnit: addDemoUnit,
  updateDemoUnit: updateDemoUnit,
  deleteDemoUnit: deleteDemoUnit,
  
  // Import/Export
  importFromExcel: importProductsFromExcelData,
  exportToExcel: exportProductsToExcelFormat,
  
  // Utilities
  getModelOptions: getModelOptionsHtml,
  getModelList: getModelListForDropdown
};

// เก็บฟังก์ชันเดิมไว้ (ไม่ทับ)
if (typeof window.modelOptionsNew === 'undefined') {
  window.modelOptionsNew = getModelOptionsHtml;
}
if (typeof window.getModelPrice === 'undefined') {
  window.getModelPrice = function(modelName) {
    var product = Products.getByName(modelName);
    return product ? product.price : 0;
  };
}
// ================================================================
// PAGE RENDERERS FOR SIDEBAR MENU
// ================================================================

function rProducts(el) {
  document.getElementById('pgT').textContent = '📦 สินค้าทั้งหมด';
  
  var products = Products.getAll();
  var html = '<div class="card">';
  html += '<h2>📋 สินค้าทั้งหมด <span class="ml"><button class="btn bp" onclick="showAddProductM()">➕ เพิ่มสินค้า</button></span></h2>';
  
  // Search
  html += '<div class="fg"><input type="text" id="productSearch" placeholder="🔍 ค้นหา (ชื่อ, SKU, EAN)" oninput="filterProductsList()" style="margin-bottom:12px"></div>';

// ในส่วน h2
html += '<h2>📋 สินค้าทั้งหมด <span class="ml">';
html += '<button class="btn bsm bp" onclick="showAddProductM()">➕ เพิ่มสินค้า</button>';
html += '<button class="btn bsm bo" onclick="exportProductsToExcel()">📥 Export Excel</button>';
html += '</span></h2>';
  
  // Filter tabs
  html += '<div class="ftabs" style="margin-bottom:12px">';
  html += '<div class="ftab act" onclick="filterProductsType(\'all\')">📦 ทั้งหมด</div>';
  html += '<div class="ftab" onclick="filterProductsType(\'active\')">✅ มีขาย</div>';
  html += '<div class="ftab" onclick="filterProductsType(\'eol\')">⏰ EOL</div>';
  html += '<div class="ftab" onclick="filterProductsType(\'software\')">💻 Software</div>';
  html += '<div class="ftab" onclick="filterProductsType(\'service\')">🛠️ Service</div>';
  html += '</div>';
  
  // Table
  html += '<div class="export-wrap"><table class="export-table" id="productsTable">';
  html += '<thead><tr><th>#</th><th>EAN</th><th>SKU</th><th>ชื่อสินค้า</th><th>ราคา B</th><th>S</th><th>A</th><th>Other</th><th>สถานะ</th><th></th></tr></thead>';
  html += '<tbody id="productsTableBody"></tbody>';
  html += '</table></div>';
  html += '</div>';
  
  el.innerHTML = html;
  renderProductsTable(products);
  
  // Store products for filtering
  window.allProducts = products;
  window.currentProductFilter = 'all';
}

function renderProductsTable(products) {
  var tbody = document.getElementById('productsTableBody');
  if (!tbody) return;
  
  var html = '';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var statusBadge = p.eol ? '<span class="tag tag-cancelled">⏰ EOL</span>' : '<span class="tag tag-completed">✅ มีขาย</span>';
    if (p.isSoftware) statusBadge += ' <span class="tag tag-active">💻 SW</span>';
    if (p.isService) statusBadge += ' <span class="tag tag-on-hold">🛠️ SV</span>';
    
    html += '<tr>';
    html += '<td class="pipe-row-num">' + (i + 1) + '</td>';
    html += '<td>' + (p.ean || '-') + '</td>';
    html += '<td>' + (p.sku || '-') + '</td>';
    html += '<td><strong>' + sanitize(p.name) + '</strong></td>';
    html += '<td style="text-align:right">' + fmtMoney(p.price) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.typePrices?.S) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.typePrices?.A) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.typePrices?.Other) + '</td>';
    html += '<td>' + statusBadge + '</td>';
    html += '<td><button class="btn bsm bo" onclick="showEditProductM(\'' + p.id + '\')">✏️</button></td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

function filterProductsList() {
  var search = document.getElementById('productSearch')?.value.toLowerCase() || '';
  var filter = window.currentProductFilter || 'all';
  var products = window.allProducts || [];
  
  var filtered = products.filter(function(p) {
    if (filter === 'active' && p.eol) return false;
    if (filter === 'eol' && !p.eol) return false;
    if (filter === 'software' && !p.isSoftware) return false;
    if (filter === 'service' && !p.isService) return false;
    if (search && !p.name.toLowerCase().includes(search) && 
        !(p.sku || '').toLowerCase().includes(search) &&
        !(p.ean || '').includes(search)) return false;
    return true;
  });
  
  renderProductsTable(filtered);
}

function filterProductsType(type) {
  window.currentProductFilter = type;
  // Update active tab style
  var tabs = document.querySelectorAll('.ftab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('act');
  }
  event.target.classList.add('act');
  filterProductsList();
}

function showAddProductM() {
  var h = '<div style="max-width:500px">';
  h += '<div class="fm-group"><label>SKU (SiS part)</label><input type="text" id="prod_sku" placeholder="เช่น DJI-6941565998040"></div>';
  h += '<div class="fm-group"><label>EAN</label><input type="text" id="prod_ean" placeholder="13 หลัก"></div>';
  h += '<div class="fm-group"><label>ชื่อสินค้า *</label><input type="text" id="prod_name"></div>';
  h += '<div class="fr"><div class="fm-group"><label>ประเภท</label><select id="prod_type">';
  h += '<option value="hardware">🖥️ Hardware</option>';
  h += '<option value="software">💻 Software</option>';
  h += '<option value="service">🛠️ Service</option>';
  h += '</select></div>';
  h += '<div class="fm-group"><label>สถานะ</label><select id="prod_status">';
  h += '<option value="active">✅ มีขาย</option>';
  h += '<option value="eol">⏰ EOL (停产)</option>';
  h += '</select></div></div>';
  h += '<div class="form-section">💰 ราคา (ไม่รวม VAT)</div>';
  h += '<div class="fr"><div class="fm-group"><label>Level S</label><input type="number" id="prod_price_s"></div>';
  h += '<div class="fm-group"><label>Level A</label><input type="number" id="prod_price_a"></div></div>';
  h += '<div class="fr"><div class="fm-group"><label>Level B (MSRP)</label><input type="number" id="prod_price_b"></div>';
  h += '<div class="fm-group"><label>Level Other</label><input type="number" id="prod_price_other"></div></div>';
  h += '<div class="fm-actions"><button class="btn btn-blue" onclick="saveNewProduct()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
  openM('➕ เพิ่มสินค้า', h);
}

function saveNewProduct() {
  var name = document.getElementById('prod_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  
  var productData = {
    name: name,
    sku: document.getElementById('prod_sku').value.trim(),
    ean: document.getElementById('prod_ean').value.trim(),
    price: parseFloat(document.getElementById('prod_price_b').value) || 0,
    typePrices: {
      S: parseFloat(document.getElementById('prod_price_s').value) || 0,
      A: parseFloat(document.getElementById('prod_price_a').value) || 0,
      B: parseFloat(document.getElementById('prod_price_b').value) || 0,
      Other: parseFloat(document.getElementById('prod_price_other').value) || 0
    },
    eol: document.getElementById('prod_status').value === 'eol',
    isSoftware: document.getElementById('prod_type').value === 'software',
    isService: document.getElementById('prod_type').value === 'service'
  };
  
  Products.add(productData);
  closeMForce();
  toast('✅ เพิ่มสินค้าแล้ว');
  render();
}

function showEditProductM(productId) {
  var p = Products.getById(productId);
  if (!p) return;
  
  var h = '<div style="max-width:500px">';
  h += '<div class="fm-group"><label>SKU</label><input type="text" id="prod_sku" value="' + sanitize(p.sku || '') + '"></div>';
  h += '<div class="fm-group"><label>EAN</label><input type="text" id="prod_ean" value="' + sanitize(p.ean || '') + '"></div>';
  h += '<div class="fm-group"><label>ชื่อสินค้า *</label><input type="text" id="prod_name" value="' + sanitize(p.name) + '"></div>';
  h += '<div class="fr"><div class="fm-group"><label>ประเภท</label><select id="prod_type">';
  h += '<option value="hardware"' + (!p.isSoftware && !p.isService ? ' selected' : '') + '>🖥️ Hardware</option>';
  h += '<option value="software"' + (p.isSoftware ? ' selected' : '') + '>💻 Software</option>';
  h += '<option value="service"' + (p.isService ? ' selected' : '') + '>🛠️ Service</option>';
  h += '</select></div>';
  h += '<div class="fm-group"><label>สถานะ</label><select id="prod_status">';
  h += '<option value="active"' + (!p.eol ? ' selected' : '') + '>✅ มีขาย</option>';
  h += '<option value="eol"' + (p.eol ? ' selected' : '') + '>⏰ EOL</option>';
  h += '</select></div></div>';
  h += '<div class="form-section">💰 ราคา (ไม่รวม VAT)</div>';
  h += '<div class="fr"><div class="fm-group"><label>Level S</label><input type="number" id="prod_price_s" value="' + (p.typePrices?.S || '') + '"></div>';
  h += '<div class="fm-group"><label>Level A</label><input type="number" id="prod_price_a" value="' + (p.typePrices?.A || '') + '"></div></div>';
  h += '<div class="fr"><div class="fm-group"><label>Level B</label><input type="number" id="prod_price_b" value="' + (p.price || '') + '"></div>';
  h += '<div class="fm-group"><label>Level Other</label><input type="number" id="prod_price_other" value="' + (p.typePrices?.Other || '') + '"></div></div>';
  h += '<div class="fm-actions"><button class="btn btn-blue" onclick="updateProduct(\'' + productId + '\')">💾 บันทึก</button>';
  h += '<button class="btn bd" onclick="deleteProductConfirm(\'' + productId + '\')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
  openM('✏️ แก้ไขสินค้า', h);
}

function updateProduct(productId) {
  var name = document.getElementById('prod_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  
  var updates = {
    name: name,
    sku: document.getElementById('prod_sku').value.trim(),
    ean: document.getElementById('prod_ean').value.trim(),
    price: parseFloat(document.getElementById('prod_price_b').value) || 0,
    typePrices: {
      S: parseFloat(document.getElementById('prod_price_s').value) || 0,
      A: parseFloat(document.getElementById('prod_price_a').value) || 0,
      B: parseFloat(document.getElementById('prod_price_b').value) || 0,
      Other: parseFloat(document.getElementById('prod_price_other').value) || 0
    },
    eol: document.getElementById('prod_status').value === 'eol',
    isSoftware: document.getElementById('prod_type').value === 'software',
    isService: document.getElementById('prod_type').value === 'service'
  };
  
  Products.update(productId, updates);
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

function deleteProductConfirm(productId) {
  if (!confirm('ลบสินค้านี้?')) return;
  Products.delete(productId);
  closeMForce();
  toast('🗑️ ลบแล้ว');
  render();
}

// ================================================================
// PAGE: ราคาตาม Level
// ================================================================

function rProductPrices(el) {
  document.getElementById('pgT').textContent = '💰 ราคาตาม Level';
  
  var products = Products.getAll();
  var levels = ['S', 'A', 'B', 'Other'];
  
  var html = '<div class="card"><h2>💰 ราคาสินค้าแยกตาม Level</h2>';
  html += '<div class="export-wrap"><table class="export-table" id="priceTable">';
  html += '<thead><tr><th>#</th><th>สินค้า</th><th>ราคา S</th><th>ราคา A</th><th>ราคา B</th><th>ราคา Other</th><th></th></tr></thead>';
  html += '<tbody>';
  
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    html += '<tr>';
    html += '<td class="pipe-row-num">' + (i + 1) + '</td>';
    html += '<td><strong>' + sanitize(p.name) + '</strong></td>';
    html += '<td><input type="number" id="price_s_' + p.id + '" value="' + (p.typePrices?.S || '') + '" style="width:100px" class="fm-input"></td>';
    html += '<td><input type="number" id="price_a_' + p.id + '" value="' + (p.typePrices?.A || '') + '" style="width:100px" class="fm-input"></td>';
    html += '<td><input type="number" id="price_b_' + p.id + '" value="' + (p.price || '') + '" style="width:100px" class="fm-input"></td>';
    html += '<td><input type="number" id="price_o_' + p.id + '" value="' + (p.typePrices?.Other || '') + '" style="width:100px" class="fm-input"></td>';
    html += '<td><button class="btn bsm bp" onclick="saveSingleProductPrice(\'' + p.id + '\')">💾</button></td>';
    html += '<tr>';
  }
  
  html += '</tbody></table></div>';
  html += '<div class="bg" style="margin-top:12px"><button class="btn bp" onclick="saveAllProductPrices()">💾 บันทึกทั้งหมด</button></div>';
  html += '</div>';
  el.innerHTML = html;
}

function saveSingleProductPrice(productId) {
  var priceS = parseFloat(document.getElementById('price_s_' + productId).value) || 0;
  var priceA = parseFloat(document.getElementById('price_a_' + productId).value) || 0;
  var priceB = parseFloat(document.getElementById('price_b_' + productId).value) || 0;
  var priceO = parseFloat(document.getElementById('price_o_' + productId).value) || 0;
  
  Products.update(productId, {
    price: priceB,
    typePrices: { S: priceS, A: priceA, B: priceB, Other: priceO }
  });
  toast('💾 บันทึกราคาแล้ว');
}

function saveAllProductPrices() {
  var products = Products.getAll();
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var priceS = parseFloat(document.getElementById('price_s_' + p.id).value) || 0;
    var priceA = parseFloat(document.getElementById('price_a_' + p.id).value) || 0;
    var priceB = parseFloat(document.getElementById('price_b_' + p.id).value) || 0;
    var priceO = parseFloat(document.getElementById('price_o_' + p.id).value) || 0;
    
    Products.update(p.id, {
      price: priceB,
      typePrices: { S: priceS, A: priceA, B: priceB, Other: priceO }
    });
  }
  toast('💾 บันทึกราคาทั้งหมดแล้ว');
}

// ================================================================
// PAGE: BUNDLE/COMBO (Placeholder)
// ================================================================

function rProductBundles(el) {
  document.getElementById('pgT').textContent = '🎁 Bundle/Combo';
  var bundles = Products.getAllBundles();
  
  var html = '<div class="card"><h2>🎁 Bundle/Combo <span class="ml"><button class="btn bp" onclick="showAddBundleM()">➕ เพิ่ม Bundle</button></span></h2>';
  
  if (!bundles.length) {
    html += '<div class="empty"><p>ยังไม่มี Bundle/Combo</p><button class="btn bp" onclick="showAddBundleM()">➕ สร้าง Bundle แรก</button></div>';
  } else {
    for (var i = 0; i < bundles.length; i++) {
      var b = bundles[i];
      html += '<div class="card" style="margin-bottom:12px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      html += '<h3>' + sanitize(b.name) + '</h3>';
      html += '<div><button class="btn bsm bo" onclick="editBundle(\'' + b.id + '\')">✏️</button>';
      html += '<button class="btn bsm bd" onclick="deleteBundle(\'' + b.id + '\')">🗑️</button></div>';
      html += '</div>';
      if (b.description) html += '<p>' + sanitize(b.description) + '</p>';
      html += '<div class="fr"><div>S: ' + fmtMoney(b.typePrices?.S) + '</div>';
      html += '<div>A: ' + fmtMoney(b.typePrices?.A) + '</div>';
      html += '<div>B: ' + fmtMoney(b.typePrices?.B) + '</div>';
      html += '<div>Other: ' + fmtMoney(b.typePrices?.Other) + '</div></div>';
      html += '</div>';
    }
  }
  
  html += '</div>';
  el.innerHTML = html;
}

function showAddBundleM() {
  toast('🚧 กำลังพัฒนา');
}

// ================================================================
// PAGE: DEMO UNIT (Placeholder)
// ================================================================

function rProductDemo(el) {
  document.getElementById('pgT').textContent = '🚁 Demo Unit';
  var demos = Products.getAllDemoUnits();
  
  var html = '<div class="card"><h2>🚁 Demo Unit Pricing <span class="ml"><button class="btn bp" onclick="showAddDemoUnitM()">➕ เพิ่ม Demo Unit</button></span></h2>';
  
  if (!demos.length) {
    html += '<div class="empty"><p>ยังไม่มี Demo Unit</p></div>';
  } else {
    html += '<div class="export-wrap"><table class="export-table">';
    html += '<thead><tr><th>#</th><th>SKU</th><th>EAN</th><th>สินค้า</th><th>ราคา Demo</th><th></th></tr></thead><tbody>';
    for (var i = 0; i < demos.length; i++) {
      var d = demos[i];
      html += '<tr>';
      html += '<td class="pipe-row-num">' + (i + 1) + '</td>';
      html += '<td>' + (d.sku || '-') + '</td>';
      html += '<td>' + (d.ean || '-') + '</td>';
      html += '<td>' + sanitize(d.productName || d.name) + '</td>';
      html += '<td style="text-align:right">' + fmtMoney(d.price) + '</td>';
      html += '<td><button class="btn bsm bo" onclick="editDemoUnit(\'' + d.id + '\')">✏️</button></td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
  }
  
  html += '</div>';
  el.innerHTML = html;
}

function showAddDemoUnitM() {
  toast('🚧 กำลังพัฒนา');
}

// ================================================================
// PAGE: IMPORT/EXPORT (Full Version)
// ================================================================

function rProductImport(el) {
  document.getElementById('pgT').textContent = '📥 Import/Export สินค้า';
  
  var html = '';
  
  // Export Section
  html += '<div class="card">';
  html += '<h2>📤 Export สินค้า</h2>';
  html += '<p class="hint">Export ข้อมูลสินค้าทั้งหมดไปเป็นไฟล์ Excel เพื่อแก้ไข</p>';
  html += '<div class="bg">';
  html += '<button class="btn bp" onclick="exportProductsToExcel()">📥 Export สินค้าทั้งหมด</button>';
  html += '<button class="btn bo" onclick="exportDemoUnitsToExcel()">🚁 Export Demo Units</button>';
  html += '</div>';
  html += '</div>';
  
  // Import Section
  html += '<div class="card">';
  html += '<h2>📥 Import สินค้า (Update)</h2>';
  html += '<p class="hint">เลือกไฟล์ Excel ที่ Export ไว้ แก้ไขแล้วนำกลับมา import</p>';
  html += '<div class="fg">';
  html += '<input type="file" id="importProductsFile" accept=".xlsx,.xls" style="margin-bottom:8px">';
  html += '<button class="btn bp" onclick="doImportProducts()">📤 เริ่ม Import สินค้า</button>';
  html += '</div>';
  html += '<div id="importProgress" style="margin-top:8px; display:none">';
  html += '<div class="pb"><div class="pf pf-blue" id="importProgressBar" style="width:0%"></div></div>';
  html += '<div id="importStatus" style="margin-top:4px; font-size:12px"></div>';
  html += '</div>';
  html += '</div>';
  
  // Import Demo Section
  html += '<div class="card">';
  html += '<h2>🚁 Import Demo Units</h2>';
  html += '<div class="fg">';
  html += '<input type="file" id="importDemoFile" accept=".xlsx,.xls">';
  html += '<button class="btn bp" onclick="doImportDemoUnits()">📤 Import Demo Units</button>';
  html += '</div>';
  html += '</div>';
  
  // Instructions
  html += '<div class="card">';
  html += '<h2>📋 คำแนะนำ</h2>';
  html += '<div class="hint">';
  html += '1. กด "Export สินค้าทั้งหมด" เพื่อดาวน์โหลดไฟล์ Excel<br>';
  html += '2. เปิดไฟล์ Excel ด้วยโปรแกรม (Excel, Google Sheets, WPS)<br>';
  html += '3. แก้ไขข้อมูลที่ต้องการ (ชื่อ, SKU, EAN, ราคา, EOL, Type)<br>';
  html += '4. บันทึกไฟล์ (อย่าเปลี่ยนชื่อคอลัมน์)<br>';
  html += '5. กด "เลือกไฟล์" แล้ว "เริ่ม Import"<br>';
  html += '<br>';
  html += '💡 <strong>คอลัมน์ที่ต้องมี:</strong><br>';
  html += '• SKU (SiS part) - รหัสสินค้า<br>';
  html += '• EAN - บาร์โค้ดสินค้า<br>';
  html += '• Product Name - ชื่อสินค้า<br>';
  html += '• Price S/A/B/Other - ราคาแยกตาม Level<br>';
  html += '• EOL - ใส่ "EOL" ถ้าสินค้าหมดอายุ<br>';
  html += '• Type - Hardware / Software / Service<br>';
  html += '</div>';
  html += '</div>';
  
  el.innerHTML = html;
}

// ================================================================
// IMPORT ACTIONS (UI Handlers)
// ================================================================

function doImportProducts() {
  var fileInput = document.getElementById('importProductsFile');
  var file = fileInput.files[0];
  
  if (!file) {
    toast('⚠️ กรุณาเลือกไฟล์ Excel');
    return;
  }
  
  // Show progress
  var progressDiv = document.getElementById('importProgress');
  var progressBar = document.getElementById('importProgressBar');
  var statusDiv = document.getElementById('importStatus');
  
  progressDiv.style.display = 'block';
  progressBar.style.width = '30%';
  statusDiv.innerHTML = 'กำลังอ่านไฟล์...';
  
  importProductsFromExcel(file, function(result) {
    if (result.success) {
      progressBar.style.width = '100%';
      statusDiv.innerHTML = '✅ นำเข้าเสร็จ! เพิ่ม ' + result.imported + ' รายการ, อัปเดต ' + result.updated + ' รายการ' + (result.errors ? ' (ผิดพลาด ' + result.errors + ')' : '');
      
      if (result.errorList && result.errorList.length) {
        statusDiv.innerHTML += '<br><span style="color:#f59e0b">⚠️ ' + result.errorList.slice(0, 5).join('<br>') + '</span>';
      }
      
      toast('✅ Import สำเร็จ! ' + (result.imported + result.updated) + ' รายการ');
      
      setTimeout(function() {
        progressDiv.style.display = 'none';
        progressBar.style.width = '0%';
        fileInput.value = '';
        render(); // รีเฟรชหน้า
      }, 2000);
    } else {
      progressBar.style.width = '0%';
      statusDiv.innerHTML = '❌ เกิดข้อผิดพลาด: ' + result.error;
      toast('❌ Import ล้มเหลว', true);
    }
  });
}

function doImportDemoUnits() {
  var fileInput = document.getElementById('importDemoFile');
  var file = fileInput.files[0];
  
  if (!file) {
    toast('⚠️ กรุณาเลือกไฟล์ Demo Units');
    return;
  }
  
  toast('🔄 กำลังนำเข้า Demo Units...');
  
  importDemoUnitsFromExcel(file, function(result) {
    if (result.success) {
      toast('✅ Import Demo Units สำเร็จ! เพิ่ม ' + result.imported + ', อัปเดต ' + result.updated);
      fileInput.value = '';
      render();
    } else {
      toast('❌ Import Demo Units ล้มเหลว: ' + result.error, true);
    }
  });
}

// ================================================================
// EXPORT PRODUCTS TO EXCEL
// ================================================================

function exportProductsToExcel() {
  var products = Products.getAll();
  
  // จัดรูปแบบข้อมูลสำหรับ Excel
  var excelData = products.map(function(p, idx) {
    return {
      '#': idx + 1,
      'SKU (SiS part)': p.sku || '',
      'EAN': p.ean || '',
      'Product Name': p.name,
      'Price S (Type 1)': p.typePrices?.S || 0,
      'Price A (Type 2)': p.typePrices?.A || 0,
      'Price B (Type 3)': p.price || 0,
      'Price Other (Type 4)': p.typePrices?.Other || 0,
      'EOL': p.eol ? 'EOL' : '',
      'Type': p.isSoftware ? 'Software' : (p.isService ? 'Service' : 'Hardware'),
      'Last Updated': p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('th-TH') : ''
    };
  });
  
  // สร้าง worksheet
  var ws = XLSX.utils.json_to_sheet(excelData);
  
  // จัดความกว้างคอลัมน์
  ws['!cols'] = [
    {wch:5},   // #
    {wch:20},  // SKU
    {wch:15},  // EAN
    {wch:40},  // Product Name
    {wch:12},  // Price S
    {wch:12},  // Price A
    {wch:12},  // Price B
    {wch:12},  // Price Other
    {wch:8},   // EOL
    {wch:12},  // Type
    {wch:12}   // Last Updated
  ];
  
  // สร้าง workbook
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  
  // ดาวน์โหลด
  XLSX.writeFile(wb, 'products-export-' + _td() + '.xlsx');
  
  toast('📥 Export Excel สำเร็จ!');
}

// ================================================================
// EXPORT DEMO UNITS TO EXCEL
// ================================================================

function exportDemoUnitsToExcel() {
  var demos = Products.getAllDemoUnits();
  
  var excelData = demos.map(function(d, idx) {
    // หา product ที่เกี่ยวข้อง
    var product = d.productId ? Products.getById(d.productId) : null;
    
    return {
      '#': idx + 1,
      'SKU': d.sku || '',
      'EAN': d.ean || '',
      'Product Name': d.productName || d.name || '',
      'Demo Price': d.price || 0,
      'Related Product': product ? product.name : '',
      'Status': d.enabled ? 'Active' : 'Inactive',
      'Note': d.note || ''
    };
  });
  
  var ws = XLSX.utils.json_to_sheet(excelData);
  ws['!cols'] = [{wch:5}, {wch:20}, {wch:15}, {wch:40}, {wch:15}, {wch:30}, {wch:10}, {wch:20}];
  
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DemoUnits');
  XLSX.writeFile(wb, 'demo-units-export-' + _td() + '.xlsx');
  
  toast('📥 Export Demo Units สำเร็จ!');
}

// ================================================================
// IMPORT PRODUCTS FROM EXCEL FILE
// ================================================================

function importProductsFromExcel(file, onComplete) {
  var reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet);
      
      var imported = 0;
      var updated = 0;
      var errors = 0;
      var errorList = [];
      
      for (var i = 0; i < rows.length; i++) {
        try {
          var row = rows[i];
          
          // อ่านข้อมูลจาก Excel (รองรับหลายรูปแบบคอลัมน์)
          var sku = row['SKU (SiS part)'] || row['SKU'] || row['SiS part'] || '';
          var ean = row['EAN'] || '';
          var name = row['Product Name'] || row['name'] || '';
          var priceS = parseFloat(row['Price S (Type 1)'] || row['Price S'] || row['Type 1'] || 0);
          var priceA = parseFloat(row['Price A (Type 2)'] || row['Price A'] || row['Type 2'] || 0);
          var priceB = parseFloat(row['Price B (Type 3)'] || row['Price B'] || row['Type 3'] || row['price'] || 0);
          var priceOther = parseFloat(row['Price Other (Type 4)'] || row['Price Other'] || row['Type 4'] || 0);
          var eol = (row['EOL'] === 'EOL' || row['EOL'] === true || row['eol'] === 'EOL');
          var type = row['Type'] || 'Hardware';
          
          if (!name) {
            errors++;
            errorList.push('Row ' + (i+2) + ': ไม่มีชื่อสินค้า');
            continue;
          }
          
          // ตรวจสอบว่ามีสินค้านี้อยู่แล้วหรือไม่
          var existing = Products.getBySku(sku) || Products.getByEan(ean);
          
          var productData = {
            name: name,
            sku: sku,
            ean: ean,
            price: priceB,
            typePrices: { S: priceS, A: priceA, B: priceB, Other: priceOther },
            eol: eol,
            isSoftware: (type === 'Software' || name.indexOf('FlightHub') !== -1 || name.indexOf('Terra') !== -1),
            isService: (type === 'Service' || name.indexOf('Warranty') !== -1 || name.indexOf('Service') !== -1)
          };
          
          if (existing) {
            Products.update(existing.id, productData);
            updated++;
          } else {
            Products.add(productData);
            imported++;
          }
        } catch(err) {
          errors++;
          errorList.push('Row ' + (i+2) + ': ' + err.message);
        }
      }
      
      var result = {
        success: true,
        imported: imported,
        updated: updated,
        errors: errors,
        errorList: errorList,
        total: rows.length
      };
      
      if (onComplete) onComplete(result);
      
    } catch(err) {
      if (onComplete) onComplete({ success: false, error: err.message });
    }
  };
  
  reader.onerror = function() {
    if (onComplete) onComplete({ success: false, error: 'ไม่สามารถอ่านไฟล์ได้' });
  };
  
  reader.readAsArrayBuffer(file);
}

// ================================================================
// IMPORT DEMO UNITS FROM EXCEL FILE
// ================================================================

function importDemoUnitsFromExcel(file, onComplete) {
  var reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet);
      
      var imported = 0;
      var updated = 0;
      var errors = 0;
      
      for (var i = 0; i < rows.length; i++) {
        try {
          var row = rows[i];
          var sku = row['SKU'] || '';
          var ean = row['EAN'] || '';
          var name = row['Product Name'] || row['name'] || '';
          var price = parseFloat(row['Demo Price'] || row['price'] || 0);
          var enabled = (row['Status'] !== 'Inactive');
          
          if (!name) continue;
          
          // หา product ที่เกี่ยวข้อง
          var product = Products.getBySku(sku) || Products.getByEan(ean);
          
          var existingDemo = null;
          var allDemos = Products.getAllDemoUnits();
          for (var j = 0; j < allDemos.length; j++) {
            if (allDemos[j].sku === sku || allDemos[j].ean === ean) {
              existingDemo = allDemos[j];
              break;
            }
          }
          
          var demoData = {
            productId: product ? product.id : null,
            productName: name,
            sku: sku,
            ean: ean,
            price: price,
            enabled: enabled
          };
          
          if (existingDemo) {
            Products.updateDemoUnit(existingDemo.id, demoData);
            updated++;
          } else {
            Products.addDemoUnit(demoData);
            imported++;
          }
        } catch(err) {
          errors++;
        }
      }
      
      if (onComplete) onComplete({ success: true, imported: imported, updated: updated, errors: errors, total: rows.length });
    } catch(err) {
      if (onComplete) onComplete({ success: false, error: err.message });
    }
  };
  
  reader.readAsArrayBuffer(file);
}