# TOT Platform Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure and connect the existing TOT client, driver and admin flows so trip state, identity, fare, invoice and payment are server-authoritative and deployment settings fail closed.

**Architecture:** Keep the existing NestJS monorepo, Prisma/PostgreSQL, Socket.IO, React Native apps and web portals. Add shared API authentication primitives, enforce role and ownership rules at each boundary, then repair lifecycle/payment contracts and interface behavior in dependency order. Preserve cash as the only supported payment until a provider is configured.

**Tech Stack:** NestJS 11, Passport/JWT, Prisma 5.21, PostgreSQL 15, Socket.IO 4, Jest/Supertest, React Native 0.83/Jest, React/Vite.

**Spec:** `docs/superpowers/specs/2026-10-12-tot-platform-hardening-design.md`

## Global Constraints

- Baseline is `main` commit `c98cd16`; do not rewrite history or publish/deploy from this task.
- Do not read or copy local `.env`, signing key contents, Base64 values, trip datasets, backups, or raw logs.
- JWT subject and role come from a verified token; ownership is checked against persisted records.
- Socket events are authenticated and authorized server-side; payload IDs are selectors, never proof of identity.
- Prisma migrations are additive and production startup never runs `db push --accept-data-loss`.
- Cash is the only active payment method until a real provider is selected and integrated; an invoice is not proof of settlement.
- Keep UI feedback truthful: success appears only after persisted server success; unavailable actions are disabled or clearly labeled.
- Do not claim production state, secret rotation, store release, or external account setup without direct verification.
- Use test-first changes: add a focused failing test, run it to confirm the expected failure, implement the smallest fix, then run the focused suite and relevant package suite.

---

## Phase 0 — Baseline and plan ledger

### Task 1: Establish a repeatable backend and interface baseline

**Files:**
- Inspect: `backend-monorepo/package.json`, `backend-monorepo/jest.config.*`, `backend-monorepo/apps/*/test/`, mobile package manifests, portal package manifests.
- Create: `.superpowers/sdd/2026-10-12-tot-platform-hardening/progress.md` and task briefs/reports under the same ignored plan workspace.
- Test: existing API, client mobile and driver mobile suites.

- [ ] Record `git status --short --branch`, HEAD, Node/npm versions and whether lockfiles/dependencies are present; do not inspect `.env`.
- [ ] Run the current focused backend Jest suites before changes and record pre-existing failures without modifying unrelated tests.
- [ ] Run the existing mobile Jest suites if dependencies are installed; otherwise record the missing dependency and use `npm ci` only for the affected project with its committed lockfile.
- [ ] Create a task ledger with a task/file ownership table and record test baseline results.

**Deliverable:** reproducible baseline and a ledger that names the plan and records each task result.

## Phase 1 — Close identity and credential exposure paths

### Task 2: Require configured JWT secrets and centralize token validation

**Files:**
- Create: `backend-monorepo/libs/auth/src/auth.module.ts`, `jwt.strategy.ts`, `jwt-auth.guard.ts`, `roles.decorator.ts`, `roles.guard.ts`, `current-user.decorator.ts`, `index.ts` and focused specs.
- Modify: `backend-monorepo/nest-cli.json`, `backend-monorepo/tsconfig.json`, `apps/admin-api/src/auth/auth.module.ts`, `apps/client-api/src/auth/auth.module.ts`, `apps/driver-api/src/auth/auth.module.ts`, and the three `auth.service.ts` files.
- Test: `backend-monorepo/libs/auth/src/*.spec.ts`, `apps/*/src/auth/*.spec.ts`.

- [ ] Add a failing config test showing that absent/blank `JWT_SECRET` throws during module configuration and that a configured value is used for sign and verify.
- [ ] Run `npm test --prefix backend-monorepo -- --runInBand libs/auth/src/jwt-config.spec.ts` and confirm the missing-secret assertion fails before the implementation exists.
- [ ] Add the `auth` Nest library and `@app/auth` path alias; export `JwtAuthGuard`, `RolesGuard`, `@Roles(...)`, `@CurrentUser()` and a validated JWT strategy requiring `sub` plus one of `admin|client|driver`.
- [ ] Replace each API's fallback secret with the shared required `ConfigService` configuration; preserve the existing token response property names and per-client login payload fields while standardizing `sub` and `role`.
- [ ] Add tests for missing secret, malformed claims, valid subject/role and wrong role; run `npm test --prefix backend-monorepo -- --runInBand libs/auth/src`.

**Deliverable:** all three APIs fail closed without `JWT_SECRET` and share one tested JWT/role contract.

### Task 3: Protect HTTP routes and derive actor identity from the token

**Files:**
- Modify: `backend-monorepo/apps/admin-api/src/admin-api.controller.ts`, `apps/client-api/src/auth/auth.controller.ts`, `apps/client-api/src/trips/trips.controller.ts`, `apps/driver-api/src/auth/auth.controller.ts`, `apps/driver-api/src/trips/trips.controller.ts`, relevant auth/trips services and modules.
- Test: extend `apps/admin-api/test/app.e2e-spec.ts`, `apps/client-api/test/app.e2e-spec.ts`, `apps/driver-api/test/app.e2e-spec.ts`; add focused ownership specs beside services.

- [ ] Add failing HTTP tests for unauthenticated admin list, client trip read, driver pending list, wrong-role access, and client A reading client B's trip.
- [ ] Run each target e2e spec and confirm the requests currently succeed or fail the ownership assertion for the expected reason.
- [ ] Protect every admin management route with admin role; keep only health and the login/register/check-phone/catalogue endpoints explicitly public.
- [ ] Protect client trip/profile/password routes; replace body/path `userId` trust with `@CurrentUser().sub`; verify trip ownership before read/cancel/history/stats.
- [ ] Protect driver trip/profile/password routes; scope pending lists, histories, stats and trip reads to authenticated role and assigned driver.
- [ ] Remove request-body logging from registration/authentication and return generic errors without passwords, document data, SQL detail or stack traces.
- [ ] Add Supertest coverage for 401, 403, ownership denial and successful owner/admin access; run `npm test --prefix backend-monorepo -- --runInBand --runTestsByPath apps/admin-api/test/app.e2e-spec.ts apps/client-api/test/app.e2e-spec.ts apps/driver-api/test/app.e2e-spec.ts`.

**Deliverable:** HTTP endpoints enforce role and object ownership, and identity-changing request fields no longer determine the actor.

### Task 4: Authenticate Socket.IO and scope every event

**Files:**
- Modify: `backend-monorepo/apps/driver-api/src/rides/rides.gateway.ts`, `apps/admin-api/src/admin-api.gateway.ts`, relevant trip services, `client-portal/mobile/src/services/socket.js`, `driver-portal/mobile/src/services/socket.js`, `client-portal/frontend/src/pages/Dashboard.jsx`, `driver-portal/frontend/src/pages/Dashboard.jsx`, `admin-portal/frontend/src/pages/Dashboard.jsx`, `admin-portal/frontend/src/pages/Trips.jsx`.
- Test: `backend-monorepo/apps/driver-api/src/rides/rides.gateway.spec.ts` and gateway integration specs.

- [x] Add failing gateway tests that reject missing/invalid token, reject client-supplied role/user spoofing, prevent client A joining client B's room, and reject a driver mutating another driver's trip.
- [x] Run the driver gateway spec and confirm expected authorization failures before implementation.
- [x] Verify JWT in the handshake, store `{id, role}` on `socket.data.actor`, join the server-derived room and ignore `userId`/`role` as identity.
- [x] Authorize trip/driver socket events against the verified actor and persisted trip assignment; availability updates are conditional on driver status `active`.
- [x] Remove client-callable account-control events; secure the admin-to-driver notification endpoint with required `INTERNAL_SERVICE_TOKEN` and `x-internal-service-token` header.
- [x] Replace global trip broadcasts with eligible driver rooms or scoped recipients; emit only after the database operation succeeds.
- [x] Update client mobile and web sockets to send JWTs at handshake; preserve driver mobile token handshake.
- [x] Authenticate the admin namespace and scope it to admin sockets; use its actual driver-status event and bounded REST refresh for trip data, which has no admin socket event yet.
- [x] Restrict production socket CORS to comma-separated `ALLOWED_ORIGINS`; local development remains usable without that setting.
- [x] Run focused gateway/internal-token tests, all three API e2e suites, API typechecks and all three web portal builds.

**Task 4 implementation note:** the old `confirm_payment` socket event issued an invoice and emitted `payment_confirmed`, falsely treating invoice generation as settlement. The handler was removed; an authenticated, persisted cash-confirmation command is Task 7, and the driver UI payment state still needs correction in Tasks 8–9.

**Deliverable:** socket identity comes from JWT and each sensitive event is scoped to an authorized actor/room.

### Task 5: Remove signing assets and unsafe release defaults from tracked source

**Files:**
- Modify: `.gitignore`, `.github/workflows/client-mobile-apk.yml`, `client-portal/mobile/android/app/build.gradle`, `driver-portal/mobile/android/app/build.gradle`, `RELEASE_SIGNING_GUIDE.md`.
- Untrack while preserving local files: `client-release.keystore`, `driver-release.keystore`, `client_base64.txt`, `driver_base64.txt`.
- Test: workflow/config checks and Gradle release-configuration checks that never print secret values.

- [x] Create `scripts/release-signing.test.cjs` using Node `node:test` to check the Gradle release signing configuration refuses missing keystore path/password/alias inputs instead of falling back to a debug or repository key; add the command `node --test scripts/release-signing.test.cjs` to the release check documentation.
- [x] Run `node --test scripts/release-signing.test.cjs` and confirm it fails on the current fallback behavior, then passes after the fix.
- [x] Inspect signing references and variable names only; keystore and Base64 contents were not opened, decoded, or copied. A preexisting literal in the release guide was inadvertently rendered once during inspection; it has been removed and is treated as potentially exposed.
- [x] Configure release signing from CI environment variables and fail release tasks on missing/blank variables or a missing keystore file; retain debug signing for debug builds.
- [x] Remove tracked key/Base64 files from the index while retaining ignored local copies; targeted `.gitignore` rules cover those assets.
- [x] Remove the inline password values from the release guide and document the required secret names and debug/release distinction.
- [x] Confirm the named release keystore/Base64 files are no longer tracked, ignored, and still present locally. The client workflow preflights required secrets and builds an AAB. No new credential value is added; the old guide value remains in existing Git history.
- [x] Document that this does not erase earlier Git history or rotate an existing signing key; history cleanup and any store-key operation remain separate.

**Task 5 verification note:** `node --test scripts/release-signing.test.cjs` passes 10 checks. A direct Gradle release invocation could not reach project configuration because the Gradle daemon failed to establish a loopback connection (`Unable to establish loopback connection`); the config was verified by the Node checks, not by a completed Gradle run.

**Deliverable:** future commits and release builds no longer consume signing materials from tracked files or silently fall back to debug signing.

## Phase 2 — Make trips and money server-authoritative

### Task 6: Define trip transitions and server-authoritative route quotes

**Files:**
- Create: `backend-monorepo/apps/driver-api/src/trips/trip-state.ts`, `trip-state.spec.ts`, and `backend-monorepo/apps/client-api/src/quotes/quotes.module.ts`, `quotes.controller.ts`, `quotes.service.ts`, DTOs and specs.
- Modify: `backend-monorepo/libs/database/prisma/schema.prisma`; add an additive migration for `trip_quotes` and a nullable unique `trips.quote_id` relation.
- Modify: `apps/driver-api/src/trips/trips.service.ts`, `trips.controller.ts`, `rides.gateway.ts`, `apps/client-api/src/trips/trips.service.ts`, `trips.controller.ts`, module wiring and the shared `CreateTripDto`/quote DTOs.
- Test: new `apps/driver-api/src/trips/trips.service.spec.ts` and client service specs.

- [x] Add failing transition tests for requested→accepted, accepted→ongoing, ongoing→completed, cancellation before start, invalid repeated transitions, and two drivers racing for one trip; add quote tests for HERE route response, fare calculation, expiration, wrong owner, replayed/consumed quote, pricing snapshot and altered client price.
- [x] Run `npm test --prefix backend-monorepo -- --runInBand apps/driver-api/src/trips/trip-state.spec.ts apps/driver-api/src/trips/trips.service.spec.ts` and confirm transition assertions fail first.
- [x] Implement one transition table and conditional database updates; retain atomic `updateMany` acceptance and return a conflict when no row changes.
- [x] Implement the quote adapter with server-side `HERE_ROUTING_API_KEY`, fare calculation from the active `service_configs` row and a short expiration; keep HERE HTTP details behind an injectable provider. Persist client owner, route metrics, fare, pricing snapshot, expiry and consumption time in `trip_quotes`.
- [x] Make trip creation atomically consume an unused, unexpired quote owned by the JWT subject, persist its fare/configuration snapshot and reject client-supplied amount or route metrics. Store the unique quote relation on the trip to prevent replay.
- [x] Validate service category/configuration and required origin/destination/delivery fields; calculate the quote from server-returned HERE distance/duration and the server-side `service_configs` row rather than accepting client price as authoritative.
- [x] Derive client and driver IDs from JWT; derive driver display data from persisted profile; set V1 final fare to the stored, consumed server quote and reject driver-supplied final fare values.
- [x] Emit transitions only after commit and add reconnect REST restoration for the current active trip.
- [x] Run focused driver/client trip suites and check Prisma queries remain scoped by actor.

**Deliverable:** trip ownership, transitions and fare are controlled by the server and concurrent accept/cancel operations cannot create contradictory state.

### Task 7: Separate invoice from cash payment settlement

**Files:**
- Modify: `backend-monorepo/libs/database/prisma/schema.prisma`, add a timestamped additive migration under `backend-monorepo/libs/database/prisma/migrations/`, driver trip/payment services and admin invoice/payment routes.
- Test: new payment service specs plus Prisma migration/schema validation.

- [x] Add failing service tests proving finishing a trip creates a charge/invoice but leaves cash settlement pending; only the assigned driver can confirm collection; duplicate confirmation is idempotent; a different amount is rejected.
- [x] Run `npm test --prefix backend-monorepo -- --runInBand apps/driver-api/src/payments` and confirm the missing payment-state behavior.
- [x] Add a `trip_payments` record with trip ID, method `cash`, amount from the persisted final fare, status, confirming actor and timestamps; enforce one active payment record per trip.
- [x] Implement completion and invoice/payment creation in a transaction; implement a role/ownership-checked cash collection command with idempotency.
- [x] Remove invoice creation from the payment-confirm event path; publish `payment_confirmed` only after server persistence.
- [x] Add admin reconciliation fields/actions with audit data; leave card/Multicaixa unavailable until a provider integration exists.
- [x] Create an additive migration and validate it against the Prisma model without applying it to external/production data; document backup and rollout steps.
- [x] Run focused payments/trips tests and Prisma schema validation.

**Deliverable:** invoice issuance no longer claims money was collected, and cash payment has an auditable server record.

## Phase 3 — Make each interface truthful and recoverable

### Task 8: Repair client and driver mobile behavior

**Files:**
- Modify: `client-portal/mobile/src/screens/RideFlowScreen.js`, `DeliveryFlowScreen.js`, history screen/service, `client-portal/mobile/src/screens/PaymentsScreen.js`, `driver-portal/mobile/src/screens/DashboardScreen.js`, `HistoryScreen.js`, `DocumentsScreen.js`, auth/document screens and API/socket services.
- Test: create focused mobile Jest specs under each app's `__tests__/` for online acknowledgement, payment confirmation, history query and unavailable payment options.

- [ ] Add failing component/service tests showing client A cannot rely on payload IDs, mobile driver payment confirmation waits for server acknowledgement, `status=all` is not sent as a literal status filter, and unavailable digital methods cannot be selected.
- [ ] Run `npm test --prefix client-portal/mobile -- --runInBand` and `npm test --prefix driver-portal/mobile -- --runInBand` on the focused specs to observe the expected failures.
- [ ] Change online toggle UI only after the server/socket acknowledgement; on error restore the last server state and present retry guidance.
- [ ] Make mobile payment collection emit the authorized payment command and show success only on `payment_confirmed`; handle timeout by re-fetching the payment record.
- [ ] Align history query names with the API pagination/status contract and omit `status` when requesting all statuses.
- [ ] Hide or disable card/Multicaixa methods while unconfigured; replace false document approval with the persisted review state and explicit unavailable/retry copy.
- [ ] Preserve active trip restoration after reconnect and do not show stale socket payloads as committed state.
- [ ] Run focused mobile Jest suites and lint only on changed files if the configured linter supports file targeting.

**Deliverable:** client and driver screens reflect server-confirmed state and cannot report a payment or approval the server did not record.

### Task 9: Repair the admin portal and remove false actions

**Files:**
- Modify: admin dashboard, trips, client management, configs, pricing, invoices/payments and focused Node tests. Public sites and client/driver web portals are outside the implementation scope per the user's latest direction.
- Test: add focused portal tests for the authenticated socket event contract and receipt availability; backend tests verify realized revenue uses confirmed payment records.

- [x] Add pure adapters/tests for authenticated admin socket event names and receipt-file availability; add a Node test script to the admin frontend manifest.
- [x] Add regression coverage for the gateway event contract and confirmed-payment revenue query.
- [x] Run the admin portal contract tests after implementation.
- [x] Use the authenticated admin socket namespace with gateway event names; retain bounded polling for data without a socket event.
- [x] Remove simulated settings saves: the API has no persistence model for these values, so display them as read-only with a clear explanation. Existing service pricing remains server-persisted.
- [x] Disable receipt export unless an invoice PDF URL exists; remove success feedback that implied a generated artifact.
- [x] Add payment reconciliation with persisted status, confirmer and confirmation time; dashboard revenue now counts confirmed payments only.
- [~] Public-site actions deferred per the user's scope clarification; do not implement landing-page changes.
- [x] Run admin portal contract tests and build; public landing builds excluded by user scope.

**Deliverable:** admin operations use persisted backend state, revenue means confirmed collection, socket events use the backend contract, and unavailable edits/exports are explicit. Settings remain read-only until a runtime-backed settings model is added.

## Phase 4 — Make deployment deterministic

### Task 10: Correct Compose, service-to-service calls and migration startup

**Files:**
- Modify: `docker-compose.prod.yml`, `backend.Dockerfile`, `admin.Dockerfile`, `client.Dockerfile`, `driver.Dockerfile`, `backend-monorepo/package.json`, `backend-monorepo/prisma` scripts and `backend-monorepo/apps/admin-api/src/admin-api.service.ts`.
- Test: Dockerfile/Compose validation and container startup smoke check using a disposable local database only.

- [x] Add configuration checks for required secrets and credentials; verify Compose has no credential fallback defaults.
- [x] Replace container-internal `localhost` with `http://driver-api:3004` and authenticate the internal request with a required server-to-server token.
- [x] Change production API commands to compiled Node entrypoints already produced by the multi-stage build; keep the Nest CLI out of runtime startup.
- [x] Add a migration command that runs once as a deployment step; remove schema push with data-loss acceptance from all production Docker startup commands.
- [x] Add database health/readiness dependency and API health endpoints/healthchecks.
- [~] Compose config and migrations on disposable PostgreSQL passed; Nest build passed. Docker image build failed before compile because Prisma engine download returned ECONNRESET during npm ci; container health/startup remains unverified.
- [x] Update deployment documentation with required variables, migration/backup/rollback sequence and external production checks.

**Deliverable:** clean deployment config builds compiled API images, requires real secrets and performs explicit additive migrations.

## Phase 5 — Verify and hand off

### Task 11: Cross-surface regression and maintenance documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-tot-platform-hardening-design.md`, this plan, `STABILIZATION_STATUS.md` only if a current behavior was actually verified, and the TOT vault pages under the separate Obsidian directory only for code facts that changed.
- Test: backend all suites, client/driver mobile suites, admin/client/driver portal suites, Prisma validation, Docker Compose config, mobile release-config checks.

- [ ] Run focused tests for all changed modules, then the full backend Jest suite.
- [ ] Run mobile Jest suites and portal lint/build commands available in their manifests.
- [ ] Run `npx prisma validate --schema libs/database/prisma/schema.prisma` from `backend-monorepo` and validate the migration on a disposable local database.
- [ ] Run `docker compose -f docker-compose.prod.yml config` with dummy non-secret required variables and ensure no secret value is printed.
- [ ] Re-scan the code diff for credential literals and tracked release assets; re-check `git status` and list every changed file.
- [ ] Update the vault snapshot note paths/claims to reflect implementation and mark all production/store/secret-rotation checks as `Por confirmar` until an operator performs them.
- [ ] Produce a final review summary with changes, commands/results, external blockers and migration/release steps. Do not deploy or push.

**Deliverable:** a reviewed change set with regression evidence and a handoff that distinguishes local code completion from production rollout.



**Task 6 verification note (13/10/2026):** 6 focused suites / 38 tests passed; 4 e2e suites / 24 tests passed; client and driver TypeScript checks and Nest builds passed; Prisma schema validation passed; Babel transformed both changed mobile screens. Mobile ESLint is unavailable because this app has no ESLint config. The new additive migration was not applied to any database. A HERE key remains embedded for map/autocomplete only; verify provider restrictions externally. The unused mobile routing helper was removed; fare routing now uses the server provider.
**Task 6 commit:** 5a463a (ix(trips): persist server-authoritative quotes).


**Task 7 verification note (13/10/2026):** payment/trips/gateway focused tests: 3 suites / 25 tests passed; API e2e: 4 suites / 25 tests passed; driver/admin typechecks and Nest builds passed; Prisma schema validation passed. Migration not applied. Rollout/rollback notes are in `docs/deployment/trip-payments-migration.md`.
