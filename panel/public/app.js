// Global variables
let currentConfig = null;
let confirmCallback = null;
let refreshInterval = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initUpload();
    loadDashboard();
    startAutoRefresh();
});

// ==================== NAVIGATION ====================

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            switchPage(page);
            
            // Update active state
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function switchPage(page) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    
    // Show selected page
    const pageMap = {
        'dashboard': 'dashboardPage',
        'maps': 'mapsPage',
        'mods': 'modsPage',
        'logs': 'logsPage',
        'config': 'configPage'
    };
    
    const pageId = pageMap[page];
    if (pageId) {
        document.getElementById(pageId).style.display = 'block';
    }
    
    // Load page data
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'maps':
            loadMaps();
            break;
        case 'mods':
            loadMods();
            break;
        case 'logs':
            refreshLogs();
            break;
        case 'config':
            loadConfig();
            break;
    }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();
        
        if (data.success) {
            updateDashboard(data.data);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Failed to load dashboard', 'error');
    }
}

function updateDashboard(data) {
    const { server, game } = data;
    
    // Update status indicator
    const statusDot = document.querySelector('#serverStatus .status-dot');
    const statusText = document.querySelector('#serverStatus span:last-child');
    
    if (server.running) {
        statusDot.className = 'status-dot status-online';
        statusText.textContent = 'Online';
    } else {
        statusDot.className = 'status-dot status-offline';
        statusText.textContent = 'Offline';
    }
    
    // Update stats
    document.getElementById('playerCount').textContent = game.players;
    document.getElementById('maxPlayers').textContent = game.maxPlayers;
    document.getElementById('carCount').textContent = game.players; // Approximate
    document.getElementById('maxCars').textContent = game.maxCars;
    document.getElementById('cpuUsage').textContent = server.cpu.toFixed(1);
    document.getElementById('memUsage').textContent = server.memory.toFixed(1);
    
    // Update server info - FIXED map name display
    document.getElementById('serverName').textContent = game.name;
    const mapName = game.map.replace('/info.json', '').split('/').pop();
    document.getElementById('currentMap').textContent = mapName;
    document.getElementById('serverPort').textContent = game.port;
    document.getElementById('serverPrivate').textContent = game.private ? 'Yes' : 'No';
    document.getElementById('serverPid').textContent = server.pid || 'N/A';
}

function startAutoRefresh() {
    // Refresh dashboard every 5 seconds
    refreshInterval = setInterval(() => {
        if (document.getElementById('dashboardPage').style.display !== 'none') {
            loadDashboard();
        }
    }, 5000);
}

// ==================== MAPS ====================

async function loadMaps() {
    try {
        const response = await fetch('/api/maps');
        const data = await response.json();
        
        if (data.success) {
            displayMaps(data.data.customMaps, data.data.defaultMaps, data.data.currentMap);
        }
    } catch (error) {
        console.error('Error loading maps:', error);
        showToast('Failed to load maps', 'error');
    }
}

function displayMaps(customMaps, defaultMaps, currentMap) {
    const container = document.getElementById('mapsList');
    
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
    
    // Custom Maps Column
    html += '<div>';
    html += '<h4 class="text-lg font-bold mb-4 text-purple-600"><i class="fas fa-puzzle-piece mr-2"></i>Custom Maps</h4>';
    
    if (customMaps.length === 0) {
        html += '<p class="text-gray-500 text-center py-8">No custom maps found</p>';
    } else {
        html += customMaps.map(map => `
            <div class="map-item ${map.path === currentMap ? 'active' : ''}" style="cursor: pointer;">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4 flex-1" onclick="selectMap('${map.path}', '${map.name}')">
                        <i class="fas fa-map text-2xl ${map.path === currentMap ? 'text-green-600' : 'text-purple-600'}"></i>
                        <div>
                            <div class="font-bold">${map.name}</div>
                            <div class="text-sm text-gray-500">${map.file}</div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <div class="text-right">
                            <div class="text-sm font-medium">${map.size}</div>
                            ${map.path === currentMap ? '<span class="text-xs text-green-600 font-bold">ACTIVE</span>' : ''}
                        </div>
                        <button onclick="deleteMap('${map.file}', '${map.name}'); event.stopPropagation();" class="btn btn-danger btn-sm" title="Delete map">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    html += '</div>';
    
    // Default Maps Column
    html += '<div>';
    html += '<h4 class="text-lg font-bold mb-4 text-blue-600"><i class="fas fa-map-marked-alt mr-2"></i>Default Maps</h4>';
    
    html += defaultMaps.map(map => `
        <div class="map-item ${map.path === currentMap ? 'active' : ''}" onclick="selectMap('${map.path}', '${map.name}')">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-map text-2xl ${map.path === currentMap ? 'text-green-600' : 'text-blue-600'}"></i>
                    <div>
                        <div class="font-bold">${map.name}</div>
                        <div class="text-sm text-gray-500">BeamNG Default</div>
                    </div>
                </div>
                <div class="text-right">
                    ${map.path === currentMap ? '<span class="text-xs text-green-600 font-bold">ACTIVE</span>' : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    html += '</div>';
    html += '</div>';
    
    container.innerHTML = html;
}

async function selectMap(mapPath, mapName) {
    const confirmed = await showConfirm(
        'Change Map',
        `Are you sure you want to change to "${mapName}"? You'll need to restart the server after.`
    );
    
    if (!confirmed) return;
    
    try {
        const response = await fetch('/api/maps/change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mapPath })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            loadMaps();
            loadDashboard();
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Error changing map:', error);
        showToast('Failed to change map', 'error');
    }
}

// ==================== MODS ====================

async function loadMods() {
    try {
        const response = await fetch('/api/mods');
        const data = await response.json();
        
        if (data.success) {
            displayMods(data.data.mods);
        }
    } catch (error) {
        console.error('Error loading mods:', error);
        showToast('Failed to load mods', 'error');
    }
}

function displayMods(mods) {
    const container = document.getElementById('modsList');
    
    if (mods.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No mods found</p>';
        return;
    }
    
    container.innerHTML = mods.map(mod => `
        <div class="mod-item">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <i class="fas fa-puzzle-piece text-2xl text-purple-600"></i>
                    <div>
                        <div class="font-bold">${mod.name}</div>
                        <div class="text-sm text-gray-500">
                            ${mod.file} · ${getModTypeLabel(mod.type)}
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="text-right">
                        <div class="text-sm font-medium">${mod.size}</div>
                    </div>
                    <button onclick="deleteMod('${mod.file}')" class="btn btn-danger btn-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function getModTypeLabel(type) {
    const labels = {
        'vehicle': '🚗 Vehicle',
        'ui': '🎨 UI',
        'script': '📜 Script',
        'asset': '🎨 Asset',
        'unknown': '❓ Unknown'
    };
    return labels[type] || labels.unknown;
}

async function deleteMod(filename) {
    const confirmed = await showConfirm(
        'Delete Mod',
        `Are you sure you want to delete "${filename}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/mods/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            loadMods();
            loadMaps(); // Refresh maps too in case it was a map
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting mod:', error);
        showToast('Failed to delete mod', 'error');
    }
}

async function deleteMap(filename, mapName) {
    const confirmed = await showConfirm(
        'Delete Map',
        `Are you sure you want to delete "${mapName}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/mods/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            loadMaps(); // Refresh maps
            loadMods(); // Refresh mods too
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting map:', error);
        showToast('Failed to delete map', 'error');
    }
}

// ==================== UPLOAD ====================

function initUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    });
    
    // File input
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    });
}

async function uploadFile(file) {
    if (!file.name.endsWith('.zip')) {
        showToast('Only .zip files are allowed', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('mod', file);
    
    try {
        showToast('Uploading...', 'info');
        
        const response = await fetch('/api/mods/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            loadMods();
            loadMaps();
            
            // Reset file input
            document.getElementById('fileInput').value = '';
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        showToast('Failed to upload file', 'error');
    }
}

// ==================== SERVER CONTROL ====================

async function startServer() {
    const confirmed = await showConfirm(
        'Start Server',
        'Are you sure you want to start the server?'
    );
    
    if (!confirmed) return;
    
    try {
        showToast('Starting server...', 'info');
        
        const response = await fetch('/api/server/start', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            setTimeout(loadDashboard, 2000);
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Error starting server:', error);
        showToast('Failed to start server', 'error');
    }
}

async function stopServer() {
    const confirmed = await showConfirm(
        'Stop Server',
        'Are you sure you want to stop the server? All players will be disconnected.'
    );
    
    if (!confirmed) return;
    
    try {
        showToast('Stopping server...', 'info');
        
        const response = await fetch('/api/server/stop', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            setTimeout(loadDashboard, 2000);
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Error stopping server:', error);
        showToast('Failed to stop server', 'error');
    }
}

async function restartServer() {
    const confirmed = await showConfirm(
        'Restart Server',
        'Are you sure you want to restart the server? All players will be disconnected temporarily.'
    );
    
    if (!confirmed) return;
    
    try {
        showToast('Restarting server...', 'info');
        
        const response = await fetch('/api/server/restart', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            setTimeout(loadDashboard, 2000);
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Error restarting server:', error);
        showToast('Failed to restart server', 'error');
    }
}

// ==================== LOGS ====================

async function refreshLogs() {
    try {
        const response = await fetch('/api/logs?lines=100');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('logViewer').textContent = data.data.logs;
            
            // Auto scroll to bottom
            const logViewer = document.getElementById('logViewer');
            logViewer.scrollTop = logViewer.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        showToast('Failed to load logs', 'error');
    }
}

// ==================== CONFIG ====================

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        
        if (data.success) {
            currentConfig = data.data;
            displayConfig(data.data);
        }
    } catch (error) {
        console.error('Error loading config:', error);
        showToast('Failed to load config', 'error');
    }
}

function displayConfig(config) {
    const container = document.getElementById('configForm');
    
    let html = '<div class="space-y-6">';
    
    // General section
    html += '<div><h4 class="font-bold text-lg mb-3 text-gray-700">General Settings</h4>';
    html += '<div class="space-y-3">';
    
    for (const [key, value] of Object.entries(config.General || {})) {
        html += `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">${key}</label>
                <input 
                    type="${typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : 'text'}" 
                    id="config_General_${key}"
                    value="${typeof value === 'boolean' ? '' : value}"
                    ${typeof value === 'boolean' && value ? 'checked' : ''}
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    ${key === 'Map' ? 'readonly' : ''}
                >
            </div>
        `;
    }
    
    html += '</div></div>';
    
    // Misc section if exists
    if (config.Misc) {
        html += '<div><h4 class="font-bold text-lg mb-3 text-gray-700">Misc Settings</h4>';
        html += '<div class="space-y-3">';
        
        for (const [key, value] of Object.entries(config.Misc)) {
            html += `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">${key}</label>
                    <input 
                        type="${typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : 'text'}" 
                        id="config_Misc_${key}"
                        value="${typeof value === 'boolean' ? '' : value}"
                        ${typeof value === 'boolean' && value ? 'checked' : ''}
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                </div>
            `;
        }
        
        html += '</div></div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

async function saveConfig() {
    const confirmed = await showConfirm(
        'Save Configuration',
        'Are you sure you want to save the configuration? Restart the server to apply changes.'
    );
    
    if (!confirmed) return;
    
    try {
        // Collect form data
        const newConfig = { General: {}, Misc: {} };
        
        for (const [key, value] of Object.entries(currentConfig.General || {})) {
            const input = document.getElementById(`config_General_${key}`);
            if (input) {
                if (typeof value === 'boolean') {
                    newConfig.General[key] = input.checked;
                } else if (typeof value === 'number') {
                    newConfig.General[key] = parseFloat(input.value);
                } else {
                    newConfig.General[key] = input.value;
                }
            }
        }
        
        for (const [key, value] of Object.entries(currentConfig.Misc || {})) {
            const input = document.getElementById(`config_Misc_${key}`);
            if (input) {
                if (typeof value === 'boolean') {
                    newConfig.Misc[key] = input.checked;
                } else if (typeof value === 'number') {
                    newConfig.Misc[key] = parseFloat(input.value);
                } else {
                    newConfig.Misc[key] = input.value;
                }
            }
        }
        
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        console.error('Error saving config:', error);
        showToast('Failed to save config', 'error');
    }
}

// ==================== UTILITIES ====================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} mr-3"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        
        modal.classList.add('show');
        
        confirmCallback = (result) => {
            modal.classList.remove('show');
            confirmCallback = null;
            resolve(result);
        };
    });
}

function confirmAction(result) {
    if (confirmCallback) {
        confirmCallback(result);
    }
}
