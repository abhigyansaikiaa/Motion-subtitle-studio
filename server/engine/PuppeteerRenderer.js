const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

async function captureCaptionVideo(projectId, depth, durationSec, outputPath, token, width = 1080, height = 1920, projectData = null) {
  // Spawn a headless browser
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });

  if (projectData) {
    await page.evaluateOnNewDocument((data) => {
      window.injectedProject = data;
    }, projectData);
  }

  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://motion-subtitle-studio.vercel.app';
  const clientUrl = `${clientOrigin}/#/render?projectId=${projectId}&depth=${depth}&token=${token}`;
  
  await page.goto(clientUrl, { waitUntil: 'networkidle0' });

  // Wait for React to mount and say it's ready
  await page.waitForFunction('window.renderReady === true', { timeout: 15000 });

  // Hide scrollbars just in case
  await page.addStyleTag({ content: '::-webkit-scrollbar { display: none; } body { margin: 0; background: transparent; }' });

  const fps = 30;
  const totalFrames = Math.ceil(durationSec * fps);

  return new Promise(async (resolve, reject) => {
    // Spawn FFmpeg to read PNG sequence from stdin
    const ffmpegProcess = spawn(ffmpegPath, [
      '-framerate', fps.toString(),
      '-f', 'image2pipe',
      '-i', '-',
      '-c:v', 'libvpx-vp9',
      '-pix_fmt', 'yuva420p',
      '-b:v', '2M',
      '-auto-alt-ref', '0',
      '-y', outputPath
    ]);

    let ffmpegError = '';
    ffmpegProcess.stderr.on('data', (data) => {
      ffmpegError += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`FFmpeg exited with code ${code}. Stderr: ${ffmpegError}`));
      }
      resolve(outputPath);
    });

    try {
      for (let i = 0; i < totalFrames; i++) {
        const timeSec = i / fps;
        await page.evaluate((t) => { window.setRenderTime(t); }, timeSec);
        
        // Wait for the next animation frame so React/Framer Motion paints
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        
        const buffer = await page.screenshot({ type: 'png', omitBackground: true, encoding: 'binary' });
        
        // Write the frame buffer to FFmpeg's stdin
        // Handle backpressure
        if (!ffmpegProcess.stdin.write(buffer)) {
          await new Promise(r => ffmpegProcess.stdin.once('drain', r));
        }
      }
      
      ffmpegProcess.stdin.end();
      await browser.close();
    } catch (err) {
      ffmpegProcess.kill();
      await browser.close();
      reject(err);
    }
  });
}

module.exports = { captureCaptionVideo };
