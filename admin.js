// ================================================================
// ADMIN PANEL - FULLY INTEGRATED WITH PRODUCTS MODULE
// ================================================================
function rAdmin(el) {
  document.getElementById('pgT').textContent = '⚙️ ตั้งค่า';
  var cfg = getConfig();
  var counts = ST.getCollectionCounts();
  var ap = getAppearance();

  var countCards = '';
  var countData = [
    ['dealers', '🏪 Dealer'], ['pipeline', '📊 Pipeline'], ['visits', '🤝 Visit'],
    ['followups', '📞 FU'], ['tasks', '📋 Task'], ['meetings', '📅 Meeting'],
    ['lineLog', '💬 LINE'], ['emails', '📧 Email'], ['feedback', '💡 FB'], ['timerLogs', '⏱️ Timer']
  ];
  for (var i = 0; i < countData.length; i++) {
    var k = countData[i][0];
    var v = countData[i][1];
    countCards += '<div class="sc"><div class="sn c1">' + (counts[k] || 0) + '</div><div class="sl">' + v + '</div></div>';
  }

 // Pipeline statuses
  var pstRows = '';
  for (var i = 0; i < cfg.pipelineStatuses.length; i++) {
    var s = cfg.pipelineStatuses[i];
    pstRows += '<div class="admin-row" style="display:flex;align-items:center;gap:4px">' +
      '<span style="color:var(--text2);font-size:11px;font-weight:700;min-width:20px;text-align:center">' + (i + 1) + '</span>' +
      '<input type="text" value="' + s.id + '" id="aps_id_' + i + '" style="width:70px" readonly>' +
      '<input type="text" value="' + sanitize(s.name) + '" id="aps_nm_' + i + '">' +
      '<input type="color" value="' + s.color + '" id="aps_cl_' + i + '" style="width:35px;padding:1px">' +
      '<select id="aps_cat_' + i + '" style="font-size:11px;padding:2px 4px;border:1px solid var(--border);border-radius:6px;background:var(--bg2);color:var(--text)">' +
        '<option value="active"' + (s.category === 'active' ? ' selected' : '') + '>🔵 Active</option>' +
        '<option value="won"' + (s.category === 'won' ? ' selected' : '') + '>🟢 Win</option>' +
        '<option value="lost"' + (s.category === 'lost' ? ' selected' : '') + '>🔴 Lost</option>' +
      '</select>' +
      '<button class="btn bsm bo" onclick="movePipeStatus(' + i + ',-1)" title="ขึ้น" style="padding:2px 6px">⬆️</button>' +
      '<button class="btn bsm bo" onclick="movePipeStatus(' + i + ',1)" title="ลง" style="padding:2px 6px">⬇️</button>' +
      '<button class="btn bsm bd" onclick="admRmPSt(' + i + ')">✕</button>' +
      '</div>';
  }
  pstRows += '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn bsm bo" onclick="migratePipelineStatuses()" title="แปลง status เก่า→ใหม่ ครั้งเดียว">🔄 Migrate status เก่า→ใหม่</button>' +
    '<button class="btn bsm bd" onclick="admResetPipeStatuses()" title="รีเซ็ตกลับเป็น 8 status มาตรฐาน (ลบ custom ทั้งหมด)">♻️ Reset ค่าเริ่มต้น</button>' +
    '</div>';

  // Links
  var linkRows = '';
  var links = cfg.externalLinks || [];
  for (var i = 0; i < links.length; i++) {
    linkRows += '<div class="link-item">' +
      '<input type="text" value="' + sanitize(links[i].name || '') + '" id="lk_n_' + i + '" style="width:80px">' +
      '<input type="url" value="' + (links[i].url || '') + '" id="lk_u_' + i + '" style="flex:1">' +
      '<button class="btn bsm bd" onclick="admRmLink(' + i + ')">✕</button>' +
      '</div>';
  }

  // Quick links display
  var quickLinks = '';
  if (links.length) {
    quickLinks = '<div class="card"><h2>🔗 Quick Links</h2><div class="bg">';
    for (var i = 0; i < links.length; i++) {
      quickLinks += '<a href="' + links[i].url + '" target="_blank" class="btn bo">' + sanitize(links[i].name) + ' ↗</a>';
    }
    quickLinks += '</div></div>';
  }

  // Routines
  var rtRows = '';
  var routines = ST.getAll('routines');
  for (var i = 0; i < routines.length; i++) {
    var r = routines[i];
    rtRows += '<div class="rt-item" style="margin-top:4px">' +
      '<div class="rt-time">' + (r.time || '') + '</div>' +
      '<div class="rt-title">' + sanitize(r.title) + '</div>' +
      '<span class="rt-tag">' + (DAY_NAMES[r.days] || r.days) + '</span>' +
      '<button class="btn bsm bo" onclick="showRoutineM(\'' + r.id + '\')">✏️</button>' +
      '<button class="btn bsm bd" onclick="admDelRoutine(\'' + r.id + '\')">✕</button>' +
      '</div>';
  }

  // Templates
  var tplRows = '';
  var templates = ST.getAll('templates');
  for (var i = 0; i < templates.length; i++) {
    var tp = templates[i];
    tplRows += '<div class="li" onclick="showTplDet(\'' + tp.id + '\')">' +
      '<div class="lm"><div class="lt">📑 ' + sanitize(tp.name) + '</div>' +
      '<div class="ls">' + (tp.steps || []).length + ' steps ' + (tp.sequential ? '⚡' : '') + '</div></div></div>';
  }
  setTimeout(function() {
    initNewDemoPolicies();
  }, 100);

  var activeAdminTab = localStorage.getItem('v7_admin_tab') || 'general';
  function aTab(id) { return id === activeAdminTab ? ' act' : ''; }

  el.innerHTML =
    '<div class="admin-tabs">' +
    '<div class="admin-tab' + aTab('general') + '" onclick="switchAdminTab(\'general\')">👤 ทั่วไป</div>' +
    '<div class="admin-tab' + aTab('appearance') + '" onclick="switchAdminTab(\'appearance\')">🎨 หน้าตา</div>' +
    '<div class="admin-tab' + aTab('data') + '" onclick="switchAdminTab(\'data\')">📋 ข้อมูล</div>' +
    '<div class="admin-tab' + aTab('connect') + '" onclick="switchAdminTab(\'connect\')">☁️ เชื่อมต่อ</div>' +
    '<div class="admin-tab' + aTab('advanced') + '" onclick="switchAdminTab(\'advanced\')">⚙️ ขั้นสูง</div>' +
    '</div>' +

    // ===== TAB: ทั่วไป =====
    '<div class="admin-tab-pane' + aTab('general') + '" id="atp-general">' +

    // Profile
    '<div class="card"><h2>👤 Profile</h2>' +
    '<div class="admin-row"><label>ชื่อ Sale</label>' +
    '<input type="text" id="adm_name" value="' + sanitize(cfg.saleName) + '"></div>' +
    '<button class="btn bp bsm" onclick="admSaveName()">💾 บันทึก</button></div>' +

    // KPI Settings
    '<div class="card"><h2>🎯 KPI Settings</h2>' +
    '<div class="admin-row"><label>Follow-up / สัปดาห์</label>' +
    '<input type="number" id="adm_kpi_fu" value="' + cfg.kpi.followupPerWeek + '" min="0"></div>' +
    '<div class="admin-row"><label>Visit / สัปดาห์</label>' +
    '<input type="number" id="adm_kpi_vs" value="' + cfg.kpi.visitPerWeek + '" min="0"></div>' +
    '<button class="btn bp bsm" onclick="admSaveKPI()">💾 บันทึก</button></div>' +

    // H1 Period Setting
    '<div class="card" id="periodSettingCard"><h2>📅 H1 Period Setting</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">กำหนดช่วงเวลาครึ่งปีแรก (ใช้สำหรับคำนวณยอดขาย SIS รายเดือน — ไม่ต้องจบภายใน มิ.ย. แล้ว เลือกได้ทั้งปี เช่น ก.พ.-ก.ค.)</p>' +
    '<div class="fr">' +
    '<div class="fg"><label>📆 เริ่มต้นเดือน</label><select id="h1_start_month" class="fm-input">' +
    THAI_MONTHS_SHORT.map(function(m, i) { return '<option value="' + i + '"' + (cfg.h1Period?.startMonth === i ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="fg"><label>📅 เริ่มต้นวันที่</label><input type="number" id="h1_start_day" class="fm-input" value="' + (cfg.h1Period?.startDay || 1) + '" min="1" max="31"></div>' +
    '</div>' +
    '<div class="fr">' +
    '<div class="fg"><label>📆 สิ้นสุดเดือน</label><select id="h1_end_month" class="fm-input">' +
    THAI_MONTHS_SHORT.map(function(m, i) { return '<option value="' + i + '"' + (cfg.h1Period?.endMonth === i ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="fg"><label>📅 สิ้นสุดวันที่</label><input type="number" id="h1_end_day" class="fm-input" value="' + (cfg.h1Period?.endDay || 30) + '" min="1" max="31"></div>' +
    '</div>' +
    '<button class="btn bp bsm" onclick="saveH1Period()">💾 บันทึก Period</button></div>' +

    // H2 Period Setting
    '<div class="card"><h2>📅 H2 Period Setting</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">กำหนดช่วงเวลาครึ่งปีหลัง (ใช้สำหรับคำนวณยอดขาย SIS รายเดือน — เลือกได้ทั้งปี ไม่ต้องเริ่ม ก.ค.)</p>' +
    '<div class="fr">' +
    '<div class="fg"><label>📆 เริ่มต้นเดือน</label><select id="h2_start_month" class="fm-input">' +
    THAI_MONTHS_SHORT.map(function(m, i) { return '<option value="' + i + '"' + (cfg.h2Period?.startMonth === i ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="fg"><label>📅 เริ่มต้นวันที่</label><input type="number" id="h2_start_day" class="fm-input" value="' + (cfg.h2Period?.startDay || 1) + '" min="1" max="31"></div>' +
    '</div>' +
    '<div class="fr">' +
    '<div class="fg"><label>📆 สิ้นสุดเดือน</label><select id="h2_end_month" class="fm-input">' +
    THAI_MONTHS_SHORT.map(function(m, i) { return '<option value="' + i + '"' + (cfg.h2Period?.endMonth === i ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="fg"><label>📅 สิ้นสุดวันที่</label><input type="number" id="h2_end_day" class="fm-input" value="' + (cfg.h2Period?.endDay || 31) + '" min="1" max="31"></div>' +
    '</div>' +
    '<button class="btn bp bsm" onclick="saveH2Period()">💾 บันทึก Period</button>' +
    '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.78rem">' +
    '<input type="checkbox" id="h2_show_clientview" ' + (cfg.showH2InClientView !== false ? 'checked' : '') + ' onchange="toggleShowH2InClientView()">' +
    '👁️ แสดงแท็บ H2 / รวมทั้งปี ใน Client-view (ปิดถ้ายังไม่พร้อมโชว์ข้อมูล H2)</label>' +
    '</div></div>' +

    // Notification
    '<div class="card"><h2>🔔 Browser Notification</h2>' +
    '<button class="btn bs" onclick="admReqNotif()">🔔 เปิดการแจ้งเตือน</button>' +
    '<div style="margin-top:4px;font-size:.68rem;color:var(--text2)" id="adm_nf_status"></div></div>' +

    // Quick Links
    quickLinks +

    '</div>' + // end tab general

    // ===== TAB: หน้าตา =====
    '<div class="admin-tab-pane' + aTab('appearance') + '" id="atp-appearance">' +
    '<div class="card"><h2>🎨 Appearance</h2>' +
    '<div class="appearance-grid">' +
    
    // Theme
    '<div class="appearance-section"><h4>🎨 Theme</h4>' +
    '<div class="option-group">' +
    '<button class="option-btn ' + (ap.theme === 'dark' ? 'active' : '') + '" onclick="setAppOpt(\'theme\',\'dark\')">🌙 Dark</button>' +
    '<button class="option-btn ' + (ap.theme === 'midnight' ? 'active' : '') + '" onclick="setAppOpt(\'theme\',\'midnight\')">🌑 Midnight</button>' +
    '<button class="option-btn ' + (ap.theme === 'light' ? 'active' : '') + '" onclick="setAppOpt(\'theme\',\'light\')">☀️ Light</button>' +
    '</div></div>' +
    
    // Accent Color
    '<div class="appearance-section"><h4>🎨 สี Accent</h4>' +
    '<div class="color-picker">' +
    ACCENT_COLORS.map(function(c) {
      return '<div class="color-dot ' + (ap.accent === c.id ? 'active' : '') + '" style="background:' + c.color + '" onclick="setAppOpt(\'accent\',\'' + c.id + '\')" title="' + c.id + '">' + (ap.accent === c.id ? '✓' : '') + '</div>';
    }).join('') +
    '</div></div>' +
    
    // Font Size
    '<div class="appearance-section"><h4>📏 ขนาดตัวอักษร</h4>' +
    '<div class="option-group">' +
    '<button class="option-btn ' + (ap.fontSize === 'small' ? 'active' : '') + '" onclick="setAppOpt(\'fontSize\',\'small\')">เล็ก</button>' +
    '<button class="option-btn ' + (ap.fontSize === 'normal' ? 'active' : '') + '" onclick="setAppOpt(\'fontSize\',\'normal\')">ปกติ</button>' +
    '<button class="option-btn ' + (ap.fontSize === 'large' ? 'active' : '') + '" onclick="setAppOpt(\'fontSize\',\'large\')">ใหญ่</button>' +
    '</div></div>' +
    
    // Sidebar
    '<div class="appearance-section"><h4>📐 Sidebar</h4>' +
    '<div class="option-group">' +
    '<button class="option-btn ' + (ap.sidebar === 'narrow' ? 'active' : '') + '" onclick="setAppOpt(\'sidebar\',\'narrow\')">แคบ</button>' +
    '<button class="option-btn ' + (ap.sidebar === 'normal' ? 'active' : '') + '" onclick="setAppOpt(\'sidebar\',\'normal\')">ปกติ</button>' +
    '<button class="option-btn ' + (ap.sidebar === 'wide' ? 'active' : '') + '" onclick="setAppOpt(\'sidebar\',\'wide\')">กว้าง</button>' +
    '</div></div>' +
    
    // Card Style
    '<div class="appearance-section"><h4>🃏 Card Style</h4>' +
    '<div class="option-group">' +
    '<button class="option-btn ' + (ap.cardStyle === 'rounded' ? 'active' : '') + '" onclick="setAppOpt(\'cardStyle\',\'rounded\')">มุมมน</button>' +
    '<button class="option-btn ' + (ap.cardStyle === 'square' ? 'active' : '') + '" onclick="setAppOpt(\'cardStyle\',\'square\')">เหลี่ยม</button>' +
    '<button class="option-btn ' + (ap.cardStyle === 'flat' ? 'active' : '') + '" onclick="setAppOpt(\'cardStyle\',\'flat\')">Flat</button>' +
    '</div></div>' +
    
    // Spacing
    '<div class="appearance-section"><h4>📐 Spacing</h4>' +
    '<div class="option-group">' +
    '<button class="option-btn ' + (ap.spacing === 'compact' ? 'active' : '') + '" onclick="setAppOpt(\'spacing\',\'compact\')">แน่น</button>' +
    '<button class="option-btn ' + (ap.spacing === 'normal' ? 'active' : '') + '" onclick="setAppOpt(\'spacing\',\'normal\')">ปกติ</button>' +
    '<button class="option-btn ' + (ap.spacing === 'relaxed' ? 'active' : '') + '" onclick="setAppOpt(\'spacing\',\'relaxed\')">โปร่ง</button>' +
    '</div></div>' +
    
    // Table Size
    '<div class="appearance-section"><h4>📊 ขนาดตาราง</h4>' +
    '<div class="option-group">' +
    '<button class="option-btn ' + (ap.tableSize === 'small' ? 'active' : '') + '" onclick="setAppOpt(\'tableSize\',\'small\')">เล็ก</button>' +
    '<button class="option-btn ' + (ap.tableSize === 'normal' ? 'active' : '') + '" onclick="setAppOpt(\'tableSize\',\'normal\')">ปกติ</button>' +
    '<button class="option-btn ' + (ap.tableSize === 'large' ? 'active' : '') + '" onclick="setAppOpt(\'tableSize\',\'large\')">ใหญ่</button>' +
    '</div></div>' +
    
    '</div>' +
    
    // Reset + Preview
    '<div class="bg"><button class="btn bo" onclick="resetAppearance()">🔄 Reset Default</button></div>' +
    
    // Preview
    '<div class="preview-box"><h4>👁️ Preview</h4><p>ตัวอย่างข้อความ — เห็นผลทันทีเมื่อเปลี่ยน</p>' +
    '<div style="display:flex;gap:4px;margin-top:4px"><button class="btn bp bsm">ปุ่มหลัก</button><button class="btn bs bsm">สำเร็จ</button><button class="btn bd bsm">ลบ</button><button class="btn bo bsm">ขอบ</button></div>' +
    '<div class="li" style="margin-top:6px"><div class="lm"><div class="lt">ตัวอย่าง List Item</div><div class="ls">รายละเอียดเพิ่มเติม</div></div></div>' +
    '</div></div>' +

    '</div>' + // end tab appearance

    // ===== TAB: ข้อมูล =====
    '<div class="admin-tab-pane' + aTab('data') + '" id="atp-data">' +

    // Pipeline Statuses
    '<div class="card"><h2>📊 Pipeline Status</h2>' +
    '<div id="adm_pst">' + pstRows + '</div>' +
    '<div style="display:flex;gap:3px;margin-top:4px">' +
    '<input type="text" id="aps_new_id" placeholder="id (eng)" style="width:70px">' +
    '<input type="text" id="aps_new_nm" placeholder="ชื่อแสดง" style="flex:1">' +
    '<button class="btn bsm bp" onclick="admAddPSt()">➕</button></div>' +
    '<button class="btn bp bsm" style="margin-top:6px" onclick="admSavePSt()">💾 บันทึกทั้งหมด</button></div>' +

    // ===================== PRODUCTS MANAGEMENT (USING Products MODULE) =====================
    '<div class="card"><h2>📦 จัดการสินค้าทั้งหมด (Products Module)</h2>' +
    '<p style="font-size:.7rem;color:var(--text3);margin-bottom:6px">📌 สินค้าและราคาแสดงผลจาก Products Module (v7_products) แล้ว</p>' +
    '<div id="admProductList" style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">' +
    renderProductListForAdmin() +
    '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    '<button class="btn bp bsm" onclick="showAddProductAdminModal()">➕ เพิ่มสินค้า (ใช้ Products)</button>' +
    '<button class="btn bo bsm" onclick="exportProductsToExcel()">📥 Export Excel</button>' +
    '<button class="btn bo bsm" onclick="document.getElementById(\'importProductFileAdmin\').click()">📤 Import Excel</button>' +
    '<input type="file" id="importProductFileAdmin" accept=".xlsx,.xls" style="display:none" onchange="importProductsFromExcelAdmin(event)">' +
    '</div>' +
    '<div class="hint" style="margin-top:6px">💡 ข้อมูลสินค้าและราคาทั้งหมดถูกจัดการผ่าน Products module แล้ว</div>' +
    '</div>' +

    // Level Requirements
    '<div class="card"><h2>📋 Partner Level Requirements</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">กำหนดเป้าหมายและเงื่อนไขตามระดับ Dealer (S/A/B/Other)</p>' +
    '<div class="ftabs" style="margin-bottom:10px" id="reqLevelTabs">' +
    '<div class="ftab' + (currentReqLevel === 'S' ? ' act' : '') + '" data-level="S">S (Strategic)</div>' +
    '<div class="ftab' + (currentReqLevel === 'A' ? ' act' : '') + '" data-level="A">A (Authorized)</div>' +
    '<div class="ftab' + (currentReqLevel === 'B' ? ' act' : '') + '" data-level="B">B (Basic)</div>' +
    '<div class="ftab' + (currentReqLevel === 'Other' ? ' act' : '') + '" data-level="Other">Other (Trial)</div>' +
    '</div>' +
    '<div id="reqEditor"></div>' +
    '<div class="bg" style="margin-top:12px">' +
    '<button class="btn bp" onclick="saveLevelRequirements()">💾 บันทึก Requirements ทั้งหมด</button>' +
    '<button class="btn bo" onclick="resetLevelRequirements()">↻ Reset เป็นค่าเริ่มต้น</button>' +
    '</div></div>' +

    // New Demo Policies Management
    '<div class="card"><h2>⚠️ New Demo Policies Management</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">จัดการสินค้าใหม่ที่ต้องแจ้งเตือน Dealer (รองรับหลายรายการ)</p>' +
    '<div id="ndpListContainer"></div>' +
    '<div class="bg" style="margin-top:8px">' +
    '<button class="btn bp bsm" onclick="showAddNewDemoPolicyM()">➕ เพิ่มสินค้าใหม่</button>' +
    '<button class="btn bo bsm" onclick="resetNewDemoPolicies()">↻ Reset ค่าเริ่มต้น</button>' +
    '</div></div>' +

    // Unit Types
    '<div class="card"><h2>🏢 Unit Types</h2>' +
    '<textarea id="adm_units" rows="4" style="font-size:.72rem">' + cfg.unitTypes.join('\n') + '</textarea>' +
    '<button class="btn bp bsm" style="margin-top:4px" onclick="admSaveUnits()">💾 บันทึก</button></div>' +

    // DJI Dealer Types
    '<div class="card"><h2>🏪 DJI Dealer Types</h2>' +
    '<textarea id="adm_djitypes" rows="3" style="font-size:.72rem">' + (cfg.djiDealerTypes || []).join('\n') + '</textarea>' +
    '<div style="font-size:.62rem;color:var(--text2);margin:3px 0">แต่ละบรรทัด = 1 ประเภท</div>' +
    '<button class="btn bp bsm" onclick="admSaveDjiTypes()">💾 บันทึก</button></div>' +

    // Dealer Tiers
    '<div class="card"><h2>🏷️ Dealer Tiers</h2>' +
    '<textarea id="adm_tiers" rows="3" style="font-size:.72rem">' + (cfg.dealerTiers || []).join('\n') + '</textarea>' +
    '<button class="btn bp bsm" style="margin-top:4px" onclick="admSaveTiers()">💾 บันทึก</button></div>' +

    // Credit Terms
    '<div class="card"><h2>💰 Credit Terms</h2>' +
    '<textarea id="adm_terms" rows="3" style="font-size:.72rem">' + (cfg.creditTerms || []).join('\n') + '</textarea>' +
    '<button class="btn bp bsm" style="margin-top:4px" onclick="admSaveTerms()">💾 บันทึก</button></div>' +

    // Visit Topics
    '<div class="card"><h2>📋 Visit Topics</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:6px">หัวข้อที่ใช้ใน Visit Report — เพิ่ม/แก้ไข/เรียงลำดับได้</p>' +
    '<div style="font-size:.72rem;color:var(--text2);margin-bottom:6px">' +
    '📂 Groups: ' + (cfg.visitTopicGroups || []).length + ' กลุ่ม • ' +
    '📋 Topics: ' + (cfg.visitTopics || []).length + ' หัวข้อ</div>' +
    '<button class="btn bp" onclick="showAdminVisitTopics()">⚙️ จัดการ Visit Topics</button></div>' +

    // Monthly Checklist
    '<div class="card"><h2>📋 Monthly Checklist</h2>' +
    '<textarea id="adm_monthly" rows="5" style="font-size:.72rem">' + (cfg.monthlyChecklist || []).join('\n') + '</textarea>' +
    '<div style="font-size:.62rem;color:var(--text2);margin:3px 0">แต่ละบรรทัด = 1 รายการ (Reset ทุกต้นเดือน)</div>' +
    '<button class="btn bp bsm" onclick="admSaveMonthly()">💾 บันทึก</button></div>' +

    // Onboarding Steps Template
    '<div class="card"><h2>🔄 Onboarding Steps Template</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:6px">ขั้นตอน Onboard Dealer ใหม่ — ใช้เป็น Template สำหรับทุก Dealer</p>' +
    '<textarea id="adm_onboard" rows="10" style="font-size:.72rem">' +
    (cfg.onboardingSteps || []).map(function(s) { return s.title + '|' + (s.group || 'onboard'); }).join('\n') +
    '</textarea>' +
    '<div style="font-size:.62rem;color:var(--text3);margin:3px 0">แต่ละบรรทัด: ชื่อขั้นตอน|กลุ่ม (onboard หรือ after)</div>' +
    '<button class="btn bp bsm" onclick="admSaveOnboard()">💾 บันทึก</button></div>' +

    // Routine
    '<div class="card"><h2>🔄 Routine</h2>' +
    '<div class="bg" style="margin-bottom:6px">' +
    '<button class="btn bp bsm" onclick="showRoutineM()">➕ เพิ่ม</button>' +
    '<button class="btn bsm bd" onclick="admResetRoutines()">🔄 Reset Default</button></div>' +
    rtRows + '</div>' +

    // Templates
    '<div class="card"><h2>📑 Template</h2>' +
    '<button class="btn bp bsm" style="margin-bottom:6px" onclick="showTemplateM()">➕ สร้าง</button>' +
    tplRows + '</div>' +

    '</div>' + // end tab data

    // ===== TAB: เชื่อมต่อ =====
    '<div class="admin-tab-pane' + aTab('connect') + '" id="atp-connect">' +

    // Cloud Sync
    '<div class="card"><h2>☁️ Cloud Sync</h2>' +
    '<div style="font-size:.76rem;color:var(--text2);margin-bottom:8px">' +
    (SYNC_ENABLED ? '✅ Connected: ' + (CURRENT_USER ? CURRENT_USER.displayName : '-') : '❌ Offline Mode') +
    '</div>' +
    '<div class="bg" style="flex-wrap:wrap">' +
    (SYNC_ENABLED ?
      '<button class="btn bp" onclick="forceSyncAll()">🔄 Force Sync All</button>' +
      '<button class="btn bo" onclick="exportFullBackup()">📥 Export Full</button>' +
      '<button class="btn bo" onclick="importFullBackup()">📤 Import Full</button>' +
      '<button class="btn bo" onclick="location.reload(true)">🔄 Refresh</button>' +
      '<button class="btn bd" onclick="logoutUser()">👋 Logout</button>' :
      '<button class="btn bp" onclick="loginWithGoogle()">🔑 Login Google</button>' +
      '<button class="btn bo" onclick="exportFullBackup()">📥 Export Full</button>' +
      '<button class="btn bo" onclick="importFullBackup()">📤 Import Full</button>') +
    '</div></div>' +

    // Google Sheet Sync (แอป → Sheet ทางเดียว, auto ทุกครั้งที่บันทึก Pipeline ที่มี Row No. แล้ว)
    '<div class="card"><h2>📊 Google Sheet Sync</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">Sync ทางเดียว: แอป → Sheet อัตโนมัติทุกครั้งที่บันทึก Pipeline (ต้องมี Row No. แล้วเท่านั้น) — ทาง Sheet → แอป ยังใช้ปุ่ม Import แบบเดิม (มี preview ก่อนนำเข้า) ต้อง deploy Google Apps Script Web App ก่อนใช้งาน</p>' +
    '<div id="adm_sheetsync_status" style="font-size:.72rem;margin-bottom:8px;color:var(--text2)">⏳ กำลังโหลด...</div>' +
    '<div class="fg"><label style="font-size:.75rem">Apps Script Web App URL</label>' +
    '<input type="url" id="adm_sheetsync_url" placeholder="https://script.google.com/macros/s/.../exec" style="font-size:.78rem" autocomplete="off"></div>' +
    '<div class="fg" style="margin-top:6px"><label style="font-size:.75rem">Secret (ต้องตรงกับที่ตั้งในสคริปต์)</label>' +
    '<div style="display:flex;gap:6px">' +
    '<input type="password" id="adm_sheetsync_secret" placeholder="ตั้งรหัสอะไรก็ได้" style="flex:1;font-family:monospace;font-size:.8rem">' +
    '<button class="btn bo bsm" onclick="var i=document.getElementById(\'adm_sheetsync_secret\');i.type=i.type===\'password\'?\'text\':\'password\'">👁</button>' +
    '</div></div>' +
    '<label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:.75rem"><input type="checkbox" id="adm_sheetsync_enabled"> เปิดใช้งาน Sync</label>' +
    '<div style="display:flex;gap:6px;margin-top:8px">' +
    '<button class="btn bp bsm" onclick="saveSheetSyncConfig()">💾 บันทึก</button>' +
    '<button class="btn bo bsm" onclick="testSheetSyncConnection()">🧪 ทดสอบการเชื่อมต่อ</button>' +
    '</div>' +
    '<div id="adm_sheetsync_test_result" style="font-size:.72rem;margin-top:6px"></div></div>' +

    // Team Management
    '<div class="card"><h2>👥 ทีม Sales</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">เพิ่มสมาชิกทีม Sales — แต่ละคนได้ Link แยกสำหรับ sales-view • GM ดูภาพรวมได้จาก gm-view</p>' +
    '<div id="teamMemberList">' + renderTeamMemberListHTML() + '</div>' +
    '<div class="bg" style="margin-top:10px;flex-wrap:wrap">' +
    '<button class="btn bp bsm" onclick="showAddSalesMemberM()">➕ เพิ่ม Sales</button>' +
    '<button class="btn bo bsm" onclick="copyGMLink()">🔗 Copy GM Link</button>' +
    '<button class="btn bo bsm" onclick="showSaleNameMismatchM()" title="เช็คว่าชื่อเซลล์ใน Dealer/Pipeline/Visit ตรงกับสมาชิกทีมไหม — ถ้าไม่ตรง KPI จะคำนวณไม่เจอ">🔍 ตรวจสอบชื่อเซลล์</button>' +
    '</div></div>' +

    // Sales Link Permissions — แยกการ์ดต่างหากจากทีม Sales ด้านบน ให้หาง่าย
    '<div class="card"><h2>🔗 สิทธิ์ลิงก์เซล</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">กำหนดว่าลิงก์เซล (login ด้วย PIN ผ่าน sales-view) เข้าเมนูไหนได้บ้าง และแต่ละประเภทข้อมูลเป็นแบบส่วนตัว/ใช้ร่วมกัน/อ่านอย่างเดียวจากแอปหลัก</p>' +
    renderSalesLinkPermissionsHTML() +
    '</div>' +

    // Guest View — ลิงก์ PIN ให้ทีมดู/แก้ไขบางเมนู รองรับหลายโปรไฟล์ (คนละคน คนละ PIN คนละสิทธิ์)
    '<div class="card"><h2>👁️ ลิงก์ทีมดูข้อมูล</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">สร้างได้หลายโปรไฟล์ แต่ละโปรไฟล์มี PIN/เมนูที่ดูได้/เมนูที่แก้ไขได้ของตัวเอง — ข้อมูลจริงชุดเดียวกับแอปหลัก ไม่ใช่ข้อมูลแยก ลิงก์ที่คัดลอกไม่มี PIN ติดไปด้วย ต้องบอก PIN แยกให้คนที่จะใช้เอง</p>' +
    renderGuestViewProfilesHTML() +
    '</div>' +

    // Email Recipients
    '<div class="card"><h2>📧 Email Recipients</h2>' +
    '<div class="fg"><label>Visit Plan</label>' +
    '<input type="text" id="adm_em_vp" value="' + cfg.emailRecipients.visitPlan.join(', ') + '"></div>' +
    '<div class="fg"><label>Online Plan</label>' +
    '<input type="text" id="adm_em_op" value="' + cfg.emailRecipients.onlinePlan.join(', ') + '"></div>' +
    '<button class="btn bp bsm" onclick="admSaveEmail()">💾 บันทึก</button></div>' +

    // Gemini AI
    '<div class="card"><h2>🤖 Gemini AI</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">ใส่ Apps Script Proxy URL (แนะนำ) หรือ Gemini API Key ตรง</p>' +
    '<div id="adm_gemini_status" style="font-size:.72rem;margin-bottom:8px;color:var(--text2)">⏳ กำลังโหลด...</div>' +
    '<div class="fg"><label style="font-size:.75rem">Proxy URL (Apps Script) — แนะนำ</label>' +
    '<input type="url" id="adm_gemini_proxy" placeholder="https://script.google.com/macros/s/.../exec" style="font-size:.78rem" autocomplete="off"></div>' +
    '<div class="fg" style="margin-top:6px"><label style="font-size:.75rem">หรือ Gemini API Key ตรง (AIzaSy...)</label>' +
    '<div style="display:flex;gap:6px">' +
    '<input type="password" id="adm_gemini_key" placeholder="AIzaSy..." style="flex:1;font-family:monospace;font-size:.8rem">' +
    '<button class="btn bo bsm" onclick="var i=document.getElementById(\'adm_gemini_key\');i.type=i.type===\'password\'?\'text\':\'password\'">👁</button>' +
    '</div></div>' +
    '<button class="btn bp bsm" style="margin-top:8px" onclick="saveGeminiKey()">💾 บันทึก</button></div>' +

    // External Links
    '<div class="card"><h2>🔗 External Links</h2>' +
    '<p style="font-size:.68rem;color:var(--text2);margin-bottom:6px">Pricelist, Stock Check, เครื่องมือภายนอก</p>' +
    '<div id="adm_links">' + linkRows + '</div>' +
    '<div style="display:flex;gap:3px;margin-top:4px">' +
    '<input type="text" id="lk_new_n" placeholder="ชื่อ" style="width:80px">' +
    '<input type="url" id="lk_new_u" placeholder="https://..." style="flex:1">' +
    '<button class="btn bsm bp" onclick="admAddLink()">➕</button></div>' +
    '<button class="btn bp bsm" style="margin-top:6px" onclick="admSaveLinks()">💾 บันทึกทั้งหมด</button></div>' +

    quickLinks +

    '</div>' + // end tab connect

    // ===== TAB: ขั้นสูง =====
    '<div class="admin-tab-pane' + aTab('advanced') + '" id="atp-advanced">' +

    // Data Overview
    '<div class="card"><h2>💾 ข้อมูลในระบบ (' + ST.getStorageSizeFormatted() + ')</h2>' +
    '<div class="sr">' + countCards + '</div></div>' +

    // Danger Zone
    '<div class="card" style="border-color:#ef4444"><h2 style="color:#ef4444">⚠️ Danger Zone</h2>' +
    '<div class="bg">' +
    '<button class="btn bd" onclick="admResetRoutines()">🔄 Reset Routines</button>' +
    '<button class="btn bd" onclick="doClearAll()">🗑️ ล้างข้อมูลทั้งหมด</button>' +
    '</div></div>' +

    '</div>'; // end tab advanced

  // Set notification status
  var nfEl = document.getElementById('adm_nf_status');
  if (nfEl) {
    nfEl.textContent = ('Notification' in window) ? 'สถานะ: ' + Notification.permission : 'Browser ไม่รองรับ';
  }

  setTimeout(function() {
    initNewDemoPolicies();
    initLevelRequirementTabs();
    loadSheetSyncConfigToAdmin();
  }, 100);
}

function switchAdminTab(id) {
  localStorage.setItem('v7_admin_tab', id);
  document.querySelectorAll('.admin-tab').forEach(function(t) {
    t.classList.toggle('act', t.getAttribute('onclick').indexOf("'" + id + "'") !== -1);
  });
  document.querySelectorAll('.admin-tab-pane').forEach(function(p) {
    p.classList.toggle('act', p.id === 'atp-' + id);
  });
  if (id === 'data') {
    setTimeout(function() { initNewDemoPolicies(); initLevelRequirementTabs(); }, 50);
  }
  if (id === 'connect') {
    setTimeout(loadGeminiKeyToAdmin, 100);
  }
}

// ================================================================
// PRODUCTS MANAGEMENT FUNCTIONS FOR ADMIN (USING Products MODULE)
// ================================================================

function renderProductListForAdmin() {
  if (typeof Products === 'undefined') return '<div class="empty"><p>⚠️ Products module ยังไม่โหลด</p></div>';
  var products = Products.getAll();
  if (!products.length) return '<div class="empty"><p>ยังไม่มีสินค้า — กด ➕ เพื่อเพิ่ม หรือ Import Excel</p></div>';
  
  var html = '<table class="export-table" style="width:100%;font-size:.7rem">' +
    '<thead><tr><th>#</th><th>SKU</th><th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>ราคา B (฿)</th><th>EOL</th><th></th></tr></thead><tbody>';
  
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var categoryName = getCategoryNameFromId(p.category);
    var eolBadge = p.eol ? '<span class="tag tag-cancelled">⏰ EOL</span>' : '<span class="tag tag-completed">✅</span>';
    html += '<td>' +
      '<td class="pipe-row-num">' + (i+1) + '</td>' +
      '<td>' + sanitize(p.sku || '-') + '</td>' +
      '<td><strong>' + sanitize(p.name) + '</strong></td>' +
      '<td>' + categoryName + '</td>' +
      '<td style="text-align:right">' + fmtMoney(p.price) + '</td>' +
      '<td>' + eolBadge + '</td>' +
      '<td><button class="btn bsm bo" onclick="editProductAdmin(\'' + p.id + '\')">✏️</button></td>' +
      '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function getCategoryNameFromId(catId) {
  var cat = PRODUCT_CATEGORIES.find(function(c) { return c.id === catId; });
  return cat ? cat.name : '📦 Other';
}

// Modal แก้ไขสินค้า (ใช้ Products.update)
function editProductAdmin(productId) {
  var p = Products.getById(productId);
  if (!p) { toast('ไม่พบสินค้า'); return; }
  
  var categoryOptions = '';
  for (var i = 0; i < PRODUCT_CATEGORIES.length; i++) {
    var cat = PRODUCT_CATEGORIES[i];
    categoryOptions += '<option value="' + cat.id + '"' + (p.category === cat.id ? ' selected' : '') + '>' + cat.name + '</option>';
  }
  
  var html = '<div style="max-width:550px">' +
    '<div class="fm-group"><label>ชื่อสินค้า *</label><input type="text" id="edit_p_name" value="' + sanitize(p.name) + '" class="fm-input"></div>' +
    '<div class="fm-group"><label>SKU (SiS part)</label><input type="text" id="edit_p_sku" value="' + sanitize(p.sku || '') + '" class="fm-input"></div>' +
    '<div class="fm-group"><label>EAN</label><input type="text" id="edit_p_ean" value="' + sanitize(p.ean || '') + '" class="fm-input"></div>' +
    '<div class="fm-group"><label>หมวดหมู่</label><select id="edit_p_category" class="fm-input">' + categoryOptions + '</select></div>' +
    '<div class="fm-group"><label>💰 ราคา B (Type 3) (฿)</label><input type="text" inputmode="decimal" id="edit_p_price" value="' + nmI(p.price || 0) + '" class="fm-input js-money"></div>' +
    '<div class="fm-group"><label>⚡ สถานะ EOL</label><div class="radio-g">' +
    '<label><input type="radio" name="edit_eol" value="1"' + (p.eol ? ' checked' : '') + '><span>⏰ EOL</span></label>' +
    '<label><input type="radio" name="edit_eol" value="0"' + (!p.eol ? ' checked' : '') + '><span>✅ ปกติ</span></label>' +
    '</div></div>' +
    '<div class="fm-group"><label>🔧 ประเภทสินค้า (สำหรับระบบ)</label><div class="check-g">' +
    '<label><input type="checkbox" id="edit_is_bundle"' + (p.isBundle ? ' checked' : '') + '> 🎁 Bundle</label>' +
    '<label><input type="checkbox" id="edit_is_software"' + (p.isSoftware ? ' checked' : '') + '> 💻 Software</label>' +
    '<label><input type="checkbox" id="edit_is_service"' + (p.isService ? ' checked' : '') + '> 🛠️ Service</label>' +
    '</div></div>' +
    '<div class="fm-actions">' +
    '<button class="btn bp" onclick="saveProductEditAdmin(\'' + p.id + '\')">💾 บันทึก</button>' +
    '<button class="btn" onclick="closeM()">ยกเลิก</button>' +
    '</div></div>';
  
  openM('✏️ แก้ไขสินค้า', html);
}

function saveProductEditAdmin(productId) {
  var name = document.getElementById('edit_p_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  
  var updates = {
    name: name,
    sku: document.getElementById('edit_p_sku').value.trim(),
    ean: document.getElementById('edit_p_ean').value.trim(),
    category: document.getElementById('edit_p_category').value,
    price: parseNum(document.getElementById('edit_p_price').value),
    eol: document.querySelector('input[name="edit_eol"]:checked') ? document.querySelector('input[name="edit_eol"]:checked').value === '1' : false,
    isBundle: document.getElementById('edit_is_bundle').checked,
    isSoftware: document.getElementById('edit_is_software').checked,
    isService: document.getElementById('edit_is_service').checked
  };
  
  Products.update(productId, updates);
  closeMForce();
  toast('💾 อัปเดตสินค้าเรียบร้อย');
  render(); // รีเฟรชหน้า admin
}

function showAddProductAdminModal() {
  var categoryOptions = '';
  for (var i = 0; i < PRODUCT_CATEGORIES.length; i++) {
    categoryOptions += '<option value="' + PRODUCT_CATEGORIES[i].id + '">' + PRODUCT_CATEGORIES[i].name + '</option>';
  }
  
  var html = '<div style="max-width:550px">' +
    '<div class="fm-group"><label>ชื่อสินค้า *</label><input type="text" id="new_p_name" class="fm-input"></div>' +
    '<div class="fm-group"><label>SKU (SiS part)</label><input type="text" id="new_p_sku" class="fm-input"></div>' +
    '<div class="fm-group"><label>EAN</label><input type="text" id="new_p_ean" class="fm-input"></div>' +
    '<div class="fm-group"><label>หมวดหมู่</label><select id="new_p_category" class="fm-input">' + categoryOptions + '</select></div>' +
    '<div class="fm-group"><label>💰 ราคา B (Type 3) (฿)</label><input type="text" inputmode="decimal" id="new_p_price" class="fm-input js-money" value="0.00"></div>' +
    '<div class="fm-group"><label>🔧 ประเภทสินค้า</label><div class="check-g">' +
    '<label><input type="checkbox" id="new_is_bundle"> 🎁 Bundle</label>' +
    '<label><input type="checkbox" id="new_is_software"> 💻 Software</label>' +
    '<label><input type="checkbox" id="new_is_service"> 🛠️ Service</label>' +
    '</div></div>' +
    '<div class="fm-actions">' +
    '<button class="btn bp" onclick="addProductAdmin()">💾 เพิ่มสินค้า</button>' +
    '<button class="btn" onclick="closeM()">ยกเลิก</button>' +
    '</div></div>';
  
  openM('➕ เพิ่มสินค้า (Products Module)', html);
}

function addProductAdmin() {
  var name = document.getElementById('new_p_name').value.trim();
  if (!name) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  
  Products.add({
    name: name,
    sku: document.getElementById('new_p_sku').value.trim(),
    ean: document.getElementById('new_p_ean').value.trim(),
    category: document.getElementById('new_p_category').value,
    price: parseNum(document.getElementById('new_p_price').value),
    isBundle: document.getElementById('new_is_bundle').checked,
    isSoftware: document.getElementById('new_is_software').checked,
    isService: document.getElementById('new_is_service').checked,
    eol: false,
    typePrices: { S: 0, A: 0, B: 0, Other: 0 }
  });
  
  closeMForce();
  toast('✅ เพิ่มสินค้าเรียบร้อย');
  render();
}

// นำเข้าราคาสินค้า (ชีต 'single') ผ่านหน้า preview ก่อนเสมอ (แบบเดียวกับ import pipeline)
// ส่วนชีต 'combo'/'demo' (ถ้ามีในไฟล์เดียวกัน) ยังนำเข้าตรงทันทีเหมือนเดิม เพราะไม่ใช่ scope ของ preview นี้
window._prodImportWorkbook = null;
function importProductsFromExcelAdmin(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      if (!workbook.SheetNames.includes('single')) {
        toast('❌ ไม่พบชีต "single" (ราคาสินค้า) ในไฟล์');
        return;
      }
      var meta = _prodParseSingleSheet(workbook.Sheets['single']);
      // ชีต 'demo' (ถ้ามี) — สินค้า Demo ราคาเดียว แยกจากสินค้าหลักในไฟล์ แต่รวมเข้า preview เดียวกัน
      if (workbook.SheetNames.includes('demo')) {
        meta = meta.concat(_prodParseDemoSheet(workbook.Sheets['demo']));
      }
      if (!meta.length) { toast('❌ ไม่พบข้อมูลสินค้าที่อ่านได้ในไฟล์'); return; }
      // ต้นทุนอยู่แยกชีต 'cost' (ถ้ามี) — ผสานเข้า meta ด้วย SKU/EAN ก่อนเปิด preview
      if (workbook.SheetNames.includes('cost')) {
        meta = _prodMergeCostSheet(meta, workbook.Sheets['cost']);
      }
      // ชื่อย่ออยู่แยกชีต 'shortname' (ถ้ามี) — ผสานเข้า meta แบบเดียวกับ cost
      if (workbook.SheetNames.includes('shortname')) {
        meta = _prodMergeShortNameSheet(meta, workbook.Sheets['shortname']);
      }
      window._prodImportWorkbook = workbook;
      showProductXlsxPreview(meta);
    } catch (err) {
      toast('❌ อ่านไฟล์ไม่ได้: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

// เรียกหลังยืนยัน preview ราคาสินค้าแล้ว — นำเข้าชีต combo/demo ต่อถ้ามีในไฟล์เดียวกัน (ไม่มี preview)
function _prodImportComboDemoIfPresent() {
  var wb = window._prodImportWorkbook;
  window._prodImportWorkbook = null;
  if (!wb) return;
  var msgParts = [];
  if (wb.SheetNames.includes('combo')) {
    var r = importBundlesFromSheet(wb.Sheets['combo']);
    msgParts.push('ชุด: +' + r.imported + ' อัปเดต ' + r.updated);
  }
  if (wb.SheetNames.includes('demo')) {
    var r2 = importDemoUnitsFromSheet(wb.Sheets['demo']);
    msgParts.push('Demo: +' + r2.imported + ' อัปเดต ' + r2.updated);
  }
  if (msgParts.length) toast('📦 ' + msgParts.join(' · '));
}

// ================================================================
// SAVE FUNCTIONS (เดิม แต่ไม่เกี่ยวข้องกับ products)
// ================================================================
function admSaveName() {
  var cfg = getConfig();
  var val = document.getElementById('adm_name');
  cfg.saleName = val ? val.value.trim() : 'Siwawong';
  if (!cfg.saleName) cfg.saleName = 'Siwawong';
  saveConfig(cfg);
  toast('💾 บันทึกชื่อแล้ว');
}

function admSaveKPI() {
  var cfg = getConfig();
  var fu = document.getElementById('adm_kpi_fu');
  var vs = document.getElementById('adm_kpi_vs');
  cfg.kpi.followupPerWeek = fu ? parseInt(fu.value) || 4 : 4;
  cfg.kpi.visitPerWeek = vs ? parseInt(vs.value) || 1 : 1;
  saveConfig(cfg);
  toast('💾 บันทึก KPI แล้ว');
}

function admSavePSt() {
  var cfg = getConfig();
  var container = document.getElementById('adm_pst');
  if (!container) return;
  var rows = container.children;
  var statuses = [];
  for (var i = 0; i < rows.length; i++) {
    var idEl = document.getElementById('aps_id_' + i);
    var nmEl = document.getElementById('aps_nm_' + i);
    var clEl = document.getElementById('aps_cl_' + i);
    if (idEl && nmEl) {
      var catEl = document.getElementById('aps_cat_' + i);
      statuses.push({
        id: idEl.value,
        name: nmEl.value,
        color: clEl ? clEl.value : '#3b82f6',
        category: catEl ? catEl.value : 'active'
      });
    }
  }
  cfg.pipelineStatuses = statuses;
  saveConfig(cfg);
  toast('💾 บันทึก Pipeline Status แล้ว');
  render();
}

function admAddPSt() {
  var idEl = document.getElementById('aps_new_id');
  var nmEl = document.getElementById('aps_new_nm');
  if (!idEl || !nmEl) return;
  var id = idEl.value.trim();
  var nm = nmEl.value.trim();
  if (!id || !nm) return alert('ใส่ id และชื่อ');
  var cfg = getConfig();
  for (var i = 0; i < cfg.pipelineStatuses.length; i++) {
    if (cfg.pipelineStatuses[i].id === id) return alert('id ซ้ำ');
  }
  cfg.pipelineStatuses.push({ id: id, name: nm, color: '#3b82f6', category: 'active' });
  saveConfig(cfg);
  toast('➕ เพิ่มแล้ว');
  render();
}

function admResetPipeStatuses() {
  if (!confirm('รีเซ็ต Pipeline Status เป็นค่าเริ่มต้น 8 รายการ?\n(Status ที่เพิ่มเองทั้งหมดจะถูกลบออก)')) return;
  var cfg = getConfig();
  cfg.pipelineStatuses = JSON.parse(JSON.stringify(DEF_CONFIG.pipelineStatuses));
  saveConfig(cfg);
  toast('♻️ Reset Pipeline Status เรียบร้อย');
  render();
}

function admRmPSt(idx) {
  if (!confirm('ลบ Status นี้?')) return;
  var cfg = getConfig();
  cfg.pipelineStatuses.splice(idx, 1);
  saveConfig(cfg);
  render();
}

// ฟังก์ชันเก่าเกี่ยวกับ Models ใน config เดิม - ปิดใช้งาน (redirect ไปใช้ Products module)
function admSaveModels() {
  toast('📦 กรุณาใช้ "สินค้าทั้งหมด (Products Module)" แทนการบันทึกแบบเดิม');
}

function admAddModel() {
  toast('📦 กรุณาใช้ปุ่ม "➕ เพิ่มสินค้า (ใช้ Products)" ในส่วนสินค้าทั้งหมด');
}

function admRmModel(idx) {
  toast('📦 กรุณาใช้ปุ่มแก้ไขในส่วนสินค้าทั้งหมด');
}

function admMoveModel(idx, dir) {
  toast('📦 การเรียงลำดับสินค้าใช้ในส่วนสินค้าทั้งหมดเท่านั้น');
}

function admImportModelsText() {
  toast('📦 กรุณาใช้ฟังก์ชัน Import Excel ในส่วนสินค้าทั้งหมด');
}

function admDoImportModels() {
  toast('📦 กรุณาใช้ฟังก์ชัน Import Excel ในส่วนสินค้าทั้งหมด');
}

function admSaveUnits() {
  var cfg = getConfig();
  var el = document.getElementById('adm_units');
  if (!el) return;
  cfg.unitTypes = el.value.trim().split('\n').filter(function(s) { return s.trim(); }).map(function(s) { return s.trim(); });
  saveConfig(cfg);
  toast('💾 บันทึกแล้ว');
}

function admSaveEmail() {
  var cfg = getConfig();
  var vp = document.getElementById('adm_em_vp');
  var op = document.getElementById('adm_em_op');
  if (vp) cfg.emailRecipients.visitPlan = vp.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (op) cfg.emailRecipients.onlinePlan = op.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  saveConfig(cfg);
  toast('💾 บันทึกแล้ว');
}

function admSaveMonthly() {
  var cfg = getConfig();
  var el = document.getElementById('adm_monthly');
  if (!el) return;
  cfg.monthlyChecklist = el.value.trim().split('\n').filter(function(s) { return s.trim(); }).map(function(s) { return s.trim(); });
  saveConfig(cfg);
  toast('💾 บันทึกแล้ว');
}

function saveGeminiKey() {
  if (!SYNC_ENABLED) { toast('❌ ต้อง Login Google ก่อน'); return; }
  var proxy = (document.getElementById('adm_gemini_proxy').value || '').trim();
  var key = (document.getElementById('adm_gemini_key').value || '').trim();
  if (!proxy && !key) { toast('❌ กรุณาใส่ Proxy URL หรือ API Key'); return; }
  var data = {};
  if (proxy) { data.proxyUrl = proxy; GEMINI_PROXY_URL = proxy; }
  if (key) { data.apiKey = key; GEMINI_API_KEY = key; }
  db.collection('appConfig').doc('gemini').set(data, { merge: true })
    .then(function() {
      toast('✅ บันทึก Gemini config แล้ว');
      var st = document.getElementById('adm_gemini_status');
      if (st) st.textContent = proxy ? '✅ ใช้ Proxy URL' : '✅ ใช้ API Key ตรง';
      document.getElementById('adm_gemini_proxy').value = '';
      document.getElementById('adm_gemini_key').value = '';
    })
    .catch(function(e) { toast('❌ บันทึกไม่ได้: ' + e.message); });
}

function loadGeminiKeyToAdmin() {
  if (!SYNC_ENABLED) return;
  db.collection('appConfig').doc('gemini').get().then(function(doc) {
    var st = document.getElementById('adm_gemini_status');
    if (!st) return;
    if (doc.exists) {
      var d = doc.data();
      if (d.proxyUrl) { GEMINI_PROXY_URL = d.proxyUrl; st.textContent = '✅ ใช้ Proxy URL (Apps Script)'; }
      else if (d.apiKey) { GEMINI_API_KEY = d.apiKey; st.textContent = '✅ ใช้ API Key ตรง'; }
      else { st.textContent = '⚠️ ยังไม่ได้ตั้งค่า'; }
    } else {
      st.textContent = '⚠️ ยังไม่ได้ตั้งค่า — ใส่ Proxy URL แล้วกด บันทึก';
    }
  }).catch(function() {});
}

function saveSheetSyncConfig() {
  if (!SYNC_ENABLED) { toast('❌ ต้อง Login Google ก่อน'); return; }
  var url = (document.getElementById('adm_sheetsync_url').value || '').trim();
  var secret = (document.getElementById('adm_sheetsync_secret').value || '').trim();
  var enabled = document.getElementById('adm_sheetsync_enabled').checked;
  if (enabled && !url) { toast('❌ กรุณาใส่ Apps Script Web App URL ก่อนเปิดใช้งาน'); return; }
  var data = { url: url, secret: secret, enabled: enabled };
  db.collection('appConfig').doc('sheetSync').set(data, { merge: true })
    .then(function() {
      SHEET_SYNC_URL = url; SHEET_SYNC_SECRET = secret; SHEET_SYNC_ENABLED = enabled;
      toast('✅ บันทึก Sheet Sync config แล้ว');
      var st = document.getElementById('adm_sheetsync_status');
      if (st) st.textContent = enabled ? '✅ เปิดใช้งานอยู่' : '⚪ ปิดใช้งานอยู่';
    })
    .catch(function(e) { toast('❌ บันทึกไม่ได้: ' + e.message); });
}

function loadSheetSyncConfigToAdmin() {
  if (!SYNC_ENABLED) return;
  db.collection('appConfig').doc('sheetSync').get().then(function(doc) {
    var st = document.getElementById('adm_sheetsync_status');
    if (!st) return;
    var urlEl = document.getElementById('adm_sheetsync_url');
    var secretEl = document.getElementById('adm_sheetsync_secret');
    var enEl = document.getElementById('adm_sheetsync_enabled');
    if (doc.exists) {
      var d = doc.data();
      if (urlEl) urlEl.value = d.url || '';
      if (secretEl) secretEl.value = d.secret || '';
      if (enEl) enEl.checked = !!d.enabled;
      st.textContent = d.enabled ? '✅ เปิดใช้งานอยู่' : '⚪ ปิดใช้งานอยู่ (ตั้งค่าไว้แล้วแต่ยังไม่เปิด)';
    } else {
      st.textContent = '⚠️ ยังไม่ได้ตั้งค่า — ใส่ Web App URL แล้วกด บันทึก';
    }
  }).catch(function() {});
}

function admSaveLinks() {
  var cfg = getConfig();
  var container = document.getElementById('adm_links');
  if (!container) return;
  var links = [];
  var cnt = container.children.length;
  for (var i = 0; i < cnt; i++) {
    var nEl = document.getElementById('lk_n_' + i);
    var uEl = document.getElementById('lk_u_' + i);
    if (nEl && uEl) {
      var n = nEl.value.trim();
      var u = uEl.value.trim();
      if (n && u) links.push({ name: n, url: u });
    }
  }
  cfg.externalLinks = links;
  saveConfig(cfg);
  toast('💾 บันทึก Links แล้ว');
  render();
}

function admAddLink() {
  var nEl = document.getElementById('lk_new_n');
  var uEl = document.getElementById('lk_new_u');
  if (!nEl || !uEl) return;
  var n = nEl.value.trim();
  var u = uEl.value.trim();
  if (!n || !u) return alert('ใส่ชื่อและ URL');
  var cfg = getConfig();
  if (!cfg.externalLinks) cfg.externalLinks = [];
  cfg.externalLinks.push({ name: n, url: u });
  saveConfig(cfg);
  toast('➕ เพิ่ม Link แล้ว');
  render();
}

function admRmLink(idx) {
  var cfg = getConfig();
  if (!cfg.externalLinks) return;
  cfg.externalLinks.splice(idx, 1);
  saveConfig(cfg);
  render();
}

function admDelRoutine(id) {
  if (!confirm('ลบ Routine นี้?')) return;
  ST.delete('routines', id);
  render();
}

function admResetRoutines() {
  if (!confirm('Reset Routines เป็น Default?')) return;
  var newRoutines = [];
  for (var i = 0; i < DEF_ROUTINES.length; i++) {
    var r = {};
    for (var key in DEF_ROUTINES[i]) {
      r[key] = DEF_ROUTINES[i][key];
    }
    r.id = gid();
    newRoutines.push(r);
  }
  ST._set(ST._keys.routines, newRoutines);
  toast('🔄 Reset แล้ว');
  render();
}

function admReqNotif() {
  if (!('Notification' in window)) {
    toast('Browser ไม่รองรับ', true);
    return;
  }
  Notification.requestPermission().then(function(p) {
    if (p === 'granted') {
      toast('✅ เปิดแจ้งเตือนแล้ว');
    } else {
      toast('❌ ไม่อนุญาต', true);
    }
    var nfEl = document.getElementById('adm_nf_status');
    if (nfEl) nfEl.textContent = 'สถานะ: ' + p;
  });
}

// ================================================================
// TEMPLATE FUNCTIONS (เหมือนเดิม)
// ================================================================
function showTplDet(id) {
  var tp = ST.getOne('templates', id);
  if (!tp) return;
  var stepsHtml = '';
  var steps = tp.steps || [];
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    stepsHtml += '<div class="si"><div style="flex:1">' +
      '<div class="stt">' + (i + 1) + '. ' + sanitize(s.title) + '</div>' +
      '<div class="sd">' + (s.offsetDays ? '+' + s.offsetDays + 'd' : 'start') +
      (s.durationDays ? ' → ' + s.durationDays + 'd' : '') + '</div>' +
      '</div></div>';
  }

  openM('📑 ' + tp.name,
    stepsHtml +
    '<div class="bg" style="margin-top:8px">' +
    '<button class="btn bp" onclick="closeM();useTpl(\'' + tp.id + '\')">🚀 ใช้</button>' +
    '<button class="btn bo" onclick="closeM();showTemplateM(\'' + tp.id + '\')">✏️</button>' +
    '<button class="btn bd" onclick="ST.delete(\'templates\',\'' + tp.id + '\');closeM();render()">🗑️</button>' +
    '</div>'
  );
}

function useTpl(tid) {
  var tp = ST.getOne('templates', tid);
  if (!tp) return;
  openM('🚀 ใช้ Template',
    '<div class="fg"><label>ชื่อ *</label>' +
    '<input type="text" id="ut_n" value="' + sanitize(tp.name) + '"></div>' +
    dpH('ut_d', _td(), 'วันเริ่ม') +
    '<button class="btn bp btn-full" onclick="applyTpl(\'' + tid + '\')">🚀 สร้างงาน</button>'
  );
}

function applyTpl(tid) {
  var tp = ST.getOne('templates', tid);
  if (!tp) return;
  var nmEl = document.getElementById('ut_n');
  var nm = nmEl ? nmEl.value.trim() : '';
  var sd = dpG('ut_d') || _td();
  if (!nm) return alert('ใส่ชื่อ');

  var steps = [];
  var tpSteps = tp.steps || [];
  for (var i = 0; i < tpSteps.length; i++) {
    var s = tpSteps[i];
    steps.push({
      id: gid(),
      title: s.title,
      startDate: addD(sd, s.offsetDays || 0),
      dueDate: addD(sd, (s.offsetDays || 0) + (s.durationDays || 0)),
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

  closeM();
  toast('🚀 สร้างแล้ว');
  go('taskDetail', { taskId: t.id });
}

// ================================================================
// SAVE DJI DEALER TYPES / TIERS / TERMS
// ================================================================
function admSaveDjiTypes() {
  var cfg = getConfig();
  var el = document.getElementById('adm_djitypes');
  if (!el) return;
  cfg.djiDealerTypes = el.value.trim().split('\n').filter(function(s) { return s.trim(); }).map(function(s) { return s.trim(); });
  saveConfig(cfg);
  toast('💾 บันทึก DJI Dealer Types แล้ว');
}

// ================================================================
// VISIT TOPICS EDITOR — เพิ่ม/แก้/ลบ/จัดลำดับหัวข้อคุยที่ใช้ใน Visit Report (Standard/Full ใช้ config
// ชุดเดียวกัน — Standard กรองเอาเฉพาะกลุ่มที่ group.alwaysAsk ตอน render ในฟอร์ม ดู modals.js buildVisitFormHtml)
// ================================================================
function showAdminVisitTopics() { _vtRenderM(); }

function _vtRenderM() {
  var cfg = getConfig();
  var groups = cfg.visitTopicGroups || [];
  var topics = cfg.visitTopics || [];
  var h = '<div style="max-width:520px;max-height:70vh;overflow-y:auto">';

  h += '<div style="font-size:.68rem;color:var(--text2);margin-bottom:10px">📝 หัวข้อในนี้จะโผล่ในฟอร์ม Visit Report ทั้งโหมด Standard และ Full — กลุ่มที่ตั้ง "ถามเสมอ" จะโผล่ใน Standard ด้วย ไม่งั้นโผล่เฉพาะ Full</div>';

  // Groups
  h += '<div class="form-section">📂 กลุ่มหัวข้อ</div>';
  h += '<div id="vtGroupWrap">' + groups.map(function(g) {
    return '<div class="link-item"><input type="text" value="' + sanitize(g.name) + '" style="flex:1;font-size:13px" onchange="_vtGroupField(\'' + g.id + '\',\'name\',this.value)">' +
      '<label style="font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:3px"><input type="checkbox"' + (g.alwaysAsk ? ' checked' : '') + ' onchange="_vtGroupField(\'' + g.id + '\',\'alwaysAsk\',this.checked)">ถามเสมอ</label>' +
      '<button class="btn bsm bd" onclick="_vtGroupRemove(\'' + g.id + '\')">✕</button></div>';
  }).join('') + '</div>';
  h += '<div style="display:flex;gap:4px;margin-top:6px"><input type="text" id="vtNewGroupName" placeholder="ชื่อกลุ่มใหม่" style="flex:1" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_vtGroupAdd();}"><button class="btn bsm bp" onclick="_vtGroupAdd()">➕ กลุ่ม</button></div>';

  // Topics (grouped)
  h += '<div class="form-section" style="margin-top:14px">📋 หัวข้อ</div>';
  for (var gi = 0; gi < groups.length; gi++) {
    var grp = groups[gi];
    var grpTopics = topics.filter(function(t) { return t.group === grp.id; });
    h += '<div style="font-size:.72rem;font-weight:700;color:var(--text2);margin:8px 0 4px">' + sanitize(grp.name) + '</div>';
    h += grpTopics.map(function(t, ti) {
      return '<div style="border:1px solid var(--border);border-radius:8px;padding:6px;margin-bottom:5px">' +
        '<div style="display:flex;gap:4px;align-items:center">' +
        '<input type="text" value="' + sanitize(t.name) + '" placeholder="ชื่อหัวข้อ" style="flex:1;font-size:12px;font-weight:600" onchange="_vtTopicField(\'' + t.id + '\',\'name\',this.value)">' +
        '<label style="font-size:10px;white-space:nowrap;display:flex;align-items:center;gap:2px"><input type="checkbox"' + (t.required ? ' checked' : '') + ' onchange="_vtTopicField(\'' + t.id + '\',\'required\',this.checked)">บังคับ</label>' +
        '<select style="font-size:11px;padding:2px" onchange="_vtTopicField(\'' + t.id + '\',\'group\',this.value)">' + groups.map(function(g2) { return '<option value="' + g2.id + '"' + (g2.id === t.group ? ' selected' : '') + '>' + sanitize(g2.name) + '</option>'; }).join('') + '</select>' +
        '<button class="btn bsm bo" title="เลื่อนขึ้น" onclick="_vtMoveTopic(\'' + t.id + '\',-1)"' + (ti === 0 ? ' disabled' : '') + '>▲</button>' +
        '<button class="btn bsm bo" title="เลื่อนลง" onclick="_vtMoveTopic(\'' + t.id + '\',1)"' + (ti === grpTopics.length - 1 ? ' disabled' : '') + '>▼</button>' +
        '<button class="btn bsm bd" onclick="_vtTopicRemove(\'' + t.id + '\')">✕</button>' +
        '</div>' +
        '<input type="text" value="' + sanitize(t.prompt || '') + '" placeholder="คำถาม/prompt ที่จะโชว์ในฟอร์ม" style="width:100%;font-size:11px;margin-top:4px;box-sizing:border-box" onchange="_vtTopicField(\'' + t.id + '\',\'prompt\',this.value)">' +
        '</div>';
    }).join('') || '<div style="font-size:11px;color:var(--text2);padding:2px 0 4px">— ยังไม่มีหัวข้อในกลุ่มนี้ —</div>';
  }

  h += '<div class="form-section" style="margin-top:10px">➕ เพิ่มหัวข้อใหม่</div>';
  h += '<div class="fr"><input type="text" id="vtNewTopicName" placeholder="ชื่อหัวข้อ" style="flex:1">' +
    '<select id="vtNewTopicGroup">' + groups.map(function(g) { return '<option value="' + g.id + '">' + sanitize(g.name) + '</option>'; }).join('') + '</select></div>';
  h += '<input type="text" id="vtNewTopicPrompt" placeholder="คำถาม/prompt" style="width:100%;box-sizing:border-box;margin-top:4px">';
  h += '<button class="btn bsm bp btn-full" style="margin-top:6px" onclick="_vtTopicAdd()">➕ เพิ่มหัวข้อ</button>';

  h += '<button class="btn bp btn-full" style="margin-top:12px" onclick="closeMForce();render();">✅ เสร็จสิ้น</button>';
  h += '</div>';
  openM('⚙️ จัดการ Visit Topics', h);
}

function _vtGroupField(id, field, val) {
  var cfg = getConfig();
  var g = (cfg.visitTopicGroups || []).find(function(x) { return x.id === id; });
  if (!g) return;
  g[field] = val;
  saveConfig(cfg);
}
function _vtGroupAdd() {
  var el = document.getElementById('vtNewGroupName');
  var name = (el.value || '').trim();
  if (!name) return;
  var cfg = getConfig();
  cfg.visitTopicGroups = cfg.visitTopicGroups || [];
  cfg.visitTopicGroups.push({ id: 'cg_' + Date.now().toString(36), name: name, alwaysAsk: false });
  saveConfig(cfg);
  _vtRenderM();
}
function _vtGroupRemove(id) {
  var cfg = getConfig();
  var hasTopics = (cfg.visitTopics || []).some(function(t) { return t.group === id; });
  if (hasTopics && !confirm('กลุ่มนี้ยังมีหัวข้ออยู่ — ลบกลุ่มจะลบหัวข้อในกลุ่มนี้ทั้งหมดด้วย ยืนยัน?')) return;
  cfg.visitTopicGroups = (cfg.visitTopicGroups || []).filter(function(g) { return g.id !== id; });
  cfg.visitTopics = (cfg.visitTopics || []).filter(function(t) { return t.group !== id; });
  saveConfig(cfg);
  _vtRenderM();
}
function _vtTopicField(id, field, val) {
  var cfg = getConfig();
  var t = (cfg.visitTopics || []).find(function(x) { return x.id === id; });
  if (!t) return;
  t[field] = val;
  saveConfig(cfg);
  if (field === 'group') _vtRenderM();
}
function _vtTopicAdd() {
  var nameEl = document.getElementById('vtNewTopicName');
  var name = (nameEl.value || '').trim();
  if (!name) return alert('ใส่ชื่อหัวข้อ');
  var cfg = getConfig();
  cfg.visitTopics = cfg.visitTopics || [];
  cfg.visitTopics.push({
    id: 'ct_' + Date.now().toString(36), name: name,
    prompt: (document.getElementById('vtNewTopicPrompt').value || '').trim(),
    required: false, group: document.getElementById('vtNewTopicGroup').value
  });
  saveConfig(cfg);
  _vtRenderM();
}
function _vtTopicRemove(id) {
  var cfg = getConfig();
  cfg.visitTopics = (cfg.visitTopics || []).filter(function(t) { return t.id !== id; });
  saveConfig(cfg);
  _vtRenderM();
}
function _vtMoveTopic(id, dir) {
  var cfg = getConfig();
  var arr = cfg.visitTopics || [];
  var idx = arr.findIndex(function(t) { return t.id === id; });
  if (idx === -1) return;
  var grp = arr[idx].group;
  var swapIdx = -1;
  if (dir < 0) { for (var i = idx - 1; i >= 0; i--) { if (arr[i].group === grp) { swapIdx = i; break; } } }
  else { for (var i = idx + 1; i < arr.length; i++) { if (arr[i].group === grp) { swapIdx = i; break; } } }
  if (swapIdx === -1) return;
  var tmp = arr[idx]; arr[idx] = arr[swapIdx]; arr[swapIdx] = tmp;
  saveConfig(cfg);
  _vtRenderM();
}

function admSaveTiers() {
  var cfg = getConfig();
  var el = document.getElementById('adm_tiers');
  if (!el) return;
  cfg.dealerTiers = el.value.trim().split('\n').filter(function(s) { return s.trim(); }).map(function(s) { return s.trim(); });
  saveConfig(cfg);
  toast('💾 บันทึก Tiers แล้ว');
}

function admSaveTerms() {
  var cfg = getConfig();
  var el = document.getElementById('adm_terms');
  if (!el) return;
  cfg.creditTerms = el.value.trim().split('\n').filter(function(s) { return s.trim(); }).map(function(s) { return s.trim(); });
  saveConfig(cfg);
  toast('💾 บันทึก Terms แล้ว');
}

// ================================================================
// IMPORT PIPELINE — showImportPipelineM/importPipelineJSON/importPipelineFile/
// processPipelineImport อยู่ใน modals.js เท่านั้น (เดิมมีก๊อปปี้ซ้ำที่นี่ซึ่งชนะ
// เพราะโหลดทีหลัง ทำให้ auto-create dealer + import CSV ใน modals.js ใช้งานไม่ได้จริง
// ทั้งที่ implement ไว้ครบแล้ว — เอาก๊อปปี้ซ้ำออก รวม dedup check เข้าไปในตัวจริงแทน)
// ================================================================
// APPEARANCE FUNCTIONS
// ================================================================
function setAppOpt(key, value) {
  var settings = getAppearance();
  settings[key] = value;
  saveAppearance(settings);
  render();
}

function resetAppearance() {
  if (!confirm('Reset Appearance เป็น Default?')) return;
  localStorage.removeItem('v7_appearance');
  applyAppearance(DEF_APPEARANCE);
  toast('🔄 Reset Appearance แล้ว');
  render();
}

function admSaveOnboard() {
  var cfg = getConfig();
  var el = document.getElementById('adm_onboard');
  if (!el) return;
  var lines = el.value.trim().split('\n');
  var steps = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var parts = line.split('|');
    var title = parts[0] ? parts[0].trim() : '';
    if (!title) continue;
    var group = parts[1] ? parts[1].trim() : 'onboard';
    steps.push({
      id: title.toLowerCase().replace(/[^a-z0-9]/g, '_').substr(0, 30),
      title: title,
      group: group
    });
  }
  cfg.onboardingSteps = steps;
  saveConfig(cfg);
  toast('💾 บันทึก Onboarding Steps แล้ว');
}

// ================================================================
// LEVEL REQUIREMENTS FUNCTIONS (เดิม)
// ================================================================
var currentReqLevel = 'S';

function initLevelRequirementTabs() {
  var tabs = document.querySelectorAll('#reqLevelTabs .ftab');
  if (!tabs.length) return;
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].onclick = function() {
      var parent = this.parentElement;
      var allTabs = parent.querySelectorAll('.ftab');
      for (var j = 0; j < allTabs.length; j++) {
        allTabs[j].classList.remove('act');
      }
      this.classList.add('act');
      renderLevelRequirementsEditor(this.dataset.level);
    };
  }
  var activeTab = document.querySelector('#reqLevelTabs .ftab.act');
  if (activeTab) {
    renderLevelRequirementsEditor(activeTab.dataset.level);
  } else {
    renderLevelRequirementsEditor('S');
  }
}

function renderLevelRequirementsEditor(level) {
  var cfg = getConfig();
  var req = cfg.levelRequirements?.[level] || {};
  var demoRequired = req.demoRequired || 'either';
  
  var h = '<div class="form-section">🎯 เป้าหมายยอดขาย ' + new Date().getFullYear() + '</div>';
  h += '<div class="fr">';
  h += '<div class="fg"><label>เป้า H1 (บาท)</label><input type="text" inputmode="decimal" id="req_h1_target" class="fm-input js-money" value="' + nmI(req.h1Target || 0) + '"></div>';
  h += '<div class="fg"><label>เป้า H2 (บาท)</label><input type="text" inputmode="decimal" id="req_h2_target" class="fm-input js-money" value="' + nmI(req.h2Target || 0) + '"></div>';
  h += '</div>';
  h += '<div style="font-size:.68rem;color:var(--text3);margin-bottom:8px">รวมทั้งปี: ' + fmtMoney((Number(req.h1Target) || 0) + (Number(req.h2Target) || 0)) + ' ฿</div>';

  h += '<div class="form-section">📋 DSEC Certification</div>';
  h += '<div class="fr"><div class="fg"><label>จำนวนพนักงานที่ต้องผ่าน DSEC</label><input type="number" id="req_dsec_required" class="fm-input" value="' + (req.dsecRequired || 0) + '" min="0"></div></div>';
  
  h += '<div class="form-section">🚁 Demo Requirement</div>';
  h += '<div class="fg"><label>เงื่อนไข Demo</label><select id="req_demo_required" class="fm-input">';
  h += '<option value="none"' + (demoRequired === 'none' ? ' selected' : '') + '>❌ ไม่ต้องมี Demo</option>';
  h += '<option value="option1"' + (demoRequired === 'option1' ? ' selected' : '') + '>📦 ต้องมี Option 1 เท่านั้น</option>';
  h += '<option value="option2"' + (demoRequired === 'option2' ? ' selected' : '') + '>📦 ต้องมี Option 2 เท่านั้น</option>';
  h += '<option value="either"' + (demoRequired === 'either' ? ' selected' : '') + '>📦 มี Option 1 หรือ Option 2 อย่างใดอย่างหนึ่ง</option>';
  h += '<option value="both"' + (demoRequired === 'both' ? ' selected' : '') + '>📦 ต้องมีทั้ง Option 1 และ Option 2</option>';
  h += '</select></div>';
  
  h += '<div class="fg"><label>📦 Option 1 Models (Drone + Payload + Small Drone)</label>';
  h += '<div id="req_option1_list" class="tag-list" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">';
  var opt1Models = req.option1Models || [];
  for (var i = 0; i < opt1Models.length; i++) {
    h += '<span class="tag tag-count" style="display:inline-flex;align-items:center;gap:4px">' + sanitize(opt1Models[i]) + 
         ' <button class="btn-xs" style="padding:0 4px" onclick="removeOption1Model(' + i + ')">✕</button></span>';
  }
  h += '</div>';
  h += '<div style="display:flex;gap:4px"><input type="text" id="opt1_new_model" class="fm-input" placeholder="พิมพ์ชื่อ Model..." list="globalModelList">';
  h += '<button class="btn bsm bp" onclick="addOption1Model()">➕</button></div></div>';
  
  h += '<div class="fg"><label>📦 Option 2 Models (Dock + Drone)</label>';
  h += '<div id="req_option2_list" class="tag-list" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">';
  var opt2Models = req.option2Models || [];
  for (var i = 0; i < opt2Models.length; i++) {
    h += '<span class="tag tag-count" style="display:inline-flex;align-items:center;gap:4px">' + sanitize(opt2Models[i]) + 
         ' <button class="btn-xs" style="padding:0 4px" onclick="removeOption2Model(' + i + ')">✕</button></span>';
  }
  h += '</div>';
  h += '<div style="display:flex;gap:4px"><input type="text" id="opt2_new_model" class="fm-input" placeholder="พิมพ์ชื่อ Model..." list="globalModelList">';
  h += '<button class="btn bsm bp" onclick="addOption2Model()">➕</button></div></div>';
  
  document.getElementById('reqEditor').innerHTML = h;
  currentReqLevel = level;
}

function addOption1Model() {
  var input = document.getElementById('opt1_new_model');
  var model = input.value.trim();
  if (!model) return;
  
  var cfg = getConfig();
  if (!cfg.levelRequirements) cfg.levelRequirements = {};
  if (!cfg.levelRequirements[currentReqLevel]) cfg.levelRequirements[currentReqLevel] = {};
  if (!cfg.levelRequirements[currentReqLevel].option1Models) cfg.levelRequirements[currentReqLevel].option1Models = [];
  
  cfg.levelRequirements[currentReqLevel].option1Models.push(model);
  saveConfig(cfg);
  
  input.value = '';
  renderLevelRequirementsEditor(currentReqLevel);
}

function removeOption1Model(idx) {
  var cfg = getConfig();
  if (cfg.levelRequirements?.[currentReqLevel]?.option1Models) {
    cfg.levelRequirements[currentReqLevel].option1Models.splice(idx, 1);
    saveConfig(cfg);
    renderLevelRequirementsEditor(currentReqLevel);
  }
}

function addOption2Model() {
  var input = document.getElementById('opt2_new_model');
  var model = input.value.trim();
  if (!model) return;
  
  var cfg = getConfig();
  if (!cfg.levelRequirements) cfg.levelRequirements = {};
  if (!cfg.levelRequirements[currentReqLevel]) cfg.levelRequirements[currentReqLevel] = {};
  if (!cfg.levelRequirements[currentReqLevel].option2Models) cfg.levelRequirements[currentReqLevel].option2Models = [];
  
  cfg.levelRequirements[currentReqLevel].option2Models.push(model);
  saveConfig(cfg);
  
  input.value = '';
  renderLevelRequirementsEditor(currentReqLevel);
}

function removeOption2Model(idx) {
  var cfg = getConfig();
  if (cfg.levelRequirements?.[currentReqLevel]?.option2Models) {
    cfg.levelRequirements[currentReqLevel].option2Models.splice(idx, 1);
    saveConfig(cfg);
    renderLevelRequirementsEditor(currentReqLevel);
  }
}

function saveLevelRequirements() {
  var cfg = getConfig();
  if (!cfg.levelRequirements) cfg.levelRequirements = {};
  if (!cfg.levelRequirements[currentReqLevel]) cfg.levelRequirements[currentReqLevel] = {};
  
  cfg.levelRequirements[currentReqLevel].h1Target = parseNum(document.getElementById('req_h1_target').value);
  cfg.levelRequirements[currentReqLevel].h2Target = parseNum(document.getElementById('req_h2_target').value);
  cfg.levelRequirements[currentReqLevel].dsecRequired = parseInt(document.getElementById('req_dsec_required').value) || 0;
  cfg.levelRequirements[currentReqLevel].demoRequired = document.getElementById('req_demo_required').value;
  
  saveConfig(cfg);
  toast('💾 บันทึก Requirements สำหรับ Level ' + currentReqLevel + ' แล้ว');
  render();
}

function resetLevelRequirements() {
  if (!confirm('⚠️ Reset Requirements ทั้งหมดเป็นค่าเริ่มต้น?')) return;
  var DEF = window.DEF_CONFIG;
  var cfg = getConfig();
  cfg.levelRequirements = JSON.parse(JSON.stringify(DEF.levelRequirements || {}));
  saveConfig(cfg);
  toast('🔄 Reset แล้ว');
  render();
}

// ================================================================
// NEW DEMO POLICIES (เหมือนเดิม)
// ================================================================
function renderNewDemoPoliciesList() {
  var cfg = getConfig();
  var policies = cfg.newDemoPolicies || [];
  var container = document.getElementById('ndpListContainer');
  if (!container) return;
  if (!policies.length) { container.innerHTML = '<div class="empty"><p>ยังไม่มีนโยบาย Demo สินค้าใหม่</p></div>'; return; }
  var html = '<div style="display:flex;flex-direction:column;gap:8px">';
  for (var i = 0; i < policies.length; i++) {
    var p = policies[i];
    var statusColor = p.enabled ? '#22c55e' : '#64748b';
    var statusText = p.enabled ? '✅ เปิดใช้งาน' : '⏸ ปิดใช้งาน';
    html += '<div class="ndp-item" style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span style="font-size:20px">🚁</span>';
    html += '<strong>' + sanitize(p.productName) + '</strong>';
    html += '</div>';
    html += '<div style="display:flex;gap:4px">';
    html += '<button class="btn bsm ' + (p.enabled ? 'bs' : 'bo') + '" onclick="toggleNewDemoPolicy(' + i + ')">' + (p.enabled ? '✅ เปิด' : '🔘 ปิด') + '</button>';
    html += '<button class="btn bsm bo" onclick="editNewDemoPolicy(' + i + ')">✏️</button>';
    html += '<button class="btn bsm bd" onclick="deleteNewDemoPolicy(' + i + ')">🗑️</button>';
    html += '</div></div>';
    html += '<div style="font-size:12px;color:var(--text2);margin-bottom:4px">📅 วางจำหน่าย: ' + fD(p.releaseDate) + '</div>';
    html += '<div style="font-size:12px;color:var(--text2);margin-bottom:4px">⏰ ต้องสั่งซื้อภายใน: ' + p.orderWithinDays + ' วัน</div>';
    html += '<div style="font-size:11px;color:var(--text3);margin-top:4px;padding:6px;background:rgba(245,158,11,0.05);border-radius:6px">📝 ' + sanitize(p.alertMessage) + '</div>';
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function showAddNewDemoPolicyM() {
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>🚁 ชื่อสินค้า *</label><input type="text" id="ndp_product" class="fm-input" placeholder="เช่น DJI Matrice 5 Series"></div>';
  h += '<div class="fm-group">' + dpH('ndp_release', '', '📅 วันที่วางจำหน่าย') + '</div>';
  h += '<div class="fm-group"><label>⏰ ต้องสั่งซื้อภายใน (วัน)</label><input type="number" id="ndp_days" class="fm-input" value="60" min="1"></div>';
  h += '<div class="fm-group"><label>📝 ข้อความแจ้งเตือน</label><textarea id="ndp_message" rows="3" class="fm-input" placeholder="ข้อความเตือนที่จะแสดงให้ Dealer เห็น..."></textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="saveNewDemoPolicy()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('➕ เพิ่มนโยบายสินค้าใหม่', h);
}

function saveNewDemoPolicy() {
  var productName = document.getElementById('ndp_product').value.trim();
  var releaseDate = dpG('ndp_release');
  var orderWithinDays = parseInt(document.getElementById('ndp_days').value) || 60;
  var alertMessage = document.getElementById('ndp_message').value.trim();
  if (!productName) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  if (!releaseDate) { toast('กรุณาใส่วันที่วางจำหน่าย'); return; }
  if (!alertMessage) alertMessage = '⚠️ ต้องสั่งซื้อ Demo รุ่นใหม่ภายใน ' + orderWithinDays + ' วัน มิฉะนั้นอาจส่งผลต่อสถานะพาร์ทเนอร์';
  var cfg = getConfig();
  if (!cfg.newDemoPolicies) cfg.newDemoPolicies = [];
  cfg.newDemoPolicies.push({
    id: 'ndp_' + Date.now(),
    enabled: true,
    productName: productName,
    releaseDate: releaseDate,
    orderWithinDays: orderWithinDays,
    alertMessage: alertMessage
  });
  saveConfig(cfg);
  closeMForce();
  toast('✅ เพิ่มนโยบายสินค้าใหม่แล้ว');
  renderNewDemoPoliciesList();
  render();
  if (typeof forceSyncAll === 'function') forceSyncAll();
}

function editNewDemoPolicy(idx) {
  var cfg = getConfig();
  var p = cfg.newDemoPolicies[idx];
  if (!p) return;
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>🚁 ชื่อสินค้า *</label><input type="text" id="ndp_product" class="fm-input" value="' + sanitize(p.productName) + '"></div>';
  h += '<div class="fm-group">' + dpH('ndp_release', p.releaseDate, '📅 วันที่วางจำหน่าย') + '</div>';
  h += '<div class="fm-group"><label>⏰ ต้องสั่งซื้อภายใน (วัน)</label><input type="number" id="ndp_days" class="fm-input" value="' + p.orderWithinDays + '" min="1"></div>';
  h += '<div class="fm-group"><label>📝 ข้อความแจ้งเตือน</label><textarea id="ndp_message" rows="3" class="fm-input">' + sanitize(p.alertMessage) + '</textarea></div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn bp" onclick="updateNewDemoPolicy(' + idx + ')">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('✏️ แก้ไขนโยบายสินค้าใหม่', h);
}

function updateNewDemoPolicy(idx) {
  var cfg = getConfig();
  if (!cfg.newDemoPolicies || !cfg.newDemoPolicies[idx]) return;
  cfg.newDemoPolicies[idx].productName = document.getElementById('ndp_product').value.trim();
  cfg.newDemoPolicies[idx].releaseDate = dpG('ndp_release');
  cfg.newDemoPolicies[idx].orderWithinDays = parseInt(document.getElementById('ndp_days').value) || 60;
  cfg.newDemoPolicies[idx].alertMessage = document.getElementById('ndp_message').value.trim();
  saveConfig(cfg);
  closeMForce();
  toast('💾 บันทึกแล้ว');
  renderNewDemoPoliciesList();
  if (typeof forceSyncAll === 'function') forceSyncAll();
}

function toggleNewDemoPolicy(idx) {
  var cfg = getConfig();
  if (!cfg.newDemoPolicies || !cfg.newDemoPolicies[idx]) return;
  cfg.newDemoPolicies[idx].enabled = !cfg.newDemoPolicies[idx].enabled;
  saveConfig(cfg);
  toast(cfg.newDemoPolicies[idx].enabled ? '✅ เปิดใช้งานแล้ว' : '⏸ ปิดใช้งานแล้ว');
  renderNewDemoPoliciesList();
  if (typeof forceSyncAll === 'function') forceSyncAll();
}

function deleteNewDemoPolicy(idx) {
  if (!confirm('ลบนโยบายนี้?')) return;
  var cfg = getConfig();
  cfg.newDemoPolicies.splice(idx, 1);
  saveConfig(cfg);
  toast('🗑️ ลบแล้ว');
  renderNewDemoPoliciesList();
  if (typeof forceSyncAll === 'function') forceSyncAll();
}

function resetNewDemoPolicies() {
  if (!confirm('⚠️ Reset นโยบายสินค้าใหม่เป็นค่าเริ่มต้น?')) return;
  var cfg = getConfig();
  cfg.newDemoPolicies = [
    {
      id: 'ndp_1',
      enabled: true,
      productName: 'DJI Matrice 5 Series',
      releaseDate: '2026-06-15',
      orderWithinDays: 60,
      alertMessage: '⚠️ หากไม่ดำเนินการสั่งซื้อ Demo รุ่นใหม่ภายในเวลาที่กำหนด อาจส่งผลต่อการพิจารณาปรับลดสถานะ SAB Level ได้'
    }
  ];
  saveConfig(cfg);
  toast('🔄 Reset แล้ว');
  renderNewDemoPoliciesList();
  if (typeof forceSyncAll === 'function') forceSyncAll();
}

function saveH1Period() {
  var cfg = getConfig();
  cfg.h1Period = {
    startMonth: parseInt(document.getElementById('h1_start_month').value) || 0,
    startDay: parseInt(document.getElementById('h1_start_day').value) || 1,
    endMonth: parseInt(document.getElementById('h1_end_month').value) || 5,
    endDay: parseInt(document.getElementById('h1_end_day').value) || 30
  };
  saveConfig(cfg);
  toast('💾 บันทึก H1 Period แล้ว');
  render();
}

function saveH2Period() {
  var cfg = getConfig();
  cfg.h2Period = {
    startMonth: parseInt(document.getElementById('h2_start_month').value) || 6,
    startDay: parseInt(document.getElementById('h2_start_day').value) || 1,
    endMonth: parseInt(document.getElementById('h2_end_month').value) || 11,
    endDay: parseInt(document.getElementById('h2_end_day').value) || 31
  };
  saveConfig(cfg);
  toast('💾 บันทึก H2 Period แล้ว');
  render();
}

function toggleShowH2InClientView() {
  var cfg = getConfig();
  cfg.showH2InClientView = document.getElementById('h2_show_clientview').checked;
  saveConfig(cfg);
  toast(cfg.showH2InClientView ? '👁️ เปิดแสดง H2 ใน Client-view แล้ว' : '🙈 ปิดการแสดง H2 ใน Client-view แล้ว');
}

function initNewDemoPolicies() {
  renderNewDemoPoliciesList();
}

// ================================================================
// TEAM MANAGEMENT FUNCTIONS
// ================================================================
function getSalesMembers() {
  try { return JSON.parse(localStorage.getItem('v7_salesMembers') || '[]'); } catch(e) { return []; }
}

function saveSalesMembers(members) {
  localStorage.setItem('v7_salesMembers', JSON.stringify(members));
  if (typeof syncToFirebase === 'function') syncToFirebase('salesMembers', members);
  if (typeof publishTeamConfig === 'function') publishTeamConfig(members);
}

function renderTeamMemberListHTML() {
  var members = getSalesMembers();
  if (!members.length) return '<div style="padding:16px;color:var(--text3);font-size:.76rem;text-align:center">ยังไม่มีสมาชิกทีม — กด ➕ เพิ่ม Sales</div>';
  var html = '<div style="display:flex;flex-direction:column;gap:6px">';
  for (var i = 0; i < members.length; i++) {
    var m = members[i];
    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg2);border-radius:8px;border:1px solid var(--border)">';
    html += '<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem;flex-shrink:0">' + (m.name || '?').charAt(0).toUpperCase() + '</div>';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-weight:600;font-size:.8rem">' + sanitize(m.name) + (m.active === false ? ' <span style="font-size:.6rem;color:var(--text2);background:var(--bg3);padding:1px 5px;border-radius:4px">ปิด</span>' : '') + '</div>';
    html += '<div style="font-size:.63rem;color:var(--text3);margin-top:2px">PIN: <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;font-size:.68rem">' + m.pin + '</code>&nbsp;·&nbsp;ID: <span style="opacity:.7">' + m.id + '</span></div>';
    html += '</div>';
    html += '<div style="display:flex;gap:4px;flex-shrink:0">';
    html += '<button class="btn bsm ' + (m.active !== false ? 'bs' : 'bo') + '" onclick="toggleSalesMember(\'' + m.id + '\')" title="' + (m.active !== false ? 'เปิดใช้งาน' : 'ปิดใช้งาน') + '">' + (m.active !== false ? '✅' : '⏸') + '</button>';
    html += '<button class="btn bsm bo" onclick="copyTeamLink(\'' + m.id + '\')" title="Copy Sales Link">🔗</button>';
    html += '<button class="btn bsm bd" onclick="deleteSalesMember(\'' + m.id + '\')">✕</button>';
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}

function showAddSalesMemberM(fromMismatch) {
  var rndPin = Math.floor(1000 + Math.random() * 9000).toString();
  openM('➕ เพิ่มสมาชิกทีม Sales',
    '<div class="fm-group"><label>ชื่อ Sales *</label>' +
    '<input type="text" id="sm_name" class="fm-input" placeholder="เช่น นายก, Krit..."></div>' +
    '<div class="fm-group"><label>PIN (4 หลัก) — ใช้ Login sales-view</label>' +
    '<input type="text" id="sm_pin" class="fm-input" maxlength="6" placeholder="ตัวเลข 4-6 หลัก" value="' + rndPin + '"></div>' +
    '<div class="fm-actions">' +
    '<button class="btn bp" onclick="addSalesMember(' + (fromMismatch ? 1 : 0) + ')">💾 เพิ่มสมาชิก</button>' +
    '<button class="btn bo" onclick="closeM()">ยกเลิก</button>' +
    '</div>'
  );
}

function addSalesMember(fromMismatch) {
  var nameEl = document.getElementById('sm_name');
  var pinEl = document.getElementById('sm_pin');
  if (!nameEl || !nameEl.value.trim()) { toast('กรุณาใส่ชื่อ'); return; }
  if (!pinEl || !pinEl.value.trim()) { toast('กรุณาใส่ PIN'); return; }
  var name = nameEl.value.trim();
  var pin = pinEl.value.trim();
  if (!/^\d{4,6}$/.test(pin)) { toast('PIN ต้องเป็นตัวเลข 4-6 หลัก'); return; }
  var members = getSalesMembers();
  var id = 'sm_' + Date.now().toString(36);
  members.push({ id: id, name: name, pin: pin, active: true, createdAt: new Date().toISOString() });
  saveSalesMembers(members);
  if (typeof db !== 'undefined' && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    db.collection('salesMembers').doc(id).set({
      name: name, pin: pin, active: true,
      mainUid: CURRENT_USER.uid,
      createdAt: new Date().toISOString()
    }).catch(function(e) { console.warn('salesMembers write error:', e); });
  }
  closeMForce();
  toast('✅ เพิ่ม ' + name + ' แล้ว');
  if (fromMismatch) showSaleNameMismatchM();
  else { var el = document.getElementById('teamMemberList'); if (el) el.innerHTML = renderTeamMemberListHTML(); }
}

function deleteSalesMember(id) {
  if (!confirm('ลบสมาชิกนี้?\nข้อมูล Pipeline ของเขาใน Firestore จะยังคงอยู่')) return;
  var members = getSalesMembers().filter(function(m) { return m.id !== id; });
  saveSalesMembers(members);
  toast('🗑️ ลบสมาชิกแล้ว');
  if (_smmIsOpen()) { showSaleNameMismatchM(); return; }
  var el = document.getElementById('teamMemberList');
  if (el) el.innerHTML = renderTeamMemberListHTML();
}

function _smmIsOpen() { return !!document.getElementById('smmRoot'); }

// ================================================================
// แก้ไขชื่อสมาชิกทีม — ต้องโอน saleName ในข้อมูล Dealer/Pipeline/Visit + salesMemberName
// ในแผน KPI เก่าที่เคยสร้างไว้ (เป็น snapshot ตอนสร้างแผน ไม่ได้ผูก live กับชื่อสมาชิก) ไปด้วย
// ไม่งั้นเปลี่ยนชื่อแล้ว KPI จะคำนวณไม่เจอ (สลับด้านกับปัญหาเดิมที่ _saleNameUsageMap ตรวจเจอ)
// ================================================================
function showEditSalesMemberNameM(id, fromMismatch) {
  var m = getSalesMembers().filter(function(x) { return x.id === id; })[0];
  if (!m) return;
  // เสนอชื่อที่ "ลอย" (พบในข้อมูล Dealer/Pipeline/Visit จริง แต่ไม่ตรงกับสมาชิกทีมคนไหน) ให้เลือกในช่องนี้ด้วย
  // เผื่อกรณีอยากรวมชื่อ ICE ว่างๆ ให้กลายเป็นชื่อจริงที่มีลูกค้าอยู่แล้ว ไม่ต้องพิมพ์เองให้พลาดตัวสะกด
  var known = {};
  getSalesMembers().forEach(function(x) { known[x.name] = true; });
  var orphanNames = Object.keys(_saleNameUsageMap()).filter(function(n) { return !known[n]; });
  var datalistHtml = '<datalist id="sm_edit_name_list">' + orphanNames.map(function(n) { return '<option value="' + sanitize(n) + '">'; }).join('') + '</datalist>';

  openM('✏️ แก้ไขชื่อเซลล์',
    '<div class="fm-group"><label>ชื่อใหม่</label><input type="text" id="sm_edit_name" class="fm-input" list="sm_edit_name_list" value="' + sanitize(m.name) + '" placeholder="พิมพ์เอง หรือเลือกจากชื่อที่พบในข้อมูล">' + datalistHtml + '</div>' +
    (orphanNames.length ? '<p style="font-size:.68rem;color:var(--text3);margin:4px 0 10px">💡 กดในช่องชื่อด้านบน จะมีชื่อที่พบในข้อมูลจริงให้เลือกด้วย: ' + orphanNames.map(sanitize).join(', ') + '</p>' : '') +
    '<p style="font-size:.68rem;color:var(--text3);margin:6px 0 10px">ถ้าเปลี่ยนชื่อ ระบบจะโอน Dealer/Pipeline/Visit/แผน KPI ที่ผูกกับชื่อเดิมมาเป็นชื่อใหม่ให้อัตโนมัติ ไม่ต้องไปแก้ทีละที่</p>' +
    '<div class="fm-actions">' +
    '<button class="btn bp" onclick="saveEditSalesMemberName(\'' + id + '\',' + (fromMismatch ? 1 : 0) + ')">💾 บันทึก</button>' +
    '<button class="btn bo" onclick="closeM()">ยกเลิก</button>' +
    '</div>'
  );
}

function saveEditSalesMemberName(id, fromMismatch) {
  var nameEl = document.getElementById('sm_edit_name');
  var newName = nameEl ? nameEl.value.trim() : '';
  if (!newName) { toast('กรุณาใส่ชื่อ'); return; }
  var members = getSalesMembers();
  var m = members.filter(function(x) { return x.id === id; })[0];
  if (!m) return;
  var oldName = m.name;
  if (oldName === newName) { closeMForce(); if (fromMismatch) showSaleNameMismatchM(); return; }
  if (members.some(function(x) { return x.id !== id && x.name === newName; })) { toast('⚠️ มีชื่อนี้อยู่แล้ว ใช้ "🔍 ตรวจสอบชื่อเซลล์" เพื่อโอนรวมแทน'); return; }

  var dealerIds = ST.getAll('dealers').filter(function(d) { return d.saleName === oldName; }).map(function(d) { return d.id; });
  var authDealerIds = ST.getAll('dealers').filter(function(d) { return d.authorizedBy === oldName; }).map(function(d) { return d.id; });
  var pipelineIds = ST.getAll('pipeline').filter(function(p) { return p.saleName === oldName; }).map(function(p) { return p.id; });
  var visitIds = ST.getAll('visits').filter(function(v) { return v.saleName === oldName; }).map(function(v) { return v.id; });
  var plans = getKpiQuarterPlans().filter(function(p) { return p.salesMemberName === oldName; });

  m.name = newName;
  saveSalesMembers(members);
  if (dealerIds.length) ST.updateMany('dealers', dealerIds, { saleName: newName }).forEach(function(d) { if (typeof syncItemToFirebase === 'function') syncItemToFirebase('dealers', d); });
  if (authDealerIds.length) ST.updateMany('dealers', authDealerIds, { authorizedBy: newName }).forEach(function(d) { if (typeof syncItemToFirebase === 'function') syncItemToFirebase('dealers', d); });
  if (pipelineIds.length) ST.updateMany('pipeline', pipelineIds, { saleName: newName }).forEach(function(p) { if (typeof syncItemToFirebase === 'function') syncItemToFirebase('pipeline', p); });
  if (visitIds.length) ST.updateMany('visits', visitIds, { saleName: newName }).forEach(function(v) { if (typeof syncItemToFirebase === 'function') syncItemToFirebase('visits', v); });
  if (plans.length) {
    var allPlans = getKpiQuarterPlans();
    allPlans.forEach(function(p) { if (p.salesMemberName === oldName) p.salesMemberName = newName; });
    saveKpiQuarterPlans(allPlans);
  }

  closeMForce();
  toast('✅ เปลี่ยนชื่อ "' + oldName + '" → "' + newName + '" แล้ว (โอนข้อมูลที่เกี่ยวข้องให้ด้วย)');
  if (fromMismatch) showSaleNameMismatchM();
  else { var el = document.getElementById('teamMemberList'); if (el) el.innerHTML = renderTeamMemberListHTML(); }
}

function toggleSalesMember(id) {
  var members = getSalesMembers();
  for (var i = 0; i < members.length; i++) {
    if (members[i].id === id) { members[i].active = members[i].active === false ? true : false; break; }
  }
  saveSalesMembers(members);
  var el = document.getElementById('teamMemberList');
  if (el) el.innerHTML = renderTeamMemberListHTML();
}

// ================================================================
// ตรวจสอบชื่อเซลล์ไม่ตรงกัน — Dealer/Pipeline/Visit เก็บ saleName เป็น string อิสระ
// ถ้าเปลี่ยนชื่อสมาชิกทีม (หรือชื่อเดิมพิมพ์ไม่ตรง) ข้อมูลเก่าจะไม่ขยับตาม ทำให้ KPI (จับคู่ตาม
// string เป๊ะๆ) คำนวณไม่เจอเลย — เครื่องมือนี้ช่วยหาชื่อที่ "ลอย" (ไม่ตรงกับสมาชิกทีมคนไหน) แล้วโอนได้
// ================================================================
function _saleNameUsageMap() {
  var map = {};
  function bump(name, kind) {
    if (!name) return;
    if (!map[name]) map[name] = { dealers: 0, pipelines: 0, visits: 0, authorizedDealers: 0 };
    map[name][kind]++;
  }
  ST.getAll('dealers').forEach(function(d) {
    bump(d.saleName, 'dealers');
    if (d.authorizedDate) bump(d.authorizedBy, 'authorizedDealers');
  });
  ST.getAll('pipeline').forEach(function(p) { bump(p.saleName, 'pipelines'); });
  ST.getAll('visits').forEach(function(v) { bump(v.saleName, 'visits'); });
  return map;
}

function showSaleNameMismatchM() {
  var members = getSalesMembers();
  var memberNames = {};
  members.forEach(function(m) { memberNames[m.name] = true; });
  var usage = _saleNameUsageMap();

  var h = '<div id="smmRoot">';
  h += '<p style="font-size:.72rem;color:var(--text3);margin-bottom:10px">ตรวจว่าชื่อเซลล์ (Sale Name) ที่บันทึกไว้ใน Dealer/Pipeline/Visit ตรงกับรายชื่อในทีม Sales ปัจจุบันไหม — ถ้าไม่ตรง (เช่น เปลี่ยนชื่อสมาชิกทีมแล้ว แต่ข้อมูลเก่ายังเป็นชื่อเดิม) KPI จะคำนวณไม่เจอเลย</p>';

  var nameCounts = {};
  members.forEach(function(m) { nameCounts[m.name] = (nameCounts[m.name] || 0) + 1; });
  var hasDup = Object.keys(nameCounts).some(function(n) { return nameCounts[n] > 1; });

  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  h += '<div style="font-size:.72rem;font-weight:700">✅ สมาชิกทีม Sales</div>';
  h += '<button class="btn bp bsm" onclick="showAddSalesMemberM(1)">➕ เพิ่มเซลล์</button>';
  h += '</div>';
  if (hasDup) {
    h += '<div style="font-size:.68rem;color:#ef4444;background:rgba(239,68,68,.1);border-radius:6px;padding:6px 8px;margin-bottom:8px">⚠️ มีชื่อซ้ำกันในทีม Sales — ระบบแยกไม่ออกว่าเป็นคนละคน (dropdown เลือกเซลล์จะขึ้นชื่อซ้ำ) ลบหรือแก้ชื่อให้ไม่ซ้ำกันด้านล่างนี้ได้เลย</div>';
  }
  members.forEach(function(m) {
    var u = usage[m.name];
    var total = u ? (u.dealers + u.pipelines + u.visits) : 0;
    var dupTag = nameCounts[m.name] > 1 ? ' <span style="color:#ef4444;font-size:.62rem">(PIN:' + sanitize(m.pin || '-') + ')</span>' : '';
    h += '<div class="kpi-detail-row" style="cursor:default;display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sanitize(m.name) + dupTag + '</span>' +
      '<span style="color:' + (total ? 'var(--text2)' : '#ef4444') + ';white-space:nowrap">' + (total ? total + ' รายการ' : '⚠️ ไม่พบข้อมูลเลย') + '</span>' +
      '<button class="btn bsm bo" style="flex-shrink:0" onclick="showEditSalesMemberNameM(\'' + m.id + '\',1)" title="แก้ไขชื่อ">✏️</button>' +
      '<button class="btn bsm bd" style="flex-shrink:0" onclick="deleteSalesMember(\'' + m.id + '\')" title="ลบ">🗑️</button>' +
      '</div>';
  });

  var orphanNames = Object.keys(usage).filter(function(n) { return !memberNames[n]; });
  h += '<div style="font-size:.72rem;font-weight:700;margin:14px 0 6px">⚠️ ชื่อที่พบในข้อมูล แต่ไม่ตรงกับสมาชิกทีมคนไหนเลย</div>';
  if (!orphanNames.length) {
    h += '<div style="font-size:.72rem;color:var(--text3);text-align:center;padding:8px">ไม่มี — ชื่อทั้งหมดตรงกันแล้ว ✅</div>';
  } else if (!members.length) {
    h += '<div style="font-size:.72rem;color:var(--text3);text-align:center;padding:8px">ยังไม่มีสมาชิกทีม Sales — เพิ่มก่อนถึงจะโอนชื่อได้</div>';
  } else {
    var memberOpts = members.map(function(m) { return '<option value="' + sanitize(m.name) + '">' + sanitize(m.name) + '</option>'; }).join('');
    orphanNames.forEach(function(n, idx) {
      var u = usage[n];
      var total = u.dealers + u.pipelines + u.visits + u.authorizedDealers;
      var rid = 'orphSel_' + idx;
      h += '<div style="background:var(--bg2);border-radius:8px;padding:8px;margin-bottom:6px">';
      h += '<div style="font-size:.76rem;font-weight:600">"' + sanitize(n) + '" <span style="font-weight:400;color:var(--text2);font-size:.68rem">(Dealer ' + u.dealers + ', Pipeline ' + u.pipelines + ', Visit ' + u.visits + (u.authorizedDealers ? ', Authorized-by ' + u.authorizedDealers : '') + ')</span></div>';
      h += '<div style="display:flex;gap:6px;margin-top:6px">';
      h += '<select id="' + rid + '" style="flex:1;font-size:.72rem"><option value="">→ โอนเป็น...</option>' + memberOpts + '</select>';
      h += '<button class="btn bp bsm" onclick="mergeSaleName(\'' + sanitize(n).replace(/'/g, "\\'") + '\',\'' + rid + '\')">โอน</button>';
      h += '</div></div>';
    });
  }
  h += '</div>';
  openM('🔍 ตรวจสอบชื่อเซลล์', h);
}

function mergeSaleName(oldName, selId) {
  var sel = document.getElementById(selId);
  var newName = sel ? sel.value : '';
  if (!newName) { toast('⚠️ เลือกชื่อที่จะโอนเป็นก่อน'); return; }
  var dealerIds = ST.getAll('dealers').filter(function(d) { return d.saleName === oldName; }).map(function(d) { return d.id; });
  var authDealerIds = ST.getAll('dealers').filter(function(d) { return d.authorizedBy === oldName; }).map(function(d) { return d.id; });
  var pipelineIds = ST.getAll('pipeline').filter(function(p) { return p.saleName === oldName; }).map(function(p) { return p.id; });
  var visitIds = ST.getAll('visits').filter(function(v) { return v.saleName === oldName; }).map(function(v) { return v.id; });
  var total = dealerIds.length + pipelineIds.length + visitIds.length + authDealerIds.length;
  if (!total) { toast('ไม่มีรายการให้โอน'); return; }
  if (!confirm('โอนชื่อ "' + oldName + '" → "' + newName + '"?\nDealer ' + dealerIds.length + ' · Pipeline ' + pipelineIds.length + ' · Visit ' + visitIds.length + (authDealerIds.length ? ' · Dealer(ผู้ Authorize) ' + authDealerIds.length : '') + ' รายการ (รวม ' + total + ')\n\nแก้ไขจริงในข้อมูล ย้อนกลับเองไม่ได้ (ต้องโอนกลับด้วยมือถ้าพลาด)')) return;

  if (dealerIds.length) ST.updateMany('dealers', dealerIds, { saleName: newName }).forEach(function(d) { if (typeof syncItemToFirebase === 'function') syncItemToFirebase('dealers', d); });
  if (authDealerIds.length) ST.updateMany('dealers', authDealerIds, { authorizedBy: newName }).forEach(function(d) { if (typeof syncItemToFirebase === 'function') syncItemToFirebase('dealers', d); });
  if (pipelineIds.length) ST.updateMany('pipeline', pipelineIds, { saleName: newName }).forEach(function(p) { if (typeof syncItemToFirebase === 'function') syncItemToFirebase('pipeline', p); });
  if (visitIds.length) ST.updateMany('visits', visitIds, { saleName: newName }).forEach(function(v) { if (typeof syncItemToFirebase === 'function') syncItemToFirebase('visits', v); });

  toast('✅ โอนชื่อ "' + oldName + '" → "' + newName + '" แล้ว (' + total + ' รายการ)');
  closeMForce();
  showSaleNameMismatchM();
}

function copyTeamLink(salesId) {
  var link = location.href.replace(/[^/]*(\?.*)?$/, '') + 'sales-view.html?id=' + salesId;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(function() { toast('📋 Copy Link แล้ว!'); });
  } else {
    var ta = document.createElement('textarea'); ta.value = link;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); toast('📋 Copy Link แล้ว!');
  }
}

// ================================================================
// SALES LINK PERMISSIONS — เมนู + แหล่งข้อมูลที่ลิงก์เซล (sales-view PIN) เข้าถึงได้
// รายชื่อ id ตรงกับ data-v ของ .nl ใน index.html sidebar จริง (เช็คแล้ว 2026-07-21)
// ================================================================
var SALES_LINK_MENU_GROUPS = [
  { label: 'หลัก', items: [
    {id:'today', name:'📌 วันนี้'}, {id:'dealers', name:'🏪 Dealers'}, {id:'pipeline', name:'📊 Pipeline'},
    {id:'pipelineTeam', name:'📊 Pipeline รวมทีม (ดูอย่างเดียว)'},
    {id:'pipeBoard', name:'📋 Board'}, {id:'pipeDash', name:'📊 Overview'}, {id:'salesOrders', name:'📦 Sales Order'},
    {id:'serialSearch', name:'🔍 ค้นหา Serial'}
  ]},
  { label: 'งาน', items: [
    {id:'tasks', name:'📋 Tasks'}, {id:'kanban', name:'📋 Kanban'}, {id:'prospectList', name:'🆕 Lead ที่ติดตาม'},
    {id:'visitPlan', name:'📅 Visit Plan'}, {id:'notes', name:'📓 Note'}, {id:'meetings', name:'📅 ประชุม'},
    {id:'calendar', name:'📆 ปฏิทิน'}, {id:'announcements', name:'📢 ประกาศ'}
  ]},
  { label: 'ข้อมูล', items: [
    {id:'forecastComparison', name:'📊 เปรียบเทียบ Forecast'}, {id:'visits', name:'🤝 Visit Report'},
    {id:'followup', name:'📞 Follow-up'}, {id:'forecast', name:'📦 Forecast'},
    {id:'report', name:'📊 Weekly Report'}, {id:'dashboard', name:'📈 Dashboard'}
  ]},
  { label: 'เครื่องมือ', items: [
    {id:'leads', name:'📋 Lead Forms'}, {id:'contactLogs', name:'📞 ศูนย์ติดต่อ'}, {id:'lineMessage', name:'💬 LINE Message'},
    {id:'emailDraftQuick', name:'📧 ส่งอีเมล (เลือก Dealer)'}, {id:'emailDrafts', name:'📧 Email Draft'},
    {id:'presentation', name:'🎬 Presentation'}, {id:'feedback', name:'💡 Feedback'}
  ]},
  { label: 'สินค้าและราคา', items: [
    {id:'products', name:'📋 สินค้าทั้งหมด'}, {id:'stock', name:'📦 Stock สินค้า'},
    {id:'stockBatchReceive', name:'📥 รับของเข้าคลัง (Batch)'}, {id:'productPrices', name:'💰 ราคาตาม Level'},
    {id:'productBundles', name:'🎁 Bundle/Combo'}, {id:'productDemo', name:'🚁 Demo Unit'},
    {id:'productImport', name:'📥 Import/Export'}
  ]},
  { label: 'ติดตาม', items: [
    {id:'kpi', name:'🎯 KPI'}, {id:'customKpi', name:'🎯 KPI Dashboard'}, {id:'monthlyGoal', name:'🎯 Monthly Goal'},
    {id:'demoTracker', name:'🚁 Demo Equipment'}, {id:'kpiScorecard', name:'📊 KPI เซลล์'},
    {id:'quotationV2', name:'💰 Quotation V2'}, {id:'marginAnalysis', name:'📊 Margin Analysis'}, {id:'knowledge', name:'📚 Knowledge'}
  ]},
  { label: 'ระบบ', items: [
    {id:'exports', name:'📤 Export'}, {id:'health', name:'🏥 Data Health'}, {id:'reminders', name:'🔔 แจ้งเตือน'},
    {id:'insights', name:'🤖 Insights'}, {id:'customerUpdates', name:'📥 คำขออัพเดท (เฉพาะของ Dealer ตัวเอง)'},
    {id:'customerUpdateHistory', name:'📜 ประวัติอัพเดท'},
    {id:'customerForecastUpdates', name:'📦 แผนซื้อลูกค้า'}, {id:'customerForecastSummary', name:'📊 สรุป Forecast ลูกค้า'},
    {id:'auditLog', name:'📜 Audit Log'}, {id:'admin', name:'⚙️ ตั้งค่า (Admin)'}
  ]}
];

var SALES_LINK_DATA_TYPES = [
  {id:'dealers', name:'🏪 Dealers'},
  {id:'pipeline', name:'📊 Pipeline'},
  {id:'products', name:'📦 สินค้าและราคา'},
  {id:'levelRequirements', name:'🚁 เกณฑ์ Demo (Level requirement)'},
  {id:'visits', name:'🤝 Visit Report'},
  {id:'tasks', name:'📋 Tasks'},
  {id:'quotations', name:'💰 Quotation'},
  {id:'notes', name:'📓 Note'}
];
var SALES_LINK_DATA_MODE_OPTIONS = [
  {v:'shared', name:'ใช้ร่วมกันทั้งทีม'},
  {v:'readonly', name:'อ่านอย่างเดียวจากแอปหลัก'},
  {v:'private', name:'ส่วนตัว'}
];

function renderSalesLinkPermissionsHTML() {
  var cfg = getConfig();
  var perm = cfg.salesLinkPermissions || { allowedMenus: [], dataMode: {} };
  var allowed = perm.allowedMenus || [];

  var html = '<div style="max-height:420px;overflow-y:auto;margin-bottom:14px">';
  html += '<div class="form-section" style="margin-top:0">📋 เมนูที่เข้าถึงได้</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px">';
  SALES_LINK_MENU_GROUPS.forEach(function(g) {
    html += '<div style="background:var(--bg2);border-radius:8px;padding:10px 12px">';
    html += '<div style="font-size:.68rem;font-weight:700;color:var(--text2);margin-bottom:6px">' + sanitize(g.label) + '</div>';
    g.items.forEach(function(it) {
      html += '<label style="display:flex;gap:6px;align-items:center;font-size:.72rem;padding:2px 0">' +
        '<input type="checkbox" class="slp-menu-chk" value="' + it.id + '" style="width:auto" ' + (allowed.indexOf(it.id) !== -1 ? 'checked' : '') + '>' +
        sanitize(it.name) + '</label>';
    });
    html += '</div>';
  });
  html += '</div>';

  html += '<div class="form-section">🗂️ แหล่งข้อมูลแต่ละประเภท</div>';
  html += '<div style="display:flex;flex-direction:column">';
  SALES_LINK_DATA_TYPES.forEach(function(dt) {
    var curMode = (perm.dataMode || {})[dt.id] || 'private';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border)">';
    html += '<span style="font-size:.76rem">' + sanitize(dt.name) + '</span>';
    html += '<select class="slp-datamode-sel" data-type="' + dt.id + '" style="font-size:.72rem;width:auto">';
    SALES_LINK_DATA_MODE_OPTIONS.forEach(function(o) {
      html += '<option value="' + o.v + '"' + (o.v === curMode ? ' selected' : '') + '>' + o.name + '</option>';
    });
    html += '</select></div>';
  });
  html += '</div>';

  html += '<button class="btn bp bsm" style="margin-top:12px" onclick="saveSalesLinkPermissions()">💾 บันทึกสิทธิ์ลิงก์เซล</button>';
  return html;
}

// เฉพาะ 4 เมนูนี้เขียนผ่าน ST.add/update/delete จริง (ดู GUEST_VIEW_COLL_TO_MENU ใน firebase-sync.js) —
// "แก้ไขได้" (Tier B) จึงมีผลแค่ 4 เมนูนี้ ต่อให้ profile.menus มีเมนูอื่นด้วยก็ยังดูอย่างเดียวเสมอ
var GV_EDITABLE_MENUS = [
  { id: 'stock', name: '📦 Stock' },
  { id: 'salesOrders', name: '📋 Sales Order' },
  { id: 'dealers', name: '🏪 Dealers' },
  { id: 'pipeline', name: '📊 Pipeline' }
];

// ฟิลด์ย่อยที่ซ่อนได้ต่อโปรไฟล์ (คนละเรื่องกับ "เมนูที่ดูได้" — นี่คือซ่อนบางจุดในเมนูที่ยังดูได้ปกติ) จัดกลุ่ม
// ตามเมนูให้ดูง่าย — การซ่อนคือลบ element ออกจาก DOM เลย ไม่ใช่แค่ disable/มาสก์ค่า (ดู _gvHidden ใน firebase-sync.js)
var GV_HIDE_FIELD_GROUPS = [
  { label: '📦 Stock', items: [
    { id: 'stock_cost', name: 'มูลค่ารวม/ต้นทุน (การ์ดสรุปค้างนาน)' },
    { id: 'stock_priceLevels', name: 'ราคาทุกเลเวล (RRP/S/A/B/Other)' },
    { id: 'stock_bookingInfo', name: 'ชื่อ Dealer/โครงการ/เซลที่จอง' }
  ]},
  { label: '📋 Sales Order', items: [
    { id: 'so_price', name: 'ราคา/หน่วย และยอดรวม' },
    { id: 'so_dealerInfo', name: 'ชื่อ Dealer และเลข PO ลูกค้า' }
  ]},
  { label: '🏪 Dealers', items: [
    { id: 'dealers_levelHealth', name: 'Level และ Health score' },
    { id: 'dealers_creditTerm', name: 'เครดิตเทอม' }
  ]},
  { label: '📊 Pipeline', items: [
    { id: 'pipeline_forecast', name: 'มูลค่าโครงการ (Forecast Amount)' },
    { id: 'pipeline_notes', name: 'บันทึกการเจรจา (Timeline/Remark/Win-Loss note)' }
  ]},
  { label: '📋 สินค้าทั้งหมด', items: [
    { id: 'products_margin', name: 'หน้า Margin ทั้งหมด (ซ่อนทั้งปุ่ม)' },
    { id: 'products_cost', name: 'ต้นทุนในฟอร์มแก้ไขสินค้า' }
  ]}
];

// ย้ายค่าจากรูปแบบเดี่ยวเดิม (cfg.guestViewPin/guestViewMenus) มาเป็นโปรไฟล์แรกอัตโนมัติ ครั้งเดียวตอนที่ยัง
// ไม่มี guestViewProfiles เลย — กันลิงก์เดิมที่เคยแจกไปหายไปเฉยๆ ตอนอัปเดตเป็นระบบหลายโปรไฟล์
function _gvGetProfiles(cfg) {
  if (cfg.guestViewProfiles && cfg.guestViewProfiles.length) return cfg.guestViewProfiles;
  if (cfg.guestViewPin) {
    return [{ id: 'legacy', name: 'ทีม', pin: cfg.guestViewPin, menus: cfg.guestViewMenus || ['stock', 'salesOrders'], editMenus: [] }];
  }
  return [];
}

function renderGuestViewProfilesHTML() {
  var cfg = getConfig();
  var profiles = _gvGetProfiles(cfg);
  var html = '<div id="gvProfilesWrap">';
  if (!profiles.length) html += '<div class="hint" style="margin-bottom:8px">ยังไม่มีโปรไฟล์ — กด "เพิ่มโปรไฟล์ใหม่" เพื่อเริ่ม</div>';
  profiles.forEach(function(pr, idx) { html += _gvProfileRowHTML(pr, idx); });
  html += '</div>';
  html += '<button class="btn bo bsm" onclick="addGuestViewProfile()">➕ เพิ่มโปรไฟล์ใหม่</button>';
  return html;
}

function _gvProfileRowHTML(pr, idx) {
  var menus = pr.menus || [];
  var editMenus = pr.editMenus || [];
  var hideFields = pr.hideFields || [];
  var active = !!pr.pin;
  var h = '<div id="gvRow_' + idx + '" style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:10px">';
  h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">';
  h += '<span class="tag" style="background:' + (active ? '#22c55e20;color:#22c55e' : '#64748b20;color:var(--text2)') + ';font-size:10px">' + (active ? 'เปิดใช้งานอยู่' : 'ยังไม่มี PIN') + '</span>';
  h += '<input type="text" id="gvp_name_' + idx + '" value="' + sanitize(pr.name || '') + '" placeholder="ชื่อโปรไฟล์ เช่น ทีมช่าง" style="flex:1;min-width:120px">';
  h += '<input type="text" id="gvp_pin_' + idx + '" value="' + sanitize(pr.pin || '') + '" placeholder="PIN" maxlength="10" style="width:90px">';
  h += '</div>';

  h += '<div class="form-section" style="margin-top:4px">📋 เมนูที่ดูได้</div>';
  h += '<div style="max-height:220px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:8px">';
  SALES_LINK_MENU_GROUPS.forEach(function(g) {
    h += '<div style="background:var(--bg2);border-radius:8px;padding:6px 8px">';
    h += '<div style="font-size:.64rem;font-weight:700;color:var(--text2);margin-bottom:3px">' + sanitize(g.label) + '</div>';
    g.items.forEach(function(it) {
      h += '<label style="display:flex;gap:5px;align-items:center;font-size:.68rem;padding:1px 0">' +
        '<input type="checkbox" class="gv-menu-chk" value="' + it.id + '" style="width:auto" ' + (menus.indexOf(it.id) !== -1 ? 'checked' : '') + '>' +
        sanitize(it.name) + '</label>';
    });
    h += '</div>';
  });
  h += '</div>';

  h += '<div class="form-section" style="margin-top:4px">✏️ เมนูที่แก้ไขได้ <span style="font-weight:400;font-size:.62rem;color:var(--text2)">(ต้องติ๊ก "ดูได้" ของเมนูนั้นด้วย ไม่งั้นจะยังเป็นดูอย่างเดียว)</span></div>';
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">';
  GV_EDITABLE_MENUS.forEach(function(m) {
    h += '<label style="display:flex;gap:5px;align-items:center;font-size:.7rem">' +
      '<input type="checkbox" class="gv-edit-chk" value="' + m.id + '" style="width:auto" ' + (editMenus.indexOf(m.id) !== -1 ? 'checked' : '') + '>' +
      sanitize(m.name) + '</label>';
  });
  h += '</div>';

  h += '<div class="form-section" style="margin-top:4px">🙈 ซ่อนฟิลด์ย่อย <span style="font-weight:400;font-size:.62rem;color:var(--text2)">(ซ่อนแค่หน้าจอ — ข้อมูลจริงยัง sync ลงเครื่อง Guest เต็มชุด ไม่ใช่การป้องกันข้อมูลระดับลึก)</span></div>';
  h += '<div style="max-height:220px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-bottom:10px">';
  GV_HIDE_FIELD_GROUPS.forEach(function(g) {
    h += '<div style="background:var(--bg2);border-radius:8px;padding:6px 8px">';
    h += '<div style="font-size:.64rem;font-weight:700;color:var(--text2);margin-bottom:3px">' + sanitize(g.label) + '</div>';
    g.items.forEach(function(it) {
      h += '<label style="display:flex;gap:5px;align-items:center;font-size:.68rem;padding:1px 0">' +
        '<input type="checkbox" class="gv-hide-chk" value="' + it.id + '" style="width:auto" ' + (hideFields.indexOf(it.id) !== -1 ? 'checked' : '') + '>' +
        sanitize(it.name) + '</label>';
    });
    h += '</div>';
  });
  h += '</div>';

  h += '<div class="bg" style="flex-wrap:wrap">';
  h += '<button class="btn bp bsm" onclick="saveGuestViewProfile(' + idx + ')">💾 บันทึก</button>';
  h += '<button class="btn bo bsm" onclick="copyGuestViewProfileLink(' + idx + ')"' + (active ? '' : ' disabled title="ตั้ง PIN แล้วบันทึกก่อน"') + '>🔗 คัดลอกลิงก์</button>';
  h += '<button class="btn bd bsm" onclick="removeGuestViewProfile(' + idx + ')">🗑️ ลบโปรไฟล์</button>';
  h += '</div>';
  h += '</div>';
  return h;
}

// อ่านค่าปัจจุบันจาก DOM ของแถวนั้นกลับเข้า cfg.guestViewProfiles[idx] (ไม่แตะ Firestore) — ใช้ก่อนทำอะไรที่
// re-render ทั้งการ์ด (เพิ่ม/ลบแถว) กันค่าที่พิมพ์ไว้ในแถวอื่นหายไปเฉยๆ
function _gvSyncRowToCfg(cfg, profiles, idx) {
  var row = document.getElementById('gvRow_' + idx);
  if (!row) return;
  var nameEl = document.getElementById('gvp_name_' + idx);
  var pinEl = document.getElementById('gvp_pin_' + idx);
  var menuChecks = row.querySelectorAll('.gv-menu-chk');
  var editChecks = row.querySelectorAll('.gv-edit-chk');
  var hideChecks = row.querySelectorAll('.gv-hide-chk');
  var menus = [];
  for (var i = 0; i < menuChecks.length; i++) if (menuChecks[i].checked) menus.push(menuChecks[i].value);
  var editMenus = [];
  for (var j = 0; j < editChecks.length; j++) if (editChecks[j].checked) editMenus.push(editChecks[j].value);
  editMenus = editMenus.filter(function(m) { return menus.indexOf(m) !== -1; }); // แก้ไขได้ต้องดูได้ด้วยเสมอ
  var hideFields = [];
  for (var k = 0; k < hideChecks.length; k++) if (hideChecks[k].checked) hideFields.push(hideChecks[k].value);
  profiles[idx] = {
    id: profiles[idx].id,
    name: nameEl ? nameEl.value.trim() : profiles[idx].name,
    pin: pinEl ? pinEl.value.trim() : profiles[idx].pin,
    menus: menus.length ? menus : ['stock'],
    editMenus: editMenus,
    hideFields: hideFields
  };
}

function _gvSyncAllRowsToCfg(cfg, profiles) {
  for (var i = 0; i < profiles.length; i++) _gvSyncRowToCfg(cfg, profiles, i);
}

function addGuestViewProfile() {
  var cfg = getConfig();
  var profiles = _gvGetProfiles(cfg).slice();
  _gvSyncAllRowsToCfg(cfg, profiles);
  profiles.push({ id: 'gv_' + Date.now().toString(36), name: '', pin: '', menus: ['stock'], editMenus: [], hideFields: [] });
  cfg.guestViewProfiles = profiles;
  saveConfig(cfg);
  render();
}

function removeGuestViewProfile(idx) {
  if (!confirm('ลบโปรไฟล์นี้? ลิงก์/PIN ของโปรไฟล์นี้จะใช้ไม่ได้ทันที')) return;
  var cfg = getConfig();
  var profiles = _gvGetProfiles(cfg).slice();
  _gvSyncAllRowsToCfg(cfg, profiles);
  var removed = profiles.splice(idx, 1)[0];
  cfg.guestViewProfiles = profiles;
  delete cfg.guestViewPin; delete cfg.guestViewMenus; // เลิกใช้ shape เดิมทันทีที่แก้ผ่านระบบโปรไฟล์แล้ว
  saveConfig(cfg);
  _gvPersistProfiles(profiles, function() { render(); });
}

// เขียนทั้ง array กลับไปที่ guestViewData/{uid}.profiles ครั้งเดียว (ง่ายกว่าคิด merge เป็นรายโปรไฟล์ และ
// จำนวนโปรไฟล์ต่อบัญชีน้อยอยู่แล้วไม่ต้องกังวลเรื่องขนาด doc)
function _gvPersistProfiles(profiles, cb) {
  if (typeof db === 'undefined' || !CURRENT_USER || !CURRENT_USER.uid) { if (cb) cb(); return; }
  db.collection('guestViewData').doc(CURRENT_USER.uid).set({ profiles: profiles, guestViewPin: '', guestViewMenus: [] }, { merge: true })
    .then(function() { if (cb) cb(); })
    .catch(function(e) { console.warn('_gvPersistProfiles error:', e); toast('⚠️ บันทึกไม่สำเร็จ (เช็คเน็ต/สิทธิ์)', true); });
}

function saveGuestViewProfile(idx) {
  var cfg = getConfig();
  var profiles = _gvGetProfiles(cfg).slice();
  _gvSyncRowToCfg(cfg, profiles, idx);
  if (!profiles[idx].pin) { toast('⚠️ กรอก PIN ก่อน', true); return; }
  cfg.guestViewProfiles = profiles;
  delete cfg.guestViewPin; delete cfg.guestViewMenus;
  saveConfig(cfg);
  if (typeof db === 'undefined' || !CURRENT_USER || !CURRENT_USER.uid) {
    toast('💾 บันทึกแล้ว (เฉพาะเครื่องนี้ — login ก่อนถึงจะใช้ลิงก์ได้จริง)');
    render();
    return;
  }
  _gvPersistProfiles(profiles, function() {
    if (typeof publishAllGuestViewData === 'function') publishAllGuestViewData();
    toast('💾 บันทึกโปรไฟล์แล้ว (' + profiles[idx].menus.length + ' เมนู)');
    render();
  });
}

// ลิงก์ไม่มี PIN ติดท้าย (คนที่ได้ลิงก์ต้องพิมพ์ PIN เอง บอกแยกกันคนละช่องทาง) แต่มี &profile= ระบุว่าเป็น
// โปรไฟล์ไหน เพราะแต่ละโปรไฟล์มี PIN/สิทธิ์ต่างกัน
function copyGuestViewProfileLink(idx) {
  if (!CURRENT_USER || !CURRENT_USER.uid) { toast('⚠️ ต้อง login ก่อนถึงจะสร้างลิงก์ได้', true); return; }
  var cfg = getConfig();
  var profiles = _gvGetProfiles(cfg);
  var pr = profiles[idx];
  if (!pr || !pr.pin) { toast('⚠️ ตั้ง PIN แล้วกด "บันทึก" ก่อนคัดลอกลิงก์', true); return; }
  var base = location.href.replace(/[^/]*(\?.*)?(#.*)?$/, '') + 'index.html';
  var link = base + '?guest=1&uid=' + CURRENT_USER.uid + '&profile=' + encodeURIComponent(pr.id);
  var msg = '📋 คัดลอกลิงก์แล้ว! (ไม่มี PIN ติดไป — บอก PIN แยกด้วย)';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(function() { toast(msg); });
  } else {
    var ta = document.createElement('textarea'); ta.value = link;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); toast(msg);
  }
}

function saveSalesLinkPermissions() {
  var checks = document.querySelectorAll('.slp-menu-chk');
  var allowed = [];
  for (var i = 0; i < checks.length; i++) if (checks[i].checked) allowed.push(checks[i].value);

  var dataMode = {};
  var sels = document.querySelectorAll('.slp-datamode-sel');
  for (var i = 0; i < sels.length; i++) dataMode[sels[i].getAttribute('data-type')] = sels[i].value;

  var cfg = getConfig();
  cfg.salesLinkPermissions = { allowedMenus: allowed, dataMode: dataMode };
  saveConfig(cfg);
  toast('💾 บันทึกสิทธิ์ลิงก์เซลเรียบร้อย (' + allowed.length + ' เมนู)');
}

function copyGMLink() {
  var link = location.href.replace(/[^/]*(\?.*)?$/, '') + 'gm-view.html';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(function() { toast('📋 Copy GM Link แล้ว!'); });
  } else {
    var ta = document.createElement('textarea'); ta.value = link;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); toast('📋 Copy GM Link แล้ว!');
  }
}