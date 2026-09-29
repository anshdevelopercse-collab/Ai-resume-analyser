import { connectDatabase } from './config/database';
import { config } from './config';
import { logger } from './utils/logger';
import app from './app';

async function start(): Promise<void> {
  try {
    await connectDatabase();

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
