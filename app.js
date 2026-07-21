// ===== GOOGLE SHEETS API CONFIG =====
var SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbzl71mCGeEJyvRq6xxyqvbcDSJzb49NCxZRj76DsLZNoX4FVcoNk9EEHLJ9dJ1ghpf6WA/exec';  // <--- เปลี่ยนเป็น URL จากขั้นตอนที่ 1.4

// ===== GEMINI AI CONFIG =====
// โหลดจาก Firestore (ตั้งค่าที่ ⚙️ ตั้งค่า → ☁️ เชื่อมต่อ → Gemini AI)
// ปิดฟีเจอร์ AI ไว้ก่อน (ยังไม่ได้ใช้งานจริง + Firestore rules เปิดกว้างอยู่ ป้องกัน key หลุดโดยไม่โหลดเข้า client เลย)
// เปิดกลับได้ด้วยการตั้งเป็น true เมื่อพร้อมใช้งานจริง (แนะนำให้ย้ายไปเรียกผ่าน Cloud Functions/proxy ก่อนเปิด)
var AI_FEATURES_ENABLED = false;
var GEMINI_API_KEY = '';
var GEMINI_PROXY_URL = '';

// ===== LEAD FORM EMAIL CONFIG =====
var LEAD_EMAIL_API_URL = '';

// เรียก Gemini — ผ่าน proxy URL (Apps Script) ถ้ามี ไม่งั้นใช้ key ตรง
async function askGemini(prompt) {
  try {
    var res, data;
    if (GEMINI_PROXY_URL) {
      res = await fetch(GEMINI_PROXY_URL, {
        method: 'POST',
        body: JSON.stringify({ prompt: prompt })
      });
      data = await res.json();
      if (!data.ok) { toast('❌ AI: ' + (data.error || 'error')); return null; }
      return (data.text || '').trim();
    } else if (GEMINI_API_KEY) {
      res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      );
      data = await res.json();
      if (!res.ok) { toast('❌ AI: ' + ((data.error && data.error.message) || res.status)); return null; }
      return ((data.candidates[0].content.parts[0].text) || '').trim();
    } else {
      toast('❌ ยังไม่ได้ตั้งค่า Gemini — ไปที่ ⚙️ ตั้งค่า → ☁️ เชื่อมต่อ');
      return null;
    }
  } catch (e) {
    console.warn('askGemini failed:', e);
    toast('❌ เชื่อมต่อ AI ไม่ได้');
    return null;
  }
}

// ===== AI CHAT PANEL =====
var _aiHistory = [];

function toggleAiChat() {
  var panel = document.getElementById('aiChatPanel');
  if (!panel) return;
  var isOpen = panel.classList.contains('open');
  if (isOpen) { panel.classList.remove('open'); return; }
  panel.classList.add('open');
  if (!_aiHistory.length) _aiRenderMsgs();
  setTimeout(function() {
    var inp = document.getElementById('aiChatInput');
    if (inp) inp.focus();
  }, 200);
}

function _aiRenderMsgs() {
  var el = document.getElementById('aiChatMsgs');
  if (!el) return;
  if (!_aiHistory.length) {
    el.innerHTML = '<div class="ai-welcome">สวัสดีครับ 👋 ถามหรือสั่งงานได้เลย เช่น<br>"สรุป pipeline เดือนนี้" หรือ "lead form มีกี่คน"</div>';
    return;
  }
  el.innerHTML = _aiHistory.map(function(m) {
    return '<div class="ai-msg ai-msg-' + m.role + '">' +
      '<div class="ai-bubble">' + (m.role === 'user' ? sanitize(m.text) : m.text.replace(/\n/g, '<br>')) + '</div>' +
      '</div>';
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function sendAiMsg() {
  var inp = document.getElementById('aiChatInput');
  if (!inp) return;
  var text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  inp.disabled = true;

  _aiHistory.push({ role: 'user', text: text });
  _aiRenderMsgs();

  // สร้าง context จากข้อมูลในแอป
  var ctx = '';
  try {
    var pipes = ST.getAll('pipeline');
    var dealers = ST.getAll('dealers');
    if (pipes.length) {
      var statusCnt = {};
      pipes.forEach(function(p) { statusCnt[p.status] = (statusCnt[p.status] || 0) + 1; });
      ctx += 'Pipeline (' + pipes.length + ' รายการ): ' + Object.keys(statusCnt).map(function(s){ return s+'='+statusCnt[s]; }).join(', ') + '\n';
    }
    if (dealers.length) ctx += 'Dealers: ' + dealers.length + ' บริษัท\n';
  } catch(e) {}

  var systemCtx = ctx ? ('ข้อมูลปัจจุบันในระบบ:\n' + ctx + '\n') : '';
  var historyText = _aiHistory.slice(-6, -1).map(function(m){ return (m.role==='user'?'User':'AI') + ': ' + m.text; }).join('\n');
  var fullPrompt = 'คุณเป็นผู้ช่วย AI สำหรับทีมขาย B2B ตอบเป็นภาษาไทยกระชับ ตรงประเด็น\n' +
    systemCtx + (historyText ? 'บทสนทนาก่อนหน้า:\n' + historyText + '\n\n' : '') +
    'User: ' + text;

  var reply = await askGemini(fullPrompt);
  inp.disabled = false;
  inp.focus();
  if (!reply) return;
  _aiHistory.push({ role: 'ai', text: reply });
  _aiRenderMsgs();
}

function clearAiChat() {
  _aiHistory = [];
  _aiRenderMsgs();
}

// helper: สลับปุ่มเป็นสถานะโหลด แล้วคืนค่าเดิมเมื่อเสร็จ
function _aiBtnBusy(btn, busyText) {
  if (!btn) return function(){};
  var orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = busyText || '⏳ กำลังประมวลผล...';
  return function(){ btn.disabled = false; btn.innerHTML = orig; };
}

// ===== ปีงบประมาณไทย (Thai Fiscal Year) =====
// ปีงบ = 1 ต.ค. ถึง 30 ก.ย. ปีถัดไป, เรียกชื่อด้วย พ.ศ. ปีที่สิ้นสุด
// คืนปีงบ (พ.ศ.) จากวันที่ ISO 'YYYY-MM-DD' (ปี ค.ศ.) — null ถ้าไม่มีวันที่
function thaiFYFromISO(iso) {
  if (!iso) return null;
  var s = String(iso).split('T')[0].split('-');
  if (s.length < 2) return null;
  var y = parseInt(s[0], 10), m = parseInt(s[1], 10);
  if (isNaN(y) || isNaN(m)) return null;
  return ((m >= 10) ? y + 1 : y) + 543;
}
function currentThaiFY() {
  var d = new Date();
  return ((d.getMonth() + 1 >= 10) ? d.getFullYear() + 1 : d.getFullYear()) + 543;
}
function fyEndISO(fyBE) { return (fyBE - 543) + '-09-30'; }     // วันสุดท้ายของปีงบ (ค.ศ.)
// dropdown options: ปีงบ cur-1 .. cur+3
function fyOptionsHTML(selectedFY, autoFY) {
  var cur = currentThaiFY();
  var sel = selectedFY || autoFY || '';
  var html = '<option value="">— ไม่ระบุ —</option>';
  for (var fy = cur - 1; fy <= cur + 3; fy++) {
    var hint = (fy === autoFY && !selectedFY) ? ' (เดาให้)' : '';
    html += '<option value="' + fy + '"' + (String(sel) === String(fy) ? ' selected' : '') + '>ปีงบ ' + fy + ' (ต.ค.' + String(fy - 1).slice(-2) + '–ก.ย.' + String(fy).slice(-2) + ')' + hint + '</option>';
  }
  return html;
}
// สถานะโฟกัสตามปีงบ — คืน {e,t,c} หรือ null
function pipeFYStatus(p) {
  var fy = p.budgetFiscalYear || thaiFYFromISO(p.expectedCloseDate || p.biddingDate);
  if (!fy) return null;
  fy = parseInt(fy, 10);
  var cur = currentThaiFY();
  if (fy < cur) return { e: '🔴', t: 'ปีงบ ' + fy + ' (เลยแล้ว)', c: '#ef4444' };
  if (fy > cur) return { e: '🔵', t: 'ปีงบ ' + fy + ' (ปีหน้า)', c: '#3b82f6' };
  var closeISO = p.expectedCloseDate || p.biddingDate || '';
  var endISO = fyEndISO(fy);
  if (closeISO && closeISO > endISO) return { e: '🔴', t: 'เสี่ยงตกปีงบหน้า', c: '#ef4444' };
  var days = Math.ceil((new Date(endISO) - new Date()) / 86400000);
  if (days <= 90) return { e: '🟡', t: 'เร่ง! ปลายปีงบ ' + fy, c: '#f59e0b' };
  return { e: '🟢', t: 'ทันงบปีนี้ (' + fy + ')', c: '#22c55e' };
}

// ===== ตัวเลขเงิน: คอมมา + ทศนิยม 2 ตำแหน่ง =====
// แปลงค่าจาก input (ที่อาจมี ",") กลับเป็นตัวเลขจริง — ใช้ตอนบันทึกแทน parseFloat
function parseNum(v) {
  if (v == null) return 0;
  var n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
// จัดรูปแบบค่าเริ่มต้นใส่ใน input (คอมมา + 2 ทศนิยม) — '' ถ้าว่าง
function nmI(v) {
  if (v === '' || v == null) return '';
  var n = parseFloat(String(v).replace(/,/g, ''));
  if (isNaN(n)) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// จัดรูปแบบสดระหว่างพิมพ์ (ใส่คอมมา, รักษาตำแหน่ง caret)
function _moneyLiveFmt(el) {
  var sel = el.selectionStart || 0;
  var digitsBefore = el.value.slice(0, sel).replace(/[^0-9]/g, '').length;
  var raw = el.value.replace(/[^0-9.]/g, '');
  var p = raw.split('.');
  var intp = p[0] || '';
  var dec = p.length > 1 ? '.' + p.slice(1).join('').slice(0, 2) : '';
  var intFmt = intp.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  el.value = intFmt + dec;
  var pos = 0, cnt = 0;
  while (pos < el.value.length && cnt < digitsBefore) { if (/[0-9]/.test(el.value[pos])) cnt++; pos++; }
  try { el.setSelectionRange(pos, pos); } catch (_) {}
}
// จัดให้เหลือ 2 ทศนิยมตอนออกจากช่อง
function _moneyBlurFmt(el) {
  var raw = el.value.replace(/,/g, '').trim();
  if (raw === '' || raw === '.') { el.value = ''; return; }
  var n = parseFloat(raw);
  el.value = isNaN(n) ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// ต่อ listener ครั้งเดียว (delegation) — คุมทุก input.js-money ที่ render ภายหลัง
if (typeof document !== 'undefined') {
  document.addEventListener('input', function(e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('js-money')) _moneyLiveFmt(t);
  });
  document.addEventListener('focusout', function(e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('js-money')) _moneyBlurFmt(t);
  });
}
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

  // ===== PARTNER LEVEL REQUIREMENTS =====
  levelRequirements: {
    S: {
      name: 'S (Strategic Partner)',
      h1Target: 27000000,
      dsecRequired: 3,
      demoRequired: 'both',
      option1Models: ['DJI Matrice 350 RTK', 'DJI Matrice 400', 'DJI Matrice 4E', 'DJI Matrice 4T', 'DJI Zenmuse H30T', 'DJI Zenmuse L2', 'DJI Zenmuse L3'],
      option2Models: ['DJI Dock 2', 'DJI Dock 3', 'DJI Matrice 4TD']
    },
    A: {
      name: 'A (Authorized Partner)',
      h1Target: 4500000,
      dsecRequired: 1,
      demoRequired: 'either',
      option1Models: ['DJI Matrice 350 RTK', 'DJI Matrice 400', 'DJI Matrice 4E', 'DJI Matrice 4T', 'DJI Zenmuse H30T', 'DJI Zenmuse L2'],
      option2Models: ['DJI Dock 2', 'DJI Matrice 4TD']
    },
    B: {
      name: 'B (Basic Partner)',
      h1Target: 1500000,
      dsecRequired: 1,
      demoRequired: 'either',
      option1Models: ['DJI Matrice 4E', 'DJI Matrice 4T'],
      option2Models: ['DJI Dock 2']
    },
    Other: {
      name: 'Other (Trial Partner)',
      h1Target: 0,
      dsecRequired: 0,
      demoRequired: 'none',
      option1Models: [],
      option2Models: []
    }
  },
  
  // ===== NEW DEMO POLICIES (รองรับหลายรายการ) =====
  newDemoPolicies: [],

  // ===== SALES LINK PERMISSIONS (เมนู/แหล่งข้อมูลที่ลิงก์เซล PIN เข้าถึงได้ — ดู SALES_LINK_MENU_GROUPS) =====
  salesLinkPermissions: {
    allowedMenus: ['today','dealers','pipeline','pipeBoard','pipeDash','salesOrders','serialSearch',
      'tasks','kanban','prospectList','visitPlan','notes','meetings','calendar','announcements',
      'forecastComparison','visits','followup','forecast','report','dashboard',
      'leads','contactLogs','lineMessage','emailDraftQuick','emailDrafts','presentation','feedback',
      'products','productPrices','productBundles','productDemo',
      'kpi','customKpi','monthlyGoal','demoTracker','kpiScorecard','quotationV2','knowledge',
      'reminders'],
    dataMode: {
      dealers: 'shared', pipeline: 'shared',
      products: 'readonly', levelRequirements: 'readonly',
      visits: 'private', tasks: 'private', quotations: 'private', notes: 'private'
    }
  },

  // ===== H1 PERIOD =====
  h1Period: {
    startMonth: 0,
    startDay: 1,
    endMonth: 5,
    endDay: 30
  },

  // models: ลบ list default ทิ้งแล้ว — ให้ดึงจาก Products.getAll() (หน้า "สินค้าและราคา" / v7_products) แทนเสมอ

  pipelineStatuses: [
    {id:'initial',     name:'01 Initial',     color:'#eab308', category:'active'},
    {id:'on_process',  name:'02 On process',  color:'#f97316', category:'active'},
    {id:'draft_tor',   name:'03 Draft TOR',   color:'#f9a8d4', category:'active'},
    {id:'bidding',     name:'04 Bidding',     color:'#94a3b8', category:'active'},
    {id:'win',         name:'05 Win',         color:'#22c55e', category:'won'},
    {id:'fail_lost',   name:'05 Fail & Lost', color:'#ef4444', category:'lost'},
    {id:'contracting', name:'06 Contracting', color:'#0f766e', category:'won'},
    {id:'deliver',     name:'07 Deliver',     color:'#6366f1', category:'won'}
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

function getStatusIdsByCategory(cat) {
  return (getConfig().pipelineStatuses || []).filter(function(s) { return s.category === cat; }).map(function(s) { return s.id; });
}
function pipeIsActive(p) { return getStatusIdsByCategory('active').indexOf(p.status) !== -1; }
function pipeIsWon(p)    { return getStatusIdsByCategory('won').indexOf(p.status) !== -1; }
function pipeIsLost(p)   { return getStatusIdsByCategory('lost').indexOf(p.status) !== -1; }
// "open" = ยังไม่ปิด — ไม่ใช่ lost และไม่ใช่ส่งมอบแล้ว (deliver)
function pipeIsOpen(p)   { return !pipeIsLost(p) && p.status !== 'deliver'; }

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
var navHistory = [];

// เปิดจากแท็บแยก (openVisitWindow) — ?visitWindow=1&dealerId=...&eid=... → เด้งไปหน้า Visit แบบแยกซ้าย/ขวาทันทีตอนเปิด
(function() {
  var qp = new URLSearchParams(location.search);
  if (qp.get('visitWindow') === '1') {
    window._vwDealerId = qp.get('dealerId') || '';
    window._vwEid = qp.get('eid') || '';
    window._vwPlanId = qp.get('planId') || '';
    window._vwMode = qp.get('mode') || '';
    S.view = 'visitWindow';
  }
  if (qp.get('meetingWindow') === '1') {
    window._mwId = qp.get('meetingId') || '';
    S.view = 'meetingWindow';
  }
})();

// แท็บอื่นบันทึก Visit แล้ว ให้แท็บนี้รีเฟรชข้อมูลอัตโนมัติ (ไม่ต้องกดรีเฟรชเอง)
if (typeof BroadcastChannel !== 'undefined') {
  try {
    var _djiSyncChannel = new BroadcastChannel('djisales_sync');
    _djiSyncChannel.onmessage = function(e) {
      if (e.data && e.data.type === 'visitSaved') {
        if (typeof render === 'function') render();
        if (typeof toast === 'function') toast('🔄 มี Visit ใหม่จากแท็บอื่น — อัปเดตแล้ว');
      }
    };
  } catch (e) {}
}

var calY = new Date().getFullYear();
var calM = new Date().getMonth();
var taskFlt = 'all';
var mtFlt = 'all';
var kbFilter = 'all';
var pipeFlt = 'all';
var visitFlt = 'all';

// Soft refresh: re-render หน้าเดิม + ดึงข้อมูลล่าสุด (ไม่รีโหลดทั้งหน้า ไม่เสีย state)
function softRefresh() {
  try {
    if (typeof SYNC_ENABLED !== 'undefined' && SYNC_ENABLED && typeof initFirebaseListeners === 'function') {
      initFirebaseListeners();
    }
  } catch (e) { console.warn('softRefresh sync error:', e); }
  if (typeof render === 'function') render();
  if (typeof toast === 'function') toast('🔄 รีเฟรชแล้ว');
}

// รวม id เมนูหลักทั้งหมดที่มี checkbox ในหน้า "สิทธิ์ลิงก์เซล" (SALES_LINK_MENU_GROUPS ใน admin.js)
// ใช้แยกว่า view ไหนต้องเช็คสิทธิ์ (เมนูหลักจริงๆ) กับ view ไหนเป็นหน้ารายละเอียดย่อยที่ปล่อยผ่านเสมอ
// (เข้าถึงได้ก็ต่อเมื่อเปิดจากเมนูหลักที่อนุญาตอยู่แล้ว เช่น dealerDetail มาจาก dealers)
function _salesLinkAllMenuIds() {
  var ids = [];
  (typeof SALES_LINK_MENU_GROUPS !== 'undefined' ? SALES_LINK_MENU_GROUPS : []).forEach(function(g) {
    g.items.forEach(function(it) { ids.push(it.id); });
  });
  return ids;
}

function _salesLinkMenuBlocked(view) {
  if (typeof SALES_MODE === 'undefined' || !SALES_MODE) return false;
  if (_salesLinkAllMenuIds().indexOf(view) === -1) return false;
  var cfg = getConfig();
  var allowed = (cfg.salesLinkPermissions && cfg.salesLinkPermissions.allowedMenus) || [];
  return allowed.indexOf(view) === -1;
}

// ซ่อนรายการเมนูใน sidebar ที่ไม่ได้อยู่ใน allowedMenus — เรียกครั้งเดียวหลัง login สำเร็จในโหมดลิงก์เซล
function applySalesLinkMenuGating() {
  if (typeof SALES_MODE === 'undefined' || !SALES_MODE) return;
  var cfg = getConfig();
  var allowed = (cfg.salesLinkPermissions && cfg.salesLinkPermissions.allowedMenus) || [];
  var allIds = _salesLinkAllMenuIds();
  document.querySelectorAll('.nl[data-v]').forEach(function(el) {
    var v = el.dataset.v;
    if (allIds.indexOf(v) !== -1 && allowed.indexOf(v) === -1) el.style.display = 'none';
  });
}

function go(v, p) {
  if (!p) p = {};
  if (_salesLinkMenuBlocked(v)) {
    if (typeof toast === 'function') toast('⛔ ไม่มีสิทธิ์เข้าเมนูนี้');
    return;
  }
  if (S && S.view) {
    navHistory.push(JSON.parse(JSON.stringify(S)));
    if (navHistory.length > 30) navHistory.shift();
  }
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

function goBack() {
  var prev = navHistory.pop();
  if (!prev) return;
  S = prev;
  render();
  var navs = document.querySelectorAll('[data-v]');
  for (var i = 0; i < navs.length; i++) {
    if (navs[i].dataset.v === S.view) navs[i].classList.add('act');
    else navs[i].classList.remove('act');
  }
  window.scrollTo(0, 0);
}

function render() {
  var el = document.getElementById('ct');
var R = {
  customKpi: rCustomKPI,
  today: rToday, 
  kpi: rKPI,
  report: rWeeklyReport, 
  dashboard: rDashboard, 
  health: rDataHealth,
  customerUpdates: rCustomerUpdates,
  customerUpdateHistory: rCustomerUpdateHistory,
  customerForecastUpdates: rCustomerForecastUpdates,
  customerForecastSummary: rCustomerForecastSummary,
  dealers: rDealers, 
  dealerDetail: rDealerDet,
  pipeDash: rPipeDashboard,
  contactLogs: rContactLogs,
  pipeline: rPipeline, 
  pipeBoard: rPipeBoard, 
  pipeDetail: rPipeDet,
  forecastComparison: rForecastComparison, 
  forecast: rForecast,
  visits: rVisits,
  visitDetail: rVisitDet,
  visitWindow: rVisitWindow,
  followup: rFollowup, 
  feedback: rFeedback,
  kanban: rKanban, 
  meetings: rMeetings,
  meetingDetail: rMeetDet,
  meetingWindow: rMeetingWindow,
  calendar: rCalendar,
  monthlyGoal: rMonthlyGoal,
  demoTracker: rDemoTracker,
  kpiScorecard: rKpiScorecard,
  demoDetail: rDemoDetail,
  quotations: rQuotations,
  visitPlan: rVisitPlan, 
  emailDrafts: rEmailDrafts,
  exports: rExports,
  reminders: rRemind, 
  insights: rInsights,
  auditLog: rAuditLog,
  admin: rAdmin,
  tasks: rUnifiedTasks, 
  taskDetail: rTaskDet,
  smartFilter: rSmartFilter,
  notes: rNotes,
  knowledge: rKnowledge,
  noteDetail: rNoteDet,
  
  // ✅ เพิ่มตรงนี้
  products: rProducts,
  productPrices: rProductPrices,
  productBundles: rProductBundles,
  productDemo: rProductDemo,
  productImport: rProductImport,
  
  // ✅ เพิ่ม Quotation V2
  quotationV2: rQuotationV2,
  quoteEstimator: rQuoteEstimator,
  marginAnalysis: rMarginAnalysis,

  // ✅ Announcement & Policy
  announcements: rAnnouncements,

  // ✅ Lead Forms
  leads: rLeads,

  // ✅ Lead/Prospect Tracker
  prospectList: rProspectList,

  // ✅ Sales Order
  salesOrders: rSalesOrders,
  soDetail: rSODetail,
  serialSearch: rSerialSearch
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

function toggleSidebarCollapse() {
  var collapsed = document.body.classList.toggle('sb-collapsed');
  localStorage.setItem('sb_collapsed', collapsed ? '1' : '0');
  var btn = document.querySelector('.collapse-btn');
  if (btn) btn.textContent = collapsed ? '▶' : '◀';
}
(function() {
  if (localStorage.getItem('sb_collapsed') === '1') {
    document.body.classList.add('sb-collapsed');
    document.addEventListener('DOMContentLoaded', function() {
      var btn = document.querySelector('.collapse-btn');
      if (btn) btn.textContent = '▶';
    });
  }
})();

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
      _resetMWidth();
    }
  } else {
    document.getElementById('modal').classList.remove('show');
    _resetMWidth();
  }
}

function closeMForce() {
  document.getElementById('modal').classList.remove('show');
  _resetMWidth();
}

// ใช้กับ modal ที่ต้องการกว้างกว่าปกติ (เช่น preview import) — เรียกหลัง openM() แล้วรีเซ็ตอัตโนมัติตอนปิด
function setMWide(px) {
  var mlb = document.querySelector('.mlb');
  if (mlb) mlb.style.maxWidth = px + 'px';
}
function _resetMWidth() {
  var mlb = document.querySelector('.mlb');
  if (mlb) mlb.style.maxWidth = '';
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
  // \ = toggle sidebar (skip when typing in input/textarea)
  if (e.key === '\\' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      e.preventDefault(); toggleSidebarCollapse();
    }
  }
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
  var bid = ST.filter('pipeline', function(p) { return p.biddingDate && dTo(p.biddingDate) >= 0 && dTo(p.biddingDate) <= 1 && pipeIsOpen(p); }).length;
  var wait = ST.filter('waiting', function(w) { return !w.resolved && w.dueDate && dTo(w.dueDate) < 0; }).length;
  var meet = ST.filter('meetings', function(m) { return dTo(m.date) >= 0 && dTo(m.date) <= 1; }).length;
  var action = ST.filter('pipeline', function(p) { return p.followupDate && dTo(p.followupDate) <= 0 && pipeIsOpen(p); }).length;
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
  var pipes = ST.pipelineByDealer(dealerId).filter(function(p) { return pipeIsOpen(p); });
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
  var won = ST.pipelineByDealer(dealerId).filter(function(p) { return pipeIsWon(p); }).reduce(function(a,p) { return a + (Number(p.forecastAmount)||0); }, 0);
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
    if (['fail_lost'].indexOf(s.id) === -1) totalPipeline += amount;
    if (getStatusIdsByCategory('won').indexOf(s.id) !== -1) totalWon += amount;
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
    if (!pipeIsOpen(p)) return false;
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
    {id:'bidding_soon', icon:'⏳', name:'Bidding สัปดาห์นี้', count:ST.filter('pipeline',function(p){return p.biddingDate&&isInRange(p.biddingDate,w.start,w.end)&&pipeIsOpen(p);}).length, color:'#f59e0b'},
    {id:'stale_pipeline', icon:'🔄', name:'Pipeline ไม่อัพเดต 14d', count:getStalePipelines().length, color:'#94a3b8'},
    {id:'big_projects', icon:'💰', name:'Project ≥ 1.5M', count:ST.filter('pipeline',function(p){return Number(p.forecastAmount)>=1500000&&pipeIsOpen(p);}).length, color:'#22c55e'},
    {id:'waiting_overdue', icon:'📭', name:'รอคนอื่น (เลยกำหนด)', count:ST.filter('waiting',function(w2){return !w2.resolved&&w2.dueDate&&dTo(w2.dueDate)<0;}).length, color:'#ef4444'},
    {id:'no_contact_14d', icon:'📞', name:'ไม่ติดต่อ > 14d', count:ST.getAll('dealers').filter(function(d){var days=ST.getLastContactDays(d.id);return days===null||days>14;}).length, color:'#ef4444'},
    {id:'need_action', icon:'🎯', name:'ต้องทำ Next Action', count:ST.filter('pipeline',function(p){return p.followupDate&&dTo(p.followupDate)<=3&&pipeIsOpen(p);}).length, color:'#3b82f6'},
    {id:'low_health', icon:'🏥', name:'Dealer Health ต่ำ', count:ST.getAll('dealers').filter(function(d){return calcHealthScore(d.id).score<40;}).length, color:'#ef4444'}
  ];
}

// ================================================================
// SMART INSIGHTS
// ================================================================
function generateInsights() {
  var insights = []; var pipes = ST.getAll('pipeline'); var dealers = ST.getAll('dealers'); var m = getMonthRange();
  var totalClosed = pipes.filter(function(p){return pipeIsWon(p) || pipeIsLost(p);}).length;
  var totalWon = pipes.filter(function(p){return pipeIsWon(p);}).length;
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
  var bids = ST.filter('pipeline',function(p){return p.biddingDate&&dTo(p.biddingDate)>=0&&dTo(p.biddingDate)<=14&&pipeIsOpen(p);});
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
    var won = ST.pipelineByDealer(d.id).filter(function(p){return pipeIsWon(p);}).reduce(function(a,p){return a+(Number(p.forecastAmount)||0);},0);
    var pipeActive = ST.pipelineByDealer(d.id).filter(function(p){return pipeIsOpen(p);}).reduce(function(a,p){return a+(Number(p.forecastAmount)||0);},0);
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
    if (pipeIsWon(p)) { wonAmt+=amt; wonCount++; }
    else if (p.status==='fail_lost') { lostAmt+=amt; lostCount++; }
    else if (true) { activeAmt+=amt; activeCount++; }

    var did = p.dealerId||'unknown';
    if (!byDealer[did]) byDealer[did]={count:0,amount:0,won:0};
    byDealer[did].count++; byDealer[did].amount+=amt;
    if (pipeIsWon(p)) byDealer[did].won+=amt;

    if (p.biddingDate && pipeIsActive(p) && dTo(p.biddingDate)>=0 && dTo(p.biddingDate)<=30) biddingSoon.push(p);
    if (pipeIsOpen(p)) {
      var logs = ST.pipeLogsByPipe(p.id);
      var lastDate = logs.length ? logs[0].date : p.created||'';
      if (lastDate) { var ds = daysBetween(lastDate.split('T')[0], _td()); if (ds>14) needUpdate.push({pipe:p,days:ds}); }
    }
    if (p.followupDate && dTo(p.followupDate)<=3 && pipeIsOpen(p)) needAction.push(p);
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
    return p.biddingDate && dTo(p.biddingDate) === 1 && pipeIsOpen(p);
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
    return p.followupDate && dTo(p.followupDate) === 0 && pipeIsOpen(p);
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
  if (typeof syncToFirebase === 'function') syncToFirebase('appearance', settings);
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

// ================================================================
// APP MENU REGISTRY — single source of truth ให้ Favorites / Ctrl+K search / Edit-favorites ใช้ร่วมกัน
// เพิ่มเมนูใหม่ในแอป ให้เพิ่มที่นี่ที่เดียว จะโผล่ครบทั้ง 3 จุดอัตโนมัติ
// ⚠️ ต้องอยู่ก่อน INIT (ก่อนเรียก render() ครั้งแรก) — render() → renderFavorites() ใช้ตัวแปรนี้ทันทีตอนโหลดหน้า
// ================================================================
var APP_MENU_REGISTRY = [
  {id: 'today', icon: '📌', name: 'วันนี้'},
  {id: 'dealers', icon: '🏪', name: 'Dealers'},
  {id: 'pipeline', icon: '📊', name: 'Pipeline'},
  {id: 'pipeBoard', icon: '📋', name: 'Pipeline Board'},
  {id: 'pipeDash', icon: '📊', name: 'Pipeline Overview'},
  {id: 'salesOrders', icon: '📦', name: 'Sales Order'},
  {id: 'serialSearch', icon: '🔍', name: 'ค้นหา Serial'},
  {id: 'tasks', icon: '📋', name: 'Tasks'},
  {id: 'prospectList', icon: '🆕', name: 'Lead ที่ติดตาม'},
  {id: 'visitPlan', icon: '📅', name: 'Visit Plan'},
  {id: 'notes', icon: '📓', name: 'Note'},
  {id: 'meetings', icon: '📅', name: 'ประชุม'},
  {id: 'calendar', icon: '📆', name: 'ปฏิทิน'},
  {id: 'announcements', icon: '📢', name: 'ประกาศ'},
  {id: 'forecastComparison', icon: '📊', name: 'เปรียบเทียบ Forecast'},
  {id: 'visits', icon: '🤝', name: 'Visit Report'},
  {id: 'followup', icon: '📞', name: 'Follow-up'},
  {id: 'forecast', icon: '📦', name: 'Forecast'},
  {id: 'report', icon: '📊', name: 'Weekly Report'},
  {id: 'dashboard', icon: '📈', name: 'Dashboard'},
  {id: 'leads', icon: '📋', name: 'Lead Forms'},
  {id: 'contactLogs', icon: '📞', name: 'ศูนย์ติดต่อ'},
  {id: 'emailDrafts', icon: '📧', name: 'Email Draft'},
  {id: 'feedback', icon: '💡', name: 'Feedback'},
  {id: 'products', icon: '📋', name: 'สินค้าทั้งหมด'},
  {id: 'productPrices', icon: '💰', name: 'ราคาตาม Level'},
  {id: 'productBundles', icon: '🎁', name: 'Bundle/Combo'},
  {id: 'productDemo', icon: '🚁', name: 'Demo Unit'},
  {id: 'productImport', icon: '📥', name: 'Import/Export สินค้า'},
  {id: 'kpi', icon: '🎯', name: 'KPI'},
  {id: 'customKpi', icon: '🎯', name: 'KPI Dashboard'},
  {id: 'monthlyGoal', icon: '🎯', name: 'Monthly Goal'},
  {id: 'demoTracker', icon: '🚁', name: 'Demo Equipment'},
  {id: 'kpiScorecard', icon: '📊', name: 'KPI เซลล์'},
  {id: 'quotationV2', icon: '💰', name: 'Quotation V2'},
  {id: 'quoteEstimator', icon: '💡', name: 'ประเมินราคาคร่าวๆ'},
  {id: 'marginAnalysis', icon: '📊', name: 'Margin Analysis'},
  {id: 'knowledge', icon: '📚', name: 'Knowledge'},
  {id: 'exports', icon: '📤', name: 'Export'},
  {id: 'health', icon: '🏥', name: 'Data Health'},
  {id: 'reminders', icon: '🔔', name: 'แจ้งเตือน'},
  {id: 'insights', icon: '🤖', name: 'Insights'},
  {id: 'customerUpdateHistory', icon: '📜', name: 'ประวัติอัพเดท'},
  {id: 'customerForecastUpdates', icon: '📦', name: 'แผนซื้อลูกค้า'},
  {id: 'customerForecastSummary', icon: '📊', name: 'สรุป Forecast ลูกค้า'},
  {id: 'auditLog', icon: '📜', name: 'Audit Log'},
  {id: 'admin', icon: '⚙️', name: 'ตั้งค่า'}
];
// action shortcut พิเศษ (ไม่ใช่ go() route) — ใช้เฉพาะในหน้าเลือก favorites
var APP_MENU_ACTIONS = [
  {id: 'line', icon: '💬', name: 'LINE Message', action: "openLineTemplates()"},
  {id: 'presentation', icon: '🎬', name: 'Presentation', action: "openPresentation()"}
];

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

// ดึงราคาสินค้าจาก catalog จริง (หน้า "สินค้าและราคา" / v7_products) ไม่ใช่ list default อีกต่อไป
function getModelPrice(modelName) {
  var p = (typeof Products !== 'undefined' && Products.getByName) ? Products.getByName(modelName) : null;
  return p ? (Number(p.price) || 0) : 0;
}

// Get model options HTML (for dropdowns) — ดึงจาก catalog จริงเท่านั้น ถ้ายังไม่มีสินค้าใน catalog เลยจะว่างเปล่า (กรอกเองได้อิสระ)
function modelOptionsNew(selected) {
  var products = (typeof Products !== 'undefined' && Products.getAll) ? Products.getAll() : [];
  var h = '<option value="">-- เลือก Model --</option>';
  for (var i = 0; i < products.length; i++) {
    var m = products[i];
    var price = Number(m.price) || 0;
    var label = m.name + (price > 0 ? ' (฿' + fmtMoney(price) + ')' : '');
    h += '<option value="' + sanitize(m.name) + '"' + (selected === m.name ? ' selected' : '') + '>' + sanitize(label) + '</option>';
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
  var ALL_MENU_ITEMS = APP_MENU_REGISTRY.concat(APP_MENU_ACTIONS);

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
  // favorites เป็น plain array ไม่ใช่ array-of-objects — ต้องเซฟแบบ _data doc เท่านั้น
  try {
    if (typeof db !== 'undefined' && CURRENT_USER && SYNC_ENABLED) {
      db.collection('users').doc(CURRENT_USER.uid).collection('favorites').doc('_data').set({ value: list });
    }
  } catch(e) {}
}

function renderFavorites() {
  var favs = getFavorites();
  var el = document.getElementById('sbFavorites');
  if (!el) return;

  var h = '';
  var byId = {};
  APP_MENU_REGISTRY.concat(APP_MENU_ACTIONS).forEach(function(m) { byId[m.id] = m; });

  for (var i = 0; i < favs.length; i++) {
    var favId = favs[i];
    var item = byId[favId];
    var name = item ? (item.icon + ' ' + item.name) : favId;
    var isActive = S && S.view === favId;
    var onclick = (item && item.action) ? item.action : "go('" + favId + "')";
    h += '<div class="sb-fav-item' + (isActive ? ' act' : '') + '" onclick="' + onclick + '">';
    h += name;
    h += '</div>';
  }

  el.innerHTML = h;
}

// ================================================================
// QUICK MENU — home page action buttons (configurable)
// ================================================================
var ALL_QUICK_ITEMS = [
  {id:'addVisit',    icon:'🤝', name:'เพิ่ม Visit',    action:'showVisitM()'},
  {id:'addTask',     icon:'📋', name:'เพิ่มงาน',       action:'showTaskM()'},
  {id:'addPipe',     icon:'📊', name:'เพิ่ม Pipeline', action:'showPipelineM()'},
  {id:'quickNote',   icon:'📝', name:'Quick Note',      action:'showQNote()'},
  {id:'addNote',     icon:'📓', name:'เพิ่ม Note',      action:"showAddNoteM()"},
  {id:'line',        icon:'💬', name:'LINE Message',    action:'openLineTemplates()'},
  {id:'visitPlan',   icon:'📅', name:'Visit Plan',      action:"go('visitPlan')"},
  {id:'notes',       icon:'📓', name:'Note',            action:"go('notes')"},
  {id:'pipeline',    icon:'📊', name:'Pipeline',        action:"go('pipeline')"},
  {id:'dealers',     icon:'🏪', name:'Dealers',         action:"go('dealers')"},
  {id:'tasks',       icon:'📋', name:'Tasks',           action:"go('tasks')"},
  {id:'visits',      icon:'🤝', name:'Visit Report',    action:"go('visits')"},
  {id:'followup',    icon:'📞', name:'Follow-up',       action:"go('followup')"},
  {id:'report',      icon:'📊', name:'Weekly Report',   action:"go('report')"},
  {id:'dashboard',   icon:'📈', name:'Dashboard',       action:"go('dashboard')"},
  {id:'calendar',    icon:'📆', name:'ปฏิทิน',         action:"go('calendar')"},
  {id:'customKpi',   icon:'🎯', name:'KPI',             action:"go('customKpi')"},
  {id:'kpiScorecard',icon:'📊', name:'KPI เซลล์',      action:"go('kpiScorecard')"},
  {id:'demoTracker', icon:'🚁', name:'Demo',            action:"go('demoTracker')"},
  {id:'quotations',  icon:'💰', name:'Quotation',       action:"go('quotations')"},
  {id:'knowledge',   icon:'📚', name:'Knowledge',       action:"go('knowledge')"},
  {id:'emailDrafts', icon:'📧', name:'Email Draft',     action:"go('emailDrafts')"},
  {id:'forecast',    icon:'📦', name:'Forecast',        action:"go('forecast')"},
  {id:'exports',     icon:'📤', name:'Export',          action:"go('exports')"},
  {id:'admin',       icon:'⚙️', name:'ตั้งค่า',        action:"go('admin')"}
];

function getQuickMenu() {
  var saved = localStorage.getItem('v7_quickMenu');
  if (saved) { try { return JSON.parse(saved); } catch(e) {} }
  return ['addVisit','addTask','addPipe','quickNote','line','visitPlan'];
}

function saveQuickMenu(list) {
  localStorage.setItem('v7_quickMenu', JSON.stringify(list));
}

function showEditQuickMenu() {
  var cur = getQuickMenu();
  var h = '<div style="max-width:400px">';
  h += '<div style="font-size:13px;color:var(--text2);margin-bottom:10px">กดเลือกปุ่มที่ต้องการในหน้าหลัก (แนะนำ 4-8 ปุ่ม)</div>';
  ALL_QUICK_ITEMS.forEach(function(item) {
    var on = cur.indexOf(item.id) !== -1;
    h += '<div class="fav-edit-item" onclick="toggleQMItem(\'' + item.id + '\',this)">';
    h += '<input type="checkbox"' + (on ? ' checked' : '') + ' onclick="event.stopPropagation();toggleQMItem(\'' + item.id + '\',this.parentElement)">';
    h += '<span>' + item.icon + ' ' + item.name + '</span>';
    h += '</div>';
  });
  h += '<div class="fm-actions" style="margin-top:12px">';
  h += '<button class="btn btn-blue" onclick="saveQMFromModal()">💾 บันทึก</button>';
  h += '<button class="btn" onclick="closeM()">ยกเลิก</button>';
  h += '</div></div>';
  openM('⚡ ตั้งค่า Quick Menu', h);
}

function toggleQMItem(itemId, el) {
  var chk = el.querySelector('input[type=checkbox]');
  if (chk) chk.checked = !chk.checked;
}

function saveQMFromModal() {
  var checks = document.querySelectorAll('.fav-edit-item input[type=checkbox]:checked');
  var list = [];
  for (var i = 0; i < checks.length; i++) {
    var parent = checks[i].parentElement;
    var onclick = parent.getAttribute('onclick') || '';
    var match = onclick.match(/toggleQMItem\('([^']+)'/);
    if (match) list.push(match[1]);
  }
  saveQuickMenu(list);
  toast('⚡ บันทึก Quick Menu แล้ว');
  closeMForce();
  render();
}

function renderQuickMenuButtons() {
  var cur = getQuickMenu();
  var map = {};
  ALL_QUICK_ITEMS.forEach(function(x) { map[x.id] = x; });
  return cur.map(function(id) {
    var item = map[id];
    if (!item) return '';
    return '<div class="mb-action-btn" onclick="' + item.action + '"><span class="mb-action-icon">' + item.icon + '</span>' + item.name + '</div>';
  }).join('');
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
  
  // ดึงจาก registry กลาง (APP_MENU_REGISTRY) ให้ครบทุกเมนู ไม่ตกหล่นเวลาเพิ่มเมนูใหม่
  var navs = APP_MENU_REGISTRY.map(function(m) {
    return { icon: m.icon, name: m.name, cmd: 'go:' + m.id };
  });
  
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
    return pipeIsOpen(p); 
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

  // Quick Actions (configurable)
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  h += '<div style="font-size:11px;color:var(--text2);font-weight:600">⚡ QUICK MENU</div>';
  h += '<button class="btn bsm bo" style="font-size:10px;padding:2px 6px" onclick="showEditQuickMenu()">✏️ ตั้งค่า</button>';
  h += '</div>';
  h += '<div class="mb-actions">' + renderQuickMenuButtons() + '</div>';

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
    if (!pipeIsOpen(p)) continue;
    
    var pipeMonth = null;
    if (dateField === 'shipment') {
      // ✅ ใช้ Shipment จริง > Bidding + 2 เดือน (tentative) เหมือน client-view
      var _sh = (typeof getPipeShipDate === 'function') ? getPipeShipDate(p) : null;
      if (!_sh) continue;
      if (fcHideTentative && _sh.est) continue;
      pipeMonth = _sh.date.getFullYear() + '-' + String(_sh.date.getMonth() + 1).padStart(2, '0');
    } else {
      var targetDate = (dateField === 'bidding') ? p.biddingDate : p.registerDate;
      if (!targetDate) continue;
      var parts = String(targetDate).split('-');
      if (parts.length !== 3) continue;
      pipeMonth = parts[0] + '-' + parts[1];
    }

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
              status: p.status || 'initial',
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
  var _trimmedUpdates = updates.slice(0, 50);
  localStorage.setItem('v7_customer_updates', JSON.stringify(_trimmedUpdates));
  if (typeof syncToFirebase === 'function') syncToFirebase('customerUpdates', _trimmedUpdates);

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

// (dead code ถูกลบแล้ว: rCustomerUpdates เก่า, approveCustomerUpdate, addCustomerUpdateMenuItem เก่า
//  — ถูกแทนด้วยเวอร์ชันใหม่ด้านล่าง/ใน app.js แล้ว)
// ================================================================
// CUSTOMER UPDATES MANAGEMENT (Enhanced with Batch Approve)
// ================================================================

var selectedUpdates = {};  // เก็บสถานะการเลือก

function rCustomerUpdates(el) {
  document.getElementById('pgT').textContent = '📥 คำขออัพเดทจากลูกค้า';
  
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    el.innerHTML = '<div class="card"><div class="empty"><p>กรุณา login เพื่อดูคำขออัพเดท</p></div></div>';
    return;
  }
  
  var dealers = ST.getAll('dealers');
  // โหมดลิงก์เซล (PIN) — เห็นเฉพาะคำขออัพเดทของ Dealer ที่ตัวเองดูแล (เทียบจาก saleName)
  // ไม่ใช่ของ Dealer ทั้งทีมปนกัน (ตกลงกันไว้ตอนวางแผน)
  if (typeof SALES_MODE !== 'undefined' && SALES_MODE && SALES_PROFILE) {
    dealers = dealers.filter(function(d) { return d.saleName === SALES_PROFILE.name; });
  }
  if (!dealers.length) {
    el.innerHTML = '<div class="card"><div class="empty"><p>ไม่มี Dealer ในระบบ</p></div></div>';
    return;
  }

  selectedUpdates = {};
  
  var allUpdates = [];
  var pendingCount = 0;
  
  function checkAllDealers() {
    var promises = dealers.map(function(dealer) {
      return db.collection('dealerUpdates').doc(dealer.id).collection('pipeline')
        .where('_status', '==', 'pending')
        .get()
        .then(function(snapshot) {
          snapshot.forEach(function(doc) {
            var data = doc.data();
            data.id = doc.id;
            data.dealerName = dealer.name;
            data.dealerId = dealer.id;
            allUpdates.push(data);
          });
        })
        .catch(function(err) { 
          console.warn('Error checking dealer:', dealer.name, err);
          return Promise.resolve();
        });
    });
    
    Promise.all(promises).then(function() {
      pendingCount = allUpdates.length;
      
      // อัพเดท badge
      var badge = document.getElementById('customerUpdateBadge');
      if (badge) {
        badge.textContent = pendingCount;
        badge.style.display = pendingCount ? 'inline' : 'none';
      }
      
      if (pendingCount === 0) {
        el.innerHTML = '<div class="card"><div class="empty"><div class="icon">📭</div><p>ไม่มีคำขออัพเดทจากลูกค้า</p></div></div>';
        return;
      }
      
      // จัดกลุ่มตาม Dealer
      var byDealer = {};
      allUpdates.forEach(function(u) {
        if (!byDealer[u.dealerId]) {
          byDealer[u.dealerId] = { dealerName: u.dealerName, updates: [] };
        }
        byDealer[u.dealerId].updates.push(u);
      });
      
      // ✅ เก็บไว้ใน global เพื่อให้ตัวกรองต่อ dealer ทำงานได้
      allUpdatesData = allUpdates;
      currentFilterDealer = 'all';

      var html = '<div class="card"><h2>📥 คำขออัพเดท (' + pendingCount + ')</h2>';

      // ✅ ปุ่ม Batch Actions
      html += '<div class="bg" style="margin-bottom:12px; flex-wrap:wrap">';
      html += '<button class="btn bp" onclick="batchApproveSelected()" style="background:#22c55e">✅ Approve ที่เลือก (' + getSelectedCount() + ')</button>';
      html += '<button class="btn bs" onclick="batchApproveAll()" style="background:#3b82f6">✅ Approve ทั้งหมด (' + pendingCount + ')</button>';
      html += '<button class="btn bsm bo" onclick="toggleSelectAll()">☑️ เลือกทั้งหมด</button>';
      html += '<button class="btn bsm bo" onclick="clearSelection()">✖️ ยกเลิกเลือก</button>';
      html += '<button class="btn bsm bd" onclick="clearAllUpdateHistory()" style="margin-left:auto">🗑️ ล้างประวัติทั้งหมด</button>';
      html += '</div>';

      // ✅ Filter ตาม Dealer
      html += '<div class="ftabs" style="margin-bottom:12px">';
      html += '<div class="ftab active" data-did="all" onclick="filterUpdatesByDealer(\'all\')">🏪 ทุก Dealer (' + pendingCount + ')</div>';
      var dealerIds = Object.keys(byDealer);
      for (var di = 0; di < dealerIds.length; di++) {
        var did = dealerIds[di];
        var dealer = byDealer[did];
        html += '<div class="ftab" data-did="' + did + '" onclick="filterUpdatesByDealer(\'' + did + '\')">🏪 ' + sanitize(dealer.dealerName) + ' (' + dealer.updates.length + ')</div>';
      }
      html += '</div>';
      
      // ✅ รายการ Updates
      html += '<div id="updatesListContainer">';
      html += renderUpdatesList(allUpdates);
      html += '</div>';
      
      html += '</div>';
      el.innerHTML = html;
    });
  }
  
  checkAllDealers();
}

function renderUpdatesList(updates) {
  if (!updates.length) {
    return '<div class="empty"><p>ไม่มีรายการ</p></div>';
  }
  
  var html = '<div style="max-height:60vh; overflow-y:auto">';
  
  for (var i = 0; i < updates.length; i++) {
    var u = updates[i];
    var isSelected = selectedUpdates[u.id] === true;
    var updateDate = u._updatedAt ? (u._updatedAt.seconds ? new Date(u._updatedAt.seconds * 1000).toLocaleString() : u._updatedAt) : '-';
    
    html += '<div class="li" style="border-left:3px solid #f59e0b; margin-bottom:8px; display:flex; flex-wrap:wrap">';
    
    // ✅ Checkbox
    html += '<div style="margin-right:10px">';
    html += '<input type="checkbox" class="update-checkbox" data-id="' + u.id + '" data-dealer="' + u.dealerId + '" ' + (isSelected ? 'checked' : '') + ' onchange="toggleUpdateSelection(\'' + u.id + '\', this.checked)">';
    html += '</div>';
    
    html += '<div class="lm" style="flex:1; min-width:200px">';
    html += '<div class="lt">🏪 <strong>' + sanitize(u.dealerName) + '</strong> <span class="tag tag-active">รอตรวจสอบ</span></div>';
    html += '<div class="ls">📋 ' + sanitize(u.projectName || '-') + '</div>';
    if (u.updateNote) html += '<div class="ls">📝 ' + sanitize(u.updateNote.substr(0, 100)) + '</div>';
    html += '<div class="ls">⏰ ' + updateDate + '</div>';
    html += '</div>';
    
    html += '<div class="bg" style="flex-shrink:0; margin-top:5px">';
    html += '<button class="btn bsm bs" onclick="approveSingleUpdate(\'' + u.dealerId + '\', \'' + u.id + '\')">✅ อนุมัติ</button>';
    html += '<button class="btn bsm bd" onclick="rejectSingleUpdate(\'' + u.dealerId + '\', \'' + u.id + '\')">❌ ปฏิเสธ</button>';
    html += '<button class="btn bsm bo" onclick="viewPipelineUpdateDetail(\'' + u.dealerId + '\', \'' + u.id + '\')">👁️ รายละเอียด</button>';
    html += '</div>';
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

function getSelectedCount() {
  var count = 0;
  for (var key in selectedUpdates) {
    if (selectedUpdates[key]) count++;
  }
  return count;
}

function toggleUpdateSelection(updateId, isChecked) {
  selectedUpdates[updateId] = isChecked;
  updateBatchButtonBadge();
}

function toggleSelectAll() {
  var checkboxes = document.querySelectorAll('.update-checkbox');
  var allChecked = true;
  
  for (var i = 0; i < checkboxes.length; i++) {
    if (!checkboxes[i].checked) {
      allChecked = false;
      break;
    }
  }
  
  var newState = !allChecked;
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].checked = newState;
    selectedUpdates[checkboxes[i].dataset.id] = newState;
  }
  
  updateBatchButtonBadge();
}

function clearSelection() {
  var checkboxes = document.querySelectorAll('.update-checkbox');
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].checked = false;
    selectedUpdates[checkboxes[i].dataset.id] = false;
  }
  updateBatchButtonBadge();
}

function updateBatchButtonBadge() {
  var count = getSelectedCount();
  var btn = document.querySelector('button[onclick="batchApproveSelected()"]');
  if (btn) {
    btn.innerHTML = '✅ Approve ที่เลือก (' + count + ')';
  }
}

var currentFilterDealer = 'all';
var allUpdatesData = [];

function filterUpdatesByDealer(dealerId) {
  currentFilterDealer = dealerId;

  var container = document.getElementById('updatesListContainer');
  if (!container) { refreshUpdatesList(); return; }

  // กรองรายการตาม dealer ที่เลือก
  var list = (dealerId === 'all')
    ? allUpdatesData
    : allUpdatesData.filter(function(u) { return u.dealerId === dealerId; });

  var html = '';
  // ปุ่มล้างประวัติเฉพาะร้าน (เมื่อเลือก dealer รายเดียว)
  if (dealerId !== 'all') {
    var dn = (list[0] && list[0].dealerName) ? list[0].dealerName : dealerId;
    html += '<div style="margin-bottom:8px"><button class="btn bsm bd" onclick="clearDealerUpdateHistory(\'' + dealerId + '\', \'' + (dn + '').replace(/'/g, '') + '\')">🗑️ ล้างประวัติร้านนี้</button></div>';
  }
  html += renderUpdatesList(list);
  container.innerHTML = html;

  // ไฮไลต์แท็บที่เลือก
  var tabs = document.querySelectorAll('.ftab');
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].getAttribute('data-did') === dealerId) tabs[i].classList.add('active');
    else tabs[i].classList.remove('active');
  }
}

// ================================================================
// CLEAR UPDATE HISTORY (admin / app หลักเท่านั้น)
// ลบ timeline ทั้งหมด + คำขอ _status==pending ใน pipeline และ forecast
// (ไม่แตะ Pipeline หลักที่อนุมัติแล้ว)
// ================================================================
async function _clearDealerHistory(dealerId) {
  var base = db.collection('dealerUpdates').doc(dealerId);
  var batch = db.batch();
  var n = 0;
  var snaps = await Promise.all([
    base.collection('timeline').get(),
    base.collection('pipeline').where('_status', '==', 'pending').get(),
    base.collection('forecast').where('_status', '==', 'pending').get()
  ]);
  snaps.forEach(function(snap) {
    snap.forEach(function(doc) { batch.delete(doc.ref); n++; });
  });
  if (n > 0) await batch.commit();
  return n;
}

async function clearDealerUpdateHistory(dealerId, dealerName) {
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) { toast('❌ ต้อง login ก่อน'); return; }
  if (!confirm('🗑️ ล้างประวัติและคำขอ pending ของ ' + (dealerName || dealerId) + '?\n\nลบ timeline + คำขอที่ยังไม่อนุมัติ (ไม่กระทบ Pipeline หลักที่อนุมัติแล้ว)')) return;
  try {
    var n = await _clearDealerHistory(dealerId);
    toast('🗑️ ล้างประวัติแล้ว (' + n + ' รายการ)');
    rCustomerUpdates(document.getElementById('ct'));
  } catch(e) {
    console.warn('Clear dealer history error:', e);
    toast('❌ ผิดพลาด: ' + e.message);
  }
}

async function clearAllUpdateHistory() {
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) { toast('❌ ต้อง login ก่อน'); return; }
  var dealers = ST.getAll('dealers');
  if (!confirm('🗑️ ล้างประวัติและคำขอ pending ของทุก dealer (' + dealers.length + ' ราย)?\n\nลบ timeline + คำขอที่ยังไม่อนุมัติทั้งหมด (ไม่กระทบ Pipeline หลักที่อนุมัติแล้ว)')) return;
  toast('🔄 กำลังล้างประวัติ...');
  var total = 0, errors = 0;
  for (var i = 0; i < dealers.length; i++) {
    try { total += await _clearDealerHistory(dealers[i].id); }
    catch(e) { errors++; console.warn('Clear history error:', dealers[i].name, e); }
  }
  toast('🗑️ ล้างประวัติทั้งหมดแล้ว (' + total + ' รายการ' + (errors ? ', ผิดพลาด ' + errors + ' ราย' : '') + ')');
  rCustomerUpdates(document.getElementById('ct'));
}

function refreshUpdatesList() {
  // โหลดข้อมูลใหม่ทั้งหมด
  if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) {
    // เรียก rCustomerUpdates ใหม่
    rCustomerUpdates(document.getElementById('ct'));
  }
}

// ✅ Batch Approve Selected
function batchApproveSelected() {
  var selectedIds = [];
  var selectedDealers = {};
  
  for (var updateId in selectedUpdates) {
    if (selectedUpdates[updateId]) {
      // หา dealerId และ updateId จาก DOM
      var checkbox = document.querySelector('.update-checkbox[data-id="' + updateId + '"]');
      if (checkbox) {
        var dealerId = checkbox.dataset.dealer;
        if (!selectedDealers[dealerId]) selectedDealers[dealerId] = [];
        selectedDealers[dealerId].push(updateId);
        selectedIds.push(updateId);
      }
    }
  }
  
  if (selectedIds.length === 0) {
    toast('⚠️ กรุณาเลือกรายการที่ต้องการอนุมัติ');
    return;
  }
  
  if (!confirm('✅ อนุมัติ ' + selectedIds.length + ' รายการ? ข้อมูลจะถูกนำเข้าไปยัง Pipeline หลัก')) return;

  // เรียงคิว dealerId+updateId ทั้งหมดเป็น list เดียว แล้วอนุมัติทีละรายการตามลำดับ (ไม่ยิงพร้อมกัน) กันชนกันตอนหลายรายการแก้ pipeline เดียวกัน
  var queue = [];
  for (var dealerId in selectedDealers) {
    selectedDealers[dealerId].forEach(function(updateId) { queue.push({ dealerId: dealerId, updateId: updateId }); });
  }
  var errors = 0;
  (function next(i) {
    if (i >= queue.length) {
      toast('✅ อนุมัติ ' + (queue.length - errors) + ' รายการ' + (errors ? ' (ผิดพลาด ' + errors + ')' : ''));
      setTimeout(function() {
        if (typeof render === 'function') render();
        else if (typeof rCustomerUpdates === 'function') rCustomerUpdates(document.getElementById('ct'));
      }, 1000);
      return;
    }
    approvePipelineUpdate(queue[i].dealerId, queue[i].updateId, function(success) {
      if (!success) errors++;
      next(i + 1);
    });
  })(0);
}

// ✅ Batch Approve All
function batchApproveAll() {
  var updates = [];
  // รวบรวมทั้งหมดจาก DOM
  var checkboxes = document.querySelectorAll('.update-checkbox');
  for (var i = 0; i < checkboxes.length; i++) {
    updates.push({
      id: checkboxes[i].dataset.id,
      dealerId: checkboxes[i].dataset.dealer
    });
  }
  
  if (updates.length === 0) {
    toast('⚠️ ไม่มีรายการที่ต้องอนุมัติ');
    return;
  }
  
  if (!confirm('✅ อนุมัติทั้งหมด ' + updates.length + ' รายการ?')) return;

  var errors = 0;

  // อนุมัติทีละรายการตามลำดับ (ไม่ยิงพร้อมกัน) กันชนกันตอนหลายรายการแก้ pipeline เดียวกัน
  (function next(i) {
    if (i >= updates.length) {
      toast('✅ อนุมัติทั้งหมด ' + (updates.length - errors) + ' รายการ' + (errors ? ' (ผิดพลาด ' + errors + ')' : ''));
      setTimeout(function() {
        if (typeof render === 'function') render();
      }, 1000);
      return;
    }
    approvePipelineUpdate(updates[i].dealerId, updates[i].id, function(success) {
      if (!success) errors++;
      next(i + 1);
    });
  })(0);
}

// ✅ Approve Single (แก้ไขให้มี callback)
function approveSingleUpdate(dealerId, updateId) {
  approvePipelineUpdate(dealerId, updateId, function(success) {
    if (success) {
      toast('✅ อนุมัติแล้ว');
      setTimeout(function() {
        if (typeof render === 'function') render();
      }, 500);
    }
  });
}

// ✅ Reject Single
function rejectSingleUpdate(dealerId, updateId) {
  if (!confirm('❌ ปฏิเสธคำขอนี้?')) return;
  
  db.collection('dealerUpdates').doc(dealerId).collection('pipeline').doc(updateId)
    .update({ 
      _status: 'rejected', 
      _rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
      _rejectedBy: CURRENT_USER ? CURRENT_USER.uid : 'unknown'
    })
    .then(function() {
      toast('❌ ปฏิเสธคำขอแล้ว');
      setTimeout(function() {
        if (typeof render === 'function') render();
      }, 500);
    })
    .catch(function(err) {
      toast('❌ เกิดข้อผิดพลาด: ' + err.message);
    });
}

// สรุปว่าลูกค้าอัพเดทอะไรบ้าง (ก่อน→หลัง) เป็นข้อความสั้นๆ ให้ Timeline ใน Pipeline อ่านแล้วรู้เรื่องทันที
// แทนที่จะขึ้นแค่ "อัพเดทข้อมูลทั่วไป" เฉยๆ ทุกครั้ง
function _summarizePipelineUpdateChanges(before, after) {
  if (!before) return [];
  var parts = [];

  // เทียบจำนวนต่อ model ใน items[] — ตัวอย่างที่ขอ: "จำนวน M3M"
  var beforeItems = before.items || [];
  var afterItems = after.items || [];
  var qtyByModel = {};
  beforeItems.forEach(function(it) { if (it.model) qtyByModel[it.model] = { before: Number(it.qty) || 0, after: 0 }; });
  afterItems.forEach(function(it) {
    if (!it.model) return;
    if (!qtyByModel[it.model]) qtyByModel[it.model] = { before: 0, after: 0 };
    qtyByModel[it.model].after = Number(it.qty) || 0;
  });
  Object.keys(qtyByModel).forEach(function(model) {
    var q = qtyByModel[model];
    if (q.before !== q.after) parts.push('จำนวน ' + model + ' (' + q.before + '→' + q.after + ')');
  });

  var fieldLabels = {
    status: 'สถานะ', forecastAmount: 'มูลค่า', biddingDate: 'วันประมูล', shipmentDate: 'วันส่งมอบ',
    endUserTH: 'End User', agencyMain: 'หน่วยงานใหญ่', agencySub: 'หน่วยงานย่อย',
    tor: 'TOR', nextAction: 'Next Action', budgetFiscalYear: 'ปีงบประมาณ',
    djiCrmRegistered: 'ลงทะเบียน CRM', hasCompetitor: 'คู่แข่ง'
  };
  Object.keys(fieldLabels).forEach(function(key) {
    var b = before[key], a = after[key];
    if ((b || '') !== (a || '') && !(!b && !a)) parts.push(fieldLabels[key]);
  });

  return parts;
}

// ✅ แก้ไข approvePipelineUpdate ให้มี callback
function approvePipelineUpdate(dealerId, updateId, callback) {
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    if (callback) callback(false);
    toast('❌ กรุณา login ก่อน');
    return;
  }
  
  var updateRef = db.collection('dealerUpdates').doc(dealerId).collection('pipeline').doc(updateId);
  
  updateRef.get().then(function(doc) {
    if (!doc.exists) {
      if (callback) callback(false);
      toast('❌ ไม่พบข้อมูล');
      return;
    }
    
    var updateData = doc.data();
    var pipeId = updateData._originalPipeId || updateId;
    var mainRef = db.collection('users').doc(CURRENT_USER.uid).collection('pipeline').doc(pipeId);
    
    var cleanData = {};
    for (var key in updateData) {
      if (key.indexOf('_') !== 0) {
        cleanData[key] = updateData[key];
      }
    }
    cleanData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    cleanData.lastUpdatedBy = 'customer_approved';
    
    mainRef.set(cleanData, { merge: true }).then(function() {
      // Sync กลับไปยัง dealerUpdates
      var approvedData = {
        id: pipeId,
        projectName: cleanData.projectName || '',
        endUserTH: cleanData.endUserTH || '',
        endUserEN: cleanData.endUserEN || '',
        unitType: cleanData.unitType || '',
        status: cleanData.status || 'initial',
        lastMainStatus: cleanData.lastMainStatus || cleanData.status || 'initial',
        model: cleanData.model || '',
        modelQty: cleanData.modelQty || 1,
        items: cleanData.items || [],
        forecastAmount: cleanData.forecastAmount || 0,
        biddingDate: cleanData.biddingDate || '',
        shipmentDate: cleanData.shipmentDate || '',
        tor: cleanData.tor || '',
        nextAction: cleanData.nextAction || '',
        registerDate: cleanData.registerDate || '',
        _syncedAt: firebase.firestore.FieldValue.serverTimestamp(),
        // ✅ ต้องตั้ง _updatedAt ใหม่ตอนอนุมัติด้วย ไม่งั้นค่าจะค้างจากตอนลูกค้าส่งครั้งแรก
        // (merge:true ไม่ลบ field เดิม) ทำให้ sort "อัพเดทล่าสุด" ใน client-view ผิดลำดับ
        _updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        _status: 'approved',
        _source: 'sales_approved'
      };
      
      return updateRef.set(approvedData, { merge: true });
    }).then(function() {
      var existingPipe = ST.getOne('pipeline', pipeId);
      if (existingPipe) {
        ST.update('pipeline', pipeId, cleanData);
      } else {
        cleanData.id = pipeId;
        ST.add('pipeline', cleanData);
      }
      
      var _changedParts = _summarizePipelineUpdateChanges(updateData._snapshot, cleanData);
      var _summaryText = _changedParts.length ? 'อัพเดท' + _changedParts.join(', ') : '';
      var _noteText = (updateData.updateNote && updateData.updateNote !== 'อัพเดทข้อมูลทั่วไป' && updateData.updateNote !== 'อัพเดทข้อมูลโครงการ') ? updateData.updateNote : '';
      var _finalContent = [_summaryText, _noteText].filter(Boolean).join(' — ') || 'อัพเดทข้อมูลโครงการ';

      ST.add('pipeLog', {
        pipeId: pipeId,
        type: 'update',
        content: '✅ อนุมัติการอัพเดทจากลูกค้า: ' + _finalContent,
        // ✅ เก็บข้อความที่ลูกค้าพิมพ์มาจริงๆ แยกไว้ต่างหาก (ไม่มีสรุปอัตโนมัติ/คำนำหน้า "อนุมัติ...")
        // ให้ export ดึงไปใช้ตรงๆ ได้ ส่วน content เต็มยังใช้โชว์ context ใน timeline ของแอปตามเดิม
        customerNoteOnly: _noteText,
        date: _nw()
      });
// ✅ เพิ่ม Audit Log
var dealer = ST.getOne('dealers', dealerId);
addAuditLog(
  'approve_pipeline',
  'pipeline',
  pipeId,
  cleanData.projectName || '',
  dealerId,
  dealer ? dealer.name : '',
  { oldValue: 'pending', newValue: 'approved', updateNote: updateData.updateNote || '' }
);
      
      if (callback) callback(true);
    }).catch(function(err) {
      if (callback) callback(false);
      toast('❌ เกิดข้อผิดพลาด: ' + err.message);
    });
  }).catch(function(err) {
    if (callback) callback(false);
    toast('❌ เกิดข้อผิดพลาด: ' + err.message);
  });
}
function rejectPipelineUpdate(dealerId, updateId) {
  if (!confirm('❌ ปฏิเสธคำขอนี้?')) return;
  
  db.collection('dealerUpdates').doc(dealerId).collection('pipeline').doc(updateId)
    .update({ 
      _status: 'rejected', 
      _rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
      _rejectedBy: CURRENT_USER ? CURRENT_USER.uid : 'unknown'
    })
    .then(function() {
      toast('❌ ปฏิเสธคำขอแล้ว');
      if (S && S.view === 'customerUpdates') {
        go('customerUpdates');
      } else {
        render();
      }
    })
    .catch(function(err) {
      toast('❌ เกิดข้อผิดพลาด: ' + err.message);
    });
}

function viewPipelineUpdateDetail(dealerId, updateId) {
  db.collection('dealerUpdates').doc(dealerId).collection('pipeline').doc(updateId).get().then(function(doc) {
    if (!doc.exists) return;
    
    var newData = doc.data();
    var pipeId = newData._originalPipeId || updateId;
    var oldPipe = ST.getOne('pipeline', pipeId);
    
    var html = '<div style="max-width:550px">';
    html += '<h3 style="margin-bottom:12px">📋 รายละเอียดคำขออัพเดท</h3>';
    html += '<div style="margin-bottom:12px"><span class="tag tag-active">จาก: ' + sanitize(newData.dealerId || dealerId) + '</span></div>';
    
    if (newData.updateNote) {
      html += '<div style="background:rgba(245,158,11,0.1);padding:10px;border-radius:8px;margin-bottom:12px">';
      html += '<strong>📝 ข้อความอัพเดท:</strong><br>' + sanitize(newData.updateNote);
      html += '</div>';
    }
    
    html += '<table style="width:100%; border-collapse:collapse; font-size:13px">';
    html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:8px">ฟิลด์</th><th style="text-align:left;padding:8px">ข้อมูลเดิม</th><th style="text-align:left;padding:8px">ข้อมูลใหม่</th></tr>';
    
    var fields = [
      { key: 'projectName', label: 'ชื่อโครงการ' },
      { key: 'endUserTH', label: 'End User (TH)' },
      { key: 'endUserEN', label: 'End User (EN)' },
      { key: 'status', label: 'สถานะ' },
      { key: 'model', label: 'Model' },
      { key: 'modelQty', label: 'จำนวน' },
      { key: 'forecastAmount', label: 'มูลค่า' },
      { key: 'biddingDate', label: 'Bidding Date' },
      { key: 'shipmentDate', label: 'Shipment Date' },
      { key: 'tor', label: 'TOR' },
      { key: 'nextAction', label: 'Next Action' }
    ];
    
    fields.forEach(function(f) {
      var oldVal = oldPipe ? (oldPipe[f.key] || '-') : '-';
      var newVal = newData[f.key] || '-';
      var isChanged = String(oldVal) !== String(newVal);
      var highlight = isChanged ? 'style="background:rgba(245,158,11,0.15)"' : '';
      
      html += '<tr ' + highlight + '>';
      html += '<td style="padding:8px">' + f.label + '</td>';
      html += '<td style="padding:8px">' + sanitize(String(oldVal)) + '</td>';
      html += '<td style="padding:8px"><strong>' + sanitize(String(newVal)) + '</strong></td>';
      html += '</tr>';
    });
    
    html += '</table>';
    
    // รายการสินค้า (items)
    if (newData.items && newData.items.length) {
      html += '<div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">';
      html += '<strong>📦 รายการสินค้า:</strong><br>';
      html += '<ul style="margin:6px 0 0 20px">';
      newData.items.forEach(function(it) {
        html += '<li>' + sanitize(it.model) + (it.qty > 1 ? ' x' + it.qty : '') + '</li>';
      });
      html += '</ul></div>';
    }
    
    html += '<div class="fm-actions" style="margin-top:16px">';
    html += '<button class="btn bs" onclick="closeM();approvePipelineUpdate(\'' + dealerId + '\', \'' + updateId + '\')">✅ อนุมัติ</button>';
    html += '<button class="btn bd" onclick="closeM();rejectPipelineUpdate(\'' + dealerId + '\', \'' + updateId + '\')">❌ ปฏิเสธ</button>';
    html += '<button class="btn" onclick="closeM()">ปิด</button>';
    html += '</div></div>';
    
    openM('📋 รายละเอียดคำขออัพเดท', html);
  });
}

// เพิ่ม badge counter อัพเดท
function updateCustomerUpdateBadge() {
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) return;
  
  var dealers = ST.getAll('dealers');
  var pendingCount = 0;
  var checked = 0;
  
  if (!dealers.length) {
    var badge = document.getElementById('customerUpdateBadge');
    if (badge) badge.style.display = 'none';
    return;
  }
  
  dealers.forEach(function(dealer) {
    db.collection('dealerUpdates').doc(dealer.id).collection('pipeline')
      .where('_status', '==', 'pending')
      .get()
      .then(function(snapshot) {
        pendingCount += snapshot.size;
        checked++;
        
        if (checked === dealers.length) {
          var badge = document.getElementById('customerUpdateBadge');
          if (badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount ? 'inline' : 'none';
          }
        }
      })
      .catch(function() {
        checked++;
        if (checked === dealers.length) {
          var badge = document.getElementById('customerUpdateBadge');
          if (badge) badge.style.display = 'none';
        }
      });
  });
}
// ================================================================
// SYNC PIPELINE TO DEALER UPDATES (สำหรับส่งให้ลูกค้าดู)
// ================================================================

function syncDealerPipelineToCustomer(dealerId) {
  if (!dealerId) {
    toast('❌ ไม่พบ Dealer');
    return;
  }
  
  if (!confirm(`🔄 Sync ข้อมูล Pipeline ของ Dealer นี้ไปยังระบบลูกค้า?\n\nลูกค้าจะเห็นข้อมูลทันทีเมื่อเปิดลิงก์`)) {
    return;
  }
  
  toast('🔄 กำลัง Sync...');
  
  var pipes = ST.pipelineByDealer(dealerId);
  var activePipes = pipes.filter(function(p) {
    return pipeIsOpen(p);
  });
  
  if (activePipes.length === 0) {
    toast('⚠️ ไม่มี Pipeline ที่ต้อง Sync (active เท่านั้น)');
    return;
  }
  
  var dealerUpdatesRef = db.collection('dealerUpdates').doc(dealerId).collection('pipeline');
  var activeIds = {};
  activePipes.forEach(function(p) { activeIds[p.id] = true; });

  // ✅ เช็คก่อนว่า Firestore มี doc เก่าตัวไหนที่ไม่ใช่ Active แล้ว (ลบไปแล้ว หรือเปลี่ยนสถานะไม่ active แล้ว)
  // แล้วลบทิ้งไปด้วยพร้อมกันตอน sync — กันข้อมูลค้างที่ client-view ยังเห็นอยู่ทั้งที่ในโปรแกรมไม่มีแล้ว
  dealerUpdatesRef.get().then(function(snapshot) {
    var batch = db.batch();
    var staleCount = 0;
    snapshot.forEach(function(doc) {
      if (!activeIds[doc.id]) { batch.delete(doc.ref); staleCount++; }
    });

    activePipes.forEach(function(p) {
      var latestLog = null;
      var logs = ST.pipeLogsByPipe(p.id);
      if (logs && logs.length) {
        var l = logs[0];
        latestLog = {
          date: l.date ? l.date.split('T')[0] : '',
          content: l.content || ''
        };
      }

      var customerData = {
        id: p.id,
        projectName: p.projectName || '',
        endUserTH: p.endUserTH || '',
        endUserEN: p.endUserEN || '',
        unitType: p.unitType || '',
        status: p.status || 'initial',
        model: p.model || '',
        modelQty: p.modelQty || 1,
        items: p.items || [],
        forecastAmount: p.forecastAmount || 0,
        biddingDate: p.biddingDate || '',
        shipmentDate: p.shipmentDate || '',
        tor: p.tor || '',
        nextAction: p.nextAction || '',
        registerDate: p.registerDate || '',
        pinned: p.pinned || false,
        latestLog: latestLog,
        _syncedAt: firebase.firestore.FieldValue.serverTimestamp(),
        _status: 'approved',
        _source: 'sales_sync'
      };

      batch.set(dealerUpdatesRef.doc(p.id), customerData, { merge: true });
    });

    // ✅ Sync dealer info (name, level, demoOption, demoItems, dsecCertCount, sisRevenue)
    // ข้อมูลเหล่านี้ client-view ต้องการแสดง Partner Status
    var dealer = ST.getOne('dealers', dealerId);
    if (dealer) {
      var dealerDocRef = db.collection('dealerUpdates').doc(dealerId);
      var dealerInfo = {
        name: dealer.name || '',
        level: dealer.level || 'Other',
        demoOption: dealer.demoOption || 'none',
        demoItems: dealer.demoItems || [],
        dsecCertCount: dealer.dsecCertCount || 0,
        dsecStatus: dealer.dsecStatus || '',
        sisRevenue: dealer.sisRevenue || 0,
        sisRevenueH2: dealer.sisRevenueH2 || 0,
        sisRevenueByYear: dealer.sisRevenueByYear || {},
        customDemoRequirements: dealer.customDemoRequirements || { enabled: false },
        _dealerSyncedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      batch.set(dealerDocRef, dealerInfo, { merge: true });
    }

    return batch.commit().then(function() {
      toast(`✅ Sync สำเร็จ! ส่ง ${activePipes.length} โครงการให้ลูกค้า` + (staleCount ? ` (ลบของเก่าที่ค้างอยู่ ${staleCount} รายการ)` : ''));
      if (typeof updateCustomerUpdateBadge === 'function') {
        updateCustomerUpdateBadge();
      }
    });
  }).catch(function(err) {
    toast('❌ Sync ล้มเหลว: ' + err.message);
  });
}

// ================================================================
// CUSTOMER UPDATE HISTORY - ดูประวัติการอัพเดทของลูกค้า
// ================================================================

var historyStartDate = '';
var historyEndDate = '';
var historyFilterStatus = 'all'; // all, pending, approved, rejected
var historyFilterDealer = 'all';

function rCustomerUpdateHistory(el) {
  document.getElementById('pgT').textContent = '📜 ประวัติลูกค้าอัพเดท';
  
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    el.innerHTML = '<div class="card"><div class="empty"><p>กรุณา login เพื่อดูประวัติ</p></div></div>';
    return;
  }
  
  var dealers = ST.getAll('dealers');
  if (!dealers.length) {
    el.innerHTML = '<div class="card"><div class="empty"><p>ไม่มี Dealer ในระบบ</p></div></div>';
    return;
  }
  
  // ตัวเลือก Dealer
  var dealerOptions = '<option value="all">🏪 ทุก Dealer</option>';
  for (var i = 0; i < dealers.length; i++) {
    dealerOptions += '<option value="' + dealers[i].id + '">' + sanitize(dealers[i].name) + '</option>';
  }
  
  var statusOptions = `
    <option value="all" ${historyFilterStatus === 'all' ? 'selected' : ''}>✅ ทั้งหมด</option>
    <option value="pending" ${historyFilterStatus === 'pending' ? 'selected' : ''}>🟡 รอตรวจสอบ</option>
    <option value="approved" ${historyFilterStatus === 'approved' ? 'selected' : ''}>🟢 อนุมัติแล้ว</option>
    <option value="rejected" ${historyFilterStatus === 'rejected' ? 'selected' : ''}>🔴 ปฏิเสธ</option>
  `;
  
  var html = `
    <div class="card">
      <h2>📅 ช่วงเวลา</h2>
      <div class="fr">
        ${dpH('history_from', historyStartDate || addD(_td(), -30), 'จากวันที่')}
        ${dpH('history_to', historyEndDate || _td(), 'ถึงวันที่')}
      </div>
      <div class="fr" style="margin-top:8px">
        <div class="fg"><label>🏪 Dealer</label><select id="historyDealer" onchange="historyFilterDealer=this.value;loadHistoryData()">${dealerOptions}</select></div>
        <div class="fg"><label>📊 สถานะ</label><select id="historyStatus" onchange="historyFilterStatus=this.value;loadHistoryData()">${statusOptions}</select></div>
        <div class="fg"><label>&nbsp;</label><button class="btn bp" onclick="loadHistoryData()">🔍 ค้นหา</button></div>
      </div>
    </div>
    <div id="historySummary"></div>
    <div id="historyList"></div>
  `;
  
  el.innerHTML = html;
  
  // โหลดข้อมูล
  loadHistoryData();
}

function loadHistoryData() {
  historyStartDate = dpG('history_from') || addD(_td(), -30);
  historyEndDate = dpG('history_to') || _td();
  historyFilterDealer = document.getElementById('historyDealer') ? document.getElementById('historyDealer').value : 'all';
  historyFilterStatus = document.getElementById('historyStatus') ? document.getElementById('historyStatus').value : 'all';
  
  var dealers = ST.getAll('dealers');
  var allUpdates = [];
  var promises = [];
  
  // เลือก dealer ที่จะ查询
  var targetDealers = [];
  if (historyFilterDealer !== 'all') {
    var d = ST.getOne('dealers', historyFilterDealer);
    if (d) targetDealers.push(d);
  } else {
    targetDealers = dealers;
  }
  
  targetDealers.forEach(function(dealer) {
    var promise = db.collection('dealerUpdates').doc(dealer.id).collection('timeline')
      .orderBy('timestamp', 'desc')
      .get()
      .then(function(snapshot) {
        snapshot.forEach(function(doc) {
          var data = doc.data();
          data.id = doc.id;
          data.dealerName = dealer.name;
          data.dealerId = dealer.id;
          
          // กรองตามวันที่
          var timestamp = data.timestamp;
          if (timestamp && timestamp.toDate) {
            var dateStr = timestamp.toDate().toISOString().split('T')[0];
            if (dateStr >= historyStartDate && dateStr <= historyEndDate) {
              allUpdates.push(data);
            }
          }
        });
      })
      .catch(function(err) {
        console.warn('Error loading timeline for dealer:', dealer.name, err);
      });
    promises.push(promise);
  });
  
  Promise.all(promises).then(function() {
    // กรองตามสถานะ
    if (historyFilterStatus !== 'all') {
      allUpdates = allUpdates.filter(function(u) { return u.status === historyFilterStatus; });
    }
    
    // เรียงตามเวลา (ล่าสุดสุด)
    allUpdates.sort(function(a, b) {
      var ta = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate() : new Date(0);
      var tb = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate() : new Date(0);
      return tb - ta;
    });
    
    renderHistorySummary(allUpdates);
    renderHistoryList(allUpdates);
  });
}

function renderHistorySummary(updates) {
  var container = document.getElementById('historySummary');
  if (!container) return;
  
  var pending = updates.filter(function(u) { return u.status === 'pending'; }).length;
  var approved = updates.filter(function(u) { return u.status === 'approved'; }).length;
  var rejected = updates.filter(function(u) { return u.status === 'rejected'; }).length;
  
  var html = `
    <div class="sr" style="margin-bottom:12px">
      <div class="sc"><div class="sn c1">${updates.length}</div><div class="sl">ทั้งหมด</div></div>
      <div class="sc"><div class="sn c3">${pending}</div><div class="sl">⏳ รอตรวจสอบ</div></div>
      <div class="sc"><div class="sn c2">${approved}</div><div class="sl">✅ อนุมัติแล้ว</div></div>
      <div class="sc"><div class="sn c4">${rejected}</div><div class="sl">❌ ปฏิเสธ</div></div>
    </div>
  `;
  container.innerHTML = html;
}

function renderHistoryList(updates) {
  var container = document.getElementById('historyList');
  if (!container) return;
  
  if (updates.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty"><div class="icon">📭</div><p>ไม่มีประวัติการอัพเดทในช่วงเวลาที่เลือก</p></div></div>';
    return;
  }
  
  var html = '<div class="card"><h2>📋 รายการอัพเดท (' + updates.length + ')</h2>';
  html += '<div class="tl">';
  
  updates.forEach(function(u) {
    var dateStr = u.timestamp && u.timestamp.toDate ? fDT(u.timestamp.toDate()) : '-';
    var statusIcon = u.status === 'pending' ? '🟡' : (u.status === 'approved' ? '🟢' : '🔴');
    var statusText = u.status === 'pending' ? 'รอตรวจสอบ' : (u.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ');
    
    html += '<div class="ti tl-' + u.type + '">';
    html += '<div class="td2">' + dateStr + ' ' + statusIcon + ' <span class="tag tag-' + u.status + '">' + statusText + '</span></div>';
    html += '<div class="tt2">🏪 ' + sanitize(u.dealerName) + '</div>';
    
    if (u.projectName) {
      html += '<div class="tt2">📋 ' + sanitize(u.projectName) + '</div>';
    }
    
    html += '<div class="tc2">' + sanitize(u.content || '-') + '</div>';

    // ปุ่มดูรายละเอียด ก่อน-หลัง (ทุกรายการ ไม่ว่าจะมี diff หรือเป็นของใหม่)
    html += '<div class="ti-link" onclick="showChangeDetail(\'' + u.dealerId + '\', \'' + u.id + '\')">🔍 ดูรายละเอียด</div>';

    html += '</div>';
  });
  
  html += '</div>';
  html += '<div class="bg" style="margin-top:12px"><button class="btn bp" onclick="exportHistoryCSV()">📥 Export CSV</button></div>';
  html += '</div>';
  
  container.innerHTML = html;
}

// แสดง label ที่อ่านง่ายสำหรับฟิลด์ข้อมูลดิบ (ใช้ตอนโชว์ "รายการใหม่" ที่ไม่มี diff)
var _CHANGE_DETAIL_LABELS = {
  projectName: '📋 โครงการ', endUser: '🏢 End User', endUserTH: '🏢 End User',
  month: '📅 เดือนที่ต้องการ', totalQty: '📦 จำนวนรวม', model: '🚁 รุ่นสินค้า',
  qty: '🔢 จำนวน', forecastAmount: '💰 มูลค่าประมาณ', biddingDate: '📅 Bidding Date',
  shipmentDate: '🚚 Shipment Date', status: '📊 สถานะ', agencyMain: '🏛️ หน่วยงานใหญ่',
  agencySub: '🏛️ หน่วยงานย่อย', djiCrmRegistered: '✅ ลงทะเบียน CRM', hasCompetitor: '⚔️ มีคู่แข่ง',
  budgetFiscalYear: '📆 ปีงบประมาณ'
};

function _fmtChangeDetailValue(key, val) {
  if (val === undefined || val === null || val === '') return '-';
  if (key === 'items' && Array.isArray(val)) return val.map(function(it) { return it.model + ' x' + it.qty; }).join(', ') || '-';
  if (typeof val === 'boolean') return val ? 'ใช่' : 'ไม่ใช่';
  return String(val);
}

var _CHANGE_STATUS_STYLE = {
  pending:  { bg: 'rgba(234,179,8,.14)',  fg: '#eab308', label: '🟡 รอตรวจสอบ' },
  approved: { bg: 'rgba(34,197,94,.14)',  fg: '#22c55e', label: '🟢 อนุมัติแล้ว' },
  rejected: { bg: 'rgba(239,68,68,.14)',  fg: '#ef4444', label: '🔴 ปฏิเสธ' }
};

function _changeStatusBadge(status) {
  var s = _CHANGE_STATUS_STYLE[status] || { bg: 'var(--bg2)', fg: 'var(--text2)', label: status || '-' };
  return '<span style="background:' + s.bg + ';color:' + s.fg + ';padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:600;white-space:nowrap">' + s.label + '</span>';
}

// การ์ดหนึ่งแถวของ before → after ใช้ทั้งกับ diff ของจริงและรายการใหม่ (isNew: ไม่มีค่าก่อนหน้า)
function _changeRowHtml(label, before, after, isNew) {
  var beforeHtml = isNew
    ? '<span style="color:var(--text2);font-style:italic">— ยังไม่มี —</span>'
    : '<span style="color:var(--text2);text-decoration:line-through;text-decoration-color:rgba(239,68,68,.5)">' + sanitize(before) + '</span>';
  return '' +
    '<div style="padding:10px 12px;border-bottom:1px solid var(--border)">' +
      '<div style="font-size:.68rem;color:var(--text2);font-weight:600;margin-bottom:5px">' + label + '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:100px;font-size:.82rem">' + beforeHtml + '</div>' +
        '<div style="color:var(--accent);font-weight:700">→</div>' +
        '<div style="flex:1;min-width:100px;font-size:.82rem;font-weight:700;color:var(--accent)">' + sanitize(after) + '</div>' +
      '</div>' +
    '</div>';
}

function showChangeDetail(dealerId, updateId) {
  db.collection('dealerUpdates').doc(dealerId).collection('timeline').doc(updateId).get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    var dealer = ST.getOne('dealers', dealerId);

    var html = '<div style="max-width:520px">';

    // การ์ดหัวข้อสรุป
    html += '<div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:14px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">';
    html += '<div style="font-weight:700;font-size:.95rem">🏪 ' + sanitize(dealer ? dealer.name : (data.dealerName || dealerId)) + '</div>';
    html += _changeStatusBadge(data.status);
    html += '</div>';
    if (data.projectName) html += '<div style="font-size:.82rem;margin-bottom:4px">📋 ' + sanitize(data.projectName) + '</div>';
    html += '<div style="font-size:.72rem;color:var(--text2)">⏰ ' + (data.timestamp && data.timestamp.toDate ? fDT(data.timestamp.toDate()) : '-') + '</div>';
    html += '</div>';

    html += '<div style="font-size:.72rem;color:var(--text2);font-weight:600;margin-bottom:6px">📝 รายละเอียด</div>';
    html += '<div style="white-space:pre-wrap;background:var(--bg2);padding:10px 12px;border-radius:10px;margin-bottom:14px;font-size:.85rem">' + sanitize(data.content || '-') + '</div>';

    if (data.changedFields && data.changedFields.length) {
      // กรณีแก้ไขโครงการเดิม — โชว์การ์ด ก่อน → หลัง ต่อฟิลด์ที่เปลี่ยน
      html += '<div style="font-size:.72rem;color:var(--text2);font-weight:600;margin-bottom:6px">🔄 การเปลี่ยนแปลง</div>';
      html += '<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">';
      data.changedFields.forEach(function(c) {
        var before = (c.before === undefined || c.before === null || c.before === '') ? '-' : c.before;
        var after = (c.after === undefined || c.after === null || c.after === '') ? '-' : c.after;
        html += _changeRowHtml(sanitize(c.label || c.field), String(before), String(after), false);
      });
      html += '</div>';
      _renderChangeDetailModal(html);
    } else if (data.type === 'pipeline_create' && data.pipeId) {
      // โครงการใหม่ที่สร้างผ่านฟอร์ม pipeline โดยตรง — ไม่มี "ก่อน" ให้ดึงข้อมูลเต็มมาโชว์เป็น "หลัง"
      db.collection('dealerUpdates').doc(dealerId).collection('pipeline').doc(data.pipeId).get().then(function(pdoc) {
        var full = pdoc.exists ? pdoc.data() : (ST.getOne('pipeline', data.pipeId) || null);
        html += _renderNewItemDetailHtml(full);
        _renderChangeDetailModal(html);
      });
      return;
    } else if ((data.type === 'project_update' || data.type === 'runrate_update') && data.itemId) {
      db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(data.itemId).get().then(function(fdoc) {
        var full = fdoc.exists ? fdoc.data() : null;
        html += _renderNewItemDetailHtml(full);
        _renderChangeDetailModal(html);
      });
      return;
    }

    _renderChangeDetailModal(html);
  });
}

function _renderNewItemDetailHtml(full) {
  var html = '<div style="font-size:.72rem;color:var(--text2);font-weight:600;margin-bottom:6px">🆕 รายการใหม่ (ยังไม่เคยมีมาก่อน)</div>';
  if (!full) {
    html += '<div style="color:var(--text2);font-size:.82rem;padding:10px 0">ไม่พบข้อมูลเต็ม (อาจถูกลบ/ย้ายแล้ว)</div>';
    return html;
  }
  html += '<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">';
  for (var key in _CHANGE_DETAIL_LABELS) {
    if (full[key] === undefined) continue;
    html += _changeRowHtml(_CHANGE_DETAIL_LABELS[key], '', _fmtChangeDetailValue(key, full[key]), true);
  }
  if (full.items && full.items.length) {
    html += _changeRowHtml('📦 สินค้า', '', _fmtChangeDetailValue('items', full.items), true);
  }
  html += '</div>';
  return html;
}

function _renderChangeDetailModal(html) {
  html += '<div class="fm-actions" style="margin-top:16px"><button class="btn" onclick="closeM()">ปิด</button></div>';
  html += '</div>';
  openM('📋 รายละเอียด', html);
}

// แก้ไข function exportHistoryCSV

function exportHistoryCSV() {
  var rows = [['วันที่', 'Dealer', 'โครงการ', 'ประเภท', 'รายละเอียด', 'สถานะ', 'เหตุผลปฏิเสธ']];
  
  // ดึงข้อมูลจาก currentUpdates แทน
  var updates = [];
  var dealers = ST.getAll('dealers');
  var promises = dealers.map(function(dealer) {
    return db.collection('dealerUpdates').doc(dealer.id).collection('timeline')
      .orderBy('timestamp', 'desc')
      .get()
      .then(function(snapshot) {
        snapshot.forEach(function(doc) {
          var data = doc.data();
          data.dealerName = dealer.name;
          updates.push(data);
        });
      });
  });
  
  Promise.all(promises).then(function() {
    updates.forEach(function(u) {
      var dateStr = u.timestamp && u.timestamp.toDate ? u.timestamp.toDate().toLocaleString('th-TH') : '-';
      rows.push([
        dateStr,
        u.dealerName || '-',
        u.projectName || '-',
        u.type || '-',
        (u.content || '').substring(0, 200),
        u.status || '-',
        u.rejectReason || '-'
      ]);
    });
    
    var csv = rows.map(function(row) {
      return row.map(function(cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    
    dlBlob(csv, 'customer-update-history-' + _td() + '.csv');
  });
}
// ================================================================
// CUSTOMER FORECAST SUMMARY (COMPLETE VERSION)
// ================================================================

var fcSummaryMonth = 'all';
var fcSummaryDealer = 'all';
var fcSummaryConfidence = 'all';

function rCustomerForecastSummary(el) {
  document.getElementById('pgT').textContent = '📊 ประวัติ Forecast ลูกค้า';

  var months = generateMonthOptions();
  var dealers = ST.getAll('dealers');

  var dealerOpts = '<option value="all">🏪 ทุก Dealer</option>';
  for (var i = 0; i < dealers.length; i++) {
    dealerOpts += '<option value="' + dealers[i].id + '"' + (fcSummaryDealer === dealers[i].id ? ' selected' : '') + '>' + sanitize(dealers[i].name) + '</option>';
  }

  var html = `
    <div class="card">
      <h2>🔍 ตัวกรอง</h2>
      <div class="fr">
        <div class="fg"><label>📆 เดือน</label>
          <select id="fcSummaryMonth" onchange="fcSummaryMonth=this.value;loadForecastSummary()" style="min-width:120px">
            ${months}
          </select>
        </div>
        <div class="fg"><label>🏪 Dealer</label>
          <select id="fcSummaryDealer" onchange="fcSummaryDealer=this.value;loadForecastSummary()" style="min-width:150px">
            ${dealerOpts}
          </select>
        </div>
        <div class="fg"><label>📌 สถานะ Run Rate</label>
          <select id="fcSummaryConfidence" onchange="fcSummaryConfidence=this.value;loadForecastSummary()" style="min-width:130px">
            <option value="all"${fcSummaryConfidence === 'all' ? ' selected' : ''}>ทั้งหมด</option>
            <option value="confirmed"${fcSummaryConfidence === 'confirmed' ? ' selected' : ''}>✅ สั่งแน่นอน</option>
            <option value="estimated"${fcSummaryConfidence === 'estimated' ? ' selected' : ''}>🔵 คาดการณ์</option>
          </select>
        </div>
      </div>
    </div>
    <div id="fcSummaryStats"></div>
    <div id="fcSummaryContent"></div>
    <div class="bg" style="margin-top:12px">
      <button class="btn bp" onclick="exportForecastSummary()">📥 Export CSV</button>
      <button class="btn bo" onclick="copyForecastSummary()">📋 Copy ตาราง</button>
    </div>
  `;

  el.innerHTML = html;
  loadForecastSummary();
}

function generateMonthOptions() {
  var options = '<option value="all"' + (fcSummaryMonth === 'all' ? ' selected' : '') + '>ทั้งหมด</option>';
  var now = new Date();
  for (var i = -3; i < 12; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    var month = d.getMonth() + 1;
    var year = d.getFullYear() + 543;
    var monthKey = month + '/' + year;
    var monthLabel = (month < 10 ? '0' + month : month) + '/' + year;
    options += '<option value="' + monthKey + '"' + (fcSummaryMonth === monthKey ? ' selected' : '') + '>' + monthLabel + '</option>';
  }
  return options;
}

function loadForecastSummary() {
  var monthSelect = document.getElementById('fcSummaryMonth');
  var dealerSelect = document.getElementById('fcSummaryDealer');
  var confSelect = document.getElementById('fcSummaryConfidence');

  if (monthSelect) fcSummaryMonth = monthSelect.value;
  if (dealerSelect) fcSummaryDealer = dealerSelect.value;
  if (confSelect) fcSummaryConfidence = confSelect.value;

  // ✅ ดึงข้อมูลจาก localStorage ที่อนุมัติแล้ว
  var approvedForecasts = JSON.parse(localStorage.getItem('v7_customer_forecasts') || '[]');

  var filtered = approvedForecasts;
  if (fcSummaryMonth !== 'all') filtered = filtered.filter(function(f) { return f.month === fcSummaryMonth; });
  if (fcSummaryDealer !== 'all') filtered = filtered.filter(function(f) { return f.dealerId === fcSummaryDealer; });

  var runrate = filtered.filter(function(f) { return f.type === 'runrate'; });
  if (fcSummaryConfidence !== 'all') {
    runrate = runrate.filter(function(f) { return (f.confidence || 'estimated') === fcSummaryConfidence; });
  }
  var projects = filtered.filter(function(f) { return f.type === 'project'; });

  renderForecastSummaryStats(runrate, projects);
  renderForecastSummaryContent(runrate, projects);
}
function renderForecastSummaryStats(runrate, projects) {
  var container = document.getElementById('fcSummaryStats');
  if (!container) return;

  var totalRunrateQty = 0;
  runrate.forEach(function(r) { totalRunrateQty += (r.qty || 0); });

  var totalProjectQty = 0;
  projects.forEach(function(p) { totalProjectQty += (p.totalQty || 0); });

  var totalQty = totalRunrateQty + totalProjectQty;

  var uniqueDealers = {};
  runrate.forEach(function(r) { if (r.dealerName) uniqueDealers[r.dealerName] = true; });
  projects.forEach(function(p) { if (p.dealerName) uniqueDealers[p.dealerName] = true; });
  var dealerCount = Object.keys(uniqueDealers).length;

  // อัตราแปลง Run Rate → ใบเสนอราคา (รวมทุก dealer+model ที่อยู่ในรายการที่กรองอยู่ตอนนี้ ไม่ซ้ำคู่)
  var seen = {};
  var totalOpened = 0, totalForecastForConv = 0;
  runrate.forEach(function(r) {
    var key = r.dealerId + '||' + _fcNorm(r.model);
    if (seen[key]) return;
    seen[key] = true;
    var conv = fcRunrateConversion(r.dealerId, r.model);
    totalForecastForConv += conv.forecastQty;
    totalOpened += conv.openedQty;
  });
  var convPct = totalForecastForConv ? Math.round(totalOpened / totalForecastForConv * 100) : 0;

  var html = `
    <div class="sr">
      <div class="sc"><div class="sn c1">${dealerCount}</div><div class="sl">Dealer ที่แจ้ง</div></div>
      <div class="sc"><div class="sn c2">${totalRunrateQty}</div><div class="sl">📦 Run Rate (ชิ้น)</div></div>
      <div class="sc"><div class="sn c3">${totalProjectQty}</div><div class="sl">🏢 Project (ชิ้น)</div></div>
      <div class="sc"><div class="sn c4">${totalOpened}</div><div class="sl">📄 เปิดใบเสนอราคาแล้ว</div></div>
      <div class="sc"><div class="sn c5">${convPct}%</div><div class="sl">📊 อัตราแปลง</div></div>
    </div>
  `;
  container.innerHTML = html;
}

function renderForecastSummaryContent(runrate, projects) {
  var container = document.getElementById('fcSummaryContent');
  if (!container) return;
  
  if (runrate.length === 0 && projects.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty"><div class="icon">📭</div><p>ไม่มีข้อมูล Forecast ในเดือน ' + fcSummaryMonth + '</p></div></div>';
    return;
  }
  
  // จัดกลุ่มตาม Dealer
  var byDealer = {};
  
  runrate.forEach(function(r) {
    var dealerName = r.dealerName || 'ไม่ระบุ Dealer';
    if (!byDealer[dealerName]) {
      byDealer[dealerName] = { runrate: [], projects: [], dealerId: r.dealerId };
    }
    byDealer[dealerName].runrate.push(r);
  });
  
  projects.forEach(function(p) {
    var dealerName = p.dealerName || 'ไม่ระบุ Dealer';
    if (!byDealer[dealerName]) {
      byDealer[dealerName] = { runrate: [], projects: [], dealerId: p.dealerId };
    }
    byDealer[dealerName].projects.push(p);
  });
  
  var html = '';
  var dealerNames = Object.keys(byDealer).sort();
  
  for (var i = 0; i < dealerNames.length; i++) {
    var dealerName = dealerNames[i];
    var data = byDealer[dealerName];
    
    var dealerRunrateQty = 0;
    data.runrate.forEach(function(r) { dealerRunrateQty += (r.qty || 0); });
    
    var dealerProjectQty = 0;
    data.projects.forEach(function(p) { dealerProjectQty += (p.totalQty || 0); });
    
    var dealerTotal = dealerRunrateQty + dealerProjectQty;
    
    html += '<div class="card" style="margin-bottom:12px">';
    html += '<div class="fcd-header" onclick="toggleDealerForecastDetail(\'' + dealerName.replace(/'/g, "\\'") + '\')" style="cursor:pointer">';
    html += '<div class="fcd-top">';
    html += '<div class="fcd-name">🏪 ' + sanitize(dealerName) + '</div>';
    html += '<div class="fcd-toggle" id="toggle_' + dealerName.replace(/[^a-zA-Z0-9]/g, '_') + '">▼</div>';
    html += '</div>';
    html += '<div class="fcd-stats">';
    html += '<span class="fcd-stat">📦 Run Rate: ' + dealerRunrateQty + ' ชิ้น</span>';
    html += '<span class="fcd-stat">🏢 Project: ' + dealerProjectQty + ' ชิ้น</span>';
    html += '<span class="fcd-stat">📊 รวม: ' + dealerTotal + ' ชิ้น</span>';
    html += '</div>';
    html += '</div>';
    
    html += '<div id="detail_' + dealerName.replace(/[^a-zA-Z0-9]/g, '_') + '" style="display:block; margin-top:12px">';
    
    // Run Rate Section — แสดงทีละรายการ (ไม่รวมยอด) เพื่อให้เปลี่ยนสถานะ/สร้างใบเสนอราคาต่อรายการได้
    if (data.runrate.length > 0) {
      html += '<div class="form-section">📦 Run Rate</div>';
      data.runrate.forEach(function(r) {
        var conv = fcRunrateConversion(r.dealerId, r.model);
        var isConfirmed = (r.confidence || 'estimated') === 'confirmed';
        html += '<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">';
        html += '<div><strong>' + sanitize(r.model || '-') + '</strong> x' + (r.qty || 0) + '<div style="font-size:.72rem;color:var(--text2)">เดือน ' + sanitize(r.month || '-') + '</div></div>';
        html += '<button class="btn bsm ' + (isConfirmed ? 'bs' : 'bo') + '" onclick="toggleRunrateConfidence(\'' + r.id + '\')" style="' + (isConfirmed ? 'background:#22c55e' : 'background:#f59e0b') + ';color:#fff;border:none">' + (isConfirmed ? '✅ สั่งแน่นอน' : '🔵 คาดการณ์') + ' — เปลี่ยน</button>';
        html += '</div>';
        html += '<div style="font-size:.72rem;color:var(--text2);margin-top:6px">รวม ' + r.model + ' ทุกเดือนของ Dealer นี้ — Forecast ' + conv.forecastQty + ' • เปิดใบเสนอราคาแล้ว ' + conv.openedQty + ' • คงเหลือ ' + conv.remainingQty + '</div>';
        if (conv.remainingQty > 0) {
          html += '<div style="margin-top:6px"><button class="btn bsm bp" onclick="showRunrateQuoteBuilderM(\'' + r.dealerId + '\')">📄 สร้างใบเสนอราคา</button> ';
          html += '<button class="btn bsm bo" onclick="createSOFromRunrate(\'' + r.dealerId + '\',\'' + (r.model || '').replace(/'/g, "\\'") + '\',' + conv.remainingQty + ')">📦 สร้าง Sales Order</button></div>';
        } else {
          html += '<div style="margin-top:6px"><span class="tag" style="background:#22c55e22;color:#22c55e">✅ เปิดครบแล้ว</span></div>';
        }
        html += '</div>';
      });
    }
    
    // Project Section
    if (data.projects.length > 0) {
      html += '<div class="form-section">🏢 โครงการ</div>';
      for (var pj = 0; pj < data.projects.length; pj++) {
        var proj = data.projects[pj];
        html += '<div class="project-item" style="margin-bottom:8px; border:1px solid var(--border); border-radius:8px; padding:10px">';
        html += '<div class="project-name">📋 ' + sanitize(proj.projectName || 'ไม่ระบุชื่อโครงการ') + '</div>';
        if (proj.endUser) html += '<div class="project-items">👤 ' + sanitize(proj.endUser) + '</div>';
        html += '<div class="project-items">📦 ';
        for (var it = 0; it < (proj.items || []).length; it++) {
          var item = proj.items[it];
          html += (it > 0 ? ', ' : '') + (item.model || '-') + ' x' + (item.qty || 1);
        }
        html += '</div>';
        html += '</div>';
      }
    }
    
    html += '</div>'; // close detail
    html += '</div>'; // close card
  }
  
  container.innerHTML = html;
}

function toggleDealerForecastDetail(dealerName) {
  var id = 'detail_' + dealerName.replace(/[^a-zA-Z0-9]/g, '_');
  var toggleId = 'toggle_' + dealerName.replace(/[^a-zA-Z0-9]/g, '_');
  var detail = document.getElementById(id);
  var toggle = document.getElementById(toggleId);
  
  if (detail && toggle) {
    if (detail.style.display === 'none') {
      detail.style.display = 'block';
      toggle.textContent = '▼';
    } else {
      detail.style.display = 'none';
      toggle.textContent = '▶';
    }
  }
}

function exportForecastSummary() {
  var approvedForecasts = JSON.parse(localStorage.getItem('v7_customer_forecasts') || '[]');

  var filtered = approvedForecasts;
  if (fcSummaryMonth !== 'all') filtered = filtered.filter(function(f) { return f.month === fcSummaryMonth; });

  if (fcSummaryDealer !== 'all') {
    filtered = filtered.filter(function(f) {
      return f.dealerId === fcSummaryDealer;
    });
  }
  
  var csv = '\uFEFF"ประเภท","Dealer","ชื่อโครงการ","End User","Model","จำนวน","เดือน"\n';
  
  filtered.forEach(function(item) {
    if (item.type === 'runrate') {
      csv += '"Run Rate","' + (item.dealerName || '') + '","","","' + (item.model || '') + '","' + (item.qty || 0) + '","' + item.month + '"\n';
    } else if (item.type === 'project') {
      for (var i = 0; i < (item.items || []).length; i++) {
        var it = item.items[i];
        csv += '"Project","' + (item.dealerName || '') + '","' + (item.projectName || '') + '","' + (item.endUser || '') + '","' + (it.model || '') + '","' + (it.qty || 0) + '","' + item.month + '"\n';
      }
    }
  });
  
  dlBlob(csv, 'forecast-summary-' + fcSummaryMonth + '.csv');
  toast('📥 Export CSV เรียบร้อย');
}

function copyForecastSummary() {
  var text = '📊 สรุป Forecast ลูกค้า - ' + fcSummaryMonth + '\n';
  text += '='.repeat(40) + '\n\n';
  
  var approvedForecasts = JSON.parse(localStorage.getItem('v7_customer_forecasts') || '[]');
  var filtered = approvedForecasts;
  if (fcSummaryMonth !== 'all') filtered = filtered.filter(function(f) { return f.month === fcSummaryMonth; });

  if (fcSummaryDealer !== 'all') {
    filtered = filtered.filter(function(f) { return f.dealerId === fcSummaryDealer; });
  }
  
  var byDealer = {};
  filtered.forEach(function(f) {
    var dealer = f.dealerName || 'ไม่ระบุ';
    if (!byDealer[dealer]) byDealer[dealer] = [];
    byDealer[dealer].push(f);
  });
  
  for (var dealer in byDealer) {
    text += '🏪 ' + dealer + '\n';
    byDealer[dealer].forEach(function(f) {
      if (f.type === 'runrate') {
        text += '  📦 ' + f.model + ' x' + f.qty + ' (' + f.month + ')\n';
      } else {
        text += '  🏢 ' + f.projectName + '\n';
        (f.items || []).forEach(function(it) {
          text += '     📦 ' + it.model + ' x' + it.qty + '\n';
        });
      }
    });
    text += '\n';
  }
  
  copyText(text);
  toast('📋 Copy สรุปแล้ว');
}
// ================================================================
// CUSTOMER FORECAST UPDATES MANAGEMENT
// ================================================================

var selectedForecastUpdates = {};

function rCustomerForecastUpdates(el) {
  document.getElementById('pgT').textContent = '📦 แผนการสั่งซื้อจากลูกค้า';
  
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) {
    el.innerHTML = '<div class="card"><div class="empty"><p>กรุณา login เพื่อดูคำขอ</p></div></div>';
    return;
  }
  
  var dealers = ST.getAll('dealers');
  if (!dealers.length) {
    el.innerHTML = '<div class="card"><div class="empty"><p>ไม่มี Dealer ในระบบ</p></div></div>';
    return;
  }
  
  selectedForecastUpdates = {};
  var allUpdates = [];
  var pendingCount = 0;
  
  var promises = dealers.map(function(dealer) {
    return db.collection('dealerUpdates').doc(dealer.id).collection('forecast')
      .where('_status', '==', 'pending')
      .get()
      .then(function(snapshot) {
        snapshot.forEach(function(doc) {
          var data = doc.data();
          data.id = doc.id;
          data.dealerName = dealer.name;
          data.dealerId = dealer.id;
          allUpdates.push(data);
        });
      })
      .catch(function(err) { 
        console.warn('Error checking forecast for dealer:', dealer.name, err);
        return Promise.resolve();
      });
  });
  
  Promise.all(promises).then(function() {
    pendingCount = allUpdates.length;
    
    var badge = document.getElementById('forecastUpdateBadge');
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount ? 'inline' : 'none';
    }
    
    if (pendingCount === 0) {
      el.innerHTML = '<div class="card"><div class="empty"><div class="icon">📭</div><p>ไม่มีคำขอแผนการสั่งซื้อจากลูกค้า</p></div></div>';
      return;
    }
    
    var html = '<div class="card"><h2>📦 แผนการสั่งซื้อจากลูกค้า (' + pendingCount + ')</h2>';
    
    // Batch actions
    html += '<div class="bg" style="margin-bottom:12px">';
    html += '<button class="btn bp" onclick="batchApproveForecastSelected()" style="background:#22c55e">✅ Approve ที่เลือก</button>';
    html += '<button class="btn bs" onclick="batchApproveForecastAll()" style="background:#3b82f6">✅ Approve ทั้งหมด (' + pendingCount + ')</button>';
    html += '<button class="btn bsm bo" onclick="toggleSelectAllForecast()">☑️ เลือกทั้งหมด</button>';
    html += '</div>';
    
    html += '<div id="forecastUpdatesList">';
    
    for (var i = 0; i < allUpdates.length; i++) {
      var u = allUpdates[i];
      var isSelected = selectedForecastUpdates[u.id] === true;
      var updateDate = u._updatedAt ? (u._updatedAt.seconds ? new Date(u._updatedAt.seconds * 1000).toLocaleString() : u._updatedAt) : '-';
      var typeIcon = u.type === 'runrate' ? '📦' : '🏢';
      var typeText = u.type === 'runrate' ? 'Run Rate' : 'โครงการ';
      
      html += '<div class="li" style="border-left:3px solid #f59e0b; margin-bottom:8px; display:flex; flex-wrap:wrap">';
      html += '<div style="margin-right:10px">';
      html += '<input type="checkbox" class="forecast-checkbox" data-id="' + u.id + '" data-dealer="' + u.dealerId + '" ' + (isSelected ? 'checked' : '') + ' onchange="toggleForecastSelection(\'' + u.id + '\', this.checked)">';
      html += '</div>';
      html += '<div class="lm" style="flex:1">';
      html += '<div class="lt">' + typeIcon + ' <strong>' + sanitize(u.dealerName) + '</strong> - ' + typeText + ' <span class="tag tag-active">รอตรวจสอบ</span></div>';
      
      if (u.type === 'runrate') {
        html += '<div class="ls">📦 ' + sanitize(u.model || '-') + ' x' + (u.qty || 0) + ' ชิ้น • เดือน ' + (u.month || '-') + '</div>';
        html += '<div style="display:flex;gap:6px;margin-top:6px">';
        html += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer"><input type="radio" name="conf_' + u.id + '" value="estimated" checked style="margin:0"> คาดการณ์</label>';
        html += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer"><input type="radio" name="conf_' + u.id + '" value="confirmed" style="margin:0"> สั่งแน่นอน (มีใบเสนอราคาเซ็นแล้ว)</label>';
        html += '</div>';
      } else {
        html += '<div class="ls">📋 ' + sanitize(u.projectName || '-') + '</div>';
        if (u.endUser) html += '<div class="ls">👤 ' + sanitize(u.endUser) + '</div>';
        html += '<div class="ls">📦 ' + (u.items || []).map(function(it) { return it.model + ' x' + it.qty; }).join(', ') + '</div>';
        html += '<div class="ls">📅 เดือน ' + (u.month || '-') + '</div>';
      }
      
      html += '<div class="ls">⏰ ' + updateDate + '</div>';
      html += '</div>';
      html += '<div class="bg" style="flex-shrink:0">';
      html += '<button class="btn bsm bs" onclick="approveForecastUpdate(\'' + u.dealerId + '\', \'' + u.id + '\')">✅ อนุมัติ</button>';
      html += '<button class="btn bsm bd" onclick="rejectForecastUpdate(\'' + u.dealerId + '\', \'' + u.id + '\')">❌ ปฏิเสธ</button>';
      html += '<button class="btn bsm bo" onclick="viewForecastDetail(\'' + u.dealerId + '\', \'' + u.id + '\')">👁️ รายละเอียด</button>';
      html += '</div></div>';
    }
    
    html += '</div></div>';
    el.innerHTML = html;
  });
}

function toggleForecastSelection(updateId, isChecked) {
  selectedForecastUpdates[updateId] = isChecked;
  updateForecastBatchButtonBadge();
}

function toggleSelectAllForecast() {
  var checkboxes = document.querySelectorAll('.forecast-checkbox');
  var allChecked = true;
  for (var i = 0; i < checkboxes.length; i++) {
    if (!checkboxes[i].checked) { allChecked = false; break; }
  }
  var newState = !allChecked;
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].checked = newState;
    selectedForecastUpdates[checkboxes[i].dataset.id] = newState;
  }
  updateForecastBatchButtonBadge();
}

function updateForecastBatchButtonBadge() {
  var count = 0;
  for (var k in selectedForecastUpdates) if (selectedForecastUpdates[k]) count++;
  var btn = document.querySelector('button[onclick="batchApproveForecastSelected()"]');
  if (btn) btn.innerHTML = '✅ Approve ที่เลือก (' + count + ')';
}

function batchApproveForecastSelected() {
  var selectedIds = [];
  var selectedDealers = {};
  var checkboxes = document.querySelectorAll('.forecast-checkbox:checked');
  
  for (var i = 0; i < checkboxes.length; i++) {
    var updateId = checkboxes[i].dataset.id;
    var dealerId = checkboxes[i].dataset.dealer;
    if (!selectedDealers[dealerId]) selectedDealers[dealerId] = [];
    selectedDealers[dealerId].push(updateId);
    selectedIds.push(updateId);
  }
  
  if (selectedIds.length === 0) { toast('⚠️ กรุณาเลือกรายการ'); return; }
  if (!confirm('✅ อนุมัติ ' + selectedIds.length + ' รายการ?')) return;

  // อนุมัติทีละรายการตามลำดับ (ไม่ยิงพร้อมกัน) กันชนกันตอนหลายรายการแก้ pipeline เดียวกัน
  var queue = [];
  for (var dealerId in selectedDealers) {
    selectedDealers[dealerId].forEach(function(updateId) { queue.push({ dealerId: dealerId, updateId: updateId }); });
  }
  var errors = 0;
  (function next(i) {
    if (i >= queue.length) {
      toast('✅ อนุมัติ ' + (queue.length - errors) + ' รายการ');
      setTimeout(function() { render(); }, 1000);
      return;
    }
    approveForecastUpdate(queue[i].dealerId, queue[i].updateId, function(success) {
      if (!success) errors++;
      next(i + 1);
    });
  })(0);
}

function batchApproveForecastAll() {
  var checkboxes = document.querySelectorAll('.forecast-checkbox');
  if (checkboxes.length === 0) { toast('⚠️ ไม่มีรายการ'); return; }
  if (!confirm('✅ อนุมัติทั้งหมด ' + checkboxes.length + ' รายการ?')) return;

  var errors = 0;
  var list = [];
  for (var i = 0; i < checkboxes.length; i++) {
    list.push({ id: checkboxes[i].dataset.id, dealerId: checkboxes[i].dataset.dealer });
  }

  // อนุมัติทีละรายการตามลำดับ (ไม่ยิงพร้อมกัน) กันชนกันตอนหลายรายการแก้ pipeline เดียวกัน
  (function next(i) {
    if (i >= list.length) {
      toast('✅ อนุมัติทั้งหมด ' + (list.length - errors) + ' รายการ');
      setTimeout(function() { render(); }, 1000);
      return;
    }
    approveForecastUpdate(list[i].dealerId, list[i].id, function(success) {
      if (!success) errors++;
      next(i + 1);
    });
  })(0);
}

// ✅ แปลง "โครงการใหม่" ที่ลูกค้าเพิ่มผ่าน Client-view (forecast type=project) ให้เป็น Pipeline จริง
// เรียกเฉพาะตอนอนุมัติ — ราคาไม่มีจากลูกค้าเลยจึงประมาณจากแคตตาล็อก (RRP), สถานะเริ่มต้น = initial
// ใช้ id เดียวกับ forecast request (ไม่ชนกับ pipeline อื่นเพราะ prefix 'proj_' ต่างจาก id ปกติ) กันสร้างซ้ำถ้ากด approve ซ้ำ
function _createPipelineFromForecastProject(updateData, dealerId) {
  if (updateData.id && ST.getOne('pipeline', updateData.id)) return updateData.id; // already created — idempotent

  var items = (updateData.items || []).map(function(it) {
    var price = (typeof getModelPrice === 'function') ? (getModelPrice(it.model) || 0) : 0;
    var qty = Number(it.qty) || 1;
    return { model: it.model, qty: qty, price: price, total: price * qty };
  });
  var forecastAmount = items.reduce(function(sum, it) { return sum + (it.total || 0); }, 0);

  // เดือนที่ลูกค้าต้องการ → biddingDate โดยประมาณ (วันที่ 1 ของเดือนนั้น) + คงข้อความต้นฉบับไว้ใน remark กันข้อมูลหาย
  var biddingDate = '';
  if (updateData.month) {
    var mm = String(updateData.month).match(/^(\d{4})-(\d{2})/);
    if (mm) biddingDate = mm[1] + '-' + mm[2] + '-01';
  }
  var remark = '🆕 เพิ่มโดยลูกค้าผ่าน Client-view' + (updateData.month ? (' — เดือนที่ต้องการ: ' + updateData.month) : '') + ' — ราคาประมาณจากแคตตาล็อก โปรดตรวจสอบ/แก้ไข';

  var pipeData = {
    id: updateData.id || undefined,
    registerDate: _td(),
    projectName: updateData.projectName || '',
    endUserTH: updateData.endUser || '',
    endUserEN: '',
    dealerId: dealerId,
    status: 'initial',
    items: items,
    model: items[0] ? items[0].model : '',
    modelQty: updateData.totalQty || (items[0] ? items[0].qty : 1),
    forecastAmount: forecastAmount,
    realAmount: 0,
    biddingDate: biddingDate,
    remark: remark,
    sheetDisplay: 'Show',
    nextAction: '', followupDate: ''
  };

  var saved = ST.add('pipeline', pipeData);
  ST.add('pipeLog', {
    pipeId: saved.id,
    type: 'update',
    content: '🆕 เพิ่มโครงการใหม่จากลูกค้า (อนุมัติแล้ว)',
    date: _nw()
  });
  if (typeof syncToFirebase === 'function') syncToFirebase('pipeline', ST.getAll('pipeline'));
  return saved.id;
}

function approveForecastUpdate(dealerId, updateId, callback) {
  if (!CURRENT_USER) {
    if (callback) callback(false);
    toast('❌ กรุณา login');
    return;
  }

  var updateRef = db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(updateId);

  updateRef.get().then(function(doc) {
    if (!doc.exists) { if (callback) callback(false); return; }

    var updateData = doc.data();

    // ลบ metadata
    delete updateData._customerUpdate;
    delete updateData._updatedAt;
    delete updateData._status;
    delete updateData._originalDealerId;
    delete updateData._updateType;

    // ความมั่นใจ Run Rate — เซลส์เลือกตอนอนุมัติ (radio ในการ์ดรายการที่ยังโชว์อยู่ตอนกดปุ่ม) ค่าเริ่มต้น 'estimated' ถ้าไม่พบ
    if (updateData.type === 'runrate') {
      var confEl = document.querySelector('input[name="conf_' + updateId + '"]:checked');
      updateData.confidence = confEl ? confEl.value : 'estimated';
    }

    // บันทึกไปยัง localStorage สำหรับสรุปผล
    var customerForecasts = JSON.parse(localStorage.getItem('v7_customer_forecasts') || '[]');
    updateData.approvedAt = new Date().toISOString();
    updateData.approvedBy = CURRENT_USER.uid;
    customerForecasts.push(updateData);
    localStorage.setItem('v7_customer_forecasts', JSON.stringify(customerForecasts));
    if (typeof syncToFirebase === 'function') syncToFirebase('customerForecasts', customerForecasts);

    // ✅ ถ้าเป็น "โครงการใหม่" (ไม่ใช่ runrate) ให้สร้าง Pipeline จริงพร้อม log วันที่อัปเดต
    var createdPipeId = null;
    if (updateData.type === 'project') {
      try { createdPipeId = _createPipelineFromForecastProject(updateData, dealerId); }
      catch (e) { console.warn('สร้าง Pipeline จาก forecast project ไม่สำเร็จ:', e); }
    }

    // อัพเดทสถานะเป็น approved
    updateRef.update({
      _status: 'approved',
      _approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      _approvedBy: CURRENT_USER.uid
    }).then(function() {
      // ✅ Audit Log
      if (typeof addAuditLog === 'function') {
        var dealer = ST.getOne('dealers', dealerId);
        var itemName = updateData.type === 'runrate'
          ? (updateData.model + ' x' + updateData.qty)
          : updateData.projectName;
        addAuditLog(
          'approve_forecast',
          'forecast',
          updateId,
          itemName,
          dealerId,
          dealer ? dealer.name : '',
          { oldValue: 'pending', newValue: 'approved', type: updateData.type }
        );
      }
      if (callback) callback(true);
      toast('✅ อนุมัติ Forecast แล้ว');
    }).catch(function(err) {
      if (callback) callback(false);
      toast('❌ ผิดพลาด: ' + err.message);
    });
  }).catch(function(err) {
    if (callback) callback(false);
    toast('❌ ผิดพลาด: ' + err.message);
  });
}

function rejectForecastUpdate(dealerId, updateId) {
  if (!confirm('❌ ปฏิเสธแผนการสั่งซื้อนี้?')) return;

  var updateRef = db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(updateId);

  // ดึงข้อมูลก่อนเพื่อใช้ใน audit log
  updateRef.get().then(function(doc) {
    if (!doc.exists) {
      toast('❌ ไม่พบข้อมูล');
      return;
    }

    var updateData = doc.data();
    var oldStatus = updateData._status || 'pending';

    return updateRef.update({
      _status: 'rejected',
      _rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
      _rejectedBy: CURRENT_USER ? CURRENT_USER.uid : 'admin'
    }).then(function() {
      // ✅ Audit Log
      if (typeof addAuditLog === 'function') {
        var dealer = ST.getOne('dealers', dealerId);
        var itemName = updateData.type === 'runrate'
          ? (updateData.model + ' x' + updateData.qty)
          : updateData.projectName;
        addAuditLog(
          'reject_forecast',
          'forecast',
          updateId,
          itemName,
          dealerId,
          dealer ? dealer.name : '',
          { oldValue: oldStatus, newValue: 'rejected', type: updateData.type }
        );
      }
      toast('❌ ปฏิเสธแผนการสั่งซื้อแล้ว');
      if (typeof render === 'function') render();
    });
  }).catch(function(err) {
    console.error('Reject forecast error:', err);
    toast('❌ เกิดข้อผิดพลาด: ' + err.message);
  });
}

function viewForecastDetail(dealerId, updateId) {
  db.collection('dealerUpdates').doc(dealerId).collection('forecast').doc(updateId).get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    
    var html = '<div style="max-width:500px">';
    html += '<h3>📦 รายละเอียดแผนการสั่งซื้อ</h3>';
    html += '<div><strong>🏪 Dealer:</strong> ' + sanitize(data.dealerName || dealerId) + '</div>';
    html += '<div><strong>📅 เดือน:</strong> ' + (data.month || '-') + '</div>';
    html += '<div><strong>📊 ประเภท:</strong> ' + (data.type === 'runrate' ? 'Run Rate' : 'โครงการ') + '</div>';
    
    if (data.type === 'runrate') {
      html += '<div><strong>📦 Model:</strong> ' + sanitize(data.model || '-') + '</div>';
      html += '<div><strong>🔢 จำนวน:</strong> ' + (data.qty || 0) + ' ชิ้น</div>';
    } else {
      html += '<div><strong>📋 โครงการ:</strong> ' + sanitize(data.projectName || '-') + '</div>';
      if (data.endUser) html += '<div><strong>👤 End User:</strong> ' + sanitize(data.endUser) + '</div>';
      html += '<div><strong>📦 สินค้า:</strong></div><ul>';
      (data.items || []).forEach(function(it) {
        html += '<li>' + sanitize(it.model) + ' x' + (it.qty || 1) + '</li>';
      });
      html += '</ul>';
    }
    
    html += '<div class="fm-actions" style="margin-top:16px">';
    html += '<button class="btn bs" onclick="closeM();approveForecastUpdate(\'' + dealerId + '\', \'' + updateId + '\')">✅ อนุมัติ</button>';
    html += '<button class="btn bd" onclick="closeM();rejectForecastUpdate(\'' + dealerId + '\', \'' + updateId + '\')">❌ ปฏิเสธ</button>';
    html += '<button class="btn" onclick="closeM()">ปิด</button>';
    html += '</div></div>';
    
    openM('📦 รายละเอียด', html);
  });
}
// เพิ่มใน rAdmin function (app.js) - ในส่วน Cloud Sync

'<div class="card"><h2>💬 LINE Notify</h2>' +
'<div class="fg"><label>LINE Notify Token</label>' +
'<input type="password" id="lineToken" value="' + (localStorage.getItem('line_notify_token') || '') + '" placeholder="ใส่ Token ที่ได้จาก LINE Notify">' +
'<div class="hint"><a href="https://notify-bot.line.me/my/" target="_blank">🔗 ไปที่ LINE Notify เพื่อขอ Token</a></div></div>' +
'<button class="btn bp" onclick="saveLineToken()">💾 บันทึก Token</button>' +
'<button class="btn bo" onclick="testLineNotify()">📤 ทดสอบส่งข้อความ</button></div>'

// เพิ่มฟังก์ชัน
function saveLineToken() {
  var token = document.getElementById('lineToken').value.trim();
  if (token) {
    localStorage.setItem('line_notify_token', token);
    toast('✅ บันทึก Token แล้ว');
  } else {
    localStorage.removeItem('line_notify_token');
    toast('🗑️ ลบ Token แล้ว');
  }
}
// rPipeDashboard defined in views-pipeline.js
function testLineNotify() {
  var token = localStorage.getItem('line_notify_token');
  if (!token) { toast('❌ กรุณาใส่ Token ก่อน'); return; }
  sendLineNotify('🧪 ทดสอบการแจ้งเตือนจาก DJI Sales Assistant');
  toast('📤 ส่งข้อความทดสอบแล้ว');
}
// เพิ่มฟังก์ชันเปิด Email Draft
function openEmailDraft() {
  if (typeof showEmailDraftWithDealer === 'function') {
    showEmailDraftWithDealer();
  } else {
    toast('⚠️ ฟังก์ชันยังไม่พร้อม');
  }
}
// เพิ่มเมนูใน sidebar (เรียกใช้หลังจาก DOM โหลด)
function addCustomerUpdateMenuItem() {
  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  
  // ตรวจสอบว่ามีเมนูนี้อยู่แล้วหรือไม่
  if (document.querySelector('.nl[data-v="customerUpdates"]')) return;
  
  var insightsItem = document.querySelector('.nl[data-v="insights"]');
  if (insightsItem) {
    var menuHtml = '<div class="nl" data-v="customerUpdates" onclick="go(\'customerUpdates\')">📥 คำขออัพเดท <span class="nb" id="customerUpdateBadge" style="display:none">0</span></div>';
    insightsItem.insertAdjacentHTML('afterend', menuHtml);
  }
}

function toggleSbGroup(key) {
  var items = document.getElementById('sgi-' + key);
  var chev = document.getElementById('sgc-' + key);
  if (!items) return;
  var nowCollapsed = items.classList.toggle('sg-collapsed');
  if (chev) chev.classList.toggle('sg-c', nowCollapsed);
  try {
    var state = JSON.parse(localStorage.getItem('v7_sb_state') || '{}');
    state[key] = !nowCollapsed;
    localStorage.setItem('v7_sb_state', JSON.stringify(state));
  } catch(e) {}
}

function initSbGroups() {
  var defaults = { fav: true, main: true, work: false, data: false, tools: false, products: false, track: false, system: false };
  try {
    var saved = JSON.parse(localStorage.getItem('v7_sb_state') || '{}');
    Object.keys(saved).forEach(function(k) { defaults[k] = saved[k]; });
  } catch(e) {}
  Object.keys(defaults).forEach(function(key) {
    if (!defaults[key]) {
      var items = document.getElementById('sgi-' + key);
      var chev = document.getElementById('sgc-' + key);
      if (items) items.classList.add('sg-collapsed');
      if (chev) chev.classList.add('sg-c');
    }
  });
}

// เรียกใช้เพิ่มเมนูเมื่อโหลดเสร็จ
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(addCustomerUpdateMenuItem, 500);
    initSbGroups();
  });
}

// อัพเดท badge ทุก 30 วินาที
if (typeof setInterval !== 'undefined') {
  setInterval(function() {
    if (typeof updateCustomerUpdateBadge === 'function') {
      updateCustomerUpdateBadge();
    }
  }, 30000);
}
// เรียกใช้ตอน init
setTimeout(addCustomerUpdateMenuItem, 1000);