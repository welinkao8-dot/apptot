# TOT Trip Lifecycle Implementation Plan

> **For agentic workers:** Execute inline task-by-task with `test-driven-development`; this is the user's existing checkout, and worktrees are explicitly disallowed. Update the Obsidian ledger before each phase and after each completed phase.

**Goal:** Make customer and driver mobile apps plus APIs support a complete, truthful, secure, recoverable ride/delivery-to-cash-payment flow.

**Architecture:** Keep NestJS, Prisma/PostgreSQL, Socket.IO, HERE and React Native. Make backend persistence authoritative; separate quote estimates, live GPS and paid status; provide socket events for speed and REST reconciliation for reliability.

**Tech Stack:** TypeScript, NestJS, Prisma, PostgreSQL, Socket.IO, React Native, native Android foreground location service, HERE Routing/Geocoding, Jest.

**Spec:** `docs/superpowers/specs/2026-10-13-tot-trip-lifecycle-design.md`

## Global constraints

- Work directly in current checkout; no worktree, push, deploy, Coolify operation, or local APK generation.
- Scope is client/driver mobile, APIs, and only admin views needed to observe/settle trips; no public site or client/driver web portals.
- V1 fare is fixed at the customer-accepted server quote; actual GPS distance never silently changes the price.
- Cash is the only active payment method; digital methods must remain unavailable without a real provider.
- Write behavior tests first and observe RED before changing production behavior.
- Update `C:\Users\Zoé - Pixelhub\Documents\Obsidian\TOT Vault` before starting each phase and at its closure.
- Never claim phone/background/push behavior passed without a real Android device or provider configuration.

---

## Phase 0 — Freeze the contract and test inventory

### Task 1: Baseline trip/payment state matrix and test helpers

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-tot-trip-lifecycle-design.md`
- Modify: `docs/superpowers/plans/2026-10-13-tot-trip-lifecycle.md`
- Test: existing Nest specs in `backend-monorepo/apps/{client-api,driver-api}/src/**` and e2e specs under each `test/`.
- Test: new mobile specs under `client-portal/mobile/src/__tests__/` and `driver-portal/mobile/src/__tests__/` using installed Jest/Babel setup.

- [ ] Record exact permitted states and actor for quote, requested, offered, accepted, ongoing, completed/payment-pending, payment-confirmed and cancelled; include timeout/no-driver terminal behavior.
- [ ] Add/extend a transition table test proving invalid/replayed transitions fail and only one concurrent accept succeeds.
- [ ] Run these tests before any production code change; record existing gaps and baseline output in Obsidian.

**Deliverable:** the implementation and tests share an explicit state/actor contract.

## Phase 1 — HERE routing, map geometry and quote correctness

### Task 2: Request real route geometry and validate HERE responses

**Files:**
- Modify: `backend-monorepo/apps/client-api/src/quotes/here-routing.provider.ts`
- Test: `backend-monorepo/apps/client-api/src/quotes/here-routing.provider.spec.ts`
- Modify: `client-portal/mobile/src/screens/RideFlowScreen.js`, `DeliveryFlowScreen.js`
- Test: new quote/route presentation tests under each mobile app's `src/__tests__/`.

- [ ] Change provider test to assert `return` includes both `summary` and `polyline`; make mocked API omit geometry unless requested.
- [ ] Run provider test and observe RED because current request asks for `summary` only.
- [ ] Request `summary,polyline`; reject missing/empty summary or geometry instead of returning a quote that cannot display a route.
- [ ] Update mobile tests to assert quote selection draws the selected service's server geometry, not just origin/destination markers.
- [ ] Run focused provider and screen tests; verify all route options render matching geometry and ETA.

**Deliverable:** quote metrics and displayed line originate from one valid HERE route response.

### Task 3: Route correctly for the configured vehicle class

**Files:**
- Modify: `backend-monorepo/apps/client-api/src/quotes/here-routing.provider.ts`, `quotes.service.ts`, quote DTO/types.
- Test: `backend-monorepo/apps/client-api/src/quotes/here-routing.provider.spec.ts`, `quotes.service.spec.ts`.
- Review: `backend-monorepo/libs/database/prisma/schema.prisma` service vehicle/category fields and admin service configuration.

- [ ] Add tests that a car service requests `car` and a configured moto service requests HERE `scooter` mode.
- [ ] Run tests RED against the current unconditional `transportMode=car`.
- [ ] Derive routing mode from the persisted service configuration; compute/cache one route per unique mode per quote request; return correct route metrics/polyline alongside each service quote.
- [ ] Test unknown vehicle class fails with an explicit configuration error rather than silently selecting car.
- [ ] Verify Prisma and quote tests and ensure pricing snapshots store route/mode inputs used to quote.

**Deliverable:** service comparisons use road rules and price inputs for the actual vehicle class.

### Task 4: GPS origin consent, search and map selection

**Files:**
- Modify: `client-portal/mobile/src/screens/DashboardScreen.js`, `RideFlowScreen.js`, `DeliveryFlowScreen.js`, `services/hereService.js`, location permission config as required.
- Test: mobile tests for permission denied, location timeout/stale location, manual map pin, address search and reverse geocode failure.

- [ ] Add failing tests proving a denied GPS request cannot silently quote from the Luanda fallback and user can explicitly set/confirm pickup.
- [ ] Replace silent fallback with states `locating`, `ready`, `permission_required`, `location_unavailable`; retain a map pin/manual-address option.
- [ ] Validate coordinate bounds and reject zero/missing/out-of-market coordinates on API quote DTO; validate address corresponds to selected coordinates where provider support allows.
- [ ] Show the confirmed pickup and selected destination before quote; ensure location updates do not overwrite a manually pinned pickup without user action.
- [ ] Test ride and delivery location states and verify API contract/typecheck.

**Deliverable:** the app never creates a trip from an unconfirmed placeholder location.

### Task 5: Quote selection, expiry and immutable price display

**Files:**
- Modify: `backend-monorepo/apps/client-api/src/quotes/quotes.service.ts`, quote DTO/controller, `backend-monorepo/apps/driver-api/src/trips/trips.service.ts`.
- Modify: both mobile flow screens and quote API service.
- Test: quote service and mobile quote UX specs; client/driver API e2e.

- [ ] Add RED tests for category/service mismatch, invalid coordinate pairs, expired quote, used quote, wrong owner and per-service route/pricing snapshot.
- [ ] Ensure quote id is bound to owner/category/service/mode/coordinates/route/pricing and expires after its stated TTL.
- [ ] Display server-returned distance, ETA and exact Kz amount for each service; selecting a service selects its matching geometry and quote id.
- [ ] When quote expires before request, request a fresh quote and require customer to reconfirm if amount changed; never silently submit a new price.
- [ ] Test ride and delivery quote creation, single use, price rounding/minimum and snapshot stability.

**Deliverable:** every request has a fresh, customer-visible server quote tied to exact route inputs.

## Phase 2 — Reliable customer request and driver dispatch

### Task 6: ACK-driven and idempotent trip request

**Files:**
- Modify: `backend-monorepo/apps/client-api/src/trips/trips.service.ts`, `backend-monorepo/apps/driver-api/src/trips/trips.service.ts`, shared DTOs/Prisma quote relation if needed.
- Modify: `backend-monorepo/apps/driver-api/src/rides/rides.gateway.ts`.
- Modify: client mobile socket service and `RideFlowScreen.js`, `DeliveryFlowScreen.js`.
- Test: trips service/gateway specs, API e2e, mobile socket/request specs.

- [ ] Test RED: accepted quote request is persisted before ACK; replay after ACK loss returns the same trip; quote rejection is surfaced to the customer.
- [ ] Make create-from-quote idempotent by quote ID + authenticated owner; do not create duplicate trip/payment on retry.
- [ ] Return structured ACK with `tripId`, committed status and timestamp; subscribe client to events before emitting and handle both ACK and event idempotently.
- [ ] Make client request loading/retry states explicit; handle socket disconnected, timeout, validation error and quote expiry with REST reconciliation.
- [ ] Do not show indefinite “searching” when request was rejected or not persisted.
- [ ] Run service/gateway/e2e/mobile tests and verify reconnect recovers active trip through REST.

**Deliverable:** client request has one durable result even when socket acknowledgement is delayed or lost.

### Task 7: Persist offers and match eligible drivers

**Files:**
- Modify: `backend-monorepo/libs/database/prisma/schema.prisma`; add migration under `libs/database/prisma/migrations/`.
- Modify: `backend-monorepo/apps/driver-api/src/trips/trips.service.ts`, `rides/rides.gateway.ts`, pending-trip controller/service.
- Modify: `driver-portal/mobile/src/screens/DashboardScreen.js`, request service.
- Test: new dispatch service specs, gateway specs, e2e for driver eligibility/race/reconnect.

- [ ] Test RED for drivers offline, disconnected, suspended, already assigned a trip, stale/no GPS, and far vs nearest candidate; only eligible online-connected drivers are offered.
- [ ] Add durable offer records with trip/driver, offered/accepted/rejected/expired state, offered/expiry timestamps, unique `(trip_id, driver_id)`; add indexes and migration rollback/runbook.
- [ ] Select candidates using fresh persisted coordinates and a tested Haversine helper; offer nearest eligible candidates in configurable batches, then expand to next batch after 15-second offer window; do not invent a max radius.
- [ ] Use database conditional update/transaction so one driver wins; persist winning offer and expire other offers before notifying clients.
- [ ] Replace generic pending list with the authenticated driver's unexpired offers; reconnect returns only actionable offers and active trip.
- [ ] When candidates are exhausted, persist terminal no-driver/cancelled reason immediately and emit a customer-visible retry state; do not wait for orphan cleanup.
- [ ] Test parallel accepts, cancelled trip, expired offer, driver going offline during offer, duplicate notifications and service restart recovery.

**Deliverable:** offers are targeted, recoverable and cannot be accepted by the wrong or multiple drivers.

### Task 8: Request delivery and notification behavior

**Files:**
- Modify: `driver-portal/mobile/src/screens/DashboardScreen.js`, `RequestDetailsScreen.js`, Android notification setup only where supported.
- Modify: API offer response and optional push-token registration/provider only if project configuration supports it.
- Test: driver mobile notification event, duplicate suppression, foreground/background reconnection, pending-offer recovery.

- [ ] Replace haptic-only new request handling with a visible in-app offer list/card and actionable notification while the app process/socket is available.
- [ ] On foreground/resume/reconnect fetch unexpired offers and reconcile accepted/cancelled/expired state before navigating.
- [ ] Add real Android notification permission/channel and local notification for a received socket offer; avoid navigating over an unrelated active screen without user action.
- [ ] If FCM credentials/configuration already exist, register/rotate device token and send high-priority data notification through server; otherwise keep token provider disabled with explicit config requirement and do not claim push works when app is killed.
- [ ] Test notification duplicates, app resume, socket reconnect and lost/expired offer; document FCM/APNs as an external readiness requirement if not configured.

**Deliverable:** no offer is lost merely because the driver's screen changed; true app-killed push is only claimed when configured and tested.

## Phase 3 — Driver execution, external maps and location

### Task 9: Real request details and exact navigation targets

**Files:**
- Modify: `backend-monorepo/apps/driver-api/src/trips/trips.service.ts` formatter and query selection.
- Modify: `driver-portal/mobile/src/screens/RequestDetailsScreen.js`, `components/ride/GoingToClientView.js`, `OngoingRideView.js`, `utils/openNavigation.js`.
- Test: formatter unit tests and driver screen/navigation helper tests.

- [ ] Test RED that request payload includes real route distance/ETA/vehicle/name and no fake `4.2 km`, `Marco Silva`, rating or trip-count fallback.
- [ ] Expose persisted quote distance/duration/price snapshot safely in offered trip format; display those figures as estimates.
- [ ] Keep pickup and destination coordinates distinct; open external chooser to pickup before start and destination only after accepted start; validate coordinates and show fallback error if no compatible app/browser opens.
- [ ] Remove misleading trip timer unless it matches persisted offer expiry; display server `expiresAt` and close/refresh only for that offer.
- [ ] Verify external URI on Android unit-level and document manual checks for Google Maps, Waze/HERE and fallback.

**Deliverable:** driver sees truthful order data and navigation always targets the correct stage.

### Task 10: Driver GPS lifecycle and client live location

**Files:**
- Modify: `driver-portal/mobile/src/screens/DashboardScreen.js`, `android/.../LocationService.java`, `LocationModule.java`, manifest and permission flow.
- Modify: `backend-monorepo/apps/driver-api/src/rides/rides.gateway.ts`, trips location service, client mobile trip screens.
- Test: location validation/broadcast service tests and client map update tests; manual Android foreground/background matrix.

- [ ] Add RED tests for no active trip, wrong driver, invalid/out-of-range coordinates, stale/poor accuracy, implausible jumps and unauthorized client subscription; only assigned trip client receives location.
- [ ] Send location payload with accuracy, timestamp and heading; validate finite bounds and reject bad fixes before database/broadcast.
- [ ] Maintain Android foreground service when navigating externally; start only after permission/online and stop on offline/logout; handle service start failures and settings revocation visibly.
- [ ] Persist current driver location with timestamp at bounded cadence; broadcast live fixes only to active trip client, rate-limited and with accuracy metadata.
- [ ] Client displays last update/stale state instead of implying live position forever; clear driver marker after terminal transition.
- [ ] Ensure actual observed GPS distance (if collected) is labeled telemetry and never changes accepted fare; avoid treating external Maps distance as server data.
- [ ] Run Android lint/unit/build tasks available; leave background-kill/doze proof pending device QA where an emulator cannot guarantee it.

**Deliverable:** external navigation and TOT's own validated location tracking coexist without changing the agreed fare.

### Task 11: Driver state transition UI and interruption recovery

**Files:**
- Modify: driver mobile dashboard/ride components, `socketCommands.js`, `AuthContext`, API sync helpers.
- Test: driver screen/service tests for offline/online, accept, start, finish, cancel, app restart and payment pending.

- [ ] Await ACK before changing online state or moving between accepted/ongoing/finished; on timeout reconcile REST before retry.
- [ ] On accepted trip, persist only trip ID/status locally and fetch authoritative detail; do not cache a stale offer object as truth.
- [ ] Add explicit reconnect/resume reconciliation; active trip, completed pending payment and terminal trips render correct state.
- [ ] Handle account suspension, offline loss, rejected command and trip cancelled while the map app is foreground.
- [ ] Test state transitions and offline/online recovery with duplicate events.

**Deliverable:** app restart or network loss does not lose or falsify the driver's active work.

## Phase 4 — Trip states, cancellation and quote/offer races

### Task 12: One state machine for ride and delivery

**Files:**
- Modify: `backend-monorepo/apps/driver-api/src/trips/trip-state.ts`, `trips.service.ts`, `rides.gateway.ts`; shared response DTOs.
- Test: state table, service concurrency tests, all API e2e suites.

- [ ] Enumerate legal transition edges and actor per edge for ride/delivery; include requested→offered, accepted, ongoing, completed, cancelled, expired/no-driver, payment-pending and payment-confirmed.
- [ ] Add failing tests for invalid order, second start/finish, driver/client ID spoof, cancel-vs-accept race, cancel-vs-start race, finish-vs-cancel race and duplicate command.
- [ ] Implement conditional writes/transaction for each transition and return current persisted state for idempotent retries.
- [ ] Emit events only after commit with common event envelope: eventId, tripId, status, server timestamp, payload version.
- [ ] Make client/driver REST projections share statuses/fields and sanitize personal data; ensure delivery recipient details are shown only to assigned parties.
- [ ] Run all state/API/gateway tests and typechecks.

**Deliverable:** ride and delivery statuses cannot contradict across DB, socket and screens.

### Task 13: Cancellation, timeout and no-driver recovery

**Files:**
- Modify: client/driver mobile flow screens; driver-api gateway/dispatch worker; client/driver trip controllers/services.
- Test: cancellation reason/state service tests, gateway/e2e, mobile UX.

- [ ] Define allowed cancel actor/status and optional reason; reject cancellation once ongoing unless an explicit supported emergency flow exists.
- [ ] Test client cancel before accept, driver decline, driver offline, offer expiry, all candidates exhausted, cancel-vs-accept and repeated cancel.
- [ ] Persist cancellation/no-driver reason and actor; release offers; notify only client, offered drivers and assigned driver as appropriate.
- [ ] Display recoverable action (“tentar novamente”, edit destination) without reusing an expired/consumed quote silently.
- [ ] Replace unbounded orphan polling outcome with idempotent offer expiry and a bounded cleanup for stale records.
- [ ] Run time-controlled tests without real sleeping and verify no active ghost trip remains.

**Deliverable:** every unsuccessful request ends in a visible, persisted and retryable result.

## Phase 5 — Fare, completion and payment

### Task 14: Fare contract and receipt correctness

**Files:**
- Modify: client quote screens, driver trip screens, `driver-api/trips.service.ts`, admin reconciliation only if needed.
- Test: quote snapshot/final fare/payment amount tests and mobile display tests.

- [ ] Show customer that quoted Kz amount is fixed for this V1 trip; show driver the same amount and mark route distance/ETA as estimates.
- [ ] Test service pricing changes after quote do not alter existing trip, driver payload cannot change final fare, and new quote reflects new pricing.
- [ ] At finish copy accepted fare exactly; do not derive final fare from client, driver, navigation app, elapsed clock or raw GPS.
- [ ] Remove estimates from displays that imply actual distance/earnings; ensure receipts label fare and collected cash separately.
- [ ] Validate rounding, zero/negative prices, decimals, minimum fares, currency display and delivery-specific service.

**Deliverable:** client, driver, admin and database agree on a fixed accepted fare and call it by the right name.

### Task 15: Cash settlement, retry and reconnection

**Files:**
- Modify: `backend-monorepo/apps/driver-api/src/payments/payments.service.ts`, gateway/controller and client/driver payment screens.
- Test: payment unit/e2e, duplicate/concurrent confirm, timeout reconciliation and mobile payment state tests.

- [ ] Test completion creates one pending cash payment/invoice atomically and never counts as revenue before confirmed.
- [ ] Test only assigned driver can confirm exact amount; zero/wrong amount/replayed event/concurrent request are deterministic and idempotent.
- [ ] On cash confirm persist actor/time first; emit event after commit; return canonical `paymentId`, amount and status in ACK.
- [ ] Client and driver fetch payment status after reconnect, app resume and ACK timeout; do not reset active payment UI while status is unknown/pending.
- [ ] Show clear `pending`, `confirmed`, and actionable failure state; digital methods stay visibly unavailable.
- [ ] Run payment service/gateway/e2e/mobile suites and reconcile admin totals.

**Deliverable:** a completed trip is not mistaken for money received, and payment confirmation survives retries and disconnections.

## Phase 6 — Full regression and release handoff

### Task 16: End-to-end journey matrix and mobile manual QA

**Files:**
- Modify: `backend-monorepo/apps/{client-api,driver-api}/test/app.e2e-spec.ts`, mobile specs, `docs/deployment/trip-payments-migration.md` only if migrations changed.
- Create: `docs/qa/tot-trip-lifecycle.md` with executable manual scenarios.
- Update: TOT Obsidian pages and this plan.

- [ ] E2E normal ride: client quote/select/request → eligible driver offer/accept → pickup/start → external destination → finish → pending cash → confirm → client success/admin confirmed revenue.
- [ ] E2E normal delivery with recipient/package fields and privacy/ownership checks.
- [ ] E2E no-driver, stale GPS, service unavailable, route provider timeout, denied location, quote expiry, duplicate request, disconnect after create, reconnect with active trip, driver goes offline, simultaneous accept, cancel races, duplicate finish, payment timeout, payment retry, app state restore.
- [ ] Run backend all focused suites/e2e, API typechecks/Nest build, mobile Jest/Babel/lint/build tasks actually available, Prisma validate/migration disposable DB, and deployment-config test (no deploy).
- [ ] Manual QA on Android: denied/approximate/precise permission, GPS off, app background while external navigation open, screen locked, process killed/reopened, two devices competing for one offer, weak network, notification permission, cash confirmation on both phones.
- [ ] Record every manual check as pass/fail/not run; do not claim device or FCM delivery works without evidence.
- [ ] Run security/privacy scan for keys, fake UI defaults, cross-user data, uncontrolled socket events, duplicate payments, and stale location.
- [ ] Update Obsidian `01`, `03`, `05`, `06`, `10`, and `PLANS/Progress.md` with final implementation, results, unresolved external requirements, and next task.

**Deliverable:** an auditable, testable handoff with every flow and exception accounted for; deployment/FCM/device configuration remains clearly separated from code verification.

