// Configuração Global Supabase
const supabaseUrl = 'https://qhbenzrxajbeaatwxtlj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoYmVuenJ4YWpiZWFhdHd4dGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzQ2OTksImV4cCI6MjA5MjMxMDY5OX0.2ddgnsjmxqmX9xk68m9duUmzAO2n2OAvEpOgHevRwkU';
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

window.app = (function() {
    let currentPage = 'dashboard';

    async function init() {
        setupNavigation();
        
        // Carrega sequencialmente para garantir as dependências
        if (window.settingsModule) await window.settingsModule.load();
        if (window.cavalosModule) await window.cavalosModule.load();
        if (window.ocorrenciasModule) await window.ocorrenciasModule.load();
        if (window.tripsModule) await window.tripsModule.load();
        if (window.driversModule) await window.driversModule.load();

        if (window.tripsModule) window.tripsModule.renderRecentTrips();
        if (window.rankingModule) window.rankingModule.render();

        updateDashboard();
    }

    function setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-item');
        const pages = document.querySelectorAll('.page');
        const pageTitle = document.getElementById('pageTitle');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;

                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                pages.forEach(p => p.classList.remove('active'));
                document.getElementById(`${page}-page`).classList.add('active');

                currentPage = page;

                const titles = {
                    dashboard: 'Dashboard',
                    cavalos: 'Cavalos',
                    drivers: 'Motoristas',
                    ocorrencias: 'Ocorrências',
                    import: 'Importar Dados',
                    historico: 'Histórico',
                    ranking: 'Hall da Fama',
                    settings: 'Configurações'
                };

                if (pageTitle) pageTitle.textContent = titles[page] || 'Dashboard';

                if (page === 'ranking' && window.rankingModule) window.rankingModule.render();
                if (page === 'historico' && window.tripsModule) window.tripsModule.renderHistorico();
                if (page === 'dashboard') updateDashboard();
            });
        });
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
            const avg = trips.reduce((sum, t) => sum + (parseFloat(t['kml']) || 0), 0) / (trips.length || 1);
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