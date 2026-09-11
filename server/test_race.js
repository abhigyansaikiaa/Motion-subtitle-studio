require('dotenv').config();
const { supabase } = require('./supabase');

async function testRaceCondition() {
  console.log('Resetting test jobs to QUEUED...');
  // Find up to 10 jobs in the database and set them to QUEUED for testing
  const { data: jobs } = await supabase.from('jobs').select('id').limit(10);
  
  if (!jobs || jobs.length === 0) {
    console.log('No jobs found to test race condition');
    return;
  }
  
  for (const job of jobs) {
    await supabase.from('jobs').update({ status: 'QUEUED', updated_at: new Date().toISOString() }).eq('id', job.id);
  }
  
  console.log(`Set ${jobs.length} jobs to QUEUED.`);
}

testRaceCondition();
