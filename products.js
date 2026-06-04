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
      return JSON.parse(saved);
    }
  } catch(e) {}
  
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
            enabled: enabled
          };
          
          if (existingDemo) {
            updateDemoUnit(existingDemo.id, demoData);
            updated++;
          } else {
            addDemoUnit(demoData);
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
  var html = '<div class="card"><h2>🎁 Bundle/Combo <span class="ml"><button class="btn bp" onclick="showAddBundleM()">➕ เพิ่ม Bundle</button></span></h2>';
  if (bundles.length === 0) {
    html += '<div class="empty"><p>ยังไม่มี Bundle/Combo</p><button class="btn bp" onclick="showAddBundleM()">➕ สร้าง Bundle แรก</button></div>';
  } else {
    for (var i = 0; i < bundles.length; i++) {
      var b = bundles[i];
      html += '<div class="card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center"><h3>' + sanitize(b.name) + '</h3><div><button class="btn bsm bo" onclick="editBundle(\'' + b.id + '\')">✏️</button><button class="btn bsm bd" onclick="deleteBundleConfirm(\'' + b.id + '\')">🗑️</button></div></div>' + (b.description ? '<p>' + sanitize(b.description) + '</p>' : '') + '<div class="fr"><div>S: ' + fmtMoney(b.typePrices?.S) + '</div><div>A: ' + fmtMoney(b.typePrices?.A) + '</div><div>B: ' + fmtMoney(b.typePrices?.B) + '</div><div>Other: ' + fmtMoney(b.typePrices?.Other) + '</div></div></div>';
    }
  }
  html += '</div>';
  el.innerHTML = html;
}

function showAddBundleM() {
  toast('🚧 กำลังพัฒนา');
}

function editBundle(id) {
  toast('🚧 กำลังพัฒนา');
}

function deleteBundleConfirm(id) {
  if (!confirm('ลบ Bundle นี้?')) return;
  deleteBundle(id);
  toast('🗑️ ลบแล้ว');
  render();
}

function rProductDemo(el) {
  document.getElementById('pgT').textContent = '🚁 Demo Unit';
  var demos = getAllDemoUnits();
  var html = '<div class="card"><h2>🚁 Demo Unit Pricing <span class="ml"><button class="btn bp" onclick="showAddDemoUnitM()">➕ เพิ่ม Demo Unit</button></span></h2>';
  if (demos.length === 0) {
    html += '<div class="empty"><p>ยังไม่มี Demo Unit</p></div>';
  } else {
    html += '<div class="export-wrap"><table class="export-table"><thead><tr><th>#</th><th>SKU</th><th>EAN</th><th>สินค้า</th><th>ราคา Demo</th><th>สถานะ</th><th></th></tr></thead><tbody>';
    for (var i = 0; i < demos.length; i++) {
      var d = demos[i];
      html += '<tr><td class="pipe-row-num">' + (i+1) + '</td><td>' + sanitize(d.sku||'-') + '</td><td>' + sanitize(d.ean||'-') + '</td><td>' + sanitize(d.productName||d.name) + '</td><td style="text-align:right">' + fmtMoney(d.price) + '</td><td>' + (d.enabled ? '✅ Active' : '⏸ Inactive') + '</td><td><button class="btn bsm bo" onclick="editDemoUnit(\'' + d.id + '\')">✏️</button></td></tr>';
    }
    html += '</tbody></table></div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function showAddDemoUnitM() {
  toast('🚧 กำลังพัฒนา');
}

function editDemoUnit(id) {
  toast('🚧 กำลังพัฒนา');
}

function rProductImport(el) {
  document.getElementById('pgT').textContent = '📥 Import/Export สินค้า';
  var html = '<div class="card"><h2>📤 Export สินค้า</h2><div class="bg"><button class="btn bp" onclick="exportProductsToExcel()">📥 Export สินค้าทั้งหมด</button><button class="btn bo" onclick="exportDemoUnitsToExcel()">🚁 Export Demo Units</button></div></div>';
  html += '<div class="card"><h2>📥 Import สินค้า</h2><div class="fg"><input type="file" id="importProductsFile" accept=".xlsx,.xls"><button class="btn bp" onclick="doImportProducts()">📤 เริ่ม Import</button></div><div id="importProgress" style="display:none"><div class="pb"><div class="pf pf-blue" style="width:0%"></div></div><div id="importStatus"></div></div></div>';
  html += '<div class="card"><h2>🚁 Import Demo Units</h2><div class="fg"><input type="file" id="importDemoFile" accept=".xlsx,.xls"><button class="btn bp" onclick="doImportDemoUnits()">📤 Import Demo Units</button></div></div>';
  html += '<div class="card"><h2>📋 คำแนะนำ</h2><div class="hint">1. กด Export เพื่อดาวน์โหลดไฟล์ Excel<br>2. แก้ไขข้อมูล (SKU, EAN, ชื่อ, ราคา, EOL, Type)<br>3. บันทึกแล้ว Import กลับ</div></div>';
  el.innerHTML = html;
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