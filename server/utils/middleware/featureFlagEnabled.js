const { SystemSettings } = require("../../models/systemSettings");

// Explicitly check that a specific feature flag is enabled.
// This should match the key in the SystemSetting label.
function featureFlagEnabled(featureFlagKey = null, options = {}) {
  const { allowWhenDisabled = false } = options;
  return async (_, response, next) => {
    if (!featureFlagKey) return response.sendStatus(401).end();

    const flagValue = (
      await SystemSettings.get({ label: String(featureFlagKey) })
    )?.value;
    if (flagValue === "enabled") {
      next();
      return;
    }

    if (allowWhenDisabled && (!flagValue || flagValue === "disabled")) {
      next();
      return;
    }

    return response.sendStatus(401).end();
  };
}
module.exports = {
  featureFlagEnabled,
};
