const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`[NETWORK] ${response.status()} ${response.url()}`);
      response.text().then(text => console.log(`[RESPONSE] ${text.slice(0, 200)}`)).catch(() => {});
    }
  });

  try {
    console.log("Mocking authentication...");
    await page.goto('http://localhost:5173/');
    
    // Inject token via browser fetch
    await page.evaluate(async () => {
       const res = await fetch('/api/signup', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ email: 'test_' + Date.now() + '@test.com', password: 'password', name: 'Tester' })
       });
       const data = await res.json();
       localStorage.setItem('rt_token', data.token);
    });

    console.log("Navigating to Studio...");
    await page.goto('http://localhost:5173/#/studio');
    await page.waitForLoadState('networkidle');

    console.log("Uploading file...");
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'debug_upload_screen.png' });
    await page.waitForSelector('text=Select File', { timeout: 30000 });
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('text=Select File')
    ]);
    
    await fileChooser.setFiles(path.resolve(__dirname, 'dummy_with_audio.mp4'));
    console.log('File selected. Waiting for upload to complete and next step...');


    await page.waitForSelector('text=Generate Captions', { timeout: 15000 });
    console.log("Upload successful! Reached language selection.");

    console.log("Clicking Generate Captions...");
    await page.click('button:has-text("Generate Captions")');

    await page.waitForSelector('text=COMIC PUNCH', { timeout: 30000 });
    console.log("Transcription successful! Reached style selection.");

    await page.click('text=COMIC PUNCH');
    console.log("Selected Comic Punch style.");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'step3_style_preview.png' });
    console.log("Screenshot saved: step3_style_preview.png");

    console.log("Clicking Continue...");
    await page.click('button:has-text("Continue")');

    await page.waitForSelector('text=Customize', { timeout: 30000 });
    console.log("Style applied! Reached customization screen.");

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'step5_edit_preview.png' });
    console.log("Screenshot saved: step5_edit_preview.png");
    
    console.log("SUCCESS: E2E workflow passed.");
  } catch (error) {
    console.error("E2E Test Failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
