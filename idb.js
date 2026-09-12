// ================================================================
// IDB — ที่เก็บข้อมูลก้อนใหญ่ แยกออกจาก localStorage
// ================================================================
// สมุดเดินของ DJI ก้อนเดียว (4,541 แถว) กินพื้นที่ราว 1.5 MB จากโควตา localStorage ที่มีประมาณ 5 MB
// ต่อโดเมน — นำเข้าไฟล์ที่ใหญ่กว่านี้หรือสะสมไปเรื่อยๆ แล้วจะชนเพดาน แล้วตอนชนไม่ได้พังแค่สมุดเดินของ
// แต่พังทั้งแอพ เพราะทุก collection ใช้โควตาก้อนเดียวกัน (localStorage.setItem โยน QuotaExceededError
// ให้ทุกจุดที่เขียน ไม่ว่าจะเขียนอะไร)
//
// IndexedDB มีโควตาระดับหลายร้อย MB และเก็บ object ตรงๆ ไม่ต้อง JSON.stringify แต่เป็น API แบบ async
// ล้วน ส่วนแอพนี้วาดจอแบบ sync ทั้งหมด (ST.getAll แล้ววาดเลย) จึงใช้ท่านี้แทน:
//   เปิดแอพ → โหลดเข้าหน่วยความจำครั้งเดียว → อ่านจากหน่วยความจำ (sync เหมือนเดิม) → เขียนลง IDB เบื้องหลัง
// ถ้าเบราว์เซอร์ไม่มี IndexedDB (โหมดส่วนตัวบางตัว) ST จะถอยกลับไปใช้ localStorage แบบเดิมให้เอง
// ================================================================
var IDB_DB = 'djiSalesBig', IDB_STORE = 'big', _idbPromise = null;

function idbOpen() {
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise(function(resolve, reject) {
    if (typeof indexedDB === 'undefined' || !indexedDB) { reject(new Error('ไม่มี IndexedDB')); return; }
    var req;
    try { req = indexedDB.open(IDB_DB, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = function() {
      var db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error || new Error('เปิด IndexedDB ไม่สำเร็จ')); };
    req.onblocked = function() { reject(new Error('IndexedDB ถูกล็อกจากแท็บอื่น')); };
  });
  return _idbPromise;
}

function _idbTx(mode, fn) {
  return idbOpen().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(IDB_STORE, mode);
      var store = tx.objectStore(IDB_STORE);
      var out;
      try { out = fn(store); } catch (e) { reject(e); return; }
      tx.oncomplete = function() { resolve(out && out.result !== undefined ? out.result : null); };
      tx.onerror = function() { reject(tx.error || new Error('IndexedDB ผิดพลาด')); };
      tx.onabort = function() { reject(tx.error || new Error('IndexedDB ยกเลิกรายการ')); };
    });
  });
}

function idbLoad(key) { return _idbTx('readonly', function(s) { return s.get(key); }); }
function idbSave(key, val) { return _idbTx('readwrite', function(s) { return s.put(val, key); }); }
function idbDrop(key) { return _idbTx('readwrite', function(s) { return s.delete(key); }); }

if (typeof window !== 'undefined') {
  window.idbLoad = idbLoad; window.idbSave = idbSave; window.idbDrop = idbDrop;
}
