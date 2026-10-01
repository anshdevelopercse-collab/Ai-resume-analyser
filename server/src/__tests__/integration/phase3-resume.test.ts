/**
 * Phase 3 — Resume Repository Integration Tests
 *
 * Tests the PostgreSQL Resume repository layer.
 * Requires a live PostgreSQL connection (DATABASE_URL in .env).
 * Does NOT test MongoDB / analysis service (Phase 4).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import {
  createResume,
  findResumeById,
  findResumeByIdForStorage,
  findResumeForAnalysis,
  listResumes,
  updateResume,
  softDeleteResume,
  countActiveResumes,
} from '../../repositories/resumeRepository';

const RUN = Date.now();
const USER_A_ID = randomUUID();
const USER_B_ID = randomUUID();

async function seedUser(id: string, email: string) {
  await prisma.user.upsert({
    where: { email },
    create: {
      id,
      email,
      passwordHash: '$2b$12$testhashtesthasht esthashhh',
    },
    update: {},
  });
}

async function cleanupUsers() {
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@phase3test.local` } },
  });
}

beforeAll(async () => {
  const emailA = `user_a_${RUN}@phase3test.local`;
  const emailB = `user_b_${RUN}@phase3test.local`;
  await seedUser(USER_A_ID, emailA);
  await seedUser(USER_B_ID, emailB);
});

afterAll(async () => {
  await cleanupUsers();
  await prisma.$disconnect();
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeResumeData(userId: string, label?: string) {
  return {
    userId,
    filename: `resume_${RUN}.pdf`,
    originalName: `My Resume ${RUN}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 123456,
    storageKey: `uploads/${userId}/${RUN}/resume.pdf`,
    extractedText: 'Software engineer with 5 years experience in TypeScript and Node.js.',
    pageCount: 2,
    wordCount: 350,
    ...(label ? { label } : {}),
  };
}

// ─── createResume ──────────────────────────────────────────────────────────────

describe('createResume', () => {
  it('creates a resume and returns public fields (no storageKey)', async () => {
    const data = makeResumeData(USER_A_ID, 'Test Resume');
    const resume = await createResume(data);

    expect(resume.id).toBeDefined();
    expect(resume.userId).toBe(USER_A_ID);
    expect(resume.originalName).toBe(data.originalName);
    expect(resume.mimeType).toBe(data.mimeType);
    expect(resume.sizeBytes).toBe(data.sizeBytes);
    expect(resume.extractedText).toBe(data.extractedText);
    expect(resume.label).toBe('Test Resume');
    expect(resume.isDeleted).toBe(false);

    // storageKey must NOT be in public return
    expect((resume as any).storageKey).toBeUndefined();

    await prisma.resume.delete({ where: { id: resume.id } });
  });
});

// ─── findResumeById ────────────────────────────────────────────────────────────

describe('findResumeById', () => {
  it('returns resume for correct owner', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));
    const found = await findResumeById(r.id, USER_A_ID);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(r.id);
    expect((found as any).storageKey).toBeUndefined();

    await prisma.resume.delete({ where: { id: r.id } });
  });

  it('returns null when userId does not match (IDOR protection)', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));

    // User B cannot see User A's resume
    const found = await findResumeById(r.id, USER_B_ID);
    expect(found).toBeNull();

    await prisma.resume.delete({ where: { id: r.id } });
  });

  it('returns null for soft-deleted resume', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));
    await softDeleteResume(r.id, USER_A_ID);

    const found = await findResumeById(r.id, USER_A_ID);
    expect(found).toBeNull();

    await prisma.resume.delete({ where: { id: r.id } });
  });
});

// ─── findResumeByIdForStorage ──────────────────────────────────────────────────

describe('findResumeByIdForStorage', () => {
  it('returns storageKey for correct owner', async () => {
    const data = makeResumeData(USER_A_ID);
    const r = await createResume(data);

    const row = await findResumeByIdForStorage(r.id, USER_A_ID);
    expect(row).not.toBeNull();
    expect(row!.storageKey).toBe(data.storageKey);

    await prisma.resume.delete({ where: { id: r.id } });
  });

  it('returns null when userId does not match (IDOR protection)', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));

    const row = await findResumeByIdForStorage(r.id, USER_B_ID);
    expect(row).toBeNull();

    await prisma.resume.delete({ where: { id: r.id } });
  });
});

// ─── findResumeForAnalysis ─────────────────────────────────────────────────────

describe('findResumeForAnalysis', () => {
  it('returns id and extractedText only, IDOR-protected', async () => {
    const data = makeResumeData(USER_A_ID);
    const r = await createResume(data);

    const row = await findResumeForAnalysis(r.id, USER_A_ID);
    expect(row).not.toBeNull();
    expect(row!.id).toBe(r.id);
    expect(row!.extractedText).toBe(data.extractedText);
    expect((row as any).storageKey).toBeUndefined();
    expect((row as any).userId).toBeUndefined();

    // IDOR: User B cannot access
    const blocked = await findResumeForAnalysis(r.id, USER_B_ID);
    expect(blocked).toBeNull();

    await prisma.resume.delete({ where: { id: r.id } });
  });
});

// ─── listResumes ──────────────────────────────────────────────────────────────

describe('listResumes', () => {
  it('returns only the requesting user\'s non-deleted resumes', async () => {
    const rA1 = await createResume(makeResumeData(USER_A_ID, 'A1'));
    const rA2 = await createResume(makeResumeData(USER_A_ID, 'A2'));
    const rB = await createResume(makeResumeData(USER_B_ID, 'B1'));

    const { resumes, total } = await listResumes(USER_A_ID, 1, 50);

    const ids = resumes.map(r => r.id);
    expect(ids).toContain(rA1.id);
    expect(ids).toContain(rA2.id);
    expect(ids).not.toContain(rB.id);

    // storageKey must NOT appear in list items
    resumes.forEach(r => expect((r as any).storageKey).toBeUndefined());

    await prisma.resume.deleteMany({ where: { id: { in: [rA1.id, rA2.id, rB.id] } } });
  });

  it('excludes soft-deleted resumes', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));
    await softDeleteResume(r.id, USER_A_ID);

    const { resumes } = await listResumes(USER_A_ID, 1, 50);
    expect(resumes.map(x => x.id)).not.toContain(r.id);

    await prisma.resume.delete({ where: { id: r.id } });
  });

  it('paginates correctly', async () => {
    const created = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createResume(makeResumeData(USER_A_ID, `Paginate ${i}`))
      )
    );

    const { resumes: page1, total } = await listResumes(USER_A_ID, 1, 3);
    const { resumes: page2 } = await listResumes(USER_A_ID, 2, 3);

    expect(page1.length).toBe(3);
    expect(page2.length).toBeGreaterThanOrEqual(2);
    expect(total).toBeGreaterThanOrEqual(5);

    await prisma.resume.deleteMany({ where: { id: { in: created.map(r => r.id) } } });
  });
});

// ─── updateResume ──────────────────────────────────────────────────────────────

describe('updateResume', () => {
  it('updates label and returns updated record', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));
    const updated = await updateResume(r.id, USER_A_ID, { label: 'Updated Label' });

    expect(updated).not.toBeNull();
    expect(updated!.label).toBe('Updated Label');
    expect((updated as any).storageKey).toBeUndefined();

    await prisma.resume.delete({ where: { id: r.id } });
  });

  it('returns null when userId does not match (IDOR protection)', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));

    const result = await updateResume(r.id, USER_B_ID, { label: 'Hacked' });
    expect(result).toBeNull();

    // Verify original unchanged
    const original = await findResumeById(r.id, USER_A_ID);
    expect(original!.label).toBeNull();

    await prisma.resume.delete({ where: { id: r.id } });
  });

  it('updates extractedText with truncation applied upstream', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));
    const updated = await updateResume(r.id, USER_A_ID, { extractedText: 'New text content' });

    expect(updated!.extractedText).toBe('New text content');

    await prisma.resume.delete({ where: { id: r.id } });
  });
});

// ─── softDeleteResume ─────────────────────────────────────────────────────────

describe('softDeleteResume', () => {
  it('sets isDeleted=true and deletedAt', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));
    const result = await softDeleteResume(r.id, USER_A_ID);
    expect(result).toBe(true);

    const raw = await prisma.resume.findUnique({ where: { id: r.id } });
    expect(raw!.isDeleted).toBe(true);
    expect(raw!.deletedAt).not.toBeNull();

    await prisma.resume.delete({ where: { id: r.id } });
  });

  it('returns false when userId does not match (IDOR protection)', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));

    const result = await softDeleteResume(r.id, USER_B_ID);
    expect(result).toBe(false);

    // Resume should still be active
    const raw = await prisma.resume.findUnique({ where: { id: r.id } });
    expect(raw!.isDeleted).toBe(false);

    await prisma.resume.delete({ where: { id: r.id } });
  });

  it('returns false when already deleted', async () => {
    const r = await createResume(makeResumeData(USER_A_ID));
    await softDeleteResume(r.id, USER_A_ID);

    // Second delete returns false
    const result = await softDeleteResume(r.id, USER_A_ID);
    expect(result).toBe(false);

    await prisma.resume.delete({ where: { id: r.id } });
  });
});

// ─── countActiveResumes ───────────────────────────────────────────────────────

describe('countActiveResumes', () => {
  it('counts non-deleted resumes', async () => {
    const before = await countActiveResumes();

    const r1 = await createResume(makeResumeData(USER_A_ID));
    const r2 = await createResume(makeResumeData(USER_A_ID));
    const r3 = await createResume(makeResumeData(USER_A_ID));
    await softDeleteResume(r3.id, USER_A_ID);

    const after = await countActiveResumes();
    expect(after).toBe(before + 2);

    await prisma.resume.deleteMany({ where: { id: { in: [r1.id, r2.id, r3.id] } } });
  });
});
