/**
 * app.js — Logic form pendaftaran multi-step
 * Rattilil Qur'an PMB
 */

// ============================================================================
// STATE
// ============================================================================

var state = {
  step: 1,
  jadwalList: [],
  jadwalTerpilih: null,
  clientToken: null,
  gender: null
};

// ============================================================================
// INIT
// ============================================================================

document.addEventListener('DOMContentLoaded', function () {
  state.clientToken = generateToken();
  updateStepUI(1);

  // Event listener gender
  ['gender-putra', 'gender-putri'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function() {
      state.gender = this.value;
      state.jadwalTerpilih = null; // reset jadwal saat gender berubah

      // Update visual selected
      document.querySelectorAll('.gender-card').forEach(function(c) {
        c.classList.remove('selected');
      });
      el.closest('.gender-card').classList.add('selected');
      tampilkanError('gender', false);
    });
  });
});

// ============================================================================
// NAVIGASI ANTAR STEP
// ============================================================================

function keStep1() {
  updateStepUI(1);
}

function keStep2() {
  if (!validasiStep1()) return;
  updateStepUI(2);
  // Tampilkan badge gender di step 2
  var badgeText = document.getElementById('gender-badge-text');
  if (badgeText) badgeText.textContent = state.gender || '—';
  muatJadwal();
}

function keStep3() {
  if (!state.jadwalTerpilih) {
    document.getElementById('err-jadwal').style.display = 'block';
    return;
  }
  document.getElementById('err-jadwal').style.display = 'none';
  isiKonfirmasi();
  updateStepUI(3);
}

function updateStepUI(step) {
  state.step = step;

  // Tampilkan/sembunyikan card
  document.getElementById('step-1').style.display = step === 1 ? 'block' : 'none';
  document.getElementById('step-2').style.display = step === 2 ? 'block' : 'none';
  document.getElementById('step-3').style.display = step === 3 ? 'block' : 'none';

  // Update indikator step
  for (var i = 1; i <= 3; i++) {
    var indEl = document.getElementById('step-ind-' + i);
    indEl.classList.remove('active', 'done');
    if (i < step)  indEl.classList.add('done');
    if (i === step) indEl.classList.add('active');

    // Update dot: tampilkan checkmark jika done
    var dot = indEl.querySelector('.step-dot');
    dot.textContent = i < step ? '✓' : String(i);
  }

  // Update garis
  for (var j = 1; j <= 2; j++) {
    var line = document.getElementById('line-' + j);
    if (j < step) {
      line.classList.add('done');
    } else {
      line.classList.remove('done');
    }
  }

  sembunyikanAlert();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================
// VALIDASI STEP 1
// ============================================================================

function validasiStep1() {
  var valid = true;

  var nama  = document.getElementById('nama').value.trim();
  var hp    = document.getElementById('hp').value.trim();
  var email = document.getElementById('email').value.trim();
  var tgl   = document.getElementById('tgl_lahir').value;

  // Nama
  if (!nama) {
    tampilkanError('nama', true);
    valid = false;
  } else {
    tampilkanError('nama', false);
  }

  // HP
  var hpBersih = hp.replace(/\D/g, '');
  if (!hp || hpBersih.length < 9 || hpBersih.length > 15 || !/^(08|628|\+628)/.test(hp.replace(/\s/g, ''))) {
    tampilkanError('hp', true);
    valid = false;
  } else {
    tampilkanError('hp', false);
  }

  // Email (wajib diisi dan harus valid)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    tampilkanError('email', true);
    valid = false;
  } else {
    tampilkanError('email', false);
  }

  // Tanggal lahir
  if (!tgl) {
    tampilkanError('tgl_lahir', true);
    valid = false;
  } else {
    tampilkanError('tgl_lahir', false);
  }

  // Gender
  var genderEl = document.querySelector('input[name="gender"]:checked');
  if (!genderEl) {
    tampilkanError('gender', true);
    valid = false;
  } else {
    state.gender = genderEl.value;
    tampilkanError('gender', false);
  }

  return valid;
}

function tampilkanError(field, tampil) {
  var input = document.getElementById(field);
  var err   = document.getElementById('err-' + field);
  if (!input || !err) return;

  if (tampil) {
    input.classList.add('error');
    err.classList.add('visible');
  } else {
    input.classList.remove('error');
    err.classList.remove('visible');
  }
}

// Hapus error saat user mulai mengetik
['nama','hp','email','tgl_lahir'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', function() { tampilkanError(id, false); });
  }
});

// ============================================================================
// MUAT JADWAL DARI BACKEND (Step 2)
// ============================================================================

function muatJadwal() {
  // Reset jadwal terpilih saat masuk step 2
  state.jadwalTerpilih = null;

  if (state.jadwalList.length > 0) {
    renderJadwal(filterJadwalByGender(state.jadwalList));
    return;
  }

  document.getElementById('jadwal-loading').style.display = 'block';
  document.getElementById('jadwal-grid').innerHTML = '';

  fetchBackend('GET', { action: 'jadwal' })
    .then(function (res) {
      document.getElementById('jadwal-loading').style.display = 'none';
      if (res.ok && res.data) {
        state.jadwalList = res.data;
        renderJadwal(filterJadwalByGender(res.data));
      } else {
        tampilkanAlert('Gagal memuat jadwal. Silakan muat ulang halaman.');
      }
    })
    .catch(function () {
      document.getElementById('jadwal-loading').style.display = 'none';
      tampilkanAlert('Koneksi bermasalah. Periksa internet Anda dan coba lagi.');
    });
}

function filterJadwalByGender(list) {
  if (!state.gender) return list;
  return list.filter(function(j) {
    // Tampilkan jika gender cocok atau field gender kosong (untuk semua)
    if (!j.gender) return true;
    return j.gender.toLowerCase() === state.gender.toLowerCase();
  });
}

function renderJadwal(list) {
  var grid = document.getElementById('jadwal-grid');
  grid.innerHTML = '';

  if (!list || list.length === 0) {
    grid.innerHTML = '<p style="color:var(--ink-muted);font-size:0.9rem;text-align:center;padding:var(--space-6)">Belum ada jadwal tersedia saat ini.</p>';
    return;
  }

  list.forEach(function (j) {
    var penuh    = j.status_slot === 'PENUH';
    var sisa     = (j.kuota_maks || 13) - (j.terisi || 0);
    var hampir   = !penuh && sisa <= 3;
    var kuotaLabel = penuh ? 'Penuh' : (hampir ? 'Sisa ' + sisa : 'Tersedia');
    var kuotaClass = penuh ? 'penuh' : (hampir ? 'hampir-penuh' : '');

    var card = document.createElement('label');
    card.className = 'jadwal-card' + (penuh ? ' penuh' : '');
    card.setAttribute('for', 'jadwal-' + j.jadwal_id);
    if (!penuh) {
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', 'false');
    }

    card.innerHTML =
      '<input type="radio" name="jadwal" id="jadwal-' + j.jadwal_id + '" value="' + j.jadwal_id + '"' + (penuh ? ' disabled' : '') + '>' +
      '<div class="jadwal-kuota ' + kuotaClass + '">' + kuotaLabel + '</div>' +
      '<div class="jadwal-nama">' + esc(j.program) + '</div>' +
      '<div class="jadwal-meta">' +
        '<span>📅 ' + esc(j.hari || '—') + '</span>' +
        '<span>🕐 ' + esc(j.jam || '—') + '</span>' +
        (j.pengajar ? '<span>👤 ' + esc(j.pengajar) + '</span>' : '') +
        (j.gender   ? '<span>👥 ' + esc(j.gender) + '</span>' : '') +
      '</div>';

    if (!penuh) {
      card.addEventListener('click', function () {
        pilihJadwal(j, card);
      });
      card.addEventListener('keydown', function(e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          pilihJadwal(j, card);
        }
      });
    }

    grid.appendChild(card);
  });
}

function pilihJadwal(jadwal, cardEl) {
  // Deselect semua
  document.querySelectorAll('.jadwal-card').forEach(function(c) {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });

  // Select yang dipilih
  cardEl.classList.add('selected');
  cardEl.setAttribute('aria-checked', 'true');
  var radio = cardEl.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;

  state.jadwalTerpilih = jadwal;
  document.getElementById('err-jadwal').style.display = 'none';
}

// ============================================================================
// KONFIRMASI (Step 3)
// ============================================================================

function isiKonfirmasi() {
  var j = state.jadwalTerpilih;

  document.getElementById('konfirm-nama').textContent    = document.getElementById('nama').value.trim();
  document.getElementById('konfirm-hp').textContent      = document.getElementById('hp').value.trim();
  document.getElementById('konfirm-email').textContent   = document.getElementById('email').value.trim() || '—';
  document.getElementById('konfirm-tgl').textContent     = formatTanggal(document.getElementById('tgl_lahir').value);
  document.getElementById('konfirm-gender').textContent  = state.gender || '—';
  document.getElementById('konfirm-program').textContent = j ? j.program : '—';
  document.getElementById('konfirm-jadwal').textContent  = j ? (j.hari + ', ' + j.jam) : '—';
}

// ============================================================================
// SUBMIT PENDAFTARAN
// ============================================================================

function submitPendaftaran() {
  var btn = document.getElementById('btn-submit');
  setLoading(btn, true);
  sembunyikanAlert();

  var body = {
    action:       'submit',
    nama:         document.getElementById('nama').value.trim(),
    hp:           document.getElementById('hp').value.trim(),
    email:        document.getElementById('email').value.trim(),
    tgl_lahir:    document.getElementById('tgl_lahir').value,
    gender:       state.gender || '',
    jadwal_id:    state.jadwalTerpilih ? state.jadwalTerpilih.jadwal_id : '',
    program:      state.jadwalTerpilih ? state.jadwalTerpilih.program : '',
    client_token: state.clientToken
  };

  fetchBackend('POST', body)
    .then(function (res) {
      setLoading(btn, false);
      if (res.ok) {
        tampilkanModalSukses(res.no_pendaftaran);
      } else {
        var pesan = res.pesan || res.error || 'Terjadi kesalahan. Silakan coba lagi.';
        // Cek apakah error karena duplikat HP
        if (pesan.indexOf('sudah terdaftar') !== -1 || pesan.indexOf('duplikat') !== -1) {
          tampilkanAlert('Nomor HP ini sudah terdaftar. Gunakan halaman Cek Status untuk melihat status pendaftaran Anda.');
        } else if (pesan.indexOf('penuh') !== -1 || pesan.indexOf('kuota') !== -1) {
          tampilkanAlert('Jadwal yang dipilih sudah penuh. Silakan kembali dan pilih jadwal lain.');
          // Paksa reload jadwal agar UI terupdate
          state.jadwalList = [];
        } else {
          tampilkanAlert(pesan);
        }
      }
    })
    .catch(function () {
      setLoading(btn, false);
      tampilkanAlert('Koneksi bermasalah. Periksa internet Anda dan coba lagi.');
    });
}

// ============================================================================
// MODAL SUKSES
// ============================================================================

function tampilkanModalSukses(nomorPendaftaran) {
  document.getElementById('nomor-pendaftaran').textContent = nomorPendaftaran || '—';
  var modal = document.getElementById('modal-sukses');
  modal.classList.add('visible');
  document.getElementById('btn-salin').focus();
}

function salinNomor() {
  var nomor = document.getElementById('nomor-pendaftaran').textContent;
  var btn   = document.getElementById('btn-salin');

  if (navigator.clipboard) {
    navigator.clipboard.writeText(nomor).then(function () {
      btn.classList.add('copied');
      document.getElementById('salin-icon').textContent = '✓';
      document.getElementById('salin-text').textContent = 'Tersalin!';
      setTimeout(function () {
        btn.classList.remove('copied');
        document.getElementById('salin-icon').textContent = '⎘';
        document.getElementById('salin-text').textContent = 'Salin Nomor';
      }, 2500);
    });
  } else {
    // Fallback untuk browser lama
    var el = document.createElement('textarea');
    el.value = nomor;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    btn.classList.add('copied');
    document.getElementById('salin-text').textContent = 'Tersalin!';
    setTimeout(function () {
      btn.classList.remove('copied');
      document.getElementById('salin-text').textContent = 'Salin Nomor';
    }, 2500);
  }
}

// ============================================================================
// FETCH HELPER
// ============================================================================

function fetchBackend(method, params) {
  var url = CONFIG.BACKEND_URL;

  if (method === 'GET') {
    var qs = Object.keys(params).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    url = url + '?' + qs;
    return Promise.race([
      fetch(url).then(function(r) { return r.json(); }),
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('timeout')); }, CONFIG.REQUEST_TIMEOUT || 30000);
      })
    ]);
  }

  // POST — kirim sebagai form-encoded agar tidak trigger preflight CORS
  var formData = new FormData();
  Object.keys(params).forEach(function(k) {
    formData.append(k, params[k]);
  });

  return Promise.race([
    fetch(url, { method: 'POST', body: formData }).then(function(r) { return r.json(); }),
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('timeout')); }, CONFIG.REQUEST_TIMEOUT || 30000);
    })
  ]);
}

// ============================================================================
// UI HELPERS
// ============================================================================

function tampilkanAlert(pesan) {
  var banner = document.getElementById('alert-banner');
  document.getElementById('alert-message').textContent = pesan;
  banner.classList.add('visible');
  banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function sembunyikanAlert() {
  document.getElementById('alert-banner').classList.remove('visible');
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

function formatTanggal(iso) {
  if (!iso) return '—';
  var parts = iso.split('-');
  if (parts.length !== 3) return iso;
  var bulan = ['', 'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return parseInt(parts[2]) + ' ' + bulan[parseInt(parts[1])] + ' ' + parts[0];
}

function generateToken() {
  return 'tok-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
