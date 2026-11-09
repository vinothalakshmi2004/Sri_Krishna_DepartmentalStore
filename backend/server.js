/**
 * GreenMart backend - entry point.
 *
 * Start-up sequence:
 *   1. Load environment variables from .env
 *   2. Configure Express (security headers, CORS, body parsing, static uploads)
 *   3. Mount API routes and the central error handler
 *   4. Attach Socket.io to the HTTP server (real-time admin notifications)
 *   5. Connect to MongoDB, seed defaults on first run, then start listening
 */
require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { seedDatabase } = require('./utils/seed');
const { initSocket, getIO } = require('./utils/socket');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// ---------------------------------------------------------------------------
// Environment check
// ---------------------------------------------------------------------------
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`[startup] Missing required environment variable(s): ${missingEnv.join(', ')}`);
  console.error('[startup] Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 5000;

// CLIENT_URL may list several origins separated by commas
// (e.g. the admin PC and a shop tablet on the local network)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// Live hosting puts a proxy / load balancer in front of the app (Render, Railway,
// Nginx ...), so the customer's real IP arrives in X-Forwarded-For. Without this
// every customer looks like the proxy and the order rate limit would block the
// whole store. TRUST_PROXY = number of proxies in front: default 1 in production,
// off in development; set TRUST_PROXY=0 when the app is reached directly.
const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? '1' : '0');
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true');

// Secure HTTP headers. Images in /uploads must be loadable from the frontend origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    exposedHeaders: ['Content-Disposition'], // lets the frontend read CSV file names
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Uploaded images (items, logo, hero, gallery)
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', index: false, dotfiles: 'ignore' })
);

// Health check (handy for monitoring and for the frontend to test the connection)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

// API routes
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/income', require('./routes/income'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/backup', require('./routes/backup'));

// 404 + central error handler (must be last)
app.use(notFound);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// HTTP + Socket.io server
// ---------------------------------------------------------------------------
const server = http.createServer(app);
initSocket(server, allowedOrigins);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[startup] Port ${PORT} is already in use. Stop the other process or change PORT in .env.`);
    process.exit(1);
  }
  throw err;
});

const start = async () => {
  await connectDB();
  await seedDatabase();
  server.listen(PORT, () => {
    console.log(`[server] Store API running on http://localhost:${PORT}`);
    console.log(`[server] Allowed frontend origin(s): ${allowedOrigins.join(', ')}`);
  });
};

// ---------------------------------------------------------------------------
// Graceful shutdown & safety nets
// ---------------------------------------------------------------------------
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] ${signal} received - shutting down...`);

  // Force exit if something hangs
  setTimeout(() => process.exit(1), 10000).unref();

  const io = getIO();
  const closeHttp = (done) => (io ? io.close(() => done()) : server.close(() => done()));
  closeHttp(() => {
    mongoose.connection.close().finally(() => process.exit(0));
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});

start().catch((err) => {
  console.error('[startup] Failed to start server:', err);
  process.exit(1);
});

module.exports = { app, server };
