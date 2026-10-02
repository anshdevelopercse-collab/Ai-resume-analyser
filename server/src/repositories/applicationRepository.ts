import { prisma } from '../lib/prisma';
import { ApplicationStatus, Prisma } from '@prisma/client';

const APP_INCLUDE = {
  resume: { select: { id: true, originalName: true, label: true } },
  jobDescription: { select: { id: true, title: true, company: true } },
} as const;

export async function createApplication(data: {
  userId: string;
  company: string;
  role: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  jobDescriptionId?: string;
  resumeId?: string;
  status?: ApplicationStatus;
  appliedAt?: Date;
  deadline?: Date;
  nextActionDate?: Date;
  nextAction?: string;
  notes?: string;
  interviewDates?: any;
  source?: string;
  url?: string;
  contactName?: string;
  contactEmail?: string;
}) {
  return prisma.application.create({ data, include: APP_INCLUDE });
}

export async function findApplicationById(id: string, userId: string) {
  return prisma.application.findFirst({
    where: { id, userId, isDeleted: false },
    include: APP_INCLUDE,
  });
}

export async function listApplications(
  userId: string,
  filters: { statuses?: ApplicationStatus[]; search?: string },
  sort: { field: string; order: 'asc' | 'desc' },
  page: number,
  limit: number,
) {
  const skip = (page - 1) * limit;
  const where: Prisma.ApplicationWhereInput = { userId, isDeleted: false };

  if (filters.statuses?.length) where.status = { in: filters.statuses };
  if (filters.search) {
    where.OR = [
      { company: { contains: filters.search, mode: 'insensitive' } },
      { role: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const SORTABLE = new Set(['createdAt', 'company', 'appliedAt', 'status', 'deadline']);
  const field = SORTABLE.has(sort.field) ? sort.field : 'createdAt';
  const orderBy = { [field]: sort.order } as Prisma.ApplicationOrderByWithRelationInput;

  const [apps, total] = await Promise.all([
    prisma.application.findMany({ where, orderBy, skip, take: limit, include: APP_INCLUDE }),
    prisma.application.count({ where }),
  ]);
  return { apps, total };
}

export async function updateApplication(
  id: string,
  userId: string,
  data: Prisma.ApplicationUpdateInput,
) {
  const result = await prisma.application.updateMany({
    where: { id, userId, isDeleted: false },
    data,
  });
  if (result.count === 0) return null;
  return prisma.application.findFirst({ where: { id, userId }, include: APP_INCLUDE });
}

export async function softDeleteApplication(id: string, userId: string) {
  const result = await prisma.application.updateMany({
    where: { id, userId, isDeleted: false },
    data: { isDeleted: true },
  });
  return result.count > 0;
}

export async function getApplicationStats(userId: string) {
  return prisma.application.groupBy({
    by: ['status'],
    where: { userId, isDeleted: false },
    _count: { status: true },
  });
}

export async function countActiveApplications() {
  return prisma.application.count({ where: { isDeleted: false } });
}
