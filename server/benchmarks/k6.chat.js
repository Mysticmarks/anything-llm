import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BENCHMARK_BASE_URL || "http://localhost:3001/api";
const workspaceSlug = __ENV.CHAT_WORKSPACE_SLUG;

const headers = {
  "Content-Type": "application/json",
};

if (__ENV.BENCHMARK_API_KEY) {
  headers["x-anythingllm-apikey"] = __ENV.BENCHMARK_API_KEY;
}

export const options = {
  vus: Number(__ENV.CHAT_VUS || __ENV.CHAT_CONNECTIONS || 12),
  duration: `${__ENV.CHAT_DURATION_SECONDS || 30}s`,
  thresholds: {
    http_req_duration: [
      `p(95)<${Number(__ENV.CHAT_P95_BUDGET_MS || 4000)}`,
      `p(99)<${Number(__ENV.CHAT_P99_BUDGET_MS || 7000)}`,
    ],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  if (!workspaceSlug) {
    throw new Error("CHAT_WORKSPACE_SLUG must be provided");
  }

  const payload = JSON.stringify({
    message: __ENV.CHAT_MESSAGE || "Benchmark ping",
  });

  const response = http.post(
    `${baseUrl}/workspace/${workspaceSlug}/stream-chat`,
    payload,
    {
      headers,
      timeout: `${__ENV.CHAT_TIMEOUT_MS || 8000}ms`,
      tags: { queue: "chat" },
    }
  );

  check(response, {
    "chat status is 200": (res) => res.status === 200,
  });

  sleep(Number(__ENV.CHAT_SLEEP_SECONDS || 0.1));
}
