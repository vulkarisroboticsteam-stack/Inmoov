const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

app.setName('InMoov Hub');
app.setAppUserModelId('com.vulkaris.inmoovhub');

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) app.quit();

let backendProcess = null;
let backendLog = null;
let backendFailure = null;
let serverUrl = null;
let mainWindow = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function startBackend(port) {
  const binaryName = process.platform === 'win32' ? 'inmoov-backend.exe' : 'inmoov-backend';
  const executable = path.join(process.resourcesPath, 'backend', binaryName);
  if (!fs.existsSync(executable)) {
    throw new Error(`O servidor do aplicativo não foi encontrado: ${executable}`);
  }

  const dataDirectory = app.getPath('userData');
  fs.mkdirSync(dataDirectory, { recursive: true });
  backendLog = fs.createWriteStream(path.join(dataDirectory, 'backend.log'), { flags: 'w' });
  backendProcess = spawn(executable, [], {
    cwd: dataDirectory,
    env: {
      ...process.env,
      INMOOV_DATA_DIR: dataDirectory,
      INMOOV_HOST: '127.0.0.1',
      INMOOV_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  backendProcess.stdout.pipe(backendLog);
  backendProcess.stderr.pipe(backendLog);
  backendProcess.once('error', (error) => {
    backendFailure = error;
    backendLog?.write(`Falha ao iniciar o backend: ${error.stack || error}\n`);
  });
}

async function waitForBackend(url) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (backendFailure) {
      throw new Error(`Não foi possível iniciar o backend. Consulte backend.log. ${backendFailure.message}`);
    }
    if (!backendProcess || backendProcess.exitCode !== null || backendProcess.signalCode !== null) {
      throw new Error('O servidor do aplicativo foi encerrado durante a inicialização.');
    }
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {
      // O servidor ainda pode estar carregando as bibliotecas de visão computacional.
    }
    await delay(350);
  }
  throw new Error('O servidor demorou demais para iniciar. Consulte backend.log na pasta de dados do aplicativo.');
}

async function openWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'InMoov Hub',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(url);
}

async function launchDesktopApp() {
  if (app.isPackaged) {
    const port = await findFreePort();
    serverUrl = `http://127.0.0.1:${port}`;
    startBackend(port);
    await waitForBackend(serverUrl);
  } else {
    serverUrl = process.env.INMOOV_DEV_SERVER_URL || 'http://127.0.0.1:5173';
  }
  await openWindow(serverUrl);
}

if (hasSingleInstance) {
  app.whenReady().then(launchDesktopApp).catch((error) => {
    dialog.showErrorBox('Não foi possível abrir o InMoov Hub', error.message);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverUrl) {
      openWindow(serverUrl).catch((error) => dialog.showErrorBox('Erro ao abrir a janela', error.message));
    }
  });

  app.on('before-quit', () => {
    backendProcess?.kill();
    backendLog?.end();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
