// ================================================================
// ADMIN PANEL
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
      '<button class="btn bsm bo" onclick="movePipeStatus(' + i + ',-1)" title="ขึ้น" style="padding:2px 6px">⬆️</button>' +
      '<button class="btn bsm bo" onclick="movePipeStatus(' + i + ',1)" title="ลง" style="padding:2px 6px">⬇️</button>' +
      '<button class="btn bsm bd" onclick="admRmPSt(' + i + ')">✕</button>' +
      '</div>';
  }

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
// ต่อท้าย rAdmin function ก่อนบรรทัด el.innerHTML = html (หรือหลัง el.innerHTML)
setTimeout(function() {
  initNewDemoPolicies();
}, 100);

  el.innerHTML = '' +
    // Data Overview
    '<div class="card"><h2>💾 ข้อมูลในระบบ (' + ST.getStorageSizeFormatted() + ')</h2>' +
    '<div class="sr">' + countCards + '</div></div>' +
// Appearance
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

    // Profile
    '<div class="card"><h2>👤 Profile</h2>' +
    '<div class="admin-row"><label>ชื่อ Sale</label>' +
    '<input type="text" id="adm_name" value="' + sanitize(cfg.saleName) + '"></div>' +
    '<button class="btn bp bsm" onclick="admSaveName()">💾 บันทึก</button></div>' +

    // KPI
    '<div class="card"><h2>🎯 KPI Settings</h2>' +
    '<div class="admin-row"><label>Follow-up / สัปดาห์</label>' +
    '<input type="number" id="adm_kpi_fu" value="' + cfg.kpi.followupPerWeek + '" min="0"></div>' +
    '<div class="admin-row"><label>Visit / สัปดาห์</label>' +
    '<input type="number" id="adm_kpi_vs" value="' + cfg.kpi.visitPerWeek + '" min="0"></div>' +
    '<button class="btn bp bsm" onclick="admSaveKPI()">💾 บันทึก</button></div>' +

    // Pipeline Statuses
    '<div class="card"><h2>📊 Pipeline Status</h2>' +
    '<div id="adm_pst">' + pstRows + '</div>' +
    '<div style="display:flex;gap:3px;margin-top:4px">' +
    '<input type="text" id="aps_new_id" placeholder="id (eng)" style="width:70px">' +
    '<input type="text" id="aps_new_nm" placeholder="ชื่อแสดง" style="flex:1">' +
    '<button class="btn bsm bp" onclick="admAddPSt()">➕</button></div>' +
    '<button class="btn bp bsm" style="margin-top:6px" onclick="admSavePSt()">💾 บันทึกทั้งหมด</button></div>' +

    // Models
    '<div class="card"><h2>📦 Product Models & ราคา</h2>' +
    '<div id="admModelList">' + (function() {
      var mh = '';
      for (var mi = 0; mi < cfg.models.length; mi++) {
        var m = cfg.models[mi];
        var mName = typeof m === 'object' ? m.name : m;
        var mPrice = typeof m === 'object' ? (m.price || '') : '';
        mh += '<div class="admin-row" style="display:flex;align-items:center;gap:4px" id="amr_' + mi + '">' +
          '<span style="color:var(--text2);font-size:11px;font-weight:700;min-width:20px;text-align:center">' + (mi + 1) + '</span>' +
          '<input type="text" value="' + sanitize(mName) + '" id="am_n_' + mi + '" style="flex:2;min-width:120px" placeholder="ชื่อ Model">' +
          '<input type="number" value="' + mPrice + '" id="am_p_' + mi + '" style="flex:1;min-width:80px" placeholder="ราคา (฿)">' +
          '<button class="btn bsm bo" onclick="admMoveModel(' + mi + ',-1)" style="padding:2px 6px">⬆️</button>' +
          '<button class="btn bsm bo" onclick="admMoveModel(' + mi + ',1)" style="padding:2px 6px">⬇️</button>' +
          '<button class="btn bsm bd" onclick="admRmModel(' + mi + ')">✕</button>' +
          '</div>';
      }
      return mh;
    })() + '</div>' +
    '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' +
    '<button class="btn bp bsm" onclick="admSaveModels()">💾 บันทึก</button>' +
    '<button class="btn bo bsm" onclick="admAddModel()">➕ เพิ่ม Model</button>' +
    '<button class="btn bo bsm" onclick="admImportModelsText()">📝 Import Text</button>' +
    '</div>' +
    '<div style="font-size:.6rem;color:var(--text2);margin-top:4px">💡 ราคาจะถูกดึงอัตโนมัติเมื่อเพิ่มสินค้าใน Pipeline</div></div>' +

    // Level Requirements (เพิ่มตรงนี้)
    '<div class="card"><h2>📋 Partner Level Requirements</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">กำหนดเป้าหมายและเงื่อนไขตามระดับ Dealer (S/A/B/Other)</p>' +
    '<div class="ftabs" style="margin-bottom:10px" id="reqLevelTabs">' +
    '<div class="ftab act" data-level="S">S (Strategic)</div>' +
    '<div class="ftab" data-level="A">A (Authorized)</div>' +
    '<div class="ftab" data-level="B">B (Basic)</div>' +
    '<div class="ftab" data-level="Other">Other (Trial)</div>' +
    '</div>' +
    '<div id="reqEditor"></div>' +
    '<div class="bg" style="margin-top:12px">' +
    '<button class="btn bp" onclick="saveLevelRequirements()">💾 บันทึก Requirements ทั้งหมด</button>' +
    '<button class="btn bo" onclick="resetLevelRequirements()">↻ Reset เป็นค่าเริ่มต้น</button>' +
    '</div></div>' +

    // New Demo Policies Management (รองรับหลายรายการ)
    '<div class="card"><h2>⚠️ New Demo Policies Management</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">จัดการสินค้าใหม่ที่ต้องแจ้งเตือน Dealer (รองรับหลายรายการ)</p>' +
    '<div id="ndpListContainer"></div>' +
    '<div class="bg" style="margin-top:8px">' +
    '<button class="btn bp bsm" onclick="showAddNewDemoPolicyM()">➕ เพิ่มสินค้าใหม่</button>' +
    '<button class="btn bo bsm" onclick="resetNewDemoPolicies()">↻ Reset ค่าเริ่มต้น</button>' +
    '</div></div>' +

    // H1 Period Setting
    '<div class="card"><h2>📅 H1 Period Setting</h2>' +
    '<p style="font-size:.68rem;color:var(--text3);margin-bottom:8px">กำหนดช่วงเวลาครึ่งปีแรก (ใช้สำหรับคำนวณยอดขาย)</p>' +
    '<div class="fr">' +
    '<div class="fg"><label>📆 เริ่มต้นเดือน</label><select id="h1_start_month" class="fm-input">' +
    '<option value="0"' + (cfg.h1Period?.startMonth === 0 ? ' selected' : '') + '>มกราคม</option>' +
    '<option value="1"' + (cfg.h1Period?.startMonth === 1 ? ' selected' : '') + '>กุมภาพันธ์</option>' +
    '<option value="2"' + (cfg.h1Period?.startMonth === 2 ? ' selected' : '') + '>มีนาคม</option>' +
    '<option value="3"' + (cfg.h1Period?.startMonth === 3 ? ' selected' : '') + '>เมษายน</option>' +
    '<option value="4"' + (cfg.h1Period?.startMonth === 4 ? ' selected' : '') + '>พฤษภาคม</option>' +
    '<option value="5"' + (cfg.h1Period?.startMonth === 5 ? ' selected' : '') + '>มิถุนายน</option>' +
    '</select></div>' +
    '<div class="fg"><label>📅 เริ่มต้นวันที่</label><input type="number" id="h1_start_day" class="fm-input" value="' + (cfg.h1Period?.startDay || 1) + '" min="1" max="31"></div>' +
    '</div>' +
    '<div class="fr">' +
    '<div class="fg"><label>📆 สิ้นสุดเดือน</label><select id="h1_end_month" class="fm-input">' +
    '<option value="0"' + (cfg.h1Period?.endMonth === 0 ? ' selected' : '') + '>มกราคม</option>' +
    '<option value="1"' + (cfg.h1Period?.endMonth === 1 ? ' selected' : '') + '>กุมภาพันธ์</option>' +
    '<option value="2"' + (cfg.h1Period?.endMonth === 2 ? ' selected' : '') + '>มีนาคม</option>' +
    '<option value="3"' + (cfg.h1Period?.endMonth === 3 ? ' selected' : '') + '>เมษายน</option>' +
    '<option value="4"' + (cfg.h1Period?.endMonth === 4 ? ' selected' : '') + '>พฤษภาคม</option>' +
    '<option value="5"' + (cfg.h1Period?.endMonth === 5 ? ' selected' : '') + '>มิถุนายน</option>' +
    '</select></div>' +
    '<div class="fg"><label>📅 สิ้นสุดวันที่</label><input type="number" id="h1_end_day" class="fm-input" value="' + (cfg.h1Period?.endDay || 30) + '" min="1" max="31"></div>' +
    '</div>' +
    '<button class="btn bp bsm" onclick="saveH1Period()">💾 บันทึก Period</button></div>' +

    // Unit Types
    '<div class="card"><h2>🏢 Unit Types</h2>' +
    '<textarea id="adm_units" rows="4" style="font-size:.72rem">' + cfg.unitTypes.join('\n') + '</textarea>' +
    '<button class="btn bp bsm" style="margin-top:4px" onclick="admSaveUnits()">💾 บันทึก</button></div>' +

    // Email Recipients
    '<div class="card"><h2>📧 Email Recipients</h2>' +
    '<div class="fg"><label>Visit Plan</label>' +
    '<input type="text" id="adm_em_vp" value="' + cfg.emailRecipients.visitPlan.join(', ') + '"></div>' +
    '<div class="fg"><label>Online Plan</label>' +
    '<input type="text" id="adm_em_op" value="' + cfg.emailRecipients.onlinePlan.join(', ') + '"></div>' +
    '<button class="btn bp bsm" onclick="admSaveEmail()">💾 บันทึก</button></div>' +
// DJI Dealer Types
    '<div class="card"><h2>🏪 DJI Dealer Types</h2>' +
    '<textarea id="adm_djitypes" rows="3" style="font-size:.72rem">' + (cfg.djiDealerTypes || []).join('\n') + '</textarea>' +
    '<div style="font-size:.62rem;color:#64748b;margin:3px 0">แต่ละบรรทัด = 1 ประเภท</div>' +
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
    '<div style="font-size:.62rem;color:#64748b;margin:3px 0">แต่ละบรรทัด = 1 รายการ (Reset ทุกต้นเดือน)</div>' +
    '<button class="btn bp bsm" onclick="admSaveMonthly()">💾 บันทึก</button></div>' +

    // External Links
    '<div class="card"><h2>🔗 External Links</h2>' +
    '<p style="font-size:.68rem;color:#64748b;margin-bottom:6px">Pricelist, Stock Check, เครื่องมือภายนอก</p>' +
    '<div id="adm_links">' + linkRows + '</div>' +
    '<div style="display:flex;gap:3px;margin-top:4px">' +
    '<input type="text" id="lk_new_n" placeholder="ชื่อ" style="width:80px">' +
    '<input type="url" id="lk_new_u" placeholder="https://..." style="flex:1">' +
    '<button class="btn bsm bp" onclick="admAddLink()">➕</button></div>' +
    '<button class="btn bp bsm" style="margin-top:6px" onclick="admSaveLinks()">💾 บันทึกทั้งหมด</button></div>' +

    quickLinks +

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

    // Notification
    '<div class="card"><h2>🔔 Browser Notification</h2>' +
    '<button class="btn bs" onclick="admReqNotif()">🔔 เปิดการแจ้งเตือน</button>' +
    '<div style="margin-top:4px;font-size:.68rem;color:#64748b" id="adm_nf_status"></div></div>' +

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

    // Cloud Sync Section
    '<div class="card"><h2>☁️ Google Sheets Sync</h2>' +
    '<div class="bg" style="flex-wrap:wrap; gap:8px">' +
    '<button class="btn bp" onclick="syncFirebaseToSheets()" style="background:#3b82f6">📤 Sync to Sheets</button>' +
    '<button class="btn bs" onclick="pullSheetsToFirebase()" style="background:#22c55e">📥 Pull from Sheets</button>' +
    '</div>' +
    '<div class="hint" style="margin-top:8px; font-size:11px; color:var(--text2)">' +
    '💡 <strong>Sync to Sheets</strong> = ส่งข้อมูล Firebase ไปยัง Google Sheets<br>' +
    '💡 <strong>Pull from Sheets</strong> = ดึงข้อมูลจาก Google Sheets กลับมา Firebase<br>' +
    '📌 ใช้เมื่อต้องการให้ลูกค้าเห็นข้อมูล หรือดึงข้อมูลที่ลูกค้าแก้ไขกลับมา' +
    '</div></div>' +

    // Danger Zone
    '<div class="card" style="border-color:#ef4444"><h2 style="color:#ef4444">⚠️ Danger Zone</h2>' +
    '<div class="bg">' +
    '<button class="btn bd" onclick="admResetRoutines()">🔄 Reset Routines</button>' +
    '<button class="btn bd" onclick="doClearAll()">🗑️ ล้างข้อมูลทั้งหมด</button>' +
    '</div></div>';

  // Set notification status
  var nfEl = document.getElementById('adm_nf_status');
  if (nfEl) {
    if ('Notification' in window) {
      nfEl.textContent = 'สถานะ: ' + Notification.permission;
    } else {
      nfEl.textContent = 'Browser ไม่รองรับ';
    }
  }
  
  // Initialize level requirement tabs after render
  setTimeout(function() {
    initLevelRequirementTabs();
  }, 100);
}

// ================================================================
// SAVE FUNCTIONS (เดิม)
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
      statuses.push({
        id: idEl.value,
        name: nmEl.value,
        color: clEl ? clEl.value : '#3b82f6'
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
  cfg.pipelineStatuses.push({ id: id, name: nm, color: '#3b82f6' });
  saveConfig(cfg);
  toast('➕ เพิ่มแล้ว');
  render();
}

function admRmPSt(idx) {
  if (!confirm('ลบ Status นี้?')) return;
  var cfg = getConfig();
  cfg.pipelineStatuses.splice(idx, 1);
  saveConfig(cfg);
  render();
}

function admSaveModels() {
  var cfg = getConfig();
  var newModels = [];
  for (var i = 0; i < cfg.models.length; i++) {
    var nameEl = document.getElementById('am_n_' + i);
    var priceEl = document.getElementById('am_p_' + i);
    if (!nameEl) continue;
    var name = nameEl.value.trim();
    if (!name) continue;
    var price = priceEl ? (parseFloat(priceEl.value) || 0) : 0;
    newModels.push({name: name, price: price});
  }
  cfg.models = newModels;
  saveConfig(cfg);
  toast('💾 บันทึก Models แล้ว (' + newModels.length + ' รายการ)');
  render();
}

function admAddModel() {
  var cfg = getConfig();
  cfg.models.push({name: '', price: 0});
  saveConfig(cfg);
  render();
  setTimeout(function() {
    var el = document.getElementById('am_n_' + (cfg.models.length - 1));
    if (el) el.focus();
  }, 100);
}

function admRmModel(idx) {
  var cfg = getConfig();
  var name = typeof cfg.models[idx] === 'object' ? cfg.models[idx].name : cfg.models[idx];
  if (!confirm('ลบ "' + name + '"?')) return;
  cfg.models.splice(idx, 1);
  saveConfig(cfg);
  toast('🗑️ ลบแล้ว');
  render();
}

function admMoveModel(idx, dir) {
  var cfg = getConfig();
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= cfg.models.length) return;
  var tmp = cfg.models[idx];
  cfg.models[idx] = cfg.models[newIdx];
  cfg.models[newIdx] = tmp;
  saveConfig(cfg);
  render();
}

function admImportModelsText() {
  var h = '<div style="max-width:450px">';
  h += '<div class="fm-group"><label>📝 วาง Model ทีละบรรทัด</label>';
  h += '<textarea id="admMImport" rows="10" class="fm-input" placeholder="DJI Matrice 400 (M400)\nDJI Zenmuse L3\nDJI Dock 2\n..."></textarea></div>';
  h += '<div style="font-size:.62rem;color:var(--text2);margin-bottom:8px">💡 แต่ละบรรทัด = 1 model (ราคาใส่ทีหลังได้)</div>';
  h += '<div class="fm-actions">';
  h += '<button class="btn btn-blue" onclick="admDoImportModels()">📥 Import</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('📝 Import Models', h);
}

function admDoImportModels() {
  var text = document.getElementById('admMImport');
  if (!text) return;
  var lines = text.value.trim().split('\n').filter(function(s) { return s.trim(); });
  if (!lines.length) { toast('ไม่มีข้อมูล'); return; }
  
  var cfg = getConfig();
  var added = 0;
  lines.forEach(function(line) {
    var name = line.trim();
    if (!name) return;
    var exists = false;
    for (var i = 0; i < cfg.models.length; i++) {
      var mName = typeof cfg.models[i] === 'object' ? cfg.models[i].name : cfg.models[i];
      if (mName === name) { exists = true; break; }
    }
    if (!exists) {
      cfg.models.push({name: name, price: 0});
      added++;
    }
  });
  
  saveConfig(cfg);
  closeMForce();
  toast('📥 Import ' + added + ' models (' + (lines.length - added) + ' ซ้ำ)');
  render();
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
// TEMPLATE FUNCTIONS
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
// IMPORT PIPELINE FROM JSON
// ================================================================
function showImportPipelineM() {
  openM('📥 Import Pipeline', 
    '<div class="fg"><label>วิธีที่ 1: วางข้อมูล JSON</label>' +
    '<textarea id="imp_pipe_json" rows="6" placeholder="วาง JSON ข้อมูล Pipeline ที่นี่..."></textarea></div>' +
    '<button class="btn bp btn-full" onclick="importPipelineJSON()">📥 Import จาก JSON</button>' +
    '<div style="margin:10px 0;text-align:center;color:#64748b;font-size:.72rem">— หรือ —</div>' +
    '<div class="fg"><label>วิธีที่ 2: เลือกไฟล์ .json</label>' +
    '<input type="file" id="imp_pipe_file" accept=".json" onchange="importPipelineFile(event)" style="font-size:.76rem"></div>' +
    '<div style="margin-top:10px;font-size:.68rem;color:#64748b">' +
    '💡 ระบบจะจับคู่ Dealer Name กับ Dealer ที่มีในระบบอัตโนมัติ<br>' +
    '⚠️ ถ้าหา Dealer ไม่เจอจะข้ามโครงการนั้น</div>'
  );
}

function importPipelineJSON() {
  var el = document.getElementById('imp_pipe_json');
  if (!el || !el.value.trim()) return alert('วาง JSON ข้อมูล');
  try {
    var data = JSON.parse(el.value.trim());
    var items = data.pipelines || data;
    if (!Array.isArray(items)) items = [items];
    var result = processPipelineImport(items);
    closeM();
    toast('📥 Import ' + result.success + '/' + result.total + ' โครงการ' + (result.skipped ? ' (ข้าม ' + result.skipped + ')' : ''));
    render();
  } catch (e) {
    alert('❌ JSON ไม่ถูกต้อง: ' + e.message);
  }
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
      closeM();
      toast('📥 Import ' + result.success + '/' + result.total + ' โครงการ' + (result.skipped ? ' (ข้าม ' + result.skipped + ')' : ''));
      render();
    } catch (err) {
      alert('❌ ไฟล์ไม่ถูกต้อง: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function processPipelineImport(items) {
  var dealers = ST.getAll('dealers');
  var success = 0;
  var skipped = 0;
  var total = items.length;
  
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var dealerId = '';
    var dealerName = item.dealerName || '';
    for (var j = 0; j < dealers.length; j++) {
      if (dealers[j].name && dealerName && 
          dealers[j].name.toLowerCase().indexOf(dealerName.toLowerCase()) !== -1) {
        dealerId = dealers[j].id;
        break;
      }
    }
    
    if (!dealerId && dealerName) {
      var searchName = dealerName.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (var j = 0; j < dealers.length; j++) {
        var dName = (dealers[j].name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (dName && searchName && (dName.indexOf(searchName) !== -1 || searchName.indexOf(dName) !== -1)) {
          dealerId = dealers[j].id;
          break;
        }
      }
    }
    
    if (!dealerId) {
      console.log('⚠️ Skip: Dealer not found - "' + dealerName + '" for project: ' + (item.projectName || '').substr(0, 40));
      skipped++;
      continue;
    }
    
    var existingPipes = ST.pipelineByDealer(dealerId);
    var isDuplicate = false;
    var regDate = (item.registerDate || '').trim();
    var fcAmt = parseFloat(item.forecastAmount) || 0;
    
    for (var k = 0; k < existingPipes.length; k++) {
      var ep = existingPipes[k];
      if (regDate && ep.registerDate === regDate && 
          (parseFloat(ep.forecastAmount) || 0) === fcAmt && fcAmt > 0) {
        isDuplicate = true;
        break;
      }
    }
    
    if (isDuplicate) {
      console.log('⚠️ Skip duplicate: ' + regDate + ' ' + fcAmt + ' - ' + (item.projectName || '').substr(0, 40));
      skipped++;
      continue;
    }
    
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
      recurring: !!item.recurring
    };
    
    if (item.lossReason) pipeData.lossReason = item.lossReason;
    if (item.lossCompetitor) pipeData.lossCompetitor = item.lossCompetitor;
    if (item.winReason) pipeData.winReason = item.winReason;
    
    var pipe = ST.add('pipeline', pipeData);
    
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
  
  return { total: total, success: success, skipped: skipped };
}

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
// LEVEL REQUIREMENTS FUNCTIONS (NEW)
// ================================================================

// ตัวแปรเก็บ current level ที่กำลังแก้ไข
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
  // Initialize with active tab
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
  
  var h = '<div class="form-section">🎯 เป้าหมาย H1 ' + new Date().getFullYear() + '</div>';
  h += '<div class="fr"><div class="fg"><label>เป้ายอดขาย H1 (บาท)</label><input type="number" id="req_h1_target" class="fm-input" value="' + (req.h1Target || 0) + '"></div></div>';
  
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
  
  // Option 1 Models
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
  
  // Option 2 Models
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
  
  cfg.levelRequirements[currentReqLevel].h1Target = parseFloat(document.getElementById('req_h1_target').value) || 0;
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

function saveNewDemoPolicy() {
  var productName = document.getElementById('ndp_product').value.trim();
  var releaseDate = dpG('ndp_release');
  var orderWithinDays = parseInt(document.getElementById('ndp_days').value) || 60;
  var alertMessage = document.getElementById('ndp_message').value.trim();
  var enabled = document.getElementById('ndp_enabled').value === 'true';
  
  if (!productName) { toast('กรุณาใส่ชื่อสินค้า'); return; }
  if (!releaseDate) { toast('กรุณาใส่วันที่วางจำหน่าย'); return; }
  if (!alertMessage) alertMessage = '⚠️ ต้องสั่งซื้อ Demo รุ่นใหม่ภายใน ' + orderWithinDays + ' วัน มิฉะนั้นอาจส่งผลต่อสถานะพาร์ทเนอร์';
  
  var cfg = getConfig();
  if (!cfg.newDemoPolicies) cfg.newDemoPolicies = [];
  
  cfg.newDemoPolicies.push({
    id: 'ndp_' + Date.now(),
    enabled: enabled,
    productName: productName,
    releaseDate: releaseDate,
    orderWithinDays: orderWithinDays,
    alertMessage: alertMessage
  });
  
  saveConfig(cfg);
  closeMForce();
  toast('✅ เพิ่มนโยบายสินค้าใหม่แล้ว');
  renderNewDemoPoliciesList();
  
  // ✅ เพิ่ม auto sync
  if (typeof forceSyncAll === 'function') {
    forceSyncAll();
  } else {
    toast('⚠️ กรุณากด Force Sync All เพื่อให้ข้อมูลอัปเดต', true);
  }
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
// ================================================================
// NEW DEMO POLICIES MANAGEMENT (เพิ่มต่อท้าย admin.js)
// ================================================================

function renderNewDemoPoliciesList() {
  var cfg = getConfig();
  var policies = cfg.newDemoPolicies || [];
  
  var container = document.getElementById('ndpListContainer');
  if (!container) return;
  
  if (!policies.length) {
    container.innerHTML = '<div class="empty"><p>ยังไม่มีนโยบาย Demo สินค้าใหม่</p></div>';
    return;
  }
  
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
  h += '<button class="btn btn-blue" onclick="saveNewDemoPolicy()">💾 บันทึก</button>';
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
  h += '<button class="btn btn-blue" onclick="updateNewDemoPolicy(' + idx + ')">💾 บันทึก</button>';
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
  cfg.newDemoPolicies[idx].enabled = document.getElementById('ndp_enabled').value === 'true';
  
  saveConfig(cfg);
  closeMForce();
  toast('💾 บันทึกแล้ว');
  renderNewDemoPoliciesList();
  
  // ✅ เพิ่ม auto sync
  if (typeof forceSyncAll === 'function') {
    forceSyncAll();
  }
}

function toggleNewDemoPolicy(idx) {
  var cfg = getConfig();
  if (!cfg.newDemoPolicies || !cfg.newDemoPolicies[idx]) return;
  cfg.newDemoPolicies[idx].enabled = !cfg.newDemoPolicies[idx].enabled;
  saveConfig(cfg);
  toast(cfg.newDemoPolicies[idx].enabled ? '✅ เปิดใช้งานแล้ว' : '⏸ ปิดใช้งานแล้ว');
  renderNewDemoPoliciesList();
  
  // ✅ เพิ่ม auto sync
  if (typeof forceSyncAll === 'function') {
    forceSyncAll();
  }
}
function deleteNewDemoPolicy(idx) {
  if (!confirm('ลบนโยบายนี้?')) return;
  var cfg = getConfig();
  cfg.newDemoPolicies.splice(idx, 1);
  saveConfig(cfg);
  toast('🗑️ ลบแล้ว');
  renderNewDemoPoliciesList();
  
  // ✅ เพิ่ม auto sync
  if (typeof forceSyncAll === 'function') {
    forceSyncAll();
  }
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
  
  // ✅ เพิ่ม auto sync
  if (typeof forceSyncAll === 'function') {
    forceSyncAll();
  }
}
// เรียกตอนโหลดหน้า admin
function initNewDemoPolicies() {
  renderNewDemoPoliciesList();
}