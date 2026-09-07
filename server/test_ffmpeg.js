const cp = require('child_process');
const ffmpeg = require('ffmpeg-static');
const { renderVideo } = require('./render');
const { compose } = require('./engine/CompositionEngine');
const { assignEmphasis } = require('./engine/EmphasisEngine');
const { createWord } = require('./engine/CaptionModel');

async function run() {
  console.log('Generating dummy video...');
  cp.execSync(`"${ffmpeg}" -f lavfi -i color=c=black:s=1920x1080:d=5 -f lavfi -i sine=f=440:d=5 -c:v libx264 -c:a aac -y test_in.mp4`);

  console.log('Rendering captions...');
  const words = [
    createWord('w1', 'This', 0, 0.5),
    createWord('w2', 'is', 0.5, 1.0),
    createWord('w3', 'a', 1.0, 1.2),
    createWord('w4', 'test', 1.2, 2.0)
  ];
  const segments = compose(words);
  segments.forEach(s => s.emphasis = assignEmphasis(s));
  
  await renderVideo('test_in.mp4', 'test_out.mp4', segments, 'punch');
  console.log('Done!');
}
run().catch(console.error);
