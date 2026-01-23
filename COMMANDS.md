# Development Commands Reference

Quick reference for all development commands. Run from the project root unless otherwise noted.

> **Testing Plan:** See [TESTING_AUDIT.md](TESTING_AUDIT.md) for complete testing audit, coverage goals, and implementation roadmap.

---

## Docker (Recommended)

Use Docker for development to avoid Node.js version conflicts.

### Starting the App

| Command | When to Use |
|---------|-------------|
| `npm run docker:dev` | Daily development - start all services |
| `npm run docker:dev:build` | First time setup, or after changing package.json |
| `Ctrl+C` | Stop all services |
| `npm run docker:dev:down` | Stop services and remove containers |

### Database Operations

| Command | When to Use |
|---------|-------------|
| `npm run docker:db:push` | After modifying `prisma/schema.prisma` |
| `npm run docker:db:studio` | Open Prisma Studio (database UI) at http://localhost:5555 |

### Debugging

| Command | When to Use |
|---------|-------------|
| `npm run docker:logs` | View all service logs |
| `npm run docker:logs:backend` | View only backend logs |
| `npm run docker:logs:frontend` | View only frontend logs |
| `npm run docker:shell:backend` | Open shell inside backend container |
| `npm run docker:shell:frontend` | Open shell inside frontend container |

### Cleanup

| Command | When to Use |
|---------|-------------|
| `npm run docker:clean` | Nuclear reset - removes containers, volumes, and images |

### Production (Docker)

| Command | When to Use |
|---------|-------------|
| `npm run docker:prod` | Run production build locally |
| `npm run docker:prod:build` | Build and run production |
| `npm run docker:prod:down` | Stop production containers |

---

## Local Development (Without Docker)

Requires Node.js 22. Use `nvm use` to switch versions (reads from `.nvmrc`).

### Starting Services Manually

```bash
# Terminal 1: Database
# NOTE: If using Neon (recommended), you can SKIP this step.
# Ensure DATABASE_URL in backend/.env points to your Neon instance.
# Only run this if you specifically want a local Postgres container:
# docker compose up -d postgres

# Terminal 2: Backend
cd backend && npm run start:dev

# Terminal 3: Frontend
cd frontend && npm run dev
```

### Backend Scripts (run from `/backend`)

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start with hot-reload (watch mode) |
| `npm run start:debug` | Start with debugger attached |
| `npm run start:prod` | Start production build |
| `npm run build` | Build for production |

### Frontend Scripts (run from `/frontend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server with hot-reload |
| `npm run build` | Build for production |
| `npm run start` | Start production build |

---

## Testing

### Backend Unit Tests (run from `/backend`)

| Command | When to Use |
|---------|-------------|
| `npm run test` | Run all unit tests once |
| `npm run test:watch` | Run tests in watch mode (re-runs on file changes) |
| `npm run test:cov` | Run tests with coverage report |
| `npm run test:debug` | Run tests with debugger attached |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:integration` | Run integration tests |

### Frontend E2E Tests - Playwright (run from `/frontend`)

| Command | When to Use |
|---------|-------------|
| `npm run test:e2e` | Run all Playwright tests headlessly |
| `npm run test:e2e:ui` | Open Playwright UI for interactive testing |
| `npm run test:e2e:headed` | Run tests with visible browser |

**Note:** App must be running before running Playwright tests.

### Load Tests - k6 (run from root)

Requires [k6](https://k6.io/docs/getting-started/installation/) installed locally.

| Command | Description |
|---------|-------------|
| `npm run k6:smoke` | Quick sanity check (low load, short duration) |
| `npm run k6:load` | Normal load test (simulates typical traffic) |
| `npm run k6:stress` | Stress test (finds breaking point) |

#### Individual Scenario Tests

| Command | What it Tests |
|---------|---------------|
| `npm run k6:health` | Health endpoint response |
| `npm run k6:browse` | Homepage browsing |
| `npm run k6:search` | Search with filters |
| `npm run k6:detail` | Raffle detail page |
| `npm run k6:auth` | Authentication flow |
| `npm run k6:buy` | Ticket purchase flow |

---

## Code Quality

### From Root (runs both backend + frontend)

| Command | Description | When to Use |
|---------|-------------|------------|
| `npm run lint` | Run ESLint (style/best practices) on both | Check code style issues |
| `npm run typecheck` | TypeScript type checking on both | Check type errors without building |
| `npm run build` | Full build (compiles both projects) | **Required before push** - catches TS + compile errors |

### Individual Projects

| Command | Description |
|---------|-------------|
| `npm run lint:backend` | Lint backend only (ESLint) |
| `npm run lint:frontend` | Lint frontend only (ESLint) |
| `npm run typecheck:backend` | Typecheck backend only (TypeScript) |
| `npm run typecheck:frontend` | Typecheck frontend only (TypeScript) |

**Key Difference:**
- **Lint** (ESLint): Catches style, unused variables, naming conventions
- **Typecheck/Build**: Catches TypeScript type errors, incompatibilities

### Backend Specific (run from `/backend`)

| Command | Description |
|---------|-------------|
| `npm run format` | Format code with Prettier |
| `npm run lint` | Lint and auto-fix |

---

## Database (Local - without Docker)

Run from `/backend`:

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio |

---

## Database (Deployed - Neon)

### Reset/Delete All Data

**Option 1: Via Neon Dashboard SQL Editor (Recommended)**

1. Go to [https://console.neon.tech](https://console.neon.tech)
2. Select your project → **SQL Editor**
3. Run this SQL command:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

**Option 2: Via Render Deployment**

1. Go to your Render backend dashboard
2. Click **Manual Deploy**
3. Backend will automatically run `npx prisma db push` to recreate schema

**Option 3: Delete & Recreate Database Branch**

1. Go to [https://console.neon.tech](https://console.neon.tech)
2. Select your project → **Branches**
3. Click on your main branch → **Delete branch**
4. Create new branch with same name
5. Update `DATABASE_URL` in Render if needed
6. Redeploy backend on Render

---

## Common Workflows

### Fresh Start (first time or after `docker:clean`)

```bash
npm run docker:dev:build    # Build and start
npm run docker:db:push      # Create tables (in another terminal)
```

### Daily Development

```bash
npm run docker:dev          # Start everything
# Code... (hot-reload handles changes)
Ctrl+C                      # Stop when done
```

### After Pulling Changes

```bash
# If package.json changed:
npm run docker:dev:build

# If schema.prisma changed:
npm run docker:db:push
```

### Before Committing / Pushing

**Important:** Run these checks locally BEFORE pushing to avoid CI/CD failures.

```bash
# Full verification (recommended)
npm run lint                # Check for ESLint errors (both projects)
npm run typecheck           # Check for TypeScript type errors (both projects)
npm run build               # Full build (compiles both projects - catches TS errors)

# Or run tests too (backend)
cd backend && npm run test  # Run backend unit tests
```

**Quick One-Command Check:**

Add this script to `package.json` if you want a single command:
```json
{
  "scripts": {
    "precheck": "npm run lint && npm run typecheck && npm run build"
  }
}
```

Then just run:
```bash
npm run precheck && git push
```

**Note:** Husky will run ESLint on staged files automatically on `git push`, but it won't catch TypeScript errors. Running `npm run build` locally prevents CI/CD failures.

### Running E2E Tests

```bash
# Terminal 1: Start the app
npm run docker:dev

# Terminal 2: Run Playwright (from frontend folder)
cd frontend && npm run test:e2e:ui
```

---

## URLs (When Running)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| GraphQL Playground | http://localhost:3001/graphql |
| Prisma Studio | http://localhost:5555 |

