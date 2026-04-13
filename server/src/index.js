import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PORT } from './config/constants.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './utils/logger.js';
import logger from './utils/logger.js';
import { setupWebSocket } from './websocket/handler.js';

import authRoutes from './routes/auth.js';
import matchRoutes from './routes/matches.js';
import predictionRoutes from './routes/predictions.js';
import walletRoutes from './routes/wallet.js';
import leaderboardRoutes from './routes/leaderboard.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import referralRoutes from './routes/referrals.js';
import advancedRoutes from './routes/advanced.js';
import { featureFlagsMiddleware } from './middleware/featureFlags.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isProd = (process.env.NODE_ENV || '').trim() === 'production';

const app = express();
const httpServer = createServer(app);

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || '*';

// Initialize Socket.IO for real-time updates
const io = new Server(httpServer, {
  cors: {
    origin: isProd ? false : corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Setup WebSocket handlers
setupWebSocket(io);

// Global middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: isProd ? false : corsOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);
app.use(globalLimiter);
app.use(featureFlagsMiddleware);

// ── Serve static client in production ──
if (isProd) {
  const publicPath = join(__dirname, '..', 'public');
  app.use(express.static(publicPath, {
    maxAge: '7d',
    etag: true,
  }));
  logger.info(`📁 Serving static files from ${publicPath}`);
}

// Health check
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  service: 'crikex-api',
  version: '1.0.0',
  uptime: Math.floor(process.uptime()),
  timestamp: new Date(),
  environment: process.env.NODE_ENV || 'development',
}));

// ── API Routes ──
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/api/v1/predictions', predictionRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/referrals', referralRoutes);
app.use('/api/v1/analytics', advancedRoutes);
app.use('/api/v1/contests', advancedRoutes);

// ── SPA fallback for client-side routing (production) ──
if (isProd) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
    }
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  });
} else {
  // 404 for dev (client runs separately)
  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
  });
}

// Global error handler
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  res.status(err.status || 500).json({
    error: 'INTERNAL_ERROR',
    message: isProd ? 'Something went wrong' : err.message,
  });
});



// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { error: reason?.message || reason });
});

// Start server
httpServer.listen(PORT, () => {
  logger.info(`🏏 CrikeX API Server v1.0.0 running on http://localhost:${PORT}`);

  logger.info(`🔗 Health: http://localhost:${PORT}/api/health`);
  logger.info(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
  if (isProd) logger.info(`🌐 Client served at http://localhost:${PORT}`);
});
