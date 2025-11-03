const queueSnapshots = new Map();
const circuitSnapshots = new Map();
const circuitTrips = new Map();

function setQueueMetrics(name, snapshot) {
  queueSnapshots.set(name, { ...snapshot, updatedAt: Date.now() });
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
  if (state === "open" && previous !== "open") {
    circuitTrips.set(name, (circuitTrips.get(name) || 0) + 1);
  }
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

  return `${lines.join("\n")}\n`;
}

const registry = {
  contentType: "text/plain; version=0.0.4",
};

module.exports = {
  registry,
  setQueueMetrics,
  setCircuitState,
  getPrometheusMetrics,
};
