#!/usr/bin/env node
const { Worker } = require("bullmq");
const IORedis = require("ioredis");

const { Document } = require("../models/documents");
const { Workspace } = require("../models/workspace");
const { EMBEDDING_QUEUE } = require("../utils/queues/embedQueue");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const concurrency = Number(process.env.EMBEDDING_WORKER_CONCURRENCY || 2);

function log(message, ...args) {
  console.log(`\x1b[36m[EmbeddingService]\x1b[0m ${message}`, ...args);
}

function logError(message, ...args) {
  console.error(`\x1b[31m[EmbeddingService]\x1b[0m ${message}`, ...args);
}

async function createEmbeddingWorker() {
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  connection.on("error", (error) => {
    logError(`Redis error: ${error?.message || error}`);
  });

  try {
    await connection.connect();
    log(`Connected to ${redisUrl}`);
  } catch (error) {
    logError(`Failed to connect to Redis: ${error?.message || error}`);
    throw error;
  }

  const worker = new Worker(
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
      concurrency: Math.max(1, concurrency),
    }
  );

  worker.on("ready", () => {
    log(
      `Listening for jobs on ${EMBEDDING_QUEUE} with concurrency ${Math.max(
        1,
        concurrency
      )}`
    );
  });

  worker.on("completed", (job) => {
    log(`Completed job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    logError(`Job ${job?.id || "unknown"} failed: ${error?.message || error}`);
  });

  worker.on("error", (error) => {
    logError(`Worker error: ${error?.message || error}`);
  });

  const shutdown = async (signal) => {
    log(`Received ${signal}. Shutting down.`);
    try {
      await worker.close();
    } catch (error) {
      logError(`Failed to close worker: ${error?.message || error}`);
    }
    try {
      connection.disconnect();
    } catch (error) {
      logError(`Failed to disconnect Redis: ${error?.message || error}`);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return worker;
}

if (require.main === module) {
  createEmbeddingWorker().catch((error) => {
    logError(`Fatal error: ${error?.stack || error?.message || error}`);
    process.exit(1);
  });
}

module.exports = { createEmbeddingWorker };
