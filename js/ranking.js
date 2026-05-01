window.rankingModule = (function() {
    function render() {
        const drivers = window.driversModule ? window.driversModule.getAll() : [];
        const ocorrencias = window.ocorrenciasModule ? window.ocorrenciasModule.getAll() : [];
        
        // Função para converter qualquer vírgula em ponto de forma 100% segura
        const parseNumber = (val) => {
            if (!val) return 0;
            return parseFloat(String(val).replace(',', '.')) || 0;
        };
        
        const goal = window.settingsModule ? parseNumber(window.settingsModule.get().globalGoal || 3.0) : 3.0;
        
        const getColor = (kml) => {
            const numKml = parseNumber(kml);
            if (numKml <= 0) return '#94a3b8';
            if (numKml >= goal) return '#10b981'; // Maior ou igual = Verde
            return '#f87171'; // Menor = Vermelho
        };
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const DISTANCIA_MINIMA_QUALIFICACAO = 1000; 
        
        const eligibleDrivers = drivers.filter(driver => {
            if ((driver.total_distance || 0) < DISTANCIA_MINIMA_QUALIFICACAO) {
                return false;
            }
            const hasOcorrenciaMes = ocorrencias.some(oc => {
                if (oc.motorista === driver.name) {
                    const ocDate = new Date(oc.data + 'T00:00:00');
                    return ocDate.getMonth() === currentMonth && ocDate.getFullYear() === currentYear;
                }
                return false;
            });
            return !hasOcorrenciaMes;
        });

        const maxDistance = Math.max(...eligibleDrivers.map(d => d.total_distance || 0), 1);
        const maxKML = Math.max(...eligibleDrivers.map(d => d.avg_economy || 0), 1);

        const PESO_KML = 0.70;
        const PESO_DIST = 0.30;

        eligibleDrivers.forEach(d => {
            const kmlRatio = (d.avg_economy || 0) / maxKML;
            const distRatio = (d.total_distance || 0) / maxDistance;
            d.indiceDesempenho = Math.round(((kmlRatio * PESO_KML) + (distRatio * PESO_DIST)) * 1000);
        });
        
        const sortedDrivers = [...eligibleDrivers]
            .sort((a, b) => (b.indiceDesempenho || 0) - (a.indiceDesempenho || 0))
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
                    <div class="rank-badge">${r}</div>
                    <div class="podium-avatar"><i class="fas fa-user"></i></div>
                    <div class="podium-name">${escapeHtml(d.name)}</div>
                    <div class="podium-kml" style="color: ${getColor(d.avg_economy)};">${utils.formatNumber(d.avg_economy)} <span style="font-size: 1rem; color: #94a3b8;">km/L</span></div>
                    <div class="podium-stats">
                        <div class="p-stat"><span>Índice</span><strong>${d.indiceDesempenho} pts</strong></div>
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
                        <div class="ranking-list-pos">${idx + 4}</div>
                        <div class="ranking-list-info">
                            <div class="ranking-list-name">${escapeHtml(driver.name)}</div>
                            <div class="ranking-list-stats">
                                <span style="color: ${getColor(driver.avg_economy)}; font-weight: bold;"><i class="fas fa-tachometer-alt"></i> ${utils.formatNumber(driver.avg_economy)} km/L</span>
                                <span><i class="fas fa-road"></i> ${utils.formatNumber(driver.total_distance, 0)} km</span>
                            </div>
                        </div>
                        <div class="ranking-list-score" title="Índice Ponderado">${driver.indiceDesempenho} pts</div>
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