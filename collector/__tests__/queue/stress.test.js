jest.mock("../../utils/queue/connection", () => ({
  ensureConnection: async () => true,
  getConnection: () => ({}),
  isReady: () => true,
  redisUrl: "mock://local",
}));

jest.mock("bullmq", () => {
  const { EventEmitter } = require("events");
  const workers = [];

  class Queue {
    constructor(name) {
      this.name = name;
    }

    async add(jobName, data) {
      const job = {
        id: `${jobName}-${Date.now()}-${Math.random()}`,
        name: jobName,
        data,
      };
      for (const worker of workers) worker._enqueue(job);
      return job;
    }
  }

  class QueueEvents {
    async waitUntilReady() {
      return true;
    }

    async close() {
      return true;
    }

    on() {}
  }

  class Worker extends EventEmitter {
    constructor(name, processor, options = {}) {
      super();
      this.name = name;
      this.processor = processor;
      this.concurrency = options.concurrency || 1;
      this.queue = [];
      this.active = 0;
      this.maxActive = 0;
      workers.push(this);
    }

    _enqueue(job) {
      this.queue.push(job);
      this._drain();
    }

    async _run(job) {
      this.active += 1;
      this.maxActive = Math.max(this.maxActive, this.active);
      try {
        await this.processor(job);
        this.emit("completed", job);
      } catch (error) {
        this.emit("failed", job, error);
      } finally {
        this.active -= 1;
        this._drain();
      }
    }

    _drain() {
      while (this.queue.length > 0 && this.active < this.concurrency) {
        const next = this.queue.shift();
        this._run(next);
      }
    }

    async waitUntilReady() {
      return true;
    }

    async close() {
      this.queue = [];
      this.removeAllListeners();
    }
  }

  return { Queue, QueueEvents, Worker };
});

const { enqueueProcessingJob, PROCESSING_QUEUE, getQueueEvents } = require("../../utils/queue");
const { Worker } = require("bullmq");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Collector BullMQ stress tests", () => {
  jest.setTimeout(30000);
  let worker;
  let queueEvents;

  beforeAll(async () => {
    queueEvents = await getQueueEvents();
    worker = new Worker(
      PROCESSING_QUEUE,
      async () => {
        await delay(40);
      },
      { concurrency: 6 }
    );
    await worker.waitUntilReady();
  });

  afterAll(async () => {
    if (worker) await worker.close();
    if (queueEvents) await queueEvents.close();
  });

  test("processes jobs in parallel under load", async () => {
    const jobCount = 24;
    const completions = [];
    worker.on("completed", (job) => completions.push(job.id));

    const start = Date.now();
    for (let i = 0; i < jobCount; i += 1) {
      await enqueueProcessingJob("process-file", { index: i });
    }

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Jobs timed out")), 10000);
      const check = () => {
        if (completions.length >= jobCount) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(check, 25);
        }
      };
      check();
    });

    const duration = Date.now() - start;
    expect(worker.maxActive).toBeGreaterThanOrEqual(4);
    expect(duration).toBeLessThan(40 * jobCount);
  });
});
