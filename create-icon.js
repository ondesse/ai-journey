const sharp = require('sharp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function createIcon() {
  try {
    const inputPath = path.join(__dirname, 'icon.jpg');
    const outputPath = path.join(__dirname, 'icon.ico');
    
    // Check if input exists
    if (!fs.existsSync(inputPath)) {
      console.error('icon.jpg not found!');
      process.exit(1);
    }
    
    // Load and square the base image
    const base = sharp(inputPath);
    const meta = await base.metadata();
    const size = Math.min(meta.width, meta.height);
    const square = await base
      .resize(size, size, { fit: 'cover', position: 'center' })
      .toBuffer();
    
    // Generate PNG buffers for each size
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngBuffers = [];
    
    for (const s of sizes) {
      const buf = await sharp(square)
        .resize(s, s, { fit: 'fill', kernel: 'lanczos3' })
        .png({ compressionLevel: 9 })
        .toBuffer();
      pngBuffers.push(buf);
    }
    
    // Convert to ICO
    const icoBuffer = await pngToIco(pngBuffers);
    fs.writeFileSync(outputPath, icoBuffer);
    
    console.log('✓ icon.ico created:', outputPath);
    
  } catch (error) {
    console.error('Error creating icon:', error);
    process.exit(1);
  }
}

createIcon().catch((e) => {
  console.error(e);
  process.exit(1);
});
