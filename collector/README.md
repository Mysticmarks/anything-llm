# AnythingLLM Collector Service

The collector is a standalone Node.js Express service that ingests, normalizes,
and enriches raw content before it is embedded into AnythingLLM workspaces. The
server forwards document upload and sync jobs to the collector, which runs on
port `8888` by default.

## Prerequisites

- Node.js **18.12.1** or later (matches the requirement declared in
  [`package.json`](./package.json)).
- Yarn package manager.
- A populated `.env` file (copy `.env.example` or run `yarn setup:envs` from the
  repository root).

## Local development

1. Install dependencies

   ```bash
   cd collector
   yarn
   ```

2. Start the service in watch mode

   ```bash
   yarn dev
   ```

   The collector restarts automatically when files change. Requests are
   available at `http://localhost:8888` and are authenticated via the
   `verifyPayloadIntegrity` middleware that the main server already uses.

## Production usage

Build and serve the frontend, start the `server` process, then boot the
collector in its own Node.js process:

```bash
cd collector
NODE_ENV=production node index.js
```

Because the collector performs CPU-intensive parsing tasks, we recommend
running it alongside the API server but as a dedicated service. Operators can
find an end-to-end deployment walkthrough in [`BARE_METAL.md`](../BARE_METAL.md).
