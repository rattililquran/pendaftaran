/* js/config.js — Konfigurasi endpoint backend */

var CONFIG = {
  // URL Web App Google Apps Script — deployment AKTIF (diverifikasi merespons
  // action=info).Deployment lama yang sebelumnya ada di sini sudah tidak merespons
  // dan membuat semua request frontend gagal. Update juga saat deploy versi baru
  // (Deploy → Manage deployments → New version → salin URL ke sini).
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycbxYlR1MnbxBEmDpr5GqahYO3g2v6wUZfrda-N_VrgQua_5uKlRJx1X81-5lLim0Q9jTyw/exec',

  // Nama institusi (tampil di UI)
  NAMA_INSTITUSI: 'Rattilil Qur\'an',

  // Timeout request (ms)
  REQUEST_TIMEOUT: 30000
};
