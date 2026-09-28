const fs = require('fs');

const file = 'node_modules/app-builder-lib/out/electron/electronGet.js';
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    'await (0, promises_1.rename)(tempUnpackDir, unpackDir);',
    `let retries = 5;
    while(retries > 0) {
      try {
        await (0, promises_1.rename)(tempUnpackDir, unpackDir);
        break;
      } catch(e) {
        if(e.code === 'EPERM') {
          console.log('Caught EPERM, retrying rename in 2s...');
          await new Promise(r => setTimeout(r, 2000));
          retries--;
        } else {
          throw e;
        }
      }
    }
    if(retries === 0) throw new Error('EPERM rename failed after retries');`
  );
  
  // Also try replacing the fs_extra_1 one just in case
  content = content.replace(
    'await fs_extra_1.rename(tempUnpackDir, unpackDir);',
    `let retries = 5;
    while(retries > 0) {
      try {
        await fs_extra_1.rename(tempUnpackDir, unpackDir);
        break;
      } catch(e) {
        if(e.code === 'EPERM' || e.code === 'EACCES') {
          console.log('Caught EPERM/EACCES, retrying rename in 2s...');
          await new Promise(r => setTimeout(r, 2000));
          retries--;
        } else {
          throw e;
        }
      }
    }
    if(retries === 0) throw new Error('EPERM rename failed after retries');`
  );
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Patched electronGet.js');
} else {
  console.log('File not found:', file);
}
