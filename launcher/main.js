// Lanzador de Windows para Norway AO (Electron).
// Abre el cliente del juego (incluido en el instalador) en una ventana propia.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const CLIENT = app.isPackaged
  ? path.join(process.resourcesPath, 'client')
  : path.join(__dirname, '..', 'client');

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
  // F11 = pantalla completa, F12 = herramientas (para soporte)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'F12' && input.control) win.webContents.toggleDevTools();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
