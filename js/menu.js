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
    // Para adicionar um novo menu, basta colocar uma vírgula na chave acima e adicionar um novo bloco!
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