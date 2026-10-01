require('dotenv').config({path: './.env'});
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_URL = 'http://127.0.0.1:3000';

async function measureRender() {
  const { data: users } = await supabase.auth.admin.listUsers();
  let user = users.users.find(u => u.email === 'test@example.com');
  const { data: signInData } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123'
  });
  const token = signInData.session.access_token;

  // Find a transcribed project
  const { data: p } = await supabase.from('projects').select('*').eq('status', 'TRANSCRIBED').order('created_at', { ascending: false }).limit(1).single();
  
  if (!p) throw new Error("No TRANSCRIBED projects found");

  console.log(`Triggering compose for project ${p.id}...`);
  const composeRes = await fetch(`${API_URL}/api/compose`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: p.id, styleId: 'default' })
  });
  if (!composeRes.ok) throw new Error(`Compose failed: ${await composeRes.text()}`);
  const { project: composedP } = await composeRes.json();

  console.log(`Triggering render for project ${p.id}...`);
  const renderRes = await fetch(`${API_URL}/api/render`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: p.id,
      segments: composedP.segments,
      template: composedP.style || { id: 'default', resolution: 'original' },
      resolution: 'original'
    })
  });
  
  if (!renderRes.ok) throw new Error(`Render trigger failed: ${await renderRes.text()}`);
  const { job } = await renderRes.json();
  console.log(`Render Job Queued! Job ID: ${job.id}`);
  
  console.log(`Running local github worker...`);
  const { execSync } = require('child_process');
  execSync(`node github-worker.js --job-id ${job.id} --type render`, { stdio: 'inherit' });
  
}

measureRender().catch(console.error);
