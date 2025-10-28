const mockExec = jest.fn((command, options, callback) =>
  callback(null, { stdout: "shell output\n", stderr: "" })
);
const mockExecFile = jest.fn((command, args, options, callback) =>
  callback(null, { stdout: "python output\n", stderr: "" })
);

jest.mock("child_process", () => ({
  exec: mockExec,
  execFile: mockExecFile,
}));

const executeCode = require("../../../../utils/agentFlows/executors/code");

const baseContext = {
  introspect: jest.fn(),
  logger: jest.fn(),
};

describe("executeCode", () => {
  beforeEach(() => {
    baseContext.introspect.mockClear();
    baseContext.logger.mockClear();
    mockExec.mockClear();
    mockExecFile.mockClear();
  });

  it("requires code", async () => {
    await expect(
      executeCode({ language: "javascript", code: "" }, baseContext)
    ).rejects.toThrow("Code is required");
  });

  it("executes javascript and captures logs", async () => {
    const result = await executeCode(
      { language: "javascript", code: "console.log('hi'); return 4;" },
      baseContext
    );

    expect(result.language).toBe("javascript");
    expect(result.result).toBe(4);
    expect(result.logs).toContain("hi");
  });

  it("delegates to python runtime", async () => {
    const result = await executeCode(
      { language: "python", code: "print('hi')" },
      baseContext
    );

    expect(mockExecFile).toHaveBeenCalledWith(
      "python3",
      ["-c", "print('hi')"],
      expect.objectContaining({ timeout: expect.any(Number) }),
      expect.any(Function)
    );
    expect(result).toEqual({
      language: "python",
      stdout: "python output",
      stderr: "",
    });
  });

  it("delegates to shell runtime", async () => {
    const result = await executeCode(
      { language: "shell", code: "echo hi" },
      baseContext
    );

    expect(mockExec).toHaveBeenCalledWith(
      "echo hi",
      expect.objectContaining({ shell: "/bin/bash" }),
      expect.any(Function)
    );
    expect(result).toEqual({
      language: "shell",
      stdout: "shell output",
      stderr: "",
    });
  });

  it("throws on unsupported language", async () => {
    await expect(
      executeCode({ language: "ruby", code: "puts 'hi'" }, baseContext)
    ).rejects.toThrow("Unsupported language");
  });
});
