// ================================================================
// PRODUCTS MANAGEMENT MODULE - COMPLETE VERSION
// ================================================================

var PRODUCTS_STORAGE_KEY = 'v7_products';

// ================================================================
// CORE DATA MANAGEMENT
// ================================================================

function getProductsData() {
  try {
    var saved = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (saved) {
      var parsed = JSON.parse(saved);
      
      // Case 1: เป็น array โดยตรง (Firebase sync เขียนมาแบบนี้)
      if (Array.isArray(parsed)) {
        return {
          models: parsed,
          bundles: [],
          demoUnits: [],
          levelPrices: { S: {}, A: {}, B: {}, Other: {} },
          lastUpdated: null,
          version: '1.0'
        };
      }
      
      // Case 2: เป็น object แบบ {0: {...}, 1: {...}} (Object.values แปลงเป็น array ได้)
      if (parsed && typeof parsed === 'object' && !parsed.models && !parsed.bundles && !parsed.demoUnits) {
        var values = Object.values(parsed);
        if (values.length > 0 && values[0].id) {
          return {
            models: values,
            bundles: [],
            demoUnits: [],
            levelPrices: { S: {}, A: {}, B: {}, Other: {} },
            lastUpdated: null,
            version: '1.0'
          };
        }
      }
      
      // Case 3: format ปกติ (มี models, bundles, demoUnits)
      if (!parsed.models) parsed.models = [];
      if (!parsed.bundles) parsed.bundles = [];
      if (!parsed.demoUnits) parsed.demoUnits = [];
      return parsed;
    }
  } catch(e) {
    console.warn('Error parsing products data:', e);
  }
  
  // Fallback: สร้างโครงสร้างเริ่มต้น
  return {
    models: [],
    bundles: [],
    demoUnits: [],
    levelPrices: { S: {}, A: {}, B: {}, Other: {} },
    lastUpdated: null,
    version: '1.0'
  };
}
function initProductsModule() {
  var data = getProductsData();
  
  // ตรวจสอบให้แน่ใจว่า data มี properties ที่จำเป็น
  if (!data.models) data.models = [];
  if (!data.bundles) data.bundles = [];
  if (!data.demoUnits) data.demoUnits = [];
  
  if (data.models.length === 0) {
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
  
  if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    loadProductsFromFirebase().then(function(loaded) {
      if (loaded && typeof render === 'function') render();
    });
  }
  
  console.log('✅ Products Module initialized', data.models.length, 'products');
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
// SAVE PRODUCTS DATA
// ================================================================

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
// EOL
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
// UTILITIES
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
// CLEANUP
// ================================================================

function cleanOldConfigModels() {
  var cfg = localStorage.getItem('v7_config');
  if (cfg) {
    var config = JSON.parse(cfg);
    if (config.models) {
      delete config.models;
      localStorage.setItem('v7_config', JSON.stringify(config));
      console.log('✅ ลบข้อมูลสินค้าเก่า (v7_config.models) แล้ว');
    }
  }
}

// ================================================================
// EXPORT/IMPORT EXCEL
// ================================================================

function exportProductsToExcel() {
  var products = getAllProducts();
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
  
  var ws = XLSX.utils.json_to_sheet(excelData);
  ws['!cols'] = [{wch:5}, {wch:20}, {wch:15}, {wch:40}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:8}, {wch:12}, {wch:12}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, 'products-export-' + _td() + '.xlsx');
  toast('📥 Export Excel สำเร็จ!');
}

function exportDemoUnitsToExcel() {
  var demos = getAllDemoUnits();
  var excelData = demos.map(function(d, idx) {
    var product = d.productId ? getProductById(d.productId) : null;
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

function importProductsFromExcel(file, onComplete) {
  var reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet);
      
      if (!rows || rows.length === 0) {
        if (onComplete) onComplete({ success: false, error: 'ไม่มีข้อมูลในไฟล์ Excel' });
        return;
      }
      
      var imported = 0;
      var updated = 0;
      var errors = 0;
      var errorList = [];
      
      for (var i = 0; i < rows.length; i++) {
        try {
          var row = rows[i];
          
          var sku = row['SKU (SiS part)'] || row['SKU'] || row['SiS part'] || '';
          var ean = row['EAN'] || '';
          var name = row['Product Name'] || row['name'] || '';
          var priceS = parseFloat(row['Price S (Type 1)'] || row['Price S'] || row['Type 1'] || 0);
          var priceA = parseFloat(row['Price A (Type 2)'] || row['Price A'] || row['Type 2'] || 0);
          var priceB = parseFloat(row['Price B (Type 3)'] || row['Price B'] || row['Type 3'] || row['price'] || 0);
          var priceOther = parseFloat(row['Price Other (Type 4)'] || row['Price Other'] || row['Type 4'] || 0);
          var eol = (row['EOL'] === 'EOL' || row['EOL'] === true);
          var type = row['Type'] || 'Hardware';
          
          if (!name) {
            errors++;
            errorList.push('Row ' + (i+2) + ': ไม่มีชื่อสินค้า');
            continue;
          }
          
          var existing = getProductBySku(sku) || getProductByEan(ean);
          
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
            updateProduct(existing.id, productData);
            updated++;
          } else {
            addProduct(productData);
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

function importDemoUnitsFromExcel(file, onComplete) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet);
      var imported = 0, updated = 0, errors = 0;
      for (var i = 0; i < rows.length; i++) {
        try {
          var row = rows[i];
          var sku = row['SiS part'] || row['SKU'] || '';
          var ean = row['EAN'] || '';
          var name = row['Product Name'] || row['name'] || '';
          var price = parseFloat(row['TYPE1-4 P THB ex VAT'] || row['Demo Price'] || row['price'] || 0);
          if (!name) continue;
          var product = getProductBySku(sku) || getProductByEan(ean);
          var existingDemo = null;
          var allDemos = getAllDemoUnits();
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
            enabled: true
          };
          if (existingDemo) {
            updateDemoUnit(existingDemo.id, demoData);
            updated++;
          } else {
            addDemoUnit(demoData);
            imported++;
          }
        } catch(err) { errors++; }
      }
      if (onComplete) onComplete({ success: true, imported: imported, updated: updated, errors: errors, total: rows.length });
    } catch(err) {
      if (onComplete) onComplete({ success: false, error: err.message });
    }
  };
  reader.readAsArrayBuffer(file);
}
// ================================================================
// IMPORT ข้อมูลทั้งหมดจาก Excel (3 แผ่นงานในครั้งเดียว)
// ================================================================

function importProductsFromRows(rows) {
  var imported = 0, updated = 0, errors = 0;
  for (var i = 0; i < rows.length; i++) {
    try {
      var row = rows[i];
      var sku = (row['SiS part'] || row['SKU'] || '').toString().trim();
      var ean = (row['EAN'] || '').toString().trim();
      var name = (row['Product Name'] || row['name'] || '').toString().trim();
      
      // ข้ามแถวที่เป็น bundle (SKU ลงท้ายด้วย 'A', EAN ขึ้นต้นด้วย 'CB.', หรือชื่อมีคำว่า Extended Warranty/SP Plus)
      if (sku && sku.endsWith('A')) continue;
      if (ean && ean.startsWith('CB.')) continue;
      if (name && (name.includes('Extended Warranty') || name.includes('SP Plus +'))) continue;
      
      if (!name) continue;
      
      // อ่านราคา (ใช้คอลัมน์ตามที่ปรากฏในไฟล์ Excel)
      var priceS = parseFloat(row['Type 1 P EX Tax THB']) || 0;
      var priceA = parseFloat(row['Type 2 P EX Tax THB']) || 0;
      var priceB = parseFloat(row['Type 3 P EX Tax THB']) || 0;
      var priceOther = parseFloat(row['Type 4 P EX Tax THB']) || 0;
      var rrp = parseFloat(row['RRP Ex Vat']) || 0;
      
      // หาก priceB เป็น 0 แต่มี RRP ให้ใช้ RRP แทน
      if (priceB === 0 && rrp > 0) priceB = rrp;
      
      // ตรวจสอบสินค้าซ้ำ
      var existing = getProductBySku(sku) || getProductByEan(ean);
      var productData = {
        name: name,
        sku: sku,
        ean: ean,
        price: priceB,
        typePrices: { S: priceS, A: priceA, B: priceB, Other: priceOther },
        eol: false,
        isSoftware: (name.indexOf('FlightHub') !== -1 || name.indexOf('Terra') !== -1),
        isService: (name.indexOf('Warranty') !== -1 || name.indexOf('Service') !== -1)
      };
      
      if (existing) {
        updateProduct(existing.id, productData);
        updated++;
      } else {
        addProduct(productData);
        imported++;
      }
    } catch(e) {
      errors++;
      console.warn('Import product error at row', i, e);
    }
  }
  return { imported: imported, updated: updated, errors: errors };
}
function importBundlesFromRows(rows) {
  var imported = 0, updated = 0, errors = 0;
  var bundleMap = {};
  
  for (var i = 0; i < rows.length; i++) {
    try {
      var row = rows[i];
      var comboNo = row['combo No.'] || row['comboNo'] || '';
      if (!comboNo) continue;
      
      if (!bundleMap[comboNo]) {
        // รองรับชื่อ column ที่มี newline
        var priceS = parseFloat(row['Type 1 P\nEX Tax THB'] || row['Type 1 P EX Tax THB'] || 0);
        var priceA = parseFloat(row['Type 2 P\nEX Tax  THB'] || row['Type 2 P EX Tax THB'] || 0);
        var priceB = parseFloat(row['Type 3 P\nEX Tax THB'] || row['Type 3 P EX Tax THB'] || 0);
        var priceOther = parseFloat(row['Type 4 P\nEX Tax THB'] || row['Type 4 P EX Tax THB'] || 0);
        
        bundleMap[comboNo] = {
          name: row['combo name'] || row['comboName'] || '',
          description: row['combo description'] || '',
          items: [],
          typePrices: { S: priceS, A: priceA, B: priceB, Other: priceOther },
          enabled: true
        };
      }
      
      var productEan = row['product EAN'] || row['productEAN'] || '';
      var qty = parseInt(row['quantity']) || 1;
      var productName = row['product name'] || '';
      
      if (productEan) {
        var product = getProductByEan(productEan);
        if (product) {
          bundleMap[comboNo].items.push({
            productId: product.id,
            sku: product.sku,
            name: product.name,
            qty: qty
          });
        } else {
          bundleMap[comboNo].items.push({
            productId: null,
            sku: '',
            name: productName,
            qty: qty
          });
        }
      }
    } catch(e) {
      errors++;
    }
  }
  
  for (var combo in bundleMap) {
    var b = bundleMap[combo];
    if (!b.name) continue;
    var existing = getBundleByName(b.name);
    if (existing) {
      updateBundle(existing.id, b);
      updated++;
    } else {
      addBundle(b);
      imported++;
    }
  }
  
  return { imported: imported, updated: updated, errors: errors };
}
function importDemoUnitsFromRows(rows) {
  var imported = 0, updated = 0, errors = 0;
  for (var i = 0; i < rows.length; i++) {
    try {
      var row = rows[i];
      var sku = row['SiS part'] || row['SKU'] || '';
      var ean = row['EAN'] || '';
      var name = row['Product Name'] || row['name'] || '';
      var price = parseFloat(row['TYPE1-4 P THB ex VAT'] || row['Demo Price'] || 0);
      if (!name) continue;
      var product = getProductBySku(sku) || getProductByEan(ean);
      var existing = null;
      var allDemos = getAllDemoUnits();
      for (var j = 0; j < allDemos.length; j++) {
        if (allDemos[j].sku === sku || allDemos[j].ean === ean) {
          existing = allDemos[j];
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
      if (existing) { updateDemoUnit(existing.id, demoData); updated++; }
      else { addDemoUnit(demoData); imported++; }
    } catch(e) { errors++; }
  }
  return { imported: imported, updated: updated, errors: errors };
}

function importFullExcelData(file, onComplete) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var result = {
        products: { imported: 0, updated: 0, errors: 0 },
        bundles: { imported: 0, updated: 0, errors: 0 },
        demos: { imported: 0, updated: 0, errors: 0 }
      };
      
      // นำเข้าสินค้าจาก sheet 'single' (ข้าม bundle แล้ว)
      if (workbook.SheetNames.includes('single')) {
        var sheet = workbook.Sheets['single'];
        var rows = XLSX.utils.sheet_to_json(sheet);
        result.products = importProductsFromRows(rows);
      }
      
      // นำเข้า bundles จาก sheet 'combo'
      if (workbook.SheetNames.includes('combo')) {
        var sheet = workbook.Sheets['combo'];
        var rows = XLSX.utils.sheet_to_json(sheet);
        result.bundles = importBundlesFromRows(rows);
      }
      
      // นำเข้า demo units จาก sheet 'demo'
      if (workbook.SheetNames.includes('demo')) {
        var sheet = workbook.Sheets['demo'];
        var rows = XLSX.utils.sheet_to_json(sheet);
        result.demos = importDemoUnitsFromRows(rows);
      }
      
      if (onComplete) onComplete({ success: true, result: result });
    } catch(err) {
      if (onComplete) onComplete({ success: false, error: err.message });
    }
  };
  reader.readAsArrayBuffer(file);
}

function doImportFullExcel() {
  var fileInput = document.getElementById('importFullFile');
  if (!fileInput || !fileInput.files[0]) { toast('⚠️ กรุณาเลือกไฟล์ Excel'); return; }
  var progressDiv = document.getElementById('importFullProgress');
  var progressBar = progressDiv ? progressDiv.querySelector('.pf') : null;
  var statusDiv = document.getElementById('importFullStatus');
  if (progressDiv) progressDiv.style.display = 'block';
  if (progressBar) progressBar.style.width = '30%';
  if (statusDiv) statusDiv.innerHTML = 'กำลังนำเข้าข้อมูล...';
  toast('🔄 กำลังนำเข้าทั้งหมด (สินค้า, Bundle, Demo)...');
  importFullExcelData(fileInput.files[0], function(res) {
    if (res.success) {
      if (progressBar) progressBar.style.width = '100%';
      var msg = '✅ นำเข้าเสร็จ! ';
      msg += 'สินค้า: +' + res.result.products.imported + ' อัปเดต ' + res.result.products.updated;
      msg += ', Bundle: +' + res.result.bundles.imported + ' อัปเดต ' + res.result.bundles.updated;
      msg += ', Demo: +' + res.result.demos.imported + ' อัปเดต ' + res.result.demos.updated;
      if (statusDiv) statusDiv.innerHTML = msg;
      toast(msg);
      setTimeout(function() { render(); }, 1500);
    } else {
      if (statusDiv) statusDiv.innerHTML = '❌ ' + res.error;
      toast('❌ นำเข้าล้มเหลว: ' + res.error, true);
    }
  });
}
// ================================================================
// PAGE RENDERERS
// ================================================================

function rProducts(el) {
  document.getElementById('pgT').textContent = '📦 สินค้าทั้งหมด';
  var products = getAllProducts();
  var html = '<div class="card"><h2>📋 สินค้าทั้งหมด <span class="ml"><button class="btn bp" onclick="showAddProductM()">➕ เพิ่มสินค้า</button><button class="btn bo" onclick="exportProductsToExcel()">📥 Export Excel</button></span></h2>';
  
  html += '<div class="fg"><input type="text" id="productSearch" placeholder="🔍 ค้นหา (ชื่อ, SKU, EAN)" oninput="filterProductsList()" style="margin-bottom:12px"></div>';
  html += '<div class="ftabs" style="margin-bottom:12px"><div class="ftab act" onclick="filterProductsType(\'all\')">📦 ทั้งหมด</div><div class="ftab" onclick="filterProductsType(\'active\')">✅ มีขาย</div><div class="ftab" onclick="filterProductsType(\'eol\')">⏰ EOL</div><div class="ftab" onclick="filterProductsType(\'software\')">💻 Software</div><div class="ftab" onclick="filterProductsType(\'service\')">🛠️ Service</div></div>';
  
  html += '<div class="export-wrap"><table class="export-table" id="productsTable"><thead><tr><th>#</th><th>SKU</th><th>EAN</th><th>ชื่อสินค้า</th><th>ราคา B</th><th>S</th><th>A</th><th>Other</th><th>สถานะ</th><th></th></tr></thead><tbody id="productsTableBody"></tbody></table></div></div>';
  el.innerHTML = html;
  renderProductsTable(products);
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
    html += '<tr><td class="pipe-row-num">' + (i+1) + '</td><td>' + sanitize(p.sku||'-') + '</td><td>' + sanitize(p.ean||'-') + '</td><td><strong>' + sanitize(p.name) + '</strong></td><td style="text-align:right">' + fmtMoney(p.price) + '</td><td style="text-align:right">' + fmtMoney(p.typePrices?.S) + '</td><td style="text-align:right">' + fmtMoney(p.typePrices?.A) + '</td><td style="text-align:right">' + fmtMoney(p.typePrices?.Other) + '</td><td>' + statusBadge + '</td><td><button class="btn bsm bo" onclick="showEditProductM(\'' + p.id + '\')">✏️</button></td></tr>';
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
    if (search && !p.name.toLowerCase().includes(search) && !(p.sku||'').toLowerCase().includes(search) && !(p.ean||'').includes(search)) return false;
    return true;
  });
  renderProductsTable(filtered);
}

function filterProductsType(type) {
  window.currentProductFilter = type;
  var tabs = document.querySelectorAll('.ftab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('act');
  if (event && event.target) event.target.classList.add('act');
  filterProductsList();
}

function showAddProductM() {
  var h = '<div style="max-width:500px"><div class="fm-group"><label>SKU</label><input type="text" id="prod_sku" placeholder="เช่น DJI-6941565998040"></div><div class="fm-group"><label>EAN</label><input type="text" id="prod_ean" placeholder="13 หลัก"></div><div class="fm-group"><label>ชื่อสินค้า *</label><input type="text" id="prod_name"></div><div class="fr"><div class="fm-group"><label>ประเภท</label><select id="prod_type"><option value="hardware">Hardware</option><option value="software">Software</option><option value="service">Service</option></select></div><div class="fm-group"><label>สถานะ</label><select id="prod_status"><option value="active">มีขาย</option><option value="eol">EOL</option></select></div></div><div class="form-section">💰 ราคา</div><div class="fr"><div class="fm-group"><label>Level S</label><input type="number" id="prod_price_s"></div><div class="fm-group"><label>Level A</label><input type="number" id="prod_price_a"></div></div><div class="fr"><div class="fm-group"><label>Level B</label><input type="number" id="prod_price_b"></div><div class="fm-group"><label>Level Other</label><input type="number" id="prod_price_other"></div></div><div class="fm-actions"><button class="btn btn-blue" onclick="saveNewProduct()">💾 บันทึก</button><button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
  openM('➕ เพิ่มสินค้า', h);
}

function saveNewProduct() {
  var name = document.getElementById('prod_name')?.value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  var productData = {
    name: name,
    sku: document.getElementById('prod_sku')?.value.trim() || '',
    ean: document.getElementById('prod_ean')?.value.trim() || '',
    price: parseFloat(document.getElementById('prod_price_b')?.value) || 0,
    typePrices: {
      S: parseFloat(document.getElementById('prod_price_s')?.value) || 0,
      A: parseFloat(document.getElementById('prod_price_a')?.value) || 0,
      B: parseFloat(document.getElementById('prod_price_b')?.value) || 0,
      Other: parseFloat(document.getElementById('prod_price_other')?.value) || 0
    },
    eol: document.getElementById('prod_status')?.value === 'eol',
    isSoftware: document.getElementById('prod_type')?.value === 'software',
    isService: document.getElementById('prod_type')?.value === 'service'
  };
  addProduct(productData);
  closeMForce();
  toast('✅ เพิ่มสินค้าแล้ว');
  render();
}

function showEditProductM(productId) {
  var p = getProductById(productId);
  if (!p) return;
  var h = '<div style="max-width:500px"><div class="fm-group"><label>SKU</label><input type="text" id="prod_sku" value="' + sanitize(p.sku || '') + '"></div><div class="fm-group"><label>EAN</label><input type="text" id="prod_ean" value="' + sanitize(p.ean || '') + '"></div><div class="fm-group"><label>ชื่อสินค้า</label><input type="text" id="prod_name" value="' + sanitize(p.name) + '"></div><div class="fr"><div class="fm-group"><label>ประเภท</label><select id="prod_type"><option value="hardware"' + (!p.isSoftware && !p.isService ? ' selected' : '') + '>Hardware</option><option value="software"' + (p.isSoftware ? ' selected' : '') + '>Software</option><option value="service"' + (p.isService ? ' selected' : '') + '>Service</option></select></div><div class="fm-group"><label>สถานะ</label><select id="prod_status"><option value="active"' + (!p.eol ? ' selected' : '') + '>มีขาย</option><option value="eol"' + (p.eol ? ' selected' : '') + '>EOL</option></select></div></div><div class="form-section">💰 ราคา</div><div class="fr"><div class="fm-group"><label>Level S</label><input type="number" id="prod_price_s" value="' + (p.typePrices?.S || 0) + '"></div><div class="fm-group"><label>Level A</label><input type="number" id="prod_price_a" value="' + (p.typePrices?.A || 0) + '"></div></div><div class="fr"><div class="fm-group"><label>Level B</label><input type="number" id="prod_price_b" value="' + (p.price || 0) + '"></div><div class="fm-group"><label>Level Other</label><input type="number" id="prod_price_other" value="' + (p.typePrices?.Other || 0) + '"></div></div><div class="fm-actions"><button class="btn btn-blue" onclick="updateProductFromModal(\'' + productId + '\')">💾 บันทึก</button><button class="btn bd" onclick="deleteProductConfirm(\'' + productId + '\')">🗑️ ลบ</button><button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
  openM('✏️ แก้ไขสินค้า', h);
}

function updateProductFromModal(productId) {
  var name = document.getElementById('prod_name')?.value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  var updates = {
    name: name,
    sku: document.getElementById('prod_sku')?.value.trim() || '',
    ean: document.getElementById('prod_ean')?.value.trim() || '',
    price: parseFloat(document.getElementById('prod_price_b')?.value) || 0,
    typePrices: {
      S: parseFloat(document.getElementById('prod_price_s')?.value) || 0,
      A: parseFloat(document.getElementById('prod_price_a')?.value) || 0,
      B: parseFloat(document.getElementById('prod_price_b')?.value) || 0,
      Other: parseFloat(document.getElementById('prod_price_other')?.value) || 0
    },
    eol: document.getElementById('prod_status')?.value === 'eol',
    isSoftware: document.getElementById('prod_type')?.value === 'software',
    isService: document.getElementById('prod_type')?.value === 'service'
  };
  updateProduct(productId, updates);
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

function deleteProductConfirm(productId) {
  if (!confirm('ลบสินค้านี้?')) return;
  deleteProduct(productId);
  closeMForce();
  toast('🗑️ ลบแล้ว');
  render();
}

function rProductPrices(el) {
  document.getElementById('pgT').textContent = '💰 ราคาตาม Level';
  var products = getAllProducts();
  var html = '<div class="card"><h2>💰 ราคาสินค้าแยกตาม Level</h2><div class="export-wrap"><table class="export-table" id="priceTable"><thead><tr><th>#</th><th>สินค้า</th><th>ราคา S</th><th>ราคา A</th><th>ราคา B</th><th>ราคา Other</th><th></th></tr></thead><tbody>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    html += '<tr><td class="pipe-row-num">' + (i+1) + '</td><td><strong>' + sanitize(p.name) + '</strong><td><input type="number" id="price_s_' + p.id + '" value="' + (p.typePrices?.S || 0) + '" style="width:90px" class="fm-input"></td><td><input type="number" id="price_a_' + p.id + '" value="' + (p.typePrices?.A || 0) + '" style="width:90px" class="fm-input"></td><td><input type="number" id="price_b_' + p.id + '" value="' + (p.price || 0) + '" style="width:90px" class="fm-input"></td><td><input type="number" id="price_o_' + p.id + '" value="' + (p.typePrices?.Other || 0) + '" style="width:90px" class="fm-input"></td><td><button class="btn bsm bp" onclick="saveSingleProductPrice(\'' + p.id + '\')">💾</button></td></tr>';
  }
  html += '</tbody></table></div><div class="bg" style="margin-top:12px"><button class="btn bp" onclick="saveAllProductPrices()">💾 บันทึกทั้งหมด</button></div></div>';
  el.innerHTML = html;
}

function saveSingleProductPrice(productId) {
  var priceS = parseFloat(document.getElementById('price_s_' + productId).value) || 0;
  var priceA = parseFloat(document.getElementById('price_a_' + productId).value) || 0;
  var priceB = parseFloat(document.getElementById('price_b_' + productId).value) || 0;
  var priceO = parseFloat(document.getElementById('price_o_' + productId).value) || 0;
  updateProduct(productId, { price: priceB, typePrices: { S: priceS, A: priceA, B: priceB, Other: priceO } });
  toast('💾 บันทึกราคาแล้ว');
  render();
}

function saveAllProductPrices() {
  var products = getAllProducts();
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var priceS = parseFloat(document.getElementById('price_s_' + p.id).value) || 0;
    var priceA = parseFloat(document.getElementById('price_a_' + p.id).value) || 0;
    var priceB = parseFloat(document.getElementById('price_b_' + p.id).value) || 0;
    var priceO = parseFloat(document.getElementById('price_o_' + p.id).value) || 0;
    updateProduct(p.id, { price: priceB, typePrices: { S: priceS, A: priceA, B: priceB, Other: priceO } });
  }
  toast('💾 บันทึกราคาทั้งหมดแล้ว');
  render();
}

function rProductBundles(el) {
  document.getElementById('pgT').textContent = '🎁 Bundle/Combo';
  var bundles = getAllBundles();
  var products = getAllProducts();
  
  var html = '<div class="card"><h2>🎁 Bundle/Combo <span class="ml"><button class="btn bp" onclick="showAddBundleM()">➕ เพิ่ม Bundle</button><button class="btn bo" onclick="exportBundlesToExcel()">📥 Export Excel</button></span></h2>';
  
  if (bundles.length === 0) {
    html += '<div class="empty"><p>ยังไม่มี Bundle/Combo</p><button class="btn bp" onclick="showAddBundleM()">➕ สร้าง Bundle แรก</button></div>';
  } else {
    for (var i = 0; i < bundles.length; i++) {
      var b = bundles[i];
      var statusBadge = b.enabled ? '<span class="tag tag-completed">✅ เปิดใช้งาน</span>' : '<span class="tag tag-cancelled">⏸ ปิดใช้งาน</span>';
      html += '<div class="card" style="margin-bottom:12px; border-left:4px solid var(--accent)">';
      html += '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">';
      html += '<div><h3 style="margin:0">' + sanitize(b.name) + ' ' + statusBadge + '</h3>';
      if (b.description) html += '<div class="hint" style="margin-top:4px">' + sanitize(b.description) + '</div>';
      html += '</div>';
      html += '<div><button class="btn bsm bo" onclick="editBundle(\'' + b.id + '\')">✏️ แก้ไข</button> ';
      html += '<button class="btn bsm bd" onclick="deleteBundleConfirm(\'' + b.id + '\')">🗑️ ลบ</button></div>';
      html += '</div>';
      
      // แสดงรายการสินค้าใน bundle
      if (b.items && b.items.length) {
        html += '<div style="margin-top:8px"><strong>📦 สินค้าใน Bundle:</strong><ul style="margin:4px 0 0 20px">';
        for (var j = 0; j < b.items.length; j++) {
          var item = b.items[j];
          var product = getProductBySku(item.sku) || getProductById(item.productId);
          var productName = product ? product.name : (item.name || item.sku || 'ไม่ระบุ');
          html += '<li>' + sanitize(productName) + (item.qty > 1 ? ' x' + item.qty : '') + '</li>';
        }
        html += '</ul></div>';
      }
      
      // แสดงราคา
      html += '<div class="fr" style="margin-top:8px; gap:12px">';
      html += '<div><span class="hint">ราคา S:</span> <strong>' + fmtMoney(b.typePrices?.S || 0) + ' ฿</strong></div>';
      html += '<div><span class="hint">ราคา A:</span> <strong>' + fmtMoney(b.typePrices?.A || 0) + ' ฿</strong></div>';
      html += '<div><span class="hint">ราคา B:</span> <strong>' + fmtMoney(b.typePrices?.B || 0) + ' ฿</strong></div>';
      html += '<div><span class="hint">ราคา Other:</span> <strong>' + fmtMoney(b.typePrices?.Other || 0) + ' ฿</strong></div>';
      html += '</div>';
      
      html += '</div>';
    }
  }
  html += '</div>';
  el.innerHTML = html;
}

function showAddBundleM() {
  editBundle(null); // ใช้ฟังก์ชันเดียวกัน โดยส่ง null
}

function editBundle(bundleId) {
  var bundle = bundleId ? getBundleById(bundleId) : null;
  var products = getAllProducts();
  
  // สร้าง dropdown รายการสินค้า
  var productOptions = '<option value="">-- เลือกสินค้า --</option>';
  for (var i = 0; i < products.length; i++) {
    productOptions += '<option value="' + products[i].id + '" data-sku="' + sanitize(products[i].sku || '') + '" data-name="' + sanitize(products[i].name) + '">' + sanitize(products[i].name) + ' (' + (products[i].sku || '-') + ')</option>';
  }
  
  // สร้าง HTML สำหรับสินค้าที่อยู่ใน bundle แล้ว
  var itemsHtml = '<div id="bundleItemsContainer">';
  if (bundle && bundle.items && bundle.items.length) {
    for (var i = 0; i < bundle.items.length; i++) {
      var it = bundle.items[i];
      var prod = it.productId ? getProductById(it.productId) : (it.sku ? getProductBySku(it.sku) : null);
      var prodName = prod ? prod.name : (it.name || it.sku || '');
      itemsHtml += '<div class="bundle-item-row" style="display:flex; gap:8px; margin-bottom:6px; align-items:center">';
      itemsHtml += '<select class="bundle-item-product" style="flex:2">' + productOptions + '</select>';
      itemsHtml += '<input type="number" class="bundle-item-qty" value="' + (it.qty || 1) + '" style="width:80px" min="1" placeholder="จำนวน">';
      itemsHtml += '<button class="btn bsm bd" onclick="removeBundleItemRow(this)">🗑️</button>';
      itemsHtml += '</div>';
      // pre-select ค่าที่มีอยู่
      setTimeout(function(sel, prodId) {
        if (sel) sel.value = prodId || '';
      }, 10, document.querySelectorAll('.bundle-item-product')[i], prod ? prod.id : '');
    }
  } else {
    // เริ่มต้นหนึ่งแถว
    itemsHtml += '<div class="bundle-item-row" style="display:flex; gap:8px; margin-bottom:6px; align-items:center">';
    itemsHtml += '<select class="bundle-item-product" style="flex:2">' + productOptions + '</select>';
    itemsHtml += '<input type="number" class="bundle-item-qty" value="1" style="width:80px" min="1">';
    itemsHtml += '<button class="btn bsm bd" onclick="removeBundleItemRow(this)">🗑️</button>';
    itemsHtml += '</div>';
  }
  itemsHtml += '</div>';
  
  var h = '<div style="max-width:550px">';
  h += '<div class="fm-group"><label>ชื่อ Bundle *</label><input type="text" id="bundle_name" value="' + (bundle ? sanitize(bundle.name) : '') + '"></div>';
  h += '<div class="fm-group"><label>คำอธิบาย</label><textarea id="bundle_desc" rows="2">' + (bundle ? sanitize(bundle.description || '') : '') + '</textarea></div>';
  h += '<div class="form-section">📦 สินค้าใน Bundle</div>';
  h += itemsHtml;
  h += '<button class="btn bsm bo" onclick="addBundleItemRow()" style="margin-top:4px">➕ เพิ่มสินค้า</button>';
  h += '<div class="form-section">💰 ราคา (ไม่รวม VAT)</div>';
  h += '<div class="fr"><div class="fm-group"><label>ราคา S</label><input type="number" id="bundle_price_s" value="' + (bundle ? (bundle.typePrices?.S || 0) : 0) + '"></div>';
  h += '<div class="fm-group"><label>ราคา A</label><input type="number" id="bundle_price_a" value="' + (bundle ? (bundle.typePrices?.A || 0) : 0) + '"></div></div>';
  h += '<div class="fr"><div class="fm-group"><label>ราคา B</label><input type="number" id="bundle_price_b" value="' + (bundle ? (bundle.typePrices?.B || 0) : 0) + '"></div>';
  h += '<div class="fm-group"><label>ราคา Other</label><input type="number" id="bundle_price_o" value="' + (bundle ? (bundle.typePrices?.Other || 0) : 0) + '"></div></div>';
  h += '<div class="fm-group"><label>สถานะ</label><select id="bundle_enabled">';
  h += '<option value="true"' + (bundle && bundle.enabled === false ? '' : ' selected') + '>✅ เปิดใช้งาน</option>';
  h += '<option value="false"' + (bundle && bundle.enabled === false ? ' selected' : '') + '>⏸ ปิดใช้งาน</option>';
  h += '</select></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveBundle(\'' + (bundleId || '') + '\')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  
  openM(bundleId ? '✏️ แก้ไข Bundle' : '➕ เพิ่ม Bundle', h);
  
  // เลือกสินค้าที่มีอยู่แล้วในแถว
  setTimeout(function() {
    if (bundle && bundle.items) {
      var rows = document.querySelectorAll('.bundle-item-row');
      for (var i = 0; i < bundle.items.length && i < rows.length; i++) {
        var it = bundle.items[i];
        var prod = it.productId ? getProductById(it.productId) : (it.sku ? getProductBySku(it.sku) : null);
        if (prod) {
          var sel = rows[i].querySelector('.bundle-item-product');
          if (sel) sel.value = prod.id;
        }
      }
    }
  }, 50);
}

function addBundleItemRow() {
  var container = document.getElementById('bundleItemsContainer');
  var products = getAllProducts();
  var productOptions = '<option value="">-- เลือกสินค้า --</option>';
  for (var i = 0; i < products.length; i++) {
    productOptions += '<option value="' + products[i].id + '">' + sanitize(products[i].name) + '</option>';
  }
  var newRow = '<div class="bundle-item-row" style="display:flex; gap:8px; margin-bottom:6px; align-items:center">';
  newRow += '<select class="bundle-item-product" style="flex:2">' + productOptions + '</select>';
  newRow += '<input type="number" class="bundle-item-qty" value="1" style="width:80px" min="1">';
  newRow += '<button class="btn bsm bd" onclick="removeBundleItemRow(this)">🗑️</button>';
  newRow += '</div>';
  container.insertAdjacentHTML('beforeend', newRow);
}

function removeBundleItemRow(btn) {
  btn.closest('.bundle-item-row').remove();
}

function saveBundle(bundleId) {
  var name = document.getElementById('bundle_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อ Bundle'); return; }
  
  var items = [];
  var rows = document.querySelectorAll('#bundleItemsContainer .bundle-item-row');
  for (var i = 0; i < rows.length; i++) {
    var productId = rows[i].querySelector('.bundle-item-product').value;
    var qty = parseInt(rows[i].querySelector('.bundle-item-qty').value) || 1;
    if (productId) {
      var product = getProductById(productId);
      if (product) {
        items.push({
          productId: product.id,
          sku: product.sku || '',
          name: product.name,
          qty: qty
        });
      }
    }
  }
  if (items.length === 0) { toast('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
  
  var bundleData = {
    name: name,
    description: document.getElementById('bundle_desc').value.trim(),
    items: items,
    typePrices: {
      S: parseFloat(document.getElementById('bundle_price_s').value) || 0,
      A: parseFloat(document.getElementById('bundle_price_a').value) || 0,
      B: parseFloat(document.getElementById('bundle_price_b').value) || 0,
      Other: parseFloat(document.getElementById('bundle_price_o').value) || 0
    },
    enabled: document.getElementById('bundle_enabled').value === 'true'
  };
  
  if (bundleId) {
    updateBundle(bundleId, bundleData);
    toast('💾 อัปเดต Bundle แล้ว');
  } else {
    addBundle(bundleData);
    toast('✅ เพิ่ม Bundle ใหม่แล้ว');
  }
  closeMForce();
  render();
}

function deleteBundleConfirm(bundleId) {
  if (!confirm('ลบ Bundle นี้?')) return;
  deleteBundle(bundleId);
  toast('🗑️ ลบแล้ว');
  render();
}

function rProductDemo(el) {
  document.getElementById('pgT').textContent = '🚁 Demo Unit';
  var demos = getAllDemoUnits();
  var products = getAllProducts();
  
  var html = '<div class="card"><h2>🚁 Demo Unit Pricing <span class="ml"><button class="btn bp" onclick="showAddDemoUnitM()">➕ เพิ่ม Demo Unit</button><button class="btn bo" onclick="exportDemoUnitsToExcel()">📥 Export Excel</button></span></h2>';
  
  if (demos.length === 0) {
    html += '<div class="empty"><p>ยังไม่มี Demo Unit</p><button class="btn bp" onclick="showAddDemoUnitM()">➕ สร้างรายการแรก</button></div>';
  } else {
    html += '<div class="export-wrap"><table class="export-table"><thead><tr><th>#</th><th>SKU</th><th>EAN</th><th>สินค้า</th><th>ราคา Demo</th><th>สถานะ</th><th></th></tr></thead><tbody>';
    for (var i = 0; i < demos.length; i++) {
      var d = demos[i];
      var product = d.productId ? getProductById(d.productId) : null;
      var productName = product ? product.name : (d.productName || d.name || '');
      html += '<tr>';
      html += '<td class="pipe-row-num">' + (i+1) + '</td>';
      html += '<td>' + sanitize(d.sku || '-') + '</td>';
      html += '<td>' + sanitize(d.ean || '-') + '</td>';
      html += '<td>' + sanitize(productName) + '</td>';
      html += '<td style="text-align:right">' + fmtMoney(d.price) + '</td>';
      html += '<td>' + (d.enabled ? '✅ Active' : '⏸ Inactive') + '</td>';
      html += '<td><button class="btn bsm bo" onclick="editDemoUnit(\'' + d.id + '\')">✏️</button></td>';
      html += '</td>';
    }
    html += '</tbody></table></div>';
  }
  html += '</div>';
  el.innerHTML = html;
}
function showAddDemoUnitM() {
  editDemoUnit(null);
}

function editDemoUnit(demoId) {
  var demo = demoId ? getDemoUnitById(demoId) : null;
  var products = getAllProducts();
  
  var productOptions = '<option value="">-- เลือกสินค้า (ไม่บังคับ) --</option>';
  for (var i = 0; i < products.length; i++) {
    productOptions += '<option value="' + products[i].id + '" data-sku="' + sanitize(products[i].sku || '') + '" data-ean="' + sanitize(products[i].ean || '') + '">' + sanitize(products[i].name) + '</option>';
  }
  
  var h = '<div style="max-width:500px">';
  h += '<div class="fm-group"><label>เชื่อมโยงกับสินค้า (optional)</label><select id="demo_product_id" onchange="updateDemoFromProduct()">' + productOptions + '</select></div>';
  h += '<div class="fm-group"><label>SKU (ถ้าไม่เชื่อม)</label><input type="text" id="demo_sku" value="' + sanitize(demo?.sku || '') + '"></div>';
  h += '<div class="fm-group"><label>EAN</label><input type="text" id="demo_ean" value="' + sanitize(demo?.ean || '') + '"></div>';
  h += '<div class="fm-group"><label>ชื่อสินค้า *</label><input type="text" id="demo_name" value="' + sanitize(demo?.productName || demo?.name || '') + '"></div>';
  h += '<div class="fm-group"><label>💰 ราคา Demo (บาท)</label><input type="number" id="demo_price" value="' + (demo?.price || 0) + '"></div>';
  h += '<div class="fm-group"><label>หมายเหตุ</label><textarea id="demo_note" rows="2">' + sanitize(demo?.note || '') + '</textarea></div>';
  h += '<div class="fm-group"><label>สถานะ</label><select id="demo_enabled">';
  h += '<option value="true"' + (demo?.enabled !== false ? ' selected' : '') + '>✅ เปิดใช้งาน</option>';
  h += '<option value="false"' + (demo?.enabled === false ? ' selected' : '') + '>⏸ ปิดใช้งาน</option>';
  h += '</select></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="saveDemoUnit(\'' + (demoId || '') + '\')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  
  openM(demoId ? '✏️ แก้ไข Demo Unit' : '➕ เพิ่ม Demo Unit', h);
  
  // เลือก product ถ้ามี
  setTimeout(function() {
    if (demo && demo.productId) {
      var sel = document.getElementById('demo_product_id');
      if (sel) sel.value = demo.productId;
    }
  }, 50);
}

function updateDemoFromProduct() {
  var sel = document.getElementById('demo_product_id');
  var productId = sel.value;
  if (productId) {
    var product = getProductById(productId);
    if (product) {
      document.getElementById('demo_sku').value = product.sku || '';
      document.getElementById('demo_ean').value = product.ean || '';
      document.getElementById('demo_name').value = product.name;
      // ไม่ auto set ราคา demo เพราะอาจพิเศษ
    }
  }
}

function saveDemoUnit(demoId) {
  var name = document.getElementById('demo_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  
  var productId = document.getElementById('demo_product_id').value || null;
  var demoData = {
    productId: productId,
    productName: name,
    sku: document.getElementById('demo_sku').value.trim(),
    ean: document.getElementById('demo_ean').value.trim(),
    price: parseFloat(document.getElementById('demo_price').value) || 0,
    note: document.getElementById('demo_note').value.trim(),
    enabled: document.getElementById('demo_enabled').value === 'true'
  };
  
  if (demoId) {
    updateDemoUnit(demoId, demoData);
    toast('💾 อัปเดต Demo Unit แล้ว');
  } else {
    addDemoUnit(demoData);
    toast('✅ เพิ่ม Demo Unit ใหม่แล้ว');
  }
  closeMForce();
  render();
}
// ================================================================
// PAGE: IMPORT/EXPORT (Full Version with Bundles & Demo)
// ================================================================

function rProductImport(el) {
  document.getElementById('pgT').textContent = '📥 Import/Export สินค้า';
  
  var html = '';
// ภายใน rProductImport ก่อน export section
html += '<div class="card"><h2>🚀 นำเข้าข้อมูลทั้งหมด (ครั้งเดียวจบ)</h2>';
html += '<p class="hint">เลือกไฟล์ Excel ที่มี 3 แผ่นงาน (single, combo, demo) เพื่อนำเข้าทั้งสินค้า, Bundle และ Demo Unit พร้อมกัน</p>';
html += '<div class="fg"><input type="file" id="importFullFile" accept=".xlsx,.xls"><button class="btn bp" onclick="doImportFullExcel()">📤 นำเข้าทั้งหมด</button></div>';
html += '<div id="importFullProgress" style="display:none"><div class="pb"><div class="pf pf-blue" style="width:0%"></div></div><div id="importFullStatus"></div></div>';
html += '</div>';
  
  // Export Section
  html += '<div class="card"><h2>📤 Export ข้อมูล</h2>';
  html += '<div class="bg" style="gap:8px; flex-wrap:wrap">';
  html += '<button class="btn bp" onclick="exportProductsToExcel()">📦 Export สินค้าทั้งหมด</button>';
  html += '<button class="btn bo" onclick="exportBundlesToExcel()">🎁 Export Bundles</button>';
  html += '<button class="btn bo" onclick="exportDemoUnitsToExcel()">🚁 Export Demo Units</button>';
  html += '</div></div>';
  
  // Import Products Section
  html += '<div class="card"><h2>📥 Import สินค้า</h2>';
  html += '<div class="fg"><input type="file" id="importProductsFile" accept=".xlsx,.xls"><button class="btn bp" onclick="doImportProducts()">📤 เริ่ม Import สินค้า</button></div>';
  html += '<div id="importProgress" style="display:none"><div class="pb"><div class="pf pf-blue" style="width:0%"></div></div><div id="importStatus"></div></div>';
  html += '</div>';
  
  // Import Bundles Section
  html += '<div class="card"><h2>🎁 Import Bundles (Excel)</h2>';
  html += '<div class="fg"><input type="file" id="importBundlesFile" accept=".xlsx,.xls"><button class="btn bp" onclick="doImportBundles()">📤 เริ่ม Import Bundles</button></div>';
  html += '<div id="importBundlesProgress" style="display:none; margin-top:8px"><div class="pb"><div class="pf pf-blue" style="width:0%"></div></div><div id="importBundlesStatus"></div></div>';
  html += '</div>';
  
  // Import Demo Units Section
  html += '<div class="card"><h2>🚁 Import Demo Units</h2>';
  html += '<div class="fg"><input type="file" id="importDemoFile" accept=".xlsx,.xls"><button class="btn bp" onclick="doImportDemoUnits()">📤 เริ่ม Import Demo Units</button></div>';
  html += '<div id="importDemoProgress" style="display:none; margin-top:8px"><div class="pb"><div class="pf pf-blue" style="width:0%"></div></div><div id="importDemoStatus"></div></div>';
  html += '</div>';
// การจัดการข้อมูล
html += '<div class="card"><h2>⚠️ การจัดการข้อมูล</h2>';
html += '<div class="bg"><button class="btn bd" onclick="clearAllProductsData()">🗑️ ลบข้อมูลทั้งหมด (สินค้า, Bundle, Demo)</button></div>';
html += '<div class="hint">เมื่อลบแล้วไม่สามารถกู้คืนได้ ยกเว้นมีข้อมูลใน Firebase และล็อกอินอยู่</div>';
html += '</div>';
  
  // Instructions
  html += '<div class="card"><h2>📋 คำแนะนำ</h2>';
  html += '<div class="hint">';
  html += '📦 <strong>สินค้า:</strong> กด Export สินค้าทั้งหมด เพื่อดาวน์โหลดไฟล์ Excel สำหรับแก้ไข (SKU, EAN, ชื่อ, ราคา, EOL, Type)<br>';
  html += '🎁 <strong>Bundle:</strong> Export Bundles เพื่อแก้ไขรายการ Bundle (ชื่อ, รายการสินค้า, ราคา, สถานะ)<br>';
  html += '🚁 <strong>Demo Unit:</strong> Export Demo Units เพื่อแก้ไขราคา Demo<br>';
  html += 'หลังจากแก้ไขใน Excel แล้ว ให้เลือกไฟล์และกด Import ที่เกี่ยวข้อง';
  html += '</div></div>';
  
  el.innerHTML = html;
}

// ================================================================
// EXPORT BUNDLES TO EXCEL
// ================================================================

function exportBundlesToExcel() {
  var bundles = getAllBundles();
  var excelData = bundles.map(function(b, idx) {
    var itemsText = (b.items || []).map(function(it) {
      var prod = it.productId ? getProductById(it.productId) : null;
      return (prod ? prod.name : it.name) + (it.qty > 1 ? ' x' + it.qty : '');
    }).join(', ');
    return {
      '#': idx + 1,
      'Bundle Name': b.name,
      'Description': b.description || '',
      'Items': itemsText,
      'Price S': b.typePrices?.S || 0,
      'Price A': b.typePrices?.A || 0,
      'Price B': b.typePrices?.B || 0,
      'Price Other': b.typePrices?.Other || 0,
      'Enabled': b.enabled ? 'Active' : 'Inactive'
    };
  });
  var ws = XLSX.utils.json_to_sheet(excelData);
  ws['!cols'] = [{wch:5}, {wch:30}, {wch:40}, {wch:50}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:10}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bundles');
  XLSX.writeFile(wb, 'bundles-export-' + _td() + '.xlsx');
  toast('📥 Export Bundles สำเร็จ!');
}

// ================================================================
// IMPORT BUNDLES FROM EXCEL
// ================================================================

function importBundlesFromExcel(file, onComplete) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet);
      if (!rows || rows.length === 0) {
        if (onComplete) onComplete({ success: false, error: 'ไม่มีข้อมูลในไฟล์' });
        return;
      }
      var imported = 0, updated = 0, errors = 0;
      for (var i = 0; i < rows.length; i++) {
        try {
          var row = rows[i];
          var name = row['Bundle Name'] || row['name'];
          if (!name) continue;
          var itemsText = row['Items'] || '';
          var items = [];
          var parts = itemsText.split(',');
          for (var j = 0; j < parts.length; j++) {
            var part = parts[j].trim();
            var match = part.match(/(.*?)(?:\s*x(\d+))?$/);
            if (match) {
              var productName = match[1].trim();
              var qty = parseInt(match[2]) || 1;
              var product = getProductByName(productName);
              if (product) {
                items.push({ productId: product.id, sku: product.sku, name: product.name, qty: qty });
              } else {
                items.push({ productId: null, sku: '', name: productName, qty: qty });
              }
            }
          }
          var bundleData = {
            name: name,
            description: row['Description'] || '',
            items: items,
            typePrices: {
              S: parseFloat(row['Price S']) || 0,
              A: parseFloat(row['Price A']) || 0,
              B: parseFloat(row['Price B']) || 0,
              Other: parseFloat(row['Price Other']) || 0
            },
            enabled: (row['Enabled'] !== 'Inactive')
          };
          var existing = getBundleByName(name);
          if (existing) {
            updateBundle(existing.id, bundleData);
            updated++;
          } else {
            addBundle(bundleData);
            imported++;
          }
        } catch(err) { errors++; }
      }
      if (onComplete) onComplete({ success: true, imported: imported, updated: updated, errors: errors, total: rows.length });
    } catch(err) {
      if (onComplete) onComplete({ success: false, error: err.message });
    }
  };
  reader.readAsArrayBuffer(file);
}

function doImportBundles() {
  var fileInput = document.getElementById('importBundlesFile');
  if (!fileInput || !fileInput.files[0]) { toast('⚠️ กรุณาเลือกไฟล์'); return; }
  var progressDiv = document.getElementById('importBundlesProgress');
  var progressBar = progressDiv ? progressDiv.querySelector('.pf') : null;
  var statusDiv = document.getElementById('importBundlesStatus');
  if (progressDiv) progressDiv.style.display = 'block';
  if (progressBar) progressBar.style.width = '30%';
  if (statusDiv) statusDiv.innerHTML = 'กำลังอ่านไฟล์...';
  toast('🔄 กำลังนำเข้า Bundles...');
  importBundlesFromExcel(fileInput.files[0], function(res) {
    if (res.success) {
      if (progressBar) progressBar.style.width = '100%';
      if (statusDiv) statusDiv.innerHTML = '✅ นำเข้าเสร็จ! เพิ่ม ' + res.imported + ' รายการ, อัปเดต ' + res.updated;
      toast('✅ Import Bundles สำเร็จ! เพิ่ม ' + res.imported + ', อัปเดต ' + res.updated);
      setTimeout(function() { render(); }, 1000);
    } else {
      if (statusDiv) statusDiv.innerHTML = '❌ ' + res.error;
      toast('❌ Import Bundles ล้มเหลว: ' + res.error, true);
    }
  });
}

// ================================================================
// IMPORT DEMO UNITS FROM EXCEL (ปรับให้ตรงกับไฟล์ตัวอย่าง)
// ================================================================

function importDemoUnitsFromExcel(file, onComplete) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet);
      var imported = 0, updated = 0, errors = 0;
      for (var i = 0; i < rows.length; i++) {
        try {
          var row = rows[i];
          var sku = row['SiS part'] || row['SKU'] || '';
          var ean = row['EAN'] || '';
          var name = row['Product Name'] || row['name'] || '';
          var price = parseFloat(row['TYPE1-4 P THB ex VAT'] || row['Demo Price'] || row['price'] || 0);
          if (!name) continue;
          var product = getProductBySku(sku) || getProductByEan(ean);
          var existingDemo = null;
          var allDemos = getAllDemoUnits();
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
        } catch(err) { errors++; }
      }
      if (onComplete) onComplete({ success: true, imported: imported, updated: updated, errors: errors, total: rows.length });
    } catch(err) {
      if (onComplete) onComplete({ success: false, error: err.message });
    }
  };
  reader.readAsArrayBuffer(file);
}

function doImportDemoUnits() {
  var fileInput = document.getElementById('importDemoFile');
  if (!fileInput || !fileInput.files[0]) { toast('⚠️ กรุณาเลือกไฟล์'); return; }
  var progressDiv = document.getElementById('importDemoProgress');
  var progressBar = progressDiv ? progressDiv.querySelector('.pf') : null;
  var statusDiv = document.getElementById('importDemoStatus');
  if (progressDiv) progressDiv.style.display = 'block';
  if (progressBar) progressBar.style.width = '30%';
  if (statusDiv) statusDiv.innerHTML = 'กำลังอ่านไฟล์...';
  toast('🔄 กำลังนำเข้า Demo Units...');
  importDemoUnitsFromExcel(fileInput.files[0], function(res) {
    if (res.success) {
      if (progressBar) progressBar.style.width = '100%';
      if (statusDiv) statusDiv.innerHTML = '✅ นำเข้าเสร็จ! เพิ่ม ' + res.imported + ' รายการ, อัปเดต ' + res.updated;
      toast('✅ Import Demo Units สำเร็จ! เพิ่ม ' + res.imported + ', อัปเดต ' + res.updated);
      setTimeout(function() { render(); }, 1000);
    } else {
      if (statusDiv) statusDiv.innerHTML = '❌ ' + res.error;
      toast('❌ Import Demo Units ล้มเหลว: ' + res.error, true);
    }
  });
}
function doImportProducts() {
  var fileInput = document.getElementById('importProductsFile');
  if (!fileInput || !fileInput.files[0]) { toast('⚠️ กรุณาเลือกไฟล์'); return; }
  var progressDiv = document.getElementById('importProgress');
  var progressBar = document.getElementById('importProgressBar');
  var statusDiv = document.getElementById('importStatus');
  if (progressDiv) progressDiv.style.display = 'block';
  if (progressBar) progressBar.style.width = '30%';
  if (statusDiv) statusDiv.innerHTML = 'กำลังอ่านไฟล์...';
  toast('🔄 กำลังนำเข้า...');
  importProductsFromExcel(fileInput.files[0], function(res) {
    if (res.success) {
      if (progressBar) progressBar.style.width = '100%';
      if (statusDiv) statusDiv.innerHTML = '✅ นำเข้าเสร็จ! เพิ่ม ' + res.imported + ' รายการ, อัปเดต ' + res.updated + ' รายการ';
      toast('✅ Import สำเร็จ ' + res.imported + ' รายการ');
      setTimeout(function() { location.reload(); }, 1500);
    } else {
      if (statusDiv) statusDiv.innerHTML = '❌ ' + res.error;
      toast('❌ Import ล้มเหลว: ' + res.error, true);
    }
  });
}

function doImportDemoUnits() {
  var fileInput = document.getElementById('importDemoFile');
  if (!fileInput || !fileInput.files[0]) { toast('⚠️ กรุณาเลือกไฟล์'); return; }
  toast('🔄 กำลังนำเข้า Demo Units...');
  importDemoUnitsFromExcel(fileInput.files[0], function(res) {
    if (res.success) {
      toast('✅ Import Demo Units สำเร็จ ' + res.imported + ' รายการ');
      setTimeout(function() { location.reload(); }, 1000);
    } else {
      toast('❌ Import ล้มเหลว: ' + res.error, true);
    }
  });
}
function exportBundlesToExcel() {
  var bundles = getAllBundles();
  var excelData = bundles.map(function(b, idx) {
    var itemsText = (b.items || []).map(function(it) {
      var prod = it.productId ? getProductById(it.productId) : null;
      return (prod ? prod.name : it.name) + (it.qty > 1 ? ' x' + it.qty : '');
    }).join(', ');
    return {
      '#': idx + 1,
      'Bundle Name': b.name,
      'Description': b.description || '',
      'Items': itemsText,
      'Price S': b.typePrices?.S || 0,
      'Price A': b.typePrices?.A || 0,
      'Price B': b.typePrices?.B || 0,
      'Price Other': b.typePrices?.Other || 0,
      'Enabled': b.enabled ? 'Active' : 'Inactive'
    };
  });
  var ws = XLSX.utils.json_to_sheet(excelData);
  ws['!cols'] = [{wch:5}, {wch:30}, {wch:40}, {wch:50}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:10}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bundles');
  XLSX.writeFile(wb, 'bundles-export-' + _td() + '.xlsx');
  toast('📥 Export Bundles สำเร็จ!');
}

function importBundlesFromExcel(file, onComplete) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet);
      if (!rows || rows.length === 0) {
        if (onComplete) onComplete({ success: false, error: 'ไม่มีข้อมูล' });
        return;
      }
      var imported = 0, updated = 0, errors = 0;
      for (var i = 0; i < rows.length; i++) {
        try {
          var row = rows[i];
          var name = row['Bundle Name'] || row['name'];
          if (!name) continue;
          // พาร์สสินค้าใน bundle (items) จากข้อความ เช่น "DJI Matrice 4E x2, DJI Zenmuse L2"
          var itemsText = row['Items'] || '';
          var items = [];
          var parts = itemsText.split(',');
          for (var j = 0; j < parts.length; j++) {
            var part = parts[j].trim();
            var match = part.match(/(.*?)(?:\s*x(\d+))?$/);
            if (match) {
              var productName = match[1].trim();
              var qty = parseInt(match[2]) || 1;
              var product = getProductByName(productName);
              if (product) {
                items.push({ productId: product.id, sku: product.sku, name: product.name, qty: qty });
              } else {
                items.push({ productId: null, sku: '', name: productName, qty: qty });
              }
            }
          }
          var bundleData = {
            name: name,
            description: row['Description'] || '',
            items: items,
            typePrices: {
              S: parseFloat(row['Price S']) || 0,
              A: parseFloat(row['Price A']) || 0,
              B: parseFloat(row['Price B']) || 0,
              Other: parseFloat(row['Price Other']) || 0
            },
            enabled: (row['Enabled'] !== 'Inactive')
          };
          var existing = getBundleByName(name);
          if (existing) {
            updateBundle(existing.id, bundleData);
            updated++;
          } else {
            addBundle(bundleData);
            imported++;
          }
        } catch(err) { errors++; }
      }
      if (onComplete) onComplete({ success: true, imported: imported, updated: updated, errors: errors, total: rows.length });
    } catch(err) {
      if (onComplete) onComplete({ success: false, error: err.message });
    }
  };
  reader.readAsArrayBuffer(file);
}
// ================================================================
// CLEAR ALL PRODUCTS, BUNDLES, DEMO UNITS
// ================================================================

function clearAllProductsData() {
  if (!confirm('⚠️ ยืนยันลบข้อมูลทั้งหมด (สินค้า, Bundle, Demo Unit)? ข้อมูลจะหายไปถาวร')) return;
  
  var data = getProductsData();
  data.models = [];
  data.bundles = [];
  data.demoUnits = [];
  data.lastUpdated = new Date().toISOString();
  saveProductsData(data);
  
  // ล้างใน config ด้วย
  var cfg = localStorage.getItem('v7_config');
  if (cfg) {
    var config = JSON.parse(cfg);
    config.models = [];
    config.bundles = [];
    if (config.demoUnitPrices) config.demoUnitPrices.items = [];
    localStorage.setItem('v7_config', JSON.stringify(config));
  }
  
  toast('🗑️ ลบข้อมูลสินค้า, Bundle และ Demo Unit ทั้งหมดแล้ว');
  render();
}
// ================================================================
// INITIALIZE
// ================================================================

function initProductsModule() {
  var data = getProductsData();
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
  if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    loadProductsFromFirebase().then(function(loaded) {
      if (loaded && typeof render === 'function') render();
    });
  }
  console.log('✅ Products Module initialized', data.models.length, 'products');
}

initProductsModule();

// ================================================================
// OVERRIDE SYSTEM FUNCTIONS
// ================================================================

window.modelOptionsNew = function(selected, showEOLBadge) {
  return getModelOptionsHtml(selected, showEOLBadge);
};

window.getModelPrice = function(modelName) {
  var product = getProductByName(modelName);
  return product ? product.price : 0;
};

// ================================================================
// EXPORT GLOBAL
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
  forceSync: syncProductsToFirebase,
  exportToExcel: exportProductsToExcel,
  importFromExcel: importProductsFromExcel
};

window.Products = Products;