# ResumeIQ — AI Resume Analyser SaaS

A full-stack AI-powered resume analysis platform built with the MERN stack.
Upload a resume, get an instant AI-powered score, match it against job descriptions,
and prepare for interviews — all in one place.

## Features

- **Resume analysis** — AI scores your resume across ATS compatibility, formatting, content, and impact
- **Job matching** — paste a job description and see how well your resume matches it
- **Interview prep** — AI generates tailored interview questions with guidance and sample answers
- **Skill roadmap** — personalized learning path to close the gap between your resume and a target role
- **Application tracker** — Kanban-style board to track jobs from wishlist to offer
- **Demo mode** — works without any API key using deterministic sample data

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query v5, Zustand |
| Backend | Node.js, Express 4, TypeScript, Mongoose 8 |
| Database | MongoDB 7 |
| AI | Anthropic Claude (primary) / OpenAI (fallback) / Demo mode |
| Auth | JWT access tokens (15 min) + httpOnly refresh tokens (7 days) with rotation |
| Validation | Zod schemas shared between client and server |
| Deployment | Docker + docker-compose |

## Quick Start (local development)

### Prerequisites

- Node.js 20+
- MongoDB 7 (or Docker)
- An Anthropic API key (optional — runs in demo mode without one)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in the required values (see below)
```

Minimum required values in `.env`:

```
MONGODB_URI=mongodb://localhost:27017/resumeiq
JWT_ACCESS_SECRET=<random 64+ char string>
JWT_REFRESH_SECRET=<random 64+ char string>
```

Optional (for real AI analysis):

```
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...
```

### 3. Start development servers

```bash
npm run dev
```

This starts the server on `http://localhost:3001` and the client on `http://localhost:5173`.

### 4. Run tests

```bash
npm test
```

---

## Docker deployment

```bash
cp .env.example .env
# Fill in .env values

docker compose up --build
```

- Client: `http://localhost:80`
- API: `http://localhost:3001`

---

## Environment Variables

All variables are documented in `.env.example`. Key ones:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Yes | Min 64 chars, random |
| `JWT_REFRESH_SECRET` | Yes | Min 64 chars, random |
| `ANTHROPIC_API_KEY` | No | Enables real AI analysis via Claude |
| `OPENAI_API_KEY` | No | Fallback if Anthropic not configured |
| `CLIENT_URL` | Prod | Your frontend domain for CORS |
| `EMAIL_PROVIDER` | No | `console` (default) or `smtp` |

---

## API Endpoints

| Resource | Base path |
|---|---|
| Auth | `POST /api/v1/auth/register`, `/login`, `/logout`, `/refresh` |
| Resumes | `GET/POST /api/v1/resumes`, `GET/PATCH/DELETE /api/v1/resumes/:id` |
| Analysis | `POST /api/v1/resumes/:resumeId/analyses` |
| Jobs | `GET/POST /api/v1/jobs`, `POST /api/v1/jobs/:jobId/match` |
| Applications | `GET/POST/PUT/DELETE /api/v1/applications` |
| Interview | `POST /api/v1/interviews/generate`, `POST /api/v1/interviews/:id/answer` |
| Roadmap | `POST /api/v1/roadmaps/generate`, `GET /api/v1/roadmaps` |
| Admin | `GET /api/v1/admin/stats`, `GET /api/v1/admin/users` |
| Health | `GET /health`, `GET /ready` |

---

## Project Structure

```
.
├── client/          # React + Vite frontend
│   └── src/
│       ├── components/   # Shared UI components
│       ├── pages/        # Route-level page components
│       ├── hooks/        # TanStack Query mutation/query hooks
│       ├── store/        # Zustand auth store
│       └── lib/          # API client, utils
├── server/          # Express backend
│   └── src/
│       ├── config/       # Environment config, database
│       ├── controllers/  # Request handlers
│       ├── middleware/   # Auth, validation, error handling
│       ├── models/       # Mongoose schemas
│       ├── routes/       # Express routers
│       ├── services/     # Business logic
│       └── integrations/ # AI providers, email, storage
├── shared/          # Zod schemas and TypeScript types shared across packages
└── docs/            # Architecture and audit documents
```

---

## Security Notes

- AI API keys are **never** exposed to the frontend
- All user data queries are scoped by authenticated `userId` (IDOR prevention)
- Refresh tokens use family-based rotation — token reuse invalidates the entire family
- Zod validation middleware strips unknown fields on all mutating routes
- Helmet, CORS allowlist, and per-route rate limiting are active in production

---

## Demo Mode

When no AI API key is configured, the server automatically uses **demo mode**:
- Analysis, job matching, interview questions, and roadmap generation return deterministic sample data
- The API response includes `"demoMode": true` and a disclaimer
- All UI components display a banner indicating demo mode is active

---

## License

MIT
