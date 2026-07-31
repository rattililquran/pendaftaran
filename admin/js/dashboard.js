/**
 * dashboard.js — Logic Portal Admin
 * Rattilil Qur'an PMB
 */

// State
var state = {
  token: null,
  pendaftar: [],
  filteredData: [],
  jadwal: [],
  currentTab: 'pendaftar',
  selectedPendaftar: null,
  selectedJadwal: null,
  page: 1,
  pageSize: 20
};

// Cek auth & init
(function () {
  var token = sessionStorage.getItem('admin_token');
  if (!token) {
    window.location.href = 'index.html';
    return;
  }
  state.token = token;
  init();
})();

function init() {
  muatStats();
  muatPendaftar();
  muatJadwalOptions();
}

function logout() {
  sessionStorage.removeItem('admin_token');
  window.location.href = 'index.html';
}

// ============================================================================
// TAB SWITCHING
// ============================================================================

function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(function (el) {
    el.classList.remove('active');
  });
  document.getElementById('nav-' + tab).classList.add('active');

  var tabs = ['pendaftar', 'jadwal', 'gelombang', 'formfields'];
  tabs.forEach(function(t) {
    var el = document.getElementById('tab-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });

  var titles = {
    'pendaftar':  ['Pendaftar',       'Kelola data pendaftar murid baru'],
    'jadwal':     ['Jadwal & Kuota',  'Kelola jadwal dan kuota per program'],
    'gelombang':  ['Gelombang',       'Kelola gelombang dan status pendaftaran'],
    'formfields': ['Form Fields',     'Konfigurasi pertanyaan form pendaftaran']
  };

  if (titles[tab]) {
    document.getElementById('topbar-title').textContent = titles[tab][0];
    document.getElementById('topbar-sub').textContent   = titles[tab][1];
  }

  if (tab === 'jadwal')     muatJadwal();
  if (tab === 'gelombang')  muatGelombang();
  if (tab === 'formfields') muatFormFields();

  tutupSidebar();
}

function bukaSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('visible');
}

function tutupSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

function refresh() {
  var tab = state.currentTab;
  if (tab === 'pendaftar')  { muatStats(); muatPendaftar(); }
  else if (tab === 'jadwal')     muatJadwal();
  else if (tab === 'gelombang')  muatGelombang();
  else if (tab === 'formfields') muatFormFields();
}

// ============================================================================
// MUAT STATS
// ============================================================================

function muatStats() {
  var url = CONFIG.BACKEND_URL + '?action=admin.stats&token=' + encodeURIComponent(state.token);
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (res.ok && res.data) {
        var stats = res.data;
        document.getElementById('stat-total').textContent = stats.total || 0;
        document.getElementById('stat-diterima').textContent = stats.per_status['DITERIMA'] || 0;
        var proses = (stats.per_status['TERDAFTAR'] || 0) + (stats.per_status['BERKAS_OK'] || 0) + (stats.per_status['WAWANCARA'] || 0);
        document.getElementById('stat-proses').textContent = proses;
        document.getElementById('stat-ditolak').textContent = stats.per_status['DITOLAK'] || 0;
      }
    })
    .catch(function () {});
}

// ============================================================================
// MUAT PENDAFTAR
// ============================================================================

function muatPendaftar() {
  var tbody = document.getElementById('tbody-pendaftar');
  tbody.innerHTML = '<tr><td colspan="9" class="no-data">Memuat data...</td></tr>';

  var url = CONFIG.BACKEND_URL + '?action=admin.registrations&token=' + encodeURIComponent(state.token);
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res.ok) {
        if (res.error === 'UNAUTHORIZED') {
          tampilkanToast('Sesi habis, silakan login ulang.', 'error');
          setTimeout(function () { logout(); }, 2000);
        } else {
          tbody.innerHTML = '<tr><td colspan="9" class="no-data">Gagal memuat data.</td></tr>';
        }
        return;
      }
      state.pendaftar = res.data || [];
      state.filteredData = state.pendaftar;
      renderTabelPendaftar();
    })
    .catch(function () {
      tbody.innerHTML = '<tr><td colspan="9" class="no-data">Koneksi bermasalah.</td></tr>';
    });
}

function renderTabelPendaftar() {
  var tbody = document.getElementById('tbody-pendaftar');
  var data = state.filteredData;

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="no-data">Tidak ada data.</td></tr>';
    document.getElementById('pagination').style.display = 'none';
    return;
  }

  var start = (state.page - 1) * state.pageSize;
  var end = start + state.pageSize;
  var pageData = data.slice(start, end);

  tbody.innerHTML = '';
  pageData.forEach(function (row) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="font-weight:700;font-size:0.82rem;font-family:monospace">' + esc(row.no_pendaftaran) + '</td>' +
      '<td>' + esc(row.nama) + '</td>' +
      '<td style="font-size:0.82rem">' + esc(row.hp) + '</td>' +
      '<td style="font-size:0.82rem">' + esc(row.program) + '</td>' +
      '<td style="font-size:0.82rem">' + (row.gender || '—') + '</td>' +
      '<td style="font-size:0.82rem">' + esc(row.jadwal_id) + '</td>' +
      '<td style="font-size:0.82rem">' + formatTanggal(row.timestamp) + '</td>' +
      '<td><span class="badge badge-' + row.status + '">' + labelStatus(row.status) + '</span></td>' +
      '<td><button class="btn-icon" onclick="bukaDetal(\'' + row.no_pendaftaran + '\')">✏️</button></td>';
    tbody.appendChild(tr);
  });

  renderPaginasi(data.length);
}

function renderPaginasi(total) {
  var pag = document.getElementById('pagination');
  var info = document.getElementById('pag-info');
  var btns = document.getElementById('pag-btns');

  if (total <= state.pageSize) {
    pag.style.display = 'none';
    return;
  }

  pag.style.display = 'flex';
  var totalPages = Math.ceil(total / state.pageSize);
  var start = (state.page - 1) * state.pageSize + 1;
  var end = Math.min(state.page * state.pageSize, total);
  info.textContent = start + '–' + end + ' dari ' + total;

  btns.innerHTML = '';
  var btnPrev = document.createElement('button');
  btnPrev.className = 'page-btn';
  btnPrev.textContent = '‹';
  btnPrev.disabled = state.page === 1;
  btnPrev.onclick = function () { gantiHalaman(state.page - 1); };
  btns.appendChild(btnPrev);

  for (var i = 1; i <= Math.min(totalPages, 5); i++) {
    var btnPage = document.createElement('button');
    btnPage.className = 'page-btn' + (i === state.page ? ' active' : '');
    btnPage.textContent = i;
    btnPage.onclick = (function (p) {
      return function () { gantiHalaman(p); };
    })(i);
    btns.appendChild(btnPage);
  }

  var btnNext = document.createElement('button');
  btnNext.className = 'page-btn';
  btnNext.textContent = '›';
  btnNext.disabled = state.page === totalPages;
  btnNext.onclick = function () { gantiHalaman(state.page + 1); };
  btns.appendChild(btnNext);
}

function gantiHalaman(p) {
  state.page = p;
  renderTabelPendaftar();
}

// ============================================================================
// FILTER & SEARCH
// ============================================================================

function filterData() {
  var search = document.getElementById('search-input').value.toLowerCase();
  var status = document.getElementById('filter-status').value;
  var gender = document.getElementById('filter-gender').value;
  var jadwal = document.getElementById('filter-jadwal').value;

  state.filteredData = state.pendaftar.filter(function (row) {
    if (status && row.status !== status) return false;
    if (gender && row.gender !== gender) return false;
    if (jadwal && row.jadwal_id !== jadwal) return false;
    if (search) {
      var match = (row.nama || '').toLowerCase().indexOf(search) !== -1 ||
                  (row.hp || '').toLowerCase().indexOf(search) !== -1 ||
                  (row.no_pendaftaran || '').toLowerCase().indexOf(search) !== -1;
      if (!match) return false;
    }
    return true;
  });

  state.page = 1;
  renderTabelPendaftar();
}

function muatJadwalOptions() {
  var url = CONFIG.BACKEND_URL + '?action=admin.jadwal&token=' + encodeURIComponent(state.token);
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (res.ok && res.data) {
        var select = document.getElementById('filter-jadwal');
        select.innerHTML = '<option value="">Semua Jadwal</option>';
        res.data.forEach(function (j) {
          var opt = document.createElement('option');
          opt.value = j.jadwal_id;
          opt.textContent = j.jadwal_id + ' — ' + j.program;
          select.appendChild(opt);
        });
      }
    })
    .catch(function () {});
}

// ============================================================================
// DETAIL PENDAFTAR
// ============================================================================

function bukaDetal(no) {
  var row = state.pendaftar.find(function (r) { return r.no_pendaftaran === no; });
  if (!row) return;

  state.selectedPendaftar = row;
  document.getElementById('modal-detail-title').textContent = 'Detail — ' + row.no_pendaftaran;

  var grid = document.getElementById('detail-grid');
  grid.innerHTML =
    '<div class="detail-item"><div class="detail-label">Nomor Pendaftaran</div><div class="detail-value">' + esc(row.no_pendaftaran) + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Tgl. Daftar</div><div class="detail-value">' + formatTanggal(row.timestamp) + '</div></div>' +
    '<div class="detail-item full"><div class="detail-label">Nama Lengkap</div><div class="detail-value">' + esc(row.nama) + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">No. HP</div><div class="detail-value">' + esc(row.hp) + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">' + (row.email || '—') + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Tanggal Lahir</div><div class="detail-value">' + (row.tgl_lahir || '—') + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Gender</div><div class="detail-value">' + (row.gender || '—') + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Program</div><div class="detail-value">' + esc(row.program) + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Jadwal</div><div class="detail-value">' + esc(row.jadwal_id) + '</div></div>';

  document.getElementById('edit-status').value = row.status;
  document.getElementById('edit-catatan-publik').value = row.catatan_publik || '';
  document.getElementById('edit-catatan-internal').value = row.catatan_internal || '';

  bukaModal('modal-detail');
}

function simpanStatus() {
  var row = state.selectedPendaftar;
  if (!row) return;

  var status = document.getElementById('edit-status').value;
  var catatanPublik = document.getElementById('edit-catatan-publik').value.trim();
  var catatanInternal = document.getElementById('edit-catatan-internal').value.trim();
  var btn = document.getElementById('btn-simpan-status');

  setLoading(btn, true);

  var body = {
    action: 'admin.updateStatus',
    token: state.token,
    no_pendaftaran: row.no_pendaftaran,
    status: status,
    catatan_publik: catatanPublik,
    catatan_internal: catatanInternal
  };

  fetch(CONFIG.BACKEND_URL, {
    method: 'POST',
    body: new URLSearchParams(body)
  })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      setLoading(btn, false);
      if (res.ok) {
        tampilkanToast('Status berhasil diperbarui.', 'success');
        tutupModal('modal-detail');
        muatStats();
        muatPendaftar();
      } else {
        tampilkanToast(res.pesan || 'Gagal memperbarui status.', 'error');
      }
    })
    .catch(function () {
      setLoading(btn, false);
      tampilkanToast('Koneksi bermasalah.', 'error');
    });
}

function arsipPendaftar() {
  var row = state.selectedPendaftar;
  if (!row) return;
  if (!confirm('Arsipkan pendaftar ' + row.no_pendaftaran + '?')) return;

  var body = {
    action: 'admin.deleteReg',
    token: state.token,
    no_pendaftaran: row.no_pendaftaran,
    mode: 'arsip'
  };

  fetch(CONFIG.BACKEND_URL, {
    method: 'POST',
    body: new URLSearchParams(body)
  })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (res.ok) {
        tampilkanToast('Data diarsipkan.', 'success');
        tutupModal('modal-detail');
        muatPendaftar();
      } else {
        tampilkanToast(res.pesan || 'Gagal arsip.', 'error');
      }
    })
    .catch(function () {
      tampilkanToast('Koneksi bermasalah.', 'error');
    });
}

// ============================================================================
// JADWAL
// ============================================================================

function muatJadwal() {
  var tbody = document.getElementById('tbody-jadwal');
  tbody.innerHTML = '<tr><td colspan="9" class="no-data">Memuat data...</td></tr>';

  var url = CONFIG.BACKEND_URL + '?action=admin.jadwal&token=' + encodeURIComponent(state.token);
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res.ok) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">Gagal memuat data.</td></tr>';
        return;
      }
      state.jadwal = res.data || [];
      renderTabelJadwal();
    })
    .catch(function () {
      tbody.innerHTML = '<tr><td colspan="9" class="no-data">Koneksi bermasalah.</td></tr>';
    });
}

function renderTabelJadwal() {
  var tbody = document.getElementById('tbody-jadwal');
  if (state.jadwal.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="no-data">Tidak ada data.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  state.jadwal.forEach(function (j) {
    var persen = j.kuota_maks > 0 ? Math.round((j.terisi / j.kuota_maks) * 100) : 0;
    var fillClass = persen >= 100 ? 'penuh' : persen >= 80 ? 'hampir' : '';

    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="font-weight:700;font-size:0.82rem">' + esc(j.jadwal_id) + '</td>' +
      '<td>' + esc(j.program) + '</td>' +
      '<td style="font-size:0.82rem">' + esc(j.hari) + '<br>' + esc(j.jam) + '</td>' +
      '<td style="font-size:0.82rem">' + (j.pengajar || '—') + '</td>' +
      '<td style="font-size:0.82rem">' + (j.gender || '—') + '</td>' +
      '<td style="font-size:0.82rem">' + j.terisi + ' / ' + j.kuota_maks +
        '<div class="kuota-bar"><div class="kuota-fill ' + fillClass + '" style="width:' + persen + '%"></div></div></td>' +
      '<td><span class="badge badge-' + j.status_slot + '">' + j.status_slot + '</span></td>' +
      '<td>' + (j.active ? '✅' : '❌') + '</td>' +
      '<td><button class="btn-icon" onclick="bukaEditJadwal(\'' + j.jadwal_id + '\')">✏️</button></td>';
    tbody.appendChild(tr);
  });
}

function bukaEditJadwal(id) {
  var j = state.jadwal.find(function (row) { return row.jadwal_id === id; });
  if (!j) return;

  state.selectedJadwal = j;
  document.getElementById('edit-jadwal-id').value = j.jadwal_id;
  document.getElementById('edit-jadwal-nama').textContent = j.program + ' — ' + j.hari + ', ' + j.jam;
  document.getElementById('edit-kuota').value = j.kuota_maks;
  document.getElementById('edit-status-slot').value = j.status_slot;

  if (j.active === true || j.active === 'true') {
    document.getElementById('edit-active-ya').checked = true;
  } else {
    document.getElementById('edit-active-tidak').checked = true;
  }

  bukaModal('modal-jadwal');
}

function simpanJadwal() {
  var id = document.getElementById('edit-jadwal-id').value;
  var kuota = parseInt(document.getElementById('edit-kuota').value);
  var statusSlot = document.getElementById('edit-status-slot').value;
  var active = document.querySelector('input[name="edit-active"]:checked').value === 'true';
  var btn = document.getElementById('btn-simpan-jadwal');

  setLoading(btn, true);

  var body = {
    action: 'admin.updateJadwal',
    token: state.token,
    jadwal_id: id,
    kuota_maks: kuota,
    status_slot: statusSlot,
    active: active
  };

  fetch(CONFIG.BACKEND_URL, {
    method: 'POST',
    body: new URLSearchParams(body)
  })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      setLoading(btn, false);
      if (res.ok) {
        tampilkanToast('Jadwal berhasil diperbarui.', 'success');
        tutupModal('modal-jadwal');
        muatJadwal();
      } else {
        tampilkanToast(res.pesan || 'Gagal memperbarui jadwal.', 'error');
      }
    })
    .catch(function () {
      setLoading(btn, false);
      tampilkanToast('Koneksi bermasalah.', 'error');
    });
}

// ============================================================================
// EKSPOR CSV
// ============================================================================

function exportCSV() {
  var csv = 'No. Pendaftaran,Nama,HP,Email,Tgl. Lahir,Gender,Program,Jadwal,Status,Tgl. Daftar\n';
  state.filteredData.forEach(function (r) {
    csv += [
      r.no_pendaftaran,
      '"' + r.nama + '"',
      r.hp,
      r.email || '',
      r.tgl_lahir || '',
      r.gender || '',
      '"' + r.program + '"',
      r.jadwal_id,
      r.status,
      formatTanggal(r.timestamp)
    ].join(',') + '\n';
  });

  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'pendaftar-' + new Date().toISOString().split('T')[0] + '.csv';
  link.click();
  tampilkanToast('CSV berhasil diunduh.', 'success');
}

// ============================================================================
// HELPERS
// ============================================================================

function bukaModal(id) {
  document.getElementById(id).classList.add('visible');
}

function tutupModal(id) {
  document.getElementById(id).classList.remove('visible');
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

function tampilkanToast(msg, type) {
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'info');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(function () { container.removeChild(toast); }, 4000);
}

function labelStatus(status) {
  var map = {
    'TERDAFTAR': 'Terdaftar',
    'BERKAS_OK': 'Berkas OK',
    'WAWANCARA': 'Wawancara',
    'DITERIMA': 'Diterima',
    'DITOLAK': 'Ditolak'
  };
  return map[status] || status;
}

function formatTanggal(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  var dd = ('0' + d.getDate()).slice(-2);
  var mm = ('0' + (d.getMonth() + 1)).slice(-2);
  var yy = d.getFullYear();
  return dd + '/' + mm + '/' + yy;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// GELOMBANG
// ============================================================================

function muatGelombang() {
  var tbody = document.getElementById('tbody-gelombang');
  tbody.innerHTML = '<tr><td colspan="8" class="no-data">Memuat data...</td></tr>';

  var url = CONFIG.BACKEND_URL + '?action=admin.gelombang&token=' + encodeURIComponent(state.token);
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (!res.ok) { tbody.innerHTML = '<tr><td colspan="8" class="no-data">Gagal memuat data.</td></tr>'; return; }

      // Update status pendaftaran toggle
      var label = document.getElementById('status-pendaftaran-label');
      var buka  = res.pendaftaran_buka;
      label.textContent   = buka ? 'Dibuka' : 'Ditutup';
      label.style.background = buka ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)';
      label.style.color      = buka ? '#047857' : '#b91c1c';

      var btn = document.getElementById('btn-toggle-pendaftaran');
      btn.querySelector('.btn-text').textContent = buka ? 'Tutup Pendaftaran' : 'Buka Pendaftaran';
      btn.style.background = buka ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#10b981,#059669)';
      state.pendaftaranBuka = buka;

      state.gelombang = res.data || [];
      renderTabelGelombang();
    })
    .catch(function() { tbody.innerHTML = '<tr><td colspan="8" class="no-data">Koneksi bermasalah.</td></tr>'; });
}

function renderTabelGelombang() {
  var tbody = document.getElementById('tbody-gelombang');
  if (!state.gelombang || state.gelombang.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="no-data">Belum ada gelombang.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  state.gelombang.forEach(function(g) {
    var aktif = g.status === 'AKTIF';
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="font-weight:700">' + esc(String(g.wave_id)) + '</td>' +
      '<td>' + esc(g.nama) + '</td>' +
      '<td>' + (g.tgl_mulai || '—') + '</td>' +
      '<td>' + (g.tgl_selesai || '—') + '</td>' +
      '<td>' + esc(g.tahun_ajaran || '—') + '</td>' +
      '<td><span class="badge ' + (aktif ? 'badge-DITERIMA' : 'badge-DITOLAK') + '">' + esc(g.status) + '</span></td>' +
      '<td>' + (aktif ? '✅' : '❌') + '</td>' +
      '<td><button class="btn-icon" onclick="bukaEditGelombang(' + g.wave_id + ')">✏️</button></td>';
    tbody.appendChild(tr);
  });
}

function togglePendaftaran() {
  var btn  = document.getElementById('btn-toggle-pendaftaran');
  var buka = !state.pendaftaranBuka;
  setLoading(btn, true);

  var body = { action: 'admin.updateGelombang', token: state.token, pendaftaran_buka: buka ? 'true' : 'false' };
  fetch(CONFIG.BACKEND_URL, { method: 'POST', body: new URLSearchParams(body) })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      setLoading(btn, false);
      if (res.ok) { tampilkanToast('Status pendaftaran diperbarui.', 'success'); muatGelombang(); }
      else { tampilkanToast(res.pesan || 'Gagal.', 'error'); }
    })
    .catch(function() { setLoading(btn, false); tampilkanToast('Koneksi bermasalah.', 'error'); });
}

function bukaEditGelombang(waveId) {
  var g = (state.gelombang || []).find(function(x) { return x.wave_id == waveId; });
  if (!g) return;
  state.selectedGelombang = g;

  // Isi modal edit gelombang (reuse modal-jadwal dengan field berbeda)
  document.getElementById('edit-jadwal-id').value    = g.wave_id;
  document.getElementById('edit-jadwal-nama').textContent = 'Gelombang ' + g.wave_id + ' — ' + g.nama;
  document.getElementById('edit-kuota').value        = g.tgl_mulai || '';
  document.getElementById('edit-kuota').type         = 'date';
  document.getElementById('edit-kuota').previousElementSibling.textContent = 'Tanggal Mulai';
  document.getElementById('edit-status-slot').innerHTML =
    '<option value="AKTIF"' + (g.status === 'AKTIF' ? ' selected' : '') + '>AKTIF</option>' +
    '<option value="SELESAI"' + (g.status === 'SELESAI' ? ' selected' : '') + '>SELESAI</option>' +
    '<option value="DIBATALKAN"' + (g.status === 'DIBATALKAN' ? ' selected' : '') + '>DIBATALKAN</option>';
  document.getElementById('edit-status-slot').previousElementSibling.textContent = 'Status Gelombang';

  // Override simpan button
  document.getElementById('btn-simpan-jadwal').onclick = simpanGelombang;
  bukaModal('modal-jadwal');
}

function bukaModalTambahGelombang() {
  state.selectedGelombang = null;
  document.getElementById('edit-jadwal-id').value = '';
  document.getElementById('edit-jadwal-nama').textContent = 'Gelombang Baru';
  document.getElementById('edit-kuota').value = '';
  document.getElementById('edit-kuota').type  = 'date';
  document.getElementById('edit-kuota').previousElementSibling.textContent = 'Tanggal Mulai';
  document.getElementById('edit-status-slot').innerHTML =
    '<option value="AKTIF">AKTIF</option><option value="SELESAI">SELESAI</option>';
  document.getElementById('edit-status-slot').previousElementSibling.textContent = 'Status Gelombang';
  document.getElementById('btn-simpan-jadwal').onclick = simpanGelombang;
  bukaModal('modal-jadwal');
}

function simpanGelombang() {
  var btn  = document.getElementById('btn-simpan-jadwal');
  var isNew = !state.selectedGelombang;
  setLoading(btn, true);

  var body = {
    action:          isNew ? 'admin.updateGelombang' : 'admin.updateGelombang',
    token:           state.token,
    tgl_mulai:       document.getElementById('edit-kuota').value,
    status:          document.getElementById('edit-status-slot').value,
    action_gelombang: isNew ? 'tambah' : 'update'
  };

  if (!isNew) body.wave_id = state.selectedGelombang.wave_id;

  fetch(CONFIG.BACKEND_URL, { method: 'POST', body: new URLSearchParams(body) })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      setLoading(btn, false);
      if (res.ok) { tampilkanToast('Gelombang disimpan.', 'success'); tutupModal('modal-jadwal'); muatGelombang(); }
      else { tampilkanToast(res.pesan || 'Gagal.', 'error'); }
    })
    .catch(function() { setLoading(btn, false); tampilkanToast('Koneksi bermasalah.', 'error'); });
}


// ============================================================================
// FORM FIELDS
// ============================================================================

function muatFormFields() {
  var tbody = document.getElementById('tbody-formfields');
  tbody.innerHTML = '<tr><td colspan="7" class="no-data">Memuat data...</td></tr>';

  var url = CONFIG.BACKEND_URL + '?action=admin.formfields&token=' + encodeURIComponent(state.token);
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (!res.ok) { tbody.innerHTML = '<tr><td colspan="7" class="no-data">Gagal memuat data.</td></tr>'; return; }
      state.formFields = res.data || [];
      renderTabelFormFields();
    })
    .catch(function() { tbody.innerHTML = '<tr><td colspan="7" class="no-data">Koneksi bermasalah.</td></tr>'; });
}

function renderTabelFormFields() {
  var tbody = document.getElementById('tbody-formfields');
  if (!state.formFields || state.formFields.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">Tidak ada data.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  state.formFields.forEach(function(f) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="font-weight:700;font-size:0.82rem">' + esc(f.field_id) + '</td>' +
      '<td>' + esc(f.label) + '</td>' +
      '<td style="font-size:0.82rem"><span class="badge badge-TERDAFTAR">' + esc(f.type) + '</span></td>' +
      '<td>' + (f.required ? '✅' : '❌') + '</td>' +
      '<td style="font-size:0.82rem">' + f.order + '</td>' +
      '<td>' + (f.active ? '✅' : '❌') + '</td>' +
      '<td><button class="btn-icon" onclick="bukaEditFormField(\'' + f.field_id + '\')">✏️</button></td>';
    tbody.appendChild(tr);
  });
}

function bukaEditFormField(fieldId) {
  var f = (state.formFields || []).find(function(x) { return x.field_id === fieldId; });
  if (!f) return;
  state.selectedFormField = f;

  // Reuse modal-detail dengan konten baru
  document.getElementById('modal-detail-title').textContent = 'Edit Field: ' + f.field_id;
  document.getElementById('detail-grid').innerHTML =
    '<div class="detail-item full">' +
    '  <div class="detail-label">Field ID</div>' +
    '  <div class="detail-value">' + esc(f.field_id) + '</div>' +
    '</div>' +
    '<div class="detail-item full">' +
    '  <div class="detail-label">Label</div>' +
    '  <input class="form-input" id="ff-label" value="' + esc(f.label) + '">' +
    '</div>' +
    '<div class="detail-item">' +
    '  <div class="detail-label">Urutan</div>' +
    '  <input class="form-input" id="ff-order" type="number" value="' + f.order + '">' +
    '</div>' +
    '<div class="detail-item">' +
    '  <div class="detail-label">Options (pisah |)</div>' +
    '  <input class="form-input" id="ff-options" value="' + esc(f.options) + '">' +
    '</div>';

  document.getElementById('edit-status').innerHTML =
    '<option value="true"' + (f.required ? ' selected' : '') + '>Wajib diisi</option>' +
    '<option value="false"' + (!f.required ? ' selected' : '') + '>Opsional</option>';
  document.getElementById('edit-status').previousElementSibling.textContent = 'Wajib Diisi';

  document.getElementById('edit-catatan-publik').value  = f.active ? 'true' : 'false';
  document.getElementById('edit-catatan-publik').previousElementSibling.textContent = 'Status Aktif (true/false)';
  document.getElementById('edit-catatan-internal').style.display = 'none';
  document.getElementById('edit-catatan-internal').previousElementSibling.style.display = 'none';

  document.getElementById('btn-arsip').style.display = 'none';
  document.getElementById('btn-simpan-status').onclick = simpanFormField;
  bukaModal('modal-detail');
}

function simpanFormField() {
  var f   = state.selectedFormField;
  if (!f) return;
  var btn = document.getElementById('btn-simpan-status');
  setLoading(btn, true);

  var body = {
    action:    'admin.updateFormField',
    token:     state.token,
    field_id:  f.field_id,
    label:     document.getElementById('ff-label').value,
    order:     document.getElementById('ff-order').value,
    options:   document.getElementById('ff-options').value,
    required:  document.getElementById('edit-status').value,
    active:    document.getElementById('edit-catatan-publik').value
  };

  fetch(CONFIG.BACKEND_URL, { method: 'POST', body: new URLSearchParams(body) })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      setLoading(btn, false);
      if (res.ok) {
        tampilkanToast('Form field diperbarui.', 'success');
        tutupModal('modal-detail');
        muatFormFields();
        // Reset modal detail ke mode normal
        document.getElementById('btn-arsip').style.display = '';
        document.getElementById('btn-simpan-status').onclick = simpanStatus;
        document.getElementById('edit-catatan-internal').style.display = '';
        document.getElementById('edit-catatan-internal').previousElementSibling.style.display = '';
      } else {
        tampilkanToast(res.pesan || 'Gagal.', 'error');
      }
    })
    .catch(function() { setLoading(btn, false); tampilkanToast('Koneksi bermasalah.', 'error'); });
}
