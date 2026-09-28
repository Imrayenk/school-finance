const fs = require('fs');

function fixFiles() {
  const sqliteTs = 'C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/db/sqlite.ts';
  let sqliteContent = fs.readFileSync(sqliteTs, 'utf8');
  sqliteContent = sqliteContent.replace(
    /const enrolledStudents: any\[\] = \[\]\s*while \(enrollStmt\.step\(\)\) \{\s*enrolledStudents\.push\(enrollStmt\[0\]\)\s*\}/,
    'const enrolledStudents: any[] = enrollStmt;'
  );
  fs.writeFileSync(sqliteTs, sqliteContent);
  console.log('Fixed sqlite.ts');

  const dashboardTsx = 'C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/components/Dashboard.tsx';
  let dashContent = fs.readFileSync(dashboardTsx, 'utf8');
  dashContent = dashContent.replace(/sCountStmt\.step\(\)/g, '');
  dashContent = dashContent.replace(/tCountStmt\.step\(\)/g, '');
  dashContent = dashContent.replace(/eCountStmt\.step\(\)/g, '');
  dashContent = dashContent.replace(/ttCountStmt\.step\(\)/g, '');
  dashContent = dashContent.replace(/costStmt\.step\(\)/g, '');
  dashContent = dashContent.replace(/paidStmt\.step\(\)/g, '');
  fs.writeFileSync(dashboardTsx, dashContent);
  console.log('Fixed Dashboard.tsx');

  const compteRenduTsx = 'C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/components/CompteRenduModal.tsx';
  let compteContent = fs.readFileSync(compteRenduTsx, 'utf8');
  compteContent = compteContent.replace(/if \(sCountStmt\.step\(\)\)/g, 'if (sCountStmt.length > 0)');
  compteContent = compteContent.replace(/if \(tCountStmt\.step\(\)\)/g, 'if (tCountStmt.length > 0)');
  fs.writeFileSync(compteRenduTsx, compteContent);
  console.log('Fixed CompteRenduModal.tsx');
}

fixFiles();
