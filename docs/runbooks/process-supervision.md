# Process supervision for bare-metal deployments

AnythingLLM runs three long-lived services in production: the API server, the collector, and the Vite-based frontend preview. When deploying without Docker you should supervise these processes with a production-grade process manager to guarantee automatic restarts, log aggregation, and graceful shutdowns.

This runbook introduces a PM2 configuration bundled with the repository (`scripts/pm2.config.cjs`). PM2 is only a suggestion—you can adapt the same concepts to systemd, supervisord, or any equivalent tooling.

## 1. Install dependencies

```bash
npm install -g pm2
```

Ensure you have installed the workspace dependencies (`yarn setup`) and generated the SQLite schema (`yarn prisma:setup`). Provide production-ready environment files in `server/.env.production`, `collector/.env`, and `frontend/.env` before starting the stack.

## 2. Review the configuration

The PM2 ecosystem file defines one process per service:

```javascript
module.exports = {
  apps: [
    { name: "anything-llm-server", script: "yarn", args: "prod:server" },
    { name: "anything-llm-collector", script: "yarn", args: "prod:collector" },
    { name: "anything-llm-frontend", script: "node", args: "scripts/start-frontend.mjs" },
  ],
};
```

Each process inherits `NODE_ENV=production` and the frontend process exposes `FRONTEND_HOST`/`FRONTEND_PORT` overrides. Adjust memory limits, log retention, or environment overrides per your infrastructure needs.

## 3. Launch and manage the stack

```bash
pm2 start scripts/pm2.config.cjs
pm2 status
pm2 logs anything-llm-server
```

The `pm2` command automatically restarts services after crashes and integrates with `pm2 save`/`pm2 startup` for boot-time launches. For zero-downtime reloads you can run `pm2 restart <process>` sequentially.

## 4. Stop and remove processes

```bash
pm2 stop scripts/pm2.config.cjs
pm2 delete scripts/pm2.config.cjs
```

Stopping deletes the managed processes but preserves the ecosystem file so you can restart later.

## 5. Alternative supervisors

If you prefer not to use PM2, port the same commands to your supervisor of choice. For example, a `systemd` unit should execute `yarn prod:server` from the repo root with `WorkingDirectory` set appropriately. Make sure any supervisor sends `SIGINT`/`SIGTERM` for graceful shutdown so that Prisma and Bull queue connections close cleanly.

## 6. Health checks and monitoring

Regardless of the supervisor, add health endpoints to your monitoring stack:

- API server: `GET /system/health`
- Collector: `GET /` (returns `{ ok: true }`)
- Frontend: HTTP status check on the preview port

Combine these checks with log forwarding (e.g., PM2 log streams, journald, or Fluent Bit) to surface ingestion and agent flow errors early.

By adopting a supervisor, bare-metal operators can match the resilience provided by Docker deployments without managing multiple shells manually.
