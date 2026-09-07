const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

// 1. Generate video
try {
  console.log('Generating dummy.mp4...');
  execSync(`"${ffmpeg}" -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:duration=5 -c:v libx264 -c:a aac dummy.mp4 -y`, { stdio: 'inherit' });
} catch (e) {
  console.log('ffmpeg failed', e.message);
}

// 2. Test upload and transcribe
async function testUpload() {
  try {
    const FormData = require('form-data');
    
    // Create mock user directly in DB for testing
    const auth = require('./auth');
    auth.initDB();
    await auth.signup('test@example.com', 'password123', 'Test User').catch(e => {});
    
    const loginRes = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(loginData.error);
    const authToken = loginData.token;

    console.log('Uploading dummy video...');
    const form = new FormData();
    const dummyVideo = path.join(__dirname, 'dummy.mp4');
    form.append('video', fs.createReadStream(dummyVideo));

    const uploadRes = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: form
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error);
    const projectId = uploadData.projectId;
    console.log('Upload successful. Project ID:', projectId);

    console.log('Triggering transcription...');
    const tRes = await fetch('http://localhost:3000/api/transcribe', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId })
    });
    const tData = await tRes.json();
    if (!tRes.ok) throw new Error(tData.error);
    console.log('Transcription started:', tData);

    let status = 'TRANSCRIBING';
    while (status === 'TRANSCRIBING') {
      await new Promise(r => setTimeout(r, 1000));
      const pRes = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const pData = await pRes.json();
      status = pData.project.status;
      console.log('Polling status:', status);
    }
    
    console.log('Final status:', status);
    
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testUpload();
