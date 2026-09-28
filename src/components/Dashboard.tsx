import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getDatabase } from '../db/sqlite'
import type { ActiveTab } from './Header'
import type { TeacherPaymentMode } from '../types'
import {
  TrendingUp,
  DollarSign,
  Users,
  GraduationCap,
  Calendar,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserCheck,
  Percent,
  Coins,
  Building2,
  CalendarDays,
  Sparkles,
  PieChart as PieIcon,
  Flame,
  Phone,
  ClipboardCheck
} from 'lucide-react'
import { CompteRenduModal } from './CompteRenduModal'

interface DashboardProps {
  onNavigateTab: (tab: ActiveTab) => void
}

interface MonthlyDataPoint {
  month: string
  label: string
  revenue: number
  teacherPayout: number
  centerMargin: number
  collected: number
  sessions: number
}

interface TeacherMetric {
  id: string
  name: string
  subject: string
  monthly_rate_cut: number
  payment_mode?: TeacherPaymentMode
  rate_per_student?: number
  studentsCount: number
  attendedSessions: number
  revenue: number
  teacherPayout: number
  centerMargin: number
}

interface SubjectDistribution {
  subject: string
  count: number
  percentage: number
  color: string
}

interface StudentDebtor {
  id: string
  name: string
  parent_contact: string
  grade_level: string
  debt: number
  attendedSessions: number
}

interface RecentPayment {
  id: string
  student_name: string
  amount: number
  date: string
  grade_level: string
}

interface RoomStat {
  room: string
  count: number
  percentage: number
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateTab }) => {
  const [loading, setLoading] = useState<boolean>(true)
  const [compteRenduOpen, setCompteRenduOpen] = useState<boolean>(false)

  // Executive KPI state
  const [grossRevenue, setGrossRevenue] = useState<number>(0)
  const [teachersPayout, setTeachersPayout] = useState<number>(0)
  const [centerNetMargin, setCenterNetMargin] = useState<number>(0)
  const [totalCollected, setTotalCollected] = useState<number>(0)
  const [totalDebt, setTotalDebt] = useState<number>(0)
  const [totalAttendedSessions, setTotalAttendedSessions] = useState<number>(0)
  const [totalSessionsCount, setTotalSessionsCount] = useState<number>(0)
  const [attendanceRate, setAttendanceRate] = useState<number>(0)

  // Entity counts
  const [studentsCount, setStudentsCount] = useState<number>(0)
  const [teachersCount, setTeachersCount] = useState<number>(0)
  const [enrollmentsCount, setEnrollmentsCount] = useState<number>(0)
  const [timetableSlotsCount, setTimetableSlotsCount] = useState<number>(0)

  // Detailed datasets for charts & panels
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyDataPoint[]>([])
  const [teacherMetrics, setTeacherMetrics] = useState<TeacherMetric[]>([])
  const [subjectDist, setSubjectDist] = useState<SubjectDistribution[]>([])
  const [dayAttendance, setDayAttendance] = useState<{ day: string; count: number; percentage: number }[]>([])
  const [debtBrackets, setDebtBrackets] = useState<{ paidCount: number; lowDebt: number; midDebt: number; highDebt: number }>({
    paidCount: 0,
    lowDebt: 0,
    midDebt: 0,
    highDebt: 0
  })
  const [topDebtors, setTopDebtors] = useState<StudentDebtor[]>([])
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([])
  const [roomStats, setRoomStats] = useState<RoomStat[]>([])

  // Chart interactivity states
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null)
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null)

  const subjectColorMap: Record<string, string> = {
    'Mathématiques': '#3b82f6',
    'Sciences Physiques': '#06b6d4',
    'Physique-Chimie': '#06b6d4',
    'SVT': '#10b981',
    'Français': '#f59e0b',
    'Philosophie': '#8b5cf6',
    'Arabe': '#a855f7',
    'Anglais': '#ec4899',
    'Informatique': '#6366f1'
  }

  const getSubjectColor = (subject: string) => {
    return subjectColorMap[subject] || '#8b5cf6'
  }

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    const db = await getDatabase()

    try {
      // Query teachers first to compute exact payouts (percentage vs per_student)
      const tMetricStmt = await window.desktopApp.dbQuery(`
        WITH EnrollmentCosts AS (
          SELECT 
            e.teacher_id,
            e.id as enrollment_id,
            CASE 
              WHEN e.payment_type = 'monthly' THEN e.hourly_rate * COUNT(DISTINCT substr(s.date, 1, 7))
              WHEN e.payment_type = 'session' THEN SUM(e.hourly_rate)
              ELSE SUM(s.duration * e.hourly_rate)
            END as cost,
            COUNT(s.id) as sessions_count
          FROM Enrollments e
          JOIN Sessions s ON e.id = s.enrollment_id
          WHERE s.status = 'attended'
          GROUP BY e.id
        )
        SELECT 
          t.id,
          t.name,
          t.subject,
          t.monthly_rate_cut,
          t.payment_mode,
          t.rate_per_student,
          COUNT(DISTINCT ec.enrollment_id) as students_count,
          COALESCE(SUM(ec.sessions_count), 0) as attended_sessions,
          COALESCE(SUM(ec.cost), 0) as gross_revenue
        FROM Teachers t
        LEFT JOIN EnrollmentCosts ec ON t.id = ec.teacher_id
        GROUP BY t.id, t.name, t.subject, t.monthly_rate_cut, t.payment_mode, t.rate_per_student
        ORDER BY gross_revenue DESC;
      `, [])
      const tList: TeacherMetric[] = []
      let totalCalculatedTeacherCut = 0
      for (const obj of tMetricStmt) {
        const rev = Number(obj.gross_revenue || 0)
        const mode = String(obj.payment_mode || 'percentage') as TeacherPaymentMode
        const rateCut = Number(obj.monthly_rate_cut || 0)
        const ratePerStd = Number(obj.rate_per_student !== undefined && obj.rate_per_student !== null ? obj.rate_per_student : 50.0)
        const stdCount = Number(obj.students_count || 0)

        let payout = 0
        if (mode === 'per_student') {
          payout = stdCount * ratePerStd
        } else {
          payout = rev * rateCut
        }
        const margin = rev - payout
        totalCalculatedTeacherCut += payout

        tList.push({
          id: String(obj.id),
          name: String(obj.name),
          subject: String(obj.subject),
          monthly_rate_cut: rateCut,
          payment_mode: mode,
          rate_per_student: ratePerStd,
          studentsCount: stdCount,
          attendedSessions: Number(obj.attended_sessions || 0),
          revenue: rev,
          teacherPayout: payout,
          centerMargin: margin
        })
      }
            setTeacherMetrics(tList)

      // 1. Executive Totals from Sessions & Enrollments
      const revStmt = await window.desktopApp.dbQuery(`
        WITH EnrollmentCosts AS (
          SELECT 
            CASE 
              WHEN e.payment_type = 'monthly' THEN e.hourly_rate * COUNT(DISTINCT substr(s.date, 1, 7))
              WHEN e.payment_type = 'session' THEN SUM(e.hourly_rate)
              ELSE SUM(s.duration * e.hourly_rate)
            END as cost,
            COUNT(s.id) as attended_sessions
          FROM Enrollments e
          JOIN Sessions s ON e.id = s.enrollment_id
          WHERE s.status = 'attended'
          GROUP BY e.id
        )
        SELECT 
          COALESCE(SUM(cost), 0) as gross_revenue,
          COALESCE(SUM(attended_sessions), 0) as attended_sessions
        FROM EnrollmentCosts;
      `, [])
      let gross = 0
      let attended = 0
      if (revStmt.length > 0) {
        const obj = revStmt[0]
        gross = Number(obj.gross_revenue || 0)
        attended = Number(obj.attended_sessions || 0)
      }
            setGrossRevenue(gross)
      setTeachersPayout(totalCalculatedTeacherCut)
      setCenterNetMargin(gross - totalCalculatedTeacherCut)
      setTotalAttendedSessions(attended)

      // 2. Attendance Total & Rate
      const attStmt = await window.desktopApp.dbQuery(`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END), 0) as attended_count
        FROM Sessions;
      `, [])
      let totalSess = 0
      if (attStmt.length > 0) {
        const obj = attStmt[0]
        totalSess = Number(obj.total_count || 0)
      }
            setTotalSessionsCount(totalSess)
      setAttendanceRate(totalSess > 0 ? (attended / totalSess) * 100 : 100)

      // 3. Payments collected
      const payStmt = await window.desktopApp.dbQuery(`SELECT COALESCE(SUM(amount), 0) as total_collected FROM Payments;`, [])
      let collected = 0
      if (payStmt.length > 0) {
        collected = Number(payStmt[0].total_collected || 0)
      }
            setTotalCollected(collected)

      // 4. Entity Counts
      const sCountStmt = await window.desktopApp.dbQuery(`SELECT COUNT(*) as c FROM Students;`, [])
      
      const sCount = Number(sCountStmt[0].c || 0)
            setStudentsCount(sCount)

      const tCountStmt = await window.desktopApp.dbQuery(`SELECT COUNT(*) as c FROM Teachers;`, [])
      
      const tCount = Number(tCountStmt[0].c || 0)
            setTeachersCount(tCount)

      const eCountStmt = await window.desktopApp.dbQuery(`SELECT COUNT(*) as c FROM Enrollments;`, [])
      
      const eCount = Number(eCountStmt[0].c || 0)
            setEnrollmentsCount(eCount)

      const ttCountStmt = await window.desktopApp.dbQuery(`SELECT COUNT(*) as c FROM Timetable;`, [])
      const ttCount = Number(ttCountStmt[0].c || 0)
      setTimetableSlotsCount(ttCount)

      // 5. Individual Student Debts & Distribution
      const allStudentsStmt = await window.desktopApp.dbQuery(`SELECT id, name, parent_contact, grade_level FROM Students;`, [])
      const studentDebtList: StudentDebtor[] = []
      let aggregateDebt = 0
      let countPaid = 0
      let countLow = 0
      let countMid = 0
      let countHigh = 0

      for (const sObj of allStudentsStmt) {
        const sId = String(sObj.id)

        // Cost
        const costStmt = await window.desktopApp.dbQuery(`
          WITH EnrollmentCosts AS (
            SELECT 
              CASE 
                WHEN e.payment_type = 'monthly' THEN e.hourly_rate * COUNT(DISTINCT substr(s.date, 1, 7))
                WHEN e.payment_type = 'session' THEN SUM(e.hourly_rate)
                ELSE SUM(s.duration * e.hourly_rate)
              END as cost,
              COUNT(s.id) as sessions_count
            FROM Enrollments e
            JOIN Sessions s ON e.id = s.enrollment_id
            WHERE e.student_id = ? AND s.status = 'attended'
            GROUP BY e.id
          )
          SELECT COALESCE(SUM(cost), 0) as total_cost,
                 COALESCE(SUM(sessions_count), 0) as sessions_count
          FROM EnrollmentCosts;
        `, [sId])
        
        const cObj = costStmt[0]
        const totalCost = Number(cObj.total_cost || 0)
        const sessCount = Number(cObj.sessions_count || 0)
                // Paid
        const paidStmt = await window.desktopApp.dbQuery(`SELECT COALESCE(SUM(amount), 0) as total_paid FROM Payments WHERE student_id = ?;`, [sId])
        
        const totalPaid = Number(paidStmt[0].total_paid || 0)
                const debt = Number(Math.max(0, totalCost - totalPaid).toFixed(2))
        if (debt > 0) {
          aggregateDebt += debt
          if (debt < 100) countLow++
          else if (debt <= 300) countMid++
          else countHigh++
        } else {
          countPaid++
        }

        studentDebtList.push({
          id: sId,
          name: String(sObj.name),
          parent_contact: String(sObj.parent_contact),
          grade_level: String(sObj.grade_level),
          debt,
          attendedSessions: sessCount
        })
      }
            setTotalDebt(aggregateDebt)
      setDebtBrackets({
        paidCount: countPaid,
        lowDebt: countLow,
        midDebt: countMid,
        highDebt: countHigh
      })

      // Sort top debtors
      studentDebtList.sort((a, b) => b.debt - a.debt)
      setTopDebtors(studentDebtList.filter((s) => s.debt > 0).slice(0, 5))

      // 6. Monthly Trends (Sessions & Payments combined)
      const monthlyMap: Record<string, { revenue: number; teacherPayout: number; centerMargin: number; collected: number; sessions: number }> = {}

      const mRevStmt = await window.desktopApp.dbQuery(`
        WITH MonthlyCosts AS (
          SELECT 
            substr(s.date, 1, 7) as month,
            s.id as session_id,
            CASE 
              WHEN e.payment_type = 'monthly' THEN e.hourly_rate / COUNT(s.id) OVER (PARTITION BY e.id, substr(s.date, 1, 7))
              WHEN e.payment_type = 'session' THEN e.hourly_rate
              ELSE s.duration * e.hourly_rate
            END as cost,
            t.monthly_rate_cut
          FROM Sessions s
          JOIN Enrollments e ON s.enrollment_id = e.id
          JOIN Teachers t ON e.teacher_id = t.id
          WHERE s.status = 'attended'
        )
        SELECT 
          month,
          COALESCE(SUM(cost), 0) as revenue,
          COALESCE(SUM(cost * monthly_rate_cut), 0) as teacher_payout,
          COALESCE(SUM(cost * (1 - monthly_rate_cut)), 0) as center_margin,
          COUNT(session_id) as sessions
        FROM MonthlyCosts
        GROUP BY month
        ORDER BY month ASC;
      `, [])
      for (const obj of mRevStmt) {
        const m = String(obj.month)
        monthlyMap[m] = {
          revenue: Number(obj.revenue || 0),
          teacherPayout: Number(obj.teacher_payout || 0),
          centerMargin: Number(obj.center_margin || 0),
          collected: 0,
          sessions: Number(obj.sessions || 0)
        }
      }
            const mPayStmt = await window.desktopApp.dbQuery(`
        SELECT substr(date, 1, 7) as month, COALESCE(SUM(amount), 0) as paid
        FROM Payments
        GROUP BY month
        ORDER BY month ASC;
      `, [])
      for (const obj of mPayStmt) {
        const m = String(obj.month)
        if (!monthlyMap[m]) {
          monthlyMap[m] = { revenue: 0, teacherPayout: 0, centerMargin: 0, collected: 0, sessions: 0 }
        }
        monthlyMap[m].collected = Number(obj.paid || 0)
      }
            const monthNames: Record<string, string> = {
        '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr',
        '05': 'Mai', '06': 'Juin', '07': 'Juil', '08': 'Août',
        '09': 'Sept', '10': 'Oct', '11': 'Nov', '12': 'Déc'
      }

      const sortedMonths = Object.keys(monthlyMap).sort()
      const trendPoints: MonthlyDataPoint[] = sortedMonths.map((m) => {
        const parts = m.split('-')
        const label = `${monthNames[parts[1]] || parts[1]} ${parts[0]}`
        return {
          month: m,
          label,
          ...monthlyMap[m]
        }
      })
      setMonthlyTrends(trendPoints)

      // 8. Subject Distribution
      const subjStmt = await window.desktopApp.dbQuery(`
        SELECT t.subject, COUNT(e.id) as enrollments_count
        FROM Teachers t
        JOIN Enrollments e ON t.id = e.teacher_id
        GROUP BY t.subject
        ORDER BY enrollments_count DESC;
      `, [])
      let totalEnroll = 0
      const rawSubj: { subject: string; count: number }[] = []
      for (const obj of subjStmt) {
        const cnt = Number(obj.enrollments_count || 0)
        totalEnroll += cnt
        rawSubj.push({
          subject: String(obj.subject),
          count: cnt
        })
      }
            setSubjectDist(
        rawSubj.map((s) => ({
          subject: s.subject,
          count: s.count,
          percentage: totalEnroll > 0 ? (s.count / totalEnroll) * 100 : 0,
          color: getSubjectColor(s.subject)
        }))
      )

      // 9. Day of Week Attendance
      const dayOrder = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
      const dayCounts: Record<string, number> = {
        Lundi: 0, Mardi: 0, Mercredi: 0, Jeudi: 0, Vendredi: 0, Samedi: 0, Dimanche: 0
      }
      const dayStmt = await window.desktopApp.dbQuery(`
        SELECT day_of_week, COUNT(*) as c
        FROM Timetable
        GROUP BY day_of_week;
      `, [])
      let totalDaySlots = 0
      for (const obj of dayStmt) {
        const d = String(obj.day_of_week)
        const c = Number(obj.c || 0)
        if (dayCounts[d] !== undefined) {
          dayCounts[d] += c
          totalDaySlots += c
        }
      }
            setDayAttendance(
        dayOrder.map((d) => ({
          day: d,
          count: dayCounts[d],
          percentage: totalDaySlots > 0 ? Math.round((dayCounts[d] / totalDaySlots) * 100) : 0
        }))
      )

      // 10. Recent Payments
      const recPayStmt = await window.desktopApp.dbQuery(`
        SELECT p.id, p.amount, p.date, s.name as student_name, s.grade_level
        FROM Payments p
        JOIN Students s ON p.student_id = s.id
        ORDER BY p.date DESC, p.id DESC
        LIMIT 6;
      `, [])
      const recList: RecentPayment[] = []
      for (const obj of recPayStmt) {
        recList.push({
          id: String(obj.id),
          student_name: String(obj.student_name),
          amount: Number(obj.amount || 0),
          date: String(obj.date),
          grade_level: String(obj.grade_level)
        })
      }
            setRecentPayments(recList)

      // 11. Room Stats
      const roomStmt = await window.desktopApp.dbQuery(`
        SELECT room, COUNT(*) as c
        FROM Timetable
        GROUP BY room
        ORDER BY c DESC;
      `, [])
      let totalRoomsCount = 0
      const rawRooms: { room: string; count: number }[] = []
      for (const obj of roomStmt) {
        const c = Number(obj.c || 0)
        totalRoomsCount += c
        rawRooms.push({
          room: String(obj.room),
          count: c
        })
      }
            setRoomStats(
        rawRooms.map((r) => ({
          room: r.room,
          count: r.count,
          percentage: totalRoomsCount > 0 ? Math.round((r.count / totalRoomsCount) * 100) : 0
        }))
      )

    } catch (err) {
      console.error('Error loading dashboard analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()

    const handleUpdate = () => {
      loadDashboardData()
    }
    window.addEventListener('sqlite_attendance_updated', handleUpdate)
    return () => window.removeEventListener('sqlite_attendance_updated', handleUpdate)
  }, [loadDashboardData])

  // Computed recovery rate
  const recoveryRate = useMemo(() => {
    return grossRevenue > 0 ? Math.min(100, Math.round((totalCollected / grossRevenue) * 100)) : 100
  }, [grossRevenue, totalCollected])

  // Center profit margin percentage
  const profitMarginPercent = useMemo(() => {
    return grossRevenue > 0 ? Math.round((centerNetMargin / grossRevenue) * 100) : 30
  }, [grossRevenue, centerNetMargin])

  // Helper for rendering SVG Area Chart path
  const trendChartData = useMemo(() => {
    if (monthlyTrends.length === 0) return null
    const width = 640
    const height = 220
    const padX = 45
    const padY = 25
    const graphWidth = width - padX * 2
    const graphHeight = height - padY * 2

    const maxVal = Math.max(...monthlyTrends.map((d) => Math.max(d.revenue, d.collected, 500))) * 1.15

    const pointsRevenue = monthlyTrends.map((d, i) => {
      const x = padX + (i / Math.max(1, monthlyTrends.length - 1)) * graphWidth
      const y = height - padY - (d.revenue / maxVal) * graphHeight
      return { x, y, data: d }
    })

    const pointsCollected = monthlyTrends.map((d, i) => {
      const x = padX + (i / Math.max(1, monthlyTrends.length - 1)) * graphWidth
      const y = height - padY - (d.collected / maxVal) * graphHeight
      return { x, y, data: d }
    })

    const buildPath = (pts: { x: number; y: number }[]) => {
      if (pts.length === 0) return ''
      if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
      return pts.reduce((acc, pt, i, arr) => {
        if (i === 0) return `M ${pt.x},${pt.y}`
        const prev = arr[i - 1]
        const cx1 = prev.x + (pt.x - prev.x) / 2
        const cy1 = prev.y
        const cx2 = prev.x + (pt.x - prev.x) / 2
        const cy2 = pt.y
        return `${acc} C ${cx1},${cy1} ${cx2},${cy2} ${pt.x},${pt.y}`
      }, '')
    }

    const pathRevenue = buildPath(pointsRevenue)
    const areaRevenue = `${pathRevenue} L ${pointsRevenue[pointsRevenue.length - 1].x},${height - padY} L ${pointsRevenue[0].x},${height - padY} Z`

    const pathCollected = buildPath(pointsCollected)
    const areaCollected = `${pathCollected} L ${pointsCollected[pointsCollected.length - 1].x},${height - padY} L ${pointsCollected[0].x},${height - padY} Z`

    return {
      width,
      height,
      padX,
      padY,
      maxVal,
      pointsRevenue,
      pointsCollected,
      pathRevenue,
      areaRevenue,
      pathCollected,
      areaCollected
    }
  }, [monthlyTrends])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* 1. Header Banner & Quick Navigation Shortcuts */}
      <div className="page-hero hero-indigo fade-in">
        <div className="page-hero-content">
          <div className="page-hero-icon">
            <Sparkles size={26} color="white" />
          </div>
          <div>
            <h1 className="page-hero-title">Tableau de Bord Général</h1>
            <p className="page-hero-subtitle">
              Supervision globale · Rentabilité, encaissements, assiduité et répartition par matière
            </p>
          </div>
        </div>
        <div className="page-hero-actions">
          <button id="btn-dash-daily" type="button" className="btn-hero-outline" onClick={() => onNavigateTab('daily-sheet')}>
            <Calendar size={14} /> Présence
          </button>
          <button id="btn-dash-tracker" type="button" className="btn-hero-outline" onClick={() => onNavigateTab('teacher-students')}>
            <UserCheck size={14} /> Suivi
          </button>
          <button id="btn-dash-finance" type="button" className="btn-hero-outline" onClick={() => onNavigateTab('financial-rollup')}>
            <DollarSign size={14} /> Finances
          </button>
          <button id="btn-dash-students" type="button" className="btn-hero-outline" onClick={() => onNavigateTab('students')}>
            <GraduationCap size={14} /> Élèves ({studentsCount})
          </button>
          <button id="btn-dash-compte-rendu" type="button" className="btn-hero" onClick={() => setCompteRenduOpen(true)}>
            <ClipboardCheck size={14} /> Compte Rendu
          </button>
        </div>
      </div>

      {/* 2. Top Executive 6 KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-3)'
        }}
      >
        {/* KPI 1: Chiffre d'Affaires Brut */}
        <div className="card-kpi card-kpi-blue" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Chiffre d'Affaires Brut
            </span>
            <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', width: '32px', height: '32px' }}>
              <TrendingUp size={16} aria-hidden="true" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e40af' }}>
              {grossRevenue.toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 600 }}>DTN</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <CheckCircle2 size={11} color="#2563eb" />
              <span>Total valorisé des séances suivies</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Règlements Encaissés */}
        <div className="card-kpi card-kpi-green" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Règlements Encaissés
            </span>
            <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', width: '32px', height: '32px' }}>
              <CreditCard size={16} aria-hidden="true" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#15803d' }}>
              {totalCollected.toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 600 }}>DTN</span>
            </div>
            {/* Recovery Rate Progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <div style={{ flex: 1, height: '5px', backgroundColor: '#dcfce7', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, recoveryRate)}%`, height: '100%', backgroundColor: '#10b981' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857' }}>
                {recoveryRate}% recouvré
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Créances Élèves en Souffrance */}
        <div className="card-kpi card-kpi-rose" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Créances à Recouvrer
            </span>
            <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff', width: '32px', height: '32px' }}>
              <Coins size={16} aria-hidden="true" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: totalDebt > 0 ? '#be123c' : '#15803d' }}>
              {totalDebt.toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 600 }}>DTN</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <AlertCircle size={11} color="#e11d48" />
              <span>{topDebtors.length} élève(s) avec solde débiteur</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Part Enseignants Contractuelle */}
        <div className="card-kpi card-kpi-purple" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Part Enseignants
            </span>
            <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', width: '32px', height: '32px' }}>
              <Users size={16} aria-hidden="true" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#6d28d9' }}>
              {teachersPayout.toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 600 }}>DTN</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Quotes-parts conventionnées ({teachersCount} professeurs)
            </div>
          </div>
        </div>

        {/* KPI 5: Marge Nette Conservée par le Centre */}
        <div className="card-kpi card-kpi-teal" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Marge Nette Centre
            </span>
            <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#fff', width: '32px', height: '32px' }}>
              <Percent size={16} aria-hidden="true" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f766e' }}>
              {centerNetMargin.toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 600 }}>DTN</span>
            </div>
            <div style={{ fontSize: '11px', color: '#0d9488', fontWeight: 600, marginTop: '2px' }}>
              Rendement net : {profitMarginPercent}% du chiffre d'affaires
            </div>
          </div>
        </div>

        {/* KPI 6: Taux d'Assiduité Global */}
        <div className="card-kpi card-kpi-amber" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Taux d'Assiduité
            </span>
            <div className="icon-bubble" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', width: '32px', height: '32px' }}>
              <Clock size={16} aria-hidden="true" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#92400e' }}>
              {attendanceRate.toFixed(1)}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {totalAttendedSessions} séance(s) validée(s)
            </div>
          </div>
        </div>
      </div>

      {/* 3. ROW 1: Visual Charts (Financial Trends Curve + Subject Distribution Donut) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 'var(--space-4)'
        }}
      >
        {/* Chart 1: Financial & Recovery Trends (Area / Curve) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} color="#3b82f6" />
                Évolution Financière & Recouvrement
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Comparaison entre le Chiffre d'Affaires généré et les Versements encaissés
              </p>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3b82f6' }} />
                Chiffre d'Affaires
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#10b981' }} />
                Encaissements
              </span>
            </div>
          </div>

          {/* SVG Area Curve Chart */}
          {trendChartData ? (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <svg
                viewBox={`0 0 ${trendChartData.width} ${trendChartData.height}`}
                style={{ width: '100%', height: 'auto', minWidth: '380px' }}
                aria-label="Graphique d'évolution financière mensuelle"
              >
                <defs>
                  {/* Revenue Gradient */}
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                  {/* Collected Gradient */}
                  <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                {[0.25, 0.5, 0.75, 1.0].map((pct, idx) => {
                  const y = trendChartData.height - trendChartData.padY - pct * (trendChartData.height - trendChartData.padY * 2)
                  const val = Math.round(pct * trendChartData.maxVal)
                  return (
                    <g key={idx}>
                      <line
                        x1={trendChartData.padX}
                        y1={y}
                        x2={trendChartData.width - trendChartData.padX}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={trendChartData.padX - 6}
                        y={y + 3}
                        fontSize="9"
                        fill="#94a3b8"
                        textAnchor="end"
                        fontWeight="500"
                      >
                        {val}
                      </text>
                    </g>
                  )
                })}

                {/* Base Axis Line */}
                <line
                  x1={trendChartData.padX}
                  y1={trendChartData.height - trendChartData.padY}
                  x2={trendChartData.width - trendChartData.padX}
                  y2={trendChartData.height - trendChartData.padY}
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />

                {/* Area Fills */}
                <path d={trendChartData.areaRevenue} fill="url(#gradRevenue)" />
                <path d={trendChartData.areaCollected} fill="url(#gradCollected)" />

                {/* Lines */}
                <path
                  d={trendChartData.pathRevenue}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d={trendChartData.pathCollected}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Interactive Points & X Labels */}
                {trendChartData.pointsRevenue.map((pt, i) => {
                  const cPt = trendChartData.pointsCollected[i]
                  const isHovered = hoveredTrendIdx === i
                  return (
                    <g key={i}>
                      {/* X Axis Label */}
                      <text
                        x={pt.x}
                        y={trendChartData.height - 6}
                        fontSize="10"
                        fill="#64748b"
                        textAnchor="middle"
                        fontWeight={isHovered ? '700' : '500'}
                      >
                        {pt.data.label}
                      </text>

                      {/* Revenue Point */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 6 : 4}
                        fill="#ffffff"
                        stroke="#3b82f6"
                        strokeWidth={isHovered ? 3 : 2}
                        style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={() => setHoveredTrendIdx(i)}
                        onMouseLeave={() => setHoveredTrendIdx(null)}
                      />

                      {/* Collected Point */}
                      <circle
                        cx={cPt.x}
                        cy={cPt.y}
                        r={isHovered ? 6 : 4}
                        fill="#ffffff"
                        stroke="#10b981"
                        strokeWidth={isHovered ? 3 : 2}
                        style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={() => setHoveredTrendIdx(i)}
                        onMouseLeave={() => setHoveredTrendIdx(null)}
                      />

                      {/* Tooltip on hover */}
                      {isHovered && (
                        <g style={{ pointerEvents: 'none' }}>
                          <rect
                            x={Math.min(trendChartData.width - 130, Math.max(10, pt.x - 60))}
                            y={Math.max(8, pt.y - 48)}
                            width="120"
                            height="40"
                            rx="6"
                            fill="#1e293b"
                            opacity="0.95"
                          />
                          <text
                            x={Math.min(trendChartData.width - 130, Math.max(10, pt.x - 60)) + 60}
                            y={Math.max(8, pt.y - 48) + 15}
                            fill="#93c5fd"
                            fontSize="9"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            CA: {pt.data.revenue.toFixed(0)} DTN
                          </text>
                          <text
                            x={Math.min(trendChartData.width - 130, Math.max(10, pt.x - 60)) + 60}
                            y={Math.max(8, pt.y - 48) + 30}
                            fill="#86efac"
                            fontSize="9"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            Reçu: {pt.data.collected.toFixed(0)} DTN
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>
          ) : (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Données de tendance insuffisantes.
            </div>
          )}
        </div>

        {/* Chart 2: Subject Distribution (Interactive SVG Donut) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PieIcon size={16} color="#8b5cf6" />
              Répartition des Inscriptions par Matière
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Part des élèves inscrits dans chaque discipline enseignée
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            {/* SVG Donut */}
            <div style={{ position: 'relative', width: '160px', height: '160px' }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                {(() => {
                  let accumulatedPercent = 0
                  return subjectDist.map((subj, idx) => {
                    const strokeDasharray = `${subj.percentage} ${100 - subj.percentage}`
                    const strokeDashoffset = -accumulatedPercent
                    accumulatedPercent += subj.percentage
                    const isHovered = hoveredSubject === subj.subject

                    return (
                      <circle
                        key={idx}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={subj.color}
                        strokeWidth={isHovered ? '18' : '14'}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        pathLength="100"
                        style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease' }}
                        onMouseEnter={() => setHoveredSubject(subj.subject)}
                        onMouseLeave={() => setHoveredSubject(null)}
                      />
                    )
                  })
                })()}
              </svg>

              {/* Center Donut Hole Text */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {enrollmentsCount}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Inscriptions
                </span>
              </div>
            </div>

            {/* Donut Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '170px' }}>
              {subjectDist.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: hoveredSubject === s.subject ? '#f1f5f9' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={() => setHoveredSubject(s.subject)}
                  onMouseLeave={() => setHoveredSubject(null)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: s.color }} />
                    <span style={{ fontWeight: 600 }}>{s.subject}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{s.count}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>({s.percentage.toFixed(0)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. ROW 2: Teacher Performance & Day Attendance */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 'var(--space-4)'
        }}
      >
        {/* Teacher Financial Performance Horizontal Bars */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} color="#e11d48" />
                Top 5 Performances Financières par Enseignant
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Quote-part enseignant vs Marge nette centre (DTN)
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('teachers')}
              style={{ fontSize: '11px', padding: '2px 6px' }}
            >
              Gérer
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {teacherMetrics.slice(0, 5).map((t) => {
              const maxRev = Math.max(...teacherMetrics.map((m) => m.revenue), 1)
              const barWidthPct = Math.max(5, (t.revenue / maxRev) * 100)

              return (
                <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{t.name}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          fontWeight: 600
                        }}
                      >
                        {t.subject}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', fontWeight: 700 }}>
                      <span style={{ color: '#1e40af' }}>{t.revenue.toFixed(0)} DTN</span>
                    </div>
                  </div>

                  {/* Dual Segmented Progress Bar */}
                  <div
                    style={{
                      height: '10px',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      display: 'flex',
                      width: `${barWidthPct}%`,
                      transition: 'width 0.4s ease'
                    }}
                  >
                    {/* Teacher portion */}
                    <div
                      style={{
                        width: t.revenue > 0 ? `${Math.min(100, (t.teacherPayout / t.revenue) * 100)}%` : '50%',
                        backgroundColor: '#8b5cf6'
                      }}
                      title={`Part Prof: ${t.teacherPayout.toFixed(2)} DTN`}
                    />
                    {/* Center portion */}
                    <div
                      style={{
                        width: t.revenue > 0 ? `${Math.max(0, (t.centerMargin / t.revenue) * 100)}%` : '50%',
                        backgroundColor: '#10b981'
                      }}
                      title={`Marge Centre: ${t.centerMargin.toFixed(2)} DTN`}
                    />
                  </div>

                  {/* Subtitle breakdown */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    <span>
                      Part Prof: <strong>{t.teacherPayout.toFixed(0)} DTN</strong>{' '}
                      ({t.payment_mode === 'per_student' ? `${t.rate_per_student?.toFixed(0)} DTN/él` : `${(t.monthly_rate_cut * 100).toFixed(0)}%`})
                    </span>
                    <span>Marge Centre: <strong>{t.centerMargin.toFixed(0)} DTN</strong></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Day of Week Weekly Schedule Distribution */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CalendarDays size={16} color="#d97706" />
                Fréquentation Hebdomadaire (Emploi du Temps)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Volume de créneaux et cours planifiés par jour de la semaine
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('timetable')}
              style={{ fontSize: '11px', padding: '2px 6px' }}
            >
              Planning
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: '160px',
              padding: '10px 0',
              gap: '8px'
            }}
          >
            {dayAttendance.map((d, idx) => {
              const maxCount = Math.max(...dayAttendance.map((item) => item.count), 1)
              const barHeightPct = Math.max(8, (d.count / maxCount) * 100)
              const isPeak = d.count === maxCount && d.count > 0

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1,
                    gap: '6px',
                    height: '100%',
                    justifyContent: 'flex-end'
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: isPeak ? '#d97706' : '#64748b' }}>
                    {d.count}
                  </span>

                  <div
                    style={{
                      width: '100%',
                      maxWidth: '32px',
                      height: `${barHeightPct}%`,
                      backgroundColor: isPeak ? '#f59e0b' : '#cbd5e1',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease, background-color 0.2s',
                      boxShadow: isPeak ? '0 2px 6px rgba(245, 158, 11, 0.3)' : 'none'
                    }}
                    title={`${d.day}: ${d.count} créneau(x) planifié(s)`}
                  />

                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    {d.day.substring(0, 3)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Quick Rooms Utilization Badge Row */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '8px',
              borderTop: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px'
            }}
          >
            <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Building2 size={13} /> Salles de cours :
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {roomStats.map((r, i) => (
                <span
                  key={i}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#fffbeb',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    fontWeight: 600,
                    fontSize: '10px'
                  }}
                >
                  {r.room} ({r.count})
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. ROW 3: Actionable Intelligence & Recents (Top Debtors + Debt Segments + Recent Payments) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 'var(--space-4)'
        }}
      >
        {/* Top Debtors Priority Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={16} color="#e11d48" />
                Top Créances Élèves à Recouvrer
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Priorité des relances parents avec indicatif tunisien (+216)
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('students')}
              style={{ fontSize: '11px', padding: '2px 6px' }}
            >
              Tous
            </button>
          </div>

          {topDebtors.length === 0 ? (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: '#15803d', fontWeight: 600, fontSize: '13px' }}>
              ✓ Aucune créance en souffrance ! Tous les comptes sont en règle.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topDebtors.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#fff1f2',
                    border: '1px solid #fecdd3'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#9f1239' }}>{s.name}</span>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={10} /> {s.parent_contact} • {s.grade_level}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 800,
                        color: '#be123c'
                      }}
                    >
                      +{s.debt.toFixed(2)} DTN
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => onNavigateTab('students')}
                      title="Encaisser dans la gestion des élèves"
                    >
                      Encaisser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments Feed */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={16} color="#059669" />
                Derniers Règlements Encaissés
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Journal d'activité des encaissements en temps réel
              </p>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#047857' }}>
              Total : {totalCollected.toFixed(0)} DTN
            </span>
          </div>

          {recentPayments.length === 0 ? (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Aucun versement enregistré pour le moment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentPayments.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#166534' }}>{p.student_name}</span>
                    <span style={{ fontSize: '11px', color: '#475569' }}>
                      Reçu {p.id} • Date : {p.date}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#15803d',
                      backgroundColor: '#dcfce7',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: '1px solid #86efac'
                    }}
                  >
                    +{p.amount.toFixed(2)} DTN
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Official Printable Compte Rendu Modal */}
      {compteRenduOpen && (
        <CompteRenduModal
          type="center"
          onClose={() => setCompteRenduOpen(false)}
        />
      )}
    </div>
  )
}
