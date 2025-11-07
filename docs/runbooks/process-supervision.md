# Process supervision for bare-metal deployments

AnythingLLM now publishes a single supervisor manifest (`supervisor/manifest.js`)
that describes every long-lived service and the health probes they expose. The
manifest powers three exporters:

| Exporter | Command | Output |
|----------|---------|--------|
| PM2 | `node scripts/supervisor/export.js pm2` | JSON ecosystem configuration used by `scripts/pm2.config.cjs`. |
| systemd | `node scripts/supervisor/export.js systemd` | One unit file per service with `Environment` stanzas pre-populated. |
| Kubernetes | `node scripts/supervisor/export.js kubernetes` | Deployment manifests that can be templated into Helm or Kustomize overlays. |

The manifest tracks four processes:

1. `anything-llm-server` – the Express API (`yarn prod:server`).
2. `anything-llm-collector` – the ingestion collector (`yarn prod:collector`).
3. `anything-llm-frontend` – the static preview server (`node scripts/start-frontend.mjs`).
4. `anything-llm-embedding-worker` – the BullMQ embedding worker (`node server/jobs/embedding-service.js`).

Each entry specifies its working directory, production environment variables,
and a startup probe. HTTP probes point to `/api/health/ready`, `/healthz`, or `/`
depending on the service. The worker exposes a queue probe so that dashboards
can track whether the `embedding-jobs` Redis queue accepts work.

## 1. Installing PM2 (optional)

```bash
npm install -g pm2
```

The PM2 ecosystem file is generated from the manifest so that it always
includes the embedding worker:

```bash
pm2 start scripts/pm2.config.cjs
pm2 status
pm2 logs anything-llm-embedding-worker
```

Run `pm2 save` and `pm2 startup` after validating the stack so the processes
restart automatically after reboots. `pm2 delete scripts/pm2.config.cjs` stops
and removes all managed services.

## 2. Generating systemd units

`node scripts/supervisor/export.js systemd` prints one unit per service. Copy
each block to `/etc/systemd/system/<name>.service`, tweak memory limits or
user accounts, then reload and enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now anything-llm-server anything-llm-collector anything-llm-frontend anything-llm-embedding-worker
```

Every unit invokes the production commands listed above and respects
`SIGTERM`/`SIGINT` so Prisma, Redis, and BullMQ connections shut down cleanly.

## 3. Kubernetes templates

`node scripts/supervisor/export.js kubernetes` emits JSON deployment skeletons.
Replace `<replace-with-image>` with your published container image and wire the
readiness probes into the appropriate service definitions. The embedding worker
inherits the same image as the API server and relies exclusively on Redis for
job dispatch.

## 4. Health probes and observability

The readiness endpoint consolidates the `runStartupDiagnostics` results,
database connectivity, queue availability, and circuit breaker status:

- API server: `GET /api/health/ready` (HTTP 503 if diagnostics fail).
- Collector: `GET /healthz` (falls back to `/` when not exposed).
- Frontend: HTTP status check on `/`.
- Embedding worker: monitor the `embedding-jobs` BullMQ queue depth via
  `/api/metrics` or the Prometheus exporter.

Because the worker runs in its own process you can scale it independently by
adding more supervisor entries or increasing the deployment replica count.

## 5. Failure handling

The manifest centralises restart policy expectations across supervisors:

- All services should restart on failure with at least a five-second back-off.
- Supervisors must forward `SIGTERM` so graceful shutdown completes.
- If startup diagnostics fail, the supervisor should mark the instance as
  unhealthy and attempt a fresh start after configuration is corrected.

By reusing the manifest, operators can keep PM2, systemd, and Kubernetes
configurations in sync without duplicating process metadata.
