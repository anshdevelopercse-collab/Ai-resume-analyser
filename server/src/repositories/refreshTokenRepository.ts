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
