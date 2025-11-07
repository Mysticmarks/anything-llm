const { validApiKey } = require("../utils/middleware/validApiKey");
const { gatherPerformanceSnapshot } = require("../utils/telemetry/performance");
const { getConcurrencySnapshot } = require("../utils/concurrency");
const {
  registry,
  getPrometheusMetrics,
  getStructuredEvents,
} = require("../utils/metrics/registry");

function metricsEndpoints(app) {
  if (!app) return;

  app.get("/metrics", [validApiKey], async (_, response) => {
    try {
      const performance = await gatherPerformanceSnapshot();
      response.status(200).json({
        success: true,
        queues: performance.queues,
        latency: performance.latency,
        concurrency: getConcurrencySnapshot(),
        events: getStructuredEvents(),
      });
    } catch (error) {
      console.error(error);
      response.status(500).json({
        success: false,
        error: error?.message || "Unable to load metrics",
      });
    }
  });

  app.get("/metrics/prometheus", async (_, response) => {
    try {
      const metrics = await getPrometheusMetrics();
      response.setHeader("Content-Type", registry.contentType);
      response.status(200).send(metrics);
    } catch (error) {
      console.error(error);
      response
        .status(500)
        .json({ success: false, error: "Unable to render metrics" });
    }
  });
}

module.exports = {
  metricsEndpoints,
};
