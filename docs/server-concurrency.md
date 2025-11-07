# AnythingLLM Server Concurrency Overview

This document captures the current process supervision, threading, and queue
topology that powers the AnythingLLM server runtime. It covers the
configuration that existed prior to this change set and the new concurrency
infrastructure introduced here.

## Process Supervision

* `server/index.js` still supports the optional Node.js cluster described in
  `supervisor.js`, but deployments now rely on the shared manifest defined in
  `supervisor/manifest.js`.
* The manifest enumerates the API server, collector, frontend preview, and the
  stand-alone embedding worker. Exporters in `scripts/supervisor/export.js`
  generate PM2, systemd, and Kubernetes configuration from the same source of
  truth.
* Startup probes reuse the readiness endpoint that wraps
  `runStartupDiagnostics`, ensuring container orchestrators gate traffic until
  secrets, Redis, and vector databases are reachable.

## Background Job Execution (`server/jobs`)

* The embedding worker now runs as a dedicated Node.js process started via
  `node server/jobs/embedding-service.js` or the `yarn worker:embedding` script.
* The worker establishes its own Redis connection, consumes the
  `embedding-jobs` BullMQ queue, and reports failures directly in its logs.
* The API no longer spawns worker threads. External supervisors (PM2,
  systemd, Kubernetes) are responsible for restart policies and scaling.

## Worker Pools

* The legacy `worker_threads` pool has been deprecated. Document ingestion now
  requires the distributed scheduler; the in-process fallback has been removed.
* The `ingestionQueue` utility remains for historical compatibility but is no
  longer invoked by the embedding pipeline.

## New Concurrency Infrastructure

To standardise concurrency across request, ingestion, and agent execution
paths, three queue-backed primitives were added in `server/utils/concurrency`:

| Component | Purpose | Default Concurrency |
|-----------|---------|---------------------|
| `chatQueue` | Controls streaming chat workloads handled via SSE. | `CHAT_QUEUE_CONCURRENCY` (default `4`). |
| `ingestionQueue` | Retained for legacy flows; embedding now always relies on BullMQ. | `INGESTION_QUEUE_CONCURRENCY` (default `3`). |
| `agentFlowQueue` | Serialises agent flow executions to prevent unbounded concurrent executions. | `AGENT_FLOW_QUEUE_CONCURRENCY` (default `2`). |

Each queue is backed by the new `AsyncQueue` helper which provides:

* Bounded concurrency execution of asynchronous tasks.
* Cooperative cancellation and timeout handling.
* Metric hooks that publish queue depth/active gauges to Prometheus via
  `server/utils/metrics/registry`.

Complementing the queues are lightweight circuit breakers implemented in
`CircuitBreaker`. Chat and agent flow pipelines now trip when consecutive
failures exceed configurable thresholds. State transitions are exported as
Prometheus gauges and counters.

## Metrics, Health, and Rate Limiting

* Prometheus metrics are exposed from `/api/metrics/prometheus` and include
  queue depths, active counts, and circuit breaker states.
* JSON metrics (`/api/metrics`) now return queue metrics, latency snapshots,
  and the live concurrency snapshot.
* `/api/health`, `/api/health/ready`, and `/api/health/live` provide fine
  grained process, database, queue backend, and circuit status.
* Global and route-specific rate limiters (implemented in
  `server/middleware/rateLimiters`) gate high
  throughput entry points for chat, ingestion, and agent flows.

These additions ensure the runtime has observable, bounded execution for its
critical workloads while integrating with the existing supervision and worker
pool infrastructure.

## Benchmarking the Concurrency Controls

The load-test scripts under `server/benchmarks/` rely on a running AnythingLLM
server instance and authenticated workspace credentials. Before running any of
the scenarios (`chat`, `agent`, or `ingestion`):

1. Start the server locally (for example with `yarn dev:server`) and ensure the
   API is reachable at `BENCHMARK_BASE_URL` (default `http://127.0.0.1:3001`).
2. Create or reuse a workspace API key, then export the following environment
   variables for the benchmark process:
   * `BENCHMARK_BASE_URL` – Fully-qualified base URL for the server under test.
   * `BENCHMARK_WORKSPACE_SLUG` – Slug/identifier of the target workspace.
   * `BENCHMARK_WORKSPACE_TOKEN` – Workspace API key with ingestion/chat
     permissions.
3. For ingestion benchmarks, ensure the filesystem paths referenced in the test
   data exist and the collector (if required) is running.

The scripts use the global `fetch` API and will open concurrent HTTP
connections; run them against non-production environments or dedicated
staging/test deployments only.
