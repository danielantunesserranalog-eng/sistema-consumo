// ==================== CÉREBRO DA APLICAÇÃO (CÁLCULOS E INTEGRAÇÃO) ====================

document.addEventListener('DOMContentLoaded', () => {
    if (!initSupabase()) { console.error('Erro de Supabase'); return; }
    
    renderMenu();
    
    initNavigation();
    initMenuToggle();
    initImportModule();
    initDeleteModule();
    initGlobalFilters();
    initSettingsModule();
    
    loadMetaFromDB().then(() => {
        setTimeout(() => {
            const btn = document.getElementById('applyFilterBtn');
            if (btn) btn.click();
        }, 500);
    });
});

async function loadMetaFromDB() {
    try {
        const { data, error } = await supabaseClient
            .from('configuracoes')
            .select('chave, valor')
            .in('chave', ['meta_kml', 'meta_viagens_dia']);
        if (error) throw error;
        
        if (data && data.length > 0) {
            data.forEach(item => {
                if (item.chave === 'meta_kml') currentMetaKML = parseFloat(item.valor);
                if (item.chave === 'meta_viagens_dia') currentMetaViagens = parseFloat(item.valor);
            });
            
            const metaInp = document.getElementById('metaInput');
            if (metaInp) metaInp.value = currentMetaKML.toFixed(2);
            
            const viagInput = document.getElementById('metaViagensInput');
            if(viagInput) viagInput.value = currentMetaViagens.toFixed(1);
            
            updateMetaTexts();
        }
    } catch (e) {
        console.warn('Usando metas padrão local (tabela configuracoes vazia ou erro).');
    }
}

function initSettingsModule() {
    const btn = document.getElementById('saveMetaBtn');
    if (!btn) return;
    
    btn.addEventListener('click', async () => {
        const valKml = parseFloat(document.getElementById('metaInput').value);
        const valViag = parseFloat(document.getElementById('metaViagensInput').value);
        
        if(valKml > 0 && valViag > 0) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            btn.disabled = true;
            try {
                const { error } = await supabaseClient
                    .from('configuracoes')
                    .upsert([
                        { chave: 'meta_kml', valor: valKml.toString(), atualizado_em: new Date().toISOString() },
                        { chave: 'meta_viagens_dia', valor: valViag.toString(), atualizado_em: new Date().toISOString() }
                    ]);
                if (error) throw error;
                
                currentMetaKML = valKml;
                currentMetaViagens = valViag;
                updateMetaTexts();
                if(rawData.length > 0) processFilteredData();
                
                alert(`Parâmetros salvos: KML=${valKml.toFixed(2)} | Viagens/Dia=${valViag.toFixed(1)}`);
            } catch (e) {
                alert('Erro ao salvar meta no banco de dados. Verifique o console.');
                console.error(e);
            } finally {
                btn.innerHTML = '<i class="fas fa-save"></i> Salvar Parâmetros';
                btn.disabled = false;
            }
        } else {
            alert('Por favor, insira valores válidos maiores que zero.');
        }
    });
}

function initGlobalFilters() {
    const dateFilter = document.getElementById('dateFilter');
    const customDateInput = document.getElementById('startDateInput');
    const endInput = document.getElementById('endDateInput');
    const dateInputsGroup = document.getElementById('dateInputsGroup');
    const sep = document.getElementById('dateSeparator');
    const lbl = document.getElementById('dateInputsLabel');
    const applyBtn = document.getElementById('applyFilterBtn');
    
    if(dateFilter) {
        dateFilter.addEventListener('change', () => {
            const val = dateFilter.value;
            const todayISO = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
            
            if (val === 'custom') {
                dateInputsGroup.style.display = 'flex';
                customDateInput.style.display = 'block';
                endInput.style.display = 'none';
                sep.style.display = 'none';
                lbl.innerText = 'Qual data?';
                if(!customDateInput.value) customDateInput.value = todayISO;
            } else if (val === 'range') {
                dateInputsGroup.style.display = 'flex';
                customDateInput.style.display = 'block';
                endInput.style.display = 'block';
                sep.style.display = 'block';
                lbl.innerText = 'Período Exato';
                if(!customDateInput.value) customDateInput.value = todayISO;
                if(!endInput.value) endInput.value = todayISO;
            } else {
                dateInputsGroup.style.display = 'none';
            }
        });
    }
    
    const filterPlaca = document.getElementById('filterPlaca');
    const filterMot = document.getElementById('filterMotorista');
    
    if(filterPlaca) filterPlaca.addEventListener('change', processFilteredData);
    if(filterMot) filterMot.addEventListener('change', processFilteredData);
    
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
            loadCoreData().then(() => {
                applyBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Buscar Dados';
            });
        });
    }
}

function getDateBoundaries() {
    const val = document.getElementById('dateFilter').value;
    const startInput = document.getElementById('startDateInput')?.value;
    const endInput = document.getElementById('endDateInput')?.value;
    
    let start = new Date();
    let end = new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    if (val === 'custom' && startInput) {
        const parts = startInput.split('-');
        start = new Date(parts[0], parts[1]-1, parts[2], 0, 0, 0);
        end = new Date(parts[0], parts[1]-1, parts[2], 23, 59, 59);
    } else if (val === 'range' && startInput && endInput) {
        const pStart = startInput.split('-');
        const pEnd = endInput.split('-');
        start = new Date(pStart[0], pStart[1]-1, pStart[2], 0, 0, 0);
        end = new Date(pEnd[0], pEnd[1]-1, pEnd[2], 23, 59, 59);
    } else if (val === 'today') {
        // Ok
    } else if (val === 'd-1') {
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
    } else {
        switch(val) {
            case 'd-2': start.setDate(start.getDate() - 2); break;
            case 'd-7': start.setDate(start.getDate() - 7); break;
            case 'd-30': start.setDate(start.getDate() - 30); break;
            case 'week': start.setDate(start.getDate() - start.getDay()); break;
            case 'month': start.setDate(1); break;
        }
    }
    
    const pad = (n) => String(n).padStart(2, '0');
    const format = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    return { startStr: format(start), endStr: format(end) };
}

async function loadCoreData() {
    const bounds = getDateBoundaries();
    
    try {
        // 1. BANCO PRINCIPAL (Gera Média e Distância)
        const viagensPromise = supabaseClient
            .from('viagens')
            .select('placa, motorista, km_l, distancia_km, inicio, fim, tempo_conducao, tempo_parado, local_inicial, local_final')
            .gte('inicio', bounds.startStr)
            .lte('inicio', bounds.endStr)
            .order('inicio', { ascending: true })
            .limit(100000);

        // 2. BANCO SECUNDÁRIO (Busca geral da transportadora para evitar erro de banco)
        const historicoPromise = supabaseClientHistorico
            .from('historico_viagens')
            .select('*')
            .eq('transportadora', 'SERRANALOG TRANSPORTES')
            .limit(100000);

        const [viagensResult, historicoResult] = await Promise.all([viagensPromise, historicoPromise]);
            
        if (viagensResult.error) throw viagensResult.error;
        
        rawData = viagensResult.data || [];
        
        if (rawData.length === 0) { showEmptyDashboard(); return; }

        // 3. FILTRAGEM DE DATAS (CORRIGIDO PARA O FORMATO BRASILEIRO DO EXCEL)
        rawHistorico = [];
        if (!historicoResult.error && historicoResult.data) {
            const startMs = new Date(bounds.startStr.replace(' ', 'T')).getTime();
            const endMs = new Date(bounds.endStr.replace(' ', 'T')).getTime();

            rawHistorico = historicoResult.data.filter(item => {
                // Tenta pegar a coluna dataDaBaseExcel, se não achar tenta dataLancamento
                const dVal = item.dataDaBaseExcel || item.dataLancamento || item.created_at;
                if (!dVal) return true; // Na dúvida, aceita a viagem para não zerar os cards
                
                let itemMs;
                const strVal = String(dVal).trim();
                
                // Se a data vier no formato brasileiro (ex: 18/04/2026), inverte para o computador entender
                if (strVal.includes('/')) {
                    const parts = strVal.split('/');
                    if (parts.length >= 3) {
                        const day = parts[0].padStart(2, '0');
                        const month = parts[1].padStart(2, '0');
                        const year = parts[2].substring(0, 4); // Pega apenas o ano
                        itemMs = new Date(`${year}-${month}-${day}T12:00:00`).getTime();
                    }
                } else {
                    itemMs = new Date(strVal).getTime();
                }
                
                if (isNaN(itemMs)) return true; // Se a data for muito louca, aceita a viagem
                
                return itemMs >= startMs && itemMs <= endMs;
            });
        } else if (historicoResult.error) {
            console.warn("Aviso: Falha ao carregar banco de histórico.", historicoResult.error);
        }
        
        populateEntityDropdowns();
        processFilteredData();
        
    } catch (e) {
        console.error("Erro na carga do banco principal:", e);
        showDashboardError();
    }
}

function populateEntityDropdowns() {
    const motSelect = document.getElementById('filterMotorista');
    const placSelect = document.getElementById('filterPlaca');
    
    if (!motSelect || !placSelect) return;
    
    const currentMot = motSelect.value;
    const currentPlac = placSelect.value;
    
    const uniqueMot = [...new Set(rawData.map(d => d.motorista).filter(Boolean))].sort();
    const uniquePlac = [...new Set(rawData.map(d => d.placa).filter(Boolean))].sort();
    
    motSelect.innerHTML = '<option value="all">Todos os Motoristas</option>' + uniqueMot.map(v => `<option value="${v.replace(/'/g, "\\'")}">${v}</option>`).join('');
    placSelect.innerHTML = '<option value="all">Toda a Frota</option>' + uniquePlac.map(v => `<option value="${v.replace(/'/g, "\\'")}">${v}</option>`).join('');
    
    if (uniqueMot.includes(currentMot)) motSelect.value = currentMot;
    if (uniquePlac.includes(currentPlac)) placSelect.value = currentPlac;
}

function processFilteredData() {
    const selPlacObj = document.getElementById('filterPlaca');
    const selMotObj = document.getElementById('filterMotorista');
    
    const selPlac = selPlacObj ? selPlacObj.value : 'all';
    const selMot = selMotObj ? selMotObj.value : 'all';
    
    let filtered = rawData;
    let filteredHistorico = rawHistorico;
    
    if (selPlac !== 'all') {
        filtered = filtered.filter(v => v.placa === selPlac);
        // Remove traços e espaços para a comparação ser exata
        const normSelPlac = String(selPlac).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        filteredHistorico = filteredHistorico.filter(v => {
            const normV = String(v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            return normV === normSelPlac;
        });
    }
    
    if (filtered.length === 0) { showEmptyDashboard(); return; }
    
    calculateMetrics(filtered, filteredHistorico);
    renderDashboardCharts(filtered);
    renderTables(filtered);
    renderEvolutionChartLogic(filtered, selMot, selPlac);
}

function calculateMetrics(viagens, historico) {
    let globalDist = 0; let globalLitros = 0;
    const driverMap = new Map();
    const truckMap = new Map();
    
    // MÉTRICAS PRINCIPAIS (KML, DISTÂNCIA) USAM APENAS O BANCO PRINCIPAL ("viagens")
    viagens.forEach(v => {
        if (v.distancia_km && v.distancia_km > 0 && v.km_l && v.km_l > 0) {
            const dist = parseFloat(v.distancia_km);
            const litros = dist / parseFloat(v.km_l);
            
            globalDist += dist;
            globalLitros += litros;
            
            const dName = v.motorista || 'Indefinido';
            if (!driverMap.has(dName)) driverMap.set(dName, { dist: 0, litros: 0, trips: 0 });
            driverMap.get(dName).dist += dist;
            driverMap.get(dName).litros += litros;
            driverMap.get(dName).trips += 1;
            
            const tPlate = v.placa || 'Indefinido';
            if (!truckMap.has(tPlate)) truckMap.set(tPlate, { dist: 0, litros: 0 });
            truckMap.get(tPlate).dist += dist;
            truckMap.get(tPlate).litros += litros;
        }
    });
    
    dashboardData.totalDist = globalDist;
    dashboardData.totalFuel = globalLitros;
    dashboardData.avgConsumption = globalLitros > 0 ? (globalDist / globalLitros) : 0;
    
    dashboardData.drivers = Array.from(driverMap.entries())
        .map(([name, data]) => ({ name, dist: data.dist, realKML: data.litros > 0 ? data.dist / data.litros : 0, trips: data.trips }))
        .sort((a, b) => b.realKML - a.realKML);
        
    dashboardData.criticalDrivers = dashboardData.drivers
        .filter(d => d.realKML > 0 && d.realKML < currentMetaKML && d.dist > 10)
        .sort((a, b) => a.realKML - b.realKML);
        
    dashboardData.trucks = Array.from(truckMap.entries())
        .map(([plate, data]) => ({ plate, realKML: data.litros > 0 ? data.dist / data.litros : 0 }))
        .sort((a, b) => b.realKML - a.realKML);
        
    const start = new Date(viagens[0].inicio);
    const end = new Date(viagens[viagens.length - 1].inicio);
    const daysDiff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    
    // ======== LÓGICA DE ALERTAS E VIAGENS USANDO APENAS O BANCO DE HISTÓRICO ========
    dashboardData.totalHistoricoTrips = historico.length;

    const truckTrips = new Map();
    historico.forEach(v => { 
        // Remove espaços, traços e bota tudo maiúsculo (ex: "ABC-1234" -> "ABC1234")
        let p = v.placa || v.Placa || v.PLACA || 'Indefinido'; 
        p = String(p).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        truckTrips.set(p, (truckTrips.get(p) || 0) + 1); 
    });
    
    let sumTrips = 0; let active = 0; 
    dashboardData.alerts = [];
    
    // Cruza a placa do banco principal com a contagem feita acima
    dashboardData.trucks.forEach(t => {
        const normPlate = String(t.plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const tripsTotal = truckTrips.get(normPlate) || 0;
        const avg = tripsTotal / daysDiff;
        
        sumTrips += avg; 
        active++;
        
        let issue = 'OK';
        let pesoCritico = 0;
        
        const isBaixoKml = t.realKML < currentMetaKML && t.realKML > 0;
        const isBaixaRodagem = avg < currentMetaViagens;
        
        if (isBaixoKml && isBaixaRodagem) {
            issue = 'Crítico (Consumo e Rodagem)';
            pesoCritico = 3;
        } else if (isBaixoKml) {
            issue = 'Alto Consumo';
            pesoCritico = 2;
        } else if (isBaixaRodagem) {
            issue = 'Baixa Rodagem';
            pesoCritico = 1;
        }
        
        dashboardData.alerts.push({ 
            placa: t.plate, 
            trips: avg, 
            kml: t.realKML,
            issue: issue,
            peso: pesoCritico
        });
    });
    
    dashboardData.alerts.sort((a, b) => {
        if (b.peso !== a.peso) return b.peso - a.peso;
        if (a.kml !== b.kml) return a.kml - b.kml;     
        return a.trips - b.trips;                      
    });
    
    dashboardData.avgTripsPerDay = active > 0 ? (sumTrips / active) : 0;
    updateStatsCards();
}

// ===========================================================

function parseInterval(i) {
    if (!i) return 0;
    if (typeof i === 'number') return i;
    if (typeof i === 'string') {
        if (i.includes('second')) return parseInt(i.replace(/\D/g, '')) || 0;
        const match = i.match(/(\d+):(\d+):(\d+)/);
        if (match) return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
        let sec = 0;
        const h = i.match(/(\d+)\s*h/i); const m = i.match(/(\d+)\s*m/i); const s = i.match(/(\d+)\s*s/i);
        if (h) sec += parseInt(h[1]) * 3600; if (m) sec += parseInt(m[1]) * 60; if (s) sec += parseInt(s[1]);
        return sec;
    }
    return 0;
}

function renderDashboardCharts(viagens) {
    if (driverChart) driverChart.destroy();
    const dt = dashboardData.drivers.slice(0, 10);
    driverChart = new Chart(document.getElementById('driverConsumptionChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: dt.map(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name),
            datasets: [{ label: 'KM/L Real', data: dt.map(d => d.realKML), backgroundColor: dt.map(d => d.realKML < currentMetaKML ? '#ef4444' : '#10b981'), borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(51,65,85,0.3)' } }, x: { grid: { display: false } } } }
    });
    
    if (truckChart) truckChart.destroy();
    const tt = dashboardData.trucks.slice(0, 10);
    truckChart = new Chart(document.getElementById('truckConsumptionChart').getContext('2d'), {
        type: 'bar',
        data: { labels: tt.map(t => t.plate), datasets: [{ label: 'KM/L Real', data: tt.map(t => t.realKML), backgroundColor: tt.map(t => t.realKML < currentMetaKML ? '#ef4444' : '#3b82f6'), borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(51,65,85,0.3)' } }, x: { grid: { display: false } } } }
    });
    
    if (timeChart) timeChart.destroy();
    let conducaoSec = 0, paradoSec = 0;
    let viagensCount = viagens.length || 1;
    viagens.forEach(v => {
        conducaoSec += parseInterval(v.tempo_conducao);
        paradoSec += parseInterval(v.tempo_parado);
    });
    if (conducaoSec === 0 && paradoSec === 0) { conducaoSec = 1; paradoSec = 1; }
    
    const hrsConducao = (conducaoSec / 3600);
    const hrsParado = (paradoSec / 3600);
    const percEficiencia = ((hrsConducao / (hrsConducao + hrsParado)) * 100).toFixed(1);
    
    document.getElementById('totConducao').innerText = `${hrsConducao.toFixed(1)}h`;
    document.getElementById('medConducao').innerText = `Média: ${(hrsConducao / viagensCount).toFixed(1)}h / viag`;
    document.getElementById('totParado').innerText = `${hrsParado.toFixed(1)}h`;
    document.getElementById('medParado').innerText = `Média: ${(hrsParado / viagensCount).toFixed(1)}h / viag`;
    document.getElementById('centerEficiencia').innerText = `${percEficiencia}%`;
    
    timeChart = new Chart(document.getElementById('timeDistributionChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Tempo Condução', 'Tempo Parado'],
            datasets: [{ data: [conducaoSec, paradoSec], backgroundColor: ['#3b82f6', '#f59e0b'], borderWidth: 0, hoverOffset: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '80%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${(c.raw / 3600).toFixed(1)}h` } } } }
    });
}

function renderEvolutionChartLogic(viagens, selMot, selPlac) {
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
    
    let title = 'Frota Geral (Todos os Veículos e Motoristas)';
    const titHTML = document.getElementById('tituloEvolucao');
    if (selMot !== 'all' && selPlac !== 'all') {
        title = `Desempenho: ${selMot} na Máquina ${selPlac}`;
    } else if (selMot !== 'all') {
        title = `Desempenho: ${selMot} (Todos os veículos)`;
    } else if (selPlac !== 'all') {
        title = `Desempenho: Máquina ${selPlac} (Todos os motoristas)`;
    }
    
    if(titHTML) titHTML.innerHTML = `<i class="fas fa-chart-area"></i> ${title}`;
    
    const valueLabelsPlugin = {
        id: 'valueLabels',
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            chart.data.datasets.forEach((dataset, i) => {
                if (dataset.label === 'KM/L Real/Dia') {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((point, index) => {
                        const val = dataset.data[index];
                        if (val > 0) {
                            ctx.save();
                            ctx.fillStyle = '#ffffff';
                            ctx.font = 'bold 12px Inter, sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(val, point.x, point.y - 10);
                            ctx.restore();
                        }
                    });
                }
            });
        }
    };

    evolutionChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: sortedKeys.length ? sortedKeys : ['Sem dados'],
            datasets: [
                {
                    label: 'KM/L Real/Dia',
                    data: values.length ? values : [0],
                    borderColor: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    borderWidth: 3, fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#0f172a'
                },
                {
                    label: `Meta (${currentMetaKML.toFixed(2)} KM/L)`,
                    data: sortedKeys.length ? Array(sortedKeys.length).fill(currentMetaKML) : [currentMetaKML],
                    borderColor: '#fbbf24',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: { padding: { top: 25 } },
            scales: { 
                y: { beginAtZero: false, suggestedMin: 1.0, grid: { color: 'rgba(51,65,85,0.3)' } }, 
                x: { grid: { display: false } } 
            } 
        },
        plugins: [valueLabelsPlugin]
    });
}

function showEmptyDashboard() {
    document.querySelectorAll('.stat-card p').forEach(p => p.innerHTML = '--');
    
    ['alertsTableBody', 'driversTableBody', 'historyTableBody', 'rankingTableBody'].forEach(id => {
        const e = document.getElementById(id);
        const cols = id === 'historyTableBody' || id === 'rankingTableBody' ? 6 : (id === 'alertsTableBody' ? 4 : 3);
        if (e) e.innerHTML = `<tr><td colspan="${cols}" class="text-center text-warning">Sem dados para este período e/ou filtros.</td></tr>`;
    });
    
    const ids = ['totConducao', 'totParado'];
    ids.forEach(i => { if(document.getElementById(i)) document.getElementById(i).innerText = '--h'; });
    const meds = ['medConducao', 'medParado'];
    meds.forEach(i => { if(document.getElementById(i)) document.getElementById(i).innerText = 'Média: --h / viag'; });
    
    if(document.getElementById('avgTripsPerDay')) document.getElementById('avgTripsPerDay').innerText = '--/dia';
    if(document.getElementById('centerEficiencia')) document.getElementById('centerEficiencia').innerText = '--%';
    
    const pContainer = document.getElementById('podiumContainer');
    if (pContainer) pContainer.innerHTML = '<div class="text-center text-warning" style="width: 100%; margin-top: 50px;">Sem dados para gerar o pódio.</div>';
    
    if (driverChart) driverChart.destroy();
    if (truckChart) truckChart.destroy();
    if (timeChart) timeChart.destroy();
    if (evolutionChart) evolutionChart.destroy();
}

function showDashboardError() {
    const tbody = document.getElementById('alertsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro de conexão.</td></tr>';
}