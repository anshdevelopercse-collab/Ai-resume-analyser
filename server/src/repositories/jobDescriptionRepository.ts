import { prisma } from '../lib/prisma';

export async function createJobDescription(data: {
  userId: string;
  title: string;
  company?: string;
  description: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  url?: string;
  notes?: string;
}) {
  return prisma.jobDescription.create({ data });
}

export async function findJobDescriptionById(id: string, userId: string) {
  return prisma.jobDescription.findFirst({
    where: { id, userId, isDeleted: false },
  });
}

export async function findJobDescriptionForMatch(id: string, userId: string) {
  return prisma.jobDescription.findFirst({
    where: { id, userId, isDeleted: false },
    select: { id: true, description: true, title: true },
  });
}

export async function listJobDescriptions(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [jds, total] = await Promise.all([
    prisma.jobDescription.findMany({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.jobDescription.count({ where: { userId, isDeleted: false } }),
  ]);
  return { jds, total };
}

export async function updateJobDescription(
  id: string,
  userId: string,
  data: Partial<{
    title: string;
    company: string | null;
    description: string;
    location: string | null;
    remote: boolean | null;
    salaryMin: number | null;
    salaryMax: number | null;
    currency: string | null;
    url: string | null;
    notes: string | null;
  }>,
) {
  const result = await prisma.jobDescription.updateMany({
    where: { id, userId, isDeleted: false },
    data,
  });
  if (result.count === 0) return null;
  return prisma.jobDescription.findFirst({ where: { id, userId } });
}

export async function softDeleteJobDescription(id: string, userId: string) {
  const result = await prisma.jobDescription.updateMany({
    where: { id, userId, isDeleted: false },
    data: { isDeleted: true },
  });
  return result.count > 0;
}
