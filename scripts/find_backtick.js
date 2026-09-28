const fs = require('fs');
const lines = fs.readFileSync('C:/Users/Imray/.gemini/antigravity-ide/scratch/soutien-scolaire-admin/src/db/sqlite.ts', 'utf8').split('\n');
let inString = false;
for (let i = 0; i < lines.length; i++) {
  let matches = (lines[i].match(/`/g) || []).length;
  if (matches % 2 !== 0) {
    inString = !inString;
    console.log(inString ? 'Opened at ' : 'Closed at ', i + 1, lines[i].trim());
  }
}
