// ================================================================
// Google Apps Script — Web App รับข้อมูล Pipeline จาก DJI Sales Assistant
// ไฟล์นี้ไม่ได้ถูกโหลด/รันโดยตัวแอป — เป็นแค่สำเนาอ้างอิงเก็บไว้ในโปรเจกต์
// วิธี deploy จริง: เปิด Google Sheet ที่ใช้อยู่ → Extensions > Apps Script
// → วางโค้ดนี้ทับของเดิม → แก้ SHEET_NAME กับ SECRET ด้านล่าง → Deploy > New deployment
// → เลือกประเภท "Web app" → Execute as: Me, Who has access: Anyone
// → กด Deploy แล้ว copy URL ที่ได้ ไปใส่ในแอป ⚙️ ตั้งค่า → ☁️ เชื่อมต่อ → Google Sheet Sync
// ================================================================

var SHEET_NAME = 'Sheet1';        // ← เปลี่ยนเป็นชื่อ tab จริงที่เก็บข้อมูล Pipeline ในชีท
var SECRET = 'ตั้งรหัสลับเอง';    // ← ต้องตรงกับ Secret ที่ตั้งไว้ในแอป (Admin)

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (SECRET && data.secret !== SECRET) {
      return _resp({ ok: false, error: 'invalid secret' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return _resp({ ok: false, error: 'sheet not found: ' + SHEET_NAME });

    // จับคู่คอลัมน์ด้วยชื่อหัวตาราง (แถวที่ 1) ไม่ใช้ตำแหน่งตายตัว — สลับ/แทรกคอลัมน์ในชีทได้อิสระ
    var lastCol = sheet.getLastColumn();
    var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var headerIdx = {};
    headerRow.forEach(function (h, i) { headerIdx[String(h).trim()] = i + 1; });

    var rowNoCol = headerIdx['ROW NO.'];
    if (!rowNoCol) return _resp({ ok: false, error: 'ROW NO. column not found' });

    // หาแถวที่ ROW NO. ตรงกัน — ถ้าไม่เจอ ถือเป็นโครงการใหม่ เพิ่มแถวต่อท้าย
    var lastRow = sheet.getLastRow();
    var targetRow = -1;
    if (lastRow > 1) {
      var rowNoValues = sheet.getRange(2, rowNoCol, lastRow - 1, 1).getValues();
      for (var i = 0; i < rowNoValues.length; i++) {
        if (String(rowNoValues[i][0]).trim() === String(data.rowNo).trim()) {
          targetRow = i + 2;
          break;
        }
      }
    }
    if (targetRow === -1) targetRow = lastRow + 1;

    Object.keys(data.fields || {}).forEach(function (header) {
      var col = headerIdx[header];
      if (col) sheet.getRange(targetRow, col).setValue(data.fields[header]);
    });

    return _resp({ ok: true, row: targetRow });
  } catch (err) {
    return _resp({ ok: false, error: String(err) });
  }
}

function _resp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
