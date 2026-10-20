const express = require('express');
const router = express.Router();
const { supabase, SUPABASE_URL } = require('../config/supabase');

router.get('/', async (req, res) => {
  let dbStatus = 'disconnected';
  let dbMessage = '';
  const supabaseHost = SUPABASE_URL || 'Not configured';

  try {
    const { data, error } = await supabase.from('tournaments').select('tournament_id').limit(1);
    if (error) {
      dbStatus = 'error';
      dbMessage = error.message;
    } else {
      dbStatus = 'connected';
      dbMessage = 'Successfully connected to Supabase database';
    }
  } catch (err) {
    dbStatus = 'unreachable';
    dbMessage = err.message || 'Failed to connect to Supabase';
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'SwimFest Express API',
    supabase: {
      url: supabaseHost,
      status: dbStatus,
      message: dbMessage,
      hint: dbStatus !== 'connected' ? 'Update SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env with your active Supabase project credentials.' : undefined
    }
  });
});

module.exports = router;
