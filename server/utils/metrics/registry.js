const { EventEmitter } = require("events");

const queueSnapshots = new Map();
const queueDurations = new Map();
const circuitSnapshots = new Map();
const circuitTrips = new Map();
const queueSaturations = new Map();
const agentErrorCounters = new Map();

const metricsEmitter = new EventEmitter();
metricsEmitter.setMaxListeners(25);

const SATURATION_THRESHOLD = Number(
  process.env.METRICS_QUEUE_SATURATION_THRESHOLD || 0.85
);

function setQueueMetrics(name, snapshot) {
  const enriched = { ...snapshot, updatedAt: Date.now() };
  queueSnapshots.set(name, enriched);
  metricsEmitter.emit("queue_snapshot", { queue: name, snapshot: enriched });

  const concurrency = Math.max(Number(enriched.concurrency) || 0, 1);
  const pending = Number(enriched.pending) || 0;
  const active = Number(enriched.active) || 0;
  const load = (pending + active) / concurrency;

  if (load >= SATURATION_THRESHOLD) {
    queueSaturations.set(name, (queueSaturations.get(name) || 0) + 1);
    metricsEmitter.emit("queue_saturation", {
      queue: name,
      load: Number(load.toFixed(2)),
      pending,
      active,
      concurrency,
      at: Date.now(),
    });
  }
}

function recordQueueDuration(name, durationMs) {
  if (!Number.isFinite(durationMs)) return;
  const current = queueDurations.get(name) || { totalMs: 0, count: 0, maxMs: 0 };
  const next = {
    totalMs: current.totalMs + durationMs,
    count: current.count + 1,
    maxMs: Math.max(current.maxMs, durationMs),
  };

  queueDurations.set(name, next);
  metricsEmitter.emit("queue_duration", { queue: name, durationMs });
}

const CIRCUIT_STATES = {
  closed: 0,
  half_open: 1,
  open: 2,
};

function setCircuitState(name, state, snapshot = null) {
  const previous = circuitSnapshots.get(name)?.state;
  const base = snapshot || circuitSnapshots.get(name) || {};
  circuitSnapshots.set(name, {
    ...base,
    state,
    updatedAt: Date.now(),
  });
  metricsEmitter.emit("circuit_state", {
    circuit: name,
    state,
    previous,
    at: Date.now(),
  });
  if (state === "open" && previous !== "open") {
    circuitTrips.set(name, (circuitTrips.get(name) || 0) + 1);
    metricsEmitter.emit("circuit_trip", {
      circuit: name,
      total: circuitTrips.get(name),
      at: Date.now(),
    });
  }
}

function recordAgentError({ agent, provider, workspaceId, error }) {
  const key = `${agent || "unknown"}::${provider || "unknown"}`;
  agentErrorCounters.set(key, (agentErrorCounters.get(key) || 0) + 1);
  metricsEmitter.emit("agent_error", {
    agent: agent || "unknown",
    provider: provider || "unknown",
    workspaceId: workspaceId || null,
    message: typeof error === "string" ? error : error?.message || "Unknown error",
    at: Date.now(),
  });
}

function formatMetricLine(name, labels, value) {
  const labelString = Object.entries(labels)
    .map(([key, val]) => `${key}="${String(val)}"`)
    .join(",");
  return `${name}{${labelString}} ${value}`;
}

async function getPrometheusMetrics() {
  const lines = [];

  lines.push("# TYPE anything_queue_pending gauge");
  for (const [name, snapshot] of queueSnapshots.entries()) {
    lines.push(formatMetricLine("anything_queue_pending", { queue: name }, snapshot.pending));
  }

  lines.push("# TYPE anything_queue_active gauge");
  for (const [name, snapshot] of queueSnapshots.entries()) {
    lines.push(formatMetricLine("anything_queue_active", { queue: name }, snapshot.active));
  }

  lines.push("# TYPE anything_queue_duration_avg_ms gauge");
  for (const [name, timings] of queueDurations.entries()) {
    const average = timings.count > 0 ? timings.totalMs / timings.count : 0;
    lines.push(
      formatMetricLine("anything_queue_duration_avg_ms", { queue: name }, Number(average.toFixed(2)))
    );
  }

  lines.push("# TYPE anything_queue_duration_max_ms gauge");
  for (const [name, timings] of queueDurations.entries()) {
    lines.push(
      formatMetricLine("anything_queue_duration_max_ms", { queue: name }, Number(timings.maxMs.toFixed(2)))
    );
  }

  lines.push("# TYPE anything_circuit_state gauge");
  for (const [name, snapshot] of circuitSnapshots.entries()) {
    const value = CIRCUIT_STATES[snapshot.state] ?? 0;
    lines.push(formatMetricLine("anything_circuit_state", { circuit: name }, value));
  }

  lines.push("# TYPE anything_circuit_error_budget_remaining gauge");
  for (const [name, snapshot] of circuitSnapshots.entries()) {
    const remaining = Math.max(
      Number(snapshot.failureThreshold || 0) - Number(snapshot.failureCount || 0),
      0
    );
    lines.push(
      formatMetricLine(
        "anything_circuit_error_budget_remaining",
        { circuit: name },
        remaining
      )
    );
  }

  lines.push("# TYPE anything_circuit_cooldown_ms gauge");
  for (const [name, snapshot] of circuitSnapshots.entries()) {
    lines.push(
      formatMetricLine(
        "anything_circuit_cooldown_ms",
        { circuit: name },
        Number(snapshot.cooldownPeriod || 0)
      )
    );
  }

  lines.push("# TYPE anything_circuit_trips_total counter");
  for (const [name, value] of circuitTrips.entries()) {
    lines.push(formatMetricLine("anything_circuit_trips_total", { circuit: name }, value));
  }

  lines.push("# TYPE anything_queue_saturation_total counter");
  for (const [name, value] of queueSaturations.entries()) {
    lines.push(
      formatMetricLine("anything_queue_saturation_total", { queue: name }, value)
    );
  }

  lines.push("# TYPE anything_agent_errors_total counter");
  for (const [key, value] of agentErrorCounters.entries()) {
    const [agent, provider] = key.split("::");
    lines.push(
      formatMetricLine("anything_agent_errors_total", { agent, provider }, value)
    );
  }

  return `${lines.join("\n")}\n`;
}

function getStructuredEvents() {
  return {
    queueSaturation: Array.from(queueSaturations.entries()).map(([queue, count]) => ({
      queue,
      count,
    })),
    circuitTrips: Array.from(circuitTrips.entries()).map(([circuit, total]) => ({
      circuit,
      total,
    })),
    agentErrors: Array.from(agentErrorCounters.entries()).map(([key, total]) => {
      const [agent, provider] = key.split("::");
      return { agent, provider, total };
    }),
  };
}

const registry = {
  contentType: "text/plain; version=0.0.4",
};

module.exports = {
  registry,
  setQueueMetrics,
  setCircuitState,
  getPrometheusMetrics,
  metricsEmitter,
  recordAgentError,
  getStructuredEvents,
  recordQueueDuration,
};
