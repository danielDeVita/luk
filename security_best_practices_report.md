# Security Best Practices Report

Date: 2026-04-29

## Executive summary

LUK is currently calibrated for local development and QA, not production, and the repository does show several solid controls already in place: backend validation pipes, GraphQL complexity limits, optional Turnstile, selective PII encryption at rest, frontend and backend security headers, and `.env` exclusion from git. That said, the current authentication and social-promotion implementations contain multiple pre-production blockers. The most important issues are session tokens exposed through URLs and browser storage, weak URL validation before backend-side fetch/Playwright execution, and refresh tokens stored in plaintext in the database. Those issues are materially more important than cosmetic hardening gaps because they directly affect account takeover and server-side trust boundaries once the system is publicly exposed.

## Scope

In scope:

- `backend/src/**`
- `backend/prisma/schema.prisma`
- `frontend/src/**`
- `frontend/next.config.ts`
- Root operational docs and env/config defaults used by the runtime

Environment calibration used for this report:

- Current usage is development/QA only
- No real KYC, payment, or user data is currently being processed
- No confirmed production internet exposure today
- Unknown whether future hosted environments will restrict outbound network access from backend/social-worker

Out of scope for severity calibration:

- Tests, fixtures, and load-test harnesses, except where they clarified runtime behavior
- CI/CD hardening beyond what is visible through repo defaults
- Incident response and cloud account posture outside the repository

## Positive controls observed

- Backend global DTO validation with `whitelist`, `forbidNonWhitelisted`, and implicit conversion is enabled in `backend/src/main.ts:73-82`.
- GraphQL query complexity protection is always enabled in `backend/src/app.module.ts:133-136` and implemented in `backend/src/common/plugins/complexity.plugin.ts:17-79`.
- Turnstile fails closed when enabled and the backend secret is missing or verification fails in `backend/src/auth/turnstile.service.ts:27-85`.
- Sensitive KYC and Mercado Pago token fields are encrypted at rest when `ENCRYPTION_KEY` is valid in `backend/src/common/services/encryption.service.ts:32-105`.
- `.env` is ignored and not tracked; `git ls-files` only shows `.env.example`.

## Critical / High findings

### SBP-001

- Severity: High
- Title: Authentication tokens are exposed through query strings and persisted in browser storage
- Impact statement: a stolen callback URL, browser-storage read, or XSS bug can become full session compromise, including refresh-token replay.
- Location:
  - `backend/src/auth/auth-google.controller.ts:62-83`
  - `backend/src/auth/auth-google.controller.ts:116-164`
  - `frontend/src/app/auth/callback/page.tsx:41-55`
  - `frontend/src/store/auth.ts:18-20`
  - `frontend/src/store/auth.ts:47-50`
  - `frontend/src/store/auth.ts:102-108`
  - `frontend/src/lib/apollo-provider.tsx:58-71`
- Evidence:
  - OAuth callback redirects with `token` and `refreshToken` in the URL.
  - Frontend reads those query params and stores them in Zustand persisted storage.
  - Refresh requests send the refresh token back in an `Authorization` header from browser state.
- Why this matters:
  - Query-string tokens leak to browser history, screenshots, crash reports, reverse proxies, analytics, and potentially `Referer` headers.
  - `localStorage` or persisted Zustand state makes token theft trivial once any XSS, extension compromise, or local browser compromise exists.
  - The issue is amplified because the refresh token is also exposed to browser JavaScript.
- Recommended fix:
  - Stop returning access and refresh tokens in OAuth callback URLs.
  - Stop persisting refresh tokens in browser-accessible storage.
  - Use an HttpOnly, same-site session cookie or a one-time backend code exchange that terminates into a server-managed session.
  - If cross-subdomain deployment remains a hard requirement, use a short-lived one-time code in the callback URL, not bearer tokens.
- Recommended validation:
  - Add tests asserting that OAuth callback redirects never contain bearer tokens.
  - Add tests asserting that refresh happens without browser-readable refresh-token persistence.

### SBP-002

- Severity: High
- Title: Social-promotion URL validation is weak and allows backend-side fetching of attacker-controlled domains
- Impact statement: an authenticated seller can turn backend/social-worker infrastructure into an SSRF or arbitrary browsing primitive.
- Location:
  - `backend/src/social-promotions/parsers/social-promotion-parser.service.ts:33-47`
  - `backend/src/social-promotions/parsers/social-promotion-parser.service.ts:53-68`
  - `backend/src/social-promotions/social-promotions.service.ts:239-248`
  - `backend/src/social-promotions/social-promotions.service.ts:696-707`
  - `backend/src/social-promotions/social-promotions.service.ts:1375-1384`
  - `backend/src/social-promotions/social-promotion-page-loader.service.ts:75-87`
  - `backend/src/social-promotions/social-promotion-page-loader.service.ts:111-127`
- Evidence:
  - Network detection uses substring checks like `host.includes('facebook.com')`.
  - Submitted permalinks are later fetched server-side and optionally loaded in Playwright.
  - Fetch follows redirects and the browser path launches Chromium with `--no-sandbox`.
- Why this matters:
  - A hostname like `facebook.com.attacker.tld` passes validation.
  - An attacker-controlled domain can resolve to internal/private addresses or metadata services if outbound restrictions are absent.
  - Playwright materially increases the attack surface compared with simple fetch because it executes a full browser against attacker-controlled content.
- Recommended fix:
  - Replace substring host checks with exact host allowlists plus strict path validation per supported network.
  - Re-resolve DNS and reject private, loopback, link-local, and metadata IPs before every fetch/browser navigation.
  - Disable redirect following across trust boundaries or revalidate every redirect target.
  - Do not run browser automation with `--no-sandbox` in an internet-exposed environment unless it is container-sandboxed separately.
  - Gate this feature behind a stronger trust model until the URL validation and egress controls are fixed.
- Recommended validation:
  - Add tests rejecting `facebook.com.attacker.tld`, `twitter.com.evil.org`, userinfo tricks, punycode lookalikes, and private-IP resolutions.

### SBP-003

- Severity: High
- Title: Refresh tokens are stored in plaintext in the database
- Impact statement: any database disclosure becomes immediately reusable session theft without needing to crack hashes.
- Location:
  - `backend/prisma/schema.prisma:789-804`
  - `backend/src/auth/auth.service.ts:709-758`
  - `backend/src/auth/auth.service.ts:790-809`
- Evidence:
  - `RefreshToken.token` is stored as a unique plaintext string.
  - Refresh lookup is `findUnique({ where: { token: refreshTokenValue } })`, which implies raw token material is persisted.
- Why this matters:
  - Random token generation is good for entropy, but plaintext persistence means any DB snapshot, admin-console misuse, or SQL leak can replay tokens directly.
  - This is worse here because refresh tokens are also browser-accessible in the current auth design.
- Recommended fix:
  - Store a keyed hash of refresh tokens instead of plaintext.
  - Compare by hashing the presented token server-side.
  - Consider adding token family metadata, device binding, and last-used timestamps for stronger anomaly detection.
- Recommended validation:
  - Add tests proving raw refresh tokens are never written to persistent storage.

## Medium findings

### SBP-004

- Severity: Medium
- Title: GraphQL debug defaults are production-unsafe
- Location:
  - `backend/src/common/config/env.validation.ts:173-180`
  - `backend/src/app.module.ts:119-133`
- Evidence:
  - `GRAPHQL_DEBUG` defaults to `true`.
  - `debug: debugEnabled` is set regardless of `NODE_ENV`.
- Why this matters:
  - If environment overrides are missed during a future deployment, backend error responses may leak stack traces, resolver internals, or validation details useful for targeted attacks.
  - Introspection is already limited to dev landing-page mode, which is good, but debug leakage remains a separate concern.
- Recommended fix:
  - Default `GRAPHQL_DEBUG` to `false`.
  - Enable it only through an explicit local-development override.
  - Consider asserting `GRAPHQL_DEBUG=false` whenever `NODE_ENV=production`.

### SBP-005

- Severity: Medium
- Title: Login throttling is node-local memory only
- Location:
  - `backend/src/common/guards/login-throttler.service.ts:17-18`
  - `backend/src/common/guards/login-throttler.service.ts:31-32`
  - `backend/src/common/guards/login-throttler.service.ts:56-63`
  - `backend/src/common/guards/login-throttler.service.ts:91-98`
- Evidence:
  - Failed-login state is stored in an in-memory `Map`.
  - The code itself notes Redis would be needed for multi-instance production.
- Why this matters:
  - In a future horizontal deployment, an attacker can bypass per-node counters via load balancing, restarts, or instance churn.
  - This is not urgent in the current local-dev posture, but it should not be treated as a sufficient production brute-force control.
- Recommended fix:
  - Move login throttling to Redis or another shared store before public rollout.
  - Pair it with stronger per-account rate limiting and alerting on spray patterns.

### SBP-006

- Severity: Medium
- Title: Frontend production CSP still permits `unsafe-inline` and `unsafe-eval`
- Location:
  - `frontend/next.config.ts:61-67`
- Evidence:
  - Production CSP includes `script-src 'self' 'unsafe-inline' 'unsafe-eval'`.
- Why this matters:
  - This substantially weakens CSP as a defense-in-depth control against XSS.
  - It becomes more important because current auth state is browser-readable and thus high-value if any XSS exists.
- Recommended fix:
  - Reduce CSP exceptions to the minimum operational set.
  - Remove `unsafe-eval` unless a documented build/runtime requirement proves it is necessary in production.
  - Prefer nonce- or hash-based inline script allowances.

## Low / conditional findings

### SBP-007

- Severity: Low
- Title: Public mock-payment endpoints become risky if dev settings leak into a hosted environment
- Location:
  - `backend/src/payments/mock-payments.controller.ts:32-70`
  - `backend/src/payments/providers/mock-payment.provider.ts:53-66`
  - `frontend/src/app/checkout/mock/[mockPaymentId]/page.tsx:68-108`
- Evidence:
  - Mock-payment routes are public and authorized by a bearer-like `publicToken`.
  - The token is passed in the browser URL and stored in local storage for the QA flow.
- Why this matters:
  - In current dev-only use, this is expected and low risk.
  - If `PAYMENTS_PROVIDER=mock` or `ALLOW_MOCK_PAYMENTS=true` leaks into a public environment, anyone with a leaked URL token can inspect buyer details and mutate mock payment state.
- Recommended fix:
  - Keep mock payments strictly non-production.
  - Add startup assertions that fail hard if mock payments are enabled in a hosted environment.

## Suggested remediation order

1. Remove URL-delivered tokens and browser-stored refresh tokens from the auth flow.
2. Fix social-promotion host validation and add outbound-network restrictions before enabling browser-backed validation in any hosted environment.
3. Hash refresh tokens at rest and migrate lookup logic.
4. Change prod defaults: `GRAPHQL_DEBUG=false`, shared-rate-limit storage, tighter CSP.

## Report location

This report was written to `security_best_practices_report.md` at the repository root.
