require('dotenv').config({path: './.env'});
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const storageProvider = require('./storage');

async function testE2E() {
  await storageProvider.init();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const API_URL = 'http://127.0.0.1:3000';

  console.log('1. Setting up test user...');
  const testEmail = `test_e2e_${Date.now()}@example.com`;
  const { data: authData, error: createErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'testpassword123',
    email_confirm: true,
  });
  if (createErr) throw createErr;
  
  await supabase.from('profiles').update({ credits: 10 }).eq('id', authData.user.id);
  const userId = authData.user.id;

  console.log('2. Uploading video directly to R2 and creating DB records...');
  
  const videoUuid = require('crypto').randomUUID();
  const b2Key = `uploads/${userId}/${videoUuid}/dummy.mp4`;
  const localVideoPath = path.join(__dirname, '..', 'client', 'dummy_with_audio.mp4');
  
  await storageProvider.uploadFile(localVideoPath, b2Key);
  
  const { data: video } = await supabase.from('videos').insert({ user_id: userId, storage_path: b2Key, filename: 'dummy.mp4' }).select().single();
  const { data: project } = await supabase.from('projects').insert({ user_id: userId, video_id: video.id, status: 'UPLOADING', segments: { _meta: {} } }).select().single();
  
  const projectId = project.id;

  console.log('3. Faking transcription and composition...');
  const fakeWords = [
    { id: 'w1', text: 'Hello', start: 0.0, end: 0.5, index: 0, cleanText: 'hello' },
    { id: 'w2', text: 'world', start: 0.5, end: 1.0, index: 1, cleanText: 'world' }
  ];
  await supabase.from('transcripts').insert({ project_id: projectId, words: fakeWords });
  
  const fakeSegments = [
    { id: 's1', start: 0.0, end: 1.0, text: 'Hello world', lines: [[fakeWords[0], fakeWords[1]]], words: fakeWords }
  ];
  
  await supabase.from('projects').update({
    status: 'READY_TO_EDIT',
    segments: { _meta: { styleId: 'classic' }, data: fakeSegments }
  }).eq('id', projectId);

  console.log('4. Submitting render job...');
  const template = { id: 'classic', name: 'Classic', fontFamily: 'Inter', fontSize: 32 };
  
  const { data: signData } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: 'testpassword123'
  });
  const token = signData.session.access_token;
  const headers = { 'Authorization': `Bearer ${token}` };

  const renderRes = await fetch(`${API_URL}/api/render`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, segments: fakeSegments, template, resolution: '720p' })
  });
  
  if (!renderRes.ok) throw new Error(await renderRes.text());
  const { job } = await renderRes.json();
  console.log(`Render submitted, Job ID: ${job.id}`);

  console.log('5. Waiting for worker to complete render...');
  let completedJob;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const { data: currentJob } = await supabase.from('jobs').select('*').eq('id', job.id).single();
    process.stdout.write(`\rJob status: ${currentJob.status} (${currentJob.progress}%) - ${currentJob.message}`);
    if (currentJob.status === 'COMPLETED' || currentJob.status === 'FAILED') {
      console.log();
      completedJob = currentJob;
      break;
    }
  }
  
  if (!completedJob || completedJob.status !== 'COMPLETED') {
    throw new Error('Render job failed or timed out: ' + (completedJob ? completedJob.message : 'timeout'));
  }
  console.log('Render successful!');

  console.log('6. Testing download URL generation...');
  const dlRes = await fetch(`${API_URL}/api/projects/${projectId}/download`, {
    headers
  });
  
  if (!dlRes.ok) throw new Error(await dlRes.text());
  const { url } = await dlRes.json();
  console.log('Download URL generated successfully:');
  console.log(url);
  
  if (url.includes('motion-subtitle-media.60ede068bdea107450b32d248a47930b.r2.cloudflarestorage.com')) {
    throw new Error('FAIL: URL is still using virtual host style!');
  }
  if (!url.includes('60ede068bdea107450b32d248a47930b.r2.cloudflarestorage.com/motion-subtitle-media')) {
    throw new Error('FAIL: URL does not look like correct path-style R2 URL!');
  }
  console.log('SUCCESS: URL is correctly path-style formatted!');
  console.log('\n--- ALL E2E PIPELINE TESTS PASSED ---');
}

testE2E().catch(err => {
  console.error('\nTest failed:', err);
  process.exit(1);
});
