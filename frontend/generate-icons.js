/**
 * Generate ZM icon in all required sizes
 * Install jimp first: npm install jimp
 */

const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

async function generateIcon() {
  // Create icon sizes needed for Android APK
  const sizes = [
    { size: 192, name: 'logo192.png', dir: 'public' },
    { size: 512, name: 'logo512.png', dir: 'public' },
    { size: 96, name: 'icon.png', dir: 'android/app/src/main/res/mipmap-hdpi' },
    { size: 48, name: 'icon.png', dir: 'android/app/src/main/res/mipmap-mdpi' },
    { size: 72, name: 'icon.png', dir: 'android/app/src/main/res/mipmap-ldpi' },
    { size: 192, name: 'icon.png', dir: 'android/app/src/main/res/mipmap-xxxhdpi' },
  ];

  try {
    for (const config of sizes) {
      // Create a new image with gradient background (blue to purple)
      const image = new Jimp(config.size, config.size, 0x4a148cff); // Deep purple background
      
      // Add "ZM" text
      const font = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
      image.print(font, config.size / 4, config.size / 3, 'ZM');
      
      // Create directory if it doesn't exist
      const outputDir = path.join(__dirname, config.dir);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Save the image
      const outputPath = path.join(outputDir, config.name);
      await image.write(outputPath);
      console.log(`✓ Generated ${config.name} (${config.size}x${config.size}) at ${outputPath}`);
    }
    
    console.log('\n✓ All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcon();
