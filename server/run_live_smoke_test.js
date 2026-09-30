require('dotenv').config({path: './.env'});
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function testCreditsBypassLive() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const API_URL = 'https://motion-subtitle-api.onrender.com';

  const testEmail = `test_live_${Date.now()}@example.com`;
  console.log(`Creating user ${testEmail}...`);
  const { data: authData, error: createErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'testpassword123',
    email_confirm: true,
  });
  if (createErr) throw createErr;
  const user = authData.user;
  
  await supabase.from('profiles').update({ credits: 0 }).eq('id', user.id);
  console.log('Set credits to 0 for', testEmail);

  const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: 'testpassword123'
  });
  if (signErr) throw signErr;
  const token = signData.session.access_token;
  
  const headers = { 'Authorization': `Bearer ${token}` };
  
  // Create a mock video and project via db since upload might require form data, 
  // but let's try calling /api/render on a dummy project anyway to see if we bypass the 402 check!
  
  const { data: video } = await supabase.from('videos').insert({ user_id: user.id, storage_path: 'test.mp4' }).select().single();
  const { data: project } = await supabase.from('projects').insert({ user_id: user.id, video_id: video.id, status: 'TRANSCRIBED', segments: [] }).select().single();

  console.log('Testing render trigger on LIVE API with credits=0...');
  const renderRes = await fetch(`${API_URL}/api/render`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      projectId: project.id, 
      segments: [], 
      template: 'default',
      resolution: '720p'
    })
  });
  
  const renderJson = await renderRes.json();
  if (renderRes.status === 402) {
    throw new Error(`LIVE API failed with 402 Insufficient credits. The CREDITS_ENABLED=false environment variable is likely NOT set on Render, or the new code hasn't deployed yet.`);
  } else if (renderRes.status !== 200) {
    throw new Error(`Render trigger failed with ${renderRes.status}: ${JSON.stringify(renderJson)}`);
  }
  
  console.log(`Render submitted (bypass worked via LIVE API): Job ID ${renderJson.job.id}`);
  
  console.log('Waiting for backend workers to process the job and checking if they deduct credits...');
  // Wait up to 30 seconds for the worker to pick it up and process or fail it.
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const { data: job } = await supabase.from('jobs').select('status, message').eq('id', renderJson.job.id).single();
    if (job.status === 'FAILED' || job.status === 'COMPLETED') {
      console.log(`Job reached terminal state: ${job.status} (Message: ${job.message})`);
      break;
    }
  }

  const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.id).single();
  if (profile.credits === 0) {
    console.log('SUCCESS: Final balance is 0. No credits were deducted in production!');
  } else {
    throw new Error(`FAILED: Credits were unexpectedly altered! Balance is ${profile.credits}`);
  }
}

testCreditsBypassLive().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => process.exit(0));
