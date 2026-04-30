window.driversModule = (function() {
    let drivers = [];
    let editingId = null;

    async function loadDrivers() {
        const { data, error } = await window.supabaseClient.from('motoristas').select('*').order('created_at', { ascending: false });
        if (!error && data) {
            drivers = data;
        }
        renderDrivers();
        return drivers;
    }

    function renderDrivers() {
        const tbody = document.getElementById('drivers-list');
        if (!tbody) return;
        tbody.innerHTML = drivers.map(driver => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(driver.name)}</td>
                <td>${utils.formatCPF(driver.cpf)}</td>
                <td>${driver.matricula}</td>
                <td><span class="status-badge success">${Math.round(driver.score || 0)} pts</span></td>
                <td><span class="status-badge warning">${driver.occurrences || 0}</span></td>
                <td style="color: #38bdf8; font-weight: 600;">${driver.avg_economy ? utils.formatNumber(driver.avg_economy) : '0.00'} km/L</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary btn-sm btn-icon" title="Editar" onclick="window.driversModule.edit(${driver.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-danger btn-sm btn-icon" style="background: #f59e0b;" title="Adicionar Ocorrência" onclick="window.driversModule.addOccurrence(${driver.id})"><i class="fas fa-exclamation-triangle"></i></button>
                        <button class="btn-danger btn-sm btn-icon" title="Excluir" onclick="window.driversModule.delete(${driver.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function escapeHtml(text) {
        const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }

    function openModal(driverId = null) {
        editingId = driverId;
        const modal = document.getElementById('driver-modal');
        const title = document.getElementById('modal-title');
        if (driverId) {
            const driver = drivers.find(d => d.id === driverId);
            if (driver) {
                document.getElementById('driver-name').value = driver.name;
                document.getElementById('driver-cpf').value = driver.cpf;
                document.getElementById('driver-matricula').value = driver.matricula;
                document.getElementById('driver-goal').value = driver.goal || 3.0;
                title.textContent = 'Editar Motorista';
            }
        } else {
            document.getElementById('driver-form').reset();
            document.getElementById('driver-goal').value = 3.0;
            title.textContent = 'Novo Motorista';
        }
        modal.classList.add('active');
    }

    function closeModal() {
        document.getElementById('driver-modal').classList.remove('active');
        editingId = null;
        document.getElementById('driver-form').reset();
    }

    async function saveDriver(event) {
        event.preventDefault();
        const btn = event.target.querySelector('button[type="submit"]');
        btn.disabled = true;

        const driverData = {
            name: document.getElementById('driver-name').value,
            cpf: document.getElementById('driver-cpf').value,
            matricula: document.getElementById('driver-matricula').value,
            goal: parseFloat(document.getElementById('driver-goal').value)
        };

        if (editingId) {
            await window.supabaseClient.from('motoristas').update(driverData).eq('id', editingId);
            utils.showAlert('Motorista atualizado com sucesso!', 'success');
        } else {
            driverData.occurrences = 0;
            driverData.score = 0;
            driverData.total_distance = 0;
            driverData.total_fuel = 0;
            driverData.avg_economy = 0;
            driverData.last_reset = new Date().toISOString();
            await window.supabaseClient.from('motoristas').insert([driverData]);
            utils.showAlert('Motorista cadastrado no banco de dados!', 'success');
        }

        await loadDrivers();
        closeModal();
        if (window.tripsModule) window.tripsModule.updateDriverStats();
        btn.disabled = false;
    }

    async function deleteDriver(id) {
        if (confirm('Tem certeza que deseja excluir este motorista do banco de dados?')) {
            await window.supabaseClient.from('motoristas').delete().eq('id', id);
            await loadDrivers();
            utils.showAlert('Motorista excluído com sucesso!', 'success');
            if (window.tripsModule) window.tripsModule.updateDriverStats();
        }
    }

    async function addOccurrence(id) {
        const driver = drivers.find(d => d.id === id);
        if (driver) {
            driver.occurrences++;
            await window.supabaseClient.from('motoristas').update({ occurrences: driver.occurrences }).eq('id', driver.id);
            await updateDriverScore(driver);
            await loadDrivers();
            utils.showAlert(`Ocorrência adicionada para ${driver.name}!`, 'warning');
            if (window.rankingModule) window.rankingModule.render();
            if (window.app) window.app.updateDashboard();
        }
    }

    async function updateDriverScore(driver) {
        const settings = window.settingsModule.get();
        const trips = window.tripsModule ? window.tripsModule.getAll() : [];
        const driverTrips = trips.filter(t => t.motorista === driver.name);
        
        let score = 0; let totalDistance = 0; let totalFuel = 0;
        
        driverTrips.forEach(trip => {
            const kml = parseFloat(trip.kml);
            if (!isNaN(kml)) score += kml * settings.pointsPerEconomy;
            totalDistance += parseFloat(trip.distancia_km) || 0;
            totalFuel += parseFloat(trip.total_litros) || 0;
        });

        const newScore = Math.max(0, Math.round(score - (driver.occurrences * settings.penaltyPerOccurrence)));
        const avgEconomy = totalFuel > 0 ? totalDistance / totalFuel : 0;

        let payload = {
            score: newScore,
            total_distance: totalDistance,
            total_fuel: totalFuel,
            avg_economy: avgEconomy
        };

        if (settings.resetMonthly && utils.shouldResetScore(driver.last_reset)) {
            payload.score = 0;
            payload.occurrences = 0;
            payload.last_reset = new Date().toISOString();
            utils.showAlert(`Pontuação de ${driver.name} foi resetada para o novo mês!`, 'info');
        }

        await window.supabaseClient.from('motoristas').update(payload).eq('id', driver.id);
    }

    async function updateAllScores() {
        for (let driver of drivers) {
            await updateDriverScore(driver);
        }
        await loadDrivers();
    }

    function getAllDrivers() { return drivers; }

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('driver-form');
        if (form) form.addEventListener('submit', saveDriver);
    });

    return { load: loadDrivers, getAll: getAllDrivers, openModal, closeModal, edit: openModal, delete: deleteDriver, addOccurrence, updateScores: updateAllScores, updateDriverScore };
})();