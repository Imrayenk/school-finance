import { createWindowsInstaller } from 'electron-winstaller';
import path from 'path';

const rootPath = process.cwd();

async function build() {
  console.log('Building setup.exe...');
  try {
    await createWindowsInstaller({
      appDirectory: path.join(rootPath, 'release', 'Espoir-win32-x64'),
      outputDirectory: path.join(rootPath, 'release', 'installer'),
      authors: 'Imray',
      exe: 'Espoir.exe',
      setupExe: 'Espoir-Setup.exe',
      noMsi: true
    });
    console.log('Successfully created setup.exe!');
  } catch (e) {
    console.error(`Failed to build installer: ${e.message}`);
  }
}

build();
