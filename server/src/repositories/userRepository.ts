import { Prisma, User, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

// Fields returned in API responses — never includes passwordHash or sensitive tokens.
export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  plan: true,
  emailVerified: true,
  avatarUrl: true,
  isDeleted: true,
  deletedAt: true,
  usageResumeUploads: true,
  usageAiAnalyses: true,
  usageJobMatches: true,
  usageApplications: true,
  usageLastReset: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof USER_PUBLIC_SELECT }>;

// Fields only ever selected internally (auth operations).
const USER_AUTH_SELECT = {
  ...USER_PUBLIC_SELECT,
  passwordHash: true,
  emailVerificationToken: true,
  emailVerificationExpires: true,
  passwordResetToken: true,
  passwordResetExpires: true,
} satisfies Prisma.UserSelect;

export type AuthUser = Prisma.UserGetPayload<{ select: typeof USER_AUTH_SELECT }>;

export async function findUserById(id: string): Promise<PublicUser | null> {
  return prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: USER_PUBLIC_SELECT,
  });
}

export async function findUserByIdForAuth(id: string): Promise<AuthUser | null> {
  return prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: USER_AUTH_SELECT,
  });
}

export async function findUserByEmail(email: string): Promise<PublicUser | null> {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), isDeleted: false },
    select: USER_PUBLIC_SELECT,
  });
}

export async function findUserByEmailForAuth(email: string): Promise<AuthUser | null> {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), isDeleted: false },
    select: USER_AUTH_SELECT,
  });
}

export async function findUserByEmailVerificationToken(
  token: string,
): Promise<AuthUser | null> {
  return prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationExpires: { gt: new Date() },
      isDeleted: false,
    },
    select: USER_AUTH_SELECT,
  });
}

export async function findUserByPasswordResetToken(
  token: string,
): Promise<AuthUser | null> {
  return prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() },
      isDeleted: false,
    },
    select: USER_AUTH_SELECT,
  });
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  role?: UserRole;
  emailVerified?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      emailVerificationToken: input.emailVerificationToken,
      emailVerificationExpires: input.emailVerificationExpires,
      role: input.role ?? 'user',
      emailVerified: input.emailVerified ?? false,
    },
    select: USER_PUBLIC_SELECT,
  });
}

export async function updateUser(
  id: string,
  data: Prisma.UserUpdateInput,
): Promise<PublicUser> {
  return prisma.user.update({
    where: { id },
    data,
    select: USER_PUBLIC_SELECT,
  });
}

export async function markEmailVerified(id: string): Promise<PublicUser> {
  return prisma.user.update({
    where: { id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
    select: USER_PUBLIC_SELECT,
  });
}

export async function setPasswordResetToken(
  id: string,
  token: string,
  expires: Date,
): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { passwordResetToken: token, passwordResetExpires: expires },
  });
}

export async function clearPasswordResetToken(
  id: string,
  newPasswordHash: string,
): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: newPasswordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
}

export async function updatePasswordHash(
  id: string,
  newPasswordHash: string,
): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { passwordHash: newPasswordHash },
  });
}

export async function softDeleteUser(id: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
}

export async function incrementUsage(
  id: string,
  field: 'usageResumeUploads' | 'usageAiAnalyses' | 'usageJobMatches' | 'usageApplications',
): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { [field]: { increment: 1 } },
  });
}

// Admin: paginated user list
export async function listUsers(
  page: number,
  limit: number,
): Promise<{ users: PublicUser[]; total: number }> {
  const skip = (page - 1) * limit;
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: USER_PUBLIC_SELECT,
    }),
    prisma.user.count({ where: { isDeleted: false } }),
  ]);
  return { users, total };
}

export async function setUserRole(id: string, role: UserRole): Promise<PublicUser> {
  return prisma.user.update({
    where: { id },
    data: { role },
    select: USER_PUBLIC_SELECT,
  });
}

export async function countActiveUsers(): Promise<number> {
  return prisma.user.count({ where: { isDeleted: false } });
}

export async function upsertUserByEmail(
  email: string,
  data: CreateUserInput,
): Promise<PublicUser> {
  return prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    update: {},
    create: {
      email: email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role ?? 'user',
      emailVerified: data.emailVerified ?? false,
    },
    select: USER_PUBLIC_SELECT,
  });
}
