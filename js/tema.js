/**
 * tema.js — tombol tema gelap/terang di navbar formulir.
 * Memakai kunci localStorage 'theme' yang sama dengan situs utama, sehingga pilihan
 * di beranda berlaku juga di formulir (dan sebaliknya).
 */
(function () {
  var btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var gelap = !document.documentElement.classList.contains('theme-dark');
    document.documentElement.classList.toggle('theme-dark', gelap);
    try {
      localStorage.setItem('theme', gelap ? 'dark' : 'light');
      localStorage.removeItem('rattilil-theme');   // kunci lama formulir
    } catch (e) {}
  });
})();
