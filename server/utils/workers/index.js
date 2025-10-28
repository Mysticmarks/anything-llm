const os = require("os");
const path = require("path");
const { WorkerPool } = require("./workerPool");

const pools = new Map();

function createEmbeddingPoolOptions() {
  const mode = process.env.EMBEDDING_POOL_MODE || "thread";
  const size = Number(process.env.EMBEDDING_POOL_SIZE || 0) ||
    Math.max(1, Math.floor(os.cpus().length / 2));
  const timeout = Number(process.env.EMBEDDING_POOL_TIMEOUT_MS || 120000);

  if (mode === "external") {
    let headers = {};
    if (process.env.EMBEDDING_POOL_HEADERS) {
      try {
        headers = JSON.parse(process.env.EMBEDDING_POOL_HEADERS);
      } catch (error) {
        console.warn(
          "[WorkerPool] Failed to parse EMBEDDING_POOL_HEADERS env value",
          error?.message || error
        );
      }
    }
    return {
      name: "embedding",
      mode,
      size,
      timeout,
      endpoint: process.env.EMBEDDING_POOL_ENDPOINT || null,
      headers,
    };
  }

  return {
    name: "embedding",
    mode: "thread",
    workerPath: path.resolve(__dirname, "embeddingTask.js"),
    size,
    timeout,
  };
}

function getWorkerPool(name, optionsFactory) {
  if (pools.has(name)) return pools.get(name);
  const options = typeof optionsFactory === "function" ? optionsFactory() : optionsFactory;
  const pool = new WorkerPool(options);
  pools.set(name, pool);
  return pool;
}

function getEmbeddingWorkerPool() {
  return getWorkerPool("embedding", createEmbeddingPoolOptions);
}

async function shutdownAllPools() {
  const shutdowns = Array.from(pools.values()).map((pool) => pool.shutdown());
  await Promise.allSettled(shutdowns);
  pools.clear();
}

module.exports = {
  getWorkerPool,
  getEmbeddingWorkerPool,
  shutdownAllPools,
};
