const path = require("path");

const repoRoot = __dirname ? path.resolve(__dirname, "..") : process.cwd();

module.exports = {
  apps: [
    {
      name: "anything-llm-server",
      cwd: repoRoot,
      script: "yarn",
      args: "prod:server",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "anything-llm-collector",
      cwd: repoRoot,
      script: "yarn",
      args: "prod:collector",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "anything-llm-frontend",
      cwd: repoRoot,
      script: "node",
      args: "scripts/start-frontend.mjs",
      env: {
        NODE_ENV: "production",
        FRONTEND_HOST: process.env.FRONTEND_HOST || "0.0.0.0",
        FRONTEND_PORT: process.env.FRONTEND_PORT || "4173",
      },
    },
  ],
};
