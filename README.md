# 🚀 BeamMP Complete Installer

**One-script installation** of BeamMP Server + Admin Panel on fresh Ubuntu servers.

---

## 📋 What This Does

This installer automatically sets up a **complete BeamMP server** with a **professional web admin panel** on a fresh Ubuntu installation.

### Installs & Configures:
- ✅ BeamMP Server (latest version)
- ✅ Admin Web Panel (modern, responsive UI)
- ✅ Node.js 20.x
- ✅ Nginx reverse proxy
- ✅ Systemd services (auto-start on boot)
- ✅ Firewall rules
- ✅ All dependencies

### Features:
- 🎮 **Server Management** - Start/Stop/Restart from web panel
- 🗺️ **Map Management** - Switch between custom and default maps
- 🎨 **Mod Management** - Upload and delete mods/maps
- 📊 **Real-time Stats** - Players online, CPU, RAM usage
- 📝 **Log Viewer** - Monitor server logs
- ⚙️ **Config Editor** - Edit ServerConfig.toml from panel
- 🔄 **Auto-refresh** - Dashboard updates every 5 seconds

---

## 💻 Requirements

- **OS**: Ubuntu 20.04, 22.04, or 24.04 (fresh install recommended)
- **RAM**: Minimum 2GB (4GB+ recommended)
- **Disk**: 10GB+ free space
- **Network**: Open ports for BeamMP (30814) and Panel (8081)
- **User**: Non-root user with sudo privileges

---

## 🚀 Quick Installation

### 1. Download the installer

```bash
# Download and extract
wget https://github.com/oprisel/beammp-server-panel/archive/refs/heads/main.tar.gz
tar -xzf beammp-complete-installer.tar.gz
cd beammp-complete-installer
```

### 2. Run the installer

```bash
chmod +x install-beammp-complete.sh
./install-beammp-complete.sh
```

### 3. Answer the prompts

The installer will ask you for:
- **Server IP** - Auto-detected, press Enter to accept
- **Server Name** - Name visible to players (default: "My BeamMP Server")
- **Max Players** - Maximum concurrent players (default: 8)
- **Max Cars** - Maximum cars per player (default: 4)
- **BeamMP Port** - Server port (default: 30814)
- **Panel Port** - Web panel port (default: 8081)
- **Install Path** - Where to install (default: /opt/beammp)
- **Auth Key** - Your BeamMP auth key from https://beammp.com/keymaster

### 4. Done! 🎉

Access your panel at: `http://YOUR_SERVER_IP:8081`

---

## 🔑 Getting Auth Key

1. Go to https://beammp.com/keymaster
2. Sign in or create account
3. Click "Create Key"
4. Copy your key
5. Paste when the installer asks

**Without an auth key, the server won't start!**

---

## 📁 Installation Structure

```
/opt/beammp/
├── server/                    # BeamMP Server
│   ├── BeamMP-Server         # Executable
│   ├── ServerConfig.toml     # Configuration
│   ├── Server.log            # Logs
│   └── Resources/
│       ├── Client/           # Mods & Maps go here
│       └── Server/
│
└── panel/                     # Admin Panel
    ├── server.js             # Backend
    ├── public/               # Frontend
    │   ├── index.html
    │   └── app.js
    └── .env                  # Configuration
```

---

## 🎮 Usage

### Access Panel
```
http://YOUR_SERVER_IP:8081
```

### Connect to Server
In BeamMP Launcher:
```
IP: YOUR_SERVER_IP
Port: 30814
```

### Useful Commands

**Check Status:**
```bash
sudo systemctl status beammp-server
sudo systemctl status beammp-panel
```

**View Logs:**
```bash
# Server logs
tail -f /opt/beammp/server/Server.log

# Panel logs
sudo tail -f /var/log/beammp-panel.log
```

**Restart Services:**
```bash
sudo systemctl restart beammp-server
sudo systemctl restart beammp-panel
```

**Stop Services:**
```bash
sudo systemctl stop beammp-server
sudo systemctl stop beammp-panel
```

**Start Services:**
```bash
sudo systemctl start beammp-server
sudo systemctl start beammp-panel
```

---

## 🔧 Configuration

### Edit Server Config
```bash
sudo nano /opt/beammp/server/ServerConfig.toml
```

**Or use the web panel:**
1. Go to panel → Config
2. Edit settings
3. Click Save
4. Restart server

### Edit Panel Config
```bash
sudo nano /opt/beammp/panel/.env
```

Then restart panel:
```bash
sudo systemctl restart beammp-panel
```

---

## 📤 Adding Mods/Maps

### Method 1: Web Panel (Recommended)
1. Go to panel → Mods
2. Drag & drop .zip file
3. Done! Server will auto-detect

### Method 2: Manual
```bash
# Copy .zip files to Resources/Client
sudo cp your-mod.zip /opt/beammp/server/Resources/Client/

# Restart server to load
sudo systemctl restart beammp-server
```

---

## 🗺️ Changing Maps

### From Panel:
1. Go to Maps tab
2. Click on desired map
3. Confirm change
4. Click "Restart Server"

### Manual:
```bash
sudo nano /opt/beammp/server/ServerConfig.toml
# Change the Map line
sudo systemctl restart beammp-server
```

---

## 🐛 Troubleshooting

### Server Won't Start

**Check auth key:**
```bash
grep AuthKey /opt/beammp/server/ServerConfig.toml
```

**View error logs:**
```bash
sudo journalctl -u beammp-server -n 50
```

### Panel Won't Load

**Check if running:**
```bash
sudo systemctl status beammp-panel
```

**Check logs:**
```bash
sudo tail -f /var/log/beammp-panel-error.log
```

**Test panel directly:**
```bash
curl http://localhost:3000/api/health
```

### Port Already in Use

**Check what's using the port:**
```bash
sudo netstat -tulpn | grep 8081
```

**Change panel port:**
```bash
sudo nano /etc/nginx/sites-available/beammp-panel
# Change "listen 8081" to another port
sudo systemctl reload nginx
```

### Firewall Issues

**Check UFW status:**
```bash
sudo ufw status
```

**Open required ports:**
```bash
sudo ufw allow 30814/tcp  # BeamMP
sudo ufw allow 8081/tcp   # Panel
```

### Can't Upload Large Files

**Increase nginx limit:**
```bash
sudo nano /etc/nginx/sites-available/beammp-panel
# Change: client_max_body_size 500M; (increase as needed)
sudo systemctl reload nginx
```

---

## 🗑️ Uninstallation

```bash
cd beammp-complete-installer
./uninstall-beammp-complete.sh
```

This will:
- Stop all services
- Remove systemd services
- Remove nginx config
- Remove sudo rules
- **Ask before deleting** server files

---

## 🔄 Updates

### Update Panel
```bash
cd beammp-complete-installer
# Download new version
./install-beammp-complete.sh --update-panel
```

### Update BeamMP Server
```bash
cd /opt/beammp/server
wget https://github.com/BeamMP/BeamMP-Server/releases/latest/download/BeamMP-Server-ubuntu-22.04 -O BeamMP-Server.new
chmod +x BeamMP-Server.new
sudo systemctl stop beammp-server
mv BeamMP-Server BeamMP-Server.old
mv BeamMP-Server.new BeamMP-Server
sudo systemctl start beammp-server
```

---

## 🔒 Security

### Default Security Features:
- ✅ Panel runs on internal port 3000 (not exposed)
- ✅ Nginx reverse proxy with security headers
- ✅ Controlled sudo permissions (only server control)
- ✅ No root access required
- ✅ Systemd sandboxing

### Recommendations:
- Change default ports if exposed to internet
- Set up HTTPS with Let's Encrypt for external access
- Use firewall (UFW) to restrict access
- Keep system and packages updated
- Use strong passwords for BeamMP account

---

## 📊 Performance Tips

### For Better Performance:
- Allocate more RAM to server
- Use SSD storage
- Close unused applications
- Monitor with panel dashboard

### Optimize Server Config:
```bash
sudo nano /opt/beammp/server/ServerConfig.toml
```

Adjust:
- `Cars` - Lower = better performance
- `MaxPlayers` - Lower = better performance
- `Debug = false` - Reduces log spam

---

## 🆘 Support & Help

### Resources:
- BeamMP Discord: https://discord.gg/beammp
- BeamMP Forum: https://forum.beammp.com
- BeamMP Docs: https://docs.beammp.com

### Common Issues:
- **Port forwarding**: Required for internet access
- **Auth key**: Must be valid and active
- **Mods compatibility**: Use BeamMP-compatible mods only

---

## 📝 Changelog

### Version 1.1.0 (2026-10-18) — Bugfix Update
- **Upload progress bar**: the panel now shows real-time upload progress
  (filename, MB sent / total, percentage) instead of a plain "Uploading..."
  toast with no feedback
- **Legacy map detection**: old BeamNG map exports that ship `.mis`/`.ter`
  files without `info.json` are now correctly detected and listed as maps
  instead of being misclassified as a generic "asset" mod
- **Nested-zip detection**: uploads that are a wrapper `.zip` containing
  another `.zip` inside (instead of mod files directly) are now flagged
  as `nested-zip` with a clear warning, instead of showing "unknown"
- **Large-file analysis threshold** raised from 800MB to 5GB, and default
  max upload size raised from 2GB to 5GB, so bigger mod/map archives are
  still scanned and classified correctly
- **Installer fixes**: corrected the `MaxCars` config key name, removed
  invalid systemd `StandardOutput`/`StandardError` append directives, and
  fixed the `ufw allow` port syntax

### Version 1.0.0
- Initial release
- Complete automated installation
- Admin panel with full features
- Systemd integration
- Nginx reverse proxy

---

## 📜 License

MIT License - Free to use and modify

---

## 👨‍💻 Credits

**Created by:** Gigicax  
**Year:** 2026  
**Special Thanks:** BeamMP Team, Anthropic Claude

---

**Enjoy your BeamMP Server! 🚗💨**
