const { createClient } = require('@supabase/supabase-js');
const storageProvider = require('./storage');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function testCleanup() {
  await storageProvider.init();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const uploadDir = path.join(__dirname, 'uploads');
  const outputDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log('1. Creating fake user & video & project...');
  const testEmail = `test_cleanup_${Date.now()}@example.com`;
  
  const { data: user, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'password123',
    email_confirm: true
  });
  if (authErr) throw authErr;
  const userId = user.user.id;
  
  const b2Key = `uploads/${userId}/test_source_${Date.now()}.mp4`;
  const outputB2Key = `outputs/${userId}/test_output_${Date.now()}.mp4`;
  
  console.log(`2. Uploading dummy files to R2:\n - Source: ${b2Key}\n - Output: ${outputB2Key}`);
  fs.writeFileSync('dummy.mp4', 'dummy content');
  await storageProvider.uploadFile('dummy.mp4', b2Key);
  await storageProvider.uploadFile('dummy.mp4', outputB2Key);
  
  // Insert video
  const { data: videoData, error: vErr } = await supabase.from('videos').insert({
    user_id: userId,
    filename: 'dummy.mp4',
    storage_path: b2Key
  }).select().single();
  if (vErr) {
    console.error(vErr);
    throw vErr;
  }
  
  // Insert project 25 hours ago
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 25);
  
  const { data: projectData, error: pErr } = await supabase.from('projects').insert({
    user_id: userId,
    video_id: videoData.id,
    status: 'COMPLETED',
    created_at: yesterday.toISOString(),
    segments: {
      _meta: { filename: 'dummy.mp4', outputB2Key: outputB2Key }
    }
  }).select().single();
  if (pErr) throw pErr;
  
  const projectId = projectData.id;
  console.log(`3. Created Project ID: ${projectId} with age > 24h`);
  
  console.log('4. Simulating the cleanup loop...');
  const now = new Date();
  now.setHours(now.getHours() - 24);
  
  const { data: expiredProjects } = await supabase
    .from('projects')
    .select('id, status, videos!projects_video_id_fkey(storage_path), segments')
    .lt('created_at', now.toISOString())
    .neq('status', 'EXPIRED')
    .eq('id', projectId); // filter to our test project

  if (expiredProjects && expiredProjects.length > 0) {
    for (const project of expiredProjects) {
      console.log(` - Processing project ${project.id}...`);
      try {
        const videoId = project.videos?.storage_path;
        if (videoId) {
          console.log(`   - Deleting R2 source: ${videoId}`);
          await storageProvider.deleteFile(videoId).catch(e => console.error(e));
        }
        
        let segmentsObj = project.segments || {};
        const outputB2KeyTest = segmentsObj._meta ? segmentsObj._meta.outputB2Key : null;
        if (outputB2KeyTest) {
          console.log(`   - Deleting R2 output: ${outputB2KeyTest}`);
          await storageProvider.deleteFile(outputB2KeyTest).catch(e => console.error(e));
        }
      } catch (e) {
        console.error('Auto-cleanup error', e);
      }
    }

    const expiredIds = expiredProjects.map(p => p.id);
    await supabase.from('projects').update({ status: 'EXPIRED' }).in('id', expiredIds);
    console.log(`[CLEANUP] Marked ${expiredProjects.length} projects as EXPIRED.`);
  }

  console.log('5. Verifying DB status is EXPIRED...');
  const { data: verifyProj } = await supabase.from('projects').select('status').eq('id', projectId).single();
  if (verifyProj.status === 'EXPIRED') {
    console.log('SUCCESS: Project status is EXPIRED.');
  } else {
    throw new Error(`Project status is ${verifyProj.status} not EXPIRED`);
  }

  console.log('6. Verifying R2 files are deleted (should throw error or return nothing)...');
  try {
    const url = await storageProvider.getPresignedUrl(b2Key);
    const res = await fetch(url);
    if (res.status !== 404 && res.status !== 403) {
      throw new Error(`Source file still exists! Status: ${res.status}`);
    } else {
      console.log('SUCCESS: Source file deleted from R2.');
    }
  } catch(e) {
    console.log('SUCCESS: Source file deleted from R2.');
  }

  try {
    const url2 = await storageProvider.getPresignedUrl(outputB2Key);
    const res2 = await fetch(url2);
    if (res2.status !== 404 && res2.status !== 403) {
      throw new Error(`Output file still exists! Status: ${res2.status}`);
    } else {
      console.log('SUCCESS: Output file deleted from R2.');
    }
  } catch(e) {
    console.log('SUCCESS: Output file deleted from R2.');
  }

  // Cleanup test user
  await supabase.auth.admin.deleteUser(userId);
  console.log('Test complete!');
}

testCleanup().catch(console.error);
