import { getDatabase, persistDatabase } from '../db/sqlite'

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontFamily = 'Inter' | 'Outfit' | 'Roboto' | 'Plus Jakarta Sans' | 'Lexend' | 'JetBrains Mono'
export type FontSize = '13px' | '14px' | '15px' | '16px'
export type TableDensity = 'compact' | 'normal' | 'comfortable'

export interface AppSettings {
  // Appearance
  theme: ThemeMode
  fontFamily: FontFamily
  fontSize: FontSize
  tableDensity: TableDensity
  primaryAccent: string

  // Center Details (for Invoices and Official Statements)
  centerName: string
  centerCity: string
  centerAddress: string
  centerPhone: string
  centerEmail: string
  centerMatricule: string

  // Financial & Remuneration
  currency: string
  currencyDecimals: number
  defaultTeacherCommission: number
  defaultTeacherRatePerStudent: number
  yearlyInscriptionFee: number

  // Invoices & Printing
  invoicePaperFormat: 'A4' | 'Letter'
  showLogoOnInvoice: boolean
  invoiceNotes: string

  // Accessibility & UX
  highContrast: boolean
  reduceMotion: boolean
  confirmOnDelete: boolean

  // Backup & Restore
  backupFolderPath: string
}

export const defaultSettings: AppSettings = {
  theme: 'light',
  fontFamily: 'Inter',
  fontSize: '14px',
  tableDensity: 'normal',
  primaryAccent: '#4f46e5',

  centerName: "Centre d'Excellence & Soutien Scolaire",
  centerCity: "Tunis",
  centerAddress: "12 Avenue Habib Bourguiba, 1001 Tunis",
  centerPhone: "+216 71 234 567",
  centerEmail: "contact@soutien-scolaire.tn",
  centerMatricule: "MF-2026/104928-T",

  currency: 'DTN',
  currencyDecimals: 2,
  defaultTeacherCommission: 70,
  defaultTeacherRatePerStudent: 50,
  yearlyInscriptionFee: 50,

  invoicePaperFormat: 'A4',
  showLogoOnInvoice: true,
  invoiceNotes: "Règlement exigible à la première séance du mois. Tout cours non décommandé 24h à l'avance reste dû.",

  highContrast: false,
  reduceMotion: false,
  confirmOnDelete: true,

  backupFolderPath: ''
}

const SETTINGS_KEY = 'soutien_scolaire_settings'

let cachedSettings: AppSettings = { ...defaultSettings }

export function getAppSettings(): AppSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw)
      cachedSettings = { ...defaultSettings, ...parsed }
      return cachedSettings
    }
  } catch (e) {
    console.warn('Failed to parse app settings from localStorage, using defaults:', e)
  }

  return cachedSettings
}

export async function loadPersistedSettings(): Promise<AppSettings> {
  // 1. Try loading from Desktop App filesystem
  if (typeof window !== 'undefined' && (window as any).desktopApp?.loadSettings) {
    try {
      const res = await (window as any).desktopApp.loadSettings()
      if (res && res.success && res.data) {
        cachedSettings = { ...defaultSettings, ...res.data }
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(cachedSettings))
        applySettingsToDOM(cachedSettings)
        return cachedSettings
      }
    } catch (e) {
      console.warn('Could not load settings from desktopApp file:', e)
    }
  }

  // 2. Try loading from SQLite database AppSettings table
  try {
    const res = await window.desktopApp.dbQuery("SELECT value FROM AppSettings WHERE key = 'settings';")
    if (res.length > 0) {
      const valStr = String(res[0].value)
      const parsed = JSON.parse(valStr)
      cachedSettings = { ...defaultSettings, ...parsed }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(cachedSettings))
      applySettingsToDOM(cachedSettings)
      return cachedSettings
    }
  } catch (e) {
    // Database might not be ready or table not created yet
  }

  // 3. Fallback to localStorage / defaults
  const current = getAppSettings()
  applySettingsToDOM(current)
  return current
}

export function saveAppSettings(newSettings: Partial<AppSettings>): AppSettings {
  const current = getAppSettings()
  const updated: AppSettings = { ...current, ...newSettings }
  cachedSettings = updated

  // 1. Save to localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated))
    }
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e)
  }

  // 2. Save to Desktop File if in Electron
  if (typeof window !== 'undefined' && (window as any).desktopApp?.saveSettings) {
    try {
      (window as any).desktopApp.saveSettings(updated).catch((err: any) => {
        console.error('Failed to save settings to desktop file:', err)
      })
    } catch (err) {
      console.error('IPC saveSettings error:', err)
    }
  }

  // 3. Save to SQLite database AppSettings table
  getDatabase().then(() => {
    try {
      window.desktopApp.dbRun("INSERT OR REPLACE INTO AppSettings (key, value) VALUES ('settings', ?);", [JSON.stringify(updated)])
    } catch (err) {
      console.warn('Failed to persist settings into SQLite table:', err)
    }
  }).catch(() => {})

  applySettingsToDOM(updated)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app_settings_updated', { detail: updated }))
  }
  return updated
}

export function applySettingsToDOM(settings: AppSettings) {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  // 1. Theme (Light, Dark, System)
  let resolvedTheme = settings.theme
  if (settings.theme === 'system') {
    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  root.setAttribute('data-theme', resolvedTheme)

  // 2. Font Family
  const fontMap: Record<FontFamily, string> = {
    'Inter': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    'Outfit': "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    'Roboto': "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    'Plus Jakarta Sans': "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    'Lexend': "'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    'JetBrains Mono': "'JetBrains Mono', monospace"
  }
  const chosenFont = fontMap[settings.fontFamily] || fontMap['Inter']
  root.style.setProperty('--font-family-primary', chosenFont)

  // 3. Font Size
  root.style.setProperty('--font-size-base', settings.fontSize || '14px')

  // 4. Table Density
  if (settings.tableDensity === 'compact') {
    root.style.setProperty('--table-cell-padding-y', '4px')
    root.style.setProperty('--table-cell-padding-x', '8px')
  } else if (settings.tableDensity === 'comfortable') {
    root.style.setProperty('--table-cell-padding-y', '12px')
    root.style.setProperty('--table-cell-padding-x', '16px')
  } else {
    root.style.setProperty('--table-cell-padding-y', '8px')
    root.style.setProperty('--table-cell-padding-x', '12px')
  }

  // 5. Primary Accent
  if (settings.primaryAccent) {
    root.style.setProperty('--color-primary-accent', settings.primaryAccent)
  }

  // 6. Accessibility flags
  if (settings.highContrast) {
    root.setAttribute('data-contrast', 'high')
  } else {
    root.removeAttribute('data-contrast')
  }

  if (settings.reduceMotion) {
    root.setAttribute('data-motion', 'reduced')
  } else {
    root.removeAttribute('data-motion')
  }
}

// Backup & Restore Utilities
export async function exportDatabaseBinary(): Promise<void> {
  alert('Desktop database export is handled by the application folder. To backup, simply copy the data.sqlite file.');
}

export async function importDatabaseBinary(file: File): Promise<boolean> {
  alert('Desktop database import is currently unsupported through the UI. Please replace data.sqlite manually.');
  return false;
}
