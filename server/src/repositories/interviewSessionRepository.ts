import { prisma } from '../lib/prisma';
import { SessionStatus } from '@prisma/client';

export async function createInterviewSession(data: {
  userId: string;
  resumeId?: string;
  jobDescriptionId?: string;
  title: string;
  questions: any;
  status: SessionStatus;
  provider?: string;
  aiModel?: string;
}) {
  return prisma.interviewSession.create({ data });
}

export async function findInterviewSessionById(id: string, userId: string) {
  return prisma.interviewSession.findFirst({ where: { id, userId } });
}

export async function listInterviewSessions(userId: string, limit: number) {
  return prisma.interviewSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function updateInterviewSession(
  id: string,
  userId: string,
  data: { questions: any; status?: SessionStatus },
) {
  const result = await prisma.interviewSession.updateMany({
    where: { id, userId },
    data,
  });
  return result.count > 0;
}
