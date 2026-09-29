import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User, IUser } from '../models/User';
import { UnauthorizedError, ForbiddenError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    let payload: { userId: string; role: string; jti?: string };
    try {
      payload = jwt.verify(token, config.jwt.accessSecret) as typeof payload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const user = await User.findOne({
      _id: payload.userId,
      isDeleted: false,
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    req.user = user;
    req.userId = String(user._id);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }
    next();
  };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireRole('admin')(req, res, next);
}
