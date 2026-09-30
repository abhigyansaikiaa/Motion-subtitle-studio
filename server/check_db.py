import os
from supabase import create_client
import json

url = 'https://afcclpcoblktvlxmfwtj.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmY2NscGNvYmxrdHZseG1md3RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc5NDg4OSwiZXhwIjoyMTA0MzcwODg5fQ.3KNeAyxHJEgiojYM1ppSnSPgYalcFKjawk8WGFVgzt8'
supabase = create_client(url, key)

response = supabase.table('projects').select('*').order('created_at', desc=True).limit(5).execute()
for p in response.data:
    print(f"Project {p['id']}: status={p['status']}, error={p.get('error')}, video_id={p['video_id']}")
