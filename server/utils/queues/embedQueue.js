const { Queue, QueueEvents } = require("bullmq");
const { ensureConnection, getConnection } = require("./connection");

const EMBEDDING_QUEUE = "embedding-jobs";
let queue = null;
let events = null;
let initializing = null;

const defaultJobOptions = {
  attempts: Number(process.env.EMBEDDING_JOB_ATTEMPTS || 3),
  backoff: {
    type: "exponential",
    delay: Number(process.env.EMBEDDING_JOB_BACKOFF_MS || 2000),
  },
  removeOnComplete: true,
  removeOnFail: false,
};

async function initQueue() {
  if (queue && events) return true;
  if (initializing) return initializing;

  initializing = ensureConnection()
    .then(async (ready) => {
      if (!ready) return false;
      queue = new Queue(EMBEDDING_QUEUE, {
        connection: getConnection(),
        defaultJobOptions,
      });
      events = new QueueEvents(EMBEDDING_QUEUE, {
        connection: getConnection(),
      });
      events.on("error", (error) => {
        console.error(
          `\x1b[31m[EmbeddingQueue]\x1b[0m ${error?.message || error}`
        );
      });
      try {
        await events.waitUntilReady();
      } catch (error) {
        console.warn(
          `\x1b[33m[EmbeddingQueue]\x1b[0m Failed to initialize queue events: ${error?.message}`
        );
        queue = null;
        events = null;
        return false;
      }
      return true;
    })
    .finally(() => {
      initializing = null;
    });

  return initializing;
}

async function getQueue() {
  const ready = await initQueue();
  return ready ? queue : null;
}

async function getQueueEvents() {
  const ready = await initQueue();
  return ready ? events : null;
}

async function enqueueEmbeddingJob(data = {}, options = {}) {
  const activeQueue = await getQueue();
  if (!activeQueue) return null;
  return activeQueue.add("embed-documents", data, options);
}

async function getQueueCounts() {
  const activeQueue = await getQueue();
  if (!activeQueue) return null;
  return activeQueue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed"
  );
}

async function getQueueWorkers() {
  const activeQueue = await getQueue();
  if (!activeQueue) return [];
  return activeQueue.getWorkers();
}

module.exports = {
  EMBEDDING_QUEUE,
  enqueueEmbeddingJob,
  getQueue,
  getQueueCounts,
  getQueueEvents,
  getQueueWorkers,
};
