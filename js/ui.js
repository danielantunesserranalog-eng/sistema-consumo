// ==================== INTERFACE DE USUÁRIO E GRÁFICOS ==================== 

// Configuração Global Chart.js para Dark Mode
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
            
            const pageNames = { 'dashboard': 'Visão Geral da Frota', 'consumo-evolution': 'Histórico Detalhado', 'configuracoes': 'Gerenciamento de Dados' };             
            if (pageTitle) pageTitle.textContent = pageNames[pageId] || 'CCOL_SISTEMA';             
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
    el('avgTripsPerDay', `${dashboardData.avgTripsPerDay.toFixed(1)} viag/d`); 
    el('totalTripsInfo', `${rawData.length}`); 
}

function renderTables(viagens) {     
    
    // 1. Tabela Nova: Ranking Geral de Motoristas
    const rBody = document.getElementById('rankingTableBody');
    if (rBody) {
        if (dashboardData.drivers.length === 0) {
            rBody.innerHTML = '<tr><td colspan="5" class="text-center text-warning">Sem dados de motoristas no período.</td></tr>';
        } else {
            rBody.innerHTML = dashboardData.drivers.map((d, index) => {
                const kml = parseFloat(d.realKML) || 0;
                const isCritical = kml > 0 && kml < currentMetaKML;
                
                // Selos de Status
                const statusHtml = isCritical 
                    ? `<span class="status-badge danger">Abaixo da Meta</span>` 
                    : `<span class="status-badge success" style="background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2);">Na Meta</span>`;
                
                // Ícones de Posição
                let rankTrophy = `${index + 1}º`;
                if (index === 0) rankTrophy = `<i class="fas fa-trophy" style="color: #fbbf24; font-size: 1.2rem;"></i> 1º`;
                else if (index === 1) rankTrophy = `<i class="fas fa-medal" style="color: #94a3b8; font-size: 1.1rem;"></i> 2º`;
                else if (index === 2) rankTrophy = `<i class="fas fa-medal" style="color: #b45309; font-size: 1.1rem;"></i> 3º`;

                return `<tr>
                    <td style="font-weight:bold; font-size: 1rem;">${rankTrophy}</td>
                    <td style="font-weight:600; color:#e2e8f0;">${d.name}</td>
                    <td class="${isCritical ? 'text-danger' : 'text-success'}">${kml.toFixed(2)} KM/L</td>
                    <td>${Math.round(d.dist).toLocaleString('pt-BR')} KM</td>
                    <td>${statusHtml}</td>
                </tr>`;
            }).join('');
        }
    }

    // 2. Tabela de Motoristas Críticos (Piores)
    const dBody = document.getElementById('driversTableBody');
    if (dBody) {
        if (dashboardData.criticalDrivers.length === 0) dBody.innerHTML = '<tr><td colspan="3" class="text-center text-success">Excelente. Sem motoristas na zona vermelha.</td></tr>';
        else dBody.innerHTML = dashboardData.criticalDrivers.slice(0, 10).map(d => `<tr><td style="font-weight:600;">${d.name}</td><td class="text-danger">${d.realKML.toFixed(2)}</td><td>${Math.round(d.dist)}</td></tr>`).join('');
    }

    // 3. Tabela de Alertas de Equipamentos
    const aBody = document.getElementById('alertsTableBody');     
    if (aBody) {
        if (dashboardData.alerts.length === 0) aBody.innerHTML = '<tr><td colspan="3" class="text-center text-success">Nenhum alerta de frota pendente.</td></tr>'; 
        else aBody.innerHTML = dashboardData.alerts.slice(0, 10).map(a => `<tr><td style="font-weight: 600;">${a.placa}</td><td class="${parseFloat(a.trips) < 2 ? 'text-warning' : ''}">${a.trips}</td><td><span class="status-badge ${a.issue === 'Alto Consumo' ? 'danger' : 'warning'}">${a.issue}</span></td></tr>`).join(''); 
    }

    // 4. Tabela de Histórico Detalhado (Aba 2)
    const hBody = document.getElementById('historyTableBody');
    if (hBody) {
        const formatDT = (iso) => {
            if (!iso) return '--';
            const d = new Date(iso);
            const pad = n => String(n).padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        const recentViagens = [...viagens].reverse().slice(0, 500);

        if (recentViagens.length === 0) {
            hBody.innerHTML = '<tr><td colspan="6" class="text-center text-warning">Sem dados para este período.</td></tr>';
        } else {
            const rows = recentViagens.map(v => {
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
            hBody.innerHTML = rows;
        }
    }
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
    let campo = 0, fabrica = 0;         
    viagens.forEach(v => {             
        const total = (parseInterval(v.tempo_conducao) + parseInterval(v.tempo_parado));             
        const isF = (v.local_inicial || '').toLowerCase().includes('mucuri') || (v.local_final || '').toLowerCase().includes('mucuri');             
        if (isF) fabrica += total; else if (total > 0) campo += total;         
    });         
    if (campo === 0 && fabrica === 0) { campo = 1; fabrica = 1; }         
    timeChart = new Chart(document.getElementById('timeDistributionChart').getContext('2d'), { 
        type: 'doughnut', 
        data: { labels: ['Tempo Campo (Operação)', 'Tempo Fábrica (Ocioso)'], datasets: [{ data: [campo, fabrica], backgroundColor: ['#3b82f6', '#f59e0b'], borderWidth: 0, hoverOffset: 4 }] }, 
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
    
    let title = 'Frota Geral';
    if (type !== 'all' && value && value !== 'all') title = `${type === 'motorista' ? 'Motorista' : 'Equipamento'}: ${value}`;

    evolutionChart = new Chart(canvas.getContext('2d'), { 
        type: 'line', 
        data: { 
            labels: sortedKeys.length ? sortedKeys : ['Sem dados'], 
            datasets: [{ 
                label: title + ' - KM/L Real', 
                data: values.length ? values : [0], 
                borderColor: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.1)', 
                borderWidth: 3, fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#0f172a' 
            }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false, suggestedMin: 1.0, grid: { color: 'rgba(51,65,85,0.3)' } }, x: { grid: { display: false } } } } 
    }); 
}

function showEmptyDashboard() {     
    document.querySelectorAll('.stat-card p').forEach(p => p.innerHTML = '--');     
    ['alertsTableBody', 'driversTableBody', 'historyTableBody', 'rankingTableBody'].forEach(id => {
        const e = document.getElementById(id); if (e) e.innerHTML = '<tr><td colspan="6" class="text-center text-warning">Sem dados para este período.</td></tr>';
    });
    if (driverChart) driverChart.destroy();
    if (truckChart) truckChart.destroy();
    if (timeChart) timeChart.destroy();
    if (evolutionChart) evolutionChart.destroy();
}

function showDashboardError() {     
    const tbody = document.getElementById('alertsTableBody');     
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro de conexão.</td></tr>'; 
}