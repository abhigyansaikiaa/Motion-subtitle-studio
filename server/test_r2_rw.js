require('dotenv').config();
const r2 = require('./storage/r2');
const fs = require('fs');

async function runTest() {
  const testKey = `test-rw-${Date.now()}.txt`;
  const localFile = 'test-r2-rw.txt';
  const downloadFile = 'test-r2-rw-download.txt';
  
  try {
    // 1. Initialize
    console.log('1. Initializing R2...');
    await r2.init();
    console.log('R2 initialized successfully.');

    // 2. Upload
    console.log(`2. Uploading test file: ${testKey}...`);
    fs.writeFileSync(localFile, 'R2 read/write test content');
    await r2.uploadFile(localFile, testKey);
    console.log('Upload successful.');

    // 3. Read back
    console.log('3. Downloading test file...');
    await r2.downloadFile(testKey, downloadFile);
    const content = fs.readFileSync(downloadFile, 'utf8');
    if (content !== 'R2 read/write test content') {
      throw new Error(`Content mismatch! Expected 'R2 read/write test content' but got '${content}'`);
    }
    console.log('Download successful and content verified.');

    // 4. Delete
    console.log('4. Deleting test file...');
    await r2.deleteFile(testKey);
    console.log('Deletion successful.');

    console.log('\n✅ PASS: R2 read/write connectivity test completed successfully.');
  } catch (err) {
    console.error(`\n❌ FAIL: R2 read/write connectivity test failed.`);
    console.error(`Exact Error: ${err.message}`);
  } finally {
    // Cleanup local files
    if (fs.existsSync(localFile)) fs.unlinkSync(localFile);
    if (fs.existsSync(downloadFile)) fs.unlinkSync(downloadFile);
  }
}

runTest();
