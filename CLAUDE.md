# Claude Context - Raffle Marketplace

## Project Overview

**Raffle marketplace for Argentina.** Users create raffles for products, others buy tickets. Winner gets the product, seller gets paid minus platform fee. Uses Mercado Pago for payments with 30-day delayed disbursement for buyer protection.

**Stack:** NestJS + GraphQL (backend), Next.js + React (frontend), PostgreSQL + Prisma, Brevo (emails)

> **Developer commands**: See [COMMANDS.md](COMMANDS.md) for all scripts, database, Docker, and deployment commands.
> **Backend details**: See [backend/README.md](backend/README.md) for modules, API endpoints, Prisma schema, and service reference.
> **Frontend details**: See [frontend/README.md](frontend/README.md) for pages, components, E2E tests, and UI patterns.

---

## Business Flows

### Raffle Lifecycle
1. **ACTIVA** - Seller creates raffle (must have KYC verified + MP Connect + shipping address)
2. Buyers purchase tickets → MP Checkout Pro
3. Draw date reached:
   - If ≥70% tickets sold → Draw → **SORTEADA**
   - If <70% sold → Refund all → **CANCELADA**
4. Seller ships → **EN_ENTREGA**
5. Winner confirms → **FINALIZADA** (payout released, or auto after 7 days)

### Dispute Resolution
Winner opens dispute → Payout frozen → Seller responds (48h) → Admin mediates → Resolution

### Raffle Relaunch
Cancelled raffle (<70% sales) → System calculates price reduction → Seller gets email with relaunch button

---

## Database Models (Key)

| Model | Purpose |
|-------|---------|
| `User` | Buyers, sellers, admins |
| `Raffle` | Listings with product details |
| `Ticket` | Purchased tickets |
| `Dispute` | Buyer protection |
| `RaffleQuestion`, `RaffleAnswer` | Q&A system |

**Enums:**
- `RaffleStatus`: ACTIVA → SORTEADA → EN_ENTREGA → FINALIZADA / CANCELADA
- `SellerLevel`: NUEVO → BRONCE → PLATA → ORO
- `MpConnectStatus`: NOT_CONNECTED → PENDING → CONNECTED

---

## Key Features

- **Mercado Pago:** Checkout Pro + Marketplace OAuth for seller payouts
- **Email:** Brevo (HTTP API, 300 free emails/day)
- **Auth:** JWT + Google OAuth
- **PII Encryption:** AES-256-GCM for DNI, CUIT, addresses, phone
- **Event-driven:** Order completion, disputes, refunds trigger email notifications
- **Seller Onboarding:** 5-step checklist (profile, KYC, MP Connect, address, first raffle)
- **Referral Program:** 5% credit on referee's first purchase
- **Price Alerts:** Email notifications for favorited raffle price drops
- **Email Verification:** 6-digit code, 15min expiry during registration

---

## Architecture Patterns

### Backend
1. **GraphQL resolvers** - thin, delegate to services
2. **Repository pattern** - `UsersRepository`, `RafflesRepository`, etc.
3. **Event emitter** - `raffle.completed`, `ticket.purchased`, `dispute.opened`, etc.
4. **Decorators:** `@Public()`, `@CurrentUser()`, `@Roles()`
5. **Circular dependencies:** Use `forwardRef()` for AuthModule ↔ ReferralsModule

### Frontend
1. **State:** Zustand (auth, theme) + Apollo Client (server)
2. **Auth:** Tokens in localStorage (not cookies)
3. **Components:** shadcn/ui + Tailwind CSS
4. **GraphQL:** Inline queries with `gql` or `/lib/graphql/`

---

## File Structure

```
backend/src/
  {module}/
    {module}.module.ts
    {module}.service.ts
    {module}.resolver.ts
    dto/, entities/
  common/
    repositories/, events/, services/, guards/

frontend/src/
  app/                # Next.js routes
  components/ui/      # shadcn components
  store/              # Zustand stores
  lib/                # Apollo client, utilities
```

---

## Development Setup

### Quick Start (Local)
```bash
cp .env.example .env
docker compose up -d postgres
cd backend && npm install && npx prisma db push && npm run start:dev
cd frontend && npm install && npm run dev
```

### Quick Start (Docker)
```bash
cp .env.example .env
npm run docker:dev:build
npm run docker:dev
```

### URLs
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- GraphQL: http://localhost:3001/graphql

---

## Environment Variables (Key)

```bash
# Database
DATABASE_URL="postgresql://..."

# Auth
JWT_SECRET="min-32-chars"

# Mercado Pago
MP_ACCESS_TOKEN="TEST-..."
MP_PUBLIC_KEY="TEST-..."
MP_CLIENT_ID="..." # OAuth
MP_CLIENT_SECRET="..."

# Email (Brevo)
BREVO_API_KEY="xkeysib-..." # REST API key, not SMTP
EMAIL_FROM="noreply@domain.com"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Encryption
ENCRYPTION_KEY="64-hex-chars"

# Frontend
NEXT_PUBLIC_GRAPHQL_URL="http://localhost:3001/graphql"
NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-..."
```

---

## Common Tasks

### Add GraphQL endpoint
1. Add method to service
2. Add resolver method with decorators
3. Types auto-generate on `npm run start:dev`

### Database changes
```bash
npx prisma db push
npx prisma generate
npx prisma studio
```

### Testing

**Coverage:** 770 backend tests (42%+), 50 component tests (80%+), 174 E2E tests

```bash
# Run all tests (from root)
npm run test              # Backend + Frontend component tests
npm run test:backend      # Backend unit tests (770 tests)
npm run test:frontend     # Frontend component tests (50 tests)

# Backend (cd backend/)
npm run test              # Unit tests (770 tests)
npm run test:cov          # With coverage (42%+)
npm run test:integration  # Integration tests

# Frontend Component Tests (cd frontend/)
npm run test:unit         # Vitest component tests (50 tests)
npm run test:unit:ui      # Interactive UI
npm run test:unit -- --coverage  # Coverage report (80%+)

# Frontend E2E Tests (cd frontend/)
npm run test:e2e          # All browsers (174 tests × 3 = 522 executions)
npm run test:e2e:ui       # Interactive mode
npm run test:e2e -- --project=chromium  # Specific browser
npm run test:e2e -- legal-pages.spec.ts # Specific file
```

**E2E Auth:** Tests use `apiLogin()` from `e2e/helpers/auth.ts` — authenticates via direct API call and injects tokens into localStorage (bypasses browser login UI).

**E2E CI Results:** ~137 passed, ~37 skipped, 0 failed. Skipped tests fall into these categories:
- **Admin disputes** (14 tests): Admin page query fails in CI — needs investigation with Playwright trace artifacts
- **KYC submission** (9 tests): Settings page `GET_USER_DATA` query fires before Zustand hydrates auth token, causing `kycStatus` to default to `NOT_SUBMITTED`
- **Email verification** (7 tests): Require real email service or active verification sessions
- **Auth UI login** (4 tests): Browser-based login form unreliable in CI (use `apiLogin` instead)
- **Dashboard sales** (2 tests): Cross-origin "Failed to fetch" between frontend (:3000) and backend (:3001)
- **Raffle browsing** (1 test): Search query loading too slow in CI with seeded data

**Test Files:**
- Backend: 49 spec files (services, controllers, resolvers)
- Frontend: 7 component test files, 17 E2E spec files
- Total: ~994 tests across 73 test files

---

## Important Notes

- Raffle pages use server-side `generateMetadata` for Open Graph
- Dark mode stored in localStorage, CSS class `.dark` on `<html>`
- Users can browse without auth, must login to buy
- **Seller Requirements:** KYC verified + MP Connected + shipping address before creating raffles
- **PII Encryption:** All KYC data encrypted at rest (AES-256-GCM)
- **Email Verification:** Two-step registration with 6-digit code (15 min expiry)
- **Verified Badge:** Sellers with `kycStatus: VERIFIED` show green checkmark
- **Seller Levels:** Max active raffles based on reputation (NUEVO: 3, BRONCE: 5, PLATA: 7, ORO: 10)

---

## Troubleshooting

**TypeScript errors after pull:**
```bash
npx prisma generate
```

**Prisma issues:**
```bash
npx prisma db push --force-reset
```

**Google OAuth 401 invalid_client:**
- Check Google Cloud Console → OAuth consent screen (add test user if in testing)
- Verify OAuth credentials have correct redirect URIs
- Client Secret matches `.env`

**Email not sending:**
- Verify `BREVO_API_KEY` is set (starts with `xkeysib-`, not `xsmtpsib-`)
- Use `npx ts-node scripts/test-email.ts your-email@example.com` to test

---

## Code Conventions

- **Language:** Spanish (UI text), English (code/comments)
- **Components:** PascalCase, `@/` alias for src
- **Files:** kebab-case (components), camelCase (utils)
- **Forms:** react-hook-form + Zod
- **Toasts:** Sonner (`toast.success()`, `toast.error()`)
- **Icons:** Lucide React

---

## Workflow Orchestration

### 1. Plan Mode Default

-   Enter plan mode for ANY non-trivial task (3+ steps or architectural
    decisions)
-   If something goes sideways, stop and re-plan immediately --- don't
    keep pushing
-   Use plan mode for verification steps, not just building
-   Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

-   Use subagents liberally to keep main context window clean
-   Offload research, exploration, and parallel analysis to subagents
-   For complex problems, throw more compute at it via subagents
-   One task per subagent for focused execution

### 3. Self-Improvement Loop

-   After ANY correction from the user: update `tasks/lessons.md` with
    the pattern
-   Write rules for yourself that prevent the same mistake
-   Ruthlessly iterate on these lessons until mistake rate drops
-   Review lessons at session start for relevant project

### 4. Verification Before Done

-   Never mark a task complete without proving it works
-   Diff behavior between main and your changes when relevant
-   Ask yourself: "Would a staff engineer approve this?"
-   Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

-   For non-trivial changes: pause and ask "is there a more elegant
    way?"
-   If a fix feels hacky: "Knowing everything I know now, implement the
    elegant solution"
-   Skip this for simple, obvious fixes --- don't over-engineer
-   Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

-   When given a bug report: first write a test that reproduces the bug
-   Then have subagents attempt fixes and prove them with a passing test
-   Just fix it. Don't ask for hand-holding
-   Point at logs, errors, failing tests --- then resolve them
-   Zero context switching required from the user
-   Go fix failing CI tests without being told how

## Task Management

1.  **Plan First**: Write plan to `tasks/todo.md` with checkable items
2.  **Verify Plan**: Check in before starting implementation
3.  **Track Progress**: Mark items complete as you go
4.  **Explain Changes**: High-level summary at each step
5.  **Document Results**: Add review section to `tasks/todo.md`
6.  **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

-   **Simplicity First**: Make every change as simple as possible.
    Impact minimal code.
-   **No Laziness**: Find root causes. No temporary fixes. Senior
    developer standards.
-   **Minimal Impact**: Changes should only touch what's necessary.
    Avoid introducing bugs.
-   **SOLID by Default**: Follow SOLID principles when designing
    classes, services, and modules.
-   **DRY Always**: Avoid duplication. Extract shared logic instead of
    copy‑pasting code.

## Testing Standards

-   Every new service, controller, route, resolver, or core function
    should have a corresponding test.
-   Use engineering judgment to decide the appropriate level of testing
    for each feature.
-   Do not attempt to test every single line of code, but ensure
    critical paths, business logic, and edge cases are covered.
-   If a piece of functionality is important enough to exist, it is
    likely important enough to test.
-   A task is **not complete** until its corresponding test file exists
    and passes.
