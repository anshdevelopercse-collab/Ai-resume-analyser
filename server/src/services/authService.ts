import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User, IUser } from '../models/User';
import { generateTokenPair, rotateRefreshToken, revokeAllUserTokens } from './tokenService';
import { AppError, ConflictError, UnauthorizedError } from '../middleware/errorHandler';
import type { RegisterInput, LoginInput } from '@resumeiq/shared';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function registerUser(data: RegisterInput) {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new ConflictError('Email already registered');

  const passwordHash = await hashPassword(data.password);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await User.create({
    email: data.email,
    password: passwordHash,
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
  ipAddress?: string
) {
  const user = await User.findOne({ email: data.email, isDeleted: false }).select('+password');
  if (!user) throw new UnauthorizedError('Invalid email or password');

  const valid = await verifyPassword(data.password, user.password);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  const tokens = await generateTokenPair(String(user._id), user.role, userAgent, ipAddress);
  return { user, tokens };
}

export async function refreshUserTokens(
  refreshToken: string,
  userAgent?: string,
  ipAddress?: string
) {
  const tokens = await rotateRefreshToken(refreshToken, userAgent, ipAddress);
  if (!tokens) throw new UnauthorizedError('Invalid or expired refresh token');
  return tokens;
}

export async function verifyEmail(token: string): Promise<IUser> {
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() },
    isDeleted: false,
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) throw new AppError('Invalid or expired verification token', 400);

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return user;
}

export async function initiatePasswordReset(email: string): Promise<string | null> {
  const user = await User.findOne({ email, isDeleted: false });
  if (!user) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  user.passwordResetToken = token;
  user.passwordResetExpires = expires;
  await user.save();

  return token;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() },
    isDeleted: false,
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) throw new AppError('Invalid or expired reset token', 400);

  user.password = await hashPassword(newPassword);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  await revokeAllUserTokens(String(user._id));
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError('User not found', 404);

  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) throw new UnauthorizedError('Current password is incorrect');

  user.password = await hashPassword(newPassword);
  await user.save();
  await revokeAllUserTokens(userId);
}
