const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const healthRouter = require('./routes/health');
const tournamentsRouter = require('./routes/tournaments');
const swimmersRouter = require('./routes/swimmers');
const leaderboardRouter = require('./routes/leaderboard');
const heatsRouter = require('./routes/heats');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Permissive CSP for local dev to avoid extension eval warnings
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src *; style-src * 'unsafe-inline'; font-src * data:; img-src * data: blob:;"
  );
  next();
});

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/swimmers', swimmersRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/heats', heatsRouter);
// Staff assistant (the same file Vercel runs as a serverless function)
app.post('/api/agent', require('../../api/agent'));

// Serve Frontend Static Files
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// API 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Fallback for SPA/static routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🏊 SwimFest Express Server is running!`);
  console.log(`📡 API Base:     http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend UI:  http://localhost:${PORT}`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);
});

module.exports = app;
