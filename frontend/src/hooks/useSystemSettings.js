import { useCallback, useEffect, useState } from "react";
import System from "@/models/system";

let cachedSettings = null;
let inFlightRequest = null;

async function requestSystemSettings(force = false) {
  if (force) {
    cachedSettings = null;
    inFlightRequest = null;
  }

  if (cachedSettings && !force) return cachedSettings;

  if (!inFlightRequest) {
    inFlightRequest = System.keys()
      .then((results) => {
        cachedSettings = results ?? {};
        return cachedSettings;
      })
      .catch((error) => {
        cachedSettings = null;
        throw error;
      })
      .finally(() => {
        inFlightRequest = null;
      });
  }

  return inFlightRequest;
}

function mergeSettings(previous = {}, update) {
  if (typeof update === "function") return update(previous ?? {});
  return { ...(previous ?? {}), ...(update ?? {}) };
}

export default function useSystemSettings({ skip = false } = {}) {
  const [settings, setSettings] = useState(() => cachedSettings);
  const [loading, setLoading] = useState(() => !skip && !cachedSettings);
  const [error, setError] = useState(null);

  const refresh = useCallback(
    async (options = { force: false }) => {
      if (skip) return null;

      setLoading(true);
      setError(null);

      try {
        const data = await requestSystemSettings(options?.force ?? false);
        setSettings(data);
        return data;
      } catch (err) {
        setSettings(null);
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [skip]
  );

  const updateCachedSettings = useCallback((update) => {
    setSettings((current) => {
      const nextSettings = mergeSettings(current, update);
      cachedSettings = nextSettings;
      return nextSettings;
    });
  }, []);

  useEffect(() => {
    if (skip) return;
    if (!settings) {
      refresh().catch(() => {});
    }
  }, [skip, settings, refresh]);

  return {
    settings,
    loading,
    error,
    refresh,
    updateCachedSettings,
  };
}

export function primeSystemSettingsCache(values) {
  cachedSettings = mergeSettings(cachedSettings, values);
}
