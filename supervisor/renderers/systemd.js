const { services } = require("../manifest");

function toUnit(service) {
  const env = Object.entries(service.env || {})
    .map(([key, value]) => `Environment=${key}=${value}`)
    .join("\n");

  return {
    name: `${service.name}.service`,
    content: `[Unit]\nDescription=${service.description || service.name}\nAfter=network.target\n\n[Service]\nWorkingDirectory=${service.cwd || process.cwd()}\nExecStart=${service.command.script} ${service.command.args}\nRestart=on-failure\n${env}\n\n[Install]\nWantedBy=multi-user.target\n`,
  };
}

function renderSystemdUnits() {
  return services.map(toUnit);
}

module.exports = { renderSystemdUnits };
