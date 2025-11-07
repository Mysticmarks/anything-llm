const { EventEmitter } = require("events");

const queueSnapshots = new Map();
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

const CIRCUIT_STATES = {
  closed: 0,
  half_open: 1,
  open: 2,
};

function setCircuitState(name, state) {
  const previous = circuitSnapshots.get(name)?.state;
  circuitSnapshots.set(name, {
    ...circuitSnapshots.get(name),
    ...{ state, updatedAt: Date.now() },
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

  lines.push("# TYPE anything_circuit_state gauge");
  for (const [name, snapshot] of circuitSnapshots.entries()) {
    const value = CIRCUIT_STATES[snapshot.state] ?? 0;
    lines.push(formatMetricLine("anything_circuit_state", { circuit: name }, value));
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
};
