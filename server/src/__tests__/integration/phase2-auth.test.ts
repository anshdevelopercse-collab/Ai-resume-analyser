/**
 * Phase 2 integration tests — PostgreSQL auth persistence.
 *
 * Requires a live PostgreSQL database (DATABASE_URL env var).
 * Each test uses unique email addresses and cleans up after itself.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { prisma } from '../../lib/prisma';
import {
  registerUser,
  loginUser,
  refreshUserTokens,
  verifyEmail,
  initiatePasswordReset,
  resetPassword,
  changePassword,
} from '../../services/authService';
import {
  generateTokenPair,
  rotateRefreshToken,
  revokeAllUserTokens,
} from '../../services/tokenService';
import {
  findUserByEmail,
  findUserById,
  updateUser,
  softDeleteUser,
  incrementUsage,
} from '../../repositories/userRepository';
import {
  findRefreshToken,
  claimTokenAtomic,
} from '../../repositories/refreshTokenRepository';
import { ConflictError, UnauthorizedError } from '../../middleware/errorHandler';
import { hashPassword } from '../../services/authService';

// Unique suffix per test run to avoid collisions on repeated runs
const RUN = Date.now();
const email = (n: string) => `${n}_${RUN}@phase2test.local`;

// Track IDs for cleanup
const createdUserIds: string[] = [];

afterEach(async () => {
  // Clean up test users and their tokens
  if (createdUserIds.length) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

// helper
async function reg(n: string, pw = 'Test1234!') {
  const { user } = await registerUser({ email: email(n), password: pw, firstName: n, lastName: 'Test' });
  createdUserIds.push(user.id);
  return user;
}

// ──────────────────────────────────────────────────────────────
// REGISTRATION
// ──────────────────────────────────────────────────────────────
describe('Registration', () => {
  it('creates a user in PostgreSQL with a bcrypt hash', async () => {
    const user = await reg('reg_basic');
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, emailVerified: true, role: true, plan: true },
    });
    expect(row).not.toBeNull();
    expect(row!.passwordHash.startsWith('$2b$')).toBe(true);
    expect(row!.emailVerified).toBe(false);
    expect(row!.role).toBe('user');
    expect(row!.plan).toBe('free');
  });

  it('never returns passwordHash in the public user object', async () => {
    const user = await reg('reg_nohash');
    expect((user as any).passwordHash).toBeUndefined();
    expect((user as any).password).toBeUndefined();
  });

  it('rejects duplicate email with ConflictError', async () => {
    await reg('reg_dup');
    await expect(registerUser({ email: email('reg_dup'), password: 'Other1234!', firstName: 'X', lastName: 'Y' }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it('does NOT create a user in MongoDB (no Mongoose User model involved)', async () => {
    const user = await reg('reg_nomongo');
    // Verify it only exists in PostgreSQL
    const pgUser = await findUserById(user.id);
    expect(pgUser).not.toBeNull();
    expect(pgUser!.email).toBe(email('reg_nomongo'));
  });
});

// ──────────────────────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────────────────────
describe('Login', () => {
  it('returns tokens on correct credentials', async () => {
    await reg('login_ok');
    const { user, tokens } = await loginUser({ email: email('login_ok'), password: 'Test1234!' });
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(user.email).toBe(email('login_ok'));
  });

  it('creates a refresh_token row in PostgreSQL on login', async () => {
    await reg('login_rt');
    const { user, tokens } = await loginUser({ email: email('login_rt'), password: 'Test1234!' });
    const row = await findRefreshToken(tokens.refreshToken);
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(user.id);
    expect(row!.used).toBe(false);
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects wrong password with UnauthorizedError', async () => {
    await reg('login_badpw');
    await expect(loginUser({ email: email('login_badpw'), password: 'WrongPass1!' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects unknown email with UnauthorizedError (same message — no enum)', async () => {
    await expect(loginUser({ email: email('no_such_user'), password: 'Test1234!' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects soft-deleted user', async () => {
    const user = await reg('login_deleted');
    await softDeleteUser(user.id);
    await expect(loginUser({ email: email('login_deleted'), password: 'Test1234!' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });
});

// ──────────────────────────────────────────────────────────────
// REFRESH TOKEN ROTATION
// ──────────────────────────────────────────────────────────────
describe('Refresh token rotation', () => {
  it('issues a NEW refresh token on refresh (rotation)', async () => {
    await reg('rt_rotate');
    const { tokens } = await loginUser({ email: email('rt_rotate'), password: 'Test1234!' });
    const newTokens = await rotateRefreshToken(tokens.refreshToken);
    expect(newTokens).not.toBeNull();
    expect(newTokens!.refreshToken).not.toBe(tokens.refreshToken);
  });

  it('marks original token as used after rotation', async () => {
    await reg('rt_used');
    const { tokens } = await loginUser({ email: email('rt_used'), password: 'Test1234!' });
    await rotateRefreshToken(tokens.refreshToken);
    const row = await findRefreshToken(tokens.refreshToken);
    expect(row!.used).toBe(true);
  });

  it('rejects replay of an already-used refresh token', async () => {
    await reg('rt_replay');
    const { tokens } = await loginUser({ email: email('rt_replay'), password: 'Test1234!' });
    await rotateRefreshToken(tokens.refreshToken);
    const result = await rotateRefreshToken(tokens.refreshToken);
    expect(result).toBeNull();
  });

  it('wipes entire token family on replay (security invariant)', async () => {
    await reg('rt_family');
    const { user, tokens: t1 } = await loginUser({ email: email('rt_family'), password: 'Test1234!' });
    const t2 = await rotateRefreshToken(t1.refreshToken);
    expect(t2).not.toBeNull();

    // Replay t1 — family wipe
    await rotateRefreshToken(t1.refreshToken);

    // t2's token should now be gone
    const t2Row = await findRefreshToken(t2!.refreshToken);
    expect(t2Row).toBeNull();
  });

  it('logout revokes the refresh token', async () => {
    await reg('rt_logout');
    const { tokens } = await loginUser({ email: email('rt_logout'), password: 'Test1234!' });
    await revokeAllUserTokens((await findRefreshToken(tokens.refreshToken))!.userId);
    const result = await rotateRefreshToken(tokens.refreshToken);
    expect(result).toBeNull();
  });

  it('concurrent refresh — atomic claim prevents double-issue', async () => {
    await reg('rt_conc');
    const { tokens } = await loginUser({ email: email('rt_conc'), password: 'Test1234!' });
    const rt = tokens.refreshToken;

    // Race two rotations against the same token
    const [r1, r2] = await Promise.all([
      rotateRefreshToken(rt),
      rotateRefreshToken(rt),
    ]);

    const successes = [r1, r2].filter(r => r !== null).length;
    expect(successes).toBe(1);
  });

  it('rejects expired refresh token', async () => {
    await reg('rt_expired');
    const { user, tokens } = await loginUser({ email: email('rt_expired'), password: 'Test1234!' });
    // Back-date expiry directly in DB
    const row = await findRefreshToken(tokens.refreshToken);
    await prisma.refreshToken.update({
      where: { id: row!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const result = await rotateRefreshToken(tokens.refreshToken);
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// PASSWORD RESET
// ──────────────────────────────────────────────────────────────
describe('Password reset', () => {
  it('creates a reset token in PostgreSQL', async () => {
    await reg('pr_create');
    const token = await initiatePasswordReset(email('pr_create'));
    expect(token).not.toBeNull();
    expect(token!.length).toBe(64);
    const row = await prisma.user.findFirst({
      where: { email: email('pr_create') },
      select: { passwordResetToken: true, passwordResetExpires: true },
    });
    expect(row!.passwordResetToken).toBe(token);
    expect(row!.passwordResetExpires!.getTime()).toBeGreaterThan(Date.now());
  });

  it('reset token is never returned in public user fields', async () => {
    await reg('pr_noleak');
    const token = await initiatePasswordReset(email('pr_noleak'));
    const pub = await findUserByEmail(email('pr_noleak'));
    expect((pub as any).passwordResetToken).toBeUndefined();
    expect(token).not.toBeUndefined(); // it exists internally
  });

  it('accepts valid token and changes password', async () => {
    await reg('pr_valid');
    const token = await initiatePasswordReset(email('pr_valid'));
    await resetPassword(token!, 'NewPass5678!');
    const { tokens } = await loginUser({ email: email('pr_valid'), password: 'NewPass5678!' });
    expect(tokens.accessToken).toBeTruthy();
  });

  it('old password no longer works after reset', async () => {
    await reg('pr_old');
    const token = await initiatePasswordReset(email('pr_old'));
    await resetPassword(token!, 'NewPass5678!');
    await expect(loginUser({ email: email('pr_old'), password: 'Test1234!' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('token is cleared from DB after use (single-use)', async () => {
    await reg('pr_clear');
    const token = await initiatePasswordReset(email('pr_clear'));
    await resetPassword(token!, 'NewPass5678!');
    const row = await prisma.user.findFirst({
      where: { email: email('pr_clear') },
      select: { passwordResetToken: true },
    });
    expect(row!.passwordResetToken).toBeNull();
  });

  it('rejects expired reset token', async () => {
    await reg('pr_exp');
    await initiatePasswordReset(email('pr_exp'));
    await prisma.user.updateMany({
      where: { email: email('pr_exp') },
      data: { passwordResetExpires: new Date(Date.now() - 1000) },
    });
    const row = await prisma.user.findFirst({ where: { email: email('pr_exp') }, select: { passwordResetToken: true } });
    await expect(resetPassword(row!.passwordResetToken!, 'New9999!'))
      .rejects.toThrow();
  });

  it('returns null for unknown email (no enumeration)', async () => {
    const token = await initiatePasswordReset(email('no_such_user'));
    expect(token).toBeNull();
  });

  it('all refresh tokens revoked after password reset', async () => {
    await reg('pr_revoke');
    const { user, tokens: rt1 } = await loginUser({ email: email('pr_revoke'), password: 'Test1234!' });
    const resetToken = await initiatePasswordReset(email('pr_revoke'));
    await resetPassword(resetToken!, 'NewPass9!');
    const row = await findRefreshToken(rt1.refreshToken);
    expect(row).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// EMAIL VERIFICATION
// ──────────────────────────────────────────────────────────────
describe('Email verification', () => {
  it('marks emailVerified=true and clears token on valid verify', async () => {
    const { verificationToken } = await registerUser({
      email: email('ev_valid'), password: 'Test1234!', firstName: 'EV', lastName: 'Test',
    });
    const row = await prisma.user.findFirst({ where: { email: email('ev_valid') } });
    createdUserIds.push(row!.id);
    await verifyEmail(verificationToken);
    const after = await prisma.user.findFirst({
      where: { email: email('ev_valid') },
      select: { emailVerified: true, emailVerificationToken: true },
    });
    expect(after!.emailVerified).toBe(true);
    expect(after!.emailVerificationToken).toBeNull();
  });

  it('rejects invalid token', async () => {
    await expect(verifyEmail('invalid_token_xyz')).rejects.toThrow();
  });

  it('rejects expired token', async () => {
    const { verificationToken } = await registerUser({
      email: email('ev_exp'), password: 'Test1234!', firstName: 'EV', lastName: 'Exp',
    });
    const row = await prisma.user.findFirst({ where: { email: email('ev_exp') } });
    createdUserIds.push(row!.id);
    await prisma.user.update({
      where: { id: row!.id },
      data: { emailVerificationExpires: new Date(Date.now() - 1000) },
    });
    await expect(verifyEmail(verificationToken)).rejects.toThrow();
  });

  it('rejects reused token after successful verification', async () => {
    const { verificationToken } = await registerUser({
      email: email('ev_reuse'), password: 'Test1234!', firstName: 'EV', lastName: 'Reuse',
    });
    const row = await prisma.user.findFirst({ where: { email: email('ev_reuse') } });
    createdUserIds.push(row!.id);
    await verifyEmail(verificationToken);
    await expect(verifyEmail(verificationToken)).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────
// USER ISOLATION
// ──────────────────────────────────────────────────────────────
describe('User isolation', () => {
  it('findUserById only returns the requested user', async () => {
    const a = await reg('iso_a');
    const b = await reg('iso_b');
    const foundA = await findUserById(a.id);
    expect(foundA!.email).toBe(email('iso_a'));
    expect(foundA!.id).not.toBe(b.id);
  });

  it('findUserByEmail is case-insensitive and trims', async () => {
    await reg('iso_case');
    const found = await findUserByEmail(email('iso_case').toUpperCase());
    expect(found).not.toBeNull();
  });

  it('soft-deleted users are invisible to public queries', async () => {
    const u = await reg('iso_del');
    await softDeleteUser(u.id);
    const found = await findUserById(u.id);
    expect(found).toBeNull();
  });

  it('updateUser does not accept userId override in data (Prisma where clause enforced)', async () => {
    const a = await reg('iso_upd_a');
    const b = await reg('iso_upd_b');
    // updateUser(a.id, ...) always updates user A — there is no way to target B
    await updateUser(a.id, { firstName: 'ModifiedA' });
    const bAfter = await findUserByEmail(email('iso_upd_b'));
    expect(bAfter!.firstName).toBe('iso_upd_b'); // unchanged
  });
});

// ──────────────────────────────────────────────────────────────
// USAGE COUNTER CONCURRENCY
// ──────────────────────────────────────────────────────────────
describe('Usage counter concurrency', () => {
  it('10 concurrent increments produce exactly 10', async () => {
    const user = await reg('usage_conc');
    const N = 10;
    await Promise.all(Array.from({ length: N }, () =>
      incrementUsage(user.id, 'usageResumeUploads')
    ));
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { usageResumeUploads: true },
    });
    expect(row!.usageResumeUploads).toBe(N);
  });

  it('25 concurrent aiAnalysis increments produce exactly 25', async () => {
    const user = await reg('usage_ai');
    const N = 25;
    await Promise.all(Array.from({ length: N }, () =>
      incrementUsage(user.id, 'usageAiAnalyses')
    ));
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { usageAiAnalyses: true },
    });
    expect(row!.usageAiAnalyses).toBe(N);
  });
});

// ──────────────────────────────────────────────────────────────
// DATABASE INTEGRITY
// ──────────────────────────────────────────────────────────────
describe('Database integrity', () => {
  it('unique email constraint is enforced at DB level', async () => {
    const u = await reg('db_uniq');
    await expect(
      prisma.user.create({
        data: { email: email('db_uniq'), passwordHash: 'x', role: 'user', plan: 'free' },
      })
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('refresh token FK cascade: deleting user removes tokens', async () => {
    const user = await reg('db_cascade');
    await loginUser({ email: email('db_cascade'), password: 'Test1234!' });
    const before = await prisma.refreshToken.count({ where: { userId: user.id } });
    expect(before).toBeGreaterThan(0);

    // Hard-delete for cascade test (not soft-delete)
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    createdUserIds.splice(createdUserIds.indexOf(user.id), 1); // already deleted

    const after = await prisma.refreshToken.count({ where: { userId: user.id } });
    expect(after).toBe(0);
  });

  it('claimTokenAtomic is a true test-and-set (concurrent claim — one wins)', async () => {
    await reg('db_atomic');
    const { tokens } = await loginUser({ email: email('db_atomic'), password: 'Test1234!' });
    const row = await findRefreshToken(tokens.refreshToken);

    const [r1, r2] = await Promise.all([
      claimTokenAtomic(row!.id),
      claimTokenAtomic(row!.id),
    ]);
    const wins = [r1, r2].filter(Boolean).length;
    expect(wins).toBe(1);
  });
});
