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
    const storedFiles = fs.readdirSync(documentsFolder, {
      withFileTypes: true,
    });
    for (const file of storedFiles) {
      if (file.isFile() && file.name.endsWith(".json")) {
        fs.rmSync(path.join(documentsFolder, file.name));
      }
    }

    const uploadedFiles = fs.readdirSync(WATCH_DIRECTORY, {
      withFileTypes: true,
    });
    for (const file of uploadedFiles) {
      if (file.isFile() && file.name !== "__HOTDIR__.md") {
        fs.rmSync(path.join(WATCH_DIRECTORY, file.name));
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

  test("rejects files outside of the watch directory", async () => {
    const result = await processSingleFile("../escape.txt");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("File does not exist in upload directory.");
    expect(result.documents).toEqual([]);
  });

  test("rejects reserved upload filenames", async () => {
    const result = await processSingleFile("__HOTDIR__.md");

    expect(result.success).toBe(false);
    expect(result.reason).toBe(
      "Filename is a reserved filename and cannot be processed."
    );
  });

  test("treats uploads missing a file extension as text", async () => {
    const filename = "archive";
    const filePath = path.join(WATCH_DIRECTORY, filename);
    fs.writeFileSync(filePath, "no extension");

    const result = await processSingleFile(filename);

    expect(result.success).toBe(true);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].location).toContain("custom-documents");
  });

  test("rejects requests for files that no longer exist", async () => {
    const result = await processSingleFile("missing.pdf");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("File does not exist in upload directory.");
  });
});

describe("processSingleFile supported converters", () => {
  const createProcessSingleFileWithMocks = () => {
    jest.resetModules();

    const converterMocks = {
      asTxt: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.json` }],
      })),
      asPdf: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.pdf.json` }],
      })),
      asDocx: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.docx.json` }],
      })),
      asDoc: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.doc.json` }],
      })),
      asOfficeMime: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.office.json` }],
      })),
      asXlsx: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.xlsx.json` }],
      })),
      asMbox: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.mbox.json` }],
      })),
      asEpub: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.epub.json` }],
      })),
      asAudio: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.audio.json` }],
      })),
      asImage: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.image.json` }],
      })),
    };

    jest.doMock("../processSingleFile/convert/asTxt.js", () =>
      converterMocks.asTxt
    );
    jest.doMock("../processSingleFile/convert/asPDF/index.js", () =>
      converterMocks.asPdf
    );
    jest.doMock("../processSingleFile/convert/asDocx.js", () =>
      converterMocks.asDocx
    );
    jest.doMock("../processSingleFile/convert/asDoc.js", () =>
      converterMocks.asDoc
    );
    jest.doMock("../processSingleFile/convert/asOfficeMime.js", () =>
      converterMocks.asOfficeMime
    );
    jest.doMock("../processSingleFile/convert/asXlsx.js", () =>
      converterMocks.asXlsx
    );
    jest.doMock("../processSingleFile/convert/asMbox.js", () =>
      converterMocks.asMbox
    );
    jest.doMock("../processSingleFile/convert/asEPub.js", () =>
      converterMocks.asEpub
    );
    jest.doMock("../processSingleFile/convert/asAudio.js", () =>
      converterMocks.asAudio
    );
    jest.doMock("../processSingleFile/convert/asImage.js", () =>
      converterMocks.asImage
    );

    const module = require("../processSingleFile");

    return { processSingleFile: module.processSingleFile, converterMocks };
  };

  afterEach(() => {
    jest.resetModules();
  });

  const supportedCases = [
    [".txt", "asTxt"],
    [".md", "asTxt"],
    [".csv", "asTxt"],
    [".json", "asTxt"],
    [".html", "asTxt"],
    [".pdf", "asPdf"],
    [".doc", "asDoc"],
    [".docx", "asDocx"],
    [".pptx", "asOfficeMime"],
    [".odt", "asOfficeMime"],
    [".odp", "asOfficeMime"],
    [".xlsx", "asXlsx"],
    [".mbox", "asMbox"],
    [".epub", "asEpub"],
    [".mp3", "asAudio"],
    [".wav", "asAudio"],
    [".mp4", "asAudio"],
    [".mpeg", "asAudio"],
    [".png", "asImage"],
    [".jpg", "asImage"],
    [".jpeg", "asImage"],
    [".webp", "asImage"],
  ];

  test.each(supportedCases)(
    "routes %s files through the %s converter",
    async (extension, mockKey) => {
      const filename = `ingest-${mockKey}${extension}`;
      const filePath = path.join(WATCH_DIRECTORY, filename);
      fs.writeFileSync(filePath, Buffer.from("stub"));

      const { processSingleFile: runProcess, converterMocks } =
        createProcessSingleFileWithMocks();

      const result = await runProcess(filename, {}, { source: "playwright" });

      expect(result.success).toBe(true);
      expect(converterMocks[mockKey]).toHaveBeenCalledWith(
        expect.objectContaining({
          filename,
          fullFilePath: path.resolve(WATCH_DIRECTORY, filename),
          metadata: { source: "playwright" },
        })
      );
    }
  );

  test("treats unknown text-like types as plain text", async () => {
    jest.resetModules();

    const converterMocks = {
      asTxt: jest.fn(async ({ filename }) => ({
        success: true,
        documents: [{ location: `${filename}.txt.json` }],
      })),
      trashFile: jest.fn(),
      isTextType: jest.fn(() => true),
    };

    jest.doMock("../processSingleFile/convert/asTxt.js", () =>
      converterMocks.asTxt
    );
    jest.doMock("../processSingleFile/convert/asPDF/index.js", () =>
      jest.fn()
    );
    jest.doMock("../utils/files", () => {
      const actual = jest.requireActual("../utils/files");
      return {
        ...actual,
        trashFile: converterMocks.trashFile,
        isTextType: () => converterMocks.isTextType(),
      };
    });

    const module = require("../processSingleFile");
    const runProcess = module.processSingleFile;

    const filename = "notes.log";
    const filePath = path.join(WATCH_DIRECTORY, filename);
    fs.writeFileSync(filePath, "log output");

    const result = await runProcess(filename);

    expect(result.success).toBe(true);
    expect(converterMocks.asTxt).toHaveBeenCalled();
    expect(converterMocks.trashFile).not.toHaveBeenCalled();
  });
});
