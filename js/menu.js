// ==================== CONFIGURAÇÃO DOS MENUS ====================

const menuConfig = [
    { 
        id: 'dashboard', 
        icon: 'fas fa-chart-pie', 
        menuLabel: 'Dashboard Principal', 
        pageTitle: 'Visão Geral da Frota', 
        active: true 
    },
    { 
        id: 'indicadores-suzano', 
        icon: 'fas fa-leaf', 
        menuLabel: 'Indicadores Suzano', 
        pageTitle: 'Sustentabilidade e Telemetria Avançada', 
        active: false 
    },
    { 
        id: 'motorista-destaque', 
        icon: 'fas fa-star', 
        menuLabel: 'Motorista Destaque', 
        pageTitle: 'Top 3 Motoristas (Pódio)', 
        active: false 
    },
    { 
        id: 'consumo-evolution', 
        icon: 'fas fa-list-alt', 
        menuLabel: 'Histórico Detalhado', 
        pageTitle: 'Histórico Detalhado', 
        active: false 
    },
    { 
        id: 'configuracoes', 
        icon: 'fas fa-sliders-h', 
        menuLabel: 'Gerenciamento de Dados', 
        pageTitle: 'Gerenciamento de Dados', 
        active: false 
    }
];

// Função que injeta o menu no HTML
function renderMenu() {
    const navContainer = document.getElementById('navMenuContainer');
    if (!navContainer) return;

    navContainer.innerHTML = menuConfig.map(item => `
        <a href="#" class="nav-item ${item.active ? 'active' : ''}" data-page="${item.id}">
            <i class="${item.icon}"></i>
            <span>${item.menuLabel}</span>
        </a>
    `).join('');
}

// Função para buscar o título da página selecionada
function getPageTitle(pageId) {
    const page = menuConfig.find(m => m.id === pageId);
    return page ? page.pageTitle : 'SISTEMA_CONSUMO';
}