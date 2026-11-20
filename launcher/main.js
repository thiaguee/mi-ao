// Aplicación de Windows de Norway AO (Electron).
// - Abre el juego en su propia ventana (no en el navegador).
// - Si el juego no apunta a un servidor de internet, arranca el servidor ADENTRO de la
//   aplicación, así se puede jugar en la PC sin instalar nada más.
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const RES = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const CLIENT = path.join(RES, 'client');
const SERVER = path.join(RES, 'server');

let world = null;

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
  try {
    world = require(path.join(SERVER, 'src', 'main.js'));
  } catch (e) {
    dialog.showErrorBox('Norway AO', 'No se pudo iniciar el servidor del juego:\n' + e.message);
  }
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
    // le damos un instante al servidor para que cargue los mapas
    setTimeout(createWindow, world ? 300 : 0);
  });
  app.on('before-quit', () => { if (world && world.saveAll) world.saveAll(); });
  app.on('window-all-closed', () => app.quit());
}
