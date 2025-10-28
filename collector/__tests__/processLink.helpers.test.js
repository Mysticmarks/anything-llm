const path = require("path");

process.env.NODE_ENV = "development";

jest.mock("../utils/downloadURIToFile", () => ({
  downloadURIToFile: jest.fn(),
}));

jest.mock("../processSingleFile", () => ({
  processSingleFile: jest.fn(),
}));

jest.mock("../utils/files", () => ({
  ...jest.requireActual("../utils/files"),
  trashFile: jest.fn(),
}));

const { WATCH_DIRECTORY } = require("../utils/constants");
const { downloadURIToFile } = require("../utils/downloadURIToFile");
const { processSingleFile } = require("../processSingleFile");
const { trashFile } = require("../utils/files");
const {
  processAsFile,
  cleanupDownloadedFile,
} = require("../processLink/helpers");

describe("processAsFile temporary file cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("cleans up hotdir download when text-only extraction succeeds", async () => {
    const filePath = path.join(WATCH_DIRECTORY, "example.pdf");
    downloadURIToFile.mockResolvedValue({
      success: true,
      fileLocation: filePath,
      reason: null,
    });
    processSingleFile.mockResolvedValue({
      success: true,
      documents: [{ pageContent: "hello" }],
    });

    const result = await processAsFile({
      uri: "https://example.com/file.pdf",
      saveAsDocument: false,
      cleanupAfterProcessing: true,
    });

    expect(result).toEqual({ success: true, content: "hello" });
    expect(trashFile).toHaveBeenCalledWith(filePath);
  });

  test("still removes temporary download when parsing fails", async () => {
    const filePath = path.join(WATCH_DIRECTORY, "broken.docx");
    downloadURIToFile.mockResolvedValue({
      success: true,
      fileLocation: filePath,
      reason: null,
    });
    processSingleFile.mockResolvedValue({
      success: false,
      reason: "parse failure",
      documents: [],
    });

    const result = await processAsFile({
      uri: "https://example.com/broken.docx",
      saveAsDocument: true,
      cleanupAfterProcessing: true,
    });

    expect(result).toEqual({
      success: false,
      reason: "parse failure",
      documents: [],
    });
    expect(trashFile).toHaveBeenCalledWith(filePath);
  });
});

describe("cleanupDownloadedFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("ignores files outside of the hot directory", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    cleanupDownloadedFile("/tmp/outside.txt", true);
    expect(trashFile).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
