const fs = require('fs');

const path = 'C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/db/sqlite.ts';
let content = fs.readFileSync(path, 'utf8');

const mangledStart = `      t.name as teacher_name,
      t.subject
    FROM Enrollments e
    JOIN Students s ON e.student_id = s.id
    let totalPayments = 0`;

const replacement = `      t.name as teacher_name,
      t.subject
    FROM Enrollments e
    JOIN Students s ON e.student_id = s.id
    JOIN Teachers t ON e.teacher_id = t.id
    WHERE e.teacher_id = ?
    ORDER BY s.name ASC;
  \`
  const _rows = await window.desktopApp.dbQuery(enrollQuery, [teacherId])
  const result: MatrixStudentRow[] = []

  for (const enr of _rows) {
    const studentId = String(enr.student_id)
    const enrollmentId = String(enr.enrollment_id)
    const hourlyRate = Number(enr.hourly_rate)

    const cells: MatrixAttendanceCell[] = []
    
    for (const d of dates) {
      const sCheckStmt = await window.desktopApp.dbQuery(\`
        SELECT id, duration, status FROM Sessions WHERE enrollment_id = ? AND date = ?;
      \`, [enrollmentId, d])
      
      let sessionId: string | undefined = undefined
      let attended = false
      let duration = 1.0

      if (sCheckStmt.length > 0) {
        const sObj = sCheckStmt[0]
        sessionId = String(sObj.id)
        attended = sObj.status === 'attended'
        duration = Number(sObj.duration || 1.0)
      }
      cells.push({ date: d, attended, duration, sessionId })
    }

    const totalCostStmt = await window.desktopApp.dbQuery(\`
      SELECT COUNT(id) as total_sessions, COALESCE(SUM(duration), 0) as total_duration
      FROM Sessions
      WHERE enrollment_id = ? AND status = 'attended';
    \`, [enrollmentId])
    
    let totalSessionsAttended = 0
    let totalSessionsCost = 0
    if (totalCostStmt.length > 0) {
      const cObj = totalCostStmt[0]
      totalSessionsAttended = Number(cObj.total_sessions || 0)
      totalSessionsCost = Number(cObj.total_duration || 0) * hourlyRate
    }

    const paymentsStmt = await window.desktopApp.dbQuery(\`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM Payments
      WHERE student_id = ?;
    \`, [studentId])

    let totalPayments = 0`;

content = content.replace(mangledStart, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed middle section');
