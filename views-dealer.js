var dealerPipeViewMode = 'list'; // 'list' หรือ 'sheet' — สลับมุมมอง Pipeline tab ของ Dealer
var dealerPipeSearch = '';
var _dealerPipeSearchTimer = null;
// หน่วงเวลาก่อน re-render เหมือนช่องค้นหา Pipeline หลัก — กันปัญหาพิมพ์ได้ทีละตัวเพราะ render() วาด input ใหม่ทุกครั้ง
function dealerPipeSearchInput(v) {
  dealerPipeSearch = v;
  clearTimeout(_dealerPipeSearchTimer);
  _dealerPipeSearchTimer = setTimeout(function() { render(); }, 350);
}
var dealerPipeSort = 'updated_desc';
var dealerPipeDisplayFlt = 'all'; // 'all' | 'show' | 'hide' — กรองตาม sheetDisplay (DISPLAY Hide/Show)
var dealerPipeHideArchived = true; // ซ่อนโครงการ Archived (ดู pipeIsArchived) จากรายการโดย default เหมือนหน้า Pipeline Board
function toggleDealerPipeHideArchived() { dealerPipeHideArchived = !dealerPipeHideArchived; render(); }
var dealerPipeSelectMode = false;
var dealerPipeSelected = {};
var _dealerPipeVisibleIds = [];
var dealerPipeCardCols = 1; // 1 หรือ 2 — จำนวนคอลัมน์การ์ดในแท็บ Pipeline ของ Dealer (เหมือน pipeCardCols เมนู Pipeline หลัก)
var dealerPipeStatusFlt = {}; // multi-select: {statusId: true, ...} — ว่าง = แสดงทุกสถานะ (เหมือน pipeFlt เมนู Pipeline หลัก)
var dealerPipeBidMonthFlt = {}; // multi-select: {monthIdx(0-11): true, ...} — ว่าง = ทุกเดือน กรองจาก biddingDate
function toggleDealerPipeStatus(k) { if (dealerPipeStatusFlt[k]) delete dealerPipeStatusFlt[k]; else dealerPipeStatusFlt[k] = true; render(); }
function clearDealerPipeStatusFlt() { dealerPipeStatusFlt = {}; render(); }
function toggleDealerPipeBidMonth(idx) { if (dealerPipeBidMonthFlt[idx]) delete dealerPipeBidMonthFlt[idx]; else dealerPipeBidMonthFlt[idx] = true; render(); }
function clearDealerPipeBidMonthFlt() { dealerPipeBidMonthFlt = {}; render(); }

// ================================================================
// JWT TOKEN FUNCTIONS (แบบไม่ต้องใช้ library)
// ================================================================

// Base64URL encode
function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// สร้าง token (ไม่ต้องใช้ library)
function generateSimpleToken(dealerId, expiryDays) {
  var header = { alg: 'HS256', typ: 'JWT' };
  var exp = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);
  var payload = { 
    dealerId: dealerId, 
    exp: exp, 
    iat: Math.floor(Date.now() / 1000), 
    iss: 'dji-sales-assistant' 
  };
  
  var encodedHeader = base64url(JSON.stringify(header));
  var encodedPayload = base64url(JSON.stringify(payload));
  
  var secret = localStorage.getItem('jwt_secret');
  if (!secret) {
    secret = 'dji-sales-secret-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('jwt_secret', secret);
  }
  
  var signatureInput = encodedHeader + '.' + encodedPayload;
  var signature = base64url(signatureInput + secret);
  
  return encodedHeader + '.' + encodedPayload + '.' + signature;
}

// ตรวจสอบ token (ไม่ต้องใช้ library)
function verifySimpleToken(token) {
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'รูปแบบ token ไม่ถูกต้อง' };
    
    var payload = JSON.parse(atob(parts[1]));
    
    if (payload.exp < Date.now() / 1000) {
      return { valid: false, error: 'ลิงก์หมดอายุแล้ว' };
    }
    
    var secret = localStorage.getItem('jwt_secret');
    var expectedSignature = base64url(parts[0] + '.' + parts[1] + secret);
    
    if (parts[2] !== expectedSignature) {
      return { valid: false, error: 'token ไม่ถูกต้อง' };
    }
    
    return { valid: true, dealerId: payload.dealerId };
    
  } catch(e) {
    return { valid: false, error: e.message };
  }
}

var generateCustomerToken = generateSimpleToken;
var verifyCustomerToken = verifySimpleToken;

function getConfig() {
  try {
    var saved = localStorage.getItem('v7_config');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return { levelRequirements: { A: { option1Models: [], option2Models: [] } } };
}
// ================================================================
// SAFE MODEL OPTIONS (ใช้ products module ถ้ามี)
// ================================================================

function safeModelOptions(selected) {
  if (typeof window.modelOptionsNew === 'function') {
    return window.modelOptionsNew(selected);
  }
  // Fallback ถ้า app.js ยังไม่โหลด — ดึงตรงจาก Products module (v7_products) ไม่ใช่ config.models (list default) อีกต่อไป
  var products = (typeof Products !== 'undefined' && Products.getAll) ? Products.getAll() : [];
  var html = '<option value="">-- เลือก Model --</option>';
  for (var i = 0; i < products.length; i++) {
    var m = products[i];
    if (!m || !m.name) continue;
    var price = Number(m.price) || 0;
    var label = m.name + (price > 0 ? ' (฿' + fmtMoney(price) + ')' : '');
    html += '<option value="' + sanitize(m.name) + '"' + (selected === m.name ? ' selected' : '') + '>' + sanitize(label) + '</option>';
  }
  return html;
}

// ================================================================
// JWT TOKEN WITH FIREBASE REGISTRY
// ================================================================

// JWT Secret (เก็บใน localStorage)
function getJWTSecret() {
  var saved = localStorage.getItem('jwt_secret');
  if (!saved) {
    saved = 'dji-sales-secret-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('jwt_secret', saved);
  }
  return new TextEncoder().encode(saved);
}
var JWT_SECRET = getJWTSecret();

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCustomerToken(dealerId, expiryDays) {
  var exp = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);
  var payload = { dealerId: dealerId, exp: exp, iat: Math.floor(Date.now() / 1000), iss: 'dji-sales-assistant' };
  var encodedHeader = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  var encodedPayload = base64url(JSON.stringify(payload));
  var signatureInput = encodedHeader + '.' + encodedPayload;
  var signature = base64url(signatureInput + new TextDecoder().decode(JWT_SECRET));
  return encodedHeader + '.' + encodedPayload + '.' + signature;
}

async function saveTokenToFirebase(token, dealerId, expiryDays, createdBy) {
  var payload = JSON.parse(atob(token.split('.')[1]));
  var tokenData = {
    token: token,
    dealerId: dealerId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    expiresAt: new Date(payload.exp * 1000),
    expiryDays: expiryDays,
    createdBy: createdBy || (typeof CURRENT_USER !== 'undefined' && CURRENT_USER ? CURRENT_USER.displayName : 'system'),
    isActive: true,
    useCount: 0
  };
  var docRef = await db.collection('tokenRegistry').add(tokenData);
  return { id: docRef.id, ...tokenData };
}

async function revokeTokenFirebase(tokenId) {
  await db.collection('tokenRegistry').doc(tokenId).update({
    isActive: false,
    revokedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function revokeAllTokensForDealerFirebase(dealerId) {
  var snapshot = await db.collection('tokenRegistry')
    .where('dealerId', '==', dealerId)
    .where('isActive', '==', true)
    .get();
  var batch = db.batch();
  snapshot.forEach(function(doc) {
    batch.update(doc.ref, { isActive: false, revokedAt: firebase.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();
  return snapshot.size;
}

async function getTokensForDealer(dealerId) {
  var snapshot = await db.collection('tokenRegistry')
    .where('dealerId', '==', dealerId)
    .orderBy('createdAt', 'desc')
    .get();
  var tokens = [];
  snapshot.forEach(function(doc) {
    var data = doc.data();
    tokens.push({ id: doc.id, ...data });
  });
  return tokens;
}

async function createTokenAndSave(dealerId, expiryDays, createdBy) {
  var token = await generateCustomerToken(dealerId, expiryDays);
  var saved = await saveTokenToFirebase(token, dealerId, expiryDays, createdBy);
  return { token: token, tokenId: saved.id };
}

// ================================================================
// SHOW TOKEN MODAL & CREATE LINK (PIN ไม่ติดลิงก์ - ต้องใส่เอง)
// ================================================================

async function loadExistingTokens(dealerId) {
  var container = document.getElementById('existingTokenList');
  if (!container) return;
  
  var baseUrl = window.location.href.split('?')[0].split('#')[0];
  var basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  
  // ดึง PIN ปัจจุบันจาก Firebase
  var currentPin = '';
  try {
    var pinDoc = await db.collection('dealerUpdates').doc(dealerId).get();
    if (pinDoc.exists && pinDoc.data().pin) currentPin = pinDoc.data().pin;
  } catch(e) {}
  
  // ลิงก์ปัจจุบัน (ไม่มี PIN ในลิงก์)
  var currentUrl = basePath + 'client-view.html?dealerId=' + encodeURIComponent(dealerId);
  
  var pinStatus = currentPin ? `🔒 มี PIN (${currentPin}) - ลูกค้าต้องใส่รหัส` : '🔓 ไม่มี PIN - เข้าได้เลย';
  
  container.innerHTML = `
    <div class="card" style="margin-bottom:8px;padding:10px;background:rgba(34,197,94,0.05)">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px">
        <span style="font-weight:700;color:#22c55e">✅ ลิงก์ปัจจุบัน</span>
        <span style="font-size:10px;color:var(--text2)">${pinStatus}</span>
      </div>
      <div style="font-size:10px;word-break:break-all;background:var(--bg);padding:6px;border-radius:6px;margin-bottom:6px">${currentUrl}</div>
      <div style="display:flex;gap:6px">
        <button class="btn bsm bp" onclick="copyToClipboard('${currentUrl.replace(/'/g, "\\'")}')">📋 คัดลอก</button>
        <button class="btn bsm bd" onclick="window.open('${currentUrl}', '_blank')">🔗 ทดสอบเปิด</button>
      </div>
      ${currentPin ? `<div class="hint" style="margin-top:6px;font-size:10px">💡 PIN: <strong>${currentPin}</strong> (แจ้งลูกค้าแยกช่องทาง)</div>` : ''}
    </div>
  `;
}
async function createTokenAndLink(dealerId) {
  var expiryDays = parseInt(document.getElementById('tokenExpiryDays').value);
  var pin = document.getElementById('tokenPin').value.trim();
  var note = document.getElementById('tokenNote').value.trim();
  var createdBy = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.displayName : 'Siwawong';
  
  // บันทึก PIN ลง dealerUpdates (Firebase)
  if (pin) {
    await db.collection('dealerUpdates').doc(dealerId).set({ 
      pin: pin,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } else {
    await db.collection('dealerUpdates').doc(dealerId).set({ 
      pin: '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
  
  var baseUrl = window.location.href.split('?')[0].split('#')[0];
  var basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  // ✅ Audit Log
  var dealer = ST.getOne('dealers', dealerId);
  addAuditLog(
    'create_link',
    'link',
    dealerId,
    'ลิงก์สำหรับ ' + (dealer ? dealer.name : dealerId),
    dealerId,
    dealer ? dealer.name : '',
    { pin: pin || '(ไม่มี)', createdBy: createdBy }
  );
  
  // ✅ สร้างลิงก์แบบไม่มี PIN (ลูกค้าต้องพิมพ์เอาเอง)
  var fullUrl = basePath + 'client-view.html?dealerId=' + encodeURIComponent(dealerId);
  
  var expiryDate = addD(_td(), expiryDays);
  
  var pinMessage = pin ? `<div style="margin-top:8px;padding:8px;background:#f59e0b20;border-radius:8px;border-left:3px solid #f59e0b">
    🔒 <strong>PIN สำหรับลูกค้า:</strong> <span style="font-size:20px;font-weight:700;letter-spacing:2px">${pin}</span>
    <div class="hint" style="color:#f59e0b">⚠️ สำคัญ! แจ้ง PIN แยกช่องทาง (LINE, โทร, Email) ห้ามใส่ในลิงก์เด็ดขาด</div>
    <div class="hint">💡 ลูกค้าจะต้องพิมพ์ PIN นี้เมื่อเปิดลิงก์ จึงจะเห็นข้อมูล</div>
  </div>` : '<div class="hint">ℹ️ ไม่ได้ตั้ง PIN ลูกค้าเข้าดูข้อมูลได้เลย (ไม่ต้องใส่รหัส)</div>';
  
  openM('✅ สร้างลิงก์เรียบร้อย', `
    <div class="form-group">
      <label>📋 ลิงก์สำหรับลูกค้า (ไม่มี PIN ในลิงก์)</label>
      <div style="background:var(--bg);padding:12px;border-radius:8px;word-break:break-all;font-family:monospace;font-size:11px">${fullUrl}</div>
<div class="form-row">
  <div><label>📅 วันที่สร้าง</label><div>${_td()}</div></div>
  <div><label>👤 สร้างโดย</label><div>${createdBy}</div></div>
</div>
<div class="hint" style="margin-top:8px;font-size:11px;color:var(--text2)">
  💡 ลิงก์นี้ไม่มีวันหมดอายุ (ใช้งานได้ตลอดไป)
</div>
    ${pinMessage}
    <div class="bg" style="margin-top:12px">
      <button class="btn bp" onclick="copyToClipboard('${fullUrl}')">📋 คัดลอกลิงก์</button>
      <button class="btn bo" onclick="showDealerTokenModal('${dealerId}')">↩️ กลับ</button>
    </div>
  `);
}

async function showDealerTokenModal(dealerId) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;
  
  var currentPin = '';
  try {
    var pinDoc = await db.collection('dealerUpdates').doc(dealerId).get();
    if (pinDoc.exists && pinDoc.data().pin) currentPin = pinDoc.data().pin;
  } catch(e) {
    console.warn('Error loading PIN:', e);
  }
  
  var html = `
    <div style="max-width:500px">
      <div class="form-group"><label>🏪 Dealer</label><div><strong>${sanitize(dealer.name)}</strong></div></div>
      <div class="form-group"><label>⏰ วันหมดอายุ</label>
        <select id="tokenExpiryDays" class="form-control">
          <option value="7">7 วัน</option>
          <option value="14">14 วัน</option>
          <option value="30" selected>30 วัน (แนะนำ)</option>
          <option value="60">60 วัน</option>
          <option value="90">90 วัน</option>
          <option value="180">180 วัน</option>
          <option value="365">1 ปี (ถาวร)</option>
        </select>
      </div>
      <div class="form-group"><label>🔒 PIN (ไม่บังคับ)</label>
        <input type="password" id="tokenPin" class="form-control" value="${currentPin}" placeholder="กรอกรหัสผ่าน 4-6 หลัก" maxlength="6">
        <div class="hint">💡 ถ้าใส่ PIN ลูกค้าจะต้องกรอกรหัสผ่านเมื่อเปิดลิงก์ (PIN จะไม่ติดไปในลิงก์)</div>
      </div>
      <div class="form-group"><label>📝 หมายเหตุ</label>
        <input type="text" id="tokenNote" class="form-control" placeholder="เช่น ส่งให้คุณสมชาย">
      </div>
      <div class="bg" style="display:flex;gap:8px;margin-top:8px">
        <button class="btn bp" onclick="createTokenAndLink('${dealerId}')" style="flex:1">🔗 สร้างลิงก์</button>
        <button class="btn bd" onclick="revokeDealerPin('${dealerId}')" style="flex:1">🗑️ ล้าง PIN</button>
      </div>
      <div id="tokenListArea" style="margin-top:16px">
        <div style="font-size:12px;color:var(--text2);margin-bottom:6px">📋 ลิงก์ที่สร้างแล้ว:</div>
        <div id="existingTokenList">กำลังโหลด...</div>
      </div>
    </div>
  `;
  openM('🔗 สร้างลิงก์ปลอดภัยสำหรับ ' + dealer.name, html);
  loadExistingTokens(dealerId);
}

async function revokeDealerPin(dealerId) {
  if (!confirm('⚠️ ล้าง PIN ของ Dealer นี้? ลิงก์เดิมจะใช้งานไม่ได้อีก (ลูกค้าจะไม่ต้องใส่ PIN)')) return;
  
  try {
    await db.collection('dealerUpdates').doc(dealerId).set({ 
      pin: '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    toast('🗑️ ล้าง PIN แล้ว');
    closeModal();
    showDealerTokenModal(dealerId);
  } catch(err) {
    toast('❌ เกิดข้อผิดพลาด: ' + err.message);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  toast('📋 คัดลอกแล้ว');
  closeModal();
}

// ================================================================
// DEALER LIST
// ================================================================
let dealerFilter = 'all';
let dealerListView = 'card'; // 'card' หรือ 'table' — เหมือน pipeView ของเมนู Pipeline หลัก
// กรองตาม "เซลที่ดูแล" — multi-select ({saleName: true, ...}) ว่าง = ไม่กรอง (โชว์ทุกคน) แยกจาก dealerFilter
// (Level) เดิม ใช้ร่วมกันได้ (AND) ไม่ทับกัน — dealer ที่ยังไม่มี saleName เลยถูกจัดเข้ากลุ่ม "(ไม่ระบุ)"
let dealerSaleFilter = {};
const DEALER_SALE_UNSET = '(ไม่ระบุ)';
// เลือกหลายรายการ (bulk select) — เดิมหน้า Dealer list ไม่มี bulk action เลยสักอย่าง ทั้งที่หน้า Pipeline มีครบ
// (select all/เปลี่ยนสถานะทีเดียว/export/ลบ) เจอจากการสแกน UX 2026-08-23 — pattern ตัวแปร/ฟังก์ชันเลียนแบบ
// pipeSelectMode/pipeSelected/_pipeVisibleIds ใน views-pipeline.js ให้เหมือนกันทุกหน้า
var dealerSelectMode = false;
var dealerSelected = {};
var _dealerVisibleIds = [];
function toggleDealerSaleFilter(name) {
  if (dealerSaleFilter[name]) delete dealerSaleFilter[name];
  else dealerSaleFilter[name] = true;
  render();
}
function clearDealerSaleFilter() { dealerSaleFilter = {}; render(); }
let dealerUrgentOpen = localStorage.getItem('dealerUrgentOpen') !== '0';
let dealerVisitOverdueFlt = false; // true = กรองเฉพาะ Dealer ที่ยังไม่ได้ Visit นานเกินกำหนด
const DEALER_VISIT_OVERDUE_DAYS = 60;

// แถบสรุป "Dealer ยังไม่ได้ Visit นานเกิน" — พับ/ขยายได้ (จำสถานะไว้), กดเพื่อกรองรายชื่อด้านล่าง
function _dealerUrgentBarHtml(overdueCount) {
  if (!overdueCount) return '';
  const hint = !dealerUrgentOpen ? overdueCount + ' ราย' : '';
  return `
  <div class="pipe-sec-hdr" onclick="toggleDealerUrgentBar()" style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;margin-bottom:6px;border-bottom:1px solid var(--border);cursor:pointer">
    <span style="font-size:11px;font-weight:500;color:var(--text2);display:flex;align-items:center;gap:6px">⏰ ยังไม่ได้ Visit นานเกิน ${DEALER_VISIT_OVERDUE_DAYS} วัน
      ${hint ? '<span style="font-size:10px;font-weight:400;color:var(--accent);background:var(--bg2);padding:1px 6px;border-radius:4px;border:1px solid var(--border)">' + hint + '</span>' : ''}
    </span>
    <span id="dealerUrgentBtn" style="font-size:10px;color:var(--text2);background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:1px 8px">${dealerUrgentOpen ? '▲ ซ่อน' : '▼ แสดง'}</span>
  </div>
  <div id="dealerUrgentWrap" style="${dealerUrgentOpen ? '' : 'display:none'};margin-bottom:10px">
    <div onclick="dealerVisitOverdueFlt=!dealerVisitOverdueFlt;render()" style="cursor:pointer;background:${dealerVisitOverdueFlt ? '#ef444418' : 'var(--bg2)'};border:1px solid ${dealerVisitOverdueFlt ? '#ef4444' : 'var(--border)'};border-radius:8px;padding:8px 10px;max-width:220px">
      <div style="font-size:11px;color:#ef4444">Dealer ที่เกินกำหนด Visit</div>
      <div style="font-size:20px;font-weight:700;color:#ef4444">${overdueCount} ราย</div>
    </div>
  </div>`;
}

function toggleDealerUrgentBar() {
  dealerUrgentOpen = !dealerUrgentOpen;
  localStorage.setItem('dealerUrgentOpen', dealerUrgentOpen ? '1' : '0');
  const wrap = document.getElementById('dealerUrgentWrap');
  if (wrap) wrap.style.display = dealerUrgentOpen ? '' : 'none';
  const btn = document.getElementById('dealerUrgentBtn');
  if (btn) btn.textContent = dealerUrgentOpen ? '▲ ซ่อน' : '▼ แสดง';
}

// เมนู "📤 Export ▾" หน้า Dealer list — เดิม 5 ปุ่ม copy/export เรียงแถวเดียวกับ view-toggle/bulk-select
// (2026-08-24 UI audit ข้อ 4) รวมเป็นเมนูเดียว ใช้ toggleOvMenu()/closeOvMenu() กลางตัวเดียวกับ Pipeline
function _dealerExportMenuHtml() {
  return (
    '<button onclick="closeOvMenu();copyDealerSummary()">📋 Copy TSV</button>' +
    (dealerListView === 'table' ? '<button onclick="closeOvMenu();copyDealerTableAsWord()">📋 Copy (วางลง Word)</button>' : '') +
    '<button onclick="closeOvMenu();dlDealerCSV()">📤 CSV</button>' +
    '<button onclick="closeOvMenu();exportDealersExcel()">📊 Excel</button>' +
    '<button onclick="closeOvMenu();showDealerEmailPickerM()">📧 Email</button>'
  );
}

function rDealers(el) {
  document.getElementById('pgT').textContent = '🏪 Dealer';
  // scopedDealers() = ขอบเขตที่เลือกไว้จาก picker บน topbar (default: เฉพาะของฉัน) — chip "เซลที่ดูแล" ด้านล่าง
  // เป็นตัวกรองซ้อนอีกชั้นภายในขอบเขตนี้ (เผื่อเลือก scope เป็นทั้งหมด/หลายคน แล้วอยากเจาะแค่บางคนชั่วคราว)
  // เรียกครั้งเดียวเก็บไว้ — scopedDealers() ข้างในเรียก getConfig() (deep-clone) ทุกครั้ง เดิมเรียกซ้ำ 3 รอบ
  // ในฟังก์ชันนี้ทำให้หน้า Dealers ช้าลงชัดเจนเวลามี Dealer เยอะ
  const _scopedDealersOnce = scopedDealers();
  let dealers = _scopedDealersOnce;

  if (dealerFilter !== 'all') {
    if (dealerFilter === 'authorized') dealers = dealers.filter(d => ['S','A','B'].includes(d.level));
    else if (dealerFilter === 'other') dealers = dealers.filter(d => !['S','A','B'].includes(d.level));
    else dealers = dealers.filter(d => d.level === dealerFilter);
  }

  // ตัวเลือก "เซลที่ดูแล" คำนวณจาก Dealer ในขอบเขตปัจจุบัน (ไม่ใช่แค่หลังกรอง Level) กันตัวเลือกหายไปตอนสลับ Level filter
  const saleNameCounts = {};
  _scopedDealersOnce.forEach(d => {
    const key = d.saleName || DEALER_SALE_UNSET;
    saleNameCounts[key] = (saleNameCounts[key] || 0) + 1;
  });
  const saleNameOptions = Object.keys(saleNameCounts).sort((a, b) => a === DEALER_SALE_UNSET ? 1 : b === DEALER_SALE_UNSET ? -1 : a.localeCompare(b, 'th'));
  const saleFilterActive = Object.keys(dealerSaleFilter).length > 0;
  if (saleFilterActive) dealers = dealers.filter(d => dealerSaleFilter[d.saleName || DEALER_SALE_UNSET]);

  const overdueCount = _scopedDealersOnce.filter(d => {
    const lvd = ST.getLastVisitDays(d.id);
    return lvd === null || lvd > DEALER_VISIT_OVERDUE_DAYS;
  }).length;

  if (dealerVisitOverdueFlt) {
    dealers = dealers.filter(d => {
      const lvd = ST.getLastVisitDays(d.id);
      return lvd === null || lvd > DEALER_VISIT_OVERDUE_DAYS;
    });
  }

  // getConfig() ครั้งเดียวก่อน map — calcHealthScore() เดิมเรียก getConfig() (deep-clone config ทั้งก้อน)
  // เองข้างในทุก Dealer พบว่าเป็นคอขวดหลักของหน้านี้เมื่อมี Dealer เยอะ (pattern เดียวกับที่แก้ใน Pipeline)
  const _dlCfg = getConfig();
  // buildHealthScoreIndexes() (app.js) — index pipelines-by-dealer/logs-by-pipe ล่วงหน้ารอบเดียว กัน
  // calcHealthScore เรียก ST.pipelineByDealer()/ST.pipeLogsByPipe() (filter() ทั้ง array ใหม่ทุกครั้ง) ซ้ำ
  // ต่อ Dealer/Pipe — O(dealers×pipelines) เดิม คือคอขวดหลักที่ทำให้หน้านี้ช้าตอน Dealer เยอะ
  const _dlIdx = buildHealthScoreIndexes();
  dealers = dealers.map(d => ({...d, _health: calcHealthScore(d.id, _dlCfg, _dlIdx.pipesByDealer[d.id]||[], _dlIdx.logsByPipe)}))
    .sort((a, b) => {
      const lOrder = {S:0, A:1, B:2};
      const la = lOrder[a.level] ?? 3, lb = lOrder[b.level] ?? 3;
      if (la !== lb) return la - lb;
      return a._health.score - b._health.score;
    });

  const counts = {
    all: ST.count('dealers'),
    S: ST.count('dealers', d => d.level === 'S'),
    A: ST.count('dealers', d => d.level === 'A'),
    B: ST.count('dealers', d => d.level === 'B'),
    other: ST.count('dealers', d => !['S','A','B'].includes(d.level))
  };

  el.innerHTML = `
  ${_dealerUrgentBarHtml(overdueCount)}

  <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
    <input type="text" id="dSrc" placeholder="🔍 ค้นหา Dealer..." style="flex:1;min-width:140px" oninput="filterDealerList()" autocomplete="off">
    <button class="btn bp" onclick="showDealerM()">➕ เพิ่ม Dealer</button>
    <button class="btn bo" onclick="showImportDealerM()">📥 Import</button>
  </div>

  <div class="ftabs">
    <div class="ftab ${dealerFilter==='all'?'act':''}" onclick="dealerFilter='all';render()">ทั้งหมด (${counts.all})</div>
    <div class="ftab ${dealerFilter==='S'?'act':''}" onclick="dealerFilter='S';render()">S (${counts.S})</div>
    <div class="ftab ${dealerFilter==='A'?'act':''}" onclick="dealerFilter='A';render()">A (${counts.A})</div>
    <div class="ftab ${dealerFilter==='B'?'act':''}" onclick="dealerFilter='B';render()">B (${counts.B})</div>
    <div class="ftab ${dealerFilter==='other'?'act':''}" onclick="dealerFilter='other';render()">Other (${counts.other})</div>
  </div>

  ${saleNameOptions.length > 1 ? `
  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
    <span style="font-size:11px;color:var(--text2);flex-shrink:0">🧑‍💼 เซลที่ดูแล</span>
    ${saleNameOptions.map(name => `<span onclick="toggleDealerSaleFilter('${name.replace(/'/g,"\\'")}')" style="font-size:11px;padding:4px 10px;border-radius:999px;cursor:pointer;border:1px solid ${dealerSaleFilter[name] ? 'var(--accent)' : 'var(--border)'};background:${dealerSaleFilter[name] ? 'var(--accent)' : 'var(--bg2)'};color:${dealerSaleFilter[name] ? '#fff' : 'var(--text2)'}">${sanitize(name)} (${saleNameCounts[name]})</span>`).join('')}
    ${saleFilterActive ? `<span onclick="clearDealerSaleFilter()" style="font-size:11px;color:var(--accent);cursor:pointer">✕ ล้างตัวกรอง</span>` : ''}
  </div>` : ''}

  <div class="bg" style="margin-bottom:8px;align-items:center">
    ${typeof _smartFilterChipHtml === 'function' ? _smartFilterChipHtml('low_health') : ''}
    <div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <button class="btn-xs" style="border-radius:0;${dealerListView==='card'?'background:var(--accent);color:#fff':''}" onclick="dealerListView='card';render()">🗂 การ์ด</button>
      <button class="btn-xs" style="border-radius:0;${dealerListView==='table'?'background:var(--accent);color:#fff':''}" onclick="dealerListView='table';render()">📊 ตาราง</button>
    </div>
    <button class="btn bsm bo ov-trigger" onclick="event.stopPropagation();toggleOvMenu(this, _dealerExportMenuHtml())">📤 Export ▾</button>
    <button class="btn bsm ${dealerSelectMode?'bd':'bo'}" onclick="toggleDealerSelectMode()">☑️ ${dealerSelectMode?'ยกเลิก':'เลือกหลายรายการ'}</button>
  </div>

  ${dealers.length ? '' : '<div class="empty"><div class="icon">🏪</div><p>ยังไม่มี Dealer<br><button class="btn bp" onclick="showDealerM()" style="margin-top:6px">➕ เพิ่ม Dealer</button></p></div>'}
  ${dealers.length && dealerListView === 'table' ? '<div id="dTableWrap">' + _dealerTableHtml(dealers) + '</div>' :
    dealers.length ? '<div class="card-grid" id="dGrid">' + (function() { _dealerVisibleIds = dealers.map(function(d) { return d.id; }); return dealers.map(d => dealerCardHTML(d, d._health)).join(''); })() + '</div>' : ''}
  ${_dealerSelBarHtml()}`;
}

// ================================================================
// DEALER — มุมมองตาราง (ทางเลือกจากการ์ด) — คอลัมน์ตามที่ตกลงกันไว้:
// Dealer, SIS Code, DJI Code, Level, เซลที่ดูแล, ยอดขาย, เป้า, Achieve, Visit, Demo, Cert, Credit Term, Credit Limit, ผู้ติดต่อ
// ================================================================
function _dealerDemoStatus(d) {
  var demoOption = d.demoOption || 'none';
  if (demoOption === 'none') return null; // ไม่มีข้อกำหนด Demo — ไม่ต้องโชว์อะไร
  var demoItems = (d.demoItems && Array.isArray(d.demoItems)) ? d.demoItems : [];
  var level = d.level || 'Other';
  var cfg = getConfig();
  var levelReq = (cfg && cfg.levelRequirements && cfg.levelRequirements[level]) || (cfg && cfg.levelRequirements && cfg.levelRequirements.B) || { option1Models: [], option2Models: [] };
  var customReq = d.customDemoRequirements || {};
  var useCustom = customReq.enabled === true;
  var requiredOption1 = useCustom ? (customReq.option1Models || levelReq.option1Models || []) : (levelReq.option1Models || []);
  var requiredOption2 = useCustom ? (customReq.option2Models || levelReq.option2Models || []) : (levelReq.option2Models || []);
  var ownedModels = {};
  demoItems.forEach(function(it) { if (it && it.model) ownedModels[it.model] = true; });
  var requiredModels = demoOption === 'option1' ? requiredOption1 : demoOption === 'option2' ? requiredOption2 :
    demoOption === 'both' ? requiredOption1.concat(requiredOption2) : [];
  var missing = requiredModels.filter(function(m) { return !ownedModels[m]; });
  return { ok: missing.length === 0, missingCount: missing.length };
}

function _dealerCertCellHtml(d) {
  var certs = [
    { k: 'D', name: 'DSEC', ok: d.dsecStatus === 'pass', okTxt: 'ผ่านแล้ว', noTxt: 'ยังไม่ผ่าน' },
    { k: 'C', name: 'CRM', ok: d.crmStatus === 'yes', okTxt: 'ลงทะเบียนแล้ว', noTxt: 'ยังไม่ลงทะเบียน' },
    { k: 'F', name: 'FlightHub 2', ok: d.fh2Status === 'pass', okTxt: 'ผ่านแล้ว', noTxt: 'ยังไม่ผ่าน' },
    { k: 'L', name: 'Lark', ok: d.larkStatus === 'added', okTxt: 'Add เพื่อนแล้ว', noTxt: 'ยังไม่ Add' }
  ];
  return '<div style="display:flex;gap:3px">' + certs.map(function(c) {
    var bg = c.ok ? 'rgba(34,197,94,.13)' : 'rgba(239,68,68,.13)';
    var fg = c.ok ? '#22c55e' : '#ef4444';
    return '<span style="width:20px;height:16px;border-radius:3px;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;background:' + bg + ';color:' + fg + '" title="' + c.name + ': ' + (c.ok ? c.okTxt : c.noTxt) + '">' + c.k + '</span>';
  }).join('') + '</div>';
}

// เรียงตามหัวตารางที่กด — ค่าว่าง/ไม่มีข้อมูลตกท้ายสุดเสมอไม่ว่าจะเรียงทิศไหน (กันโดดขึ้นบนสุดตอนเรียงน้อย→มาก)
var dealerTableSort = { col: null, dir: 'desc' };
var _LEVEL_RANK = { S: 0, A: 1, B: 2 };
// width: % ของความกว้างตาราง รวมกันต้องได้ 100 — ใช้กับ table-layout:fixed กันปัญหาคอลัมน์สั้นๆ (Level/Achieve/
// Cert ฯลฯ) เบียดกันซ้ายสุดแล้วเหลือพื้นที่ว่างขวาสุด (auto layout เดิมให้แต่ละคอลัมน์แค่กว้างเท่าเนื้อหา)
var DEALER_TABLE_COLS = [
  { id: '_idx',   label: '#',            sortable: false, width: 3 },
  { id: 'name',   label: 'Dealer',       sortable: true,  width: 11 },
  { id: 'sis',    label: 'SIS Code',     sortable: true,  width: 7 },
  { id: 'dji',    label: 'DJI Code',     sortable: true,  width: 7 },
  { id: 'level',  label: 'Level',        sortable: true,  width: 5 },
  { id: 'sale',   label: 'เซลที่ดูแล',    sortable: true,  width: 8 },
  { id: 'won',    label: 'ยอดขาย',       sortable: true,  width: 7 },
  { id: 'target', label: 'เป้า',         sortable: true,  width: 7 },
  { id: 'pct',    label: 'Achieve',      sortable: true,  width: 6 },
  { id: 'visit',  label: 'Visit',        sortable: true,  width: 5 },
  { id: 'demo',   label: 'Demo',         sortable: true,  width: 7 },
  { id: 'cert',   label: 'Cert',         sortable: false, width: 7 },
  { id: 'cterm',  label: 'Credit Term',  sortable: true,  width: 6 },
  { id: 'climit', label: 'Credit Limit', sortable: true,  width: 7 },
  { id: 'contact',label: 'ผู้ติดต่อ',     sortable: true,  width: 7 }
];

function sortDealerTable(col) {
  if (dealerTableSort.col === col) dealerTableSort.dir = dealerTableSort.dir === 'desc' ? 'asc' : 'desc';
  else { dealerTableSort.col = col; dealerTableSort.dir = 'desc'; }
  var wrap = document.getElementById('dTableWrap');
  var dealers = scopedDealers();
  if (dealerFilter !== 'all') {
    if (dealerFilter === 'authorized') dealers = dealers.filter(function(d) { return ['S','A','B'].includes(d.level); });
    else if (dealerFilter === 'other') dealers = dealers.filter(function(d) { return !['S','A','B'].includes(d.level); });
    else dealers = dealers.filter(function(d) { return d.level === dealerFilter; });
  }
  if (Object.keys(dealerSaleFilter).length) dealers = dealers.filter(function(d) { return dealerSaleFilter[d.saleName || DEALER_SALE_UNSET]; });
  var q = (document.getElementById('dSrc') || {}).value || '';
  q = q.toLowerCase();
  if (q) dealers = dealers.filter(function(d) { return (d.name||'').toLowerCase().includes(q) || (d.contact||'').toLowerCase().includes(q) || (d.sisCode||'').toLowerCase().includes(q); });
  if (wrap) wrap.innerHTML = dealers.length ? _dealerTableHtml(dealers) : '<div class="empty"><p>ไม่พบ Dealer</p></div>';
}

function _dealerTableHtml(dealers) {
  _dealerVisibleIds = dealers.map(function(d) { return d.id; });
  var rows = dealers.map(function(d) {
    var pipes = ST.pipelineByDealer(d.id);
    var wonAmt = pipes.filter(function(p) { return pipeIsWon(p); }).reduce(function(a, p) { return a + (Number(p.forecastAmount) || 0); }, 0);
    var targetAmt = Number(d.targetRevenue) || 0;
    var pct = targetAmt ? Math.round(wonAmt / targetAmt * 100) : null;
    var lvd = ST.getLastVisitDays(d.id);
    var demo = _dealerDemoStatus(d);
    var climitNum = parseFloat(String(d.creditLimit || '').replace(/,/g, ''));
    return {
      d: d, wonAmt: wonAmt, targetAmt: targetAmt, pct: pct, lvd: lvd, demo: demo,
      isAuthorized: ['S','A','B'].includes(d.level),
      lvlColor: DEALER_LEVEL_COLOR[d.level] || '#475569',
      sortVal: {
        name: d.name || null, sis: d.sisCode || null, dji: d.djiCode || null,
        level: d.level && _LEVEL_RANK.hasOwnProperty(d.level) ? _LEVEL_RANK[d.level] : null,
        sale: d.saleName || null, won: wonAmt || null, target: targetAmt || null, pct: pct,
        visit: lvd, demo: demo ? (demo.ok ? 9999 : -demo.missingCount) : null,
        cterm: d.creditTerm || null, climit: isNaN(climitNum) ? null : climitNum, contact: d.contact || null
      }
    };
  });

  if (dealerTableSort.col) {
    var col = dealerTableSort.col, dir = dealerTableSort.dir;
    var withVal = rows.filter(function(r) { return r.sortVal[col] !== null && r.sortVal[col] !== undefined; });
    var withoutVal = rows.filter(function(r) { return r.sortVal[col] === null || r.sortVal[col] === undefined; });
    withVal.sort(function(a, b) {
      var va = a.sortVal[col], vb = b.sortVal[col];
      var cmp = (typeof va === 'number' && typeof vb === 'number') ? (va - vb) : String(va).localeCompare(String(vb), 'th');
      return dir === 'asc' ? cmp : -cmp;
    });
    rows = withVal.concat(withoutVal);
  }

  // ellipsis (ไม่ nowrap เฉยๆ) ทุกช่อง — จำเป็นเพราะ table-layout:fixed ล็อกความกว้างตาม colgroup แล้ว
  // เนื้อหาที่ยาวเกินคอลัมน์ต้องตัดด้วย ... ไม่งั้นจะดันคอลัมน์ข้างๆ เพี้ยนหรือล้นออกนอกตาราง
  var TD = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  var h = '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px">' +
    '<table class="tbl" id="dealerTbl" style="width:100%;min-width:1100px;table-layout:fixed">' +
    '<colgroup>' + (dealerSelectMode ? '<col style="width:34px">' : '') + DEALER_TABLE_COLS.map(function(c) { return '<col style="width:' + c.width + '%">'; }).join('') + '</colgroup>' +
    '<thead><tr>' +
    (dealerSelectMode ? '<th style="text-align:center"><input type="checkbox" id="dealerSelAll" title="เลือกทั้งหมด" onclick="toggleDealerSelectAll(this.checked)"></th>' : '') +
    DEALER_TABLE_COLS.map(function(c) {
      var arrow = dealerTableSort.col === c.id ? (dealerTableSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
      return '<th style="' + TD + (c.sortable ? ';cursor:pointer;user-select:none' : '') + '"' +
        (c.sortable ? ' onclick="sortDealerTable(\'' + c.id + '\')" title="คลิกเพื่อเรียง"' : '') + '>' + c.label + arrow + '</th>';
    }).join('') + '</tr></thead><tbody>';
  rows.forEach(function(r, idx) {
    var d = r.d, wonAmt = r.wonAmt, targetAmt = r.targetAmt, pct = r.pct, lvd = r.lvd, demo = r.demo, isAuthorized = r.isAuthorized, lvlColor = r.lvlColor;
    var rowClick = dealerSelectMode ? 'toggleDealerSelect(\'' + d.id + '\')' : 'go(\'dealerDetail\',{dealerId:\'' + d.id + '\'})';
    h += '<tr onclick="' + rowClick + '" style="cursor:pointer">';
    if (dealerSelectMode) h += '<td style="text-align:center" onclick="event.stopPropagation();toggleDealerSelect(\'' + d.id + '\')"><input type="checkbox" id="dealerChk_' + d.id + '" ' + (dealerSelected[d.id] ? 'checked' : '') + '></td>';
    h += '<td style="' + TD + ';color:var(--text2)">' + (idx + 1) + '</td>';
    h += '<td style="font-weight:600;' + TD + '" title="' + sanitize(d.name || '') + '">' + qcopyHtml(d.name) + '</td>';
    h += '<td style="' + TD + '" title="' + sanitize(d.sisCode || '') + '">' + qcopyHtml(d.sisCode) + '</td>';
    h += '<td style="' + TD + '" title="' + sanitize(d.djiCode || '') + '">' + qcopyHtml(d.djiCode) + '</td>';
    h += '<td style="' + TD + '"><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:' + lvlColor + '22;color:' + lvlColor + '">' + (d.level || 'OTHER') + '</span></td>';
    h += '<td style="' + TD + '" title="' + sanitize(d.saleName || '') + '">' + qcopyHtml(d.saleName) + '</td>';
    h += '<td style="' + TD + '">' + fmtMoneyShort(wonAmt) + '</td>';
    h += '<td style="' + TD + '">' + (targetAmt ? fmtMoneyShort(targetAmt) : '<span style="color:var(--text2)">—</span>') + '</td>';
    h += '<td style="' + TD + (pct !== null ? ';font-weight:700;color:' + (pct>=70?'#22c55e':pct>=40?'#f59e0b':'#ef4444') : ';color:var(--text2)') + '">' + (pct !== null ? pct + '%' : '—') + '</td>';
    h += '<td style="' + TD + '">' + (lvd !== null ? lvd + 'd' : '<span style="color:var(--text2)">—</span>') + '</td>';
    h += '<td style="' + TD + (demo ? ';font-weight:600;color:' + (demo.ok ? '#22c55e' : '#ef4444') : ';color:var(--text2)') + '">' + (demo ? (demo.ok ? '✅ ครบ' : '🔴 ขาด ' + demo.missingCount) : '—') + '</td>';
    h += '<td style="' + TD + '">' + (isAuthorized ? _dealerCertCellHtml(d) : '<span style="font-size:10px;color:var(--text2)">🔒 ไม่ Authorized</span>') + '</td>';
    h += '<td style="' + TD + '" title="' + sanitize(d.creditTerm || '') + '">' + sanitize(d.creditTerm || '-') + '</td>';
    h += '<td style="' + TD + '" title="' + sanitize(d.creditLimit || '') + '">' + sanitize(d.creditLimit || '-') + '</td>';
    h += '<td style="' + TD + '" title="' + sanitize(d.contact || '') + '">' + sanitize(d.contact || '-') + '</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

// Copy ตารางเป็น HTML จริง (ไม่ใช่แค่ tab-separated) — วางลง Word/Email ได้ตารางมีเส้นขอบ/หัวตารางเลย
// ต่างจาก copyDealerSummary() ที่ copy เป็น TSV (เหมาะกับวางลง Excel/Sheets มากกว่า)
// ================================================================
// DEALER LIST — BULK SELECT (เลือกหลายรายการ) — pattern เดียวกับ pipeSelectMode ใน views-pipeline.js
// ================================================================
function toggleDealerSelectMode() {
  dealerSelectMode = !dealerSelectMode;
  dealerSelected = {};
  render();
}
function toggleDealerSelect(id) {
  if (dealerSelected[id]) delete dealerSelected[id];
  else dealerSelected[id] = true;
  var cb = document.getElementById('dealerChk_' + id);
  if (cb) cb.checked = !!dealerSelected[id];
  var cnt = Object.keys(dealerSelected).length;
  _dealerSelBarUpdate(cnt);
  var allCb = document.getElementById('dealerSelAll');
  if (allCb) allCb.checked = cnt === _dealerVisibleIds.length && cnt > 0;
}
function toggleDealerSelectAll(selectAll) {
  dealerSelected = {};
  if (selectAll) _dealerVisibleIds.forEach(function(id) { dealerSelected[id] = true; });
  _dealerVisibleIds.forEach(function(id) {
    var cb = document.getElementById('dealerChk_' + id);
    if (cb) cb.checked = !!dealerSelected[id];
  });
  _dealerSelBarUpdate(Object.keys(dealerSelected).length);
}
function _dealerSelBarUpdate(cnt) {
  var countEl = document.getElementById('dealerSelCount');
  if (countEl) countEl.textContent = cnt + ' รายการที่เลือก';
  var delBtn = document.getElementById('dealerSelDelBtn');
  if (delBtn) { delBtn.disabled = !cnt; delBtn.textContent = '🗑️ ลบที่เลือก (' + cnt + ')'; }
  var exportBtn = document.getElementById('dealerSelExportBtn');
  if (exportBtn) exportBtn.disabled = !cnt;
  var saleSel = document.getElementById('dealerSelSaleSel');
  if (saleSel) saleSel.disabled = !cnt;
  var saleBtn = document.getElementById('dealerSelSaleBtn');
  if (saleBtn) saleBtn.disabled = !cnt;
}
// แถบเลือกด้านล่าง (sticky) — โชว์เฉพาะตอน dealerSelectMode เปิดอยู่ ให้ rDealers() แทรกต่อท้าย
// action หลักที่ Dealer ต้องการจริง (ตามที่คุยกันตอนสแกน UX) คือ "ย้ายเซลที่ดูแล" ทีเดียวหลายบริษัท —
// ใช้แทนที่ "เปลี่ยนสถานะ" แบบที่ Pipeline มี เพราะ Dealer ไม่มีแนวคิด status แบบเดียวกัน
function _dealerSelBarHtml() {
  if (!dealerSelectMode) return '';
  var selCnt = Object.keys(dealerSelected).length;
  var saleNames = {};
  ST.getAll('dealers').forEach(function(d) { if (d.saleName) saleNames[d.saleName] = true; });
  var saleOpts = Object.keys(saleNames).sort(function(a, b) { return a.localeCompare(b, 'th'); })
    .map(function(n) { return '<option value="' + sanitize(n) + '">' + sanitize(n) + '</option>'; }).join('');
  return '<div id="dealerSelBar" class="sel-bar" style="background:var(--card);border-top:2px solid var(--accent);padding:10px 14px;margin-top:12px;border-radius:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
    '<span id="dealerSelCount" style="font-size:13px;font-weight:600;min-width:80px">' + selCnt + ' รายการที่เลือก</span>' +
    '<button class="btn bo bsm" onclick="toggleDealerSelectAll(true)">เลือกทั้งหมด (' + _dealerVisibleIds.length + ')</button>' +
    '<button class="btn bo bsm" onclick="toggleDealerSelectAll(false)">ยกเลิกเลือก</button>' +
    '<select id="dealerSelSaleSel" ' + (!selCnt ? 'disabled' : '') + ' style="font-size:12px;min-width:130px"><option value="">🧑‍💼 ย้ายเซลที่ดูแล...</option>' + saleOpts + '</select>' +
    '<button class="btn bo bsm" id="dealerSelSaleBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkChangeDealerSale()">ยืนยัน</button>' +
    '<button class="btn bo bsm" id="dealerSelExportBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkExportDealersSelected()">📥 Export ที่เลือก</button>' +
    '<button class="btn bd" id="dealerSelDelBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkDeleteDealers()">🗑️ ลบที่เลือก (' + selCnt + ')</button>' +
    '<button class="btn bo bsm" style="margin-left:auto" onclick="toggleDealerSelectMode()">✕ ออก</button>' +
    '</div>';
}
function bulkDeleteDealers() {
  var ids = Object.keys(dealerSelected);
  if (!ids.length) return;
  if (!confirm('ลบ ' + ids.length + ' Dealer ที่เลือก?\nPipeline/Visit/ประวัติที่ผูกกับ Dealer เหล่านี้จะไม่ถูกลบตาม แค่ตัว Dealer เอง\nไม่สามารถกู้คืนได้')) return;
  ids.forEach(function(id) {
    ST.delete('dealers', id);
    if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('dealers', id);
  });
  dealerSelected = {};
  dealerSelectMode = false;
  toast('🗑️ ลบแล้ว ' + ids.length + ' รายการ');
  render();
}
function bulkChangeDealerSale() {
  var sel = document.getElementById('dealerSelSaleSel');
  var saleName = sel ? sel.value : '';
  if (!saleName) { toast('⚠️ เลือกเซลก่อน'); return; }
  var ids = Object.keys(dealerSelected);
  if (!ids.length) return;
  if (!confirm('ย้ายเซลที่ดูแล ' + ids.length + ' Dealer เป็น "' + saleName + '"?\n(Pipeline ของ Dealer เหล่านี้จะถูกย้ายเซลตามไปด้วยอัตโนมัติ)')) return;
  // ST.updateMany() แทนวน ST.update() ทีละ Dealer — เหตุผลเดียวกับ cascadeDealerSaleNameToPipelines
  var saved = ST.updateMany('dealers', ids, { saleName: saleName });
  saved.forEach(function(d) {
    if (typeof syncItemToFirebase === 'function') syncItemToFirebase('dealers', d);
    if (typeof cascadeDealerSaleNameToPipelines === 'function') cascadeDealerSaleNameToPipelines(d.id, saleName);
  });
  toast('🧑‍💼 ย้ายเซลแล้ว ' + ids.length + ' รายการ');
  render();
}
function _dealerExcelRow(d) {
  return [
    d.id || '', d.name || '', d.sisCode || '', d.djiCode || '', d.level || '', d.djiDealer || '',
    d.saleName || '', d.creditTerm || '', d.creditLimit || '', d.targetRevenue || '', d.contact || '',
    d.googleMap || '', d.notes || '', d.paymentCondition || ''
  ];
}
function bulkExportDealersSelected() {
  var ids = Object.keys(dealerSelected);
  if (!ids.length) return;
  var dealers = ids.map(function(id) { return ST.getOne('dealers', id); }).filter(Boolean);
  var headers = ['id', 'ชื่อบริษัท', 'SIS Code', 'DJI Code', 'Level', 'DJI Dealer', 'เซลที่ดูแล', 'Credit Term', 'Credit Limit', 'Target Revenue', 'ผู้ติดต่อ', 'Google Map', 'หมายเหตุ', 'Payment Condition'];
  var rows = [headers].concat(dealers.map(_dealerExcelRow));
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 20 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 40 }, { wch: 30 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Dealers');
  XLSX.writeFile(wb, 'dealers-selected-' + _td() + '.xlsx');
  toast('📥 Export ' + dealers.length + ' รายการที่เลือก');
}

function copyDealerTableAsWord() {
  var table = document.getElementById('dealerTbl');
  if (!table) return;
  var html = table.outerHTML;
  var text = table.innerText;
  function done() { toast('📋 คัดลอกตารางแล้ว วางลง Word ได้เลย'); }
  if (navigator.clipboard && window.ClipboardItem) {
    var item = new ClipboardItem({
      'text/html': new Blob([html], {type: 'text/html'}),
      'text/plain': new Blob([text], {type: 'text/plain'})
    });
    navigator.clipboard.write([item]).then(done).catch(function() {
      navigator.clipboard.writeText(text).then(done);
    });
  } else {
    navigator.clipboard.writeText(text).then(done);
  }
}

// สี accent ต่อ Level — ใช้ชุดสีเดียวกับ levelTag()/.tag-s/.tag-a/.tag-b ใน style.css ให้ตรงกับที่อื่นในแอพ
const DEALER_LEVEL_COLOR = { S: '#7c3aed', A: '#3b82f6', B: '#64748b' };

// ================================================================
// DEALER EMAIL — เลือกหลาย Dealer แล้วสร้าง mailto: ทีละฉบับจาก template
// (ตั้งค่า template ที่ "ส่งแยกทีละ Dealer" ได้จากหน้า Email Draft → ⚙️ จัดการ, ดู features.js)
// ================================================================
// "Loop mail" ต่อ Dealer เก็บเป็นหลาย "กลุ่ม" (d.mailLoops) เพราะบางบริษัทมี loop แยก
// ทั่วไป/เทคนิค ต่างคนกัน บางบริษัทรวมกลุ่มเดียว — แต่ละ Dealer เลือกได้อิสระว่าจะมีกี่กลุ่ม
// รองรับข้อมูลเก่า d.mailLoop (ครั้งเดียว ก่อนมีหลายกลุ่ม) โดยตีความเป็นกลุ่ม "ทั่วไป" กลุ่มเดียว
// ถ้ายังไม่เคยตั้งอะไรเลย ให้ default To = ผู้ติดต่อหลัก, CC = ผู้ติดต่อที่เหลือที่มีอีเมล
function _dealerLoopGroups(d) {
  if (d.mailLoops && d.mailLoops.length) return d.mailLoops;
  if (d.mailLoop && (d.mailLoop.to || d.mailLoop.cc)) return [{ name: 'ทั่วไป', to: d.mailLoop.to || '', cc: d.mailLoop.cc || '' }];
  var withEmail = (d.contacts || []).filter(function(c) { return c.email; });
  var primary = withEmail.find(function(c) { return c.primary; }) || withEmail[0] || null;
  var to = primary ? primary.email : (d.email || '');
  var cc = withEmail.filter(function(c) { return c !== primary; }).map(function(c) { return c.email; }).join(', ');
  return [{ name: 'ทั่วไป', to: to, cc: cc }];
}
// หากลุ่มตามชื่อ — ถ้า Dealer นี้ไม่มีกลุ่มชื่อนั้น (เช่นเลือกส่ง "เทคนิค" แต่บริษัทนี้ไม่มีแยก)
// ให้ fallback ไปกลุ่มแรกของ Dealer นั้นแทนโดยอัตโนมัติ พร้อม flag บอกว่าใช้ fallback
function _dealerLoopByName(d, groupName) {
  var groups = _dealerLoopGroups(d);
  var match = groups.find(function(g) { return g.name === groupName; });
  if (match) return { to: match.to || '', cc: match.cc || '', name: match.name, fallback: false };
  var fb = groups[0];
  return { to: fb.to || '', cc: fb.cc || '', name: fb.name, fallback: true };
}
// รวมชื่อกลุ่มทั้งหมดที่มีอยู่ในรายชื่อ Dealer ที่ให้มา (สำหรับ dropdown "กลุ่มที่ส่ง")
function _allLoopGroupNames(dealers) {
  var names = {};
  (dealers || []).forEach(function(d) { _dealerLoopGroups(d).forEach(function(g) { if (g.name) names[g.name] = true; }); });
  if (!Object.keys(names).length) names['ทั่วไป'] = true;
  return Object.keys(names).sort(function(a, b) { return a === 'ทั่วไป' ? -1 : (b === 'ทั่วไป' ? 1 : a.localeCompare(b)); });
}

// ตัวแก้ไขกลุ่ม Loop Email แบบ reusable — ใช้ทั้งใน ⚙️ ของหน้า Email Dealer และการ์ดหน้า Dealer Detail
// แต่ละกลุ่มแก้ชื่อ/To/CC เองได้อิสระ ลบกลุ่มได้ (เหลืออย่างน้อย 1 กลุ่มเสมอ — ลบจนหมดจะเติมกลุ่มว่างกลับให้)
function _loopGroupBlockHtml(idPrefix, g) {
  return '<div class="loopgroup-block" style="background:var(--bg2);border-radius:8px;padding:8px;margin-bottom:6px">' +
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:5px">' +
    '<input type="text" class="' + idPrefix + '_name" value="' + sanitize(g.name || '') + '" placeholder="ชื่อกลุ่ม เช่น ทั่วไป" style="flex:1;font-size:12px;font-weight:600">' +
    '<button type="button" class="btn-xs btn-red" onclick="_loopGroupRemove(\'' + idPrefix + '\', this)">✕</button>' +
    '</div>' +
    '<input type="text" class="' + idPrefix + '_to fm-input" value="' + sanitize(g.to || '') + '" placeholder="To" style="width:100%;font-size:11px;margin-bottom:4px">' +
    '<input type="text" class="' + idPrefix + '_cc fm-input" value="' + sanitize(g.cc || '') + '" placeholder="CC (คั่นด้วย , ถ้าหลายคน)" style="width:100%;font-size:11px">' +
    '</div>';
}
function _loopGroupsEditorHtml(idPrefix, groups) {
  var h = '<div id="' + idPrefix + '_wrap">';
  groups.forEach(function(g) { h += _loopGroupBlockHtml(idPrefix, g); });
  h += '</div><button type="button" class="btn-xs" onclick="_loopGroupAdd(\'' + idPrefix + '\')">➕ เพิ่มกลุ่ม</button>';
  return h;
}
function _loopGroupAdd(idPrefix) {
  var wrap = document.getElementById(idPrefix + '_wrap');
  if (!wrap) return;
  wrap.insertAdjacentHTML('beforeend', _loopGroupBlockHtml(idPrefix, { name: '', to: '', cc: '' }));
}
function _loopGroupRemove(idPrefix, btnEl) {
  var wrap = document.getElementById(idPrefix + '_wrap');
  var block = btnEl.closest('.loopgroup-block');
  if (block) block.remove();
  if (wrap && !wrap.children.length) _loopGroupAdd(idPrefix);
}
function _loopGroupsCollect(idPrefix) {
  var wrap = document.getElementById(idPrefix + '_wrap');
  if (!wrap) return [{ name: 'ทั่วไป', to: '', cc: '' }];
  var blocks = Array.prototype.slice.call(wrap.querySelectorAll('.loopgroup-block'));
  var groups = blocks.map(function(b) {
    return {
      name: (b.querySelector('.' + idPrefix + '_name').value || '').trim(),
      to: (b.querySelector('.' + idPrefix + '_to').value || '').trim(),
      cc: (b.querySelector('.' + idPrefix + '_cc').value || '').trim()
    };
  }).filter(function(g) { return g.name || g.to || g.cc; });
  return groups.length ? groups : [{ name: 'ทั่วไป', to: '', cc: '' }];
}

// การ์ด Loop Email ในหน้า Dealer Detail — แก้ d.mailLoops ตัวเดียวกับที่หน้า Email Dealer ใช้
// (ข้อมูลชุดเดียวกัน ไม่แยกเก็บซ้ำ) จะแก้จากที่นี่หรือจากปุ่ม ⚙️ ในหน้า Email Dealer ก็ได้
function renderDealerLoopEmailCard(d) {
  var groups = _dealerLoopGroups(d);
  var prefix = 'ddl_' + d.id;
  return '<div class="card"><h2>📧 Loop Email (To / CC)</h2>' +
    '<p style="font-size:11px;color:var(--text2);margin-bottom:8px">ตั้งได้หลายกลุ่ม เช่น "ทั่วไป" กับ "เทคนิค" — ตอนส่งจากหน้า Email Dealer ถ้า Dealer นี้ไม่มีกลุ่มที่เลือก จะใช้กลุ่มแรกแทนอัตโนมัติ</p>' +
    _loopGroupsEditorHtml(prefix, groups) +
    '<button class="btn bp bsm" style="margin-top:6px" onclick="saveDealerLoopGroups(\'' + d.id + '\')">💾 บันทึกทั้งหมด</button></div>';
}
function saveDealerLoopGroups(id) {
  var groups = _loopGroupsCollect('ddl_' + id);
  ST.update('dealers', id, { mailLoops: groups });
  toast('💾 บันทึก Loop Email แล้ว');
}
function _buildMailto(to, cc, subject, body) {
  var toEnc = (to || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean).map(encodeURIComponent).join(',');
  var ccEnc = (cc || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean).map(encodeURIComponent).join(',');
  var params = ['subject=' + encodeURIComponent(subject), 'body=' + encodeURIComponent(body)];
  if (ccEnc) params.push('cc=' + ccEnc);
  return 'mailto:' + toEnc + '?' + params.join('&');
}
function _deOpenMail(id) {
  var f = (window._deFilled || {})[id];
  var toEl = document.getElementById('deTo_' + id);
  var ccEl = document.getElementById('deCc_' + id);
  if (!f || !toEl || !toEl.value.trim()) return toast('⚠️ ใส่ To ก่อน');
  var to = toEl.value, cc = ccEl ? ccEl.value : '';
  window.open(_buildMailto(to, cc, f.subject, f.body), '_blank');
  logDealerEmail(id, f.subject, f.body, to, cc);
}
// เปิดทุกฉบับพร้อมกัน — ต้องเรียก window.open() วนแบบ synchronous ในการคลิกครั้งเดียว (ไม่ผ่าน setTimeout)
// เพราะเบราว์เซอร์ส่วนใหญ่อนุญาตหลาย popup ได้เฉพาะตอนยังอยู่ใน event handler ของการคลิกจริงเท่านั้น
// ถ้าหน่วง async ไว้แม้แค่ tick เดียว popup ถัดไปจะถูกบล็อกเป็น "popup ที่ไม่ได้มาจาก user gesture"
function _deOpenMailAll() {
  var ids = window._deGenIds || [];
  if (!ids.length) return;
  var opened = 0, skipped = 0;
  ids.forEach(function(id) {
    var f = (window._deFilled || {})[id];
    var toEl = document.getElementById('deTo_' + id);
    var ccEl = document.getElementById('deCc_' + id);
    if (!f || !toEl || !toEl.value.trim()) { skipped++; return; }
    var to = toEl.value, cc = ccEl ? ccEl.value : '';
    window.open(_buildMailto(to, cc, f.subject, f.body), '_blank');
    logDealerEmail(id, f.subject, f.body, to, cc);
    opened++;
  });
  toast('📧 เปิดแล้ว ' + opened + ' ฉบับ' + (skipped ? ' (ข้าม ' + skipped + ' รายที่ไม่มี To)' : '') + ' — ถ้าเบราว์เซอร์ถามเรื่อง popup กด "อนุญาต"');
}
// บันทึกประวัติทุกครั้งที่กด "เปิด" ไป Outlook — เราไม่รู้ว่าลูกค้ากดส่งจริงในนั้นไหม เลยเก็บเป็น
// "เปิดแล้ว" (openedDate) ไว้ก่อน ผู้ใช้ค่อยกด "มาร์คว่าส่งแล้ว" เองทีหลังถ้าส่งจริง — เก็บใน collection
// 'emails' เดียวกับ Email Log ทั่วไป (showEmailM/modals.js) แค่เพิ่ม dealerId/body/cc/openedDate ให้แยกได้
function logDealerEmail(dealerId, subject, body, to, cc) {
  ST.add('emails', { dealerId: dealerId, subject: subject, body: body, recipients: to, cc: cc, sent: false, openedDate: _nw(), type: 'dealer' });
}
function renderDealerEmailHistoryCard(d) {
  var emails = ST.getAll('emails').filter(function(e) { return e.dealerId === d.id; })
    .sort(function(a, b) { return (b.openedDate || b.created || '').localeCompare(a.openedDate || a.created || ''); });
  var h = '<div class="card"><h2>📧 ประวัติอีเมล (' + emails.length + ')</h2>';
  if (!emails.length) { h += '<div class="empty"><p>ยังไม่เคยส่งอีเมลถึง Dealer นี้จากแอป</p></div></div>'; return h; }
  emails.forEach(function(e) {
    h += '<div class="contact-card">' +
      '<div class="contact-header"><div class="contact-name">' + sanitize(e.subject || '(ไม่มีหัวข้อ)') + '</div>' +
      '<button class="btn-xs" onclick="showEditEmailLogM(\'' + e.id + '\')">✏️</button></div>' +
      '<div style="font-size:11px;color:var(--text2)">To: ' + sanitize(e.recipients || '') + (e.cc ? ' • CC: ' + sanitize(e.cc) : '') + '</div>' +
      '<div style="font-size:11px;color:var(--text2)">' + fD((e.openedDate || e.created || '').slice(0, 10)) + (e.sent ? ' • ✅ ส่งแล้ว' : ' • ⏳ ยังไม่ยืนยันว่าส่ง') + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' +
      '<button class="btn-xs btn-blue" onclick="resendEmailLog(\'' + e.id + '\')">📧 ส่งใหม่</button>' +
      '<button class="btn-xs" onclick="toggleEmailSent(\'' + e.id + '\')">' + (e.sent ? '↩️ ยังไม่ส่ง' : '✅ มาร์คว่าส่งแล้ว') + '</button>' +
      '<button class="btn-xs btn-red" onclick="deleteEmailLog(\'' + e.id + '\')">🗑</button>' +
      '</div></div>';
  });
  h += '</div>';
  return h;
}
function showEditEmailLogM(id) {
  var e = ST.getOne('emails', id);
  if (!e) return;
  openM('✏️ แก้ไข Email Log', '<div style="max-width:450px">' +
    '<div class="fg"><label>หัวข้อ</label><input type="text" id="eel_subj" value="' + sanitize(e.subject || '') + '"></div>' +
    '<div class="fg"><label>To</label><input type="text" id="eel_to" value="' + sanitize(e.recipients || '') + '"></div>' +
    '<div class="fg"><label>CC</label><input type="text" id="eel_cc" value="' + sanitize(e.cc || '') + '"></div>' +
    '<div class="fg"><label>เนื้อหา</label><textarea id="eel_body" rows="8">' + sanitize(e.body || '') + '</textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveEmailLogEdit(\'' + id + '\')">💾 บันทึก</button></div>');
}
function saveEmailLogEdit(id) {
  ST.update('emails', id, {
    subject: document.getElementById('eel_subj').value.trim(),
    recipients: document.getElementById('eel_to').value.trim(),
    cc: document.getElementById('eel_cc').value.trim(),
    body: document.getElementById('eel_body').value
  });
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}
function resendEmailLog(id) {
  var e = ST.getOne('emails', id);
  if (!e) return;
  window.open(_buildMailto(e.recipients, e.cc || '', e.subject, e.body || ''), '_blank');
  ST.update('emails', id, { lastResentDate: _nw() });
  toast('📧 เปิด Outlook แล้ว');
  render();
}
function toggleEmailSent(id) {
  var e = ST.getOne('emails', id);
  if (!e) return;
  ST.update('emails', id, { sent: !e.sent, sentDate: !e.sent ? _nw() : null });
  render();
}
function deleteEmailLog(id) {
  if (!confirm('ลบประวัติอีเมลนี้?')) return;
  ST.delete('emails', id);
  render();
}
function _dealerPrimaryContact(d) {
  var contacts = d.contacts || [];
  return contacts.find(function(c) { return c.primary; }) || contacts[0] || null;
}
function _dealerPrimaryContactName(d) {
  var c = _dealerPrimaryContact(d);
  return (c && c.name) || d.contact || '';
}
function fillDealerEmailTemplate(tmpl, d) {
  var cfg = getConfig();
  var c = _dealerPrimaryContact(d);
  var pipes = ST.pipelineByDealer(d.id);
  var wonAmt = pipes.filter(function(p) { return pipeIsWon(p); }).reduce(function(a, p) { return a + (Number(p.forecastAmount) || 0); }, 0);
  var targetAmt = Number(d.targetRevenue) || 0;
  var achieve = targetAmt ? Math.round(wonAmt / targetAmt * 100) + '%' : '-';
  function fill(s) {
    return (s || '')
      .replace(/\{dealer\}/g, d.name || '')
      .replace(/\{contact\}/g, _dealerPrimaryContactName(d))
      .replace(/\{contactPhone\}/g, (c && c.phone) || '')
      .replace(/\{contactEmail\}/g, (c && c.email) || '')
      .replace(/\{sisCode\}/g, d.sisCode || '')
      .replace(/\{djiCode\}/g, d.djiCode || '')
      .replace(/\{level\}/g, d.level || '')
      .replace(/\{saleName\}/g, d.saleName || '')
      .replace(/\{creditTerm\}/g, d.creditTerm || '')
      .replace(/\{creditLimit\}/g, d.creditLimit || '')
      .replace(/\{targetRevenue\}/g, targetAmt ? fmtMoney(targetAmt) : '')
      .replace(/\{achieve\}/g, achieve)
      .replace(/\{googleMap\}/g, d.googleMap || '')
      .replace(/\{notes\}/g, d.notes || '')
      .replace(/\{sale\}/g, cfg.saleName || 'Siwawong')
      .replace(/\{date\}/g, _td());
  }
  return { subject: _applyCustomVars(fill(tmpl.subject || tmpl.name)), body: _applyCustomVars(fill(tmpl.body)) };
}

function showDealerEmailPickerM(tmplId) {
  var templates = getEmailTemplates().filter(function(t) { return t.type === 'custom' && t.forDealer; });
  if (!tmplId && templates.length === 1) tmplId = templates[0].id;

  if (!templates.length) {
    openM('📧 Email Dealer', '<div style="padding:8px 0">ยังไม่มี Template สำหรับส่งแยกทีละ Dealer<br>' +
      '<button class="btn bp" style="margin-top:10px" onclick="showAddEmailTmplM()">➕ สร้าง Template</button></div>');
    return;
  }

  var dealers = ST.getAll('dealers').slice().sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  var saleNames = Array.from(new Set(dealers.map(function(d) { return d.saleName || ''; }).filter(Boolean))).sort();
  var groupNames = _allLoopGroupNames(dealers);

  var h = '<div style="max-width:520px">';
  h += '<div class="fm-group"><label>📋 Template <span class="ml"><button type="button" class="btn-xs" onclick="_dePickerEditTmpl()">✏️ แก้ไข</button> <button type="button" class="btn-xs" onclick="_dePickerNewTmpl()">➕ ใหม่</button></span></label>' +
    '<select id="deTmpl" class="fm-input" onchange="_deRenderList()">' +
    templates.map(function(t) { return '<option value="' + t.id + '"' + (t.id === tmplId ? ' selected' : '') + '>' + (t.icon || '📧') + ' ' + sanitize(t.name) + '</option>'; }).join('') +
    '</select></div>';
  h += '<div class="fm-group"><label>📂 กลุ่มที่ส่ง</label><select id="deGroupSel" class="fm-input" onchange="_deRenderList()">' +
    groupNames.map(function(n) { return '<option value="' + sanitize(n) + '">' + sanitize(n) + '</option>'; }).join('') +
    '</select></div>';
  if (saleNames.length > 1) {
    h += '<div class="fm-group"><label>🧑‍💼 เซลที่ดูแล</label><select id="deSaleSel" class="fm-input" onchange="_deRenderList()">' +
      '<option value="">ทั้งหมด (ทุกเซล)</option>' +
      saleNames.map(function(n) { return '<option value="' + sanitize(n) + '">' + sanitize(n) + '</option>'; }).join('') +
      '</select></div>';
  }
  h += '<div id="deLevelBar" style="margin-bottom:8px"></div>';
  h += '<input type="text" id="deSearch" class="fm-input" placeholder="🔍 ค้นหา Dealer..." style="margin-bottom:8px" oninput="_deRenderList()">';
  h += '<div style="display:flex;gap:6px;margin-bottom:6px">' +
    '<button class="btn-xs" onclick="_deSelectAll(true)">☑ เลือกทั้งหมดที่มีอีเมล</button>' +
    '<button class="btn-xs" onclick="_deSelectAll(false)">☐ ล้างที่เลือก</button></div>';
  h += '<div id="deList" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px"></div>';
  h += '<div id="deGenArea" style="margin-top:10px"></div>';
  h += '<button class="btn bp btn-full" style="margin-top:10px" onclick="_dealerEmailGenerate()">📧 สร้างอีเมล</button>';
  h += '</div>';
  openM('📧 Email Dealer', h);
  window._deDealers = dealers;
  window._deLevelFilter = 'all';
  _deRenderLevelBar();
  _deRenderList();
}

function _deRenderLevelBar() {
  var bar = document.getElementById('deLevelBar');
  if (!bar) return;
  var opts = [['all', 'ทั้งหมด'], ['auth', 'Authorized (S/A/B)'], ['S', 'S'], ['A', 'A'], ['B', 'B'], ['other', 'Other']];
  var cur = window._deLevelFilter || 'all';
  bar.innerHTML = opts.map(function(o) {
    var active = cur === o[0];
    return '<button type="button" class="btn-xs" onclick="_deSetLevelFilter(\'' + o[0] + '\')" style="' +
      (active ? 'background:var(--accent);color:#fff;border-color:var(--accent)' : '') + '">' + o[1] + '</button>';
  }).join(' ');
}
function _deSetLevelFilter(v) {
  window._deLevelFilter = v;
  _deRenderLevelBar();
  _deRenderList();
}

function _deRenderList() {
  var listEl = document.getElementById('deList');
  if (!listEl) return;
  var q = (document.getElementById('deSearch').value || '').trim().toLowerCase();
  var saleSel = document.getElementById('deSaleSel');
  var saleVal = saleSel ? saleSel.value : '';
  var groupSel = document.getElementById('deGroupSel');
  var groupName = groupSel ? groupSel.value : 'ทั่วไป';
  var levelFilter = window._deLevelFilter || 'all';
  var dealers = window._deDealers || [];
  var prevChecked = {};
  Array.prototype.forEach.call(listEl.querySelectorAll('input[type=checkbox]'), function(c) { prevChecked[c.value] = c.checked; });
  var rows = dealers.filter(function(d) {
    if (q && (d.name || '').toLowerCase().indexOf(q) === -1 && (d.sisCode || '').toLowerCase().indexOf(q) === -1) return false;
    if (saleVal && (d.saleName || '') !== saleVal) return false;
    var isAuth = ['S', 'A', 'B'].indexOf(d.level) !== -1;
    if (levelFilter === 'auth' && !isAuth) return false;
    if ((levelFilter === 'S' || levelFilter === 'A' || levelFilter === 'B') && d.level !== levelFilter) return false;
    if (levelFilter === 'other' && isAuth) return false;
    return true;
  }).map(function(d) {
    var loop = _dealerLoopByName(d, groupName);
    var hasEmail = !!loop.to;
    var ccCount = loop.cc ? loop.cc.split(',').filter(function(s) { return s.trim(); }).length : 0;
    var emailLabel = hasEmail ? sanitize(loop.to) + (ccCount ? ' +' + ccCount + ' CC' : '') : '⚠️ ยังไม่มีอีเมล';
    if (hasEmail && loop.fallback) emailLabel = '<span style="color:#f59e0b">ใช้ "' + sanitize(loop.name) + '" แทน</span> · ' + emailLabel;
    var emailTitle = hasEmail ? sanitize(loop.to + (loop.cc ? '; CC: ' + loop.cc : '')) : '';
    var checked = prevChecked[d.id] ? ' checked' : '';
    var expanded = (window._deExpanded || {})[d.id];
    var row = '<div style="display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:12px;' + (hasEmail ? '' : 'opacity:.65') + '">' +
      '<input type="checkbox" value="' + d.id + '" style="width:auto;flex-shrink:0"' + (hasEmail ? checked : ' disabled') + '>' +
      '<span style="flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" title="' + sanitize(d.name || '') + '" onclick="this.previousElementSibling.click()">' + sanitize(d.name || '') + '</span>' +
      '<span style="flex:0 0 190px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)" title="' + emailTitle + '">' + emailLabel + '</span>' +
      '<button type="button" class="btn-xs" style="flex-shrink:0" onclick="_deToggleGear(\'' + d.id + '\')" title="ตั้งค่า Loop Email">⚙️</button></div>';
    if (expanded) {
      row += '<div style="padding:0 4px 8px 30px">' + _loopGroupsEditorHtml('deGear_' + d.id, _dealerLoopGroups(d)) +
        '<button type="button" class="btn-xs btn-blue" style="margin-top:4px" onclick="_deGearSaveGroups(\'' + d.id + '\')">💾 บันทึก</button></div>';
    }
    return row;
  });
  listEl.innerHTML = rows.length ? rows.join('') : '<div style="padding:8px;color:var(--text2);font-size:12px">ไม่พบ Dealer</div>';
}

function _deSelectAll(on) {
  var listEl = document.getElementById('deList');
  if (!listEl) return;
  Array.prototype.forEach.call(listEl.querySelectorAll('input[type=checkbox]:not(:disabled)'), function(c) { c.checked = on; });
}

// ⚙️ ต่อท้ายแต่ละแถวในหน้าเลือก Dealer — แก้ Loop Email ได้ตรงนั้นเลยโดยไม่ต้องรอถึงขั้นตอน "สร้างอีเมล"
// (เดิม To/CC แก้ได้แค่หลังกดสร้างแล้ว — Dealer ที่ยังไม่มีอีเมลเลยเลือกไม่ได้ตั้งแต่แรก)
function _deToggleGear(id) {
  window._deExpanded = window._deExpanded || {};
  window._deExpanded[id] = !window._deExpanded[id];
  _deRenderList();
}
function _deGearSaveGroups(id) {
  var groups = _loopGroupsCollect('deGear_' + id);
  ST.update('dealers', id, { mailLoops: groups });
  var d = ST.getOne('dealers', id);
  var idx = (window._deDealers || []).findIndex(function(x) { return x.id === id; });
  if (idx !== -1) window._deDealers[idx] = d;
  window._deExpanded[id] = false;
  toast('💾 บันทึก Loop Email แล้ว');
  _deRenderList();
}

// เพิ่ม/แก้ Template แบบไม่ต้องออกจากหน้า Email Dealer — ใช้ _etReturnTo (features.js) บอก
// saveNewEmailTmpl/saveEditEmailTmpl ว่าบันทึกเสร็จแล้วให้กลับมาเปิดหน้านี้ต่อ ไม่ใช่กลับไปหน้าจัดการ Template
function _dePickerNewTmpl() {
  _etReturnTo = 'picker';
  showAddEmailTmplM();
  var chk = document.getElementById('etForDealer');
  if (chk) { chk.checked = true; _etToggleDealerHint(); }
}
function _dePickerEditTmpl() {
  var sel = document.getElementById('deTmpl');
  if (!sel || !sel.value) return;
  var idx = getEmailTemplates().findIndex(function(t) { return t.id === sel.value; });
  if (idx === -1) return;
  _etReturnTo = 'picker';
  showEditEmailTmplM(idx);
}

function _dealerEmailGenerate() {
  var tmplSel = document.getElementById('deTmpl');
  var tmpl = tmplSel && getEmailTemplates().find(function(t) { return t.id === tmplSel.value; });
  if (!tmpl) return;
  var groupSel = document.getElementById('deGroupSel');
  var groupName = groupSel ? groupSel.value : 'ทั่วไป';
  var listEl = document.getElementById('deList');
  var ids = Array.prototype.filter.call(listEl.querySelectorAll('input[type=checkbox]'), function(c) { return c.checked; }).map(function(c) { return c.value; });
  if (!ids.length) return toast('เลือก Dealer อย่างน้อย 1 ราย');
  var dealers = window._deDealers || [];
  var area = document.getElementById('deGenArea');
  window._deFilled = {};
  window._deGenGroup = groupName;
  window._deGenIds = ids.slice();
  var h = '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">' + ids.length + ' ราย — แก้ To/CC ได้ก่อนเปิด, กด 💾 เพื่อจำกลุ่ม "' + sanitize(groupName) + '" นี้ไว้ใช้ครั้งหน้า</div>';
  h += '<button type="button" class="btn bp btn-full" style="margin-bottom:8px" onclick="_deOpenMailAll()">📧 เปิดทั้งหมด (' + ids.length + ' ฉบับ)</button>';
  ids.forEach(function(id) {
    var d = dealers.find(function(x) { return x.id === id; });
    if (!d) return;
    var loop = _dealerLoopByName(d, groupName);
    var filled = fillDealerEmailTemplate(tmpl, d);
    window._deFilled[id] = filled;
    h += '<div style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:12px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b style="flex:1">' + sanitize(d.name || '') + '</b>' +
      '<button class="btn-xs btn-blue" onclick="_deOpenMail(\'' + id + '\')">📧 เปิด</button>' +
      '<button class="btn-xs" onclick="_deSaveLoop(\'' + id + '\')" title="จำ To/CC นี้ไว้ที่กลุ่ม' + sanitize(groupName) + '">💾</button></div>' +
      (loop.fallback ? '<div style="font-size:10px;color:#f59e0b;margin-bottom:2px">⚠️ Dealer นี้ไม่มีกลุ่ม "' + sanitize(groupName) + '" — ใช้ "' + sanitize(loop.name) + '" แทน กด 💾 เพื่อสร้างกลุ่มนี้ให้ Dealer นี้</div>' : '') +
      '<input type="text" id="deTo_' + id + '" class="fm-input" style="font-size:11px;margin-bottom:3px" placeholder="To" value="' + sanitize(loop.to) + '">' +
      '<input type="text" id="deCc_' + id + '" class="fm-input" style="font-size:11px" placeholder="CC (คั่นด้วย , ถ้าหลายคน)" value="' + sanitize(loop.cc) + '">' +
      '</div>';
  });
  area.innerHTML = h;
}
function _deSaveLoop(id) {
  var toEl = document.getElementById('deTo_' + id);
  var ccEl = document.getElementById('deCc_' + id);
  if (!toEl) return;
  var groupName = window._deGenGroup || 'ทั่วไป';
  var d = ST.getOne('dealers', id);
  var groups = _dealerLoopGroups(d).slice();
  var gIdx = groups.findIndex(function(g) { return g.name === groupName; });
  var newGroup = { name: groupName, to: toEl.value.trim(), cc: (ccEl ? ccEl.value.trim() : '') };
  if (gIdx !== -1) groups[gIdx] = newGroup; else groups.push(newGroup);
  ST.update('dealers', id, { mailLoops: groups });
  d = ST.getOne('dealers', id);
  var idx = (window._deDealers || []).findIndex(function(x) { return x.id === id; });
  if (idx !== -1) window._deDealers[idx] = d;
  toast('💾 บันทึกกลุ่ม "' + groupName + '" ของ ' + (d ? d.name : '') + ' แล้ว');
}

function dealerCardHTML(d, health) {
  const h = health || calcHealthScore(d.id);
  const pipes = ST.pipelineByDealer(d.id);
  const activePipes = pipes.filter(p => pipeIsOpen(p));
  const wonAmt = pipes.filter(p => pipeIsWon(p)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const targetAmt = Number(d.targetRevenue) || 0;
  const pct = targetAmt ? Math.round(wonAmt / targetAmt * 100) : 0;
  const lcd = ST.getLastContactDays(d.id);
  const lvd = ST.getLastVisitDays(d.id);
  const isAuthorized = ['S','A','B'].includes(d.level);
  const isOverdue = lvd === null || lvd > DEALER_VISIT_OVERDUE_DAYS;

  const _gvHideLvlHealth = _gvHidden('dealers_levelHealth');
  const lvlColor = DEALER_LEVEL_COLOR[d.level] || '#475569';
  const healthColor = h.level === 'good' ? '#22c55e' : h.level === 'warn' ? '#f59e0b' : '#ef4444';

  // แถวยอดขาย/เป้า — ถ้ายังไม่ตั้งเป้าเลย (พบบ่อยกับ Dealer ที่ยัง Level Other) ไม่โชว์ "เป้า ฿0 / Achieve 0%"
  // ให้ดูรกเปล่าประโยชน์ เอาแค่ยอดขายพอ + hint สั้นๆ แทน
  const statsHtml = targetAmt
    ? `<div class="dc-stats">
        <div class="dc-stat"><div class="v c2">${fmtMoneyShort(wonAmt)}</div><div class="l">ยอดขาย</div></div>
        <div class="dc-stat"><div class="v c3">${fmtMoneyShort(targetAmt)}</div><div class="l">เป้า</div></div>
        <div class="dc-stat"><div class="v ${pct>=70?'c2':pct>=40?'c3':'c4'}">${pct}%</div><div class="l">Achieve</div></div>
      </div>
      <div class="pb"><div class="pf ${pct>=70?'pf-green':pct>=40?'pf-yellow':'pf-red'}" style="width:${Math.min(pct,100)}%"></div></div>`
    : `<div class="dc-stats"><div class="dc-stat"><div class="v c2">${fmtMoneyShort(wonAmt)}</div><div class="l">ยอดขาย</div></div>
        <div class="dc-stat" style="opacity:.5"><div class="v">—</div><div class="l">ยังไม่ตั้งเป้า</div></div></div>`;

  // แถว Certification — มีความหมายเฉพาะ Dealer ที่ Authorized แล้ว (S/A/B) เท่านั้น เดิมโชว์ ❌ ทั้งแถวให้ทุกใบ
  // แม้แต่ Dealer ที่ยัง Level Other (ส่วนใหญ่ของลิสต์) กลายเป็น noise ซ้ำๆ ไม่ได้บอกอะไรใหม่
  const certHtml = isAuthorized
    ? `<div class="dc-certs">
        <span class="cert-item ${d.dsecStatus==='pass'?'pass':'fail'}">DSEC ${d.dsecStatus==='pass'?'✅':'❌'}</span>
        <span class="cert-item ${d.crmStatus==='yes'?'pass':'fail'}">CRM ${d.crmStatus==='yes'?'✅':'❌'}</span>
        <span class="cert-item ${d.fh2Status==='pass'?'pass':'fail'}">FH2 ${d.fh2Status==='pass'?'✅':'❌'}</span>
        <span class="cert-item ${d.larkStatus==='added'?'pass':'fail'}">Lark ${d.larkStatus==='added'?'✅':'❌'}</span>
      </div>`
    : `<div class="dc-empty-hint">🔒 ยังไม่เป็น Authorized Dealer</div>`;

  const selCb = dealerSelectMode
    ? `<input type="checkbox" id="dealerChk_${d.id}" ${dealerSelected[d.id] ? 'checked' : ''} onclick="event.stopPropagation();toggleDealerSelect('${d.id}')" style="position:absolute;top:10px;right:10px;width:18px;height:18px;z-index:2">`
    : '';
  const cardClick = dealerSelectMode ? `toggleDealerSelect('${d.id}')` : `go('dealerDetail',{dealerId:'${d.id}'})`;
  return `<div class="dealer-card dc2" style="position:relative" onclick="${cardClick}">
    ${selCb}
    ${_gvHideLvlHealth ? '' : `<div class="dc-accent" style="background:${lvlColor}"></div>`}
    <div class="dc-body">
      <div class="dc-top">
        <div style="min-width:0">
          ${_gvHideLvlHealth ? '' : `<span id="dlvl_${d.id}" class="dc-lvl" style="background:${lvlColor}22;color:${lvlColor}" onclick="event.stopPropagation();_dealerInlineEditLevel('${d.id}')" title="คลิกเพื่อแก้ไข Level">${d.level || 'OTHER'}</span>`}
          ${isOverdue ? '<span class="dc-lvl" style="background:#ef444422;color:#ef4444" title="เกินกำหนด Visit">⚠️ เกินกำหนดเยี่ยม</span>' : ''}
          <h3>${sanitize(d.name)}</h3>
          <div class="meta">${d.contact ? '🧑‍💼 ' + sanitize(d.contact).substr(0,30) : ''} ${d.sisCode ? '• 📋 ' + d.sisCode : ''} ${d.saleName ? '• 👤 ' + sanitize(d.saleName) : ''}</div>
        </div>
        ${_gvHideLvlHealth ? '' : `<div title="Health Score">${progressRingHtml(h.score, {size:36, strokeW:4, color:healthColor, label:h.score})}</div>`}
      </div>

      ${statsHtml}

      <div class="dealer-health">
        <span class="health-dot ${contactColor(lcd)}"></span>
        <span style="font-size:.62rem;color:var(--text2)">ติดต่อ: ${lcd !== null ? lcd + 'd' : '-'}</span>
        <span style="font-size:.62rem;color:var(--text2)">Visit: ${lvd !== null ? lvd + 'd' : '-'}</span>
        <span style="font-size:.62rem;color:var(--text2);margin-left:auto">📊 ${activePipes.length}</span>
      </div>

      ${certHtml}
    </div>
  </div>`;
}

// debounce 350ms เหมือนช่องค้นหาอื่นในแอป (ดู utils.js noteSearchInput/soSearchInput) — เดิมไม่มี debounce
// เลย เรียก _filterDealerListNow ทุกตัวอักษรที่พิมพ์ ซึ่งแพงมากเพราะคำนวณ Health Score ใหม่ทุก Dealer
// (ดูหมายเหตุใน _filterDealerListNow) ทำให้พิมพ์แล้วหน้าจอค้าง
var _dealerFilterTimer = null;
function filterDealerList() {
  clearTimeout(_dealerFilterTimer);
  _dealerFilterTimer = setTimeout(_filterDealerListNow, 350);
}
function _filterDealerListNow() {
  const q = document.getElementById('dSrc')?.value.toLowerCase() || '';
  let dealers = scopedDealers();
  if (dealerFilter !== 'all') {
    if (dealerFilter === 'authorized') dealers = dealers.filter(d => ['S','A','B'].includes(d.level));
    else if (dealerFilter === 'other') dealers = dealers.filter(d => !['S','A','B'].includes(d.level));
    else dealers = dealers.filter(d => d.level === dealerFilter);
  }
  if (Object.keys(dealerSaleFilter).length) dealers = dealers.filter(d => dealerSaleFilter[d.saleName || DEALER_SALE_UNSET]);
  if (q) dealers = dealers.filter(d => d.name?.toLowerCase().includes(q) || d.contact?.toLowerCase().includes(q) || d.sisCode?.toLowerCase().includes(q));

  if (dealerListView === 'table') {
    const wrap = document.getElementById('dTableWrap');
    if (wrap) wrap.innerHTML = dealers.length ? _dealerTableHtml(dealers) : '<div class="empty"><p>ไม่พบ Dealer</p></div>';
    _dealerSelBarRefresh();
    return;
  }

  // ต้องส่ง health เข้า dealerCardHTML เอง (ดู rDealers ด้านบนที่ทำ pattern เดียวกัน) ไม่งั้น dealerCardHTML
  // จะ fallback ไปเรียก calcHealthScore(d.id) แบบไม่มี index ให้ ซึ่งวน ST.pipelineByDealer()/
  // ST.pipeLogsByPipe() ใหม่ทั้ง array ต่อ Dealer/Pipe เอง กลายเป็น O(dealers×pipelines) ทุกครั้งที่กรอง
  const grid = document.getElementById('dGrid');
  if (grid) {
    const _cfg = getConfig();
    const _idx = buildHealthScoreIndexes();
    _dealerVisibleIds = dealers.map(function(d) { return d.id; });
    grid.innerHTML = dealers.length
      ? dealers.map(d => dealerCardHTML(d, calcHealthScore(d.id, _cfg, _idx.pipesByDealer[d.id] || [], _idx.logsByPipe))).join('')
      : '<div class="empty" style="grid-column:1/-1"><p>ไม่พบ Dealer</p></div>';
  }
  _dealerSelBarRefresh();
}
// รีเฟรชแถบเลือกด้านล่างหลังกรอง/ค้นหา (ไม่ re-render ทั้งหน้า) — ล้างรายการที่เลือกไว้ที่หลุดจากผลกรองใหม่ทิ้ง
// กันกดยืนยัน bulk action ไปโดนรายการที่มองไม่เห็นแล้วในหน้าจอ (เพราะ _dealerSelBarHtml ถูกวาดไว้ตอน rDealers
// รอบก่อนหน้า ไม่ได้ re-render ตรงนี้ — แค่ sync จำนวน/checkbox ให้ตรงกับ selection ที่เหลือ)
function _dealerSelBarRefresh() {
  if (!dealerSelectMode) return;
  var visibleSet = {};
  _dealerVisibleIds.forEach(function(id) { visibleSet[id] = true; });
  Object.keys(dealerSelected).forEach(function(id) { if (!visibleSet[id]) delete dealerSelected[id]; });
  _dealerSelBarUpdate(Object.keys(dealerSelected).length);
}

// ================================================================
// DEALER DETAIL (Tab View)
// ================================================================
let dealerTab = 'info';

function rDealerDet(el) {
  const d = ST.getOne('dealers', S.dealerId);
  if (!d) return go('dealers');
  
  const ct = document.getElementById('ct');
  if (ct) {
    ct.style.width = '100%';
    ct.style.maxWidth = '100%';
    ct.style.padding = '16px';
    ct.style.boxSizing = 'border-box';
  }
  
  const main = document.getElementById('main');
  if (main) {
    main.style.width = 'calc(100% - 200px)';
    main.style.maxWidth = 'calc(100% - 200px)';
  }
  
  document.getElementById('pgT').textContent = '🏪 ' + d.name;
  if (S.dealerId !== d.id) {
    dealerPipeSearch = '';
    dealerPipeSelectMode = false;
    dealerPipeSelected = {};
  }
  S.dealerId = d.id;

  if (S.tab === 'forecast') {
    dealerTab = 'forecast';
    delete S.tab;
  }
  
  const isPinned = ST.hasPin(d.id);
  const h = calcHealthScore(d.id);
  el.innerHTML = `
  ${navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : ''}
  <div class="bc">
    <a onclick="go('dealers')">🏪 Dealer</a><span class="sep">›</span>
    <span class="cur">${sanitize(d.name)}</span>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px">
    <div style="display:flex;align-items:center;gap:6px">
      ${_gvHidden('dealers_levelHealth') ? '' : `${levelTag(d.level)}
      <span style="font-size:.72rem;font-weight:700;color:${h.level==='good'?'#22c55e':h.level==='warn'?'#f59e0b':'#ef4444'}">Health: ${h.score}/100</span>`}
    </div>

<div class="bg">
  <button class="btn bsm bs" onclick="startTimer('dealer','${d.id}','${sanitize(d.name)}')">⏱️</button>
  <button class="btn bsm ${isPinned?'bw':'bo'}" onclick="ST.togglePin('dealer','${d.id}','${sanitize(d.name)}','');render()">📌</button>
<button class="btn bsm bo" onclick="showDealerTokenModal('${d.id}')">🔗 สร้างลิงก์</button>
<button class="btn bsm bo" onclick="showDealerAccessModal('${d.id}')">🔗🔒 ลิงก์ & PIN</button>
  <button class="btn bsm bo" onclick="showPreVisitBrief('${d.id}')">📋 เตรียม Visit</button>
<button class="btn bsm bp" onclick="syncDealerPipelineToCustomer('${d.id}')" title="Sync Pipeline ให้ลูกค้า">🔄 Sync</button>
  <button class="btn bsm bo" onclick="showDealerM('${d.id}')">✏️</button>
  <button class="btn bsm bd" onclick="delDealer('${d.id}')">🗑️</button>
</div>

  <div class="tab-bar">
    <div class="tab-btn ${dealerTab==='info'?'act':''}" onclick="dealerTab='info';render()">📋 ข้อมูล</div>
    <div class="tab-btn ${dealerTab==='pipeline'?'act':''}" onclick="dealerTab='pipeline';render()">📊 Pipeline</div>
    <div class="tab-btn ${dealerTab==='quotation'?'act':''}" onclick="dealerTab='quotation';render()">💰 ใบเสนอราคา</div>
    <div class="tab-btn ${dealerTab==='so'?'act':''}" onclick="dealerTab='so';render()">📦 Sales Order</div>
    <div class="tab-btn ${dealerTab==='visit'?'act':''}" onclick="dealerTab='visit';render()">🤝 Visit</div>
    <div class="tab-btn ${dealerTab==='timeline'?'act':''}" onclick="dealerTab='timeline';render()">📝 Timeline</div>
    <div class="tab-btn ${dealerTab==='demo'?'act':''}" onclick="dealerTab='demo';render()">🚁 Demo</div>
    <div class="tab-btn ${dealerTab==='forecast'?'act':''}" onclick="dealerTab='forecast';render()">📦 Forecast</div>
    <div class="tab-btn ${dealerTab==='tasks'?'act':''}" onclick="dealerTab='tasks';render()">📋 งาน</div>
    <div class="tab-btn ${dealerTab==='onboard'?'act':''}" onclick="dealerTab='onboard';render()">🔄 Onboard</div>
    <div class="tab-btn ${dealerTab==='announcements'?'act':''}" onclick="dealerTab='announcements';render()">📢 ประกาศ</div>
  </div>

  <div id="dealerTabContent">${renderDealerTab(d)}</div>`;

  if (dealerTab === 'pipeline' && dealerPipeViewMode === 'sheetedit') {
    var _d = d;
    setTimeout(function() { initDealerPipeSheet(ST.pipelineByDealer(_d.id)); }, 0);
  }
}

function renderDealerTab(d) {
  switch (dealerTab) {
    case 'info': return dealerInfoTab(d);
    case 'pipeline': return dealerPipelineTab(d);
    case 'quotation': return dealerQuotationTab(d);
    case 'so': return dealerSalesOrderTab(d);
    case 'visit': return dealerVisitTab(d);
    case 'timeline': return dealerTimelineTab(d);
    case 'demo': return dealerDemoTab(d);
    case 'forecast': return dealerForecastTab(d);
    case 'tasks': return dealerTasksTab(d);
    case 'onboard': return dealerOnboardTab(d);
    case 'announcements': return dealerAnnouncementsTab(d);
    default: return dealerInfoTab(d);
  }
}

// ================================================================
// TAB: INFO (Redesigned - Premium) WITH SIS REVENUE
// ================================================================
// แท็บย่อยภายในแท็บ "📋 ข้อมูล" ของหน้า Dealer — เดิมยัดการ์ดข้อมูลบริษัท/ผู้ติดต่อ/ธุรกิจ/Certification/
// สุขภาพองค์กร/หมายเหตุ/รายชื่อผู้ติดต่อ/อีเมล/LINE ต่อกันยาวมากในแท็บเดียว (แยกจากแท็บ Pipeline/Visit/
// Timeline ฯลฯ ที่มีแท็บของตัวเองอยู่แล้ว ไม่แตะ) — สลับด้วย CSS display ล้วนๆ ไม่ re-render (2026-08-27)
var _diActiveTab = 'overview';
function _diTabClick(tab) {
  _diActiveTab = tab;
  document.querySelectorAll('.stab-pane[data-diowner]').forEach(function(el) {
    el.style.display = el.getAttribute('data-stab') === tab ? '' : 'none';
  });
  document.querySelectorAll('.stab-btn[data-diowner]').forEach(function(b) {
    var on = b.getAttribute('data-stab') === tab;
    b.classList.toggle('bp', on);
    b.classList.toggle('bo', !on);
  });
}

function dealerInfoTab(d) {
  const pipes = ST.pipelineByDealer(d.id);
  const wonAmt = pipes.filter(p => pipeIsWon(p)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const targetAmt = Number(d.targetRevenue) || 0;
  const pct = targetAmt ? Math.round(wonAmt / targetAmt * 100) : 0;
  const h = calcHealthScore(d.id);
  const lcd = ST.getLastContactDays(d.id);
  const lvd = ST.getLastVisitDays(d.id);

  const healthColor = h.level === 'good' ? '#22c55e' : h.level === 'warn' ? '#f59e0b' : '#ef4444';
  
  const certs = [
    { name: 'DSEC', status: d.dsecStatus, pass: d.dsecStatus === 'pass' },
    { name: 'CRM', status: d.crmStatus, pass: d.crmStatus === 'yes' },
    { name: 'FH2', status: d.fh2Status, pass: d.fh2Status === 'pass' },
    { name: 'Lark', status: d.larkStatus, pass: d.larkStatus === 'added' }
  ];

  return `
  <div style="background: linear-gradient(135deg, var(--card) 0%, rgba(59,130,246,0.05) 100%); border-radius: 16px; padding: 20px; margin-bottom: 20px; border: 1px solid var(--border); position: relative; overflow: hidden">
    <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--accent), #60a5fa, #a855f7)"></div>
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px">
      <div>
        <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px">🏢 ${sanitize(d.name)}</div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px">
          ${_gvHidden('dealers_levelHealth') ? '' : levelTag(d.level)}
          <span style="font-size: 12px; color: var(--text2)">📋 SIS: ${d.sisCode || '-'}</span>
          <span style="font-size: 12px; color: var(--text2)">🔢 DJI: ${d.djiCode || '-'}</span>
          <span style="font-size: 12px; color: var(--text2)">🏪 DJI Dealer: ${d.djiDealer || '-'}</span>
        </div>
        ${!['S','A','B'].includes(d.level) ? '<button class="btn bsm bp" style="margin-top:8px" onclick="markDealerAuthorized(\'' + d.id + '\')">🌟 Mark เป็น Authorized Dealer</button>' : ''}
      </div>
      ${_gvHidden('dealers_levelHealth') ? '' : `<div style="text-align: right">
        <div style="font-size: 32px; font-weight: 800; color: ${healthColor}">${h.score}/100</div>
        <div style="font-size: 11px; color: var(--text2)">Health Score</div>
      </div>`}
    </div>
  </div>

  <div class="sr" style="margin-bottom: 20px">
    <div class="sc"><div class="sn c2">${fmtMoneyShort(wonAmt)}</div><div class="sl">ยอดขาย Won</div></div>
    <div class="sc"><div class="sn c3">${fmtMoneyShort(targetAmt)}</div><div class="sl">เป้ายอดขาย</div></div>
    <div class="sc"><div class="sn ${pct >= 70 ? 'c2' : pct >= 40 ? 'c3' : 'c4'}">${pct}%</div><div class="sl">Achievement</div></div>
    <div class="sc"><div class="sn c1">${pipes.filter(p => pipeIsOpen(p)).length}</div><div class="sl">Pipeline Active</div></div>
  </div>

  <div class="stab-bar">
    <button class="btn bsm stab-btn ${_diActiveTab === 'overview' ? 'bp' : 'bo'}" data-diowner="1" data-stab="overview" onclick="_diTabClick('overview')">🏢 ภาพรวม</button>
    <button class="btn bsm stab-btn ${_diActiveTab === 'health' ? 'bp' : 'bo'}" data-diowner="1" data-stab="health" onclick="_diTabClick('health')">🏥 สุขภาพ &amp; หมายเหตุ</button>
    <button class="btn bsm stab-btn ${_diActiveTab === 'contacts' ? 'bp' : 'bo'}" data-diowner="1" data-stab="contacts" onclick="_diTabClick('contacts')">👥 ผู้ติดต่อ</button>
    <button class="btn bsm stab-btn ${_diActiveTab === 'comm' ? 'bp' : 'bo'}" data-diowner="1" data-stab="comm" onclick="_diTabClick('comm')">📧 อีเมล &amp; LINE</button>
  </div>

  <div class="stab-pane" data-diowner="1" data-stab="overview" ${_diActiveTab !== 'overview' ? 'style="display:none"' : ''}>
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px">

    <div class="card" style="margin-bottom: 0">
      <h2>🏢 ข้อมูลบริษัท</h2>
      <div style="display: flex; flex-direction: column; gap: 10px">
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">🧾</span>
          <div><div style="font-size: 10px; color: var(--text2)">Tax ID</div><div style="font-size: 13px; font-weight: 500">${d.taxId ? qcopyHtml(d.taxId) : '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">📋</span>
          <div><div style="font-size: 10px; color: var(--text2)">SIS Code</div><div style="font-size: 13px; font-weight: 500">${d.sisCode ? qcopyHtml(d.sisCode) : '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">🔢</span>
          <div><div style="font-size: 10px; color: var(--text2)">DJI Code</div><div style="font-size: 13px; font-weight: 500">${d.djiCode ? qcopyHtml(d.djiCode) : '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">🏪</span>
          <div><div style="font-size: 10px; color: var(--text2)">DJI Dealer Type</div><div style="font-size: 13px; font-weight: 500">${d.djiDealer || '-'}</div></div>
        </div>
        ${(_gvHidden('dealers_levelHealth') && _gvHidden('dealers_creditTerm')) ? '' : `<div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">🏷️</span>
          <div><div style="font-size: 10px; color: var(--text2)">Level / Term</div><div style="font-size: 13px; font-weight: 500">${_gvHidden('dealers_levelHealth') ? '' : levelTag(d.level)}${(_gvHidden('dealers_levelHealth') || _gvHidden('dealers_creditTerm')) ? '' : ' / '}${_gvHidden('dealers_creditTerm') ? '' : (d.creditTerm || '-')}</div></div>
        </div>`}
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">💳</span>
          <div><div style="font-size: 10px; color: var(--text2)">วงเงินเครดิต</div><div style="font-size: 13px; font-weight: 500">${d.creditLimit ? fmtMoney(d.creditLimit) + ' ฿' : '-'}</div></div>
        </div>
        <!-- ✅ ADD SIS REVENUE SECTION -->
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">💰</span>
          <div style="flex:1">
            <div style="font-size: 10px; color: var(--text2)">ยอดขาย SIS ปี ${new Date().getFullYear()} (บาท)</div>
            <div style="font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
              <span>H1: ${fmtMoney(getSisRevenueForYear(d, new Date().getFullYear()).h1 || 0)}</span>
              <span>H2: ${fmtMoney(getSisRevenueForYear(d, new Date().getFullYear()).h2 || 0)}</span>
              <button class="btn bsm bo" onclick="showEditSisRevenueModal('${d.id}')" style="padding: 2px 8px; font-size: 10px">✏️ แก้ไข / ดูปีอื่น</button>
              <span style="font-size: 10px; color: var(--text3)">${d.sisRevenueUpdatedAt ? 'อัพเดท ' + fD(d.sisRevenueUpdatedAt) : ''}</span>
            </div>
            <div style="font-size: 10.5px; color: var(--text3); margin-top: 4px; display:flex; gap:10px; flex-wrap:wrap">
              ${['q1','q2','q3','q4'].map(function(qk,i){ var v=getSisRevenueForYear(d,new Date().getFullYear())[qk]||0; return 'Q'+(i+1)+': '+fmtMoneyShort(v); }).join(' · ')}
            </div>
            ${d.sisRevenueNote ? '<div style="font-size: 10px; color: var(--text3); margin-top: 4px">📝 ' + sanitize(d.sisRevenueNote) + '</div>' : ''}
          </div>
        </div>
        ${d.googleMap ? `<div style="display: flex; align-items: center; gap: 12px">
          <span style="font-size: 18px">📍</span>
          <div><div style="font-size: 10px; color: var(--text2)">Location</div>
            <div style="font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px">
              <a href="${d.googleMap}" target="_blank" rel="noopener">เปิดแผนที่ ↗</a>
              <button class="qcopy-btn" style="opacity: 1; position: static" onclick="event.stopPropagation();copyToClip('${d.googleMap.replace(/'/g, "\\'")}')" title="คัดลอกลิงก์">📋</button>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>

    <div class="card" style="margin-bottom: 0">
      <h2>👤 ผู้ติดต่อ</h2>
      <div style="display: flex; flex-direction: column; gap: 10px">
        <div style="display: flex; align-items: flex-start; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">📞</span>
          <div><div style="font-size: 10px; color: var(--text2)">เบอร์ติดต่อ</div><div style="font-size: 13px; font-weight: 500">${d.contact ? qcopyHtml(d.contact) : '-'}</div></div>
        </div>
        <div style="display: flex; align-items: flex-start; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">📝</span>
          <div><div style="font-size: 10px; color: var(--text2)">รายละเอียดลูกค้า</div><div style="font-size: 12px; color: var(--text3)">${d.customerDetail ? sanitize(d.customerDetail) : '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="font-size: 18px">🚚</span>
          <div><div style="font-size: 10px; color: var(--text2)">Shippto</div><div style="font-size: 13px; font-weight: 500">${d.shippto || 'NO'}</div></div>
        </div>
        ${d.attachments && d.attachments.length ? `<div style="display: flex; align-items: flex-start; gap: 12px; padding-top: 8px"><span style="font-size: 18px">📷</span><div>${attachGalleryHtml(d.attachments)}</div></div>` : ''}
      </div>
    </div>

    <div class="card" style="margin-bottom: 0">
      <h2>💼 ธุรกิจ & การเงิน</h2>
      <div style="display: flex; flex-direction: column; gap: 10px">
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">💰</span>
          <div><div style="font-size: 10px; color: var(--text2)">เป้ายอดขาย / Won</div><div style="font-size: 13px; font-weight: 500">${targetAmt ? fmtMoney(targetAmt) + ' ฿' : '-'} → ${fmtMoney(wonAmt)} ฿</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">📊</span>
          <div><div style="font-size: 10px; color: var(--text2)">Demo Unit</div><div style="font-size: 13px; font-weight: 500">${d.demoUnit || '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">🎯</span>
          <div><div style="font-size: 10px; color: var(--text2)">กลุ่มลูกค้าหลัก</div><div style="font-size: 13px; font-weight: 500">${d.customerSegment || '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="font-size: 18px">📅</span>
          <div><div style="font-size: 10px; color: var(--text2)">หนังสือแต่งตั้ง</div><div style="font-size: 13px; font-weight: 500">${d.appointmentLetter || '-'} ${d.appointmentDate ? '(' + fD(d.appointmentDate) + ')' : ''}</div></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 0">
      <h2>📋 Certification</h2>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px">
        ${certs.map(cert => `
          <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bg3); border-radius: 8px; border: 1px solid ${cert.pass ? '#22c55e' : 'var(--border)'}">
            <span style="font-size: 18px">${cert.pass ? '✅' : '❌'}</span>
            <div><div style="font-size: 12px; font-weight: 600">${cert.name}</div><div style="font-size: 10px; color: var(--text3)">${cert.status || 'ยังไม่ทำ'}</div></div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
  </div>

  <div class="stab-pane" data-diowner="1" data-stab="health" ${_diActiveTab !== 'health' ? 'style="display:none"' : ''}>
  <div class="card">
    <h2>🏥 สุขภาพองค์กร — รายละเอียด</h2>
    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px">
      ${h.details.map(det => `
        <div style="text-align: center; padding: 10px; background: var(--bg3); border-radius: 10px">
          <div style="font-size: 20px; font-weight: 800; color: ${det.status === 'good' ? '#22c55e' : det.status === 'warn' ? '#f59e0b' : '#ef4444'}">${det.score}/${det.max}</div>
          <div style="font-size: 10px; color: var(--text2)">${det.label}</div>
        </div>
      `).join('')}
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text2); padding-top: 12px; border-top: 1px solid var(--border)">
      <span>📞 ติดต่อล่าสุด: ${lcd !== null ? lcd + ' วัน (' + fD(ST.getLastContactDate(d.id)) + ')' : 'ไม่เคย'}</span>
      <span>🤝 Visit ล่าสุด: ${lvd !== null ? lvd + ' วัน (' + fD(ST.getLastVisitDate(d.id)) + ')' : 'ไม่เคย'}</span>
    </div>
  </div>

  ${(d.paymentCondition || d.notes) ? `
  <div class="card">
    <h2>📝 หมายเหตุเพิ่มเติม</h2>
    ${d.paymentCondition ? `<div style="margin-bottom: 8px"><label style="font-size: 11px; color: var(--text2)">เงื่อนไขชำระเงิน</label><div style="font-size: 13px; white-space: pre-wrap">${sanitize(d.paymentCondition)}</div></div>` : ''}
    ${d.notes ? `<div><label style="font-size: 11px; color: var(--text2)">หมายเหตุ</label><div style="font-size: 13px; white-space: pre-wrap">${sanitize(d.notes)}</div></div>` : ''}
  </div>
  ` : ''}
  </div>

  <div class="stab-pane" data-diowner="1" data-stab="contacts" ${_diActiveTab !== 'contacts' ? 'style="display:none"' : ''}>
  ${renderDealerContacts(d)}
  </div>

  <div class="stab-pane" data-diowner="1" data-stab="comm" ${_diActiveTab !== 'comm' ? 'style="display:none"' : ''}>
  ${renderDealerLoopEmailCard(d)}

  ${renderDealerEmailHistoryCard(d)}

  <div class="card">
    <h2>💬 LINE Support <span class="ml"><button class="btn bsm bp" onclick="showLineLogM('${d.id}')">➕</button></span></h2>
    ${renderLineLog(d.id, 5)}
  </div>
  </div>`;
}

function certField(name, status, count, lastCheck) {
  const pass = status === 'pass' || status === 'yes' || status === 'added';
  return `<div style="padding:6px 8px;background:#0f172a;border:1px solid ${pass?'#22c55e':'#475569'};border-radius:6px">
    <div style="font-size:.72rem;display:flex;justify-content:space-between"><span>${name}</span><span>${pass?'✅':'❌'}</span></div>
    ${count ? `<div style="font-size:.66rem;color:var(--text2)">${count} ใบ</div>` : ''}
    ${lastCheck ? `<div style="font-size:.62rem;color:var(--text3)">เช็ค: ${fDShort(lastCheck)}</div>` : ''}
  </div>`;
}

function renderLineLog(dealerId, limit) {
  const cfg = getConfig();
  const logs = ST.lineLogByDealer(dealerId).slice(0, limit || 999);
  if (!logs.length) return '<div class="empty"><p>ยังไม่มี</p></div>';
  return logs.map(l => {
    const lt = cfg.lineLogTypes.find(t => t.id === l.logType) || {};
    return `<div class="line-item" style="padding:6px 8px">
      <div class="line-type ${lt.cls||'line-type-info'}" style="min-width:60px">${lt.name||l.logType}</div>
      <div style="flex:1"><div style="font-size:.76rem">${sanitize(l.summary||'')}</div>
      <div style="font-size:.6rem;color:var(--text2)">${fD(l.date)} ${l.time||''}</div></div>
      <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('lineLog','${l.id}');render()">✕</button>
    </div>`;
  }).join('');
}

// ================================================================
// TAB: PIPELINE
// ================================================================
function dealerPipelineTab(d) {
  var pipes = ST.pipelineByDealer(d.id);
  var activeCount = 0;
  var activeAmt = 0;
  var totalAmt = 0;
  var wonAmt = 0;
  var lostAmt = 0;
  var wonCount = 0;
  var lostCount = 0;

  pipes.forEach(function(p) {
    var amt = Number(p.forecastAmount) || 0;
    totalAmt += amt;
    if (pipeIsOpen(p)) {
      activeCount++;
      activeAmt += amt;
    }
    if (pipeIsWon(p)) {
      wonCount++;
      wonAmt += amt;
    }
    if (p.status === 'fail_lost') {
      lostCount++;
      lostAmt += amt;
    }
  });

  var h = '<div class="card"><h2>📊 Pipeline (' + activeCount + ' active / ' + pipes.length + ' total)';
  h += '<span class="ml">';
  h += '<button class="btn bsm bo" onclick="importPipelineXlsx(\'' + d.id + '\')" title="Import ไฟล์ Excel">📂 xlsx</button>';
  h += '<button class="btn bsm bo" onclick="showPastePipelineM(\'' + d.id + '\')" title="วาง Excel">📋 วาง</button>';
  h += '<button class="btn bsm bo" onclick="showPipeExportLogFilterM(\'csvDealer\',\'' + d.id + '\')" title="Export CSV">📤 CSV</button>';
  h += '<button class="btn bsm bo" onclick="showPipeExportLogFilterM(\'xlsxDealer\',\'' + d.id + '\')" title="Export Excel">📤 xlsx</button>';
  h += '<button class="btn bsm bo" onclick="copyDealerPipeline(\'' + d.id + '\')" title="Copy">📋</button>';
  h += '<button class="btn bsm ' + (dealerPipeViewMode === 'table' ? 'bp' : 'bo') + '" onclick="dealerPipeViewMode=dealerPipeViewMode===\'table\'?\'list\':\'table\';render()" title="มุมมองตาราง (แบบเมนู Pipeline)">🗒️</button>';
  h += '<button class="btn bsm ' + (dealerPipeViewMode === 'sheet' ? 'bp' : 'bo') + '" onclick="dealerPipeViewMode=dealerPipeViewMode===\'sheet\'?\'list\':\'sheet\';render()" title="มุมมอง Sheet เต็มคอลัมน์">📊</button>';
  h += '<button class="btn bsm ' + (dealerPipeViewMode === 'sheetedit' ? 'bp' : 'bo') + '" onclick="dealerPipeViewMode=dealerPipeViewMode===\'sheetedit\'?\'list\':\'sheetedit\';render()" title="แก้ไขแบบตาราง">🗂️</button>';
  h += '<button class="btn bsm bp" onclick="showPipelineM(\'' + d.id + '\')">➕</button>';
  h += '</span></h2>';

  h += '<div class="sr" style="margin-bottom:8px">';
  h += '<div class="sc"><div class="sn c1">' + pipes.length + '</div><div class="sl">ทั้งหมด</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(activeAmt) + '</div><div class="sl">Active (' + activeCount + ')</div></div>';
  h += '<div class="sc"><div class="sn c5">' + fmtMoneyShort(totalAmt) + '</div><div class="sl">Total</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(wonAmt) + '</div><div class="sl">Won (' + wonCount + ')</div></div>';
  h += '<div class="sc"><div class="sn c4">' + fmtMoneyShort(lostAmt) + '</div><div class="sl">Lost (' + lostCount + ')</div></div>';
  h += '</div>';

  h += _pipeUrgentBarHtml(pipes);

  if (pipes.length && dealerPipeViewMode === 'sheetedit') {
    h += '<div id="dealerPipeSheetEl" style="overflow-x:auto"></div>';
    h += '<div style="margin-top:8px;display:flex;gap:8px;align-items:center">';
    h += '<button class="btn bp" onclick="saveDealerPipeSheet()">💾 บันทึกทั้งหมด</button>';
    h += '<button class="btn bo" onclick="recalcAllDealerPipeQty()" title="คำนวณ Qty จาก Model">🔄 Qty</button>';
    h += '<button class="btn bo" onclick="calcAllDealerPipeRevenue()" title="คำนวณ Revenue จาก Qty × ราคาตาม Dealer Level">💰 Revenue</button>';
    h += '<button id="btnDealerPipeUndo" class="btn bo" style="display:none" onclick="undoDealerPipeSheet()" title="คืนค่าก่อน recalc ครั้งล่าสุด">↩️ Undo</button>';
    h += '<span id="dealerPipeSheetStatus" style="font-size:.8rem;color:var(--text2)"></span>';
    h += '</div>';
  } else if (pipes.length && dealerPipeViewMode === 'sheet') {
    h += renderPipeSheetTable(pipes);
  } else {
    // search + sort controls
    h += '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">';
    h += '<input type="text" id="dealerPipeSrc" placeholder="🔍 ค้นหา Row No. / Project / End User..." style="flex:1;min-width:140px;font-size:12px" value="' + sanitize(dealerPipeSearch) + '" oninput="dealerPipeSearchInput(this.value)" autocomplete="off">';
    h += '<select style="font-size:12px" onchange="dealerPipeSort=this.value;render()">';
    h += '<option value="updated_desc"' + (dealerPipeSort==='updated_desc'?' selected':'') + '>🔄 อัพเดทล่าสุด</option>';
    h += '<option value="date_desc"' + (dealerPipeSort==='date_desc'?' selected':'') + '>วันที่ลงทะเบียน ใหม่สุด</option>';
    h += '<option value="date_asc"'  + (dealerPipeSort==='date_asc' ?' selected':'') + '>วันที่ลงทะเบียน เก่าสุด</option>';
    h += '<option value="amount_desc"'+(dealerPipeSort==='amount_desc'?' selected':'') + '>มูลค่า มากสุด</option>';
    h += '<option value="bidding"'   + (dealerPipeSort==='bidding'  ?' selected':'') + '>Bidding ใกล้สุด</option>';
    h += '<option value="status"'    + (dealerPipeSort==='status'   ?' selected':'') + '>ตาม Status</option>';
    h += '<option value="rowno_asc"' + (dealerPipeSort==='rowno_asc'?' selected':'') + '>🔢 Row No. น้อย→มาก</option>';
    h += '<option value="rowno_desc"'+ (dealerPipeSort==='rowno_desc'?' selected':'') + '>🔢 Row No. มาก→น้อย</option>';
    h += '</select>';
    h += '<select onchange="dealerPipeDisplayFlt=this.value;render()" style="font-size:12px;min-width:105px">';
    h += '<option value="all"'  + (dealerPipeDisplayFlt==='all'  ?' selected':'') + '>👁 ทั้งหมด</option>';
    h += '<option value="show"' + (dealerPipeDisplayFlt==='show' ?' selected':'') + '>✅ Focus (Show)</option>';
    h += '<option value="hide"' + (dealerPipeDisplayFlt==='hide' ?' selected':'') + '>🙈 ซ่อน (Hide)</option>';
    h += '</select>';
    h += '<button class="btn bsm ' + (dealerPipeHideArchived ? 'bo' : 'bp') + '" onclick="toggleDealerPipeHideArchived()" title="Archived = Win/Fail&Lost/Deliver/Hide">🗄️ ' + (dealerPipeHideArchived ? 'ซ่อน Archived (' + pipes.filter(pipeIsArchived).length + ')' : 'กำลังแสดง Archived') + '</button>';
    if (dealerPipeViewMode !== 'table') {
      h += '<button class="btn bsm ' + (dealerPipeSelectMode ? 'bd' : 'bo') + '" onclick="toggleDealerPipeSelectMode()">☑️ ' + (dealerPipeSelectMode ? 'ยกเลิก' : 'เลือก') + '</button>';
      h += '<div style="display:flex;gap:4px;border:1px solid var(--border);border-radius:8px;overflow:hidden">' +
        '<button class="btn-xs" style="border-radius:0;' + (dealerPipeCardCols === 1 ? 'background:var(--accent);color:#fff' : '') + '" onclick="dealerPipeCardCols=1;render()" title="1 การ์ดต่อแถว">⚏1</button>' +
        '<button class="btn-xs" style="border-radius:0;' + (dealerPipeCardCols === 2 ? 'background:var(--accent);color:#fff' : '') + '" onclick="dealerPipeCardCols=2;render()" title="2 การ์ดต่อแถว">⚏2</button>' +
        '</div>';
    }
    h += '</div>';

    // แถบสถานะเลือกได้หลายช่อง + แถบเดือน Bidding Date — แบบเดียวกับเมนู Pipeline หลัก/Pipeline รวมทีม
    (function() {
      var statusSummary = {};
      getConfig().pipelineStatuses.forEach(function(s) {
        var items = pipes.filter(function(p) { return p.status === s.id; });
        if (items.length) statusSummary[s.id] = { count: items.length, amount: items.reduce(function(a, p) { return a + (Number(p.forecastAmount) || 0); }, 0), name: s.name, color: s.color };
      });
      var totalAmtAll = pipes.reduce(function(s, p) { return s + (Number(p.forecastAmount) || 0); }, 0);
      h += '<div class="hint" style="margin-bottom:4px">สถานะ (เลือกได้หลายช่อง — ไม่เลือกเลย = ทั้งหมด)</div>';
      h += '<div class="pipe-sum">';
      Object.entries(statusSummary).forEach(function(e) {
        var k = e[0], v = e[1];
        h += '<div class="pipe-sum-card ' + (dealerPipeStatusFlt[k] ? 'act' : '') + '" onclick="toggleDealerPipeStatus(\'' + k + '\')">' +
          '<div class="stage" style="color:' + (v.color || '#94a3b8') + '">' + v.name + '</div>' +
          '<div class="count">' + v.count + '</div>' +
          '<div class="amount">' + fmtMoneyShort(v.amount) + '</div></div>';
      });
      h += '<div class="pipe-sum-card ' + (Object.keys(dealerPipeStatusFlt).length === 0 ? 'act' : '') + '" onclick="clearDealerPipeStatusFlt()">' +
        '<div class="stage">📊 ทั้งหมด</div><div class="count">' + pipes.length + '</div><div class="amount">' + fmtMoneyShort(totalAmtAll) + '</div></div>';
      h += '</div>';
      h += pipeSelectedSubtotalHtml(dealerPipeStatusFlt, statusSummary);
      h += '<div class="hint" style="margin:8px 0 4px">📅 Bidding Date เดือนไหนบ้าง (ไม่เลือก = ทุกเดือน)</div>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px">';
      ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'].forEach(function(mn, idx) {
        var on = !!dealerPipeBidMonthFlt[idx];
        h += '<span onclick="toggleDealerPipeBidMonth(' + idx + ')" style="cursor:pointer;font-size:.72rem;padding:4px 10px;border-radius:14px;' +
          (on ? 'background:var(--accent);color:#fff' : 'background:var(--bg2);border:1px solid var(--border);color:var(--text2)') + '">' + mn + '</span>';
      });
      if (Object.keys(dealerPipeBidMonthFlt).length) h += '<button class="btn bsm bo" onclick="clearDealerPipeBidMonthFlt()">✕ ล้าง</button>';
      h += '</div>';
    })();

    // apply search + display filter + sort
    var listPipes = pipes.slice();
    if (Object.keys(dealerPipeStatusFlt).length) listPipes = listPipes.filter(function(p) { return dealerPipeStatusFlt[p.status]; });
    if (Object.keys(dealerPipeBidMonthFlt).length) {
      listPipes = listPipes.filter(function(p) {
        var bd = fcParseDate(p.biddingDate);
        return bd && dealerPipeBidMonthFlt[bd.getMonth()];
      });
    }
    if (dealerPipeDisplayFlt === 'show') listPipes = listPipes.filter(function(p) { return (p.sheetDisplay || 'Show') !== 'Hide'; });
    else if (dealerPipeDisplayFlt === 'hide') listPipes = listPipes.filter(function(p) { return (p.sheetDisplay || 'Show') === 'Hide'; });
    if (dealerPipeHideArchived) listPipes = listPipes.filter(function(p) { return !pipeIsArchived(p); });
    if (dealerPipeSearch) {
      var q = dealerPipeSearch.toLowerCase();
      listPipes = listPipes.filter(function(p) {
        return (p.projectName||'').toLowerCase().indexOf(q) !== -1 ||
               (p.endUserTH||'').toLowerCase().indexOf(q) !== -1 ||
               (p.endUserEN||'').toLowerCase().indexOf(q) !== -1 ||
               (p.remark||'').toLowerCase().indexOf(q) !== -1 ||
               String(p.rowNo||'').toLowerCase().indexOf(q) !== -1;
      });
    }
    var statusOrder = ['bidding','initial','on_process','draft_tor','win','contracting','deliver','fail_lost'];
    switch (dealerPipeSort) {
      case 'date_asc':   listPipes.sort(function(a,b){ return (a.registerDate||'').localeCompare(b.registerDate||''); }); break;
      case 'date_desc':  listPipes.sort(function(a,b){ return (b.registerDate||'').localeCompare(a.registerDate||''); }); break;
      case 'amount_desc':listPipes.sort(function(a,b){ return (Number(b.forecastAmount)||0)-(Number(a.forecastAmount)||0); }); break;
      case 'bidding':    listPipes.sort(function(a,b){ return (a.biddingDate||'9999').localeCompare(b.biddingDate||'9999'); }); break;
      case 'status':     listPipes.sort(function(a,b){ var ia=statusOrder.indexOf(a.status); var ib=statusOrder.indexOf(b.status); if(ia===-1)ia=99; if(ib===-1)ib=99; return ia-ib; }); break;
      case 'rowno_asc':
      case 'rowno_desc':
        listPipes.sort(function(a,b){
          var ra=parseFloat(a.rowNo), rb=parseFloat(b.rowNo);
          var na=isNaN(ra), nb=isNaN(rb);
          if (na && nb) return 0;
          if (na) return 1;
          if (nb) return -1;
          return dealerPipeSort==='rowno_asc' ? ra-rb : rb-ra;
        });
        break;
      default:           listPipes.sort(function(a,b){ return (b.updated||b.created||'').localeCompare(a.updated||a.created||''); }); break;
    }
    if (pipeUrgentFlt) {
      var _todayISO3 = _td();
      listPipes = listPipes.filter(function(p) {
        if (!pipeIsActive(p)) return false;
        if (pipeUrgentFlt === 'bid7' || pipeUrgentFlt === 'bid30') {
          if (!p.biddingDate) return false;
          var bd = dTo(p.biddingDate);
          return pipeUrgentFlt === 'bid7' ? (bd >= 0 && bd <= 7) : (bd > 7 && bd <= 30);
        }
        if (pipeUrgentFlt === 'stale90') {
          var lastLog = ST.pipeLogsByPipe(p.id)[0];
          var lastActivityDate = (lastLog && lastLog.date) ? lastLog.date.split('T')[0] : (p.registerDate || (p.created ? p.created.split('T')[0] : ''));
          return lastActivityDate && daysBetween(lastActivityDate, _todayISO3) > 90;
        }
        return true;
      });
    }

    _dealerPipeVisibleIds = listPipes.map(function(p){ return p.id; });

    if (!listPipes.length) {
      h += '<div class="empty"><p>' + (dealerPipeSearch ? 'ไม่พบผลการค้นหา' : 'ยังไม่มี Pipeline') + '</p></div>';
    } else if (dealerPipeViewMode === 'table') {
      // ใช้ตารางชุดเดียวกับเมนู Pipeline หลัก (renderPipeTable) — ได้ inline-edit + tooltip + สไตล์เดียวกันฟรี
      h += renderPipeTable(listPipes);
    } else {
      // ใช้การ์ดชุดเดียวกับเมนู Pipeline หลัก (renderPipeCards) ให้หน้าตาตรงกันเป๊ะ — ไม่ต้องดูแล 2 ดีไซน์แยกกัน
      h += renderPipeCards(listPipes, { selectMode: dealerPipeSelectMode, selectedMap: dealerPipeSelected, toggleFn: 'toggleDealerPipeSelect', cardCols: dealerPipeCardCols });

      if (dealerPipeSelectMode) {
        var selCnt = Object.keys(dealerPipeSelected).length;
        h += '<div class="sel-bar" style="background:var(--card);border-top:2px solid var(--accent);padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:4px">' +
          '<span style="font-size:13px;font-weight:600;min-width:80px" id="dpSelCount">' + selCnt + ' รายการที่เลือก</span>' +
          '<button class="btn bo bsm" onclick="toggleDealerPipeSelectAll(true)">เลือกทั้งหมด (' + _dealerPipeVisibleIds.length + ')</button>' +
          '<button class="btn bo bsm" onclick="toggleDealerPipeSelectAll(false)">ยกเลิกเลือก</button>' +
          '<button class="btn bd" id="dpSelDelBtn" ' + (!selCnt ? 'disabled' : '') + ' onclick="bulkDeleteDealerPipes()">🗑️ ลบที่เลือก (' + selCnt + ')</button>' +
          '<button class="btn bo bsm" style="margin-left:auto" onclick="toggleDealerPipeSelectMode()">✕ ออก</button>' +
          '</div>';
      }
    }
    if (dealerPipeSearch || listPipes.length !== pipes.length) {
      h += '<div style="font-size:.64rem;color:var(--text2);margin-top:4px">' + listPipes.length + ' / ' + pipes.length + ' รายการ</div>';
    }
  }

  h += '</div>';
  return h;
}

function toggleDealerPipeSelectMode() {
  dealerPipeSelectMode = !dealerPipeSelectMode;
  dealerPipeSelected = {};
  render();
}

function toggleDealerPipeSelect(id) {
  if (dealerPipeSelected[id]) delete dealerPipeSelected[id];
  else dealerPipeSelected[id] = true;
  var cb = document.getElementById('dpChk_' + id);
  if (cb) cb.checked = !!dealerPipeSelected[id];
  var cnt = Object.keys(dealerPipeSelected).length;
  var countEl = document.getElementById('dpSelCount');
  if (countEl) countEl.textContent = cnt + ' รายการที่เลือก';
  var delBtn = document.getElementById('dpSelDelBtn');
  if (delBtn) { delBtn.disabled = !cnt; delBtn.textContent = '🗑️ ลบที่เลือก (' + cnt + ')'; }
}

function toggleDealerPipeSelectAll(selectAll) {
  dealerPipeSelected = {};
  if (selectAll) _dealerPipeVisibleIds.forEach(function(id) { dealerPipeSelected[id] = true; });
  _dealerPipeVisibleIds.forEach(function(id) {
    var cb = document.getElementById('dpChk_' + id);
    if (cb) cb.checked = !!dealerPipeSelected[id];
  });
  var cnt = Object.keys(dealerPipeSelected).length;
  var countEl = document.getElementById('dpSelCount');
  if (countEl) countEl.textContent = cnt + ' รายการที่เลือก';
  var delBtn = document.getElementById('dpSelDelBtn');
  if (delBtn) { delBtn.disabled = !cnt; delBtn.textContent = '🗑️ ลบที่เลือก (' + cnt + ')'; }
}

function bulkDeleteDealerPipes() {
  var ids = Object.keys(dealerPipeSelected);
  if (!ids.length) return;
  if (!confirm('ลบ ' + ids.length + ' Pipeline ที่เลือก?\nไม่สามารถกู้คืนได้')) return;
  ids.forEach(function(id) {
    ST.delete('pipeline', id);
    ST.deleteWhere('pipeLog', function(l) { return l.pipeId === id; });
    if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('pipeline', id);
  });
  dealerPipeSelected = {};
  dealerPipeSelectMode = false;
  toast('🗑️ ลบแล้ว ' + ids.length + ' รายการ');
  render();
}

function copyDealerPipeline(dealerId) {
  var pipes = ST.pipelineByDealer(dealerId);
  var d = ST.getOne('dealers', dealerId);
  var tsv = '#\tProject\tEnd User\tModel\tQTY\tForecast\tStatus\tBidding\n';
  pipes.forEach(function(p, idx) {
    tsv += (idx + 1) + '\t' + (p.projectName || '') + '\t' + (p.endUserTH || '') + '\t' + (p.model || '') + '\t' + (p.modelQty || 1) + '\t' + (p.forecastAmount || '') + '\t' + getPipeName(p.status) + '\t' + fD(p.biddingDate) + '\n';
  });
  copyText(tsv, '📋 Copy Pipeline ' + (d ? d.name : ''));
}
// ================================================================
// TAB: QUOTATION — สรุปใบเสนอราคาของ Dealer นี้ (เดิมต้องออกไปหน้า Quotation หลักแล้วค้นชื่อเอาเอง ไม่มีทาง
// เชื่อมจากหน้า Dealer เลย — เจอจากการสแกน UX 2026-08-23) แค่ลิสต์ย่อ กดแล้วไปหน้าแก้ไขจริงต่อ ไม่ทำ
// search/filter/export ซ้ำในนี้ เพราะมีอยู่แล้วที่หน้า Quotation หลัก (ปุ่ม "ดูทั้งหมด" พาไปหน้านั้นได้)
// ================================================================
function dealerQuotationTab(d) {
  var all = (typeof loadQuotations === 'function') ? loadQuotations() : [];
  var list = all.filter(function(q) { return q.dealerId === d.id; })
    .sort(function(a, b) { return (b.validFrom || '') < (a.validFrom || '') ? -1 : 1; });
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
    '<h2 style="margin:0;font-size:1rem">💰 ใบเสนอราคา (' + list.length + ')</h2>' +
    '<div style="display:flex;gap:8px">' +
    '<button class="btn bo bsm" onclick="go(\'quotationV2\')">📋 ดูทั้งหมด</button>' +
    '<button class="btn bp bsm" onclick="showCreateQuotationModal()">➕ สร้างใบเสนอราคา</button>' +
    '</div></div>';
  if (!list.length) {
    h += '<div class="empty"><p>ยังไม่มีใบเสนอราคาสำหรับ Dealer นี้<br><button class="btn bp" style="margin-top:6px" onclick="showCreateQuotationModal()">➕ สร้างใบเสนอราคา</button></p></div>';
    return h;
  }
  h += '<div style="display:flex;flex-direction:column;gap:8px">';
  list.forEach(function(q) {
    var color = quoteStatusColors[q.status] || '#64748b';
    var label = quoteStatusLabels[q.status] || q.status || '-';
    h += '<div class="card" style="padding:12px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px" onclick="editQuotation(\'' + q.id + '\')">' +
      '<div style="min-width:0">' +
      '<div style="font-weight:700;font-size:13px">' + sanitize(q.quoteNo || '-') + '</div>' +
      (q.projectName ? '<div style="font-size:11.5px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px">' + sanitize(q.projectName) + '</div>' : '') +
      '<div style="font-size:10.5px;color:var(--text3);margin-top:2px">' + sanitize(q.validFrom || '-') + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
      '<div style="font-weight:800;color:#22c55e;font-size:13px">' + formatNumber(q.totalAmount || 0) + ' ฿</div>' +
      '<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px;background:' + color + '22;color:' + color + '">' + sanitize(label) + '</span>' +
      '</div></div>';
  });
  h += '</div>';
  return h;
}
// ================================================================
// TAB: SALES ORDER — สรุป SO ของ Dealer นี้ เหตุผลเดียวกับแท็บ Quotation ด้านบน
// ================================================================
function dealerSalesOrderTab(d) {
  var all = ST.getAll('salesOrders');
  var list = all.filter(function(s) { return s.dealerId === d.id; })
    .sort(function(a, b) { return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1; });
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
    '<h2 style="margin:0;font-size:1rem">📦 Sales Order (' + list.length + ')</h2>' +
    '<div style="display:flex;gap:8px">' +
    '<button class="btn bo bsm" onclick="go(\'salesOrders\')">📋 ดูทั้งหมด</button>' +
    '<button class="btn bp bsm" onclick="showCreateSOModal({dealerId:\'' + d.id + '\'})">➕ สร้าง SO</button>' +
    '</div></div>';
  if (!list.length) {
    h += '<div class="empty"><p>ยังไม่มี Sales Order สำหรับ Dealer นี้<br><button class="btn bp" style="margin-top:6px" onclick="showCreateSOModal({dealerId:\'' + d.id + '\'})">➕ สร้าง SO</button></p></div>';
    return h;
  }
  h += '<div style="display:flex;flex-direction:column;gap:8px">';
  list.forEach(function(s) {
    var total = (s.items || []).reduce(function(sum, it) { return sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);
    var models = (s.items || []).map(function(it) { return it.model; }).filter(Boolean);
    var modelsTxt = models.length ? (models[0] + (models.length > 1 ? ', +' + (models.length - 1) + ' more' : '')) : '-';
    h += '<div class="card" style="padding:12px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px" onclick="go(\'soDetail\',{soId:\'' + s.id + '\'})">' +
      '<div style="min-width:0">' +
      '<div style="font-weight:700;font-size:13px">' + sanitize(s.soNumber || '-') + '</div>' +
      '<div style="font-size:11.5px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px">' + sanitize(modelsTxt) + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
      (total ? '<div style="font-weight:800;color:#22c55e;font-size:13px">' + fmtMoneyShort(total) + '</div>' : '') +
      (typeof _soStatusBadge === 'function' ? _soStatusBadge(s.status) : sanitize(s.status || '-')) +
      '</div></div>';
  });
  h += '</div>';
  return h;
}
// ================================================================
// TAB: VISIT
// ================================================================
function dealerVisitTab(d) {
  const vts = ST.visitsByDealer(d.id);
  const fus = ST.followupsByDealer(d.id);

  return `
  <div class="card"><h2>🤝 Visit / Meeting (${vts.length})
    <span class="ml">
      <button class="btn bsm bo" onclick="copyDealerVisits('${d.id}')">📋 Copy</button>
      <button class="btn bsm bo" onclick="dlDealerVisitsCSV('${d.id}')">📤 CSV</button>
      <button class="btn bsm bp" onclick="showVisitM('${d.id}')">➕ Visit</button>
      <button class="btn bsm bo" onclick="openVisitWindow('${d.id}')" title="เปิดเป็นแท็บแยก เต็มจอ มีสมุดโน้ตเร็วด้านขวา">🪟</button>
    </span></h2>
  ${vts.length ? vts.slice(0, 20).map(v => visitItemHTML(v)).join('') : '<div class="empty"><p>ยังไม่มี Visit</p></div>'}
  ${vts.length > 20 ? `<div style="text-align:center;padding:6px"><button class="btn bo" onclick="go('visits',{filterDealer:'${d.id}'})">ดูทั้งหมด (${vts.length}) →</button></div>` : ''}
  </div>

  <div class="card"><h2>📞 Follow-up (${fus.length})
    <span class="ml"><button class="btn bsm bp" onclick="showFollowupM('${d.id}')">➕</button></span></h2>
  ${fus.length ? fus.slice(0, 10).map(f => `<div class="li">
    <div class="lm"><div class="lt"><span class="tag ${f.method==='line'?'tag-active':f.method==='call'?'tag-completed':'tag-a'}">${f.method||'?'}</span> ${fD(f.date)}</div>
    <div class="ls">${sanitize(f.summary?.substr(0,80)||'')}</div></div>
    <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('followups','${f.id}');render()">✕</button>
  </div>`).join('') : '<div class="empty"><p>ยังไม่มี Follow-up</p></div>'}
  </div>

  <div class="card"><h2>💡 Feedback (${ST.feedbackByDealer(d.id).length})
    <span class="ml"><button class="btn bsm bp" onclick="showFeedbackM('${d.id}')">➕</button></span></h2>
  ${ST.feedbackByDealer(d.id).length ? ST.feedbackByDealer(d.id).map(f => `<div class="visit-sub">
    <div style="display:flex;justify-content:space-between"><span style="font-size:.62rem;color:var(--text2)">${fD(f.date)} • ${f.source||''}</span>
    <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('feedback','${f.id}');render()">✕</button></div>
    <div style="font-size:.74rem;margin-top:1px">${sanitize(f.text)}</div>
    ${f.attachments && f.attachments.length ? attachGalleryHtml(f.attachments) : ''}
  </div>`).join('') : '<div class="empty"><p>ยังไม่มี Feedback</p></div>'}
  </div>`;
}

function visitItemHTML(v) {
  const d = ST.getOne('dealers', v.dealerId);
  const topicStr = (v.topicData || []).filter(t => t.answered).map(t => t.topicId).join(', ');
  
  return `<div class="visit-item" onclick="go('visitDetail',{visitId:'${v.id}'})">
    <h4>${fD(v.date)} ${v.time||''} ${modeTag(v.mode)} ${v.djiDealer?`<span class="tag tag-count">${v.djiDealer}</span>`:''}</h4>
    <div class="vmeta">${topicStr ? 'Topics: ' + topicStr : ''} ${v.location?'📍 <a href="'+v.location+'" target="_blank" onclick="event.stopPropagation()">Map</a>':''}</div>
    <div class="vbody">${sanitize((v.summary||'').substr(0,150))}${(v.summary||'').length>150?'...':''}</div>
    ${v.attachments && v.attachments.length ? `<div onclick="event.stopPropagation()">${attachGalleryHtml(v.attachments)}</div>` : ''}
    ${v.revenue ? `<div style="font-size:.68rem;color:#22c55e;margin-top:2px">💰 ยอดขาย: ${fmtMoney(v.revenue)}</div>` : ''}
  </div>`;
}

// ================================================================
// TAB: TIMELINE
// ================================================================
let timelineFilter = 'all';

function dealerTimelineTab(d) {
  let items = ST.getDealerTimeline(d.id, 50);
  
  if (timelineFilter !== 'all') {
    items = items.filter(i => i.type === timelineFilter);
  }

  return `
  <div class="card"><h2>📝 Timeline
    <span class="ml"><button class="btn bsm bo" onclick="copyDealerTimeline('${d.id}')">📋 Copy</button></span></h2>
  
  <div class="ftabs" style="margin-bottom:8px">
    <div class="ftab ${timelineFilter==='all'?'act':''}" onclick="timelineFilter='all';render()">ทั้งหมด</div>
    <div class="ftab ${timelineFilter==='visit'?'act':''}" onclick="timelineFilter='visit';render()">🤝 Visit</div>
    <div class="ftab ${timelineFilter==='followup'?'act':''}" onclick="timelineFilter='followup';render()">📞 FU</div>
    <div class="ftab ${timelineFilter==='line'?'act':''}" onclick="timelineFilter='line';render()">💬 LINE</div>
    <div class="ftab ${timelineFilter==='update'?'act':''}" onclick="timelineFilter='update';render()">📊 Pipeline</div>
    <div class="ftab ${timelineFilter==='note'?'act':''}" onclick="timelineFilter='note';render()">💡 FB</div>
  </div>

  ${items.length ? `<div class="tl">${items.map(i => {
    let onclick = '';
    if (i.refType === 'visit') onclick = `onclick="go('visitDetail',{visitId:'${i.refId}'})"`;
    else if (i.refType === 'pipeline') onclick = `onclick="go('pipeDetail',{pipeId:'${i.refId}'})"`;
    
    return `<div class="ti tl-${i.type}" ${onclick} style="${onclick?'cursor:pointer':''}">
      <div class="td2">${fDT(i.date)}</div>
      <div class="tt2">${sanitize(i.title)}</div>
      <div class="tc2">${sanitize(i.desc)}</div>
      ${onclick ? `<div class="ti-link">ดูรายละเอียด →</div>` : ''}
    </div>`;
  }).join('')}</div>` : '<div class="empty"><p>ยังไม่มีกิจกรรม</p></div>'}
  </div>`;
}

function copyDealerTimeline(dealerId) {
  const d = ST.getOne('dealers', dealerId);
  const items = ST.getDealerTimeline(dealerId, 100);
  let txt = `Timeline — ${d?.name||''}\n${'─'.repeat(30)}\n`;
  items.forEach(i => {
    txt += `${fD(i.date?.split('T')[0])} ${i.title} ${i.desc}\n`;
  });
  copyText(txt, '📋 Copy Timeline');
}

// ================================================================
// TAB: FORECAST (Enhanced v2)
// ================================================================
var dlrFcView = 'model';
var dlrFcStatus = 'active';
var dlrFcCatFilter = {}; // หมวดที่ปิดอยู่จากการคลิกการ์ดสรุปตามหมวดหมู่ (แท็บ Forecast ของ Dealer) — ว่าง = แสดงทั้งหมด
var dlrFcModelMonthFilter = {}; // เดือน (0-11) ที่ "เลือก" ไว้สำหรับตาราง Forecast ตาม Model ในแท็บ Dealer — ว่าง = ทุกเดือน (แบบเดียวกับ fcModelMonthFilter ในเมนู Forecast หลัก)
function dlrFcToggleModelMonth(idx) {
  if (dlrFcModelMonthFilter[idx]) delete dlrFcModelMonthFilter[idx]; else dlrFcModelMonthFilter[idx] = true;
  render();
}
function dlrFcClearModelMonthFilter() { dlrFcModelMonthFilter = {}; render(); }
var dlrFcMode = 'auto'; // 'auto' = สรุปจาก Pipeline จริง (เดิม), 'manual' = เซลกรอก Sales Forecast เอง (runrate/project)
var dlrFcSelMonth = ''; // เดือนที่เลือกดูใน Sales Forecast (manual mode) — ว่าง = ใช้เดือนล่าสุดที่มีข้อมูล

// สร้าง pipes ของ Dealer นี้ที่ผ่านตัวกรอง status ปัจจุบันของแท็บ แล้ว export เป็น Excel
function exportDlrFcExcel(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  var allPipes = ST.pipelineByDealer(dealerId);
  var pipes;
  if (dlrFcStatus === 'all') pipes = allPipes;
  else if (dlrFcStatus === 'won') pipes = allPipes.filter(function(p) { return pipeIsWon(p); });
  else pipes = allPipes.filter(function(p) { return pipeIsOpen(p); });
  var safeName = (d ? d.name : 'dealer').replace(/[^a-zA-Z0-9ก-๙_\-]/g, '_');
  fcDownloadExcel(pipes, 'dlrFcCatFilter', 'forecast-' + safeName);
}

function dealerForecastTab(d) {
  // สลับ สรุปอัตโนมัติ (จาก Pipeline จริง เดิม) / Sales Forecast (เซลกรอกเอง runrate+project แบบเดียวกับ
  // client-view) — ผูก mode ไว้ที่ระดับบนสุดของแท็บ กันโค้ดเดิมด้านล่างต้องแก้เยอะ
  var fcModeBar = '<div style="display:flex;gap:4px;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:10px">' +
    '<button class="btn-xs" style="flex:1;border-radius:0;' + (dlrFcMode === 'auto' ? 'background:var(--accent);color:#fff' : '') + '" onclick="dlrFcMode=\'auto\';render()">📊 สรุปอัตโนมัติ</button>' +
    '<button class="btn-xs" style="flex:1;border-radius:0;' + (dlrFcMode === 'manual' ? 'background:var(--accent);color:#fff' : '') + '" onclick="dlrFcMode=\'manual\';render()">✍️ Sales Forecast</button>' +
    '</div>';
  if (dlrFcMode === 'manual') return fcModeBar + dealerSalesForecastTab(d);

  var allPipes = ST.pipelineByDealer(d.id);
  
  var pipes;
  if (dlrFcStatus === 'all') {
    pipes = allPipes;
  } else if (dlrFcStatus === 'won') {
    pipes = allPipes.filter(function(p) { return pipeIsWon(p); });
  } else {
    pipes = allPipes.filter(function(p) { return pipeIsOpen(p); });
  }
  
  var totalFc = 0;
  var totalQty = 0;
  pipes.forEach(function(p) {
    totalFc += (Number(p.forecastAmount) || 0);
    totalQty += getPipeTotalQty(p);
  });
  
  // เคารพทั้งตัวกรองหมวดหมู่ (dlrFcCatFilter เดิม ที่ก่อนหน้านี้ไม่มีผลกับตารางนี้เลย เหมือนบั๊กเดียวกับ
  // เมนู Forecast หลักก่อนแก้) และตัวกรองเดือน (dlrFcModelMonthFilter ใหม่) — เก็บ breakdown ทีละโครงการ
  // (label/endUser/qty) ไว้ทำคอลัมน์ "สรุป" แบบเดียวกับเมนู Forecast หลัก (สโคปเดียวคือ dealer นี้ ไม่ต้องมี
  // คอลัมน์ Dealer แยก เพราะทั้งตารางเป็นของ dealer เดียวอยู่แล้ว)
  var hasDlrModelMonthFilter = Object.keys(dlrFcModelMonthFilter).length > 0;
  var byModel = {};
  pipes.forEach(function(p) {
    if (hasDlrModelMonthFilter) {
      var ship = getPipeShipDate(p);
      if (!ship) return;
      if (fcHideTentative && ship.est) return;
      if (!dlrFcModelMonthFilter[ship.date.getMonth()]) return;
    }
    var items = getPipeItems(p);
    if (!items.length) return;
    var lineLabel = p.projectName || '-';
    var endUser = p.endUserTH || p.agencyMain || '';

    items.forEach(function(it) {
      var model = it.model || 'ไม่ระบุ';
      if (!fcCatIsVisible('dlrFcCatFilter', getModelCategory(model))) return;
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));
      if (!byModel[model]) byModel[model] = { model: model, qty: 0, amount: 0, lines: [] };
      byModel[model].qty += qty;
      byModel[model].amount += amt;

      var existingLine = null;
      for (var li = 0; li < byModel[model].lines.length; li++) {
        if (byModel[model].lines[li].pipeId === p.id) { existingLine = byModel[model].lines[li]; break; }
      }
      if (existingLine) existingLine.qty += qty;
      else byModel[model].lines.push({ pipeId: p.id, label: lineLabel, endUser: endUser, qty: qty });
    });
  });
  var modelList = Object.values(byModel).sort(function(a, b) { return b.amount - a.amount; });

  var h = '<div class="card"><h2>📦 Forecast — ' + sanitize(d.name);
  h += '<span class="ml"><button class="btn bsm bo" onclick="copyDealerForecast(\'' + d.id + '\')">📋</button></span></h2>';

  // สถิติย้ายไปไว้ล่าง (หลังตาราง) — เก็บไว้ใน statsHtml ก่อน
  var statsHtml = '<div class="sr" style="margin-bottom:8px">' +
    '<div class="sc"><div class="sn c1">' + pipes.length + '</div><div class="sl">Projects</div></div>' +
    '<div class="sc"><div class="sn c2">' + fmtMoneyShort(totalFc) + '</div><div class="sl">Forecast</div></div>' +
    '<div class="sc"><div class="sn c5">' + totalQty + '</div><div class="sl">จำนวน (ชิ้น)</div></div>' +
    '<div class="sc"><div class="sn c1">' + modelList.length + '</div><div class="sl">Models</div></div>' +
    '</div>';

  h += '<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">';
  h += '<button class="btn bsm ' + (dlrFcStatus === 'active' ? 'bp' : 'bo') + '" onclick="dlrFcStatus=\'active\';render()">⚡ Active</button>';
  h += '<button class="btn bsm ' + (dlrFcStatus === 'won' ? 'bp' : 'bo') + '" onclick="dlrFcStatus=\'won\';render()">🏆 Won</button>';
  h += '<button class="btn bsm ' + (dlrFcStatus === 'all' ? 'bp' : 'bo') + '" onclick="dlrFcStatus=\'all\';render()">📊 ทั้งหมด</button>';
  h += '<div style="flex:1"></div>';
  h += '<button class="btn bsm ' + (dlrFcView === 'model' ? 'bp' : 'bo') + '" onclick="dlrFcView=\'model\';render()">📦 Model</button>';
  h += '<button class="btn bsm ' + (dlrFcView === 'monthly' ? 'bp' : 'bo') + '" onclick="dlrFcView=\'monthly\';render()">📅 เดือน</button>';
  h += '<button class="btn bsm ' + (dlrFcView === 'quarterly' ? 'bp' : 'bo') + '" onclick="dlrFcView=\'quarterly\';render()">📊 ไตรมาส</button>';
  h += '</div>';

  // ✅ สรุปตามหมวดหมู่สินค้า + ตัวเลือกค่าประมาณ
  var _dlrFcYear = new Date().getFullYear();
  h += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px">';
  h += '<div style="font-weight:700;font-size:13px">📦 สรุปตามหมวดหมู่ — ' + _dlrFcYear + '</div>';
  h += '<div style="display:flex;align-items:center;gap:10px">' + fcTentativeToggleHtml() + '<button class="btn bsm bo" onclick="exportDlrFcExcel(\'' + d.id + '\')">📥 Excel (รายเดือน/ไตรมาส)</button></div>';
  h += '</div>';
  h += fcCategorySummaryHtml(pipes, _dlrFcYear, 'dlrFcCatFilter');
  if (dlrFcView === 'monthly' || dlrFcView === 'quarterly') h += fcLegendHtml();
  // ✅ แดชบอร์ด: กราฟแท่งรายเดือน
  h += fcMonthlyBarsHtml(pipes, _dlrFcYear);

  if (dlrFcView === 'monthly') {
    h += buildDlrFcMonthly(pipes, d, 'dlrFcCatFilter');
  } else if (dlrFcView === 'quarterly') {
    h += buildDlrFcQuarterly(pipes, d, 'dlrFcCatFilter');
  } else {
    h += buildDlrFcModel(modelList, totalFc, totalQty, d);
  }

  h += '</div>';

  // ✅ สถิติ (มูลค่า/จำนวน/Projects) ย้ายมาไว้ล่างตาราง
  h += '<div class="card" style="margin-bottom:12px">' + statsHtml + '</div>';

  if (modelList.length) {
    h += '<div class="card"><h2>📊 Chart — ' + sanitize(d.name) + '</h2>';
    var maxAmt = modelList[0].amount || 1;
    var maxQty = 1;
    modelList.forEach(function(m) { if (m.qty > maxQty) maxQty = m.qty; });

    h += '<div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--text2)">💰 มูลค่า</div>';
    h += '<div class="fc-chart">';
    modelList.forEach(function(m) {
      var pct = Math.max(8, Math.round(m.amount / maxAmt * 100));
      h += '<div class="fc-chart-row">';
      h += '<div class="fc-chart-label">' + sanitize(m.model) + '</div>';
      h += '<div class="fc-chart-track"><div class="fc-chart-fill" style="width:' + pct + '%">' + fmtMoneyShort(m.amount) + '</div></div>';
      h += '</div>';
    });
    h += '</div>';

    h += '<div style="font-size:12px;font-weight:700;margin:12px 0 6px;color:var(--text2)">📦 จำนวน (ชิ้น)</div>';
    h += '<div class="fc-chart">';
    modelList.forEach(function(m) {
      var pct = Math.max(8, Math.round(m.qty / maxQty * 100));
      h += '<div class="fc-chart-row">';
      h += '<div class="fc-chart-label">' + sanitize(m.model) + ' <span style="color:var(--text2)">x' + m.qty + '</span></div>';
      h += '<div class="fc-chart-track"><div class="fc-chart-fill fc-chart-fill-qty" style="width:' + pct + '%">x' + m.qty + '</div></div>';
      h += '</div>';
    });
    h += '</div>';
    h += '</div>';
  }

  h += '<div class="card"><h2>📊 Pipeline (' + pipes.length + ')</h2>';
  if (pipes.length) {
    pipes.sort(function(a, b) { return (Number(b.forecastAmount) || 0) - (Number(a.forecastAmount) || 0); });
    pipes.forEach(function(p, idx) {
      var modelText = getPipeModelSummary(p);
      h += '<div class="li ' + dlC(p.biddingDate, ['deliver','fail_lost'].indexOf(p.status) !== -1) + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
      h += '<div class="lm">';
      h += '<div class="lt"><span class="pipe-row-num">#' + (idx + 1) + '</span> ' + sanitize(p.projectName || '-') + ' ' + pipeTag(p.status) + '</div>';
      h += '<div class="ls">📦 ' + modelText + ' • ' + fmtMoneyStyled(p.forecastAmount);
      if (p.biddingDate) h += ' • Bid: ' + fDShort(p.biddingDate);
      if (p.shipmentDate) h += ' • Ship: ' + fDShort(p.shipmentDate);
      h += '</div></div></div>';
    });
  } else {
    h += '<div class="empty"><p>ไม่มี Pipeline</p></div>';
  }
  h += '</div>';

  return fcModeBar + h;
}

// ================================================================
// DEALER SALES FORECAST (Manual) — เขียน/อ่าน "ตารางเดียวกับ client-view" ตรงๆ (Firestore
// dealerUpdates/{dealerId}/forecast, mirror ไว้ที่ local ST.customerForecasts) แทนที่จะแยกเก็บของตัวเอง
// กันต้องกรอกซ้ำสองที่ — รายการที่เซลเพิ่มจะขึ้น client-view ทันที (source:'sales', _status:'approved'
// อัตโนมัติ ไม่ต้องรออนุมัติเพราะเซลเป็นคนเพิ่มเอง) ส่วนรายการที่ลูกค้ากรอกผ่าน client-view ก็โผล่ที่นี่เหมือนกัน
// project ผูกกับ Pipeline จริงได้ (pipeId) — ถ้าผูกไว้ ดึง model/qty/shipment สดจาก Pipeline เสมอ ไม่เก็บซ้ำ
// ================================================================
var sfRREditId = null; // id ของ Runrate ที่กำลังแก้ไขอยู่ (inline) — null = อยู่โหมดเพิ่มใหม่
var sfPREditId = null; // id ของ Project ที่กำลังแก้ไขอยู่ (inline) — null = อยู่โหมดเพิ่มใหม่

function dealerSalesForecastTab(d) {
  var entries = ST.filter('customerForecasts', function(f) { return f.dealerId === d.id; });
  var runrate = entries.filter(function(e) { return e.type === 'runrate'; });
  var projects = entries.filter(function(e) { return e.type === 'project'; });

  var monthTotals = {};
  function addMonth(month, qty, value, isProject) {
    var key = month || 'ไม่ระบุเดือน';
    if (!monthTotals[key]) monthTotals[key] = { total: 0, runrate: 0, project: 0, value: 0 };
    monthTotals[key].total += qty;
    monthTotals[key].value += value;
    if (isProject) monthTotals[key].project += qty; else monthTotals[key].runrate += qty;
  }
  runrate.forEach(function(r) {
    var unitPrice = getModelPrice(r.model) || 0;
    addMonth(r.month, Number(r.qty) || 0, unitPrice * (Number(r.qty) || 0), false);
  });
  projects.forEach(function(p) {
    var pipe = p.pipeId ? ST.getOne('pipeline', p.pipeId) : null;
    var qty = pipe ? getPipeTotalQty(pipe) : (Number(p.totalQty) || 0);
    var value = pipe ? (Number(pipe.forecastAmount) || 0) : 0;
    addMonth(p.month, qty, value, true);
  });

  var months = Object.keys(monthTotals).sort();
  var curMonth = (dlrFcSelMonth && monthTotals[dlrFcSelMonth]) ? dlrFcSelMonth : (months[months.length - 1] || '');
  var curTotals = monthTotals[curMonth] || { total: 0, runrate: 0, project: 0, value: 0 };

  var h = '<div class="card"><h2>✍️ Sales Forecast — ' + sanitize(d.name) + '</h2>';
  h += '<div class="hint" style="margin-bottom:10px">🔄 sync กับ client-view — รายการที่เพิ่มที่นี่ขึ้นให้ลูกค้าเห็นทันที และรายการที่ลูกค้ากรอกเองก็โผล่ที่นี่ด้วย</div>';

  if (!months.length) {
    h += '<div class="empty"><p>ยังไม่มี Sales Forecast — เพิ่มได้จากช่องด้านล่างเลย</p></div>';
  } else {
    h += '<div class="sr" style="margin-bottom:10px">' +
      '<div class="sc"><div class="sn c2">' + fmtMoneyShort(curTotals.value) + '</div><div class="sl">' + sanitize(curMonth) + ' มูลค่ารวม</div></div>' +
      '<div class="sc"><div class="sn c1">' + curTotals.total + '</div><div class="sl">รวม (หน่วย)</div></div>' +
      '<div class="sc"><div class="sn c5">' + curTotals.project + '</div><div class="sl">Project (หน่วย)</div></div>' +
      '</div>';
    if (months.length > 1) {
      h += '<div class="fg" style="margin-bottom:10px"><select onchange="dlrFcSelMonth=this.value;render()">' +
        months.map(function(m) { return '<option value="' + sanitize(m) + '"' + (m === curMonth ? ' selected' : '') + '>' + sanitize(m) + '</option>'; }).join('') +
        '</select></div>';
    }
  }

  function sourceBadge(e) {
    return e.source === 'sales' ? '<span class="tag tag-active">✍️ เซลกรอก</span>' : '<span class="tag tag-count">📱 ลูกค้ากรอก</span>';
  }

  // ---- Runrate ----
  h += '<div style="font-weight:700;font-size:13px;margin-bottom:8px">🔁 Runrate</div>';
  h += _sfRRFormHtml(d);
  var rrInMonth = runrate.filter(function(r) { return (r.month || 'ไม่ระบุเดือน') === curMonth; });
  if (rrInMonth.length) {
    rrInMonth.forEach(function(r) {
      var unitPrice = getModelPrice(r.model) || 0;
      var subtotal = unitPrice * (Number(r.qty) || 0);
      h += '<div class="li" style="display:flex;justify-content:space-between;align-items:center;cursor:default">' +
        '<div><div class="lt">' + sanitize(r.model || '-') + ' ×' + (r.qty || 0) + ' ' + sourceBadge(r) + '</div>' +
        '<div class="ls">' + sanitize(r.month || '') + (unitPrice ? ' · @' + fmtMoneyShort(unitPrice) : '') + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:8px">' + (subtotal ? '<b>' + fmtMoneyShort(subtotal) + '</b>' : '') +
        '<button class="btn bsm bo" onclick="editRRInline(\'' + r.id + '\')">✏️</button>' +
        '<button class="btn bsm bd" onclick="delSalesForecast(\'' + d.id + '\',\'' + r.id + '\')">🗑️</button></div></div>';
    });
  } else {
    h += '<div class="empty"><p>ยังไม่มี Runrate เดือนนี้</p></div>';
  }

  // ---- Project ----
  h += '<div style="font-weight:700;font-size:13px;margin:14px 0 8px">📁 Project</div>';
  h += _sfPRFormHtml(d);
  var projInMonth = projects.filter(function(p) { return (p.month || 'ไม่ระบุเดือน') === curMonth; });
  if (projInMonth.length) {
    projInMonth.forEach(function(p) {
      var pipe = p.pipeId ? ST.getOne('pipeline', p.pipeId) : null;
      var title = pipe ? (pipe.projectName || '-') : (p.projectName || '-');
      var modelText = pipe ? getPipeModelSummary(pipe) : (p.note || '');
      var qty = pipe ? getPipeTotalQty(pipe) : (Number(p.totalQty) || 0);
      var value = pipe ? (Number(pipe.forecastAmount) || 0) : 0;
      h += '<div class="li" style="cursor:default">';
      h += '<div class="lm"><div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div class="lt">' + sanitize(title) + ' ' + sourceBadge(p) + (pipe ? ' <span class="tag tag-count">🔗 Pipeline</span>' : '') + '</div>' +
        (value ? '<b style="white-space:nowrap">' + fmtMoneyShort(value) + '</b>' : '') + '</div>';
      h += '<div class="ls">' + sanitize(modelText) + (qty ? ' — x' + qty : '') + '</div>';
      if (pipe) {
        h += '<div class="ls" style="margin-top:4px;padding-top:4px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">' +
          '<span>📦 Shipment: <b>' + (pipe.shipmentDate ? fDShort(pipe.shipmentDate) : 'ยังไม่กำหนด') + '</b></span>' +
          '<span style="color:var(--accent);cursor:pointer" onclick="event.stopPropagation();jumpToPipeShipment(\'' + d.id + '\',\'' + pipe.id + '\')">✏️ แก้ไข Shipment →</span></div>';
      }
      h += '</div>';
      h += '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<button class="btn bsm bo" onclick="editPRInline(\'' + p.id + '\')">✏️</button>' +
        '<button class="btn bsm bd" onclick="delSalesForecast(\'' + d.id + '\',\'' + p.id + '\')">🗑️</button></div>';
      h += '</div>';
    });
  } else {
    h += '<div class="empty"><p>ยังไม่มี Project เดือนนี้</p></div>';
  }

  h += '</div>';
  return h;
}

// ฟอร์ม "เพิ่ม/แก้ไข" Runrate แบบฝังในหน้าเลย ไม่เปิด modal — ฟอร์มเดียวใช้ทั้งเพิ่มใหม่และแก้ไข (สลับด้วย
// sfRREditId): พิมพ์ชื่อ model ในช่อง text+datalist จะมีคำแนะนำจากคลังสินค้า พร้อมโชว์ราคา/หน่วย real-time
function _sfRRFormHtml(d) {
  var e = sfRREditId ? (ST.filter('customerForecasts', function(f) { return f.id === sfRREditId; })[0] || {}) : {};
  var products = (typeof Products !== 'undefined' && Products.getAll) ? Products.getAll() : [];
  var modelDlOpts = products.map(function(m) { return '<option value="' + sanitize(m.name) + '">'; }).join('');
  var unitPrice = e.model ? (getModelPrice(e.model) || 0) : 0;
  var subtotal = unitPrice * (Number(e.qty) || 0);

  var html = '<div class="li" style="background:var(--bg2);border:1px dashed var(--border)">' +
    '<div class="fr" style="margin-bottom:6px">' +
    '<div class="fg"><label style="font-size:.64rem">Model</label><input type="text" id="sf_rr_model" list="sf_rr_model_dl" placeholder="พิมพ์ชื่อ model..." autocomplete="off" value="' + sanitize(e.model || '') + '" oninput="sfUpdateRRPricePreview()"><datalist id="sf_rr_model_dl">' + modelDlOpts + '</datalist></div>' +
    '<div class="fg" style="max-width:80px"><label style="font-size:.64rem">จำนวน</label><input type="number" id="sf_rr_qty" value="' + (e.qty || '') + '" oninput="sfUpdateRRPricePreview()"></div>' +
    '</div>' +
    '<div class="fr" style="align-items:flex-end">' +
    '<div class="fg" style="max-width:150px"><label style="font-size:.64rem">เดือน</label><input type="month" id="sf_rr_month" value="' + (e.month || '') + '"></div>' +
    '<div class="fg" style="display:flex;align-items:center;justify-content:flex-end;gap:8px">' +
    '<span id="sf_rr_price_preview" style="font-size:.68rem;color:var(--text2)">' + (unitPrice ? '@' + fmtMoneyShort(unitPrice) + ' = ' + fmtMoneyShort(subtotal) : '') + '</span>' +
    '<button class="btn bsm bp" onclick="saveSalesForecastRR(\'' + d.id + '\')">' + (sfRREditId ? '💾 บันทึก' : '+ เพิ่ม') + '</button>' +
    (sfRREditId ? '<button class="btn bsm bo" onclick="cancelRREdit()">ยกเลิก</button>' : '') +
    '</div></div></div>';
  return html;
}

function sfUpdateRRPricePreview() {
  var modelEl = document.getElementById('sf_rr_model');
  var qtyEl = document.getElementById('sf_rr_qty');
  var previewEl = document.getElementById('sf_rr_price_preview');
  if (!modelEl || !qtyEl || !previewEl) return;
  var unitPrice = getModelPrice(modelEl.value.trim()) || 0;
  var qty = Number(qtyEl.value) || 0;
  previewEl.textContent = unitPrice ? '@' + fmtMoneyShort(unitPrice) + ' = ' + fmtMoneyShort(unitPrice * qty) : '';
}

function editRRInline(id) { sfRREditId = id; sfPREditId = null; render(); }
function cancelRREdit() { sfRREditId = null; render(); }

// ฟอร์ม "เพิ่ม/แก้ไข" Project แบบฝังในหน้า — พิมพ์ชื่อโครงการมีคำแนะนำจาก Pipeline ที่มีอยู่ของ Dealer
// รายนี้ (พิมพ์ตรงชื่อ = ผูกอัตโนมัติ) หรือพิมพ์ชื่ออิสระได้ถ้ายังไม่มีใน Pipeline จริง
function _sfPRFormHtml(d) {
  var e = sfPREditId ? (ST.filter('customerForecasts', function(f) { return f.id === sfPREditId; })[0] || {}) : {};
  var pipes = ST.pipelineByDealer(d.id).filter(pipeIsOpen);
  var linkedPipe = e.pipeId ? ST.getOne('pipeline', e.pipeId) : null;
  var pipeListOpts = pipes.map(function(p) { return '<option value="' + sanitize((p.rowNo ? p.rowNo + ' · ' : '') + (p.projectName || '-')) + '" data-id="' + p.id + '">'; }).join('');

  var html = '<div class="li" style="background:var(--bg2);border:1px dashed var(--border)">' +
    '<div class="fg" style="margin-bottom:6px"><label style="font-size:.64rem">🔗 ชื่อโครงการ (พิมพ์ค้นหา — ตรงชื่อ Pipeline ที่มีอยู่จะผูกให้อัตโนมัติ)</label>' +
    '<input type="text" id="sf_pr_pipetxt" list="sf_pr_pipe_dl" placeholder="พิมพ์ชื่อโครงการ..." autocomplete="off" value="' + sanitize(linkedPipe ? (linkedPipe.projectName || '') : (e.projectName || '')) + '" oninput="sfPipeTextChanged()">' +
    '<datalist id="sf_pr_pipe_dl">' + pipeListOpts + '</datalist>' +
    '<input type="hidden" id="sf_pr_pipeid" value="' + (e.pipeId || '') + '"></div>' +
    '<div id="sf_pr_qty_wrap" style="' + (linkedPipe ? 'display:none' : '') + '">' +
    '<div class="fg"><label style="font-size:.64rem">จำนวน (หน่วย — กรอกถ้าไม่ได้ผูก Pipeline)</label><input type="number" id="sf_pr_qty" value="' + (e.totalQty || '') + '"></div></div>' +
    '<div class="fr" style="align-items:flex-end">' +
    '<div class="fg" style="max-width:150px"><label style="font-size:.64rem">เดือน</label><input type="month" id="sf_pr_month" value="' + (e.month || '') + '"></div>' +
    '<div class="fg"><label style="font-size:.64rem">หมายเหตุ</label><input type="text" id="sf_pr_note" value="' + sanitize(e.note || '') + '"></div>' +
    '<div class="fg" style="display:flex;justify-content:flex-end;gap:6px">' +
    '<button class="btn bsm bp" onclick="saveSalesForecastPR(\'' + d.id + '\')">' + (sfPREditId ? '💾 บันทึก' : '+ เพิ่ม') + '</button>' +
    (sfPREditId ? '<button class="btn bsm bo" onclick="cancelPREdit()">ยกเลิก</button>' : '') +
    '</div></div></div>';
  return html;
}

function editPRInline(id) { sfPREditId = id; sfRREditId = null; render(); }
function cancelPREdit() { sfPREditId = null; render(); }

function sfPipeTextChanged() {
  var txtEl = document.getElementById('sf_pr_pipetxt');
  var dl = document.getElementById('sf_pr_pipe_dl');
  var idEl = document.getElementById('sf_pr_pipeid');
  if (!txtEl || !dl || !idEl) return;
  var txt = txtEl.value.trim();
  var match = null;
  Array.from(dl.options).forEach(function(o) { if (o.value === txt) match = o; });
  idEl.value = match ? match.getAttribute('data-id') : '';
  var qtyWrap = document.getElementById('sf_pr_qty_wrap');
  if (qtyWrap) qtyWrap.style.display = match ? 'none' : '';
}

function saveSalesForecastRR(dealerId) {
  var eid = sfRREditId;
  var month = document.getElementById('sf_rr_month').value;
  if (!month) return alert('เลือกเดือน');
  var model = document.getElementById('sf_rr_model').value.trim();
  if (!model) return alert('ใส่ Model');
  var qty = Number(document.getElementById('sf_rr_qty').value) || 0;
  var data = { type: 'runrate', month: month, model: model, qty: qty };
  _saveSalesForecastCore(dealerId, eid, data, function() { sfRREditId = null; });
}

function saveSalesForecastPR(dealerId) {
  var eid = sfPREditId;
  var month = document.getElementById('sf_pr_month').value;
  if (!month) return alert('เลือกเดือน');
  var data = { type: 'project', month: month };
  var pipeId = document.getElementById('sf_pr_pipeid').value;
  data.pipeId = pipeId || '';
  if (!pipeId) {
    var projName = document.getElementById('sf_pr_pipetxt').value.trim().replace(/^\S+\s*·\s*/, '');
    if (!projName) return alert('ใส่ชื่อโครงการ หรือผูก Pipeline');
    data.projectName = projName;
    data.totalQty = Number(document.getElementById('sf_pr_qty').value) || 0;
  } else {
    var pipe = ST.getOne('pipeline', pipeId);
    data.projectName = pipe ? (pipe.projectName || '') : '';
    data.totalQty = pipe ? getPipeTotalQty(pipe) : 0;
  }
  data.note = document.getElementById('sf_pr_note').value.trim();
  _saveSalesForecastCore(dealerId, eid, data, function() { sfPREditId = null; });
}

// บันทึกตรงไปที่ Firestore dealerUpdates/{dealerId}/forecast (path เดียวกับที่ client-view ใช้) แล้ว mirror
// เข้า local ST.customerForecasts ทันทีไม่ต้องรอ listener — _status ตั้ง 'approved' อัตโนมัติเพราะเซลเพิ่มเอง
// (ไม่ต้องผ่านหน้าอนุมัติแบบที่ลูกค้ากรอก), source:'sales' ไว้แยกว่าใครเป็นคนกรอก
function _saveSalesForecastCore(dealerId, eid, data, onDone) {
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) return alert('❌ ต้อง login ก่อนถึงจะ sync กับ client-view ได้ (ใช้แบบ Offline จะบันทึกไม่ได้)');

  var dealer = ST.getOne('dealers', dealerId);
  data.dealerId = dealerId;
  data.dealerName = dealer ? dealer.name : '';
  data.source = 'sales';
  data._status = 'approved';

  var id = eid || db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc().id;
  data.id = id;
  data.updatedAt = new Date().toISOString();
  if (!eid) data.createdAt = data.updatedAt;

  db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(id).set(data, { merge: true }).then(function() {
    var cache = JSON.parse(localStorage.getItem('v7_customer_forecasts') || '[]');
    var idx = -1;
    for (var i = 0; i < cache.length; i++) { if (cache[i].id === id) { idx = i; break; } }
    if (idx >= 0) cache[idx] = data; else cache.push(data);
    localStorage.setItem('v7_customer_forecasts', JSON.stringify(cache));
    if (typeof syncItemToFirebase === 'function') syncItemToFirebase('customerForecasts', data);

    dlrFcSelMonth = data.month;
    if (onDone) onDone();
    toast('💾 บันทึกแล้ว (sync กับ client-view)'); render();
  }).catch(function(err) {
    toast('❌ บันทึกไม่สำเร็จ: ' + err.message, true);
  });
}

// ================================================================
// สร้าง Product Forecast จาก Pipeline ที่ Won แล้วโดยตรง (ปุ่มบนหน้า Pipeline Detail) — ดึง model/qty รวม
// (getPipeTotalQty/getPipeModelSummary) + ชื่อโครงการ + ผูก pipeId ให้อัตโนมัติ ไม่ต้องพิมพ์ซ้ำที่แท็บ
// Sales Forecast ของ Dealer เหมือนเดิม เดือนเริ่มต้นเดาจาก Expected Close Date แต่แก้ก่อนบันทึกจริงได้
// (preview เล็กๆ ก่อนยืนยัน) เหมือนปุ่ม "สร้าง Sales Order จาก Project นี้" ที่มีอยู่แล้ว
// ================================================================
function showCreateForecastFromPipelineM(pipelineId) {
  var p = ST.getOne('pipeline', pipelineId);
  if (!p) return;
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) return toast('❌ ต้อง login ก่อนถึงจะสร้าง Forecast ได้ (ใช้แบบ Offline จะบันทึกไม่ได้)', true);
  var existing = ST.filter('customerForecasts', function(f) { return f.type === 'project' && f.pipeId === pipelineId; })[0];
  var totalQty = getPipeTotalQty(p);
  var modelSummary = getPipeModelSummary(p);
  var defaultMonth = (existing ? existing.month : '') || (p.expectedCloseDate || p.shipmentDate || p.biddingDate || _td()).slice(0, 7);

  var h = '<div style="max-width:420px">';
  if (existing) h += '<div class="hint" style="margin-bottom:10px;color:var(--warn,#f59e0b)">⚠️ โครงการนี้มี Forecast อยู่แล้ว (เดือน ' + sanitize(existing.month) + ') — บันทึกใหม่จะปรับปรุงรายการเดิม ไม่สร้างซ้ำ</div>';
  h += '<div class="fg"><label>โครงการ</label><div style="font-weight:700;font-size:13px">' + sanitize(p.projectName || '-') + '</div></div>';
  h += '<div class="fg"><label>สินค้า (รวมจาก Pipeline)</label><div style="font-size:12.5px;color:var(--text2)">' + sanitize(modelSummary || '-') + '<br>รวม ' + totalQty + ' หน่วย</div></div>';
  h += '<div class="fg"><label>เดือนที่คาดว่าจะได้รับ/ปิดงาน</label><input type="month" id="cfp_month" value="' + defaultMonth + '"></div>';
  h += '<div class="fg"><label>หมายเหตุ (ถ้ามี)</label><input type="text" id="cfp_note" value="' + sanitize(existing ? (existing.note || '') : '') + '"></div>';
  h += '<button class="btn bp btn-full" onclick="confirmCreateForecastFromPipeline(\'' + pipelineId + '\',\'' + (existing ? existing.id : '') + '\')">✅ ' + (existing ? 'อัปเดต Forecast' : 'สร้าง Forecast') + '</button>';
  h += '</div>';
  openM('📊 สร้าง Product Forecast จากโครงการนี้', h);
}

function confirmCreateForecastFromPipeline(pipelineId, existingId) {
  var p = ST.getOne('pipeline', pipelineId);
  if (!p) return;
  var month = document.getElementById('cfp_month').value;
  if (!month) return alert('เลือกเดือน');
  var note = document.getElementById('cfp_note').value.trim();
  var data = { type: 'project', month: month, pipeId: pipelineId, projectName: p.projectName || '', totalQty: getPipeTotalQty(p), note: note };
  _saveSalesForecastCore(p.dealerId, existingId || '', data, function() { closeMForce(); });
}

function delSalesForecast(dealerId, id) {
  if (!confirm('ลบรายการนี้? (จะหายจากฝั่ง client-view ด้วย)')) return;
  db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(id).delete().then(function() {
    var cache = JSON.parse(localStorage.getItem('v7_customer_forecasts') || '[]').filter(function(c) { return c.id !== id; });
    localStorage.setItem('v7_customer_forecasts', JSON.stringify(cache));
    if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('customerForecasts', id);
    if (sfRREditId === id) sfRREditId = null;
    if (sfPREditId === id) sfPREditId = null;
    toast('🗑️ ลบแล้ว'); render();
  }).catch(function(err) {
    toast('❌ ลบไม่สำเร็จ: ' + err.message, true);
  });
}

// เปิดฟอร์มแก้ไข Pipeline ตรงไปที่ช่อง Shipment Date เลย (เลื่อนจอ + ไฮไลท์ชั่วคราว) — กดจากการ์ด Project
// forecast ที่ผูก Pipeline ไว้ ไม่ต้องไปหาช่อง Shipment เองในฟอร์มยาวๆ
function jumpToPipeShipment(dealerId, pipeId) {
  showPipelineM(dealerId, pipeId);
  setTimeout(function() {
    var wrap = document.getElementById('dpw_fp_ship');
    if (!wrap) return;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    wrap.classList.add('sf-ship-highlight');
    setTimeout(function() { wrap.classList.remove('sf-ship-highlight'); }, 2000);
  }, 50);
}

// ================================================================
// DEALER FORECAST — MODEL VIEW
// ================================================================
// ตัวกรองเดือนสำหรับตาราง Forecast ตาม Model ในแท็บ Dealer — เหมือนแบบในเมนู Forecast หลักทุกอย่าง
// (เลือกได้หลายเดือน ไม่เลือก = ทุกเดือน) ต่างกันแค่ผูกกับ dlrFcModelMonthFilter คนละตัวแปร
function dlrFcModelMonthFilterHtml() {
  var monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var hasFilter = Object.keys(dlrFcModelMonthFilter).length > 0;
  var h = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px">';
  h += '<span style="font-size:.72rem;color:var(--text2)">📅 เลือกเดือน (ไม่เลือก = ทุกเดือน):</span>';
  monthNames.forEach(function(mn, idx) {
    var on = !!dlrFcModelMonthFilter[idx];
    h += '<span onclick="dlrFcToggleModelMonth(' + idx + ')" style="cursor:pointer;font-size:.72rem;padding:4px 10px;border-radius:14px;' +
      (on ? 'background:var(--accent);color:#fff' : 'background:var(--bg2);border:1px solid var(--border);color:var(--text2)') + '">' + mn + '</span>';
  });
  if (hasFilter) h += '<button class="btn bsm bo" onclick="dlrFcClearModelMonthFilter()">✕ ล้าง</button>';
  h += '</div>';
  return h;
}

function buildDlrFcModel(modelList, totalFc, totalQty, d) {
  window._dlrFcSummaryTexts = []; // reset ทุกครั้งที่ render ใหม่ กันสะสมค้างจากรอบก่อน (ดู copyDlrFcSummaryCell)
  var h = dlrFcModelMonthFilterHtml();

  if (!modelList.length) return h + '<div class="empty"><p>ไม่มีข้อมูลตามตัวกรองที่เลือก</p></div>';

  h += '<div class="export-wrap"><table class="export-table" id="fcDlr_' + d.id + '">';
  h += '<thead><tr><th>#</th><th>Model</th><th style="text-align:center">QTY</th><th style="text-align:right">มูลค่า</th><th>สรุป</th></tr></thead>';
  h += '<tbody>';

  modelList.forEach(function(m, idx) {
    var summaryLines = [];
    var summaryPlainLines = [];
    m.lines.forEach(function(ln) {
      var eu = ln.endUser ? ' (' + sanitize(ln.endUser) + ')' : '';
      var euPlain = ln.endUser ? ' (' + ln.endUser + ')' : '';
      summaryLines.push(sanitize(ln.label) + eu + ' x' + ln.qty);
      summaryPlainLines.push(ln.label + euPlain + ' x' + ln.qty);
    });
    var sIdx = window._dlrFcSummaryTexts.push(summaryPlainLines.join('\n')) - 1;

    h += '<tr>';
    h += '<td class="pipe-row-num">' + (idx + 1) + '</td>';
    h += '<td><strong>' + sanitize(m.model) + '</strong></td>';
    h += '<td style="text-align:center">' + m.qty + '</td>';
    h += '<td style="text-align:right">' + fmtMoneyStyled(m.amount) + '</td>';
    h += '<td style="font-size:.64rem;line-height:1.6"><div style="display:flex;justify-content:space-between;gap:6px;align-items:flex-start">' +
      '<span>' + summaryLines.join('<br>') + '</span>' +
      '<button class="btn-xs" style="flex-shrink:0" onclick="copyDlrFcSummaryCell(' + sIdx + ')" title="Copy สรุปช่องนี้">📋</button></div></td>';
    h += '</tr>';
  });

  h += '<tr style="font-weight:700;border-top:2px solid var(--border)">';
  h += '<td></td><td>รวม</td>';
  h += '<td style="text-align:center">' + totalQty + '</td>';
  h += '<td style="text-align:right">' + fmtMoneyStyled(totalFc) + '</td>';
  h += '<td></td>';
  h += '</tr>';
  h += '</tbody></table></div>';
  return h;
}

function copyDlrFcSummaryCell(idx) {
  var text = (window._dlrFcSummaryTexts || [])[idx];
  if (!text) return;
  copyText(text, '📋 Copy สรุปแล้ว');
}

// คลิกช่องเดือนในตาราง forecast → เด้ง modal รายละเอียดโปรเจค + แก้ Shipment Date ได้
function fcCellDetail(idx) {
  var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var ref = (window._fcCellRefs || [])[idx];
  if (!ref) return;
  var periodLabel = ref.label || months[ref.monthIndex] || '';
  var html = '<div style="font-size:13px;color:var(--text2);margin-bottom:10px">ช่วง <strong>' + periodLabel + '</strong> · รุ่น <strong>' + sanitize(ref.model) + '</strong></div>';
  (ref.projectIds || []).forEach(function(pid) {
    var p = ST.getOne('pipeline', pid);
    if (!p) return;
    var ship = getPipeShipDate(p);
    var estNote = (ship && ship.est) ? ' <span style="color:#f59e0b">(ตอนนี้ประมาณจาก Bidding +2 เดือน)</span>' : '';
    var itemsTxt = (getPipeItems(p) || []).map(function(it){ return sanitize(it.model) + ' x' + (it.qty || 1); }).join(', ');
    var shipVal = p.shipmentDate ? String(p.shipmentDate).slice(0, 10) : '';
    var dealer = p.dealerId ? ST.getOne('dealers', p.dealerId) : null;
    html += '<div style="border:1px solid var(--border,#334155);border-radius:10px;padding:10px;margin-bottom:8px">';
    html += '<div style="font-weight:700">' + sanitize(p.projectName || '-') + '</div>';
    html += '<div style="font-size:12px;color:var(--accent);font-weight:600;margin:2px 0">🏪 ' + sanitize(dealer ? dealer.name : 'ไม่ระบุ Dealer') + '</div>';
    html += '<div style="font-size:12px;color:var(--text2);margin:2px 0">👤 ' + sanitize(p.endUserTH || p.endUserEN || '-') + ' · ' + (typeof pipeTag === 'function' ? pipeTag(p.status) : (p.status || '')) + '</div>';
    html += '<div style="font-size:12px;margin:2px 0">📦 ' + itemsTxt + '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">';
    html += '<label style="font-size:12px">🚚 Shipment:' + estNote + '</label>';
    html += '<input type="date" id="fcsd_' + p.id + '" value="' + shipVal + '" style="padding:6px;border-radius:6px">';
    html += '<button class="btn bsm bp" onclick="fcSaveShipment(\'' + p.id + '\')">💾 บันทึก</button>';
    html += '<button class="btn bsm bo" onclick="closeM();showPipelineM(\'' + (p.dealerId || '') + '\',\'' + p.id + '\')">✏️ แก้ทั้งหมด</button>';
    html += '</div></div>';
  });
  openM('📦 รายละเอียดเดือน', html);
}
function fcSaveShipment(pid) {
  var el = document.getElementById('fcsd_' + pid);
  if (!el) return;
  ST.update('pipeline', pid, { shipmentDate: el.value || '' });
  var p = ST.getOne('pipeline', pid);
  if (p && p.dealerId && typeof syncAllPipelinesToFirebase === 'function') syncAllPipelinesToFirebase(p.dealerId);
  toast('✅ บันทึก Shipment Date แล้ว');
  closeM();
  render();
}

function buildDlrFcMonthly(pipes, d, catFilterVarName) {
  var now = new Date();
  var year = now.getFullYear();
  var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  var models = {};
  var monthTotals = {};
  for (var mi = 0; mi < 12; mi++) monthTotals[mi] = {qty: 0, amt: 0};

  pipes.forEach(function(p) {
    var _ship = getPipeShipDate(p);
    if (!_ship) return;
    if (fcHideTentative && _ship.est) return;
    var shipDate = _ship.date;
    var _est = _ship.est;
    if (shipDate.getFullYear() !== year) return;
    var m = shipDate.getMonth();
    
    var items = getPipeItems(p);
    if (!items.length) return;
    
    items.forEach(function(it) {
      if (catFilterVarName && !fcCatIsVisible(catFilterVarName, getModelCategory(it.model))) return;
      var model = it.model || 'ไม่ระบุ';
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));

      if (!models[model]) {
        models[model] = {};
        for (var i = 0; i < 12; i++) models[model][i] = {qty: 0, amt: 0, projects: []};
      }
      
      models[model][m].qty += qty;
      models[model][m].amt += amt;
      if (_est) models[model][m].est = true;  // ช่องนี้มีค่าประมาณ

      var found = false;
      for (var fi = 0; fi < models[model][m].projects.length; fi++) {
        if (models[model][m].projects[fi].id === p.id) { found = true; break; }
      }
      if (!found) models[model][m].projects.push(p);
      
      monthTotals[m].qty += qty;
      monthTotals[m].amt += amt;
    });
  });

  var modelNames = Object.keys(models).sort();

  if (!modelNames.length) {
    return '<div class="empty"><p>ไม่มีข้อมูล (ต้องมี Shipment Date หรือ Bidding Date ในรายการ Pipeline)</p></div>';
  }

  window._fcCellRefs = [];
  var h = '<div class="export-wrap" style="overflow-x:auto"><table class="export-table" id="fcDlrM_' + d.id + '">';
  h += '<thead><tr><th>Model</th>';
  for (var mh = 0; mh < 12; mh++) {
    var isCur = mh === now.getMonth();
    h += '<th style="text-align:center;min-width:55px' + (isCur ? ';background:rgba(59,130,246,0.15)' : '') + '">' + months[mh] + '</th>';
  }
  h += '<th style="text-align:right">รวม</th></tr></thead>';
  h += '<tbody>';

  modelNames.forEach(function(model) {
    var tQty = 0;
    var tAmt = 0;
    h += '<tr>';
    h += '<td><strong>' + sanitize(model) + '</strong></td>';
    for (var mc = 0; mc < 12; mc++) {
      var cell = models[model][mc];
      var isCur = mc === now.getMonth();
      var bg = isCur ? 'background:rgba(59,130,246,0.08);' : '';
      if (cell.qty > 0) {
        tQty += cell.qty;
        tAmt += cell.amt;
        var tip = cell.projects.map(function(pp) { return (pp.projectName || '').substr(0, 25); }).join('\n');
        var _es = cell.est ? 'opacity:0.5;' : '';
        var _em = cell.est ? '~' : '';
        var _ci = window._fcCellRefs.push({ model: model, monthIndex: mc, dealerId: d.id, projectIds: cell.projects.map(function(pp){ return pp.id; }) }) - 1;
        h += '<td onclick="fcCellDetail(' + _ci + ')" style="cursor:pointer;text-align:center;' + bg + _es + '" title="' + sanitize(tip) + ' — คลิกดู/แก้ Shipment">';
        h += '<div style="font-weight:700">' + _em + cell.qty + '</div>';
        h += '<div style="font-size:.56rem;color:var(--text2)">' + fmtMoneyShort(cell.amt) + '</div>';
        h += '</td>';
      } else {
        h += '<td style="text-align:center;color:var(--text2);' + bg + '">-</td>';
      }
    }
    h += '<td style="text-align:right;font-weight:700">' + tQty + '<div style="font-size:.58rem">' + fmtMoneyShort(tAmt) + '</div></td>';
    h += '</tr>';
  });

  h += '<tr style="font-weight:700;border-top:2px solid var(--border)">';
  h += '<td>รวม</td>';
  var grand = 0;
  for (var mt = 0; mt < 12; mt++) {
    var isCur = mt === now.getMonth();
    var bg = isCur ? 'background:rgba(59,130,246,0.08);' : '';
    grand += monthTotals[mt].amt;
    if (monthTotals[mt].qty > 0) {
      h += '<td style="text-align:center;' + bg + '">' + monthTotals[mt].qty + '<div style="font-size:.56rem">' + fmtMoneyShort(monthTotals[mt].amt) + '</div></td>';
    } else {
      h += '<td style="text-align:center;' + bg + '">-</td>';
    }
  }
  h += '<td style="text-align:right">' + fmtMoneyShort(grand) + '</td>';
  h += '</tr>';
  h += '</tbody></table></div>';
  return h;
}

// ================================================================
// DEALER FORECAST — QUARTERLY VIEW
// ================================================================
function buildDlrFcQuarterly(pipes, d, catFilterVarName) {
  var now = new Date();
  var year = now.getFullYear();
  var qLabels = ['Q1','Q2','Q3','Q4'];

  var models = {};
  var qTotals = [{qty:0,amt:0},{qty:0,amt:0},{qty:0,amt:0},{qty:0,amt:0}];

  pipes.forEach(function(p) {
    var _ship = getPipeShipDate(p);
    if (!_ship) return;
    if (fcHideTentative && _ship.est) return;
    var shipDate = _ship.date;
    var _est = _ship.est;
    if (shipDate.getFullYear() !== year) return;
    var q = Math.floor(shipDate.getMonth() / 3);
    
    var items = getPipeItems(p);
    if (!items.length) return;
    
    items.forEach(function(it) {
      if (catFilterVarName && !fcCatIsVisible(catFilterVarName, getModelCategory(it.model))) return;
      var model = it.model || 'ไม่ระบุ';
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));

      if (!models[model]) {
        models[model] = [{qty:0,amt:0,projects:[]},{qty:0,amt:0,projects:[]},{qty:0,amt:0,projects:[]},{qty:0,amt:0,projects:[]}];
      }
      
      models[model][q].qty += qty;
      models[model][q].amt += amt;
      if (_est) models[model][q].est = true;  // ไตรมาสนี้มีค่าประมาณ

      var found = false;
      for (var fi = 0; fi < models[model][q].projects.length; fi++) {
        if (models[model][q].projects[fi].id === p.id) { found = true; break; }
      }
      if (!found) models[model][q].projects.push(p);
      
      qTotals[q].qty += qty;
      qTotals[q].amt += amt;
    });
  });

  var modelNames = Object.keys(models).sort();
  var currentQ = Math.floor(now.getMonth() / 3);

  if (!modelNames.length) {
    return '<div class="empty"><p>ไม่มีข้อมูล (ต้องมี Shipment Date หรือ Bidding Date ในรายการ Pipeline)</p></div>';
  }

  window._fcCellRefs = [];
  var h = '<div class="export-wrap"><table class="export-table" id="fcDlrQ_' + d.id + '">';
  h += '<thead><tr><th>Model</th>';
  for (var qh = 0; qh < 4; qh++) {
    var isCur = qh === currentQ;
    h += '<th style="text-align:center;min-width:80px' + (isCur ? ';background:rgba(59,130,246,0.15)' : '') + '">' + qLabels[qh] + '</th>';
  }
  h += '<th style="text-align:right">รวม</th></tr></thead>';
  h += '<tbody>';

  modelNames.forEach(function(model) {
    var tQty = 0;
    var tAmt = 0;
    h += '<tr>';
    h += '<td><strong>' + sanitize(model) + '</strong></td>';
    for (var qc = 0; qc < 4; qc++) {
      var cell = models[model][qc];
      var isCur = qc === currentQ;
      var bg = isCur ? 'background:rgba(59,130,246,0.08);' : '';
      if (cell.qty > 0) {
        tQty += cell.qty;
        tAmt += cell.amt;
        var tip = cell.projects.map(function(pp) { return (pp.projectName || '').substr(0, 25); }).join('\n');
        var _es = cell.est ? 'opacity:0.5;' : '';
        var _em = cell.est ? '~' : '';
        var _ci = window._fcCellRefs.push({ model: model, label: qLabels[qc], dealerId: d.id, projectIds: cell.projects.map(function(pp){ return pp.id; }) }) - 1;
        h += '<td onclick="fcCellDetail(' + _ci + ')" style="cursor:pointer;text-align:center;' + bg + _es + '" title="' + sanitize(tip) + ' — คลิกดู/แก้ Shipment">';
        h += '<div style="font-weight:700;font-size:1.1em">' + _em + cell.qty + '</div>';
        h += '<div style="font-size:.58rem">' + fmtMoneyStyled(cell.amt) + '</div>';
        h += '</td>';
      } else {
        h += '<td style="text-align:center;color:var(--text2);' + bg + '">-</td>';
      }
    }
    h += '<td style="text-align:right;font-weight:700">' + tQty + '<div style="font-size:.58rem">' + fmtMoneyShort(tAmt) + '</div></td>';
    h += '</tr>';
  });

  h += '<tr style="font-weight:700;border-top:2px solid var(--border)">';
  h += '<td>รวม</td>';
  var grand = 0;
  for (var qt = 0; qt < 4; qt++) {
    var isCur = qt === currentQ;
    var bg = isCur ? 'background:rgba(59,130,246,0.08);' : '';
    grand += qTotals[qt].amt;
    h += '<td style="text-align:center;' + bg + '">';
    h += '<div>' + qTotals[qt].qty + '</div>';
    h += '<div style="font-size:.58rem">' + fmtMoneyShort(qTotals[qt].amt) + '</div>';
    h += '</td>';
  }
  h += '<td style="text-align:right">' + fmtMoneyShort(grand) + '</td>';
  h += '</tr>';
  h += '</tbody></table></div>';
  return h;
}

function copyDealerForecast(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  var allPipes = ST.pipelineByDealer(dealerId);
  var pipes;
  if (dlrFcStatus === 'all') {
    pipes = allPipes;
  } else if (dlrFcStatus === 'won') {
    pipes = allPipes.filter(function(p) { return pipeIsWon(p); });
  } else {
    pipes = allPipes.filter(function(p) { return pipeIsOpen(p); });
  }
  
  var tsv = 'Forecast — ' + (d ? d.name : '') + '\n';
  tsv += '#\tModel\tQTY\tAmount\tProject\tShipment\tStatus\n';
  pipes.forEach(function(p, idx) {
    var items = getPipeItems(p);
    if (items.length > 1) {
      items.forEach(function(it, ii) {
        var amt = Number(it.total) || ((Number(it.qty) || 1) * (Number(it.price) || 0));
        tsv += (idx + 1) + (ii > 0 ? '.' + (ii + 1) : '') + '\t' + (it.model || '') + '\t' + (it.qty || 1) + '\t' + amt + '\t' + (ii === 0 ? (p.projectName || '') : '') + '\t' + (ii === 0 ? (p.shipmentDate || '') : '') + '\t' + (ii === 0 ? getPipeName(p.status) : '') + '\n';
      });
    } else {
      var modelText = getPipeModelSummary(p);
      tsv += (idx + 1) + '\t' + modelText + '\t' + getPipeTotalQty(p) + '\t' + (p.forecastAmount || '') + '\t' + (p.projectName || '') + '\t' + (p.shipmentDate || '') + '\t' + getPipeName(p.status) + '\n';
    }
  });
  copyText(tsv, '📋 Copy Forecast');
}

// ================================================================
// PRE-VISIT BRIEF
// ================================================================
function showPreVisitBrief(dealerId) {
  const d = ST.getOne('dealers', dealerId);
  if (!d) return;
  const cfg = getConfig();
  const h = calcHealthScore(dealerId);
  const pipes = ST.pipelineByDealer(dealerId).filter(p => pipeIsOpen(p));
  const wonAmt = ST.pipelineByDealer(dealerId).filter(p => pipeIsWon(p)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const lastVisit = ST.visitsByDealer(dealerId)[0];
  const lastFU = ST.followupsByDealer(dealerId)[0];
  const fbs = ST.feedbackByDealer(dealerId).slice(0, 5);
  const waits = ST.filter('waiting', w => !w.resolved && w.dealerId === dealerId);
  
  const certGaps = [];
  if (d.dsecStatus !== 'pass') certGaps.push('DSEC');
  if (d.crmStatus !== 'yes') certGaps.push('CRM');
  if (d.fh2Status !== 'pass') certGaps.push('FH2');
  if (d.larkStatus !== 'added') certGaps.push('Lark');

  const briefText = buildBriefText(d, pipes, wonAmt, lastVisit, fbs, certGaps, waits);

  openM('📋 Pre-Visit Brief — ' + d.name, `
  <div class="brief-card">
    <h3>🏪 ${sanitize(d.name)} ${levelTag(d.level)}</h3>
    <div class="brief-section"><h4>👤 ผู้ติดต่อ</h4><div class="val" style="white-space:pre-wrap">${sanitize(d.contact||'-')}</div></div>
    ${d.googleMap ? `<div class="brief-section"><h4>📍 Location</h4><a href="${d.googleMap}" target="_blank">เปิดแผนที่ ↗</a></div>` : ''}
    <div class="brief-section"><h4>💰 ยอดขาย</h4><div class="val">${fmtMoney(wonAmt)} / ${fmtMoney(d.targetRevenue||0)} ฿ (${d.targetRevenue ? Math.round(wonAmt/(Number(d.targetRevenue))*100) : 0}%)</div></div>
    ${d.customerSegment ? `<div class="brief-section"><h4>กลุ่มลูกค้า</h4><div class="val">${sanitize(d.customerSegment)}</div></div>` : ''}
  </div>

  ${pipes.length ? `<div class="brief-card"><h3>📊 Pipeline Active (${pipes.length})</h3>
  ${pipes.map(p => `<div style="font-size:.76rem;padding:3px 0;border-bottom:1px solid #334155">
    • ${sanitize(p.projectName)} — ${p.model||''} — ${fmtMoney(p.forecastAmount)} — ${getPipeName(p.status)}
    ${p.biddingDate ? ' — Bid: '+fD(p.biddingDate) : ''}</div>`).join('')}
  </div>` : ''}

  ${lastVisit ? `<div class="brief-card"><h3>🤝 Visit ล่าสุด (${fD(lastVisit.date)})</h3>
  <div style="font-size:.76rem;white-space:pre-wrap;max-height:100px;overflow:auto">${sanitize(lastVisit.summary?.substr(0,300)||'-')}</div></div>` : ''}

  ${fbs.length ? `<div class="brief-card"><h3>💡 Feedback ครั้งก่อน</h3>
  ${fbs.map(f => `<div style="font-size:.74rem;padding:2px 0">• ${sanitize(f.text)}</div>`).join('')}</div>` : ''}

  ${certGaps.length ? `<div class="brief-card" style="border-color:#f59e0b"><h3>⚠️ Cert ที่ควรถาม</h3>
  <div style="font-size:.78rem">${certGaps.join(', ')} — ยังไม่ผ่าน/ไม่มี</div></div>` : ''}

  ${waits.length ? `<div class="brief-card" style="border-color:#ef4444"><h3>📭 สิ่งที่ค้างอยู่</h3>
  ${waits.map(w => `<div style="font-size:.74rem;padding:2px 0">• ${sanitize(w.title)} ${w.dueDate?'(กำหนด: '+fD(w.dueDate)+')':''}</div>`).join('')}</div>` : ''}

  <div class="bg" style="margin-top:8px">
    <button class="btn bp" onclick="copyPreVisitBrief('${dealerId}')">📋 Copy Brief</button>
    <button class="btn bs" onclick="closeM();showVisitM('${dealerId}')">🤝 เริ่ม Visit</button>
  </div>`);
}

function buildBriefText(d, pipes, wonAmt, lastVisit, fbs, certGaps, waits) {
  let txt = `Pre-Visit Brief — ${d.name}\n${'─'.repeat(30)}\n`;
  txt += `Level: ${d.level || '-'}\n`;
  txt += `ผู้ติดต่อ: ${d.contact || '-'}\n`;
  txt += `ยอดขาย: ${fmtMoney(wonAmt)} / ${fmtMoney(d.targetRevenue||0)} ฿\n`;
  if (d.customerSegment) txt += `กลุ่มลูกค้า: ${d.customerSegment}\n`;
  if (pipes.length) {
    txt += `\nPipeline Active (${pipes.length}):\n`;
    pipes.forEach(p => { txt += `  • ${p.projectName} — ${p.model||''} — ${fmtMoney(p.forecastAmount)} — ${getPipeName(p.status)}\n`; });
  }
  if (lastVisit) txt += `\nVisit ล่าสุด (${fD(lastVisit.date)}): ${lastVisit.summary?.substr(0,200)||'-'}\n`;
  if (fbs.length) { txt += `\nFeedback ครั้งก่อน:\n`; fbs.forEach(f => { txt += `  • ${f.text}\n`; }); }
  if (certGaps.length) txt += `\n⚠️ Cert ที่ยังไม่ผ่าน: ${certGaps.join(', ')}\n`;
  if (waits.length) { txt += `\n📭 ค้าง:\n`; waits.forEach(w => { txt += `  • ${w.title}\n`; }); }
  return txt;
}

function copyPreVisitBrief(dealerId) {
  const d = ST.getOne('dealers', dealerId);
  if (!d) return;
  const pipes = ST.pipelineByDealer(dealerId).filter(p => pipeIsOpen(p));
  const wonAmt = ST.pipelineByDealer(dealerId).filter(p => pipeIsWon(p)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const lastVisit = ST.visitsByDealer(dealerId)[0];
  const fbs = ST.feedbackByDealer(dealerId).slice(0, 5);
  const certGaps = [];
  if (d.dsecStatus !== 'pass') certGaps.push('DSEC');
  if (d.crmStatus !== 'yes') certGaps.push('CRM');
  if (d.fh2Status !== 'pass') certGaps.push('FH2');
  if (d.larkStatus !== 'added') certGaps.push('Lark');
  const waits = ST.filter('waiting', w => !w.resolved && w.dealerId === dealerId);
  
  const txt = buildBriefText(d, pipes, wonAmt, lastVisit, fbs, certGaps, waits);
  copyText(txt, '📋 Copy Brief แล้ว!');
}

// ================================================================
// DELETE DEALER
// ================================================================
function delDealer(id) {
  if (!confirm('⚠️ ลบ Dealer นี้?\n(Pipeline, Visit, Follow-up, Feedback จะถูกลบด้วย)')) return;
  if (!confirm('⚠️⚠️ ยืนยันอีกครั้ง — ลบทุกอย่าง?')) return;

  // เก็บสำเนาไว้ก่อนลบ เพื่อรองรับปุ่ม "เลิกทำ" (showUndoToast) — คืนของแบบเดิมทุก collection ที่ลบไป
  const _undoDealer = ST.getOne('dealers', id);
  const _undoPipes = ST.pipelineByDealer(id);
  const _undoPipeIds = {};
  _undoPipes.forEach(p => { _undoPipeIds[p.id] = true; });
  const _undoLogs = ST.getAll('pipeLog').filter(l => _undoPipeIds[l.pipeId]);
  const _undoVisits = ST.getAll('visits').filter(v => v.dealerId === id);
  const _undoFollowups = ST.getAll('followups').filter(f => f.dealerId === id);
  const _undoLineLog = ST.getAll('lineLog').filter(l => l.dealerId === id);
  const _undoFeedback = ST.getAll('feedback').filter(f => f.dealerId === id);

  ST.delete('dealers', id);
  ST.deleteWhere('pipeline', p => p.dealerId === id);
  ST.deleteWhere('pipeLog', l => {
    const p = ST.getOne('pipeline', l.pipeId);
    return !p;
  });
  ST.deleteWhere('visits', v => v.dealerId === id);
  ST.deleteWhere('followups', f => f.dealerId === id);
  ST.deleteWhere('lineLog', l => l.dealerId === id);
  ST.deleteWhere('feedback', f => f.dealerId === id);
  if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('dealers', id);

  dealerTab = 'info';
  go('dealers');
  showUndoToast('🗑️ ลบ Dealer แล้ว', function() {
    if (!_undoDealer) return;
    ST.add('dealers', _undoDealer);
    _undoPipes.forEach(p => ST.add('pipeline', p));
    _undoLogs.forEach(l => ST.add('pipeLog', l));
    _undoVisits.forEach(v => ST.add('visits', v));
    _undoFollowups.forEach(f => ST.add('followups', f));
    _undoLineLog.forEach(l => ST.add('lineLog', l));
    _undoFeedback.forEach(f => ST.add('feedback', f));
    if (typeof syncItemToFirebase === 'function') {
      syncItemToFirebase('dealers', _undoDealer);
      _undoPipes.forEach(p => syncItemToFirebase('pipeline', p));
      _undoLogs.forEach(l => syncItemToFirebase('pipeLog', l));
      _undoVisits.forEach(v => syncItemToFirebase('visits', v));
      _undoFollowups.forEach(f => syncItemToFirebase('followups', f));
      _undoLineLog.forEach(l => syncItemToFirebase('lineLog', l));
      _undoFeedback.forEach(f => syncItemToFirebase('feedback', f));
    }
    go('dealerDetail', { dealerId: id });
    toast('↩️ กู้คืน Dealer แล้ว');
  });
}

// ================================================================
// DEALER COPY/EXPORT
// ================================================================
function copyDealerSummary() {
  const dealers = ST.getAll('dealers');
  const _cdsCfg = getConfig(); // ครั้งเดียวก่อนลูป — เหตุผลเดียวกับ rDealers()
  let tsv = 'SIS Code\tDJI Code\tName\tLevel\tContact\tเซลที่ดูแล\tTerm\tCredit Limit\tTarget\tWon\tAchieve%\tHealth\tLast Contact\tLast Visit\tDSEC\tCRM\tFH2\tLark\n';
  dealers.forEach(d => {
    const dPipes = ST.pipelineByDealer(d.id);
    const won = dPipes.filter(p => pipeIsWon(p)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
    const target = Number(d.targetRevenue) || 0;
    const pct = target ? Math.round(won/target*100) : 0;
    const h = calcHealthScore(d.id, _cdsCfg, dPipes);
    const lcd = ST.getLastContactDays(d.id);
    const lvd = ST.getLastVisitDays(d.id);
    tsv += `${d.sisCode||''}\t${d.djiCode||''}\t${d.name}\t${d.level||''}\t${(d.contact||'').replace(/[\t\n]/g,' ')}\t${(d.saleName||'').replace(/[\t\n]/g,' ')}\t${d.creditTerm||''}\t${d.creditLimit||''}\t${target}\t${won}\t${pct}%\t${h.score}\t${lcd!==null?lcd+'d':'-'}\t${lvd!==null?lvd+'d':'-'}\t${d.dsecStatus==='pass'?'Y':'N'}\t${d.crmStatus==='yes'?'Y':'N'}\t${d.fh2Status==='pass'?'Y':'N'}\t${d.larkStatus==='added'?'Y':'N'}\n`;
  });
  copyText(tsv, '📋 Copy Dealer Summary');
}

// แก้ Level ตรงในตารางรายชื่อ Dealer แบบไม่ต้องเปิดหน้ารายละเอียด — คลิกที่ป้าย Level เปิด dropdown
// ให้เลือกเลย บันทึกทันทีตอนเลือก (เหมือน markDealerAuthorized ข้างล่างที่ทำ ST.update({level:...}) เฉยๆ
// อยู่แล้ว ไม่มี side effect พิเศษ เพราะราคา/เกณฑ์ Demo อ่าน d.level สดทุกครั้งไม่มี cache)
function _dealerInlineEditLevel(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  var cell = document.getElementById('dlvl_' + dealerId);
  if (!cell || cell.querySelector('select')) return;
  var levels = ['S', 'A', 'B', 'Other'];
  var opts = levels.map(function(lv) {
    var val = lv === 'Other' ? '' : lv;
    var selected = (d.level || '') === val || (lv === 'Other' && !['S','A','B'].includes(d.level));
    return '<option value="' + val + '"' + (selected ? ' selected' : '') + '>' + lv + '</option>';
  }).join('');
  cell.innerHTML = '<select onclick="event.stopPropagation()" onchange="event.stopPropagation();_dealerInlineSaveLevel(\'' + dealerId + '\',this.value)" style="font-size:11px;padding:2px 4px">' + opts + '</select>';
  var sel = cell.querySelector('select');
  if (sel) sel.focus();
}

function _dealerInlineSaveLevel(dealerId, newLevel) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  ST.update('dealers', dealerId, { level: newLevel });
  if (typeof addAuditLog === 'function') addAuditLog('update_dealer_level', 'dealer', dealerId, d.name, dealerId, d.name, { oldLevel: d.level || '', newLevel: newLevel });
  toast('💾 เปลี่ยน Level เป็น ' + (newLevel || 'Other') + ' แล้ว');
  render();
}

// ทับ Sale ของทุก Pipeline ใต้ Dealer นี้ให้ตรงกับ "เซลที่ดูแล" ของ Dealer เสมอ (ตกลงกันไว้ว่าทับทั้งหมด
// ไม่เช็คว่า Pipeline นั้นเคยตั้ง Sale ไว้ต่างจาก Dealer หรือเปล่า)
function cascadeDealerSaleNameToPipelines(dealerId, saleName) {
  // เดิมวน ST.update() ทีละ pipeline — แต่ ST.update() parse/stringify ทั้ง collection pipeline ใหม่ทุกครั้ง
  // ที่เรียก พอ Dealer มีหลาย pipeline + ระบบมี pipeline รวมเยอะ ทำให้แอพค้างจริง (ผู้ใช้แจ้ง 2026-08-24)
  // เปลี่ยนเป็น ST.updateMany() อ่าน/เขียนทั้งก้อนครั้งเดียว
  var ids = ST.pipelineByDealer(dealerId).filter(function(p) { return p.saleName !== saleName; }).map(function(p) { return p.id; });
  if (ids.length) ST.updateMany('pipeline', ids, { saleName: saleName });
}

function markDealerAuthorized(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  if (!confirm('อัปเกรด "' + d.name + '" เป็น Level B และนับเป็น Dealer ใหม่ที่พัฒนาในไตรมาสนี้ ใช่ไหม?')) return;
  var cfg = getConfig();
  var today = new Date().toISOString().split('T')[0];
  var saleName = cfg.saleName || ((typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? (CURRENT_USER.displayName || CURRENT_USER.email) : '');
  ST.update('dealers', dealerId, { level: 'B', authorizedDate: today, authorizedBy: saleName });
  if (typeof addAuditLog === 'function') addAuditLog('mark_dealer_authorized', 'dealer', dealerId, d.name, dealerId, d.name, { newLevel: 'B' });
  toast('🌟 อัปเกรดเป็น Authorized Dealer แล้ว');
  render();
}

function dlDealerCSV() {
  const dealers = ST.getAll('dealers');
  let csv = '\uFEFF"SIS Code","DJI Code","Name","Level","Contact","\u0E40\u0E0B\u0E25\u0E17\u0E35\u0E48\u0E14\u0E39\u0E41\u0E25","Phone","Email","Term","Credit Limit","Target Revenue","Won Revenue","Achieve%","DSEC","CRM","FH2","Lark","Google Map"\n';
  dealers.forEach(d => {
    const won = ST.pipelineByDealer(d.id).filter(p => pipeIsWon(p)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
    const target = Number(d.targetRevenue) || 0;
    csv += `"${d.sisCode||''}","${d.djiCode||''}","${esc(d.name)}","${d.level||''}","${esc(d.contact)}","${esc(d.saleName)}","${d.phone||''}","${d.email||''}","${d.creditTerm||''}","${d.creditLimit||''}","${target}","${won}","${target?Math.round(won/target*100):0}%","${d.dsecStatus||''}","${d.crmStatus||''}","${d.fh2Status||''}","${d.larkStatus||''}","${d.googleMap||''}"\n`;
  });
  dlBlob(csv, `dealers-${_td()}.csv`);
}

function exportDealersExcel() {
  var dealers = ST.getAll('dealers');
  if (!dealers.length) return toast('\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 Dealer');
  var headers = ['id','\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E23\u0E34\u0E29\u0E31\u0E17','SIS Code','DJI Code','Level','DJI Dealer','\u0E40\u0E0B\u0E25\u0E17\u0E35\u0E48\u0E14\u0E39\u0E41\u0E25','Credit Term','Credit Limit','Target Revenue','\u0E1C\u0E39\u0E49\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D','Google Map','\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38','Payment Condition'];
  var rows = [headers].concat(dealers.map(_dealerExcelRow));
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  // \u0E04\u0E2D\u0E25\u0E31\u0E21\u0E19\u0E4C id \u0E17\u0E33 read-only hint \u0E14\u0E49\u0E27\u0E22\u0E2A\u0E35
  ws['!cols'] = [{wch:20},{wch:35},{wch:12},{wch:12},{wch:8},{wch:15},{wch:16},{wch:12},{wch:14},{wch:14},{wch:30},{wch:40},{wch:30},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws, 'Dealers');
  XLSX.writeFile(wb, 'dealers-export-' + _td() + '.xlsx');
  toast('\uD83D\uDCCA Export ' + dealers.length + ' Dealer \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
}

function copyDealerVisits(dealerId) {
  const cfg = getConfig();
  const d = ST.getOne('dealers', dealerId);
  const vts = ST.visitsByDealer(dealerId);
  let tsv = 'Date\tSale\tDealer Name\tOffline/Online\tDJI Dealer\tUpdate\tLocation\n';
  vts.forEach(v => {
    tsv += `${fD(v.date)}\t${v.saleName||cfg.saleName}\t${d?.name||''}\t${v.mode==='offline'?'Offline':'Online'}\t${v.djiDealer||''}\t${buildVisitUpdateText(v).replace(/[\t]/g,' ')}\t${v.location||''}\n`;
  });
  copyText(tsv, `📋 Copy Visit ${d?.name||''}`);
}

function dlDealerVisitsCSV(dealerId) {
  const cfg = getConfig();
  const d = ST.getOne('dealers', dealerId);
  const vts = ST.visitsByDealer(dealerId);
  let csv = '\uFEFF"Date","Sale","Dealer Name","Offline/Online","DJI Dealer","Update","Location"\n';
  vts.forEach(v => {
    csv += `"${fD(v.date)}","${v.saleName||cfg.saleName}","${d?.name||''}","${v.mode==='offline'?'Offline':'Online'}","${v.djiDealer||''}","${esc(buildVisitUpdateText(v))}","${v.location||''}"\n`;
  });
  dlBlob(csv, `visits-${d?.name||'dealer'}-${_td()}.csv`);
}

function buildVisitUpdateText(v) {
  var cfg = getConfig();
  var d = v.dealerId ? ST.getOne('dealers', v.dealerId) : null;
  var txt = '';

  txt += '📍 Visit Report\n';
  txt += '━━━━━━━━━━━━━━━━━━━━\n\n';
  txt += 'Dealer: ' + (d ? d.name : (v.company || '-')) + '\n';
  txt += 'Date: ' + (v.date || '-') + '\n';
  if (v.time) txt += 'Time: ' + v.time + '\n';
  txt += 'Mode: ' + (v.mode === 'offline' ? 'Onsite' : 'Online') + '\n';
  txt += 'Sale: ' + (v.saleName || cfg.saleName || 'Siwawong') + '\n\n';

  if (v.topicData && v.topicData.length) {
    txt += '📋 ประเด็นที่คุย:\n';
    txt += '━━━━━━━━━━━━━━━━━━━━\n\n';
    var topicNum = 0;
    v.topicData.forEach(function(td) {
      if (!td.answered) return;
      topicNum++;
      var topic = null;
      for (var ti = 0; ti < (cfg.visitTopics || []).length; ti++) {
        if (cfg.visitTopics[ti].id === td.topicId) { topic = cfg.visitTopics[ti]; break; }
      }
      var topicName = topic ? topic.name : td.topicId;
      var topicPrompt = topic ? topic.prompt : '';
      var topicIcon = '📝';
      if (topic) {
        if (topic.group === 'sales') topicIcon = '📊';
        else if (topic.group === 'projects') topicIcon = '📁';
        else if (topic.group === 'cert') topicIcon = '📋';
        else if (topic.group === 'feedback') topicIcon = '💬';
        else if (topic.group === 'activities') topicIcon = '📅';
      }

      txt += topicNum + '. ' + topicIcon + ' ' + topicName + '\n';
      if (topicPrompt) txt += '💡 ' + topicPrompt + '\n';

      if (td.topicId === 'sales_perf') {
        if (v.revenue) txt += '📝 ยอดคำสั่งซื้อรวม: ฿' + fmtMoney(v.revenue) + '\n';
        if (v.expectedRevenue) txt += '📝 คาดว่า: ฿' + fmtMoney(v.expectedRevenue) + '\n';
      } else if (td.topicId === 'downstream') {
        if (v.customerSegment) txt += '📝 กลุ่มลูกค้า: ' + v.customerSegment + '\n';
      } else if (td.topicId === 'dsec') {
        if (td.status) txt += '📝 DSEC: ' + td.status + (td.certCount ? ' (' + td.certCount + ' ใบ)' : '') + '\n';
      } else if (td.topicId === 'crm') {
        if (td.status) txt += '📝 CRM: ' + td.status + '\n';
      } else if (td.topicId === 'fh2') {
        if (td.status) txt += '📝 FH2: ' + td.status + (td.certCount ? ' (' + td.certCount + ' ใบ)' : '') + '\n';
      } else if (td.topicId === 'lark') {
        if (td.status) txt += '📝 Lark: ' + td.status + '\n';
      }

      var topicContent = td.content || td.summary || td.value || '';
      if (topicContent) txt += '📝 ' + topicContent + '\n';
      txt += '\n';
    });
  }

  if (v.revenue || v.expectedRevenue) {
    txt += '💰 ยอดขาย:\n';
    if (v.revenue) txt += '• ยอดขายปัจจุบัน: ฿' + fmtMoney(v.revenue) + '\n';
    if (v.expectedRevenue) txt += '• เป้าที่คาด: ฿' + fmtMoney(v.expectedRevenue) + '\n';
    if (v.customerSegment) txt += '• กลุ่มลูกค้า: ' + v.customerSegment + '\n';
    txt += '\n';
  }

  if (v.pipelineUpdates && v.pipelineUpdates.length) {
    txt += '📊 Pipeline Updates:\n';
    v.pipelineUpdates.forEach(function(pu) {
      var pipe = pu.pipeId ? ST.getOne('pipeline', pu.pipeId) : null;
      txt += '• ' + (pipe ? (pipe.projectName || '') : (pu.name || '-'));
      if (pu.model) txt += ' — ' + pu.model;
      if (pu.newStatus) txt += ' — ' + getPipeName(pu.newStatus);
      if (pu.note) txt += ' — ' + pu.note;
      txt += '\n';
    });
    txt += '\n';
  }

  if (v.forecastNotes && v.forecastNotes.length) {
    var hasFc = false;
    v.forecastNotes.forEach(function(fn) { if (fn.month || fn.amount || fcHasItems(fn)) hasFc = true; });
    if (hasFc) {
      txt += '📦 Forecast:\n';
      v.forecastNotes.forEach(function(fn) {
        if (!fn.month && !fn.amount && !fcHasItems(fn)) return;
        txt += '• ' + (typeof fcMonthLabel === 'function' ? fcMonthLabel(fn.month) : (fn.month || '-'));
        if (fn.amount) txt += ' — ฿' + fmtMoney(fn.amount);
        if (fcHasItems(fn)) txt += ' — ' + fcItemsText(fn);
        txt += '\n';
      });
      txt += '\n';
    }
  }

  if (v.feedbackItems && v.feedbackItems.length) {
    var hasFb = false;
    v.feedbackItems.forEach(function(f) { if (f && f.trim()) hasFb = true; });
    if (hasFb) {
      txt += '💡 Feedback:\n';
      v.feedbackItems.forEach(function(f, idx) {
        if (!f || !f.trim()) return;
        txt += (idx + 1) + '. ' + f + '\n';
      });
      txt += '\n';
    }
  }

  if (v.summary) {
    txt += '📝 สรุป:\n';
    txt += v.summary + '\n\n';
  }

  txt += '━━━━━━━━━━━━━━━━━━━━\n';
  txt += 'Best Regards,\n';
  txt += (v.saleName || cfg.saleName || 'Siwawong') + '\n';
  txt += 'SIS Distribution (Thailand) PLC\n';
  txt += 'DJI Authorized Distributor';

  return txt.trim();
}

// ================================================================
// TAB: ONBOARD (Fixed Full Width)
// ================================================================
function dealerOnboardTab(d) {
  var cfg = getConfig();
  var ob = d.onboarding || null;
  
  if (!ob || !ob.steps || !ob.steps.length) {
    return '<div class="card" style="width:100%"><h2>🔄 Dealer Onboarding</h2>' +
      '<div class="empty"><div class="icon">🔄</div>' +
      '<p>ยังไม่ได้เริ่ม Onboarding</p>' +
      '<button class="btn bp" style="margin-top:8px" onclick="startOnboarding(\'' + d.id + '\')">🚀 เริ่ม Onboarding</button>' +
      '</div></div>';
  }
  
  var total = ob.steps.length;
  var done = 0;
  var currentIdx = -1;
  for (var i = 0; i < ob.steps.length; i++) {
    if (ob.steps[i].done) done++;
    else if (currentIdx === -1) currentIdx = i;
  }
  var pct = total ? Math.round(done / total * 100) : 0;
  var isComplete = done === total;
  
  var onboardSteps = [];
  var afterSteps = [];
  for (var i = 0; i < ob.steps.length; i++) {
    if (ob.steps[i].group === 'after') afterSteps.push({step: ob.steps[i], idx: i});
    else onboardSteps.push({step: ob.steps[i], idx: i});
  }

  var html = '<div class="card" style="width:100%"><h2>🔄 Dealer Onboarding ' +
    (isComplete ? '<span class="tag tag-completed">✅ เสร็จสมบูรณ์</span>' : '<span class="tag tag-active">🔄 กำลังดำเนินการ</span>') +
    ' <span class="ml">' +
    '<button class="btn bsm bo" onclick="resetOnboarding(\'' + d.id + '\')">🔄 Reset</button>' +
    '</span></h2>' +

    renderOnboardSummaryStrip(onboardSteps, currentIdx) +

    '<div class="ob-summary" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;width:100%">' +
    '<div class="ob-summary-card" style="width:100%"><div class="val c2">' + done + '</div><div class="lbl">เสร็จแล้ว</div></div>' +
    '<div class="ob-summary-card" style="width:100%"><div class="val c3">' + (total - done) + '</div><div class="lbl">เหลือ</div></div>' +
    '<div class="ob-summary-card" style="width:100%"><div class="val ' + (pct >= 80 ? 'c2' : pct >= 50 ? 'c3' : 'c4') + '">' + pct + '%</div><div class="lbl">Progress</div></div>' +
    '</div>' +
    
    '<div class="ob-progress" style="display:flex;gap:10px;align-items:center;width:100%;margin-bottom:16px">' +
    '<div class="pb" style="flex:1;height:10px"><div class="pf ' + (pct >= 80 ? 'pf-green' : pct >= 50 ? 'pf-yellow' : 'pf-blue') + '" style="width:' + pct + '%"></div></div>' +
    '<div class="pct">' + pct + '%</div></div>' +
    
    (ob.startDate ? '<div style="font-size:.7rem;color:var(--text3);margin-bottom:10px">เริ่ม: ' + fD(ob.startDate) + ' (' + daysBetween(ob.startDate, _td()) + ' วันที่แล้ว)</div>' : '');

  html += '<div class="ob-group-label" style="width:100%;margin-top:12px;margin-bottom:8px;padding-top:8px;border-top:1px solid var(--border)">📋 ขั้นตอน Onboarding</div>';
  for (var i = 0; i < onboardSteps.length; i++) {
    html += renderOnboardStepFullWidth(d.id, onboardSteps[i].step, onboardSteps[i].idx, currentIdx);
  }
  
  if (afterSteps.length) {
    html += '<div class="ob-group-label" style="width:100%;margin-top:12px;margin-bottom:8px;padding-top:8px;border-top:1px solid var(--border)">📋 หลัง Onboard</div>';
    for (var i = 0; i < afterSteps.length; i++) {
      html += renderOnboardStepFullWidth(d.id, afterSteps[i].step, afterSteps[i].idx, currentIdx);
    }
  }
  
  html += '</div>';
  return html;
}

// summary strip แนวนอน — ดูภาพรวมเฉยๆ กดไม่ได้ (เช็คลิสต์จริงกดติ๊ก/ใส่วันที่/โน้ตอยู่ด้านล่างเหมือนเดิม)
// ใช้แค่ steps กลุ่ม "onboard" (ไม่รวม "after") เพื่อให้ strip กระชับ ไม่ปนกับขั้นตอนหลัง Onboard
function renderOnboardSummaryStrip(onboardSteps, currentIdx) {
  if (!onboardSteps.length) return '';
  var h = '<div style="display:flex;align-items:flex-start;overflow-x:auto;padding:4px 2px 12px;margin-bottom:4px">';
  for (var i = 0; i < onboardSteps.length; i++) {
    var idx = onboardSteps[i].idx;
    var step = onboardSteps[i].step;
    var state = step.done ? 'done' : (idx === currentIdx ? 'current' : 'todo');
    var bg = state === 'done' ? '#22c55e' : state === 'current' ? 'var(--accent,#3b82f6)' : 'var(--border,#334155)';
    var fg = state === 'done' ? '#06210f' : state === 'current' ? '#fff' : 'var(--text2,#94a3b8)';
    h += '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;min-width:64px" title="' + sanitize(step.title) + '">';
    h += '<div style="width:24px;height:24px;border-radius:50%;background:' + bg + ';color:' + fg + ';font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">' + (state === 'done' ? '✓' : (i + 1)) + '</div>';
    h += '<div style="font-size:8.5px;color:' + (state === 'current' ? 'var(--text)' : 'var(--text2)') + ';font-weight:' + (state === 'current' ? '700' : '400') + ';margin-top:3px;text-align:center;white-space:nowrap;max-width:64px;overflow:hidden;text-overflow:ellipsis">' + sanitize(step.title) + '</div>';
    h += '</div>';
    if (i < onboardSteps.length - 1) h += '<div style="flex:1;min-width:14px;height:2px;background:' + (step.done ? '#22c55e' : 'var(--border,#334155)') + ';margin-top:11px"></div>';
  }
  h += '</div>';
  return h;
}

function renderOnboardStepFullWidth(dealerId, step, idx, currentIdx) {
  var isCurrent = idx === currentIdx;
  var cls = step.done ? 'done' : isCurrent ? 'current' : '';
  var boxBg = step.done ? '#22c55e' : isCurrent ? 'transparent' : 'transparent';
  var boxBorder = step.done ? '#22c55e' : isCurrent ? '#3b82f6' : 'var(--border)';

  return '<div class="onboard-step ' + cls + '" onclick="toggleOnboardStep(\'' + dealerId + '\',' + idx + ')" style="cursor:pointer;display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;width:100%;box-sizing:border-box">' +
    '<div class="ob-num" style="width:28px;height:28px;border-radius:8px;background:' + boxBg + ';border:2px solid ' + boxBorder + ';color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;font-weight:700">' +
    (step.done ? '✓' : '') + '</div>' +
    '<div class="ob-content" style="flex:1;min-width:0">' +
    '<div class="ob-title" style="font-size:.8rem;font-weight:500;margin-bottom:2px">' + sanitize(step.title) + '</div>' +
    '<div class="ob-meta" style="font-size:.66rem;color:var(--text3)">' +
    (step.done && step.date ? '✅ เสร็จแล้ว — ' + fD(step.date) : '') +
    (!step.done && isCurrent ? '🔄 ขั้นตอนปัจจุบัน — กดเพื่อทำเสร็จ' : '') +
    (!step.done && !isCurrent ? 'ยังไม่ได้ทำ — กดเพื่อทำเสร็จ' : '') +
    '</div>' +
    '<input type="text" class="ob-note-inline" value="' + sanitize(step.note || '') + '" placeholder="+ พิมพ์โน้ตตรงนี้ได้เลย" style="font-size:.7rem;color:var(--text2);margin-top:4px;width:100%;background:transparent;border:none;border-bottom:1px dashed var(--border);padding:2px 0" ' +
    'onclick="event.stopPropagation()" onblur="saveOnboardStepNoteInline(\'' + dealerId + '\',' + idx + ',this.value)" onkeydown="if(event.key===\'Enter\'){this.blur();}">' +
    '</div>' +
    '<button class="btn bsm bo" onclick="event.stopPropagation();editOnboardStep(\'' + dealerId + '\',' + idx + ')" style="flex-shrink:0" title="แก้ไขวันที่เสร็จ (เปลี่ยนสถานะ/วันที่)">📅</button>' +
    '</div>';
}

// แก้โน้ตอย่างเดียวแบบ inline — เซฟทันทีตอนคลิกออกจากช่อง ไม่ต้องเปิด modal (ของเดิมต้องเปิด-แก้-เซฟ-ปิด 4 จังหวะ)
// ส่วนวันที่เสร็จ/สถานะ done ยังแก้ผ่านปุ่ม 📅 (editOnboardStep) เหมือนเดิม เพราะมีผลข้างเคียงต่อ level/สถานะอื่นของ Dealer
function saveOnboardStepNoteInline(dealerId, stepIdx, noteValue) {
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.onboarding || !d.onboarding.steps || !d.onboarding.steps[stepIdx]) return;
  var trimmed = (noteValue || '').trim();
  if ((d.onboarding.steps[stepIdx].note || '') === trimmed) return; // ไม่มีอะไรเปลี่ยน ไม่ต้องเซฟ
  d.onboarding.steps[stepIdx].note = trimmed;
  ST.update('dealers', dealerId, d);
  if (typeof syncDealerToFirebase === 'function') syncDealerToFirebase(dealerId);
  toast('💾 บันทึกโน้ตแล้ว');
}

// ================================================================
// ONBOARDING ACTIONS
// ================================================================
function startOnboarding(dealerId) {
  var cfg = getConfig();
  var templateSteps = cfg.onboardingSteps || [];
  var steps = [];
  for (var i = 0; i < templateSteps.length; i++) {
    steps.push({
      id: templateSteps[i].id,
      title: templateSteps[i].title,
      group: templateSteps[i].group || 'onboard',
      done: false,
      date: '',
      note: ''
    });
  }
  
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  
  ST.update('dealers', dealerId, {
    onboarding: {
      active: true,
      startDate: _td(),
      steps: steps
    }
  });
  
  toast('🚀 เริ่ม Onboarding!');
  render();
}

function toggleOnboardStep(dealerId, stepIdx) {
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.onboarding || !d.onboarding.steps || !d.onboarding.steps[stepIdx]) return;
  
  var step = d.onboarding.steps[stepIdx];
  step.done = !step.done;
  step.date = step.done ? _td() : '';
  
  if (step.done) {
    var updates = {};
    if (step.id === 'dsec') updates.dsecStatus = 'pass';
    if (step.id === 'crm') updates.crmStatus = 'yes';
    if (step.id === 'fh2') updates.fh2Status = 'pass';
    if (step.id === 'lark') updates.larkStatus = 'added';
    if (step.id === 'authorized') {
      updates.level = d.level === 'Other' ? 'B' : d.level;
      updates.appointmentLetter = 'ออกแล้ว';
      updates.appointmentDate = _td();
    }
    if (Object.keys(updates).length) {
      for (var k in updates) d[k] = updates[k];
    }
  }
  
  // ✅ บันทึกทั้ง object (รวม level/status ที่เปลี่ยนจาก updates) ไม่ใช่แค่ onboarding
  ST.update('dealers', dealerId, d);
  // ✅ sync ไป dealerUpdates เพื่อให้ client-view เห็น tier/สถานะใหม่ทันที
  if (typeof syncDealerToFirebase === 'function') syncDealerToFirebase(dealerId);
  toast(step.done ? '✅ ' + step.title : '↩️ ยกเลิก ' + step.title);
  render();
}

function editOnboardStep(dealerId, stepIdx) {
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.onboarding || !d.onboarding.steps || !d.onboarding.steps[stepIdx]) return;
  var step = d.onboarding.steps[stepIdx];
  
  openM('📝 ' + step.title, '' +
    '<div class="fg"><label>สถานะ</label><div class="radio-g">' +
    '<label><input type="radio" name="obs_done" value="0"' + (!step.done ? ' checked' : '') + '><span>☐ ยังไม่เสร็จ</span></label>' +
    '<label><input type="radio" name="obs_done" value="1"' + (step.done ? ' checked' : '') + '><span>✅ เสร็จแล้ว</span></label>' +
    '</div></div>' +
    dpH('obs_date', step.date || _td(), 'วันที่เสร็จ') +
    '<div class="fg"><label>หมายเหตุ</label><textarea id="obs_note" rows="3">' + sanitize(step.note || '') + '</textarea></div>' +
    '<button class="btn bp btn-full" onclick="saveOnboardStep(\'' + dealerId + '\',' + stepIdx + ')">💾 บันทึก</button>');
}

function saveOnboardStep(dealerId, stepIdx) {
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.onboarding || !d.onboarding.steps || !d.onboarding.steps[stepIdx]) return;
  
  var doneEl = document.querySelector('input[name="obs_done"]:checked');
  var noteEl = document.getElementById('obs_note');
  
  d.onboarding.steps[stepIdx].done = doneEl ? doneEl.value === '1' : false;
  d.onboarding.steps[stepIdx].date = dpG('obs_date') || '';
  d.onboarding.steps[stepIdx].note = noteEl ? noteEl.value.trim() : '';
  
  if (d.onboarding.steps[stepIdx].done) {
    var sid = d.onboarding.steps[stepIdx].id;
    if (sid === 'dsec') d.dsecStatus = 'pass';
    if (sid === 'crm') d.crmStatus = 'yes';
    if (sid === 'fh2') d.fh2Status = 'pass';
    if (sid === 'lark') d.larkStatus = 'added';
    if (sid === 'authorized') {
      if (d.level === 'Other') d.level = 'B';
      d.appointmentLetter = 'ออกแล้ว';
      d.appointmentDate = d.onboarding.steps[stepIdx].date || _td();
    }
  }
  
  ST.update('dealers', dealerId, d);
  // ✅ sync ไป dealerUpdates เพื่อให้ client-view เห็น tier/สถานะใหม่ทันที
  if (typeof syncDealerToFirebase === 'function') syncDealerToFirebase(dealerId);
  closeMForce();
  toast('💾 บันทึกแล้ว');
  render();
}

function resetOnboarding(dealerId) {
  if (!confirm('⚠️ Reset Onboarding? ข้อมูลขั้นตอนจะถูกลบ')) return;
  ST.update('dealers', dealerId, {onboarding: null});
  toast('🔄 Reset แล้ว');
  render();
}
// ================================================================
// RENDER DEALER CONTACTS
// ================================================================
function renderDealerContacts(d) {
  var contacts = d.contacts || [];
  
  var h = '<div class="card"><h2>📞 ผู้ติดต่อ (' + contacts.length + ')';
  h += '<span class="ml"><button class="btn bsm bp" onclick="showAddContactM(\'' + d.id + '\')">➕</button></span></h2>';
  
  if (!contacts.length) {
    h += '<div class="empty"><p>ยังไม่มีผู้ติดต่อ — กด ➕ เพื่อเพิ่ม</p></div>';
    h += '</div>';
    return h;
  }
  
  for (var i = 0; i < contacts.length; i++) {
    var c = contacts[i];
    h += '<div class="contact-card' + (c.primary ? ' contact-primary' : '') + '">';
    h += '<div class="contact-header">';
    h += '<div class="contact-name">' + (c.primary ? '⭐ ' : '') + sanitize(c.name) + '</div>';
    if (c.role) h += '<div class="contact-role">' + sanitize(c.role) + '</div>';
    h += '<button class="btn-xs" onclick="showEditContactM(\'' + d.id + '\',' + i + ')">✏️</button>';
    h += '</div>';
    
    h += '<div class="contact-actions">';
    if (c.phone) h += '<a href="tel:' + c.phone + '" class="contact-btn" onclick="event.stopPropagation()">📞 ' + sanitize(c.phone) + '</a>';
    if (c.line) h += '<span class="contact-btn">💬 ' + sanitize(c.line) + '</span>';
    if (c.email) h += '<a href="mailto:' + c.email + '" class="contact-btn" onclick="event.stopPropagation()">📧 ' + sanitize(c.email) + '</a>';
    h += '</div>';
    
    if (c.note) h += '<div class="contact-note">' + sanitize(c.note) + '</div>';
    h += '</div>';
  }
  
  h += '</div>';
  return h;
}

function showAddContactM(dealerId) {
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>👤 ชื่อ *</label><input type="text" id="ct_name" class="fm-input" placeholder="เช่น คุณสมชาย"></div>';
  h += '<div class="fm-group"><label>💼 ตำแหน่ง/บทบาท</label><input type="text" id="ct_role" class="fm-input" placeholder="เช่น MD, Purchase, Technical"></div>';
  h += '<div class="fr">';
  h += '<div class="fm-group"><label>📞 เบอร์โทร</label><input type="tel" id="ct_phone" class="fm-input" placeholder="081-xxx-xxxx"></div>';
  h += '<div class="fm-group"><label>💬 LINE ID</label><input type="text" id="ct_line" class="fm-input" placeholder="LINE ID"></div>';
  h += '</div>';
  h += '<div class="fm-group"><label>📧 Email</label><input type="email" id="ct_email" class="fm-input" placeholder="email@company.com"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="ct_note" rows="2" class="fm-input" placeholder="เช่น ติดต่อเรื่อง Technical ได้ดี"></textarea></div>';
  h += '<div class="fm-group"><label>⭐ ผู้ติดต่อหลัก</label><div class="radio-g"><label><input type="radio" name="ct_primary" value="1"><span>ใช่</span></label><label><input type="radio" name="ct_primary" value="0" checked><span>ไม่</span></label></div></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="saveContact(\'' + dealerId + '\')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  
  openM('➕ เพิ่มผู้ติดต่อ', h);
}

function saveContact(dealerId) {
  var name = (document.getElementById('ct_name').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }
  
  var contact = {
    id: 'ct_' + Date.now(),
    name: name,
    role: (document.getElementById('ct_role').value || '').trim(),
    phone: (document.getElementById('ct_phone').value || '').trim(),
    line: (document.getElementById('ct_line').value || '').trim(),
    email: (document.getElementById('ct_email').value || '').trim(),
    note: (document.getElementById('ct_note').value || '').trim(),
    primary: document.querySelector('input[name="ct_primary"]:checked') ? document.querySelector('input[name="ct_primary"]:checked').value === '1' : false
  };
  
  var d = ST.getOne('dealers', dealerId);
  if (!d) return;
  if (!d.contacts) d.contacts = [];
  d.contacts.push(contact);
  ST.update('dealers', dealerId, {contacts: d.contacts});
  toast('✅ เพิ่มผู้ติดต่อ: ' + name);
  closeMForce();
  render();
}

function showEditContactM(dealerId, ctIdx) {
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.contacts || !d.contacts[ctIdx]) return;
  var c = d.contacts[ctIdx];
  
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>👤 ชื่อ *</label><input type="text" id="ct_name" class="fm-input" value="' + sanitize(c.name || '') + '"></div>';
  h += '<div class="fm-group"><label>💼 ตำแหน่ง/บทบาท</label><input type="text" id="ct_role" class="fm-input" value="' + sanitize(c.role || '') + '"></div>';
  h += '<div class="fr">';
  h += '<div class="fm-group"><label>📞 เบอร์โทร</label><input type="tel" id="ct_phone" class="fm-input" value="' + sanitize(c.phone || '') + '"></div>';
  h += '<div class="fm-group"><label>💬 LINE ID</label><input type="text" id="ct_line" class="fm-input" value="' + sanitize(c.line || '') + '"></div>';
  h += '</div>';
  h += '<div class="fm-group"><label>📧 Email</label><input type="email" id="ct_email" class="fm-input" value="' + sanitize(c.email || '') + '"></div>';
  h += '<div class="fm-group"><label>📝 หมายเหตุ</label><textarea id="ct_note" rows="2" class="fm-input">' + sanitize(c.note || '') + '</textarea></div>';
  h += '<div class="fm-group"><label>⭐ ผู้ติดต่อหลัก</label><div class="radio-g"><label><input type="radio" name="ct_primary" value="1"' + (c.primary ? ' checked' : '') + '><span>ใช่</span></label><label><input type="radio" name="ct_primary" value="0"' + (!c.primary ? ' checked' : '') + '><span>ไม่</span></label></div></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="updateContact(\'' + dealerId + '\',' + ctIdx + ')">💾 บันทึก</button>';
  h += '<button class="btn bd" onclick="deleteContact(\'' + dealerId + '\',' + ctIdx + ')">🗑️ ลบ</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  
  openM('✏️ แก้ไขผู้ติดต่อ', h);
}

function updateContact(dealerId, ctIdx) {
  var name = (document.getElementById('ct_name').value || '').trim();
  if (!name) { toast('กรุณาใส่ชื่อ'); return; }
  
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.contacts || !d.contacts[ctIdx]) return;
  
  d.contacts[ctIdx].name = name;
  d.contacts[ctIdx].role = (document.getElementById('ct_role').value || '').trim();
  d.contacts[ctIdx].phone = (document.getElementById('ct_phone').value || '').trim();
  d.contacts[ctIdx].line = (document.getElementById('ct_line').value || '').trim();
  d.contacts[ctIdx].email = (document.getElementById('ct_email').value || '').trim();
  d.contacts[ctIdx].note = (document.getElementById('ct_note').value || '').trim();
  d.contacts[ctIdx].primary = document.querySelector('input[name="ct_primary"]:checked') ? document.querySelector('input[name="ct_primary"]:checked').value === '1' : false;
  
  ST.update('dealers', dealerId, {contacts: d.contacts});
  toast('💾 บันทึกแล้ว');
  closeMForce();
  render();
}

function deleteContact(dealerId, ctIdx) {
  if (!confirm('ลบผู้ติดต่อนี้?')) return;
  var d = ST.getOne('dealers', dealerId);
  if (!d || !d.contacts) return;
  d.contacts.splice(ctIdx, 1);
  ST.update('dealers', dealerId, {contacts: d.contacts});
  toast('🗑️ ลบแล้ว');
  closeMForce();
  render();
}
// ================================================================
// TAB: TASKS (งานของ Dealer)
// ================================================================
function dealerTasksTab(d) {
  var tasks = getTasksByDealer(d.id);
  var active = tasks.filter(function(t) { return t.status === 'active'; });
  var completed = tasks.filter(function(t) { return t.status === 'completed'; });

  var h = '<div class="card"><h2>📋 งาน (' + active.length + ' active / ' + tasks.length + ' total)';
  h += '<span class="ml">';
  h += '<button class="btn bsm bp" onclick="showTaskM(\'\',\'' + d.id + '\')">➕</button>';
  h += '</span></h2>';

  if (!tasks.length) {
    h += '<div class="empty"><p>ยังไม่มีงาน — กด ➕ เพื่อเพิ่ม</p></div>';
    h += '</div>';
    return h;
  }

  if (active.length) {
    for (var i = 0; i < active.length; i++) {
      var t = active[i];
      var pipe = t.pipeId ? ST.getOne('pipeline', t.pipeId) : null;
      var pg = prog(t);
      h += '<div class="li ' + dlC(t.dueDate, false) + '" onclick="go(\'taskDetail\',{taskId:\'' + t.id + '\'})">';
      h += '<div class="lm">';
      h += '<div class="lt">' + sanitize(t.title) + ' ' + sTag(t.status) + ' ' + pTag(t.priority);
      if (t.sequential) h += ' <span class="tag tag-count">⚡</span>';
      h += '</div>';
      h += '<div class="ls">';
      if (t.category) h += '📂 ' + t.category + ' • ';
      if (pipe) h += '📊 ' + sanitize(pipe.projectName || '') + ' • ';
      h += fD(t.dueDate) + ' ' + dlB(t.dueDate, false);
      h += '</div>';
      if (t.steps && t.steps.length) {
        h += '<div class="pb"><div class="pf pf-blue" style="width:' + pg + '%"></div></div>';
        h += '<div class="ls">' + pg + '%</div>';
      }
      h += '</div></div>';
    }
  }

  if (completed.length) {
    h += '<div class="pa-done-toggle" onclick="toggleDealerDoneTasks()">✅ เสร็จแล้ว (' + completed.length + ') <span id="ddtArrow">▶</span></div>';
    h += '<div id="ddtList" style="display:none">';
    for (var i = 0; i < completed.length; i++) {
      var t = completed[i];
      h += '<div class="li dlo" onclick="go(\'taskDetail\',{taskId:\'' + t.id + '\'})">';
      h += '<div class="lm"><div class="lt" style="text-decoration:line-through;opacity:0.6">' + sanitize(t.title) + '</div>';
      h += '<div class="ls">' + fD(t.dueDate) + '</div></div></div>';
    }
    h += '</div>';
  }

  h += '</div>';
  return h;
}

function getTasksByDealer(dealerId) {
  return ST.filter('tasks', function(t) {
    return t.dealerId === dealerId;
  });
}

function toggleDealerDoneTasks() {
  var el = document.getElementById('ddtList');
  var arrow = document.getElementById('ddtArrow');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (arrow) arrow.textContent = '▼';
  } else {
    el.style.display = 'none';
    if (arrow) arrow.textContent = '▶';
  }
}

function openClientView(dealerId) {
  var pins = JSON.parse(localStorage.getItem('v7_dealer_pins') || '{}');
  var dealerPin = pins[dealerId];
  
  var uid = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.uid : '';
  var baseUrl = window.location.href.split('?')[0].split('#')[0];
  var basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  var url = basePath + 'client-view.html?dealerId=' + dealerId + '&uid=' + uid;
  
  if (dealerPin) {
    var enteredPin = prompt('🔒 กรุณากรอกรหัสผ่านเพื่อดูข้อมูล:\n(รหัสผ่านตั้งโดยพนักงานขาย)');
    if (enteredPin !== dealerPin) {
      toast('❌ รหัสผ่านไม่ถูกต้อง');
      return;
    }
  }
  
  var win = window.open(url, '_blank');
  if (!win) { toast('กรุณาอนุญาต Popup'); return; }
}

function checkDealerPin() {
  return new Promise(function(resolve) {
    var pins = JSON.parse(localStorage.getItem('v7_dealer_pins') || '{}');
    var savedPin = pins[dealerId];
    
    if (!savedPin) {
      resolve(true);
      return;
    }
    
    var enteredPin = prompt('🔒 กรุณากรอกรหัสผ่านเพื่อดูข้อมูลโครงการ');
    if (enteredPin === savedPin) {
      resolve(true);
    } else {
      alert('❌ รหัสผ่านไม่ถูกต้อง');
      resolve(false);
    }
  });
}

function loadAllData() {
  if (!dealerId) return;
  
  checkDealerPin().then(function(access) {
    if (!access) {
      document.getElementById('tabContent').innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔒</div><div>รหัสผ่านไม่ถูกต้อง</div><div class="hint">กรุณาติดต่อพนักงานขายเพื่อรับรหัสผ่าน</div></div>';
      return;
    }
    
    showNotice('🔄 กำลังโหลดข้อมูล...', false);
    Promise.all([loadDealerName(), loadPipeline(), loadForecast(), loadTimeline()]).then(function() {
      renderCurrentTab();
      showNotice('✅ โหลดข้อมูลเรียบร้อยแล้ว', true);
    }).catch(function(err) { 
      console.error('Load error:', err); 
      document.getElementById('tabContent').innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>เกิดข้อผิดพลาดในการโหลดข้อมูล</div></div>';
    });
  });
}

function buildFinalClientView(dealerId) {
  var d = ST.getOne('dealers', dealerId);
  if (!d) return '<h1>Not Found</h1>';
  
  var allPipes = ST.pipelineByDealer(dealerId);
  var activePipes = allPipes.filter(function(p) { 
    return ['fail_lost'].indexOf(p.status) === -1;
  });
  var cfg = getConfig();
  
  var pipesData = [];
  for (var i = 0; i < activePipes.length; i++) {
    var p = activePipes[i];
    pipesData.push({
      id: p.id,
      projectName: (p.projectName || '-'),
      endUserTH: (p.endUserTH || '-'),
      endUserEN: (p.endUserEN || '-'),
      unitType: (p.unitType || '-'),
      status: p.status,
      biddingDate: (p.biddingDate || '-'),
      shipmentDate: (p.shipmentDate || '-'),
      tor: (p.tor || '-'),
      nextAction: (p.nextAction || '-'),
      forecastAmount: p.forecastAmount || 0,
      items: getPipeItems(p),
      actions: getPipeActions().filter(function(a) { return a.pipeId === p.id && a.status === "pending"; }),
      logs: (function(pid) {
        var logs = ST.pipeLogsByPipe(pid);
        var filtered = [];
        var safeTypes = ["update","progress","status_change","win","action"];
        for (var j = 0; j < logs.length; j++) {
          var l = logs[j];
          if (safeTypes.indexOf(l.type) === -1) continue;
          var c = (l.content || "").toLowerCase();
          if (c.indexOf("forecast") !== -1 || c.indexOf("ราคา") !== -1 || c.indexOf("price") !== -1 || c.indexOf("lost") !== -1 || c.indexOf("หมายเหตุ") !== -1) continue;
          filtered.push(l);
        }
        return filtered.slice(0, 10);
      })(p.id)
    });
  }
  
  var pipesDataJson = JSON.stringify(pipesData);
  
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
  html += '<title>Pipeline — ' + d.name + '</title>';
  html += '<style>';
  html += '*{margin:0;padding:0;box-sizing:border-box}';
  html += 'body{font-family:"Segoe UI",sans-serif;background:#0a0e27;color:#e0e6f0}';
  html += '.container{max-width:1000px;margin:0 auto;padding:20px}';
  html += '.header{text-align:center;padding:24px 0;border-bottom:2px solid rgba(100,181,246,0.2)}';
  html += '.logo{font-size:14px;color:#64b5f6}';
  html += '.name{font-size:28px;font-weight:800;background:linear-gradient(90deg,#64b5f6,#42a5f5);-webkit-background-clip:text;-webkit-text-fill-color:transparent}';
  html += '.sub{font-size:14px;color:#8892b0}';
  html += '.section{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px;margin-bottom:16px}';
  html += '.section-title{font-size:16px;font-weight:700;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08)}';
  html += 'table{width:100%;border-collapse:collapse}';
  html += 'th{text-align:left;padding:10px 12px;font-size:11px;color:#8892b0;border-bottom:2px solid rgba(255,255,255,0.08)}';
  html += 'td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px}';
  html += '.status{padding:3px 10px;border-radius:12px;font-size:11px;display:inline-block}';
  html += '.status-initial{background:rgba(234,179,8,0.12);color:#eab308}';
  html += '.status-on-process{background:rgba(249,115,22,0.12);color:#f97316}';
  html += '.status-draft-tor{background:rgba(249,168,212,0.12);color:#f9a8d4}';
  html += '.status-bidding{background:rgba(148,163,184,0.12);color:#94a3b8}';
  html += '.status-win{background:rgba(34,197,94,0.12);color:#22c55e}';
  html += '.status-fail-lost{background:rgba(239,68,68,0.12);color:#ef4444}';
  html += '.status-contracting{background:rgba(15,118,110,0.12);color:#0f766e}';
  html += '.status-deliver{background:rgba(99,102,241,0.12);color:#6366f1}';
  html += '.footer{text-align:center;padding:20px 0;font-size:11px;color:#8892b0}';
  html += '.btn{padding:6px 12px;border-radius:6px;border:1px solid #3b82f6;background:transparent;color:#3b82f6;cursor:pointer;font-size:11px}';
  html += '.btn:hover{background:rgba(59,130,246,0.2)}';
  html += '.btn-primary{padding:6px 12px;border-radius:6px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-size:11px}';
  html += '.detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}';
  html += '.detail-item{background:rgba(255,255,255,0.02);padding:10px;border-radius:8px}';
  html += '.detail-label{font-size:10px;color:#8892b0}';
  html += '.detail-val{font-size:13px;font-weight:600}';
  html += '.back{cursor:pointer;color:#64b5f6;margin-bottom:16px;display:inline-block}';
  html += '.back:hover{text-decoration:underline}';
  html += '.val-mega{color:#ef4444;font-weight:800}';
  html += '.val-big{color:#f97316;font-weight:700}';
  html += '.val-normal{color:#22c55e;font-weight:600}';
  html += '.cv-action{padding:8px 12px;margin-bottom:6px;border-left:3px solid #64b5f6;background:rgba(255,255,255,0.02);border-radius:6px}';
  html += '.cv-log{display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px}';
  html += '.cv-log-date{color:#8892b0;font-size:11px;min-width:70px}';
  html += '.update-area{display:flex;gap:6px;margin-top:12px}';
  html += '.update-input{flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#e0e6f0;font-size:13px}';
  html += '@media(max-width:768px){.container{padding:12px}.name{font-size:22px}.detail-grid{grid-template-columns:repeat(2,1fr)}}';
  html += '</style>';
  html += '</head><body>';
  html += '<div class="container" id="app">';
  
  html += '<div class="header">';
  html += '<div class="logo">🚁 DJI Enterprise</div>';
  html += '<div class="name">' + sanitize(d.name) + '</div>';
  html += '<div class="sub">DJI Authorized Dealer</div>';
  html += '</div>';
  
  html += '<div class="section" id="overviewSection">';
  html += '<div class="section-title">📊 โครงการของท่าน (' + activePipes.length + ' โครงการ)</div>';
  html += '<table id="projectTable">';
  html += '<thead>';
  html += '<tr><th>#</th><th>โครงการ</th><th>End User</th><th>สถานะ</th><th>มูลค่า</th><th>Bidding</th><th>Shipment</th><th></th></tr>';
  html += '</thead>';
  html += '<tbody id="tableBody">';
  
  for (var i = 0; i < activePipes.length; i++) {
    var p = activePipes[i];
    var statusClass = '';
    if (p.status === 'initial') statusClass = 'status-initial';
    else if (p.status === 'on_process') statusClass = 'status-on-process';
    else if (p.status === 'draft_tor') statusClass = 'status-draft-tor';
    else if (p.status === 'bidding') statusClass = 'status-bidding';
    else if (p.status === 'win') statusClass = 'status-win';
    else if (p.status === 'fail_lost') statusClass = 'status-fail-lost';
    else if (p.status === 'contracting') statusClass = 'status-contracting';
    else if (p.status === 'deliver') statusClass = 'status-deliver';
    else statusClass = 'status-initial';

    var statusText = '';
    if (p.status === 'initial') statusText = '🟡 01 Initial';
    else if (p.status === 'on_process') statusText = '🟠 02 On process';
    else if (p.status === 'draft_tor') statusText = '🩷 03 Draft TOR';
    else if (p.status === 'bidding') statusText = '🔘 04 Bidding';
    else if (p.status === 'win') statusText = '🟢 05 Win';
    else if (p.status === 'fail_lost') statusText = '🔴 05 Fail & Lost';
    else if (p.status === 'contracting') statusText = '🩵 06 Contracting';
    else if (p.status === 'deliver') statusText = '🔵 07 Deliver';
    else statusText = p.status;
    
    var amt = Number(p.forecastAmount) || 0;
    var valueClass = '';
    if (amt >= 10000000) valueClass = 'val-mega';
    else if (amt >= 1500000) valueClass = 'val-big';
    else valueClass = 'val-normal';
    
    html += '<tr>';
    html += '<td style="width:40px">' + (i + 1) + '</td>';
    html += '<td><strong>' + sanitize(p.projectName || '-') + '</strong></td>';
    html += '<td>' + sanitize(p.endUserTH || p.endUserEN || '-') + '</td>';
    html += '<td><span class="status ' + statusClass + '">' + statusText + '</span></td>';
    html += '<td><span class="' + valueClass + '">' + fmtMoneyFull(amt) + '</span> ฿</td>';
    html += '<td>' + (p.biddingDate || '-') + '</td>';
    html += '<td>' + (p.shipmentDate || '-') + '</td>';
    html += '<td><button class="btn" data-pipeid="' + p.id + '" onclick="showDetail(this)">ดูรายละเอียด</button></td>';
    html += '</tr>';
  }
  
  html += '</tbody>';
  html += '</table>';
  html += '</div>';
  
  html += '<div id="detailSection" style="display:none"></div>';
  
  html += '<div class="footer">';
  html += 'Powered by SIS Distribution (Thailand) PLC — DJI Authorized Distributor<br>';
  html += (cfg.saleName || 'Siwawong') + ' | ' + _td();
  html += '</div>';
  
  html += '</div>';
  
  html += '<script>';
  html += 'var pipesData = ' + pipesDataJson + ';';
  html += 'var dealerId = "' + dealerId + '";';
  
  html += 'function esc(s){if(!s)return"";return String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;");}';
  html += 'function fmtMoneyFull(n){if(!n)return"0";n=Number(n);return n.toLocaleString("th-TH");}';
  html += 'function fmtMoneyShort(n){if(!n)return"-";n=Number(n);if(n>=1000000)return(n/1000000).toFixed(1)+"M";if(n>=1000)return Math.round(n/1000)+"K";return n.toLocaleString();}';
  
  html += 'function getStatusText(status){';
  html += '  var m={initial:"🟡 01 Initial",on_process:"🟠 02 On process",draft_tor:"🩷 03 Draft TOR",bidding:"🔘 04 Bidding",win:"🟢 05 Win",fail_lost:"🔴 05 Fail & Lost",contracting:"🩵 06 Contracting",deliver:"🔵 07 Deliver"};';
  html += '  return m[status] || status;';
  html += '}';
  html += 'function getStatusClass(status){';
  html += '  var m={initial:"status-initial",on_process:"status-on-process",draft_tor:"status-draft-tor",bidding:"status-bidding",win:"status-win",fail_lost:"status-fail-lost",contracting:"status-contracting",deliver:"status-deliver"};';
  html += '  return m[status] || "status-initial";';
  html += '}';
  html += 'function getValueClass(amt){';
  html += '  amt = Number(amt) || 0;';
  html += '  if(amt >= 10000000) return "val-mega";';
  html += '  if(amt >= 1500000) return "val-big";';
  html += '  return "val-normal";';
  html += '}';
  
  html += 'function showOverview(){';
  html += '  document.getElementById("overviewSection").style.display = "block";';
  html += '  document.getElementById("detailSection").style.display = "none";';
  html += '  document.getElementById("detailSection").innerHTML = "";';
  html += '}';
  
  html += 'function buildDetailHTML(p){';
  html += '  var statusText = getStatusText(p.status);';
  html += '  var statusClass = getStatusClass(p.status);';
  html += '  var valueClass = getValueClass(p.forecastAmount);';
  html += '  var h = "<div class=\"back\" onclick=\"showOverview()\">← กลับไปหน้าแรก</div>";';
  html += '  h += "<div class=\"section\"><div class=\"section-title\">📊 "+esc(p.projectName)+"</div>";';
  html += '  h += "<div class=\"detail-grid\">";';
  html += '  h += "<div class=\"detail-item\"><div class=\"detail-label\">สถานะ</div><div class=\"detail-val\"><span class=\"status "+statusClass+"\">"+statusText+"</span></div></div>";';
  html += '  h += "<div class=\"detail-item\"><div class=\"detail-label\">End User</div><div class=\"detail-val\">"+esc(p.endUserTH)+"</div></div>";';
  html += '  h += "<div class=\"detail-item\"><div class=\"detail-label\">Unit Type</div><div class=\"detail-val\">"+esc(p.unitType)+"</div></div>";';
  html += '  h += "<div class=\"detail-item\"><div class=\"detail-label\">มูลค่า</div><div class=\"detail-val "+valueClass+"\">"+fmtMoneyFull(p.forecastAmount)+" ฿</div></div>";';
  html += '  h += "<div class=\"detail-item\"><div class=\"detail-label\">Bidding Date</div><div class=\"detail-val\">"+p.biddingDate+"</div></div>";';
  html += '  h += "<div class=\"detail-item\"><div class=\"detail-label\">Shipment Date</div><div class=\"detail-val\">"+p.shipmentDate+"</div></div>";';
  html += '  h += "<div class=\"detail-item\"><div class=\"detail-label\">TOR</div><div class=\"detail-val\">"+esc(p.tor)+"</div></div>";';
  html += '  h += "<div class=\"detail-item\"><div class=\"detail-label\">Next Action</div><div class=\"detail-val\">"+esc(p.nextAction)+"</div></div>";';
  html += '  h += "</div></div>";';
  
  html += '  if(p.items && p.items.length){';
  html += '    h += "<div class=\"section\"><div class=\"section-title\">📦 รายการสินค้า ("+p.items.length+")</div>";';
  html += '    h += "<table style=\"width:100%\"><thead><tr><th>#</th><th>Model</th><th>จำนวน</th><th>ราคาต่อหน่วย</th><th>รวม</th><tr></thead><tbody>";';
  html += '    for(var i=0;i<p.items.length;i++){';
  html += '      var it = p.items[i];';
  html += '      var total = (Number(it.qty)||1) * (Number(it.price)||0);';
  html += '      h += "<tr><td class=\"cv-num\">"+(i+1)+"</td><td>"+esc(it.model||"-")+"</td><td>"+(it.qty||1)+"</td><td>"+fmtMoneyFull(it.price)+"</td><td>"+fmtMoneyFull(total)+"</td></tr>";';
  html += '    }';
  html += '    h += "</tbody></table></div>";';
  html += '  }';
  
  html += '  if(p.actions && p.actions.length){';
  html += '    h += "<div class=\"section\"><div class=\"section-title\">🎯 รายการที่ต้องดำเนินการ ("+p.actions.length+")</div>";';
  html += '    for(var i=0;i<p.actions.length;i++){';
  html += '      var a = p.actions[i];';
  html += '      h += "<div class=\"cv-action\"><div class=\"cv-action-text\">⏳ "+esc(a.text)+"</div>";';
  html += '      if(a.dueDate) h += "<div class=\"cv-action-meta\">📅 กำหนด: "+a.dueDate+"</div>";';
  html += '      h += "</div>";';
  html += '    }';
  html += '    h += "</div>";';
  html += '  }';
  
  html += '  if(p.logs && p.logs.length){';
  html += '    h += "<div class=\"section\"><div class=\"section-title\">📝 ความคืบหน้าล่าสุด</div>";';
  html += '    for(var i=0;i<p.logs.length;i++){';
  html += '      var l = p.logs[i];';
  html += '      var icon = l.type==="progress"?"🟢":l.type==="win"?"✅":l.type==="status_change"?"🔄":"📝";';
  html += '      var dateStr = l.date ? l.date.split("T")[0] : "-";';
  html += '      h += "<div class=\"cv-log\"><span class=\"cv-log-date\">"+dateStr+"</span><span class=\"cv-log-icon\">"+icon+"</span><span class=\"cv-log-text\">"+esc((l.content||"").substr(0,80))+"</span></div>";';
  html += '    }';
  html += '    h += "</div>";';
  html += '  }';
  
  html += '  h += "<div class=\"section\"><div class=\"section-title\">✏️ สอบถามเพิ่มเติม / อัพเดทความคืบหน้า</div>";';
  html += '  h += "<div class=\"update-area\"><input type=\"text\" id=\"updateInput\" class=\"update-input\" placeholder=\"พิมพ์ข้อความอัพเดท...\"><button class=\"btn-primary\" onclick=\"sendUpdate(\'"+p.id+"\')\">💾 ส่งอัพเดท</button></div>";';
  html += '  h += "<div style=\"font-size:11px;color:#8892b0;margin-top:8px\">💡 อัพเดทจะถูกบันทึกทันที พนักงานขายจะได้รับแจ้ง</div>";';
  html += '  h += "</div>";';
  html += '  return h;';
  html += '}';
  
  html += 'function showDetail(btn){';
  html += '  var pipeId = btn.getAttribute("data-pipeid");';
  html += '  var p = null;';
  html += '  for(var i=0;i<pipesData.length;i++){ if(pipesData[i].id === pipeId){ p = pipesData[i]; break; } }';
  html += '  if(!p){ alert("ไม่พบข้อมูล"); return; }';
  html += '  var detailHtml = buildDetailHTML(p);';
  html += '  document.getElementById("overviewSection").style.display = "none";';
  html += '  document.getElementById("detailSection").style.display = "block";';
  html += '  document.getElementById("detailSection").innerHTML = detailHtml;';
  html += '}';
  
  html += 'function sendUpdate(pipeId){';
  html += '  var text = document.getElementById("updateInput").value.trim();';
  html += '  if(!text){ alert("กรุณาพิมพ์ข้อความ"); return; }';
  html += '  if(window.opener){';
  html += '    window.opener.postMessage({type:"CV_UPDATE",pipeId:pipeId,dealerId:dealerId,text:text},"*");';
  html += '    alert("✅ ส่งข้อความเรียบร้อยแล้ว! ขอบคุณครับ");';
  html += '    document.getElementById("updateInput").value = "";';
  html += '    showOverview();';
  html += '  }else{';
  html += '    alert("ไม่สามารถส่งได้ กรุณาแจ้งพนักงานขาย");';
  html += '  }';
  html += '}';
  
  html += '<\/script>';
  html += '</body></html>';
  
  return html;
}

function fmtMoneyFull(n) {
  if (!n) return '0';
  n = Number(n);
  return n.toLocaleString('th-TH');
}
function copyClientLink(dealerId) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;
  
  var baseUrl = window.location.href.split('?')[0].split('#')[0];
  var basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  var encodedName = encodeURIComponent(dealer.name);
  var clientUrl = basePath + 'client-view.html?dealerId=' + dealerId + '&name=' + encodedName;
  
  copyText(clientUrl, '🔗 คัดลอกลิงก์สำหรับ ' + dealer.name + ' แล้ว! ส่งให้ลูกค้าได้เลย');
  toast('📋 ลิงก์: ' + clientUrl);
}

// ================================================================
// DEALER PIN MANAGEMENT
// ================================================================

function showDealerPinModal(dealerId) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;
  
  var pins = JSON.parse(localStorage.getItem('v7_dealer_pins') || '{}');
  var currentPin = pins[dealerId] || '';
  
  var uid = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.uid : '';
  var baseUrl = window.location.href.split('?')[0].split('#')[0];
  var basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  
  var clientUrl = basePath + 'client-view.html?dealerId=' + dealerId + '&uid=' + uid;
  if (currentPin) {
    clientUrl += '#pin=' + encodeURIComponent(currentPin);
  }
  
  var modalHtml = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:2000">';
  modalHtml += '<div class="modal-container" style="background:var(--card);border-radius:16px;max-width:400px;width:90%">';
  modalHtml += '<div class="modal-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between"><h3>🔒 ตั้งรหัสผ่านสำหรับ ' + sanitize(dealer.name) + '</h3><button class="modal-close" onclick="closeModal()" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer">✕</button></div>';
  modalHtml += '<div class="modal-body" style="padding:20px">';
  modalHtml += '<div class="form-group"><label>รหัสผ่าน (PIN) สำหรับลูกค้า</label><input type="password" id="dealerPin" class="form-control" value="' + currentPin + '" placeholder="ใส่รหัส 4-6 หลัก" maxlength="6" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:var(--text)"><div class="hint" style="font-size:11px;color:var(--text2);margin-top:4px">💡 ถ้าไม่ใส่รหัส ลูกค้าจะไม่ต้องใส่ PIN (ลิงก์จะไม่มีรหัส)</div></div>';
  modalHtml += '<div class="form-group"><label>🔗 ลิงก์สำหรับส่งให้ลูกค้า</label><div style="background:var(--bg);padding:8px;border-radius:8px;font-size:12px;word-break:break-all">' + clientUrl + '</div><button class="btn btn-sm" onclick="copyClientLink(\'' + clientUrl + '\', \'' + sanitize(dealer.name) + '\')" style="margin-top:8px">📋 คัดลอกลิงก์</button></div>';
  modalHtml += '</div>';
  modalHtml += '<div class="modal-footer" style="padding:16px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:12px">';
  modalHtml += '<button class="btn" onclick="closeModal()">ยกเลิก</button>';
  modalHtml += '<button class="btn btn-primary" onclick="saveDealerPin(\'' + dealerId + '\')">💾 บันทึก</button>';
  modalHtml += '</div></div></div>';
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function saveDealerPin(dealerId) {
  var pin = document.getElementById('dealerPin').value.trim();
  var pins = JSON.parse(localStorage.getItem('v7_dealer_pins') || '{}');
  
  if (pin) {
    pins[dealerId] = pin;
    toast('✅ บันทึกรหัสผ่านเรียบร้อยแล้ว');
  } else {
    delete pins[dealerId];
    toast('🗑️ ลบรหัสผ่านแล้ว (ลิงก์จะไม่มีรหัส)');
  }
  
  localStorage.setItem('v7_dealer_pins', JSON.stringify(pins));
  if (typeof syncToFirebase === 'function') syncToFirebase('dealerPins', pins);
  closeModal();
  render();
}

function openClientView(dealerId) {
  var pins = JSON.parse(localStorage.getItem('v7_dealer_pins') || '{}');
  var dealerPin = pins[dealerId] || '';
  
  var uid = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.uid : '';
  var baseUrl = window.location.href.split('?')[0].split('#')[0];
  var basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  
  var url = basePath + 'client-view.html?dealerId=' + dealerId + '&uid=' + uid;
  if (dealerPin) {
    url += '#pin=' + encodeURIComponent(dealerPin);
  }
  
  var win = window.open(url, '_blank');
  if (!win) { toast('กรุณาอนุญาต Popup'); return; }
}

function copyClientLink(url, dealerName) {
  copyText(url, '🔗 คัดลอกลิงก์สำหรับ ' + dealerName + ' แล้ว');
  toast('📋 ลิงก์: ' + url);
}
function closeModal() {
  var modal = document.querySelector('.modal-overlay');
  if (modal) modal.remove();
}
// ================================================================
// ลิงก์ปัจจุบัน + PIN — รวมเป็น panel เดียว (เดิมแยก showChangePinModal/showCurrentLinkModal คนละปุ่ม
// ข้อมูลชุดเดียวกันจาก dealerUpdates/{dealerId} เลยรวมได้โดยไม่เสียอะไร)
// ================================================================

async function showDealerAccessModal(dealerId) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;

  var baseUrl = window.location.href.split('?')[0].split('#')[0];
  var basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  var currentUrl = basePath + 'client-view.html?dealerId=' + encodeURIComponent(dealerId);

  var currentPin = '';
  try {
    var pinDoc = await db.collection('dealerUpdates').doc(dealerId).get();
    if (pinDoc.exists && pinDoc.data().pin) currentPin = pinDoc.data().pin;
  } catch(e) {}

  var html = `
    <div style="max-width:480px">
      <div class="form-group"><label>🏪 Dealer</label><div><strong>${sanitize(dealer.name)}</strong></div></div>
      <div class="form-group"><label>🔗 ลิงก์ปัจจุบัน</label>
        <div style="background:var(--bg);padding:12px;border-radius:8px;word-break:break-all;font-family:monospace;font-size:11px">${currentUrl}</div>
      </div>
      <div class="bg" style="margin-bottom:14px">
        <button class="btn bp" onclick="copyToClipboard('${currentUrl.replace(/'/g, "\\'")}')">📋 คัดลอกลิงก์</button>
        <button class="btn bo" onclick="window.open('${currentUrl}', '_blank')">🔗 ทดสอบเปิด</button>
      </div>
      <div class="form-group" style="border-top:1px solid var(--border);padding-top:12px">
        <label>🔒 PIN ของลูกค้า</label>
        <input type="password" id="changePinInput" class="form-control" value="${currentPin}" placeholder="ใส่รหัส 4-6 หลัก" maxlength="6">
        <div class="hint">💡 ถ้าเว้นว่าง จะลบ PIN (ลูกค้าเข้าได้เลยไม่ต้องใส่รหัส) — PIN จะไม่ติดไปในลิงก์ ต้องแจ้งลูกค้าแยกช่องทาง</div>
      </div>
      <div class="bg">
        <button class="btn bp" onclick="savePinOnly('${dealerId}')">💾 บันทึก PIN</button>
        <button class="btn bo" onclick="closeModal()">ปิด</button>
      </div>
    </div>
  `;

  openM('🔗🔒 ลิงก์ & PIN — ' + dealer.name, html);
}

async function savePinOnly(dealerId) {
  var pin = document.getElementById('changePinInput').value.trim();

  try {
    var oldDoc = await db.collection('dealerUpdates').doc(dealerId).get();
    var oldPin = oldDoc.exists ? oldDoc.data().pin : '';

    await db.collection('dealerUpdates').doc(dealerId).set({
      pin: pin || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // ✅ Audit Log
    var dealer = ST.getOne('dealers', dealerId);
    addAuditLog(
      pin ? 'set_pin' : 'remove_pin',
      'pin',
      dealerId,
      dealer ? dealer.name : dealerId,
      dealerId,
      dealer ? dealer.name : '',
      { oldValue: oldPin || '(ไม่มี)', newValue: pin || '(ไม่มี)' }
    );

    toast(pin ? '✅ บันทึก PIN เรียบร้อย' : '🗑️ ลบ PIN แล้ว');
    showDealerAccessModal(dealerId);
  } catch(e) {
    toast('❌ เกิดข้อผิดพลาด: ' + e.message);
  }
}
// ================================================================
// DEALER DEMO TAB (กำหนด Demo Option และรายการอุปกรณ์)
// ================================================================

function dealerDemoTab(d) {
  var cfg = getConfig();
  var demoOption = d.demoOption || 'option1';
  var demoItems = d.demoItems || [];
  
// ดึงรายการ Demo Unit ทั้งหมด (ใช้ฟังก์ชันใหม่)
var allDemoProducts = getAllDemoUnitsFromProducts();
console.log('📦 Demo Units ในระบบ:', allDemoProducts.length, 'รายการ');

// ถ้ายังไม่มี ให้ลองโหลดจาก Products module อีกครั้ง
if (allDemoProducts.length === 0 && typeof Products !== 'undefined') {
  var products = Products.getAll();
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    if (p && (p.category === 'demo' || (p.name && p.name.indexOf('(Demo)') !== -1))) {
      allDemoProducts.push({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        ean: p.ean || '',
        price: p.demoPrice || p.price || 0
      });
    }
  }
  console.log('📦 โหลดจาก Products.getAll:', allDemoProducts.length, 'รายการ');
}  
  // เพิ่มจาก Demo Units
  var demoUnits = getAllDemoUnits();
  for (var i = 0; i < demoUnits.length; i++) {
    var du = demoUnits[i];
    var exists = false;
    for (var j = 0; j < allDemoProducts.length; j++) {
      if (allDemoProducts[j].name === du.productName) {
        exists = true;
        break;
      }
    }
    if (!exists && du.enabled !== false) {
      allDemoProducts.push({
        id: du.id,
        name: du.productName,
        price: du.price,
        sku: du.sku,
        ean: du.ean
      });
    }
  }
  
  // สร้าง datalist options
  var modelOptions = '';
  for (var i = 0; i < allDemoProducts.length; i++) {
    var p = allDemoProducts[i];
    var price = p.price || 0;
    modelOptions += '<option value="' + sanitize(p.name) + '" data-price="' + price + '">' + 
      sanitize(p.name) + (price > 0 ? ' (฿' + fmtMoney(price) + ')' : '') + '</option>';
  }
  
  // เกณฑ์ที่ต้องมีปัจจุบัน (Level default หรือ custom override ที่บันทึกไว้) — ใช้ทั้งตอนคำนวณป้ายสถานะ
  // และตอนติ๊ก checkbox "ต้องมี" ที่แถวอุปกรณ์แต่ละแถวด้านล่าง
  var _level = d.level || 'Other';
  var _levelReq = (cfg?.levelRequirements?.[_level]) || cfg?.levelRequirements?.B || { option1Models: [], option2Models: [] };
  var _customReq = d.customDemoRequirements || {};
  var _useCustom = _customReq.enabled === true;
  var requiredOption1 = _useCustom ? (_customReq.option1Models || _levelReq.option1Models || []) : (_levelReq.option1Models || []);
  var requiredOption2 = _useCustom ? (_customReq.option2Models || _levelReq.option2Models || []) : (_levelReq.option2Models || []);

  var html = '<div class="card">';
  html += '<h2>🚁 Demo Requirement</h2>';

  // สถานะครบ/ไม่ครบ ขึ้นบนสุดทันที เห็นผลไม่ต้องเลื่อนหา (คำนวณจากข้อมูลที่บันทึกไว้ล่าสุด)
  html += _dealerDemoStatusBadgeHtml(d);

  // ตัวเลือก Option
  html += '<div class="form-section">📌 เลือก Option</div>';
  html += '<div class="radio-g" style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:8px">';
  html += '<label><input type="radio" name="demoOption" value="none"' + (demoOption === 'none' ? ' checked' : '') + '> ❌ ไม่มีข้อกำหนด</label>';
  html += '<label><input type="radio" name="demoOption" value="option1"' + (demoOption === 'option1' ? ' checked' : '') + '> 📦 Option 1 (Drone + Payload)</label>';
  html += '<label><input type="radio" name="demoOption" value="option2"' + (demoOption === 'option2' ? ' checked' : '') + '> 🏗️ Option 2 (Dock + Drone)</label>';
  html += '<label><input type="radio" name="demoOption" value="both"' + (demoOption === 'both' ? ' checked' : '') + '> 📦🏗️ Both Options</label>';
  html += '</div>';
  
  // รายการอุปกรณ์ที่มี
  html += '<div class="form-section">📦 รายการอุปกรณ์ Demo ที่มีอยู่</div>';
  html += '<div class="hint" style="margin-bottom:8px">💡 พิมพ์ชื่อสินค้า ระบบจะแสดงราคาอัตโนมัติ (กดเพิ่มได้ทีละรายการ) — ติ๊ก "ต้องมี" ตรงแถวไหนก็นับแถวนั้นเข้าเกณฑ์ครบ/ไม่ครบ ไปแสดงใน client-view ทันที ไม่ต้องพิมพ์ชื่อซ้ำในกล่องด้านล่าง</div>';

  html += '<div id="demoItemsList" style="margin-bottom:12px; max-height: 300px; overflow-y: auto">';
  for (var i = 0; i < demoItems.length; i++) {
    var item = demoItems[i];
    var isReq1 = requiredOption1.indexOf(item.model) !== -1;
    var isReq2 = requiredOption2.indexOf(item.model) !== -1;
    html += '<div class="demo-item-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px;background:var(--bg2);border-radius:10px;flex-wrap:wrap">';
    html += '<div style="flex:2;min-width:180px">';
    html += '<input type="text" id="demo_model_' + i + '" class="demo-model" list="demoDatalist" style="width:100%;padding:8px;border-radius:8px" value="' + sanitize(item.model || '') + '" placeholder="พิมพ์ชื่อสินค้า..." data-idx="' + i + '" onchange="updateDemoPriceFromList(this)">';
    html += '</div>';
    html += '<div style="width:120px">';
    html += '<input type="text" id="demo_price_' + i + '" class="demo-price" style="width:100%;padding:8px;border-radius:8px;text-align:right;background:var(--bg3)" value="' + fmtMoney(item.price || 0) + '" placeholder="ราคา" readonly>';
    html += '</div>';
    html += '<div style="flex:1;min-width:120px">';
    html += '<input type="text" id="demo_sn_' + i + '" class="demo-sn" style="width:100%;padding:8px;border-radius:8px" placeholder="Serial Number" value="' + sanitize(item.serialNumber || '') + '">';
    html += '</div>';
    html += '<label style="font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:3px"><input type="checkbox" class="demo-req-opt1" style="width:auto" ' + (isReq1 ? 'checked' : '') + ' onchange="_demoRowReqToggle(this,1)">ต้องมี (Opt1)</label>';
    html += '<label style="font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:3px"><input type="checkbox" class="demo-req-opt2" style="width:auto" ' + (isReq2 ? 'checked' : '') + ' onchange="_demoRowReqToggle(this,2)">ต้องมี (Opt2)</label>';
    html += '<button class="btn bsm bd" onclick="removeDemoItemRow(this)">🗑️</button>';
    html += '</div>';
  }
  html += '</div>';
  
  // ปุ่มเพิ่ม + ฟอร์มเพิ่ม — รวมชื่อสินค้ากับ Serial Number ไว้แถวเดียว กด Enter จากช่องไหนก็เพิ่มได้เลย
  // ไม่ต้องกดเพิ่มก่อนแล้วค่อยเลื่อนไปหาแถวใหม่เพื่อกรอก SN ทีหลังเหมือนเดิม
  html += '<div style="display:flex;gap:8px;margin-bottom:4px;flex-wrap:wrap;align-items:flex-end">';
  html += '<div style="flex:2;min-width:180px">';
  html += '<label style="font-size:11px;color:var(--text2)">📦 เพิ่มอุปกรณ์ Demo</label>';
  html += '<input type="text" id="newDemoModel" list="demoDatalist" class="fm-input" placeholder="พิมพ์ชื่อสินค้า..." autocomplete="off" style="width:100%" onchange="previewNewDemoPriceFromList()" oninput="previewNewDemoPriceFromList()" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addNewDemoItemFromList();}">';
  html += '</div>';
  html += '<div style="width:120px">';
  html += '<label style="font-size:11px;color:var(--text2)">💰 ราคา</label>';
  html += '<input type="text" id="newDemoPrice" class="fm-input" placeholder="ราคา" readonly style="width:100%;text-align:right;background:var(--bg3)">';
  html += '</div>';
  html += '<div style="flex:1;min-width:120px">';
  html += '<label style="font-size:11px;color:var(--text2)">🔢 Serial Number</label>';
  html += '<input type="text" id="newDemoSN" class="fm-input" placeholder="Serial Number" style="width:100%" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addNewDemoItemFromList();}">';
  html += '</div>';
  html += '<div>';
  html += '<label style="font-size:11px;color:var(--text2)">&nbsp;</label><br>';
  html += '<button class="btn bp" onclick="addNewDemoItemFromList()" style="padding:8px 16px">➕ เพิ่ม</button>';
  html += '</div>';
  html += '</div>';
  
  // Datalist
  html += '<datalist id="demoDatalist">' + modelOptions + '</datalist>';
  
  // Preview - ✅ ใช้ cfg ที่ประกาศไว้ตอนต้น + requiredOption1/2 ที่คำนวณไว้แล้วด้านบน (ใช้ร่วมกับ checkbox
  // ต้องมี ต่อแถวด้วย ไม่ต้องคำนวณซ้ำ)
  html += '<div class="form-section">📊 สถานะปัจจุบัน (Preview)</div>';
  html += '<div id="demoPreviewContainer" style="background:var(--bg3);border-radius:12px;padding:12px;margin-bottom:12px">';

  html += renderDemoPreviewDynamic(demoOption, demoItems || [], requiredOption1, requiredOption2);
  html += '</div>';

// ✅ เพิ่มส่วน Custom Demo Requirements (หลังจาก Preview และก่อนปุ่มบันทึก)
var customReqHtml = renderCustomDemoRequirementsEditor(d);
html += customReqHtml;

// ✅ ฟังก์ชัน renderCustomDemoRequirementsEditor
function renderCustomDemoRequirementsEditor(dealer) {
  var level = dealer.level || 'Other';
  var cfg = getConfig();
  var levelRequirements = cfg.levelRequirements || {};
  var defaultReq = levelRequirements[level] || levelRequirements.B || { option1Models: [], option2Models: [] };
  
  var customReq = dealer.customDemoRequirements || {};
  var useCustom = customReq.enabled === true;
  
  var option1Models = useCustom ? (customReq.option1Models || defaultReq.option1Models || []) : (defaultReq.option1Models || []);
  var option2Models = useCustom ? (customReq.option2Models || defaultReq.option2Models || []) : (defaultReq.option2Models || []);
  
  var opt1Html = '';
  for (var i = 0; i < option1Models.length; i++) {
    opt1Html += '<span class="tag tag-count" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;margin:2px">' +
      sanitize(option1Models[i]) +
      '<button class="btn-xs" style="padding:0 4px;margin-left:4px" onclick="_demoRemoveReqChip(this,1)">✕</button></span>';
  }

  var opt2Html = '';
  for (var i = 0; i < option2Models.length; i++) {
    opt2Html += '<span class="tag tag-count" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;margin:2px">' +
      sanitize(option2Models[i]) +
      '<button class="btn-xs" style="padding:0 4px;margin-left:4px" onclick="_demoRemoveReqChip(this,2)">✕</button></span>';
  }
  
  // เดิมต้องกดติ๊ก "กำหนดเอง" ก่อนถึงจะแก้ได้ — ตัดออก แสดงรายการที่ต้องมีให้แก้ตรงนี้ได้เลยเสมอ
  // (ตอนบันทึกจะเทียบกับค่าเริ่มต้นของ Level เอง ถ้าไม่ได้แก้อะไรก็ยังอิงตาม Level ต่อไปเหมือนเดิม
  // ไม่ต้องมี toggle ให้สับสน — ดู saveDemoSettingEnhanced)
  return '<div class="form-section" style="margin-top:16px">✅ รายการที่ต้องมี ' + (useCustom ? '<span style="font-size:11px;font-weight:400;color:var(--text2)">(กำหนดเองสำหรับ Dealer นี้)</span>' : '<span style="font-size:11px;font-weight:400;color:var(--text2)">(ตามค่าเริ่มต้นของ Level ' + sanitize(level) + ')</span>') + '</div>' +
    '<div id="customDemoReqPanel">' +
    '<div class="fg" style="margin-top: 4px"><label>📦 Option 1 (Drone + Payload) - รุ่นที่ต้องมี</label>' +
    '<div id="customOption1List" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">' + opt1Html + '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px">' +
    '<input type="text" id="customOpt1NewModel" class="fm-input" placeholder="พิมพ์ชื่อ Model..." list="demoDatalist" style="flex:2" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addCustomOption1Model();}">' +
    '<button class="btn bsm bp" onclick="addCustomOption1Model()">➕ เพิ่ม</button>' +
    '</div></div>' +
    '<div class="fg" style="margin-top: 12px"><label>🏗️ Option 2 (Dock + Drone) - รุ่นที่ต้องมี</label>' +
    '<div id="customOption2List" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">' + opt2Html + '</div>' +
    '<div style="display:flex;gap:8px">' +
    '<input type="text" id="customOpt2NewModel" class="fm-input" placeholder="พิมพ์ชื่อ Model..." list="demoDatalist" style="flex:2" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addCustomOption2Model();}">' +
    '<button class="btn bsm bp" onclick="addCustomOption2Model()">➕ เพิ่ม</button>' +
    '</div></div>' +
    '<button class="btn bsm bo" onclick="resetDemoReqToLevelDefault(\'' + sanitize(level) + '\')">↺ รีเซ็ตเป็นค่าเริ่มต้นของ Level</button>' +
    '</div>';
}
  
  // ปุ่มบันทึก
  html += '<div class="bg" style="margin-top:8px;gap:12px">';
  html += '<button class="btn bp" onclick="saveDemoSettingEnhanced(\'' + d.id + '\')">💾 บันทึก</button>';
  html += '<button class="btn bo" onclick="showDemoClientPreviewM(\'' + d.id + '\')">👁 Preview client-view</button>';
  html += '<button class="btn bo" onclick="syncDemoToGlobalEnhanced(\'' + d.id + '\')">🔄 Sync ไปยัง Demo Equipment</button>';
  html += '</div>';
  
  html += '</div>';
  
  // event listeners
  setTimeout(function() {
    var radios = document.querySelectorAll('input[name="demoOption"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function() {
        updateDemoPreviewFromDealer();
      });
    }
    updateDemoPreviewFromDealer();
  }, 100);
  
  return html;
}
// ================================================================
// ฟังก์ชันเสริมสำหรับ Demo Tab
// ================================================================

function updateDemoPriceFromList(inputEl) {
  var modelName = inputEl.value;
  var row = inputEl.closest('.demo-item-row');
  if (!row) return;
  var priceInput = row.querySelector('.demo-price');
  if (!priceInput) return;
  
  // หาราคาจาก datalist
  var datalist = document.getElementById('demoDatalist');
  if (datalist) {
    var options = datalist.querySelectorAll('option');
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === modelName) {
        var price = parseInt(options[i].getAttribute('data-price')) || 0;
        priceInput.value = price > 0 ? price.toLocaleString('th-TH') : '0';
        break;
      }
    }
  }
  updateDemoPreviewFromDealer();
}

function previewNewDemoPriceFromList() {
  var modelInput = document.getElementById('newDemoModel');
  var priceInput = document.getElementById('newDemoPrice');
  if (!modelInput || !priceInput) return;
  
  var modelName = modelInput.value.trim();
  if (!modelName) {
    priceInput.value = '';
    return;
  }
  
  var datalist = document.getElementById('demoDatalist');
  if (datalist) {
    var options = datalist.querySelectorAll('option');
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === modelName) {
        var price = parseInt(options[i].getAttribute('data-price')) || 0;
        priceInput.value = price > 0 ? price.toLocaleString('th-TH') : '';
        break;
      }
    }
  }
}

function addNewDemoItemFromList() {
  var modelInput = document.getElementById('newDemoModel');
  var priceInput = document.getElementById('newDemoPrice');
  var snInput = document.getElementById('newDemoSN');
  var model = modelInput ? modelInput.value.trim() : '';

  if (!model) {
    toast('⚠️ กรุณาเลือกสินค้า Demo');
    return;
  }

  var price = 0;
  if (priceInput && priceInput.value) {
    price = parseInt(priceInput.value.replace(/[^0-9]/g, '')) || 0;
  }
  var sn = snInput ? snInput.value.trim() : '';

  var container = document.getElementById('demoItemsList');
  if (!container) return;

  // ถ้ารุ่นนี้เคยถูกใส่ไว้ในเกณฑ์ "ต้องมี" อยู่แล้ว (ตอนยังไม่มีของ) ให้ติ๊ก checkbox ให้อัตโนมัติเลย
  var reqInChip = function(containerId) {
    var c = document.getElementById(containerId);
    if (!c) return false;
    var chips = c.querySelectorAll('.tag');
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].textContent.replace('✕', '').trim() === model) return true;
    }
    return false;
  };
  var autoReq1 = reqInChip('customOption1List');
  var autoReq2 = reqInChip('customOption2List');

  var idx = Date.now();
  var newRow = '<div class="demo-item-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px;background:var(--bg2);border-radius:10px;flex-wrap:wrap">';
  newRow += '<div style="flex:2;min-width:180px">';
  newRow += '<input type="text" id="demo_model_' + idx + '" class="demo-model" list="demoDatalist" style="width:100%;padding:8px;border-radius:8px" value="' + sanitize(model) + '" placeholder="พิมพ์ชื่อสินค้า..." data-idx="' + idx + '" onchange="updateDemoPriceFromList(this)">';
  newRow += '</div>';
  newRow += '<div style="width:120px">';
  newRow += '<input type="text" id="demo_price_' + idx + '" class="demo-price" style="width:100%;padding:8px;border-radius:8px;text-align:right;background:var(--bg3)" value="' + (price > 0 ? price.toLocaleString('th-TH') : '0') + '" placeholder="ราคา" readonly>';
  newRow += '</div>';
  newRow += '<div style="flex:1;min-width:120px">';
  newRow += '<input type="text" id="demo_sn_' + idx + '" class="demo-sn" style="width:100%;padding:8px;border-radius:8px" placeholder="Serial Number" value="' + sanitize(sn) + '">';
  newRow += '</div>';
  newRow += '<label style="font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:3px"><input type="checkbox" class="demo-req-opt1" style="width:auto" ' + (autoReq1 ? 'checked' : '') + ' onchange="_demoRowReqToggle(this,1)">ต้องมี (Opt1)</label>';
  newRow += '<label style="font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:3px"><input type="checkbox" class="demo-req-opt2" style="width:auto" ' + (autoReq2 ? 'checked' : '') + ' onchange="_demoRowReqToggle(this,2)">ต้องมี (Opt2)</label>';
  newRow += '<button class="btn bsm bd" onclick="removeDemoItemRow(this)">🗑️</button>';
  newRow += '</div>';

  container.insertAdjacentHTML('beforeend', newRow);

  modelInput.value = '';
  priceInput.value = '';
  if (snInput) snInput.value = '';
  modelInput.focus();

  updateDemoPreviewFromDealer();
  toast('➕ เพิ่ม ' + model + (sn ? ' (SN: ' + sn + ')' : ''));
}

function saveDemoSettingEnhanced(dealerId) {
  var demoOptionElem = document.querySelector('input[name="demoOption"]:checked');
  if (!demoOptionElem) {
    toast('⚠️ กรุณาเลือก Option');
    return;
  }
  var demoOption = demoOptionElem.value;
  
  var demoItems = [];
  var rows = document.querySelectorAll('#demoItemsList .demo-item-row');
  for (var i = 0; i < rows.length; i++) {
    var modelInput = rows[i].querySelector('.demo-model');
    var snInput = rows[i].querySelector('.demo-sn');
    var priceInput = rows[i].querySelector('.demo-price');
    
    if (modelInput && modelInput.value) {
      var price = 0;
      if (priceInput && priceInput.value) {
        price = parseInt(priceInput.value.replace(/[^0-9]/g, '')) || 0;
      }
      demoItems.push({
        model: modelInput.value,
        serialNumber: snInput ? snInput.value.trim() : '',
        price: price
      });
    }
  }
  
  // ✅ เกณฑ์ที่ต้องมี — ไม่มี checkbox "กำหนดเอง" ให้ติ๊กแล้ว เทียบ list ที่แก้ไว้กับค่าเริ่มต้นของ Level เอง
  // ถ้าไม่มีเปลี่ยนอะไรเลย ให้ยังอิงตาม Level (enabled:false) ต่อไป — Admin แก้ Level default ทีหลัง
  // จะมีผลกับ Dealer รายนี้ด้วยอัตโนมัติ ถ้าแก้ไปจาก default แล้วถึงจะล็อกเป็นค่าเฉพาะของ Dealer นี้
  var uiReq = getCustomDemoRequirementsFromUI();
  var dealerForSave = ST.getOne('dealers', dealerId);
  var levelForSave = (dealerForSave && dealerForSave.level) || 'Other';
  var cfgForSave = getConfig();
  var defaultReqForSave = (cfgForSave?.levelRequirements?.[levelForSave]) || cfgForSave?.levelRequirements?.B || { option1Models: [], option2Models: [] };
  var _sameSet = function(a, b) {
    a = (a || []).slice().sort(); b = (b || []).slice().sort();
    return a.length === b.length && a.every(function(v, i) { return v === b[i]; });
  };
  var isCustom = !_sameSet(uiReq.option1Models, defaultReqForSave.option1Models || []) || !_sameSet(uiReq.option2Models, defaultReqForSave.option2Models || []);

  // ✅ สร้าง updates object
  var updates = {
    demoOption: demoOption,
    demoItems: demoItems,
    customDemoRequirements: isCustom ? { enabled: true, option1Models: uiReq.option1Models, option2Models: uiReq.option2Models } : { enabled: false }
  };

  // ✅ บันทึกข้อมูล
  ST.update('dealers', dealerId, updates);
  // ✅ ต้อง sync ขึ้น dealerUpdates/{dealerId} ด้วย ไม่งั้น ST.update บันทึกแค่ localStorage เครื่องเซลล์
  // เอง client-view (ที่อ่านจาก dealerUpdates ใน Firestore) จะไม่เห็นข้อมูล Demo ที่เพิ่งกรอกเลย
  if (typeof syncDealerToFirebase === 'function') syncDealerToFirebase(dealerId);

  if (typeof addAuditLog === 'function') {
    var dealer = ST.getOne('dealers', dealerId);
    addAuditLog('update_dealer_demo', 'dealer', dealerId, dealer ? dealer.name : '', dealerId, dealer ? dealer.name : '', {
      demoOption: demoOption,
      itemCount: demoItems.length,
      useCustomReq: isCustom
    });
  }

  toast('💾 บันทึกการตั้งค่า Demo เรียบร้อย (' + demoItems.length + ' รายการ)');
  render();
}
function syncDemoToGlobalEnhanced(dealerId) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;
  
  var demoItems = dealer.demoItems || [];
  if (demoItems.length === 0) {
    toast('⚠️ ไม่มีอุปกรณ์ Demo ให้ Sync');
    return;
  }
  
  var globalDemo = getAllDemoUnits();
  
  for (var i = 0; i < demoItems.length; i++) {
    var item = demoItems[i];
    var exists = false;
    for (var j = 0; j < globalDemo.length; j++) {
      if (globalDemo[j].productName === item.model) {
        exists = true;
        updateDemoUnit(globalDemo[j].id, {
          price: item.price || 0,
          note: 'Synced from Dealer: ' + dealer.name
        });
        break;
      }
    }
    if (!exists) {
      addDemoUnit({
        productName: item.model,
        price: item.price || 0,
        sku: '',
        ean: '',
        enabled: true,
        note: 'Synced from Dealer: ' + dealer.name
      });
    }
  }
  
  toast('🔄 Sync Demo Unit ไปยังหน้า Demo Equipment แล้ว (' + demoItems.length + ' รายการ)');
  render();
}

// ฟังก์ชัน getAllDemoUnits (ถ้ายังไม่มี)
function getAllDemoUnits() {
  var data = getProductsData();
  return data.demoUnits || [];
}

function addDemoUnit(data) {
  var productsData = getProductsData();
  if (!productsData.demoUnits) productsData.demoUnits = [];
  var newDemo = {
    id: 'demo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    productId: data.productId || '',
    productName: data.productName || '',
    sku: data.sku || '',
    ean: data.ean || '',
    price: data.price || 0,
    note: data.note || '',
    enabled: data.enabled !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  productsData.demoUnits.push(newDemo);
  productsData.lastUpdated = new Date().toISOString();
  saveProductsData(productsData);
  return newDemo;
}

function updateDemoUnit(demoId, updates) {
  var productsData = getProductsData();
  if (!productsData.demoUnits) return false;
  for (var i = 0; i < productsData.demoUnits.length; i++) {
    if (productsData.demoUnits[i].id === demoId) {
      for (var key in updates) {
        if (updates.hasOwnProperty(key)) productsData.demoUnits[i][key] = updates[key];
      }
      productsData.demoUnits[i].updatedAt = new Date().toISOString();
      productsData.lastUpdated = new Date().toISOString();
      saveProductsData(productsData);
      return true;
    }
  }
  return false;
}

function deleteDemoUnit(demoId) {
  var productsData = getProductsData();
  if (!productsData.demoUnits) return false;
  productsData.demoUnits = productsData.demoUnits.filter(function(d) { return d.id !== demoId; });
  productsData.lastUpdated = new Date().toISOString();
  saveProductsData(productsData);
  return true;
}

// ⚠️ getProductsData/saveProductsData ตัวจริงอยู่ใน products.js — เคยมีสำเนาซ้ำอยู่ตรงนี้ (เขียนแค่
// localStorage เฉยๆ ไม่ push ขึ้น cloud/ไม่ mirror ไป config เลย) เพราะไฟล์นี้โหลดทีหลัง products.js
// ฟังก์ชันซ้ำนี้เลย "บัง" ตัวจริงตลอดมา ทำให้แก้ไข/ลบสินค้าใดๆ ผ่านทั้งแอปไม่เคย sync ขึ้น cloud เลยจริงๆ
// (พบ 2026-07-19 ตอนตรวจปัญหาลบสินค้าแล้ว refresh กลับมาใหม่) ลบสำเนานี้ทิ้ง ให้ใช้ตัวจริงจาก products.js
// ================================================================
// HELPER FUNCTIONS FOR DEMO TAB (UPDATED)
// ================================================================

// ✅ เก็บไว้ - ใช้เพิ่มรายการ Demo แบบ Select dropdown
function addDemoItemRow() {
  var container = document.getElementById('demoItemsList');
  var idx = Date.now();
  var newRow = '<div class="demo-item-row" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:8px;background:var(--bg2);border-radius:10px">';
  newRow += '<div style="flex:1"><input type="text" id="demo_model_' + idx + '" class="demo-model" list="demoDatalist" style="width:100%;padding:8px;border-radius:8px" placeholder="พิมพ์ชื่อสินค้า..."></div>';
  newRow += '<div style="width:100px"><input type="text" id="demo_price_' + idx + '" class="demo-price" style="width:100%;padding:8px;border-radius:8px;text-align:right" placeholder="ราคา" readonly></div>';
  newRow += '<div style="flex:1"><input type="text" id="demo_sn_' + idx + '" class="demo-sn" style="width:100%;padding:8px;border-radius:8px" placeholder="Serial Number"></div>';
  newRow += '<button class="btn bsm bd" onclick="removeDemoItemRow(this)">🗑️</button>';
  newRow += '</div>';
  container.insertAdjacentHTML('beforeend', newRow);
}

// ✅ เก็บไว้ - ลบรายการ Demo
function removeDemoItemRow(btn) {
  var row = btn.closest('.demo-item-row');
  if (row) row.remove();
  updateDemoPreviewFromDealer(); // เปลี่ยนจาก updateDemoPreview()
}

// อัปเดต Preview แบบสด ตอนแอดมินพิมพ์/ลบรายการ Demo — ใช้ level จริงของ dealer + เช็ค "กำหนดเอง"
// (เดิม hardcode Level A เสมอ ไม่ตรงกับที่ client-view ใช้จริง เหมือนบั๊กที่แก้ไปแล้วใน dealerDemoTab())
function updateDemoPreviewFromDealer() {
  var container = document.getElementById('demoPreviewContainer');
  if (!container) return;

  var demoOptionElem = document.querySelector('input[name="demoOption"]:checked');
  var demoOption = demoOptionElem ? demoOptionElem.value : 'option1';

  var demoItems = [];
  var rows = document.querySelectorAll('#demoItemsList .demo-item-row');
  for (var i = 0; i < rows.length; i++) {
    var modelInput = rows[i].querySelector('.demo-model');
    if (modelInput && modelInput.value) demoItems.push({ model: modelInput.value });
  }

  var dealer = ST.getOne('dealers', S.dealerId) || {};
  var cfg = getConfig();
  var level = dealer.level || 'Other';
  var levelReq = (cfg?.levelRequirements?.[level]) || cfg?.levelRequirements?.B || { option1Models: [], option2Models: [] };
  var customReq = dealer.customDemoRequirements || {};
  var useCustom = customReq.enabled === true;
  var requiredOption1 = useCustom ? (customReq.option1Models || levelReq.option1Models || []) : (levelReq.option1Models || []);
  var requiredOption2 = useCustom ? (customReq.option2Models || levelReq.option2Models || []) : (levelReq.option2Models || []);

  container.innerHTML = renderDemoPreviewDynamic(demoOption, demoItems, requiredOption1, requiredOption2);
}

function renderDemoPreviewDynamic(demoOption, demoItems, requiredOption1, requiredOption2) {
  if (!demoItems || typeof demoItems !== 'object') demoItems = [];
  if (!requiredOption1 || !Array.isArray(requiredOption1)) requiredOption1 = [];
  if (!requiredOption2 || !Array.isArray(requiredOption2)) requiredOption2 = [];

  var ownedModels = {};
  for (var i = 0; i < demoItems.length; i++) {
    if (demoItems[i] && demoItems[i].model) {
      ownedModels[demoItems[i].model] = true;
    }
  }
  
  var optionText = {
    'none': '❌ ไม่มีข้อกำหนด',
    'option1': '📦 Option 1 (Drone + Payload)',
    'option2': '🏗️ Option 2 (Dock + Drone)',
    'both': '📦🏗️ Both Options'
  };
  
  var html = '<div style="background:var(--bg3);border-radius:12px;padding:12px">';
  html += '<div style="margin-bottom:8px"><strong>📌 ตัวเลือก:</strong> ' + (optionText[demoOption] || demoOption) + '</div>';
  
  if (demoOption === 'none') {
    html += '<div class="hint">ℹ️ ไม่มีข้อกำหนด Demo สำหรับ Dealer นี้</div>';
    html += '</div>';
    return html;
  }
  
  if (demoOption === 'option1' || demoOption === 'both') {
    html += '<div style="margin-top:8px"><strong>📦 Option 1 (ต้องมี):</strong></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">';
    for (var i = 0; i < requiredOption1.length; i++) {
      var model = requiredOption1[i];
      var has = ownedModels[model];
      html += '<div style="padding:6px 12px;border-radius:10px;background:' + (has ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') + ';border:1px solid ' + (has ? '#22c55e' : '#ef4444') + '">';
      html += (has ? '✅' : '❌') + ' ' + sanitize(model);
      html += '</div>';
    }
    html += '</div>';
  }
  
  if (demoOption === 'option2' || demoOption === 'both') {
    html += '<div style="margin-top:12px"><strong>🏗️ Option 2 (ต้องมี):</strong></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">';
    for (var i = 0; i < requiredOption2.length; i++) {
      var model = requiredOption2[i];
      var has = ownedModels[model];
      html += '<div style="padding:6px 12px;border-radius:10px;background:' + (has ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') + ';border:1px solid ' + (has ? '#22c55e' : '#ef4444') + '">';
      html += (has ? '✅' : '❌') + ' ' + sanitize(model);
      html += '</div>';
    }
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}
// ================================================================
// DEMO UNIT HELPER FUNCTIONS (เพิ่มเพื่อให้ทำงานกับ products.js)
// ================================================================

// อ่านข้อมูล Demo Unit ทั้งหมดจาก Products module
function getAllDemoUnitsFromProducts() {
  var demos = [];
  
  // วิธีที่ 1: ใช้ Products module โดยตรง
  if (typeof Products !== 'undefined' && Products.getAll) {
    var allProducts = Products.getAll();
    for (var i = 0; i < allProducts.length; i++) {
      var p = allProducts[i];
      // ตรวจสอบว่าเป็น Demo Unit (category === 'demo' หรือชื่อมี (Demo))
      if (p.category === 'demo' || (p.name && p.name.indexOf('(Demo)') !== -1)) {
        demos.push({
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          ean: p.ean || '',
          price: p.demoPrice || p.price || 0,
          category: p.category
        });
      }
    }
    if (demos.length > 0) {
      console.log('📦 โหลด Demo Unit จาก Products module:', demos.length, 'รายการ');
      return demos;
    }
  }
  
  // วิธีที่ 2: อ่านจาก localStorage โดยตรง (fallback)
  try {
    var saved = localStorage.getItem('v7_products');
    if (saved) {
      var data = JSON.parse(saved);
      var products = [];
      
      // รองรับหลายรูปแบบของ v7_products
      if (Array.isArray(data)) {
        products = data;
      } else if (data.models && Array.isArray(data.models)) {
        products = data.models;
      } else if (typeof data === 'object') {
        var values = Object.values(data);
        if (values.length && values[0] && values[0].id) {
          products = values;
        }
      }
      
      for (var i = 0; i < products.length; i++) {
        var p = products[i];
        if (p && (p.category === 'demo' || (p.name && p.name.indexOf('(Demo)') !== -1))) {
          demos.push({
            id: p.id,
            name: p.name,
            sku: p.sku || '',
            ean: p.ean || '',
            price: p.demoPrice || p.price || 0,
            category: p.category
          });
        }
      }
      console.log('📦 โหลด Demo Unit จาก localStorage:', demos.length, 'รายการ');
    }
  } catch(e) {
    console.error('Error loading demo units:', e);
  }
  
  return demos;
}

// อ่าน Demo Unit สำหรับ Dealer (จาก dealer.demoItems)
function getDealerDemoItems(dealer) {
  if (!dealer) return [];
  if (dealer.demoItems && Array.isArray(dealer.demoItems)) {
    return dealer.demoItems;
  }
  return [];
}
// ================================================================
// PART: SIS REVENUE MANAGEMENT
// ================================================================

// อ่านยอดขาย SIS (H1/H2 + Q1-Q4 + รายเดือน) ของปีที่ระบุ — ปีที่ไม่เคยตั้งจะได้ 0 เสมอ (ไม่ทับข้อมูลปีก่อน)
// ปีปัจจุบันที่ยังไม่มี sisRevenueByYear จะ fallback ไปอ่านฟิลด์เดิม (สมัยก่อนมีปีเดียว ไม่มี Quarter) ให้อัตโนมัติ
// getSisRevenueForYear / sisComputeHalfMonths / sisSummarizeMonthly / _sisEstimateMonthlyFromQuarters
// ย้ายไปอยู่ utils.js แล้ว (client-view.html ต้องใช้ตัวเดียวกันด้วย แต่ไม่ได้โหลด views-dealer.js)

function _sisRecalc() {
  var cfg = getConfig();
  var monthly = {};
  for (var i = 1; i <= 12; i++) {
    var el = document.getElementById('sisM' + i);
    monthly[i] = el ? parseNum(el.value) : 0;
  }
  var sum = sisSummarizeMonthly(monthly, cfg);
  var qWrap = document.getElementById('sisQtrSummary');
  if (qWrap) qWrap.innerHTML = [1, 2, 3, 4].map(function(qi) {
    return '<div style="background:var(--bg2);border-radius:8px;padding:6px 8px;text-align:center"><div style="font-size:9.5px;color:var(--text2);font-weight:700">Q' + qi + '</div><div style="font-size:12px;font-weight:700">' + fmtMoneyShort(sum['q' + qi]) + '</div></div>';
  }).join('');
  var hWrap = document.getElementById('sisHalfSummary');
  if (hWrap) {
    hWrap.innerHTML =
      '<div style="background:var(--accent-light);border-radius:10px;padding:8px 10px"><div style="font-size:10px;color:var(--accent);font-weight:700">H1</div><div style="font-size:14px;font-weight:700">' + fmtMoney(sum.h1) + '</div></div>' +
      '<div style="background:var(--bg2);border-radius:10px;padding:8px 10px"><div style="font-size:10px;color:var(--text2);font-weight:700">H2</div><div style="font-size:14px;font-weight:700">' + fmtMoney(sum.h2) + '</div></div>';
  }
}

// เปิด Admin > แท็บทั่วไป > การ์ด H1/H2 Period Setting (ต้นทางจริงของช่วง H1/H2) — เผื่อ sale ต้องแก้ช่วงเอง
function sisGotoPeriodSource() {
  closeMForce();
  localStorage.setItem('v7_admin_tab', 'general');
  go('admin');
  setTimeout(function() {
    var anchor = document.getElementById('periodSettingCard');
    if (anchor) anchor.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 150);
}

function showEditSisRevenueModal(dealerId, year) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;
  var cfg = getConfig();
  var curYear = new Date().getFullYear();
  year = year ? parseInt(year) : curYear;
  var rev = getSisRevenueForYear(dealer, year);
  var half = sisComputeHalfMonths(cfg);

  var yearOpts = '';
  for (var y = curYear + 2; y >= curYear - 2; y--) {
    yearOpts += '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + (y > curYear ? ' (ปีถัดไป)' : '') + '</option>';
  }

  var monthCells = THAI_MONTHS_SHORT.map(function(mName, i) {
    var val = Number(rev.monthly[i + 1]) || 0;
    var isH1 = half.h1.indexOf(i) !== -1;
    var estimated = !rev.hasMonthly && val > 0;
    var qtrDivider = (i === 3 || i === 6 || i === 9) ? '<div style="grid-column:1/-1;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.03em;margin:2px 0;display:flex;align-items:center;gap:6px">Q' + (Math.floor(i / 3) + 1) + '<div style="flex:1;height:1px;background:var(--border)"></div></div>' : '';
    return qtrDivider +
      '<div style="border:1.5px solid ' + (isH1 ? 'var(--accent)' : 'var(--border)') + ';border-radius:9px;padding:6px 7px;position:relative">' +
      (estimated ? '<span style="font-size:8px;color:var(--text3);position:absolute;top:-6px;right:6px;background:var(--card);padding:0 3px">ประมาณ</span>' : '') +
      '<div style="font-size:10px;font-weight:700;color:var(--text2);margin-bottom:4px">' + (isH1 ? '🔵' : '🟠') + ' ' + mName + '</div>' +
      '<input type="text" inputmode="decimal" id="sisM' + (i + 1) + '" class="fm-input js-money' + (estimated ? ' sis-estimated' : '') + '" style="padding:5px 6px;font-size:12px" oninput="this.classList.remove(\'sis-estimated\');_sisRecalc()" value="' + nmI(val) + '" placeholder="0.00">' +
      '</div>';
  }).join('');

  var html = '<div style="max-width:460px">' +
    '<div class="fg"><label>📅 ปี</label>' +
    '<select id="sisYearSelect" class="fm-input" onchange="showEditSisRevenueModal(\'' + dealerId + '\', this.value)">' + yearOpts + '</select>' +
    '<div class="hint">💡 เลือกปีอื่นเพื่อกรอก/ดูยอดขาย SIS ของปีนั้นแยกกัน ไม่ทับปีปัจจุบัน — กรอกปีถัดไปล่วงหน้าได้เลย จะยังไม่โชว์ในหน้า Dealer จนกว่าจะถึงปีนั้น</div>' +
    '</div>' +
    '<div class="fg" style="margin-bottom:6px">' +
    '<span style="font-size:11px;font-weight:700;color:var(--accent)">🔵 H1 = ' + THAI_MONTHS_SHORT[half.h1[0]] + '–' + THAI_MONTHS_SHORT[half.h1[half.h1.length - 1]] + '</span>' +
    ' &nbsp; <span style="font-size:11px;font-weight:700;color:var(--text2)">🟠 H2 = ' + THAI_MONTHS_SHORT[half.h2[0]] + '–' + THAI_MONTHS_SHORT[half.h2[half.h2.length - 1]] + '</span>' +
    ' <a style="font-size:11px;color:var(--accent);cursor:pointer" onclick="sisGotoPeriodSource()">⚙️ แก้ช่วง (ต้นทาง)</a>' +
    '</div>' +
    '<div class="fg"><label>💰 ยอดขาย SIS — แยกรายเดือน (บาท)</label>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px">' + monthCells + '</div>' +
    '<div class="hint">🔵/🟠 กรอบสีบอกว่าเดือนนั้นอยู่ H1 หรือ H2 ตามช่วงที่ตั้งไว้จริง — ช่องที่ขึ้น "ประมาณ" คือค่าคำนวณเฉลี่ยจาก Quarter เดิม พิมพ์ทับด้วยตัวเลขจริงได้เลย</div>' +
    '</div>' +
    '<div class="fg"><label style="margin-bottom:6px">📊 รวมตาม Quarter ปฏิทิน <small style="color:var(--text2);font-weight:400">(คงที่ ม.ค.-มี.ค. ฯลฯ)</small></label>' +
    '<div id="sisQtrSummary" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px"></div></div>' +
    '<div class="fg"><label>💰 รวม H1 / H2 <small style="color:var(--text2)">= ตามช่วงที่ตั้งไว้จริง อัตโนมัติ</small></label>' +
    '<div id="sisHalfSummary" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div></div>' +
    '<div class="fg"><label>📝 หมายเหตุ (ถ้ามี)</label>' +
    '<textarea id="sisRevenueNote" rows="2" class="fm-input" placeholder="เช่น อัพเดทตามใบแจ้งหนี้ ประจำเดือน มิ.ย.">' + (rev.note ? sanitize(rev.note) : '') + '</textarea>' +
    '</div>' +
    '<div class="fm-actions">' +
    '<button class="btn bp" onclick="saveSisRevenue(\'' + dealerId + '\', ' + year + ')">💾 บันทึก</button>' +
    '<button class="btn" onclick="closeM()">ยกเลิก</button>' +
    '</div></div>';

  openM('💰 แก้ไขยอดขาย SIS', html);
  _sisRecalc();
}

function saveSisRevenue(dealerId, year) {
  year = String(year || new Date().getFullYear());
  var cfg = getConfig();
  var monthly = {};
  for (var i = 1; i <= 12; i++) {
    var el = document.getElementById('sisM' + i);
    monthly[i] = el ? parseNum(el.value) : 0;
  }
  var sum = sisSummarizeMonthly(monthly, cfg);
  var note = document.getElementById('sisRevenueNote') ? document.getElementById('sisRevenueNote').value.trim() : '';

  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;

  var oldRev = getSisRevenueForYear(dealer, year);
  var byYear = dealer.sisRevenueByYear || {};
  byYear[year] = { h1: sum.h1, h2: sum.h2, q1: sum.q1, q2: sum.q2, q3: sum.q3, q4: sum.q4, monthly: monthly, note: note || '', updatedAt: new Date().toISOString() };

  var updateData = { sisRevenueByYear: byYear };
  // ปีปัจจุบัน: อัปเดตฟิลด์เดิมด้วยเพื่อ backward-compat กับโค้ด/รายงานที่ยังอ่าน sisRevenue ตรง ๆ
  if (year === String(new Date().getFullYear())) {
    updateData.sisRevenue = sum.h1;
    updateData.sisRevenueH2 = sum.h2;
    updateData.sisRevenueUpdatedAt = new Date().toISOString();
    updateData.sisRevenueNote = note || 'อัพเดทยอดขาย SIS';
  }
  ST.update('dealers', dealerId, updateData);

  if (typeof addAuditLog === 'function') {
    addAuditLog('update_sis_revenue', 'dealer', dealerId, dealer.name || dealerId, dealerId, dealer.name || '', { year: year, oldValue: oldRev.h1, newValue: sum.h1, oldValueH2: oldRev.h2, newValueH2: sum.h2, note: note });
  }

  closeMForce();
  toast('💾 บันทึกยอดขาย SIS แล้ว');
  render();
}

// ================================================================
// SIS REVENUE IMPORT/EXPORT — อ่านไฟล์ Excel "Total_Sales_By_Drone" (template จริงที่ทีมใช้อยู่แล้ว)
// คอลัมน์: Customer Code | Customer Name | Month(Billing Date) | Total Sales | Total Adj Profit
// หาแถวหัวตารางเอง (ค้นคำว่า "Customer Code") แล้วเริ่มอ่านข้อมูลแถวถัดไป — ไม่ผูกกับเลขแถวตายตัว
// เผื่อไฟล์แต่ละรุ่น/แต่ละคนวางหัวตารางไว้คนละแถวกัน (ที่มา: เจอไฟล์จริงหัวตารางอยู่ A6 ไม่ใช่ A5 ตามที่กะไว้แรก)
// จับคู่บริษัทด้วย Customer Code = SIS Code เท่านั้น (ชื่อในไฟล์เป็นภาษาไทย สะกด/เว้นวรรคไม่ตรงกับระบบได้ง่าย
// ไม่เดาจากชื่อ) แถวที่จับคู่ไม่ได้ให้เลือกเอง/สร้างใหม่/ข้ามได้ทีละบริษัทในหน้า preview ก่อน import จริง
// ================================================================
var SIS_IMPORT_HEADER_SCAN_ROWS = 20; // ค้นหาแถวหัวตารางในกี่แถวแรกของไฟล์ ก่อนจะยอมแพ้แล้ว fallback
var _sisImportGroups = null; // array ของ {code,name,monthly:{'YYYY-MM':amt},totalSales,totalAdjProfit,matchedDealerId,skip}

// หาแถวที่มีคำว่า "Customer Code" อยู่ในคอลัมน์ไหนก็ได้ของแถวนั้น (case-insensitive) คืน index (0-based) หรือ -1 ถ้าไม่เจอ
function _sisFindHeaderRowIdx(rows) {
  var limit = Math.min(rows.length, SIS_IMPORT_HEADER_SCAN_ROWS);
  for (var i = 0; i < limit; i++) {
    var row = rows[i] || [];
    for (var c = 0; c < row.length; c++) {
      if (String(row[c] || '').trim().toLowerCase() === 'customer code') return i;
    }
  }
  return -1;
}

function importSisRevenueXlsx() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: 'binary', cellDates: true });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        rows = rows.map(function(r) { return r.map(_pipeXlsxCellToStr); });
        var headerIdx = _sisFindHeaderRowIdx(rows);
        if (headerIdx === -1) { toast('❌ หาแถวหัวตาราง "Customer Code" ไม่เจอในไฟล์นี้ — เช็คว่าเป็นไฟล์ template เดียวกันไหม'); return; }
        var dataRows = rows.slice(headerIdx + 1);
        _sisImportGroups = _sisParseImportRows(dataRows);
        _sisImportScrollTop = 0;
        if (!_sisImportGroups.length) { toast('⚠️ ไม่พบข้อมูลหลังแถวหัวตาราง (แถวที่ ' + (headerIdx + 1) + ')'); return; }
        _showSisImportPreviewM();
      } catch (err) {
        toast('❌ อ่านไฟล์ไม่ได้: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };
  input.click();
}

// group แถวดิบเป็นต่อบริษัท (key = Customer Code ถ้ามี ไม่งั้น fallback ไปชื่อ เพื่อไม่ทิ้งแถวที่ไม่มี Code)
// พร้อมจับคู่ SIS Code กับ dealer ที่มีอยู่แล้วทันที
function _sisParseImportRows(dataRows) {
  var dealers = ST.getAll('dealers');
  var bySisCode = {};
  dealers.forEach(function(d) { var c = (d.sisCode || '').trim().toLowerCase(); if (c) bySisCode[c] = d; });

  var groups = {}, order = [];
  dataRows.forEach(function(r) {
    var code = (r[0] || '').trim();
    var name = (r[1] || '').trim();
    var monthRaw = (r[2] || '').trim();
    var totalSales = parseNum(r[3]);
    var totalAdjProfit = parseNum(r[4]);
    if (!code && !name) return; // แถวว่างสุดท้ายของไฟล์

    var monthKey = _sisParseMonthKey(monthRaw);
    var key = code ? ('C:' + code.toLowerCase()) : ('N:' + name.toLowerCase());
    if (!groups[key]) {
      groups[key] = { code: code, name: name, monthly: {}, totalSales: 0, totalAdjProfit: 0 };
      order.push(key);
    }
    if (monthKey) groups[key].monthly[monthKey] = (groups[key].monthly[monthKey] || 0) + totalSales;
    groups[key].totalSales += totalSales;
    groups[key].totalAdjProfit += totalAdjProfit;
  });

  return order.map(function(key) {
    var g = groups[key];
    var matched = g.code ? bySisCode[g.code.toLowerCase()] : null;
    g.matchedDealerId = matched ? matched.id : null;
    g.skip = false;
    return g;
  });
}

// "Month(Billing Date)" เป็นเซลล์วันที่จริงในไฟล์ต้นฉบับ (_pipeXlsxCellToStr แปลงเป็น YYYY-MM-DD ให้แล้ว) —
// ตัดเหลือ YYYY-MM เป็น key เดือน เผื่อไฟล์บางแถวเป็นข้อความอื่นที่ Date parse ได้ก็รองรับไว้ด้วย
function _sisParseMonthKey(raw) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
  var d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  return null;
}

function _showSisImportPreviewM() {
  var groups = _sisImportGroups || [];
  var matchedCount = groups.filter(function(g) { return g.matchedDealerId && !g.skip; }).length;
  var pendingCount = groups.filter(function(g) { return !g.matchedDealerId && !g.skip; }).length;
  var totalSales = groups.reduce(function(s, g) { return s + g.totalSales; }, 0);

  var dealers = ST.getAll('dealers').slice().sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  var dealerOptions = '<option value="">— เลือกบริษัทที่มีอยู่ในระบบ —</option>' +
    dealers.map(function(d) { return '<option value="' + sanitize(d.id) + '">' + sanitize(d.name) + '</option>'; }).join('');

  var h = '<div style="max-width:560px">';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">' +
    '<div style="background:var(--bg2);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--good,#22c55e)">' + matchedCount + '</div><div style="font-size:9.5px;color:var(--text2)">จับคู่แล้ว</div></div>' +
    '<div style="background:var(--bg2);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800;color:' + (pendingCount ? 'var(--warn,#f59e0b)' : 'var(--text2)') + '">' + pendingCount + '</div><div style="font-size:9.5px;color:var(--text2)">ต้องเลือกเอง</div></div>' +
    '<div style="background:var(--bg2);border-radius:9px;padding:9px;text-align:center"><div style="font-size:14px;font-weight:800">฿' + fmtMoneyShort(totalSales) + '</div><div style="font-size:9.5px;color:var(--text2)">ยอดรวมในไฟล์</div></div>' +
    '</div>';

  h += '<div id="sisImportRowsList" style="display:flex;flex-direction:column;gap:10px;max-height:50vh;overflow-y:auto">';
  groups.forEach(function(g, i) {
    var months = Object.keys(g.monthly).sort();
    var monthsLabel = months.length ? (months.length + ' เดือน (' + months[0] + (months.length > 1 ? ' – ' + months[months.length - 1] : '') + ')') : 'ไม่พบเดือนที่อ่านได้';
    h += '<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px' + (g.skip ? ';opacity:.5' : '') + '">';
    h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">';
    h += '<div style="flex:1;min-width:160px"><div style="font-size:10px;color:var(--text3);font-family:monospace">' + sanitize(g.code || '(ไม่มี Code)') + '</div><div style="font-size:13px;font-weight:700">' + sanitize(g.name) + '</div></div>';
    if (g.skip) {
      h += '<span style="font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--bg2);color:var(--text2)">⏭️ ข้าม</span>';
    } else if (g.matchedDealerId) {
      var md = ST.getOne('dealers', g.matchedDealerId);
      h += '<span style="font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(34,197,94,.12);color:var(--good,#22c55e)">✅ → ' + sanitize(md ? md.name : '?') + '</span>';
    } else {
      h += '<span style="font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(245,158,11,.12);color:var(--warn,#f59e0b)">⚠️ ต้องเลือกเอง</span>';
    }
    h += '</div>';
    h += '<div style="font-size:11px;color:var(--text2);margin-bottom:6px">' + monthsLabel + ' · รวม ฿' + fmtMoney(g.totalSales) + '</div>';
    if (g.code && g.matchedDealerId && !g.skip) {
      var mdForCode = ST.getOne('dealers', g.matchedDealerId);
      if (mdForCode && !mdForCode.sisCode) {
        h += '<div style="font-size:10.5px;color:var(--accent);margin-bottom:6px">💾 จะบันทึก Code "' + sanitize(g.code) + '" ลง SIS Code ของบริษัทนี้ด้วย (ยังไม่เคยมี Code มาก่อน)</div>';
      }
    }
    if (!g.skip) {
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';
      h += '<select style="flex:1;min-width:160px;font-size:12px" onchange="_sisImportSetDealer(' + i + ', this.value)">' + dealerOptions.replace('value="' + sanitize(g.matchedDealerId || '') + '"', 'value="' + sanitize(g.matchedDealerId || '') + '" selected') + '</select>';
      h += '<button class="btn bsm bo" onclick="_sisImportCreateDealer(' + i + ')">➕ สร้างใหม่</button>';
      h += '<button class="btn bsm bo" onclick="_sisImportSkip(' + i + ')">⏭️ ข้าม</button>';
      h += '</div>';
    } else {
      h += '<button class="btn bsm bo" onclick="_sisImportUnskip(' + i + ')">↩️ เอากลับมา</button>';
    }
    h += '</div>';
  });
  h += '</div>';

  h += '<div style="margin-top:12px;display:flex;gap:8px">';
  h += '<button class="btn bp" style="flex:1" onclick="_confirmSisImport()" ' + (matchedCount ? '' : 'disabled') + '>✅ ยืนยัน Import ' + matchedCount + ' บริษัท</button>';
  h += '<button class="btn bo" onclick="closeMForce()">ยกเลิก</button>';
  h += '</div>';
  h += '<div class="hint" style="margin-top:8px">💡 จับคู่ด้วย Customer Code = SIS Code เท่านั้น — บริษัทที่ยังไม่เลือกจะไม่ถูก import จนกว่าจะเลือกเอง สร้างใหม่ หรือกดข้าม</div>';
  h += '</div>';

  openM('📥 ตรวจสอบการจับคู่ก่อน Import (' + groups.length + ' บริษัท)', h);

  // rebuild ทั้งโมดัลทุกครั้งที่เลือก/ข้าม/สร้างใหม่ ทำให้ scroll ของรายการเด้งกลับบนสุด — จำตำแหน่งที่เลื่อนไว้
  // (เก็บผ่าน _sisImportScrollTop ก่อนหน้าเรียกฟังก์ชันนี้) แล้ว restore กลับให้หลัง render เสร็จ
  var listEl = document.getElementById('sisImportRowsList');
  if (listEl && _sisImportScrollTop) listEl.scrollTop = _sisImportScrollTop;
}
var _sisImportScrollTop = 0;
function _sisImportSaveScroll() {
  var listEl = document.getElementById('sisImportRowsList');
  _sisImportScrollTop = listEl ? listEl.scrollTop : 0;
}

function _sisImportSetDealer(idx, dealerId) {
  if (!_sisImportGroups || !_sisImportGroups[idx]) return;
  _sisImportSaveScroll();
  _sisImportGroups[idx].matchedDealerId = dealerId || null;
  _showSisImportPreviewM();
}
function _sisImportCreateDealer(idx) {
  var g = _sisImportGroups && _sisImportGroups[idx];
  if (!g) return;
  _sisImportSaveScroll();
  var created = ST.add('dealers', { name: g.name, sisCode: g.code || '' });
  g.matchedDealerId = created.id;
  toast('➕ สร้าง Dealer "' + g.name + '" แล้ว');
  _showSisImportPreviewM();
}
function _sisImportSkip(idx) {
  if (!_sisImportGroups || !_sisImportGroups[idx]) return;
  _sisImportSaveScroll();
  _sisImportGroups[idx].skip = true;
  _showSisImportPreviewM();
}
function _sisImportUnskip(idx) {
  if (!_sisImportGroups || !_sisImportGroups[idx]) return;
  _sisImportSaveScroll();
  _sisImportGroups[idx].skip = false;
  _showSisImportPreviewM();
}

// เขียนยอดรายเดือนที่ import เข้า sisRevenueByYear จริง — ทับเฉพาะเดือนที่มีอยู่ในไฟล์ (เดือนอื่นที่เคยกรอกไว้
// ไม่โดนแตะ) แล้วคำนวณ Q1-4/H1-2 ใหม่ด้วย sisSummarizeMonthly เดียวกับหน้าแก้ยอดขาย SIS ปกติ
function _confirmSisImport() {
  var groups = (_sisImportGroups || []).filter(function(g) { return g.matchedDealerId && !g.skip; });
  if (!groups.length) return toast('ยังไม่มีบริษัทที่จับคู่พร้อม import');
  var cfg = getConfig();
  var dealerCount = 0, monthCount = 0, codeCount = 0;

  groups.forEach(function(g) {
    var dealer = ST.getOne('dealers', g.matchedDealerId);
    if (!dealer) return;
    var monthsByYear = {};
    Object.keys(g.monthly).forEach(function(mk) {
      var year = mk.slice(0, 4), month = parseInt(mk.slice(5, 7), 10);
      if (!monthsByYear[year]) monthsByYear[year] = {};
      monthsByYear[year][month] = g.monthly[mk];
      monthCount++;
    });
    var byYear = dealer.sisRevenueByYear || {};
    Object.keys(monthsByYear).forEach(function(year) {
      var existing = getSisRevenueForYear(dealer, year);
      var monthly = {};
      for (var i = 1; i <= 12; i++) monthly[i] = existing.monthly[i] || 0;
      Object.keys(monthsByYear[year]).forEach(function(m) { monthly[m] = monthsByYear[year][m]; });
      var sum = sisSummarizeMonthly(monthly, cfg);
      byYear[year] = { h1: sum.h1, h2: sum.h2, q1: sum.q1, q2: sum.q2, q3: sum.q3, q4: sum.q4, monthly: monthly, note: 'Import จาก Excel', updatedAt: new Date().toISOString() };
    });
    var updateData = { sisRevenueByYear: byYear };
    var curYear = String(new Date().getFullYear());
    if (byYear[curYear]) { updateData.sisRevenue = byYear[curYear].h1; updateData.sisRevenueH2 = byYear[curYear].h2; }
    // เลือก Dealer เองให้กับบริษัทที่ไม่เคยมี SIS Code (หรือ Code ไม่ตรง) — บันทึก Customer Code จากไฟล์
    // ลง sisCode ให้เลย เฉพาะกรณี dealer ยังไม่เคยมี Code อยู่ก่อน (กันทับ Code เดิมที่อาจตั้งใจตั้งไว้ต่างออกไป)
    if (g.code && !dealer.sisCode) { updateData.sisCode = g.code; codeCount++; }
    ST.update('dealers', dealer.id, updateData);
    dealerCount++;
  });

  _sisImportGroups = null;
  closeMForce();
  toast('✅ Import สำเร็จ ' + dealerCount + ' บริษัท (' + monthCount + ' เดือน)' + (codeCount ? ' · บันทึก SIS Code ให้ ' + codeCount + ' บริษัท' : ''));
  render();
}

// ================================================================
// EXPORT — ย้อนกลับเป็น template เดียวกัน (Customer Code/Name/Month/Total Sales) จากข้อมูลที่มีในระบบทั้งหมด
// ================================================================
function exportSisRevenueXlsx() {
  var dealers = ST.getAll('dealers');
  var rows = [];
  dealers.forEach(function(d) {
    if (!d.sisRevenueByYear) return;
    Object.keys(d.sisRevenueByYear).sort().forEach(function(year) {
      var rev = getSisRevenueForYear(d, year);
      for (var m = 1; m <= 12; m++) {
        var val = Number(rev.monthly[m]) || 0;
        if (!val) continue;
        rows.push([d.sisCode || '', d.name || '', year + '-' + String(m).padStart(2, '0') + '-01', val, '']);
      }
    });
  });
  if (!rows.length) return toast('ไม่มีข้อมูลยอดขาย SIS ให้ export');

  // หัวตารางวางไว้ที่ A6 ให้ตรงกับ template จริงที่ทีมใช้อยู่ (5 แถวว่างด้านบน + หัวตารางแถว 6 + ข้อมูลแถว 7 เป็นต้นไป)
  var aoa = [[], [], [], [], [], ['Customer Code', 'Customer Name', 'Month(Billing Date)', 'Total Sales', 'Total Adj Profit']].concat(rows);
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SIS Revenue');
  XLSX.writeFile(wb, 'sis-revenue-export-' + _td() + '.xlsx');
  toast('📤 Export ยอดขาย SIS แล้ว (' + rows.length + ' แถว)');
}

// ================================================================
// SALES REP DASHBOARD — รวมยอด Dealer แต่ละคนเข้าเป็นภาพรวมรายเซล (จัดกลุ่มตาม d.saleName เดียวกับตัวกรอง
// "เซลที่ดูแล" ในหน้า Dealers) เป้า = targetH1/targetH2 ที่ตั้งไว้ต่อ Dealer, ยอดจริง = ยอดขาย SIS ปีปัจจุบัน
// (H1+H2 จาก getSisRevenueForYear — ตัวเดียวกับที่โชว์ในหน้า Dealer), Weighted Pipeline = จาก
// mondayCompanyStats (POS-ถ่วงน้ำหนัก) ให้เห็นทั้งผลงานจริงและแนวโน้มที่กำลังจะมาในหน้าเดียว
// ================================================================
function rSalesRepDashboard(el) {
  document.getElementById('pgT').textContent = '👤 Dashboard รายเซล';
  var dealers = ST.getAll('dealers');
  var curYear = new Date().getFullYear();
  var cfg = getConfig();
  var repsMap = {};
  dealers.forEach(function(d) {
    var name = d.saleName || DEALER_SALE_UNSET;
    if (!repsMap[name]) repsMap[name] = { name: name, dealers: [], targetH1: 0, targetH2: 0, sisH1: 0, sisH2: 0, sisQ1: 0, sisQ2: 0, sisQ3: 0, sisQ4: 0, wonAmt: 0, weightedOpen: 0, openTotal: 0, activeCount: 0 };
    var r = repsMap[name];
    r.dealers.push(d);
    var tgt = getTargetForYear(d, curYear);
    r.targetH1 += tgt.h1;
    r.targetH2 += tgt.h2;
    var sis = getSisRevenueForYear(d, curYear);
    r.sisH1 += sis.h1 || 0;
    r.sisH2 += sis.h2 || 0;
    r.sisQ1 += sis.q1 || 0; r.sisQ2 += sis.q2 || 0; r.sisQ3 += sis.q3 || 0; r.sisQ4 += sis.q4 || 0;
    var s = mondayCompanyStats(d.id, cfg);
    r.wonAmt += (s.wonH1Project + s.wonH2Project);
    r.weightedOpen += s.openPipelineWeighted;
    r.openTotal += s.openPipelineTotal;
    r.activeCount += s.activePipes.length;
  });
  var reps = Object.keys(repsMap).map(function(k) { return repsMap[k]; });
  reps.sort(function(a, b) { return (b.sisH1 + b.sisH2) - (a.sisH1 + a.sisH2); });

  var totalTarget = reps.reduce(function(s, r) { return s + r.targetH1 + r.targetH2; }, 0);
  var totalActual = reps.reduce(function(s, r) { return s + r.sisH1 + r.sisH2; }, 0);
  var totalWeighted = reps.reduce(function(s, r) { return s + r.weightedOpen; }, 0);
  var totalPct = totalTarget ? Math.round(totalActual / totalTarget * 100) : 0;

  var h = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '';
  h += '<div class="pg-head"><h2 style="margin:0">👤 Dashboard รายเซล</h2><div style="font-size:12px;color:var(--text2)">รวมยอด Dealer ตามเซลที่ดูแล — ยอดจริง = ยอดขาย SIS ปี ' + curYear + '</div>' +
    '<button class="btn bo" onclick="go(\'dealerRiskRadar\')" title="Dealer ที่ pace ไม่ทันเป้าครึ่งปีนี้ เรียงตามความเสี่ยง">🛰️ Dealer เสี่ยงหลุดเป้า</button></div>';
  h += '<div class="sr" style="margin-bottom:14px">' +
    '<div class="sc"><div class="sn c1">' + reps.length + '</div><div class="sl">เซล</div></div>' +
    '<div class="sc"><div class="sn c2">฿' + fmtMoneyShort(totalActual) + '</div><div class="sl">ยอดขาย SIS รวม</div></div>' +
    '<div class="sc"><div class="sn c3">฿' + fmtMoneyShort(totalTarget) + '</div><div class="sl">เป้ารวม</div></div>' +
    '<div class="sc"><div class="sn" style="color:' + (totalPct >= 70 ? 'var(--good,#22c55e)' : totalPct >= 40 ? 'var(--warn,#f59e0b)' : 'var(--bad,#ef4444)') + '">' + totalPct + '%</div><div class="sl">Achieve รวม</div></div>' +
    '<div class="sc"><div class="sn" style="color:var(--accent)">฿' + fmtMoneyShort(totalWeighted) + '</div><div class="sl">Weighted Pipeline</div></div>' +
    '</div>';

  h += '<div class="card"><h2>รายชื่อเซล</h2>';
  reps.forEach(function(r) {
    var target = r.targetH1 + r.targetH2;
    var actual = r.sisH1 + r.sisH2;
    var pct = target ? Math.round(actual / target * 100) : null;
    var pctColor = pct === null ? 'var(--text3)' : pct >= 70 ? 'var(--good,#22c55e)' : pct >= 40 ? 'var(--warn,#f59e0b)' : 'var(--bad,#ef4444)';
    var initials = (r.name || '').trim().split(/\s+/).slice(0, 2).map(function(w) { return w.charAt(0); }).join('').toUpperCase() || '?';
    h += '<div class="li" style="cursor:pointer;display:flex;align-items:center;gap:10px" onclick="clearDealerSaleFilter();toggleDealerSaleFilter(\'' + sanitize(r.name).replace(/'/g, "\\'") + '\');go(\'dealers\')">' +
      '<div style="width:34px;height:34px;border-radius:50%;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:var(--accent);flex-shrink:0">' + sanitize(initials) + '</div>' +
      '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(r.name) + '</div>' +
      '<div style="font-size:11px;color:var(--text2)">' + r.dealers.length + ' Dealer · ' + r.activeCount + ' โครงการเปิดอยู่ · Weighted ฿' + fmtMoneyShort(r.weightedOpen) + '</div>' +
      '<div style="font-size:10.5px;color:var(--text3);margin-top:2px">Q1 ' + fmtMoneyShort(r.sisQ1) + ' · Q2 ' + fmtMoneyShort(r.sisQ2) + ' · Q3 ' + fmtMoneyShort(r.sisQ3) + ' · Q4 ' + fmtMoneyShort(r.sisQ4) + '</div></div>' +
      '<div style="text-align:right;flex-shrink:0"><div style="font-weight:700;font-size:13px">฿' + fmtMoneyShort(actual) + (target ? ' / ฿' + fmtMoneyShort(target) : '') + '</div>' +
      '<div style="font-size:11px;font-weight:700;color:' + pctColor + '">' + (pct === null ? 'ยังไม่ตั้งเป้า' : pct + '%') + '</div></div>' +
      '</div>';
  });
  if (!reps.length) h += '<div class="empty"><p>ยังไม่มี Dealer</p></div>';
  h += '</div>';

  el.innerHTML = h;
}

// ================================================================
// 🛰️ DEALER RISK RADAR — Dealer เสี่ยงหลุดเป้ายอดขายครึ่งปีปัจจุบัน (ดู dealerPeriodRisk ใน utils.js)
// เรียงตามความเสี่ยงมากไปน้อย ให้เห็นว่าควรโฟกัสตัวไหนก่อน ไม่ใช่แค่ไล่ตามลำดับ Achieve% ต่ำสุด
// ================================================================
function rDealerRiskRadar(el) {
  document.getElementById('pgT').textContent = '🛰️ Dealer เสี่ยงหลุดเป้า';
  var cfg = getConfig();
  var dealers = ST.getAll('dealers');
  var risks = dealers.map(function(d) { return dealerPeriodRisk(d.id, cfg); }).filter(function(r) { return r && r.level !== 'none'; });

  var critical = risks.filter(function(r) { return r.level === 'critical'; });
  var watch = risks.filter(function(r) { return r.level === 'watch'; });
  var safe = risks.filter(function(r) { return r.level === 'safe'; });
  var totalGap = critical.concat(watch).reduce(function(s, r) { return s + r.gap; }, 0);

  var order = { critical: 0, watch: 1, safe: 2 };
  risks.sort(function(a, b) {
    if (order[a.level] !== order[b.level]) return order[a.level] - order[b.level];
    return b.gap - a.gap;
  });

  var half = risks.length ? risks[0].half : (sisComputeHalfMonths(cfg).h1.indexOf(new Date().getMonth()) !== -1 ? 'H1' : 'H2');

  var h = navHistory.length ? '<div class="bc"><a class="back-btn" onclick="goBack()"><span class="ic">←</span> กลับ</a></div>' : '';
  h += '<div class="pg-head"><h2 style="margin:0">🛰️ Dealer เสี่ยงหลุดเป้า (' + half + ')</h2><div style="font-size:12px;color:var(--text2)">เทียบ pace ที่ต้องเร่งในวันที่เหลือของงวดนี้ กับ pace เฉลี่ยที่ Dealer เคยทำได้จริง — ไม่ใช่แค่ Achieve% นิ่งๆ ที่ไม่รู้จักเวลา</div></div>';
  h += '<div class="sr" style="margin-bottom:14px">' +
    '<div class="sc"><div class="sn" style="color:#ef4444">' + critical.length + '</div><div class="sl">🔴 เสี่ยงสูง</div></div>' +
    '<div class="sc"><div class="sn" style="color:#f59e0b">' + watch.length + '</div><div class="sl">🟡 ต้องเร่ง</div></div>' +
    '<div class="sc"><div class="sn" style="color:#22c55e">' + safe.length + '</div><div class="sl">🟢 ตามทัน</div></div>' +
    '<div class="sc"><div class="sn">' + fmtMoneyShort(totalGap) + '</div><div class="sl">มูลค่าที่ขาดรวม (เสี่ยงสูง+ต้องเร่ง)</div></div>' +
    '</div>';

  if (!risks.length) {
    h += '<div class="empty"><p>ยังไม่มี Dealer ที่ตั้งเป้า H1/H2 ไว้เลย 🎉</p></div>';
  } else {
    h += '<div class="card"><h2>เรียงตามความเสี่ยง (สูง → ต่ำ)</h2>';
    risks.forEach(function(r) {
      var badge = r.level === 'critical' ? '<span style="color:#ef4444;font-weight:700;font-size:11px;white-space:nowrap">🔴 เสี่ยงสูง</span>'
        : r.level === 'watch' ? '<span style="color:#f59e0b;font-weight:700;font-size:11px;white-space:nowrap">🟡 ต้องเร่ง</span>'
        : '<span style="color:#22c55e;font-weight:700;font-size:11px;white-space:nowrap">🟢 ตามทัน</span>';
      var paceTxt = r.gap <= 0 ? 'ครอบคลุมด้วย Pipeline แล้ว'
        : r.daysRemaining <= 0 ? 'หมดเวลาของงวดแล้ว'
        : r.paceMultiplier === Infinity ? 'ยังไม่เคยปิดยอดเลยในงวดนี้'
        : ('ต้องเร่ง ' + r.paceMultiplier.toFixed(1) + '× ของ pace เดิม');
      h += '<div class="li" style="display:block;cursor:pointer" onclick="go(\'dealerDetail\',{id:\'' + r.dealer.id + '\'})">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">';
      h += '<div class="lt" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(r.dealer.name) + '</div>' + badge;
      h += '</div>';
      h += '<div class="ls" style="margin-top:3px">เป้า ' + r.half + ': ฿' + fmtMoneyShort(r.target) + ' · ทำได้+Weighted Pipeline: ฿' + fmtMoneyShort(r.projected) + ' · ขาด: ฿' + fmtMoneyShort(r.gap) + '</div>';
      h += '<div class="ls" style="color:var(--text2)">เหลือ ' + r.daysRemaining + ' วัน · ' + paceTxt + '</div>';
      h += '</div>';
    });
    h += '</div>';
  }

  el.innerHTML = h;
}

// ================================================================
// PART: CUSTOM DEMO REQUIREMENTS
// ================================================================

function toggleCustomDemoReq() {
  var chk = document.getElementById('useCustomDemoReq');
  var panel = document.getElementById('customDemoReqPanel');
  if (panel) panel.style.display = chk && chk.checked ? 'block' : 'none';
}

function addCustomOption1Model() {
  var input = document.getElementById('customOpt1NewModel');
  var model = input ? input.value.trim() : '';
  if (!model) return;
  _demoAddReqChip('customOption1List', model, 1);
  _demoSyncRowCheckbox(model, 1, true);
  input.value = '';
}

function addCustomOption2Model() {
  var input = document.getElementById('customOpt2NewModel');
  var model = input ? input.value.trim() : '';
  if (!model) return;
  _demoAddReqChip('customOption2List', model, 2);
  _demoSyncRowCheckbox(model, 2, true);
  input.value = '';
}

// เพิ่ม chip "รุ่นที่ต้องมี" โดยกันซ้ำ — ใช้ทั้งตอนพิมพ์เพิ่มเองและตอนติ๊ก checkbox ต้องมี ที่แถวอุปกรณ์
function _demoAddReqChip(containerId, model, optNum) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var chips = container.querySelectorAll('.tag');
  for (var i = 0; i < chips.length; i++) {
    if (chips[i].textContent.replace('✕', '').trim() === model) return; // มีอยู่แล้ว
  }
  var span = document.createElement('span');
  span.className = 'tag tag-count';
  span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 8px;margin:2px';
  span.innerHTML = sanitize(model) + '<button class="btn-xs" style="padding:0 4px;margin-left:4px" onclick="_demoRemoveReqChip(this,' + optNum + ')">✕</button>';
  container.appendChild(span);
}

// ลบ chip ออก + เอา checkbox "ต้องมี" ที่แถวอุปกรณ์ตัวเดียวกัน (ถ้ามี) ออกด้วย กันสถานะไม่ตรงกัน
function _demoRemoveReqChip(btn, optNum) {
  var span = btn.parentElement;
  if (!span) return;
  var model = span.textContent.replace('✕', '').trim();
  span.remove();
  _demoSyncRowCheckbox(model, optNum, false);
}

// ติ๊ก/เอาติ๊กออกจาก checkbox "ต้องมี" ที่แถวอุปกรณ์ตัวที่ชื่อรุ่นตรงกับ model — ให้ chip กับ checkbox
// ตรงกันเสมอไม่ว่าจะแก้จากฝั่งไหน (พิมพ์ในกล่อง หรือ ติ๊กที่แถว)
function _demoSyncRowCheckbox(model, optNum, checked) {
  var rows = document.querySelectorAll('#demoItemsList .demo-item-row');
  for (var i = 0; i < rows.length; i++) {
    var modelInput = rows[i].querySelector('.demo-model');
    if (modelInput && modelInput.value === model) {
      var chk = rows[i].querySelector('.demo-req-opt' + optNum);
      if (chk) chk.checked = checked;
    }
  }
}

// ติ๊ก/เอาติ๊กออกที่แถวอุปกรณ์ — sync กลับไปที่ chip list ของเกณฑ์ที่ต้องมี
function _demoRowReqToggle(chk, optNum) {
  var row = chk.closest('.demo-item-row');
  var modelInput = row ? row.querySelector('.demo-model') : null;
  var model = modelInput ? modelInput.value.trim() : '';
  if (!model) { chk.checked = false; toast('⚠️ กรุณากรอกชื่อสินค้าก่อน'); return; }
  var containerId = optNum === 1 ? 'customOption1List' : 'customOption2List';
  if (chk.checked) {
    _demoAddReqChip(containerId, model, optNum);
  } else {
    var container = document.getElementById(containerId);
    if (container) {
      var chips = container.querySelectorAll('.tag');
      for (var i = 0; i < chips.length; i++) {
        if (chips[i].textContent.replace('✕', '').trim() === model) { chips[i].remove(); break; }
      }
    }
  }
}

// รีเซ็ตรายการที่ต้องมีกลับไปตาม default ของ Level (ไม่บันทึกทันที — กด "บันทึก" อีกทีถึงจะมีผล)
function resetDemoReqToLevelDefault(level) {
  var cfg = getConfig();
  var defaultReq = (cfg?.levelRequirements?.[level]) || cfg?.levelRequirements?.B || { option1Models: [], option2Models: [] };
  function chipsHtml(models) {
    return (models || []).map(function(m) {
      return '<span class="tag tag-count" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;margin:2px">' + sanitize(m) + '<button class="btn-xs" style="padding:0 4px;margin-left:4px" onclick="this.parentElement.remove()">✕</button></span>';
    }).join('');
  }
  var c1 = document.getElementById('customOption1List');
  var c2 = document.getElementById('customOption2List');
  if (c1) c1.innerHTML = chipsHtml(defaultReq.option1Models);
  if (c2) c2.innerHTML = chipsHtml(defaultReq.option2Models);
  toast('↺ รีเซ็ตเป็นค่าเริ่มต้นของ Level แล้ว — กด "บันทึก" เพื่อยืนยัน');
}

// ป้ายสถานะครบ/ไม่ครบ บนสุดของ tab — คำนวณจากข้อมูลที่บันทึกไว้ล่าสุด (ตรรกะเดียวกับ client-view)
function _dealerDemoStatusBadgeHtml(dealer) {
  var demoOption = dealer.demoOption || 'none';
  var demoItems = (dealer.demoItems && Array.isArray(dealer.demoItems)) ? dealer.demoItems : [];
  var level = dealer.level || 'Other';
  var cfg = getConfig();
  var levelReq = (cfg?.levelRequirements?.[level]) || cfg?.levelRequirements?.B || { option1Models: [], option2Models: [] };
  var customReq = dealer.customDemoRequirements || {};
  var useCustom = customReq.enabled === true;
  var requiredOption1 = useCustom ? (customReq.option1Models || levelReq.option1Models || []) : (levelReq.option1Models || []);
  var requiredOption2 = useCustom ? (customReq.option2Models || levelReq.option2Models || []) : (levelReq.option2Models || []);

  var ownedModels = {};
  demoItems.forEach(function(it) { if (it && it.model) ownedModels[it.model] = true; });

  var requiredModels = demoOption === 'option1' ? requiredOption1 : demoOption === 'option2' ? requiredOption2 :
    demoOption === 'both' ? requiredOption1.concat(requiredOption2) : [];
  var missing = requiredModels.filter(function(m) { return !ownedModels[m]; });
  var isOk = demoOption === 'none' || missing.length === 0;

  if (demoOption === 'none') return '';
  return '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg2);border-radius:10px;padding:10px 14px;margin-bottom:14px;border-left:3px solid ' + (isOk ? '#22c55e' : '#ef4444') + '">' +
    '<span style="font-size:13px;color:var(--text2)">สถานะ Demo Unit ปัจจุบัน</span>' +
    '<span class="tag ' + (isOk ? 'tag-completed' : 'tag-cancelled') + '" style="font-size:13px;padding:3px 10px">' + (isOk ? '✅ ครบถ้วน' : '🔴 ไม่ครบ · ขาด ' + missing.length + ' รายการ') + '</span>' +
    '</div>';
}

// พรีวิวหน้าตาที่ลูกค้าจะเห็นใน client-view — อ่านจากฟอร์มปัจจุบัน (ยังไม่ต้องกดบันทึกก่อนก็ดูได้)
function showDemoClientPreviewM(dealerId) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;

  var demoOptionElem = document.querySelector('input[name="demoOption"]:checked');
  var demoOption = demoOptionElem ? demoOptionElem.value : (dealer.demoOption || 'none');

  var demoItems = [];
  var rows = document.querySelectorAll('#demoItemsList .demo-item-row');
  for (var i = 0; i < rows.length; i++) {
    var modelInput = rows[i].querySelector('.demo-model');
    var snInput = rows[i].querySelector('.demo-sn');
    if (modelInput && modelInput.value) demoItems.push({ model: modelInput.value, serialNumber: snInput ? snInput.value.trim() : '' });
  }

  var uiReq = getCustomDemoRequirementsFromUI();
  var html = '<div style="max-width:480px">' +
    '<div class="hint" style="margin-bottom:10px">👁 พรีวิวจากข้อมูลในฟอร์มตอนนี้ (ยังไม่ได้บันทึก) — หน้าตานี้จะไปแสดงในหน้า client-view ของ Dealer นี้</div>' +
    _dealerDemoClientPreviewHtml(demoOption, demoItems, uiReq.option1Models, uiReq.option2Models) +
    '</div>';
  openM('👁 Preview client-view', html);
}

function _dealerDemoClientPreviewHtml(demoOption, demoItems, requiredOption1, requiredOption2) {
  var ownedModels = {}, ownedDetails = {};
  demoItems.forEach(function(it) { if (it && it.model) { ownedModels[it.model] = true; ownedDetails[it.model] = it; } });

  var optionText = { none: 'ไม่มีข้อกำหนด', option1: 'Option 1 (Drone + Payload)', option2: 'Option 2 (Dock + Drone)', both: 'Both Options' };
  var requiredModels = demoOption === 'option1' ? requiredOption1 : demoOption === 'option2' ? requiredOption2 :
    demoOption === 'both' ? requiredOption1.concat(requiredOption2) : [];
  var missing = requiredModels.filter(function(m) { return !ownedModels[m]; });
  var isOk = demoOption === 'none' || missing.length === 0;

  var html = '<div style="background:#12151c;border-radius:12px;border-left:4px solid ' + (isOk ? '#22c55e' : '#ef4444') + ';padding:16px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #3b82f6;padding-bottom:8px;margin-bottom:12px">';
  html += '<div><p style="font-weight:500;font-size:15px;margin:0;color:#f3f4f6">Demo unit requirement</p>' +
    '<p style="font-size:12px;color:#9ca3af;margin:2px 0 0">' + sanitize(optionText[demoOption] || demoOption) + '</p></div>';
  html += '<span style="background:' + (isOk ? '#0f2e1c' : '#3b0d0d') + ';color:' + (isOk ? '#86efac' : '#fca5a5') + ';font-size:13px;padding:4px 12px;border-radius:6px">' + (demoOption === 'none' ? 'ไม่มีข้อกำหนด' : (isOk ? 'ครบถ้วน' : 'ไม่ครบ')) + '</span>';
  html += '</div>';

  if (demoOption !== 'none') {
    if (requiredModels.length) {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">';
      requiredModels.forEach(function(model) {
        var owned = ownedModels[model];
        var detail = ownedDetails[model];
        html += '<div style="padding:10px;border-radius:10px;background:' + (owned ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') + ';border:1px solid ' + (owned ? '#22c55e' : '#ef4444') + '">';
        html += '<p style="font-size:13px;margin:0;color:#e5e7eb">' + (owned ? '✅' : '❌') + ' ' + sanitize(model) + '</p>';
        if (owned && detail && detail.serialNumber) {
          html += '<p style="font-size:11px;color:#9ca3af;margin:6px 0 0;padding-top:4px;border-top:1px solid rgba(255,255,255,0.08)">Serial number: <span style="color:#60a5fa">' + sanitize(detail.serialNumber) + '</span></p>';
        }
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="font-size:13px;color:#9ca3af">ไม่มีการกำหนดรุ่นที่ต้องมีสำหรับ Option นี้</div>';
    }
    if (missing.length) {
      html += '<div style="margin-top:12px;padding:10px;background:rgba(239,68,68,0.1);border-radius:8px;border-left:3px solid #ef4444">' +
        '<p style="font-size:13px;margin:0;color:#fca5a5"><span style="font-weight:500">ขาดอุปกรณ์:</span> ' + missing.map(sanitize).join(', ') + '</p></div>';
    }
  }
  html += '</div>';
  return html;
}

function getCustomDemoRequirementsFromUI() {
  var option1Models = [];
  var option1Container = document.getElementById('customOption1List');
  if (option1Container) {
    var items = option1Container.querySelectorAll('.tag');
    for (var i = 0; i < items.length; i++) {
      var text = items[i].textContent.replace('✕', '').trim();
      if (text) option1Models.push(text);
    }
  }
  
  var option2Models = [];
  var option2Container = document.getElementById('customOption2List');
  if (option2Container) {
    var items = option2Container.querySelectorAll('.tag');
    for (var i = 0; i < items.length; i++) {
      var text = items[i].textContent.replace('✕', '').trim();
      if (text) option2Models.push(text);
    }
  }
  
  return { option1Models: option1Models, option2Models: option2Models };
}
// ✅ ฟังก์ชัน sync ข้อมูล Dealer ไป Firebase (ให้ client-view ดึงไปใช้)
async function syncDealerToFirebase(dealerId) {
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    console.warn('No user logged in, cannot sync');
    return false;
  }
  
  const dealer = ST.getOne('dealers', dealerId);
  if (!dealer) {
    console.warn('Dealer not found:', dealerId);
    return false;
  }
  
  try {
    // ✅ เพิ่มข้อมูล Demo และ DSEC
    const syncData = {
      name: dealer.name,
      level: dealer.level,
      djiDealer: dealer.djiDealer || '',
      
      // ✅ DSEC (เพิ่ม)
      dsecCertCount: Number(dealer.dsecCertCount) || 0,
      dsecStatus: dealer.dsecStatus || '',
      crmStatus: dealer.crmStatus || '',
      fh2Status: dealer.fh2Status || '',
      larkStatus: dealer.larkStatus || '',
      
      // ✅ Demo (เพิ่ม)
      demoOption: dealer.demoOption || 'none',
      demoItems: dealer.demoItems || [],
      
      // ✅ SIS Revenue
      sisRevenue: Number(dealer.sisRevenue) || 0,
      sisRevenueH2: Number(dealer.sisRevenueH2) || 0,
      sisRevenueByYear: dealer.sisRevenueByYear || {},
      h1UseSisRevenue: dealer.h1UseSisRevenue === true,
      
      // ✅ Custom Demo Requirements
      customDemoRequirements: dealer.customDemoRequirements || { enabled: false },
      
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('dealerUpdates').doc(dealerId).set(syncData, { merge: true });
    console.log('✅ Synced dealer to Firebase:', dealer.name);
    console.log('   - demoOption:', syncData.demoOption);
    console.log('   - demoItems:', syncData.demoItems?.length || 0);
    console.log('   - dsecCertCount:', syncData.dsecCertCount);
    return true;
  } catch(e) {
    console.error('Sync dealer error:', e);
    return false;
  }
}

// ✅ sync ข้อมูล Pipeline ทั้งหมดของ Dealer
async function syncAllPipelinesToFirebase(dealerId) {
  if (!CURRENT_USER) return false;
  
  const pipelines = ST.pipelineByDealer(dealerId);
  const batch = db.batch();
  const pipelineRef = db.collection('dealerUpdates').doc(dealerId).collection('pipeline');
  
  for (const pipe of pipelines) {
    const docRef = pipelineRef.doc(pipe.id);
    const syncPipe = {
      projectName: pipe.projectName,
      dealerId: pipe.dealerId,
      status: pipe.status,
      forecastAmount: pipe.forecastAmount,
      items: pipe.items || [],
      biddingDate: pipe.biddingDate,
      shipmentDate: pipe.shipmentDate,
      pinned: pipe.pinned || false,
      _status: pipe._status || 'approved',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    batch.set(docRef, syncPipe, { merge: true });
  }
  
  await batch.commit();
  console.log(`✅ Synced ${pipelines.length} pipelines for dealer`);
  return true;
}
// ================================================================
// SYNC DEALER DATA TO FIREBASE (สำหรับ client-view)
// เพิ่มเมื่อ: มิถุนายน 2026
// ================================================================

async function syncDealerToFirebase(dealerId) {
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    console.warn('No user logged in, cannot sync');
    return false;
  }
  
  const dealer = ST.getOne('dealers', dealerId);
  if (!dealer) {
    console.warn('Dealer not found:', dealerId);
    return false;
  }
  
  try {
    // สร้าง object สำหรับ sync (เฉพาะข้อมูลที่ client-view ต้องการ)
    const syncData = {
      name: dealer.name,
      level: dealer.level,
      djiDealer: dealer.djiDealer || '',
      dsecCertCount: Number(dealer.dsecCertCount) || 0,
      dsecStatus: dealer.dsecStatus || '',
      crmStatus: dealer.crmStatus || '',
      fh2Status: dealer.fh2Status || '',
      larkStatus: dealer.larkStatus || '',
      demoOption: dealer.demoOption || 'none',
      demoItems: dealer.demoItems || [],
      sisRevenue: Number(dealer.sisRevenue) || 0,
      sisRevenueH2: Number(dealer.sisRevenueH2) || 0,
      sisRevenueByYear: dealer.sisRevenueByYear || {},
      h1UseSisRevenue: dealer.h1UseSisRevenue === true,
      customDemoRequirements: dealer.customDemoRequirements || { enabled: false },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('dealerUpdates').doc(dealerId).set(syncData, { merge: true });
    console.log('✅ Synced dealer to Firebase:', dealer.name);
    return true;
  } catch(e) {
    console.error('Sync dealer error:', e);
    return false;
  }
}

async function syncAllPipelinesToFirebase(dealerId) {
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    console.warn('No user logged in, skipping pipeline sync');
    return false;
  }
  
  const pipelines = ST.pipelineByDealer(dealerId);
  if (!pipelines.length) {
    console.log('No pipelines to sync for dealer:', dealerId);
    return true;
  }
  
  try {
    const batch = db.batch();
    const pipelineRef = db.collection('dealerUpdates').doc(dealerId).collection('pipeline');
    
    for (const pipe of pipelines) {
      const docRef = pipelineRef.doc(pipe.id);
      const syncPipe = {
        projectName: pipe.projectName || '',
        dealerId: pipe.dealerId,
        status: pipe.status || 'initial',
        forecastAmount: Number(pipe.forecastAmount) || 0,
        items: pipe.items || [],
        model: pipe.model || '',
        modelQty: Number(pipe.modelQty) || 1,
        biddingDate: pipe.biddingDate || '',
        shipmentDate: pipe.shipmentDate || '',
        endUserTH: pipe.endUserTH || '',
        endUserEN: pipe.endUserEN || '',
        pinned: pipe.pinned || false,
        _status: pipe._status || 'approved',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      batch.set(docRef, syncPipe, { merge: true });
    }
    
    await batch.commit();
    console.log(`✅ Synced ${pipelines.length} pipelines for dealer ${dealerId}`);
    return true;
  } catch(e) {
    console.error('Sync pipelines error:', e);
    return false;
  }
}

// ================================================================
// DEALER PIPELINE SHEET EDIT (jexcel)
// ================================================================
// cols: 0=RegDate,1=ProjName,2=EUTH,3=EUEN,4=Unit,5=DJI,6=Revenue,
//       7=Model,8=M3M,9=M4T,10=M4E,11=Dock3,12=M4TD,13=M400,
//       14=Forecast,15=Real,16=BidDate,17=ShipDate,18=Status,19=Sale,20=Remark
var _dealerPipeSheetInstance = null;
var _dealerPipeSheetIds = [];
var _dealerPipeDeletedIds = [];

var _dealerPipeSheetUndo = null;

function _snapDealerPipeSheet() {
  var el = document.getElementById('dealerPipeSheetEl');
  if (!el || !el.jexcel) return;
  _dealerPipeSheetUndo = el.jexcel.getData().map(function(r) { return r.slice(); });
  var btn = document.getElementById('btnDealerPipeUndo');
  if (btn) btn.style.display = '';
}

function undoDealerPipeSheet() {
  if (!_dealerPipeSheetUndo) return;
  var el = document.getElementById('dealerPipeSheetEl');
  if (!el || !el.jexcel) return;
  var sheet = el.jexcel;
  _dealerPipeSheetUndo.forEach(function(row, r) {
    row.forEach(function(val, c) { sheet.setValueFromCoords(c, r, val, true); });
  });
  _dealerPipeSheetUndo = null;
  var btn = document.getElementById('btnDealerPipeUndo');
  if (btn) btn.style.display = 'none';
  toast('↩️ คืนค่าเดิมแล้ว');
}

function recalcAllDealerPipeQty() {
  var el = document.getElementById('dealerPipeSheetEl');
  if (!el || !el.jexcel) { toast('⚠️ เปิด Sheet mode ก่อน'); return; }
  _snapDealerPipeSheet();
  el.jexcel.getData().forEach(function(row, idx) {
    if (row[7]) _autoCalcPipeQty(el, idx, row[7], 8);
  });
  toast('🔄 คำนวณ Qty จาก Model แล้ว — กด ↩️ Undo เพื่อคืนค่า');
}

function calcAllDealerPipeRevenue() {
  var el = document.getElementById('dealerPipeSheetEl');
  if (!el || !el.jexcel) { toast('⚠️ เปิด Sheet mode ก่อน'); return; }
  if (typeof window.getProductForModelGroup === 'undefined') { toast('⚠️ โหลดข้อมูลสินค้าไม่สำเร็จ'); return; }
  _snapDealerPipeSheet();
  var dealer = ST.getOne('dealers', S.dealerId);
  var level = (dealer && dealer.level) || 'Other';

  var groups = ['m3m', 'm4t', 'm4e', 'dock3', 'm4td', 'm400'];
  var filled = 0;
  el.jexcel.getData().forEach(function(row, idx) {
    var total = 0;
    groups.forEach(function(group, i) {
      var qty = parseInt(row[8 + i]) || 0; // col 8 = M3M for dealer sheet
      if (!qty) return;
      var product = window.getProductForModelGroup(group);
      if (!product) return;
      total += qty * (window.getModelPriceByLevel(product.name, level) || 0);
    });

    if (total > 0) {
      el.jexcel.setValueFromCoords(6, idx, total, true); // col 6 = Revenue for dealer sheet
      filled++;
    }
  });
  toast('💰 Revenue ' + filled + ' รายการ (Level: ' + level + ') — กด ↩️ Undo เพื่อคืนค่า');
}

function initDealerPipeSheet(pipes) {
  if (typeof jexcel === 'undefined') { toast('⚠️ โหลด jspreadsheet ไม่สำเร็จ (ต้องออนไลน์)'); return; }
  var el = document.getElementById('dealerPipeSheetEl');
  if (!el) return;
  if (el.jexcel) { jexcel.destroy(el); el.innerHTML = ''; }

  var cfg = getConfig();
  var statusNames = (cfg.pipelineStatuses || []).map(function(s) { return s.name; });
  if (!statusNames.length) statusNames = ['Prospect','TOR Review','Quotation','Bidding','Negotiation','Win','Lost'];

  function fmtDate(s) {
    if (!s) return '';
    var p = (s||'').slice(0,10).split('-');
    return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : s;
  }

  _dealerPipeSheetIds = pipes.map(function(p) { return p.id; });
  _dealerPipeDeletedIds = [];
  var data = pipes.map(function(p) {
    var statusObj = (cfg.pipelineStatuses||[]).find(function(s){ return s.id === p.status; });
    var items = (p.items && p.items.length) ? p.items : (p.model ? [{ model: p.model, qty: p.modelQty || 1 }] : []);
    var g = _pipeModelQtyByGroup(items);
    var modelCell = items.map(function(it) { return (it.model || '') + '*' + (Number(it.qty) || 1); }).join('\n');
    return [
      fmtDate(p.registerDate), p.projectName||'', p.endUserTH||'', p.endUserEN||'',
      p.unitType||'', p.djiDealer||'',
      p.projectRevenue||0, modelCell,
      g.m3m||0, g.m4t||0, g.m4e||0, g.dock3||0, g.m4td||0, g.m400||0,
      p.forecastAmount||0, p.realAmount||0,
      fmtDate(p.biddingDate), fmtDate(p.shipmentDate),
      statusObj ? statusObj.name : (p.status||''),
      p.saleName||'', p.remark||''
    ];
  });

  _dealerPipeSheetInstance = jexcel(el, {
    data: data,
    columns: [
      { title: 'Register Date',  type: 'text',     width: 95  },
      { title: 'Project Name',   type: 'text',     width: 200 },
      { title: 'End User TH',    type: 'text',     width: 140 },
      { title: 'End User EN',    type: 'text',     width: 120 },
      { title: 'Unit type',      type: 'text',     width: 70  },
      { title: 'DJI Dealer',     type: 'text',     width: 110 },
      { title: 'Revenue',        type: 'numeric',  width: 90  },
      { title: 'Model',          type: 'text',     width: 160 },
      { title: 'M3M',            type: 'numeric',  width: 50  },
      { title: 'M4T',            type: 'numeric',  width: 50  },
      { title: 'M4E',            type: 'numeric',  width: 50  },
      { title: 'Dock3',          type: 'numeric',  width: 50  },
      { title: 'M4TD',           type: 'numeric',  width: 50  },
      { title: 'M400',           type: 'numeric',  width: 50  },
      { title: 'Forecast',       type: 'numeric',  width: 95  },
      { title: 'Real Amount',    type: 'numeric',  width: 95  },
      { title: 'Bidding Date',   type: 'text',     width: 95  },
      { title: 'Shipment Date',  type: 'text',     width: 95  },
      { title: 'Status',         type: 'dropdown', source: statusNames, width: 110 },
      { title: 'Sale',           type: 'text',     width: 80  },
      { title: 'Remark',         type: 'text',     width: 160 }
    ],
    minDimensions: [21, Math.max(data.length, 5)],
    allowInsertRow: false,
    allowDeleteRow: true,
    contextMenu: false,
    ondeleterow: function(el, rowNumber, numRows) {
      for (var i = 0; i < numRows; i++) {
        var deletedId = _dealerPipeSheetIds[rowNumber + i];
        if (deletedId) _dealerPipeDeletedIds.push(deletedId);
      }
      _dealerPipeSheetIds.splice(rowNumber, numRows);
    },
    onchange: function(el, cell, x, y, value) {
      if (parseInt(x) === 7) _autoCalcPipeQty(el, parseInt(y), value, 8);
    }
  });
}

function saveDealerPipeSheet() {
  if (!_dealerPipeSheetInstance) { toast('⚠️ เปิด Sheet mode ก่อน'); return; }
  var rows = _dealerPipeSheetInstance.getData();
  var cfg = getConfig();

  var qtyDefs = [
    {col:8,  model:'M3M'},   {col:9,  model:'M4T'},
    {col:10, model:'M4E'},   {col:11, model:'Dock 3'},
    {col:12, model:'M4TD'},  {col:13, model:'M400'}
  ];

  var saved = 0;
  rows.forEach(function(r, idx) {
    var id = _dealerPipeSheetIds[idx];
    if (!id) return;
    var statusName = (r[18]||'').trim();
    var statusObj = (cfg.pipelineStatuses||[]).find(function(s){ return s.name===statusName; });

    var items = [];
    qtyDefs.forEach(function(def) {
      var qty = parseInt(r[def.col]) || 0;
      if (qty > 0) items.push({ model: def.model, qty: qty });
    });
    if (!items.length && r[7]) {
      (r[7]||'').split('\n').filter(Boolean).forEach(function(line) {
        var p = line.split('*'); var m = (p[0]||'').trim(); var q = parseInt(p[1])||1;
        if (m) items.push({ model: m, qty: q });
      });
    }

    ST.update('pipeline', id, {
      registerDate: _pipeDateFromPaste(r[0]),
      projectName: (r[1]||'').trim(),
      endUserTH: (r[2]||'').trim(),
      endUserEN: (r[3]||'').trim(),
      unitType: (r[4]||'').trim(),
      djiDealer: (r[5]||'').trim(),
      projectRevenue: parseFloat(r[6])||0,
      items: items,
      forecastAmount: parseFloat(r[14])||0,
      realAmount: parseFloat(r[15])||0,
      biddingDate: _pipeDateFromPaste(r[16]),
      shipmentDate: _pipeDateFromPaste(r[17]),
      status: statusObj ? statusObj.id : (r[18]||'initial'),
      saleName: (r[19]||'').trim(),
      remark: (r[20]||'').trim(),
      updatedAt: new Date().toISOString()
    });
    saved++;
  });

  var deleted = 0;
  _dealerPipeDeletedIds.forEach(function(id) {
    ST.delete('pipeline', id);
    ST.deleteWhere('pipeLog', function(l) { return l.pipeId === id; });
    if (typeof syncDeleteFromFirebase === 'function') syncDeleteFromFirebase('pipeline', id);
    deleted++;
  });
  _dealerPipeDeletedIds = [];

  var st = document.getElementById('dealerPipeSheetStatus');
  var msg = '✅ บันทึก ' + saved + ' รายการ' + (deleted ? ' · ลบ ' + deleted + ' รายการ' : '');
  if (st) st.textContent = msg;
  toast('💾 ' + msg);
}