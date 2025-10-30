import { cp } from 'node:fs/promises';

(async () => {
  try {
    await cp('dist/index.html', 'dist/404.html');
    console.log('✓ 404.html generated from index.html');
  } catch (err) {
    console.error('✗ Failed to copy 404.html:', err.message);
    process.exit(1);
  }
})();
