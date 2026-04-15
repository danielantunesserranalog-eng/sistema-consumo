// app.js - Lógica completa do sistema com tratamento de erros

// ==================== VARIÁVEIS GLOBAIS ====================
let currentChartRanking = null;
let currentChartScatter = null;
let allTrips = [];

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    const isConnected = await SupabaseManager.testConnection();
    updateConnectionStatus(isConnected);
    
    if (isConnected) {
        await loadDashboardData();
    } else {
        showConnectionError();
    }
}

function updateConnectionStatus(isConnected) {
    const statusDiv = document.getElementById('dbStatus');
    if (statusDiv) {
        if (isConnected) {
            statusDiv.innerHTML = '<i class="fas fa-check-circle"></i><span>Conectado</span>';
            statusDiv.style.background = '#0f2c38';
        } else {
            statusDiv.innerHTML = '<i class="fas fa-times-circle"></i><span>Erro conexão</span>';
            statusDiv.style.background = '#4a1a1a';
        }
    }
}

function showConnectionError() {
    const tableBody = document.getElementById('tableBody');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#dc2626;">❌ Erro de conexão com o banco de dados. Verifique suas credenciais.</td></tr>';
    }
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.dataset.tab;
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
            if (tab === 'dashboard') {
                document.getElementById('dashboardView').classList.add('active');
                loadDashboardData();
            } else {
                document.getElementById('configView').classList.add('active');
            }
        });
    });
    
    const refreshBtn = document.getElementById('refreshDashboardBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadDashboardData());
    }
    
    const fileInput = document.getElementById('fileInput');
    const selectBtn = document.getElementById('selectFileBtn');
    const uploadArea = document.getElementById('uploadArea');
    
    if (selectBtn) {
        selectBtn.addEventListener('click', () => fileInput.click());
    }
    if (uploadArea) {
        uploadArea.addEventListener('click', () => fileInput.click());
    }
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }
    
    const clearBtn = document.getElementById('clearAllDataBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (confirm('⚠️ Isso apagará TODOS os registros. Tem certeza?')) {
                const result = await SupabaseManager.deleteAllTrips();
                if (result.success) {
                    alert('Todos os dados foram removidos!');
                    await loadDashboardData();
                } else {
                    alert('Erro ao limpar dados: ' + result.error);
                }
            }
        });
    }
    
    const searchInput = document.getElementById('searchDriver');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderDriversTable(allTrips, e.target.value);
        });
    }
}

// ==================== FUNÇÕES DE IMPORTAÇÃO ====================
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const progressDiv = document.getElementById('importProgress');
    const resultDiv = document.getElementById('importResult');
    if (progressDiv) progressDiv.style.display = 'block';
    if (resultDiv) resultDiv.innerHTML = '';
    
    try {
        const data = await readExcelFile(file);
        const mappedTrips = mapExcelToTrips(data);
        
        if (mappedTrips.length === 0) {
            throw new Error('Nenhuma linha válida encontrada no arquivo');
        }
        
        const progressBar = document.querySelector('#importProgress .progress-bar');
        if (progressBar) progressBar.style.width = '50%';
        const progressMsg = document.getElementById('progressMsg');
        if (progressMsg) progressMsg.innerText = 'Verificando duplicatas...';
        
        const result = await SupabaseManager.insertNewTrips(mappedTrips);
        
        if (result.success && resultDiv) {
            resultDiv.innerHTML = `<div style="background: #dcfce7; padding: 12px; border-radius: 12px; color: #166534;">
                ✅ Importação concluída! ${result.inserted} novos registros adicionados.
            </div>`;
            await loadDashboardData();
        } else if (resultDiv) {
            throw new Error(result.error || 'Erro ao inserir dados');
        }
        
    } catch (err) {
        const resultDiv = document.getElementById('importResult');
        if (resultDiv) {
            resultDiv.innerHTML = `<div style="background: #fee2e2; padding: 12px; border-radius: 12px; color: #991b1b;">
                ❌ Erro: ${err.message}
            </div>`;
        }
        console.error(err);
    } finally {
        if (progressDiv) progressDiv.style.display = 'none';
        if (event.target) event.target.value = '';
        const progressBar = document.querySelector('#importProgress .progress-bar');
        if (progressBar) progressBar.style.width = '0%';
    }
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet);
            resolve(rows);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function mapExcelToTrips(rows) {
    const allowedColumns = [
        'Identificador/Placa', 'Início', 'Fim', 'Tempo de Motor Ligado', 'Distância (Km)',
        'Vel. Max (Seca)', 'Vel. Max (Molhada)', 'Velocidade Média', 'Km/l', 'Total Litros Consumido',
        'Tempo de Condução (%)', 'Tempo Parado (%)', 'Tempo de Condução', 'Tempo Parado',
        'Odômetro Inicial', 'Odômetro Final', 'Motorista', 'CPF', 'Qtde. de acionamento do pedal de freio',
        'Distância com o pedal de freio pressionado'
    ];
    
    return rows.map(row => {
        let newRow = {};
        allowedColumns.forEach(col => {
            let value = row[col] !== undefined ? row[col] : null;
            if (typeof value === 'string') value = value.trim();
            newRow[normalizeColumnName(col)] = value;
        });
        return newRow;
    }).filter(trip => trip.placa && trip.motorista);
}

function normalizeColumnName(colName) {
    const map = {
        'Identificador/Placa': 'placa',
        'Início': 'inicio',
        'Fim': 'fim',
        'Tempo de Motor Ligado': 'tempo_motor_ligado',
        'Distância (Km)': 'distancia_km',
        'Vel. Max (Seca)': 'vel_max_seca',
        'Vel. Max (Molhada)': 'vel_max_molhada',
        'Velocidade Média': 'velocidade_media',
        'Km/l': 'km_l',
        'Total Litros Consumido': 'total_litros',
        'Tempo de Condução (%)': 'tempo_conducao_percent',
        'Tempo Parado (%)': 'tempo_parado_percent',
        'Tempo de Condução': 'tempo_conducao',
        'Tempo Parado': 'tempo_parado',
        'Odômetro Inicial': 'odometro_inicial',
        'Odômetro Final': 'odometro_final',
        'Motorista': 'motorista',
        'CPF': 'cpf',
        'Qtde. de acionamento do pedal de freio': 'freio_acionamentos',
        'Distância com o pedal de freio pressionado': 'dist_freio_pressionado'
    };
    return map[colName] || colName.replace(/\s+/g, '_').toLowerCase();
}

// ==================== FUNÇÕES AUXILIARES PARA VALIDAÇÃO ====================
function parseFloatSafe(value, defaultValue = 0) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

// ==================== CÁLCULO CORRETO DE MÉDIAS ====================

/**
 * Calcula a média de Km/l de forma correta: Distância Total / Total de Litros
 * @param {Array} trips - Lista de viagens
 * @returns {number} - Média de Km/l
 */
function calculateAverageKmpl(trips) {
    let totalDistance = 0;
    let totalFuel = 0;
    
    trips.forEach(trip => {
        totalDistance += parseFloatSafe(trip.distancia_km);
        totalFuel += parseFloatSafe(trip.total_litros);
    });
    
    if (totalFuel === 0) return 0;
    return totalDistance / totalFuel;
}

/**
 * Calcula estatísticas da frota completa
 * @param {Array} trips - Lista de viagens
 * @returns {Object} - Estatísticas da frota
 */
function calculateFleetStatistics(trips) {
    let totalDistance = 0;
    let totalFuel = 0;
    const driversSet = new Set();
    
    trips.forEach(trip => {
        totalDistance += parseFloatSafe(trip.distancia_km);
        totalFuel += parseFloatSafe(trip.total_litros);
        if (trip.motorista) driversSet.add(trip.motorista);
    });
    
    const fleetKmpl = totalFuel > 0 ? (totalDistance / totalFuel) : 0;
    
    return {
        totalDrivers: driversSet.size,
        fleetKmpl: fleetKmpl.toFixed(2),
        totalDistance: totalDistance.toFixed(1),
        totalFuel: totalFuel.toFixed(1),
        totalTrips: trips.length
    };
}

/**
 * Calcula estatísticas por motorista (média correta: distância total / litros total)
 * @param {Array} trips - Lista de viagens
 * @returns {Array} - Lista de motoristas com suas estatísticas
 */
function calculateDriverStatistics(trips) {
    const driverMap = new Map();
    
    trips.forEach(trip => {
        if (!trip.motorista) return;
        
        if (!driverMap.has(trip.motorista)) {
            driverMap.set(trip.motorista, {
                nome: trip.motorista,
                cpf: trip.cpf || '-',
                placas: new Set(),
                totalDistance: 0,
                totalFuel: 0,
                somaVelMedia: 0,
                countVelMedia: 0,
                somaConducaoPercent: 0,
                countConducao: 0,
                totalFreioAcionamentos: 0,
                countFreio: 0
            });
        }
        
        const driver = driverMap.get(trip.motorista);
        
        if (trip.placa) driver.placas.add(trip.placa);
        
        const distancia = parseFloatSafe(trip.distancia_km);
        const litros = parseFloatSafe(trip.total_litros);
        const velMedia = parseFloatSafe(trip.velocidade_media, null);
        const conducaoPercent = parseFloatSafe(trip.tempo_conducao_percent, null);
        const freios = parseFloatSafe(trip.freio_acionamentos);
        
        driver.totalDistance += distancia;
        driver.totalFuel += litros;
        
        if (velMedia !== null && !isNaN(velMedia) && velMedia > 0) {
            driver.somaVelMedia += velMedia;
            driver.countVelMedia++;
        }
        
        if (conducaoPercent !== null && !isNaN(conducaoPercent) && conducaoPercent > 0) {
            driver.somaConducaoPercent += conducaoPercent;
            driver.countConducao++;
        }
        
        if (freios > 0) {
            driver.totalFreioAcionamentos += freios;
            driver.countFreio++;
        }
        
        if (trip.cpf && trip.cpf !== '-') driver.cpf = trip.cpf;
    });
    
    // Converter para array e calcular médias corretas
    const driversArray = Array.from(driverMap.values()).map(driver => {
        // Média de Km/l correta: distância total / litros total
        const kmlMedio = driver.totalFuel > 0 ? (driver.totalDistance / driver.totalFuel) : 0;
        
        return {
            nome: driver.nome,
            cpf: driver.cpf || '-',
            placa: Array.from(driver.placas).join(', ') || '-',
            kmlMedio: kmlMedio.toFixed(2),
            distanciaTotal: driver.totalDistance.toFixed(1),
            totalLitros: driver.totalFuel.toFixed(1),
            velMedia: driver.countVelMedia > 0 ? (driver.somaVelMedia / driver.countVelMedia).toFixed(1) : '0',
            conducaoPercent: driver.countConducao > 0 ? (driver.somaConducaoPercent / driver.countConducao).toFixed(0) : '0',
            freioMedio: driver.countFreio > 0 ? (driver.totalFreioAcionamentos / driver.countFreio).toFixed(0) : '0'
        };
    });
    
    // Ordenar por Km/l médio (decrescente) - maior eficiência primeiro
    return driversArray.sort((a, b) => parseFloat(b.kmlMedio) - parseFloat(a.kmlMedio));
}

// ==================== DASHBOARD ====================
async function loadDashboardData() {
    try {
        allTrips = await SupabaseManager.getAllTrips();
        
        if (!allTrips || allTrips.length === 0) {
            clearDashboardEmpty();
            return;
        }
        
        // Estatísticas da frota (cálculo correto)
        const fleetStats = calculateFleetStatistics(allTrips);
        
        const totalDriversEl = document.getElementById('totalDrivers');
        const avgKmplEl = document.getElementById('avgKmpl');
        const totalDistanceEl = document.getElementById('totalDistance');
        const totalFuelEl = document.getElementById('totalFuel');
        
        if (totalDriversEl) totalDriversEl.innerText = fleetStats.totalDrivers;
        if (avgKmplEl) avgKmplEl.innerHTML = `${fleetStats.fleetKmpl} <span style="font-size: 0.7rem;">km/l</span>`;
        if (totalDistanceEl) totalDistanceEl.innerHTML = `${fleetStats.totalDistance} <span style="font-size: 0.7rem;">km</span>`;
        if (totalFuelEl) totalFuelEl.innerHTML = `${fleetStats.totalFuel} <span style="font-size: 0.7rem;">L</span>`;
        
        // Estatísticas por motorista (cálculo correto)
        const driversStats = calculateDriverStatistics(allTrips);
        
        renderDriversTable(driversStats, '');
        updateRankingChart(driversStats);
        updateScatterChart(allTrips);
        addTooltipToKPI();
        
    } catch (e) {
        console.error('Erro ao carregar dashboard:', e);
        clearDashboardEmpty();
    }
}

function renderDriversTable(driversArray, searchTerm = '') {
    let filteredDrivers = driversArray;
    
    if (searchTerm && searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        filteredDrivers = driversArray.filter(d =>
            d.nome.toLowerCase().includes(term) ||
            d.placa.toLowerCase().includes(term) ||
            d.cpf.includes(term)
        );
    }
    
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    if (filteredDrivers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">Nenhum motorista encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredDrivers.map(d => `
        <tr>
            <td><strong>${escapeHtml(d.nome)}</strong></td>
            <td>${escapeHtml(d.cpf)}</td>
            <td>${escapeHtml(d.placa)}</td>
            <td class="kpi-highlight">${d.kmlMedio} km/l</td>
            <td>${d.distanciaTotal} km</td>
            <td>${d.totalLitros} L</td>
            <td>${d.velMedia} km/h</td>
            <td>${d.conducaoPercent}%</td>
            <td>${d.freioMedio}</td>
        </tr>
    `).join('');
}

function updateRankingChart(driversStats) {
    const topDrivers = driversStats.slice(0, 5);
    const ctx = document.getElementById('rankingChart');
    if (!ctx) return;
    
    const context = ctx.getContext('2d');
    if (currentChartRanking) currentChartRanking.destroy();
    
    if (topDrivers.length === 0) {
        currentChartRanking = new Chart(context, {
            type: 'bar',
            data: { labels: ['Sem dados'], datasets: [{ label: 'Km/l', data: [0] }] }
        });
        return;
    }
    
    currentChartRanking = new Chart(context, {
        type: 'bar',
        data: {
            labels: topDrivers.map(d => d.nome.length > 20 ? d.nome.substring(0, 20) + '...' : d.nome),
            datasets: [{
                label: 'Média de Km/l (Distância Total / Litros Total)',
                data: topDrivers.map(d => parseFloat(d.kmlMedio)),
                backgroundColor: '#3bc9db',
                borderRadius: 8,
                barPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' },
                tooltip: { 
                    callbacks: { 
                        label: (ctx) => `${ctx.raw} km/l`
                    } 
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Km/l', font: { weight: 'bold' } },
                    beginAtZero: true,
                    grid: { color: '#e2e8f0' }
                },
                x: {
                    title: { display: true, text: 'Motorista', font: { weight: 'bold' } }
                }
            }
        }
    });
}

function updateScatterChart(trips) {
    const ctx = document.getElementById('scatterChart');
    if (!ctx) return;
    
    const context = ctx.getContext('2d');
    if (currentChartScatter) currentChartScatter.destroy();
    
    // Preparar dados para o scatter plot (distância x km/l)
    const points = trips
        .filter(t => {
            const dist = parseFloatSafe(t.distancia_km);
            const kml = parseFloatSafe(t.km_l);
            return dist > 0 && kml > 0;
        })
        .map(t => ({
            x: parseFloatSafe(t.distancia_km),
            y: parseFloatSafe(t.km_l),
            motorista: t.motorista || 'Desconhecido',
            placa: t.placa || '-'
        }));
    
    if (points.length === 0) {
        currentChartScatter = new Chart(context, {
            type: 'scatter',
            data: { datasets: [{ label: 'Sem dados', data: [] }] },
            options: { responsive: true }
        });
        return;
    }
    
    currentChartScatter = new Chart(context, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Viagens',
                data: points,
                backgroundColor: '#f59e0b',
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#f59e0b',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const point = points[context.dataIndex];
                            return [
                                `Motorista: ${point.motorista}`,
                                `Placa: ${point.placa}`,
                                `Distância: ${point.x.toFixed(1)} km`,
                                `Consumo: ${point.y.toFixed(2)} km/l`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { 
                    title: { display: true, text: 'Distância por Viagem (Km)', font: { weight: 'bold' } },
                    grid: { color: '#e2e8f0' }
                },
                y: { 
                    title: { display: true, text: 'Km/l por Viagem', font: { weight: 'bold' } },
                    grid: { color: '#e2e8f0' },
                    beginAtZero: true
                }
            }
        }
    });
}

function addTooltipToKPI() {
    const avgKmplCard = document.querySelector('.kpi-card:nth-child(2)');
    if (avgKmplCard && !avgKmplCard.querySelector('.tooltip-info')) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-info';
        tooltip.innerHTML = '<i class="fas fa-info-circle" style="font-size: 0.7rem; margin-left: 5px; cursor: help;"></i><span class="tooltip-text">Média da frota = Distância Total (km) ÷ Total de Litros</span>';
        tooltip.style.position = 'relative';
        tooltip.style.display = 'inline-block';
        
        const kpiInfo = avgKmplCard.querySelector('.kpi-info p');
        if (kpiInfo) {
            kpiInfo.style.display = 'flex';
            kpiInfo.style.alignItems = 'center';
            kpiInfo.style.gap = '5px';
            kpiInfo.appendChild(tooltip);
        }
        
        // CSS já está no style.css, não precisa adicionar novamente
    }
}

function clearDashboardEmpty() {
    const totalDriversEl = document.getElementById('totalDrivers');
    const avgKmplEl = document.getElementById('avgKmpl');
    const totalDistanceEl = document.getElementById('totalDistance');
    const totalFuelEl = document.getElementById('totalFuel');
    const tableBody = document.getElementById('tableBody');
    
    if (totalDriversEl) totalDriversEl.innerText = '0';
    if (avgKmplEl) avgKmplEl.innerHTML = '0 <span style="font-size: 0.7rem;">km/l</span>';
    if (totalDistanceEl) totalDistanceEl.innerHTML = '0 <span style="font-size: 0.7rem;">km</span>';
    if (totalFuelEl) totalFuelEl.innerHTML = '0 <span style="font-size: 0.7rem;">L</span>';
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="9">Nenhum dado importado</td></tr>';
    
    if (currentChartRanking) currentChartRanking.destroy();
    if (currentChartScatter) currentChartScatter.destroy();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}