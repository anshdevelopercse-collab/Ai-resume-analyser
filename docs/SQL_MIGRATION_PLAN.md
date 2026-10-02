# ResumeIQ — MongoDB → PostgreSQL Migration Plan

> **Status: AUDIT COMPLETE — awaiting approval before any code changes**
>
> This document is the result of a complete read-only audit of the entire codebase.
> No database, model, service, controller, route, migration file, or test has been
> modified. Approval of this plan is required before Phase 6 work begins.

---

## Table of Contents

1. [Phase 1 — Database Engine Recommendation](#phase-1--database-engine-recommendation)
2. [Phase 2 — Complete MongoDB Dependency Inventory](#phase-2--complete-mongodb-dependency-inventory)
3. [Phase 3 — Mongoose Model Audit](#phase-3--mongoose-model-audit)
4. [Phase 4 — Normalized SQL Schema](#phase-4--normalized-sql-schema)
5. [Phase 5 — ORM Recommendation](#phase-5--orm-recommendation)
6. [Phases 6–20 — Implementation Roadmap](#phases-620--implementation-roadmap)
7. [API Contract Preservation Checklist](#api-contract-preservation-checklist)
8. [Data Migration Strategy](#data-migration-strategy)
9. [Risk Register](#risk-register)

---

## Phase 1 — Database Engine Recommendation

**Recommendation: PostgreSQL 16+**

| Criterion | PostgreSQL | MySQL 8 |
|-----------|-----------|---------|
| JSONB for unstructured AI results | ✅ Full JSONB with operators | ⚠️ JSON type, limited operators |
| Array columns | ✅ Native | ❌ Not native |
| TypeScript ORM ecosystem (Prisma/Drizzle) | ✅ First-class | ✅ Supported |
| UUID primary keys | ✅ `gen_random_uuid()` built-in | ⚠️ `UUID()` function, less ergonomic |
| Full-text search on `extracted_text` | ✅ `tsvector`/`tsquery` | ✅ FULLTEXT but different syntax |
| CHECK constraints | ✅ | ⚠️ Parsed but not enforced until 8.0.16 |
| GENERATED columns | ✅ | ✅ |
| Aggregation (admin stats) | ✅ `GROUP BY` + window functions | ✅ |
| `ON DELETE CASCADE / SET NULL` | ✅ | ✅ with InnoDB |
| Partial/conditional indexes | ✅ `WHERE is_deleted = false` | ⚠️ Functional indexes only |

**Deciding factors:**
- Two `Schema.Types.Mixed` fields (`result` in ResumeAnalysis, JobMatch) map cleanly to `JSONB`.
- Three JSONB arrays (`questions`, `milestones`, `skill_gaps`) benefit from Postgres JSONB operators.
- Partial indexes (`WHERE is_deleted = false`) will halve index size for all soft-deleted tables.
- Prisma's Postgres driver is the most battle-tested in the TypeScript ecosystem.
- No existing MySQL dependency or constraint in this project.

---

## Phase 2 — Complete MongoDB Dependency Inventory

Every file that imports a Mongoose model or uses a MongoDB-specific API:

### Server-side files with direct Mongoose usage

| File | Models used | MongoDB-specific operations |
|------|-------------|----------------------------|
| `server/src/models/User.ts` | defines User | Schema, Model, ObjectId, TTL, toJSON hook |
| `server/src/models/RefreshToken.ts` | defines RefreshToken | Schema, TTL index (`expireAfterSeconds:0`) |
| `server/src/models/Resume.ts` | defines Resume | Schema, composite index, toJSON strips `storageKey` |
| `server/src/models/ResumeAnalysis.ts` | defines ResumeAnalysis | Schema, `Schema.Types.Mixed`, unique index |
| `server/src/models/JobDescription.ts` | defines JobDescription | Schema |
| `server/src/models/JobMatch.ts` | defines JobMatch | Schema, `Schema.Types.Mixed`, unique index |
| `server/src/models/InterviewSession.ts` | defines InterviewSession | Schema, nested subdoc array, `_id:false` |
| `server/src/models/Roadmap.ts` | defines Roadmap | Schema, nested subdoc array, `_id:false` |
| `server/src/models/Application.ts` | defines Application | Schema, array of Date |
| `server/src/services/tokenService.ts` | RefreshToken, User | `create`, `findOne`, `deleteMany`, `deleteOne`, `save` |
| `server/src/services/authService.ts` | User | `findOne`, `create`, `save`; `$gt` date operator |
| `server/src/services/analysisService.ts` | Resume, ResumeAnalysis | `findOne`, `create`, `findById`, `save`, `find().sort().skip().limit().populate()`, `countDocuments`, `$in` |
| `server/src/services/jobMatchService.ts` | Resume, JobDescription, JobMatch | Same as above with double `populate`, `$in` |
| `server/src/controllers/resumeController.ts` | Resume | `create`, `find`, `findOne`, `save`, `countDocuments`, `$inc` for usage counter, `.select()` |
| `server/src/controllers/applicationController.ts` | Application | `create`, `find`, `findOne`, `findOneAndUpdate`, `countDocuments`, `aggregate`, `$in`, `$regex`, `$or` |
| `server/src/controllers/interviewController.ts` | InterviewSession, Resume, JobDescription | `create`, `find`, `findOne`, `save`, subdoc array manipulation |
| `server/src/controllers/roadmapController.ts` | Roadmap, Resume, JobDescription | `create`, `find`, `findOne`, `findByIdAndUpdate`, `save`, subdoc array manipulation |
| `server/src/controllers/jobController.ts` | JobDescription | `create`, `find`, `findOne`, `findOneAndUpdate`, `countDocuments` |
| `server/src/routes/admin.ts` | User, Resume, ResumeAnalysis, Application | `find`, `countDocuments`, `findByIdAndUpdate`, `aggregate` with `$group`/`$sum` |
| `server/src/middleware/auth.ts` | User | `findOne` with IDOR filter `{ _id, isDeleted: false }` |
| `server/src/middleware/errorHandler.ts` | — | Detects `MongooseError`, `MongoServerSelectionError`, etc. by name |
| `server/src/config/database.ts` | — | `mongoose.connect()`, `mongoose.set('bufferTimeoutMS')` |
| `server/src/config/index.ts` | — | `MONGODB_URI` env var |
| `server/src/app.ts` | — | `mongoose.default.connection.readyState` in `/ready` endpoint |
| `server/src/index.ts` | User | `findOne` (seed check), `User.create` (seed) |

### Summary counts

- **9 Mongoose model files** to be replaced with Prisma schema + migrations
- **16 server-side files** that call Mongoose model methods
- **0 client-side files** reference MongoDB (frontend is DB-agnostic via REST API)
- **0 test files** currently import Mongoose models directly (tests use supertest against the running server)

---

## Phase 3 — Mongoose Model Audit

### 3.1 User

| Mongoose field | Type | Constraints | SQL column | SQL type | Notes |
|----------------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | auto | `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `email` | String | unique, lowercase, trim, max:255 | `email` | `VARCHAR(255) NOT NULL UNIQUE` | application enforces lowercase |
| `password` | String | select:false | `password_hash` | `VARCHAR(255) NOT NULL` | renamed; never returned by default |
| `firstName` | String | — | `first_name` | `VARCHAR(100)` | |
| `lastName` | String | — | `last_name` | `VARCHAR(100)` | |
| `role` | String | enum: user/admin | `role` | `VARCHAR(20) NOT NULL DEFAULT 'user'` | CHECK constraint |
| `plan` | String | enum: free/pro/enterprise | `plan` | `VARCHAR(20) NOT NULL DEFAULT 'free'` | CHECK constraint |
| `emailVerified` | Boolean | default:false | `email_verified` | `BOOLEAN NOT NULL DEFAULT false` | |
| `emailVerificationToken` | String | select:false | `email_verification_token` | `VARCHAR(255)` | never returned by default |
| `emailVerificationExpires` | Date | — | `email_verification_expires` | `TIMESTAMPTZ` | |
| `passwordResetToken` | String | select:false | `password_reset_token` | `VARCHAR(255)` | never returned by default |
| `passwordResetExpires` | Date | — | `password_reset_expires` | `TIMESTAMPTZ` | |
| `avatarUrl` | String | max:2048 | `avatar_url` | `VARCHAR(2048)` | |
| `isDeleted` | Boolean | default:false | `is_deleted` | `BOOLEAN NOT NULL DEFAULT false` | |
| `deletedAt` | Date | — | `deleted_at` | `TIMESTAMPTZ` | |
| `usage.resumeUploads` | Number | default:0 | `usage_resume_uploads` | `INT NOT NULL DEFAULT 0` | flattened from subdoc |
| `usage.aiAnalyses` | Number | default:0 | `usage_ai_analyses` | `INT NOT NULL DEFAULT 0` | |
| `usage.jobMatches` | Number | default:0 | `usage_job_matches` | `INT NOT NULL DEFAULT 0` | |
| `usage.applications` | Number | default:0 | `usage_applications` | `INT NOT NULL DEFAULT 0` | |
| `usage.lastReset` | Date | — | `usage_last_reset` | `TIMESTAMPTZ` | |
| `createdAt` | Date | auto | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |
| `updatedAt` | Date | auto | `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |

**Indexes:**
- `UNIQUE (email)` — auto from constraint
- `INDEX ON users (is_deleted)` — replacing `{isDeleted:1}`
- `INDEX ON users (created_at DESC)` — replacing `{createdAt:-1}`
- Optional: partial `INDEX ON users (email) WHERE is_deleted = false`

**Behavior to preserve:**
- `toJSON` strips password, tokens, `__v` → Prisma: explicit `select` exclusion in all serialization helpers
- Virtual `fullName` → computed in application layer (no DB change needed)
- `$inc { 'usage.resumeUploads': 1 }` → `UPDATE users SET usage_resume_uploads = usage_resume_uploads + 1 WHERE id = $1`

---

### 3.2 RefreshToken

| Mongoose field | Type | Constraints | SQL column | SQL type | Notes |
|----------------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | auto | `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `userId` | ObjectId | ref User, required | `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `token` | String | unique, index | `token` | `VARCHAR(120) NOT NULL UNIQUE` | 96 hex chars from `randomBytes(48)` |
| `family` | String | index | `family` | `UUID NOT NULL` | UUIDs from `uuidv4()` |
| `used` | Boolean | default:false | `used` | `BOOLEAN NOT NULL DEFAULT false` | |
| `expiresAt` | Date | required | `expires_at` | `TIMESTAMPTZ NOT NULL` | |
| `userAgent` | String | max:500 | `user_agent` | `VARCHAR(500)` | |
| `ipAddress` | String | max:45 | `ip_address` | `VARCHAR(45)` | supports IPv6 |
| `createdAt` | Date | auto | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |
| `updatedAt` | Date | auto | `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |

**Indexes:**
- `UNIQUE (token)`
- `INDEX ON refresh_tokens (user_id)`
- `INDEX ON refresh_tokens (family)`
- `INDEX ON refresh_tokens (expires_at)` — for efficient cleanup

**MongoDB-specific behavior to replace:**
- **TTL index** (`expireAfterSeconds:0` on `expiresAt`) — MongoDB auto-deletes expired docs.
  → SQL replacement: scheduled cleanup query at startup + periodic background job:
  ```sql
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
  ```
  The `rotateRefreshToken` service already checks `existing.expiresAt < new Date()` and deletes individual expired tokens. The startup cleanup handles stale bulk accumulation.
- `RefreshToken.deleteMany({ family: existing.family })` — token family invalidation on reuse attack → `DELETE FROM refresh_tokens WHERE family = $1`

---

### 3.3 Resume

| Mongoose field | Type | Constraints | SQL column | SQL type | Notes |
|----------------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | auto | `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `userId` | ObjectId | ref User, index | `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `filename` | String | max:255 | `filename` | `VARCHAR(255)` | storage key filename |
| `originalName` | String | max:255 | `original_name` | `VARCHAR(255)` | user-facing filename |
| `mimeType` | String | — | `mime_type` | `VARCHAR(100)` | |
| `sizeBytes` | Number | — | `size_bytes` | `INT` | |
| `storageKey` | String | excluded from toJSON | `storage_key` | `VARCHAR(512) NOT NULL` | NEVER returned in API responses |
| `extractedText` | String | default:'' | `extracted_text` | `TEXT NOT NULL DEFAULT ''` | up to 50,000 chars |
| `pageCount` | Number | — | `page_count` | `INT` | |
| `wordCount` | Number | — | `word_count` | `INT` | |
| `isActive` | Boolean | default:true | `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `isDeleted` | Boolean | default:false | `is_deleted` | `BOOLEAN NOT NULL DEFAULT false` | |
| `deletedAt` | Date | — | `deleted_at` | `TIMESTAMPTZ` | |
| `label` | String | max:200 | `label` | `VARCHAR(200)` | |
| `createdAt` | Date | auto | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |
| `updatedAt` | Date | auto | `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |

**Indexes:**
- `INDEX ON resumes (user_id, is_deleted, created_at DESC)` — composite, replacing Mongoose composite index
- Optional: `INDEX ON resumes (user_id) WHERE is_deleted = false` — partial

**Behavior to preserve:**
- `storageKey` stripped from `toJSON` → always use explicit column selection; never include `storage_key` in SELECT for API responses
- IDOR pattern: `findOne({ _id, userId, isDeleted: false })` → `WHERE id = $1 AND user_id = $2 AND is_deleted = false`
- `select('-storageKey -extractedText')` on list → SQL: omit those columns from SELECT

---

### 3.4 ResumeAnalysis

| Mongoose field | Type | Constraints | SQL column | SQL type | Notes |
|----------------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | auto | `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `userId` | ObjectId | ref User | `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `resumeId` | ObjectId | ref Resume | `resume_id` | `UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE` | |
| `status` | String | enum: pending/processing/completed/failed | `status` | `VARCHAR(20) NOT NULL DEFAULT 'pending'` | CHECK constraint |
| `provider` | String | default:'demo' | `provider` | `VARCHAR(50) NOT NULL DEFAULT 'demo'` | |
| `aiModel` | String | default:'demo' | `ai_model` | `VARCHAR(100) NOT NULL DEFAULT 'demo'` | |
| `tokensUsed` | Number | — | `tokens_used` | `INT` | |
| `costEstimate` | Number | — | `cost_estimate` | `NUMERIC(10,6)` | |
| `processingMs` | Number | — | `processing_ms` | `INT` | |
| `result` | Mixed | — | `result` | `JSONB` | **JSONB justified**: unstructured AI output, queried as a whole |
| `error` | String | — | `error` | `TEXT` | |
| `idempotencyKey` | String | required, unique | `idempotency_key` | `VARCHAR(255) NOT NULL UNIQUE` | format: `analysis:${userId}:${resumeId}` |
| `createdAt` | Date | auto | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |
| `updatedAt` | Date | auto | `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |

**Indexes:**
- `UNIQUE (idempotency_key)`
- `INDEX ON resume_analyses (user_id, resume_id)`
- `INDEX ON resume_analyses (user_id, created_at DESC)`
- `INDEX ON resume_analyses (status)`

**MongoDB-specific behavior to replace:**
- `{ $in: ['completed', 'processing'] }` → `WHERE status IN ('completed', 'processing')`
- `populate('resumeId', 'originalName label createdAt')` → `LEFT JOIN resumes ON resumes.id = resume_analyses.resume_id`

---

### 3.5 JobDescription

| Mongoose field | Type | Constraints | SQL column | SQL type | Notes |
|----------------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | auto | `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `userId` | ObjectId | ref User, index | `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `title` | String | max:200, required | `title` | `VARCHAR(200) NOT NULL` | |
| `company` | String | max:200 | `company` | `VARCHAR(200)` | |
| `description` | String | max:20000, required | `description` | `TEXT NOT NULL` | |
| `location` | String | max:200 | `location` | `VARCHAR(200)` | |
| `remote` | Boolean | — | `remote` | `BOOLEAN` | |
| `salaryMin` | Number | — | `salary_min` | `NUMERIC(12,2)` | |
| `salaryMax` | Number | — | `salary_max` | `NUMERIC(12,2)` | |
| `currency` | String | max:10 | `currency` | `VARCHAR(10)` | |
| `url` | String | max:2048 | `url` | `VARCHAR(2048)` | |
| `notes` | String | max:2000 | `notes` | `TEXT` | |
| `isDeleted` | Boolean | default:false | `is_deleted` | `BOOLEAN NOT NULL DEFAULT false` | |
| `createdAt` | Date | auto | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |
| `updatedAt` | Date | auto | `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |

**Indexes:**
- `INDEX ON job_descriptions (user_id, is_deleted, created_at DESC)`

---

### 3.6 JobMatch

| Mongoose field | Type | Constraints | SQL column | SQL type | Notes |
|----------------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | auto | `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `userId` | ObjectId | ref User | `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `resumeId` | ObjectId | ref Resume | `resume_id` | `UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE` | |
| `jobDescriptionId` | ObjectId | ref JobDescription | `job_description_id` | `UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE` | |
| `status` | String | enum: pending/processing/completed/failed | `status` | `VARCHAR(20) NOT NULL DEFAULT 'pending'` | CHECK constraint |
| `result` | Mixed | — | `result` | `JSONB` | **JSONB justified**: unstructured AI output |
| `provider` | String | — | `provider` | `VARCHAR(50)` | |
| `aiModel` | String | — | `ai_model` | `VARCHAR(100)` | |
| `tokensUsed` | Number | — | `tokens_used` | `INT` | |
| `costEstimate` | Number | — | `cost_estimate` | `NUMERIC(10,6)` | |
| `error` | String | — | `error` | `TEXT` | |
| `idempotencyKey` | String | required, unique | `idempotency_key` | `VARCHAR(255) NOT NULL UNIQUE` | format: `match:${userId}:${resumeId}:${jobDescriptionId}` |
| `createdAt` | Date | auto | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |
| `updatedAt` | Date | auto | `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |

**Indexes:**
- `UNIQUE (idempotency_key)`
- `INDEX ON job_matches (user_id, resume_id, job_description_id)`
- `INDEX ON job_matches (user_id, created_at DESC)`

**MongoDB-specific behavior to replace:**
- Double `populate` → two LEFT JOINs: resumes + job_descriptions

---

### 3.7 InterviewSession

| Mongoose field | Type | Constraints | SQL column | SQL type | Notes |
|----------------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | auto | `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `userId` | ObjectId | ref User, index | `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `resumeId` | ObjectId | ref Resume, optional | `resume_id` | `UUID REFERENCES resumes(id) ON DELETE SET NULL` | nullable |
| `jobDescriptionId` | ObjectId | ref JobDescription, optional | `job_description_id` | `UUID REFERENCES job_descriptions(id) ON DELETE SET NULL` | nullable |
| `title` | String | max:200, required | `title` | `VARCHAR(200) NOT NULL` | |
| `questions` | Subdoc array | complex nested | `questions` | `JSONB NOT NULL DEFAULT '[]'` | **JSONB justified**: see below |
| `status` | String | enum: draft/active/completed | `status` | `VARCHAR(20) NOT NULL DEFAULT 'draft'` | CHECK constraint |
| `provider` | String | — | `provider` | `VARCHAR(50)` | |
| `aiModel` | String | — | `ai_model` | `VARCHAR(100)` | |
| `createdAt` | Date | auto | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |
| `updatedAt` | Date | auto | `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |

**JSONB justification for `questions`:** The questions array is a complex nested structure with 7+ fields per question including per-question `userAnswer` and `aiFeedback`. It is always fetched and written as a whole session unit. Normalizing to a separate `interview_questions` table would require complex transactional multi-row updates for every answer submission. JSONB with the whole array is appropriate for this access pattern.

**`questions` array element shape (for documentation):**
```json
{
  "id": "uuid",
  "type": "technical|behavioral|project|situational",
  "question": "string",
  "guidance": "string",
  "followUps": ["string"],
  "sampleAnswer": "string",
  "userAnswer": "string (max 5000 chars)",
  "aiFeedback": "string"
}
```

**Indexes:**
- `INDEX ON interview_sessions (user_id, created_at DESC)`

**MongoDB-specific behavior to replace:**
- `session.questions.find((q) => q.id === questionId)` → fetch row, find in JSONB array in application layer
- `session.save()` → `UPDATE interview_sessions SET questions = $1, updated_at = NOW() WHERE id = $2`
- `select('-questions.userAnswer -questions.aiFeedback')` → application layer: strip fields from JSONB before returning list responses

---

### 3.8 Roadmap

| Mongoose field | Type | Constraints | SQL column | SQL type | Notes |
|----------------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | auto | `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `userId` | ObjectId | ref User, index | `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `targetRole` | String | max:200, required | `target_role` | `VARCHAR(200) NOT NULL` | |
| `resumeId` | ObjectId | ref Resume, optional | `resume_id` | `UUID REFERENCES resumes(id) ON DELETE SET NULL` | nullable |
| `jobDescriptionId` | ObjectId | ref JobDescription, optional | `job_description_id` | `UUID REFERENCES job_descriptions(id) ON DELETE SET NULL` | nullable |
| `status` | String | enum: completed/failed/processing | `status` | `VARCHAR(20) NOT NULL DEFAULT 'processing'` | CHECK constraint |
| `provider` | String | — | `provider` | `VARCHAR(50)` | |
| `summary` | String | max:1000 | `summary` | `VARCHAR(1000)` | |
| `skillGaps` | [String] | — | `skill_gaps` | `JSONB NOT NULL DEFAULT '[]'` | string array, JSONB appropriate |
| `milestones` | Subdoc array | `_id:false` | `milestones` | `JSONB NOT NULL DEFAULT '[]'` | **JSONB justified**: see below |
| `createdAt` | Date | auto | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |
| `updatedAt` | Date | auto | `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |

**JSONB justification for `milestones`:** Milestones are always read and written as a full array per roadmap. The `updateMilestone` endpoint fetches the full roadmap, updates one item in the array, and saves the whole document — this maps directly to JSONB. Normalizing to a `roadmap_milestones` table would add joins on every roadmap read without benefit.

**`milestones` array element shape:**
```json
{
  "id": "uuid",
  "title": "string (max 200)",
  "description": "string (max 500)",
  "priority": "high|medium|low",
  "estimatedWeeks": 2,
  "resources": ["string"],
  "completed": false
}
```

**Indexes:**
- `INDEX ON roadmaps (user_id, created_at DESC)`

**MongoDB-specific behavior to replace:**
- `Roadmap.findByIdAndUpdate(id, { status, summary, skillGaps, milestones })` → standard `UPDATE`
- `milestone = roadmap.milestones.find(m => m.id === milestoneId)` → application layer JSONB manipulation

---

### 3.9 Application

| Mongoose field | Type | Constraints | SQL column | SQL type | Notes |
|----------------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | auto | `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `userId` | ObjectId | ref User, index | `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `company` | String | max:200, required | `company` | `VARCHAR(200) NOT NULL` | |
| `role` | String | max:200, required | `role` | `VARCHAR(200) NOT NULL` | `role` is a reserved word in some contexts — keep as-is, Prisma handles it |
| `location` | String | max:200 | `location` | `VARCHAR(200)` | |
| `remote` | Boolean | — | `remote` | `BOOLEAN` | |
| `salaryMin` | Number | — | `salary_min` | `NUMERIC(12,2)` | |
| `salaryMax` | Number | — | `salary_max` | `NUMERIC(12,2)` | |
| `currency` | String | max:10 | `currency` | `VARCHAR(10)` | |
| `jobDescriptionId` | ObjectId | ref JobDescription, optional | `job_description_id` | `UUID REFERENCES job_descriptions(id) ON DELETE SET NULL` | nullable |
| `resumeId` | ObjectId | ref Resume, optional | `resume_id` | `UUID REFERENCES resumes(id) ON DELETE SET NULL` | nullable |
| `status` | String | APPLICATION_STATUS enum | `status` | `VARCHAR(30) NOT NULL DEFAULT 'wishlist'` | CHECK constraint, 9 values |
| `appliedAt` | Date | — | `applied_at` | `TIMESTAMPTZ` | |
| `deadline` | Date | — | `deadline` | `TIMESTAMPTZ` | |
| `nextActionDate` | Date | — | `next_action_date` | `TIMESTAMPTZ` | |
| `nextAction` | String | max:500 | `next_action` | `VARCHAR(500)` | |
| `notes` | String | max:5000 | `notes` | `TEXT` | |
| `interviewDates` | [Date] | — | `interview_dates` | `JSONB NOT NULL DEFAULT '[]'` | array of ISO timestamps, JSONB appropriate |
| `source` | String | max:200 | `source` | `VARCHAR(200)` | |
| `url` | String | max:2048 | `url` | `VARCHAR(2048)` | |
| `contactName` | String | max:200 | `contact_name` | `VARCHAR(200)` | |
| `contactEmail` | String | max:255 | `contact_email` | `VARCHAR(255)` | |
| `isDeleted` | Boolean | default:false | `is_deleted` | `BOOLEAN NOT NULL DEFAULT false` | |
| `createdAt` | Date | auto | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |
| `updatedAt` | Date | auto | `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |

**Indexes:**
- `INDEX ON applications (user_id, is_deleted, status)` — for status-filtered list queries
- `INDEX ON applications (user_id, is_deleted, created_at DESC)` — for default sorted list

**MongoDB-specific behavior to replace:**
- `$in statuses` → `WHERE status = ANY($1::varchar[])` or `WHERE status IN (...)`
- `$regex` + `$options:'i'` on company/role → `ILIKE '%query%'`
- `$or [company, role]` → `WHERE (company ILIKE $1 OR role ILIKE $1)`
- **Aggregation pipeline** (getApplicationStats): `$group { _id: '$status', count: { $sum:1 } }` → `SELECT status, COUNT(*) FROM applications WHERE user_id = $1 AND is_deleted = false GROUP BY status`

---

## Phase 4 — Normalized SQL Schema

### Table creation order (dependency graph)

```
users
  └── refresh_tokens
  └── resumes
        └── resume_analyses
  └── job_descriptions
        └── job_matches (→ resumes, job_descriptions)
  └── interview_sessions (→ resumes?, job_descriptions?)
  └── roadmaps (→ resumes?, job_descriptions?)
  └── applications (→ job_descriptions?, resumes?)
```

### Complete DDL

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────
CREATE TABLE users (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                       VARCHAR(255) NOT NULL UNIQUE,
  password_hash               VARCHAR(255) NOT NULL,
  first_name                  VARCHAR(100),
  last_name                   VARCHAR(100),
  role                        VARCHAR(20)  NOT NULL DEFAULT 'user'
                                CHECK (role IN ('user', 'admin')),
  plan                        VARCHAR(20)  NOT NULL DEFAULT 'free'
                                CHECK (plan IN ('free', 'pro', 'enterprise')),
  email_verified              BOOLEAN      NOT NULL DEFAULT false,
  email_verification_token    VARCHAR(255),
  email_verification_expires  TIMESTAMPTZ,
  password_reset_token        VARCHAR(255),
  password_reset_expires      TIMESTAMPTZ,
  avatar_url                  VARCHAR(2048),
  is_deleted                  BOOLEAN      NOT NULL DEFAULT false,
  deleted_at                  TIMESTAMPTZ,
  usage_resume_uploads        INT          NOT NULL DEFAULT 0,
  usage_ai_analyses           INT          NOT NULL DEFAULT 0,
  usage_job_matches           INT          NOT NULL DEFAULT 0,
  usage_applications          INT          NOT NULL DEFAULT 0,
  usage_last_reset            TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_is_deleted    ON users (is_deleted);
CREATE INDEX idx_users_created_at    ON users (created_at DESC);
CREATE INDEX idx_users_email_active  ON users (email) WHERE is_deleted = false;

-- ─────────────────────────────────────────────────
-- refresh_tokens
-- ─────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(120) NOT NULL UNIQUE,
  family      UUID         NOT NULL,
  used        BOOLEAN      NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ  NOT NULL,
  user_agent  VARCHAR(500),
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id   ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_family    ON refresh_tokens (family);
CREATE INDEX idx_refresh_tokens_expires   ON refresh_tokens (expires_at);
-- NOTE: No TTL. Cleanup: DELETE FROM refresh_tokens WHERE expires_at < NOW();
-- Run at application startup and periodically (pg_cron or application job).

-- ─────────────────────────────────────────────────
-- resumes
-- ─────────────────────────────────────────────────
CREATE TABLE resumes (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename        VARCHAR(255),
  original_name   VARCHAR(255),
  mime_type       VARCHAR(100),
  size_bytes      INT,
  storage_key     VARCHAR(512) NOT NULL,  -- NEVER returned in API responses
  extracted_text  TEXT         NOT NULL DEFAULT '',
  page_count      INT,
  word_count      INT,
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  is_deleted      BOOLEAN      NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  label           VARCHAR(200),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resumes_user_deleted_created
  ON resumes (user_id, is_deleted, created_at DESC);

-- ─────────────────────────────────────────────────
-- resume_analyses
-- ─────────────────────────────────────────────────
CREATE TABLE resume_analyses (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id        UUID          NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  status           VARCHAR(20)   NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  provider         VARCHAR(50)   NOT NULL DEFAULT 'demo',
  ai_model         VARCHAR(100)  NOT NULL DEFAULT 'demo',
  tokens_used      INT,
  cost_estimate    NUMERIC(10,6),
  processing_ms    INT,
  result           JSONB,        -- unstructured AI output
  error            TEXT,
  idempotency_key  VARCHAR(255)  NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resume_analyses_user_resume
  ON resume_analyses (user_id, resume_id);
CREATE INDEX idx_resume_analyses_user_created
  ON resume_analyses (user_id, created_at DESC);
CREATE INDEX idx_resume_analyses_status
  ON resume_analyses (status);

-- ─────────────────────────────────────────────────
-- job_descriptions
-- ─────────────────────────────────────────────────
CREATE TABLE job_descriptions (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200)  NOT NULL,
  company     VARCHAR(200),
  description TEXT          NOT NULL,
  location    VARCHAR(200),
  remote      BOOLEAN,
  salary_min  NUMERIC(12,2),
  salary_max  NUMERIC(12,2),
  currency    VARCHAR(10),
  url         VARCHAR(2048),
  notes       TEXT,
  is_deleted  BOOLEAN       NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_descriptions_user_deleted_created
  ON job_descriptions (user_id, is_deleted, created_at DESC);

-- ─────────────────────────────────────────────────
-- job_matches
-- ─────────────────────────────────────────────────
CREATE TABLE job_matches (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id           UUID          NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_description_id  UUID          NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  status              VARCHAR(20)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result              JSONB,        -- unstructured AI output
  provider            VARCHAR(50),
  ai_model            VARCHAR(100),
  tokens_used         INT,
  cost_estimate       NUMERIC(10,6),
  error               TEXT,
  idempotency_key     VARCHAR(255)  NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_matches_user_resume_jd
  ON job_matches (user_id, resume_id, job_description_id);
CREATE INDEX idx_job_matches_user_created
  ON job_matches (user_id, created_at DESC);

-- ─────────────────────────────────────────────────
-- interview_sessions
-- ─────────────────────────────────────────────────
CREATE TABLE interview_sessions (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id           UUID          REFERENCES resumes(id) ON DELETE SET NULL,
  job_description_id  UUID          REFERENCES job_descriptions(id) ON DELETE SET NULL,
  title               VARCHAR(200)  NOT NULL,
  questions           JSONB         NOT NULL DEFAULT '[]',
  status              VARCHAR(20)   NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'completed')),
  provider            VARCHAR(50),
  ai_model            VARCHAR(100),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interview_sessions_user_created
  ON interview_sessions (user_id, created_at DESC);

-- ─────────────────────────────────────────────────
-- roadmaps
-- ─────────────────────────────────────────────────
CREATE TABLE roadmaps (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role         VARCHAR(200)  NOT NULL,
  resume_id           UUID          REFERENCES resumes(id) ON DELETE SET NULL,
  job_description_id  UUID          REFERENCES job_descriptions(id) ON DELETE SET NULL,
  status              VARCHAR(20)   NOT NULL DEFAULT 'processing'
                        CHECK (status IN ('completed', 'failed', 'processing')),
  provider            VARCHAR(50),
  summary             VARCHAR(1000),
  skill_gaps          JSONB         NOT NULL DEFAULT '[]',
  milestones          JSONB         NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roadmaps_user_created
  ON roadmaps (user_id, created_at DESC);

-- ─────────────────────────────────────────────────
-- applications
-- ─────────────────────────────────────────────────
CREATE TABLE applications (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company             VARCHAR(200)  NOT NULL,
  role                VARCHAR(200)  NOT NULL,
  location            VARCHAR(200),
  remote              BOOLEAN,
  salary_min          NUMERIC(12,2),
  salary_max          NUMERIC(12,2),
  currency            VARCHAR(10),
  job_description_id  UUID          REFERENCES job_descriptions(id) ON DELETE SET NULL,
  resume_id           UUID          REFERENCES resumes(id) ON DELETE SET NULL,
  status              VARCHAR(30)   NOT NULL DEFAULT 'wishlist'
                        CHECK (status IN (
                          'wishlist','applied','phone_screen','interview',
                          'technical','offer','rejected','withdrawn','accepted'
                        )),
  applied_at          TIMESTAMPTZ,
  deadline            TIMESTAMPTZ,
  next_action_date    TIMESTAMPTZ,
  next_action         VARCHAR(500),
  notes               TEXT,
  interview_dates     JSONB         NOT NULL DEFAULT '[]',
  source              VARCHAR(200),
  url                 VARCHAR(2048),
  contact_name        VARCHAR(200),
  contact_email       VARCHAR(255),
  is_deleted          BOOLEAN       NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applications_user_deleted_status
  ON applications (user_id, is_deleted, status);
CREATE INDEX idx_applications_user_deleted_created
  ON applications (user_id, is_deleted, created_at DESC);
```

---

## Phase 5 — ORM Recommendation

**Recommendation: Prisma 5+**

| Criterion | Prisma 5 | Drizzle ORM |
|-----------|---------|------------|
| TypeScript-first schema → types | ✅ Auto-generated, zero-config | ✅ Types from schema |
| Migration tooling | ✅ `prisma migrate dev` / `deploy` | ✅ `drizzle-kit` but less mature |
| Replaces Mongoose model types | ✅ Prisma Client replaces all `IUser`, `IResume`, etc. | ✅ |
| JSONB support | ✅ `Json` type, with cast helpers | ✅ `jsonb` column type |
| Aggregate / raw SQL | ✅ `$queryRaw` for complex aggregates | ✅ Better raw SQL ergonomics |
| Admin GUI (replaces Compass) | ✅ `prisma studio` | ⚠️ None built-in |
| Soft-delete pattern | ✅ Middleware / `where` filter | ✅ Manual |
| TTL cleanup | ✅ `$executeRaw` or Prisma middleware | ✅ |
| Versioned migrations | ✅ SQL migration files under version control | ✅ |
| Community + ecosystem | ✅ Largest TypeScript ORM community | ✅ Growing quickly |

**Deciding factors:**
- Prisma's generated client removes ALL Mongoose model types (`IUser`, `IResume`, etc.) cleanly in one step.
- `prisma migrate dev` produces SQL migration files that are versioned, auditable, and not destructively auto-applied — satisfies the "no destructive auto-sync" requirement.
- `prisma studio` provides a replacement for MongoDB Compass during development.
- The admin aggregation (`$group`, `$sum`) will use `prisma.$queryRaw` with tagged template literals — safe against SQL injection.
- The only Drizzle advantage (raw SQL ergonomics) does not outweigh Prisma's migration tooling for a migration of this scope.

---

## Phases 6–20 — Implementation Roadmap

> **None of these phases begin until this document is approved.**

### Phase 6 — Install Prisma, configure PostgreSQL connection

- Install: `npm install prisma @prisma/client` in `server/`
- Add `DATABASE_URL` to `.env.example` and `.env` (never commit)
- Create `server/prisma/schema.prisma` from the DDL above
- Remove `MONGODB_URI` from config only after full cutover (keep both during transition)
- Run `prisma migrate dev --name init` to generate SQL migration file

### Phase 7 — Define Prisma schema

- Translate Phase 4 DDL to `schema.prisma` with all models, relations, and indexes
- Configure `@@map` to match snake_case table names
- Add `@default(dbgenerated("gen_random_uuid()"))` for UUID PKs
- Validate with `prisma validate`

### Phase 8 — Preserve API contracts

- Map all ObjectId `_id` fields in responses to string `id` — Prisma UUIDs serialize as strings; no breaking change
- Keep all existing request/response shapes identical — audit Phase 2 inventory against route files
- Pagination shape (`{ data, pagination: { page, limit, total, totalPages } }`) must be preserved exactly
- The `storageKey` exclusion from responses must be enforced via explicit column selection (not `select:false`)

### Phase 9 — Auth migration

- Replace `RefreshToken` Mongoose model with Prisma `RefreshToken` client
- Implement startup cleanup for expired refresh tokens (replacing MongoDB TTL):
  ```ts
  await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  ```
- Replace `User.findOne({ isDeleted: false })` with `prisma.user.findFirst({ where: { isDeleted: false } })`
- Token family invalidation: `prisma.refreshToken.deleteMany({ where: { family } })`

### Phase 10 — IDOR prevention

- Every query that accesses user-owned data must include `userId` in the `where` clause
- Pattern: `prisma.resume.findFirst({ where: { id, userId, isDeleted: false } })`
- Audit every service and controller against the Phase 2 inventory — every MongoDB IDOR-safe query must have an exact SQL equivalent
- Never trust user-supplied `userId`, `resumeId`, or `jobDescriptionId` without ownership verification

### Phase 11 — File storage separation

- `storage_key` column must never appear in Prisma `select` for API response queries
- Create a `resumePublicSelect` constant:
  ```ts
  const resumePublicSelect = { id: true, originalName: true, label: true, ... /* no storageKey */ };
  ```
- Use this in all `find*` queries that return resume data to clients

### Phase 12 — AI data storage (JSONB)

- `result` columns (ResumeAnalysis, JobMatch) use Prisma `Json` type
- Read with `analysis.result as AnalysisResult` (cast in application layer)
- Idempotency keys stay exactly as-is: `analysis:${userId}:${resumeId}`, `match:${userId}:${resumeId}:${jobDescriptionId}`
- Idempotency check: `prisma.resumeAnalysis.findFirst({ where: { idempotencyKey, status: { in: ['completed', 'processing'] } } })`

### Phase 13 — Idempotency

- Unique constraint on `idempotency_key` replaces Mongoose unique index
- On conflict (race condition): Postgres raises `P2002` (Prisma unique violation code) — catch and return existing record
- Key formats are application-defined strings — no changes required

### Phase 14 — Versioned migrations

- All schema changes go through `prisma migrate dev` during development
- `prisma migrate deploy` for production — applies only pending migrations
- Migration files stored in `server/prisma/migrations/` and committed to git
- Never run `prisma db push` in production (destructive auto-sync, violates the stated requirement)

### Phase 15 — Data migration strategy

This covers moving existing MongoDB data to PostgreSQL **without destroying existing data**.

**Approach: parallel-run with a one-time migration script**

1. Stand up PostgreSQL alongside MongoDB (both running simultaneously)
2. Run `prisma migrate deploy` on the empty PostgreSQL database
3. Execute a TypeScript migration script `scripts/migrate-mongo-to-pg.ts`:
   - Connect to both MongoDB and PostgreSQL
   - Migrate tables in dependency order: users → resumes → job_descriptions → resume_analyses → job_matches → interview_sessions → roadmaps → applications → refresh_tokens
   - For each document: transform ObjectId → UUID (generate new UUID, maintain mapping table)
   - JSONB fields: pass through as-is (Mixed/Object → JSONB)
   - Log progress and errors; re-runnable with idempotent upserts
4. Verify row counts match between MongoDB and PostgreSQL
5. Switch `DATABASE_URL` to PostgreSQL; keep `MONGODB_URI` in env but stop all writes
6. Run full test suite against PostgreSQL
7. After 48h verification window, decommission MongoDB

**ObjectId → UUID mapping:** MongoDB ObjectIds cannot be used as UUIDs directly. The migration script maintains an in-memory map `{ mongoId → uuid }` per collection, used to resolve all FK references during migration. The UUID mapping is also written to a `_migration_id_map` temporary table for auditability.

### Phase 16 — Testing

- Update Vitest test setup to use PostgreSQL test database (separate from dev DB)
- Replace `mongoose.connect()` in test setup with Prisma client pointing at `TEST_DATABASE_URL`
- Use `prisma migrate reset --force` (test DB only) between test runs
- Mock AI provider responses remain unchanged (no paid API calls in tests)
- Verify: all 47 existing unit tests pass; add integration tests for all 9 CRUD routes

### Phase 17 — Frontend compatibility

- Frontend communicates only via REST API — zero frontend code changes needed for the DB migration
- The only change that could affect the frontend: `_id` → `id` in responses
- Audit: all Mongoose documents return `_id` serialized as string. Prisma returns `id` as UUID string. If the frontend uses `.id` everywhere, no change. If it uses `._id`, update those references.
- The `id` vs `_id` impact should be audited in `client/src/` before Phase 6 begins.

### Phase 18 — Environment variables

New variables to add to `.env.example`:
```
# PostgreSQL (required after migration)
DATABASE_URL=postgresql://user:password@localhost:5432/resumeiq

# Keep MongoDB URI only during migration transition period
# MONGODB_URI=mongodb://localhost:27017/resumeiq
```

Variables to remove after full cutover:
- `MONGODB_URI`

Docker Compose: add `postgres:16-alpine` service, remove `mongo` service after cutover.

### Phase 19 — Docker & deployment

- Add `postgres:16-alpine` to `docker-compose.yml` with named volume
- Update `Dockerfile` for server: no change to Node setup; `prisma generate` runs as part of build
- Add `prisma migrate deploy` to server startup sequence (before `app.listen`)
- Health check: replace `mongoose.connection.readyState === 1` with Prisma `$queryRaw\`SELECT 1\``

### Phase 20 — Performance & security

- All sensitive columns (`password_hash`, `*_token`, `storage_key`) use explicit `select: false` equivalent (Prisma: omit from default select using helper constants)
- SQL injection: Prisma parameterizes all queries; `$queryRaw` uses tagged template literals (safe)
- The admin `/stats` aggregate replaces MongoDB `$group` with:
  ```sql
  SELECT status, COUNT(*) as count
  FROM resume_analyses
  WHERE status = 'completed'
  GROUP BY status
  ```
- Add PG connection pool limits: `{ connection_limit: 10 }` in `DATABASE_URL` or Prisma datasource config
- Enable `pgcrypto` extension in first migration
- Ensure all DB connections use SSL in production (`sslmode=require` in `DATABASE_URL`)

---

## API Contract Preservation Checklist

These API contracts must be identical before and after migration:

| Route | Method | MongoDB pattern | SQL replacement | Breaking risk |
|-------|--------|----------------|----------------|--------------|
| `/auth/register` | POST | `User.create()` | `prisma.user.create()` | None |
| `/auth/login` | POST | `User.findOne({ email, isDeleted:false }).select('+password')` | `prisma.user.findFirst({ where: {email, isDeleted:false}, select: { ...allFields, passwordHash: true } })` | None |
| `/auth/refresh` | POST | `RefreshToken.findOne({ token })` | `prisma.refreshToken.findUnique({ where: { token } })` | None |
| `/auth/me` | GET | `User.findOne({ _id, isDeleted:false })` | `prisma.user.findFirst({ where: { id, isDeleted:false } })` | `_id` vs `id` |
| `/resumes` | GET | `Resume.find().sort().skip().limit().select(...)` | `prisma.resume.findMany({ where, orderBy, skip, take, select })` | None |
| `/resumes/:id/download` | GET | storage_key lookup | Same — `storage_key` not returned | None |
| `/resumes/:id/analyses` | GET | `ResumeAnalysis.find().populate('resumeId', ...)` | Prisma with `include: { resume: { select: ... } }` | None |
| `/jobs/:jobId/match` | POST | `JobMatch.findOne({ idempotencyKey, status:{ $in:... } })` | `prisma.jobMatch.findFirst({ where: { idempotencyKey, status: { in: [...] } } })` | None |
| `/applications/stats` | GET | MongoDB `aggregate` | Prisma `$queryRaw` GROUP BY | None |
| `/admin/stats` | GET | MongoDB `aggregate` + `countDocuments` | `$queryRaw` + `prisma.*.count()` | None |

**`_id` vs `id` impact:** Mongoose serializes ObjectId as `_id` string. Prisma returns `id` UUID string. All frontend API calls must use `.id` not `._id`. Audit required in Phase 17.

---

## Data Migration Strategy

### Pre-conditions (must all be true before running)
- [ ] PostgreSQL 16 instance running
- [ ] `prisma migrate deploy` has run successfully (schema created, zero data)
- [ ] Both `MONGODB_URI` and `DATABASE_URL` set in environment
- [ ] MongoDB still running and read-accessible
- [ ] Full MongoDB backup taken and verified

### Migration script outline (`scripts/migrate-mongo-to-pg.ts`)

```
1. Connect: Mongoose (read) + Prisma (write)
2. Migrate users (generate UUID for each _id, store mapping)
3. Migrate resumes (resolve userId from mapping)
4. Migrate job_descriptions (resolve userId)
5. Migrate resume_analyses (resolve userId, resumeId)
6. Migrate job_matches (resolve userId, resumeId, jobDescriptionId)
7. Migrate interview_sessions (resolve userId, resumeId?, jobDescriptionId?)
8. Migrate roadmaps (resolve userId, resumeId?, jobDescriptionId?)
9. Migrate applications (resolve userId, jobDescriptionId?, resumeId?)
10. Migrate refresh_tokens (resolve userId — or skip; force re-login after cutover)
11. Verify row counts per table
12. Log summary report
```

### Rollback plan
- MongoDB remains untouched throughout
- If verification fails: point `DATABASE_URL` back to MongoDB connection (flip env var)
- PostgreSQL data can be wiped and migration re-run

---

## Risk Register

| Risk | Severity | Mitigation |
|------|---------|-----------|
| `_id` → `id` breaking frontend | Medium | Audit `client/src/` for `._id` usage before starting |
| TTL replacement for RefreshToken | Low | Startup cleanup + index on `expires_at` |
| JSONB `questions` array manipulation slower | Low | Access pattern is always full-session fetch+save; JSONB is appropriate |
| Prisma `$queryRaw` SQL injection | Medium | Always use tagged template literals, never string concatenation |
| Admin aggregation behavioral change | Low | Verify `getApplicationStats` and `/admin/stats` output exactly matches current API |
| ObjectId→UUID FK resolution errors | Medium | Migration script logs every error; re-runnable with upserts |
| `storageKey` accidentally exposed | High | Explicit `select` constants reviewed in Phase 11; no `*` selects |
| Demo user seed with SQL | Low | Replace `User.create({...})` with `prisma.user.upsert({ where: { email: 'demo@resumeiq.local' }, ... })` |

---

*Audit completed. No code, schema, or data has been changed. This plan covers all 20 requested phases. Approval required before Phase 6 begins.*
