# Claude Context - Raffle Marketplace

## Project Overview

**Raffle marketplace for Argentina.** Users create raffles for products, others buy tickets. Winner gets the product, seller gets paid minus platform fee. Uses Mercado Pago for payments with 30-day delayed disbursement for buyer protection.

**Stack:** NestJS + GraphQL (backend), Next.js + React (frontend), PostgreSQL + Prisma, Brevo (emails)

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

**Coverage:** 769 backend tests (42%+), 50 component tests (80%+), 175 E2E tests

```bash
# Run all tests (from root)
npm run test              # Backend + Frontend component tests
npm run test:backend      # Backend unit tests (769 tests)
npm run test:frontend     # Frontend component tests (50 tests)

# Backend (cd backend/)
npm run test              # Unit tests (769 tests)
npm run test:cov          # With coverage (42%+)
npm run test:integration  # Integration tests

# Frontend Component Tests (cd frontend/)
npm run test:unit         # Vitest component tests (50 tests)
npm run test:unit:ui      # Interactive UI
npm run test:unit -- --coverage  # Coverage report (80%+)

# Frontend E2E Tests (cd frontend/)
npm run test:e2e          # All browsers (175 tests × 3 = 525 executions)
npm run test:e2e:ui       # Interactive mode
npm run test:e2e -- --project=chromium  # Specific browser
npm run test:e2e -- legal-pages.spec.ts # Specific file
```

**E2E Auth:** Tests use `apiLogin()` from `e2e/helpers/auth.ts` — authenticates via direct API call and injects tokens into localStorage (bypasses browser login UI). In CI, ~141 tests pass and ~34 are skipped (tests requiring real email service, seeded raffle data, or cross-origin GraphQL).

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
