const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Replicate the exact project payload from test_new_templates.js
const wordsSeg1 = [
  { id: 'w1', text: 'Welcome', start: 0.5, end: 1.0, emphasis: 'none' },
  { id: 'w2', text: 'to', start: 1.0, end: 1.2, emphasis: 'none' },
  { id: 'w3', text: 'the', start: 1.2, end: 1.4, emphasis: 'none' },
  { id: 'w4', text: 'ultimate', start: 1.4, end: 2.0, emphasis: 'hero' },
  { id: 'w5', text: 'sixty', start: 2.0, end: 2.5, isNumberGroup: true, emphasis: 'hero' },
  { id: 'w6', text: 'second', start: 2.5, end: 3.0, emphasis: 'none' },
  { id: 'w7', text: 'stress', start: 3.0, end: 3.5, emphasis: 'none' },
  { id: 'w8', text: 'test', start: 3.5, end: 4.0, emphasis: 'none' },
];

const wordsSeg2 = [
  { id: 'w9', text: 'This', start: 4.5, end: 4.8, emphasis: 'none' },
  { id: 'w10', text: 'sentence', start: 4.8, end: 5.5, emphasis: 'none' },
  { id: 'w11', text: 'is', start: 5.5, end: 5.8, emphasis: 'none' },
  { id: 'w12', text: 'spoken', start: 5.8, end: 6.5, emphasis: 'none' },
  { id: 'w13', text: 'incredibly', start: 6.5, end: 7.2, emphasis: 'hero' },
  { id: 'w14', text: 'fast', start: 7.2, end: 7.5, emphasis: 'hero' },
  { id: 'w15', text: 'to', start: 7.5, end: 7.7, emphasis: 'none' },
  { id: 'w16', text: 'see', start: 7.7, end: 7.9, emphasis: 'none' },
  { id: 'w17', text: 'if', start: 7.9, end: 8.0, emphasis: 'none' },
  { id: 'w18', text: 'the', start: 8.0, end: 8.1, emphasis: 'none' },
  { id: 'w19', text: 'animations', start: 8.1, end: 8.8, emphasis: 'none' },
  { id: 'w20', text: 'keep', start: 8.8, end: 9.2, emphasis: 'none' },
  { id: 'w21', text: 'up', start: 9.2, end: 9.5, emphasis: 'none' },
];

const wordsSeg3 = [
  { id: 'w22', text: 'And', start: 10.0, end: 11.0, emphasis: 'none' },
  { id: 'w23', text: 'this', start: 11.0, end: 12.0, emphasis: 'none' },
  { id: 'w24', text: 'one', start: 12.0, end: 13.0, emphasis: 'none' },
  { id: 'w25', text: 'is', start: 13.0, end: 14.0, emphasis: 'none' },
  { id: 'w26', text: 'very', start: 14.0, end: 16.0, emphasis: 'hero' },
  { id: 'w27', text: 'slow', start: 16.0, end: 18.0, emphasis: 'hero' },
];

const wordsSeg4 = [
  { id: 'w28', text: 'We', start: 18.5, end: 19.0, emphasis: 'none' },
  { id: 'w29', text: 'have', start: 19.0, end: 19.5, emphasis: 'none' },
  { id: 'w30', text: 'over', start: 19.5, end: 20.0, emphasis: 'none' },
  { id: 'w31', text: '9000', start: 20.0, end: 21.0, isNumberGroup: true, emphasis: 'hero' },
  { id: 'w32', text: 'reasons', start: 21.0, end: 22.0, emphasis: 'none' },
  { id: 'w33', text: 'why', start: 22.5, end: 23.0, emphasis: 'none' },
  { id: 'w34', text: 'this', start: 23.0, end: 23.5, emphasis: 'none' },
  { id: 'w35', text: 'should', start: 23.5, end: 24.5, emphasis: 'hero' },
];

const wordsSeg5 = [
  { id: 'w37', text: 'A', start: 30.0, end: 30.2, emphasis: 'none' },
  { id: 'w38', text: 'really', start: 30.2, end: 31.0, emphasis: 'none' },
  { id: 'w39', text: 'long', start: 31.0, end: 32.0, emphasis: 'none' },
  { id: 'w40', text: 'sentence', start: 32.0, end: 33.0, emphasis: 'none' },
  { id: 'w41', text: 'that', start: 33.0, end: 33.5, emphasis: 'none' },
  { id: 'w42', text: 'takes', start: 33.5, end: 34.0, emphasis: 'none' },
  { id: 'w43', text: 'up', start: 34.0, end: 34.2, emphasis: 'none' },
  { id: 'w44', text: 'multiple', start: 34.2, end: 35.0, emphasis: 'none' },
  { id: 'w45', text: 'lines', start: 35.0, end: 35.5, emphasis: 'none' },
  { id: 'w46', text: 'and', start: 35.5, end: 35.8, emphasis: 'none' },
  { id: 'w47', text: 'shows', start: 35.8, end: 36.5, emphasis: 'none' },
  { id: 'w48', text: 'how', start: 36.5, end: 37.0, emphasis: 'none' },
  { id: 'w49', text: 'scrolling', start: 37.0, end: 38.0, emphasis: 'hero' },
  { id: 'w50', text: 'or', start: 38.0, end: 38.2, emphasis: 'none' },
  { id: 'w51', text: 'layering', start: 38.2, end: 39.0, emphasis: 'hero' },
  { id: 'w52', text: 'behaves', start: 39.0, end: 40.0, emphasis: 'none' },
];

const wordsSeg6 = [
  { id: 'w53', text: 'Finally', start: 55.0, end: 56.0, emphasis: 'hero' },
  { id: 'w54', text: 'we', start: 56.0, end: 56.5, emphasis: 'none' },
  { id: 'w55', text: 'reach', start: 56.5, end: 57.0, emphasis: 'none' },
  { id: 'w56', text: 'the', start: 57.0, end: 57.5, emphasis: 'none' },
  { id: 'w57', text: 'end', start: 57.5, end: 59.0, emphasis: 'hero' },
];

const segments = [
  { id: 'seg1', start: 0.5, end: 4.0, text: 'Welcome to the ultimate sixty second stress test', words: wordsSeg1 },
  { id: 'seg2', start: 4.5, end: 9.5, text: 'This sentence is spoken incredibly fast to see if the animations keep up', words: wordsSeg2 },
  { id: 'seg3', start: 10.0, end: 18.0, text: 'And this one is very slow', words: wordsSeg3 },
  { id: 'seg4', start: 18.5, end: 24.5, text: 'We have over 9000 reasons why this should work', words: wordsSeg4 },
  { id: 'seg5', start: 30.0, end: 40.0, text: 'A really long sentence that takes up multiple lines and shows how scrolling or layering behaves', words: wordsSeg5 },
  { id: 'seg6', start: 55.0, end: 59.0, text: 'Finally we reach the end', words: wordsSeg6 },
];

const templates = {
  scribble: {
    id: 'scribble-highlight',
    name: 'SCRIBBLE HIGHLIGHT',
    fontFamily: '"Geist", sans-serif',
    fontWeight: 600,
    fontStyle: 'normal',
    textTransform: 'uppercase',
    baseColor: '#ffffff',
    baseSize: 36,
    baseOpacity: 1.0,
    heroColor: '#111111',
    heroScale: 1.4,
    heroFontFamily: '"Caveat", cursive',
    heroFontWeight: 700,
    heroFontStyle: 'normal',
    accentColor: '#ffffff',
    alignment: 'center',
    layoutType: 'scribble-highlight',
    letterSpacing: '0.02em',
    lineHeight: 1.2,
    shadow: '0px 2px 8px rgba(0,0,0,0.5)',
    entranceAnimation: 'pop-in',
    heroEntranceAnimation: 'pop-in',
    wordActivation: 'highlight',
    animationSpeed: 1.0,
    captionDepth: 'front',
    position: 'center',
    scribbleColor: '#FFD700',
    scribbleType: 'underline',
  },
  layered: {
    id: 'layered-editorial',
    layoutType: 'layered-editorial',
    fontFamily: '"Geist", sans-serif',
    fontWeight: 500,
    baseSize: 32,
    baseColor: '#ffffff',
    heroColor: '#ff2255',
    heroScale: 2.8,
    heroFontFamily: '"Playfair Display", serif',
    heroFontStyle: 'italic',
    captionDepth: 'mixed', 
    position: 'center',
    entranceAnimation: 'fade-up',
    heroEntranceAnimation: 'fade-up',
  },
  scroll: {
    id: 'continuous-scroll',
    layoutType: 'continuous-scroll',
    fontFamily: '"Geist", sans-serif',
    fontWeight: 700,
    baseSize: 42,
    baseColor: '#ffffff',
    heroColor: '#00e5ff',
    heroScale: 1.2,
    captionDepth: 'front',
    position: 'center',
    continuousScroll: {
      direction: 'up',
      speedMultiplier: 1.0,
      maskGradient: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
    }
  }
};

const TEST_TIMES = [2.0, 7.0, 15.0, 21.0, 37.0, 58.0];

async function capturePreview(templateKey, templateConfig) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const page = await context.newPage();
  
  const projectData = {
    segments,
    customOverrides: templateConfig,
    style: templateConfig.id
  };

  // Add evaluateOnNewDocument so it's ready when the page loads
  await page.addInitScript((data) => {
    window.injectedProject = data;
  }, projectData);

  console.log(`[Preview] Loading UI for ${templateKey}...`);
  await page.goto('http://localhost:5173/#/render?projectId=test-proj-60s&depth=front&token=fake-token', { waitUntil: 'networkidle' });
  
  // Wait for renderReady
  await page.waitForFunction(() => window.renderReady === true, { timeout: 15000 });
  await page.addStyleTag({ content: '::-webkit-scrollbar { display: none; } body { margin: 0; background: transparent; }' });

  // Jump to specific timestamps
  for (const t of TEST_TIMES) {
    console.log(`[Preview] Capturing ${templateKey} at t=${t}s...`);
    await page.evaluate(async (timeSec) => {
      window.setRenderTime(timeSec);
      await new Promise(r => requestAnimationFrame(r));
    }, t);
    
    // allow a brief moment for layout/animations
    await page.waitForTimeout(100); 
    
    const outPath = path.join(__dirname, `parity_preview_${templateKey}_${t}s.png`);
    await page.screenshot({ path: outPath });
  }

  await browser.close();
}

function captureExport(templateKey, videoFilename) {
  const videoPath = path.join(__dirname, 'outputs', videoFilename);
  if (!fs.existsSync(videoPath)) {
    console.error(`[Export] Video not found: ${videoPath}`);
    return;
  }
  
  for (const t of TEST_TIMES) {
    console.log(`[Export] Extracting frame from ${videoFilename} at t=${t}s...`);
    const outPath = path.join(__dirname, `parity_export_${templateKey}_${t}s.png`);
    try {
      execSync(`ffmpeg -y -ss ${t} -i "${videoPath}" -frames:v 1 -q:v 2 "${outPath}" -v quiet`);
    } catch (e) {
      console.error(`[Export] FFmpeg failed for ${videoFilename} at ${t}s`, e.message);
    }
  }
}

async function runParityTest() {
  // 1. Capture UI previews
  await capturePreview('scribble', templates.scribble);
  await capturePreview('layered', templates.layered);
  await capturePreview('scroll', templates.scroll);
  
  // 2. Capture Export frames (assuming exports exist)
  captureExport('scribble', 'out_scribble_60s.mp4');
  captureExport('layered', 'out_layered_60s.mp4');
  captureExport('scroll', 'out_scroll_60s.mp4');
  
  console.log("Parity test frames generated. Please inspect visually or via pixelmatch.");
}

runParityTest().catch(console.error);
