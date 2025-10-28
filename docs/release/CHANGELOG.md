# Changelog

## Unreleased

### Removed
- `GET /admin/system-preferences` admin endpoint. Use `GET /admin/system-preferences-for` with the `labels` query parameter instead.

### Changed
- System preference updates now post to `POST /admin/system-preferences/update`.
