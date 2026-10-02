import { PrismaClient } from '@prisma/client';

// Single PrismaClient instance for the process lifetime.
// In development the module cache is cleared on hot reload, so we
// attach to globalThis to avoid exhausting the connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectPrisma(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

export async function cleanupExpiredRefreshTokens(): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
