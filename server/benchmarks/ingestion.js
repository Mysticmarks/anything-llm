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

async function run() {
  const workspaceId = process.env.INGESTION_BENCH_WORKSPACE_ID;
  if (!workspaceId) {
    throw new Error(
      "INGESTION_BENCH_WORKSPACE_ID is required to run ingestion benchmark"
    );
  }

  const text =
    process.env.INGESTION_BENCH_SOURCE ||
    "Benchmark document body generated for ingestion stress testing.";
  const concurrency = Number(process.env.INGESTION_BENCH_CONNECTIONS || 6) || 6;
  const durationSeconds = Number(process.env.INGESTION_BENCH_DURATION || 30) || 30;
  const durationMs = durationSeconds * 1000;

  const { origin, basePath } = resolveBase();
  const headers = buildHeaders();
  const url = `${origin}${basePath}/browser-extension/embed-content`;

  const payload = JSON.stringify({
    workspaceId,
    textContent: text,
    metadata: {
      source: "benchmark",
      timestamp: new Date().toISOString(),
    },
  });

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

  console.log("Ingestion benchmark complete");
  console.log(
    JSON.stringify(
      {
        type: "ingestion",
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
  console.error("Ingestion benchmark failed", error);
  process.exitCode = 1;
});
