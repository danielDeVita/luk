# Testing Audit Plan - Raffle Marketplace

## Executive Summary

Complete audit of current testing state in frontend and backend, documenting coverage, identifying critical gaps, and proposing improvement plan with priorities.

**Key Finding:** The project has **excellent testing infrastructure** but **very low coverage**:
- Backend: ~5% unit test coverage (payments module only)
- Frontend: 0% unit/component tests (E2E only with Playwright)
- CI/CD: Tests integrated but no minimum coverage enforcement

---

## Current Testing State

### Backend (NestJS + Jest)

#### Existing Tests (6 files)

**Unit Tests (3 files):**
1. ✅ `src/payments/payments.service.spec.ts` - 426 lines, **very complete**
   - handlePaymentApproved (6 tests)
   - handleMpWebhook (3 tests)
   - syncPaymentStatus (3 tests)
   - isEventProcessed (2 tests)
   - calculateCommissions (1 test)
   - getMpClient error handling (1 test)

2. ✅ `src/payments/mp.controller.spec.ts` - 298 lines, **very complete**
   - Webhook handler tests
   - Error scenarios
   - Idempotency verification

3. ⚠️ `src/app.controller.spec.ts` - Basic boilerplate

**Integration Tests (2 files):**
1. ✅ `test/integration/raffle-draw.integration.spec.ts` - 324 lines
   - Complete raffle draw flow
   - Winner selection
   - Notifications
   - State transitions

2. ✅ `test/integration/ticket-purchase.integration.spec.ts` - 323 lines
   - Ticket reservation
   - Payment flow
   - Transaction creation

**E2E Tests (1 file):**
1. ⚠️ `test/app.e2e-spec.ts` - Basic boilerplate

#### Testing Infrastructure

**Configuration:**
- ✅ Jest configured (`package.json` + `test/jest-e2e.json`)
- ✅ Coverage reporting (HTML, LCOV, Clover, JSON)
- ✅ Test utilities (`test/integration/setup.ts`, `factories.ts`)

**Available Utilities:**
- `createTestApp()` - Complete NestJS bootstrap
- `cleanupTestApp()` - DB cleanup in dependency order
- `generateTestToken()` - JWT generation for authenticated tests
- `createTestUser()`, `createTestSeller()`, `createTestRaffle()`, etc. - Factories

**NPM Scripts:**
```bash
npm run test              # Unit tests
npm run test:watch        # Watch mode
npm run test:cov          # With coverage report
npm run test:debug        # Debug mode
npm run test:e2e          # E2E tests
npm run test:integration  # Integration tests only
```

#### Modules WITHOUT Tests (46 critical files)

**Services without tests (26):**
- ❌ `auth.service.ts` - **CRITICAL** (login, register, email verification)
- ❌ `raffles.service.ts` - **CRITICAL** (create, draw, cancel, extend)
- ❌ `disputes.service.ts` - **CRITICAL** (dispute resolution)
- ❌ `referrals.service.ts` - **CRITICAL** (referral rewards)
- ❌ `mp-connect.service.ts` - **CRITICAL** (OAuth flow)
- ❌ `encryption.service.ts` - **CRITICAL** (PII encryption - compliance)
- ❌ `tickets.service.ts`, `admin.service.ts`, `users.service.ts`, etc.

**Resolvers without tests (16):**
- ❌ All GraphQL resolvers (auth, raffles, tickets, disputes, admin, etc.)

**Controllers without tests (4):**
- ❌ `mp-connect.controller.ts` - OAuth callback
- ❌ `auth-google.controller.ts` - Google OAuth
- ❌ `health.controller.ts` - Health checks
- ❌ `uploads.controller.ts` - Cloudinary signatures

**Estimated Coverage:** ~5% (2 modules tested of ~50)

---

### Frontend (Next.js + Playwright)

#### Existing E2E Tests (2 files)

**Playwright E2E (28 tests total):**

1. ✅ `e2e/auth.spec.ts` - 11 tests
   - Login/register pages
   - Authentication flow
   - Protected routes
   - Logout
   - IP blocking warning

2. ✅ `e2e/raffle.spec.ts` - 17 tests
   - Homepage/search browsing
   - Raffle detail page
   - Ticket purchase flow (partial)
   - Seller onboarding
   - MP Connect OAuth
   - Buyer dashboard

**Configuration:**
- ✅ Playwright configured (`playwright.config.ts`)
- ✅ Auto-start dev server in local mode
- ❌ Chromium browser only (no Firefox/Safari)
- ❌ No code coverage

**NPM Scripts:**
```bash
npm run test:e2e         # Headless tests
npm run test:e2e:ui      # Playwright UI
npm run test:e2e:headed  # Visible browser
```

#### Unit/Component Tests

**Status:** ❌ **NONE**
- No Jest/Vitest configured
- No React Testing Library
- No MSW (Mock Service Worker)
- No test utilities
- No coverage reporting

#### Features WITHOUT Tests

**Critical pages without E2E:**
- ❌ `/checkout/status` - **CRITICAL** (payment result handler)
- ❌ `/admin` - Full admin dashboard
- ❌ `/admin/disputes` - Dispute resolution with bulk actions
- ❌ `/dashboard/messages`, `/dashboard/payouts`, `/dashboard/shipping`
- ❌ `/dashboard/referrals` - Referral program

**Critical flows without tests:**
- ❌ Email verification (6-digit code) - **CRITICAL**
- ❌ KYC verification submission - **CRITICAL**
- ❌ Raffle creation end-to-end - **CRITICAL**
- ❌ Actual payment flow (MP Checkout) - **CRITICAL**
- ❌ Dispute creation/resolution
- ❌ Price drop alerts
- ❌ Q&A system
- ❌ Avatar upload
- ❌ Dark mode
- ❌ Social sharing
- ❌ Raffle relaunch
- ❌ CSV exports

**Estimated Coverage:** ~30-40% of user flows (E2E only)

---

## CI/CD Integration

### GitHub Actions (`.github/workflows/ci.yml`)

#### Backend Job ✅
```yaml
Triggers: Push/PR to main/develop
Steps:
  1. Lint → npm run lint
  2. Generate Prisma client
  3. DB push (fresh database)
  4. Build → npm run build
  5. Tests → npm run test -- --coverage
  6. Upload coverage → CodeCov
```

**Result:** ✅ Tests run on every push/PR

#### Frontend Job ⚠️
```yaml
Triggers: Push/PR to main/develop
Steps:
  1. Lint → npm run lint
  2. Build → npm run build (includes TypeScript check)
```

**Result:** ⚠️ NO unit tests, only lint + build

#### E2E Job ✅
```yaml
Triggers: PRs only (saves CI minutes)
Depends: Backend + Frontend jobs must pass
Steps:
  1. Start backend (production mode)
  2. Wait for health check
  3. Install Playwright browsers (Chromium)
  4. Run E2E tests
  5. Upload Playwright HTML report (7 days retention)
```

**Result:** ✅ E2E tests run on PRs

### Husky Git Hooks

#### Pre-commit Hook
```bash
npx lint-staged  # Staged files only, auto-fix
```
**Result:** ✅ Auto linting, ❌ NO tests

#### Pre-push Hook
```bash
npm run typecheck && npm run lint  # All files
```
**Result:** ✅ Type checking, ❌ NO tests

### Integration Status

| Test Type | CI/CD | Pre-commit | Pre-push | Coverage Report |
|-----------|-------|------------|----------|-----------------|
| Backend Unit | ✅ Yes | ❌ No | ❌ No | ✅ CodeCov |
| Backend Integration | ✅ Yes | ❌ No | ❌ No | ✅ CodeCov |
| Frontend E2E | ✅ PRs only | ❌ No | ❌ No | ❌ No |
| Frontend Unit | ❌ None exist | - | - | ❌ No |

**Gaps:**
- ❌ No minimum coverage threshold enforcement
- ❌ Git hooks can be bypassed with `--no-verify`
- ❌ Tests don't run in pre-push (only lint)
- ❌ Frontend has no unit tests

---

## Proposed Improvement Plan

### 🔴 CRITICAL PRIORITY (Security + Compliance)

#### 1. Backend - Encryption Service
- **File:** `src/common/services/encryption.service.ts`
- **Why:** Handles PII (DNI, CUIT, addresses, phones) - GDPR/PDPA compliance
- **Tests needed:**
  - Encrypt/decrypt correctly
  - Error handling (invalid key, corrupted data)
  - Key rotation

#### 2. Backend - Auth Service
- **File:** `src/auth/auth.service.ts`
- **Why:** Login, register, email verification, password reset
- **Tests needed:**
  - Password hashing (bcrypt)
  - JWT generation/validation
  - Email verification flow
  - Rate limiting
  - Account lockout

#### 3. Frontend - Payment Result Handler E2E
- **File:** `frontend/src/app/checkout/status/page.tsx`
- **Why:** Critical user flow - confirms ticket purchase
- **E2E Tests needed:**
  - Approved payment → show success + tickets
  - Pending payment → show pending
  - Rejected payment → show error
  - Auto-sync if webhook fails

#### 4. Backend - Raffles Service (Draw Logic)
- **File:** `src/raffles/raffles.service.ts` - method `drawWinner()`
- **Why:** Critical lottery draw logic
- **Tests needed:**
  - Fair random selection
  - Verify 70% ticket sales threshold
  - Correct state transitions
  - Notifications to winner/losers

---

### 🟠 HIGH PRIORITY (Core Features)

#### 5. Backend - MP Connect OAuth
- **File:** `src/payments/mp-connect.service.ts`
- **Why:** Sellers cannot receive payments without this
- **Tests needed:**
  - Complete OAuth flow
  - Token refresh
  - Disconnect flow
  - Error handling (invalid tokens, MP API down)

#### 6. Backend - Disputes Service
- **File:** `src/disputes/disputes.service.ts`
- **Why:** Buyer protection + mediation
- **Tests needed:**
  - Create dispute (freeze payout)
  - Seller response (48h deadline)
  - Admin resolution (buyer/seller/partial)
  - Payout release/refund

#### 7. Frontend - Raffle Creation E2E
- **File:** `frontend/src/app/dashboard/create/page.tsx`
- **Why:** Core seller flow
- **E2E Tests needed:**
  - Form validation
  - Image upload
  - Product specs
  - Submit + redirect to raffle detail

#### 8. Backend - Referrals Service
- **File:** `src/referrals/referrals.service.ts`
- **Why:** Growth feature (5% rewards)
- **Tests needed:**
  - Generate referral code
  - Apply referral code
  - Reward calculation (5% of first purchase)
  - Balance updates

---

### 🟡 MEDIUM PRIORITY (Enhancements)

#### 9. Frontend - Setup Unit Testing Framework
- **Action:** Configure Vitest + React Testing Library
- **Why:** Enable component testing
- **Files to create:**
  - `vitest.config.ts`
  - `setup-tests.ts`
  - Example tests for key components (Button, Input, Card)

#### 10. Backend - GraphQL Resolvers
- **Files:** All `*.resolver.ts`
- **Why:** Authentication, authorization, input validation
- **Tests needed:**
  - @Public() decorator works
  - @Roles() guard blocks correctly
  - Input validation (class-validator)
  - Error responses (GraphQLError)

#### 11. Frontend - Email Verification E2E
- **File:** `frontend/src/app/auth/verify/page.tsx`
- **Why:** Security (prevents fake accounts)
- **E2E Tests needed:**
  - Correct code entry → auto login
  - Wrong code → error
  - Code expired (15 min)
  - Code resend

#### 12. Backend - Admin Service
- **File:** `src/admin/admin.service.ts`
- **Why:** Critical operations (ban user, resolve disputes)
- **Tests needed:**
  - Ban user
  - Bulk dispute resolution
  - KYC approval/rejection
  - Stats reporting

---

### 🟢 LOW PRIORITY (Nice to Have)

#### 13. Frontend - Component Tests
- **Components to test:**
  - `components/ui/*` (Button, Input, Card, etc.)
  - `components/ImageUpload.tsx`
  - `components/share/share-buttons.tsx`
- **Why:** Prevent visual regressions

#### 14. Backend - Scheduled Tasks
- **Files:**
  - `src/raffles/tasks/raffle-tasks.service.ts`
  - `src/raffles/tasks/cleanup-tasks.service.ts`
- **Why:** Critical automation (draws, cancellations)
- **Tests needed:**
  - Auto-draw past-date raffles
  - Auto-cancel raffles with <70% tickets
  - Cleanup expired reservations

#### 15. Frontend - Multi-browser Testing
- **Action:** Add Firefox and WebKit to Playwright config
- **Why:** Cross-browser compatibility
- **Change in `playwright.config.ts`:**
  ```typescript
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ]
  ```

#### 16. Coverage Threshold Enforcement
- **Action:** Add minimum coverage in Jest config
- **File:** `backend/package.json`
  ```json
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 50,
        "functions": 50,
        "lines": 50,
        "statements": 50
      }
    }
  }
  ```

---

## Proposed CI/CD Improvements

### 1. Add Tests to Pre-push Hook

**File:** `.husky/pre-push`

**Change:**
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run type checking and linting
npm run typecheck && npm run lint

# Run backend tests (fast unit tests only)
cd backend && npm run test -- --bail --findRelatedTests

# Return to root
cd ..
```

**Benefit:** Catch bugs before pushing (10-15s overhead)

### 2. Enforce Minimum Coverage in CI

**File:** `.github/workflows/ci.yml`

**Change in Backend Job:**
```yaml
- name: Run unit tests
  run: npm run test:cov
  env:
    DATABASE_URL: postgresql://raffle_user:raffle_password@localhost:5432/raffle_db
    JWT_SECRET: test-jwt-secret-for-ci-pipeline
    JEST_COVERAGE_THRESHOLD: 50  # Fail if <50% coverage
```

**Benefit:** Prevent merges that reduce coverage

### 3. Frontend Unit Tests in CI

**Action:** Once Vitest is configured, add step:

```yaml
- name: Run frontend unit tests
  run: npm run test:unit
  working-directory: frontend
```

### 4. Separate Integration Tests Job

**Why:** Integration tests are slower, separating them allows:
- Parallel execution (faster CI)
- Retry only what failed
- Better visibility of test type failures

**New Job:**
```yaml
integration:
  name: Integration Tests
  runs-on: ubuntu-latest
  needs: backend  # Run after unit tests pass

  services:
    postgres:
      image: postgres:15
      # ... same as backend job

  steps:
    - name: Run integration tests
      run: npm run test:integration
```

---

## Current vs. Target Metrics

| Metric | Current | Short Term (3 months) | Long Term (6 months) |
|--------|---------|----------------------|----------------------|
| **Backend Unit Tests** | 3 files (~5%) | 20 files (~40%) | 40+ files (~80%) |
| **Frontend Unit Tests** | 0 files | 10 files | 30+ files |
| **Backend Line Coverage** | ~15% | 50% | 70% |
| **Frontend Line Coverage** | 0% | 30% | 60% |
| **E2E Tests (Playwright)** | 28 tests | 50 tests | 100+ tests |
| **Integration Tests** | 2 files | 5 files | 10+ files |
| **CI Test Duration** | ~3 min | ~5 min | ~8 min |
| **Tests in Pre-push** | ❌ No | ✅ Yes (unit only) | ✅ Yes (unit only) |

---

## Effort Estimation

### Critical Priority (Items 1-4)
- **Encryption Service:** 4 hours
- **Auth Service:** 8 hours
- **Payment Result E2E:** 3 hours
- **Raffle Draw Logic:** 6 hours
- **Total:** ~21 hours (~3 days)

### High Priority (Items 5-8)
- **MP Connect OAuth:** 6 hours
- **Disputes Service:** 8 hours
- **Raffle Creation E2E:** 4 hours
- **Referrals Service:** 4 hours
- **Total:** ~22 hours (~3 days)

### Medium Priority (Items 9-12)
- **Frontend - Setup Vitest:** 4 hours
- **GraphQL Resolvers:** 12 hours (16 resolvers)
- **Email Verification E2E:** 3 hours
- **Admin Service:** 6 hours
- **Total:** ~25 hours (~3 days)

### Low Priority (Items 13-16)
- **Component Tests:** 8 hours
- **Scheduled Tasks:** 4 hours
- **Multi-browser:** 2 hours
- **Coverage Threshold:** 1 hour
- **Total:** ~15 hours (~2 days)

**Grand Total:** ~83 hours (~10-11 days of work)

---

## Recommended Implementation Roadmap

### Sprint 1 (Week 1-2): Critical
- ✅ Encryption Service tests
- ✅ Auth Service tests
- ✅ Payment result E2E
- ✅ Raffle draw logic tests
- ✅ Add tests to pre-push hook

### Sprint 2 (Week 3-4): High Priority
- ✅ MP Connect OAuth tests
- ✅ Disputes Service tests
- ✅ Raffle creation E2E
- ✅ Referrals Service tests

### Sprint 3 (Week 5-6): Medium Priority
- ✅ Setup Vitest in frontend
- ✅ Email verification E2E
- ✅ Admin Service tests
- ✅ 5 most critical GraphQL resolvers

### Sprint 4+ (Week 7+): Low Priority + Expansion
- ✅ Component tests
- ✅ Scheduled tasks tests
- ✅ Remaining resolvers
- ✅ Multi-browser
- ✅ Coverage enforcement

---

## Critical Files Identified

### Backend (without tests, high priority)
```
src/common/services/encryption.service.ts
src/auth/auth.service.ts
src/raffles/raffles.service.ts (drawWinner method)
src/payments/mp-connect.service.ts
src/disputes/disputes.service.ts
src/referrals/referrals.service.ts
src/admin/admin.service.ts
src/raffles/tasks/raffle-tasks.service.ts
```

### Frontend (without E2E tests, high priority)
```
src/app/checkout/status/page.tsx
src/app/dashboard/create/page.tsx
src/app/auth/verify/page.tsx
src/app/admin/disputes/page.tsx
```

### CI/CD (improvements needed)
```
.github/workflows/ci.yml
.husky/pre-push
backend/package.json (Jest config)
frontend/vitest.config.ts (create)
```

---

## Plan Verification

Once improvements are implemented, verify with:

### Verification Commands
```bash
# Backend coverage
cd backend && npm run test:cov
# Check coverage report at coverage/index.html
# Target: >50% line coverage

# Frontend unit tests (once Vitest configured)
cd frontend && npm run test:unit
# Target: >30% component coverage

# E2E tests
cd frontend && npm run test:e2e
# Target: 50+ tests passing

# CI/CD
git push  # Should run tests in pre-push hook
# Open PR → Verify CI runs all tests

# Coverage enforcement
# Modify code to reduce coverage <50%
# CI should fail
```

### Metrics to Monitor
1. **CodeCov Dashboard:** Track coverage trends over time
2. **GitHub Actions:** Verify CI duration doesn't exceed 10 min
3. **Playwright HTML Reports:** Track E2E test trends
4. **Pre-push Hook:** Measure overhead (should be <30s for unit tests)

---

## Summary

This plan provides a complete roadmap to take the project from ~5-10% coverage to 60-80% coverage in 6 months, prioritizing security and compliance first. The phased approach allows for incremental improvements while maintaining development velocity.

Key success factors:
- Focus on critical security-sensitive modules first
- Leverage existing test infrastructure and utilities
- Enforce coverage minimums in CI to prevent regression
- Incrementally expand test coverage by priority
