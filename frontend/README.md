# Raffle Platform - Frontend

Next.js 16 application with TypeScript, Tailwind CSS v4, and Shadcn/UI.

> **Full documentation**: See [CLAUDE.md](../CLAUDE.md) for business flows, API reference, and complete setup guide.
>
> **All commands**: See [COMMANDS.md](../COMMANDS.md) for Docker, testing, and development commands.

## Quick Start (Docker - Recommended)

```bash
# From project root - starts frontend, backend, postgres, redis
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
| `/raffle/[id]` | Raffle details + ticket purchase + public Q&A | Public |
| `/checkout/status` | Payment result handler | Public |
| `/auth/login` | Login (email + Google) | Public |
| `/auth/register` | Registration with email verification (two-step flow) | Public |
| `/dashboard/create` | Create new raffle | User |
| `/dashboard/tickets` | Buyer dashboard (stats, recommendations, favorites ending soon, tickets) | User |
| `/dashboard/sales` | Seller dashboard (revenue chart, analytics, bulk actions, CSV export) | User |
| `/dashboard/favorites` | Saved raffles wishlist (with price drop alerts) | User |
| `/dashboard/referrals` | Referral program dashboard | User |
| `/dashboard/settings` | Profile (Avatar), Payments (MP Connect), Security | User |
| `/seller/[id]` | Public seller profile | Public |
| `/admin` | Admin panel (stats, raffles, reports, user management) | Admin |
| `/admin/disputes` | Dispute management with bulk resolution | Admin |

## Environment

The frontend reads from `.env.local` (symlink to root `.env`):

```bash
NEXT_PUBLIC_GRAPHQL_URL="http://localhost:3001/graphql"
NEXT_PUBLIC_GRAPHQL_WS_URL="ws://localhost:3001/graphql"
NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
NEXT_PUBLIC_MP_PUBLIC_KEY="TEST-..."
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="..."
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
```

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

### Buyer Dashboard
Enhanced buyer panel at `/dashboard/tickets`:
- **Stats Overview** - Tickets purchased, raffles won, win rate, total spent
- **Personalized Recommendations** - Based on purchase history and favorites
- **Favorites Ending Soon** - Alert for favorited raffles ending within 48 hours
- **Advanced Filtering** - Filter by ticket status, raffle status, date range, wins only

### Referral Program
Referral dashboard at `/dashboard/referrals`:
- **Referral Code** - Unique code with copy button
- **Share Buttons** - WhatsApp, Twitter, copy link
- **Invited Users List** - Shows status and earnings per referral
- **Earnings Summary** - Total earned, available balance, pending credits
- Referrer earns 5% of referee's first ticket purchase

Registration accepts `?ref=CODE` query parameter to pre-fill referral code.


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

### Seller Onboarding
New sellers see a visual progress checklist at the top of their dashboard:
1. **Complete profile** - Name and phone number
2. **Connect Mercado Pago** - OAuth flow for payments
3. **Add shipping address** - Via KYC/verification tab
4. **Create first raffle** - Start selling

Checklist automatically hides when all steps are complete.

### Verified Seller Badge
Seller profile pages show verification status:
- Green "Vendedor Verificado" badge with checkmark icon for KYC-verified sellers
- Badge appears next to seller name on `/seller/[id]` page

## E2E Testing

```bash
# Install browsers (first time)
npx playwright install

# Run tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run headed (see browser)
npm run test:e2e:headed
```

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
