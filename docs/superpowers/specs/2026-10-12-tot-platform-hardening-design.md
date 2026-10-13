# TOT platform hardening — design

**Date:** 2026-10-12  
**Baseline:** `main` at `c98cd16`  
**Approval basis:** the user requested the complete phased plan and authorized implementation/corrections, then explicitly directed work to continue in the project checkout instead of a worktree.

## Objective

Make the existing TOT client, driver and admin surfaces behave as one secure, auditable trip service. Close identity/authorization gaps first, make trip/payment state server-authoritative, remove false success in the interfaces, and make the declared deployment reproducible. Preserve the current NestJS monorepo and mobile/web surfaces unless a concrete implementation defect requires a focused change.

## Approach considered

1. **Incremental hardening (selected):** retain NestJS, PostgreSQL/Prisma, Socket.IO, React Native and existing web portals; fix trust boundaries and contracts in dependency order. This gives the shortest route to secure existing users and makes each change independently reviewable.
2. **Rewrite as one new platform:** defer product fixes until a replacement is built. Rejected because it increases migration and release risk while leaving the current exposed routes active.
3. **UI-first polish:** complete the visible screens before server controls. Rejected because improved screens would still call insecure or inconsistent APIs.

## Domain rules

- The authenticated JWT establishes the actor's `sub` and role (`admin`, `client`, or `driver`). A request body, route parameter, Socket.IO payload, display name, or room name never establishes identity.
- A client may create and read only their own trips. A driver may receive offers while eligible, accept one unassigned trip, and mutate only trips assigned to that driver. An administrator may perform management operations through authenticated admin routes.
- The server owns trip status transitions, assigned identities, fare quotes, final fare, invoice creation and payment state. The backend obtains route distance/duration from HERE using a server-side key and persists a short-lived quote owned by the client, including a snapshot of service pricing. A trip request consumes the quote once in the same transaction that creates the trip; V1 final fare equals the accepted server quote. Events announce committed state; they do not replace persistence.
- Initial supported payment method remains cash because no payment provider/account was identified. An invoice records a charge/receipt; it does not mean cash was collected or a digital payment settled. Digital options stay unavailable until a provider is integrated.
- Driver verification is a review state, not a side effect of a document filename being present. Until durable document storage and reviewer decisions are configured, the UI must state what is unavailable instead of presenting unverified documents as approved.
- External production state, credential rotation, store submissions, support contacts and payment-provider onboarding cannot be inferred from this checkout.

## Security and service design

- Require `JWT_SECRET` through validated configuration at startup; no source-code fallback. Issue and verify a consistent subject/role contract across the three APIs.
- Add shared Nest authentication/role primitives in `backend-monorepo/libs/auth`. Protect admin operations by role; protect user endpoints by role plus ownership checks. Keep login/register and explicitly public catalogue/health routes public.
- Authenticate Socket.IO handshakes with the same JWT. Derive the socket actor from verified claims; authorize every trip/status/location event against database state and emit trip data only to authorized rooms. Remove public control events for suspending/activating accounts; use an authenticated server-to-server route.
- Never log request bodies containing credentials, documents or personal data. Restrict CORS to configured origins in deployed services.
- Remove release signing material from tracked source and require CI-provided signing inputs. Do not rewrite shared Git history or publish changes from this task.

## Trip and payment behavior

- Preserve the existing service categories and fare configuration. Validate request coordinates, service configuration, category and delivery fields on the server. Add a server-side quote endpoint that uses HERE routing and a private `HERE_ROUTING_API_KEY`, computes the configured fare, and persists a short-lived quote owned by the authenticated client, with a pricing snapshot and one-time consumption. The trip request consumes the quote and stores its fare snapshot; the client cannot submit an authoritative price.
- Define allowed trip transitions in one service boundary and reject invalid transitions. Accept remains atomic. Derive client/driver IDs from auth; derive final fare from stored server-side trip/pricing data, never from a driver-supplied final amount.
- Persist a cash payment record distinct from the invoice, with an explicit pending/collected/disputed/refunded state and actor/timestamps. Create/update invoice and payment in a transaction. No external card or Multicaixa charge is simulated.
- Emit Socket.IO updates only after successful persistence; clients reconcile from REST after reconnect.

## Interface behavior

- Client app: only expose available payment methods; show server-confirmed matching/trip/payment status; correct history parameters; show a clear retry/offline state.
- Driver app: commit online/offline only after server acknowledgement; send the auth token in the socket handshake; reconcile ride state; send payment confirmation only through the authorized server flow; present account/document review truthfully.
- Admin portal: align Socket.IO namespace/event names; keep REST polling as a bounded recovery path; make service settings persist through API; disable receipt export until an actual export exists; show failures instead of success toasts.
- Safety features such as emergency dispatch or live sharing with trusted contacts require an approved local support destination and retention policy; expose them only when configured.

## Deployment behavior

- Make Compose interpolate required secrets without insecure defaults. Use the service DNS name for container-to-container calls.
- Run compiled Nest application entrypoints in production containers instead of the Nest CLI in a pruned runtime image. Use additive Prisma migrations; never use `db push --accept-data-loss` in the production startup path.
- Keep mobile release signing in CI secrets; local debug signing remains separate. A release build fails closed if signing inputs are missing.
- Add service health/readiness and a deployment/rollback note. A local configuration change is not evidence of a successful production rollout.

## Acceptance criteria

1. Missing JWT/internal-service/signing secrets fail closed without revealing values.
2. Unauthenticated or wrong-role HTTP/socket actions are rejected; actor identity and trip ownership come from verified claims and persisted relations.
3. Cross-user trip reads/mutations, driver assignment spoofing, and unsolicited account-control events are rejected.
4. Trip state, final fare, invoice and cash-payment state are persisted atomically and only then emitted to clients.
5. Client/driver/admin screens do not claim an operation succeeded when the server did not persist it.
6. Production Compose uses required configuration, correct inter-service DNS and compiled runtime entrypoints; schema changes are migration-based.
7. Automated tests cover security boundaries, state transitions, payment confirmation, socket authorization and interface regressions. The implementation is not described as production-verified until a real deployment is checked.

## Out of scope

No payment-provider selection, production secret rotation, Git history rewrite, deployment/publish, store submission, legal/privacy policy approval, emergency-support number selection, HERE account-key provisioning, or production data migration is performed without the required account/operator access. The code will be left in a fail-closed state where an external secret/configuration is required.

## Source of observed requirements

- TOT vault: `00 - Especificação da memória.md`, `02 - Arquitetura.md`, `03 - APIs e tempo real.md`, `04 - Dados e integrações.md`, `05 - App do cliente.md`, `06 - App do motorista.md`, `07 - Portal administrativo.md`, `09 - Build e deploy.md`, `10 - Estado e pendências.md`, `11 - Segurança e dados sensíveis.md`.
- Repository baseline: `c98cd16`.


