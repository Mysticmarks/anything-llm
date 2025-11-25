const { AsyncQueue } = require("./asyncQueue");
const { CircuitBreaker } = require("./circuitBreaker");
const {
  setQueueMetrics,
  setCircuitState,
  recordQueueDuration,
} = require("../metrics/registry");

const queueSnapshots = new Map();
const circuitSnapshots = new Map();

function createQueue(name, options = {}) {
  const queue = new AsyncQueue({
    name,
    concurrency: options.concurrency,
    onUpdate: (snapshot) => {
      queueSnapshots.set(name, snapshot);
      setQueueMetrics(name, snapshot);
    },
    onTiming: (durationMs) => recordQueueDuration(name, durationMs),
  });

  // Seed metrics with initial snapshot
  const initialSnapshot = queue.snapshot();
  queueSnapshots.set(name, initialSnapshot);
  setQueueMetrics(name, initialSnapshot);

  return queue;
}

function createCircuit(name, options = {}) {
  const circuit = new CircuitBreaker({
    name,
    failureThreshold: options.failureThreshold,
    successThreshold: options.successThreshold,
    cooldownPeriod: options.cooldownPeriod,
    onStateChange: (state, previous) => {
      circuitSnapshots.set(name, circuit.snapshot());
      if (previous !== state) {
        setCircuitState(name, state, circuit.snapshot());
      }
    },
  });

  const boundExec = circuit.exec.bind(circuit);
  circuit.exec = async (...args) => {
    try {
      return await boundExec(...args);
    } finally {
      circuitSnapshots.set(name, circuit.snapshot());
    }
  };

  // initialize metrics
  circuitSnapshots.set(name, circuit.snapshot());
  setCircuitState(name, circuit.state, circuit.snapshot());

  return circuit;
}

const chatQueue = createQueue("chat", {
  concurrency: Number(process.env.CHAT_QUEUE_CONCURRENCY || 4) || 4,
});

const ingestionQueue = createQueue("ingestion", {
  concurrency: Number(process.env.INGESTION_QUEUE_CONCURRENCY || 3) || 3,
});

const agentFlowQueue = createQueue("agent_flow", {
  concurrency: Number(process.env.AGENT_FLOW_QUEUE_CONCURRENCY || 2) || 2,
});

const chatCircuitBreaker = createCircuit("chat", {
  failureThreshold: Number(process.env.CHAT_CIRCUIT_FAILURE_THRESHOLD || 5) || 5,
  successThreshold: Number(process.env.CHAT_CIRCUIT_SUCCESS_THRESHOLD || 1) || 1,
  cooldownPeriod: Number(process.env.CHAT_CIRCUIT_COOLDOWN_MS || 45000) || 45000,
});

const agentCircuitBreaker = createCircuit("agent_flow", {
  failureThreshold:
    Number(process.env.AGENT_CIRCUIT_FAILURE_THRESHOLD || 3) || 3,
  successThreshold:
    Number(process.env.AGENT_CIRCUIT_SUCCESS_THRESHOLD || 1) || 1,
  cooldownPeriod: Number(process.env.AGENT_CIRCUIT_COOLDOWN_MS || 60000) || 60000,
});

function getConcurrencySnapshot() {
  return {
    queues: Array.from(queueSnapshots.values()),
    circuits: Array.from(circuitSnapshots.values()),
  };
}

module.exports = {
  chatQueue,
  ingestionQueue,
  agentFlowQueue,
  chatCircuitBreaker,
  agentCircuitBreaker,
  getConcurrencySnapshot,
};
