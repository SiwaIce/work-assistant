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

// ปุ่ม "🧪 ทดสอบการเชื่อมต่อ" ใน Admin — ใช้ค่า URL/Secret ที่พิมพ์ในช่อง (ยังไม่ต้องกดบันทึกก่อนก็ทดสอบได้)
// ยิงแถวทดสอบจริงเข้าไปต่อท้ายชีท (ROW NO. = __TEST__ ไม่ตรงกับใครแน่นอน เลย append แถวใหม่เสมอ) แล้วโชว์
// ผลลัพธ์/ข้อความ error ตรงๆ ในหน้า Admin แทนที่จะไปดูใน console เฉยๆ เหมือนตอน sync ปกติ (fire-and-forget)
function testSheetSyncConnection() {
  var url = (document.getElementById('adm_sheetsync_url').value || '').trim();
  var secret = (document.getElementById('adm_sheetsync_secret').value || '').trim();
  var resultEl = document.getElementById('adm_sheetsync_test_result');
  if (!url) { if (resultEl) resultEl.innerHTML = '<span style="color:#ef4444">❌ ใส่ URL ก่อน</span>'; return; }
  if (resultEl) resultEl.innerHTML = '⏳ กำลังทดสอบ...';

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      secret: secret,
      rowNo: '__TEST__',
      fields: { 'ROW NO.': '__TEST__', 'Project Name': '(ทดสอบการเชื่อมต่อจากแอป — ลบแถวนี้ทิ้งได้)' }
    })
  })
    .then(function(res) { return res.json(); })
    .then(function(json) {
      if (!resultEl) return;
      if (json && json.ok) {
        resultEl.innerHTML = '<span style="color:#22c55e">✅ เชื่อมต่อสำเร็จ! เพิ่มแถวทดสอบที่แถว ' + json.row + ' ในชีท (เช็คแล้วลบทิ้งได้เลย)</span>';
      } else {
        resultEl.innerHTML = '<span style="color:#ef4444">❌ ' + sanitize((json && json.error) || 'ไม่ทราบสาเหตุ') + '</span>';
      }
    })
    .catch(function(e) {
      if (resultEl) resultEl.innerHTML = '<span style="color:#ef4444">❌ เชื่อมต่อไม่ได้: ' + sanitize(e.message) + ' (เช็ค URL ให้ถูก หรือลองเปิด URL ตรงๆ ใน browser ดูว่า deploy สำเร็จไหม)</span>';
    });
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
