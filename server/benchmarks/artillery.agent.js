if (!process.env.AGENT_FLOW_UUID) {
  throw new Error("AGENT_FLOW_UUID must be set for Artillery agent scenario");
}

const apiKeyHeader = process.env.BENCHMARK_API_KEY
  ? { "x-anythingllm-apikey": process.env.BENCHMARK_API_KEY }
  : {};

module.exports = {
  config: {
    target: process.env.BENCHMARK_BASE_URL || "http://localhost:3001/api",
    phases: [
      {
        duration: Number(process.env.AGENT_PHASE_DURATION || 60),
        arrivalRate: Number(process.env.AGENT_ARRIVAL_RATE || 4),
        name: "agent-flow",
      },
    ],
    defaults: {
      headers: {
        "content-type": "application/json",
        ...apiKeyHeader,
      },
      timeout: Number(process.env.AGENT_TIMEOUT_MS || 12000),
    },
  },
  scenarios: [
    {
      name: "execute-agent-flow",
      flow: [
        {
          post: {
            url: `/agent-flows/${process.env.AGENT_FLOW_UUID}/run`,
            json: JSON.parse(process.env.AGENT_VARIABLES || "{}"),
          },
        },
      ],
    },
  ],
};
