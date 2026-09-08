/* ============================================================
   SwimFest — Supabase Client Config   supabase.js
   Loads the Supabase JS SDK (via CDN in HTML) and initializes
   a shared client used across the app.
   ============================================================ */
'use strict';

// ── Project credentials (anon public key — safe for frontend) ──
const SUPABASE_URL      = 'https://zzfudduljxkfwdydksce.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZnVkZHVsanhrZndkeWRrc2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NTQxNDksImV4cCI6MjA5ODAzMDE0OX0.n74k64gD5ERWFrT86xehTwXjTKIsSiXryPmCgLJLe4s';

// ── Initialize client ──────────────────────────────────────────
// Requires the Supabase SDK loaded first:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
let supabaseClient = null;

if (window.supabase && typeof window.supabase.createClient === 'function') {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.sb = supabaseClient; // shorthand global
} else {
  console.error('[SwimFest] Supabase SDK not loaded. Add the CDN <script> before supabase.js');
}

/* ── Connection test helper ──────────────────────────────────
   Call SwimDB.testConnection() from the console or a test page.
   Returns { ok, message }. */
const SwimDB = {
  client: () => supabaseClient,

  async testConnection() {
    if (!supabaseClient) return { ok:false, message:'SDK not loaded' };
    try {
      // Auth endpoint is always available even before tables exist
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) return { ok:false, message:error.message };
      return { ok:true, message:'Connected to Supabase ✓', session:data.session };
    } catch (e) {
      return { ok:false, message:e.message };
    }
  },

  /* Try reading a table — used once tables exist */
  async ping(table = 'tournaments') {
    if (!supabaseClient) return { ok:false, message:'SDK not loaded' };
    const { data, error } = await supabaseClient.from(table).select('*').limit(1);
    if (error) return { ok:false, message:`${table}: ${error.message}` };
    return { ok:true, message:`Read ${table} OK (${data.length} row sample)`, data };
  },
};

window.SwimDB = SwimDB;
