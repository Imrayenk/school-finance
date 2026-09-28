const fs = require('fs');

const path = 'C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/db/sqlite.ts';
let lines = fs.readFileSync(path, 'utf8').split('\n');

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export async function setBatchAttendanceForDate(')) {
    startIndex = i;
  }
  if (startIndex !== -1 && lines[i].includes('export async function toggleAttendance(')) {
    endIndex = i - 1;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  const replacementLines = `export async function setBatchAttendanceForDate(
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
`.split('\n');

  lines.splice(startIndex, endIndex - startIndex + 1, ...replacementLines);
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('Fixed setBatchAttendanceForDate');
} else {
  console.log('Could not find bounds');
}
