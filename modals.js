// ================================================================
// MODALS.JS - ALL MODAL DIALOGS (UPDATED TO USE Products MODULE)
// ================================================================
// ================================================================
// GET ALL MODELS WITH PRICES (เฉพาะ Admin - สำหรับแสดงราคาใน dropdown)
// ================================================================
function getAllModelsWithPricesForAdmin() {
  var products = [];
  
  // 1. ดึงจาก Products module (มีราคา RRP Ex Vat)
  if (typeof Products !== 'undefined' && Products.getAll) {
    products = Products.getAll();
    if (products.length) {
      return products.filter(function(p) { return p && p.name; });
    }
  }
  
  // 2. Fallback: ดึงจาก v7_products โดยตรง
  try {
    var saved = localStorage.getItem('v7_products');
    if (saved) {
      var parsed = JSON.parse(saved);
      var rawProducts = [];
      if (Array.isArray(parsed)) rawProducts = parsed;
      else if (parsed && Array.isArray(parsed.models)) rawProducts = parsed.models;
      else if (parsed && typeof parsed === 'object') {
        var vals = Object.values(parsed);
        if (vals.length && vals[0] && vals[0].id) rawProducts = vals;
      }
      if (rawProducts.length) return rawProducts;
    }
  } catch(e) {}
  
  // 3. Fallback สุดท้าย: ดึงจาก config.models
  var cfg = getConfig();
  var cfgModels = cfg.models || [];
  return cfgModels.map(function(m) {
    return typeof m === 'object' ? m : { name: m, price: 0, rrpExVat: 0 };
  });
}

// สร้าง datalist HTML สำหรับ Admin (แสดงราคา)
function buildAdminModelDatalist(datalistId) {
  var products = getAllModelsWithPricesForAdmin();
  var html = '<datalist id="' + datalistId + '">';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var name = p.name || '';
    if (!name) continue;
    var price = p.rrpExVat || p.price || 0;
    var label = name + (price > 0 ? ' (฿' + fmtMoney(price) + ')' : '');
    html += '<option value="' + sanitize(name) + '">' + sanitize(label) + '</option>';
  }
  html += '</datalist>';
  return html;
}
// ================================================================
// GET ALL MODELS FROM PRODUCTS (for datalist)
// ================================================================
function getAllModelsFromProducts() {
  var models = [];
  // 1. ลองจาก products.js
  if (typeof Products !== 'undefined' && Products.getAll) {
    var products = Products.getAll();
    for (var i = 0; i < products.length; i++) {
      if (products[i] && products[i].name) models.push(products[i].name);
    }
    if (models.length) return models;
  }
  // 2. ลองจาก v7_products โดยตรง
  try {
    var saved = localStorage.getItem('v7_products');
    if (saved) {
      var parsed = JSON.parse(saved);
      var products2 = [];
      if (Array.isArray(parsed)) products2 = parsed;
      else if (parsed && Array.isArray(parsed.models)) products2 = parsed.models;
      else if (parsed && typeof parsed === 'object') {
        var vals = Object.values(parsed);
        if (vals.length && vals[0] && vals[0].id) products2 = vals;
      }
      for (var i = 0; i < products2.length; i++) {
        if (products2[i] && products2[i].name) models.push(products2[i].name);
      }
      if (models.length) return models;
    }
  } catch(e) {}
  // 3. Fallback จาก config
  var cfg = getConfig();
  var cfgModels = cfg.models || [];
  for (var i = 0; i < cfgModels.length; i++) {
    var m = cfgModels[i];
    var name = typeof m === 'object' ? m.name : m;
    if (name) models.push(name);
  }
  return models;
}
// ================================================================
// SAFE MODEL OPTIONS (ใช้ products module ถ้ามี)
// ================================================================

function safeModelOptions(selected) {
  if (typeof window.modelOptionsNew === 'function') {
    return window.modelOptionsNew(selected);
  }
  // Fallback 1: อ่านจาก v7_products โดยตรง
  var models = [];
  try {
    var saved = localStorage.getItem('v7_products');
    if (saved) {
      var parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        models = parsed;
      } else if (parsed && Array.isArray(parsed.models)) {
        models = parsed.models;
      } else if (parsed && typeof parsed === 'object') {
        var vals = Object.values(parsed);
        if (vals.length && vals[0] && vals[0].id) models = vals;
      }
    }
  } catch(e) {}
  // Fallback 2: อ่านจาก v7_config.models ถ้า v7_products ว่าง
  if (!models.length) {
    try {
      var cfgRaw = localStorage.getItem('v7_config');
      if (cfgRaw) {
        var cfgObj = JSON.parse(cfgRaw);
        if (cfgObj && Array.isArray(cfgObj.models)) models = cfgObj.models;
      }
    } catch(e) {}
  }
  // Fallback 3: getConfig() ถ้ายังว่าง
  if (!models.length && typeof getConfig === 'function') {
    var cfg = getConfig();
    models = cfg.models || [];
  }
  var html = '<option value="">-- เลือก Model --</option>';
  for (var i = 0; i < models.length; i++) {
    var m = models[i];
    if (!m) continue;
    var name = typeof m === 'object' ? m.name : m;
    if (!name) continue;
    var price = typeof m === 'object' ? (m.rrpExVat || m.price || 0) : 0;
    var label = name + (price > 0 ? ' (฿' + fmtMoney(price) + ')' : '');
    html += '<option value="' + sanitize(name) + '"' + (selected === name ? ' selected' : '') + '>' + sanitize(label) + '</option>';
  }
  return html;
}

// ================================================================
// DEALER MODAL
// ================================================================
function showDealerM(eid) {
  var d = eid ? ST.getOne('dealers', eid) : {};
  var cfg = getConfig();
  openM(eid ? '✏️ Dealer' : '➕ เพิ่ม Dealer', '' +
    '<div class="form-section">🏢 ข้อมูลบริษัท</div>' +
    '<div class="fg"><label>ชื่อบริษัท *</label><input type="text" id="fd_name" value="' + sanitize(d.name || '') + '"></div>' +
    '<div class="fr"><div class="fg"><label>SIS Code</label><input type="text" id="fd_sis" value="' + (d.sisCode || '') + '"></div>' +
    '<div class="fg"><label>DJI Code</label><input type="text" id="fd_dji" value="' + (d.djiCode || '') + '"></div></div>' +
    '<div class="fr"><div class="fg"><label>Level *</label><select id="fd_level">' + optionsHTML(cfg.dealerLevels, d.level || 'B', '-- เลือก --') + '</select></div>' +
    '<div class="fg"><label>โชว์ซีเรียล</label><select id="fd_serial"><option value="Y"' + ((d.showSerial || 'Y') === 'Y' ? ' selected' : '') + '>Y</option><option value="N"' + (d.showSerial === 'N' ? ' selected' : '') + '>N</option></select></div></div>' +
    '<div class="fr"><div class="fg"><label>DJI Dealer</label><select id="fd_djid">' + optionsHTML(cfg.djiDealerTypes, d.djiDealer, '--') + '</select></div>' +
    '<div class="fg"><label>Term</label><select id="fd_term">' + optionsHTML(cfg.creditTerms, d.creditTerm, '--') + '</select></div></div>' +
    '<div class="fr"><div class="fg"><label>วงเงินเครดิต (฿)</label><input type="text" inputmode="decimal" class="js-money" id="fd_credit" value="' + nmI(d.creditLimit || '') + '"></div>' +
    '<div class="fg"><label>เป้ายอดขาย (฿)</label><input type="text" inputmode="decimal" class="js-money" id="fd_target" value="' + nmI(d.targetRevenue || '') + '"></div></div>' +
    '<div class="fg"><label>เงื่อนไขชำระเงิน</label><textarea id="fd_payment" rows="2">' + sanitize(d.paymentCondition || '') + '</textarea></div>' +
    '<div class="form-section">👤 ผู้ติดต่อ</div>' +
    '<div class="fg"><label>ผู้ติดต่อ</label><textarea id="fd_contact" rows="3">' + sanitize(d.contact || '') + '</textarea></div>' +
    '<div class="fg"><label>รายละเอียดลูกค้า</label><textarea id="fd_detail" rows="2">' + sanitize(d.customerDetail || '') + '</textarea></div>' +
    '<div class="fr"><div class="fg"><label>Shippto</label><input type="text" id="fd_ship" value="' + (d.shippto || 'NO') + '"></div>' +
    '<div class="fg"><label>📍 Google Map</label><input type="url" id="fd_map" value="' + (d.googleMap || '') + '"></div></div>' +
    '<div class="form-section">📋 Certification</div>' +
    '<div class="fr"><div class="fg"><label>หนังสือแต่งตั้ง</label><select id="fd_appt">' + optionsHTML(cfg.appointmentOptions, d.appointmentLetter, '--') + '</select></div>' +
    dpH('fd_apptdate', d.appointmentDate || '', 'วันแต่งตั้ง') + '</div>' +
    '<div class="fr"><div class="fg"><label>DSEC</label><select id="fd_dsec"><option value="">--</option><option value="pass"' + (d.dsecStatus === 'pass' ? ' selected' : '') + '>ผ่าน</option><option value="fail"' + (d.dsecStatus === 'fail' ? ' selected' : '') + '>ไม่ผ่าน</option><option value="pending"' + (d.dsecStatus === 'pending' ? ' selected' : '') + '>ยังไม่ทำ</option></select></div>' +
    '<div class="fg"><label>DSEC cert</label><input type="number" id="fd_dsec_n" value="' + (d.dsecCertCount || '') + '"></div></div>' +
    '<div class="fr"><div class="fg"><label>CRM</label><select id="fd_crm"><option value="">--</option><option value="yes"' + (d.crmStatus === 'yes' ? ' selected' : '') + '>ลงทะเบียนแล้ว</option><option value="no"' + (d.crmStatus === 'no' ? ' selected' : '') + '>ยังไม่ลง</option></select></div>' +
    '<div class="fg"><label>FH2</label><select id="fd_fh2"><option value="">--</option><option value="pass"' + (d.fh2Status === 'pass' ? ' selected' : '') + '>ผ่าน</option><option value="fail"' + (d.fh2Status === 'fail' ? ' selected' : '') + '>ไม่ผ่าน</option><option value="pending"' + (d.fh2Status === 'pending' ? ' selected' : '') + '>ยังไม่ทำ</option></select></div></div>' +
    '<div class="fr"><div class="fg"><label>FH2 cert</label><input type="number" id="fd_fh2_n" value="' + (d.fh2CertCount || '') + '"></div>' +
    '<div class="fg"><label>Lark</label><select id="fd_lark"><option value="">--</option><option value="added"' + (d.larkStatus === 'added' ? ' selected' : '') + '>Add แล้ว</option><option value="no"' + (d.larkStatus === 'no' ? ' selected' : '') + '>ยังไม่ Add</option></select></div></div>' +
    '<div class="fr"><div class="fg"><label>Demo Unit</label><input type="text" id="fd_demo" value="' + sanitize(d.demoUnit || '') + '"></div>' +
    '<div class="fg"><label>กลุ่มลูกค้าหลัก</label><input type="text" id="fd_segment" value="' + sanitize(d.customerSegment || '') + '"></div></div>' +
    '<div class="fg"><label>Dock Interest</label><select id="fd_dock"><option value="">--</option><option value="yes"' + (d.dockInterest === 'yes' ? ' selected' : '') + '>มี</option><option value="no"' + (d.dockInterest === 'no' ? ' selected' : '') + '>ไม่มี</option><option value="กำลังดู"' + (d.dockInterest === 'กำลังดู' ? ' selected' : '') + '>กำลังดู</option></select></div>' +
    '<div class="fg"><label>Pipeline Stage</label><select id="fd_pipe">' + optionsHTML(cfg.pipelineStatuses, d.pipelineStage || 'prospect') + '</select></div>' +
    '<div class="fg"><label>หมายเหตุ</label><textarea id="fd_notes" rows="2">' + sanitize(d.notes || '') + '</textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveDealer(\'' + (eid || '') + '\')">💾 บันทึก</button>');
}

async function saveDealer(eid) {
  var data = {
    name: document.getElementById('fd_name').value.trim(),
    sisCode: document.getElementById('fd_sis').value.trim(),
    djiCode: document.getElementById('fd_dji').value.trim(),
    level: document.getElementById('fd_level').value,
    showSerial: document.getElementById('fd_serial').value,
    djiDealer: document.getElementById('fd_djid').value,
    creditTerm: document.getElementById('fd_term').value,
    creditLimit: parseNum(document.getElementById('fd_credit').value),
    targetRevenue: parseNum(document.getElementById('fd_target').value),
    paymentCondition: document.getElementById('fd_payment').value.trim(),
    contact: document.getElementById('fd_contact').value.trim(),
    customerDetail: document.getElementById('fd_detail').value.trim(),
    shippto: document.getElementById('fd_ship').value.trim(),
    googleMap: document.getElementById('fd_map').value.trim(),
    appointmentLetter: document.getElementById('fd_appt').value,
    appointmentDate: dpG('fd_apptdate'),
    dsecStatus: document.getElementById('fd_dsec').value,
    dsecCertCount: document.getElementById('fd_dsec_n').value,
    crmStatus: document.getElementById('fd_crm').value,
    fh2Status: document.getElementById('fd_fh2').value,
    fh2CertCount: document.getElementById('fd_fh2_n').value,
    larkStatus: document.getElementById('fd_lark').value,
    demoUnit: document.getElementById('fd_demo').value.trim(),
    customerSegment: document.getElementById('fd_segment').value.trim(),
    dockInterest: document.getElementById('fd_dock').value,
    pipelineStage: document.getElementById('fd_pipe').value,
    notes: document.getElementById('fd_notes').value.trim()
  };
  
  if (!data.name) return alert('ใส่ชื่อบริษัท');
  
  if (eid) {
    ST.update('dealers', eid, data);
    // ✅ Audit Log
    if (typeof addAuditLog === 'function') {
      addAuditLog('update_dealer', 'dealer', eid, data.name, eid, data.name, {});
    }
    
    // ✅ เพิ่ม sync ไป Firebase (ให้ client-view ดึงไปใช้)
    if (typeof syncDealerToFirebase === 'function') {
      await syncDealerToFirebase(eid);
    }
    if (typeof syncAllPipelinesToFirebase === 'function') {
      await syncAllPipelinesToFirebase(eid);
    }
    
    closeMForce();
    go('dealerDetail', {dealerId: eid});
  } else {
    var c = ST.add('dealers', data);
    // ✅ Audit Log
    if (typeof addAuditLog === 'function') {
      addAuditLog('create_dealer', 'dealer', c.id, data.name, c.id, data.name, {});
    }
    
    // ✅ เพิ่ม sync ไป Firebase (ให้ client-view ดึงไปใช้)
    if (typeof syncDealerToFirebase === 'function') {
      await syncDealerToFirebase(c.id);
    }
    
    closeMForce();
    go('dealerDetail', {dealerId: c.id});
  }
  
  toast('💾 บันทึกแล้ว');
}

// ================================================================
// PIPELINE MODAL (Multi-Model) - UPDATED TO USE Products MODULE
// ================================================================
var pipeItemsTemp = [];
var pipeItemMode = 'items';

function showPipelineM(dealerId, eid) {
  var p = eid ? ST.getOne('pipeline', eid) : {};
  var cfg = getConfig();
  
  // Load existing items
  if (eid && p.items && p.items.length > 0) {
    pipeItemsTemp = JSON.parse(JSON.stringify(p.items));
    pipeItemMode = 'items';
  } else if (eid && p.model) {
    pipeItemsTemp = [{model: p.model, qty: Number(p.modelQty) || 1, price: window.getModelPrice(p.model), total: Number(p.forecastAmount) || 0}];
    pipeItemMode = 'lump';
  } else {
    pipeItemsTemp = [];
    pipeItemMode = 'items';
  }

  openM(eid ? '✏️ Pipeline' : '➕ เพิ่ม Pipeline', '' +
    dpH('fp_reg', p.registerDate || _td(), 'Register Date') +
    '<div class="fg"><label>Project Name *</label><textarea id="fp_name" rows="2">' + sanitize(p.projectName || '') + '</textarea></div>' +
    '<div class="fr"><div class="fg"><label>End User (TH)</label><input type="text" id="fp_eu_th" value="' + sanitize(p.endUserTH || '') + '"></div>' +
    '<div class="fg"><label>End User (EN)</label><input type="text" id="fp_eu_en" value="' + sanitize(p.endUserEN || '') + '"></div></div>' +
    '<div class="fr"><div class="fg"><label>🏛️ หน่วยงานใหญ่</label><input type="text" id="fp_agency_main" value="' + sanitize(p.agencyMain || '') + '" placeholder="เช่น กรม/กระทรวง/บริษัทแม่"></div>' +
    '<div class="fg"><label>หน่วยงานย่อย</label><input type="text" id="fp_agency_sub" value="' + sanitize(p.agencySub || '') + '" placeholder="เช่น กอง/สำนัก/สาขา"></div></div>' +
    '<div class="fr"><div class="fg"><label>Unit Type</label><select id="fp_unit">' + optionsHTML(cfg.unitTypes, p.unitType, '--') + '</select></div>' +
    '<div class="fg"><label>Dealer *</label><select id="fp_dealer">' + dealerOptions(dealerId || p.dealerId) + '</select></div></div>' +
    '<div class="fr"><div class="fg"><label>DJI Dealer</label><select id="fp_djid">' + optionsHTML(cfg.djiDealerTypes, p.djiDealer, '--') + '</select></div>' +
    '<div class="fg"><label>Status</label><select id="fp_status">' + optionsHTML(cfg.pipelineStatuses, p.status || 'prospect') + '</select></div></div>' +

    // ---- Model & Forecast Section ----
    '<div class="form-section">📦 สินค้าและมูลค่า</div>' +
    '<div style="display:flex;gap:4px;margin-bottom:8px">' +
    '<button class="btn bsm ' + (pipeItemMode === 'items' ? 'bp' : 'bo') + '" onclick="switchPipeMode(\'items\')">📦 รายชิ้น</button>' +
    '<button class="btn bsm ' + (pipeItemMode === 'lump' ? 'bp' : 'bo') + '" onclick="switchPipeMode(\'lump\')">💰 มูลค่ารวม</button>' +
    '</div>' +

    '<div id="pipeItemsSection">' + buildPipeItemsSection(p) + '</div>' +

    // ---- Other Fields ----
    '<div class="fr"><div class="fg"><label>Real Amount (฿)</label><input type="text" inputmode="decimal" class="js-money" id="fp_real" value="' + nmI(p.realAmount || '') + '"></div>' +
    '<div class="fg"><label>TOR</label><select id="fp_tor">' + optionsHTML(cfg.torOptions, p.tor || 'Open') + '</select></div></div>' +
    '<div class="fr">' + dpH('fp_bid', p.biddingDate || '', 'Bidding Date') + dpH('fp_ship', p.shipmentDate || '', 'Shipment Date') + '</div>' +
    '<div class="fr">' + dpH('fp_close', p.expectedCloseDate || '', '🎯 Expected Close Date (คาดปิดดีล/ได้ PO)') + '<div class="fg"></div></div>' +
    '<div class="fr"><div class="fg"><label>หนังสือแต่งตั้ง</label><select id="fp_appt">' + optionsHTML(cfg.appointmentOptions, p.appointmentLetter, '--') + '</select></div>' +
    '<div class="fg"></div></div>' +
    '<div class="form-section">🏛️ ปีงบประมาณ</div>' +
    '<div class="fr"><div class="fg"><label>ปีงบประมาณของโครงการ</label><select id="fp_fy">' + fyOptionsHTML(p.budgetFiscalYear, thaiFYFromISO(p.expectedCloseDate || p.biddingDate)) + '</select></div>' +
    '<div class="fg"></div></div>' +
    '<div class="form-section">🗂️ CRM & คู่แข่ง</div>' +
    '<div class="fr"><div class="fg"><label><input type="checkbox" id="fp_crm"' + (p.djiCrmRegistered ? ' checked' : '') + ' onchange="document.getElementById(\'fp_crmdate_wrap\').style.display=this.checked?\'\':\'none\'"> ลงทะเบียน CRM ของ DJI แล้ว</label></div>' +
    '<div id="fp_crmdate_wrap" style="flex:1;' + (p.djiCrmRegistered ? '' : 'display:none') + '">' + dpH('fp_crmdate', p.djiCrmDate || '', 'วันที่ลงทะเบียน') + '</div></div>' +
    '<div class="fr"><div class="fg"><label><input type="checkbox" id="fp_comp"' + (p.hasCompetitor ? ' checked' : '') + ' onchange="document.getElementById(\'fp_compname_wrap\').style.display=this.checked?\'\':\'none\'"> คาดว่ามีคู่แข่ง</label></div>' +
    '<div class="fg" id="fp_compname_wrap" style="' + (p.hasCompetitor ? '' : 'display:none') + '"><label>ชื่อคู่แข่ง 🔒 (ภายใน — dealer ไม่เห็น)</label><input type="text" id="fp_compname" value="' + sanitize(p.competitorName || '') + '" placeholder="ชื่อคู่แข่ง / รายละเอียด"></div></div>' +
    '<div class="form-section">📊 ข้อมูลสำหรับ Google Sheet 🔒 (ภายใน — dealer ไม่เห็น)</div>' +
    '<div class="fr"><div class="fg"><label>Project Revenue (฿)</label><input type="text" inputmode="decimal" class="js-money" id="fp_projrev" value="' + nmI(p.projectRevenue || '') + '" placeholder="มูลค่ารวมทั้งโปรเจกต์ (DJI+Service+อื่นๆ)"></div>' +
    '<div class="fg"><label>Sale (ผู้รับผิดชอบ)</label><input type="text" id="fp_sale" value="' + sanitize(eid ? (p.saleName || '') : (typeof CURRENT_USER !== 'undefined' && CURRENT_USER ? (CURRENT_USER.displayName || CURRENT_USER.email || '') : '')) + '"></div></div>' +
    '<div class="fg"><label>แสดงใน Google Sheet</label><div class="radio-g"><label><input type="radio" name="fp_disp" value="Show"' + (p.sheetDisplay !== 'Hide' ? ' checked' : '') + '><span>Show</span></label><label><input type="radio" name="fp_disp" value="Hide"' + (p.sheetDisplay === 'Hide' ? ' checked' : '') + '><span>Hide</span></label></div></div>' +
    '<div class="form-section">🎯 Next Action</div>' +
    '<div class="fr"><div class="fg"><label>ต้องทำอะไรต่อ</label><select id="fp_next"><option value="">-- ไม่ระบุ --</option>' + cfg.pipelineNextActions.map(function(a) { return '<option value="' + a + '"' + (p.nextAction === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div>' +
    dpH('fp_fudate', p.followupDate || '', 'Follow-up Date') + '</div>' +
    '<div class="fg"><label>งานซ้ำ</label><div class="radio-g"><label><input type="radio" name="fp_rec" value="0"' + (!p.recurring ? ' checked' : '') + '><span>ไม่ใช่</span></label><label><input type="radio" name="fp_rec" value="1"' + (p.recurring ? ' checked' : '') + '><span>ใช่</span></label></div></div>' +
    '<div class="fg"><label>Remark</label><textarea id="fp_remark" rows="2">' + sanitize(p.remark || '') + '</textarea></div>' +
    '<button class="btn bp btn-full" onclick="savePipeline(\'' + (dealerId || '') + '\',\'' + (eid || '') + '\')">💾 บันทึก</button>');
}

function switchPipeMode(mode) {
  pipeItemMode = mode;
  var el = document.getElementById('pipeItemsSection');
  if (el) el.innerHTML = buildPipeItemsSection({});
}

function buildPipeItemsSection(p) {
  var h = '';

  if (pipeItemMode === 'items') {
    var modelDatalistId = 'globalModelList_' + Date.now();
    
    h += '<div class="pipe-qa-row">';
    h += '<input type="text" id="pqa_model" class="pipe-qa-model" list="' + modelDatalistId + '" placeholder="พิมพ์ชื่อสินค้า..." autocomplete="off" onchange="pqaModelChanged()" oninput="pqaModelChanged()">';
    h += buildAdminModelDatalist(modelDatalistId);
    h += '<input type="number" id="pqa_qty" class="pipe-qa-qty" value="1" min="1" placeholder="QTY">';
    h += '<input type="text" inputmode="decimal" id="pqa_price" class="pipe-qa-price js-money" placeholder="ราคา/ชิ้น">';
    h += '<button class="btn bp bsm" onclick="pqaAdd()">➕</button>';
    h += '<button class="btn bo bsm" onclick="openProductPicker({showPrice:true, onAdd:pickerAddToPipe})" title="เลือกจากแคตตาล็อก (แนะนำ/ค้นหา/หมวดหมู่)">📋 แคตตาล็อก</button>';
    h += '</div>';

    // ส่วน Items List — แสดงรายการที่เพิ่ม + แก้จำนวน inline + ลบ
    var itemModelListId = 'pipeItemModelList_' + Date.now();
    h += buildAdminModelDatalist(itemModelListId);
    if (pipeItemsTemp.length > 0) {
      h += '<div style="margin-top:8px">';
      for (var ii = 0; ii < pipeItemsTemp.length; ii++) {
        var it = pipeItemsTemp[ii];
        var lineTotal = (Number(it.qty) || 1) * (Number(it.price) || 0);
        h += '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid rgba(127,127,127,0.2)">';
        h += '<input type="text" list="' + itemModelListId + '" value="' + sanitize(it.model) + '" onchange="pqaUpdateModel(' + ii + ', this.value)" style="flex:1;min-width:0;font-size:.82rem" title="แก้สินค้า" autocomplete="off">';
        h += '<input type="number" min="1" value="' + (Number(it.qty) || 1) + '" onchange="pqaUpdateQty(' + ii + ', this.value)" style="width:56px" title="แก้จำนวน">';
        h += '<span id="pqitot_' + ii + '" style="width:84px;text-align:right;opacity:.65;font-size:12px;flex-shrink:0">฿' + fmtMoneyShort(lineTotal) + '</span>';
        h += '<button class="btn bd bsm" onclick="pqaRemove(' + ii + ')" title="ลบ">🗑️</button>';
        h += '</div>';
      }
      h += '</div>';
    } else {
      h += '<div style="margin-top:8px;padding:10px;text-align:center;opacity:.55;font-size:13px">ยังไม่มีสินค้า — พิมพ์/กด 📋 เพื่อเพิ่ม</div>';
    }

    // มูลค่ารวม (Forecast Amount) — คำนวณจากรายการ แก้ได้
    var _grand = 0;
    for (var gi = 0; gi < pipeItemsTemp.length; gi++) _grand += (Number(pipeItemsTemp[gi].qty) || 1) * (Number(pipeItemsTemp[gi].price) || 0);
    h += '<div class="fg" style="margin-top:8px"><label>💰 มูลค่ารวม (Forecast Amount) ฿</label><input type="text" inputmode="decimal" class="js-money" id="fp_fc" value="' + nmI(_grand || (p && p.forecastAmount) || '') + '" placeholder="คำนวณจากรายการ — แก้ได้"></div>';

  } else {
    // Lump sum mode
    var lumpDatalistId = 'lumpModelList_' + Date.now();
    h += '<div class="fr"><div class="fg"><label>Model</label>';
    h += '<input type="text" id="fp_model_lump" list="' + lumpDatalistId + '" value="' + sanitize(p.model || (pipeItemsTemp.length ? pipeItemsTemp[0].model : '')) + '" placeholder="พิมพ์ชื่อสินค้า..." autocomplete="off">';
    h += buildAdminModelDatalist(lumpDatalistId);
    h += '<button class="btn bo bsm" type="button" onclick="openProductPicker({showPrice:true, onAdd:pickerSetLump})" title="เลือกจากแคตตาล็อก" style="margin-top:4px">📋 แคตตาล็อก</button>';
    h += '</div>';
    h += '<div class="fg"><label>Model QTY</label><input type="number" id="fp_qty_lump" value="' + (p.modelQty || (pipeItemsTemp.length ? pipeItemsTemp[0].qty : 1)) + '" min="1"></div></div>';
    h += '<div class="fg"><label>Forecast Amount (฿)</label><input type="text" inputmode="decimal" class="js-money" id="fp_fc" value="' + nmI(p.forecastAmount || '') + '"></div>';
  }
  return h;
}
// Quick Add functions - ใช้ window.getModelPrice
function pqaModelChanged() {
  var modelInput = document.getElementById('pqa_model');
  var modelName = modelInput ? modelInput.value : '';
  var priceEl = document.getElementById('pqa_price');
  if (priceEl && modelName) {
    var price = 0;
    if (typeof window.getModelRrpExVat === 'function') {
      price = window.getModelRrpExVat(modelName);
    }
    if (price === 0 && typeof window.getModelPrice === 'function') {
      price = window.getModelPrice(modelName);
    }
    if (price > 0) priceEl.value = nmI(price);
  }
}
function pqaAdd() {
  var modelInput = document.getElementById('pqa_model');
  var model = modelInput ? modelInput.value.trim() : '';
  var qty = parseInt(document.getElementById('pqa_qty').value) || 1;
  var priceEl = document.getElementById('pqa_price');
  var price = priceEl ? parseNum(priceEl.value) : 0;
  
  if (!model) { toast('เลือก Model ก่อน'); return; }
  
  var total = qty * price;
  pipeItemsTemp.push({model: model, qty: qty, price: price, total: total});
  if (typeof addRecentModel === 'function') addRecentModel(model);

  var el = document.getElementById('pipeItemsSection');
  if (el) el.innerHTML = buildPipeItemsSection({});
  
  updatePipeFcFromItems();
  
  if (modelInput) modelInput.value = '';
  document.getElementById('pqa_qty').value = '1';
  if (priceEl) priceEl.value = '';
  
  toast('➕ เพิ่ม ' + model + ' x' + qty);
}
function pqaRemove(idx) {
  pipeItemsTemp.splice(idx, 1);
  var el = document.getElementById('pipeItemsSection');
  if (el) el.innerHTML = buildPipeItemsSection({});
  updatePipeFcFromItems();
}
function pqaUpdateQty(idx, val) {
  if (!pipeItemsTemp[idx]) return;
  var q = parseInt(val, 10) || 1;
  if (q < 1) q = 1;
  pipeItemsTemp[idx].qty = q;
  pipeItemsTemp[idx].total = q * (Number(pipeItemsTemp[idx].price) || 0);
  var totEl = document.getElementById('pqitot_' + idx);
  if (totEl) totEl.textContent = '฿' + fmtMoneyShort(pipeItemsTemp[idx].total);
  updatePipeFcFromItems();
}
function pqaUpdateModel(idx, newModel) {
  if (!pipeItemsTemp[idx]) return;
  newModel = newModel.trim();
  if (!newModel) return;
  pipeItemsTemp[idx].model = newModel;
  var newPrice = 0;
  if (typeof window.getModelRrpExVat === 'function') newPrice = window.getModelRrpExVat(newModel);
  if (!newPrice && typeof window.getModelPrice === 'function') newPrice = window.getModelPrice(newModel);
  if (newPrice > 0) pipeItemsTemp[idx].price = newPrice;
  pipeItemsTemp[idx].total = (Number(pipeItemsTemp[idx].qty) || 1) * (Number(pipeItemsTemp[idx].price) || 0);
  var totEl = document.getElementById('pqitot_' + idx);
  if (totEl) totEl.textContent = '฿' + fmtMoneyShort(pipeItemsTemp[idx].total);
  updatePipeFcFromItems();
}
function pickerSetLump(model, qty, price) {
  var mi = document.getElementById('fp_model_lump');
  var qi = document.getElementById('fp_qty_lump');
  var fc = document.getElementById('fp_fc');
  if (mi) mi.value = model;
  if (qi) qi.value = qty || 1;
  if (fc && price) fc.value = nmI((qty || 1) * price);
  if (typeof addRecentModel === 'function') addRecentModel(model);
  toast('➕ เลือก ' + model);
  ppFlash('✅ เลือก ' + model + ' แล้ว');
}

function updatePipeFcFromItems() {
  var total = 0;
  for (var i = 0; i < pipeItemsTemp.length; i++) {
    var it = pipeItemsTemp[i];
    total += (Number(it.qty) || 1) * (Number(it.price) || 0);
  }
  var fcEl = document.getElementById('fp_fc');
  if (fcEl && total > 0) fcEl.value = nmI(total);
}

// ================================================================
// PRODUCT PICKER (กล่องเลือกสินค้า) — reusable component
// เรียก: openProductPicker({ dealerId, showPrice, onAdd(model, qty, price) })
// client-view/forecast ใช้ตัวนี้ได้ภายหลังโดยส่ง showPrice:false
// ================================================================
var _ppState = { showPrice: true, onAdd: null, dealerId: '', search: '' };
var _ppRefs = [];

// แสดงข้อความยืนยันในกล่องแคตตาล็อกเอง (เห็นง่ายขณะกล่องเปิดอยู่)
function ppFlash(msg) {
  var ov = document.getElementById('productPickerOv');
  if (!ov) return;
  var f = document.getElementById('ppFlashEl');
  if (!f) { f = document.createElement('div'); f.id = 'ppFlashEl'; ov.appendChild(f); }
  f.textContent = msg;
  f.setAttribute('style', 'position:absolute;top:14px;left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;padding:8px 16px;border-radius:10px;font-size:13px;z-index:100001;box-shadow:0 2px 10px rgba(0,0,0,.35);max-width:90%');
  f.style.display = 'block';
  clearTimeout(ppFlash._t);
  ppFlash._t = setTimeout(function () { if (f) f.style.display = 'none'; }, 1500);
}

// callback สำหรับหน้า pipeline: ดันเข้า pipeItemsTemp
function pickerAddToPipe(model, qty, price) {
  var total = (Number(qty) || 1) * (Number(price) || 0);
  pipeItemsTemp.push({ model: model, qty: Number(qty) || 1, price: Number(price) || 0, total: total });
  addRecentModel(model);
  var el = document.getElementById('pipeItemsSection');
  if (el) el.innerHTML = buildPipeItemsSection({});
  updatePipeFcFromItems();
  toast('➕ เพิ่ม ' + model + ' x' + (Number(qty) || 1));
  ppFlash('✅ เพิ่ม ' + model + ' x' + (Number(qty) || 1) + ' แล้ว');
}

// ---------- ข้อมูล "แนะนำ / เพิ่งใช้ / ขายดี" ----------
function getRecentModels() {
  try { var a = JSON.parse(localStorage.getItem('v7_recent_models') || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function addRecentModel(name) {
  if (!name) return;
  var a = getRecentModels().filter(function (x) { return x !== name; });
  a.unshift(name);
  try { localStorage.setItem('v7_recent_models', JSON.stringify(a.slice(0, 8))); } catch (e) {}
}
function _ppCountModels(pipes) {
  var counts = {};
  (pipes || []).forEach(function (p) {
    var items = (typeof getPipeItems === 'function') ? getPipeItems(p) : (p.items || []);
    items.forEach(function (it) {
      if (it && it.model) counts[it.model] = (counts[it.model] || 0) + (Number(it.qty) || 1);
    });
  });
  return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
}
function getTopModels(limit) {
  return _ppCountModels(ST.getAll('pipeline')).slice(0, limit || 6);
}
function getRecommendedModels(dealerId, limit) {
  if (dealerId) {
    var byDealer = _ppCountModels(ST.pipelineByDealer(dealerId));
    if (byDealer.length) return byDealer.slice(0, limit || 6);
  }
  var rec = getRecentModels();
  if (rec.length) return rec.slice(0, limit || 6);
  return getTopModels(limit || 6);
}

// ---------- ราคา / ค้นหา ----------
function ppModelPrice(model) {
  var price = 0;
  if (typeof window.getModelRrpExVat === 'function') price = window.getModelRrpExVat(model) || 0;
  if (!price && typeof window.getModelPrice === 'function') price = window.getModelPrice(model) || 0;
  return price;
}
function ppMatch(prod, q) {
  if (!q) return true;
  var name = ((prod.name || '') + ' ' + (prod.sku || '')).toLowerCase().replace(/\s+/g, '');
  var tokens = q.toLowerCase().match(/[a-z]+|\d+/g) || [q.toLowerCase()];
  return tokens.every(function (t) { return name.indexOf(t) !== -1; });
}
function ppEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

// ---------- เปิด/ปิด/render ----------
function openProductPicker(opts) {
  opts = opts || {};
  _ppState.showPrice = opts.showPrice !== false;
  _ppState.onAdd = opts.onAdd || null;
  _ppState.dealerId = opts.dealerId ||
    (document.getElementById('fp_dealer') ? document.getElementById('fp_dealer').value : '');
  _ppState.search = '';
  var ov = document.getElementById('productPickerOv');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'productPickerOv';
    ov.onclick = function (e) { if (e.target === ov) closeProductPicker(); };
    document.body.appendChild(ov);
  }
  ov.setAttribute('style', 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px');
  pickerRender();
}
function closeProductPicker() {
  var ov = document.getElementById('productPickerOv');
  if (ov) ov.style.display = 'none';
}
function ppSearch(v) { _ppState.search = v || ''; pickerRenderList(); }
function ppDoAdd(model, qty) {
  if (_ppState.onAdd) _ppState.onAdd(model, Number(qty) || 1, ppModelPrice(model));
}
function ppPickModel(model) { ppDoAdd(model, 1); }
function ppPick(idx) {
  var model = _ppRefs[idx];
  var qel = document.getElementById('ppq_' + idx);
  ppDoAdd(model, qel ? (parseInt(qel.value, 10) || 1) : 1);
}
function _ppChip(model, bg, color) {
  return '<span onclick="ppPickModel(\'' + ppEsc(model) + '\')" style="cursor:pointer;font-size:12px;background:' + bg + ';color:' + color + ';padding:5px 10px;border-radius:8px">+ ' + sanitize(model) + '</span>';
}
function pickerRender() {
  var ov = document.getElementById('productPickerOv');
  if (!ov) return;
  ov.style.display = 'flex';
  var rec = getRecommendedModels(_ppState.dealerId, 6);
  var recent = getRecentModels().slice(0, 6);
  var chips = '';
  if (rec.length) {
    chips += '<div style="font-size:12px;color:#fbbf24;margin:2px 0 5px">⭐ รายการที่แนะนำ</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
    rec.forEach(function (m) { chips += _ppChip(m, '#3b2f0b', '#fbbf24'); });
    chips += '</div>';
  }
  if (recent.length) {
    chips += '<div style="font-size:12px;color:#8892b0;margin:2px 0 5px">🕘 เพิ่งใช้</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
    recent.forEach(function (m) { chips += _ppChip(m, '#1e293b', '#cbd5e1'); });
    chips += '</div>';
  }
  ov.innerHTML =
    '<div style="width:100%;max-width:560px;max-height:85vh;display:flex;flex-direction:column;background:#0f172a;border:1px solid #334155;border-radius:14px;overflow:hidden">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #1e293b">' +
        '<span style="font-size:15px;font-weight:700;color:#e0e6f0">📦 เลือกสินค้า</span>' +
        '<button onclick="closeProductPicker()" style="background:none;border:none;color:#8892b0;font-size:18px;cursor:pointer">✕</button>' +
      '</div>' +
      '<div style="padding:12px 16px;overflow-y:auto">' +
        '<input id="ppSearch" type="text" oninput="ppSearch(this.value)" placeholder="🔍 พิมพ์ชื่อ / SKU / M350..." autocomplete="off" style="width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e0e6f0;margin-bottom:10px">' +
        chips +
        '<div id="ppListWrap"></div>' +
      '</div>' +
    '</div>';
  pickerRenderList();
  var s = document.getElementById('ppSearch');
  if (s) s.focus();
}
function pickerRenderList() {
  var wrap = document.getElementById('ppListWrap');
  if (!wrap) return;
  _ppRefs = [];
  var all = (typeof getAllProducts === 'function') ? (getAllProducts() || []) : [];
  var cats = (typeof PRODUCT_CATEGORIES !== 'undefined') ? PRODUCT_CATEGORIES : [{ id: 'other', name: 'อื่นๆ' }];
  var q = _ppState.search;
  var html = '';
  var shown = 0;
  cats.forEach(function (cat) {
    var items = all.filter(function (pr) { return pr && !pr.eol && (pr.category || 'other') === cat.id && ppMatch(pr, q); });
    if (!items.length) return;
    html += '<div style="font-size:12px;color:#8892b0;margin:10px 0 6px">' + sanitize(cat.name) + '</div>';
    items.forEach(function (pr) {
      shown++;
      var idx = _ppRefs.push(pr.name) - 1;
      var price = _ppState.showPrice ? ppModelPrice(pr.name) : 0;
      html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #1e293b;border-radius:8px;margin-bottom:5px">' +
        '<span style="font-size:14px;color:#e0e6f0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">' + sanitize(pr.name) + '</span>' +
        ((_ppState.showPrice && price) ? '<span style="font-size:12px;color:#8892b0;white-space:nowrap">฿' + fmtMoneyShort(price) + '</span>' : '') +
        '<input id="ppq_' + idx + '" type="number" value="1" min="1" style="width:46px;padding:4px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#e0e6f0">' +
        '<button onclick="ppPick(' + idx + ')" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;white-space:nowrap">+ เพิ่ม</button>' +
        '</div>';
    });
  });
  if (!shown) html = '<div style="text-align:center;color:#8892b0;padding:24px">ไม่พบสินค้า' + (q ? ' "' + sanitize(q) + '"' : '') + '</div>';
  wrap.innerHTML = html;
}

// ================================================================
// SAVE PIPELINE (Multi-Model)
// ================================================================
function savePipeline(dealerId, eid) {
  var data = {
    registerDate: dpG('fp_reg'),
    projectName: document.getElementById('fp_name').value.trim(),
    endUserTH: document.getElementById('fp_eu_th').value.trim(),
    endUserEN: document.getElementById('fp_eu_en').value.trim(),
    agencyMain: document.getElementById('fp_agency_main') ? document.getElementById('fp_agency_main').value.trim() : '',
    agencySub: document.getElementById('fp_agency_sub') ? document.getElementById('fp_agency_sub').value.trim() : '',
    unitType: document.getElementById('fp_unit').value,
    dealerId: document.getElementById('fp_dealer').value || dealerId,
    djiDealer: document.getElementById('fp_djid').value,
    forecastAmount: parseNum(document.getElementById('fp_fc') ? document.getElementById('fp_fc').value : 0),
    realAmount: parseNum(document.getElementById('fp_real') ? document.getElementById('fp_real').value : 0),
    tor: document.getElementById('fp_tor').value,
    biddingDate: dpG('fp_bid'),
    shipmentDate: dpG('fp_ship'),
    expectedCloseDate: dpG('fp_close'),
    appointmentLetter: document.getElementById('fp_appt').value,
    status: document.getElementById('fp_status').value,
    nextAction: document.getElementById('fp_next').value,
    followupDate: dpG('fp_fudate'),
    recurring: document.querySelector('input[name="fp_rec"]:checked') ? document.querySelector('input[name="fp_rec"]:checked').value === '1' : false,
    remark: document.getElementById('fp_remark').value.trim(),
    djiCrmRegistered: document.getElementById('fp_crm') ? document.getElementById('fp_crm').checked : false,
    djiCrmDate: dpG('fp_crmdate'),
    hasCompetitor: document.getElementById('fp_comp') ? document.getElementById('fp_comp').checked : false,
    competitorName: document.getElementById('fp_compname') ? document.getElementById('fp_compname').value.trim() : '',
    budgetFiscalYear: document.getElementById('fp_fy') && document.getElementById('fp_fy').value ? parseInt(document.getElementById('fp_fy').value, 10) : null,
    projectRevenue: parseNum(document.getElementById('fp_projrev') ? document.getElementById('fp_projrev').value : 0),
    saleName: document.getElementById('fp_sale') ? document.getElementById('fp_sale').value.trim() : '',
    sheetDisplay: document.querySelector('input[name="fp_disp"]:checked') ? document.querySelector('input[name="fp_disp"]:checked').value : 'Show'
  };

  // Handle items based on mode
  if (pipeItemMode === 'items' && pipeItemsTemp.length > 0) {
    data.items = JSON.parse(JSON.stringify(pipeItemsTemp));
    // Set primary model (first item) for backward compatibility
    data.model = pipeItemsTemp[0].model;
    // Total QTY
    var totalQty = 0;
    for (var i = 0; i < pipeItemsTemp.length; i++) {
      totalQty += (Number(pipeItemsTemp[i].qty) || 1);
    }
    data.modelQty = totalQty;
  } else if (pipeItemMode === 'lump') {
    var lumpModel = document.getElementById('fp_model_lump');
    var lumpQty = document.getElementById('fp_qty_lump');
    data.model = lumpModel ? lumpModel.value : '';
    data.modelQty = lumpQty ? (parseInt(lumpQty.value) || 1) : 1;
    data.items = [];
    if (data.model) {
      data.items = [{
        model: data.model,
        qty: data.modelQty,
        price: 0,
        total: data.forecastAmount
      }];
    }
  } else {
    data.model = '';
    data.modelQty = 0;
    data.items = [];
  }

  if (!data.projectName) return alert('ใส่ Project Name');
  if (!data.dealerId) return alert('เลือก Dealer');

  if (eid) {
    ST.update('pipeline', eid, data);
    closeMForce();
    go('pipeDetail', {pipeId: eid});
  } else {
    var p = ST.add('pipeline', data);
    ST.add('pipeLog', {pipeId: p.id, type: 'note', content: 'ลงทะเบียนโครงการ', date: _nw()});
    closeMForce();
    go('pipeDetail', {pipeId: p.id});
  }
  toast('💾 บันทึกแล้ว');
  pipeItemsTemp = [];
}

// Pipeline Log
function showPipeLogM(pipeId) {
  openM('➕ Update Pipeline', '' +
    '<div class="fg"><label>ประเภท</label><select id="fpl_t"><option value="update">📝 อัพเดท</option><option value="progress">🟢 คืบหน้า</option><option value="problem">🔴 ปัญหา</option><option value="solution">🟡 แก้ไข</option><option value="forecast">📦 Forecast</option><option value="note">⚪ หมายเหตุ</option></select></div>' +
    '<div class="fg"><label>รายละเอียด *</label><textarea id="fpl_c" rows="4"></textarea></div>' +
    dpH('fpl_d', _td(), 'วันที่') +
    '<button class="btn bp btn-full" onclick="savePipeLog(\'' + pipeId + '\')">💾 บันทึก</button>');
}

function savePipeLog(pipeId) {
  var content = document.getElementById('fpl_c').value.trim();
  if (!content) return alert('ใส่รายละเอียด');
  ST.add('pipeLog', {pipeId: pipeId, type: document.getElementById('fpl_t').value, content: content, date: (dpG('fpl_d') || _td()) + 'T' + new Date().toTimeString().slice(0, 8)});
  closeMForce(); toast('📝 บันทึกแล้ว'); render();
}

// Quick Update Modal (NEW)
function showQuickUpdateM(pipeId) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  var cfg = getConfig();
  openM('📝 Quick Update — ' + (p.projectName || '').substr(0, 30), '' +
    '<div style="font-size:.76rem;color:#94a3b8;margin-bottom:8px">' + sanitize((p.projectName || '').substr(0, 50)) + ' • ' + pipeTag(p.status) + ' • 💰 ' + fmtMoney(p.forecastAmount) + '</div>' +
    '<div class="fg"><label>อัพเดท *</label><textarea id="qu_c" rows="3" placeholder="พิมพ์อัพเดทสั้นๆ..."></textarea></div>' +
    '<div class="fr"><div class="fg"><label>เปลี่ยน Status</label><select id="qu_st"><option value="">-- ไม่เปลี่ยน --</option>' + cfg.pipelineStatuses.map(function(s) { return '<option value="' + s.id + '"' + (p.status === s.id ? ' selected' : '') + '>' + s.name + '</option>'; }).join('') + '</select></div>' +
    '<div class="fg"><label>🎯 Next Action</label><select id="qu_na"><option value="">--</option>' + cfg.pipelineNextActions.map(function(a) { return '<option value="' + a + '"' + (p.nextAction === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div></div>' +
    dpH('qu_fu', p.followupDate || '', 'Follow-up Date') +
    '<button class="btn bp btn-full" onclick="saveQuickUpdate(\'' + pipeId + '\')">💾 บันทึก</button>');
}

function saveQuickUpdate(pipeId) {
  var content = document.getElementById('qu_c').value.trim();
  if (!content) return alert('ใส่อัพเดท');
  var newStatus = document.getElementById('qu_st').value;
  var nextAction = document.getElementById('qu_na').value;
  var followupDate = dpG('qu_fu');
  
  // Add log
  var logType = 'update';
  if (newStatus && newStatus !== ST.getOne('pipeline', pipeId).status) {
    logType = 'status_change';
    content = getPipeName(newStatus) + ' — ' + content;
  }
  ST.add('pipeLog', {pipeId: pipeId, type: logType, content: content, date: _nw()});
  
  // Update pipeline
  var updates = {};
  if (newStatus) updates.status = newStatus;
  if (nextAction !== undefined) updates.nextAction = nextAction;
  if (followupDate !== undefined) updates.followupDate = followupDate;
  if (Object.keys(updates).length) ST.update('pipeline', pipeId, updates);
  
  closeMForce(); toast('📝 อัพเดทแล้ว'); render();
}

// Win/Loss Modals
function showWinReasonM(pipeId, newStatus) {
  var cfg = getConfig();
  var p = ST.getOne('pipeline', pipeId);
  openM('✅ Win — สาเหตุที่ได้งาน', '' +
    '<div class="fg"><label>สาเหตุ</label><div class="check-g">' + cfg.winReasons.map(function(r) { return '<label><input type="checkbox" name="wr" value="' + r + '"><span>' + r + '</span></label>'; }).join('') + '</div></div>' +
    '<div class="fg"><label>หมายเหตุ</label><textarea id="wr_note" rows="2"></textarea></div>' +
    '<div class="fg"><label>Real Amount (฿)</label><input type="text" inputmode="decimal" class="js-money" id="wr_amt" value="' + nmI(p ? p.forecastAmount || '' : '') + '"></div>' +
    '<button class="btn bp btn-full" onclick="saveWinReason(\'' + pipeId + '\',\'' + newStatus + '\')">💾 บันทึก</button>');
}

function saveWinReason(pipeId, newStatus) {
  var reasons = [];
  var chks = document.querySelectorAll('input[name="wr"]:checked');
  for (var i = 0; i < chks.length; i++) reasons.push(chks[i].value);
  var note = document.getElementById('wr_note') ? document.getElementById('wr_note').value.trim() : '';
  var amt = parseNum(document.getElementById('wr_amt') ? document.getElementById('wr_amt').value : 0);
  var updates = {status: newStatus, winReason: reasons.join(', '), winNote: note};
  if (amt) updates.realAmount = amt;
  ST.update('pipeline', pipeId, updates);
  ST.add('pipeLog', {pipeId: pipeId, type: 'win', content: '✅ Win: ' + reasons.join(', ') + (note ? ' — ' + note : '') + (amt ? ' • Real: ' + fmtMoney(amt) : ''), date: _nw()});
  closeMForce(); toast('✅ Win!'); render();
}

function showLossReasonM(pipeId) {
  var cfg = getConfig();
  openM('❌ Lost — สาเหตุที่ไม่ได้งาน', '' +
    '<div class="fg"><label>สาเหตุ</label><div class="check-g">' + cfg.lossReasons.map(function(r) { return '<label><input type="checkbox" name="lr" value="' + r + '"><span>' + r + '</span></label>'; }).join('') + '</div></div>' +
    '<div class="fg"><label>คู่แข่งที่ชนะ</label><input type="text" id="lr_comp"></div>' +
    '<div class="fg"><label>ราคาคู่แข่ง (฿)</label><input type="text" inputmode="decimal" class="js-money" id="lr_price"></div>' +
    '<div class="fg"><label>บทเรียน</label><textarea id="lr_note" rows="2"></textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveLossReason(\'' + pipeId + '\')">💾 บันทึก</button>');
}

function saveLossReason(pipeId) {
  var reasons = [];
  var chks = document.querySelectorAll('input[name="lr"]:checked');
  for (var i = 0; i < chks.length; i++) reasons.push(chks[i].value);
  var comp = document.getElementById('lr_comp') ? document.getElementById('lr_comp').value.trim() : '';
  var price = document.getElementById('lr_price') ? parseNum(document.getElementById('lr_price').value) : '';
  var note = document.getElementById('lr_note') ? document.getElementById('lr_note').value.trim() : '';
  ST.update('pipeline', pipeId, {status: 'lost', lossReason: reasons.join(', '), lossCompetitor: comp, lossCompetitorPrice: price, lossNote: note});
  ST.add('pipeLog', {pipeId: pipeId, type: 'lost', content: '❌ Lost: ' + reasons.join(', ') + (comp ? ' — ชนะโดย: ' + comp : '') + (note ? ' — ' + note : ''), date: _nw()});
  closeMForce(); toast('❌ บันทึก Lost'); render();
}

// ================================================================
// VISIT MODAL (Fixed Topic Cards)
// ================================================================
var visitMode = 'full';

function showVisitM(dealerId, eid) {
  var v = eid ? ST.getOne('visits', eid) : {};
  var cfg = getConfig();
  var existDealer = dealerId || v.dealerId || '';
  var dealer = existDealer ? ST.getOne('dealers', existDealer) : null;
  var prevVisit = existDealer ? (ST.visitsByDealer(existDealer)[0] || null) : null;

  // Quick Mode
  if (visitMode === 'quick') {
    openM('⚡ Quick Visit', '' +
      '<div class="fg"><label>Dealer *</label><select id="fv_dealer" onchange="onVisitDealerChanged()">' + dealerOptions(existDealer) + '</select></div>' +
      '<div class="fr">' + dpH('fv_date', v.date || _td(), 'วันที่ *') +
      '<div class="fg"><label>เวลา</label><input type="time" id="fv_time" value="' + (v.time || '') + '"></div></div>' +
      '<div class="fg"><label>Mode</label><div class="radio-g"><label><input type="radio" name="fv_mode" value="offline"' + ((v.mode || 'offline') === 'offline' ? ' checked' : '') + '><span>🤝 Offline</span></label><label><input type="radio" name="fv_mode" value="online"' + (v.mode === 'online' ? ' checked' : '') + '><span>📞 Online</span></label></div></div>' +
      '<div class="fg"><div style="display:flex;justify-content:space-between;align-items:center"><label>สรุป *</label><button type="button" id="vSumAiBtn" class="btn bsm" onclick="aiCleanVisitNote()" style="font-size:11px;padding:3px 8px" title="ให้ AI จัดโน้ตให้เป็นระเบียบ">✨ AI จัดระเบียบ</button></div><textarea id="fv_summary" rows="5" placeholder="พิมพ์โน้ตคร่าวๆ แล้วกด ✨ AI จัดระเบียบ">' + sanitize(v.summary || '') + '</textarea></div>' +
      '<button class="btn bp btn-full" onclick="saveVisitQuick(\'' + existDealer + '\',\'' + (eid || '') + '\')">💾 บันทึก</button>' +
      '<div style="margin-top:6px;text-align:center"><span class="vm-btn standard" onclick="visitMode=\'standard\';showVisitM(\'' + existDealer + '\',\'' + (eid || '') + '\')">📝 Standard</span> <span class="vm-btn full" onclick="visitMode=\'full\';showVisitM(\'' + existDealer + '\',\'' + (eid || '') + '\')">📋 Full</span></div>');
    return;
  }

  // Standard / Full
  var html = '' +
    '<div class="visit-mode">' +
    '<div class="vm-btn quick' + (visitMode === 'quick' ? ' act' : '') + '" onclick="visitMode=\'quick\';showVisitM(\'' + existDealer + '\',\'' + (eid || '') + '\')">⚡ Quick</div>' +
    '<div class="vm-btn standard' + (visitMode === 'standard' ? ' act' : '') + '" onclick="visitMode=\'standard\';showVisitM(\'' + existDealer + '\',\'' + (eid || '') + '\')">📝 Standard</div>' +
    '<div class="vm-btn full' + (visitMode === 'full' ? ' act' : '') + '" onclick="visitMode=\'full\';showVisitM(\'' + existDealer + '\',\'' + (eid || '') + '\')">📋 Full</div></div>' +
    '<div class="form-section">📋 ข้อมูลพื้นฐาน</div>' +
    '<div class="fg"><label>Dealer *</label><select id="fv_dealer" onchange="onVisitDealerChanged()">' + dealerOptions(existDealer) + '</select></div>' +
    '<div class="fr">' + dpH('fv_date', v.date || _td(), 'วันที่ *') + '<div class="fg"><label>เวลา</label><input type="time" id="fv_time" value="' + (v.time || '') + '"></div></div>' +
    '<div class="fr"><div class="fg"><label>Mode</label><div class="radio-g"><label><input type="radio" name="fv_mode" value="offline"' + ((v.mode || 'offline') === 'offline' ? ' checked' : '') + '><span>🤝 Offline</span></label><label><input type="radio" name="fv_mode" value="online"' + (v.mode === 'online' ? ' checked' : '') + '><span>📞 Online</span></label></div></div>' +
    '<div class="fg"><label>DJI Dealer</label><select id="fv_djid">' + optionsHTML(cfg.djiDealerTypes, v.djiDealer || (dealer ? dealer.djiDealer : '') || '', '--') + '</select></div></div>' +
    '<div class="fg"><label>📍 Location</label><input type="url" id="fv_loc" value="' + (v.location || (dealer ? dealer.googleMap : '') || '') + '"></div>';

  // Topics
  var topicGroups = cfg.visitTopicGroups || [];
  var topics = cfg.visitTopics || [];
  var existData = v.topicData || [];

  for (var g = 0; g < topicGroups.length; g++) {
    var grp = topicGroups[g];
    if (visitMode === 'standard' && !grp.alwaysAsk) continue;
    html += '<div class="form-section">' + grp.name + '</div>';
    var grpTopics = topics.filter(function(t) { return t.group === grp.id; });
    for (var t = 0; t < grpTopics.length; t++) {
      var topic = grpTopics[t];
      var td = null;
      for (var e = 0; e < existData.length; e++) { if (existData[e].topicId === topic.id) { td = existData[e]; break; } }
      if (!td) td = {};
      html += buildTopicCard(topic, td, v, dealer, prevVisit, t);
    }
  }

  html += '<div class="form-section">📝 สรุปเพิ่มเติม</div>' +
    '<div class="fg"><div style="display:flex;justify-content:space-between;align-items:center"><label>สรุปการคุย</label><button type="button" id="vSumAiBtn" class="btn bsm" onclick="aiCleanVisitNote()" style="font-size:11px;padding:3px 8px" title="ให้ AI จัดโน้ตให้เป็นระเบียบ">✨ AI จัดระเบียบ</button></div><textarea id="fv_summary" rows="3" placeholder="พิมพ์โน้ตคร่าวๆ แล้วกด ✨ AI จัดระเบียบ">' + sanitize(v.summary || '') + '</textarea></div>' +
    '<div class="form-section">📊 Pipeline ที่อัพเดต</div>' +
    '<div id="fv_pipes">' + renderPipelineSelectEnhanced(existDealer, v.pipelineUpdates) + '</div>' +
    '<div class="form-section">📦 Forecast QTY</div><div id="fv_fcs">';
  var fcs = v.forecastNotes || [{month: '', amount: '', items: ''}];
  for (var i = 0; i < fcs.length; i++) html += fcRow(i, fcs[i]);
  html += '</div><button type="button" class="btn bsm bo" onclick="addFcRow()">➕ เพิ่มเดือน</button>';
  html += '<div class="form-section">💡 Feedback</div><div id="fv_fbs">';
  var fbs = v.feedbackItems || [''];
  for (var i = 0; i < fbs.length; i++) html += fbRow(i, fbs[i]);
  html += '</div><button type="button" class="btn bsm bo" onclick="addFbRow()">➕ เพิ่ม</button>';
  html += '<div style="margin-top:12px"><button class="btn bp btn-full" onclick="saveVisit(\'' + existDealer + '\',\'' + (eid || '') + '\')">💾 บันทึก</button></div>';

  openM(visitMode === 'full' ? '📋 Full Visit Report' : '📝 Standard Visit', html);
}

async function aiCleanVisitNote() {
  var el = document.getElementById('fv_summary');
  if (!el) return;
  var raw = (el.value || '').trim();
  if (!raw) { toast('💡 พิมพ์โน้ตคร่าวๆ ก่อน'); return; }
  var restore = _aiBtnBusy(document.getElementById('vSumAiBtn'), '⏳ กำลังจัด...');
  var prompt = 'คุณเป็นผู้ช่วยฝ่ายขายโดรน DJI ' +
    'ช่วยจัดบันทึกการเข้าพบลูกค้า (visit note) ที่เขียนคร่าวๆ ให้เป็นระเบียบ อ่านง่าย เป็นภาษาไทย ' +
    'จัดเป็นหัวข้อสั้นๆ เช่น สรุปการคุย / ประเด็นสำคัญ / สิ่งที่ต้องทำต่อ (next step) ตามที่มีข้อมูล ' +
    'อย่าแต่งเติมข้อมูลที่ไม่มีในโน้ต ตอบเฉพาะเนื้อหาที่จัดระเบียบแล้ว\n\nโน้ตดิบ:\n' + raw;
  var out = await askGemini(prompt);
  restore();
  if (out) { el.value = out; toast('✨ จัดระเบียบเสร็จแล้ว — ตรวจทานก่อนบันทึกได้'); }
}

// ================================================================
// TOPIC CARD BUILDER (FIXED)
// ================================================================
function buildTopicCard(topic, td, v, dealer, prevVisit, idx) {
  var answered = td.answered || false;
  var bodyId = 'tc_body_' + topic.id;
  var bodyDisplay = answered ? 'display:block' : 'display:none';

  return '<div class="topic-card' + (answered ? ' expanded done' : '') + '" id="tc_' + topic.id + '">' +
    '<div class="topic-hd" onclick="toggleTopicCard(\'' + topic.id + '\')">' +
    '<div class="num">' + (answered ? '✓' : (idx + 1)) + '</div>' +
    '<div class="topic-title">' + topic.name + '</div>' +
    '<div class="topic-status"><label style="font-size:.62rem" onclick="event.stopPropagation()"><input type="checkbox" id="tc_chk_' + topic.id + '"' + (answered ? ' checked' : '') + ' onchange="toggleTopicCheck(\'' + topic.id + '\')"> ถามแล้ว</label></div>' +
    '</div>' +
    '<div class="topic-body" id="' + bodyId + '" style="' + bodyDisplay + '">' +
    '<div class="topic-prompt">💡 ' + topic.prompt + '</div>' +
    buildTopicInput(topic, td, v, dealer, prevVisit) +
    '</div></div>';
}

function buildTopicInput(topic, td, v, dealer, prevVisit) {
  var id = topic.id;
  var prevRev = v.revenue || (prevVisit ? prevVisit.revenue : '') || (dealer ? dealer.currentRevenue : '') || '';
  var prevSeg = v.customerSegment || (prevVisit ? prevVisit.customerSegment : '') || (dealer ? dealer.customerSegment : '') || '';

  switch (id) {
    case 'sales_perf':
      return '<div class="fr"><div class="fg"><label>ยอดขาย (฿)</label><input type="text" inputmode="decimal" class="js-money" id="vt_revenue" value="' + nmI(prevRev) + '">' + (prevRev ? '<div class="prev-data">ค่าล่าสุด: ' + fmtMoney(prevRev) + '</div>' : '') + '</div>' +
        '<div class="fg"><label>เป้าที่คาด (฿)</label><input type="text" inputmode="decimal" class="js-money" id="vt_expected" value="' + nmI(v.expectedRevenue || '') + '"></div></div>' +
        '<div class="fg"><label>สรุป</label><textarea id="vt_' + id + '" rows="2">' + sanitize(td.summary || '') + '</textarea></div>';
    case 'downstream':
      return '<div class="fg"><label>กลุ่มลูกค้า</label><input type="text" id="vt_segment" value="' + sanitize(prevSeg) + '">' + (prevSeg ? '<div class="prev-data">ค่าล่าสุด: ' + sanitize(prevSeg) + '</div>' : '') + '</div>' +
        '<div class="fg"><label>สรุป</label><textarea id="vt_' + id + '" rows="2">' + sanitize(td.summary || '') + '</textarea></div>';
    case 'dock_projects':
      var prevDock = v.dockInterest || (dealer ? dealer.dockInterest : '') || '';
      return '<div class="fg"><label>Interest</label><select id="vt_dock"><option value="">--</option><option value="มี"' + (prevDock === 'มี' ? ' selected' : '') + '>มี</option><option value="ไม่มี"' + (prevDock === 'ไม่มี' ? ' selected' : '') + '>ไม่มี</option><option value="กำลังดู"' + (prevDock === 'กำลังดู' ? ' selected' : '') + '>กำลังดู</option></select></div>' +
        '<div class="fg"><label>สรุป</label><textarea id="vt_' + id + '" rows="2">' + sanitize(td.summary || '') + '</textarea></div>';
    case 'dsec': case 'fh2':
      var prevSt = td.status || (dealer ? dealer[id + 'Status'] : '') || '';
      var prevCnt = td.certCount || (dealer ? dealer[id + 'CertCount'] : '') || '';
      return '<div class="fr"><div class="fg"><label>Status</label><select id="vt_' + id + '_st"><option value="">--</option><option value="pass"' + (prevSt === 'pass' ? ' selected' : '') + '>ผ่าน</option><option value="fail"' + (prevSt === 'fail' ? ' selected' : '') + '>ไม่ผ่าน</option><option value="pending"' + (prevSt === 'pending' ? ' selected' : '') + '>ยังไม่ทำ</option></select></div>' +
        '<div class="fg"><label>จำนวน cert</label><input type="number" id="vt_' + id + '_n" value="' + prevCnt + '"></div></div>';
    case 'crm':
      var prevCrm = td.status || (dealer ? dealer.crmStatus : '') || '';
      return '<div class="fg"><label>Status</label><select id="vt_' + id + '_st"><option value="">--</option><option value="yes"' + (prevCrm === 'yes' ? ' selected' : '') + '>ลงทะเบียนแล้ว</option><option value="no"' + (prevCrm === 'no' ? ' selected' : '') + '>ยังไม่ลง</option></select></div>';
    case 'lark':
      var prevLark = td.status || (dealer ? dealer.larkStatus : '') || '';
      return '<div class="fg"><label>Status</label><select id="vt_' + id + '_st"><option value="">--</option><option value="added"' + (prevLark === 'added' ? ' selected' : '') + '>Add แล้ว</option><option value="no"' + (prevLark === 'no' ? ' selected' : '') + '>ยังไม่ Add</option></select></div>';
    default:
      return '<div class="fg"><label>สรุป</label><textarea id="vt_' + id + '" rows="2">' + sanitize(td.summary || '') + '</textarea></div>';
  }
}

// Topic Card Toggle (FIXED)
function toggleTopicCard(topicId) {
  var card = document.getElementById('tc_' + topicId);
  var body = document.getElementById('tc_body_' + topicId);
  if (!card || !body) return;
  
  if (body.style.display === 'block') {
    body.style.display = 'none';
    card.classList.remove('expanded');
  } else {
    body.style.display = 'block';
    card.classList.add('expanded');
  }
}

function toggleTopicCheck(topicId) {
  var chk = document.getElementById('tc_chk_' + topicId);
  var card = document.getElementById('tc_' + topicId);
  var body = document.getElementById('tc_body_' + topicId);
  if (!card || !chk) return;
  
  if (chk.checked) {
    card.classList.add('done', 'expanded');
    if (body) body.style.display = 'block';
  } else {
    card.classList.remove('done');
  }
}

// Visit Dealer Changed
function onVisitDealerChanged() {
  var did = document.getElementById('fv_dealer') ? document.getElementById('fv_dealer').value : '';
  if (!did) return;
  var d = ST.getOne('dealers', did);
  if (!d) return;
  var loc = document.getElementById('fv_loc');
  if (loc && !loc.value && d.googleMap) loc.value = d.googleMap;
  var djid = document.getElementById('fv_djid');
  if (djid && d.djiDealer) djid.value = d.djiDealer;
  var pipesDiv = document.getElementById('fv_pipes');
  if (pipesDiv) pipesDiv.innerHTML = renderPipelineSelectEnhanced(did, []);
}

function renderPipelineSelectEnhanced(dealerId, existUpdates) {
  if (!dealerId) return '<div style="font-size:.72rem;color:#64748b">เลือก Dealer ก่อน</div>';
  var pipes = ST.pipelineByDealer(dealerId).filter(function(p) { return ['lost', 'delivered'].indexOf(p.status) === -1; });
  if (!pipes.length) return '<div style="font-size:.72rem;color:#64748b">ไม่มี Pipeline active</div>';
  var eu = existUpdates || [];
  var cfg = getConfig();
  var statusOrder = ['bidding','negotiation','quotation','tor_review','prospect','win','ordered','delivered','recurring'];
pipes.sort(function(a, b) {
  var ia = statusOrder.indexOf(a.status); if (ia === -1) ia = 99;
  var ib = statusOrder.indexOf(b.status); if (ib === -1) ib = 99;
  if (ia !== ib) return ia - ib;
  return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0);
});
  var html = '';
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    var existing = null;
    for (var j = 0; j < eu.length; j++) { if (eu[j].pipeId === p.id) { existing = eu[j]; break; } }
    var isSel = !!existing;
    var amt = Number(p.forecastAmount) || 0;
    
    // Get items summary
    var items = getPipeItems(p);
    var modelText = items.map(function(it) { return (it.model || '-') + (it.qty > 1 ? ' x' + it.qty : ''); }).join(', ');
    var totalQty = getPipeTotalQty(p);
    
    // Get last log
    var lastLog = ST.pipeLogsByPipe(p.id)[0];
    var lastLogText = '';
    if (lastLog) {
      var logDate = lastLog.date ? lastLog.date.split('T')[0] : '';
      lastLogText = (logDate ? fDShort(logDate) + ' ' : '') + (lastLog.content || '').substr(0, 40);
    }

    // Get pending actions
    var pendingActions = getPipeActions().filter(function(a) { return a.pipeId === p.id && a.status === 'pending'; });

    html += '<div class="pipe-select-item' + (isSel ? ' selected' : '') + '" id="psi_' + p.id + '">';
    
    // Header (clickable)
    html += '<div class="pipe-select-header" onclick="togglePipeSelect(\'' + p.id + '\')">';
    html += '<input type="checkbox" class="pipe_chk" value="' + p.id + '"' + (isSel ? ' checked' : '') + ' onclick="event.stopPropagation();togglePipeSelect(\'' + p.id + '\')" style="display:inline;width:auto;margin:0">';
    html += '<span class="pipe-name">' + sanitize((p.projectName || '').substr(0, 35)) + '</span>';
    html += pipeTag(p.status);
    html += '<span class="pipe-amount">' + fmtMoneyStyled(amt) + '</span>';
    html += '</div>';

    // Project Info (always visible)
    html += '<div class="pipe-select-info">';
    html += '<div class="psi-row">📦 ' + sanitize(modelText || '-') + ' <span style="color:var(--text2)">(' + totalQty + ' ชิ้น)</span></div>';
    if (p.biddingDate) html += '<div class="psi-row">📅 Bidding: ' + fDShort(p.biddingDate) + ' ' + dlB(p.biddingDate, false) + '</div>';
    if (p.shipmentDate) html += '<div class="psi-row">🚚 Shipment: ' + fDShort(p.shipmentDate) + '</div>';
    if (p.nextAction) html += '<div class="psi-row">🎯 Next: ' + sanitize((p.nextAction || '').substr(0, 30)) + '</div>';
    if (lastLogText) html += '<div class="psi-row">📝 ล่าสุด: ' + sanitize(lastLogText) + '</div>';
    if (pendingActions.length) {
      html += '<div class="psi-row" style="color:#f59e0b">⏳ Action ค้าง: ' + pendingActions.length + ' รายการ</div>';
    }
    html += '<div class="psi-link" onclick="event.stopPropagation();go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">🔗 ดูรายละเอียด →</div>';
    html += '</div>';
    
    // Update Detail (show when selected)
    html += '<div class="pipe-select-detail" id="psd_' + p.id + '"' + (isSel ? ' style="display:block"' : '') + '>';
    html += '<div class="psi-update-header">✏️ Update โครงการนี้</div>';
    html += '<div class="fr">';
    html += '<div class="fg"><label style="font-size:.6rem">สถานะใหม่</label><select id="pu_st_' + p.id + '">' + optionsHTML(cfg.pipelineStatuses, existing ? existing.newStatus : p.status) + '</select></div>';
    html += '<div class="fg"><label style="font-size:.6rem">หมายเหตุ / Update</label><input type="text" id="pu_note_' + p.id + '" value="' + sanitize(existing ? existing.note : '') + '" placeholder="เช่น ลูกค้าอนุมัติ Spec แล้ว..."></div>';
    html += '</div>';
    html += '<div style="font-size:.58rem;color:var(--text2);margin-top:2px">💡 ข้อมูลจะ sync ไปที่ Pipeline Log อัตโนมัติเมื่อ Save Visit</div>';
    html += '</div>';
    
    html += '</div>';
  }
  return html;
}

function togglePipeSelect(pipeId) {
  var item = document.getElementById('psi_' + pipeId);
  var detail = document.getElementById('psd_' + pipeId);
  var chk = item ? item.querySelector('.pipe_chk') : null;
  if (!item || !detail || !chk) return;
  if (item.classList.contains('selected')) {
    item.classList.remove('selected'); detail.style.display = 'none'; chk.checked = false;
  } else {
    item.classList.add('selected'); detail.style.display = 'block'; chk.checked = true;
  }
}

// Forecast & Feedback rows
function fcRow(i, fn) {
  return '<div class="fr" style="margin-bottom:4px;padding:5px;background:#0f172a;border:1px solid #334155;border-radius:6px"><input type="text" id="fc_m_' + i + '" value="' + sanitize(fn.month || '') + '" placeholder="เดือน"><input type="text" inputmode="decimal" class="js-money" id="fc_a_' + i + '" value="' + nmI(fn.amount || '') + '" placeholder="มูลค่า (฿)"><textarea id="fc_i_' + i + '" rows="2" style="margin-top:3px;grid-column:1/-1" placeholder="รายการสินค้า...">' + sanitize(fn.items || '') + '</textarea></div>';
}
function addFcRow() { var c = document.getElementById('fv_fcs'); if (c) c.insertAdjacentHTML('beforeend', fcRow(c.children.length, {})); }
function fbRow(i, f) { return '<div style="margin-bottom:3px"><input type="text" id="fb_' + i + '" value="' + sanitize(f || '') + '" placeholder="Feedback ' + (i + 1) + '..."></div>'; }
function addFbRow() { var c = document.getElementById('fv_fbs'); if (c) c.insertAdjacentHTML('beforeend', fbRow(c.children.length, '')); }

// Save Visit Quick
function saveVisitQuick(dealerId, eid) {
  var did = document.getElementById('fv_dealer') ? document.getElementById('fv_dealer').value : dealerId;
  if (!did) return alert('เลือก Dealer');
  var summary = document.getElementById('fv_summary') ? document.getElementById('fv_summary').value.trim() : '';
  if (!summary) return alert('ใส่สรุป');
  var cfg = getConfig();
  var modeEl = document.querySelector('input[name="fv_mode"]:checked');
  var data = {date: dpG('fv_date'), time: document.getElementById('fv_time') ? document.getElementById('fv_time').value : '', dealerId: did, mode: modeEl ? modeEl.value : 'online', summary: summary, saleName: cfg.saleName, reportMode: 'quick', topicData: [], pipelineUpdates: [], forecastNotes: [], feedbackItems: []};
  if (!data.date) return alert('ใส่วันที่');
  if (eid) ST.update('visits', eid, data); else ST.add('visits', data);
  closeMForce(); toast('💾 บันทึก Visit แล้ว'); render();
}

// Save Visit (Standard/Full)
function saveVisit(dealerId, eid) {
  var cfg = getConfig();
  var did = document.getElementById('fv_dealer') ? document.getElementById('fv_dealer').value : dealerId;
  if (!did) return alert('เลือก Dealer');
  if (!dpG('fv_date')) return alert('ใส่วันที่');

  // Topic data
  var topicData = [];
  var topics = cfg.visitTopics || [];
  for (var i = 0; i < topics.length; i++) {
    var topic = topics[i];
    var chk = document.getElementById('tc_chk_' + topic.id);
    if (!chk) continue;
    var td = {topicId: topic.id, answered: chk.checked};
    if (chk.checked) {
      var sumEl = document.getElementById('vt_' + topic.id);
      if (sumEl) td.summary = sumEl.value.trim();
      if (topic.id === 'dsec' || topic.id === 'fh2') { td.status = (document.getElementById('vt_' + topic.id + '_st') || {}).value || ''; td.certCount = (document.getElementById('vt_' + topic.id + '_n') || {}).value || ''; }
      if (topic.id === 'crm' || topic.id === 'lark') td.status = (document.getElementById('vt_' + topic.id + '_st') || {}).value || '';
    }
    topicData.push(td);
  }

  // Pipeline updates
  var pipelineUpdates = [];
  var pipeChks = document.querySelectorAll('.pipe_chk:checked');
  for (var i = 0; i < pipeChks.length; i++) {
    var pid = pipeChks[i].value;
    pipelineUpdates.push({pipeId: pid, newStatus: (document.getElementById('pu_st_' + pid) || {}).value || '', note: (document.getElementById('pu_note_' + pid) || {}).value || ''});
  }

  // Forecast
  var forecastNotes = [];
  var fcCnt = document.getElementById('fv_fcs') ? document.getElementById('fv_fcs').children.length : 0;
  for (var i = 0; i < fcCnt; i++) {
    var m = (document.getElementById('fc_m_' + i) || {}).value || '';
    var a = (document.getElementById('fc_a_' + i) || {}).value || '';
    var it = (document.getElementById('fc_i_' + i) || {}).value || '';
    if (m.trim() || a || it.trim()) forecastNotes.push({month: m.trim(), amount: parseNum(a), items: it.trim()});
  }

  // Feedback
  var feedbackItems = [];
  var fbCnt = document.getElementById('fv_fbs') ? document.getElementById('fv_fbs').children.length : 0;
  for (var i = 0; i < fbCnt; i++) { var f = (document.getElementById('fb_' + i) || {}).value || ''; if (f.trim()) feedbackItems.push(f.trim()); }

  var modeEl = document.querySelector('input[name="fv_mode"]:checked');
  var data = {
    date: dpG('fv_date'), time: (document.getElementById('fv_time') || {}).value || '',
    dealerId: did, mode: modeEl ? modeEl.value : 'offline',
    djiDealer: (document.getElementById('fv_djid') || {}).value || '',
    location: (document.getElementById('fv_loc') || {}).value || '',
    summary: (document.getElementById('fv_summary') || {}).value || '',
    revenue: parseNum((document.getElementById('vt_revenue') || {}).value),
    expectedRevenue: parseNum((document.getElementById('vt_expected') || {}).value),
    customerSegment: (document.getElementById('vt_segment') || {}).value || '',
    dockInterest: (document.getElementById('vt_dock') || {}).value || '',
    topicData: topicData, pipelineUpdates: pipelineUpdates, forecastNotes: forecastNotes, feedbackItems: feedbackItems,
    saleName: cfg.saleName, reportMode: visitMode
  };

  var visitObj;
  if (eid) { ST.update('visits', eid, data); visitObj = ST.getOne('visits', eid); }
  else { visitObj = ST.add('visits', data); }

  // Auto-sync Dealer
  var dealerUpdates = {};
  if (data.revenue) dealerUpdates.currentRevenue = data.revenue;
  if (data.customerSegment) dealerUpdates.customerSegment = data.customerSegment;
  if (data.dockInterest) dealerUpdates.dockInterest = data.dockInterest;
  topicData.forEach(function(td) {
    if (td.answered) {
      if (td.topicId === 'dsec' && td.status) { dealerUpdates.dsecStatus = td.status; dealerUpdates.dsecCertCount = td.certCount; dealerUpdates.dsecLastCheck = _td(); }
      if (td.topicId === 'crm' && td.status) { dealerUpdates.crmStatus = td.status; dealerUpdates.crmLastCheck = _td(); }
      if (td.topicId === 'fh2' && td.status) { dealerUpdates.fh2Status = td.status; dealerUpdates.fh2CertCount = td.certCount; dealerUpdates.fh2LastCheck = _td(); }
      if (td.topicId === 'lark' && td.status) { dealerUpdates.larkStatus = td.status; dealerUpdates.larkLastCheck = _td(); }
    }
  });
  if (Object.keys(dealerUpdates).length) ST.update('dealers', did, dealerUpdates);

  // Auto-sync Pipeline
  pipelineUpdates.forEach(function(pu) {
    if (pu.pipeId) {
      var oldPipe = ST.getOne('pipeline', pu.pipeId);
      if (pu.newStatus && oldPipe && pu.newStatus !== oldPipe.status) ST.update('pipeline', pu.pipeId, {status: pu.newStatus});
      ST.add('pipeLog', {pipeId: pu.pipeId, type: 'visit', content: '🤝 ' + fDShort(data.date) + ' Visit: ' + (pu.note || 'อัพเดตจาก Visit'), date: data.date + 'T00:00:00', visitId: visitObj.id});
    }
  });

  // Save feedback
  feedbackItems.forEach(function(f) { ST.add('feedback', {dealerId: did, text: f, date: data.date, source: 'visit'}); });

  closeMForce(); toast('💾 บันทึก Visit แล้ว');
  if (visitMode !== 'quick') {
    setTimeout(function() { if (confirm('📧 สร้าง Draft Email?')) showVisitDraft(visitObj.id); }, 500);
  }
  go('visitDetail', {visitId: visitObj.id});
}
// ================================================================
// FOLLOW-UP MODAL
// ================================================================
function showFollowupM(dealerId) {
  openM('📞 Follow-up', '' +
    dpH('ff_d', _td(), 'วันที่ *') +
    '<div class="fg"><label>Dealer *</label><select id="ff_dlr">' + dealerOptions(dealerId) + '</select></div>' +
    '<div class="fg"><label>ช่องทาง</label><div class="radio-g">' +
    '<label><input type="radio" name="ff_m" value="line" checked><span>💬 LINE</span></label>' +
    '<label><input type="radio" name="ff_m" value="call"><span>📞 โทร</span></label>' +
    '<label><input type="radio" name="ff_m" value="email"><span>📧 Email</span></label>' +
    '</div></div>' +
    '<div class="fg"><label>สรุป *</label><textarea id="ff_s" rows="3"></textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveFollowup()">💾 บันทึก</button>');
}

function saveFollowup() {
  var date = dpG('ff_d');
  var dlr = document.getElementById('ff_dlr');
  var summary = document.getElementById('ff_s');
  var methodEl = document.querySelector('input[name="ff_m"]:checked');
  
  if (!date || !dlr || !dlr.value || !summary || !summary.value.trim()) return alert('กรอกให้ครบ');
  
  ST.add('followups', {
    date: date,
    dealerId: dlr.value,
    method: methodEl ? methodEl.value : 'line',
    summary: summary.value.trim()
  });
  closeMForce();
  toast('📞 บันทึกแล้ว');
  render();
}

// ================================================================
// LINE SUPPORT LOG MODAL
// ================================================================
function showLineLogM(dealerId) {
  var cfg = getConfig();
  openM('💬 LINE Support', '' +
    dpH('fl_d', _td(), 'วันที่') +
    '<div class="fr">' +
    '<div class="fg"><label>Dealer *</label><select id="fl_dlr">' + dealerOptions(dealerId) + '</select></div>' +
    '<div class="fg"><label>ประเภท</label><select id="fl_t">' + optionsHTML(cfg.lineLogTypes, '', '--') + '</select></div>' +
    '</div>' +
    '<div class="fg"><label>เวลา</label><input type="time" id="fl_time"></div>' +
    '<div class="fg"><label>สรุป *</label><textarea id="fl_s" rows="3"></textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveLineLog()">💾 บันทึก</button>');
}

function saveLineLog() {
  var dlr = document.getElementById('fl_dlr');
  var summary = document.getElementById('fl_s');
  if (!dlr || !dlr.value || !summary || !summary.value.trim()) return alert('กรอกให้ครบ');
  
  ST.add('lineLog', {
    date: dpG('fl_d') || _td(),
    dealerId: dlr.value,
    logType: document.getElementById('fl_t') ? document.getElementById('fl_t').value : '',
    time: document.getElementById('fl_time') ? document.getElementById('fl_time').value : '',
    summary: summary.value.trim()
  });
  closeMForce();
  toast('💬 บันทึกแล้ว');
  render();
}

// ================================================================
// FEEDBACK MODAL
// ================================================================
function showFeedbackM(dealerId) {
  openM('💡 Feedback', '' +
    dpH('ffb_d', _td(), 'วันที่') +
    '<div class="fg"><label>Feedback *</label><textarea id="ffb_t" rows="3"></textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveFeedbackM(\'' + dealerId + '\')">💾 บันทึก</button>');
}

function saveFeedbackM(dealerId) {
  var text = document.getElementById('ffb_t');
  if (!text || !text.value.trim()) return alert('ใส่ Feedback');
  ST.add('feedback', {
    dealerId: dealerId,
    text: text.value.trim(),
    date: dpG('ffb_d') || _td(),
    source: 'manual'
  });
  closeMForce();
  toast('💡 บันทึกแล้ว');
  render();
}

// ================================================================
// WAITING MODAL
// ================================================================
function showWaitM() {
  openM('📭 รอคนอื่น', '' +
    '<div class="fg"><label>เรื่อง *</label><input type="text" id="fw_t"></div>' +
    '<div class="fg"><label>รอจากใคร</label><input type="text" id="fw_p"></div>' +
    '<div class="fr">' + dpH('fw_s', _td(), 'วันที่ส่ง') + dpH('fw_d', '', 'กำหนดได้คำตอบ') + '</div>' +
    '<div class="fg"><label>หมายเหตุ</label><textarea id="fw_n" rows="2"></textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveWaiting()">💾 บันทึก</button>');
}

function saveWaiting() {
  var title = document.getElementById('fw_t');
  if (!title || !title.value.trim()) return alert('ใส่เรื่อง');
  ST.add('waiting', {
    title: title.value.trim(),
    person: document.getElementById('fw_p') ? document.getElementById('fw_p').value.trim() : '',
    sentDate: dpG('fw_s'),
    dueDate: dpG('fw_d'),
    notes: document.getElementById('fw_n') ? document.getElementById('fw_n').value.trim() : '',
    resolved: false
  });
  closeMForce();
  toast('📭 เพิ่มแล้ว');
  render();
}

// ================================================================
// EMAIL MODAL
// ================================================================
function showEmailM() {
  var cfg = getConfig();
  openM('📧 Email', '' +
    '<div class="fg"><label>หัวข้อ *</label><input type="text" id="fe_s"></div>' +
    '<div class="fg"><label>ประเภท</label><select id="fe_t">' + optionsHTML(cfg.emailTypes, '') + '</select></div>' +
    '<div class="fg"><label>ผู้รับ</label><input type="text" id="fe_r" value="' + cfg.emailRecipients.visitPlan.join(', ') + '"></div>' +
    '<div class="fg"><label>ส่งแล้ว?</label><div class="radio-g">' +
    '<label><input type="radio" name="fe_sent" value="0" checked><span>ยังไม่ส่ง</span></label>' +
    '<label><input type="radio" name="fe_sent" value="1"><span>ส่งแล้ว</span></label>' +
    '</div></div>' +
    '<button class="btn bp btn-full" onclick="saveEmail()">💾 บันทึก</button>');
}

function saveEmail() {
  var subj = document.getElementById('fe_s');
  if (!subj || !subj.value.trim()) return alert('ใส่หัวข้อ');
  var sentEl = document.querySelector('input[name="fe_sent"]:checked');
  var sent = sentEl ? sentEl.value === '1' : false;
  ST.add('emails', {
    subject: subj.value.trim(),
    type: document.getElementById('fe_t') ? document.getElementById('fe_t').value : '',
    recipients: document.getElementById('fe_r') ? document.getElementById('fe_r').value.trim() : '',
    sent: sent,
    sentDate: sent ? _nw() : null
  });
  closeMForce();
  toast('📧 บันทึกแล้ว');
  render();
}
// ================================================================
// UNIFIED CONTACT LOG (เชื่อมโยง Dealer/Pipeline/Task/Meeting)
// ================================================================

function saveLinkedContactLog(data) {
  var log = {
    id: 'cl_' + Date.now(),
    date: data.date || _td(),
    time: data.time || '',
    channel: data.channel,
    summary: data.summary,
    createdAt: _nw()
  };
  
  if (data.dealerId) { log.dealerId = data.dealerId; log.refType = 'dealer'; log.refId = data.dealerId; }
  if (data.pipeId) { log.pipeId = data.pipeId; log.refType = 'pipeline'; log.refId = data.pipeId; }
  if (data.taskId) { log.taskId = data.taskId; log.refType = 'task'; log.refId = data.taskId; }
  if (data.meetingId) { log.meetingId = data.meetingId; log.refType = 'meeting'; log.refId = data.meetingId; }
  
  var logs = JSON.parse(localStorage.getItem('v7_contact_logs') || '[]');
  logs.unshift(log);
  localStorage.setItem('v7_contact_logs', JSON.stringify(logs));
  
  // บันทึกเพิ่มใน collections ที่เกี่ยวข้อง
  if (data.pipeId) {
    ST.add('pipeLog', {
      pipeId: data.pipeId,
      type: 'contact',
      content: '📞 ' + data.channel + ': ' + data.summary,
      date: _nw(),
      contactId: log.id
    });
  }
  
  if (data.taskId) {
    ST.add('taskLogs', {
      tid: data.taskId,
      type: 'contact',
      content: '📞 ' + data.channel + ': ' + data.summary,
      date: _nw()
    });
  }
  
  if (data.dealerId) {
    ST.add('feedback', {
      dealerId: data.dealerId,
      text: data.summary,
      date: data.date || _td(),
      source: data.channel,
      contactId: log.id
    });
  }
  
  return log;
}

function showUnifiedContactForm(refType, refId) {
  var dealers = ST.getAll('dealers');
  var prefillDealerId = '', prefillPipeId = '';
  
  if (refType === 'dealer') prefillDealerId = refId;
  else if (refType === 'pipeline') { prefillPipeId = refId; var pipe = ST.getOne('pipeline', refId); if (pipe) prefillDealerId = pipe.dealerId; }
  
  var dealerOpts = '<option value="">-- เลือก --</option>';
  for (var i = 0; i < dealers.length; i++) {
    dealerOpts += '<option value="' + dealers[i].id + '"' + (prefillDealerId === dealers[i].id ? ' selected' : '') + '>' + sanitize(dealers[i].name) + '</option>';
  }
  
  var html = '<div style="max-width:500px">' +
    '<div class="fr"><div class="fg"><label>📅 วันที่</label><input type="text" id="uc_date" class="dp" value="' + _td() + '"></div>' +
    '<div class="fg"><label>⏰ เวลา</label><input type="time" id="uc_time" value="' + new Date().toTimeString().slice(0,5) + '"></div></div>' +
    '<div class="fr"><div class="fg"><label>📞 ช่องทาง</label><select id="uc_channel">' +
    '<option value="line">💬 LINE</option><option value="email">📧 Email</option><option value="phone">📞 โทรศัพท์</option>' +
    '<option value="meeting">🤝 ประชุม</option></select></div>' +
    '<div class="fg"><label>🏪 Dealer</label><select id="uc_dealer">' + dealerOpts + '</select></div></div>' +
    '<div class="fr"><div class="fg"><label>📊 Pipeline</label><select id="uc_pipe"><option value="">-- ไม่ระบุ --</option>' +
    (prefillPipeId ? '<option value="' + prefillPipeId + '" selected>กำลังเชื่อมโยง</option>' : '') + '</select></div>' +
    '<div class="fg"><label>📋 Task</label><select id="uc_task"><option value="">-- ไม่ระบุ --</option></select></div></div>' +
    '<div class="fg"><label>📝 รายละเอียด *</label><textarea id="uc_summary" rows="4" placeholder="สรุปการติดต่อ..."></textarea></div>' +
    '<div class="fg"><label>🎯 ต้องทำอะไรต่อ</label><select id="uc_next_action">' +
    '<option value="">-- ไม่ต้องทำ --</option><option value="task">📋 สร้างงานใหม่</option>' +
    '<option value="followup">📞 ตั้งค่าเตือนติดตาม</option><option value="update_pipeline">📊 อัพเดท Pipeline</option></select></div>' +
    '<div id="uc_task_detail" style="display:none"><div class="fg"><label>📋 ชื่องาน</label><input type="text" id="uc_task_title" placeholder="เช่น ส่งใบเสนอราคา..."></div>' +
    dpH('uc_task_due', '', 'กำหนดเสร็จ') + '</div>' +
    '<div id="uc_followup_detail" style="display:none">' + dpH('uc_followup_due', addD(_td(), 3), 'ติดตามอีกครั้งในวันที่') + '</div>' +
    '<div id="uc_pipeline_detail" style="display:none"><div class="fg"><label>📝 อัพเดท</label><textarea id="uc_pipe_update" rows="2" placeholder="ความคืบหน้า..."></textarea></div>' +
    '<div class="fg"><label>🔄 เปลี่ยนสถานะ</label><select id="uc_pipe_status"><option value="">-- ไม่เปลี่ยน --</option>' +
    getConfig().pipelineStatuses.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('') +
    '</select></div></div><div class="fm-actions"><button class="btn btn-blue" onclick="submitUnifiedContact()">💾 บันทึก</button>' +
    '<button class="btn" onclick="closeM()">ยกเลิก</button></div></div>';
  
  openM('📞 บันทึกการติดต่อ', html);
  
  document.getElementById('uc_dealer').onchange = function() {
    var did = this.value;
    var pipeSel = document.getElementById('uc_pipe');
    var taskSel = document.getElementById('uc_task');
    pipeSel.innerHTML = '<option value="">-- ไม่ระบุ --</option>';
    taskSel.innerHTML = '<option value="">-- ไม่ระบุ --</option>';
    if (did) {
      var pipes = ST.pipelineByDealer(did);
      for (var i = 0; i < pipes.length; i++) {
        if (pipes[i].status !== 'lost' && pipes[i].status !== 'delivered') {
          pipeSel.innerHTML += '<option value="' + pipes[i].id + '">' + sanitize(pipes[i].projectName || '-') + '</option>';
        }
      }
      var tasks = ST.filter('tasks', function(t) { return t.dealerId === did && t.status === 'active'; });
      for (var i = 0; i < tasks.length; i++) {
        taskSel.innerHTML += '<option value="' + tasks[i].id + '">' + sanitize(tasks[i].title) + '</option>';
      }
    }
  };
  
  document.getElementById('uc_next_action').onchange = function() {
    var val = this.value;
    document.getElementById('uc_task_detail').style.display = val === 'task' ? 'block' : 'none';
    document.getElementById('uc_followup_detail').style.display = val === 'followup' ? 'block' : 'none';
    document.getElementById('uc_pipeline_detail').style.display = val === 'update_pipeline' ? 'block' : 'none';
  };
  
  if (prefillDealerId) setTimeout(function() { var el = document.getElementById('uc_dealer'); if (el) el.dispatchEvent(new Event('change')); }, 100);
}

function submitUnifiedContact() {
  var summary = document.getElementById('uc_summary').value.trim();
  if (!summary) { toast('กรุณาใส่รายละเอียด'); return; }
  
  var data = {
    date: dpG('uc_date') || _td(),
    time: document.getElementById('uc_time').value,
    channel: document.getElementById('uc_channel').value,
    summary: summary,
    dealerId: document.getElementById('uc_dealer').value || '',
    pipeId: document.getElementById('uc_pipe').value || '',
    taskId: document.getElementById('uc_task').value || ''
  };
  
  var log = saveLinkedContactLog(data);
  var nextAction = document.getElementById('uc_next_action').value;
  
  if (nextAction === 'task') {
    var taskTitle = document.getElementById('uc_task_title').value.trim();
    if (taskTitle) {
      var newTask = ST.add('tasks', {
        title: taskTitle, description: 'จาก ' + data.channel + ': ' + summary,
        dealerId: data.dealerId, pipeId: data.pipeId, dueDate: dpG('uc_task_due'),
        priority: 'medium', status: 'active', category: 'Contact', contactId: log.id
      });
      toast('📋 สร้างงาน: ' + taskTitle);
    }
  }
  
  if (nextAction === 'followup') {
    var dueDate = dpG('uc_followup_due');
    if (dueDate) {
      var pendingFu = JSON.parse(localStorage.getItem('v7_pending_followups') || '[]');
      pendingFu.push({ id: 'fu_' + Date.now(), contactId: log.id, dealerId: data.dealerId,
        pipeId: data.pipeId, note: summary, dueDate: dueDate, channel: data.channel, done: false });
      localStorage.setItem('v7_pending_followups', JSON.stringify(pendingFu));
      toast('📞 ตั้งค่าเตือนติดตามวันที่ ' + dueDate);
    }
  }
  
  if (nextAction === 'update_pipeline' && data.pipeId) {
    var updateText = document.getElementById('uc_pipe_update').value.trim();
    var newStatus = document.getElementById('uc_pipe_status').value;
    if (updateText) ST.add('pipeLog', { pipeId: data.pipeId, type: 'contact',
      content: '📞 ' + data.channel + ': ' + updateText, date: _nw(), contactId: log.id });
    if (newStatus) ST.update('pipeline', data.pipeId, { status: newStatus });
    toast('📊 อัพเดท Pipeline แล้ว');
  }
  
  closeMForce(); toast('✅ บันทึกการติดต่อแล้ว'); render();
}
// ================================================================
// TASK RESCHEDULE (เลื่อน Due Date)
// ================================================================

function showRescheduleModal(taskId) {
  var t = ST.getOne('tasks', taskId);
  if (!t) return;
  
  var oldDueDate = t.dueDate || '';
  
  openM('📅 เลื่อนกำหนดเสร็จ', `
    <div class="fg">
      <label>📅 วันที่กำหนดเดิม</label>
      <div class="old-value" style="padding:6px;background:var(--bg2);border-radius:6px">${oldDueDate || 'ไม่ได้ตั้ง'}</div>
    </div>
    <div class="fg">
      <label>📅 กำหนดใหม่ *</label>
      <input type="text" id="reschedule_new_date" class="dp" value="${oldDueDate || _td()}">
    </div>
    <div class="fg">
      <label>📝 เหตุผลที่เลื่อน</label>
      <textarea id="reschedule_reason" rows="2" placeholder="เช่น รอเอกสารจากลูกค้า, ลูกค้าขอเลื่อน, งบไม่ออก..."></textarea>
    </div>
    <div class="fg">
      <label>🔔 แจ้งเตือน</label>
      <div class="check-g">
        <label><input type="checkbox" id="reschedule_notify" checked> ส่งเตือนใน Notification</label>
        <label><input type="checkbox" id="reschedule_calendar"> ส่งไปปฏิทิน (.ics)</label>
      </div>
    </div>
    <div class="fm-actions">
      <button class="btn btn-blue" onclick="saveReschedule('${taskId}')">💾 บันทึก</button>
      <button class="btn" onclick="closeM()">ยกเลิก</button>
    </div>
  `);
}

function saveReschedule(taskId) {
  var newDueDate = dpG('reschedule_new_date');
  var reason = document.getElementById('reschedule_reason').value.trim();
  var sendNotify = document.getElementById('reschedule_notify')?.checked || false;
  var sendCalendar = document.getElementById('reschedule_calendar')?.checked || false;
  
  if (!newDueDate) { toast('กรุณาใส่วันที่'); return; }
  
  var t = ST.getOne('tasks', taskId);
  if (!t) return;
  
  var oldDueDate = t.dueDate;
  
  // บันทึกประวัติ
  ST.addDueDateHistory(taskId, oldDueDate, newDueDate, reason);
  
  // อัพเดท dueDate
  ST.update('tasks', taskId, { dueDate: newDueDate, updatedAt: _nw() });
  
  // เพิ่ม log
  ST.add('taskLogs', {
    tid: taskId,
    type: 'reschedule',
    content: `📅 เลื่อนกำหนดจาก ${oldDueDate || '-'} เป็น ${newDueDate}${reason ? ' (' + reason + ')' : ''}`,
    date: _nw()
  });
  
  // ส่ง Notification
  if (sendNotify && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('📅 กำหนดการเปลี่ยนแปลง', {
      body: `งาน "${t.title}" ถูกเลื่อนจาก ${oldDueDate || '-'} เป็น ${newDueDate}`,
      tag: 'task_' + taskId
    });
  }
  
  // ส่งไปปฏิทิน
  if (sendCalendar && typeof exportToICS === 'function') {
    exportToICS(
      '📋 ' + t.title,
      'งานถูกเลื่อนกำหนด: ' + (reason || ''),
      newDueDate,
      addD(newDueDate, 1),
      '',
      window.location.href
    );
  }
  
  closeMForce();
  toast(`📅 เลื่อนกำหนดเป็น ${newDueDate} แล้ว`);
  render();
}

// ================================================================
// FOLLOW-UP DATE MANAGEMENT
// ================================================================

function setFollowupDate(taskId) {
  var t = ST.getOne('tasks', taskId);
  if (!t) return;
  
  openM('📞 ตั้งค่านัดติดตาม', `
    <div class="fg">
      <label>📅 วันที่ต้องติดตาม</label>
      <input type="text" id="fu_date" class="dp" value="${t.followupDate || addD(_td(), 2)}">
    </div>
    <div class="fg">
      <label>📝 ข้อความเตือน</label>
      <textarea id="fu_note" rows="2" placeholder="เช่น โทรถามความคืบหน้า, ทวงเอกสาร...">${t.followupNote || ''}</textarea>
    </div>
    <div class="fg">
      <label>🔔 แจ้งเตือนอัตโนมัติ</label>
      <div class="check-g">
        <label><input type="checkbox" id="fu_notify" checked> เตือนในวันนั้น</label>
        <label><input type="checkbox" id="fu_notify_day_before"> เตือนล่วงหน้า 1 วัน</label>
      </div>
    </div>
    <div class="fm-actions">
      <button class="btn btn-blue" onclick="saveFollowupDate('${taskId}')">💾 บันทึก</button>
      <button class="btn bd" onclick="clearFollowupDate('${taskId}')">🗑️ ลบการเตือน</button>
    </div>
  `);
}

function saveFollowupDate(taskId) {
  var dueDate = dpG('fu_date');
  var note = document.getElementById('fu_note').value.trim();
  var notifyDayBefore = document.getElementById('fu_notify_day_before')?.checked || false;
  
  if (!dueDate) { toast('กรุณาใส่วันที่'); return; }
  
  ST.update('tasks', taskId, {
    followupDate: dueDate,
    followupNote: note,
    followupNotifyDayBefore: notifyDayBefore
  });
  
  ST.add('taskLogs', {
    tid: taskId,
    type: 'followup_set',
    content: `📞 ตั้งนัดติดตามวันที่ ${dueDate}${note ? ' (' + note + ')' : ''}`,
    date: _nw()
  });
  
  closeMForce();
  toast(`📞 ตั้งนัดติดตามวันที่ ${dueDate}`);
  render();
}

function clearFollowupDate(taskId) {
  if (!confirm('ลบการเตือนติดตาม?')) return;
  ST.update('tasks', taskId, { followupDate: '', followupNote: '' });
  toast('🗑️ ลบการเตือนแล้ว');
  closeMForce();
  render();
}

function markFollowupDone(taskId) {
  var t = ST.getOne('tasks', taskId);
  if (!t) return;
  
  var response = prompt('💬 ผลลัพธ์การติดตาม:', '');
  
  ST.add('taskLogs', {
    tid: taskId,
    type: 'followup_done',
    content: `✅ ติดตามแล้ว: ${response || 'เสร็จสิ้น'}`,
    date: _nw()
  });
  
  ST.update('tasks', taskId, { followupDate: '', followupNote: '' });
  
  toast('✅ บันทึกการติดตามแล้ว');
  render();
}

function setStartDate(taskId) {
  var t = ST.getOne('tasks', taskId);
  openM('🚀 ตั้งวันที่เริ่ม', `
    <div class="fg">${dpH('start_date', t.startDate || _td(), 'วันที่เริ่มงาน')}</div>
    <button class="btn btn-blue" onclick="saveStartDate('${taskId}')">💾 บันทึก</button>
  `);
}

function saveStartDate(taskId) {
  var startDate = dpG('start_date');
  ST.update('tasks', taskId, { startDate: startDate });
  closeMForce();
  toast('✅ บันทึกแล้ว');
  render();
}

function showTaskM(eid, prefillDealerId) {
  var t = eid ? ST.getOne('tasks', eid) : {};
  var cats = [];
  var allTasks = ST.getAll('tasks');
  for (var i = 0; i < allTasks.length; i++) {
    if (allTasks[i].category && cats.indexOf(allTasks[i].category) === -1) cats.push(allTasks[i].category);
  }
  
  var dealers = ST.getAll('dealers');
  var selDealerId = prefillDealerId || t.dealerId || '';
  
  // Build dealer options
  var dealerOpts = '<option value="">-- ไม่ระบุ --</option>';
  for (var di = 0; di < dealers.length; di++) {
    dealerOpts += '<option value="' + dealers[di].id + '"' + (selDealerId === dealers[di].id ? ' selected' : '') + '>' + sanitize(dealers[di].name || '') + '</option>';
  }
  
  // Build pipeline options (will update via onchange)
  var pipeOpts = '<option value="">-- ไม่ระบุ --</option>';
  if (selDealerId) {
    var pipes = ST.pipelineByDealer(selDealerId);
    for (var pi = 0; pi < pipes.length; pi++) {
      var pp = pipes[pi];
      if (pp.status === 'lost' || pp.status === 'delivered') continue;
      pipeOpts += '<option value="' + pp.id + '"' + (t.pipeId === pp.id ? ' selected' : '') + '>' + sanitize(pp.projectName || pp.name || '-') + '</option>';
    }
  }
  
  openM(eid ? '✏️ งาน' : '➕ งาน', '' +
    '<div class="fg"><label>ชื่อ *</label><input type="text" id="ft_t" value="' + sanitize(t.title || '') + '"></div>' +
    '<div class="fg"><label>รายละเอียด</label><textarea id="ft_d">' + sanitize(t.description || '') + '</textarea></div>' +
    '<div class="fg"><label>🔗 Link (URL)</label><input type="url" id="ft_url" value="' + sanitize(t.url || '') + '" placeholder="https://..."></div>' +
    '<div class="fr">' +
    '<div class="fg"><label>🏪 Dealer</label><select id="ft_dealer" onchange="taskDealerChanged()">' + dealerOpts + '</select></div>' +
    '<div class="fg"><label>📊 Pipeline Project</label><select id="ft_pipe">' + pipeOpts + '</select></div>' +
    '</div>' +
    '<div class="fr">' + dpH('ft_s', t.startDate || _td(), 'วันเริ่ม') + dpH('ft_e', t.dueDate || '', 'Deadline') + '</div>' +
    '<div class="fr">' +
    '<div class="fg"><label>สำคัญ</label><select id="ft_p">' +
    '<option value="high"' + (t.priority === 'high' ? ' selected' : '') + '>🔴 มาก</option>' +
    '<option value="medium"' + ((t.priority || 'medium') === 'medium' ? ' selected' : '') + '>🟡 กลาง</option>' +
    '<option value="low"' + (t.priority === 'low' ? ' selected' : '') + '>🟢 ทั่วไป</option>' +
    '</select></div>' +
    '<div class="fg"><label>หมวด</label><input type="text" id="ft_c" value="' + sanitize(t.category || '') + '" list="catL"><datalist id="catL">' + cats.map(function(c) { return '<option value="' + c + '">'; }).join('') + '</datalist></div>' +
    '</div>' +
    '<div class="fr">' +
    '<div class="fg"><label>สถานะ</label><select id="ft_st">' +
    '<option value="active"' + ((t.status || 'active') === 'active' ? ' selected' : '') + '>🔄 ทำ</option>' +
    '<option value="completed"' + (t.status === 'completed' ? ' selected' : '') + '>✅ เสร็จ</option>' +
    '<option value="on-hold"' + (t.status === 'on-hold' ? ' selected' : '') + '>⏸️ พัก</option>' +
    '</select></div>' +
    '<div class="fg"><label>⚡ Flow</label><select id="ft_sq">' +
    '<option value="0"' + (t.sequential ? '' : ' selected') + '>ปิด</option>' +
    '<option value="1"' + (t.sequential ? ' selected' : '') + '>เปิด</option>' +
    '</select></div>' +
    '</div>' +
    '<button class="btn bp btn-full" onclick="saveTask(\'' + (eid || '') + '\')">💾 บันทึก</button>');
}

// Update pipeline dropdown when dealer changes
function taskDealerChanged() {
  var dId = document.getElementById('ft_dealer').value;
  var sel = document.getElementById('ft_pipe');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>';
  if (!dId) return;
  var pipes = ST.pipelineByDealer(dId);
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    if (p.status === 'lost' || p.status === 'delivered') continue;
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.projectName || p.name || '-';
    sel.appendChild(opt);
  }
}

function saveTask(eid) {
  var title = document.getElementById('ft_t');
  if (!title || !title.value.trim()) return alert('ใส่ชื่อ');
  var data = {
    title: title.value.trim(),
    description: document.getElementById('ft_d') ? document.getElementById('ft_d').value.trim() : '',
    startDate: dpG('ft_s'),
    dueDate: dpG('ft_e'),
    priority: document.getElementById('ft_p') ? document.getElementById('ft_p').value : 'medium',
    category: document.getElementById('ft_c') ? document.getElementById('ft_c').value.trim() : '',
    status: document.getElementById('ft_st') ? document.getElementById('ft_st').value : 'active',
    sequential: document.getElementById('ft_sq') ? document.getElementById('ft_sq').value === '1' : false,
    url: document.getElementById('ft_url') ? document.getElementById('ft_url').value.trim() : '',
    dealerId: document.getElementById('ft_dealer') ? document.getElementById('ft_dealer').value : '',
    pipeId: document.getElementById('ft_pipe') ? document.getElementById('ft_pipe').value : ''
  };
  if (eid) {
    ST.update('tasks', eid, data);
    closeMForce();
    go('taskDetail', {taskId: eid});
  } else {
    data.steps = [];
    var t = ST.add('tasks', data);
    closeMForce();
    go('taskDetail', {taskId: t.id});
  }
  toast('💾 บันทึกแล้ว');
}
function delTask(id) {
  if (!confirm('ลบงานนี้?')) return;
  ST.delete('tasks', id);
  ST.deleteWhere('taskLogs', function(l) { return l.tid === id; });
  go('tasks');
  toast('🗑️ ลบแล้ว');
}

// ================================================================
// STEP MODAL
// ================================================================
function showStepM(tid) {
  openM('➕ Step', '' +
    '<div class="fg"><label>ชื่อ *</label><input type="text" id="fs_t"></div>' +
    '<div class="fr">' + dpH('fs_s', _td(), 'วันที่ทำ') + dpH('fs_e', '', 'วันที่เสร็จ') + '</div>' +
    '<div class="fg"><label>🔗 Link (URL)</label><input type="url" id="fs_url" placeholder="https://..."></div>' +
    '<div class="fg"><label>หมายเหตุ</label><textarea id="fs_n" rows="2"></textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveStep(\'' + tid + '\')">💾 บันทึก</button>');
}

function editStep(tid, idx) {
  var t = ST.getOne('tasks', tid);
  if (!t || !t.steps || !t.steps[idx]) return;
  var s = t.steps[idx];
  openM('✏️ Step', '' +
    '<div class="fg"><label>ชื่อ *</label><input type="text" id="fs_t" value="' + sanitize(s.title) + '"></div>' +
    '<div class="fr">' + dpH('fs_s', s.startDate || '', 'วันที่ทำ') + dpH('fs_e', s.dueDate || '', 'วันที่เสร็จ') + '</div>' +
    '<div class="fg"><label>🔗 Link (URL)</label><input type="url" id="fs_url" value="' + sanitize(s.url || '') + '" placeholder="https://..."></div>' +
    '<div class="fg"><label>หมายเหตุ</label><textarea id="fs_n" rows="2">' + sanitize(s.notes || '') + '</textarea></div>' +
    '<button class="btn bp btn-full" onclick="updateStep(\'' + tid + '\',' + idx + ')">💾 บันทึก</button>');
}

function saveStep(tid) {
  var t = ST.getOne('tasks', tid);
  if (!t) return;
  var title = document.getElementById('fs_t');
  if (!title || !title.value.trim()) return alert('ใส่ชื่อ');
  var s = {
    id: gid(),
    title: title.value.trim(),
    startDate: dpG('fs_s'),
    dueDate: dpG('fs_e'),
    url: document.getElementById('fs_url') ? document.getElementById('fs_url').value.trim() : '',
    notes: document.getElementById('fs_n') ? document.getElementById('fs_n').value.trim() : '',
    done: false,
    kanban: 'todo'
  };
  if (!t.steps) t.steps = [];
  t.steps.push(s);
  ST.update('tasks', tid, {steps: t.steps});
  closeMForce();
  toast('✅ เพิ่ม Step');
  render();
}

function updateStep(tid, idx) {
  var t = ST.getOne('tasks', tid);
  if (!t || !t.steps || !t.steps[idx]) return;
  var title = document.getElementById('fs_t');
  if (!title || !title.value.trim()) return alert('ใส่ชื่อ');
  t.steps[idx].title = title.value.trim();
  t.steps[idx].startDate = dpG('fs_s');
  t.steps[idx].dueDate = dpG('fs_e');
  t.steps[idx].url = document.getElementById('fs_url') ? document.getElementById('fs_url').value.trim() : '';
  t.steps[idx].notes = document.getElementById('fs_n') ? document.getElementById('fs_n').value.trim() : '';
  ST.update('tasks', tid, {steps: t.steps});
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}
// ================================================================
// TASK LOG MODAL
// ================================================================
function showTaskLogM(tid) {
  openM('➕ Log', '' +
    '<div class="fg"><label>ประเภท</label><select id="ftl_t">' +
    '<option value="progress">🟢 คืบหน้า</option>' +
    '<option value="problem">🔴 ปัญหา</option>' +
    '<option value="solution">🟡 แก้ไข</option>' +
    '<option value="note">⚪ หมายเหตุ</option>' +
    '</select></div>' +
    '<div class="fg"><label>รายละเอียด *</label><textarea id="ftl_c" rows="3"></textarea></div>' +
    dpH('ftl_d', _td(), 'วันที่') +
    '<button class="btn bp btn-full" onclick="saveTaskLog(\'' + tid + '\')">💾 บันทึก</button>');
}

function saveTaskLog(tid) {
  var content = document.getElementById('ftl_c');
  if (!content || !content.value.trim()) return alert('ใส่รายละเอียด');
  ST.add('taskLogs', {
    tid: tid,
    type: document.getElementById('ftl_t') ? document.getElementById('ftl_t').value : 'note',
    content: content.value.trim(),
    date: (dpG('ftl_d') || _td()) + 'T' + new Date().toTimeString().slice(0, 8)
  });
  closeMForce();
  toast('📝 บันทึกแล้ว');
  render();
}

// ================================================================
// MEETING MODAL
// ================================================================
function showMeetingM(eid) {
  var m = eid ? ST.getOne('meetings', eid) : {};
  openM(eid ? '✏️ ประชุม' : '➕ ประชุม', '' +
    '<div class="fg"><label>หัวข้อ *</label><input type="text" id="fm_t" value="' + sanitize(m.title || '') + '"></div>' +
    '<div class="fr">' +
    '<div class="fg"><label>ประเภท</label><input type="text" id="fm_tp" value="' + sanitize(m.type || '') + '" list="mtL"><datalist id="mtL"><option value="ประชุม Team Sales Drone"><option value="ประชุมลูกค้า"><option value="อบรม"></datalist></div>' +
    '<div class="fg"><label>สถานที่</label><input type="text" id="fm_loc" value="' + sanitize(m.location || '') + '"></div>' +
    '</div>' +
    '<div class="fr3">' + dpH('fm_d', m.date || _td(), 'วันที่ *') +
    '<div class="fg"><label>เริ่ม</label><input type="time" id="fm_s" value="' + (m.time || '') + '"></div>' +
    '<div class="fg"><label>จบ</label><input type="time" id="fm_e" value="' + (m.endTime || '') + '"></div>' +
    '</div>' +
    '<div class="fg"><label>ผู้เข้าร่วม</label><input type="text" id="fm_att" value="' + sanitize(m.attendees || '') + '"></div>' +
    '<div class="fg"><label>วาระ</label><textarea id="fm_ag">' + sanitize(m.agenda || '') + '</textarea></div>' +
    '<div class="fg"><label>บันทึก</label><textarea id="fm_n">' + sanitize(m.notes || '') + '</textarea></div>' +
    '<div class="fg"><label>มติ</label><textarea id="fm_dec">' + sanitize(m.decisions || '') + '</textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveMeeting(\'' + (eid || '') + '\')">💾 บันทึก</button>');
}

function saveMeeting(eid) {
  var title = document.getElementById('fm_t');
  var date = dpG('fm_d');
  if (!title || !title.value.trim() || !date) return alert('ใส่หัวข้อ + วันที่');
  var data = {
    title: title.value.trim(),
    type: document.getElementById('fm_tp') ? document.getElementById('fm_tp').value.trim() : '',
    location: document.getElementById('fm_loc') ? document.getElementById('fm_loc').value.trim() : '',
    date: date,
    time: document.getElementById('fm_s') ? document.getElementById('fm_s').value : '',
    endTime: document.getElementById('fm_e') ? document.getElementById('fm_e').value : '',
    attendees: document.getElementById('fm_att') ? document.getElementById('fm_att').value.trim() : '',
    agenda: document.getElementById('fm_ag') ? document.getElementById('fm_ag').value.trim() : '',
    notes: document.getElementById('fm_n') ? document.getElementById('fm_n').value.trim() : '',
    decisions: document.getElementById('fm_dec') ? document.getElementById('fm_dec').value.trim() : ''
  };
  if (eid) {
    ST.update('meetings', eid, data);
    closeMForce();
    go('meetingDetail', {meetingId: eid});
  } else {
    data.actions = [];
    var m = ST.add('meetings', data);
    closeMForce();
    go('meetingDetail', {meetingId: m.id});
  }
  toast('💾 บันทึกแล้ว');
}

function delMeeting(id) {
  if (!confirm('ลบประชุมนี้?')) return;
  ST.delete('meetings', id);
  go('meetings');
  toast('🗑️ ลบแล้ว');
}

// ================================================================
// ACTION ITEMS (Meeting)
// ================================================================
function showActionM(mid) {
  openM('➕ Action Item', '' +
    '<div class="fg"><label>ชื่อ *</label><input type="text" id="fa_t"></div>' +
    '<div class="fr">' +
    '<div class="fg"><label>ผู้รับผิดชอบ</label><input type="text" id="fa_a"></div>' +
    dpH('fa_d', '', 'กำหนดเสร็จ') +
    '</div>' +
    '<button class="btn bp btn-full" onclick="saveAction(\'' + mid + '\')">💾 บันทึก</button>');
}

function saveAction(mid) {
  var m = ST.getOne('meetings', mid);
  if (!m) return;
  var title = document.getElementById('fa_t');
  if (!title || !title.value.trim()) return alert('ใส่ชื่อ');
  var a = {
    id: gid(),
    title: title.value.trim(),
    assignee: document.getElementById('fa_a') ? document.getElementById('fa_a').value.trim() : '',
    dueDate: dpG('fa_d'),
    done: false
  };
  if (!m.actions) m.actions = [];
  m.actions.push(a);
  ST.update('meetings', mid, {actions: m.actions});
  closeMForce();
  toast('📌 เพิ่มแล้ว');
  render();
}

function togAction(mid, i) {
  var m = ST.getOne('meetings', mid);
  if (!m || !m.actions || !m.actions[i]) return;
  m.actions[i].done = !m.actions[i].done;
  ST.update('meetings', mid, {actions: m.actions});
  render();
}

function delAction(mid, i) {
  if (!confirm('ลบ?')) return;
  var m = ST.getOne('meetings', mid);
  if (!m || !m.actions) return;
  m.actions.splice(i, 1);
  ST.update('meetings', mid, {actions: m.actions});
  render();
}
// ================================================================
// ROUTINE MODAL
// ================================================================
function showRoutineM(eid) {
  var r = eid ? ST.getOne('routines', eid) : {};
  openM(eid ? '✏️ Routine' : '➕ Routine', '' +
    '<div class="fg"><label>ชื่อ *</label><input type="text" id="fr_t" value="' + sanitize(r.title || '') + '"></div>' +
    '<div class="fr">' +
    '<div class="fg"><label>เวลา</label><input type="time" id="fr_tm" value="' + (r.time || '') + '"></div>' +
    '<div class="fg"><label>วัน</label><select id="fr_d">' +
    '<option value="daily"' + ((r.days || 'daily') === 'daily' ? ' selected' : '') + '>ทุกวัน</option>' +
    '<option value="mon-wed"' + (r.days === 'mon-wed' ? ' selected' : '') + '>จ.-พ.</option>' +
    '<option value="mon-fri"' + (r.days === 'mon-fri' ? ' selected' : '') + '>จ.-ศ.</option>' +
    '<option value="mon"' + (r.days === 'mon' ? ' selected' : '') + '>จันทร์</option>' +
    '<option value="tue"' + (r.days === 'tue' ? ' selected' : '') + '>อังคาร</option>' +
    '<option value="wed"' + (r.days === 'wed' ? ' selected' : '') + '>พุธ</option>' +
    '<option value="thu"' + (r.days === 'thu' ? ' selected' : '') + '>พฤหัสบดี</option>' +
    '<option value="fri"' + (r.days === 'fri' ? ' selected' : '') + '>ศุกร์</option>' +
    '</select></div></div>' +
    '<div class="fg"><label>หมวด</label><input type="text" id="fr_c" value="' + sanitize(r.category || '') + '" list="rcL">' +
    '<datalist id="rcL"><option value="เช้า"><option value="เย็น"><option value="จ.-พ."><option value="พฤ."><option value="ศ."><option value="ติดตาม"></datalist></div>' +
    '<button class="btn bp btn-full" onclick="saveRoutine(\'' + (eid || '') + '\')">💾 บันทึก</button>');
}

function saveRoutine(eid) {
  var title = document.getElementById('fr_t');
  if (!title || !title.value.trim()) return alert('ใส่ชื่อ');
  var data = {
    title: title.value.trim(),
    time: document.getElementById('fr_tm') ? document.getElementById('fr_tm').value : '',
    days: document.getElementById('fr_d') ? document.getElementById('fr_d').value : 'daily',
    category: document.getElementById('fr_c') ? document.getElementById('fr_c').value.trim() : ''
  };
  if (eid) ST.update('routines', eid, data);
  else ST.add('routines', data);
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

// ================================================================
// TEMPLATE MODAL
// ================================================================
function showTemplateM(eid) {
  var tp = eid ? ST.getOne('templates', eid) : {steps: []};
  var stepsText = '';
  var steps = tp.steps || [];
  for (var i = 0; i < steps.length; i++) {
    stepsText += steps[i].title + '|' + (steps[i].offsetDays || 0) + '|' + (steps[i].durationDays || 0) + '\n';
  }
  
  openM(eid ? '✏️ Template' : '➕ Template', '' +
    '<div class="fg"><label>ชื่อ *</label><input type="text" id="ftp_n" value="' + sanitize(tp.name || '') + '"></div>' +
    '<div class="fg"><label>⚡ Flow</label><select id="ftp_sq">' +
    '<option value="0"' + (tp.sequential ? '' : ' selected') + '>ปิด</option>' +
    '<option value="1"' + (tp.sequential ? ' selected' : '') + '>เปิด (ไล่ลำดับ)</option>' +
    '</select></div>' +
    '<div class="fg"><label>Steps (ชื่อ|เริ่มหลังกี่วัน|จำนวนวัน)</label>' +
    '<textarea id="ftp_s" rows="6" placeholder="กรอกข้อมูล|0|3&#10;ส่งเอกสาร|3|2">' + stepsText + '</textarea>' +
    '<div class="hint">แต่ละบรรทัด = 1 Step</div></div>' +
    '<button class="btn bp btn-full" onclick="saveTemplate(\'' + (eid || '') + '\')">💾 บันทึก</button>');
}

function saveTemplate(eid) {
  var name = document.getElementById('ftp_n');
  if (!name || !name.value.trim()) return alert('ใส่ชื่อ');
  var sq = document.getElementById('ftp_sq') ? document.getElementById('ftp_sq').value === '1' : false;
  var stepsRaw = document.getElementById('ftp_s') ? document.getElementById('ftp_s').value.trim() : '';
  var lines = stepsRaw.split('\n');
  var steps = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var parts = line.split('|');
    var title = parts[0] ? parts[0].trim() : '';
    if (!title) continue;
    steps.push({
      title: title,
      offsetDays: parseInt(parts[1]) || 0,
      durationDays: parseInt(parts[2]) || 0
    });
  }
  
  if (eid) ST.update('templates', eid, {name: name.value.trim(), sequential: sq, steps: steps});
  else ST.add('templates', {name: name.value.trim(), sequential: sq, steps: steps});
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

function showTplDet(id) {
  var tp = ST.getOne('templates', id);
  if (!tp) return;
  var stepsHtml = '';
  var steps = tp.steps || [];
  for (var i = 0; i < steps.length; i++) {
    stepsHtml += '<div class="si"><div style="flex:1"><div class="stt">' + (i + 1) + '. ' + sanitize(steps[i].title) + '</div>' +
      '<div class="sd">' + (steps[i].offsetDays ? '+' + steps[i].offsetDays + 'd' : 'start') + (steps[i].durationDays ? ' → ' + steps[i].durationDays + 'd' : '') + '</div></div></div>';
  }
  openM('📑 ' + tp.name, stepsHtml +
    '<div class="bg" style="margin-top:8px">' +
    '<button class="btn bp" onclick="closeMForce();useTpl(\'' + tp.id + '\')">🚀 ใช้</button>' +
    '<button class="btn bo" onclick="closeMForce();showTemplateM(\'' + tp.id + '\')">✏️</button>' +
    '<button class="btn bd" onclick="ST.delete(\'templates\',\'' + tp.id + '\');closeMForce();render()">🗑️</button></div>');
}

function useTpl(tid) {
  var tp = ST.getOne('templates', tid);
  if (!tp) return;
  openM('🚀 ใช้ Template', '' +
    '<div class="fg"><label>ชื่อ *</label><input type="text" id="ut_n" value="' + sanitize(tp.name) + '"></div>' +
    dpH('ut_d', _td(), 'วันเริ่ม') +
    '<button class="btn bp btn-full" onclick="applyTpl(\'' + tid + '\')">🚀 สร้างงาน</button>');
}

function applyTpl(tid) {
  var tp = ST.getOne('templates', tid);
  if (!tp) return;
  var nameEl = document.getElementById('ut_n');
  var nm = nameEl ? nameEl.value.trim() : '';
  var sd = dpG('ut_d') || _td();
  if (!nm) return alert('ใส่ชื่อ');
  
  var steps = [];
  var tpSteps = tp.steps || [];
  for (var i = 0; i < tpSteps.length; i++) {
    steps.push({
      id: gid(),
      title: tpSteps[i].title,
      startDate: addD(sd, tpSteps[i].offsetDays || 0),
      dueDate: addD(sd, (tpSteps[i].offsetDays || 0) + (tpSteps[i].durationDays || 0)),
      notes: '',
      done: false,
      kanban: 'todo'
    });
  }
  
  var last = steps.length ? steps[steps.length - 1].dueDate : sd;
  var t = ST.add('tasks', {
    title: nm,
    description: 'จาก Template: ' + tp.name,
    startDate: sd,
    dueDate: last,
    priority: 'medium',
    category: 'Template',
    status: 'active',
    steps: steps,
    sequential: !!tp.sequential
  });
  closeMForce();
  toast('🚀 สร้างแล้ว');
  go('taskDetail', {taskId: t.id});
}

// ================================================================
// KNOWLEDGE BASE MODAL (Enhanced)
// ================================================================
function showNoteM(eid) {
  var n = eid ? ST.getOne('notes', eid) : {};
  var cfg = getConfig();
  var cats = cfg.noteCategories || [];
  var dealers = ST.getAll('dealers');
  
  // Status options
  var statusOpts = '' +
    '<option value="active"' + ((n.status || 'active') === 'active' ? ' selected' : '') + '>✅ ใช้งานอยู่</option>' +
    '<option value="expired"' + (n.status === 'expired' ? ' selected' : '') + '>⏰ หมดอายุ</option>' +
    '<option value="cancelled"' + (n.status === 'cancelled' ? ' selected' : '') + '>❌ ยกเลิกแล้ว</option>' +
    '<option value="draft"' + (n.status === 'draft' ? ' selected' : '') + '>📝 Draft</option>';

  openM(eid ? '✏️ แก้ไข Note' : '📚 เพิ่ม Note', '' +
    '<div class="fg"><label>หัวข้อ *</label><input type="text" id="fn_title" value="' + sanitize(n.title || '') + '"></div>' +
    
    '<div class="fr">' +
    '<div class="fg"><label>หมวดหมู่</label><select id="fn_cat">' + optionsHTML(cats, n.category || '', '-- เลือก --') + '</select></div>' +
    '<div class="fg"><label>สถานะ</label><select id="fn_status">' + statusOpts + '</select></div>' +
    '</div>' +
    
    '<div class="fr">' +
    dpH('fn_expire', n.expireDate || '', 'วันหมดอายุ (ถ้ามี)') +
    dpH('fn_remind', n.remindDate || '', 'วันเตือน (ถ้ามี)') +
    '</div>' +
    
    '<div class="fg"><label>Dealer (ไม่บังคับ)</label><select id="fn_dealer">' +
    '<option value="">-- ไม่เกี่ยวกับ Dealer --</option>' +
    dealers.map(function(d) {
      return '<option value="' + d.id + '"' + (n.dealerId === d.id ? ' selected' : '') + '>' + d.name + '</option>';
    }).join('') +
    '</select></div>' +
    
    '<div class="fg"><label>เนื้อหา *</label>' +
    '<textarea id="fn_content" rows="10" style="font-size:.78rem;line-height:1.5">' + sanitize(n.content || '') + '</textarea>' +
    '<div class="hint">รองรับข้อความยาว พิมพ์ได้เต็มที่</div></div>' +
    
    '<div class="fg"><label>🔗 Links (บรรทัดละ 1 URL)</label>' +
    '<textarea id="fn_links" rows="3" placeholder="https://example.com/doc1&#10;https://example.com/doc2">' + sanitize(n.links || '') + '</textarea></div>' +
    
    '<div class="fg"><label>🏷️ Tags (คั่นด้วย ,)</label>' +
    '<input type="text" id="fn_tags" value="' + sanitize(n.tags || '') + '" placeholder="policy, pricing, dealer, important"></div>' +
    
    '<div class="fg"><label>📌 ปักหมุด</label><div class="radio-g">' +
    '<label><input type="radio" name="fn_pin" value="0"' + (!n.pinned ? ' checked' : '') + '><span>ไม่</span></label>' +
    '<label><input type="radio" name="fn_pin" value="1"' + (n.pinned ? ' checked' : '') + '><span>📌 ปักหมุด</span></label>' +
    '</div></div>' +
    
    '<button class="btn bp btn-full" onclick="saveNote(\'' + (eid || '') + '\')">💾 บันทึก</button>');
}

function saveNote(eid) {
  var title = document.getElementById('fn_title');
  var content = document.getElementById('fn_content');
  if (!title || !title.value.trim()) return alert('ใส่หัวข้อ');
  if (!content || !content.value.trim()) return alert('ใส่เนื้อหา');
  
  var pinEl = document.querySelector('input[name="fn_pin"]:checked');
  var data = {
    title: title.value.trim(),
    category: document.getElementById('fn_cat') ? document.getElementById('fn_cat').value : '',
    status: document.getElementById('fn_status') ? document.getElementById('fn_status').value : 'active',
    expireDate: dpG('fn_expire'),
    remindDate: dpG('fn_remind'),
    dealerId: document.getElementById('fn_dealer') ? document.getElementById('fn_dealer').value : '',
    content: content.value.trim(),
    links: document.getElementById('fn_links') ? document.getElementById('fn_links').value.trim() : '',
    tags: document.getElementById('fn_tags') ? document.getElementById('fn_tags').value.trim() : '',
    pinned: pinEl ? pinEl.value === '1' : false
  };
  
  if (eid) {
    ST.update('notes', eid, data);
    closeMForce();
    go('noteDetail', {noteId: eid});
  } else {
    var n = ST.add('notes', data);
    closeMForce();
    go('noteDetail', {noteId: n.id});
  }
  toast('💾 บันทึก Note แล้ว');
}

// ================================================================
// IMPORT DEALER MODAL
// ================================================================
function showImportDealerM() {
  openM('📥 Import Dealer (.xlsx)',
    '<div class="fg"><label>เลือกไฟล์ Excel</label>' +
    '<input type="file" id="imp_dl_file" accept=".xlsx,.xls" class="fi" onchange="previewDealerImport(this)">' +
    '<div class="hint" style="margin-top:5px">คอลัมน์ที่รองรับ: id, ชื่อบริษัท, SIS Code, DJI Code, Level, DJI Dealer, Credit Term, Credit Limit, Target Revenue, ผู้ติดต่อ, Google Map, หมายเหตุ<br>ถ้ามี id และตรงกับข้อมูลเดิม → อัปเดต, ถ้าไม่มี id → เพิ่มใหม่</div></div>' +
    '<div id="imp_dl_preview"></div>' +
    '<button class="btn bp btn-full" onclick="importDealersExcel()" style="margin-top:8px">📥 Import</button>');
}

function previewDealerImport(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var wb = XLSX.read(e.target.result, {type:'array'});
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, {defval:''});
    var prev = document.getElementById('imp_dl_preview');
    if (!prev) return;
    if (!rows.length) { prev.innerHTML = '<div style="color:#ef4444;font-size:12px">ไม่พบข้อมูลในไฟล์</div>'; return; }
    var add = 0, upd = 0;
    rows.forEach(function(r) {
      var id = String(r['id']||'').trim();
      if (id && ST.getOne('dealers', id)) upd++; else add++;
    });
    prev.innerHTML = '<div style="font-size:12px;color:#94a3b8;background:#0f172a;border-radius:6px;padding:8px;margin-top:6px">' +
      '✅ พบข้อมูล <strong>' + rows.length + '</strong> แถว — เพิ่มใหม่ <strong style="color:#22c55e">' + add + '</strong> อัปเดต <strong style="color:#3b82f6">' + upd + '</strong></div>';
  };
  reader.readAsArrayBuffer(file);
}

function importDealersExcel() {
  var file = document.getElementById('imp_dl_file') && document.getElementById('imp_dl_file').files[0];
  if (!file) return alert('เลือกไฟล์ก่อน');
  var reader = new FileReader();
  reader.onload = function(e) {
    var wb = XLSX.read(e.target.result, {type:'array'});
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, {defval:''});
    if (!rows.length) return alert('ไม่พบข้อมูลในไฟล์');
    var added = 0, updated = 0, skipped = 0;
    rows.forEach(function(r) {
      var name = String(r['ชื่อบริษัท'] || r['name'] || '').trim();
      if (!name) { skipped++; return; }
      var id = String(r['id'] || '').trim();
      var data = {
        name: name,
        sisCode:        String(r['SIS Code']       || r['sisCode']        || '').trim(),
        djiCode:        String(r['DJI Code']        || r['djiCode']        || '').trim(),
        level:          String(r['Level']           || r['level']          || 'B').trim(),
        djiDealer:      String(r['DJI Dealer']      || r['djiDealer']      || '').trim(),
        creditTerm:     String(r['Credit Term']     || r['creditTerm']     || '').trim(),
        creditLimit:    String(r['Credit Limit']    || r['creditLimit']    || '').trim(),
        targetRevenue:  String(r['Target Revenue']  || r['targetRevenue']  || '').trim(),
        contact:        String(r['ผู้ติดต่อ']       || r['contact']        || '').trim(),
        googleMap:      String(r['Google Map']      || r['googleMap']      || '').trim(),
        notes:          String(r['หมายเหตุ']        || r['notes']          || '').trim(),
        paymentCondition: String(r['Payment Condition'] || r['paymentCondition'] || '').trim()
      };
      if (id && ST.getOne('dealers', id)) {
        ST.update('dealers', id, data);
        updated++;
      } else {
        ST.add('dealers', data);
        added++;
      }
    });
    closeMForce();
    toast('📥 เพิ่ม ' + added + ' อัปเดต ' + updated + (skipped ? ' ข้าม ' + skipped : '') + ' Dealer');
    render();
  };
  reader.readAsArrayBuffer(file);
}

// ================================================================
// IMPORT PIPELINE MODAL
// ================================================================
function showImportPipelineM() {
  openM('📥 Import Pipeline', '' +
    '<div class="fg"><label>วิธีที่ 1: วาง JSON</label>' +
    '<textarea id="imp_pipe_json" rows="6" placeholder="วาง JSON ข้อมูล Pipeline ที่นี่..."></textarea></div>' +
    '<button class="btn bp btn-full" onclick="importPipelineJSON()">📥 Import จาก JSON</button>' +
    '<div style="margin:10px 0;text-align:center;color:#64748b;font-size:.72rem">— หรือ —</div>' +
    '<div class="fg"><label>วิธีที่ 2: เลือกไฟล์ .json</label>' +
    '<input type="file" id="imp_pipe_file" accept=".json" onchange="importPipelineFile(event)" style="font-size:.76rem"></div>' +
    '<div style="margin:10px 0;text-align:center;color:#64748b;font-size:.72rem">— หรือ —</div>' +
    '<div class="fg"><label>วิธีที่ 3: นำเข้าจาก Google Sheet (.csv)</label>' +
    '<input type="file" id="imp_pipe_csv" accept=".csv" onchange="importPipelineCSVFile(event)" style="font-size:.76rem"></div>' +
    '<div style="margin-top:10px;font-size:.68rem;color:#64748b">' +
    '💡 จับคู่ Dealer Name อัตโนมัติ<br>' +
    '⚠️ ถ้าหาไม่เจอจะสร้าง Dealer ใหม่ให้<br>' +
    '📥 CSV: จะมีหน้า Preview ให้เลือก Dealer ก่อน ไม่กระทบ Dealer/Pipeline เดิม</div>');
}

function importPipelineJSON() {
  var el = document.getElementById('imp_pipe_json');
  if (!el || !el.value.trim()) return alert('วาง JSON');
  try {
    var data = JSON.parse(el.value.trim());
    var items = data.pipelines || data;
    if (!Array.isArray(items)) items = [items];
    var result = processPipelineImport(items);
    closeMForce();
    toast('📥 Import ' + result.success + '/' + result.total + ' โครงการ' + (result.skipped ? ' (ข้าม ' + result.skipped + ')' : ''));
    render();
  } catch (e) { alert('❌ JSON ไม่ถูกต้อง: ' + e.message); }
}

function importPipelineFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      var items = data.pipelines || data;
      if (!Array.isArray(items)) items = [items];
      var result = processPipelineImport(items);
      closeMForce();
      toast('📥 Import ' + result.success + '/' + result.total + ' โครงการ' + (result.skipped ? ' (ข้าม ' + result.skipped + ')' : ''));
      render();
    } catch (err) { alert('❌ ไฟล์ไม่ถูกต้อง: ' + err.message); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function processPipelineImport(items) {
  var dealers = ST.getAll('dealers');
  var success = 0, skipped = 0, total = items.length;
  
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var dealerId = '';
    var dealerName = item.dealerName || '';
    
    // Find dealer by name (exact or partial match)
    for (var j = 0; j < dealers.length; j++) {
      if (dealers[j].name && dealerName) {
        var dn = dealers[j].name.toLowerCase().replace(/[^a-z0-9]/g, '');
        var sn = dealerName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (dn.indexOf(sn) !== -1 || sn.indexOf(dn) !== -1) {
          dealerId = dealers[j].id;
          break;
        }
      }
    }
    
    // Auto-create dealer if not found
    if (!dealerId && dealerName) {
      var newDealer = ST.add('dealers', {
        name: dealerName,
        level: 'B',
        showSerial: 'Y',
        djiDealer: item.djiDealer || ''
      });
      dealerId = newDealer.id;
      dealers.push(newDealer);
      console.log('✅ Auto-created Dealer: ' + dealerName);
    }
    
    if (!dealerId) {
      console.log('⚠️ Skip: No dealer for: ' + (item.projectName || '').substr(0, 40));
      skipped++;
      continue;
    }
    
   // No duplicate check — import ทุกรายการ
    
    // Create pipeline
    var pipeData = {
      registerDate: item.registerDate || '',
      projectName: item.projectName || '',
      endUserTH: item.endUserTH || '',
      endUserEN: item.endUserEN || '',
      unitType: item.unitType || '',
      dealerId: dealerId,
      djiDealer: item.djiDealer || '',
      model: item.model || '',
      modelQty: parseInt(item.modelQty) || 1,
      forecastAmount: parseFloat(item.forecastAmount) || 0,
      realAmount: parseFloat(item.realAmount) || 0,
      tor: item.tor || '',
      biddingDate: item.biddingDate || '',
      shipmentDate: item.shipmentDate || '',
      remark: item.remark || '',
      appointmentLetter: item.appointmentLetter || '',
      status: item.status || 'prospect',
      recurring: !!item.recurring,
      nextAction: '',
      followupDate: ''
    };
    
    if (item.lossReason) pipeData.lossReason = item.lossReason;
    if (item.lossCompetitor) pipeData.lossCompetitor = item.lossCompetitor;
    if (item.winReason) pipeData.winReason = item.winReason;
    
    var pipe = ST.add('pipeline', pipeData);
    
    // Add updates as pipeline logs
    var updates = item.updates || [];
    for (var u = 0; u < updates.length; u++) {
      if (updates[u] && updates[u].trim()) {
        ST.add('pipeLog', {
          pipeId: pipe.id,
          type: 'update',
          content: updates[u].trim(),
          date: pipe.created || _nw()
        });
      }
    }
    success++;
  }

  return {total: total, success: success, skipped: skipped};
}

// ================================================================
// IMPORT PIPELINE FROM GOOGLE SHEET CSV — เลือกได้เฉพาะ Dealer ใหม่
// ================================================================
var _csvImportGroups = null;

function importPipelineCSVFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var text = String(e.target.result || '').replace(/^﻿/, '');
      var rows = _parseCSVText(text);
      if (!rows.length) { alert('❌ ไฟล์ว่างหรืออ่านไม่ได้'); return; }
      var headers = rows[0].map(function(h) { return h.trim(); });
      var objects = rows.slice(1).filter(function(r) { return r.some(function(c) { return c && c.trim(); }); }).map(function(r) {
        var o = {};
        headers.forEach(function(h, idx) { o[h] = r[idx] !== undefined ? r[idx] : ''; });
        return o;
      });
      if (!objects.length) { alert('❌ ไม่พบข้อมูลในไฟล์'); return; }
      _buildCsvImportGroups(objects);
      showPipeCSVPreviewM();
    } catch (err) { alert('❌ อ่านไฟล์ไม่ได้: ' + err.message); }
  };
  reader.readAsText(file, 'UTF-8');
  event.target.value = '';
}

// CSV parser รองรับ quoted field ที่มี comma/newline ข้างใน (เช่นเซลล์ Model หลายบรรทัด)
function _parseCSVText(text) {
  var rows = [], row = [], field = '', inQuotes = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(function(r) { return r.length > 1 || (r[0] && r[0].trim()); });
}

function _csvDateToISO(s) {
  s = (s || '').trim();
  if (!s || s === '-') return '';
  var p = s.split('/');
  if (p.length !== 3) return '';
  var y = p[2].length === 2 ? '20' + p[2] : p[2];
  return y + '-' + ('' + p[1]).padStart(2, '0') + '-' + ('' + p[0]).padStart(2, '0');
}

function _csvStatusToId(text) {
  text = (text || '').trim();
  var cfg = getConfig();
  var list = cfg.pipelineStatuses || [];
  for (var i = 0; i < list.length; i++) { if (list[i].name === text) return list[i].id; }
  var clean = text.replace(/[^฀-๿a-zA-Z]/g, '').toLowerCase();
  for (var j = 0; j < list.length; j++) {
    var lc = list[j].name.replace(/[^฀-๿a-zA-Z]/g, '').toLowerCase();
    if (lc === clean) return list[j].id;
  }
  return 'prospect';
}

function _buildCsvImportGroups(objects) {
  var dealers = ST.getAll('dealers');
  var groups = {};
  objects.forEach(function(o) {
    var dn = (o['Dealer Name'] || '').trim();
    if (!dn) return;
    if (!groups[dn]) {
      var match = null;
      for (var j = 0; j < dealers.length; j++) {
        if (!dealers[j].name) continue;
        var a = dealers[j].name.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
        var b = dn.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
        if (a && b && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1)) { match = dealers[j]; break; }
      }
      groups[dn] = { dealerName: dn, rows: [], existingMatch: match };
    }
    groups[dn].rows.push(o);
  });
  _csvImportGroups = groups;
}

function showPipeCSVPreviewM() {
  var groups = _csvImportGroups;
  if (!groups) return;
  var names = Object.keys(groups);
  var h = '<div style="max-width:560px">';
  h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:10px">ติ๊กเฉพาะ Dealer ที่ต้องการนำเข้า — Dealer ที่ไม่ติ๊กจะไม่ถูกแก้ไขหรือสร้างใหม่เลย</p>';
  h += '<div style="max-height:50vh;overflow-y:auto;border:1px solid var(--border,#334155);border-radius:8px">';
  h += '<table class="tbl" style="width:100%"><thead><tr><th></th><th>Dealer Name (จากไฟล์)</th><th>จำนวน</th><th>สถานะ</th></tr></thead><tbody>';
  names.forEach(function(n, idx) {
    var g = groups[n];
    var warn = g.existingMatch ? ('⚠️ มีชื่อคล้าย "' + sanitize(g.existingMatch.name) + '" อยู่แล้ว') : '🆕 ใหม่';
    var checked = g.existingMatch ? '' : 'checked';
    h += '<tr><td><input type="checkbox" id="csvg_' + idx + '" ' + checked + '></td>';
    h += '<td>' + sanitize(n) + '</td><td>' + g.rows.length + '</td><td style="font-size:.74rem">' + warn + '</td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<div style="display:flex;gap:8px;margin-top:14px">';
  h += '<button class="btn bp" style="flex:1" onclick="confirmPipeCSVImport()">📥 นำเข้าที่เลือกไว้</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button></div></div>';
  openM('📥 Preview Import จาก Google Sheet', h);
  window._csvGroupNames = names;
}

function confirmPipeCSVImport() {
  var groups = _csvImportGroups, names = window._csvGroupNames || [];
  if (!groups) return;
  var dealersAdded = 0, pipesAdded = 0;

  names.forEach(function(n, idx) {
    var chk = document.getElementById('csvg_' + idx);
    if (!chk || !chk.checked) return;
    var g = groups[n];

    var newDealer = ST.add('dealers', { name: n, level: 'B', showSerial: 'Y', djiDealer: (g.rows[0]['DJI Dealer'] || '') });
    dealersAdded++;

    g.rows.forEach(function(o) {
      var modelLines = (o['Model'] || '').split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
      var items = modelLines.map(function(l) {
        var p = l.split('*');
        return { model: p[0] || '', qty: parseInt(p[1]) || 1 };
      });
      var pipeData = {
        registerDate: _csvDateToISO(o['Register Date']),
        projectName: o['Project Name'] || '',
        endUserTH: o['End User Name'] || '',
        endUserEN: o['End User Name Eng'] || '',
        unitType: o['Unit type'] || '',
        dealerId: newDealer.id,
        djiDealer: o['DJI Dealer'] || '',
        projectRevenue: parseFloat(o['Project revenue']) || 0,
        items: items,
        model: items[0] ? items[0].model : '',
        modelQty: items[0] ? items[0].qty : 1,
        forecastAmount: parseFloat(o['Forecast Amount']) || 0,
        realAmount: parseFloat(o['Real Amount']) || 0,
        tor: o['TOR'] || '',
        biddingDate: _csvDateToISO(o['Bidding Date']),
        shipmentDate: _csvDateToISO(o['Shipment date']),
        remark: o['Remark'] || '',
        appointmentLetter: o['Letter of Authorized หนังสือแต่งตั้ง'] || '',
        status: _csvStatusToId(o['Status']),
        recurring: (o['Duplicate งานซ้ำ'] || '').trim().toLowerCase() === 'yes',
        saleName: o['Sale'] || '',
        sheetDisplay: (o['DISPLAY (Hide/Show)'] || 'Show').trim() || 'Show',
        nextAction: '', followupDate: ''
      };
      var pipe = ST.add('pipeline', pipeData);
      pipesAdded++;

      for (var u = 1; u <= 6; u++) {
        var up = (o['Update ' + u] || '').trim();
        if (up) ST.add('pipeLog', { pipeId: pipe.id, type: 'note', content: up, date: pipeData.registerDate || _nw() });
      }
    });
  });

  closeMForce();
  toast('📥 นำเข้าสำเร็จ: Dealer ใหม่ ' + dealersAdded + ' ราย, Pipeline ' + pipesAdded + ' โครงการ');
  render();
}

// ================================================================
// ADD PIPE ACTION MODAL (สำหรับ Pipeline)
// ================================================================
function showAddPipeActionM(pipeId) {
  var pipe = ST.getOne('pipeline', pipeId);
  if (!pipe) return;
  var today = _td();

  var h = '<div style="max-width:450px">';
  h += '<div style="padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:12px">';
  h += '<div style="font-weight:600">📊 ' + sanitize(pipe.projectName || pipe.name || '-') + '</div>';
  h += '</div>';

  // Quick actions
  h += '<div class="fm-group"><label>⚡ Quick Action</label>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอเอกสารจากลูกค้า\')">📄 รอเอกสาร</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอลูกค้าตอบ Quote\')">💰 รอตอบ Quote</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'รอ TOR\')">📋 รอ TOR</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'นัด Demo\')">🎯 นัด Demo</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'ส่ง Spec เพิ่มเติม\')">🚁 ส่ง Spec</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'ติดต่อ DJI\')">📞 ติดต่อ DJI</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'เตรียมเอกสาร Bidding\')">📊 เตรียม Bidding</button>';
  h += '<button class="btn-sm" onclick="paQuickFill(\'Follow-up ลูกค้า\')">🔄 Follow-up</button>';
  h += '</div></div>';

  h += '<div class="fm-group"><label>📝 สิ่งที่ต้องทำ / ติดตาม</label>';
  h += '<input type="text" id="paText" class="fm-input" placeholder="เช่น รอ TOR จากลูกค้า..."></div>';

  h += '<div class="fm-group"><label>📅 กำหนดวัน</label>';
  h += '<input type="text" id="paDueDate" class="fm-input dp" placeholder="DD/MM/YYYY"></div>';

  h += '<div class="fm-group"><label>🔴 ความเร่งด่วน</label>';
  h += '<select id="paPriority" class="fm-input">';
  h += '<option value="2">ปกติ</option>';
  h += '<option value="1">🔴 เร่งด่วน</option>';
  h += '</select></div>';

  h += '<div class="fm-group"><label>📝 หมายเหตุ (ถ้ามี)</label>';
  h += '<textarea id="paNote" rows="2" class="fm-input" placeholder="รายละเอียดเพิ่มเติม..."></textarea></div>';

  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="savePipeAction(\'' + pipeId + '\')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';

  openM('➕ Action Item', h);
}

function paQuickFill(text) {
  var el = document.getElementById('paText');
  if (el) el.value = text;
}

function savePipeAction(pipeId) {
  var text = (document.getElementById('paText').value || '').trim();
  var dueDate = (document.getElementById('paDueDate').value || '').trim();
  var priority = parseInt(document.getElementById('paPriority').value) || 2;
  var note = (document.getElementById('paNote').value || '').trim();

  if (!text) { toast('กรุณาใส่สิ่งที่ต้องทำ'); return; }

  var actions = getPipeActions();
  actions.push({
    id: 'pa_' + Date.now(),
    pipeId: pipeId,
    text: text,
    dueDate: dueDate,
    priority: priority,
    note: note,
    status: 'pending',
    createdDate: _td(),
    doneDate: '',
    response: ''
  });
  savePipeActions(actions);

  autoUpdatePipeNextAction(pipeId);

  if (ST && ST.add) {
    ST.add('pipeLog', {
      pipeId: pipeId,
      type: 'action',
      content: '➕ Action Item: ' + text + (dueDate ? ' (กำหนด ' + dueDate + ')' : ''),
      date: _nw()
    });
  }

  toast('✅ เพิ่ม Action Item แล้ว');
  closeMForce();
  render();
}
function showQNote() {
  var dealers = ST.getAll('dealers');
  var dlrSelect = dealers.length ? '<div class="fg"><label>Dealer (ไม่บังคับ)</label><select id="qn_d">' + dealerOptions('') + '</select></div>' : '';
  openM('📝 โน้ตด่วน', dlrSelect +
    '<div class="fg"><label>โน้ต</label><textarea id="qn_t" rows="3" placeholder="จดอะไรก็ได้..."></textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveQNote()">💾 บันทึก</button>');
}

function saveQNote() {
  var textEl = document.getElementById('qn_t');
  var text = textEl ? textEl.value.trim() : '';
  if (!text) return;
  var dlrEl = document.getElementById('qn_d');
  var dealerId = dlrEl ? dlrEl.value : '';
  ST.add('qnotes', {text: text, dealerId: dealerId});
  if (dealerId) ST.add('feedback', {dealerId: dealerId, text: text, date: _td(), source: 'quicknote'});
  closeMForce();
  toast('📝 บันทึกแล้ว');
  render();
}
function toggleViewMode() {
  var viewMode = localStorage.getItem('v7_viewMode') || 'desktop';
  viewMode = viewMode === 'mobile' ? 'desktop' : 'mobile';
  localStorage.setItem('v7_viewMode', viewMode);
  applyViewMode();
  render();
}

function applyViewMode() {
  var viewMode = localStorage.getItem('v7_viewMode') || 'desktop';
  if (viewMode === 'mobile') {
    document.body.classList.add('mobile-mode');
  } else {
    document.body.classList.remove('mobile-mode');
  }
  var icon = document.getElementById('modeIcon');
  if (icon) icon.textContent = viewMode === 'mobile' ? '🖥️' : '📱';
  updateMbNav();
}