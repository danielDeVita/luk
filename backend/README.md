# LUK - Backend

GraphQL API built with NestJS, Prisma, and PostgreSQL.

> **Project guide**: See [AGENTS.md](../AGENTS.md) for shared project context and [COMMANDS.md](../COMMANDS.md) for root-level workflows.

## Quick Start (Docker - Recommended)

```bash
# From project root
npm run docker:dev:build    # First time
npm run docker:db:push      # Create tables
```

## Quick Start (Local)

Requires Node.js 22 installed globally.

Local Docker PostgreSQL is exposed on `localhost:5433` to avoid conflicts with native PostgreSQL on `5432`.

```bash
# From project root
npm run docker:infra:up

# Backend
cd backend && npm install
cd backend && npx prisma db push
cd backend && npm run db:seed:manual-qa    # Optional but recommended
cd backend && npm run start:dev
```

For frontend in local host mode:

```bash
cd frontend && npm install && npm run dev
```

Recommended local payment config in the root `.env`:

```bash
PAYMENTS_PROVIDER="mock"
ALLOW_MOCK_PAYMENTS="true"
MP_ACCESS_TOKEN=""
```

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server (watch mode) |
| `npx prisma studio` | Database GUI |
| `npx prisma db push --force-reset` | Reset DB |

## Architecture

- **API**: GraphQL (Apollo) + REST for webhooks/OAuth
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT + Google OAuth (Passport.js)
- **Real-time**: GraphQL Subscriptions
- **Patterns**: Repository layer, Event-driven
- **Background Processing**: Scheduled jobs in backend + dedicated `social-worker`

## Modules

| Module | Purpose |
|--------|---------|
| `auth/` | JWT authentication, Google OAuth, email verification, guards |
| `users/` | User management, profiles |
| `raffles/` | Raffle CRUD, state management, seller dashboard, buyer experience, analytics |
| `tickets/` | Ticket reservation and purchase |
| `payments/` | Mercado Pago integration, mock checkout provider for QA, and MP Connect OAuth |
| `disputes/` | Buyer protection system |
| `notifications/` | Email (Brevo) + in-app notifications |
| `uploads/` | Cloudinary upload signatures |
| `admin/` | Admin panel, user management, bulk dispute resolution, stats |
| `categories/` | Raffle categories management |
| `reports/` | Raffle reporting/flagging system |
| `social-promotions/` | Verifiable seller promotion flow, parsers, scoring, promotion bonus lifecycle |
| `tasks/` | Scheduled jobs (cron) |
| `health/` | Health check endpoints |
| `questions/` | Q&A system for raffle pages |
| `activity/` | Activity logging |

### Social Promotions

The social promotion feature is implemented in v1 with:

- seller-created promotion drafts;
- manual permalink submission for `Facebook`, `Instagram`, `X` and `Threads`;
- public-post validation using `fetch` + Playwright fallback;
- metrics snapshots stored in PostgreSQL;
- a separate `social-worker` process for scheduled validation and settlement;
- promotion bonuses for future purchases.

No official Meta/X APIs are used in v1. Metrics come from public content plus Luk attribution events.

## Environment

The backend reads from `../.env` (root). `backend/.env` is a symlink to that file. Key variables:

```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
PLATFORM_FEE_PERCENT="4"
MP_ACCESS_TOKEN="TEST-..."
MP_CLIENT_ID="..."           # For MP Connect OAuth
MP_CLIENT_SECRET="..."       # For MP Connect OAuth
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
PAYMENTS_PROVIDER="mercadopago"   # or "mock" for local QA
ALLOW_MOCK_PAYMENTS="false"
SENTRY_DSN=""                     # Optional, leave empty in local
SENTRY_RELEASE=""                 # Git SHA or deploy release id

# Social promotions
SOCIAL_PROMOTION_ENABLED="true"
SOCIAL_PROMOTION_ALLOWED_NETWORKS="facebook,instagram,x,threads"
SOCIAL_PROMOTION_CHECK_CRON="0 */6 * * *"
SOCIAL_PROMOTION_BROWSER_ENABLED="false"   # backend web service

# Google OAuth (optional)
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
GOOGLE_CALLBACK_URL="http://localhost:3001/auth/google/callback"
```

### Mock payments for local QA

If you want to test ticket purchases, refunds, and promotion bonus reversals without Mercado Pago:

```bash
PAYMENTS_PROVIDER="mock"
MP_ACCESS_TOKEN=""
```

In that mode:

- `buyTickets` returns a local `initPoint` under `/checkout/mock/...`;
- the mock checkout page can approve/pending/reject the payment;
- full and partial refunds can be simulated from the mock page;
- `GET /mp/payment-status` continues to work for both real MP ids and `mock_pay_*` ids.

### Google OAuth Setup

To enable Google login:
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add redirect URI: `http://localhost:3001/auth/google/callback` (or production URL)
4. Copy Client ID and Secret to `.env`
5. In OAuth consent screen, add your email as Test user (required while app is in Testing mode)

On startup, check logs for:
- `✅ Google OAuth configured` - Success
- `⚠️ Google OAuth NOT configured` - Missing credentials

## API Endpoints

### GraphQL
- `POST /graphql` - Main API
- `WS /graphql` - Subscriptions

### REST (Webhooks & Sync)
- `POST /mp/webhook` - Mercado Pago webhooks
- `GET /mp/sync-payment/:paymentId` - Manual payment sync
- `GET /mp/payment-status?payment_id=X` - Payment status check
- `GET /social-promotions/track/:token` - Promotion click attribution redirect

### REST (MP Connect OAuth)
- `GET /mp/connect` - Start OAuth flow (requires auth)
- `GET /mp/connect/callback` - OAuth callback (public)
- `GET /mp/connect/status` - Get connection status (requires auth)
- `POST /mp/connect/disconnect` - Disconnect MP account (requires auth)

### Health Check
- `GET /health` - Full health check (database, version, uptime)
- `GET /health/ready` - Readiness probe for k8s
- `GET /health/live` - Liveness probe

## Social Worker

The `social-worker` is a separate process that runs in Docker/Render and should stay enabled alongside the backend.

Responsibilities:

- validate due social promotion posts;
- use Playwright fallback when simple HTML is not enough;
- persist metric snapshots;
- settle closed promotion posts and emit promotion bonuses.

Local Docker stack:

```bash
npm run docker:dev:build
docker compose -f docker-compose.dev.yml logs -f social-worker
```

## Mercado Pago Integration

### Checkout Preference Enrichment
The Checkout Pro preference sent to Mercado Pago includes additional buyer and industry context to improve approval quality for raffle-style purchases:

- `payer` data when available:
  - email, first name, last name;
  - identification type and number;
  - phone;
  - shipping address reference;
  - registration date;
  - authentication type (`Gmail` vs native web login);
  - first-purchase flag and last completed ticket purchase date.
- enriched item metadata:
  - `category_id: "lottery"`;
  - a checkout description that distinguishes random purchases from chosen-number purchases.

The checkout still goes to Mercado Pago as a single bundle item so the charged amount remains exactly aligned with the final LUK calculation, including discounts and chosen-number premium when applicable.

### Webhook Processing
1. Receives webhook at `POST /mp/webhook`
2. Parses payload (supports `type`, `topic`, `action` formats)
3. Records `MpEvent` for idempotency
4. On `approved` payment:
   - Updates tickets to `PAGADO`
   - Creates `Transaction` record
   - Triggers notifications

### Self-Healing Sync
When webhooks fail (no tunnel), the frontend calls `/mp/sync-payment/:paymentId` to manually sync payment status.

## Email Notifications

Emails are sent using [Brevo](https://brevo.com) via HTTP API (works on cloud platforms like Render).

### Styling
- **Source**: Email styles are defined inline within `src/notifications/notifications.service.ts`.
- **Palette**: Colors match the frontend `globals.css` (Teal/Amber/Warm White).
- **Fonts**: Emails use `DM Sans` (Body) and `Fraunces` (Headings) loaded via Google Fonts.

## Seller Dashboard & Buyer Experience

### Seller Dashboard Queries/Mutations
```graphql
# Get seller statistics (revenue, tickets sold, views, conversion rate, monthly chart data)
query { sellerDashboardStats { totalRevenue totalTicketsSold activeRaffles completedRaffles totalViews conversionRate monthlyRevenue { year month revenue ticketsSold } } }

# Cancel multiple raffles at once
mutation { bulkCancelRaffles(raffleIds: ["id1", "id2"]) { successCount failedCount errors } }

# Extend deadline for multiple raffles
mutation { bulkExtendRaffles(raffleIds: ["id1"], newDeadline: "2025-02-01T00:00:00Z") { successCount failedCount } }

# Increment view count (called when viewing raffle page)
mutation { incrementRaffleViews(raffleId: "...") }
```

### Buyer Experience Queries
```graphql
# Get buyer statistics (tickets, wins, win rate, total spent)
query { buyerStats { totalTicketsPurchased totalRafflesWon winRate totalSpent activeTickets favoritesCount } }

# Get personalized recommendations based on purchase history
query { recommendedRaffles(limit: 6) { id titulo precioPorTicket product { imagenes categoria } } }

# Get favorites that are ending soon (within 48 hours by default)
query { favoritesEndingSoon(hoursThreshold: 48) { id titulo fechaLimiteSorteo } }
```

### Price Alerts
```graphql
# Seller updates raffle price (triggers notifications if price dropped)
mutation { updateRafflePrice(raffleId: "...", newPrice: 100.00) { id precioPorTicket lastPriceDropAt } }
```

### Email Verification
```graphql
# Register returns user without tokens (requires verification)
mutation { register(input: {...}) { user { id } requiresVerification message } }

# Verify email with 6-digit code
mutation { verifyEmail(userId: "...", code: "123456") { token user { id emailVerified } } }

# Resend verification code (rate limited to 3 per hour)
mutation { resendVerificationCode(userId: "...") }
```

### Price History
```graphql
# Get price change history for a raffle
query { priceHistory(raffleId: "...") { id previousPrice newPrice changedAt percentChange } }
```

### KYC Verification
```graphql
# Submit/update KYC data (sellers must do this before creating raffles)
mutation { updateKyc(input: { documentType: DNI, documentNumber: "12345678", cuitCuil: "20-12345678-5", street: "Av. Corrientes", ... }) { id kycStatus } }
```

### Raffle Relaunch
```graphql
# Relaunch cancelled raffle with suggested price
mutation { relaunchRaffleWithSuggestedPrice(input: { originalRaffleId: "...", priceReductionId: "..." }) { id titulo precioPorTicket estado } }

# Optional: override suggested price
mutation { relaunchRaffleWithSuggestedPrice(input: { originalRaffleId: "...", priceReductionId: "...", customPrice: 150.00 }) { id } }
```

When a raffle is cancelled (<70% sold):
1. System calculates optimal price reduction
2. Creates `PriceReduction` record with `precioSugerido`
3. Sends email to seller with one-click relaunch button
4. Seller clicks button to instantly create new ACTIVA raffle with same product + suggested price

## Project Structure

```
src/
├── app.module.ts          # Root module
├── main.ts                # Entry point
├── common/
│   ├── constants/         # Fee rates, etc.
│   ├── decorators/        # @CurrentUser, @Public
│   ├── guards/            # JWT, Roles, Throttler
│   ├── events/            # Event emitter for decoupled architecture
│   ├── repositories/      # Repository pattern (BaseRepository + entity repos)
│   ├── utils/             # Encryption, full-text search utilities
│   ├── logger/            # Winston structured logging
│   └── scalars/           # DateTime, Decimal
├── auth/                  # Authentication
├── users/                 # User management
├── raffles/               # Core raffle logic
├── tickets/               # Ticket management
├── payments/              # MP integration
├── disputes/              # Dispute system
├── notifications/         # Email + in-app
├── uploads/               # Cloudinary
├── admin/                 # Admin features
├── tasks/                 # Cron jobs
└── prisma/                # DB client module

prisma/
├── schema.prisma          # Database schema
└── migrations/            # Database migrations
```

## Testing

### Running Tests

```bash
# Unit tests
npm run test              # Run all tests once
npm run test:watch       # Watch mode (re-run on changes)
npm run test:cov         # With coverage report (HTML at coverage/index.html)
npm run test:debug       # Debug mode with debugger

# Integration tests
npm run test:integration # Integration tests only (real database)

# All tests
npm run test:e2e         # E2E tests (from root)
```

### Test Infrastructure

The project uses **Jest** for unit/integration testing with pre-built utilities:

**Test Utilities** (`test/integration/setup.ts` and `test/integration/factories.ts`):
- `createTestApp()` - Complete NestJS application bootstrap for tests
- `cleanupTestApp()` - DB cleanup that respects model dependencies
- `generateTestToken(userId)` - JWT token generation for authenticated requests
- Factories: `createTestUser()`, `createTestSeller()`, `createTestRaffle()`, `createTestTicket()`, etc.

**Example Test Structure:**
```typescript
describe('AuthService', () => {
  let app: INestApplication;
  let authService: AuthService;

  beforeAll(async () => {
    app = await createTestApp();
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  it('should register a user', async () => {
    const user = await authService.register({ email: 'test@test.com', ... });
    expect(user.emailVerified).toBe(false);
  });
});
```

### Current Coverage

- **Overall:** 42%+ coverage with 770 passing tests across 49 spec files
- **Key modules tested:** auth, payments, raffles, tickets, disputes, notifications, users, and more

Run coverage report:
```bash
npm run test:cov
# Open coverage/lcov-report/index.html for detailed report
```

### Adding Tests

1. Create `.spec.ts` file next to the service/controller
2. Use test utilities from `test/integration/`
3. Import factories for test data
4. Run `npm run test:watch` while developing

See existing tests in `src/payments/` for examples.

## Admin Queries/Mutations

```graphql
# Get users with filters
query { adminUsers(filters: { role: USER, search: "email", onlyBanned: false }) { id email role isBanned deletedAt } }

# Get user activity log
query { adminUserActivity(userId: "...") { id action entityType entityId createdAt } }

# Ban/unban users
mutation { banUser(userId: "...", reason: "TOS violation") { id isBanned } }
mutation { unbanUser(userId: "...") { id isBanned } }

# Bulk resolve disputes
mutation { bulkResolveDisputes(disputeIds: ["..."], resolution: RESUELTA_COMPRADOR, justification: "...") { successCount failedCount } }
```

## Key Services

| Service | File | Purpose |
|---------|------|---------|
| AuthService | `src/auth/auth.service.ts` | Registration, login, email verification |
| RafflesService | `src/raffles/raffles.service.ts` | Core raffle CRUD, seller dashboard, buyer experience, price history |
| PaymentsService | `src/payments/payments.service.ts` | MP Checkout Pro, webhooks, payment sync |
| MpConnectService | `src/payments/mp-connect.service.ts` | OAuth flow with PKCE for seller onboarding |
| NotificationsService | `src/notifications/notifications.service.ts` | Email (Brevo) + in-app notifications + verification emails |
| ActivityService | `src/activity/activity.service.ts` | Audit logging for all actions |
| AdminService | `src/admin/admin.service.ts` | Admin-only operations |
| DisputesService | `src/disputes/disputes.service.ts` | Buyer protection workflow |
## Database Schema

The Prisma schema is at `prisma/schema.prisma`. Key models:

| Model | Purpose |
|-------|---------|
| User | Users with roles, MP connection status, email verification |
| Raffle | Raffles with state machine |
| Ticket | Ticket purchases with payment status |
| Product | Product details for raffles |
| Transaction | Payment records |
| Dispute | Buyer protection disputes |
| Notification | In-app notifications |
| ActivityLog | Audit trail |
| Category | Raffle categories |
| MpEvent | Webhook idempotency |
| RaffleQuestion | Questions asked by users on raffles |
| RaffleAnswer | Seller answers to questions |
| EmailVerificationCode | 6-digit codes for email verification (15 min expiry) |
| PriceHistory | Track price changes on raffles |

## PII Encryption

All personally identifiable information (KYC data) is encrypted at rest using AES-256-GCM:

**Encrypted fields:**
- Document number (DNI, Passport, etc)
- CUIT/CUIL (tax ID)
- Street address
- City, province, postal code
- Phone number
- Mercado Pago tokens

**Encryption Service:** `src/common/services/encryption.service.ts`

**How it works:**
1. When KYC data is submitted, all PII fields are encrypted before saving to database
2. When admin reviews KYC, data is decrypted on-the-fly for display
3. Data stored in DB is unreadable without the `ENCRYPTION_KEY`
4. Encryption auto-disables if `ENCRYPTION_KEY` is not set (development only)

**Important:**
- Use same `ENCRYPTION_KEY` across all deployments
- If key is lost, existing encrypted data cannot be recovered
- Generate with: `openssl rand -hex 32`

## Delayed Disbursement

Payments are held for 30 days using MP's `money_release_days` parameter:

```typescript
// In payments.service.ts
const preference = await this.mercadopago.preferences.create({
  body: {
    // ...
    marketplace_fee: platformFee,
    money_release_days: 30, // Buyer protection
  }
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT tokens (min 32 chars) |
| `PLATFORM_FEE_PERCENT` | Luk platform fee percentage applied to ticket sales |
| `MP_ACCESS_TOKEN` | Mercado Pago access token |
| `MP_CLIENT_ID` | MP OAuth Client ID (for MP Connect) |
| `MP_CLIENT_SECRET` | MP OAuth Client Secret |
| `BREVO_API_KEY` | Brevo email API key (must be REST API key `xkeysib-...`, not SMTP key) |
| `CLOUDINARY_*` | Cloudinary credentials |
| `FRONTEND_URL` | Frontend URL for redirects |
| `BACKEND_URL` | Backend URL for webhooks |
| `SENTRY_DSN` | Backend/worker Sentry DSN (optional) |
| `SENTRY_RELEASE` | Backend/worker release identifier (optional, recommended in prod/staging) |
| `ENCRYPTION_KEY` | **64 hex chars** - Encrypts PII: KYC data (DNI, CUIT, addresses, phone) + MP tokens using AES-256-GCM. Generate with: `openssl rand -hex 32` |

## Troubleshooting

```bash
# TypeScript errors after schema change
npx prisma generate

# Reset database
npx prisma db push --force-reset

# Check circular dependency issues
# Use forwardRef pattern (see Module Dependencies above)
```

### Google OAuth 401 invalid_client
This error means OAuth credentials are misconfigured in Google Cloud Console:
1. Verify redirect URI matches `GOOGLE_CALLBACK_URL` exactly (including http vs https)
2. Ensure Client ID and Secret are correct
3. If app is in "Testing" mode, add your email as a Test user
4. Check credentials haven't been deleted or regenerated

See the `Google OAuth Setup` section above for the full local setup flow.
