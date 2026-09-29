import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: config.isProduction ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    json()
  ),
  defaultMeta: { service: 'resumeiq-server' },
  transports: [
    new winston.transports.Console({
      format: config.isProduction
        ? combine(timestamp(), json())
        : combine(colorize(), simple()),
    }),
  ],
});

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
