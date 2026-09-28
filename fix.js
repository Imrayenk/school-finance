const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('electron/main.cjs', 'utf-8').split('\n');
const part1 = content.slice(0, 131).join('\n');

const middle = `  if (!result.canceled && result.filePaths.length > 0) {
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
    const safePath = path.normalize(reqPath).replace(/^(\\.\\.[\\\\/])+/, '')
    let filePath = path.join(distDir, safePath)

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
`;

// Looking for where "      }) \n       fs.createReadStream(filePath).pipe(res)" starts
// In the current file it starts at line 132. We join part 2 from line 132.
const part2 = content.slice(132).join('\n');

fs.writeFileSync('electron/main.cjs', part1 + '\n' + middle + part2);
console.log('Fixed main.cjs!');
