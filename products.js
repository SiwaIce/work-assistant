// ================================================================
// PRODUCTS MANAGEMENT MODULE - COMPLETE & FULL FEATURED
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
      // Handle array format (Firebase sync legacy)
      if (Array.isArray(parsed)) {
        return { models: parsed, bundles: [], demoUnits: [], lastUpdated: null };
      }
      // Handle indexed object {"0": {...}, "1": {...}}
      if (parsed && !parsed.models && typeof parsed === 'object') {
        var vals = Object.values(parsed);
        if (vals.length && vals[0] && vals[0].id) {
          return { models: vals, bundles: [], demoUnits: [], lastUpdated: null };
        }
      }
      // Normal format
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
  // Sync to v7_config for backward compatibility
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
  // Sync to Firebase if available
  if (typeof db !== 'undefined' && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    syncProductsToFirebase(data);
  }
}

// ================================================================
// FIREBASE SYNC (optional, safe if not present)
// ================================================================

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
    snapshot.forEach(function(doc) { products.push(doc.data()); });
    // ✅ แปลงโครงสร้างให้มีฟิลด์ใหม่ (rrpInVat, rrpExVat) ถ้าขาด
    products = products.map(function(p) { return ensureProductStructure(p); });
    var data = getProductsData();
    data.models = products;
    data.lastUpdated = new Date().toISOString();
    saveProductsData(data);
    return true;
  }).catch(function() { return false; });
}

// ✅ ฟังก์ชันตรวจสอบและเติมฟิลด์ที่ขาดหายใน product
function ensureProductStructure(p) {
  if (!p) return { name: '', price: 0, rrpInVat: 0, rrpExVat: 0, typePrices: { S:0, A:0, B:0, Other:0 } };
  // ฟิลด์พื้นฐาน
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
  // ราคา B (type 3) ควรตรงกับ p.price
  if (p.price === undefined) p.price = p.typePrices.B;
  return p;
}

// ตรวจสอบและแปลงโครงสร้างของสินค้าทั้งหมด
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
    eol: productData.eol || false,
    isBundle: productData.isBundle || false,
    isSoftware: productData.isSoftware || false,
    isService: productData.isService || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  // ตรวจสอบให้ typePrices.B ตรงกับ price
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
      // ตรวจสอบความสอดคล้อง: price ควรเท่ากับ typePrices.B
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
// BUNDLE MANAGEMENT (ยังคงเดิม)
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
// DEMO UNIT MANAGEMENT (ยังคงเดิม)
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
  var rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (!rows || rows.length < 2) return { imported: 0, updated: 0, errors: 0 };

  var imported = 0, updated = 0, errors = 0;
  for (var i = 1; i < rows.length; i++) {
    try {
      var row = rows[i];
      if (!row || row.length < 3) {
        errors++;
        continue;
      }
      // ตามโครงสร้างไฟล์: 
      // [0]=SiS part, [1]=EAN, [2]=Product Name, [3]=RRP in Vat, [4]=RRP Ex Vat,
      // [5]=Type1(S), [6]=Type2(A), [7]=Type3(B), [8]=Type4(Other)
      var sku = (row[0] !== undefined ? row[0] : '').toString().trim();
      var ean = (row[1] !== undefined ? row[1] : '').toString().trim();
      var name = (row[2] !== undefined ? row[2] : '').toString().trim();
      if (!name) {
        errors++;
        continue;
      }

      var rrpInVat = parseFloat(row[3]) || 0;
      var rrpExVat = parseFloat(row[4]) || 0;
      var priceS = parseFloat(row[5]) || 0;
      var priceA = parseFloat(row[6]) || 0;
      var priceB = parseFloat(row[7]) || 0;
      var priceOther = parseFloat(row[8]) || 0;

      // ถ้าไม่มีราคา B แต่มี RRP Ex Vat ให้ใช้ RRP Ex Vat
      if (priceB === 0 && rrpExVat > 0) priceB = rrpExVat;

      var isBundle = (sku && sku.endsWith('A')) || (ean && ean.startsWith('CB.'));
      var isSoftware = (name.indexOf('FlightHub') !== -1 || name.indexOf('Terra') !== -1);
      var isService = (name.indexOf('Warranty') !== -1 || name.indexOf('Service') !== -1 || name.indexOf('Staffing') !== -1);

      var productData = {
        name: name,
        sku: sku,
        ean: ean,
        rrpInVat: rrpInVat,
        rrpExVat: rrpExVat,
        price: priceB,
        typePrices: { S: priceS, A: priceA, B: priceB, Other: priceOther },
        eol: false,
        isBundle: isBundle,
        isSoftware: isSoftware,
        isService: isService
      };

      var existing = getProductBySku(sku) || getProductByEan(ean);
      if (existing) {
        updateProduct(existing.id, productData);
        updated++;
      } else {
        addProduct(productData);
        imported++;
      }
    } catch(e) {
      errors++;
      console.warn('Row', i, 'error:', e);
    }
  }
  console.log(`Import products: +${imported}, updated ${updated}, errors ${errors}`);
  return { imported: imported, updated: updated, errors: errors };
}

function importBundlesFromSheet(worksheet) {
  // (คงเดิม ตามที่มี)
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
  // (คงเดิม)
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
  if (!fileInput || !fileInput.files[0]) {
    toast('⚠️ กรุณาเลือกไฟล์ Excel');
    return;
  }
  toast('🔄 กำลังนำเข้าข้อมูล...');
  importFullExcel(fileInput.files[0], function(res) {
    if (res.success) {
      var msg = '✅ นำเข้าเสร็จ! ';
      if (res.result.products) msg += 'สินค้า: +' + res.result.products.imported + ' อัปเดต ' + res.result.products.updated + ' ';
      if (res.result.bundles) msg += 'Bundle: +' + res.result.bundles.imported + ' ';
      if (res.result.demos) msg += 'Demo: +' + res.result.demos.imported;
      toast(msg);
      setTimeout(function() { location.reload(); }, 1500);
    } else {
      toast('❌ นำเข้าล้มเหลว: ' + res.error, true);
    }
  });
}

// ================================================================
// EXPORT TO EXCEL (ตรงกับโครงสร้างไฟล์ที่ใช้ import)
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
      'Type': p.isSoftware ? 'Software' : (p.isService ? 'Service' : (p.isBundle ? 'Bundle' : 'Hardware'))
    };
  });
  var ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{wch:20},{wch:15},{wch:40},{wch:15},{wch:15},{wch:15},{wch:15},{wch:15},{wch:15},{wch:8},{wch:12}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'single');
  XLSX.writeFile(wb, 'products-export-' + _td() + '.xlsx');
  toast('📥 Export Excel สำเร็จ!');
}

function exportBundlesToExcel() {
  // คงเดิม
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
  // คงเดิม
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
// PAGE RENDERERS (ปรับปรุงให้แสดง RRP in/Ex Vat)
// ================================================================

function rProducts(el) {
  document.getElementById('pgT').textContent = '📦 สินค้าทั้งหมด';
  var products = getAllProducts();
  var html = '<div class="card"><h2>📋 สินค้าทั้งหมด <span class="ml"><button class="btn bp" onclick="showAddProductM()">➕ เพิ่มสินค้า</button><button class="btn bo" onclick="exportProductsToExcel()">📥 Export Excel</button></span></h2>';
  html += '<div class="export-wrap"><table class="export-table" id="productsTable"><thead><tr>' +
    '<th>#</th><th>SKU</th><th>EAN</th><th>ชื่อสินค้า</th>' +
    '<th>RRP in Vat</th><th>RRP Ex Vat</th>' +
    '<th>S</th><th>A</th><th>B</th><th>Other</th>' +
    '<th>สถานะ</th><th></th>' +
    '</tr></thead><tbody id="productsTableBody"></tbody></table></div></div>';
  el.innerHTML = html;
  renderProductsTable(products);
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
    if (p.isSoftware) badge += ' <span class="tag tag-active">💻 SW</span>';
    if (p.isService) badge += ' <span class="tag tag-on-hold">🛠️ SV</span>';
    if (p.isBundle) badge += ' <span class="tag tag-count">🎁 Bundle</span>';
    html += '<tr>';
    html += '<td class="pipe-row-num">' + (i+1) + '</td>';
    html += '<td>' + sanitize(p.sku || '-') + '</td>';
    html += '<td>' + sanitize(p.ean || '-') + '</td>';
    html += '<td><strong>' + sanitize(p.name) + '</strong></td>';
    html += '<td style="text-align:right">' + fmtMoney(p.rrpInVat) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.rrpExVat) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.typePrices?.S) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.typePrices?.A) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.price) + '</td>';
    html += '<td style="text-align:right">' + fmtMoney(p.typePrices?.Other) + '</td>';
    html += '<td>' + badge + '</td>';
    html += '<td><button class="btn bsm bo" onclick="showEditProductM(\'' + p.id + '\')">✏️</button></td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

function rProductPrices(el) {
  document.getElementById('pgT').textContent = '💰 ราคาตาม Level';
  var products = getAllProducts();
  var html = '<div class="card"><h2>💰 ราคาสินค้าแยกตาม Level</h2>';
  html += '<div class="export-wrap"><table class="export-table"><thead><tr>' +
    '<th>#</th><th>สินค้า</th>' +
    '<th>RRP in Vat</th><th>RRP Ex Vat</th>' +
    '<th>S</th><th>A</th><th>B</th><th>Other</th><th></th>' +
    '</tr></thead><tbody>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    html += '<tr>';
    html += '<td class="pipe-row-num">' + (i+1) + '</td>';
    html += '<td><strong>' + sanitize(p.name) + '</strong></td>';
    html += '<td><input type="number" id="rrp_in_vat_' + p.id + '" value="' + (p.rrpInVat || 0) + '" style="width:110px" class="fm-input"></td>';
    html += '<td><input type="number" id="rrp_ex_vat_' + p.id + '" value="' + (p.rrpExVat || 0) + '" style="width:110px" class="fm-input"></td>';
    html += '<td><input type="number" id="price_s_' + p.id + '" value="' + (p.typePrices?.S || 0) + '" style="width:100px" class="fm-input"></td>';
    html += '<td><input type="number" id="price_a_' + p.id + '" value="' + (p.typePrices?.A || 0) + '" style="width:100px" class="fm-input"></td>';
    html += '<td><input type="number" id="price_b_' + p.id + '" value="' + (p.price || 0) + '" style="width:100px" class="fm-input"></td>';
    html += '<td><input type="number" id="price_o_' + p.id + '" value="' + (p.typePrices?.Other || 0) + '" style="width:100px" class="fm-input"></td>';
    html += '<td><button class="btn bsm bp" onclick="saveSingleProductPrice(\'' + p.id + '\')">💾</button></td>';
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  html += '<div class="bg" style="margin-top:12px"><button class="btn bp" onclick="saveAllProductPrices()">💾 บันทึกทั้งหมด</button></div></div>';
  el.innerHTML = html;
}

function rProductBundles(el) {
  // คงเดิม
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
  // คงเดิม
  document.getElementById('pgT').textContent = '🚁 Demo Unit';
  var demos = getAllDemoUnits();
  var html = '<div class="card"><h2>🚁 Demo Unit Pricing <span class="ml"><button class="btn bp" onclick="showAddDemoUnitM()">➕ เพิ่ม Demo Unit</button><button class="btn bo" onclick="exportDemoUnitsToExcel()">📥 Export Excel</button></span></h2>';
  if (!demos.length) {
    html += '<div class="empty"><p>ยังไม่มี Demo Unit</p><button class="btn bp" onclick="showAddDemoUnitM()">➕ สร้างรายการแรก</button></div>';
  } else {
    html += '<div class="export-wrap"><table class="export-table"><thead><tr><th>#</th><th>SKU</th><th>EAN</th><th>สินค้า</th><th>ราคา Demo</th><th>สถานะ</th><th></th></tr></thead><tbody>';
    for (var i = 0; i < demos.length; i++) {
      var d = demos[i];
      var product = d.productId ? getProductById(d.productId) : null;
      var productName = product ? product.name : (d.productName || d.name || '');
      html += '<tr><td class="pipe-row-num">' + (i+1) + '</td><td>' + sanitize(d.sku || '-') + '</td><td>' + sanitize(d.ean || '-') + '</td><td>' + sanitize(productName) + '</td><td style="text-align:right">' + fmtMoney(d.price) + '</td><td>' + (d.enabled ? '✅ Active' : '⏸ Inactive') + '</td><td><button class="btn bsm bo" onclick="editDemoUnit(\'' + d.id + '\')">✏️</button></td></tr>';
    }
    html += '</tbody></table></div>';
  }
  html += '</div>';
  el.innerHTML = html;
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
// SIMPLE MODALS FOR ADD/EDIT (placeholder)
// ================================================================

function showAddProductM() { toast('🚧 ใช้ปุ่ม Import Excel แทนการเพิ่มทีละรายการ'); }
function showEditProductM(id) { toast('🚧 ใช้ Export -> แก้ไข -> Import แทน'); }

function saveSingleProductPrice(id) {
  var rrpInVat = parseFloat(document.getElementById('rrp_in_vat_' + id).value) || 0;
  var rrpExVat = parseFloat(document.getElementById('rrp_ex_vat_' + id).value) || 0;
  var priceS = parseFloat(document.getElementById('price_s_' + id).value) || 0;
  var priceA = parseFloat(document.getElementById('price_a_' + id).value) || 0;
  var priceB = parseFloat(document.getElementById('price_b_' + id).value) || 0;
  var priceO = parseFloat(document.getElementById('price_o_' + id).value) || 0;
  updateProduct(id, {
    rrpInVat: rrpInVat,
    rrpExVat: rrpExVat,
    price: priceB,
    typePrices: { S: priceS, A: priceA, B: priceB, Other: priceO }
  });
  toast('💾 บันทึกแล้ว');
  render();
}

function saveAllProductPrices() {
  var products = getAllProducts();
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var rrpInVat = parseFloat(document.getElementById('rrp_in_vat_' + p.id).value) || 0;
    var rrpExVat = parseFloat(document.getElementById('rrp_ex_vat_' + p.id).value) || 0;
    var priceS = parseFloat(document.getElementById('price_s_' + p.id).value) || 0;
    var priceA = parseFloat(document.getElementById('price_a_' + p.id).value) || 0;
    var priceB = parseFloat(document.getElementById('price_b_' + p.id).value) || 0;
    var priceO = parseFloat(document.getElementById('price_o_' + p.id).value) || 0;
    updateProduct(p.id, {
      rrpInVat: rrpInVat,
      rrpExVat: rrpExVat,
      price: priceB,
      typePrices: { S: priceS, A: priceA, B: priceB, Other: priceO }
    });
  }
  toast('💾 บันทึกราคาทั้งหมดแล้ว');
  render();
}

function showAddBundleM() { toast('🚧 กำลังพัฒนา'); }
function editBundle(id) { toast('🚧 กำลังพัฒนา'); }
function deleteBundleConfirm(id) { if (confirm('ลบ Bundle นี้?')) { deleteBundle(id); toast('🗑️ ลบแล้ว'); render(); } }
function showAddDemoUnitM() { toast('🚧 กำลังพัฒนา'); }
function editDemoUnit(id) { toast('🚧 กำลังพัฒนา'); }

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
  // ✅ บังคับให้ทุก product มีโครงสร้างใหม่
  ensureProductsStructure();
  if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    loadProductsFromFirebase().then(function(loaded) {
      if (loaded && typeof render === 'function') render();
    });
  }
  console.log('✅ Products Module initialized', data.models.length, 'products');
}

// เรียกทันที
initProductsModule();

// ================================================================
// OVERRIDE GLOBAL FUNCTIONS (for compatibility)
// ================================================================

window.modelOptionsNew = function(selected, showEOLBadge) {
  var products = getAllProducts();
  var html = '<option value="">-- เลือก Model --</option>';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var label = p.name;
    if (p.price > 0) label += ' (฿' + fmtMoney(p.price) + ')';
    if (showEOLBadge && p.eol) label += ' ⏰ EOL';
    if (p.isBundle) label += ' 🎁';
    html += '<option value="' + sanitize(p.name) + '"' + (selected === p.name ? ' selected' : '') + '>' + sanitize(label) + '</option>';
  }
  return html;
};

window.getModelPrice = function(modelName) {
  var p = getProductByName(modelName);
  return p ? p.price : 0;
};

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
  isEOL: isProductEOL,
  setEOL: setProductEOL,
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
  importFull: importFullExcel
};