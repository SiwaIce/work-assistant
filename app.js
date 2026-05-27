// ===== GOOGLE SHEETS API CONFIG =====
var SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbzl71mCGeEJyvRq6xxyqvbcDSJzb49NCxZRj76DsLZNoX4FVcoNk9EEHLJ9dJ1ghpf6WA/exec';  // <--- เปลี่ยนเป็น URL จากขั้นตอนที่ 1.4
// ================================================================
// DEFAULT CONFIG
// ================================================================
var DEF_CONFIG = {
  saleName: 'Siwawong',
  
  kpi: {
    followupPerWeek: 4,
    visitPerWeek: 1
  },

  dealerLevels: ['S','A','B','Other'],
  dealerTiers: ['Platinum','Gold','Silver','Bronze','New'],
  djiDealerTypes: ['SAB','Other'],
  creditTerms: ['COD','30 วัน','45 วัน','60 วัน','อื่นๆ'],
  unitTypes: ['University','Government','Government Agency','State Enterprise','Private','Military','Local Administration','อื่นๆ'],

 models: [
    {name:'DJI Mavic 3 Enterprise (M3E)', price:0},
    {name:'DJI Mavic 3 Thermal (M3T)', price:0},
    {name:'DJI Mavic 3 Multispectral (M3M)', price:0},
    {name:'DJI Matrice 4E (M4E)', price:0},
    {name:'DJI Matrice 4T (M4T)', price:0},
    {name:'DJI Matrice 4TD (M4TD)', price:0},
    {name:'DJI Matrice 30 (M30)', price:0},
    {name:'DJI Matrice 30T (M30T)', price:0},
    {name:'DJI Matrice 350 RTK (M350)', price:0},
    {name:'DJI Matrice 400 (M400)', price:0},
    {name:'DJI Matrice 4 Series Battery', price:0},
    {name:'DJI Matrice 4D Series Battery', price:0},
    {name:'DJI Dock 2', price:0},
    {name:'DJI Dock 3', price:0},
    {name:'DJI FlyCart 30', price:0},
    {name:'DJI Zenmuse L2', price:0},
    {name:'DJI Zenmuse L3', price:0},
    {name:'DJI Zenmuse P1', price:0},
    {name:'DJI Zenmuse H30', price:0},
    {name:'DJI Zenmuse H30T', price:0},
    {name:'DJI Zenmuse V1', price:0},
    {name:'DJI Zenmuse S1', price:0},
    {name:'DJI RC Plus 2', price:0},
    {name:'DJI D-RTK 3', price:0},
    {name:'DJI BS100 (Base Station)', price:0},
    {name:'DJI TB100 (Battery Station)', price:0},
    {name:'DJI Terra - Standard', price:0},
    {name:'DJI Terra - Pro', price:0},
    {name:'DJI Terra - Edu', price:0},
    {name:'FlightHub 2 (FH2)', price:0},
    {name:'FlightHub 2 On Cloud', price:0},
    {name:'Mavic 3 Battery Kit', price:0},
    {name:'อื่นๆ', price:0}
  ],

  pipelineStatuses: [
    {id:'prospect', name:'🔍 Prospect', color:'#3b82f6'},
    {id:'tor_review', name:'📋 TOR Review', color:'#6366f1'},
    {id:'quotation', name:'💰 Quotation', color:'#f59e0b'},
    {id:'bidding', name:'⏳ Bidding', color:'#f97316'},
    {id:'negotiation', name:'📋 Negotiation', color:'#ec4899'},
    {id:'win', name:'✅ Win', color:'#22c55e'},
    {id:'ordered', name:'📦 Ordered', color:'#14b8a6'},
    {id:'delivered', name:'🚚 Delivered', color:'#06b6d4'},
    {id:'lost', name:'❌ Lost', color:'#ef4444'},
    {id:'on_hold', name:'⏸️ On Hold', color:'#94a3b8'},
    {id:'recurring', name:'🔄 Recurring', color:'#8b5cf6'}
  ],

  torOptions: ['Open','Lock','N/A'],
  appointmentOptions: ['ออกแล้ว','ยังไม่ออก','ไม่ต้องใช้'],
  winReasons: ['ราคาดีกว่า','Spec ตรง TOR','ได้หนังสือแต่งตั้ง','ความสัมพันธ์กับ End User','Service / Support ดี','อื่นๆ'],
  lossReasons: ['ราคาสูงกว่าคู่แข่ง','Spec ไม่ตรง TOR','ไม่มีหนังสือแต่งตั้ง','คู่แข่ง Lock Spec','ลูกค้าเปลี่ยนใจ','งบถูกตัด','อื่นๆ'],

  pipelineNextActions: [
    'รอ TOR ประกาศ','เตรียมเอกสาร Bidding','รอผลประมูล','รอ PO จากลูกค้า',
    'รอเซ็นสัญญา','รอสั่งสินค้า','รอส่งมอบ','รอลูกค้าส่งข้อมูล',
    'Follow-up ลูกค้า','เตรียม Demo','อื่นๆ'
  ],

  visitTopics: [
    {id:'sales_perf', name:'Sales Performance', prompt:'ยอดขายโดรน Enterprise ของบ. :', required:true, group:'sales'},
    {id:'downstream', name:'Downstream Partners', prompt:'ส่วนใหญ่ขายให้กับใคร แบ่งเป็นกี่ % :', required:true, group:'sales'},
    {id:'existing_opp', name:'Existing Sales Opportunity', prompt:'โอกาสการขายที่มีอยู่ : รุ่น จำนวน', required:true, group:'sales'},
    {id:'ordering_plan', name:'Ordering Plan', prompt:'Plan การสั่งสินค้าและปริมาณ :', required:true, group:'sales'},
    {id:'big_projects', name:'Upcoming Big Projects (≥1.5M)', prompt:'ใช้งานในด้านไหน :', required:true, group:'projects'},
    {id:'dock_projects', name:'Dock Projects', prompt:'มีโปรเจกต์ที่เกี่ยวกับ Dock ไหม :', required:true, group:'projects'},
    {id:'competitor', name:'Competitor Information', prompt:'ข้อมูลคู่แข่ง :', required:false, group:'projects'},
    {id:'anti_drone', name:'Anti-drone System', prompt:'มีหน่วยงานสนใจเรื่อง Anti drone ไหม :', required:false, group:'projects'},
    {id:'event_plan', name:'Event Plan', prompt:'ออกอีเวนท์ไหม ทำอะไร รายละเอียด :', required:false, group:'activities'},
    {id:'feedback', name:'Feedback to SIS & DJI', prompt:'อยากบอกอะไรกับ DJI มีอะไรที่ต้องการไหม :', required:true, group:'feedback'},
    {id:'dsec', name:'DSEC', prompt:'ทำ DSEC หรือยัง :', required:false, group:'cert'},
    {id:'crm', name:'CRM System', prompt:'ทำ CRM หรือยัง :', required:false, group:'cert'},
    {id:'fh2', name:'FlightHub 2 Exam', prompt:'ทำข้อสอบ FH2 หรือยัง :', required:false, group:'cert'},
    {id:'lark', name:'Lark', prompt:'ขอ ADD เพื่อนไว้ :', required:false, group:'cert'}
  ],

  visitTopicGroups: [
    {id:'sales', name:'📊 Sales & Business', alwaysAsk:true},
    {id:'projects', name:'📁 Projects', alwaysAsk:true},
    {id:'activities', name:'📋 Activities', alwaysAsk:false},
    {id:'feedback', name:'💬 Feedback', alwaysAsk:true},
    {id:'cert', name:'📋 Certification', alwaysAsk:false}
  ],

  lineLogTypes: [
    {id:'price', name:'ถามราคา', cls:'line-type-price'},
    {id:'stock', name:'สอบถามสต็อก', cls:'line-type-stock'},
    {id:'problem', name:'ปัญหา/แก้ไข', cls:'line-type-problem'},
    {id:'info', name:'ข้อมูลทั่วไป', cls:'line-type-info'}
  ],

  emailRecipients: {
    visitPlan: ['SalesDrone@sisthai.com','DJI@sisthai.com','xuguang.gong@dji.com'],
    onlinePlan: ['SalesDrone@sisthai.com','DJI@sisthai.com','xuguang.gong@dji.com']
  },

  emailTypes: [
    {id:'visit_plan', name:'Visit Plan (Offline Actual)'},
    {id:'online_plan', name:'Online Actual Plan'},
    {id:'eol', name:'EOL Notice'},
    {id:'event', name:'Event / ลงทะเบียน'},
    {id:'pricelist', name:'Pricelist'},
    {id:'demo_report', name:'Demo Unit Report'},
    {id:'target_report', name:'เป้ายอดขาย'},
    {id:'dsec_update', name:'DSEC Certification'},
    {id:'demo_policy', name:'New Demo Policy'},
    {id:'dealer_policy', name:'Dealer Policy / EOL'},
    {id:'other', name:'อื่นๆ'}
  ],

  externalLinks: [],

  noteCategories: ['📋 Policy','📦 Product','📝 SOP','📅 Meeting Notes','📌 อื่นๆ'],
onboardingSteps: [
    {id: 'interested', title: 'สนใจเข้าร่วม', group: 'onboard'},
    {id: 'request_docs', title: 'ขอเอกสาร', group: 'onboard'},
    {id: 'submit_docs', title: 'Submit เอกสารแล้ว', group: 'onboard'},
    {id: 'dji_review', title: 'รอพิจารณาจาก DJI', group: 'onboard'},
    {id: 'approved', title: 'ผ่านการพิจารณา', group: 'onboard'},
    {id: 'authorized', title: 'เป็น Authorized Dealer', group: 'onboard'},
    {id: 'policy_training', title: 'นัดอบรม Policy', group: 'after'},
    {id: 'demo_unit', title: 'จัดส่ง Demo Unit', group: 'after'},
    {id: 'end_user_demo', title: 'Dealer นัด End User ทำ Demo', group: 'after'},
    {id: 'dsec', title: 'DSEC Certification', group: 'after'},
    {id: 'crm', title: 'CRM Registration', group: 'after'},
    {id: 'fh2', title: 'FlightHub 2 Exam', group: 'after'},
    {id: 'lark', title: 'Lark Add Friend', group: 'after'}
  ],

  monthlyChecklist: [
    'ส่ง Demo Unit Report',
    'แจ้งเป้ายอดขาย (H1: Jan–Jun 2026)',
    'DSEC Certification Update',
    'New Demo Policy (ถ้ามี)',
    'Dealer Policy Update / EOL (ถ้ามี)'
  ],

  healthWeights: {
    contact: 30,
    pipelineUpdate: 20,
    achievement: 20,
    certification: 15,
    forecast: 15
  }
};

function getConfig() {
  var saved = ST.getObj('config');
  var cfg = JSON.parse(JSON.stringify(DEF_CONFIG));
  if (saved) {
    var keys = Object.keys(saved);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'kpi') {
        cfg.kpi = {followupPerWeek: (saved.kpi && saved.kpi.followupPerWeek) || cfg.kpi.followupPerWeek, visitPerWeek: (saved.kpi && saved.kpi.visitPerWeek) || cfg.kpi.visitPerWeek};
      } else if (k === 'emailRecipients') {
        cfg.emailRecipients = {visitPlan: (saved.emailRecipients && saved.emailRecipients.visitPlan) || cfg.emailRecipients.visitPlan, onlinePlan: (saved.emailRecipients && saved.emailRecipients.onlinePlan) || cfg.emailRecipients.onlinePlan};
      } else if (k === 'healthWeights') {
        var hw = saved.healthWeights || {};
        cfg.healthWeights = {contact: hw.contact || cfg.healthWeights.contact, pipelineUpdate: hw.pipelineUpdate || cfg.healthWeights.pipelineUpdate, achievement: hw.achievement || cfg.healthWeights.achievement, certification: hw.certification || cfg.healthWeights.certification, forecast: hw.forecast || cfg.healthWeights.forecast};
      } else if (saved[k] !== undefined) {
        cfg[k] = saved[k];
      }
    }
  }
  
  // Migration: models String → Object
  if (cfg.models && cfg.models.length > 0 && typeof cfg.models[0] === 'string') {
    cfg.models = cfg.models.map(function(m) {
      return {name: m, price: 0};
    });
    // Auto-save migrated config
    saveConfig(cfg);
  }
  
  return cfg;
}

function saveConfig(cfg) { ST.setObj('config', cfg); refreshPipeNames(); }

var PIPE_NAMES = {};
function refreshPipeNames() {
  var cfg = getConfig();
  for (var i = 0; i < cfg.pipelineStatuses.length; i++) {
    PIPE_NAMES[cfg.pipelineStatuses[i].id] = cfg.pipelineStatuses[i].name;
  }
}
refreshPipeNames();

function getPipeName(statusId) { return PIPE_NAMES[statusId] || statusId; }

// ================================================================
// DEFAULT ROUTINES
// ================================================================
var DEF_ROUTINES = [
  {title:'เช็ค LINE Group ลูกค้า', time:'09:00', days:'daily', category:'เช้า'},
  {title:'เช็ค Dashboard / งานค้าง', time:'09:15', days:'daily', category:'เช้า'},
  {title:'เช็ค Stock / ตอบราคาลูกค้า', time:'09:30', days:'daily', category:'เช้า'},
  {title:'Update Project Pipeline', time:'10:00', days:'mon-wed', category:'จ.-พ.'},
  {title:'Update Forecast QTY', time:'10:30', days:'mon-wed', category:'จ.-พ.'},
  {title:'Follow-up ลูกค้า Online', time:'11:00', days:'daily', category:'ติดตาม'},
  {title:'สรุปงานวันนี้', time:'16:00', days:'daily', category:'เย็น'},
  {title:'วางแผนงานพรุ่งนี้', time:'16:30', days:'daily', category:'เย็น'},
  {title:'เตรียมข้อมูล Project ≥ 1M', time:'09:00', days:'thu', category:'พฤ.'},
  {title:'เตรียม Forecast QTY', time:'09:30', days:'thu', category:'พฤ.'},
  {title:'📅 ประชุม Team Sales Drone', time:'10:00', days:'thu', category:'พฤ.'},
  {title:'สรุป Action Items', time:'14:00', days:'thu', category:'พฤ.'},
  {title:'วางแผน Visit สัปดาห์หน้า', time:'09:00', days:'fri', category:'ศ.'},
  {title:'ส่ง Visit Plan Email', time:'10:00', days:'fri', category:'ศ.'},
  {title:'ส่ง Online Plan Email', time:'10:30', days:'fri', category:'ศ.'},
  {title:'สรุปสัปดาห์', time:'15:00', days:'fri', category:'ศ.'}
];

function initRoutines() {
  var rts = ST.getAll('routines');
  if (!rts.length) {
    for (var i = 0; i < DEF_ROUTINES.length; i++) {
      var r = {};
      for (var k in DEF_ROUTINES[i]) r[k] = DEF_ROUTINES[i][k];
      ST.add('routines', r);
    }
  }
}

// ================================================================
// NAVIGATION
// ================================================================
var S = {view: 'today'};
var calY = new Date().getFullYear();
var calM = new Date().getMonth();
var taskFlt = 'all';
var mtFlt = 'all';
var kbFilter = 'all';
var pipeFlt = 'all';
var visitFlt = 'all';

function go(v, p) {
  if (!p) p = {};
  S = {view: v};
  var keys = Object.keys(p);
  for (var i = 0; i < keys.length; i++) S[keys[i]] = p[keys[i]];
  render();
  var navs = document.querySelectorAll('[data-v]');
  for (var i = 0; i < navs.length; i++) {
    if (navs[i].dataset.v === v) navs[i].classList.add('act');
    else navs[i].classList.remove('act');
  }
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('show');
  window.scrollTo(0, 0);
}

// ================================================================
// CUSTOMER UPDATES MANAGEMENT
// ================================================================

var customerUpdates = {
    pipeline: [],
    forecast: []
};

// โหลดข้อมูลที่ลูกค้าอัพเดท
function loadCustomerUpdates() {
    if (!CURRENT_USER) return;
    
    var dealerId = S.dealerId;
    if (!dealerId) return;
    
    // โหลด Pipeline Updates
    db.collection('dealerUpdates').doc(dealerId).collection('pipeline').where('_status', '==', 'pending').get().then(function(snapshot) {
        customerUpdates.pipeline = [];
        snapshot.forEach(function(doc) {
            var data = doc.data();
            data.id = doc.id;
            customerUpdates.pipeline.push(data);
        });
        renderCustomerUpdatesPanel();
    }).catch(function(err) { console.warn(err); });
    
    // โหลด Forecast Updates
    db.collection('dealerUpdates').doc(dealerId).collection('forecast').where('_status', '==', 'pending').get().then(function(snapshot) {
        customerUpdates.forecast = [];
        snapshot.forEach(function(doc) {
            var data = doc.data();
            data.id = doc.id;
            customerUpdates.forecast.push(data);
        });
        renderCustomerUpdatesPanel();
    }).catch(function(err) { console.warn(err); });
}

// แสดง Panel ใน Dealer Detail
function renderCustomerUpdatesPanel() {
    var panel = document.getElementById('customerUpdatesPanel');
    if (!panel) return;
    
    var total = customerUpdates.pipeline.length + customerUpdates.forecast.length;
    if (total === 0) {
        panel.innerHTML = '<div class="card"><h2>📥 คำขออัพเดทจากลูกค้า</h2><div class="empty"><p>✅ ไม่มีคำขออัพเดท</p></div></div>';
        return;
    }
    
    var html = '<div class="card"><h2>📥 คำขออัพเดทจากลูกค้า <span class="tag tag-active">' + total + ' รายการ</span></h2>';
    
    // Pipeline Updates
    if (customerUpdates.pipeline.length) {
        html += '<h3 style="font-size:13px;margin:8px 0 4px">📋 โครงการที่รอตรวจสอบ (' + customerUpdates.pipeline.length + ')</h3>';
        for (var i = 0; i < customerUpdates.pipeline.length; i++) {
            var p = customerUpdates.pipeline[i];
            html += '<div class="li" style="border-left:3px solid #f59e0b">';
            html += '<div class="lm">';
            html += '<div class="lt">📋 ' + esc(p.projectName) + '</div>';
            html += '<div class="ls">👤 ' + esc(p.endUserTH || '-') + '</div>';
            html += '<div class="ls">📊 สถานะ: ' + getPipeName(p.status) + '</div>';
            html += '<div class="ls">📦 ' + (p.items || []).map(function(it) { return it.model + ' x' + it.qty; }).join(', ') + '</div>';
            if (p.updateNote) html += '<div class="ls" style="color:#f59e0b">💬 ' + esc(p.updateNote) + '</div>';
            html += '</div>';
            html += '<button class="btn bsm bp" onclick="approvePipelineUpdate(\'' + p.id + '\', \'' + dealerId + '\')">✅ อนุมัติและนำเข้า</button>';
            html += '<button class="btn bsm bd" onclick="rejectCustomerUpdate(\'pipeline\', \'' + p.id + '\', \'' + dealerId + '\')">❌ ปฏิเสธ</button>';
            html += '</div>';
        }
    }
    
    // Forecast Updates
    if (customerUpdates.forecast.length) {
        html += '<h3 style="font-size:13px;margin:12px 0 4px">📦 แผนการสั่งซื้อที่รอตรวจสอบ (' + customerUpdates.forecast.length + ')</h3>';
        for (var i = 0; i < customerUpdates.forecast.length; i++) {
            var f = customerUpdates.forecast[i];
            var typeName = f.type === 'runrate' ? '🏪 Run Rate' : '📋 โครงการ';
            html += '<div class="li" style="border-left:3px solid #f59e0b">';
            html += '<div class="lm">';
            html += '<div class="lt">' + typeName + '</div>';
            if (f.type === 'project') {
                html += '<div class="ls">📋 ' + esc(f.projectName) + '</div>';
                html += '<div class="ls">📦 ' + (f.items || []).map(function(it) { return it.model + ' x' + it.qty; }).join(', ') + '</div>';
            } else {
                html += '<div class="ls">📦 ' + esc(f.model) + ' x' + f.qty + '</div>';
            }
            html += '<div class="ls">📅 เดือน: ' + esc(f.month) + '</div>';
            html += '</div>';
            html += '<button class="btn bsm bp" onclick="approveForecastUpdate(\'' + f.id + '\', \'' + dealerId + '\', \'' + f.type + '\')">✅ อนุมัติและนำเข้า</button>';
            html += '<button class="btn bsm bd" onclick="rejectCustomerUpdate(\'forecast\', \'' + f.id + '\', \'' + dealerId + '\')">❌ ปฏิเสธ</button>';
            html += '</div>';
        }
    }
    
    html += '</div>';
    panel.innerHTML = html;
}

// อนุมัติ Pipeline Update
function approvePipelineUpdate(updateId, dealerId) {
    if (!confirm('ยืนยันนำเข้าข้อมูลนี้?')) return;
    
    var updateRef = db.collection('dealerUpdates').doc(dealerId).collection('pipeline').doc(updateId);
    updateRef.get().then(function(doc) {
        if (!doc.exists) return;
        var data = doc.data();
        
        // ลบ metadata
        delete data._customerUpdate;
        delete data._updatedAt;
        delete data._status;
        delete data._originalDealerId;
        delete data._originalPipeId;
        delete data._updateType;
        delete data.updateNote;
        delete data.updatedBy;
        delete data.updatedAt;
        
        // ตรวจสอบว่า id ซ้ำหรือไม่
        var existing = ST.getOne('pipeline', updateId);
        if (existing) {
            ST.update('pipeline', updateId, data);
        } else {
            ST.add('pipeline', data);
        }
        
        updateRef.update({ _status: 'approved', _approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
        
        toast('✅ นำเข้าข้อมูลเรียบร้อยแล้ว');
        
        // 🔥 แก้ไข: reload หน้าเดิม ไม่ใช่กลับไป today
        loadCustomerUpdates();  // รีเฟรช panel
        render();  // render ใหม่
        
        // ถ้าอยู่ในหน้า customerUpdates ให้กลับไปหน้า dealerDetail
        if (S.view === 'customerUpdates') {
            go('dealerDetail', { dealerId: dealerId });
        }
    }).catch(function(err) { toast('เกิดข้อผิดพลาด: ' + err.message); });
}

// อนุมัติ Forecast Update
function approveForecastUpdate(updateId, dealerId, type) {
    if (!confirm('ยืนยันนำเข้าข้อมูลนี้?')) return;
    
    var updateRef = db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(updateId);
    updateRef.get().then(function(doc) {
        if (!doc.exists) return;
        var data = doc.data();
        
        delete data._customerUpdate;
        delete data._updatedAt;
        delete data._status;
        delete data._originalDealerId;
        
        var forecastKey = 'v7_forecast';
        var forecasts = JSON.parse(localStorage.getItem(forecastKey) || '[]');
        var existingIndex = forecasts.findIndex(function(f) { return f.id === updateId; });
        
        if (existingIndex !== -1) {
            forecasts[existingIndex] = data;
        } else {
            forecasts.push(data);
        }
        localStorage.setItem(forecastKey, JSON.stringify(forecasts));
        
        updateRef.update({ _status: 'approved', _approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
        
        toast('✅ นำเข้าข้อมูลเรียบร้อยแล้ว');
        
        // 🔥 แก้ไข: reload หน้าเดิม
        loadCustomerUpdates();
        render();
        
        if (S.view === 'customerUpdates') {
            go('dealerDetail', { dealerId: dealerId });
        }
    }).catch(function(err) { toast('เกิดข้อผิดพลาด: ' + err.message); });
}

// ปฏิเสธการอัพเดท
function rejectCustomerUpdate(type, updateId, dealerId) {
    if (!confirm('ปฏิเสธคำขอนี้?')) return;
    
    var ref = db.collection('dealerUpdates').doc(dealerId).collection(type === 'pipeline' ? 'pipeline' : 'forecast').doc(updateId);
    ref.update({ _status: 'rejected', _rejectedAt: firebase.firestore.FieldValue.serverTimestamp() });
    
    toast('🗑️ ปฏิเสธคำขอแล้ว');
    
    // 🔥 แก้ไข: reload หน้าเดิม
    loadCustomerUpdates();
    render();
    
    if (S.view === 'customerUpdates') {
        go('dealerDetail', { dealerId: dealerId });
    }
}
// หน้าแยกสำหรับดูคำขออัพเดททั้งหมด
function rCustomerUpdates(el) {
    document.getElementById('pgT').textContent = '📥 คำขออัพเดทจากลูกค้า';
    
    if (!CURRENT_USER) {
        el.innerHTML = '<div class="card"><div class="empty"><p>🔐 กรุณา Login เพื่อดูข้อมูล</p></div></div>';
        return;
    }
    
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>กำลังโหลด...</div></div>';
    
    db.collection('dealerUpdates').get().then(function(dealerSnapshot) {
        var allUpdates = [];
        var promises = [];
        
        dealerSnapshot.forEach(function(dealerDoc) {
            var dealerId = dealerDoc.id;
            var dealer = ST.getOne('dealers', dealerId);
            
            var p = dealerDoc.ref.collection('pipeline').where('_status', '==', 'pending').get().then(function(snapshot) {
                snapshot.forEach(function(doc) {
                    var data = doc.data();
                    data.id = doc.id;
                    data.dealerId = dealerId;
                    data.dealerName = dealer ? dealer.name : dealerId;
                    data.type = 'pipeline';
                    allUpdates.push(data);
                });
            });
            promises.push(p);
            
            var f = dealerDoc.ref.collection('forecast').where('_status', '==', 'pending').get().then(function(snapshot) {
                snapshot.forEach(function(doc) {
                    var data = doc.data();
                    data.id = doc.id;
                    data.dealerId = dealerId;
                    data.dealerName = dealer ? dealer.name : dealerId;
                    data.type = data.type === 'runrate' ? 'runrate' : 'project';
                    allUpdates.push(data);
                });
            });
            promises.push(f);
        });
        
        Promise.all(promises).then(function() {
            if (allUpdates.length === 0) {
                el.innerHTML = '<div class="card"><div class="empty"><div class="icon">📭</div><p>ไม่มีคำขออัพเดทจากลูกค้า</p></div></div>';
                return;
            }
            
            var html = '<div class="card"><h2>📥 คำขออัพเดทจากลูกค้า (' + allUpdates.length + ')</h2>';
            
            allUpdates.sort(function(a, b) { return (b._updatedAt || '').localeCompare(a._updatedAt || ''); });
            
            for (var i = 0; i < allUpdates.length; i++) {
                var u = allUpdates[i];
                html += '<div class="li" style="border-left:3px solid #f59e0b">';
                html += '<div class="lm">';
                html += '<div class="lt">🏪 ' + esc(u.dealerName) + ' - ' + (u.type === 'pipeline' ? '📋 โครงการ' : '📦 แผนการสั่งซื้อ') + '</div>';
                if (u.type === 'pipeline') {
                    html += '<div class="ls">📋 ' + esc(u.projectName) + '</div>';
                    html += '<div class="ls">📊 ' + getPipeName(u.status) + '</div>';
                } else if (u.type === 'project') {
                    html += '<div class="ls">📋 ' + esc(u.projectName) + '</div>';
                    html += '<div class="ls">📦 ' + (u.items || []).map(function(it) { return it.model + ' x' + it.qty; }).join(', ') + '</div>';
                } else {
                    html += '<div class="ls">📦 ' + esc(u.model) + ' x' + u.qty + '</div>';
                }
                html += '<div class="ls">📅 ' + esc(u.month || '-') + '</div>';
                html += '</div>';
                html += '<button class="btn bsm bp" onclick="approveUpdateFromList(\'' + u.type + '\', \'' + u.id + '\', \'' + u.dealerId + '\')">✅ อนุมัติ</button>';
                html += '<button class="btn bsm bd" onclick="rejectUpdateFromList(\'' + u.type + '\', \'' + u.id + '\', \'' + u.dealerId + '\')">❌ ปฏิเสธ</button>';
                html += '</div>';
            }
            
            html += '</div>';
            el.innerHTML = html;
        });
    });
}

function approveUpdateFromList(type, updateId, dealerId) {
    if (type === 'pipeline') {
        approvePipelineUpdate(updateId, dealerId);
    } else {
        approveForecastUpdate(updateId, dealerId, type);
    }
    setTimeout(function() { if (typeof render === 'function') render(); }, 1000);
}

function rejectUpdateFromList(type, updateId, dealerId) {
    rejectCustomerUpdate(type === 'pipeline' ? 'pipeline' : 'forecast', updateId, dealerId);
    setTimeout(function() { if (typeof render === 'function') render(); }, 1000);
}

function render() {
  var el = document.getElementById('ct');
  var R = {
    customKpi: rCustomKPI,
    today: rToday, kpi: rKPI,
    report: rWeeklyReport, dashboard: rDashboard, health: rDataHealth,
    dealers: rDealers, dealerDetail: rDealerDet,pipeDash: rPipeDashboard,
    contactLogs: rContactLogs, customerUpdates: rCustomerUpdates,
    pipeline: rPipeline, pipeBoard: rPipeBoard, pipeDetail: rPipeDet,
    forecastComparison: rForecastComparison, forecast: rForecast,
    visits: rVisits, visitDetail: rVisitDet,
    followup: rFollowup, feedback: rFeedback,
    kanban: rKanban, meetings: rMeetings, meetingDetail: rMeetDet,
    calendar: rCalendar,
    monthlyGoal: rMonthlyGoal, demoTracker: rDemoTracker, quotations: rQuotations,
        visitPlan: rVisitPlan, emailDrafts: rEmailDrafts,
    exports: rExports,
    reminders: rRemind, insights: rInsights,
    admin: rAdmin,
    tasks: rUnifiedTasks, taskDetail: rTaskDet,
    smartFilter: rSmartFilter,
    knowledge: rKnowledge, noteDetail: rNoteDet
  };

// เพิ่ม function redirect สำหรับ Kanban (ให้เมนู Kanban ไปที่ Tasks Tab Kanban)
function goKanban() {
  tasksView = 'kanban';
  go('tasks');
}

 var fn = R[S.view];
if (fn) {
  fn(el);
} else if (typeof rToday === 'function') {
  rToday(el);
} else {
  el.innerHTML = '<h2>Loading...</h2>';
}
  updBdg();
    if (typeof renderFavorites === 'function') renderFavorites();
  checkBackupReminder();
}

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('show');
}

// ================================================================
// MODAL (with safety check)
// ================================================================
function openM(title, html) {
  document.getElementById('mTi').textContent = title;
  document.getElementById('mBd').innerHTML = html;
  document.getElementById('modal').classList.add('show');
}

function closeM() {
  var hasData = false;
  var inputs = document.querySelectorAll('#mBd input[type=text], #mBd input[type=number], #mBd textarea');
  for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].value && inputs[i].value.trim()) { hasData = true; break; }
  }
  if (hasData) {
    if (confirm('⚠️ ยังกรอกข้อมูลอยู่ — ปิดจริงๆ?')) {
      document.getElementById('modal').classList.remove('show');
    }
  } else {
    document.getElementById('modal').classList.remove('show');
  }
}

function closeMForce() {
  document.getElementById('modal').classList.remove('show');
}

document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeM();
});

// ================================================================
// FAB
// ================================================================
var fabO = false;
function toggleFab() {
  fabO = !fabO;
  var menu = document.getElementById('fabMenu');
  var btn = document.getElementById('fabBtn');
  if (menu) menu.classList.toggle('show', fabO);
  if (btn) btn.textContent = fabO ? '✕' : '＋';
}

function fabAct(type) {
  toggleFab();
  var dealerId = S.dealerId || '';
  if (type === 'visit') showVisitM(dealerId);
  else if (type === 'contact') showUnifiedContactForm();
  else if (type === 'followup') showFollowupM(dealerId);
  else if (type === 'pipeline') showPipelineM(dealerId);
  else if (type === 'line') showLineLogM(dealerId);
  else if (type === 'task') showTaskM();
  else if (type === 'meeting') showMeetingM();
  else if (type === 'note') showQNote();
}

function showQNote() {
  var dealerId = S.dealerId || '';
  var dealers = ST.getAll('dealers');
  var dlrSelect = dealers.length ? '<div class="fg"><label>Dealer (ไม่บังคับ)</label><select id="qn_d">' + dealerOptions(dealerId) + '</select></div>' : '';
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
}// ================================================================
// SEARCH
// ================================================================
function openSearch() {
  document.getElementById('searchOv').classList.add('show');
  document.getElementById('searchInp').value = '';
  document.getElementById('searchRes').innerHTML = '<div class="empty"><p>พิมพ์เพื่อค้นหา...</p></div>';
  setTimeout(function() { document.getElementById('searchInp').focus(); }, 100);
}

function closeSearch() { document.getElementById('searchOv').classList.remove('show'); }

document.getElementById('searchOv').addEventListener('click', function(e) { if (e.target === this) closeSearch(); });

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeSearch(); closeDraft(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
});

function doSearch() {
  var q = document.getElementById('searchInp').value.toLowerCase().trim();
  var r = document.getElementById('searchRes');
  if (!q) { r.innerHTML = '<div class="empty"><p>พิมพ์เพื่อค้นหา...</p></div>'; return; }
  var items = [];

  ST.getAll('dealers').forEach(function(d) {
    if ((d.name||'').toLowerCase().indexOf(q) !== -1 || (d.contact||'').toLowerCase().indexOf(q) !== -1 || (d.sisCode||'').toLowerCase().indexOf(q) !== -1)
      items.push({type:'🏪 Dealer', title:d.name, sub:(d.level||'')+' '+(d.contact||''), act:"go('dealerDetail',{dealerId:'"+d.id+"'})"});
  });
  ST.getAll('pipeline').forEach(function(p) {
    if ((p.projectName||'').toLowerCase().indexOf(q) !== -1 || (p.endUserTH||'').toLowerCase().indexOf(q) !== -1 || (p.model||'').toLowerCase().indexOf(q) !== -1) {
      var d = ST.getOne('dealers', p.dealerId);
      items.push({type:'📊 Pipeline', title:p.projectName, sub:(d?d.name:'')+' • '+fmtMoneyShort(p.forecastAmount), act:"go('pipeDetail',{pipeId:'"+p.id+"'})"});
    }
  });
  ST.getAll('visits').forEach(function(v) {
    if ((v.summary||'').toLowerCase().indexOf(q) !== -1) {
      var d = ST.getOne('dealers', v.dealerId);
      items.push({type:'🤝 Visit', title:(d?d.name:'?')+' — '+fD(v.date), sub:(v.summary||'').substr(0,50), act:"go('visitDetail',{visitId:'"+v.id+"'})"});
    }
  });
  ST.getAll('notes').forEach(function(n) {
    if ((n.title||'').toLowerCase().indexOf(q) !== -1 || (n.content||'').toLowerCase().indexOf(q) !== -1 || (n.tags||'').toLowerCase().indexOf(q) !== -1)
      items.push({type:'📚 Note', title:n.title, sub:n.category||'', act:"go('noteDetail',{noteId:'"+n.id+"'})"});
  });
  ST.getAll('tasks').forEach(function(t) {
    if ((t.title||'').toLowerCase().indexOf(q) !== -1)
      items.push({type:'📋 งาน', title:t.title, sub:'', act:"go('taskDetail',{taskId:'"+t.id+"'})"});
  });
  ST.getAll('meetings').forEach(function(m) {
    if ((m.title||'').toLowerCase().indexOf(q) !== -1)
      items.push({type:'📅 ประชุม', title:m.title, sub:fD(m.date), act:"go('meetingDetail',{meetingId:'"+m.id+"'})"});
  });

  items = items.slice(0, 20);
  r.innerHTML = items.length
    ? items.map(function(i) { return '<div class="search-item" onclick="closeSearch();'+i.act+'"><div class="si-type">'+i.type+'</div><div class="si-title">'+sanitize(i.title||'')+'</div><div class="si-sub">'+sanitize(i.sub||'')+'</div></div>'; }).join('')
    : '<div class="empty"><p>ไม่พบผลลัพธ์</p></div>';
}

// ================================================================
// WORK TIMER
// ================================================================
var _timerInterval = null, _timerStart = null, _timerRef = null;

function startTimer(refType, refId, label) {
  if (_timerInterval) stopTimer();
  _timerStart = Date.now();
  _timerRef = {type: refType, id: refId, label: label};
  document.getElementById('timerBar').style.display = 'flex';
  document.getElementById('timerInfo').textContent = '⏱️ ' + label;
  _timerInterval = setInterval(function() {
    document.getElementById('timerTime').textContent = fmtTimer(Math.floor((Date.now() - _timerStart) / 1000));
  }, 1000);
  ST.setObj('timerState', {refType: refType, refId: refId, label: label, start: _timerStart});
  toast('⏱️ เริ่มจับเวลา');
}

function stopTimer() {
  if (!_timerStart || !_timerRef) return;
  var mins = Math.round((Date.now() - _timerStart) / 60000);
  if (mins >= 1) {
    ST.add('timerLogs', {refType: _timerRef.type, refId: _timerRef.id, label: _timerRef.label, date: _td(), minutes: mins, startTime: new Date(_timerStart).toISOString(), endTime: _nw()});
    toast('⏱️ บันทึก ' + fmtDuration(mins));
  }
  clearInterval(_timerInterval); _timerInterval = null; _timerStart = null; _timerRef = null;
  document.getElementById('timerBar').style.display = 'none';
  localStorage.removeItem(ST._keys.timerState);
}

function restoreTimer() {
  var s = ST.getObj('timerState');
  if (s && s.start) {
    _timerStart = s.start;
    _timerRef = {type: s.refType, id: s.refId, label: s.label};
    document.getElementById('timerBar').style.display = 'flex';
    document.getElementById('timerInfo').textContent = '⏱️ ' + s.label;
    _timerInterval = setInterval(function() {
      document.getElementById('timerTime').textContent = fmtTimer(Math.floor((Date.now() - _timerStart) / 1000));
    }, 1000);
  }
}

// ================================================================
// BADGE COUNT
// ================================================================
function updBdg() {
  var urg = getUrgentItems().length;
  var bid = ST.filter('pipeline', function(p) { return p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 1 && ['lost','delivered'].indexOf(p.status) === -1; }).length;
  var wait = ST.filter('waiting', function(w) { return !w.resolved && w.dueDate && dTo(w.dueDate) < 0; }).length;
  var meet = ST.filter('meetings', function(m) { return dTo(m.date) >= 0 && dTo(m.date) <= 1; }).length;
  var action = ST.filter('pipeline', function(p) { return p.followupDate && dTo(p.followupDate) <= 0 && ['lost','delivered'].indexOf(p.status) === -1; }).length;
  var ct = urg + bid + wait + meet + action;
  ['nBdg','nBdgM'].forEach(function(id) {
    var e = document.getElementById(id);
    if (e) { e.style.display = ct ? 'inline' : 'none'; e.textContent = ct; }
  });
}

// ================================================================
// BACKUP REMINDER
// ================================================================
function checkBackupReminder() {
  var days = ST.getDaysSinceBackup();
  var bar = document.getElementById('backupBar');
  if (!bar) return;
  if (days >= 7) {
    bar.style.display = 'flex';
    var el = document.getElementById('backupDays');
    if (el) el.textContent = days;
  } else { bar.style.display = 'none'; }
}

function goExport() { document.getElementById('backupBar').style.display = 'none'; go('exports'); }
function dismissBackup() { document.getElementById('backupBar').style.display = 'none'; }

// ================================================================
// EMAIL DRAFT
// ================================================================
var _draftData = null;
function showDraft(title, meta, body, recipients) {
  _draftData = {title: title, meta: meta, body: body, recipients: recipients};
  document.getElementById('draftTi').textContent = title;
  document.getElementById('draftMeta').innerHTML = meta;
  document.getElementById('draftBody').textContent = body;
  document.getElementById('draftOv').style.display = 'flex';
}
function closeDraft() { document.getElementById('draftOv').style.display = 'none'; _draftData = null; }
function copyDraft() { if (_draftData) copyText(_draftData.body, '📋 Copy Report แล้ว!'); }
function openMailto() {
  if (!_draftData) return;
  var to = (_draftData.recipients || []).join(',');
  window.open('mailto:' + to + '?subject=' + encodeURIComponent(_draftData.title || '') + '&body=' + encodeURIComponent(_draftData.body || ''));
}

// ================================================================
// KPI CALCULATIONS
// ================================================================
function getKPIData(weekRange) {
  var cfg = getConfig();
  var w = weekRange || getWeekRange();
  var contactedDealers = {};

  ST.filter('followups', function(f) { return isInRange(f.date, w.start, w.end); }).forEach(function(f) { contactedDealers[f.dealerId] = true; });
  ST.filter('visits', function(v) { return isInRange(v.date, w.start, w.end) && v.mode === 'online'; }).forEach(function(v) { contactedDealers[v.dealerId] = true; });
  ST.filter('lineLog', function(l) { return isInRange(l.date, w.start, w.end); }).forEach(function(l) { contactedDealers[l.dealerId] = true; });

  var visitsOffline = ST.filter('visits', function(v) { return isInRange(v.date, w.start, w.end) && v.mode === 'offline'; });
  var pipeLogs = ST.filter('pipeLog', function(l) { return l.date && isInRange(l.date.split('T')[0], w.start, w.end); });
  var fcLogs = pipeLogs.filter(function(l) { return l.type === 'forecast'; });
  var vpSent = ST.filter('emails', function(e) { return e.type === 'visit_plan' && e.sent && e.sentDate && isInRange(e.sentDate.split('T')[0], w.start, w.end); }).length > 0;

  return {
    followup: {current: Object.keys(contactedDealers).length, target: cfg.kpi.followupPerWeek, dealers: Object.keys(contactedDealers), details: ST.filter('followups', function(f) { return isInRange(f.date, w.start, w.end); })},
    visit: {current: visitsOffline.length, target: cfg.kpi.visitPerWeek, details: visitsOffline},
    pipeUpdated: pipeLogs.length > 0, fcUpdated: fcLogs.length > 0, vpSent: vpSent, weekRange: w
  };
}

function getDealerContactStatus() {
  return ST.getAll('dealers').map(function(d) {
    var lcd = ST.getLastContactDays(d.id);
    return {id:d.id, name:d.name, level:d.level, contact:d.contact, lastContactDays:lcd, lastContactDate:ST.getLastContactDate(d.id), lastVisitDays:ST.getLastVisitDays(d.id), lastVisitDate:ST.getLastVisitDate(d.id), contactStatus:contactColor(lcd), contactLabel:contactLabel(lcd)};
  }).sort(function(a, b) {
    var da = a.lastContactDays === null ? 9999 : a.lastContactDays;
    var db = b.lastContactDays === null ? 9999 : b.lastContactDays;
    return db - da;
  });
}

// ================================================================
// DEALER HEALTH SCORE
// ================================================================
function calcHealthScore(dealerId) {
  var cfg = getConfig(); var w = cfg.healthWeights; var score = 0; var details = [];
  var dealer = ST.getOne('dealers', dealerId);
  var contactDays = ST.getLastContactDays(dealerId);

  // Contact (30 pts)
  if (contactDays === null) { details.push({label:'ไม่เคยติดต่อ', score:0, max:w.contact, status:'bad'}); }
  else if (contactDays <= 7) { score += w.contact; details.push({label:'ติดต่อ '+contactDays+' วันที่แล้ว', score:w.contact, max:w.contact, status:'good'}); }
  else if (contactDays <= 14) { var pts = Math.round(w.contact*0.5); score += pts; details.push({label:'ติดต่อ '+contactDays+' วันที่แล้ว', score:pts, max:w.contact, status:'warn'}); }
  else { details.push({label:'ไม่ติดต่อ '+contactDays+' วัน', score:0, max:w.contact, status:'bad'}); }

  // Pipeline (20 pts)
  var pipes = ST.pipelineByDealer(dealerId).filter(function(p) { return ['lost','delivered','on_hold'].indexOf(p.status) === -1; });
  var allLogs = [];
  pipes.forEach(function(p) { ST.pipeLogsByPipe(p.id).forEach(function(l) { allLogs.push(l); }); });
  allLogs.sort(function(a,b) { return (b.date||'').localeCompare(a.date||''); });
  var logDays = allLogs.length ? daysBetween(allLogs[0].date.split('T')[0], _td()) : 999;

  if (!pipes.length) { var p1 = Math.round(w.pipelineUpdate*0.3); score += p1; details.push({label:'ไม่มี Pipeline active', score:p1, max:w.pipelineUpdate, status:'warn'}); }
  else if (logDays <= 7) { score += w.pipelineUpdate; details.push({label:'Pipeline อัพเดต '+logDays+' วัน', score:w.pipelineUpdate, max:w.pipelineUpdate, status:'good'}); }
  else if (logDays <= 14) { var p2 = Math.round(w.pipelineUpdate*0.5); score += p2; details.push({label:'Pipeline อัพเดต '+logDays+' วัน', score:p2, max:w.pipelineUpdate, status:'warn'}); }
  else { details.push({label:'Pipeline ไม่อัพเดต '+logDays+' วัน', score:0, max:w.pipelineUpdate, status:'bad'}); }

  // Achievement (20 pts)
  var target = Number(dealer ? dealer.targetRevenue : 0) || 0;
  var won = ST.pipelineByDealer(dealerId).filter(function(p) { return ['win','ordered','delivered'].indexOf(p.status) !== -1; }).reduce(function(a,p) { return a + (Number(p.forecastAmount)||0); }, 0);
  if (target > 0) { var pct = won/target; var p3 = Math.round(w.achievement*Math.min(pct,1)); score += p3; details.push({label:'Achievement '+Math.round(pct*100)+'%', score:p3, max:w.achievement, status:pct>=0.7?'good':pct>=0.4?'warn':'bad'}); }
  else { var p4 = Math.round(w.achievement*0.3); score += p4; details.push({label:'ไม่ได้ตั้งเป้า', score:p4, max:w.achievement, status:'warn'}); }

  // Cert (15 pts)
  var certCount = 0;
  if (dealer) {
    if (dealer.dsecStatus === 'pass') certCount++;
    if (dealer.crmStatus === 'yes') certCount++;
    if (dealer.fh2Status === 'pass') certCount++;
    if (dealer.larkStatus === 'added') certCount++;
  }
  var certPts = Math.round(w.certification*(certCount/4));
  score += certPts;
  details.push({label:'Cert '+certCount+'/4', score:certPts, max:w.certification, status:certCount>=3?'good':certCount>=2?'warn':'bad'});

  // Forecast (15 pts)
  var hasForecast = pipes.some(function(p) { return Number(p.forecastAmount) > 0; });
  if (hasForecast) { score += w.forecast; details.push({label:'มี Forecast', score:w.forecast, max:w.forecast, status:'good'}); }
  else { details.push({label:'ไม่มี Forecast', score:0, max:w.forecast, status:'bad'}); }

  return {score:score, details:details, level:score>=70?'good':score>=40?'warn':'bad'};
}

// ================================================================
// PIPELINE SUMMARY
// ================================================================
function getPipeSummary() {
  var cfg = getConfig(); var all = ST.getAll('pipeline'); var summary = {}; var totalPipeline = 0; var totalWon = 0;
  for (var i = 0; i < cfg.pipelineStatuses.length; i++) {
    var s = cfg.pipelineStatuses[i];
    var items = all.filter(function(p) { return p.status === s.id; });
    var amount = items.reduce(function(a,p) { return a + (Number(p.forecastAmount)||0); }, 0);
    summary[s.id] = {count:items.length, amount:amount, name:s.name, color:s.color};
    if (['lost','on_hold'].indexOf(s.id) === -1) totalPipeline += amount;
    if (['win','ordered','delivered'].indexOf(s.id) !== -1) totalWon += amount;
  }
  return {summary:summary, totalPipeline:totalPipeline, totalWon:totalWon, totalCount:all.length};
}

// ================================================================
// URGENT ITEMS
// ================================================================
function getUrgentItems() {
  var items = [];
  ST.filter('tasks', function(t) { return t.status === 'active' && t.dueDate && dTo(t.dueDate) <= 3; }).forEach(function(t) {
    items.push({title:t.title, dueDate:t.dueDate, type:'task', refId:t.id});
  });
  ST.filter('tasks', function(t) { return t.status === 'active'; }).forEach(function(t) {
    (t.steps || []).forEach(function(s) {
      if (!s.done && s.dueDate && dTo(s.dueDate) <= 3)
        items.push({title:s.title, dueDate:s.dueDate, type:'step', refId:t.id, parent:t.title});
    });
  });
  items.sort(function(a,b) { return dTo(a.dueDate) - dTo(b.dueDate); });
  return items;
}

function getStalePipelines() {
  var cutoff = addD(_td(), -14);
  return ST.filter('pipeline', function(p) {
    if (['lost','delivered','on_hold'].indexOf(p.status) !== -1) return false;
    var logs = ST.pipeLogsByPipe(p.id);
    if (!logs.length) return (p.created || '') < cutoff;
    return logs[0].date.split('T')[0] < cutoff;
  });
}

// ================================================================
// SMART FILTERS
// ================================================================
function getSmartFilters() {
  var w = getWeekRange();
  return [
    {id:'overdue_tasks', icon:'🔴', name:'งานเลย Deadline', count:getUrgentItems().filter(function(i){return dTo(i.dueDate)<0;}).length, color:'#ef4444'},
    {id:'bidding_soon', icon:'⏳', name:'Bidding สัปดาห์นี้', count:ST.filter('pipeline',function(p){return p.biddingDate&&isInRange(p.biddingDate,w.start,w.end)&&['lost','delivered'].indexOf(p.status)===-1;}).length, color:'#f59e0b'},
    {id:'stale_pipeline', icon:'🔄', name:'Pipeline ไม่อัพเดต 14d', count:getStalePipelines().length, color:'#94a3b8'},
    {id:'big_projects', icon:'💰', name:'Project ≥ 1.5M', count:ST.filter('pipeline',function(p){return Number(p.forecastAmount)>=1500000&&['lost','delivered','on_hold'].indexOf(p.status)===-1;}).length, color:'#22c55e'},
    {id:'waiting_overdue', icon:'📭', name:'รอคนอื่น (เลยกำหนด)', count:ST.filter('waiting',function(w2){return !w2.resolved&&w2.dueDate&&dTo(w2.dueDate)<0;}).length, color:'#ef4444'},
    {id:'no_contact_14d', icon:'📞', name:'ไม่ติดต่อ > 14d', count:ST.getAll('dealers').filter(function(d){var days=ST.getLastContactDays(d.id);return days===null||days>14;}).length, color:'#ef4444'},
    {id:'need_action', icon:'🎯', name:'ต้องทำ Next Action', count:ST.filter('pipeline',function(p){return p.followupDate&&dTo(p.followupDate)<=3&&['lost','delivered'].indexOf(p.status)===-1;}).length, color:'#3b82f6'},
    {id:'low_health', icon:'🏥', name:'Dealer Health ต่ำ', count:ST.getAll('dealers').filter(function(d){return calcHealthScore(d.id).score<40;}).length, color:'#ef4444'}
  ];
}

// ================================================================
// SMART INSIGHTS
// ================================================================
function generateInsights() {
  var insights = []; var pipes = ST.getAll('pipeline'); var dealers = ST.getAll('dealers'); var m = getMonthRange();
  var totalClosed = pipes.filter(function(p){return ['win','ordered','delivered','lost'].indexOf(p.status)!==-1;}).length;
  var totalWon = pipes.filter(function(p){return ['win','ordered','delivered'].indexOf(p.status)!==-1;}).length;
  if (totalClosed >= 3) {
    var winRate = Math.round(totalWon/totalClosed*100);
    insights.push({icon:winRate>=60?'📈':'📉', title:'Win Rate: '+winRate+'%', desc:totalWon+' ชนะ จาก '+totalClosed+' ที่จบ', priority:winRate<50?'high':'low'});
  }
  var ps = getPipeSummary();
  var totalTarget = dealers.reduce(function(a,d){return a+(Number(d.targetRevenue)||0);},0);
  if (totalTarget > 0) {
    var pct = Math.round(ps.totalWon/totalTarget*100);
    insights.push({icon:pct>=70?'🎯':'⚠️', title:'Achievement: '+pct+'%', desc:fmtMoney(ps.totalWon)+' / '+fmtMoney(totalTarget), priority:pct<50?'high':'low'});
  }
  var badHealth = dealers.filter(function(d){return calcHealthScore(d.id).score<40;});
  if (badHealth.length) insights.push({icon:'🏥', title:badHealth.length+' Dealer ต้องดูแลด่วน', desc:badHealth.map(function(d){return d.name;}).join(', '), priority:'high'});
  var bids = ST.filter('pipeline',function(p){return p.biddingDate&&dTo(p.biddingDate)>=0&&dTo(p.biddingDate)<=14&&['lost','delivered'].indexOf(p.status)===-1;});
  if (bids.length) { var bidAmt = bids.reduce(function(a,p){return a+(Number(p.forecastAmount)||0);},0); insights.push({icon:'⏳', title:bids.length+' Bidding ใน 2 สัปดาห์', desc:'มูลค่า '+fmtMoney(bidAmt), priority:'medium'}); }
  insights.sort(function(a,b){var o={high:0,medium:1,low:2};return (o[a.priority]||2)-(o[b.priority]||2);});
  return insights;
}

// ================================================================
// SMART SUGGESTIONS
// ================================================================
function getSmartSuggestions() {
  var suggestions = []; var cfg = getConfig(); var kpi = getKPIData(); var dow = getTodayDow();
  if (kpi.followup.current < kpi.followup.target) {
    var remaining = kpi.followup.target - kpi.followup.current;
    var notContacted = getDealerContactStatus().filter(function(d){return kpi.followup.dealers.indexOf(d.id)===-1&&d.level&&d.level!=='Other';}).slice(0,3);
    suggestions.push({icon:'📞', priority:'high', text:'ยัง Follow-up ไม่ครบ — เหลือ '+remaining+' ราย', dealers:notContacted, action:'followup'});
  }
  if (kpi.visit.current < kpi.visit.target && ['mon','tue','wed','thu'].indexOf(dow) !== -1) {
    var noVisit = getDealerContactStatus().filter(function(d){return d.lastVisitDays===null||d.lastVisitDays>14;}).slice(0,3);
    suggestions.push({icon:'🤝', priority:'high', text:'สัปดาห์นี้ยังไม่ได้ Visit', dealers:noVisit, action:'visit'});
  }
  var stale = getStalePipelines().slice(0,3);
  if (stale.length) suggestions.push({icon:'📊', priority:'medium', text:stale.length+' Pipeline ไม่อัพเดต > 14 วัน', items:stale.map(function(p){return {name:p.projectName,id:p.id};}), action:'pipeline'});
  if (dow === 'fri' && !kpi.vpSent) suggestions.push({icon:'📧', priority:'high', text:'ยังไม่ส่ง Visit Plan Email', action:'email'});
  if (['mon','tue','wed'].indexOf(dow) !== -1 && !kpi.pipeUpdated) suggestions.push({icon:'📊', priority:'medium', text:'สัปดาห์นี้ยังไม่ Update Pipeline', action:'pipeline'});
  return suggestions;
}

// ================================================================
// GOAL SETTING
// ================================================================
function getGoalData() {
  var q = getQuarterRange(); var dealers = ST.getAll('dealers');
  var totalTarget = 0, totalWon = 0;
  var dealerGoals = dealers.filter(function(d){return Number(d.targetRevenue)>0;}).map(function(d) {
    var target = Number(d.targetRevenue)||0;
    var won = ST.pipelineByDealer(d.id).filter(function(p){return ['win','ordered','delivered'].indexOf(p.status)!==-1;}).reduce(function(a,p){return a+(Number(p.forecastAmount)||0);},0);
    var pipeActive = ST.pipelineByDealer(d.id).filter(function(p){return ['lost','delivered','on_hold'].indexOf(p.status)===-1;}).reduce(function(a,p){return a+(Number(p.forecastAmount)||0);},0);
    totalTarget += target; totalWon += won;
    return {dealer:d, target:target, won:won, gap:Math.max(0,target-won), pct:target?Math.round(won/target*100):0, pipeActive:pipeActive};
  }).sort(function(a,b){return a.pct-b.pct;});
  return {quarter:q, totalTarget:totalTarget, totalWon:totalWon, totalPct:totalTarget?Math.round(totalWon/totalTarget*100):0, dealers:dealerGoals, daysLeft:daysBetween(_td(),q.end)};
}

// ================================================================
// KNOWLEDGE BASE HELPERS
// ================================================================
function searchNotes(query) {
  if (!query) return ST.getAll('notes');
  var q = query.toLowerCase();
  return ST.getAll('notes').filter(function(n) {
    return (n.title||'').toLowerCase().indexOf(q) !== -1 || (n.content||'').toLowerCase().indexOf(q) !== -1 || (n.tags||'').toLowerCase().indexOf(q) !== -1 || (n.category||'').toLowerCase().indexOf(q) !== -1;
  });
}

function getPinnedNotes() { return ST.filter('notes', function(n){return n.pinned;}); }
function getNotesByCategory(cat) { if (!cat || cat === 'all') return ST.getAll('notes'); return ST.filter('notes', function(n){return n.category === cat;}); }

// ================================================================
// PIPELINE DASHBOARD HELPERS
// ================================================================
function getPipelineDashboard() {
  var pipes = ST.getAll('pipeline');
  var allAmt=0,wonAmt=0,lostAmt=0,activeAmt=0,wonCount=0,lostCount=0,activeCount=0;
  var byDealer={}, biddingSoon=[], needUpdate=[], needAction=[];

  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i]; var amt = Number(p.forecastAmount)||0; allAmt += amt;
    if (['win','ordered','delivered'].indexOf(p.status)!==-1) { wonAmt+=amt; wonCount++; }
    else if (p.status==='lost') { lostAmt+=amt; lostCount++; }
    else if (p.status!=='on_hold') { activeAmt+=amt; activeCount++; }

    var did = p.dealerId||'unknown';
    if (!byDealer[did]) byDealer[did]={count:0,amount:0,won:0};
    byDealer[did].count++; byDealer[did].amount+=amt;
    if (['win','ordered','delivered'].indexOf(p.status)!==-1) byDealer[did].won+=amt;

    if (p.biddingDate && ['prospect','tor_review','quotation','bidding','negotiation'].indexOf(p.status)!==-1 && dTo(p.biddingDate)>=0 && dTo(p.biddingDate)<=30) biddingSoon.push(p);
    if (['lost','delivered','on_hold'].indexOf(p.status)===-1) {
      var logs = ST.pipeLogsByPipe(p.id);
      var lastDate = logs.length ? logs[0].date : p.created||'';
      if (lastDate) { var ds = daysBetween(lastDate.split('T')[0], _td()); if (ds>14) needUpdate.push({pipe:p,days:ds}); }
    }
    if (p.followupDate && dTo(p.followupDate)<=3 && ['lost','delivered'].indexOf(p.status)===-1) needAction.push(p);
  }
  var closedCount = wonCount+lostCount;
  biddingSoon.sort(function(a,b){return (a.biddingDate||'').localeCompare(b.biddingDate||'');});
  needUpdate.sort(function(a,b){return b.days-a.days;});
  return {total:pipes.length,allAmt:allAmt,wonCount:wonCount,wonAmt:wonAmt,lostCount:lostCount,lostAmt:lostAmt,activeCount:activeCount,activeAmt:activeAmt,winRate:closedCount>0?Math.round(wonCount/closedCount*100):0,closedCount:closedCount,byDealer:byDealer,biddingSoon:biddingSoon,needUpdate:needUpdate,needAction:needAction};
}

// ================================================================
// PIN
// ================================================================
function togglePin(type, refId, label, sub) {
  if (ST.hasPin(refId)) { ST.removePin(refId); toast('❌ เอาออกจากหมุด'); }
  else { ST.addPin({type:type,refId:refId,label:label,sub:sub||''}); toast('📌 ปักหมุดแล้ว'); }
  render();
}

// ================================================================
// CLOCK
// ================================================================
function updClk() {
  var n = new Date();
  var el = document.getElementById('clock');
  if (el) el.textContent = String(n.getDate()).padStart(2,'0')+'/'+String(n.getMonth()+1).padStart(2,'0')+'/'+n.getFullYear()+' 🕐 '+n.toLocaleTimeString('th-TH');
}
setInterval(updClk, 1000); updClk();

// ================================================================
// NOTIFICATIONS
// ================================================================
function checkNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  var today = _td();
  var tomorrow = addD(today, 1);
  
  // Pipeline Bidding
  ST.filter('pipeline', function(p) {
    return p.biddingDate && dTo(p.biddingDate) === 1 && ['lost','delivered'].indexOf(p.status) === -1;
  }).forEach(function(p) {
    new Notification('⏳ Bidding พรุ่งนี้!', { body: p.projectName, tag: 'bid'+p.id });
  });
  
  // Meetings
  ST.filter('meetings', function(m) { return dTo(m.date) === 1; }).forEach(function(m) {
    new Notification('📅 ประชุมพรุ่งนี้!', { body: m.title, tag: 'mt'+m.id });
  });
  
  // TASKS - Due Date Today
  ST.filter('tasks', function(t) {
    return t.status === 'active' && t.dueDate === today && t.lastNotified !== today;
  }).forEach(function(t) {
    new Notification('📋 งานถึงกำหนดวันนี้!', { body: t.title, tag: 'due_'+t.id });
    ST.update('tasks', t.id, { lastNotified: today });
  });
  
  // TASKS - Due Date Tomorrow
  ST.filter('tasks', function(t) {
    return t.status === 'active' && t.dueDate === tomorrow;
  }).forEach(function(t) {
    new Notification('⏰ งานใกล้ถึงกำหนด', { body: t.title + ' จะถึงกำหนดพรุ่งนี้', tag: 'due_soon_'+t.id });
  });
  
  // TASKS - Follow-up Date Today
  ST.filter('tasks', function(t) {
    return t.status === 'active' && t.followupDate === today && t.lastFollowupNotified !== today;
  }).forEach(function(t) {
    new Notification('📞 นัดติดตามวันนี้!', {
      body: t.title + (t.followupNote ? ' - ' + t.followupNote : ''),
      tag: 'fu_'+t.id
    });
    ST.update('tasks', t.id, { lastFollowupNotified: today });
  });
  
  // TASKS - Follow-up Tomorrow (ถ้าเปิดเตือนล่วงหน้า)
  ST.filter('tasks', function(t) {
    return t.status === 'active' && t.followupNotifyDayBefore && t.followupDate === tomorrow;
  }).forEach(function(t) {
    new Notification('📞 นัดติดตามพรุ่งนี้', {
      body: t.title + (t.followupNote ? ' - ' + t.followupNote : ''),
      tag: 'fu_soon_'+t.id
    });
  });
  
  // Pipeline follow-up
  ST.filter('pipeline', function(p) {
    return p.followupDate && dTo(p.followupDate) === 0 && ['lost','delivered'].indexOf(p.status) === -1;
  }).forEach(function(p) {
    new Notification('🎯 Follow-up Pipeline วันนี้!', { body: p.projectName, tag: 'pa'+p.id });
  });
}

// ================================================================
// APPEARANCE SYSTEM
// ================================================================
var ACCENT_COLORS = [
  {id: 'blue', color: '#3b82f6', label: '🔵'},
  {id: 'green', color: '#22c55e', label: '🟢'},
  {id: 'purple', color: '#a855f7', label: '🟣'},
  {id: 'orange', color: '#f97316', label: '🟠'},
  {id: 'red', color: '#ef4444', label: '🔴'},
  {id: 'pink', color: '#ec4899', label: '🩷'},
  {id: 'cyan', color: '#06b6d4', label: '🔵'},
  {id: 'yellow', color: '#eab308', label: '🟡'}
];

var DEF_APPEARANCE = {
  theme: 'dark',
  accent: 'blue',
  fontSize: 'normal',
  sidebar: 'normal',
  cardStyle: 'rounded',
  spacing: 'normal',
  tableSize: 'normal'
};

function getAppearance() {
  try {
    var saved = JSON.parse(localStorage.getItem('v7_appearance'));
    if (saved) {
      var result = {};
      var keys = Object.keys(DEF_APPEARANCE);
      for (var i = 0; i < keys.length; i++) {
        result[keys[i]] = saved[keys[i]] || DEF_APPEARANCE[keys[i]];
      }
      return result;
    }
  } catch(e) {}
  return JSON.parse(JSON.stringify(DEF_APPEARANCE));
}

function saveAppearance(settings) {
  localStorage.setItem('v7_appearance', JSON.stringify(settings));
  applyAppearance(settings);
}

function applyAppearance(settings) {
  if (!settings) settings = getAppearance();
  var body = document.body;
  
  // Remove all appearance classes
  var classes = body.className.split(' ');
  var keep = [];
  for (var i = 0; i < classes.length; i++) {
    var c = classes[i].trim();
    if (c && c.indexOf('theme-') !== 0 && c.indexOf('accent-') !== 0 && 
        c.indexOf('font-') !== 0 && c.indexOf('sidebar-') !== 0 && 
        c.indexOf('card-') !== 0 && c.indexOf('spacing-') !== 0 && 
        c.indexOf('table-') !== 0) {
      keep.push(c);
    }
  }
  body.className = keep.join(' ');
  
  // Apply theme
  if (settings.theme !== 'dark') body.classList.add('theme-' + settings.theme);
  
  // Apply accent
  if (settings.accent !== 'blue') body.classList.add('accent-' + settings.accent);
  
  // Apply font size
  if (settings.fontSize !== 'normal') body.classList.add('font-' + settings.fontSize);
  
  // Apply sidebar
  if (settings.sidebar !== 'normal') body.classList.add('sidebar-' + settings.sidebar);
  
  // Apply card style
  if (settings.cardStyle !== 'rounded') body.classList.add('card-' + settings.cardStyle);
  
  // Apply spacing
  if (settings.spacing !== 'normal') body.classList.add('spacing-' + settings.spacing);
  
  // Apply table size
  if (settings.tableSize !== 'normal') body.classList.add('table-' + settings.tableSize);
  
  // Update sidebar width for JS
  var sidebar = document.getElementById('sidebar');
  var main = document.getElementById('main');
  if (sidebar && main && window.innerWidth > 768) {
    var w = settings.sidebar === 'narrow' ? '170px' : settings.sidebar === 'wide' ? '240px' : '200px';
    main.style.marginLeft = w;
  }
  
  // Update theme button
  var btn = document.querySelector('.theme-btn');
  if (btn) btn.textContent = settings.theme === 'dark' ? '🌙' : settings.theme === 'midnight' ? '🌑' : '☀️';
}

function switchTheme() {
  var settings = getAppearance();
  var themes = ['dark', 'midnight', 'light'];
  var names = {dark: '🌙 Dark Blue', midnight: '🌑 Midnight', light: '☀️ Light'};
  var idx = themes.indexOf(settings.theme);
  settings.theme = themes[(idx + 1) % themes.length];
  saveAppearance(settings);
  toast('🎨 ' + names[settings.theme]);
}

// Apply on load
applyAppearance();

// ================================================================
// INIT
// ================================================================
initRoutines();
restoreTimer();
render();
checkNotifications();
setInterval(checkNotifications, 3600000);

// ================================================================
// MODEL HELPERS (backward compatible)
// ================================================================

// Get model name (works with both old String and new Object)
function getModelName(model) {
  if (!model) return '';
  if (typeof model === 'object' && model.name) return model.name;
  return String(model);
}

// Get model price from config
function getModelPrice(modelName) {
  var cfg = getConfig();
  for (var i = 0; i < cfg.models.length; i++) {
    var m = cfg.models[i];
    var name = typeof m === 'object' ? m.name : m;
    if (name === modelName) {
      return (typeof m === 'object' ? m.price : 0) || 0;
    }
  }
  return 0;
}

// Get model options HTML (for dropdowns)
function modelOptionsNew(selected) {
  var cfg = getConfig();
  var h = '<option value="">-- เลือก Model --</option>';
  for (var i = 0; i < cfg.models.length; i++) {
    var m = cfg.models[i];
    var name = typeof m === 'object' ? m.name : m;
    var price = typeof m === 'object' ? (m.price || 0) : 0;
    var label = name + (price > 0 ? ' (฿' + fmtMoney(price) + ')' : '');
    h += '<option value="' + sanitize(name) + '"' + (selected === name ? ' selected' : '') + '>' + sanitize(label) + '</option>';
  }
  return h;
}

// Get pipeline items (backward compatible)
function getPipeItems(p) {
  if (p.items && p.items.length > 0) return p.items;
  // Backward compatible: create items from old model/modelQty
  if (p.model) {
    return [{
      model: p.model,
      qty: Number(p.modelQty) || 1,
      price: getModelPrice(p.model),
      total: Number(p.forecastAmount) || 0
    }];
  }
  return [];
}

// Get total QTY from pipeline
function getPipeTotalQty(p) {
  var items = getPipeItems(p);
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total += (Number(items[i].qty) || 1);
  }
  return total;
}

// Get all models from pipeline (for display)
function getPipeModelSummary(p) {
  var items = getPipeItems(p);
  return items.map(function(it) {
    return (it.model || '-') + (it.qty > 1 ? ' x' + it.qty : '');
  }).join(', ');
}

// ================================================================
// EDIT FAVORITES
// ================================================================
function showEditFavorites() {
  var favs = getFavorites();
  var ALL_MENU_ITEMS = [
    {id: 'today', icon: '📌', name: 'วันนี้', action: "go('today')"},
    {id: 'dealers', icon: '🏪', name: 'Dealers', action: "go('dealers')"},
    {id: 'pipeline', icon: '📊', name: 'Pipeline', action: "go('pipeline')"},
    {id: 'pipeBoard', icon: '📋', name: 'Pipeline Board', action: "go('pipeBoard')"},
    {id: 'pipeDash', icon: '📊', name: 'Pipeline Overview', action: "go('pipeDash')"},
    {id: 'tasks', icon: '📋', name: 'Tasks', action: "go('tasks')"},
    {id: 'kanban', icon: '📋', name: 'Kanban', action: "go('kanban')"},
    {id: 'visitPlan', icon: '📅', name: 'Visit Plan', action: "go('visitPlan')"},
    {id: 'meetings', icon: '📅', name: 'ประชุม', action: "go('meetings')"},
    {id: 'calendar', icon: '📆', name: 'ปฏิทิน', action: "go('calendar')"},
    {id: 'visits', icon: '🤝', name: 'Visit Report', action: "go('visits')"},
    {id: 'followup', icon: '📞', name: 'Follow-up', action: "go('followup')"},
    {id: 'forecast', icon: '📦', name: 'Forecast', action: "go('forecast')"},
    {id: 'report', icon: '📊', name: 'Weekly Report', action: "go('report')"},
    {id: 'dashboard', icon: '📈', name: 'Dashboard', action: "go('dashboard')"},
    {id: 'line', icon: '💬', name: 'LINE Message', action: "openLineTemplates()"},
    {id: 'emailDrafts', icon: '📧', name: 'Email Draft', action: "go('emailDrafts')"},
    {id: 'presentation', icon: '🎬', name: 'Presentation', action: "openPresentation()"},
    {id: 'feedback', icon: '💡', name: 'Feedback', action: "go('feedback')"},
    {id: 'kpi', icon: '🎯', name: 'KPI', action: "go('kpi')"},
    {id: 'customKpi', icon: '🎯', name: 'KPI Dashboard', action: "go('customKpi')"},
    {id: 'monthlyGoal', icon: '🎯', name: 'Monthly Goal', action: "go('monthlyGoal')"},
    {id: 'demoTracker', icon: '🚁', name: 'Demo Equipment', action: "go('demoTracker')"},
    {id: 'quotations', icon: '💰', name: 'Quotation', action: "go('quotations')"},
    {id: 'knowledge', icon: '📚', name: 'Knowledge', action: "go('knowledge')"},
    {id: 'exports', icon: '📤', name: 'Export', action: "go('exports')"},
    {id: 'health', icon: '🏥', name: 'Data Health', action: "go('health')"},
    {id: 'admin', icon: '⚙️', name: 'ตั้งค่า', action: "go('admin')"}
  ];
  
  var h = '<div style="max-width:400px">';
  h += '<div style="font-size:13px;color:var(--text2);margin-bottom:10px">กดเลือกเมนูที่ใช้บ่อย (แนะนำ 3-6 อัน)</div>';
  
  for (var i = 0; i < ALL_MENU_ITEMS.length; i++) {
    var item = ALL_MENU_ITEMS[i];
    var isFav = favs.indexOf(item.id) !== -1;
    h += '<div class="fav-edit-item" onclick="toggleFavItem(\'' + item.id + '\',this)">';
    h += '<input type="checkbox" ' + (isFav ? 'checked' : '') + ' onclick="event.stopPropagation();toggleFavItem(\'' + item.id + '\',this.parentElement)">';
    h += '<span>' + item.icon + ' ' + item.name + '</span>';
    h += '</div>';
  }
  
  h += '<div class="fm-actions" style="margin-top:12px">';
  h += '<button class="btn btn-blue" onclick="saveFavFromModal()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  
  openM('⭐ แก้ไข Favorites', h);
}

function toggleFavItem(itemId, el) {
  var chk = el.querySelector('input[type=checkbox]');
  if (chk) chk.checked = !chk.checked;
}

function saveFavFromModal() {
  var checks = document.querySelectorAll('.fav-edit-item input[type=checkbox]:checked');
  var favs = [];
  for (var i = 0; i < checks.length; i++) {
    var parent = checks[i].parentElement;
    var onclick = parent.getAttribute('onclick') || '';
    var match = onclick.match(/toggleFavItem\('([^']+)'/);
    if (match) favs.push(match[1]);
  }
  saveFavorites(favs);
  toast('⭐ บันทึก Favorites แล้ว');
  closeMForce();
  renderFavorites();
}

function getFavorites() {
  var saved = localStorage.getItem('v7_favorites');
  if (saved) { try { return JSON.parse(saved); } catch(e) { } }
  return ['today', 'dealers', 'pipeline', 'tasks', 'visits'];
}

function saveFavorites(list) {
  localStorage.setItem('v7_favorites', JSON.stringify(list));
}

function renderFavorites() {
  var favs = getFavorites();
  var el = document.getElementById('sbFavorites');
  if (!el) return;
  
  var h = '';
  var ALL_MENU_ITEMS = {
    'today': '📌 วันนี้', 'dealers': '🏪 Dealers', 'pipeline': '📊 Pipeline',
    'pipeBoard': '📋 Board', 'pipeDash': '📊 Overview', 'tasks': '📋 Tasks',
    'kanban': '📋 Kanban', 'visitPlan': '📅 Visit Plan', 'meetings': '📅 ประชุม',
    'calendar': '📆 ปฏิทิน', 'visits': '🤝 Visit Report', 'followup': '📞 Follow-up',
    'forecast': '📦 Forecast', 'report': '📊 Weekly Report', 'dashboard': '📈 Dashboard',
    'line': '💬 LINE Message', 'emailDrafts': '📧 Email Draft', 'presentation': '🎬 Presentation',
    'feedback': '💡 Feedback', 'kpi': '🎯 KPI', 'customKpi': '🎯 KPI Dashboard',
    'monthlyGoal': '🎯 Monthly Goal', 'demoTracker': '🚁 Demo Equipment',
    'quotations': '💰 Quotation', 'knowledge': '📚 Knowledge', 'exports': '📤 Export',
    'health': '🏥 Data Health', 'admin': '⚙️ ตั้งค่า'
  };
  
  for (var i = 0; i < favs.length; i++) {
    var favId = favs[i];
    var name = ALL_MENU_ITEMS[favId] || favId;
    var isActive = S && S.view === favId;
    h += '<div class="sb-fav-item' + (isActive ? ' act' : '') + '" onclick="go(\'' + favId + '\')">';
    h += name;
    h += '</div>';
  }
  
  el.innerHTML = h;
}

// ================================================================
// TOGGLE VIEW MODE (Desktop/Mobile)
// ================================================================
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

function updateMbNav() {
  var items = document.querySelectorAll('.mb-nav-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('act');
  }
  var current = S ? S.view : 'today';
  var navItems = document.querySelectorAll('.mb-nav-item');
  for (var j = 0; j < navItems.length; j++) {
    var onclick = navItems[j].getAttribute('onclick') || '';
    if (onclick.indexOf(current) !== -1) {
      navItems[j].classList.add('act');
    }
    if (current === 'mbHome' && onclick.indexOf('mbHome') !== -1) {
      navItems[j].classList.add('act');
    }
  }
}

// ================================================================
// OPEN QUICK COMMAND (Ctrl+K)
// ================================================================
var qCmdOpen = false;

function openQCmd() {
  var ov = document.getElementById('qcmdOverlay');
  if (!ov) return;
  ov.style.display = 'flex';
  qCmdOpen = true;
  var inp = document.getElementById('qcmdInput');
  if (inp) { inp.value = ''; inp.focus(); }
  qCmdSearch('');
}

function closeQCmd() {
  var ov = document.getElementById('qcmdOverlay');
  if (ov) ov.style.display = 'none';
  qCmdOpen = false;
}

function qCmdSearch(q) {
  q = (q || '').toLowerCase().trim();
  var results = [];
  
  var navs = [
    { icon: '📌', name: 'Today', cmd: 'go:today' },
    { icon: '🏪', name: 'Dealers', cmd: 'go:dealers' },
    { icon: '📋', name: 'Pipeline', cmd: 'go:pipeline' },
    { icon: '📋', name: 'Pipeline Board', cmd: 'go:pipeBoard' },
    { icon: '📍', name: 'Visit Reports', cmd: 'go:visits' },
    { icon: '📋', name: 'Tasks', cmd: 'go:tasks' },
    { icon: '📋', name: 'Kanban', cmd: 'go:kanban' },
    { icon: '📅', name: 'Meetings', cmd: 'go:meetings' },
    { icon: '📆', name: 'Calendar', cmd: 'go:calendar' },
    { icon: '📤', name: 'Export', cmd: 'go:exports' },
    { icon: '📚', name: 'Knowledge Base', cmd: 'go:knowledge' },
    { icon: '📊', name: 'Weekly Report', cmd: 'go:report' },
    { icon: '📈', name: 'Dashboard', cmd: 'go:dashboard' },
    { icon: '🏥', name: 'Data Health', cmd: 'go:health' },
    { icon: '⚙️', name: 'Admin', cmd: 'go:admin' }
  ];
  
  var acts = [
    { icon: '➕', name: 'เพิ่ม Visit', cmd: 'act:showVisitM' },
    { icon: '➕', name: 'เพิ่ม Pipeline', cmd: 'act:showPipelineM' },
    { icon: '➕', name: 'เพิ่ม Dealer', cmd: 'act:showDealerM' },
    { icon: '➕', name: 'เพิ่ม Task', cmd: 'act:showTaskM' },
    { icon: '💬', name: 'LINE Message', cmd: 'act:openLineTemplates' },
    { icon: '🎬', name: 'Presentation', cmd: 'act:openPresentation' }
  ];
  
  for (var i = 0; i < navs.length; i++) {
    var n = navs[i];
    if (!q || n.name.toLowerCase().indexOf(q) !== -1) {
      results.push({ type: 'nav', icon: n.icon, name: n.name, cmd: n.cmd });
    }
  }
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!q || a.name.toLowerCase().indexOf(q) !== -1) {
      results.push({ type: 'action', icon: a.icon, name: a.name, cmd: a.cmd });
    }
  }
  
  if (q.length >= 1) {
    var dealers = ST.getAll('dealers');
    for (var i = 0; i < dealers.length; i++) {
      var d = dealers[i];
      if ((d.name || '').toLowerCase().indexOf(q) !== -1) {
        results.push({ type: 'dealer', icon: '🏪', name: d.name, cmd: 'dealer:' + d.id });
      }
    }
    
    var pipeline = ST.getAll('pipeline');
    for (var i = 0; i < pipeline.length; i++) {
      var p = pipeline[i];
      var pname = p.projectName || p.name || '';
      if (pname.toLowerCase().indexOf(q) !== -1) {
        results.push({ type: 'pipeline', icon: '📋', name: pname + ' (฿' + fmtMoneyShort(p.forecastAmount) + ')', cmd: 'pipe:' + p.id });
      }
    }
  }
  
  var el = document.getElementById('qcmdResults');
  if (!el) return;
  
  if (!results.length) {
    el.innerHTML = '<div class="qcmd-empty">ไม่พบผลลัพธ์</div>';
    return;
  }
  
  var h = '';
  var lastType = '';
  for (var i = 0; i < Math.min(results.length, 15); i++) {
    var r = results[i];
    if (r.type !== lastType) {
      var typeLabel = { nav: '📌 Navigation', action: '⚡ Actions', dealer: '🏪 Dealers', pipeline: '📋 Pipeline' };
      h += '<div class="qcmd-section">' + (typeLabel[r.type] || '') + '</div>';
      lastType = r.type;
    }
    h += '<div class="qcmd-item' + (i === 0 ? ' qcmd-active' : '') + '" onclick="qCmdExec(\'' + r.cmd + '\')" data-idx="' + i + '">';
    h += '<span class="qcmd-icon">' + r.icon + '</span>';
    h += '<span class="qcmd-name">' + sanitize(r.name) + '</span>';
    h += '<span class="qcmd-type">' + r.type + '</span>';
    h += '</div>';
  }
  el.innerHTML = h;
}

function qCmdExec(cmd) {
  closeQCmd();
  var parts = cmd.split(':');
  var type = parts[0];
  var val = parts.slice(1).join(':');
  
  if (type === 'go') {
    go(val);
  } else if (type === 'act') {
    if (typeof window[val] === 'function') window[val]();
  } else if (type === 'dealer') {
    go('dealerDetail', { dealerId: val });
  } else if (type === 'pipe') {
    go('pipeDetail', { pipeId: val });
  }
}

// Keyboard navigation for command palette
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (qCmdOpen) closeQCmd();
    else openQCmd();
  }
  if (e.key === 'Escape' && qCmdOpen) closeQCmd();
});

document.addEventListener('keydown', function(e) {
  if (qCmdOpen) {
    var items = document.querySelectorAll('.qcmd-item');
    if (!items.length) return;
    
    var active = document.querySelector('.qcmd-active');
    var idx = 0;
    if (active) idx = parseInt(active.getAttribute('data-idx')) || 0;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = Math.min(idx + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = Math.max(idx - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active) active.click();
      return;
    }
    
    for (var i = 0; i < items.length; i++) items[i].classList.remove('qcmd-active');
    items[idx].classList.add('qcmd-active');
    items[idx].scrollIntoView({ block: 'nearest' });
  }
});
// ================================================================
// QUICK COMMAND KEYBOARD NAVIGATION
// ================================================================
function qCmdKeydown(e) {
  var items = document.querySelectorAll('.qcmd-item');
  if (!items.length) return;
  
  var active = document.querySelector('.qcmd-active');
  var idx = 0;
  if (active) idx = parseInt(active.getAttribute('data-idx')) || 0;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    idx = Math.min(idx + 1, items.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    idx = Math.max(idx - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (active) active.click();
    return;
  } else if (e.key === 'Escape') {
    closeQCmd();
    return;
  } else {
    return;
  }
  
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('qcmd-active');
  }
  items[idx].classList.add('qcmd-active');
  items[idx].scrollIntoView({ block: 'nearest' });
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
// ================================================================
// MOBILE BOTTOM NAVIGATION
// ================================================================
function mbGo(view) {
  if (view === 'mbHome') {
    renderMbHome();
    return;
  }
  go(view);
  updateMbNav();
}

function renderMbHome() {
  var el = document.getElementById('ct');
  if (!el) return;
  document.getElementById('pgT').textContent = '🏠 Home';
  
  var cfg = getConfig();
  var now = new Date();
  var dayNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  
  var dealers = ST.getAll('dealers');
  var pipeline = ST.getAll('pipeline');
  var activePipe = pipeline.filter(function(p) { 
    return ['lost','delivered','on_hold'].indexOf(p.status) === -1; 
  });
  var tasks = ST.filter('tasks', function(t) { return t.status === 'active'; });
  var visits = JSON.parse(localStorage.getItem('v7_visits') || '[]');
  var todayVisits = visits.filter(function(v) { return v.date === _td(); });
  
  var pendingActions = [];
  try { pendingActions = getAllPendingPipeActions(); } catch(e) { pendingActions = []; }
  var overdueActions = pendingActions.filter(function(p) { return p.urgency === 'overdue'; });

  var h = '<div class="mb-home">';
  
  // Greeting
  h += '<div class="mb-home-header">';
  h += '<div class="mb-home-greeting">👋 สวัสดี ' + sanitize(cfg.saleName || 'Siwawong') + '</div>';
  h += '<div class="mb-home-date">วัน' + dayNames[now.getDay()] + ' ' + _td() + '</div>';
  h += '</div>';

  // Urgent
  if (overdueActions.length) {
    h += '<div class="mb-urgent">';
    h += '<div class="mb-urgent-title">🔴 ด่วน (' + overdueActions.length + ')</div>';
    for (var i = 0; i < Math.min(overdueActions.length, 3); i++) {
      var item = overdueActions[i];
      h += '<div class="mb-urgent-item" onclick="go(\'pipeDetail\',{pipeId:\'' + item.pipe.id + '\'})">⏳ ' + sanitize(item.action.text) + '</div>';
    }
    h += '</div>';
  }

  // Quick Actions
  h += '<div class="mb-actions">';
  h += '<div class="mb-action-btn" onclick="showVisitM()"><span class="mb-action-icon">🤝</span>เพิ่ม Visit</div>';
  h += '<div class="mb-action-btn" onclick="showTaskM()"><span class="mb-action-icon">📋</span>เพิ่มงาน</div>';
  h += '<div class="mb-action-btn" onclick="showPipelineM()"><span class="mb-action-icon">📊</span>เพิ่ม Pipeline</div>';
  h += '<div class="mb-action-btn" onclick="showQNote()"><span class="mb-action-icon">📝</span>Quick Note</div>';
  h += '<div class="mb-action-btn" onclick="openLineTemplates()"><span class="mb-action-icon">💬</span>LINE</div>';
  h += '<div class="mb-action-btn" onclick="go(\'visitPlan\')"><span class="mb-action-icon">📅</span>Visit Plan</div>';
  h += '</div>';

  // Stats Grid
  h += '<div class="mb-grid">';
  h += '<div class="mb-tile" onclick="go(\'dealers\')"><div class="mb-tile-icon">🏪</div><div class="mb-tile-count">' + dealers.length + '</div><div class="mb-tile-name">Dealers</div></div>';
  h += '<div class="mb-tile" onclick="go(\'pipeline\')"><div class="mb-tile-icon">📊</div><div class="mb-tile-count">' + activePipe.length + '</div><div class="mb-tile-name">Pipeline</div></div>';
  h += '<div class="mb-tile" onclick="go(\'tasks\')"><div class="mb-tile-icon">📋</div><div class="mb-tile-count">' + tasks.length + '</div><div class="mb-tile-name">Tasks</div></div>';
  h += '<div class="mb-tile" onclick="go(\'visits\')"><div class="mb-tile-icon">🤝</div><div class="mb-tile-count">' + todayVisits.length + '</div><div class="mb-tile-name">Visit วันนี้</div></div>';
  h += '<div class="mb-tile" onclick="go(\'forecast\')"><div class="mb-tile-icon">📦</div><div class="mb-tile-count">' + pipeline.length + '</div><div class="mb-tile-name">Forecast</div></div>';
  h += '<div class="mb-tile" onclick="go(\'knowledge\')"><div class="mb-tile-icon">📚</div><div class="mb-tile-count">' + ST.getAll('notes').length + '</div><div class="mb-tile-name">Knowledge</div></div>';
  h += '</div>';

  // More Menu
  h += '<div class="card"><h2>📂 เมนูเพิ่มเติม</h2>';
  h += '<div class="mb-actions">';
  h += '<div class="mb-action-btn" onclick="go(\'report\')"><span class="mb-action-icon">📊</span>Weekly Report</div>';
  h += '<div class="mb-action-btn" onclick="go(\'dashboard\')"><span class="mb-action-icon">📈</span>Dashboard</div>';
  h += '<div class="mb-action-btn" onclick="go(\'calendar\')"><span class="mb-action-icon">📆</span>ปฏิทิน</div>';
  h += '<div class="mb-action-btn" onclick="go(\'customKpi\')"><span class="mb-action-icon">🎯</span>KPI</div>';
  h += '<div class="mb-action-btn" onclick="go(\'demoTracker\')"><span class="mb-action-icon">🚁</span>Demo</div>';
  h += '<div class="mb-action-btn" onclick="go(\'quotations\')"><span class="mb-action-icon">💰</span>Quotation</div>';
  h += '<div class="mb-action-btn" onclick="go(\'emailDrafts\')"><span class="mb-action-icon">📧</span>Email Draft</div>';
  h += '<div class="mb-action-btn" onclick="go(\'admin\')"><span class="mb-action-icon">⚙️</span>ตั้งค่า</div>';
  h += '</div></div>';

  h += '</div>';
  el.innerHTML = h;
  updateMbNav();
}

function updateMbNav() {
  var items = document.querySelectorAll('.mb-nav-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('act');
  }
  var current = S ? S.view : 'today';
  var navItems = document.querySelectorAll('.mb-nav-item');
  for (var j = 0; j < navItems.length; j++) {
    var onclick = navItems[j].getAttribute('onclick') || '';
    if (onclick.indexOf(current) !== -1) {
      navItems[j].classList.add('act');
    }
    if (current === 'mbHome' && onclick.indexOf('mbHome') !== -1) {
      navItems[j].classList.add('act');
    }
  }
}
window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CV_UPDATE') {
    var data = event.data;
    if (data.pipeId && data.text) {
      ST.add('pipeLog', {
        pipeId: data.pipeId,
        type: 'update',
        content: '📞 ลูกค้าสอบถาม/อัพเดท: ' + data.text,
        date: _nw()
      });
      toast('📬 ได้รับอัพเดทจากลูกค้า!');
      
      var pipe = ST.getOne('pipeline', data.pipeId);
      if (pipe) {
        ST.add('tasks', {
          title: '📞 ตอบกลับลูกค้า: ' + (pipe.projectName || '').substr(0, 40),
          description: 'ลูกค้าสอบถาม/อัพเดท: ' + data.text,
          pipeId: data.pipeId,
          dealerId: pipe.dealerId,
          dueDate: addD(_td(), 2),
          priority: 'high',
          status: 'active',
          category: 'Client'
        });
      }
      setTimeout(function() { render(); }, 500);
    }
  }
});
// ================================================================
// FORECAST COMPARISON PAGE - เพิ่มใน app.js
// ================================================================

var fcCompareMode = 'shipment';
var fcCompareMonth = getCurrentForecastMonth();
var fcCompareDealer = 'all';

function getCurrentForecastMonth() {
  var now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function getMonthOptionsForCompare() {
  var options = [];
  var now = new Date();
  for (var i = 0; i < 12; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    var year = d.getFullYear() + 543;
    var month = d.getMonth() + 1;
    var label = (month < 10 ? '0' + month : month) + '/' + year;
    var value = d.getFullYear() + '-' + String(month).padStart(2, '0');
    options.push({ value: value, label: label });
  }
  return options;
}

function formatMonthKeyToLabel(monthKey) {
  var parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  var year = parseInt(parts[0]) + 543;
  var month = parseInt(parts[1]);
  return (month < 10 ? '0' + month : month) + '/' + year;
}

function getPipelineForecastByMonth(dealerId, dateField, monthKey) {
  var pipes = ST.pipelineByDealer(dealerId);
  var totalQty = 0;
  var items = [];
  
  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    if (['lost', 'delivered', 'on_hold'].indexOf(p.status) !== -1) continue;
    
    var targetDate = null;
    if (dateField === 'shipment') targetDate = p.shipmentDate;
    else if (dateField === 'bidding') targetDate = p.biddingDate;
    else targetDate = p.registerDate;
    
    if (!targetDate) continue;
    
    var parts = targetDate.split('-');
    if (parts.length !== 3) continue;
    var pipeMonth = parts[0] + '-' + parts[1];
    
    if (pipeMonth === monthKey) {
      var pipeItems = getPipeItems(p);
      for (var j = 0; j < pipeItems.length; j++) {
        var it = pipeItems[j];
        var qty = Number(it.qty) || 1;
        totalQty += qty;
        items.push({
          model: it.model || p.model || '-',
          qty: qty,
          projectName: p.projectName || '-',
          pipeId: p.id
        });
      }
    }
  }
  
  return { totalQty: totalQty, items: items };
}

// แก้ไข function getClientForecastByMonth ใน app.js
function getClientForecastByMonth(dealerId, monthKey) {
  // ลองอ่านจาก localStorage ก่อน
  var key = 'v7_client_forecast_' + dealerId;
  var localData = localStorage.getItem(key);
  
  if (localData) {
    try {
      var data = JSON.parse(localData);
      var monthLabel = formatMonthKeyToLabel(monthKey);
      var totalQty = 0;
      var items = [];
      
      for (var i = 0; i < (data.runrate || []).length; i++) {
        var rr = data.runrate[i];
        if (rr.month === monthLabel) {
          totalQty += rr.qty;
          items.push({ model: rr.model, qty: rr.qty, type: 'runrate' });
        }
      }
      
      for (var i = 0; i < (data.projects || []).length; i++) {
        var proj = data.projects[i];
        if (proj.month === monthLabel) {
          for (var j = 0; j < proj.items.length; j++) {
            var it = proj.items[j];
            totalQty += it.qty;
            items.push({ model: it.model, qty: it.qty, type: 'project', projectName: proj.projectName });
          }
        }
      }
      
      return { totalQty: totalQty, items: items };
    } catch(e) {}
  }
  
  return { totalQty: 0, items: [] };
}

function rForecastComparison(el) {
  document.getElementById('pgT').textContent = '📊 เปรียบเทียบ Forecast';
  
  var monthOptions = getMonthOptionsForCompare();
  var dealers = ST.getAll('dealers');
  
  var h = '<div class="card">';
  h += '<h2>📊 เปรียบเทียบ Forecast ลูกค้า vs Pipeline</h2>';
  h += '<div class="fr" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">';
  
  // Month selector
  h += '<div class="fg"><label>📅 เดือน</label><select id="fcMonth" onchange="refreshForecastComparison()" style="min-width:100px">';
  for (var i = 0; i < monthOptions.length; i++) {
    h += '<option value="' + monthOptions[i].value + '"' + (fcCompareMonth === monthOptions[i].value ? ' selected' : '') + '>' + monthOptions[i].label + '</option>';
  }
  h += '</select></div>';
  
  // Mode selector (Shipment/Bidding/Register)
  h += '<div class="fg"><label>📊 ใช้ข้อมูลจาก</label><select id="fcMode" onchange="refreshForecastComparison()" style="min-width:140px">';
  h += '<option value="shipment"' + (fcCompareMode === 'shipment' ? ' selected' : '') + '>🚚 Shipment Date (วันส่งมอบ)</option>';
  h += '<option value="bidding"' + (fcCompareMode === 'bidding' ? ' selected' : '') + '>📋 Bidding Date (วันยื่นซอง)</option>';
  h += '<option value="register"' + (fcCompareMode === 'register' ? ' selected' : '') + '>📅 Register Date (วันลงทะเบียน)</option>';
  h += '</select></div>';
  
  // Dealer filter
  h += '<div class="fg"><label>🏪 Dealer</label><select id="fcDealer" onchange="refreshForecastComparison()" style="min-width:150px">';
  h += '<option value="all">-- ทุก Dealer --</option>';
  for (var i = 0; i < dealers.length; i++) {
    h += '<option value="' + dealers[i].id + '">' + sanitize(dealers[i].name) + '</option>';
  }
  h += '</select></div>';
  
  // Export button
  h += '<div class="fg"><button class="btn bp" onclick="exportForecastComparison()">📤 Export CSV</button></div>';
  h += '</div>';
  
  // Summary cards
  h += '<div class="sr" style="margin-bottom:16px" id="fcSummaryCards"></div>';
  
  // Main table
  h += '<div style="overflow-x:auto"><table class="export-table" id="fcCompareTable">';
  h += '<thead><tr>';
  h += '<th>🏪 Dealer</th>';
  h += '<th>📦 ลูกค้าแจ้ง</th>';
  h += '<th>📊 Pipeline</th>';
  h += '<th>📊 ต่าง (ชิ้น)</th>';
  h += '<th>📍 สถานะ</th>';
  h += '<th></th>';
  h += '</thead>';
  h += '<tbody id="fcCompareBody"></tbody>';
  h += '</table></div>';
  
  h += '<div class="hint" style="margin-top:8px">💡 ลูกค้าแจ้ง = Run Rate + Project (จากหน้า Client View) | Pipeline = โครงการในระบบ</div>';
  h += '</div>';
  
  el.innerHTML = h;
  refreshForecastComparison();
}

function refreshForecastComparison() {
  var monthSelect = document.getElementById('fcMonth');
  var modeSelect = document.getElementById('fcMode');
  var dealerSelect = document.getElementById('fcDealer');
  
  if (monthSelect) fcCompareMonth = monthSelect.value;
  if (modeSelect) fcCompareMode = modeSelect.value;
  if (dealerSelect) fcCompareDealer = dealerSelect.value;
  
  var dealers = ST.getAll('dealers');
  var monthLabel = formatMonthKeyToLabel(fcCompareMonth);
  
  // Filter dealer if needed
  if (fcCompareDealer !== 'all') {
    dealers = dealers.filter(function(d) { return d.id === fcCompareDealer; });
  }
  
  var rows = '';
  var totalClientQty = 0;
  var totalPipelineQty = 0;
  var dealerDetails = [];
  
  for (var i = 0; i < dealers.length; i++) {
    var d = dealers[i];
    var clientFc = getClientForecastByMonth(d.id, fcCompareMonth);
    var pipelineFc = getPipelineForecastByMonth(d.id, fcCompareMode, fcCompareMonth);
    
    var diff = clientFc.totalQty - pipelineFc.totalQty;
    totalClientQty += clientFc.totalQty;
    totalPipelineQty += pipelineFc.totalQty;
    
    var statusClass = diff === 0 ? 'c2' : (diff > 0 ? 'c3' : 'c4');
    var statusText = diff === 0 ? '✅ ตรงกัน' : (diff > 0 ? '⚠️ ลูกค้าคาดหวังมากกว่า' : '❌ Pipeline มากกว่า');
    
    // Store for summary
    dealerDetails.push({
      name: d.name,
      level: d.level,
      clientQty: clientFc.totalQty,
      pipelineQty: pipelineFc.totalQty,
      diff: diff,
      status: statusText
    });
    
    var clientItemsHtml = '';
    if (clientFc.items.length > 0) {
      clientItemsHtml = '<div style="font-size:10px;color:var(--text3);margin-top:2px">';
      for (var j = 0; j < Math.min(clientFc.items.length, 3); j++) {
        clientItemsHtml += clientFc.items[j].model + ' x' + clientFc.items[j].qty;
        if (j < Math.min(clientFc.items.length, 3) - 1) clientItemsHtml += ', ';
      }
      if (clientFc.items.length > 3) clientItemsHtml += '...';
      clientItemsHtml += '</div>';
    }
    
    var pipelineItemsHtml = '';
    if (pipelineFc.items.length > 0) {
      pipelineItemsHtml = '<div style="font-size:10px;color:var(--text3);margin-top:2px">';
      for (var j = 0; j < Math.min(pipelineFc.items.length, 3); j++) {
        pipelineItemsHtml += pipelineFc.items[j].model + ' x' + pipelineFc.items[j].qty;
        if (j < Math.min(pipelineFc.items.length, 3) - 1) pipelineItemsHtml += ', ';
      }
      if (pipelineFc.items.length > 3) pipelineItemsHtml += '...';
      pipelineItemsHtml += '</div>';
    }
    
    rows += '<tr>';
    rows += '<td><strong>' + sanitize(d.name) + '</strong> ' + levelTag(d.level) + '</td>';
    rows += '<td>' + (clientFc.totalQty > 0 ? clientFc.totalQty + ' ชิ้น' : '-') + clientItemsHtml + '</td>';
    rows += '<td>' + (pipelineFc.totalQty > 0 ? pipelineFc.totalQty + ' ชิ้น' : '-') + pipelineItemsHtml + '</td>';
    rows += '<td class="' + statusClass + '" style="font-weight:700">' + (diff !== 0 ? (diff > 0 ? '+' + diff : diff) : '-') + '</td>';
    rows += '<td><span class="tag ' + (diff === 0 ? 'tag-completed' : (diff > 0 ? 'tag-active' : 'tag-lost')) + '">' + statusText + '</span></td>';
    rows += '<td><button class="btn bsm bo" onclick="goToDealerForecast(\'' + d.id + '\')">ดูรายละเอียด</button></td>';
    rows += '</tr>';
  }
  
  // Summary row
  var totalDiff = totalClientQty - totalPipelineQty;
  rows += '<tr style="font-weight:700;border-top:2px solid var(--border)">';
  rows += '<td><strong>📊 รวมทั้งหมด</strong></td>';
  rows += '<td><strong>' + totalClientQty + ' ชิ้น</strong></td>';
  rows += '<td><strong>' + totalPipelineQty + ' ชิ้น</strong></td>';
  rows += '<td class="' + (totalDiff === 0 ? 'c2' : (totalDiff > 0 ? 'c3' : 'c4')) + '">' + (totalDiff !== 0 ? (totalDiff > 0 ? '+' + totalDiff : totalDiff) : '-') + '</td>';
  rows += '<td><span class="tag ' + (totalDiff === 0 ? 'tag-completed' : (totalDiff > 0 ? 'tag-active' : 'tag-lost')) + '">' + (totalDiff === 0 ? '✅ ตรงกัน' : (totalDiff > 0 ? '⚠️ ลูกค้าคาดหวังรวมมากกว่า' : '❌ Pipeline รวมมากกว่า')) + '</span></td>';
  rows += '<td></td>';
  rows += '</tr>';
  
  var tbody = document.getElementById('fcCompareBody');
  if (tbody) tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center">ไม่มีข้อมูล</td></tr>';
  
  // Update summary cards
  updateSummaryCards(dealerDetails, totalClientQty, totalPipelineQty, totalDiff, monthLabel);
}

function updateSummaryCards(dealerDetails, totalClient, totalPipeline, totalDiff, monthLabel) {
  var container = document.getElementById('fcSummaryCards');
  if (!container) return;
  
  var dealerWithDiff = [];
  for (var i = 0; i < dealerDetails.length; i++) {
    if (dealerDetails[i].diff !== 0) {
      dealerWithDiff.push(dealerDetails[i]);
    }
  }
  
  var html = '';
  html += '<div class="sc"><div class="sn c2">' + totalClient + '</div><div class="sl">ลูกค้าแจ้ง (' + monthLabel + ')</div></div>';
  html += '<div class="sc"><div class="sn c1">' + totalPipeline + '</div><div class="sl">Pipeline (' + monthLabel + ')</div></div>';
  html += '<div class="sc"><div class="sn ' + (totalDiff === 0 ? 'c2' : (totalDiff > 0 ? 'c3' : 'c4')) + '">' + (totalDiff !== 0 ? (totalDiff > 0 ? '+' + totalDiff : totalDiff) : '0') + '</div><div class="sl">ส่วนต่าง</div></div>';
  html += '<div class="sc"><div class="sn c5">' + dealerWithDiff.length + '</div><div class="sl">Dealer ที่ต่าง</div></div>';
  
  container.innerHTML = html;
}

function goToDealerForecast(dealerId) {
  go('dealerDetail', { dealerId: dealerId, tab: 'forecast' });
}

function exportForecastComparison() {
  var month = fcCompareMonth;
  var mode = fcCompareMode;
  var dealers = ST.getAll('dealers');
  var monthLabel = formatMonthKeyToLabel(month);
  var modeLabel = mode === 'shipment' ? 'Shipment Date' : (mode === 'bidding' ? 'Bidding Date' : 'Register Date');
  
  var csv = '\uFEFF"Dealer","Level","ลูกค้าแจ้ง (ชิ้น)","Pipeline (ชิ้น)","ต่าง","สถานะ"\n';
  
  for (var i = 0; i < dealers.length; i++) {
    var d = dealers[i];
    var clientFc = getClientForecastByMonth(d.id, month);
    var pipelineFc = getPipelineForecastByMonth(d.id, mode, month);
    var diff = clientFc.totalQty - pipelineFc.totalQty;
    var statusText = diff === 0 ? 'ตรงกัน' : (diff > 0 ? 'ลูกค้าคาดหวังมากกว่า' : 'Pipeline มากกว่า');
    csv += '"' + d.name + '","' + (d.level || '-') + '","' + clientFc.totalQty + '","' + pipelineFc.totalQty + '","' + diff + '","' + statusText + '"\n';
  }
  
  dlBlob(csv, 'forecast-comparison-' + monthLabel + '-' + modeLabel + '.csv');
}

// ================================================================
// เปิดหน้า Dealer Detail ที่แท็บ Forecast
// ================================================================
function goToDealerForecast(dealerId) {
  S.dealerId = dealerId;
  S.tab = 'forecast';
  go('dealerDetail', { dealerId: dealerId });
  // หลังจาก render แล้วให้เปลี่ยนแท็บ
  setTimeout(function() {
    dealerTab = 'forecast';
    if (typeof render === 'function') render();
  }, 100);
}
// ===== SYNC WITH GOOGLE SHEETS =====
function syncFirebaseToSheets() {
  if (!SHEETS_API_URL || SHEETS_API_URL.indexOf('YOUR_WEB_APP_URL') !== -1) {
    toast('❌ กรุณาตั้งค่า SHEETS_API_URL ก่อน');
    return;
  }
  
  if (!confirm('📤 ส่งข้อมูลจาก Firebase ไปยัง Google Sheets?\n\nข้อมูล Pipeline ทั้งหมดจะถูกส่งไป Sheets')) {
    return;
  }
  
  toast('🔄 กำลัง Sync ข้อมูล...');
  
  var dealers = ST.getAll('dealers');
  var pipelines = ST.getAll('pipeline');
  
  fetch(SHEETS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'syncFromFirebase',
      dealers: dealers,
      pipelines: pipelines
    })
  })
  .then(function(res) { return res.json(); })
  .then(function(result) {
    if (result.success) {
      toast('✅ Sync ไป Google Sheets สำเร็จ!');
    } else {
      toast('❌ Sync ล้มเหลว: ' + (result.data?.error || 'Unknown error'));
    }
  })
  .catch(function(err) {
    toast('❌ Error: ' + err.message);
  });
}

function pullSheetsToFirebase() {
  if (!SHEETS_API_URL || SHEETS_API_URL.indexOf('YOUR_WEB_APP_URL') !== -1) {
    toast('❌ กรุณาตั้งค่า SHEETS_API_URL ก่อน');
    return;
  }
  
  if (!confirm('📥 ดึงข้อมูลจาก Google Sheets มาแทนที่ Firebase?\n\nข้อมูล Pipeline ในระบบจะถูกเพิ่มจาก Sheets')) {
    return;
  }
  
  toast('🔄 กำลังดึงข้อมูล...');
  
  fetch(SHEETS_API_URL + '?action=getAllData')
    .then(function(res) { return res.json(); })
    .then(function(result) {
      if (result.success && result.data) {
        var pipelineData = result.data.pipeline || [];
        var added = 0;
        
        for (var i = 0; i < pipelineData.length; i++) {
          var p = pipelineData[i];
          // ตรวจสอบว่ามี id นี้ในระบบแล้วหรือยัง
          var existing = ST.getOne('pipeline', p.id);
          if (!existing && p.dealerId && p.projectName) {
            ST.add('pipeline', {
              id: p.id,
              projectName: p.projectName,
              dealerId: p.dealerId,
              endUserTH: p.endUser || '',
              status: p.status || 'prospect',
              model: p.model || '',
              modelQty: parseInt(p.qty) || 1,
              forecastAmount: parseFloat(p.amount) || 0,
              created: new Date().toISOString()
            });
            added++;
          }
        }
        
        toast('✅ ดึงข้อมูลจาก Sheets สำเร็จ! เพิ่ม ' + added + ' โครงการ');
        render(); // รีเฟรชหน้า
      } else {
        toast('❌ ไม่มีข้อมูลใน Sheets');
      }
    })
    .catch(function(err) {
      toast('❌ Error: ' + err.message);
    });
}
// ================================================================
// CUSTOMER UPDATE LISTENER & APPROVAL
// ================================================================

var customerUpdateListener = null;

function initCustomerUpdateListener() {
  if (!CURRENT_USER) return;
  
  if (customerUpdateListener) customerUpdateListener();
  
  customerUpdateListener = db.collection('dealerUpdates').onSnapshot(function(snapshot) {
    snapshot.docChanges().forEach(function(change) {
      if (change.type === 'added' || change.type === 'modified') {
        var dealerId = change.doc.id;
        var dealer = ST.getOne('dealers', dealerId);
        
        // ตรวจสอบ pipeline updates
        change.doc.ref.collection('pipeline').where('_status', '==', 'pending').get().then(function(querySnapshot) {
          querySnapshot.forEach(function(pipeDoc) {
            var update = pipeDoc.data();
            showCustomerNotification(dealerId, dealer?.name, update.projectName, 'pipeline', pipeDoc.id);
          });
        });
        
        // ตรวจสอบ forecast updates
        change.doc.ref.collection('forecast').where('_status', '==', 'pending').get().then(function(querySnapshot) {
          querySnapshot.forEach(function(fcDoc) {
            var update = fcDoc.data();
            var typeName = update.type === 'runrate' ? 'Run Rate' : 'โครงการ';
            showCustomerNotification(dealerId, dealer?.name, typeName, 'forecast', fcDoc.id);
          });
        });
      }
    });
  });
}

function showCustomerNotification(dealerId, dealerName, projectName, type, updateId) {
  var msg = `📥 ${dealerName || dealerId} อัพเดท${type === 'pipeline' ? 'โครงการ' : 'แผนสั่งซื้อ'}: ${projectName}`;
  
  // Toast notification
  toast(msg);
  
  // LINE Notify (ถ้าตั้งค่าไว้)
  sendLineNotify(msg);
  
  // Save to localStorage for badge
  var updates = JSON.parse(localStorage.getItem('v7_customer_updates') || '[]');
  updates.unshift({
    id: updateId,
    dealerId: dealerId,
    dealerName: dealerName || dealerId,
    projectName: projectName,
    type: type,
    timestamp: new Date().toISOString(),
    read: false
  });
  localStorage.setItem('v7_customer_updates', JSON.stringify(updates.slice(0, 50)));
  
  // Update badge
  updateCustomerUpdateBadge();
}

function updateCustomerUpdateBadge() {
  var updates = JSON.parse(localStorage.getItem('v7_customer_updates') || '[]');
  var unread = updates.filter(function(u) { return !u.read; }).length;
  var badge = document.getElementById('customerUpdateBadge');
  if (badge) {
    if (unread > 0) {
      badge.textContent = unread;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  }
}

function sendLineNotify(message) {
  // ถ้ามี LINE Notify token ให้ส่ง
  var token = localStorage.getItem('line_notify_token');
  if (!token) return;
  
  fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'message=' + encodeURIComponent(message)
  }).catch(function(e) { console.warn('LINE Notify error:', e); });
}

// หน้า Approve Updates
function rCustomerUpdates(el) {
  document.getElementById('pgT').textContent = '📥 คำขออัพเดทจากลูกค้า';
  
  var updates = JSON.parse(localStorage.getItem('v7_customer_updates') || '[]');
  
  if (!updates.length) {
    el.innerHTML = '<div class="card"><div class="empty"><div class="icon">📭</div><p>ไม่มีคำขออัพเดทจากลูกค้า</p></div></div>';
    return;
  }
  
  var html = '<div class="card"><h2>📥 คำขออัพเดทจากลูกค้า</h2>';
  
  for (var i = 0; i < updates.length; i++) {
    var u = updates[i];
    html += '<div class="li" style="border-left:3px solid #f59e0b">';
    html += '<div class="lm">';
    html += '<div class="lt">🏪 ' + sanitize(u.dealerName) + ' - ' + (u.type === 'pipeline' ? '📋 โครงการ' : '📦 แผนสั่งซื้อ') + '</div>';
    html += '<div class="ls">📌 ' + sanitize(u.projectName) + '</div>';
    html += '<div class="ls">⏰ ' + fD(u.timestamp?.split('T')[0]) + '</div>';
    html += '</div>';
    html += '<button class="btn bsm bp" onclick="approveCustomerUpdate(\'' + u.id + '\', \'' + u.dealerId + '\', \'' + u.type + '\')">✅ ตรวจสอบและนำเข้า</button>';
    html += '</div>';
  }
  
  html += '</div>';
  el.innerHTML = html;
}

function approveCustomerUpdate(updateId, dealerId, type) {
  if (!CURRENT_USER) return;
  
  if (type === 'pipeline') {
    var pipelineRef = db.collection('dealerUpdates').doc(dealerId).collection('pipeline').doc(updateId);
    pipelineRef.get().then(function(doc) {
      if (!doc.exists) return;
      var data = doc.data();
      
      // ลบ metadata
      delete data._customerUpdate;
      delete data._updatedAt;
      delete data._status;
      delete data._originalDealerId;
      delete data._originalPipeId;
      delete data._updateType;
      delete data.updateNote;
      delete data.updatedBy;
      
      // นำเข้า pipeline หลัก
      var mainRef = db.collection('users').doc(CURRENT_USER.uid).collection('pipeline').doc(updateId);
      mainRef.set(data, { merge: true }).then(function() {
        // อัพเดทสถานะเป็น approved
        pipelineRef.update({ _status: 'approved', _approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
        
        // อัพเดท localStorage
        var updates = JSON.parse(localStorage.getItem('v7_customer_updates') || '[]');
        updates = updates.filter(function(u) { return u.id !== updateId; });
        localStorage.setItem('v7_customer_updates', JSON.stringify(updates));
        
        toast('✅ นำเข้าข้อมูลเรียบร้อยแล้ว');
        updateCustomerUpdateBadge();
        render();
        
        // รีเฟรชหน้า updates
        go('customerUpdates');
      });
    });
  }
}

// เพิ่มเมนูใน sidebar
// ในฟังก์ชัน renderSidebar หรือเพิ่มใน admin.js:
function addCustomerUpdateMenuItem() {
  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  
  var menuHtml = '<div class="nl" onclick="go(\'customerUpdates\')">📥 คำขออัพเดท <span class="nb" id="customerUpdateBadge" style="display:none">0</span></div>';
  var insertAfter = document.querySelector('.nl[data-v="insights"]');
  if (insertAfter) {
    insertAfter.insertAdjacentHTML('afterend', menuHtml);
  }
}

// เรียกใช้ตอน init
setTimeout(addCustomerUpdateMenuItem, 1000);

function dealerInfoTab(d) {
  const pipes = ST.pipelineByDealer(d.id);
  const wonAmt = pipes.filter(p => ['win','ordered','delivered'].includes(p.status)).reduce((a,p) => a + (Number(p.forecastAmount)||0), 0);
  const targetAmt = Number(d.targetRevenue) || 0;
  const pct = targetAmt ? Math.round(wonAmt / targetAmt * 100) : 0;
  const h = calcHealthScore(d.id);
  const lcd = ST.getLastContactDays(d.id);
  const lvd = ST.getLastVisitDays(d.id);

  // Health color
  const healthColor = h.level === 'good' ? '#22c55e' : h.level === 'warn' ? '#f59e0b' : '#ef4444';
  
  // Cert badges
  const certs = [
    { name: 'DSEC', status: d.dsecStatus, pass: d.dsecStatus === 'pass' },
    { name: 'CRM', status: d.crmStatus, pass: d.crmStatus === 'yes' },
    { name: 'FH2', status: d.fh2Status, pass: d.fh2Status === 'pass' },
    { name: 'Lark', status: d.larkStatus, pass: d.larkStatus === 'added' }
  ];

  return `
  <!-- Hero Section -->
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

  <!-- Stats Row -->
  <div class="sr" style="margin-bottom: 20px">
    <div class="sc"><div class="sn c2">${fmtMoneyShort(wonAmt)}</div><div class="sl">ยอดขาย Won</div></div>
    <div class="sc"><div class="sn c3">${fmtMoneyShort(targetAmt)}</div><div class="sl">เป้ายอดขาย</div></div>
    <div class="sc"><div class="sn ${pct >= 70 ? 'c2' : pct >= 40 ? 'c3' : 'c4'}">${pct}%</div><div class="sl">Achievement</div></div>
    <div class="sc"><div class="sn c1">${pipes.filter(p => !['lost','delivered','on_hold'].includes(p.status)).length}</div><div class="sl">Pipeline Active</div></div>
  </div>

  <!-- Main Info Grid -->
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px">
    
    <!-- Company Info Card -->
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

    <!-- Contact Card -->
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

    <!-- Business Card -->
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

    <!-- Certification Card -->
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

  <!-- Health Score Detail -->
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

  <!-- Notes & Payment -->
  ${(d.paymentCondition || d.notes) ? `
  <div class="card">
    <h2>📝 หมายเหตุเพิ่มเติม</h2>
    ${d.paymentCondition ? `<div style="margin-bottom: 8px"><label style="font-size: 11px; color: var(--text2)">เงื่อนไขชำระเงิน</label><div style="font-size: 13px; white-space: pre-wrap">${sanitize(d.paymentCondition)}</div></div>` : ''}
    ${d.notes ? `<div><label style="font-size: 11px; color: var(--text2)">หมายเหตุ</label><div style="font-size: 13px; white-space: pre-wrap">${sanitize(d.notes)}</div></div>` : ''}
  </div>
  ` : ''}

  ${renderDealerContacts(d)}

  <!-- LINE Log -->
  <div class="card">
    <h2>💬 LINE Support <span class="ml"><button class="btn bsm bp" onclick="showLineLogM('${d.id}')">➕</button></span></h2>
    ${renderLineLog(d.id, 5)}
  </div>
  
  <!-- Customer Updates Panel -->
  <div id="customerUpdatesPanel"></div>
  `;
}