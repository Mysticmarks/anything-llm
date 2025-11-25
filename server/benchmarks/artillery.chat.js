if (!process.env.CHAT_WORKSPACE_SLUG) {
  throw new Error("CHAT_WORKSPACE_SLUG must be set for Artillery chat scenario");
}

const apiKeyHeader = process.env.BENCHMARK_API_KEY
  ? { "x-anythingllm-apikey": process.env.BENCHMARK_API_KEY }
  : {};

module.exports = {
  config: {
    target: process.env.BENCHMARK_BASE_URL || "http://localhost:3001/api",
    phases: [
      {
        duration: Number(process.env.CHAT_PHASE_DURATION || 60),
        arrivalRate: Number(process.env.CHAT_ARRIVAL_RATE || 12),
        name: "chat-burst",
      },
    ],
    defaults: {
      headers: {
        "content-type": "application/json",
        ...apiKeyHeader,
      },
      timeout: Number(process.env.CHAT_TIMEOUT_MS || 8000),
    },
  },
  scenarios: [
    {
      name: "chat-stream",
      flow: [
        {
          post: {
            url: `/workspace/${process.env.CHAT_WORKSPACE_SLUG}/stream-chat`,
            json: { message: process.env.CHAT_MESSAGE || "Benchmark ping" },
          },
        },
      ],
    },
  ],
};
