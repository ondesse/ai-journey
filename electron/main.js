const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Debug: Verify this file is being loaded
try {
  fs.writeFileSync(path.join(process.cwd(), 'MAIN_LOADED.txt'), 'electron/main.js loaded\n');
} catch (e) {
  // Silently fail if we can't write
}

// Error logging for debugging
process.on('uncaughtException', (err) => {
  const logPath = path.join(process.cwd(), 'electron-error.log');
  fs.appendFileSync(logPath, `${new Date().toISOString()} [uncaughtException] ${err.stack}\n`);
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  const logPath = path.join(process.cwd(), 'electron-error.log');
  fs.appendFileSync(logPath, `${new Date().toISOString()} [unhandledRejection] ${err.stack || err}\n`);
  console.error('Unhandled rejection:', err);
});

let mainWindow;
let nextServer;
const PORT = 3000;
let isCreatingWindow = false;

function createWindow() {
  // Prevent multiple windows from being created
  if (isCreatingWindow || mainWindow) {
    return;
  }
  isCreatingWindow = true;
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'LoL Draft Tool',
    show: false, // Don't show until ready
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Start Next.js server
  if (isDev) {
    // Development: connect to Next.js dev server
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    
    // Open DevTools in development only
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Disable DevTools and prevent code inspection
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
    
    // Prevent right-click context menu in production
    mainWindow.webContents.on('context-menu', (e) => {
      e.preventDefault();
    });
    
    // Allow navigation to local server, block external URLs
    mainWindow.webContents.on('will-navigate', (e, url) => {
      const allowed = url.startsWith(`http://127.0.0.1:${PORT}`) || url.startsWith(`http://localhost:${PORT}`);
      if (!allowed) {
        e.preventDefault();
      }
    });
    
    // Prevent new window creation
    mainWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
    // Production: start Next.js standalone server
    const appPath = app.getAppPath();
    
    // In packaged app, resourcesPath points to the resources folder
    // When using --asar, app.getAppPath() returns path to app.asar
    // process.resourcesPath points to the resources folder (where extra-resource files are)
    let resourcesPath;
    if (app.isPackaged) {
      // Packaged: resourcesPath is the folder containing app.asar
      resourcesPath = process.resourcesPath;
    } else {
      // Development: use app path
      resourcesPath = appPath;
    }
    
    // In packaged app, standalone is in resources/standalone (electron-packager --extra-resource=".next/standalone" copies contents to resources/standalone)
    const nextPath = path.join(resourcesPath, 'standalone');
    const serverPath = path.join(nextPath, 'server.js');
    
    // Log the path for debugging
    console.log('Using Next server at:', serverPath);
    
    // Debug logging
    console.log('App path:', appPath);
    console.log('Resources path:', resourcesPath);
    console.log('Next path:', nextPath);
    console.log('Server path:', serverPath);
    console.log('Server exists:', fs.existsSync(serverPath));
    
    // Comprehensive logging for debugging
    const logPath = path.join(process.cwd(), 'next-server.log');
    function log(line) {
      try {
        fs.appendFileSync(logPath, line + '\n');
      } catch (e) {
        // Silently fail if log file can't be written
      }
    }
    
    log('=== ELECTRON START ===');
    log('process.execPath=' + process.execPath);
    log('process.resourcesPath=' + process.resourcesPath);
    log('nextPath=' + nextPath);
    log('serverPath=' + serverPath);
    log('serverExists=' + fs.existsSync(serverPath));
    
    if (!fs.existsSync(serverPath)) {
      // Try alternative paths
      const altPaths = [
        path.join(appPath, 'standalone', 'server.js'),
        path.join(__dirname, '..', '..', '.next', 'standalone', 'server.js'),
        path.join(process.cwd(), '.next', 'standalone', 'server.js'),
      ];
      
      console.error('Next.js server not found at:', serverPath);
      log('ERROR: Server path does not exist!');
      console.error('Trying alternative paths...');
      for (const altPath of altPaths) {
        const exists = fs.existsSync(altPath);
        console.error('  Checking:', altPath, 'exists:', exists);
        log(`  altPath=${altPath} exists=${exists}`);
      }
      
      mainWindow.loadURL('data:text/html,<h1>Error: Next.js build not found</h1><p>Please rebuild the app.</p><p>Server path: ' + serverPath + '</p>');
      return;
    }
    
    // Use ELECTRON_RUN_AS_NODE environment variable (more reliable than --runAsNode flag on Windows)
    // This tells Electron to run in Node.js mode, not as an Electron app
    const spawnArgs = [serverPath, '--port', PORT.toString(), '--hostname', '127.0.0.1'];
    log('spawn args=' + JSON.stringify(spawnArgs));
    log('serverPath exists=' + fs.existsSync(serverPath));
    
    nextServer = spawn(process.execPath, spawnArgs, {
      cwd: nextPath,
      env: { 
        ...process.env, 
        ELECTRON_RUN_AS_NODE: '1', // This is the key - more reliable than --runAsNode flag
        PORT: PORT.toString(),
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1'
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    log('spawned pid=' + nextServer.pid);
    console.log('Spawned Next server PID:', nextServer.pid);
    
    // Comprehensive logging of server output
    nextServer.stdout.on('data', (d) => {
      const output = d.toString();
      log('[stdout] ' + output);
      console.log(`Next.js: ${output}`);
    });

    nextServer.stderr.on('data', (d) => {
      const output = d.toString();
      log('[stderr] ' + output);
      console.error(`Next.js error: ${output}`);
    });

    nextServer.on('error', (e) => {
      const errorMsg = '[spawn error] ' + (e.stack || e.toString());
      log(errorMsg);
      console.error('Failed to start Next.js server:', e);
      mainWindow.loadURL('data:text/html,<h1>Error starting server</h1><p>' + e.message + '</p>');
    });
    
    nextServer.on('exit', (code, signal) => {
      log(`[exit] code=${code} signal=${signal}`);
      console.log(`Next.js server exited with code ${code}, signal ${signal}`);
    });

    // Wait for server to be ready
    let attempts = 0;
    const maxAttempts = 40; // 20 seconds max
    const checkServer = setInterval(() => {
      attempts++;
      const http = require('http');
      const req = http.get(`http://127.0.0.1:${PORT}`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          clearInterval(checkServer);
          mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
        }
      });
      req.on('error', () => {
        // Server not ready yet
        if (attempts >= maxAttempts) {
          clearInterval(checkServer);
          console.error('Server failed to start after', maxAttempts, 'attempts');
          mainWindow.loadURL('data:text/html,<h1>Error</h1><p>Server failed to start. Please check the console.</p>');
        }
      });
      req.setTimeout(1000, () => req.destroy());
    }, 500);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    isCreatingWindow = false;
  });
  
  isCreatingWindow = false;
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill();
  }
});

