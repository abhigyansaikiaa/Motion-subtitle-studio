const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function captureCaptionVideo(projectId, depth, durationSec, outputPath, token, width = 1080, height = 1920) {
  // Spawn a headless browser
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });

  // Expose a function to catch when rendering is done (if we want to signal from UI)
  // For now we'll just wait for `renderReady`
  
  const clientOrigin = process.env.CLIENT_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;
  const clientUrl = `${clientOrigin}/#/render?projectId=${projectId}&depth=${depth}&token=${token}`;
  await page.goto(clientUrl, { waitUntil: 'networkidle0' });

  // Wait for React to mount and say it's ready
  await page.waitForFunction('window.renderReady === true', { timeout: 10000 });

  const fps = 30;
  const totalFrames = Math.ceil(durationSec * fps);
  
  // We'll capture frames as PNGs in a temporary directory
  const tempDir = path.join(__dirname, '..', 'outputs', `frames_${projectId}_${depth}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Hide scrollbars just in case
  await page.addStyleTag({ content: '::-webkit-scrollbar { display: none; } body { margin: 0; background: transparent; }' });

  for (let i = 0; i < totalFrames; i++) {
    const timeSec = i / fps;
    // Set the render time on the page
    await page.evaluate((t) => {
      window.setRenderTime(t);
    }, timeSec);

    // Give React a tiny bit of time to update DOM (usually requestAnimationFrame sync is instant in headless evaluate, but just to be safe)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    const framePath = path.join(tempDir, `frame_${String(i).padStart(5, '0')}.png`);
    await page.screenshot({ path: framePath, type: 'png', omitBackground: true });
  }

  await browser.close();

  // Now combine the PNG sequence into a transparent WebM using FFmpeg
  // (webm with vp9 supports alpha channel)
  return new Promise((resolve, reject) => {
    const ffmpegPath = require('ffmpeg-static');
    // Note: libvpx-vp9 is required for transparent webm
    const cmd = `"${ffmpegPath}" -framerate ${fps} -i "${path.join(tempDir, 'frame_%05d.png')}" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 2M -auto-alt-ref 0 -y "${outputPath}"`;
    
    exec(cmd, (err, stdout, stderr) => {
      // Cleanup frames
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch(e) {}
      
      if (err) return reject(new Error(stderr || err.message));
      resolve(outputPath);
    });
  });
}

module.exports = { captureCaptionVideo };
