// ================================================================
// FIREBASE SYNC LAYER (FIXED)
// ================================================================
var SYNC_ENABLED = false;
var CURRENT_USER = null;

// Key mapping: localStorage key (without v7_) → Firebase collection
var SYNC_KEY_MAP = {
  'dealers': 'dealers',
  'pipeline': 'pipeline',
  'pipelog': 'pipelog',
  'visits': 'visits',
  'followups': 'followups',
  'tasks': 'tasks',
  'tasklogs': 'tasklogs',
  'feedback': 'feedback',
  'emails': 'emails',
  'pins': 'pins',
  'linelog': 'linelog',
  'qn': 'qn',
  'rt': 'rt',
  'rc': 'rc',
  'mc': 'mc',
  'notes': 'notes',
  'pipeActions': 'pipeActions',
  'visitPlans': 'visitPlans',
  'demo': 'demo',
  'quotes': 'quotes',
'quotations_v2': 'quotations_v2',
  'goals_v2': 'goals_v2',
  'kpiConfig': 'kpiConfig',
  'kpiEntries': 'kpiEntries',
  'lineTmpl': 'lineTmpl',
  'emailTmpl': 'emailTmpl',
  'dailylog': 'dailylog',
  'favorites': 'favorites',
  'appearance': 'appearance',
  'actions': 'actions',
  'backup': 'backup',
'products': 'products',  // ✅ เพิ่มบรรทัดนี้
  'bundles': 'bundles',    // ✅ เพิ่ม
  'demoUnits': 'demoUnits' // ✅ เพิ่ม
};

var ALL_SYNC_KEYS = Object.keys(SYNC_KEY_MAP);

// ================================================================
// SAFETY: แปลง Firestore Timestamp → ISO string + กันค่า null ก่อนเก็บ localStorage
// (กันบั๊กแบบ "dateStr.split is not a function" และ ".filter of null")
// ================================================================
function normalizeFirestoreValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  // Firestore Timestamp (มี toDate)
  if (typeof val.toDate === 'function') {
    try { return val.toDate().toISOString(); } catch(e) { return val; }
  }
  // Timestamp แบบ plain object {seconds, nanoseconds}
  if (typeof val.seconds === 'number' && typeof val.nanoseconds === 'number') {
    try { return new Date(val.seconds * 1000).toISOString(); } catch(e) { return val; }
  }
  if (Array.isArray(val)) return val.map(normalizeFirestoreValue);
  var out = {};
  for (var k in val) { if (val.hasOwnProperty(k)) out[k] = normalizeFirestoreValue(val[k]); }
  return out;
}

// ✅ ลบ key ที่เก็บค่าพิษ ("null"/"undefined") ตอนเปิดแอป — แก้ getter ทั้งหมดที่ทำ .filter/.map พร้อมกัน
(function sanitizePoisonedLocalStorage() {
  try {
    Object.keys(localStorage).forEach(function(k) {
      if (!k || k.indexOf('v7_') !== 0) return;
      var v = localStorage.getItem(k);
      if (v === 'null' || v === 'undefined') {
        localStorage.removeItem(k);
        console.warn('🧹 ลบ localStorage key ที่เป็นค่าพิษ:', k);
      }
    });
  } catch(e) { console.warn('sanitizePoisonedLocalStorage error:', e); }
})();

// ================================================================
// AUTH (ใช้ popup แทน redirect เพื่อความเสถียร)
// ================================================================

function loginWithGoogle() {
  console.log('🔑 Login with Google clicked');
  var provider = new firebase.auth.GoogleAuthProvider();
  
  // ใช้ popup แทน redirect (เสถียรกว่า)
  auth.signInWithPopup(provider)
    .then(function(result) {
      console.log('✅ Login success:', result.user.email);
      // onAuthStateChanged จะจัดการส่วนที่เหลือ
    })
    .catch(function(error) {
      console.error('❌ Login error:', error);
      var errorEl = document.getElementById('loginError');
      if (errorEl) errorEl.textContent = error.message;
      toast('❌ เข้าสู่ระบบล้มเหลว: ' + error.message);
    });
}

function useOffline() {
  SYNC_ENABLED = false;
  CURRENT_USER = null;
  var loginScreen = document.getElementById('loginScreen');
  if (loginScreen) loginScreen.style.display = 'none';
  var main = document.getElementById('main');
  if (main) main.style.display = 'flex';
  if (typeof render === 'function') render();
  toast('📱 โหมด Offline (ข้อมูลไม่ sync)');
}

function logoutUser() {
  auth.signOut().then(function() {
    CURRENT_USER = null;
    SYNC_ENABLED = false;
    toast('👋 Logout แล้ว');
    location.reload();
  });
}

// ✅ Auth State Listener (หลัก)
auth.onAuthStateChanged(function(user) {
  console.log('🔥 Auth state changed:', user ? user.email : 'No user');
  
  if (user) {
    CURRENT_USER = user;
    SYNC_ENABLED = true;
    
    // ซ่อน login screen
    var loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';
    
    // แสดง main
    var main = document.getElementById('main');
    if (main) main.style.display = 'flex';
    
    // Toast แจ้งเตือน
    toast('✅ เข้าสู่ระบบ: ' + (user.displayName || user.email));
    
    // Migrate และ sync
    migrateLocalToFirebase();
    initFirebaseListeners();

    // ✅ Publish แคตตาล็อกสินค้าให้ client-view (รอ products sync ลง localStorage ก่อน)
    setTimeout(function() { if (typeof publishCatalogToClientView === 'function') publishCatalogToClientView(); }, 5000);

    // ✅ Sync pipeline to shared teamPipeline + load other team members' pipeline
    setTimeout(function() {
      if (typeof syncMainPipelineToShared === 'function') syncMainPipelineToShared();
      if (typeof loadSharedTeamPipeline === 'function') loadSharedTeamPipeline();
      if (typeof publishTeamConfig === 'function' && typeof getSalesMembers === 'function') publishTeamConfig(getSalesMembers());
    }, 7000);
    
    // รีเฟรช UI
    if (typeof render === 'function') render();
    
  } else {
    // ไม่มี user → แสดง login screen
    var loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'flex';
    
    var main = document.getElementById('main');
    if (main) main.style.display = 'none';
  }
});

// ================================================================
// FIRESTORE HELPERS
// ================================================================
function getUserDocPath() {
  if (!CURRENT_USER) return null;
  return 'users/' + CURRENT_USER.uid;
}

function getCollectionRef(collName) {
  if (!CURRENT_USER) return null;
  return db.collection('users').doc(CURRENT_USER.uid).collection(collName);
}

// ================================================================
// SYNC: localStorage → Firebase
// ================================================================
function syncToFirebase(collName, data) {
  if (!SYNC_ENABLED || !CURRENT_USER) return;
  var ref = getCollectionRef(collName);
  if (!ref) return;

  if (Array.isArray(data)) {
    data.forEach(function(item) {
      if (item && item.id) {
        ref.doc(item.id).set(item).catch(function(e) {
          console.warn('Sync error:', collName, e);
        });
      }
    });
  } else {
    ref.doc('_data').set({value: data}).catch(function(e) {
      console.warn('Sync error:', collName, e);
    });
  }
}

function syncDeleteFromFirebase(collName, docId) {
  if (!SYNC_ENABLED || !CURRENT_USER) return;
  var ref = getCollectionRef(collName);
  if (!ref || !docId) return;
  ref.doc(docId).delete().catch(function(e) {
    console.warn('Delete sync error:', e);
  });
}

// ================================================================
// REAL-TIME LISTENERS
// ================================================================
var activeListeners = [];

function initFirebaseListeners() {
  // ลบ listeners เดิม
  activeListeners.forEach(function(unsub) { 
    if (typeof unsub === 'function') unsub(); 
  });
  activeListeners = [];

  ALL_SYNC_KEYS.forEach(function(key) {
    var lsKey = 'v7_' + key;
    var collName = SYNC_KEY_MAP[key];
    var ref = getCollectionRef(collName);
    if (!ref) return;

    var unsub = ref.onSnapshot(function(snapshot) {
      try {
        var items = [];
        var isSingleDoc = false;
        snapshot.forEach(function(doc) {
          if (doc.id === '_data') {
            var val = normalizeFirestoreValue(doc.data().value);
            // ✅ กันค่า null/undefined ไม่ให้เก็บเป็นสตริง "null" (ทำให้ getter พังตอน .filter/.map)
            if (val === null || val === undefined) {
              localStorage.removeItem(lsKey);
            } else {
              localStorage.setItem(lsKey, JSON.stringify(val));
            }
            isSingleDoc = true;
            return;
          }
          var data = normalizeFirestoreValue(doc.data());
          data.id = doc.id;
          items.push(data);
        });
        if (!isSingleDoc && items.length) {
          localStorage.setItem(lsKey, JSON.stringify(items));
        }
      } catch(e) {
        console.warn('Listener error for', collName, e);
      }
    }, function(error) {
      console.warn('Listener error:', collName, error);
    });

    activeListeners.push(unsub);
  });

  // Config sync
  if (CURRENT_USER) {
    var configRef = db.collection('users').doc(CURRENT_USER.uid).collection('_config');
    var unsub2 = configRef.doc('main').onSnapshot(function(doc) {
      try {
        if (doc.exists) {
          localStorage.setItem('v7_config', JSON.stringify(doc.data()));
        }
      } catch(e) {
        console.warn('Config listener error:', e);
      }
    });
    activeListeners.push(unsub2);
  }
}

// ================================================================
// MIGRATE: localStorage → Firebase (first time)
// ================================================================
function migrateLocalToFirebase() {
  if (!SYNC_ENABLED || !CURRENT_USER) return;

  var migrated = localStorage.getItem('v7_migrated_' + CURRENT_USER.uid);
  if (migrated) {
    console.log('Already migrated');
    return;
  }

  toast('🔄 กำลัง sync ข้อมูลไป Cloud...');

  // ✅ เพิ่ม: ตรวจสอบและซ่อมแซมโครงสร้างก่อน sync
  fixProductsStructureBeforeSync();

  ALL_SYNC_KEYS.forEach(function(key) {
    var lsKey = 'v7_' + key;
    var data = localStorage.getItem(lsKey);
    if (!data) return;
    try {
      var parsed = JSON.parse(data);
      var collName = SYNC_KEY_MAP[key];
      
      // ✅ เพิ่ม: สำหรับ products ให้แปลงเป็นโครงสร้างที่ถูกต้อง
      if (key === 'products' && Array.isArray(parsed)) {
        parsed = { models: parsed, bundles: [], demoUnits: [] };
      }
      
      syncToFirebase(collName, parsed);
    } catch(e) {
      console.warn('Migration error for ' + key, e);
    }
  });

  localStorage.setItem('v7_migrated_' + CURRENT_USER.uid, 'true');
  toast('✅ Sync เสร็จแล้ว!');
}

// ✅ เพิ่มฟังก์ชันนี้
function fixProductsStructureBeforeSync() {
  var raw = localStorage.getItem('v7_products');
  if (!raw) return;
  
  try {
    var parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      var fixed = {
        models: parsed,
        bundles: [],
        demoUnits: [],
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('v7_products', JSON.stringify(fixed));
      console.log('✅ ซ่อมแซมโครงสร้าง v7_products ก่อน sync');
    }
  } catch(e) { console.warn('fixProductsStructureBeforeSync error:', e); }
}
// ================================================================
// AUTO SYNC — Override ST._set
// ================================================================
(function() {
  var checkST = setInterval(function() {
    if (typeof ST === 'undefined' || !ST._set) return;
    clearInterval(checkST);
    
    var _origSet = ST._set.bind(ST);
    
    ST._set = function(key, data) {
      // Call original
      _origSet(key, data);
      
      // Auto sync to Firebase
      if (typeof SYNC_ENABLED !== 'undefined' && SYNC_ENABLED && CURRENT_USER) {
        if (!key || typeof key !== 'string') return;
        var shortKey = key.replace('v7_', '');
        if (!SYNC_KEY_MAP[shortKey]) return;
        
        try {
          var collName = SYNC_KEY_MAP[shortKey];
          var ref = db.collection('users').doc(CURRENT_USER.uid).collection(collName);
          if (Array.isArray(data)) {
            data.forEach(function(item) {
              if (item && item.id) {
                ref.doc(item.id).set(item).catch(function(e) {
                  console.warn('Sync error:', collName, e);
                });
              }
            });
          } else {
            ref.doc('_data').set({value: data}).catch(function(e) {
              console.warn('Sync error:', collName, e);
            });
          }
        } catch(e) {
          console.warn('Sync error:', key, e);
        }
      }
    };
    
    // Override ST.delete for sync
    var _origDelete = ST.delete.bind(ST);
    
    ST.delete = function(coll, id) {
      _origDelete(coll, id);
      
      if (typeof SYNC_ENABLED !== 'undefined' && SYNC_ENABLED && CURRENT_USER) {
        var key = ST._keys[coll];
        if (!key) return;
        var shortKey = key.replace('v7_', '');
        
        if (id) {
          db.collection('users').doc(CURRENT_USER.uid).collection(shortKey).doc(id).delete().catch(function(e) {
            console.warn('Delete sync error:', coll, id, e);
          });
        }
        
        try {
          var items = JSON.parse(localStorage.getItem(key) || '[]');
          var ref = db.collection('users').doc(CURRENT_USER.uid).collection(shortKey);
          if (Array.isArray(items)) {
            items.forEach(function(item) {
              if (item && item.id) {
                ref.doc(item.id).set(item).catch(function(e) { console.warn('Re-sync error after delete:', shortKey, item.id, e); });
              }
            });
          }
        } catch(e) { console.warn('Re-sync after delete failed:', coll, e); }
      }
    };

    console.log('✅ ST._set and ST.delete override ready');
  }, 100);
})();

// ================================================================
// Override ST.setObj for config sync
// ================================================================
(function() {
  var checkST2 = setInterval(function() {
    if (typeof ST === 'undefined' || !ST.setObj) return;
    clearInterval(checkST2);
    
    var _origSetObj = ST.setObj.bind(ST);
    
    ST.setObj = function(key, data) {
      _origSetObj(key, data);
      
      if (typeof SYNC_ENABLED !== 'undefined' && SYNC_ENABLED && CURRENT_USER && key === 'config') {
        db.collection('users').doc(CURRENT_USER.uid).collection('_config').doc('main').set(data).catch(function(e) {
          console.warn('Config sync error:', e);
        });
      }
    };
    
    console.log('✅ ST.setObj override ready');
  }, 100);
})();

// ================================================================
// FULL SYNC — Force push all localStorage to Firebase
// ================================================================
function forceSyncAll() {
  if (!SYNC_ENABLED || !CURRENT_USER) {
    toast('❌ ต้อง Login ก่อน');
    return;
  }

  if (!confirm('⚠️ Sync ข้อมูลทั้งหมดไป Firebase?\nข้อมูลบน Cloud จะถูกเขียนทับ')) return;

  toast('🔄 กำลัง Sync ทั้งหมด...');
  var count = 0;

  Object.keys(localStorage).forEach(function(key) {
    if (!key || typeof key !== 'string') return;
    if (key.indexOf('v7_') !== 0) return;
    if (key === 'v7_config') return;
    if (key.indexOf('v7_migrated') === 0) return;
    if (key === 'v7_sbCollapsed') return;
    if (key === 'v7_appearance') return;
    if (key === 'v7_viewMode') return;
    if (key === 'v7_favorites') return;

    var shortKey = key.replace('v7_', '');
    var data = localStorage.getItem(key);
    if (!data) return;

    try {
      var parsed = JSON.parse(data);
      var ref = db.collection('users').doc(CURRENT_USER.uid).collection(shortKey);

      if (Array.isArray(parsed)) {
        parsed.forEach(function(item) {
          if (item && item.id) {
            ref.doc(item.id).set(item).catch(function(e) {
              console.warn('Sync error:', shortKey, item.id, e);
            });
          }
        });
      } else {
        ref.doc('_data').set({value: parsed}).catch(function(e) {
          console.warn('Sync error:', shortKey, e);
        });
      }
      count++;
    } catch(e) {
      console.warn('Parse error:', key, e);
    }
  });

  var cfg = localStorage.getItem('v7_config');
  if (cfg) {
    try {
      db.collection('users').doc(CURRENT_USER.uid).collection('_config').doc('main').set(JSON.parse(cfg));
    } catch(e) { console.warn('Config sync error in forceSyncAll:', e); }
  }

  setTimeout(function() {
    toast('✅ Sync เสร็จ! ' + count + ' collections');
  }, 2000);
}

// ================================================================
// FULL IMPORT — Import backup + sync to Firebase
// ================================================================
function importFullBackup() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        var count = 0;
        Object.keys(data).forEach(function(k) {
          localStorage.setItem(k, JSON.stringify(data[k]));
          count++;
        });
        toast('✅ Import สำเร็จ! ' + count + ' keys');

        if (SYNC_ENABLED && CURRENT_USER) {
          localStorage.removeItem('v7_migrated_' + CURRENT_USER.uid);
          setTimeout(function() {
            forceSyncAll();
          }, 1000);
        }

        setTimeout(function() {
          location.reload();
        }, 3000);
      } catch(err) {
        toast('❌ Error: ' + err.message);
      }
    };
    reader.readAsText(e.target.files[0]);
  };
  input.click();
}

// ================================================================
// FULL EXPORT — Export all localStorage
// ================================================================
function exportFullBackup() {
  var allData = {};
  Object.keys(localStorage).forEach(function(k) {
    if (k.indexOf('v7_') === 0) {
      try { allData[k] = JSON.parse(localStorage.getItem(k)); } catch(e) { allData[k] = localStorage.getItem(k); }
    }
  });
  var blob = new Blob([JSON.stringify(allData, null, 2)], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'full-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('📥 Export Full Backup แล้ว!');
}

// ================================================================
// TEAM PIPELINE SYNC (cross-team conflict detection)
// ================================================================
var _teamPipelineData = []; // pipeline จาก sales members อื่น (ใช้ใน conflict detection)

function syncMainPipelineToShared() {
  if (!SYNC_ENABLED || !CURRENT_USER) return;
  var pipes = [];
  try { pipes = JSON.parse(localStorage.getItem('v7_pipeline') || '[]'); } catch(e) {}
  if (!pipes.length) return;
  var dealers = [];
  try { dealers = JSON.parse(localStorage.getItem('v7_dealers') || '[]'); } catch(e) {}
  var dealerMap = {};
  dealers.forEach(function(d) { if (d && d.id) dealerMap[d.id] = d.name || ''; });
  var ownerName = CURRENT_USER.displayName || CURRENT_USER.email || 'Main';
  var colRef = db.collection('teamPipeline');
  pipes.forEach(function(p) {
    if (!p || !p.id) return;
    if (['lost', 'delivered'].indexOf(p.status) !== -1) {
      colRef.doc(p.id).delete().catch(function(e) { console.warn('teamPipeline delete:', e); });
    } else {
      var modelSummary = '';
      var totalQty = 0;
      if (p.items && p.items.length) {
        modelSummary = p.items.map(function(it) { return (it.model || '') + (it.qty > 1 ? ' x' + it.qty : ''); }).filter(Boolean).join(', ');
        p.items.forEach(function(it) { totalQty += Number(it.qty) || 1; });
      } else if (p.model) {
        modelSummary = p.model + (p.modelQty > 1 ? ' x' + p.modelQty : '');
        totalQty = Number(p.modelQty) || 1;
      }
      colRef.doc(p.id).set({
        id: p.id,
        dealerId: p.dealerId || '',
        dealerName: dealerMap[p.dealerId] || '',
        projectName: p.projectName || '',
        endUserTH: p.endUserTH || '',
        endUserEN: p.endUserEN || '',
        forecastAmount: Number(p.forecastAmount) || 0,
        status: p.status || 'prospect',
        model: modelSummary,
        totalQty: totalQty,
        ownerName: ownerName,
        ownerId: CURRENT_USER.uid,
        ownerType: 'main',
        updatedAt: new Date().toISOString()
      }).catch(function(e) { console.warn('teamPipeline write:', e); });
    }
  });
}

function loadSharedTeamPipeline() {
  if (!SYNC_ENABLED || !CURRENT_USER) return;
  var myUid = CURRENT_USER.uid;
  db.collection('teamPipeline').get().then(function(snapshot) {
    var items = [];
    snapshot.forEach(function(doc) {
      var d = doc.data();
      if (!d || d.ownerId === myUid) return;
      d._isTeam = true;
      d._ownerName = d.ownerName || '';
      d._dealerName = d.dealerName || '';
      items.push(d);
    });
    _teamPipelineData = items;
    console.log('✅ loadSharedTeamPipeline:', items.length, 'items from team');
  }).catch(function(e) { console.warn('loadSharedTeamPipeline error:', e); });
}

function publishTeamConfig(members) {
  if (typeof db === 'undefined' || !SYNC_ENABLED || !CURRENT_USER) return;
  db.collection('teamConfig').doc('main').set({
    mainUid: CURRENT_USER.uid,
    mainName: CURRENT_USER.displayName || CURRENT_USER.email || 'Main',
    members: members || [],
    updatedAt: new Date().toISOString()
  }).catch(function(e) { console.warn('publishTeamConfig error:', e); });
}