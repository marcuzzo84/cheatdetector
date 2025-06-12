// Simple script to create placeholder icons for the extension
// In production, you'd use proper icon files

const fs = require('fs');
const path = require('path');

const iconSizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname);

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create simple SVG icons for each size
iconSizes.forEach(size => {
  const svgContent = `
<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="4" fill="#667eea"/>
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="white"/>
</svg>`.trim();

  // Convert SVG to base64 data URL for use as icon
  const base64 = Buffer.from(svgContent).toString('base64');
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  
  // Create a simple HTML file that can be converted to PNG
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; }
    img { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="FairPlay-Scout Icon">
</body>
</html>`;

  fs.writeFileSync(path.join(iconsDir, `icon-${size}.html`), htmlContent);
});

console.log('✅ Created placeholder icon files');