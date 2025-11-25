import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BENCHMARK_BASE_URL || "http://localhost:3001/api";
const workspaceId = __ENV.INGESTION_WORKSPACE_ID;

const headers = { "Content-Type": "application/json" };
if (__ENV.BENCHMARK_API_KEY) {
  headers["x-anythingllm-apikey"] = __ENV.BENCHMARK_API_KEY;
}

export const options = {
  vus: Number(__ENV.INGESTION_VUS || __ENV.INGESTION_CONNECTIONS || 6),
  duration: `${__ENV.INGESTION_DURATION_SECONDS || 30}s`,
  thresholds: {
    http_req_duration: [
      `p(95)<${Number(__ENV.INGESTION_P95_BUDGET_MS || 5000)}`,
    ],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  if (!workspaceId) {
    throw new Error("INGESTION_WORKSPACE_ID must be provided");
  }

  const payload = JSON.stringify({
    workspaceId,
    textContent:
      __ENV.INGESTION_SOURCE ||
      "Benchmark document body generated for ingestion stress testing.",
    metadata: {
      source: "benchmark",
      timestamp: new Date().toISOString(),
    },
  });

  const response = http.post(
    `${baseUrl}/browser-extension/embed-content`,
    payload,
    {
      headers,
      timeout: `${__ENV.INGESTION_TIMEOUT_MS || 10000}ms`,
      tags: { queue: "ingestion" },
    }
  );

  check(response, {
    "ingestion status is 200": (res) => res.status === 200,
  });

  sleep(Number(__ENV.INGESTION_SLEEP_SECONDS || 0.1));
}
