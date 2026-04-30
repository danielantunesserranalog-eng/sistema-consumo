// Arquivo: js/app.js
const supabaseUrl = window.ENV.SUPABASE_URL;
const supabaseKey = window.ENV.SUPABASE_KEY;
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

window.app = (function() {
    async function init() {
        const currentPath = window.location.pathname.toLowerCase();
        const isPage = (name) => currentPath.includes(name) || (name === 'index' && (currentPath.endsWith('/') || currentPath.endsWith('index.html')));

        if (window.settingsModule) await window.settingsModule.load();

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        if (isPage('index')) {
            if (window.cavalosModule) await window.cavalosModule.load();
            if (window.ocorrenciasModule) await window.ocorrenciasModule.load();
            if (window.driversModule) await window.driversModule.load();
            if (window.tripsModule) {
                await window.tripsModule.load(startOfMonth, endOfMonth);
            }
            
            const cavaloFilter = document.getElementById('dashboard-cavalo-filter');
            if (cavaloFilter) {
                cavaloFilter.addEventListener('change', updateDashboard);
            }
            
            updateDashboard();
        } 
        else if (isPage('cavalos')) {
            if (window.cavalosModule) await window.cavalosModule.load();
        } 
        else if (isPage('motoristas')) {
            if (window.driversModule) await window.driversModule.load();
        } 
        else if (isPage('ocorrencias')) {
            if (window.cavalosModule) await window.cavalosModule.load();
            if (window.driversModule) await window.driversModule.load();
            if (window.ocorrenciasModule) await window.ocorrenciasModule.load();
        } 
        else if (isPage('importar') || isPage('historico')) {
            if (window.tripsModule) await window.tripsModule.load(startOfMonth, endOfMonth);
        } 
        else if (isPage('ranking')) {
            if (window.ocorrenciasModule) await window.ocorrenciasModule.load();
            if (window.driversModule) await window.driversModule.load();
            if (window.rankingModule) window.rankingModule.render();
        }
    }

    function updateDashboard() {
        const filterSelect = document.getElementById('dashboard-cavalo-filter');
        const selectedPlaca = filterSelect ? filterSelect.value : '';

        const drivers = window.driversModule ? window.driversModule.getAll() : [];
        let allTrips = window.tripsModule ? window.tripsModule.getAll() : [];
        const ocorrencias = window.ocorrenciasModule ? window.ocorrenciasModule.getAll() : [];
        const cavalos = window.cavalosModule ? window.cavalosModule.getAll() : [];
        
        // Pega a meta geral configurada (padrão 3.0 se não achar)
        const goal = window.settingsModule ? (window.settingsModule.get().globalGoal || 3.0) : 3.0;
        const getColor = (kml) => kml > 0 ? (kml < goal ? '#f87171' : '#10b981') : '#94a3b8';

        if (filterSelect && filterSelect.options.length <= 1) {
            const uniquePlacas = [...new Set(allTrips.map(t => t.placa).filter(Boolean))].sort();
            uniquePlacas.forEach(p => {
                const cav = cavalos.find(c => c.placa === p);
                const label = cav ? `${p} (Conjunto: ${cav.conjunto})` : p;
                filterSelect.innerHTML += `<option value="${p}">${label}</option>`;
            });
        }

        let filteredTrips = allTrips;
        if (selectedPlaca) {
            filteredTrips = allTrips.filter(t => t.placa === selectedPlaca);
        }

        const totalDriversEl = document.getElementById('total-drivers');
        const totalTripsEl = document.getElementById('total-trips');
        const avgEconomyEl = document.getElementById('avg-economy');
        const topDriverEl = document.getElementById('top-driver');
        
        if (totalDriversEl) totalDriversEl.textContent = drivers.length;
        if (totalTripsEl) totalTripsEl.textContent = filteredTrips.length;
        
        if (avgEconomyEl) {
            const sumDistance = filteredTrips.reduce((sum, t) => sum + (parseFloat(t.distancia_km) || 0), 0);
            const sumLiters = filteredTrips.reduce((sum, t) => sum + (parseFloat(t.total_litros) || 0), 0);
            const globalAvg = sumLiters > 0 ? (sumDistance / sumLiters) : 0;
            avgEconomyEl.textContent = utils.formatNumber(globalAvg);
            avgEconomyEl.style.color = getColor(globalAvg);
        }

        const driverStats = {};
        filteredTrips.forEach(t => {
            const driverName = t.motorista || 'Não Identificado';
            if (!driverStats[driverName]) driverStats[driverName] = { distance: 0, liters: 0 };
            driverStats[driverName].distance += parseFloat(t.distancia_km) || 0;
            driverStats[driverName].liters += parseFloat(t.total_litros) || 0;
        });

        const driverArray = Object.keys(driverStats).map(name => {
            const stat = driverStats[name];
            const kml = stat.liters > 0 ? (stat.distance / stat.liters) : 0;
            return { name, distance: stat.distance, liters: stat.liters, kml };
        }).filter(d => d.distance > 0);

        driverArray.sort((a, b) => b.kml - a.kml);

        if (topDriverEl) {
            const now = new Date();
            const eligibleForHighlight = driverArray.filter(d => {
                const hasOcorrenciaMes = ocorrencias.some(oc => {
                    const ocDate = new Date(oc.data + 'T00:00:00');
                    return oc.motorista === d.name && ocDate.getMonth() === now.getMonth() && ocDate.getFullYear() === now.getFullYear();
                });
                return !hasOcorrenciaMes;
            });
            topDriverEl.textContent = eligibleForHighlight.length > 0 ? eligibleForHighlight[0].name : '-';
        }

        const top5Tbody = document.getElementById('top5-list');
        if (top5Tbody) {
            const top5 = driverArray.slice(0, 5);
            top5Tbody.innerHTML = top5.map(d => `<tr><td style="font-weight:500;">${d.name}</td><td style="color: ${getColor(d.kml)}; font-weight: bold;">${utils.formatNumber(d.kml)}</td><td>${utils.formatNumber(d.distance, 0)} km</td></tr>`).join('') || '<tr><td colspan="3" class="text-center">Sem dados de viagens</td></tr>';
        }

        const bottom5Tbody = document.getElementById('bottom5-list');
        if (bottom5Tbody) {
            const bottom5 = [...driverArray].filter(d => d.kml > 0).sort((a, b) => a.kml - b.kml).slice(0, 5);
            bottom5Tbody.innerHTML = bottom5.map(d => `<tr><td style="font-weight:500;">${d.name}</td><td style="color: ${getColor(d.kml)}; font-weight: bold;">${utils.formatNumber(d.kml)}</td><td>${utils.formatNumber(d.distance, 0)} km</td></tr>`).join('') || '<tr><td colspan="3" class="text-center">Sem dados de viagens</td></tr>';
        }

        const dashDriversTbody = document.getElementById('dash-drivers-list');
        if (dashDriversTbody) {
            dashDriversTbody.innerHTML = driverArray.map(d => `<tr><td style="font-weight:500; color: #f8fafc;">${d.name}</td><td>${utils.formatNumber(d.distance, 0)}</td><td style="color: ${getColor(d.kml)}; font-weight: bold;">${utils.formatNumber(d.kml)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-center">Nenhuma viagem registrada</td></tr>';
        }

        const cavaloStats = {};
        filteredTrips.forEach(t => {
            const p = t.placa || 'Sem Placa';
            if (!cavaloStats[p]) cavaloStats[p] = { distance: 0, liters: 0 };
            cavaloStats[p].distance += parseFloat(t.distancia_km) || 0;
            cavaloStats[p].liters += parseFloat(t.total_litros) || 0;
        });

        const cavaloArray = Object.keys(cavaloStats).map(placa => {
            const stat = cavaloStats[placa];
            const kml = stat.liters > 0 ? (stat.distance / stat.liters) : 0;
            const cav = cavalos.find(c => c.placa === placa);
            const conjuntoLabel = cav ? cav.conjunto : '-';
            return { placa, conjunto: conjuntoLabel, distance: stat.distance, liters: stat.liters, kml };
        }).filter(c => c.distance > 0).sort((a, b) => b.kml - a.kml);

        const dashCavalosTbody = document.getElementById('dash-cavalos-list');
        if (dashCavalosTbody) {
            dashCavalosTbody.innerHTML = cavaloArray.map(c => `<tr><td><strong style="color:#f8fafc;">${c.placa}</strong> <br><span style="font-size: 0.75rem; color: #94a3b8;">Conjunto: ${c.conjunto}</span></td><td>${utils.formatNumber(c.distance, 0)}</td><td style="color: ${getColor(c.kml)}; font-weight: bold;">${utils.formatNumber(c.kml)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-center">Nenhuma viagem registrada</td></tr>';
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return { updateDashboard };
})();