const express = require("express");
const request = require("supertest");

const mockSystemSettingsGet = jest.fn();
const mockSystemSettingsGetFeatureFlags = jest.fn();
const mockSystemSettingsGetValueOrFallback = jest.fn();
const mockAgentSqlConnections = jest.fn();
const mockImportedPlugins = jest.fn();
const mockEmbeddingSelection = jest.fn();
const mockPublicFields = [
  "footer_data",
  "support_email",
  "text_splitter_chunk_size",
  "max_embed_chunk_size",
];

jest.mock("../../models/apiKeys", () => ({
  ApiKey: { whereWithUser: jest.fn() },
}));

jest.mock("../../models/documents", () => ({
  Document: { delete: jest.fn() },
}));

jest.mock("../../models/eventLogs", () => ({
  EventLogs: { logEvent: jest.fn() },
}));

jest.mock("../../models/invite", () => ({
  Invite: {
    whereWithUsers: jest.fn(),
    create: jest.fn().mockResolvedValue({ invite: { code: "abc" }, error: null }),
  },
}));

jest.mock("../../models/systemSettings", () => ({
  SystemSettings: {
    publicFields: mockPublicFields,
    get: (...args) => mockSystemSettingsGet(...args),
    getFeatureFlags: (...args) => mockSystemSettingsGetFeatureFlags(...args),
    getValueOrFallback: (...args) =>
      mockSystemSettingsGetValueOrFallback(...args),
    brief: {
      agent_sql_connections: (...args) =>
        mockAgentSqlConnections(...args),
    },
  },
}));

jest.mock("../../models/telemetry", () => ({
  Telemetry: { sendTelemetry: jest.fn() },
}));

jest.mock("../../models/user", () => ({
  User: {
    where: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../../models/vectors", () => ({
  DocumentVectors: { deleteForWorkspace: jest.fn() },
}));

jest.mock("../../models/workspace", () => ({
  Workspace: { whereWithUsers: jest.fn(), get: jest.fn(), delete: jest.fn() },
}));

jest.mock("../../models/workspaceChats", () => ({
  WorkspaceChats: { delete: jest.fn() },
}));

jest.mock("../../utils/helpers", () => ({
  getVectorDbClass: jest.fn().mockReturnValue({
    "delete-namespace": jest.fn().mockResolvedValue(),
  }),
  getEmbeddingEngineSelection: () => mockEmbeddingSelection(),
}));

jest.mock("../../utils/helpers/admin", () => ({
  validRoleSelection: jest.fn().mockReturnValue({ valid: true }),
  canModifyAdmin: jest.fn().mockResolvedValue({ valid: true }),
  validCanModify: jest.fn().mockReturnValue({ valid: true }),
}));

jest.mock("../../utils/http", () => ({
  reqBody: (req) => req.body || {},
  userFromSession: jest
    .fn()
    .mockImplementation(async (_req, res) => res.locals.user),
  safeJsonParse: (value, fallback) => {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  },
}));

jest.mock("../../utils/middleware/multiUserProtected", () => {
  const flex = (roles) => (req, res, next) => {
    if (!roles.includes(res.locals.user.role)) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }
    next();
  };

  return {
    ROLES: { admin: "admin", manager: "manager", all: "all" },
    flexUserRoleValid: flex,
    strictMultiUserRoleValid: flex,
  };
});

jest.mock("../../utils/middleware/validatedRequest", () => ({
  validatedRequest: (req, res, next) => {
    res.locals.user = {
      id: 1,
      username: "tester",
      role: req.headers["x-role"] || "admin",
    };
    next();
  },
}));

jest.mock("../../utils/agents/imported", () => ({
  listImportedPlugins: (...args) => mockImportedPlugins(...args),
}));

jest.mock("../../utils/middleware/simpleSSOEnabled", () => ({
  simpleSSOLoginDisabledMiddleware: (_req, _res, next) => next(),
}));

describe("/admin/system-preferences-for", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPublicFields.splice(0, mockPublicFields.length, ...[
      "footer_data",
      "support_email",
      "text_splitter_chunk_size",
      "max_embed_chunk_size",
    ]);

    mockSystemSettingsGet.mockReset();
    mockSystemSettingsGetFeatureFlags.mockReset();
    mockSystemSettingsGetValueOrFallback.mockReset();
    mockAgentSqlConnections.mockReset();
    mockImportedPlugins.mockReset();
    mockEmbeddingSelection.mockReset();
    mockEmbeddingSelection.mockReturnValue({ embeddingMaxChunkLength: 2048 });

    mockAgentSqlConnections.mockResolvedValue([]);
    mockImportedPlugins.mockReturnValue([]);

    app = express();
    app.use(express.json());
    const router = express.Router();
    const { adminEndpoints } = require("../../endpoints/admin");
    adminEndpoints(router);
    app.use(router);
  });

  test("registers GET /admin/system-preferences-for", () => {
    const router = express.Router();
    const { adminEndpoints } = require("../../endpoints/admin");
    adminEndpoints(router);

    const layer = router.stack.find(
      (item) => item.route && item.route.path === "/admin/system-preferences-for"
    );

    expect(layer).toBeDefined();
    expect(layer.route.methods.get).toBe(true);
  });

  test("returns only requested public settings", async () => {
    mockSystemSettingsGet.mockImplementation(async ({ label }) => {
      if (label === "footer_data") return { value: "[\"db\"]" };
      if (label === "support_email") return { value: "support@example.com" };
      throw new Error(`unexpected label ${label}`);
    });

    const response = await request(app)
      .get("/admin/system-preferences-for")
      .query({ labels: "footer_data,unknown,support_email" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      settings: {
        footer_data: "[\"db\"]",
        support_email: "support@example.com",
      },
    });

    const calledLabels = mockSystemSettingsGet.mock.calls.map((call) => call[0].label);
    expect(calledLabels).toEqual(["footer_data", "support_email"]);
  });

  test("enforces role validation", async () => {
    const response = await request(app)
      .get("/admin/system-preferences-for")
      .set("x-role", "viewer")
      .query({ labels: "footer_data" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ success: false, error: "Forbidden" });
  });

  test("uses embedder defaults for chunk size labels", async () => {
    mockSystemSettingsGet.mockImplementation(async ({ label }) => {
      if (label === "text_splitter_chunk_size") return { value: null };
      throw new Error(`unexpected label ${label}`);
    });

    const response = await request(app)
      .get("/admin/system-preferences-for")
      .query({ labels: "text_splitter_chunk_size,max_embed_chunk_size" });

    expect(response.status).toBe(200);
    expect(response.body.settings.text_splitter_chunk_size).toBe(2048);
    expect(response.body.settings.max_embed_chunk_size).toBe(2048);
    expect(mockEmbeddingSelection).toHaveBeenCalledTimes(1);
  });
});
