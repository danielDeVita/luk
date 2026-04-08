# LUK Agent Guide

This file is the repo-wide source of truth for OpenAI/Codex-style agents working in this project.

## Non-Negotiables

- Treat feature requests as specification work first, not coding work first.
- Do not make product, UX, domain, or API decisions on behalf of the user when a meaningful requirement is missing.
- For new features or functional changes, ask planning/specification questions before implementing.
- Prefer maintainability over speed: clear names, small functions, explicit types, low duplication, and stable abstractions.
- Keep user-facing copy in Spanish. Keep code, comments, and JSDoc in English.
- Keep GraphQL resolvers thin. Business logic belongs in services.
- Do not change public behavior, schema shape, or data contracts unless the task explicitly requires it.

## Feature Intake

- Before coding a new feature, clarify:
  - goal and success criteria
  - in-scope and out-of-scope behavior
  - API or UI expectations
  - failure modes and edge cases
  - validation and rollout expectations
- If a requirement is underspecified and could materially change implementation, ask instead of assuming.
- After clarifying requirements, provide or align on a concrete implementation plan before editing code.

## Workflow

- For new features, write tests first.
- Minimum test coverage for a feature should include:
  - one happy path
  - one sad path
  - one relevant edge case
- Keep tests targeted and readable; do not add broad or noisy test suites unless the task requires it.
- After tests, implement the feature with the smallest cohesive change set that satisfies the spec.
- Re-run relevant tests after meaningful increments, not only at the very end.

## Code Quality

- Follow SOLID, DRY, and long-term maintainability principles.
- Use descriptive, explicit names even if they are longer.
- Prefer small functions with one clear responsibility.
- Extract reusable logic when duplication is real and stable.
- Avoid premature abstractions; extract only when it improves clarity or reuse.
- Everything that can be typed should be typed clearly.
- Preserve existing architectural boundaries unless the task explicitly justifies changing them.

## Code Style

- Use JSDoc selectively when it materially helps future readers.
- Write JSDoc in English.
- Document non-obvious behavior, side effects, orchestration, invariants, or integration boundaries.
- Avoid noisy or repetitive documentation that only restates the signature.
- Match the existing style of the touched module unless the task is explicitly a documentation cleanup.

## Validation Matrix

- Run lint periodically while coding, not only before commit or push.
- Run the smallest relevant validation set during development, then run a final relevant validation pass before closing the task.
- Backend changes:
  - prefer targeted backend tests
  - run backend lint when editing backend code
  - run `npm run build` in `backend/` at minimum when appropriate
- Frontend changes:
  - prefer targeted unit or E2E coverage
  - run frontend lint when editing frontend code
  - run `npm run build` in `frontend/` at minimum when appropriate
- Cross-cutting flows such as payments, raffle lifecycle, disputes, payouts, and social promotions require stronger validation than cosmetic changes.

## Domain Invariants

- Sellers must satisfy prerequisites before creating raffles: KYC verified, Mercado Pago connected, shipping address present.
- Ticket purchases reserve tickets first and confirm them after approved payment state.
- Refund and cancellation flows must preserve ticket and payout consistency.
- Payout release must respect buyer-protection and dispute constraints.
- Social promotion validation and settlement must preserve bonus lifecycle consistency.
- `ENCRYPTION_KEY` stability matters across environments because encrypted KYC and payment token data depend on it.

## Where To Look First

- `COMMANDS.md`: root commands, Docker workflow, QA helpers
- `backend/README.md`: backend modules, endpoints, environment, testing
- `frontend/README.md`: frontend routes, UI architecture, E2E coverage
- `docs/social-promotions-implementation.md`: social promotion design details

## MCP And Skills

- MCP is supported by OpenAI/Codex, but its actual server configuration belongs in `.codex/config.toml` in the repo or `~/.codex/config.toml` for personal setup.
- Repo `.codex/config.toml` should contain only trusted-project defaults and non-secret servers.
- Keep user-specific, token-backed, or secret-backed servers in `~/.codex/config.toml`.
- Use `AGENTS.md` to explain when MCP should be used, not to define low-level MCP connection details.
- Prefer MCP over guesswork when an enabled MCP server is authoritative for the question.
- Use `context7` for library and framework documentation before relying on memory.
- Use browser MCPs such as Chrome DevTools or Playwright when validating real frontend behavior, rendering, navigation, or browser-only failures.
- Prefer `MCP_DOCKER` for browser automation in this repo when it is available and Docker Desktop is running.
- Use Postgres MCP to inspect schema or live data shape before assuming database details, but keep connection secrets out of repo config.
- Prefer the local `sentry` skill for Sentry issue and event inspection in this repo; keep Sentry secrets out of repo files.
- Use `memory` only when persistent cross-task context is genuinely useful.
- Use `sequential-thinking` only for complex planning, debugging, or multi-step reasoning, not for routine edits.
- Repo-shared skills belong in `.agents/skills/`.
- Do not place repo-wide mandatory rules inside a skill; skills are for reusable specialized workflows, not universal policy.

## Local QA Defaults

- Prefer Docker-first commands from `COMMANDS.md`.
- For payment QA without Mercado Pago, set `PAYMENTS_PROVIDER="mock"` and `MP_ACCESS_TOKEN=""`.
- Important local URLs:
  - Frontend: `http://localhost:3000`
  - Backend: `http://localhost:3001`
  - GraphQL: `http://localhost:3001/graphql`
