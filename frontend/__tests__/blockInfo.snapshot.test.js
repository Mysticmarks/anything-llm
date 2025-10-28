const fs = require("fs");
const path = require("path");
const vm = require("vm");

describe("Agent builder block definitions", () => {
  it("includes website, file, and code blocks", () => {
    const filePath = path.resolve(
      __dirname,
      "../src/pages/Admin/AgentBuilder/BlockList/blockInfo.js"
    );
    const source = fs.readFileSync(filePath, "utf8");

    const transformed = source
      .replace(/^import[^;]+;\n/gm, "")
      .replace(
        /const ICONS = {[\s\S]*?};/,
        "const ICONS = new Proxy({}, { get: () => () => null });"
      )
      .replace(/export const /g, "const ")
      .concat(
        "\nmodule.exports = { BLOCK_TYPES, RAW_BLOCK_INFO, BLOCK_INFO };"
      );

    const sandbox = { module: { exports: {} }, exports: {} };
    vm.createContext(sandbox);
    new vm.Script(transformed, { filename: "blockInfo.js" }).runInContext(
      sandbox
    );

    const { BLOCK_TYPES, RAW_BLOCK_INFO } = sandbox.module.exports;

    expect(RAW_BLOCK_INFO[BLOCK_TYPES.WEBSITE]).toBeDefined();
    expect(RAW_BLOCK_INFO[BLOCK_TYPES.FILE]).toBeDefined();
    expect(RAW_BLOCK_INFO[BLOCK_TYPES.CODE]).toBeDefined();

    const snapshot = Object.fromEntries(
      Object.entries(RAW_BLOCK_INFO).map(([type, info]) => [
        type,
        {
          label: info.label,
          description: info.description,
          hasDefaultConfig: !!info.defaultConfig,
          summaryExample: info.getSummary(info.defaultConfig || {}),
        },
      ])
    );

    expect(snapshot).toMatchSnapshot();
  });
});
