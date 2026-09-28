import React, { useState, useEffect, useCallback } from 'react'
import { getMonthlyFinancialRollup } from '../db/sqlite'
import type { MonthlyFinancialSummary, Teacher } from '../types'
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  FileText,
  Download,
  Calendar,
  CheckCircle2,
  CreditCard
} from 'lucide-react'
import { TeacherPayoutModal } from './TeacherPayoutModal'
import { CompteRenduModal } from './CompteRenduModal'
import { Pagination } from './Pagination'

export const MonthlyRollup: React.FC = () => {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear())
  const [summary, setSummary] = useState<MonthlyFinancialSummary | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [reportGenerated, setReportGenerated] = useState<boolean>(false)
  const [compteRenduOpen, setCompteRenduOpen] = useState<boolean>(false)
  const [payoutTeacher, setPayoutTeacher] = useState<{ teacher: Teacher; totalEarned: number } | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Reset pagination when date changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, selectedYear])

  const paginatedTeachers = React.useMemo(() => {
    if (!summary) return []
    const start = (currentPage - 1) * itemsPerPage
    return summary.teachers.slice(start, start + itemsPerPage)
  }, [summary, currentPage])

  // Trigger new database query when month/year selector changes
  const fetchRollup = useCallback(async () => {
    setLoading(true)
    const data = await getMonthlyFinancialRollup(selectedYear, selectedMonth)
    setSummary(data)
    setLoading(false)
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    fetchRollup()
  }, [fetchRollup])

  const monthNames = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre'
  ]

  const handleGenerateReport = () => {
    setReportGenerated(true)
    setCompteRenduOpen(true)
  }

  const handleExportSummary = () => {
    if (!summary) return
    const csvRows = [
      ['Enseignant', 'Matiere', 'Part Enseignant (%)', 'Seances Effectuees', 'Chiffre d Affaires Brut (DTN)', 'Part Enseignant (DTN)', 'Part Centre (DTN)'].join(','),
      ...summary.teachers.map((t) =>
        [
          `"${t.teacherName}"`,
          `"${t.subject}"`,
          `${(t.monthlyRateCut * 100).toFixed(0)}%`,
          t.sessionsCount,
          t.totalSessionCosts.toFixed(2),
          t.teacherPayoutCut.toFixed(2),
          t.centerRetainedMargin.toFixed(2)
        ].join(',')
      ),
      ['TOTAL', '', '', '', summary.totalCenterRevenue.toFixed(2), summary.totalTeacherPayouts.toFixed(2), summary.totalCenterMargin.toFixed(2)].join(',')
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `recapitulatif_financier_${selectedMonth}_${selectedYear}.csv`
    link.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Hero Banner */}
      <div className="page-hero hero-blue fade-in">
        <div className="page-hero-content">
          <div className="page-hero-icon">
            <DollarSign size={26} color="white" />
          </div>
          <div>
            <h1 className="page-hero-title">Récapitulatif Financier Mensuel</h1>
            <p className="page-hero-subtitle">
              Chiffre d'affaires, rémunérations enseignants et soldes en temps réel
            </p>
          </div>
        </div>
        <div className="page-hero-actions">
          {/* Month/Year selectors */}
          <select
            id="select-rollup-month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '10px', padding: '8px 12px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', outline: 'none' }}
          >
            {monthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1} style={{ color: '#111' }}>{name}</option>
            ))}
          </select>
          <select
            id="select-rollup-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '10px', padding: '8px 12px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', outline: 'none' }}
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y} style={{ color: '#111' }}>{y}</option>
            ))}
          </select>
          <button id="btn-export-financial-summary" type="button" className="btn-hero-outline" onClick={handleExportSummary}>
            <Download size={15} /> Export CSV
          </button>
          <button id="btn-generate-monthly-report" type="button" className="btn-hero" onClick={handleGenerateReport}>
            <FileText size={15} /> Compte Rendu
          </button>
        </div>
      </div>

      {loading || !summary ? (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Recalcul des totaux en direct depuis la base relationnelle...
        </div>
      ) : (
        <>
          {/* KPI Dashboard Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 'var(--space-4)'
            }}
          >
            {/* Card 1: Chiffre d'Affaires Brut */}
            <div className="card-kpi card-kpi-blue" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Séances Dispensées
                </span>
                <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}>
                  <DollarSign size={18} aria-hidden="true" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                {summary.totalCenterRevenue.toFixed(2)} DTN
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Pour {monthNames[selectedMonth - 1]} {selectedYear}
              </span>
            </div>

            {/* Card 2: Part Totale Enseignants */}
            <div className="card-kpi card-kpi-purple" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Part Enseignants
                </span>
                <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff' }}>
                  <TrendingUp size={18} aria-hidden="true" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#6d28d9' }}>
                {summary.totalTeacherPayouts.toFixed(2)} DTN
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Quote-part totale reversée aux professeurs
              </span>
            </div>

            {/* Card 3: Marge Nette Centre */}
            <div className="card-kpi card-kpi-green" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Marge Retenue Centre
                </span>
                <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
                  <DollarSign size={18} aria-hidden="true" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#15803d' }}>
                {summary.totalCenterMargin.toFixed(2)} DTN
              </div>
              <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>
                Revenu net direct après déduction
              </span>
            </div>

            {/* Card 4: Count of fully paid vs in debt students */}
            <div className="card-kpi card-kpi-rose" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Règlements & Créances Élèves
                </span>
                <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff' }}>
                  <Users size={18} aria-hidden="true" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                <span
                  id="metric-students-paid"
                  className="badge-paid"
                  style={{ fontSize: '13px', padding: '3px 8px' }}
                >
                  ✓ {summary.studentsPaidCount} Réglés
                </span>
                <span
                  id="metric-students-debt"
                  className="badge-debt"
                  style={{ fontSize: '13px', padding: '3px 8px' }}
                >
                  ! {summary.studentsInDebtCount} En dette
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#be123c', fontWeight: 700 }}>
                Créances à recouvrer : {summary.totalOutstandingDebt.toFixed(2)} DTN
              </span>
            </div>

            {/* Card 5: Suivi Règlements Enseignants */}
            <div className="card-kpi card-kpi-teal" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Versements Enseignants
                </span>
                <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff' }}>
                  <CreditCard size={18} aria-hidden="true" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669' }}>
                  {summary.totalTeacherPaid.toFixed(2)} DTN
                </div>
              </div>
              <span style={{ fontSize: '12px', color: summary.totalTeacherRemainingDue > 0 ? '#b45309' : '#059669', fontWeight: 700 }}>
                {summary.totalTeacherRemainingDue > 0
                  ? `Reliquats restants dus : +${summary.totalTeacherRemainingDue.toFixed(2)} DTN`
                  : 'Tous les professeurs sont intégralement réglés'}
              </span>
            </div>
          </div>

          {/* Teacher Payouts Summary Table */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px' }}>Répartition & État des Paiements par Enseignant</h2>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                  Calcul dynamique selon la convention : <em>Au Pourcentage (%) ou Forfait par Élève (DTN)</em> avec suivi des acomptes et reports de soldes
                </p>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-surface-muted)',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border)'
                }}
              >
                Période : {monthNames[selectedMonth - 1]} {selectedYear}
              </span>
            </div>

            <div className="table-container">
              <table
                id="monthly-rollup-table"
                className="data-table"
                aria-label="Tableau récapitulatif financier par enseignant"
              >
                <thead>
                  <tr>
                    <th scope="col">Enseignant</th>
                    <th scope="col">Matière</th>
                    <th scope="col" style={{ textAlign: 'center' }}>Mode & Taux</th>
                    <th scope="col" style={{ textAlign: 'center' }}>Séances</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Chiffre Brut</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Part Enseignant</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Versé (DTN)</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Solde / Report</th>
                    <th scope="col" style={{ textAlign: 'center' }}>Statut Règlement</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Part Centre</th>
                    <th scope="col" style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTeachers.map((t) => {
                    const subLower = t.subject.toLowerCase()
                    let badgeClass = 'badge-subject-math'
                    if (subLower.includes('phys')) badgeClass = 'badge-subject-physics'
                    else if (subLower.includes('svt') || subLower.includes('bio')) badgeClass = 'badge-subject-svt'
                    else if (subLower.includes('fran')) badgeClass = 'badge-subject-french'
                    else if (subLower.includes('arab') || subLower.includes('phil')) badgeClass = 'badge-subject-arabic'
                    else if (subLower.includes('angl')) badgeClass = 'badge-subject-english'

                    return (
                      <tr key={t.teacherId}>
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700
                              }}
                            >
                              {t.teacherName.charAt(0)}
                            </div>
                            <span>{t.teacherName}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge-subject ${badgeClass}`}>
                            {t.subject}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {t.paymentMode === 'per_student' ? (
                            <span
                              style={{
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '12px',
                                fontWeight: 700
                              }}
                              title={`Tarif : ${t.ratePerStudent.toFixed(2)} DTN / élève (${t.activeStudentsCount} élève(s) actif(s))`}
                            >
                              {t.ratePerStudent.toFixed(0)} DTN/él ({t.activeStudentsCount})
                            </span>
                          ) : (
                            <span
                              style={{
                                backgroundColor: '#ede9fe',
                                color: '#6d28d9',
                                border: '1px solid #ddd6fe',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '12px',
                                fontWeight: 700
                              }}
                            >
                              {(t.monthlyRateCut * 100).toFixed(0)}%
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {t.sessionsCount} séance{t.sessionsCount > 1 ? 's' : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {t.totalSessionCosts.toFixed(2)} DTN
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#6d28d9'
                          }}
                        >
                          {t.teacherPayoutCut.toFixed(2)} DTN
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          {t.totalPaid.toFixed(2)} DTN
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color:
                              t.remainingBalance > 0.01
                                ? '#b45309'
                                : t.remainingBalance < -0.01
                                ? '#7c3aed'
                                : '#059669'
                          }}
                          title={
                            t.remainingBalance > 0.01
                              ? `Moins-perçu : +${t.remainingBalance.toFixed(2)} DTN dus (s'ajoute au prochain paiement)`
                              : t.remainingBalance < -0.01
                              ? `Avance : -${Math.abs(t.remainingBalance).toFixed(2)} DTN (se déduit au prochain paiement)`
                              : 'Compte entièrement soldé'
                          }
                        >
                          {t.remainingBalance > 0.01
                            ? `+${t.remainingBalance.toFixed(2)} DTN`
                            : t.remainingBalance < -0.01
                            ? `-${Math.abs(t.remainingBalance).toFixed(2)} DTN`
                            : '0.00 DTN'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor:
                                t.paymentStatus === 'paid'
                                  ? '#dcfce7'
                                  : t.paymentStatus === 'partial'
                                  ? '#fef3c7'
                                  : t.paymentStatus === 'overpaid'
                                  ? '#ede9fe'
                                  : '#fee2e2',
                              color:
                                t.paymentStatus === 'paid'
                                  ? '#15803d'
                                  : t.paymentStatus === 'partial'
                                  ? '#b45309'
                                  : t.paymentStatus === 'overpaid'
                                  ? '#6d28d9'
                                  : '#b91c1c',
                              border: `1px solid ${
                                t.paymentStatus === 'paid'
                                  ? '#86efac'
                                  : t.paymentStatus === 'partial'
                                  ? '#fde68a'
                                  : t.paymentStatus === 'overpaid'
                                  ? '#ddd6fe'
                                  : '#fca5a5'
                              }`
                            }}
                          >
                            {t.paymentStatus === 'paid'
                              ? '✓ Soldé'
                              : t.paymentStatus === 'partial'
                              ? '⏳ Partiel'
                              : t.paymentStatus === 'overpaid'
                              ? '★ Avance'
                              : '✕ Non payé'}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#15803d'
                          }}
                        >
                          {t.centerRetainedMargin.toFixed(2)} DTN
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() =>
                              setPayoutTeacher({
                                teacher: {
                                  id: t.teacherId,
                                  name: t.teacherName,
                                  subject: t.subject,
                                  monthly_rate_cut: t.monthlyRateCut,
                                  payment_mode: t.paymentMode,
                                  rate_per_student: t.ratePerStudent
                                },
                                totalEarned: t.teacherPayoutCut
                              })
                            }
                            style={{
                              backgroundColor: '#059669',
                              color: '#fff',
                              borderColor: '#059669',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                            title="Enregistrer un versement pour cet enseignant"
                          >
                            Payer
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                    <td colSpan={3} style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '13px' }}>
                      TOTAUX GLOBAUX DU MOIS
                    </td>
                    <td style={{ textAlign: 'center', padding: 'var(--space-3) var(--space-4)' }}>
                      {summary.teachers.reduce((acc, t) => acc + t.sessionsCount, 0)} séances
                    </td>
                    <td style={{ textAlign: 'right', padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-primary)' }}>
                      {summary.totalCenterRevenue.toFixed(2)} DTN
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: 'var(--space-3) var(--space-4)',
                        color: '#6d28d9',
                        fontWeight: 800
                      }}
                    >
                      {summary.totalTeacherPayouts.toFixed(2)} DTN
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: 'var(--space-3) var(--space-4)',
                        color: '#059669',
                        fontWeight: 800
                      }}
                    >
                      {summary.totalTeacherPaid.toFixed(2)} DTN
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: 'var(--space-3) var(--space-4)',
                        color: summary.totalTeacherRemainingDue > 0 ? '#b45309' : '#059669',
                        fontWeight: 800
                      }}
                    >
                      +{summary.totalTeacherRemainingDue.toFixed(2)} DTN
                    </td>
                    <td style={{ textAlign: 'center' }}>—</td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: 'var(--space-3) var(--space-4)',
                        color: '#15803d',
                        fontWeight: 800
                      }}
                    >
                      {summary.totalCenterMargin.toFixed(2)} DTN
                    </td>
                    <td style={{ textAlign: 'center' }}>—</td>
                  </tr>
                </tfoot>
              </table>
              <Pagination
                currentPage={currentPage}
                totalItems={summary.teachers.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>

          {/* Teacher Payout Modal */}
          {payoutTeacher && (
            <TeacherPayoutModal
              teacher={payoutTeacher.teacher}
              totalEarned={payoutTeacher.totalEarned}
              onClose={() => setPayoutTeacher(null)}
              onPayoutRecorded={() => {
                fetchRollup()
              }}
            />
          )}

          {/* Official Printable Compte Rendu Modal */}
          {compteRenduOpen && (
            <CompteRenduModal
              type="center"
              initialMonth={selectedMonth}
              initialYear={selectedYear}
              onClose={() => setCompteRenduOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}
