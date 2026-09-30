const { createClient } = require('@supabase/supabase-js');

const url = 'https://afcclpcoblktvlxmfwtj.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmY2NscGNvYmxrdHZseG1md3RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc5NDg4OSwiZXhwIjoyMTA0MzcwODg5fQ.3KNeAyxHJEgiojYM1ppSnSPgYalcFKjawk8WGFVgzt8';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) console.error(error);
  else {
    data.forEach(p => {
      console.log(`Project ${p.id}: status=${p.status}, error_col=${p.error}`);
      if (p.segments && p.segments._meta && p.segments._meta.error) {
        console.log(` -> meta error: ${p.segments._meta.error}`);
      }
    });
  }
}
run();
