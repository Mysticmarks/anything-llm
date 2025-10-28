# Production Release Checklist

Use this checklist when promoting a build to production. The steps align with AnythingLLM's service boundaries and performance
budgets to ensure a predictable rollout.

## 1. Pre-release validation

- [ ] Confirm the target branch is `master` and all pull requests reference approved issues.
- [ ] Run `yarn lint` and `yarn docs:check` from a clean working tree.
- [ ] Execute service-specific checks:
  - [ ] `cd server && yarn lint && yarn test`
  - [ ] `cd frontend && yarn lint && yarn test`
  - [ ] `cd collector && yarn lint && yarn test`
- [ ] Verify automated coverage for authentication, onboarding, chat, workspace lifecycle, and collector ingestion suites remains above 80% by running `yarn test:coverage` and reviewing the generated `coverage/coverage-summary.json`.
- [ ] Verify database migrations with `yarn prisma:migrate` against staging.
- [ ] Capture release notes summarizing user-facing changes and operational impacts.

## 2. Performance and UX budgets

- [ ] Server endpoints meet the 95th percentile latency budget of 500ms under the standard load test profile.
- [ ] Frontend Lighthouse performance score remains above 85 on the staging build produced by `yarn prod:frontend`.
- [ ] Critical flows include motion reduced alternatives and pass accessibility smoke tests.

## 3. Deployment

- [ ] Build production artifacts:
  - [ ] `yarn prod:server`
  - [ ] `yarn prod:frontend`
  - [ ] `yarn dev:collector` (runtime smoke test prior to publishing the collector image)
- [ ] Publish container images and verify tags:
  - [ ] `latest`
  - [ ] `v<major>.<minor>.<patch>`
- [ ] Confirm infrastructure manifests via `node cloud-deployments/aws/cloudformation/generate.mjs` or the equivalent per cloud.

## 4. Post-deployment verification

- [ ] Run end-to-end smoke tests covering chat ingestion, vector indexing, and retrieval flows.
- [ ] Monitor logs and dashboards for 30 minutes. Validate no new alerts fire.
- [ ] Update the incident response rotation with release details and rollback plan.
- [ ] Close the release tracking issue with links to artifacts and telemetry.
