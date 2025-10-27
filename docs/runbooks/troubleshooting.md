# Troubleshooting Production Incidents

This runbook captures the minimum steps to validate and restore the three core AnythingLLM services when production alarms fire.
Always annotate the incident timeline in your monitoring system and link back to the relevant GitHub issue.

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
