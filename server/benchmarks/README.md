# Benchmark & Load Test Harness

The scripts in this directory exercise the high-concurrency workloads that the
server now gates with worker pools, queues, and circuit breakers. Each script
relies on runtime configuration supplied through environment variables so that
you can target any deployed instance without modifying code.

## Common Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BENCHMARK_BASE_URL` | Fully qualified base URL for the AnythingLLM API (e.g. `http://localhost:3001/api`). | `http://localhost:3001/api` |
| `BENCHMARK_API_KEY` | Optional API key header value when running against protected deployments. | _unset_ |

## Workload Specific Variables

### Chat Streaming (`chat.js`)

| Variable | Description | Default |
|----------|-------------|---------|
| `CHAT_BENCH_WORKSPACE_SLUG` | Workspace slug to target. **Required.** | – |
| `CHAT_BENCH_MESSAGE` | Chat prompt sent to the workspace. | `"Benchmark ping"` |
| `CHAT_BENCH_CONNECTIONS` | Concurrent streaming clients spawned by the harness. | `12` |
| `CHAT_BENCH_DURATION` | Test duration in seconds. | `30` |
| `CHAT_BENCH_STREAM_TIMEOUT_MS` | Milliseconds to keep SSE responses open before the client disconnects. | `8000` |

### Document Ingestion (`ingestion.js`)

| Variable | Description | Default |
|----------|-------------|---------|
| `INGESTION_BENCH_WORKSPACE_ID` | Numeric workspace identifier. **Required.** | – |
| `INGESTION_BENCH_SOURCE` | Text used to seed new documents via the browser extension ingestion endpoint. | Lorem Ipsum sample |
| `INGESTION_BENCH_CONNECTIONS` | Concurrent uploads executed by the harness. | `6` |
| `INGESTION_BENCH_DURATION` | Duration in seconds. | `30` |

### Agent Flow Execution (`agent.js`)

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_BENCH_FLOW_UUID` | UUID of the flow to execute. **Required.** | – |
| `AGENT_BENCH_VARIABLES` | JSON string containing variables passed to the flow. | `{}` |
| `AGENT_BENCH_CONNECTIONS` | Concurrent flow executions triggered by the harness. | `4` |
| `AGENT_BENCH_DURATION` | Duration in seconds. | `30` |

## Running the Benchmarks

Install dependencies from the server package and then execute the desired
scripts:

```bash
cd server
yarn install
node benchmarks/chat.js
node benchmarks/ingestion.js
node benchmarks/agent.js

# Run everything in sequence
node benchmarks/run-all.js
```

Each script produces a JSON summary (including counts and average latency)
after exercising the target workflow with the configured degree of
concurrency.

### k6 scenarios (CI-friendly)

The k6 entry points mirror the Node harness and expose additional latency
thresholds for alerting/error budgets. Supply the same environment variables
and run them via `k6` directly:

```bash
# Chat streaming
k6 run benchmarks/k6.chat.js \
  -e BENCHMARK_BASE_URL=http://127.0.0.1:3001/api \
  -e CHAT_WORKSPACE_SLUG=demo-workspace \
  -e CHAT_VUS=16 -e CHAT_DURATION_SECONDS=45

# Document ingestion
k6 run benchmarks/k6.ingestion.js \
  -e BENCHMARK_BASE_URL=http://127.0.0.1:3001/api \
  -e INGESTION_WORKSPACE_ID=42 \
  -e INGESTION_VUS=10 -e INGESTION_DURATION_SECONDS=60

# Agent flows
k6 run benchmarks/k6.agent.js \
  -e BENCHMARK_BASE_URL=http://127.0.0.1:3001/api \
  -e AGENT_FLOW_UUID=flow-uuid-here \
  -e AGENT_VUS=8 -e AGENT_DURATION_SECONDS=45
```

Thresholds are configurable via `*_P95_BUDGET_MS` and `*_P99_BUDGET_MS` to
surface failures in CI when latency error budgets are exceeded.

### Artillery scenarios (arrival-rate tuned)

Artillery configs match the same endpoints but describe arrival rates instead
of virtual users. Each scenario reads environment variables so they can be
used inside CI steps or locally:

```bash
# Chat
node ./node_modules/.bin/artillery run benchmarks/artillery.chat.js \
  --output ./artifacts/chat-report.json \
  --overrides "{\"config\":{\"phases\":[{\"arrivalRate\":20,\"duration\":45}]}}"

# Ingestion
node ./node_modules/.bin/artillery run benchmarks/artillery.ingestion.js \
  --output ./artifacts/ingestion-report.json

# Agent flow
node ./node_modules/.bin/artillery run benchmarks/artillery.agent.js \
  --output ./artifacts/agent-report.json
```

Use `CHAT_ARRIVAL_RATE`, `INGESTION_ARRIVAL_RATE`, or `AGENT_ARRIVAL_RATE` to
parameterise load without editing the files. Each report is JSON so CI can
publish artifacts or charts directly.
