process.env.NODE_ENV === "development"
  ? require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` })
  : require("dotenv").config();

require("./utils/logger")();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const { reqBody } = require("./utils/http");
const { healthEndpoints } = require("./endpoints/health");
const { systemEndpoints } = require("./endpoints/system");
const { workspaceEndpoints } = require("./endpoints/workspaces");
const { chatEndpoints } = require("./endpoints/chat");
const { embeddedEndpoints } = require("./endpoints/embed");
const { embedManagementEndpoints } = require("./endpoints/embedManagement");
const { getVectorDbClass } = require("./utils/helpers");
const { adminEndpoints } = require("./endpoints/admin");
const { inviteEndpoints } = require("./endpoints/invite");
const { utilEndpoints } = require("./endpoints/utils");
const { developerEndpoints } = require("./endpoints/api");
const { extensionEndpoints } = require("./endpoints/extensions");
const { bootHTTP, bootSSL } = require("./utils/boot");
const { workspaceThreadEndpoints } = require("./endpoints/workspaceThreads");
const { documentEndpoints } = require("./endpoints/document");
const { agentWebsocket } = require("./endpoints/agentWebsocket");
const { experimentalEndpoints } = require("./endpoints/experimental");
const { agentPluginEndpoints } = require("./endpoints/agentPlugins");
const { browserExtensionEndpoints } = require("./endpoints/browserExtension");
const { communityHubEndpoints } = require("./endpoints/communityHub");
const { agentFlowEndpoints } = require("./endpoints/agentFlows");
const { mcpServersEndpoints } = require("./endpoints/mcpServers");
const { mobileEndpoints } = require("./endpoints/mobile");
const { metricsEndpoints } = require("./endpoints/metrics");
const { httpLogger } = require("./middleware/httpLogger");
const { runStartupDiagnostics } = require("./utils/startupDiagnostics");
const {
  cluster,
  workerTarget,
  restartDelay,
  SHOULD_SUPERVISE,
} = require("../supervisor")("server");

const FILE_LIMIT = "3GB";

function registerApiRoutes(app, apiRouter) {
  systemEndpoints(apiRouter);
  healthEndpoints(apiRouter);
  extensionEndpoints(apiRouter);
  workspaceEndpoints(apiRouter);
  workspaceThreadEndpoints(apiRouter);
  chatEndpoints(apiRouter);
  adminEndpoints(apiRouter);
  inviteEndpoints(apiRouter);
  embedManagementEndpoints(apiRouter);
  utilEndpoints(apiRouter);
  documentEndpoints(apiRouter);
  agentWebsocket(apiRouter);
  experimentalEndpoints(apiRouter);
  agentPluginEndpoints(apiRouter);
  developerEndpoints(app, apiRouter);
  communityHubEndpoints(apiRouter);
  agentFlowEndpoints(apiRouter);
  mcpServersEndpoints(apiRouter);
  mobileEndpoints(apiRouter);
  metricsEndpoints(apiRouter);
  embeddedEndpoints(apiRouter);
  browserExtensionEndpoints(apiRouter);
}

function attachVectorDebugRoute(apiRouter) {
  apiRouter.post("/v/:command", async (request, response) => {
    try {
      const VectorDb = getVectorDbClass();
      const { command } = request.params;
      if (!Object.prototype.hasOwnProperty.call(VectorDb, command)) {
        response.status(500).json({
          message: "invalid interface command",
          commands: Object.getOwnPropertyNames(VectorDb),
        });
        return;
      }

      const body = reqBody(request);
      const result = await VectorDb[command](body);
      response.status(200).json({ ...result });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });
}

function createApp() {
  const app = express();
  const apiRouter = express.Router();

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

  app.use("/api", apiRouter);
  registerApiRoutes(app, apiRouter);

  if (process.env.NODE_ENV === "development") {
    attachVectorDebugRoute(apiRouter);
  } else {
    const { MetaGenerator } = require("./utils/boot/MetaGenerator");
    const IndexPage = new MetaGenerator();

    app.use(
      express.static(path.resolve(__dirname, "public"), {
        extensions: ["js"],
        setHeaders: (res) => {
          res.removeHeader("X-Powered-By");
          res.setHeader("X-Frame-Options", "DENY");
        },
      })
    );

    app.use("/", function (_, response) {
      IndexPage.generate(response);
    });

    app.get("/robots.txt", function (_, response) {
      response.type("text/plain");
      response.send("User-agent: *\nDisallow: /").end();
    });
  }

  app.all("*", function (_, response) {
    response.sendStatus(404);
  });

  return app;
}

async function startServer() {
  try {
    await runStartupDiagnostics();
  } catch (error) {
    console.error(
      `\x1b[31m[StartupDiagnostics]\x1b[0m ${error.message || "Diagnostics failed"}`
    );
    process.exit(1);
  }

  require("./jobs").boot();

  const app = createApp();
  const port = Number(process.env.SERVER_PORT || 3001);

  if (process.env.ENABLE_HTTPS) {
    bootSSL(app, port);
  } else {
    require("@mintplex-labs/express-ws").default(app);
    bootHTTP(app, port);
  }
}

const supervise = () => {
  const forkWorker = () => {
    const worker = cluster.fork();
    worker.on("exit", (code, signal) => {
      const exitCode = code ?? 0;
      const reason = signal ? `${signal}` : `${exitCode}`;
      console.warn(`Server worker ${worker.process.pid} exited with ${reason}`);
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
      `Server worker ${worker.process.pid} crashed (${reason}). Restarting in ${restartDelay}ms.`
    );
    setTimeout(() => {
      forkWorker();
    }, restartDelay);
  });

  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down server cluster.`);
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
  startServer();
}
