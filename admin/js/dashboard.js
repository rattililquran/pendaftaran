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

  if (tab === 'pendaftar') {
    document.getElementById('tab-pendaftar').style.display = 'block';
    document.getElementById('tab-jadwal').style.display = 'none';
    document.getElementById('topbar-title').textContent = 'Pendaftar';
    document.getElementById('topbar-sub').textContent = 'Kelola data pendaftar murid baru';
  } else if (tab === 'jadwal') {
    document.getElementById('tab-pendaftar').style.display = 'none';
    document.getElementById('tab-jadwal').style.display = 'block';
    document.getElementById('topbar-title').textContent = 'Jadwal & Kuota';
    document.getElementById('topbar-sub').textContent = 'Kelola jadwal dan kuota per program';
    muatJadwal();
  }
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
  if (state.currentTab === 'pendaftar') {
    muatStats();
    muatPendaftar();
  } else {
    muatJadwal();
  }
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
