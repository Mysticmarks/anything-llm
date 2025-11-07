const http = require("http");
const { randomUUID } = require("crypto");

const port = Number(process.env.PORT || 8001);

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function buildCompletionResponse(promptSummary) {
  return {
    id: randomUUID(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "integration-mock",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `Integration response for: ${promptSummary}`,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 12,
      completion_tokens: 8,
      total_tokens: 20,
    },
  };
}

function streamChunks(res, promptSummary) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  const id = randomUUID();
  const baseChunk = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "integration-mock",
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: "Integration response for: " },
        finish_reason: null,
      },
    ],
  };

  res.write(`data: ${JSON.stringify(baseChunk)}\n\n`);

  const secondChunk = {
    ...baseChunk,
    choices: [
      {
        index: 0,
        delta: { content: promptSummary },
        finish_reason: null,
      },
    ],
  };
  res.write(`data: ${JSON.stringify(secondChunk)}\n\n`);

  const finalChunk = {
    ...baseChunk,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  };
  res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

function summarizePrompt(messages = []) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((entry) => entry.role === "user");
  if (!lastUserMessage) return "<empty prompt>";
  if (Array.isArray(lastUserMessage.content)) {
    const textNode = lastUserMessage.content.find(
      (entry) => entry.type === "text"
    );
    return textNode?.text || "<empty prompt>";
  }
  if (typeof lastUserMessage.content === "string") {
    return lastUserMessage.content;
  }
  return "<empty prompt>";
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  if (req.method !== "POST" || req.url !== "/chat/completions") {
    jsonResponse(res, 404, { error: "Not found" });
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 5_000_000) {
      res.writeHead(413);
      res.end();
      req.connection.destroy();
    }
  });
  req.on("end", () => {
    try {
      const payload = JSON.parse(body || "{}");
      const promptSummary = summarizePrompt(payload.messages || []);
      if (payload.stream) {
        streamChunks(res, promptSummary);
        return;
      }
      jsonResponse(res, 200, buildCompletionResponse(promptSummary));
    } catch (error) {
      jsonResponse(res, 400, { error: error?.message || "Invalid request" });
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[litellm-mock] listening on ${port}`);
});
