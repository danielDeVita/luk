# Claude Context File

Context for Claude when working on this codebase.

## Project Concept

**Raffle marketplace for Argentina** - Users create raffles for products, others buy tickets. Winner gets the product, seller gets paid (minus platform fee). Uses Mercado Pago for payments with 30-day delayed disbursement for buyer protection.

**Target Market:** Argentina (Spanish UI, Mercado Pago, Argentine regulations)

**Key Features:** Mercado Pago payments, seller dashboard with analytics, buyer recommendations, referral program (5% rewards), price drop alerts, price history tracking, dispute resolution, Q&A system for raffles, email verification (6-digit code), seller onboarding checklist, verified seller badges, dark mode.

---

## Business Flows

### Raffle Lifecycle
1. **ACTIVA** - Seller creates raffle (must have MP Connect + shipping address)
2. Buyers purchase tickets → MP Checkout Pro payment
3. Draw date reached:
   - If 70%+ tickets sold → Execute draw → **SORTEADA**
   - If <70% sold → Cancel + refund all → **CANCELADA**
4. Seller ships product → **EN_ENTREGA** (tracking number added)
5. Winner confirms delivery → **FINALIZADA** (payout released)
6. Auto-release after 7 days if no confirmation

### Dispute Resolution
1. Winner opens dispute → Payout frozen
2. Seller has 48h to respond with evidence
3. Admin mediates → Resolution:
   - `RESUELTA_COMPRADOR`: Full refund to buyer
   - `RESUELTA_VENDEDOR`: Full payout to seller
   - `RESUELTA_PARCIAL`: Split (configurable amounts)

### Seller Reputation
| Level | Requirements | Max Active Raffles |
|-------|-------------|-------------------|
| NUEVO | New seller | 3 |
| BRONCE | 5+ sales, 3.5+ rating | 5 |
| PLATA | 20+ sales, low disputes | 7 |
| ORO | 50+ sales, excellent metrics | 10 |

### Fee Structure
- Platform fee: 10% of ticket sales
- MP processing fee: ~5% (varies)
- Seller receives: ~85% net

### User Registration Flow
1. User submits registration form (email, password, confirm password, name, birth date, terms)
2. Backend creates user with `emailVerified: false`
3. 6-digit verification code sent to email (expires in 15 minutes)
4. User enters code on verification screen
5. On valid code: `emailVerified: true`, auth tokens issued, user logged in
6. Optional: referral code applied after verification

### Seller Onboarding Checklist
New sellers see a progress checklist in their dashboard:
1. **Complete profile** - Name + phone number
2. **Connect Mercado Pago** - OAuth flow for receiving payments
3. **Add shipping address** - Street, city, province, postal code (via KYC)
4. **Create first raffle** - Start selling

Checklist hides automatically when all steps are complete.

---

## Database Models

### Core Models
| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `User` | Users (buyers, sellers, admins) | → Raffle (seller), Ticket (buyer), Dispute, Review |
| `Raffle` | Raffle listings | → User (seller/winner), Product, Ticket[], Dispute |
| `Product` | Product details for raffle | → Raffle (1:1) |
| `Ticket` | Purchased tickets | → Raffle, User (buyer) |
| `Transaction` | Payment records | → User, Raffle |
| `Transaction` | Payment records | → User, Raffle |
| `Dispute` | Buyer protection disputes | → Raffle (1:1), User (reporter) |
| `RaffleQuestion` | Q&A on raffles | → Raffle, User (asker) |
| `RaffleAnswer` | Seller answers to questions | → RaffleQuestion (1:1), User (seller) |

### Supporting Models
| Model | Purpose |
|-------|---------|
| `Category` | Raffle categories |
| `Favorite` | User's saved raffles |
| `Review` | Winner reviews seller |
| `DrawResult` | Lottery draw audit trail |
| `Payout` | Seller payout tracking |
| `Notification` | In-app notifications |
| `ReferralCredit` | Referral program rewards |
| `UserReputation` | Seller levels & stats |
| `AuditLog` | Admin action audit |
| `ActivityLog` | User activity tracking |
| `MpEvent` | Webhook idempotency |
| `EmailVerificationCode` | 6-digit codes for email verification |
| `PriceHistory` | Track price changes on raffles |

### Key Enums
```
RaffleStatus:    ACTIVA → COMPLETADA → SORTEADA → EN_ENTREGA → FINALIZADA
                                                            ↘ CANCELADA

TicketStatus:    RESERVADO → PAGADO → REEMBOLSADO

DisputeStatus:   ABIERTA → ESPERANDO_RESPUESTA_VENDEDOR → EN_MEDIACION
                                                        ↘ RESUELTA_COMPRADOR
                                                        ↘ RESUELTA_VENDEDOR
                                                        ↘ RESUELTA_PARCIAL

SellerLevel:     NUEVO → BRONCE → PLATA → ORO

MpConnectStatus: NOT_CONNECTED → PENDING → CONNECTED
```

---

## Tech Stack

### Backend (`/backend`)
- **Framework:** NestJS 11 + GraphQL (Apollo Server)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT + Passport.js (local + Google OAuth)
- **Payments:** Mercado Pago (Checkout Pro + Marketplace OAuth)
- **Email:** Resend
- **Storage:** Cloudinary
- **Logging:** Winston (structured JSON in production)
- **Events:** @nestjs/event-emitter for decoupled event handling

### Frontend (`/frontend`)
- **Framework:** Next.js 16 (App Router) + React 19
- **Styling:** Tailwind CSS v4 (OKLCH colors)
- **Components:** shadcn/ui (Radix UI)
- **State:** Zustand (auth, theme) + Apollo Client (server state)
- **Analytics:** Google Analytics 4
- **Charts:** Recharts

---

## Key Patterns

### Backend

1. **GraphQL Resolvers** - decorators:
   - `@Public()` - bypasses JWT guard
   - `@CurrentUser()` - injects authenticated user
   - Global `JwtAuthGuard` via `APP_GUARD`

2. **Services** contain business logic, resolvers are thin

3. **Repository Pattern** - `backend/src/common/repositories/`
   - `UsersRepository`, `RafflesRepository`, `TicketsRepository`, etc.
   - Inject repository instead of Prisma for testability

4. **Event-driven Architecture** - `backend/src/common/events/`
   - Events: `raffle.completed`, `raffle.drawn`, `ticket.purchased`, `dispute.opened`
   - Listeners handle cross-cutting concerns (notifications, logging)

5. **PII Encryption** - AES-256-GCM for sensitive data (MP tokens, DNI, CUIT)
   - Requires `ENCRYPTION_KEY` (64 hex chars) in .env

6. **Module Dependencies** - Circular deps require `forwardRef`:
   ```
   AuthModule ↔ ReferralsModule (registration applies referral codes)
   PaymentsModule ↔ ReferralsModule (purchases trigger referral rewards)
   ```
   Use: `forwardRef(() => ModuleName)` in imports and `@Inject(forwardRef(() => ServiceName))`

### Frontend

1. **State:**
   - `useAuthStore` - auth state (Zustand + localStorage persist)
   - `useThemeStore` - dark/light theme
   - Apollo Client cache for server data

2. **Authentication:**
   - Tokens stored in localStorage (not cookies) due to third-party cookie blocking on cross-subdomain deployments
   - Apollo Client sends `Authorization: Bearer` header via authLink
   - See DEPLOYMENT.md for recommended long-term fixes (custom domain or API proxy)

3. **Components:**
   - `'use client'` for interactive components
   - shadcn/ui in `/components/ui/`
   - `cn()` utility for conditional classes

4. **GraphQL:**
   - Queries/mutations inline with `gql` or in `/lib/graphql/`
   - Apollo BatchHttpLink for query batching

---

## REST Endpoints

GraphQL handles most operations, but these REST endpoints exist:

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Full health check (DB, version, uptime) |
| GET | `/health/ready` | Readiness probe (k8s) |
| GET | `/health/live` | Liveness probe |

### Mercado Pago
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/mp/webhook` | Public | MP webhook receiver |
| GET | `/mp/payment-status?payment_id=X` | Public | Check payment status |
| GET | `/mp/sync-payment/:paymentId` | Public | Manual payment sync |

### MP Connect (Seller OAuth)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/mp/connect` | JWT | Start OAuth flow |
| GET | `/mp/connect/callback` | Public | OAuth callback |
| GET | `/mp/connect/status` | JWT | Connection status |
| POST | `/mp/connect/disconnect` | JWT | Disconnect account |

### Auth (Google OAuth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/google` | Start Google OAuth |
| GET | `/auth/google/callback` | Google callback |
| GET | `/auth/token?code=X` | Exchange code for tokens |
| GET | `/auth/refresh?token=X` | Refresh access token |
| GET | `/auth/logout` | Logout |

### Uploads
| Method | Path | Description |
|--------|------|-------------|
| GET | `/uploads/signature` | Cloudinary upload signature |
| GET | `/uploads/signature/avatar` | Avatar upload signature |

---

## Frontend Routes

| Route | Description | Auth |
|-------|-------------|------|
| `/` | Home - featured raffles | Public |
| `/search` | Search with filters | Public |
| `/raffle/[id]` | Raffle detail + buy tickets + Q&A | Public |
| `/seller/[id]` | Public seller profile | Public |
| `/checkout/status` | Payment result | Public |
| `/auth/login` | Login (email + Google) | Public |
| `/auth/register` | Registration with email verification (accepts `?ref=CODE`) | Public |
| `/dashboard/create` | Create raffle | User |
| `/dashboard/tickets` | Buyer dashboard | User |
| `/dashboard/sales` | Seller dashboard | User |
| `/dashboard/favorites` | Saved raffles | User |
| `/dashboard/referrals` | Referral program | User |
| `/dashboard/settings` | Profile (Avatar) + MP Connect | User |
| `/admin` | Admin panel | Admin |
| `/admin/disputes` | Dispute management | Admin |
| `/legal/terminos` | Terms of service | Public |
| `/legal/privacidad` | Privacy policy | Public |

---

## File Structure

```
backend/src/
  {module}/
    {module}.module.ts      # NestJS module
    {module}.service.ts     # Business logic
    {module}.resolver.ts    # GraphQL resolvers
    dto/                    # Input/output types
    entities/               # GraphQL object types
  common/
    repositories/           # Repository pattern
    events/                 # Event emitter setup
    services/               # Shared services (encryption)
    utils/                  # Utilities (fulltext search)
    guards/                 # Auth guards
    plugins/                # Apollo plugins

frontend/src/
  app/                      # Next.js pages
    dashboard/              # User dashboards
    raffle/[id]/            # Raffle detail (server component + OG meta)
    admin/                  # Admin panel
  components/
    ui/                     # shadcn components
  store/                    # Zustand stores
  lib/                      # Apollo client, utilities
```

### Key Files

| Purpose | Path |
|---------|------|
| Prisma Schema | `backend/prisma/schema.prisma` |
| Fee Constants | `backend/src/common/constants/fees.constants.ts` |
| Apollo Client | `frontend/src/lib/apollo-client.ts` |
| Auth Store | `frontend/src/store/auth.ts` |
| MP Connect Service | `backend/src/payments/mp-connect.service.ts` |
| Payments Controller | `backend/src/payments/payments.controller.ts` (webhooks) |
| Referrals Service | `backend/src/referrals/referrals.service.ts` |
| Referrals Dashboard | `frontend/src/app/dashboard/referrals/page.tsx` |

---

## Coding Conventions

1. **Language:** Spanish for user-facing text, English for code/comments
2. **Components:** PascalCase
3. **Files:** kebab-case for components, camelCase for utilities
4. **Imports:** Use `@/` alias for `src/` directory
5. **Forms:** react-hook-form + Zod validation
6. **Toasts:** Sonner (`toast.success()`, `toast.error()`)
7. **Icons:** Lucide React

---

## Development Setup

### Quick Start
```bash
# 1. Environment
cp .env.example .env  # Edit with your credentials

# 2. Database
docker compose up -d postgres

# 3. Backend
cd backend && npm install && npx prisma db push && npm run start:dev

# 4. Frontend (new terminal)
cd frontend && npm install && npm run dev
```

### URLs
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:3001 |
| GraphQL Playground | http://localhost:3001/graphql |
| Prisma Studio | `npx prisma studio` → http://localhost:5555 |

### Environment (single `.env` at root)
```bash
# Required
DATABASE_URL="postgresql://raffle_user:raffle_password@localhost:5432/raffle_db"
JWT_SECRET="your-secret-min-32-chars"
MP_ACCESS_TOKEN="TEST-..."
MP_PUBLIC_KEY="TEST-..."
MP_CLIENT_ID="..."           # For MP Connect OAuth
MP_CLIENT_SECRET="..."       # For MP Connect OAuth
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
ENCRYPTION_KEY="64-hex-chars" # For PII encryption

# URLs
FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3001"
NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
NEXT_PUBLIC_GRAPHQL_URL="http://localhost:3001/graphql"
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
```

---

## Docker Development

Full Docker environment with hot-reload for development. Solves Node.js version conflicts - no need to install Node locally.

### Quick Start (Docker)
```bash
# 1. Environment
cp .env.example .env  # Edit with your credentials

# 2. Start everything
npm run docker:dev:build  # First time (builds images)
npm run docker:dev        # Subsequent runs
```

### Services
| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js with hot-reload |
| Backend | 3001 | NestJS with hot-reload |
| Prisma Studio | 5555 | Database UI |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |

### Docker Commands
```bash
# Development
npm run docker:dev          # Start all services
npm run docker:dev:build    # Rebuild and start
npm run docker:dev:down     # Stop all services

# Production
npm run docker:prod         # Start production build
npm run docker:prod:build   # Rebuild and start
npm run docker:prod:down    # Stop

# Logs
npm run docker:logs           # All services
npm run docker:logs:backend   # Backend only
npm run docker:logs:frontend  # Frontend only

# Shell access
npm run docker:shell:backend  # Backend container shell
npm run docker:shell:frontend # Frontend container shell

# Database
npm run docker:db:push        # Run prisma db push
npm run docker:db:studio      # Open Prisma Studio

# Cleanup
npm run docker:clean          # Remove containers, volumes, images
```

### Key Files
| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Development environment (hot-reload) |
| `docker-compose.yml` | Production environment |
| `backend/Dockerfile.dev` | Backend dev image (Node 22) |
| `frontend/Dockerfile.dev` | Frontend dev image (Node 22) |
| `backend/.dockerignore` | Excludes from backend build |
| `frontend/.dockerignore` | Excludes from frontend build |

### Hot-Reload
Source code is mounted as volumes, so changes trigger automatic rebuilds:
- Backend: Edit `backend/src/**` → NestJS auto-restarts
- Frontend: Edit `frontend/src/**` → Next.js hot-reloads in browser

### Local Development (without Docker)
If you prefer local Node.js (requires Node 22 installed globally):
```bash
# Follow Quick Start in Development Setup section
cd backend && npm install && npx prisma db push && npm run start:dev
# In another terminal:
cd frontend && npm install && npm run dev
```

---

## Mercado Pago Testing

### MP Connect (Seller Onboarding)
1. Get `MP_CLIENT_ID` and `MP_CLIENT_SECRET` from [MP Developer Dashboard](https://www.mercadopago.com.ar/developers/panel/app)
2. Add redirect URL: `http://localhost:3001/mp/connect/callback`
3. Flow: Seller → Settings → Payments → Connect MP → OAuth → Callback stores tokens

### Test Cards
| Card | Number | CVV | Result |
|------|--------|-----|--------|
| Visa | 4509 9535 6623 3704 | 123 | Approved |
| Mastercard | 5031 7557 3453 0604 | 123 | Approved |
| Any | 4000 0000 0000 0002 | 123 | Rejected |

### Webhooks (Tunnels)
For MP webhooks, backend needs public URL:
```bash
ngrok http 3001  # Then set BACKEND_URL to tunnel URL
```

If webhooks fail, `/checkout/status` page auto-syncs payment status on load.

---

## Common Tasks

### Adding a GraphQL endpoint
1. Add method to service
2. Add resolver method with decorators (`@Query`, `@Mutation`, `@Public()` if needed)
3. Types auto-generate on `npm run start:dev`

### Database changes
1. Edit `backend/prisma/schema.prisma`
2. `npx prisma db push` (dev) or `npx prisma migrate dev` (with migration)
3. `npx prisma generate` if needed

### CI Database Strategy
- **Local dev:** Uses `npx prisma db push` to push schema to existing database
- **GitHub Actions CI:** Uses `npx prisma db push --skip-generate` for fresh databases (no migrations directory required)
  - This approach creates tables directly instead of applying migrations sequentially
  - Ideal for ephemeral CI environments where fresh databases are created on each run

### Full-text search setup
Run migration: `psql -f backend/prisma/migrations/20260109_fulltext_search/migration.sql`

---

## Troubleshooting

### MP "Pagar" button disabled
Brave Shields or AdBlock blocking MP scripts. Use Chrome without extensions.

### Webhook not arriving
1. Check `BACKEND_URL` is public (use ngrok)
2. Tunnel may have expired (restart ngrok)
3. Workaround: Visit `/checkout/status?payment_id=XXX` to sync

### TypeScript errors after pulling
```bash
cd backend && npx prisma generate
```

### Prisma issues
```bash
npx prisma db push --force-reset  # Resets DB
npx prisma generate               # Regenerate client
```

---

## Key GraphQL Endpoints

### Seller Dashboard
```graphql
query { sellerDashboardStats { totalRevenue totalTicketsSold conversionRate monthlyRevenue { month revenue } } }
mutation { bulkCancelRaffles(raffleIds: [...]) { successCount failedCount } }
```

### Buyer Dashboard
```graphql
query { buyerStats { totalTicketsPurchased winRate totalSpent } }
query { recommendedRaffles(limit: 6) { id titulo precioPorTicket } }
query { favoritesEndingSoon(hoursThreshold: 48) { id titulo fechaLimiteSorteo } }
```

### Admin
```graphql
mutation { banUser(userId: "...", reason: "...") { id } }
mutation { bulkResolveDisputes(disputeIds: [...], resolution: RESUELTA_COMPRADOR) { successCount } }
```

### Referral Program
```graphql
query { myReferralStats { referralCode totalReferred totalEarned availableBalance } }
query { myReferredUsers { id nombre hasPurchased earnedFromUser } }
mutation { generateReferralCode }
mutation { applyReferralCode(code: "...") }
```

### Price Alerts
```graphql
mutation { updateRafflePrice(raffleId: "...", newPrice: 100.0) { id precioPorTicket lastPriceDropAt } }
```

### Q&A System
```graphql
query { raffleQuestions(raffleId: "...") { id content answer { content } } }
mutation { askQuestion(input: { raffleId: "...", content: "..." }) { id } }
mutation { answerQuestion(input: { questionId: "...", content: "..." }) { id } }
```

### Email Verification
```graphql
mutation { register(input: {...}) { user { id } requiresVerification message } }
mutation { verifyEmail(userId: "...", code: "123456", referralCode: "ABC") { token user { id emailVerified } } }
mutation { resendVerificationCode(userId: "...") }
```

### Price History
```graphql
query { priceHistory(raffleId: "...") { id previousPrice newPrice changedAt percentChange } }
```

---

## Notes

- Raffle pages use server-side `generateMetadata` for Open Graph (social previews)
- View count tracked via `sessionStorage` (one increment per session)
- Dark mode uses `.dark` class on `<html>`, persisted to localStorage
- Users can browse without auth, must login to buy tickets
- Seller must have MP Connected + shipping address before creating raffle
- **Referral Program**: Users get 5% credit of referee's first purchase. Dashboard at `/dashboard/referrals`
- **Price Alerts**: Users get notified (email + in-app) when favorited raffle prices drop
- **Email Verification**: Two-step registration with 6-digit code (15 min expiry, max 3 attempts)
- **Seller Onboarding**: Progress checklist shown until profile, MP Connect, address, and first raffle are complete
- **Price History**: Raffle pages show price change history with percentage discounts
- **Verified Seller Badge**: Sellers with `kycStatus: VERIFIED` show green checkmark badge on profile
