const vm = require("vm");
const util = require("util");
const { exec, execFile } = require("child_process");

const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);

/**
 * Execute a code flow step
 * @param {Object} config Flow step configuration
 * @param {Object} context Execution context with introspect/logger helpers
 * @returns {Promise<Object>} Result of the code execution
 */
async function executeCode(config, context) {
  const { language = "javascript", code } = config;
  const { introspect, logger } = context;

  logger("\x1b[43m[AgentFlowToolExecutor]\x1b[0m - executing Code block");

  if (!code?.trim()) {
    throw new Error("Code is required for execution");
  }

  const normalizedLanguage = String(language || "javascript").toLowerCase();
  introspect(`Executing ${normalizedLanguage} code snippet`);

  if (normalizedLanguage === "javascript") {
    const logs = [];
    const sandbox = {
      console: {
        log: (...args) => logs.push(args.join(" ")),
        warn: (...args) => logs.push(args.join(" ")),
        error: (...args) => logs.push(args.join(" ")),
      },
    };

    try {
      const script = new vm.Script(`(async () => {\n${code}\n})()`);
      const result = await script.runInNewContext(sandbox, { timeout: 5000 });
      return {
        language: "javascript",
        result: result ?? null,
        logs,
      };
    } catch (error) {
      throw new Error(`JavaScript execution failed: ${error.message}`);
    }
  }

  if (normalizedLanguage === "python") {
    try {
      const { stdout, stderr } = await execFileAsync("python3", ["-c", code], {
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
      return {
        language: "python",
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error("Python execution failed: python3 executable not found");
      }
      const stderr = error.stderr || "";
      throw new Error(`Python execution failed: ${stderr || error.message}`);
    }
  }

  if (normalizedLanguage === "shell") {
    try {
      const { stdout, stderr } = await execAsync(code, {
        shell: "/bin/bash",
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
      return {
        language: "shell",
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error) {
      const stderr = error.stderr || "";
      throw new Error(`Shell execution failed: ${stderr || error.message}`);
    }
  }

  throw new Error(`Unsupported language: ${language}`);
}

module.exports = executeCode;
