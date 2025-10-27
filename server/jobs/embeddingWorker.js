const { Worker: BullWorker } = require("bullmq");
const { workerData, parentPort } = require("worker_threads");
const IORedis = require("ioredis");

const { Document } = require("../models/documents");
const { Workspace } = require("../models/workspace");
const { EMBEDDING_QUEUE } = require("../utils/queues/embedQueue");

const redisUrl = workerData?.redisUrl || process.env.REDIS_URL;
const connection = new IORedis(redisUrl || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

connection.on("error", (error) => {
  console.error(
    `\x1b[31m[EmbeddingWorker]\x1b[0m Redis error: ${error?.message}`
  );
});

const worker = new BullWorker(
  EMBEDDING_QUEUE,
  async (job) => {
    const { workspace, additions = [], userId = null } = job.data || {};
    if (!workspace?.id) {
      throw new Error("Embedding job missing workspace context");
    }

    const workspaceRecord = await Workspace.get({ id: workspace.id });
    if (!workspaceRecord) {
      throw new Error(`Workspace ${workspace.id} not found`);
    }

    return Document._embedDocuments(workspaceRecord, additions, userId);
  },
  {
    connection,
    concurrency: workerData?.concurrency || 2,
  }
);

worker.on("completed", (job) => {
  console.log(
    `\x1b[32m[EmbeddingWorker]\x1b[0m Completed job ${job.id}`
  );
});

worker.on("failed", (job, error) => {
  console.error(
    `\x1b[31m[EmbeddingWorker]\x1b[0m Job ${job?.id} failed: ${error?.message}`
  );
});

worker.on("error", (error) => {
  console.error(
    `\x1b[31m[EmbeddingWorker]\x1b[0m Worker error: ${error?.message}`
  );
});

if (parentPort) {
  parentPort.postMessage({ ready: true });
}
