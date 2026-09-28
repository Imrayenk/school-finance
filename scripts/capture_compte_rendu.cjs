const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('no-sandbox')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 1000,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  console.log('Loading http://localhost:5173/ ...')
  await win.loadURL('http://localhost:5173/')

  // Wait for initial render
  await new Promise(r => setTimeout(r, 2000))

  const brainDir = 'C:\\Users\\Imray\\.gemini\\antigravity-ide\\brain\\2c4c9681-a9e6-4386-9cf2-2e03779fdda4'

  // 1. Open Center Compte Rendu from Dashboard
  console.log('Clicking #btn-dash-compte-rendu...')
  await win.webContents.executeJavaScript(`
    document.getElementById('btn-dash-compte-rendu')?.click()
  `)
  await new Promise(r => setTimeout(r, 1200))

  const imgCenter = await win.webContents.capturePage()
  fs.writeFileSync(path.join(brainDir, 'compte_rendu_activite_centre.png'), imgCenter.toPNG())
  console.log('Saved compte_rendu_activite_centre.png')

  // Close modal
  await win.webContents.executeJavaScript(`
    document.getElementById('btn-close-compte-rendu')?.click()
  `)
  await new Promise(r => setTimeout(r, 600))

  // 2. Navigate to Students tab
  console.log('Clicking #tab-students...')
  await win.webContents.executeJavaScript(`
    document.getElementById('tab-students')?.click()
  `)
  await new Promise(r => setTimeout(r, 1000))

  // Click Compte Rendu on first student (Aziz Ben Amor)
  console.log('Clicking student report button...')
  await win.webContents.executeJavaScript(`
    document.querySelector('button[id^="btn-report-student-"]')?.click()
  `)
  await new Promise(r => setTimeout(r, 1200))

  const imgStudent = await win.webContents.capturePage()
  fs.writeFileSync(path.join(brainDir, 'compte_rendu_pedagogique_eleve.png'), imgStudent.toPNG())
  console.log('Saved compte_rendu_pedagogique_eleve.png')

  app.quit()
})
