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
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(data));
  
  // Sync กลับไปยัง config เดิม (เพื่อให้ระบบเก่าทำงานได้)
  var cfg = getConfigFromLocalStorage();
  if (cfg) {
    cfg.models = data.models;
    if (!cfg.bundles) cfg.bundles = data.bundles;
    if (!cfg.demoUnitPrices) cfg.demoUnitPrices = {};
    cfg.demoUnitPrices.items = data.demoUnits;
    localStorage.setItem('v7_config', JSON.stringify(cfg));
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
    if (products[i].id === id) return products[i];
    // backward compatible: ถ้าไม่มี id ให้ใช้ index แทน
    if (!products[i].id && i.toString() === id) return products[i];
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
    var pId = p.id || i.toString();
    if (pId === productId) {
      for (var key in updates) {
        if (updates.hasOwnProperty(key)) {
          if (key === 'typePrices' && typeof updates[key] === 'object') {
            if (!p.typePrices) p.typePrices = {};
            for (var level in updates[key]) {
              p.typePrices[level] = updates[key][level];
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
  return false;
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
    // copy from config
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