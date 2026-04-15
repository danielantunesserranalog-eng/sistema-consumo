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

// ==================== FUNÇÕES DE IMPORTAÇÃO (LEITURA NATIVA DE CSV) ====================
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const progressDiv = document.getElementById('importProgress');
    const resultDiv = document.getElementById('importResult');
    if (progressDiv) progressDiv.style.display = 'block';
    if (resultDiv) resultDiv.innerHTML = '';
    
    try {
        const data = await readCsvFile(file);
        const mappedTrips = mapDataToTrips(data);
        
        if (mappedTrips.length === 0) {
            throw new Error('Nenhuma linha válida encontrada no arquivo (ou todas foram ignoradas pelos filtros).');
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

/**
 * Lê o CSV nativamente sem usar bibliotecas externas para não corromper decimais com vírgula.
 */
function readCsvFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const text = e.target.result;
                // Detecta se é separado por ponto-e-vírgula (padrão Brasil) ou vírgula
                const delimiter = text.includes(';') ? ';' : ',';
                
                const lines = text.split(/\r?\n/);
                if (lines.length === 0) { resolve([]); return; }
                
                // Extrai cabeçalhos e limpa aspas
                const headers = lines[0].split(delimiter).map(h => {
                    let hTrim = h.trim();
                    if (hTrim.startsWith('"') && hTrim.endsWith('"')) {
                        hTrim = hTrim.substring(1, hTrim.length - 1);
                    }
                    return hTrim;
                });
                
                const rows = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    const values = [];
                    let inQuotes = false;
                    let currentVal = '';
                    
                    for (let j = 0; j < line.length; j++) {
                        const char = line[j];
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === delimiter && !inQuotes) {
                            values.push(currentVal);
                            currentVal = '';
                        } else {
                            currentVal += char;
                        }
                    }
                    values.push(currentVal);
                    
                    let rowObj = {};
                    headers.forEach((header, index) => {
                        let val = values[index] !== undefined ? values[index].trim() : null;
                        if (val && val.startsWith('"') && val.endsWith('"')) {
                            val = val.substring(1, val.length - 1);
                        }
                        rowObj[header] = val;
                    });
                    rows.push(rowObj);
                }
                resolve(rows);
            } catch (error) {
                reject(new Error("Erro ao processar o formato do CSV."));
            }
        };
        reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
        // Usa ISO-8859-1 para garantir que caracteres com acento (como "Distância") sejam lidos corretamente
        reader.readAsText(file, 'ISO-8859-1');
    });
}

function mapDataToTrips(rows) {
    const allowedColumns = [
        'Identificador/Placa', 'Início', 'Fim', 'Tempo de Motor Ligado', 'Distância (Km)',
        'Vel. Max (Seca)', 'Vel. Max (Molhada)', 'Velocidade Média', 'Km/l', 'Total Litros Consumido',
        'Tempo de Condução (%)', 'Tempo Parado (%)', 'Tempo de Condução', 'Tempo Parado',
        'Odômetro Inicial', 'Odômetro Final', 'Motorista', 'CPF', 'Qtde. de acionamento do pedal de freio',
        'Distância com o pedal de freio pressionado'
    ];
    
    // Lista de colunas numéricas que devem ser rigorosamente tratadas do formato BR para banco de dados
    const numericColumns = [
        'Distância (Km)', 'Vel. Max (Seca)', 'Vel. Max (Molhada)', 'Velocidade Média',
        'Km/l', 'Total Litros Consumido', 'Tempo de Condução (%)', 'Tempo Parado (%)',
        'Odômetro Inicial', 'Odômetro Final', 'Qtde. de acionamento do pedal de freio',
        'Distância com o pedal de freio pressionado'
    ];
    
    return rows.map(row => {
        let newRow = {};
        allowedColumns.forEach(col => {
            let value = row[col] !== undefined ? row[col] : null;
            
            if (typeof value === 'string') {
                value = value.trim();
                
                // Tratamento específico para conversão de decimais (Ex: 789,62 vira 789.62)
                if (numericColumns.includes(col) && value !== '') {
                    // Remove possíveis pontos de milhar e converte vírgula decimal para ponto
                    let cleanStr = value.replace(/\./g, '').replace(',', '.');
                    let num = parseFloat(cleanStr);
                    if (!isNaN(num)) {
                        value = num;
                    } else {
                        value = null;
                    }
                }
            }
            
            newRow[normalizeColumnName(col)] = value;
        });
        return newRow;
    }).filter(trip => {
        // Formata os nomes para garantir que não são espaços em branco
        const motorista = trip.motorista ? trip.motorista.toString().trim() : '';
        const placa = trip.placa ? trip.placa.toString().trim() : '';
        
        // Validação básica: descartar se placa ou motorista estiverem vazios, nulos ou forem apenas um "-"
        if (!motorista || motorista === '-' || !placa || placa === '-') {
            return false;
        }
        
        // Validação extra: O tempo de motor ligado precisa ser >= 10 minutos
        const totalMinutos = parseTimeToMinutes(trip.tempo_motor_ligado);
        return totalMinutos >= 10;
    });
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

// ==================== FUNÇÕES AUXILIARES PARA VALIDAÇÃO E FORMATAÇÃO ====================
function parseFloatSafe(value, defaultValue = 0) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Formata números para o padrão brasileiro (ex: 1.500,50)
 */
function formatNumberBR(value, decimals = 1) {
    const num = parseFloat(value);
    if (isNaN(num)) return '0' + (decimals > 0 ? ',' + '0'.repeat(decimals) : '');
    return num.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Converte string de tempo (ex: "11h 14m 37s") para total em minutos
 */
function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    
    let hours = 0, minutes = 0, seconds = 0;
    
    // Extrai horas, minutos e segundos usando Regex, ignorando case e espaços
    const hMatch = timeStr.match(/(\d+)\s*h/i);
    const mMatch = timeStr.match(/(\d+)\s*m/i);
    const sMatch = timeStr.match(/(\d+)\s*s/i);

    if (hMatch) hours = parseInt(hMatch[1], 10);
    if (mMatch) minutes = parseInt(mMatch[1], 10);
    if (sMatch) seconds = parseInt(sMatch[1], 10);

    // Converte tudo para minutos
    return (hours * 60) + minutes + (seconds / 60);
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
        fleetKmpl: fleetKmpl,
        totalDistance: totalDistance,
        totalFuel: totalFuel,
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
            kmlMedio: kmlMedio,
            distanciaTotal: driver.totalDistance,
            totalLitros: driver.totalFuel,
            velMedia: driver.countVelMedia > 0 ? (driver.somaVelMedia / driver.countVelMedia) : 0,
            conducaoPercent: driver.countConducao > 0 ? (driver.somaConducaoPercent / driver.countConducao) : 0,
            freioMedio: driver.countFreio > 0 ? (driver.totalFreioAcionamentos / driver.countFreio) : 0
        };
    });
    
    // Ordenar por Km/l médio (decrescente) - maior eficiência primeiro
    return driversArray.sort((a, b) => b.kmlMedio - a.kmlMedio);
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
        if (avgKmplEl) avgKmplEl.innerHTML = `${formatNumberBR(fleetStats.fleetKmpl, 2)} <span style="font-size: 0.7rem;">km/l</span>`;
        if (totalDistanceEl) totalDistanceEl.innerHTML = `${formatNumberBR(fleetStats.totalDistance, 1)} <span style="font-size: 0.7rem;">km</span>`;
        if (totalFuelEl) totalFuelEl.innerHTML = `${formatNumberBR(fleetStats.totalFuel, 1)} <span style="font-size: 0.7rem;">L</span>`;
        
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
            <td class="kpi-highlight">${formatNumberBR(d.kmlMedio, 2)} km/l</td>
            <td>${formatNumberBR(d.distanciaTotal, 1)} km</td>
            <td>${formatNumberBR(d.totalLitros, 1)} L</td>
            <td>${formatNumberBR(d.velMedia, 1)} km/h</td>
            <td>${formatNumberBR(d.conducaoPercent, 0)}%</td>
            <td>${formatNumberBR(d.freioMedio, 0)}</td>
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
                        label: (ctx) => `${formatNumberBR(ctx.raw, 2)} km/l`
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
                                `Distância: ${formatNumberBR(point.x, 1)} km`,
                                `Consumo: ${formatNumberBR(point.y, 2)} km/l`
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