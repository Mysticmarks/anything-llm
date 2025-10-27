const { validApiKey } = require("../utils/middleware/validApiKey");
const { gatherAllMetrics } = require("../utils/queues/metrics");

function metricsEndpoints(app) {
  if (!app) return;

  app.get("/metrics", [validApiKey], async (_, response) => {
    try {
      const queues = await gatherAllMetrics();
      response.status(200).json({
        success: true,
        queues,
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
