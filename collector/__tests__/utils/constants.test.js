const {
  ACCEPTED_MIMES,
  SUPPORTED_FILETYPE_CONVERTERS,
} = require("../../utils/constants");

describe("collector constants", () => {
  test("includes legacy doc support", () => {
    expect(ACCEPTED_MIMES["application/msword"]).toContain(".doc");
  });

  test("maps doc extension to converter", () => {
    expect(SUPPORTED_FILETYPE_CONVERTERS[".doc"]).toBe("./convert/asDoc.js");
  });
});
