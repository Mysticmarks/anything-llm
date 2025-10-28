const { Queue, QueueEvents, QueueScheduler } = require("bullmq");
const { ensureConnection, getConnection } = require("./connection");

const PROCESSING_QUEUE = "collector-processing";
let queue = null;
let events = null;
let scheduler = null;
let initializing = null;

async function initQueue() {
  if (queue && events && scheduler) return true;
  if (initializing) return initializing;

  initializing = ensureConnection()
    .then(async (ready) => {
      if (!ready) return false;
      queue = new Queue(PROCESSING_QUEUE, {
        connection: getConnection(),
        defaultJobOptions: {
          attempts: Number(process.env.COLLECTOR_JOB_ATTEMPTS || 3),
          backoff: {
            type: "exponential",
            delay: Number(process.env.COLLECTOR_JOB_BACKOFF_MS || 1500),
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      });
      scheduler = new QueueScheduler(PROCESSING_QUEUE, {
        connection: getConnection(),
      });
      scheduler.on("error", (error) => {
        console.error(
          `\x1b[31m[CollectorQueue]\x1b[0m Scheduler error: ${
            error?.message || error
          }`
        );
      });
      try {
        await scheduler.waitUntilReady();
      } catch (error) {
        console.warn(
          `\x1b[33m[CollectorQueue]\x1b[0m Failed to initialize scheduler: ${
            error?.message
          }`
        );
        queue = null;
        scheduler = null;
        return false;
      }
      events = new QueueEvents(PROCESSING_QUEUE, {
        connection: getConnection(),
      });
      events.on("error", (error) => {
        console.error(
          `\x1b[31m[CollectorQueue]\x1b[0m ${error?.message || error}`
        );
      });
      try {
        await events.waitUntilReady();
      } catch (error) {
        console.warn(
          `\x1b[33m[CollectorQueue]\x1b[0m Failed to initialize queue events: ${
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

async function enqueueProcessingJob(name, data = {}, options = {}) {
  const activeQueue = await getQueue();
  if (!activeQueue) return null;
  return activeQueue.add(name, data, options);
}

module.exports = {
  PROCESSING_QUEUE,
  enqueueProcessingJob,
  getQueueEvents,
  getQueueScheduler,
};
