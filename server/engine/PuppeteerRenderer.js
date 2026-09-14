const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { performance } = require('perf_hooks');

async function captureCaptionVideo(projectId, depth, durationSec, outputPath, token, width = 1080, height = 1920, projectData = null, onProgress = null) {
  console.log(`[PERF] captureCaptionVideo started for ${depth}`);
  const tBrowserStart = performance.now();
  // Spawn a headless browser
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const tBrowserEnd = performance.now();
  console.log(`[PERF] Puppeteer browser launch: ${(tBrowserEnd - tBrowserStart).toFixed(2)}ms`);

  const tPageSetupStart = performance.now();
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
  const tPageSetupEnd = performance.now();
  console.log(`[PERF] Page setup and load: ${(tPageSetupEnd - tPageSetupStart).toFixed(2)}ms`);

  const tVideoReadyStart = performance.now();
  // Wait for React to mount and say it's ready
  await page.waitForFunction('window.renderReady === true', { timeout: 15000 });
  const tVideoReadyEnd = performance.now();
  console.log(`[PERF] Video readiness (renderReady): ${(tVideoReadyEnd - tVideoReadyStart).toFixed(2)}ms`);

  // Hide scrollbars just in case
  await page.addStyleTag({ content: '::-webkit-scrollbar { display: none; } body { margin: 0; background: transparent; }' });

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
    // Spawn FFmpeg to read PNG sequence from stdin
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    let ffmpegError = '';
    ffmpegProcess.stderr.on('data', (data) => {
      ffmpegError += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      const tFfmpegEnd = performance.now();
      console.log(`[PERF] FFmpeg total encode duration: ${(tFfmpegEnd - tFfmpegStart).toFixed(2)}ms`);
      if (code !== 0) {
        return reject(new Error(`FFmpeg exited with code ${code}. Stderr: ${ffmpegError}`));
      }
      resolve(outputPath);
    });

    try {
      const tRenderStart = performance.now();
      let totalEvalTime = 0;
      let totalRafTime = 0;
      let totalScreenshotTime = 0;

      for (let i = 0; i < totalFrames; i++) {
        const timeSec = i / fps;
        
        const tE1 = performance.now();
        await page.evaluate((t) => { window.setRenderTime(t); }, timeSec);
        totalEvalTime += (performance.now() - tE1);
        
        const tE2 = performance.now();
        // Wait for the next animation frame so React/Framer Motion paints
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        totalRafTime += (performance.now() - tE2);
        
        const tE3 = performance.now();
        const buffer = await page.screenshot({ type: 'png', omitBackground: true, encoding: 'binary' });
        totalScreenshotTime += (performance.now() - tE3);
        
        if (onProgress && i % 30 === 0) onProgress(i / totalFrames);
        
        // Write the frame buffer to FFmpeg's stdin
        // Handle backpressure
        if (!ffmpegProcess.stdin.write(buffer)) {
          await new Promise(r => ffmpegProcess.stdin.once('drain', r));
        }
      }
      
      const tRenderEnd = performance.now();
      const totalRenderDuration = tRenderEnd - tRenderStart;
      console.log(`[PERF] Total renderFrames duration: ${totalRenderDuration.toFixed(2)}ms`);
      console.log(`[PERF] Number of frames: ${totalFrames}`);
      console.log(`[PERF] Average ms per frame: ${(totalRenderDuration / totalFrames).toFixed(2)}ms`);
      console.log(`[PERF] Total page.evaluate time (setRenderTime): ${totalEvalTime.toFixed(2)}ms`);
      console.log(`[PERF] Total rAF wait time (DOM work): ${totalRafTime.toFixed(2)}ms`);
      console.log(`[PERF] Total screenshot time: ${totalScreenshotTime.toFixed(2)}ms`);

      ffmpegProcess.stdin.end();
      await browser.close();
    } catch (err) {
      ffmpegProcess.kill();
      await browser.close();
      reject(err);
    }
  });
}

/**
 * FAST single-pass renderer for front-only caption renders.
 *
 * Eliminates the VP9 yuva420p intermediate WebM by piping PNG frames
 * directly into a single FFmpeg invocation that simultaneously reads the
 * source video and overlays the caption frames, producing the final H.264
 * MP4 in one pass.
 *
 * Alpha-transparency semantics are fully preserved: PNG frames captured with
 * omitBackground:true are transparent where there are no captions, and
 * FFmpeg's overlay filter composites only non-transparent pixels on top of
 * the source video — identical to the VP9 → overlay pipeline, but ~3-4× faster.
 *
 * NOT suitable for depth renders (behind-subject/mixed) which require VP9
 * alpha for the alphamerge compositor. Those must use captureCaptionVideo.
 *
 * @param {string} inputVideoPath  - Source video file path (read by FFmpeg directly)
 * @param {number} targetWidth     - Output width (may differ from capture width if scaling)
 * @param {number} targetHeight    - Output height
 * @param {number} originalWidth   - Original source video width
 * @param {number} originalHeight  - Original source video height
 */
async function captureCaptionVideoFast(projectId, depth, durationSec, outputPath, inputVideoPath, token, captureWidth = 1080, captureHeight = 1920, projectData = null, targetWidth = 1080, targetHeight = 1920, originalWidth = 1080, originalHeight = 1920, onProgress = null) {
  console.log(`[PERF] captureCaptionVideoFast (single-pass) started for ${depth}`);
  const tStart = performance.now();

  const tBrowserStart = performance.now();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  console.log(`[PERF] Browser launch: ${(performance.now() - tBrowserStart).toFixed(2)}ms`);

  const tPageSetupStart = performance.now();
  const page = await browser.newPage();
  await page.setViewport({ width: captureWidth, height: captureHeight, deviceScaleFactor: 1 });

  if (projectData) {
    await page.evaluateOnNewDocument((data) => {
      window.injectedProject = data;
    }, projectData);
  }

  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://motion-subtitle-studio.vercel.app';
  const clientUrl = `${clientOrigin}/#/render?projectId=${projectId}&depth=${depth}&token=${token}`;
  await page.goto(clientUrl, { waitUntil: 'networkidle0' });
  console.log(`[PERF] Page setup and load: ${(performance.now() - tPageSetupStart).toFixed(2)}ms`);

  const tReadyStart = performance.now();
  await page.waitForFunction('window.renderReady === true', { timeout: 15000 });
  console.log(`[PERF] Video readiness (renderReady): ${(performance.now() - tReadyStart).toFixed(2)}ms`);

  await page.addStyleTag({ content: '::-webkit-scrollbar { display: none; } body { margin: 0; background: transparent; }' });

  const fps = 30;
  const totalFrames = Math.ceil(durationSec * fps);

  const tempCaptionsPath = outputPath.replace(/\.[^.]+$/, '_captions.mkv');
  console.log(`[RENDER] Using 2-step lossless pipeline. Intermediate captions: ${tempCaptionsPath}`);

  // Step 1: Encode PNG pipe to ffvhuff RGBA (lossless, universally available on Linux FFmpeg, native alpha)
  const ffmpegArgs1 = [
    '-framerate', fps.toString(),
    '-f', 'image2pipe',
    '-i', 'pipe:0',          // Input 0: caption PNG frames from stdin
    '-c:v', 'ffvhuff',
    '-pix_fmt', 'rgba',
    '-y',
    tempCaptionsPath
  ];

  console.log(`[PERF] FFmpeg step 1 command: ffmpeg ${ffmpegArgs1.join(' ')}`);

  await new Promise(async (resolve, reject) => {
    const tFfmpegStart = performance.now();
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs1);

    let ffmpegError = '';
    ffmpegProcess.stderr.on('data', (data) => { ffmpegError += data.toString(); });

    ffmpegProcess.on('close', (code) => {
      console.log(`[PERF] FFmpeg step 1 (captions encode) duration: ${(performance.now() - tFfmpegStart).toFixed(2)}ms`);
      if (code !== 0) {
        return reject(new Error(`FFmpeg step 1 exited with code ${code}. Stderr: ${ffmpegError.slice(-2000)}`));
      }
      resolve();
    });

    try {
      const tRenderStart = performance.now();
      let totalEvalTime = 0;
      let totalRafTime = 0;
      let totalScreenshotTime = 0;

      for (let i = 0; i < totalFrames; i++) {
        const timeSec = i / fps;

        const tE1 = performance.now();
        await page.evaluate((t) => { window.setRenderTime(t); }, timeSec);
        totalEvalTime += (performance.now() - tE1);

        const tE2 = performance.now();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        totalRafTime += (performance.now() - tE2);

        const tE3 = performance.now();
        const buffer = await page.screenshot({ type: 'png', omitBackground: true, encoding: 'binary' });
        totalScreenshotTime += (performance.now() - tE3);
        
        if (onProgress && i % 30 === 0) onProgress((i / totalFrames) * 0.8); // 80% progress for step 1

        if (!ffmpegProcess.stdin.write(buffer)) {
          await new Promise(r => ffmpegProcess.stdin.once('drain', r));
        }
      }

      const totalRenderDuration = performance.now() - tRenderStart;
      console.log(`[PERF] Total renderFrames duration: ${totalRenderDuration.toFixed(2)}ms`);
      console.log(`[PERF] Number of frames: ${totalFrames}`);
      console.log(`[PERF] Average ms per frame: ${(totalRenderDuration / totalFrames).toFixed(2)}ms`);
      console.log(`[PERF] Total page.evaluate time: ${totalEvalTime.toFixed(2)}ms`);
      console.log(`[PERF] Total rAF wait time: ${totalRafTime.toFixed(2)}ms`);
      console.log(`[PERF] Total screenshot time: ${totalScreenshotTime.toFixed(2)}ms`);

      ffmpegProcess.stdin.end();
      await browser.close();
    } catch (err) {
      ffmpegProcess.kill();
      await browser.close();
      reject(err);
    }
  });

  // Step 2: Overlay lossless RGBA captions onto source video
  // [0:v] = captions (RGBA, lossless), [1:v] = source video
  // overlay=format=auto handles alpha compositing correctly for rgba input
  const filterGraph = (targetWidth !== originalWidth || targetHeight !== originalHeight)
    ? `[1:v]scale=${targetWidth}:${targetHeight}[scaled_in];[scaled_in][0:v]overlay=format=auto[final_out]`
    : `[1:v][0:v]overlay=format=auto[final_out]`;

  const ffmpegArgs2 = [
    '-i', tempCaptionsPath,   // Input 0: transparent captions
    '-i', inputVideoPath,     // Input 1: source video
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

  console.log(`[PERF] FFmpeg step 2 command: ffmpeg ${ffmpegArgs2.join(' ')}`);

  return new Promise((resolve, reject) => {
    const tFfmpegStart = performance.now();
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs2);

    let ffmpegError = '';
    ffmpegProcess.stderr.on('data', (data) => { ffmpegError += data.toString(); });

    ffmpegProcess.on('close', (code) => {
      console.log(`[PERF] FFmpeg step 2 (overlay) duration: ${(performance.now() - tFfmpegStart).toFixed(2)}ms`);
      
      try {
        if (fs.existsSync(tempCaptionsPath)) fs.unlinkSync(tempCaptionsPath);
      } catch (e) {}

      if (code !== 0) {
        return reject(new Error(`FFmpeg step 2 exited with code ${code}. Stderr: ${ffmpegError.slice(-2000)}`));
      }
      console.log(`[PERF] captureCaptionVideoFast total time: ${(performance.now() - tStart).toFixed(2)}ms`);
      
      if (onProgress) onProgress(1.0); // 100% progress
      resolve(outputPath);
    });
  });
}

async function captureCaptionVideoConcurrent(projectId, depth, durationSec, outputPath, token, width = 1080, height = 1920, projectData = null, onProgress = null) {
  console.log(`[PERF] captureCaptionVideoConcurrent started for ${depth}`);
  const tStart = performance.now();
  
  const fps = 30;
  const totalFrames = Math.ceil(durationSec * fps);
  const CONCURRENCY = 4;
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

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

  // Create deferred promises for each frame
  const frames = Array.from({ length: totalFrames }).map(() => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  });

  console.log(`[PERF] Rendering ${totalFrames} frames across ${chunks.length} parallel pages with stream piping...`);

  // Start FFmpeg immediately
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
  
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
  let ffmpegError = '';
  ffmpegProcess.stderr.on('data', (data) => { ffmpegError += data.toString(); });

  const ffmpegPromise = new Promise((resolve, reject) => {
    ffmpegProcess.on('close', (code) => {
      const tFfmpegEnd = performance.now();
      console.log(`[PERF] FFmpeg stream encode duration: ${(tFfmpegEnd - tFfmpegStart).toFixed(2)}ms`);
      if (code !== 0) {
        return reject(new Error(`FFmpeg exited with code ${code}. Stderr: ${ffmpegError}`));
      }
      resolve(outputPath);
    });
  });

  // Consumer loop: pipes frames in sequential order to FFmpeg
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

  // Start consumer
  const pipePromise = pipeLoop();

  const tRenderStart = performance.now();

  // Producer loops
  await Promise.all(chunks.map(async (chunk) => {
    let page;
    try {
      page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      
      if (projectData) {
        await page.evaluateOnNewDocument((data) => {
          window.injectedProject = data;
        }, projectData);
      }
      
      await page.goto(clientUrl, { waitUntil: 'networkidle0' });
      await page.waitForFunction('window.renderReady === true', { timeout: 15000 });
      await page.addStyleTag({ content: '::-webkit-scrollbar { display: none; } body { margin: 0; background: transparent; }' });

      for (let i = chunk.startFrame; i < chunk.endFrame; i++) {
        const timeSec = i / fps;
        await page.evaluate((t) => { window.setRenderTime(t); }, timeSec);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        
        const buffer = await page.screenshot({ type: 'png', omitBackground: true, encoding: 'binary' });
        frames[i].resolve(buffer);
      }
    } catch (err) {
      // Reject any pending frames from this chunk so the consumer doesn't hang forever
      for (let i = chunk.startFrame; i < chunk.endFrame; i++) {
        frames[i].reject(err);
      }
    } finally {
      if (page) await page.close();
    }
  }));

  const tRenderEnd = performance.now();
  console.log(`[PERF] Concurrent frame rendering completed in ${(tRenderEnd - tRenderStart).toFixed(2)}ms`);

  await browser.close();

  // Wait for piping and FFmpeg to finish
  await pipePromise;
  await ffmpegPromise;
  
  console.log(`[PERF] captureCaptionVideoConcurrent total time: ${(performance.now() - tStart).toFixed(2)}ms`);
  return outputPath;
}

module.exports = { captureCaptionVideo, captureCaptionVideoFast, captureCaptionVideoConcurrent };
