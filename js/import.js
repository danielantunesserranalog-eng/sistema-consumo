// ==================== MOTOR DE IMPORTAÇÃO E DELETE (CSV e XLSX) ====================
function initImportModule() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('csvFileInput');
    const selectBtn = document.getElementById('selectFilesBtn');
    
    if (!uploadArea) return;
    
    uploadArea.addEventListener('click', () => fileInput?.click());
    if (selectBtn) selectBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput?.click(); });
    
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#3b82f6'; });
    uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#475569'; });
    
    uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#475569';
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
        if (files.length) await processFiles(files);
    });
    
    if (fileInput) fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length) await processFiles(files);
        fileInput.value = '';
    });
}

async function processFiles(files) {
    if (isImporting) { showImportStatus('warning', 'Importação em andamento...'); return; }
    isImporting = true;
    
    importStats = {
        total_linhas_lidas: 0, trechos_sem_motorista: 0, placas_ignoradas: 0,
        viagens_curtas: 0, viagens_consolidadas_salvas: 0, erros: 0,
        missing_placa: 0, invalid_placa: 0, ignored_not_serrana: 0
    };
    
    clearImportLog();
    showImportStatus('info', `Iniciando inteligência de agrupamento de dados...`);
    
    for (const file of files) {
        addToImportLog(`Lendo: ${file.name}`, 'info');
        const startTime = performance.now();
        try {
            const rawSegments = await extractRawSegments(file);
            if (!rawSegments.length) {
                addToImportLog(`Nenhum trecho válido encontrado. Analise os descartes no resumo.`, 'warning');
                continue;
            }
            const consolidatedTrips = consolidateTrips(rawSegments);
            if (consolidatedTrips.length === 0) {
                addToImportLog(`Após agrupar, nenhuma viagem superou a distância mínima.`, 'warning');
                continue;
            }
            await batchInsertSupabase(consolidatedTrips);
            
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            addToImportLog(`Arquivo finalizado. (${elapsed}s)`, 'success');
        } catch (error) {
            addToImportLog(`Erro: ${error.message}`, 'error');
        }
    }
    
    isImporting = false;
    const summary = `Concluído! Trechos lidos: ${importStats.total_linhas_lidas} | Viagens Úteis Salvas: ${importStats.viagens_consolidadas_salvas} <br>
    <small style="color:#94a3b8">Descartes Mapeados: ${importStats.trechos_sem_motorista} motoristas ignorados | ${importStats.placas_ignoradas} placas ignoradas | ${importStats.viagens_curtas} rotas curtas | SERRANA ausente: ${importStats.ignored_not_serrana} | Falta de Coluna Placa: ${importStats.missing_placa}</small>`;
    
    showImportStatus(importStats.viagens_consolidadas_salvas > 0 ? 'success' : 'warning', summary);
    
    if (importStats.viagens_consolidadas_salvas > 0) {
        addToImportLog('Atualizando dashboard...', 'info');
        setTimeout(() => { document.getElementById('applyFilterBtn').click(); }, 1500);
    }
}

// BIFURCAÇÃO: LÊ XLSX ou CSV
function extractRawSegments(file) {
    return new Promise((resolve, reject) => {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        if (isExcel) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    if (typeof XLSX === 'undefined') {
                        reject(new Error("Biblioteca XLSX não carregada. Adicione o script no index.html"));
                        return;
                    }
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });
                    const segments = [];
                    let firstRowLogged = false;
                    json.forEach(row => {
                        importStats.total_linhas_lidas++;
                        if (!firstRowLogged && importStats.total_linhas_lidas === 1) {
                            const colunasLidas = Object.keys(row).join(', ');
                            addToImportLog(`[Leitor Excel] Colunas detectadas: ${colunasLidas.substring(0, 100)}...`, 'info');
                            firstRowLogged = true;
                        }
                        processRowMapping(row, segments);
                    });
                    resolve(segments);
                } catch (error) {
                    reject(new Error(`Falha ao ler Excel: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Erro interno ao ler arquivo.'));
            reader.readAsArrayBuffer(file);
        } else {
            // Leitor de CSV padrão
            const reader = new FileReader();
            reader.onload = (e) => {
                let text = e.target.result;
                if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
                
                const segments = [];
                let firstRowLogged = false;
                Papa.parse(text, {
                    header: true, skipEmptyLines: 'greedy',
                    step: (row) => {
                        importStats.total_linhas_lidas++;
                        if (!firstRowLogged && importStats.total_linhas_lidas === 1) {
                            const colunasLidas = Object.keys(row.data).join(', ');
                            addToImportLog(`[Leitor CSV] Colunas detectadas: ${colunasLidas.substring(0, 100)}...`, 'info');
                            firstRowLogged = true;
                        }
                        processRowMapping(row.data, segments);
                    },
                    complete: () => resolve(segments),
                    error: (error) => reject(new Error(`Leitura PapaParse falhou: ${error.message}`))
                });
            };
            reader.readAsText(file, 'ISO-8859-1');
        }
    });
}

function processRowMapping(row, segments) {
    const mapped = mapRawSegment(row);
    if (mapped === 'missing_placa') { importStats.missing_placa++; }
    else if (mapped === 'invalid_placa') { importStats.invalid_placa++; }
    else if (mapped === 'ignored_plate') { importStats.placas_ignoradas++; }
    else if (mapped === 'ignored_driver') { importStats.trechos_sem_motorista++; }
    else if (mapped === 'ignored_not_serrana') { importStats.ignored_not_serrana++; }
    else if (mapped === 'error_catch') { importStats.erros++; }
    else if (mapped) { segments.push(mapped); }
}

// Leitor ultra-resiliente de cabeçalhos
function getResilientValue(row, possibleKeys) {
    for (let k of possibleKeys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
    }
    const normalize = str => (!str ? '' : String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase());
    for (let k of Object.keys(row)) {
        const normKey = normalize(k);
        for (let pK of possibleKeys) {
            if (normKey === normalize(pK) && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
        }
    }
    return undefined;
}

function parseSafeFloat(val) {
    if (!val) return 0;
    let s = String(val).trim();
    if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
        s = s.replace(',', '.');
    }
    return parseFloat(s) || 0;
}

const parseDuration = (str) => {
    if (!str || str === '0s') return 0;
    let sec = 0;
    const strSafe = String(str);
    const d = strSafe.match(/(\d+)\s*d/i);
    const h = strSafe.match(/(\d+)\s*h/i);
    const m = strSafe.match(/(\d+)\s*m/i);
    const s = strSafe.match(/(\d+)\s*s/i);
    if(d) sec += parseInt(d[1]) * 86400;
    if(h) sec += parseInt(h[1]) * 3600;
    if(m) sec += parseInt(m[1]) * 60;
    if(s) sec += parseInt(s[1]);
    return sec;
};

function mapRawSegment(row) {
    try {
        // Regra de Correção do Usuário: Importar apenas se a SERRANA tiver feito parte da viagem.
        const rowDataString = JSON.stringify(row).toUpperCase();
        if (!rowDataString.includes('SERRANA')) {
            return 'ignored_not_serrana';
        }

        let placaRaw = getResilientValue(row, ['Placa(s)', 'Frota(s)', 'Identificador/Placa', 'Placa', 'Identificador', 'Veiculo']);
        if (!placaRaw) return 'missing_placa';
        let placa = String(placaRaw).split(',')[0].trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (!placa || placa.length < 5) return 'invalid_placa';
        if (PLACAS_IGNORADAS.includes(placa)) return 'ignored_plate';
        
        let motRaw = getResilientValue(row, ['Motorista', 'Operador(es)', 'Operador', 'Condutor', 'Nome']);
        let motorista = motRaw ? String(motRaw).trim().toUpperCase() : 'INDEFINIDO';
        if (motorista === '-' || motorista === '') motorista = 'INDEFINIDO';
        const normalizeMot = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const isIgnored = MOTORISTAS_IGNORADOS.some(m => normalizeMot(m) === normalizeMot(motorista));
        if (isIgnored) return 'ignored_driver';
        
        const parseDateObj = (str) => {
            if (!str) return null;
            const p = String(str).trim().split(' '); if (p.length !== 2) return null;
            const d = p[0].split('/'); if (d.length !== 3) return null;
            const t = p[1].split(':');
            return new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2] || 0);
        };
        
        let inicioRaw = getResilientValue(row, ['Início', 'Inicio', 'Data', 'Data Inicial']);
        let fimRaw = getResilientValue(row, ['Fim', 'Data Fim', 'Data Final']);
        
        let inicio, fim;
        if (inicioRaw && String(inicioRaw).includes('/')) {
            inicio = parseDateObj(inicioRaw);
            fim = parseDateObj(fimRaw);
        }
        if (!inicio || !fim) {
            inicio = new Date();
            inicio.setHours(0, 0, 0, 0);
            fim = new Date();
            fim.setHours(23, 59, 59, 999);
        }
        
        const distancia_km = parseSafeFloat(getResilientValue(row, ['Distância (Km)', 'Distância', 'Km', 'Distancia']));
        let litros = parseSafeFloat(getResilientValue(row, ['Litros Consumidos', 'Total Litros Consumido', 'Total Litros', 'Combustivel']));
        
        if (litros <= 0) {
            const km_l = parseSafeFloat(getResilientValue(row, ['Km/l', 'KM/L', 'Media']));
            litros = (distancia_km > 0 && km_l > 0) ? (distancia_km / km_l) : 0;
        }
        
        const velocidade_maxima = parseSafeFloat(getResilientValue(row, ['Velocidade Máxima', 'Velocidade Max']));
        const co2_kg = parseSafeFloat(getResilientValue(row, ['CO2(Kg)', 'CO2']));
        const rpm_vermelha_perc = parseSafeFloat(getResilientValue(row, ['Prog. RPM - faixa vermelha (%)', 'Prog. RPM - faixa vermelha']));
        const total_eventos = parseInt(String(getResilientValue(row, ['Total de eventos', 'Eventos']) || '0'), 10) || 0;
        
        return {
            placa, motorista, inicio, fim,
            local_inicial: String(getResilientValue(row, ['Local inicial', 'Cliente(s)', 'Empresa']) || '').trim(),
            local_final: String(getResilientValue(row, ['Local final', 'Empresa']) || '').trim(),
            distancia_km, litros_gastos: litros,
            tempo_conducao_sec: parseDuration(getResilientValue(row, ['Tempo De Condução', 'Tempo de Condução'])),
            tempo_parado_sec: parseDuration(getResilientValue(row, ['Tempo Parado'])) || 0,
            velocidade_maxima, co2_kg, rpm_vermelha_perc, total_eventos
        };
    } catch (e) {
        return 'error_catch';
    }
}

function consolidateTrips(rawSegments) {
    addToImportLog(`Costurando trechos fracionados e apurando litros exatos...`, 'info');
    rawSegments.sort((a, b) => {
        if (a.placa !== b.placa) return a.placa.localeCompare(b.placa);
        return a.inicio - b.inicio;
    });
    const consolidated = [];
    let currentTrip = null;
    const formatDBDate = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const closeAndSaveTrip = (trip) => {
        if (trip.distancia_km >= 1) {
            const km_l_final = trip.litros_gastos > 0 ? (trip.distancia_km / trip.litros_gastos) : 0;
            consolidated.push({
                placa: trip.placa, motorista: trip.motorista,
                inicio: formatDBDate(trip.inicio), fim: formatDBDate(trip.fim),
                local_inicial: trip.local_inicial, local_final: trip.local_final,
                distancia_km: +(trip.distancia_km).toFixed(2), km_l: +(km_l_final).toFixed(2),
                litros_gastos: +(trip.litros_gastos).toFixed(2),
                tempo_conducao: `${trip.tempo_conducao_sec} seconds`, tempo_parado: `${trip.tempo_parado_sec} seconds`,
                velocidade_maxima: +(trip.velocidade_maxima).toFixed(2),
                co2_kg: +(trip.co2_kg).toFixed(2),
                rpm_vermelha_perc: +(trip.rpm_vermelha_perc).toFixed(2),
                total_eventos: trip.total_eventos
            });
        } else {
            importStats.viagens_curtas++;
        }
    };
    for (let i = 0; i < rawSegments.length; i++) {
        const seg = rawSegments[i];
        if (!currentTrip) {
            currentTrip = { ...seg };
        } else if (currentTrip.placa === seg.placa && currentTrip.motorista === seg.motorista) {
            currentTrip.fim = seg.fim > currentTrip.fim ? seg.fim : currentTrip.fim;
            currentTrip.local_final = seg.local_final || currentTrip.local_final;
            currentTrip.distancia_km += seg.distancia_km;
            currentTrip.litros_gastos += seg.litros_gastos;
            currentTrip.tempo_conducao_sec += seg.tempo_conducao_sec;
            currentTrip.tempo_parado_sec += seg.tempo_parado_sec;
            currentTrip.velocidade_maxima = Math.max(currentTrip.velocidade_maxima, seg.velocidade_maxima);
            currentTrip.co2_kg += seg.co2_kg;
            currentTrip.rpm_vermelha_perc = Math.max(currentTrip.rpm_vermelha_perc, seg.rpm_vermelha_perc);
            currentTrip.total_eventos += seg.total_eventos;
        } else {
            closeAndSaveTrip(currentTrip);
            currentTrip = { ...seg };
        }
    }
    if (currentTrip) closeAndSaveTrip(currentTrip);
    return consolidated;
}

async function batchInsertSupabase(viagensParaInserir) {
    let minDate = viagensParaInserir[0].inicio;
    let maxDate = viagensParaInserir[0].inicio;
    viagensParaInserir.forEach(v => {
        if (v.inicio < minDate) minDate = v.inicio;
        if (v.inicio > maxDate) maxDate = v.inicio;
    });
    addToImportLog(`Checando BD contra duplicatas...`, 'info');
    const { data: dbViagens, error: dbError } = await supabaseClient
        .from('viagens').select('placa, inicio').gte('inicio', minDate).lte('inicio', maxDate).limit(100000);
    if (dbError) throw new Error('Falha ao checar duplicatas no banco.');
    
    const bdSet = new Set((dbViagens || []).map(v => `${v.placa}_${v.inicio.split('.')[0]}`));
    const viagensLimpas = viagensParaInserir.filter(v => {
        return !bdSet.has(`${v.placa}_${v.inicio}`);
    });
    
    if (viagensLimpas.length === 0) {
        addToImportLog(`Todas as viagens calculadas já existem no sistema.`, 'warning'); return;
    }
    addToImportLog(`Transmitindo ${viagensLimpas.length} viagens ao BD...`, 'info');
    const batchSize = 300;
    for (let i = 0; i < viagensLimpas.length; i += batchSize) {
        const batch = viagensLimpas.slice(i, i + batchSize);
        const { error } = await supabaseClient.from('viagens').insert(batch);
        if (error) { importStats.erros += batch.length; }
        else { importStats.viagens_consolidadas_salvas += batch.length; }
    }
}

function initDeleteModule() {
    const deleteBtn = document.getElementById('deleteAllBtn');
    if (!deleteBtn) return;
    deleteBtn.addEventListener('click', async () => {
        if (!confirm('ATENÇÃO: Você vai APAGAR TODAS AS VIAGENS do banco. Continuar?')) return;
        if (prompt('Digite a palavra "APAGAR" em maiúsculo:') === 'APAGAR') {
            try {
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Formatando...';
                deleteBtn.disabled = true;
                const { error } = await supabaseClient.from('viagens').delete().not('placa', 'is', null);
                if (error) throw error;
                alert('Banco limpo!'); window.location.reload();
            } catch (err) { alert('Erro: ' + err.message); window.location.reload(); }
        }
    });
}

function showImportStatus(type, msg) {
    const el = document.getElementById('importStatus'); if (!el) return;
    el.style.backgroundColor = type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
    el.style.color = type === 'success' ? '#34d399' : '#f87171';
    el.innerHTML = `<span>${msg}</span>`; el.style.display = 'block';
}

function clearImportLog() { const el = document.getElementById('importLog'); if (el) el.innerHTML = ''; }

function addToImportLog(msg, type = 'info') {
    const el = document.getElementById('importLog'); if (!el) return;
    const entry = document.createElement('div');
    entry.style.cssText = 'margin-bottom: 4px; color: #94a3b8; font-size: 0.85rem;';
    entry.innerHTML = `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`;
    el.appendChild(entry); el.scrollTop = el.scrollHeight;
}