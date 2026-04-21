// ==================== INICIALIZAÇÃO E LÓGICA CENTRAL ==================== 

document.addEventListener('DOMContentLoaded', () => {     
    if (!initSupabase()) { console.error('Erro de Supabase'); return; }     
    
    initNavigation();     
    initMenuToggle();     
    initImportModule();   
    initDeleteModule(); 
    initGlobalFilters();
    initSettingsModule();
    
    loadMetaFromDB().then(() => {
        setTimeout(() => { document.getElementById('applyFilterBtn').click(); }, 500); 
    });
});

async function loadMetaFromDB() {
    try {
        const { data, error } = await supabaseClient
            .from('configuracoes')
            .select('valor')
            .eq('chave', 'meta_kml')
            .single();

        if (error) throw error;
        
        if (data && data.valor) {
            currentMetaKML = parseFloat(data.valor);
            document.getElementById('metaInput').value = currentMetaKML.toFixed(2);
            updateMetaTexts();
        }
    } catch (e) {
        console.warn('Usando meta padrão local (tabela configuracoes vazia).');
    }
}

function initSettingsModule() {
    document.getElementById('saveMetaBtn').addEventListener('click', async () => {
        const val = parseFloat(document.getElementById('metaInput').value);
        const btn = document.getElementById('saveMetaBtn');

        if(val && val > 0) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            btn.disabled = true;

            try {
                const { error } = await supabaseClient
                    .from('configuracoes')
                    .upsert({ chave: 'meta_kml', valor: val.toString(), atualizado_em: new Date().toISOString() });

                if (error) throw error;

                currentMetaKML = val;
                updateMetaTexts();
                if(rawData.length > 0) processFilteredData(); 
                
                alert(`A régua de meta foi salva na nuvem: ${val.toFixed(2)} KM/L`);
            } catch (e) {
                alert('Erro ao salvar meta no banco de dados. Verifique o console.');
                console.error(e);
            } finally {
                btn.innerHTML = '<i class="fas fa-save"></i> Salvar Parâmetro';
                btn.disabled = false;
            }
        } else {
            alert('Por favor, insira um valor válido.');
        }
    });
}

function initGlobalFilters() {
    const typeSelect = document.getElementById('entityType');
    const valueSelect = document.getElementById('entityValue');
    const groupValue = document.getElementById('entityValueGroup');
    const dateFilter = document.getElementById('dateFilter');
    const customDateInput = document.getElementById('customDateInput');
    const applyBtn = document.getElementById('applyFilterBtn');

    dateFilter.addEventListener('change', () => {
        if (dateFilter.value === 'custom') {
            customDateInput.style.display = 'block';
            if (!customDateInput.value) {
                const today = new Date();
                const offset = today.getTimezoneOffset() * 60000;
                customDateInput.value = (new Date(today - offset)).toISOString().split('T')[0];
            }
        } else {
            customDateInput.style.display = 'none';
        }
    });

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
        applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
        loadCoreData().then(() => {
            applyBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados';
        });
    });
}

function getDateBoundaries() {
    const val = document.getElementById('dateFilter').value;
    const customDate = document.getElementById('customDateInput').value;
    
    let start = new Date();
    let end = new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (val === 'custom' && customDate) {
        const parts = customDate.split('-');
        start = new Date(parts[0], parts[1]-1, parts[2], 0, 0, 0);
        end = new Date(parts[0], parts[1]-1, parts[2], 23, 59, 59);
    } else if (val === 'today') {
        // Nada muda, já está em hoje
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
            .limit(50000);
            
        if (error) throw error;
        
        rawData = data || [];
        if (rawData.length === 0) { showEmptyDashboard(); return; }

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
    renderTables(filtered);
    renderEvolutionChartLogic(filtered, eType, eVal);
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

            // ADICIONADO: 'trips' para contar quantas viagens o motorista fez
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
    
    // ADICIONADO: exportar 'trips' pro dashboardData
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
    
    let sumTrips = 0; let active = 0; dashboardData.alerts = [];     
    
    dashboardData.trucks.forEach(t => { 
        const avg = (truckTrips.get(t.plate) || 0) / daysDiff;
        sumTrips += avg; active++;

        if (t.realKML < currentMetaKML && t.realKML > 0) dashboardData.alerts.push({ placa: t.plate, trips: avg.toFixed(1), issue: 'Alto Consumo' });
        else if (avg < 2) dashboardData.alerts.push({ placa: t.plate, trips: avg.toFixed(1), issue: 'Baixa Rodagem' });
    });          

    dashboardData.avgTripsPerDay = active > 0 ? (sumTrips / active) : 0;
    updateStatsCards(); 
}

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