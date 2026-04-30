// Settings module
window.settingsModule = (function() {
    let settings = {
        pointsPerEconomy: 10,
        penaltyPerOccurrence: 100,
        resetMonthly: false
    };

    function load() {
        const stored = localStorage.getItem('motorista_padrao_settings');
        if (stored) {
            settings = JSON.parse(stored);
        }
                 
        const pointsInput = document.getElementById('points-per-economy');
        const penaltyInput = document.getElementById('penalty-per-occurrence');
        const resetSelect = document.getElementById('reset-score');
                 
        if (pointsInput) pointsInput.value = settings.pointsPerEconomy;
        if (penaltyInput) penaltyInput.value = settings.penaltyPerOccurrence;
        if (resetSelect) resetSelect.value = settings.resetMonthly;
    }
         
    function save() {
        const pointsInput = document.getElementById('points-per-economy');
        const penaltyInput = document.getElementById('penalty-per-occurrence');
        const resetSelect = document.getElementById('reset-score');
                 
        settings = {
            pointsPerEconomy: parseFloat(pointsInput.value),
            penaltyPerOccurrence: parseFloat(penaltyInput.value),
            resetMonthly: resetSelect.value === 'true'
        };
                 
        localStorage.setItem('motorista_padrao_settings', JSON.stringify(settings));
                 
        if (window.driversModule) {
            window.driversModule.updateScores();
        }
                 
        utils.showAlert('Configurações salvas com sucesso!', 'success');
    }
         
    function get() {
        return settings;
    }

    // NOVA FUNÇÃO: Limpa todos os dados salvos pelo sistema
    function clearAllData() {
        if (confirm("ATENÇÃO: Você está prestes a apagar TODOS os dados do sistema.\nIsso inclui motoristas, viagens, cavalos, ocorrências e configurações.\n\nTem certeza absoluta que deseja continuar?")) {
            
            // Dupla confirmação para evitar cliques acidentais
            if (confirm("Esta é a sua ÚLTIMA AVISO.\n\nOs dados NÃO poderão ser recuperados após essa ação. Deseja realmente APAGAR TUDO?")) {
                
                // Remove as chaves do armazenamento local
                localStorage.removeItem('motorista_padrao_settings');
                localStorage.removeItem('motorista_padrao_drivers');
                localStorage.removeItem('motorista_padrao_trips');
                localStorage.removeItem('motorista_padrao_cavalos');
                localStorage.removeItem('motorista_padrao_ocorrencias');

                utils.showAlert('Todos os dados foram apagados com sucesso.', 'success');

                // Recarrega a página para resetar as listas visuais
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        }
    }
         
    document.addEventListener('DOMContentLoaded', () => {
        load();
    });
         
    return {
        load,
        save,
        get,
        clearAllData
    };
})();