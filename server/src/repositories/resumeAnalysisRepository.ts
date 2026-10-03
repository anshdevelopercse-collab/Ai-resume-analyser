import { prisma } from '../lib/prisma';
import { AnalysisStatus } from '@prisma/client';

export async function createAnalysis(data: {
  userId: string;
  resumeId: string;
  status: AnalysisStatus;
  idempotencyKey: string;
  provider: string;
  aiModel: string;
}) {
  return prisma.resumeAnalysis.create({ data });
}

export async function findAnalysisByIdempotencyKey(
  key: string,
  statuses: AnalysisStatus[],
) {
  return prisma.resumeAnalysis.findFirst({
    where: { idempotencyKey: key, status: { in: statuses } },
  });
}

export async function findAnalysisById(id: string, userId: string) {
  return prisma.resumeAnalysis.findFirst({ where: { id, userId } });
}

export async function updateAnalysis(
  id: string,
  data: Partial<{
    status: AnalysisStatus;
    result: any | null;
    provider: string;
    aiModel: string;
    tokensUsed: number | null;
    costEstimate: number | null;
    processingMs: number | null;
    error: string | null;
  }>,
) {
  return prisma.resumeAnalysis.update({ where: { id }, data });
}

export async function listAnalyses(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [analyses, total] = await Promise.all([
    prisma.resumeAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        resume: { select: { id: true, originalName: true, label: true } },
      },
    }),
    prisma.resumeAnalysis.count({ where: { userId } }),
  ]);
  return { analyses, total };
}

export async function countAnalyses() {
  return prisma.resumeAnalysis.count();
}

export async function aggregateAiUsage() {
  const agg = await prisma.resumeAnalysis.aggregate({
    where: { status: 'completed' },
    _sum: { tokensUsed: true, costEstimate: true },
  });
  return {
    totalTokens: agg._sum.tokensUsed ?? 0,
    totalCost: Number(agg._sum.costEstimate ?? 0),
  };
}
