// ================================================================
// SERVICE WORKER — DJI Sales Assistant
// กลยุทธ์: navigation (index.html) = network-first เหมือนเดิม (ไฟล์เล็ก อยากได้ shell ล่าสุดเสมอเมื่อออนไลน์)
// asset อื่น (JS/CSS — ก้อนหนักที่สุด รวมกัน ~5MB จาก ~40 ไฟล์) = stale-while-revalidate: ตอบจากแคชทันที
// ถ้ามี (ไม่ต้องรอ fetch() จบก่อน) แล้วค่อยอัพเดตแคชเบื้องหลังเงียบๆ ให้รอบหน้าได้ของใหม่ — เดิมทั้งหมด
// เป็น network-first หมด ทำให้ทุกครั้งที่เปิดแอปต้องรอ fetch() ของทั้ง ~40 ไฟล์ (แม้จะมีแคชพร้อมใช้แล้ว)
// บนมือถือที่เน็ตช้า/หน่วงตัวนี้คือสาเหตุหลักที่แอปค้าง/โหลดนานมาก เพราะของที่ควรตอบจากแคชได้ทันที
// กลับต้องรอ network ก่อนเสมอ (ผู้ใช้แจ้ง 2026-09-21) — แลกมาด้วยโค้ดใหม่หลัง deploy อาจช้าไปหนึ่งรอบเปิดแอป
// ก่อนแคชจะอัพเดตให้เอง (ไม่ต้องรอ user สั่งอะไรเพิ่ม)
// ================================================================
var CACHE_VERSION = 'dji-sales-v707';   // ⬅️ bump เลขนี้ทุกครั้งที่ deploy โค้ดใหม่ (v1 → v2 → v3 ...)

// app shell ที่จะ precache (relative path → ทำงานใต้ /work-assistant/)
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './firebase-init.js',
  './utils.js',
  './idb.js',
  './storage.js',
  './products.js',
  './firebase-sync.js',
  './sheet-sync.js',
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
  './views-pipehealth.js',
  './views-kpiplan.js',
  './views-salesoverview.js',
  './views-salesanalytics.js',
  './views-so.js',
  './views-runrate.js',
  './views-djiledger.js',
  './views-worklist.js',
  './views-djiprojects.js',
  './views-stock.js',
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

// ---- FETCH: same-origin GET เท่านั้น (cross-origin — Firebase/gstatic/cdn — ปล่อยผ่านตรงเสมอ) ----
self.addEventListener('fetch', function(event) {
  var req = event.request;

  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // navigation (เปิดหน้าแรก/รีเฟรช) — network-first เหมือนเดิม
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function(res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function(cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function() {
        return caches.match(req).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // asset อื่นๆ (JS/CSS/manifest ฯลฯ) — stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.match(req).then(function(cached) {
        var networkFetch = fetch(req).then(function(res) {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        }).catch(function() { return cached; }); // offline และไม่เคยแคชไว้ → undefined ปล่อยให้ fetch ล้มตามจริง
        return cached || networkFetch;
      });
    })
  );
});
