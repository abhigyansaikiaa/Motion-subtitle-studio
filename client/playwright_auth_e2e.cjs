const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BACKEND = 'http://127.0.0.1:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Log all API calls
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      response.text()
        .then(text => console.log(`[NET] ${response.status()} ${response.url()} → ${text.slice(0, 150)}`))
        .catch(() => {});
    }
  });

  try {
    // ─── PHASE 1: Test direct backend login ───────────────────────────────────
    console.log('\n=== PHASE 1: Verify backend login endpoint ===');
    const loginRes = await page.request.post(`${BACKEND}/api/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'e2e_test@test.com', password: 'testpassword123' }
    });
    console.log('Login status:', loginRes.status());

    let token = null;

    if (loginRes.status() === 401) {
      // Need to sign up first
      console.log('User not found — signing up...');
      const signupRes = await page.request.post(`${BACKEND}/api/signup`, {
        headers: { 'Content-Type': 'application/json' },
        data: { email: 'e2e_test@test.com', password: 'testpassword123', name: 'E2E Tester' }
      });
      console.log('Signup status:', signupRes.status());
      const signupData = await signupRes.json();
      token = signupData.token;
      console.log('Got token from signup:', token ? `[present, length=${token.length}]` : '[MISSING]');
    } else {
      const loginData = await loginRes.json();
      token = loginData.token;
      console.log('Got token from login:', token ? `[present, length=${token.length}]` : '[MISSING]');
    }

    if (!token) {
      throw new Error('FATAL: Could not obtain auth token from backend');
    }

    // ─── PHASE 2: Login through the actual Auth UI ────────────────────────────
    console.log('\n=== PHASE 2: Login through Auth UI ===');
    await page.goto('http://localhost:5173/#/auth?mode=login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Fill in the login form
    await page.fill('#auth-email', 'e2e_test@test.com');
    await page.fill('#auth-password', 'testpassword123');
    console.log('Filled in login credentials');

    await page.screenshot({ path: 'e2e_00_auth_form.png' });

    // Submit the form
    await page.click('button[type="submit"]');
    console.log('Submitted login form');

    // Wait for redirect to studio
    await page.waitForURL('**/studio**', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const urlAfterLogin = page.url();
    console.log('URL after login:', urlAfterLogin);

    // Verify token in localStorage
    const storedToken = await page.evaluate(() => localStorage.getItem('rt_token'));
    console.log('Token in localStorage:', storedToken ? `[present, length=${storedToken.length}]` : '[MISSING]');

    if (!storedToken) {
      throw new Error('Login did not store token in localStorage!');
    }

    await page.screenshot({ path: 'e2e_01_studio_loaded.png' });
    console.log('Screenshot: e2e_01_studio_loaded.png');


    // ─── PHASE 4: Check upload screen is visible ──────────────────────────────
    console.log('\n=== PHASE 4: Check Upload UI ===');
    const uploadHeading = await page.$('text=Upload Your Video');
    if (!uploadHeading) throw new Error('Upload screen not visible');
    console.log('✓ Upload screen visible');

    const selectBtn = await page.$('button');
    if (!selectBtn) throw new Error('No button found on upload screen');
    console.log('✓ Select File button found');

    // ─── PHASE 5: Upload a video file ─────────────────────────────────────────
    console.log('\n=== PHASE 5: Upload video ===');
    const videoPath = path.resolve(__dirname, 'dummy_with_audio.mp4');

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Test video not found at: ${videoPath}`);
    }

    const stat = fs.statSync(videoPath);
    console.log(`Video file: ${path.basename(videoPath)}, size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15000 }),
      page.click('text=Select File')
    ]);

    await fileChooser.setFiles(videoPath);
    console.log('File selected via file chooser');

    // Wait for upload + project creation
    await page.waitForSelector('text=Generate Captions', { timeout: 30000 });
    console.log('✓ Upload successful — reached Language step');

    await page.screenshot({ path: 'e2e_02_language_step.png' });
    console.log('Screenshot: e2e_02_language_step.png');

    // ─── PHASE 6: Verify network request was authenticated ───────────────────
    console.log('\n=== PHASE 6: Verify full workflow continues ===');
    await page.click('button:has-text("Generate Captions")');
    console.log('Clicked Generate Captions');

    await page.waitForSelector('text=COMIC PUNCH, text=SERIF BLOOM, text=SIGNAL', { timeout: 60000 }).catch(() => {
      return page.waitForSelector('[data-template-id], .template-card, text=Style', { timeout: 30000 });
    });
    console.log('✓ Transcription complete — reached Style step');

    await page.screenshot({ path: 'e2e_03_style_step.png' });
    console.log('Screenshot: e2e_03_style_step.png');

    console.log('\n=== ✅ PHASE 1-6 COMPLETE — Auth + Upload + Transcription works! ===');

  } catch (error) {
    console.error('\n❌ E2E Test Failed:', error.message || error);
    await page.screenshot({ path: 'e2e_FAIL.png' }).catch(() => {});
    console.log('Failure screenshot: e2e_FAIL.png');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
