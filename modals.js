// ================================================================
// MODALS.JS - ALL MODAL DIALOGS (UPDATED TO USE Products MODULE)
// ================================================================
// ================================================================
// GENERIC CONFIG LIST EDITOR — จัดการ list ตัวเลือกแบบ string ธรรมดาที่แต่เดิมไม่มีหน้าแก้ไข
// (unitTypes, torOptions, appointmentOptions, winReasons, lossReasons, noteCategories ฯลฯ)
// เปิดจากปุ่ม ⚙️ ข้างตัวเลือกในฟอร์มได้เลย ไม่ต้องออกจากฟอร์มไปแก้ config ที่อื่น — เสร็จแล้วกลับมา
// ฟอร์มเดิมต่อทันที (reopenFn) ผ่าน pattern เดียวกับ _etReturnTo ของ Email Template (features.js)
// ================================================================
function showCfgListEditorM(cfgKey, title, reopenFn) {
  window._cfgListKey = cfgKey;
  window._cfgListTitle = title;
  window._cfgListReopen = reopenFn;
  window._cfgListJustAdded = null;
  _cfgListRenderM();
}
function _cfgListRenderM() {
  var cfg = getConfig();
  var list = cfg[window._cfgListKey] || [];
  var h = '<div style="max-width:380px">';
  h += '<div id="cfgListWrap">' + (list.length ? list.map(function(v, i) {
    return '<div class="link-item"><span style="flex:1;font-size:13px">' + sanitize(v) + '</span>' +
      '<button class="btn bsm bd" onclick="_cfgListRemove(' + i + ')">✕</button></div>';
  }).join('') : '<div style="font-size:12px;color:var(--text2);padding:6px 0">ยังไม่มีรายการ</div>') + '</div>';
  h += '<div style="display:flex;gap:4px;margin-top:6px">' +
    '<input type="text" id="cfgListNew" placeholder="เพิ่มรายการใหม่" style="flex:1" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_cfgListAdd();}">' +
    '<button class="btn bsm bp" onclick="_cfgListAdd()">➕</button></div>';
  h += '<button class="btn bp btn-full" style="margin-top:10px" onclick="_cfgListDone()">✅ เสร็จสิ้น</button>';
  h += '</div>';
  openM(window._cfgListTitle, h);
}
function _cfgListAdd() {
  var el = document.getElementById('cfgListNew');
  var v = (el.value || '').trim();
  if (!v) return;
  var cfg = getConfig();
  cfg[window._cfgListKey] = cfg[window._cfgListKey] || [];
  if (cfg[window._cfgListKey].indexOf(v) !== -1) return toast('มีอยู่แล้ว');
  cfg[window._cfgListKey].push(v);
  saveConfig(cfg);
  window._cfgListJustAdded = v;
  _cfgListRenderM();
}
function _cfgListRemove(idx) {
  var cfg = getConfig();
  cfg[window._cfgListKey].splice(idx, 1);
  saveConfig(cfg);
  _cfgListRenderM();
}
function _cfgListDone() {
  var fn = window._cfgListReopen;
  var added = window._cfgListJustAdded;
  window._cfgListReopen = null;
  if (fn) fn(added); else closeMForce();
}

// ================================================================
// PIPELINE STATUS EDITOR (ย่อจาก Admin) — เพิ่ม/ลบ Status ได้จากในฟอร์ม Pipeline เลย
// ================================================================
function showPipeStatusEditorM(reopenFn) {
  window._pstReopen = reopenFn;
  window._pstJustAdded = null;
  _pstRenderM();
}
function _pstRenderM() {
  var cfg = getConfig();
  var list = cfg.pipelineStatuses || [];
  var h = '<div style="max-width:420px">';
  h += '<div id="pstWrap">' + list.map(function(s, i) {
    var catLabel = s.category === 'won' ? '🟢 Win' : s.category === 'lost' ? '🔴 Lost' : '🔵 Active';
    return '<div class="link-item"><span style="width:12px;height:12px;border-radius:50%;background:' + (s.color || '#888') + ';flex-shrink:0"></span>' +
      '<span style="flex:1;font-size:13px">' + sanitize(s.name) + '</span>' +
      '<span style="font-size:11px;color:var(--text2);white-space:nowrap">' + catLabel + '</span>' +
      '<button class="btn bsm bd" onclick="_pstRemove(' + i + ')">✕</button></div>';
  }).join('') + '</div>';
  h += '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;align-items:center">' +
    '<input type="text" id="pstNewName" placeholder="ชื่อ Status ใหม่" style="flex:1;min-width:110px">' +
    '<input type="color" id="pstNewColor" value="#3b82f6" style="width:34px;padding:1px">' +
    '<select id="pstNewCat" style="font-size:12px;padding:4px"><option value="active">🔵 Active</option><option value="won">🟢 Win</option><option value="lost">🔴 Lost</option></select>' +
    '<button class="btn bsm bp" onclick="_pstAdd()">➕</button></div>';
  h += '<button class="btn bp btn-full" style="margin-top:10px" onclick="_pstDone()">✅ เสร็จสิ้น</button>';
  h += '</div>';
  openM('⚙️ จัดการ Pipeline Status', h);
}
function _pstAdd() {
  var nameEl = document.getElementById('pstNewName');
  var name = (nameEl.value || '').trim();
  if (!name) return alert('ใส่ชื่อ Status');
  var cfg = getConfig();
  var id = 'st_' + Date.now().toString(36);
  cfg.pipelineStatuses = cfg.pipelineStatuses || [];
  cfg.pipelineStatuses.push({ id: id, name: name, color: document.getElementById('pstNewColor').value, category: document.getElementById('pstNewCat').value });
  saveConfig(cfg);
  window._pstJustAdded = id;
  _pstRenderM();
}
function _pstRemove(idx) {
  var cfg = getConfig();
  cfg.pipelineStatuses.splice(idx, 1);
  saveConfig(cfg);
  _pstRenderM();
}
function _pstDone() {
  var fn = window._pstReopen;
  var added = window._pstJustAdded;
  window._pstReopen = null;
  if (fn) fn(added); else closeMForce();
}

// ================================================================
// POS WEIGHTS EDITOR — แก้น้ำหนักที่ใช้คำนวณ "POS แนะนำ" (computeSuggestedPOS ใน utils.js) ได้ตรงจากปุ่ม ⚙️
// ข้าง POS แนะนำเลย ไม่ต้องออกไปหน้า Admin แยก (เหมือน showCfgListEditorM/showPipeStatusEditorM) — reopenFn
// พากลับไปฟอร์มเดิม (Visit หรือ Pipeline) ที่เปิดอยู่ก่อนกดเข้ามาแก้
// ================================================================
var POS_WEIGHT_FIELDS = [
  { key: 'appointmentIssued', label: '✅ ออกหนังสือแต่งตั้งแล้ว' },
  { key: 'torLock', label: '📋 TOR Lock แล้ว' },
  { key: 'crmRegistered', label: '✅ ลงทะเบียน CRM DJI แล้ว' },
  { key: 'hasCompetitor', label: '⚠️ มีคู่แข่ง' },
  { key: 'pocDone', label: '🛠 ไป POC แล้ว' },
  { key: 'presentedDone', label: '🛠 พรีเซนต์งานให้หน่วยงานแล้ว' },
  { key: 'torDraftDone', label: '🛠 ร่าง TOR ให้หน่วยงานแล้ว' },
  { key: 'followupUpcoming', label: '✅ Follow-up ยังไม่ถึงกำหนด' },
  { key: 'followupOverdue', label: '⚠️ Follow-up ค้างเกินกำหนด' },
  { key: 'logFresh', label: '⏱ อัพเดตล่าสุด ≤14 วัน' },
  { key: 'logStale', label: '⏱ เงียบมา >60 วัน (หรือไม่เคยมี Log)' }
];
function showPosWeightsEditorM(reopenFn) {
  window._pwReopen = reopenFn;
  _pwRenderM();
}
function _pwRenderM() {
  var cfg = getConfig();
  var w = cfg.posWeights || {};
  var statuses = cfg.pipelineStatuses || [];
  var h = '<div style="max-width:440px;max-height:70vh;overflow-y:auto">';
  h += '<div style="font-size:.68rem;color:var(--text2);margin-bottom:10px">ตัวเลขพวกนี้เป็นแค่ "แนะนำ" ไม่บังคับใช้ — sale ยังกรอก POS เองได้ตามเดิมเสมอ</div>';

  h += '<div class="form-section">📊 ฐานตาม Stage (%)</div>';
  h += statuses.map(function(s) {
    var v = (w.stageBase || {})[s.id];
    return '<div class="fr" style="align-items:center;margin-bottom:4px"><span style="flex:1;font-size:12.5px">' + sanitize(s.name) + '</span>' +
      '<input type="number" min="0" max="100" style="width:70px" value="' + (v === undefined ? '' : v) + '" onchange="_pwSetStageBase(\'' + s.id + '\', this.value)"></div>';
  }).join('');
  h += '<div style="font-size:.62rem;color:var(--text2);margin:4px 0 8px">Stage ที่เพิ่มเองใหม่ (ไม่มีเลขตั้งไว้) จะ fallback ตามหมวด: Won ' + (w.stageBaseWon || 95) + '% / Lost ' + (w.stageBaseLost || 5) + '% / Active ' + (w.stageBaseActiveDefault || 30) + '%</div>';

  h += '<div class="form-section">🎯 น้ำหนักปัจจัยเสริม (บวก/ลบได้)</div>';
  h += POS_WEIGHT_FIELDS.map(function(f) {
    return '<div class="fr" style="align-items:center;margin-bottom:4px"><span style="flex:1;font-size:12.5px">' + f.label + '</span>' +
      '<input type="number" style="width:70px" value="' + (w[f.key] === undefined ? 0 : w[f.key]) + '" onchange="_pwSetField(\'' + f.key + '\', this.value)"></div>';
  }).join('');

  h += '<div style="display:flex;gap:6px;margin-top:10px">';
  h += '<button class="btn bo" style="flex:1" onclick="_pwResetDefault()">↻ Reset เป็นค่าเริ่มต้น</button>';
  h += '<button class="btn bp" style="flex:1" onclick="_pwDone()">✅ เสร็จสิ้น</button>';
  h += '</div></div>';
  openM('⚙️ น้ำหนัก POS แนะนำ', h);
}
function _pwSetStageBase(statusId, val) {
  var cfg = getConfig();
  cfg.posWeights = cfg.posWeights || {};
  cfg.posWeights.stageBase = cfg.posWeights.stageBase || {};
  cfg.posWeights.stageBase[statusId] = val === '' ? undefined : Number(val);
  saveConfig(cfg);
}
function _pwSetField(key, val) {
  var cfg = getConfig();
  cfg.posWeights = cfg.posWeights || {};
  cfg.posWeights[key] = Number(val) || 0;
  saveConfig(cfg);
}
function _pwResetDefault() {
  if (!confirm('รีเซ็ตน้ำหนัก POS ทั้งหมดกลับเป็นค่าเริ่มต้นไหม?')) return;
  var cfg = getConfig();
  delete cfg.posWeights;
  cfg.posWeights = JSON.parse(JSON.stringify(DEF_CONFIG.posWeights));
  saveConfig(cfg);
  _pwRenderM();
}
function _pwDone() {
  var fn = window._pwReopen;
  window._pwReopen = null;
  if (fn) fn(); else closeMForce();
}

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

  // ยังไม่มีสินค้าใน catalog เลย — คืน array ว่าง ไม่ fallback ไป list default อีกต่อไป (กรอกเองได้อิสระ)
  return [];
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
    var sku = p.sku || '';
    // ใส่ SKU ไว้ใน label เพื่อให้พิมพ์เลข SKU ค้นเจอได้ — แต่ค่าที่เก็บ (value) ยังเป็นชื่อสินค้าเหมือนเดิม
    var label = (sku ? sku + ' — ' : '') + name + (price > 0 ? ' (฿' + fmtMoney(price) + ')' : '');
    html += '<option value="' + sanitize(name) + '">' + sanitize(label) + '</option>';
  }
  html += '</datalist>';
  return html;
}

// หา product จากแคตตาล็อกด้วย SKU ก่อน แล้วชื่อ (ตรงเป๊ะ → normalize เว้นวรรค/ตัวพิมพ์) — ถังหลักคือ "สินค้าทั้งหมด"
function _pipeResolveProduct(input) {
  if (!input || typeof Products === 'undefined') return null;
  var s = String(input).trim();
  if (Products.getBySku) { var bySku = Products.getBySku(s); if (bySku) return bySku; }
  if (Products.getByName) {
    var byName = Products.getByName(s); if (byName) return byName;
    if (Products.getAll) {
      var norm = s.replace(/\s+/g, ' ').toLowerCase();
      var all = Products.getAll();
      for (var i = 0; i < all.length; i++) {
        if ((all[i].name || '').trim().replace(/\s+/g, ' ').toLowerCase() === norm) return all[i];
      }
    }
  }
  return null;
}

// resolve SKU จากชื่อ/SKU — เก็บซ่อนไว้กับ item เพื่อลิงก์ใบเสนอราคาแม่นยำ ไม่แสดงในหน้า pipeline
function _pipeSkuForModel(name) {
  var p = _pipeResolveProduct(name);
  return p ? (p.sku || '') : '';
}
// รับได้ทั้ง dealer id หรือชื่อ dealer (ช่อง fp_dealer ในฟอร์ม pipeline เป็นชื่อ ไม่ใช่ id)
function _resolveDealerFlexible(v) {
  if (!v) return null;
  var d = ST.getOne('dealers', v);
  if (d) return d;
  v = String(v).trim();
  if (!v) return null;
  return ST.getAll('dealers').find(function(x) { return x.name === v; }) || null;
}
// ดึง Level ของ dealer ที่กำลังเลือกอยู่ในฟอร์ม Add/Edit Pipeline (ใช้คำนวณราคาตาม Level)
function _pipeFormDealerLevel() {
  var nameEl = document.getElementById('fp_dealer');
  var dealer = _resolveDealerFlexible(nameEl ? nameEl.value : '');
  return dealer ? (dealer.level || 'Other') : null;
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
  // ยังไม่มีสินค้าใน catalog เลย — คืน array ว่าง ไม่ fallback ไป list default อีกต่อไป (กรอกเองได้อิสระ)
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
  // ยังไม่มีสินค้าใน v7_products เลย — ไม่ fallback ไป config.models (list default) อีกต่อไป กรอกเองได้อิสระ
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
// Toggle เปิด/ปิดส่วนที่ยุบไว้ในฟอร์ม (progressive disclosure) — ใช้ร่วมกันได้ทุกฟอร์ม แค่ส่ง id ของ wrapper
// และ element ของ header เข้ามา (เอาไว้สลับข้อความปุ่ม ▲/▼) ไม่ต้องพึ่ง state ระดับหน้า/re-render ทั้งฟอร์ม
function _toggleFormSection(wrapId, headerEl) {
  var wrap = document.getElementById(wrapId);
  if (!wrap) return;
  var willShow = wrap.style.display === 'none';
  wrap.style.display = willShow ? '' : 'none';
  var btn = headerEl ? headerEl.querySelector('span') : null;
  if (btn) btn.textContent = willShow ? '▲ ซ่อน' : '▼ แสดง';
}

function showDealerM(eid) {
  var d = eid ? ST.getOne('dealers', eid) : {};
  var cfg = getConfig();
  window._dealerAttach = (d.attachments || []).slice();
  // Certification มักไม่กรอกตอนสร้าง Dealer ใหม่ — ยุบไว้เป็นค่าเริ่มต้น ถ้าเป็นการแก้ไข Dealer ที่มีข้อมูลอยู่แล้วถึงเปิดโชว์ให้เลย
  var certHasData = !!(d.dsecStatus || d.crmStatus || d.fh2Status || d.larkStatus || d.dsecCertCount || d.fh2CertCount);
  openM(eid ? '✏️ Dealer' : '➕ เพิ่ม Dealer', '' +
    '<div class="form-section">🏢 ข้อมูลบริษัท</div>' +
    '<div class="fg"><label>ชื่อบริษัท *</label><input type="text" id="fd_name" value="' + sanitize(d.name || '') + '"></div>' +
    '<div class="fg"><label>เลขประจำตัวผู้เสียภาษี (Tax ID)</label><input type="text" id="fd_taxid" value="' + sanitize(d.taxId || '') + '" placeholder="13 หลัก"></div>' +
    '<div class="fr"><div class="fg"><label>SIS Code</label><input type="text" id="fd_sis" value="' + (d.sisCode || '') + '"></div>' +
    '<div class="fg"><label>DJI Code</label><input type="text" id="fd_dji" value="' + (d.djiCode || '') + '"></div></div>' +
    '<div class="fr"><div class="fg"><label>Level *</label><select id="fd_level">' + optionsHTML(cfg.dealerLevels, d.level || 'B', '-- เลือก --') + '</select></div>' +
    '<div class="fg"><label>โชว์ซีเรียล</label><select id="fd_serial"><option value="Y"' + ((d.showSerial || 'Y') === 'Y' ? ' selected' : '') + '>Y</option><option value="N"' + (d.showSerial === 'N' ? ' selected' : '') + '>N</option></select></div></div>' +
    '<div class="fg"><label>👤 เซลที่ดูแล</label><input type="text" id="fd_salename" list="dealerSaleNameList" value="' + sanitize(d.saleName || (eid ? '' : (cfg.saleName || ''))) + '" placeholder="ชื่อเซลที่ดูแล Dealer นี้..."></div>' +
    '<datalist id="dealerSaleNameList">' + (typeof getSalesMembers === 'function' ? getSalesMembers().map(function(m) { return '<option value="' + sanitize(m.name) + '">'; }).join('') : '') + '<option value="' + sanitize(cfg.saleName || '') + '"></datalist>' +
    '<div class="fr"><div class="fg"><label>DJI Dealer</label><select id="fd_djid">' + optionsHTML(cfg.djiDealerTypes, d.djiDealer, '--') + '</select></div>' +
    '<div class="fg"><label>Term</label><select id="fd_term">' + optionsHTML(cfg.creditTerms, d.creditTerm, '--') + '</select></div></div>' +
    '<div class="fr"><div class="fg"><label>วงเงินเครดิต (฿)</label><input type="text" inputmode="decimal" class="js-money" id="fd_credit" value="' + nmI(d.creditLimit || '') + '"></div>' +
    '<div class="fg"><label>เป้ายอดขาย H1 (฿) <small style="color:var(--text2)">ม.ค.-มิ.ย.</small></label><input type="text" inputmode="decimal" class="js-money" id="fd_targeth1" oninput="_fdSyncTargetTotal()" value="' + nmI(d.targetH1 !== undefined ? d.targetH1 : Math.round((d.targetRevenue || 0) / 2)) + '"></div></div>' +
    '<div class="fr"><div class="fg"><label>เป้ายอดขาย H2 (฿) <small style="color:var(--text2)">ก.ค.-ธ.ค.</small></label><input type="text" inputmode="decimal" class="js-money" id="fd_targeth2" oninput="_fdSyncTargetTotal()" value="' + nmI(d.targetH2 !== undefined ? d.targetH2 : Math.round((d.targetRevenue || 0) / 2)) + '"></div>' +
    '<div class="fg"><label>เป้ารวมทั้งปี (฿) <small style="color:var(--text2)">= H1+H2 อัตโนมัติ</small></label><input type="text" id="fd_target_total" disabled value="' + nmI(d.targetRevenue || '') + '"></div></div>' +
    '<div class="fg"><label>เงื่อนไขชำระเงิน</label><textarea id="fd_payment" rows="2">' + sanitize(d.paymentCondition || '') + '</textarea></div>' +
    '<div class="form-section">👤 ผู้ติดต่อ</div>' +
    '<div class="fg"><label>ผู้ติดต่อ</label><textarea id="fd_contact" rows="3">' + sanitize(d.contact || '') + '</textarea></div>' +
    '<div class="fg"><label>รายละเอียดลูกค้า</label><textarea id="fd_detail" rows="2">' + sanitize(d.customerDetail || '') + '</textarea></div>' +
    '<div class="fr"><div class="fg"><label>Shippto</label><input type="text" id="fd_ship" value="' + (d.shippto || 'NO') + '"></div>' +
    '<div class="fg"><label>📍 Google Map</label><input type="url" id="fd_map" value="' + (d.googleMap || '') + '"></div></div>' +
    attachUploadHtml('_dealerAttach', 'dealers', '📷 รูปหน้าร้าน/ใบรับรอง') +
    '<div class="form-section" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="_toggleFormSection(\'fd_cert_wrap\',this)">📋 Certification <span style="font-size:11px;font-weight:400;color:var(--text2)">' + (certHasData ? '▲ ซ่อน' : '▼ แสดง') + '</span></div>' +
    '<div id="fd_cert_wrap"' + (certHasData ? '' : ' style="display:none"') + '>' +
    '<div class="fr"><div class="fg"><label>DSEC</label><select id="fd_dsec"><option value="">--</option><option value="pass"' + (d.dsecStatus === 'pass' ? ' selected' : '') + '>ผ่าน</option><option value="fail"' + (d.dsecStatus === 'fail' ? ' selected' : '') + '>ไม่ผ่าน</option><option value="pending"' + (d.dsecStatus === 'pending' ? ' selected' : '') + '>ยังไม่ทำ</option></select></div>' +
    '<div class="fg"><label>DSEC cert</label><input type="number" id="fd_dsec_n" value="' + (d.dsecCertCount || '') + '"></div></div>' +
    '<div class="fr"><div class="fg"><label>CRM</label><select id="fd_crm"><option value="">--</option><option value="yes"' + (d.crmStatus === 'yes' ? ' selected' : '') + '>ลงทะเบียนแล้ว</option><option value="no"' + (d.crmStatus === 'no' ? ' selected' : '') + '>ยังไม่ลง</option></select></div>' +
    '<div class="fg"><label>FH2</label><select id="fd_fh2"><option value="">--</option><option value="pass"' + (d.fh2Status === 'pass' ? ' selected' : '') + '>ผ่าน</option><option value="fail"' + (d.fh2Status === 'fail' ? ' selected' : '') + '>ไม่ผ่าน</option><option value="pending"' + (d.fh2Status === 'pending' ? ' selected' : '') + '>ยังไม่ทำ</option></select></div></div>' +
    '<div class="fr"><div class="fg"><label>FH2 cert</label><input type="number" id="fd_fh2_n" value="' + (d.fh2CertCount || '') + '"></div>' +
    '<div class="fg"><label>Lark</label><select id="fd_lark"><option value="">--</option><option value="added"' + (d.larkStatus === 'added' ? ' selected' : '') + '>Add แล้ว</option><option value="no"' + (d.larkStatus === 'no' ? ' selected' : '') + '>ยังไม่ Add</option></select></div></div>' +
    '</div>' +
    '<div class="fr"><div class="fg"><label>Demo Unit</label><input type="text" id="fd_demo" value="' + sanitize(d.demoUnit || '') + '"></div>' +
    '<div class="fg"><label>กลุ่มลูกค้าหลัก</label><input type="text" id="fd_segment" value="' + sanitize(d.customerSegment || '') + '"></div></div>' +
    '<div class="fg"><label>Dock Interest</label><select id="fd_dock"><option value="">--</option><option value="yes"' + (d.dockInterest === 'yes' ? ' selected' : '') + '>มี</option><option value="no"' + (d.dockInterest === 'no' ? ' selected' : '') + '>ไม่มี</option><option value="กำลังดู"' + (d.dockInterest === 'กำลังดู' ? ' selected' : '') + '>กำลังดู</option></select></div>' +
    '<div class="fg"><label>หมายเหตุ</label><textarea id="fd_notes" rows="2">' + sanitize(d.notes || '') + '</textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveDealer(\'' + (eid || '') + '\')">💾 บันทึก</button>');
}

function _fdSyncTargetTotal() {
  var h1 = parseNum(document.getElementById('fd_targeth1').value);
  var h2 = parseNum(document.getElementById('fd_targeth2').value);
  var totalEl = document.getElementById('fd_target_total');
  if (totalEl) totalEl.value = nmI(h1 + h2);
}
async function saveDealer(eid) {
  var data = {
    name: document.getElementById('fd_name').value.trim(),
    taxId: document.getElementById('fd_taxid').value.trim(),
    sisCode: document.getElementById('fd_sis').value.trim(),
    djiCode: document.getElementById('fd_dji').value.trim(),
    level: document.getElementById('fd_level').value,
    saleName: document.getElementById('fd_salename').value.trim(),
    showSerial: document.getElementById('fd_serial').value,
    djiDealer: document.getElementById('fd_djid').value,
    creditTerm: document.getElementById('fd_term').value,
    creditLimit: parseNum(document.getElementById('fd_credit').value),
    targetH1: parseNum(document.getElementById('fd_targeth1').value),
    targetH2: parseNum(document.getElementById('fd_targeth2').value),
    // targetRevenue = H1+H2 เสมอ (ไม่ได้กรอกตรงๆ อีกต่อไป) — คงไว้เพราะจุดอื่นในแอป (ตาราง Dealer list,
    // การ์ด Health, % achievement) ยังอ่านฟิลด์นี้อยู่ กันต้องไล่แก้ทุกจุดพร้อมกัน
    targetRevenue: parseNum(document.getElementById('fd_targeth1').value) + parseNum(document.getElementById('fd_targeth2').value),
    paymentCondition: document.getElementById('fd_payment').value.trim(),
    contact: document.getElementById('fd_contact').value.trim(),
    customerDetail: document.getElementById('fd_detail').value.trim(),
    shippto: document.getElementById('fd_ship').value.trim(),
    googleMap: document.getElementById('fd_map').value.trim(),
    dsecStatus: document.getElementById('fd_dsec').value,
    dsecCertCount: document.getElementById('fd_dsec_n').value,
    crmStatus: document.getElementById('fd_crm').value,
    fh2Status: document.getElementById('fd_fh2').value,
    fh2CertCount: document.getElementById('fd_fh2_n').value,
    larkStatus: document.getElementById('fd_lark').value,
    demoUnit: document.getElementById('fd_demo').value.trim(),
    customerSegment: document.getElementById('fd_segment').value.trim(),
    dockInterest: document.getElementById('fd_dock').value,
    notes: document.getElementById('fd_notes').value.trim(),
    attachments: window._dealerAttach || []
  };
  
  if (!data.name) return alert('ใส่ชื่อบริษัท');
  
  if (eid) {
    ST.update('dealers', eid, data);
    // ✅ Audit Log
    if (typeof addAuditLog === 'function') {
      addAuditLog('update_dealer', 'dealer', eid, data.name, eid, data.name, {});
    }

    // ✅ เซลที่ดูแล Dealer เปลี่ยน → ทับ Sale ของทุก Pipeline ใต้ Dealer นี้ให้ตรงกันเสมอ
    // (ตกลงกันไว้ว่าให้ทับทั้งหมด ไม่เช็คว่า Pipeline เคยตั้ง Sale ไว้ต่างจาก Dealer หรือไม่)
    if (typeof cascadeDealerSaleNameToPipelines === 'function') {
      cascadeDealerSaleNameToPipelines(eid, data.saleName);
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

    if (typeof prospectMarkConvertedFromDealer === 'function') prospectMarkConvertedFromDealer(c.id);

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
  window._pipeAttach = (p.attachments || []).slice();
  // ใช้ reopen หลังแก้ config แบบ inline (⚙️ ข้าง Unit Type/Status/TOR/หนังสือแต่งตั้ง) — reopen จะ build ฟอร์มใหม่
  // จากข้อมูลที่บันทึกไว้ ไม่ใช่จาก DOM ปัจจุบัน ดังนั้นถ้ามีช่องอื่นที่แก้ค้างไว้ยังไม่บันทึกจะหายไปด้วย
  var _pipeReopenArgs = "'" + (dealerId || '') + "','" + (eid || '') + "'";
  var _posLastLog = eid ? ST.pipeLogsByPipe(eid)[0] : null;

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

  var _indTypeIsOther = p.industrialType && PIPE_INDUSTRY_TYPES.indexOf(p.industrialType) === -1;
  var _indTypeOptHtml = PIPE_INDUSTRY_TYPES.map(function(t) { return '<option value="' + t + '"' + (p.industrialType === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
    '<option value="__other__"' + (_indTypeIsOther ? ' selected' : '') + '>อื่นๆ (พิมพ์เอง)</option>';

  openM(eid ? '✏️ Pipeline' : '➕ เพิ่ม Pipeline', '' +
    '<div class="fg"><label>ROW NO. <small style="color:var(--text2)">(เลขที่ในชีต — กรอกเองให้ตรงกับ Google Sheet)</small></label><input type="text" id="fp_rowno" value="' + sanitize(p.rowNo || '') + '" placeholder="เช่น 452"></div>' +
    '<div class="fg"><label>Project ID <small style="color:var(--text2)">(ได้จากตอนลูกค้าลงทะเบียน CRM ของ DJI — มีค่า = ถือว่าลงทะเบียนแล้ว)</small></label><input type="text" id="fp_projectid" value="' + sanitize(p.projectId || '') + '" placeholder="ยังไม่มีจนกว่าจะลงทะเบียน CRM" oninput="(function(v){var c=document.getElementById(\'fp_crm\');if(v&&c&&!c.checked){c.checked=true;document.getElementById(\'fp_crmdate_wrap\').style.display=\'\';}})(this.value.trim())"></div>' +
    dpH('fp_reg', p.registerDate || _td(), 'Register Date') +
    '<div class="fg"><label>Project Name *</label><textarea id="fp_name" rows="2">' + sanitize(p.projectName || '') + '</textarea></div>' +
    '<div class="fr"><div class="fg"><label>End User (TH)</label><input type="text" id="fp_eu_th" value="' + sanitize(p.endUserTH || '') + '"></div>' +
    '<div class="fg"><label>End User (EN)</label><input type="text" id="fp_eu_en" value="' + sanitize(p.endUserEN || '') + '"></div></div>' +
    '<div class="fr"><div class="fg"><label>🏛️ หน่วยงานใหญ่</label><input type="text" id="fp_agency_main" value="' + sanitize(p.agencyMain || '') + '" placeholder="เช่น กรม/กระทรวง/บริษัทแม่"></div>' +
    '<div class="fg"><label>หน่วยงานย่อย</label><input type="text" id="fp_agency_sub" value="' + sanitize(p.agencySub || '') + '" placeholder="เช่น กอง/สำนัก/สาขา"></div></div>' +
    '<div class="fr"><div class="fg"><label>Industrial Type</label><select id="fp_indtype" onchange="var w=document.getElementById(\'fp_indtype_custom_wrap\'); if(this.value===\'__other__\'){w.style.display=\'\';} else {w.style.display=\'none\';document.getElementById(\'fp_indtype_custom\').value=\'\';}">' + _indTypeOptHtml + '</select></div>' +
    '<div class="fg" id="fp_indtype_custom_wrap"' + (_indTypeIsOther ? '' : ' style="display:none"') + '><label>ระบุ Industrial Type</label><input type="text" id="fp_indtype_custom" value="' + sanitize(_indTypeIsOther ? p.industrialType : '') + '" placeholder="พิมพ์เอง"></div></div>' +
    '<div class="fr"><div class="fg"><label>Unit Type <button type="button" class="btn-xs" onclick="showCfgListEditorM(\'unitTypes\',\'⚙️ จัดการ Unit Type\', function(added){ showPipelineM(' + _pipeReopenArgs + '); if(added) setTimeout(function(){var s=document.getElementById(\'fp_unit\'); if(s) s.value=added;},0); })">⚙️</button></label><select id="fp_unit">' + optionsHTML(cfg.unitTypes, p.unitType, '--') + '</select></div>' +
    '<div class="fg"><label>Dealer Name *</label><input type="text" id="fp_dealer" list="fp_dealer_list" value="' + sanitize((ST.getOne('dealers', dealerId || p.dealerId) || {}).name || '') + '" placeholder="บริษัทที่เข้าประมูล พิมพ์อิสระ หรือเลือกจาก suggest" autocomplete="off">' + _dealerNameDatalistHtml('fp_dealer_list') + '</div></div>' +
    '<div class="fr"><div class="fg"><label>DJI Dealer</label><input type="text" id="fp_djid" list="fp_djid_list" value="' + sanitize(p.djiDealer || '') + '" placeholder="พิมพ์อิสระ หรือเลือกจาก suggest" autocomplete="off">' + _djiDealerDatalistHtml('fp_djid_list') + '</div>' +
    '<div class="fg"><label>Status <button type="button" class="btn-xs" onclick="showPipeStatusEditorM(function(added){ showPipelineM(' + _pipeReopenArgs + '); if(added) setTimeout(function(){var s=document.getElementById(\'fp_status\'); if(s) s.value=added;},0); })">⚙️</button></label><select id="fp_status">' + optionsHTML(cfg.pipelineStatuses, p.status || 'initial') + '</select></div></div>' +

    // ---- Model & Forecast Section ----
    '<div class="form-section">📦 สินค้าและมูลค่า</div>' +
    '<div style="display:flex;gap:4px;margin-bottom:8px">' +
    '<button class="btn bsm ' + (pipeItemMode === 'items' ? 'bp' : 'bo') + '" onclick="switchPipeMode(\'items\')">📦 รายชิ้น</button>' +
    '<button class="btn bsm ' + (pipeItemMode === 'lump' ? 'bp' : 'bo') + '" onclick="switchPipeMode(\'lump\')">💰 มูลค่ารวม</button>' +
    '</div>' +

    '<div id="pipeItemsSection">' + buildPipeItemsSection(p) + '</div>' +

    // ---- Other Fields ----
    '<div class="fr"><div class="fg"><label>Real Amount (฿)</label><input type="text" inputmode="decimal" class="js-money" id="fp_real" value="' + nmI(p.realAmount || '') + '"></div>' +
    '<div class="fg"><label>TOR <button type="button" class="btn-xs" onclick="showCfgListEditorM(\'torOptions\',\'⚙️ จัดการ TOR\', function(added){ showPipelineM(' + _pipeReopenArgs + '); if(added) setTimeout(function(){var s=document.getElementById(\'fp_tor\'); if(s) s.value=added;},0); })">⚙️</button></label><select id="fp_tor">' + optionsHTML(cfg.torOptions, p.tor || 'Open') + '</select></div></div>' +
    '<div class="fr">' + dpH('fp_bid', p.biddingDate || '', 'Bidding Date') + dpH('fp_ship', p.shipmentDate || '', 'Shipment Date') + '</div>' +
    '<div class="fr">' + dpH('fp_close', p.expectedCloseDate || '', '🎯 Expected Close Date (คาดปิดดีล/ได้ PO)') + '<div class="fg"></div></div>' +
    '<div class="fr"><div class="fg"><label>หนังสือแต่งตั้ง <button type="button" class="btn-xs" onclick="showCfgListEditorM(\'appointmentOptions\',\'⚙️ จัดการหนังสือแต่งตั้ง\', function(added){ showPipelineM(' + _pipeReopenArgs + '); if(added) setTimeout(function(){var s=document.getElementById(\'fp_appt\'); if(s) s.value=added;},0); })">⚙️</button></label><select id="fp_appt">' + optionsHTML(cfg.appointmentOptions, p.appointmentLetter, '--') + '</select></div>' +
    '<div class="fg"><label>🎯 Project POS (%) <small style="color:var(--text2)">(โอกาสได้งาน)</small></label><input type="number" id="fp_pos" min="0" max="100" value="' + (p.projectPOS || '') + '" placeholder="0-100"></div></div>' +
    posChecklistHtml(p, 'fp_', '', _posLastLog, 'showPipelineM(' + _pipeReopenArgs + ')', true) +
    (function() {
      var hasAdvData = !!(p.budgetFiscalYear || p.djiCrmRegistered || p.hasCompetitor || p.projectRevenue || p.sheetDisplay === 'Hide');
      return '<div class="form-section" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="_toggleFormSection(\'fp_adv_wrap\',this)">⚙️ ปีงบประมาณ / CRM / ข้อมูลภายใน <span style="font-size:11px;font-weight:400;color:var(--text2)">' + (hasAdvData ? '▲ ซ่อน' : '▼ แสดง') + '</span></div>' +
      '<div id="fp_adv_wrap"' + (hasAdvData ? '' : ' style="display:none"') + '>' +
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
      '</div>';
    })() +
    attachUploadHtml('_pipeAttach', 'pipeline', '📷 รูปแนบ (TOR/PO/ใบเสนอราคา/หน้างาน)') +
    '<div class="form-section">📅 Follow-up <span style="font-weight:400;font-size:.7rem;color:var(--text2)">— ขั้นตอนต่อไปตอนนี้ใช้ Task แทนแล้ว ไปเพิ่มที่ปุ่ม "📋 เพิ่ม Task" ในหน้ารายละเอียดโครงการ</span></div>' +
    '<div class="fr">' + dpH('fp_fudate', p.followupDate || '', 'Follow-up Date') + '<div class="fg"></div></div>' +
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
    h += '<div class="pipe-qa-row">';
    h += '<div class="pqa-wrap">';
    h += '<input type="text" id="pqa_model" class="pipe-qa-model" placeholder="พิมพ์ชื่อสินค้า..." autocomplete="off" onchange="pqaModelChanged()" oninput="pqaModelChanged();_pqaFilterSuggest()" onkeydown="_pqaSuggestKeydown(event)">';
    h += '<div id="pqaSuggestBox" class="pqa-suggest" style="display:none"></div>';
    h += '</div>';
    h += '<input type="number" id="pqa_qty" class="pipe-qa-qty" value="1" min="1" placeholder="QTY" onkeydown="if(event.key===\'Enter\'){event.preventDefault();pqaAdd();}">';
    h += '<input type="text" inputmode="decimal" id="pqa_price" class="pipe-qa-price js-money" placeholder="ราคา/ชิ้น" onkeydown="if(event.key===\'Enter\'){event.preventDefault();pqaAdd();}">';
    h += '<button class="btn bp bsm" onclick="pqaAdd()">➕</button>';
    h += '<button class="btn bo bsm" onclick="openProductPicker({showPrice:true, onAdd:pickerAddToPipe})" title="เลือกจากแคตตาล็อก (แนะนำ/ค้นหา/หมวดหมู่)">📋 แคตตาล็อก</button>';
    h += '</div>';
    _pqaBindOutsideClose();

    // ส่วน Items List — แสดงรายการที่เพิ่ม + แก้จำนวน inline + ลบ
    var itemModelListId = 'pipeItemModelList_' + Date.now();
    h += buildAdminModelDatalist(itemModelListId);
    if (pipeItemsTemp.length > 0) {
      h += '<div style="margin-top:8px">';
      for (var ii = 0; ii < pipeItemsTemp.length; ii++) {
        var it = pipeItemsTemp[ii];
        var lineTotal = (Number(it.qty) || 1) * (Number(it.price) || 0);
        var hasSplit = !!(it.shipBatches && it.shipBatches.length);
        h += '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:' + (hasSplit ? 'none' : '1px solid rgba(127,127,127,0.2)') + '">';
        h += '<input type="text" list="' + itemModelListId + '" value="' + sanitize(it.model) + '" onchange="pqaUpdateModel(' + ii + ', this.value)" style="flex:1;min-width:0;font-size:.82rem" title="แก้สินค้า" autocomplete="off">';
        h += '<input type="number" min="1" value="' + (Number(it.qty) || 1) + '" onchange="pqaUpdateQty(' + ii + ', this.value)" style="width:56px" title="แก้จำนวน">';
        h += '<span id="pqitot_' + ii + '" style="width:84px;text-align:right;opacity:.65;font-size:12px;flex-shrink:0">฿' + fmtMoneyShort(lineTotal) + '</span>';
        h += '<button class="btn bsm ' + (hasSplit ? 'bp' : 'bo') + '" onclick="pqaToggleSplit(' + ii + ')" title="แบ่งส่งเป็นหลายรอบ">🚚</button>';
        h += '<button class="btn bd bsm" onclick="pqaRemove(' + ii + ')" title="ลบ">🗑️</button>';
        h += '</div>';
        if (hasSplit) h += _pqaBatchEditorHtml(ii);
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
  var raw = modelInput ? modelInput.value : '';
  var priceEl = document.getElementById('pqa_price');
  if (priceEl && raw) {
    // รองรับพิมพ์ทั้ง SKU และชื่อ — ดึงราคาตาม Level ของ dealer ที่เลือกในฟอร์ม ถ้าหาไม่ได้ค่อย fallback เป็น RRP
    var prod = _pipeResolveProduct(raw);
    var level = _pipeFormDealerLevel();
    var price = 0;
    if (prod && level && typeof window.getModelPriceByLevel === 'function') price = window.getModelPriceByLevel(prod.name, level) || 0;
    if (!price) price = prod ? (Number(prod.rrpExVat) || Number(prod.price) || 0) : 0;
    if (!price && typeof window.getModelRrpExVat === 'function') price = window.getModelRrpExVat(raw);
    if (!price && typeof window.getModelPrice === 'function') price = window.getModelPrice(raw);
    if (price > 0) priceEl.value = nmI(price);
  }
}
// dropdown แนะนำสินค้าแบบ custom (แทน native <datalist>) — ควบคุมความกว้าง/การตัดคำเองได้ ชื่อยาวไม่โดนตัด
function _pqaFilterSuggest() {
  var input = document.getElementById('pqa_model');
  var box = document.getElementById('pqaSuggestBox');
  if (!input || !box) return;
  var q = (input.value || '').trim().toLowerCase();
  if (!q) { box.style.display = 'none'; box.innerHTML = ''; window._pqaSuggestMatches = []; return; }
  var products = getAllModelsWithPricesForAdmin();
  var matches = products.filter(function(p) {
    if (!p || !p.name) return false;
    var n = p.name.toLowerCase();
    var s = (p.sku || '').toLowerCase();
    return n.indexOf(q) !== -1 || s.indexOf(q) !== -1;
  }).slice(0, 8);
  window._pqaSuggestMatches = matches;
  window._pqaSuggestActiveIdx = -1;
  if (!matches.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  var html = '';
  matches.forEach(function(p, i) {
    var price = Number(p.rrpExVat) || Number(p.price) || 0;
    html += '<div class="pqa-suggest-item" onmousedown="_pqaSuggestPick(' + i + ')">' +
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
function _pqaSuggestPick(i) {
  var p = (window._pqaSuggestMatches || [])[i];
  if (!p) return;
  var input = document.getElementById('pqa_model');
  if (input) input.value = p.name;
  pqaModelChanged();
  var box = document.getElementById('pqaSuggestBox');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  var qtyEl = document.getElementById('pqa_qty');
  if (qtyEl) qtyEl.focus();
}
function _pqaSuggestHighlight() {
  var box = document.getElementById('pqaSuggestBox');
  if (!box) return;
  var items = box.querySelectorAll('.pqa-suggest-item');
  for (var i = 0; i < items.length; i++) items[i].classList.toggle('active', i === window._pqaSuggestActiveIdx);
  var activeEl = items[window._pqaSuggestActiveIdx];
  if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ block: 'nearest' });
}
function _pqaSuggestKeydown(event) {
  var box = document.getElementById('pqaSuggestBox');
  var matches = window._pqaSuggestMatches || [];
  var open = box && box.style.display !== 'none' && matches.length;
  if (event.key === 'ArrowDown' && open) {
    event.preventDefault();
    window._pqaSuggestActiveIdx = Math.min((window._pqaSuggestActiveIdx == null ? -1 : window._pqaSuggestActiveIdx) + 1, matches.length - 1);
    _pqaSuggestHighlight();
    return;
  }
  if (event.key === 'ArrowUp' && open) {
    event.preventDefault();
    window._pqaSuggestActiveIdx = Math.max((window._pqaSuggestActiveIdx == null ? 0 : window._pqaSuggestActiveIdx) - 1, 0);
    _pqaSuggestHighlight();
    return;
  }
  if (event.key === 'Escape' && open) { box.style.display = 'none'; return; }
  if (event.key === 'Enter') {
    event.preventDefault();
    if (open && window._pqaSuggestActiveIdx >= 0) _pqaSuggestPick(window._pqaSuggestActiveIdx);
    else pqaAdd();
  }
}
// ปิด dropdown ตอนคลิกนอกกล่อง — bind ครั้งเดียวตลอด session (query DOM สดทุกครั้ง กันปัญหา listener ค้างตอน re-render)
function _pqaBindOutsideClose() {
  if (window._pqaOutsideBound) return;
  window._pqaOutsideBound = true;
  document.addEventListener('click', function(e) {
    var box = document.getElementById('pqaSuggestBox');
    var input = document.getElementById('pqa_model');
    if (!box || box.style.display === 'none') return;
    if (box.contains(e.target) || e.target === input) return;
    box.style.display = 'none';
  });
}
function pqaAdd() {
  var modelInput = document.getElementById('pqa_model');
  var raw = modelInput ? modelInput.value.trim() : '';
  var qty = parseInt(document.getElementById('pqa_qty').value) || 1;
  var priceEl = document.getElementById('pqa_price');
  var price = priceEl ? parseNum(priceEl.value) : 0;

  if (!raw) { toast('เลือก Model ก่อน'); return; }

  // ถ้าตรงกับสินค้าในแคตตาล็อก (พิมพ์ SKU หรือชื่อ) → เก็บชื่อจริง + SKU + เติมราคาถ้ายังว่าง
  // ถ้าไม่ตรง (พิมพ์เอง/นอกแคตตาล็อก) → ใช้ตามที่พิมพ์ + ราคา manual, sku ว่าง
  var prod = _pipeResolveProduct(raw);
  var model = prod ? prod.name : raw;
  var sku = prod ? (prod.sku || '') : '';
  if (!price && prod) price = Number(prod.rrpExVat) || Number(prod.price) || 0;

  var total = qty * price;
  pipeItemsTemp.push({model: model, qty: qty, price: price, total: total, sku: sku});
  if (typeof addRecentModel === 'function') addRecentModel(model);

  var el = document.getElementById('pipeItemsSection');
  if (el) el.innerHTML = buildPipeItemsSection({});
  
  updatePipeFcFromItems();
  
  if (modelInput) modelInput.value = '';
  document.getElementById('pqa_qty').value = '1';
  if (priceEl) priceEl.value = '';
  
  toast('➕ เพิ่ม ' + model + ' x' + qty);
}
// ================================================================
// แบ่งส่งสินค้าเป็นหลายรอบ (shipBatches) — ต่อ 1 item ใน pipeItemsTemp แบ่งเป็นหลายล็อต
// {month:'YYYY-MM', qty} กันงงตอน forecast/ใบเสนอราคาโปรเจคที่ส่งของไม่พร้อมกันทีเดียว
// ================================================================
function pqaToggleSplit(idx) {
  var it = pipeItemsTemp[idx];
  if (!it) return;
  if (it.shipBatches && it.shipBatches.length) {
    delete it.shipBatches;
  } else {
    it.shipBatches = [{ month: '', qty: Number(it.qty) || 1 }];
  }
  var el = document.getElementById('pipeItemsSection');
  if (el) el.innerHTML = buildPipeItemsSection({});
}
function pqaAddBatch(idx) {
  var it = pipeItemsTemp[idx];
  if (!it || !it.shipBatches) return;
  it.shipBatches.push({ month: '', qty: 0 });
  var el = document.getElementById('pipeItemsSection');
  if (el) el.innerHTML = buildPipeItemsSection({});
}
function pqaRemoveBatch(idx, bi) {
  var it = pipeItemsTemp[idx];
  if (!it || !it.shipBatches) return;
  it.shipBatches.splice(bi, 1);
  if (!it.shipBatches.length) delete it.shipBatches;
  var el = document.getElementById('pipeItemsSection');
  if (el) el.innerHTML = buildPipeItemsSection({});
}
function pqaUpdateBatch(idx, bi, field, val) {
  var it = pipeItemsTemp[idx];
  if (!it || !it.shipBatches || !it.shipBatches[bi]) return;
  if (field === 'qty') it.shipBatches[bi].qty = Math.max(0, parseInt(val, 10) || 0);
  else it.shipBatches[bi].month = val;
  var el = document.getElementById('pipeItemsSection');
  if (el) el.innerHTML = buildPipeItemsSection({});
}
function _pqaBatchEditorHtml(idx) {
  var it = pipeItemsTemp[idx];
  var batches = it.shipBatches || [];
  var sum = batches.reduce(function(s, b) { return s + (Number(b.qty) || 0); }, 0);
  var target = Number(it.qty) || 1;
  var ok = sum === target;
  var h = '<div style="padding:6px 0 10px 0;border-bottom:1px solid rgba(127,127,127,0.2)">';
  batches.forEach(function(b, bi) {
    h += '<div style="display:flex;align-items:center;gap:6px;background:var(--bg2,rgba(127,127,127,.08));border-radius:6px;padding:5px 8px;margin-bottom:5px">';
    h += '<span style="font-size:11px;opacity:.6;width:14px">' + (bi + 1) + '</span>';
    h += '<input type="month" value="' + sanitize(b.month || '') + '" onchange="pqaUpdateBatch(' + idx + ',' + bi + ',\'month\',this.value)" style="flex:1;font-size:.78rem">';
    h += '<input type="number" min="0" value="' + (Number(b.qty) || 0) + '" onchange="pqaUpdateBatch(' + idx + ',' + bi + ',\'qty\',this.value)" style="width:56px;font-size:.78rem" title="จำนวน">';
    h += '<span style="font-size:11px;opacity:.55">ชิ้น</span>';
    h += '<button class="btn bsm" style="padding:2px 6px" onclick="pqaRemoveBatch(' + idx + ',' + bi + ')" title="ลบล็อต">✕</button>';
    h += '</div>';
  });
  h += '<button class="btn bsm bo" style="font-size:.74rem" onclick="pqaAddBatch(' + idx + ')">➕ เพิ่มล็อตส่งของ</button>';
  h += '<div style="display:flex;justify-content:space-between;font-size:.72rem;margin-top:4px;color:' + (ok ? '#22c55e' : '#ef4444') + '">' +
    '<span>รวมที่แบ่งไว้</span><span>' + sum + ' / ' + target + ' ชิ้น' + (ok ? ' ตรงกับยอดสั่งซื้อ' : ' — ยังไม่ตรง') + '</span></div>';
  h += '</div>';
  return h;
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
  pipeItemsTemp[idx].sku = _pipeSkuForModel(newModel);
  var newPrice = 0;
  var _level = _pipeFormDealerLevel();
  if (_level && typeof window.getModelPriceByLevel === 'function') newPrice = window.getModelPriceByLevel(newModel, _level) || 0;
  if (!newPrice && typeof window.getModelRrpExVat === 'function') newPrice = window.getModelRrpExVat(newModel);
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
function pickerAddToPipe(model, qty, price, sku) {
  var total = (Number(qty) || 1) * (Number(price) || 0);
  pipeItemsTemp.push({ model: model, qty: Number(qty) || 1, price: Number(price) || 0, total: total, sku: sku || _pipeSkuForModel(model) });
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
  try { (typeof ST !== 'undefined' && ST._set ? ST._set('v7_recent_models', a.slice(0, 8)) : localStorage.setItem('v7_recent_models', JSON.stringify(a.slice(0, 8)))); } catch (e) {}
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
  var dealer = _resolveDealerFlexible(_ppState.dealerId);
  if (dealer && typeof window.getModelPriceByLevel === 'function') price = window.getModelPriceByLevel(model, dealer.level || 'Other') || 0;
  if (!price && typeof window.getModelRrpExVat === 'function') price = window.getModelRrpExVat(model) || 0;
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
function ppDoAdd(model, qty, sku) {
  if (_ppState.onAdd) _ppState.onAdd(model, Number(qty) || 1, ppModelPrice(model), sku);
}
function ppPickModel(model) { ppDoAdd(model, 1); }
function ppPick(idx) {
  var pr = _ppRefs[idx];
  if (!pr) return;
  var qel = document.getElementById('ppq_' + idx);
  ppDoAdd(pr.name, qel ? (parseInt(qel.value, 10) || 1) : 1, pr.sku); // ส่ง SKU ของตัวที่เลือกตรงๆ
}
function _ppChip(model, isRec) {
  var bg = isRec ? 'rgba(251,191,36,.15)' : 'var(--bg2)';
  var color = isRec ? '#fbbf24' : 'var(--text2)';
  var border = isRec ? '1px solid rgba(251,191,36,.3)' : '1px solid var(--border)';
  return '<span onclick="ppPickModel(\'' + ppEsc(model) + '\')" style="cursor:pointer;font-size:12px;background:' + bg + ';color:' + color + ';border:' + border + ';padding:5px 10px;border-radius:8px">+ ' + sanitize(model) + '</span>';
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
    rec.forEach(function (m) { chips += _ppChip(m, true); });
    chips += '</div>';
  }
  if (recent.length) {
    chips += '<div style="font-size:12px;color:var(--text2);margin:2px 0 5px">🕘 เพิ่งใช้</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
    recent.forEach(function (m) { chips += _ppChip(m, false); });
    chips += '</div>';
  }
  ov.innerHTML =
    '<div style="width:100%;max-width:560px;max-height:85vh;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)">' +
        '<span style="font-size:15px;font-weight:700;color:var(--text)">📦 เลือกสินค้า</span>' +
        '<button onclick="closeProductPicker()" style="background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer">✕</button>' +
      '</div>' +
      '<div style="padding:12px 16px;overflow-y:auto">' +
        '<div style="display:flex;gap:6px;margin-bottom:10px">' +
        '<input id="ppSearch" type="text" oninput="ppSearch(this.value)" placeholder="🔍 พิมพ์ชื่อ / SKU / M350..." autocomplete="off" style="flex:1;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg2);color:var(--text)">' +
        '<button type="button" class="btn bo bsm" onclick="_ppToggleNew()" title="สินค้านี้ไม่มีในแคตตาล็อก — เพิ่มใหม่ได้เลย">➕ ใหม่</button>' +
        '</div>' +
        '<div id="ppNewWrap" style="display:none;background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:10px">' +
        '<div style="display:flex;gap:6px;margin-bottom:6px"><input type="text" id="ppNewName" placeholder="ชื่อสินค้า" style="flex:1"><input type="text" inputmode="decimal" id="ppNewPrice" placeholder="ราคา RRP Ex Vat" style="width:130px"></div>' +
        '<button type="button" class="btn bp bsm" onclick="_ppSaveNew()">💾 บันทึกและเลือก</button>' +
        '</div>' +
        chips +
        '<div id="ppListWrap"></div>' +
      '</div>' +
    '</div>';
  pickerRenderList();
  var s = document.getElementById('ppSearch');
  if (s) s.focus();
}
// เพิ่มสินค้าใหม่ตรงจาก Product Picker เลย — ไม่ต้องปิด picker ไปหน้า "สินค้าทั้งหมด" แยก แล้วต้องพิมพ์ชื่อ
// ใหม่กลับมาเลือกอีกที เพราะ picker เป็น overlay ลอยอยู่แล้ว ไม่ได้แย่งช่อง modal กับฟอร์มที่เปิด picker อยู่
// (ใส่เฉพาะชื่อ+ราคาเบื้องต้น รายละเอียดเต็มๆ เช่น SKU/หมวดหมู่ยังแก้เพิ่มได้ทีหลังจากหน้า "สินค้าทั้งหมด")
function _ppToggleNew() {
  var w = document.getElementById('ppNewWrap');
  if (!w) return;
  var show = w.style.display === 'none';
  w.style.display = show ? '' : 'none';
  if (show) { var n = document.getElementById('ppNewName'); if (n) n.focus(); }
}
function _ppSaveNew() {
  var nameEl = document.getElementById('ppNewName');
  var priceEl = document.getElementById('ppNewPrice');
  var name = (nameEl.value || '').trim();
  if (!name) return alert('ใส่ชื่อสินค้า');
  var price = parseNum(priceEl.value);
  Products.add({
    name: name, sku: '', category: 'other', rrpExVat: price, price: price,
    typePrices: { S: price, A: price, B: price, Other: price },
    eol: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  toast('✅ เพิ่มสินค้าใหม่แล้ว');
  ppDoAdd(name, 1);
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
    html += '<div style="font-size:12px;color:var(--text2);margin:10px 0 6px">' + sanitize(cat.name) + '</div>';
    items.forEach(function (pr) {
      shown++;
      var idx = _ppRefs.push(pr) - 1; // เก็บ product object ทั้งตัว เพื่อได้ SKU ตอนคลิก
      var price = _ppState.showPrice ? ppModelPrice(pr.name) : 0;
      html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:5px">' +
        '<span style="font-size:14px;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">' + sanitize(pr.name) + '</span>' +
        ((_ppState.showPrice && price) ? '<span style="font-size:12px;color:var(--text2);white-space:nowrap">฿' + fmtMoneyShort(price) + '</span>' : '') +
        '<input id="ppq_' + idx + '" type="number" value="1" min="1" style="width:46px;padding:4px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text)">' +
        '<button onclick="ppPick(' + idx + ')" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;white-space:nowrap">+ เพิ่ม</button>' +
        '</div>';
    });
  });
  if (!shown) html = '<div style="text-align:center;color:var(--text2);padding:24px">ไม่พบสินค้า' + (q ? ' "' + sanitize(q) + '"' : '') + '</div>';
  wrap.innerHTML = html;
}

// ================================================================
// SAVE PIPELINE (Multi-Model)
// ================================================================
function savePipeline(dealerId, eid) {
  var typedDealerName = document.getElementById('fp_dealer').value.trim();
  if (!typedDealerName) return alert('กรอกชื่อ Dealer');
  resolveDealerIdByName(typedDealerName, function(resolvedDealerId) {
    _finishSavePipeline(resolvedDealerId, eid);
  });
}

function _finishSavePipeline(dealerId, eid) {
  var typedProjectId = document.getElementById('fp_projectid') ? document.getElementById('fp_projectid').value.trim() : '';
  var data = {
    rowNo: document.getElementById('fp_rowno') ? document.getElementById('fp_rowno').value.trim() : '',
    projectId: typedProjectId,
    registerDate: dpG('fp_reg'),
    projectName: document.getElementById('fp_name').value.trim(),
    endUserTH: document.getElementById('fp_eu_th').value.trim(),
    endUserEN: document.getElementById('fp_eu_en').value.trim(),
    agencyMain: document.getElementById('fp_agency_main') ? document.getElementById('fp_agency_main').value.trim() : '',
    agencySub: document.getElementById('fp_agency_sub') ? document.getElementById('fp_agency_sub').value.trim() : '',
    industrialType: (function() {
      var sel = document.getElementById('fp_indtype');
      if (!sel) return '';
      if (sel.value === '__other__') return (document.getElementById('fp_indtype_custom') || {}).value ? document.getElementById('fp_indtype_custom').value.trim() : '';
      return sel.value;
    })(),
    unitType: document.getElementById('fp_unit').value,
    dealerId: dealerId,
    djiDealer: document.getElementById('fp_djid').value,
    forecastAmount: parseNum(document.getElementById('fp_fc') ? document.getElementById('fp_fc').value : 0),
    realAmount: parseNum(document.getElementById('fp_real') ? document.getElementById('fp_real').value : 0),
    tor: document.getElementById('fp_tor').value,
    biddingDate: dpG('fp_bid'),
    shipmentDate: dpG('fp_ship'),
    expectedCloseDate: dpG('fp_close'),
    appointmentLetter: document.getElementById('fp_appt').value,
    projectPOS: document.getElementById('fp_pos') ? (parseInt(document.getElementById('fp_pos').value) || 0) : 0,
    status: document.getElementById('fp_status').value,
    followupDate: dpG('fp_fudate'),
    recurring: document.querySelector('input[name="fp_rec"]:checked') ? document.querySelector('input[name="fp_rec"]:checked').value === '1' : false,
    remark: document.getElementById('fp_remark').value.trim(),
    // มี Project ID = ถือว่าลงทะเบียน CRM แล้วเสมอ (Project ID ได้มาจากตอนลงทะเบียนเท่านั้น) แม้ user ลืมติ๊ก checkbox เอง
    djiCrmRegistered: typedProjectId ? true : (document.getElementById('fp_crm') ? document.getElementById('fp_crm').checked : false),
    djiCrmDate: dpG('fp_crmdate') || (typedProjectId ? _td() : ''),
    hasCompetitor: document.getElementById('fp_comp') ? document.getElementById('fp_comp').checked : false,
    competitorName: document.getElementById('fp_compname') ? document.getElementById('fp_compname').value.trim() : '',
    pocDone: document.getElementById('fpc_poc') ? document.getElementById('fpc_poc').checked : false,
    presentedDone: document.getElementById('fpc_present') ? document.getElementById('fpc_present').checked : false,
    torDraftDone: document.getElementById('fpc_drafttor') ? document.getElementById('fpc_drafttor').checked : false,
    budgetFiscalYear: document.getElementById('fp_fy') && document.getElementById('fp_fy').value ? parseInt(document.getElementById('fp_fy').value, 10) : null,
    projectRevenue: parseNum(document.getElementById('fp_projrev') ? document.getElementById('fp_projrev').value : 0),
    saleName: document.getElementById('fp_sale') ? document.getElementById('fp_sale').value.trim() : '',
    sheetDisplay: document.querySelector('input[name="fp_disp"]:checked') ? document.querySelector('input[name="fp_disp"]:checked').value : 'Show',
    attachments: window._pipeAttach || []
  };

  // ติ๊ก "ใช้ค่านี้แทน X%" ไว้ — เซ็ต POS เป็นค่าแนะนำ (คำนวณสดจากค่าที่กรอกในฟอร์มตอนนี้ ไม่ใช่ตอน render ครั้งแรก)
  var fpPosApplyEl = document.getElementById('fp_posapply_');
  if (fpPosApplyEl && fpPosApplyEl.checked) {
    var _posRes = posChkCompute('fp_', '');
    if (_posRes) data.projectPOS = _posRes.score;
  }

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
    var _oldPForPos = ST.getOne('pipeline', eid);
    data.posHistory = appendPosHistory(_oldPForPos, data.projectPOS);
    ST.update('pipeline', eid, data);
    closeMForce();
    go('pipeDetail', {pipeId: eid});
  } else {
    data.posHistory = appendPosHistory(null, data.projectPOS);
    var p = ST.add('pipeline', data);
    ST.add('pipeLog', {pipeId: p.id, type: 'note', content: 'ลงทะเบียนโครงการ', date: _nw()});
    closeMForce();
    go('pipeDetail', {pipeId: p.id});
  }
  toast('💾 บันทึกแล้ว');
  pipeItemsTemp = [];
}

// Pipeline Update — รวม "📝 Quick Update" (เปลี่ยน status/next action ได้) กับ "➕ Update" (log อย่างเดียว)
// เป็น modal เดียว ใช้ได้ทั้งจากปุ่มย่อในตาราง list และปุ่มในการ์ด Updates ของหน้า detail
function showPipeUpdateM(pipeId) {
  var p = ST.getOne('pipeline', pipeId);
  if (!p) return;
  var cfg = getConfig();
  openM('📝 อัพเดท Pipeline — ' + (p.projectName || '').substr(0, 30), '' +
    '<div style="font-size:.76rem;color:#94a3b8;margin-bottom:8px">' + sanitize((p.projectName || '').substr(0, 50)) + ' • ' + pipeTag(p.status) + ' • 💰 ' + fmtMoney(p.forecastAmount) + '</div>' +
    '<div class="fg"><label>ประเภท</label><select id="qu_t"><option value="update">📝 อัพเดท</option><option value="progress">🟢 คืบหน้า</option><option value="problem">🔴 ปัญหา</option><option value="solution">🟡 แก้ไข</option><option value="forecast">📦 Forecast</option><option value="note">⚪ หมายเหตุ</option></select></div>' +
    '<div class="fg"><label>⚡ Quick Fill</label><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
    '<button type="button" class="btn-sm" onclick="puQuickFill(\'ลูกค้ากำลังพิจารณา\')">🤔 กำลังพิจารณา</button>' +
    '<button type="button" class="btn-sm" onclick="puQuickFill(\'รอ Approve งบประมาณ\')">💰 รอ Approve งบ</button>' +
    '<button type="button" class="btn-sm" onclick="puQuickFill(\'ส่ง Quote แล้ว รอลูกค้าตอบ\')">📄 ส่ง Quote แล้ว</button>' +
    '<button type="button" class="btn-sm" onclick="puQuickFill(\'นัดพรีเซนต์/Demo ให้ลูกค้า\')">🎯 นัด Demo</button>' +
    '<button type="button" class="btn-sm" onclick="puQuickFill(\'แข่งราคากับคู่แข่ง\')">⚔️ แข่งราคา</button>' +
    '<button type="button" class="btn-sm" onclick="puQuickFill(\'ลูกค้าขอข้อมูล/Spec เพิ่มเติม\')">🚁 ขอ Spec เพิ่ม</button>' +
    '<button type="button" class="btn-sm" onclick="puQuickFill(\'เลื่อนกำหนดตัดสินใจ\')">📅 เลื่อนตัดสินใจ</button>' +
    '<button type="button" class="btn-sm" onclick="puQuickFill(\'ติดตามลูกค้า ยังไม่มีความคืบหน้าใหม่\')">🔄 Follow-up</button>' +
    '</div></div>' +
    '<div class="fg"><label>รายละเอียด <small style="color:#64748b">(ไม่บังคับ ถ้าแค่เปลี่ยน Status)</small></label><textarea id="qu_c" rows="3" placeholder="พิมพ์อัพเดทสั้นๆ..."></textarea></div>' +
    '<div class="fr"><div class="fg"><label>เปลี่ยน Status</label><select id="qu_st"><option value="">-- ไม่เปลี่ยน --</option>' + cfg.pipelineStatuses.map(function(s) { return '<option value="' + s.id + '"' + (p.status === s.id ? ' selected' : '') + '>' + s.name + '</option>'; }).join('') + '</select></div>' +
    '<div class="fg"></div></div>' +
    dpH('qu_fu', p.followupDate || '', 'Follow-up Date') +
    dpH('qu_d', _td(), 'วันที่บันทึก') +
    '<button class="btn bp btn-full" onclick="savePipeUpdate(\'' + pipeId + '\')">💾 บันทึก</button>');
}

function puQuickFill(text) {
  var el = document.getElementById('qu_c');
  if (el) el.value = text;
}

function savePipeUpdate(pipeId) {
  var content = document.getElementById('qu_c').value.trim();
  var logType = document.getElementById('qu_t').value;
  var newStatus = document.getElementById('qu_st').value;
  var followupDate = dpG('qu_fu');
  var p = ST.getOne('pipeline', pipeId);

  var hasChange = content || newStatus || followupDate;
  if (!hasChange) return alert('ใส่รายละเอียดอัพเดท หรือเปลี่ยน Status อย่างน้อยหนึ่งอย่าง');
  if (!content && !confirm('ยังไม่ได้ใส่รายละเอียด ต้องการบันทึกการเปลี่ยนแปลงนี้ต่อไหม?')) return;

  if (newStatus && p && newStatus !== p.status) {
    logType = 'status_change';
    content = getPipeName(newStatus) + (content ? ' — ' + content : '');
  }
  ST.add('pipeLog', {pipeId: pipeId, type: logType, content: content || getPipeName(newStatus) || '(ไม่มีรายละเอียด)', date: (dpG('qu_d') || _td()) + 'T' + new Date().toTimeString().slice(0, 8)});

  var updates = {};
  if (newStatus) updates.status = newStatus;
  if (followupDate !== undefined) updates.followupDate = followupDate;
  if (Object.keys(updates).length) ST.update('pipeline', pipeId, updates);

  closeMForce(); toast('📝 อัพเดทแล้ว'); render();
}

// Win/Loss Modals
function showWinReasonM(pipeId, newStatus) {
  var cfg = getConfig();
  var p = ST.getOne('pipeline', pipeId);
  openM('✅ Win — สาเหตุที่ได้งาน', '' +
    '<div class="fg"><label>สาเหตุ <button type="button" class="btn-xs" onclick="showCfgListEditorM(\'winReasons\',\'⚙️ จัดการเหตุผล Win\', function(){ showWinReasonM(\'' + pipeId + '\',\'' + newStatus + '\'); })">⚙️</button></label><div class="check-g">' + cfg.winReasons.map(function(r) { return '<label><input type="checkbox" name="wr" value="' + r + '"><span>' + r + '</span></label>'; }).join('') + '</div></div>' +
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
    '<div class="fg"><label>สาเหตุ <button type="button" class="btn-xs" onclick="showCfgListEditorM(\'lossReasons\',\'⚙️ จัดการเหตุผล Lost\', function(){ showLossReasonM(\'' + pipeId + '\'); })">⚙️</button></label><div class="check-g">' + cfg.lossReasons.map(function(r) { return '<label><input type="checkbox" name="lr" value="' + r + '"><span>' + r + '</span></label>'; }).join('') + '</div></div>' +
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
  ST.update('pipeline', pipeId, {status: 'fail_lost', lossReason: reasons.join(', '), lossCompetitor: comp, lossCompetitorPrice: price, lossNote: note});
  ST.add('pipeLog', {pipeId: pipeId, type: 'fail_lost', content: '❌ Fail & Lost: ' + reasons.join(', ') + (comp ? ' — ชนะโดย: ' + comp : '') + (note ? ' — ' + note : ''), date: _nw()});
  closeMForce(); toast('❌ บันทึก Lost'); render();
}

// ================================================================
// VISIT MODAL (Fixed Topic Cards)
// ================================================================
var visitMode = 'full';
window._visitSourceType = window._visitSourceType || 'dealer';

// เปิด Visit Report เป็นแท็บแยก — แบ่งซ้าย/ขวา ฟอร์ม + สมุดโน้ตเร็ว เผื่อสลับไปทำเมนูอื่นในแท็บเดิมได้
// planId: ถ้ามาจากนัดใน Visit Plan ส่งมาด้วย เพื่อผูกผล Visit กลับเข้าแผนนัดอัตโนมัติหลังบันทึก (ดู rVisitWindow ใน views-visit.js)
function openVisitWindow(dealerId, eid, planId, mode) {
  var url = location.pathname + '?visitWindow=1&dealerId=' + encodeURIComponent(dealerId || '') +
    (eid ? '&eid=' + encodeURIComponent(eid) : '') +
    (planId ? '&planId=' + encodeURIComponent(planId) : '') +
    (mode ? '&mode=' + encodeURIComponent(mode) : '');
  window.open(url, '_blank');
}

var _visitLastOpenKey = null;
function showVisitM(dealerId, eid) {
  var existDealer = dealerId || (eid ? (ST.getOne('visits', eid) || {}).dealerId : '') || '';
  // ถามกู้คืนร่างแค่ครั้งเดียวตอนเปิดฟอร์มนี้จริงๆ (ไม่ถามซ้ำตอนสลับโหมด Quick/Standard/Full ที่เรียก
  // showVisitM ซ้ำด้วย dealerId/eid ชุดเดิม — เทียบ key กันไว้)
  var _openKey = existDealer + '|' + (eid || '');
  if (_openKey !== _visitLastOpenKey) {
    _visitLastOpenKey = _openKey;
    window._visitDraftOverride = null;
    if (!eid) _visitOfferDraftRestore();
    // เปิดแก้ไข Visit เดิม — ให้ฟอร์มเปิดโหมดเดียวกับตอนบันทึกไว้ (เช่น New Partner) ไม่ใช่โหมดที่ใช้อยู่ก่อนหน้า
    if (eid) { var _ev = ST.getOne('visits', eid); if (_ev && _ev.reportMode) visitMode = _ev.reportMode; }
  }
  var rerender = "showVisitM('" + existDealer + "','" + (eid || '') + "')";
  var html = buildVisitFormHtml(existDealer, eid, rerender);
  var title = visitMode === 'full' ? '📋 Full Visit Report' : (visitMode === 'quick' ? '⚡ Quick Visit' : (visitMode === 'partner' ? '🆕 New Partner Report' : '📝 Standard Visit'));
  openM(title, html);
}

// เตือนถ่ายรูป — โชว์เฉพาะตอนยังไม่มีรูปแนบเลย (เช็คจาก window._visitAttach ที่ตั้งไว้ก่อนเรียกฟังก์ชันนี้)
function visitPhotoReminderHtml() {
  if ((window._visitAttach || []).length) return '';
  return '<div class="warn-box" style="display:flex;align-items:center;gap:8px"><span style="font-size:16px">📷</span><span>อย่าลืมถ่ายรูปหน้าร้าน/หลักฐานการเข้าพบด้วย!</span></div>';
}

// เก็บค่าที่พิมพ์ค้างไว้ในฟอร์มก่อนสลับโหมด Quick/Standard/Full — กันข้อมูล เช่น "สรุปการคุย" หายตอน
// buildVisitFormHtml() re-render ใหม่จาก ST.getOne('visits', eid) (ค่าที่เพิ่งพิมพ์ยังไม่ได้ save ไม่มีอยู่ในนั้น)
function _visitCaptureDraft() {
  var d = window._visitDraftOverride || {};
  var summaryEl = document.getElementById('fv_summary');
  if (summaryEl) d.summary = summaryEl.value;
  // fv_date เป็น custom date picker (dpH) ไม่มี element id 'fv_date' ตรงๆ ค่าจริงอยู่ที่ dpv_fv_date — ใช้ dpG()
  var dateVal = dpG('fv_date');
  if (dateVal) d.date = dateVal;
  var timeEl = document.getElementById('fv_time');
  if (timeEl) d.time = timeEl.value;
  var locEl = document.getElementById('fv_loc');
  if (locEl) d.location = locEl.value;
  var modeEl = document.querySelector('input[name="fv_mode"]:checked');
  if (modeEl) d.mode = modeEl.value;
  var djidEl = document.getElementById('fv_djid');
  if (djidEl) d.djiDealer = djidEl.value;
  window._visitDraftOverride = d;
}

// สร้าง HTML ของฟอร์ม Visit (ใช้ทั้งใน modal ปกติ และหน้าแท็บแยก) — rerenderCall คือคำสั่งที่เรียกตอนสลับโหมด Quick/Standard/Full
// ================================================================
// MULTI-SELECT CHIP PICKER — เลือกได้หลายรายการจากลิสต์ หรือพิมพ์เพิ่มเอง (ใช้ใน New Partner form)
// ค่าที่เลือกเก็บเป็น data-val บน .ms-chip ตรงๆ ใน DOM ไม่ sync state แยก อ่านตอน save ผ่าน _msGetValues(id)
// ================================================================
function _msPickerHtml(id, options, selected, placeholder) {
  selected = selected || [];
  var chips = selected.map(function(v) {
    return '<span class="ms-chip" data-val="' + sanitize(v) + '">' + sanitize(v) + '<button type="button" onclick="_msRemove(event,\'' + id + '\',this)">✕</button></span>';
  }).join('');
  var opts = options.map(function(o) {
    var checked = selected.indexOf(o) !== -1;
    return '<div class="ms-opt" onclick="_msToggle(\'' + id + '\',\'' + o.replace(/'/g, "\\'") + '\')">' + (checked ? '☑ ' : '☐ ') + sanitize(o) + '</div>';
  }).join('');
  return '<div class="ms-picker" id="ms_' + id + '">' +
    '<div class="ms-box" onclick="_msBoxClick(event,\'' + id + '\')">' + chips +
    '<input type="text" class="ms-input" id="ms_input_' + id + '" placeholder="' + sanitize(placeholder || 'พิมพ์เพื่อค้นหาหรือเพิ่มรายการใหม่...') + '" oninput="_msFilter(\'' + id + '\')" onkeydown="_msKeydown(event,\'' + id + '\')" autocomplete="off"></div>' +
    '<div class="ms-dropdown" id="ms_dd_' + id + '">' + opts + '<div class="ms-hint">พิมพ์แล้วกด Enter เพื่อเพิ่มรายการที่ไม่มีในลิสต์</div></div>' +
    '</div>';
}
function _msBoxClick(e, id) {
  if (e.target.closest('.ms-chip')) return;
  document.querySelectorAll('.ms-dropdown').forEach(function(d) { if (d.id !== 'ms_dd_' + id) d.classList.remove('open'); });
  document.getElementById('ms_dd_' + id).classList.add('open');
  var inp = document.getElementById('ms_input_' + id);
  if (inp) inp.focus();
}
function _msFilter(id) {
  var q = (document.getElementById('ms_input_' + id).value || '').toLowerCase();
  document.querySelectorAll('#ms_dd_' + id + ' .ms-opt').forEach(function(o) {
    o.style.display = o.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
  });
}
function _msAddChip(id, label) {
  label = (label || '').trim();
  if (!label) return;
  var box = document.querySelector('#ms_' + id + ' .ms-box');
  var input = document.getElementById('ms_input_' + id);
  if (!box || !input) return;
  var exists = Array.prototype.some.call(box.querySelectorAll('.ms-chip'), function(c) { return c.getAttribute('data-val') === label; });
  if (exists) { input.value = ''; return; }
  var chip = document.createElement('span');
  chip.className = 'ms-chip';
  chip.setAttribute('data-val', label);
  chip.innerHTML = sanitize(label) + '<button type="button" onclick="_msRemove(event,\'' + id + '\',this)">✕</button>';
  box.insertBefore(chip, input);
  input.value = '';
  _msFilter(id);
}
function _msToggle(id, label) {
  var box = document.querySelector('#ms_' + id + ' .ms-box');
  var existingChip = box ? Array.prototype.filter.call(box.querySelectorAll('.ms-chip'), function(c) { return c.getAttribute('data-val') === label; })[0] : null;
  if (existingChip) existingChip.remove();
  else _msAddChip(id, label);
  var dd = document.getElementById('ms_dd_' + id);
  if (!dd) return;
  dd.querySelectorAll('.ms-opt').forEach(function(o) {
    if (o.textContent.trim().replace(/^[☑☐]\s*/, '') === label) {
      var stillSelected = !!(box && box.querySelector('.ms-chip[data-val="' + label.replace(/"/g, '\\"') + '"]'));
      o.textContent = (stillSelected ? '☑ ' : '☐ ') + label;
    }
  });
}
function _msRemove(e, id, btn) {
  e.stopPropagation();
  var chip = btn.parentElement;
  var label = chip.getAttribute('data-val');
  chip.remove();
  var dd = document.getElementById('ms_dd_' + id);
  if (dd) dd.querySelectorAll('.ms-opt').forEach(function(o) {
    if (o.textContent.trim().replace(/^[☑☐]\s*/, '') === label) o.textContent = '☐ ' + label;
  });
}
function _msKeydown(e, id) {
  if (e.key === 'Enter') { e.preventDefault(); _msAddChip(id, document.getElementById('ms_input_' + id).value); }
}
function _msGetValues(id) {
  var box = document.querySelector('#ms_' + id + ' .ms-box');
  if (!box) return [];
  return Array.prototype.map.call(box.querySelectorAll('.ms-chip'), function(c) { return c.getAttribute('data-val'); });
}
document.addEventListener('click', function(e) {
  if (e.target.closest('.ms-picker')) return;
  document.querySelectorAll('.ms-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
});

// ================================================================
// PILL PICKER — เลือกคำตอบสั้นๆ แบบกดปุ่ม (เคย/ไม่เคย, มี/พร้อมที่จะมี/ยังไม่มี, ยินดี/ไม่สะดวก ฯลฯ)
// options: [{val,label,cls}] cls คือสี sel-yes/sel-mid/sel-no — ใส่ follow-up ได้ผ่าน div id="fu_"+groupId
// + attribute data-show-when="ค่าที่จะให้โผล่"
// ================================================================
function _pillGroupHtml(id, options, selected) {
  return '<div class="pill-g" id="pg_' + id + '">' + options.map(function(o) {
    var sel = o.val === selected;
    return '<div class="pill-opt' + (sel ? ' ' + o.cls : '') + '" data-val="' + sanitize(o.val) + '" onclick="_pillPick(\'' + id + '\',\'' + o.val.replace(/'/g, "\\'") + '\',\'' + o.cls + '\')">' + sanitize(o.label) + '</div>';
  }).join('') + '</div>';
}
function _pillPick(id, val, cls) {
  var g = document.getElementById('pg_' + id);
  if (!g) return;
  g.querySelectorAll('.pill-opt').forEach(function(p) {
    p.classList.remove('sel-yes', 'sel-mid', 'sel-no');
    if (p.getAttribute('data-val') === val) p.classList.add(cls);
  });
  var fu = document.getElementById('fu_' + id);
  if (fu) fu.style.display = (fu.getAttribute('data-show-when') === val) ? '' : 'none';
}
function _pillGetValue(id) {
  var g = document.getElementById('pg_' + id);
  if (!g) return '';
  var sel = g.querySelector('.pill-opt.sel-yes,.pill-opt.sel-mid,.pill-opt.sel-no');
  return sel ? sel.getAttribute('data-val') : '';
}

// ปุ่มสลับโหมด Quick/Standard/Full/(New Partner) — ใช้ร่วมกันทั้ง 3 branch (Quick, Standard/Full, Partner)
// New Partner โชว์เฉพาะ dealer ที่ยังไม่เป็น SAB Authorized Dealer (หรือยังไม่มี dealer ผูกไว้เลย) — ถ้าเป็น SAB แล้วซ่อนปุ่ม
// แต่รายงานเก่าที่เคยกรอกไว้ (reportMode==='partner') ยังเปิดดู/แก้ไขได้ตามปกติผ่าน rVisitDet
function _visitModeBarHtml(dealer, rerenderCall) {
  var showPartner = !dealer || dealer.djiDealer !== 'SAB';
  return '<div class="visit-mode">' +
    '<div class="vm-btn quick' + (visitMode === 'quick' ? ' act' : '') + '" onclick="_visitCaptureDraft();visitMode=\'quick\';' + rerenderCall + '">⚡ Quick</div>' +
    '<div class="vm-btn standard' + (visitMode === 'standard' ? ' act' : '') + '" onclick="_visitCaptureDraft();visitMode=\'standard\';' + rerenderCall + '">📝 Standard</div>' +
    '<div class="vm-btn full' + (visitMode === 'full' ? ' act' : '') + '" onclick="_visitCaptureDraft();visitMode=\'full\';' + rerenderCall + '">📋 Full</div>' +
    (showPartner ? '<div class="vm-btn partner' + (visitMode === 'partner' ? ' act' : '') + '" onclick="_visitCaptureDraft();visitMode=\'partner\';' + rerenderCall + '">🆕 New Partner</div>' : '') +
    '</div>';
}

function buildVisitFormHtml(dealerId, eid, rerenderCall) {
  window._visitCurrentEid = eid || ''; // ให้ระบบ draft autosave รู้ว่ากำลังแก้ของเดิมอยู่ไหม (ดู _visitScheduleDraftSave)
  var v = eid ? ST.getOne('visits', eid) : {};
  if (window._visitDraftOverride) {
    v = Object.assign({}, v, window._visitDraftOverride);
    window._visitDraftOverride = null;
  }
  var cfg = getConfig();
  var existDealer = dealerId || v.dealerId || '';
  var dealer = existDealer ? ST.getOne('dealers', existDealer) : null;
  var prevVisit = existDealer ? (ST.visitsByDealer(existDealer)[0] || null) : null;
  // Mode (Offline/Online) เริ่มต้น: ใช้ค่าที่บันทึกไว้ (แก้ของเดิม) > ค่าที่ dealer นี้ใช้ล่าสุด > offline —
  // ลูกค้าที่คุยผ่าน Online ประจำไม่ต้องกดเปลี่ยนทุกครั้งที่เปิดฟอร์มใหม่
  var defaultMode = v.mode || (prevVisit ? prevVisit.mode : '') || 'offline';
  window._visitAttach = (v.attachments || []).slice();

  if (visitMode === 'partner' && dealer && dealer.djiDealer === 'SAB') visitMode = 'standard';

  // New Partner Mode
  if (visitMode === 'partner') {
    return buildPartnerVisitFormHtml(existDealer, eid, rerenderCall, v, dealer);
  }

  // Quick Mode
  if (visitMode === 'quick') {
    var srcType = window._visitSourceType || 'dealer';
    return '' +
      ((typeof _pendingLinkGuidelineHtml === 'function') ? _pendingLinkGuidelineHtml() : '') +
      // ปุ่มสลับโหมดไว้บนสุดเหมือน Standard/Full — เดิมอยู่ล่างสุดใต้ปุ่มบันทึก ตกขอบจอล่างได้ง่ายเวลาฟอร์มยาว
      // (มีไฟล์แนบ/สรุปยาว) ทำให้ดูเหมือนปุ่มหายไปถ้าไม่เลื่อนจอลงไปสุด
      _visitModeBarHtml(dealer, rerenderCall) +
      visitPhotoReminderHtml() +
      '<div class="fg"><label>ที่มา</label><div class="radio-g"><label><input type="radio" name="fv_source" value="dealer"' + (srcType === 'dealer' ? ' checked' : '') + ' onchange="toggleVisitSource(\'dealer\')"><span>🏢 Dealer</span></label><label><input type="radio" name="fv_source" value="lead"' + (srcType === 'lead' ? ' checked' : '') + ' onchange="toggleVisitSource(\'lead\')"><span>🆕 Lead</span></label><label><input type="radio" name="fv_source" value="other"' + (srcType === 'other' ? ' checked' : '') + ' onchange="toggleVisitSource(\'other\')"><span>🏬 อื่นๆ</span></label></div></div>' +
      '<div id="fv_dealer_row"' + (srcType !== 'dealer' ? ' style="display:none"' : '') + '>' + _dealerPickerHtml('fv_dealer', existDealer, {label: 'Dealer', onChange: 'onVisitDealerChanged'}) + '</div>' +
      '<div id="fv_lead_row"' + (srcType !== 'lead' ? ' style="display:none"' : '') + '><div class="fg"><label>Lead ที่ติดตาม *</label><select id="fv_lead_prospect">' + prospectOptions(window._vpPrefillProspectId || '') + '</select></div></div>' +
      '<div id="fv_other_row"' + (srcType !== 'other' ? ' style="display:none"' : '') + '><div class="fg"><label>ชื่อบริษัท *</label><input type="text" id="fv_company_txt" placeholder="พิมพ์ชื่อบริษัทที่ไปเยี่ยม..." value="' + sanitize(srcType === 'other' ? (v.company || '') : '') + '"></div><div class="hint">💡 ไม่ต้องสร้าง Dealer จริง — ชื่อจะโชว์ในรายงาน/Export เหมือน Dealer ปกติ</div></div>' +
      '<div class="fr">' + dpH('fv_date', v.date || _td(), 'วันที่ *') +
      '<div class="fg"><label>เวลา</label><input type="time" id="fv_time" value="' + (v.time || '') + '"></div></div>' +
      '<div class="fg"><label>Mode</label><div class="radio-g"><label><input type="radio" name="fv_mode" value="offline"' + (defaultMode === 'offline' ? ' checked' : '') + '><span>🤝 Offline</span></label><label><input type="radio" name="fv_mode" value="online"' + (defaultMode === 'online' ? ' checked' : '') + '><span>📞 Online</span></label></div></div>' +
      '<div class="fg"><div style="display:flex;justify-content:space-between;align-items:center"><label>สรุป *</label>' + (AI_FEATURES_ENABLED ? '<button type="button" id="vSumAiBtn" class="btn bsm" onclick="aiCleanVisitNote()" style="font-size:11px;padding:3px 8px" title="ให้ AI จัดโน้ตให้เป็นระเบียบ">✨ AI จัดระเบียบ</button>' : '') + '</div><textarea id="fv_summary" rows="5" placeholder="พิมพ์โน้ตคร่าวๆ' + (AI_FEATURES_ENABLED ? ' แล้วกด ✨ AI จัดระเบียบ' : '') + '">' + sanitize(v.summary || '') + '</textarea></div>' +
      attachUploadHtml('_visitAttach', 'visits', '📷 รูปหน้าร้าน/หลักฐานการเข้าพบ') +
      '<button class="btn bp btn-full" onclick="saveVisitQuick(\'' + existDealer + '\',\'' + (eid || '') + '\')">💾 บันทึก</button>';
  }

  // Standard / Full
  var html = '' +
    ((typeof _pendingLinkGuidelineHtml === 'function') ? _pendingLinkGuidelineHtml() : '') +
    visitPhotoReminderHtml() +
    _visitModeBarHtml(dealer, rerenderCall) +
    '<div class="form-section">📋 ข้อมูลพื้นฐาน</div>' +
    (function() { var st = window._visitSourceType || 'dealer'; return '<div class="fg"><label>ที่มา</label><div class="radio-g"><label><input type="radio" name="fv_source" value="dealer"' + (st === 'dealer' ? ' checked' : '') + ' onchange="toggleVisitSource(\'dealer\')"><span>🏢 Dealer</span></label><label><input type="radio" name="fv_source" value="lead"' + (st === 'lead' ? ' checked' : '') + ' onchange="toggleVisitSource(\'lead\')"><span>🆕 Lead</span></label><label><input type="radio" name="fv_source" value="other"' + (st === 'other' ? ' checked' : '') + ' onchange="toggleVisitSource(\'other\')"><span>🏬 อื่นๆ</span></label></div></div>' + '<div id="fv_dealer_row"' + (st !== 'dealer' ? ' style="display:none"' : '') + '>' + _dealerPickerHtml('fv_dealer', existDealer, {label: 'Dealer', onChange: 'onVisitDealerChanged'}) + '</div>' + '<div id="fv_lead_row"' + (st !== 'lead' ? ' style="display:none"' : '') + '><div class="fg"><label>Lead ที่ติดตาม *</label><select id="fv_lead_prospect">' + prospectOptions(window._vpPrefillProspectId || '') + '</select></div></div>' + '<div id="fv_other_row"' + (st !== 'other' ? ' style="display:none"' : '') + '><div class="fg"><label>ชื่อบริษัท *</label><input type="text" id="fv_company_txt" placeholder="พิมพ์ชื่อบริษัทที่ไปเยี่ยม..." value="' + sanitize(st === 'other' ? (v.company || '') : '') + '"></div><div class="hint">💡 ไม่ต้องสร้าง Dealer จริง — ชื่อจะโชว์ในรายงาน/Export เหมือน Dealer ปกติ</div></div>'; })() +
    '<div class="fr">' + dpH('fv_date', v.date || _td(), 'วันที่ *') + '<div class="fg"><label>เวลา</label><input type="time" id="fv_time" value="' + (v.time || '') + '"></div></div>' +
    '<div class="fr"><div class="fg"><label>Mode</label><div class="radio-g"><label><input type="radio" name="fv_mode" value="offline"' + (defaultMode === 'offline' ? ' checked' : '') + '><span>🤝 Offline</span></label><label><input type="radio" name="fv_mode" value="online"' + (defaultMode === 'online' ? ' checked' : '') + '><span>📞 Online</span></label></div></div>' +
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
    attachUploadHtml('_visitAttach', 'visits', '📷 รูปหน้าร้าน/หลักฐานการเข้าพบ') +
    '<div class="form-section">📊 Pipeline ที่อัพเดต</div>' +
    '<div id="fv_pipes">' + renderPipelineSelectEnhanced(existDealer, v.pipelineUpdates) + '</div>' +
    '<div class="form-section">📦 Forecast QTY</div>';
  // Datalist สินค้าจากแคตตาล็อกจริง — เหมือนช่องแก้ไขรายการสินค้าใน Pipeline ที่อัพเดตด้านบน ไม่ต้องพิมพ์เอง
  window._fcModelDatalistId = 'fcModelList_' + Date.now();
  html += buildAdminModelDatalist(window._fcModelDatalistId);
  html += '<div id="fv_fcs">';
  // Visit ใหม่ (ไม่มี eid) → ดึง Forecast เดือนที่ยังไม่ผ่านจาก Visit ก่อนหน้าของ dealer นี้มาให้แก้ต่อ แทนที่จะ
  // เริ่มกรอกใหม่จากศูนย์ทุกครั้ง (เช่น เดือนก่อน forecast ก.ย.+ต.ค.ไว้ พอมา Visit จริงเดือน ต.ค. ก็ควรเห็น ต.ค.
  // ที่เคยประเมินไว้ ปรับเพิ่ม/ลดได้เลย) — ดูรายละเอียดที่ visitCarryForecast() ใน utils.js
  var fcs = v.forecastNotes;
  if (!fcs) {
    var carried = (!eid && existDealer && typeof visitCarryForecast === 'function') ? visitCarryForecast(existDealer) : null;
    fcs = carried ? carried.items.map(function(f) { return Object.assign({}, f, { _carried: carried.fromDate }); }) : [{month: '', amount: '', items: []}];
  }
  for (var i = 0; i < fcs.length; i++) html += fcRow(i, fcs[i]);
  html += '</div><button type="button" class="btn bsm bo" onclick="addFcRow()">➕ เพิ่มเดือน</button>';
  html += '<div class="form-section">💡 Feedback</div><div id="fv_fbs">';
  var fbs = v.feedbackItems || [''];
  for (var i = 0; i < fbs.length; i++) html += fbRow(i, fbs[i]);
  html += '</div><button type="button" class="btn bsm bo" onclick="addFbRow()">➕ เพิ่ม</button>';
  html += '<div style="margin-top:12px"><button class="btn bp btn-full" onclick="saveVisit(\'' + existDealer + '\',\'' + (eid || '') + '\')">💾 บันทึก</button></div>';

  return html;
}

// ================================================================
// NEW PARTNER VISIT MODE — นัดคุยการเป็น Partner/Authorized Dealer (ยังไม่เป็น SAB)
// หัวข้อตามแบบสอบถามความต้องการเป็น Authorize Dealer ของ DJI — เก็บลง visits.partnerData
// ================================================================
var NP_INDUSTRY_OPTS = ['ทหาร/ตำรวจ', 'การไฟฟ้า/พลังงาน', 'กรมป่าไม้/อุทยาน', 'โซลาร์เซลล์', 'เกษตรกรรม', 'บรรเทาสาธารณภัย', 'ก่อสร้าง/สำรวจ'];
var NP_TARGET_SEG_OPTS = ['ทหาร', 'ตำรวจ', 'กรมป่าไม้', 'กรมที่ดิน', 'อุทยาน', 'บรรเทาสาธารณภัย', 'การไฟฟ้า', 'โรงกลั่นน้ำมัน', 'โซลาร์เซลล์'];
var NP_YN_OPTS = [{val: 'ยินดี', label: 'ยินดี', cls: 'sel-yes'}, {val: 'ไม่สะดวก', label: 'ไม่สะดวก', cls: 'sel-no'}];

function buildPartnerVisitFormHtml(existDealer, eid, rerenderCall, v, dealer) {
  var pd = v.partnerData || {};
  window._npAttach1 = (pd.attach1 || []).slice();
  window._npAttach2 = (pd.attach2 || []).slice();
  window._npAttach3 = (pd.attach3 || []).slice();

  var bar = _visitModeBarHtml(dealer, rerenderCall);
  // ส่วนใหญ่ New Partner คุยกับคนที่ "ยังไม่เป็น Dealer เลย" (Lead/บริษัทที่พึ่งรู้จัก) ไม่ใช่แค่ Dealer เดิมที่ยัง
  // ไม่ได้ SAB — เลยต้องมีตัวเลือกที่มาแบบเดียวกับ Quick/Standard (Dealer/Lead/อื่นๆ) ไม่ใช่บังคับต้องมี Dealer อยู่แล้ว
  var srcType = window._visitSourceType || (existDealer ? 'dealer' : 'lead');
  var prevCompanyName = dealer ? dealer.name : (v.company || '');
  var sourceBlock = '<div class="form-section">📋 ข้อมูลลูกค้า</div>' +
    '<div class="fg"><label>ที่มา</label><div class="radio-g"><label><input type="radio" name="fv_source" value="dealer"' + (srcType === 'dealer' ? ' checked' : '') + ' onchange="toggleVisitSource(\'dealer\')"><span>🏢 Dealer (ยังไม่ SAB)</span></label><label><input type="radio" name="fv_source" value="lead"' + (srcType === 'lead' ? ' checked' : '') + ' onchange="toggleVisitSource(\'lead\')"><span>🆕 Lead</span></label><label><input type="radio" name="fv_source" value="other"' + (srcType === 'other' ? ' checked' : '') + ' onchange="toggleVisitSource(\'other\')"><span>🏬 อื่นๆ</span></label></div></div>' +
    '<div id="fv_dealer_row"' + (srcType !== 'dealer' ? ' style="display:none"' : '') + '>' + _dealerPickerHtml('fv_dealer', existDealer, {label: 'Dealer', onChange: 'onVisitDealerChanged'}) + '</div>' +
    '<div id="fv_lead_row"' + (srcType !== 'lead' ? ' style="display:none"' : '') + '><div class="fg"><label>Lead ที่ติดตาม *</label><select id="fv_lead_prospect">' + prospectOptions(window._vpPrefillProspectId || '') + '</select></div></div>' +
    '<div id="fv_other_row"' + (srcType !== 'other' ? ' style="display:none"' : '') + '><div class="fg"><label>ชื่อบริษัท *</label><input type="text" id="fv_company_txt" placeholder="พิมพ์ชื่อบริษัทที่ไปคุย..." value="' + sanitize(srcType === 'other' ? prevCompanyName : '') + '"></div></div>';

  var html = bar + sourceBlock +
    '<div class="form-section">1. ข้อมูลบริษัท</div>' +
    '<div class="fr"><div class="fg"><label>ยอดขายรวมต่อปี (฿)</label><input type="text" id="np_revenue" value="' + sanitize(pd.annualRevenue || '') + '" placeholder="0"></div>' +
    '<div class="fg"><label>จำนวนพนักงาน</label><input type="text" id="np_headcount" value="' + sanitize(pd.employeeCount || '') + '" placeholder="อย่างน้อย 10 คน"><div class="hint">ต้องไม่น้อยกว่า 10 คน</div></div></div>' +
    '<div class="fg"><label>สัดส่วนพนักงานแบ่งตามแผนก</label><input type="text" id="np_deptmix" value="' + sanitize(pd.deptBreakdown || '') + '" placeholder="ฝ่ายขาย .. คน, ช่างเทคนิค .. คน, อื่นๆ .. คน"></div>' +

    '<div class="form-section">2. ข้อมูลธุรกิจ</div>' +
    '<div class="fg"><label>อุตสาหกรรม/กลุ่มลูกค้าที่โฟกัสปัจจุบัน <span class="hint" style="display:inline">(เลือกได้หลายรายการ หรือพิมพ์เพิ่มเอง)</span></label>' + _msPickerHtml('np_focus', NP_INDUSTRY_OPTS, pd.focusIndustries || []) + '</div>' +
    '<div class="fg"><label>ลูกค้าหลักคือใคร</label><input type="text" id="np_mainclient" value="' + sanitize(pd.mainCustomer || '') + '" placeholder="ระบุลูกค้าหลัก..."></div>' +
    '<div class="fg"><label>ปัจจุบันจำหน่ายแบรนด์ไหนบ้าง</label><input type="text" id="np_brands" value="' + sanitize(pd.currentBrands || '') + '" placeholder="เช่น DJI, Autel, ..."></div>' +

    '<div class="form-section">3. ประสบการณ์</div>' +
    '<div class="fg"><label>เคยจำหน่ายสินค้า DJI Enterprise มาก่อนหรือไม่?</label>' +
    _pillGroupHtml('np_exp', [{val: 'เคย', label: 'เคย', cls: 'sel-yes'}, {val: 'ไม่เคย', label: 'ไม่เคย', cls: 'sel-no'}], pd.prevDjiExp || '') +
    '<div id="fu_np_exp" data-show-when="เคย" style="margin-top:8px' + (pd.prevDjiExp === 'เคย' ? '' : ';display:none') + '"><div class="fg"><label>ซื้อกับดีลเลอร์เจ้าไหนมาก่อน?</label><input type="text" id="np_prevdealer" value="' + sanitize(pd.prevDealerName || '') + '" placeholder="ชื่อดีลเลอร์..."></div></div>' +
    '</div>' +
    '<div class="fg"><label>มีประสบการณ์ขายงานโปรเจค (รัฐ/เอกชน) หรือไม่?</label>' + _pillGroupHtml('np_proj', [{val: 'มี', label: 'มี', cls: 'sel-yes'}, {val: 'ไม่มี', label: 'ไม่มี', cls: 'sel-no'}], pd.projectExp || '') + '</div>' +
    '<div class="fg"><label>เคยขายให้กลุ่มเป้าหมายของ DJI หรือไม่? <span class="hint" style="display:inline">(เลือกได้หลายรายการ)</span></label>' + _msPickerHtml('np_targetseg', NP_TARGET_SEG_OPTS, pd.djiTargetSegments || []) + '</div>' +

    '<div class="form-section">4. ความพร้อม</div>' +
    '<div class="fg"><label>มีทีมงานดูแลงานขาย DJI Enterprise โดยเฉพาะหรือไม่?</label><div class="hint">จำเป็นต้องมี Sales และ Technical อย่างน้อยตำแหน่งละ 1 คน</div>' +
    _pillGroupHtml('np_team', [{val: 'มี', label: 'มี', cls: 'sel-yes'}, {val: 'พร้อมที่จะมี', label: 'พร้อมที่จะมี', cls: 'sel-mid'}, {val: 'ยังไม่มี', label: 'ยังไม่มี', cls: 'sel-no'}], pd.teamReady || '') +
    '<div id="fu_np_team" data-show-when="มี" style="margin-top:8px' + (pd.teamReady === 'มี' ? '' : ';display:none') + '"><div class="fr"><div class="fg"><label>พนักงานขาย (ชื่อ/เบอร์)</label><input type="text" id="np_salescontact" value="' + sanitize(pd.salesContact || '') + '" placeholder="ชื่อ - เบอร์โทร"></div><div class="fg"><label>ช่างเทคนิค (ชื่อ/เบอร์)</label><input type="text" id="np_techcontact" value="' + sanitize(pd.techContact || '') + '" placeholder="ชื่อ - เบอร์โทร"></div></div></div>' +
    '</div>' +

    '<div class="form-section">5. การยอมรับเงื่อนไข DJI</div>' +
    '<div class="fg"><label>ยินดีลงทุนซื้อสินค้าเดโม่ตามที่ DJI กำหนด</label>' + _pillGroupHtml('np_demo', NP_YN_OPTS, pd.demoInvest || '') + '</div>' +
    '<div class="fg"><label>ยินดีรับเป้ายอดขายตามที่ DJI กำหนด</label>' + _pillGroupHtml('np_target', NP_YN_OPTS, pd.acceptTarget || '') + '</div>' +
    '<div class="fg"><label>ยินดีประชาสัมพันธ์ DJI บน Website/Social ตามที่กำหนด</label>' + _pillGroupHtml('np_promo', NP_YN_OPTS, pd.acceptPromo || '') + '</div>' +

    '<div class="form-section">6. เอกสารแนบ</div>' +
    attachUploadHtml('_npAttach1', 'visits', '📎 หนังสือรับรองบริษัท') +
    attachUploadHtml('_npAttach2', 'visits', '📎 ใบทะเบียน ภ.พ.20') +
    attachUploadHtml('_npAttach3', 'visits', '📎 สัญญาซื้อ-ขายกับหน่วยงาน (ปิดข้อมูลสำคัญได้)') +

    '<div class="form-section">📝 สรุปการพูดคุยเพิ่มเติม</div>' +
    '<div class="fg"><textarea id="np_note" rows="4" placeholder="พิมพ์อะไรก็ได้ที่คุยกันแต่ไม่มีในฟอร์มด้านบน เช่น รายละเอียดเพิ่มเติมของบริษัท ความกังวลของลูกค้า ข้อตกลงพิเศษ ฯลฯ">' + sanitize(pd.note || '') + '</textarea></div>' +

    '<div style="margin-top:12px"><button class="btn bp btn-full" onclick="savePartnerVisit(\'' + existDealer + '\',\'' + (eid || '') + '\')">💾 บันทึก New Partner Report</button></div>';

  return html;
}

function savePartnerVisit(dealerId, eid) {
  var cfg = getConfig();
  var srcEl = document.querySelector('input[name="fv_source"]:checked');
  var srcType = srcEl ? srcEl.value : (window._visitSourceType || 'dealer');
  var did = '', prospectId = '', company = '';
  if (srcType === 'lead') {
    var selPr = document.getElementById('fv_lead_prospect');
    prospectId = selPr ? selPr.value : '';
    if (!prospectId) return alert('เลือก Lead ที่ติดตาม');
    var pr = ST.getOne('prospects', prospectId);
    company = pr ? (pr.companyName || '') : '';
  } else if (srcType === 'other') {
    var companyEl = document.getElementById('fv_company_txt');
    company = companyEl ? companyEl.value.trim() : '';
    if (!company) return alert('พิมพ์ชื่อบริษัท');
  } else {
    did = document.getElementById('fv_dealer') ? document.getElementById('fv_dealer').value : dealerId;
    if (!did) return alert('เลือก Dealer');
    var pickedDealer = ST.getOne('dealers', did);
    if (pickedDealer && pickedDealer.djiDealer === 'SAB') return alert('Dealer นี้เป็น SAB Authorized Dealer แล้ว — ใช้โหมด Standard/Full แทน');
  }
  var partnerData = {
    annualRevenue: (document.getElementById('np_revenue') || {}).value || '',
    employeeCount: (document.getElementById('np_headcount') || {}).value || '',
    deptBreakdown: (document.getElementById('np_deptmix') || {}).value || '',
    focusIndustries: _msGetValues('np_focus'),
    mainCustomer: (document.getElementById('np_mainclient') || {}).value || '',
    currentBrands: (document.getElementById('np_brands') || {}).value || '',
    prevDjiExp: _pillGetValue('np_exp'),
    prevDealerName: (document.getElementById('np_prevdealer') || {}).value || '',
    projectExp: _pillGetValue('np_proj'),
    djiTargetSegments: _msGetValues('np_targetseg'),
    teamReady: _pillGetValue('np_team'),
    salesContact: (document.getElementById('np_salescontact') || {}).value || '',
    techContact: (document.getElementById('np_techcontact') || {}).value || '',
    demoInvest: _pillGetValue('np_demo'),
    acceptTarget: _pillGetValue('np_target'),
    acceptPromo: _pillGetValue('np_promo'),
    attach1: window._npAttach1 || [],
    attach2: window._npAttach2 || [],
    attach3: window._npAttach3 || [],
    note: (document.getElementById('np_note') || {}).value || ''
  };
  var data = {
    date: _td(), dealerId: did, prospectId: prospectId, company: company, mode: 'offline',
    summary: 'New Partner: ' + (partnerData.note || (partnerData.mainCustomer ? 'ลูกค้าหลัก ' + partnerData.mainCustomer : '')),
    saleName: cfg.saleName, reportMode: 'partner', partnerData: partnerData,
    topicData: [], pipelineUpdates: [], forecastNotes: [], feedbackItems: [],
    attachments: [].concat(partnerData.attach1, partnerData.attach2, partnerData.attach3),
    sourceTaskId: (!eid && typeof _pendingLinkTaskId !== 'undefined' && _pendingLinkTaskId) || ''
  };
  window._visitSourceType = 'dealer'; window._vpPrefillProspectId = '';
  var visitObj = eid ? ST.update('visits', eid, data) : ST.add('visits', data);
  if (!eid && typeof resolveTaskPendingLink === 'function') resolveTaskPendingLink('visit', visitObj.id, fDShort(visitObj.date) + ' New Partner Visit');
  if (!eid) _visitClearDraft();
  closeMForce(); toast('💾 บันทึก New Partner Report แล้ว'); render();
  notifyVisitSavedAcrossTabs(did);
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
    case 'anti_drone':
      // เดิมเป็น textarea ล้วน ทั้งที่คำถามจริงคือ มี/ไม่มี — เปลี่ยนเป็น pill กดเดียวจบ
      // รายละเอียดเพิ่มเติมโผล่เฉพาะตอนเลือก "มี" (ช่อง textarea เดิม id="vt_anti_drone" ยังอยู่ใน DOM
      // เสมอแม้ถูกซ่อน — saveVisit() อ่าน td.summary จากช่องนี้ตรงๆ เหมือนหัวข้ออื่นอยู่แล้ว ไม่ต้องแก้ตรงนั้น)
      var prevAnti = td.status || '';
      return _pillGroupHtml('vt_anti_drone_pill', [{val: 'มี', label: 'มี', cls: 'sel-yes'}, {val: 'ไม่มี', label: 'ไม่มี', cls: 'sel-no'}], prevAnti) +
        '<div id="fu_vt_anti_drone_pill" data-show-when="มี" style="margin-top:8px' + (prevAnti === 'มี' ? '' : ';display:none') + '"><div class="fg"><label>รายละเอียด</label><textarea id="vt_' + id + '" rows="2">' + sanitize(td.summary || '') + '</textarea></div></div>';
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
// Dealer picker แบบพิมพ์ค้นหา + datalist ใช้ร่วมกันทุกฟอร์ม (Follow-up/LINE Log/Visit ฯลฯ) แทน select ยาวๆ
// ค่าจริงเก็บใน hidden input #idPrefix (id เดิมเป๊ะ) — โค้ดที่อ่านค่าด้วย document.getElementById(idPrefix).value
// ที่มีอยู่แล้วทำงานต่อได้เลยไม่ต้องแก้ ไม่รองรับสร้าง Dealer ใหม่จากช่องนี้ (ต่างจาก Task/Pipeline form)
// ต้องเป็น Dealer ที่มีอยู่แล้วในระบบเท่านั้น — ฟังก์ชันฝั่ง save เดิมเช็ค !did อยู่แล้วถ้าพิมพ์ชื่อไม่ตรง
function _dealerPickerHtml(idPrefix, dealerId, opts) {
  opts = opts || {};
  var d = dealerId ? ST.getOne('dealers', dealerId) : null;
  var dlOpts = ST.getAll('dealers').map(function(x) { return '<option value="' + sanitize(x.name || '') + '">'; }).join('');
  var extraOninput = opts.onChange ? (';' + opts.onChange + '()') : '';
  return '<div class="fg"><label>' + (opts.label || 'Dealer *') + '</label>' +
    '<input type="text" id="' + idPrefix + '_txt" list="' + idPrefix + '_dl" value="' + sanitize(d ? d.name : '') + '" placeholder="พิมพ์ชื่อ Dealer..." autocomplete="off" oninput="_dealerPickerResolve(\'' + idPrefix + '\')' + extraOninput + '">' +
    '<datalist id="' + idPrefix + '_dl">' + dlOpts + '</datalist>' +
    '<input type="hidden" id="' + idPrefix + '" value="' + (dealerId || '') + '"></div>';
}

function _dealerPickerResolve(idPrefix) {
  var txtEl = document.getElementById(idPrefix + '_txt');
  var hid = document.getElementById(idPrefix);
  if (!txtEl || !hid) return;
  var txt = txtEl.value.trim().toLowerCase();
  var match = txt ? ST.getAll('dealers').filter(function(d) { return (d.name || '').trim().toLowerCase() === txt; })[0] : null;
  hid.value = match ? match.id : '';
}

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
  var pipes = ST.pipelineByDealer(dealerId).filter(function(p) { return pipeIsOpen(p); });
  if (!pipes.length) return '<div style="font-size:.72rem;color:#64748b">ไม่มี Pipeline active</div>';
  var eu = existUpdates || [];
  var cfg = getConfig();
  var statusOrder = ['bidding','initial','on_process','draft_tor','win','contracting','deliver','fail_lost'];
pipes.sort(function(a, b) {
  var ia = statusOrder.indexOf(a.status); if (ia === -1) ia = 99;
  var ib = statusOrder.indexOf(b.status); if (ib === -1) ib = 99;
  if (ia !== ib) return ia - ib;
  return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0);
});
  window._psiSearchQ = ''; window._psiStatusFilter = {};
  // Datalist สินค้าจากแคตตาล็อกจริง (สินค้าทั้งหมด) ใช้ร่วมกันทุกช่องแก้ไขรายการสินค้าในตัวเลือกนี้ — สร้าง
  // ครั้งเดียวพอ ไม่ต้องต่อ pipeline (ตัวเลือกใน datalist เหมือนกันหมดไม่ว่าจะกำลังแก้โครงการไหน)
  window._visitModelDatalistId = 'visitModelList_' + Date.now();
  var html = buildAdminModelDatalist(window._visitModelDatalistId);
  if (pipes.length > 1) {
    html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">';
    if (pipes.length > 4) {
      html += '<input type="text" placeholder="🔍 ค้นหา Row No. / ชื่อโครงการ..." autocomplete="off" style="flex:1;min-width:140px;margin:0" oninput="pipePickerFilterInput(this.value)">';
    }
    html += '<select style="width:auto;font-size:11px;padding:4px" onchange="pipePickerSort(this.value)">' +
      '<option value="default">เรียง: สถานะ + ยอด</option>' +
      '<option value="rowno">เรียง: Row No.</option>' +
      '<option value="amt_desc">เรียง: ยอด Forecast (มาก→น้อย)</option>' +
      '<option value="bid_asc">เรียง: Bidding Date (ใกล้→ไกล)</option>' +
      '</select>';
    html += '</div>';
  }
  if (pipes.length > 4) {
    var statusesPresent = [];
    pipes.forEach(function(p) { if (statusesPresent.indexOf(p.status) === -1) statusesPresent.push(p.status); });
    html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px" id="psiStatusChips">' +
      statusesPresent.map(function(st) {
        return '<span class="psi-status-chip" data-status="' + sanitize(st) + '" onclick="pipePickerToggleStatusFilter(\'' + st + '\')" style="cursor:pointer;font-size:.68rem;padding:2px 8px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text2)">' + sanitize(getPipeName(st) || st) + '</span>';
      }).join('') + '</div>';
  }
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
    
    // Get last log (+ full log list ไว้โชว์ตอนขยาย "ดูรายละเอียด" — ไม่ไปหน้า pipeDetail แยกเพราะ modal
    // ของแอปนี้ซ้อนกันไม่ได้ กด go() แล้วหน้าพื้นหลังเปลี่ยนแต่ modal Visit ยังทับอยู่ ต้องปิด modal ก่อนถึงจะเห็น)
    var pipeLogs = ST.pipeLogsByPipe(p.id);
    var lastLog = pipeLogs[0];
    var lastLogText = '';
    if (lastLog) {
      var logDate = lastLog.date ? lastLog.date.split('T')[0] : '';
      lastLogText = (logDate ? fDShort(logDate) + ' ' : '') + (lastLog.content || '').substr(0, 40);
    }

    // Get pending actions
    var pendingActions = getPipeActions().filter(function(a) { return a.pipeId === p.id && a.status === 'pending'; });

    var pSearchKey = ((p.rowNo || '') + ' ' + (p.projectName || '')).toLowerCase();
    html += '<div class="pipe-select-item' + (isSel ? ' selected' : '') + '" id="psi_' + p.id + '" data-search="' + sanitize(pSearchKey) + '" data-status="' + sanitize(p.status || '') + '"' +
      ' data-rowno="' + sanitize((p.rowNo || '').toLowerCase()) + '" data-amt="' + amt + '" data-bid="' + (p.biddingDate || '') + '" data-order="' + i + '">';

    // Header (clickable)
    html += '<div class="pipe-select-header" onclick="togglePipePickerSelect(\'' + p.id + '\')">';
    html += '<input type="checkbox" class="pipe_chk" value="' + p.id + '"' + (isSel ? ' checked' : '') + ' onclick="event.stopPropagation();togglePipePickerSelect(\'' + p.id + '\')" style="display:inline;width:auto;margin:0">';
    html += '<span class="pipe-name">' + sanitize((p.rowNo ? p.rowNo + ' · ' : '') + (p.projectName || '').substr(0, 35)) + '</span>';
    html += pipeTag(p.status);
    html += '<span class="pipe-amount">' + fmtMoneyStyled(amt) + '</span>';
    html += '</div>';

    // Project Info (always visible)
    html += '<div class="pipe-select-info">';
    html += '<div class="psi-row">📦 ' + sanitize(modelText || '-') + ' <span style="color:var(--text2)">(' + totalQty + ' ชิ้น)</span></div>';
    if (p.biddingDate) html += '<div class="psi-row">📅 Bidding: ' + fDShort(p.biddingDate) + ' ' + dlB(p.biddingDate, false) + '</div>';
    if (p.shipmentDate) html += '<div class="psi-row">🚚 Shipment: ' + fDShort(p.shipmentDate) + '</div>';
    var _psiNa = pipeNextActionHtml(p, true);
    if (_psiNa) html += '<div class="psi-row">🎯 Next: ' + _psiNa + '</div>';
    if (lastLogText) html += '<div class="psi-row">📝 ล่าสุด: ' + sanitize(lastLogText) + '</div>';
    if (pendingActions.length) {
      html += '<div class="psi-row" style="color:#f59e0b">⏳ Action ค้าง: ' + pendingActions.length + ' รายการ</div>';
    }
    html += '<div class="psi-link" onclick="event.stopPropagation();_psiToggleFullDetail(\'' + p.id + '\')" id="psi_fulltoggle_' + p.id + '">▾ ดูรายละเอียด/Timeline เต็ม</div>';
    html += '<div id="psi_full_' + p.id + '" style="display:none;margin-top:4px;padding-top:4px;border-top:1px dashed var(--border)">';
    if (items.length) {
      html += '<div class="psi-row" style="font-weight:600">📦 รายการสินค้า</div>';
      items.forEach(function(it) { html += '<div class="psi-row">• ' + sanitize(it.model || '-') + (it.qty > 1 ? ' x' + it.qty : '') + '</div>'; });
    }
    html += '<div class="psi-row" style="font-weight:600;margin-top:4px">🕐 Timeline (' + pipeLogs.length + ' รายการ)</div>';
    if (pipeLogs.length) {
      html += pipeLogs.slice(0, 20).map(function(lg) {
        var ld = lg.date ? lg.date.split('T')[0] : '';
        return '<div class="psi-row">' + (ld ? fDShort(ld) + ' — ' : '') + sanitize(lg.content || '') + '</div>';
      }).join('');
      if (pipeLogs.length > 20) html += '<div class="psi-row" style="color:var(--text2)">…และอีก ' + (pipeLogs.length - 20) + ' รายการ</div>';
    } else {
      html += '<div class="psi-row" style="color:var(--text2)">— ยังไม่มี Log —</div>';
    }
    html += '</div>';
    html += '</div>';

    // Update Detail (show when selected)
    html += '<div class="pipe-select-detail" id="psd_' + p.id + '"' + (isSel ? ' style="display:block"' : '') + '>';
    html += '<div class="psi-update-header">✏️ Update โครงการนี้</div>';
    html += '<div class="fr">';
    html += '<div class="fg"><label style="font-size:.6rem">สถานะใหม่</label><select id="pu_st_' + p.id + '">' + optionsHTML(cfg.pipelineStatuses, existing ? existing.newStatus : p.status) + '</select></div>';
    html += '<div class="fg"><label style="font-size:.6rem">หมายเหตุ / Update</label><input type="text" id="pu_note_' + p.id + '" value="' + sanitize(existing ? existing.note : '') + '" placeholder="เช่น ลูกค้าอนุมัติ Spec แล้ว..."></div>';
    html += '</div>';
    html += '<div style="font-size:.58rem;color:var(--text2);margin-top:2px">💡 ข้อมูลจะ sync ไปที่ Pipeline Log อัตโนมัติเมื่อ Save Visit</div>';

    // แก้ไขรายการสินค้า/จำนวน — พับเก็บโดย default กันฟอร์มรก เปิดเฉพาะตอนมีการเปลี่ยนจำนวน/รายการจริงระหว่าง visit
    html += '<div class="items-toggle" id="pu_toggle_' + p.id + '" onclick="puToggleItems(\'' + p.id + '\')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:6px 0 2px;border-top:1px dashed var(--border);margin-top:6px">';
    html += '<span style="font-size:.68rem;font-weight:700" id="pu_toggle_label_' + p.id + '">📦 แก้ไขรายการสินค้า (' + items.length + ' รายการ)</span>';
    html += '<span style="font-size:.62rem;color:var(--text2)" id="pu_toggle_chev_' + p.id + '">▸</span>';
    html += '</div>';
    html += '<div id="pu_itemswrap_' + p.id + '" style="display:none;margin-top:4px">';
    html += '<div id="pu_itemslist_' + p.id + '">' + items.map(function(it) { return puItemRowHtml(it.model, it.qty); }).join('') + '</div>';
    html += '<div style="display:flex;gap:4px;margin-top:4px">';
    html += '<input type="text" id="pu_newmodel_' + p.id + '" list="' + window._visitModelDatalistId + '" placeholder="พิมพ์ชื่อสินค้า..." style="flex:1;font-size:.78rem" autocomplete="off">';
    html += '<input type="number" id="pu_newqty_' + p.id + '" min="1" value="1" style="width:56px;font-size:.78rem">';
    html += '<button type="button" class="btn bsm bp" onclick="puAddItem(\'' + p.id + '\')">➕</button>';
    html += '</div>';
    html += '<div style="font-size:.58rem;color:var(--text2);margin-top:2px">แก้ตรงนี้แล้วบันทึก Visit จะอัพเดตรายการสินค้าของโครงการให้ตรง พร้อมบันทึกการเปลี่ยนแปลงลง Pipeline Log</div>';
    html += '</div>';

    // ข้อมูลประกอบ POS + POS แนะนำ — ดึง/แก้ฟิลด์ pipeline ที่มีอยู่แล้วตรงนี้เลย ไม่ต้องเปิดฟอร์มแก้ Pipeline แยก
    // window._visitCurrentEid ตั้งไว้แล้วตอนต้น buildVisitFormHtml — ใช้ต่อ reopenCall ให้ปุ่ม ⚙️ น้ำหนัก POS
    // พากลับมาฟอร์ม Visit เดิม (ทั้งกรณีสร้างใหม่และแก้ของเก่า)
    var _posReopenCall = "showVisitM('" + dealerId + "','" + (window._visitCurrentEid || '') + "')";
    html += posChecklistHtml(p, 'pu_', p.id, lastLog, _posReopenCall);

    html += '</div>';

    html += '</div>';
  }
  return html;
}

// field id ของแต่ละปัจจัยที่ใช้คำนวณ POS — สองบริบทใช้ id คนละชุด: Visit picker (idPrefix='pu_') เรนเดอร์ช่อง
// ของตัวเองใหม่ทั้งหมด (ต่อโครงการ), ฟอร์มแก้ไข Pipeline (idPrefix='fp_') มีช่อง หนังสือแต่งตั้ง/TOR/CRM/คู่แข่ง/
// สถานะ อยู่แล้วในฟอร์ม เลยชี้ไปที่ id เดิมตรงๆ แทนที่จะเรนเดอร์ซ้ำ (fpc_* คือ 3 ช่องใหม่ที่ยังไม่เคยมีในฟอร์มนี้)
function posChkFieldIds(idPrefix, id) {
  if (idPrefix === 'pu_') {
    return { status: 'pu_st_' + id, appt: 'pu_appt_' + id, tor: 'pu_tor_' + id, crm: 'pu_crm_' + id, comp: 'pu_comp_' + id, poc: 'pu_poc_' + id, present: 'pu_present_' + id, draftTor: 'pu_drafttor_' + id };
  }
  return { status: 'fp_status', appt: 'fp_appt', tor: 'fp_tor', crm: 'fp_crm', comp: 'fp_comp', poc: 'fpc_poc', present: 'fpc_present', draftTor: 'fpc_drafttor' };
}
// Checklist ข้อมูลประกอบ POS — คืนทั้งกล่อง POS แนะนำ (เหตุผล + ปุ่ม copy + checkbox "ใช้ค่านี้") และ
// (เฉพาะ Visit picker) ช่องหนังสือแต่งตั้ง/TOR/CRM/คู่แข่ง ที่ยังไม่มีในฟอร์มนั้น — ฟอร์มแก้ไข Pipeline มีช่อง
// พวกนี้อยู่แล้วที่อื่นในฟอร์ม เลยข้าม (skipFields=true) เหลือแค่ 3 ช่อง "หลักฐานการทำงาน" ที่เพิ่มใหม่จริงๆ
// reopenCall: expression JS ที่เรียกฟอร์มเดิมกลับมาใหม่หลังแก้น้ำหนักเสร็จ (เช่น "showVisitM('id','')")
function posChecklistHtml(p, idPrefix, id, lastLog, reopenCall, skipFields) {
  var cfg = getConfig();
  var fid = posChkFieldIds(idPrefix, id);
  var res = computeSuggestedPOS(p, cfg, lastLog ? lastLog.date : null);
  var curPos = p.projectPOS || 0;
  var h = '';
  h += '<div class="items-toggle" id="' + idPrefix + 'poschk_toggle_' + id + '" onclick="posChkToggle(\'' + idPrefix + '\',\'' + id + '\')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:6px 0 2px;border-top:1px dashed var(--border);margin-top:6px">';
  h += '<span style="font-size:.68rem;font-weight:700">🎯 ข้อมูลประกอบ POS</span>';
  h += '<span style="font-size:.62rem;color:var(--text2)" id="' + idPrefix + 'poschk_chev_' + id + '">▸</span>';
  h += '</div>';
  h += '<div id="' + idPrefix + 'poschk_wrap_' + id + '" data-followup="' + (p.followupDate || '') + '" data-lastlog="' + (lastLog ? lastLog.date : '') + '" style="display:none;margin-top:4px">';

  if (!skipFields) {
    h += '<div class="fr" style="align-items:center"><span style="flex:1;font-size:.72rem">📄 หนังสือแต่งตั้ง</span><select id="' + fid.appt + '" onchange="posChkRecalc(\'' + idPrefix + '\',\'' + id + '\')" style="width:auto">' + optionsHTML(cfg.appointmentOptions, p.appointmentLetter, '--') + '</select></div>';
    h += '<div class="fr" style="align-items:center"><span style="flex:1;font-size:.72rem">📋 TOR</span><select id="' + fid.tor + '" onchange="posChkRecalc(\'' + idPrefix + '\',\'' + id + '\')" style="width:auto">' + optionsHTML(cfg.torOptions, p.tor || 'Open') + '</select></div>';
    h += '<label style="display:flex;align-items:center;gap:6px;font-size:.72rem;padding:3px 0;cursor:pointer"><input type="checkbox" id="' + fid.crm + '"' + (p.djiCrmRegistered ? ' checked' : '') + ' onchange="posChkRecalc(\'' + idPrefix + '\',\'' + id + '\')"> ลงทะเบียน CRM ของ DJI แล้ว</label>';
    h += '<label style="display:flex;align-items:center;gap:6px;font-size:.72rem;padding:3px 0;cursor:pointer"><input type="checkbox" id="' + fid.comp + '"' + (p.hasCompetitor ? ' checked' : '') + ' onchange="posChkRecalc(\'' + idPrefix + '\',\'' + id + '\')"> มีคู่แข่ง</label>';
  }
  h += '<div style="font-size:.6rem;color:var(--text3);margin:4px 0 2px">🛠 หลักฐานการทำงาน (เช็คได้หลายข้อ)</div>';
  h += '<label style="display:flex;align-items:center;gap:6px;font-size:.72rem;padding:3px 0;cursor:pointer"><input type="checkbox" id="' + fid.poc + '"' + (p.pocDone ? ' checked' : '') + ' onchange="posChkRecalc(\'' + idPrefix + '\',\'' + id + '\')"> ไป POC (สาธิต/ทดสอบให้หน่วยงานดู)</label>';
  h += '<label style="display:flex;align-items:center;gap:6px;font-size:.72rem;padding:3px 0;cursor:pointer"><input type="checkbox" id="' + fid.present + '"' + (p.presentedDone ? ' checked' : '') + ' onchange="posChkRecalc(\'' + idPrefix + '\',\'' + id + '\')"> พรีเซนต์งานให้หน่วยงานแล้ว</label>';
  h += '<label style="display:flex;align-items:center;gap:6px;font-size:.72rem;padding:3px 0;cursor:pointer"><input type="checkbox" id="' + fid.draftTor + '"' + (p.torDraftDone ? ' checked' : '') + ' onchange="posChkRecalc(\'' + idPrefix + '\',\'' + id + '\')"> ร่าง TOR ให้หน่วยงานแล้ว</label>';

  h += '<div style="margin-top:8px;border:1px dashed var(--accent);border-radius:8px;padding:8px 10px;background:var(--accent-light,rgba(59,130,246,.08))">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">';
  h += '<div style="font-size:.72rem">💡 POS แนะนำ: <b id="' + idPrefix + 'posnum_' + id + '" style="font-size:.85rem;color:var(--accent)">' + res.score + '%</b> ' +
    '<button type="button" onclick="posChkToggleReason(\'' + idPrefix + '\',\'' + id + '\')" style="background:none;border:none;color:var(--accent);font-size:.68rem;text-decoration:underline dotted;cursor:pointer;padding:0" id="' + idPrefix + 'reasonlink_' + id + '">ดูเหตุผล ▾</button> ' +
    (reopenCall ? '<button type="button" class="btn-xs" title="แก้น้ำหนักคำนวณ POS" onclick="showPosWeightsEditorM(function(){' + reopenCall.replace(/"/g, '&quot;') + '})">⚙️</button>' : '') +
    '</div>';
  h += '<label style="display:flex;align-items:center;gap:5px;font-size:.68rem;font-weight:600;white-space:nowrap;cursor:pointer"><input type="checkbox" id="' + idPrefix + 'posapply_' + id + '"> ใช้ค่านี้แทน ' + curPos + '%</label>';
  h += '</div>';
  h += '<div id="' + idPrefix + 'reasonbody_' + id + '" style="display:none;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">';
  h += '<div id="' + idPrefix + 'reasonrows_' + id + '">' + posReasonRowsHtml(res.reasons) + '</div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:.7rem;font-weight:700;margin-top:4px;padding-top:4px;border-top:1px solid var(--border)"><span>รวม</span><span id="' + idPrefix + 'reasontotal_' + id + '">' + res.score + '%</span></div>';
  h += '<button type="button" class="btn bsm bo" style="width:100%;margin-top:6px" onclick="posChkCopyReason(\'' + idPrefix + '\',\'' + id + '\',this)">📋 คัดลอกเหตุผล</button>';
  h += '</div>';
  h += '</div>';

  h += '</div>';
  return h;
}
function posReasonRowsHtml(reasons) {
  return reasons.map(function(r) {
    var deltaHtml = r.delta === null ? '<b style="color:var(--text2)">' + r.text + '</b>' :
      '<b style="color:' + (r.delta >= 0 ? '#22c55e' : '#ef4444') + '">' + (r.delta >= 0 ? '+' : '') + r.delta + '%</b>';
    return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:.68rem;padding:2px 0;color:var(--text2)"><span>' + r.label + '</span>' + deltaHtml + '</div>';
  }).join('');
}
function posChkToggle(idPrefix, id) {
  var wrap = document.getElementById(idPrefix + 'poschk_wrap_' + id);
  var chev = document.getElementById(idPrefix + 'poschk_chev_' + id);
  if (!wrap) return;
  var open = wrap.style.display !== 'none';
  wrap.style.display = open ? 'none' : 'block';
  if (chev) chev.textContent = open ? '▸' : '▾';
}
function posChkToggleReason(idPrefix, id) {
  var body = document.getElementById(idPrefix + 'reasonbody_' + id);
  var link = document.getElementById(idPrefix + 'reasonlink_' + id);
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (link) link.textContent = open ? 'ซ่อนเหตุผล ▴' : 'ดูเหตุผล ▾';
}
// อ่านค่าปัจจุบันจาก checklist ในฟอร์ม (ไม่ใช่ค่าที่ save ไว้เดิม) มาคำนวณ POS แนะนำใหม่แบบ live — ใช้
// computeSuggestedPOS ตัวเดียวกับตอน render ครั้งแรก ส่ง object ชั่วคราวเข้าไปแทน ไม่มี logic ซ้ำสองที่
// อ่านค่าปัจจุบันจาก checklist ในฟอร์ม (DOM ตรงๆ ไม่ใช่ค่าที่ save ไว้เดิม) มาคำนวณ — ใช้ทั้งตอน live-recalc
// (posChkRecalc) และตอน save จริง (savePipeline/saveVisit อ่านค่า "ใช้ค่านี้" ตรงจุดที่จะเซ็ต POS) กันคำนวณ
// ค้างจากครั้งก่อนถ้า user ติ๊ก "ใช้ค่านี้" โดยไม่เคยแตะ checklist เลยสักครั้ง (ไม่เคยเกิด live-recalc มาก่อน)
function posChkCompute(idPrefix, id) {
  var wrap = document.getElementById(idPrefix + 'poschk_wrap_' + id);
  if (!wrap) return null;
  var fid = posChkFieldIds(idPrefix, id);
  var statusEl = document.getElementById(fid.status);
  var tempP = {
    status: statusEl ? statusEl.value : '',
    appointmentLetter: document.getElementById(fid.appt).value,
    tor: document.getElementById(fid.tor).value,
    djiCrmRegistered: document.getElementById(fid.crm).checked,
    hasCompetitor: document.getElementById(fid.comp).checked,
    pocDone: document.getElementById(fid.poc).checked,
    presentedDone: document.getElementById(fid.present).checked,
    torDraftDone: document.getElementById(fid.draftTor).checked,
    followupDate: wrap.dataset.followup || ''
  };
  return computeSuggestedPOS(tempP, getConfig(), wrap.dataset.lastlog || null);
}
function posChkRecalc(idPrefix, id) {
  var res = posChkCompute(idPrefix, id);
  if (!res) return;
  document.getElementById(idPrefix + 'posnum_' + id).textContent = res.score + '%';
  document.getElementById(idPrefix + 'reasontotal_' + id).textContent = res.score + '%';
  document.getElementById(idPrefix + 'reasonrows_' + id).innerHTML = posReasonRowsHtml(res.reasons);
  window['_posLastReason_' + idPrefix + id] = res;
}
function posChkCopyReason(idPrefix, id, btn) {
  var res = window['_posLastReason_' + idPrefix + id] || posChkCompute(idPrefix, id);
  var text = res ? posReasonsText(res) : document.getElementById(idPrefix + 'reasonrows_' + id).innerText;
  var doCopy = function() {
    var orig = btn.textContent;
    btn.textContent = '✅ คัดลอกแล้ว';
    setTimeout(function() { btn.textContent = orig; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(doCopy).catch(function() { toast('❌ คัดลอกไม่ได้'); });
  else toast('❌ เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ');
}

// รายการสินค้าในการ์ด "✏️ Update โครงการนี้" — เก็บ state ที่ DOM ตรงๆ (แถวละ .pu-item-row) เหมือน pattern
// fc-item-row ของ Forecast QTY ด้านล่าง กัน rebuild ทั้งฟอร์มแล้วข้อมูลอื่นที่พิมพ์ไว้หาย
function puItemRowHtml(model, qty) {
  return '<div class="item-row pu-item-row" style="display:flex;align-items:center;gap:5px;padding:4px 0;border-bottom:1px solid rgba(127,127,127,.15)">' +
    '<input type="text" class="pu-it-model" list="' + (window._visitModelDatalistId || '') + '" value="' + sanitize(model || '') + '" placeholder="ชื่อสินค้า" style="flex:1;font-size:.78rem" autocomplete="off">' +
    '<input type="number" class="pu-it-qty" min="1" value="' + (Number(qty) || 1) + '" style="width:56px;font-size:.78rem">' +
    '<button type="button" class="btn bsm bd" onclick="this.closest(\'.pu-item-row\').remove()" title="ลบ">✕</button>' +
    '</div>';
}
function puToggleItems(pipeId) {
  var wrap = document.getElementById('pu_itemswrap_' + pipeId);
  var chev = document.getElementById('pu_toggle_chev_' + pipeId);
  if (!wrap) return;
  var open = wrap.style.display !== 'none';
  wrap.style.display = open ? 'none' : 'block';
  if (chev) chev.textContent = open ? '▸' : '▾';
}
function puAddItem(pipeId) {
  var modelEl = document.getElementById('pu_newmodel_' + pipeId);
  var qtyEl = document.getElementById('pu_newqty_' + pipeId);
  var model = (modelEl.value || '').trim();
  if (!model) { modelEl.focus(); return; }
  var wrap = document.getElementById('pu_itemslist_' + pipeId);
  if (wrap) wrap.insertAdjacentHTML('beforeend', puItemRowHtml(model, qtyEl.value));
  modelEl.value = ''; qtyEl.value = '1'; modelEl.focus();
  var label = document.getElementById('pu_toggle_label_' + pipeId);
  if (label) label.textContent = '📦 แก้ไขรายการสินค้า (' + wrap.children.length + ' รายการ)';
}
function puCollectItems(pipeId) {
  var wrap = document.getElementById('pu_itemslist_' + pipeId);
  if (!wrap) return null; // picker ไม่ได้ render (dealer ยังไม่ถูกเลือก ฯลฯ) — แยกจาก "เปิดแล้วแต่ไม่มีรายการ" ([])
  return Array.prototype.map.call(wrap.querySelectorAll('.pu-item-row'), function(row) {
    return { model: row.querySelector('.pu-it-model').value.trim(), qty: Number(row.querySelector('.pu-it-qty').value) || 1 };
  }).filter(function(it) { return it.model; });
}

// ⚠️ เคยชื่อ togglePipeSelect ซ้ำกับฟังก์ชันเลือกหลายรายการในตาราง Pipeline (views-pipeline.js) คนละ
// feature กันเลย — โหลดทีหลังเลยบัง ทำให้ modal เลือกโครงการนี้กดแล้วไม่ทำงาน เปลี่ยนชื่อกันชนกัน
// (พบ 2026-07-19 ตอนไล่ตรวจฟังก์ชันชื่อซ้ำ)
// ค้นหา + filter สถานะ ทำงานร่วมกัน (AND) — เก็บ state ไว้ที่ window._psiSearchQ/_psiStatusFilter
// (ตั้งค่าเริ่มต้นตอน renderPipelineSelectEnhanced) กันโครงการเยอะแล้วหายาก ดูยาก
function pipePickerFilterInput(v) {
  window._psiSearchQ = (v || '').trim().toLowerCase();
  _psiApplyFilters();
}
function pipePickerToggleStatusFilter(status) {
  window._psiStatusFilter = window._psiStatusFilter || {};
  if (window._psiStatusFilter[status]) delete window._psiStatusFilter[status];
  else window._psiStatusFilter[status] = true;
  var chip = document.querySelector('#psiStatusChips .psi-status-chip[data-status="' + status + '"]');
  if (chip) {
    var on = !!window._psiStatusFilter[status];
    chip.style.background = on ? 'var(--accent)' : 'var(--bg2)';
    chip.style.color = on ? '#fff' : 'var(--text2)';
  }
  _psiApplyFilters();
}
function _psiApplyFilters() {
  var q = window._psiSearchQ || '';
  var stFilter = window._psiStatusFilter || {};
  var hasStFilter = Object.keys(stFilter).length > 0;
  document.querySelectorAll('.pipe-select-item').forEach(function(el) {
    var hitSearch = !q || (el.getAttribute('data-search') || '').indexOf(q) !== -1;
    var hitStatus = !hasStFilter || stFilter[el.getAttribute('data-status')];
    el.style.display = (hitSearch && hitStatus) ? '' : 'none';
  });
}
// เรียงลำดับการ์ดโครงการในตัวเลือก — จัดเรียง DOM node ที่มีอยู่แล้วตรงๆ (ไม่ rebuild HTML ใหม่) กัน
// ค่าที่พิมพ์ไว้ในช่อง "✏️ Update โครงการนี้" ของโครงการที่ติ๊กเลือกอยู่หายระหว่างเปลี่ยนการเรียง
function pipePickerSort(mode) {
  var container = document.getElementById('fv_pipes');
  if (!container) return;
  var items = Array.prototype.slice.call(container.querySelectorAll('.pipe-select-item'));
  items.sort(function(a, b) {
    if (mode === 'rowno') return (a.getAttribute('data-rowno') || '').localeCompare(b.getAttribute('data-rowno') || '');
    if (mode === 'amt_desc') return (Number(b.getAttribute('data-amt')) || 0) - (Number(a.getAttribute('data-amt')) || 0);
    if (mode === 'bid_asc') {
      var da = a.getAttribute('data-bid') || '', db = b.getAttribute('data-bid') || '';
      if (!da && !db) return 0;
      if (!da) return 1; if (!db) return -1;
      return da.localeCompare(db);
    }
    return Number(a.getAttribute('data-order')) - Number(b.getAttribute('data-order')); // default = ลำดับเดิม (สถานะ + ยอด)
  });
  items.forEach(function(el) { container.appendChild(el); });
}

function _psiToggleFullDetail(pipeId) {
  var box = document.getElementById('psi_full_' + pipeId);
  var btn = document.getElementById('psi_fulltoggle_' + pipeId);
  if (!box) return;
  var open = box.style.display !== 'none';
  box.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = open ? '▾ ดูรายละเอียด/Timeline เต็ม' : '▴ ซ่อนรายละเอียด';
}

function togglePipePickerSelect(pipeId) {
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

// ================================================================
// VISIT REPORT — DRAFT AUTOSAVE (กันข้อมูลหายถ้าเผลอปิด/ลืมกดบันทึก)
// เก็บ 1 ร่างล่าสุดลง localStorage ทุกครั้งที่พิมพ์/เปลี่ยนค่าในฟอร์ม (debounce 1.5s ทับของเก่าเสมอ) —
// เฉพาะตอนสร้าง Visit ใหม่เท่านั้น (ไม่มี eid) ไม่ยุ่งกับตอนแก้ไข Visit ที่มีอยู่แล้ว กันความเสี่ยงกู้ร่างผิดตัว
// ลบทิ้งทันทีที่กดบันทึกสำเร็จจริง — เป็นแค่กันชนกรณีไม่ได้ตั้งใจปิด ไม่ใช่ที่เก็บถาวร
// ================================================================
var VISIT_DRAFT_KEY = 'v7_visitDraft';

function _visitDraftSnapshot() {
  if (!document.getElementById('fv_summary')) return null; // ฟอร์มไม่ได้เปิดอยู่จริง
  var cfg = getConfig();
  var srcEl = document.querySelector('input[name="fv_source"]:checked');
  var srcType = srcEl ? srcEl.value : (window._visitSourceType || 'dealer');
  var did = '', prospectId = '', company = '';
  if (srcType === 'lead') {
    prospectId = (document.getElementById('fv_lead_prospect') || {}).value || '';
  } else if (srcType === 'other') {
    company = (document.getElementById('fv_company_txt') || {}).value || '';
  } else {
    did = (document.getElementById('fv_dealer') || {}).value || '';
  }

  var topicData = [];
  (cfg.visitTopics || []).forEach(function(topic) {
    var chk = document.getElementById('tc_chk_' + topic.id);
    if (!chk) return;
    var td = { topicId: topic.id, answered: chk.checked };
    if (chk.checked) {
      var sumEl = document.getElementById('vt_' + topic.id);
      if (sumEl) td.summary = sumEl.value.trim();
      if (topic.id === 'dsec' || topic.id === 'fh2') { td.status = (document.getElementById('vt_' + topic.id + '_st') || {}).value || ''; td.certCount = (document.getElementById('vt_' + topic.id + '_n') || {}).value || ''; }
      if (topic.id === 'crm' || topic.id === 'lark') td.status = (document.getElementById('vt_' + topic.id + '_st') || {}).value || '';
      if (topic.id === 'anti_drone') td.status = _pillGetValue('vt_anti_drone_pill');
    }
    topicData.push(td);
  });

  var forecastNotes = [];
  var fcCnt = document.getElementById('fv_fcs') ? document.getElementById('fv_fcs').children.length : 0;
  for (var i = 0; i < fcCnt; i++) {
    var m = (document.getElementById('fc_m_' + i) || {}).value || '';
    var a = (document.getElementById('fc_a_' + i) || {}).value || '';
    var fcItems = (typeof fcCollectItems === 'function') ? fcCollectItems(i) : [];
    if (m.trim() || a || fcItems.length) forecastNotes.push({ month: m.trim(), amount: parseNum(a), items: fcItems });
  }

  var feedbackItems = [];
  var fbCnt = document.getElementById('fv_fbs') ? document.getElementById('fv_fbs').children.length : 0;
  for (var i = 0; i < fbCnt; i++) { var f = (document.getElementById('fb_' + i) || {}).value || ''; if (f.trim()) feedbackItems.push(f.trim()); }

  var modeEl = document.querySelector('input[name="fv_mode"]:checked');
  var data = {
    date: dpG('fv_date'), time: (document.getElementById('fv_time') || {}).value || '',
    dealerId: did, prospectId: prospectId, company: company, mode: modeEl ? modeEl.value : 'offline',
    djiDealer: (document.getElementById('fv_djid') || {}).value || '',
    location: (document.getElementById('fv_loc') || {}).value || '',
    summary: (document.getElementById('fv_summary') || {}).value || '',
    revenue: (document.getElementById('vt_revenue') || {}).value || '',
    expectedRevenue: (document.getElementById('vt_expected') || {}).value || '',
    customerSegment: (document.getElementById('vt_segment') || {}).value || '',
    dockInterest: (document.getElementById('vt_dock') || {}).value || '',
    topicData: topicData, forecastNotes: forecastNotes, feedbackItems: feedbackItems,
    reportMode: visitMode
  };

  // ว่างทั้งหมดจริงๆ (ยังไม่ได้พิมพ์อะไรเลย) ไม่ต้องเก็บร่าง กันเด้งถามตอนเปิดฟอร์มเปล่าๆ
  var hasContent = data.summary.trim() || data.location || topicData.some(function(t) { return t.answered; }) || forecastNotes.length || feedbackItems.length || company || did || prospectId;
  if (!hasContent) return null;

  return {
    savedAt: Date.now(),
    sourceType: srcType,
    dealerName: did ? ((ST.getOne('dealers', did) || {}).name || '') : (company || ''),
    data: data
  };
}

var _visitDraftSaveTimer = null;
function _visitScheduleDraftSave() {
  if (window._visitCurrentEid) return; // แก้ไข Visit เดิมอยู่ — ไม่เก็บร่าง กันกู้ผิดตัวทีหลัง
  clearTimeout(_visitDraftSaveTimer);
  _visitDraftSaveTimer = setTimeout(function() {
    var snap = _visitDraftSnapshot();
    if (snap) localStorage.setItem(VISIT_DRAFT_KEY, JSON.stringify(snap));
  }, 1500);
}

// ผูก listener ครั้งเดียวตลอด session (delegation) — เช็คจาก id ของ element ที่ถูกแก้ ว่าอยู่ในฟอร์ม Visit
// Report ไหม (ครอบคลุมทั้ง modal ปกติและแท็บแยก rVisitWindow เพราะเช็คจาก id ไม่ใช่ container)
(function() {
  function isVisitFormField(el) {
    return !!(el && el.id && /^(fv_|vt_|tc_|fc_|fb_)/.test(el.id));
  }
  document.addEventListener('input', function(e) { if (isVisitFormField(e.target)) _visitScheduleDraftSave(); });
  document.addEventListener('change', function(e) { if (isVisitFormField(e.target)) _visitScheduleDraftSave(); });
})();

function _visitClearDraft() { localStorage.removeItem(VISIT_DRAFT_KEY); }

// เรียกตอนเปิดฟอร์ม Visit Report ใหม่ (ยังไม่มี eid) — ถ้าเจอร่างเก่าที่ยังไม่ได้บันทึก ถามก่อนเสมอว่าจะ
// กู้คืนไหม (ไม่ auto-restore เงียบๆ) ถามแค่ครั้งเดียวต่อการเปิดฟอร์ม 1 ครั้ง ไม่ถามซ้ำตอนสลับโหมด Quick/
// Standard/Full ในฟอร์มเดียวกัน (ดู _visitDraftOfferShown + key เช็คใน showVisitM/rVisitWindow)
// ทิ้งร่างที่เก่าเกิน 48 ชม. ไปเลยกันมาถามซ้ำไม่จบ
function _visitOfferDraftRestore() {
  var raw = localStorage.getItem(VISIT_DRAFT_KEY);
  if (!raw) return false;
  var draft;
  try { draft = JSON.parse(raw); } catch (e) { localStorage.removeItem(VISIT_DRAFT_KEY); return false; }
  if (!draft || !draft.data || (Date.now() - draft.savedAt) > 48 * 3600000) { localStorage.removeItem(VISIT_DRAFT_KEY); return false; }

  var mins = Math.round((Date.now() - draft.savedAt) / 60000);
  var whenText = mins < 1 ? 'เมื่อสักครู่' : (mins < 60 ? mins + ' นาทีที่แล้ว' : Math.round(mins / 60) + ' ชม.ที่แล้ว');
  var who = draft.dealerName ? ' (' + draft.dealerName + ')' : '';
  if (!confirm('📝 พบร่าง Visit Report ที่ยังไม่ได้บันทึก' + who + ' — บันทึกไว้ ' + whenText + '\nต้องการกู้คืนร่างนี้ไหม?')) {
    localStorage.removeItem(VISIT_DRAFT_KEY);
    return false;
  }
  window._visitDraftOverride = draft.data;
  window._visitSourceType = draft.sourceType || 'dealer';
  if (draft.sourceType === 'lead') window._vpPrefillProspectId = draft.data.prospectId || '';
  visitMode = draft.data.reportMode || 'quick';
  return true;
}

// Forecast & Feedback rows
// รายการสินค้าต่อเดือน (model+qty แบบมีโครงสร้าง เหมือน Forecast ในหน้า client-view — เดิมเป็น textarea
// อิสระ เทียบ/รวมยอดข้ามเดือนไม่ได้จริง) — เก็บ state ไว้ที่ DOM ตรงๆ (แถวละ .fc-item-row) ไม่ใช้ array แยก
// ต่างหาก ตาม pattern เดิมของฟอร์มนี้ (fcRow/fbRow ก็อ่านค่าจาก DOM ตอน save เหมือนกัน)
function fcMonthOptionsHtml(selected) {
  var h = '<option value="">-- เลือกเดือน --</option>';
  for (var off = -1; off <= 8; off++) {
    var key = fcMonthKey(off);
    h += '<option value="' + key + '"' + (key === selected ? ' selected' : '') + '>' + fcMonthLabel(key) + '</option>';
  }
  // เผื่อ carry-over หรือ Visit เก่ามาจากเดือนที่ไม่อยู่ในช่วง -1..+8 เดือนนี้ (ไม่ควรเกิดปกติ แต่กันข้อมูลหาย)
  if (selected && h.indexOf('value="' + selected + '"') === -1) h += '<option value="' + selected + '" selected>' + fcMonthLabel(selected) + '</option>';
  return h;
}
function fcItemRowHtml(model, qty) {
  return '<div class="item-row fc-item-row" style="display:flex;align-items:center;gap:5px;padding:4px 0;border-bottom:1px solid rgba(127,127,127,.15)">' +
    '<input type="text" class="fc-it-model" list="' + (window._fcModelDatalistId || '') + '" value="' + sanitize(model || '') + '" placeholder="ชื่อสินค้า" style="flex:1;font-size:.78rem" autocomplete="off">' +
    '<input type="number" class="fc-it-qty" min="1" value="' + (Number(qty) || 1) + '" style="width:56px;font-size:.78rem">' +
    '<button type="button" class="btn bsm bd" onclick="this.closest(\'.fc-item-row\').remove()" title="ลบ">✕</button>' +
    '</div>';
}
function fcRow(i, fn) {
  fn = fn || {};
  var items = Array.isArray(fn.items) ? fn.items : (fn.items ? [{model: fn.items, qty: 1}] : []); // legacy string → 1 แถว กันข้อมูลเก่าหาย
  var itemsHtml = items.map(function(it) { return fcItemRowHtml(it.model, it.qty); }).join('');
  return '<div style="margin-bottom:6px;padding:8px;background:#0f172a;border:1px solid #334155;border-radius:8px">' +
    (fn._carried ? '<div style="font-size:.62rem;color:#60a5fa;margin-bottom:4px">📥 ดึงมาจาก Visit ' + fDShort(fn._carried) + ' — แก้ไข/ปรับเพิ่มลดได้เลย</div>' : '') +
    '<div class="fr"><select id="fc_m_' + i + '" style="flex:1">' + fcMonthOptionsHtml(fn.month || '') + '</select>' +
    '<input type="text" inputmode="decimal" class="js-money" id="fc_a_' + i + '" value="' + nmI(fn.amount || '') + '" placeholder="มูลค่า (฿) — ไม่บังคับ" style="flex:1"></div>' +
    '<div id="fc_items_' + i + '" style="margin-top:5px">' + itemsHtml + '</div>' +
    '<div style="display:flex;gap:4px;margin-top:4px">' +
    '<input type="text" id="fc_newmodel_' + i + '" list="' + (window._fcModelDatalistId || '') + '" placeholder="พิมพ์ชื่อสินค้า..." style="flex:1;font-size:.78rem" autocomplete="off">' +
    '<input type="number" id="fc_newqty_' + i + '" min="1" value="1" style="width:56px;font-size:.78rem">' +
    '<button type="button" class="btn bsm bp" onclick="fcAddItem(' + i + ')">➕</button>' +
    '</div></div>';
}
function fcAddItem(i) {
  var modelEl = document.getElementById('fc_newmodel_' + i);
  var qtyEl = document.getElementById('fc_newqty_' + i);
  var model = (modelEl.value || '').trim();
  if (!model) { modelEl.focus(); return; }
  var wrap = document.getElementById('fc_items_' + i);
  if (wrap) wrap.insertAdjacentHTML('beforeend', fcItemRowHtml(model, qtyEl.value));
  modelEl.value = ''; qtyEl.value = '1'; modelEl.focus();
}
function fcCollectItems(i) {
  var wrap = document.getElementById('fc_items_' + i);
  if (!wrap) return [];
  return Array.prototype.map.call(wrap.querySelectorAll('.fc-item-row'), function(row) {
    return { model: row.querySelector('.fc-it-model').value.trim(), qty: Number(row.querySelector('.fc-it-qty').value) || 1 };
  }).filter(function(it) { return it.model; });
}
function addFcRow() { var c = document.getElementById('fv_fcs'); if (c) c.insertAdjacentHTML('beforeend', fcRow(c.children.length, {})); }
function fbRow(i, f) { return '<div style="margin-bottom:3px"><input type="text" id="fb_' + i + '" value="' + sanitize(f || '') + '" placeholder="Feedback ' + (i + 1) + '..."></div>'; }
function addFbRow() { var c = document.getElementById('fv_fbs'); if (c) c.insertAdjacentHTML('beforeend', fbRow(c.children.length, '')); }

// Save Visit Quick
function saveVisitQuick(dealerId, eid) {
  var srcEl = document.querySelector('input[name="fv_source"]:checked');
  var srcType = srcEl ? srcEl.value : 'dealer';
  var did = '', prospectId = '', company = '';
  if (srcType === 'lead') {
    var selPr = document.getElementById('fv_lead_prospect');
    prospectId = selPr ? selPr.value : '';
    if (!prospectId) return alert('เลือก Lead ที่ติดตาม');
    var pr = ST.getOne('prospects', prospectId);
    company = pr ? (pr.companyName || '') : '';
  } else if (srcType === 'other') {
    var companyEl = document.getElementById('fv_company_txt');
    company = companyEl ? companyEl.value.trim() : '';
    if (!company) return alert('พิมพ์ชื่อบริษัท');
  } else {
    did = document.getElementById('fv_dealer') ? document.getElementById('fv_dealer').value : dealerId;
    if (!did) return alert('เลือก Dealer');
  }
  var summary = document.getElementById('fv_summary') ? document.getElementById('fv_summary').value.trim() : '';
  if (!summary) return alert('ใส่สรุป');
  var cfg = getConfig();
  var modeEl = document.querySelector('input[name="fv_mode"]:checked');
  var data = {date: dpG('fv_date'), time: document.getElementById('fv_time') ? document.getElementById('fv_time').value : '', dealerId: did, prospectId: prospectId, company: company, mode: modeEl ? modeEl.value : 'online', summary: summary, saleName: cfg.saleName, reportMode: 'quick', topicData: [], pipelineUpdates: [], forecastNotes: [], feedbackItems: [], attachments: window._visitAttach || [], sourceTaskId: (!eid && typeof _pendingLinkTaskId !== 'undefined' && _pendingLinkTaskId) || ''};
  if (!data.date) return alert('ใส่วันที่');
  if (!(window._visitAttach || []).length && !confirm('📷 ยังไม่ได้แนบรูปเลย — ยืนยันบันทึกโดยไม่มีรูปถ่ายไหม?')) return;
  window._visitSourceType = 'dealer'; window._vpPrefillProspectId = '';
  var visitObj = eid ? ST.update('visits', eid, data) : ST.add('visits', data);
  if (!eid && typeof resolveTaskPendingLink === 'function') resolveTaskPendingLink('visit', visitObj.id, fDShort(visitObj.date) + ' Visit');
  if (!eid) _visitClearDraft();
  closeMForce(); toast('💾 บันทึก Visit แล้ว'); render();
  notifyVisitSavedAcrossTabs(did);
  if (typeof vpMarkPlanActualFromVisit === 'function') vpMarkPlanActualFromVisit(visitObj.id, prospectId);
}

// Save Visit (Standard/Full)
function saveVisit(dealerId, eid) {
  var cfg = getConfig();
  var srcEl = document.querySelector('input[name="fv_source"]:checked');
  var srcType = srcEl ? srcEl.value : 'dealer';
  var did = '', prospectId = '', company = '';
  if (srcType === 'lead') {
    var selPr = document.getElementById('fv_lead_prospect');
    prospectId = selPr ? selPr.value : '';
    if (!prospectId) return alert('เลือก Lead ที่ติดตาม');
    var pr = ST.getOne('prospects', prospectId);
    company = pr ? (pr.companyName || '') : '';
  } else if (srcType === 'other') {
    var companyEl = document.getElementById('fv_company_txt');
    company = companyEl ? companyEl.value.trim() : '';
    if (!company) return alert('พิมพ์ชื่อบริษัท');
  } else {
    did = document.getElementById('fv_dealer') ? document.getElementById('fv_dealer').value : dealerId;
    if (!did) return alert('เลือก Dealer');
  }
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
      if (topic.id === 'anti_drone') td.status = _pillGetValue('vt_anti_drone_pill');
    }
    topicData.push(td);
  }

  // Pipeline updates
  var pipelineUpdates = [];
  var pipeChks = document.querySelectorAll('.pipe_chk:checked');
  for (var i = 0; i < pipeChks.length; i++) {
    var pid = pipeChks[i].value;
    var puItems = puCollectItems(pid); // ช่องรายการ render ไว้เสมอ (แค่ซ่อนถ้ายังไม่กดเปิด) เลยอ่านค่าปัจจุบันได้ตรงๆ — ถ้าไม่แตะเลยค่าจะเท่าของเดิมพอดี ไม่เกิด diff ปลอมตอน save
    // เช็คลิสต์ข้อมูลประกอบ POS — ช่องเหล่านี้ก็ render ไว้เสมอเหมือนกัน (ซ่อนไว้เฉยๆ) อ่านตรงๆ ได้เลย
    var posApplyEl = document.getElementById('pu_posapply_' + pid);
    pipelineUpdates.push({
      pipeId: pid, newStatus: (document.getElementById('pu_st_' + pid) || {}).value || '', note: (document.getElementById('pu_note_' + pid) || {}).value || '', items: puItems,
      appointmentLetter: (document.getElementById('pu_appt_' + pid) || {}).value || '',
      tor: (document.getElementById('pu_tor_' + pid) || {}).value || '',
      djiCrmRegistered: !!(document.getElementById('pu_crm_' + pid) || {}).checked,
      hasCompetitor: !!(document.getElementById('pu_comp_' + pid) || {}).checked,
      pocDone: !!(document.getElementById('pu_poc_' + pid) || {}).checked,
      presentedDone: !!(document.getElementById('pu_present_' + pid) || {}).checked,
      torDraftDone: !!(document.getElementById('pu_drafttor_' + pid) || {}).checked,
      applySuggestedPOS: !!(posApplyEl && posApplyEl.checked)
    });
  }

  // Forecast
  var forecastNotes = [];
  var fcCnt = document.getElementById('fv_fcs') ? document.getElementById('fv_fcs').children.length : 0;
  for (var i = 0; i < fcCnt; i++) {
    var m = (document.getElementById('fc_m_' + i) || {}).value || '';
    var a = (document.getElementById('fc_a_' + i) || {}).value || '';
    var fcItems = fcCollectItems(i);
    if (m.trim() || a || fcItems.length) forecastNotes.push({month: m.trim(), amount: parseNum(a), items: fcItems});
  }

  // Feedback
  var feedbackItems = [];
  var fbCnt = document.getElementById('fv_fbs') ? document.getElementById('fv_fbs').children.length : 0;
  for (var i = 0; i < fbCnt; i++) { var f = (document.getElementById('fb_' + i) || {}).value || ''; if (f.trim()) feedbackItems.push(f.trim()); }

  var modeEl = document.querySelector('input[name="fv_mode"]:checked');
  var data = {
    date: dpG('fv_date'), time: (document.getElementById('fv_time') || {}).value || '',
    dealerId: did, prospectId: prospectId, company: company, mode: modeEl ? modeEl.value : 'offline',
    djiDealer: (document.getElementById('fv_djid') || {}).value || '',
    location: (document.getElementById('fv_loc') || {}).value || '',
    summary: (document.getElementById('fv_summary') || {}).value || '',
    revenue: parseNum((document.getElementById('vt_revenue') || {}).value),
    expectedRevenue: parseNum((document.getElementById('vt_expected') || {}).value),
    customerSegment: (document.getElementById('vt_segment') || {}).value || '',
    dockInterest: (document.getElementById('vt_dock') || {}).value || '',
    topicData: topicData, pipelineUpdates: pipelineUpdates, forecastNotes: forecastNotes, feedbackItems: feedbackItems,
    saleName: cfg.saleName, reportMode: visitMode, attachments: window._visitAttach || [],
    sourceTaskId: (!eid && typeof _pendingLinkTaskId !== 'undefined' && _pendingLinkTaskId) || ''
  };

  if (!(window._visitAttach || []).length && !confirm('📷 ยังไม่ได้แนบรูปเลย — ยืนยันบันทึกโดยไม่มีรูปถ่ายไหม?')) return;

  var visitObj;
  if (eid) { ST.update('visits', eid, data); visitObj = ST.getOne('visits', eid); }
  else {
    visitObj = ST.add('visits', data);
    if (typeof resolveTaskPendingLink === 'function') resolveTaskPendingLink('visit', visitObj.id, fDShort(visitObj.date) + ' Visit');
    _visitClearDraft();
  }

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
      // แก้ไขรายการสินค้า/จำนวนจาก Visit — เทียบกับของเดิมก่อน sync เข้า pipeline.items จริง (ตั้ง model/modelQty
      // legacy field คู่กันด้วยเผื่อจุดอื่นยังอ่านจากฟิลด์เก่า ดู getPipeItems() ใน views-pipeline.js) แล้ว log ว่า
      // เปลี่ยนอะไรไป ไม่ใช่แค่ "อัพเดตจาก Visit" เฉยๆ กันไม่รู้ว่าจริงๆ แก้อะไรตอนย้อนดู Timeline ทีหลัง
      var itemsDiff = '';
      if (oldPipe && Array.isArray(pu.items)) {
        var oldItems = getPipeItems(oldPipe);
        var oldKey = JSON.stringify(oldItems.map(function(it) { return [it.model, Number(it.qty) || 1]; }));
        var newKey = JSON.stringify(pu.items.map(function(it) { return [it.model, Number(it.qty) || 1]; }));
        if (oldKey !== newKey) {
          var totalQty = pu.items.reduce(function(s, it) { return s + (Number(it.qty) || 1); }, 0);
          ST.update('pipeline', pu.pipeId, { items: pu.items, model: pu.items.length ? pu.items[0].model : '', modelQty: totalQty });
          itemsDiff = pu.items.length
            ? pu.items.map(function(it) { return it.model + ' x' + (Number(it.qty) || 1); }).join(', ')
            : '(ลบรายการสินค้าทั้งหมด)';
        }
      }
      // เช็คลิสต์ข้อมูลประกอบ POS — sync เข้า pipeline ตรงๆ เฉพาะช่องที่เปลี่ยนจริง (เทียบกับ oldPipe) กัน log
      // รกด้วยข้อความ "ไม่มีอะไรเปลี่ยน" ทุกครั้งที่บันทึก Visit ทั้งที่ไม่ได้แตะ checklist นี้เลย
      var chkUpdates = {}; var chkDiff = [];
      if (oldPipe) {
        if (pu.appointmentLetter !== (oldPipe.appointmentLetter || '')) { chkUpdates.appointmentLetter = pu.appointmentLetter; if (pu.appointmentLetter) chkDiff.push('หนังสือแต่งตั้ง→' + pu.appointmentLetter); }
        if (pu.tor !== (oldPipe.tor || '')) { chkUpdates.tor = pu.tor; if (pu.tor) chkDiff.push('TOR→' + pu.tor); }
        if (!!pu.djiCrmRegistered !== !!oldPipe.djiCrmRegistered) { chkUpdates.djiCrmRegistered = pu.djiCrmRegistered; if (pu.djiCrmRegistered) chkUpdates.djiCrmDate = _td(); chkDiff.push(pu.djiCrmRegistered ? 'ลงทะเบียน CRM แล้ว' : 'ยกเลิกลงทะเบียน CRM'); }
        if (!!pu.hasCompetitor !== !!oldPipe.hasCompetitor) { chkUpdates.hasCompetitor = pu.hasCompetitor; chkDiff.push(pu.hasCompetitor ? 'พบว่ามีคู่แข่ง' : 'ไม่มีคู่แข่งแล้ว'); }
        if (!!pu.pocDone !== !!oldPipe.pocDone) { chkUpdates.pocDone = pu.pocDone; if (pu.pocDone) chkDiff.push('ไป POC แล้ว'); }
        if (!!pu.presentedDone !== !!oldPipe.presentedDone) { chkUpdates.presentedDone = pu.presentedDone; if (pu.presentedDone) chkDiff.push('พรีเซนต์งานให้หน่วยงานแล้ว'); }
        if (!!pu.torDraftDone !== !!oldPipe.torDraftDone) { chkUpdates.torDraftDone = pu.torDraftDone; if (pu.torDraftDone) chkDiff.push('ร่าง TOR ให้หน่วยงานแล้ว'); }
        if (Object.keys(chkUpdates).length) ST.update('pipeline', pu.pipeId, chkUpdates);
      }

      // ติ๊ก "ใช้ POS แนะนำ" ไว้ — คำนวณใหม่จากค่าล่าสุด (รวม items/checklist ที่เพิ่งแก้ในรอบนี้) แล้วเซ็ตทับ POS เดิม
      var posDiff = '';
      if (pu.applySuggestedPOS && oldPipe) {
        var pipeForPos = Object.assign({}, oldPipe, chkUpdates, { status: pu.newStatus || oldPipe.status });
        var suggested = computeSuggestedPOS(pipeForPos, cfg, ST.pipeLogsByPipe(pu.pipeId)[0] ? ST.pipeLogsByPipe(pu.pipeId)[0].date : null);
        if (suggested.score !== (oldPipe.projectPOS || 0)) {
          ST.update('pipeline', pu.pipeId, { projectPOS: suggested.score, posHistory: appendPosHistory(oldPipe, suggested.score) });
          posDiff = 'POS ' + (oldPipe.projectPOS || 0) + '%→' + suggested.score + '% (ใช้ค่าแนะนำ)';
        }
      }

      var logContent = '🤝 ' + fDShort(data.date) + ' Visit: ' + (pu.note || 'อัพเดตจาก Visit');
      if (itemsDiff) logContent += ' — 📦 แก้ไขรายการสินค้าเป็น: ' + itemsDiff;
      if (chkDiff.length) logContent += ' — 🎯 ' + chkDiff.join(', ');
      if (posDiff) logContent += ' — ' + posDiff;
      ST.add('pipeLog', {pipeId: pu.pipeId, type: 'visit', content: logContent, date: data.date + 'T00:00:00', visitId: visitObj.id});
    }
  });

  // Save feedback
  feedbackItems.forEach(function(f) { ST.add('feedback', {dealerId: did, text: f, date: data.date, source: 'visit'}); });

  window._visitSourceType = 'dealer'; window._vpPrefillProspectId = '';
  closeMForce(); toast('💾 บันทึก Visit แล้ว');
  notifyVisitSavedAcrossTabs(did);
  if (typeof vpMarkPlanActualFromVisit === 'function') vpMarkPlanActualFromVisit(visitObj.id, prospectId);
  // เดิมเด้ง confirm() ถาม "สร้าง Draft Email?" ทุกครั้งหลังบันทึก — ตัดออกแล้ว กดปุ่ม "📧 Draft Email" เองจาก
  // หน้ารายละเอียด Visit ตอนต้องการแทน (ดู rVisitDet ใน views-visit.js)
  go('visitDetail', {visitId: visitObj.id});
}

// แจ้งแท็บอื่นของแอปเดียวกัน (เช่นแท็บหลักที่เปิดหน้า Dealer ค้างไว้) ให้รีเฟรชอัตโนมัติหลังบันทึก Visit จากแท็บแยก
function notifyVisitSavedAcrossTabs(dealerId) {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    var ch = new BroadcastChannel('djisales_sync');
    ch.postMessage({ type: 'visitSaved', dealerId: dealerId });
    ch.close();
  } catch (e) {}
}
// ================================================================
// FOLLOW-UP MODAL
// ================================================================
function showFollowupM(dealerId) {
  openM('📞 Follow-up', '' +
    dpH('ff_d', _td(), 'วันที่ *') +
    _dealerPickerHtml('ff_dlr', dealerId) +
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
    _dealerPickerHtml('fl_dlr', dealerId) +
    '<div class="fg"><label>ประเภท</label><select id="fl_t">' + optionsHTML(cfg.lineLogTypes, '', '--') + '</select></div>' +
    '<div class="fg"><label>เวลา</label><div style="display:flex;gap:6px"><input type="time" id="fl_time" style="flex:1"><button type="button" class="btn bsm bo" onclick="document.getElementById(\'fl_time\').value=new Date().toTimeString().slice(0,5)">⏱️ ตอนนี้</button></div></div>' +
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
  window._fbAttach = [];
  openM('💡 Feedback', '' +
    dpH('ffb_d', _td(), 'วันที่') +
    '<div class="fg"><label>Feedback *</label><textarea id="ffb_t" rows="3"></textarea></div>' +
    attachUploadHtml('_fbAttach', 'feedback', '📷 สกรีนช็อต/รูปประกอบ') +
    '<button class="btn bp btn-full" onclick="saveFeedbackM(\'' + dealerId + '\')">💾 บันทึก</button>');
}

function saveFeedbackM(dealerId) {
  var text = document.getElementById('ffb_t');
  if (!text || !text.value.trim()) return alert('ใส่ Feedback');
  ST.add('feedback', {
    dealerId: dealerId,
    text: text.value.trim(),
    date: dpG('ffb_d') || _td(),
    source: 'manual',
    attachments: window._fbAttach || []
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
  if (typeof syncToFirebase === 'function') syncToFirebase('contactLogs', logs);
  
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
    '</select></div></div><div class="fm-actions"><button class="btn bp" onclick="submitUnifiedContact()">💾 บันทึก</button>' +
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
        if (pipeIsOpen(pipes[i])) {
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
      if (typeof syncToFirebase === 'function') syncToFirebase('pendingFollowups', pendingFu);
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
      <button class="btn bp" onclick="saveReschedule('${taskId}')">💾 บันทึก</button>
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
      <button class="btn bp" onclick="saveFollowupDate('${taskId}')">💾 บันทึก</button>
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
    <button class="btn bp" onclick="saveStartDate('${taskId}')">💾 บันทึก</button>
  `);
}

function saveStartDate(taskId) {
  var startDate = dpG('start_date');
  ST.update('tasks', taskId, { startDate: startDate });
  closeMForce();
  toast('✅ บันทึกแล้ว');
  render();
}

function showTaskM(eid, prefillDealerId, prefillDueDate, prefillPipeId) {
  var t = eid ? ST.getOne('tasks', eid) : {};
  var cats = [];
  var allTasks = ST.getAll('tasks');
  for (var i = 0; i < allTasks.length; i++) {
    if (allTasks[i].category && cats.indexOf(allTasks[i].category) === -1) cats.push(allTasks[i].category);
  }
  
  var dealers = ST.getAll('dealers');
  var selDealerId = prefillDealerId || t.dealerId || '';
  var selDealerName = '';
  if (selDealerId) { var _sd0 = ST.getOne('dealers', selDealerId); selDealerName = _sd0 ? (_sd0.name || '') : ''; }

  // ช่อง Dealer/Pipeline เป็น text + datalist (พิมพ์ค้นได้) แทน select เดิม — ค่าจริงเก็บใน hidden input
  // (ft_dealer/ft_pipe) resolve จากข้อความที่พิมพ์ตอน save (ดู _resolveTaskDealerPipeForSave) ถ้าพิมพ์ชื่อ
  // ที่ยังไม่มีในระบบจะถามสร้างใหม่ให้เลย ไม่ต้องออกไปสร้างที่เมนู Dealer/Pipeline ก่อน
  var dealerListOpts = dealers.map(function(d) { return '<option value="' + sanitize(d.name || '') + '">'; }).join('');

  var selPipeId = t.pipeId || prefillPipeId || '';
  var selPipeName = '';
  var pipeListOpts = '';
  if (selDealerId) {
    var pipes = ST.pipelineByDealer(selDealerId).filter(pipeIsOpen);
    pipeListOpts = pipes.map(function(p) { return '<option value="' + sanitize((p.rowNo ? p.rowNo + ' · ' : '') + (p.projectName || p.name || '-')) + '">'; }).join('');
    if (selPipeId) {
      var _sp0 = pipes.filter(function(p) { return p.id === selPipeId; })[0] || ST.getOne('pipeline', selPipeId);
      selPipeName = _sp0 ? (_sp0.projectName || _sp0.name || '') : '';
    }
  }
  
  window._ftDescMode = 'text';
  window._ftDescAttach = (t.attachments || []).slice();
  window._ftLinks = (t.links || []).slice();
  var tplOpts = ST.getAll('templates').map(function(tp) {
    return '<option value="' + tp.id + '">' + sanitize(tp.name) + ' (' + (tp.steps || []).length + ')</option>';
  }).join('');

  // ฟอร์มยาว — ย้ายฟิลด์ที่ไม่ค่อยได้ใช้ตอนสร้าง Task ใหม่ (URL/Linked items/หมวด/Flow) ไปไว้ใต้ส่วนที่ยุบได้
  // เปิดให้อัตโนมัติถ้าเป็นการแก้ไข Task ที่มีข้อมูลพวกนี้อยู่แล้ว จะได้ไม่ต้องกดเปิดเองทุกครั้งตอนแก้ไข
  var ftAdvHasData = !!(t.url || (t.links && t.links.length) || t.category || t.sequential);

  openM(eid ? '✏️ งาน' : '➕ งาน', '' +
    '<div class="fg"><label>ชื่อ *</label><input type="text" id="ft_t" value="' + sanitize(t.title || '') + '"></div>' +
    '<div class="fg"><div style="display:flex;justify-content:space-between;align-items:center"><label>รายละเอียด</label>' +
    '<button type="button" class="btn bsm bo" onclick="toggleExpandTextarea(\'ft_d\')">⛶ ขยาย</button></div>' +
    (eid ? '' : '<div style="display:flex;gap:6px;margin-bottom:6px">' +
      '<button type="button" class="btn bsm bp" id="ft_mode_text" onclick="setTaskDescMode(\'text\')">📝 ข้อความยาว</button>' +
      '<button type="button" class="btn bsm bo" id="ft_mode_bullet" onclick="setTaskDescMode(\'bullet\')">☑ Bullet list</button></div>') +
    '<div id="ft_text_wrap">' +
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">' +
    '<input type="file" accept="image/*" onchange="_handleAttachUpload(event,\'_ftDescAttach\',\'tasks\')" style="flex:1;font-size:.72rem" title="แนบรูปจากไฟล์ในเครื่อง">' +
    '<span class="hint" style="white-space:nowrap">หรือ Ctrl+V วางรูป</span>' +
    '</div>' +
    '<textarea id="ft_d" rows="7" style="min-height:140px" placeholder="พิมพ์รายละเอียด... (วางหรือลากรูปลงในช่องนี้ได้)" onpaste="handlePasteOrDropImage(event,\'_ftDescAttach\',\'tasks\')" ondrop="handlePasteOrDropImage(event,\'_ftDescAttach\',\'tasks\')" ondragover="event.preventDefault()">' + sanitize(t.description || '') + '</textarea>' +
    '<div id="_ftDescAttach_thumbs">' + attachThumbsHtml(window._ftDescAttach, '_ftDescAttach') + '</div></div>' +
    (eid ? '' : '<div id="ft_bullet_wrap" style="display:none">' +
      '<div class="fr" style="margin-bottom:6px;gap:6px">' +
      '<select id="ft_tpl" style="flex:1" onchange="applyTaskTplToBullets(this.value)"><option value="">-- เลือกจาก Template --</option>' + tplOpts + '</select>' +
      '<button type="button" class="btn bsm bo" onclick="saveBulletsAsTemplate()">💾 บันทึกเป็น Template</button></div>' +
      '<textarea id="ft_bullets" rows="6" placeholder="พิมพ์ 1 บรรทัด = 1 bullet เช่น&#10;โทรลูกค้า A&#10;ส่งใบเสนอราคา B&#10;เช็คสต็อก C"></textarea>' +
      '<div class="hint">💡 แต่ละบรรทัดจะกลายเป็น Step ในงานนี้ — แก้ไขรายละเอียด/วันที่/link ของแต่ละ bullet ได้ทีหลังในหน้า Task</div></div>') +
    '</div>' +
    '<div class="fr">' +
    '<div class="fg"><label>🏪 Dealer</label>' +
    '<input type="text" id="ft_dealer_txt" list="ft_dealer_dl" value="' + sanitize(selDealerName) + '" placeholder="พิมพ์ชื่อ Dealer..." autocomplete="off" oninput="taskDealerTextChanged()">' +
    '<datalist id="ft_dealer_dl">' + dealerListOpts + '</datalist>' +
    '<input type="hidden" id="ft_dealer" value="' + selDealerId + '"></div>' +
    '<div class="fg"><label>📊 Pipeline Project</label>' +
    '<input type="text" id="ft_pipe_txt" list="ft_pipe_dl" value="' + sanitize(selPipeName) + '" placeholder="พิมพ์ชื่อโครงการ..." autocomplete="off" oninput="taskPipeTextChanged()">' +
    '<datalist id="ft_pipe_dl">' + pipeListOpts + '</datalist>' +
    '<input type="hidden" id="ft_pipe" value="' + selPipeId + '"></div>' +
    '</div>' +
    '<div class="fr">' + dpH('ft_s', t.startDate || _td(), 'วันเริ่ม') + dpH('ft_e', t.dueDate || prefillDueDate || '', 'Deadline') + '</div>' +
    '<div style="display:flex;gap:4px;flex-wrap:wrap;margin:-6px 0 10px">' +
    '<button type="button" class="btn bsm bo" onclick="dpSet(\'ft_e\',_td())">วันนี้</button>' +
    '<button type="button" class="btn bsm bo" onclick="dpSet(\'ft_e\',addD(_td(),1))">พรุ่งนี้</button>' +
    '<button type="button" class="btn bsm bo" onclick="dpSet(\'ft_e\',_qdEndOfWeek())">สิ้นสัปดาห์นี้</button>' +
    '<button type="button" class="btn bsm bo" onclick="dpSet(\'ft_e\',_qdThisFriday())">ศุกร์นี้</button></div>' +
    '<div class="fr">' +
    '<div class="fg"><label>สำคัญ</label><select id="ft_p">' +
    '<option value="high"' + (t.priority === 'high' ? ' selected' : '') + '>🔴 มาก</option>' +
    '<option value="medium"' + ((t.priority || 'medium') === 'medium' ? ' selected' : '') + '>🟡 กลาง</option>' +
    '<option value="low"' + (t.priority === 'low' ? ' selected' : '') + '>🟢 ทั่วไป</option>' +
    '</select></div>' +
    '<div class="fg"><label>สถานะ</label><select id="ft_st">' +
    '<option value="active"' + ((t.status || 'active') === 'active' ? ' selected' : '') + '>🔄 ทำ</option>' +
    '<option value="completed"' + (t.status === 'completed' ? ' selected' : '') + '>✅ เสร็จ</option>' +
    '<option value="on-hold"' + (t.status === 'on-hold' ? ' selected' : '') + '>⏸️ พัก</option>' +
    '</select></div>' +
    '</div>' +
    '<div class="form-section" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="_toggleFormSection(\'ft_adv_wrap\',this)">⚙️ รายละเอียดเพิ่มเติม <span style="font-size:11px;font-weight:400;color:var(--text2)">' + (ftAdvHasData ? '▲ ซ่อน' : '▼ แสดง') + '</span></div>' +
    '<div id="ft_adv_wrap"' + (ftAdvHasData ? '' : ' style="display:none"') + '>' +
    '<div class="fg"><label>🔗 Link (URL)</label><input type="url" id="ft_url" value="' + sanitize(t.url || '') + '" placeholder="https://..."></div>' +
    _taskLinksFieldHtml(t) +
    '<div class="fg"><label>หมวด</label><input type="text" id="ft_c" value="' + sanitize(t.category || '') + '" list="catL"><datalist id="catL">' + cats.map(function(c) { return '<option value="' + c + '">'; }).join('') + '</datalist></div>' +
    '<div class="fg"><label>⚡ Flow</label><select id="ft_sq">' +
    '<option value="0"' + (t.sequential ? '' : ' selected') + '>ปิด</option>' +
    '<option value="1"' + (t.sequential ? ' selected' : '') + '>เปิด</option>' +
    '</select></div>' +
    '</div>' +
    '<button class="btn bp btn-full" onclick="saveTask(\'' + (eid || '') + '\')">💾 บันทึก</button>');
}

// ================================================================
// TASK LINKS — เพิ่ม/ลบลิงก์เชื่อมกับเมนูอื่นในโมดัล Task (เก็บชั่วคราวใน window._ftLinks จน saveTask())
// รูปแบบเดียวกับ window._ftDescAttach (แนบไฟล์) — เลือกประเภทก่อนแล้วค่อยเลือกรายการ กันเลือกผิดชนิด
// ================================================================
function _taskLinksFieldHtml(t) {
  var typeOpts = '<option value="">-- เลือกประเภท --</option>';
  Object.keys(TASK_LINK_TYPES).forEach(function(k) {
    typeOpts += '<option value="' + k + '">' + TASK_LINK_TYPES[k].icon + ' ' + TASK_LINK_TYPES[k].name + '</option>';
  });
  return '<div class="fg"><label>🔗 เชื่อมโยงกับ</label>' +
    '<div id="ft_links_wrap">' + _taskLinksChipsHtml(window._ftLinks) + '</div>' +
    '<div style="display:flex;gap:6px;margin-top:6px">' +
    '<select id="ft_link_type" style="flex:1" onchange="_ftLinkTypeChanged()">' + typeOpts + '</select>' +
    '<select id="ft_link_item" style="flex:2" disabled><option value="">-- เลือกประเภทก่อน --</option></select>' +
    '<button type="button" class="btn bsm bo" onclick="_ftAddLink()">+ เพิ่ม</button>' +
    '</div>' +
    '<div style="margin-top:4px"><button type="button" class="btn bsm bo" onclick="_ftAddPendingLink()">+ ยังไม่มี บันทึกเป็นรายการรอสร้างไว้ก่อน</button></div>' +
    '<div class="hint">💡 เลือกประเภทด้านบนก่อน แล้วกดปุ่มนี้ถ้ายังไม่มีรายการจริงให้เลือก (เช่น ยังไม่ได้ทำใบเสนอราคา) — พอกดสร้างจริงทีหลัง ระบบจะผูกให้อัตโนมัติ</div>' +
    '</div>';
}

function _taskLinksChipsHtml(links) {
  if (!links || !links.length) return '<div class="hint">ยังไม่มีลิงก์</div>';
  return '<div style="display:flex;gap:6px;flex-wrap:wrap">' + links.map(function(l, i) {
    var lt = TASK_LINK_TYPES[l.type] || { icon: '🔗' };
    if (l.pending) {
      return '<span class="tag" style="background:var(--bg2);color:var(--text2);border:1px dashed var(--border);display:inline-flex;align-items:center;gap:5px;padding:4px 9px">' +
        '⏳ ' + lt.icon + ' ' + sanitize(lt.name) + ' (รอสร้าง)' +
        ' <span style="cursor:pointer;color:#ef4444;font-weight:700" onclick="_ftRemoveLink(' + i + ')">✕</span></span>';
    }
    return '<span class="tag" style="background:var(--bg2);color:var(--text);display:inline-flex;align-items:center;gap:5px;padding:4px 9px">' +
      lt.icon + ' ' + sanitize(l.label) +
      ' <span style="cursor:pointer;color:#ef4444;font-weight:700" onclick="_ftRemoveLink(' + i + ')">✕</span></span>';
  }).join('') + '</div>';
}

function _ftLinkTypeChanged() {
  var type = document.getElementById('ft_link_type').value;
  var sel = document.getElementById('ft_link_item');
  if (!type) { sel.innerHTML = '<option value="">-- เลือกประเภทก่อน --</option>'; sel.disabled = true; return; }
  var items = taskLinkList(type);
  sel.disabled = false;
  sel.innerHTML = '<option value="">-- เลือกรายการ (' + items.length + ') --</option>' +
    items.map(function(it) { return '<option value="' + it.id + '">' + sanitize(it.label) + '</option>'; }).join('');
}

function _ftAddLink() {
  var type = document.getElementById('ft_link_type').value;
  var sel = document.getElementById('ft_link_item');
  var id = sel ? sel.value : '';
  if (!type || !id) return toast('เลือกประเภทกับรายการก่อน');
  var label = sel.options[sel.selectedIndex].textContent;
  window._ftLinks = window._ftLinks || [];
  if (window._ftLinks.some(function(l) { return l.type === type && l.id === id; })) { toast('มีลิงก์นี้อยู่แล้ว'); return; }
  window._ftLinks.push({ type: type, id: id, label: label });
  document.getElementById('ft_links_wrap').innerHTML = _taskLinksChipsHtml(window._ftLinks);
  document.getElementById('ft_link_type').value = '';
  _ftLinkTypeChanged();
}

// ผูกลิงก์แบบ "รอสร้าง" — ยังไม่มี id จริง (ดู openTaskLinkCreate/resolveTaskPendingLink ใน utils.js
// สำหรับตอนกดเปิดสร้างจริง + ผูก id กลับอัตโนมัติหลังบันทึกสำเร็จ)
function _ftAddPendingLink() {
  var type = document.getElementById('ft_link_type').value;
  if (!type) return toast('เลือกประเภทก่อน');
  window._ftLinks = window._ftLinks || [];
  if (window._ftLinks.some(function(l) { return l.type === type && l.pending; })) { toast('มีรายการรอสร้างประเภทนี้อยู่แล้ว'); return; }
  window._ftLinks.push({ type: type, id: null, pending: true, label: (TASK_LINK_TYPES[type] || {}).name + ' (รอสร้าง)' });
  document.getElementById('ft_links_wrap').innerHTML = _taskLinksChipsHtml(window._ftLinks);
  document.getElementById('ft_link_type').value = '';
  _ftLinkTypeChanged();
}

function _ftRemoveLink(idx) {
  window._ftLinks.splice(idx, 1);
  document.getElementById('ft_links_wrap').innerHTML = _taskLinksChipsHtml(window._ftLinks);
}

// พิมพ์ในช่อง Dealer — ถ้าตรงชื่อ Dealer ที่มีอยู่แล้ว (ไม่สนตัวพิมพ์เล็ก/ใหญ่) resolve เป็น id ทันที แล้ว
// รีเฟรช datalist โครงการ Pipeline ให้ตรงกับ Dealer นั้น (ถ้ายังไม่ match ก็ปล่อยว่างไว้ก่อน — resolve
// จริงจัง/ถามสร้างใหม่ทำตอนกด "บันทึก" ใน _resolveTaskDealerPipeForSave กันถามสร้างขณะพิมพ์ยังไม่จบ)
function taskDealerTextChanged() {
  var txt = document.getElementById('ft_dealer_txt').value.trim();
  var hid = document.getElementById('ft_dealer');
  var match = ST.getAll('dealers').filter(function(d) { return (d.name || '').trim().toLowerCase() === txt.toLowerCase(); })[0];
  hid.value = match ? match.id : '';

  var pipeDl = document.getElementById('ft_pipe_dl');
  var pipeHid = document.getElementById('ft_pipe');
  pipeHid.value = ''; // เปลี่ยน Dealer แล้ว โครงการที่เคย resolve ไว้ (ถ้ามี) ผูกกับ Dealer เก่า ต้อง resolve ใหม่
  if (match) {
    var pipes = ST.pipelineByDealer(match.id).filter(pipeIsOpen);
    pipeDl.innerHTML = pipes.map(function(p) { return '<option value="' + sanitize((p.rowNo ? p.rowNo + ' · ' : '') + (p.projectName || p.name || '-')) + '">'; }).join('');
  } else {
    pipeDl.innerHTML = '';
  }
}

// พิมพ์ในช่อง Pipeline Project — resolve เป็น pipeId ถ้าตรงชื่อโครงการที่มีอยู่แล้วของ Dealer ที่เลือกไว้
function taskPipeTextChanged() {
  var dealerId = document.getElementById('ft_dealer').value;
  var txt = document.getElementById('ft_pipe_txt').value.trim();
  var hid = document.getElementById('ft_pipe');
  if (!dealerId || !txt) { hid.value = ''; return; }
  var t = txt.toLowerCase();
  var match = ST.pipelineByDealer(dealerId).filter(function(p) {
    var nm = (p.projectName || p.name || '').trim().toLowerCase();
    var withRowNo = (p.rowNo ? String(p.rowNo).toLowerCase() + ' · ' : '') + nm;
    return nm === t || withRowNo === t;
  })[0];
  hid.value = match ? match.id : '';
}

// เรียกตอนกด "บันทึก" เท่านั้น — resolve ข้อความที่พิมพ์ในช่อง Dealer/Pipeline เป็น id จริง ถ้าพิมพ์ชื่อที่ยัง
// ไม่มีในระบบจะถามสร้างใหม่ให้เลย (Dealer ก่อน แล้วค่อย Pipeline ผูกกับ Dealer ที่ resolve/สร้างได้แล้ว —
// กรณีพิมพ์ชื่อใหม่ทั้งคู่จะโดนถามสร้างทั้ง 2 อย่างตามลำดับ) คืน null ถ้าผู้ใช้ยกเลิกตอนถาม (ให้ยกเลิก save ด้วย)
function _resolveTaskDealerPipeForSave() {
  var dealerTxt = (document.getElementById('ft_dealer_txt') || {}).value || '';
  dealerTxt = dealerTxt.trim();
  var dealerId = document.getElementById('ft_dealer') ? document.getElementById('ft_dealer').value : '';

  if (dealerTxt && !dealerId) {
    if (!confirm('ยังไม่มี Dealer "' + dealerTxt + '" ในระบบ\nต้องการสร้าง Dealer ใหม่นี้เลยไหม?')) return null;
    var newDealer = ST.add('dealers', { name: dealerTxt, level: 'Other', showSerial: 'Y' });
    dealerId = newDealer.id;
  }

  var pipeTxt = (document.getElementById('ft_pipe_txt') || {}).value || '';
  pipeTxt = pipeTxt.trim();
  var pipeId = document.getElementById('ft_pipe') ? document.getElementById('ft_pipe').value : '';

  if (pipeTxt && !pipeId) {
    if (!dealerId) { alert('กรุณาระบุ Dealer ก่อนสร้างโครงการ Pipeline ใหม่'); return null; }
    var newPipeName = pipeTxt.replace(/^\S+\s*·\s*/, '');
    if (!confirm('ยังไม่มีโครงการ "' + newPipeName + '" ของ Dealer นี้ในระบบ\nต้องการสร้างโครงการ Pipeline ใหม่นี้เลยไหม?')) return null;
    var newPipe = ST.add('pipeline', { dealerId: dealerId, projectName: newPipeName, status: 'initial' });
    pipeId = newPipe.id;
  }

  return { dealerId: dealerId, pipeId: pipeId };
}

function setTaskDescMode(mode) {
  window._ftDescMode = mode;
  document.getElementById('ft_text_wrap').style.display = mode === 'text' ? '' : 'none';
  document.getElementById('ft_bullet_wrap').style.display = mode === 'bullet' ? '' : 'none';
  document.getElementById('ft_mode_text').className = 'btn bsm ' + (mode === 'text' ? 'bp' : 'bo');
  document.getElementById('ft_mode_bullet').className = 'btn bsm ' + (mode === 'bullet' ? 'bp' : 'bo');
}

function applyTaskTplToBullets(id) {
  if (!id) return;
  var tp = ST.getOne('templates', id);
  if (!tp) return;
  var el = document.getElementById('ft_bullets');
  if (el) el.value = (tp.steps || []).map(function(s) { return s.title; }).join('\n');
}

function saveBulletsAsTemplate() {
  var el = document.getElementById('ft_bullets');
  var lines = el ? el.value.split('\n').map(function(l) { return l.trim(); }).filter(Boolean) : [];
  if (!lines.length) return alert('พิมพ์ bullet ก่อนค่อยบันทึกเป็น Template');
  var name = prompt('ชื่อ Template:', '');
  if (!name || !name.trim()) return;
  ST.add('templates', {
    name: name.trim(),
    sequential: false,
    steps: lines.map(function(l) { return {title: l, offsetDays: 0, durationDays: 0}; })
  });
  toast('💾 บันทึก Template แล้ว');
  var sel = document.getElementById('ft_tpl');
  if (sel) {
    sel.innerHTML = '<option value="">-- เลือกจาก Template --</option>' + ST.getAll('templates').map(function(tp) {
      return '<option value="' + tp.id + '">' + sanitize(tp.name) + ' (' + (tp.steps || []).length + ')</option>';
    }).join('');
  }
}

function saveTask(eid) {
  var title = document.getElementById('ft_t');
  var titleVal = title ? title.value.trim() : '';
  var hasAttach = (window._ftDescAttach || []).length > 0;
  // ไม่บังคับชื่อถ้ามีรูปแนบแล้ว (เช่นแคปหน้าจอมาวางแล้วรีบบันทึกโดยไม่มีเวลาพิม) — ตั้งชื่อให้อัตโนมัติแทน
  if (!titleVal && hasAttach) titleVal = '📷 บันทึกด่วน (' + new Date().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) + ')';
  if (!titleVal) return alert('ใส่ชื่อ');
  var dp = _resolveTaskDealerPipeForSave();
  if (dp === null) return; // ผู้ใช้ยกเลิกตอนถูกถามให้สร้าง Dealer/Pipeline ใหม่ — หยุด save ให้ไปแก้ช่องเอง
  var data = {
    title: titleVal,
    description: document.getElementById('ft_d') ? document.getElementById('ft_d').value.trim() : '',
    startDate: dpG('ft_s'),
    dueDate: dpG('ft_e'),
    priority: document.getElementById('ft_p') ? document.getElementById('ft_p').value : 'medium',
    category: document.getElementById('ft_c') ? document.getElementById('ft_c').value.trim() : '',
    status: document.getElementById('ft_st') ? document.getElementById('ft_st').value : 'active',
    sequential: document.getElementById('ft_sq') ? document.getElementById('ft_sq').value === '1' : false,
    url: document.getElementById('ft_url') ? document.getElementById('ft_url').value.trim() : '',
    dealerId: dp.dealerId,
    pipeId: dp.pipeId,
    attachments: window._ftDescAttach || [],
    links: window._ftLinks || []
  };
  if (eid) {
    ST.update('tasks', eid, data);
    closeMForce();
    go('taskDetail', {taskId: eid});
  } else {
    var steps = [];
    if (window._ftDescMode === 'bullet') {
      var bulletsEl = document.getElementById('ft_bullets');
      var lines = bulletsEl ? bulletsEl.value.split('\n').map(function(l) { return l.trim(); }).filter(Boolean) : [];
      steps = lines.map(function(l) { return {id: gid(), title: l, startDate: '', dueDate: '', url: '', notes: '', done: false, kanban: 'todo'}; });
    }
    data.steps = steps;
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
  window._stepAttach = [];
  openM('➕ Step', '' +
    '<div class="fg"><label>ชื่อ *</label><input type="text" id="fs_t"></div>' +
    '<div class="fr">' + dpH('fs_s', _td(), 'วันที่ทำ') + dpH('fs_e', '', 'วันที่เสร็จ') + '</div>' +
    '<div class="fg"><label>🔗 Link (URL)</label><input type="url" id="fs_url" placeholder="https://..."></div>' +
    '<div class="fg"><label>หมายเหตุ</label><textarea id="fs_n" rows="2"></textarea></div>' +
    attachUploadHtml('_stepAttach', 'tasks', '📷 รูปแนบ (หลักฐาน)') +
    '<button class="btn bp btn-full" onclick="saveStep(\'' + tid + '\')">💾 บันทึก</button>');
}

function editStep(tid, idx) {
  var t = ST.getOne('tasks', tid);
  if (!t || !t.steps || !t.steps[idx]) return;
  var s = t.steps[idx];
  window._stepAttach = (s.attachments || []).slice();
  openM('✏️ Step', '' +
    '<div class="fg"><label>ชื่อ *</label><input type="text" id="fs_t" value="' + sanitize(s.title) + '"></div>' +
    '<div class="fr">' + dpH('fs_s', s.startDate || '', 'วันที่ทำ') + dpH('fs_e', s.dueDate || '', 'วันที่เสร็จ') + '</div>' +
    '<div class="fg"><label>🔗 Link (URL)</label><input type="url" id="fs_url" value="' + sanitize(s.url || '') + '" placeholder="https://..."></div>' +
    '<div class="fg"><label>หมายเหตุ</label><textarea id="fs_n" rows="2">' + sanitize(s.notes || '') + '</textarea></div>' +
    attachUploadHtml('_stepAttach', 'tasks', '📷 รูปแนบ (หลักฐาน)') +
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
    attachments: window._stepAttach || [],
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
  t.steps[idx].attachments = window._stepAttach || [];
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
function openMeetingWindow(meetingId) {
  var url = location.pathname + '?meetingWindow=1&meetingId=' + encodeURIComponent(meetingId || '');
  window.open(url, '_blank');
}

function showMeetingM(eid) {
  var m = eid ? ST.getOne('meetings', eid) : {};
  // เปิดมาจากลิงก์ "รอสร้าง" ของ Task (ดู openTaskLinkCreate) — ประชุมไม่มี field ผูก Dealer โดยตรง
  // เลยเติมชื่องานเป็นหัวข้อประชุมให้ตั้งต้นแทน แก้ต่อได้
  var _prefillTitle = m.title || '';
  if (!eid && typeof _pendingLinkTaskId !== 'undefined' && _pendingLinkTaskId) {
    var _pt = ST.getOne('tasks', _pendingLinkTaskId);
    if (_pt) _prefillTitle = _pt.title;
  }
  openM(eid ? '✏️ ประชุม' : '➕ ประชุม', '' +
    ((typeof _pendingLinkGuidelineHtml === 'function') ? _pendingLinkGuidelineHtml() : '') +
    '<div class="fg"><label>หัวข้อ *</label><input type="text" id="fm_t" value="' + sanitize(_prefillTitle) + '"></div>' +
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
    '<div class="fg"><label>🔁 ประชุมประจำ (Recurring)</label><select id="fm_rec"><option value="">ไม่กำหนด</option><option value="weekly"' + (m.recurrence === 'weekly' ? ' selected' : '') + '>ทุกสัปดาห์</option><option value="biweekly"' + (m.recurrence === 'biweekly' ? ' selected' : '') + '>ทุก 2 สัปดาห์</option><option value="monthly"' + (m.recurrence === 'monthly' ? ' selected' : '') + '>ทุกเดือน</option></select></div>' +
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
    decisions: document.getElementById('fm_dec') ? document.getElementById('fm_dec').value.trim() : '',
    recurrence: document.getElementById('fm_rec') ? (document.getElementById('fm_rec').value || null) : null
  };
  if (eid) {
    ST.update('meetings', eid, data);
    closeMForce();
    go('meetingDetail', {meetingId: eid});
  } else {
    data.actions = [];
    data.sourceTaskId = (typeof _pendingLinkTaskId !== 'undefined' && _pendingLinkTaskId) || '';
    var nm = ST.add('meetings', data);
    if (typeof resolveTaskPendingLink === 'function') resolveTaskPendingLink('meeting', nm.id, nm.title);
    closeMForce();
    go('meetingDetail', {meetingId: nm.id});
    toast('💾 สร้างประชุมแล้ว');
    setTimeout(function() {
      openM('📅 สร้างประชุมสำเร็จ',
        '<div style="text-align:center;padding:8px 0">' +
        '<div style="font-size:15px;font-weight:700;margin-bottom:6px">' + sanitize(nm.title) + '</div>' +
        '<div style="font-size:13px;color:var(--text2);margin-bottom:20px">' + fD(nm.date) + (nm.time ? ' · ' + nm.time : '') + '</div>' +
        '<button class="btn bp btn-full" onclick="closeMForce();openMeetingWindow(\'' + nm.id + '\')">🪟 เปิดแท็บบันทึกการประชุม</button>' +
        '<button class="btn bo btn-full" style="margin-top:8px" onclick="closeMForce()">ปิด (ไม่เปิดแท็บ)</button>' +
        '</div>');
    }, 150);
  }
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
  window._noteAttach = (n.attachments || []).slice();
  
  // Status options
  var statusOpts = '' +
    '<option value="active"' + ((n.status || 'active') === 'active' ? ' selected' : '') + '>✅ ใช้งานอยู่</option>' +
    '<option value="expired"' + (n.status === 'expired' ? ' selected' : '') + '>⏰ หมดอายุ</option>' +
    '<option value="cancelled"' + (n.status === 'cancelled' ? ' selected' : '') + '>❌ ยกเลิกแล้ว</option>' +
    '<option value="draft"' + (n.status === 'draft' ? ' selected' : '') + '>📝 Draft</option>';

  openM(eid ? '✏️ แก้ไข Note' : '📚 เพิ่ม Note', '' +
    '<div class="fg"><label>หัวข้อ *</label><input type="text" id="fn_title" value="' + sanitize(n.title || '') + '"></div>' +
    
    '<div class="fr">' +
    '<div class="fg"><label>หมวดหมู่ <button type="button" class="btn-xs" onclick="showCfgListEditorM(\'noteCategories\',\'⚙️ จัดการหมวดหมู่ Note\', function(added){ showNoteM(\'' + (eid || '') + '\'); if(added) setTimeout(function(){var s=document.getElementById(\'fn_cat\'); if(s) s.value=added;},0); })">⚙️</button></label><select id="fn_cat">' + optionsHTML(cats, n.category || '', '-- เลือก --') + '</select></div>' +
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

    attachUploadHtml('_noteAttach', 'notes', '📷 รูปแนบ') +

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
    pinned: pinEl ? pinEl.value === '1' : false,
    attachments: window._noteAttach || []
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
    '<div class="hint" style="margin-top:5px">คอลัมน์ที่รองรับ: id, ชื่อบริษัท, SIS Code, DJI Code, Level, DJI Dealer, เซลที่ดูแล, Credit Term, Credit Limit, Target Revenue, ผู้ติดต่อ, Google Map, หมายเหตุ<br>ถ้ามี id และตรงกับข้อมูลเดิม → อัปเดต, ถ้าไม่มี id → เพิ่มใหม่</div></div>' +
    '<div id="imp_dl_preview"></div>' +
    '<button class="btn bp btn-full" onclick="importDealersExcel()" style="margin-top:8px">📥 Import</button>');
}

// field ที่ import รองรับ — ใช้ร่วมกันทั้ง preview (คำนวณ diff) และตอน import จริง กันโค้ด mapping ซ้ำสองที่
// แล้วเพิ่ม field ใหม่แล้วลืมอัปเดตอีกจุด (เคยเกิดกับ "เซลที่ดูแล" มาแล้ว — ไม่เคยอยู่ใน list นี้เลย)
var _DEALER_IMPORT_FIELDS = [
  { key: 'name',           label: 'ชื่อบริษัท',    cols: ['ชื่อบริษัท', 'name'] },
  { key: 'sisCode',        label: 'SIS Code',      cols: ['SIS Code', 'sisCode'] },
  { key: 'djiCode',        label: 'DJI Code',      cols: ['DJI Code', 'djiCode'] },
  { key: 'level',          label: 'Level',         cols: ['Level', 'level'], def: 'B' },
  { key: 'djiDealer',      label: 'DJI Dealer',    cols: ['DJI Dealer', 'djiDealer'] },
  { key: 'saleName',       label: 'เซลที่ดูแล',     cols: ['เซลที่ดูแล', 'saleName', 'Sale'] },
  { key: 'creditTerm',     label: 'Credit Term',   cols: ['Credit Term', 'creditTerm'] },
  { key: 'creditLimit',    label: 'Credit Limit',  cols: ['Credit Limit', 'creditLimit'] },
  { key: 'targetRevenue',  label: 'Target Revenue',cols: ['Target Revenue', 'targetRevenue'] },
  { key: 'contact',        label: 'ผู้ติดต่อ',      cols: ['ผู้ติดต่อ', 'contact'] },
  { key: 'googleMap',      label: 'Google Map',    cols: ['Google Map', 'googleMap'] },
  { key: 'notes',          label: 'หมายเหตุ',       cols: ['หมายเหตุ', 'notes'] },
  { key: 'paymentCondition', label: 'Payment Condition', cols: ['Payment Condition', 'paymentCondition'] }
];
function _dealerRowToData(r) {
  var data = {};
  _DEALER_IMPORT_FIELDS.forEach(function(f) {
    var v = '';
    for (var i = 0; i < f.cols.length; i++) { if (r[f.cols[i]]) { v = r[f.cols[i]]; break; } }
    data[f.key] = String(v || f.def || '').trim();
  });
  return data;
}
// เทียบค่าเดิม vs ค่าใหม่จากไฟล์ ทีละ field — คืนเฉพาะ field ที่ต่างกันจริง (สำหรับโชว์ diff ใน preview)
function _dealerImportDiff(existing, data) {
  var diffs = [];
  _DEALER_IMPORT_FIELDS.forEach(function(f) {
    var oldV = (existing[f.key] || '').toString().trim();
    var newV = data[f.key] || '';
    if (f.key === 'level' && !newV) return; // ไม่ได้ใส่ Level มา ไม่นับเป็นการเปลี่ยน (data.level default เป็น B เสมอ)
    if (oldV !== newV) diffs.push({ label: f.label, old: oldV, newVal: newV });
  });
  return diffs;
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

    var rowMeta = rows.map(function(r) {
      var data = _dealerRowToData(r);
      if (!data.name) return { skip: true, data: data };
      var id = String(r['id'] || '').trim();
      var existing = id ? ST.getOne('dealers', id) : null;
      var diff = existing ? _dealerImportDiff(existing, data) : [];
      var state = !existing ? 'new' : (diff.length ? 'changed' : 'same');
      return { data: data, id: id, existing: existing, state: state, diff: diff };
    });
    window._dealerImportPending = rowMeta;

    var h = '<div style="margin-top:8px">';
    var counts = { new: 0, changed: 0, same: 0, skip: 0 };
    rowMeta.forEach(function(m) { counts[m.skip ? 'skip' : m.state]++; });
    h += '<div style="font-size:12px;color:#94a3b8;background:#0f172a;border-radius:6px;padding:8px;margin-bottom:8px">' +
      '✅ พบข้อมูล <strong>' + rows.length + '</strong> แถว — ' +
      '<strong style="color:#22c55e">➕ ' + counts.new + ' ใหม่</strong> · ' +
      '<strong style="color:#f59e0b">✏️ ' + counts.changed + ' เปลี่ยน</strong> · ' +
      '<span style="color:#64748b">⏭ ' + counts.same + ' เหมือนเดิม</span>' +
      (counts.skip ? ' · <span style="color:#ef4444">⚠️ ' + counts.skip + ' ไม่มีชื่อบริษัท (ข้าม)</span>' : '') +
      '</div>';

    h += '<div style="max-height:340px;overflow-y:auto;border:1px solid #334155;border-radius:8px">';
    rowMeta.forEach(function(m, i) {
      if (m.skip) {
        h += '<div style="padding:6px 10px;border-bottom:1px solid #1e293b;font-size:11px;color:#ef4444">แถวที่ ' + (i + 1) + ': ไม่มีชื่อบริษัท — จะถูกข้าม</div>';
        return;
      }
      var badge = m.state === 'new' ? '<span style="color:#22c55e;font-size:11px;font-weight:700">➕ ใหม่</span>' :
        m.state === 'changed' ? '<span style="color:#f59e0b;font-size:11px;font-weight:700">✏️ เปลี่ยน</span>' :
        '<span style="color:#64748b;font-size:11px;font-weight:700">⏭ เหมือนเดิม</span>';
      var defAct = m.state === 'same' ? 'skip' : (m.state === 'new' ? 'add' : 'update');
      h += '<div style="padding:8px 10px;border-bottom:1px solid #1e293b">';
      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      h += '<span style="flex:1;min-width:120px;font-size:12px;font-weight:600">' + sanitize(m.data.name) + '</span>';
      h += badge;
      if (m.state === 'changed') h += ' <button type="button" onclick="_dealerImpToggleDiff(' + i + ')" id="dImpDiffBtn_' + i + '" style="font-size:10px;padding:1px 6px;border:1px solid #334155;border-radius:4px;background:#0f172a;cursor:pointer;color:#94a3b8">🔍 ' + m.diff.length + '</button>';
      h += '<select id="dImpAct_' + i + '" style="font-size:11px;padding:2px 5px;border:1px solid #334155;border-radius:4px;background:#0f172a;color:#e2e8f0">' +
        '<option value="add"' + (defAct === 'add' ? ' selected' : '') + '>➕ เพิ่มใหม่</option>' +
        (m.existing ? '<option value="update"' + (defAct === 'update' ? ' selected' : '') + '>✏️ อัปเดต</option>' : '') +
        '<option value="skip"' + (defAct === 'skip' ? ' selected' : '') + '>⏭ ข้าม</option>' +
        '</select>';
      h += '</div>';
      if (m.state === 'changed' && m.diff.length) {
        h += '<table id="dImpDiffRow_' + i + '" style="display:none;width:100%;margin-top:6px;font-size:10.5px;border-collapse:collapse">';
        m.diff.forEach(function(d) {
          h += '<tr><td style="padding:2px 6px;color:#64748b;white-space:nowrap">' + sanitize(d.label) + '</td>' +
            '<td style="padding:2px 6px;color:#ef4444">' + sanitize(d.old || '(ว่าง)') + '</td>' +
            '<td style="padding:2px 6px;color:#94a3b8">→</td>' +
            '<td style="padding:2px 6px;color:#22c55e">' + sanitize(d.newVal || '(ว่าง)') + '</td></tr>';
        });
        h += '</table>';
      }
      h += '</div>';
    });
    h += '</div></div>';
    prev.innerHTML = h;
  };
  reader.readAsArrayBuffer(file);
}
function _dealerImpToggleDiff(i) {
  var row = document.getElementById('dImpDiffRow_' + i);
  if (row) row.style.display = row.style.display === 'none' ? 'table' : 'none';
}

function importDealersExcel() {
  var rowMeta = window._dealerImportPending;
  if (!rowMeta) return alert('เลือกไฟล์ก่อน (รอ preview ขึ้นก่อนกด Import)');
  var added = 0, updated = 0, skipped = 0;
  rowMeta.forEach(function(m, i) {
    if (m.skip) { skipped++; return; }
    var actEl = document.getElementById('dImpAct_' + i);
    var action = actEl ? actEl.value : (m.state === 'same' ? 'skip' : (m.state === 'new' ? 'add' : 'update'));
    if (action === 'skip') { skipped++; return; }
    var dealerId;
    if (action === 'update' && m.existing) {
      ST.update('dealers', m.id, m.data);
      dealerId = m.id;
      updated++;
    } else {
      dealerId = ST.add('dealers', m.data).id;
      added++;
    }
    // ผูก "เซลที่ดูแล" จาก Excel กลับเข้า Pipeline ของ Dealer นี้ทุกโครงการเหมือนตอนแก้จากฟอร์ม Dealer ตรงๆ
    // (ดู cascadeDealerSaleNameToPipelines ใน views-dealer.js) — ข้ามถ้าแถวนี้ไม่ได้ระบุเซลมาเลย กัน blank ทับของเดิม
    if (m.data.saleName && typeof cascadeDealerSaleNameToPipelines === 'function') cascadeDealerSaleNameToPipelines(dealerId, m.data.saleName);
  });
  window._dealerImportPending = null;
  closeMForce();
  toast('📥 เพิ่ม ' + added + ' อัปเดต ' + updated + (skipped ? ' ข้าม ' + skipped : '') + ' Dealer');
  render();
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

    // ข้ามถ้าเจอ Pipeline ของ Dealer เดิม วันที่ลงทะเบียน+ยอด forecast ตรงกันเป๊ะ (กัน import ซ้ำ)
    var existingPipes = ST.pipelineByDealer(dealerId);
    var isDuplicate = false;
    var regDate = (item.registerDate || '').trim();
    var fcAmt = parseFloat(item.forecastAmount) || 0;
    for (var k = 0; k < existingPipes.length; k++) {
      var ep = existingPipes[k];
      if (regDate && ep.registerDate === regDate && (parseFloat(ep.forecastAmount) || 0) === fcAmt && fcAmt > 0) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) {
      console.log('⚠️ Skip duplicate: ' + regDate + ' ' + fcAmt + ' - ' + (item.projectName || '').substr(0, 40));
      skipped++;
      continue;
    }

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
      status: item.status || 'initial',
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
  return 'initial';
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