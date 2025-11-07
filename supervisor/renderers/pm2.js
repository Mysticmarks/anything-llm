const { repoRoot, services } = require("../manifest");

function toPm2App(service) {
  return {
    name: service.name,
    cwd: service.cwd || repoRoot,
    script: service.command.script,
    args: service.command.args,
    env: { NODE_ENV: "production", ...(service.env || {}) },
  };
}

function buildPm2Config() {
  return {
    apps: services.map(toPm2App),
  };
}

module.exports = { buildPm2Config };
