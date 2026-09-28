import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const ROOT_DIR = process.cwd()
const RELEASE_DIR = path.join(ROOT_DIR, 'release', 'Espoir-win32-x64')
const ELECTRON_DIST = path.join(ROOT_DIR, 'node_modules', 'electron', 'dist')

console.log('=== PACKAGING Espoir AS STANDALONE WINDOWS EXECUTABLE (.EXE) ===')

// 1. Build Vite and TypeScript assets
console.log('1. Building latest React & TypeScript production bundle...')
execSync('npm run build', { stdio: 'inherit', cwd: ROOT_DIR })

// 2. Prepare Release Directory
console.log('2. Preparing release directory...')
if (!fs.existsSync(RELEASE_DIR)) {
  fs.mkdirSync(RELEASE_DIR, { recursive: true })
}

// 3. Copy Electron Runtime Dist Files if not already present
const targetExe = path.join(RELEASE_DIR, 'Espoir.exe')
if (!fs.existsSync(targetExe)) {
  console.log('3. Copying native Electron Windows x64 binary and runtime libraries...')
  fs.cpSync(ELECTRON_DIST, RELEASE_DIR, { recursive: true })
  const oldExe = path.join(RELEASE_DIR, 'electron.exe')
  if (fs.existsSync(oldExe)) {
    fs.renameSync(oldExe, targetExe)
    console.log(`[SUCCESS] Renamed executable to: ${path.basename(targetExe)}`)
  }
} else {
  console.log('3. Native Electron runtime binary already present.')
}

// 5. Build resources/app structure
console.log('4. Bundling application payload into resources/app...')
const appDir = path.join(RELEASE_DIR, 'resources', 'app')
fs.mkdirSync(appDir, { recursive: true })

// Copy package.json
fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(appDir, 'package.json'))

// Copy electron/ folder
fs.cpSync(path.join(ROOT_DIR, 'electron'), path.join(appDir, 'electron'), { recursive: true })

// Copy dist/ folder
fs.cpSync(path.join(ROOT_DIR, 'dist'), path.join(appDir, 'dist'), { recursive: true })

// Strip crossorigin from packaged index.html so Chromium file:// loads without CORS restrictions
const packagedHtmlPath = path.join(appDir, 'dist', 'index.html')
if (fs.existsSync(packagedHtmlPath)) {
  let htmlContent = fs.readFileSync(packagedHtmlPath, 'utf-8')
  htmlContent = htmlContent.replace(/ crossorigin/g, '')
  fs.writeFileSync(packagedHtmlPath, htmlContent)
  console.log('[SUCCESS] Cleaned CORS crossorigin attributes for local file:// protocol.')
}

// Copy public/ folder
if (fs.existsSync(path.join(ROOT_DIR, 'public'))) {
  fs.cpSync(path.join(ROOT_DIR, 'public'), path.join(appDir, 'public'), { recursive: true })
}

// Copy essential runtime node_modules
console.log('5. Copying necessary runtime dependencies...')
console.log('   Rebuilding native modules for Electron...')
execSync('npx @electron/rebuild -f -w better-sqlite3', { stdio: 'inherit', cwd: ROOT_DIR })

const appNodeModules = path.join(appDir, 'node_modules')
fs.mkdirSync(appNodeModules, { recursive: true })

const requiredDeps = ['better-sqlite3', 'bindings', 'file-uri-to-path', 'clsx', 'lucide-react', 'react', 'react-dom']
for (const dep of requiredDeps) {
  const src = path.join(ROOT_DIR, 'node_modules', dep)
  const dest = path.join(appNodeModules, dep)
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true })
  }
}

// 6. Verify Target Executable
if (fs.existsSync(targetExe)) {
  const stats = fs.statSync(targetExe)
  console.log('=================================================================')
  console.log(`[SUCCESS] Standalone Windows Executable (.exe) created successfully!`)
  console.log(`Path: ${targetExe}`)
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  console.log('=================================================================')
} else {
  throw new Error('Target executable was not created.')
}

