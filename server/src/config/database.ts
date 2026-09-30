import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

// Fail fast when DB is unavailable; default buffer timeout is 10 s which turns
// into a silent 500. 5 s matches the serverSelectionTimeoutMS below.
mongoose.set('bufferTimeoutMS', 5000);

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) return;

  try {
    await mongoose.connect(config.db.uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    logger.info('MongoDB connected', { uri: config.db.uri.replace(/\/\/.*@/, '//**@') });
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err });
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected');
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error', { error: err });
});
