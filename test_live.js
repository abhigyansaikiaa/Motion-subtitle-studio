require('dotenv').config({path: 'server/.env'});
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmY2NscGNvYmxrdHZseG1md3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTQ4ODksImV4cCI6MjEwNDM3MDg4OX0.eCuF-sci2qWWf8K4NlQLikSBq-tPuZT54A5Fj2mb0i4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runLiveTest() {
  console.log('Logging in to Supabase...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123'
  });
  
  if (error) {
    console.error('Login failed:', error);
    return;
  }
  
  const token = data.session.access_token;
  console.log('Got token!');
  
  const apiUrl = 'https://motion-subtitle-api.onrender.com';
  console.log('Using Live API URL:', apiUrl);

  console.log('Uploading dummy video to live API...');
  const dummyBuffer = fs.readFileSync('client/dummy_with_audio.mp4');
  
  const formData = new FormData();
  formData.append('video', new Blob([dummyBuffer]), 'dummy.mp4');
  
  const uploadStart = Date.now();
  const uploadRes = await fetch(`${apiUrl}/api/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  if (!uploadRes.ok) {
    console.error('Upload failed:', await uploadRes.text());
    return;
  }
  const uploadData = await uploadRes.json();
  const projectId = uploadData.projectId;
  console.log(`Upload successful. Project ID: ${projectId}. Took ${Date.now() - uploadStart}ms`);
  
  console.log('Triggering transcription...');
  const transcribeStart = Date.now();
  const transcribeRes = await fetch(`${apiUrl}/api/transcribe`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ projectId, language: 'auto' })
  });
  
  if (!transcribeRes.ok) {
    console.error('Transcribe trigger failed:', await transcribeRes.text());
    return;
  }
  
  console.log('Transcription queued. Polling status...');
  let status = 'QUEUED_TRANSCRIPTION';
  
  while (status === 'QUEUED_TRANSCRIPTION' || status === 'TRANSCRIBING') {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(`${apiUrl}/api/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (statusRes.ok) {
      const pData = await statusRes.json();
      status = pData.project.status;
      process.stdout.write(`\rPolling... Status: ${status} (Elapsed: ${Date.now() - transcribeStart}ms)`);
      if (['TRANSCRIBED', 'FAILED', 'COMPLETED'].includes(status)) {
        console.log(`\nFinal Status: ${status}`);
        break;
      }
    }
  }
  
  const totalTranscriptionTime = Date.now() - transcribeStart;
  console.log(`\nTotal transcription wait time: ${totalTranscriptionTime}ms`);
  
  console.log('Fetching latest GitHub Actions runs for repository...');
  const runsRes = await fetch('https://api.github.com/repos/abhigyansaikiaa/Motion-subtitle-studio/actions/runs?per_page=5');
  const runsData = await runsRes.json();
  
  const transcribeRuns = runsData.workflow_runs.filter(r => r.name === 'Media Worker');
  if (transcribeRuns.length > 0) {
    const latestRun = transcribeRuns[0];
    console.log(`Latest Run ID: ${latestRun.id}, Status: ${latestRun.status}, Conclusion: ${latestRun.conclusion}`);
    
    // We can't fetch logs without auth, but we can fetch jobs to get granular timestamps
    const jobsRes = await fetch(latestRun.jobs_url);
    const jobsData = await jobsRes.json();
    console.log('Jobs:', JSON.stringify(jobsData.jobs.map(j => ({ name: j.name, steps: j.steps.map(s => ({name: s.name, started: s.started_at, completed: s.completed_at})) })), null, 2));
  }
}

runLiveTest().catch(console.error);
