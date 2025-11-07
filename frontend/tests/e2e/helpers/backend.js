const API_BASE =
  process.env.PLAYWRIGHT_API_BASE || "http://127.0.0.1:3001/api";
const AUTH_PASSWORD =
  process.env.PLAYWRIGHT_AUTH_PASSWORD || "integration-secret";
const ADMIN_USERNAME =
  process.env.PLAYWRIGHT_ADMIN_USER || "integration-admin";

async function fetchAuthToken(request) {
  const response = await request.post(`${API_BASE}/request-token`, {
    data: { password: AUTH_PASSWORD },
  });
  if (response.status() !== 200) {
    throw new Error(`Authentication request failed with ${response.status()}`);
  }
  const payload = await response.json();
  if (!payload?.valid || !payload?.token) {
    throw new Error(`Authentication rejected: ${payload?.message || "unknown"}`);
  }
  return {
    token: payload.token,
    user: payload.user || {
      id: payload?.user?.id || 1,
      username: ADMIN_USERNAME,
      role: "admin",
      seen_recovery_codes: true,
    },
  };
}

async function authorizedRequest(request, token, method, path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const response = await request.fetch(`${API_BASE}${path}`, {
    method,
    headers,
    data: options.data,
  });
  return response;
}

async function getWorkspace(request, token, slug) {
  const response = await authorizedRequest(request, token, "GET", `/workspace/${slug}`, {
    headers: { Accept: "application/json" },
  });
  if (response.status() !== 200) {
    const text = await response.text();
    throw new Error(`Failed to fetch workspace ${slug}: ${response.status()} ${text}`);
  }
  return response.json();
}

async function ensureWorkspaceAbsent(request, token, slug) {
  await authorizedRequest(request, token, "DELETE", `/workspace/${slug}`, {
    headers: { Accept: "application/json" },
  }).catch(() => undefined);
}

async function createWorkspace(request, token, name) {
  const response = await authorizedRequest(
    request,
    token,
    "POST",
    "/workspace/new",
    { data: { name, onboardingComplete: true } }
  );
  if (response.status() !== 200) {
    const text = await response.text();
    throw new Error(`Failed to create workspace: ${response.status()} ${text}`);
  }
  return response.json();
}

async function renameWorkspace(request, token, slug, data) {
  const response = await authorizedRequest(
    request,
    token,
    "POST",
    `/workspace/${slug}/update`,
    { data }
  );
  if (response.status() !== 200) {
    const text = await response.text();
    throw new Error(`Failed to update workspace: ${response.status()} ${text}`);
  }
  return response.json();
}

async function resetWorkspaceChats(request, token, slug) {
  await authorizedRequest(request, token, "DELETE", `/workspace/${slug}/chats`, {
    data: {},
  }).catch(() => undefined);
}

async function setSessionStorage(page, { token, user }) {
  await page.addInitScript((session) => {
    window.localStorage.setItem(
      "anythingllm_user",
      JSON.stringify(session.user)
    );
    window.localStorage.setItem("anythingllm_authToken", session.token);
  }, { token, user });
}

async function assertAccessibility(page) {
  const tree = await page.accessibility.snapshot();
  if (!tree) {
    throw new Error("Accessibility snapshot unavailable");
  }
  if (!tree.children || tree.children.length === 0) {
    throw new Error("Accessibility tree missing child nodes");
  }
}

async function assertNavigationPerformance(page, thresholdMs = 3500) {
  const metrics = await page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry
      ? {
          domContentLoaded: entry.domContentLoadedEventEnd,
          load: entry.loadEventEnd,
        }
      : null;
  });
  if (!metrics) throw new Error("Navigation metrics unavailable");
  if (metrics.domContentLoaded > thresholdMs) {
    throw new Error(
      `DOMContentLoaded exceeded threshold: ${metrics.domContentLoaded}ms`
    );
  }
}

module.exports = {
  API_BASE,
  fetchAuthToken,
  authorizedRequest,
  getWorkspace,
  ensureWorkspaceAbsent,
  createWorkspace,
  renameWorkspace,
  resetWorkspaceChats,
  setSessionStorage,
  assertAccessibility,
  assertNavigationPerformance,
};
