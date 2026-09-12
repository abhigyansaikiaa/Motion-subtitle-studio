require('dotenv').config();
const { transcribeVideo } = require('./transcription');
const storageProvider = require('./storage');
const fs = require('fs');
const path = require('path');

async function run() {
  await storageProvider.init();
  const b2Key = 'uploads/testuser/testproject/dummy.mp4';
  const inputPath = path.join(__dirname, 'uploads', 'dummy.mp4');

  console.time('R2 Presigned URL Generation');
  const videoSource = await storageProvider.getPresignedUrl(b2Key, 3600);
  console.timeEnd('R2 Presigned URL Generation');

  console.time('Transcription Total');
  const transcript = await transcribeVideo(videoSource, 'auto', 'dummy.mp4');
  console.timeEnd('Transcription Total');

  console.log(`Words generated: ${transcript.words.length}`);
}

run().catch(console.error);
