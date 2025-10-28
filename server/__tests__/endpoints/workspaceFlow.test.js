const express = require("express");

jest.mock("supertest");
const request = require("supertest");

const mockVectorDelete = jest.fn();

process.env.NODE_ENV = "development";

const mockUser = { id: 1, role: "admin" };
const mockWorkspaceNew = jest.fn().mockResolvedValue({
  workspace: { id: 1, slug: "test-workspace", name: "Test Workspace" },
  message: "created",
});
const mockWorkspaceGet = jest
  .fn()
  .mockResolvedValue({ id: 1, slug: "test-workspace", name: "Test Workspace" });
const mockWorkspaceUpdate = jest.fn().mockResolvedValue({
  workspace: { id: 1, slug: "test-workspace", name: "Updated" },
  message: "updated",
});
const mockWorkspaceDelete = jest.fn().mockResolvedValue();
const mockWorkspaceTrackChange = jest.fn().mockResolvedValue();

jest.mock("../../utils/http", () => ({
  reqBody: jest.fn((req) =>
    typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}
  ),
  multiUserMode: jest.fn(() => false),
  userFromSession: jest.fn(async () => mockUser),
  safeJsonParse: jest.fn((value) => value),
}));

jest.mock("../../utils/middleware/validatedRequest", () => ({
  validatedRequest: (req, res, next) => {
    res.locals.multiUserMode = false;
    res.locals.user = mockUser;
    next();
  },
}));

jest.mock("../../utils/middleware/multiUserProtected", () => ({
  ROLES: { admin: "admin", manager: "manager", all: "<all>" },
  flexUserRoleValid: () => (req, res, next) => {
    res.locals.multiUserMode = false;
    res.locals.user = mockUser;
    next();
  },
}));

jest.mock("../../models/workspace", () => ({
  Workspace: {
    new: (...args) => mockWorkspaceNew(...args),
    get: (...args) => mockWorkspaceGet(...args),
    getWithUser: jest.fn(),
    update: (...args) => mockWorkspaceUpdate(...args),
    delete: (...args) => mockWorkspaceDelete(...args),
    trackChange: (...args) => mockWorkspaceTrackChange(...args),
  },
}));

const mockDocumentDelete = jest.fn().mockResolvedValue();
jest.mock("../../models/documents", () => ({ Document: { delete: (...args) => mockDocumentDelete(...args) } }));
const mockDocumentVectorsDelete = jest.fn().mockResolvedValue();
jest.mock("../../models/vectors", () => ({ DocumentVectors: { deleteForWorkspace: (...args) => mockDocumentVectorsDelete(...args) } }));
const mockWorkspaceChatsDelete = jest.fn().mockResolvedValue();
jest.mock("../../models/workspaceChats", () => ({ WorkspaceChats: { delete: (...args) => mockWorkspaceChatsDelete(...args) } }));
jest.mock("../../models/workspacesSuggestedMessages", () => ({
  WorkspaceSuggestedMessages: {},
}));
jest.mock("../../models/workspaceThread", () => ({ WorkspaceThread: {} }));

const mockTelemetry = { sendTelemetry: jest.fn().mockResolvedValue() };
jest.mock("../../models/telemetry", () => ({ Telemetry: mockTelemetry }));

const mockEventLogs = { logEvent: jest.fn().mockResolvedValue() };
jest.mock("../../models/eventLogs", () => ({ EventLogs: mockEventLogs }));

const mockCollectorInstance = {
  online: jest.fn().mockResolvedValue(true),
  processDocument: jest.fn().mockResolvedValue({ success: true }),
  processLink: jest.fn().mockResolvedValue({ success: true }),
  log: jest.fn(),
};
const MockCollectorApi = jest.fn(() => mockCollectorInstance);
jest.mock("../../utils/collectorApi", () => ({
  CollectorApi: MockCollectorApi,
}));

jest.mock("../../utils/files/multer", () => ({
  handleFileUpload: (req, _res, next) => {
    req.file = { originalname: "demo.txt" };
    next();
  },
  handlePfpUpload: jest.fn(),
}));

jest.mock("../../utils/helpers", () => ({
  getVectorDbClass: () => ({ "delete-namespace": (...args) => mockVectorDelete(...args) }),
}));

jest.mock("../../endpoints/workspacesParsedFiles", () => ({
  workspaceParsedFilesEndpoints: jest.fn(),
}));

describe("workspace endpoints", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    const router = express.Router();
    const { workspaceEndpoints } = require("../../endpoints/workspaces");
    workspaceEndpoints(router);
    app.use(router);
  });

  test("POST /workspace/new creates a workspace", async () => {
    const response = await request(app)
      .post("/workspace/new")
      .send({ name: "Brand New", onboardingComplete: true });

    expect(response.status).toBe(200);
    expect(response.body.workspace).toMatchObject({ name: "Test Workspace" });
    expect(mockWorkspaceNew).toHaveBeenCalledWith("Brand New", mockUser.id);
    expect(mockTelemetry.sendTelemetry).toHaveBeenCalledWith(
      "workspace_created",
      expect.any(Object),
      mockUser.id
    );
    expect(mockEventLogs.logEvent).toHaveBeenCalledWith(
      "workspace_created",
      expect.any(Object),
      mockUser.id
    );
  });

  test("POST /workspace/:slug/update updates workspace state", async () => {
    const response = await request(app)
      .post("/workspace/test-workspace/update")
      .send({ name: "Updated" });

    expect(response.status).toBe(200);
    expect(response.body.workspace).toMatchObject({ name: "Updated" });
    expect(mockWorkspaceGet).toHaveBeenCalledWith({ slug: "test-workspace" });
    expect(mockWorkspaceTrackChange).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "test-workspace" }),
      { name: "Updated" },
      mockUser
    );
    expect(mockWorkspaceUpdate).toHaveBeenCalledWith(1, { name: "Updated" });
  });

  test("POST /workspace/:slug/upload triggers collector processing", async () => {
    const response = await request(app)
      .post("/workspace/test-workspace/upload")
      .send("{}");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, error: null });
    expect(MockCollectorApi).toHaveBeenCalledTimes(1);
    expect(mockCollectorInstance.online).toHaveBeenCalled();
    expect(mockCollectorInstance.processDocument).toHaveBeenCalledWith(
      "demo.txt"
    );
    expect(mockEventLogs.logEvent).toHaveBeenCalledWith(
      "document_uploaded",
      expect.any(Object),
      mockUser.id
    );
  });

  test("POST /workspace/:slug/upload returns error when collector offline", async () => {
    mockCollectorInstance.online.mockResolvedValueOnce(false);

    const response = await request(app)
      .post("/workspace/test-workspace/upload")
      .send("{}");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(mockCollectorInstance.processDocument).not.toHaveBeenCalled();
  });

  test("DELETE /workspace/:slug removes workspace assets", async () => {
    mockWorkspaceGet.mockResolvedValueOnce({
      id: 1,
      slug: "test-workspace",
      name: "Test Workspace",
    });

    const response = await request(app).delete("/workspace/test-workspace");

    expect(response.status).toBe(200);
    expect(mockWorkspaceChatsDelete).toHaveBeenCalledWith({ workspaceId: 1 });
    expect(mockDocumentVectorsDelete).toHaveBeenCalledWith(1);
    expect(mockDocumentDelete).toHaveBeenCalledWith({ workspaceId: 1 });
    expect(mockWorkspaceDelete).toHaveBeenCalledWith({ id: 1 });
    expect(mockEventLogs.logEvent).toHaveBeenCalledWith(
      "workspace_deleted",
      expect.objectContaining({ workspaceName: "Test Workspace" }),
      mockUser.id
    );
    expect(mockVectorDelete).toHaveBeenCalledWith({ namespace: "test-workspace" });
  });
});
