const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config(); // also check current working dir if run from backend folder

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nexnriixtrvjycjzqypq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5leG5yaWl4dHJ2anljanpxeXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjE2ODIsImV4cCI6MjEwMzk5NzY4Mn0.5vu_Xeo2sKwOf5rjeFIFrjYba4mKosJrOnnsMRp_CEQ';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Backend] Supabase URL or Anon Key is missing. Check your .env file.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false
  }
});

module.exports = {
  supabase,
  SUPABASE_URL
};
