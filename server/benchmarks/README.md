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
