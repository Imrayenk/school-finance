const fs = require('fs');

const path = 'C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/db/sqlite.ts';
let content = fs.readFileSync(path, 'utf8');

// I need to rename the FIRST occurrence of getTeacherAttendanceMatrix to getAttendanceDashboardData
// and change its signature.

const oldFunc = `export async function getTeacherAttendanceMatrix(
  teacherId: string,
  dates: string[]
): Promise<MatrixStudentRow[]> {`;

const newFunc = `export async function getAttendanceDashboardData(
  date: string,
  teacherId?: string,
  searchQuery: string = ''
): Promise<any[]> {`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(path, content, 'utf8');
console.log('Replaced function signature');
