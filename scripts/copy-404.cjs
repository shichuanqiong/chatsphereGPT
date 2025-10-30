const fs = require('fs').promises;
const path = require('path');

(async () => {
  try {
    await fs.cp(path.join(__dirname, '../dist/index.html'), path.join(__dirname, '../dist/404.html'));
    console.log('✓ 404.html generated from index.html');
  } catch (err) {
    console.error('✗ Failed to copy 404.html:', err.message);
    process.exit(1);
  }
})();
