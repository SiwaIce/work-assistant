// ================================================================
// FIREBASE SYNC LAYER
// ================================================================
var SYNC_ENABLED = false;
var CURRENT_USER = null;
var SYNC_COLLECTIONS = [
  'dealers', 'pipeline', 'pipelog', 'visits', 'followups',
  'tasks', 'tasklogs', 'feedback', 'emails', 'pins'
];

// Key mapping: localStorage key (without v7_) → collection name
var SYNC_KEY_MAP = {
    'actions': 'actions',
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
  'backup': 'backup',
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
  'appearance': 'appearance'
};

var ALL_SYNC_KEYS = Object.keys(SYNC_KEY_MAP);

// ================================================================
// AUTH
// ================================================================
function loginWithGoogle() {
  var provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(function(result) {
    CURRENT_USER = result.user;
    SYNC_ENABLED = true;
    document.getElementById('loginScreen').style.display = 'none';
    toast('✅ Login: ' + result.user.displayName);
    migrateLocalToFirebase();
    initFirebaseListeners();
    render();
  }).catch(function(error) {
    document.getElementById('loginError').textContent = error.message;
  });
}

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
    render();
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
    // Save as individual docs
    data.forEach(function(item) {
      if (item.id) {
        ref.doc(item.id).set(item, {merge: true}).catch(function(e) {
          console.warn('Sync error:', collName, e);
        });
      }
    });
  } else {
    // Save as single doc
    ref.doc('_data').set({value: data}, {merge: true}).catch(function(e) {
      console.warn('Sync error:', collName, e);
    });
  }
}

function syncDeleteFromFirebase(collName, docId) {
  if (!SYNC_ENABLED || !CURRENT_USER) return;
  var ref = getCollectionRef(collName);
  if (!ref) return;
  ref.doc(docId).delete().catch(function(e) {
    console.warn('Delete sync error:', e);
  });
}

// ================================================================
// SYNC: Firebase → localStorage
// ================================================================
function pullFromFirebase(collName, callback) {
  if (!SYNC_ENABLED || !CURRENT_USER) return;
  var ref = getCollectionRef(collName);
  if (!ref) return;

  ref.get().then(function(snapshot) {
    var items = [];
    snapshot.forEach(function(doc) {
      if (doc.id === '_data') {
        // Single value
        if (callback) callback(doc.data().value);
        return;
      }
      var data = doc.data();
      data.id = doc.id;
      items.push(data);
    });
    if (items.length && callback) callback(items);
  }).catch(function(e) {
    console.warn('Pull error:', collName, e);
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
    }, function(error) {
      console.warn('Listener error:', collName, error);
    });

    activeListeners.push(unsub);
  });

  // Config sync
  var configRef = db.collection('users').doc(CURRENT_USER.uid).collection('_config');
  var unsub2 = configRef.doc('main').onSnapshot(function(doc) {
    if (doc.exists) {
      localStorage.setItem('v7_config', JSON.stringify(doc.data()));
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
// AUTO SYNC — Override ST._set directly
// ================================================================
(function() {
  // Wait for ST to be ready
  var checkST = setInterval(function() {
    if (typeof ST === 'undefined' || !ST._set) return;
    clearInterval(checkST);
    
    var _origSet = ST._set.bind(ST);
    
    ST._set = function(key, data) {
      // Call original
      _origSet(key, data);
      
      // Auto sync to Firebase
      if (typeof SYNC_ENABLED !== 'undefined' && SYNC_ENABLED && CURRENT_USER && key && key.indexOf('v7_') === 0) {
        var shortKey = key.replace('v7_', '');
        try {
          var ref = db.collection('users').doc(CURRENT_USER.uid).collection(shortKey);
          if (Array.isArray(data)) {
            data.forEach(function(item) {
              if (item && item.id) {
                ref.doc(item.id).set(item).catch(function(e) {
                  console.warn('Sync error:', shortKey, e);
                });
              }
            });
          } else {
            ref.doc('_data').set({value: data}).catch(function(e) {
              console.warn('Sync error:', shortKey, e);
            });
          }
        } catch(e) {
          console.warn('Sync error:', key, e);
        }
      }
    };
    
    console.log('✅ ST._set override ready');
  }, 100);
})();