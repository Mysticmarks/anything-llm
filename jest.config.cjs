module.exports = {
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/frontend/tests/e2e/"],
  moduleDirectories: ["node_modules", "frontend/node_modules"],
  setupFilesAfterEnv: ["<rootDir>/server/jest.setup.js"],
  moduleNameMapper: {
    "^dotenv$": "<rootDir>/jest.stubs/dotenv.js",
    "^mime$": "<rootDir>/jest.stubs/mime.js",
    "^uuid$": "<rootDir>/server/node_modules/uuid/dist/index.js",
    "^js-tiktoken$": "<rootDir>/jest.stubs/js-tiktoken.js",
    "^slugify$": "<rootDir>/jest.stubs/slugify.js",
    "^@/(.*)$": "<rootDir>/frontend/src/$1",
    "^@testing-library/react$": "<rootDir>/jest.stubs/testing-library-react.js",
    "^react$": "<rootDir>/jest.stubs/react-mock.js",
  },
};
