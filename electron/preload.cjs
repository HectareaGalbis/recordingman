const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rmEscritorio', {
  salir: () => ipcRenderer.send('salir'),
  alAbrirUrl: (cb) => {
    ipcRenderer.on('abrir-url', (_e, url) => cb(url));
    ipcRenderer.invoke('url-inicial').then((url) => url && cb(url));
  },
});
