const { Queue } = require("bullmq");
const {
  ensureConnection,
  getConnection,
  isConnectionReady,
} = require("./connection");
const { setQueueMetrics } = require("../metrics/registry");
const { EMBEDDING_QUEUE } = require("./embedQueue");

const queues = new Map();

function getQueueHandle(name) {
  if (queues.has(name)) return queues.get(name);
  const handle = new Queue(name, { connection: getConnection() });
  queues.set(name, handle);
  return handle;
}

async function gatherQueueMetrics(name) {
  const ready = await ensureConnection();
  if (!ready) {
    return {
      name,
      available: false,
      reason: "Queue backend is unavailable",
    };
  }

  const handle = getQueueHandle(name);
  const counts = await handle.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed"
  );
  const workers = await handle.getWorkers();

  setQueueMetrics(name, {
    name,
    pending: Number(counts.waiting || 0) + Number(counts.delayed || 0),
    active: Number(counts.active || 0),
    concurrency: workers.length || 0,
  });

  return {
    name,
    available: true,
    counts,
    workers: workers.map((worker) => ({
      id: worker.id,
      addr: worker.addr,
      name: worker.name,
      lastBeat: worker.lastBeat,
    })),
  };
}

async function gatherAllMetrics() {
  const metrics = [];
  metrics.push(await gatherQueueMetrics(EMBEDDING_QUEUE));
  metrics.push(await gatherQueueMetrics("collector-processing"));
  return metrics;
}

module.exports = {
  gatherAllMetrics,
  gatherQueueMetrics,
  queues,
  isQueueBackendAvailable: isConnectionReady,
};
