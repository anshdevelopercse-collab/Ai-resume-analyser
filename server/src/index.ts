import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import { connectDatabase } from './config/database';
import { config } from './config';
import { logger } from './utils/logger';
import app from './app';

async function seedSampleUser(): Promise<void> {
  const { User } = await import('./models/User');
  const { hashPassword } = await import('./services/authService');
  const existing = await User.findOne({ email: 'demo@resumeiq.local' });
  if (existing) return;
  const password = await hashPassword('Demo1234!');
  await User.create({
    email: 'demo@resumeiq.local',
    password,
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'admin',
    emailVerified: true,
  });
  logger.info('Sample user ready — email: demo@resumeiq.local  password: Demo1234!');
}

async function start(): Promise<void> {
  try {
    await connectDatabase();

    // Always seed the sample account so there is a ready-to-use login
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
