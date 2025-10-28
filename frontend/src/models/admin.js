import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const Admin = {
  // User Management
  users: async () => {
    return await fetch(`${API_BASE}/admin/users`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res?.users || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },
  newUser: async (data) => {
    return await fetch(`${API_BASE}/admin/users/new`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { user: null, error: e.message };
      });
  },
  updateUser: async (userId, data) => {
    return await fetch(`${API_BASE}/admin/user/${userId}`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },
  deleteUser: async (userId) => {
    return await fetch(`${API_BASE}/admin/user/${userId}`, {
      method: "DELETE",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },

  // Invitations
  invites: async () => {
    return await fetch(`${API_BASE}/admin/invites`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res?.invites || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },
  newInvite: async ({ role = null, workspaceIds = null }) => {
    return await fetch(`${API_BASE}/admin/invite/new`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({
        role,
        workspaceIds,
      }),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { invite: null, error: e.message };
      });
  },
  disableInvite: async (inviteId) => {
    return await fetch(`${API_BASE}/admin/invite/${inviteId}`, {
      method: "DELETE",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },

  // Workspaces Mgmt
  workspaces: async () => {
    return await fetch(`${API_BASE}/admin/workspaces`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res?.workspaces || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },
  workspaceUsers: async (workspaceId) => {
    return await fetch(`${API_BASE}/admin/workspaces/${workspaceId}/users`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res?.users || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },
  newWorkspace: async (name) => {
    return await fetch(`${API_BASE}/admin/workspaces/new`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ name }),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { workspace: null, error: e.message };
      });
  },
  updateUsersInWorkspace: async (workspaceId, userIds = []) => {
    return await fetch(
      `${API_BASE}/admin/workspaces/${workspaceId}/update-users`,
      {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify({ userIds }),
      }
    )
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },
  deleteWorkspace: async (workspaceId) => {
    return await fetch(`${API_BASE}/admin/workspaces/${workspaceId}`, {
      method: "DELETE",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },

  // System Preferences (legacy helper for callers expecting the former aggregate response)
  systemPreferences: async function () {
    const labels = [
      "footer_data",
      "support_email",
      "text_splitter_chunk_size",
      "text_splitter_chunk_overlap",
      "max_embed_chunk_size",
      "agent_search_provider",
      "agent_sql_connections",
      "default_agent_skills",
      "disabled_agent_skills",
      "imported_agent_skills",
      "custom_app_name",
      "feature_flags",
      "meta_page_title",
      "meta_page_favicon",
    ];

    const response = await this.systemPreferencesByFields(labels);
    const settings = response?.settings || {};

    return {
      settings: {
        footer_data: settings.footer_data ?? JSON.stringify([]),
        support_email: settings.support_email ?? null,
        text_splitter_chunk_size: settings.text_splitter_chunk_size ?? null,
        text_splitter_chunk_overlap: settings.text_splitter_chunk_overlap ?? null,
        max_embed_chunk_size: settings.max_embed_chunk_size ?? 1000,
        agent_search_provider: settings.agent_search_provider ?? null,
        agent_sql_connections: settings.agent_sql_connections ?? [],
        default_agent_skills: settings.default_agent_skills ?? [],
        disabled_agent_skills: settings.disabled_agent_skills ?? [],
        imported_agent_skills: settings.imported_agent_skills ?? [],
        custom_app_name: settings.custom_app_name ?? null,
        feature_flags: settings.feature_flags ?? {},
        meta_page_title: settings.meta_page_title ?? null,
        meta_page_favicon: settings.meta_page_favicon ?? null,
      },
    };
  },

  /**
   * Fetches system preferences by fields
   * @param {string[]} labels - Array of labels for settings
   * @returns {Promise<{settings: Object, error: string}>} - System preferences object
   */
  systemPreferencesByFields: async (labels = []) => {
    return await fetch(
      `${API_BASE}/admin/system-preferences-for?labels=${labels.join(",")}`,
      {
        method: "GET",
        headers: baseHeaders(),
      }
    )
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return null;
      });
  },
  updateSystemPreferences: async (updates = {}) => {
    return await fetch(`${API_BASE}/admin/system-preferences/update`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(updates),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },

  // API Keys
  getApiKeys: async function () {
    return fetch(`${API_BASE}/admin/api-keys`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.statusText || "Error fetching api keys.");
        }
        return res.json();
      })
      .catch((e) => {
        console.error(e);
        return { apiKeys: [], error: e.message };
      });
  },
  generateApiKey: async function () {
    return fetch(`${API_BASE}/admin/generate-api-key`, {
      method: "POST",
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.statusText || "Error generating api key.");
        }
        return res.json();
      })
      .catch((e) => {
        console.error(e);
        return { apiKey: null, error: e.message };
      });
  },
  deleteApiKey: async function (apiKeyId = "") {
    return fetch(`${API_BASE}/system/api-key/${apiKeyId}`, {
      method: "DELETE",
      headers: baseHeaders(),
    })
      .then((res) => res.ok)
      .catch((e) => {
        console.error(e);
        return false;
      });
  },
};

export default Admin;
