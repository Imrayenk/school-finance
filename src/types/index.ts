export type DayOfWeek =
  | 'Lundi'
  | 'Mardi'
  | 'Mercredi'
  | 'Jeudi'
  | 'Vendredi'
  | 'Samedi'
  | 'Dimanche'

export type TeacherPaymentMode = 'percentage' | 'per_student'

export interface Teacher {
  id: string
  name: string
  subject: string
  monthly_rate_cut: number // e.g. 0.70 = 70% share when payment_mode is 'percentage'
  payment_mode: TeacherPaymentMode // 'percentage' | 'per_student'
  rate_per_student: number // e.g. 50 DTN per student when payment_mode is 'per_student'
  phone?: string
}

export interface Student {
  id: string
  name: string
  parent_contact: string
  grade_level: string
  has_paid_inscription: boolean
}

export type PaymentType = 'hourly' | 'session' | 'monthly'

export interface Group {
  id: string
  name: string
  teacher_id: string
  teacher_name?: string
  student_count?: number
}

export interface Enrollment {
  id: string
  student_id: string
  teacher_id: string
  group_id?: string
  hourly_rate: number
  payment_type: PaymentType
}

export interface Session {
  id: string
  enrollment_id: string
  date: string // YYYY-MM-DD
  duration: number // e.g. 1.0, 1.5
  status: 'attended' | 'absent' | 'cancelled'
}

export interface Payment {
  id: string
  student_id: string
  amount: number
  date: string // YYYY-MM-DD
}

export type TeacherPaymentStatus = 'paid' | 'partial' | 'unpaid' | 'overpaid'

export interface TeacherPayout {
  id: string
  teacher_id: string
  amount: number
  date: string // YYYY-MM-DD
  payment_method: string // 'Espèces' | 'Virement Bancaire' | 'Chèque' | 'Autre'
  notes?: string
  period_month?: string // e.g. '2026-09'
}

export interface TimetableRecord {
  id: string
  teacher_id: string
  student_id?: string // Nullable now, can be for a group
  group_id?: string // Link to a group
  day_of_week: DayOfWeek
  start_time: string // HH:mm
  end_time: string // HH:mm
  room?: string
}

export interface Classroom {
  id: string
  name: string
}

export interface EnrolledStudentRow {
  enrollmentId: string
  studentId: string
  studentName: string
  parentContact: string
  gradeLevel: string
  teacherId: string
  teacherName: string
  groupId?: string
  groupName?: string
  subject: string
  hourlyRate: number
  paymentType: PaymentType
  // Daily Attendance status on selected date
  todaySessionId?: string
  todayAttended: boolean
  todayDuration?: number
  // Single Source of Truth Calculated Financials
  totalSessionsAttended: number
  totalSessionsCost: number
  totalPayments: number
  debt: number // (totalSessionsAttended * hourlyRate) - totalPayments
  isPaidInFull: boolean
}

export interface MatrixAttendanceCell {
  date: string
  sessionId?: string
  attended: boolean
  duration: number
}

export interface MatrixStudentRow {
  enrollmentId: string
  studentId: string
  studentName: string
  parentContact: string
  gradeLevel: string
  hourlyRate: number
  paymentType: PaymentType
  teacherId: string
  teacherName: string
  groupId?: string
  groupName?: string
  subject: string
  attendanceByDate: Record<string, MatrixAttendanceCell>
  totalSessionsAttended: number
  totalSessionsCost: number
  totalPayments: number
  debt: number
  isPaidInFull: boolean
}

export interface TeacherMonthlyFinancial {
  teacherId: string
  teacherName: string
  subject: string
  monthlyRateCut: number
  paymentMode: TeacherPaymentMode
  ratePerStudent: number
  activeStudentsCount: number
  sessionsCount: number
  totalSessionCosts: number
  teacherPayoutCut: number // calculated by % or per student (earned amount)
  centerRetainedMargin: number // totalSessionCosts - teacherPayoutCut
  totalPaid: number // total amount disbursed to teacher
  remainingBalance: number // teacherPayoutCut - totalPaid (positive = centre owes teacher, negative = advance/overpaid)
  paymentStatus: TeacherPaymentStatus
  lastPaymentDate?: string
}

export interface MonthlyFinancialSummary {
  month: number
  year: number
  teachers: TeacherMonthlyFinancial[]
  totalCenterRevenue: number
  totalTeacherPayouts: number
  totalCenterMargin: number
  totalTeacherPaid: number
  totalTeacherRemainingDue: number
  studentsPaidCount: number
  studentsInDebtCount: number
  totalOutstandingDebt: number
}

export interface ScheduleConflict {
  type: 'room' | 'student' | 'teacher'
  entryId1: string
  entryId2: string
  description: string
}

export interface TeacherStudentReportRow {
  enrollmentId: string
  studentId: string
  studentName: string
  gradeLevel: string
  parentContact: string
  teacherId: string
  teacherName: string
  subject: string
  hourlyRate: number
  paymentType: PaymentType
  teacherStudentPayout?: number
  sessionsStudied: number
  totalSessionsCost: number
  totalPaid: number
  debt: number
  isPaidInFull: boolean
  lastAttendedDate?: string
  teacherPaymentMode?: TeacherPaymentMode
}

export interface TeacherSummaryOverview {
  teacher: Teacher
  studentsCount: number
  totalSessionsStudied: number
  totalRevenue: number
  teacherPayoutCut: number
  centerRetainedMargin: number
  totalStudentDebt: number
  totalStudentPaid: number
  students: TeacherStudentReportRow[]
  teacherTotalPaid: number
  teacherRemainingBalance: number
  teacherPaymentStatus: TeacherPaymentStatus
  teacherPayouts: TeacherPayout[]
}

export interface GlobalSearchResult {
  type: 'student' | 'teacher' | 'group'
  id: string
  name: string
  extra: string
}

