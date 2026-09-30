require('dotenv').config({path: './.env'});
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function testCreditsBypass() {
  process.env.CREDITS_ENABLED = 'false';
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // start server
  const server = spawn('node', ['index.js'], { env: { ...process.env, PORT: 3001, CREDITS_ENABLED: 'false' } });
  
  // wait for it to be up
  await new Promise(r => setTimeout(r, 6000));
  
  const API_URL = 'http://127.0.0.1:3001';

  try {
    const testEmail = `test_${Date.now()}@example.com`;
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
    
    // Create a mock video and project
    const { data: video } = await supabase.from('videos').insert({ user_id: user.id, storage_path: 'test.mp4' }).select().single();
    const { data: project } = await supabase.from('projects').insert({ user_id: user.id, video_id: video.id, status: 'TRANSCRIBED', segments: [] }).select().single();

    console.log('Testing render trigger with credits=0...');
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
    if (renderRes.status !== 200) throw new Error(`Render trigger failed: ${JSON.stringify(renderJson)}`);
    console.log(`Render submitted (bypass worked via API!): Job ID ${renderJson.job.id}`);
    
    console.log('Testing processJob manually in case the local engine fails to do so quickly enough...');
    const JobEngine = require('./engine/JobEngine');
    try {
      await JobEngine.processJob(renderJson.job.id);
    } catch(err) {
      if (err.message === 'Insufficient credits at completion') {
        throw new Error('FAILED: Credit deduction check was NOT bypassed in JobEngine!');
      } else {
        console.log('Job completed or failed on valid non-credit error:', err.message);
      }
    }
    
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.id).single();
    if (profile.credits === 0) {
      console.log('SUCCESS: Final balance is 0. No credits were deducted!');
    } else {
      throw new Error(`FAILED: Credits were unexpectedly altered! Balance is ${profile.credits}`);
    }

  } finally {
    server.kill();
  }
}

testCreditsBypass().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => process.exit(0));
