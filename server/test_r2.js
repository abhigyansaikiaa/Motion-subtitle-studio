require('dotenv').config();
const r2 = require('./storage/r2');
const fs = require('fs');

async function run() {
  await r2.init();
  console.log('R2 initialized');

  fs.writeFileSync('test.txt', 'Hello from R2 test');

  try {
    await r2.uploadFile('test.txt', 'test/test.txt');
    console.log('Upload successful');
  } catch(e) {
    console.error('Upload failed:', e.message);
  }

  try {
    const url = await r2.getPresignedUrl('test/test.txt');
    console.log('Presigned URL:', url);
  } catch(e) {
    console.error('Presigned URL failed:', e.message);
  }
}

run();
