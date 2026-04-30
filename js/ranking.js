window.rankingModule = (function() {
    function render() {
        const drivers = window.driversModule ? window.driversModule.getAll() : [];
        const ocorrencias = window.ocorrenciasModule ? window.ocorrenciasModule.getAll() : [];
        
        const goal = window.settingsModule ? (window.settingsModule.get().globalGoal || 3.0) : 3.0;
        
        // CORREÇÃO AQUI
        const getColor = (kml) => {
            const roundedKml = parseFloat(parseFloat(kml).toFixed(2));
            return roundedKml > 0 ? (roundedKml < goal ? '#f87171' : '#10b981') : '#94a3b8';
        };
                 
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
                    <div class="podium-kml" style="color: ${getColor(d.avg_economy)};">${utils.formatNumber(d.avg_economy)} <span style="font-size: 1rem; color: #94a3b8;">km/L</span></div>
                    <div class="podium-stats">
                        <div class="p-stat"><span>Pontos</span><strong>${Math.round(d.score || 0)}</strong></div>
                        <div class="p-stat"><span>Distância</span><strong>${utils.formatNumber(d.total_distance, 0)} km</strong></div>
                    </div>
                </div>
            `;
        });
                 
        html += '</div></div>';
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
                                <span style="color: ${getColor(driver.avg_economy)}; font-weight: bold;"><i class="fas fa-tachometer-alt"></i> ${utils.formatNumber(driver.avg_economy)} km/L</span>
                                <span><i class="fas fa-road"></i> ${utils.formatNumber(driver.total_distance, 0)} km</span>
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
        const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }
    return { render };
})();