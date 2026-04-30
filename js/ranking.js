// Ranking module
window.rankingModule = (function() {
    function render() {
        const drivers = window.driversModule ? window.driversModule.getAll() : [];
        const ocorrencias = JSON.parse(localStorage.getItem('motorista_padrao_ocorrencias')) || [];
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Zera a chance de quem tem ocorrência no mês atual de entrar no Hall da Fama
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

        const sortedDrivers = [...eligibleDrivers]
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 10);
                 
        const rankingContainer = document.getElementById('ranking-list');
        if (!rankingContainer) return;
                 
        if (sortedDrivers.length === 0) {
            rankingContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #94a3b8;">
                    <i class="fas fa-trophy" style="font-size: 3rem; color: #3b82f6; margin-bottom: 1rem;"></i>
                    <p>Nenhum motorista elegível para o Hall da Fama neste mês.</p>
                </div>
            `;
            return;
        }

        let html = '<div class="podium-wrapper"><div class="podium-container">';

        // Extrai os 3 primeiros para o pódio (reordena a exibição: 2, 1, 3)
        const top3 = sortedDrivers.slice(0, 3);
        const podiumOrder = [];
        if(top3[1]) podiumOrder.push({driver: top3[1], rank: 2});
        if(top3[0]) podiumOrder.push({driver: top3[0], rank: 1});
        if(top3[2]) podiumOrder.push({driver: top3[2], rank: 3});

        podiumOrder.forEach(item => {
            const d = item.driver;
            const r = item.rank;
            html += `
                <div class="podium-card rank-${r}">
                    <div class="rank-badge">${r}º</div>
                    <div class="podium-avatar"><i class="fas fa-user"></i></div>
                    <div class="podium-name">${escapeHtml(d.name)}</div>
                    <div class="podium-kml">${utils.formatNumber(d.avgEconomy)} <span style="font-size: 1rem; color: #94a3b8;">km/L</span></div>
                    <div class="podium-stats">
                        <div class="p-stat"><span>Pontos</span><strong>${Math.round(d.score || 0)}</strong></div>
                        <div class="p-stat"><span>Distância</span><strong>${utils.formatNumber(d.totalDistance, 0)} km</strong></div>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';

        // Restantes da lista (4º em diante)
        const remaining = sortedDrivers.slice(3);
        if (remaining.length > 0) {
            html += '<div style="margin-top: 20px; max-width: 800px; margin-left: auto; margin-right: auto;">';
            remaining.forEach((driver, idx) => {
                html += `
                    <div class="ranking-list-item">
                        <div class="ranking-list-pos">${idx + 4}º</div>
                        <div class="ranking-list-info">
                            <div class="ranking-list-name">${escapeHtml(driver.name)}</div>
                            <div class="ranking-list-stats">
                                <span><i class="fas fa-tachometer-alt"></i> ${utils.formatNumber(driver.avgEconomy)} km/L</span>
                                <span><i class="fas fa-road"></i> ${utils.formatNumber(driver.totalDistance, 0)} km</span>
                            </div>
                        </div>
                        <div class="ranking-list-score">${Math.round(driver.score || 0)} pts</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        rankingContainer.innerHTML = html;
    }
         
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
         
    return {
        render
    };
})();