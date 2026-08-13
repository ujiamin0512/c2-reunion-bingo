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

// 2. Read and parse CSV
const csvPath = path.resolve(process.cwd(), 'cleaned_responses.csv');
if (!fs.existsSync(csvPath)) {
  console.error(`Error: CSV file not found at ${csvPath}`);
  process.exit(1);
}

const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split(/\r?\n/);

if (lines.length <= 1) {
  console.error("Error: CSV file is empty or has no data rows.");
  process.exit(1);
}

const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
console.log("Found CSV headers:", headers);

const participants = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  // Basic comma split
  const cols = line.split(',').map(c => c.trim());
  const row = {};
  headers.forEach((header, index) => {
    row[header] = cols[index] || null;
  });

  // Map fields
  const name = row.name ? row.name.toUpperCase() : null;
  if (!name) {
    console.warn(`Row ${i + 1} skipped: name is empty`);
    continue;
  }

  // Handle spelling typos like "idendity"
  const rawIdentity = (row.identity || row.idendity || '').toLowerCase();
  let identity = 'alumni';
  if (rawIdentity === 'teacher' || rawIdentity === '老师' || rawIdentity === '教职工') {
    identity = 'teacher';
  }

  const rawYear = row.graduation_year || '';
  let graduation_year = parseInt(rawYear, 10);
  if (isNaN(graduation_year)) {
    graduation_year = null;
  }

  let classVal = row.class;
  if (classVal === '-' || classVal === '') {
    classVal = null;
  }

  participants.push({
    name,
    identity,
    graduation_year,
    class: classVal
  });
}

console.log(`Parsed ${participants.length} valid participant(s). Inserting into Supabase in batches...`);

// 3. Batch insert
const BATCH_SIZE = 50;
let successCount = 0;

async function run() {
  for (let i = 0; i < participants.length; i += BATCH_SIZE) {
    const batch = participants.slice(i, i + BATCH_SIZE);
    console.log(`Inserting batch ${Math.floor(i / BATCH_SIZE) + 1} (size: ${batch.length})...`);
    
    // We intentionally do not include created_at or task_order here,
    // so the database-level triggers will auto-assign them.
    const { data, error } = await supabase
      .from('participants')
      .insert(batch)
      .select('name, identity, created_at, task_order');

    if (error) {
      console.error(`Error inserting batch starting at index ${i}:`, error.message);
      console.error(error);
      process.exit(1);
    }

    successCount += batch.length;
    console.log(`Batch inserted. Sample response:`, data ? data[0] : 'No data returned');
  }

  console.log(`Successfully imported ${successCount} participants to Supabase!`);
}

run().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
