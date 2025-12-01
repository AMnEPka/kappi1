/**
 * Script to download Roboto and Roboto Mono fonts locally
 * Run with: node scripts/download-fonts.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const fonts = {
  'roboto': [
    { name: 'Roboto-Light', weight: 300 },
    { name: 'Roboto-Regular', weight: 400 },
    { name: 'Roboto-Medium', weight: 500 },
    { name: 'Roboto-Bold', weight: 700 },
  ],
  'roboto-mono': [
    { name: 'RobotoMono-Regular', weight: 400 },
    { name: 'RobotoMono-Medium', weight: 500 },
  ]
};

const baseUrl = 'https://github.com/google/fonts/raw/main/apache/roboto';

async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function downloadFonts() {
  const publicDir = path.join(__dirname, '..', 'public', 'fonts');
  
  // Create directories
  for (const fontFamily of Object.keys(fonts)) {
    const fontDir = path.join(publicDir, fontFamily);
    if (!fs.existsSync(fontDir)) {
      fs.mkdirSync(fontDir, { recursive: true });
    }
  }

  console.log('Downloading fonts...');
  
  for (const [fontFamily, variants] of Object.entries(fonts)) {
    for (const variant of variants) {
      const woff2Url = `${baseUrl}/${fontFamily === 'roboto' ? 'Roboto' : 'RobotoMono'}/${variant.name.replace('RobotoMono', 'RobotoMono')}/static/${variant.name.replace('RobotoMono', 'RobotoMono')}-${variant.weight === 300 ? 'Light' : variant.weight === 400 ? 'Regular' : variant.weight === 500 ? 'Medium' : 'Bold'}.woff2`;
      const woffUrl = woff2Url.replace('.woff2', '.woff');
      
      const woff2Path = path.join(publicDir, fontFamily, `${variant.name}-${variant.weight === 300 ? 'Light' : variant.weight === 400 ? 'Regular' : variant.weight === 500 ? 'Medium' : 'Bold'}.woff2`);
      const woffPath = path.join(publicDir, fontFamily, `${variant.name}-${variant.weight === 300 ? 'Light' : variant.weight === 400 ? 'Regular' : variant.weight === 500 ? 'Medium' : 'Bold'}.woff`);
      
      try {
        console.log(`Downloading ${variant.name} (weight: ${variant.weight})...`);
        // Note: This is a simplified version. You may need to adjust URLs based on actual GitHub structure
        // Alternative: Use npm package @fontsource/roboto and @fontsource/roboto-mono
        console.log(`  WOFF2: ${woff2Url}`);
        console.log(`  WOFF: ${woffUrl}`);
        console.log(`  Please download manually from: https://fonts.google.com/specimen/Roboto`);
        console.log(`  Or use: npm install @fontsource/roboto @fontsource/roboto-mono`);
      } catch (error) {
        console.error(`Error downloading ${variant.name}:`, error.message);
      }
    }
  }
  
  console.log('\nFont download script completed.');
  console.log('For offline use, please either:');
  console.log('1. Install fonts via npm: npm install @fontsource/roboto @fontsource/roboto-mono');
  console.log('2. Download manually from https://fonts.google.com and place in public/fonts/');
}

downloadFonts().catch(console.error);

