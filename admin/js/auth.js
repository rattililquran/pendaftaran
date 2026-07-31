/**
 * auth.js — Login & session management untuk Portal Admin
 * Rattilil Qur'an PMB
 */

// Cek apakah sudah login — redirect ke dashboard jika sudah
(function () {
  var token = sessionStorage.getItem('admin_token');
  if (token) {
    window.location.href = 'dashboard.html';
  }
})();

function login() {
  var password = document.getElementById('password').value.trim();
  var btn      = document.getElementById('btn-login');
  var alert    = document.getElementById('alert-login');

  if (!password) {
    tampilkanAlertLogin('Password tidak boleh kosong.');
    return;
  }

  sembunyikanAlertLogin();
  setLoading(btn, true);

  var url = CONFIG.BACKEND_URL + '?action=admin.login&password=' + encodeURIComponent(password);

  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (res) {
      setLoading(btn, false);
      if (res.ok && res.token) {
        sessionStorage.setItem('admin_token', res.token);
        window.location.href = 'dashboard.html';
      } else {
        tampilkanAlertLogin(res.pesan || 'Password salah. Coba lagi.');
      }
    })
    .catch(function () {
      setLoading(btn, false);
      tampilkanAlertLogin('Koneksi bermasalah. Periksa internet Anda.');
    });
}

// Enter key trigger login
document.addEventListener('DOMContentLoaded', function () {
  var input = document.getElementById('password');
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') login();
    });
  }
});

function tampilkanAlertLogin(pesan) {
  var el = document.getElementById('alert-login');
  document.getElementById('alert-login-msg').textContent = pesan;
  el.style.display = 'flex';
}

function sembunyikanAlertLogin() {
  document.getElementById('alert-login').style.display = 'none';
}

function setLoading(btn, loading) {
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}
