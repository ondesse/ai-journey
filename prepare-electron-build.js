const fs = require('fs');
const path = require('path');

// This script prepares the Next.js build for Electron packaging
// It ensures the static files and public folder are in the correct location for the standalone build

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');
const staticSrc = path.join(root, '.next', 'static');
const staticDest = path.join(standalone, '.next', 'static');
const publicSrc = path.join(root, 'public');
const publicDest = path.join(standalone, 'public');

console.log('Preparing Electron build...');

if (!fs.existsSync(standalone)) {
  console.error('Missing .next/standalone. Did you set output: \'standalone\' in next.config.ts?');
  process.exit(1);
}

if (fs.existsSync(staticSrc)) {
  console.log('Copying .next/static to standalone/.next/static...');
  copyDir(staticSrc, staticDest);
  console.log('✓ Static files copied');
}

if (fs.existsSync(publicSrc)) {
  console.log('Copying public to standalone/public...');
  copyDir(publicSrc, publicDest);
  console.log('✓ Public files copied');
}

console.log('Prepared standalone output:');
console.log('-', staticDest);
console.log('-', publicDest);
console.log('✓ Electron build preparation complete');


