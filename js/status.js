/**
 * status.js — Logic halaman cek status pendaftaran
 * Rattilil Qur'an PMB
 */

document.addEventListener('DOMContentLoaded', function () {
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
  if (!no || !/^RTL\d{6,}$/.test(no)) {
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
  document.getElementById('detail-box').classList.remove('visible');

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
  // Nomor & badge status
  document.getElementById('hasil-nomor').textContent  = data.no_pendaftaran || '—';
  document.getElementById('hasil-nama').textContent   = data.nama || '—';
  document.getElementById('hasil-program').textContent = data.program || '—';
  document.getElementById('hasil-jadwal').textContent = data.jadwal || data.jadwal_id || '—';
  document.getElementById('hasil-tanggal').textContent = formatTanggal(data.timestamp || data.tgl_daftar);

  // Badge status
  var badge = document.getElementById('hasil-badge');
  var status = data.status || 'TERDAFTAR';
  badge.textContent = labelStatus(status);
  badge.className = 'status-badge ' + (statusClass(status));

  // Catatan publik
  var catatanBox = document.getElementById('catatan-box');
  if (data.catatan_publik && data.catatan_publik.trim()) {
    document.getElementById('hasil-catatan').textContent = data.catatan_publik;
    catatanBox.style.display = 'block';
  } else {
    catatanBox.style.display = 'none';
  }

  // Timeline status
  renderTimeline(status);

  document.getElementById('detail-box').classList.add('visible');
  document.getElementById('detail-box').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================================================
// TIMELINE STATUS
// ============================================================================

var ALUR_STATUS = [
  { key: 'TERDAFTAR',   label: 'Terdaftar',       icon: '📝' },
  { key: 'BERKAS_OK',   label: 'Berkas Diperiksa', icon: '📋' },
  { key: 'WAWANCARA',   label: 'Wawancara',        icon: '💬' },
  { key: 'DITERIMA',    label: 'Diterima',         icon: '✅' }
];

function renderTimeline(statusAktif) {
  var container = document.getElementById('status-timeline');
  container.innerHTML = '';

  if (statusAktif === 'DITOLAK') {
    container.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--coral-soft);border-radius:var(--radius-md);font-size:0.85rem;color:#B91C1C">' +
      '<span>✕</span><span>Pendaftaran tidak dapat dilanjutkan. Hubungi admin untuk informasi lebih lanjut.</span></div>';
    return;
  }

  var aktifIdx = -1;
  ALUR_STATUS.forEach(function(s, i) {
    if (s.key === statusAktif) aktifIdx = i;
  });

  ALUR_STATUS.forEach(function(s, i) {
    var done    = i < aktifIdx;
    var aktif   = i === aktifIdx;
    var pending = i > aktifIdx;

    var item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 0;' + (i < ALUR_STATUS.length - 1 ? 'border-bottom:1px solid var(--outline);' : '');

    var dot = document.createElement('div');
    dot.style.cssText = 'width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0;';
    if (done)    dot.style.background = 'var(--leaf-soft)';
    if (aktif)   dot.style.background = 'var(--sky-soft)';
    if (pending) dot.style.background = 'var(--surface-sunken)';
    dot.textContent = done ? '✓' : s.icon;

    var label = document.createElement('div');
    label.style.cssText = 'font-size:0.88rem;font-weight:' + (aktif ? '700' : '400') + ';color:' +
      (done ? 'var(--leaf-deep)' : aktif ? 'var(--sky-deep)' : 'var(--ink-faint)') + ';';
    label.textContent = s.label;

    if (aktif) {
      var badge = document.createElement('span');
      badge.style.cssText = 'margin-left:auto;font-size:0.72rem;font-weight:700;padding:2px 10px;border-radius:var(--radius-full);background:var(--sky-soft);color:var(--sky-deep);';
      badge.textContent = 'Saat ini';
      item.appendChild(dot);
      item.appendChild(label);
      item.appendChild(badge);
    } else {
      item.appendChild(dot);
      item.appendChild(label);
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
    'BERKAS_OK':  'Berkas OK',
    'WAWANCARA':  'Wawancara',
    'DITERIMA':   'Diterima',
    'DITOLAK':    'Tidak Diterima'
  };
  return map[status] || status;
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
