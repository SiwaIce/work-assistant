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
var auth = firebase.auth();
