// แยกจาก inline <script> เดิมใน index.html เพื่อให้ใส่ defer ได้ (defer ใช้กับ inline script ไม่ได้ ต้องมี src)
// ต้องอยู่หลัง firebase-*-compat.js ทั้ง 4 ไฟล์เสมอ (เรียงด้วย defer รับประกันลำดับ execution ตามที่ปรากฏใน HTML)
firebase.initializeApp({
  apiKey: "AIzaSyB_qYvFINwOehVQ1Y6UJW9bHRL1iYcyM7w",
  authDomain: "work-assistant-9e024.firebaseapp.com",
  projectId: "work-assistant-9e024",
  storageBucket: "work-assistant-9e024.firebasestorage.app",
  messagingSenderId: "796607223436",
  appId: "1:796607223436:web:1455abe90b141104678da9"
});
var db = firebase.firestore();
// เปิด offline persistence (เก็บ Firestore cache ไว้ใน IndexedDB ของเครื่อง) — เดิมไม่เปิดเลย ทำให้ทุกครั้งที่
// เขียนขึ้น Firestore (syncItemToFirebase ฯลฯ) เป็นแค่ .set() ลอยๆ ในหน่วยความจำ ถ้าผู้ใช้กด F5/รีเฟรช/ปิดแอป
// เร็วเกินไปก่อน request ไปถึงเซิร์ฟเวอร์ (เน็ตช้า/มือถือ) รอบโหลดหน้าใหม่ initFirebaseListeners() จะ subscribe
// แล้วเจอว่า Firestore ยังเป็นข้อมูลเก่า (เพราะ write ไม่เคยไปถึงจริง) แล้วเขียนทับ localStorage ทำให้ข้อมูลที่
// เพิ่งสร้าง/แก้ "หายไป" ทั้งที่หน้าจอเพิ่งยืนยันว่าบันทึกสำเร็จ (ใบเสนอราคา ฯลฯ) — เปิด persistence ทำให้ write
// ที่ยังไม่ทันส่งถูกเก็บคิวไว้ในเครื่องด้วย พอโหลดหน้าใหม่ onSnapshot จะเห็นค่าที่เพิ่งเขียนจาก cache ทันที
// ไม่ต้องรอ round-trip ไปเซิร์ฟเวอร์ก่อน — synchronizeTabs ไว้เผื่อเปิดแอปพร้อมกันหลายแท็บ (เช่นหน้าต่าง
// Visit Report/Quotation แบบเต็มจอที่เปิดแท็บแยก) ให้ยัง sync ข้ามแท็บได้ตามปกติ
// ถ้าเบราว์เซอร์ไม่รองรับ (เช่น private mode บางตัว) ก็แค่ทำงานแบบเดิม ไม่กระทบการใช้งานอื่น
db.enablePersistence({ synchronizeTabs: true }).catch(function(e) {
  console.warn('Firestore offline persistence ไม่พร้อมใช้งาน:', e.code);
});
var auth = firebase.auth();
