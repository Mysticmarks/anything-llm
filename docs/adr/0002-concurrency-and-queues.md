# ADR 0002: Queue-backed concurrency primitives

- **Status:** Accepted
- **Date:** 2024-06-01
- **Context:** As AnythingLLM added streaming chat, agent flows, and mobile push notifications, the monolithic request-per-process model saturated CPU cores and produced bursty load on Redis and external LLM providers. We required bounded concurrency, observability, and a way to coordinate ingestion when Redis (BullMQ) is unavailable.

## Decision

We introduced queue-backed primitives implemented in `server/utils/concurrency` and wired them through the Express endpoints registered in `server/index.js`.

1. **Async queues**
   - `chatQueue` backs `/workspace/:slug/stream-chat` and `/agent-flows/:uuid/run`, enforcing `CHAT_QUEUE_CONCURRENCY`.
   - `ingestionQueue` protects `/workspace/:slug/upload*` when BullMQ is offline. It falls back to the worker pool defined in `server/utils/workers`.
   - `agentFlowQueue` serialises `/agent-flows/save` and `/agent-flows/:uuid/run` executions.
2. **Circuit breakers**
   - `CircuitBreaker` instances guard each queue, tripping after repeated provider failures. Readiness endpoints expose the breaker state so Kubernetes can react.
3. **Metrics integration**
   - Queue depth, active counts, and breaker states emit through `server/utils/metrics/registry`. The Prometheus handler surfaces them at `/metrics/prometheus` for Grafana dashboards described in `docs/runbooks/observability.md`.
4. **Automation**
   - Load test scenarios (`node scripts/load-test.mjs --profile chat-streaming|agent-flows|ingestion`) simulate peak workloads and validate breaker tuning before rollouts.
   - `node scripts/start-stack.mjs --verify` exercises startup diagnostics to ensure queues and background workers initialise correctly.

## Consequences

- Endpoint contracts now assume deferred execution. Client code must handle `202 Accepted` responses for uploads that queue work.
- Observability dashboards reference the new metrics and alert when breaker states open for more than 5 minutes.
- Contributors must extend the queue layer when adding high-throughput features. The ADR provides a checklist: add a queue, wrap the controller, expose metrics, and update load tests.
- Release engineering links this ADR in the production checklist to remind operators to run the automated load tests after dependency upgrades.
