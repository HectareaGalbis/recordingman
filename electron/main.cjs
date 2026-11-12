const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

let ventana = null;
let pendiente = null;

function urlDe(argv) {
  return argv.find((a) => /^(recordingman:|https?:).*[?&#]l=/.test(a)) || null;
}

function abrir(url) {
  if (!url) return;
  if (ventana && !ventana.webContents.isLoading()) ventana.webContents.send('abrir-url', url);
  else pendiente = url;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAsDefaultProtocolClient('recordingman');
  app.on('second-instance', (_e, argv) => {
    abrir(urlDe(argv));
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });
  app.on('open-url', (e, url) => {
    e.preventDefault();
    abrir(url);
  });

  app.whenReady().then(() => {
    pendiente = pendiente || urlDe(process.argv);
    ventana = new BrowserWindow({
      width: 1300,
      height: 760,
      minWidth: 800,
      minHeight: 480,
      backgroundColor: '#fafafa',
      autoHideMenuBar: true,
      title: 'RecordingMan',
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true },
    });
    ventana.removeMenu();
    ventana.loadFile(path.join(__dirname, '..', 'dist', 'desktop', 'index.html'));
    ventana.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
    ventana.webContents.on('before-input-event', (_e, entrada) => {
      if (entrada.type === 'keyDown' && entrada.key === 'F11') ventana.setFullScreen(!ventana.isFullScreen());
    });
    ipcMain.handle('url-inicial', () => {
      const u = pendiente;
      pendiente = null;
      return u;
    });
    ipcMain.on('salir', () => app.quit());
  });

  app.on('window-all-closed', () => app.quit());
}
