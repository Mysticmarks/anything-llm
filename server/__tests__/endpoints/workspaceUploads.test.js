const express = require("express");
jest.mock("supertest");
const request = require("supertest");
const path = require("path");

process.env.STORAGE_DIR =
  process.env.STORAGE_DIR || path.resolve(__dirname, "../../storage");

const mockReqBody = jest.fn((req) =>
  typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}
);
const mockMultiUserMode = jest.fn(() => false);
const mockUserFromSession = jest
  .fn()
  .mockResolvedValue({ id: 12, role: "admin" });

jest.mock("../../utils/files", () => ({
  normalizePath: (value) => value,
  isWithin: () => true,
}));

jest.mock("../../utils/http", () => ({
  reqBody: (...args) => mockReqBody(...args),
  multiUserMode: (...args) => mockMultiUserMode(...args),
  userFromSession: (...args) => mockUserFromSession(...args),
  safeJsonParse: jest.fn((value, fallback = null) => {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (error) {
        return fallback;
      }
    }
    return value ?? fallback;
  }),
}));

const mockWorkspaceNew = jest.fn();
const mockWorkspaceUpdate = jest.fn();
const mockWorkspaceTrackChange = jest.fn();
const mockWorkspaceGetWithUser = jest.fn();
const mockWorkspaceGet = jest.fn();

jest.mock("../../models/workspace", () => ({
  Workspace: {
    new: (...args) => mockWorkspaceNew(...args),
    update: (...args) => mockWorkspaceUpdate(...args),
    trackChange: (...args) => mockWorkspaceTrackChange(...args),
    getWithUser: (...args) => mockWorkspaceGetWithUser(...args),
    get: (...args) => mockWorkspaceGet(...args),
  },
}));

const mockTelemetrySend = jest.fn().mockResolvedValue();
jest.mock("../../models/telemetry", () => ({
  Telemetry: { sendTelemetry: (...args) => mockTelemetrySend(...args) },
}));

const mockEventLog = jest.fn().mockResolvedValue();
jest.mock("../../models/eventLogs", () => ({
  EventLogs: { logEvent: (...args) => mockEventLog(...args) },
}));

const mockFlexRoleInvocation = jest.fn();
jest.mock("../../utils/middleware/multiUserProtected", () => ({
  flexUserRoleValid: (roles) => {
    mockFlexRoleInvocation(roles);
    return (_req, _res, next) => next();
  },
  ROLES: { admin: "admin", manager: "manager" },
}));

jest.mock("../../utils/middleware/validatedRequest", () => ({
  validatedRequest: (_req, _res, next) => next(),
}));

let uploadedFile = null;
const mockHandleFileUpload = jest.fn((req, _res, next) => {
  req.file = uploadedFile || { originalname: "placeholder.txt" };
  next();
});

jest.mock("../../utils/files/multer", () => ({
  handleFileUpload: (...args) => mockHandleFileUpload(...args),
  handlePfpUpload: (_req, _res, next) => next(),
}));

jest.mock("../../utils/helpers", () => ({
  getVectorDbClass: () => ({ "delete-namespace": jest.fn() }),
}));

jest.mock("../../endpoints/utils", () => ({
  getModelTag: () => "mock-model",
}));

jest.mock("../../utils/helpers/chat/responses", () => ({
  convertToChatHistory: jest.fn(() => []),
}));

const mockCollectorOnline = jest.fn();
const mockCollectorProcessDocument = jest.fn();
const mockCollectorProcessLink = jest.fn();
const mockCollectorLog = jest.fn();

jest.mock("../../utils/collectorApi", () => ({
  CollectorApi: jest.fn(() => ({
    online: (...args) => mockCollectorOnline(...args),
    processDocument: (...args) => mockCollectorProcessDocument(...args),
    processLink: (...args) => mockCollectorProcessLink(...args),
    log: (...args) => mockCollectorLog(...args),
  })),
}));

jest.mock("../../endpoints/workspacesParsedFiles", () => ({
  workspaceParsedFilesEndpoints: jest.fn(),
}));

const { workspaceEndpoints } = require("../../endpoints/workspaces");

describe("workspaceEndpoints critical flows", () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "secret";
    process.env.JWT_EXPIRY = "1h";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    uploadedFile = null;
    mockMultiUserMode.mockReturnValue(false);
    mockUserFromSession.mockResolvedValue({ id: 12, role: "admin" });

    app = express();
    app.use(express.json());
    workspaceEndpoints(app);
  });

  describe("/workspace/new", () => {
    test("creates workspace and emits telemetry", async () => {
      mockWorkspaceNew.mockResolvedValue({
        workspace: { id: 7, slug: "demo", name: "Demo" },
        message: "created",
      });

      const response = await request(app)
        .post("/workspace/new")
        .send({ name: "Demo", onboardingComplete: true });

      expect(response.status).toBe(200);
      expect(response.body.workspace).toEqual(
        expect.objectContaining({ id: 7, slug: "demo" })
      );
      expect(mockWorkspaceNew).toHaveBeenCalledWith("Demo", 12);
      expect(mockTelemetrySend).toHaveBeenCalledWith(
        "workspace_created",
        expect.objectContaining({
          LLMSelection: expect.any(String),
          Embedder: expect.any(String),
          VectorDbSelection: expect.any(String),
          LLMModel: "mock-model",
        }),
        12
      );
      expect(mockEventLog).toHaveBeenCalledWith(
        "workspace_created",
        expect.objectContaining({ workspaceName: "Demo" }),
        12
      );
    });

    test("returns 500 when workspace creation fails", async () => {
      mockWorkspaceNew.mockRejectedValue(new Error("boom"));

      const response = await request(app)
        .post("/workspace/new")
        .send({ name: "Broken" });

      expect(response.status).toBe(500);
      expect(mockWorkspaceNew).toHaveBeenCalled();
      expect(mockTelemetrySend).not.toHaveBeenCalledWith(
        "workspace_created",
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("/workspace/:slug/upload", () => {
    test("processes uploaded document when collector is online", async () => {
      uploadedFile = { originalname: "guide.pdf" };
      mockCollectorOnline.mockResolvedValue(true);
      mockCollectorProcessDocument.mockResolvedValue({
        success: true,
        reason: null,
      });

      const response = await request(app)
        .post("/workspace/demo/upload")
        .send("{}");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, error: null });
      expect(mockCollectorProcessDocument).toHaveBeenCalledWith("guide.pdf");
      expect(mockTelemetrySend).toHaveBeenCalledWith("document_uploaded");
      expect(mockEventLog).toHaveBeenCalledWith(
        "document_uploaded",
        expect.objectContaining({ documentName: "guide.pdf" }),
        undefined
      );
    });

    test("returns 500 when collector is offline", async () => {
      uploadedFile = { originalname: "guide.pdf" };
      mockCollectorOnline.mockResolvedValue(false);

      const response = await request(app)
        .post("/workspace/demo/upload")
        .send("{}");

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain(
        "Document processing API is not online"
      );
      expect(mockCollectorProcessDocument).not.toHaveBeenCalled();
    });

    test("returns 500 when collector cannot process document", async () => {
      uploadedFile = { originalname: "guide.pdf" };
      mockCollectorOnline.mockResolvedValue(true);
      mockCollectorProcessDocument.mockResolvedValue({
        success: false,
        reason: "ingestion failed",
      });

      const response = await request(app)
        .post("/workspace/demo/upload")
        .send("{}");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: "ingestion failed" });
      expect(mockCollectorLog).not.toHaveBeenCalled();
    });
  });

  describe("/workspace/:slug/upload-link", () => {
    test("processes remote link when collector is online", async () => {
      mockCollectorOnline.mockResolvedValue(true);
      mockCollectorProcessLink.mockResolvedValue({ success: true, reason: null });

      const response = await request(app)
        .post("/workspace/demo/upload-link")
        .send({ link: "https://example.com/doc" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, error: null });
      expect(mockCollectorProcessLink).toHaveBeenCalledWith(
        "https://example.com/doc"
      );
      expect(mockTelemetrySend).toHaveBeenCalledWith("link_uploaded");
      expect(mockEventLog).toHaveBeenCalledWith(
        "link_uploaded",
        { link: "https://example.com/doc" },
        undefined
      );
    });

    test("returns 500 when collector is offline for links", async () => {
      mockCollectorOnline.mockResolvedValue(false);

      const response = await request(app)
        .post("/workspace/demo/upload-link")
        .send({ link: "https://example.com/doc" });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain(
        "Document processing API is not online"
      );
      expect(mockCollectorProcessLink).not.toHaveBeenCalled();
    });

    test("returns 500 when collector fails to process link", async () => {
      mockCollectorOnline.mockResolvedValue(true);
      mockCollectorProcessLink.mockResolvedValue({
        success: false,
        reason: "unsupported",
      });

      const response = await request(app)
        .post("/workspace/demo/upload-link")
        .send({ link: "https://example.com/doc" });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: "unsupported" });
      expect(mockCollectorLog).not.toHaveBeenCalled();
    });
  });
});
