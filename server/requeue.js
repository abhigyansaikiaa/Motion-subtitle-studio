const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch'); // wait, node 22 has global fetch, but we can just use supabase to manually insert a project and video record for an existing R2 file.

// We can just reuse an existing video_id that was uploaded previously!
// Let's get the most recent FAILED project, copy its video_id, and create a new project in QUEUED_TRANSCRIPTION status.
const { createClient } = require('@supabase/supabase-js');
const url = 'https://afcclpcoblktvlxmfwtj.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmY2NscGNvYmxrdHZseG1md3RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc5NDg4OSwiZXhwIjoyMTA0MzcwODg5fQ.3KNeAyxHJEgiojYM1ppSnSPgYalcFKjawk8WGFVgzt8';
const supabase = createClient(url, key);

async function run() {
  const { data: failedProj } = await supabase.from('projects').select('*').eq('status', 'FAILED').order('created_at', { ascending: false }).limit(1).single();
  
  if (!failedProj) return console.log('No failed project found.');
  
  console.log('Re-queueing video_id:', failedProj.video_id);
  
  // Create a new project for this user and video
  const { data: newProj, error } = await supabase.from('projects').insert({
    user_id: failedProj.user_id,
    video_id: failedProj.video_id,
    aspect_ratio: '9:16',
    status: 'QUEUED_RENDER_TRANS',
    segments: { _meta: { language: 'auto' } }
  }).select('*').single();
  
  if (error) console.error(error);
  else console.log('Created queued project:', newProj.id);
}
run();
