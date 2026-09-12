const { transcribeVideo } = require('./transcription.js');
const path = require('path');

async function test() {
  try {
    console.log("Transcribing dummy.mp4...");
    const result = await transcribeVideo(path.join(__dirname, 'dummy.mp4'), 'auto');
    console.log("Success:", result.words.length, "words");
    process.exit(0);
  } catch(e) {
    console.error("Failed:", e);
    process.exit(1);
  }
}
test();
