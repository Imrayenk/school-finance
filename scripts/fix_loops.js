const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix while loops
  // while (tMetricStmt.step()) { const obj = tMetricStmt.getAsObject() ... } tMetricStmt.free()
  // Pattern: while \(([\w]+)\.step\(\)\) \{\s*(?:const|let) ([\w]+) = \1\.getAsObject\(\)
  let newContent = content.replace(
    /while \(([\w]+)\.step\(\)\) \{\s*(?:const|let) ([\w]+) = \1\.getAsObject\(\)/g,
    'for (const $2 of $1) {'
  );
  
  // Also if the obj declaration was on the next line or there are newlines:
  newContent = newContent.replace(
    /while\s*\(([\w]+)\.step\(\)\)\s*\{\s*(?:const|let) ([\w]+)\s*=\s*\1\.getAsObject\(\)/g,
    'for (const $2 of $1) {'
  );

  // Fix if statements
  // if (payStmt.step()) { totalPaid = Number(payStmt.getAsObject().total_paid || 0) } payStmt.free()
  // This is a bit trickier. We can change `if (payStmt.step())` to `if (payStmt.length > 0)`
  // And `payStmt.getAsObject()` to `payStmt[0]`
  newContent = newContent.replace(
    /if\s*\(([\w]+)\.step\(\)\)\s*\{/g,
    'if ($1.length > 0) {'
  );
  
  newContent = newContent.replace(
    /([\w]+)\.getAsObject\(\)/g,
    '$1[0]'
  );

  // Remove .free()
  newContent = newContent.replace(
    /[\w]+\.free\(\)[\r\n;]*/g,
    ''
  );
  
  // Remove .bind([...])
  newContent = newContent.replace(
    /[\w]+\.bind\([^)]+\)[\r\n;]*/g,
    ''
  );

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log('Fixed', filePath);
  }
}

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fullPath = path.join(dir, f);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      fixFile(fullPath);
    }
  }
}

processDir(srcDir);
