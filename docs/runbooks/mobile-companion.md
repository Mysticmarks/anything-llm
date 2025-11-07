# Mobile companion runbook

The AnythingLLM mobile application mirrors the desktop workspace experience for quick lookups and notifications. This runbook documents the provisioning workflow, failure scenarios, and automation scripts that keep device registrations healthy.

## Provisioning steps
1. Generate a device token from the admin console (`/mobile/register`). Copy the token or QR code presented to the operator.
2. Install the mobile application build that matches the server version. Builds are produced alongside the main release artefacts and reference the same commit hash.
3. On first launch, paste or scan the device token. The app exchanges it for a short-lived auth token via `GET /mobile/auth`.
4. Select the default workspace(s) the device should monitor. The application pulls the list from `GET /mobile/devices` and subscribes to notifications.

## Operational checks
- `GET /mobile/devices` should list the handset with a `lastSeenAt` timestamp that updates every poll window (default 60 seconds).
- `/mobile/send/test-notification` (command issued from the admin panel) should push a toast on the device. Investigate FCM/APNS certificates when the command succeeds but no notification arrives.
- The device entry should include `workspaceIds`. Missing assignments result in empty dashboards; re-run the provisioning wizard or issue a PATCH via the admin UI.

## Common failure scenarios
| Symptom | Likely cause | Mitigation |
| --- | --- | --- |
| Device never appears in `/mobile/devices` | The registration script timed out before exchanging the token. | Run the automation script below to regenerate tokens and retry pairing. |
| `/mobile/auth` returns 401 | Token expired (default TTL 15 minutes) or already redeemed. | Issue a fresh token from the admin console or run the CLI to rotate tokens. |
| Notifications stalled | Background queue paused or push provider credentials invalid. | Confirm Redis is healthy, check `/metrics` for queue depth, and rotate push secrets. |

## Automation scripts
- `node scripts/provision-deps.mjs --with-redis --with-postgres` — ensures all backend services required by the mobile push gateway are available before pairing devices.
- `node scripts/onboarding-smoke.mjs --mobile` — provisions a dummy device, validates `/mobile/auth`, and issues a test notification. Useful in CI prior to releasing a new mobile build.
- `node scripts/run-tests.mjs --target mobile` — executes the server-side Jest suites that cover mobile endpoints (`server/__tests__/endpoints/mobile.test.js`). Integrate into nightly jobs to catch regressions early.

## Escalation
If mobile services remain degraded after the mitigations above, escalate to the platform SRE on-call and attach output from the automation scripts. Include timestamps for token issuance, command execution, and any push provider logs gathered during the incident.
