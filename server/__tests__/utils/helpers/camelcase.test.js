const { camelCase } = require("../../../utils/helpers/camelcase");

describe("camelCase helper", () => {
  test("throws for non-string input", () => {
    expect(() => camelCase(123)).toThrow(
      "Expected the input to be `string | string[]`"
    );
  });

  test("normalizes array input while preserving pascal case by default", () => {
    const result = camelCase(["  hello", "world  "]);
    expect(result).toBe("HelloWorld");
  });

  test("respects pascalCase option and trims separators", () => {
    expect(camelCase("  spaced name  ", { pascalCase: false })).toBe(
      "spacedName"
    );
  });

  test("preserves consecutive uppercase letters when requested", () => {
    const value = camelCase("API_response_code", {
      preserveConsecutiveUppercase: true,
    });
    expect(value).toBe("APIResponseCode");
  });

  test("returns empty string when only separators are provided", () => {
    expect(camelCase("-_-")).toBe("");
  });
});
