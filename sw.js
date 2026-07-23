// ================================================================
// SERVICE WORKER — DJI Sales Assistant
// กลยุทธ์: network-first (ได้โค้ดล่าสุดเสมอเมื่อออนไลน์) + cache fallback (ออฟไลน์)
// ================================================================
var CACHE_VERSION = 'dji-sales-v217';   // ⬅️ bump เลขนี้ทุกครั้งที่ deploy โค้ดใหม่ (v1 → v2 → v3 ...)

// app shell ที่จะ precache (relative path → ทำงานใต้ /work-assistant/)
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './utils.js',
  './storage.js',
  './products.js',
  './firebase-sync.js',
  './views-today.js',
  './modals.js',
  './views-dealer.js',
  './views-pipeline.js',
  './views-visit.js',
  './views-work.js',
  './views-prospects.js',
  './views-quotation.js',
  './kanban.js',
  './export.js',
  './admin.js',
  './features.js',
  './audit.js',
  './views-kpi.js',
  './views-so.js',
  './app.js'
];

// ---- INSTALL: precache (ทนต่อไฟล์ที่ 404 — ไม่ทำให้ install ล้ม) ----
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return Promise.allSettled(
        APP_SHELL.map(function(url) { return cache.add(url); })
      );
    }).then(function() { return self.skipWaiting(); })
  );
});

// ---- ACTIVATE: ลบ cache เวอร์ชันเก่า ----
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_VERSION; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// ---- FETCH: network-first สำหรับ same-origin GET เท่านั้น ----
self.addEventListener('fetch', function(event) {
  var req = event.request;

  // ข้าม: ไม่ใช่ GET, หรือ cross-origin (Firebase / gstatic / cdn) → ปล่อยผ่านตรง
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function(res) {
      // เก็บสำเนาลง cache (เฉพาะ response ที่ใช้ได้)
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function(cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function() {
      // ออฟไลน์ → ใช้ cache; ถ้าเป็น navigation และไม่มีใน cache ให้ fallback index.html
      return caches.match(req).then(function(cached) {
        return cached || caches.match('./index.html');
      });
    })
  );
});
