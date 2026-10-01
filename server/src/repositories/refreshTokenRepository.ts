import { RefreshToken } from '@prisma/client';
import { prisma } from '../lib/prisma';

export async function createRefreshToken(data: {
  userId: string;
  token: string;
  family: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}): Promise<void> {
  await prisma.refreshToken.create({
    data: {
      userId: data.userId,
      token: data.token,
      family: data.family as string,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent?.slice(0, 500),
      ipAddress: data.ipAddress?.slice(0, 45),
    },
  });
}

export async function findRefreshToken(
  tokenValue: string,
): Promise<RefreshToken | null> {
  return prisma.refreshToken.findUnique({ where: { token: tokenValue } });
}

export async function markTokenUsed(id: string): Promise<void> {
  await prisma.refreshToken.update({ where: { id }, data: { used: true } });
}

/**
 * Atomically marks a token as used only if it was not already used.
 * Uses UPDATE WHERE used=false so that concurrent requests racing on the
 * same token will have exactly one winner (count=1) and one loser (count=0).
 * Returns true if this caller successfully claimed the token.
 */
export async function claimTokenAtomic(id: string): Promise<boolean> {
  const result = await prisma.refreshToken.updateMany({
    where: { id, used: false },
    data: { used: true },
  });
  return result.count > 0;
}

export async function deleteRefreshToken(tokenValue: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token: tokenValue } });
}

export async function deleteTokenFamily(family: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { family } });
}

export async function deleteAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function deleteExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
