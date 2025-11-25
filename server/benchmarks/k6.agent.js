import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BENCHMARK_BASE_URL || "http://localhost:3001/api";
const flowUuid = __ENV.AGENT_FLOW_UUID;

const headers = { "Content-Type": "application/json" };
if (__ENV.BENCHMARK_API_KEY) {
  headers["x-anythingllm-apikey"] = __ENV.BENCHMARK_API_KEY;
}

export const options = {
  vus: Number(__ENV.AGENT_VUS || __ENV.AGENT_CONNECTIONS || 4),
  duration: `${__ENV.AGENT_DURATION_SECONDS || 30}s`,
  thresholds: {
    http_req_duration: [
      `p(95)<${Number(__ENV.AGENT_P95_BUDGET_MS || 6000)}`,
    ],
    http_req_failed: ["rate<0.1"],
  },
};

export default function () {
  if (!flowUuid) {
    throw new Error("AGENT_FLOW_UUID must be provided");
  }

  const response = http.post(
    `${baseUrl}/agent-flows/${flowUuid}/run`,
    __ENV.AGENT_VARIABLES || "{}",
    {
      headers,
      timeout: `${__ENV.AGENT_TIMEOUT_MS || 12000}ms`,
      tags: { queue: "agent_flow" },
    }
  );

  check(response, {
    "agent flow status is 200": (res) => res.status === 200,
  });

  sleep(Number(__ENV.AGENT_SLEEP_SECONDS || 0.1));
}
