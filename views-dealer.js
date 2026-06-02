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

function rDealers(el) {
  document.getElementById('pgT').textContent = '🏪 Dealer';
  let dealers = ST.getAll('dealers');
  
  if (dealerFilter !== 'all') {
    if (dealerFilter === 'authorized') dealers = dealers.filter(d => ['S','A','B'].includes(d.level));
    else if (dealerFilter === 'other') dealers = dealers.filter(d => !['S','A','B'].includes(d.level));
    else dealers = dealers.filter(d => d.level === dealerFilter);
  }
  
  dealers = dealers.map(d => ({...d, _health: calcHealthScore(d.id)}))
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

  <div class="bg" style="margin-bottom:8px">
    <button class="btn bsm bo" onclick="copyDealerSummary()">📋 Copy ตาราง</button>
    <button class="btn bsm bo" onclick="dlDealerCSV()">📤 CSV</button>
  </div>

  <div class="card-grid" id="dGrid">
    ${dealers.length ? dealers.map(d => dealerCardHTML(d, d._health)).join('') : '<div class="empty" style="grid-column:1/-1"><div class="icon">🏪</div><p>ยังไม่มี Dealer<br><button class="btn bp" onclick="showDealerM()" style="margin-top:6px">➕ เพิ่ม Dealer</button></p></div>'}
  </div>`;
}

function dealerCardHTML(d, health) {
  const h = health || calcHealthScore(d.id);
  const pipes = ST.pipelineByDealer(d.id);
  const activePipes = pipes.filter(p => !['lost','delivered','on_hold'].includes(p.status));
  const wonAmt = pipes.filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const targetAmt = Number(d.targetRevenue) || 0;
  const pct = targetAmt ? Math.round(wonAmt / targetAmt * 100) : 0;
  const lcd = ST.getLastContactDays(d.id);
  const lvd = ST.getLastVisitDays(d.id);
  
  const certCount = ['dsec','crm','fh2','lark'].filter(c => {
    const v = d[c + 'Status'];
    return v === 'pass' || v === 'yes' || v === 'added';
  }).length;

  return `<div class="dealer-card" onclick="go('dealerDetail',{dealerId:'${d.id}'})">
    <h3>${levelTag(d.level)} ${sanitize(d.name)}</h3>
    <div class="meta">${d.contact ? '👤 ' + sanitize(d.contact).substr(0,30) : ''} ${d.sisCode ? '• SIS: ' + d.sisCode : ''}</div>
    
    <div class="dealer-stats">
      <div class="dealer-stat"><div class="val c2">${fmtMoneyShort(wonAmt)}</div><div class="lbl">ยอดขาย</div></div>
      <div class="dealer-stat"><div class="val c3">${fmtMoneyShort(targetAmt)}</div><div class="lbl">เป้า</div></div>
      <div class="dealer-stat"><div class="val ${pct>=70?'c2':pct>=40?'c3':'c4'}">${pct}%</div><div class="lbl">Achieve</div></div>
      <div class="dealer-stat"><div class="val" style="color:${h.level==='good'?'#22c55e':h.level==='warn'?'#f59e0b':'#ef4444'}">${h.score}</div><div class="lbl">Health</div></div>
    </div>
    
    ${targetAmt ? `<div class="pb"><div class="pf ${pct>=70?'pf-green':pct>=40?'pf-yellow':'pf-red'}" style="width:${Math.min(pct,100)}%"></div></div>` : ''}
    
    <div class="dealer-health">
      <span class="health-dot ${contactColor(lcd)}"></span>
      <span style="font-size:.62rem;color:#64748b">ติดต่อ: ${lcd !== null ? lcd + 'd' : '-'}</span>
      <span style="font-size:.62rem;color:#64748b">Visit: ${lvd !== null ? lvd + 'd' : '-'}</span>
      <span style="font-size:.62rem;color:#64748b">📊 ${activePipes.length}</span>
    </div>
    
    <div class="cert-row">
      <span class="cert-item ${d.dsecStatus==='pass'?'pass':'fail'}">DSEC ${d.dsecStatus==='pass'?'✅':'❌'}</span>
      <span class="cert-item ${d.crmStatus==='yes'?'pass':'fail'}">CRM ${d.crmStatus==='yes'?'✅':'❌'}</span>
      <span class="cert-item ${d.fh2Status==='pass'?'pass':'fail'}">FH2 ${d.fh2Status==='pass'?'✅':'❌'}</span>
      <span class="cert-item ${d.larkStatus==='added'?'pass':'fail'}">Lark ${d.larkStatus==='added'?'✅':'❌'}</span>
    </div>
  </div>`;
}

function filterDealerList() {
  const q = document.getElementById('dSrc')?.value.toLowerCase() || '';
  let dealers = ST.getAll('dealers');
  if (dealerFilter !== 'all') {
    if (dealerFilter === 'authorized') dealers = dealers.filter(d => ['S','A','B'].includes(d.level));
    else if (dealerFilter === 'other') dealers = dealers.filter(d => !['S','A','B'].includes(d.level));
    else dealers = dealers.filter(d => d.level === dealerFilter);
  }
  if (q) dealers = dealers.filter(d => d.name?.toLowerCase().includes(q) || d.contact?.toLowerCase().includes(q) || d.sisCode?.toLowerCase().includes(q));
  
  const grid = document.getElementById('dGrid');
  if (grid) grid.innerHTML = dealers.length
    ? dealers.map(d => dealerCardHTML(d)).join('')
    : '<div class="empty" style="grid-column:1/-1"><p>ไม่พบ Dealer</p></div>';
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
  S.dealerId = d.id;
  
  if (S.tab === 'forecast') {
    dealerTab = 'forecast';
    delete S.tab;
  }
  
  const isPinned = ST.hasPin(d.id);
  const h = calcHealthScore(d.id);
  el.innerHTML = `
  <div class="bc">
    <a onclick="go('dealers')">🏪 Dealer</a><span class="sep">›</span>
    <span class="cur">${sanitize(d.name)}</span>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px">
    <div style="display:flex;align-items:center;gap:6px">
      ${levelTag(d.level)}
      <span style="font-size:.72rem;font-weight:700;color:${h.level==='good'?'#22c55e':h.level==='warn'?'#f59e0b':'#ef4444'}">Health: ${h.score}/100</span>
    </div>

<div class="bg">
  <button class="btn bsm bs" onclick="startTimer('dealer','${d.id}','${sanitize(d.name)}')">⏱️</button>
  <button class="btn bsm ${isPinned?'bw':'bo'}" onclick="ST.togglePin('dealer','${d.id}','${sanitize(d.name)}','');render()">📌</button>
<button class="btn bsm bo" onclick="showDealerTokenModal('${d.id}')">🔗 สร้างลิงก์</button>
<button class="btn bsm bo" onclick="showChangePinModal('${d.id}')">🔒 PIN</button>
  <button class="btn bsm bo" onclick="showCurrentLinkModal('${d.id}')">🔗 ลิงก์ปัจจุบัน</button>
  <button class="btn bsm bo" onclick="showPreVisitBrief('${d.id}')">📋 เตรียม Visit</button>
<button class="btn bsm bp" onclick="syncDealerPipelineToCustomer('${d.id}')" title="Sync Pipeline ให้ลูกค้า">🔄 Sync</button>
  <button class="btn bsm bo" onclick="showDealerM('${d.id}')">✏️</button>
  <button class="btn bsm bd" onclick="delDealer('${d.id}')">🗑️</button>
</div>

  <div class="tab-bar">
    <div class="tab-btn ${dealerTab==='info'?'act':''}" onclick="dealerTab='info';render()">📋 ข้อมูล</div>
    <div class="tab-btn ${dealerTab==='pipeline'?'act':''}" onclick="dealerTab='pipeline';render()">📊 Pipeline</div>
    <div class="tab-btn ${dealerTab==='visit'?'act':''}" onclick="dealerTab='visit';render()">🤝 Visit</div>
    <div class="tab-btn ${dealerTab==='timeline'?'act':''}" onclick="dealerTab='timeline';render()">📝 Timeline</div>
    <div class="tab-btn ${dealerTab==='demo'?'act':''}" onclick="dealerTab='demo';render()">🚁 Demo</div>
    <div class="tab-btn ${dealerTab==='forecast'?'act':''}" onclick="dealerTab='forecast';render()">📦 Forecast</div>
    <div class="tab-btn ${dealerTab==='tasks'?'act':''}" onclick="dealerTab='tasks';render()">📋 งาน</div>
    <div class="tab-btn ' + (dealerTab==='onboard'?'act':'') + '" onclick="dealerTab=\'onboard\';render()">🔄 Onboard</div>
  </div>

  <div id="dealerTabContent">${renderDealerTab(d)}</div>`;
}

function renderDealerTab(d) {
  switch (dealerTab) {
    case 'info': return dealerInfoTab(d);
    case 'pipeline': return dealerPipelineTab(d);
    case 'visit': return dealerVisitTab(d);
    case 'timeline': return dealerTimelineTab(d);
    case 'demo': return dealerDemoTab(d);
    case 'forecast': return dealerForecastTab(d);
    case 'tasks': return dealerTasksTab(d);
    case 'onboard': return dealerOnboardTab(d);
    default: return dealerInfoTab(d);
  }
}

// ================================================================
// TAB: INFO (Redesigned - Premium)
// ================================================================
function dealerInfoTab(d) {
  const pipes = ST.pipelineByDealer(d.id);
  const wonAmt = pipes.filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
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
          ${levelTag(d.level)}
          <span style="font-size: 12px; color: var(--text2)">📋 SIS: ${d.sisCode || '-'}</span>
          <span style="font-size: 12px; color: var(--text2)">🔢 DJI: ${d.djiCode || '-'}</span>
          <span style="font-size: 12px; color: var(--text2)">🏪 DJI Dealer: ${d.djiDealer || '-'}</span>
        </div>
      </div>
      <div style="text-align: right">
        <div style="font-size: 32px; font-weight: 800; color: ${healthColor}">${h.score}/100</div>
        <div style="font-size: 11px; color: var(--text2)">Health Score</div>
      </div>
    </div>
  </div>

  <div class="sr" style="margin-bottom: 20px">
    <div class="sc"><div class="sn c2">${fmtMoneyShort(wonAmt)}</div><div class="sl">ยอดขาย Won</div></div>
    <div class="sc"><div class="sn c3">${fmtMoneyShort(targetAmt)}</div><div class="sl">เป้ายอดขาย</div></div>
    <div class="sc"><div class="sn ${pct >= 70 ? 'c2' : pct >= 40 ? 'c3' : 'c4'}">${pct}%</div><div class="sl">Achievement</div></div>
    <div class="sc"><div class="sn c1">${pipes.filter(p => !['lost','delivered','on_hold'].includes(p.status)).length}</div><div class="sl">Pipeline Active</div></div>
  </div>

  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px">
    
    <div class="card" style="margin-bottom: 0">
      <h2>🏢 ข้อมูลบริษัท</h2>
      <div style="display: flex; flex-direction: column; gap: 10px">
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">📋</span>
          <div><div style="font-size: 10px; color: var(--text2)">SIS Code</div><div style="font-size: 13px; font-weight: 500">${d.sisCode || '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">🔢</span>
          <div><div style="font-size: 10px; color: var(--text2)">DJI Code</div><div style="font-size: 13px; font-weight: 500">${d.djiCode || '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">🏪</span>
          <div><div style="font-size: 10px; color: var(--text2)">DJI Dealer Type</div><div style="font-size: 13px; font-weight: 500">${d.djiDealer || '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">🏷️</span>
          <div><div style="font-size: 10px; color: var(--text2)">Level / Term</div><div style="font-size: 13px; font-weight: 500">${levelTag(d.level)} / ${d.creditTerm || '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="font-size: 18px">💳</span>
          <div><div style="font-size: 10px; color: var(--text2)">วงเงินเครดิต</div><div style="font-size: 13px; font-weight: 500">${d.creditLimit ? fmtMoney(d.creditLimit) + ' ฿' : '-'}</div></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 0">
      <h2>👤 ผู้ติดต่อ</h2>
      <div style="display: flex; flex-direction: column; gap: 10px">
        <div style="display: flex; align-items: flex-start; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">📞</span>
          <div><div style="font-size: 10px; color: var(--text2)">เบอร์ติดต่อ</div><div style="font-size: 13px; font-weight: 500">${d.contact ? sanitize(d.contact) : '-'}</div></div>
        </div>
        <div style="display: flex; align-items: flex-start; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border)">
          <span style="font-size: 18px">📝</span>
          <div><div style="font-size: 10px; color: var(--text2)">รายละเอียดลูกค้า</div><div style="font-size: 12px; color: var(--text3)">${d.customerDetail ? sanitize(d.customerDetail) : '-'}</div></div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="font-size: 18px">🚚</span>
          <div><div style="font-size: 10px; color: var(--text2)">Shippto</div><div style="font-size: 13px; font-weight: 500">${d.shippto || 'NO'}</div></div>
        </div>
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

  ${renderDealerContacts(d)}

  <div class="card">
    <h2>💬 LINE Support <span class="ml"><button class="btn bsm bp" onclick="showLineLogM('${d.id}')">➕</button></span></h2>
    ${renderLineLog(d.id, 5)}
  </div>`;
}

function certField(name, status, count, lastCheck) {
  const pass = status === 'pass' || status === 'yes' || status === 'added';
  return `<div style="padding:6px 8px;background:#0f172a;border:1px solid ${pass?'#22c55e':'#475569'};border-radius:6px">
    <div style="font-size:.72rem;display:flex;justify-content:space-between"><span>${name}</span><span>${pass?'✅':'❌'}</span></div>
    ${count ? `<div style="font-size:.66rem;color:#64748b">${count} ใบ</div>` : ''}
    ${lastCheck ? `<div style="font-size:.62rem;color:#475569">เช็ค: ${fDShort(lastCheck)}</div>` : ''}
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
      <div style="font-size:.6rem;color:#64748b">${fD(l.date)} ${l.time||''}</div></div>
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
    if (['lost','delivered'].indexOf(p.status) === -1) {
      activeCount++;
      activeAmt += amt;
    }
    if (['win','ordered','delivered'].indexOf(p.status) !== -1) {
      wonCount++;
      wonAmt += amt;
    }
    if (p.status === 'lost') {
      lostCount++;
      lostAmt += amt;
    }
  });

  var h = '<div class="card"><h2>📊 Pipeline (' + activeCount + ' active / ' + pipes.length + ' total)';
  h += '<span class="ml">';
  h += '<button class="btn bsm bo" onclick="copyDealerPipeline(\'' + d.id + '\')">📋</button>';
  h += '<button class="btn bsm bp" onclick="showPipelineM(\'' + d.id + '\')">➕</button>';
  h += '</span></h2>';

  h += '<div class="sr" style="margin-bottom:8px">';
  h += '<div class="sc"><div class="sn c1">' + pipes.length + '</div><div class="sl">ทั้งหมด</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(activeAmt) + '</div><div class="sl">Active (' + activeCount + ')</div></div>';
  h += '<div class="sc"><div class="sn c5">' + fmtMoneyShort(totalAmt) + '</div><div class="sl">Total</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(wonAmt) + '</div><div class="sl">Won (' + wonCount + ')</div></div>';
  h += '<div class="sc"><div class="sn c4">' + fmtMoneyShort(lostAmt) + '</div><div class="sl">Lost (' + lostCount + ')</div></div>';
  h += '</div>';

  if (pipes.length) {
    pipes.forEach(function(p, idx) {
      var lastLog = ST.pipeLogsByPipe(p.id)[0];
      var isEnd = ['delivered','lost'].indexOf(p.status) !== -1;
      var amt = Number(p.forecastAmount) || 0;

      h += '<div class="li ' + dlC(p.biddingDate, isEnd) + (p.status === 'lost' ? ' dlo' : '') + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
      h += '<div class="lm">';
      h += '<div class="lt"><span class="pipe-row-num">#' + (idx + 1) + '</span> ' + sanitize(p.projectName) + ' ' + pipeTag(p.status) + '</div>';
      h += '<div class="ls">';
      h += (p.endUserTH || '') + ' • ' + (p.model || '') + (p.modelQty > 1 ? 'x' + p.modelQty : '') + ' • ';
      h += fmtMoneyStyled(amt);
      if (p.biddingDate) h += ' • Bid: ' + fDShort(p.biddingDate) + ' ' + dlB(p.biddingDate, isEnd);
      h += '</div>';
      if (lastLog) {
        h += '<div class="ls" style="color:#475569;margin-top:1px">📝 ' + fDShort(lastLog.date ? lastLog.date.split('T')[0] : '') + ' ' + sanitize((lastLog.content || '').substr(0, 40)) + '</div>';
      }
      h += '</div></div>';
    });
  } else {
    h += '<div class="empty"><p>ยังไม่มี Pipeline</p></div>';
  }

  h += '</div>';
  return h;
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
    <div style="display:flex;justify-content:space-between"><span style="font-size:.62rem;color:#64748b">${fD(f.date)} • ${f.source||''}</span>
    <button class="btn bsm bd" onclick="event.stopPropagation();ST.delete('feedback','${f.id}');render()">✕</button></div>
    <div style="font-size:.74rem;margin-top:1px">${sanitize(f.text)}</div>
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

function dealerForecastTab(d) {
  var allPipes = ST.pipelineByDealer(d.id);
  
  var pipes;
  if (dlrFcStatus === 'all') {
    pipes = allPipes;
  } else if (dlrFcStatus === 'won') {
    pipes = allPipes.filter(function(p) { return ['win','ordered','delivered'].indexOf(p.status) !== -1; });
  } else {
    pipes = allPipes.filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
  }
  
  var totalFc = 0;
  var totalQty = 0;
  pipes.forEach(function(p) {
    totalFc += (Number(p.forecastAmount) || 0);
    totalQty += getPipeTotalQty(p);
  });
  
  var byModel = {};
  pipes.forEach(function(p) {
    var items = getPipeItems(p);
    if (!items.length) return;
    items.forEach(function(it) {
      var model = it.model || 'ไม่ระบุ';
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));
      if (!byModel[model]) byModel[model] = {model: model, qty: 0, amount: 0, projects: []};
      byModel[model].qty += qty;
      byModel[model].amount += amt;
      var found = false;
      for (var fi = 0; fi < byModel[model].projects.length; fi++) {
        if (byModel[model].projects[fi].id === p.id) { found = true; break; }
      }
      if (!found) byModel[model].projects.push(p);
    });
  });
  var modelList = Object.values(byModel).sort(function(a, b) { return b.amount - a.amount; });

  var h = '<div class="card"><h2>📦 Forecast — ' + sanitize(d.name);
  h += '<span class="ml"><button class="btn bsm bo" onclick="copyDealerForecast(\'' + d.id + '\')">📋</button></span></h2>';

  h += '<div class="sr" style="margin-bottom:8px">';
  h += '<div class="sc"><div class="sn c1">' + pipes.length + '</div><div class="sl">Projects</div></div>';
  h += '<div class="sc"><div class="sn c2">' + fmtMoneyShort(totalFc) + '</div><div class="sl">Forecast</div></div>';
  h += '<div class="sc"><div class="sn c5">' + totalQty + '</div><div class="sl">จำนวน (ชิ้น)</div></div>';
  h += '<div class="sc"><div class="sn c1">' + modelList.length + '</div><div class="sl">Models</div></div>';
  h += '</div>';

  h += '<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">';
  h += '<button class="btn bsm ' + (dlrFcStatus === 'active' ? 'bp' : 'bo') + '" onclick="dlrFcStatus=\'active\';render()">⚡ Active</button>';
  h += '<button class="btn bsm ' + (dlrFcStatus === 'won' ? 'bp' : 'bo') + '" onclick="dlrFcStatus=\'won\';render()">🏆 Won</button>';
  h += '<button class="btn bsm ' + (dlrFcStatus === 'all' ? 'bp' : 'bo') + '" onclick="dlrFcStatus=\'all\';render()">📊 ทั้งหมด</button>';
  h += '<div style="flex:1"></div>';
  h += '<button class="btn bsm ' + (dlrFcView === 'model' ? 'bp' : 'bo') + '" onclick="dlrFcView=\'model\';render()">📦 Model</button>';
  h += '<button class="btn bsm ' + (dlrFcView === 'monthly' ? 'bp' : 'bo') + '" onclick="dlrFcView=\'monthly\';render()">📅 เดือน</button>';
  h += '<button class="btn bsm ' + (dlrFcView === 'quarterly' ? 'bp' : 'bo') + '" onclick="dlrFcView=\'quarterly\';render()">📊 ไตรมาส</button>';
  h += '</div>';

  if (dlrFcView === 'monthly') {
    h += buildDlrFcMonthly(pipes, d);
  } else if (dlrFcView === 'quarterly') {
    h += buildDlrFcQuarterly(pipes, d);
  } else {
    h += buildDlrFcModel(modelList, totalFc, totalQty, d);
  }

  h += '</div>';

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
      h += '<div class="li ' + dlC(p.biddingDate, ['delivered','lost'].indexOf(p.status) !== -1) + '" onclick="go(\'pipeDetail\',{pipeId:\'' + p.id + '\'})">';
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

  return h;
}

// ================================================================
// DEALER FORECAST — MODEL VIEW
// ================================================================
function buildDlrFcModel(modelList, totalFc, totalQty, d) {
  if (!modelList.length) return '<div class="empty"><p>ไม่มีข้อมูล</p></div>';

  var h = '<div class="export-wrap"><table class="export-table" id="fcDlr_' + d.id + '">';
  h += '<thead><tr><th>#</th><th>Model</th><th style="text-align:center">QTY</th><th style="text-align:right">มูลค่า</th><th>Project</th></tr></thead>';
  h += '<tbody>';

  modelList.forEach(function(m, idx) {
    var projNames = m.projects.map(function(p) { return sanitize((p.projectName || '').substr(0, 20)); }).join(', ');
    h += '<tr>';
    h += '<td class="pipe-row-num">' + (idx + 1) + '</td>';
    h += '<td><strong>' + sanitize(m.model) + '</strong></td>';
    h += '<td style="text-align:center">' + m.qty + '</td>';
    h += '<td style="text-align:right">' + fmtMoneyStyled(m.amount) + '</td>';
    h += '<td style="font-size:.64rem">' + projNames + '</td>';
    h += '</table>';
  });

  h += '<tr style="font-weight:700;border-top:2px solid var(--border)">';
  h += '<td><td>รวม</td>';
  h += '<td style="text-align:center">' + totalQty + '</td>';
  h += '<td style="text-align:right">' + fmtMoneyStyled(totalFc) + '</td>';
  h += '</tr></td>';
  h += '</tbody></table></div>';
  return h;
}

function buildDlrFcMonthly(pipes, d) {
  var now = new Date();
  var year = now.getFullYear();
  var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  var models = {};
  var monthTotals = {};
  for (var mi = 0; mi < 12; mi++) monthTotals[mi] = {qty: 0, amt: 0};

  pipes.forEach(function(p) {
    var shipDate = ftParseDate(p.shipmentDate);
    if (!shipDate) return;
    if (shipDate.getFullYear() !== year) return;
    var m = shipDate.getMonth();
    
    var items = getPipeItems(p);
    if (!items.length) return;
    
    items.forEach(function(it) {
      var model = it.model || 'ไม่ระบุ';
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));
      
      if (!models[model]) {
        models[model] = {};
        for (var i = 0; i < 12; i++) models[model][i] = {qty: 0, amt: 0, projects: []};
      }
      
      models[model][m].qty += qty;
      models[model][m].amt += amt;
      
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
    return '<div class="empty"><p>ไม่มีข้อมูล — ต้องใส่ Shipment Date ใน Pipeline</p></div>';
  }

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
    h += '<td><strong>' + sanitize(model) + '</strong></tr>';
    for (var mc = 0; mc < 12; mc++) {
      var cell = models[model][mc];
      var isCur = mc === now.getMonth();
      var bg = isCur ? 'background:rgba(59,130,246,0.08);' : '';
      if (cell.qty > 0) {
        tQty += cell.qty;
        tAmt += cell.amt;
        var tip = cell.projects.map(function(pp) { return (pp.projectName || '').substr(0, 25); }).join('\n');
        h += '<td style="text-align:center;' + bg + '" title="' + sanitize(tip) + '">';
        h += '<div style="font-weight:700">' + cell.qty + '</div>';
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
  h += '</tbody></tr></div>';
  return h;
}

// ================================================================
// DEALER FORECAST — QUARTERLY VIEW
// ================================================================
function buildDlrFcQuarterly(pipes, d) {
  var now = new Date();
  var year = now.getFullYear();
  var qLabels = ['Q1','Q2','Q3','Q4'];

  var models = {};
  var qTotals = [{qty:0,amt:0},{qty:0,amt:0},{qty:0,amt:0},{qty:0,amt:0}];

  pipes.forEach(function(p) {
    var shipDate = ftParseDate(p.shipmentDate);
    if (!shipDate) return;
    if (shipDate.getFullYear() !== year) return;
    var q = Math.floor(shipDate.getMonth() / 3);
    
    var items = getPipeItems(p);
    if (!items.length) return;
    
    items.forEach(function(it) {
      var model = it.model || 'ไม่ระบุ';
      var qty = Number(it.qty) || 1;
      var amt = Number(it.total) || (qty * (Number(it.price) || 0));
      
      if (!models[model]) {
        models[model] = [{qty:0,amt:0,projects:[]},{qty:0,amt:0,projects:[]},{qty:0,amt:0,projects:[]},{qty:0,amt:0,projects:[]}];
      }
      
      models[model][q].qty += qty;
      models[model][q].amt += amt;
      
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
    return '<div class="empty"><p>ไม่มีข้อมูล — ต้องใส่ Shipment Date ใน Pipeline</p></div>';
  }

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
        h += '<td style="text-align:center;' + bg + '" title="' + sanitize(tip) + '">';
        h += '<div style="font-weight:700;font-size:1.1em">' + cell.qty + '</div>';
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
    pipes = allPipes.filter(function(p) { return ['win','ordered','delivered'].indexOf(p.status) !== -1; });
  } else {
    pipes = allPipes.filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
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
  const pipes = ST.pipelineByDealer(dealerId).filter(p => !['lost','delivered','on_hold'].includes(p.status));
  const wonAmt = ST.pipelineByDealer(dealerId).filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
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
  const pipes = ST.pipelineByDealer(dealerId).filter(p => !['lost','delivered','on_hold'].includes(p.status));
  const wonAmt = ST.pipelineByDealer(dealerId).filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
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
  
  dealerTab = 'info';
  go('dealers');
  toast('🗑️ ลบ Dealer แล้ว');
}

// ================================================================
// DEALER COPY/EXPORT
// ================================================================
function copyDealerSummary() {
  const dealers = ST.getAll('dealers');
  let tsv = 'SIS Code\tDJI Code\tName\tLevel\tContact\tTerm\tCredit Limit\tTarget\tWon\tAchieve%\tHealth\tLast Contact\tLast Visit\tDSEC\tCRM\tFH2\tLark\n';
  dealers.forEach(d => {
    const won = ST.pipelineByDealer(d.id).filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
    const target = Number(d.targetRevenue) || 0;
    const pct = target ? Math.round(won/target*100) : 0;
    const h = calcHealthScore(d.id);
    const lcd = ST.getLastContactDays(d.id);
    const lvd = ST.getLastVisitDays(d.id);
    tsv += `${d.sisCode||''}\t${d.djiCode||''}\t${d.name}\t${d.level||''}\t${(d.contact||'').replace(/[\t\n]/g,' ')}\t${d.creditTerm||''}\t${d.creditLimit||''}\t${target}\t${won}\t${pct}%\t${h.score}\t${lcd!==null?lcd+'d':'-'}\t${lvd!==null?lvd+'d':'-'}\t${d.dsecStatus==='pass'?'Y':'N'}\t${d.crmStatus==='yes'?'Y':'N'}\t${d.fh2Status==='pass'?'Y':'N'}\t${d.larkStatus==='added'?'Y':'N'}\n`;
  });
  copyText(tsv, '📋 Copy Dealer Summary');
}

function dlDealerCSV() {
  const dealers = ST.getAll('dealers');
  let csv = '\uFEFF"SIS Code","DJI Code","Name","Level","Contact","Phone","Email","Term","Credit Limit","Target Revenue","Won Revenue","Achieve%","DSEC","CRM","FH2","Lark","Google Map"\n';
  dealers.forEach(d => {
    const won = ST.pipelineByDealer(d.id).filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
    const target = Number(d.targetRevenue) || 0;
    csv += `"${d.sisCode||''}","${d.djiCode||''}","${esc(d.name)}","${d.level||''}","${esc(d.contact)}","${d.phone||''}","${d.email||''}","${d.creditTerm||''}","${d.creditLimit||''}","${target}","${won}","${target?Math.round(won/target*100):0}%","${d.dsecStatus||''}","${d.crmStatus||''}","${d.fh2Status||''}","${d.larkStatus||''}","${d.googleMap||''}"\n`;
  });
  dlBlob(csv, `dealers-${_td()}.csv`);
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
  txt += 'Dealer: ' + (d ? d.name : '-') + '\n';
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
    v.forecastNotes.forEach(function(fn) { if (fn.month || fn.amount || fn.items) hasFc = true; });
    if (hasFc) {
      txt += '📦 Forecast:\n';
      v.forecastNotes.forEach(function(fn) {
        if (!fn.month && !fn.amount && !fn.items) return;
        txt += '• ' + (fn.month || '-');
        if (fn.amount) txt += ' — ฿' + fmtMoney(fn.amount);
        if (fn.items) txt += ' — ' + fn.items;
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

function renderOnboardStepFullWidth(dealerId, step, idx, currentIdx) {
  var isCurrent = idx === currentIdx;
  var cls = step.done ? 'done' : isCurrent ? 'current' : '';
  
  return '<div class="onboard-step ' + cls + '" style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;width:100%;box-sizing:border-box">' +
    '<div class="ob-num" onclick="toggleOnboardStep(\'' + dealerId + '\',' + idx + ')" style="cursor:pointer;width:28px;height:28px;border-radius:50%;background:var(--border);color:var(--text2);display:flex;align-items:center;justify-content:center;flex-shrink:0">' + 
    (step.done ? '✓' : (idx + 1)) + '</div>' +
    '<div class="ob-content" style="flex:1;min-width:0">' +
    '<div class="ob-title" style="font-size:.8rem;font-weight:500;margin-bottom:2px">' + sanitize(step.title) + '</div>' +
    '<div class="ob-meta" style="font-size:.66rem;color:var(--text3)">' +
    (step.done && step.date ? '✅ ' + fD(step.date) : '') +
    (isCurrent ? '🔄 ขั้นตอนปัจจุบัน' : '') +
    (!step.done && !isCurrent ? '☐ ยังไม่ได้ทำ' : '') +
    '</div>' +
    (step.note ? '<div class="ob-note" style="font-size:.7rem;color:var(--text2);margin-top:3px;white-space:pre-wrap">' + sanitize(step.note) + '</div>' : '') +
    '</div>' +
    '<button class="btn bsm bo" onclick="editOnboardStep(\'' + dealerId + '\',' + idx + ')" style="flex-shrink:0">📝</button>' +
    '</div>';
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
  
  ST.update('dealers', dealerId, {onboarding: d.onboarding});
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
  h += '<button class="btn btn-blue" onclick="saveContact(\'' + dealerId + '\')">💾 บันทึก</button>';
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
  h += '<button class="btn btn-blue" onclick="updateContact(\'' + dealerId + '\',' + ctIdx + ')">💾 บันทึก</button>';
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
    return ['lost','on_hold'].indexOf(p.status) === -1; 
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
  html += '.status-prospect{background:rgba(100,181,246,0.12);color:#64b5f6}';
  html += '.status-tor{background:rgba(186,104,200,0.12);color:#ba68c8}';
  html += '.status-quote{background:rgba(255,183,77,0.12);color:#ffb74d}';
  html += '.status-bidding{background:rgba(255,235,59,0.12);color:#fdd835}';
  html += '.status-nego{background:rgba(77,208,225,0.12);color:#4dd0e1}';
  html += '.status-win{background:rgba(129,199,132,0.12);color:#81c784}';
  html += '.status-ordered{background:rgba(76,175,80,0.12);color:#4caf50}';
  html += '.status-delivered{background:rgba(76,175,80,0.15);color:#66bb6a}';
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
    if (p.status === 'prospect') statusClass = 'status-prospect';
    else if (p.status === 'tor_review') statusClass = 'status-tor';
    else if (p.status === 'quotation') statusClass = 'status-quote';
    else if (p.status === 'bidding') statusClass = 'status-bidding';
    else if (p.status === 'negotiation') statusClass = 'status-nego';
    else if (p.status === 'win') statusClass = 'status-win';
    else if (p.status === 'ordered') statusClass = 'status-ordered';
    else if (p.status === 'delivered') statusClass = 'status-delivered';
    else statusClass = 'status-prospect';
    
    var statusText = '';
    if (p.status === 'prospect') statusText = '🔵 Prospect';
    else if (p.status === 'tor_review') statusText = '🟣 TOR Review';
    else if (p.status === 'quotation') statusText = '🟠 Quotation';
    else if (p.status === 'bidding') statusText = '🟡 Bidding';
    else if (p.status === 'negotiation') statusText = '🔵 Negotiation';
    else if (p.status === 'win') statusText = '🟢 Win';
    else if (p.status === 'ordered') statusText = '🟢 Ordered';
    else if (p.status === 'delivered') statusText = '✅ Delivered';
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
  html += '  var m={prospect:"🔵 Prospect",tor_review:"🟣 TOR Review",quotation:"🟠 Quotation",bidding:"🟡 Bidding",negotiation:"🔵 Negotiation",win:"🟢 Win",ordered:"🟢 Ordered",delivered:"✅ Delivered"};';
  html += '  return m[status] || status;';
  html += '}';
  html += 'function getStatusClass(status){';
  html += '  var m={prospect:"status-prospect",tor_review:"status-tor",quotation:"status-quote",bidding:"status-bidding",negotiation:"status-nego",win:"status-win",ordered:"status-ordered",delivered:"status-delivered"};';
  html += '  return m[status] || "status-prospect";';
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
  closeModal();
  render();
}

function copyClientLink(url, dealerName) {
  copyText(url, '🔗 คัดลอกลิงก์สำหรับ ' + dealerName + ' แล้ว');
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

function closeModal() {
  var modal = document.querySelector('.modal-overlay');
  if (modal) modal.remove();
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
// MANAGE PIN ONLY
// ================================================================

async function showChangePinModal(dealerId) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;
  
  var currentPin = '';
  try {
    var pinDoc = await db.collection('dealerUpdates').doc(dealerId).get();
    if (pinDoc.exists && pinDoc.data().pin) {
      currentPin = pinDoc.data().pin;
    }
  } catch(e) {}
  
  var html = `
    <div style="max-width:400px">
      <div class="form-group">
        <label>🏪 Dealer</label>
        <div><strong>${sanitize(dealer.name)}</strong></div>
      </div>
      <div class="form-group">
        <label>🔒 ตั้งรหัสผ่าน (PIN)</label>
        <input type="password" id="changePinInput" class="form-control" value="${currentPin}" placeholder="ใส่รหัส 4-6 หลัก" maxlength="6">
        <div class="hint">💡 ถ้าเว้นว่าง จะลบ PIN (ลูกค้าไม่ต้องใส่รหัส)</div>
      </div>
      <div class="bg" style="margin-top:8px">
        <button class="btn bp" onclick="savePinOnly('${dealerId}')">💾 บันทึก PIN</button>
        <button class="btn bo" onclick="closeModal()">ยกเลิก</button>
      </div>
    </div>
  `;
  
  openM('🔒 ตั้งรหัสผ่านสำหรับ ' + dealer.name, html);
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
    closeModal();
  } catch(e) {
    toast('❌ เกิดข้อผิดพลาด: ' + e.message);
  }
}
// ✅ แสดงลิงก์ปัจจุบัน (แทนที่ showTokenList เดิม)
async function showCurrentLinkModal(dealerId) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;
  
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
  
  var pinStatus = currentPin ? '🔒 มี PIN (ลูกค้าต้องใส่รหัส)' : '🔓 ไม่มี PIN (เข้าได้เลย)';
  var pinWarning = currentPin ? `<div class="hint" style="margin-top:8px;padding:8px;background:#f59e0b20;border-radius:8px;border-left:3px solid #f59e0b">
    🔑 <strong>PIN สำหรับลูกค้า:</strong> ${currentPin}
    <div class="hint">⚠️ แจ้ง PIN แยกช่องทาง ห้ามใส่ในลิงก์</div>
  </div>` : '';
  
  var html = `
    <div style="max-width:500px">
      <div class="form-group"><label>🏪 Dealer</label><div><strong>${sanitize(dealer.name)}</strong></div></div>
      <div class="form-group"><label>🔗 ลิงก์ปัจจุบัน</label>
        <div style="background:var(--bg);padding:12px;border-radius:8px;word-break:break-all;font-family:monospace;font-size:11px">${currentUrl}</div>
        <div class="hint" style="margin-top:4px">${pinStatus}</div>
      </div>
      ${pinWarning}
      <div class="bg" style="margin-top:12px">
        <button class="btn bp" onclick="copyToClipboard('${currentUrl.replace(/'/g, "\\'")}')">📋 คัดลอกลิงก์</button>
        <button class="btn bd" onclick="window.open('${currentUrl}', '_blank')">🔗 ทดสอบเปิด</button>
      </div>
      <div class="hint" style="margin-top:12px;font-size:11px">💡 ต้องการเปลี่ยน PIN? กดปุ่ม "🔒 PIN" ด้านบน</div>
    </div>
  `;
  
  openM('🔗 ลิงก์ปัจจุบัน', html);
}
// ================================================================
// DEALER DEMO TAB (กำหนด Demo Option และรายการอุปกรณ์)
// ================================================================

function dealerDemoTab(d) {
  var demoOption = d.demoOption || 'option1';
  var demoItems = d.demoItems || [];
  var cfg = getConfig();
  
  // ดึงรายการ Model ที่ต้องมีตาม Option (จาก Config)
  var requiredOption1 = cfg.levelRequirements?.A?.option1Models || 
    ['DJI Matrice 4E', 'DJI Matrice 4T', 'DJI Zenmuse L2', 'DJI Zenmuse H30T'];
  var requiredOption2 = cfg.levelRequirements?.A?.option2Models || 
    ['DJI Dock 2', 'DJI Dock 3', 'DJI Matrice 4TD'];
  
  var html = '<div class="card">';
  html += '<h2>🚁 Demo Requirement <span class="ml"><span class="hint" style="font-size:11px">ตั้งค่าสำหรับ Dealer นี้โดยเฉพาะ</span></span></h2>';
  
  // ===== 1. Demo Option Selection =====
  html += '<div class="form-section">📌 เลือก Option ที่ Dealer ใช้</div>';
  html += '<div class="radio-g" style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:8px">';
  html += '<label style="padding:8px 12px;background:' + (demoOption === 'none' ? 'var(--accent-light)' : 'var(--bg2)') + ';border-radius:10px;cursor:pointer"><input type="radio" name="demoOption" value="none"' + (demoOption === 'none' ? ' checked' : '') + ' style="margin-right:5px"><span>❌ ไม่มีข้อกำหนด</span></label>';
  html += '<label style="padding:8px 12px;background:' + (demoOption === 'option1' ? 'var(--accent-light)' : 'var(--bg2)') + ';border-radius:10px;cursor:pointer"><input type="radio"name="demoOption" value="option1"' + (demoOption === 'option1' ? ' checked' : '') + '><span>📦 Option 1 (Drone + Payload)</span></label>';
  html += '<label style="padding:8px 12px;background:' + (demoOption === 'option2' ? 'var(--accent-light)' : 'var(--bg2)') + ';border-radius:10px;cursor:pointer"><input type="radio" name="demoOption" value="option2"' + (demoOption === 'option2' ? ' checked' : '') + '><span>🏗️ Option 2 (Dock + Drone)</span></label>';
  html += '<label style="padding:8px 12px;background:' + (demoOption === 'both' ? 'var(--accent-light)' : 'var(--bg2)') + ';border-radius:10px;cursor:pointer"><input type="radio" name="demoOption" value="both"' + (demoOption === 'both' ? ' checked' : '') + '><span>📦🏗️ Both (ต้องมีทั้งสอง)</span></label>';
  html += '</div>';
  
  // ===== 2. รายการอุปกรณ์ที่มีอยู่ =====
  html += '<div class="form-section">📦 รายการอุปกรณ์ Demo ที่มีอยู่</div>';
  html += '<div class="hint" style="margin-bottom:8px">💡 กรอก Serial Number ของอุปกรณ์ที่ Dealer มีอยู่จริง (จากที่แจ้งมา)</div>';
  html += '<div id="demoItemsList" style="margin-bottom:12px">';
  
  for (var i = 0; i < demoItems.length; i++) {
    html += '<div class="demo-item-row" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:8px;background:var(--bg2);border-radius:10px">';
    html += '<div style="flex:1;min-width:0">';
    html += '<select id="demo_model_' + i + '" class="demo-model" style="width:100%" data-idx="' + i + '">' + modelOptionsNew(demoItems[i].model) + '</select>';
    html += '</div>';
    html += '<div style="flex:1">';
    html += '<input type="text" id="demo_sn_' + i + '" class="demo-sn" style="width:100%" placeholder="Serial Number (ถ้ามี)" value="' + sanitize(demoItems[i].serialNumber || '') + '">';
    html += '</div>';
    html += '<button class="btn bsm bd" onclick="removeDemoItem(' + i + ')">🗑️</button>';
    html += '</div>';
  }
  
  html += '</div>';
  html += '<button class="btn bsm bp" onclick="addDemoItemRow()" style="margin-bottom:16px">➕ เพิ่มอุปกรณ์</button>';
  
  // ===== 3. Preview สถานะตาม Option ที่เลือก =====
  html += '<div class="form-section">📊 สถานะปัจจุบัน (Preview)</div>';
  html += '<div id="demoPreviewContainer">';
  html += renderDemoPreview(d, requiredOption1, requiredOption2);
  html += '</div>';
  
  // ===== 4. Save Button =====
  html += '<div class="bg" style="margin-top:16px;gap:12px">';
  html += '<button class="btn bp" onclick="saveDemoSetting(\'' + d.id + '\')" style="flex:1">💾 บันทึกการตั้งค่า Demo</button>';
  html += '<button class="btn bo" onclick="syncDemoToGlobal(\'' + d.id + '\')" style="flex:1">🔄 Sync ไปยังหน้า Demo Equipment</button>';
  html += '</div>';
  
  html += '</div>';
  
  // เพิ่ม script สำหรับ preview แบบ Real-time
  html += '<script>';
  html += 'function updateDemoPreview() {';
  html += '  var dealerId = "' + d.id + '";';
  html += '  var demoOption = document.querySelector(\'input[name="demoOption"]:checked\').value;';
  html += '  var demoItems = [];';
  html += '  var rows = document.querySelectorAll("#demoItemsList .demo-item-row");';
  html += '  for(var i=0;i<rows.length;i++){';
  html += '    var model = rows[i].querySelector(".demo-model").value;';
  html += '    var sn = rows[i].querySelector(".demo-sn").value;';
  html += '    if(model) demoItems.push({model:model,serialNumber:sn});';
  html += '  }';
  html += '  var previewHtml = renderDemoPreviewDynamic(demoOption, demoItems);';
  html += '  document.getElementById("demoPreviewContainer").innerHTML = previewHtml;';
  html += '}';
  html += 'document.querySelectorAll(\'input[name="demoOption"]\').forEach(function(btn){ btn.onclick = function(){ setTimeout(updateDemoPreview, 50); }; });';
  html += 'setInterval(updateDemoPreview, 500);';
  html += '</script>';
  
  return html;
}

// ================================================================
// HELPER FUNCTIONS FOR DEMO TAB
// ================================================================

function addDemoItemRow() {
  var container = document.getElementById('demoItemsList');
  var idx = Date.now();
  var newRow = '<div class="demo-item-row" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:8px;background:var(--bg2);border-radius:10px">';
  newRow += '<div style="flex:1"><select id="demo_model_' + idx + '" class="demo-model" style="width:100%">' + modelOptionsNew('') + '</select></div>';
  newRow += '<div style="flex:1"><input type="text" id="demo_sn_' + idx + '" class="demo-sn" style="width:100%" placeholder="Serial Number"></div>';
  newRow += '<button class="btn bsm bd" onclick="removeDemoItemRow(this)">🗑️</button>';
  newRow += '</div>';
  container.insertAdjacentHTML('beforeend', newRow);
}

function removeDemoItemRow(btn) {
  btn.closest('.demo-item-row').remove();
  updateDemoPreview();
}

function removeDemoItem(idx) {
  var row = document.querySelector('#demoItemsList .demo-item-row .demo-model[data-idx="' + idx + '"]');
  if (row) row.closest('.demo-item-row').remove();
  updateDemoPreview();
}

function renderDemoPreview(dealer, requiredOption1, requiredOption2) {
  var demoOption = dealer.demoOption || 'option1';
  var demoItems = dealer.demoItems || [];
  
  var ownedModels = {};
  for (var i = 0; i < demoItems.length; i++) {
    if (demoItems[i] && demoItems[i].model) {
      ownedModels[demoItems[i].model] = demoItems[i];
    }
  }
  
  var optionText = {
    'none': '❌ ไม่มีข้อกำหนด',
    'option1': '📦 Option 1 (Drone + Payload)',
    'option2': '🏗️ Option 2 (Dock + Drone)',
    'both': '📦🏗️ Both Options'
  };
  
  var html = '<div style="background:var(--bg3);border-radius:12px;padding:12px">';
  html += '<div style="margin-bottom:8px"><strong>📌 ตัวเลือก:</strong> ' + optionText[demoOption] + '</div>';
  
  if (demoOption === 'none') {
    html += '<div class="hint">ℹ️ ไม่มีข้อกำหนด Demo สำหรับ Dealer นี้</div>';
    html += '</div>';
    return html;
  }
  
  // Helper to check if a model is required
  function isRequired(model, option) {
    if (option === 'option1') return requiredOption1.indexOf(model) !== -1;
    if (option === 'option2') return requiredOption2.indexOf(model) !== -1;
    return true;
  }
  
  if (demoOption === 'option1' || demoOption === 'both') {
    html += '<div style="margin-top:8px"><strong>📦 Option 1 (ต้องมี):</strong></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">';
    for (var i = 0; i < requiredOption1.length; i++) {
      var model = requiredOption1[i];
      var has = ownedModels[model];
      html += '<div style="padding:8px 12px;border-radius:10px;background:' + (has ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') + ';border:1px solid ' + (has ? '#22c55e' : '#ef4444') + '">';
      html += '<div style="font-weight:600">' + (has ? '✅' : '❌') + ' ' + sanitize(model) + '</div>';
      if (has && has.serialNumber) html += '<div style="font-size:10px;color:var(--text2);margin-top:4px">🔢 ' + sanitize(has.serialNumber) + '</div>';
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
      html += '<div style="padding:8px 12px;border-radius:10px;background:' + (has ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') + ';border:1px solid ' + (has ? '#22c55e' : '#ef4444') + '">';
      html += '<div style="font-weight:600">' + (has ? '✅' : '❌') + ' ' + sanitize(model) + '</div>';
      if (has && has.serialNumber) html += '<div style="font-size:10px;color:var(--text2);margin-top:4px">🔢 ' + sanitize(has.serialNumber) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

function renderDemoPreviewDynamic(demoOption, demoItems) {
  var cfg = getConfig();
  var requiredOption1 = cfg.levelRequirements?.A?.option1Models || 
    ['DJI Matrice 4E', 'DJI Matrice 4T', 'DJI Zenmuse L2', 'DJI Zenmuse H30T'];
  var requiredOption2 = cfg.levelRequirements?.A?.option2Models || 
    ['DJI Dock 2', 'DJI Dock 3', 'DJI Matrice 4TD'];
  
  var ownedModels = {};
  for (var i = 0; i < demoItems.length; i++) {
    if (demoItems[i] && demoItems[i].model) {
      ownedModels[demoItems[i].model] = demoItems[i];
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
      html += '<div style="padding:8px 12px;border-radius:10px;background:' + (has ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') + ';border:1px solid ' + (has ? '#22c55e' : '#ef4444') + '">';
      html += '<div style="font-weight:600">' + (has ? '✅' : '❌') + ' ' + sanitize(model) + '</div>';
      if (has && has.serialNumber) html += '<div style="font-size:10px;color:var(--text2);margin-top:4px">🔢 ' + sanitize(has.serialNumber) + '</div>';
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
      html += '<div style="padding:8px 12px;border-radius:10px;background:' + (has ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') + ';border:1px solid ' + (has ? '#22c55e' : '#ef4444') + '">';
      html += '<div style="font-weight:600">' + (has ? '✅' : '❌') + ' ' + sanitize(model) + '</div>';
      if (has && has.serialNumber) html += '<div style="font-size:10px;color:var(--text2);margin-top:4px">🔢 ' + sanitize(has.serialNumber) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

function saveDemoSetting(dealerId) {
  // Get selected option
  var demoOptionElem = document.querySelector('input[name="demoOption"]:checked');
  if (!demoOptionElem) {
    toast('⚠️ กรุณาเลือก Option');
    return;
  }
  var demoOption = demoOptionElem.value;
  
  // Collect demo items
  var demoItems = [];
  var rows = document.querySelectorAll('#demoItemsList .demo-item-row');
  for (var i = 0; i < rows.length; i++) {
    var modelSelect = rows[i].querySelector('.demo-model');
    var snInput = rows[i].querySelector('.demo-sn');
    if (modelSelect && modelSelect.value) {
      demoItems.push({
        model: modelSelect.value,
        serialNumber: snInput ? snInput.value.trim() : ''
      });
    }
  }
  
  // Update dealer
  ST.update('dealers', dealerId, {
    demoOption: demoOption,
    demoItems: demoItems
  });
  
  // Audit log
  if (typeof addAuditLog === 'function') {
    var dealer = ST.getOne('dealers', dealerId);
    addAuditLog('update_dealer_demo', 'dealer', dealerId, dealer ? dealer.name : '', dealerId, dealer ? dealer.name : '', {
      demoOption: demoOption,
      itemCount: demoItems.length
    });
  }
  
  toast('💾 บันทึกการตั้งค่า Demo แล้ว');
  render();
}

function syncDemoToGlobal(dealerId) {
  var dealer = ST.getOne('dealers', dealerId);
  if (!dealer) return;
  
  var demoItems = dealer.demoItems || [];
  if (demoItems.length === 0) {
    toast('⚠️ ไม่มีอุปกรณ์ Demo ให้ Sync');
    return;
  }
  
  // Get existing global demo items
  var globalDemo = [];
  try {
    globalDemo = JSON.parse(localStorage.getItem('v7_demo') || '[]');
  } catch(e) {}
  
  // Remove existing items for this dealer
  globalDemo = globalDemo.filter(function(d) { return d.dealerId !== dealerId; });
  
  // Add new items
  for (var i = 0; i < demoItems.length; i++) {
    globalDemo.push({
      id: 'dm_' + Date.now() + '_' + i,
      name: demoItems[i].model,
      model: demoItems[i].model,
      serialNumber: demoItems[i].serialNumber,
      dealerId: dealerId,
      status: 'lent',
      lentDate: _td(),
      note: 'Synced from Dealer Demo Tab'
    });
  }
  
  localStorage.setItem('v7_demo', JSON.stringify(globalDemo));
  
  toast('🔄 Sync อุปกรณ์ Demo ไปยังหน้า Demo Equipment แล้ว (' + demoItems.length + ' รายการ)');
  render();
}
