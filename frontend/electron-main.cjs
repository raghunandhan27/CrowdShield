const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

let win;
let backendProcess = null;

function checkBackendReady(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tryPing = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(600, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        resolve(false);
      } else {
        setTimeout(tryPing, 250);
      }
    };

    tryPing();
  });
}

function launchBackend() {
  const projectRoot = path.resolve(__dirname, '..');
  const pythonExe = process.env.CROWDSHIELD_PYTHON || path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
  const serverPy = path.join(projectRoot, 'backend_server.py');
  if (fs.existsSync(pythonExe) && fs.existsSync(serverPy)) {
    console.log('[Electron] Auto-spawning Python Spine Backend (Port 8000)...');
    backendProcess = spawn(pythonExe, [serverPy], {
      cwd: projectRoot,
      detached: false,
      stdio: 'ignore'
    });
    backendProcess.on('error', (error) => {
      console.error('[Electron] Could not start the Python backend:', error.message);
      backendProcess = null;
    });
  } else {
    console.error('[Electron] Backend files not found. Set CROWDSHIELD_PYTHON or run the backend separately.');
  }
}

async function createWindow() {
  win = new BrowserWindow({
    title: "CrowdWatch Command Center",
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Check if backend is alive; if not, spawn it automatically
  let isReady = await checkBackendReady('http://127.0.0.1:8000/health', 1500);
  if (!isReady) {
    launchBackend();
    isReady = await checkBackendReady('http://127.0.0.1:8000/health', 7000);
  }

  if (isReady && !win.isDestroyed()) {
    console.log('[Electron] Loading from http://127.0.0.1:8000');
    win.loadURL('http://127.0.0.1:8000');
  } else if (!win.isDestroyed()) {
    console.log('[Electron] Fallback loading local dist/index.html');
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch (e) {}
  }
  if (process.platform !== 'darwin') app.quit();
});
