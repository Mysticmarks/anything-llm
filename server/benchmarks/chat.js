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
  const workspaceSlug = process.env.CHAT_BENCH_WORKSPACE_SLUG;
  if (!workspaceSlug) {
    throw new Error("CHAT_BENCH_WORKSPACE_SLUG is required to run chat benchmark");
  }

  const message = process.env.CHAT_BENCH_MESSAGE || "Benchmark ping";
  const concurrency = Number(process.env.CHAT_BENCH_CONNECTIONS || 12) || 12;
  const durationSeconds = Number(process.env.CHAT_BENCH_DURATION || 30) || 30;
  const streamTimeout =
    Number(process.env.CHAT_BENCH_STREAM_TIMEOUT_MS || 8000) || 8000;

  const durationMs = durationSeconds * 1000;
  const { origin, basePath } = resolveBase();
  const headers = buildHeaders();
  const url = `${origin}${basePath}/workspace/${workspaceSlug}/stream-chat`;
  const body = JSON.stringify({ message });

  const summary = {
    completed: 0,
    failed: 0,
    latencies: [],
  };

  async function requestOnce() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), streamTimeout);
    const start = performance.now();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        try {
          await reader.read();
        } catch (error) {
          if (error.name !== "AbortError") throw error;
        } finally {
          reader.releaseLock();
        }
      }

      summary.completed += 1;
      summary.latencies.push(performance.now() - start);
    } catch (error) {
      if (error.name !== "AbortError") {
        summary.failed += 1;
      }
    } finally {
      clearTimeout(timer);
      controller.abort();
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

  console.log("Chat benchmark complete");
  console.log(
    JSON.stringify(
      {
        type: "chat",
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
  console.error("Chat benchmark failed", error);
  process.exitCode = 1;
});
