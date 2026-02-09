# Developer Commands Reference

All commands run from the **project root** unless noted otherwise.

---

## Local Development

### Start Everything (Docker - Recommended)
```bash
cp .env.example .env          # First time only
npm run docker:dev:build       # Build + start all containers (postgres, backend, frontend)
npm run docker:dev             # Start without rebuilding
```

### Start Everything (No Docker)
```bash
cp .env.example .env
docker compose up -d postgres  # Just the database
cd backend && npm install && npx prisma db push && npm run start:dev
cd frontend && npm install && npm run dev
```

### URLs
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:3001 |
| GraphQL Playground | http://localhost:3001/graphql |

---

## Database

### Local Database (Prisma)
```bash
# From backend/
npx prisma db push             # Sync schema to DB (no migration file)
npx prisma migrate dev --name <name>  # Create migration file + apply
npx prisma generate            # Regenerate Prisma Client (after schema changes)
npx prisma studio              # Visual DB browser (http://localhost:5555)
npx prisma db push --force-reset      # Nuke and recreate DB (destroys all data)
```

### Local Database (Docker)
```bash
# From root
npm run docker:db:push         # prisma db push inside container
npm run docker:db:studio       # prisma studio inside container
```

### Seeding
```bash
# From backend/
npm run db:seed                # Seed test data (6 users, sample raffles)

# From root (Docker)
npm run docker:db:seed         # Seed inside container
```

**Seed users:** `comprador@test.com`, `vendedor@test.com`, `admin@test.com`, `unverified@test.com`, `pending-kyc@test.com`, `rejected-kyc@test.com`
**Passwords:** `Password123!` (admin: `Admin123!`)

### Deployed Database (Render)
To run Prisma commands against the deployed Render Postgres:

```bash
# Temporarily override DATABASE_URL
DATABASE_URL="postgresql://user:pass@host:5432/dbname" npx prisma studio
DATABASE_URL="postgresql://user:pass@host:5432/dbname" npx prisma migrate deploy
```

> **Important:** Use `migrate deploy` (not `migrate dev` or `db push`) for production databases. `migrate deploy` only applies pending migrations without creating new ones or resetting data.

---

## Testing

### Backend Unit Tests (Jest)
```bash
# From root
npm run test:backend           # 770 tests across 49 spec files

# From backend/
npm run test                   # Run all once
npm run test:watch             # Watch mode
npm run test:cov               # With coverage report (42%+)
npm run test:debug             # Debug mode with inspector
npm run test:integration       # Integration tests (real database)
```

### Frontend Component Tests (Vitest)
```bash
# From root
npm run test:frontend          # 50 tests across 7 files

# From frontend/
npm run test:unit              # Run all
npm run test:unit:ui           # Interactive UI
npm run test:unit:coverage     # With coverage (80%+)
```

### E2E Tests (Playwright)
```bash
# From frontend/ (backend must be running)
npm run test:e2e               # All browsers (174 tests x 3 = 522 runs)
npm run test:e2e:ui            # Interactive Playwright UI
npm run test:e2e:headed        # Visible browser

# Specific file or browser
npx playwright test e2e/legal-pages.spec.ts
npx playwright test --project=chromium
```

### Run Everything
```bash
# From root
npm run test                   # Backend + frontend component tests
```

---

## Linting & Type Checking

```bash
# From root
npm run lint                   # ESLint (backend + frontend)
npm run lint:backend
npm run lint:frontend
npm run typecheck              # TypeScript (backend + frontend)
npm run typecheck:backend
npm run typecheck:frontend
```

---

## Building

```bash
# From root
npm run build                  # Build backend + frontend
npm run build:backend          # nest build
npm run build:frontend         # next build
```

---

## Docker

### Dev Environment
```bash
npm run docker:dev:build       # Build + start
npm run docker:dev             # Start (no rebuild)
npm run docker:dev:down        # Stop
npm run docker:clean           # Stop + remove volumes + images
```

### Production
```bash
npm run docker:prod:build      # Build + start
npm run docker:prod            # Start
npm run docker:prod:down       # Stop
```

### Logs & Shell
```bash
npm run docker:logs            # All container logs
npm run docker:logs:backend    # Backend logs only
npm run docker:logs:frontend   # Frontend logs only
npm run docker:shell:backend   # Shell into backend container
npm run docker:shell:frontend  # Shell into frontend container
```

---

## Load Testing (k6)

Requires [k6](https://k6.io) installed.

```bash
npm run k6:smoke               # Quick smoke test
npm run k6:load                # Normal load test
npm run k6:stress              # Stress test

# Individual scenarios
npm run k6:health              # Health endpoint
npm run k6:browse              # Homepage browsing
npm run k6:search              # Search + filters
npm run k6:detail              # Raffle detail pages
npm run k6:auth                # Auth flow
npm run k6:buy                 # Ticket purchase flow
```

---

## Backend-Only Commands

```bash
# From backend/
npm run start:dev              # Dev server (watch mode)
npm run start:debug            # Debug + watch
npm run start:prod             # Production (node dist/main.js)
npm run format                 # Prettier
npm run db:migrate             # prisma migrate dev
npm run db:generate            # prisma generate
npm run db:studio              # prisma studio
npm run db:seed                # Run seed script
```

---

## Frontend-Only Commands

```bash
# From frontend/
npm run dev                    # Next.js dev server
npm run build                  # Production build
npm run start                  # Start production server
npm run lint                   # ESLint
```
