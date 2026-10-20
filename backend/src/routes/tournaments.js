const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// GET /api/tournaments - list tournaments
router.get('/', async (req, res) => {
  try {
    const { status, city, search, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: true })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,venue_name.ilike.%${search}%,city.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve tournaments from database: ' + error.message,
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
      message: 'Server error while fetching tournaments: ' + err.message,
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/tournaments/:id - get tournament by ID or slug/title
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabase.from('tournaments').select('*');
    if (isUuid) {
      query = query.eq('tournament_id', id);
    } else {
      query = query.ilike('title', id);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Database query failed for tournament: ' + error.message,
        statusCode: 500,
        timestamp: new Date().toISOString()
      });
    }
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found',
        message: `No tournament found with identifier: ${id}`,
        statusCode: 404,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Server error while retrieving tournament: ' + err.message,
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/tournaments - create a tournament
router.post('/', async (req, res) => {
  try {
    const tournamentData = req.body;
    if (!tournamentData || Object.keys(tournamentData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Tournament payload is empty or missing required fields',
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
    }

    const { data, error } = await supabase
      .from('tournaments')
      .insert([tournamentData])
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to create tournament in database: ' + error.message,
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Server error while creating tournament: ' + err.message,
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// PATCH /api/tournaments/:id - update a tournament
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('tournaments')
      .update(updates)
      .eq('tournament_id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to update tournament: ' + error.message,
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Server error while updating tournament: ' + err.message,
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
