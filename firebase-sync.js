// ================================================================
// FIREBASE SYNC LAYER
// ================================================================
var SYNC_ENABLED = false;
var CURRENT_USER = null;
var SYNC_COLLECTIONS = [
  'dealers', 'pipeline', 'pipelog', 'visits', 'followups',
  'tasks', 'tasklogs', 'meetings', 'feedback', 'lineLog',
  'emails', 'qnotes', 'routines', 'templates', 'notes',
  'waiting', 'pins', 'pipeActions', 'visitPlans', 'demo', 'quotes'
];

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
  // Clean existing listeners
  activeListeners.forEach(function(unsub) { unsub(); });
  activeListeners = [];

  SYNC_COLLECTIONS.forEach(function(collName) {
    var lsKey = 'v7_' + collName;
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

  // Check if already migrated
  var migrated = localStorage.getItem('v7_migrated_' + CURRENT_USER.uid);
  if (migrated) return;

  toast('🔄 กำลัง sync ข้อมูลไป Cloud...');

  SYNC_COLLECTIONS.forEach(function(collName) {
    var lsKey = 'v7_' + collName;
    var data = localStorage.getItem(lsKey);
    if (!data) return;
    try {
      var parsed = JSON.parse(data);
      syncToFirebase(collName, parsed);
    } catch(e) {}
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
// OVERRIDE ST (Storage) functions to sync
// ================================================================
var _origSTAdd = ST.add;
var _origSTUpdate = ST.update;
var _origSTDelete = ST.delete;
var _origSTSetObj = ST.setObj;

ST.add = function(coll, data) {
  var result = _origSTAdd.call(ST, coll, data);
  if (SYNC_ENABLED) {
    var items = JSON.parse(localStorage.getItem('v7_' + coll) || '[]');
    syncToFirebase(coll, items);
  }
  return result;
};

ST.update = function(coll, id, data) {
  var result = _origSTUpdate.call(ST, coll, id, data);
  if (SYNC_ENABLED) {
    var items = JSON.parse(localStorage.getItem('v7_' + coll) || '[]');
    syncToFirebase(coll, items);
  }
  return result;
};

ST.delete = function(coll, id) {
  var result = _origSTDelete.call(ST, coll, id);
  if (SYNC_ENABLED) {
    syncDeleteFromFirebase(coll, id);
  }
  return result;
};

ST.setObj = function(key, data) {
  var result = _origSTSetObj.call(ST, key, data);
  if (SYNC_ENABLED && key === 'config') {
    db.collection('users').doc(CURRENT_USER.uid).collection('_config').doc('main').set(data).catch(function(e) {});
  }
  return result;
};