import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

// storageKey is NEVER included — it is an internal storage reference
const RESUME_PUBLIC_SELECT = {
  id: true,
  userId: true,
  filename: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  extractedText: true,
  pageCount: true,
  wordCount: true,
  isActive: true,
  isDeleted: true,
  label: true,
  createdAt: true,
  updatedAt: true,
} as const;

// List view — omit extractedText for bandwidth
const RESUME_LIST_SELECT = {
  id: true,
  userId: true,
  filename: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  pageCount: true,
  wordCount: true,
  isActive: true,
  isDeleted: true,
  label: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type PublicResume = Prisma.ResumeGetPayload<{ select: typeof RESUME_PUBLIC_SELECT }>;
export type ListResume = Prisma.ResumeGetPayload<{ select: typeof RESUME_LIST_SELECT }>;

export async function createResume(data: {
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  extractedText: string;
  pageCount?: number;
  wordCount?: number;
}): Promise<PublicResume> {
  return prisma.resume.create({ data, select: RESUME_PUBLIC_SELECT });
}

// Detail view — includes extractedText; IDOR-protected by userId
export async function findResumeById(
  id: string,
  userId: string,
): Promise<PublicResume | null> {
  return prisma.resume.findFirst({
    where: { id, userId, isDeleted: false },
    select: RESUME_PUBLIC_SELECT,
  });
}

// Internal — needed only for download and delete; IDOR-protected by userId
export async function findResumeByIdForStorage(
  id: string,
  userId: string,
): Promise<{ id: string; storageKey: string; mimeType: string; originalName: string } | null> {
  return prisma.resume.findFirst({
    where: { id, userId, isDeleted: false },
    select: { id: true, storageKey: true, mimeType: true, originalName: true },
  });
}

// Used by analysisService — IDOR-protected; does NOT return storageKey
export async function findResumeForAnalysis(
  id: string,
  userId: string,
): Promise<{ id: string; extractedText: string } | null> {
  return prisma.resume.findFirst({
    where: { id, userId, isDeleted: false },
    select: { id: true, extractedText: true },
  });
}

export async function listResumes(
  userId: string,
  page: number,
  limit: number,
): Promise<{ resumes: ListResume[]; total: number }> {
  const skip = (page - 1) * limit;
  const [resumes, total] = await Promise.all([
    prisma.resume.findMany({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: RESUME_LIST_SELECT,
    }),
    prisma.resume.count({ where: { userId, isDeleted: false } }),
  ]);
  return { resumes, total };
}

export async function updateResume(
  id: string,
  userId: string,
  data: { label?: string; extractedText?: string },
): Promise<PublicResume | null> {
  const result = await prisma.resume.updateMany({
    where: { id, userId, isDeleted: false },
    data,
  });
  if (result.count === 0) return null;
  return prisma.resume.findFirst({
    where: { id, userId },
    select: RESUME_PUBLIC_SELECT,
  });
}

export async function softDeleteResume(id: string, userId: string): Promise<boolean> {
  const result = await prisma.resume.updateMany({
    where: { id, userId, isDeleted: false },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  return result.count > 0;
}

export async function countActiveResumes(): Promise<number> {
  return prisma.resume.count({ where: { isDeleted: false } });
}
