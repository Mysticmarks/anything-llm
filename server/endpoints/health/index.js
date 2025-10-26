const prisma = require("../../utils/prisma");
const packageJson = require("../../package.json");

function buildResponsePayload(databaseStatus, statusCode) {
  return {
    status: statusCode === 200 ? "ok" : "error",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: packageJson.version,
    components: {
      database: databaseStatus,
    },
  };
}

async function handleHealthCheck(_, response) {
  let statusCode = 200;
  const databaseStatus = {
    status: "ok",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    statusCode = 503;
    databaseStatus.status = "error";
    databaseStatus.message = error.message;
  }

  const payload = buildResponsePayload(databaseStatus, statusCode);

  response.status(statusCode).json(payload);
}

function healthEndpoints(router) {
  router.get("/health", handleHealthCheck);
}

module.exports = {
  healthEndpoints,
  handleHealthCheck,
  buildResponsePayload,
};
