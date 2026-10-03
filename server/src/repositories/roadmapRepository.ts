import { prisma } from '../lib/prisma';
import { RoadmapStatus } from '@prisma/client';

export async function createRoadmap(data: {
  userId: string;
  targetRole: string;
  resumeId?: string;
  jobDescriptionId?: string;
  status: RoadmapStatus;
}) {
  return prisma.roadmap.create({ data });
}

export async function findRoadmapById(id: string, userId: string) {
  return prisma.roadmap.findFirst({ where: { id, userId } });
}

export async function updateRoadmap(
  id: string,
  data: Partial<{
    status: RoadmapStatus;
    provider: string;
    summary: string;
    skillGaps: any;
    milestones: any;
    error: string | null;
  }>,
) {
  return prisma.roadmap.update({ where: { id }, data });
}

export async function resetRoadmapForRetry(id: string, userId: string) {
  return prisma.roadmap.update({
    where: { id, userId },
    data: { status: 'processing', error: null, summary: null, skillGaps: [], milestones: [] },
  });
}

export async function listRoadmaps(userId: string, limit: number) {
  return prisma.roadmap.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
