import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { config } from '../config';
import {
  createRefreshToken,
  findRefreshToken,
  claimTokenAtomic,
  deleteRefreshToken,
  deleteTokenFamily,
  deleteAllUserTokens,
} from '../repositories/refreshTokenRepository';
import { findUserById } from '../repositories/userRepository';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  family: string;
}

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role, jti: uuidv4() },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn as any },
  );
}

export async function generateTokenPair(
  userId: string,
  role: string,
  userAgent?: string,
  ipAddress?: string,
  existingFamily?: string,
): Promise<TokenPair> {
  const family = existingFamily ?? uuidv4();
  const tokenValue = crypto.randomBytes(48).toString('hex');
  const accessToken = generateAccessToken(userId, role);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await createRefreshToken({ userId, token: tokenValue, family, expiresAt, userAgent, ipAddress });

  return { accessToken, refreshToken: tokenValue, family };
}

export async function rotateRefreshToken(
  tokenValue: string,
  userAgent?: string,
  ipAddress?: string,
): Promise<TokenPair | null> {
  const existing = await findRefreshToken(tokenValue);
  if (!existing) return null;

  if (existing.used) {
    // Token reuse attack — invalidate entire family
    await deleteTokenFamily(existing.family);
    return null;
  }

  if (existing.expiresAt < new Date()) {
    await deleteRefreshToken(tokenValue);
    return null;
  }

  // Atomically claim the token: UPDATE WHERE used=false.
  // Under concurrent requests with the same token, exactly one wins (count=1).
  // The loser gets count=0 and is treated as a replay attempt.
  const claimed = await claimTokenAtomic(existing.id);
  if (!claimed) {
    // Another concurrent request already used this token — treat as replay
    await deleteTokenFamily(existing.family);
    return null;
  }

  const user = await findUserById(existing.userId);
  if (!user) return null;

  return generateTokenPair(user.id, user.role, userAgent, ipAddress, existing.family);
}

export async function revokeRefreshToken(tokenValue: string): Promise<void> {
  await deleteRefreshToken(tokenValue);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await deleteAllUserTokens(userId);
}
