window.settingsModule = (function() {
    let settings = { pointsPerEconomy: 10, penaltyPerOccurrence: 100, resetMonthly: false, globalGoal: 3.0 };
    let dbId = null; 

    async function load() {
        const { data, error } = await window.supabaseClient.from('configuracoes').select('*').limit(1);
        if (!error && data && data.length > 0) {
            dbId = data[0].id;
            // Tratamento para garantir que ele leia do banco mesmo se tiver vírgula
            const rawGoal = String(data[0].global_goal || '3.0').replace(',', '.');
            settings = {
                pointsPerEconomy: parseFloat(data[0].points_per_economy),
                penaltyPerOccurrence: parseFloat(data[0].penalty_per_occurrence),
                resetMonthly: data[0].reset_monthly,
                globalGoal: parseFloat(rawGoal)
            };
        }
        
        const pointsInput = document.getElementById('points-per-economy');
        const penaltyInput = document.getElementById('penalty-per-occurrence');
        const resetSelect = document.getElementById('reset-score');
        const goalInput = document.getElementById('global-goal');
        if (pointsInput) pointsInput.value = settings.pointsPerEconomy;
        if (penaltyInput) penaltyInput.value = settings.penaltyPerOccurrence;
        if (resetSelect) resetSelect.value = settings.resetMonthly;
        if (goalInput) goalInput.value = settings.globalGoal;
    }

    async function save() {
        const pointsInput = document.getElementById('points-per-economy').value;
        const penaltyInput = document.getElementById('penalty-per-occurrence').value;
        const resetSelect = document.getElementById('reset-score').value === 'true';
        
        // Blindagem: Troca vírgula por ponto antes de salvar
        const rawGoalInput = document.getElementById('global-goal').value;
        const safeGoalInput = String(rawGoalInput).replace(',', '.');

        settings = {
            pointsPerEconomy: parseFloat(pointsInput),
            penaltyPerOccurrence: parseFloat(penaltyInput),
            resetMonthly: resetSelect,
            globalGoal: parseFloat(safeGoalInput) || 3.0
        };

        const dbPayload = {
            points_per_economy: settings.pointsPerEconomy,
            penalty_per_occurrence: settings.penaltyPerOccurrence,
            reset_monthly: settings.resetMonthly,
            global_goal: settings.globalGoal
        };

        if (dbId) {
            await window.supabaseClient.from('configuracoes').update(dbPayload).eq('id', dbId);
        } else {
            const { data } = await window.supabaseClient.from('configuracoes').insert([dbPayload]).select();
            if (data && data.length > 0) dbId = data[0].id;
        }

        if (window.driversModule) {
            window.driversModule.updateScores();
        }
        utils.showAlert('Configurações salvas no Supabase com sucesso!', 'success');
    }

    function get() { return settings; }

    async function clearAllData() {
        if (confirm("ATENÇÃO: Você está prestes a apagar TODAS as viagens importadas do banco de dados.\n\nOs cadastros de Motoristas, Cavalos e Ocorrências NÃO SERÃO ALTERADOS. Deseja continuar?")) {
            await window.supabaseClient.from('viagens').delete().neq('id', 0);
            utils.showAlert('Todas as viagens foram apagadas com sucesso.', 'success');
            setTimeout(() => { window.location.reload(); }, 1500);
        }
    }

    return { load, save, get, clearAllData };
})();