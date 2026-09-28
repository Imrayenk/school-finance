import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getStudents,
  getTeachers,
  getEnrollments,
  addStudent,
  updateStudent,
  deleteStudent,
  addEnrollment,
  recordPayment,
  getPaymentsForStudent,
  getDatabase,
  getGroups,
  addDebtReset,
  getStudentEnrollmentsWithDetails,
  updateEnrollmentPaymentInfo
} from '../db/sqlite'
import type { Student, Teacher, Enrollment, Payment, PaymentType, Group } from '../types'
import {
  GraduationCap,
  Plus,
  Phone,
  BookOpen,
  DollarSign,
  UserPlus,
  CreditCard,
  X,
  CheckCircle2,
  Coins,
  Edit2,
  Trash2,
  AlertTriangle,
  Printer,
  ClipboardCheck,
  Search,
  Filter
} from 'lucide-react'
import { InvoiceModal } from './InvoiceModal'
import { CompteRenduModal } from './CompteRenduModal'
import { Pagination } from './Pagination'

const CYCLES = ['Primaire', 'Collège', 'Secondaire']
const SECTIONS = ['Tronc Commun', 'Math', 'Sciences Exp', 'Économie & Gestion', 'Technique', 'Informatique', 'Lettres', 'Custom']
const STAGES_PRIMAIRE = ['1ère année', '2ème année', '3ème année', '4ème année', '5ème année', '6ème année']
const STAGES_COLLEGE = ['7ème année', '8ème année', '9ème année']
const STAGES_SECONDAIRE = ['1ère année', '2ème année', '3ème année', '4ème année (Bac)']

const getStagesForCycle = (cycle: string) => {
  if (cycle === 'Primaire') return STAGES_PRIMAIRE
  if (cycle === 'Collège') return STAGES_COLLEGE
  return STAGES_SECONDAIRE
}

export const StudentsManager: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [studentBalances, setStudentBalances] = useState<
    Record<string, { attendedSessions: number; totalCost: number; totalPaid: number; debt: number }>
  >({})
  const [loading, setLoading] = useState<boolean>(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterLevel, setFilterLevel] = useState<string>('All')
  const [filterDebt, setFilterDebt] = useState<string>('All')

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const bal = studentBalances[student.id] || { debt: 0 }
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            student.parent_contact.includes(searchQuery)
      const matchesLevel = filterLevel === 'All' || (student.grade_level || '').includes(filterLevel)
      let matchesDebt = true
      if (filterDebt === 'Debt') matchesDebt = bal.debt > 0
      if (filterDebt === 'Paid') matchesDebt = bal.debt === 0
      return matchesSearch && matchesLevel && matchesDebt
    })
  }, [students, studentBalances, searchQuery, filterLevel, filterDebt])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterLevel, filterDebt])

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredStudents.slice(start, start + itemsPerPage)
  }, [filteredStudents, currentPage])

  // Modals
  const [addStudentOpen, setAddStudentOpen] = useState<boolean>(false)
  const [enrollStudentOpen, setEnrollStudentOpen] = useState<boolean>(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false)
  const [ledgerModalOpen, setLedgerModalOpen] = useState<boolean>(false)
  const [invoiceStudent, setInvoiceStudent] = useState<Student | null>(null)
  const [compteRenduStudent, setCompteRenduStudent] = useState<Student | null>(null)

  useEffect(() => {
    const handleGlobalSearch = (e: any) => {
      if (e.detail.type === 'student') {
        setSearchQuery(e.detail.name)
        setFilterLevel('All')
        setFilterDebt('All')
      }
    }
    window.addEventListener('global_search_focus', handleGlobalSearch)
    return () => window.removeEventListener('global_search_focus', handleGlobalSearch)
  }, [])

  // Edit Student states
  const [editStudentOpen, setEditStudentOpen] = useState<boolean>(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [editStudentName, setEditStudentName] = useState<string>('')
  const [editStudentPhone, setEditStudentPhone] = useState<string>('')
  const [editStudentCycle, setEditStudentCycle] = useState<string>('Secondaire')
  const [editStudentSection, setEditStudentSection] = useState<string>('Math')
  const [editStudentCustomSection, setEditStudentCustomSection] = useState<string>('')
  const [editStudentEnrollments, setEditStudentEnrollments] = useState<any[]>([])
  const [editStudentStage, setEditStudentStage] = useState<string>('4ème année (Bac)')
  const [editStudentHasPaidInscription, setEditStudentHasPaidInscription] = useState<boolean>(false)

  // Delete Confirmation state
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null)

  // Form states
  const [newStudentName, setNewStudentName] = useState<string>('')
  const [newStudentPhone, setNewStudentPhone] = useState<string>('')
  const [newStudentCycle, setNewStudentCycle] = useState<string>('Secondaire')
  const [newStudentSection, setNewStudentSection] = useState<string>('Math')
  const [newStudentCustomSection, setNewStudentCustomSection] = useState<string>('')
  const [newStudentStage, setNewStudentStage] = useState<string>('4ème année (Bac)')
  const [newStudentHasPaidInscription, setNewStudentHasPaidInscription] = useState<boolean>(false)

  const [selectedStudentForEnroll, setSelectedStudentForEnroll] = useState<string>('')
  const [selectedTeacherForEnroll, setSelectedTeacherForEnroll] = useState<string>('')
  const [selectedGroupForEnroll, setSelectedGroupForEnroll] = useState<string>('')
  const [enrollHourlyRate, setEnrollHourlyRate] = useState<string>('120')
  const [enrollPaymentType, setEnrollPaymentType] = useState<string>('hourly')

  const [paymentTargetStudent, setPaymentTargetStudent] = useState<Student | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<string>('200')
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  const [ledgerStudent, setLedgerStudent] = useState<Student | null>(null)
  const [studentPayments, setStudentPayments] = useState<Payment[]>([])

  const [notification, setNotification] = useState<string | null>(null)

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [sList, tList, eList, gList] = await Promise.all([
      getStudents(),
      getTeachers(),
      getEnrollments(),
      getGroups()
    ])
    setStudents(sList)
    setTeachers(tList)
    setEnrollments(eList)
    setGroups(gList)

    if (sList.length > 0 && !selectedStudentForEnroll) {
      setSelectedStudentForEnroll(sList[0].id)
    }
    if (tList.length > 0 && !selectedTeacherForEnroll) {
      setSelectedTeacherForEnroll(tList[0].id)
    }

    // Compute balance for every student from relational database
    const balances: Record<
      string,
      { attendedSessions: number; totalCost: number; totalPaid: number; debt: number }
    > = {}

    for (const s of sList) {
      // Attended sessions cost — respects payment_type
      const _rowsCost = await window.desktopApp.dbQuery(`
        WITH EnrollmentCosts AS (
          SELECT
            e.id as enrollment_id,
            COUNT(s.id) as sessions_count,
            CASE
              WHEN e.payment_type = 'monthly'
                THEN e.hourly_rate * COUNT(DISTINCT substr(s.date, 1, 7))
              WHEN e.payment_type = 'session'
                THEN e.hourly_rate * COUNT(s.id)
              ELSE
                e.hourly_rate * SUM(s.duration)
            END as cost
          FROM Enrollments e
          JOIN Sessions s ON s.enrollment_id = e.id
          WHERE e.student_id = ? AND s.status = 'attended'
          GROUP BY e.id
        )
        SELECT
          COALESCE(SUM(cost), 0)          as total_cost,
          COALESCE(SUM(sessions_count), 0) as sessions_count
        FROM EnrollmentCosts;
      `, [s.id])
      let totalCost = 0
      let attendedSessions = 0
      if (_rowsCost.length > 0) {
        totalCost = Number(_rowsCost[0].total_cost || 0)
        attendedSessions = Number(_rowsCost[0].sessions_count || 0)
      }

      // Total payments
      const _rowsPay = await window.desktopApp.dbQuery(`
        SELECT COALESCE(SUM(amount), 0) as total_paid
        FROM Payments
        WHERE student_id = ?;
      `, [s.id])
      const _rowsReset = await window.desktopApp.dbQuery(`
        SELECT COALESCE(SUM(amount), 0) as total_reset
        FROM DebtResets
        WHERE student_id = ?;
      `, [s.id])
      let totalPaid = 0
      if (_rowsPay.length > 0) {
        totalPaid += Number(_rowsPay[0].total_paid || 0)
      }
      if (_rowsReset.length > 0) {
        totalPaid += Number(_rowsReset[0].total_reset || 0)
      }

      balances[s.id] = {
        attendedSessions,
        totalCost,
        totalPaid,
        debt: Number((totalCost - totalPaid).toFixed(2))
      }
    }

    setStudentBalances(balances)
    setLoading(false)
  }, [selectedStudentForEnroll, selectedTeacherForEnroll])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Handle Add Student
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStudentName.trim()) return

    const normalizedName = newStudentName.trim().toLowerCase()
    if (students.some(s => s.name.toLowerCase() === normalizedName)) {
      alert(`Un élève avec le nom "${newStudentName.trim()}" existe déjà.`)
      return
    }

    const actualSection = newStudentSection === 'Custom' ? newStudentCustomSection.trim() : newStudentSection
    const finalGradeLevel = `${newStudentCycle} - ${actualSection} - ${newStudentStage}`

    await addStudent({
      name: newStudentName.trim(),
      parent_contact: newStudentPhone.trim() || 'Non renseigné',
      grade_level: finalGradeLevel,
      has_paid_inscription: newStudentHasPaidInscription
    })

    showNotification(`Élève ${newStudentName} enregistré avec succès.`)
    setAddStudentOpen(false)
    setNewStudentName('')
    setNewStudentPhone('')
    setNewStudentHasPaidInscription(false)
    await loadAll()
  }

  // Handle Enroll Student
  const handleEnrollStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rate = parseFloat(enrollHourlyRate)
    if (isNaN(rate) || rate <= 0) {
      alert('Veuillez entrer un tarif horaire valide.')
      return
    }

    // Check if already enrolled with this teacher
    const existing = enrollments.find(
      (enr) =>
        enr.student_id === selectedStudentForEnroll &&
        enr.teacher_id === selectedTeacherForEnroll
    )
    if (existing) {
      alert('Cet élève est déjà inscrit auprès de cet enseignant.')
      return
    }

    await addEnrollment(
      selectedStudentForEnroll,
      selectedTeacherForEnroll,
      rate,
      enrollPaymentType as PaymentType,
      selectedGroupForEnroll || null
    )
    showNotification('Inscription enregistrée avec succès.')
    setEnrollStudentOpen(false)
    await loadAll()
  }

  // Handle Record Payment
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentTargetStudent) return
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('Montant de paiement invalide.')
      return
    }

    await recordPayment(paymentTargetStudent.id, amt, paymentDate)
    showNotification(`Paiement de ${amt.toFixed(2)} DTN enregistré pour ${paymentTargetStudent.name}.`)
    setPaymentModalOpen(false)
    await loadAll()
  }
  // Handle Debt Reset
  const handleDebtReset = async (student: Student, currentDebt: number) => {
    if (Math.abs(currentDebt) < 0.01) {
      alert("Cet élève a déjà un solde de 0.")
      return
    }
    const isOverpaid = currentDebt < -0.01
    const actionText = isOverpaid 
      ? `rembourser virtuellement le trop-perçu de ${Math.abs(currentDebt).toFixed(2)} DTN pour ${student.name}` 
      : `remettre à zéro la dette de ${currentDebt.toFixed(2)} DTN pour ${student.name}`

    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir ${actionText} ?\n\nCette action conservera l'historique mais soldera le compte (sans modifier l'argent de la caisse réelle).`
    )
    if (!confirmed) return

    await addDebtReset(student.id, currentDebt)
    showNotification(`Dette de ${student.name} remise à zéro avec succès.`)
    await loadAll()
  }

  // View Ledger
  const handleOpenLedger = async (student: Student) => {
    setLedgerStudent(student)
    const payments = await getPaymentsForStudent(student.id)
    setStudentPayments(payments)
    setLedgerModalOpen(true)
  }

  // Edit Student
  const handleOpenEditStudent = async (student: Student) => {
    setEditingStudent(student)
    
    // Fetch enrollments
    try {
      const enrollments = await getStudentEnrollmentsWithDetails(student.id)
      setEditStudentEnrollments(enrollments)
    } catch (e) {
      console.error(e)
    }
    setEditStudentName(student.name)
    setEditStudentPhone(student.parent_contact)
    
    // Parse existing grade_level
    const parts = (student.grade_level || '').split(' - ')
    if (parts.length >= 3) {
      setEditStudentCycle(parts[0])
      if (SECTIONS.includes(parts[1])) {
        setEditStudentSection(parts[1])
        setEditStudentCustomSection('')
      } else {
        setEditStudentSection('Custom')
        setEditStudentCustomSection(parts[1])
      }
      setEditStudentStage(parts.slice(2).join(' - '))
    } else {
      // Legacy format parsing
      setEditStudentCycle('Secondaire')
      setEditStudentSection('Custom')
      setEditStudentCustomSection(student.grade_level)
      setEditStudentStage('4ème année (Bac)')
    }

    setEditStudentHasPaidInscription(student.has_paid_inscription || false)
    setEditStudentOpen(true)
  }

  const handleUpdateStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStudent || !editStudentName.trim()) return

    const normalizedName = editStudentName.trim().toLowerCase()
    if (students.some(s => s.id !== editingStudent.id && s.name.toLowerCase() === normalizedName)) {
      alert(`Un élève avec le nom "${editStudentName.trim()}" existe déjà.`)
      return
    }

    const actualSection = editStudentSection === 'Custom' ? editStudentCustomSection.trim() : editStudentSection
    const finalGradeLevel = `${editStudentCycle} - ${actualSection} - ${editStudentStage}`

    await updateStudent(editingStudent.id, {
      name: editStudentName.trim(),
      parent_contact: editStudentPhone.trim() || 'Non renseigné',
      grade_level: finalGradeLevel,
      has_paid_inscription: editStudentHasPaidInscription
    })

    // Update enrollments
    for (const enr of editStudentEnrollments) {
      await updateEnrollmentPaymentInfo(enr.enrollment_id, enr.payment_type, Number(enr.hourly_rate))
    }

    showNotification(`Élève ${editStudentName} mis à jour avec succès.`)
    setEditStudentOpen(false)
    setEditingStudent(null)
    await loadAll()
  }

  // Delete Student
  const handleConfirmDeleteStudent = async () => {
    if (!deleteConfirmStudent) return
    const sName = deleteConfirmStudent.name
    await deleteStudent(deleteConfirmStudent.id)
    showNotification(`Élève ${sName} et ses dossiers ont été supprimés avec succès.`)
    setDeleteConfirmStudent(null)
    await loadAll()
  }

  const getGradeBadgeClass = (grade: string) => {
    const g = (grade || '').toLowerCase()
    if (g.includes('4') || g.includes('2') || g.includes('bac')) return 'badge-grade-2bac'
    if (g.includes('3') || g.includes('1')) return 'badge-grade-1bac'
    if (g.includes('tronc') || g.includes('base') || g.includes('collège') || g.includes('9')) return 'badge-grade-tronc'
    return 'badge-grade-default'
  }

  const getSubjectBadgeClass = (subject: string) => {
    const s = (subject || '').toLowerCase()
    if (s.includes('math')) return 'badge-subject-math'
    if (s.includes('phys')) return 'badge-subject-physics'
    if (s.includes('svt') || s.includes('bio')) return 'badge-subject-svt'
    if (s.includes('fran')) return 'badge-subject-french'
    if (s.includes('arab') || s.includes('phil')) return 'badge-subject-arabic'
    if (s.includes('angl')) return 'badge-subject-english'
    return 'badge-subject-math'
  }

  const stats = useMemo(() => {
    const totalStudents = students.length
    const totalEnrollments = enrollments.length
    let totalDebt = 0
    let paidCount = 0
    let debtCount = 0

    Object.values(studentBalances).forEach((b) => {
      if (b.debt > 0) {
        totalDebt += b.debt
        debtCount++
      } else {
        paidCount++
      }
    })

    return { totalStudents, totalEnrollments, totalDebt, paidCount, debtCount }
  }, [students, enrollments, studentBalances])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Hero Banner */}
      <div className="page-hero hero-teal fade-in">
        <div className="page-hero-content">
          <div className="page-hero-icon">
            <GraduationCap size={26} color="white" />
          </div>
          <div>
            <h1 className="page-hero-title">Élèves & Inscriptions</h1>
            <p className="page-hero-subtitle">
              {students.length} élève{students.length !== 1 ? 's' : ''} · Tarifs horaires, soldes financiers et inscriptions
            </p>
          </div>
        </div>
        <div className="page-hero-actions">
          <button
            id="btn-open-enroll-student"
            type="button"
            className="btn-hero-outline"
            onClick={() => setEnrollStudentOpen(true)}
          >
            <BookOpen size={16} />
            Inscrire un Élève
          </button>
          <button
            id="btn-open-add-student"
            type="button"
            className="btn-hero"
            onClick={() => setAddStudentOpen(true)}
          >
            <UserPlus size={16} />
            Nouveau Élève
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          style={{
            backgroundColor: 'var(--color-text-primary)',
            color: 'var(--color-surface-raised)',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          {notification}
        </div>
      )}

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-3)'
        }}
      >
        <div className="card-kpi card-kpi-blue" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}>
            <GraduationCap size={18} aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Élèves
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {stats.totalStudents} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>inscrits</span>
            </div>
          </div>
        </div>

        <div className="card-kpi card-kpi-teal" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#fff' }}>
            <BookOpen size={18} aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Inscriptions aux Cours
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f766e' }}>
              {stats.totalEnrollments} <span style={{ fontSize: '12px', fontWeight: 500 }}>matières</span>
            </div>
          </div>
        </div>

        <div className="card-kpi card-kpi-green" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
            <CheckCircle2 size={18} aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Élèves en Règle
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#15803d' }}>
              {stats.paidCount} <span style={{ fontSize: '12px', fontWeight: 500 }}>à jour</span>
            </div>
          </div>
        </div>

        <div className="card-kpi card-kpi-rose" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff' }}>
            <Coins size={18} aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Créances Globales
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: stats.totalDebt > 0 ? '#be123c' : '#15803d' }}>
              {stats.totalDebt.toFixed(2)} <span style={{ fontSize: '12px' }}>DTN</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
            <Search size={16} />
          </div>
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '36px' }}
            placeholder="Rechercher un élève par nom ou contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="select-field"
          style={{ width: '200px' }}
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
        >
          <option value="All">Tous les Niveaux</option>
          <option value="Primaire">Primaire</option>
          <option value="Collège">Collège</option>
          <option value="Secondaire">Secondaire</option>
          <option value="Bac">Bac</option>
        </select>
        <select
          className="select-field"
          style={{ width: '200px' }}
          value={filterDebt}
          onChange={(e) => setFilterDebt(e.target.value)}
        >
          <option value="All">Tous les statuts de paiement</option>
          <option value="Paid">À jour (Sans dette)</option>
          <option value="Debt">Avec Dette</option>
        </select>
      </div>

      {/* Students Data Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Chargement de la liste des élèves...
          </div>
        ) : students.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Aucun élève enregistré. Cliquez sur "Nouveau Élève" pour commencer.
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Aucun élève ne correspond à vos filtres de recherche.
          </div>
        ) : (
          <>
            <table className="data-table" aria-label="Liste des élèves du centre">
              <thead>
                <tr>
                <th scope="col">Nom de l'Élève</th>
                <th scope="col">Contact Parent</th>
                <th scope="col">Niveau Scolaire</th>
                <th scope="col">Enseignants Assignés</th>
                <th scope="col" style={{ textAlign: 'center' }}>Séances Suivies</th>
                <th scope="col" style={{ textAlign: 'center' }}>Frais Inscription</th>
                <th scope="col" style={{ textAlign: 'right' }}>Total Coût</th>
                <th scope="col" style={{ textAlign: 'right' }}>Total Payé</th>
                <th scope="col" style={{ textAlign: 'right' }}>Dette / Solde</th>
                <th scope="col" style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student) => {
                const bal = studentBalances[student.id] || {
                  attendedSessions: 0,
                  totalCost: 0,
                  totalPaid: 0,
                  debt: 0
                }
                const studentEnrollments = enrollments.filter((e) => e.student_id === student.id)

                return (
                  <tr key={student.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #0d9488, #3b82f6)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                        >
                          {student.name.charAt(0)}
                        </div>
                        <span>{student.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={13} aria-hidden="true" />
                        {student.parent_contact}
                      </span>
                    </td>
                    <td>
                      <span className={getGradeBadgeClass(student.grade_level)}>
                        {student.grade_level}
                      </span>
                    </td>
                    <td>
                      {studentEnrollments.length === 0 ? (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          Aucun enseignant
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {studentEnrollments.map((enr) => {
                            const t = teachers.find((tch) => tch.id === enr.teacher_id)
                            return (
                              <span
                                key={enr.id}
                                className={`badge-subject ${getSubjectBadgeClass(t?.subject || '')}`}
                                style={{ fontSize: '11px', padding: '2px 8px' }}
                              >
                                {t?.name} ({enr.hourly_rate} DTN{enr.payment_type === 'hourly' ? '/h' : enr.payment_type === 'session' ? '/séance' : '/mois'})
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {bal.attendedSessions}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {student.has_paid_inscription ? '✅' : '❌'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {bal.totalCost.toFixed(2)} DTN
                    </td>
                    <td style={{ textAlign: 'right', color: '#15803d', fontWeight: 700 }}>
                      {bal.totalPaid.toFixed(2)} DTN
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {bal.debt > 0 ? (
                        <span
                          className="badge-debt"
                          style={{
                            color: '#be123c',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fca5a5',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 700
                          }}
                        >
                          +{bal.debt.toFixed(2)} DTN
                        </span>
                      ) : (
                        <span
                          className="badge-paid"
                          style={{
                            color: '#15803d',
                            backgroundColor: '#dcfce7',
                            border: '1px solid #86efac',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 700
                          }}
                        >
                          {bal.debt === 0 ? '✓ 0.00 DTN' : `${bal.debt.toFixed(2)} DTN`}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {/* Financial Actions */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            id={`btn-pay-student-${student.id}`}
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                            onClick={() => {
                              setPaymentTargetStudent(student)
                              setPaymentAmount(bal.debt > 0 ? String(bal.debt) : '200')
                              setPaymentModalOpen(true)
                            }}
                            title="Encaisser un paiement pour cet élève"
                          >
                            <CreditCard size={12} aria-hidden="true" />
                            Paiement
                          </button>
                          <button
                            id={`btn-reset-student-${student.id}`}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '11px', gap: '4px', borderColor: '#fca5a5', color: '#be123c', backgroundColor: '#fee2e2' }}
                            onClick={() => handleDebtReset(student, bal.debt)}
                            title="Remettre la dette à zéro (sans loguer d'argent)"
                            disabled={Math.abs(bal.debt) < 0.01}
                          >
                            <X size={12} aria-hidden="true" />
                            Remise
                          </button>
                        </div>
                        
                        {/* Secondary Actions */}
                        <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>
                          <button
                            id={`btn-ledger-student-${student.id}`}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px', fontSize: '11px', color: '#4b5563' }}
                            onClick={() => handleOpenLedger(student)}
                            title="Consulter le relevé de paiements"
                          >
                            <BookOpen size={14} aria-hidden="true" />
                          </button>
                          <button
                            id={`btn-invoice-student-${student.id}`}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px', fontSize: '11px', color: '#4b5563' }}
                            onClick={() => setInvoiceStudent(student)}
                            title="Imprimer la facture officielle de cet élève"
                          >
                            <Printer size={14} aria-hidden="true" />
                          </button>
                          <button
                            id={`btn-report-student-${student.id}`}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px', fontSize: '11px', borderColor: '#93c5fd', color: '#1e40af', backgroundColor: '#eff6ff' }}
                            onClick={() => setCompteRenduStudent(student)}
                            title="Imprimer le compte rendu pédagogique & d'assiduité de cet élève"
                          >
                            <ClipboardCheck size={14} aria-hidden="true" />
                          </button>
                          <button
                            id={`btn-edit-student-${student.id}`}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px', fontSize: '11px', color: '#4b5563' }}
                            onClick={() => handleOpenEditStudent(student)}
                            title="Modifier les coordonnées de cet élève"
                          >
                            <Edit2 size={14} aria-hidden="true" />
                          </button>
                          <button
                            id={`btn-delete-student-${student.id}`}
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '6px', fontSize: '11px' }}
                            onClick={() => setDeleteConfirmStudent(student)}
                            title="Supprimer cet élève"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
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
            onPageChange={setCurrentPage}
          />
        </>
        )}
      </div>

      {/* Register Student Modal */}
      {addStudentOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-student-title"
          onClick={() => setAddStudentOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="register-student-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Enregistrer un Nouvel Élève
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAddStudentOpen(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="new-student-name" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Nom Complet de l'Élève * :
                </label>
                <input
                  id="new-student-name"
                  type="text"
                  required
                  autoFocus
                  className="input-field"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="ex. Aziz Ben Amor"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="new-student-phone" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Contact Parent / Tuteur (Format Tunisien +216) :
                </label>
                <input
                  id="new-student-phone"
                  type="text"
                  className="input-field"
                  value={newStudentPhone}
                  onChange={(e) => setNewStudentPhone(e.target.value)}
                  placeholder="ex. +216 98 234 567"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Niveau Scolaire * :</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <select
                    className="select-field"
                    value={newStudentCycle}
                    onChange={(e) => {
                      setNewStudentCycle(e.target.value)
                      setNewStudentStage(getStagesForCycle(e.target.value)[0])
                    }}
                  >
                    {CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  
                  <select
                    className="select-field"
                    value={newStudentSection}
                    onChange={(e) => setNewStudentSection(e.target.value)}
                  >
                    {SECTIONS.map(s => <option key={s} value={s}>{s === 'Custom' ? 'Autre (Personnalisé)...' : s}</option>)}
                  </select>
                  
                  <select
                    className="select-field"
                    value={newStudentStage}
                    onChange={(e) => setNewStudentStage(e.target.value)}
                  >
                    {getStagesForCycle(newStudentCycle).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {newStudentSection === 'Custom' && (
                  <input
                    type="text"
                    required
                    className="input-field"
                    style={{ marginTop: '4px' }}
                    value={newStudentCustomSection}
                    onChange={(e) => setNewStudentCustomSection(e.target.value)}
                    placeholder="Saisissez la section personnalisée"
                  />
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="new-student-inscription"
                  type="checkbox"
                  checked={newStudentHasPaidInscription}
                  onChange={(e) => setNewStudentHasPaidInscription(e.target.checked)}
                />
                <label htmlFor="new-student-inscription" style={{ fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Frais d'inscription annuel payé
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddStudentOpen(false)}>
                  Annuler
                </button>
                <button id="btn-submit-register-student" type="submit" className="btn btn-primary">
                  Register Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {enrollStudentOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enroll-student-title"
          onClick={() => setEnrollStudentOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="enroll-student-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Inscrire un Élève auprès d'un Enseignant
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEnrollStudentOpen(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEnrollStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="enroll-select-student" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Élève * :
                </label>
                <select
                  id="enroll-select-student"
                  className="select-field"
                  value={selectedStudentForEnroll}
                  onChange={(e) => setSelectedStudentForEnroll(e.target.value)}
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.grade_level})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="enroll-select-teacher" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Enseignant Référent * :
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="enroll-select-teacher"
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                  >
                    Enseignant * :
                  </label>
                  <select
                    id="enroll-select-teacher"
                    className="select-field"
                    value={selectedTeacherForEnroll}
                    onChange={(e) => {
                      setSelectedTeacherForEnroll(e.target.value)
                      setSelectedGroupForEnroll('') // Reset group when teacher changes
                    }}
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subject})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Group Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="enroll-select-group"
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                  >
                    Groupe (Optionnel) :
                  </label>
                  <select
                    id="enroll-select-group"
                    className="select-field"
                    value={selectedGroupForEnroll}
                    onChange={(e) => setSelectedGroupForEnroll(e.target.value)}
                  >
                    <option value="">Aucun groupe (Individuel)</option>
                    {groups
                      .filter(g => g.teacher_id === selectedTeacherForEnroll)
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="enroll-payment-type" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Type de Tarif * :
                </label>
                <select
                  id="enroll-payment-type"
                  className="select-field"
                  value={enrollPaymentType}
                  onChange={(e) => setEnrollPaymentType(e.target.value)}
                >
                  <option value="hourly">Tarif Horaire</option>
                  <option value="session">Par Séance (Forfaitaire)</option>
                  <option value="monthly">Forfait Mensuel</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="enroll-hourly-rate" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Montant du tarif (DTN) * :
                </label>
                <input
                  id="enroll-hourly-rate"
                  type="number"
                  step="5"
                  min="10"
                  required
                  className="input-field"
                  value={enrollHourlyRate}
                  onChange={(e) => setEnrollHourlyRate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEnrollStudentOpen(false)}>
                  Annuler
                </button>
                <button id="btn-submit-enroll-student" type="submit" className="btn btn-primary">
                  Enroll Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalOpen && paymentTargetStudent && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-student-payment-title"
          onClick={() => setPaymentModalOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="record-student-payment-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Encaisser un Règlement
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPaymentModalOpen(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Élève : <strong>{paymentTargetStudent.name}</strong>
            </p>

            <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="student-payment-amt" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Montant Reçu (DTN) * :
                </label>
                <input
                  id="student-payment-amt"
                  type="number"
                  step="any"
                  min="1"
                  required
                  autoFocus
                  className="input-field"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="student-payment-date" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Date d'Encaissement * :
                </label>
                <input
                  id="student-payment-date"
                  type="date"
                  required
                  className="input-field"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModalOpen(false)}>
                  Annuler
                </button>
                <button id="btn-submit-student-payment" type="submit" className="btn btn-primary">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {ledgerModalOpen && ledgerStudent && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-ledger-title"
          onClick={() => setLedgerModalOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '560px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="student-ledger-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Historique des Paiements : {ledgerStudent.name}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLedgerModalOpen(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="table-container">
              {studentPayments.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  Aucun versement enregistré pour cet élève.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">ID Reçu</th>
                      <th scope="col">Date de Versement</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Montant Reçu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentPayments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{p.id}</td>
                        <td>{p.date}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-semantic-paid)' }}>
                          +{p.amount.toFixed(2)} DTN
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setLedgerModalOpen(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editStudentOpen && editingStudent && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-student-title"
          onClick={() => setEditStudentOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="edit-student-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Modifier l'Élève
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditStudentOpen(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="edit-student-name" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Nom Complet de l'Élève * :
                </label>
                <input
                  id="edit-student-name"
                  type="text"
                  required
                  autoFocus
                  className="input-field"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  placeholder="ex. Aziz Ben Amor"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="edit-student-phone" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Contact Parent / Tuteur (Format Tunisien +216) :
                </label>
                <input
                  id="edit-student-phone"
                  type="text"
                  className="input-field"
                  value={editStudentPhone}
                  onChange={(e) => setEditStudentPhone(e.target.value)}
                  placeholder="ex. +216 98 234 567"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Niveau Scolaire * :</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <select
                    className="select-field"
                    value={editStudentCycle}
                    onChange={(e) => {
                      setEditStudentCycle(e.target.value)
                      setEditStudentStage(getStagesForCycle(e.target.value)[0])
                    }}
                  >
                    {CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  
                  <select
                    className="select-field"
                    value={editStudentSection}
                    onChange={(e) => setEditStudentSection(e.target.value)}
                  >
                    {SECTIONS.map(s => <option key={s} value={s}>{s === 'Custom' ? 'Autre (Personnalisé)...' : s}</option>)}
                  </select>
                  
                  <select
                    className="select-field"
                    value={editStudentStage}
                    onChange={(e) => setEditStudentStage(e.target.value)}
                  >
                    {getStagesForCycle(editStudentCycle).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {editStudentSection === 'Custom' && (
                  <input
                    type="text"
                    required
                    className="input-field"
                    style={{ marginTop: '4px' }}
                    value={editStudentCustomSection}
                    onChange={(e) => setEditStudentCustomSection(e.target.value)}
                    placeholder="Saisissez la section personnalisée"
                  />
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="edit-student-inscription"
                  type="checkbox"
                  checked={editStudentHasPaidInscription}
                  onChange={(e) => setEditStudentHasPaidInscription(e.target.checked)}
                />
                <label htmlFor="edit-student-inscription" style={{ fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Frais d'inscription annuel payé
                </label>
              </div>

              {editStudentEnrollments.length > 0 && (
                <div style={{ marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Matières et Paiement
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {editStudentEnrollments.map((enr, index) => (
                      <div key={enr.enrollment_id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', backgroundColor: 'var(--color-surface-hover)', padding: '8px', borderRadius: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>
                          {enr.teacher_name} {enr.group_name ? `(${enr.group_name})` : ''}
                        </span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Type:</span>
                          <select
                            className="select-field"
                            style={{ padding: '2px 4px', fontSize: '12px', minWidth: '90px' }}
                            value={enr.payment_type}
                            onChange={(e) => {
                              const newEnrollments = [...editStudentEnrollments]
                              newEnrollments[index].payment_type = e.target.value
                              setEditStudentEnrollments(newEnrollments)
                            }}
                          >
                            <option value="hourly">Par Heure</option>
                            <option value="session">Par Séance</option>
                            <option value="monthly">Par Mois</option>
                          </select>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Prix:</span>
                          <input
                            type="number"
                            step="0.5"
                            className="input-field"
                            style={{ padding: '2px 4px', fontSize: '12px', width: '60px' }}
                            value={enr.hourly_rate}
                            onChange={(e) => {
                              const newEnrollments = [...editStudentEnrollments]
                              newEnrollments[index].hourly_rate = Number(e.target.value)
                              setEditStudentEnrollments(newEnrollments)
                            }}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>DTN</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditStudentOpen(false)}>
                  Annuler
                </button>
                <button id="btn-submit-edit-student" type="submit" className="btn btn-primary">
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {deleteConfirmStudent && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-student-modal-title"
          onClick={() => setDeleteConfirmStudent(null)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: '#be123c' }}>
              <AlertTriangle size={22} aria-hidden="true" />
              <h2 id="delete-student-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Supprimer le Dossier Élève
              </h2>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Êtes-vous sûr de vouloir supprimer définitivement le dossier de <strong>{deleteConfirmStudent.name}</strong> ({deleteConfirmStudent.grade_level}) ?
              <br />
              <span style={{ color: '#be123c', fontWeight: 600 }}>
                Attention : Toutes les inscriptions aux matières, présences enregistrées et historiques de paiement de cet élève seront supprimés en cascade.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteConfirmStudent(null)}>
                Annuler
              </button>
              <button
                id="btn-confirm-delete-student"
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteStudent}
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Official Invoice / Receipt Modal */}
      {invoiceStudent && (
        <InvoiceModal
          type="student"
          data={invoiceStudent}
          onClose={() => setInvoiceStudent(null)}
        />
      )}

      {/* Student Official Pedagogical Compte Rendu Modal */}
      {compteRenduStudent && (
        <CompteRenduModal
          type="student"
          student={compteRenduStudent}
          onClose={() => setCompteRenduStudent(null)}
        />
      )}
    </div>
  )
}
