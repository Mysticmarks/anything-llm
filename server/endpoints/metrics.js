const { validApiKey } = require("../utils/middleware/validApiKey");
const { gatherPerformanceSnapshot } = require("../utils/telemetry/performance");

function metricsEndpoints(app) {
  if (!app) return;

  app.get("/metrics", [validApiKey], async (_, response) => {
    try {
      const performance = await gatherPerformanceSnapshot();
      response.status(200).json({
        success: true,
        queues: performance.queues,
        latency: performance.latency,
      });
    } catch (error) {
      console.error(error);
      response.status(500).json({
        success: false,
        error: error?.message || "Unable to load metrics",
      });
    }
  });
}

module.exports = {
  metricsEndpoints,
};
