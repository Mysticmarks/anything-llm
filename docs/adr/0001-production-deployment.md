# ADR 0001: Production Deployment Baseline

- **Status:** Accepted
- **Date:** 2024-05-01
- **Context:** AnythingLLM ships as a multi-service platform composed of the Node.js API server, the React single-page
  application, and the Python-based collector. Production rollouts must align with these service boundaries to maintain
  operability across self-hosted and managed offerings.

## Decision

We standardize the production deployment contract around the following expectations:

1. **Service composition**
   - The API server (`server/`) exposes REST endpoints and websocket events. It is the single source of truth for persistence
     via Prisma and SQLite/Postgres.
   - The React frontend (`frontend/`) is compiled into static assets with `yarn prod:frontend` and served behind the API
     gateway/CDN configured per environment.
   - The collector (`collector/`) operates as an independent worker queue that must be version-locked with the API server.

2. **Release artifacts**
   - Container images and tarball builds are produced from the `master` branch. The build pipeline runs `yarn lint`, `yarn
     docs:check`, and the service-specific linters/tests prior to packaging.
   - Version tags follow `v<major>.<minor>.<patch>` semantics and must be published simultaneously for the server, frontend,
     and collector images.

3. **Operational guardrails**
   - Configuration is declared through checked-in `.env.example` files and surfaced via `yarn setup` during onboarding.
   - Each production deploy must verify database schema compatibility by executing `yarn prisma:migrate` in a controlled
     environment before public release.

## Consequences

- Contributors can rely on a consistent set of scripts for building (`yarn prod:server`, `yarn prod:frontend`) and operating the
  collector (`yarn dev:collector` or container images) when proposing changes.
- Release tooling and documentation must be updated together. The automated doc freshness check prevents drift between
  published runbooks and the executable scripts.
- Future ADRs should reference this decision when modifying service boundaries or deployment requirements.
