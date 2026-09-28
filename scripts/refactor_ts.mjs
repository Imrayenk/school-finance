import { Project, SyntaxKind } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

project.addSourceFilesAtPaths('src/**/*.ts');
project.addSourceFilesAtPaths('src/**/*.tsx');

console.log('Refactoring dbQuery arrays assumptions in sqlite.ts...');
const sqliteFile = project.getSourceFile('src/db/sqlite.ts');
if (sqliteFile) {
  // Replace checkRooms[0].values[0][0] with checkRooms[0]['COUNT(*)']
  sqliteFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.PropertyAccessExpression || node.getKind() === SyntaxKind.ElementAccessExpression) {
      const text = node.getText();
      if (text === 'checkRooms[0].values[0][0]') {
        node.replaceWithText("checkRooms[0]['COUNT(*)']");
      }
      if (text === 'check[0].values[0][0]') {
        node.replaceWithText("check[0]['COUNT(*)']");
      }
    }
  });

  // Replace res[0].values.map with res.map
  sqliteFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const exp = node.getExpression().getText();
      if (exp === 'res[0].values.map') {
        node.getExpression().replaceWithText('res.map');
      }
    }
  });
}

console.log('Refactoring db.prepare logic across all files...');
const sourceFiles = project.getSourceFiles();

for (const sourceFile of sourceFiles) {
  let madeChanges = false;
  
  // Find all `const stmt = db.prepare(...)`
  const variableDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  
  for (const varDecl of variableDeclarations) {
    const init = varDecl.getInitializer();
    if (init && init.getKind() === SyntaxKind.CallExpression) {
      const exp = init.getExpression().getText();
      if (exp === 'db.prepare') {
        madeChanges = true;
        const stmtName = varDecl.getName();
        const sqlArg = init.getArguments()[0].getText();
        
        // Find the block containing this statement
        const block = varDecl.getFirstAncestorByKind(SyntaxKind.Block) || varDecl.getFirstAncestorByKind(SyntaxKind.SourceFile);
        
        // Look for stmt.bind([params])
        let paramsText = '[]';
        block.forEachDescendant(node => {
          if (node.getKind() === SyntaxKind.CallExpression && node.getExpression().getText() === `${stmtName}.bind`) {
            paramsText = node.getArguments()[0].getText();
            node.getFirstAncestorByKind(SyntaxKind.ExpressionStatement)?.remove();
          }
        });

        // Replace db.prepare with await dbQuery
        varDecl.getInitializer().replaceWithText(`await window.desktopApp.dbQuery(${sqlArg}, ${paramsText})`);
        
        // Now, fix stmt.step() / stmt.getAsObject() loops and conditionals
        // This is tricky via AST alone without breaking things. Let's do it by text replacement on the block level for known patterns.
      }
    }
  }

  // We save the file so we can run regex on it afterwards for the `stmt.step()` patterns
  if (madeChanges || sourceFile === sqliteFile) {
    sourceFile.saveSync();
    console.log(`Saved ${sourceFile.getBaseName()}`);
  }
}
