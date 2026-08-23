'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('osint', Object.freeze({
  addPerson: (input) => ipcRenderer.invoke('person:add', input),
  getAllPersons: () => ipcRenderer.invoke('person:list'),
  startInvestigation: (personId) => ipcRenderer.invoke('investigation:start', personId),
  getReport: (personId) => ipcRenderer.invoke('investigation:report', personId),
  deleteInvestigation: (personId) => ipcRenderer.invoke('investigation:delete', personId),
  getRuntimeConfig: () => ipcRenderer.invoke('app:runtime-config'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  onInvestigationUpdate: (listener) => {
    const wrapped = (_event, update) => listener(update);
    ipcRenderer.on('investigation:update', wrapped);
    return () => ipcRenderer.removeListener('investigation:update', wrapped);
  }
}));
