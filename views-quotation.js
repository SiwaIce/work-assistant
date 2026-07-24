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
var showQuotationCost = false;
var quoteViewMode = localStorage.getItem('quoteViewMode') || 'card';
var quoteSort = 'date_desc';
var quoteSelectMode = false;
var quoteSelected = {};
var _quoteVisibleIds = [];
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

// ⚠️ เคยชื่อ saveQuotations() ซ้ำกับ saveQuotations(list) ใน features.js (ระบบ Quotation Tracker เก่า
// คนละชุดข้อมูล คนละ key — v7_quotes vs v7_quotations_v2) โหลดทีหลังเลยบัง ทำให้ปุ่ม "ทำเครื่องหมายว่าส่งแล้ว"
// เขียนลง key ผิดและไม่ sync Firebase เลย เปลี่ยนชื่อกันชนกัน (พบ 2026-07-19 ตอนไล่ตรวจฟังก์ชันชื่อซ้ำ)
function _saveQuotationsV2() {
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
      // ถ้าราคาตาม level เป็น 0/ว่าง (สินค้า accessory มักไม่มีราคา level) → fallback RRP Ex VAT ไม่คืน 0
      return (p.typePrices && p.typePrices[target] > 0) ? p.typePrices[target] : (p.rrpExVat || p.price || 0);
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
          return (products[i].typePrices && products[i].typePrices[target2] > 0) ? products[i].typePrices[target2] : (products[i].rrpExVat || products[i].price || 0);
        }
      }
    }
  } catch(e) {}

  // ไม่พบใน catalog จริง — ไม่ fallback ไป config.models (list default) อีกต่อไป
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

  // ยังไม่มีสินค้าใน catalog เลย — ไม่ fallback ไป config.models หรือ hardcoded list อีกต่อไป กรอกเองได้อิสระ
  return [];
}
function formatNumber(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('th-TH');
}

function recalculateQuotationTotal() {
  var grossTotal = 0;
  var totalCost = 0;
  for (var i = 0; i < quotationItems.length; i++) {
    grossTotal += (Number(quotationItems[i].amount) || 0);
    totalCost += (Number(quotationItems[i].cost) || 0) * (Number(quotationItems[i].quantity) || 1);
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

  var costSummaryEl = document.getElementById('quoteCostSummary');
  if (costSummaryEl) {
    costSummaryEl.style.display = showQuotationCost ? '' : 'none';
    if (showQuotationCost) {
      var grossProfit = netAmount - totalCost;
      var marginPct = netAmount > 0 ? (grossProfit / netAmount * 100) : 0;
      var costEl = document.getElementById('quoteTotalCost');
      var profitEl = document.getElementById('quoteGrossProfit');
      var mPctEl = document.getElementById('quoteMarginPct');
      if (costEl) costEl.textContent = formatNumber(Math.round(totalCost)) + ' ฿';
      if (profitEl) { profitEl.textContent = formatNumber(Math.round(grossProfit)) + ' ฿'; profitEl.style.color = grossProfit >= 0 ? '#22c55e' : '#ef4444'; }
      if (mPctEl) { mPctEl.textContent = marginPct.toFixed(2) + '%'; mPctEl.style.color = marginPct >= 10 ? '#22c55e' : (marginPct >= 5 ? '#f59e0b' : '#ef4444'); }
    }
  }

  return { grossTotal: grossTotal, discountAmount: discountAmount, netAmount: netAmount, vatAmount: vatAmount, totalAmount: totalAmount, totalCost: totalCost };
}

// ================================================================
// RENDER QUOTATION ITEMS TABLE
// ================================================================

// ป้าย/ปุ่ม Level ต่อรายการ (RRP/S/A/B/Other) — ปุ่มที่ตรงกับ item.priceLevel จะ highlight, สีแดงถ้าไม่ตรงกับ
// Level ของใบเสนอราคาทั้งใบ (selectedLevelForPrice) เตือนว่าราคานี้ยังไม่ได้ปรับตาม Level ปัจจุบัน
function _qiLevelChips(item, idx) {
  var levels = ['RRP', 'S', 'A', 'B', 'Other'];
  var itemLevel = item.priceLevel || null;
  var html = '';
  levels.forEach(function(lv) {
    var isActive = itemLevel === lv;
    var isMismatch = isActive && lv !== selectedLevelForPrice;
    var style;
    if (isMismatch) style = 'border:1px solid #ef4444;background:#7f1d1d;color:#fca5a5';
    else if (isActive) style = 'border:1px solid #3b82f6;background:#1e3a5f;color:#93c5fd';
    else style = 'border:1px solid var(--border);background:transparent;color:var(--text2)';
    html += '<button type="button" title="ตั้งราคาตาม Level ' + lv + '" style="padding:1px 5px;font-size:9px;border-radius:4px;cursor:pointer;line-height:1.6;' + style + '" onclick="_qiSetItemLevel(' + idx + ',\'' + lv + '\')">' + lv + '</button>';
  });
  return html;
}

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
  html += '<th style="width:120px;text-align:right">ราคา/หน่วย</th>';
  html += '<th style="width:120px;text-align:right">รวม</th>';
  if (showQuotationCost) {
    html += '<th style="width:110px;text-align:right">ต้นทุน/หน่วย</th>';
    html += '<th style="width:110px;text-align:right">ต้นทุนรวม</th>';
    html += '<th style="width:70px;text-align:right">Margin</th>';
  }
  html += '<th style="width:50px"></th>';
  html += '</tr></thead><tbody>';

  for (var i = 0; i < quotationItems.length; i++) {
    var item = quotationItems[i];
    var itemCost = Number(item.cost) || 0;
    var itemQty = Number(item.quantity) || 1;
    var itemTotalCost = itemCost * itemQty;
    var itemMargin = item.unitPrice > 0 ? ((item.unitPrice - itemCost) / item.unitPrice * 100) : 0;
    html += '<tr>';
    html += '<td class="pipe-row-num" style="text-align:center">' + (i + 1) + '</td>';
    html += '<td style="font-size:11px" id="qiskucel_' + i + '">' + (item.sku ? qcopyHtml(item.sku) : '-') + '</td>';
    html += '<td><input type="text" list="' + dlId + '" value="' + sanitize(item.name) + '" style="width:100%;font-weight:700;padding:4px" autocomplete="off" onchange="updateQuotationItemName(' + i + ', this.value)"></td>';
    html += '<td style="text-align:center"><input type="number" class="quote-item-qty" data-idx="' + i + '" value="' + itemQty + '" min="1" style="width:70px;text-align:center;padding:4px" onchange="updateQuotationItemQty(' + i + ', this.value)"></td>';
    html += '<td style="text-align:right"><input type="text" inputmode="decimal" class="quote-item-price js-money" data-idx="' + i + '" value="' + nmI(item.unitPrice || 0) + '" style="width:110px;text-align:right;padding:4px" onchange="updateQuotationItemPrice(' + i + ', this.value)">' +
      '<div style="display:flex;gap:2px;justify-content:flex-end;margin-top:3px">' + _qiLevelChips(item, i) + '</div></td>';
    html += '<td style="text-align:right;font-weight:700;color:#22c55e">' + formatNumber(item.amount) + ' ฿</td>';
    if (showQuotationCost) {
      html += '<td style="text-align:right"><input type="text" inputmode="decimal" class="js-money" value="' + nmI(itemCost) + '" style="width:100px;text-align:right;padding:4px;background:var(--bg2)" onchange="updateQuotationItemCost(' + i + ', this.value)"></td>';
      html += '<td style="text-align:right;color:#f59e0b">' + formatNumber(Math.round(itemTotalCost)) + ' ฿</td>';
      html += '<td style="text-align:right;font-weight:700;color:' + (itemMargin >= 10 ? '#22c55e' : (itemMargin >= 5 ? '#f59e0b' : '#ef4444')) + '">' + (item.unitPrice > 0 ? itemMargin.toFixed(1) + '%' : '-') + '</td>';
    }
    html += '<td style="text-align:center"><button class="btn bsm bd" onclick="removeQuotationItem(' + i + ')">🗑️</button></td>';
    html += '</tr>';
  }

  // แถวสรุปท้ายตาราง — รวม / ต้นทุนรวม / Margin รวม (screenshot เก็บได้)
  var sumAmount = 0, sumCost = 0;
  quotationItems.forEach(function(it) {
    sumAmount += Number(it.amount) || 0;
    sumCost += (Number(it.cost) || 0) * (Number(it.quantity) || 1);
  });
  var totalMargin = sumAmount > 0 ? ((sumAmount - sumCost) / sumAmount * 100) : 0;
  html += '</tbody><tfoot><tr style="border-top:2px solid var(--border);font-weight:700;background:var(--bg2)">';
  html += '<td colspan="5" style="text-align:right;padding:8px">รวมทั้งหมด</td>';
  html += '<td style="text-align:right;color:#22c55e;padding:8px">' + formatNumber(Math.round(sumAmount)) + ' ฿</td>';
  if (showQuotationCost) {
    html += '<td style="text-align:right;color:var(--text2);padding:8px">ต้นทุนรวม</td>';
    html += '<td style="text-align:right;color:#f59e0b;padding:8px">' + formatNumber(Math.round(sumCost)) + ' ฿</td>';
    html += '<td style="text-align:right;padding:8px;color:' + (totalMargin >= 10 ? '#22c55e' : (totalMargin >= 5 ? '#f59e0b' : '#ef4444')) + '">' + totalMargin.toFixed(1) + '%</td>';
  }
  html += '<td></td></tr></tfoot></table></div>';
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
  quotationItems[idx].priceLevel = null; // แก้ราคาเองมือ ไม่ผูกกับ Level ไหนแล้ว (ป้าย Level จะไม่ highlight)
  renderQuotationItemsTable();
  recalculateQuotationTotal();
}

// ป้าย Level ต่อรายการในตาราง — คลิกเพื่อ re-price แถวนี้แถวเดียวตาม Level ที่เลือก
function _qiSetItemLevel(idx, level) {
  var item = quotationItems[idx];
  if (!item) return;
  var newPrice = getModelPriceByLevelForQuote(item.name, level);
  if (newPrice > 0) {
    item.unitPrice = newPrice;
    item.amount = (Number(item.quantity) || 1) * newPrice;
  }
  item.priceLevel = level;
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
    if (found.cost !== undefined) quotationItems[idx].cost = found.cost;
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

function updateQuotationItemCost(idx, val) {
  quotationItems[idx].cost = parseNum(val);
  renderQuotationItemsTable();
  recalculateQuotationTotal();
}

function toggleQuotationCostView() {
  showQuotationCost = !showQuotationCost;
  var btn = document.getElementById('btnToggleCost');
  if (btn) { btn.classList.toggle('bp', showQuotationCost); btn.classList.toggle('bo', !showQuotationCost); }
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
      amount: qty * unitPrice,
      cost: selectedProduct.cost || 0,
      priceLevel: selectedLevelForPrice
    });
  }
  
  if (modelInput) modelInput.value = '';
  document.getElementById('newItemQty').value = '1';
  
  renderQuotationItemsTable();
  recalculateQuotationTotal();
  toast('➕ เพิ่ม ' + modelName);
}

// กล่องแนะนำสินค้าแบบ custom (ค้นได้ทั้งชื่อและ SKU, พิมพ์แล้วกด Enter เพิ่มได้เลยไม่ต้องกด ➕) — ทำแพทเทิร์น
// เดียวกับ _pqaFilterSuggest ใน modals.js (ใช้ CSS class .pqa-suggest ร่วมกัน)
function _qiaFilterSuggest() {
  var input = document.getElementById('newItemModel');
  var box = document.getElementById('newItemSuggestBox');
  if (!input || !box) return;
  var q = (input.value || '').trim().toLowerCase();
  if (!q) { box.style.display = 'none'; box.innerHTML = ''; window._qiaSuggestMatches = []; return; }
  var products = getAllModelsWithPriceForQuote();
  var matches = products.filter(function(p) {
    if (!p || !p.name) return false;
    var n = p.name.toLowerCase();
    var s = (p.sku || '').toLowerCase();
    return n.indexOf(q) !== -1 || s.indexOf(q) !== -1;
  }).slice(0, 8);
  window._qiaSuggestMatches = matches;
  window._qiaSuggestActiveIdx = -1;
  if (!matches.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  var html = '';
  matches.forEach(function(p, i) {
    var price = getModelPriceByLevelForQuote(p.name, selectedLevelForPrice);
    html += '<div class="pqa-suggest-item" onmousedown="_qiaSuggestPick(' + i + ')">' +
      '<div class="pqa-suggest-name">' + sanitize(p.name) + '</div>' +
      ((p.sku || price > 0) ? '<div class="pqa-suggest-meta">' +
        (p.sku ? '<span class="pqa-suggest-sku">' + sanitize(p.sku) + '</span>' : '') +
        (price > 0 ? '<span class="pqa-suggest-price">฿' + fmtMoney(price) + '</span>' : '') +
        '</div>' : '') +
      '</div>';
  });
  box.innerHTML = html;
  box.style.display = '';
}
function _qiaSuggestPick(i, autoAdd) {
  var p = (window._qiaSuggestMatches || [])[i];
  if (!p) return;
  var input = document.getElementById('newItemModel');
  if (input) input.value = p.name;
  var box = document.getElementById('newItemSuggestBox');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  if (autoAdd) { addQuotationItemFromInput(); return; }
  var qtyEl = document.getElementById('newItemQty');
  if (qtyEl) qtyEl.focus();
}
function _qiaSuggestHighlight() {
  var box = document.getElementById('newItemSuggestBox');
  if (!box) return;
  var items = box.querySelectorAll('.pqa-suggest-item');
  for (var i = 0; i < items.length; i++) items[i].classList.toggle('active', i === window._qiaSuggestActiveIdx);
  var activeEl = items[window._qiaSuggestActiveIdx];
  if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ block: 'nearest' });
}
function _qiaSuggestKeydown(event) {
  var box = document.getElementById('newItemSuggestBox');
  var matches = window._qiaSuggestMatches || [];
  var open = box && box.style.display !== 'none' && matches.length;
  if (event.key === 'ArrowDown' && open) {
    event.preventDefault();
    window._qiaSuggestActiveIdx = Math.min((window._qiaSuggestActiveIdx == null ? -1 : window._qiaSuggestActiveIdx) + 1, matches.length - 1);
    _qiaSuggestHighlight();
    return;
  }
  if (event.key === 'ArrowUp' && open) {
    event.preventDefault();
    window._qiaSuggestActiveIdx = Math.max((window._qiaSuggestActiveIdx == null ? 0 : window._qiaSuggestActiveIdx) - 1, 0);
    _qiaSuggestHighlight();
    return;
  }
  if (event.key === 'Escape' && open) { box.style.display = 'none'; return; }
  if (event.key === 'Enter') {
    event.preventDefault();
    // เจอ suggestion แล้วกด Enter เพิ่มได้เลย ไม่ต้องกดลูกศรเลือกก่อน (ยังไม่ highlight ตัวไหน = เอาตัวบนสุด)
    if (open) { _qiaSuggestPick(window._qiaSuggestActiveIdx >= 0 ? window._qiaSuggestActiveIdx : 0, true); }
    else { addQuotationItemFromInput(); }
  }
}
function _qiaBindOutsideClose() {
  if (window._qiaOutsideBound) return;
  window._qiaOutsideBound = true;
  document.addEventListener('click', function(e) {
    var box = document.getElementById('newItemSuggestBox');
    var input = document.getElementById('newItemModel');
    if (!box || box.style.display === 'none') return;
    if (box.contains(e.target) || e.target === input) return;
    box.style.display = 'none';
  });
}

// ================================================================
// QUICK PRICE ESTIMATOR — ดูยอดรวมคร่าวๆ ไม่ผูก Dealer ไม่ใช่ใบเสนอราคาจริง
// บันทึกชุดสินค้าที่ใช้บ่อยเป็น "Solution" เรียกซ้ำได้ (เก็บแค่ model+qty ราคาคำนวณสดเสมอ)
// ================================================================
var estimatorItems = [];
var _editingSolutionId = null; // ถ้าตั้งไว้ = กำลังแก้ไข Solution นี้ (บันทึกทับ)

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
  html += '<button class="btn bo" style="flex:1" onclick="showSolutionManagerM()">📂 จัดการ Solution</button>';
  html += '<button class="btn bo" style="flex:1" onclick="estimatorItems=[];_editingSolutionId=null;renderEstimatorItemsTable();">🗑️ ล้างทั้งหมด</button>';
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
  var h = '<div style="font-size:11px;color:var(--text2);margin-bottom:6px">📂 Solution ที่บันทึกไว้ (กดเพื่อเพิ่มเข้าใบเสนอราคา) · <a href="#" onclick="showSolutionManagerM();return false" style="color:var(--accent)">⚙️ จัดการ</a></div>';
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
  var editing = _editingSolutionId ? getSolutionPresets().filter(function(p){ return p.id === _editingSolutionId; })[0] : null;
  var h = '<div style="max-width:360px">' +
    (editing ? '<div class="hint" style="background:#f59e0b18;border:1px solid #f59e0b40;border-radius:6px;padding:6px 10px;margin-bottom:8px">📝 กำลังแก้ไข Solution เดิม — บันทึกแล้วจะทับของเดิม</div>' : '') +
    '<div class="fg"><label>📝 ชื่อ Solution</label><input type="text" id="estSolName" class="fm-input" value="' + sanitize(editing ? editing.name : '') + '" placeholder="เช่น ชุดทำแผนที่"></div>' +
    '<div class="hint">เก็บแค่รายการสินค้า+จำนวน ไม่เก็บราคา (ราคาจะคำนวณสดทุกครั้งที่โหลด)</div>' +
    '<div class="fm-actions"><button class="btn btn-blue" onclick="saveSolutionPreset()">💾 บันทึก' + (editing ? 'ทับ' : '') + '</button><button class="btn" onclick="closeM()">ยกเลิก</button></div>' +
    '</div>';
  openM(editing ? '📝 แก้ไข Solution' : '💾 บันทึกเป็น Solution', h);
}

function saveSolutionPreset() {
  var name = (document.getElementById('estSolName').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ Solution'); return; }
  var presets = getSolutionPresets();
  var items = estimatorItems.map(function(it) { return { name: it.name, sku: it.sku || '', quantity: it.quantity }; });
  if (_editingSolutionId) {
    var p = presets.filter(function(x){ return x.id === _editingSolutionId; })[0];
    if (p) { p.name = name; p.items = items; p.updatedAt = new Date().toISOString(); }
    _editingSolutionId = null;
  } else {
    presets.push({ id: 'sol_' + Date.now(), name: name, items: items, createdAt: new Date().toISOString() });
  }
  saveSolutionPresets(presets);
  closeMForce();
  toast('💾 บันทึก Solution "' + name + '" แล้ว');
  renderEstimatorPresetChips();
}

function deleteSolutionPreset(presetId, fromManager) {
  if (!confirm('🗑️ ลบ Solution นี้?')) return;
  var presets = getSolutionPresets().filter(function(p) { return p.id !== presetId; });
  saveSolutionPresets(presets);
  if (_editingSolutionId === presetId) _editingSolutionId = null;
  if (typeof renderEstimatorPresetChips === 'function') renderEstimatorPresetChips();
  if (fromManager) showSolutionManagerM();
}

// ตารางจัดการ Solution — ดูรายละเอียด + เปลี่ยนชื่อ + แก้รายการ + ลบ
function showSolutionManagerM() {
  var presets = getSolutionPresets();
  var h = '<div style="max-width:640px">';
  if (!presets.length) {
    h += '<div class="hint" style="padding:20px;text-align:center">ยังไม่มี Solution — เพิ่มสินค้าในตารางด้านล่างแล้วกด "💾 บันทึกเป็น Solution"</div>';
  } else {
    h += '<div class="export-wrap" style="overflow-x:auto"><table class="export-table" style="width:100%;font-size:12px"><thead><tr>' +
      '<th>#</th><th>ชื่อ Solution</th><th>รายการสินค้า</th><th style="text-align:center;white-space:nowrap">จัดการ</th></tr></thead><tbody>';
    presets.forEach(function(p, i) {
      var itemsTxt = (p.items || []).map(function(it) { return sanitize(it.name) + ' <span style="color:var(--text2)">×' + (it.quantity || 1) + '</span>'; }).join('<br>');
      h += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td style="font-weight:600">' + sanitize(p.name) + '<div style="font-size:10px;color:var(--text2)">' + (p.items || []).length + ' รายการ</div></td>' +
        '<td style="font-size:11px">' + (itemsTxt || '<span style="color:var(--text2)">-</span>') + '</td>' +
        '<td style="text-align:center;white-space:nowrap">' +
          '<button class="btn bsm bo" onclick="renameSolutionPreset(\'' + p.id + '\')" title="เปลี่ยนชื่อ">✏️</button> ' +
          '<button class="btn bsm bo" onclick="editSolutionPreset(\'' + p.id + '\')" title="แก้ไขรายการสินค้า">📝</button> ' +
          '<button class="btn bsm bo" onclick="loadSolutionPreset(\'' + p.id + '\');closeM()" title="โหลดไป Estimator">📂</button> ' +
          '<button class="btn bsm bd" onclick="deleteSolutionPreset(\'' + p.id + '\',true)" title="ลบ">🗑️</button>' +
        '</td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '<div class="fm-actions" style="margin-top:12px"><button class="btn" onclick="closeM()">ปิด</button></div></div>';
  openM('📂 จัดการ Solution', h);
}

function renameSolutionPreset(id) {
  var presets = getSolutionPresets();
  var p = presets.filter(function(x){ return x.id === id; })[0];
  if (!p) return;
  var name = prompt('เปลี่ยนชื่อ Solution:', p.name);
  if (name === null) return;
  name = name.trim();
  if (!name) { toast('ชื่อว่างไม่ได้'); return; }
  p.name = name;
  p.updatedAt = new Date().toISOString();
  saveSolutionPresets(presets);
  showSolutionManagerM();
  if (typeof renderEstimatorPresetChips === 'function') renderEstimatorPresetChips();
  toast('✏️ เปลี่ยนชื่อแล้ว');
}

// แก้ไขรายการสินค้า: โหลดเข้า Estimator + ตั้งโหมดแก้ไข (บันทึกครั้งถัดไปจะทับ)
function editSolutionPreset(id) {
  loadSolutionPreset(id);
  _editingSolutionId = id;
  closeM();
  toast('📝 แก้รายการในตารางได้เลย แล้วกด "💾 บันทึกเป็น Solution" เพื่อบันทึกทับ');
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
  
  // Filter + sort + view toggle
  html += '<div class="card" style="padding:12px;margin-bottom:12px">';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">';
  html += '<div class="fg" style="flex:2"><label>🔍 ค้นหา</label><input type="text" id="quoteSearchInput" class="fm-input" placeholder="เลขที่ / โครงการ / PO / SO / Dealer" oninput="filterQuoteList()"></div>';
  html += '<div class="fg" style="flex:1"><label>🏪 Dealer</label><select id="quoteDealerFilter" class="fm-input" onchange="filterQuoteList()"><option value="all">ทั้งหมด</option>' + dealers.map(function(d) { return '<option value="' + d.id + '">' + sanitize(d.name) + '</option>'; }).join('') + '</select></div>';
  html += '<div class="fg" style="flex:1"><label>📊 สถานะ</label><select id="quoteStatusFilter" class="fm-input" onchange="filterQuoteList()"><option value="all">ทั้งหมด</option>' + quoteStatusList.map(function(s) { return '<option value="' + s + '">' + quoteStatusLabels[s] + '</option>'; }).join('') + '</select></div>';
  html += '<div class="fg" style="flex:1"><label>⇅ เรียง</label><select id="quoteSortSel" class="fm-input" onchange="quoteSort=this.value;filterQuoteList()">' +
    '<option value="date_desc"' + (quoteSort==='date_desc'?' selected':'') + '>วันที่ ใหม่สุด</option>' +
    '<option value="date_asc"' + (quoteSort==='date_asc'?' selected':'') + '>วันที่ เก่าสุด</option>' +
    '<option value="amount_desc"' + (quoteSort==='amount_desc'?' selected':'') + '>มูลค่า มากสุด</option>' +
    '<option value="amount_asc"' + (quoteSort==='amount_asc'?' selected':'') + '>มูลค่า น้อยสุด</option>' +
    '<option value="quoteno"' + (quoteSort==='quoteno'?' selected':'') + '>เลขที่</option>' +
    '</select></div>';
  html += '<div class="fg" style="flex:0.5"><label>&nbsp;</label><button class="btn bo" style="width:100%" onclick="resetQuoteFilters()">✖️ ล้าง</button></div>';
  html += '</div></div>';

  html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">';
  html += '<div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
  html += '<button id="btnQuoteCard" class="btn bsm' + (quoteViewMode==='card'?' bp':'') + '" style="border-radius:0" onclick="setQuoteView(\'card\')">🗂️ Card</button>';
  html += '<button id="btnQuoteTable" class="btn bsm' + (quoteViewMode==='table'?' bp':'') + '" style="border-radius:0" onclick="setQuoteView(\'table\')">📋 Table</button>';
  html += '</div>';
  html += '<button class="btn bsm ' + (quoteSelectMode?'bd':'bo') + '" onclick="toggleQuoteSelectMode()">☑️ ' + (quoteSelectMode?'ยกเลิก':'เลือก') + '</button>';
  html += '<button class="btn bsm bo" onclick="exportQuotationTable()">📥 Export Excel</button>';
  html += '</div>';

  html += '<div id="quoteViewContainer"></div>';
  el.innerHTML = html;
  refreshQuoteView();

  // Deep link จาก task.links (ดู openTaskLink ใน utils.js) — เปิดใบเสนอราคานี้ต่อทันทีหลัง render เสร็จ
  if (S.focusQuoteId) {
    var _fq = S.focusQuoteId;
    S.focusQuoteId = null;
    setTimeout(function() { editQuotation(_fq); }, 0);
  }
}

// กรอง + เรียง ตาม input ปัจจุบัน — ใช้ร่วมทั้ง Card และ Table
function _quoteFilteredSorted() {
  var search = (document.getElementById('quoteSearchInput')?.value || '').toLowerCase();
  var dealerFilter = document.getElementById('quoteDealerFilter')?.value || 'all';
  var statusFilter = document.getElementById('quoteStatusFilter')?.value || 'all';
  var list = quotations.filter(function(q) {
    if (search) {
      var hay = [(q.quoteNo||''), (q.projectName||''), (q.poNo||''), (q.soNo||''), (q.invoiceNo||''), (q.dealerName||'')].join(' ').toLowerCase();
      if (hay.indexOf(search) === -1) return false;
    }
    if (dealerFilter !== 'all' && q.dealerId !== dealerFilter) return false;
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    return true;
  });
  list.sort(function(a, b) {
    if (quoteSort === 'amount_desc') return (Number(b.totalAmount)||0) - (Number(a.totalAmount)||0);
    if (quoteSort === 'amount_asc')  return (Number(a.totalAmount)||0) - (Number(b.totalAmount)||0);
    if (quoteSort === 'quoteno')     return (a.quoteNo||'').localeCompare(b.quoteNo||'');
    var da = a.validFrom || (a.createdAt||'').split('T')[0] || '', db = b.validFrom || (b.createdAt||'').split('T')[0] || '';
    return quoteSort === 'date_asc' ? da.localeCompare(db) : db.localeCompare(da);
  });
  return list;
}

function setQuoteView(mode) {
  quoteViewMode = mode;
  localStorage.setItem('quoteViewMode', mode);
  var bc = document.getElementById('btnQuoteCard'), bt = document.getElementById('btnQuoteTable');
  if (bc) bc.className = 'btn bsm' + (mode==='card'?' bp':'');
  if (bt) bt.className = 'btn bsm' + (mode==='table'?' bp':'');
  refreshQuoteView();
}

function refreshQuoteView() {
  var cont = document.getElementById('quoteViewContainer');
  if (!cont) return;
  var list = _quoteFilteredSorted();
  _quoteVisibleIds = list.map(function(q) { return q.id; });
  if (!list.length) {
    cont.innerHTML = '<div class="empty-state" style="text-align:center;padding:40px"><div class="empty-state-icon" style="font-size:48px">💰</div><p>ไม่พบใบเสนอราคา</p></div>';
    return;
  }
  var html = quoteViewMode === 'table' ? renderQuoteTableHTML(list) : renderQuoteCardsHTML(list);
  if (quoteSelectMode) {
    var selCnt = Object.keys(quoteSelected).length;
    html += '<div id="quoteSelBar" style="position:sticky;bottom:0;z-index:50;background:var(--card);border-top:2px solid var(--accent);padding:10px 14px;margin-top:12px;border-radius:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<span id="quoteSelCount" style="font-size:13px;font-weight:600;min-width:80px">' + selCnt + ' รายการที่เลือก</span>' +
      '<button class="btn bo bsm" onclick="toggleQuoteSelectAll(true)">เลือกทั้งหมด (' + _quoteVisibleIds.length + ')</button>' +
      '<button class="btn bo bsm" onclick="toggleQuoteSelectAll(false)">ยกเลิกเลือก</button>' +
      '<button class="btn bd" id="quoteSelDelBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkDeleteQuotes()">🗑️ ลบที่เลือก (' + selCnt + ')</button>' +
      '</div>';
  }
  cont.innerHTML = html;
}

function toggleQuoteSelectMode() {
  quoteSelectMode = !quoteSelectMode;
  quoteSelected = {};
  render();
}

function toggleQuoteSelect(id) {
  if (quoteSelected[id]) delete quoteSelected[id];
  else quoteSelected[id] = true;
  var cb = document.getElementById('quoteChk_' + id);
  if (cb) cb.checked = !!quoteSelected[id];
  var cnt = Object.keys(quoteSelected).length;
  _quoteSelBarUpdate(cnt);
  var allCb = document.getElementById('quoteSelAll');
  if (allCb) allCb.checked = cnt === _quoteVisibleIds.length && cnt > 0;
}

function toggleQuoteSelectAll(selectAll) {
  quoteSelected = {};
  if (selectAll) _quoteVisibleIds.forEach(function(id) { quoteSelected[id] = true; });
  _quoteVisibleIds.forEach(function(id) {
    var cb = document.getElementById('quoteChk_' + id);
    if (cb) cb.checked = !!quoteSelected[id];
  });
  _quoteSelBarUpdate(Object.keys(quoteSelected).length);
}

function _quoteSelBarUpdate(cnt) {
  var countEl = document.getElementById('quoteSelCount');
  if (countEl) countEl.textContent = cnt + ' รายการที่เลือก';
  var delBtn = document.getElementById('quoteSelDelBtn');
  if (delBtn) { delBtn.disabled = !cnt; delBtn.textContent = '🗑️ ลบที่เลือก (' + cnt + ')'; }
}

function bulkDeleteQuotes() {
  var ids = Object.keys(quoteSelected);
  if (!ids.length) return;
  if (!confirm('ลบ ' + ids.length + ' ใบเสนอราคาที่เลือก?\nไม่สามารถกู้คืนได้')) return;
  quotations = quotations.filter(function(q) { return ids.indexOf(q.id) === -1; });
  localStorage.setItem('v7_quotations_v2', JSON.stringify(quotations));
  quoteSelected = {};
  quoteSelectMode = false;
  toast('🗑️ ลบแล้ว ' + ids.length + ' รายการ');
  render();
}

function renderQuoteCardsHTML(list) {
  var dealers = ST.getAll('dealers'), dealerMap = {};
  dealers.forEach(function(d) { dealerMap[d.id] = d; });
  var html = '<div class="quote-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">';
  list.forEach(function(q) {
    var dealer = dealerMap[q.dealerId] || { name: q.dealerName || '-' };
    var statusColor = quoteStatusColors[q.status] || '#64748b';
    var statusLabel = quoteStatusLabels[q.status] || q.status;
    var cardClick = quoteSelectMode ? "toggleQuoteSelect('" + q.id + "')" : "editQuotation('" + q.id + "')";
    html += '<div class="quote-card" style="position:relative;background:var(--card);border:1px solid ' + (quoteSelected[q.id] ? 'var(--accent)' : 'var(--border)') + ';border-radius:16px;padding:16px;cursor:pointer" onclick="' + cardClick + '">';
    if (quoteSelectMode) html += '<input type="checkbox" id="quoteChk_' + q.id + '" ' + (quoteSelected[q.id] ? 'checked' : '') + ' onclick="event.stopPropagation();toggleQuoteSelect(\'' + q.id + '\')" style="position:absolute;top:12px;right:12px;width:18px;height:18px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
    html += '<div><div style="font-weight:800;font-size:16px;color:var(--accent)">' + qcopyHtml(q.quoteNo) + '</div>';
    html += '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + sanitize(dealer.name) + '</div></div>';
    html += '<span class="tag" style="background:' + statusColor + '20;color:' + statusColor + ';border:1px solid ' + statusColor + '40">' + statusLabel + '</span>';
    html += '</div>';
    if (q.projectName) html += '<div style="font-size:12px;color:var(--text2);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🏗️ ' + sanitize(q.projectName) + '</div>';
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
  });
  html += '</div>';
  return html;
}

// สรุปรายการสินค้าแบบย่อ เช่น "M4E ×17, Terra +2 (4)"
function _quoteItemsSummary(items) {
  items = items || [];
  if (!items.length) return '<span style="color:var(--text2)">-</span>';
  var first = items[0];
  var s = sanitize((first.name || '').substr(0, 18)) + ' ×' + (Number(first.quantity) || 1);
  if (items.length > 1) s += ', +' + (items.length - 1);
  return s + ' <span style="color:var(--text2)">(' + items.length + ')</span>';
}

// รายชื่อสินค้าเต็มๆ ทุกรายการ (ไม่ตัด) ไว้ใช้เป็น title= tooltip — ต่างจาก _quoteItemsSummary ที่ตัดสั้น
// ไว้แสดงในตารางเท่านั้น
function _quoteItemsSummaryFull(items) {
  items = items || [];
  if (!items.length) return '';
  return items.map(function(it) { return (it.name || '') + ' x' + (Number(it.quantity) || 1); }).join(', ');
}

function renderQuoteTableHTML(list) {
  var sumAmount = 0;
  list.forEach(function(q) { sumAmount += Number(q.totalAmount) || 0; });
  var h = '<div class="export-wrap" style="overflow-x:auto;border:1px solid var(--border);border-radius:12px"><table class="export-table" style="width:100%;font-size:12px;white-space:nowrap">';
  h += '<thead><tr>' +
    (quoteSelectMode ? '<th style="width:32px;text-align:center"><input type="checkbox" id="quoteSelAll" title="เลือกทั้งหมด" onclick="toggleQuoteSelectAll(this.checked)"></th>' : '') +
    '<th>#</th><th>วันที่</th><th>เลขใบเสนอราคา</th><th>ชื่อโครงการ</th><th>PO</th><th>รายการสินค้า</th>' +
    '<th style="text-align:right">มูลค่า</th><th>SO</th><th>Invoice</th><th>สถานะ</th></tr></thead><tbody>';
  list.forEach(function(q, i) {
    var statusColor = quoteStatusColors[q.status] || '#64748b';
    var statusLabel = quoteStatusLabels[q.status] || q.status;
    h += '<tr>';
    if (quoteSelectMode) h += '<td style="text-align:center" onclick="toggleQuoteSelect(\'' + q.id + '\')"><input type="checkbox" id="quoteChk_' + q.id + '" ' + (quoteSelected[q.id] ? 'checked' : '') + ' onclick="event.stopPropagation();toggleQuoteSelect(\'' + q.id + '\')"></td>';
    h += '<td style="color:var(--text2)">' + (i + 1) + '</td>';
    h += '<td>' + (q.validFrom || '-') + '</td>';
    h += '<td style="color:var(--accent);font-weight:600;cursor:pointer" onclick="editQuotation(\'' + q.id + '\')">' + qcopyHtml(q.quoteNo || '-') + '</td>';
    h += '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="editQuotation(\'' + q.id + '\')" title="' + sanitize(q.projectName || '') + '">' + (q.projectName ? sanitize(q.projectName) : '<span style="color:var(--text2)">-</span>') + '</td>';
    h += '<td>' + (q.poNo ? qcopyHtml(q.poNo) : '<span style="color:var(--text2)">-</span>') + '</td>';
    h += '<td style="color:var(--text2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(_quoteItemsSummaryFull(q.items)) + '">' + _quoteItemsSummary(q.items) + '</td>';
    h += '<td style="text-align:right;color:#22c55e;font-weight:600">' + formatNumber(q.totalAmount) + '</td>';
    h += '<td><input type="text" value="' + sanitize(q.soNo || '') + '" placeholder="+ SO" onchange="updateQuoteInline(\'' + q.id + '\',\'soNo\',this.value)" onclick="event.stopPropagation()" style="width:90px;font-size:11px;padding:3px 5px"></td>';
    h += '<td><input type="text" value="' + sanitize(q.invoiceNo || '') + '" placeholder="+ Invoice" onchange="updateQuoteInline(\'' + q.id + '\',\'invoiceNo\',this.value)" onclick="event.stopPropagation()" style="width:90px;font-size:11px;padding:3px 5px"></td>';
    h += '<td><span class="tag" style="background:' + statusColor + '20;color:' + statusColor + ';border:1px solid ' + statusColor + '40;font-size:11px">' + statusLabel + '</span></td>';
    h += '</tr>';
  });
  h += '<tr style="font-weight:800;border-top:2px solid var(--accent)"><td colspan="' + (quoteSelectMode ? 7 : 6) + '">รวม ' + list.length + ' ใบเสนอราคา</td>';
  h += '<td style="text-align:right;color:#22c55e">' + formatNumber(Math.round(sumAmount)) + '</td><td colspan="3"></td></tr>';
  h += '</tbody></table></div>';
  return h;
}

// แก้ SO/Invoice inline จากตาราง — บันทึกทันที
function updateQuoteInline(id, field, val) {
  for (var i = 0; i < quotations.length; i++) {
    if (quotations[i].id === id) {
      quotations[i][field] = (val || '').trim();
      quotations[i].updatedAt = new Date().toISOString();
      break;
    }
  }
  localStorage.setItem('v7_quotations_v2', JSON.stringify(quotations));
  toast('💾 บันทึก ' + (field === 'soNo' ? 'SO' : 'Invoice') + ' แล้ว');
}

function exportQuotationTable() {
  if (typeof XLSX === 'undefined') { toast('⚠️ โหลด XLSX ไม่สำเร็จ'); return; }
  var list = _quoteFilteredSorted();
  var head = ['#', 'วันที่', 'เลขใบเสนอราคา', 'ชื่อโครงการ', 'Dealer', 'PO', 'รายการสินค้า', 'มูลค่า', 'SO', 'Invoice', 'สถานะ'];
  var rows = [head];
  list.forEach(function(q, i) {
    var itemsTxt = (q.items || []).map(function(it) { return (it.name || '') + ' x' + (Number(it.quantity) || 1); }).join(', ');
    rows.push([i + 1, q.validFrom || '', q.quoteNo || '', q.projectName || '', q.dealerName || '', q.poNo || '', itemsTxt, Number(q.totalAmount) || 0, q.soNo || '', q.invoiceNo || '', quoteStatusLabels[q.status] || q.status]);
  });
  var ws = XLSX.utils.aoa_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Quotations');
  XLSX.writeFile(wb, 'quotations-' + _td() + '.xlsx');
  toast('📥 Export แล้ว (' + list.length + ' ใบ)');
}

function filterQuoteList() { refreshQuoteView(); }

function resetQuoteFilters() {
  var searchInput = document.getElementById('quoteSearchInput');
  if (searchInput) searchInput.value = '';
  var dealerFilter = document.getElementById('quoteDealerFilter');
  if (dealerFilter) dealerFilter.value = 'all';
  var statusFilter = document.getElementById('quoteStatusFilter');
  if (statusFilter) statusFilter.value = 'all';
  refreshQuoteView();
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
    // มาจาก "ประเมินราคาคร่าวๆ" ซึ่งตั้งราคาแบบ RRP เสมอ (ดู addEstimatorItemFromInput) — ระบุ level ไว้
    // ให้ป้าย Level ในตารางรู้ว่าไม่ตรงกับ Level ของ Dealer/ใบเสนอราคานี้ จะได้ขึ้นเตือนให้กดปรับราคาใหม่
    quotationItems.forEach(function(it) { if (!it.priceLevel) it.priceLevel = 'RRP'; });
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

// จับคู่สินค้ากับแคตตาล็อกแล้วคำนวณราคาต่อหน่วยตาม level ของ Dealer — ใช้ร่วมกันทั้งสร้างใบเสนอราคาจาก Pipeline และจาก Run Rate
// fallbackPrice: ราคาสำรองถ้าหาในแคตตาล็อกไม่เจอเลย (เช่น ราคาที่บันทึกไว้ใน pipeline item เดิม)
function _qResolveItem(model, qty, sku, dealerLevel, fallbackPrice) {
  var groupKeys = [
    { keys: ['M3M','MULTISPECTRAL'], group: 'm3m' },
    { keys: ['M4TD'],               group: 'm4td' },
    { keys: ['M4T'],                group: 'm4t' },
    { keys: ['M4E'],                group: 'm4e' },
    { keys: ['M400'],               group: 'm400' },
    { keys: ['DOCK'],               group: 'dock3' }
  ];
  var prod = null;
  // 1. SKU ตรงเป๊ะก่อน — แม่นที่สุด (SKU เก็บซ่อนไว้กับ item ตอนเลือกจากแคตตาล็อก)
  if (sku && typeof Products !== 'undefined' && Products.getBySku) prod = Products.getBySku(sku);
  // 2. ชื่อตรงเป๊ะ → normalize (ตัด space เกิน, ไม่สนตัวพิมพ์)
  if (!prod && typeof Products !== 'undefined' && Products.getByName) {
    prod = Products.getByName(model);
    if (!prod && Products.getAll) {
      var norm = (model || '').trim().replace(/\s+/g, ' ').toLowerCase();
      var all = Products.getAll();
      for (var ai = 0; ai < all.length; ai++) {
        if ((all[ai].name || '').trim().replace(/\s+/g, ' ').toLowerCase() === norm) { prod = all[ai]; break; }
      }
    }
  }
  // 3. fallback: จับคู่ตามกลุ่มโดรนหลัก (รองรับชื่อย่อ M4T*2 ฯลฯ ที่พิมพ์เอง)
  if (!prod) {
    var mu = (model || '').toUpperCase();
    var group = null;
    for (var i = 0; i < groupKeys.length; i++) {
      var spec = groupKeys[i];
      if (spec.keys.some(function(k) { return mu.indexOf(k) !== -1; })) { group = spec.group; break; }
    }
    prod = (group && typeof getProductForModelGroup === 'function') ? getProductForModelGroup(group) : null;
  }
  // ราคา: ตาม Level → RRP Ex VAT → ราคาสำรองที่ส่งเข้ามา (กันเป็น 0)
  var unitPrice = 0;
  var resolvedLevel = null;
  if (prod) {
    if (typeof getModelPriceByLevel === 'function') unitPrice = getModelPriceByLevel(prod.name, dealerLevel) || 0;
    if (unitPrice) resolvedLevel = dealerLevel;
    if (!unitPrice) unitPrice = Number(prod.rrpExVat) || Number(prod.price) || 0;
  }
  if (!unitPrice) unitPrice = Number(fallbackPrice) || 0;
  qty = qty || 1;
  return { sku: prod ? (prod.sku||'') : '', name: prod ? prod.name : model, quantity: qty, unitPrice: unitPrice, amount: unitPrice * qty, cost: prod ? (Number(prod.cost) || 0) : 0, priceLevel: resolvedLevel };
}

function createQuoteFromPipeline(pipelineId) {
  var p = ST.getOne('pipeline', pipelineId);
  if (!p) { toast('ไม่พบ Pipeline'); return; }
  var dealer = ST.getOne('dealers', p.dealerId);
  var dealerLevel = dealer ? (dealer.level || 'B') : 'B';

  var pipeItems = (p.items && p.items.length) ? p.items : (p.model ? [{ model: p.model, qty: p.modelQty || 1 }] : []);
  var items = pipeItems.map(function(it) {
    return _qResolveItem(it.model, it.qty, it.sku, dealerLevel, it.price);
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

// ================================================================
// สร้างใบเสนอราคาจาก Run Rate — เลือกได้หลายรุ่น ปรับจำนวนเปิดบางส่วนได้ (ไม่บังคับเปิดเต็ม forecast)
// ================================================================
function showRunrateQuoteBuilderM(dealerId) {
  var dealer = ST.getOne('dealers', dealerId);
  var runrate = fcGetApprovedRunrate(dealerId);
  var seenModel = {};
  var lines = [];
  runrate.forEach(function(r) {
    var key = _fcNorm(r.model);
    if (!key || seenModel[key]) return;
    seenModel[key] = true;
    var conv = fcRunrateConversion(dealerId, r.model);
    if (conv.remainingQty > 0) lines.push({ model: r.model, forecastQty: conv.forecastQty, openedQty: conv.openedQty, remainingQty: conv.remainingQty });
  });

  if (!lines.length) { toast('⚠️ ไม่มี Run Rate ที่ยังเปิดใบเสนอราคาได้ (เปิดครบหมดแล้ว หรือยังไม่มีข้อมูล)'); return; }

  window._rrBuilderLines = lines;
  window._rrBuilderDealerId = dealerId;
  window._rrBuilderPicked = {};
  lines.forEach(function(l) { window._rrBuilderPicked[l.model] = l.remainingQty; });

  var h = '<div>';
  h += '<div style="font-size:.8rem;color:var(--text2);margin-bottom:8px">เลือกรุ่นและปรับจำนวนที่จะเปิดในใบเสนอราคานี้ — ไม่ต้องเปิดเต็มจำนวนที่ forecast ไว้ก็ได้</div>';
  h += '<div id="rrBuilderList"></div>';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">';
  h += '<span style="font-size:.8rem;color:var(--text2)">เลือกแล้ว <b id="rrBuilderCount">0</b> ชิ้น</span>';
  h += '</div>';
  h += '<div class="fm-actions" style="margin-top:12px">';
  h += '<button class="btn bp" onclick="_rrBuilderCreate()">📄 สร้างใบเสนอราคา</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '</div></div>';
  openM('📄 สร้างใบเสนอราคาจาก Run Rate — ' + (dealer ? sanitize(dealer.name) : ''), h);
  _rrBuilderRenderList();
}
function _rrBuilderRenderList() {
  var wrap = document.getElementById('rrBuilderList');
  if (!wrap) return;
  var h = '';
  var total = 0;
  window._rrBuilderLines.forEach(function(l, i) {
    var val = window._rrBuilderPicked[l.model] || 0;
    total += val;
    h += '<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">';
    h += '<input type="checkbox" ' + (val > 0 ? 'checked' : '') + ' onchange="_rrBuilderToggle(' + i + ',this.checked)">';
    h += '<div style="flex:1;min-width:0"><b>' + sanitize(l.model) + '</b><div style="font-size:.68rem;color:var(--text2)">Forecast ' + l.forecastQty + ' — เปิดแล้ว ' + l.openedQty + ' — เหลือ ' + l.remainingQty + '</div></div>';
    h += '<input type="number" min="0" max="' + l.remainingQty + '" value="' + val + '" style="width:60px" onchange="_rrBuilderSetQty(' + i + ',this.value)">';
    h += '</div>';
  });
  wrap.innerHTML = h;
  var countEl = document.getElementById('rrBuilderCount');
  if (countEl) countEl.textContent = total;
}
function _rrBuilderSetQty(i, v) {
  var l = window._rrBuilderLines[i];
  var val = Math.max(0, Math.min(l.remainingQty, parseInt(v) || 0));
  window._rrBuilderPicked[l.model] = val;
  _rrBuilderRenderList();
}
function _rrBuilderToggle(i, checked) {
  var l = window._rrBuilderLines[i];
  window._rrBuilderPicked[l.model] = checked ? l.remainingQty : 0;
  _rrBuilderRenderList();
}
function _rrBuilderCreate() {
  var selections = [];
  window._rrBuilderLines.forEach(function(l) {
    var qty = window._rrBuilderPicked[l.model] || 0;
    if (qty > 0) selections.push({ model: l.model, qty: qty });
  });
  if (!selections.length) { toast('⚠️ เลือกอย่างน้อย 1 รายการ'); return; }
  var dealerId = window._rrBuilderDealerId;
  closeMForce();
  createQuoteFromRunrateSelection(dealerId, selections);
}

function createQuoteFromRunrateSelection(dealerId, selections) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) { toast('ไม่พบ Dealer'); return; }
  var dealerLevel = dealer.level || 'B';

  var items = selections.map(function(sel) {
    return _qResolveItem(sel.model, sel.qty, '', dealerLevel, 0);
  });

  var newId = 'qt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  var newQuoteNo = getNextQuoteNumber();
  var newQuote = {
    id: newId, quoteNo: newQuoteNo,
    dealerId: dealerId, dealerName: dealer.name,
    dealerLevel: dealerLevel, levelUsed: dealerLevel,
    pipelineId: '', projectName: '', endUserTH: '',
    createdAt: new Date().toISOString(), validFrom: _td(), validTo: addD(_td(), 30),
    paymentTerm: 'Net due 30 days',
    quotedBy: (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.displayName : (getConfig().saleName || ''),
    poNo: '', items: items,
    grossTotal: 0, discountPercent: 0, discountAmount: 0,
    netAmount: 0, vatPercent: 7, vatAmount: 0, totalAmount: 0,
    remark: '📦 สร้างจาก Run Rate forecast', contacts: [], status: 'draft',
    sentDate: null, approvedDate: null, updatedAt: new Date().toISOString()
  };

  var existingQuotes = [];
  try { existingQuotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch (e) {}
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
  window._quoteAttach = (quote.attachments || []).slice();

  // ซ่อมค่าที่เป็น 0 อัตโนมัติตอนเปิด — เติมราคา + ต้นทุนจากแคตตาล็อกให้แถวที่ยังว่าง (ใบเก่าที่บันทึกก่อนแก้จะเติมให้เอง)
  quotationItems.forEach(function(it) {
    if (!it.name) return;
    var prod = (typeof Products !== 'undefined') ?
      ((it.sku && Products.getBySku ? Products.getBySku(it.sku) : null) || (Products.getByName ? Products.getByName(it.name) : null)) : null;
    if (!Number(it.unitPrice)) {
      var fixed = getModelPriceByLevelForQuote(it.name, selectedLevelForPrice) || 0;
      if (fixed > 0) { it.unitPrice = fixed; it.amount = (Number(it.quantity) || 1) * fixed; }
    }
    if (!Number(it.cost) && prod && Number(prod.cost) > 0) it.cost = Number(prod.cost);
  });
  
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
  
  var html = '<div style="max-width:1200px;margin:0 auto;padding:16px">';
  html += '<div class="bc"><a onclick="go(\'quotationV2\')">💰 Quotation</a><span class="sep">›</span><span class="cur">' + qcopyHtml(quote.quoteNo) + '</span></div>';
  
  // Form Card
  html += '<div class="card" style="margin-bottom:16px">';
  html += '<h2>✏️ แก้ไขใบเสนอราคา <span class="ml"><button class="btn bsm bd" onclick="deleteQuotation(\'' + quote.id + '\')">🗑️ ลบ</button></span></h2>';
  
  html += '<div class="fr"><div class="fg"><label>🏪 Dealer *</label><select id="editQuoteDealer" class="fm-input" onchange="editQuoteDealerChanged()">' + dealerOptions + '</select></div>';
  html += '<div class="fg"><label>📄 เลขที่</label><input type="text" id="editQuoteNo" class="fm-input" value="' + sanitize(quote.quoteNo) + '"></div></div>';

  html += '<div class="fg"><label>🏗️ ชื่อโครงการ</label><input type="text" id="editQuoteProject" class="fm-input" value="' + sanitize(quote.projectName || '') + '" placeholder="ชื่อโครงการ (ดึงจาก Pipeline อัตโนมัติ ถ้าสร้างจากโครงการ)"></div>';
  
  html += '<div class="fr"><div class="fg"><label>📅 วันที่เริ่ม</label><input type="text" id="editQuoteValidFrom" class="fm-input dp" value="' + quote.validFrom + '"></div>';
  html += '<div class="fg"><label>📅 หมดอายุ</label><input type="text" id="editQuoteValidTo" class="fm-input dp" value="' + quote.validTo + '"></div></div>';
  
  html += '<div class="fr"><div class="fg"><label>💰 ระดับราคา</label><select id="editQuoteLevel" class="fm-input" onchange="editQuoteLevelChanged()">' + levelOptions + '</select></div>';
  html += '<div class="fg"><label>💳 เงื่อนไขชำระเงิน</label><input type="text" id="editQuotePaymentTerm" class="fm-input" value="' + sanitize(quote.paymentTerm) + '"></div></div>';
  
  html += '<div class="fr"><div class="fg"><label>📄 PO No.</label><input type="text" id="editQuotePoNo" class="fm-input" value="' + sanitize(quote.poNo || '') + '"></div>';
  html += '<div class="fg"><label>👤 Quoted by</label><input type="text" id="editQuoteQuotedBy" class="fm-input" value="' + sanitize(quote.quotedBy) + '"></div></div>';

  html += '<div class="fr"><div class="fg"><label>📦 SO No. (Sales Order)</label><input type="text" id="editQuoteSoNo" class="fm-input" value="' + sanitize(quote.soNo || '') + '" placeholder="เลข SO — กรอกตอนสร้าง Sales Order"></div>';
  html += '<div class="fg"><label>🧾 Invoice No.</label><input type="text" id="editQuoteInvoiceNo" class="fm-input" value="' + sanitize(quote.invoiceNo || '') + '" placeholder="เลข Invoice — กรอกภายหลังตอนวางบิล"></div></div>';
  
  html += '<div class="fr"><div class="fg"><label>📊 สถานะ</label><select id="editQuoteStatus" class="fm-input">' + statusOptions + '</select></div>';
  html += '<div class="fg"></div></div>';
  
  html += '<div class="fg"><label>📝 หมายเหตุ</label><textarea id="editQuoteRemark" rows="2" class="fm-input">' + sanitize(quote.remark || '') + '</textarea></div>';
  html += attachUploadHtml('_quoteAttach', 'quotations', '📷 รูปแนบ (PO ลูกค้า/ใบเสนอราคาเซ็นกลับ/สัญญา)');
  html += '</div>';
  
  // Products Section
  html += '<div class="card" style="margin-bottom:16px">';
  html += '<h2>📦 รายการสินค้า <span class="ml"><button id="btnToggleCost" class="btn bsm ' + (showQuotationCost ? 'bp' : 'bo') + '" onclick="toggleQuotationCostView()" title="แสดง/ซ่อนต้นทุน-กำไร">📊 กำไร</button></span></h2>';

  // Solution preset chips — เอา pattern จาก Quick Price Estimator มาใช้ซ้ำ กดทีเดียวเพิ่มได้หลายรายการพร้อมราคาตาม Level ของใบนี้
  html += '<div id="quoteSolutionChipZone"></div>';

  // Add product row with autocomplete
  html += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">';
  html += '<div class="fg" style="flex:3;position:relative"><label>🔍 เลือกสินค้า (พิมพ์ชื่อหรือ SKU ค้นหา — เจอแล้วกด Enter เพิ่มได้เลย)</label>';
  html += '<input type="text" id="newItemModel" class="fm-input" placeholder="พิมพ์ชื่อสินค้าหรือ SKU..." autocomplete="off" oninput="_qiaFilterSuggest()" onkeydown="_qiaSuggestKeydown(event)">';
  html += '<div id="newItemSuggestBox" class="pqa-suggest" style="display:none"></div>';
  html += '</div>';
  html += '<div class="fg" style="width:100px"><label>🔢 จำนวน</label><input type="number" id="newItemQty" class="fm-input" value="1" min="1" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addQuotationItemFromInput();}"></div>';
  html += '<div><button class="btn bp" onclick="addQuotationItemFromInput()" style="margin-bottom:4px;background:#22c55e">➕ เพิ่มสินค้า</button>' +
    '<button class="btn bo" type="button" onclick="openProductPicker({showPrice:true, onAdd:pickerAddToQuote})" title="เลือกจากแคตตาล็อก (แนะนำ/ค้นหา)" style="margin-bottom:4px;margin-left:4px">📋 แคตตาล็อก</button></div>';
  html += '</div>';
  _qiaBindOutsideClose();
  
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
  html += '<div id="quoteCostSummary" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)">';
  html += '<div class="fr" style="justify-content:space-between;padding:4px 0"><span style="opacity:.7">ต้นทุนรวม (Ex VAT):</span><span id="quoteTotalCost" style="color:#f59e0b;font-weight:700">0 ฿</span></div>';
  html += '<div class="fr" style="justify-content:space-between;padding:4px 0"><span style="opacity:.7">กำไรขั้นต้น:</span><span id="quoteGrossProfit" style="color:#22c55e;font-weight:700">0 ฿</span></div>';
  html += '<div class="fr" style="justify-content:space-between;padding:4px 0"><span style="opacity:.7">Gross Margin %:</span><span id="quoteMarginPct" style="font-weight:800;font-size:16px">0%</span></div>';
  html += '</div>';
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
  html += '<button class="btn bp" onclick="createSOFromQuotation(\'' + quote.id + '\')" style="background:#8b5cf6">📦 สร้าง SO</button>';
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
          if (newPrice > 0) { // ไม่เขียนทับด้วย 0 — คงราคาเดิมไว้ถ้าหาราคาใหม่ไม่ได้
            quotationItems[i].unitPrice = newPrice;
            quotationItems[i].amount = (quotationItems[i].quantity || 1) * newPrice;
          }
        }
        renderQuotationItemsTable();
        recalculateQuotationTotal();
        // เดิมมีโค้ดสร้าง <datalist> ใหม่ผูกกับ #newItemModel ตรงนี้ด้วย — เลิกใช้ native datalist แล้ว
        // (เปลี่ยนเป็นกล่องแนะนำ custom ที่ค้นหาด้วย SKU ได้ผ่าน _qiaFilterSuggest) ตัดทิ้งเพราะไม่มีผลอะไรแล้ว
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
    if (newPrice > 0) { // ไม่เขียนทับด้วย 0 — คงราคาเดิมไว้ถ้าหาราคาใหม่ไม่ได้
      quotationItems[i].unitPrice = newPrice;
      quotationItems[i].amount = (quotationItems[i].quantity || 1) * newPrice;
    }
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
  var soNo = document.getElementById('editQuoteSoNo')?.value.trim() || '';
  var invoiceNo = document.getElementById('editQuoteInvoiceNo')?.value.trim() || '';
  var projectName = document.getElementById('editQuoteProject')?.value.trim() || '';
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
      quotations[i].soNo = soNo;
      quotations[i].invoiceNo = invoiceNo;
      quotations[i].projectName = projectName;
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
      quotations[i].attachments = window._quoteAttach || [];
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
    _saveQuotationsV2();
  }
}

// ================================================================
// MARGIN ANALYSIS PAGE (B)
// ================================================================

var _maFilter = { status: 'all', dealerId: '', dateFrom: '', dateTo: '' };

function rMarginAnalysis(el) {
  document.getElementById('pgT').textContent = '📊 Margin Analysis';
  var allQuotes = [];
  try { allQuotes = JSON.parse(localStorage.getItem('v7_quotations_v2') || '[]'); } catch(e) {}

  // Filter
  var filtered = allQuotes.filter(function(q) {
    if (_maFilter.status !== 'all' && q.status !== _maFilter.status) return false;
    if (_maFilter.dealerId && q.dealerId !== _maFilter.dealerId) return false;
    if (_maFilter.dateFrom && (q.validFrom || '') < _maFilter.dateFrom) return false;
    if (_maFilter.dateTo && (q.validFrom || '') > _maFilter.dateTo) return false;
    return true;
  });

  // Compute per-quote cost/margin
  var rows = filtered.map(function(q) {
    var totalCost = 0;
    (q.items || []).forEach(function(it) { totalCost += (Number(it.cost) || 0) * (Number(it.quantity) || 1); });
    var revenue = Number(q.netAmount) || 0;
    var grossProfit = revenue - totalCost;
    var margin = revenue > 0 ? (grossProfit / revenue * 100) : 0;
    return { q: q, totalCost: totalCost, revenue: revenue, grossProfit: grossProfit, margin: margin };
  });

  // Totals
  var sumRev = 0, sumCost = 0;
  rows.forEach(function(r) { sumRev += r.revenue; sumCost += r.totalCost; });
  var sumProfit = sumRev - sumCost;
  var avgMargin = sumRev > 0 ? (sumProfit / sumRev * 100) : 0;

  var dealers = ST.getAll('dealers');
  var dealerOptions = '<option value="">ทุก Dealer</option>';
  dealers.forEach(function(d) { dealerOptions += '<option value="' + d.id + '"' + (_maFilter.dealerId === d.id ? ' selected' : '') + '>' + sanitize(d.name) + '</option>'; });

  var statusOptions = '<option value="all"' + (_maFilter.status==='all'?' selected':'') + '>ทุก Status</option>';
  var sLabels = { draft:'Draft', sent:'Sent', approved:'Approved', rejected:'Rejected', expired:'Expired' };
  Object.keys(sLabels).forEach(function(s) { statusOptions += '<option value="' + s + '"' + (_maFilter.status===s?' selected':'') + '>' + sLabels[s] + '</option>'; });

  var marColor = avgMargin >= 10 ? '#22c55e' : (avgMargin >= 5 ? '#f59e0b' : '#ef4444');

  var html = '<div style="max-width:1200px;margin:0 auto">';

  // Summary cards
  html += '<div class="sr" style="margin-bottom:16px">';
  html += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(sumRev) + '</div><div class="sl">Revenue (Net ExVAT)</div></div>';
  html += '<div class="sc"><div class="sn" style="color:#f59e0b">' + fmtMoneyShort(sumCost) + '</div><div class="sl">ต้นทุนรวม</div></div>';
  html += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(sumProfit) + '</div><div class="sl">กำไรขั้นต้น</div></div>';
  html += '<div class="sc"><div class="sn" style="color:' + marColor + ';font-size:1.4rem">' + avgMargin.toFixed(1) + '%</div><div class="sl">Avg Gross Margin</div></div>';
  html += '<div class="sc"><div class="sn">' + rows.length + '</div><div class="sl">ใบเสนอราคา</div></div>';
  html += '</div>';

  // Filters
  html += '<div class="card" style="margin-bottom:16px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">';
  html += '<div class="fg"><label>Status</label><select class="fm-input" onchange="_maFilter.status=this.value;render()">' + statusOptions + '</select></div>';
  html += '<div class="fg"><label>Dealer</label><select class="fm-input" onchange="_maFilter.dealerId=this.value;render()">' + dealerOptions + '</select></div>';
  html += '<div class="fg"><label>จาก</label><input type="text" class="fm-input dp" value="' + (_maFilter.dateFrom||'') + '" placeholder="YYYY-MM-DD" onchange="_maFilter.dateFrom=this.value;render()"></div>';
  html += '<div class="fg"><label>ถึง</label><input type="text" class="fm-input dp" value="' + (_maFilter.dateTo||'') + '" placeholder="YYYY-MM-DD" onchange="_maFilter.dateTo=this.value;render()"></div>';
  html += '<button class="btn bo" onclick="_maFilter={status:\'all\',dealerId:\'\',dateFrom:\'\',dateTo:\'\'};render()">✖️ ล้าง</button>';
  html += '</div></div>';

  // Table
  html += '<div class="card"><div class="export-wrap" style="overflow-x:auto"><table class="export-table" style="width:100%">';
  html += '<thead><tr><th>#</th><th>เลขที่</th><th>Dealer</th><th>Project</th><th>Status</th><th>วันที่</th><th style="text-align:right">Revenue (ExVAT)</th><th style="text-align:right">ต้นทุน</th><th style="text-align:right">กำไร</th><th style="text-align:right">Margin%</th></tr></thead><tbody>';

  if (!rows.length) {
    html += '<tr><td colspan="10" style="text-align:center;padding:24px;opacity:.5">ไม่พบข้อมูล</td></tr>';
  } else {
    rows.forEach(function(r, idx) {
      var q = r.q;
      var mColor = r.margin >= 10 ? '#22c55e' : (r.margin >= 5 ? '#f59e0b' : '#ef4444');
      var hasCost = r.totalCost > 0;
      html += '<tr style="cursor:pointer" onclick="renderEditQuotationPage(getQuoteById(\'' + q.id + '\'))">';
      html += '<td class="pipe-row-num">' + (idx+1) + '</td>';
      html += '<td style="font-weight:600">' + sanitize(q.quoteNo) + '</td>';
      html += '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(q.dealerName || '') + '">' + sanitize(q.dealerName || '-') + '</td>';
      html += '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + sanitize(q.projectName || '') + '">' + sanitize(q.projectName || '-') + '</td>';
      html += '<td>' + (sLabels[q.status] || q.status) + '</td>';
      html += '<td style="white-space:nowrap">' + (q.validFrom || '-') + '</td>';
      html += '<td style="text-align:right">' + formatNumber(Math.round(r.revenue)) + '</td>';
      html += '<td style="text-align:right;color:#f59e0b">' + (hasCost ? formatNumber(Math.round(r.totalCost)) : '<span style="opacity:.3">-</span>') + '</td>';
      html += '<td style="text-align:right;color:' + (r.grossProfit >= 0 ? '#22c55e' : '#ef4444') + '">' + (hasCost ? formatNumber(Math.round(r.grossProfit)) : '<span style="opacity:.3">-</span>') + '</td>';
      html += '<td style="text-align:right;font-weight:700;color:' + mColor + '">' + (hasCost ? r.margin.toFixed(1) + '%' : '<span style="opacity:.3">-</span>') + '</td>';
      html += '</tr>';
    });
    // Totals row
    html += '<tr style="font-weight:800;border-top:2px solid var(--accent)">';
    html += '<td colspan="6">รวม</td>';
    html += '<td style="text-align:right">' + formatNumber(Math.round(sumRev)) + '</td>';
    html += '<td style="text-align:right;color:#f59e0b">' + formatNumber(Math.round(sumCost)) + '</td>';
    html += '<td style="text-align:right;color:' + (sumProfit >= 0 ? '#22c55e' : '#ef4444') + '">' + formatNumber(Math.round(sumProfit)) + '</td>';
    html += '<td style="text-align:right;color:' + marColor + '">' + avgMargin.toFixed(1) + '%</td>';
    html += '</tr>';
  }
  html += '</tbody></table></div></div></div>';

  el.innerHTML = html;
  if (typeof initDatePickers === 'function') initDatePickers();
}

// ================================================================
// INITIALIZE
// ================================================================

loadQuotations();