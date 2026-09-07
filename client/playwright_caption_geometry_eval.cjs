/**
 * playwright_caption_geometry_eval.cjs
 *
 * Verifies VideoCompositionFrame is always inside the video pixels.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, 'test_assets');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

const FFMPEG = require('C:/Captions AI/caption-app/caption-app/server/node_modules/ffmpeg-static');

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
    execSync(`"${FFMPEG}" -f lavfi -i color=c=0x222222:s=${v.width}x${v.height}:d=2:r=30 -f lavfi -i sine=frequency=440:duration=2 -c:v libx264 -c:a aac -t 2 -pix_fmt yuv420p -y "${vPath}"`, { stdio: 'ignore' });
  } else {
    console.log(`  ${v.name} already exists.`);
  }
}

async function assertGeometry(page, v, vp) {
  await page.waitForTimeout(600);
  const playerEl = page.locator('.bg-black.overflow-hidden.rounded-xl').first();
  const frameEl  = page.locator('[data-testid="video-composition-frame"]').first();

  const playerBox = await playerEl.boundingBox();
  const frameBox  = await frameEl.boundingBox();

  if (!playerBox) { console.error(`  FAIL: No player container`); return false; }
  if (!frameBox)  { console.error(`  FAIL: No caption frame`); return false; }

  console.log(`  Container  : x=${Math.round(playerBox.x)} w=${Math.round(playerBox.width)} h=${Math.round(playerBox.height)}`);
  console.log(`  CaptionFrame: x=${Math.round(frameBox.x)} w=${Math.round(frameBox.width)} h=${Math.round(frameBox.height)}`);

  await page.screenshot({ path: `geometry_${v.width}x${v.height}_${vp.label}.png` });

  const T = 2;
  const pR = playerBox.x + playerBox.width;
  const pB = playerBox.y + playerBox.height;
  const fR = frameBox.x + frameBox.width;
  const fB = frameBox.y + frameBox.height;

  if (frameBox.x < playerBox.x - T) { console.error('  FAIL: left spill'); return false; }
  if (frameBox.y < playerBox.y - T) { console.error('  FAIL: top spill'); return false; }
  if (fR > pR + T) { console.error(`  FAIL: right spill`); return false; }
  if (fB > pB + T) { console.error('  FAIL: bottom spill'); return false; }

  const fAspect = frameBox.width / frameBox.height;
  const vAspect = v.width / v.height;
  if (Math.abs(fAspect - vAspect) > 0.05) {
    console.error(`  FAIL: aspect mismatch frame=${fAspect.toFixed(3)} video=${vAspect.toFixed(3)}`);
    return false;
  }

  console.log('  PASS: Captions contained within video frame.');
  return true;
}

(async () => {
  // ─── Key insight: use a persistent browser context with storageState ──────
  // We sign up once via API (Node-level fetch), then initialize the context
  // with the token already in localStorage so the Zustand store boots
  // with the correct token value and the auth guard passes.

  const browser = await chromium.launch({ headless: true });
  let allPassed = true;

  try {
    // 1. Signup via raw HTTP from Node (no browser needed yet)
    console.log('\n--- Signing up via API ---');
    const http = require('http');
    const token = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        email: 'geo_' + Date.now() + '@test.com',
        password: 'pass123456',
        name: 'GeoBot'
      });
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/signup',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) resolve(parsed.token);
            else reject(new Error('No token: ' + data));
          } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    console.log('  Token obtained:', token.slice(0, 20) + '...');

    // 2. Create browser context with pre-seeded localStorage
    //    origins must match the page origin exactly
    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [
          {
            origin: 'http://localhost:5173',
            localStorage: [
              { name: 'rt_token', value: token }
            ]
          }
        ]
      }
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });

    // 3. Navigate directly to studio — Zustand reads localStorage at module init
    //    and will find rt_token set, so the auth guard will pass
    await page.goto('http://localhost:5173/#/studio');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'geo_00_studio.png' });

    const selectCount = await page.locator('button:has-text("Select File")').count();
    console.log(`  "Select File" visible: ${selectCount}`);

    if (selectCount === 0) {
      const txt = await page.locator('body').innerText().catch(() => '');
      console.error('  Page text:', txt.slice(0, 300));
      throw new Error('Studio auth guard still blocking. Check geo_00_studio.png');
    }
    console.log('  Studio loaded!');

    const viewports = [
      { label: 'landscape', width: 1200, height: 800 },
      { label: 'portrait',  width: 620,  height: 920 },
    ];

    for (const v of testVideos) {
      for (const vp of viewports) {
        console.log(`\n════════════════════════════════════════════════`);
        console.log(`TEST: ${v.label}  |  ${vp.label} (${vp.width}x${vp.height})`);
        console.log(`════════════════════════════════════════════════`);

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForSelector('button:has-text("Select File")', { timeout: 20000 });

        const [fc] = await Promise.all([
          page.waitForEvent('filechooser'),
          page.click('button:has-text("Select File")'),
        ]);
        await fc.setFiles(path.join(ASSETS_DIR, v.name));
        console.log('  Uploading...');

        await page.waitForSelector('button:has-text("Generate Captions")', { timeout: 20000 });
        await page.click('button:has-text("Generate Captions")');
        console.log('  Transcribing...');

        await page.waitForSelector('text=COMIC PUNCH', { timeout: 45000 });
        console.log('  Style step reached. Checking geometry...');

        const passed = await assertGeometry(page, v, vp);
        if (!passed) allPassed = false;

        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1200);
        await page.setViewportSize({ width: 1200, height: 800 });
      }
    }

    if (allPassed) {
      console.log('\n✓ ALL GEOMETRY TESTS PASSED');
      process.exit(0);
    } else {
      console.error('\n✗ SOME TESTS FAILED');
      process.exit(1);
    }
  } catch (err) {
    console.error('\nUnexpected error:', err.message || err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();


