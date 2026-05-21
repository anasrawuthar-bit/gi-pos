const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posPrinter', {
  listPrinters: () => ipcRenderer.invoke('printer:list'),
  printReceipt: (payload) => ipcRenderer.invoke('receipt:print', payload),
  printReport: (payload) => ipcRenderer.invoke('report:print', payload),
  printTest: (settings) => ipcRenderer.invoke('receipt:print-test', settings),
  printKot: (payload) => ipcRenderer.invoke('kot:print', payload),
  printKotTest: (payload) => ipcRenderer.invoke('kot:print-test', payload),
});

contextBridge.exposeInMainWorld('posDb', {
  load: () => ipcRenderer.invoke('db:load'),
  set: (key, value) => ipcRenderer.invoke('db:set', key, value),
  setMany: (entries) => ipcRenderer.invoke('db:set-many', entries),
  getPendingSync: (limit) => ipcRenderer.invoke('db:sync-pending', limit),
  markSynced: (ids) => ipcRenderer.invoke('db:sync-mark-synced', ids),
  clearPendingSync: () => ipcRenderer.invoke('db:sync-clear-pending'),
  applyRemoteValues: (entries) => ipcRenderer.invoke('db:apply-remote-values', entries),
  resetAll: () => ipcRenderer.invoke('db:reset-all'),
});

contextBridge.exposeInMainWorld('posUpdater', {
  getStatus: () => ipcRenderer.invoke('updater:status'),
  check: () => ipcRenderer.invoke('updater:check'),
  install: () => ipcRenderer.invoke('updater:install'),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
});
