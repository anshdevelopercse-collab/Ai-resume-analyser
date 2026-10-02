import { prisma } from '../lib/prisma';
import { AnalysisStatus } from '@prisma/client';

export async function createJobMatch(data: {
  userId: string;
  resumeId: string;
  jobDescriptionId: string;
  status: AnalysisStatus;
  idempotencyKey: string;
  provider?: string;
  aiModel?: string;
}) {
  return prisma.jobMatch.create({ data });
}

export async function findJobMatchByIdempotencyKey(key: string, statuses: AnalysisStatus[]) {
  return prisma.jobMatch.findFirst({
    where: { idempotencyKey: key, status: { in: statuses } },
  });
}

export async function findJobMatchById(id: string, userId: string) {
  return prisma.jobMatch.findFirst({
    where: { id, userId },
    include: {
      resume: { select: { id: true, originalName: true, label: true } },
      jobDescription: { select: { id: true, title: true, company: true } },
    },
  });
}

export async function updateJobMatch(
  id: string,
  data: Partial<{
    status: AnalysisStatus;
    result: any;
    provider: string;
    aiModel: string;
    tokensUsed: number;
    costEstimate: number;
    error: string;
  }>,
) {
  return prisma.jobMatch.update({ where: { id }, data });
}

export async function listJobMatches(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [matches, total] = await Promise.all([
    prisma.jobMatch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        resume: { select: { id: true, originalName: true, label: true } },
        jobDescription: { select: { id: true, title: true, company: true } },
      },
    }),
    prisma.jobMatch.count({ where: { userId } }),
  ]);
  return { matches, total };
}
