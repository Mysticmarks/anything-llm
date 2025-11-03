const { performance } = require("perf_hooks");

function resolveBase() {
  const raw = process.env.BENCHMARK_BASE_URL || "http://localhost:3001/api";
  const url = new URL(raw);
  return {
    origin: `${url.protocol}//${url.host}`,
    basePath: url.pathname.replace(/\/$/, ""),
  };
}

function buildHeaders() {
  const headers = { "content-type": "application/json" };
  if (process.env.BENCHMARK_API_KEY) {
    headers["x-anythingllm-apikey"] = process.env.BENCHMARK_API_KEY;
  }
  return headers;
}

function parseVariables() {
  const raw = process.env.AGENT_BENCH_VARIABLES || "{}";
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Agent benchmark variables must resolve to an object");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse AGENT_BENCH_VARIABLES: ${error.message}`);
  }
}

async function run() {
  const flowUuid = process.env.AGENT_BENCH_FLOW_UUID;
  if (!flowUuid) {
    throw new Error("AGENT_BENCH_FLOW_UUID is required to run agent benchmark");
  }

  const concurrency = Number(process.env.AGENT_BENCH_CONNECTIONS || 4) || 4;
  const durationSeconds = Number(process.env.AGENT_BENCH_DURATION || 30) || 30;
  const durationMs = durationSeconds * 1000;
  const workspaceId = process.env.AGENT_BENCH_WORKSPACE_ID || null;
  const workspaceSlug = process.env.AGENT_BENCH_WORKSPACE_SLUG || null;

  const body = {
    variables: parseVariables(),
    includeTelemetry: false,
  };

  if (workspaceId) body.workspaceId = workspaceId;
  if (workspaceSlug) body.workspaceSlug = workspaceSlug;

  const { origin, basePath } = resolveBase();
  const headers = buildHeaders();
  const url = `${origin}${basePath}/agent-flows/${flowUuid}/run`;

  const payload = JSON.stringify(body);
  const summary = {
    completed: 0,
    failed: 0,
    latencies: [],
  };

  async function requestOnce() {
    const start = performance.now();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: payload,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      summary.completed += 1;
      summary.latencies.push(performance.now() - start);
    } catch (error) {
      summary.failed += 1;
    }
  }

  async function worker(endTime) {
    while (performance.now() < endTime) {
      await requestOnce();
    }
  }

  const endTime = performance.now() + durationMs;
  await Promise.all(Array.from({ length: concurrency }, () => worker(endTime)));

  const averageLatency =
    summary.latencies.reduce((sum, value) => sum + value, 0) /
      (summary.latencies.length || 1);

  console.log("Agent flow benchmark complete");
  console.log(
    JSON.stringify(
      {
        type: "agent",
        completed: summary.completed,
        failed: summary.failed,
        averageLatencyMs: Number(averageLatency.toFixed(2)),
        durationSeconds,
        concurrency,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error("Agent benchmark failed", error);
  process.exitCode = 1;
});
