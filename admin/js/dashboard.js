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
  evaluasi: [],
  currentTab: 'pendaftar',
  selectedPendaftar: null,
  selectedJadwal: null,
  page: 1,
  pageSize: 20,
  selected: {},              // no_pendaftaran -> true (aksi massal)
  sort: { key: '', dir: 1 }  // dir 1 = asc, -1 = desc
};

/**
 * Helper READ: ambil data admin via GET (GAS tidak support POST cross-origin dari browser).
 * Token dikirim via query string over HTTPS — query string terenkripsi TLS.
 */
function _adminGet(params) {
  var qs = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  return fetch(CONFIG.BACKEND_URL + '?' + qs)
    .then(function(r) { return r.json(); });
}

/**
 * Helper WRITE: kirim POST ke GAS via text/plain (tidak trigger preflight CORS).
 * Untuk operasi tulis: updateStatus, deleteReg, updateJadwal, dll.
 */
function _adminPost(params) {
  return fetch(CONFIG.BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(params)
  }).then(function(r) { return r.json(); });
}

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
  muatWaTemplates();
}

function logout() {
  var token = state.token || sessionStorage.getItem('admin_token');
  sessionStorage.removeItem('admin_token');

  // Hapus session token dari server (fire-and-forget)
  if (token) {
    try {
      fetch(CONFIG.BACKEND_URL + '?action=admin.logout&token=' + encodeURIComponent(token));
    } catch (e) { /* abaikan error jaringan saat logout */ }
  }

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

  var tabs = ['pendaftar', 'jadwal', 'gelombang', 'formfields', 'statistik', 'watemplate', 'evaluasi', 'qrcode'];
  tabs.forEach(function(t) {
    var el = document.getElementById('tab-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });

  var titles = {
    'pendaftar':  ['Pendaftar',       'Kelola data pendaftar murid baru'],
    'jadwal':     ['Jadwal & Kuota',  'Kelola jadwal dan kuota per program'],
    'gelombang':  ['Gelombang',       'Kelola gelombang dan status pendaftaran'],
    'formfields': ['Form Fields',     'Konfigurasi pertanyaan form pendaftaran'],
    'statistik':  ['Statistik',        'Visualisasi data pendaftaran'],
    'watemplate': ['Template WA',      'Kelola template pesan WhatsApp'],
    'evaluasi':   ['Evaluasi',         'Catatan perbaikan untuk pendaftaran berikutnya'],
    'qrcode':     ['QR Code',          'QR Code link pendaftaran']
  };

  if (titles[tab]) {
    document.getElementById('topbar-title').textContent = titles[tab][0];
    document.getElementById('topbar-sub').textContent   = titles[tab][1];
  }

  if (tab === 'jadwal')     muatJadwal();
  if (tab === 'gelombang')  muatGelombang();
  if (tab === 'formfields') muatFormFields();
  if (tab === 'statistik')  muatCharts();
  if (tab === 'watemplate') muatWaTemplateAdmin();
  if (tab === 'evaluasi')   muatEvaluasi();
  if (tab === 'qrcode')     muatQRCode();

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
  else if (tab === 'statistik')  muatCharts();
  else if (tab === 'qrcode')     muatQRCode();
}

// ============================================================================
// MUAT STATS
// ============================================================================

function muatStats() {
  _adminGet({ action: 'admin.stats', token: state.token })
    .then(function (res) {
      if (!res.ok && res.error === 'UNAUTHORIZED') { logout(); return; }
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
  tbody.innerHTML = '<tr><td colspan="11" class="no-data">Memuat data...</td></tr>';

  _adminGet({ action: 'admin.registrations', token: state.token })
    .then(function (res) {
      if (!res.ok) {
        if (res.error === 'UNAUTHORIZED') {
          tampilkanToast('Sesi habis, silakan login ulang.', 'error');
          setTimeout(function () { logout(); }, 2000);
        } else {
          tbody.innerHTML = '<tr><td colspan="11" class="no-data">Gagal memuat data.</td></tr>';
        }
        return;
      }
      state.pendaftar = res.data || [];
      state.filteredData = state.pendaftar;
      renderTabelPendaftar();
    })
    .catch(function () {
      tbody.innerHTML = '<tr><td colspan="11" class="no-data">Koneksi bermasalah.</td></tr>';
    });
}

function renderTabelPendaftar() {
  var tbody = document.getElementById('tbody-pendaftar');
  var pag = document.getElementById('pagination');

  // Empty state: benar-benar belum ada pendaftar (bukan hasil filter kosong).
  if (state.pendaftar.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="no-data">' +
      '<div style="font-size:2.4rem;margin-bottom:8px">📭</div>' +
      '<div style="font-weight:700;color:var(--ink-2);margin-bottom:6px">Belum ada pendaftar</div>' +
      '<div style="font-size:0.82rem;color:var(--ink-4);margin-bottom:14px">Bagikan link pendaftaran untuk mulai menerima calon murid.</div>' +
      '<button class="btn btn-primary btn-sm" onclick="switchTab(\'qrcode\')">Buka QR &amp; Link</button>' +
      '</div></td></tr>';
    pag.style.display = 'none';
    updateBulkBar();
    return;
  }

  // Salin lalu urutkan sesuai state.sort (biarkan filteredData asli utuh).
  var data = state.filteredData.slice();
  if (state.sort.key) {
    var k = state.sort.key, dir = state.sort.dir;
    data.sort(function (a, b) {
      var va, vb;
      if (k === 'timestamp') {
        va = new Date(a[k]).getTime() || 0; vb = new Date(b[k]).getTime() || 0;
      } else {
        va = String(a[k] || '').toLowerCase(); vb = String(b[k] || '').toLowerCase();
      }
      return va < vb ? -dir : va > vb ? dir : 0;
    });
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="no-data">Tidak ada data yang cocok dengan filter.</td></tr>';
    pag.style.display = 'none';
    updateSortIndicators();
    updateBulkBar();
    return;
  }

  var start = (state.page - 1) * state.pageSize;
  var end = start + state.pageSize;
  var pageData = data.slice(start, end);

  tbody.innerHTML = '';
  pageData.forEach(function (row, i) {
    var urut = start + i + 1;
    var checked = state.selected[row.no_pendaftaran] ? ' checked' : '';
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="text-align:center"><input type="checkbox" class="row-chk" data-no="' + esc(row.no_pendaftaran) + '"' + checked + ' onclick="toggleSelect(this)"></td>' +
      '<td style="text-align:right;color:var(--ink-4);font-size:0.8rem;font-variant-numeric:tabular-nums">' + urut + '</td>' +
      '<td style="font-weight:700;font-size:0.82rem;font-family:monospace">' + esc(row.no_pendaftaran) + '</td>' +
      '<td>' + esc(row.nama) +
        (row.waiting_list ? ' <span title="Daftar tunggu (cadangan)" style="font-size:0.7rem;font-weight:700;color:#b45309;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.4);border-radius:6px;padding:1px 5px;white-space:nowrap">⏳ WL</span>' : '') +
      '</td>' +
      '<td style="font-size:0.82rem">' + esc(row.hp) + '</td>' +
      '<td style="font-size:0.82rem">' + esc(row.program) + '</td>' +
      '<td style="font-size:0.82rem">' + (esc(row.gender) || '—') + '</td>' +
      '<td style="font-size:0.82rem">' + esc(row.jadwal_id) + '</td>' +
      '<td style="font-size:0.82rem">' + formatTanggal(row.timestamp) + '</td>' +
      '<td><span class="badge badge-' + row.status + '">' + labelStatus(row.status) + '</span></td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn-icon btn-icon-wa" title="Chat WhatsApp" onclick="chatWa(\'' + row.no_pendaftaran + '\')">💬</button>' +
        '<button class="btn-icon" title="Detail" onclick="bukaDetal(\'' + row.no_pendaftaran + '\')">✏️</button>' +
      '</td>';
    tbody.appendChild(tr);
  });

  updateSortIndicators();
  syncSelectAll();
  updateBulkBar();
  renderPaginasi(data.length);
}

// ---- Sort ----
function sortBy(key) {
  if (state.sort.key === key) state.sort.dir *= -1;
  else { state.sort.key = key; state.sort.dir = 1; }
  state.page = 1;
  renderTabelPendaftar();
}

function updateSortIndicators() {
  var ths = document.querySelectorAll('#table-pendaftar th[data-sort]');
  for (var i = 0; i < ths.length; i++) {
    var ind = ths[i].querySelector('.sort-ind');
    if (!ind) continue;
    ind.textContent = (ths[i].getAttribute('data-sort') === state.sort.key)
      ? (state.sort.dir > 0 ? ' ▲' : ' ▼') : '';
  }
}

// ---- Seleksi & aksi massal ----
function toggleSelect(cb) {
  var no = cb.getAttribute('data-no');
  if (cb.checked) state.selected[no] = true; else delete state.selected[no];
  updateBulkBar();
  syncSelectAll();
}

function toggleSelectAll(cb) {
  state.selected = {};
  if (cb.checked) {
    state.filteredData.forEach(function (r) { state.selected[r.no_pendaftaran] = true; });
  }
  renderTabelPendaftar();
}

function syncSelectAll() {
  var all = document.getElementById('chk-all');
  if (!all) return;
  var total = state.filteredData.length;
  var sel = state.filteredData.filter(function (r) { return state.selected[r.no_pendaftaran]; }).length;
  all.checked = total > 0 && sel === total;
  all.indeterminate = sel > 0 && sel < total;
}

function updateBulkBar() {
  var bar = document.getElementById('bulk-bar');
  if (!bar) return;
  var n = Object.keys(state.selected).length;
  var cnt = document.getElementById('bulk-count');
  if (cnt) cnt.textContent = n + ' dipilih';
  bar.style.display = n > 0 ? 'flex' : 'none';
}

function bulkClear() {
  state.selected = {};
  renderTabelPendaftar();
}

function bulkUpdateStatus() {
  var status = document.getElementById('bulk-status').value;
  if (!status) { tampilkanToast('Pilih status tujuan dulu.', 'error'); return; }
  var nos = Object.keys(state.selected);
  if (!nos.length) return;
  if (!confirm('Ubah status ' + nos.length + ' pendaftar menjadi ' + labelStatus(status) + '?')) return;
  _bulkRun(nos, function (no) {
    return _adminPost({ action: 'admin.updateStatus', token: state.token, no_pendaftaran: no, status: status });
  }, 'Status diperbarui');
}

// Promosi / turunkan waiting list (override manual admin).
function setWaiting(no, jadikanWaiting) {
  var pesan = jadikanWaiting
    ? 'Turunkan pendaftar ini ke daftar tunggu?'
    : 'Promosikan pendaftar ini menjadi terdaftar (confirmed)? Email pemberitahuan akan dikirim bila ada email.';
  if (!confirm(pesan)) return;
  _adminPost({ action: 'admin.setWaiting', token: state.token, no_pendaftaran: no,
               waiting_list: jadikanWaiting ? 'true' : 'false' })
    .then(function (res) {
      if (res && res.ok) {
        tampilkanToast(res.pesan || 'Berhasil.', 'success');
        tutupModal('modal-detail');
        muatStats();
        muatPendaftar();
      } else {
        tampilkanToast((res && (res.pesan || res.error)) || 'Gagal memperbarui.', 'error');
      }
    })
    .catch(function () { tampilkanToast('Koneksi bermasalah.', 'error'); });
}

function bulkArsip() {
  var nos = Object.keys(state.selected);
  if (!nos.length) return;
  if (!confirm('Arsipkan ' + nos.length + ' pendaftar?')) return;
  _bulkRun(nos, function (no) {
    return _adminPost({ action: 'admin.deleteReg', token: state.token, no_pendaftaran: no, mode: 'arsip' });
  }, 'Data diarsipkan');
}

// Jalankan aksi berurutan (hindari membebani LockService GAS).
function _bulkRun(nos, fn, okMsg) {
  tampilkanToast('Memproses ' + nos.length + ' data…', 'info');
  var i = 0, ok = 0, fail = 0;
  function next() {
    if (i >= nos.length) {
      tampilkanToast(okMsg + ': ' + ok + ' berhasil' + (fail ? ', ' + fail + ' gagal' : ''), fail ? 'error' : 'success');
      state.selected = {};
      muatStats();
      muatPendaftar();
      return;
    }
    fn(nos[i])
      .then(function (res) { if (res && res.ok) ok++; else fail++; })
      .catch(function () { fail++; })
      .then(function () { i++; next(); });
  }
  next();
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

// Debounce untuk search input
var _searchTimeout = null;
function filterData() {
  clearTimeout(_searchTimeout);
  _searchTimeout = setTimeout(function() { _doFilter(); }, 250);
}

function resetFilter() {
  document.getElementById('search-input').value  = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-gender').value = '';
  document.getElementById('filter-jadwal').value = '';
  _doFilter();
}

function _doFilter() {
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
  _adminGet({ action: 'admin.jadwal', token: state.token })
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
    '<div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">' + (esc(row.email) || '—') + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Tanggal Lahir</div><div class="detail-value">' + (esc(row.tgl_lahir) || '—') + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Gender</div><div class="detail-value">' + (esc(row.gender) || '—') + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Program</div><div class="detail-value">' + esc(row.program) + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Jadwal</div><div class="detail-value">' + esc(row.jadwal_id) + '</div></div>' +
    '<div class="detail-item full"><div class="detail-label">Daftar Tunggu</div><div class="detail-value">' +
      (row.waiting_list
        ? '<span style="color:#b45309;font-weight:700">⏳ Ya (cadangan)</span> ' +
          '<button class="btn-sm" style="margin-left:8px" onclick="setWaiting(\'' + esc(row.no_pendaftaran) + '\', false)">Promosikan ke Confirmed</button>'
        : '<span style="color:#047857;font-weight:700">✔ Tidak (confirmed)</span> ' +
          '<button class="btn-sm" style="margin-left:8px" onclick="setWaiting(\'' + esc(row.no_pendaftaran) + '\', true)">Turunkan ke Waiting</button>') +
     '</div></div>' +
    // ---- Data kesiapan & komitmen (baru terlihat oleh admin) ----
    '<div class="detail-item"><div class="detail-label">Jenis Biaya</div><div class="detail-value">' + (esc(row.jenis_biaya) || '—') + '</div></div>' +
    '<div class="detail-item"><div class="detail-label">Pernah Tahsin</div><div class="detail-value">' + (esc(row.pernah_tahsin) || '—') + '</div></div>' +
    '<div class="detail-item full"><div class="detail-label">Kemampuan Awal</div><div class="detail-value">' + (esc(row.kemampuan_awal) || '—') + '</div></div>' +
    '<div class="detail-item full"><div class="detail-label">Motivasi</div><div class="detail-value" style="white-space:pre-wrap">' + (esc(row.motivasi) || '—') + '</div></div>' +
    (row.saran_masukan ? '<div class="detail-item full"><div class="detail-label">Saran / Masukan</div><div class="detail-value" style="white-space:pre-wrap">' + esc(row.saran_masukan) + '</div></div>' : '');

  // Riwayat status (timeline) — dimuat async
  var rwPanel = document.getElementById('riwayat-panel');
  if (rwPanel) rwPanel.style.display = '';
  muatRiwayatStatus(row.no_pendaftaran);

  document.getElementById('edit-status').value = row.status;
  document.getElementById('edit-catatan-publik').value = row.catatan_publik || '';
  document.getElementById('edit-catatan-internal').value = row.catatan_internal || '';

  // Panel WhatsApp — daftar template + pesan terisi otomatis (bisa diedit)
  var waPanel = document.getElementById('wa-panel');
  if (waPanel) {
    waPanel.style.display = '';
    var sel  = document.getElementById('wa-template');
    var list = _daftarTemplateUntuk(row);
    state._waList = list;
    sel.innerHTML = list.map(function (t, i) {
      return '<option value="' + i + '">' + esc(t.label) + '</option>';
    }).join('');
    sel.value = '0';
    isiPesanWa();
  }

  bukaModal('modal-detail');
}

// Muat & render timeline riwayat status untuk satu pendaftar.
function muatRiwayatStatus(no) {
  var box = document.getElementById('riwayat-status');
  if (!box) return;
  box.innerHTML = '<div style="color:var(--ink-4);font-size:0.8rem">Memuat riwayat…</div>';

  _adminGet({ action: 'admin.statuslog', token: state.token, no_pendaftaran: no })
    .then(function (res) {
      if (!res.ok || !res.data || res.data.length === 0) {
        box.innerHTML = '<div style="color:var(--ink-4);font-size:0.8rem">Belum ada perubahan status.</div>';
        return;
      }
      box.innerHTML = res.data.map(function (r) {
        var ket = r.status_lama
          ? labelStatus(r.status_lama) + ' → <strong>' + labelStatus(r.status_baru) + '</strong>'
          : '<strong>' + labelStatus(r.status_baru) + '</strong>';
        return '<div class="timeline-item">' +
          '<div class="timeline-dot badge-' + esc(r.status_baru) + '"></div>' +
          '<div class="timeline-body">' +
            '<div class="timeline-head">' + ket + '<span class="timeline-time">' + formatTanggalJam(r.timestamp) + '</span></div>' +
            (r.catatan ? '<div class="timeline-note">' + esc(r.catatan) + '</div>' : '') +
          '</div></div>';
      }).join('');
    })
    .catch(function () {
      box.innerHTML = '<div style="color:var(--ink-4);font-size:0.8rem">Gagal memuat riwayat.</div>';
    });
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
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body)
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
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body)
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

  _adminGet({ action: 'admin.jadwal', token: state.token })
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
  document.getElementById('edit-kuota').type = 'number';
  document.getElementById('edit-kuota').previousElementSibling.textContent = 'Kuota Maksimal';
  document.getElementById('edit-status-slot').innerHTML =
    '<option value="TERSEDIA"' + (j.status_slot === 'TERSEDIA' ? ' selected' : '') + '>Tersedia</option>' +
    '<option value="PENUH"'    + (j.status_slot === 'PENUH'    ? ' selected' : '') + '>Penuh</option>' +
    '<option value="TUTUP"'    + (j.status_slot === 'TUTUP'    ? ' selected' : '') + '>Tutup</option>';
  document.getElementById('edit-status-slot').previousElementSibling.textContent = 'Status Slot';

  if (j.active === true || j.active === 'true') {
    document.getElementById('edit-active-ya').checked = true;
  } else {
    document.getElementById('edit-active-tidak').checked = true;
  }

  bukaModal('modal-jadwal');
}

function bukaModalTambahJadwal() {
  document.getElementById('new-jadwal-id').value = '';
  document.getElementById('new-program').value   = '';
  document.getElementById('new-hari').value      = '';
  document.getElementById('new-jam').value       = '';
  document.getElementById('new-pengajar').value  = '';
  document.getElementById('new-gender').value    = '';
  document.getElementById('new-kuota').value     = '13';
  bukaModal('modal-tambah-jadwal');
}

function simpanJadwalBaru() {
  var btn = document.getElementById('btn-simpan-jadwal-baru');
  var id  = document.getElementById('new-jadwal-id').value.trim();
  var prg = document.getElementById('new-program').value.trim();
  var hari = document.getElementById('new-hari').value.trim();
  var jam  = document.getElementById('new-jam').value.trim();

  if (!id || !prg || !hari || !jam) {
    tampilkanToast('Jadwal ID, Program, Hari, dan Jam wajib diisi.', 'error');
    return;
  }

  setLoading(btn, true);

  var body = {
    action:      'admin.tambahJadwal',
    token:       state.token,
    jadwal_id:   id,
    program:     prg,
    hari:        hari,
    jam:         jam,
    pengajar:    document.getElementById('new-pengajar').value.trim(),
    gender:      document.getElementById('new-gender').value,
    kuota_maks:  parseInt(document.getElementById('new-kuota').value) || 13,
    terisi:      0,
    status_slot: 'TERSEDIA',
    active:      'true'
  };

  fetch(CONFIG.BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      setLoading(btn, false);
      if (res.ok) {
        tampilkanToast('Jadwal berhasil ditambahkan.', 'success');
        tutupModal('modal-tambah-jadwal');
        muatJadwal();
      } else {
        tampilkanToast(res.pesan || 'Gagal menambah jadwal.', 'error');
      }
    })
    .catch(function() { setLoading(btn, false); tampilkanToast('Koneksi bermasalah.', 'error'); });
}

function bukaModalTambahField() {
  state.selectedFormField = null;
  document.getElementById('modal-detail-title').textContent = 'Tambah Form Field';
  document.getElementById('detail-grid').innerHTML =
    '<div class="detail-item full">' +
    '  <div class="detail-label">Field ID (unik, tanpa spasi)</div>' +
    '  <input class="form-input" id="ff-field-id" placeholder="contoh: alamat">' +
    '</div>' +
    '<div class="detail-item full">' +
    '  <div class="detail-label">Label</div>' +
    '  <input class="form-input" id="ff-label" placeholder="contoh: Alamat Lengkap">' +
    '</div>' +
    '<div class="detail-item">' +
    '  <div class="detail-label">Tipe</div>' +
    '  <select class="form-select" id="ff-type">' +
    '    <option value="text">text</option>' +
    '    <option value="email">email</option>' +
    '    <option value="tel">tel</option>' +
    '    <option value="date">date</option>' +
    '    <option value="select">select</option>' +
    '    <option value="textarea">textarea</option>' +
    '  </select>' +
    '</div>' +
    '<div class="detail-item">' +
    '  <div class="detail-label">Urutan</div>' +
    '  <input class="form-input" id="ff-order" type="number" value="10">' +
    '</div>' +
    '<div class="detail-item full">' +
    '  <div class="detail-label">Options (pisah |, untuk select)</div>' +
    '  <input class="form-input" id="ff-options" placeholder="Pilihan 1|Pilihan 2|Pilihan 3">' +
    '</div>';

  document.getElementById('edit-status').innerHTML =
    '<option value="true">Wajib diisi</option>' +
    '<option value="false">Opsional</option>';
  document.getElementById('edit-status').previousElementSibling.textContent = 'Wajib Diisi';
  document.getElementById('edit-catatan-publik').value = 'true';
  document.getElementById('edit-catatan-publik').previousElementSibling.textContent = 'Status Aktif (true/false)';
  document.getElementById('edit-catatan-internal').style.display = 'none';
  document.getElementById('edit-catatan-internal').previousElementSibling.style.display = 'none';
  var waP1 = document.getElementById('wa-panel'); if (waP1) waP1.style.display = 'none';
  var rwP1 = document.getElementById('riwayat-panel'); if (rwP1) rwP1.style.display = 'none';
  document.getElementById('btn-arsip').style.display = 'none';
  document.getElementById('btn-simpan-status').onclick = simpanFieldBaru;
  bukaModal('modal-detail');
}

function simpanFieldBaru() {
  var btn = document.getElementById('btn-simpan-status');
  setLoading(btn, true);

  var fieldId = document.getElementById('ff-field-id') ? document.getElementById('ff-field-id').value.trim() : '';
  if (!fieldId) { tampilkanToast('Field ID wajib diisi.', 'error'); setLoading(btn, false); return; }

  var body = {
    action:    'admin.updateFormField',
    token:     state.token,
    field_id:  fieldId,
    label:     document.getElementById('ff-label').value,
    order:     document.getElementById('ff-order').value,
    options:   document.getElementById('ff-options').value,
    required:  document.getElementById('edit-status').value,
    active:    document.getElementById('edit-catatan-publik').value,
    is_new:    'true'
  };

  fetch(CONFIG.BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      setLoading(btn, false);
      if (res.ok) {
        tampilkanToast('Field berhasil ditambahkan.', 'success');
        tutupModal('modal-detail');
        muatFormFields();
        // Reset modal ke mode normal
        document.getElementById('btn-arsip').style.display = '';
        document.getElementById('btn-simpan-status').onclick = simpanStatus;
        document.getElementById('edit-catatan-internal').style.display = '';
        document.getElementById('edit-catatan-internal').previousElementSibling.style.display = '';
      } else {
        tampilkanToast(res.pesan || 'Gagal menambah field.', 'error');
      }
    })
    .catch(function() { setLoading(btn, false); tampilkanToast('Koneksi bermasalah.', 'error'); });
}

function simpanJadwal() {
  var id = document.getElementById('edit-jadwal-id').value;
  var kuota = parseInt(document.getElementById('edit-kuota').value);
  var statusSlot = document.getElementById('edit-status-slot').value;
  var active = (document.querySelector('input[name="edit-active"]:checked') || {value:'true'}).value === 'true';
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

  _adminPost(body)
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
  var csv = 'No. Pendaftaran,Nama,HP,Email,Tgl. Lahir,Gender,Program,Jadwal,Status,Tgl. Daftar,Jenis Biaya,Kemampuan Awal,Pernah Tahsin,Motivasi,Saran/Masukan\n';
  function csvSafe(v) {
    var s = String(v || '');
    // Cegah CSV injection
    if (s.match(/^[=+\-@]/)) s = "'" + s;
    // Escape double quote
    return '"' + s.replace(/"/g, '""') + '"';
  }
  state.filteredData.forEach(function (r) {
    csv += [
      csvSafe(r.no_pendaftaran),
      csvSafe(r.nama),
      csvSafe(r.hp),
      csvSafe(r.email),
      csvSafe(r.tgl_lahir),
      csvSafe(r.gender),
      csvSafe(r.program),
      csvSafe(r.jadwal_id),
      csvSafe(r.status),
      csvSafe(formatTanggal(r.timestamp)),
      csvSafe(r.jenis_biaya),
      csvSafe(r.kemampuan_awal),
      csvSafe(r.pernah_tahsin),
      csvSafe(r.motivasi),
      csvSafe(r.saran_masukan)
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

function formatTanggalJam(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  var hh = ('0' + d.getHours()).slice(-2);
  var mi = ('0' + d.getMinutes()).slice(-2);
  return formatTanggal(iso) + ' ' + hh + ':' + mi;
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
// EVALUASI — catatan retrospektif perbaikan pendaftaran
// ============================================================================

function muatEvaluasi() {
  var tbody = document.getElementById('tbody-evaluasi');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="no-data">Memuat data...</td></tr>';
  _adminGet({ action: 'admin.evaluasi', token: state.token })
    .then(function (res) {
      if (res && res.ok) {
        state.evaluasi = res.data || [];
        renderTabelEvaluasi();
      } else {
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="no-data">Gagal memuat.</td></tr>';
        if (res && res.error === 'UNAUTHORIZED') tampilkanToast('Sesi habis, silakan login ulang.', 'error');
      }
    })
    .catch(function () {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="no-data">Koneksi bermasalah.</td></tr>';
    });
}

// Warna badge sesuai prioritas/status (dipetakan ke chip inline, theme-aware via warna solid).
var EV_WARNA_PRIO = { 'Tinggi': '#dc2626', 'Sedang': '#d97706', 'Rendah': '#16a34a' };
var EV_WARNA_STAT = { 'Baru': '#2563eb', 'Diproses': '#d97706', 'Selesai': '#16a34a' };

function _chip(teks, warna) {
  return '<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:0.72rem;' +
         'font-weight:700;color:#fff;background:' + warna + '">' + esc(teks) + '</span>';
}

function renderTabelEvaluasi() {
  var tbody = document.getElementById('tbody-evaluasi');
  if (!tbody) return;

  var fS = (document.getElementById('ev-filter-status')    || {}).value || '';
  var fP = (document.getElementById('ev-filter-prioritas') || {}).value || '';
  var fK = (document.getElementById('ev-filter-kategori')  || {}).value || '';

  var rows = state.evaluasi.filter(function (r) {
    if (fS && r.status    !== fS) return false;
    if (fP && r.prioritas !== fP) return false;
    if (fK && r.kategori  !== fK) return false;
    return true;
  });

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="no-data">Belum ada catatan evaluasi.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(function (r) {
    var evalPreview = r.evaluasi.length > 70 ? r.evaluasi.slice(0, 70) + '…' : r.evaluasi;
    return '<tr>' +
      '<td style="font-weight:700;white-space:nowrap">' + esc(r.id) + '</td>' +
      '<td>' + esc(evalPreview) + '</td>' +
      '<td>' + (r.kategori ? esc(r.kategori) : '—') + '</td>' +
      '<td>' + (r.prioritas ? _chip(r.prioritas, EV_WARNA_PRIO[r.prioritas] || '#64748b') : '—') + '</td>' +
      '<td>' + (r.status ? _chip(r.status, EV_WARNA_STAT[r.status] || '#64748b') : '—') + '</td>' +
      '<td>' + (r.gelombang ? esc(r.gelombang) : '—') + '</td>' +
      '<td style="white-space:nowrap">' + formatTanggal(r.timestamp) + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn btn-outline btn-sm" onclick="bukaModalEvaluasi(\'' + esc(r.id) + '\')">Edit</button> ' +
        '<button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="hapusEvaluasi(\'' + esc(r.id) + '\')">Hapus</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function bukaModalEvaluasi(id) {
  var rec = null;
  if (id) {
    for (var i = 0; i < state.evaluasi.length; i++) {
      if (state.evaluasi[i].id === id) { rec = state.evaluasi[i]; break; }
    }
  }
  document.getElementById('modal-evaluasi-title').textContent = rec ? ('Edit ' + rec.id) : 'Tambah Evaluasi';
  document.getElementById('ev-id').value        = rec ? rec.id : '';
  document.getElementById('ev-evaluasi').value  = rec ? rec.evaluasi : '';
  document.getElementById('ev-solusi').value    = rec ? rec.solusi : '';
  document.getElementById('ev-kategori').value  = (rec && rec.kategori)  ? rec.kategori  : 'Teknis';
  document.getElementById('ev-prioritas').value = (rec && rec.prioritas) ? rec.prioritas : 'Sedang';
  document.getElementById('ev-status').value    = (rec && rec.status)    ? rec.status    : 'Baru';
  document.getElementById('ev-gelombang').value = rec ? rec.gelombang : '';
  bukaModal('modal-evaluasi');
}

function simpanEvaluasi() {
  var btn = document.getElementById('btn-simpan-evaluasi');
  var evaluasi = document.getElementById('ev-evaluasi').value.trim();
  if (!evaluasi) { tampilkanToast('Isi evaluasi tidak boleh kosong.', 'error'); return; }

  setLoading(btn, true);
  var body = {
    action:    'admin.simpanEvaluasi',
    token:     state.token,
    id:        document.getElementById('ev-id').value.trim(),
    evaluasi:  evaluasi,
    solusi:    document.getElementById('ev-solusi').value.trim(),
    kategori:  document.getElementById('ev-kategori').value,
    prioritas: document.getElementById('ev-prioritas').value,
    status:    document.getElementById('ev-status').value,
    gelombang: document.getElementById('ev-gelombang').value.trim()
  };

  _adminPost(body)
    .then(function (res) {
      setLoading(btn, false);
      if (res && res.ok) {
        tampilkanToast(res.pesan || 'Tersimpan.', 'success');
        tutupModal('modal-evaluasi');
        muatEvaluasi();
      } else {
        tampilkanToast((res && (res.pesan || res.error)) || 'Gagal menyimpan.', 'error');
      }
    })
    .catch(function () { setLoading(btn, false); tampilkanToast('Koneksi bermasalah.', 'error'); });
}

function hapusEvaluasi(id) {
  if (!confirm('Hapus catatan evaluasi ' + id + '? Tindakan ini tidak bisa dibatalkan.')) return;
  _adminPost({ action: 'admin.hapusEvaluasi', token: state.token, id: id })
    .then(function (res) {
      if (res && res.ok) {
        tampilkanToast(res.pesan || 'Terhapus.', 'success');
        muatEvaluasi();
      } else {
        tampilkanToast((res && (res.pesan || res.error)) || 'Gagal menghapus.', 'error');
      }
    })
    .catch(function () { tampilkanToast('Koneksi bermasalah.', 'error'); });
}


// ============================================================================
// WHATSAPP — chat cepat pendaftar (template sadar-status)
// ============================================================================

// Template cadangan bila sheet WaTemplates belum di-setup / gagal dimuat.
var WA_FALLBACK = {
  DEFAULT:   'Assalamu\'alaikum {nama_depan}, kami dari Panitia Pendaftaran Rattilil Qur\'an terkait pendaftaran Anda (No. {nomor}).',
  TERDAFTAR: 'Assalamu\'alaikum {nama_depan}, pendaftaran Anda (No. {nomor}) program {program} telah kami terima. Mohon lengkapi berkas yang dibutuhkan. Jazakumullah khairan.',
  BERKAS_OK: 'Assalamu\'alaikum {nama_depan}, berkas pendaftaran Anda (No. {nomor}) sudah diverifikasi dan lengkap. Mohon menunggu informasi jadwal wawancara.',
  WAWANCARA: 'Assalamu\'alaikum {nama_depan}, Anda diundang mengikuti wawancara untuk pendaftaran No. {nomor} ({program}). Detail jadwal: ',
  DITERIMA:  'Assalamu\'alaikum {nama_depan}, selamat! Anda dinyatakan DITERIMA sebagai santri Rattilil Qur\'an (No. {nomor}). Info daftar ulang: ',
  DITOLAK:   'Assalamu\'alaikum {nama_depan}, terima kasih atas pendaftaran Anda (No. {nomor}). Mohon maaf untuk periode ini kami belum dapat menerima. Semoga Allah memudahkan.'
};

function muatWaTemplates() {
  _adminGet({ action: 'admin.watemplates', token: state.token })
    .then(function (res) {
      state.waTemplates = (res && res.ok && res.data && res.data.length) ? res.data : null;
    })
    .catch(function () { state.waTemplates = null; });
}

// Normalisasi HP ke format wa.me (kode negara Indonesia 62).
// Menangani: 08xx → 628xx, 8xx (tanpa 0) → 628xx, +62/62xx → tetap.
// (Bug: sebelumnya nomor tanpa awalan 0 dibiarkan → WhatsApp salah baca 82 = Korea.)
function _hpWa(hp) {
  var s = String(hp || '').replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.charAt(0) === '0') return '62' + s.slice(1);
  if (s.slice(0, 2) !== '62') return '62' + s;
  return s;
}

// Ganti token {..} dengan data pendaftar.
function _isiTemplate(teks, row) {
  var namaDepan = String(row.nama || '').split(' ')[0];
  return String(teks || '')
    .replace(/\{nama_depan\}/g, namaDepan)
    .replace(/\{nama\}/g,       row.nama || '')
    .replace(/\{nomor\}/g,      row.no_pendaftaran || '')
    .replace(/\{program\}/g,    row.program || '')
    .replace(/\{jadwal\}/g,     row.jadwal_id || '')
    .replace(/\{status\}/g,     labelStatus(row.status) || '');
}

// Daftar template untuk satu pendaftar: status-nya dulu, lalu DEFAULT, lalu sisanya.
function _daftarTemplateUntuk(row) {
  var src = state.waTemplates;
  var list = [];
  if (src && src.length) {
    src.forEach(function (t) { if (t.status === row.status)    list.push(t); });
    src.forEach(function (t) { if (t.status === 'DEFAULT')     list.push(t); });
    src.forEach(function (t) { if (t.status !== row.status && t.status !== 'DEFAULT') list.push(t); });
  } else {
    var st = WA_FALLBACK[row.status] ? row.status : 'DEFAULT';
    list.push({ status: st, label: labelStatus(st) || 'Sesuai Status', pesan: WA_FALLBACK[st] });
    if (st !== 'DEFAULT') list.push({ status: 'DEFAULT', label: 'Sapaan Umum', pesan: WA_FALLBACK.DEFAULT });
  }
  return list;
}

function _bukaWa(hp, pesan, ctx) {
  var no = _hpWa(hp);
  if (!no || no.length < 8) { tampilkanToast('Nomor HP tidak valid untuk WhatsApp.', 'error'); return; }
  window.open('https://wa.me/' + no + '?text=' + encodeURIComponent(pesan), '_blank');
  // Catat aktivitas (fire-and-forget; kegagalan tidak mengganggu admin).
  if (ctx && ctx.no_pendaftaran) {
    try {
      _adminPost({ action: 'admin.logWa', token: state.token,
                   no_pendaftaran: ctx.no_pendaftaran, nama: ctx.nama || '', template: ctx.template || '' });
    } catch (e) {}
  }
}

// Chat cepat dari tabel — langsung pakai template teratas (sesuai status).
function chatWa(no) {
  var row = state.pendaftar.find(function (r) { return r.no_pendaftaran === no; });
  if (!row) return;
  var tmpl = _daftarTemplateUntuk(row)[0];
  _bukaWa(row.hp, _isiTemplate(tmpl.pesan, row),
          { no_pendaftaran: row.no_pendaftaran, nama: row.nama, template: tmpl.label });
}

// Dipanggil saat template di dropdown modal diganti.
function isiPesanWa() {
  var row = state.selectedPendaftar;
  if (!row) return;
  var idx  = parseInt(document.getElementById('wa-template').value, 10) || 0;
  var list = state._waList || _daftarTemplateUntuk(row);
  var tmpl = list[idx] || list[0];
  document.getElementById('wa-pesan').value = _isiTemplate(tmpl.pesan, row);
}

function bukaWaDariModal() {
  var row = state.selectedPendaftar;
  if (!row) return;
  var sel = document.getElementById('wa-template');
  var list = state._waList || [];
  var lbl = (list[parseInt(sel.value, 10) || 0] || {}).label || '';
  _bukaWa(row.hp, document.getElementById('wa-pesan').value,
          { no_pendaftaran: row.no_pendaftaran, nama: row.nama, template: lbl });
}


// ============================================================================
// GELOMBANG
// ============================================================================

function muatGelombang() {
  var tbody = document.getElementById('tbody-gelombang');
  tbody.innerHTML = '<tr><td colspan="8" class="no-data">Memuat data...</td></tr>';

  _adminGet({ action: 'admin.gelombang', token: state.token })
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
      '<td>' + (g.tgl_mulai   ? formatTanggal(g.tgl_mulai)   : '—') + '</td>' +
      '<td>' + (g.tgl_selesai ? formatTanggal(g.tgl_selesai) : '—') + '</td>' +
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
  fetch(CONFIG.BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })
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

  fetch(CONFIG.BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })
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

  _adminGet({ action: 'admin.formfields', token: state.token })
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
  var waP2 = document.getElementById('wa-panel'); if (waP2) waP2.style.display = 'none';
  var rwP2 = document.getElementById('riwayat-panel'); if (rwP2) rwP2.style.display = 'none';

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

  fetch(CONFIG.BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })
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


// ============================================================================
// #4 CHART STATISTIK
// ============================================================================

var _charts = {};

function muatCharts() {
  _adminGet({ action: 'admin.stats', token: state.token })
    .then(function(res) {
      if (!res.ok) return;
      var stats = res.data;
      renderChartStatus(stats.per_status || {});
      renderChartJadwal(stats.per_jadwal || {});
      renderChartGender(stats);
      renderChartTren(state.pendaftar || []);
      renderChartFunnel(stats.per_status || {});
    })
    .catch(function() { tampilkanToast('Gagal memuat statistik.', 'error'); });
}

function renderChartStatus(perStatus) {
  var ctx = document.getElementById('chart-status');
  if (!ctx) return;
  if (_charts['status']) { _charts['status'].destroy(); }

  var labels = { 'TERDAFTAR': 'Terdaftar', 'BERKAS_OK': 'Berkas OK', 'WAWANCARA': 'Wawancara', 'DITERIMA': 'Diterima', 'DITOLAK': 'Ditolak' };
  var colors = ['#0ea5e9', '#6366f1', '#f59e0b', '#10b981', '#ef4444'];
  var keys = Object.keys(perStatus);
  var vals = keys.map(function(k) { return perStatus[k]; });
  var lbls = keys.map(function(k) { return labels[k] || k; });

  _charts['status'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: lbls,
      datasets: [{ data: vals, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Plus Jakarta Sans', size: 11 } } }
      }
    }
  });
}

function renderChartJadwal(perJadwal) {
  var ctx = document.getElementById('chart-jadwal');
  if (!ctx) return;
  if (_charts['jadwal']) { _charts['jadwal'].destroy(); }

  var keys = Object.keys(perJadwal);
  var vals = keys.map(function(k) { return perJadwal[k]; });

  _charts['jadwal'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: keys,
      datasets: [{
        label: 'Pendaftar',
        data: vals,
        backgroundColor: 'rgba(14,165,233,.75)',
        borderColor: '#0ea5e9',
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { font: { family: 'Plus Jakarta Sans', size: 11 } } }
      }
    }
  });
}

function renderChartGender(stats) {
  var ctx = document.getElementById('chart-gender');
  if (!ctx) return;
  if (_charts['gender']) { _charts['gender'].destroy(); }

  // Hitung dari data pendaftar
  var lk = 0, pr = 0;
  (state.pendaftar || []).forEach(function(r) {
    if ((r.gender || '').toLowerCase().indexOf('laki') !== -1) lk++;
    else if ((r.gender || '').toLowerCase().indexOf('perempuan') !== -1) pr++;
  });

  _charts['gender'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Laki-laki', 'Perempuan'],
      datasets: [{
        data: [lk, pr],
        backgroundColor: ['rgba(99,102,241,.75)', 'rgba(236,72,153,.75)'],
        borderColor: ['#6366f1', '#ec4899'],
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}


function renderChartTren(rows) {
  var ctx = document.getElementById('chart-tren');
  if (!ctx) return;
  if (_charts['tren']) { _charts['tren'].destroy(); }

  // Kelompokkan per tanggal (YYYY-MM-DD) dari timestamp.
  var byDay = {};
  (rows || []).forEach(function (r) {
    var d = new Date(r.timestamp);
    if (isNaN(d.getTime())) return;
    var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    byDay[key] = (byDay[key] || 0) + 1;
  });
  var keys = Object.keys(byDay).sort();
  var vals = keys.map(function (k) { return byDay[k]; });
  var lbls = keys.map(function (k) { var p = k.split('-'); return p[2] + '/' + p[1]; });

  _charts['tren'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: lbls,
      datasets: [{
        label: 'Pendaftar', data: vals,
        borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,.15)',
        fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

function renderChartFunnel(perStatus) {
  var ctx = document.getElementById('chart-funnel');
  if (!ctx) return;
  if (_charts['funnel']) { _charts['funnel'].destroy(); }

  // Funnel kumulatif: tiap tahap = jumlah yang mencapai minimal tahap itu.
  var terdaftar = perStatus['TERDAFTAR'] || 0;
  var berkas    = perStatus['BERKAS_OK'] || 0;
  var wawancara = perStatus['WAWANCARA'] || 0;
  var diterima  = perStatus['DITERIMA']  || 0;
  var f4 = diterima;
  var f3 = wawancara + f4;
  var f2 = berkas + f3;
  var f1 = terdaftar + f2;

  _charts['funnel'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Terdaftar', 'Berkas OK', 'Wawancara', 'Diterima'],
      datasets: [{
        data: [f1, f2, f3, f4],
        backgroundColor: ['rgba(14,165,233,.75)', 'rgba(99,102,241,.75)', 'rgba(245,158,11,.75)', 'rgba(16,185,129,.75)'],
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}


// ============================================================================
// TEMPLATE WA — editor (CRUD via sheet WaTemplates)
// ============================================================================

function muatWaTemplateAdmin() {
  var tbody = document.getElementById('tbody-watemplate');
  tbody.innerHTML = '<tr><td colspan="5" class="no-data">Memuat data...</td></tr>';

  _adminGet({ action: 'admin.watemplates', token: state.token, all: 'true' })
    .then(function (res) {
      if (!res.ok) { tbody.innerHTML = '<tr><td colspan="5" class="no-data">Gagal memuat data.</td></tr>'; return; }
      state.waTemplateAdmin = res.data || [];
      renderTabelWaTemplate();
    })
    .catch(function () { tbody.innerHTML = '<tr><td colspan="5" class="no-data">Koneksi bermasalah.</td></tr>'; });
}

function renderTabelWaTemplate() {
  var tbody = document.getElementById('tbody-watemplate');
  var list = state.waTemplateAdmin || [];
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Belum ada template. Klik “+ Tambah”.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  list.forEach(function (t) {
    var preview = String(t.pesan || '');
    if (preview.length > 80) preview = preview.slice(0, 80) + '…';
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><span class="badge badge-' + esc(t.status) + '">' + esc(t.status) + '</span></td>' +
      '<td>' + esc(t.label) + '</td>' +
      '<td style="font-size:0.8rem;color:var(--ink-3)">' + esc(preview) + '</td>' +
      '<td>' + (t.active ? '✅' : '❌') + '</td>' +
      '<td><button class="btn-icon" title="Edit" onclick="bukaEditWaTemplate(\'' + esc(t.status) + '\')">✏️</button></td>';
    tbody.appendChild(tr);
  });
}

function bukaEditWaTemplate(status) {
  var t = (state.waTemplateAdmin || []).find(function (x) { return x.status === status; });
  var baru = !t;
  document.getElementById('modal-watemplate-title').textContent = baru ? 'Tambah Template' : 'Edit Template — ' + status;
  document.getElementById('wt-status').value = baru ? '' : t.status;
  document.getElementById('wt-status').readOnly = !baru;   // status jadi kunci; tak diubah saat edit
  document.getElementById('wt-label').value = baru ? '' : (t.label || '');
  document.getElementById('wt-pesan').value = baru ? '' : (t.pesan || '');
  document.getElementById('wt-active').checked = baru ? true : !!t.active;
  bukaModal('modal-watemplate');
}

function simpanWaTemplate() {
  var status = document.getElementById('wt-status').value.trim().toUpperCase();
  if (!status) { tampilkanToast('Status wajib diisi.', 'error'); return; }
  var btn = document.getElementById('btn-simpan-watemplate');
  setLoading(btn, true);

  var body = {
    action:  'admin.updateWaTemplate',
    token:   state.token,
    status:  status,
    label:   document.getElementById('wt-label').value,
    pesan:   document.getElementById('wt-pesan').value,
    active:  document.getElementById('wt-active').checked ? 'true' : 'false'
  };

  _adminPost(body)
    .then(function (res) {
      setLoading(btn, false);
      if (res.ok) {
        tampilkanToast('Template disimpan.', 'success');
        tutupModal('modal-watemplate');
        muatWaTemplateAdmin();
        muatWaTemplates();   // segarkan cache template utk fitur chat
      } else {
        tampilkanToast(res.pesan || res.error || 'Gagal menyimpan.', 'error');
      }
    })
    .catch(function () { setLoading(btn, false); tampilkanToast('Koneksi bermasalah.', 'error'); });
}


// ============================================================================
// #7 QR CODE
// ============================================================================

var QR_URL = 'https://rattililquran.github.io/pendaftaran/';

function muatQRCode() {
  var container = document.getElementById('qrcode-container');
  var urlEl = document.getElementById('qr-url');
  if (!container) return;

  container.innerHTML = '<div style="color:var(--ink-3);font-size:0.85rem;padding:20px">Memuat QR Code...</div>';
  urlEl.textContent = QR_URL;

  // Lazy load QRCode library jika belum ada
  function generateQR() {
    if (typeof QRCode === 'undefined') {
      container.innerHTML = '<p style="color:var(--danger);font-size:0.85rem">Gagal memuat library QR Code.</p>';
      return;
    }
    container.innerHTML = '';
    try {
      var qr = new QRCode(container, {
        text: QR_URL,
        width: 220,
        height: 220,
        colorDark: '#0b1220',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      // Set id canvas untuk download
      setTimeout(function() {
        var canvas = container.querySelector('canvas');
        if (canvas) { canvas.id = 'qr-canvas'; canvas.style.borderRadius = '8px'; }
      }, 300);
    } catch(e) {
      container.innerHTML = '<p style="color:var(--danger);font-size:0.85rem">Gagal generate QR Code.</p>';
    }
  }

  if (typeof QRCode !== 'undefined') {
    generateQR();
  } else {
    var script = document.createElement('script');
    // qrcodejs — library QR Code untuk browser
    script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    script.onload = generateQR;
    script.onerror = function() {
      container.innerHTML = '<p style="color:var(--danger);font-size:0.85rem">Gagal memuat library QR Code. Periksa koneksi internet.</p>';
    };
    document.head.appendChild(script);
  }
}

function downloadQR() {
  var canvas = document.getElementById('qr-canvas');
  if (!canvas) { tampilkanToast('Generate QR Code dulu.', 'error'); return; }
  var link = document.createElement('a');
  link.download = 'rattilil-qr-pendaftaran.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  tampilkanToast('QR Code diunduh.', 'success');
}

function copyQRLink() {
  navigator.clipboard.writeText(QR_URL).then(function() {
    var el = document.getElementById('qr-copy-text');
    el.textContent = '✓ Link Tersalin!';
    setTimeout(function() { el.textContent = '⎘ Salin Link'; }, 2500);
  });
}


// ============================================================================
// #8 DARK MODE
// ============================================================================

function initDarkMode() {
  var saved = localStorage.getItem('rattilil-theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('theme-dark');
  }
}

function toggleDarkMode() {
  var isDark = document.documentElement.classList.toggle('theme-dark');
  localStorage.setItem('rattilil-theme', isDark ? 'dark' : 'light');
  var btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.textContent = isDark ? '☀' : '🌙';
}

// Init dark mode on load
initDarkMode();
