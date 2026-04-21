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
        const { data, error } = await supabaseClient
            .from('viagens')
            .select('placa, motorista, km_l, distancia_km, inicio, fim, tempo_conducao, tempo_parado, local_inicial, local_final')
            .gte('inicio', bounds.startStr)
            .lte('inicio', bounds.endStr)
            .order('inicio', { ascending: true })
            .limit(100000);
            
        if (error) throw error;
        
        rawData = data || [];
        
        if (rawData.length === 0) { showEmptyDashboard(); return; }
        
        populateEntityDropdowns();
        processFilteredData();
        
    } catch (e) {
        console.error(e);
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
    
    if (selPlac !== 'all') filtered = filtered.filter(v => v.placa === selPlac);
    if (selMot !== 'all') filtered = filtered.filter(v => v.motorista === selMot);
    
    if (filtered.length === 0) { showEmptyDashboard(); return; }
    
    calculateMetrics(filtered);
    renderDashboardCharts(filtered);
    renderTables(filtered);
    renderEvolutionChartLogic(filtered, selMot, selPlac);
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
    
    const truckTrips = new Map();
    viagens.forEach(v => { const p = v.placa || 'Indefinido'; truckTrips.set(p, (truckTrips.get(p) || 0) + 1); });
    
    let sumTrips = 0; let active = 0; 
    
    // ======== NOVA LÓGICA DE ALERTAS E CRITICIDADE ========
    dashboardData.alerts = [];
    
    dashboardData.trucks.forEach(t => {
        const avg = (truckTrips.get(t.plate) || 0) / daysDiff;
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
    
    // Ordenar do mais crítico para o menos crítico
    dashboardData.alerts.sort((a, b) => {
        if (b.peso !== a.peso) return b.peso - a.peso; // Primeiro critério: Maior peso = pior
        if (a.kml !== b.kml) return a.kml - b.kml;     // Segundo critério: Menor KM/L = pior
        return a.trips - b.trips;                      // Terceiro critério: Menor qtd de viagens = pior
    });
    // =======================================================
    
    dashboardData.avgTripsPerDay = active > 0 ? (sumTrips / active) : 0;
    updateStatsCards();
}