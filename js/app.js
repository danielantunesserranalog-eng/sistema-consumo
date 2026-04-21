// ==================== CONFIGURAÇÃO DO SUPABASE ==================== 
// ==================== CONFIGURAÇÃO DO SUPABASE ==================== 
const SUPABASE_URL = 'https://qhbenzrxajbeaatwxtlj.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoYmVuenJ4YWpiZWFhdHd4dGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzQ2OTksImV4cCI6MjA5MjMxMDY5OX0.2ddgnsjmxqmX9xk68m9duUmzAO2n2OAvEpOgHevRwkU';let supabaseClient = null; 
let isImporting = false; 
let importStats = { total: 0, inserted: 0, excluded: 0, errors: 0 }; 
let evolutionDataCache = new Map(); 

// Variáveis de Interface 
let driverChart = null, truckChart = null, timeChart = null, evolutionChart = null; 
let currentPage = 'dashboard'; 
let dashboardData = { avgConsumption: 0, totalDist: 0, totalFuel: 0, avgTripsPerDay: 0, drivers: [], trucks: [], alerts: [], criticalDrivers: [] }; 

// Lista Negra de Placas de Apoio
const PLACAS_IGNORADAS = ['GSR0001', 'GSR0002', 'GSR0007', 'GSR0008']; 

// ==================== INICIALIZAÇÃO ==================== 
function initSupabase() {     
    if (!supabaseClient && window.supabase) {         
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);         
        return true;     
    }     
    return !!supabaseClient; 
}

document.addEventListener('DOMContentLoaded', () => {     
    if (!initSupabase()) { console.error('Erro ao carregar Supabase'); return; }     
    initNavigation();     
    initMenuToggle();     
    initImportModule();   
    initDeleteModule(); 
    loadDashboardData(); 
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
            
            const pageNames = { 'dashboard': 'Dashboard Principal', 'consumo-evolution': 'Evolução de Desempenho', 'configuracoes': 'Painel de Gerenciamento' };             
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

// ==================== MATEMÁTICA GERENCIAL ==================== 
async function loadDashboardData() {     
    try {         
        const thirtyDaysAgo = new Date();         
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);                  
        
        const { data: viagens, error } = await supabaseClient             
            .from('viagens')             
            .select('placa, motorista, km_l, distancia_km, inicio, tempo_conducao, tempo_parado, local_inicial, local_final')             
            .gte('inicio', thirtyDaysAgo.toISOString());                  
            
        if (error) throw error;         
        if (!viagens || viagens.length === 0) { showEmptyDashboard(); return; }                  
        
        calculateMetrics(viagens);         
        renderDashboardCharts();         
        renderTables();     
    } catch (error) { 
        console.error('Erro:', error); showDashboardError(); 
    } 
}

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

            const driverName = v.motorista || 'Não informado';
            if (!driverMap.has(driverName)) driverMap.set(driverName, { dist: 0, litros: 0 });
            driverMap.get(driverName).dist += dist; 
            driverMap.get(driverName).litros += litros;

            const plate = v.placa || 'Desconhecido';
            if (!truckMap.has(plate)) truckMap.set(plate, { dist: 0, litros: 0 });
            truckMap.get(plate).dist += dist; 
            truckMap.get(plate).litros += litros;
        }
    });

    dashboardData.totalDist = globalDist;
    dashboardData.totalFuel = globalLitros;
    dashboardData.avgConsumption = globalLitros > 0 ? (globalDist / globalLitros) : 0;          
    
    dashboardData.drivers = Array.from(driverMap.entries())
        .map(([name, data]) => ({ name, dist: data.dist, realKML: data.litros > 0 ? data.dist / data.litros : 0 }))
        .sort((a, b) => b.realKML - a.realKML);
        
    // Separa os motoristas críticos (KM/L abaixo de 1.80 e que rodaram mais de 50km para evitar falsos positivos)
    dashboardData.criticalDrivers = dashboardData.drivers
        .filter(d => d.realKML > 0 && d.realKML < 1.80 && d.dist > 50)
        .sort((a, b) => a.realKML - b.realKML); // Piores primeiro

    dashboardData.trucks = Array.from(truckMap.entries())
        .map(([plate, data]) => ({ plate, realKML: data.litros > 0 ? data.dist / data.litros : 0 }))
        .sort((a, b) => b.realKML - a.realKML);
    
    const firstDate = new Date(viagens[viagens.length - 1]?.inicio);     
    const daysDiff = Math.max(1, Math.ceil((new Date() - firstDate) / (1000 * 60 * 60 * 24)));     
    
    const truckTrips = new Map();     
    viagens.forEach(v => { const plate = v.placa || 'Desconhecido'; truckTrips.set(plate, (truckTrips.get(plate) || 0) + 1); });     
    
    let sumDailyTrips = 0;
    let activeTrucks = 0;
    dashboardData.alerts = [];     
    
    dashboardData.trucks.forEach(t => { 
        const tripsCount = truckTrips.get(t.plate) || 0;
        const avgTrips = tripsCount / daysDiff;
        sumDailyTrips += avgTrips;
        activeTrucks++;

        if (t.realKML < 1.80 && t.realKML > 0) {
            dashboardData.alerts.push({ placa: t.plate, trips: avgTrips.toFixed(1), issue: 'Alto Consumo' });
        } else if (avgTrips < 2) {
            dashboardData.alerts.push({ placa: t.plate, trips: avgTrips.toFixed(1), issue: 'Baixa Rodagem' });
        }
    });          

    dashboardData.avgTripsPerDay = activeTrucks > 0 ? (sumDailyTrips / activeTrucks) : 0;
    updateStatsCards(); 
}

function updateStatsCards() {     
    const el = (id, val) => { 
        const e = document.getElementById(id); 
        if (e) { 
            e.innerHTML = val; 
            if (id === 'avgConsumption' && dashboardData.avgConsumption < 1.80 && dashboardData.avgConsumption > 0) e.style.color = '#dc2626'; 
            else if (id === 'avgConsumption') e.style.color = '#16a34a'; 
        } 
    };     
    el('avgConsumption', `${dashboardData.avgConsumption.toFixed(2)} KM/L`);     
    el('totalDistance', `${Math.round(dashboardData.totalDist).toLocaleString('pt-BR')} KM`);     
    el('totalFuel', `${Math.round(dashboardData.totalFuel).toLocaleString('pt-BR')} L`);     
    el('avgTripsPerDay', `${dashboardData.avgTripsPerDay.toFixed(1)} viagens`); 
}

function renderTables() {     
    // Tabela de Motoristas Críticos
    const dBody = document.getElementById('driversTableBody');
    if (dBody) {
        if (dashboardData.criticalDrivers.length === 0) {
            dBody.innerHTML = '<tr><td colspan="3">Nenhum motorista com consumo crítico.</td></tr>';
        } else {
            dBody.innerHTML = dashboardData.criticalDrivers.slice(0, 10).map(d => `
                <tr>
                    <td style="font-weight:600;">${d.name}</td>
                    <td class="text-danger">${d.realKML.toFixed(2)} KM/L</td>
                    <td>${Math.round(d.dist)} KM</td>
                </tr>
            `).join('');
        }
    }

    // Tabela de Alertas de Frota
    const aBody = document.getElementById('alertsTableBody');     
    if (aBody) {
        if (dashboardData.alerts.length === 0) { 
            aBody.innerHTML = '<tr><td colspan="3">Nenhum alerta de frota pendente.</td></tr>'; 
        } else {
            aBody.innerHTML = dashboardData.alerts.slice(0, 10).map(a => {
                let badgeClass = a.issue === 'Alto Consumo' ? 'danger' : 'warning';
                return `<tr>
                    <td style="font-weight: 600;">${a.placa}</td>
                    <td class="${parseFloat(a.trips) < 2 ? 'text-warning' : ''}">${a.trips}</td>
                    <td><span class="status-badge ${badgeClass}">${a.issue}</span></td>
                </tr>`;
            }).join(''); 
        }
    }
}

// ==================== GRÁFICOS (Renderização) ==================== 
function renderDashboardCharts() { 
    renderDriverChart(); 
    renderTruckChart(); 
    renderTimeDistributionChart(); 
}

function renderDriverChart() {     
    const canvas = document.getElementById('driverConsumptionChart');     
    if (!canvas || !dashboardData.drivers.length) return;     
    if (driverChart) driverChart.destroy();     
    const top = dashboardData.drivers.slice(0, 10);     
    driverChart = new Chart(canvas.getContext('2d'), { 
        type: 'bar', 
        data: { 
            labels: top.map(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name), 
            datasets: [{ 
                label: 'KM/L Real', 
                data: top.map(d => d.realKML), 
                backgroundColor: top.map(d => d.realKML < 1.80 ? '#ef4444' : '#10b981'), 
                borderRadius: 6 
            }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } 
    }); 
}

function renderTruckChart() {     
    const canvas = document.getElementById('truckConsumptionChart');     
    if (!canvas || !dashboardData.trucks.length) return;     
    if (truckChart) truckChart.destroy();     
    const top = dashboardData.trucks.slice(0, 10);     
    truckChart = new Chart(canvas.getContext('2d'), { 
        type: 'bar', 
        data: { 
            labels: top.map(t => t.plate), 
            datasets: [{ 
                label: 'KM/L Real', 
                data: top.map(t => t.realKML), 
                backgroundColor: top.map(t => t.realKML < 1.80 ? '#ef4444' : '#3b82f6'), 
                borderRadius: 6 
            }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } 
    }); 
}

async function renderTimeDistributionChart() {     
    const canvas = document.getElementById('timeDistributionChart');     
    if (!canvas) return;     
    if (timeChart) timeChart.destroy();     
    try {         
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);         
        const { data, error } = await supabaseClient.from('viagens').select('tempo_conducao, tempo_parado, local_inicial, local_final').gte('inicio', thirtyDaysAgo.toISOString());         
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
                maintainAspectRatio: false,
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
    
    const type = filterType.value; // 'motorista' ou 'caminhao'
    const column = type === 'motorista' ? 'motorista' : 'placa';

    try {         
        const { data, error } = await supabaseClient.from('viagens').select(column);         
        if (error) throw error;         
        
        // Extrai apenas os valores válidos e ordena
        const validData = data.map(d => d[column]).filter(Boolean);
        const unique = [...new Set(validData)].sort();         
        
        filterValue.innerHTML = '<option value="">Selecione...</option>' + unique.map(v => `<option value="${v.replace(/'/g, "\\'")}">${v}</option>`).join('');         
        
        const newFilter = filterValue.cloneNode(true);         
        filterValue.parentNode.replaceChild(newFilter, filterValue);         
        newFilter.addEventListener('change', () => { if (newFilter.value) loadEvolutionData(filterType.value, newFilter.value); });     
    } catch (error) { console.error('Erro:', error); } 
}

async function loadEvolutionData(type, value) {     
    if (!value) return;     
    try {         
        const column = type === 'motorista' ? 'motorista' : 'placa';
        const { data, error } = await supabaseClient.from('viagens').select('inicio, km_l, distancia_km').eq(column, value).order('inicio', { ascending: true });         
        if (error) throw error;         
        
        const monthly = new Map();         
        data.forEach(v => {             
            if (!v.km_l || v.km_l <= 0 || !v.distancia_km) return;             
            const date = new Date(v.inicio);             
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;             
            if (!monthly.has(key)) monthly.set(key, { dist: 0, litros: 0 });             
            const m = monthly.get(key);             
            m.dist += parseFloat(v.distancia_km);             
            m.litros += (parseFloat(v.distancia_km) / parseFloat(v.km_l));         
        });         
        
        const sorted = Array.from(monthly.keys()).sort();         
        const labels = sorted.map(k => { const [y, m] = k.split('-'); return `${m}/${y}`; });         
        const values = sorted.map(k => { const m = monthly.get(k); return m.litros > 0 ? (m.dist / m.litros).toFixed(2) : 0; });         
        renderEvolutionChart(labels, values, type, value);     
    } catch (error) { console.error('Erro:', error); } 
}

function renderEvolutionChart(labels, data, type, value) {     
    const canvas = document.getElementById('evolutionChart');     
    if (!canvas) return;     
    if (evolutionChart) evolutionChart.destroy();     
    const label = `${type === 'motorista' ? 'Motorista' : 'Equipamento'}: ${value}`;     
    
    evolutionChart = new Chart(canvas.getContext('2d'), { 
        type: 'line', 
        data: { 
            labels: labels.length ? labels : ['Sem dados'], 
            datasets: [{ label: label + ' (KM/L Real)', data: data.length ? data : [0], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, fill: true, tension: 0.3, pointRadius: 4 }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } 
    }); 
}

// ==================== IMPORTAÇÃO ==================== 
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
    importStats = { total: 0, inserted: 0, excluded: 0, errors: 0 };     
    clearImportLog();     
    showImportStatus('info', `Processando ${files.length} arquivo(s)...`);          
    
    for (const file of files) {         
        addToImportLog(`📦 Lendo CSV: ${file.name}`, 'info');         
        const startTime = performance.now();         
        try {             
            const data = await parseCSVFast(file);             
            if (!data.length) { addToImportLog(`❌ Nenhum dado válido encontrado.`, 'warning'); continue; }             
            
            await batchInsertSupabase(data);             
            
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);             
            addToImportLog(`✅ ${file.name} finalizado. (${elapsed}s)`, 'success');         
        } catch (error) { 
            addToImportLog(`❌ Erro no arquivo: ${error.message}`, 'error'); 
        }     
    }          
    
    isImporting = false;     
    const summary = `Concluído! Lidas: ${importStats.total} | Inseridas: ${importStats.inserted} | Placas Ignoradas: ${importStats.excluded} | Erros BD: ${importStats.errors}`;     
    showImportStatus('success', summary);          
    
    if (importStats.inserted > 0) {         
        addToImportLog('🔄 Recarregando painel gerencial...', 'info');         
        evolutionDataCache.clear();         
        setTimeout(() => loadDashboardData(), 1000);     
    } 
}

function parseCSVFast(file) {     
    return new Promise((resolve, reject) => {         
        const results = [];         
        Papa.parse(file, {             
            header: true,             
            delimiter: ';',             
            skipEmptyLines: true,   
            encoding: "ISO-8859-1",          
            chunkSize: 1024 * 1024,             
            step: (row) => {                 
                const mapped = mapRowFast(row.data);                 
                if (mapped === 'excluded') {
                    importStats.excluded++;
                    importStats.total++;
                } else if (mapped) {
                    results.push(mapped);
                    importStats.total++;
                }             
            },             
            complete: () => resolve(results),             
            error: (error) => reject(new Error(`Erro na leitura: ${error.message}`))         
        });     
    }); 
}

function getResilientValue(row, possibleKeys) {
    for (let key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null) return row[key];
    }
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
        const placaStr = getResilientValue(row, ['Identificador/Placa', 'Placa', 'Identificador', 'Veiculo']);
        const placa = String(placaStr || '').trim().toUpperCase();         
        
        if (!placa) return null;

        if (PLACAS_IGNORADAS.includes(placa)) {
            return 'excluded'; 
        }

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
        
        const inicioStr = getResilientValue(row, ['Início', 'Inicio', 'In cio']);
        const fimStr = getResilientValue(row, ['Fim']);
        const motoristaStr = getResilientValue(row, ['Motorista', 'Operador']);
        const localIniStr = getResilientValue(row, ['Local inicial', 'Local Inicial']);
        const localFimStr = getResilientValue(row, ['Local final', 'Local Final']);
        const distanciaStr = getResilientValue(row, ['Distância (Km)', 'Distancia', 'Dist ncia (Km)']);
        const kmlStr = getResilientValue(row, ['Km/l', 'KM/L', 'KML']);
        const conducaoStr = getResilientValue(row, ['Tempo de Condução', 'Tempo de Condu o']);
        const paradoStr = getResilientValue(row, ['Tempo Parado']);

        const inicio = parseDate(inicioStr);         
        const fim = parseDate(fimStr);         
        
        if (!inicio || !fim) return null; 
        
        return {             
            placa,             
            motorista: String(motoristaStr || 'Não informado').trim(),             
            inicio, 
            fim,             
            local_inicial: String(localIniStr || '').trim(),             
            local_final: String(localFimStr || '').trim(),             
            distancia_km: parseFloat(String(distanciaStr || '0').replace(',', '.')),             
            km_l: parseFloat(String(kmlStr || '0').replace(',', '.')),             
            tempo_conducao: `${parseDuration(conducaoStr)} seconds`,             
            tempo_parado: `${parseDuration(paradoStr)} seconds`         
        };     
    } catch (e) { return null; } 
}

async function batchInsertSupabase(viagens) {     
    const batchSize = 250; 
    
    for (let i = 0; i < viagens.length; i += batchSize) {         
        const batch = viagens.slice(i, i + batchSize);         
        
        // Uso de insert direto para evitar erro de onConflict inexistente
        const { error } = await supabaseClient.from('viagens').insert(batch);             
        
        if (error) {
            console.error(error);
            importStats.errors += batch.length;
        } else {
            importStats.inserted += batch.length;
        }
        
        const progress = Math.round((i + batch.length) / viagens.length * 100);         
        addToImportLog(`   Enviando p/ BD: ${progress}%...`, 'info');     
    }          
}

// ==================== DELETE BD ====================
function initDeleteModule() {
    const deleteBtn = document.getElementById('deleteAllBtn');
    if (!deleteBtn) return;

    deleteBtn.addEventListener('click', async () => {
        const confirm1 = confirm('ATENÇÃO: Você está prestes a APAGAR TODAS AS VIAGENS do banco de dados. Essa ação não tem volta. Deseja continuar?');
        if (!confirm1) return;

        const confirm2 = prompt('Digite a palavra "APAGAR" em maiúsculo para confirmar a exclusão do banco:');
        if (confirm2 === 'APAGAR') {
            try {
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Apagando BD...';
                deleteBtn.disabled = true;

                const { error } = await supabaseClient
                    .from('viagens')
                    .delete()
                    .not('placa', 'is', null);

                if (error) throw error;

                alert('Banco de dados limpo com sucesso! A página será recarregada.');
                window.location.reload();

            } catch (err) {
                alert('Erro ao apagar banco de dados: ' + err.message);
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Limpar Banco de Dados';
                deleteBtn.disabled = false;
            }
        } else if (confirm2 !== null) {
            alert('Palavra incorreta. O banco de dados foi preservado.');
        }
    });
}

function showImportStatus(type, message) {     
    const statusDiv = document.getElementById('importStatus');     
    if (!statusDiv) return;     
    const colors = { success: '#dcfce7', error: '#fee2e2', warning: '#fef3c7', info: '#e0f2fe' };     
    const textColors = { success: '#166534', error: '#991b1b', warning: '#92400e', info: '#075985' };     
    statusDiv.style.backgroundColor = colors[type];     
    statusDiv.style.color = textColors[type];     
    statusDiv.innerHTML = `<span style="font-weight:600;">${message}</span>`;     
    statusDiv.style.display = 'block';     
}

function clearImportLog() { 
    const logDiv = document.getElementById('importLog'); 
    if (logDiv) logDiv.innerHTML = ''; 
}

function addToImportLog(message, type = 'info') {     
    const logDiv = document.getElementById('importLog');     
    if (!logDiv) return;     
    const timestamp = new Date().toLocaleTimeString('pt-BR');     
    const colors = { success: '#a5f3fc', error: '#fecaca', warning: '#fde68a', info: '#e2e8f0' };     
    const entry = document.createElement('div');     
    entry.style.cssText = 'margin-bottom: 4px; font-family: monospace; font-size: 0.8rem;';     
    entry.style.color = colors[type];     
    entry.innerHTML = `<span style="color: #64748b;">[${timestamp}]</span> ${message}`;     
    logDiv.appendChild(entry);     
    logDiv.scrollTop = logDiv.scrollHeight;     
}

function showEmptyDashboard() {     
    document.querySelectorAll('.stat-card p').forEach(p => p.innerHTML = '--');     
    const tbody = document.getElementById('alertsTableBody');     
    if (tbody) tbody.innerHTML = '<tr><td colspan="3">O banco de dados está limpo.</td></tr>'; 
    const dbody = document.getElementById('driversTableBody');
    if (dbody) dbody.innerHTML = '<tr><td colspan="3">O banco de dados está limpo.</td></tr>'; 
}

function showDashboardError() {     
    const tbody = document.getElementById('alertsTableBody');     
    if (tbody) tbody.innerHTML = '<tr><td colspan="3">Erro de conexão com a nuvem.</td></tr>'; 
}