jest.mock("mime", () => ({
  getType: () => "text/plain",
}));
jest.mock("dotenv", () => ({
  config: () => ({}),
}));

const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "development";

const { WATCH_DIRECTORY } = require("../utils/constants");
const { processSingleFile } = require("../processSingleFile");

const documentsFolder = path.resolve(
  __dirname,
  "../../server/storage/documents/custom-documents"
);

describe("processSingleFile", () => {
  beforeAll(() => {
    fs.mkdirSync(WATCH_DIRECTORY, { recursive: true });
    fs.mkdirSync(documentsFolder, { recursive: true });
  });

  afterEach(() => {
    // Clean up generated documents so tests are idempotent.
    const files = fs.readdirSync(documentsFolder, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith(".json")) {
        fs.rmSync(path.join(documentsFolder, file.name));
      }
    }
  });

  test("converts a text file into a stored document", async () => {
    const filename = "sample-doc.txt";
    const filePath = path.join(WATCH_DIRECTORY, filename);
    fs.writeFileSync(filePath, "Collector ingestion test content.");

    const result = await processSingleFile(filename, {}, { title: "Sample" });

    expect(result.success).toBe(true);
    expect(result.documents).toHaveLength(1);

    const [document] = result.documents;
    expect(document.title).toBe("Sample");
    expect(document.location).toMatch(/custom-documents\//);
    expect(fs.existsSync(filePath)).toBe(false);

    const storedDocPath = path.resolve(
      __dirname,
      "../../server/storage/documents",
      document.location
    );
    expect(fs.existsSync(storedDocPath)).toBe(true);
    const storedContents = JSON.parse(fs.readFileSync(storedDocPath));
    expect(storedContents.pageContent).toContain("Collector ingestion test");
  });

  test("rejects unsupported binary file types", async () => {
    const filename = "binary.bin";
    const filePath = path.join(WATCH_DIRECTORY, filename);
    fs.writeFileSync(filePath, Buffer.from([0, 1, 2, 3]));

    const result = await processSingleFile(filename);

    expect(result.success).toBe(false);
    expect(result.documents).toHaveLength(0);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
