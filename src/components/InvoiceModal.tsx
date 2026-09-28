import React, { useState, useEffect } from 'react'
import { getDatabase } from '../db/sqlite'
import type { Student, Teacher, Payment, TeacherPayout } from '../types'
import { Printer, X, CheckCircle2, AlertCircle, Building2, Calendar, Phone, GraduationCap, User, FileText, CreditCard, AlertTriangle, TrendingUp } from 'lucide-react'
import { getAppSettings } from '../services/settingsService'

interface StudentInvoiceData {
  student: Student
  sessions: {
    id: string
    date: string
    duration: number
    subject: string
    teacherName: string
    hourlyRate: number
    cost: number
  }[]
  payments: Payment[]
  totalCost: number
  totalPaid: number
  debt: number
}

interface TeacherStatementData {
  teacher: Teacher
  studentsRows: {
    studentId: string
    studentName: string
    gradeLevel: string
    sessionsCount: number
    totalHours: number
    hourlyRate: number
    grossAmount: number
  }[]
  totalAttendedSessions: number
  totalHours: number
  grossRevenue: number
  teacherPayout: number
  centerMargin: number
  payouts: TeacherPayout[]
  totalPaid: number
  remainingBalance: number
}

interface InvoiceModalProps {
  type: 'student' | 'teacher'
  data: Student | Teacher | null
  onClose: () => void
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ type, data, onClose }) => {
  const [studentData, setStudentData] = useState<StudentInvoiceData | null>(null)
  const [teacherData, setTeacherData] = useState<TeacherStatementData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!data) return

    const loadData = async () => {
      setLoading(true)
      const db = await getDatabase()

      if (type === 'student') {
        const student = data as Student

        // 1. Fetch sessions attended by this student
        const sessStmt = await window.desktopApp.dbQuery(`
          WITH MonthlySessions AS (
            SELECT 
              s.id, s.date, s.duration, t.subject, t.name as teacher_name, e.hourly_rate, e.payment_type, e.id as enrollment_id,
              COUNT(s.id) OVER (PARTITION BY e.id, substr(s.date, 1, 7)) as month_sessions
            FROM Sessions s
            JOIN Enrollments e ON s.enrollment_id = e.id
            JOIN Teachers t ON e.teacher_id = t.id
            WHERE e.student_id = ? AND s.status = 'attended'
          )
          SELECT *, 
            CASE 
              WHEN payment_type = 'monthly' THEN hourly_rate / month_sessions
              WHEN payment_type = 'session' THEN hourly_rate
              ELSE duration * hourly_rate
            END as computed_cost
          FROM MonthlySessions
          ORDER BY date ASC;
        `, [student.id])
        const sessionRows: StudentInvoiceData['sessions'] = []
        let costSum = 0

        for (const row of sessStmt) {
          const dur = Number(row.duration || 1)
          const rate = Number(row.hourly_rate || 0)
          const cost = Number(row.computed_cost || 0)
          costSum += cost

          sessionRows.push({
            id: String(row.id),
            date: String(row.date),
            duration: dur,
            subject: String(row.subject),
            teacherName: String(row.teacher_name),
            hourlyRate: rate,
            cost
          })
        }
                // 2. Fetch payments made by this student
        const payStmt = await window.desktopApp.dbQuery(`
          SELECT id, student_id, amount, date
          FROM Payments
          WHERE student_id = ?
          ORDER BY date ASC;
        `, [student.id])
        const paymentRows: Payment[] = []
        let paidSum = 0

        for (const row of payStmt) {
          const amt = Number(row.amount || 0)
          paidSum += amt
          paymentRows.push({
            id: String(row.id),
            student_id: String(row.student_id),
            amount: amt,
            date: String(row.date)
          })
        }
                const debt = Number((costSum - paidSum).toFixed(2))

        setStudentData({
          student,
          sessions: sessionRows,
          payments: paymentRows,
          totalCost: costSum,
          totalPaid: paidSum,
          debt
        })
      } else {
        const teacher = data as Teacher

        // Fetch students & sessions breakdown for this teacher
        const enrStmt = await window.desktopApp.dbQuery(`
          SELECT e.id as enrollment_id, s.id as student_id, s.name as student_name, s.grade_level, e.hourly_rate, e.payment_type
          FROM Enrollments e
          JOIN Students s ON e.student_id = s.id
          WHERE e.teacher_id = ?
          ORDER BY s.name ASC;
        `, [teacher.id])
        const rows: TeacherStatementData['studentsRows'] = []
        let grossSum = 0
        let totalSessSum = 0
        let totalHoursSum = 0

        for (const enr of enrStmt) {
          const enrId = String(enr.enrollment_id)
          const rate = Number(enr.hourly_rate || 0)
          const pType = String(enr.payment_type || 'hourly')

          // Count attended sessions and compute exact gross for this enrollment
          const countStmt = await window.desktopApp.dbQuery(`
            WITH SessMonths AS (
              SELECT 
                duration,
                COUNT(id) OVER (PARTITION BY substr(date, 1, 7)) as month_sessions
              FROM Sessions
              WHERE enrollment_id = ? AND status = 'attended'
            )
            SELECT 
              COUNT(*) as c, 
              COALESCE(SUM(duration), 0) as h,
              COALESCE(SUM(
                CASE 
                  WHEN ? = 'monthly' THEN ? / month_sessions
                  WHEN ? = 'session' THEN ?
                  ELSE duration * ?
                END
              ), 0) as computed_gross
            FROM SessMonths;
          `, [enrId, pType, rate, pType, rate, rate])
          let c = 0
          let h = 0
          let gross = 0
          if (countStmt.length > 0) {
            const res = countStmt[0]
            c = Number(res.c || 0)
            h = Number(res.h || 0)
            gross = Number(res.computed_gross || 0)
          }
                    grossSum += gross
          totalSessSum += c
          totalHoursSum += h

          rows.push({
            studentId: String(enr.student_id),
            studentName: String(enr.student_name),
            gradeLevel: String(enr.grade_level),
            sessionsCount: c,
            totalHours: h,
            hourlyRate: rate,
            grossAmount: gross
          })
        }
                let teacherPayout = 0
        if (teacher.payment_mode === 'per_student') {
          const activeStudents = rows.filter((r) => r.sessionsCount > 0).length
          const count = activeStudents > 0 ? activeStudents : rows.length
          teacherPayout = count * (teacher.rate_per_student !== undefined ? teacher.rate_per_student : 50.0)
        } else {
          teacherPayout = grossSum * teacher.monthly_rate_cut
        }
        const centerMargin = grossSum - teacherPayout

        // Fetch payouts made to this teacher
        const payStmt = await window.desktopApp.dbQuery(`
          SELECT id, teacher_id, amount, date, period_month, payment_method, notes
          FROM TeacherPayouts
          WHERE teacher_id = ?
          ORDER BY date ASC;
        `, [teacher.id])
        const payoutsList: TeacherPayout[] = []
        let totalPaid = 0
        for (const pRow of payStmt) {
          const amt = Number(pRow.amount || 0)
          totalPaid += amt
          payoutsList.push({
            id: String(pRow.id),
            teacher_id: String(pRow.teacher_id),
            amount: amt,
            date: String(pRow.date),
            period_month: pRow.period_month ? String(pRow.period_month) : undefined,
            payment_method: String(pRow.payment_method || 'Espèces'),
            notes: pRow.notes ? String(pRow.notes) : undefined
          })
        }
                totalPaid = Number(totalPaid.toFixed(2))
        const remainingBalance = Number((teacherPayout - totalPaid).toFixed(2))

        setTeacherData({
          teacher,
          studentsRows: rows,
          totalAttendedSessions: totalSessSum,
          totalHours: totalHoursSum,
          grossRevenue: grossSum,
          teacherPayout,
          centerMargin,
          payouts: payoutsList,
          totalPaid,
          remainingBalance
        })
      }

      setLoading(false)
    }

    loadData()
  }, [type, data])

  if (!data) return null

  const handlePrint = () => {
    window.print()
  }

  const appSettings = getAppSettings()

  const currentDate = new Date().toLocaleDateString('fr-TN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
      onClick={onClose}
      style={{ overflowY: 'auto', padding: 'var(--space-4)' }}
    >
      <div
        className="modal-dialog printable-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '780px',
          width: '100%',
          margin: '20px auto',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          borderRadius: 'var(--radius-lg)',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* Modal Action Bar (Hidden during Print) */}
        <div
          className="modal-header-actions"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            backgroundColor: '#1e293b',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#38bdf8" />
            <span id="invoice-modal-title" style={{ fontWeight: 700, fontSize: '15px' }}>
              {type === 'student' ? 'Facture & Relevé Financier Élève' : "Bordereau d'Honoraires Enseignant"}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              id="btn-trigger-print"
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePrint}
              style={{
                backgroundColor: '#059669',
                borderColor: '#059669',
                color: '#ffffff',
                gap: '6px',
                fontWeight: 600
              }}
            >
              <Printer size={15} aria-hidden="true" />
              Imprimer / Enregistrer PDF
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (A4 Styled) */}
        <div className="printable-invoice-sheet" style={{ padding: '35px 40px', color: '#0f172a', fontFamily: 'Inter, sans-serif', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Génération du document en cours...
            </div>
          ) : type === 'student' && studentData ? (
            /* ========================================================================= */
            /* STUDENT INVOICE TEMPLATE                                                  */
            /* ========================================================================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0284c7', paddingBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '15px'
                      }}
                    >
                      SC
                    </div>
                    <div>
                      <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#0f172a', textTransform: 'uppercase' }}>
                        {appSettings.centerName}
                      </h1>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                        Encadrement & Soutien Pédagogique d'Excellence
                      </p>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '8px', lineHeight: 1.4 }}>
                    <span>Tél : {appSettings.centerPhone}</span>
                    {appSettings.centerEmail && <span> • Email : {appSettings.centerEmail}</span>}
                    <br />
                    <span>Adresse : {appSettings.centerAddress}, {appSettings.centerCity}</span>
                    {appSettings.centerMatricule && <span> • MF : {appSettings.centerMatricule}</span>}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#f0f9ff',
                      color: '#0369a1',
                      border: '1px solid #bae6fd',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontWeight: 800,
                      fontSize: '14px',
                      marginBottom: '6px'
                    }}
                  >
                    FACTURE N° FACT-{new Date().getFullYear()}-{studentData.student.id.padStart(4, '0')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Date d'émission : <strong>{currentDate}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Devise : <strong>Dinar Tunisien (DTN)</strong>
                  </div>
                </div>
              </div>

              {/* Student Details Card */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  fontSize: '13px'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Facturé à l'Élève
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    {studentData.student.name}
                  </div>
                  <div style={{ color: '#475569', marginTop: '2px' }}>
                    Niveau : <strong>{studentData.student.grade_level}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Contact Parent / Tuteur
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    {studentData.student.parent_contact}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                    Identifiant élève : #{studentData.student.id}
                  </div>
                </div>
              </div>

              {/* Table of Attended Sessions */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 8px 0', color: '#1e293b' }}>
                  1. Détail des Prestations Pédagogiques Suivies
                </h3>
                {studentData.sessions.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#64748b' }}>
                    Aucune séance validée à ce jour.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Matière</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Enseignant Référent</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Durée</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tarif Horaire</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Ligne</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentData.sessions.map((s, idx) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '7px 10px', fontWeight: 600 }}>{s.date}</td>
                          <td style={{ padding: '7px 10px' }}>{s.subject}</td>
                          <td style={{ padding: '7px 10px', color: '#475569' }}>{s.teacherName}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center' }}>{s.duration} h</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right' }}>{s.hourlyRate.toFixed(2)} DTN</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{s.cost.toFixed(2)} DTN</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Table of Payments Logged */}
              {studentData.payments.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 8px 0', color: '#1e293b' }}>
                    2. Historique des Versements Reçus
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f0fdf4', borderBottom: '2px solid #86efac' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Date Règlement</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>N° Reçu Paiement</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Montant Encaissé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentData.payments.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 10px' }}>{p.date}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#64748b' }}>{p.id}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                            +{p.amount.toFixed(2)} DTN
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Financial Recap Box */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <div style={{ width: '280px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0' }}>
                    <span>Total Séances :</span>
                    <strong style={{ color: '#0f172a' }}>{studentData.totalCost.toFixed(2)} DTN</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <span>Total Acomptes Versés :</span>
                    <strong style={{ color: '#15803d' }}>- {studentData.totalPaid.toFixed(2)} DTN</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '8px', fontWeight: 800 }}>
                    <span>Solde Net Restant Dû :</span>
                    <span style={{ color: studentData.debt > 0 ? '#be123c' : '#15803d' }}>
                      {studentData.debt.toFixed(2)} DTN
                    </span>
                  </div>
                </div>
              </div>

              {/* Stamp & Signature area */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '340px' }}>
                  <p style={{ margin: 0, fontStyle: 'italic' }}>
                    {appSettings.invoiceNotes || "Document officiel généré par le système informatique du Centre de Soutien Scolaire."}
                    <br />
                    Pour tout renseignement sur ce relevé, contacter le secrétariat au {appSettings.centerPhone}.
                  </p>
                </div>

                <div style={{ textAlign: 'center', minWidth: '180px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '40px' }}>
                    Cachet & Signature de l'Administration
                  </div>
                  <div style={{ borderBottom: '1px solid #94a3b8', width: '160px', margin: '0 auto' }} />
                </div>
              </div>
            </div>
          ) : type === 'teacher' && teacherData ? (
            /* ========================================================================= */
            /* TEACHER STATEMENT TEMPLATE                                                */
            /* ========================================================================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #7c3aed', paddingBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '15px'
                      }}
                    >
                      SC
                    </div>
                    <div>
                      <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#0f172a', textTransform: 'uppercase' }}>
                        {appSettings.centerName}
                      </h1>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                        Bordereau Pédagogique & Décompte d'Honoraires
                      </p>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '8px', lineHeight: 1.4 }}>
                    <span>{appSettings.centerAddress}, {appSettings.centerCity} • Tél : {appSettings.centerPhone}</span>
                    <br />
                    <span>Devise de Règlement : Dinar Tunisien (DTN)</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#f5f3ff',
                      color: '#6d28d9',
                      border: '1px solid #ddd6fe',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontWeight: 800,
                      fontSize: '14px',
                      marginBottom: '6px'
                    }}
                  >
                    BORDEREAU N° BORD-{new Date().getFullYear()}-{teacherData.teacher.id.padStart(4, '0')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Date d'émission : <strong>{currentDate}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {teacherData.teacher.payment_mode === 'per_student' ? (
                      <span>Mode de Rémunération : <strong>Par Élève ({teacherData.teacher.rate_per_student.toFixed(2)} DTN / élève)</strong></span>
                    ) : (
                      <span>Quote-part contractuelle : <strong>{(teacherData.teacher.monthly_rate_cut * 100).toFixed(0)}%</strong></span>
                    )}
                  </div>
                </div>
              </div>

              {/* Teacher Details Card */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  fontSize: '13px'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Professeur Bénéficiaire
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    {teacherData.teacher.name}
                  </div>
                  <div style={{ color: '#475569', marginTop: '2px' }}>
                    Matière : <strong>{teacherData.teacher.subject}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Volume Réalisé
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    {teacherData.totalAttendedSessions} séance(s) validée(s) ({teacherData.totalHours} heures)
                  </div>
                  <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                    Identifiant Enseignant : #{teacherData.teacher.id}
                  </div>
                </div>
              </div>

              {/* Table of Students Taught */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 8px 0', color: '#1e293b' }}>
                  1. Détail par Élève & Heures Effectuées
                </h3>
                {teacherData.studentsRows.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#64748b' }}>
                    Aucun élève rattaché pour le moment.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Nom de l'Élève</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Niveau Scolaire</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Séances Validées</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Total Heures</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tarif / h</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Chiffre Brut Généré</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacherData.studentsRows.map((r, idx) => (
                        <tr key={r.studentId} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '7px 10px', fontWeight: 700 }}>{r.studentName}</td>
                          <td style={{ padding: '7px 10px', color: '#475569' }}>{r.gradeLevel}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600 }}>{r.sessionsCount}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center' }}>{r.totalHours} h</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right' }}>{r.hourlyRate.toFixed(2)} DTN</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{r.grossAmount.toFixed(2)} DTN</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Section 2: Table of Payouts / Disbursements to Teacher */}
              {teacherData.payouts && teacherData.payouts.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 8px 0', color: '#1e293b' }}>
                    2. Historique des Règlements & Acomptes Reçus par l'Enseignant
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f0fdf4', borderBottom: '2px solid #86efac' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Date Règlement</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Mode de Paiement</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Notes / Référence</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Montant Versé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacherData.payouts.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{p.date}</td>
                          <td style={{ padding: '6px 10px' }}>{p.payment_method}</td>
                          <td style={{ padding: '6px 10px', color: '#64748b' }}>{p.notes || '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                            +{p.amount.toFixed(2)} DTN
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Financial Rollup & Payout Breakdown */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <div style={{ width: '380px', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingBottom: '6px', borderBottom: '1px solid #e9d5ff' }}>
                    <span>Chiffre d'Affaires Brut :</span>
                    <strong style={{ color: '#0f172a' }}>{teacherData.grossRevenue.toFixed(2)} DTN</strong>
                  </div>
                  {teacherData.teacher.payment_mode === 'per_student' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #e9d5ff' }}>
                        <span>Base de Calcul :</span>
                        <strong style={{ color: '#047857' }}>
                          {teacherData.studentsRows.filter((r) => r.sessionsCount > 0).length || teacherData.studentsRows.length} élève(s) × {teacherData.teacher.rate_per_student.toFixed(2)} DTN
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #e9d5ff' }}>
                        <span>Marge Conservée par le Centre :</span>
                        <strong style={{ color: '#64748b' }}>{teacherData.centerMargin.toFixed(2)} DTN</strong>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #e9d5ff' }}>
                      <span>Retenue Marge Centre ({((1 - teacherData.teacher.monthly_rate_cut) * 100).toFixed(0)}%) :</span>
                      <strong style={{ color: '#64748b' }}>- {teacherData.centerMargin.toFixed(2)} DTN</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #e9d5ff' }}>
                    <span style={{ color: '#5b21b6', fontWeight: 600 }}>Honoraires Générés au Titre des Séances :</span>
                    <strong style={{ color: '#6d28d9' }}>{teacherData.teacherPayout.toFixed(2)} DTN</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #e9d5ff' }}>
                    <span>Total Acomptes & Règlements Déjà Versés :</span>
                    <strong style={{ color: '#15803d' }}>- {teacherData.totalPaid.toFixed(2)} DTN</strong>
                  </div>

                  {/* Net Balance / Carryover to next time */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '8px', fontWeight: 800 }}>
                    <span>
                      {teacherData.remainingBalance > 0.01
                        ? 'Reliquat Restant Dû (Reporté) :'
                        : teacherData.remainingBalance < -0.01
                        ? 'Avance / Trop-Perçu (À déduire) :'
                        : 'Solde Net Final :'}
                    </span>
                    <span
                      style={{
                        color:
                          teacherData.remainingBalance > 0.01
                            ? '#b45309'
                            : teacherData.remainingBalance < -0.01
                            ? '#7c3aed'
                            : '#15803d'
                      }}
                    >
                      {teacherData.remainingBalance > 0.01
                        ? `+${teacherData.remainingBalance.toFixed(2)} DTN`
                        : teacherData.remainingBalance < -0.01
                        ? `-${Math.abs(teacherData.remainingBalance).toFixed(2)} DTN`
                        : '0.00 DTN (Soldé)'}
                    </span>
                  </div>

                  {teacherData.remainingBalance !== 0 && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', fontStyle: 'italic' }}>
                      {teacherData.remainingBalance > 0.01
                        ? "Ce solde en faveur du professeur s'ajoute automatiquement au prochain règlement."
                        : "Cette avance perçue en excédent sera automatiquement déduite du prochain règlement."}
                    </div>
                  )}
                </div>
              </div>

              {/* Signatures Area */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ textAlign: 'center', minWidth: '180px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '40px' }}>
                    L'Enseignant(e) (Bon pour accord)
                  </div>
                  <div style={{ borderBottom: '1px solid #94a3b8', width: '160px', margin: '0 auto' }} />
                </div>

                <div style={{ textAlign: 'center', minWidth: '180px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '40px' }}>
                    Visa & Cachet de la Direction
                  </div>
                  <div style={{ borderBottom: '1px solid #94a3b8', width: '160px', margin: '0 auto' }} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
