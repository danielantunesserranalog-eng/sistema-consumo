// ==================== CONFIGURAÇÃO DO SUPABASE ==================== 
const SUPABASE_URL = 'https://elvbhhkxfqzfvigwcjno.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoYmVuenJ4YWpiZWFhdHd4dGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzQ2OTksImV4cCI6MjA5MjMxMDY5OX0.2ddgnsjmxqmX9xk68m9duUmzAO2n2OAvEpOgHevRwkU'; 
let supabaseClient = null; 
let isImporting = false; 
let importStats = { total: 0, inserted: 0, updated: 0, errors: 0 }; 
let evolutionDataCache = new Map(); 

// Variáveis para os gráficos 
let driverChart = null, truckChart = null, timeChart = null, evolutionChart = null; 
let currentPage = 'dashboard'; 
let dashboardData = { avgConsumption: 0, avgDriverConsumption: 0, avgTruckConsumption: 0, avgTripsPerDay: 0, drivers: [], trucks: [], alerts: [] }; 

// ==================== INICIALIZAÇÃO ==================== 
function initSupabase() {     
    if (!supabaseClient && window.supabase) {         
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);         
        console.log('✅ Supabase inicializado');         
        return true;     
    }     
    return !!supabaseClient; 
}

document.addEventListener('DOMContentLoaded', () => {     
    console.log('SISTEMA_CONSUMO inicializado');     
    if (!initSupabase()) { 
        console.error('Erro ao carregar Supabase'); 
        return; 
    }     
    initNavigation();     
    initMenuToggle();     
    initImportModule();     
    loadDashboardData(); 
});

// ==================== NAVEGAÇÃO ==================== 
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
            
            const pageNames = { 'dashboard': 'Dashboard Principal', 'consumo-evolution': 'Evolução de Consumo', 'configuracoes': 'Configurações' };             
            if (pageTitle) pageTitle.textContent = pageNames[pageId] || 'SISTEMA_CONSUMO';             
            currentPage = pageId;             
            if (pageId === 'consumo-evolution') loadEvolutionSelects();         
        });     
    }); 
}

function initMenuToggle() {     
    const menuToggle = document.getElementById('menuToggle');     
    const sidebar = document.getElementById('sidebar');     
    if (menuToggle && sidebar) menuToggle.addEventListener('click', () => sidebar.classList.toggle('open')); 
}

// ==================== DASHBOARD ==================== 
async function loadDashboardData() {     
    console.log('Loading dashboard...');     
    try {         
        const thirtyDaysAgo = new Date();         
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);                  
        const { data: viagens, error } = await supabaseClient             
            .from('viagens')             
            .select('placa, motorista, km_l, inicio, tempo_conducao, tempo_parado, local_inicial, local_final')             
            .gte('inicio', thirtyDaysAgo.toISOString())             
            .limit(5000);                  
            
        if (error) throw error;         
        if (!viagens || viagens.length === 0) { showEmptyDashboard(); return; }                  
        
        calculateMetrics(viagens);         
        renderDashboardCharts();         
        renderAlertsTable();     
    } catch (error) { 
        console.error('Erro:', error); showDashboardError(); 
    } 
}

function calculateMetrics(viagens) {     
    const valid = viagens.filter(v => v.km_l && v.km_l > 0);     
    dashboardData.avgConsumption = valid.length ? valid.reduce((s, v) => s + v.km_l, 0) / valid.length : 0;          
    
    const driverMap = new Map();     
    valid.forEach(v => {         
        const name = v.motorista || 'Não informado';         
        if (!driverMap.has(name)) driverMap.set(name, { sum: 0, count: 0 });         
        const d = driverMap.get(name);         
        d.sum += v.km_l;         
        d.count++;     
    });     
    dashboardData.drivers = Array.from(driverMap.entries()).map(([name, data]) => ({ name, avgConsumption: data.sum / data.count })).sort((a, b) => b.avgConsumption - a.avgConsumption);     
    dashboardData.avgDriverConsumption = dashboardData.drivers.length ? dashboardData.drivers.reduce((s, d) => s + d.avgConsumption, 0) / dashboardData.drivers.length : 0;          
    
    const truckMap = new Map();     
    valid.forEach(v => {         
        const plate = v.placa || 'Desconhecido';         
        if (!truckMap.has(plate)) truckMap.set(plate, { sum: 0, count: 0 });         
        const t = truckMap.get(plate);         
        t.sum += v.km_l;         
        t.count++;     
    });     
    dashboardData.trucks = Array.from(truckMap.entries()).map(([plate, data]) => ({ plate, avgConsumption: data.sum / data.count })).sort((a, b) => b.avgConsumption - a.avgConsumption);     
    dashboardData.avgTruckConsumption = dashboardData.trucks.length ? dashboardData.trucks.reduce((s, t) => s + t.avgConsumption, 0) / dashboardData.trucks.length : 0;          
    
    const firstDate = new Date(viagens[viagens.length - 1]?.inicio);     
    const daysDiff = Math.max(1, Math.ceil((new Date() - firstDate) / (1000 * 60 * 60 * 24)));     
    dashboardData.avgTripsPerDay = viagens.length / daysDiff;          
    dashboardData.alerts = [];     
    
    dashboardData.trucks.forEach(t => { 
        if (t.avgConsumption < 1.80 && t.avgConsumption > 0) dashboardData.alerts.push({ type: 'consumption', placa: t.plate, value: t.avgConsumption.toFixed(2) }); 
    });          
    
    const truckTrips = new Map();     
    viagens.forEach(v => { const plate = v.placa || 'Desconhecido'; truckTrips.set(plate, (truckTrips.get(plate) || 0) + 1); });     
    for (const [plate, count] of truckTrips) { 
        const avg = count / daysDiff; 
        if (avg < 2) dashboardData.alerts.push({ type: 'productivity', placa: plate, value: avg.toFixed(1) }); 
    }          
    updateStatsCards(); 
}

function updateStatsCards() {     
    const el = (id, val) => { 
        const e = document.getElementById(id); 
        if (e) { 
            e.innerHTML = val; 
            if (id === 'avgConsumption' && dashboardData.avgConsumption < 1.80 && dashboardData.avgConsumption > 0) e.style.color = '#dc2626'; 
            else e.style.color = '#1e293b'; 
        } 
    };     
    el('avgConsumption', `${dashboardData.avgConsumption.toFixed(2)} KM/L`);     
    el('avgDriverConsumption', `${dashboardData.avgDriverConsumption.toFixed(2)} KM/L`);     
    el('avgTruckConsumption', `${dashboardData.avgTruckConsumption.toFixed(2)} KM/L`);     
    el('avgTripsPerDay', `${dashboardData.avgTripsPerDay.toFixed(1)} viagens`); 
}

function renderAlertsTable() {     
    const tbody = document.getElementById('alertsTableBody');     
    if (!tbody) return;     
    if (dashboardData.alerts.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="5">Nenhum alerta. Parabéns!</td></tr>'; 
        return; 
    }     
    tbody.innerHTML = dashboardData.alerts.slice(0, 20).map(a => `<tr><td>${a.placa}</td><td>--</td><td class="${a.type === 'consumption' ? 'text-danger' : ''}">${a.type === 'consumption' ? a.value + ' KM/L' : '--'}</td><td class="${a.type === 'productivity' ? 'text-warning' : ''}">${a.type === 'productivity' ? a.value + ' viagens/24h' : '--'}</td><td><span class="status-badge warning">${a.type === 'consumption' ? 'Consumo Baixo' : 'Baixa Produtividade'}</span></td></tr>`).join(''); 
}

// ==================== GRÁFICOS ==================== 
function renderDashboardCharts() { 
    renderDriverChart(); 
    renderTruckChart(); 
    renderTimeDistributionChart(); 
}

function renderDriverChart() {     
    const canvas = document.getElementById('driverConsumptionChart');     
    if (!canvas || !dashboardData.drivers.length) return;     
    if (driverChart) driverChart.destroy();     
    const topDrivers = dashboardData.drivers.slice(0, 8);     
    driverChart = new Chart(canvas.getContext('2d'), { 
        type: 'bar', 
        data: { 
            labels: topDrivers.map(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name), 
            datasets: [{ 
                label: 'KM/L', 
                data: topDrivers.map(d => d.avgConsumption), 
                backgroundColor: topDrivers.map(d => d.avgConsumption < 1.80 ? '#ef4444' : '#3b82f6'), 
                borderRadius: 8 
            }] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: true, 
            scales: { y: { beginAtZero: true, title: { display: true, text: 'KM/L' } } } 
        } 
    }); 
}

function renderTruckChart() {     
    const canvas = document.getElementById('truckConsumptionChart');     
    if (!canvas || !dashboardData.trucks.length) return;     
    if (truckChart) truckChart.destroy();     
    const topTrucks = dashboardData.trucks.slice(0, 8);     
    truckChart = new Chart(canvas.getContext('2d'), { 
        type: 'bar', 
        data: { 
            labels: topTrucks.map(t => t.plate), 
            datasets: [{ 
                label: 'KM/L', 
                data: topTrucks.map(t => t.avgConsumption), 
                backgroundColor: topTrucks.map(t => t.avgConsumption < 1.80 ? '#ef4444' : '#3b82f6'), 
                borderRadius: 8 
            }] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: true, 
            scales: { y: { beginAtZero: true, title: { display: true, text: 'KM/L' } } } 
        } 
    }); 
}

async function renderTimeDistributionChart() {     
    const canvas = document.getElementById('timeDistributionChart');     
    if (!canvas) return;     
    if (timeChart) timeChart.destroy();     
    try {         
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);         
        const { data, error } = await supabaseClient.from('viagens').select('tempo_conducao, tempo_parado, local_inicial, local_final').gte('inicio', thirtyDaysAgo.toISOString()).limit(5000);         
        if (error) throw error;         
        
        let campo = 0, fabrica = 0;         
        (data || []).forEach(v => {             
            const total = (parseInterval(v.tempo_conducao) + parseInterval(v.tempo_parado));             
            const isFabrica = (v.local_inicial || '').toLowerCase().includes('mucuri') || (v.local_final || '').toLowerCase().includes('mucuri');             
            if (isFabrica) fabrica += total;             
            else if (total > 0) campo += total;         
        });         
        if (campo === 0 && fabrica === 0) { campo = 3600; fabrica = 3600; }         
        
        timeChart = new Chart(canvas.getContext('2d'), { 
            type: 'doughnut', 
            data: { 
                labels: ['Tempo de Campo', 'Tempo de Fábrica'], 
                datasets: [{ data: [campo, fabrica], backgroundColor: ['#3b82f6', '#10b981'], borderWidth: 0 }] 
            }, 
            options: { 
                responsive: true, 
                plugins: { 
                    tooltip: { 
                        callbacks: { 
                            label: (ctx) => { 
                                const total = campo + fabrica; 
                                const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0; 
                                return `${ctx.label}: ${(ctx.raw / 3600).toFixed(1)}h (${pct}%)`; 
                            } 
                        } 
                    } 
                } 
            } 
        });     
    } catch (error) { console.error('Erro:', error); } 
}

function parseInterval(interval) {     
    if (!interval) return 0;     
    if (typeof interval === 'string') {         
        const match = interval.match(/(\d+):(\d+):(\d+)/);         
        if (match) return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);         
        let sec = 0;         
        const h = interval.match(/(\d+)\s*hours?/);         
        const m = interval.match(/(\d+)\s*minutes?/);         
        const s = interval.match(/(\d+)\s*seconds?/);         
        if (h) sec += parseInt(h[1]) * 3600;         
        if (m) sec += parseInt(m[1]) * 60;         
        if (s) sec += parseInt(s[1]);         
        return sec;     
    }     
    return typeof interval === 'number' ? interval : 0; 
}

// ==================== EVOLUÇÃO ==================== 
async function loadEvolutionSelects() {     
    const filterType = document.getElementById('filterType');     
    const filterValue = document.getElementById('filterValue');     
    if (!filterType || !filterValue) return;     
    const type = filterType.value;     
    try {         
        const { data, error } = await supabaseClient.from('viagens').select(type === 'motorista' ? 'motorista' : 'placa').limit(2000);         
        if (error) throw error;         
        const unique = [...new Set(data.map(d => d[type === 'motorista' ? 'motorista' : 'placa']).filter(Boolean))];         
        filterValue.innerHTML = '<option value="">Selecione...</option>' + unique.slice(0, 100).map(v => `<option value="${v.replace(/'/g, "\\'")}">${v}</option>`).join('');         
        const newFilter = filterValue.cloneNode(true);         
        filterValue.parentNode.replaceChild(newFilter, filterValue);         
        newFilter.addEventListener('change', () => { if (newFilter.value) loadEvolutionData(filterType.value, newFilter.value); });     
    } catch (error) { console.error('Erro:', error); } 
}

async function loadEvolutionData(type, value) {     
    if (!value) return;     
    const cacheKey = `${type}_${value}`;     
    if (evolutionDataCache.has(cacheKey)) { 
        const c = evolutionDataCache.get(cacheKey); 
        renderEvolutionChart(c.labels, c.data, type, value); return; 
    }     
    try {         
        const { data, error } = await supabaseClient.from('viagens').select('inicio, km_l').eq(type === 'motorista' ? 'motorista' : 'placa', value).order('inicio', { ascending: true }).limit(1000);         
        if (error) throw error;         
        const monthly = new Map();         
        data.forEach(v => {             
            if (!v.km_l || v.km_l <= 0) return;             
            const date = new Date(v.inicio);             
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;             
            if (!monthly.has(key)) monthly.set(key, { sum: 0, count: 0 });             
            const m = monthly.get(key);             
            m.sum += v.km_l;             
            m.count++;         
        });         
        const sorted = Array.from(monthly.keys()).sort();         
        const labels = sorted.map(k => { const [y, m] = k.split('-'); return `${m}/${y}`; });         
        const values = sorted.map(k => monthly.get(k).sum / monthly.get(k).count);         
        evolutionDataCache.set(cacheKey, { labels, data: values });         
        renderEvolutionChart(labels, values, type, value);     
    } catch (error) { console.error('Erro:', error); } 
}

function renderEvolutionChart(labels, data, type, value) {     
    const canvas = document.getElementById('evolutionChart');     
    if (!canvas) return;     
    if (evolutionChart) evolutionChart.destroy();     
    const label = `${type === 'motorista' ? 'Motorista' : 'Caminhão'}: ${value}`;     
    if (!labels.length) { 
        evolutionChart = new Chart(canvas.getContext('2d'), { 
            type: 'line', data: { labels: ['Sem dados'], datasets: [{ label, data: [0], borderColor: '#94a3b8' }] } 
        }); return; 
    }     
    evolutionChart = new Chart(canvas.getContext('2d'), { 
        type: 'line', 
        data: { 
            labels, 
            datasets: [{ label, data, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, fill: true, tension: 0.3, pointRadius: 4 }] 
        }, 
        options: { responsive: true, scales: { y: { beginAtZero: true, title: { display: true, text: 'KM/L' } } } } 
    }); 
}

// ==================== IMPORTAÇÃO OTIMIZADA ==================== 
function initImportModule() {     
    const uploadArea = document.getElementById('uploadArea');     
    const fileInput = document.getElementById('csvFileInput');     
    const selectBtn = document.getElementById('selectFilesBtn');     
    if (!uploadArea) return;     
    uploadArea.addEventListener('click', () => fileInput?.click());     
    if (selectBtn) selectBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput?.click(); });     
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#3b82f6'; });     
    uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#cbd5e1'; });     
    uploadArea.addEventListener('drop', async (e) => { 
        e.preventDefault(); 
        uploadArea.style.borderColor = '#cbd5e1'; 
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv')); 
        if (files.length) await processFiles(files); 
        else showImportStatus('error', 'Envie apenas arquivos CSV.'); 
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
    importStats = { total: 0, inserted: 0, updated: 0, errors: 0 };     
    clearImportLog();     
    showImportStatus('info', `Processando ${files.length} arquivo(s)...`);          
    
    for (const file of files) {         
        addToImportLog(`📦 Processando: ${file.name}`, 'info');         
        const startTime = performance.now();         
        try {             
            const data = await parseCSVFast(file);             
            if (!data.length) { addToImportLog(`❌ Nenhum dado válido encontrado. Verifique as colunas.`, 'warning'); continue; }             
            importStats.total += data.length;             
            const { inserted, updated, errors } = await batchInsertSupabase(data);             
            importStats.inserted += inserted;             
            importStats.updated += updated;             
            importStats.errors += errors;             
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);             
            addToImportLog(`✅ ${file.name}: ${inserted} novas, ${updated} atualizadas, ${errors} erros (${elapsed}s)`, 'success');         
        } catch (error) { 
            addToImportLog(`❌ Erro: ${error.message}`, 'error'); importStats.errors++; 
        }     
    }          
    
    isImporting = false;     
    const summary = `Concluído! Total: ${importStats.total} | Inseridas: ${importStats.inserted} | Atualizadas: ${importStats.updated} | Erros: ${importStats.errors}`;     
    showImportStatus(importStats.errors === 0 ? 'success' : 'warning', summary);          
    
    if (importStats.inserted > 0 || importStats.updated > 0) {         
        addToImportLog('🔄 Recarregando dashboard...', 'info');         
        evolutionDataCache.clear();         
        setTimeout(() => loadDashboardData(), 500);     
    } 
}

function parseCSVFast(file) {     
    return new Promise((resolve, reject) => {         
        const results = [];         
        Papa.parse(file, {             
            header: true,             
            delimiter: ';',             
            skipEmptyLines: true,   
            // Dependendo do sistema, o CSV vem em ISO-8859-1. Caso não funcione, altere para "UTF-8"
            encoding: "ISO-8859-1",          
            chunkSize: 1024 * 1024,             
            step: (row) => {                 
                const mapped = mapRowFast(row.data);                 
                if (mapped) results.push(mapped);             
            },             
            complete: () => resolve(results),             
            error: (error) => reject(new Error(`Erro na leitura: ${error.message}`))         
        });     
    }); 
}

// === LÓGICA BLINDADA PARA LER COLUNAS DO CSV ===
function getResilientValue(row, possibleKeys) {
    // Tenta encontrar a chave exata primeiro
    for (let key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null) return row[key];
    }
    
    // Se não achar, procura normalizando os textos (remover acentos e caracteres estranhos)
    const normalize = str => {
        if (!str) return '';
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    };
    
    const rowKeys = Object.keys(row);
    for (let key of rowKeys) {
        const normKey = normalize(key);
        for (let pKey of possibleKeys) {
            if (normKey === normalize(pKey)) return row[key];
        }
    }
    return undefined;
}

function mapRowFast(row) {     
    try {         
        const parseDate = (str) => {             
            if (!str) return null;             
            const parts = str.split(' ');             
            if (parts.length !== 2) return null;             
            const d = parts[0].split('/');             
            if (d.length !== 3) return null;             
            return `${d[2]}-${d[1]}-${d[0]} ${parts[1]}`;         
        };         
        
        const parseDuration = (str) => {             
            if (!str || str === '0s') return 0;             
            let sec = 0;             
            const h = str.match(/(\d+)\s*h/i);             
            const m = str.match(/(\d+)\s*m/i);             
            const s = str.match(/(\d+)\s*s/i);             
            if (h) sec += parseInt(h[1]) * 3600;             
            if (m) sec += parseInt(m[1]) * 60;             
            if (s) sec += parseInt(s[1]);             
            return sec;         
        };         
        
        // Busca resiliente pelas colunas para evitar o problema dos acentos quebrados
        const inicioStr = getResilientValue(row, ['Início', 'Inicio', 'In cio']);
        const fimStr = getResilientValue(row, ['Fim']);
        const placaStr = getResilientValue(row, ['Identificador/Placa', 'Placa', 'Identificador', 'Veiculo']);
        const motoristaStr = getResilientValue(row, ['Motorista', 'Operador']);
        const localIniStr = getResilientValue(row, ['Local inicial', 'Local Inicial']);
        const localFimStr = getResilientValue(row, ['Local final', 'Local Final']);
        const distanciaStr = getResilientValue(row, ['Distância (Km)', 'Distancia', 'Dist ncia (Km)']);
        const kmlStr = getResilientValue(row, ['Km/l', 'KM/L', 'KML']);
        const conducaoStr = getResilientValue(row, ['Tempo de Condução', 'Tempo de Condu o']);
        const paradoStr = getResilientValue(row, ['Tempo Parado']);

        const inicio = parseDate(inicioStr);         
        const fim = parseDate(fimStr);         
        const placa = placaStr || '';         
        
        if (!inicio || !fim || !placa) return null; // Se não encontrou o principal, descarta a linha
        
        return {             
            placa: String(placa).trim(),             
            motorista: String(motoristaStr || 'Não informado').trim(),             
            inicio, 
            fim,             
            local_inicial: String(localIniStr || '').trim(),             
            local_final: String(localFimStr || '').trim(),             
            distancia_km: parseFloat(String(distanciaStr || '0').replace(',', '.')),             
            km_l: parseFloat(String(kmlStr || '0').replace(',', '.')),             
            tempo_conducao_seconds: parseDuration(conducaoStr),             
            tempo_parado_seconds: parseDuration(paradoStr)         
        };     
    } catch (e) { return null; } 
}

async function batchInsertSupabase(viagens, batchSize = 500) {     
    let inserted = 0, updated = 0, errors = 0;          
    for (let i = 0; i < viagens.length; i += batchSize) {         
        const batch = viagens.slice(i, i + batchSize);         
        const toInsert = [];         
        const toUpdate = [];                  
        
        // Verifica duplicatas em lote         
        const keys = batch.map(v => `(${v.placa},${v.inicio},${v.fim})`);         
        const { data: existing } = await supabaseClient             
            .from('viagens')             
            .select('id, placa, inicio, fim')             
            .or(keys.map(k => `and(placa.eq.${k.split(',')[0].substring(1)},inicio.eq.${k.split(',')[1]},fim.eq.${k.split(',')[2].substring(0, k.split(',')[2].length - 1)})`).join(','));                  
            
        const existingMap = new Map();         
        (existing || []).forEach(e => existingMap.set(`${e.placa}|${e.inicio}|${e.fim}`, e.id));                  
        
        for (const v of batch) {             
            const key = `${v.placa}|${v.inicio}|${v.fim}`;             
            const record = {                 
                placa: v.placa, motorista: v.motorista, inicio: v.inicio, fim: v.fim,                 
                local_inicial: v.local_inicial, local_final: v.local_final,                 
                distancia_km: v.distancia_km, km_l: v.km_l,                 
                tempo_conducao: `${v.tempo_conducao_seconds} seconds`,                 
                tempo_parado: `${v.tempo_parado_seconds} seconds`,                 
                updated_at: new Date().toISOString()             
            };             
            if (existingMap.has(key)) {                 
                toUpdate.push({ id: existingMap.get(key), ...record });             
            } else {                 
                record.created_at = new Date().toISOString();                 
                toInsert.push(record);             
            }         
        }                  
        
        // Executa inserções e atualizações         
        if (toInsert.length) {             
            const { error } = await supabaseClient.from('viagens').insert(toInsert);             
            if (error) errors += toInsert.length;             
            else inserted += toInsert.length;         
        }                  
        
        if (toUpdate.length) {             
            for (const item of toUpdate) {                 
                const { id, ...updateData } = item;                 
                const { error } = await supabaseClient.from('viagens').update(updateData).eq('id', id);                 
                if (error) errors++;                 
                else updated++;             
            }         
        }                  
        
        const progress = Math.round((i + batch.length) / viagens.length * 100);         
        addToImportLog(`   Progresso: ${progress}% (${inserted} inseridas, ${updated} atualizadas)`, 'info');     
    }          
    return { inserted, updated, errors }; 
}

function showImportStatus(type, message) {     
    const statusDiv = document.getElementById('importStatus');     
    if (!statusDiv) return;     
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };     
    const colors = { success: '#dcfce7', error: '#fee2e2', warning: '#fef3c7', info: '#e0f2fe' };     
    const textColors = { success: '#166534', error: '#991b1b', warning: '#92400e', info: '#075985' };     
    statusDiv.className = `import-status ${type}`;     
    statusDiv.style.backgroundColor = colors[type];     
    statusDiv.style.color = textColors[type];     
    statusDiv.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;     
    statusDiv.style.display = 'block';     
    if (type === 'success') setTimeout(() => { if (statusDiv) statusDiv.style.display = 'none'; }, 5000); 
}

function clearImportLog() { 
    const logDiv = document.getElementById('importLog'); 
    if (logDiv) logDiv.innerHTML = ''; 
}

function addToImportLog(message, type = 'info') {     
    const logDiv = document.getElementById('importLog');     
    if (!logDiv) return;     
    const timestamp = new Date().toLocaleTimeString('pt-BR');     
    const icons = { success: '🟢', error: '🔴', warning: '🟡', info: '🔵' };     
    const colors = { success: '#a5f3fc', error: '#fecaca', warning: '#fde68a', info: '#a5f3fc' };     
    const entry = document.createElement('div');     
    entry.style.cssText = 'margin-bottom: 8px; font-family: monospace; font-size: 0.8rem;';     
    entry.style.color = colors[type];     
    entry.innerHTML = `<span style="color: #64748b;">[${timestamp}]</span> ${icons[type]} ${message}`;     
    logDiv.appendChild(entry);     
    logDiv.scrollTop = logDiv.scrollHeight;     
    while (logDiv.children.length > 200) logDiv.removeChild(logDiv.firstChild); 
}

function showEmptyDashboard() {     
    document.querySelectorAll('.stat-card p').forEach(p => p.innerHTML = '--');     
    const tbody = document.getElementById('alertsTableBody');     
    if (tbody) tbody.innerHTML = '<tr><td colspan="5">Nenhum dado. Importe o CSV na aba de Configurações.</td></tr>'; 
}

function showDashboardError() {     
    const tbody = document.getElementById('alertsTableBody');     
    if (tbody) tbody.innerHTML = '<tr><td colspan="5">Erro ao carregar dados. Verifique a conexão com o Supabase.</td></tr>'; 
}