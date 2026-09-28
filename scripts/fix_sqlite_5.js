const fs = require('fs');

const path = 'C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/db/sqlite.ts';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// Find the line that has getTeacherAttendanceMatrix right after getTeacherDailySheet ends
let startIndex = -1;
for (let i = 400; i < lines.length; i++) {
  if (lines[i].includes('export async function getTeacherAttendanceMatrix')) {
    startIndex = i;
    break;
  }
}

if (startIndex !== -1) {
  // First, we need to put back what was deleted by the broken replace_file_content tool:
  const fixString = `  }

  return result
}

export async function getAttendanceDashboardData(
  date: string,
  teacherId?: string,
  searchQuery: string = ''
): Promise<any[]> {
  const db = await getDatabase()

  const enrollQuery = \`
    SELECT 
      e.id as enrollment_id,`;

  lines.splice(startIndex, 0, ...fixString.split('\n'));
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('Fixed function definition.');
} else {
  console.log('Could not find start index');
}
