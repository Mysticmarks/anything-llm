#!/usr/bin/env node
const { buildPm2Config } = require("../../supervisor/renderers/pm2");
const { renderSystemdUnits } = require("../../supervisor/renderers/systemd");
const { renderKubernetesManifests } = require("../../supervisor/renderers/kubernetes");

const target = process.argv[2];

if (!target || !["pm2", "systemd", "kubernetes"].includes(target)) {
  console.error("Usage: node scripts/supervisor/export.js <pm2|systemd|kubernetes>");
  process.exit(1);
}

if (target === "pm2") {
  const config = buildPm2Config();
  console.log(JSON.stringify(config, null, 2));
  process.exit(0);
}

if (target === "systemd") {
  const units = renderSystemdUnits();
  for (const unit of units) {
    console.log(`# ${unit.name}`);
    console.log(unit.content.trimEnd());
    console.log("");
  }
  process.exit(0);
}

const manifests = renderKubernetesManifests();
for (const manifest of manifests) {
  console.log("---");
  console.log(JSON.stringify(manifest, null, 2));
}
