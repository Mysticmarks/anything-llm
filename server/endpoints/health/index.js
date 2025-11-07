const prisma = require("../../utils/prisma");
const packageJson = require("../../package.json");
const { isQueueBackendAvailable } = require("../../utils/queues/metrics");
const { getConcurrencySnapshot } = require("../../utils/concurrency");
const { getDiagnosticsSnapshot } = require("../../utils/startupDiagnostics");

function buildResponsePayload(components = {}, statusCode = 200) {
  return {
    status: statusCode === 200 ? "ok" : "error",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: packageJson.version,
    components,
  };
}

async function buildDatabaseStatus() {
  const status = { status: "ok" };
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    status.status = "error";
    status.message = error.message;
  }
  return status;
}

async function handleHealthCheck(_, response) {
  const databaseStatus = await buildDatabaseStatus();
  const statusCode = databaseStatus.status === "ok" ? 200 : 503;
  const payload = buildResponsePayload({ database: databaseStatus }, statusCode);
  response.status(statusCode).json(payload);
}

async function handleReadinessProbe(_, response) {
  const components = {};
  let statusCode = 200;

  const databaseStatus = await buildDatabaseStatus();
  components.database = databaseStatus;
  if (databaseStatus.status !== "ok") statusCode = 503;

  const queueReady = isQueueBackendAvailable();
  components.queueBackend = {
    status: queueReady ? "ok" : "error",
  };
  if (!queueReady) statusCode = 503;

  const concurrency = getConcurrencySnapshot();
  const openCircuits = concurrency.circuits.filter(
    (circuit) => circuit.state === "open"
  );
  components.concurrency = {
    status: openCircuits.length ? "degraded" : "ok",
    queues: concurrency.queues,
    circuits: concurrency.circuits,
  };
  if (openCircuits.length && statusCode === 200) statusCode = 503;

  const diagnostics = getDiagnosticsSnapshot();
  if (diagnostics.status === "error") statusCode = 503;
  components.startupDiagnostics = diagnostics;

  const payload = buildResponsePayload(components, statusCode);
  response.status(statusCode).json(payload);
}

function handleLivenessProbe(_, response) {
  const payload = buildResponsePayload(
    {
      process: {
        status: "ok",
        pid: process.pid,
      },
    },
    200
  );
  response.status(200).json(payload);
}

function healthEndpoints(router) {
  router.get("/health", handleHealthCheck);
  router.get("/health/ready", handleReadinessProbe);
  router.get("/health/live", handleLivenessProbe);
}

module.exports = {
  healthEndpoints,
  handleHealthCheck,
  handleReadinessProbe,
  handleLivenessProbe,
  buildResponsePayload,
};
