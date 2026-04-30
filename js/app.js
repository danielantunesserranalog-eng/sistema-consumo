// Main application
window.app = (function() {
    let currentPage = 'dashboard';
         
    function init() {
        setupNavigation();
        updateDashboard();
                 
        // Load all modules
        if (window.driversModule) {
            window.driversModule.load();
        }
        if (window.tripsModule) {
            window.tripsModule.load();
            window.tripsModule.renderRecentTrips();
        }
        if (window.rankingModule) {
            window.rankingModule.render();
        }
        if (window.settingsModule) {
            window.settingsModule.load();
        }
        if (window.cavalosModule) {
            window.cavalosModule.load();
        }
        if (window.ocorrenciasModule) {
            window.ocorrenciasModule.load();
        }
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
                                 
                if (pageTitle) {
                    pageTitle.textContent = titles[page] || 'Dashboard';
                }
                                 
                // Refresh data when changing pages
                if (page === 'ranking' && window.rankingModule) {
                    window.rankingModule.render();
                }
                if (page === 'drivers' && window.driversModule) {
                    window.driversModule.load();
                }
                if (page === 'cavalos' && window.cavalosModule) {
                    window.cavalosModule.load();
                }
                if (page === 'ocorrencias' && window.ocorrenciasModule) {
                    window.ocorrenciasModule.load();
                }
                if (page === 'import' && window.tripsModule) {
                    window.tripsModule.load();
                }
                if (page === 'historico' && window.tripsModule) {
                    window.tripsModule.renderHistorico();
                }
            });
        });
    }
         
    function updateDashboard() {
        const drivers = window.driversModule ? window.driversModule.getAll() : [];
        const trips = window.tripsModule ? window.tripsModule.getAll() : [];
        const ocorrencias = JSON.parse(localStorage.getItem('motorista_padrao_ocorrencias')) || [];
                 
        const totalDrivers = document.getElementById('total-drivers');
        const totalTrips = document.getElementById('total-trips');
        const avgEconomy = document.getElementById('avg-economy');
        const topDriver = document.getElementById('top-driver');
                 
        if (totalDrivers) totalDrivers.textContent = drivers.length;
        if (totalTrips) totalTrips.textContent = trips.length;
                 
        if (avgEconomy) {
            const avg = trips.reduce((sum, t) => sum + (parseFloat(t['Km/l']) || 0), 0) / (trips.length || 1);
            avgEconomy.textContent = utils.formatNumber(avg);
        }
                 
        if (topDriver) {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // Filtro igual ao do Hall da Fama para o Dashboard
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
         
    return {
        updateDashboard
    };
})();