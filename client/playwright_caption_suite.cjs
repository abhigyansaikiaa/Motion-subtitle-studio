const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, 'test_assets');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

const FFMPEG = require('C:/Captions AI/caption-app/caption-app/server/node_modules/ffmpeg-static');

// Setup tests
const testVideos = [
  { name: 'test_9_16.mp4',  width: 1080, height: 1920, label: '9:16 Portrait' },
  { name: 'test_16_9.mp4',  width: 1920, height: 1080, label: '16:9 Landscape' },
  { name: 'test_1_1.mp4',   width: 1080, height: 1080, label: '1:1 Square' },
  { name: 'test_4_5.mp4',   width: 1080, height: 1350, label: '4:5 Vertical' },
];

console.log('--- Generating test videos ---');
for (const v of testVideos) {
  const vPath = path.join(ASSETS_DIR, v.name);
  if (!fs.existsSync(vPath)) {
    console.log(`  Generating ${v.name}...`);
    // Create a 5-second video with spoken audio (a sine wave is enough to generate dummy words via whisper if it hallucinates, but let's just test UI behaviour assuming mock segments)
    execSync(`"${FFMPEG}" -f lavfi -i color=c=0x222222:s=${v.width}x${v.height}:d=5:r=30 -f lavfi -i sine=frequency=440:duration=5 -c:v libx264 -c:a aac -t 5 -pix_fmt yuv420p -y "${vPath}"`, { stdio: 'ignore' });
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let allPassed = true;
  
  try {
    // 1. Signup via API
    console.log('\n--- Authenticating ---');
    const http = require('http');
    const token = await new Promise((resolve, reject) => {
      const body = JSON.stringify({ email: 'suite_' + Date.now() + '@test.com', password: 'password', name: 'Tester' });
      const req = http.request({ hostname: '127.0.0.1', port: 3000, path: '/api/signup', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
        let data = ''; res.on('data', d => data += d); res.on('end', () => resolve(JSON.parse(data).token));
      });
      req.write(body); req.end();
    });

    const context = await browser.newContext({
      storageState: { cookies: [], origins: [{ origin: 'http://localhost:5173', localStorage: [{ name: 'rt_token', value: token }] }] }
    });
    
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    // 2. Load Studio and Inject Mock Project
    console.log('\n--- Navigating to Studio ---');
    await page.goto('http://localhost:5173/#/studio');
    await page.waitForLoadState('networkidle');

    // Create a mock project in the store so we don't have to wait for whisper transcription
    await page.evaluate(() => {
      // @ts-ignore
      const store = window.useAppStore.getState();
      const mockSegments = [
        { id: 's1', start: 0, end: 2, words: [
          { id: 'w1', text: 'This', start: 0.1, end: 0.5 },
          { id: 'w2', text: 'is', start: 0.5, end: 0.8 },
          { id: 'w3', text: 'a', start: 0.8, end: 1.0 },
          { id: 'w4', text: 'TEST', start: 1.0, end: 2.0, emphasis: 'hero' }
        ] }
      ];
      store.setCurrentProject({ id: 'mock_proj', videoId: 'test_16_9.mp4', videoUrl: 'http://localhost:3000/uploads/test_16_9.mp4' });
      store.setEditorSegments(mockSegments);
      store.setStep(4); // Skip to Customize step
      store.setCurrentTime(1.5); // Seek to middle of segment
    });
    
    await page.waitForTimeout(1000);
    
    // 3. Test Caption Visibility
    console.log('\n--- Testing Caption Visibility ---');
    const engineCount = await page.locator('[data-testid="caption-engine"]').count();
    if (engineCount === 0) throw new Error("Caption engine not found");
    const wordCount = await page.locator('[data-testid="caption-word"]').count();
    if (wordCount === 0) throw new Error("No animated words found");
    console.log(`  ✓ Found ${wordCount} words active at t=1.5s`);
    
    // 4. Test Color Changes
    console.log('\n--- Testing Customization: Colors ---');
    await page.evaluate(() => {
      // @ts-ignore
      window.useAppStore.getState().setCustomOverrides({ heroColor: '#ff00ff' });
    });
    await page.waitForTimeout(500);
    // Note: React might take a tick, we evaluate actual dom style
    const heroColor = await page.locator('[data-testid="caption-word"]:has-text("TEST")').evaluate(el => el.style.color);
    if (!heroColor.includes('255, 0, 255') && !heroColor.includes('#ff00ff') && !heroColor.includes('rgb(255, 0, 255)')) {
      throw new Error(`Color change failed. Expected #ff00ff, got ${heroColor}`);
    }
    console.log(`  ✓ Hero color correctly applied`);
    
    // 5. Test Font Changes
    console.log('\n--- Testing Customization: Fonts ---');
    await page.evaluate(() => {
      // @ts-ignore
      window.useAppStore.getState().setCustomOverrides({ heroFontFamily: '"JetBrains Mono", monospace' });
    });
    await page.waitForTimeout(500);
    const heroFont = await page.locator('[data-testid="caption-word"]:has-text("TEST")').evaluate(el => el.style.fontFamily);
    if (!heroFont.includes('JetBrains Mono')) {
      throw new Error(`Font change failed. Expected JetBrains Mono, got ${heroFont}`);
    }
    console.log(`  ✓ Hero font correctly applied`);

    // 6. Timeline Sync
    console.log('\n--- Testing Timeline Sync ---');
    await page.evaluate(() => {
      // @ts-ignore
      window.useAppStore.getState().setCurrentTime(3.5); // Outside segment
    });
    await page.waitForTimeout(500);
    const visibleWordsAfterSeek = await page.locator('[data-testid="caption-word"]').evaluateAll(els => 
      els.filter(e => parseFloat(e.style.opacity || '1') > 0.1).length
    );
    if (visibleWordsAfterSeek > 0) {
      throw new Error("Words are still visible outside segment time");
    }
    console.log(`  ✓ Captions correctly hide outside segment bounds`);
    
    console.log('\n✓ ALL CAPTION BEHAVIOUR TESTS PASSED');
    
  } catch (err) {
    console.error('\n✗ TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
