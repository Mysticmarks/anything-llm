const { gatherAllMetrics } = require("../queues/metrics");
const { LatencyProfiler } = require("./latencyProfiler");

async function gatherPerformanceSnapshot(options = {}) {
  const [queueMetrics, latency] = await Promise.all([
    gatherAllMetrics().catch((error) => {
      console.warn(
        "[Performance] Unable to gather queue metrics",
        error?.message || error
      );
      return [];
    }),
    Promise.resolve(LatencyProfiler.summarize(options)),
  ]);

  return {
    queues: queueMetrics,
    latency,
  };
}

module.exports = {
  gatherPerformanceSnapshot,
};
