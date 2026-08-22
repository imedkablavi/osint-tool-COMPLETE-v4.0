const { contextBridge, ipcRenderer } = require('electron');

const api = {
  cases: {
    create: (data) => ipcRenderer.invoke('add-person', data),
    list: () => ipcRenderer.invoke('get-all-persons'),
    report: (personId) => ipcRenderer.invoke('get-report', personId),
    start: (payload) => ipcRenderer.invoke('start-investigation', payload),
    onProgress: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, update) => callback(update);
      ipcRenderer.on('investigation-update', listener);
      return () => ipcRenderer.removeListener('investigation-update', listener);
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings)
  },
  app: {
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
  }
};

contextBridge.exposeInMainWorld('osintAPI', Object.freeze(api));
