// --- Configuration ---
const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api';

// --- State Management ---
const state = {
    isLoggedIn: false,
    user: null, // { id: 1, name: 'Alex', avatar: '...' }
    items: [],
    categories: [],
    items: [],
    categories: [],
    selectedCategory: null, // null means 'Todos'
    searchQuery: '',
    currentChatId: null,
    chatPollInterval: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchCategories();

    // Check for saved session
    const savedUser = localStorage.getItem('retrueque_user');
    if (savedUser) {
        state.user = JSON.parse(savedUser);
        state.isLoggedIn = true;
        showToast(`Bienvenido de nuevo, ${state.user.name}`, 'success');
    }

    renderNavbar(); // Always render navbar (guest or logged in)
    fetchItems();
});

function setupEventListeners() {
    // Login Form
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Guest Button
    document.getElementById('guest-btn').addEventListener('click', enterAsGuest);

    // Buttons that trigger upload
    document.getElementById('hero-upload-btn').addEventListener('click', () => {
        if (!state.isLoggedIn) openModal('auth-modal');
        else showUploadModal();
    });
    document.getElementById('fab-upload-btn').addEventListener('click', () => {
        if (!state.isLoggedIn) openModal('auth-modal');
        else showUploadModal();
    });

    // Search Input Listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.trim();
            renderGrid();
        });
    }

    // Reset App (Logo click)
    document.getElementById('reset-app-btn').addEventListener('click', resetApp);

    // Modal buttons
    document.getElementById('modal-login-btn').addEventListener('click', logout); // Reuse logout to go to login screen
    document.getElementById('modal-close-btn').addEventListener('click', () => closeModal('auth-modal'));

    // Chat Form Listener (Moved here for safety)
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }

    const chatBackBtn = document.getElementById('chat-back-btn');
    if (chatBackBtn) {
        chatBackBtn.addEventListener('click', () => {
            document.getElementById('chat-conversation').classList.add('hidden');
            document.getElementById('chat-list-sidebar').classList.remove('hidden');
        });
    }

    // Click outside modal
    window.onclick = function (event) {
        const authModal = document.getElementById('auth-modal');
        const uploadModal = document.getElementById('upload-modal'); // We will create this
        if (event.target === authModal) closeModal('auth-modal');
        if (event.target === uploadModal) closeModal('upload-modal');
    }
}

async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content || !state.currentChatId) return;

    // Speculative UI update?
    input.value = ''; // clear immediately

    try {
        const payload = {
            chatId: parseInt(state.currentChatId),
            senderId: parseInt(state.user.id),
            content
        };
        console.log("Sending message:", payload);

        const res = await fetch(`${API_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Failed to send');

        // Immediate updates
        loadMessages(state.currentChatId);
        loadUserChats();
    } catch (e) {
        console.error("Send error:", e);
        showToast('Error al enviar: ' + e.message, 'error');
    }
}

// --- API Calls ---

async function fetchCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        if (response.ok) {
            state.categories = await response.json();
            renderCategories();
        }
    } catch (e) {
        console.error("Failed to load categories", e);
    }
}

async function fetchItems() {
    try {
        const response = await fetch(`${API_URL}/items`);
        if (!response.ok) throw new Error('Failed to fetch items');
        state.items = await response.json();
        renderGrid();
    } catch (error) {
        console.error(error);
        showToast('Error al cargar productos.', 'error');
    }
}

async function loginUser(email, password) {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!response.ok) throw new Error('Invalid credentials');
        const data = await response.json();
        return data.user;
    } catch (error) {
        throw error;
    }
}

async function registerUser(name, email, password) {
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        if (!response.ok) throw new Error('Registration failed');
        const data = await response.json();
        return data.user;
    } catch (error) {
        throw error;
    }
}

// --- Logic ---

async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const emailInput = document.getElementById('email').value;
    const passwordInput = document.getElementById('password').value; // We need to add ID to password input
    const isRegistering = btn.dataset.action === 'register'; // We'll add a toggle
    const nameInput = document.getElementById('name-input'); // If exists

    const originalText = btn.innerText;
    btn.innerText = 'Procesando...';
    btn.classList.add('opacity-75');

    try {
        let user;
        if (isRegistering) {
            user = await registerUser(nameInput.value, emailInput, passwordInput);
            showToast('¡Cuenta creada con éxito!', 'success');
        } else {
            user = await loginUser(emailInput, passwordInput);
            showToast(`¡Hola de nuevo, ${user.name}!`, 'success');
        }

        // Use finishLogin for consistency
        finishLogin(user);

    } catch (error) {
        showToast(error.message || 'Error en autenticación', 'error');
    } finally {
        btn.innerText = originalText;
        btn.classList.remove('opacity-75');
    }
}

// Separate function for successful login actions
function finishLogin(user) {
    state.isLoggedIn = true;
    state.user = user;

    // Save to localStorage
    localStorage.setItem('retrueque_user', JSON.stringify(user));

    showDashboard();
}

function enterAsGuest() {
    state.isLoggedIn = false;
    state.user = null;
    showDashboard();
    showToast('Navegando como invitado', 'info');
}

function showDashboard() {
    // Hide Login
    const loginView = document.getElementById('login-view');
    loginView.style.transform = 'translateY(-100%)';
    setTimeout(() => {
        loginView.classList.add('hidden');
        loginView.style.transform = 'translateY(0)'; // Reset for next time
    }, 500);

    // Show Dashboard
    const dashboard = document.getElementById('dashboard-view');
    dashboard.classList.remove('hidden');
    dashboard.classList.remove('opacity-0');

    renderNavbar();
    fetchItems();
}

function resetApp() {
    location.reload();
}

function logout() {
    const dashboard = document.getElementById('dashboard-view');
    dashboard.classList.add('opacity-0');
    setTimeout(() => {
        dashboard.classList.add('hidden');
        document.getElementById('login-view').classList.remove('hidden');
        document.getElementById('login-form').reset();
    }, 500);

    closeModal('auth-modal');
    state.isLoggedIn = false;
    state.user = null;
    localStorage.removeItem('retrueque_user');
    renderNavbar();
}

function setCategory(id) {
    state.selectedCategory = id;
    renderCategories();
    renderGrid();
}


// --- Upload Logic ---
function showUploadModal() {
    // Create modal if not exists or show it
    let modal = document.getElementById('upload-modal');
    if (!modal) {
        createUploadModal();
        modal = document.getElementById('upload-modal');
    }

    // Repopulate categories
    const catSelect = document.getElementById('upload-category');
    catSelect.innerHTML = state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    openModal('upload-modal');
}

function createUploadModal() {
    const div = document.createElement('div');
    div.id = 'upload-modal';
    div.className = 'fixed inset-0 bg-black/50 z-[60] hidden flex items-center justify-center backdrop-blur-sm p-4';
    div.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl scale-95 opacity-0 transition-all duration-300 transform">
            <h3 class="text-xl font-bold text-slate-800 mb-4">Subir Nuevo Objeto</h3>
            <form id="upload-form" class="space-y-4">
                <div>
                     <label class="block text-sm font-medium text-slate-700">Título</label>
                     <input type="text" id="upload-title" class="w-full border rounded p-2" required>
                </div>
                <div>
                     <label class="block text-sm font-medium text-slate-700">Categoría</label>
                     <select id="upload-category" class="w-full border rounded p-2"></select>
                </div>
                <div>
                     <label class="block text-sm font-medium text-slate-700">URL Imagen</label>
                     <input type="url" id="upload-image" class="w-full border rounded p-2" placeholder="https://..." required>
                </div>
                <div>
                     <label class="block text-sm font-medium text-slate-700">¿Qué buscas a cambio?</label>
                     <input type="text" id="upload-wants" class="w-full border rounded p-2" required>
                </div>
                <button type="submit" class="w-full bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">Publicar</button>
                <button type="button" onclick="closeModal('upload-modal')" class="w-full bg-slate-100 text-slate-600 py-2 rounded mt-2 hover:bg-slate-200">Cancelar</button>
            </form>
        </div>
    `;
    document.body.appendChild(div);

    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('upload-title').value;
        const categoryId = document.getElementById('upload-category').value;
        const image = document.getElementById('upload-image').value;
        const wants = document.getElementById('upload-wants').value;

        try {
            const res = await fetch(`${API_URL}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    categoryId,
                    image,
                    wants,
                    userId: state.user.id
                })
            });

            if (res.ok) {
                showToast('¡Objeto publicado!', 'success');
                closeModal('upload-modal');
                fetchItems(); // Refresh grid
            } else {
                showToast('Error al publicar', 'error');
            }
        } catch (err) {
            console.error(err);
        }
    });
}

// --- Utils ---

// --- Chat Logic ---

window.triggerTrade = async function (itemId, itemTitle, itemOwnerId, ownerName, ownerAvatar) {
    if (!state.isLoggedIn) {
        openModal('auth-modal');
        return;
    }

    if (itemOwnerId === state.user.id) {
        showToast('No puedes ofertar en tu propio producto', 'error');
        return;
    }

    // Initialize Chat
    try {
        const res = await fetch(`${API_URL}/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userAId: state.user.id,
                userBId: itemOwnerId,
                itemId: itemId
            })
        });
        const chat = await res.json();

        // Open Chat Modal
        openChat(chat.id, ownerName, ownerAvatar, itemTitle);
    } catch (e) {
        console.error(e);
        showToast('Error al iniciar chat', 'error');
    }
}

window.toggleChatList = function () {
    if (!state.isLoggedIn) return;
    openModal('chat-modal');
    loadUserChats();
    // Default: Reset view
    document.getElementById('chat-list-sidebar').classList.remove('hidden');
    document.getElementById('chat-conversation').classList.add('hidden', 'md:flex');
}

window.openChat = async function (chatId, name, avatar, subtitle) {
    state.currentChatId = chatId;

    // UI Updates
    document.getElementById('chat-username').innerText = name;
    document.getElementById('chat-avatar').src = avatar || `https://ui-avatars.com/api/?name=${name}`;
    document.getElementById('chat-item-title').innerText = subtitle || 'Chat de Trueque';

    // Mobile View Switch
    document.getElementById('chat-list-sidebar').classList.add('hidden', 'md:flex');
    document.getElementById('chat-conversation').classList.remove('hidden');

    openModal('chat-modal');
    loadMessages(chatId);

    // Start Polling (Faster for real-time feel)
    if (state.chatPollInterval) clearInterval(state.chatPollInterval);
    state.chatPollInterval = setInterval(() => loadMessages(chatId), 1000); // Poll every 1s
}

async function loadUserChats() {
    try {
        const res = await fetch(`${API_URL}/chats/${state.user.id}`);
        const chats = await res.json();
        const list = document.getElementById('retrueque-chat-list');

        if (chats.length === 0) {
            list.innerHTML = '<p class="text-xs text-slate-400 text-center mt-4">No tienes mensajes aún.</p>';
            return;
        }

        list.innerHTML = chats.map(chat => {
            const otherUser = chat.userAId === state.user.id ? chat.userB : chat.userA;
            const lastMsg = chat.messages[0] ? chat.messages[0].content : 'Inicio del chat';
            const isActive = chat.id === state.currentChatId ? 'bg-brand-50 border-brand-200' : 'bg-white hover:bg-slate-50 border-transparent';

            return `
            <div onclick="openChat(${chat.id}, '${otherUser.name}', '${otherUser.avatar}', '${chat.item ? chat.item.title : 'Chat General'}')" 
                 class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${isActive}">
                <img src="${otherUser.avatar}" class="w-10 h-10 rounded-full bg-slate-200">
                <div class="overflow-hidden">
                    <h5 class="font-bold text-slate-800 text-sm truncate">${otherUser.name}</h5>
                    <p class="text-xs text-slate-500 truncate">${lastMsg}</p>
                </div>
            </div>
            `;
        }).join('');
    } catch (e) { console.error(e); }
}

async function loadMessages(chatId) {
    if (!state.currentChatId || state.currentChatId !== chatId) return;
    try {
        const res = await fetch(`${API_URL}/chats/messages/${chatId}`);
        const messages = await res.json();
        renderMessages(messages);
    } catch (e) {
        console.error(e);
    }
}

function renderMessages(messages) {
    const container = document.getElementById('retrueque-messages');
    // Simple diffing could be better, but full replace for MVP
    container.innerHTML = messages.map(msg => {
        const isMe = msg.senderId === state.user.id;
        const align = isMe ? 'self-end bg-brand-600 text-white rounded-br-none' : 'self-start bg-white border border-slate-200 text-slate-700 rounded-bl-none';

        let contentHtml = `<p>${msg.content}</p>`;

        // Image detection (basic)
        const isImageUrl = (url) => /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url);
        if (msg.content.startsWith('http') && isImageUrl(msg.content)) {
            contentHtml = `<img src="${msg.content}" alt="Image" class="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition" onclick="window.open('${msg.content}', '_blank')">`;
        } else if (msg.content.startsWith('http')) {
            contentHtml = `<a href="${msg.content}" target="_blank" class="underline break-all">${msg.content}</a>`;
        }

        return `
            <div class="max-w-[75%] px-4 py-2 rounded-2xl shadow-sm text-sm ${align}">
                ${contentHtml}
                <div class="text-[10px] opacity-70 mt-1 text-right">${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `;
    }).join('');
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Send Message
// Event listeners moved to setupEventListeners()

// Hook into modal close to stop polling
const originalCloseModal = window.closeModal;
window.closeModal = function (id) {
    originalCloseModal(id);
    if (id === 'chat-modal' && state.chatPollInterval) {
        clearInterval(state.chatPollInterval);
        state.chatPollInterval = null;
        state.currentChatId = null;
    }
}


window.triggerUpload = function () {
    if (!state.isLoggedIn) openModal('auth-modal');
    else showUploadModal();
}
window.setCategory = setCategory; // Global access
window.logout = logout;
window.openLogin = openLogin;
window.closeModal = closeModal;

function openLogin() {
    const loginView = document.getElementById('login-view');
    loginView.classList.remove('hidden');
    // Animate in?
}

function openModal(id) {
    const modal = document.getElementById(id);
    const content = modal.querySelector('div[class*="bg-white"]');
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    const content = modal.querySelector('div[class*="bg-white"]');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = { success: 'bg-emerald-500 text-white', error: 'bg-red-500 text-white', info: 'bg-slate-800 text-white' };
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.className = `${colors[type]} px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-10 opacity-0 min-w-[300px]`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span class="font-medium text-sm">${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-x-10', 'opacity-0'));
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-x-10'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function renderNavbar() {
    const navArea = document.getElementById('nav-user-area');
    if (state.isLoggedIn) {
        navArea.innerHTML = `
            <button onclick="toggleChatList()" class="relative p-2 text-slate-500 hover:text-brand-600 transition">
                <i class="fa-regular fa-comment-dots text-xl"></i>
                <span id="nav-msg-badge" class="hidden absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button class="hidden md:flex items-center gap-2 bg-slate-100 hover:bg-slate-200 py-1.5 px-3 rounded-full transition" onclick="triggerUpload()">
                <i class="fa-solid fa-plus text-xs"></i>
                <span class="text-sm font-medium text-slate-700">Subir</span>
            </button>
            <div class="h-8 w-px bg-slate-200 mx-1"></div>
            <div class="flex items-center gap-2 cursor-pointer group relative" onclick="logout()">
                <img src="${state.user.avatar}" class="w-9 h-9 rounded-full border border-slate-200" alt="Avatar">
                <div class="hidden sm:block text-sm text-left">
                    <p class="font-bold text-slate-700 leading-none">${state.user.name}</p>
                    <p class="text-xs text-slate-400">Usuario</p>
                </div>
                <div class="absolute top-10 right-0 bg-white shadow-lg rounded-lg p-2 w-32 hidden group-hover:block border border-slate-100">
                    <div class="text-xs text-red-500 font-bold p-2 hover:bg-red-50 rounded">Cerrar Sesión</div>
                </div>
            </div>
        `;
    } else {
        navArea.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider border border-slate-200 px-2 py-1 rounded hidden sm:inline-block">Modo Invitado</span>
                <button onclick="openLogin()" class="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2 px-5 rounded-full shadow-md transition">Ingresar</button>
            </div>
        `;
    }
}

function renderCategories() {
    const list = document.getElementById('category-list');

    // Manual "All" category
    const allActive = state.selectedCategory === null ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900';

    let html = `
        <li onclick="setCategory(null)" class="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${allActive}">
            <i class="fa-solid fa-layer-group w-5 text-center ${state.selectedCategory === null ? 'text-brand-600' : 'text-slate-400'}"></i>
            Todos
        </li>
    `;

    html += state.categories.map(cat => {
        const isActive = state.selectedCategory === cat.id;
        const classes = isActive ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900';
        const iconColor = isActive ? 'text-brand-600' : 'text-slate-400';
        return `
        <li onclick="setCategory(${cat.id})" class="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${classes}">
            <i class="fa-solid ${cat.icon} w-5 text-center ${iconColor}"></i>
            ${cat.name}
        </li>
        `;
    }).join('');

    list.innerHTML = html;

    // Render Mobile Categories
    const mobileList = document.getElementById('mobile-category-list');
    if (mobileList) {
        let mobileHtml = `
            <button onclick="setCategory(null)" class="px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${state.selectedCategory === null ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}">
                Todos
            </button>
        `;
        mobileHtml += state.categories.map(cat => `
            <button onclick="setCategory(${cat.id})" class="px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${state.selectedCategory === cat.id ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}">
                ${cat.name}
            </button>
        `).join('');
        mobileList.innerHTML = mobileHtml;
    }
}

function renderGrid() {
    const grid = document.getElementById('items-grid');

    let displayItems = state.items;

    // Filter by category
    if (state.selectedCategory !== null) {
        displayItems = displayItems.filter(item => item.categoryId === state.selectedCategory);
    }

    // Filter by search query (Flexible: accents/case insensitive)
    if (state.searchQuery) {
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const query = normalize(state.searchQuery);

        displayItems = displayItems.filter(item =>
            normalize(item.title).includes(query) ||
            normalize(item.category).includes(query)
        );
    }

    if (displayItems.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500"><p>No hay productos disponibles en esta categoría.</p></div>';
        return;
    }

    grid.innerHTML = displayItems.map(item => `
        <div class="group bg-white border border-slate-100 rounded-xl overflow-hidden hover:shadow-xl transition duration-300 flex flex-col h-full relative">
            <div class="relative h-48 overflow-hidden bg-slate-100">
                <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                <span class="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full"><i class="fa-solid fa-location-dot mr-1"></i>${item.distance}</span>
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8"><span class="text-white text-xs font-medium px-2 py-0.5 rounded bg-brand-500/80">${item.condition}</span></div>
            </div>
            <div class="p-4 flex-1 flex flex-col">
                <div class="flex-1">
                    <div class="text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">${item.category}</div>
                    <h3 class="font-bold text-slate-800 text-lg leading-tight mb-2 group-hover:text-brand-600 transition">${item.title}</h3>
                    <div class="bg-amber-50 rounded-lg p-2 mb-3 border border-amber-100"><p class="text-xs text-amber-700 font-bold uppercase mb-1">Busca a cambio:</p><p class="text-sm text-slate-700 line-clamp-2">${item.wants}</p></div>
                </div>
                <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div class="flex items-center gap-2"><div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-bold">${(item.userName || '?').charAt(0)}</div><span class="text-xs text-slate-500">${item.userName || 'Usuario'}</span></div>
                    <button onclick="triggerTrade(${item.id}, '${item.title.replace(/'/g, "\\'")}', ${item.userId}, '${(item.userName || 'Usuario').replace(/'/g, "\\'")}', '${item.userAvatar || ''}')" class="text-sm bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white px-3 py-1.5 rounded-lg font-medium transition"><i class="fa-solid fa-right-left mr-1"></i> Ofertar</button>
                </div>
            </div>
        </div>
    `).join('');
}
