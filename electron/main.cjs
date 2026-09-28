const { app, BrowserWindow, ipcMain, dialog, crashReporter } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')

// Crash reporter disabled
console.log("ELECTRON MAIN: Imports done");


// GPU flags for compatibility
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.disableHardwareAcceleration()
console.log("ELECTRON MAIN: Hardware acceleration disabled");

app.setAppUserModelId('com.espoir.app');
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    if (windows[0].isMinimized()) windows[0].restore()
    windows[0].focus()
  }
})

let server = null
const DEFAULT_PORT = 52418
let db = null
let userDataDir = null
let dbFilePath = null
let settingsFilePath = null

function initDatabase() {
  console.log("ELECTRON MAIN: initDatabase start");
  const Database = require('better-sqlite3')
  console.log("ELECTRON MAIN: better-sqlite3 required");
  userDataDir = path.join(app.getPath('appData'), 'Espoir')
  if (!fs.existsSync(userDataDir)) {
    try {
      fs.mkdirSync(userDataDir, { recursive: true })
    } catch (err) {
      console.error('Failed to create user data dir:', err)
    }
  }
  dbFilePath = path.join(userDataDir, 'database.sqlite')
  settingsFilePath = path.join(userDataDir, 'settings.json')

  try {
    console.log("ELECTRON MAIN: Opening database");
    db = new Database(dbFilePath)
    console.log("ELECTRON MAIN: db instantiated");
    db.pragma('foreign_keys = ON')
    console.log('[Main Process] Database opened at:', dbFilePath)
  } catch (err) {
    console.error('Failed to open database:', err)
  }
}

let backupTimeout = null
function triggerAutoBackup() {
  if (backupTimeout) clearTimeout(backupTimeout)
  backupTimeout = setTimeout(async () => {
    try {
      if (fs.existsSync(settingsFilePath)) {
        const content = fs.readFileSync(settingsFilePath, 'utf-8')
        const settings = JSON.parse(content)
        if (settings.backupFolderPath && fs.existsSync(settings.backupFolderPath)) {
          const dbDest = path.join(settings.backupFolderPath, 'database.sqlite')
          if (db) await db.backup(dbDest)
          const settingsDest = path.join(settings.backupFolderPath, 'settings.json')
          fs.copyFileSync(settingsFilePath, settingsDest)
          console.log('[AutoBackup] Successful to', settings.backupFolderPath)
        }
      }
    } catch (e) {
      console.error('[AutoBackup] Failed:', e)
    }
  }, 5000)
}

// Database IPC Handlers
ipcMain.handle('db:query', (event, sql, params = []) => {
  try {
    return db.prepare(sql).all(...params)
  } catch (err) {
    console.error('DB Query Error:', err)
    throw err
  }
})

ipcMain.handle('db:run', (event, sql, params = []) => {
  try {
    const res = db.prepare(sql).run(...params)
    const cmd = sql.trim().toUpperCase()
    if (cmd.startsWith('INSERT') || cmd.startsWith('UPDATE') || cmd.startsWith('DELETE') || cmd.startsWith('ALTER') || cmd.startsWith('DROP') || cmd.startsWith('CREATE')) {
      triggerAutoBackup()
    }
    return res
  } catch (err) {
    console.error('DB Run Error:', err)
    throw err
  }
})

ipcMain.handle('db:exec', (event, sql) => {
  try {
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH') || sql.trim().toUpperCase().startsWith('PRAGMA TABLE_INFO');
    if (isSelect) {
      const rows = db.prepare(sql).all()
      if (rows.length === 0) return []
      const columns = Object.keys(rows[0])
      const values = rows.map(r => columns.map(c => r[c]))
      return [{ columns, values }]
    } else {
      db.exec(sql)
      triggerAutoBackup()
      return []
    }
  } catch (err) {
    console.error('DB Exec Error:', err)
    throw err
  }
})

ipcMain.handle('app:save-settings', async (event, settingsObj) => {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settingsObj, null, 2), 'utf-8')
    return { success: true, path: settingsFilePath }
  } catch (e) {
    console.error('[IPC] Failed to save settings to disk:', e)
    return { success: false, error: e.message }
  }
})

ipcMain.handle('app:load-settings', async () => {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const content = fs.readFileSync(settingsFilePath, 'utf-8')
      return { success: true, data: JSON.parse(content) }
    }
    return { success: false, reason: 'File does not exist' }
  } catch (e) {
    console.error('[IPC] Failed to load settings from disk:', e)
    return { success: false, error: e.message }
  }
})

ipcMain.handle('app:select-directory', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(window, {
    properties: ['openDirectory'],
    title: 'Choisir le dossier de sauvegarde',
    buttonLabel: 'Sélectionner'
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] }
  }
  return { success: false, reason: 'canceled' }
})

ipcMain.handle('app:backup-database', async (event, backupFolderPath) => {
  try {
    if (!fs.existsSync(backupFolderPath)) {
      fs.mkdirSync(backupFolderPath, { recursive: true })
    }
    
    const dbDest = path.join(backupFolderPath, 'database.sqlite')
    const settingsDest = path.join(backupFolderPath, 'settings.json')
    
    // Safely backup the live SQLite database
    if (db) {
      await db.backup(dbDest)
    }
    
    if (fs.existsSync(settingsFilePath)) fs.copyFileSync(settingsFilePath, settingsDest)
    
    return { success: true }
  } catch (e) {
    console.error('[IPC] Failed to backup to:', backupFolderPath, e)
    return { success: false, error: e.message }
  }
})

ipcMain.handle('app:restore-database', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(window, {
    properties: ['openFile'],
    title: 'Restaurer la base de données SQLite',
    filters: [
      { name: 'SQLite Database', extensions: ['sqlite', 'db'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    buttonLabel: 'Restaurer'
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    const sourcePath = result.filePaths[0]
    try {
      const Database = require('better-sqlite3')
      // Close existing db
      if (db) {
        db.close()
      }
      // Overwrite current db with chosen backup
      fs.copyFileSync(sourcePath, dbFilePath)
      // Reopen db
      db = new Database(dbFilePath)
      db.pragma('foreign_keys = ON')
      
      return { success: true }
    } catch (e) {
      console.error('[IPC] Failed to restore from:', sourcePath, e)
      return { success: false, error: e.message }
    }
  }
  return { success: false, reason: 'canceled' }
})

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
}

function startLocalServer(callback, preferredPort = DEFAULT_PORT) {
  const distDir = path.join(__dirname, '../dist')

  server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0]
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html'
    
    // Normalize path to prevent directory traversal
    const safePath = path.normalize(reqPath).replace(/^(\.\.[\\/])+/, '')
    let filePath = path.join(distDir, safePath)

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      })
      fs.createReadStream(filePath).pipe(res)
    } else {
      // Fallback to index.html
      const fallbackPath = path.join(distDir, 'index.html')
      if (fs.existsSync(fallbackPath)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        })
        fs.createReadStream(fallbackPath).pipe(res)
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('File not found')
      }
    }
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Main Process] Port ${preferredPort} is in use, falling back to dynamic port...`)
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port
        console.log(`[Main Process] Local loopback server listening on http://127.0.0.1:${port}`)
        callback(`http://127.0.0.1:${port}`)
      })
    } else {
      console.error('[Main Process] Server error:', err)
    }
  })

  server.listen(preferredPort, '127.0.0.1', () => {
    console.log(`[Main Process] Local loopback server listening on http://127.0.0.1:${preferredPort}`)
    callback(`http://127.0.0.1:${preferredPort}`)
  })
}

function createWindow(appUrl) {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: 'Espoir - Application Bureau',
    backgroundColor: '#f3f4f6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer LOG]: ${message} (at ${sourceId}:${line})`)
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Load Error]: ${errorDescription} (${errorCode}) at ${validatedURL}`)
  })

  console.log('[Main Process] Loading application URL:', appUrl)
  mainWindow.loadURL(appUrl)

  // Remove default menu for clean, modern look
  mainWindow.setMenuBarVisibility(false)
}

let initialWindowCreated = false

console.log("ELECTRON MAIN: Waiting for ready");
app.whenReady().then(() => {
  console.log("ELECTRON MAIN: App is ready");
  initDatabase()
  startLocalServer((url) => {
    if (!initialWindowCreated) {
      initialWindowCreated = true
      createWindow(url)
    }
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (server && server.address()) {
        const port = server.address().port
        createWindow(`http://127.0.0.1:${port}`)
      }
    }
  })
})

app.on('window-all-closed', function () {
  if (server) {
    server.close()
  }
  if (process.platform !== 'darwin') app.quit()
})
