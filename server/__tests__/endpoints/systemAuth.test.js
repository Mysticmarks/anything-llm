const express = require("express");
const request = require("supertest");

const mockBcryptCompare = jest.fn();
jest.mock("bcrypt", () => ({
  compareSync: (...args) => mockBcryptCompare(...args),
  hashSync: jest.fn((value) => `hashed:${value}`),
}));

const mockReqBody = jest.fn((req) =>
  typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}
);
const mockMakeJWT = jest.fn(() => "mock-session-token");
const mockUserFromSession = jest
  .fn()
  .mockResolvedValue({ id: 99, username: "admin" });

jest.mock("../../utils/http", () => ({
  reqBody: (...args) => mockReqBody(...args),
  makeJWT: (...args) => mockMakeJWT(...args),
  userFromSession: (...args) => mockUserFromSession(...args),
  multiUserMode: jest.fn(() => true),
  queryParams: jest.fn(() => ({})),
  parseAuthHeader: jest.fn(() => ({})),
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
  isValidUrl: jest.fn(() => true),
  toValidNumber: jest.fn((value, fallback = null) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }),
  decodeJWT: jest.fn(() => ({ id: 99 })),
}));

const mockSystemSettings = {
  currentSettings: jest.fn().mockResolvedValue({}),
  isMultiUserMode: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  publicFields: [],
  supportedFields: [],
  validations: {},
};
jest.mock("../../models/systemSettings", () => ({
  SystemSettings: mockSystemSettings,
}));

const mockUserGet = jest.fn();
const mockUserFilterFields = jest.fn((user) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  seen_recovery_codes: user.seen_recovery_codes,
}));
jest.mock("../../models/user", () => ({
  User: {
    _get: (...args) => mockUserGet(...args),
    filterFields: (...args) => mockUserFilterFields(...args),
    get: jest.fn(),
  },
}));

const mockTelemetrySend = jest.fn().mockResolvedValue();
jest.mock("../../models/telemetry", () => ({
  Telemetry: { sendTelemetry: (...args) => mockTelemetrySend(...args) },
}));

const mockLogEvent = jest.fn().mockResolvedValue();
jest.mock("../../models/eventLogs", () => ({
  EventLogs: { logEvent: (...args) => mockLogEvent(...args) },
}));

const mockGenerateRecoveryCodes = jest
  .fn()
  .mockResolvedValue(["code-1", "code-2"]);
const mockRecoverAccount = jest.fn();
const mockResetPassword = jest.fn();
jest.mock("../../utils/PasswordRecovery", () => ({
  recoverAccount: (...args) => mockRecoverAccount(...args),
  resetPassword: (...args) => mockResetPassword(...args),
  generateRecoveryCodes: (...args) => mockGenerateRecoveryCodes(...args),
}));

jest.mock("../../utils/files", () => ({
  viewLocalFiles: jest.fn().mockResolvedValue([]),
  normalizePath: jest.fn((value) => value),
  isWithin: jest.fn(() => true),
}));

jest.mock("../../utils/files/purgeDocument", () => ({
  purgeDocument: jest.fn(),
  purgeFolder: jest.fn(),
}));

const mockVectorDelete = jest.fn().mockResolvedValue();
jest.mock("../../utils/helpers", () => ({
  getVectorDbClass: () => ({ "delete-namespace": mockVectorDelete }),
}));

jest.mock("../../utils/files/multer", () => ({
  handleAssetUpload: jest.fn(),
  handlePfpUpload: jest.fn(),
}));

jest.mock("../../models/documents", () => ({
  Document: { delete: jest.fn() },
}));

jest.mock("../../models/vectors", () => ({
  DocumentVectors: { deleteForWorkspace: jest.fn() },
}));

jest.mock("../../models/workspaceChats", () => ({
  WorkspaceChats: { delete: jest.fn() },
}));

jest.mock("../../models/workspace", () => ({
  Workspace: {
    get: jest.fn(),
    getWithUser: jest.fn(),
    delete: jest.fn(),
    new: jest.fn(),
    update: jest.fn(),
    trackChange: jest.fn(),
  },
}));

jest.mock("../../utils/collectorApi", () => ({
  CollectorApi: jest.fn().mockImplementation(() => ({
    online: jest.fn().mockResolvedValue(true),
    processDocument: jest.fn().mockResolvedValue({ success: true }),
    processLink: jest.fn().mockResolvedValue({ success: true }),
    log: jest.fn(),
  })),
}));

jest.mock("../../models/welcomeMessages", () => ({
  WelcomeMessages: { fetch: jest.fn().mockResolvedValue([]) },
}));

jest.mock("../../models/apiKeys", () => ({
  ApiKey: { list: jest.fn().mockResolvedValue([]) },
}));

jest.mock("../../utils/helpers/customModels", () => ({
  getCustomModels: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../utils/files/pfp", () => ({
  fetchPfp: jest.fn().mockResolvedValue(null),
  determinePfpFilepath: jest.fn().mockReturnValue("pfp.png"),
}));

jest.mock("../../utils/helpers/chat/convertTo", () => ({
  exportChatsAsType: jest.fn().mockResolvedValue({ success: true, data: [] }),
}));

jest.mock("../../utils/TextToSpeech", () => ({
  getTTSProvider: jest.fn(() => ({
    reset: jest.fn(),
    configure: jest.fn(),
  })),
}));

jest.mock("../../models/slashCommandsPresets", () => ({
  SlashCommandPresets: { all: jest.fn().mockResolvedValue([]) },
}));

jest.mock("../../utils/EncryptionManager", () => ({
  EncryptionManager: class {
    encrypt(value) {
      return `enc:${value}`;
    }
  },
}));

jest.mock("../../models/browserExtensionApiKey", () => ({
  BrowserExtensionApiKey: { upsert: jest.fn() },
}));

jest.mock("../../utils/middleware/chatHistoryViewable", () => ({
  chatHistoryViewable: () => (_req, _res, next) => next(),
}));

const mockSimpleSSOLoginDisabled = jest.fn(() => false);
jest.mock("../../utils/middleware/simpleSSOEnabled", () => ({
  simpleSSOEnabled: () => (_req, _res, next) => next(),
  simpleSSOLoginDisabled: (...args) => mockSimpleSSOLoginDisabled(...args),
}));

jest.mock("../../models/temporaryAuthToken", () => ({
  TemporaryAuthToken: {
    validate: jest.fn().mockResolvedValue({
      sessionToken: "session-token",
      token: { user: { id: 1, username: "temp-user" } },
      error: null,
    }),
  },
}));

jest.mock("../../models/systemPromptVariables", () => ({
  SystemPromptVariables: { list: jest.fn().mockResolvedValue([]) },
}));

jest.mock("../../utils/chats", () => ({
  VALID_COMMANDS: [],
}));

jest.mock("../../utils/middleware/validatedRequest", () => ({
  validatedRequest: (_req, res, next) => {
    res.locals = res.locals || {};
    res.locals.user = { id: 99, role: "admin" };
    res.locals.multiUserMode = true;
    next();
  },
}));

jest.mock("../../utils/middleware/multiUserProtected", () => ({
  flexUserRoleValid: () => (_req, res, next) => {
    res.locals = res.locals || {};
    res.locals.user = { id: 99, role: "admin" };
    res.locals.multiUserMode = true;
    next();
  },
  ROLES: { admin: "admin", manager: "manager" },
  isMultiUserSetup: () => (_req, _res, next) => next(),
}));

jest.mock("../../utils/files/logo", () => ({
  getDefaultFilename: jest.fn(() => "default.png"),
  determineLogoFilepath: jest.fn(() => "logo.png"),
  fetchLogo: jest.fn().mockResolvedValue(null),
  validFilename: jest.fn(() => true),
  renameLogoFile: jest.fn(),
  removeCustomLogo: jest.fn(),
  LOGO_FILENAME: "logo.png",
  isDefaultFilename: jest.fn(() => true),
}));

jest.mock("../../utils/helpers/updateENV", () => ({
  updateENV: jest.fn(),
  dumpENV: jest.fn(),
}));

describe("/request-token authentication", () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.JWT_EXPIRY = "1h";
    process.env.AUTH_TOKEN = "single-user-secret";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSystemSettings.isMultiUserMode.mockResolvedValue(true);
    app = express();
    app.use(express.json());
    const { systemEndpoints } = require("../../endpoints/system");
    systemEndpoints(app);
  });

  test("rejects login when credentials are invalid", async () => {
    mockUserGet.mockResolvedValue(null);

    const response = await request(app)
      .post("/request-token")
      .send({ username: "missing", password: "whatever" });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
    expect(response.body.message).toBe("[001] Invalid login credentials.");
    expect(mockLogEvent).toHaveBeenCalledWith(
      "failed_login_invalid_username",
      expect.any(Object),
      undefined
    );
  });

  test("rejects login when password does not match", async () => {
    mockBcryptCompare.mockReturnValueOnce(false);
    mockUserGet.mockResolvedValue({
      id: 21,
      username: "release-admin",
      password: "hashed",
      role: "admin",
      suspended: false,
      seen_recovery_codes: true,
    });

    const response = await request(app)
      .post("/request-token")
      .send({ username: "release-admin", password: "bad" });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
    expect(response.body.message).toBe("[002] Invalid login credentials.");
    expect(mockLogEvent).toHaveBeenCalledWith(
      "failed_login_invalid_password",
      expect.any(Object),
      21
    );
  });

  test("issues shared-session token in single-user mode", async () => {
    mockSystemSettings.isMultiUserMode.mockResolvedValue(false);

    const response = await request(app)
      .post("/request-token")
      .send({ password: "single-user-secret" });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.token).toEqual(expect.any(String));
    expect(mockTelemetrySend).toHaveBeenCalledWith(
      "login_event",
      { multiUserMode: false },
      undefined
    );
  });

  test("rejects invalid shared password in single-user mode", async () => {
    mockSystemSettings.isMultiUserMode.mockResolvedValue(false);

    const response = await request(app)
      .post("/request-token")
      .send({ password: "bad-secret" });

    expect(response.status).toBe(401);
    expect(response.body.valid).toBe(false);
    expect(response.body.message).toBe("[003] Invalid password provided");
    expect(mockTelemetrySend).not.toHaveBeenCalledWith(
      "login_event",
      expect.any(Object),
      expect.anything()
    );
  });

  test("returns recovery codes for first-time login", async () => {
    mockBcryptCompare.mockReturnValue(true);
    mockUserGet.mockResolvedValue({
      id: 22,
      username: "release-admin",
      password: "hashed",
      role: "admin",
      suspended: false,
      seen_recovery_codes: false,
    });

    const response = await request(app)
      .post("/request-token")
      .send({ username: "release-admin", password: "correct" });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.recoveryCodes).toEqual(["code-1", "code-2"]);
    expect(mockGenerateRecoveryCodes).toHaveBeenCalledWith(22);
    expect(mockMakeJWT).toHaveBeenCalledWith(
      { id: 22, username: "release-admin" },
      process.env.JWT_EXPIRY
    );
  });

  test("blocks credential logins when SSO-only mode is enforced", async () => {
    mockSimpleSSOLoginDisabled.mockReturnValueOnce(true);

    const response = await request(app)
      .post("/request-token")
      .send({ username: "any", password: "any" });

    expect(response.status).toBe(403);
    expect(response.body.valid).toBe(false);
    expect(response.body.message).toContain(
      "[005] Login via credentials has been disabled"
    );
  });

  test("denies access to suspended accounts", async () => {
    mockBcryptCompare.mockReturnValue(true);
    mockUserGet.mockResolvedValue({
      id: 98,
      username: "suspended",
      password: "hashed",
      role: "admin",
      suspended: true,
      seen_recovery_codes: true,
    });

    const response = await request(app)
      .post("/request-token")
      .send({ username: "suspended", password: "correct" });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
    expect(response.body.message).toBe("[004] Account suspended by admin.");
    expect(mockTelemetrySend).not.toHaveBeenCalledWith(
      "login_event",
      expect.any(Object),
      98
    );
  });
});
