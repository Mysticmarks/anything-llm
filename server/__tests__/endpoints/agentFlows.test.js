const express = require("express");
const request = require("supertest");

const mockFlow = {
  name: "Example Flow",
  config: { steps: [{ type: "start", config: {} }] },
};

const mockAgentFlows = {
  saveFlow: jest.fn(),
  listFlows: jest.fn(),
  loadFlow: jest.fn(),
  deleteFlow: jest.fn(),
  executeFlow: jest.fn(),
};

jest.mock("../../utils/agentFlows", () => ({
  AgentFlows: mockAgentFlows,
}));

const mockTelemetry = { sendTelemetry: jest.fn().mockResolvedValue() };
jest.mock("../../models/telemetry", () => ({ Telemetry: mockTelemetry }));

const mockWorkspaceGet = jest.fn();
jest.mock("../../models/workspace", () => ({
  Workspace: { get: (...args) => mockWorkspaceGet(...args) },
}));

jest.mock("../../utils/middleware/validatedRequest", () => ({
  validatedRequest: (_req, res, next) => {
    res.locals.user = { id: 1, role: "admin" };
    next();
  },
}));

jest.mock("../../utils/middleware/multiUserProtected", () => ({
  ROLES: { admin: "admin" },
  flexUserRoleValid: () => (_req, _res, next) => next(),
}));

const mockListeners = [];
const mockAibitat = {
  handlerProps: { log: jest.fn() },
  terminate: jest.fn(),
};

const mockQueueRun = jest.fn((task) => task());
const mockCircuitExec = jest.fn((task) => task());

jest.mock("../../utils/concurrency", () => ({
  agentFlowQueue: { run: (...args) => mockQueueRun(...args) },
  agentCircuitBreaker: { exec: (...args) => mockCircuitExec(...args) },
}));

const handlerInit = jest.fn().mockResolvedValue();
const handlerCreateAIbitat = jest
  .fn()
  .mockImplementation(async ({ handler }) => {
    handler.send(
      JSON.stringify({ type: "statusResponse", content: "boot sequence" })
    );
  });

const mockHandlerFactory = jest.fn().mockImplementation(() => ({
  aibitat: mockAibitat,
  init: handlerInit,
  createAIbitat: handlerCreateAIbitat,
}));

const mockListenerFactory = jest.fn().mockImplementation(() => {
  const instance = {
    messages: [],
    send: jest.fn(function (payload) {
      this.messages.push(JSON.parse(payload));
    }),
    close: jest.fn(),
    packMessages: jest.fn(function () {
      const thoughts = this.messages
        .filter((message) => message.type === "statusResponse")
        .map((message) => message.content);
      return { thoughts, textResponse: null };
    }),
  };
  mockListeners.push(instance);
  return instance;
});

jest.mock("../../utils/agents/ephemeral", () => ({
  EphemeralAgentHandler: mockHandlerFactory,
  EphemeralEventListener: mockListenerFactory,
}));

describe("agent flow run endpoint", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.length = 0;
    mockAgentFlows.loadFlow.mockReturnValue(mockFlow);
    mockAgentFlows.executeFlow.mockResolvedValue({
      success: true,
      results: [],
      variables: {},
    });
    mockQueueRun.mockImplementation((task) => task());
    mockCircuitExec.mockImplementation((task) => task());

    app = express();
    app.use(express.json());
    const router = express.Router();
    const { agentFlowEndpoints } = require("../../endpoints/agentFlows");
    agentFlowEndpoints(router);
    app.use(router);
  });

  test("registers POST /agent-flows/:uuid/run", () => {
    const router = express.Router();
    const { agentFlowEndpoints } = require("../../endpoints/agentFlows");
    agentFlowEndpoints(router);

    const layer = router.stack.find(
      (item) => item.route && item.route.path === "/agent-flows/:uuid/run"
    );

    expect(layer).toBeDefined();
    expect(layer.route.methods.post).toBe(true);
  });

  test("returns 404 when flow cannot be found", async () => {
    mockAgentFlows.loadFlow.mockReturnValueOnce(null);

    const response = await request(app)
      .post("/agent-flows/demo/run")
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("Flow not found");
  });

  test("executes flow without workspace context", async () => {
    const response = await request(app)
      .post("/agent-flows/demo/run")
      .send({ variables: { foo: "bar" } });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockAgentFlows.executeFlow).toHaveBeenCalledWith(
      "demo",
      { foo: "bar" },
      null
    );
    expect(response.body).not.toHaveProperty("telemetry");
    expect(mockTelemetry.sendTelemetry).toHaveBeenCalledWith(
      "agent_flow_executed",
      expect.objectContaining({ flow: "demo", success: true })
    );
  });

  test("returns 400 when agent context is required but missing", async () => {
    mockAgentFlows.loadFlow.mockReturnValueOnce({
      name: "LLM Flow",
      config: { steps: [{ type: "llmInstruction", config: {} }] },
    });

    const response = await request(app)
      .post("/agent-flows/demo/run")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("workspace context");
    expect(mockAgentFlows.executeFlow).not.toHaveBeenCalled();
  });

  test("executes flow with workspace context and returns telemetry", async () => {
    mockWorkspaceGet.mockResolvedValueOnce({
      id: 1,
      slug: "demo-workspace",
      name: "Demo Workspace",
    });

    mockAgentFlows.executeFlow.mockImplementationOnce(async (_uuid, _vars, aibitat) => {
      aibitat.handlerProps.log("step complete", { status: "ok" });
      return {
        success: true,
        results: [{ success: true, result: "done" }],
        variables: { foo: "bar" },
      };
    });

    const response = await request(app)
      .post("/agent-flows/demo/run")
      .send({ workspaceId: 1, variables: {} });

    expect(response.status).toBe(200);
    expect(mockHandlerFactory).toHaveBeenCalledTimes(1);
    expect(mockListenerFactory).toHaveBeenCalledTimes(1);
    expect(response.body.workspace).toMatchObject({ slug: "demo-workspace" });
    expect(response.body.telemetry.thoughts).toContain("boot sequence");
    expect(response.body.telemetry.logs[0]).toContain("step complete");
    expect(mockTelemetry.sendTelemetry).toHaveBeenCalledWith(
      "agent_flow_executed",
      expect.objectContaining({ flow: "demo", success: true })
    );
  });
  test("omits telemetry payload when includeTelemetry is false", async () => {
    mockWorkspaceGet.mockResolvedValueOnce({
      id: 1,
      slug: "demo",
      name: "Demo Workspace",
    });

    const response = await request(app)
      .post("/agent-flows/demo/run")
      .send({ workspaceId: 1, includeTelemetry: false });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("telemetry");
  });

  test("gracefully reports execution failures", async () => {
    mockWorkspaceGet.mockResolvedValueOnce({
      id: 1,
      slug: "demo",
      name: "Demo Workspace",
    });
    mockAgentFlows.executeFlow.mockRejectedValueOnce(new Error("boom"));

    const response = await request(app)
      .post("/agent-flows/demo/run")
      .send({ workspaceId: 1, variables: {} });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe("boom");
    expect(mockTelemetry.sendTelemetry).toHaveBeenCalledWith(
      "agent_flow_execution_failed",
      expect.objectContaining({ flow: "demo", error: "boom" })
    );
    expect(mockAibitat.terminate).toHaveBeenCalled();
  });

  test("returns 503 when circuit breaker is open", async () => {
    mockCircuitExec.mockImplementationOnce(() => {
      const error = new Error("open");
      error.code = "CIRCUIT_OPEN";
      throw error;
    });

    const response = await request(app)
      .post("/agent-flows/demo/run")
      .send({ variables: {} });

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("circuit breaker");
  });

});
