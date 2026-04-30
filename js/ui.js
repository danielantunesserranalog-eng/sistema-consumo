// ==================== INTERFACE DE USUÁRIO E GRÁFICOS (ECHARTS + PDF) ====================

// Lógica de Geração do Relatório PDF
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('exportPdfBtn');
    if(btn) {
        btn.addEventListener('click', () => {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando PDF...';
            const element = document.getElementById('contentArea');
            const opt = {
                margin:       0.2,
                filename:     `Relatorio_Frota_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'in', format: 'a3', orientation: 'landscape' }
            };
            html2pdf().set(opt).from(element).save().then(() => {
                btn.innerHTML = '<i class="fas fa-file-pdf"></i> Exportar Relatório';
            });
        });
    }
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
            
            if (pageTitle) pageTitle.textContent = getPageTitle(pageId);
            currentPage = pageId;
            
            document.getElementById('globalFilters').style.display = (pageId === 'configuracoes') ? 'none' : 'flex';
            // Re-renderizar gráficos Echarts que possam ter quebrado no display: none
            setTimeout(() => {
                if (driverChart) driverChart.resize();
                if (truckChart) truckChart.resize();
                if (timeChart) timeChart.resize();
                if (evolutionChart) evolutionChart.resize();
            }, 100);
        });
    });
}

function initMenuToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
}

function updateMetaTexts() {
    const lbl = document.getElementById('metaLabelDash');
    if(lbl) lbl.innerText = `Meta Operacional: ${currentMetaKML.toFixed(2)} KM/L`;
    
    const crit = document.getElementById('criticalDriversTitle');
    if(crit) crit.innerHTML = `<i class="fas fa-user-times"></i> Motoristas Críticos (< ${currentMetaKML.toFixed(2)} KM/L)`;
}

function updateStatsCards() {
    const el = (id, val, colorVal) => {
        const e = document.getElementById(id);
        if (e) { e.innerHTML = val; if (colorVal !== undefined) e.style.color = colorVal; }
    };
    
    const cColor = dashboardData.avgConsumption < currentMetaKML && dashboardData.avgConsumption > 0 ? '#f87171' : '#34d399';
    el('avgConsumption', `${dashboardData.avgConsumption.toFixed(2)} KM/L`, cColor);
    
    el('totalDistance', `${Math.round(dashboardData.totalDist).toLocaleString('pt-BR')} KM`);
    el('totalFuel', `${Math.round(dashboardData.totalFuel).toLocaleString('pt-BR')} L`);
}

function renderTables(viagens) {
    const rBody = document.getElementById('rankingTableBody');
    if (rBody) {
        if (dashboardData.drivers.length === 0) {
            rBody.innerHTML = '<tr><td colspan="6" class="text-center text-warning">Sem dados de motoristas no período.</td></tr>';
        } else {
            rBody.innerHTML = dashboardData.drivers.map((d, index) => {
                const kml = parseFloat(d.realKML) || 0;
                const isCritical = kml > 0 && kml < currentMetaKML;
                const statusHtml = isCritical ? `<span class="status-badge danger">Abaixo da Meta</span>` : `<span class="status-badge success" style="background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2);">Na Meta</span>`;
                
                let rankTrophy = `${index + 1}`;
                if (index === 0) rankTrophy = `<i class="fas fa-trophy" style="color: #fbbf24; font-size: 1.2rem;"></i> 1`;
                else if (index === 1) rankTrophy = `<i class="fas fa-medal" style="color: #94a3b8; font-size: 1.1rem;"></i> 2`;
                else if (index === 2) rankTrophy = `<i class="fas fa-medal" style="color: #b45309; font-size: 1.1rem;"></i> 3`;
                
                return `<tr>
                    <td style="font-weight:bold; font-size: 1rem;">${rankTrophy}</td>
                    <td style="font-weight:600; color:#e2e8f0;">${d.name}</td>
                    <td class="${isCritical ? 'text-danger' : 'text-success'}">${kml.toFixed(2)} KM/L</td>
                    <td>${Math.round(d.dist).toLocaleString('pt-BR')} KM</td>
                    <td>${d.trips}</td>
                    <td>${statusHtml}</td>
                </tr>`;
            }).join('');
        }
    }
    
    const dBody = document.getElementById('driversTableBody');
    if (dBody) {
        if (dashboardData.criticalDrivers.length === 0) {
            dBody.innerHTML = '<tr><td colspan="3" class="text-center text-success">Excelente. Sem motoristas na zona vermelha.</td></tr>';
        } else {
            dBody.innerHTML = dashboardData.criticalDrivers.slice(0, 10).map(d => `<tr><td style="font-weight:600;">${d.name}</td><td class="text-danger">${d.realKML.toFixed(2)}</td><td>${Math.round(d.dist)}</td></tr>`).join('');
        }
    }
    
    const aBody = document.getElementById('alertsTableBody');
    if (aBody) {
        if (dashboardData.alerts.length === 0) {
            aBody.innerHTML = '<tr><td colspan="4" class="text-center text-success">Nenhuma frota registrada no período.</td></tr>';
        } else {
            aBody.innerHTML = dashboardData.alerts.map(a => {
                let badgeClass = 'success';
                let badgeStyle = '';
                if (a.peso === 3 || a.issue === 'Alto Consumo') {
                    badgeClass = 'danger';
                } else if (a.issue === 'Baixa Rodagem') {
                    badgeClass = 'warning';
                } else {
                    badgeStyle = 'style="background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2);"';
                }
                const tripsColor = a.trips < currentMetaViagens ? 'text-warning' : 'text-success';
                const kmlColor = a.kml < currentMetaKML ? 'text-danger' : 'text-success';
                return `<tr>
                    <td style="font-weight: 600;">${a.placa}</td>
                    <td class="${tripsColor}">${a.trips.toFixed(1)}</td>
                    <td class="${kmlColor}">${a.kml.toFixed(2)}</td>
                    <td><span class="status-badge ${badgeClass}" ${badgeStyle}>${a.issue}</span></td>
                </tr>`;
            }).join('');
        }
    }
    
    const hBody = document.getElementById('historyTableBody');
    if (hBody) {
        const formatDT = (iso) => {
            if (!iso) return '--';
            const d = new Date(iso);
            const pad = n => String(n).padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        const recentViagens = [...viagens].reverse().slice(0, 1000);
        if (recentViagens.length === 0) {
            hBody.innerHTML = '<tr><td colspan="6" class="text-center text-warning">Sem dados para este período.</td></tr>';
        } else {
            hBody.innerHTML = recentViagens.map(v => {
                const kml = parseFloat(v.km_l) || 0;
                const kmlClass = kml > 0 && kml < currentMetaKML ? 'text-danger' : 'text-success';
                return `<tr>
                    <td>${formatDT(v.inicio)}</td>
                    <td>${formatDT(v.fim)}</td>
                    <td style="font-weight:600; color:#e2e8f0;">${v.placa}</td>
                    <td>${v.motorista}</td>
                    <td>${v.distancia_km} km</td>
                    <td class="${kmlClass}">${kml.toFixed(2)}</td>
                </tr>`;
            }).join('');
        }
    }
}

// Renderiza a Aba "Indicadores Suzano"
function renderSuzanoTab(viagens) {
    let totalCo2 = 0;
    let totalEventos = 0;
    const driverMap = new Map();
    viagens.forEach(v => {
        const co2 = parseFloat(v.co2_kg) || 0;
        const eventos = parseInt(v.total_eventos) || 0;
        totalCo2 += co2;
        totalEventos += eventos;
        const dName = v.motorista || 'Indefinido';
        if (!driverMap.has(dName)) {
            driverMap.set(dName, { co2: 0, eventos: 0, maxVel: 0, rpmVermelho: 0, count: 0 });
        }
        const data = driverMap.get(dName);
        data.co2 += co2;
        data.eventos += eventos;
        data.maxVel = Math.max(data.maxVel, parseFloat(v.velocidade_maxima) || 0);
        data.rpmVermelho = Math.max(data.rpmVermelho, parseFloat(v.rpm_vermelha_perc) || 0);
        data.count++;
    });
    const eTotalCo2 = document.getElementById('totalCo2');
    if (eTotalCo2) eTotalCo2.innerText = totalCo2.toLocaleString('pt-BR', {maximumFractionDigits: 2});
    
    const eTotalEvt = document.getElementById('totalEventos');
    if (eTotalEvt) eTotalEvt.innerText = totalEventos;
    const sBody = document.getElementById('suzanoTableBody');
    if (sBody) {
        const arr = Array.from(driverMap.entries()).map(([name, d]) => ({
            name, co2: d.co2, maxVel: d.maxVel, rpm: d.rpmVermelho, eventos: d.eventos
        })).sort((a, b) => b.co2 - a.co2); // O poluidor chefe em cima
        if (arr.length === 0) {
            sBody.innerHTML = '<tr><td colspan="5" class="text-center text-warning">Sem dados de telemetria no período.</td></tr>';
        } else {
            sBody.innerHTML = arr.map(d => `
                <tr>
                    <td style="font-weight:600; color:#e2e8f0;">${d.name}</td>
                    <td class="${d.co2 > 500 ? 'text-danger' : 'text-success'}">${d.co2.toFixed(2)} Kg</td>
                    <td class="${d.maxVel > 80 ? 'text-danger' : 'text-success'}">${d.maxVel.toFixed(1)} km/h</td>
                    <td class="${d.rpm > 5 ? 'text-danger' : 'text-success'}">${d.rpm.toFixed(1)}%</td>
                    <td class="${d.eventos > 10 ? 'text-danger' : 'text-success'}">${d.eventos}</td>
                </tr>
            `).join('');
        }
    }
}

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

// ==== INTEGRAÇÃO ECHARTS ====
function renderDashboardCharts(viagens) {
    const dt = dashboardData.drivers.slice(0, 10);
    
    if (driverChart) driverChart.dispose();
    driverChart = echarts.init(document.getElementById('driverConsumptionChart'));
    driverChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: dt.map(d => d.name.substring(0, 12) + '...'), axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(51,65,85,0.3)' } }, axisLabel: { color: '#94a3b8' } },
        series: [{
            data: dt.map(d => ({ value: d.realKML, itemStyle: { color: d.realKML < currentMetaKML ? '#ef4444' : '#10b981' } })),
            type: 'bar', barWidth: '50%', itemStyle: { borderRadius: [6, 6, 0, 0] }
        }]
    });
    
    if (truckChart) truckChart.dispose();
    const tt = dashboardData.trucks.slice(0, 10);
    truckChart = echarts.init(document.getElementById('truckConsumptionChart'));
    truckChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: tt.map(t => t.plate), axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(51,65,85,0.3)' } }, axisLabel: { color: '#94a3b8' } },
        series: [{
            data: tt.map(t => ({ value: t.realKML, itemStyle: { color: t.realKML < currentMetaKML ? '#ef4444' : '#3b82f6' } })),
            type: 'bar', barWidth: '50%', itemStyle: { borderRadius: [6, 6, 0, 0] }
        }]
    });
    
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
    
    if (timeChart) timeChart.dispose();
    timeChart = echarts.init(document.getElementById('timeDistributionChart'));
    timeChart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c}h' },
        series: [{
            type: 'pie', radius: ['60%', '80%'], avoidLabelOverlap: false,
            label: { show: false },
            data: [
                { value: hrsConducao.toFixed(1), name: 'Tempo Condução', itemStyle: { color: '#3b82f6' } },
                { value: hrsParado.toFixed(1), name: 'Tempo Parado', itemStyle: { color: '#f59e0b' } }
            ]
        }]
    });
}

function renderEvolutionChartLogic(viagens, selMot, selPlac) {
    const dailyMap = new Map();
    viagens.forEach(v => {
        if (!v.distancia_km || v.distancia_km <= 0) return;
        
        let litros = 0;
        if (v.litros_gastos && parseFloat(v.litros_gastos) > 0) {
            litros = parseFloat(v.litros_gastos);
        } else if (v.km_l && parseFloat(v.km_l) > 0) {
            litros = parseFloat(v.distancia_km) / parseFloat(v.km_l);
        }
        if (litros <= 0) return;
        const date = new Date(v.inicio);
        const key = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!dailyMap.has(key)) dailyMap.set(key, { dist: 0, litros: 0, dateObj: date });
        
        const m = dailyMap.get(key);
        m.dist += parseFloat(v.distancia_km);
        m.litros += litros;
    });
    
    const sortedKeys = Array.from(dailyMap.keys()).sort((a, b) => dailyMap.get(a).dateObj - dailyMap.get(b).dateObj);
    const values = sortedKeys.map(k => { const m = dailyMap.get(k); return m.litros > 0 ? (m.dist / m.litros).toFixed(2) : 0; });
    
    const canvas = document.getElementById('evolutionChart');
    if (!canvas) return;
    
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
    if (evolutionChart) evolutionChart.dispose();
    evolutionChart = echarts.init(canvas);
    evolutionChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: sortedKeys.length ? sortedKeys : ['--'], axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(51,65,85,0.3)' } }, axisLabel: { color: '#94a3b8' }, min: 'dataMin' },
        series: [
            {
                name: 'KM/L Real', type: 'line', data: values.length ? values : [0], smooth: true,
                itemStyle: { color: '#34d399' }, areaStyle: { color: 'rgba(52, 211, 153, 0.1)' },
                label: { show: true, position: 'top', color: '#fff', formatter: (params) => params.value > 0 ? params.value : '' }
            },
            {
                name: 'Meta', type: 'line', data: sortedKeys.length ? Array(sortedKeys.length).fill(currentMetaKML) : [currentMetaKML],
                lineStyle: { type: 'dashed', color: '#fbbf24' }, symbol: 'none'
            }
        ]
    });
}

window.addEventListener('resize', () => {
    if (driverChart) driverChart.resize();
    if (truckChart) truckChart.resize();
    if (timeChart) timeChart.resize();
    if (evolutionChart) evolutionChart.resize();
});

function showEmptyDashboard() {
    document.querySelectorAll('.stat-card p').forEach(p => p.innerHTML = '--');
    
    ['alertsTableBody', 'driversTableBody', 'historyTableBody', 'rankingTableBody', 'suzanoTableBody'].forEach(id => {
        const e = document.getElementById(id);
        const cols = id === 'historyTableBody' || id === 'rankingTableBody' ? 6 : (id === 'alertsTableBody' ? 4 : (id === 'suzanoTableBody' ? 5 : 3));
        if (e) e.innerHTML = `<tr><td colspan="${cols}" class="text-center text-warning">Sem dados para este período e/ou filtros.</td></tr>`;
    });
    
    const ids = ['totConducao', 'totParado', 'totalCo2', 'totalEventos'];
    ids.forEach(i => { if(document.getElementById(i)) document.getElementById(i).innerText = (i.includes('Conducao') || i.includes('Parado')) ? '--h' : '--'; });
    const meds = ['medConducao', 'medParado'];
    meds.forEach(i => { if(document.getElementById(i)) document.getElementById(i).innerText = 'Média: --h / viag'; });
    
    if(document.getElementById('centerEficiencia')) document.getElementById('centerEficiencia').innerText = '--%';
    
    if (driverChart) driverChart.dispose();
    if (truckChart) truckChart.dispose();
    if (timeChart) timeChart.dispose();
    if (evolutionChart) evolutionChart.dispose();
}

function showDashboardError() {
    const tbody = document.getElementById('alertsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro de conexão.</td></tr>';
}