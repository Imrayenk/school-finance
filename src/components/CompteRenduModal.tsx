import React, { useState, useEffect, useMemo } from 'react'
import { getDatabase, getMonthlyFinancialRollup } from '../db/sqlite'
import type { Student, MonthlyFinancialSummary } from '../types'
import {
  Printer,
  X,
  ClipboardCheck,
  Edit3
} from 'lucide-react'
import { getAppSettings } from '../services/settingsService'

export interface CompteRenduModalProps {
  type: 'center' | 'student'
  initialMonth?: number
  initialYear?: number
  student?: Student | null
  onClose: () => void
}

interface StudentPedagogicalData {
  student: Student
  totalSessions: number
  totalHours: number
  attendanceRate: number
  subjects: {
    subject: string
    teacherName: string
    sessionsCount: number
    totalHours: number
    attendanceQuality: string
  }[]
}

export const CompteRenduModal: React.FC<CompteRenduModalProps> = ({
  type: initialType,
  initialMonth,
  initialYear,
  student,
  onClose
}) => {
  const currentDate = new Date()
  const [reportType, setReportType] = useState<'center' | 'student'>(initialType)
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth || currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(initialYear || currentDate.getFullYear())
  const [loading, setLoading] = useState<boolean>(true)

  // Center report data
  const [financialSummary, setFinancialSummary] = useState<MonthlyFinancialSummary | null>(null)
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0)
  const [totalTeachersCount, setTotalTeachersCount] = useState<number>(0)
  const [totalSessionsCount, setTotalSessionsCount] = useState<number>(0)
  const [totalAttendedCount, setTotalAttendedCount] = useState<number>(0)
  const [totalInstructionHours, setTotalInstructionHours] = useState<number>(0)
  const [debtorsList, setDebtorsList] = useState<{ name: string; grade: string; phone: string; debt: number }[]>([])
  const [centerNotes, setCenterNotes] = useState<string>(
    "L'activité du centre sur cette période témoigne d'une assiduité soutenue et d'un bon niveau d'engagement des apprenants. Les objectifs pédagogiques sont respectés sur l'ensemble des modules scientifiques et littéraires. Le recouvrement des créances et les déboursements des quotes-parts enseignants se poursuivent conformément aux conventions établies."
  )

  // Student report data
  const [studentData, setStudentData] = useState<StudentPedagogicalData | null>(null)
  const [studentEvaluation, setStudentEvaluation] = useState<{
    comprehension: string
    assiduite: string
    travailPersonnel: string
    recommandations: string
  }>({
    comprehension: 'Très bonne assimilation des concepts clés. Raisonnement rigoureux et méthodique lors des résolutions d’exercices.',
    assiduite: 'Assiduité exemplaire, ponctualité respectée et participation active et constructive lors de toutes les séances.',
    travailPersonnel: 'Travail personnel soigné et régulier. Bonne autonomie dans le traitement des séries d’exercices et sujets d’entraînement.',
    recommandations: 'Poursuivre sur cette excellente dynamique. Consolider la gestion du temps pour les épreuves de synthèse du Baccalauréat.'
  })

  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false)

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ]

  // Load data according to report type
  useEffect(() => {
    const loadReportData = async () => {
      setLoading(true)
      const db = await getDatabase()

      if (reportType === 'center') {
        // 1. Fetch monthly financial rollup
        const rollup = await getMonthlyFinancialRollup(selectedMonth, selectedYear)
        setFinancialSummary(rollup)

        // 2. Fetch total entities
        const sCountStmt = await window.desktopApp.dbQuery('SELECT COUNT(*) as count FROM Students;', [])
        if (sCountStmt.length > 0) setTotalStudentsCount(Number(sCountStmt[0].count || 0))
                const tCountStmt = await window.desktopApp.dbQuery('SELECT COUNT(*) as count FROM Teachers;', [])
        if (tCountStmt.length > 0) setTotalTeachersCount(Number(tCountStmt[0].count || 0))
                // 3. Fetch session stats for this month
        const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`
        const datePrefix = `${selectedYear}-${monthStr}`

        const sessStmt = await window.desktopApp.dbQuery(`
          SELECT 
            COUNT(s.id) as total_sessions,
            SUM(CASE WHEN s.status = 'attended' THEN 1 ELSE 0 END) as attended_sessions,
            COALESCE(SUM(CASE WHEN s.status = 'attended' THEN s.duration ELSE 0 END), 0) as total_hours
          FROM Sessions s
          WHERE s.date LIKE ?;
        `, [`${datePrefix}%`])
        if (sessStmt.length > 0) {
          const sObj = sessStmt[0]
          setTotalSessionsCount(Number(sObj.total_sessions || 0))
          setTotalAttendedCount(Number(sObj.attended_sessions || 0))
          setTotalInstructionHours(Number(sObj.total_hours || 0))
        }
                // 4. Fetch debtor students
        const debtorStmt = await window.desktopApp.dbQuery(`
          WITH StudentCosts AS (
            SELECT 
              e.student_id,
              CASE 
                WHEN e.payment_type = 'monthly' THEN e.hourly_rate * COUNT(DISTINCT substr(s.date, 1, 7))
                WHEN e.payment_type = 'session' THEN SUM(e.hourly_rate)
                ELSE SUM(s.duration * e.hourly_rate)
              END as cost
            FROM Enrollments e
            JOIN Sessions s ON e.id = s.enrollment_id
            WHERE s.status = 'attended'
            GROUP BY e.id, e.student_id
          ),
          AggCosts AS (
            SELECT student_id, SUM(cost) as total_cost FROM StudentCosts GROUP BY student_id
          )
          SELECT 
            st.id,
            st.name,
            st.grade_level,
            st.parent_contact,
            COALESCE(ac.total_cost, 0) - (
              SELECT COALESCE(SUM(p.amount), 0)
              FROM Payments p
              WHERE p.student_id = st.id
            ) as debt
          FROM Students st
          LEFT JOIN AggCosts ac ON st.id = ac.student_id
          ORDER BY debt DESC
          LIMIT 10;
        `, [])
        const debtors: { name: string; grade: string; phone: string; debt: number }[] = []
        for (const dObj of debtorStmt) {
          const dAmt = Number(dObj.debt || 0)
          if (dAmt > 0.01) {
            debtors.push({
              name: String(dObj.name),
              grade: String(dObj.grade_level),
              phone: String(dObj.parent_contact),
              debt: Number(dAmt.toFixed(2))
            })
          }
        }
                setDebtorsList(debtors)

      } else if (reportType === 'student' && student) {
        // Fetch sessions & subjects for this student
        const subjStmt = await window.desktopApp.dbQuery(`
          SELECT 
            t.subject,
            t.name as teacher_name,
            COUNT(s.id) as sessions_count,
            COALESCE(SUM(s.duration), 0) as total_hours
          FROM Sessions s
          JOIN Enrollments e ON s.enrollment_id = e.id
          JOIN Teachers t ON e.teacher_id = t.id
          WHERE e.student_id = ? AND s.status = 'attended'
          GROUP BY t.id, t.subject, t.name
          ORDER BY sessions_count DESC;
        `, [student.id])
        const subjects: StudentPedagogicalData['subjects'] = []
        let totalSess = 0
        let totalHrs = 0

        for (const sObj of subjStmt) {
          const sCount = Number(sObj.sessions_count || 0)
          const sHours = Number(sObj.total_hours || 0)
          totalSess += sCount
          totalHrs += sHours

          subjects.push({
            subject: String(sObj.subject),
            teacherName: String(sObj.teacher_name),
            sessionsCount: sCount,
            totalHours: sHours,
            attendanceQuality: sCount >= 4 ? 'Très Régulière (100%)' : 'Régulière'
          })
        }
                setStudentData({
          student,
          totalSessions: totalSess,
          totalHours: totalHrs,
          attendanceRate: 100,
          subjects
        })
      }

      setLoading(false)
    }

    loadReportData()
  }, [reportType, selectedMonth, selectedYear, student])

  const appSettings = getAppSettings()

  const handlePrint = () => {
    window.print()
  }

  const currentDateFormatted = new Date().toLocaleDateString('fr-TN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  // Group discipline metrics for center report
  const subjectAggregates = useMemo(() => {
    if (!financialSummary) return []
    const map = new Map<string, { subject: string; teachersCount: number; sessions: number; revenue: number; margin: number }>()

    for (const t of financialSummary.teachers) {
      const existing = map.get(t.subject) || {
        subject: t.subject,
        teachersCount: 0,
        sessions: 0,
        revenue: 0,
        margin: 0
      }
      existing.teachersCount += 1
      existing.sessions += t.sessionsCount
      existing.revenue += t.totalSessionCosts
      existing.margin += t.centerRetainedMargin
      map.set(t.subject, existing)
    }

    return Array.from(map.values())
  }, [financialSummary])

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compte-rendu-modal-title"
      onClick={onClose}
      style={{ overflowY: 'auto', padding: 'var(--space-4)' }}
    >
      <div
        className="modal-dialog printable-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '860px',
          width: '100%',
          margin: '20px auto',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          borderRadius: 'var(--radius-lg)',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {/* Modal Action Bar (Hidden during Print) */}
        <div
          className="modal-header-actions"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderBottom: '1px solid #334155'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardCheck size={20} color="#38bdf8" />
            <div>
              <span id="compte-rendu-modal-title" style={{ fontWeight: 700, fontSize: '15px' }}>
                {reportType === 'center'
                  ? "Compte Rendu d'Activité & Bilan de Gestion"
                  : 'Compte Rendu Pédagogique & Fiche de Suivi'}
              </span>
              <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>
                Document administratif & pédagogique officiel prêt pour impression A4 ou export PDF
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Period Selector if Center report */}
            {reportType === 'center' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                  title="Choisir le mois du compte rendu"
                >
                  {monthNames.map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                  title="Choisir l'année"
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggle Report Type if student exists */}
            {student && (
              <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${reportType === 'student' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={() => setReportType('student')}
                >
                  Élève
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${reportType === 'center' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={() => setReportType('center')}
                >
                  Centre Global
                </button>
              </div>
            )}

            {/* Edit Notes Button */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                backgroundColor: '#334155',
                borderColor: '#475569',
                color: '#f8fafc',
                gap: '4px',
                fontSize: '12px',
                padding: '6px 10px'
              }}
              onClick={() => setIsEditingNotes(!isEditingNotes)}
              title="Modifier les observations et appréciations"
            >
              <Edit3 size={13} />
              {isEditingNotes ? 'Terminer Note' : 'Éditer Note'}
            </button>

            {/* Print Action */}
            <button
              id="btn-print-compte-rendu"
              type="button"
              className="btn btn-primary"
              style={{
                backgroundColor: '#2563eb',
                borderColor: '#1d4ed8',
                color: '#ffffff',
                gap: '6px',
                fontWeight: 600,
                fontSize: '13px',
                padding: '6px 14px'
              }}
              onClick={handlePrint}
            >
              <Printer size={15} />
              Imprimer / Enregistrer PDF
            </button>

            {/* Close Button */}
            <button
              id="btn-close-compte-rendu"
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px'
              }}
              title="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Official Sheet */}
        <div
          className="printable-invoice-sheet"
          style={{
            padding: '24px 32px',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              Chargement du compte rendu...
            </div>
          ) : reportType === 'center' ? (
            /* =========================================================================
               1. COMPTE RENDU GLOBAL D'ACTIVITÉ & DE GESTION DU CENTRE
               ========================================================================= */
            <div>
              {/* Official Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '2px solid #0f172a',
                  paddingBottom: '16px',
                  marginBottom: '20px'
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', fontWeight: 700 }}>
                    RÉPUBLIQUE TUNISIENNE • ÉTABLISSEMENT DE SOUTIEN SCOLAIRE
                  </div>
                  <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '4px 0 2px 0' }}>
                    {appSettings.centerName || "Centre d'Excellence & Soutien Scolaire"}
                  </h1>
                  <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                    <span>{appSettings.centerAddress || `${appSettings.centerCity}, Tunisie`}</span> • <span>Tél : {appSettings.centerPhone || '+216 71 234 567'}</span>
                    <br />
                    <span>Email : {appSettings.centerEmail || 'contact@soutien-scolaire.tn'}</span>
                    {appSettings.centerMatricule && <span> • M.F : {appSettings.centerMatricule}</span>}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontWeight: 800,
                      fontSize: '11px',
                      letterSpacing: '0.5px'
                    }}
                  >
                    COMPTE RENDU OFFICIEL
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                    Réf : CR-ACT-{selectedYear}-{selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Période : <strong>{monthNames[selectedMonth - 1]} {selectedYear}</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Émis le : {currentDateFormatted}
                  </div>
                </div>
              </div>

              {/* Document Title Banner */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Compte Rendu d'Activité & Bilan de Gestion Mensuel
                  </h2>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Synthèse opérationnelle, suivi des présences, encaissements et déboursements enseignants
                  </span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                  Devise : DTN
                </div>
              </div>

              {/* 1. Synthèse Opérationnelle & Assiduité */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', marginBottom: '8px', borderLeft: '3px solid #2563eb', paddingLeft: '8px' }}>
                  1. Indicateurs Opérationnels & Assiduité
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block' }}>Élèves Inscrits</span>
                    <strong style={{ fontSize: '16px', color: '#0f172a' }}>{totalStudentsCount}</strong>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block' }}>Enseignants Actifs</span>
                    <strong style={{ fontSize: '16px', color: '#0f172a' }}>{totalTeachersCount}</strong>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block' }}>Séances Tenues</span>
                    <strong style={{ fontSize: '16px', color: '#16a34a' }}>{totalAttendedCount}</strong>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block' }}>Volume Horaire</span>
                    <strong style={{ fontSize: '16px', color: '#0f172a' }}>{totalInstructionHours.toFixed(1)} h</strong>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block' }}>Taux d'Assiduité</span>
                    <strong style={{ fontSize: '16px', color: '#2563eb' }}>
                      {totalSessionsCount > 0 ? Math.round((totalAttendedCount / totalSessionsCount) * 100) : 100}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* 2. Arrêté Financier & Recouvrement */}
              {financialSummary && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', marginBottom: '8px', borderLeft: '3px solid #10b981', paddingLeft: '8px' }}>
                    2. Arrêté Financier & Clôture de Caisse (DTN)
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #cbd5e1' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#334155' }}>Chiffre d'Affaires Brut Généré (Prestations Valorisation Séances)</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>
                          {financialSummary.totalCenterRevenue.toFixed(2)} DTN
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#334155' }}>Part Contractuelle Totale Due aux Enseignants</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>
                          {financialSummary.totalTeacherPayouts.toFixed(2)} DTN
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#334155' }}>Total Déjà Déboursé & Versé aux Enseignants</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          {financialSummary.totalTeacherPaid.toFixed(2)} DTN
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#334155' }}>
                          Reliquat Restant Dû aux Enseignants (À reporter sur le prochain règlement)
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: financialSummary.totalTeacherRemainingDue > 0 ? '#ea580c' : '#16a34a' }}>
                          {financialSummary.totalTeacherRemainingDue > 0 ? `+${financialSummary.totalTeacherRemainingDue.toFixed(2)} DTN` : '0.00 DTN'}
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 800, fontSize: '12px', color: '#0f172a' }}>
                          Marge Nette d'Exploitation Conservée par le Centre
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: '13px', color: '#047857' }}>
                          {financialSummary.totalCenterMargin.toFixed(2)} DTN
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. Répartition par Matière / Discipline */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', marginBottom: '8px', borderLeft: '3px solid #f59e0b', paddingLeft: '8px' }}>
                  3. Bilan d'Activité par Discipline Pédagogique
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #cbd5e1' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px', fontWeight: 700 }}>Matière</th>
                      <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'center' }}>Profs</th>
                      <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'center' }}>Séances</th>
                      <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'right' }}>Chiffre Brut (DTN)</th>
                      <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'right' }}>Marge Centre (DTN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectAggregates.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0f172a' }}>{s.subject}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#475569' }}>{s.teachersCount}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#475569' }}>{s.sessions}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{s.revenue.toFixed(2)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>{s.margin.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 4. Situation des Règlements Enseignants */}
              {financialSummary && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', marginBottom: '8px', borderLeft: '3px solid #8b5cf6', paddingLeft: '8px' }}>
                    4. État des Règlements & Honoraires des Enseignants
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px', fontWeight: 700 }}>Enseignant</th>
                        <th style={{ padding: '6px 8px', fontWeight: 700 }}>Matière & Convention</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>Séances</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Généré (DTN)</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Versé (DTN)</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Solde / Report</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialSummary.teachers.map((t, idx) => {
                        let statusLabel = 'Soldé'
                        let statusColor = '#16a34a'
                        if (t.paymentStatus === 'unpaid') {
                          statusLabel = 'Non Payé'
                          statusColor = '#dc2626'
                        } else if (t.paymentStatus === 'partial') {
                          statusLabel = 'Partiel'
                          statusColor = '#ea580c'
                        } else if (t.paymentStatus === 'overpaid') {
                          statusLabel = 'Avance'
                          statusColor = '#2563eb'
                        }

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '5px 8px', fontWeight: 600, color: '#0f172a' }}>{t.teacherName}</td>
                            <td style={{ padding: '5px 8px', color: '#475569' }}>
                              {t.subject} (
                              {t.paymentMode === 'per_student'
                                ? `${t.ratePerStudent?.toFixed(0)} DTN/él`
                                : `${(t.monthlyRateCut * 100).toFixed(0)}%`}
                              )
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', color: '#475569' }}>{t.sessionsCount}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{t.teacherPayoutCut.toFixed(2)}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{t.totalPaid.toFixed(2)}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: t.remainingBalance > 0.01 ? '#ea580c' : t.remainingBalance < -0.01 ? '#2563eb' : '#16a34a' }}>
                              {t.remainingBalance > 0.01
                                ? `+${t.remainingBalance.toFixed(2)}`
                                : t.remainingBalance < -0.01
                                ? `${t.remainingBalance.toFixed(2)}`
                                : '0.00'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                              <span style={{ color: statusColor, fontWeight: 700, fontSize: '10px' }}>
                                ● {statusLabel}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. Suivi des Créances Élèves Prioritaires */}
              {debtorsList.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', marginBottom: '8px', borderLeft: '3px solid #ef4444', paddingLeft: '8px' }}>
                    5. Suivi des Principales Créances Élèves à Recouvrer
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '5px 8px', fontWeight: 700 }}>Nom de l'Élève</th>
                        <th style={{ padding: '5px 8px', fontWeight: 700 }}>Niveau Scolaire</th>
                        <th style={{ padding: '5px 8px', fontWeight: 700 }}>Contact Parent (+216)</th>
                        <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>Reste Dû (DTN)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debtorsList.map((d, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '5px 8px', fontWeight: 600, color: '#0f172a' }}>{d.name}</td>
                          <td style={{ padding: '5px 8px', color: '#475569' }}>{d.grade}</td>
                          <td style={{ padding: '5px 8px', color: '#475569' }}>{d.phone}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                            {d.debt.toFixed(2)} DTN
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6. Observations & Avis de la Direction */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', marginBottom: '6px' }}>
                  6. Observations Générales & Bilan d'Évaluation
                </h3>
                {isEditingNotes ? (
                  <textarea
                    value={centerNotes}
                    onChange={(e) => setCenterNotes(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '8px',
                      fontSize: '11px',
                      fontFamily: 'inherit',
                      borderRadius: '4px',
                      border: '1px solid #94a3b8'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '10px',
                      fontSize: '11px',
                      color: '#334155',
                      lineHeight: 1.5,
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    {centerNotes}
                  </div>
                )}
              </div>

              {/* Signatures & Visas */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '14px',
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid #cbd5e1'
                }}
              >
                <div style={{ border: '1px dashed #94a3b8', borderRadius: '4px', padding: '10px', minHeight: '90px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Responsable Pédagogique
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>Visa & Date :</div>
                </div>

                <div style={{ border: '1px dashed #94a3b8', borderRadius: '4px', padding: '10px', minHeight: '90px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Responsable Financier
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>Arrêté des comptes :</div>
                </div>

                <div style={{ border: '1px dashed #94a3b8', borderRadius: '4px', padding: '10px', minHeight: '90px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                    Direction Générale
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Cachet & Signature Officielle</div>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================================
               2. COMPTE RENDU PÉDAGOGIQUE & BULLETIN DE SUIVI INDIVIDUEL DE L'ÉLÈVE
               ========================================================================= */
            studentData && (
              <div>
                {/* Official Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    borderBottom: '2px solid #0f172a',
                    paddingBottom: '16px',
                    marginBottom: '18px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', fontWeight: 700 }}>
                      RÉPUBLIQUE TUNISIENNE • ÉTABLISSEMENT DE SOUTIEN SCOLAIRE
                    </div>
                    <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '4px 0 2px 0' }}>
                      {appSettings.centerName || "Centre d'Excellence & Soutien Scolaire"}
                    </h1>
                    <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                      <span>{appSettings.centerAddress || `${appSettings.centerCity}, Tunisie`}</span> • <span>Tél : {appSettings.centerPhone || '+216 71 234 567'}</span>
                      <br />
                      <span>Email : {appSettings.centerEmail || 'contact@soutien-scolaire.tn'}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        backgroundColor: '#1e40af',
                        color: '#ffffff',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontWeight: 800,
                        fontSize: '11px',
                        letterSpacing: '0.5px'
                      }}
                    >
                      BULLETIN PÉDAGOGIQUE
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                      Réf : CR-PEDAG-2026-00{studentData.student.id}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Date d'évaluation : {currentDateFormatted}
                    </div>
                  </div>
                </div>

                {/* Document Banner */}
                <div
                  style={{
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    marginBottom: '18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Compte Rendu Pédagogique & Fiche de Suivi Individuel
                    </h2>
                    <span style={{ fontSize: '11px', color: '#3b82f6' }}>
                      Bilan d'assiduité, évaluation des apprentissages et recommandations pour la réussite
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', backgroundColor: '#dbeafe', padding: '3px 8px', borderRadius: '4px' }}>
                    Session 2025 - 2026
                  </div>
                </div>

                {/* Student Identity Box */}
                <div
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '12px 16px',
                    marginBottom: '18px',
                    backgroundColor: '#f8fafc',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Nom & Prénom de l'Élève</span>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{studentData.student.name}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Niveau & Section</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1' }}>{studentData.student.grade_level}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Contact Parent / Tuteur (+216)</span>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{studentData.student.parent_contact}</div>
                  </div>
                </div>

                {/* 1. Assiduité & Volume Horaire */}
                <div style={{ marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', marginBottom: '8px', borderLeft: '3px solid #3b82f6', paddingLeft: '8px' }}>
                    1. Bilan d'Assiduité & Fréquentation
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block' }}>Séances Suivies (Présent)</span>
                      <strong style={{ fontSize: '18px', color: '#16a34a' }}>{studentData.totalSessions}</strong>
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block' }}>Volume Total de Cours</span>
                      <strong style={{ fontSize: '18px', color: '#0f172a' }}>{studentData.totalHours.toFixed(1)} h</strong>
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block' }}>Taux d'Assiduité Globale</span>
                      <strong style={{ fontSize: '18px', color: '#2563eb' }}>{studentData.attendanceRate}%</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Tableau des Disciplines Suivies */}
                <div style={{ marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', marginBottom: '8px', borderLeft: '3px solid #10b981', paddingLeft: '8px' }}>
                    2. Enseignements & Disciplines Suivis
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '6px 10px', fontWeight: 700 }}>Matière</th>
                        <th style={{ padding: '6px 10px', fontWeight: 700 }}>Professeur Référent</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Séances</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Heures</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Régularité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentData.subjects.map((s, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0f172a' }}>{s.subject}</td>
                          <td style={{ padding: '6px 10px', color: '#475569' }}>{s.teacherName}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: '#475569' }}>{s.sessionsCount}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: '#475569' }}>{s.totalHours.toFixed(1)} h</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>
                            {s.attendanceQuality}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 3. Évaluation & Appréciations Pédagogiques */}
                <div style={{ marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', marginBottom: '8px', borderLeft: '3px solid #8b5cf6', paddingLeft: '8px' }}>
                    3. Appréciations Pédagogiques & Observations Qualitatives
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                    {/* Item 1 */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 12px', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '2px' }}>
                        • Compréhension des notions & Méthodologie :
                      </span>
                      {isEditingNotes ? (
                        <input
                          type="text"
                          className="input-field"
                          value={studentEvaluation.comprehension}
                          onChange={(e) => setStudentEvaluation({ ...studentEvaluation, comprehension: e.target.value })}
                          style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                        />
                      ) : (
                        <p style={{ margin: 0, color: '#475569' }}>{studentEvaluation.comprehension}</p>
                      )}
                    </div>

                    {/* Item 2 */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 12px', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '2px' }}>
                        • Assiduité, Concentration & Participation en Groupe :
                      </span>
                      {isEditingNotes ? (
                        <input
                          type="text"
                          className="input-field"
                          value={studentEvaluation.assiduite}
                          onChange={(e) => setStudentEvaluation({ ...studentEvaluation, assiduite: e.target.value })}
                          style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                        />
                      ) : (
                        <p style={{ margin: 0, color: '#475569' }}>{studentEvaluation.assiduite}</p>
                      )}
                    </div>

                    {/* Item 3 */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 12px', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '2px' }}>
                        • Régularité du Travail Personnel & Révision :
                      </span>
                      {isEditingNotes ? (
                        <input
                          type="text"
                          className="input-field"
                          value={studentEvaluation.travailPersonnel}
                          onChange={(e) => setStudentEvaluation({ ...studentEvaluation, travailPersonnel: e.target.value })}
                          style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                        />
                      ) : (
                        <p style={{ margin: 0, color: '#475569' }}>{studentEvaluation.travailPersonnel}</p>
                      )}
                    </div>

                    {/* Item 4 */}
                    <div style={{ border: '1px solid #bfdbfe', borderRadius: '4px', padding: '8px 12px', backgroundColor: '#eff6ff' }}>
                      <span style={{ fontWeight: 700, color: '#1e40af', display: 'block', marginBottom: '2px' }}>
                        • Recommandations pour le Baccalauréat & Examens :
                      </span>
                      {isEditingNotes ? (
                        <input
                          type="text"
                          className="input-field"
                          value={studentEvaluation.recommandations}
                          onChange={(e) => setStudentEvaluation({ ...studentEvaluation, recommandations: e.target.value })}
                          style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                        />
                      ) : (
                        <p style={{ margin: 0, color: '#1e3a8a', fontWeight: 500 }}>{studentEvaluation.recommandations}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Signatures & Visas */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '14px',
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: '1px solid #cbd5e1'
                  }}
                >
                  <div style={{ border: '1px dashed #94a3b8', borderRadius: '4px', padding: '10px', minHeight: '90px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      L'Équipe Enseignante
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>Visa & Date :</div>
                  </div>

                  <div style={{ border: '1px dashed #94a3b8', borderRadius: '4px', padding: '10px', minHeight: '90px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                      Visa de la Direction
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Cachet Officiel du Centre</div>
                  </div>

                  <div style={{ border: '1px dashed #94a3b8', borderRadius: '4px', padding: '10px', minHeight: '90px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      Accusé des Parents
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>Signature & Date :</div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
