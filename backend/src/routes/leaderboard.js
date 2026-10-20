const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// GET /api/leaderboard - get academy points leaderboard
router.get('/', async (req, res) => {
  try {
    const { limit = 20, city } = req.query;

    let query = supabase
      .from('academy_leaderboard')
      .select('*')
      .order('total_points', { ascending: false })
      .limit(parseInt(limit));

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve academy leaderboard: ' + error.message,
        statusCode: 500,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      count: data?.length || 0,
      data: data || []
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Server error while fetching leaderboard: ' + err.message,
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
