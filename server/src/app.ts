import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';
import { logger } from './utils/logger';

import authRoutes from './routes/auth';
import resumeRoutes from './routes/resumes';
import jobRoutes from './routes/jobs';
import applicationRoutes from './routes/applications';
import interviewRoutes from './routes/interview';
import adminRoutes from './routes/admin';
import roadmapRoutes from './routes/roadmaps';

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: config.isProduction ? undefined : false,
}));

// CORS
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      config.clientUrl,
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:4173',
      // Docker: nginx serves the built client on port 80; browsers send Origin: http://localhost
      'http://localhost',
      'http://localhost:80',
    ].filter(Boolean);

    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      const err = new Error(`CORS: origin ${origin} not allowed`) as any;
      err.status = 403;
      callback(err);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(requestId);

// HTTP request logging (skip health checks)
app.use(morgan('combined', {
  skip: (req) => req.path === '/health' || req.path === '/ready',
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// Global rate limit
app.use(rateLimit({
  windowMs: config.rateLimits.windowMs,
  max: config.rateLimits.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
}));

// Health checks
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req, res) => {
  try {
    const { prisma } = await import('./lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', postgres: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not_ready', postgres: 'disconnected' });
  }
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/resumes', resumeRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/roadmaps', roadmapRoutes);

// API info
app.get('/api/v1', (_req, res) => {
  res.json({
    name: 'ResumeIQ API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      resumes: '/api/v1/resumes',
      jobs: '/api/v1/jobs',
      applications: '/api/v1/applications',
      interviews: '/api/v1/interviews',
      admin: '/api/v1/admin',
    },
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
