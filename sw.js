/**
 * sw.js — Service Worker untuk PWA offline support
 * Rattilil Qur'an PMB
 */

var CACHE_NAME = 'rattilil-pmb-v7';
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

// Fetch — network first untuk API, cache first untuk asset
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Selalu ke network untuk request ke GAS backend
  if (url.indexOf('script.google.com') !== -1) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify({ ok: false, error: 'Tidak ada koneksi internet.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache first untuk asset lokal
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(res) {
        // Simpan ke cache jika request berhasil
        if (res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return res;
      });
    }).catch(function() {
      // Fallback ke index.html untuk navigasi
      if (e.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
