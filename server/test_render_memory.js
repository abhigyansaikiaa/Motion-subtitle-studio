const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { captureCaptionVideoFast } = require('./engine/PuppeteerRenderer');

async function main() {
  const durationSec = 7;
  const inputVideo = path.join(__dirname, 'test_input_7s.mp4');
  const outputVideo = path.join(__dirname, 'test_output.mp4');
  
  if (!fs.existsSync(inputVideo)) {
    console.log('Generating dummy 7s video...');
    const ffmpegPath = require('ffmpeg-static');
    execSync(`"${ffmpegPath}" -f lavfi -i testsrc=duration=${durationSec}:size=1080x1920:rate=30 -c:v libx264 -pix_fmt yuv420p "${inputVideo}"`, { stdio: 'inherit' });
  }

  const dummySegments = [
    { start: 0, end: 2, text: 'Hello' },
    { start: 2, end: 60, text: 'This is a long test' }
  ];
  const dummyTemplate = {
    captionDepth: 'front',
    id: 'classic'
  };

  console.log('Starting render test...');
  try {
    await captureCaptionVideoFast(
      'test_project',
      'front',
      durationSec,
      outputVideo,
      inputVideo,
      'fake_token',
      1080,
      1920,
      { segments: dummySegments, customOverrides: dummyTemplate, style: dummyTemplate.id },
      1080,
      1920,
      1080,
      1920,
      (p) => console.log(`Progress 1: ${(p*100).toFixed(1)}%`)
    );
    console.log('Render 1 completed successfully.\n');

    console.log('Starting SECOND render test (testing cache)...');
    const outputVideo2 = path.join(__dirname, 'test_output_2.mp4');
    await captureCaptionVideoFast(
      'test_project_2',
      'front',
      durationSec,
      outputVideo2,
      inputVideo,
      'fake_token',
      1080,
      1920,
      { segments: dummySegments, customOverrides: dummyTemplate, style: dummyTemplate.id },
      1080,
      1920,
      1080,
      1920,
      (p) => console.log(`Progress 2: ${(p*100).toFixed(1)}%`)
    );
    console.log('Render 2 completed successfully.');
  } catch (err) {
    console.error('Render failed:', err);
  } finally {
    process.exit(0);
  }
}

main();
