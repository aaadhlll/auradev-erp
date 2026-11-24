const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mercantileDesktop', {
  getRuntimeInfo: () => ipcRenderer.invoke('mercantile:runtime-info'),
  apiBaseUrl: process.env.MERCANTILE_API_URL || null,
})
