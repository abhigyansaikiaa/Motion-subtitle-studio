require('dotenv').config({path: 'c:/Captions AI/caption-app/caption-app/server/.env'});
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// We won't use fetch against localhost:3000 since the server isn't running in my environment.
// Instead, we will directly require the relevant modules to ensure they don't block.
const { checkCredits, deductCredits } = require('c:/Captions AI/caption-app/caption-app/server/credits.js');
const JobEngine = require('c:/Captions AI/caption-app/caption-app/server/engine/JobEngine.js');
const ProjectEngine = require('c:/Captions AI/caption-app/caption-app/server/engine/ProjectEngine.js');

async function testCreditsBypass() {
  console.log("CREDITS_ENABLED =", process.env.CREDITS_ENABLED);
  
  // Ensure test user exists
  const { data: users } = await supabase.auth.admin.listUsers();
  let user = users.users.find(u => u.email === 'test@example.com');
  if (!user) {
    const { data: authData } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'testpassword123',
      email_confirm: true,
    });
    user = authData.user;
  }
  
  // Set user credits to 0
  await supabase.from('profiles').update({ credits: 0 }).eq('id', user.id);
  console.log('Set credits to 0 for test@example.com');

  // Verify the bypass in JobEngine works (which is what runs on the backend workers)
  const project = await ProjectEngine.createProject(user.id, 'test_credits_bypass.mp4');
  const job = await JobEngine.createJob(project.id, user.id, [], 'default', '720p', false);
  
  console.log('Created job:', job.id);
  
  console.log('Processing job via JobEngine...');
  try {
    await JobEngine.processJob(job.id);
  } catch (err) {
    if (err.message === 'Insufficient credits at completion') {
      console.error('FAILED: Credit deduction check was NOT bypassed in JobEngine!');
      return;
    } else {
      console.log('Job failed on rendering (expected since missing ffmpeg/R2 config context), but NO credit error: ' + err.message);
    }
  }
  
  // Check final balance
  const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.id).single();
  console.log(`Final credits balance: ${profile.credits} (Should still be 0)`);
  if (profile.credits === 0) {
    console.log('SUCCESS: No credits were deducted!');
  } else {
    console.error('FAILED: Credits were unexpectedly altered!');
  }
}

testCreditsBypass().catch(console.error).finally(() => process.exit(0));
