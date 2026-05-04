import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function testConnection() {
  console.log("Testing Supabase connection to:", url);
  try {
    // A simple query that doesn't require a specific table to exist (or just querying a likely non-existent table to check auth)
    // We can just check the health of the API or query a dummy table.
    const { data, error } = await supabase.from('settings').select('*').limit(1);
    if (error && error.code !== '42P01') {
        // 42P01 is relation does not exist, which means we connected but table doesn't exist (expected)
        console.error("Connection failed or auth error:", error.message);
    } else {
        console.log("Successfully connected to Supabase!");
        if (error && error.code === '42P01') {
            console.log("Note: Tables do not exist yet. You need to run the SQL setup script.");
        }
    }
  } catch (err) {
    console.error("Failed to connect:", err.message);
  }
}

testConnection();
