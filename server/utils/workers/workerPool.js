const { Worker } = require("worker_threads");
const os = require("os");
const path = require("path");

class WorkerPool {
  constructor({
    name,
    mode = "thread",
    workerPath = null,
    size = Math.max(1, Math.floor(os.cpus().length / 2)),
    endpoint = null,
    headers = {},
    timeout = 120000,
  }) {
    this.name = name;
    this.mode = mode;
    this.workerPath = workerPath
      ? path.resolve(workerPath)
      : path.resolve(__dirname, "embeddingTask.js");
    this.size = size;
    this.endpoint = endpoint;
    this.headers = headers;
    this.timeout = timeout;
    this.queue = [];
    this.workers = [];
    this.pending = new Map();
    this.externalActive = 0;
    this.jobCounter = 0;

    if (this.mode === "thread") {
      for (let idx = 0; idx < this.size; idx += 1) {
        this.spawnWorker();
      }
    }
  }

  spawnWorker() {
    const worker = new Worker(this.workerPath, {
      workerData: {
        pool: this.name,
      },
    });

    const state = { worker, idle: true };

    worker.on("message", (message) => {
      const { id, status, result, error } = message || {};
      const job = this.pending.get(id);
      if (!job) return;
      this.pending.delete(id);
      clearTimeout(job.timer);
      state.idle = true;
      this.schedule();
      if (status === "ok") {
        job.resolve(result);
      } else {
        job.reject(new Error(error || "Worker task failed"));
      }
    });

    worker.on("error", (error) => {
      console.error(
        `\x1b[31m[WorkerPool:${this.name}]\x1b[0m ${error?.message || error}`
      );
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        console.error(
          `\x1b[31m[WorkerPool:${this.name}]\x1b[0m worker exited with code ${code}`
        );
      }
      this.workers = this.workers.filter((entry) => entry !== state);
      this.spawnWorker();
      this.schedule();
    });

    this.workers.push(state);
    this.schedule();
  }

  enqueue(payload = {}, options = {}) {
    const jobId = `${this.name}-${Date.now()}-${++this.jobCounter}`;
    let resolve;
    let reject;
    const result = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const job = {
      id: jobId,
      payload,
      resolve,
      reject,
      timeout: options.timeout || this.timeout,
    };
    job.result = result;

    if (job.timeout > 0) {
      job.timer = setTimeout(() => {
        if (!this.pending.has(job.id)) return;
        this.pending.delete(job.id);
        job.reject(new Error("Worker pool task timed out"));
        this.schedule();
      }, job.timeout);
    }

    this.queue.push(job);
    this.schedule();

    return {
      id: jobId,
      result,
    };
  }

  schedule() {
    if (this.mode === "external") {
      this.scheduleExternal();
      return;
    }

    const idleWorker = this.workers.find((entry) => entry.idle);
    if (!idleWorker) return;
    const job = this.queue.shift();
    if (!job) return;

    idleWorker.idle = false;
    this.pending.set(job.id, job);
    idleWorker.worker.postMessage({ id: job.id, payload: job.payload });
  }

  async scheduleExternal() {
    if (!this.endpoint) return;
    if (!this.queue.length) return;
    if (this.externalActive >= this.size) return;

    const job = this.queue.shift();
    if (!job) return;

    this.externalActive += 1;
    this.pending.set(job.id, job);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), job.timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify(job.payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }

      const result = await response.json();
      this.pending.delete(job.id);
      clearTimeout(timeoutHandle);
      clearTimeout(job.timer);
      job.resolve(result);
    } catch (error) {
      this.pending.delete(job.id);
      clearTimeout(timeoutHandle);
      clearTimeout(job.timer);
      job.reject(error);
    } finally {
      this.externalActive -= 1;
      this.scheduleExternal();
    }
  }

  async drain() {
    await Promise.allSettled(
      Array.from(this.pending.values()).map((job) => job.result)
    );
  }

  async shutdown() {
    const closers = [];
    for (const entry of this.workers) {
      closers.push(entry.worker.terminate());
    }
    this.workers = [];
    await Promise.allSettled(closers);
  }
}

module.exports = { WorkerPool };
