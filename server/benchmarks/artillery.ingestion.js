if (!process.env.INGESTION_WORKSPACE_ID) {
  throw new Error("INGESTION_WORKSPACE_ID must be set for Artillery ingestion scenario");
}

const apiKeyHeader = process.env.BENCHMARK_API_KEY
  ? { "x-anythingllm-apikey": process.env.BENCHMARK_API_KEY }
  : {};

module.exports = {
  config: {
    target: process.env.BENCHMARK_BASE_URL || "http://localhost:3001/api",
    phases: [
      {
        duration: Number(process.env.INGESTION_PHASE_DURATION || 60),
        arrivalRate: Number(process.env.INGESTION_ARRIVAL_RATE || 6),
        name: "ingestion-ramp",
      },
    ],
    defaults: {
      headers: {
        "content-type": "application/json",
        ...apiKeyHeader,
      },
      timeout: Number(process.env.INGESTION_TIMEOUT_MS || 12000),
    },
  },
  scenarios: [
    {
      name: "ingest-text",
      flow: [
        {
          post: {
            url: "/browser-extension/embed-content",
            json: {
              workspaceId: process.env.INGESTION_WORKSPACE_ID,
              textContent:
                process.env.INGESTION_SOURCE ||
                "Benchmark document body generated for ingestion stress testing.",
              metadata: {
                source: "benchmark",
                timestamp: new Date().toISOString(),
              },
            },
          },
        },
      ],
    },
  ],
};
