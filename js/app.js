// Arquivo: js/app.js
const supabaseUrl = window.ENV.SUPABASE_URL;
const supabaseKey = window.ENV.SUPABASE_KEY;
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

window.app = (function() {
    async function init() {
        const currentPath = window.location.pathname.toLowerCase();
        const isPage = (name) => currentPath.includes(name) || (name === 'index' && (currentPath.endsWith('/') || currentPath.endsWith('index.html')));

        // Carrega configurações globais necessárias em todas as páginas
        if (window.settingsModule) await window.settingsModule.load();

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        // Carrega os dados específicos dependendo da página em que o usuário está
        if (isPage('index')) {
            if (window.cavalosModule) await window.cavalosModule.load();
            if (window.ocorrenciasModule) await window.ocorrenciasModule.load();
            if (window.driversModule) await window.driversModule.load();
            if (window.tripsModule) {
                await window.tripsModule.load(startOfMonth, endOfMonth);
                window.tripsModule.renderRecentTrips();
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
            if (window.cavalosModule) await window.cavalosModule.load(); // Placas
            if (window.driversModule) await window.driversModule.load(); // Motoristas
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
        const drivers = window.driversModule ? window.driversModule.getAll() : [];
        const trips = window.tripsModule ? window.tripsModule.getAll() : [];
        const ocorrencias = window.ocorrenciasModule ? window.ocorrenciasModule.getAll() : [];
        
        const totalDrivers = document.getElementById('total-drivers');
        const totalTrips = document.getElementById('total-trips');
        const avgEconomy = document.getElementById('avg-economy');
        const topDriver = document.getElementById('top-driver');
        
        if (totalDrivers) totalDrivers.textContent = drivers.length;
        if (totalTrips) totalTrips.textContent = trips.length;
        
        if (avgEconomy) {
            const avg = trips.reduce((sum, t) => sum + (parseFloat(t.kml) || 0), 0) / (trips.length || 1);
            avgEconomy.textContent = utils.formatNumber(avg);
        }
        
        if (topDriver) {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            const eligibleDrivers = drivers.filter(driver => {
                if (driver.occurrences > 0) return false;
                const hasOcorrenciaMes = ocorrencias.some(oc => {
                    if (oc.motorista === driver.name) {
                        const ocDate = new Date(oc.data + 'T00:00:00');
                        return ocDate.getMonth() === currentMonth && ocDate.getFullYear() === currentYear;
                    }
                    return false;
                });
                return !hasOcorrenciaMes;
            });
            
            const bestDriver = [...eligibleDrivers].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
            topDriver.textContent = bestDriver ? bestDriver.name : '-';
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return { updateDashboard };
})();