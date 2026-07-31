/**
 * status.js — Logic halaman cek status pendaftaran
 * Rattilil Qur'an PMB
 */

document.addEventListener('DOMContentLoaded', function () {
  // Set max date ke hari ini
  var today = new Date().toISOString().split('T')[0];
  var tglInput = document.getElementById('tgl_verif');
  if (tglInput) tglInput.setAttribute('max', today);

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
  var valid = true;
  if (!no || !/^RTL\d{4,}$/.test(no)) {
    tampilkanError('no', true);
    valid = false;
  } else {
    tampilkanError('no', false);
  }
  if (!tgl) {
    tampilkanError('tgl', true);
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
  var status = data.status || 'TERDAFTAR';

  // Nomor pendaftaran pill
  document.getElementById('hasil-nomor').textContent = data.no_pendaftaran || '—';

  // Detail info
  document.getElementById('hasil-nama').textContent     = data.nama || '—';
  document.getElementById('hasil-program').textContent  = data.program || '—';
  document.getElementById('hasil-jadwal').textContent   = data.jadwal || data.jadwal_id || '—';
  document.getElementById('hasil-tanggal').textContent  = formatTanggal(data.timestamp || data.tgl_daftar);

  // Hero status
  var hero = document.getElementById('status-hero');
  hero.className = 'status-hero s-' + status;
  document.getElementById('status-icon').textContent      = ikonStatus(status);
  document.getElementById('status-hero-label').textContent = 'Status Pendaftaran';
  document.getElementById('status-hero-text').textContent  = labelStatus(status);
  document.getElementById('status-hero-desc').textContent  = deskripsiStatus(status);

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

var ALUR_STATUS = [
  { key: 'TERDAFTAR', label: 'Terdaftar',        sub: 'Data diterima',         icon: '📝' },
  { key: 'BERKAS_OK', label: 'Berkas Diperiksa',  sub: 'Berkas lengkap',        icon: '📋' },
  { key: 'WAWANCARA', label: 'Wawancara',          sub: 'Jadwal dikonfirmasi',   icon: '💬' },
  { key: 'DITERIMA',  label: 'Diterima',           sub: 'Selamat bergabung!',    icon: '✅' }
];

function renderTimeline(statusAktif) {
  var container = document.getElementById('status-timeline');
  container.innerHTML = '';

  if (statusAktif === 'DITOLAK') {
    container.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:16px;background:rgba(239,68,68,.06);border-radius:0 0 var(--r) var(--r)">' +
      '<div style="width:36px;height:36px;border-radius:50%;background:rgba(239,68,68,.12);border:2px solid #fca5a5;display:flex;align-items:center;justify-content:center;flex-shrink:0">❌</div>' +
      '<div><div style="font-size:0.88rem;font-weight:700;color:#b91c1c">Tidak Diterima</div>' +
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
    'BERKAS_OK':  'Berkas Diperiksa',
    'WAWANCARA':  'Jadwal Wawancara',
    'DITERIMA':   'Diterima! 🎉',
    'DITOLAK':    'Tidak Diterima'
  };
  return map[status] || status;
}

function ikonStatus(status) {
  var map = {
    'TERDAFTAR': '📝',
    'BERKAS_OK': '📋',
    'WAWANCARA': '💬',
    'DITERIMA':  '✅',
    'DITOLAK':   '❌'
  };
  return map[status] || '📄';
}

function deskripsiStatus(status) {
  var map = {
    'TERDAFTAR': 'Bismillah. Data pendaftaran Anda telah kami terima dengan baik. Tim kami sedang memproses berkas Anda. Semoga Allah memudahkan setiap langkah.',
    'BERKAS_OK': 'Alhamdulillah. Berkas Anda telah diperiksa dan dinyatakan lengkap. Menunggu jadwal wawancara. Baarakallahu fiikum.',
    'WAWANCARA': 'Alhamdulillah. Anda dijadwalkan untuk wawancara. Semoga Allah memberi kemudahan dan kelancaran. Tawakkal ilallah.',
    'DITERIMA':  'Alhamdulillahirabbil\'aalamin. Selamat! Anda resmi diterima sebagai murid Rattilil Qur\'an. Semoga Allah memberkahi perjalanan Anda dalam menghafal dan memahami Al-Qur\'an. بَارَكَ اللهُ فِيكُمْ',
    'DITOLAK':   'Innalillahi wa inna ilaihi raji\'un. Mohon maaf, pendaftaran Anda belum dapat kami terima saat ini. Semoga Allah membuka pintu kebaikan yang lebih baik. Hubungi admin untuk informasi lebih lanjut.'
  };
  return map[status] || '';
}

function statusClass(status) {
  var valid = ['TERDAFTAR','BERKAS_OK','DITERIMA','DITOLAK','WAWANCARA'];
  return valid.indexOf(status) !== -1 ? 'status-' + status : 'status-default';
}

function formatTanggal(val) {
  if (!val) return '—';
  // Handle ISO timestamp
  var d = new Date(val);
  if (!isNaN(d.getTime())) {
    var bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
  }
  return val;
}

function tampilkanError(field, tampil) {
  var input = field === 'no'  ? document.getElementById('no_pendaftaran') : document.getElementById('tgl_verif');
  var err   = field === 'no'  ? document.getElementById('err-no')         : document.getElementById('err-tgl');
  if (!input || !err) return;
  if (tampil) {
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
      setTimeout(function() { reject(new Error('timeout')); }, CONFIG.REQUEST_TIMEOUT || 30000);
    })
  ]);
}
