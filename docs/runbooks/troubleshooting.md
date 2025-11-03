# Troubleshooting Production Incidents

This runbook captures the minimum steps to validate and restore the three core AnythingLLM services when production alarms fire.
Always annotate the incident timeline in your monitoring system and link back to the relevant GitHub issue.

## 0. Environment setup failures

1. Provision backing services
   - Launch the dependency containers with `yarn provision:deps`. The script starts Redis by default and will automatically include Postgres, Qdrant, or Chroma when the corresponding environment variables are configured. Override with flags such as `--with-postgres` if you need to force additional services locally.
   - Inspect container health with `docker compose -f docker/dependencies.compose.yml ps` whenever diagnostics report connectivity issues.
2. Review startup diagnostics
   - Both the API server and collector emit `[StartupDiagnostics]` logs before accepting traffic. Failures generally indicate missing secrets (`JWT_SECRET`, `SIG_KEY`, `SIG_SALT`), unreadable TLS material, or an unreachable Redis endpoint.
   - Update the affected `.env` file or restart the dependency containers, then relaunch the service to re-run the diagnostic checks.
3. Run the onboarding smoke test
   - `yarn setup` now finishes by executing `scripts/onboarding-smoke.mjs`, which boots the stack and waits for `/api/health` plus the frontend preview to respond with HTML. Re-run the verification at any time with `yarn onboarding:smoke`.
   - To triage failures, confirm Redis is reachable, check the server logs for diagnostic errors, and ensure no other process is holding ports 3001 or 4173. Set `SKIP_ONBOARDING_SMOKE=true` temporarily if you must defer the smoke test during scripted installs.

## 1. API server degradation

1. Confirm deployment metadata
   - Check the currently deployed image tag against the latest release notes.
   - Validate environment variables using the `server/.env.production` template.
2. Inspect health endpoints
   - Issue a GET request to `/api/health`. Expect HTTP 200 with `status: ok`.
   - For websocket regressions, tail the gateway logs and confirm the build originated from the latest `yarn prod:server`
     artifact.
3. Rollback and recovery
   - If a migration failed, apply `yarn prisma:reset` in a staging clone to reproduce before rolling back production.
   - Trigger the previous container image and re-run smoke tests defined in the release checklist.

## 2. Frontend regressions

1. Asset verification
   - Confirm the CDN is serving files produced by `yarn prod:frontend`. The build hash should match the pipeline artifact.
   - Purge CDN caches if stale assets are observed.
2. Client-side diagnostics
   - Capture console logs and network traces. Look for mismatched API versions or missing localization bundles.
   - Run `yarn verify:translations` locally to rule out translation sync issues.
3. Hotfix strategy
   - Apply UI patches on the `master` branch and rebuild via `yarn prod:frontend`.
   - Ensure accessibility fixes pass automated checks (axe, keyboard navigation) before redeploying.

## 3. Collector failures

1. Runtime validation
   - Confirm the collector container is using the same image tag as the API server deployment.
   - Start a local instance with `yarn dev:collector` and point it at staging data to reproduce the failure.
2. Language binding mismatches
   - Verify the collector language runtime matches the version declared in the release manifest.
   - Re-run integration tests or targeted scripts before re-enabling production ingestion.
3. Restart policy
   - Restart the worker queue after applying fixes. Monitor job throughput for 30 minutes to validate recovery.

## 4. Escalation and follow-up

- Notify the on-call engineer and product owner when mitigation steps exceed 30 minutes.
- File a retrospective issue capturing the impact, root cause, and prevention tasks.
- Update this runbook whenever new classes of incidents are discovered.
