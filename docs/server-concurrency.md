# AnythingLLM Server Concurrency Overview

This document captures the current process supervision, threading, and queue
topology that powers the AnythingLLM server runtime. It covers the
configuration that existed prior to this change set and the new concurrency
infrastructure introduced here.

## Process Supervision (`server/index.js`)

* `server/index.js` bootstraps the Express HTTP server and optionally launches
  a cluster of worker processes through `cluster.fork`. The supervision logic
  lives at the bottom of the file and is responsible for:
  * Spawning `workerTarget` processes (derived from `supervisor.js`).
  * Restarting crashed workers with an exponential back-off controlled by the
    `restartDelay` configuration.
  * Handling `SIGINT`/`SIGTERM` to gracefully terminate all workers.
* HTTP listeners are still constructed in-process. Each worker initializes an
  Express app, attaches endpoints, and – when HTTPS is disabled – binds the
  HTTP server through `bootHTTP`.

## Background Job Execution (`server/jobs`)

* The job subsystem uses `worker_threads` to host dedicated BullMQ workers. The
  entry point, `server/jobs/index.js`, spawns a single embedding worker thread
  (`embeddingWorker.js`) unless `DISABLE_SERVER_JOB_WORKERS` is set.
* `embeddingWorker.js` connects to Redis and consumes the
  `embedding-jobs` BullMQ queue. Jobs run concurrently inside the worker
  thread by leveraging BullMQ's `concurrency` option (default `2`).
* Worker lifecycles are supervised: errors are logged, non-zero exits are
  surfaced, and the parent process is notified once the worker is ready.

## Worker Pools (`server/utils/workers`)

* The `WorkerPool` abstraction builds a configurable pool of
  `worker_threads`. It powers synchronous embedding operations when the BullMQ
  queue cannot be used (for example, when Redis is unavailable).
* Pool size defaults to half the CPU count and tasks are dispatched in a FIFO
  order. Timeout handling and external HTTP execution modes are supported.

## New Concurrency Infrastructure

To standardise concurrency across request, ingestion, and agent execution
paths, three queue-backed primitives were added in `server/utils/concurrency`:

| Component | Purpose | Default Concurrency |
|-----------|---------|---------------------|
| `chatQueue` | Controls streaming chat workloads handled via SSE. | `CHAT_QUEUE_CONCURRENCY` (default `4`). |
| `ingestionQueue` | Governs synchronous document embedding when BullMQ or the worker pool are unavailable. | `INGESTION_QUEUE_CONCURRENCY` (default `3`). |
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
