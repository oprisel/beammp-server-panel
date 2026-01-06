const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const util = require('util');
const toml = require('toml');
const AdmZip = require('adm-zip');
require('dotenv').config();

const execPromise = util.promisify(exec);
const app = express();

// Configuration
const CONFIG = {
    port: process.env.PORT || 3000,
    beammpPath: process.env.BEAMMP_PATH || '/mnt/stocare/beam',
    beammpExecutable: process.env.BEAMMP_EXECUTABLE || 'BeamMP-Server.ubuntu.22.04.x86_64',
    configFile: process.env.CONFIG_FILE || 'ServerConfig.toml',
    resourcesPath: process.env.RESOURCES_PATH || '/mnt/stocare/beam/Resources/Client',
    serverLog: process.env.SERVER_LOG || '/mnt/stocare/beam/Server.log',
    maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 2000
};

// Large file detection threshold (800MB)
const MAX_ZIP_SIZE_FOR_DETECTION = 800 * 1024 * 1024;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(fileUpload({
    limits: { fileSize: CONFIG.maxUploadSize * 1024 * 1024 },
    abortOnLimit: true,
    createParentPath: true,
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

// CORS pentru development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// ==================== UTILITY FUNCTIONS ====================

// Read TOML config
async function readConfig() {
    try {
        const configPath = path.join(CONFIG.beammpPath, CONFIG.configFile);
        const configContent = await fs.readFile(configPath, 'utf-8');
        return toml.parse(configContent);
    } catch (error) {
        console.error('Error reading config:', error);
        throw error;
    }
}

// Write TOML config
async function writeConfig(configData) {
    try {
        const configPath = path.join(CONFIG.beammpPath, CONFIG.configFile);
        
        // Convert JSON back to TOML format
        let tomlContent = '[General]\n';
        for (const [key, value] of Object.entries(configData.General)) {
            if (typeof value === 'string') {
                tomlContent += `${key} = "${value}"\n`;
            } else if (typeof value === 'boolean') {
                tomlContent += `${key} = ${value}\n`;
            } else if (typeof value === 'number') {
                tomlContent += `${key} = ${value}\n`;
            } else if (Array.isArray(value)) {
                tomlContent += `${key} = [${value.map(v => `"${v}"`).join(', ')}]\n`;
            }
        }
        
        if (configData.Misc) {
            tomlContent += '\n[Misc]\n';
            for (const [key, value] of Object.entries(configData.Misc)) {
                if (typeof value === 'string') {
                    tomlContent += `${key} = "${value}"\n`;
                } else if (typeof value === 'boolean') {
                    tomlContent += `${key} = ${value}\n`;
                } else if (typeof value === 'number') {
                    tomlContent += `${key} = ${value}\n`;
                }
            }
        }
        
        await fs.writeFile(configPath, tomlContent, 'utf-8');
        return true;
    } catch (error) {
        console.error('Error writing config:', error);
        throw error;
    }
}

// Get server status
async function getServerStatus() {
    try {
        const { stdout } = await execPromise('ps aux | grep -E "BeamMP.*Server" | grep -v grep');
        const processes = stdout.trim().split('\n').filter(line => line.length > 0);
        
        if (processes.length === 0) {
            return { running: false, pid: null, cpu: 0, memory: 0 };
        }
        
        const process = processes[0].split(/\s+/);
        return {
            running: true,
            pid: process[1],
            cpu: parseFloat(process[2]) || 0,
            memory: parseFloat(process[3]) || 0
        };
    } catch (error) {
        return { running: false, pid: null, cpu: 0, memory: 0 };
    }
}

// Get player count from log
async function getPlayerCount() {
    try {
        const logPath = path.join(CONFIG.beammpPath, 'Server.log');
        const logContent = await fs.readFile(logPath, 'utf-8');
        
        const lines = logContent.split('\n');
        const recentLines = lines.slice(-500);
        
        let connectedCount = 0;
        
        for (const line of recentLines) {
            if (line.includes('Client connected')) {
                connectedCount++;
            }
            if (line.includes('Client disconnected')) {
                connectedCount--;
            }
        }
        
        return Math.max(0, connectedCount);
    } catch (error) {
        console.error('Error reading player count:', error);
        return 0;
    }
}

// List all maps - OPTIMIZED FOR LARGE FILES
async function listMaps() {
    try {
        const files = await fs.readdir(CONFIG.resourcesPath);
        const maps = [];
        
        for (const file of files) {
            if (file.endsWith('.zip')) {
                try {
                    const filePath = path.join(CONFIG.resourcesPath, file);
                    const stats = await fs.stat(filePath);
                    
                    // Skip files larger than 800MB for auto-detection
                    if (stats.size > MAX_ZIP_SIZE_FOR_DETECTION) {
                        console.log(`⚠ Skipping large file: ${file} (${(stats.size / (1024 * 1024)).toFixed(2)} MB) - too large for auto-detection`);
                        continue;
                    }
                    
                    const zip = new AdmZip(filePath);
                    const entries = zip.getEntries();
                    
                    // Check if it's a map
                    const levelInfoEntries = entries.filter(entry => {
                        const name = entry.entryName.toLowerCase();
                        return name.includes('levels/') && name.endsWith('info.json');
                    });
                    
                    if (levelInfoEntries.length > 0) {
                        let mapName = file.replace('.zip', '');
                        
                        const levelEntry = levelInfoEntries[0];
                        const parts = levelEntry.entryName.split('/');
                        const levelIndex = parts.findIndex(p => p.toLowerCase() === 'levels');
                        if (levelIndex >= 0 && parts[levelIndex + 1]) {
                            mapName = parts[levelIndex + 1];
                        }
                        
                        maps.push({
                            file: file,
                            name: mapName,
                            path: `/levels/${mapName}/info.json`,
                            size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                            sizeBytes: stats.size,
                            modified: stats.mtime
                        });
                        
                        console.log(`✓ Detected MAP: ${file} -> ${mapName}`);
                    }
                } catch (zipError) {
                    console.error(`Error reading zip ${file}:`, zipError.message);
                }
            }
        }
        
        return maps.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Error listing maps:', error);
        return [];
    }
}

// List all mods - OPTIMIZED FOR LARGE FILES
async function listMods() {
    try {
        const files = await fs.readdir(CONFIG.resourcesPath);
        const mods = [];
        
        for (const file of files) {
            if (file.endsWith('.zip')) {
                try {
                    const filePath = path.join(CONFIG.resourcesPath, file);
                    const stats = await fs.stat(filePath);
                    
                    // Handle very large files
                    if (stats.size > MAX_ZIP_SIZE_FOR_DETECTION) {
                        console.log(`⚠ Large file: ${file} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
                        
                        mods.push({
                            file: file,
                            name: file.replace('.zip', '').replace(/_/g, ' '),
                            type: 'large-file',
                            size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                            sizeBytes: stats.size,
                            modified: stats.mtime
                        });
                        
                        console.log(`✓ Added as LARGE FILE: ${file}`);
                        continue;
                    }
                    
                    const zip = new AdmZip(filePath);
                    const entries = zip.getEntries();
                    
                    // Check if it's a map
                    const levelInfoEntries = entries.filter(entry => {
                        const name = entry.entryName.toLowerCase();
                        return name.includes('levels/') && name.endsWith('info.json');
                    });
                    
                    const isMap = levelInfoEntries.length > 0;
                    
                    if (!isMap) {
                        let type = 'unknown';
                        const entryNames = entries.map(e => e.entryName.toLowerCase());
                        
                        if (entryNames.some(e => e.includes('vehicles/') || e.includes('.jbeam') || e.includes('.pc'))) {
                            type = 'vehicle';
                        } else if (entryNames.some(e => e.includes('ui/'))) {
                            type = 'ui';
                        } else if (entryNames.some(e => e.includes('lua/') || e.endsWith('.lua'))) {
                            type = 'script';
                        } else if (entryNames.some(e => e.includes('art/') || e.includes('shapes/'))) {
                            type = 'asset';
                        }
                        
                        mods.push({
                            file: file,
                            name: file.replace('.zip', '').replace(/_/g, ' '),
                            type: type,
                            size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                            sizeBytes: stats.size,
                            modified: stats.mtime
                        });
                        
                        console.log(`✓ Detected MOD (${type}): ${file}`);
                    }
                } catch (zipError) {
                    console.error(`Error reading zip ${file}:`, zipError.message);
                }
            }
        }
        
        return mods.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Error listing mods:', error);
        return [];
    }
}

// Get last N lines from log
async function getLogLines(lines = 100) {
    try {
        const logPath = path.join(CONFIG.beammpPath, 'Server.log');
        const { stdout } = await execPromise(`tail -n ${lines} "${logPath}"`);
        return stdout;
    } catch (error) {
        return 'Unable to read log file';
    }
}

// ==================== API ROUTES ====================

// Get dashboard info
app.get('/api/dashboard', async (req, res) => {
    try {
        const config = await readConfig();
        const status = await getServerStatus();
        const playerCount = await getPlayerCount();
        
        res.json({
            success: true,
            data: {
                server: {
                    running: status.running,
                    pid: status.pid,
                    cpu: status.cpu,
                    memory: status.memory
                },
                game: {
                    name: config.General?.Name || 'Unknown',
                    map: config.General?.Map || 'Unknown',
                    players: playerCount,
                    maxPlayers: config.General?.MaxPlayers || 0,
                    maxCars: config.General?.MaxCars || 0,
                    port: config.General?.Port || 0,
                    private: config.General?.Private || false
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all maps
app.get('/api/maps', async (req, res) => {
    try {
        const customMaps = await listMaps();
        const config = await readConfig();
        
        const defaultMaps = [
            { name: 'Grid Map V2', path: '/levels/gridmap_v2/info.json' },
            { name: 'Small Grid', path: '/levels/smallgrid/info.json' },
            { name: 'East Coast USA', path: '/levels/east_coast_usa/info.json' },
            { name: 'West Coast USA', path: '/levels/west_coast_usa/info.json' },
            { name: 'Italy', path: '/levels/italy/info.json' },
            { name: 'Utah', path: '/levels/utah/info.json' },
            { name: 'Jungle Rock Island', path: '/levels/jungle_rock_island/info.json' },
            { name: 'Industrial', path: '/levels/industrial/info.json' },
            { name: 'Hirochi Raceway', path: '/levels/hirochi_raceway/info.json' },
            { name: 'Derby Arena', path: '/levels/derby/info.json' },
            { name: 'Automation Test Track', path: '/levels/automation_test_track/info.json' },
            { name: 'Driver Training', path: '/levels/driver_training/info.json' }
        ];
        
        res.json({
            success: true,
            data: {
                customMaps: customMaps,
                defaultMaps: defaultMaps,
                currentMap: config.General?.Map || null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Change map
app.post('/api/maps/change', async (req, res) => {
    try {
        const { mapPath } = req.body;
        
        if (!mapPath) {
            return res.status(400).json({ success: false, error: 'Map path is required' });
        }
        
        const config = await readConfig();
        config.General.Map = mapPath;
        await writeConfig(config);
        
        console.log(`✓ Map changed to: ${mapPath}`);
        
        res.json({
            success: true,
            message: 'Map changed successfully. Restart server to apply changes.',
            newMap: mapPath
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all mods
app.get('/api/mods', async (req, res) => {
    try {
        const mods = await listMods();
        
        res.json({
            success: true,
            data: {
                mods: mods,
                totalSize: mods.reduce((sum, mod) => sum + mod.sizeBytes, 0)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload mod/map
app.post('/api/mods/upload', async (req, res) => {
    try {
        if (!req.files || !req.files.mod) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const modFile = req.files.mod;
        
        if (!modFile.name.endsWith('.zip')) {
            return res.status(400).json({ success: false, error: 'Only .zip files are allowed' });
        }
        
        const uploadPath = path.join(CONFIG.resourcesPath, modFile.name);
        await modFile.mv(uploadPath);
        
        console.log(`✓ Uploaded: ${modFile.name} (${(modFile.size / (1024 * 1024)).toFixed(2)} MB)`);
        
        res.json({
            success: true,
            message: 'File uploaded successfully. Refresh to see it.',
            filename: modFile.name,
            size: (modFile.size / (1024 * 1024)).toFixed(2) + ' MB'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete mod/map
app.delete('/api/mods/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(CONFIG.resourcesPath, filename);
        
        if (!filePath.startsWith(CONFIG.resourcesPath)) {
            return res.status(403).json({ success: false, error: 'Invalid file path' });
        }
        
        await fs.unlink(filePath);
        
        console.log(`✓ Deleted: ${filename}`);
        
        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Server control - Start
app.post('/api/server/start', async (req, res) => {
    try {
        const status = await getServerStatus();
        
        if (status.running) {
            return res.status(400).json({ success: false, error: 'Server is already running' });
        }
        
        await execPromise('sudo systemctl start beammp-server');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const newStatus = await getServerStatus();
        
        console.log('✓ Server started');
        
        res.json({
            success: true,
            message: 'Server started successfully',
            running: newStatus.running
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Server control - Stop
app.post('/api/server/stop', async (req, res) => {
    try {
        await execPromise('sudo systemctl stop beammp-server');
        
        console.log('✓ Server stopped');
        
        res.json({
            success: true,
            message: 'Server stopped successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Server control - Restart
app.post('/api/server/restart', async (req, res) => {
    try {
        await execPromise('sudo systemctl restart beammp-server');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const newStatus = await getServerStatus();
        
        console.log('✓ Server restarted');
        
        res.json({
            success: true,
            message: 'Server restarted successfully',
            running: newStatus.running
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get server logs
app.get('/api/logs', async (req, res) => {
    try {
        const lines = parseInt(req.query.lines) || 100;
        const logs = await getLogLines(lines);
        
        res.json({
            success: true,
            data: {
                logs: logs
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get config
app.get('/api/config', async (req, res) => {
    try {
        const config = await readConfig();
        
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update config
app.post('/api/config', async (req, res) => {
    try {
        const newConfig = req.body;
        await writeConfig(newConfig);
        
        console.log('✓ Config updated');
        
        res.json({
            success: true,
            message: 'Config updated successfully. Restart server to apply changes.'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, status: 'ok' });
});

// ==================== START SERVER ====================

app.listen(CONFIG.port, () => {
    console.log(`🚀 BeamMP Panel running on http://localhost:${CONFIG.port}`);
    console.log(`📁 Resources path: ${CONFIG.resourcesPath}`);
    console.log(`⚙️  Config file: ${path.join(CONFIG.beammpPath, CONFIG.configFile)}`);
    console.log(`⚠️  Large file threshold: ${(MAX_ZIP_SIZE_FOR_DETECTION / (1024 * 1024)).toFixed(0)} MB`);
});
