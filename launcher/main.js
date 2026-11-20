// Aplicación de Windows de Norway AO (Electron).
// - Abre el juego en su propia ventana (no en el navegador).
// - Si el juego no apunta a un servidor de internet, arranca el servidor ADENTRO de la
//   aplicación, así se puede jugar en la PC sin instalar nada más.
const { app, BrowserWindow, Menu, shell, dialog, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');

const RES = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const CLIENT = path.join(RES, 'client');
const SERVER = path.join(RES, 'server');

let servidor = null; // proceso aparte donde corre el servidor (no traba la ventana del juego)
let servidorListo = false;

// ¿El cliente tiene configurado un servidor de internet?
function servidorRemoto() {
  try {
    const txt = fs.readFileSync(path.join(CLIENT, 'config.js'), 'utf8');
    const m = /^\s*servidor:\s*'([^']*)'/m.exec(txt);
    return m && m[1] ? m[1] : '';
  } catch (e) { return ''; }
}

function arrancarServidorLocal() {
  process.env.AO_CLIENT_DIR = CLIENT;
  // Los personajes y la configuración van a la carpeta del usuario (AppData), no a la de
  // instalación: así las actualizaciones nunca los borran.
  const datos = path.join(app.getPath('userData'), 'datos');
  process.env.AO_DATA_DIR = datos;
  try {
    // Si había personajes de una versión vieja dentro de la instalación, se copian
    const viejos = path.join(SERVER, 'cuentas');
    if (fs.existsSync(viejos) && !fs.existsSync(path.join(datos, 'cuentas'))) {
      fs.mkdirSync(datos, { recursive: true });
      fs.cpSync(viejos, path.join(datos, 'cuentas'), { recursive: true });
    }
  } catch (e) { /* nada */ }
  try {
    servidor = utilityProcess.fork(path.join(SERVER, 'src', 'main.js'), [], {
      env: Object.assign({}, process.env), serviceName: 'Servidor Norway AO', stdio: 'inherit',
    });
    servidor.on('message', (m) => { if (m === 'listo') servidorListo = true; });
    servidor.on('exit', () => { servidor = null; });
  } catch (e) {
    dialog.showErrorBox('Norway AO', 'No se pudo iniciar el servidor del juego:\n' + e.message);
  }
}

// Espera a que el servidor termine de cargar los mapas (máximo 8 segundos)
function esperarServidor() {
  return new Promise((resolve) => {
    if (!servidor) return resolve();
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (servidorListo || !servidor || Date.now() - t0 > 8000) { clearInterval(iv); resolve(); }
    }, 50);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Norway AO',
    icon: path.join(CLIENT, 'assets', 'ui', 'icono.png'),
    backgroundColor: '#0d0b08',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // permite cargar los gráficos locales con fetch()
      webSecurity: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(CLIENT, 'index.html'));
  // Los links externos se abren en el navegador
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  // F11 = pantalla completa, Ctrl+F12 = herramientas (para soporte)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'F12' && input.control) win.webContents.toggleDevTools();
  });
}

// Actualización automática: al abrir el juego se fija si hay una versión nueva en GitHub,
// la descarga en segundo plano y ofrece reiniciar para instalarla.
function buscarActualizacion() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', (info) => {
    const w = BrowserWindow.getAllWindows()[0];
    dialog.showMessageBox(w, {
      type: 'info',
      title: 'Norway AO',
      message: `Hay una versión nueva de Norway AO (${info.version}).`,
      detail: '¿Querés reiniciar el juego ahora para instalarla? Tus personajes no se pierden.',
      buttons: ['Reiniciar y actualizar', 'Más tarde'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        if (servidor) servidor.postMessage({ cmd: 'guardar' });
        setTimeout(() => autoUpdater.quitAndInstall(), 500);
      }
    });
  });
  autoUpdater.on('error', () => { /* sin internet o sin versión nueva: se sigue jugando */ });
  autoUpdater.checkForUpdates().catch(() => {});
}

// Usar la placa de video aunque Chrome la tenga en su lista de "no recomendadas" (más fluidez)
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Una sola ventana del juego a la vez
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  app.whenReady().then(() => {
    if (!servidorRemoto()) arrancarServidorLocal();
    buscarActualizacion();
    esperarServidor().then(createWindow);
  });
  // Al cerrar: el servidor guarda todos los personajes antes de apagarse
  let cerrando = false;
  app.on('before-quit', (e) => {
    if (!servidor || cerrando) return;
    cerrando = true;
    e.preventDefault();
    servidor.postMessage({ cmd: 'apagar' });
    setTimeout(() => { if (servidor) servidor.kill(); app.exit(0); }, 1500);
    servidor.on('exit', () => app.exit(0));
  });
  app.on('window-all-closed', () => app.quit());
}
