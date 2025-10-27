module.exports = {
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/frontend/tests/e2e/"],
  moduleNameMapper: {
    "^dotenv$": "<rootDir>/jest.stubs/dotenv.js",
    "^mime$": "<rootDir>/jest.stubs/mime.js",
    "^uuid$": "<rootDir>/server/node_modules/uuid/dist/index.js",
    "^js-tiktoken$": "<rootDir>/jest.stubs/js-tiktoken.js",
    "^slugify$": "<rootDir>/jest.stubs/slugify.js",
  },
};
