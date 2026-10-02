# Phase 3 — Resume Domain Migration Plan

## Current Mongoose Schema (`server/src/models/Resume.ts`)

| Field | Mongoose type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | auto | — | MongoDB document ID |
| `userId` | ObjectId (ref User) | yes | — | Owner |
| `filename` | String | yes | — | Internal storage name (= storageKey) |
| `originalName` | String | yes | — | Browser filename |
| `mimeType` | String | yes | — | `application/pdf` or `.docx` |
| `sizeBytes` | Number | yes | — | File size in bytes |
| `storageKey` | String | yes | — | **Never in API response** (toJSON transform deletes it) |
| `extractedText` | String | no | `''` | Max 50 000 chars (sanitised) |
| `pageCount` | Number | no | — | |
| `wordCount` | Number | no | — | |
| `isActive` | Boolean | no | `true` | |
| `isDeleted` | Boolean | no | `false` | Soft-delete flag |
| `deletedAt` | Date | no | — | |
| `label` | String | no | — | User-supplied name (max 200) |
| `createdAt` | Date | auto | — | Mongoose timestamps |
| `updatedAt` | Date | auto | — | |

Index: `{ userId: 1, isDeleted: 1, createdAt: -1 }`

## Prisma Schema Differences (before fix)

The Phase 1 schema had `filename`, `originalName`, `mimeType`, `sizeBytes` as **nullable** (`String?` / `Int?`).
These match Mongoose's `required: true` so they must be `NOT NULL` in PostgreSQL.

## Schema Fix Applied in Phase 3

```diff
- filename      String?   @db.VarChar(255)
+ filename      String    @db.VarChar(255)

- originalName  String?   @db.VarChar(255) @map("original_name")
+ originalName  String    @db.VarChar(255) @map("original_name")

- mimeType      String?   @db.VarChar(100) @map("mime_type")
+ mimeType      String    @db.VarChar(100) @map("mime_type")

- sizeBytes     Int?      @map("size_bytes")
+ sizeBytes     Int       @map("size_bytes")
```

Migration: `20261001_phase3_resume_not_null`

## Cross-DB Boundary: Resume ↔ ResumeAnalysis

After Phase 3, **Resume is PostgreSQL** but **ResumeAnalysis stays MongoDB**.

This creates a cross-DB join problem:
- `analysisService.createAnalysis` looks up Resume for IDOR verification and `extractedText`
- `ResumeAnalysis.resumeId` was `ObjectId` but is now a PostgreSQL UUID

### Minimal Changes Required to MongoDB models

| Model | Field | Before | After | Reason |
|---|---|---|---|---|
| `ResumeAnalysis` | `userId` | `ObjectId ref User` | `String` | User IDs are now PostgreSQL UUIDs since Phase 2 |
| `ResumeAnalysis` | `resumeId` | `ObjectId ref Resume` | `String` | Resume IDs are now PostgreSQL UUIDs |

`populate('resumeId')` is removed from `getUserAnalyses` — cross-DB populate is impossible.
Frontend already handles both `a.resumeId?._id === id` and `a.resumeId === id`, so the string form works.

## IDOR Protection Strategy

Every repository function includes `userId` in the WHERE clause alongside the resource `id`.
`storageKey` is never included in the public select constants — only `findResumeByIdForStorage`
returns it, and that function is only called internally (download, delete).

```typescript
// Public select — storageKey excluded
const RESUME_PUBLIC_SELECT = {
  id: true, userId: true, filename: true, originalName: true, mimeType: true,
  sizeBytes: true, extractedText: true, pageCount: true, wordCount: true,
  isActive: true, isDeleted: true, label: true, createdAt: true, updatedAt: true,
} as const;
```

## Upload Security (preserved from Mongoose layer)

| Check | Location | Notes |
|---|---|---|
| Max file size (10 MB) | multer `limits.fileSize` + controller | Double-checked |
| MIME type allow-list | multer `fileFilter` + controller | PDF + DOCX only |
| Magic bytes validation | `validateFileMagicBytes` | `%PDF` / `PK` header |
| Path traversal | `multer.memoryStorage()` | No disk writes |
| Storage key never in response | `RESUME_PUBLIC_SELECT` | Constant |

## API Contract Compatibility

The only breaking change from MongoDB → PostgreSQL is the ID field:
- MongoDB returned `_id` (ObjectId string, 24 hex chars)
- PostgreSQL returns `id` (UUID, 36 chars)

Frontend (`ResumesPage.tsx`, `ResumeDetailPage.tsx`) updated: `resume._id` → `resume.id`.

## Relationship Mapping

```
PostgreSQL: resumes.id (UUID)
    ↓ referenced by (string FK in MongoDB after Phase 3):
MongoDB:    resumeanalyses.resumeId (String UUID)

PostgreSQL: users.id (UUID)
    ↓ referenced by:
MongoDB:    resumeanalyses.userId (String UUID — since Phase 2)
```

## Migration Risks

| Risk | Mitigation |
|---|---|
| storageKey in API response | `RESUME_PUBLIC_SELECT` constant; never includes it |
| IDOR — wrong user sees resume | All queries: `WHERE id = ? AND user_id = ? AND is_deleted = false` |
| Analysis cross-DB populate fails | Remove `.populate()`, change `userId`/`resumeId` to String in Mongoose |
| `sizeBytes` overflow (>2.1 GB) | Max upload is 10 MB — well within `Int` range |
| Concurrent uploads double-count | Usage counter uses Prisma atomic increment (Phase 2) |

## Files Changed in Phase 3

| File | Change |
|---|---|
| `server/prisma/schema.prisma` | Make 4 Resume fields NOT NULL |
| `server/prisma/migrations/*/migration.sql` | ALTER COLUMN SET NOT NULL |
| `server/src/repositories/resumeRepository.ts` | **NEW** — Resume PostgreSQL CRUD |
| `server/src/controllers/resumeController.ts` | Replace Mongoose with repository |
| `server/src/services/analysisService.ts` | Resume lookup from PostgreSQL |
| `server/src/models/ResumeAnalysis.ts` | userId/resumeId → String |
| `server/src/routes/admin.ts` | Resume count from PostgreSQL |
| `client/src/pages/ResumesPage.tsx` | `_id` → `id` |
| `client/src/pages/ResumeDetailPage.tsx` | `_id` → `id` |
| `docs/DATABASE_MIGRATION_STATUS.md` | Resume phase updated |
