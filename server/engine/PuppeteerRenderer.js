const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { performance } = require('perf_hooks');

let globalBrowser = null;
let globalPage = null;

async function getGlobalBrowserAndPage(width, height) {
  if (!globalBrowser) {
    console.log(`[PERF] Launching global headless browser...`);
    globalBrowser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-animations',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding'
      ]
    });
    globalPage = await globalBrowser.newPage();
  }
  await globalPage.setViewport({ width, height, deviceScaleFactor: 1 });
  return { browser: globalBrowser, page: globalPage };
}

async function captureCaptionVideo(projectId, depth, durationSec, outputPath, token, width = 1080, height = 1920, projectData = null, onProgress = null) {
  console.log(`[PERF] captureCaptionVideo started for ${depth}`);
  const tStart = performance.now();
  
  const { page } = await getGlobalBrowserAndPage(width, height);
  const cdpSession = await page.target().createCDPSession();

  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://motion-subtitle-studio.vercel.app';
  const clientUrl = `${clientOrigin}/#/render?projectId=${projectId}&depth=${depth}&token=${token}`;
  
  const tPageSetupStart = performance.now();
  
  if (page.url() === 'about:blank' || !page.url().includes('#/render')) {
    // First load
    if (projectData) {
      await page.evaluateOnNewDocument((data) => {
        window.injectedProject = data;
      }, projectData);
    }
    await page.goto(clientUrl, { waitUntil: 'networkidle0' });
    console.log(`[PERF] Page setup and load (cold): ${(performance.now() - tPageSetupStart).toFixed(2)}ms`);
    
    const tVideoReadyStart = performance.now();
    await page.waitForFunction('window.renderReady === true', { timeout: 15000 });
    console.log(`[PERF] Video readiness (renderReady): ${(performance.now() - tVideoReadyStart).toFixed(2)}ms`);
    
    await page.addStyleTag({ content: '::-webkit-scrollbar { display: none; } body { margin: 0; background: transparent; }' });
  } else {
    // Cached load
    if (projectData) {
      await page.evaluate((data) => {
        window.renderReady = false;
        window.dispatchEvent(new CustomEvent('updateProject', { detail: data }));
      }, projectData);
      console.log(`[PERF] Page setup (cached): ${(performance.now() - tPageSetupStart).toFixed(2)}ms`);
      
      const tVideoReadyStart = performance.now();
      await page.waitForFunction('window.renderReady === true', { timeout: 15000 });
      console.log(`[PERF] Video readiness (renderReady): ${(performance.now() - tVideoReadyStart).toFixed(2)}ms`);
    }
  }

  const fps = 30;
  const totalFrames = Math.ceil(durationSec * fps);
  
  return new Promise(async (resolve, reject) => {
    const tFfmpegStart = performance.now();
    const ffmpegArgs = [
      '-framerate', fps.toString(),
      '-f', 'image2pipe',
      '-i', '-',
      '-c:v', 'libvpx-vp9',
      '-pix_fmt', 'yuva420p',
      '-b:v', '2M',
      '-auto-alt-ref', '0',
      '-y', outputPath
    ];
    console.log(`[PERF] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    let ffmpegError = '';
    ffmpegProcess.stderr.on('data', (data) => {
      ffmpegError += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`[PERF] FFmpeg total encode duration: ${(performance.now() - tFfmpegStart).toFixed(2)}ms`);
      if (code !== 0) {
        return reject(new Error(`FFmpeg exited with code ${code}. Stderr: ${ffmpegError}`));
      }
      resolve(outputPath);
    });

    try {
      const tRenderStart = performance.now();
      let totalEvalTime = 0;
      let totalScreenshotTime = 0;

      for (let i = 0; i < totalFrames; i++) {
        const timeSec = i / fps;
        
        const tE1 = performance.now();
        await page.evaluate(async (t) => { 
          window.setRenderTime(t); 
          await new Promise(resolve => requestAnimationFrame(resolve));
        }, timeSec);
        totalEvalTime += (performance.now() - tE1);
        
        const tE3 = performance.now();
        const { data } = await cdpSession.send('Page.captureScreenshot', { format: 'png' });
        const buffer = Buffer.from(data, 'base64');
        totalScreenshotTime += (performance.now() - tE3);
        
        if (onProgress && i % 30 === 0) onProgress(i / totalFrames);
        
        if (!ffmpegProcess.stdin.write(buffer)) {
          await new Promise(r => ffmpegProcess.stdin.once('drain', r));
        }
      }
      
      const totalRenderDuration = performance.now() - tRenderStart;
      console.log(`[PERF] Total renderFrames duration: ${totalRenderDuration.toFixed(2)}ms`);
      console.log(`[PERF] Number of frames: ${totalFrames}`);
      console.log(`[PERF] Average ms per frame: ${(totalRenderDuration / totalFrames).toFixed(2)}ms`);
      console.log(`[PERF] Total page.evaluate time (setRenderTime + rAF): ${totalEvalTime.toFixed(2)}ms`);
      console.log(`[PERF] Total CDP capture time: ${totalScreenshotTime.toFixed(2)}ms`);

      ffmpegProcess.stdin.end();
      // NOTE: We do not close the global browser/page here!
      cdpSession.detach();
    } catch (err) {
      ffmpegProcess.kill();
      cdpSession.detach();
      reject(err);
    }
  });
}

/**
 * FAST single-pass renderer for front-only caption renders.
 */
async function captureCaptionVideoFast(projectId, depth, durationSec, outputPath, inputVideoPath, token, captureWidth = 1080, captureHeight = 1920, projectData = null, targetWidth = 1080, targetHeight = 1920, originalWidth = 1080, originalHeight = 1920, onProgress = null) {
  console.log(`[PERF] captureCaptionVideoFast (single-pass) started for ${depth}`);
  const tStart = performance.now();

  const { page } = await getGlobalBrowserAndPage(captureWidth, captureHeight);
  const cdpSession = await page.target().createCDPSession();

  if (projectData) {
    await page.evaluate((data) => {
      window.injectedProject = data;
    }, projectData);
  }

  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://motion-subtitle-studio.vercel.app';
  const clientUrl = `${clientOrigin}/#/render?projectId=${projectId}&depth=${depth}&token=${token}`;
  
  const tPageSetupStart = performance.now();
  await page.goto(clientUrl, { waitUntil: 'networkidle0' });
  console.log(`[PERF] Page setup and load: ${(performance.now() - tPageSetupStart).toFixed(2)}ms`);

  const tReadyStart = performance.now();
  await page.waitForFunction('window.renderReady === true', { timeout: 15000 });
  console.log(`[PERF] Video readiness (renderReady): ${(performance.now() - tReadyStart).toFixed(2)}ms`);

  await page.addStyleTag({ content: '::-webkit-scrollbar { display: none; } body { margin: 0; background: transparent; }' });

  const fps = 30;
  const totalFrames = Math.ceil(durationSec * fps);

  const filterGraph = (targetWidth !== originalWidth || targetHeight !== originalHeight)
    ? `[1:v]scale=${targetWidth}:${targetHeight}[scaled_in];[scaled_in][0:v]overlay=format=auto[final_out]`
    : `[1:v][0:v]overlay=format=auto[final_out]`;

  const ffmpegArgs = [
    '-framerate', fps.toString(),
    '-f', 'image2pipe',
    '-thread_queue_size', '512',
    '-i', 'pipe:0',           // Input 0: PNG frames (captions) from stdin
    '-i', inputVideoPath,     // Input 1: Source video
    '-filter_complex', filterGraph,
    '-map', '[final_out]',
    '-map', '1:a?',           // Preserve audio from source video
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-y',
    outputPath
  ];

  console.log(`[PERF] FFmpeg true single-pass command: ffmpeg ${ffmpegArgs.join(' ')}`);

  await new Promise(async (resolve, reject) => {
    const tFfmpegStart = performance.now();
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    let ffmpegError = '';
    ffmpegProcess.stderr.on('data', (data) => { ffmpegError += data.toString(); });

    ffmpegProcess.on('close', (code) => {
      console.log(`[PERF] FFmpeg single-pass duration: ${(performance.now() - tFfmpegStart).toFixed(2)}ms`);
      if (code !== 0) {
        return reject(new Error(`FFmpeg single-pass exited with code ${code}. Stderr: ${ffmpegError.slice(-2000)}`));
      }
      resolve();
    });

    try {
      const tRenderStart = performance.now();
      let totalEvalTime = 0;
      let totalScreenshotTime = 0;

      for (let i = 0; i < totalFrames; i++) {
        const timeSec = i / fps;

        const tE1 = performance.now();
        await page.evaluate(async (t) => { 
          window.setRenderTime(t); 
          await new Promise(resolve => requestAnimationFrame(resolve));
        }, timeSec);
        totalEvalTime += (performance.now() - tE1);

        const tE3 = performance.now();
        const { data } = await cdpSession.send('Page.captureScreenshot', { format: 'png' });
        const buffer = Buffer.from(data, 'base64');
        totalScreenshotTime += (performance.now() - tE3);
        
        if (onProgress && i % 30 === 0) onProgress(i / totalFrames); 

        if (!ffmpegProcess.stdin.write(buffer)) {
          await new Promise(r => ffmpegProcess.stdin.once('drain', r));
        }
      }

      const totalRenderDuration = performance.now() - tRenderStart;
      console.log(`[PERF] Total renderFrames duration: ${totalRenderDuration.toFixed(2)}ms`);
      console.log(`[PERF] Number of frames: ${totalFrames}`);
      console.log(`[PERF] Average ms per frame: ${(totalRenderDuration / totalFrames).toFixed(2)}ms`);
      console.log(`[PERF] Total combined evaluate time: ${totalEvalTime.toFixed(2)}ms`);
      console.log(`[PERF] Total CDP capture time: ${totalScreenshotTime.toFixed(2)}ms`);

      ffmpegProcess.stdin.end();
      cdpSession.detach();
    } catch (err) {
      ffmpegProcess.kill();
      cdpSession.detach();
      reject(err);
    }
  });

  console.log(`[PERF] captureCaptionVideoFast total time: ${(performance.now() - tStart).toFixed(2)}ms`);
  
  if (onProgress) onProgress(1.0); // 100% progress
  return outputPath;
}

async function captureCaptionVideoConcurrent(projectId, depth, durationSec, outputPath, token, width = 1080, height = 1920, projectData = null, onProgress = null) {
  console.log(`[PERF] captureCaptionVideoConcurrent started for ${depth}`);
  const tStart = performance.now();
  
  const fps = 30;
  const totalFrames = Math.ceil(durationSec * fps);
  const CONCURRENCY = 4;
  
  // Reuse global browser but create multiple ephemeral pages
  if (!globalBrowser) {
    await getGlobalBrowserAndPage(width, height);
  }

  const chunkSize = Math.ceil(totalFrames / CONCURRENCY);
  const chunks = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    const startFrame = i * chunkSize;
    if (startFrame >= totalFrames) break;
    const endFrame = Math.min((i + 1) * chunkSize, totalFrames);
    chunks.push({ startFrame, endFrame });
  }

  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://motion-subtitle-studio.vercel.app';
  const clientUrl = `${clientOrigin}/#/render?projectId=${projectId}&depth=${depth}&token=${token}`;

  const frames = Array.from({ length: totalFrames }).map(() => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  });

  console.log(`[PERF] Rendering ${totalFrames} frames across ${chunks.length} parallel pages with stream piping...`);

  const tFfmpegStart = performance.now();
  const ffmpegArgs = [
    '-framerate', fps.toString(),
    '-f', 'image2pipe',
    '-thread_queue_size', '512',
    '-i', '-',
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',
    '-b:v', '2M',
    '-auto-alt-ref', '0',
    '-y', outputPath
  ];
  
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
  let ffmpegError = '';
  ffmpegProcess.stderr.on('data', (data) => { ffmpegError += data.toString(); });

  const ffmpegPromise = new Promise((resolve, reject) => {
    ffmpegProcess.on('close', (code) => {
      console.log(`[PERF] FFmpeg stream encode duration: ${(performance.now() - tFfmpegStart).toFixed(2)}ms`);
      if (code !== 0) {
        return reject(new Error(`FFmpeg exited with code ${code}. Stderr: ${ffmpegError}`));
      }
      resolve(outputPath);
    });
  });

  const pipeLoop = async () => {
    for (let i = 0; i < totalFrames; i++) {
      const buffer = await frames[i].promise;
      if (onProgress && i % 30 === 0) onProgress(i / totalFrames);
      if (!ffmpegProcess.stdin.write(buffer)) {
        await new Promise(r => ffmpegProcess.stdin.once('drain', r));
      }
    }
    ffmpegProcess.stdin.end();
  };

  const pipePromise = pipeLoop();
  const tRenderStart = performance.now();

  await Promise.all(chunks.map(async (chunk) => {
    let page;
    let cdpSession;
    try {
      page = await globalBrowser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      cdpSession = await page.target().createCDPSession();
      
      if (projectData) {
        await page.evaluate((data) => {
          window.injectedProject = data;
        }, projectData);
      }
      
      await page.goto(clientUrl, { waitUntil: 'networkidle0' });
      await page.waitForFunction('window.renderReady === true', { timeout: 15000 });
      await page.addStyleTag({ content: '::-webkit-scrollbar { display: none; } body { margin: 0; background: transparent; }' });

      for (let i = chunk.startFrame; i < chunk.endFrame; i++) {
        const timeSec = i / fps;
        await page.evaluate(async (t) => { 
          window.setRenderTime(t); 
          await new Promise(resolve => requestAnimationFrame(resolve));
        }, timeSec);
        
        const { data } = await cdpSession.send('Page.captureScreenshot', { format: 'png' });
        const buffer = Buffer.from(data, 'base64');
        frames[i].resolve(buffer);
      }
    } catch (err) {
      for (let i = chunk.startFrame; i < chunk.endFrame; i++) {
        frames[i].reject(err);
      }
    } finally {
      if (cdpSession) cdpSession.detach();
      if (page) await page.close();
    }
  }));

  const tRenderEnd = performance.now();
  console.log(`[PERF] Concurrent frame rendering completed in ${(tRenderEnd - tRenderStart).toFixed(2)}ms`);

  await pipePromise;
  await ffmpegPromise;
  
  console.log(`[PERF] captureCaptionVideoConcurrent total time: ${(performance.now() - tStart).toFixed(2)}ms`);
  return outputPath;
}

module.exports = { captureCaptionVideo, captureCaptionVideoFast, captureCaptionVideoConcurrent };
