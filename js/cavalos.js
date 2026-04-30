// Cavalos management module
window.cavalosModule = (function() {
    let cavalos = [];
    let editingId = null;

    function loadCavalos() {
        const stored = localStorage.getItem('motorista_padrao_cavalos');
        cavalos = stored ? JSON.parse(stored) : [];
        renderCavalos();
        return cavalos;
    }

    function saveCavalos() {
        localStorage.setItem('motorista_padrao_cavalos', JSON.stringify(cavalos));
    }

    function renderCavalos() {
        const tbody = document.getElementById('cavalos-list');
        if (!tbody) return;

        tbody.innerHTML = cavalos.map(cavalo => {
            const carretas = [cavalo.carreta1, cavalo.carreta2, cavalo.carreta3].filter(c => c).join(' / ');
            
            return `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(cavalo.conjunto)}</td>
                <td style="color: #38bdf8; font-weight: 600;">${escapeHtml(cavalo.placa)}</td>
                <td>${escapeHtml(cavalo.cor)}</td>
                <td><span class="status-badge success">${escapeHtml(cavalo.frota)}</span></td>
                <td style="color: #94a3b8; font-size: 0.8rem;">${escapeHtml(carretas || 'Nenhuma')}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary btn-sm btn-icon" title="Editar" onclick="window.cavalosModule.edit(${cavalo.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger btn-sm btn-icon" title="Excluir" onclick="window.cavalosModule.delete(${cavalo.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function openModal(cavaloId = null) {
        editingId = cavaloId;
        const modal = document.getElementById('cavalo-modal');
        const title = document.getElementById('cavalo-modal-title');
        const form = document.getElementById('cavalo-form');

        if (cavaloId) {
            const cavalo = cavalos.find(c => c.id === cavaloId);
            if (cavalo) {
                document.getElementById('cavalo-conjunto').value = cavalo.conjunto;
                document.getElementById('cavalo-placa').value = cavalo.placa;
                document.getElementById('cavalo-cor').value = cavalo.cor;
                document.getElementById('cavalo-frota').value = cavalo.frota;
                document.getElementById('cavalo-carreta1').value = cavalo.carreta1;
                document.getElementById('cavalo-carreta2').value = cavalo.carreta2;
                document.getElementById('cavalo-carreta3').value = cavalo.carreta3;
                title.textContent = 'Editar Cavalo';
            }
        } else {
            form.reset();
            title.textContent = 'Novo Cavalo';
        }

        modal.classList.add('active');
    }

    function closeModal() {
        const modal = document.getElementById('cavalo-modal');
        modal.classList.remove('active');
        editingId = null;
        document.getElementById('cavalo-form').reset();
    }

    function saveCavalo(event) {
        event.preventDefault();

        const cavaloData = {
            conjunto: document.getElementById('cavalo-conjunto').value.toUpperCase(),
            placa: document.getElementById('cavalo-placa').value.toUpperCase(),
            cor: document.getElementById('cavalo-cor').value,
            frota: document.getElementById('cavalo-frota').value,
            carreta1: document.getElementById('cavalo-carreta1').value.toUpperCase(),
            carreta2: document.getElementById('cavalo-carreta2').value.toUpperCase(),
            carreta3: document.getElementById('cavalo-carreta3').value.toUpperCase()
        };

        if (editingId) {
            const index = cavalos.findIndex(c => c.id === editingId);
            if (index !== -1) {
                cavaloData.id = editingId;
                cavalos[index] = cavaloData;
                utils.showAlert('Cavalo atualizado com sucesso!', 'success');
            }
        } else {
            cavaloData.id = Date.now();
            cavalos.push(cavaloData);
            utils.showAlert('Cavalo cadastrado com sucesso!', 'success');
        }

        saveCavalos();
        renderCavalos();
        closeModal();
    }

    function deleteCavalo(id) {
        if (confirm('Tem certeza que deseja excluir este cavalo?')) {
            cavalos = cavalos.filter(c => c.id !== id);
            saveCavalos();
            renderCavalos();
            utils.showAlert('Cavalo excluído com sucesso!', 'success');
        }
    }

    function getAllCavalos() {
        return cavalos;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('cavalo-form');
        if (form) {
            form.addEventListener('submit', saveCavalo);
        }
    });

    return {
        load: loadCavalos,
        getAll: getAllCavalos,
        openModal,
        closeModal,
        edit: openModal,
        delete: deleteCavalo
    };
})();