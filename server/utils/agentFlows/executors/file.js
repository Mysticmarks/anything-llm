const fs = require("fs/promises");
const path = require("path");
const {
  normalizePath,
  isWithin,
  documentsPath,
} = require("../../files");

async function ensureDirectoryExists(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

/**
 * Execute a file system flow step
 * @param {Object} config Flow step configuration
 * @param {Object} context Execution context with introspect/logger helpers
 * @returns {Promise<Object>} Result of the file interaction
 */
async function executeFile(config, context) {
  const { operation = "read", path: filePath, content = "" } = config;
  const { introspect, logger } = context;

  logger("\x1b[43m[AgentFlowToolExecutor]\x1b[0m - executing File block");

  if (!filePath?.trim()) {
    throw new Error("File path is required for file operations");
  }

  const sanitizedPath = normalizePath(filePath);
  const absolutePath = path.resolve(documentsPath, sanitizedPath);
  if (!isWithin(documentsPath, absolutePath)) {
    throw new Error("Access to the requested path is not allowed");
  }

  const normalizedOperation = String(operation || "read").toLowerCase();

  switch (normalizedOperation) {
    case "read": {
      introspect(`Reading file at ${sanitizedPath}`);
      try {
        const data = await fs.readFile(absolutePath, "utf8");
        return {
          operation: "read",
          path: sanitizedPath,
          content: data,
        };
      } catch (error) {
        if (error.code === "ENOENT") {
          throw new Error(`File not found: ${sanitizedPath}`);
        }
        throw new Error(`Failed to read file: ${error.message}`);
      }
    }
    case "write": {
      introspect(`Writing file at ${sanitizedPath}`);
      const buffer = Buffer.from(content || "", "utf8");
      await ensureDirectoryExists(absolutePath);
      await fs.writeFile(absolutePath, buffer);
      return {
        operation: "write",
        path: sanitizedPath,
        bytesWritten: buffer.length,
        message: `Wrote ${buffer.length} bytes to ${sanitizedPath}`,
      };
    }
    case "append": {
      introspect(`Appending to file at ${sanitizedPath}`);
      const buffer = Buffer.from(content || "", "utf8");
      await ensureDirectoryExists(absolutePath);
      await fs.appendFile(absolutePath, buffer);
      return {
        operation: "append",
        path: sanitizedPath,
        bytesWritten: buffer.length,
        message: `Appended ${buffer.length} bytes to ${sanitizedPath}`,
      };
    }
    default:
      throw new Error(`Unsupported file operation: ${operation}`);
  }
}

module.exports = executeFile;
