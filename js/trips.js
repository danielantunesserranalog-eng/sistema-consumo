window.tripsModule = (function() {
    let trips = [];

    async function loadTrips() {
        const { data, error } = await window.supabaseClient.from('viagens').select('*').order('created_at', { ascending: false });
        if (!error && data) {
            trips = data;
        }
        renderTrips();
        renderHistorico();
        return trips;
    }

    function renderTrips() {
        const tbody = document.getElementById('trips-list');
        if (!tbody) return;
        const recentTrips = trips.slice(0, 10);
        tbody.innerHTML = recentTrips.map(trip => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(trip.motorista || '-')}</td>
                <td>${utils.formatNumber(trip.distancia_km)}</td>
                <td style="color: #38bdf8; font-weight: 600;">${utils.formatNumber(trip.kml)}</td>
                <td>${utils.formatNumber(trip.total_litros)}</td>
                <td>${utils.formatDate(trip.inicio)}</td>
            </tr>
        `).join('');

        const tripCount = document.getElementById('trip-count');
        if (tripCount) tripCount.textContent = `${trips.length} registros no banco`;
    }

    function renderRecentTrips() {
        const tbody = document.getElementById('recent-trips');
        if (!tbody) return;
        const recentTrips = trips.slice(0, 5);
        tbody.innerHTML = recentTrips.map(trip => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(trip.motorista || '-')}</td>
                <td>${utils.formatNumber(trip.distancia_km)}</td>
                <td style="color: #38bdf8; font-weight: 600;">${utils.formatNumber(trip.kml)}</td>
                <td>${utils.formatNumber(trip.total_litros)}</td>
                <td>${utils.formatDate(trip.inicio)}</td>
            </tr>
        `).join('');
    }

    function renderHistorico() {
        const tbody = document.getElementById('historico-list');
        if (!tbody) return;
        tbody.innerHTML = trips.map(trip => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(trip.motorista || '-')}</td>
                <td>${utils.formatDateTime(trip.inicio)}</td>
                <td>${utils.formatDateTime(trip.fim)}</td>
                <td>${utils.formatNumber(trip.distancia_km)}</td>
                <td style="color: #38bdf8; font-weight: 600;">${utils.formatNumber(trip.kml)}</td>
                <td>${utils.formatNumber(trip.total_litros)}</td>
            </tr>
        `).join('');
        const countBadge = document.getElementById('historico-count');
        if (countBadge) countBadge.textContent = `${trips.length} registros globais`;
    }

    function escapeHtml(text) {
        if (!text) return '-';
        const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }

    async function importFromExcel(data) {
        // Conversão para o formato Supabase
        const supabaseData = data.map(t => ({
            motorista: t.motorista,
            distancia_km: t['Distância (Km)'],
            kml: t['Km/l'],
            total_litros: t['Total Litros Consumido'],
            inicio: t.inicio,
            fim: t.fim
        }));

        utils.showAlert(`Importando ${supabaseData.length} viagens para o banco...`, 'info');
        
        // Supabase permite insert em lote (array)
        const { error } = await window.supabaseClient.from('viagens').insert(supabaseData);
        
        if (error) {
            utils.showAlert('Erro na importação para o banco de dados.', 'error');
            console.error(error);
        } else {
            await loadTrips();
            renderRecentTrips();
            updateDriverStats();
            utils.showAlert(`${supabaseData.length} viagens salvas no banco com sucesso!`, 'success');
        }
    }

    function updateDriverStats() {
        if (window.driversModule) window.driversModule.updateScores();
        if (window.rankingModule) window.rankingModule.render();
        if (window.app) window.app.updateDashboard();
    }

    function getAllTrips() { return trips; }
    function getDriverTrips(driverName) { return trips.filter(t => t.motorista === driverName); }

    function setupUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const excelInput = document.getElementById('excel-input');
        if (!uploadArea || !excelInput) return;

        uploadArea.addEventListener('click', () => excelInput.click());
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#3b82f6'; });
        uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = '#475569'; });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault(); uploadArea.style.borderColor = '#475569';
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        });
        excelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFile(file);
        });
    }

    function parseExcelNumber(val) {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            let cleanStr = val.trim().replace(/[R$\s]/g, '');
            if (cleanStr.includes('.') && cleanStr.includes(',')) cleanStr = cleanStr.replace(/\./g, '');
            cleanStr = cleanStr.replace(',', '.');
            const parsed = parseFloat(cleanStr);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    function parseKML(val) {
        let parsed = parseExcelNumber(val);
        if (parsed > 15) parsed = parsed / 100;
        return parsed;
    }

    function parseDateString(dateStr) {
        let isoDate = new Date().toISOString();
        if (!dateStr) return isoDate;
        if (typeof dateStr === 'string') {
            if (dateStr.includes('/')) {
                const parts = dateStr.split(' ');
                const dateParts = parts[0].split('/');
                if (dateParts.length === 3) {
                    const dia = dateParts[0].padStart(2, '0');
                    const mes = dateParts[1].padStart(2, '0');
                    let ano = dateParts[2];
                    if (ano.length === 2) ano = '20' + ano;
                    let time = '12:00:00';
                    if (parts.length > 1) {
                        time = parts[1];
                        if (time.split(':').length === 2) time += ':00';
                    }
                    try { isoDate = new Date(`${ano}-${mes}-${dia}T${time}`).toISOString(); } catch(e) {}
                }
            } else {
                try { isoDate = new Date(dateStr).toISOString(); } catch(err) {}
            }
        } else if (dateStr instanceof Date) {
            isoDate = dateStr.toISOString();
        }
        return isoDate;
    }

    function handleFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false });

            let rawTrips = jsonData.map(row => {
                const kmlValue = row['Km/L'] || row['Km/l'] || row['KM/L'] || row['km/l'] || 0;
                const distanciaValue = row['Distância (Km)'] || row['Distancia (Km)'] || row['distância (km)'] || 0;
                const litrosValue = row['Total Litros Consumido'] || row['total litros consumido'] || 0;
                const dataInicioRaw = row.Início || row.inicio || row['Data Inicial'] || row['Dt Início'];
                const dataFimRaw = row.Fim || row.fim || row['Data Fim'] || row['Dt Fim Descar Fáb'];
                return {
                    motorista: row.Motorista || row.motorista,
                    'Distância (Km)': parseExcelNumber(distanciaValue),
                    'Km/l': parseKML(kmlValue),
                    'Total Litros Consumido': parseExcelNumber(litrosValue),
                    inicio: parseDateString(dataInicioRaw),
                    fim: parseDateString(dataFimRaw),
                    Transportador: row['Transportador'] || row['Transportadora'],
                    Carregador: row['Carregador'] || row['Carregador Florestal']
                };
            });

            const processedTrips = rawTrips.filter(trip => {
                const distancia = trip['Distância (Km)'];
                if (distancia < 10) return false;
                const transp = String(trip['Transportador'] || '').toUpperCase();
                const carreg = String(trip['Carregador'] || '').toUpperCase();
                const temColunaTransp = trip.Transportador !== undefined;
                const temColunaCarreg = trip.Carregador !== undefined;
                
                if (temColunaTransp || temColunaCarreg) {
                    if (!transp.includes('SERRANALOG') && !carreg.includes('SERRANALOG')) return false;
                }
                return true;
            });

            if (rawTrips.length > 0 && processedTrips.length === 0) {
                utils.showAlert('Nenhuma viagem válida encontrada. Verifique se as distâncias são >= 10 km.', 'warning');
            }
            importFromExcel(processedTrips);
        };
        reader.readAsArrayBuffer(file);
    }

    document.addEventListener('DOMContentLoaded', setupUpload);

    return { load: loadTrips, getAll: getAllTrips, getDriverTrips, importFromExcel, updateDriverStats, renderRecentTrips, renderHistorico };
})();