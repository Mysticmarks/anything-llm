const express = require("express");

jest.mock("supertest");
const request = require("supertest");

const mockChatQueueRun = jest.fn((task) => task());
const mockChatCircuitExec = jest.fn((task) => task());

jest.mock("../../utils/concurrency", () => ({
  chatQueue: { run: (...args) => mockChatQueueRun(...args) },
  chatCircuitBreaker: { exec: (...args) => mockChatCircuitExec(...args) },
}));

const mockUser = { id: 7, role: "admin", dailyMessageLimit: 10 };
const mockWorkspace = { id: 3, slug: "demo", name: "Demo" };

jest.mock("../../utils/http", () => ({
  reqBody: jest.fn((req) =>
    typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}
  ),
  userFromSession: jest.fn(async () => mockUser),
  multiUserMode: jest.fn(() => false),
}));

jest.mock("../../utils/middleware/validatedRequest", () => ({
  validatedRequest: (req, res, next) => {
    res.locals.multiUserMode = false;
    res.locals.user = mockUser;
    next();
  },
}));

jest.mock("../../utils/middleware/multiUserProtected", () => ({
  ROLES: { all: "<all>", admin: "admin" },
  flexUserRoleValid: () => (req, res, next) => {
    res.locals.multiUserMode = false;
    res.locals.user = mockUser;
    next();
  },
}));

jest.mock("../../utils/middleware/validWorkspace", () => ({
  validWorkspaceSlug: (req, res, next) => {
    res.locals.workspace = mockWorkspace;
    next();
  },
  validWorkspaceAndThreadSlug: (req, res, next) => {
    res.locals.workspace = mockWorkspace;
    res.locals.thread = { slug: req.params.threadSlug, name: "Thread" };
    next();
  },
}));

jest.mock("../../models/user", () => ({
  User: { canSendChat: jest.fn().mockResolvedValue(true) },
}));

const mockStreamChat = jest.fn(async (response) => {
  response.write(
    `data: ${JSON.stringify({
      uuid: "stream-1",
      type: "textResponseChunk",
      textResponse: "Hello from stream",
      close: false,
      sources: [],
    })}\n\n`
  );
  response.write(
    `data: ${JSON.stringify({
      uuid: "stream-1",
      type: "textResponseChunk",
      textResponse: "!",
      close: true,
      sources: [],
    })}\n\n`
  );
});

jest.mock("../../utils/chats/stream", () => ({
  streamChatWithWorkspace: (...args) => mockStreamChat(...args),
}));

const mockTelemetry = { sendTelemetry: jest.fn().mockResolvedValue() };
jest.mock("../../models/telemetry", () => ({ Telemetry: mockTelemetry }));

const mockEventLogs = { logEvent: jest.fn().mockResolvedValue() };
jest.mock("../../models/eventLogs", () => ({ EventLogs: mockEventLogs }));

jest.mock("../../utils/helpers/chat/responses", () => ({
  writeResponseChunk: (response, data) => {
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  },
}));

describe("chat streaming endpoint", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChatQueueRun.mockImplementation((task) => task());
    mockChatCircuitExec.mockImplementation((task) => task());
    app = express();
    app.use(express.json());
    const router = express.Router();
    const { chatEndpoints } = require("../../endpoints/chat");
    chatEndpoints(router);
    app.use(router);
  });

  test("streams chat responses with SSE payload", async () => {
    const response = await request(app)
      .post("/workspace/demo/stream-chat")
      .send({ message: "Hello" });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Hello from stream");
    expect(mockStreamChat).toHaveBeenCalled();
    expect(mockTelemetry.sendTelemetry).toHaveBeenCalledWith(
      "sent_chat",
      expect.objectContaining({ VectorDbSelection: expect.any(String) })
    );
    expect(mockEventLogs.logEvent).toHaveBeenCalledWith(
      "sent_chat",
      expect.objectContaining({ workspaceName: "Demo" }),
      mockUser.id
    );
  });

  test("rejects empty messages", async () => {
    const response = await request(app)
      .post("/workspace/demo/stream-chat")
      .send({ message: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Message is empty.");
    expect(mockStreamChat).not.toHaveBeenCalled();
  });

  test("emits abort chunk when stream handler throws", async () => {
    mockStreamChat.mockImplementationOnce(() => {
      throw new Error("stream failure");
    });

    const response = await request(app)
      .post("/workspace/demo/stream-chat")
      .send({ message: "Hello" });

    expect(response.status).toBe(200);
    expect(response.text).toContain("stream failure");
  });

  test("indicates circuit breaker errors to clients", async () => {
    mockChatCircuitExec.mockImplementationOnce(() => {
      const error = new Error("open");
      error.code = "CIRCUIT_OPEN";
      throw error;
    });

    const response = await request(app)
      .post("/workspace/demo/stream-chat")
      .send({ message: "Hello" });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Chat circuit breaker is open");
  });
});
