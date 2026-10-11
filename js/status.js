/**
 * status.js — Logic halaman cek status pendaftaran
 * Rattilil Qur'an PMB
 */

document.addEventListener('DOMContentLoaded', function () {
  // Set max date ke hari ini (zona lokal)
  var d = new Date();
  var today = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  var tglInput = document.getElementById('tgl_verif');
  if (tglInput) {
    tglInput.setAttribute('max', today);
    tglInput.setAttribute('min', '1900-01-01');
  }

  // Dynamic year di footer
  var tahunEl = document.getElementById('tahun-footer');
  if (tahunEl) tahunEl.textContent = new Date().getFullYear();
  // Jika ada query param ?no=RTL24180001 langsung isi
  var params = new URLSearchParams(window.location.search);
  var no = params.get('no');
  if (no) {
    document.getElementById('no_pendaftaran').value = no.toUpperCase();
  }

  // Enter key trigger cek
  document.getElementById('no_pendaftaran').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') cekStatus();
  });
  document.getElementById('tgl_verif').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') cekStatus();
  });

  // Auto uppercase no pendaftaran
  document.getElementById('no_pendaftaran').addEventListener('input', function() {
    this.value = this.value.toUpperCase();
    tampilkanError('no', false);
  });
  document.getElementById('tgl_verif').addEventListener('input', function() {
    tampilkanError('tgl', false);
  });
});

// ============================================================================
// CEK STATUS
// ============================================================================

function cekStatus() {
  var no   = document.getElementById('no_pendaftaran').value.trim().toUpperCase();
  var tgl  = document.getElementById('tgl_verif').value.trim();
  var btn  = document.getElementById('btn-cek');

  // Validasi
  var dNow = new Date();
  var maxTgl = dNow.getFullYear() + '-' + ('0' + (dNow.getMonth() + 1)).slice(-2) + '-' + ('0' + dNow.getDate()).slice(-2);
  var valid = true;
  if (!no) {
    tampilkanError('no', true, 'Nomor pendaftaran wajib diisi.');
    valid = false;
  } else if (!/^RTL\d{4,}$/.test(no)) {
    tampilkanError('no', true, 'Format nomor pendaftaran tidak valid (contoh: RTL24180400).');
    valid = false;
  } else {
    tampilkanError('no', false);
  }
  if (!tgl) {
    tampilkanError('tgl', true, 'Tanggal lahir wajib diisi.');
    valid = false;
  } else if (tgl < '1900-01-01' || tgl > maxTgl) {
    tampilkanError('tgl', true, 'Tanggal lahir tidak valid.');
    valid = false;
  } else {
    tampilkanError('tgl', false);
  }
  if (!valid) return;

  setLoading(btn, true);
  sembunyikanAlert();
  document.getElementById('result-wrapper').classList.remove('visible');

  fetchBackend({ action: 'cekStatus', no: no, verif: tgl })
    .then(function (res) {
      setLoading(btn, false);
      if (res.ok && res.data) {
        tampilkanHasil(res.data);
      } else {
        var pesan = res.pesan || res.error || 'Data tidak ditemukan.';
        if (pesan.indexOf('tidak ditemukan') !== -1 || pesan.indexOf('verifikasi') !== -1) {
          tampilkanAlert('Nomor pendaftaran atau tanggal lahir tidak sesuai. Periksa kembali data Anda.');
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
// TAMPILKAN HASIL
// ============================================================================

function tampilkanHasil(data) {
  var status = data.status || 'WAWANCARA';   // status awal pendaftaran (sejak Okt 2026)
  // Tahap pemeriksaan berkas dihapus (Okt 2026). Data lama terarsip yang masih BERKAS_OK
  // ditampilkan setara "Terdaftar" (label, warna, keterangan, dan timeline sekaligus).
  if (status === 'BERKAS_OK') status = 'TERDAFTAR';

  // Nomor pendaftaran pill
  document.getElementById('hasil-nomor').textContent = data.no_pendaftaran || '—';

  // Detail info
  document.getElementById('hasil-nama').textContent     = data.nama || '—';
  document.getElementById('hasil-program').textContent  = data.program || '—';
  document.getElementById('hasil-jadwal').textContent   = data.jadwal || data.jadwal_id || '—';
  document.getElementById('hasil-tanggal').textContent  = formatTanggal(data.timestamp || data.tgl_daftar);

  // Hero status
  var hero = document.getElementById('status-hero');
  // BATAL memakai gaya visual yang sama dengan DITOLAK (kelas CSS s-BATAL tidak ada).
  hero.className = 'status-hero s-' + (status === 'BATAL' ? 'DITOLAK' : status);
  document.getElementById('status-icon').textContent      = ikonStatus(status);
  document.getElementById('status-hero-label').textContent = 'Status Pendaftaran';
  document.getElementById('status-hero-text').textContent  = labelStatus(status);
  // Daftar tunggu: belum ada kursi → keterangan tahap Wawancara (ramah tamah) belum berlaku;
  // tampilkan kabar daftar tunggu (kalimat sama dengan modal formulir pendaftaran).
  document.getElementById('status-hero-desc').textContent  =
    (data.waiting_list && status === 'WAWANCARA')
      ? 'Anda masuk daftar tunggu. Kursi utama untuk jadwal ini sudah penuh — kami akan menghubungi Anda bila ada kursi tersedia.'
      : deskripsiStatus(status);

  // Chip Daftar Tunggu (waiting list) — dibuat/di-update dinamis di dalam hero
  var chip = document.getElementById('status-waiting-chip');
  if (data.waiting_list) {
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'status-waiting-chip';
      chip.className = 'status-waiting-chip';
      hero.appendChild(chip);
    }
    chip.textContent = '⏳ Daftar Tunggu — menunggu kursi tersedia';
    chip.style.display = '';
  } else if (chip) {
    chip.style.display = 'none';
  }

  // Catatan publik
  var catatanBox = document.getElementById('catatan-box');
  var catatan = data.catatan_publik || data.catatan || '';
  if (catatan.trim()) {
    document.getElementById('hasil-catatan').textContent = catatan;
    catatanBox.classList.add('visible');
  } else {
    catatanBox.classList.remove('visible');
  }

  // Timeline status
  renderTimeline(status);

  // Tampilkan result wrapper
  var wrapper = document.getElementById('result-wrapper');
  wrapper.classList.add('visible');
  wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================================
// TIMELINE STATUS
// ============================================================================

// Alur sejak Okt 2026: daftar → langsung tahap Wawancara (pemeriksaan berkas dihapus —
// tidak ada berkas yang diunggah). "Terdaftar" tetap tampil sebagai langkah pertama yang
// selesai begitu pendaftaran diterima.
var ALUR_STATUS = [
  { key: 'TERDAFTAR', label: 'Terdaftar',  sub: 'Data diterima',                 icon: '📝' },
  { key: 'WAWANCARA', label: 'Wawancara',  sub: 'Ramah tamah bersama pengajar',  icon: '💬' },
  { key: 'DITERIMA',  label: 'Diterima',   sub: 'Selamat bergabung!',            icon: '✅' }
];


function renderTimeline(statusAktif) {
  var container = document.getElementById('status-timeline');
  container.innerHTML = '';

  if (statusAktif === 'DITOLAK' || statusAktif === 'BATAL') {
    var judul = statusAktif === 'BATAL' ? 'Pendaftaran Dibatalkan' : 'Tidak Diterima';
    container.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:16px;background:rgba(239,68,68,.06);border-radius:0 0 var(--r) var(--r)">' +
      '<div style="width:36px;height:36px;border-radius:50%;background:rgba(239,68,68,.12);border:2px solid #fca5a5;display:flex;align-items:center;justify-content:center;flex-shrink:0">❌</div>' +
      '<div><div style="font-size:0.88rem;font-weight:700;color:#b91c1c">' + judul + '</div>' +
      '<div style="font-size:0.75rem;color:#ef4444;margin-top:2px">Hubungi admin untuk informasi lebih lanjut</div></div></div>';
    return;
  }

  var aktifIdx = -1;
  ALUR_STATUS.forEach(function(s, i) {
    if (s.key === statusAktif) aktifIdx = i;
  });

  ALUR_STATUS.forEach(function(s, i) {
    var done    = i < aktifIdx;
    var current = i === aktifIdx;
    var pending = i > aktifIdx;

    var item = document.createElement('div');
    item.className = 'timeline-item';

    var dot = document.createElement('div');
    dot.className = 'timeline-dot ' + (done ? 'done' : current ? 'current' : 'pending');
    dot.textContent = done ? '✓' : s.icon;

    var info = document.createElement('div');
    info.className = 'timeline-info';

    var name = document.createElement('div');
    name.className = 'timeline-name' + (pending ? ' pending' : '');
    name.textContent = s.label;

    var sub = document.createElement('div');
    sub.className = 'timeline-sub';
    sub.textContent = done ? s.sub : (current ? 'Tahap saat ini' : 'Menunggu');

    info.appendChild(name);
    info.appendChild(sub);
    item.appendChild(dot);
    item.appendChild(info);

    if (current) {
      var badge = document.createElement('span');
      badge.className = 'timeline-badge';
      badge.textContent = 'Saat ini';
      item.appendChild(badge);
    }

    container.appendChild(item);
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function labelStatus(status) {
  var map = {
    'TERDAFTAR':  'Terdaftar',
    'WAWANCARA':  'Tahap Wawancara',
    'DITERIMA':   'Diterima! 🎉',
    'DITOLAK':    'Tidak Diterima',
    'BATAL':      'Dibatalkan'
  };
  return map[status] || status;
}

function ikonStatus(status) {
  var map = {
    'TERDAFTAR': '📝',
    'WAWANCARA': '💬',
    'DITERIMA':  '✅',
    'DITOLAK':   '❌',
    'BATAL':     '❌'
  };
  return map[status] || '📄';
}

function deskripsiStatus(status) {
  var map = {
    // TERDAFTAR: status lama (data terarsip; juga BERKAS_OK yang disetarakan di tampilkanHasil).
    'TERDAFTAR': 'Bismillah. Data pendaftaran Anda telah kami terima dengan baik. Semoga Allah memudahkan setiap langkah.',
    'WAWANCARA': 'Alhamdulillah, pendaftaran Anda telah kami terima. Tahap berikutnya adalah ramah tamah — sesi diskusi dan wawancara bersama para pengajar. Detail jadwal wawancara akan segera disampaikan oleh panitia. Semoga Allah memberi kemudahan dan kelancaran.',
    'DITERIMA':  'Alhamdulillahirabbil\'aalamin. Selamat! Anda resmi diterima sebagai murid Rattilil Qur\'an. Semoga Allah memberkahi perjalanan Anda dalam mempelajari Al-Qur\'an. بَارَكَ اللهُ فِيكُمْ',
    'DITOLAK':   'Innalillahi wa inna ilaihi raji\'un. Mohon maaf, pendaftaran Anda belum dapat kami terima saat ini. Semoga Allah membuka pintu kebaikan yang lebih baik. Hubungi admin untuk informasi lebih lanjut.',
    'BATAL':     'Pendaftaran Anda telah dibatalkan. Bila ini keliru atau Anda ingin mendaftar kembali, silakan hubungi admin.'
  };
  return map[status] || '';
}

// FIX #8: statusClass dihapus — fungsi tidak pernah dipanggil (dead code)
// CSS class status ditangani langsung di tampilkanHasil() via 'status-' + status

function formatTanggal(val) {
  if (!val) return '—';
  var parts = String(val).trim().split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    var bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    var bIdx = parseInt(parts[1], 10) - 1;
    var tgl = parseInt(parts[2], 10);
    if (bIdx >= 0 && bIdx < 12 && !isNaN(tgl)) {
      return tgl + ' ' + bulan[bIdx] + ' ' + parts[0];
    }
  }
  // Handle ISO timestamp
  var d = new Date(val);
  if (!isNaN(d.getTime())) {
    var bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
  }
  return val;
}

function tampilkanError(field, tampil, pesan) {
  var input = field === 'no'  ? document.getElementById('no_pendaftaran') : document.getElementById('tgl_verif');
  var err   = field === 'no'  ? document.getElementById('err-no')         : document.getElementById('err-tgl');
  if (!input || !err) return;
  if (tampil) {
    if (pesan) err.textContent = pesan;
    input.classList.add('error');
    err.classList.add('visible');
  } else {
    input.classList.remove('error');
    err.classList.remove('visible');
  }
}

function tampilkanAlert(pesan) {
  var banner = document.getElementById('alert-banner');
  document.getElementById('alert-message').textContent = pesan;
  banner.classList.add('visible');
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

function fetchBackend(params) {
  var url = CONFIG.BACKEND_URL;
  var qs = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  url = url + '?' + qs;

  return Promise.race([
    fetch(url).then(function(r) { return r.json(); }),
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('timeout')); }, CONFIG.REQUEST_TIMEOUT || 60000);
    })
  ]);
}
