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
  gender: null,
  infoGelombang: null       // data gelombang aktif dari action=info
};

// ============================================================================
// INIT
// ============================================================================

document.addEventListener('DOMContentLoaded', function () {
  state.clientToken = generateToken();
  updateStepUI(1);

  // Fetch info gelombang aktif
  muatInfoGelombang();

  // Set max date tgl_lahir ke hari ini (tidak bisa pilih masa depan)
  var today = new Date().toISOString().split('T')[0];
  var tglInput = document.getElementById('tgl_lahir');
  if (tglInput) tglInput.setAttribute('max', today);

  // Dynamic year di footer
  var tahunEl = document.getElementById('tahun-footer');
  if (tahunEl) tahunEl.textContent = new Date().getFullYear();

  // Event listener gender — IIFE untuk fix closure bug (el ter-capture dari scope luar)
  ['gender-putra', 'gender-putri'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    (function(inputEl) {
      inputEl.addEventListener('change', function() {
        state.gender = this.value;
        state.jadwalTerpilih = null;
        inputEl.closest('.gender-row').querySelectorAll('.gender-card').forEach(function(c) {
          c.classList.remove('selected');
        });
        inputEl.closest('.gender-card').classList.add('selected');
        tampilkanError('gender', false);
      });
    })(el);
  });

  // Event listener jenis_biaya card — IIFE untuk fix closure bug
  ['jenis_biaya-reguler', 'jenis_biaya-beasiswa'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    (function(inputEl) {
      inputEl.addEventListener('change', function() {
        inputEl.closest('.gender-row').querySelectorAll('.gender-card').forEach(function(c) {
          c.classList.remove('selected');
        });
        inputEl.closest('.gender-card').classList.add('selected');
        tampilkanError('jenis_biaya', false);
      });
    })(el);
  });

  // Event listener pernah_tahsin card — IIFE untuk fix closure bug
  ['pernah_tahsin-ya', 'pernah_tahsin-tidak'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    (function(inputEl) {
      inputEl.addEventListener('change', function() {
        inputEl.closest('.gender-row').querySelectorAll('.gender-card').forEach(function(c) {
          c.classList.remove('selected');
        });
        inputEl.closest('.gender-card').classList.add('selected');
        tampilkanError('pernah_tahsin', false);
      });
    })(el);
  });
});

// ============================================================================
// INFO GELOMBANG
// ============================================================================

function muatInfoGelombang() {
  fetchBackend('GET', { action: 'info' })
    .then(function (res) {
      if (res && res.ok && res.data) {
        state.infoGelombang = res.data;
        tampilkanBannerGelombang(res.data);
      }
    })
    .catch(function () {
      // Gagal fetch info gelombang — tidak blokir form, banner tetap tersembunyi
    });
}

function tampilkanBannerGelombang(info) {
  var bannerGel   = document.getElementById('banner-gelombang');
  var bannerTutup = document.getElementById('banner-ditutup');
  // FIX #5: tombol di index.html pakai id="btn-next-1", bukan "btn-lanjut-1"
  var btnLanjut1  = document.getElementById('btn-next-1');

  if (!info) return;

  // Tampilkan banner gelombang jika ada nama
  if (info.nama) {
    var elNama    = document.getElementById('banner-nama-gelombang');
    var elPeriode = document.getElementById('banner-periode-gelombang');
    var elBadge   = document.getElementById('banner-status-gelombang');

    if (elNama)    elNama.textContent    = info.nama;
    if (elPeriode) elPeriode.textContent = _labelPeriode(info.tgl_mulai, info.tgl_selesai);
    if (elBadge) {
      var st = String(info.status || '').toUpperCase();
      elBadge.textContent = st === 'AKTIF' ? 'Aktif' : (st === 'SELESAI' ? 'Selesai' : st);
      elBadge.className   = 'banner-gelombang-badge' + (st === 'AKTIF' ? ' aktif' : st === 'SELESAI' ? ' selesai' : '');
    }
    if (bannerGel) bannerGel.style.display = 'block';
  }

  // Jika pendaftaran ditutup — tampilkan banner merah + nonaktifkan tombol lanjut step 1
  if (!info.pendaftaran_buka) {
    if (bannerTutup) bannerTutup.style.display = 'flex';
    if (btnLanjut1) {
      btnLanjut1.disabled  = true;
      btnLanjut1.classList.add('btn-submit-disabled');
      btnLanjut1.title     = 'Pendaftaran saat ini ditutup.';
    }
  }
}

function _labelPeriode(tglMulai, tglSelesai) {
  if (!tglMulai && !tglSelesai) return '';
  if (tglMulai && tglSelesai)   return formatTanggal(tglMulai) + ' – ' + formatTanggal(tglSelesai);
  if (tglMulai)                 return 'Mulai ' + formatTanggal(tglMulai);
  return 'Tutup ' + formatTanggal(tglSelesai);
}

// ============================================================================
// NAVIGASI ANTAR STEP
// ============================================================================

function keStep1() {
  updateStepUI(1);
}

function keStep2() {
  if (!validasiStep1()) return;
  updateStepUI(2);
}

function keStep3() {
  if (!validasiStep2()) return;
  updateStepUI(3);
  // Tampilkan badge gender di step 3 (jadwal)
  var badgeText = document.getElementById('gender-badge-text');
  if (badgeText) badgeText.textContent = state.gender || '—';
  muatJadwal();
}

function keStep4() {
  if (!state.jadwalTerpilih) {
    document.getElementById('err-jadwal').style.display = 'block';
    return;
  }
  document.getElementById('err-jadwal').style.display = 'none';
  isiKonfirmasi();
  updateStepUI(4);
}

function updateStepUI(step) {
  state.step = step;

  // Tampilkan/sembunyikan card — 4 step
  document.getElementById('step-1').style.display = step === 1 ? 'block' : 'none';
  document.getElementById('step-2').style.display = step === 2 ? 'block' : 'none';
  document.getElementById('step-3').style.display = step === 3 ? 'block' : 'none';
  document.getElementById('step-4').style.display = step === 4 ? 'block' : 'none';

  // Update indikator step — loop 1..4
  for (var i = 1; i <= 4; i++) {
    var indEl = document.getElementById('step-ind-' + i);
    indEl.classList.remove('active', 'done');
    if (i < step)  indEl.classList.add('done');
    if (i === step) indEl.classList.add('active');

    // Update dot: tampilkan checkmark jika done
    var dot = indEl.querySelector('.step-dot');
    dot.textContent = i < step ? '✓' : String(i);
  }

  // Update garis — loop 1..3
  for (var j = 1; j <= 3; j++) {
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
// VALIDASI STEP 1 — Data Diri (5 field)
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

// ============================================================================
// VALIDASI STEP 2 — Kesiapan & Komitmen (6 field)
// ============================================================================

function validasiStep2() {
  var valid = true;

  // Jenis Biaya Program
  var jenisBiayaEl = document.querySelector('input[name="jenis_biaya"]:checked');
  if (!jenisBiayaEl) {
    tampilkanError('jenis_biaya', true); valid = false;
  } else { tampilkanError('jenis_biaya', false); }

  // Kemampuan Awal
  var kemampuanEl = document.getElementById('kemampuan_awal');
  if (!kemampuanEl || !kemampuanEl.value) {
    tampilkanError('kemampuan_awal', true); valid = false;
  } else { tampilkanError('kemampuan_awal', false); }

  // Pernah Tahsin
  var pernahEl = document.querySelector('input[name="pernah_tahsin"]:checked');
  if (!pernahEl) {
    tampilkanError('pernah_tahsin', true); valid = false;
  } else { tampilkanError('pernah_tahsin', false); }

  // Motivasi
  var motivasiEl = document.getElementById('motivasi');
  if (!motivasiEl || motivasiEl.value.trim().length < 10) {
    tampilkanError('motivasi', true); valid = false;
  } else { tampilkanError('motivasi', false); }

  // Komitmen
  var komitmenInput = document.getElementById('komitmen-input');
  if (!komitmenInput || !komitmenInput.checked) {
    tampilkanError('komitmen', true); valid = false;
  } else { tampilkanError('komitmen', false); }

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

// ============================================================================
// MUAT JADWAL DARI BACKEND (Step 2)
// ============================================================================

function muatJadwal() {
  // Reset jadwal terpilih saat masuk step 3
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
    grid.innerHTML = '<p style="color:var(--ink-muted);font-size:0.9rem;text-align:center;padding:var(--space-6);line-height:1.7">Qadarullah, kuota Halaqah sudah penuh, semoga Allah mudahkan untuk bisa belajar di kesempatan berikutnya.</p>';
    return;
  }

  list.forEach(function (j) {
    // 'penuh' (blokir) HANYA bila admin menutup slot (server: j.penuh). Slot penuh kursi
    // confirmed → waiting list: tetap bisa dipilih, pendaftar diberi tahu.
    var ditutup  = j.penuh === true;
    var waiting  = !ditutup && j.waiting_list === true;
    var sisa     = j.sisa != null ? j.sisa : ((j.kuota_maks || 12) - (j.terisi || 0));
    var hampir   = !ditutup && !waiting && sisa <= 3;
    var kuotaLabel = ditutup ? 'Ditutup' : (waiting ? 'Daftar Tunggu' : (hampir ? 'Sisa ' + sisa : 'Tersedia'));
    var kuotaClass = ditutup ? 'penuh' : (waiting ? 'waiting' : (hampir ? 'hampir-penuh' : ''));

    var card = document.createElement('label');
    card.className = 'jadwal-card' + (ditutup ? ' penuh' : (waiting ? ' waiting' : ''));
    card.setAttribute('for', 'jadwal-' + j.jadwal_id);
    if (!ditutup) {
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', 'false');
    }

    card.innerHTML =
      '<input type="radio" name="jadwal" id="jadwal-' + j.jadwal_id + '" value="' + j.jadwal_id + '"' + (ditutup ? ' disabled' : '') + '>' +
      '<div class="jadwal-kuota ' + kuotaClass + '">' + kuotaLabel + '</div>' +
      (waiting ? '<div class="jadwal-waiting-note">Kuota penuh — Anda tetap dapat mendaftar dan akan masuk ke daftar tunggu.</div>' : '') +
      '<div class="jadwal-nama">' + esc(j.program) + '</div>' +
      // Hari & Jam — ditampilkan besar dan mencolok
      '<div class="jadwal-schedule">' +
        '<div class="jadwal-schedule-item">' +
          '<span class="jadwal-schedule-label">Hari</span>' +
          '<span class="jadwal-schedule-value">' + esc(j.hari || '—') + '</span>' +
        '</div>' +
        '<div class="jadwal-schedule-divider"></div>' +
        '<div class="jadwal-schedule-item">' +
          '<span class="jadwal-schedule-label">Jam</span>' +
          '<span class="jadwal-schedule-value">' + esc(j.jam || '—') + '</span>' +
        '</div>' +
      '</div>' +
      // Info tambahan kecil
      '<div class="jadwal-meta">' +
        (j.pengajar ? '<span>👤 ' + esc(j.pengajar) + '</span>' : '') +
        (j.gender   ? '<span>👥 ' + esc(j.gender) + '</span>' : '') +
      '</div>';

    if (!ditutup) {
      // FIX #1: Wrap dalam IIFE agar j dan card ter-capture dengan benar
      // tanpa IIFE, semua listener akan pakai nilai j dan card dari iterasi terakhir
      (function(jadwal, cardEl) {
        cardEl.addEventListener('click', function () {
          pilihJadwal(jadwal, cardEl);
        });
        cardEl.addEventListener('keydown', function(e) {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            pilihJadwal(jadwal, cardEl);
          }
        });
      })(j, card);
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
// KONFIRMASI (Step 4)
// ============================================================================

function isiKonfirmasi() {
  var j = state.jadwalTerpilih;

  document.getElementById('konfirm-nama').textContent    = document.getElementById('nama').value.trim();
  document.getElementById('konfirm-hp').textContent      = document.getElementById('hp').value.trim();
  document.getElementById('konfirm-email').textContent   = document.getElementById('email').value.trim() || '—';
  document.getElementById('konfirm-tgl').textContent     = formatTanggal(document.getElementById('tgl_lahir').value);
  document.getElementById('konfirm-gender').textContent  = state.gender || '—';
  document.getElementById('konfirm-program').textContent = j ? j.program : '—';
  var isWaiting = !!(j && j.waiting_list);
  document.getElementById('konfirm-jadwal').textContent  =
    j ? (j.hari + ', ' + j.jam + (isWaiting ? ' — Daftar Tunggu' : '')) : '—';

  // Blok persetujuan daftar tunggu: tampil & wajib dicentang hanya bila jadwal penuh
  var wWarn = document.getElementById('waiting-warning');
  var wAck  = document.getElementById('waiting-ack');
  if (wWarn) wWarn.style.display = isWaiting ? 'block' : 'none';
  if (wAck && !isWaiting) wAck.checked = false;

  // Field baru
  var konfBiaya = document.getElementById('konfirm-jenis_biaya');
  if (konfBiaya) {
    var biayaCk = document.querySelector('input[name="jenis_biaya"]:checked');
    konfBiaya.textContent = biayaCk ? biayaCk.value : '—';
  }

  var konfKemampuan = document.getElementById('konfirm-kemampuan');
  if (konfKemampuan) konfKemampuan.textContent = document.getElementById('kemampuan_awal').value || '—';

  var konfPernah = document.getElementById('konfirm-pernah_tahsin');
  if (konfPernah) {
    var pernahCk = document.querySelector('input[name="pernah_tahsin"]:checked');
    konfPernah.textContent = pernahCk ? pernahCk.value : '—';
  }
}

// ============================================================================
// SUBMIT PENDAFTARAN
// ============================================================================

function submitPendaftaran() {
  var btn = document.getElementById('btn-submit');

  // FIX #3: guard jika jadwalTerpilih null (user submit tanpa melalui step 3)
  if (!state.jadwalTerpilih) {
    tampilkanAlert('Pilih jadwal terlebih dahulu.');
    return;
  }

  // Bila jadwal terpilih penuh (waiting list), persetujuan wajib dicentang dulu
  var ackEl = document.getElementById('waiting-ack');
  var ackChecked = ackEl ? ackEl.checked : false;
  if (state.jadwalTerpilih.waiting_list && !ackChecked) {
    tampilkanAlert('Centang dulu persetujuan daftar tunggu untuk melanjutkan.');
    var wWarn = document.getElementById('waiting-warning');
    if (wWarn) { wWarn.style.display = 'block'; wWarn.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (ackEl) ackEl.focus();
    return;
  }

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
    waiting_ack:  ackChecked ? 'true' : 'false',
    client_token: state.clientToken,
    jenis_biaya:    (document.querySelector('input[name="jenis_biaya"]:checked') || {}).value || '',
    kemampuan_awal: document.getElementById('kemampuan_awal').value,
    pernah_tahsin:  (document.querySelector('input[name="pernah_tahsin"]:checked') || {}).value || '',
    motivasi:       document.getElementById('motivasi').value.trim(),
    komitmen:       document.getElementById('komitmen-input').checked ? 'true' : 'false',
    saran_masukan:  (document.getElementById('saran_masukan') || {}).value
                      ? document.getElementById('saran_masukan').value.trim() : ''
  };

  fetchBackend('POST', body)
    .then(function (res) {
      setLoading(btn, false);
      if (res.ok) {
        tampilkanModalSukses(res.no_pendaftaran, res.waiting_list === true);
      } else if (res.error === 'PERLU_KONFIRMASI_WAITING') {
        // TOCTOU: slot penuh setelah form dimuat. Tandai waiting & minta persetujuan,
        // lalu pendaftar submit ulang (client_token sama → idempoten, tak ada baris ganda).
        if (state.jadwalTerpilih) state.jadwalTerpilih.waiting_list = true;
        isiKonfirmasi();
        var wWarn = document.getElementById('waiting-warning');
        if (wWarn) { wWarn.style.display = 'block'; wWarn.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        var ackEl2 = document.getElementById('waiting-ack');
        if (ackEl2) ackEl2.focus();
        tampilkanAlert('Jadwal ini baru saja penuh. Centang persetujuan daftar tunggu untuk melanjutkan.');
      } else {
        var pesan = res.pesan || res.error || 'Terjadi kesalahan. Silakan coba lagi.';
        if (pesan.indexOf('sudah terdaftar') !== -1 || pesan.indexOf('duplikat') !== -1) {
          tampilkanAlert('Nomor HP ini sudah terdaftar. Gunakan halaman Cek Status untuk melihat status pendaftaran Anda.');
        } else if (res.error === 'JADWAL_DITUTUP') {
          tampilkanAlert('Pendaftaran untuk jadwal ini sudah ditutup. Silakan kembali dan pilih jadwal lain.');
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

function tampilkanModalSukses(nomorPendaftaran, waitingList) {
  document.getElementById('nomor-pendaftaran').textContent = nomorPendaftaran || '—';
  var wNote = document.getElementById('modal-waiting-note');
  if (wNote) wNote.style.display = waitingList ? 'block' : 'none';
  var modal = document.getElementById('modal-sukses');
  modal.classList.add('visible');
  document.getElementById('btn-salin').focus();
}

function salinNomor() {
  var nomor = document.getElementById('nomor-pendaftaran').textContent;
  var btn   = document.getElementById('btn-salin');

  function redirectKeShare() {
    setTimeout(function () {
      window.location.href = 'share.html?no=' + encodeURIComponent(nomor);
    }, 1200);
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(nomor).then(function () {
      btn.classList.add('copied');
      document.getElementById('salin-icon').textContent = '✓';
      document.getElementById('salin-text').textContent = 'Tersalin! Mengalihkan...';
      redirectKeShare();
    }).catch(function() {
      redirectKeShare();
    });
  } else {
    // FIX #7: execCommand('copy') deprecated — pakai modern clipboard API dengan fallback
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(nomor).then(function() {
          btn.classList.add('copied');
          document.getElementById('salin-text').textContent = 'Tersalin! Mengalihkan...';
          redirectKeShare();
        }).catch(function() {
          _fallbackCopy(nomor, btn);
        });
      } else {
        _fallbackCopy(nomor, btn);
      }
    } catch (err) {
      _fallbackCopy(nomor, btn);
    }
  }
}

function _fallbackCopy(nomor, btn) {
  var el = document.createElement('textarea');
  el.value = nomor;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(el);
  btn.classList.add('copied');
  document.getElementById('salin-text').textContent = 'Tersalin! Mengalihkan...';
  redirectKeShare();
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

  // POST — gunakan URLSearchParams agar tidak trigger preflight CORS
  var searchParams = new URLSearchParams();
  Object.keys(params).forEach(function(k) {
    searchParams.append(k, params[k]);
  });

  return Promise.race([
    fetch(url, { method: 'POST', body: searchParams }).then(function(r) { return r.json(); }),
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
