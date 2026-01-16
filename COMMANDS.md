# Development Commands Reference

Quick reference for all development commands. Run from the project root unless otherwise noted.

---

## Docker (Recommended)

Use Docker for development to avoid Node.js version conflicts.

### Starting the App

| Command | When to Use |
|---------|-------------|
| `npm run docker:dev` | Daily development - start all services |
| `npm run docker:dev:build` | First time setup, or after changing package.json |
| `Ctrl+C` | Stop all services |
| `npm run docker:dev:down` | Stop services from another terminal |

### Database Operations

| Command | When to Use |
|---------|-------------|
| `npm run docker:db:push` | After modifying `prisma/schema.prisma` |
| `npm run docker:db:seed` | Populate database with test data |
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
docker compose up -d postgres

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

| Command | Description |
|---------|-------------|
| `npm run lint` | Run ESLint on both projects |
| `npm run typecheck` | TypeScript type checking |
| `npm run build` | Build both projects |

### Individual Projects

| Command | Description |
|---------|-------------|
| `npm run lint:backend` | Lint backend only |
| `npm run lint:frontend` | Lint frontend only |
| `npm run typecheck:backend` | Typecheck backend only |
| `npm run typecheck:frontend` | Typecheck frontend only |

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
| `npm run seed` or `npm run db:seed` | Seed database with test data |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio |

---

## Common Workflows

### Fresh Start (first time or after `docker:clean`)

```bash
npm run docker:dev:build    # Build and start
npm run docker:db:push      # Create tables (in another terminal)
npm run docker:db:seed      # Add test data
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

### Before Committing

```bash
npm run lint                # Check for lint errors
npm run typecheck           # Check for type errors
npm run test                # Run backend tests
```

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

---

## Test Users (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rifas.com | Password123! |
| Seller | vendedor@test.com | Password123! |
| Buyer | comprador@test.com | Password123! |
