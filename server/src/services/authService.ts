import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { AppError, ConflictError, UnauthorizedError } from '../middleware/errorHandler';
import type { RegisterInput, LoginInput } from '@resumeiq/shared';
import {
  findUserByEmail,
  findUserByEmailForAuth,
  findUserByEmailVerificationToken,
  findUserByPasswordResetToken,
  findUserByIdForAuth,
  createUser,
  markEmailVerified,
  setPasswordResetToken,
  clearPasswordResetToken,
  updatePasswordHash,
  type PublicUser,
} from '../repositories/userRepository';
import { generateTokenPair, rotateRefreshToken, revokeAllUserTokens } from './tokenService';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function registerUser(data: RegisterInput) {
  const existing = await findUserByEmail(data.email);
  if (existing) throw new ConflictError('Email already registered');

  const passwordHash = await hashPassword(data.password);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await createUser({
    email: data.email,
    passwordHash,
    firstName: data.firstName,
    lastName: data.lastName,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires,
  });

  return { user, verificationToken };
}

export async function loginUser(
  data: LoginInput,
  userAgent?: string,
  ipAddress?: string,
) {
  const user = await findUserByEmailForAuth(data.email);
  if (!user) throw new UnauthorizedError('Invalid email or password');

  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  const tokens = await generateTokenPair(user.id, user.role, userAgent, ipAddress);
  return { user, tokens };
}

export async function refreshUserTokens(
  refreshToken: string,
  userAgent?: string,
  ipAddress?: string,
) {
  const tokens = await rotateRefreshToken(refreshToken, userAgent, ipAddress);
  if (!tokens) throw new UnauthorizedError('Invalid or expired refresh token');
  return tokens;
}

export async function verifyEmail(token: string): Promise<PublicUser> {
  const user = await findUserByEmailVerificationToken(token);
  if (!user) throw new AppError('Invalid or expired verification token', 400);
  return markEmailVerified(user.id);
}

export async function initiatePasswordReset(email: string): Promise<string | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await setPasswordResetToken(user.id, token, expires);
  return token;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const user = await findUserByPasswordResetToken(token);
  if (!user) throw new AppError('Invalid or expired reset token', 400);

  const newHash = await hashPassword(newPassword);
  await clearPasswordResetToken(user.id, newHash);
  await revokeAllUserTokens(user.id);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await findUserByIdForAuth(userId);
  if (!user) throw new AppError('User not found', 404);

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Current password is incorrect');

  const newHash = await hashPassword(newPassword);
  await updatePasswordHash(userId, newHash);
  await revokeAllUserTokens(userId);
}
