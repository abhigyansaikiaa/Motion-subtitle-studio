const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('=== Opening Test Harness ===');
    await page.goto('http://localhost:5173/mediapipe_test.html');
    await page.waitForLoadState('networkidle');
    
    console.log('=== Uploading Reference Video ===');
    const videoPath = 'C:\\Users\\karma\\Downloads\\Day4 Offbook - 2.mp4';
    
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#videoInput')
    ]);
    await fileChooser.setFiles(videoPath);
    console.log('File selected');
    
    console.log('=== Waiting for MediaPipe to initialize and process frames ===');
    // Wait for frames to be processed (FPS > 0)
    await page.waitForFunction(() => {
      const fps = parseInt(document.getElementById('fpsDisplay').innerText);
      return fps > 0;
    }, { timeout: 30000 });
    
    // Let it play for a few seconds to capture motion
    await page.waitForTimeout(3000);
    
    console.log('=== Capturing Screenshot ===');
    await page.screenshot({ path: 'mediapipe_eval.png', fullPage: true });
    console.log('Screenshot saved to mediapipe_eval.png');
    
  } catch (err) {
    console.error('Error:', err);
    await page.screenshot({ path: 'mediapipe_error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
