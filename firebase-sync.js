// ================================================================
// FIREBASE SYNC LAYER
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
  'goals_v2': 'goals_v2',
  'kpiConfig': 'kpiConfig',
  'kpiEntries': 'kpiEntries',
  'lineTmpl': 'lineTmpl',
  'emailTmpl': 'emailTmpl',
  'dailylog': 'dailylog',
  'favorites': 'favorites',
  'appearance': 'appearance',
  'actions': 'actions',
  'backup': 'backup'
};

var ALL_SYNC_KEYS = Object.keys(SYNC_KEY_MAP);

// ================================================================
// AUTH
// ================================================================
// แทนที่ function loginWithGoogle ใน firebase-sync.js
function loginWithGoogle() {
  var provider = new firebase.auth.GoogleAuthProvider();
  // เปลี่ยนจาก signInWithPopup เป็น signInWithRedirect
  auth.signInWithRedirect(provider);
}

// เพิ่ม handler ก่อนหน้า function loginWithGoogle
auth.getRedirectResult().then(function(result) {
  if (result.user) {
    CURRENT_USER = result.user;
    SYNC_ENABLED = true;
    var loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';
    toast('✅ Login: ' + result.user.displayName);
    migrateLocalToFirebase();
    initFirebaseListeners();
    if (typeof render === 'function') render();
  }
}).catch(function(error) {
  var errorEl = document.getElementById('loginError');
  if (errorEl) errorEl.textContent = error.message;
  console.error('Redirect login error:', error);
});

function useOffline() {
  SYNC_ENABLED = false;
  CURRENT_USER = null;
  document.getElementById('loginScreen').style.display = 'none';
  render();
}

function logoutUser() {
  auth.signOut().then(function() {
    CURRENT_USER = null;
    SYNC_ENABLED = false;
    toast('👋 Logout แล้ว');
    location.reload();
  });
}

// Check auth state on load
auth.onAuthStateChanged(function(user) {
  if (user) {
    CURRENT_USER = user;
    SYNC_ENABLED = true;
    document.getElementById('loginScreen').style.display = 'none';
    initFirebaseListeners();
    if (typeof render === 'function') render();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
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
  activeListeners.forEach(function(unsub) { unsub(); });
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
            localStorage.setItem(lsKey, JSON.stringify(doc.data().value));
            isSingleDoc = true;
            return;
          }
          var data = doc.data();
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
// ================================================================
// MIGRATE: localStorage → Firebase (first time)
// ================================================================
function migrateLocalToFirebase() {
  if (!SYNC_ENABLED || !CURRENT_USER) return;

  var migrated = localStorage.getItem('v7_migrated_' + CURRENT_USER.uid);
  if (migrated) return;

  toast('🔄 กำลัง sync ข้อมูลไป Cloud...');

  ALL_SYNC_KEYS.forEach(function(key) {
    var lsKey = 'v7_' + key;
    var data = localStorage.getItem(lsKey);
    if (!data) return;
    try {
      var parsed = JSON.parse(data);
      var collName = SYNC_KEY_MAP[key];
      syncToFirebase(collName, parsed);
    } catch(e) {
      console.warn('Migration error for ' + key, e);
    }
  });

  // Config
  var cfg = localStorage.getItem('v7_config');
  if (cfg) {
    try {
      db.collection('users').doc(CURRENT_USER.uid).collection('_config').doc('main').set(JSON.parse(cfg));
    } catch(e) {}
  }

  localStorage.setItem('v7_migrated_' + CURRENT_USER.uid, 'true');
  toast('✅ Sync เสร็จแล้ว!');
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
        // Find the key for this collection
        var key = ST._keys[coll];
        if (!key) return;
        var shortKey = key.replace('v7_', '');
        
        // Delete from Firebase
        if (id) {
          db.collection('users').doc(CURRENT_USER.uid).collection(shortKey).doc(id).delete().catch(function(e) {
            console.warn('Delete sync error:', coll, id, e);
          });
        }
        
        // Also sync the updated array
        try {
          var items = JSON.parse(localStorage.getItem(key) || '[]');
          var ref = db.collection('users').doc(CURRENT_USER.uid).collection(shortKey);
          // Re-sync entire collection to be safe
          if (Array.isArray(items)) {
            items.forEach(function(item) {
              if (item && item.id) {
                ref.doc(item.id).set(item).catch(function(e) {});
              }
            });
          }
        } catch(e) {}
      }
    };
    
    console.log('✅ ST._set override ready');
    console.log('✅ ST.delete override ready');
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
    if (key === 'v7_appearance') return;  // 👈 เพิ่มข้าม appearance
    if (key === 'v7_viewMode') return;    // 👈 เพิ่มข้าม viewMode (ค่าเป็น string ไม่ใช่ JSON)
    if (key === 'v7_favorites') return;   // 👈 เพิ่มข้าม favorites

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
      // ถ้า parse ไม่ได้ ให้ข้ามไป (ไม่ sync)
    }
  });

  // Config
  var cfg = localStorage.getItem('v7_config');
  if (cfg) {
    try {
      db.collection('users').doc(CURRENT_USER.uid).collection('_config').doc('main').set(JSON.parse(cfg));
    } catch(e) {}
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