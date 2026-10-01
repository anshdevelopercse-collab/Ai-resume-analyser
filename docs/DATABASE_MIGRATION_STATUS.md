# Database Migration Status

## Current State

The application runs **two databases in parallel** during the incremental migration
from MongoDB/Mongoose to PostgreSQL/Prisma.

---

## PostgreSQL IS AUTHORITATIVE FOR

| Model | Table | Notes |
|---|---|---|
| **User** | `users` | All user CRUD, role, plan, usage counters, soft-delete |
| **RefreshToken** | `refresh_tokens` | Token rotation, family wipe on replay, atomic claim |
| **Resume** | `resumes` | File uploads, storage keys, extracted text, soft-delete |

All authentication flows and resume CRUD read and write **only** PostgreSQL.

---

## MongoDB IS STILL AUTHORITATIVE FOR

| Mongoose Model | Collection | Domain |
|---|---|---|
| `ResumeAnalysis` | `resumeanalyses` | AI analysis results, status, tokens used |
| `JobDescription` | `jobdescriptions` | Job description text |
| `JobMatch` | `jobmatches` | Resume↔Job AI match results |
| `InterviewSession` | `interviewsessions` | Interview questions and session state |
| `Roadmap` | `roadmaps` | Career roadmap milestones and skill gaps |
| `Application` | `applications` | Job application tracker |

**Cross-DB note**: `ResumeAnalysis.userId` and `ResumeAnalysis.resumeId` were changed from
`ObjectId` to `String` in Phase 3 to store PostgreSQL UUIDs. Cross-DB populate removed.

These models will be migrated domain-by-domain in Phases 6–8.
MongoDB must remain running until all domains are migrated.

---

## Architecture

```
HTTP Request
     │
     ▼
Express + Middleware (auth.ts)
     │ authenticates via PostgreSQL (Prisma)
     │
     ├──▶ Auth routes      → PostgreSQL only  ✅  Phase 2 complete
     │
     ├──▶ Resume routes    → PostgreSQL (Prisma)  ✅  Phase 3 complete
     ├──▶ Job routes       → MongoDB (Mongoose)   Phase 6 pending
     ├──▶ Analysis routes  → MongoDB (Mongoose) + PostgreSQL Resume   Phase 4 pending
     ├──▶ Interview routes → MongoDB (Mongoose)   Phase 6 pending
     ├──▶ Roadmap routes   → MongoDB (Mongoose)   Phase 6 pending
     ├──▶ Application rts  → MongoDB (Mongoose)   Phase 6 pending
     └──▶ Admin routes     → PostgreSQL (User count/list/setRole)
                          + MongoDB (Resume, Analysis, Application counts)
```

---

## Phase 2 Fixes Applied

| Fix | Description |
|---|---|
| Race condition in refresh rotation | `claimTokenAtomic()` uses `UPDATE WHERE used=false` (Prisma `updateMany`) — exactly one concurrent winner |
| Account deletion missing token revocation | `deleteAccount` now calls `revokeAllUserTokens` before responding |
| Admin `users` route Mongoose dependency | Replaced `User.find` / `User.findByIdAndUpdate` with `listUsers` / `setUserRole` repository calls |
| MongoDB non-fatal in development | `connectDatabase()` failure is a warn (not crash) in non-production so PostgreSQL-only testing works |

---

## Testing Status (Phase 2)

- **84/84 automated tests pass** (47 pre-existing + 37 new integration tests)
- Integration tests cover: registration, login, refresh rotation, concurrent refresh,
  replay detection, family wipe, password reset, email verification, user isolation,
  role security, usage counter concurrency, DB integrity, atomic claim

---

## Migration Phases

| Phase | Status | What |
|---|---|---|
| 1 — Prisma foundation | ✅ Done (commit `511566a`) | Schema, migration SQL, Docker, Dockerfile |
| 2 — User + Auth | ✅ Done (commit `4507a28` + fixes) | User, RefreshToken, all auth services |
| 3 — Resume | ✅ Done | Resume, storageKey protection, IDOR, cross-DB analysis fix |
| 4 — ResumeAnalysis | ⏳ Not started | |
| 5 — JobDescription | ⏳ Not started | |
| 6 — JobMatch | ⏳ Not started | |
| 7 — InterviewSession | ⏳ Not started | |
| 8 — Roadmap | ⏳ Not started | |
| 9 — Application | ⏳ Not started | |
| 10 — Data migration script | ⏳ Not started | MongoDB → PostgreSQL with ObjectId→UUID mapping |
| 11 — MongoDB removal | ⏳ Not started | Only after all domains verified |
