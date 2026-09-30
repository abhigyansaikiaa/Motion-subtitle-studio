require('dotenv').config({path: './.env'});
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_URL = 'http://127.0.0.1:3000';

async function measureLive() {
  const dummyFile = path.join(__dirname, 'dummy_with_audio.mp4');
  if (!fs.existsSync(dummyFile)) {
    throw new Error('dummy_with_audio.mp4 not found. Please create one.');
  }

  // Ensure test user exists
  const { data: users } = await supabase.auth.admin.listUsers();
  let user = users.users.find(u => u.email === 'test@example.com');
  if (!user) {
    const { data: authData } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'password123',
      email_confirm: true
    });
    user = authData.user;
  }
  
  const { data: signInData } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123'
  });
  const token = signInData.session.access_token;

  console.log(`[1] Job Created (Uploading to Live API...)`);
  const t0 = Date.now();
  
  const presignedRes = await fetch(`${API_URL}/api/upload/presigned-url`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'test_video_with_audio.mp4', contentType: 'video/mp4' })
  });
  if (!presignedRes.ok) throw new Error(`Presigned URL failed: ${await presignedRes.text()}`);
  const presignedData = await presignedRes.ok ? await presignedRes.json() : {};
  
  const uploadRes = await fetch(presignedData.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body: fs.readFileSync(dummyFile)
  });
  if (!uploadRes.ok) throw new Error(`Direct upload failed: ${await uploadRes.text()}`);
  
  const finalizeRes = await fetch(`${API_URL}/api/upload/finalize`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: presignedData.key,
      videoUuid: presignedData.videoUuid,
      filename: presignedData.safeFilename
    })
  });
  if (!finalizeRes.ok) throw new Error(`Finalize failed: ${await finalizeRes.text()}`);
  
  const uploadData = await finalizeRes.json();
  const projectId = uploadData.projectId;
  console.log(`Upload successful. Project ID: ${projectId}. Took ${Date.now() - t0}ms`);

  console.log(`[2] GitHub Actions Queued (Triggering transcription...)`);
  const transRes = await fetch(`${API_URL}/api/transcribe`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId })
  });
  
  if (!transRes.ok) throw new Error(`Transcribe trigger failed: ${await transRes.text()}`);
  
  let status = 'QUEUED_TRANSCRIPTION';
  let t1 = null; // When it changes to TRANSCRIBING
  let t2 = null; // When it changes to TRANSCRIBED
  
  console.log(`Polling status...`);
  while (true) {
    const { data: p } = await supabase.from('projects').select('status, segments').eq('id', projectId).single();
    if (!p) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    
    if (p.status === 'TRANSCRIBING' && !t1) {
      t1 = Date.now();
      console.log(`[3] GitHub runner starts / [4] Worker starts (Elapsed: ${t1 - t0}ms)`);
    }
    
    if (p.status === 'TRANSCRIBED' || p.status === 'FAILED') {
      t2 = Date.now();
      status = p.status;
      if (!t1) t1 = t2; // Fallback if we missed TRANSCRIBING
      console.log(`[10] Job completed with status ${status} (Elapsed from start: ${t2 - t0}ms)`);
      
      if (status === 'TRANSCRIBED') {
        const meta = p.segments?._meta || {};
        const metrics = meta.metrics || {};
        
        console.log(`\n--- ACTUAL MEASUREMENTS ---`);
        console.log(`Total Wall-Clock Time (1-11): ${t2 - t0}ms`);
        console.log(`GitHub Queue/Startup Time (2-4): ${t1 - t0}ms`);
        console.log(`Worker Execution Time (4-9): ${t2 - t1}ms`);
        
        if (metrics.audioExtTime) {
          console.log(`R2/FFmpeg streaming time (5-6): ${metrics.audioExtTime}ms`);
        } else {
          console.log(`R2/FFmpeg streaming time (5-6): Not found in metrics`);
        }
        
        if (metrics.whisperTime) {
          console.log(`Whisper Inference time (7-8): ${metrics.whisperTime}ms`);
          console.log(`Python/Model init time: ${t2 - t1 - metrics.audioExtTime - metrics.whisperTime}ms`);
        } else {
           console.log(`Whisper Inference time (7-8): Not found in metrics`);
        }
      }
      break;
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
}

measureLive().catch(console.error);
