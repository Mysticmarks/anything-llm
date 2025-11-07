const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const services = [
  {
    name: "anything-llm-server",
    description: "Express API server",
    command: { script: "yarn", args: "prod:server" },
    cwd: repoRoot,
    env: { NODE_ENV: "production" },
    probes: {
      startup: {
        type: "http",
        path: "/api/health/ready",
        portEnv: "SERVER_PORT",
        port: Number(process.env.SERVER_PORT || 3001),
        interval: 30,
        timeout: 5,
      },
    },
  },
  {
    name: "anything-llm-collector",
    description: "Document ingestion collector",
    command: { script: "yarn", args: "prod:collector" },
    cwd: repoRoot,
    env: { NODE_ENV: "production" },
    probes: {
      startup: {
        type: "http",
        path: "/healthz",
        fallbackPath: "/",
        portEnv: "COLLECTOR_PORT",
        port: Number(process.env.COLLECTOR_PORT || 8888),
        interval: 30,
        timeout: 5,
      },
    },
  },
  {
    name: "anything-llm-frontend",
    description: "Static preview server",
    command: { script: "node", args: "scripts/start-frontend.mjs" },
    cwd: repoRoot,
    env: {
      NODE_ENV: "production",
      FRONTEND_HOST: process.env.FRONTEND_HOST || "0.0.0.0",
      FRONTEND_PORT: process.env.FRONTEND_PORT || "4173",
    },
    probes: {
      startup: {
        type: "http",
        path: "/",
        portEnv: "FRONTEND_PORT",
        port: Number(process.env.FRONTEND_PORT || 4173),
        interval: 60,
        timeout: 5,
      },
    },
  },
  {
    name: "anything-llm-embedding-worker",
    description: "BullMQ embedding worker",
    command: { script: "node", args: "server/jobs/embedding-service.js" },
    cwd: repoRoot,
    env: { NODE_ENV: "production" },
    probes: {
      startup: {
        type: "queue",
        queue: "embedding-jobs",
        interval: 30,
      },
    },
  },
];

module.exports = {
  repoRoot,
  services,
};
