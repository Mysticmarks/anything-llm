const { services } = require("../manifest");

function toDeployment(service) {
  const container = {
    name: service.name,
    image: "<replace-with-image>",
    command: [service.command.script, ...String(service.command.args || "").split(" ").filter(Boolean)],
    env: Object.entries(service.env || {}).map(([name, value]) => ({ name, value: String(value) })),
    readinessProbe: service.probes?.startup?.type === "http"
      ? {
          httpGet: {
            path: service.probes.startup.path,
            port:
              service.probes.startup.port || service.probes.startup.portEnv || "http",
          },
          initialDelaySeconds: service.probes.startup.interval,
          timeoutSeconds: service.probes.startup.timeout || 5,
        }
      : undefined,
  };

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: service.name },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: service.name } },
      template: {
        metadata: { labels: { app: service.name } },
        spec: { containers: [container] },
      },
    },
  };
}

function renderKubernetesManifests() {
  return services.map(toDeployment);
}

module.exports = { renderKubernetesManifests };
