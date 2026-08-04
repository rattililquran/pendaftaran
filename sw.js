/**
 * sw.js — Service Worker untuk PWA offline support
 * Rattilil Qur'an PMB
 */

var CACHE_NAME = 'rattilil-pmb-v11';
var ASSETS = [
  './',
  './index.html',
  './status.html',
  './program.html',
  './css/style.css',
  './js/config.js',
  './js/app.js',
  './js/status.js',
  './manifest.json'
];

// Install — cache semua asset static, abaikan file yang gagal
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // addAll gagal total jika satu file 404 — pakai add satu per satu
      return Promise.all(
        ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('SW: gagal cache ' + url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate — hapus cache lama
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy:
//  - GAS backend  → network only (dengan fallback JSON offline)
//  - HTML/JS/CSS & navigasi → NETWORK-FIRST (selalu versi terbaru; cache hanya fallback
//    offline). Ini mencegah kode basi/rusak dari cache — akar masalah "login is not
//    defined" & tampilan lama.
//  - Aset lain (gambar/font/manifest) → cache-first (jarang berubah, hemat kuota).
self.addEventListener('fetch', function(e) {
  var req = e.request;
  var url = req.url;

  // GAS backend — selalu network, sediakan fallback JSON bila offline.
  if (url.indexOf('script.google.com') !== -1) {
    e.respondWith(
      fetch(req).catch(function() {
        return new Response(JSON.stringify({ ok: false, error: 'Tidak ada koneksi internet.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Hanya tangani GET (biarkan POST/PUT lewat langsung ke network).
  if (req.method !== 'GET') return;

  function simpanKeCache(res) {
    if (res && res.status === 200) {
      var clone = res.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
    }
    return res;
  }

  var isKode = req.mode === 'navigate' || /\.(html|js|css)(\?|$)/.test(url);

  if (isKode) {
    // NETWORK-FIRST
    e.respondWith(
      fetch(req).then(simpanKeCache).catch(function() {
        return caches.match(req).then(function(cached) {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
      })
    );
    return;
  }

  // CACHE-FIRST untuk aset lain
  e.respondWith(
    caches.match(req).then(function(cached) {
      return cached || fetch(req).then(simpanKeCache);
    })
  );
});
