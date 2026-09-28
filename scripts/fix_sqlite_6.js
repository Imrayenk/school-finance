const fs = require('fs');

const path = 'C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/db/sqlite.ts';
let lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 530; i < 550; i++) {
  if (lines[i] && lines[i].includes('    })') && lines[i+1] && lines[i+1].includes('      e.hourly_rate,')) {
    const replacement = `    })
  }

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
      e.id as enrollment_id,
      e.hourly_rate,`.split('\n');
    lines.splice(i, 2, ...replacement);
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Fixed completely!');
    break;
  }
}
