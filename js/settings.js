window.settingsModule = (function() {
    let settings = { pointsPerEconomy: 10, penaltyPerOccurrence: 100, resetMonthly: false };
    let dbId = null; // Guarda o ID do banco se existir

    async function load() {
        const { data, error } = await window.supabaseClient.from('configuracoes').select('*').limit(1);
        if (!error && data && data.length > 0) {
            dbId = data[0].id;
            settings = {
                pointsPerEconomy: parseFloat(data[0].points_per_economy),
                penaltyPerOccurrence: parseFloat(data[0].penalty_per_occurrence),
                resetMonthly: data[0].reset_monthly
            };
        }

        const pointsInput = document.getElementById('points-per-economy');
        const penaltyInput = document.getElementById('penalty-per-occurrence');
        const resetSelect = document.getElementById('reset-score');

        if (pointsInput) pointsInput.value = settings.pointsPerEconomy;
        if (penaltyInput) penaltyInput.value = settings.penaltyPerOccurrence;
        if (resetSelect) resetSelect.value = settings.resetMonthly;
    }

    async function save() {
        const pointsInput = document.getElementById('points-per-economy').value;
        const penaltyInput = document.getElementById('penalty-per-occurrence').value;
        const resetSelect = document.getElementById('reset-score').value === 'true';

        settings = {
            pointsPerEconomy: parseFloat(pointsInput),
            penaltyPerOccurrence: parseFloat(penaltyInput),
            resetMonthly: resetSelect
        };

        const dbPayload = {
            points_per_economy: settings.pointsPerEconomy,
            penalty_per_occurrence: settings.penaltyPerOccurrence,
            reset_monthly: settings.resetMonthly
        };

        if (dbId) {
            await window.supabaseClient.from('configuracoes').update(dbPayload).eq('id', dbId);
        } else {
            const { data } = await window.supabaseClient.from('configuracoes').insert([dbPayload]).select();
            if (data) dbId = data[0].id;
        }

        if (window.driversModule) {
            window.driversModule.updateScores();
        }

        utils.showAlert('Configurações salvas no Supabase com sucesso!', 'success');
    }

    function get() { return settings; }

    async function clearAllData() {
        if (confirm("ATENÇÃO: Você está prestes a apagar TODOS os dados do Supabase.\nIsso inclui motoristas, viagens, cavalos e ocorrências.\n\nTem certeza absoluta?")) {
            if (confirm("Este é o ÚLTIMO AVISO. Os dados NÃO poderão ser recuperados. APAGAR TUDO?")) {
                await window.supabaseClient.from('motoristas').delete().neq('id', 0);
                await window.supabaseClient.from('cavalos').delete().neq('id', 0);
                await window.supabaseClient.from('ocorrencias').delete().neq('id', 0);
                await window.supabaseClient.from('viagens').delete().neq('id', 0);
                
                utils.showAlert('Banco de dados na nuvem resetado com sucesso.', 'success');
                setTimeout(() => { window.location.reload(); }, 1500);
            }
        }
    }

    return { load, save, get, clearAllData };
})();