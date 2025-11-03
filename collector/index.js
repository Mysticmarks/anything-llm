process.env.NODE_ENV === "development"
  ? require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` })
  : require("dotenv").config();

require("./utils/logger")();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const { ACCEPTED_MIMES } = require("./utils/constants");
const { reqBody } = require("./utils/http");
const { processSingleFile } = require("./processSingleFile");
const { processLink, getLinkText } = require("./processLink");
const { wipeCollectorStorage } = require("./utils/files");
const extensions = require("./extensions");
const { processRawText } = require("./processRawText");
const { verifyPayloadIntegrity } = require("./middleware/verifyIntegrity");
const { httpLogger } = require("./middleware/httpLogger");
const { enqueueProcessingJob, getQueueEvents } = require("./utils/queue");
const { runCollectorStartupDiagnostics } = require("./utils/startupDiagnostics");
const {
  cluster,
  workerTarget,
  restartDelay,
  SHOULD_SUPERVISE,
} = require("../supervisor")("collector");

const FILE_LIMIT = "3GB";

async function runProcessingJob(jobName, payload, fallback) {
  try {
    const job = await enqueueProcessingJob(jobName, payload);
    if (job) {
      const events = await getQueueEvents();
      if (events) {
        return await job.waitUntilFinished(events);
      }
    }
  } catch (error) {
    console.error(
      `\x1b[33m[CollectorQueue]\x1b[0m Fallback triggered for ${jobName}: ${error?.message}`
    );
  }

  return fallback();
}

function normalizeFilename(rawFilename) {
  return path.normalize(rawFilename).replace(/^(\.\.(\/|\\|$))+/, "");
}

function createCollectorApp() {
  const app = express();

  if (
    process.env.NODE_ENV === "development" &&
    !!process.env.ENABLE_HTTP_LOGGER
  ) {
    app.use(
      httpLogger({
        enableTimestamps: !!process.env.ENABLE_HTTP_LOGGER_TIMESTAMPS,
      })
    );
  }

  app.use(cors({ origin: true }));
  app.use(bodyParser.text({ limit: FILE_LIMIT }));
  app.use(bodyParser.json({ limit: FILE_LIMIT }));
  app.use(
    bodyParser.urlencoded({
      limit: FILE_LIMIT,
      extended: true,
    })
  );

  app.post(
    "/process",
    [verifyPayloadIntegrity],
    async function (request, response) {
      const { filename, options = {}, metadata = {} } = reqBody(request);
      try {
        const targetFilename = normalizeFilename(filename);
        const { success, reason, documents = [] } = await runProcessingJob(
          "process-file",
          { filename: targetFilename, options, metadata },
          () => processSingleFile(targetFilename, options, metadata)
        );
        response
          .status(200)
          .json({ filename: targetFilename, success, reason, documents });
      } catch (error) {
        console.error(error);
        response.status(200).json({
          filename,
          success: false,
          reason: "A processing error occurred.",
          documents: [],
        });
      }
    }
  );

  app.post(
    "/parse",
    [verifyPayloadIntegrity],
    async function (request, response) {
      const { filename, options = {} } = reqBody(request);
      try {
        const targetFilename = normalizeFilename(filename);
        const { success, reason, documents = [] } = await runProcessingJob(
          "parse-file",
          {
            filename: targetFilename,
            options: { ...options, parseOnly: true },
            metadata: {},
          },
          () =>
            processSingleFile(targetFilename, {
              ...options,
              parseOnly: true,
            })
        );
        response
          .status(200)
          .json({ filename: targetFilename, success, reason, documents });
      } catch (error) {
        console.error(error);
        response.status(200).json({
          filename,
          success: false,
          reason: "A processing error occurred.",
          documents: [],
        });
      }
    }
  );

  app.post(
    "/process-link",
    [verifyPayloadIntegrity],
    async function (request, response) {
      const { link, scraperHeaders = {}, metadata = {} } = reqBody(request);
      try {
        const { success, reason, documents = [] } = await runProcessingJob(
          "process-link",
          { link, scraperHeaders, metadata },
          () => processLink(link, scraperHeaders, metadata)
        );
        response.status(200).json({ url: link, success, reason, documents });
      } catch (error) {
        console.error(error);
        response.status(200).json({
          url: link,
          success: false,
          reason: "A processing error occurred.",
          documents: [],
        });
      }
    }
  );

  app.post(
    "/util/get-link",
    [verifyPayloadIntegrity],
    async function (request, response) {
      const { link, captureAs = "text" } = reqBody(request);
      try {
        const { success, content = null } = await runProcessingJob(
          "fetch-link",
          { link, captureAs },
          () => getLinkText(link, captureAs)
        );
        response.status(200).json({ url: link, success, content });
      } catch (error) {
        console.error(error);
        response.status(200).json({
          url: link,
          success: false,
          content: null,
        });
      }
    }
  );

  app.post(
    "/process-raw-text",
    [verifyPayloadIntegrity],
    async function (request, response) {
      const { textContent, metadata = {} } = reqBody(request);
      try {
        const { success, reason, documents = [] } = await runProcessingJob(
          "process-raw-text",
          { textContent, metadata },
          () => processRawText(textContent, metadata)
        );
        response
          .status(200)
          .json({ filename: metadata.title, success, reason, documents });
      } catch (error) {
        console.error(error);
        response.status(200).json({
          filename: metadata?.title || "Unknown-doc.txt",
          success: false,
          reason: "A processing error occurred.",
          documents: [],
        });
      }
    }
  );

  extensions(app);

  app.get("/accepts", function (_, response) {
    response.status(200).json(ACCEPTED_MIMES);
  });

  app.get("/", function (_, response) {
    response.status(200).json({ ok: true });
  });

  app.all("*", function (_, response) {
    response.sendStatus(200);
  });

  return app;
}

async function startCollector() {
  try {
    await runCollectorStartupDiagnostics();
  } catch (error) {
    console.error(
      `\x1b[31m[CollectorDiagnostics]\x1b[0m ${error.message || "Diagnostics failed"}`
    );
    process.exit(1);
  }

  require("./jobs").boot();

  const app = createCollectorApp();
  const port = Number(process.env.COLLECTOR_PORT || 8888);

  app
    .listen(port, async () => {
      await wipeCollectorStorage();
      console.log(`Document processor app listening on port ${port}`);
    })
    .on("error", function () {
      process.once("SIGUSR2", function () {
        process.kill(process.pid, "SIGUSR2");
      });
      process.on("SIGINT", function () {
        process.kill(process.pid, "SIGINT");
      });
    });
}

const supervise = () => {
  const forkWorker = () => {
    const worker = cluster.fork();
    worker.on("exit", (code, signal) => {
      const exitCode = code ?? 0;
      const reason = signal ? `${signal}` : `${exitCode}`;
      console.warn(`Collector worker ${worker.process.pid} exited with ${reason}`);
    });
    return worker;
  };

  for (let i = 0; i < workerTarget; i += 1) {
    forkWorker();
  }

  cluster.on("exit", (worker, code, signal) => {
    if (worker.exitedAfterDisconnect) return;
    const exitCode = code ?? 0;
    const reason = signal ? `${signal}` : `${exitCode}`;
    console.warn(
      `Collector worker ${worker.process.pid} crashed (${reason}). Restarting in ${restartDelay}ms.`
    );
    setTimeout(() => {
      forkWorker();
    }, restartDelay);
  });

  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down collector cluster.`);
    for (const id of Object.keys(cluster.workers)) {
      const worker = cluster.workers[id];
      if (worker?.isConnected()) {
        worker.process.kill(signal);
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

if (SHOULD_SUPERVISE && cluster.isPrimary) {
  supervise();
} else {
  startCollector();
}
