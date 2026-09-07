const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const { captureCaptionVideo } = require('./engine/PuppeteerRenderer');

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
 * Captures a single caption layer and overlays it on the video.
 */
async function renderFront(inputPath, outputPath, durationSec, projectId, token, width, height) {
  const fgTextPath = outputPath.replace(/\.[^.]+$/, '_fg.webm');

  console.log(`[RENDER] Capturing foreground text layer (front-only mode) at ${width}x${height}...`);
  await captureCaptionVideo(projectId, 'front', durationSec, fgTextPath, token, width, height);

  console.log(`[RENDER] Compositing (front-only)...`);

  const filterGraph = [
    // Overlay the text on the base video exactly as it is (since they have the exact same dimensions)
    `[0:v][1:v]overlay=0:0[final_out]`
  ].join(';');

  const cmd = `"${ffmpegPath}" -i "${inputPath}" -c:v libvpx-vp9 -i "${fgTextPath}" ` +
              `-filter_complex "${filterGraph}" -map "[final_out]" -map 0:a? ` +
              `-c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k ` +
              `-movflags +faststart -y "${outputPath}"`;

  await runCommand(cmd);

  // Cleanup
  try { fs.unlinkSync(fgTextPath); } catch(e) {}
}

/**
 * Full depth render path: behind-subject or mixed.
 * Uses Python MediaPipe segmentation to composite:
 *   [behind captions] → [subject fg extracted from mask] → [front captions]
 */
async function renderDepth(inputPath, outputPath, durationSec, projectId, token, width, height) {
  const bgTextPath = outputPath.replace(/\.[^.]+$/, '_bg.webm');
  const fgTextPath = outputPath.replace(/\.[^.]+$/, '_fg.webm');
  const maskPath   = outputPath.replace(/\.[^.]+$/, '_mask.mp4');

  console.log(`[RENDER] Capturing background text layer (depth mode) at ${width}x${height}...`);
  await captureCaptionVideo(projectId, 'behind', durationSec, bgTextPath, token, width, height);

  console.log(`[RENDER] Capturing foreground text layer (depth mode) at ${width}x${height}...`);
  await captureCaptionVideo(projectId, 'front', durationSec, fgTextPath, token, width, height);

  console.log(`[RENDER] Generating subject mask via Python MediaPipe...`);
  await new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'segment.py');
    exec(`python "${pythonScript}" "${inputPath}" "${maskPath}"`, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve();
    });
  });

  console.log(`[RENDER] Compositing (depth mode)...`);

  // Mask generation likely alters colorspace to gray; we composite directly
  // assuming mask matches video dimensions.
  const filterGraph = [
    // Overlay background text onto base video
    `[0:v][1:v]overlay=0:0[base_with_bg]`,

    // Extract subject foreground using mask
    // We assume [2:v] is the mask generated from the base video and matches dimensions
    `[2:v]format=gray[mask]`,
    `[0:v][mask]alphamerge[fg_subject]`,

    // Place subject on top of bg captions
    `[base_with_bg][fg_subject]overlay=0:0[with_fg_subject]`,

    // Overlay front captions on top of everything
    `[with_fg_subject][3:v]overlay=0:0[final_out]`
  ].join(';');

  const cmd = `"${ffmpegPath}" -i "${inputPath}" -c:v libvpx-vp9 -i "${bgTextPath}" -i "${maskPath}" -c:v libvpx-vp9 -i "${fgTextPath}" ` +
              `-filter_complex "${filterGraph}" -map "[final_out]" -map 0:a? ` +
              `-c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k ` +
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
async function renderVideo(inputPath, outputPath, segments, template, projectId, token) {
  const { durationSec, width, height } = await getVideoMeta(inputPath);
  console.log(`[RENDER] Video dimensions: ${width}x${height}, duration: ${durationSec}s | project: ${projectId} | depth: ${template?.captionDepth || 'front'}`);

  const captionDepth = template?.captionDepth || 'front';

  if (captionDepth === 'behind-subject' || captionDepth === 'mixed') {
    await renderDepth(inputPath, outputPath, durationSec, projectId, token, width, height);
  } else {
    // 'front' (default) — simple, fast path with no segmentation
    await renderFront(inputPath, outputPath, durationSec, projectId, token, width, height);
  }
}

module.exports = { renderVideo };
