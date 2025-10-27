# AnythingLLM Documentation

This directory contains operational documentation that mirrors the production expectations for AnythingLLM deployments. Each
subdirectory focuses on a specific concern so that contributors and operators can quickly locate the canonical source of truth.

- [`adr/`](./adr) — Architecture Decision Records that capture durable engineering decisions and their rationale.
- [`runbooks/`](./runbooks) — Troubleshooting guides and operational runbooks for production incidents.
- [`release/`](./release) — Release readiness checklists and production rollout procedures.

All documents in this folder are expected to stay in sync with the behavior of the production environment. Run `yarn docs:check`
before submitting a pull request to ensure scripts referenced in the documentation remain valid.
