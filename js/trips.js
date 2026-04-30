// Trips management module
window.tripsModule = (function() {
    let trips = [];
         
    function loadTrips() {
        const stored = localStorage.getItem('motorista_padrao_trips');
        trips = stored ? JSON.parse(stored) : [];
        renderTrips();
        renderHistorico();
        return trips;
    }
         
    function saveTrips() {
        localStorage.setItem('motorista_padrao_trips', JSON.stringify(trips));
    }
         
    function renderTrips() {
        const tbody = document.getElementById('trips-list');
        if (!tbody) return;
                 
        const recentTrips = trips.slice(0, 10);
        tbody.innerHTML = recentTrips.map(trip => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(trip.motorista || '-')}</td>
                <td>${utils.formatNumber(trip['Distância (Km)'])}</td>
                <td style="color: #38bdf8; font-weight: 600;">${utils.formatNumber(trip['Km/l'])}</td>
                <td>${utils.formatNumber(trip['Total Litros Consumido'])}</td>
                <td>${utils.formatDate(trip.inicio)}</td>
            </tr>
        `).join('');
                 
        const tripCount = document.getElementById('trip-count');
        if (tripCount) {
            tripCount.textContent = `${trips.length} registros válidos`;
        }
    }
         
    function renderRecentTrips() {
        const tbody = document.getElementById('recent-trips');
        if (!tbody) return;
                 
        const recentTrips = trips.slice(0, 5);
        tbody.innerHTML = recentTrips.map(trip => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(trip.motorista || '-')}</td>
                <td>${utils.formatNumber(trip['Distância (Km)'])}</td>
                <td style="color: #38bdf8; font-weight: 600;">${utils.formatNumber(trip['Km/l'])}</td>
                <td>${utils.formatNumber(trip['Total Litros Consumido'])}</td>
                <td>${utils.formatDate(trip.inicio)}</td>
            </tr>
        `).join('');
    }

    // NOVA FUNÇÃO: Renderiza a tela de Histórico Completo
    function renderHistorico() {
        const tbody = document.getElementById('historico-list');
        if (!tbody) return;

        tbody.innerHTML = trips.map(trip => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(trip.motorista || '-')}</td>
                <td>${utils.formatDateTime(trip.inicio)}</td>
                <td>${utils.formatDateTime(trip.fim)}</td>
                <td>${utils.formatNumber(trip['Distância (Km)'])}</td>
                <td style="color: #38bdf8; font-weight: 600;">${utils.formatNumber(trip['Km/l'])}</td>
                <td>${utils.formatNumber(trip['Total Litros Consumido'])}</td>
            </tr>
        `).join('');

        const countBadge = document.getElementById('historico-count');
        if (countBadge) {
            countBadge.textContent = `${trips.length} registros globais`;
        }
    }
         
    function escapeHtml(text) {
        if (!text) return '-';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
         
    function importFromExcel(data) {
        trips = data;
        saveTrips();
        renderTrips();
        renderRecentTrips();
        renderHistorico();
        updateDriverStats();
                 
        utils.showAlert(`${trips.length} viagens válidas foram importadas!`, 'success');
    }
         
    function updateDriverStats() {
        if (window.driversModule) {
            window.driversModule.updateScores();
        }
        if (window.rankingModule) {
            window.rankingModule.render();
        }
        if (window.app) {
            window.app.updateDashboard();
        }
    }
         
    function getAllTrips() {
        return trips;
    }
         
    function getDriverTrips(driverName) {
        return trips.filter(t => t.motorista === driverName);
    }
         
    // Handle Excel upload
    function setupUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const excelInput = document.getElementById('excel-input');
                 
        if (!uploadArea || !excelInput) return;
                 
        uploadArea.addEventListener('click', () => {
            excelInput.click();
        });
                 
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#3b82f6';
        });
                 
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#475569';
        });
                 
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#475569';
            const file = e.dataTransfer.files[0];
            if (file) {
                handleFile(file);
            }
        });
                 
        excelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFile(file);
            }
        });
    }

    // Processa números de forma robusta
    function parseExcelNumber(val) {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            let cleanStr = val.trim();
            cleanStr = cleanStr.replace(/[R$\s]/g, '');
            if (cleanStr.includes('.') && cleanStr.includes(',')) {
                cleanStr = cleanStr.replace(/\./g, '');
            }
            cleanStr = cleanStr.replace(',', '.');
            const parsed = parseFloat(cleanStr);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    function parseKML(val) {
        let parsed = parseExcelNumber(val);
        if (parsed > 15) {
            parsed = parsed / 100;
        }
        return parsed;
    }

    // Captura datas com precisão de hora e minuto direto do texto do Excel
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
                        if (time.split(':').length === 2) time += ':00'; // Completa com segundos
                    }
                    try {
                        isoDate = new Date(`${ano}-${mes}-${dia}T${time}`).toISOString();
                    } catch(e) {}
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
            
            // 1º Passo: Mapear os dados puros (Capturando Inicio e Fim com hora)
            let rawTrips = jsonData.map(row => {
                const kmlValue = row['Km/L'] || row['Km/l'] || row['KM/L'] || row['km/l'] || 0;
                const distanciaValue = row['Distância (Km)'] || row['Distancia (Km)'] || row['distância (km)'] || 0;
                const litrosValue = row['Total Litros Consumido'] || row['total litros consumido'] || 0;
                
                const dataInicioRaw = row.Início || row.inicio || row['Data Inicial'] || row['Dt Início'];
                const dataFimRaw = row.Fim || row.fim || row['Data Fim'] || row['Dt Fim Descar Fáb'];
                
                return {
                    ...row,
                    motorista: row.Motorista || row.motorista,
                    'Distância (Km)': parseExcelNumber(distanciaValue),
                    'Km/l': parseKML(kmlValue),
                    'Total Litros Consumido': parseExcelNumber(litrosValue),
                    inicio: parseDateString(dataInicioRaw),
                    fim: parseDateString(dataFimRaw)
                };
            });

            // 2º Passo: Aplicação das Travas de Importação
            const processedTrips = rawTrips.filter(trip => {
                const distancia = trip['Distância (Km)'];
                
                // TRAVA 1: Ignorar viagens com distância menor que 10 km
                if (distancia < 10) {
                    return false;
                }

                // TRAVA SILENCIOSA DE INTEGRIDADE DA BASE SERRANALOG
                const transp = String(trip['Transportador'] || trip['Transportadora'] || '').toUpperCase();
                const carreg = String(trip['Carregador'] || trip['Carregador Florestal'] || '').toUpperCase();
                
                const temColunaTransp = 'Transportador' in trip || 'Transportadora' in trip;
                const temColunaCarreg = 'Carregador' in trip || 'Carregador Florestal' in trip;
                
                if (temColunaTransp || temColunaCarreg) {
                    if (!transp.includes('SERRANALOG') && !carreg.includes('SERRANALOG')) {
                        return false; 
                    }
                }

                return true; 
            });

            // Verifica se a trava cortou tudo
            if (rawTrips.length > 0 && processedTrips.length === 0) {
                utils.showAlert('Nenhuma viagem válida encontrada. Verifique se as distâncias são >= 10 km.', 'warning');
            }
                         
            importFromExcel(processedTrips);
        };
                 
        reader.readAsArrayBuffer(file);
    }
         
    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        loadTrips();
        setupUpload();
    });
         
    return {
        load: loadTrips,
        getAll: getAllTrips,
        getDriverTrips,
        importFromExcel,
        updateDriverStats,
        renderRecentTrips,
        renderHistorico
    };
})();