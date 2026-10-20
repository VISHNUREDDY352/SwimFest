const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// GET /api/swimmers - list / search swimmers (queries public swimmer_directory view)
router.get('/', async (req, res) => {
  try {
    const { search, category, gender, academy, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('swimmer_directory')
      .select('*')
      .order('full_name')
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (gender) {
      query = query.eq('gender', gender);
    }
    if (academy) {
      query = query.eq('academy_id', academy);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve swimmers from database: ' + error.message,
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
      message: 'Server error while retrieving swimmers: ' + err.message,
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/swimmers/:id - get swimmer details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('swimmer_directory')
      .select('*')
      .eq('swimmer_id', id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve swimmer details: ' + error.message,
        statusCode: 500,
        timestamp: new Date().toISOString()
      });
    }
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Swimmer not found',
        message: `No swimmer record found for ID: ${id}`,
        statusCode: 404,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Server error while retrieving swimmer: ' + err.message,
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
