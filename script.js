document.addEventListener('DOMContentLoaded', () => {
    // A. CORE APP SETUP
    const DB_KEY = 'dts.app.v1';
    let state = {};
    let chartInstances = {};
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    const seedData = {
        sekolah: [ { id: 's1', nama: 'Yayasan Waqaf Said Na\'um' } ],
        tahunAjaran: [ { id: 't1', sekolahId: 's1', label: '2024/2025' }, { id: 't2', sekolahId: 's1', label: '2025/2026' } ],
        unit: [
            { id: 'u1', tahunId: 't1', namaUnit: 'TKI', targetDayaTampung: 90, ppdbBersama: 0, ppdbMandiri: 85, displayOrder: 0 },
            { id: 'u2', tahunId: 't1', namaUnit: 'SDI', targetDayaTampung: 82, ppdbBersama: 0, ppdbMandiri: 80, displayOrder: 1 },
            { id: 'u3', tahunId: 't2', namaUnit: 'TKI', targetDayaTampung: 90, ppdbBersama: 0, ppdbMandiri: 64, displayOrder: 0 },
            { id: 'u4', tahunId: 't2', namaUnit: 'SDI', targetDayaTampung: 82, ppdbBersama: 0, ppdbMandiri: 75, displayOrder: 1 },
            { id: 'u5', tahunId: 't2', namaUnit: 'SMPI', targetDayaTampung: 90, ppdbBersama: 15, ppdbMandiri: 29, displayOrder: 2 },
        ],
        auditLog: [], snapshots: [],
        preferences: { 
            currentSekolahId: 's1', currentTahunId: 't2', role: 'Admin',
            chartColors: ['#8A2BE2', '#4169E1', '#00CED1', '#FF4500', '#2E8B57']
        }
    };

    // B. STATE & UTILITY FUNCTIONS
    const loadState = () => { try { const s = localStorage.getItem(DB_KEY); state = s ? JSON.parse(s) : JSON.parse(JSON.stringify(seedData)); if (!state.preferences.chartColors) state.preferences.chartColors = seedData.preferences.chartColors; } catch { state = JSON.parse(JSON.stringify(seedData)); }};
    const saveState = () => { try { localStorage.setItem(DB_KEY, JSON.stringify(state)); } catch (e) { showToast('Gagal menyimpan data.', 'error'); } };
    const logAudit = (action, detail) => state.auditLog.unshift({ id: generateId(), timestamp: new Date().toISOString(), actor: state.preferences.role, action, detail: JSON.stringify(detail) });
    const saveAndRender = () => { saveState(); renderAll(); };
    const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const showToast = (message, type = 'success') => { const t = $('#toast-notification'); t.textContent = message; t.className = `show ${type}`; setTimeout(() => t.classList.remove('show'), 3000); };
    const createGradient = (ctx, area, color1, color2) => { if (!area) return color1; const g = ctx.createLinearGradient(0, area.bottom, 0, area.top); g.addColorStop(0, color1); g.addColorStop(1, color2 || color1); return g; };

    // C. RENDER FUNCTIONS
    const renderAll = () => { renderAppChrome(); renderActivePage(); };
    const renderAppChrome = () => {
        $('#sekolah-select').innerHTML = state.sekolah.map(s => `<option value="${s.id}" ${s.id === state.preferences.currentSekolahId ? 'selected' : ''}>${s.nama}</option>`).join('');
        const filteredTahun = state.tahunAjaran.filter(t => t.sekolahId === state.preferences.currentSekolahId);
        $('#tahun-select').innerHTML = filteredTahun.map(t => `<option value="${t.id}" ${t.id === state.preferences.currentTahunId ? 'selected' : ''}>${t.label}</option>`).join('');
        document.body.className = state.preferences.role === 'Admin' ? '' : 'viewer-mode';
    };
    const renderActivePage = () => {
        const activeNav = $('.nav-item.active');
        const pageId = activeNav ? activeNav.getAttribute('href').substring(1) : 'dashboard';
        $$('.page').forEach(p => p.classList.toggle('active', p.id === pageId));
        const renderMap = {'dashboard': renderDashboard, 'daya-tampung': renderDayaTampungTable, 'tren-siswa': renderTrenChart, 'audit-log': renderAuditLog, 'pengaturan': renderPengaturan};
        if (renderMap[pageId]) { try { renderMap[pageId](); } catch (e) { console.error(`Failed to render page ${pageId}:`, e); } }
    };
    const renderDashboard = () => {
        const units = state.unit.filter(u => u.tahunId === state.preferences.currentTahunId);
        const kpi = units.reduce((a, u) => { const j = (u.ppdbBersama||0)+(u.ppdbMandiri||0); a.totalTarget+=u.targetDayaTampung||0; a.totalSiswa+=j; if(j>u.targetDayaTampung) a.unitOver++; return a; }, {totalTarget:0,totalSiswa:0,unitOver:0});
        kpi.avgCapaian = kpi.totalTarget > 0 ? (kpi.totalSiswa / kpi.totalTarget * 100).toFixed(1) : 0;
        $('#kpi-total-target').textContent = kpi.totalTarget; $('#kpi-total-siswa').textContent = kpi.totalSiswa;
        $('#kpi-avg-capaian').textContent = `${kpi.avgCapaian}%`; $('#kpi-unit-over').textContent = kpi.unitOver;
        renderDashboardCharts(units);
    };
    const renderDayaTampungTable = () => {
        const units = state.unit.filter(u => u.tahunId === state.preferences.currentTahunId).map(u => ({ ...u, jumlah: (u.ppdbBersama||0) + (u.ppdbMandiri||0) })).map(u => ({ ...u, capaian: u.targetDayaTampung > 0 ? u.jumlah / u.targetDayaTampung : 0 })).map(u => ({ ...u, status: u.capaian >= 1 ? 'Penuh' : 'Buka' })).filter(u => u.namaUnit && u.namaUnit.toLowerCase().includes($('#search-input').value.toLowerCase())).filter(u => $('#filter-status').value === 'semua' || u.status === $('#filter-status').value).sort((a,b) => a.displayOrder - b.displayOrder);
        $('#daya-tampung-tbody').innerHTML = units.map((u, index) => `
            <tr data-id="${u.id}" draggable="true">
                <td data-label="#">${index + 1}</td><td data-label="Nama Unit">${u.namaUnit}</td>
                <td data-label="Target">${u.targetDayaTampung}</td><td data-label="PPDB Bersama">${u.ppdbBersama}</td>
                <td data-label="PPDB Mandiri">${u.ppdbMandiri}</td><td data-label="Jumlah">${u.jumlah}</td>
                <td data-label="Capaian">${(u.capaian * 100).toFixed(1)}%</td><td data-label="Status">${u.status}</td>
                <td data-label="Aksi"><button class="action-btn edit"><i class="fas fa-edit"></i></button><button class="action-btn delete"><i class="fas fa-trash"></i></button></td>
            </tr>`).join('');
    };
    const renderAuditLog = () => { $('#audit-log-tbody').innerHTML = state.auditLog.map(l => `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td>${l.actor}</td><td>${l.action}</td><td>${l.detail}</td></tr>`).join(''); };
    const renderPengaturan = () => {
        $('#sekolah-list').innerHTML = state.sekolah.map(s => `<div class="list-item"><span>${s.nama}</span></div>`).join('');
        $('#tahun-ajaran-list').innerHTML = state.tahunAjaran.filter(t => t.sekolahId === state.preferences.currentSekolahId).map(t => `<div class="list-item"><span>${t.label}</span></div>`).join('');
        $('#snapshot-list').innerHTML = state.snapshots.map(s => `<li class="list-item"><span>${s.label} (${new Date(s.createdAt).toLocaleDateString()})</span><button class="glowing-btn secondary" data-snapshot-id="${s.id}">Rollback</button></li>`).join('');
        $('#role-select').value = state.preferences.role;
        // [FEATURE] Render Pengaturan Warna
        const colorContainer = $('#color-picker-container');
        colorContainer.innerHTML = state.preferences.chartColors.map((color, index) => `
            <div class="color-picker-item">
                <label for="color-${index}">Warna ${index + 1}</label>
                <input type="color" id="color-${index}" value="${color}" data-index="${index}">
            </div>
        `).join('');
    };
    
    // [UPDATE] Mengubah semua grafik menjadi Bar Chart
    const renderDashboardCharts = (units) => {
        const p = state.preferences.chartColors;
        const l = units.map(u => u.namaUnit), dJ = units.map(u => (u.ppdbBersama||0)+(u.ppdbMandiri||0)), dT = units.map(u => u.targetDayaTampung||0);
        const rC = (id, c) => { if(chartInstances[id]) chartInstances[id].destroy(); const x = $(`#${id}`)?.getContext('2d'); if(x) chartInstances[id] = new Chart(x, c); };
        
        // Grafik 1: Komposisi Siswa (Bar Chart)
        rC('dashboard-composition-chart', { type: 'bar', data: { labels:l, datasets: [{ label: 'Jumlah Siswa', data: dJ, backgroundColor: c => createGradient(c.chart.ctx, c.chart.chartArea, p[0], p[1] || p[0]), borderWidth: 0, borderRadius: 10 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#8b949e' } } }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#222', titleColor: '#fff', bodyColor: '#fff', borderRadius: 6, padding: 10 } } } });
        
        // Grafik 2: Target vs Realisasi (Bar Chart)
        rC('dashboard-comparison-chart', { type: 'bar', data: { labels:l, datasets: [ { label: 'Realisasi', data: dJ, backgroundColor: c => createGradient(c.chart.ctx, c.chart.chartArea, p[2] || p[0], p[3] || p[1]), borderWidth: 0, borderRadius: 10 }, { label: 'Target', data: dT, backgroundColor: 'rgba(139, 148, 158, 0.2)', borderWidth: 0, borderRadius: 10 } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#8b949e' } } }, plugins: { legend: { position: 'bottom', labels: { color: '#8b949e', usePointStyle: true, pointStyle: 'rectRounded' } }, tooltip: { backgroundColor: '#222', titleColor: '#fff', bodyColor: '#fff', borderRadius: 6, padding: 10, usePointStyle: true } } } });
    };
    const renderTrenChart = () => {
        const p = state.preferences.chartColors;
        const thn = state.tahunAjaran.filter(t => t.sekolahId === state.preferences.currentSekolahId).sort((a,b) => a.label.localeCompare(b.label));
        const allU = state.unit.filter(u => thn.some(t => t.id === u.tahunId));
        const labels = thn.map(t => t.label);
        const uniqueNames = [...new Set(allU.map(u => u.namaUnit))];
        const datasets = uniqueNames.map((nama, i) => ({
            label: nama, data: labels.map(l => { const t = thn.find(th=>th.label===l); const uD = allU.find(u=>u.tahunId===t.id && u.namaUnit===nama); return uD ? (uD.ppdbBersama||0)+(uD.ppdbMandiri||0) : 0; }),
            backgroundColor: p[i % p.length], borderWidth: 0, borderRadius: 6
        }));
        const rC = (id, c) => { if(chartInstances[id]) chartInstances[id].destroy(); const x = $(`#${id}`)?.getContext('2d'); if(x) chartInstances[id] = new Chart(x, c); };
        rC('tren-chart', { type: 'bar', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } }, x: { ticks: { color: '#8b949e' }, grid: { color: 'transparent' } } }, plugins: { legend: { position: 'bottom', labels: { color: '#8b949e' } } } } });
    };

    // D. EVENT HANDLERS
    const handleNavClick = (e) => { e.preventDefault(); $$('.nav-item').forEach(i => i.classList.remove('active')); e.currentTarget.classList.add('active'); renderActivePage(); if (window.innerWidth <= 1024) $('.sidebar').classList.remove('open'); };
    const handleOpenFormModal = (type, id = null) => {
        let data = {}; if (id) data = state.unit.find(u=>u.id===id);
        const forms = {
            'addUnit': { title: 'Tambah Unit Baru', html: `<div class="form-group"><label>Nama Unit</label><input type="text" name="namaUnit" required></div><div class="form-group"><label>Target</label><input type="number" name="targetDayaTampung" value="0" required></div><div class="form-group"><label>PPDB Bersama</label><input type="number" name="ppdbBersama" value="0" required></div><div class="form-group"><label>PPDB Mandiri</label><input type="number" name="ppdbMandiri" value="0" required></div>` },
            'editUnit': { title: 'Edit Unit', html: `<input type="hidden" name="id" value="${id}"><div class="form-group"><label>Nama Unit</label><input type="text" name="namaUnit" value="${data.namaUnit}" required></div><div class="form-group"><label>Target</label><input type="number" name="targetDayaTampung" value="${data.targetDayaTampung}" required></div><div class="form-group"><label>PPDB Bersama</label><input type="number" name="ppdbBersama" value="${data.ppdbBersama}" required></div><div class="form-group"><label>PPDB Mandiri</label><input type="number" name="ppdbMandiri" value="${data.ppdbMandiri}" required></div>` },
            'addSekolah': { title: 'Tambah Sekolah', html: `<div class="form-group"><label>Nama Sekolah</label><input type="text" name="nama" required></div>` },
            'addTahun': { title: 'Tambah Tahun Ajaran', html: `<div class="form-group"><label>Label (cth: 2026/2027)</label><input type="text" name="label" required></div>` }
        };
        $('#modal-title').textContent = forms[type].title;
        $('#modal-form').innerHTML = `${forms[type].html}<div class="modal-actions"><button type="submit" class="glowing-btn">Simpan</button></div>`;
        $('#modal-form').dataset.type = type;
        $('#form-modal').style.display = 'block';
    };
    const handleFormSubmit = (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        const type = e.target.dataset.type;
        const num = (val) => parseInt(val) || 0;

        if (type === 'addUnit') { const newUnit = { id: generateId(), tahunId: state.preferences.currentTahunId, namaUnit: data.namaUnit || 'N/A', targetDayaTampung: num(data.targetDayaTampung), ppdbBersama: num(data.ppdbBersama), ppdbMandiri: num(data.ppdbMandiri), displayOrder: 99 }; state.unit.push(newUnit); logAudit('CREATE_UNIT', newUnit); } 
        else if (type === 'editUnit') { const i = state.unit.findIndex(u => u.id === data.id); if (i > -1) { state.unit[i] = { ...state.unit[i], namaUnit: data.namaUnit, targetDayaTampung: num(data.targetDayaTampung), ppdbBersama: num(data.ppdbBersama), ppdbMandiri: num(data.ppdbMandiri) }; logAudit('UPDATE_UNIT', state.unit[i]); } } 
        else if (type === 'addSekolah') { state.sekolah.push({ id: generateId(), nama: data.nama }); logAudit('CREATE_SEKOLAH', data); } 
        else if (type === 'addTahun') { state.tahunAjaran.push({ id: generateId(), sekolahId: state.preferences.currentSekolahId, label: data.label }); logAudit('CREATE_TAHUN', data); }
        
        saveAndRender();
        $('#form-modal').style.display = 'none';
        showToast('Data berhasil disimpan.');
    };

    // E. INITIALIZATION
    try {
        loadState();
        $$('.nav-item').forEach(item => item.addEventListener('click', handleNavClick));
        $('.hamburger-btn').addEventListener('click', () => $('.sidebar').classList.add('open'));
        $('.close-sidebar-btn').addEventListener('click', () => $('.sidebar').classList.remove('open'));
        $('#sekolah-select').addEventListener('change', e => { state.preferences.currentSekolahId = e.target.value; const f = state.tahunAjaran.find(t=>t.sekolahId===e.target.value); state.preferences.currentTahunId = f ? f.id : null; saveAndRender(); });
        $('#tahun-select').addEventListener('change', e => { state.preferences.currentTahunId = e.target.value; saveAndRender(); });
        $('#add-unit-btn').addEventListener('click', () => handleOpenFormModal('addUnit'));
        $('#daya-tampung-tbody').addEventListener('click', e => {
            const row = e.target.closest('tr[data-id]'); if (!row) return;
            if (e.target.closest('.edit')) handleOpenFormModal('editUnit', row.dataset.id);
            if (e.target.closest('.delete')) {
                const unit = state.unit.find(u => u.id === row.dataset.id);
                $('#confirm-title').textContent = "Hapus Unit"; $('#confirm-text').textContent = `Yakin ingin menghapus "${unit.namaUnit}"?`;
                $('#confirm-modal').style.display = 'block';
                $('#confirm-ok-btn').onclick = () => { state.unit = state.unit.filter(u => u.id !== row.dataset.id); logAudit('DELETE_UNIT', { id: row.dataset.id }); saveAndRender(); $('#confirm-modal').style.display = 'none'; showToast('Unit dihapus.'); };
            }
        });
        $('#search-input').addEventListener('input', renderDayaTampungTable);
        $('#filter-status').addEventListener('change', renderDayaTampungTable);
        $('#reset-filters-btn').addEventListener('click', () => { $('#search-input').value = ''; $('#filter-status').value = 'semua'; renderDayaTampungTable(); });
        $('#modal-form').addEventListener('submit', handleFormSubmit);
        $('.close-btn').addEventListener('click', () => $('#form-modal').style.display = 'none');
        $('#confirm-cancel-btn').addEventListener('click', () => $('#confirm-modal').style.display = 'none');
        $('#add-sekolah-btn').addEventListener('click', () => handleOpenFormModal('addSekolah'));
        $('#add-tahun-btn').addEventListener('click', () => handleOpenFormModal('addTahun'));
        $('#role-select').addEventListener('change', e => { state.preferences.role = e.target.value; saveAndRender(); });
        $('#create-snapshot-btn').addEventListener('click', () => {
            const label = $('#snapshot-label').value.trim();
            if (label) { state.snapshots.push({ id: generateId(), createdAt: new Date().toISOString(), label, payload: JSON.stringify(state) }); logAudit('CREATE_SNAPSHOT', { label }); saveAndRender(); showToast('Snapshot dibuat.'); $('#snapshot-label').value = ''; } 
            else { showToast('Label snapshot tidak boleh kosong.', 'warning'); }
        });
        $('#snapshot-list').addEventListener('click', e => {
            const button = e.target.closest('[data-snapshot-id]'); if (!button) return;
            const s = state.snapshots.find(snap => snap.id === button.dataset.snapshotId); if (!s) return;
            $('#confirm-title').textContent = "Konfirmasi Rollback"; $('#confirm-text').textContent = `Yakin ingin rollback ke "${s.label}"?`;
            $('#confirm-modal').style.display = 'block';
            $('#confirm-ok-btn').onclick = () => { state = JSON.parse(s.payload); logAudit('ROLLBACK', { to: s.label }); saveAndRender(); $('#confirm-modal').style.display = 'none'; showToast(`Berhasil rollback.`); };
        });
        $('#save-colors-btn').addEventListener('click', () => {
            const newColors = [];
            $$('#color-picker-container input[type="color"]').forEach(input => {
                newColors.push(input.value);
            });
            state.preferences.chartColors = newColors;
            logAudit('UPDATE_COLORS', newColors);
            saveAndRender();
            showToast('Palet warna berhasil disimpan.');
        });
        saveAndRender();
    } catch (error) {
        console.error("A fatal error occurred during initialization:", error);
        document.body.innerHTML = `<div style="color: white; padding: 20px;"><h1>Aplikasi Gagal Dimuat</h1><p>Terjadi kesalahan kritis. Silakan coba bersihkan cache browser atau hubungi pengembang.</p><pre>${error.stack}</pre></div>`;
    }
});