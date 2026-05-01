window.filterGerencial = function() {
    const term = document.getElementById('gerencial-search').value.toLowerCase();
    const rows = document.querySelectorAll('.gerencial-row');
    rows.forEach(row => {
        const name = row.getAttribute('data-name').toLowerCase();
        row.style.display = name.includes(term) ? '' : 'none';
    });
};

window.auditoriaModule = (function() {
    function render() {
        const drivers = window.driversModule ? window.driversModule.getAll() : [];
        const ocorrencias = window.ocorrenciasModule ? window.ocorrenciasModule.getAll() : [];
        
        const parseNumber = (val) => {
            if (!val) return 0;
            return parseFloat(String(val).replace(',', '.')) || 0;
        };

        const goal = window.settingsModule ? parseNumber(window.settingsModule.get().globalGoal || 1.8) : 1.8;

        const getColor = (kml) => {
            const numKml = parseNumber(kml);
            if (numKml <= 0) return '#94a3b8';
            
            const roundedKml = Number(numKml.toFixed(2));
            const roundedGoal = Number(goal.toFixed(2));
            
            if (roundedKml >= roundedGoal) return '#10b981'; 
            return '#f87171'; 
        };

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const DISTANCIA_MINIMA_QUALIFICACAO = 1000; 
        
        const eligibleDrivers = drivers.filter(driver => {
            if ((driver.total_distance || 0) < DISTANCIA_MINIMA_QUALIFICACAO) return false;
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
            d.ptsKml = Math.round(kmlRatio * PESO_KML * 1000);
            d.ptsDist = Math.round(distRatio * PESO_DIST * 1000);
            d.indiceDesempenho = d.ptsKml + d.ptsDist;
        });
        
        const sortedDrivers = [...eligibleDrivers].sort((a, b) => (b.indiceDesempenho || 0) - (a.indiceDesempenho || 0));
        const detailsContainer = document.getElementById('auditoria-details-section');
        if (!detailsContainer) return;

        let detailsHtml = `
            <div class="table-card full-width" style="border-top: 4px solid #3b82f6; background: #1e293b;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h3 style="color: #38bdf8; margin-bottom: 8px;"><i class="fas fa-calculator"></i> Prestação de Contas (Pontuação Completa)</h3>
                        <p style="color: #94a3b8; font-size: 0.85rem; line-height: 1.6;">
                            <strong>Regra:</strong> Desempenho KML (Peso 70%) + Desempenho Distância (Peso 30%) = Máx 1000 Pontos<br>
                            <strong>Melhores Marcas (Base 100%):</strong> KM/L = ${utils.formatNumber(maxKML)} | Distância = ${utils.formatNumber(maxDistance, 0)} km<br>
                            <strong>Trava de Qualificação:</strong> Mínimo de ${DISTANCIA_MINIMA_QUALIFICACAO} km rodados.
                        </p>
                    </div>
                    <div style="min-width: 250px;">
                        <input type="text" id="gerencial-search" onkeyup="window.filterGerencial()" placeholder="Buscar motorista..." class="form-control filter-input" style="width: 100%; background: #0f172a;">
                    </div>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Posição</th>
                                <th>Motorista</th>
                                <th>KM/L Real</th>
                                <th>Pts Consumo</th>
                                <th>KM Real</th>
                                <th>Pts Distância</th>
                                <th>Índice Final</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        sortedDrivers.forEach((d, idx) => {
            const kmlPerc = ((d.avg_economy / maxKML) * 100).toFixed(1);
            const distPerc = ((d.total_distance / maxDistance) * 100).toFixed(1);
            detailsHtml += `
                <tr class="gerencial-row" data-name="${escapeHtml(d.name)}">
                    <td style="font-weight: bold; color: #94a3b8;">${idx + 1}º</td>
                    <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(d.name)}</td>
                    <td style="color: ${getColor(d.avg_economy)}; font-weight: bold;">${utils.formatNumber(d.avg_economy)}</td>
                    <td><div style="display: flex; flex-direction: column;"><span style="color: #38bdf8; font-weight: bold;">${d.ptsKml} pts</span><span style="font-size: 0.7rem; color: #64748b;">${kmlPerc}% da melhor média</span></div></td>
                    <td>${utils.formatNumber(d.total_distance, 0)}</td>
                    <td><div style="display: flex; flex-direction: column;"><span style="color: #fbbf24; font-weight: bold;">${d.ptsDist} pts</span><span style="font-size: 0.7rem; color: #64748b;">${distPerc}% da maior dist.</span></div></td>
                    <td style="font-size: 1.1rem; font-weight: bold; color: #10b981;">${d.indiceDesempenho}</td>
                </tr>
            `;
        });

        const disqualifiedDrivers = drivers.filter(driver => !sortedDrivers.includes(driver));
        if (disqualifiedDrivers.length > 0) {
            detailsHtml += `<tr><td colspan="7" style="background: rgba(239, 68, 68, 0.1); color: #f87171; text-align: center; font-weight: bold; padding: 12px; font-size: 0.85rem;">MOTORISTAS DESCLASSIFICADOS NESTE MÊS</td></tr>`;
            disqualifiedDrivers.sort((a,b) => b.total_distance - a.total_distance).forEach(d => {
                let reason = ((d.total_distance || 0) < DISTANCIA_MINIMA_QUALIFICACAO) ? `Faltou KM (${utils.formatNumber(d.total_distance, 0)} km)` : "Ocorrência Registrada";
                detailsHtml += `
                    <tr class="gerencial-row" data-name="${escapeHtml(d.name)}" style="opacity: 0.7;">
                        <td style="color: #f87171;"><i class="fas fa-ban"></i></td>
                        <td style="font-weight: 500; text-decoration: line-through;">${escapeHtml(d.name)}</td>
                        <td>${utils.formatNumber(d.avg_economy)}</td><td style="color: #64748b;">Zerado</td>
                        <td>${utils.formatNumber(d.total_distance, 0)}</td><td style="color: #64748b;">Zerado</td>
                        <td style="color: #f87171; font-weight: bold; font-size: 0.8rem;">${reason}</td>
                    </tr>
                `;
            });
        }
        detailsHtml += `</tbody></table></div></div>`;
        detailsContainer.innerHTML = detailsHtml;
    }
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }
    return { render };
})();