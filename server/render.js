const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const { captureCaptionVideo, captureCaptionVideoFast, captureCaptionVideoConcurrent } = require('./engine/PuppeteerRenderer');
const ffprobePath = require('ffprobe-static').path;

/**
 * Gets video duration and dimensions using ffprobe
 */
function getVideoMeta(inputPath) {
  return new Promise((resolve, reject) => {
    exec(`"${ffprobePath}" -v quiet -print_format json -show_format -show_streams "${inputPath}"`, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      try {
        const metadata = JSON.parse(stdout);
        const format = metadata.format || {};
        const durationSec = parseFloat(format.duration) || 30;

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          return resolve({ durationSec, width: 1080, height: 1920 });
        }

        let width = videoStream.width;
        let height = videoStream.height;

        // Check for rotation metadata (e.g., from smartphones)
        const tags = videoStream.tags || {};
        const rotation = Math.abs(parseInt(tags.rotate || '0', 10));
        if (rotation === 90 || rotation === 270) {
          const temp = width;
          width = height;
          height = temp;
        }

        resolve({ durationSec, width, height });
      } catch (e) {
        console.error("[RENDER] Failed to parse ffprobe output", e);
        resolve({ durationSec: 30, width: 1080, height: 1920 });
      }
    });
  });
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 500 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

/**
 * Simple front-only render path (no segmentation needed).
 *
 * PRIMARY:  captureCaptionVideoFast — single-pass FFmpeg, no VP9 intermediate.
 * FALLBACK: captureCaptionVideo    — proven sequential renderer (VP9 → H.264).
 *
 * The fallback activates automatically on any failure of the fast path so
 * a transient FFmpeg or Puppeteer error never fails the job silently.
 */
async function renderFront(inputPath, outputPath, durationSec, projectId, token, targetWidth, targetHeight, originalWidth, originalHeight, segments, template) {
  console.log(`[RENDER] Capturing foreground and compositing (front-only single-pass) at ${targetWidth}x${targetHeight}...`);
  try {
    await captureCaptionVideoFast(
      projectId,
      'front',
      durationSec,
      outputPath,
      inputPath,
      token,
      targetWidth,
      targetHeight,
      { segments, customOverrides: template, style: template.id || 'classic' },
      targetWidth,
      targetHeight,
      originalWidth,
      originalHeight
    );
    console.log('[RENDER] Fast single-pass render completed successfully.');
  } catch (fastErr) {
    console.error('[RENDER] Fast single-pass render failed, falling back to sequential VP9 renderer:', fastErr.message);
    // Clean up any partial output left by the failed fast render
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch(e) {}

    const fgTextPath = outputPath.replace(/\.[^.]+$/, '_fg.webm');
    await captureCaptionVideo(projectId, 'front', durationSec, fgTextPath, token, targetWidth, targetHeight, { segments, customOverrides: template, style: template.id || 'classic' });

    let filterGraph = `[0:v][1:v]overlay=0:0[final_out]`;
    if (targetWidth !== originalWidth || targetHeight !== originalHeight) {
      filterGraph = `[0:v]scale=${targetWidth}:${targetHeight}[scaled_in];[scaled_in][1:v]overlay=0:0[final_out]`;
    }
    const cmd = `"${ffmpegPath}" -i "${inputPath}" -c:v libvpx-vp9 -i "${fgTextPath}" ` +
                `-filter_complex "${filterGraph}" -map "[final_out]" -map 0:a? ` +
                `-c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 192k ` +
                `-movflags +faststart -y "${outputPath}"`;
    await runCommand(cmd);
    try { fs.unlinkSync(fgTextPath); } catch(e) {}
    console.log('[RENDER] Sequential VP9 fallback render completed successfully.');
  }
}

/**
 * Full depth render path: behind-subject or mixed.
 * SAFETY: This path is ONLY reached when captionDepth === 'behind-subject'
 * or 'mixed'. Front-only projects can never reach this function.
 * Uses Python MediaPipe segmentation to composite:
 *   [behind captions] → [subject fg extracted from mask] → [front captions]
 */
async function renderDepth(inputPath, outputPath, durationSec, projectId, token, targetWidth, targetHeight, originalWidth, originalHeight, segments, template) {
  console.log('[RENDER] Depth render path selected — VP9 alpha intermediates required.');
  const bgTextPath = outputPath.replace(/\.[^.]+$/, '_bg.webm');
  const fgTextPath = outputPath.replace(/\.[^.]+$/, '_fg.webm');
  const maskPath   = outputPath.replace(/\.[^.]+$/, '_mask.mp4');

  console.log(`[RENDER] Capturing background text layer (depth mode) at ${targetWidth}x${targetHeight}...`);
  await captureCaptionVideoConcurrent(projectId, 'behind', durationSec, bgTextPath, token, targetWidth, targetHeight, { segments, customOverrides: template, style: template.id || 'classic' });

  console.log(`[RENDER] Capturing foreground text layer (depth mode) at ${targetWidth}x${targetHeight}...`);
  await captureCaptionVideoConcurrent(projectId, 'front', durationSec, fgTextPath, token, targetWidth, targetHeight, { segments, customOverrides: template, style: template.id || 'classic' });

  console.log(`[RENDER] Generating subject mask via Python MediaPipe...`);
  await new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'segment.py');
    exec(`python "${pythonScript}" "${inputPath}" "${maskPath}"`, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve();
    });
  });

  console.log(`[RENDER] Compositing (depth mode)...`);

  let filterGraph = [
    `[0:v][1:v]overlay=0:0[base_with_bg]`,
    `[2:v]format=gray[mask]`,
    `[0:v][mask]alphamerge[fg_subject]`,
    `[base_with_bg][fg_subject]overlay=0:0[with_fg_subject]`,
    `[with_fg_subject][3:v]overlay=0:0[final_out]`
  ].join(';');

  if (targetWidth !== originalWidth || targetHeight !== originalHeight) {
    filterGraph = [
      `[0:v]scale=${targetWidth}:${targetHeight}[scaled_in]`,
      `[2:v]scale=${targetWidth}:${targetHeight},format=gray[mask]`,
      `[scaled_in][1:v]overlay=0:0[base_with_bg]`,
      `[scaled_in][mask]alphamerge[fg_subject]`,
      `[base_with_bg][fg_subject]overlay=0:0[with_fg_subject]`,
      `[with_fg_subject][3:v]overlay=0:0[final_out]`
    ].join(';');
  }

  const cmd = `"${ffmpegPath}" -i "${inputPath}" -c:v libvpx-vp9 -i "${bgTextPath}" -i "${maskPath}" -c:v libvpx-vp9 -i "${fgTextPath}" ` +
              `-filter_complex "${filterGraph}" -map "[final_out]" -map 0:a? ` +
              `-c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 192k ` +
              `-movflags +faststart -y "${outputPath}"`;

  await runCommand(cmd);

  // Cleanup temp files
  try {
    fs.unlinkSync(bgTextPath);
    fs.unlinkSync(fgTextPath);
    fs.unlinkSync(maskPath);
  } catch(e) {}
}

/**
 * Main entry point.
 * Dispatches to the correct render path based on captionDepth in the template.
 *
 * @param {string} inputPath   - Absolute path to the source video file
 * @param {string} outputPath  - Absolute path for the output MP4
 * @param {Array}  segments    - Caption segments (for reference, not directly used here)
 * @param {Object} template    - Template object containing captionDepth and other style props
 * @param {string} projectId   - Project ID used by PuppeteerRenderer to fetch segments from the API
 */
async function renderVideo(inputPath, outputPath, segments, template, projectId, token, resolution = 'original') {
  const { durationSec, width, height } = await getVideoMeta(inputPath);
  console.log(`[RENDER] Original dimensions: ${width}x${height}, duration: ${durationSec}s | project: ${projectId} | depth: ${template?.captionDepth || 'front'} | resolution: ${resolution}`);

  let targetWidth = width;
  let targetHeight = height;

  if (resolution === '1080p') {
     if (height > width) {
        targetHeight = 1920;
        targetWidth = Math.round((1920 / height) * width);
     } else {
        targetWidth = 1920;
        targetHeight = Math.round((1920 / width) * height);
     }
  } else if (resolution === '720p') {
     if (height > width) {
        targetHeight = 1280;
        targetWidth = Math.round((1280 / height) * width);
     } else {
        targetWidth = 1280;
        targetHeight = Math.round((1280 / width) * height);
     }
  }

  // Enforce even dimensions for libx264
  if (targetWidth % 2 !== 0) targetWidth += 1;
  if (targetHeight % 2 !== 0) targetHeight += 1;
  
  targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
  targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;
  
  console.log(`[RENDER] Target dimensions: ${targetWidth}x${targetHeight}`);

  const captionDepth = template?.captionDepth || 'front';

  // SAFETY: only behind-subject and mixed modes use the depth compositor.
  // All other values — including undefined, null, 'front', or any unknown value —
  // fall through to the fast single-pass renderer.
  if (captionDepth === 'behind-subject' || captionDepth === 'mixed') {
    console.log(`[RENDER] Dispatching to depth renderer (captionDepth=${captionDepth})`);
    await renderDepth(inputPath, outputPath, durationSec, projectId, token, targetWidth, targetHeight, width, height, segments, template);
  } else {
    // 'front' (default) — fast single-pass path with sequential VP9 fallback
    console.log(`[RENDER] Dispatching to fast renderer (captionDepth=${captionDepth || 'front'})`);
    await renderFront(inputPath, outputPath, durationSec, projectId, token, targetWidth, targetHeight, width, height, segments, template);
  }
}

module.exports = { renderVideo };
