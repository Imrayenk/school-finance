import React, { useState, useEffect } from 'react'
import {
  getAppSettings,
  saveAppSettings,
  defaultSettings,
  exportDatabaseBinary,
  importDatabaseBinary,
  AppSettings,
  ThemeMode,
  FontFamily,
  FontSize,
  TableDensity
} from '../services/settingsService'
import { resetToTunisianDemoData } from '../db/sqlite'
import {
  Moon,
  Sun,
  Laptop,
  Type,
  Building,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Eye,
  SlidersHorizontal,
  Palette,
  HardDrive,
  Save,
  Check
} from 'lucide-react'

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(getAppSettings)
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [isSaved, setIsSaved] = useState(true)

  // Local draft state for text fields
  const [centerForm, setCenterForm] = useState({
    centerName: settings.centerName,
    centerCity: settings.centerCity,
    centerAddress: settings.centerAddress,
    centerPhone: settings.centerPhone,
    centerEmail: settings.centerEmail,
    centerMatricule: settings.centerMatricule,
    invoiceNotes: settings.invoiceNotes,
    yearlyInscriptionFee: settings.yearlyInscriptionFee
  })

  // Synchronize when settings change externally
  useEffect(() => {
    const handleSettingsUpdated = (e: any) => {
      if (e.detail) {
        setSettings(e.detail)
        setCenterForm({
          centerName: e.detail.centerName,
          centerCity: e.detail.centerCity,
          centerAddress: e.detail.centerAddress,
          centerPhone: e.detail.centerPhone,
          centerEmail: e.detail.centerEmail,
          centerMatricule: e.detail.centerMatricule,
          invoiceNotes: e.detail.invoiceNotes,
          yearlyInscriptionFee: e.detail.yearlyInscriptionFee
        })
      }
    }
    window.addEventListener('app_settings_updated', handleSettingsUpdated)
    return () => window.removeEventListener('app_settings_updated', handleSettingsUpdated)
  }, [])

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3500)
  }

  const handleUpdate = (partial: Partial<AppSettings>, notify = true) => {
    const updated = saveAppSettings(partial)
    setSettings(updated)
    if (notify) {
      showNotification('Paramètres mis à jour avec succès.')
    }
  }

  const handleCenterFormChange = (field: keyof typeof centerForm, value: string) => {
    setCenterForm((prev) => ({ ...prev, [field]: value }))
    setIsSaved(false)
  }

  const handleSaveCenterDetails = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const updated = saveAppSettings(centerForm)
    setSettings(updated)
    setIsSaved(true)
    showNotification("Coordonnées de l'établissement enregistrées avec succès.")
  }

  const handleResetDefaults = () => {
    const reset = saveAppSettings(defaultSettings)
    setSettings(reset)
    setCenterForm({
      centerName: reset.centerName,
      centerCity: reset.centerCity,
      centerAddress: reset.centerAddress,
      centerPhone: reset.centerPhone,
      centerEmail: reset.centerEmail,
      centerMatricule: reset.centerMatricule,
      invoiceNotes: reset.invoiceNotes,
      yearlyInscriptionFee: reset.yearlyInscriptionFee
    })
    setIsSaved(true)
    showNotification('Préférences réinitialisées aux valeurs par défaut.')
  }

  const handleExportBackup = async () => {
    try {
      await exportDatabaseBinary()
      showNotification('Base de données SQLite exportée avec succès (Téléchargement web).')
    } catch (e) {
      showNotification("Erreur lors de l'export de la base.", 'error')
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      await importDatabaseBinary(file)
      showNotification('Base SQLite restaurée avec succès ! Les données ont été synchronisées.')
    } catch (e: any) {
      alert("Erreur lors de l'importation : fichier SQLite invalide ou endommagé.")
      showNotification("Échec de l'importation de la base.", 'error')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleChangeBackupFolder = async () => {
    if (typeof window !== 'undefined' && (window as any).desktopApp?.selectDirectory) {
      const res = await (window as any).desktopApp.selectDirectory()
      if (res && res.success && res.path) {
        handleUpdate({ backupFolderPath: res.path })
      }
    } else {
      showNotification("Cette fonctionnalité nécessite l'application de bureau.", 'error')
    }
  }

  const handleManualBackup = async () => {
    if (typeof window !== 'undefined' && (window as any).desktopApp?.backupDatabase) {
      let folderPath = settings.backupFolderPath
      if (!folderPath) {
        if ((window as any).desktopApp.selectDirectory) {
          const resDir = await (window as any).desktopApp.selectDirectory()
          if (resDir && resDir.success && resDir.path) {
            folderPath = resDir.path
            handleUpdate({ backupFolderPath: folderPath }, false)
          } else {
            return
          }
        } else {
          showNotification("Veuillez d'abord configurer un dossier de sauvegarde.", "error")
          return
        }
      }
      const res = await (window as any).desktopApp.backupDatabase(folderPath)
      if (res && res.success) {
        showNotification('Base de données sauvegardée avec succès dans votre dossier.')
      } else {
        showNotification("Erreur lors de la sauvegarde : " + (res?.error || "Inconnue"), 'error')
      }
    } else {
      // Fallback for web
      handleExportBackup()
    }
  }

  const handleNativeRestore = async () => {
    if (typeof window !== 'undefined' && (window as any).desktopApp?.restoreDatabase) {
      const res = await (window as any).desktopApp.restoreDatabase()
      if (res && res.success) {
        showNotification('Base SQLite restaurée avec succès ! L\'application va se rafraîchir.')
        setTimeout(() => window.location.reload(), 1500)
      } else if (res && res.reason !== 'canceled') {
        showNotification("Erreur lors de la restauration : " + (res?.error || "Inconnue"), 'error')
      }
    } else {
      // Open hidden file input for web fallback
      document.getElementById('input-sqlite-file')?.click()
    }
  }

  const handleConfirmResetDemo = async () => {
    try {
      await resetToTunisianDemoData()
      showNotification('Jeu de données de démonstration tunisien réinitialisé avec succès.')
      setResetModalOpen(false)
    } catch (e) {
      showNotification('Erreur lors de la réinitialisation des données.', 'error')
    }
  }

  const fontOptions: { id: FontFamily; label: string; desc: string }[] = [
    { id: 'Inter', label: 'Inter', desc: 'Standard moderne, haute lisibilité & netteté (Défaut)' },
    { id: 'Outfit', label: 'Outfit', desc: 'Géométrique, design contemporain et élégant' },
    { id: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', desc: 'Typographie premium raffinée pour tableaux' },
    { id: 'Roboto', label: 'Roboto', desc: 'Polyvalent, neutre et universel' },
    { id: 'Lexend', label: 'Lexend', desc: 'Conçu ergonomiquement pour réduire la fatigue oculaire' },
    { id: 'JetBrains Mono', label: 'JetBrains Mono', desc: 'Police monospace idéale pour les alignements chiffrés' }
  ]

  const sizeOptions: { id: FontSize; label: string; desc: string }[] = [
    { id: '13px', label: 'Compacte (13px)', desc: 'Plus de données visibles à l\'écran' },
    { id: '14px', label: 'Standard (14px)', desc: 'Taille optimale recommandée' },
    { id: '15px', label: 'Confortable (15px)', desc: 'Lecture plus aérée et reposante' },
    { id: '16px', label: 'Grande (16px)', desc: 'Accessibilité visuelle renforcée' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          className="toast-success"
          style={{ background: notification.type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)' }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {notification.msg}
        </div>
      )}

      {/* Hero Banner */}
      <div className="page-hero hero-slate fade-in">
        <div className="page-hero-content">
          <div className="page-hero-icon">
            <SlidersHorizontal size={26} color="white" />
          </div>
          <div>
            <h1 className="page-hero-title">Paramètres & Configuration</h1>
            <p className="page-hero-subtitle">
              Mode sombre, typographie, données de facturation et base SQLite locale
            </p>
          </div>
        </div>
        <div className="page-hero-actions">
          <button id="btn-reset-defaults" type="button" className="btn-hero-outline" onClick={handleResetDefaults}>
            <RotateCcw size={14} /> Réinitialiser
          </button>
        </div>
      </div>

      {/* Grid of Settings Categories */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 'var(--space-4)' }}>
        
        {/* ========================================================= */}
        {/* 1. Coordonnées & En-tête Factures (Priorité Haute) */}
        {/* ========================================================= */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', gridColumn: 'span 1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18} color="#059669" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Établissement & Coordonnées (Factures)</h3>
            </div>
            {isSaved ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#059669', fontWeight: 600, backgroundColor: '#ecfdf5', padding: '3px 8px', borderRadius: '6px' }}>
                <Check size={13} /> Enregistré
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, backgroundColor: '#fffbeb', padding: '3px 8px', borderRadius: '6px' }}>
                ● Non enregistré
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCenterDetails} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="cfg-center-name" style={{ fontSize: '12px', fontWeight: 600 }}>
                Raison Sociale / Nom du Centre :
              </label>
              <input
                id="cfg-center-name"
                type="text"
                className="input-field"
                value={centerForm.centerName}
                onChange={(e) => handleCenterFormChange('centerName', e.target.value)}
                onBlur={() => handleUpdate({ centerName: centerForm.centerName }, false)}
                placeholder="Ex: Centre d'Excellence & Soutien Scolaire"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="cfg-center-phone" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Téléphone (+216) :
                </label>
                <input
                  id="cfg-center-phone"
                  type="text"
                  className="input-field"
                  value={centerForm.centerPhone}
                  onChange={(e) => handleCenterFormChange('centerPhone', e.target.value)}
                  onBlur={() => handleUpdate({ centerPhone: centerForm.centerPhone }, false)}
                  placeholder="+216 71 234 567"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="cfg-center-email" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Email de Contact :
                </label>
                <input
                  id="cfg-center-email"
                  type="email"
                  className="input-field"
                  value={centerForm.centerEmail}
                  onChange={(e) => handleCenterFormChange('centerEmail', e.target.value)}
                  onBlur={() => handleUpdate({ centerEmail: centerForm.centerEmail }, false)}
                  placeholder="contact@soutien-scolaire.tn"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="cfg-center-address" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Adresse :
                </label>
                <input
                  id="cfg-center-address"
                  type="text"
                  className="input-field"
                  value={centerForm.centerAddress}
                  onChange={(e) => handleCenterFormChange('centerAddress', e.target.value)}
                  onBlur={() => handleUpdate({ centerAddress: centerForm.centerAddress }, false)}
                  placeholder="12 Avenue Habib Bourguiba"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="cfg-center-city" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Ville :
                </label>
                <input
                  id="cfg-center-city"
                  type="text"
                  className="input-field"
                  value={centerForm.centerCity}
                  onChange={(e) => handleCenterFormChange('centerCity', e.target.value)}
                  onBlur={() => handleUpdate({ centerCity: centerForm.centerCity }, false)}
                  placeholder="Tunis"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="cfg-center-matricule" style={{ fontSize: '12px', fontWeight: 600 }}>
                Matricule Fiscal / Référence :
              </label>
              <input
                id="cfg-center-matricule"
                type="text"
                className="input-field"
                value={centerForm.centerMatricule}
                onChange={(e) => handleCenterFormChange('centerMatricule', e.target.value)}
                onBlur={() => handleUpdate({ centerMatricule: centerForm.centerMatricule }, false)}
                placeholder="MF-2026/104928-T"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="cfg-center-inscription" style={{ fontSize: '12px', fontWeight: 600 }}>
                Frais d'inscription annuel (par défaut) :
              </label>
              <input
                id="cfg-center-inscription"
                type="number"
                className="input-field"
                value={centerForm.yearlyInscriptionFee}
                onChange={(e) => handleCenterFormChange('yearlyInscriptionFee', e.target.value)}
                onBlur={() => handleUpdate({ yearlyInscriptionFee: Number(centerForm.yearlyInscriptionFee) }, false)}
                placeholder="Ex: 50"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="cfg-center-notes" style={{ fontSize: '12px', fontWeight: 600 }}>
                Mention Légale / Pied de page factures :
              </label>
              <textarea
                id="cfg-center-notes"
                className="input-field"
                rows={2}
                value={centerForm.invoiceNotes}
                onChange={(e) => handleCenterFormChange('invoiceNotes', e.target.value)}
                onBlur={() => handleUpdate({ invoiceNotes: centerForm.invoiceNotes }, false)}
                placeholder="Conditions de règlement affichées en bas de chaque facture..."
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                id="btn-save-center-details"
                type="submit"
                className="btn btn-primary btn-sm"
                style={{
                  gap: '6px',
                  backgroundColor: '#059669',
                  borderColor: '#047857',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              >
                <Save size={15} />
                Enregistrer les Coordonnées
              </button>
            </div>
          </form>
        </div>

        {/* ========================================================= */}
        {/* 2. Apparence & Thème */}
        {/* ========================================================= */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '10px' }}>
            <Palette size={18} color="#8b5cf6" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Apparence & Thème Visuel</h3>
          </div>

          {/* Theme Mode Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Thème d'affichage :</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                id="btn-theme-light"
                type="button"
                onClick={() => handleUpdate({ theme: 'light' })}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: settings.theme === 'light' ? '2px solid #3b82f6' : '1px solid var(--color-border)',
                  backgroundColor: settings.theme === 'light' ? '#eff6ff' : 'var(--color-surface-raised)',
                  color: settings.theme === 'light' ? '#1d4ed8' : 'var(--color-text-secondary)',
                  fontWeight: 600,
                  fontSize: '12px'
                }}
              >
                <Sun size={20} color="#f59e0b" />
                <span>Clair</span>
              </button>

              <button
                id="btn-theme-dark"
                type="button"
                onClick={() => handleUpdate({ theme: 'dark' })}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: settings.theme === 'dark' ? '2px solid #8b5cf6' : '1px solid var(--color-border)',
                  backgroundColor: settings.theme === 'dark' ? '#1e293b' : 'var(--color-surface-raised)',
                  color: settings.theme === 'dark' ? '#c084fc' : 'var(--color-text-secondary)',
                  fontWeight: 600,
                  fontSize: '12px'
                }}
              >
                <Moon size={20} color="#a855f7" />
                <span>Sombre</span>
              </button>

              <button
                id="btn-theme-system"
                type="button"
                onClick={() => handleUpdate({ theme: 'system' })}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: settings.theme === 'system' ? '2px solid #10b981' : '1px solid var(--color-border)',
                  backgroundColor: settings.theme === 'system' ? '#ecfdf5' : 'var(--color-surface-raised)',
                  color: settings.theme === 'system' ? '#059669' : 'var(--color-text-secondary)',
                  fontWeight: 600,
                  fontSize: '12px'
                }}
              >
                <Laptop size={20} color="#10b981" />
                <span>Système OS</span>
              </button>
            </div>
          </div>

          {/* Table Density */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Densité des tableaux et grilles :</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {(['compact', 'normal', 'comfortable'] as TableDensity[]).map((d) => (
                <button
                  key={d}
                  id={`btn-density-${d}`}
                  type="button"
                  onClick={() => handleUpdate({ tableDensity: d })}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    border: settings.tableDensity === d ? '2px solid #4f46e5' : '1px solid var(--color-border)',
                    backgroundColor: settings.tableDensity === d ? 'rgba(79, 70, 229, 0.1)' : 'var(--color-surface-raised)',
                    color: settings.tableDensity === d ? '#4f46e5' : 'var(--color-text-secondary)'
                  }}
                >
                  {d === 'compact' ? 'Compacte' : d === 'normal' ? 'Standard' : 'Aérée'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. Typographie & Police de Caractères */}
        {/* ========================================================= */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '10px' }}>
            <Type size={18} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Police & Taille de Police</h3>
          </div>

          {/* Font Family Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="select-font-family" style={{ fontSize: '13px', fontWeight: 600 }}>
              Police de caractères de l'interface :
            </label>
            <select
              id="select-font-family"
              className="select-field"
              value={settings.fontFamily}
              onChange={(e) => handleUpdate({ fontFamily: e.target.value as FontFamily })}
            >
              {fontOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} — {f.desc}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Police active : <strong>{settings.fontFamily}</strong>
            </span>
          </div>

          {/* Font Size Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Taille de police (Échelle d'affichage) :</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {sizeOptions.map((s) => (
                <button
                  key={s.id}
                  id={`btn-size-${s.id}`}
                  type="button"
                  onClick={() => handleUpdate({ fontSize: s.id })}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: settings.fontSize === s.id ? '2px solid #3b82f6' : '1px solid var(--color-border)',
                    backgroundColor: settings.fontSize === s.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-surface-raised)',
                    color: settings.fontSize === s.id ? '#2563eb' : 'var(--color-text-secondary)'
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '12px' }}>{s.label}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Box */}
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--color-surface-muted)',
              borderRadius: '8px',
              border: '1px dashed var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              <Eye size={12} /> Aperçu Typographique en direct :
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {centerForm.centerName || "Centre d'Excellence & Soutien Scolaire"} (1 995,00 DTN)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              4ème Bac Math · Prof. Mohamed Ben Salem (Quote-part 70%)
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 4. Sauvegarde & Base SQLite */}
        {/* ========================================================= */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '10px' }}>
            <HardDrive size={18} color="#d97706" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Sauvegarde & Maintenance Base SQLite</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Backup Folder Picker */}
            {typeof window !== 'undefined' && !!(window as any).desktopApp && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                      Dossier de Sauvegarde Automatique
                    </div>
                    <div style={{ fontSize: '11px', color: '#15803d', wordBreak: 'break-all' }}>
                      {settings.backupFolderPath || 'Aucun dossier sélectionné'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleChangeBackupFolder}
                    style={{ gap: '6px' }}
                  >
                    Changer
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#166534' }}>
                  Vos données sont automatiquement copiées dans ce dossier de manière sécurisée après chaque modification.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--color-surface-muted)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Sauvegarder Maintenant
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Générez une copie physique complète de toutes vos données.
                </div>
              </div>
              <button
                id="btn-export-sqlite-backup"
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleManualBackup}
                style={{ gap: '6px' }}
              >
                <Download size={14} />
                Sauvegarder
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--color-surface-muted)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Restaurer une Base SQLite
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Chargez un fichier .sqlite sauvegardé pour restaurer vos données.
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ gap: '6px', margin: 0 }}
                onClick={handleNativeRestore}
                disabled={importing}
              >
                <Upload size={14} />
                {importing ? 'Importation...' : 'Restaurer...'}
              </button>
              {/* Hidden file input for web fallback */}
              <input
                id="input-sqlite-file"
                type="file"
                accept=".sqlite,.db,.sqlite3"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#fff1f2', borderRadius: '8px', border: '1px solid #fecdd3' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#9f1239' }}>
                  Réinitialiser le Jeu Démo Tunisien
                </div>
                <div style={{ fontSize: '11px', color: '#be123c' }}>
                  Remet la base SQLite à son état initial propre avec les données tunisiennes.
                </div>
              </div>
              <button
                id="btn-trigger-reset-demo"
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setResetModalOpen(true)}
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 5. Accessibilité & Ergonomie */}
        {/* ========================================================= */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '10px' }}>
            <Sliders size={18} color="#e11d48" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Accessibilité & Ergonomie</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Contraste Élevé (High Contrast)</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Bordures renforcées de 2px pour une distinction maximale.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={(e) => handleUpdate({ highContrast: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Réduction des Animations</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Désactive les transitions pour une réactivité instantanée.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.reduceMotion}
                onChange={(e) => handleUpdate({ reduceMotion: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Confirmation lors des Suppressions</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Affiche un dialogue d'avertissement avant d'effacer une fiche.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.confirmOnDelete}
                onChange={(e) => handleUpdate({ confirmOnDelete: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
          </div>
        </div>

      </div>

      {/* Confirmation Modal for Resetting Demo */}
      {resetModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setResetModalOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c' }}>
              <AlertTriangle size={20} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Confirmer la Réinitialisation ?</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '10px 0 16px 0' }}>
              Cette action rechargera l'ensemble du jeu de démonstration tunisien (élèves, enseignants, séances et paiements). Les données personnalisées créées depuis le dernier export seront écrasées.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setResetModalOpen(false)}
              >
                Annuler
              </button>
              <button
                id="btn-confirm-reset-demo"
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmResetDemo}
              >
                Oui, Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
