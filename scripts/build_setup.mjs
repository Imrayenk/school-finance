import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const ROOT_DIR = process.cwd()
const APP_DIR = path.join(ROOT_DIR, 'release', 'Espoir-win32-x64')
const RELEASE_DIR = path.join(ROOT_DIR, 'release')
const SETUP_EXE = path.join(RELEASE_DIR, 'Espoir Setup 0.0.1.exe')

console.log('=== BUILDING STANDALONE NSIS SETUP INSTALLER (.EXE) ===\n')

// 1. Ensure latest app is packaged
console.log('1. Ensuring latest application bundle is packaged...')
execSync('node scripts/package_app.mjs', { stdio: 'inherit', cwd: ROOT_DIR })

// 2. Find makensis.exe
console.log('\n2. Locating NSIS makensis compiler...')
const possiblePaths = [
  path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'nsis', 'nsis-3.0.4.1-nsis-3.0.4.1', 'Bin', 'makensis.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'nsis-3.0.4.1', 'nsis-3.0.4.1-1mx3n', 'Bin', 'makensis.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'nsis', 'nsis-3.0.4.1-nsis-3.0.4.1', 'makensis.exe')
]

let makensisPath = possiblePaths.find(p => fs.existsSync(p))

if (!makensisPath) {
  // Search recursively in electron-builder cache
  const cacheDir = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache')
  if (fs.existsSync(cacheDir)) {
    const findExe = (dir) => {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const full = path.join(dir, file)
        if (fs.statSync(full).isDirectory()) {
          const found = findExe(full)
          if (found) return found
        } else if (file.toLowerCase() === 'makensis.exe') {
          return full
        }
      }
      return null
    }
    makensisPath = findExe(cacheDir)
  }
}

if (!makensisPath) {
  throw new Error('makensis.exe compiler not found in electron-builder cache.')
}

console.log(`[FOUND] makensis at: ${makensisPath}`)

// 3. Generate NSIS script
console.log('\n3. Generating NSIS Installer Script...')
const nsiScriptPath = path.join(ROOT_DIR, 'installer.nsi')

const nsiContent = `
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"

; General Configuration
Name "Espoir"
OutFile "${SETUP_EXE.replace(/\\/g, '\\\\')}"
InstallDir "$LOCALAPPDATA\\\\Programs\\\\Espoir"
InstallDirRegKey HKCU "Software\\\\Espoir" "Install_Dir"
RequestExecutionLevel user
SetCompressor /SOLID lzma

; Interface Settings
!define MUI_ABORTWARNING

; Installer Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\\\\Espoir.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer Espoir"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "French"

; Installer Section
Section "Installer" SecMain
  SetOutPath "$INSTDIR"

  ; Copy all packaged files
  File /r "${APP_DIR.replace(/\\/g, '\\\\')}\\\\*.*"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\\\\Uninstall.exe"

  ; Registry keys for Add/Remove Programs
  WriteRegStr HKCU "Software\\\\Espoir" "Install_Dir" "$INSTDIR"
  WriteRegStr HKCU "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\Espoir" "DisplayName" "Espoir"
  WriteRegStr HKCU "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\Espoir" "UninstallString" '"$INSTDIR\\\\Uninstall.exe"'
  WriteRegStr HKCU "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\Espoir" "DisplayIcon" '"$INSTDIR\\\\Espoir.exe"'
  WriteRegStr HKCU "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\Espoir" "Publisher" "Espoir"
  WriteRegStr HKCU "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\Espoir" "DisplayVersion" "0.0.1"

  ; Shortcuts
  CreateDirectory "$SMPROGRAMS\\\\Espoir"
  CreateShortcut "$SMPROGRAMS\\\\Espoir\\\\Espoir.lnk" "$INSTDIR\\\\Espoir.exe"
  CreateShortcut "$SMPROGRAMS\\\\Espoir\\\\Desinstaller.lnk" "$INSTDIR\\\\Uninstall.exe"
  CreateShortcut "$DESKTOP\\\\Espoir.lnk" "$INSTDIR\\\\Espoir.exe"
SectionEnd

; Uninstaller Section
Section "Uninstall"
  ; Remove shortcuts
  Delete "$DESKTOP\\\\Espoir.lnk"
  Delete "$SMPROGRAMS\\\\Espoir\\\\Espoir.lnk"
  Delete "$SMPROGRAMS\\\\Espoir\\\\Desinstaller.lnk"
  RMDir "$SMPROGRAMS\\\\Espoir"

  ; Remove registry keys
  DeleteRegKey HKCU "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\Espoir"
  DeleteRegKey HKCU "Software\\\\Espoir"

  ; Remove installed files
  RMDir /r "$INSTDIR"
SectionEnd
`

fs.writeFileSync(nsiScriptPath, nsiContent.trim(), 'utf-8')
console.log(`[SUCCESS] Wrote installer script to: ${nsiScriptPath}`)

// 4. Compile NSIS installer
console.log('\n4. Compiling Windows Setup Installer with NSIS...')
execSync(`"${makensisPath}" "${nsiScriptPath}"`, { stdio: 'inherit' })

// 5. Clean up .nsi script
if (fs.existsSync(nsiScriptPath)) {
  fs.unlinkSync(nsiScriptPath)
}

// 6. Verify generated installer
if (fs.existsSync(SETUP_EXE)) {
  const stats = fs.statSync(SETUP_EXE)
  console.log('\n=================================================================')
  console.log('🎉 SETUP INSTALLER CREATED SUCCESSFULLY (.EXE)!')
  console.log(`📁 File: ${SETUP_EXE}`)
  console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  console.log('=================================================================\n')
} else {
  throw new Error('Setup executable was not created.')
}


