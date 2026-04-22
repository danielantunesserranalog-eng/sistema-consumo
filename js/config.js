// ==================== CONFIGURAÇÃO DO SUPABASE ==================== 
const SUPABASE_URL = 'https://qhbenzrxajbeaatwxtlj.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoYmVuenJ4YWpiZWFhdHd4dGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzQ2OTksImV4cCI6MjA5MjMxMDY5OX0.2ddgnsjmxqmX9xk68m9duUmzAO2n2OAvEpOgHevRwkU'; 
let supabaseClient = null; 

// NOVO BANCO DE DADOS - HISTÓRICO DE VIAGENS
const SUPABASE_HISTORICO_URL = 'https://qnpwkvazkntbqjbwegcp.supabase.co';
const SUPABASE_HISTORICO_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHdrdmF6a250YnFqYndlZ2NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzM2ODksImV4cCI6MjA5MDc0OTY4OX0.ase7CqxAGDuj588lMmow9CnO4BfGFnvIKRaULJQLmmA';
let supabaseClientHistorico = null;

// ==================== ESTADO GLOBAL DA APLICAÇÃO ==================== 
let currentMetaKML = 1.80; 
let currentMetaViagens = 2.0; 

const PLACAS_IGNORADAS = ['GSR0001', 'GSR0002', 'GSR0007', 'GSR0008', 'RBJ6J29']; 

let rawData = []; 
let rawHistorico = []; // Armazena isoladamente dados do banco de histórico

let dashboardData = { 
    avgConsumption: 0, totalDist: 0, totalFuel: 0, avgTripsPerDay: 0, totalHistoricoTrips: 0,
    drivers: [], trucks: [], alerts: [], criticalDrivers: [] 
}; 

// Variáveis Gráficas
let driverChart = null, truckChart = null, timeChart = null, evolutionChart = null; 
let currentPage = 'dashboard'; 

// Variáveis de Importação
let isImporting = false; 
let importStats = { 
    total_linhas_lidas: 0, trechos_sem_motorista: 0, placas_ignoradas: 0, 
    viagens_curtas: 0, viagens_consolidadas_salvas: 0, erros: 0 
}; 

function initSupabase() {     
    if (!supabaseClient && window.supabase) {         
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);         
    }
    if (!supabaseClientHistorico && window.supabase) {
        supabaseClientHistorico = window.supabase.createClient(SUPABASE_HISTORICO_URL, SUPABASE_HISTORICO_KEY);
    }
    return !!supabaseClient && !!supabaseClientHistorico; 
}