const fs = require('fs');

const path = 'C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/db/sqlite.ts';
let lines = fs.readFileSync(path, 'utf8').split('\n');

let startIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('FROM Enrollments e') && lines[i+1] && lines[i+1].includes('JOIN Students s ON e.student_id = s.id') && lines[i+2] && lines[i+2].includes('let totalPayments = 0')) {
    startIndex = i + 1;
    break;
  }
}

if (startIndex !== -1) {
  const replacementLines = `    JOIN Teachers t ON e.teacher_id = t.id
    WHERE e.teacher_id = ? AND s.name LIKE ?
    ORDER BY s.name ASC;
  \`
  const _rows = await window.desktopApp.dbQuery(enrollQuery, [teacherId, \`%\${searchQuery}%\`])
  const result: any[] = []
  for (const enr of _rows) {
      const enrollmentId = String(enr.enrollment_id)
      const studentId = String(enr.student_id)
      const hourlyRate = Number(enr.hourly_rate)

      // Fetch today's session
      const sessionCheckStmt = await window.desktopApp.dbQuery(\`
        SELECT id, duration, status FROM Sessions WHERE enrollment_id = ? AND date = ?;
      \`, [enrollmentId, date])
      
      let todaySessionId: string | undefined = undefined
      let todayAttended = false
      let todayDuration = 1.0

      if (sessionCheckStmt.length > 0) {
        const sObj = sessionCheckStmt[0]
        todaySessionId = String(sObj.id)
        todayAttended = sObj.status === 'attended'
        todayDuration = Number(sObj.duration || 1.0)
      }

      // Total sessions studied across ALL TIME
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
      \`, [studentId])`.split('\n');

  lines.splice(startIndex + 1, 0, ...replacementLines);
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('Fixed block 1');
} else {
  console.log('Could not find start index');
}
