window.ocorrenciasModule = (function() {
    let ocorrencias = [];
    let editingId = null;

    async function loadOcorrencias() {
        const { data, error } = await window.supabaseClient.from('ocorrencias').select('*').order('created_at', { ascending: false });
        if (!error && data) {
            ocorrencias = data;
        }
        renderOcorrencias();
        return ocorrencias;
    }

    function renderOcorrencias() {
        const tbody = document.getElementById('ocorrencias-list');
        if (!tbody) return;
        tbody.innerHTML = ocorrencias.map(oc => {
            const dataObj = new Date(oc.data + 'T00:00:00');
            const dataFormatada = dataObj.toLocaleDateString('pt-BR');
            return `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${dataFormatada} às ${oc.hora}</td>
                <td style="color: #e2e8f0; font-weight: 500;">${escapeHtml(oc.motorista || '-')}</td>
                <td><span class="status-badge warning">${escapeHtml(oc.placa)}</span></td>
                <td>${escapeHtml(oc.local)}</td>
                <td style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #94a3b8;">${escapeHtml(oc.descricao)}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary btn-sm btn-icon" title="Editar" onclick="window.ocorrenciasModule.edit(${oc.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-danger btn-sm btn-icon" title="Excluir" onclick="window.ocorrenciasModule.delete(${oc.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }

    function populatePlacasSelect() {
        const select = document.getElementById('oc-placa');
        if (!select) return;
        const cavalos = window.cavalosModule ? window.cavalosModule.getAll() : [];
        
        // Ordena as placas de A a Z
        const sortedCavalos = [...cavalos].sort((a, b) => (a.placa || '').localeCompare(b.placa || ''));
        
        let optionsHtml = '<option value="">Selecione a placa...</option>';
        sortedCavalos.forEach(cavalo => {
            optionsHtml += `<option value="${cavalo.placa}">${cavalo.placa} (Conjunto: ${cavalo.conjunto})</option>`;
        });
        select.innerHTML = optionsHtml;
    }

    function populateMotoristasSelect() {
        const select = document.getElementById('oc-motorista');
        if (!select) return;
        const motoristas = window.driversModule ? window.driversModule.getAll() : [];
        
        // Ordena os motoristas de A a Z
        const sortedMotoristas = [...motoristas].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        let optionsHtml = '<option value="">Selecione o motorista (Opcional)...</option>';
        sortedMotoristas.forEach(mot => {
            optionsHtml += `<option value="${mot.name}">${mot.name}</option>`;
        });
        select.innerHTML = optionsHtml;
    }

    function openModal(ocorrenciaId = null) {
        editingId = ocorrenciaId;
        const modal = document.getElementById('ocorrencia-modal');
        const title = document.getElementById('ocorrencia-modal-title');
        const form = document.getElementById('ocorrencia-form');
        
        populatePlacasSelect();
        populateMotoristasSelect();
        
        if (ocorrenciaId) {
            const oc = ocorrencias.find(o => o.id === ocorrenciaId);
            if (oc) {
                document.getElementById('oc-data').value = oc.data;
                document.getElementById('oc-hora').value = oc.hora;
                document.getElementById('oc-motorista').value = oc.motorista || '';
                document.getElementById('oc-local').value = oc.local;
                document.getElementById('oc-placa').value = oc.placa;
                document.getElementById('oc-descricao').value = oc.descricao;
                title.textContent = 'Editar Ocorrência';
            }
        } else {
            form.reset();
            const hoje = new Date();
            const yyyy = hoje.getFullYear();
            const mm = String(hoje.getMonth() + 1).padStart(2, '0');
            const dd = String(hoje.getDate()).padStart(2, '0');
            document.getElementById('oc-data').value = `${yyyy}-${mm}-${dd}`;
            title.textContent = 'Nova Ocorrência';
        }
        modal.classList.add('active');
    }

    function closeModal() {
        document.getElementById('ocorrencia-modal').classList.remove('active');
        editingId = null;
        document.getElementById('ocorrencia-form').reset();
    }

    function updateSystemViews() {
        if (window.rankingModule) window.rankingModule.render();
        if (window.app) window.app.updateDashboard();
    }

    async function saveOcorrencia(event) {
        event.preventDefault();
        const btn = event.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        const ocorrenciaData = {
            data: document.getElementById('oc-data').value,
            hora: document.getElementById('oc-hora').value,
            motorista: document.getElementById('oc-motorista').value,
            local: document.getElementById('oc-local').value,
            placa: document.getElementById('oc-placa').value,
            descricao: document.getElementById('oc-descricao').value
        };
        
        if (editingId) {
            await window.supabaseClient.from('ocorrencias').update(ocorrenciaData).eq('id', editingId);
            utils.showAlert('Ocorrência atualizada com sucesso!', 'success');
        } else {
            await window.supabaseClient.from('ocorrencias').insert([ocorrenciaData]);
            utils.showAlert('Ocorrência registrada no banco!', 'success');
        }
        
        await loadOcorrencias();
        closeModal();
        updateSystemViews();
        btn.disabled = false;
    }

    async function deleteOcorrencia(id) {
        if (confirm('Tem certeza que deseja excluir esta ocorrência do banco de dados?')) {
            await window.supabaseClient.from('ocorrencias').delete().eq('id', id);
            await loadOcorrencias();
            utils.showAlert('Ocorrência excluída com sucesso!', 'success');
            updateSystemViews();
        }
    }

    function getAllOcorrencias() { return ocorrencias; }

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('ocorrencia-form');
        if (form) form.addEventListener('submit', saveOcorrencia);
    });

    return { load: loadOcorrencias, getAll: getAllOcorrencias, openModal, closeModal, edit: openModal, delete: deleteOcorrencia };
})();