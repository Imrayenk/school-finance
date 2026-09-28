const { contextBridge, ipcRenderer } = require('electron')

// Expose safe desktop environment APIs
contextBridge.exposeInMainWorld('desktopApp', {
  platform: process.platform,
  isDesktop: true,
  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  dbRun: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
  dbExec: (sql) => ipcRenderer.invoke('db:exec', sql),
  saveSettings: (settingsObj) => ipcRenderer.invoke('app:save-settings', settingsObj),
  loadSettings: () => ipcRenderer.invoke('app:load-settings'),
  selectDirectory: () => ipcRenderer.invoke('app:select-directory'),
  backupDatabase: (backupFolderPath) => ipcRenderer.invoke('app:backup-database', backupFolderPath),
  restoreDatabase: () => ipcRenderer.invoke('app:restore-database')
})
