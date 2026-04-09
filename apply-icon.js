const { rcedit } = require('rcedit');
const path = require('path');
const fs = require('fs');

async function applyIcon() {
  const exePath = path.join(__dirname, 'dist', 'LoL Draft Tool-win32-x64', 'LoL Draft Tool.exe');
  const iconPath = path.join(__dirname, 'icon.ico');
  
  if (!fs.existsSync(exePath)) {
    console.error('Executable not found. Build the app first.');
    process.exit(1);
  }
  
  if (!fs.existsSync(iconPath)) {
    console.error('icon.ico not found. Run create-icon.js first.');
    process.exit(1);
  }
  
  try {
    console.log('Applying icon to executable...');
    await rcedit(exePath, {
      icon: iconPath
    });
    console.log('✓ Icon applied successfully!');
  } catch (error) {
    console.error('Error applying icon:', error);
    process.exit(1);
  }
}

applyIcon();

