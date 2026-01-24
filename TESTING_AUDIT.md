# Testing Audit - Remaining Work

## Executive Summary

**Current Coverage:** 28% backend (~452 tests), 61 frontend E2E tests
**Target Coverage:** 65% backend, 100+ frontend E2E tests, 30+ component tests

**Completed:** ✅ ALL CRITICAL + ALL HIGH priority items (266 tests)
**Remaining:** 43 backend files + 15 frontend flows + component test setup

---

## What's LEFT To Do

### 🔴 CRITICAL Priority - Implement Immediately

#### Backend Services (8 files, ~130 tests)

1. **`src/tasks/raffle-tasks.service.spec.ts`** (15 tests)
   - Auto-draw raffles (70%+ tickets)
   - Auto-cancel raffles (<70% tickets)
   - Auto-release payouts after 7 days
   - Notification sending
   - Edge cases: exactly 70%, concurrent draws

2. **`src/tasks/dispute-tasks.service.spec.ts`** (7 tests)
   - Auto-escalate disputes after 48h
   - Auto-refund after 15 days
   - Notification workflows

3. **`src/notifications/notifications.service.spec.ts`** (28 tests)
   - Email verification codes
   - Payment notifications (approved/pending/rejected)
   - Raffle drawn notifications
   - Dispute notifications
   - Price drop alerts
   - KYC notifications
   - Payout notifications

4. **`src/tickets/tickets.service.spec.ts`** (12 tests)
   - buyTickets() - Serializable transaction + pessimistic locking
   - Race condition handling
   - 50% max per user enforcement
   - Refund processing

5. **`src/payouts/payouts.service.spec.ts`** (15 tests)
   - Fee calculations (platform 4%, MP ~5%)
   - processPayout() - MP API fund release
   - schedulePayoutAfterDelivery()
   - Manual release by admin

6. **`src/common/guards/login-throttler.service.spec.ts`** (10 tests)
   - Rate limiting (5 attempts in 15 min)
   - Brute-force prevention
   - Reset after cooldown

#### Backend Controllers (2 files, ~22 tests)

7. **`src/payments/mp-connect.controller.spec.ts`** (12 tests)
   - OAuth flow with PKCE
   - Callback handling (success/error)
   - CSRF protection (state parameter)
   - Token encryption before storage
   - Connection status

8. **`src/auth/auth-google.controller.spec.ts`** (10 tests)
   - Google OAuth callback
   - Cookie settings (httpOnly, sameSite, secure)
   - Token refresh with rotation
   - Logout flow

#### Backend Resolvers - Integration Tests (2 files, ~30 tests)

9. **`src/raffles/raffles.resolver.spec.ts`** (15 tests)
   - createRaffle() - Requires KYC + MP Connect
   - updateRaffle() - Owner only
   - drawRaffle() - Manual draw
   - searchRaffles() - Filters
   - Auth guards on mutations

10. **`src/admin/admin.resolver.spec.ts`** (15 tests)
    - banUser() - Admin only
    - approveKyc() / rejectKyc()
    - bulkResolveDisputes()
    - platformStats()
    - Role guards on all operations

#### Frontend E2E (3 files, ~31 tests)

11. **`frontend/e2e/email-verification.spec.ts`** (8 tests)
    - Correct code → auto login
    - Wrong code → error
    - Expired code (15 min) → resend
    - Max 3 attempts enforcement
    - Referral code application

12. **`frontend/e2e/kyc-submission.spec.ts`** (10 tests)
    - Fill KYC form → pending status
    - Validation errors (missing fields, invalid DNI)
    - Admin approval → can create raffles
    - Admin rejection → error message
    - Document upload

13. **`frontend/e2e/admin-disputes.spec.ts`** (13 tests)
    - View pending disputes
    - Filter by status/type
    - Resolve in buyer's favor → refund
    - Resolve in seller's favor → payout
    - Partial resolution
    - Bulk operations

**Estimated:** 160 tests, 28% → 45% coverage, ~30 hours

---

### 🟠 HIGH Priority - Sprint 2

#### Backend Services (6 files, ~72 tests)

1. **`src/users/reputation.service.spec.ts`** (12 tests)
   - Seller level progression (NUEVO → BRONCE → PLATA → ORO)
   - Reputation calculations
   - Max active raffles enforcement

2. **`src/messaging/messaging.service.spec.ts`** (15 tests)
   - Send message (buyer-seller only)
   - Conversation management
   - Message notifications

3. **`src/audit/audit.service.spec.ts`** (10 tests)
   - Log admin actions
   - Query audit trail
   - PII masking in logs

4. **`src/activity/activity.service.spec.ts`** (15 tests)
   - Track user activity
   - Query activity logs
   - Activity analytics

5. **`src/questions/questions.service.spec.ts`** (10 tests)
   - Ask question on raffle
   - Answer question (seller only)
   - Public visibility

6. **`src/tasks/cleanup-tasks.service.spec.ts`** (10 tests)
   - Delete expired verification codes
   - Clean orphaned reservations
   - Archive old notifications

#### Backend Resolvers (5 files, ~35 tests)

7. **`src/payouts/payouts.resolver.spec.ts`** (7 tests)
8. **`src/shipping/shipping.resolver.spec.ts`** (7 tests)
9. **`src/reports/reports.resolver.spec.ts`** (7 tests)
10. **`src/questions/questions.resolver.spec.ts`** (7 tests)
11. **`src/messaging/messaging.resolver.spec.ts`** (7 tests)

#### Backend Controllers (1 file, ~8 tests)

12. **`src/uploads/uploads.controller.spec.ts`** (8 tests)
    - Cloudinary signature generation
    - Avatar upload signature
    - Raffle image signature

#### Frontend E2E (5 files, ~40 tests)

13. **`frontend/e2e/dashboard-messages.spec.ts`** (8 tests)
14. **`frontend/e2e/dashboard-payouts.spec.ts`** (8 tests)
15. **`frontend/e2e/dashboard-shipping.spec.ts`** (8 tests)
16. **`frontend/e2e/dashboard-referrals.spec.ts`** (8 tests)
17. **`frontend/e2e/dashboard-sales.spec.ts`** (8 tests)

**Estimated:** 155 tests, 45% → 55% coverage, ~25 hours

---

### 🟡 MEDIUM Priority - Sprint 3

#### Backend Services (10 files, ~60 tests)

- `src/categories/categories.service.spec.ts` (6 tests)
- `src/favorites/favorites.service.spec.ts` (6 tests)
- `src/shipping/shipping.service.spec.ts` (6 tests)
- `src/reports/reports.service.spec.ts` (6 tests)
- `src/price-history/price-history.service.spec.ts` (6 tests)
- `src/price-reduction/price-reduction.service.spec.ts` (6 tests)
- `src/draw-result/draw-result.service.spec.ts` (6 tests)
- `src/reviews/reviews.service.spec.ts` (6 tests)
- `src/users/users.service.spec.ts` (6 tests)
- `src/notifications/subscriptions.service.spec.ts` (6 tests)

#### Backend Resolvers (1 file, ~6 tests)

- `src/audit/audit.resolver.spec.ts` (6 tests)

#### Frontend - Setup Unit Testing (1-2 days)

**Files to create:**
- `frontend/vitest.config.ts`
- `frontend/src/test/setup.ts`
- `frontend/package.json` - Add Vitest dependencies

**Dependencies:**
```bash
npm install -D vitest @vitejs/plugin-react jsdom
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @vitest/ui
```

**NPM Script:**
```json
"scripts": {
  "test:unit": "vitest",
  "test:unit:ui": "vitest --ui"
}
```

#### Frontend - Component Tests (10 files, ~50 tests)

- `src/components/__tests__/ImageUpload.test.tsx` (5 tests)
- `src/components/__tests__/RaffleCard.test.tsx` (5 tests)
- `src/components/__tests__/SearchFilters.test.tsx` (5 tests)
- `src/components/__tests__/DisputeDialog.test.tsx` (5 tests)
- `src/components/__tests__/ShareButtons.test.tsx` (5 tests)
- `src/components/__tests__/NotificationsBell.test.tsx` (5 tests)
- `src/components/__tests__/Navbar.test.tsx` (5 tests)
- `src/components/__tests__/FeaturedRaffles.test.tsx` (5 tests)
- `src/components/__tests__/HeroCTA.test.tsx` (5 tests)
- `src/components/__tests__/ThemeToggle.test.tsx` (5 tests)

#### Frontend E2E (4 files, ~30 tests)

- `frontend/e2e/dashboard-favorites.spec.ts` (8 tests)
- `frontend/e2e/dashboard-settings.spec.ts` (8 tests)
- `frontend/e2e/seller-profile.spec.ts` (7 tests)
- `frontend/e2e/search-filters.spec.ts` (7 tests)

**Estimated:** 146 tests, 55% → 65% coverage, ~20 hours

---

### 🟢 LOW Priority - Sprint 4+

#### Backend Controllers (2 files, ~8 tests)

- `src/health/health.controller.spec.ts` (4 tests)
- `src/prisma/prisma.service.spec.ts` (4 tests)

#### Frontend E2E (2 files, ~10 tests)

- `frontend/e2e/legal-pages.spec.ts` (5 tests) - Terms, Privacy
- `frontend/e2e/social-sharing.spec.ts` (5 tests)

#### CI/CD Improvements

**Add to `.github/workflows/ci.yml`:**
```yaml
- name: Enforce minimum coverage
  run: npm run test:cov
  env:
    JEST_COVERAGE_THRESHOLD: 50
```

**Add to `.husky/pre-push`:**
```bash
# Run backend tests
cd backend && npm run test -- --bail --findRelatedTests
```

#### Multi-browser Testing

**Update `frontend/playwright.config.ts`:**
```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
]
```

**Estimated:** 18 tests + CI improvements, ~8 hours

---

## Implementation Roadmap

### Sprint 1 (CRITICAL) - 3-4 days
- **Backend:** raffle-tasks, dispute-tasks, notifications, tickets, payouts, login-throttler
- **Controllers:** mp-connect, auth-google
- **Resolvers:** raffles, admin
- **Frontend E2E:** email-verification, kyc-submission, admin-disputes
- **Result:** 160 tests, 28% → 45% coverage

### Sprint 2 (HIGH) - 2-3 days
- **Backend:** reputation, messaging, audit, activity, questions, cleanup-tasks
- **Resolvers:** payouts, shipping, reports, questions, messaging
- **Controllers:** uploads
- **Frontend E2E:** 5 dashboard pages
- **Result:** 155 tests, 45% → 55% coverage

### Sprint 3 (MEDIUM) - 2-3 days
- **Backend:** 10 remaining services + audit resolver
- **Frontend:** Vitest setup + 10 component tests + 4 E2E flows
- **Result:** 146 tests, 55% → 65% coverage

### Sprint 4+ (LOW) - 1 day
- **Backend:** health, prisma controllers
- **Frontend:** legal pages, social sharing E2E
- **CI/CD:** Coverage enforcement, pre-push tests, multi-browser
- **Result:** 18 tests + CI improvements, 65%+ coverage

---

## Total Remaining Work

| Priority | Tests | Files | Hours | Coverage Gain |
|----------|-------|-------|-------|---------------|
| CRITICAL | 160 | 13 | 30 | +17% (→ 45%) |
| HIGH | 155 | 17 | 25 | +10% (→ 55%) |
| MEDIUM | 146 | 25 | 20 | +10% (→ 65%) |
| LOW | 18 | 6 | 8 | +2% (→ 67%) |
| **TOTAL** | **479** | **61** | **83 hrs** | **+39%** |

---

## Quick Start

### Run Existing Tests

```bash
# Backend unit tests
cd backend && npm run test

# Backend with coverage
cd backend && npm run test:cov
# Open coverage/index.html

# Backend integration tests
cd backend && npm run test:integration

# Frontend E2E tests
cd frontend && npm run test:e2e
```

### Start Sprint 1 (CRITICAL)

**Day 1: Task Services**
1. Create `backend/src/tasks/raffle-tasks.service.spec.ts`
2. Create `backend/src/tasks/dispute-tasks.service.spec.ts`
3. Run: `npm run test raffle-tasks`

**Day 2: Core Services**
1. Create `backend/src/notifications/notifications.service.spec.ts`
2. Create `backend/src/tickets/tickets.service.spec.ts`
3. Create `backend/src/payouts/payouts.service.spec.ts`

**Day 3: Security & OAuth**
1. Create `backend/src/common/guards/login-throttler.service.spec.ts`
2. Create `backend/src/payments/mp-connect.controller.spec.ts`
3. Create `backend/src/auth/auth-google.controller.spec.ts`

**Day 4: Resolvers (Integration)**
1. Create `backend/src/raffles/raffles.resolver.spec.ts`
2. Create `backend/src/admin/admin.resolver.spec.ts`
3. Run: `npm run test:integration`

**Day 5: Frontend E2E**
1. Create `frontend/e2e/helpers/graphql.ts`
2. Create `frontend/e2e/email-verification.spec.ts`
3. Create `frontend/e2e/kyc-submission.spec.ts`
4. Create `frontend/e2e/admin-disputes.spec.ts`
5. Run: `npm run test:e2e`

---

## Test Patterns Reference

### Backend Unit Test (Mocked Dependencies)
```typescript
describe('MyService', () => {
  let service: MyService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MyService,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();
    service = module.get(MyService);
  });

  it('should do something', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(testUser);
    const result = await service.method();
    expect(result).toBeDefined();
  });
});
```

### Backend Integration Test (Real Database)
```typescript
describe('MyResolver (Integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await cleanupTestApp(ctx);
  }, 30000);

  it('should query data', async () => {
    const user = await createTestUser(ctx.prisma);
    const token = generateTestToken(ctx, user);

    const response = await request(ctx.app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: '{ me { id } }' });

    expect(response.body.data.me.id).toBe(user.id);
  });
});
```

### Frontend E2E Test
```typescript
test('user can login', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/contraseña/i).fill('Password123!');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
});
```

### Frontend Component Test (Vitest)
```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

test('renders button', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

---

## Success Criteria

### Sprint 1 Complete When:
- ✅ All 160 new tests pass
- ✅ Backend coverage 28% → 45%
- ✅ No regressions in existing 452 tests
- ✅ CI/CD passes
- ✅ Email verification, KYC, disputes E2E work

### Sprint 2 Complete When:
- ✅ All 155 new tests pass
- ✅ Backend coverage 45% → 55%
- ✅ 5 dashboard pages have E2E coverage
- ✅ CI/CD passes

### Sprint 3 Complete When:
- ✅ All 146 new tests pass
- ✅ Backend coverage 55% → 65%
- ✅ Vitest configured and working
- ✅ 10 components tested
- ✅ CI/CD passes

---

## Notes

- **Existing factories:** Use `createTestUser()`, `createTestSeller()`, `createTestRaffle()`, `createTestTickets()` from `backend/test/integration/factories.ts`
- **Test utilities:** Use `createTestApp()`, `cleanupTestApp()`, `generateTestToken()` from `backend/test/integration/setup.ts`
- **Mocking:** Mock external services (Resend, Cloudinary, Mercado Pago) in unit tests
- **Integration tests:** Use real database with factories, test GraphQL endpoints with supertest
- **E2E tests:** Use Playwright, follow `loginAs()` pattern, create GraphQL helpers for test data
