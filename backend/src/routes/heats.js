const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// GET /api/heats/:tournamentId - get heat rows for a tournament
router.get('/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    let query = supabase
      .from('heat_rows')
      .select(`
        *,
        event_entries(
          entry_id,
          event_name,
          stroke,
          distance,
          category,
          gender,
          swimmers(swimmer_id, full_name, academies(academy_name))
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('heat_number', { ascending: true })
      .order('lane_number', { ascending: true });

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve heat sheets from database: ' + error.message,
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
      message: 'Server error while retrieving heats: ' + err.message,
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
