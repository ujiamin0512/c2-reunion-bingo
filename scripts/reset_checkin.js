import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Load env variables from .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching participants where checked_in is true...");
  
  // Update all participants setting checked_in to false
  // In Supabase client, you can use `.neq('id', '00000000-0000-0000-0000-000000000000')` to target all
  const { data, error, count } = await supabase
    .from('participants')
    .update({ checked_in: false })
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id, name');

  if (error) {
    console.error("Error resetting check-in statuses:", error.message);
    process.exit(1);
  }

  console.log(`Successfully reset checked_in to false for all matching participants! (Count: ${data ? data.length : 0})`);
  if (data && data.length > 0) {
    console.log("Sample of updated participants:", data.slice(0, 5));
  }
}

run().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
