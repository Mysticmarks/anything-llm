const { Worker: BullWorker } = require("bullmq");
const { workerData, parentPort } = require("worker_threads");
const IORedis = require("ioredis");

const { processSingleFile } = require("../processSingleFile");
const { processLink, getLinkText } = require("../processLink");
const { processRawText } = require("../processRawText");
const { PROCESSING_QUEUE } = require("../utils/queue");

const redisUrl = workerData?.redisUrl || process.env.REDIS_URL;
const connection = new IORedis(redisUrl || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

connection.on("error", (error) => {
  console.error(
    `\x1b[31m[CollectorWorker]\x1b[0m Redis error: ${error?.message}`
  );
});

const worker = new BullWorker(
  PROCESSING_QUEUE,
  async (job) => {
    switch (job.name) {
      case "process-file":
        return processSingleFile(job.data.filename, job.data.options, job.data.metadata);
      case "parse-file":
        return processSingleFile(job.data.filename, job.data.options, job.data.metadata);
      case "process-link":
        return processLink(job.data.link, job.data.scraperHeaders, job.data.metadata);
      case "process-raw-text":
        return processRawText(job.data.textContent, job.data.metadata);
      case "fetch-link":
        return getLinkText(job.data.link, job.data.captureAs);
      default:
        throw new Error(`Unknown job name ${job.name}`);
    }
  },
  {
    connection,
    concurrency: workerData?.concurrency || 2,
  }
);

worker.on("completed", (job) => {
  console.log(
    `\x1b[32m[CollectorWorker]\x1b[0m Completed job ${job.id}`
  );
});

worker.on("failed", (job, error) => {
  console.error(
    `\x1b[31m[CollectorWorker]\x1b[0m Job ${job?.id} failed: ${error?.message}`
  );
});

worker.on("error", (error) => {
  console.error(
    `\x1b[31m[CollectorWorker]\x1b[0m Worker error: ${error?.message}`
  );
});

if (parentPort) {
  parentPort.postMessage({ ready: true });
}
