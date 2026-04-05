# LUK - Frontend

Next.js 16 application with TypeScript, Tailwind CSS v4, and Shadcn/UI.

> **Project guide**: See [AGENTS.md](../AGENTS.md) for shared project context, [COMMANDS.md](../COMMANDS.md) for root-level workflows, and [docs/domain-flows.md](../docs/domain-flows.md) for business lifecycle flows.

## Quick Start (Docker - Recommended)

```bash
# From project root - starts frontend, backend, redis and social-worker
npm run docker:dev:build    # First time
npm run docker:dev          # Subsequent runs
```

Frontend available at http://localhost:3000

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS v4 + Shadcn/UI (Radix)
- **State**: Zustand (auth, theme) + Apollo Client (GraphQL)
- **Analytics**: Google Analytics 4
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts

## Quick Start (Local)

Requires Node.js 22 (`nvm use` from root).

```bash
npm install
npm run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test:e2e` | Run Playwright tests |

## Pages

| Route | Description | Auth |
|-------|-------------|------|
| `/` | Home with featured raffles | Public |
| `/search` | Search and filter raffles | Public |
| `/raffle/[id]` | Raffle details + ticket purchase + random pack incentive + public Q&A | Public |
| `/checkout/mock/[mockPaymentId]` | Local QA checkout used when `PAYMENTS_PROVIDER=mock` | Public |
| `/checkout/status` | Payment result handler | Public |
| `/auth/login` | Login (email + Google) with inline email verification and 2FA continuation | Public |
| `/auth/register` | Registration with email verification (two-step flow) | Public |
| `/dashboard/create` | Create new raffle | User |
| `/dashboard/tickets` | Buyer dashboard (stats, recommendations, favorites ending soon, tickets) | User |
| `/dashboard/sales` | Seller dashboard (revenue chart, analytics, bulk actions, CSV export) | User |
| `/dashboard/favorites` | Saved raffles wishlist (with price drop alerts) | User |
| `/dashboard/settings` | Profile (Avatar), Payments (MP Connect), Security, and 2FA management | User |
| `/seller/[id]` | Public seller profile | Public |
| `/admin` | Admin panel (stats, raffles, reports, user management) | Admin |
| `/admin/disputes` | Dispute management with bulk resolution | Admin |

## Environment

The frontend reads from `.env.local` (symlink to root `.env`):

```bash
NEXT_PUBLIC_GRAPHQL_URL="http://localhost:3001/graphql"
NEXT_PUBLIC_GRAPHQL_WS_URL="ws://localhost:3001/graphql"
NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_TURNSTILE_ENABLED="false"
NEXT_PUBLIC_TURNSTILE_SITE_KEY=""   # Public site key
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
NEXT_PUBLIC_SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_RELEASE=""
SENTRY_DSN=""
SENTRY_RELEASE=""
```

If the backend runs with `PAYMENTS_PROVIDER="mock"`, purchases redirect to the local mock checkout page instead of Mercado Pago. This is useful for QA of ticket confirmation, refunds, and promotion bonus reversals without a real PSP.

Keep the Sentry DSNs empty in local development if you do not want browser/server events sent from your machine.

Turnstile is optional in local/dev. When `NEXT_PUBLIC_TURNSTILE_ENABLED="true"`, the frontend requires `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. The site key is public and must never be confused with the backend secret key.

Real Turnstile keys require a widget configured with a real or stable hostname in Cloudflare. Until LUK has a real domain or at least a staging hostname, keep Turnstile disabled in normal local development or use Cloudflare test keys only for local QA.

## Project Structure

```
src/
├── app/                    # Pages (App Router)
│   ├── (auth)/             # Auth pages
│   ├── admin/              # Admin panel
│   ├── checkout/           # Payment flow
│   ├── dashboard/          # User dashboard
│   ├── raffle/             # Raffle details
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # Shadcn/UI components
│   ├── ErrorBoundary.tsx   # Error handling
│   ├── ImageUpload.tsx     # Cloudinary upload
│   └── ...
├── lib/
│   ├── apollo-client.ts    # Apollo setup
│   ├── auth-store.ts       # Zustand auth store
│   ├── error-handler.ts    # Centralized error handling
│   └── graphql/            # Queries & mutations
└── hooks/                  # Custom React hooks

e2e/                        # Playwright tests
├── auth.spec.ts
└── raffle.spec.ts
```

## Key Features

### Dark Mode
Theme toggle in navbar with three options:
- **Claro** (Light) - Light theme
- **Oscuro** (Dark) - Dark theme
- **Sistema** (System) - Follows OS preference

Theme persists in localStorage (`theme-storage`). CSS variables defined in `globals.css` with OKLCH color space.

### Social Sharing
Raffle pages have share buttons for:
- WhatsApp, Facebook, Twitter/X, LinkedIn, Telegram
- Copy link fallback

No API keys needed - uses public share URLs. Includes Argentine-friendly share message.

**Open Graph Meta Tags:**
Raffle detail pages generate dynamic Open Graph meta tags server-side using Next.js `generateMetadata`. When sharing a raffle link on social media, the preview shows:
- Title: Raffle title (e.g., "iPhone 15 Pro - Rifa")
- Description: Raffle description (truncated to 160 chars)
- Image: First product image

The page uses a server/client component split:
- `page.tsx` - Server component that generates metadata and renders the client component
- `raffle-content.tsx` - Client component with interactive UI (buy tickets, favorites, etc.)

### Seller Social Promotions

The seller flow now includes a dedicated `Promocionar y medir` action:

- available to the raffle owner;
- generates a promotion draft with `trackingUrl` and `promotionToken`;
- lets the seller submit a public permalink from `Facebook`, `Instagram` or `X`;
- shows stored promotion status and visible metrics in `/dashboard/sales`;
- supports a generated social asset and caption flow, including image selection, for visual networks.

Implementation details:

- seller CTA on raffle detail remains compact;
- detailed post summaries live only in the seller dashboard;
- generated promo assets are served from `GET /api/social-promotions/instagram-asset`.

### Responsive Design
- Mobile-first approach with Tailwind breakpoints
- Forms stack on mobile, grid on desktop
- Tables convert to card layout on mobile
- Touch-friendly targets (48x48px minimum)

### Skeleton Loading
Pre-built skeleton components for loading states:
- `RaffleCardSkeleton` - Raffle cards
- `RaffleGridSkeleton` - Grid of cards
- `TableSkeleton` - Data tables
- `RaffleDetailSkeleton` - Full page skeleton

### Error Handling
Centralized error handler with toast notifications:
```typescript
import { handleError, showSuccess } from '@/lib/error-handler';

try {
  await doSomething();
  showSuccess('Done!');
} catch (error) {
  handleError(error);
}
```

### MP Connect (Seller Onboarding)
Sellers must connect their Mercado Pago account before creating raffles:
1. Go to Settings → Payments tab
2. Click "Connect Mercado Pago"
3. Authorize on MP website
4. Redirected back with success/error message

### Payment Flow
1. User selects tickets on `/raffle/[id]`
2. Backend creates MP preference
3. User redirected to Mercado Pago
4. After payment, redirected to `/checkout/status`
5. Page auto-syncs payment status with backend

### Random Pack Incentive

The raffle detail page applies a global incentive for random purchases:

- buy `5`, receive `6`;
- buy `10`, receive `12`.

UI behavior:

- only applies in `RANDOM` mode;
- the summary shows paid tickets, bonus tickets, gross subtotal, Luk subsidy, and total charged;
- the seller still gets paid on the gross emitted-ticket value;
- it does not stack with the social-promotion bonus selector;
- if the pack cannot be completed because of remaining stock or the buyer cap, the UI falls back to a normal purchase summary and explains why.

### Search & Filters
- Category filter with backend categories
- Sorting: Price (asc/desc), End Date (asc/desc), Creation Date (asc/desc)
- Price range slider with debounced updates
- All filters are combinable
- **Infinite Scroll**: Intersection Observer loads more results automatically
- **Full-text Search**: Backend PostgreSQL GIN indexes with Spanish language support

### Real-time
- GraphQL subscriptions for notifications
- Automatic fallback to polling if WebSocket fails

### Performance
- **GraphQL Query Batching**: Multiple queries combined into single request (BatchHttpLink)
- **Infinite Scroll**: Reduces initial load, fetches more on scroll
- **Skeleton Loading**: Immediate visual feedback while data loads

### Accessibility
- Keyboard navigation (Tab, Escape, Enter)
- ARIA attributes on interactive elements
- Focus trapping in modals
- Screen reader friendly labels

### Seller Dashboard
Enhanced seller panel at `/dashboard/sales`:
- **Onboarding Checklist** - Progress tracker for new sellers (profile, MP Connect, address, first raffle)
- **Revenue Chart** - Monthly earnings visualization with Recharts
- **Analytics Cards** - Total revenue, tickets sold, views, conversion rate
- **Bulk Actions** - Cancel or extend multiple raffles at once
- **Per-Raffle Stats** - Views and conversion rate per raffle
- **CSV Export** - Includes analytics data
- **Social Promotion Panel** - Seller-only promotion CTA, registered posts, public metrics snapshots

### Buyer Dashboard
Enhanced buyer panel at `/dashboard/tickets`:
- **Stats Overview** - Tickets purchased, raffles won, win rate, total spent
- **Personalized Recommendations** - Based on purchase history and favorites
- **Favorites Ending Soon** - Alert for favorited raffles ending within 48 hours
- **Advanced Filtering** - Filter by ticket status, raffle status, date range, wins only

### Profile Avatar
Users can upload, update, and remove their profile avatar via `/dashboard/settings`.
- **Integration**: Cloudinary (optimized serving via auto-format/quality)
- **Validation**: 5MB limit, image formats only
- **Display**: Shown in navbar, Q&A section, and seller profiles

### Q&A System
Public question and answer system on each raffle page:
- **Questions**: Authenticated users can ask public questions
- **Answers**: Only the raffle seller can answer
- **Visibility**: Visible to all users (public)

### Price Drop Alerts
When a seller reduces a raffle price:
- **Favorites Page** - Shows "Precio reducido" badge with TrendingDown icon
- **Raffle Cards** - Display "Rebajado" badge for price drops within 48 hours
- **Notifications** - Email and in-app alerts sent to users who favorited the raffle

### Price History
Raffle detail pages show price change history:
- Original price vs current price comparison
- Percentage discount calculation
- Expandable list of all price changes with timestamps

### Email Verification
Two-step registration flow:
1. **Step 1**: User fills registration form (email, password, confirm password, name, birth date)
2. **Step 2**: User enters 6-digit verification code sent to email
- Code expires in 15 minutes
- Maximum 3 attempts per code
- Resend option with rate limiting (max 3 codes per hour)

If a user tries to log in before verifying the email, the login page resumes the same verification step inline instead of forcing the user back through registration.

### Two-Factor Authentication
- TOTP-based 2FA with authenticator apps
- Inline login continuation when the backend returns a 2FA challenge
- Recovery codes generated at activation time
- Activation and deactivation available in `Settings -> Security`
- The long manual key shown during setup is only for adding the account to an authenticator app when QR scanning is not available; it is not a recovery code
- Recovery codes are shown only after 2FA activation succeeds and are displayed once, so they must be stored immediately

### Seller Onboarding
New sellers see a visual progress checklist at the top of their dashboard:
1. **Complete profile** - Name and phone number
2. **Connect Mercado Pago** - OAuth flow for payments
3. **Verify identity (KYC)** - Submit identity documents and address; admin approval required
4. **Add shipping address** - Full address details
5. **Create first raffle** - Start selling

Checklist automatically hides when all steps are complete.

**Important:** Sellers CANNOT create raffles without verified KYC status. After submitting KYC documents, they must wait for admin approval.

### Verified Seller Badge
Seller profile pages show verification status:
- Green "Vendedor Verificado" badge with checkmark icon for KYC-verified sellers
- Badge appears next to seller name on `/seller/[id]` page

### Raffle Relaunch Feature
When a raffle is cancelled due to insufficient ticket sales (<70%):
1. **Automatic Suggestion**: System calculates optimal price reduction based on sales performance
2. **Email Notification**: Seller receives email with:
   - Current statistics (percentage sold, original price)
   - Suggested new price with discount percentage
   - One-click "Relanzar Rifa" button
3. **One-Click Relaunch**: Clicking button opens seller dashboard with relaunch confirmation modal
4. **New Raffle Created**: Instant creation with same product data and suggested price
5. **Original Raffle**: Remains in CANCELADA status for audit trail

This feature encourages sellers to retry with better pricing and helps maximize platform usage.

## Testing & E2E

### E2E Tests (Playwright)

```bash
# Install browsers (first time only)
npx playwright install

# Run tests
npm run test:e2e              # Headless - all tests
npm run test:e2e:ui          # Interactive Playwright UI
npm run test:e2e:headed      # Visible browser while running

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Debug mode
npx playwright test --debug
```

**Requirements:**
- Backend must be running (`npm run docker:dev` or `npm run start:dev` from backend folder)
- Playwright auto-starts the dev server in local development

### Current E2E Tests

**174 E2E tests** across 17 spec files in `e2e/`:

- **auth.spec.ts** - Login/register pages, authentication flow, protected routes
- **raffle.spec.ts** - Homepage, search, raffle details, ticket purchase
- **dashboard-*.spec.ts** - All dashboard pages (favorites, settings, sales, messages, etc.)
- **admin-disputes.spec.ts** - Admin dispute management
- **email-verification.spec.ts** - Email verification flow
- **kyc-submission.spec.ts** - KYC verification
- **legal-pages.spec.ts** - Terms of Service, Privacy Policy
- **social-sharing.spec.ts** - Social media sharing
- And more...

**Auth helper:** Tests use `apiLogin()` from `e2e/helpers/auth.ts` which authenticates via direct GraphQL API call and injects tokens into Zustand's localStorage format. This bypasses the browser login UI for reliability in CI.

### Component Tests (Vitest)

**50 component tests** across 7 test files:

```bash
npm run test:unit         # Run component tests
npm run test:unit:ui      # Interactive UI mode
npm run test:unit -- --coverage  # With coverage (80%+)
```

Tested components: ImageUpload, RaffleCard, SearchFilters, DisputeDialog, ShareButtons, NotificationsBell, Navbar

### CI/CD Notes

E2E tests run in CI on Chromium only (4 workers, 1 retry). Most auth-dependent tests work via `apiLogin()` (API-based login). Some tests are skipped in CI:

- **Admin disputes** (14 tests) — Admin page query fails in CI environment; needs investigation with Playwright trace artifacts
- **KYC submission** (9 tests) — Settings page `GET_USER_DATA` query fires before Zustand hydrates auth token, causing `kycStatus` to default to `NOT_SUBMITTED`
- **Email verification** (7 tests) — Requires real Brevo email service or active verification sessions
- **Auth UI login** (4 tests) — Browser-based login form unreliable in CI; API-based `apiLogin()` used instead
- **Dashboard sales** (2 tests) — Cross-origin "Failed to fetch" between frontend (:3000) and backend (:3001) in CI
- **Raffle browsing** (1 test) — Search query loading too slow in CI with seeded data

**CI result:** ~137 passed, ~37 skipped, 0 failed.

### Adding E2E Tests

Example Playwright test:

```typescript
import { test, expect } from '@playwright/test';

test('should create a raffle', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/auth/login');
  await page.fill('[name="email"]', 'seller@test.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button:has-text("Login")');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard/**');

  // Create raffle
  await page.click('a:has-text("Create Raffle")');
  await page.fill('[name="title"]', 'iPhone 15');
  await page.click('button:has-text("Create")');

  // Verify success
  await expect(page).toHaveURL(/\/raffle\//);
});
```

### Best Practices

1. **Use meaningful selectors** - Prefer `role`, `label`, or `data-testid` over generic selectors
2. **Wait for elements** - Use `waitForURL()`, `waitForSelector()`, or `waitForFunction()`
3. **Test user flows** - Write tests from the user's perspective
4. **Keep tests isolated** - Each test should be independent
5. **Use fixtures** - Create test data helpers for setup/teardown

### Performance Notes

- Playwright runs tests in parallel by default (4 workers)
- Test runs take ~2-3 minutes total
- Disable parallelization with `--workers=1` if debugging specific test interactions

## Local Dev Notes

- Mercado Pago cannot redirect to `localhost`. For full payment testing, use ngrok tunnel for frontend and update `FRONTEND_URL` in root `.env`
- If MP "Pagar" button is disabled, try disabling ad blockers or use incognito mode

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/apollo-client.ts` | Apollo Client (HTTP + WebSocket) |
| `src/store/auth.ts` | Zustand auth store |
| `src/store/theme.ts` | Theme store (dark/light/system) |
| `src/lib/error-handler.ts` | Centralized error handling |
| `src/components/ui/` | Shadcn/UI components |
| `src/components/ui/progress.tsx` | Progress bar component |
| `src/app/auth/register/page.tsx` | Two-step registration with email verification |
| `src/app/dashboard/sales/page.tsx` | Seller dashboard with onboarding checklist |
| `src/app/seller/[id]/page.tsx` | Public seller profile with verified badge |
| `src/app/raffle/[id]/raffle-content.tsx` | Raffle detail with price history |

## Patterns

```typescript
// State: Zustand with persistence
const { user, token } = useAuthStore();

// GraphQL: Apollo hooks
const { data, loading } = useQuery(GET_RAFFLES);
const [createRaffle] = useMutation(CREATE_RAFFLE);

// Forms: React Hook Form + Zod
const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) });

// Toasts: Sonner
toast.success('Saved!');
toast.error('Error occurred');
```
