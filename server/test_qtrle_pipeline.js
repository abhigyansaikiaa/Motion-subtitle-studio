const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

async function main() {
  const inputVideoPath = path.join(__dirname, 'test_input.mp4');
  const tempCaptionsPath = path.join(__dirname, 'test_captions.mov');
  const outputPath = path.join(__dirname, 'test_output_2step.mp4');
  const fps = 30;
  const totalFrames = 1800; // 60s

  console.log('Step 1: Generate captions with qtrle');
  const args1 = [
    '-framerate', fps.toString(),
    '-f', 'image2pipe',
    '-i', 'pipe:0',
    '-c:v', 'qtrle',
    '-y', tempCaptionsPath
  ];
  const ffmpeg1 = spawn(ffmpegPath, args1);
  ffmpeg1.stderr.on('data', d => console.log('FFmpeg 1:', d.toString().trim()));
  
  const p1 = new Promise((resolve) => ffmpeg1.on('close', resolve));
  
  // Dummy 1920x1080 transparent PNG (1x1 scaled)
  const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  
  for (let i = 0; i < totalFrames; i++) {
    if (!ffmpeg1.stdin.write(transparentPng)) {
      await new Promise(r => ffmpeg1.stdin.once('drain', r));
    }
  }
  ffmpeg1.stdin.end();
  await p1;

  console.log(`Step 1 done. qtrle file size: ${fs.statSync(tempCaptionsPath).size / 1024 / 1024} MB`);

  console.log('Step 2: Overlay');
  const filterGraph = `[1:v][0:v]overlay=0:0[final_out]`;
  const args2 = [
    '-i', tempCaptionsPath,
    '-i', inputVideoPath,
    '-filter_complex', filterGraph,
    '-map', '[final_out]',
    '-map', '1:a?',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-y', outputPath
  ];
  
  const ffmpeg2 = spawn(ffmpegPath, args2);
  let memInterval = setInterval(() => {
      require('child_process').exec(`tasklist /FI "IMAGENAME eq ffmpeg.exe" /FO CSV /NH`, (err, stdout) => {
        if (!err && stdout.includes('ffmpeg.exe')) {
            console.log('[OS MEMORY] ffmpeg:', stdout.trim());
        }
      });
  }, 1000);
  
  ffmpeg2.stderr.on('data', d => {});
  
  await new Promise((resolve) => ffmpeg2.on('close', resolve));
  clearInterval(memInterval);
  
  console.log(`Step 2 done. Output size: ${fs.statSync(outputPath).size / 1024 / 1024} MB`);
}

main().catch(console.error);
