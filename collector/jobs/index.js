const path = require("path");
const { Worker } = require("worker_threads");

const workers = new Map();

function spawnWorker(name, script, options = {}) {
  if (workers.has(name)) return workers.get(name);
  const worker = new Worker(path.resolve(__dirname, script), {
    workerData: {
      redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
      concurrency: options.concurrency,
    },
  });

  worker.on("error", (error) => {
    console.error(`\x1b[31m[CollectorWorker:${name}]\x1b[0m ${error?.message}`);
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      console.error(
        `\x1b[31m[CollectorWorker:${name}]\x1b[0m exited with code ${code}`
      );
    }
  });

  workers.set(name, worker);
  return worker;
}

function boot() {
  if (process.env.DISABLE_COLLECTOR_JOB_WORKERS === "true") return;
  spawnWorker("processing", "processingWorker.js", {
    concurrency: Number(process.env.COLLECTOR_WORKER_CONCURRENCY || 2),
  });
}

module.exports = {
  boot,
  workers,
};
