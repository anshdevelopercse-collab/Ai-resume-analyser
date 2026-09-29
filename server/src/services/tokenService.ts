import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { config } from '../config';
import { RefreshToken } from '../models/RefreshToken';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  family: string;
}

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role, jti: uuidv4() },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn as any }
  );
}

export async function generateTokenPair(
  userId: string,
  role: string,
  userAgent?: string,
  ipAddress?: string,
  existingFamily?: string
): Promise<TokenPair> {
  const family = existingFamily || uuidv4();
  const tokenValue = crypto.randomBytes(48).toString('hex');
  const accessToken = generateAccessToken(userId, role);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    userId,
    token: tokenValue,
    family,
    used: false,
    expiresAt,
    userAgent: userAgent?.slice(0, 500),
    ipAddress: ipAddress?.slice(0, 45),
  });

  return { accessToken, refreshToken: tokenValue, family };
}

export async function rotateRefreshToken(
  tokenValue: string,
  userAgent?: string,
  ipAddress?: string
): Promise<TokenPair | null> {
  const existing = await RefreshToken.findOne({ token: tokenValue });

  if (!existing) return null;

  if (existing.used) {
    // Potential token reuse attack — invalidate entire family
    await RefreshToken.deleteMany({ family: existing.family });
    return null;
  }

  if (existing.expiresAt < new Date()) {
    await existing.deleteOne();
    return null;
  }

  // Mark current token as used
  existing.used = true;
  await existing.save();

  const user = await import('../models/User').then(m =>
    m.User.findById(existing.userId)
  );
  if (!user) return null;

  return generateTokenPair(
    String(existing.userId),
    user.role,
    userAgent,
    ipAddress,
    existing.family
  );
}

export async function revokeRefreshToken(tokenValue: string): Promise<void> {
  await RefreshToken.deleteOne({ token: tokenValue });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await RefreshToken.deleteMany({ userId });
}
