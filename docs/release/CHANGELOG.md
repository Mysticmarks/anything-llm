# Changelog

## Unreleased

### Added
- Documented automation scripts (`scripts/start-stack.mjs`, `scripts/run-tests.mjs`, `scripts/load-test.mjs`) in the production checklist to standardize release pipelines.

### Removed
- `GET /admin/system-preferences` admin endpoint. Use `GET /admin/system-preferences-for` with the `labels` query parameter instead.

### Changed
- System preference updates now post to `POST /admin/system-preferences/update`.
