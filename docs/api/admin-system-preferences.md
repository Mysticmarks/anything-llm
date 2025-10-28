# Admin system preferences API

The admin system preferences API exposes label-scoped configuration so callers
can fetch only the settings they need. The legacy aggregate endpoint has been
removed in favor of the label-based contract described below.

## `GET /admin/system-preferences-for`

- **Query parameters**
  - `labels`: Comma separated list of system setting labels. Only labels present
    in `SystemSettings.publicFields` will be returned.
- **Response**
  - `200 OK` with `{ "settings": { <label>: <value>, ... } }` when the caller has
    an admin or manager role.
  - `403 Forbidden` when the caller does not have permission.
- **Behavior**
  - Unknown labels are ignored.
  - Settings with chunk-size semantics fall back to the current embedder
    configuration when no explicit value has been stored.

## Removed endpoint

- `GET /admin/system-preferences` (aggregate response) was removed. Clients must
  migrate to `GET /admin/system-preferences-for`.

## Update endpoint

- `POST /admin/system-preferences/update` persists updates to the requested
  settings. This replaces the former `POST /admin/system-preferences` path.
