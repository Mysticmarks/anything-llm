const bullmq = require("bullmq");
const { ensureConnection, getConnection, isDisabled } = require("./connection");

const EMBEDDING_QUEUE = "embedding-jobs";
const Queue = bullmq.Queue;
const QueueEvents = bullmq.QueueEvents;
const RawQueueScheduler =
  typeof bullmq.QueueScheduler === "function"
    ? bullmq.QueueScheduler
    : bullmq.QueueScheduler?.QueueScheduler || bullmq.default?.QueueScheduler;

let queue = null;
let events = null;
let scheduler = null;
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
  if (isDisabled()) return false;
  if (queue && events && scheduler) return true;
  if (initializing) return initializing;

  initializing = ensureConnection()
    .then(async (ready) => {
      if (!ready) return false;
      if (typeof Queue !== "function") {
        console.warn(
          "\x1b[33m[EmbeddingQueue]\x1b[0m Queue implementation missing"
        );
        return false;
      }

      queue = new Queue(EMBEDDING_QUEUE, {
        connection: getConnection(),
        defaultJobOptions,
      });
      if (typeof RawQueueScheduler !== "function") {
        console.warn(
          "\x1b[33m[EmbeddingQueue]\x1b[0m QueueScheduler implementation missing"
        );
        queue = null;
        return false;
      }

      scheduler = new RawQueueScheduler(EMBEDDING_QUEUE, {
        connection: getConnection(),
      });
      scheduler.on("error", (error) => {
        console.error(
          `\x1b[31m[EmbeddingQueue]\x1b[0m Scheduler error: ${
            error?.message || error
          }`
        );
      });
      try {
        await scheduler.waitUntilReady();
      } catch (error) {
        console.warn(
          `\x1b[33m[EmbeddingQueue]\x1b[0m Failed to initialize scheduler: ${
            error?.message
          }`
        );
        queue = null;
        scheduler = null;
        return false;
      }
      if (typeof QueueEvents !== "function") {
        console.warn(
          "\x1b[33m[EmbeddingQueue]\x1b[0m QueueEvents implementation missing"
        );
        queue = null;
        scheduler = null;
        return false;
      }

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
          `\x1b[33m[EmbeddingQueue]\x1b[0m Failed to initialize queue events: ${
            error?.message
          }`
        );
        queue = null;
        events = null;
        scheduler = null;
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

async function getQueueScheduler() {
  const ready = await initQueue();
  return ready ? scheduler : null;
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
  getQueueScheduler,
  getQueueWorkers,
};
