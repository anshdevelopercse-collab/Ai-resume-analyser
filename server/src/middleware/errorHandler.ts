import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  errors: Record<string, string[]>;
  constructor(errors: Record<string, string[]>) {
    super('Validation failed', 422);
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId;

  // CORS rejection — return 403 instead of falling through to 500
  if (err.message?.startsWith('CORS:')) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: cross-origin request not allowed',
      requestId,
    });
    return;
  }

  // MongoDB / Mongoose connection errors — return 503
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNotConnectedError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoTimeoutError'
  ) {
    logger.error('Database unavailable', {
      error: err.message,
      name: err.name,
      requestId,
      path: req.path,
      method: req.method,
    });
    res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable. Please try again shortly.',
      requestId,
    });
    return;
  }

  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const key = e.path.join('.') || 'root';
      errors[key] = errors[key] || [];
      errors[key].push(e.message);
    });
    res.status(422).json({
      success: false,
      error: 'Validation failed',
      errors,
      requestId,
    });
    return;
  }

  if (err instanceof ValidationError) {
    res.status(422).json({
      success: false,
      error: err.message,
      errors: err.errors,
      requestId,
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Application error', {
        error: err.message,
        stack: err.stack,
        requestId,
        path: req.path,
        method: req.method,
      });
    }
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      requestId,
    });
    return;
  }

  // Mongoose duplicate key error
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0] || 'field';
    res.status(409).json({
      success: false,
      error: `${field} already exists`,
      requestId,
    });
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(422).json({
      success: false,
      error: 'Validation failed',
      requestId,
    });
    return;
  }

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    requestId,
  });
}
