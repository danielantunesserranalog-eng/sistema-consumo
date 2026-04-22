// ==================== MOTOR DE IMPORTAÇÃO E DELETE ==================== 
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
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv')); 
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
    
    importStats = { total_linhas_lidas: 0, trechos_sem_motorista: 0, placas_ignoradas: 0, viagens_curtas: 0, viagens_consolidadas_salvas: 0, erros: 0 };     
    clearImportLog();     
    showImportStatus('info', `Iniciando inteligência de agrupamento de dados...`);          
    
    for (const file of files) {         
        addToImportLog(`Lendo: ${file.name}`, 'info');         
        const startTime = performance.now();         
        try {             
            const rawSegments = await extractRawSegments(file);             
            if (!rawSegments.length) { addToImportLog(`Nenhum trecho válido encontrado.`, 'warning'); continue; }             
            
            const consolidatedTrips = consolidateTrips(rawSegments);

            if (consolidatedTrips.length === 0) {
                addToImportLog(`Após agrupar, nenhuma viagem superou 10km.`, 'warning'); continue; 
            }

            await batchInsertSupabase(consolidatedTrips);             
            
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);             
            addToImportLog(`Arquivo finalizado. (${elapsed}s)`, 'success');         
        } catch (error) { 
            addToImportLog(`Erro: ${error.message}`, 'error'); 
        }     
    }          
    
    isImporting = false;     
    const summary = `Concluído! Trechos lidos: ${importStats.total_linhas_lidas} | Viagens Úteis Salvas: ${importStats.viagens_consolidadas_salvas} <br> <small style="color:#94a3b8">Descartes: ${importStats.trechos_sem_motorista} sem motorista | ${importStats.placas_ignoradas} placas apoio | ${importStats.viagens_curtas} rotas curtas (<10km)</small>`;     
    showImportStatus('success', summary);          
    
    if (importStats.viagens_consolidadas_salvas > 0) {         
        addToImportLog('Atualizando dashboard...', 'info');         
        setTimeout(() => { document.getElementById('applyFilterBtn').click(); }, 1500);     
    } 
}

function extractRawSegments(file) {     
    return new Promise((resolve, reject) => {         
        const segments = [];         
        Papa.parse(file, {             
            header: true, delimiter: ';', skipEmptyLines: true, encoding: "ISO-8859-1", chunkSize: 1024 * 1024,             
            step: (row) => {                 
                importStats.total_linhas_lidas++;
                const mapped = mapRawSegment(row.data);                 
                if (mapped === 'ignored_plate') { importStats.placas_ignoradas++; } 
                else if (mapped === 'ignored_driver') { importStats.trechos_sem_motorista++; }
                else if (mapped) { segments.push(mapped); }             
            },             
            complete: () => resolve(segments),             
            error: (error) => reject(new Error(`Leitura: ${error.message}`))         
        });     
    }); 
}

function getResilientValue(row, possibleKeys) {
    for (let k of possibleKeys) if (row[k] !== undefined && row[k] !== null) return row[k];
    const normalize = str => (!str ? '' : str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase());
    for (let k of Object.keys(row)) {
        const normKey = normalize(k);
        for (let pK of possibleKeys) if (normKey === normalize(pK)) return row[k];
    }
    return undefined;
}

function mapRawSegment(row) {     
    try {         
        const placa = String(getResilientValue(row, ['Identificador/Placa', 'Placa', 'Identificador']) || '').trim().toUpperCase();         
        if (!placa) return null;
        if (PLACAS_IGNORADAS.includes(placa)) return 'ignored_plate'; 

        const motorista = String(getResilientValue(row, ['Motorista', 'Operador']) || '').trim();
        if (motorista === '-' || motorista === '') return 'ignored_driver';

        const parseDateObj = (str) => {             
            if (!str) return null;             
            const p = str.split(' '); if (p.length !== 2) return null;             
            const d = p[0].split('/'); if (d.length !== 3) return null;             
            const t = p[1].split(':');
            return new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2] || 0);         
        };         
        
        const parseDuration = (str) => {             
            if (!str || str === '0s') return 0;             
            let sec = 0;             
            const h = str.match(/(\d+)\s*h/i); const m = str.match(/(\d+)\s*m/i); const s = str.match(/(\d+)\s*s/i);             
            if(h) sec += parseInt(h[1])*3600; if(m) sec += parseInt(m[1])*60; if(s) sec += parseInt(s[1]);             
            return sec;         
        };         
        
        const inicio = parseDateObj(getResilientValue(row, ['Início', 'Inicio']));         
        const fim = parseDateObj(getResilientValue(row, ['Fim']));         
        if (!inicio || !fim) return null; 

        const distancia_km = parseFloat(String(getResilientValue(row, ['Distância (Km)']) || '0').replace(',', '.'));
        
        const litrosStr = getResilientValue(row, ['Total Litros Consumido', 'Total Litros']);
        let litros = 0;
        
        if (litrosStr !== undefined && litrosStr !== null && litrosStr !== '') {
            litros = parseFloat(String(litrosStr).replace(',', '.'));
        } else {
            const km_l = parseFloat(String(getResilientValue(row, ['Km/l', 'KM/L']) || '0').replace(',', '.'));
            litros = (distancia_km > 0 && km_l > 0) ? (distancia_km / km_l) : 0;
        }
        
        return {             
            placa, motorista, inicio, fim, 
            local_inicial: String(getResilientValue(row, ['Local inicial']) || '').trim(), 
            local_final: String(getResilientValue(row, ['Local final']) || '').trim(),             
            distancia_km: distancia_km, litros_gastos: litros,             
            tempo_conducao_sec: parseDuration(getResilientValue(row, ['Tempo de Condução'])),             
            tempo_parado_sec: parseDuration(getResilientValue(row, ['Tempo Parado']))         
        };     
    } catch (e) { return null; } 
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
        if (trip.distancia_km >= 10) { 
            const km_l_final = trip.litros_gastos > 0 ? (trip.distancia_km / trip.litros_gastos) : 0;
            consolidated.push({
                placa: trip.placa, motorista: trip.motorista,
                inicio: formatDBDate(trip.inicio), fim: formatDBDate(trip.fim),
                local_inicial: trip.local_inicial, local_final: trip.local_final,
                distancia_km: +(trip.distancia_km).toFixed(2), km_l: +(km_l_final).toFixed(2),
                litros_gastos: +(trip.litros_gastos).toFixed(2),
                tempo_conducao: `${trip.tempo_conducao_sec} seconds`, tempo_parado: `${trip.tempo_parado_sec} seconds`
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
    entry.style.cssText = 'margin-bottom: 4px; color: #94a3b8;';     
    entry.innerHTML = `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`;     
    el.appendChild(entry); el.scrollTop = el.scrollHeight;     
}