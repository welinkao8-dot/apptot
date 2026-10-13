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

- [x] Change provider test to assert `return` includes both `summary` and `polyline`; make mocked API omit geometry unless requested.
- [x] Run provider test and observe RED because current request asks for `summary` only.
- [x] Request `summary,polyline`; reject missing/empty summary or geometry instead of returning a quote that cannot display a route.
- [~] Existing client screen already calls `drawRoute` when a quote contains geometry; per-service route choice is tested in Task 3.
- [x] Focused HERE provider suite passed 4/4; per-service route geometry remains in Task 3.

**Deliverable:** quote metrics and displayed line originate from one valid HERE route response.

### Task 3: Route correctly for the configured vehicle class

**Files:**
- Modify: `backend-monorepo/apps/client-api/src/quotes/here-routing.provider.ts`, `quotes.service.ts`, quote DTO/types.
- Test: `backend-monorepo/apps/client-api/src/quotes/here-routing.provider.spec.ts`, `quotes.service.spec.ts`.
- Review: `backend-monorepo/libs/database/prisma/schema.prisma` service vehicle/category fields and admin service configuration.

- [ ] Add tests that a car service requests `car` and a configured moto service requests HERE `scooter` mode.
- [x] Run tests RED against the current unconditional `transportMode=car`.
- [x] Derive routing mode from persisted service configuration; compute one route per unique mode per quote request; return matching metrics/polyline with each service quote.
- [x] Test unsupported route mode and vehicle/mode mismatch fail explicitly instead of silently selecting car.
- [x] Verify Prisma and quote tests and ensure pricing snapshots store route/mode inputs used to quote.

**Deliverable:** service comparisons use road rules and price inputs for the actual vehicle class.

### Task 4: GPS origin consent, search and map selection

**Files:**
- Modify: `client-portal/mobile/src/screens/DashboardScreen.js`, `RideFlowScreen.js`, `DeliveryFlowScreen.js`, `services/hereService.js`, location permission config as required.
- Test: mobile tests for permission denied, location timeout/stale location, manual map pin, address search and reverse geocode failure.

- [~] Backend RED/GREEN tests reject the fallback and invalid coordinates; automated device permission-denied test remains outstanding.
- [~] Removed silent pickup fallback; GPS is time-bounded and both mobile apps support manually placing pickup on the map when GPS is unavailable. Explicit permission-state UI remains outstanding.
- [~] Quote service rejects zero, out-of-Angola and legacy placeholder coordinates before routing; address/coordinate correspondence is not verified against HERE.
- [~] Manual pickup is reflected in address/map state; a dedicated final confirmation screen and device-level location override test remain outstanding.
- [~] Quote service tests passed and the changed mobile screens passed Babel parsing; no device permission/location test or client API typecheck is available.

**Deliverable:** the app never creates a trip from an unconfirmed placeholder location.

### Task 5: Quote selection, expiry and immutable price display

**Files:**
- Modify: `backend-monorepo/apps/client-api/src/quotes/quotes.service.ts`, quote DTO/controller, `backend-monorepo/apps/driver-api/src/trips/trips.service.ts`.
- Modify: both mobile flow screens and quote API service.
- Test: quote service and mobile quote UX specs; client/driver API e2e.

- [~] Service tests cover invalid coordinates, mode/service mismatch, expired/used quote and wrong owner; no client/driver API e2e added for every mismatch case.
- [x] Quote id is persisted with the server-side owner/category/service/coordinates/price snapshot and atomic TTL/single-use consumption.
- [x] Both client mobile flows display server-returned distance, ETA and price; selected service retains its matching quote id and route geometry.
- [x] Expired client quote is recalculated and service selection is cleared, requiring the customer to inspect and select the refreshed quote again.
- [~] Quote/trip focused tests and client mobile tests pass; device UX and full ride/delivery e2e remain outstanding.

**Deliverable:** every request has a fresh, customer-visible server quote tied to exact route inputs.

## Phase 2 — Reliable customer request and driver dispatch

### Task 6: ACK-driven and idempotent trip request

**Files:**
- Modify: `backend-monorepo/apps/client-api/src/trips/trips.service.ts`, `backend-monorepo/apps/driver-api/src/trips/trips.service.ts`, shared DTOs/Prisma quote relation if needed.
- Modify: `backend-monorepo/apps/driver-api/src/rides/rides.gateway.ts`.
- Modify: client mobile socket service and `RideFlowScreen.js`, `DeliveryFlowScreen.js`.
- Test: trips service/gateway specs, API e2e, mobile socket/request specs.

- [~] Persisted trip ACK and retry idempotency tests pass; REST reconciliation was added, but end-to-end ACK loss/rejection UI simulation remains outstanding.
- [x] Create-from-quote now returns the existing trip for the same authenticated owner and quote, including concurrent retry recovery after a unique conflict.
- [x] Gateway returns structured ACK (`tripId`, committed status/time); existing trip-created subscriptions and ACK update the same client state idempotently.
- [~] Mobile request waits up to 10 seconds for ACK then reconciles active trip via REST and reports failure; socket reconnect/retry UI and server-side transport-error e2e remain outstanding.
- [x] Client does not enter searching until ACK/event or REST confirms a persisted trip.
- [~] Trip/gateway suites (16), mobile suites (4), Nest build and Babel parse pass; API e2e and physical reconnect tests remain outstanding.

**Deliverable:** client request has one durable result even when socket acknowledgement is delayed or lost.

### Task 7: Persist offers and match eligible drivers

**Files:**
- Modify: `backend-monorepo/libs/database/prisma/schema.prisma`; add migration under `libs/database/prisma/migrations/`.
- Modify: `backend-monorepo/apps/driver-api/src/trips/trips.service.ts`, `rides/rides.gateway.ts`, pending-trip controller/service.
- Modify: `driver-portal/mobile/src/screens/DashboardScreen.js`, request service.
- Test: new dispatch service specs, gateway specs, e2e for driver eligibility/race/reconnect.

- [~] Nearest/rank and eligible-offer tests added; offline, stale, busy-driver DB and live scheduler tests remain.
- [x] Added `trip_driver_offers`, unique trip/driver, response/expiry fields, indexes and migration; timeout expires unanswered offers.
- [~] Haversine selects nearest 5 connected, active, online drivers with location ≤120 s old; scheduler expands batches after 15 s. Batch size/time are code defaults, not operational config.
- [x] One transaction claims the unexpired offer, conditionally assigns the trip, and cancels remaining offers; losing races roll back.
- [x] Pending REST and reconnect return only authenticated-driver unexpired persisted offers; active work is restored separately.
- [ ] Still open: persist immediate no-driver terminal reason and expose customer retry/edit; cleanup currently waits for orphan timeout.
- [~] Service, ranking and targeted gateway tests pass; concurrent offer/DB migration, offline transition and restart-scheduler integration tests remain.

**Deliverable:** offers are targeted, recoverable and cannot be accepted by the wrong or multiple drivers.

### Task 8: Request delivery and notification behavior

**Files:**
- Modify: `driver-portal/mobile/src/screens/DashboardScreen.js`, `RequestDetailsScreen.js`, Android notification setup only where supported.
- Modify: API offer response and optional push-token registration/provider only if project configuration supports it.
- Test: driver mobile notification event, duplicate suppression, foreground/background reconnection, pending-offer recovery.

- [~] New offers are deduplicated, added to the visible dashboard list and announce by haptic/in-app toast; no automatic route navigation. Android local notification channel is not added.
- [x] Dashboard fetches authenticated driver offers on focus, app resume and socket online/reconnect; cards remove expired offers and trip_taken updates the list.
- [ ] Local Android notification channel/runtime notification flow remains open; only in-app toast/haptic is implemented.
- [x] No FCM provider/credentials are configured in this app; no push token or app-killed push is claimed.
- [~] Gateway/service suites and driver mobile socket/UI tests pass; duplicate event/reconnect behavior still needs device/integration QA.

**Deliverable:** no offer is lost merely because the driver's screen changed; true app-killed push is only claimed when configured and tested.

## Phase 3 — Driver execution, external maps and location

### Task 9: Real request details and exact navigation targets

**Files:**
- Modify: `backend-monorepo/apps/driver-api/src/trips/trips.service.ts` formatter and query selection.
- Modify: `driver-portal/mobile/src/screens/RequestDetailsScreen.js`, `components/ride/GoingToClientView.js`, `OngoingRideView.js`, `utils/openNavigation.js`.
- Test: formatter unit tests and driver screen/navigation helper tests.

- [~] Remove fabricated pickup distance/time and Marco/rating/trip-count fallbacks; server route distance/ETA remain quote estimates. Formatter test added; component rendering checks remain.
- [x] Keep pickup and destination targets separate; validate coordinate range (including zero), use platform map URI, try Google Maps web fallback and return visible failure result.
- [x] Offer timer is tied to persisted `offerExpiresAt`; missing/invalid expiry now displays unavailable and does not run a NaN countdown.
- [~] Android URI/fallback unit tests pass; manual checks with Google Maps, Waze/HERE and device fallback remain.

**Deliverable:** driver sees truthful order data and navigation always targets the correct stage.

### Task 10: Driver GPS lifecycle and client live location

**Files:**
- Modify: `driver-portal/mobile/src/screens/DashboardScreen.js`, `android/.../LocationService.java`, `LocationModule.java`, manifest and permission flow.
- Modify: `backend-monorepo/apps/driver-api/src/rides/rides.gateway.ts`, trips location service, client mobile trip screens.
- Test: location validation/broadcast service tests and client map update tests; manual Android foreground/background matrix.

- [~] RED tests reject invalid/out-of-range coordinates, stale timestamps and poor accuracy. Location events require the authenticated driver and broadcast only to the active trip client; implausible-jump and multi-socket integration tests remain.
- [~] Android now sends accuracy/timestamp/heading; API validates finite coordinate bounds, accuracy ≤100m and timestamp within 120s, and broadcasts metadata. DB only stores coarse lat/lng every 30s; persist full telemetry remains open.
- [ ] Maintain Android foreground service when navigating externally; start only after permission/online and stop on offline/logout; handle service start failures and settings revocation visibly.
- [ ] Persist current driver location with timestamp at bounded cadence; broadcast live fixes only to active trip client, rate-limited and with accuracy metadata.
- [~] Client shows waiting/fresh/stale state, removes stale marker after 30 s, and clears map at terminal trip; physical timing/device behavior remains unverified.
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
