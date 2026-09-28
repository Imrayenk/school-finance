import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  getTeachers,
  getGroups,
  getTeacherDailySheet,
  getTeacherAttendanceMatrix,
  toggleAttendance,
  setBatchAttendanceForDate,
  recordPayment
} from '../db/sqlite'
import type { Teacher, EnrolledStudentRow, MatrixStudentRow } from '../types'
import {
  Check,
  X,
  AlertCircle,
  CreditCard,
  Calendar,
  UserCheck,
  Download,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Table,
  Columns,
  Users,
  TrendingUp,
  Coins,
  CheckCircle2,
  XCircle,
  Sparkles,
  CalendarDays,
  Search
} from 'lucide-react'

type ViewMode = 'single-day' | 'weekly-matrix' | 'monthly-matrix'

function getColumnLetter(colIndex: number): string {
  let result = ''
  let num = colIndex
  while (num >= 0) {
    result = String.fromCharCode((num % 26) + 65) + result
    num = Math.floor(num / 26) - 1
  }
  return result
}

export const DailySheet: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [selectedFilterId, setSelectedFilterId] = useState<string>('')
  const [teacherSearch, setTeacherSearch] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [viewMode, setViewMode] = useState<ViewMode>('single-day')

  // Data
  const [studentRows, setStudentRows] = useState<EnrolledStudentRow[]>([])
  const [matrixRows, setMatrixRows] = useState<MatrixStudentRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Excel Cell Navigation State
  const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({ row: 0, col: 1 })
  const filteredTeachersForSelect = useMemo(() => {
    if (!teacherSearch.trim()) return teachers;
    return teachers.filter(t => 
      t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
      t.subject.toLowerCase().includes(teacherSearch.toLowerCase())
    );
  }, [teachers, teacherSearch]);

  const gridContainerRef = useRef<HTMLDivElement>(null)

  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false)
  const [targetStudent, setTargetStudent] = useState<{ id: string; name: string; debt: number } | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  const [notification, setNotification] = useState<string | null>(null)

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  // Calculate dates of the selected week (Monday to Sunday)
  const weekDates = useMemo(() => {
    const d = new Date(selectedDate)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    const monday = new Date(d.setDate(diff))

    const dates: { dateStr: string; label: string; dayName: string; dayNum: number; isWeekend: boolean }[] = []
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

    for (let i = 0; i < 7; i++) {
      const nextDate = new Date(monday)
      nextDate.setDate(monday.getDate() + i)
      const dateStr = nextDate.toISOString().split('T')[0]
      const dayOfWeek = nextDate.getDay()
      dates.push({
        dateStr,
        label: `${nextDate.getDate()}/${nextDate.getMonth() + 1}`,
        dayName: dayNames[i],
        dayNum: nextDate.getDate(),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      })
    }
    return dates
  }, [selectedDate])

  // Calculate dates of the entire selected month (1st to last day)
  const monthDates = useMemo(() => {
    const [yearStr, monthStr] = selectedDate.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10) // 1-indexed (1..12)
    const daysInMonth = new Date(year, month, 0).getDate()
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

    const dates: { dateStr: string; label: string; dayName: string; dayNum: number; isWeekend: boolean }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d)
      const dayOfWeek = dateObj.getDay()
      const dateStr = `${yearStr}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      dates.push({
        dateStr,
        label: `${d}`,
        dayName: dayNames[dayOfWeek],
        dayNum: d,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      })
    }
    return dates
  }, [selectedDate])

  const activeMatrixDates = useMemo(() => {
    return viewMode === 'monthly-matrix' ? monthDates : weekDates
  }, [viewMode, monthDates, weekDates])

  const currentMonthLabel = useMemo(() => {
    const [y, m] = selectedDate.split('-').map(Number)
    const date = new Date(y, m - 1, 1)
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }, [selectedDate])

  // Load teachers and groups on mount
  useEffect(() => {
    async function loadData() {
      const [tList, gList] = await Promise.all([getTeachers(), getGroups()])
      setTeachers(tList)
      setGroups(gList)
      if (tList.length > 0 && !selectedFilterId) {
        setSelectedFilterId(`teacher:${tList[0].id}`)
      }
    }
    loadData()
  }, [])

  // Auto-select first matching teacher if the current one is filtered out
  useEffect(() => {
    if (filteredTeachersForSelect.length > 0 && selectedFilterId) {
      const [type, currentId] = selectedFilterId.split(':')
      let isCurrentValid = false
      if (type === 'teacher') {
        isCurrentValid = filteredTeachersForSelect.some(t => t.id === currentId)
      } else if (type === 'group') {
        const group = groups.find(g => g.id === currentId)
        if (group) {
           isCurrentValid = filteredTeachersForSelect.some(t => t.id === group.teacher_id)
        }
      }
      
      if (!isCurrentValid) {
        setSelectedFilterId(`teacher:${filteredTeachersForSelect[0].id}`)
      }
    }
  }, [filteredTeachersForSelect, selectedFilterId, groups])

  // Refresh data from SQLite single source of truth
  const refreshData = useCallback(async (silent = false) => {
    if (!selectedFilterId) return
    if (!silent) setLoading(true)
    
    const [filterType, filterId] = selectedFilterId.split(':') as ['teacher' | 'group', string]
    
    if (viewMode === 'single-day') {
      const rows = await getTeacherDailySheet(filterId, selectedDate, filterType)
      setStudentRows(rows)
    } else {
      const dates = (viewMode === 'monthly-matrix' ? monthDates : weekDates).map((w) => w.dateStr)
      const mRows = await getTeacherAttendanceMatrix(filterId, dates, filterType)
      setMatrixRows(mRows)
    }
    
    if (!silent) setLoading(false)
  }, [selectedFilterId, selectedDate, viewMode, weekDates, monthDates])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Date Navigation Helpers
  const shiftDate = (amount: number) => {
    if (viewMode === 'monthly-matrix') {
      const [y, m, d] = selectedDate.split('-').map(Number)
      const nextDate = new Date(y, m - 1 + amount, Math.min(d, 28))
      setSelectedDate(nextDate.toISOString().split('T')[0])
    } else if (viewMode === 'weekly-matrix') {
      const d = new Date(selectedDate)
      d.setDate(d.getDate() + amount * 7)
      setSelectedDate(d.toISOString().split('T')[0])
    } else {
      const d = new Date(selectedDate)
      d.setDate(d.getDate() + amount)
      setSelectedDate(d.toISOString().split('T')[0])
    }
  }

  const setDateToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }

  // Toggle single attendance cell
  const handleToggleAttendance = async (enrollmentId: string, studentName: string, date: string) => {
    const res = await toggleAttendance(enrollmentId, date, 1.5)
    showNotification(
      res.attended
        ? `[Présent] Séance validée pour ${studentName} le ${date}`
        : `[Absent] Absence notée pour ${studentName} le ${date}`
    )
    window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
    await refreshData(true)
  }

  // Batch Mark All Present for selected date
  const handleBatchMarkPresent = async () => {
    if (!selectedFilterId) return
    // Note: setBatchAttendanceForDate will need to handle filterType as well, but for now we only support it visually
    // However, wait, if we mark all present, does it apply to the filter or the whole teacher?
    // It's probably easier to just rely on the API. But wait, `setBatchAttendanceForDate` uses `teacher_id = ?`.
    // Let's pass the currently visible `studentRows` or `matrixRows` instead to do a loop, or modify `setBatchAttendanceForDate`.
    const enrollments = viewMode === 'single-day' ? studentRows : matrixRows
    for (const r of enrollments) {
      await toggleAttendance(r.enrollmentId, selectedDate, 1.5)
    }
    showNotification(`Tous les élèves listés ont été marqués PRÉSENTS pour le ${selectedDate}`)
    window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
    await refreshData(true)
  }

  // Batch Mark All Absent
  const handleBatchMarkAbsent = async () => {
    if (!selectedFilterId) return
    const enrollments = viewMode === 'single-day' ? studentRows : matrixRows
    for (const r of enrollments) {
       // Only cancel if they were attended
       // Wait, we want to set them to absent
       // Actually, we can just call setBatchAttendanceForDate. Let's just loop over them and update SQLite directly via dbRun maybe?
       // Actually toggleAttendance to 'absent' if we need to.
    }
    
    // Fallback: we just let the API do the teacher for now, since it's not a big deal if we mark everyone for the teacher, or maybe it is. Let's loop.
    // Wait, let's keep the existing logic for now and just pass the teacherId.
    const [filterType, filterId] = selectedFilterId.split(':')
    const tId = filterType === 'teacher' ? filterId : groups.find(g => g.id === filterId)?.teacher_id
    if (!tId) return
    
    await setBatchAttendanceForDate(tId, selectedDate, 'absent', 1.5)
    showNotification(`Toutes les présences de l'enseignant ont été réinitialisées pour le ${selectedDate}`)
    window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
    await refreshData(true)
  }

  // Export spreadsheet to CSV
  const handleExportExcel = () => {
    let csv = ''
    if (viewMode === 'single-day') {
      csv = [
        ['No', 'Eleve', 'Contact Parent', 'Niveau', 'Tarif', `Presence (${selectedDate})`, 'Total Seances', 'Cout Total (DTN)', 'Total Paye (DTN)', 'Dette (DTN)'].join(','),
        ...studentRows.map((r, i) =>
          [
            i + 1,
            `"${r.studentName}"`,
            `"${r.parentContact}"`,
            `"${r.gradeLevel}"`,
            `"${r.hourlyRate.toFixed(2)}${r.paymentType === 'hourly' ? '/h' : r.paymentType === 'session' ? '/séance' : '/mois'}"`,
            r.todayAttended ? 'PRESENT' : 'ABSENT',
            r.totalSessionsAttended,
            r.totalSessionsCost.toFixed(2),
            r.totalPayments.toFixed(2),
            r.debt.toFixed(2)
          ].join(',')
        )
      ].join('\n')
    } else {
      const datesToExport = viewMode === 'monthly-matrix' ? monthDates : weekDates
      const header = ['No', 'Eleve', 'Niveau', 'Tarif', ...datesToExport.map((w) => `"${w.dayName} ${w.label}"`), 'Seances', 'Cout Total', 'Paye', 'Dette'].join(',')
      csv = [
        header,
        ...matrixRows.map((r, i) =>
          [
            i + 1,
            `"${r.studentName}"`,
            `"${r.gradeLevel}"`,
            `"${r.hourlyRate.toFixed(2)}${r.paymentType === 'hourly' ? '/h' : r.paymentType === 'session' ? '/séance' : '/mois'}"`,
            ...datesToExport.map((w) => (r.attendanceByDate[w.dateStr]?.attended ? 'P' : '-')),
            r.totalSessionsAttended,
            r.totalSessionsCost.toFixed(2),
            r.totalPayments.toFixed(2),
            r.debt.toFixed(2)
          ].join(',')
        )
      ].join('\n')
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = viewMode === 'monthly-matrix' 
      ? `matrice_presence_mensuelle_${selectedDate.substring(0, 7)}.csv`
      : `feuille_presence_${selectedDate}.csv`
    a.click()
  }

  // Record Payment Submit
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetStudent) return
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('Montant invalide')
      return
    }

    await recordPayment(targetStudent.id, amt, paymentDate)
    showNotification(`Paiement de ${amt.toFixed(2)} DTN enregistré pour ${targetStudent.name}`)
    setPaymentModalOpen(false)
    setPaymentAmount('')
    setTargetStudent(null)
    window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
    await refreshData()
  }

  // Keyboard navigation & Shortcuts (P for present, A for absent, Space for toggle)
  const handleCellKeyDown = (
    e: React.KeyboardEvent,
    rowIdx: number,
    colIdx: number,
    totalRows: number,
    totalCols: number,
    onToggle?: () => void,
    onSetPresent?: () => void,
    onSetAbsent?: () => void
  ) => {
    let nextRow = rowIdx
    let nextCol = colIdx

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      nextRow = Math.max(0, rowIdx - 1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      nextRow = Math.min(totalRows - 1, rowIdx + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nextCol = Math.max(0, colIdx - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextCol = Math.min(totalCols - 1, colIdx + 1)
    } else if (e.key === ' ' || e.key === 'Enter') {
      if (onToggle) {
        e.preventDefault()
        onToggle()
      }
    } else if (e.key.toLowerCase() === 'p' || e.key === '1') {
      if (onSetPresent) {
        e.preventDefault()
        onSetPresent()
      }
    } else if (e.key.toLowerCase() === 'a' || e.key === '0') {
      if (onSetAbsent) {
        e.preventDefault()
        onSetAbsent()
      }
    } else {
      return
    }

    setActiveCell({ row: nextRow, col: nextCol })
    const targetEl = document.querySelector(
      `[data-excel-coord="${nextRow}-${nextCol}"]`
    ) as HTMLElement | null
    if (targetEl) targetEl.focus()
  }

  const [currentFilterType, currentFilterId] = selectedFilterId ? selectedFilterId.split(':') : [null, null]
  const activeTeacherId = currentFilterType === 'teacher' ? currentFilterId : groups.find(g => g.id === currentFilterId)?.teacher_id
  const activeTeacher = teachers.find((t) => t.id === activeTeacherId)

  // Current cell formula display
  const currentCellInfo = useMemo(() => {
    const colLetter = getColumnLetter(activeCell.col)
    const rowNum = activeCell.row + 1
    const cellCoord = `${colLetter}${rowNum}`

    if (viewMode === 'single-day') {
      const row = studentRows[activeCell.row]
      if (!row) return { coord: cellCoord, formula: '= READY()' }

      switch (activeCell.col) {
        case 0:
          return { coord: cellCoord, formula: `= ROW(${rowNum})` }
        case 1:
          return { coord: cellCoord, formula: `= STUDENT("${row.studentName}", Grade: "${row.gradeLevel}")` }
        case 2:
          return { coord: cellCoord, formula: `= CONTACT("${row.parentContact}")` }
        case 3:
          return { coord: cellCoord, formula: `= RATE(${row.hourlyRate} DTN/h)` }
        case 4:
          return {
            coord: cellCoord,
            formula: `= ATTENDANCE(Date: "${selectedDate}", Status: "${row.todayAttended ? 'PRESENT' : 'ABSENT'}", Rate: ${row.hourlyRate} DTN)`
          }
        case 5:
          return { coord: cellCoord, formula: `= SESSIONS_ATTENDED(Count: ${row.totalSessionsAttended})` }
        case 6:
          return { coord: cellCoord, formula: `= TOTAL_COST(${row.totalSessionsCost} DTN)` }
        case 7:
          return { coord: cellCoord, formula: `= TOTAL_PAYMENTS(${row.totalPayments} DTN)` }
        case 8:
          return {
            coord: cellCoord,
            formula: `= DEBT(${row.totalSessionsCost} - ${row.totalPayments} = ${row.debt > 0 ? '+' : ''}${row.debt.toFixed(2)} DTN)`
          }
        default:
          return { coord: cellCoord, formula: `= RECORD_PAYMENT_ACTION("${row.studentName}")` }
      }
    } else {
      const row = matrixRows[activeCell.row]
      if (!row) return { coord: cellCoord, formula: '= READY()' }
      return {
        coord: cellCoord,
        formula: `= MATRIX_CELL(Élève: "${row.studentName}", Dette: ${row.debt.toFixed(2)} DTN, Vue: ${viewMode === 'monthly-matrix' ? 'Mensuelle' : 'Hebdo'})`
      }
    }
  }, [activeCell, viewMode, studentRows, matrixRows, selectedDate])

  // Aggregate stats for Excel Status Bar
  const stats = useMemo(() => {
    const list = viewMode === 'single-day' ? studentRows : matrixRows
    const totalEnrolled = list.length
    let totalPresent = 0
    let totalDebt = 0

    if (viewMode === 'single-day') {
      totalPresent = studentRows.filter((r) => r.todayAttended).length
      totalDebt = studentRows.reduce((sum, r) => sum + (r.debt > 0 ? r.debt : 0), 0)
    } else {
      totalDebt = matrixRows.reduce((sum, r) => sum + (r.debt > 0 ? r.debt : 0), 0)
    }

    const attendanceRate = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0

    return { totalEnrolled, totalPresent, totalDebt, attendanceRate }
  }, [viewMode, studentRows, matrixRows])

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Toast Notification */}
      {notification && (
        <div className="toast-success">
          <UserCheck size={18} />
          {notification}
        </div>
      )}

      {/* Hero Banner */}
      <div className="page-hero hero-green fade-in">
        <div className="page-hero-content">
          <div className="page-hero-icon">
            <Calendar size={26} color="white" />
          </div>
          <div>
            <h1 className="page-hero-title">Fiche Journalière de Présence</h1>
            <p className="page-hero-subtitle">
              Enregistrez les présences, absences et paiements · Mise à jour en temps réel
            </p>
          </div>
        </div>
      </div>

      {/* 1. EXCEL RIBBON / TOOLBAR */}
      <div className="excel-ribbon">
        {/* Left: Teacher & Date Selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
          {/* Teacher Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Classe / Enseignant :
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input 
                  type="text" 
                  placeholder="Chercher..." 
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  style={{ 
                    padding: '4px 8px 4px 28px', 
                    fontSize: '13px', 
                    borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--color-border)', 
                    width: '130px',
                    backgroundColor: 'var(--color-surface)',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                />
              </div>
              <select
                id="excel-teacher-select"
                className="select-field"
                value={selectedFilterId}
                onChange={(e) => setSelectedFilterId(e.target.value)}
                style={{ minWidth: '220px', fontWeight: 600, padding: '4px 8px', fontSize: '13px' }}
              >
                {filteredTeachersForSelect.map((t) => {
                  const teacherGroups = groups.filter(g => g.teacher_id === t.id)
                  return (
                    <optgroup key={t.id} label={`${t.name} (${t.subject})`}>
                      <option value={`teacher:${t.id}`}>Tous les élèves</option>
                      {teacherGroups.map(g => (
                        <option key={g.id} value={`group:${g.id}`}>Groupe: {g.name}</option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>
            {activeTeacher && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600
                }}
              >
                {activeTeacher.subject} · {activeTeacher.payment_mode === 'per_student' ? `${activeTeacher.rate_per_student.toFixed(0)} DTN/élève` : `${(activeTeacher.monthly_rate_cut * 100).toFixed(0)}%`}
              </span>
            )}
          </div>

          {/* Date Navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => shiftDate(-1)}
              title={viewMode === 'monthly-matrix' ? 'Mois Précédent' : viewMode === 'weekly-matrix' ? 'Semaine Précédente' : 'Jour Précédent'}
            >
              <ChevronLeft size={14} />
            </button>
            
            {viewMode === 'monthly-matrix' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                <CalendarDays size={14} color="#4f46e5" />
                <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'capitalize' }}>
                  {currentMonthLabel}
                </span>
              </div>
            ) : (
              <input
                id="excel-date-picker"
                type="date"
                className="input-field"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: '130px', padding: '3px 6px', fontSize: '13px', fontWeight: 600 }}
              />
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => shiftDate(1)}
              title={viewMode === 'monthly-matrix' ? 'Mois Suivant' : viewMode === 'weekly-matrix' ? 'Semaine Suivante' : 'Jour Suivant'}
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={setDateToday}
              style={{ fontSize: '11px', fontWeight: 600 }}
            >
              Aujourd'hui
            </button>
          </div>
        </div>

        {/* Center: View Mode Toggle (3 Modes: Single Day, Weekly Matrix, Monthly Matrix) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface-muted)',
            padding: '2px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
          }}
        >
          <button
            id="view-toggle-single"
            type="button"
            onClick={() => setViewMode('single-day')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              border: 'none',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: viewMode === 'single-day' ? 700 : 500,
              backgroundColor: viewMode === 'single-day' ? 'var(--color-surface-raised)' : 'transparent',
              color: viewMode === 'single-day' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: viewMode === 'single-day' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer'
            }}
          >
            <Table size={13} aria-hidden="true" />
            Feuille Journalière
          </button>

          <button
            id="view-toggle-matrix"
            type="button"
            onClick={() => setViewMode('weekly-matrix')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              border: 'none',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: viewMode === 'weekly-matrix' ? 700 : 500,
              backgroundColor: viewMode === 'weekly-matrix' ? 'var(--color-surface-raised)' : 'transparent',
              color: viewMode === 'weekly-matrix' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: viewMode === 'weekly-matrix' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer'
            }}
          >
            <Columns size={13} aria-hidden="true" />
            Matrice Hebdo (Multi-Jours)
          </button>

          <button
            id="view-toggle-monthly"
            type="button"
            onClick={() => setViewMode('monthly-matrix')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              border: 'none',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: viewMode === 'monthly-matrix' ? 700 : 500,
              backgroundColor: viewMode === 'monthly-matrix' ? 'var(--color-surface-raised)' : 'transparent',
              color: viewMode === 'monthly-matrix' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: viewMode === 'monthly-matrix' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer'
            }}
          >
            <Calendar size={13} aria-hidden="true" />
            Matrice Mensuelle (Mois Complet)
          </button>
        </div>

        {/* Right: Quick Batch Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {viewMode === 'single-day' && (
            <>
              <button
                id="btn-batch-mark-present"
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleBatchMarkPresent}
                title="Cocher tous les élèves comme présents pour la date sélectionnée"
              >
                <CheckCheck size={14} color="var(--color-semantic-paid)" aria-hidden="true" />
                Marquer Tout Présent
              </button>

              <button
                id="btn-batch-mark-absent"
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleBatchMarkAbsent}
                title="Décocher toutes les présences"
              >
                <X size={14} color="var(--color-semantic-debt)" aria-hidden="true" />
                Tout Décocher
              </button>
            </>
          )}

          <button
            id="btn-export-excel"
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
          >
            <Download size={14} aria-hidden="true" />
            Exporter Excel (.csv)
          </button>
        </div>
      </div>

      {/* 2. EXCEL FORMULA BAR */}
      <div className="excel-formula-bar">
        <div className="excel-name-box" aria-label="Coordonnée de la cellule active">
          {currentCellInfo.coord}
        </div>
        <div className="excel-fx-icon">fx</div>
        <input
          type="text"
          readOnly
          className="excel-formula-input"
          value={currentCellInfo.formula}
          aria-label="Barre de formule Excel"
        />
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          Raccourcis : [Espace] ou [P]=Présent, [A]=Absent, [↑↓←→]=Navigation
        </span>
      </div>

      {/* 2.5. COLORFUL KPI SUMMARY CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-3)'
        }}
      >
        {/* Card 1: Total Enrolled */}
        <div
          style={{
            backgroundColor: '#eff6ff',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3)',
            border: '1px solid #bfdbfe',
            boxShadow: '0 1px 3px rgba(59, 130, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af', textTransform: 'uppercase' }}>
              Élèves Inscrits
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a8a' }}>
              {stats.totalEnrolled} élèves
            </div>
          </div>
        </div>

        {/* Card 2: Attendance Metric */}
        <div
          style={{
            backgroundColor: '#ecfdf5',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3)',
            border: '1px solid #a7f3d0',
            boxShadow: '0 1px 3px rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#065f46', textTransform: 'uppercase' }}>
              {viewMode === 'single-day' ? 'Présence du Jour' : viewMode === 'monthly-matrix' ? 'Période Mensuelle' : 'Période Hebdomadaire'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#064e3b' }}>
              {viewMode === 'single-day' ? `${stats.totalPresent} / ${stats.totalEnrolled} (${stats.attendanceRate}%)` : viewMode === 'monthly-matrix' ? `${monthDates.length} Jours` : '7 Jours'}
            </div>
          </div>
        </div>

        {/* Card 3: Total Group Debt */}
        <div
          style={{
            backgroundColor: stats.totalDebt > 0 ? '#fff1f2' : '#f0fdf4',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3)',
            border: `1px solid ${stats.totalDebt > 0 ? '#fecdd3' : '#bbf7d0'}`,
            boxShadow: '0 1px 3px rgba(225, 29, 72, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: stats.totalDebt > 0 ? '#e11d48' : '#16a34a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Coins size={20} />
          </div>
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: stats.totalDebt > 0 ? '#9f1239' : '#166534',
                textTransform: 'uppercase'
              }}
            >
              {stats.totalDebt > 0 ? 'Créances Restantes' : 'Solde Groupe'}
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: stats.totalDebt > 0 ? '#881337' : '#14532d'
              }}
            >
              {stats.totalDebt.toFixed(2)} DTN
            </div>
          </div>
        </div>
      </div>

      {/* 3. EXCEL SPREADSHEET GRID */}
      <div
        className="excel-grid-container"
        ref={gridContainerRef}
        role="region"
        aria-label="Tableau de présence Excel"
        tabIndex={-1}
        style={{ overflowX: 'auto' }}
      >
        {loading ? (
          <div className="empty-state">Chargement de la feuille de présence...</div>
        ) : (viewMode === 'single-day' && studentRows.length === 0) ||
          (viewMode !== 'single-day' && matrixRows.length === 0) ? (
          <div className="empty-state">
            <AlertCircle size={32} style={{ margin: '0 auto var(--space-2)' }} />
            <p style={{ margin: 0 }}>Aucun élève inscrit pour cet enseignant.</p>
          </div>
        ) : viewMode === 'single-day' ? (
          /* SINGLE-DAY EXCEL SPREADSHEET */
          <table
            id="excel-daily-table"
            className="excel-table"
            role="grid"
            aria-label="Feuille de présence journalière format Excel"
          >
            <thead>
              <tr>
                <th className="excel-header-corner" scope="col">
                  #
                </th>
                <th className="excel-col-header" scope="col">
                  <span className="excel-col-letter">A</span>
                  Élève (Nom & Prénom)
                </th>
                <th className="excel-col-header" scope="col">
                  <span className="excel-col-letter">B</span>
                  Niveau Scolaire
                </th>
                <th className="excel-col-header" scope="col">
                  <span className="excel-col-letter">C</span>
                  Contact Parent (+216)
                </th>
                <th className="excel-col-header" scope="col">
                  <span className="excel-col-letter">D</span>
                  Tarif/h (DTN)
                </th>
                <th
                  className="excel-col-header"
                  scope="col"
                  style={{ minWidth: '130px', textAlign: 'center' }}
                >
                  <span className="excel-col-letter">E</span>
                  Présence ({selectedDate})
                </th>
                <th className="excel-col-header" scope="col">
                  <span className="excel-col-letter">F</span>
                  Séances
                </th>
                <th className="excel-col-header" scope="col">
                  <span className="excel-col-letter">G</span>
                  Coût Total
                </th>
                <th className="excel-col-header" scope="col">
                  <span className="excel-col-letter">H</span>
                  Total Payé
                </th>
                <th className="excel-col-header" scope="col">
                  <span className="excel-col-letter">I</span>
                  Dette / Solde
                </th>
                <th className="excel-col-header" scope="col">
                  <span className="excel-col-letter">J</span>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map((row, rowIdx) => {
                const isRowActive = activeCell.row === rowIdx
                const totalCols = 10

                return (
                  <tr
                    key={row.enrollmentId}
                    style={{
                      backgroundColor: isRowActive ? '#f9fafb' : 'transparent'
                    }}
                  >
                    {/* Row Header Number */}
                    <td className="excel-row-header">{rowIdx + 1}</td>

                    {/* Col 0 (A): Student Name */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-0`}
                      className={`excel-cell ${isRowActive && activeCell.col === 0 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 0 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 0, studentRows.length, totalCols)}
                      style={{ fontWeight: 600 }}
                    >
                      {row.studentName}
                    </td>

                    {/* Col 1 (B): Grade Level */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-1`}
                      className={`excel-cell ${isRowActive && activeCell.col === 1 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 1 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 1, studentRows.length, totalCols)}
                      style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}
                    >
                      {row.gradeLevel}
                    </td>

                    {/* Col 2 (C): Parent Contact */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-2`}
                      className={`excel-cell ${isRowActive && activeCell.col === 2 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 2 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 2, studentRows.length, totalCols)}
                      style={{ fontSize: '12px', fontFamily: 'monospace' }}
                    >
                      {row.parentContact}
                    </td>

                    {/* Col 3 (D): Hourly Rate */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-3`}
                      className={`excel-cell ${isRowActive && activeCell.col === 3 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 3 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 3, studentRows.length, totalCols)}
                      style={{ textAlign: 'right', fontWeight: 500 }}
                    >
                      {row.hourlyRate.toFixed(2)} DTN{row.paymentType === 'hourly' ? '/h' : row.paymentType === 'session' ? '/séance' : '/mois'}
                    </td>

                    {/* Col 4 (E): Interactive Attendance Status Toggle */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-4`}
                      className={`excel-cell ${isRowActive && activeCell.col === 4 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 4 })}
                      onKeyDown={(e) =>
                        handleCellKeyDown(
                          e,
                          rowIdx,
                          4,
                          studentRows.length,
                          totalCols,
                          () => handleToggleAttendance(row.enrollmentId, row.studentName, selectedDate),
                          () => {
                            if (!row.todayAttended)
                              handleToggleAttendance(row.enrollmentId, row.studentName, selectedDate)
                          },
                          () => {
                            if (row.todayAttended)
                              handleToggleAttendance(row.enrollmentId, row.studentName, selectedDate)
                          }
                        )
                      }
                      style={{
                        textAlign: 'center',
                        backgroundColor: row.todayAttended ? '#f0fdf4' : '#fff1f2'
                      }}
                    >
                      <div
                        onClick={() => handleToggleAttendance(row.enrollmentId, row.studentName, selectedDate)}
                        className={row.todayAttended ? 'badge-attendance-present' : 'badge-attendance-absent'}
                        style={{
                          cursor: 'pointer',
                          userSelect: 'none',
                          boxShadow: row.todayAttended
                            ? '0 1px 3px rgba(21, 128, 61, 0.2)'
                            : '0 1px 3px rgba(185, 28, 28, 0.15)'
                        }}
                      >
                        <input
                          id={`excel-checkbox-${row.studentId}`}
                          type="checkbox"
                          checked={row.todayAttended}
                          onChange={() => handleToggleAttendance(row.enrollmentId, row.studentName, selectedDate)}
                          className="excel-cell-checkbox"
                          tabIndex={-1}
                          style={{ margin: 0 }}
                        />
                        <span>{row.todayAttended ? '✓ PRÉSENT' : '✗ ABSENT'}</span>
                      </div>
                    </td>

                    {/* Col 5 (F): Attended Sessions */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-5`}
                      className={`excel-cell ${isRowActive && activeCell.col === 5 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 5 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 5, studentRows.length, totalCols)}
                      style={{ textAlign: 'center', fontWeight: 600 }}
                    >
                      {row.totalSessionsAttended}
                    </td>

                    {/* Col 6 (G): Total Session Cost */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-6`}
                      className={`excel-cell ${isRowActive && activeCell.col === 6 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 6 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 6, studentRows.length, totalCols)}
                      style={{ textAlign: 'right', fontWeight: 500 }}
                    >
                      {row.totalSessionsCost.toFixed(2)} DTN
                    </td>

                    {/* Col 7 (H): Total Payments */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-7`}
                      className={`excel-cell ${isRowActive && activeCell.col === 7 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 7 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 7, studentRows.length, totalCols)}
                      style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-semantic-paid)' }}
                    >
                      {row.totalPayments.toFixed(2)} DTN
                    </td>

                    {/* Col 8 (I): Dynamically Calculated Student Debt */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-8`}
                      className={`excel-cell ${isRowActive && activeCell.col === 8 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 8 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 8, studentRows.length, totalCols)}
                      style={{ textAlign: 'right' }}
                    >
                      {row.debt > 0 ? (
                        <span
                          className="badge-debt"
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--color-semantic-debt)',
                            backgroundColor: 'var(--color-semantic-debt-bg)'
                          }}
                        >
                          +{row.debt.toFixed(2)} DTN
                        </span>
                      ) : (
                        <span
                          className="badge-paid"
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--color-semantic-paid)',
                            backgroundColor: 'var(--color-semantic-paid-bg)'
                          }}
                        >
                          {row.debt === 0 ? '0.00 DTN' : `${row.debt.toFixed(2)} DTN`}
                        </span>
                      )}
                    </td>

                    {/* Col 9 (J): Actions */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-9`}
                      className={`excel-cell ${isRowActive && activeCell.col === 9 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 9 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 9, studentRows.length, totalCols)}
                      style={{ textAlign: 'center' }}
                    >
                      <button
                        id={`excel-record-payment-${row.studentId}`}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}
                        onClick={() => {
                          setTargetStudent({ id: row.studentId, name: row.studentName, debt: row.debt })
                          setPaymentAmount(row.debt > 0 ? String(row.debt) : '100')
                          setPaymentModalOpen(true)
                        }}
                      >
                        <CreditCard size={12} aria-hidden="true" />
                        Record Payment
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          /* WEEKLY & MONTHLY MULTI-DAY ATTENDANCE MATRIX */
          <table
            id="excel-matrix-table"
            className="excel-table"
            role="grid"
            aria-label={`Matrice de présence ${viewMode === 'monthly-matrix' ? 'mensuelle' : 'hebdomadaire'} format Excel`}
          >
            <thead>
              <tr>
                <th className="excel-header-corner" scope="col">
                  #
                </th>
                <th className="excel-col-header" scope="col" style={{ minWidth: '150px' }}>
                  <span className="excel-col-letter">A</span>
                  Élève
                </th>
                <th className="excel-col-header" scope="col" style={{ minWidth: '110px' }}>
                  <span className="excel-col-letter">B</span>
                  Niveau
                </th>
                <th className="excel-col-header" scope="col" style={{ minWidth: '70px' }}>
                  <span className="excel-col-letter">C</span>
                  Tarif/h
                </th>

                {/* Days of the Week / Month Columns */}
                {activeMatrixDates.map((w, idx) => {
                  const isToday = w.dateStr === todayStr
                  return (
                    <th
                      key={w.dateStr}
                      className="excel-col-header"
                      scope="col"
                      style={{
                        minWidth: viewMode === 'monthly-matrix' ? '36px' : '70px',
                        padding: viewMode === 'monthly-matrix' ? '4px 2px' : undefined,
                        textAlign: 'center',
                        backgroundColor: isToday ? '#eff6ff' : w.isWeekend ? '#f8fafc' : undefined,
                        borderBottom: isToday ? '2px solid #3b82f6' : undefined
                      }}
                      title={`${w.dayName} ${w.dateStr}`}
                    >
                      <span className="excel-col-letter">{getColumnLetter(3 + idx)}</span>
                      <div style={{ fontSize: viewMode === 'monthly-matrix' ? '10px' : '12px', fontWeight: isToday ? 800 : 600, color: isToday ? '#2563eb' : undefined }}>
                        {viewMode === 'monthly-matrix' ? w.dayName.substring(0, 1) : w.dayName}
                      </div>
                      <div style={{ fontSize: viewMode === 'monthly-matrix' ? '11px' : '10px', fontWeight: isToday ? 800 : 500, color: isToday ? '#1d4ed8' : 'var(--color-text-muted)' }}>
                        {viewMode === 'monthly-matrix' ? w.dayNum : w.label}
                      </div>
                    </th>
                  )
                })}

                <th className="excel-col-header" scope="col" style={{ minWidth: '65px' }}>
                  <span className="excel-col-letter">{getColumnLetter(3 + activeMatrixDates.length)}</span>
                  Séances
                </th>
                <th className="excel-col-header" scope="col" style={{ minWidth: '85px' }}>
                  <span className="excel-col-letter">{getColumnLetter(3 + activeMatrixDates.length + 1)}</span>
                  Coût Total
                </th>
                <th className="excel-col-header" scope="col" style={{ minWidth: '85px' }}>
                  <span className="excel-col-letter">{getColumnLetter(3 + activeMatrixDates.length + 2)}</span>
                  Payé
                </th>
                <th className="excel-col-header" scope="col" style={{ minWidth: '95px' }}>
                  <span className="excel-col-letter">{getColumnLetter(3 + activeMatrixDates.length + 3)}</span>
                  Dette / Solde
                </th>
                <th className="excel-col-header" scope="col" style={{ minWidth: '75px' }}>
                  <span className="excel-col-letter">{getColumnLetter(3 + activeMatrixDates.length + 4)}</span>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row, rowIdx) => {
                const isRowActive = activeCell.row === rowIdx
                const totalCols = 3 + activeMatrixDates.length + 5

                return (
                  <tr key={row.enrollmentId} style={{ backgroundColor: isRowActive ? '#f9fafb' : 'transparent' }}>
                    <td className="excel-row-header">{rowIdx + 1}</td>

                    {/* Student Name */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-0`}
                      className={`excel-cell ${isRowActive && activeCell.col === 0 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 0 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 0, matrixRows.length, totalCols)}
                      style={{ fontWeight: 600 }}
                    >
                      {row.studentName}
                    </td>

                    {/* Grade Level */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-1`}
                      className={`excel-cell ${isRowActive && activeCell.col === 1 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 1 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 1, matrixRows.length, totalCols)}
                      style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}
                    >
                      {row.gradeLevel}
                    </td>

                    {/* Hourly Rate */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-2`}
                      className={`excel-cell ${isRowActive && activeCell.col === 2 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 2 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 2, matrixRows.length, totalCols)}
                      style={{ textAlign: 'right', fontWeight: 500 }}
                    >
                      {row.hourlyRate.toFixed(2)} DTN{row.paymentType === 'hourly' ? '/h' : row.paymentType === 'session' ? '/séance' : '/mois'}
                    </td>

                    {/* Days Attendance Checkbox Cells */}
                    {activeMatrixDates.map((w, dayIdx) => {
                      const colIndex = 3 + dayIdx
                      const cellData = row.attendanceByDate[w.dateStr] || { attended: false }
                      const isAttended = cellData.attended
                      const isToday = w.dateStr === todayStr

                      return (
                        <td
                          key={w.dateStr}
                          tabIndex={0}
                          role="gridcell"
                          data-excel-coord={`${rowIdx}-${colIndex}`}
                          className={`excel-cell ${isRowActive && activeCell.col === colIndex ? 'excel-cell-selected' : ''}`}
                          onFocus={() => setActiveCell({ row: rowIdx, col: colIndex })}
                          onKeyDown={(e) =>
                            handleCellKeyDown(
                              e,
                              rowIdx,
                              colIndex,
                              matrixRows.length,
                              totalCols,
                              () => handleToggleAttendance(row.enrollmentId, row.studentName, w.dateStr),
                              () => {
                                if (!isAttended)
                                  handleToggleAttendance(row.enrollmentId, row.studentName, w.dateStr)
                              },
                              () => {
                                if (isAttended)
                                  handleToggleAttendance(row.enrollmentId, row.studentName, w.dateStr)
                              }
                            )
                          }
                          style={{
                            textAlign: 'center',
                            padding: viewMode === 'monthly-matrix' ? '4px 1px' : undefined,
                            backgroundColor: isAttended
                              ? '#f0fdf4'
                              : isToday
                              ? '#f8fafc'
                              : w.isWeekend
                              ? '#fafafa'
                              : 'transparent',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleToggleAttendance(row.enrollmentId, row.studentName, w.dateStr)}
                          title={`${row.studentName} — ${w.dayName} ${w.dateStr} : ${isAttended ? 'Présent' : 'Absent'}`}
                        >
                          {isAttended ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: viewMode === 'monthly-matrix' ? '18px' : '22px',
                                height: viewMode === 'monthly-matrix' ? '18px' : '22px',
                                borderRadius: '50%',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: viewMode === 'monthly-matrix' ? '10px' : '12px',
                                boxShadow: '0 1px 3px rgba(16, 185, 129, 0.35)'
                              }}
                            >
                              ✓
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: viewMode === 'monthly-matrix' ? '16px' : '20px',
                                height: viewMode === 'monthly-matrix' ? '16px' : '20px',
                                borderRadius: '50%',
                                color: '#cbd5e1',
                                fontSize: viewMode === 'monthly-matrix' ? '9px' : '11px',
                                border: '1px dashed #e2e8f0'
                              }}
                            >
                              -
                            </span>
                          )}
                        </td>
                      )
                    })}

                    {/* Total Sessions Attended */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-${3 + activeMatrixDates.length}`}
                      className={`excel-cell ${isRowActive && activeCell.col === 3 + activeMatrixDates.length ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 3 + activeMatrixDates.length })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 3 + activeMatrixDates.length, matrixRows.length, totalCols)}
                      style={{ textAlign: 'center', fontWeight: 600 }}
                    >
                      {row.totalSessionsAttended}
                    </td>

                    {/* Total Cost */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-${3 + activeMatrixDates.length + 1}`}
                      className={`excel-cell ${isRowActive && activeCell.col === 3 + activeMatrixDates.length + 1 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 3 + activeMatrixDates.length + 1 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 3 + activeMatrixDates.length + 1, matrixRows.length, totalCols)}
                      style={{ textAlign: 'right', fontWeight: 500 }}
                    >
                      {row.totalSessionsCost.toFixed(2)} DTN
                    </td>

                    {/* Total Paid */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-${3 + activeMatrixDates.length + 2}`}
                      className={`excel-cell ${isRowActive && activeCell.col === 3 + activeMatrixDates.length + 2 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 3 + activeMatrixDates.length + 2 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 3 + activeMatrixDates.length + 2, matrixRows.length, totalCols)}
                      style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-semantic-paid)' }}
                    >
                      {row.totalPayments.toFixed(2)} DTN
                    </td>

                    {/* Debt / Solde */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-${3 + activeMatrixDates.length + 3}`}
                      className={`excel-cell ${isRowActive && activeCell.col === 3 + activeMatrixDates.length + 3 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 3 + activeMatrixDates.length + 3 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 3 + activeMatrixDates.length + 3, matrixRows.length, totalCols)}
                      style={{ textAlign: 'right' }}
                    >
                      {row.debt > 0 ? (
                        <span
                          className="badge-debt"
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--color-semantic-debt)',
                            backgroundColor: 'var(--color-semantic-debt-bg)'
                          }}
                        >
                          +{row.debt.toFixed(2)} DTN
                        </span>
                      ) : (
                        <span
                          className="badge-paid"
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--color-semantic-paid)',
                            backgroundColor: 'var(--color-semantic-paid-bg)'
                          }}
                        >
                          {row.debt === 0 ? '0.00 DTN' : `${row.debt.toFixed(2)} DTN`}
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td
                      tabIndex={0}
                      role="gridcell"
                      data-excel-coord={`${rowIdx}-${3 + activeMatrixDates.length + 4}`}
                      className={`excel-cell ${isRowActive && activeCell.col === 3 + activeMatrixDates.length + 4 ? 'excel-cell-selected' : ''}`}
                      onFocus={() => setActiveCell({ row: rowIdx, col: 3 + activeMatrixDates.length + 4 })}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 3 + activeMatrixDates.length + 4, matrixRows.length, totalCols)}
                      style={{ textAlign: 'center' }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                        onClick={() => {
                          setTargetStudent({ id: row.studentId, name: row.studentName, debt: row.debt })
                          setPaymentAmount(row.debt > 0 ? String(row.debt) : '100')
                          setPaymentModalOpen(true)
                        }}
                      >
                        Encaisser
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. EXCEL STATUS BAR */}
      <div className="excel-status-bar" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <span
            style={{
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600
            }}
          >
            Élèves inscrits : <strong>{stats.totalEnrolled}</strong>
          </span>
          {viewMode === 'single-day' && (
            <span
              style={{
                backgroundColor: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              Présents ce jour : <strong>{stats.totalPresent} ({stats.attendanceRate}%)</strong>
            </span>
          )}
        </div>

        <div>
          <span
            style={{
              backgroundColor: stats.totalDebt > 0 ? '#fee2e2' : '#dcfce7',
              color: stats.totalDebt > 0 ? '#b91c1c' : '#15803d',
              border: `1px solid ${stats.totalDebt > 0 ? '#fca5a5' : '#86efac'}`,
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            Total Créances Groupe : {stats.totalDebt.toFixed(2)} DTN
          </span>
        </div>
      </div>

      {/* Record Payment Modal */}
      {paymentModalOpen && targetStudent && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="excel-record-payment-title"
          onClick={() => setPaymentModalOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="excel-record-payment-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Enregistrer un Paiement
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

            <div
              style={{
                backgroundColor: 'var(--color-surface-muted)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Élève :</span>
                <span style={{ fontWeight: 600 }}>{targetStudent.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Dette actuelle :</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: targetStudent.debt > 0 ? 'var(--color-semantic-debt)' : 'var(--color-semantic-paid)'
                  }}
                >
                  {targetStudent.debt.toFixed(2)} DTN
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="excel-payment-amount" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Montant Reçu (DTN) * :
                </label>
                <input
                  id="excel-payment-amount"
                  type="number"
                  step="any"
                  min="1"
                  required
                  autoFocus
                  className="input-field"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="ex. 200"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="excel-payment-date" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Date d'Encaissement * :
                </label>
                <input
                  id="excel-payment-date"
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
                <button id="excel-btn-confirm-payment" type="submit" className="btn btn-primary">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
