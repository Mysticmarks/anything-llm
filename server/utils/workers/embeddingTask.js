const { parentPort } = require("worker_threads");
const { Document } = require("../../models/documents");
const { Workspace } = require("../../models/workspace");
const { LatencyProfiler } = require("../telemetry/latencyProfiler");

if (!parentPort) {
  throw new Error("Embedding worker pool requires a parent port");
}

parentPort.on("message", async ({ id, payload }) => {
  try {
    const { workspaceId = null, additions = [], userId = null } = payload || {};
    if (!workspaceId) throw new Error("Workspace context is required");
    const workspace = await Workspace.get({ id: workspaceId });
    if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

    const span = LatencyProfiler.startSpan("embedding.workerTask", {
      workspace: workspace.slug || workspace.id,
      additions: additions.length,
    });
    try {
      const result = await Document._embedDocuments(workspace, additions, userId);
      span.end({ status: "ok" });
      parentPort.postMessage({ id, status: "ok", result });
    } catch (error) {
      span.end({ status: "error", error: error?.message || String(error) });
      parentPort.postMessage({
        id,
        status: "error",
        error: error?.message || String(error),
      });
    }
  } catch (error) {
    parentPort.postMessage({
      id,
      status: "error",
      error: error?.message || String(error),
    });
  }
});
