import React, { useState, useEffect } from 'react'
import { Header, ActiveTab } from './components/Header'
import { Dashboard } from './components/Dashboard'
import { DailySheet } from './components/DailySheet'
import { MonthlyRollup } from './components/MonthlyRollup'
import { TimetableGrid } from './components/TimetableGrid'
import { StudentsManager } from './components/StudentsManager'
import { TeachersManager } from './components/TeachersManager'
import { GroupsManager } from './components/GroupsManager'
import { TeacherStudentsTracker } from './components/TeacherStudentsTracker'
import { SettingsPage } from './components/SettingsPage'
import { getAppSettings, applySettingsToDOM, loadPersistedSettings, saveAppSettings } from './services/settingsService'
import { FolderUp, AlertTriangle } from 'lucide-react'

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard')
  const [isInitializing, setIsInitializing] = useState(true)
  const [needsBackupSetup, setNeedsBackupSetup] = useState(false)

  // Initialize and apply user settings (theme, font, size, density) on boot
  useEffect(() => {
    async function init() {
      const settings = getAppSettings()
      applySettingsToDOM(settings)
      const persisted = await loadPersistedSettings()
      
      const isDesktop = typeof window !== 'undefined' && !!(window as any).desktopApp
      if (isDesktop && (!persisted.backupFolderPath || persisted.backupFolderPath === '')) {
        setNeedsBackupSetup(true)
      }
      setIsInitializing(false)
    }
    init()
  }, [])

  const handleSetupBackup = async () => {
    if (typeof window !== 'undefined' && (window as any).desktopApp?.selectDirectory) {
      const res = await (window as any).desktopApp.selectDirectory()
      if (res && res.success && res.path) {
        saveAppSettings({ backupFolderPath: res.path })
        setNeedsBackupSetup(false)
      }
    }
  }

  if (isInitializing) {
    return null // or a loading spinner
  }

  if (needsBackupSetup) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
        backgroundColor: 'var(--color-surface-muted)', padding: 'var(--space-6)'
      }}>
        <div className="card" style={{ maxWidth: '500px', textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)', color: '#f59e0b' }}>
            <AlertTriangle size={48} />
          </div>
          <h2 style={{ marginBottom: 'var(--space-3)' }}>Configuration de la Sauvegarde</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
            Pour garantir la sécurité de vos données, veuillez sélectionner un dossier de sauvegarde. 
            Vos données y seront automatiquement sauvegardées à chaque modification afin que vous 
            puissiez les restaurer à tout moment (ex. en cas de suppression accidentelle).
          </p>
          <button className="btn btn-primary" onClick={handleSetupBackup} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            <FolderUp size={18} />
            Choisir le dossier de sauvegarde
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--color-surface-muted)'
      }}
    >
      <Header activeTab={activeTab} onSelectTab={setActiveTab} />

      <main
        style={{
          flex: 1,
          maxWidth: '1600px',
          width: '100%',
          margin: '0 auto',
          padding: 'var(--space-6) var(--space-4)'
        }}
      >
        {activeTab === 'dashboard' && <Dashboard onNavigateTab={setActiveTab} />}
        {activeTab === 'daily-sheet' && <DailySheet />}
        {activeTab === 'financial-rollup' && <MonthlyRollup />}
        {activeTab === 'teacher-students' && <TeacherStudentsTracker />}
        {activeTab === 'timetable' && <TimetableGrid />}
        {activeTab === 'students' && <StudentsManager />}
        {activeTab === 'teachers' && <TeachersManager />}
        {activeTab === 'groups' && <GroupsManager />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      <footer
        style={{
          backgroundColor: 'var(--color-surface-raised)',
          borderTop: '1px solid var(--color-border-subtle)',
          padding: 'var(--space-3) var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--color-text-muted)'
        }}
      >
        <div>
          <span>Système de Base Relationnelle SQLite Normalisée</span>
          <span style={{ margin: '0 var(--space-2)' }}>•</span>
          <span>Tables : <code>Teachers, Students, Enrollments, Sessions, Payments, Timetable</code></span>
        </div>
        <div>
          <span>Navigation Clavier Active (WCAG 2.2 AA)</span>
          <span style={{ margin: '0 var(--space-2)' }}>•</span>
          <span>Session Administrateur Unique</span>
        </div>
      </footer>
    </div>
  )
}

export default App
