import { connectDatabase } from './config/database';
import { connectPrisma, disconnectPrisma, cleanupExpiredRefreshTokens } from './lib/prisma';
import { config } from './config';
import { logger } from './utils/logger';
import app from './app';

async function seedSampleUser(): Promise<void> {
  const { upsertUserByEmail } = await import('./repositories/userRepository');
  const { hashPassword } = await import('./services/authService');
  const passwordHash = await hashPassword('Demo1234!');
  const user = await upsertUserByEmail('demo@resumeiq.local', {
    email: 'demo@resumeiq.local',
    passwordHash,
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'admin',
    emailVerified: true,
  });
  logger.info('Sample user ready', { email: user.email, hint: 'password: Demo1234!' });
}

async function start(): Promise<void> {
  try {
    // Connect MongoDB (existing services still use Mongoose).
    // Non-fatal in development: auth is now fully on PostgreSQL.
    // MongoDB-backed domains will return 503 until Mongo is available.
    try {
      await connectDatabase();
    } catch (err) {
      if (config.isProduction) throw err;
      logger.warn('MongoDB unavailable — non-auth routes will be degraded', { error: (err as Error).message });
    }

    // Connect PostgreSQL (new Prisma layer)
    await connectPrisma();

    // Clean up any expired refresh tokens from previous runs
    await cleanupExpiredRefreshTokens();

    // Seed demo account into PostgreSQL
    await seedSampleUser();

    if (config.disableAuth) {
      logger.warn('DISABLE_AUTH=true — authentication bypassed, demo auto-login active');
    }

    const server = app.listen(config.port, () => {
      logger.info(`ResumeIQ server started`, {
        port: config.port,
        env: config.env,
        dbUri: config.db.uri.replace(/\/\/.*@/, '//**@'),
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      server.close(async () => {
        const { disconnectDatabase } = await import('./config/database');
        await disconnectDatabase();
        await disconnectPrisma();
        logger.info('Server shut down');
        process.exit(0);
      });

      // Force exit after 30s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', { error: err });
      process.exit(1);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

start();
