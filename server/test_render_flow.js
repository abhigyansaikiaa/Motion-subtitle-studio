const fs = require('fs');
const path = require('path');

async function runTest() {
  const email = `test_${Date.now()}@test.com`;
  
  console.log('1. Signup...');
  const resAuth = await fetch('http://localhost:3000/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password', name: 'Test User' })
  });
  const dataAuth = await resAuth.json();
  const token = dataAuth.token;
  console.log(`User created. Credits: ${dataAuth.user.credits} (Expect 300)`);

  console.log('2. Starting render job...');
  // We don't have an upload flow in this script, so let's just pass a dummy videoId.
  // Wait, if we pass a dummy videoId, the backend will reject it: 'Video not found.'
  // Let's create a dummy video file in the uploads dir first.
  const uploadDir = 'c:/Captions AI/caption-app/caption-app/server/uploads';
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const dummyVideoId = 'test_video_dummy.mp4';
  fs.writeFileSync(path.join(uploadDir, dummyVideoId), 'dummy video content');

  const resRender = await fetch('http://localhost:3000/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      videoId: dummyVideoId,
      segments: [{ start: 0, end: 1, word: 'Test' }],
      style: 'punch'
    })
  });
  const dataRender = await resRender.json();
  console.log('Render queued. Job ID:', dataRender.jobId);

  const jobId = dataRender.jobId;
  let status = 'QUEUED';
  
  console.log('3. Polling active job...');
  while (status !== 'COMPLETED' && status !== 'FAILED') {
    const resJob = await fetch(`http://localhost:3000/api/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJob = await resJob.json();
    status = dataJob.job.status;
    console.log(`Polling: Status=${status}, Progress=${dataJob.job.progress}%, Message=${dataJob.job.message}`);
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('4. Verifying credits...');
  const resCredits = await fetch('http://localhost:3000/api/credits', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const dataCredits = await resCredits.json();
  console.log(`Final credits: ${dataCredits.credits} (Expect 200, or 300 if failed)`);
}

runTest().catch(console.error);
