// Drivers management module
window.driversModule = (function() {
    let drivers = [];
    let editingId = null;
         
    function loadDrivers() {
        const stored = localStorage.getItem('motorista_padrao_drivers');
        drivers = stored ? JSON.parse(stored) : [];
        renderDrivers();
        return drivers;
    }
         
    function saveDrivers() {
        localStorage.setItem('motorista_padrao_drivers', JSON.stringify(drivers));
    }
         
    function renderDrivers() {
        const tbody = document.getElementById('drivers-list');
        if (!tbody) return;
                 
        tbody.innerHTML = drivers.map(driver => `
            <tr>
                <td style="font-weight: 500; color: #f8fafc;">${escapeHtml(driver.name)}</td>
                <td>${utils.formatCPF(driver.cpf)}</td>
                <td>${driver.matricula}</td>
                <td><span class="status-badge success">${driver.score || 0} pts</span></td>
                <td><span class="status-badge danger">${driver.occurrences || 0}</span></td>
                <td style="color: #38bdf8; font-weight: 600;">${driver.avgEconomy ? utils.formatNumber(driver.avgEconomy) : '0.00'} km/L</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary btn-sm btn-icon" title="Editar" onclick="window.driversModule.edit(${driver.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger btn-sm btn-icon" style="background: #f59e0b;" title="Adicionar Ocorrência" onclick="window.driversModule.addOccurrence(${driver.id})">
                            <i class="fas fa-exclamation-triangle"></i>
                        </button>
                        <button class="btn-danger btn-sm btn-icon" title="Excluir" onclick="window.driversModule.delete(${driver.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
         
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        const modal = document.getElementById('driver-modal');
        modal.classList.remove('active');
        editingId = null;
        document.getElementById('driver-form').reset();
    }
         
    function saveDriver(event) {
        event.preventDefault();
                 
        const driverData = {
            name: document.getElementById('driver-name').value,
            cpf: document.getElementById('driver-cpf').value,
            matricula: document.getElementById('driver-matricula').value,
            goal: parseFloat(document.getElementById('driver-goal').value),
            occurrences: 0,
            score: 0,
            totalDistance: 0,
            totalFuel: 0,
            avgEconomy: 0,
            lastReset: new Date().toISOString()
        };
                 
        if (editingId) {
            const index = drivers.findIndex(d => d.id === editingId);
            if (index !== -1) {
                driverData.id = editingId;
                driverData.occurrences = drivers[index].occurrences;
                driverData.score = drivers[index].score;
                driverData.totalDistance = drivers[index].totalDistance;
                driverData.totalFuel = drivers[index].totalFuel;
                driverData.avgEconomy = drivers[index].avgEconomy;
                drivers[index] = driverData;
                utils.showAlert('Motorista atualizado com sucesso!', 'success');
            }
        } else {
            driverData.id = Date.now();
            drivers.push(driverData);
            utils.showAlert('Motorista cadastrado com sucesso!', 'success');
        }
                 
        saveDrivers();
        renderDrivers();
        closeModal();
                 
        if (window.tripsModule) {
            window.tripsModule.updateDriverStats();
        }
        if (window.rankingModule) {
            window.rankingModule.render();
        }
        if (window.app) {
            window.app.updateDashboard();
        }
    }
         
    function deleteDriver(id) {
        if (confirm('Tem certeza que deseja excluir este motorista?')) {
            drivers = drivers.filter(d => d.id !== id);
            saveDrivers();
            renderDrivers();
            utils.showAlert('Motorista excluído com sucesso!', 'success');
                         
            if (window.tripsModule) {
                window.tripsModule.updateDriverStats();
            }
            if (window.rankingModule) {
                window.rankingModule.render();
            }
            if (window.app) {
                window.app.updateDashboard();
            }
        }
    }
         
    function addOccurrence(id) {
        const driver = drivers.find(d => d.id === id);
        if (driver) {
            driver.occurrences++;
            updateDriverScore(driver);
            saveDrivers();
            renderDrivers();
            utils.showAlert(`Ocorrência adicionada para ${driver.name}!`, 'warning');
                         
            if (window.rankingModule) {
                window.rankingModule.render();
            }
            if (window.app) {
                window.app.updateDashboard();
            }
        }
    }
         
    function updateDriverScore(driver) {
        const settings = JSON.parse(localStorage.getItem('motorista_padrao_settings')) || {
            pointsPerEconomy: 10,
            penaltyPerOccurrence: 100
        };
                 
        const trips = JSON.parse(localStorage.getItem('motorista_padrao_trips')) || [];
        const driverTrips = trips.filter(t => t.motorista === driver.name);
                 
        let score = 0;
        let totalDistance = 0;
        let totalFuel = 0;
                 
        driverTrips.forEach(trip => {
            const kml = parseFloat(trip['Km/l']);
            if (!isNaN(kml)) {
                score += kml * settings.pointsPerEconomy;
            }
            totalDistance += parseFloat(trip['Distância (Km)']) || 0;
            totalFuel += parseFloat(trip['Total Litros Consumido']) || 0;
        });
                 
        driver.score = Math.max(0, score - (driver.occurrences * settings.penaltyPerOccurrence));
        driver.totalDistance = totalDistance;
        driver.totalFuel = totalFuel;
        driver.avgEconomy = totalFuel > 0 ? totalDistance / totalFuel : 0;
                 
        // Reset score if needed
        if (settings.resetMonthly && utils.shouldResetScore(driver.lastReset)) {
            driver.score = 0;
            driver.occurrences = 0;
            driver.lastReset = new Date().toISOString();
            utils.showAlert(`Pontuação de ${driver.name} foi resetada para o novo mês!`, 'info');
        }
    }
         
    function getAllDrivers() {
        return drivers;
    }
         
    function updateAllScores() {
        drivers.forEach(driver => updateDriverScore(driver));
        saveDrivers();
        renderDrivers();
    }
         
    // Event listeners
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('driver-form');
        if (form) {
            form.addEventListener('submit', saveDriver);
        }
                 
        loadDrivers();
    });
         
    return {
        load: loadDrivers,
        getAll: getAllDrivers,
        openModal,
        closeModal,
        edit: openModal,
        delete: deleteDriver,
        addOccurrence,
        updateScores: updateAllScores,
        updateDriverScore
    };
})();