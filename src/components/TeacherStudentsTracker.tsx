import React, { useState, useEffect, useCallback } from 'react'
import {
  getTeachers,
  getTeacherStudentsReport,
  recordPayment
} from '../db/sqlite'
import type { Teacher, TeacherSummaryOverview, TeacherStudentReportRow } from '../types'
import {
  UserCheck,
  BookOpen,
  DollarSign,
  Download,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  X,
  CreditCard,
  Search,
  Users,
  Printer,
  ChevronDown,
  GraduationCap
} from 'lucide-react'
import { InvoiceModal } from './InvoiceModal'
import { TeacherPayoutModal } from './TeacherPayoutModal'
import { Pagination } from './Pagination'

function getSubjectTheme(subject: string) {
  const s = (subject || '').toLowerCase()
  if (s.includes('math')) {
    return {
      bg: '#e0e7ff',
      border: '#c7d2fe',
      color: '#3730a3',
      avatarGradient: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
      badgeClass: 'badge-subject badge-subject-math'
    }
  }
  if (s.includes('phys')) {
    return {
      bg: '#e0f2fe',
      border: '#bae6fd',
      color: '#0369a1',
      avatarGradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      badgeClass: 'badge-subject badge-subject-physics'
    }
  }
  if (s.includes('svt') || s.includes('bio') || s.includes('sci')) {
    return {
      bg: '#dcfce7',
      border: '#86efac',
      color: '#166534',
      avatarGradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      badgeClass: 'badge-subject badge-subject-svt'
    }
  }
  if (s.includes('fran')) {
    return {
      bg: '#fef3c7',
      border: '#fde68a',
      color: '#92400e',
      avatarGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      badgeClass: 'badge-subject badge-subject-french'
    }
  }
  if (s.includes('arab') || s.includes('philo') || s.includes('hist')) {
    return {
      bg: '#f3e8ff',
      border: '#e9d5ff',
      color: '#6b21a8',
      avatarGradient: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
      badgeClass: 'badge-subject badge-subject-arabic'
    }
  }
  return {
    bg: '#f1f5f9',
    border: '#cbd5e1',
    color: '#334155',
    avatarGradient: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
    badgeClass: 'badge-subject'
  }
}

export const TeacherStudentsTracker: React.FC = () => {
  const [reports, setReports] = useState<TeacherSummaryOverview[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filterLevel, setFilterLevel] = useState<string>('All')
  const [loading, setLoading] = useState<boolean>(true)
  const [notification, setNotification] = useState<string | null>(null)

  // Pagination
  const [pageByTeacherId, setPageByTeacherId] = useState<Record<string, number>>({})
  const itemsPerPage = 15

  // Reset pagination when filters change
  useEffect(() => {
    setPageByTeacherId({})
  }, [searchTerm, selectedTeacherId, filterLevel])

  // Payment Modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false)
  const [activeStudent, setActiveStudent] = useState<TeacherStudentReportRow | null>(null)
  const [payAmount, setPayAmount] = useState<string>('')
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [invoiceTeacher, setInvoiceTeacher] = useState<Teacher | null>(null)
  const [payoutTeacher, setPayoutTeacher] = useState<{ teacher: Teacher; totalEarned: number } | null>(null)

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  // Load teachers dropdown
  useEffect(() => {
    async function initTeachers() {
      const list = await getTeachers()
      setTeachers(list)
    }
    initTeachers()
  }, [])

  // Refresh reports from SQLite
  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getTeacherStudentsReport(
        selectedTeacherId === 'all' ? undefined : selectedTeacherId
      )
      setReports(data)
    } catch (err) {
      console.error('Failed to load reports:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedTeacherId])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  // Listen to cross-tab SQLite attendance updates
  useEffect(() => {
    const handleUpdate = () => {
      loadReports()
    }
    window.addEventListener('sqlite_attendance_updated', handleUpdate)
    return () => {
      window.removeEventListener('sqlite_attendance_updated', handleUpdate)
    }
  }, [loadReports])

  // Open Payment Modal for a student
  const handleOpenPayment = (student: TeacherStudentReportRow) => {
    setActiveStudent(student)
    setPayAmount(student.debt > 0 ? student.debt.toFixed(2) : '100.00')
    setPayDate(new Date().toISOString().split('T')[0])
    setPaymentModalOpen(true)
  }

  // Submit Payment
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeStudent) return

    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Veuillez saisir un montant supérieur à 0.')
      return
    }

    await recordPayment(activeStudent.studentId, amount, payDate)
    showNotification(`Règlement de ${amount.toFixed(2)} DTN enregistré pour ${activeStudent.studentName}.`)
    setPaymentModalOpen(false)
    setActiveStudent(null)

    // Trigger cross-tab sync
    window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
    await loadReports()
  }

  // Export CSV
  const handleExportCsv = () => {
    if (reports.length === 0) return

    let csv = '\uFEFFEnseignant,Matière,Mode Rémunération,Taux / Forfait,Élève,Niveau,Contact Parent,Tarif Horaire (DTN),Séances Étudiées,Coût Total Séances (DTN),Part Prof Estimée (DTN),Total Payé (DTN),Dette / Reste Dû (DTN),Statut,Dernière Présence\n'

    reports.forEach((rep) => {
      const modeLabel = rep.teacher.payment_mode === 'per_student' ? 'Par Élève' : 'Au Pourcentage'
      const rateLabel = rep.teacher.payment_mode === 'per_student' ? `${rep.teacher.rate_per_student.toFixed(2)} DTN/él` : `${(rep.teacher.monthly_rate_cut * 100).toFixed(0)}%`
      rep.students.forEach((s) => {
        csv += `"${rep.teacher.name}","${rep.teacher.subject}","${modeLabel}","${rateLabel}","${s.studentName}","${s.gradeLevel}","${s.parentContact}",${s.hourlyRate.toFixed(2)},${s.sessionsStudied},${s.totalSessionsCost.toFixed(2)},${(s.teacherStudentPayout || 0).toFixed(2)},${s.totalPaid.toFixed(2)},${s.debt.toFixed(2)},"${s.isPaidInFull ? 'Réglé' : 'En dette'}","${s.lastAttendedDate || 'Aucune'}"\n`
      })
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `suivi_enseignants_eleves_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showNotification('Export CSV généré avec succès.')
  }

  // Aggregate KPI metrics across displayed reports
  const totalEnrolled = reports.reduce((acc, r) => acc + r.studentsCount, 0)
  const totalSessionsStudied = reports.reduce((acc, r) => acc + r.totalSessionsStudied, 0)
  const totalRevenue = reports.reduce((acc, r) => acc + r.totalRevenue, 0)
  const totalTeacherPayout = reports.reduce((acc, r) => acc + r.teacherPayoutCut, 0)
  const totalDebt = reports.reduce((acc, r) => acc + r.totalStudentDebt, 0)
  const totalPaid = reports.reduce((acc, r) => acc + r.totalStudentPaid, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Toast Notification */}
      {notification && (
        <div className="toast-success">
          <CheckCircle2 size={18} />
          {notification}
        </div>
      )}

      {/* Hero Banner */}
      <div className="page-hero hero-violet fade-in">
        <div className="page-hero-content">
          <div className="page-hero-icon">
            <UserCheck size={26} color="white" />
          </div>
          <div>
            <h1 className="page-hero-title">Suivi des Élèves par Enseignant</h1>
            <p className="page-hero-subtitle">
              Séances suivies, montants encaissés et soldes en temps réel · Synchronisé avec la présence
            </p>
          </div>
        </div>
        <div className="page-hero-actions">
          <div
            className="filter-pill-container"
            style={{ display: 'flex', alignItems: 'center', padding: '3px 10px 3px 12px', gap: '10px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white' }}>
              <GraduationCap size={14} />
              <label htmlFor="select-teacher-report" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Enseignant
              </label>
            </div>
            <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.3)' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                id="select-teacher-report"
                className="filter-pill-select"
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                style={{ minWidth: '210px', color: 'white', background: 'transparent' }}
              >
                <option value="all">Tous les Enseignants ({teachers.length})</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '6px', pointerEvents: 'none', color: 'rgba(255,255,255,0.7)' }} />
            </div>
          </div>

          <div
            className="filter-pill-container"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '3px 10px 3px 12px', gap: '8px', width: '220px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            <Search size={15} style={{ color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
            <input
              id="search-student-report"
              type="text"
              className="filter-pill-input"
              placeholder="Rechercher un élève..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ color: 'white' }}
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} style={{ background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', borderRadius: '50%' }} title="Effacer">
                <X size={14} />
              </button>
            )}
          </div>

          <div
            className="filter-pill-container"
            style={{ display: 'flex', alignItems: 'center', padding: '3px 10px 3px 12px', gap: '10px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white' }}>
              <BookOpen size={14} />
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap' }}>
                Niveau
              </label>
            </div>
            <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.3)' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                className="filter-pill-select"
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                style={{ minWidth: '130px', color: 'white', background: 'transparent' }}
              >
                <option value="All">Tous les Niveaux</option>
                <option value="Primaire">Primaire</option>
                <option value="Collège">Collège</option>
                <option value="1ère">1ère Année Sec.</option>
                <option value="2ème">2ème Année Sec.</option>
                <option value="3ème">3ème Année Sec.</option>
                <option value="4ème">4ème Année (Bac)</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '6px', pointerEvents: 'none', color: 'rgba(255,255,255,0.7)' }} />
            </div>
          </div>

          <button id="btn-export-teacher-report" type="button" className="btn-hero-outline" onClick={handleExportCsv}>
            <Download size={15} />
            Export CSV
          </button>

          {selectedTeacherId !== 'all' && (
            <button id="btn-print-teacher-statement" type="button" className="btn-hero" onClick={() => { const t = teachers.find((tch) => tch.id === selectedTeacherId); if (t) setInvoiceTeacher(t) }} title="Imprimer le bordereau">
              <Printer size={15} />
              Bordereau
            </button>
          )}
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-3)'
        }}
      >
        <div className="card-kpi card-kpi-slate" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
              Inscriptions Suivies
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#1e293b' }}>
              {totalEnrolled} élève{totalEnrolled > 1 ? 's' : ''}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {reports.length} enseignant{reports.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="icon-bubble" style={{ backgroundColor: '#ffffff', color: '#475569' }}>
            <Users size={20} aria-hidden="true" />
          </div>
        </div>

        <div className="card-kpi card-kpi-blue" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>
              Total Séances Étudiées
            </span>
            <div
              id="kpi-total-sessions-studied"
              style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#1d4ed8' }}
            >
              {totalSessionsStudied}
            </div>
            <span style={{ fontSize: '11px', color: '#3b82f6' }}>
              Séances validées en présence
            </span>
          </div>
          <div className="icon-bubble" style={{ backgroundColor: '#ffffff', color: '#2563eb' }}>
            <BookOpen size={20} aria-hidden="true" />
          </div>
        </div>

        <div className="card-kpi card-kpi-green" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>
              Chiffre Brut Généré
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#15803d' }}>
              {totalRevenue.toFixed(2)} DTN
            </div>
            <span style={{ fontSize: '11px', color: '#16a34a' }}>
              Séances × Tarif horaire
            </span>
          </div>
          <div className="icon-bubble" style={{ backgroundColor: '#ffffff', color: '#16a34a' }}>
            <DollarSign size={20} aria-hidden="true" />
          </div>
        </div>

        <div className="card-kpi card-kpi-purple" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#5b21b6', fontWeight: 600 }}>
              Rémunération Enseignants
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#7c3aed' }}>
              {totalTeacherPayout.toFixed(2)} DTN
            </div>
            <span style={{ fontSize: '11px', color: '#8b5cf6' }}>
              Quote-part contractuelle cumulée
            </span>
          </div>
          <div className="icon-bubble" style={{ backgroundColor: '#ffffff', color: '#7c3aed' }}>
            <UserCheck size={20} aria-hidden="true" />
          </div>
        </div>

        <div className="card-kpi card-kpi-teal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#115e59', fontWeight: 600 }}>
              Total Payé par les Élèves
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#0f766e' }}>
              {totalPaid.toFixed(2)} DTN
            </div>
            <span style={{ fontSize: '11px', color: '#14b8a6' }}>
              Règlements encaissés
            </span>
          </div>
          <div className="icon-bubble" style={{ backgroundColor: '#ffffff', color: '#0d9488' }}>
            <CreditCard size={20} aria-hidden="true" />
          </div>
        </div>

        <div className="card-kpi card-kpi-rose" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#9f1239', fontWeight: 600 }}>
              Créances Élèves Restantes
            </span>
            <div
              id="kpi-total-student-debt"
              style={{
                fontSize: '24px',
                fontWeight: 800,
                marginTop: '4px',
                color: totalDebt > 0 ? '#e11d48' : '#059669'
              }}
            >
              {totalDebt.toFixed(2)} DTN
            </div>
            <span style={{ fontSize: '11px', color: totalDebt > 0 ? '#f43f5e' : '#10b981' }}>
              {totalDebt > 0 ? 'À recouvrer' : 'Tous les comptes soldés'}
            </span>
          </div>
          <div className="icon-bubble" style={{ backgroundColor: '#ffffff', color: totalDebt > 0 ? '#e11d48' : '#059669' }}>
            <AlertCircle size={20} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Reports by Teacher */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Chargement des données relationnelles...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <AlertCircle size={36} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-2)' }} />
          <p style={{ margin: 0, fontWeight: 500 }}>Aucun enseignant trouvé.</p>
        </div>
      ) : (
        reports.map((rep) => {
          // Filter students by search term and level
          const filteredStudents = rep.students.filter((s) => {
            const matchesSearch = s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || s.gradeLevel.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesLevel = filterLevel === 'All' || s.gradeLevel.includes(filterLevel)
            return matchesSearch && matchesLevel
          })

          // Hide teacher entirely if filtering results in 0 students (unless they have 0 students to begin with and no filters are active)
          const hasFiltersActive = searchTerm.trim() !== '' || filterLevel !== 'All';
          if (hasFiltersActive && filteredStudents.length === 0) {
            return null;
          }

          const currentPage = pageByTeacherId[rep.teacher.id] || 1
          const start = (currentPage - 1) * itemsPerPage
          const paginatedStudents = filteredStudents.slice(start, start + itemsPerPage)

          const theme = getSubjectTheme(rep.teacher.subject)

          return (
            <div
              key={rep.teacher.id}
              className="card"
              style={{
                padding: 0,
                overflow: 'hidden',
                borderLeft: `5px solid ${theme.color}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}
            >
              {/* Teacher Header Bar */}
              <div
                style={{
                  backgroundColor: theme.bg,
                  padding: 'var(--space-3) var(--space-4)',
                  borderBottom: `1px solid ${theme.border}`,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: theme.avatarGradient,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '15px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                    }}
                  >
                    {rep.teacher.name.charAt(0)}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                      {rep.teacher.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '12px', marginTop: '2px' }}>
                      <span className={theme.badgeClass}>{rep.teacher.subject}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>•</span>
                      <span
                        style={{
                          backgroundColor: '#ffffff',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          fontSize: '11px',
                          border: `1px solid ${theme.border}`,
                          color: theme.color
                        }}
                      >
                        {rep.teacher.payment_mode === 'per_student'
                          ? `Rémunération : ${rep.teacher.rate_per_student.toFixed(2)} DTN / élève`
                          : `Quote-part : ${(rep.teacher.monthly_rate_cut * 100).toFixed(0)}%`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', fontSize: '12px' }}>
                  {/* Payment Status Badge */}
                  <span
                    id={`badge-teacher-status-${rep.teacher.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor:
                        rep.teacherPaymentStatus === 'paid'
                          ? '#dcfce7'
                          : rep.teacherPaymentStatus === 'partial'
                          ? '#fef3c7'
                          : rep.teacherPaymentStatus === 'overpaid'
                          ? '#ede9fe'
                          : '#fee2e2',
                      color:
                        rep.teacherPaymentStatus === 'paid'
                          ? '#15803d'
                          : rep.teacherPaymentStatus === 'partial'
                          ? '#b45309'
                          : rep.teacherPaymentStatus === 'overpaid'
                          ? '#6d28d9'
                          : '#b91c1c',
                      border: `1px solid ${
                        rep.teacherPaymentStatus === 'paid'
                          ? '#86efac'
                          : rep.teacherPaymentStatus === 'partial'
                          ? '#fde68a'
                          : rep.teacherPaymentStatus === 'overpaid'
                          ? '#ddd6fe'
                          : '#fca5a5'
                      }`
                    }}
                  >
                    {rep.teacherPaymentStatus === 'paid'
                      ? `● Payé / Soldé (${rep.teacherTotalPaid.toFixed(2)} DTN)`
                      : rep.teacherPaymentStatus === 'partial'
                      ? `● Partiel (${rep.teacherTotalPaid.toFixed(2)} / ${rep.teacherPayoutCut.toFixed(2)} DTN)`
                      : rep.teacherPaymentStatus === 'overpaid'
                      ? `● Trop-perçu (+${Math.abs(rep.teacherRemainingBalance).toFixed(2)} DTN)`
                      : `● Non Payé (${rep.teacherPayoutCut.toFixed(2)} DTN dus)`}
                  </span>

                  <div style={{ backgroundColor: '#ffffff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Élèves : </span>
                    <strong style={{ color: '#0f172a' }}>{rep.studentsCount}</strong>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Séances : </span>
                    <strong style={{ color: '#2563eb' }}>{rep.totalSessionsStudied}</strong>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Part Prof : </span>
                    <strong style={{ color: '#16a34a' }}>{rep.teacherPayoutCut.toFixed(2)} DTN</strong>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Déjà Versé : </span>
                    <strong style={{ color: '#059669' }}>{rep.teacherTotalPaid.toFixed(2)} DTN</strong>
                  </div>
                  <div
                    style={{
                      backgroundColor:
                        rep.teacherRemainingBalance > 0.01
                          ? '#fffbeb'
                          : rep.teacherRemainingBalance < -0.01
                          ? '#f5f3ff'
                          : '#f0fdf4',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${
                        rep.teacherRemainingBalance > 0.01
                          ? '#fde68a'
                          : rep.teacherRemainingBalance < -0.01
                          ? '#ddd6fe'
                          : '#bbf7d0'
                      }`
                    }}
                  >
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {rep.teacherRemainingBalance > 0.01 ? 'Reste Dû : ' : rep.teacherRemainingBalance < -0.01 ? 'Avance : ' : 'Solde : '}
                    </span>
                    <strong
                      style={{
                        color:
                          rep.teacherRemainingBalance > 0.01
                            ? '#b45309'
                            : rep.teacherRemainingBalance < -0.01
                            ? '#7c3aed'
                            : '#059669'
                      }}
                    >
                      {rep.teacherRemainingBalance > 0.01
                        ? `+${rep.teacherRemainingBalance.toFixed(2)} DTN`
                        : rep.teacherRemainingBalance < -0.01
                        ? `-${Math.abs(rep.teacherRemainingBalance).toFixed(2)} DTN`
                        : '0.00 DTN'}
                    </strong>
                  </div>

                  {/* Action Buttons: Pay Teacher & Print Statement */}
                  <button
                    id={`btn-pay-teacher-${rep.teacher.id}`}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setPayoutTeacher({ teacher: rep.teacher, totalEarned: rep.teacherPayoutCut })}
                    style={{
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      borderColor: '#059669',
                      fontWeight: 700,
                      gap: '5px'
                    }}
                  >
                    <DollarSign size={14} />
                    <span>Payer / Régler</span>
                  </button>
                  <button
                    id={`btn-print-statement-${rep.teacher.id}`}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setInvoiceTeacher(rep.teacher)}
                    style={{ gap: '5px' }}
                    title="Imprimer le bordereau d'honoraires officiel avec décompte des versements"
                  >
                    <Printer size={14} />
                    <span>Bordereau</span>
                  </button>
                </div>
              </div>

              {/* Carryover Sub-strip */}
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor:
                    rep.teacherRemainingBalance > 0.01
                      ? 'rgba(245, 158, 11, 0.08)'
                      : rep.teacherRemainingBalance < -0.01
                      ? 'rgba(124, 58, 237, 0.08)'
                      : 'rgba(16, 185, 129, 0.08)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  color:
                    rep.teacherRemainingBalance > 0.01
                      ? '#b45309'
                      : rep.teacherRemainingBalance < -0.01
                      ? '#7c3aed'
                      : '#047857'
                }}
              >
                {rep.teacherRemainingBalance > 0.01 ? (
                  <>
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Moins-perçu constaté :</strong> Le centre doit encore <strong>+{rep.teacherRemainingBalance.toFixed(2)} DTN</strong> à l'enseignant. Ce montant <strong>s'ajoute automatiquement au prochain versement</strong>.
                    </span>
                  </>
                ) : rep.teacherRemainingBalance < -0.01 ? (
                  <>
                    <TrendingUp size={15} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Trop-perçu / Avance constatée :</strong> Le professeur a perçu <strong>+{Math.abs(rep.teacherRemainingBalance).toFixed(2)} DTN</strong> en excédent. Cette avance <strong>sera automatiquement déduite du prochain versement</strong>.
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Honoraires soldés :</strong> L'enseignant a perçu la totalité de sa part ({rep.teacherTotalPaid.toFixed(2)} DTN). Aucun reliquat reporté.
                    </span>
                  </>
                )}
              </div>

              {/* Students Table for this Teacher */}
              {rep.students.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <p style={{ margin: 0, fontStyle: 'italic' }}>No students currently enrolled.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <p style={{ margin: 0 }}>Aucun élève ne correspond à la recherche "{searchTerm}".</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', width: '40px' }}>#</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Nom Élève</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Niveau</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Contact Parent</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Tarif</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Séances Étudiées</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Coût Total</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Part Prof</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Payé</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Solde / Reste Dû</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Statut</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedStudents.map((st, idx) => {
                        const inDebt = st.debt > 0
                        return (
                          <tr
                            key={st.enrollmentId}
                            style={{
                              borderBottom: '1px solid var(--color-border-subtle)',
                              backgroundColor: idx % 2 === 0 ? 'var(--color-surface-raised)' : '#fafbfc'
                            }}
                          >
                            <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)' }}>
                              {start + idx + 1}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                              {st.studentName}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>
                              {st.gradeLevel}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                              {st.parentContact}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500 }}>
                              {st.hourlyRate.toFixed(2)} DTN{st.paymentType === 'hourly' ? '/h' : st.paymentType === 'session' ? '/séance' : '/mois'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 10px',
                                  borderRadius: '12px',
                                  backgroundColor: st.sessionsStudied > 0 ? '#e0e7ff' : 'var(--color-surface-muted)',
                                  color: st.sessionsStudied > 0 ? '#3730a3' : 'var(--color-text-muted)',
                                  fontWeight: 700,
                                  fontSize: '13px'
                                }}
                              >
                                {st.sessionsStudied} séance{st.sessionsStudied > 1 ? 's' : ''}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                              {st.totalSessionsCost.toFixed(2)} DTN
                            </td>
                            <td
                              style={{
                                padding: '10px 14px',
                                textAlign: 'right',
                                fontWeight: 600,
                                color: '#16a34a'
                              }}
                            >
                              {(st.teacherStudentPayout || 0).toFixed(2)} DTN
                            </td>
                            <td
                              style={{
                                padding: '10px 14px',
                                textAlign: 'right',
                                fontWeight: 600,
                                color: 'var(--color-semantic-paid)'
                              }}
                            >
                              {st.totalPaid.toFixed(2)} DTN
                            </td>
                            <td
                              style={{
                                padding: '10px 14px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: inDebt ? 'var(--color-semantic-debt)' : 'var(--color-semantic-paid)'
                              }}
                            >
                              {inDebt ? `+${st.debt.toFixed(2)} DTN` : '0.00 DTN'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: inDebt ? 'var(--color-semantic-debt-bg)' : 'var(--color-semantic-paid-bg)',
                                  color: inDebt ? 'var(--color-semantic-debt)' : 'var(--color-semantic-paid)',
                                  border: `1px solid ${inDebt ? '#fca5a5' : '#6ee7b7'}`
                                }}
                              >
                                {inDebt ? 'En dette' : 'Réglé'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                                onClick={() => handleOpenPayment(st)}
                              >
                                <CreditCard size={13} aria-hidden="true" />
                                Record Payment
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredStudents.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={(page) => setPageByTeacherId(prev => ({ ...prev, [rep.teacher.id]: page }))}
                  />
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Record Payment Modal */}
      {paymentModalOpen && activeStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-payment-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)'
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '440px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-4)'
              }}
            >
              <h3 id="modal-payment-title" style={{ margin: 0, fontSize: '16px' }}>
                Enregistrer un Règlement Élève
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px' }}
                onClick={() => setPaymentModalOpen(false)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-surface-muted)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
                fontSize: '13px'
              }}
            >
              <div>Élève : <strong>{activeStudent.studentName}</strong> ({activeStudent.gradeLevel})</div>
              <div>Enseignant : <strong>{activeStudent.teacherName}</strong> ({activeStudent.subject})</div>
              <div>Séances étudiées : <strong>{activeStudent.sessionsStudied}</strong> ({activeStudent.totalSessionsCost.toFixed(2)} DTN)</div>
              <div>Total déjà réglé : <strong>{activeStudent.totalPaid.toFixed(2)} DTN</strong></div>
              <div style={{ marginTop: '4px', fontWeight: 600, color: activeStudent.debt > 0 ? 'var(--color-semantic-debt)' : 'var(--color-semantic-paid)' }}>
                Reste dû actuel : {activeStudent.debt > 0 ? `+${activeStudent.debt.toFixed(2)} DTN` : 'Compte soldé'}
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label htmlFor="input-pay-amount" style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
                  Montant Reçu (DTN) *
                </label>
                <input
                  id="input-pay-amount"
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="input-pay-date" style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
                  Date d'Encaissement *
                </label>
                <input
                  id="input-pay-date"
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Annuler
                </button>
                <button
                  id="btn-confirm-payment"
                  type="submit"
                  className="btn btn-primary"
                >
                  <DollarSign size={15} aria-hidden="true" />
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Teacher Statement Modal */}
      {invoiceTeacher && (
        <InvoiceModal
          type="teacher"
          data={invoiceTeacher}
          onClose={() => setInvoiceTeacher(null)}
        />
      )}

      {/* Teacher Payout Modal */}
      {payoutTeacher && (
        <TeacherPayoutModal
          teacher={payoutTeacher.teacher}
          totalEarned={payoutTeacher.totalEarned}
          onClose={() => setPayoutTeacher(null)}
          onPayoutRecorded={() => {
            loadReports()
            showNotification('Règlement enseignant enregistré avec succès.')
          }}
        />
      )}
    </div>
  )
}
