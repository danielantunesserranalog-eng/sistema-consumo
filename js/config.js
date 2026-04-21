// ==================== 1. CONFIGURAÇÃO E ESTADO GLOBAL ==================== 
const SUPABASE_URL = 'https://qhbenzrxajbeaatwxtlj.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoYmVuenJ4YWpiZWFhdHd4dGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzQ2OTksImV4cCI6MjA5MjMxMDY5OX0.2ddgnsjmxqmX9xk68m9duUmzAO2n2OAvEpOgHevRwkU'; 
let supabaseClient = null; 

let currentMetaKML = 1.80; 
let currentMetaViagens = 2.0; 

const PLACAS_IGNORADAS = ['GSR0001', 'GSR0002', 'GSR0007', 'GSR0008']; 

let rawData = []; 
let dashboardData = { 
    avgConsumption: 0, totalDist: 0, totalFuel: 0, avgTripsPerDay: 0, 
    drivers: [], trucks: [], alerts: [], criticalDrivers: [] 
}; 

let driverChart = null, truckChart = null, timeChart = null, evolutionChart = null; 
let currentPage = 'dashboard'; 

let isImporting = false; 
let importStats = { 
    total_linhas_lidas: 0, trechos_sem_motorista: 0, placas_ignoradas: 0, 
    viagens_curtas: 0, viagens_consolidadas_salvas: 0, erros: 0 
}; 

function initSupabase() {     
    if (!supabaseClient && window.supabase) {         
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);         
        return true;     
    }     
    return !!supabaseClient; 
}