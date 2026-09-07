
const { renderVideo: render } = require('./render');

// Mock data
const inputPath = require('path').join(__dirname, 'uploads', 'test_video.mp4'); // Replace with actual test video
const outputPath = require('path').join(__dirname, 'outputs', 'test_output.mp4');

// Read a video from uploads
const fs = require('fs');
const files = fs.readdirSync(require('path').join(__dirname, 'uploads'));
const videoFile = files.find(f => f.endsWith('.mp4'));

if (!videoFile) {
  console.log("No video file found in uploads/");
  process.exit(1);
}

const inputVideo = require('path').join(__dirname, 'uploads', videoFile);
const outVideo = require('path').join(__dirname, 'outputs', 'test_render.mp4');

const mockSegments = [
  { start: 0, end: 1, text: "Hello", words: [{ text: "Hello", start: 0, end: 1 }] }
];

async function run() {
  try {
    // Get a valid projectId from db
    const dbData = require('./app.db.json');
    const project = dbData.projects[0];
    const projectId = project ? project.id : 'test_project';
    const style = project ? project.style : 'classic';
    const segments = project ? project.segments : mockSegments;

    console.log(`Starting render for ${inputVideo} to ${outVideo}`);
    await render(inputVideo, outVideo, segments, style, projectId);
    console.log("Render completed successfully!");
  } catch (err) {
    console.error("Render failed:", err);
  }
}

run();
