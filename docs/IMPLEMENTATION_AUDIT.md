# ResumeIQ — Implementation Audit

_Date: 2026-09-29_

This document classifies every major feature using verified code inspection, not
assumptions. Legend:

| Symbol | Meaning |
|---|---|
| ✅ | Verified working |
| ⚠️ | Implemented but has a confirmed bug / risk |
| 🔶 | Partially implemented — core works, edge cases missing |
| 🧪 | Demo-mode only — no real integration |
| ❌ | Missing or broken |

---

## 1. Authentication & Session Management

| Feature | Status | Notes |
|---|---|---|
| User registration with email verification | ✅ | Zod validation, bcrypt-12, unique email constraint |
| Email verification flow | ✅ | Single-use token, 24-hour expiry in authService |
| Login with JWT access token | ✅ | Bearer header + cookie support |
| Refresh token rotation with family tracking | ✅ | Replay detection deletes entire family |
| Logout (revoke refresh token) | ✅ | Cookie cleared, token revoked in DB |
| Forgot-password / reset-password | ✅ | Single-use token, email sent via emailService |
| Change password | ✅ | Validates current password, clears session |
| Soft-delete account | ✅ | Email obfuscated on delete |
| Frontend token refresh interceptor | ✅ | Queue-based, retries inflight requests |
| Auth state persisted in Zustand | ✅ | `partialize` excludes functions |

**Note**: JWT config env var names in `config/index.ts` did not match `.env.example` — fixed in this session (see §Fixes).

---

## 2. Resume Management

| Feature | Status | Notes |
|---|---|---|
| File upload (PDF / DOCX) | ✅ | multer memory storage, mime-type filter |
| Magic-byte validation (PDF `%PDF`, DOCX `PK`) | ✅ | fileParser.ts |
| PDF text extraction via pdf-parse | ✅ | |
| DOCX text extraction via mammoth | ✅ | |
| Text sanitization (script tags, control chars) | ✅ | |
| File size limit (10 MB) | ✅ | Enforced at multer and fileParser level |
| Local file storage | ✅ | storagePath from config |
| Ownership-enforced CRUD | ✅ | All queries include `userId` filter |
| Soft delete + async storage cleanup | ✅ | |
| Download with ownership check | ✅ | |

---

## 3. AI Resume Analysis

| Feature | Status | Notes |
|---|---|---|
| AI provider factory (Anthropic → OpenAI → Demo) | ✅ | Singleton, auto-selected by API key presence |
| Demo mode with deterministic responses | ✅ | Clearly labeled in response meta |
| Real Anthropic API call | ✅ | With cost estimate, token tracking |
| JSON extraction from AI response | ✅ | extractJSON() with `{…}` bounds |
| Score validation and clamping (0-100) | ✅ | validateAnalysisResult() |
| Idempotency check (skip if already running) | ⚠️ | **BUG**: Stored key appends `uuidv4()`, so lookup key never matches stored key — every call creates a duplicate analysis — **fixed in this session** |
| Async processing with error capture | ✅ | processAnalysis() catches and stores error |
| Result includes scoring methodology disclaimer | ✅ | |

---

## 4. Job Matching

| Feature | Status | Notes |
|---|---|---|
| Create job description (with Zod validation) | ✅ | |
| Ownership-enforced CRUD for job descriptions | ✅ | |
| AI job-match analysis | ✅ | Resume excerpt (4000 chars) + JD (3000 chars) |
| Idempotency / duplicate prevention | ⚠️ | **BUG**: No duplicate check before creating match record; key includes `uuidv4()` — every request creates a new match — **fixed in this session** |
| Score clamping | ✅ | matchScore, keywordCoverage both clamped |
| Pagination of match history | ✅ | |

---

## 5. Interview Preparation

| Feature | Status | Notes |
|---|---|---|
| Generate questions from resume + JD | ✅ | 8-10 questions, typed (technical/behavioral/etc.) |
| Fallback when no resume/JD provided | ✅ | Uses empty strings, defaults to "Software Engineer" |
| Per-answer AI feedback | ✅ | Skipped cleanly in demo mode |
| Demo mode feedback label | ✅ | Clearly says "CONFIGURE AI PROVIDER" |
| Session persistence in DB | ✅ | |
| Answer length limit | ✅ | Sliced to 5000 chars |

---

## 6. Skill Roadmap

| Feature | Status | Notes |
|---|---|---|
| Generate roadmap from targetRole + optional resume/JD | ✅ | |
| Milestone with UUID, priority, estimatedWeeks | ✅ | |
| Toggle milestone completion via PATCH | ✅ | |
| Frontend page with expandable cards | ✅ | |
| Async processing with pending status | ✅ | |

---

## 7. Application Tracker

| Feature | Status | Notes |
|---|---|---|
| Create / update / delete applications | ✅ | |
| Zod validation on create + partial update | ✅ | Prevents mass-assignment by design |
| Filter by status, search by company/role | ✅ | |
| Sort by configurable field | ✅ | Allowlisted fields only |
| Aggregate stats by status | ✅ | |
| Soft delete | ✅ | |

---

## 8. Admin Panel

| Feature | Status | Notes |
|---|---|---|
| Admin-only middleware (`requireAdmin`) | ✅ | Stacked on all admin routes |
| List users with pagination | ✅ | |
| Change user role | ✅ | Validates against `['user','admin']` allowlist |
| Platform stats (users, resumes, analyses, AI cost) | ✅ | |

---

## 9. Infrastructure / Security

| Feature | Status | Notes |
|---|---|---|
| Helmet security headers | ✅ | CSP disabled in dev, enabled in prod |
| CORS allowlist | ✅ | Explicit origin whitelist, no `*` |
| Global + per-route rate limiting | ✅ | Auth (10/window), upload (5/window), AI (10/window) |
| Zod request validation on all mutating routes | ✅ | `validate()` middleware |
| IDOR prevention (userId scoping on all queries) | ✅ | Every DB query includes `userId` filter |
| Refresh-token replay detection | ✅ | Family invalidated on token reuse |
| No AI keys exposed to frontend | ✅ | Keys read server-side only |
| Resume/JD text treated as data, not instructions | ✅ | Prompt wraps content in explicit data sections |
| No secrets in source control | ✅ | `.env.example` has placeholders only |
| Health `/health` and readiness `/ready` endpoints | ✅ | |
| Request ID propagation | ✅ | `requestId` middleware, returned in error responses |
| Docker multi-stage builds | ✅ | Non-root user in server image |
| morgan HTTP logging (no sensitive fields logged) | ✅ | Configured to skip `/health` |

---

## 10. Confirmed Bugs (Fixed in This Session)

### BUG-01 — Idempotency key stored with random suffix (analysisService)

**File**: `server/src/services/analysisService.ts:57`

**Before**:
```ts
idempotencyKey: `${idempotencyKey}:${uuidv4()}`,
```

**Problem**: The duplicate-check at line 47 queries `{ idempotencyKey }` (without the UUID),
but the record is stored with a different key. Every call passes the duplicate check
and creates a new analysis record even when one already exists.

**Fix**: Store the clean key without UUID suffix.

---

### BUG-02 — Job match has no idempotency check (jobMatchService)

**File**: `server/src/services/jobMatchService.ts:47–64`

**Problem**: No check for an existing match with the same `(userId, resumeId, jobDescriptionId)`
before creating a new record. Key also included `uuidv4()` ensuring every call was unique.

**Fix**: Added duplicate check (reuses existing completed/processing match) and removed UUID
suffix from key, mirroring the analysis service pattern.

---

### BUG-03 — Environment variable names mismatched between config and .env.example

**Files**: `server/src/config/index.ts`, `.env.example`

| `.env.example` key | config read | Fix applied |
|---|---|---|
| `JWT_ACCESS_EXPIRES_IN` | `JWT_ACCESS_EXPIRES` | config updated |
| `JWT_REFRESH_EXPIRES_IN` | `JWT_REFRESH_EXPIRES` | config updated |
| `RATE_LIMIT_MAX_REQUESTS` | `RATE_LIMIT_MAX` | config updated |
| `STORAGE_LOCAL_PATH` | `LOCAL_STORAGE_PATH` | config updated |
| `S3_ACCESS_KEY_ID` | `S3_ACCESS_KEY` | config updated |
| `S3_SECRET_ACCESS_KEY` | `S3_SECRET_KEY` | config updated |

---

## 11. Test Coverage

| Layer | Status |
|---|---|
| Unit tests | ❌ None present |
| Integration tests (API) | ❌ None present |
| E2E tests (Playwright) | ❌ None present |

Test infrastructure (Vitest for server/shared, Playwright for E2E) is configured in
`package.json` but no test files exist. This is the largest gap for production readiness.

---

## 12. Missing for Production

- [ ] Automated test suite (unit + integration + E2E)
- [ ] Database indexes audit (analysisService queries `idempotencyKey` with no index)
- [ ] Background job queue (currently `async` fire-and-forget; process crash loses jobs)
- [ ] S3 storage integration fully wired (local storage only tested)
- [ ] SMTP email provider (currently `console` mode)
- [ ] Subscription / billing tier enforcement (plan field exists, limits not enforced)
- [ ] Proper SMTP configuration and email delivery testing
- [ ] Rate-limit storage (in-memory; resets on restart, not shared across replicas)
