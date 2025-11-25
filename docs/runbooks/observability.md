# Observability & Alerting Runbook

This runbook explains how to connect AnythingLLM's Kubernetes deployment to your monitoring stack, import the curated Grafana dashboard provided by the Helm chart, and configure actionable alerts.

## Metrics pipeline

1. **Enable metrics exports in Helm**
   - Set `metrics.enabled=true` in the AnythingLLM Helm values.
   - If you run Prometheus Operator, also set `metrics.serviceMonitor.enabled=true` so a `ServiceMonitor` is created automatically.
   - When Grafana is present, enable `metrics.grafanaDashboard.enabled=true` to ship a prebuilt dashboard ConfigMap into the monitoring namespace.
2. **Scrape configuration**
   - Prometheus Operator discovers the workload through the generated `ServiceMonitor`. For vanilla Prometheus, point a scrape job at the service on the `http` port and `/metrics` path.
   - Metrics to watch:
     - `http_server_requests_total` / `http_requests_total` for API throughput and error rates.
     - `container_cpu_usage_seconds_total` and `container_memory_working_set_bytes` for pod resource consumption.
     - `anything_queue_pending` and `anything_queue_active` for live worker utilisation.
     - `anything_queue_saturation_total` to track how often queues exceed 85% utilisation.
     - `anything_agent_errors_total` for upstream provider failures surfaced by the agent runtime.
     - `queue_jobs_ready` for collector backlogs (legacy metric exposed by the collector service).
   - Ensure the metrics-server Helm release (bundled with the Terraform stack) is running; the HorizontalPodAutoscaler depends on the `metrics.k8s.io` API.

## Grafana dashboard

The Helm chart can ship a Grafana dashboard as a ConfigMap labeled `grafana_dashboard=1`. To import it automatically:

1. Enable the dashboard in `values.yaml`:

   ```yaml
   metrics:
     enabled: true
     grafanaDashboard:
       enabled: true
       namespace: monitoring
   ```

2. Configure Grafana (or the Grafana sidecar) to watch for ConfigMaps with the `grafana_dashboard` label in the chosen namespace.
3. Once Grafana picks up the ConfigMap, you will see panels for:
   - CPU utilisation (5-minute rate)
   - Memory working set
   - HTTP request throughput/error rate
   - Work queue depth and saturation frequency
   - Agent error breakdown by provider

If you prefer to import a dashboard directly, use the JSON artifact at
[`extras/observability/dashboards/anythingllm-prometheus.json`](../../extras/observability/dashboards/anythingllm-prometheus.json).
The layout mirrors the Helm ConfigMap but adds queue saturation and agent error
facets wired to the `/metrics/prometheus` endpoint.

### Structured event stream

`/api/metrics` now includes an `events` payload with aggregated counts for queue saturation, circuit breaker trips, and agent errors. The server emits the same payload on an in-process event emitter (`metricsEmitter`) so custom sinks (e.g., Grafana Loki or a webhook bridge) can subscribe without polling. Each event object carries the triggering queue/circuit, the current total, and a timestamp suitable for alert annotations.

## Alerting recommendations

| Metric | Threshold | Suggested action |
| ------ | --------- | ---------------- |
| `http_server_requests_total` error ratio | >5% 5-minute error rate | Inspect recent deployments, review server logs, roll back if necessary. |
| Pod CPU utilisation | >85% for 10 minutes | Verify HPA is scaling. If node saturation occurs, increase node group max or add larger instance types. |
| Pod memory usage | >90% for 10 minutes | Check for memory leaks, consider raising container limits. |
| `queue_jobs_ready` | >100 pending for 15 minutes | Collector lagging—scale collector workers or investigate downstream APIs. |
| `kube_pod_container_status_restarts_total` | >=3 restarts/hour | Pull diagnostics (`kubectl logs`), verify probes and dependencies. |

Example Prometheus rules for the above alerts (plus circuit trips and agent
errors) live in
[`extras/observability/alerts/anythingllm-prometheus-rules.yaml`](../../extras/observability/alerts/anythingllm-prometheus-rules.yaml).
Apply them via Prometheus Operator or a plain `kubectl apply -f` in the monitoring
namespace to keep `/metrics/prometheus` coverage aligned with production SLOs.

## Alert routing

1. Create Prometheus alerting rules matching the thresholds above; send them to Alertmanager.
2. Define routing in Alertmanager to page the on-call SRE for high-severity incidents (`cpu/memory saturation`, `5xx error rate`). Use lower priority channels (Slack/email) for backlog or restart warnings.
3. Include runbook links in the alert annotations so responders can quickly triage (e.g., link to this document and to `docs/runbooks/troubleshooting.md`).

## Incident response workflow

1. **Triage** – Validate the alert against Grafana panels; confirm whether spikes are transient.
2. **Stabilise** – If capacity is the issue, temporarily raise `app_max_replicas` or node group limits. For crashes, capture logs and disable problematic features via feature flags.
3. **Communicate** – Update the engineering Slack channel and incident tracker. Mention estimated impact and mitigation steps.
4. **Post-mortem** – File an incident report describing the root cause, fix, and follow-up actions (e.g., new tests, additional monitors).

## Useful commands

```bash
# Check HPA decisions
kubectl get hpa -n <namespace>

# Inspect pod resource usage
kubectl top pods -n <namespace>

# Validate ServiceMonitor status
kubectl describe servicemonitor -n <monitoring-namespace> anythingllm
```

## Automation touchpoints

- Integrate `node scripts/load-test.mjs --profile chat-streaming` into staging release pipelines. The script emits `queue_jobs_active` and circuit-breaker metrics that map directly to the Grafana dashboard described above.
- Run `node scripts/run-tests.mjs --target server` after scaling events to verify the Prometheus and health endpoints (`/metrics`, `/health/ready`) still return success.
- Schedule `node scripts/check-docs-freshness.mjs` weekly to flag when observability configuration or runbooks fall behind code changes.
- CI smoke deployments use [`scripts/ci/smoke-check.mjs`](../../scripts/ci/smoke-check.mjs) to validate `/api/health`, `/metrics/prometheus`, workspace creation, and chat streaming against both Docker Compose and kind. Reuse the script when rolling your own staging checks.

Keep this runbook close to the alerts by linking it in Alertmanager annotations or your paging tool of choice.
