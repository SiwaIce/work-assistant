// ================================================================
// QUOTATION MODULE V2 - PROFESSIONAL QUOTATION MANAGEMENT
// ================================================================

// ================================================================
// GLOBAL VARIABLES
// ================================================================
var quotations = [];
var currentQuoteId = null;
var quotationItems = [];
var selectedLevelForPrice = 'B';
var quoteStatusList = ['draft', 'sent', 'approved', 'rejected', 'expired'];
var quoteStatusLabels = {
  draft: '📝 Draft',
  sent: '📧 ส่งแล้ว',
  approved: '✅ อนุมัติ',
  rejected: '❌ ปฏิเสธ',
  expired: '⏰ หมดอายุ'
};
var quoteStatusColors = {
  draft: '#64748b',
  sent: '#3b82f6',
  approved: '#22c55e',
  rejected: '#ef4444',
  expired: '#f59e0b'
};

// ================================================================
// LOAD & SAVE QUOTATIONS
// ================================================================

function loadQuotations() {
  try {
    var saved = localStorage.getItem('v7_quotations_v2');
    if (saved) {
      quotations = JSON.parse(saved);
    } else {
      quotations = [];
    }
  } catch(e) {
    quotations = [];
  }
  return quotations;
}

function saveQuotations() {
  // ✅ บันทึกไป localStorage
  localStorage.setItem('v7_quotations_v2', JSON.stringify(quotations));
  
  // ✅ Sync to Firebase
  if (typeof db !== 'undefined' && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    // ใช้ batch ดีกว่า
    var batch = db.batch();
    var userRef = db.collection('users').doc(CURRENT_USER.uid).collection('quotations_v2');
    
    quotations.forEach(function(q) {
      var ref = userRef.doc(q.id);
      batch.set(ref, q);
    });
    
    batch.commit().catch(function(e) {
      console.warn('Firebase sync error:', e);
    });
  }
}

function getNextQuoteNumber() {
  var today = new Date();
  var yyyy = today.getFullYear();
  var mm = String(today.getMonth() + 1).padStart(2, '0');
  var dd = String(today.getDate()).padStart(2, '0');
  var prefix = 'QT-' + yyyy + mm + dd + '-';
  
  var maxSeq = 0;
  for (var i = 0; i < quotations.length; i++) {
    if (quotations[i].quoteNo && quotations[i].quoteNo.startsWith(prefix)) {
      var seq = parseInt(quotations[i].quoteNo.split('-').pop()) || 0;
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  var nextSeq = String(maxSeq + 1).padStart(3, '0');
  return prefix + nextSeq;
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

// ================================================================
// HELPER FUNCTIONS (FIXED)
// ================================================================

function getModelPriceByLevelForQuote(modelName, level) {
  if (!modelName) return 0;
  
  // 1. ลองจาก Products module
  if (typeof Products !== 'undefined' && Products.getByName) {
    var p = Products.getByName(modelName);
    if (p) {
      if (level === 'RRP') return p.rrpExVat || p.price || 0;
      var levelMap = { 'S': 'S', 'A': 'A', 'B': 'B', 'Other': 'Other' };
      var target = levelMap[level] || 'B';
      return (p.typePrices && p.typePrices[target] !== undefined) ? p.typePrices[target] : (p.rrpExVat || p.price || 0);
    }
  }
  
  // 2. ลองจาก localStorage v7_products โดยตรง
  try {
    var saved = localStorage.getItem('v7_products');
    if (saved) {
      var parsed = JSON.parse(saved);
      var products = [];
      if (Array.isArray(parsed)) products = parsed;
      else if (parsed && Array.isArray(parsed.models)) products = parsed.models;
      else if (parsed && typeof parsed === 'object') {
        var vals = Object.values(parsed);
        if (vals.length && vals[0] && vals[0].id) products = vals;
      }
      for (var i = 0; i < products.length; i++) {
        if (products[i].name === modelName) {
          if (level === 'RRP') return products[i].rrpExVat || products[i].price || 0;
          var levelMap2 = { 'S': 'S', 'A': 'A', 'B': 'B', 'Other': 'Other' };
          var target2 = levelMap2[level] || 'B';
          return (products[i].typePrices && products[i].typePrices[target2] !== undefined) ? products[i].typePrices[target2] : (products[i].rrpExVat || products[i].price || 0);
        }
      }
    }
  } catch(e) {}
  
  // 3. Fallback: อ่านจาก config.models
  var cfg = getConfig();
  var models = cfg.models || [];
  for (var i = 0; i < models.length; i++) {
    var m = models[i];
    var name = typeof m === 'object' ? m.name : m;
    if (name === modelName) {
      if (level === 'RRP') return (typeof m === 'object' && m.rrpExVat) ? m.rrpExVat : (m.price || 0);
      return (typeof m === 'object' && m.typePrices && m.typePrices[level]) ? m.typePrices[level] : (m.price || 0);
    }
  }
  return 0;
}

function getAllModelsWithPriceForQuote() {
  var products = [];
  
  // 1. ลองจาก Products module
  if (typeof Products !== 'undefined' && Products.getAll) {
    var prods = Products.getAll();
    if (prods && prods.length && prods[0] && prods[0].name) {
      return prods.filter(function(p) { return p && p.name; });
    }
  }
  
  // 2. ลองจาก localStorage v7_products โดยตรง
  try {
    var saved = localStorage.getItem('v7_products');
    if (saved) {
      var parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length && parsed[0].name) {
        return parsed.filter(function(p) { return p && p.name; });
      }
      if (parsed && Array.isArray(parsed.models) && parsed.models.length && parsed.models[0].name) {
        return parsed.models.filter(function(p) { return p && p.name; });
      }
      if (parsed && typeof parsed === 'object') {
        var vals = Object.values(parsed);
        if (vals.length && vals[0] && vals[0].name) {
          return vals.filter(function(p) { return p && p.name; });
        }
      }
    }
  } catch(e) { console.warn('Error reading v7_products:', e); }
  
  // 3. ลองจาก v7_config (models)
  var cfg = getConfig();
  if (cfg && cfg.models && cfg.models.length) {
    return cfg.models.map(function(m) {
      if (typeof m === 'object' && m.name) return m;
      if (typeof m === 'string') return { name: m, price: 0, rrpExVat: 0 };
      return { name: String(m), price: 0, rrpExVat: 0 };
    }).filter(function(p) { return p && p.name; });
  }
  
  // 4. สุดท้าย: fallback hardcoded list (กัน error)
  console.warn('No products found, using fallback list');
  return [
    { name: 'DJI Matrice 4E', sku: '6937224106352', price: 93380, rrpExVat: 93380, typePrices: { S: 0, A: 0, B: 93380, Other: 0 } },
    { name: 'DJI Matrice 4T', sku: '6937224106369', price: 142170, rrpExVat: 142170, typePrices: { S: 0, A: 0, B: 142170, Other: 0 } },
    { name: 'DJI Matrice 4TD', sku: '6937224106383A', price: 210500, rrpExVat: 210500, typePrices: { S: 0, A: 0, B: 210500, Other: 0 } },
    { name: 'DJI Matrice 400', sku: '6937224106406', price: 162300, rrpExVat: 162300, typePrices: { S: 0, A: 0, B: 162300, Other: 0 } },
    { name: 'DJI Matrice 30', sku: '6937224106246', price: 162300, rrpExVat: 162300, typePrices: { S: 0, A: 0, B: 162300, Other: 0 } },
    { name: 'DJI Matrice 30T', sku: '6937224106253', price: 210500, rrpExVat: 210500, typePrices: { S: 0, A: 0, B: 210500, Other: 0 } },
    { name: 'DJI Zenmuse L2', sku: '6941565994103', price: 125000, rrpExVat: 125000, typePrices: { S: 0, A: 0, B: 125000, Other: 0 } },
    { name: 'DJI Zenmuse L3', sku: '6941565994202', price: 175000, rrpExVat: 175000, typePrices: { S: 0, A: 0, B: 175000, Other: 0 } },
    { name: 'DJI Zenmuse H30T', sku: '6941565994301', price: 210500, rrpExVat: 210500, typePrices: { S: 0, A: 0, B: 210500, Other: 0 } },
    { name: 'DJI Dock 2', sku: '6941565994400', price: 175000, rrpExVat: 175000, typePrices: { S: 0, A: 0, B: 175000, Other: 0 } },
    { name: 'DJI Matrice 4D Series Battery', sku: '6937224107649', price: 8220, rrpExVat: 8220, typePrices: { S: 0, A: 0, B: 8220, Other: 0 } },
    { name: 'DJI RC Plus 2', sku: '6941565984197', price: 37810, rrpExVat: 37810, typePrices: { S: 0, A: 0, B: 37810, Other: 0 } },
    { name: 'DJI Matrice 4 Series Propellers', sku: '6941565994301', price: 2610, rrpExVat: 2610, typePrices: { S: 0, A: 0, B: 2610, Other: 0 } }
  ];
}
function formatNumber(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('th-TH');
}

function recalculateQuotationTotal() {
  var grossTotal = 0;
  for (var i = 0; i < quotationItems.length; i++) {
    grossTotal += (Number(quotationItems[i].amount) || 0);
  }
  var discountPercentElem = document.getElementById('quoteDiscountPercent');
  var discountPct = discountPercentElem ? (parseFloat(discountPercentElem.value) || 0) : 0;
  var discountAmount = grossTotal * discountPct / 100;
  var netAmount = grossTotal - discountAmount;
  var vatPercent = 7;
  var vatAmount = netAmount * vatPercent / 100;
  var totalAmount = netAmount + vatAmount;
  
  var grossEl = document.getElementById('quoteGrossTotal');
  if (grossEl) grossEl.textContent = formatNumber(grossTotal) + ' ฿';
  var discountAmtEl = document.getElementById('quoteDiscountAmount');
  if (discountAmtEl) discountAmtEl.textContent = formatNumber(discountAmount) + ' ฿';
  var netEl = document.getElementById('quoteNetAmount');
  if (netEl) netEl.textContent = formatNumber(netAmount) + ' ฿';
  var vatEl = document.getElementById('quoteVatAmount');
  if (vatEl) vatEl.textContent = formatNumber(vatAmount) + ' ฿';
  var totalEl = document.getElementById('quoteTotalAmount');
  if (totalEl) totalEl.textContent = formatNumber(totalAmount) + ' ฿';
  
  return { grossTotal: grossTotal, discountAmount: discountAmount, netAmount: netAmount, vatAmount: vatAmount, totalAmount: totalAmount };
}

// ================================================================
// RENDER QUOTATION ITEMS TABLE
// ================================================================

function renderQuotationItemsTable() {
  var container = document.getElementById('quotationItemsContainer');
  if (!container) return;

  if (quotationItems.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center"><div class="empty-state-icon">📦</div><p>ยังไม่มีสินค้า — เลือกสินค้าด้านล่าง แล้วกด ➕ เพิ่ม</p></div>';
    return;
  }

  var dlId = 'quoteItemNameList';
  var prods = ST.getAll('products');
  var dlHtml = '<datalist id="' + dlId + '">';
  for (var pi = 0; pi < prods.length; pi++) dlHtml += '<option value="' + sanitize(prods[pi].name) + '">';
  dlHtml += '</datalist>';

  var html = dlHtml + '<div class="export-wrap" style="overflow-x:auto"><table class="export-table" style="width:100%">';
  html += '<thead><tr>';
  html += '<th style="width:40px">#</th>';
  html += '<th>SKU</th>';
  html += '<th>ชื่อสินค้า</th>';
  html += '<th style="width:80px;text-align:center">จำนวน</th>';
  html += '<th style="width:120px;text-align:right">ราคาต่อหน่วย</th>';
  html += '<th style="width:120px;text-align:right">รวม</th>';
  html += '<th style="width:50px"></th>';
  html += '</tr></thead><tbody>';

  for (var i = 0; i < quotationItems.length; i++) {
    var item = quotationItems[i];
    html += '<tr>';
    html += '<td class="pipe-row-num" style="text-align:center">' + (i + 1) + '</td>';
    html += '<td style="font-size:11px" id="qiskucel_' + i + '">' + sanitize(item.sku || '-') + '</td>';
    html += '<td><input type="text" list="' + dlId + '" value="' + sanitize(item.name) + '" style="width:100%;font-weight:700;padding:4px" autocomplete="off" onchange="updateQuotationItemName(' + i + ', this.value)"></td>';
    html += '<td style="text-align:center"><input type="number" class="quote-item-qty" data-idx="' + i + '" value="' + (item.quantity || 1) + '" min="1" style="width:70px;text-align:center;padding:4px" onchange="updateQuotationItemQty(' + i + ', this.value)"></td>';
    html += '<td style="text-align:right"><input type="text" inputmode="decimal" class="quote-item-price js-money" data-idx="' + i + '" value="' + nmI(item.unitPrice || 0) + '" style="width:110px;text-align:right;padding:4px" onchange="updateQuotationItemPrice(' + i + ', this.value)"></td>';
    html += '<td style="text-align:right;font-weight:700;color:#22c55e">' + formatNumber(item.amount) + ' ฿</td>';
    html += '<td style="text-align:center"><button class="btn bsm bd" onclick="removeQuotationItem(' + i + ')">🗑️</button></td>';
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function updateQuotationItemQty(idx, qty) {
  qty = parseInt(qty) || 1;
  if (qty < 1) qty = 1;
  quotationItems[idx].quantity = qty;
  quotationItems[idx].amount = qty * (quotationItems[idx].unitPrice || 0);
  renderQuotationItemsTable();
  recalculateQuotationTotal();
}

function updateQuotationItemPrice(idx, price) {
  price = parseNum(price);
  quotationItems[idx].unitPrice = price;
  quotationItems[idx].amount = (quotationItems[idx].quantity || 1) * price;
  renderQuotationItemsTable();
  recalculateQuotationTotal();
}

function updateQuotationItemName(idx, newName) {
  newName = newName.trim();
  if (!newName || !quotationItems[idx]) return;
  quotationItems[idx].name = newName;
  var prods = ST.getAll('products');
  var found = prods.find(function(p) { return p.name === newName; });
  if (found) {
    if (found.sku) quotationItems[idx].sku = found.sku;
    var selectedLevel = document.getElementById('editQuoteLevel');
    var level = selectedLevel ? selectedLevel.value : null;
    var newPrice = level && typeof getModelPriceByLevelForQuote === 'function'
      ? getModelPriceByLevelForQuote(newName, level)
      : (found.rrpExVat || found.price || 0);
    if (newPrice > 0) {
      quotationItems[idx].unitPrice = newPrice;
      quotationItems[idx].amount = (quotationItems[idx].quantity || 1) * newPrice;
    }
  }
  renderQuotationItemsTable();
  recalculateQuotationTotal();
}

function removeQuotationItem(idx) {
  quotationItems.splice(idx, 1);
  renderQuotationItemsTable();
  recalculateQuotationTotal();
}

// ================================================================
// ADD PRODUCT WITH AUTOCOMPLETE
// ================================================================

function pickerAddToQuote(model, qty) {
  var mi = document.getElementById('newItemModel');
  var qi = document.getElementById('newItemQty');
  if (mi) mi.value = model;
  if (qi) qi.value = qty || 1;
  if (typeof addRecentModel === 'function') addRecentModel(model);
  addQuotationItemFromInput();
}

function addQuotationItemFromInput() {
  var modelInput = document.getElementById('newItemModel');
  var modelName = modelInput ? modelInput.value.trim() : '';
  var qty = parseInt(document.getElementById('newItemQty')?.value) || 1;
  
  if (!modelName) {
    toast('กรุณาเลือกสินค้า');
    return;
  }
  
  var products = getAllModelsWithPriceForQuote();
  var selectedProduct = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].name === modelName) {
      selectedProduct = products[i];
      break;
    }
  }
  
  if (!selectedProduct) {
    toast('ไม่พบสินค้าในระบบ');
    return;
  }
  
  var unitPrice = getModelPriceByLevelForQuote(modelName, selectedLevelForPrice);
  
  // Check for duplicate
  var existing = false;
  for (var i = 0; i < quotationItems.length; i++) {
    if (quotationItems[i].name === modelName) {
      quotationItems[i].quantity += qty;
      quotationItems[i].amount = quotationItems[i].quantity * quotationItems[i].unitPrice;
      existing = true;
      break;
    }
  }
  
  if (!existing) {
    quotationItems.push({
      sku: selectedProduct.sku || '',
      name: modelName,
      quantity: qty,
      unitPrice: unitPrice,
      amount: qty * unitPrice
    });
  }
  
  if (modelInput) modelInput.value = '';
  document.getElementById('newItemQty').value = '1';
  
  renderQuotationItemsTable();
  recalculateQuotationTotal();
  toast('➕ เพิ่ม ' + modelName);
}

// ================================================================
// QUICK PRICE ESTIMATOR — ดูยอดรวมคร่าวๆ ไม่ผูก Dealer ไม่ใช่ใบเสนอราคาจริง
// บันทึกชุดสินค้าที่ใช้บ่อยเป็น "Solution" เรียกซ้ำได้ (เก็บแค่ model+qty ราคาคำนวณสดเสมอ)
// ================================================================
var estimatorItems = [];

function getSolutionPresets() { return ST.getAll('solutionPresets'); }
function saveSolutionPresets(list) {
  localStorage.setItem('v7_solutionPresets', JSON.stringify(list));
  if (typeof syncToFirebase === 'function') syncToFirebase('solutionPresets', list);
}

function rQuoteEstimator(el) {
  document.getElementById('pgT').textContent = '💡 ประเมินราคาคร่าวๆ';
  estimatorItems = [];

  var html = '<div style="max-width:640px;margin:0 auto">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  html += '<button class="btn bo" onclick="go(\'quotationV2\')">← กลับ</button>';
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--text2);margin:8px 0 14px">ไม่ผูก Dealer · ไม่ใช่ใบเสนอราคาจริง — แค่ดูยอดรวมเร็วๆ</div>';

  html += '<div id="estPresetZone"></div>';

  html += '<div style="display:flex;gap:6px;margin-bottom:12px" id="estAddRow">';
  html += '<input type="text" id="estNewModel" list="estProdList" class="fm-input" placeholder="🔍 ค้นหาสินค้า..." style="flex:1" autocomplete="off">';
  html += '<datalist id="estProdList">' + getAllModelsWithPriceForQuote().map(function(p) { return '<option value="' + sanitize(p.name) + '">'; }).join('') + '</datalist>';
  html += '<input type="number" id="estNewQty" class="fm-input" value="1" min="1" style="width:70px;text-align:center">';
  html += '<button class="btn bp" onclick="addEstimatorItemFromInput()">➕ เพิ่ม</button>';
  html += '</div>';

  html += '<div id="estItemsZone"></div>';
  html += '<div id="estTotalZone"></div>';

  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">';
  html += '<button class="btn bp" style="flex:1;background:#22c55e" onclick="showSaveSolutionM()">💾 บันทึกเป็น Solution</button>';
  html += '<button class="btn bo" style="flex:1" onclick="estimatorItems=[];renderEstimatorItemsTable();">🗑️ ล้างทั้งหมด</button>';
  html += '</div>';
  html += '<button class="btn bo" style="width:100%;margin-top:6px" onclick="estimatorToQuotation()">➡️ แปลงเป็นใบเสนอราคาจริง (ผูก Dealer)</button>';
  html += '</div>';

  el.innerHTML = html;
  renderEstimatorPresetChips();
  renderEstimatorItemsTable();
}

function renderEstimatorPresetChips() {
  var zone = document.getElementById('estPresetZone');
  if (!zone) return;
  var presets = getSolutionPresets();
  if (!presets.length) { zone.innerHTML = ''; return; }
  var h = '<div style="font-size:11px;color:var(--text2);margin-bottom:6px">📂 Solution ที่บันทึกไว้ (กดเพื่อโหลด)</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">';
  presets.forEach(function(p) {
    h += '<span style="display:inline-flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:4px 6px 4px 12px">' +
      '<span style="cursor:pointer;font-size:12px" onclick="loadSolutionPreset(\'' + p.id + '\')">' + sanitize(p.name) + ' <span style="color:var(--text2)">(' + (p.items || []).length + ' รายการ)</span></span>' +
      '<button class="btn-xs btn-red" title="ลบ Solution นี้" onclick="deleteSolutionPreset(\'' + p.id + '\')">✕</button>' +
      '</span>';
  });
  h += '</div>';
  zone.innerHTML = h;
}

function renderEstimatorItemsTable() {
  var zone = document.getElementById('estItemsZone');
  if (!zone) return;
  if (!estimatorItems.length) {
    zone.innerHTML = '<div class="empty" style="padding:20px;text-align:center"><div class="icon">📦</div><p>ยังไม่มีสินค้า — ค้นหาแล้วกด ➕ เพิ่ม หรือโหลด Solution ที่บันทึกไว้</p></div>';
    recalcEstimatorTotal();
    return;
  }
  var h = '<div class="export-wrap" style="overflow-x:auto;margin-bottom:10px"><table class="export-table" style="width:100%">';
  h += '<thead><tr><th style="width:40px">#</th><th>สินค้า</th><th style="width:80px;text-align:center">จำนวน</th><th style="width:120px;text-align:right">ราคาต่อหน่วย</th><th style="width:120px;text-align:right">รวม</th><th style="width:40px"></th></tr></thead><tbody>';
  estimatorItems.forEach(function(item, i) {
    h += '<tr>';
    h += '<td class="pipe-row-num" style="text-align:center">' + (i + 1) + '</td>';
    h += '<td>' + sanitize(item.name) + '</td>';
    h += '<td style="text-align:center"><input type="number" value="' + (item.quantity || 1) + '" min="1" style="width:60px;text-align:center;padding:4px" onchange="updateEstimatorItemQty(' + i + ', this.value)"></td>';
    h += '<td style="text-align:right"><input type="text" inputmode="decimal" class="js-money" value="' + nmI(item.unitPrice || 0) + '" style="width:100px;text-align:right;padding:4px" onchange="updateEstimatorItemPrice(' + i + ', this.value)"></td>';
    h += '<td style="text-align:right;font-weight:700;color:#22c55e">' + formatNumber(item.amount) + ' ฿</td>';
    h += '<td style="text-align:center"><button class="btn bsm bd" onclick="removeEstimatorItem(' + i + ')">🗑️</button></td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  zone.innerHTML = h;
  recalcEstimatorTotal();
}

function recalcEstimatorTotal() {
  var sub = estimatorItems.reduce(function(s, it) { return s + (Number(it.amount) || 0); }, 0);
  var vat = sub * 0.07;
  var zone = document.getElementById('estTotalZone');
  if (!zone) return;
  zone.innerHTML = '<div style="background:var(--card);border:1px solid var(--accent);border-radius:10px;padding:14px;text-align:center">' +
    '<div style="font-size:10px;color:var(--text2)">รวมประมาณ (ก่อน VAT)</div>' +
    '<div style="font-size:24px;font-weight:700;color:var(--accent)">' + formatNumber(sub) + ' ฿</div>' +
    '<div style="font-size:10px;color:var(--text2);margin-top:2px">รวม VAT 7%: ' + formatNumber(sub + vat) + ' ฿</div>' +
    '</div>';
}

function addEstimatorItemFromInput() {
  var modelInput = document.getElementById('estNewModel');
  var modelName = modelInput ? modelInput.value.trim() : '';
  var qty = parseInt(document.getElementById('estNewQty').value) || 1;
  if (!modelName) { toast('กรุณาเลือกสินค้า'); return; }

  var products = getAllModelsWithPriceForQuote();
  var product = products.find(function(p) { return p.name === modelName; });
  if (!product) { toast('ไม่พบสินค้าในระบบ'); return; }

  var unitPrice = getModelPriceByLevelForQuote(modelName, 'RRP');

  var existing = estimatorItems.find(function(it) { return it.name === modelName; });
  if (existing) {
    existing.quantity += qty;
    existing.amount = existing.quantity * existing.unitPrice;
  } else {
    estimatorItems.push({ sku: product.sku || '', name: modelName, quantity: qty, unitPrice: unitPrice, amount: qty * unitPrice });
  }

  modelInput.value = '';
  document.getElementById('estNewQty').value = '1';
  renderEstimatorItemsTable();
}

function updateEstimatorItemQty(idx, qty) {
  qty = parseInt(qty) || 1;
  if (qty < 1) qty = 1;
  estimatorItems[idx].quantity = qty;
  estimatorItems[idx].amount = qty * (estimatorItems[idx].unitPrice || 0);
  renderEstimatorItemsTable();
}

function updateEstimatorItemPrice(idx, price) {
  price = parseNum(price);
  estimatorItems[idx].unitPrice = price;
  estimatorItems[idx].amount = (estimatorItems[idx].quantity || 1) * price;
  renderEstimatorItemsTable();
}

function removeEstimatorItem(idx) {
  estimatorItems.splice(idx, 1);
  renderEstimatorItemsTable();
}

// โหลด Solution ที่บันทึกไว้ — ดึงแค่ model+qty แล้วคำนวณราคาสดจากสินค้าปัจจุบันเสมอ (ไม่ใช้ราคาแช่แข็งตอนบันทึก)
function loadSolutionPreset(presetId) {
  var preset = getSolutionPresets().find(function(p) { return p.id === presetId; });
  if (!preset) return;
  estimatorItems = (preset.items || []).map(function(it) {
    var unitPrice = getModelPriceByLevelForQuote(it.name, 'RRP');
    return { sku: it.sku || '', name: it.name, quantity: it.quantity || 1, unitPrice: unitPrice, amount: (it.quantity || 1) * unitPrice };
  });
  renderEstimatorItemsTable();
  toast('📂 โหลด "' + preset.name + '" แล้ว');
}

// chip "Solution ที่บันทึกไว้" ในใบเสนอราคาจริง — กดทีเดียวเพิ่มหลายรายการพร้อมราคาตาม Level ของใบนี้ (ไม่ใช่ราคา RRP แช่แข็งแบบ Estimator)
function renderQuoteSolutionChips() {
  var zone = document.getElementById('quoteSolutionChipZone');
  if (!zone) return;
  var presets = getSolutionPresets();
  if (!presets.length) { zone.innerHTML = ''; return; }
  var h = '<div style="font-size:11px;color:var(--text2);margin-bottom:6px">📂 Solution ที่บันทึกไว้ (กดเพื่อเพิ่มเข้าใบเสนอราคา)</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">';
  presets.forEach(function(p) {
    h += '<span style="display:inline-flex;align-items:center;cursor:pointer;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:12px" onclick="loadSolutionPresetIntoQuotation(\'' + p.id + '\')">' +
      sanitize(p.name) + ' <span style="color:var(--text2);margin-left:4px">(' + (p.items || []).length + ' รายการ)</span></span>';
  });
  h += '</div>';
  zone.innerHTML = h;
}

function loadSolutionPresetIntoQuotation(presetId) {
  var preset = getSolutionPresets().find(function(p) { return p.id === presetId; });
  if (!preset) return;
  (preset.items || []).forEach(function(it) {
    var unitPrice = getModelPriceByLevelForQuote(it.name, selectedLevelForPrice);
    var existing = quotationItems.find(function(qi) { return qi.name === it.name; });
    if (existing) {
      existing.quantity += (it.quantity || 1);
      existing.amount = existing.quantity * existing.unitPrice;
    } else {
      quotationItems.push({ sku: it.sku || '', name: it.name, quantity: it.quantity || 1, unitPrice: unitPrice, amount: (it.quantity || 1) * unitPrice });
    }
  });
  renderQuotationItemsTable();
  recalculateQuotationTotal();
  toast('📂 เพิ่ม "' + preset.name + '" แล้ว');
}

function showSaveSolutionM() {
  if (!estimatorItems.length) { toast('⚠️ ยังไม่มีสินค้าให้บันทึก'); return; }
  var h = '<div style="max-width:360px">' +
    '<div class="fg"><label>📝 ชื่อ Solution</label><input type="text" id="estSolName" class="fm-input" placeholder="เช่น ชุดทำแผนที่"></div>' +
    '<div class="hint">เก็บแค่รายการสินค้า+จำนวน ไม่เก็บราคา (ราคาจะคำนวณสดทุกครั้งที่โหลด)</div>' +
    '<div class="fm-actions"><button class="btn btn-blue" onclick="saveSolutionPreset()">💾 บันทึก</button><button class="btn" onclick="closeM()">ยกเลิก</button></div>' +
    '</div>';
  openM('💾 บันทึกเป็น Solution', h);
}

function saveSolutionPreset() {
  var name = (document.getElementById('estSolName').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ Solution'); return; }
  var presets = getSolutionPresets();
  presets.push({
    id: 'sol_' + Date.now(),
    name: name,
    items: estimatorItems.map(function(it) { return { name: it.name, sku: it.sku || '', quantity: it.quantity }; }),
    createdAt: new Date().toISOString()
  });
  saveSolutionPresets(presets);
  closeMForce();
  toast('💾 บันทึก Solution "' + name + '" แล้ว');
  renderEstimatorPresetChips();
}

function deleteSolutionPreset(presetId) {
  if (!confirm('🗑️ ลบ Solution นี้?')) return;
  var presets = getSolutionPresets().filter(function(p) { return p.id !== presetId; });
  saveSolutionPresets(presets);
  renderEstimatorPresetChips();
}

// ส่งรายการที่ประเมินไว้ไปสร้างใบเสนอราคาจริง — เปิด modal สร้างใบเสนอราคาเดิม แล้วฝัง items
// ผ่าน window._pendingEstimatorItems ให้ createNewQuotation() อ่านไปเติมให้หลังสร้างใบเสร็จ
function estimatorToQuotation() {
  if (!estimatorItems.length) { toast('⚠️ ยังไม่มีสินค้าให้แปลง'); return; }
  window._pendingEstimatorItems = JSON.parse(JSON.stringify(estimatorItems));
  showCreateQuotationModal();
}

// ================================================================
// RENDER QUOTATION LIST PAGE (HOME)
// ================================================================

function rQuotationV2(el) {
  document.getElementById('pgT').textContent = '💰 Quotation Tracker';
  
  // ✅ โหลดข้อมูลทุกครั้งที่เปิดหน้า
  try {
    quotations = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]');
  } catch(e) {
    quotations = [];
  }
  
  var dealers = ST.getAll('dealers');
  var dealerMap = {};
  for (var i = 0; i < dealers.length; i++) {
    dealerMap[dealers[i].id] = dealers[i];
  }
  
  var html = '';
  
  // Header with create button
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
  html += '<h2 style="font-size:1rem;margin:0">📋 รายการใบเสนอราคา</h2>';
  html += '<div style="display:flex;gap:8px">';
  html += '<button class="btn bo" onclick="go(\'quoteEstimator\')">💡 ประเมินราคาคร่าวๆ</button>';
  html += '<button class="btn bp" onclick="showCreateQuotationModal()" style="background:#22c55e">➕ สร้างใบเสนอราคา</button>';
  html += '</div>';
  html += '</div>';
  
  // Filter bar
  html += '<div class="card" style="padding:12px;margin-bottom:16px">';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">';
  html += '<div class="fg" style="flex:2"><label>🔍 ค้นหา</label><input type="text" id="quoteSearchInput" class="fm-input" placeholder="เลขที่, Dealer..." oninput="filterQuoteList()"></div>';
  html += '<div class="fg" style="flex:1"><label>🏪 Dealer</label><select id="quoteDealerFilter" class="fm-input" onchange="filterQuoteList()"><option value="all">ทั้งหมด</option>' + dealers.map(function(d) { return '<option value="' + d.id + '">' + sanitize(d.name) + '</option>'; }).join('') + '</select></div>';
  html += '<div class="fg" style="flex:1"><label>📊 สถานะ</label><select id="quoteStatusFilter" class="fm-input" onchange="filterQuoteList()"><option value="all">ทั้งหมด</option>' + quoteStatusList.map(function(s) { return '<option value="' + s + '">' + quoteStatusLabels[s] + '</option>'; }).join('') + '</select></div>';
  html += '<div class="fg" style="flex:0.5"><label>&nbsp;</label><button class="btn bo" style="width:100%" onclick="resetQuoteFilters()">✖️ ล้าง</button></div>';
  html += '</div></div>';
  
  // Quote cards grid
  html += '<div class="quote-grid" id="quoteGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">';
  
  if (quotations.length === 0) {
    html += '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px"><div class="empty-state-icon" style="font-size:48px">💰</div><p>ยังไม่มีใบเสนอราคา</p><button class="btn bp" onclick="showCreateQuotationModal()" style="margin-top:8px">➕ สร้างใบแรก</button></div>';
  } else {
    for (var i = 0; i < quotations.length; i++) {
      var q = quotations[i];
      var dealer = dealerMap[q.dealerId] || { name: q.dealerName || '-' };
      var statusColor = quoteStatusColors[q.status] || '#64748b';
      var statusLabel = quoteStatusLabels[q.status] || q.status;
      
      html += '<div class="quote-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;transition:all 0.2s;cursor:pointer" onclick="editQuotation(\'' + q.id + '\')">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">';
      html += '<div><div style="font-weight:800;font-size:16px;color:var(--accent)">' + qcopyHtml(q.quoteNo) + '</div>';
      html += '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + sanitize(dealer.name) + '</div></div>';
      html += '<span class="tag" style="background:' + statusColor + '20;color:' + statusColor + ';border:1px solid ' + statusColor + '40">' + statusLabel + '</span>';
      html += '</div>';
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:12px">';
      html += '<div><div style="font-size:11px;color:var(--text2)">วันที่</div><div style="font-size:13px">' + (q.validFrom || '-') + '</div></div>';
      html += '<div><div style="font-size:11px;color:var(--text2)">หมดอายุ</div><div style="font-size:13px">' + (q.validTo || '-') + '</div></div>';
      html += '<div><div style="font-size:11px;color:var(--text2)">มูลค่า</div><div style="font-size:16px;font-weight:800;color:#22c55e">' + formatNumber(q.totalAmount) + ' ฿</div></div>';
      html += '</div>';
      html += '<div style="display:flex;gap:6px;border-top:1px solid var(--border);padding-top:12px">';
      html += '<button class="btn bsm bo" onclick="event.stopPropagation();editQuotation(\'' + q.id + '\')">✏️ แก้ไข</button>';
      html += '<button class="btn bsm bo" onclick="event.stopPropagation();previewQuotation(\'' + q.id + '\')">👁️ Preview</button>';
      html += '<button class="btn bsm bs" onclick="event.stopPropagation();exportQuotationToPDF(\'' + q.id + '\')">📎 PDF</button>';
      html += '</div></div>';
    }
  }
  
  html += '</div>';
  el.innerHTML = html;
}

function filterQuoteList() {
  var search = document.getElementById('quoteSearchInput')?.value.toLowerCase() || '';
  var dealerFilter = document.getElementById('quoteDealerFilter')?.value || 'all';
  var statusFilter = document.getElementById('quoteStatusFilter')?.value || 'all';
  
  var filtered = quotations.filter(function(q) {
    if (search && !q.quoteNo.toLowerCase().includes(search) && !(q.dealerName || '').toLowerCase().includes(search)) return false;
    if (dealerFilter !== 'all' && q.dealerId !== dealerFilter) return false;
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    return true;
  });
  
  var dealers = ST.getAll('dealers');
  var dealerMap = {};
  for (var i = 0; i < dealers.length; i++) dealerMap[dealers[i].id] = dealers[i];
  
  var grid = document.getElementById('quoteGrid');
  if (!grid) return;
  
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px"><div class="empty-state-icon">💰</div><p>ไม่พบใบเสนอราคา</p></div>';
    return;
  }
  
  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var q = filtered[i];
    var dealer = dealerMap[q.dealerId] || { name: q.dealerName || '-' };
    var statusColor = quoteStatusColors[q.status] || '#64748b';
    var statusLabel = quoteStatusLabels[q.status] || q.status;
    
    html += '<div class="quote-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;transition:all 0.2s;cursor:pointer" onclick="editQuotation(\'' + q.id + '\')">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">';
    html += '<div><div style="font-weight:800;font-size:16px;color:var(--accent)">' + qcopyHtml(q.quoteNo) + '</div>';
    html += '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + sanitize(dealer.name) + '</div></div>';
    html += '<span class="tag" style="background:' + statusColor + '20;color:' + statusColor + ';border:1px solid ' + statusColor + '40">' + statusLabel + '</span>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;margin-bottom:12px">';
    html += '<div><div style="font-size:11px;color:var(--text2)">วันที่</div><div style="font-size:13px">' + (q.validFrom || '-') + '</div></div>';
    html += '<div><div style="font-size:11px;color:var(--text2)">หมดอายุ</div><div style="font-size:13px">' + (q.validTo || '-') + '</div></div>';
    html += '<div><div style="font-size:11px;color:var(--text2)">มูลค่า</div><div style="font-size:16px;font-weight:800;color:#22c55e">' + formatNumber(q.totalAmount) + ' ฿</div></div>';
    html += '</div>';
    html += '<div style="display:flex;gap:6px;border-top:1px solid var(--border);padding-top:12px">';
    html += '<button class="btn bsm bo" onclick="event.stopPropagation();editQuotation(\'' + q.id + '\')">✏️ แก้ไข</button>';
    html += '<button class="btn bsm bo" onclick="event.stopPropagation();previewQuotation(\'' + q.id + '\')">👁️ Preview</button>';
    html += '<button class="btn bsm bs" onclick="event.stopPropagation();exportQuotationToPDF(\'' + q.id + '\')">📎 PDF</button>';
    html += '</div></div>';
  }
  grid.innerHTML = html;
}

function resetQuoteFilters() {
  var searchInput = document.getElementById('quoteSearchInput');
  if (searchInput) searchInput.value = '';
  var dealerFilter = document.getElementById('quoteDealerFilter');
  if (dealerFilter) dealerFilter.value = 'all';
  var statusFilter = document.getElementById('quoteStatusFilter');
  if (statusFilter) statusFilter.value = 'all';
  filterQuoteList();
}

// ================================================================
// CREATE NEW QUOTATION (MODAL)
// ================================================================

function showCreateQuotationModal() {
  var dealers = ST.getAll('dealers');
  
  // สร้าง datalist สำหรับ Dealer ให้พิมพ์ค้นหาได้
  var dealerDatalistId = 'dealerList_' + Date.now();
  var dealerOptionsHtml = '';
  for (var i = 0; i < dealers.length; i++) {
    dealerOptionsHtml += '<option value="' + sanitize(dealers[i].name) + '" data-id="' + dealers[i].id + '" data-level="' + (dealers[i].level || 'B') + '" data-term="' + (dealers[i].creditTerm || '') + '">';
  }
  
  var levelOptions = '<option value="RRP">💰 RRP (ราคาขายปลีก)</option>';
  levelOptions += '<option value="S">👑 S (Type 1)</option>';
  levelOptions += '<option value="A">⭐ A (Type 2)</option>';
  levelOptions += '<option value="B" selected>📦 B (Type 3)</option>';
  levelOptions += '<option value="Other">🔄 Other (Type 4)</option>';
  
  var html = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000">';
  html += '<div class="modal-container" style="background:var(--card);border-radius:20px;max-width:550px;width:90%;max-height:85vh;overflow-y:auto;border:1px solid var(--border)">';
  html += '<div class="modal-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--card)">';
  html += '<h3 style="font-size:18px;color:var(--accent);margin:0">➕ สร้างใบเสนอราคาใหม่</h3>';
  html += '<button class="modal-close" onclick="closeModal()" style="background:none;border:none;color:var(--text2);font-size:24px;cursor:pointer">✕</button>';
  html += '</div>';
  html += '<div class="modal-body" style="padding:20px">';
  
  // Dealer - เปลี่ยนเป็น input + datalist ให้พิมพ์เองได้
  html += '<div class="fg"><label>🏪 ชื่อ Dealer <span style="color:#ef4444">*</span></label>';
  html += '<input type="text" id="newQuoteDealerName" list="' + dealerDatalistId + '" class="fm-input" placeholder="พิมพ์ชื่อ Dealer หรือเลือกจากรายการ..." autocomplete="off" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)">';
  html += '<datalist id="' + dealerDatalistId + '">' + dealerOptionsHtml + '</datalist>';
  html += '<input type="hidden" id="newQuoteDealerId">';
  html += '<input type="hidden" id="newQuoteDealerLevel">';
  html += '</div>';
  
  html += '<div class="fr"><div class="fg"><label>📅 วันที่เริ่ม</label>';
  html += '<input type="text" id="newQuoteValidFrom" class="fm-input dp" value="' + _td() + '" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)"></div>';
  html += '<div class="fg"><label>📅 วันที่หมดอายุ</label>';
  html += '<input type="text" id="newQuoteValidTo" class="fm-input dp" value="' + addD(_td(), 30) + '" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)"></div></div>';
  
  html += '<div class="fr"><div class="fg"><label>💰 ระดับราคาที่ใช้</label>';
  html += '<select id="newQuoteLevel" class="fm-input" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)">' + levelOptions + '</select></div>';
  html += '<div class="fg"><label>💳 เงื่อนไขชำระเงิน</label>';
  html += '<input type="text" id="newQuotePaymentTerm" class="fm-input" placeholder="Net due 30 days" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)"></div></div>';
  
  html += '<div class="fg"><label>📄 เลขที่อ้างอิง (PO No.)</label>';
  html += '<input type="text" id="newQuotePoNo" class="fm-input" placeholder="1214845984" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)"></div>';
  
  html += '<div class="fg"><label>📝 หมายเหตุ</label>';
  html += '<textarea id="newQuoteRemark" rows="2" class="fm-input" placeholder="เงื่อนไขเพิ่มเติม..." style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)"></textarea></div>';
  
  html += '</div>';
  html += '<div class="modal-footer" style="padding:16px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:12px">';
  html += '<button class="btn" onclick="closeModal()" style="padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer">ยกเลิก</button>';
  html += '<button class="btn btn-primary" onclick="createNewQuotation()" style="padding:8px 16px;border-radius:10px;background:var(--accent);color:#fff;border:none;cursor:pointer">📝 สร้าง</button>';
  html += '</div></div></div>';
  
  document.body.insertAdjacentHTML('beforeend', html);
  
  // เพิ่ม event เมื่อเลือก Dealer จาก datalist
  var dealerInput = document.getElementById('newQuoteDealerName');
  if (dealerInput) {
    dealerInput.addEventListener('change', function() {
      var selectedName = this.value;
      var option = document.querySelector('#dealerList_' + dealerDatalistId.split('_')[1] + ' option[value="' + selectedName.replace(/"/g, '&quot;') + '"]');
      if (option) {
        document.getElementById('newQuoteDealerId').value = option.dataset.id;
        document.getElementById('newQuoteDealerLevel').value = option.dataset.level;
        var termInput = document.getElementById('newQuotePaymentTerm');
        if (termInput && !termInput.value && option.dataset.term) {
          termInput.value = option.dataset.term;
        }
      }
    });
  }
}
function newQuoteDealerChanged() {
  var dealerId = document.getElementById('newQuoteDealer').value;
  if (!dealerId) return;
  var dealer = ST.getOne('dealers', dealerId);
  if (dealer && dealer.creditTerm) {
    var termInput = document.getElementById('newQuotePaymentTerm');
    if (termInput && !termInput.value) termInput.value = dealer.creditTerm;
  }
}

function createNewQuotation() {
  var dealerName = document.getElementById('newQuoteDealerName').value.trim();
  var dealerId = document.getElementById('newQuoteDealerId').value;
  var dealerLevel = document.getElementById('newQuoteDealerLevel').value;
  var validFrom = dpG('newQuoteValidFrom') || _td();
  var validTo = dpG('newQuoteValidTo') || addD(_td(), 30);
  var levelUsed = document.getElementById('newQuoteLevel').value;
  var paymentTerm = document.getElementById('newQuotePaymentTerm').value.trim() || 'Net due 30 days';
  var poNo = document.getElementById('newQuotePoNo').value.trim();
  var remark = document.getElementById('newQuoteRemark').value.trim();
  
  if (!dealerName) { toast('กรุณากรอกชื่อ Dealer'); return; }
  
  // ถ้าไม่มี dealerId (พิมพ์เอง) ให้สร้าง dealer ชั่วคราว
  if (!dealerId) {
    dealerId = 'temp_' + Date.now();
    dealerLevel = 'B';
  }
  
  var newId = 'qt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  var newQuoteNo = getNextQuoteNumber();
  
  var newQuote = {
    id: newId,
    quoteNo: newQuoteNo,
    dealerId: dealerId,
    dealerName: dealerName,
    dealerLevel: dealerLevel || 'B',
    levelUsed: levelUsed,
    createdAt: new Date().toISOString(),
    validFrom: validFrom,
    validTo: validTo,
    paymentTerm: paymentTerm,
    quotedBy: (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.displayName : (getConfig().saleName || 'Siwawong'),
    poNo: poNo,
    items: [],
    grossTotal: 0,
    discountPercent: 0,
    discountAmount: 0,
    netAmount: 0,
    vatPercent: 7,
    vatAmount: 0,
    totalAmount: 0,
    remark: remark,
    contacts: [],
    status: 'draft',
    sentDate: null,
    approvedDate: null,
    updatedAt: new Date().toISOString()
  };
  
  // โหลดข้อมูลเดิม
  var existingQuotes = [];
  try {
    existingQuotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]');
  } catch(e) {}
  
  existingQuotes.push(newQuote);
  localStorage.setItem('v7_quotations_v2', JSON.stringify(existingQuotes));
  quotations = existingQuotes;
  
  closeModal();
  toast('✅ สร้างใบเสนอราคา: ' + newQuoteNo);
  
  // ไปที่หน้าแก้ไขทันที
  renderEditQuotationPage(newQuote);

  // ถ้ามารายการจาก "ประเมินราคาคร่าวๆ" ให้เติมเข้าใบเสนอราคาที่สร้างใหม่ทันที
  if (window._pendingEstimatorItems && window._pendingEstimatorItems.length) {
    quotationItems = window._pendingEstimatorItems;
    window._pendingEstimatorItems = null;
    renderQuotationItemsTable();
    recalculateQuotationTotal();
  }
}
function getQuoteById(id) {
  var qs = [];
  try { qs = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch(e) {}
  for (var i = 0; i < qs.length; i++) { if (qs[i].id === id) return qs[i]; }
  return null;
}

function showPipelineQuotesM(pipelineId) {
  var allQuotes = [];
  try { allQuotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch(e) {}
  var quotes = allQuotes.filter(function(q) { return q.pipelineId === pipelineId; });

  var html = '<div style="min-width:320px">';
  if (!quotes.length) {
    html += '<div style="padding:12px;opacity:.6;text-align:center">ยังไม่มีใบเสนอราคา</div>';
  } else {
    quotes.forEach(function(q) {
      var statusLabel = (typeof quoteStatusLabels !== 'undefined' ? quoteStatusLabels[q.status] : '') || q.status;
      html += '<div onclick="closeM();renderEditQuotationPage(getQuoteById(\'' + q.id + '\'))" style="cursor:pointer;padding:10px 12px;border-bottom:1px solid var(--border)">';
      html += '<div style="font-weight:600">' + sanitize(q.quoteNo) + ' <span style="font-size:.75rem;opacity:.6">' + statusLabel + '</span></div>';
      html += '<div style="font-size:.78rem;opacity:.65">' + (q.validFrom||'') + (q.totalAmount ? ' • ' + fmtMoneyShort(q.totalAmount) : '') + '</div>';
      html += '</div>';
    });
  }
  html += '<div class="fm-actions" style="margin-top:12px">';
  html += '<button class="btn bp" onclick="closeM();createQuoteFromPipeline(\'' + pipelineId + '\')">➕ สร้างใบเสนอราคา</button>';
  html += '<button class="btn" onclick="closeM()">ปิด</button>';
  html += '</div></div>';

  openM('📄 ใบเสนอราคา Project', html);
}

function createQuoteFromPipeline(pipelineId) {
  var p = ST.getOne('pipeline', pipelineId);
  if (!p) { toast('ไม่พบ Pipeline'); return; }
  var dealer = ST.getOne('dealers', p.dealerId);
  var dealerLevel = dealer ? (dealer.level || 'B') : 'B';

  var groupKeys = [
    { keys: ['M3M','MULTISPECTRAL'], group: 'm3m' },
    { keys: ['M4TD'],               group: 'm4td' },
    { keys: ['M4T'],                group: 'm4t' },
    { keys: ['M4E'],                group: 'm4e' },
    { keys: ['M400'],               group: 'm400' },
    { keys: ['DOCK'],               group: 'dock3' }
  ];

  var pipeItems = (p.items && p.items.length) ? p.items : (p.model ? [{ model: p.model, qty: p.modelQty || 1 }] : []);
  var items = [];
  pipeItems.forEach(function(it) {
    var mu = (it.model || '').toUpperCase();
    var group = null;
    for (var i = 0; i < groupKeys.length; i++) {
      var spec = groupKeys[i];
      if (spec.keys.some(function(k) { return mu.indexOf(k) !== -1; })) { group = spec.group; break; }
    }
    var prod = (group && typeof getProductForModelGroup === 'function') ? getProductForModelGroup(group) : null;
    var unitPrice = prod ? (typeof getModelPriceByLevel === 'function' ? getModelPriceByLevel(prod.name, dealerLevel) : (prod.price || 0)) : 0;
    var qty = it.qty || 1;
    items.push({ sku: prod ? (prod.sku||'') : '', name: prod ? prod.name : it.model, quantity: qty, unitPrice: unitPrice, amount: unitPrice * qty });
  });

  var newId = 'qt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  var newQuoteNo = getNextQuoteNumber();
  var newQuote = {
    id: newId, quoteNo: newQuoteNo,
    dealerId: p.dealerId || '', dealerName: dealer ? dealer.name : (p.dealerName||''),
    dealerLevel: dealerLevel, levelUsed: dealerLevel,
    pipelineId: pipelineId, projectName: p.projectName||'', endUserTH: p.endUserTH||'',
    createdAt: new Date().toISOString(), validFrom: _td(), validTo: addD(_td(), 30),
    paymentTerm: 'Net due 30 days',
    quotedBy: (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.displayName : (getConfig().saleName || ''),
    poNo: '', items: items,
    grossTotal: 0, discountPercent: 0, discountAmount: 0,
    netAmount: 0, vatPercent: 7, vatAmount: 0, totalAmount: 0,
    remark: '', contacts: [], status: 'draft',
    sentDate: null, approvedDate: null, updatedAt: new Date().toISOString()
  };

  var existingQuotes = [];
  try { existingQuotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch(e) {}
  existingQuotes.push(newQuote);
  localStorage.setItem('v7_quotations_v2', JSON.stringify(existingQuotes));
  quotations = existingQuotes;

  toast('✅ สร้างใบเสนอราคา: ' + newQuoteNo);
  renderEditQuotationPage(newQuote);
}

// ✅ ฟังก์ชันใหม่: Render Edit Page โดยตรง (ไม่ต้องพึ่ง editQuotation)
function renderEditQuotationPage(quote) {
  if (!quote) {
    toast('❌ ไม่พบข้อมูล');
    go('quotationV2');
    return;
  }
  
  currentQuoteId = quote.id;
  quotationItems = quote.items ? JSON.parse(JSON.stringify(quote.items)) : [];
  selectedLevelForPrice = quote.levelUsed || 'B';
  
  var dealers = ST.getAll('dealers');
  var dealerOptions = '<option value="">-- เลือก Dealer --</option>';
  for (var i = 0; i < dealers.length; i++) {
    dealerOptions += '<option value="' + dealers[i].id + '"' + (quote.dealerId === dealers[i].id ? ' selected' : '') + '>' + sanitize(dealers[i].name) + ' (' + (dealers[i].level || '-') + ')</option>';
  }
  
  var levelOptions = '';
  var levels = ['RRP', 'S', 'A', 'B', 'Other'];
  var levelLabels = {
    'RRP': '💰 RRP (ราคาขายปลีก)',
    'S': '👑 S (Type 1)',
    'A': '⭐ A (Type 2)',
    'B': '📦 B (Type 3)',
    'Other': '🔄 Other (Type 4)'
  };
  for (var i = 0; i < levels.length; i++) {
    levelOptions += '<option value="' + levels[i] + '"' + (quote.levelUsed === levels[i] ? ' selected' : '') + '>' + levelLabels[levels[i]] + '</option>';
  }
  
  var statusOptions = '';
  for (var i = 0; i < quoteStatusList.length; i++) {
    var s = quoteStatusList[i];
    statusOptions += '<option value="' + s + '"' + (quote.status === s ? ' selected' : '') + '>' + quoteStatusLabels[s] + '</option>';
  }
  
  var products = getAllModelsWithPriceForQuote();
  var modelDatalistId = 'quoteModelList_' + Date.now();
  
  var html = '<div style="max-width:1200px;margin:0 auto;padding:16px">';
  html += '<div class="bc"><a onclick="go(\'quotationV2\')">💰 Quotation</a><span class="sep">›</span><span class="cur">' + sanitize(quote.quoteNo) + '</span></div>';
  
  // Form Card
  html += '<div class="card" style="margin-bottom:16px">';
  html += '<h2>✏️ แก้ไขใบเสนอราคา <span class="ml"><button class="btn bsm bd" onclick="deleteQuotation(\'' + quote.id + '\')">🗑️ ลบ</button></span></h2>';
  
  html += '<div class="fr"><div class="fg"><label>🏪 Dealer *</label><select id="editQuoteDealer" class="fm-input" onchange="editQuoteDealerChanged()">' + dealerOptions + '</select></div>';
  html += '<div class="fg"><label>📄 เลขที่</label><input type="text" id="editQuoteNo" class="fm-input" value="' + sanitize(quote.quoteNo) + '"></div></div>';
  
  html += '<div class="fr"><div class="fg"><label>📅 วันที่เริ่ม</label><input type="text" id="editQuoteValidFrom" class="fm-input dp" value="' + quote.validFrom + '"></div>';
  html += '<div class="fg"><label>📅 หมดอายุ</label><input type="text" id="editQuoteValidTo" class="fm-input dp" value="' + quote.validTo + '"></div></div>';
  
  html += '<div class="fr"><div class="fg"><label>💰 ระดับราคา</label><select id="editQuoteLevel" class="fm-input" onchange="editQuoteLevelChanged()">' + levelOptions + '</select></div>';
  html += '<div class="fg"><label>💳 เงื่อนไขชำระเงิน</label><input type="text" id="editQuotePaymentTerm" class="fm-input" value="' + sanitize(quote.paymentTerm) + '"></div></div>';
  
  html += '<div class="fr"><div class="fg"><label>📄 PO No.</label><input type="text" id="editQuotePoNo" class="fm-input" value="' + sanitize(quote.poNo || '') + '"></div>';
  html += '<div class="fg"><label>👤 Quoted by</label><input type="text" id="editQuoteQuotedBy" class="fm-input" value="' + sanitize(quote.quotedBy) + '"></div></div>';
  
  html += '<div class="fr"><div class="fg"><label>📊 สถานะ</label><select id="editQuoteStatus" class="fm-input">' + statusOptions + '</select></div>';
  html += '<div class="fg"></div></div>';
  
  html += '<div class="fg"><label>📝 หมายเหตุ</label><textarea id="editQuoteRemark" rows="2" class="fm-input">' + sanitize(quote.remark || '') + '</textarea></div>';
  html += '</div>';
  
  // Products Section
  html += '<div class="card" style="margin-bottom:16px">';
  html += '<h2>📦 รายการสินค้า</h2>';

  // Solution preset chips — เอา pattern จาก Quick Price Estimator มาใช้ซ้ำ กดทีเดียวเพิ่มได้หลายรายการพร้อมราคาตาม Level ของใบนี้
  html += '<div id="quoteSolutionChipZone"></div>';

  // Add product row with autocomplete
  html += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">';
  html += '<div class="fg" style="flex:3"><label>🔍 เลือกสินค้า (พิมพ์ค้นหา)</label>';
  html += '<input type="text" id="newItemModel" list="' + modelDatalistId + '" class="fm-input" placeholder="พิมพ์ชื่อสินค้า..." autocomplete="off">';
  html += '<datalist id="' + modelDatalistId + '">';
  for (var i = 0; i < products.length; i++) {
    var price = getModelPriceByLevelForQuote(products[i].name, selectedLevelForPrice);
    html += '<option value="' + sanitize(products[i].name) + '">' + sanitize(products[i].name) + (price > 0 ? ' (฿' + formatNumber(price) + ')' : '') + '</option>';
  }
  html += '</datalist></div>';
  html += '<div class="fg" style="width:100px"><label>🔢 จำนวน</label><input type="number" id="newItemQty" class="fm-input" value="1" min="1"></div>';
  html += '<div><button class="btn bp" onclick="addQuotationItemFromInput()" style="margin-bottom:4px;background:#22c55e">➕ เพิ่มสินค้า</button>' +
    '<button class="btn bo" type="button" onclick="openProductPicker({showPrice:true, onAdd:pickerAddToQuote})" title="เลือกจากแคตตาล็อก (แนะนำ/ค้นหา)" style="margin-bottom:4px;margin-left:4px">📋 แคตตาล็อก</button></div>';
  html += '</div>';
  
  html += '<div id="quotationItemsContainer"></div>';
  html += '</div>';
  
  // Summary Card
  html += '<div class="card" style="margin-bottom:16px">';
  html += '<h2>💰 สรุป</h2>';
  html += '<div style="max-width:400px;margin-left:auto">';
  html += '<div class="fr" style="justify-content:space-between;padding:4px 0"><span>Gross Total:</span><span id="quoteGrossTotal" style="font-weight:700">0 ฿</span></div>';
  html += '<div id="quoteDiscountRow" class="fr" style="justify-content:space-between;padding:4px 0"><span>ส่วนลด (<input type="number" id="quoteDiscountPercent" style="width:60px;text-align:center" value="0" min="0" max="100" onchange="recalculateQuotationTotal()"> %):</span><span id="quoteDiscountAmount" style="font-weight:700">0 ฿</span></div>';
  html += '<div class="fr" style="justify-content:space-between;padding:4px 0;border-top:1px solid var(--border);margin-top:4px;padding-top:8px"><span>Net Amount:</span><span id="quoteNetAmount" style="font-weight:700">0 ฿</span></div>';
  html += '<div class="fr" style="justify-content:space-between;padding:4px 0"><span>VAT 7%:</span><span id="quoteVatAmount" style="font-weight:700">0 ฿</span></div>';
  html += '<div class="fr" style="justify-content:space-between;padding:6px 0;border-top:2px solid var(--accent);margin-top:4px;padding-top:8px"><span style="font-weight:800">TOTAL:</span><span id="quoteTotalAmount" style="font-weight:800;color:#22c55e;font-size:18px">0 ฿</span></div>';
  html += '</div></div>';
  
  // Contacts Card
  html += '<div class="card" style="margin-bottom:16px">';
  html += '<h2>👤 ผู้ติดต่อ <span class="ml"><button class="btn bsm bp" onclick="showAddQuoteContactModal()">➕</button></span></h2>';
  html += '<div id="quoteContactsContainer">';
  if (quote.contacts && quote.contacts.length) {
    for (var i = 0; i < quote.contacts.length; i++) {
      var c = quote.contacts[i];
      html += '<div class="contact-item" style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:6px">';
      html += '<div style="flex:1"><strong>' + sanitize(c.name) + '</strong>' + (c.role ? ' (' + sanitize(c.role) + ')' : '') + '<br><span style="font-size:11px">📧 ' + (c.email || '-') + ' • 📞 ' + (c.phone || '-') + '</span></div>';
      html += '<button class="btn bsm bd" onclick="removeQuoteContact(' + i + ')">🗑️</button></div>';
    }
  } else {
    html += '<div class="empty"><p>ยังไม่มีผู้ติดต่อ — กด ➔ เพื่อเพิ่ม</p></div>';
  }
  html += '</div></div>';
  
  // Action Buttons
  html += '<div class="bg" style="margin-top:16px;gap:8px;justify-content:center;flex-wrap:wrap">';
  html += '<button class="btn bp" onclick="saveCurrentQuotation()" style="background:#3b82f6">💾 บันทึก</button>';
  html += '<button class="btn bo" onclick="previewQuotation(\'' + quote.id + '\')">👁️ Preview</button>';
  html += '<button class="btn bs" onclick="exportQuotationToPDF(\'' + quote.id + '\')">📎 PDF</button>';
  html += '<button class="btn bo" onclick="sendQuotationEmail(\'' + quote.id + '\')">📧 ส่ง Email</button>';
  html += '<button class="btn bo" onclick="go(\'quotationV2\')">↩️ กลับ</button>';
  html += '</div></div>';
  
  document.getElementById('ct').innerHTML = html;

  renderQuotationItemsTable();
  renderQuoteSolutionChips();
  recalculateQuotationTotal();

  setTimeout(function() {
    var levelSelect = document.getElementById('editQuoteLevel');
    if (levelSelect) {
      levelSelect.onchange = function() {
        selectedLevelForPrice = this.value;
        for (var i = 0; i < quotationItems.length; i++) {
          var newPrice = getModelPriceByLevelForQuote(quotationItems[i].name, selectedLevelForPrice);
          quotationItems[i].unitPrice = newPrice;
          quotationItems[i].amount = (quotationItems[i].quantity || 1) * newPrice;
        }
        renderQuotationItemsTable();
        recalculateQuotationTotal();
        
        var newDatalistId = 'quoteModelList_' + Date.now();
        var newInput = document.getElementById('newItemModel');
        if (newInput) {
          var products2 = getAllModelsWithPriceForQuote();
          var newDatalist = '<datalist id="' + newDatalistId + '">';
          for (var j = 0; j < products2.length; j++) {
            var newPrice2 = getModelPriceByLevelForQuote(products2[j].name, selectedLevelForPrice);
            newDatalist += '<option value="' + sanitize(products2[j].name) + '">' + sanitize(products2[j].name) + (newPrice2 > 0 ? ' (฿' + formatNumber(newPrice2) + ')' : '') + '</option>';
          }
          newDatalist += '</datalist>';
          newInput.setAttribute('list', newDatalistId);
          var oldDatalist = document.querySelector('datalist[id^="quoteModelList_"]');
          if (oldDatalist) oldDatalist.remove();
          document.body.insertAdjacentHTML('beforeend', newDatalist);
        }
      };
    }
  }, 100);
}

// ✅ แก้ไข editQuotation ให้ใช้ renderEditQuotationPage
function editQuotation(quoteId) {
  loadQuotations();
  var quote = null;
  for (var i = 0; i < quotations.length; i++) {
    if (quotations[i].id === quoteId) { 
      quote = quotations[i]; 
      break; 
    }
  }
  if (!quote) { 
    toast('❌ ไม่พบข้อมูลใบเสนอราคา');
    go('quotationV2');
    return; 
  }
  renderEditQuotationPage(quote);
}
function editQuoteDealerChanged() {
  var dealerId = document.getElementById('editQuoteDealer').value;
  if (!dealerId) return;
  var dealer = ST.getOne('dealers', dealerId);
  if (dealer && dealer.creditTerm) {
    var termInput = document.getElementById('editQuotePaymentTerm');
    if (termInput && (!termInput.value || termInput.value === '')) termInput.value = dealer.creditTerm;
  }
}

function editQuoteLevelChanged() {
  var newLevel = document.getElementById('editQuoteLevel').value;
  selectedLevelForPrice = newLevel;
  for (var i = 0; i < quotationItems.length; i++) {
    var newPrice = getModelPriceByLevelForQuote(quotationItems[i].name, newLevel);
    quotationItems[i].unitPrice = newPrice;
    quotationItems[i].amount = (quotationItems[i].quantity || 1) * newPrice;
  }
  renderQuotationItemsTable();
  recalculateQuotationTotal();
}

function saveCurrentQuotation() {
  // อ่านค่าจากฟอร์ม
  var quoteNo = document.getElementById('editQuoteNo')?.value.trim();
  var dealerId = document.getElementById('editQuoteDealer')?.value;
  var dealerName = document.getElementById('editQuoteDealer')?.options[document.getElementById('editQuoteDealer').selectedIndex]?.text || '';
  var validFrom = dpG('editQuoteValidFrom') || _td();
  var validTo = dpG('editQuoteValidTo') || addD(_td(), 30);
  var levelUsed = document.getElementById('editQuoteLevel')?.value || 'B';
  var paymentTerm = document.getElementById('editQuotePaymentTerm')?.value || '';
  var poNo = document.getElementById('editQuotePoNo')?.value.trim() || '';
  var quotedBy = document.getElementById('editQuoteQuotedBy')?.value.trim() || (getConfig().saleName || 'Siwawong');
  var status = document.getElementById('editQuoteStatus')?.value || 'draft';
  var remark = document.getElementById('editQuoteRemark')?.value.trim() || '';
  
  if (!quoteNo) { toast('กรุณาใส่เลขที่'); return; }
  
  // ✅ คำนวณ totals จาก quotationItems ปัจจุบัน
  var grossTotal = 0;
  for (var i = 0; i < quotationItems.length; i++) {
    grossTotal += (Number(quotationItems[i].amount) || 0);
  }
  
  var discountPercentElem = document.getElementById('quoteDiscountPercent');
  var discountPercent = discountPercentElem ? (parseFloat(discountPercentElem.value) || 0) : 0;
  var discountAmount = grossTotal * discountPercent / 100;
  var netAmount = grossTotal - discountAmount;
  var vatAmount = netAmount * 7 / 100;
  var totalAmount = netAmount + vatAmount;
  
  // ✅ อัปเดต quote ใน array
  for (var i = 0; i < quotations.length; i++) {
    if (quotations[i].id === currentQuoteId) {
      quotations[i].quoteNo = quoteNo;
      quotations[i].dealerId = dealerId;
      quotations[i].dealerName = dealerName;
      quotations[i].levelUsed = levelUsed;
      quotations[i].validFrom = validFrom;
      quotations[i].validTo = validTo;
      quotations[i].paymentTerm = paymentTerm;
      quotations[i].quotedBy = quotedBy;
      quotations[i].poNo = poNo;
      quotations[i].items = JSON.parse(JSON.stringify(quotationItems));
      quotations[i].grossTotal = grossTotal;
      quotations[i].discountPercent = discountPercent;
      quotations[i].discountAmount = discountAmount;
      quotations[i].netAmount = netAmount;
      quotations[i].vatPercent = 7;
      quotations[i].vatAmount = vatAmount;
      quotations[i].totalAmount = totalAmount;
      quotations[i].remark = remark;
      quotations[i].status = status;
      quotations[i].updatedAt = new Date().toISOString();
      break;
    }
  }
  
  // ✅ บันทึก
  localStorage.setItem('v7_quotations_v2', JSON.stringify(quotations));
  
  toast('💾 บันทึกใบเสนอราคาแล้ว');
  go('quotationV2');
}
function deleteQuotation(quoteId) {
  if (!confirm('ลบใบเสนอราคานี้?')) return;
  
  // ✅ โหลดข้อมูลปัจจุบัน
  var currentQuotes = [];
  try {
    currentQuotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]');
  } catch(e) {}
  
  // ✅ กรองเอารายการที่ต้องการลบออก
  var newQuotes = currentQuotes.filter(function(q) { return q.id !== quoteId; });
  
  // ✅ บันทึก
  localStorage.setItem('v7_quotations_v2', JSON.stringify(newQuotes));
  
  // ✅ อัปเดต global array
  quotations = newQuotes;
  
  // ✅ ลบจาก Firebase
  if (typeof db !== 'undefined' && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    db.collection('users').doc(CURRENT_USER.uid).collection('quotations_v2').doc(quoteId).delete().catch(function(e) {
      console.warn('Firebase delete error:', e);
    });
  }
  
  toast('🗑️ ลบแล้ว');
  
  // ✅ กลับไปหน้า列表
  go('quotationV2');
}
// ================================================================
// QUOTATION CONTACTS
// ================================================================

function showAddQuoteContactModal() {
  var html = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal-container" style="max-width:450px">';
  html += '<div class="modal-header"><h3>➕ เพิ่มผู้ติดต่อ</h3><button class="modal-close" onclick="closeModal()">✕</button></div>';
  html += '<div class="modal-body">';
  html += '<div class="fg"><label>👤 ชื่อ *</label><input type="text" id="newContactName" class="fm-input" placeholder="เช่น คุณสมชาย"></div>';
  html += '<div class="fg"><label>💼 ตำแหน่ง</label><input type="text" id="newContactRole" class="fm-input" placeholder="เช่น Manager"></div>';
  html += '<div class="fr"><div class="fg"><label>📧 Email</label><input type="email" id="newContactEmail" class="fm-input" placeholder="email@company.com"></div>';
  html += '<div class="fg"><label>📞 เบอร์โทร</label><input type="tel" id="newContactPhone" class="fm-input" placeholder="088-xxx-xxxx"></div></div>';
  html += '</div><div class="modal-footer"><button class="btn" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="addQuoteContact()">💾 เพิ่ม</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function addQuoteContact() {
  var name = document.getElementById('newContactName').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }
  var role = document.getElementById('newContactRole').value.trim();
  var email = document.getElementById('newContactEmail').value.trim();
  var phone = document.getElementById('newContactPhone').value.trim();
  
  for (var i = 0; i < quotations.length; i++) {
    if (quotations[i].id === currentQuoteId) {
      if (!quotations[i].contacts) quotations[i].contacts = [];
      quotations[i].contacts.push({ name: name, role: role, email: email, phone: phone });
      break;
    }
  }
  
  closeModal();
  editQuotation(currentQuoteId);
}

function removeQuoteContact(idx) {
  for (var i = 0; i < quotations.length; i++) {
    if (quotations[i].id === currentQuoteId) {
      quotations[i].contacts.splice(idx, 1);
      break;
    }
  }
  editQuotation(currentQuoteId);
}

// ================================================================
// QUOTATION PREVIEW & PDF
// ================================================================

function previewQuotation(quoteId) {
  // ✅ โหลดข้อมูลล่าสุดจาก localStorage
  var latestQuotes = [];
  try {
    latestQuotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]');
  } catch(e) {}
  
  var quote = null;
  for (var i = 0; i < latestQuotes.length; i++) {
    if (latestQuotes[i].id === quoteId) {
      quote = latestQuotes[i];
      break;
    }
  }
  
  if (!quote) { 
    toast('ไม่พบข้อมูล'); 
    return; 
  }
  
  // ที่เหลือเหมือนเดิม...
  var dealer = ST.getOne('dealers', quote.dealerId) || { name: quote.dealerName, address: '', phone: '', email: '' };
  var companyName = 'SIS Distribution (Thailand) PLC';
  var companyAddress = '9 G-Tower, 9th Floor, Room 901, Ratchadaphisek Road, Din Daeng, Bangkok 10400';
  var companyTel = '088-9465149';
  var companyTax = '0105563027693';
  
  var itemsHtml = '';
  for (var i = 0; i < quote.items.length; i++) {
    var item = quote.items[i];
    itemsHtml += '<tr>';
    itemsHtml += '<td style="padding:8px;text-align:center">' + (i + 1) + '</td>';
    itemsHtml += '<td style="padding:8px">' + sanitize(item.sku || '-') + '</td>';
    itemsHtml += '<td style="padding:8px">' + sanitize(item.name) + '</td>';
    itemsHtml += '<td style="padding:8px;text-align:center">' + (item.quantity || 1) + '</td>';
    itemsHtml += '<td style="padding:8px;text-align:right">' + formatNumber(item.unitPrice) + '</td>';
    itemsHtml += '<td style="padding:8px;text-align:right;font-weight:700">' + formatNumber(item.amount) + '</td>';
    itemsHtml += '</tr>';
  }
  
  var showDiscount = quote.discountPercent && quote.discountPercent > 0;
  
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quotation ' + quote.quoteNo + '</title>';
  html += '<style>';
  html += '*{margin:0;padding:0;box-sizing:border-box}';
  html += 'body{font-family:"Segoe UI","Noto Sans Thai",sans-serif;background:#fff;color:#1e293b;padding:20px}';
  html += '.invoice-container{max-width:1000px;margin:0 auto;background:#fff}';
  html += '.invoice-header{display:flex;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #2563eb}';
  html += '.company-info h1{font-size:24px;color:#2563eb;margin-bottom:4px}.company-info p{font-size:12px;color:#64748b;margin:2px 0}';
  html += '.invoice-title{text-align:right}.invoice-title h2{font-size:20px;color:#1e293b}.invoice-title p{font-size:12px;color:#64748b}';
  html += '.customer-info{display:flex;justify-content:space-between;margin-bottom:30px;padding:16px;background:#f8fafc;border-radius:12px}';
  html += '.customer-info h3{font-size:14px;color:#64748b;margin-bottom:4px}.customer-info p{font-size:14px;margin:2px 0}';
  html += '.items-table{width:100%;border-collapse:collapse;margin:20px 0}.items-table th{background:#f1f5f9;padding:12px;text-align:left;font-size:12px;font-weight:700;color:#64748b;border-bottom:2px solid #e2e8f0}';
  html += '.items-table td{padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px}.items-table tr:hover td{background:#f8fafc}';
  html += '.summary{max-width:400px;margin-left:auto;margin-top:20px;padding-top:16px;border-top:2px solid #e2e8f0}';
  html += '.summary-row{display:flex;justify-content:space-between;padding:6px 0}.summary-total{font-weight:800;font-size:16px;color:#2563eb;border-top:2px solid #e2e8f0;margin-top:8px;padding-top:8px}';
  html += '.remark{margin-top:30px;padding:12px;background:#fef3c7;border-radius:8px;font-size:12px;color:#92400e}';
  html += '.footer{text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}';
  html += '@media print{body{padding:0}.customer-info{background:#f1f5f9}.remark{background:#fef3c7}}';
  html += '</style></head><body>';
  
  html += '<div class="invoice-container">';
  html += '<div class="invoice-header"><div class="company-info"><h1>🚁 ' + companyName + '</h1><p>' + companyAddress + '</p><p>Tel: ' + companyTel + ' | Tax ID: ' + companyTax + '</p></div>';
  html += '<div class="invoice-title"><h2>PROFORMA INVOICE</h2><p>No. ' + sanitize(quote.quoteNo) + '</p><p>Date: ' + quote.validFrom + '</p><p>Valid Until: ' + quote.validTo + '</p></div></div>';
  
  html += '<div class="customer-info"><div><h3>🏪 Customer</h3><p><strong>' + sanitize(dealer.name) + '</strong></p><p>' + (dealer.address || '-') + '</p><p>Tel: ' + (dealer.phone || '-') + '</p></div>';
  html += '<div><h3>📋 Reference</h3><p>PO No.: ' + (quote.poNo || '-') + '</p><p>Payment Term: ' + sanitize(quote.paymentTerm) + '</p><p>Quoted by: ' + sanitize(quote.quotedBy) + '</p></div></div>';
  
  html += '<table class="items-table"><thead><tr><th>#</th><th>SKU</th><th>Description</th><th>QTY</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>' + itemsHtml + '</tbody></table>';
  
  html += '<div class="summary"><div class="summary-row"><span>Gross Total:</span><span>' + formatNumber(quote.grossTotal) + ' ฿</span></div>';
  if (showDiscount) html += '<div class="summary-row"><span>Discount (' + quote.discountPercent + '%):</span><span>' + formatNumber(quote.discountAmount) + ' ฿</span></div>';
  html += '<div class="summary-row"><span>Net Amount:</span><span>' + formatNumber(quote.netAmount) + ' ฿</span></div>';
  html += '<div class="summary-row"><span>VAT 7%:</span><span>' + formatNumber(quote.vatAmount) + ' ฿</span></div>';
  html += '<div class="summary-total"><span>TOTAL PAYMENT:</span><span>' + formatNumber(quote.totalAmount) + ' ฿</span></div></div>';
  
  if (quote.remark) html += '<div class="remark">📝 ' + sanitize(quote.remark) + '</div>';
  
  html += '<div class="footer"><p>SIS Distribution (Thailand) PLC — DJI Authorized Distributor</p><p>This is a computer-generated document, no signature required.</p></div>';
  html += '</div></body></html>';
  
  var previewWindow = window.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
}

function exportQuotationToPDF(quoteId) {
  previewQuotation(quoteId);
  setTimeout(function() {
    var win = window.open();
    if (win) win.print();
  }, 500);
  toast('📎 เปิดหน้า Preview แล้วกด Print เพื่อเซฟเป็น PDF');
}

function sendQuotationEmail(quoteId) {
  var quote = null;
  for (var i = 0; i < quotations.length; i++) {
    if (quotations[i].id === quoteId) { quote = quotations[i]; break; }
  }
  if (!quote) { toast('ไม่พบข้อมูล'); return; }
  
  var dealer = ST.getOne('dealers', quote.dealerId);
  var emails = [];
  if (quote.contacts && quote.contacts.length) {
    for (var i = 0; i < quote.contacts.length; i++) {
      if (quote.contacts[i].email) emails.push(quote.contacts[i].email);
    }
  }
  if (dealer && dealer.email) emails.push(dealer.email);
  
  var to = emails.join(',');
  var subject = encodeURIComponent('Proforma Invoice ' + quote.quoteNo + ' — ' + (dealer ? dealer.name : ''));
  var body = encodeURIComponent('Dear Sir,\n\nAttached is the proforma invoice ' + quote.quoteNo + ' for your reference.\n\nTotal Amount: ' + formatNumber(quote.totalAmount) + ' ฿\nValid Until: ' + quote.validTo + '\n\nBest Regards,\n' + (quote.quotedBy || 'Siwawong') + '\nSIS Distribution (Thailand) PLC');
  
  window.open('mailto:' + to + '?subject=' + subject + '&body=' + body);
  toast('📧 เปิดอีเมลแล้ว กรุณาแนบ PDF (พิมพ์จากหน้า Preview)');
  
  if (quote.status === 'draft') {
    for (var i = 0; i < quotations.length; i++) {
      if (quotations[i].id === quoteId) {
        quotations[i].status = 'sent';
        quotations[i].sentDate = new Date().toISOString();
        break;
      }
    }
    saveQuotations();
  }
}

// ================================================================
// INITIALIZE
// ================================================================

loadQuotations();