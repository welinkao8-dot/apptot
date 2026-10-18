# Legacy Express backends

Archived on 2026-10-17 after repository-wide caller/deployment search. Production Compose builds the NestJS apps from `backend-monorepo/backend.Dockerfile`; no active script, workflow, or Compose file references these Express server sources. Mobile and portal clients use the Nest API ports (including the driver's existing port 3004).

These files are retained for historical reference and can be removed in a separately reviewed cleanup. Local ignored `.env` and `node_modules` directories were not moved or inspected.
