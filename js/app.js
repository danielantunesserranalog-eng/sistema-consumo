// ==================== CONFIGURAÇÃO DO SUPABASE ==================== 
const SUPABASE_URL = 'https://qhbenzrxajbeaatwxtlj.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoYmVuenJ4YWpiZWFhdHd4dGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzQ2OTksImV4cCI6MjA5MjMxMDY5OX0.2ddgnsjmxqmX9xk68m9duUmzAO2n2OAvEpOgHevRwkU'; 
let supabaseClient = null; 
let isImporting = false; 

// Variáveis de Estado Global
let rawData = []; // Armazena em cache para cálculos rápidos
let driverChart = null, truckChart = null, timeChart = null, evolutionChart = null; 
let currentPage = 'dashboard'; 
let dashboardData = { avgConsumption: 0, totalDist: 0, totalFuel: 0, avgTripsPerDay: 0, drivers: [], trucks: [], alerts: [], criticalDrivers: [] }; 

const PLACAS_IGNORADAS = ['GSR0001', 'GSR0002', 'GSR0007', 'GSR0008']; 

// Configuração Global Chart.js para Dark Mode
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(51, 65, 85, 0.5)';
Chart.defaults.font.family = "'Inter', sans-serif";

// ==================== INICIALIZAÇÃO ==================== 
function initSupabase() {     
    if (!supabaseClient && window.supabase) {         
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);         
        return true;     
    }     
    return !!supabaseClient; 
}

document.addEventListener('DOMContentLoaded', () => {     
    if (!initSupabase()) { console.error('Erro de Supabase'); return; }     
    initNavigation();     
    initMenuToggle();     
    initImportModule();   
    initDeleteModule(); 
    initGlobalFilters();
    loadCoreData(); // Dispara o carregamento inicial
});

function initNavigation() {     
    const navItems = document.querySelectorAll('.nav-item');     
    const pages = document.querySelectorAll('.page');     
    const pageTitle = document.getElementById('pageTitle');          
    
    navItems.forEach(item => {         
        item.addEventListener('click', (e) => {             
            e.preventDefault();             
            const pageId = item.dataset.page;             
            navItems.forEach(nav => nav.classList.remove('active'));             
            item.classList.add('active');             
            pages.forEach(page => page.classList.remove('active'));             
            
            const targetPage = document.getElementById(`${pageId}Page`);             
            if (targetPage) targetPage.classList.add('active');                          
            
            const pageNames = { 'dashboard': 'Visão Geral da Frota', 'consumo-evolution': 'Histórico de Evolução', 'configuracoes': 'Gerenciamento de Dados' };             
            if (pageTitle) pageTitle.textContent = pageNames[pageId] || 'SISTEMA_CONSUMO';             
            currentPage = pageId;             
            
            // Oculta filtros globais na aba de config
            document.getElementById('globalFilters').style.display = (pageId === 'configuracoes') ? 'none' : 'flex';
        });     
    }); 
}

function initMenuToggle() {     
    const menuToggle = document.getElementById('menuToggle');     
    const sidebar = document.getElementById('sidebar');     
    if (menuToggle && sidebar) menuToggle.addEventListener('click', () => sidebar.classList.toggle('open')); 
}

// ==================== FILTROS GLOBAIS E BUSCA ====================
function initGlobalFilters() {
    const typeSelect = document.getElementById('entityType');
    const valueSelect = document.getElementById('entityValue');
    const groupValue = document.getElementById('entityValueGroup');
    const applyBtn = document.getElementById('applyFilterBtn');

    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'all') {
            groupValue.style.display = 'none';
            valueSelect.innerHTML = '<option value="">--</option>';
        } else {
            groupValue.style.display = 'flex';
            populateEntityDropdown(typeSelect.value);
        }
    });

    applyBtn.addEventListener('click', () => {
        applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        loadCoreData().then(() => {
            applyBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados';
        });
    });
}

function getStartDateISO() {
    const val = document.getElementById('dateFilter').value;
    const d = new Date();
    d.setHours(0, 0, 0, 0);

    switch(val) {
        case 'd-1': d.setDate(d.getDate() - 1); break;
        case 'd-2': d.setDate(d.getDate() - 2); break;
        case 'd-7': d.setDate(d.getDate() - 7); break;
        case 'd-30': d.setDate(d.getDate() - 30); break;
        case 'week': d.setDate(d.getDate() - d.getDay()); break; // Domingo desta semana
        case 'month': d.setDate(1); break; // Dia 1 do mes
    }
    return d.toISOString();
}

async function loadCoreData() {
    const startDate = getStartDateISO();
    
    try {
        const { data, error } = await supabaseClient
            .from('viagens')
            .select('placa, motorista, km_l, distancia_km, inicio, tempo_conducao, tempo_parado, local_inicial, local_final')
            .gte('inicio', startDate)
            .order('inicio', { ascending: true })
            .limit(50000);
            
        if (error) throw error;
        
        rawData = data || [];
        if (rawData.length === 0) { showEmptyDashboard(); return; }

        // Recarrega dropdown se necessário
        const typeSelect = document.getElementById('entityType').value;
        if (typeSelect !== 'all') populateEntityDropdown(typeSelect);

        processFilteredData();
        
    } catch (e) {
        console.error(e);
        showDashboardError();
    }
}

function populateEntityDropdown(type) {
    const valueSelect = document.getElementById('entityValue');
    const currentValue = valueSelect.value;
    const column = type === 'motorista' ? 'motorista' : 'placa';
    
    const unique = [...new Set(rawData.map(d => d[column]).filter(Boolean))].sort();
    
    valueSelect.innerHTML = '<option value="all">TODOS</option>' + unique.map(v => `<option value="${v.replace(/'/g, "\\'")}">${v}</option>`).join('');
    
    if (unique.includes(currentValue)) {
        valueSelect.value = currentValue;
    }
}

function processFilteredData() {
    const eType = document.getElementById('entityType').value;
    const eVal = document.getElementById('entityValue').value;

    let filtered = rawData;
    
    if (eType !== 'all' && eVal && eVal !== 'all') {
        const col = eType === 'motorista' ? 'motorista' : 'placa';
        filtered = rawData.filter(v => v[col] === eVal);
    }

    if (filtered.length === 0) { showEmptyDashboard(); return; }

    calculateMetrics(filtered);
    renderDashboardCharts(filtered);
    renderTables();
    renderEvolutionChartLogic(filtered, eType, eVal);
}

// ==================== MATEMÁTICA ==================== 
function calculateMetrics(viagens) {     
    let globalDist = 0; let globalLitros = 0;          
    const driverMap = new Map();     
    const truckMap = new Map();

    viagens.forEach(v => {
        if (v.distancia_km && v.distancia_km > 0 && v.km_l && v.km_l > 0) {
            const dist = parseFloat(v.distancia_km);
            const litros = dist / parseFloat(v.km_l); 
            
            globalDist += dist;
            globalLitros += litros;

            const dName = v.motorista || 'Indefinido';
            if (!driverMap.has(dName)) driverMap.set(dName, { dist: 0, litros: 0 });
            driverMap.get(dName).dist += dist; driverMap.get(dName).litros += litros;

            const tPlate = v.placa || 'Indefinido';
            if (!truckMap.has(tPlate)) truckMap.set(tPlate, { dist: 0, litros: 0 });
            truckMap.get(tPlate).dist += dist; truckMap.get(tPlate).litros += litros;
        }
    });

    dashboardData.totalDist = globalDist;
    dashboardData.totalFuel = globalLitros;
    dashboardData.avgConsumption = globalLitros > 0 ? (globalDist / globalLitros) : 0;          
    
    dashboardData.drivers = Array.from(driverMap.entries())
        .map(([name, data]) => ({ name, dist: data.dist, realKML: data.litros > 0 ? data.dist / data.litros : 0 }))
        .sort((a, b) => b.realKML - a.realKML);
        
    dashboardData.criticalDrivers = dashboardData.drivers
        .filter(d => d.realKML > 0 && d.realKML < 1.80 && d.dist > 10)
        .sort((a, b) => a.realKML - b.realKML);

    dashboardData.trucks = Array.from(truckMap.entries())
        .map(([plate, data]) => ({ plate, realKML: data.litros > 0 ? data.dist / data.litros : 0 }))
        .sort((a, b) => b.realKML - a.realKML);
    
    const start = new Date(viagens[0].inicio);
    const end = new Date(viagens[viagens.length - 1].inicio);
    const daysDiff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));     
    
    const truckTrips = new Map();     
    viagens.forEach(v => { const p = v.placa || 'Indefinido'; truckTrips.set(p, (truckTrips.get(p) || 0) + 1); });     
    
    let sumTrips = 0; let active = 0; dashboardData.alerts = [];     
    
    dashboardData.trucks.forEach(t => { 
        const avg = (truckTrips.get(t.plate) || 0) / daysDiff;
        sumTrips += avg; active++;

        if (t.realKML < 1.80 && t.realKML > 0) dashboardData.alerts.push({ placa: t.plate, trips: avg.toFixed(1), issue: 'Alto Consumo' });
        else if (avg < 2) dashboardData.alerts.push({ placa: t.plate, trips: avg.toFixed(1), issue: 'Baixa Rodagem' });
    });          

    dashboardData.avgTripsPerDay = active > 0 ? (sumTrips / active) : 0;
    updateStatsCards(); 
}

function updateStatsCards() {     
    const el = (id, val, colorVal) => { 
        const e = document.getElementById(id); 
        if (e) { 
            e.innerHTML = val; 
            if (colorVal !== undefined) e.style.color = colorVal;
        } 
    };     
    
    const cColor = dashboardData.avgConsumption < 1.80 && dashboardData.avgConsumption > 0 ? '#f87171' : '#34d399';
    
    el('avgConsumption', `${dashboardData.avgConsumption.toFixed(2)} KM/L`, cColor);     
    el('totalDistance', `${Math.round(dashboardData.totalDist).toLocaleString('pt-BR')} KM`);     
    el('totalFuel', `${Math.round(dashboardData.totalFuel).toLocaleString('pt-BR')} L`);     
    el('avgTripsPerDay', `${dashboardData.avgTripsPerDay.toFixed(1)} viag/d`); 
}

function renderTables() {     
    const dBody = document.getElementById('driversTableBody');
    if (dBody) {
        if (dashboardData.criticalDrivers.length === 0) dBody.innerHTML = '<tr><td colspan="3" class="text-center text-success">Excelente. Sem motoristas na zona vermelha.</td></tr>';
        else dBody.innerHTML = dashboardData.criticalDrivers.slice(0, 10).map(d => `<tr><td style="font-weight:600;">${d.name}</td><td class="text-danger">${d.realKML.toFixed(2)}</td><td>${Math.round(d.dist)}</td></tr>`).join('');
    }

    const aBody = document.getElementById('alertsTableBody');     
    if (aBody) {
        if (dashboardData.alerts.length === 0) aBody.innerHTML = '<tr><td colspan="3" class="text-center text-success">Nenhum alerta de frota pendente.</td></tr>'; 
        else aBody.innerHTML = dashboardData.alerts.slice(0, 10).map(a => `<tr><td style="font-weight: 600;">${a.placa}</td><td class="${parseFloat(a.trips) < 2 ? 'text-warning' : ''}">${a.trips}</td><td><span class="status-badge ${a.issue === 'Alto Consumo' ? 'danger' : 'warning'}">${a.issue}</span></td></tr>`).join(''); 
    }
}

// ==================== GRÁFICOS (DASHBOARD) ==================== 
function renderDashboardCharts(viagens) { 
    if (driverChart) driverChart.destroy();     
    const dt = dashboardData.drivers.slice(0, 10);     
    driverChart = new Chart(document.getElementById('driverConsumptionChart').getContext('2d'), { 
        type: 'bar', 
        data: { 
            labels: dt.map(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name), 
            datasets: [{ label: 'KM/L Real', data: dt.map(d => d.realKML), backgroundColor: dt.map(d => d.realKML < 1.80 ? '#ef4444' : '#10b981'), borderRadius: 6 }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(51,65,85,0.3)' } }, x: { grid: { display: false } } } } 
    }); 

    if (truckChart) truckChart.destroy();     
    const tt = dashboardData.trucks.slice(0, 10);     
    truckChart = new Chart(document.getElementById('truckConsumptionChart').getContext('2d'), { 
        type: 'bar', 
        data: { labels: tt.map(t => t.plate), datasets: [{ label: 'KM/L Real', data: tt.map(t => t.realKML), backgroundColor: tt.map(t => t.realKML < 1.80 ? '#ef4444' : '#3b82f6'), borderRadius: 6 }] }, 
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(51,65,85,0.3)' } }, x: { grid: { display: false } } } } 
    }); 

    if (timeChart) timeChart.destroy();     
    let campo = 0, fabrica = 0;         
    viagens.forEach(v => {             
        const total = (parseInterval(v.tempo_conducao) + parseInterval(v.tempo_parado));             
        const isF = (v.local_inicial || '').toLowerCase().includes('mucuri') || (v.local_final || '').toLowerCase().includes('mucuri');             
        if (isF) fabrica += total; else if (total > 0) campo += total;         
    });         
    if (campo === 0 && fabrica === 0) { campo = 1; fabrica = 1; }         
    timeChart = new Chart(document.getElementById('timeDistributionChart').getContext('2d'), { 
        type: 'doughnut', 
        data: { labels: ['Tempo Campo (Operação)', 'Tempo Fábrica (Ocioso/Fila)'], datasets: [{ data: [campo, fabrica], backgroundColor: ['#3b82f6', '#f59e0b'], borderWidth: 0, hoverOffset: 4 }] }, 
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { tooltip: { callbacks: { label: (c) => ` ${(c.raw / 3600).toFixed(1)}h (${((c.raw / (campo+fabrica)) * 100).toFixed(1)}%)` } } } } 
    });     
}

function parseInterval(i) {     
    if (!i) return 0;     
    if (typeof i === 'string') {         
        const match = i.match(/(\d+):(\d+):(\d+)/);         
        if (match) return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);         
        let sec = 0;         
        const h = i.match(/(\d+)\s*h/i); const m = i.match(/(\d+)\s*m/i); const s = i.match(/(\d+)\s*s/i);         
        if (h) sec += parseInt(h[1]) * 3600; if (m) sec += parseInt(m[1]) * 60; if (s) sec += parseInt(s[1]);         
        return sec;     
    }     
    return typeof i === 'number' ? i : 0; 
}

// ==================== EVOLUÇÃO TEMPORAL ==================== 
function renderEvolutionChartLogic(viagens, type, value) {
    const dailyMap = new Map();         
    
    viagens.forEach(v => {             
        if (!v.km_l || v.km_l <= 0 || !v.distancia_km) return;             
        const date = new Date(v.inicio);             
        const key = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;             
        if (!dailyMap.has(key)) dailyMap.set(key, { dist: 0, litros: 0, dateObj: date });             
        const m = dailyMap.get(key);             
        m.dist += parseFloat(v.distancia_km);             
        m.litros += (parseFloat(v.distancia_km) / parseFloat(v.km_l));         
    });         
    
    const sortedKeys = Array.from(dailyMap.keys()).sort((a, b) => dailyMap.get(a).dateObj - dailyMap.get(b).dateObj);         
    const values = sortedKeys.map(k => { const m = dailyMap.get(k); return m.litros > 0 ? (m.dist / m.litros).toFixed(2) : 0; });         
    
    const canvas = document.getElementById('evolutionChart');     
    if (!canvas) return;     
    if (evolutionChart) evolutionChart.destroy();     
    
    let title = 'Frota Geral (Média Ponderada)';
    if (type !== 'all' && value && value !== 'all') title = `${type === 'motorista' ? 'Motorista' : 'Equipamento'}: ${value}`;

    evolutionChart = new Chart(canvas.getContext('2d'), { 
        type: 'line', 
        data: { 
            labels: sortedKeys.length ? sortedKeys : ['Sem dados'], 
            datasets: [{ 
                label: title + ' - KM/L Real/Dia', 
                data: values.length ? values : [0], 
                borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                borderWidth: 3, fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#0f172a' 
            }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false, suggestedMin: 1.0, grid: { color: 'rgba(51,65,85,0.3)' } }, x: { grid: { display: false } } } } 
    }); 
}


// ==================== IMPORTAÇÃO E FILTRO ANTI-ERRO (NOVO) ==================== 
function initImportModule() {     
    const uploadArea = document.getElementById('uploadArea');     
    const fileInput = document.getElementById('csvFileInput');     
    const selectBtn = document.getElementById('selectFilesBtn');     
    if (!uploadArea) return;     
    uploadArea.addEventListener('click', () => fileInput?.click());     
    if (selectBtn) selectBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput?.click(); });     
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#3b82f6'; });     
    uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#475569'; });     
    uploadArea.addEventListener('drop', async (e) => { 
        e.preventDefault(); 
        uploadArea.style.borderColor = '#475569'; 
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv')); 
        if (files.length) await processFiles(files); 
    });     
    if (fileInput) fileInput.addEventListener('change', async (e) => { 
        const files = Array.from(e.target.files); 
        if (files.length) await processFiles(files); 
        fileInput.value = ''; 
    }); 
}

async function processFiles(files) {     
    if (isImporting) { showImportStatus('warning', 'Importação em andamento...'); return; }     
    isImporting = true;     
    importStats = { total: 0, inserted: 0, excluded: 0, errors: 0 };     
    clearImportLog();     
    showImportStatus('info', `Processando arquivo(s)...`);          
    
    for (const file of files) {         
        addToImportLog(`Lendo CSV: ${file.name}`, 'info');         
        const startTime = performance.now();         
        try {             
            const data = await parseCSVFast(file);             
            if (!data.length) { addToImportLog(`Nenhum dado válido.`, 'warning'); continue; }             
            
            await batchInsertSupabase(data);             
            
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);             
            addToImportLog(`${file.name} finalizado. (${elapsed}s)`, 'success');         
        } catch (error) { 
            addToImportLog(`Erro: ${error.message}`, 'error'); 
        }     
    }          
    
    isImporting = false;     
    const summary = `Feito! Lidas: ${importStats.total} | Novas: ${importStats.inserted} | Repetidas/Apoio: ${importStats.excluded}`;     
    showImportStatus('success', summary);          
    
    if (importStats.inserted > 0) {         
        addToImportLog('Atualizando dashboard...', 'info');         
        setTimeout(() => { document.getElementById('applyFilterBtn').click(); }, 1000);     
    } 
}

function parseCSVFast(file) {     
    return new Promise((resolve, reject) => {         
        const results = [];         
        Papa.parse(file, {             
            header: true, delimiter: ';', skipEmptyLines: true, encoding: "ISO-8859-1", chunkSize: 1024 * 1024,             
            step: (row) => {                 
                const mapped = mapRowFast(row.data);                 
                if (mapped === 'excluded') { importStats.excluded++; importStats.total++; } 
                else if (mapped) { results.push(mapped); importStats.total++; }             
            },             
            complete: () => resolve(results),             
            error: (error) => reject(new Error(`Leitura: ${error.message}`))         
        });     
    }); 
}

function getResilientValue(row, possibleKeys) {
    for (let k of possibleKeys) if (row[k] !== undefined && row[k] !== null) return row[k];
    const normalize = str => (!str ? '' : str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase());
    for (let k of Object.keys(row)) {
        const normKey = normalize(k);
        for (let pK of possibleKeys) if (normKey === normalize(pK)) return row[k];
    }
    return undefined;
}

function mapRowFast(row) {     
    try {         
        const placa = String(getResilientValue(row, ['Identificador/Placa', 'Placa', 'Identificador']) || '').trim().toUpperCase();         
        if (!placa) return null;
        if (PLACAS_IGNORADAS.includes(placa)) return 'excluded'; 

        const parseDate = (str) => {             
            if (!str) return null;             
            const p = str.split(' '); if (p.length !== 2) return null;             
            const d = p[0].split('/'); if (d.length !== 3) return null;             
            return `${d[2]}-${d[1]}-${d[0]} ${p[1]}`;         
        };         
        
        const parseDuration = (str) => {             
            if (!str || str === '0s') return 0;             
            let sec = 0;             
            const h = str.match(/(\d+)\s*h/i); const m = str.match(/(\d+)\s*m/i); const s = str.match(/(\d+)\s*s/i);             
            if(h) sec += parseInt(h[1])*3600; if(m) sec += parseInt(m[1])*60; if(s) sec += parseInt(s[1]);             
            return sec;         
        };         
        
        const inicio = parseDate(getResilientValue(row, ['Início', 'Inicio']));         
        const fim = parseDate(getResilientValue(row, ['Fim']));         
        if (!inicio || !fim) return null; 
        
        return {             
            placa, motorista: String(getResilientValue(row, ['Motorista', 'Operador']) || 'Indefinido').trim(),             
            inicio, fim, local_inicial: String(getResilientValue(row, ['Local inicial']) || '').trim(), local_final: String(getResilientValue(row, ['Local final']) || '').trim(),             
            distancia_km: parseFloat(String(getResilientValue(row, ['Distância (Km)']) || '0').replace(',', '.')),             
            km_l: parseFloat(String(getResilientValue(row, ['Km/l', 'KM/L']) || '0').replace(',', '.')),             
            tempo_conducao: `${parseDuration(getResilientValue(row, ['Tempo de Condução']))} seconds`,             
            tempo_parado: `${parseDuration(getResilientValue(row, ['Tempo Parado']))} seconds`         
        };     
    } catch (e) { return null; } 
}

async function batchInsertSupabase(viagens) {     
    const viagensUnicas = []; const chavesVistas = new Set();
    let minDate = viagens[0].inicio; let maxDate = viagens[0].inicio;

    for (const v of viagens) {
        const normInicio = v.inicio.replace('T', ' ').split('.')[0];
        const chave = `${v.placa}_${normInicio}`; 
        if (!chavesVistas.has(chave)) {
            chavesVistas.add(chave); viagensUnicas.push(v);
            if (normInicio < minDate) minDate = normInicio;
            if (normInicio > maxDate) maxDate = normInicio;
        } else { importStats.excluded++; }
    }

    addToImportLog(`Checando BD (evita erro 400)...`, 'info');
    const { data: dbViagens, error: dbError } = await supabaseClient
        .from('viagens').select('placa, inicio').gte('inicio', minDate).lte('inicio', maxDate).limit(100000);

    if (dbError) throw new Error('Falha ao checar duplicatas.');

    const bdSet = new Set((dbViagens || []).map(v => `${v.placa}_${v.inicio.replace('T', ' ').split('.')[0]}`));

    const viagensParaInserir = viagensUnicas.filter(v => {
        const isNew = !bdSet.has(`${v.placa}_${v.inicio.replace('T', ' ').split('.')[0]}`);
        if (!isNew) importStats.excluded++; 
        return isNew;
    });

    if (viagensParaInserir.length === 0) {
        addToImportLog(`Todas as viagens já constam no sistema.`, 'warning'); return;
    }

    addToImportLog(`Enviando ${viagensParaInserir.length} novas viagens...`, 'info');
    const batchSize = 300; 
    
    for (let i = 0; i < viagensParaInserir.length; i += batchSize) {         
        const batch = viagensParaInserir.slice(i, i + batchSize);         
        const { error } = await supabaseClient.from('viagens').insert(batch);             
        if (error) { importStats.errors += batch.length; } 
        else { importStats.inserted += batch.length; }
    }          
}

// ==================== DELETE BD ====================
function initDeleteModule() {
    const deleteBtn = document.getElementById('deleteAllBtn');
    if (!deleteBtn) return;
    deleteBtn.addEventListener('click', async () => {
        if (!confirm('ATENÇÃO: Você vai APAGAR TODAS AS VIAGENS do banco. Continuar?')) return;
        if (prompt('Digite a palavra "APAGAR" em maiúsculo:') === 'APAGAR') {
            try {
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Formatando...';
                deleteBtn.disabled = true;
                const { error } = await supabaseClient.from('viagens').delete().not('placa', 'is', null);
                if (error) throw error;
                alert('Banco limpo!'); window.location.reload();
            } catch (err) { alert('Erro: ' + err.message); window.location.reload(); }
        }
    });
}

function showImportStatus(type, msg) {     
    const el = document.getElementById('importStatus'); if (!el) return;     
    el.style.backgroundColor = type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)';     
    el.style.color = type === 'success' ? '#34d399' : '#fbbf24';     
    el.innerHTML = `<span>${msg}</span>`; el.style.display = 'block';     
}
function clearImportLog() { const el = document.getElementById('importLog'); if (el) el.innerHTML = ''; }
function addToImportLog(msg, type = 'info') {     
    const el = document.getElementById('importLog'); if (!el) return;     
    const entry = document.createElement('div');     
    entry.style.cssText = 'margin-bottom: 4px; color: #94a3b8;';     
    entry.innerHTML = `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`;     
    el.appendChild(entry); el.scrollTop = el.scrollHeight;     
}
function showEmptyDashboard() {     
    document.querySelectorAll('.stat-card p').forEach(p => p.innerHTML = '--');     
    ['alertsTableBody', 'driversTableBody'].forEach(id => {
        const e = document.getElementById(id); if (e) e.innerHTML = '<tr><td colspan="3" class="text-center">Sem dados no período.</td></tr>';
    });
}
function showDashboardError() {     
    const tbody = document.getElementById('alertsTableBody');     
    if (tbody) tbody.innerHTML = '<tr><td colspan="3">Erro de conexão.</td></tr>'; 
}