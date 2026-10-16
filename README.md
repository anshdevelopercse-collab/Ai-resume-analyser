# ResumeIQ — AI-Powered Resume Analyser

A full-stack SaaS platform that helps job seekers land more interviews. Upload a resume, get an instant AI-powered score, match it against real job descriptions, generate tailored interview questions, build a personalized skill roadmap, and track every application — all in one place.

---

## Screenshots

| Dashboard | Resume Analysis |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Resumes](docs/screenshots/resumes.png) |

| Job Matching | Skill Roadmap |
|---|---|
| ![Jobs](docs/screenshots/jobs.png) | ![Roadmap](docs/screenshots/roadmap.png) |

---

## Features

| Feature | What it does |
|---|---|
| **Resume Analysis** | AI scores your resume across ATS compatibility, formatting, content quality, and impact — with actionable improvement suggestions |
| **Job Matching** | Paste any job description and instantly see a match score, skill gap breakdown, and tailored recommendations |
| **Interview Prep** | Generates role-specific interview questions with sample answers and coaching tips |
| **Skill Roadmap** | Creates a week-by-week learning plan to close the gap between your current skills and your target role |
| **Application Tracker** | Track every job application through its full lifecycle — Applied → Phone Screen → Technical → Offer |
| **Multi-AI Support** | Works with Anthropic Claude, OpenAI GPT, or Google Gemini — use whichever key you have |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 6, Tailwind CSS, Radix UI, Framer Motion, TanStack Query v5, Zustand, Recharts |
| **Backend** | Node.js, Express 4, TypeScript, Prisma 5 ORM |
| **Database** | PostgreSQL 16 |
| **AI Providers** | Anthropic Claude · OpenAI · Google Gemini (auto-detected from env) |
| **Auth** | JWT access tokens (15 min) + httpOnly refresh tokens (7 days) with family-based rotation |
| **File Processing** | PDF parsing, DOCX extraction via Mammoth, Sharp for image handling |
| **Validation** | Zod schemas shared between client and server via `@resumeiq/shared` package |
| **Email** | Nodemailer — console logging in dev, SMTP in production |
| **Logging** | Winston structured logging |
| **Testing** | Vitest + Testing Library (client), Supertest (server) |

---

## Project Structure

```
.
├── client/                   # React + Vite frontend
│   └── src/
│       ├── pages/            # Route-level page components
│       ├── components/       # Shared UI components
│       ├── hooks/            # TanStack Query hooks (data fetching)
│       ├── store/            # Zustand auth store
│       └── lib/              # Axios API client, utilities
├── server/                   # Express + Prisma backend
│   └── src/
│       ├── controllers/      # Route handlers (thin layer)
│       ├── repositories/     # All database access (Prisma)
│       ├── middleware/        # Auth, validation, error handling
│       ├── routes/           # Express routers
│       ├── integrations/     # AI providers, email, file storage
│       └── config/           # Environment config
├── shared/                   # Zod schemas + TypeScript types (shared package)
└── server/prisma/
    ├── schema.prisma         # Database schema
    └── migrations/           # Applied SQL migrations
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- At least one AI API key (Anthropic, OpenAI, or Gemini)

### 1. Clone and install

```bash
git clone https://github.com/your-username/ai-resume-analyser.git
cd ai-resume-analyser
npm install
```

### 2. Set up the database

```bash
# Create a PostgreSQL database and user
psql -U postgres -c "CREATE USER resumeiq_user WITH PASSWORD 'yourpassword';"
psql -U postgres -c "CREATE DATABASE resumeiq OWNER resumeiq_user;"

# Run migrations
cd server
npx prisma migrate deploy
cd ..
```

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Database
DATABASE_URL=postgresql://resumeiq_user:yourpassword@localhost:5432/resumeiq

# JWT (generate two random 64-char strings)
JWT_ACCESS_SECRET=your_64_char_secret_here
JWT_REFRESH_SECRET=your_other_64_char_secret_here

# AI — add at least one
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GEMINI_API_KEY=...
```

### 4. Start development servers

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

### 5. (Optional) Seed demo data

```bash
cd server
DATABASE_URL="postgresql://resumeiq_user:yourpassword@localhost:5432/resumeiq" node seed-demo.mjs
```

Login with `demo@resumeiq.dev` / `Demo1234!`

---

## Environment Variables

Full reference in `.env.example`. Key variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | Min 64 chars, cryptographically random |
| `JWT_REFRESH_SECRET` | Yes | Min 64 chars, cryptographically random |
| `ANTHROPIC_API_KEY` | One of these | Enables Claude for AI features |
| `OPENAI_API_KEY` | One of these | Alternative AI provider |
| `GEMINI_API_KEY` | One of these | Alternative AI provider |
| `CLIENT_URL` | Production | Frontend domain for CORS allowlist |
| `EMAIL_PROVIDER` | No | `console` (default) or `smtp` |
| `STORAGE_PROVIDER` | No | `local` (default) or `s3` |

---

## API Reference

| Resource | Method | Path |
|---|---|---|
| **Auth** | POST | `/api/v1/auth/register` · `/login` · `/logout` · `/refresh` |
| **Resumes** | GET · POST | `/api/v1/resumes` |
| | GET · PATCH · DELETE | `/api/v1/resumes/:id` |
| | GET | `/api/v1/resumes/:id/download` |
| **Analysis** | POST | `/api/v1/resumes/:resumeId/analyses` |
| | GET | `/api/v1/resumes/analyses/all` |
| **Jobs** | GET · POST | `/api/v1/jobs` |
| | POST | `/api/v1/jobs/:jobId/match` |
| | GET | `/api/v1/jobs/matches` |
| **Roadmap** | POST | `/api/v1/roadmaps` |
| | GET | `/api/v1/roadmaps` |
| | POST | `/api/v1/roadmaps/:id/retry` |
| | PATCH | `/api/v1/roadmaps/:roadmapId/milestones/:milestoneId` |
| **Interview** | POST | `/api/v1/interviews` |
| | POST | `/api/v1/interviews/:id/answer` |
| **Applications** | GET · POST | `/api/v1/applications` |
| | PATCH · DELETE | `/api/v1/applications/:id` |
| **Admin** | GET | `/api/v1/admin/stats` · `/api/v1/admin/users` |
| **Health** | GET | `/health` · `/ready` |

---

## Security

- AI API keys are **never** sent to the frontend
- All queries are scoped to the authenticated `userId` — no IDOR possible
- JWT refresh tokens use family-based rotation: reusing a rotated token invalidates the entire family
- Zod middleware strips unknown fields on all mutating routes
- Helmet security headers, CORS allowlist, and per-route rate limiting active in all environments
- Resume text and job descriptions are treated as untrusted content — never executed as instructions

---

## Running Tests

```bash
# All tests
npm test

# Server only
npm run test:server

# Client only
npm run test:client
```

---

## Docker

```bash
cp .env.example .env
# Fill in .env values

docker compose up --build
```

- App: `http://localhost`
- API: `http://localhost:3001`

---

## License

MIT
