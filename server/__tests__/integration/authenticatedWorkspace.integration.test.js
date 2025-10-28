const path = require("path");
const fs = require("fs");
const http = require("http");
const { execSync } = require("child_process");
const bcrypt = require("bcrypt");
const express = require("express");

jest.mock("bullmq", () => ({
  Queue: class {
    add() {
      return Promise.resolve();
    }
  },
  QueueEvents: class {
    async waitUntilReady() {}
    async close() {}
    on() {}
  },
  Worker: class {},
}));

const repoRoot = path.resolve(__dirname, "../../..");
const serverDir = path.join(repoRoot, "server");
const storageDir = path.join(serverDir, "storage");
const collectorHotDir = path.join(repoRoot, "collector", "hotdir");
const testDbPath = path.join(storageDir, "integration-anythingllm.db");
const lanceStorage = path.join(storageDir, "lancedb");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-secret-key";
process.env.SIG_KEY = "integration-signature-key-32-chars-min";
process.env.SIG_SALT = "integration-signature-salt-32-chars";
process.env.AUTH_TOKEN = "integration-secret";
process.env.DISABLE_TELEMETRY = "true";
process.env.COLLECTOR_PORT = "18888";
process.env.VECTOR_DB = "lancedb";
process.env.STORAGE_DIR = storageDir;
process.env.DATABASE_URL = `file:${testDbPath}`;

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
const { systemEndpoints } = require("../../endpoints/system");
const { workspaceEndpoints } = require("../../endpoints/workspaces");
const { DocumentVectors } = require("../../models/vectors");
const { LanceDb } = require("../../utils/vectorDbProviders/lance");

function prepareFileSystem() {
  fs.mkdirSync(storageDir, { recursive: true });
  fs.mkdirSync(collectorHotDir, { recursive: true });
  if (fs.existsSync(testDbPath)) fs.rmSync(testDbPath);
  if (fs.existsSync(lanceStorage)) {
    fs.rmSync(lanceStorage, { recursive: true, force: true });
  }
}

async function seedDatabase() {
  await prisma.system_settings.createMany({
    data: [
      { label: "multi_user_mode", value: "true" },
      { label: "telemetry_id", value: "test-system-id" },
      { label: "text_splitter_chunk_size", value: "1000" },
      { label: "text_splitter_chunk_overlap", value: "20" },
    ],
    skipDuplicates: true,
  });

  await prisma.users.create({
    data: {
      username: "integration-admin",
      password: bcrypt.hashSync("Password123!", 10),
      role: "admin",
      seen_recovery_codes: true,
    },
  });
}

function bootstrapCollectorMock() {
  const requests = [];
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && req.url === "/process") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        requests.push({ endpoint: "process", payload: JSON.parse(body) });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ success: true, documents: [{ docId: "doc-mock" }] })
        );
      });
      return;
    }

    if (req.method === "POST" && req.url === "/process-link") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        requests.push({ endpoint: "process-link", payload: JSON.parse(body) });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, documents: [] }));
      });
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });

  return {
    requests,
    listen: () =>
      new Promise((resolve) =>
        server.listen(Number(process.env.COLLECTOR_PORT), "127.0.0.1", resolve)
      ),
    close: () =>
      new Promise((resolve) =>
        server.close(() => resolve())
      ),
  };
}

describe("Authenticated workspace integration", () => {
  jest.setTimeout(60000);

  let app;
  let server;
  let baseUrl;
  let authToken;
  let workspaceRecord;
  let collector;

  beforeAll(async () => {
    prepareFileSystem();

    execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
      cwd: serverDir,
      stdio: "inherit",
      env: { ...process.env },
    });

    await seedDatabase();

    collector = bootstrapCollectorMock();
    await collector.listen();

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    systemEndpoints(app);
    workspaceEndpoints(app);
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (collector) await collector.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    if (fs.existsSync(testDbPath)) fs.rmSync(testDbPath);
    if (fs.existsSync(lanceStorage)) {
      fs.rmSync(lanceStorage, { recursive: true, force: true });
    }
    const uploaded = path.join(collectorHotDir, "integration-upload.txt");
    if (fs.existsSync(uploaded)) fs.rmSync(uploaded);
  });

  test("allows admin to authenticate via token request", async () => {
    const response = await fetch(`${baseUrl}/request-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "integration-admin",
        password: "Password123!",
      }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.token).toEqual(expect.any(String));
    authToken = json.token;
  });

  test("creates workspace and triggers collector ingestion", async () => {
    const createResponse = await fetch(`${baseUrl}/workspace/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: "Integration Space",
        onboardingComplete: true,
      }),
    });
    const createdJson = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createdJson.workspace).toMatchObject({
      name: "Integration Space",
      slug: expect.any(String),
    });

    workspaceRecord = await prisma.workspaces.findUnique({
      where: { slug: createdJson.workspace.slug },
    });
    expect(workspaceRecord).toBeTruthy();

    const form = new FormData();
    form.append(
      "file",
      new Blob(["Collector document"], { type: "text/plain" }),
      "integration-upload.txt"
    );

    const uploadResponse = await fetch(
      `${baseUrl}/workspace/${workspaceRecord.slug}/upload`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: form,
      }
    );
    const uploadJson = await uploadResponse.json();

    expect(uploadResponse.status).toBe(200);
    expect(uploadJson).toEqual({ success: true, error: null });
    expect(collector.requests.find((req) => req.endpoint === "process")).toBeDefined();
  });

  test("stores and queries vector data for workspace", async () => {
    const namespace = `workspace-${workspaceRecord.id}`;
    const docId = `doc-${Date.now()}`;
    const vectorId = `vector-${Date.now()}`;
    await prisma.workspace_documents.create({
      data: {
        docId,
        filename: "integration-upload.txt",
        docpath: "/collector/hotdir/integration-upload.txt",
        workspaceId: workspaceRecord.id,
        metadata: null,
      },
    });

    const { client } = await LanceDb.connect();
    await LanceDb.updateOrCreateCollection(
      client,
      [
        {
          id: vectorId,
          vector: [0.1, 0.3, 0.5],
          docId,
          workspaceId: workspaceRecord.id,
          title: "Integration Document",
          published: new Date().toISOString(),
          text: "Integration testing content",
        },
      ],
      namespace
    );

    await DocumentVectors.bulkInsert([{ docId, vectorId }]);

    const result = await LanceDb.similarityResponse({
      client,
      namespace,
      queryVector: [0.1, 0.3, 0.5],
      topN: 1,
    });

    expect(result.contextTexts[0]).toContain("Integration testing content");
    expect(result.sourceDocuments[0]).toMatchObject({ docId });
  });
});
