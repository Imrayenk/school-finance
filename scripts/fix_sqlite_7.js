const fs = require('fs');

const path = 'C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/db/sqlite.ts';
let lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 640; i < 680; i++) {
  if (lines[i].includes('export async function getAttendanceDashboardData(')) {
    lines[i] = 'export async function getTeacherAttendanceMatrix(';
    lines[i+1] = '  teacherId: string,';
    lines[i+2] = '  dates: string[]';
    lines[i+3] = '): Promise<MatrixStudentRow[]> {';
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Fixed getTeacherAttendanceMatrix signature');
    break;
  }
}
