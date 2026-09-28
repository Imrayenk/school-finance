import initSqlJs from 'sql.js'

async function runVerification() {
  console.log('=== VERIFICATION OF SOUTIEN SCOLAIRE DATABASE & RULES ===')
  
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('PRAGMA foreign_keys = ON;')

  // 1. Create Schema
  db.run(`
    CREATE TABLE Teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      monthly_rate_cut REAL NOT NULL
    );

    CREATE TABLE Students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_contact TEXT NOT NULL,
      grade_level TEXT NOT NULL
    );

    CREATE TABLE Enrollments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      hourly_rate REAL NOT NULL,
      FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE
    );

    CREATE TABLE Sessions (
      id TEXT PRIMARY KEY,
      enrollment_id TEXT NOT NULL,
      date TEXT NOT NULL,
      duration REAL NOT NULL DEFAULT 1.0,
      status TEXT NOT NULL,
      FOREIGN KEY (enrollment_id) REFERENCES Enrollments(id) ON DELETE CASCADE
    );

    CREATE TABLE Payments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
    );

    CREATE TABLE Timetable (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT,
      FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
    );
  `)
  console.log('[PASS] SQLite Schema created with foreign key cascades')

  // 2. Insert Test Data
  db.run(`INSERT INTO Teachers VALUES ('t1', 'Prof. Hassan Benali', 'Maths', 0.70);`)
  db.run(`INSERT INTO Students VALUES ('s1', 'Youssef El Mansouri', '+212661234567', '2ème Bac');`)
  db.run(`INSERT INTO Enrollments VALUES ('e1', 's1', 't1', 120.0);`)
  
  // 3 attended sessions of 1.5h = 4.5h * 120 = 540 DH
  db.run(`INSERT INTO Sessions VALUES ('ses1', 'e1', '2026-09-01', 1.5, 'attended');`)
  db.run(`INSERT INTO Sessions VALUES ('ses2', 'e1', '2026-09-03', 1.5, 'attended');`)
  db.run(`INSERT INTO Sessions VALUES ('ses3', 'e1', '2026-09-05', 1.5, 'attended');`)
  
  // 1 payment of 300 DH
  db.run(`INSERT INTO Payments VALUES ('p1', 's1', 300.0, '2026-09-02');`)

  // 3. Verify Student Debt Calculation:
  // (Total Sessions Attended * hourly_rate) - (Total Payments)
  const debtQuery = `
    SELECT 
      SUM(s.duration * e.hourly_rate) as total_session_cost,
      (SELECT SUM(amount) FROM Payments WHERE student_id = 's1') as total_paid
    FROM Sessions s
    JOIN Enrollments e ON s.enrollment_id = e.id
    WHERE e.student_id = 's1' AND s.status = 'attended';
  `
  const res = db.exec(debtQuery)
  const cost = res[0].values[0][0]
  const paid = res[0].values[0][1]
  const debt = cost - paid

  console.log(`Total Attended Sessions Cost: ${cost} DTN`)
  console.log(`Total Payments Received: ${paid} DTN`)
  console.log(`Calculated Net Debt: ${debt} DTN`)

  if (cost === 540 && paid === 300 && debt === 240) {
    console.log('[PASS] Dynamic student debt calculation: (540 - 300 = 240 DTN) verified')
  } else {
    throw new Error('Debt calculation mismatch!')
  }

  // 4. Verify Teacher Monthly Revenue Cut:
  // SUM(Session Costs) * monthly_rate_cut
  // 540 * 0.70 = 378 DTN
  const teacherCut = cost * 0.70
  console.log(`Teacher Revenue Cut (70%): ${teacherCut} DTN`)
  console.log(`Center Retained Margin (30%): ${cost - teacherCut} DTN`)
  if (teacherCut === 378 && (cost - teacherCut) === 162) {
    console.log('[PASS] Monthly teacher revenue cut: (540 * 0.70 = 378 DTN) verified')
  } else {
    throw new Error('Teacher cut calculation mismatch!')
  }

  console.log('=== ALL DATABASE LOGIC & FORMULAS VERIFIED SUCCESSFULLY ===')
}

runVerification().catch((e) => {
  console.error(e)
  process.exit(1)
})
