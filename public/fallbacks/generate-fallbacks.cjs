const fs = require('fs');
const path = require('path');

const dir = __dirname;

// Create 6 simple SVG grayscale backgrounds
const colors = [50, 60, 70, 80, 90, 100];

colors.forEach((gray, idx) => {
  const lighter = Math.min(gray + 40, 255);
  const svg = `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(${gray},${gray},${gray});stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(${lighter},${lighter},${lighter});stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#grad${idx})"/>
</svg>`;

  const filename = path.join(dir, `bw${idx + 1}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`Created ${filename}`);
});

console.log('All fallback images created!');
