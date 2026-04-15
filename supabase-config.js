// supabase-config.js - Configuração centralizada do Supabase
// Este arquivo gerencia toda a comunicação com o Supabase

// ==================== CONFIGURAÇÕES DO SUPABASE ====================
const SUPABASE_CONFIG = {
    url: 'https://elvbhhkxfqzfvigwcjno.supabase.co',
    anonKey: 'sb_publishable_FnVGCNsEteWJJnMCfFZoCw_tBSdhd4M',
    tables: {
        viagens: 'viagens_motoristas'
    }
};

// Inicializa o cliente Supabase
const supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
);

// ==================== FUNÇÕES DE BANCO DE DADOS ====================

/**
 * Testa a conexão com o Supabase
 * @returns {Promise<boolean>} - Retorna true se conectado com sucesso
 */
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .select('count', { count: 'exact', head: true });
        
        if (error && error.code === '42P01') {
            console.warn('Tabela não encontrada. Execute o SQL de criação.');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Erro ao conectar com Supabase:', error);
        return false;
    }
}

/**
 * Busca todas as viagens
 * @returns {Promise<Array>} - Lista de viagens
 */
async function getAllTrips() {
    try {
        const { data, error } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao buscar viagens:', error);
        return [];
    }
}

/**
 * Busca viagens por motorista
 * @param {string} motorista - Nome do motorista
 * @returns {Promise<Array>} - Lista de viagens do motorista
 */
async function getTripsByDriver(motorista) {
    try {
        const { data, error } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .select('*')
            .eq('motorista', motorista)
            .order('inicio', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao buscar viagens do motorista:', error);
        return [];
    }
}

/**
 * Busca viagens por placa
 * @param {string} placa - Placa do veículo
 * @returns {Promise<Array>} - Lista de viagens do veículo
 */
async function getTripsByPlate(placa) {
    try {
        const { data, error } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .select('*')
            .eq('placa', placa)
            .order('inicio', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao buscar viagens da placa:', error);
        return [];
    }
}

/**
 * Verifica se uma viagem já existe (baseado em placa + inicio)
 * @param {string} placa - Placa do veículo
 * @param {string} inicio - Data/hora de início
 * @returns {Promise<boolean>} - True se existir
 */
async function tripExists(placa, inicio) {
    try {
        const { data, error } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .select('id')
            .eq('placa', placa)
            .eq('inicio', inicio)
            .single();
        
        if (error && error.code === 'PGRST116') return false; // Não encontrado
        if (error) throw error;
        return !!data;
    } catch (error) {
        console.error('Erro ao verificar existência da viagem:', error);
        return false;
    }
}

/**
 * Insere múltiplas viagens (apenas as que não existem)
 * @param {Array} trips - Lista de viagens para inserir
 * @returns {Promise<Object>} - Resultado da operação
 */
async function insertNewTrips(trips) {
    try {
        // Verifica duplicatas
        const existingKeys = new Set();
        const { data: existing } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .select('placa, inicio');
        
        if (existing) {
            existing.forEach(item => {
                existingKeys.add(`${item.placa}|${item.inicio}`);
            });
        }
        
        const newTrips = trips.filter(trip => 
            !existingKeys.has(`${trip.placa}|${trip.inicio}`)
        );
        
        if (newTrips.length === 0) {
            return { success: true, inserted: 0, message: 'Nenhuma nova viagem para inserir' };
        }
        
        const { data, error } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .insert(newTrips)
            .select();
        
        if (error) throw error;
        
        return { 
            success: true, 
            inserted: newTrips.length, 
            data,
            message: `${newTrips.length} novas viagens inseridas`
        };
    } catch (error) {
        console.error('Erro ao inserir viagens:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Insere uma única viagem
 * @param {Object} trip - Dados da viagem
 * @returns {Promise<Object>} - Resultado da operação
 */
async function insertTrip(trip) {
    try {
        const exists = await tripExists(trip.placa, trip.inicio);
        if (exists) {
            return { success: false, message: 'Viagem já existe' };
        }
        
        const { data, error } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .insert([trip])
            .select();
        
        if (error) throw error;
        
        return { success: true, data: data[0], message: 'Viagem inserida com sucesso' };
    } catch (error) {
        console.error('Erro ao inserir viagem:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Atualiza uma viagem existente
 * @param {number} id - ID da viagem
 * @param {Object} updates - Dados para atualizar
 * @returns {Promise<Object>} - Resultado da operação
 */
async function updateTrip(id, updates) {
    try {
        const { data, error } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .update(updates)
            .eq('id', id)
            .select();
        
        if (error) throw error;
        
        return { success: true, data: data[0], message: 'Viagem atualizada com sucesso' };
    } catch (error) {
        console.error('Erro ao atualizar viagem:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deleta uma viagem específica
 * @param {number} id - ID da viagem
 * @returns {Promise<Object>} - Resultado da operação
 */
async function deleteTrip(id) {
    try {
        const { error } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        return { success: true, message: 'Viagem deletada com sucesso' };
    } catch (error) {
        console.error('Erro ao deletar viagem:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deleta todas as viagens
 * @returns {Promise<Object>} - Resultado da operação
 */
async function deleteAllTrips() {
    try {
        const { error } = await supabaseClient
            .from(SUPABASE_CONFIG.tables.viagens)
            .delete()
            .neq('id', 0);
        
        if (error) throw error;
        
        return { success: true, message: 'Todas as viagens foram deletadas' };
    } catch (error) {
        console.error('Erro ao deletar todas viagens:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Obtém estatísticas agregadas
 * @returns {Promise<Object>} - Estatísticas
 */
async function getStatistics() {
    try {
        const trips = await getAllTrips();
        
        if (trips.length === 0) {
            return {
                totalDrivers: 0,
                avgKmpl: 0,
                totalDistance: 0,
                totalFuel: 0,
                totalTrips: 0
            };
        }
        
        const driversSet = new Set();
        let totalKmpl = 0;
        let kmplCount = 0;
        let totalDistance = 0;
        let totalFuel = 0;
        
        trips.forEach(trip => {
            if (trip.motorista) driversSet.add(trip.motorista);
            totalDistance += parseFloat(trip.distancia_km) || 0;
            totalFuel += parseFloat(trip.total_litros) || 0;
            
            const kmpl = parseFloat(trip.km_l);
            if (kmpl && !isNaN(kmpl)) {
                totalKmpl += kmpl;
                kmplCount++;
            }
        });
        
        return {
            totalDrivers: driversSet.size,
            avgKmpl: kmplCount > 0 ? (totalKmpl / kmplCount).toFixed(2) : 0,
            totalDistance: totalDistance.toFixed(1),
            totalFuel: totalFuel.toFixed(1),
            totalTrips: trips.length
        };
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        return null;
    }
}

/**
 * Obtém ranking dos motoristas por eficiência (Km/l)
 * @param {number} limit - Limite de resultados
 * @returns {Promise<Array>} - Ranking
 */
async function getDriverRanking(limit = 10) {
    try {
        const trips = await getAllTrips();
        const driverStats = new Map();
        
        trips.forEach(trip => {
            if (!trip.motorista) return;
            
            if (!driverStats.has(trip.motorista)) {
                driverStats.set(trip.motorista, {
                    nome: trip.motorista,
                    kmlSum: 0,
                    kmlCount: 0,
                    totalDist: 0,
                    totalFuel: 0
                });
            }
            
            const stats = driverStats.get(trip.motorista);
            const kml = parseFloat(trip.km_l);
            if (kml && !isNaN(kml)) {
                stats.kmlSum += kml;
                stats.kmlCount++;
            }
            stats.totalDist += parseFloat(trip.distancia_km) || 0;
            stats.totalFuel += parseFloat(trip.total_litros) || 0;
        });
        
        const ranking = Array.from(driverStats.values())
            .map(driver => ({
                ...driver,
                kmlMedio: driver.kmlCount > 0 ? (driver.kmlSum / driver.kmlCount).toFixed(2) : 0
            }))
            .sort((a, b) => parseFloat(b.kmlMedio) - parseFloat(a.kmlMedio))
            .slice(0, limit);
        
        return ranking;
    } catch (error) {
        console.error('Erro ao obter ranking:', error);
        return [];
    }
}

// Exporta as funções e configurações para uso global
window.SupabaseManager = {
    config: SUPABASE_CONFIG,
    client: supabaseClient,
    testConnection: testSupabaseConnection,
    getAllTrips,
    getTripsByDriver,
    getTripsByPlate,
    tripExists,
    insertNewTrips,
    insertTrip,
    updateTrip,
    deleteTrip,
    deleteAllTrips,
    getStatistics,
    getDriverRanking
};