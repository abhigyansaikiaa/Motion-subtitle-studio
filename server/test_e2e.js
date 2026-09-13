const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function runTests() {
  const BACKEND = 'http://127.0.0.1:5000';
  let token = '';
  let projectId = '';
  
  console.log('--- STARTING E2E BACKEND TEST ---');

  try {
    // 1. Generate dummy video

    
    // 2. Auth (Login)
    console.log('Testing Authentication...');
    // We already have a profile in Supabase? We might need to fetch the service key to bypass auth or just use login.
    // Wait, we can't test login without credentials. I will use the service role key to mint a JWT for an existing user!
    const { supabase } = require('./supabase');
    const email = 'test_e2e_' + Date.now() + '@example.com';
    const password = 'testpassword123';
    
    // Create user directly using admin API
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });
    
    if (authErr) throw new Error('Failed to create test user: ' + authErr.message);
    const user = authData.user;
    
    // Wait a brief moment for the Supabase trigger to create the profile
    await new Promise(r => setTimeout(r, 2000));
    
    // Log in to get a real session token using a separate client so we don't mutate the global one
    const { createClient } = require('@supabase/supabase-js');
    const localSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: loginData, error: loginErr } = await localSupabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (loginErr || !loginData.session) throw new Error('Failed to login test user: ' + (loginErr ? loginErr.message : 'No session'));
    
    token = loginData.session.access_token;
    
    // 3. /api/me
    console.log('Testing /api/me...');
    let res = await fetch(`${BACKEND}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
    let data = await res.json();
    if (!res.ok) throw new Error(data.error);
    console.log('/api/me OK:', data);

    // 4. /api/upload
    console.log('Testing /api/upload...');
    const formData = new FormData();
    const blob = new Blob([fs.readFileSync(path.join(__dirname, 'test.mp4'))], { type: 'video/mp4' });
    formData.append('video', blob, 'dummy.mp4');
    formData.append('aspectRatio', '9:16');
    
    res = await fetch(`${BACKEND}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error);
    projectId = data.projectId;
    console.log('/api/upload OK, projectId:', projectId);

    // 5. /api/projects
    console.log('Testing /api/projects...');
    res = await fetch(`${BACKEND}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
    data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (!data.projects.find(p => p.id === projectId)) throw new Error('Project not found in list');
    console.log('/api/projects OK, total projects:', data.projects.length);

    // 6. /api/projects/:id
    console.log('Testing /api/projects/:id...');
    res = await fetch(`${BACKEND}/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } });
    data = await res.json();
    if (!res.ok) throw new Error(data.error);
    console.log('/api/projects/:id OK, videoUrl:', data.project.videoUrl);

    // 7. /api/transcribe
    // Because it's a dummy video, transcribeVideo will throw in background. But it should return 'QUEUED_TRANSCRIPTION' immediately.
    console.log('Testing /api/transcribe...');
    res = await fetch(`${BACKEND}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, language: 'en' })
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error);
    console.log('/api/transcribe OK, status:', data.status);

    // Wait a bit to let it fail or finish
    await new Promise(r => setTimeout(r, 2000));

    // Force a transcript into the DB so we can test composition
    const { saveTranscript } = require('./engine/ProjectEngine');
    await saveTranscript(projectId, [
      { id: 'w0', text: 'Hello', cleanText: 'hello', word: 'Hello', start: 0, end: 1 },
      { id: 'w1', text: 'World', cleanText: 'world', word: 'World', start: 1, end: 2 }
    ]);
    console.log('Manually injected transcript for testing.');

    // 8. /api/compose
    console.log('Testing /api/compose...');
    res = await fetch(`${BACKEND}/api/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, styleId: 'neon' })
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error);
    console.log('/api/compose OK, segments:', data.project.segments.length);

    // 9. /api/render
    console.log('Testing /api/render...');
    res = await fetch(`${BACKEND}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, template: { primaryColor: '#fff' } })
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error);
    console.log('/api/render OK, job:', data.job.id);
    
    const jobId = data.job.id;

    // 10. /api/jobs/:id
    console.log('Testing /api/jobs/:id...');
    res = await fetch(`${BACKEND}/api/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    data = await res.json();
    if (!res.ok) throw new Error(data.error);
    console.log('/api/jobs/:id OK, job status:', data.job.status);
    
    // 11. /api/projects/:id again to verify updated style and job
    console.log('Testing /api/projects/:id (after render)...');
    res = await fetch(`${BACKEND}/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } });
    data = await res.json();
    if (!res.ok) throw new Error(data.error);
    console.log('Project after render:', {
        styleId: data.project.styleId,
        latestJobId: data.project.latestJobId
    });

    console.log('--- ALL E2E BACKEND TESTS PASSED ---');
    
  } catch (err) {
    console.error('--- TEST FAILED ---');
    console.error(err);
  }
}

runTests();
