const fs = require("fs");
const os = require("os");
const path = require("path");

const mockDocumentsDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "agent-flow-files-")
);

process.env.STORAGE_DIR = mockDocumentsDir;

jest.mock("../../../../utils/files", () => {
  const actual = jest.requireActual("../../../../utils/files");
  return {
    ...actual,
    documentsPath: mockDocumentsDir,
    isWithin: (_outer, inner) => actual.isWithin(mockDocumentsDir, inner),
  };
});

const executeFile = require("../../../../utils/agentFlows/executors/file");

const baseContext = {
  introspect: jest.fn(),
  logger: jest.fn(),
};

const targetFile = path.join(mockDocumentsDir, "output/test.txt");

describe("executeFile", () => {
  afterAll(() => {
    fs.rmSync(mockDocumentsDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    baseContext.introspect.mockClear();
    baseContext.logger.mockClear();
    if (fs.existsSync(targetFile)) {
      fs.rmSync(targetFile);
    }
  });

  it("writes a new file", async () => {
    const result = await executeFile(
      {
        operation: "write",
        path: "output/test.txt",
        content: "hello",
      },
      baseContext
    );

    expect(result.operation).toBe("write");
    expect(result.bytesWritten).toBe(5);
    const stored = fs.readFileSync(targetFile, "utf8");
    expect(stored).toBe("hello");
  });

  it("reads an existing file", async () => {
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, "seed", "utf8");
    const result = await executeFile(
      { operation: "read", path: "output/test.txt" },
      baseContext
    );

    expect(result).toEqual({
      operation: "read",
      path: "output/test.txt",
      content: "seed",
    });
  });

  it("appends to a file", async () => {
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, "hello", "utf8");
    await executeFile(
      { operation: "append", path: "output/test.txt", content: " world" },
      baseContext
    );

    const updated = fs.readFileSync(targetFile, "utf8");
    expect(updated).toBe("hello world");
  });

  it("throws on unsupported operation", async () => {
    await expect(
      executeFile({ operation: "delete", path: "output/test.txt" }, baseContext)
    ).rejects.toThrow("Unsupported file operation");
  });
});
