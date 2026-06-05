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
function getAllModelsWithPriceForQuote() {
  var products = [];
  if (typeof Products !== 'undefined' && Products.getAll) {
    products = Products.getAll();
    if (products.length) return products.filter(function(p) { return p && p.name; });
  }
  try {
    var saved = localStorage.getItem('v7_products');
    if (saved) {
      var parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.models)) return parsed.models;
    }
  } catch(e) {}
  var cfg = getConfig();
  var cfgModels = cfg.models || [];
  return cfgModels.map(function(m) {
    return typeof m === 'object' ? m : { name: m, price: 0, rrpExVat: 0 };
  });
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
  var discountAmount = 0;
  if (discountPercentElem && discountPercentElem.value && parseFloat(discountPercentElem.value) > 0) {
    var discountPct = parseFloat(discountPercentElem.value) || 0;
    discountAmount = grossTotal * discountPct / 100;
    var discountRow = document.getElementById('quoteDiscountRow');
    if (discountRow) discountRow.style.display = 'flex';
  } else {
    var discountRow = document.getElementById('quoteDiscountRow');
    if (discountRow) discountRow.style.display = 'none';
    if (discountPercentElem) discountPercentElem.value = '0';
  }
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
  
  var html = '<div class="export-wrap" style="overflow-x:auto"><table class="export-table" style="width:100%">';
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
    html += '<td style="font-size:11px">' + sanitize(item.sku || '-') + '</td>';
    html += '<td><strong>' + sanitize(item.name) + '</strong></td>';
    html += '<td style="text-align:center"><input type="number" class="quote-item-qty" data-idx="' + i + '" value="' + (item.quantity || 1) + '" min="1" style="width:70px;text-align:center;padding:4px" onchange="updateQuotationItemQty(' + i + ', this.value)"></td>';
    html += '<td style="text-align:right"><input type="number" class="quote-item-price" data-idx="' + i + '" value="' + (item.unitPrice || 0) + '" min="0" step="0.01" style="width:110px;text-align:right;padding:4px" onchange="updateQuotationItemPrice(' + i + ', this.value)"></td>';
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
  price = parseFloat(price) || 0;
  quotationItems[idx].unitPrice = price;
  quotationItems[idx].amount = (quotationItems[idx].quantity || 1) * price;
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
  html += '<button class="btn bp" onclick="showCreateQuotationModal()" style="background:#22c55e">➕ สร้างใบเสนอราคา</button>';
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
      html += '<div><div style="font-weight:800;font-size:16px;color:var(--accent)">' + sanitize(q.quoteNo) + '</div>';
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
    html += '<div><div style="font-weight:800;font-size:16px;color:var(--accent)">' + sanitize(q.quoteNo) + '</div>';
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
  var dealerOptions = '<option value="">-- เลือก Dealer --</option>';
  for (var i = 0; i < dealers.length; i++) {
    dealerOptions += '<option value="' + dealers[i].id + '">' + sanitize(dealers[i].name) + ' (' + (dealers[i].level || '-') + ')</option>';
  }
  
  var levelOptions = '<option value="RRP">💰 RRP (ราคาขายปลีก)</option><option value="S">👑 S (Type 1)</option><option value="A">⭐ A (Type 2)</option><option value="B">📦 B (Type 3)</option><option value="Other">🔄 Other (Type 4)</option>';
  
  var html = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal-container" style="max-width:550px">';
  html += '<div class="modal-header"><h3>➕ สร้างใบเสนอราคาใหม่</h3><button class="modal-close" onclick="closeModal()">✕</button></div>';
  html += '<div class="modal-body">';
  html += '<div class="fg"><label>🏪 เลือก Dealer *</label><select id="newQuoteDealer" class="fm-input" onchange="newQuoteDealerChanged()">' + dealerOptions + '</select></div>';
  html += '<div class="fr"><div class="fg"><label>📅 วันที่เริ่ม</label><input type="text" id="newQuoteValidFrom" class="fm-input dp" value="' + _td() + '"></div>';
  html += '<div class="fg"><label>📅 วันที่หมดอายุ</label><input type="text" id="newQuoteValidTo" class="fm-input dp" value="' + addD(_td(), 30) + '"></div></div>';
  html += '<div class="fr"><div class="fg"><label>💰 ระดับราคาที่ใช้</label><select id="newQuoteLevel" class="fm-input">' + levelOptions + '</select></div>';
  html += '<div class="fg"><label>💳 เงื่อนไขชำระเงิน</label><input type="text" id="newQuotePaymentTerm" class="fm-input" placeholder="Net due 30 days"></div></div>';
  html += '<div class="fg"><label>📄 เลขที่อ้างอิง (PO No.)</label><input type="text" id="newQuotePoNo" class="fm-input" placeholder="1214845984"></div>';
  html += '<div class="fg"><label>📝 หมายเหตุ</label><textarea id="newQuoteRemark" rows="2" class="fm-input" placeholder="เงื่อนไขเพิ่มเติม..."></textarea></div>';
  html += '</div><div class="modal-footer"><button class="btn" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="createNewQuotation()">📝 สร้าง</button></div></div></div>';
  
  document.body.insertAdjacentHTML('beforeend', html);
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
  var dealerId = document.getElementById('newQuoteDealer').value;
  if (!dealerId) { toast('กรุณาเลือก Dealer'); return; }
  
  var dealer = ST.getOne('dealers', dealerId);
  var validFrom = dpG('newQuoteValidFrom') || _td();
  var validTo = dpG('newQuoteValidTo') || addD(_td(), 30);
  var levelUsed = document.getElementById('newQuoteLevel').value;
  var paymentTerm = document.getElementById('newQuotePaymentTerm').value || (dealer ? dealer.creditTerm : 'Net due 30 days');
  var poNo = document.getElementById('newQuotePoNo').value.trim();
  var remark = document.getElementById('newQuoteRemark').value.trim();
  
  // Get contacts from dealer
  var contacts = [];
  if (dealer && dealer.contacts && dealer.contacts.length) {
    contacts = dealer.contacts.map(function(c) {
      return { name: c.name, email: c.email, phone: c.phone, role: c.role };
    });
  }
  
  var newId = 'qt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  var newQuoteNo = getNextQuoteNumber();
  
  var newQuote = {
    id: newId,
    quoteNo: newQuoteNo,
    dealerId: dealerId,
    dealerName: dealer ? dealer.name : '',
    dealerLevel: dealer ? dealer.level : '',
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
    contacts: contacts,
    status: 'draft',
    sentDate: null,
    approvedDate: null,
    updatedAt: new Date().toISOString()
  };
  
  // ✅ โหลดข้อมูลเดิมก่อน
  var existingQuotes = [];
  try {
    existingQuotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]');
  } catch(e) {}
  
  // ✅ เพิ่มของใหม่
  existingQuotes.push(newQuote);
  
  // ✅ บันทึก
  localStorage.setItem('v7_quotations_v2', JSON.stringify(existingQuotes));
  
  // ✅ อัปเดต global array
  quotations = existingQuotes;
  
  // ✅ Sync Firebase (ถ้ามี)
  if (typeof db !== 'undefined' && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    db.collection('users').doc(CURRENT_USER.uid).collection('quotations_v2').doc(newId).set(newQuote).catch(function(e) {
      console.warn('Firebase sync error:', e);
    });
  }
  
  closeModal();
  toast('✅ สร้างใบเสนอราคา: ' + newQuoteNo);
  
  // ✅ กลับไปหน้า列表และรีเฟรช
  go('quotationV2');
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
  html += '<div><button class="btn bp" onclick="addQuotationItemFromInput()" style="margin-bottom:4px;background:#22c55e">➕ เพิ่มสินค้า</button></div>';
  html += '</div>';
  
  html += '<div id="quotationItemsContainer"></div>';
  html += '</div>';
  
  // Summary Card
  html += '<div class="card" style="margin-bottom:16px">';
  html += '<h2>💰 สรุป</h2>';
  html += '<div style="max-width:400px;margin-left:auto">';
  html += '<div class="fr" style="justify-content:space-between;padding:4px 0"><span>Gross Total:</span><span id="quoteGrossTotal" style="font-weight:700">0 ฿</span></div>';
  html += '<div id="quoteDiscountRow" class="fr" style="justify-content:space-between;padding:4px 0;display:none"><span>ส่วนลด (<input type="number" id="quoteDiscountPercent" style="width:60px;text-align:center" value="0" min="0" max="100" onchange="recalculateQuotationTotal()"> %):</span><span id="quoteDiscountAmount" style="font-weight:700">0 ฿</span></div>';
  html += '<div class="fr" style="justify-content:space-between;padding:4px 0;border-top:1px solid var(--border);margin-top:4px;padding-top:8px"><span>Net Amount:</span><span id="quoteNetAmount" style="font-weight:700">0 ฿</span></div>';
  html += '<div class="fr" style="justify-content:space-between;padding:4px 0"><span>VAT 7%:</span><span id="quoteVatAmount" style="font-weight:700">0 ฿</span></div>';
  html += '<div class="fr" style="justify-content:space-between;padding:6px 0;border-top:2px solid var(--accent);margin-top:4px;padding-top:8px"><span style="font-weight:800">TOTAL:</span><span id="quoteTotalAmount" style="font-weight:800;color:#22c55e;font-size:18px">0 ฿</span></div>';
  html += '<div class="fr" style="justify-content:flex-end;padding:4px 0"><button class="btn bsm bo" onclick="toggleDiscountField()">➕ เพิ่มส่วนลด</button></div>';
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
function toggleDiscountField() {
  var row = document.getElementById('quoteDiscountRow');
  if (row) row.style.display = 'flex';
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
  var quoteNo = document.getElementById('editQuoteNo')?.value.trim();
  var dealerId = document.getElementById('editQuoteDealer')?.value;
  var validFrom = dpG('editQuoteValidFrom') || _td();
  var validTo = dpG('editQuoteValidTo') || addD(_td(), 30);
  var levelUsed = document.getElementById('editQuoteLevel')?.value || 'B';
  var paymentTerm = document.getElementById('editQuotePaymentTerm')?.value || '';
  var poNo = document.getElementById('editQuotePoNo')?.value.trim() || '';
  var quotedBy = document.getElementById('editQuoteQuotedBy')?.value.trim() || (getConfig().saleName || 'Siwawong');
  var status = document.getElementById('editQuoteStatus')?.value || 'draft';
  var remark = document.getElementById('editQuoteRemark')?.value.trim() || '';
  
  if (!dealerId) { toast('กรุณาเลือก Dealer'); return; }
  if (!quoteNo) { toast('กรุณาใส่เลขที่'); return; }
  
  var dealer = ST.getOne('dealers', dealerId);
  var discountPercentElem = document.getElementById('quoteDiscountPercent');
  var discountPercent = discountPercentElem ? (parseFloat(discountPercentElem.value) || 0) : 0;
  var totals = recalculateQuotationTotal();
  
  for (var i = 0; i < quotations.length; i++) {
    if (quotations[i].id === currentQuoteId) {
      quotations[i].quoteNo = quoteNo;
      quotations[i].dealerId = dealerId;
      quotations[i].dealerName = dealer ? dealer.name : '';
      quotations[i].dealerLevel = dealer ? dealer.level : '';
      quotations[i].levelUsed = levelUsed;
      quotations[i].validFrom = validFrom;
      quotations[i].validTo = validTo;
      quotations[i].paymentTerm = paymentTerm;
      quotations[i].quotedBy = quotedBy;
      quotations[i].poNo = poNo;
      quotations[i].items = JSON.parse(JSON.stringify(quotationItems));
      quotations[i].grossTotal = totals.grossTotal;
      quotations[i].discountPercent = discountPercent;
      quotations[i].discountAmount = totals.discountAmount;
      quotations[i].netAmount = totals.netAmount;
      quotations[i].vatPercent = 7;
      quotations[i].vatAmount = totals.vatAmount;
      quotations[i].totalAmount = totals.totalAmount;
      quotations[i].remark = remark;
      quotations[i].status = status;
      quotations[i].updatedAt = new Date().toISOString();
      break;
    }
  }
  
  saveQuotations();
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
  var quote = null;
  for (var i = 0; i < quotations.length; i++) {
    if (quotations[i].id === quoteId) { quote = quotations[i]; break; }
  }
  if (!quote) { toast('ไม่พบข้อมูล'); return; }
  
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