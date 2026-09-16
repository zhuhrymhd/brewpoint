# Roadmap: BrewPoint

This roadmap breaks down how BrewPoint gets built, from an empty repo to a live, portfolio-ready POS, and what comes after MVP. It maps directly to the features defined in `PRD.md`. Technical implementation detail (schema, API contracts, caching/indexing strategy) lives in `TECH_SPEC.md` — this document focuses on **what gets built, in what order, and why**.

**Versioning convention:**

- `v0.x` — pre-release build milestones (not usable end-to-end yet)
- `v1.0` — MVP launch (all "Must" features from PRD, live and deployed)
- `v1.x` — post-MVP enhancements (performance, reliability, reporting)
- `v2.0+` — feature expansions beyond the original single-outlet scope

> **Stack note:** MVP is built as a **single Next.js app** (Route Handlers as the API layer, Drizzle ORM, PostgreSQL) rather than a separate Go backend — see `TECH_SPEC.md` v2.0. This keeps the phases below focused on TypeScript end-to-end. A Go backend split is an optional future enhancement, not required to complete any phase here (see `TECH_SPEC.md` Section 12).

---

## Phase 0 — Project Foundation (v0.1)

**Goal:** Empty repo becomes a working skeleton — nothing user-facing yet, but the foundation is solid.

**Scope:**

- Single Next.js repo (`brewpoint`) — no separate backend service.
- PostgreSQL running locally via Docker Compose.
- Drizzle schema v1: `users`, `categories`, `products`, `transactions`, `transaction_items`.
- `drizzle-kit` configured, first migration generated and applied.
- Basic health-check Route Handler (`GET /api/v1/health`) to confirm the app ↔ database connection.
- Base Next.js app shell with routing structure planned (login, POS, products, dashboard) per `TECH_SPEC.md` Section 2.

**Not included yet:** No real feature is usable end-to-end. This phase is purely plumbing.

**Definition of done:** The app boots, connects to Postgres via Drizzle, migrations run cleanly, and `/api/v1/health` returns success.

**Estimated time:** 2-3 days.

---

## Phase 1 — Auth & User Management (v0.2)

**Maps to PRD:** Feature 1 (Authentication & Session), Feature 2 (User Management)

**Scope:**

- Login Route Handler with username/password, JWT issued on success (`jose`).
- Password hashing (`bcryptjs`).
- `requireAuth()` session helper used inside every protected Route Handler; `middleware.ts` for fast redirect-level protection (see `TECH_SPEC.md` Section 7).
- Role check (`admin` vs `cashier`) via `requireAuth(req, "admin")`.
- User CRUD (create, list, detail, update, deactivate) — admin-only.
- Frontend: login page, session handling, route protection based on role, basic user management screen for admin.
- Seed script (`lib/db/seed.ts`) to create the first admin account (since user creation itself requires being logged in as admin).

**Definition of done:** An admin can log in, create a cashier account, log out, and the cashier can log in with restricted access. Attempting to access admin-only routes as a cashier is blocked both on the frontend and in the Route Handler.

**Estimated time:** 1 week.

---

## Phase 2 — Category & Product Management (v0.3)

**Maps to PRD:** Feature 3 (Category Management), Feature 4 (Product Management)

**Scope:**

- Category CRUD (admin-only).
- Product CRUD: create, list (paginated), detail, update, soft-delete (admin-only).
- Product list is readable by both roles; write actions are admin-only.
- Basic name/barcode search (simple `ILIKE` query — no indexing optimization yet, that comes later).
- Frontend: product management screens (list, form for create/edit), category management screen.
- Out-of-stock visual indicator on product list.

**Definition of done:** Admin can build a full product catalog with categories, and a cashier can browse/search that catalog (read-only) from their own view.

**Estimated time:** 1 week.

---

## Phase 3 — Point of Sale / Checkout (v0.4)

**Maps to PRD:** Feature 5 (Point of Sale / Checkout)

**Scope:**

- Cart state on the frontend (add item, adjust quantity, remove item, clear cart) via Zustand.
- Checkout Route Handler: validates stock, creates transaction + transaction items, deducts stock — wrapped in a single `db.transaction()` call with `.for("update")` row locking for atomicity (see `TECH_SPEC.md` Section 5).
- Cash payment input (amount received → system computes change).
- On-screen receipt view after successful checkout.
- Stock validation errors surfaced clearly when an item is unavailable at checkout time.
- Void transaction endpoint (admin-only) that restores stock.

**Definition of done:** A cashier can complete a full sale from product search to receipt, stock updates correctly, and an admin can void a transaction with stock restored.

**Technical focus:** This phase is where DB transaction handling matters most — it's the first real correctness-critical logic in the system (see Phase 6 for concurrency hardening).

**Estimated time:** 1.5 weeks.

---

## Phase 4 — Transaction History & Stock Adjustment (v0.5)

**Maps to PRD:** Feature 6 (Transaction History), Feature 7 (Stock Adjustment)

**Scope:**

- Transaction list with filters (date range, cashier).
- Transaction detail view (items, totals, payment, status, cashier, timestamp).
- Stock adjustment endpoint (admin-only): increase/decrease stock with a required reason, logged separately from sales-driven deductions.
- Stock adjustment history view per product.
- Frontend screens for both.

**Definition of done:** Admin can review any past transaction and manually correct stock levels outside of a sale, with a visible audit trail.

**Estimated time:** 4-5 days.

---

## Phase 5 — Sales Dashboard (v0.6)

**Maps to PRD:** Feature 8 (Sales Dashboard)

**Scope:**

- Today's total sales + transaction count.
- Date range selector for custom period totals.
- Best-selling products list (ranked by quantity sold).
- Basic chart (bar or line) on the frontend.

**Definition of done:** Admin lands on a dashboard that answers "how did the store do today/this period?" without manual calculation. This completes 100% of PRD's MVP feature list.

**Estimated time:** 4-5 days.

---

## v1.0 — MVP Launch

**Goal:** All Phase 0-5 work is integrated, tested end-to-end, deployed, and publicly demo-able.

**Scope:**

- Manual QA pass across all user flows defined in `PRD.md`.
- Deploy the single Next.js app, containerized via Docker, to a self-managed VPS behind a Caddy reverse proxy for HTTPS — one deployment target instead of two, since there's one app. *(Revised 2026-09 — originally planned as a Vercel deploy; switched to self-hosting specifically to get hands-on with real deployment + CI/CD mechanics. See `TODO.md` Part 4 for the detailed plan.)*
- Run PostgreSQL as a Docker container alongside the app on the same VPS (via `docker-compose.yml`), rather than a separate managed provider — keeps the whole stack in one place to reason about while learning deployment.
- Environment variable/config management per environment (local, preview, production) — see `TECH_SPEC.md` Section 9.
- Basic README with setup instructions and architecture overview for portfolio visibility.
- Seed/demo data so the live deployment is explorable without manual setup.

**Definition of done:** A recruiter or reviewer can open a live URL, log in with demo credentials, and complete a full transaction — with zero setup required on their end.

**Estimated time:** 3-5 days.

**Milestone: this is the version referenced as "MVP" in the PRD.**

---

## v1.1 — Performance & Reliability Enhancements

**Goal:** No new user-facing features — this version is entirely about making the existing system faster and more resilient. This is also the version where most of the "portfolio-impressive" technical depth gets added.

**Scope:**

- **Database indexing:** Add indexes on frequently queried columns (`products.name`, `products.barcode`, `transactions.created_at`, `transactions.cashier_id`). Benchmark query plans before/after with `EXPLAIN ANALYZE`.
- **Redis caching:** Cache the product catalog (cache-aside pattern) and today's dashboard summary, with explicit invalidation on writes (product update, new transaction). *(Revised 2026-09 — originally planned as Upstash Redis specifically for Vercel's serverless/Edge runtime; now that the app runs as a long-lived Docker container on a VPS rather than serverless, a plain self-hosted Redis container in `docker-compose.yml` is the more natural default — one more service alongside `app`/`db`, no external account or HTTP-per-call overhead needed. Upstash remains a fine choice if avoiding another container to operate is preferred.)*
- **Rate limiting:** Apply rate limits to the login Route Handler (brute-force protection) and checkout Route Handler (abuse protection), backed by the same Redis instance (`@upstash/ratelimit` also works against a self-hosted Redis via its Redis-protocol client, not just Upstash's own service).
- **Concurrency hardening:** Load-test simultaneous checkouts on the same product to confirm `.for("update")` row-locking prevents overselling under real concurrent load, not just in theory.
- **API response time benchmarking:** Document before/after metrics for the README/portfolio writeup.

**Definition of done:** Documented, measurable performance improvements (e.g., "product list query: 240ms → 12ms after indexing + cache"), and the system survives a concurrent load test without stock inconsistencies.

**Estimated time:** 1-1.5 weeks.

---

## v1.2 — Reporting & Realtime Enhancements

**Goal:** Deepen the admin experience beyond the basic dashboard.

**Scope:**

- Expanded reporting: sales by category, sales by cashier, exportable CSV of transactions for a date range.
- Realtime dashboard updates via WebSocket (new transaction reflects on the admin dashboard without a refresh) — this is the first realtime feature in the system.
- Optional: materialized view or scheduled aggregation job for heavier reporting queries, if raw aggregation starts getting slow.

**Definition of done:** Admin can export a sales report and watch new transactions appear on the dashboard live as they happen at the counter.

**Estimated time:** 1 week.

---

## v1.3 — Testing, Observability & CI/CD

**Goal:** Bring engineering maturity to match the feature set — this is what separates a "project that works" from a "project built the way real teams build software."

**Scope:**

- Unit tests for core business logic (checkout, stock adjustment, auth) using **Vitest**.
- Integration tests against a test database for critical Route Handlers.
- End-to-end tests for the main user flows (login → checkout → dashboard) using Playwright.
- Structured logging (request logs, error logs) instead of `console.log`.
- Health/readiness Route Handler suitable for uptime monitoring.
- Extend the GitHub Actions pipeline already built in `TODO.md` Part 4 (which currently gates on `tsc`/lint/build, then SSH-deploys to the VPS): add the new Vitest unit/integration tests and the existing Playwright e2e suite as earlier steps in that same workflow, so a merge to `main` is blocked — not just discouraged — if any of them fail. *(Revised 2026-09 — the deploy half of this was pulled forward into Part 4 since the VPS plan change made "the test gate before Vercel deploys" no longer accurate; Vercel never enters the picture. This phase now only adds the test suites themselves.)*

**Definition of done:** A pull request can't be merged if tests fail, and every merge to main auto-deploys — a real CI/CD workflow to reference in interviews.

**Estimated time:** 1-1.5 weeks.

---

## v2.0+ — Feature Expansion (Optional / Exploratory)

These go beyond the original single-outlet PRD scope. Pursue only if BrewPoint's direction expands past "portfolio project" — each is a meaningfully sized effort on its own and would need its own mini-PRD before starting.

- **Go backend split** — extract the Route Handlers/services into a standalone Go Fiber + Drizzle-equivalent (GORM) service, per `TECH_SPEC.md` Section 12. Because the API was built as a REST contract from day one, this is closer to a config change + rewrite of the service layer than a full-app rewrite. Good candidate for demonstrating "I can evolve an architecture" in a portfolio narrative.
- **Multi-outlet support** — one system, multiple store locations, outlet-scoped data and consolidated cross-outlet reporting.
- **Payment gateway integration** — real card/QR payment processing instead of manual cash recording.
- **Receipt printer integration** — thermal printer support for physical receipts.
- **Customer-facing features** — the loyalty/rewards style experience explored earlier in design brainstorming, if BrewPoint ever grows a customer-facing side.
- **Inventory forecasting** — predictive restock suggestions based on historical sales velocity.
- **Multi-tenant SaaS conversion** — turning BrewPoint from a single-store app into a product other coffee shops could sign up for.

---

## Summary Timeline

| Version  | Focus                                                   | Estimated Time |
| -------- | ------------------------------------------------------- | -------------- |
| v0.1     | Project foundation                                      | 2-3 days       |
| v0.2     | Auth & user management                                  | 1 week         |
| v0.3     | Category & product management                           | 1 week         |
| v0.4     | Point of sale / checkout                                | 1.5 weeks      |
| v0.5     | Transaction history & stock adjustment                  | 4-5 days       |
| v0.6     | Sales dashboard                                         | 4-5 days       |
| **v1.0** | **MVP launch (deployed, demo-able)**                    | **3-5 days**   |
| v1.1     | Performance & reliability (indexing, cache, rate limit) | 1-1.5 weeks    |
| v1.2     | Reporting & realtime                                    | 1 week         |
| v1.3     | Testing, observability, CI/CD                           | 1-1.5 weeks    |
| v2.0+    | Feature expansion (optional)                            | Ongoing        |

**Total to v1.3:** roughly 8-10 weeks at a sustainable, non-rushed pace.

---

## Working Principles Through the Roadmap

1. **Don't start a new phase until the current one has a working demo of its own.** Each phase should be independently showable, even if rough.
2. **Commit at the end of every phase** with a message describing what became usable — this builds a clean, readable git history that doubles as a portfolio artifact.
3. **Update the README incrementally**, not all at once at the end — explain _why_ a technique was used (e.g., why indexing this column, why cache-aside over write-through) as it's added.
4. **v1.1 is not optional filler** — it's the phase that turns BrewPoint from "another CRUD app" into a project that demonstrates real backend engineering judgment. Don't skip straight to features over this.
5. **If a phase is taking meaningfully longer than estimated, that's fine** — the estimates are pacing guides, not deadlines. Understanding > speed.
