---
srd_versions:
  - version: 1.2.0
    date: 2025-11-07
    summary: Added integration stack coverage, observability updates, and accessibility workflows to the SRD with enforced doc drift checks.
  - version: 1.1.0
    date: 2024-06-01
    summary: Added concurrency, provider integration, and automation updates to the SRD alongside new API inventory docs.
  - version: 1.0.0
    date: 2024-05-09
    summary: Initial SRD baseline covering architecture, data models, agents, ingestion, UI, and deployments.
---

# Documentation Change Log

The change log records the relationship between code-level changes and SRD updates. Each entry must reference the SRD sections that were revised alongside a short description of the driving code modifications.

## Process
1. When a pull request alters application architecture, data contracts, or operational flows, update the relevant SRD sections.
2. Bump the SRD `version` and `last_updated` front matter when the modifications materially impact readers.
3. Append a new entry below using the template:

   ```markdown
   ## [x.y.z] - YYYY-MM-DD
   ### SRD
   - Updated <Section Name> to reflect <change summary>.

   ### Code Alignment
   - <Repository path or PR reference>
   ```

4. Run `yarn docs:check` locally to validate the SRD schema, markdown formatting, and change-log linkage.

## [1.2.0] - 2025-11-07
### SRD
- Updated architecture overview, data-flow summary, and diagrams to cover the integration Compose stack, LiteLLM mock, and metrics/telemetry emitters referenced by `/metrics` and `/metrics/prometheus`.
- Documented accessibility-centered UI flows for keyboard shortcuts, modal focus management, and theme persistence across workspace and admin experiences.
- Added a doc drift control path requiring `yarn docs:check` for PRs that modify server/frontend/collector boundaries and mapped the latest merges in a dedicated SRD section.

### Code Alignment
- Integration stack and contract fixtures: `docker/docker-compose.integration.yml`, `server/scripts/seed-test-fixtures.js`, `server/__tests__/endpoints/systemAuth.test.js`, `server/__tests__/endpoints/chatFlow.test.js`, `server/__tests__/endpoints/agentFlows.test.js`, and `frontend/tests/e2e/helpers/backend.js`.
- Accessibility and observability updates: `frontend/src/utils/accessibility.js`, `frontend/src/hooks/useAccessibleModal.js`, `frontend/src/hooks/useTheme.js`, `frontend/src/components/KeyboardShortcutsHelp/index.jsx`, `server/utils/metrics/registry.js`, and `.github/workflows/run-tests.yaml` (docs gate).

## [1.1.0] - 2024-06-01
### SRD
- Added a platform-wide data flow summary and concurrency overview referencing `server/index.js`, `server/utils/concurrency`, and [`docs/server-concurrency.md`](./server-concurrency.md).
- Documented provider integration matrix, telemetry artifacts, and new UI journeys (embed, browser extension, mobile companion) in [`docs/srd.md`](./srd.md).
- Linked ingestion automation scripts and mobile operations to keep the SRD aligned with runbooks.

### Code Alignment
- Added comprehensive Express endpoint inventory at [`docs/api/server-endpoints.md`](./api/server-endpoints.md).
- Updated runbooks, release checklist, and ADRs to reference automation scripts in `scripts/*.mjs`.

## [1.0.0] - 2024-05-09
### SRD
- Published the inaugural SRD with diagrams for architecture, agent orchestration, and deployments.

### Code Alignment
- Documented existing frontend (`frontend/`), server (`server/`), and collector (`collector/`) behaviors without code changes.
