import type {
  Teacher,
  TeacherPaymentMode,
  TeacherPaymentStatus,
  TeacherPayout,
  Student,
  Enrollment,
  Session,
  Payment,
  TimetableRecord,
  Classroom,
  EnrolledStudentRow,
  PaymentType,
  MonthlyFinancialSummary,
  TeacherMonthlyFinancial,
  ScheduleConflict,
  DayOfWeek,
  MatrixAttendanceCell,
  MatrixStudentRow,
  TeacherStudentReportRow,
  TeacherSummaryOverview,
  GlobalSearchResult
} from '../types'
import { getAppSettings } from '../services/settingsService'

export type Database = any

const isBrowser = typeof window !== 'undefined'

const STORAGE_KEY = 'soutien_scolaire_sqlite_db'

import initSqlJs from 'sql.js'

// Fallback for browser (Vite dev server) to prevent crashes
let browserDbPromise: Promise<any> | null = null

if (typeof window !== 'undefined' && !(window as any).desktopApp) {
  console.warn('Running in browser without Electron environment. Using sql.js mock.')
  
  browserDbPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: (file) => `/${file}`
    })
    const saved = localStorage.getItem('sqljs_db')
    if (saved) {
      try {
        const u8 = new Uint8Array(JSON.parse(saved))
        return new SQL.Database(u8)
      } catch (err) {
        console.error('Failed to restore sql.js DB', err)
      }
    }
    return new SQL.Database()
  })();

  const saveDb = async () => {
    const db = await browserDbPromise
    if (db) {
      const data = db.export()
      localStorage.setItem('sqljs_db', JSON.stringify(Array.from(data)))
    }
  }

  ;(window as any).desktopApp = {
    selectDirectory: async () => ({ success: true, path: '/mock/backup/folder' }),
    dbQuery: async (sql: string, params: any[] = []) => {
      const db = await browserDbPromise
      if (!db) return []
      try {
        const stmt = db.prepare(sql)
        stmt.bind(params)
        const results = []
        while (stmt.step()) {
          results.push(stmt.getAsObject())
        }
        stmt.free()
        return results
      } catch (err) {
        console.error('dbQuery error', err)
        throw err
      }
    },
    dbRun: async (sql: string, params: any[] = []) => {
      const db = await browserDbPromise
      if (db) {
        db.run(sql, params)
        await saveDb()
      }
    },
    dbExec: async (sql: string) => {
      const db = await browserDbPromise
      if (!db) return []
      return db.exec(sql)
    }
  }
}

let dbInstancePromise: Promise<any> | null = null

export function getDatabase(): Promise<any> {
  if (dbInstancePromise) return dbInstancePromise

  dbInstancePromise = (async () => {
    if (typeof window !== 'undefined' && window.desktopApp) {
      await initSchema(null)
      await migrateSchema(null)
      return window.desktopApp
    }
    return true
  })()

  return dbInstancePromise
}

async function migrateSchema(db: any) {
  try {
    // 1. Teachers: payment_mode
    const teachersInfo: any = await window.desktopApp.dbExec("PRAGMA table_info('Teachers')")
    const hasPaymentMode = teachersInfo[0]?.values?.some((col: any) => col[1] === 'payment_mode')
    if (!hasPaymentMode) {
      await window.desktopApp.dbRun("ALTER TABLE Teachers ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'percentage';")
      console.log('Migration: Added payment_mode to Teachers')
    }

    const hasTeacherPhone = teachersInfo[0]?.values?.some((col: any) => col[1] === 'phone')
    if (!hasTeacherPhone) {
      await window.desktopApp.dbRun("ALTER TABLE Teachers ADD COLUMN phone TEXT DEFAULT '';")
      console.log('Migration: Added phone to Teachers')
    }

    // 2. Teachers: rate_per_student
    const hasRatePerStudent = teachersInfo[0]?.values?.some((col: any) => col[1] === 'rate_per_student')
    if (!hasRatePerStudent) {
      await window.desktopApp.dbRun("ALTER TABLE Teachers ADD COLUMN rate_per_student REAL NOT NULL DEFAULT 50.0;")
      console.log('Migration: Added rate_per_student to Teachers')
    }

    // 3. Students: has_paid_inscription
    const studentsInfo: any = await window.desktopApp.dbExec("PRAGMA table_info('Students')")
    const hasPaidInscription = studentsInfo[0]?.values?.some((col: any) => col[1] === 'has_paid_inscription')
    if (!hasPaidInscription) {
      await window.desktopApp.dbRun("ALTER TABLE Students ADD COLUMN has_paid_inscription BOOLEAN NOT NULL DEFAULT 0;")
      console.log('Migration: Added has_paid_inscription to Students')
    }

    // 4. Enrollments: payment_type
    const enrollmentsInfo: any = await window.desktopApp.dbExec("PRAGMA table_info('Enrollments')")
    const hasPaymentType = enrollmentsInfo[0]?.values?.some((col: any) => col[1] === 'payment_type')
    if (!hasPaymentType) {
      await window.desktopApp.dbRun("ALTER TABLE Enrollments ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'hourly';")
      console.log('Migration: Added payment_type to Enrollments')
    }

    // 5. Enrollments: group_id
    const hasGroupId = enrollmentsInfo[0]?.values?.some((col: any) => col[1] === 'group_id')
    if (!hasGroupId) {
      await window.desktopApp.dbRun("ALTER TABLE Enrollments ADD COLUMN group_id TEXT;")
      console.log('Migration: Added group_id to Enrollments')
    }

    // 6. Groups table
    await window.desktopApp.dbExec(`
      CREATE TABLE IF NOT EXISTS Groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        teacher_id TEXT NOT NULL,
        FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE
      );
    `)

    // 7. Timetable: group_id and nullable student_id
    const timetableInfo: any = await window.desktopApp.dbExec("PRAGMA table_info('Timetable')")
    const ttHasGroupId = timetableInfo[0]?.values?.some((col: any) => col[1] === 'group_id')
    if (!ttHasGroupId) {
      // Recreate Timetable to allow nullable student_id
      await window.desktopApp.dbExec(`
        CREATE TABLE IF NOT EXISTS Timetable_new (
          id TEXT PRIMARY KEY,
          teacher_id TEXT NOT NULL,
          student_id TEXT,
          group_id TEXT,
          day_of_week TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          room TEXT,
          FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE,
          FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
          FOREIGN KEY (group_id) REFERENCES Groups(id) ON DELETE CASCADE
        );
        INSERT INTO Timetable_new (id, teacher_id, student_id, day_of_week, start_time, end_time, room)
        SELECT id, teacher_id, student_id, day_of_week, start_time, end_time, room FROM Timetable;
        DROP TABLE Timetable;
        ALTER TABLE Timetable_new RENAME TO Timetable;
        CREATE INDEX IF NOT EXISTS idx_timetable_day ON Timetable(day_of_week);
      `)
      console.log('Migration: Added group_id and recreated Timetable')
    }

    // 8. DebtResets table
    await window.desktopApp.dbExec(`
      CREATE TABLE IF NOT EXISTS DebtResets (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_debtresets_student ON DebtResets(student_id);
    `)
  } catch (err) {
    console.error('Fatal error during migrateSchema:', err)
  }
  try {
    await window.desktopApp.dbExec(`
      CREATE TABLE IF NOT EXISTS TeacherPayouts (
        id TEXT PRIMARY KEY,
        teacher_id TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        period_month TEXT,
        payment_method TEXT DEFAULT 'Espèces',
        notes TEXT,
        FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_teacher_payouts_teacher ON TeacherPayouts(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_payouts_date ON TeacherPayouts(date);
    `)
  } catch (e) {
    // Table already exists
  }

  try {
    await window.desktopApp.dbExec(`
      CREATE TABLE IF NOT EXISTS Classrooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );
    `)
    const checkRooms = await window.desktopApp.dbQuery('SELECT COUNT(*) FROM Classrooms;')
    if (checkRooms.length > 0 && checkRooms[0]['COUNT(*)'] === 0) {
      await window.desktopApp.dbExec(`
        INSERT INTO Classrooms (id, name) VALUES
        ('room_1', 'Salle Hannibal'),
        ('room_2', 'Salle Marie Curie'),
        ('room_3', 'Salle Einstein'),
        ('room_4', 'Salle Pasteur'),
        ('room_5', 'Salle Ibn Khaldoun');
      `)
      
    }
  } catch (e) {
    // Table already exists or migration error
  }

  try {
    await window.desktopApp.dbExec(`
      CREATE TABLE IF NOT EXISTS AppSettings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  } catch (e) {
    // Table already exists
  }
}

async function migrateToTunisianData(db: any) {
  try {
    const check = await window.desktopApp.dbQuery("SELECT COUNT(*) FROM Students WHERE parent_contact LIKE '+212%' OR name LIKE '%Mansouri%';")
    if (check.length > 0 && check[0]['COUNT(*)'] > 0) {
      await window.desktopApp.dbExec(`
        UPDATE Teachers SET name = 'Prof. Mohamed Ben Salem' WHERE id = 't1';
        UPDATE Teachers SET name = 'Mme. Sonia Trabelsi' WHERE id = 't2';
        UPDATE Teachers SET name = 'M. Youssef Gharbi' WHERE id = 't3';
        UPDATE Teachers SET name = 'Mme. Rim Khemir' WHERE id = 't4';

        UPDATE Students SET name = 'Aziz Ben Amor', parent_contact = '+216 98 234 567', grade_level = '4ème Bac Math' WHERE id = 's1';
        UPDATE Students SET name = 'Mariem Jaziri', parent_contact = '+216 22 987 654', grade_level = '4ème Bac Sciences' WHERE id = 's2';
        UPDATE Students SET name = 'Yassine Ayari', parent_contact = '+216 55 345 678', grade_level = '3ème Année Secondaire' WHERE id = 's3';
        UPDATE Students SET name = 'Nour Mejbri', parent_contact = '+216 97 112 233', grade_level = '2ème Année Secondaire' WHERE id = 's4';
        UPDATE Students SET name = 'Karim Hammami', parent_contact = '+216 29 445 566', grade_level = '1ère Année Secondaire' WHERE id = 's5';
        UPDATE Students SET name = 'Sarra Chahed', parent_contact = '+216 50 889 900', grade_level = '4ème Bac Économie' WHERE id = 's6';

        UPDATE Students SET parent_contact = REPLACE(parent_contact, '+212 6', '+216 9') WHERE parent_contact LIKE '+212%';
      `)
      
    }
  } catch (e) {
    console.warn('Migration to Tunisian data check failed:', e)
  }
}

export function persistDatabase() {
  if (typeof window !== 'undefined' && (window as any).desktopApp?.backupDatabase) {
    try {
      const raw = localStorage.getItem('soutien_scolaire_settings')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.backupFolderPath) {
          (window as any).desktopApp.backupDatabase(parsed.backupFolderPath).catch((err: any) => {
            console.error('Auto-backup failed:', err)
          })
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
}

export async function resetToTunisianDemoData(): Promise<void> {
  const db = await getDatabase()
  await window.desktopApp.dbRun('PRAGMA foreign_keys = OFF;')
  await window.desktopApp.dbExec(`
    DROP TABLE IF EXISTS TeacherPayouts;
    DROP TABLE IF EXISTS Timetable;
    DROP TABLE IF EXISTS Classrooms;
    DROP TABLE IF EXISTS Payments;
    DROP TABLE IF EXISTS DebtResets;
    DROP TABLE IF EXISTS Sessions;
    DROP TABLE IF EXISTS Enrollments;
    DROP TABLE IF EXISTS Groups;
    DROP TABLE IF EXISTS Students;
    DROP TABLE IF EXISTS Teachers;
  `)
  await window.desktopApp.dbRun('PRAGMA foreign_keys = ON;')
  await initSchema(db)
  await seedInitialData(db)
  
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

async function initSchema(db: any) {
  await window.desktopApp.dbExec(`
    CREATE TABLE IF NOT EXISTS Teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      monthly_rate_cut REAL NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'percentage',
      rate_per_student REAL NOT NULL DEFAULT 50.0,
      phone TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS Students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_contact TEXT NOT NULL,
      grade_level TEXT NOT NULL,
      has_paid_inscription BOOLEAN NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS Groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Enrollments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      group_id TEXT,
      hourly_rate REAL NOT NULL,
      payment_type TEXT NOT NULL DEFAULT 'hourly',
      FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES Groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS Sessions (
      id TEXT PRIMARY KEY,
      enrollment_id TEXT NOT NULL,
      date TEXT NOT NULL,
      duration REAL NOT NULL DEFAULT 1.0,
      status TEXT NOT NULL,
      FOREIGN KEY (enrollment_id) REFERENCES Enrollments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Payments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS TeacherPayouts (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      period_month TEXT,
      payment_method TEXT DEFAULT 'Espèces',
      notes TEXT,
      FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS DebtResets (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Timetable (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      student_id TEXT,
      group_id TEXT,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT,
      FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES Groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Classrooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS AppSettings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_enrollments_teacher ON Enrollments(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_student ON Enrollments(student_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_enrollment ON Sessions(enrollment_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON Sessions(date);
    CREATE INDEX IF NOT EXISTS idx_payments_student ON Payments(student_id);
    CREATE INDEX IF NOT EXISTS idx_debtresets_student ON DebtResets(student_id);
    CREATE INDEX IF NOT EXISTS idx_teacher_payouts_teacher ON TeacherPayouts(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_teacher_payouts_date ON TeacherPayouts(date);
    CREATE INDEX IF NOT EXISTS idx_timetable_day ON Timetable(day_of_week);
  `)

  // Run migration to fix legacy UNIQUE constraint on Groups.teacher_id if it exists
  try {
    const tableInfo = await window.desktopApp.dbQuery("SELECT sql FROM sqlite_master WHERE type='table' AND name='Groups'");
    if (tableInfo && tableInfo.length > 0 && tableInfo[0].sql.includes('UNIQUE')) {
      console.log('Migrating Groups table to remove UNIQUE constraint...');
      await window.desktopApp.dbExec(`
        PRAGMA foreign_keys=off;
        CREATE TABLE Groups_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          teacher_id TEXT NOT NULL,
          FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE
        );
        INSERT INTO Groups_new (id, name, teacher_id) SELECT id, name, teacher_id FROM Groups;
        DROP TABLE Groups;
        ALTER TABLE Groups_new RENAME TO Groups;
        PRAGMA foreign_keys=on;
      `);
    }
  } catch (err) {
    console.error('Migration failed for Groups table:', err);
  }
}

async function seedInitialData(db: any) {
  // Demo database seeding removed per user request.
}

// ----------------------------------------------------------------------
// Relational Queries & Dynamic Single-Source-of-Truth Calculations
// ----------------------------------------------------------------------

export async function getEnrollments(): Promise<Enrollment[]> {
  const db = await getDatabase()
  if (!db) return []
  const res = await window.desktopApp.dbQuery('SELECT * FROM Enrollments;')
  return res.map((r: any) => ({
    id: r.id,
    student_id: r.student_id,
    teacher_id: r.teacher_id,
    group_id: r.group_id,
    hourly_rate: r.hourly_rate,
    payment_type: r.payment_type
  }))
}

export async function getGroups(): Promise<any[]> {
  const db = await getDatabase()
  if (!db) return []
  const query = `
    SELECT g.*, t.name as teacher_name, COUNT(e.id) as student_count
    FROM Groups g
    LEFT JOIN Teachers t ON g.teacher_id = t.id
    LEFT JOIN Enrollments e ON e.group_id = g.id
    GROUP BY g.id
    ORDER BY g.name ASC;
  `
  const res = await window.desktopApp.dbQuery(query)
  return res.map((r: any) => ({
    id: r.id,
    name: r.name,
    teacher_id: r.teacher_id,
    teacher_name: r.teacher_name,
    student_count: r.student_count || 0
  }))
}

export async function addGroup(teacher_id: string, name: string): Promise<void> {
  await getDatabase()
  const id = 'g_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
  await window.desktopApp.dbRun(
    'INSERT INTO Groups (id, teacher_id, name) VALUES (?, ?, ?);',
    [id, teacher_id, name]
  )
}

export async function updateGroup(id: string, name: string): Promise<void> {
  await getDatabase()
  await window.desktopApp.dbRun('UPDATE Groups SET name = ? WHERE id = ?;', [name, id])
}

export async function deleteGroup(id: string): Promise<void> {
  await getDatabase()
  await window.desktopApp.dbRun('DELETE FROM Groups WHERE id = ?;', [id])
}

export async function getTeachers(): Promise<Teacher[]> {
  try {
    const db = await getDatabase()
    const res = await window.desktopApp.dbQuery('SELECT id, name, subject, monthly_rate_cut, payment_mode, rate_per_student, phone FROM Teachers ORDER BY name ASC;')
    return res.map((v: any) => ({
      id: String(v.id),
      name: String(v.name),
      subject: String(v.subject),
      monthly_rate_cut: Number(v.monthly_rate_cut),
      payment_mode: (String(v.payment_mode) === 'per_student' ? 'per_student' : 'percentage') as TeacherPaymentMode,
      rate_per_student: Number(v.rate_per_student !== undefined && v.rate_per_student !== null ? v.rate_per_student : 50.0),
      phone: v.phone ? String(v.phone) : ''
    }))
  } catch (err) {
    console.error('getTeachers error:', err)
    return []
  }
}

export async function getStudents(): Promise<Student[]> {
  try {
    const db = await getDatabase()
    const res = await window.desktopApp.dbQuery('SELECT id, name, parent_contact, grade_level, has_paid_inscription FROM Students ORDER BY name ASC;')
    return res.map((v: any) => ({
      id: String(v.id),
      name: String(v.name),
      parent_contact: String(v.parent_contact),
      grade_level: String(v.grade_level),
      has_paid_inscription: Boolean(v.has_paid_inscription)
    }))
  } catch (err) {
    console.error('getStudents error:', err)
    return []
  }
}

export async function getTeacherDailySheet(filterId: string, date: string, filterType: 'teacher' | 'group' = 'teacher'): Promise<EnrolledStudentRow[]> {
  const db = await getDatabase()

  // 1. Get all enrollments with this teacher or group
  const enrollQuery = `
    SELECT 
      e.id as enrollment_id,
      e.hourly_rate,
      s.id as student_id,
      s.name as student_name,
      s.parent_contact,
      s.grade_level,
      s.has_paid_inscription,
      e.payment_type,
      t.id as teacher_id,
      t.name as teacher_name,
      t.subject
    FROM Enrollments e
    JOIN Students s ON e.student_id = s.id
    JOIN Teachers t ON e.teacher_id = t.id
    WHERE ${filterType === 'group' ? 'e.group_id = ?' : 'e.teacher_id = ?'}
    ORDER BY s.name ASC;
  `
  const stmt = await window.desktopApp.dbQuery(enrollQuery, [filterId])
  const enrolledRows: any[] = []
  for (const row of stmt) {
    enrolledRows.push(row)
  }
    if (enrolledRows.length === 0) {
    return []
  }

  // Build full dynamic debt calculation strictly from relational tables:
  // Debt = (Total Sessions Attended * hourly_rate) - (Total Payments)
  const result: EnrolledStudentRow[] = []

  for (const enr of enrolledRows) {
    const studentId = String(enr.student_id)
    const enrollmentId = String(enr.enrollment_id)
    const hourlyRate = Number(enr.hourly_rate)
    const paymentType = String(enr.payment_type || 'hourly')

    // Check attendance for today on this enrollment
    const sessionCheckStmt = await window.desktopApp.dbQuery(`
      SELECT id, status, duration FROM Sessions 
      WHERE enrollment_id = ? AND date = ?;
    `, [enrollmentId, date])
    let todaySessionId: string | undefined = undefined
    let todayAttended = false
    let todayDuration = 1.0

    if (sessionCheckStmt.length > 0) {
      const sObj = sessionCheckStmt[0]
      todaySessionId = String(sObj.id)
      todayAttended = sObj.status === 'attended'
      todayDuration = Number(sObj.duration || 1.0)
    }
        // Calculate total sessions attended for this student across ALL their enrollments
    // or on this specific enrollment:
    // User rule: (Total Sessions Attended * hourly_rate) - (Total Payments)
    // In our relational schema, each enrollment has its hourly_rate.
    // Total cost for the student across all enrollments:
    const monthStart = date.substring(0, 7) + '-01'
    const monthEnd = date.substring(0, 7) + '-31'

    // LOCAL sessions and cost for this specific enrollment for the current month
    const localCostStmt = await window.desktopApp.dbQuery(`
      SELECT 
        COUNT(id) as sessions_count,
        CASE 
          WHEN ? = 'monthly' THEN ? * COUNT(DISTINCT substr(date, 1, 7))
          WHEN ? = 'session' THEN COUNT(id) * ?
          ELSE COALESCE(SUM(duration * ?), 0)
        END as session_cost_sum
      FROM Sessions
      WHERE enrollment_id = ? AND status = 'attended' AND date >= ? AND date <= ?;
    `, [paymentType, hourlyRate, paymentType, hourlyRate, hourlyRate, enrollmentId, monthStart, monthEnd])
    
    let totalSessionsAttended = 0
    let localSessionsCost = 0
    if (localCostStmt.length > 0) {
      totalSessionsAttended = Number(localCostStmt[0].sessions_count || 0)
      localSessionsCost = Number(localCostStmt[0].session_cost_sum || 0)
    }

    // GLOBAL cost for correct debt calculation
    const globalCostStmt = await window.desktopApp.dbQuery(`
      WITH EnrollmentCosts AS (
        SELECT 
          CASE 
            WHEN e.payment_type = 'monthly' THEN e.hourly_rate * COUNT(DISTINCT substr(s.date, 1, 7))
            WHEN e.payment_type = 'session' THEN SUM(e.hourly_rate)
            ELSE SUM(s.duration * e.hourly_rate)
          END as cost
        FROM Enrollments e
        JOIN Sessions s ON e.id = s.enrollment_id
        WHERE e.student_id = ? AND s.status = 'attended'
        GROUP BY e.id
      )
      SELECT COALESCE(SUM(cost), 0) as total_cost FROM EnrollmentCosts;
    `, [studentId])
    let globalCost = 0
    if (globalCostStmt.length > 0) {
      globalCost = Number(globalCostStmt[0].total_cost || 0)
    }
        // Total Payments made by this student
    const paymentsStmt = await window.desktopApp.dbQuery(`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM Payments
      WHERE student_id = ?;
    `, [studentId])
    const resetsStmt = await window.desktopApp.dbQuery(`
      SELECT COALESCE(SUM(amount), 0) as total_reset
      FROM DebtResets
      WHERE student_id = ?;
    `, [studentId])
    let totalPayments = 0
    if (paymentsStmt.length > 0) {
      const payObj = paymentsStmt[0]
      totalPayments += Number(payObj.total_paid)
    }
    if (resetsStmt.length > 0) {
      const resObj = resetsStmt[0]
      totalPayments += Number(resObj.total_reset)
    }
        const debt = Number((globalCost - totalPayments).toFixed(2))

    // Add inscription fee to debt if not paid
    let finalDebt = debt
    let finalLocalCost = localSessionsCost
    if (!Boolean(enr.has_paid_inscription)) {
      const { getAppSettings } = await import('../services/settingsService')
      const inscriptionFee = getAppSettings().yearlyInscriptionFee || 50
      finalDebt += inscriptionFee
      finalLocalCost += inscriptionFee
    }

    result.push({
      enrollmentId,
      studentId,
      studentName: String(enr.student_name),
      parentContact: String(enr.parent_contact),
      gradeLevel: String(enr.grade_level),
      teacherId: String(enr.teacher_id),
      teacherName: String(enr.teacher_name),
      paymentType: paymentType as any,
      subject: String(enr.subject),
      hourlyRate,
      todaySessionId,
      todayAttended,
      todayDuration,
      totalSessionsAttended,
      totalSessionsCost: finalLocalCost,
      totalPayments,
      debt: finalDebt,
      isPaidInFull: finalDebt <= 0
    })
  }

  return result
}

export async function getAttendanceDashboardData(
  date: string,
  teacherId?: string,
  searchQuery: string = ''
): Promise<any[]> {
  const db = await getDatabase()

  const enrollQuery = `
    SELECT 
      e.id as enrollment_id,
      e.hourly_rate,
      s.id as student_id,
      s.name as student_name,
      s.parent_contact,
      s.grade_level,
      s.has_paid_inscription,
      e.payment_type,
      t.id as teacher_id,
      t.name as teacher_name,
      t.subject
    FROM Enrollments e
    JOIN Students s ON e.student_id = s.id
    JOIN Teachers t ON e.teacher_id = t.id
    WHERE e.teacher_id = ? AND s.name LIKE ?
    ORDER BY s.name ASC;
  `
  const _rows = await window.desktopApp.dbQuery(enrollQuery, [teacherId, `%${searchQuery}%`])
  const result: any[] = []
  for (const enr of _rows) {
      const enrollmentId = String(enr.enrollment_id)
      const studentId = String(enr.student_id)
      const hourlyRate = Number(enr.hourly_rate)
      const paymentType = String(enr.payment_type || 'hourly')

      // Fetch today's session
      const sessionCheckStmt = await window.desktopApp.dbQuery(`
        SELECT id, duration, status FROM Sessions WHERE enrollment_id = ? AND date = ?;
      `, [enrollmentId, date])
      
      let todaySessionId: string | undefined = undefined
      let todayAttended = false
      let todayDuration = 1.0

      if (sessionCheckStmt.length > 0) {
        const sObj = sessionCheckStmt[0]
        todaySessionId = String(sObj.id)
        todayAttended = sObj.status === 'attended'
        todayDuration = Number(sObj.duration || 1.0)
      }

      const monthStart = date.substring(0, 7) + '-01'
      const monthEnd = date.substring(0, 7) + '-31'

      // LOCAL sessions and cost for this specific enrollment for the current month
      const localCostStmt = await window.desktopApp.dbQuery(`
        SELECT 
          COUNT(id) as sessions_count,
          CASE 
            WHEN ? = 'monthly' THEN ? * COUNT(DISTINCT substr(date, 1, 7))
            WHEN ? = 'session' THEN COUNT(id) * ?
            ELSE COALESCE(SUM(duration * ?), 0)
          END as session_cost_sum
        FROM Sessions
        WHERE enrollment_id = ? AND status = 'attended' AND date >= ? AND date <= ?;
      `, [paymentType, hourlyRate, paymentType, hourlyRate, hourlyRate, enrollmentId, monthStart, monthEnd])
      
      let totalSessionsAttended = 0
      let localSessionsCost = 0
      if (localCostStmt.length > 0) {
        totalSessionsAttended = Number(localCostStmt[0].sessions_count || 0)
        localSessionsCost = Number(localCostStmt[0].session_cost_sum || 0)
      }

      // GLOBAL cost for correct debt calculation
      const globalCostStmt = await window.desktopApp.dbQuery(`
        WITH EnrollmentCosts AS (
          SELECT 
            CASE 
              WHEN e.payment_type = 'monthly' THEN e.hourly_rate * COUNT(DISTINCT substr(s.date, 1, 7))
              WHEN e.payment_type = 'session' THEN SUM(e.hourly_rate)
              ELSE SUM(s.duration * e.hourly_rate)
            END as cost
          FROM Enrollments e
          JOIN Sessions s ON e.id = s.enrollment_id
          WHERE e.student_id = ? AND s.status = 'attended'
          GROUP BY e.id
        )
        SELECT COALESCE(SUM(cost), 0) as total_cost FROM EnrollmentCosts;
      `, [studentId])
      let globalCost = 0
      if (globalCostStmt.length > 0) {
        globalCost = Number(globalCostStmt[0].total_cost || 0)
      }

      const paymentsStmt = await window.desktopApp.dbQuery(`
        SELECT COALESCE(SUM(amount), 0) as total_paid
        FROM Payments
        WHERE student_id = ?;
      `, [studentId])
      const resetsStmt = await window.desktopApp.dbQuery(`
        SELECT COALESCE(SUM(amount), 0) as total_reset
        FROM DebtResets
        WHERE student_id = ?;
      `, [studentId])
    let totalPayments = 0
    if (paymentsStmt.length > 0) {
      const payObj = paymentsStmt[0]
      totalPayments += Number(payObj.total_paid)
    }
    if (resetsStmt.length > 0) {
      const resObj = resetsStmt[0]
      totalPayments += Number(resObj.total_reset)
    }
        const debt = Number((globalCost - totalPayments).toFixed(2))

    // Add inscription fee to debt if not paid
    let finalDebt = debt
    let finalLocalCost = localSessionsCost
    if (!Boolean(enr.has_paid_inscription)) {
      const { getAppSettings } = await import('../services/settingsService')
      const inscriptionFee = getAppSettings().yearlyInscriptionFee || 50
      finalDebt += inscriptionFee
      finalLocalCost += inscriptionFee
    }

    result.push({
      enrollmentId,
      studentId,
      studentName: String(enr.student_name),
      parentContact: String(enr.parent_contact),
      gradeLevel: String(enr.grade_level),
      teacherId: String(enr.teacher_id),
      teacherName: String(enr.teacher_name),
      paymentType: paymentType as any,
      subject: String(enr.subject),
      hourlyRate,
      todaySessionId,
      todayAttended,
      todayDuration,
      totalSessionsAttended,
      totalSessionsCost: finalLocalCost,
      totalPayments,
      debt: finalDebt,
      isPaidInFull: finalDebt <= 0
    })
  }

  return result
}

export async function getTeacherAttendanceMatrix(
  filterId: string,
  dates: string[],
  filterType: 'teacher' | 'group' = 'teacher'
): Promise<MatrixStudentRow[]> {

  const db = await getDatabase()

  const enrollQuery = `
    SELECT 
      e.id as enrollment_id,
      e.hourly_rate,
      s.id as student_id,
      s.name as student_name,
      s.parent_contact,
      s.grade_level,
      s.has_paid_inscription,
      e.payment_type,
      t.id as teacher_id,
      t.name as teacher_name,
      t.subject
    FROM Enrollments e
    JOIN Students s ON e.student_id = s.id
    JOIN Teachers t ON e.teacher_id = t.id
    WHERE ${filterType === 'group' ? 'e.group_id = ?' : 'e.teacher_id = ?'}
    ORDER BY s.name ASC;
  `
  const stmt = await window.desktopApp.dbQuery(enrollQuery, [filterId])
  const enrolledRows: any[] = stmt
    if (enrolledRows.length === 0) return []

  const result: MatrixStudentRow[] = []

  for (const enr of enrolledRows) {
    const studentId = String(enr.student_id)
    const enrollmentId = String(enr.enrollment_id)
    const hourlyRate = Number(enr.hourly_rate)
    const paymentType = String(enr.payment_type || 'hourly')

    const attendanceByDate: Record<string, MatrixAttendanceCell> = {}

    for (const d of dates) {
      const sCheckStmt = await window.desktopApp.dbQuery(`
        SELECT id, status, duration FROM Sessions 
        WHERE enrollment_id = ? AND date = ?;
      `, [enrollmentId, d])
      let sessionId: string | undefined = undefined
      let attended = false
      let duration = 1.0

      if (sCheckStmt.length > 0) {
        const sObj = sCheckStmt[0]
        sessionId = String(sObj.id)
        attended = sObj.status === 'attended'
        duration = Number(sObj.duration || 1.0)
      }
            attendanceByDate[d] = {
        date: d,
        sessionId,
        attended,
        duration
      }
    }

    const startDate = dates.length > 0 ? dates[0] : ''
    const endDate = dates.length > 0 ? dates[dates.length - 1] : ''

    // LOCAL sessions and cost for this specific enrollment within the selected dates
    const localCostStmt = await window.desktopApp.dbQuery(`
      SELECT 
        COUNT(id) as sessions_count,
        CASE 
          WHEN ? = 'monthly' THEN ? * COUNT(DISTINCT substr(date, 1, 7))
          WHEN ? = 'session' THEN COUNT(id) * ?
          ELSE COALESCE(SUM(duration * ?), 0)
        END as session_cost_sum
      FROM Sessions
      WHERE enrollment_id = ? AND status = 'attended' AND date >= ? AND date <= ?;
    `, [paymentType, hourlyRate, paymentType, hourlyRate, hourlyRate, enrollmentId, startDate, endDate])
    
    let totalSessionsAttended = 0
    let localSessionsCost = 0
    if (localCostStmt.length > 0) {
      totalSessionsAttended = Number(localCostStmt[0].sessions_count || 0)
      localSessionsCost = Number(localCostStmt[0].session_cost_sum || 0)
    }

    // GLOBAL cost for correct debt calculation
    const globalCostStmt = await window.desktopApp.dbQuery(`
      WITH EnrollmentCosts AS (
        SELECT 
          CASE 
            WHEN e.payment_type = 'monthly' THEN e.hourly_rate * COUNT(DISTINCT substr(s.date, 1, 7))
            WHEN e.payment_type = 'session' THEN SUM(e.hourly_rate)
            ELSE SUM(s.duration * e.hourly_rate)
          END as cost
        FROM Enrollments e
        JOIN Sessions s ON e.id = s.enrollment_id
        WHERE e.student_id = ? AND s.status = 'attended'
        GROUP BY e.id
      )
      SELECT COALESCE(SUM(cost), 0) as total_cost FROM EnrollmentCosts;
    `, [studentId])
    let globalCost = 0
    if (globalCostStmt.length > 0) {
      globalCost = Number(globalCostStmt[0].total_cost || 0)
    }
        const paymentsStmt = await window.desktopApp.dbQuery(`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM Payments
      WHERE student_id = ?;
    `, [studentId])
    const resetsStmt = await window.desktopApp.dbQuery(`
      SELECT COALESCE(SUM(amount), 0) as total_reset
      FROM DebtResets
      WHERE student_id = ?;
    `, [studentId])
    let totalPayments = 0
    if (paymentsStmt.length > 0) {
      totalPayments += Number(paymentsStmt[0].total_paid)
    }
    if (resetsStmt.length > 0) {
      totalPayments += Number(resetsStmt[0].total_reset)
    }
        const debt = Number((globalCost - totalPayments).toFixed(2))

    // Add inscription fee to debt if not paid
    let finalDebt = debt
    let finalLocalCost = localSessionsCost
    if (!Boolean(enr.has_paid_inscription)) {
      const { getAppSettings } = await import('../services/settingsService')
      const inscriptionFee = getAppSettings().yearlyInscriptionFee || 50
      finalDebt += inscriptionFee
      finalLocalCost += inscriptionFee
    }

    result.push({
      enrollmentId,
      studentId,
      studentName: String(enr.student_name),
      parentContact: String(enr.parent_contact),
      gradeLevel: String(enr.grade_level),
      teacherId: String(enr.teacher_id),
      teacherName: String(enr.teacher_name),
      paymentType: paymentType as any,
      subject: String(enr.subject),
      hourlyRate,
      attendanceByDate,
      totalSessionsAttended,
      totalSessionsCost: finalLocalCost,
      totalPayments,
      debt: finalDebt,
      isPaidInFull: finalDebt <= 0
    })
  }

  return result
}

export async function setBatchAttendanceForDate(
  teacherId: string,
  date: string,
  status: 'attended' | 'absent',
  duration = 1.0
): Promise<void> {
  const db = await getDatabase()
  const enrollStmt = await window.desktopApp.dbQuery('SELECT id FROM Enrollments WHERE teacher_id = ?;', [teacherId])
  const enrollmentIds: string[] = enrollStmt.map((r: any) => String(r.id))
  for (const enrId of enrollmentIds) {
    const checkStmt = await window.desktopApp.dbQuery('SELECT id FROM Sessions WHERE enrollment_id = ? AND date = ?;', [enrId, date])
    const existingId = checkStmt.length > 0 ? checkStmt[0].id : null;
    if (existingId) {
      await window.desktopApp.dbRun('UPDATE Sessions SET status = ?, duration = ? WHERE id = ?;', [status, duration, existingId])
    } else {
      const newId = 'ses_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
      await window.desktopApp.dbRun(
        'INSERT INTO Sessions (id, enrollment_id, date, duration, status) VALUES (?, ?, ?, ?, ?);',
        [newId, enrId, date, duration, status]
      )
    }
  }
}

export async function toggleAttendance(
  enrollmentId: string,
  date: string,
  duration = 1.0
): Promise<{ attended: boolean; sessionId: string }> {
  const db = await getDatabase()

  const checkStmt = await window.desktopApp.dbQuery('SELECT id, status FROM Sessions WHERE enrollment_id = ? AND date = ?;', [enrollmentId, date])
  let existingId: string | null = null
  const _rows_checkStmt = await window.desktopApp.dbQuery('SELECT id, status FROM Sessions WHERE enrollment_id = ? AND date = ?;', [enrollmentId, date])
  if (_rows_checkStmt.length > 0) {
    const existingId = String(_rows_checkStmt[0].id)
    const currentStatus = String(_rows_checkStmt[0].status)
    const nextStatus = currentStatus === 'attended' ? 'absent' : (currentStatus === 'absent' ? 'cancelled' : 'attended')
    await window.desktopApp.dbRun('UPDATE Sessions SET status = ? WHERE id = ?;', [nextStatus, existingId])
    window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
    return { attended: nextStatus === 'attended', sessionId: existingId }
  } else {
    const newId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
    await window.desktopApp.dbRun(
      'INSERT INTO Sessions (id, enrollment_id, date, duration, status) VALUES (?, ?, ?, ?, ?);',
      [newId, enrollmentId, date, duration, 'attended']
    )
    window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
    return { attended: true, sessionId: newId }
  }
}

export async function recordPayment(
  studentId: string,
  amount: number,
  date: string
): Promise<Payment> {
  const db = await getDatabase()
  const id = 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
  await window.desktopApp.dbRun(
    'INSERT INTO Payments (id, student_id, amount, date) VALUES (?, ?, ?, ?);',
    [id, studentId, amount, date]
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
  return { id, student_id: studentId, amount, date }
}

export async function addPayment(student_id: string, amount: number): Promise<void> {
  await getDatabase()
  const id = 'pay_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
  const date = new Date().toISOString()
  await window.desktopApp.dbRun(
    'INSERT INTO Payments (id, student_id, amount, date) VALUES (?, ?, ?, ?);',
    [id, student_id, amount, date]
  )
}

export async function addDebtReset(student_id: string, amount: number): Promise<void> {
  await getDatabase()
  const id = 'rst_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
  const date = new Date().toISOString()
  await window.desktopApp.dbRun(
    'INSERT INTO DebtResets (id, student_id, amount, date) VALUES (?, ?, ?, ?);',
    [id, student_id, amount, date]
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

export async function getPaymentsForStudent(studentId: string): Promise<Payment[]> {
  const db = await getDatabase()
  const _rows = await window.desktopApp.dbQuery(
    'SELECT id, student_id, amount, date FROM Payments WHERE student_id = ? ORDER BY date DESC;',
    [studentId]
  )
  return _rows.map((row: any) => ({
    id: String(row.id),
    student_id: String(row.student_id),
    amount: Number(row.amount),
    date: String(row.date)
  }))
}

export async function getMonthlyFinancialRollup(year: number, month: number): Promise<MonthlyFinancialSummary> {
  const db = await getDatabase()
  const monthStr = month < 10 ? `0${month}` : `${month}`
  const datePrefix = `${year}-${monthStr}`

  const teachers = await getTeachers()
  const teacherRows: TeacherMonthlyFinancial[] = []

  let totalCenterRevenue = 0
  let totalTeacherPayouts = 0
  let totalCenterMargin = 0
  let totalTeacherPaidAcrossCenter = 0
  let totalTeacherRemainingDueAcrossCenter = 0
  
  let studentsPaidCount = 0
  let studentsInDebtCount = 0
  let totalOutstandingDebt = 0

  const processedStudents = new Set<string>()

  for (const t of teachers) {
    const sessionQuery = `
      SELECT
        e.id as enrollment_id,
        e.hourly_rate,
        e.payment_type,
        s.id as session_id,
        s.duration,
        e.student_id
      FROM Enrollments e
      JOIN Sessions s ON e.id = s.enrollment_id
      WHERE e.teacher_id = ? AND s.date LIKE ? AND s.status = 'attended';
    `
    const _rows_stmt = await window.desktopApp.dbQuery(sessionQuery, [t.id, `${datePrefix}%`]);
    
    let sessionsCount = 0
    let totalSessionCosts = 0
    const activeStudents = new Set<string>()
    const processedMonthlyEnrollments = new Set<string>()

    for (const row of _rows_stmt) {
      sessionsCount++
      const paymentType = row.payment_type || 'hourly'
      if (paymentType === 'monthly') {
        if (!processedMonthlyEnrollments.has(String(row.enrollment_id))) {
          totalSessionCosts += Number(row.hourly_rate)
          processedMonthlyEnrollments.add(String(row.enrollment_id))
        }
      } else if (paymentType === 'session') {
        totalSessionCosts += Number(row.hourly_rate)
      } else {
        totalSessionCosts += (Number(row.hourly_rate) * Number(row.duration))
      }
      activeStudents.add(String(row.student_id))
    }

    let teacherPayoutCut = 0
    if (t.payment_mode === 'percentage') {
      teacherPayoutCut = totalSessionCosts * t.monthly_rate_cut
    } else {
      teacherPayoutCut = activeStudents.size * t.rate_per_student
    }

    const _rows_payoutStmt = await window.desktopApp.dbQuery(`
      SELECT COALESCE(SUM(amount), 0) as total_paid, MAX(date) as last_date
      FROM TeacherPayouts
      WHERE teacher_id = ? AND (period_month = ? OR date LIKE ?);
    `, [t.id, datePrefix, `${datePrefix}%`]);

    const totalPaid = Number(_rows_payoutStmt[0]?.total_paid || 0)
    const lastPaymentDate = _rows_payoutStmt[0]?.last_date ? String(_rows_payoutStmt[0].last_date) : undefined
    const remainingBalance = teacherPayoutCut - totalPaid
    
    let paymentStatus: TeacherPaymentStatus = 'unpaid'
    if (totalPaid === 0 && teacherPayoutCut > 0) {
      paymentStatus = 'unpaid'
    } else if (Math.abs(remainingBalance) < 0.01) {
      paymentStatus = 'paid'
    } else if (remainingBalance > 0.01 && totalPaid > 0) {
      paymentStatus = 'partial'
    } else if (remainingBalance < -0.01) {
      paymentStatus = 'overpaid'
    } else {
      paymentStatus = 'paid'
    }

    const centerRetainedMargin = totalSessionCosts - teacherPayoutCut

    teacherRows.push({
      teacherId: t.id,
      teacherName: t.name,
      subject: t.subject,
      monthlyRateCut: t.monthly_rate_cut,
      paymentMode: t.payment_mode,
      ratePerStudent: t.rate_per_student,
      activeStudentsCount: activeStudents.size,
      sessionsCount,
      totalSessionCosts: Number(totalSessionCosts.toFixed(2)),
      teacherPayoutCut: Number(teacherPayoutCut.toFixed(2)),
      centerRetainedMargin: Number(centerRetainedMargin.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      remainingBalance: Number(remainingBalance.toFixed(2)),
      paymentStatus,
      lastPaymentDate
    })

    totalCenterRevenue += totalSessionCosts
    totalTeacherPayouts += teacherPayoutCut
    totalCenterMargin += centerRetainedMargin
    totalTeacherPaidAcrossCenter += totalPaid
    totalTeacherRemainingDueAcrossCenter += remainingBalance

    for (const stId of activeStudents) {
      processedStudents.add(stId)
    }
  }

  for (const stId of processedStudents) {
    const totalCostStmt = await window.desktopApp.dbQuery(`
      WITH EnrollmentCosts AS (
        SELECT 
          e.id as enrollment_id,
          CASE 
            WHEN e.payment_type = 'monthly' THEN e.hourly_rate * COUNT(DISTINCT substr(s.date, 1, 7))
            WHEN e.payment_type = 'session' THEN e.hourly_rate * COUNT(s.id)
            ELSE SUM(s.duration * e.hourly_rate)
          END as cost
        FROM Enrollments e
        JOIN Sessions s ON e.id = s.enrollment_id
        WHERE e.student_id = ? AND s.status = 'attended'
        GROUP BY e.id
      )
      SELECT COALESCE(SUM(cost), 0) as total_cost
      FROM EnrollmentCosts;
    `, [stId])
    const totalCost = Number(totalCostStmt[0]?.total_cost || 0)

    const paymentsStmt = await window.desktopApp.dbQuery(`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM Payments
      WHERE student_id = ?;
    `, [stId])
    const totalPaid = Number(paymentsStmt[0]?.total_paid || 0)

    const debtResetStmt = await window.desktopApp.dbQuery(`
      SELECT COALESCE(SUM(amount), 0) as total_reset
      FROM DebtResets
      WHERE student_id = ?;
    `, [stId])
    const totalReset = Number(debtResetStmt[0]?.total_reset || 0)

    const debt = totalCost - (totalPaid + totalReset)

    if (debt > 0.01) {
      studentsInDebtCount++
      totalOutstandingDebt += debt
    } else {
      studentsPaidCount++
    }
  }

  return {
    month,
    year,
    teachers: teacherRows,
    totalCenterRevenue: Number(totalCenterRevenue.toFixed(2)),
    totalTeacherPayouts: Number(totalTeacherPayouts.toFixed(2)),
    totalCenterMargin: Number(totalCenterMargin.toFixed(2)),
    totalTeacherPaid: Number(totalTeacherPaidAcrossCenter.toFixed(2)),
    totalTeacherRemainingDue: Number(totalTeacherRemainingDueAcrossCenter.toFixed(2)),
    studentsPaidCount,
    studentsInDebtCount,
    totalOutstandingDebt: Number(totalOutstandingDebt.toFixed(2))
  }
}

export async function addEnrollment(
  student_id: string,
  teacher_id: string,
  hourly_rate: number,
  payment_type: PaymentType = 'hourly',
  group_id: string | null = null
): Promise<string> {
  await getDatabase()
  const id = 'enr_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
  await window.desktopApp.dbRun(
    'INSERT INTO Enrollments (id, student_id, teacher_id, hourly_rate, payment_type, group_id) VALUES (?, ?, ?, ?, ?, ?);',
    [id, student_id, teacher_id, hourly_rate, payment_type, group_id]
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
  return id
}

export async function updateEnrollmentGroup(enrollment_id: string, group_id: string | null): Promise<void> {
  await getDatabase()
  await window.desktopApp.dbRun('UPDATE Enrollments SET group_id = ? WHERE id = ?;', [group_id, enrollment_id])
}

export async function getStudentEnrollmentsWithDetails(student_id: string): Promise<any[]> {
  await getDatabase()
  return await window.desktopApp.dbQuery(`
    SELECT 
      e.id as enrollment_id,
      e.hourly_rate,
      e.payment_type,
      t.name as teacher_name,
      g.name as group_name
    FROM Enrollments e
    JOIN Teachers t ON e.teacher_id = t.id
    LEFT JOIN Groups g ON e.group_id = g.id
    WHERE e.student_id = ?
  `, [student_id])
}

export async function updateEnrollmentPaymentInfo(enrollment_id: string, payment_type: PaymentType, hourly_rate: number): Promise<void> {
  await getDatabase()
  await window.desktopApp.dbRun(
    'UPDATE Enrollments SET payment_type = ?, hourly_rate = ? WHERE id = ?;',
    [payment_type, hourly_rate, enrollment_id]
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

export async function getTimetableRecords(): Promise<TimetableRecord[]> {
  const db = await getDatabase()
  const res = await window.desktopApp.dbQuery(`
    SELECT id, teacher_id, student_id, group_id, day_of_week, start_time, end_time, room
    FROM Timetable
    ORDER BY 
      CASE day_of_week
        WHEN 'Lundi' THEN 1
        WHEN 'Mardi' THEN 2
        WHEN 'Mercredi' THEN 3
        WHEN 'Jeudi' THEN 4
        WHEN 'Vendredi' THEN 5
        WHEN 'Samedi' THEN 6
        WHEN 'Dimanche' THEN 7
        ELSE 8
      END ASC,
      start_time ASC;
  `)
  if (res.length === 0) return []
  return res.map((v: any) => ({
    id: String(v.id),
    teacher_id: String(v.teacher_id),
    student_id: v.student_id ? String(v.student_id) : undefined,
    group_id: v.group_id ? String(v.group_id) : undefined,
    day_of_week: v.day_of_week as DayOfWeek,
    start_time: String(v.start_time),
    end_time: String(v.end_time),
    room: v.room ? String(v.room) : undefined
  }))
}

export function detectConflicts(
  records: TimetableRecord[],
  teachersMap: Map<string, Teacher>,
  studentsMap: Map<string, Student>
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i]
      const b = records[j]

      if (a.day_of_week !== b.day_of_week) continue

      const aStart = timeToMinutes(a.start_time)
      const aEnd = timeToMinutes(a.end_time)
      const bStart = timeToMinutes(b.start_time)
      const bEnd = timeToMinutes(b.end_time)

      const overlaps = aStart < bEnd && aEnd > bStart
      if (!overlaps) continue

      const teacherA = teachersMap.get(a.teacher_id)?.name || a.teacher_id
      const teacherB = teachersMap.get(b.teacher_id)?.name || b.teacher_id
      const studentA = a.student_id ? (studentsMap.get(a.student_id)?.name || a.student_id) : (a.group_id ? `Groupe ${a.group_id}` : 'Inconnu')
      const studentB = b.student_id ? (studentsMap.get(b.student_id)?.name || b.student_id) : (b.group_id ? `Groupe ${b.group_id}` : 'Inconnu')

      // 1. Room conflict: Two different classes in the same room at the same time
      if (a.room && b.room && a.room.trim().toLowerCase() === b.room.trim().toLowerCase()) {
        conflicts.push({
          type: 'room',
          entryId1: a.id,
          entryId2: b.id,
          description: `Conflit de Salle : '${a.room}' est assignée simultanément à ${teacherA} et ${teacherB} le ${a.day_of_week} (${a.start_time}-${a.end_time} vs ${b.start_time}-${b.end_time})`
        })
      }

      // 2. Teacher conflict: Same teacher double-booked
      if (a.teacher_id === b.teacher_id) {
        conflicts.push({
          type: 'teacher',
          entryId1: a.id,
          entryId2: b.id,
          description: `Conflit Enseignant : ${teacherA} est programmé(e) avec ${studentA} et ${studentB} le ${a.day_of_week} en même temps.`
        })
      }

      // 3. Student conflict: Same student double-booked
      if (a.student_id && b.student_id && a.student_id === b.student_id) {
        conflicts.push({
          type: 'student',
          entryId1: a.id,
          entryId2: b.id,
          description: `Conflit Élève : ${studentA} est inscrit(e) à deux cours en même temps le ${a.day_of_week} (${a.start_time}-${a.end_time} avec ${teacherA} et ${b.start_time}-${b.end_time} avec ${teacherB})`
        })
      }

      // 4. Group conflict: Same group double-booked
      if (a.group_id && b.group_id && a.group_id === b.group_id) {
        conflicts.push({
          type: 'student', // Mapping to student type for UI compatibility
          entryId1: a.id,
          entryId2: b.id,
          description: `Conflit Groupe : Le ${studentA} est programmé(e) à deux cours en même temps le ${a.day_of_week} (${a.start_time}-${a.end_time} et ${b.start_time}-${b.end_time})`
        })
      }
    }
  }
  return conflicts
}

export async function addTimetableEntry(r: Omit<TimetableRecord, "id">): Promise<TimetableRecord> {
  const db = await getDatabase()
  const id = 'tt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
  await window.desktopApp.dbRun(
    'INSERT INTO Timetable (id, teacher_id, student_id, group_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
    [id, r.teacher_id, r.student_id || null, r.group_id || null, r.day_of_week, r.start_time, r.end_time, r.room || null]
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
  return { id, ...r }
}

export async function updateTimetableEntry(id: string, r: Omit<TimetableRecord, "id">): Promise<void> {
  const db = await getDatabase()
  await window.desktopApp.dbRun(
    'UPDATE Timetable SET teacher_id = ?, student_id = ?, group_id = ?, day_of_week = ?, start_time = ?, end_time = ?, room = ? WHERE id = ?;',
    [r.teacher_id, r.student_id || null, r.group_id || null, r.day_of_week, r.start_time, r.end_time, r.room || null, id]
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

export async function deleteTimetableEntry(id: string): Promise<void> {
  const db = await getDatabase()
  await window.desktopApp.dbRun('DELETE FROM Timetable WHERE id = ?;', [id])
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

export async function getClassrooms(): Promise<{ id: string; name: string }[]> {
  const db = await getDatabase()
  const _rows = await window.desktopApp.dbQuery('SELECT id, name FROM Classrooms ORDER BY name ASC;')
  return _rows.map((row: any) => ({
    id: String(row.id),
    name: String(row.name)
  }))
}

export async function addClassroom(name: string): Promise<{ id: string; name: string }> {
  const db = await getDatabase()
  const id = 'cr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
  await window.desktopApp.dbRun('INSERT INTO Classrooms (id, name) VALUES (?, ?);', [id, name.trim()])
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
  return { id, name: name.trim() }
}

export async function deleteClassroom(id: string): Promise<void> {
  const db = await getDatabase()
  await window.desktopApp.dbRun('DELETE FROM Classrooms WHERE id = ?;', [id])
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

export async function addTeacher(t: Omit<Teacher, "id">): Promise<void> {
  const db = await getDatabase()
  const id = 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
  await window.desktopApp.dbRun(
    'INSERT INTO Teachers (id, name, subject, monthly_rate_cut, payment_mode, rate_per_student, phone) VALUES (?, ?, ?, ?, ?, ?, ?);',
    [id, t.name, t.subject, t.monthly_rate_cut, t.payment_mode || 'percentage', t.rate_per_student || 50.0, t.phone || '']
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

export async function updateTeacher(id: string, t: Omit<Teacher, "id">): Promise<void> {
  const db = await getDatabase()
  await window.desktopApp.dbRun(
    'UPDATE Teachers SET name = ?, subject = ?, monthly_rate_cut = ?, payment_mode = ?, rate_per_student = ?, phone = ? WHERE id = ?;',
    [t.name, t.subject, t.monthly_rate_cut, t.payment_mode || 'percentage', t.rate_per_student || 50.0, t.phone || '', id]
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

export async function deleteTeacher(id: string): Promise<void> {
  const db = await getDatabase()
  await window.desktopApp.dbRun('DELETE FROM Teachers WHERE id = ?;', [id])
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

export async function addStudent(s: Omit<Student, "id">): Promise<string> {
  const db = await getDatabase()
  const id = 's_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
  await window.desktopApp.dbRun(
    'INSERT INTO Students (id, name, parent_contact, grade_level, has_paid_inscription) VALUES (?, ?, ?, ?, ?);',
    [id, s.name, s.parent_contact, s.grade_level, s.has_paid_inscription ? 1 : 0]
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
  return id
}

export async function updateStudent(id: string, s: Omit<Student, "id">): Promise<void> {
  const db = await getDatabase()
  await window.desktopApp.dbRun(
    'UPDATE Students SET name = ?, parent_contact = ?, grade_level = ?, has_paid_inscription = ? WHERE id = ?;',
    [s.name, s.parent_contact, s.grade_level, s.has_paid_inscription ? 1 : 0, id]
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

export async function deleteStudent(id: string): Promise<void> {
  const db = await getDatabase()
  await window.desktopApp.dbRun('DELETE FROM Students WHERE id = ?;', [id])
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}

// Duplicate getEnrollments and addEnrollment removed


export async function getTeacherStudentsReport(teacherId?: string): Promise<TeacherSummaryOverview[]> {
  const db = await getDatabase()

  // 1. Fetch Teachers (all or single)
  let teacherQuery = 'SELECT id, name, subject, monthly_rate_cut, payment_mode, rate_per_student, phone FROM Teachers'
  const params: any[] = []
  if (teacherId) {
    teacherQuery += ' WHERE id = ?'
    params.push(teacherId)
  }
  teacherQuery += ' ORDER BY name ASC;'

  const teacherStmt = await window.desktopApp.dbQuery(teacherQuery, params)
  const teacherList: Teacher[] = []
  for (const row of teacherStmt) {
    teacherList.push({
      id: String(row.id),
      name: String(row.name),
      subject: String(row.subject),
      monthly_rate_cut: Number(row.monthly_rate_cut),
      payment_mode: (String(row.payment_mode) === 'per_student' ? 'per_student' : 'percentage') as TeacherPaymentMode,
      rate_per_student: Number(row.rate_per_student !== undefined && row.rate_per_student !== null ? row.rate_per_student : 50.0),
      phone: row.phone ? String(row.phone) : ''
    })
  }
    const reports: TeacherSummaryOverview[] = []

  for (const teacher of teacherList) {
    // 2. Fetch all enrollments for this teacher
    const enrollStmt = await window.desktopApp.dbQuery(`
      SELECT 
        e.id as enrollment_id,
        e.hourly_rate,
        e.payment_type,
        s.id as student_id,
        s.name as student_name,
        s.grade_level,
        s.parent_contact
      FROM Enrollments e
      JOIN Students s ON e.student_id = s.id
      WHERE e.teacher_id = ?
      ORDER BY s.name ASC;
    `, [teacher.id])
    const enrolledStudents: any[] = enrollStmt;
        const studentRows: TeacherStudentReportRow[] = []
    let teacherTotalSessions = 0
    let teacherTotalRevenue = 0
    let teacherTotalStudentDebt = 0
    let teacherTotalStudentPaid = 0

    for (const enr of enrolledStudents) {
      const studentId = String(enr.student_id)
      const enrollmentId = String(enr.enrollment_id)
      const hourlyRate = Number(enr.hourly_rate)
      const paymentType = String(enr.payment_type || 'hourly')

      // Count sessions studied (status = 'attended') on this specific enrollment
      const sessionsStmt = await window.desktopApp.dbQuery(`
        SELECT 
          COUNT(id) as sessions_count,
          CASE 
            WHEN ? = 'monthly' THEN ? * COUNT(DISTINCT substr(date, 1, 7))
            WHEN ? = 'session' THEN COUNT(id) * ?
            ELSE COALESCE(SUM(duration * ?), 0)
          END as session_cost_sum,
          MAX(date) as last_date
        FROM Sessions
        WHERE enrollment_id = ? AND status = 'attended';
      `, [paymentType, hourlyRate, paymentType, hourlyRate, hourlyRate, enrollmentId])
      let sessionsStudied = 0
      let totalSessionsCost = 0
      let lastAttendedDate: string | undefined = undefined
      if (sessionsStmt.length > 0) {
        const sObj = sessionsStmt[0]
        sessionsStudied = Number(sObj.sessions_count || 0)
        totalSessionsCost = Number(sObj.session_cost_sum || 0)
        if (sObj.last_date) {
          lastAttendedDate = String(sObj.last_date)
        }
      }
            // Calculate total payments made by this student across all records
      const payStmt = await window.desktopApp.dbQuery(`
        SELECT COALESCE(SUM(amount), 0) as paid_sum
        FROM Payments
        WHERE student_id = ?;
      `, [studentId])
      const resetsStmt = await window.desktopApp.dbQuery(`
        SELECT COALESCE(SUM(amount), 0) as total_reset
        FROM DebtResets
        WHERE student_id = ?;
      `, [studentId])
      let totalPaid = 0
      if (payStmt.length > 0) {
        totalPaid += Number(payStmt[0].paid_sum || 0)
      }
      if (resetsStmt.length > 0) {
        totalPaid += Number(resetsStmt[0].total_reset || 0)
      }
            // Total overall sessions cost for this student across all enrollments
      const overallCostStmt = await window.desktopApp.dbQuery(`
        WITH EnrollmentCosts AS (
          SELECT 
            CASE 
              WHEN e.payment_type = 'monthly' THEN e.hourly_rate * COUNT(DISTINCT substr(s.date, 1, 7))
              WHEN e.payment_type = 'session' THEN SUM(e.hourly_rate)
              ELSE SUM(s.duration * e.hourly_rate)
            END as cost
          FROM Enrollments e
          JOIN Sessions s ON e.id = s.enrollment_id
          WHERE e.student_id = ? AND s.status = 'attended'
          GROUP BY e.id
        )
        SELECT COALESCE(SUM(cost), 0) as overall_cost FROM EnrollmentCosts;
      `, [studentId])
      let overallCost = 0
      if (overallCostStmt.length > 0) {
        const cObj = overallCostStmt[0]
        overallCost = Number(cObj.overall_cost || 0)
      }
            // Student debt: (Total Sessions Cost) - (Total Payments)
      const debt = Number((overallCost - totalPaid).toFixed(2))

      let teacherStudentPayout = 0
      if (teacher.payment_mode === 'per_student') {
        teacherStudentPayout = sessionsStudied > 0 ? teacher.rate_per_student : 0
      } else {
        teacherStudentPayout = Number((totalSessionsCost * teacher.monthly_rate_cut).toFixed(2))
      }

      studentRows.push({
        paymentType: paymentType as any,
        isPaidInFull: false,
        enrollmentId,
        studentId,
        studentName: String(enr.student_name),
        gradeLevel: String(enr.grade_level),
        parentContact: String(enr.parent_contact),
        teacherId: teacher.id,
        teacherName: teacher.name,
        subject: teacher.subject,
        hourlyRate,
        sessionsStudied,
        totalSessionsCost,
        totalPaid,
        debt,
        lastAttendedDate,
        teacherStudentPayout
      })
      
      teacherTotalSessions += sessionsStudied
      teacherTotalRevenue += totalSessionsCost
      teacherTotalStudentPaid += totalPaid
      teacherTotalStudentDebt += debt
    }

    let teacherPayoutCut = 0
    if (teacher.payment_mode === 'percentage') {
      teacherPayoutCut = teacherTotalRevenue * teacher.monthly_rate_cut
    } else {
      teacherPayoutCut = studentRows.length * teacher.rate_per_student
    }
    const centerRetainedMargin = teacherTotalRevenue - teacherPayoutCut

    const _rows_teacherPayStmt = await window.desktopApp.dbQuery(`
      SELECT id, teacher_id, amount, date, period_month, payment_method, notes
      FROM TeacherPayouts
      WHERE teacher_id = ?
      ORDER BY date DESC, id DESC;
    `, [teacher.id]);

    const teacherPayoutsList: TeacherPayout[] = []
    let teacherTotalPaid = 0
    for (const pRow of _rows_teacherPayStmt) {
      const amt = Number(pRow.amount || 0)
      teacherTotalPaid += amt
      teacherPayoutsList.push({
        id: String(pRow.id),
        teacher_id: String(pRow.teacher_id),
        amount: amt,
        date: String(pRow.date),
        period_month: pRow.period_month ? String(pRow.period_month) : undefined,
        payment_method: String(pRow.payment_method || 'Espèces'),
        notes: pRow.notes ? String(pRow.notes) : undefined
      })
    }

    teacherTotalPaid = Number(teacherTotalPaid.toFixed(2))
    const teacherRemainingBalance = Number((teacherPayoutCut - teacherTotalPaid).toFixed(2))

    let teacherPaymentStatus: TeacherPaymentStatus = 'unpaid'
    if (teacherTotalPaid === 0 && teacherPayoutCut > 0) {
      teacherPaymentStatus = 'unpaid'
    } else if (Math.abs(teacherRemainingBalance) < 0.01) {
      teacherPaymentStatus = 'paid'
    } else if (teacherRemainingBalance > 0.01 && teacherTotalPaid > 0) {
      teacherPaymentStatus = 'partial'
    } else if (teacherRemainingBalance < -0.01) {
      teacherPaymentStatus = 'overpaid'
    } else {
      teacherPaymentStatus = 'paid'
    }

    reports.push({
      teacher,
      studentsCount: studentRows.length,
      totalSessionsStudied: teacherTotalSessions,
      totalRevenue: Number(teacherTotalRevenue.toFixed(2)),
      teacherPayoutCut,
      centerRetainedMargin,
      totalStudentDebt: Number(teacherTotalStudentDebt.toFixed(2)),
      totalStudentPaid: Number(teacherTotalStudentPaid.toFixed(2)),
      students: studentRows,
      teacherTotalPaid,
      teacherRemainingBalance,
      teacherPaymentStatus,
      teacherPayouts: teacherPayoutsList
    })
  }

  return reports
}

export async function getTeacherPayouts(teacherId?: string): Promise<TeacherPayout[]> {
  const db = await getDatabase()
  let query = 'SELECT id, teacher_id, amount, date, period_month, payment_method, notes FROM TeacherPayouts'
  const params: any[] = []
  if (teacherId) {
    query += ' WHERE teacher_id = ?'
    params.push(teacherId)
  }
  query += ' ORDER BY date DESC, id DESC;'
  
  const _rows = await window.desktopApp.dbQuery(query, params)
  return _rows.map((row: any) => ({
    id: String(row.id),
    teacher_id: String(row.teacher_id),
    amount: Number(row.amount || 0),
    date: String(row.date),
    period_month: row.period_month ? String(row.period_month) : undefined,
    payment_method: String(row.payment_method || 'Espèces'),
    notes: row.notes ? String(row.notes) : undefined
  }))
}

export async function recordTeacherPayout(
  teacherId: string,
  amount: number,
  date: string,
  paymentMethod = 'Espèces',
  notes = '',
  periodMonth?: string
): Promise<TeacherPayout> {
  const db = await getDatabase()
  const id = 'tp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
  const month = periodMonth || date.substring(0, 7)
  await window.desktopApp.dbRun(
    'INSERT INTO TeacherPayouts (id, teacher_id, amount, date, period_month, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?);',
    [id, teacherId, amount, date, month, paymentMethod, notes]
  )
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
  return {
    id,
    teacher_id: teacherId,
    amount,
    date,
    payment_method: paymentMethod,
    notes,
    period_month: month
  }
}

export async function deleteTeacherPayout(payoutId: string): Promise<void> {
  const db = await getDatabase()
  await window.desktopApp.dbRun('DELETE FROM TeacherPayouts WHERE id = ?;', [payoutId])
  window.dispatchEvent(new CustomEvent('sqlite_attendance_updated'))
}
export async function globalSearch(query: string): Promise<GlobalSearchResult[]> {
  const db = await getDatabase()
  if (!db || !query.trim()) return []

  const searchParam = `%${query.trim()}%`

  const sql = `
    SELECT 'student' as type, id, name, parent_contact as extra
    FROM Students
    WHERE name LIKE ? OR parent_contact LIKE ?

    UNION ALL

    SELECT 'teacher' as type, id, name, subject as extra
    FROM Teachers
    WHERE name LIKE ? OR subject LIKE ?

    UNION ALL

    SELECT 'group' as type, id, name, '' as extra
    FROM Groups
    WHERE name LIKE ?

    LIMIT 15;
  `
  
  try {
    const res = await window.desktopApp.dbQuery(sql, [searchParam, searchParam, searchParam, searchParam, searchParam])
    return res.map((r: any) => ({
      type: r.type,
      id: String(r.id),
      name: String(r.name),
      extra: String(r.extra || '')
    }))
  } catch (err) {
    console.error('globalSearch error:', err)
    return []
  }
}
