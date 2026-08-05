// ================================================================
// GOOGLE SHEET SYNC — แอป → Sheet ทางเดียวเท่านั้น (Sheet → แอป ยังใช้ปุ่ม Import เดิม มี preview)
// ผ่าน Google Apps Script Web App (ดู sheet-sync-apps-script.gs ในโปรเจกต์นี้สำหรับสคริปต์ที่ต้อง deploy)
// ตั้งค่า URL/Secret ที่ ⚙️ ตั้งค่า → ☁️ เชื่อมต่อ → Google Sheet Sync (ดู admin.js)
//
// จับคู่แถวด้วย ROW NO. เดียวกับระบบ import (_pipeFindExistingForImport) — sync เฉพาะ Pipeline ที่มี
// Row No. แล้วเท่านั้น (ยังไม่มีเลข = ข้าม รอผู้ใช้พิมพ์เลขให้ตรงกับชีทก่อนค่อย sync) กันสร้างแถวมั่วในชีท
//
// ยิงทันทีทุกครั้งที่ ST.add/ST.update('pipeline', ...) — fire-and-forget ไม่ block การบันทึกในแอป
// ถ้ายิงไม่สำเร็จ (เน็ตหลุด/Sheet ปิด/Apps Script error) แค่ log ไว้ดูเฉยๆ ไม่มี retry queue เพราะ Sheet
// เป็นแค่สำเนาไว้ดู ไม่ใช่ source of truth — ข้อมูลจริงยังอยู่ครบใน Firestore เสมอ พลาดรอบเดียวไม่ทำให้ข้อมูลหาย
// ================================================================

function sheetSyncPushPipeline(pipeId) {
  if (!SHEET_SYNC_ENABLED || !SHEET_SYNC_URL) return;
  var p = ST.getOne('pipeline', pipeId);
  if (!p || !p.rowNo || !String(p.rowNo).trim()) return; // ยังไม่มี Row No. — ข้าม รอมีค่อย sync

  var values = _pipeRowFields(p);
  var fields = {};
  PIPE_SHEET_HEADERS.forEach(function(h, i) { fields[h] = values[i]; });

  fetch(SHEET_SYNC_URL, {
    method: 'POST',
    // text/plain กัน CORS preflight ของ Apps Script Web App (ฝั่งสคริปต์ยัง parse เป็น JSON ได้ปกติ)
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret: SHEET_SYNC_SECRET, rowNo: String(p.rowNo).trim(), fields: fields })
  })
    .then(function(res) { return res.json(); })
    .then(function(json) {
      if (!json || !json.ok) console.warn('Sheet Sync error:', json && json.error);
    })
    .catch(function(e) { console.warn('Sheet Sync network error:', e); });
}

(function() {
  var checkST = setInterval(function() {
    if (typeof ST === 'undefined' || !ST.add || !ST.update) return;
    clearInterval(checkST);

    var _origAdd = ST.add.bind(ST);
    ST.add = function(coll, data) {
      var saved = _origAdd(coll, data);
      if (coll === 'pipeline') sheetSyncPushPipeline(saved.id);
      return saved;
    };

    var _origUpdate = ST.update.bind(ST);
    ST.update = function(coll, id, updates) {
      var result = _origUpdate(coll, id, updates);
      if (coll === 'pipeline') sheetSyncPushPipeline(id);
      return result;
    };
  }, 100);
})();
