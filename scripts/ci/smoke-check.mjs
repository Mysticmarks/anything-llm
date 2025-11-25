import { setTimeout as delay } from "node:timers/promises";
import { TextDecoder } from "node:util";

const baseUrl = process.env.ANYTHINGLLM_BASE_URL || "http://127.0.0.1:3001/api";
const authPassword = process.env.ANYTHINGLLM_AUTH_PASSWORD || "integration-secret";
const skipChat = process.env.SKIP_CHAT_CHECK === "true";
const metricsPath = process.env.METRICS_PATH || "/metrics/prometheus";

async function waitForHttp(url, expectedStatus = 200, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status === expectedStatus) return response;
      lastError = new Error(`status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1500);
  }
  const reason = lastError?.message || "no response";
  throw new Error(`Timed out waiting for ${url}: ${reason}`);
}

async function ensureHealth() {
  const response = await waitForHttp(`${baseUrl}/health`);
  const body = await response.json();
  if (body.status !== "ok") {
    throw new Error(`Health endpoint returned non-ok status: ${JSON.stringify(body)}`);
  }
}

async function checkMetrics() {
  const response = await waitForHttp(`${baseUrl}${metricsPath}`);
  const text = await response.text();
  if (!text.includes("anything_queue_pending") || !text.includes("anything_circuit_state")) {
    throw new Error("Prometheus metrics missing expected series");
  }
}

async function authenticate() {
  const response = await fetch(`${baseUrl}/request-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: authPassword }),
  });
  if (!response.ok) throw new Error(`request-token failed with status ${response.status}`);
  const json = await response.json();
  if (!json.valid || !json.token) {
    throw new Error(`Login did not return a token: ${JSON.stringify(json)}`);
  }
  return json.token;
}

async function createWorkspace(token) {
  const response = await fetch(`${baseUrl}/workspace/new`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: `ci-smoke-${Date.now()}`, onboardingComplete: true }),
  });
  if (!response.ok) throw new Error(`workspace/new failed with status ${response.status}`);
  const json = await response.json();
  const slug = json?.workspace?.slug;
  if (!slug) throw new Error(`Workspace response missing slug: ${JSON.stringify(json)}`);
  return slug;
}

async function uploadDocument(token, slug) {
  const form = new FormData();
  form.append(
    "file",
    new Blob(["Smoke test content"], { type: "text/plain" }),
    "smoke.txt"
  );

  const response = await fetch(`${baseUrl}/workspace/${slug}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);
  const json = await response.json();
  if (!json.success) throw new Error(`Upload response unexpected: ${JSON.stringify(json)}`);
}

async function probeChat(token, slug) {
  const response = await fetch(`${baseUrl}/workspace/${slug}/stream-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: "Hello from CI smoke", attachments: [] }),
  });
  if (!response.ok) throw new Error(`Chat stream returned status ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Chat stream did not expose a readable body");
  const decoder = new TextDecoder();
  const { value } = await reader.read();
  const chunk = decoder.decode(value || new Uint8Array());
  if (!chunk.includes("textResponse") && !chunk.includes("id:")) {
    throw new Error("Chat stream did not yield an event chunk");
  }
  reader.cancel().catch(() => {});
}

async function main() {
  await ensureHealth();
  await checkMetrics();
  const token = await authenticate();
  const slug = await createWorkspace(token);
  await uploadDocument(token, slug);
  if (!skipChat) {
    await probeChat(token, slug);
  }
  console.log("Smoke checks completed successfully.");
}

main().catch((error) => {
  console.error(`[smoke-check] ${error.message}`);
  process.exit(1);
});
