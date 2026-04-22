// ==================== INTERFACE DE USUÁRIO E GRÁFICOS ====================

Chart.defaults.color = '#94a3b8'; 
Chart.defaults.borderColor = 'rgba(51, 65, 85, 0.5)'; 
Chart.defaults.font.family = "'Inter', sans-serif"; 

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
            
            // Busca o título dinamicamente do menu.js
            if (pageTitle) pageTitle.textContent = getPageTitle(pageId);
            currentPage = pageId;
            
            document.getElementById('globalFilters').style.display = (pageId === 'configuracoes') ? 'none' : 'flex';
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
    
    const lblViag = document.getElementById('metaLabelViagens');
    if(lblViag) lblViag.innerText = `Meta: ${currentMetaViagens.toFixed(1)} por dia`;
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
    
    // Substituída a lógica de impressão para pegar a contagem do banco secundário
    el('totalTripsInfo', `${dashboardData.totalHistoricoTrips}`);
    
    const vColor = dashboardData.avgTripsPerDay < currentMetaViagens && dashboardData.avgTripsPerDay > 0 ? '#f87171' : '#34d399';
    el('avgTripsPerDay', `${dashboardData.avgTripsPerDay.toFixed(1)} /dia`, vColor);
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

    renderPodium();
}

// ======== LÓGICA DO PÓDIO (MOTORISTA DESTAQUE) ========
function renderPodium() {
    const podiumContainer = document.getElementById('podiumContainer');
    if (!podiumContainer) return;

    // REGRA: KM/L > 0 E Distância > 1000 km
    const topDrivers = dashboardData.drivers.filter(d => d.realKML > 0 && d.dist > 1000).slice(0, 3);

    if (topDrivers.length === 0) {
        podiumContainer.innerHTML = '<div class="text-center text-warning" style="width: 100%; margin-top: 50px;">Nenhum motorista atingiu a distância mínima de 1.000 KM no período selecionado.</div>';
        return;
    }

    let displayOrder = [];
    if (topDrivers.length === 3) displayOrder = [topDrivers[1], topDrivers[0], topDrivers[2]];
    else if (topDrivers.length === 2) displayOrder = [topDrivers[1], topDrivers[0]];
    else displayOrder = [topDrivers[0]];

    const rankClasses = { 0: 'rank-1', 1: 'rank-2', 2: 'rank-3' };
    const icons = { 0: '<i class="fas fa-trophy"></i>', 1: '<i class="fas fa-medal"></i>', 2: '<i class="fas fa-award"></i>' };

    podiumContainer.innerHTML = displayOrder.map(d => {
        const originalIndex = topDrivers.indexOf(d);
        const rankClass = rankClasses[originalIndex];
        const icon = icons[originalIndex];

        return `
            <div class="podium-card ${rankClass}">
                <div class="rank-badge">${icon}</div>
                <div class="podium-avatar"><i class="fas fa-user-astronaut"></i></div>
                <div class="podium-name">${d.name}</div>
                <div class="podium-kml">${d.realKML.toFixed(2)} <span style="font-size: 0.9rem; font-weight: 500; color: #94a3b8;">KM/L</span></div>
                <div class="podium-stats">
                    <div class="p-stat">
                        <span>Distância</span>
                        <strong>${Math.round(d.dist).toLocaleString('pt-BR')} km</strong>
                    </div>
                    <div class="p-stat">
                        <span>Viagens</span>
                        <strong>${d.trips}</strong>
                    </div>
                </div>
            </div>
        `;
    }).join('');
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