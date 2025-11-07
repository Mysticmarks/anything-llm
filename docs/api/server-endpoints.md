# Server Endpoint Inventory

This document enumerates every Express route registered by `server/index.js` and groups them by the module responsible for registration. Each table lists the HTTP method and path for quick reference. Detailed request and response contracts are summarized after each table.

## `admin.js`

| Method | Path |
| --- | --- |
| `GET` | `/admin/users` |
| `POST` | `/admin/users/new` |
| `POST` | `/admin/user/:id` |
| `DELETE` | `/admin/user/:id` |
| `GET` | `/admin/invites` |
| `POST` | `/admin/invite/new` |
| `DELETE` | `/admin/invite/:id` |
| `GET` | `/admin/workspaces` |
| `GET` | `/admin/workspaces/:workspaceId/users` |
| `POST` | `/admin/workspaces/new` |
| `POST` | `/admin/workspaces/:workspaceId/update-users` |
| `DELETE` | `/admin/workspaces/:id` |
| `GET` | `/admin/system-preferences-for` |
| `POST` | `/admin/system-preferences/update` |
| `GET` | `/admin/api-keys` |
| `POST` | `/admin/generate-api-key` |

**Contract summary:**
- `GET /admin/users` — Requires a validated session with admin or manager role. Returns `{ users }` populated via `User.where()`.
- `POST /admin/users/new` — Accepts a JSON body with new user credentials (`username`, `password`, `role`, optional workspace assignments). Validates the caller’s permissions and role selection, creates the account, emits telemetry, and returns `{ user, error }`.
- `POST /admin/user/:id` — Updates an existing account. Expects a JSON payload of mutable fields (role, suspension flags, password reset). Enforces that privileged users cannot demote peers improperly. Responds with `{ success, error }`.
- `DELETE /admin/user/:id` — Deletes the target account after verifying the actor can modify it. Responds with `{ success: true }` and logs the deletion.
- `GET /admin/invites` — Lists pending invitations with creator context as `{ invites }`.
- `POST /admin/invite/new` — Body includes optional `workspaceIds`. Creates a new invite code, logs telemetry, and returns `{ invite, error }`.
- `DELETE /admin/invite/:id` — Deactivates an invite record and returns `{ success, error }`.
- `GET /admin/workspaces` — Returns `{ workspaces }` including assigned users for administrative review.
- `GET /admin/workspaces/:workspaceId/users` — Returns `{ users }` tied to the workspace ID.
- `POST /admin/workspaces/new` — Accepts `{ name }` and provisions a workspace owned by the current actor. Response `{ workspace, error }` mirrors `Workspace.new` contract.
- `POST /admin/workspaces/:workspaceId/update-users` — Expects `{ userIds }` array. Synchronizes workspace membership and returns `{ success, error }`.
- `DELETE /admin/workspaces/:id` — Fully removes the workspace, associated chats, vectors, and documents before returning `{ success: true, error: null }`.
- `GET /admin/system-preferences-for` — Query parameter `labels` (comma-separated) selects which public `SystemSettings` values to return as a JSON object.
- `POST /admin/system-preferences/update` — Body `{ settings: { [label]: value } }` persists admin-configurable settings and returns `{ success, errors }`.
- `GET /admin/api-keys` — Returns `{ keys }` summarizing system-level API keys.
- `POST /admin/generate-api-key` — Creates a new system API key for agent imports; accepts `{ name, role, permissions }` and returns `{ key, error }`.

## `agentFlows.js`

| Method | Path |
| --- | --- |
| `POST` | `/agent-flows/save` |
| `GET` | `/agent-flows/list` |
| `GET` | `/agent-flows/:uuid` |
| `POST` | `/agent-flows/:uuid/run` |
| `DELETE` | `/agent-flows/:uuid` |
| `POST` | `/agent-flows/:uuid/toggle` |

**Contract summary:**
- `POST /agent-flows/save` — Accepts a JSON body describing agent flow metadata and steps. Upserts the flow definition and returns `{ flow }`.
- `GET /agent-flows/list` — Returns `{ flows }` representing all saved agent flows for the authenticated user.
- `GET /agent-flows/:uuid` — Fetches a single agent flow by UUID, responding with `{ flow }` or 404 when missing.
- `POST /agent-flows/:uuid/run` — Body includes execution context (workspace slug, variables, optional input). Triggers the orchestrated flow run and streams/returns `{ runId, status }`.
- `DELETE /agent-flows/:uuid` — Removes an agent flow definition and returns `{ success }`.
- `POST /agent-flows/:uuid/toggle` — Accepts `{ enabled: boolean }` to activate/deactivate the flow and returns updated metadata.

## `agentPlugins.js`

| Method | Path |
| --- | --- |
| `POST` | `/admin/v1/agent-plugins/:hubId/toggle` |
| `POST` | `/admin/v1/agent-plugins/:hubId/config` |
| `DELETE` | `/admin/v1/agent-plugins/:hubId` |

**Contract summary:**
- `POST /admin/v1/agent-plugins/:hubId/toggle` — Body `{ enabled: boolean }`. Enables or disables a plugin imported from the community hub and returns `{ plugin }`.
- `POST /admin/v1/agent-plugins/:hubId/config` — Accepts a JSON map of plugin configuration values (`{ config: {...} }`). Persists encrypted secrets when necessary and returns `{ plugin }`.
- `DELETE /admin/v1/agent-plugins/:hubId` — Removes the plugin registration and returns `{ success }`.

## `api/admin/index.js`

| Method | Path |
| --- | --- |
| `GET` | `/v1/admin/is-multi-user-mode` |
| `GET` | `/v1/admin/users` |
| `POST` | `/v1/admin/users/new` |
| `POST` | `/v1/admin/users/:id` |
| `DELETE` | `/v1/admin/users/:id` |
| `GET` | `/v1/admin/invites` |
| `POST` | `/v1/admin/invite/new` |
| `DELETE` | `/v1/admin/invite/:id` |
| `GET` | `/v1/admin/workspaces/:workspaceId/users` |
| `POST` | `/v1/admin/workspaces/:workspaceId/update-users` |
| `POST` | `/v1/admin/workspaces/:workspaceSlug/manage-users` |
| `POST` | `/v1/admin/workspace-chats` |
| `POST` | `/v1/admin/preferences` |

**Contract summary:**
- `GET /v1/admin/is-multi-user-mode` — Requires a valid API key. Returns `{ multiUser: boolean }` to indicate server mode.
- `GET /v1/admin/users` — Returns `{ users }` for administrative automation scripts.
- `POST /v1/admin/users/new` — Body replicates UI contract (`username`, `password`, `role`, `workspaceIds`). Responds with `{ user, error }`.
- `POST /v1/admin/users/:id` — Updates a user via API automation with the same validation rules as the UI. Response `{ success, error }`.
- `DELETE /v1/admin/users/:id` — Deletes the referenced user and returns `{ success, error }`.
- `GET /v1/admin/invites` — Lists invites as `{ invites }` including metadata.
- `POST /v1/admin/invite/new` — Creates an invite (`{ workspaceIds }`) and returns `{ invite, error }`.
- `DELETE /v1/admin/invite/:id` — Revokes an invite and responds `{ success, error }`.
- `GET /v1/admin/workspaces/:workspaceId/users` — Returns `{ users }` for a workspace.
- `POST /v1/admin/workspaces/:workspaceId/update-users` — Synchronizes membership with body `{ userIds }`. Returns `{ success, error }`.
- `POST /v1/admin/workspaces/:workspaceSlug/manage-users` — Accepts `{ addUserIds, removeUserIds }` to incrementally change workspace membership. Responds `{ success, error }`.
- `POST /v1/admin/workspace-chats` — Body describes export filters (workspace slug, range). Returns a generated download URL or archived transcript metadata.
- `POST /v1/admin/preferences` — Accepts `{ settings: { [label]: value } }` for automation to update public system preferences. Responds `{ success, errors }`.

## `api/auth/index.js`

| Method | Path |
| --- | --- |
| `GET` | `/v1/auth` |

**Contract summary:**
- `GET /v1/auth` — Validates the provided API key and returns `{ valid: true, user: {...} }` metadata for automation clients.

## `api/document/index.js`

| Method | Path |
| --- | --- |
| `POST` | `/v1/document/upload` |
| `POST` | `/v1/document/upload/:folderName` |
| `POST` | `/v1/document/upload-link` |
| `POST` | `/v1/document/raw-text` |
| `GET` | `/v1/documents` |
| `GET` | `/v1/documents/folder/:folderName` |
| `GET` | `/v1/document/accepted-file-types` |
| `GET` | `/v1/document/metadata-schema` |
| `GET` | `/v1/document/:docName` |
| `POST` | `/v1/document/create-folder` |
| `DELETE` | `/v1/document/remove-folder` |
| `POST` | `/v1/document/move-files` |

**Contract summary:**
- All routes require the developer API key middleware (`validApiKey`). Upload operations add `handleAPIFileUpload`.
- File uploads (`POST /v1/document/upload` and `/v1/document/upload/:folderName`) accept multipart form data with a `file` field, optional JSON `metadata`, and optional `addToWorkspaces` comma-delimited slugs. Responses return `{ success, error, documents }` emitted by the collector service.
- Link ingestion (`POST /v1/document/upload-link`) expects JSON `{ url, workspaceSlugs?, metadata? }` and returns ingestion job metadata.
- Raw text ingestion (`POST /v1/document/raw-text`) accepts `{ title, body, workspaceSlugs?, metadata? }` and responds with the synthesized document record.
- Folder management (`POST /v1/document/create-folder`, `DELETE /v1/document/remove-folder`) accepts `{ name }` or `{ folder }` respectively and returns `{ success, error }`.
- File moves (`POST /v1/document/move-files`) expect `{ files: string[], targetFolder?: string }` and return `{ success, moved, errors }`.
- Listings (`GET /v1/documents`, `/v1/documents/folder/:folderName`) return arrays of document metadata filtered by folder.
- Metadata helpers (`GET /v1/document/accepted-file-types`, `/v1/document/metadata-schema`) expose supported ingestion schemas as JSON.
- `GET /v1/document/:docName` returns the stored metadata for an individual document including local path, title, and workspace associations.

## `api/embed/index.js`

| Method | Path |
| --- | --- |
| `GET` | `/v1/embed` |
| `GET` | `/v1/embed/:embedUuid/chats` |
| `GET` | `/v1/embed/:embedUuid/chats/:sessionUuid` |
| `POST` | `/v1/embed/new` |
| `POST` | `/v1/embed/:embedUuid` |
| `DELETE` | `/v1/embed/:embedUuid` |

**Contract summary:**
- All endpoints require the developer API key middleware.
- `GET /v1/embed` lists embed configurations available to the token as `{ embeds }`.
- `GET /v1/embed/:embedUuid/chats` and `/v1/embed/:embedUuid/chats/:sessionUuid` enumerate embed chat transcripts; optional query parameters page through sessions. Responses return `{ chats }`.
- `POST /v1/embed/new` accepts `{ name, workspaceSlugs, model, settings }` and provisions a new embed configuration, returning `{ embed }`.
- `POST /v1/embed/:embedUuid` updates embed metadata with the same schema as creation and returns the updated record.
- `DELETE /v1/embed/:embedUuid` removes an embed configuration and associated chats, responding with `{ success }`.

## `api/openai/index.js`

| Method | Path |
| --- | --- |
| `GET` | `/v1/openai/models` |
| `POST` | `/v1/openai/chat/completions` |
| `POST` | `/v1/openai/embeddings` |
| `GET` | `/v1/openai/vector_stores` |

**Contract summary:**
- All routes require the developer API key.
- `GET /v1/openai/models` proxies the configured LLM provider and returns `{ models }` including categories and token limits.
- `POST /v1/openai/chat/completions` mirrors OpenAI’s Chat Completions payload (`model`, `messages`, `stream`, `tools`, etc.) and returns the provider response (streamed or buffered) along with usage metadata.
- `POST /v1/openai/embeddings` expects `{ model, input }` and returns embedding vectors for each input item.
- `GET /v1/openai/vector_stores` exposes workspace vector store summaries (namespace, counts) for automation.

## `api/system/index.js`

| Method | Path |
| --- | --- |
| `GET` | `/v1/system/env-dump` |
| `GET` | `/v1/system` |
| `GET` | `/v1/system/vector-count` |
| `POST` | `/v1/system/update-env` |
| `GET` | `/v1/system/export-chats` |
| `DELETE` | `/v1/system/remove-documents` |

**Contract summary:**
- `GET /v1/system/env-dump` writes the current environment configuration to disk for debugging (no-op in production).
- `GET /v1/system` returns `{ settings }` capturing install version, storage paths, provider selections, and feature flags.
- `GET /v1/system/vector-count` returns `{ count }` aggregated from the configured vector adapter.
- `GET /v1/system/export-chats` streams a workspace archive according to query parameters `workspace`, `format`, and optional date range.
- `POST /v1/system/update-env` accepts `{ key, value }` or `{ updates: [{ key, value }] }` and persists environment changes, returning `{ success, restartRequired }`.
- `DELETE /v1/system/remove-documents` accepts `{ workspaceSlugs?, documentIds? }` and purges associations before returning `{ success, error }`.

## `api/userManagement/index.js`

| Method | Path |
| --- | --- |
| `GET` | `/v1/users` |
| `GET` | `/v1/users/:id/issue-auth-token` |

**Contract summary:**
- `GET /v1/users` returns `{ users }` along with roles for automation scripts.
- `GET /v1/users/:id/issue-auth-token` issues a temporary JWT for delegated automation. Optional query `expiresIn` controls TTL. Response `{ token, user }`.

## `api/workspace/index.js`

| Method | Path |
| --- | --- |
| `POST` | `/v1/workspace/new` |
| `GET` | `/v1/workspaces` |
| `GET` | `/v1/workspace/:slug` |
| `DELETE` | `/v1/workspace/:slug` |
| `POST` | `/v1/workspace/:slug/update` |
| `GET` | `/v1/workspace/:slug/chats` |
| `POST` | `/v1/workspace/:slug/update-embeddings` |
| `POST` | `/v1/workspace/:slug/update-pin` |
| `POST` | `/v1/workspace/:slug/chat` |
| `POST` | `/v1/workspace/:slug/stream-chat` |
| `POST` | `/v1/workspace/:slug/vector-search` |

**Contract summary:**
- All endpoints require a developer API key and mirror workspace UI contracts.
- `POST /v1/workspace/new` accepts `{ name }` (plus optional template metadata) and returns `{ workspace, error }`.
- `GET /v1/workspaces` supports optional query filters (search text, include archived) and returns `{ workspaces }`.
- `GET /v1/workspace/:slug` returns workspace metadata including provider overrides, suggestions, and onboarding status.
- `DELETE /v1/workspace/:slug` removes the workspace and returns `{ success, error }`.
- `POST /v1/workspace/:slug/update` patches workspace settings according to the JSON body.
- `GET /v1/workspace/:slug/chats` returns paginated chat history using query parameters `page` and `limit`.
- Chatting endpoints (`POST /v1/workspace/:slug/chat`, `/v1/workspace/:slug/stream-chat`) accept the same payload as UI chat requests (`message`, `context`, `mode`, attachments) and return chat records or streaming responses.
- Vector maintenance (`POST /v1/workspace/:slug/update-embeddings`, `/v1/workspace/:slug/vector-search`) accept payloads describing document IDs or search query text and return status/results.
- `POST /v1/workspace/:slug/update-pin` accepts `{ chatId, pinned }` and returns the updated pin state.

## `api/workspaceThread/index.js`

| Method | Path |
| --- | --- |
| `POST` | `/v1/workspace/:slug/thread/new` |
| `POST` | `/v1/workspace/:slug/thread/:threadSlug/update` |
| `DELETE` | `/v1/workspace/:slug/thread/:threadSlug` |
| `GET` | `/v1/workspace/:slug/thread/:threadSlug/chats` |
| `POST` | `/v1/workspace/:slug/thread/:threadSlug/chat` |
| `POST` | `/v1/workspace/:slug/thread/:threadSlug/stream-chat` |

**Contract summary:**
- Threads inherit developer API authentication.
- `POST /v1/workspace/:slug/thread/new` accepts `{ name, description?, initialMessage? }` and returns `{ thread }`.
- `GET /v1/workspace/:slug/thread/:threadSlug/chats` returns paginated chat history for the thread via query parameters.
- Chatting endpoints (`POST /v1/workspace/:slug/thread/:threadSlug/chat`, `/stream-chat`) mirror the main workspace chat payload (`message`, `mode`, `toolChoice`, attachments) and return conversation responses.
- `POST /v1/workspace/:slug/thread/:threadSlug/update` accepts partial thread metadata (title, archived flag, pinned) and returns the updated record.
- `DELETE /v1/workspace/:slug/thread/:threadSlug` removes the thread and its chats, returning `{ success }`.

## `browserExtension.js`

| Method | Path |
| --- | --- |
| `GET` | `/browser-extension/check` |
| `DELETE` | `/browser-extension/disconnect` |
| `GET` | `/browser-extension/workspaces` |
| `POST` | `/browser-extension/embed-content` |
| `POST` | `/browser-extension/upload-content` |
| `GET` | `/browser-extension/api-keys` |
| `POST` | `/browser-extension/api-keys/new` |
| `DELETE` | `/browser-extension/api-keys/:id` |

**Contract summary:**
- All routes use either the browser extension API key guard (`validBrowserExtensionApiKey`) or an authenticated admin session for key management.
- `GET /browser-extension/check` — Validates the presented key and returns `{ connected, workspaces, apiKeyId }` scoped to the caller.
- `DELETE /browser-extension/disconnect` — Revokes the API key and returns `{ success }`.
- `GET /browser-extension/workspaces` — Lists accessible workspaces as `{ workspaces }` based on the key and user association.
- `POST /browser-extension/embed-content` — Accepts `{ workspaceId, textContent, metadata }`. Pushes the content through the collector and embeds it into the workspace, returning `{ success }` or `{ error }`.
- `POST /browser-extension/upload-content` — Accepts `{ textContent, metadata }` to send material to the collector without embedding, returning `{ success }`.
- `GET /browser-extension/api-keys` — Admin-only endpoint returning `{ success, apiKeys }` for management UI.
- `POST /browser-extension/api-keys/new` — Admin-only endpoint issuing a fresh browser extension API key and returning `{ apiKey }`.
- `DELETE /browser-extension/api-keys/:id` — Admin-only endpoint deleting a key and returning `{ success, error? }`.

## `chat.js`

| Method | Path |
| --- | --- |
| `POST` | `/workspace/:slug/stream-chat` |
| `POST` | `/workspace/:slug/thread/:threadSlug/stream-chat` |

**Contract summary:**
- Streaming chat endpoints for workspaces and threads reuse the SSE/WS contract from `chat.js`.
- `POST /workspace/:slug/stream-chat` — Accepts the standard chat payload (`message`, `mode`, optional `attachments`, `toolChoice`, `responseMode`) and streams incremental responses.
- `POST /workspace/:slug/thread/:threadSlug/stream-chat` — Same contract as above but constrained to a specific thread; includes thread metadata in responses.

## `communityHub.js`

| Method | Path |
| --- | --- |
| `GET` | `/community-hub/settings` |
| `POST` | `/community-hub/settings` |
| `GET` | `/community-hub/explore` |
| `POST` | `/community-hub/item` |
| `POST` | `/community-hub/apply` |
| `POST` | `/community-hub/import` |
| `GET` | `/community-hub/items` |
| `POST` | `/community-hub/:communityHubItemType/create` |

**Contract summary:**
- All routes require a validated admin/manager session.
- `GET /community-hub/settings` / `POST /community-hub/settings` — Fetch and persist hub configuration such as authentication tokens, proxies, and toggles.
- `GET /community-hub/explore` — Returns `{ items }` fetched from the Mintplex community catalog based on query filters.
- `POST /community-hub/item` — Accepts `{ hubId }` to fetch detailed metadata for a catalog item.
- `POST /community-hub/apply` — Installs hub content (agents, prompts, plugins) using `{ hubId, workspaceSlug? }` and returns `{ success, details }`.
- `POST /community-hub/import` — Accepts `{ file }` or `{ url }` payloads referencing exported bundles and returns `{ success, imported }`.
- `GET /community-hub/items` — Lists already imported items for the installation.
- `POST /community-hub/:communityHubItemType/create` — Creates local items (e.g., prompts, flows) from a provided payload and returns `{ item }`.

## `document.js`

| Method | Path |
| --- | --- |
| `POST` | `/document/create-folder` |
| `POST` | `/document/move-files` |

**Contract summary:**
- Workspace document management endpoints require `validatedRequest` plus admin/manager privileges.
- `POST /document/create-folder` — Accepts `{ workspaceSlug, folderName }` and returns `{ success, folder }`.
- `POST /document/move-files` — Accepts `{ workspaceSlug, files: string[], targetFolder }` and returns `{ success, moved, errors }`.

## `embed/index.js`

| Method | Path |
| --- | --- |
| `POST` | `/embed/:embedId/stream-chat` |
| `GET` | `/embed/:embedId/:sessionId` |
| `DELETE` | `/embed/:embedId/:sessionId` |

**Contract summary:**
- Embed chat runtime endpoints use `validatedRequest` and ensure the caller can access the embed.
- `POST /embed/:embedId/stream-chat` — Accepts `{ message, sessionUuid?, metadata? }` and streams an embed chat response using the configured model.
- `GET /embed/:embedId/:sessionId` — Returns `{ chat }` transcript metadata for a prior embed session.
- `DELETE /embed/:embedId/:sessionId` — Deletes an embed chat session and returns `{ success }`.

## `embedManagement.js`

| Method | Path |
| --- | --- |
| `GET` | `/embeds` |
| `POST` | `/embeds/new` |
| `POST` | `/embed/update/:embedId` |
| `DELETE` | `/embed/:embedId` |
| `POST` | `/embed/chats` |
| `DELETE` | `/embed/chats/:chatId` |

**Contract summary:**
- `GET /embeds` — Lists all embeds (`{ embeds }`) available to the authenticated user.
- `POST /embeds/new` — Accepts `{ name, workspaceIds, model, instructions?, throttling? }` and returns `{ embed }`.
- `POST /embed/update/:embedId` — Same contract as creation for updates; returns updated embed metadata.
- `DELETE /embed/:embedId` — Removes the embed configuration (`{ success }`).
- `POST /embed/chats` — Accepts `{ embedId, sessionUuid, message }` for internal moderation tooling and returns the stored chat record.
- `DELETE /embed/chats/:chatId` — Deletes a stored embed chat message (`{ success }`).

## `experimental/liveSync.js`

| Method | Path |
| --- | --- |
| `POST` | `/experimental/toggle-live-sync` |
| `GET` | `/experimental/live-sync/queues` |
| `POST` | `/workspace/:slug/update-watch-status` |

**Contract summary:**
- `POST /experimental/toggle-live-sync` — Accepts `{ enabled: boolean }` to enable/disable live sync experiments globally and returns `{ enabled }`.
- `GET /experimental/live-sync/queues` — Returns live sync queue metrics (`{ queues, workers }`).
- `POST /workspace/:slug/update-watch-status` — Accepts `{ enabled: boolean }` to toggle live sync on a specific workspace and returns `{ success }`.

## `extensions/index.js`

| Method | Path |
| --- | --- |
| `POST` | `/ext/:repo_platform/branches` |
| `POST` | `/ext/:repo_platform/repo` |
| `POST` | `/ext/youtube/transcript` |
| `POST` | `/ext/confluence` |
| `POST` | `/ext/website-depth` |
| `POST` | `/ext/drupalwiki` |
| `POST` | `/ext/obsidian/vault` |

**Contract summary:**
- Extension ingestion endpoints validate admin permissions and proxy collector jobs.
- Git sources (`POST /ext/:repo_platform/repo`, `/ext/:repo_platform/branches`) accept repository metadata (URL, branch, token) and enqueue synchronization jobs.
- Content connectors (`POST /ext/youtube/transcript`, `/ext/confluence`, `/ext/website-depth`, `/ext/drupalwiki`, `/ext/obsidian/vault`) accept source-specific payloads (URLs, auth tokens, recursion depth) and return collector job receipts indicating `{ success, jobId }`.

## `health/index.js`

| Method | Path |
| --- | --- |
| `GET` | `/health` |
| `GET` | `/health/ready` |
| `GET` | `/health/live` |

**Contract summary:**
- `GET /health` — Returns `{ status, timestamp, uptime, version, components: { database } }` with HTTP 200 or 503 when the database probe fails.
- `GET /health/ready` — Adds queue backend and concurrency circuit checks to the response and returns 200/503 based on readiness.
- `GET /health/live` — Returns immediate process liveness metadata (`{ status: "ok", process: { pid } }`).

## `invite.js`

| Method | Path |
| --- | --- |
| `GET` | `/invite/:code` |
| `POST` | `/invite/:code` |

**Contract summary:**
- `GET /invite/:code` — Returns invite metadata (`{ invite }`) or 404 if invalid.
- `POST /invite/:code` — Accepts `{ username, password }` for invite redemption, provisions the user, and returns `{ success, token, user, error }`.

## `mcpServers.js`

| Method | Path |
| --- | --- |
| `GET` | `/mcp-servers/force-reload` |
| `GET` | `/mcp-servers/list` |
| `POST` | `/mcp-servers/toggle` |
| `POST` | `/mcp-servers/delete` |

**Contract summary:**
- All MCP server routes require admin access.
- `GET /mcp-servers/force-reload` — Triggers the MCP adapter refresh and returns `{ success }`.
- `GET /mcp-servers/list` — Returns `{ servers }` including connection status and capabilities.
- `POST /mcp-servers/toggle` — Accepts `{ serverId, enabled }` to toggle a server and returns `{ server }`.
- `POST /mcp-servers/delete` — Accepts `{ serverId }` and removes the configuration (`{ success }`).

## `metrics.js`

| Method | Path |
| --- | --- |
| `GET` | `/metrics` |
| `GET` | `/metrics/prometheus` |

**Contract summary:**
- `GET /metrics` — Requires a valid metrics API key and returns JSON metrics snapshot.
- `GET /metrics/prometheus` — Returns Prometheus-formatted metrics for scraping; no authentication required when network restricted.

## `mobile/index.js`

| Method | Path |
| --- | --- |
| `GET` | `/mobile/devices` |
| `POST` | `/mobile/update/:id` |
| `DELETE` | `/mobile/:id` |
| `GET` | `/mobile/connect-info` |
| `GET` | `/mobile/auth` |
| `POST` | `/mobile/register` |
| `POST` | `/mobile/send/:command` |

**Contract summary:**
- Device management endpoints require authenticated admin sessions unless guarded by device tokens.
- `GET /mobile/devices` — Returns `{ devices }` registered with the installation.
- `POST /mobile/update/:id` — Accepts `{ name?, settings? }` to update device metadata and returns `{ device }`.
- `DELETE /mobile/:id` — Removes a device registration and returns `{ success }`.
- `GET /mobile/connect-info` — Returns provisioning instructions (`{ qrCode, token }`).
- `GET /mobile/auth` — Validates a device token via middleware and returns `{ device, user }` for the app.
- `POST /mobile/register` — Accepts `{ name, platform, workspaceIds? }` to register a device and returns `{ device, token }`.
- `POST /mobile/send/:command` — Accepts `{ payload }` commands such as `test-notification`; returns `{ success }`.

## `system.js`

| Method | Path |
| --- | --- |
| `GET` | `/ping` |
| `GET` | `/migrate` |
| `GET` | `/env-dump` |
| `GET` | `/setup-complete` |
| `GET` | `/system/check-token` |
| `POST` | `/request-token` |
| `GET` | `/request-token/sso/simple` |
| `POST` | `/system/recover-account` |
| `POST` | `/system/reset-password` |
| `GET` | `/system/system-vectors` |
| `DELETE` | `/system/remove-document` |
| `DELETE` | `/system/remove-documents` |
| `DELETE` | `/system/remove-folder` |
| `GET` | `/system/local-files` |
| `GET` | `/system/document-processing-status` |
| `GET` | `/system/accepted-document-types` |
| `POST` | `/system/update-env` |
| `POST` | `/system/update-password` |
| `POST` | `/system/enable-multi-user` |
| `GET` | `/system/multi-user-mode` |
| `GET` | `/system/logo` |
| `GET` | `/system/footer-data` |
| `GET` | `/system/support-email` |
| `GET` | `/system/custom-app-name` |
| `GET` | `/system/pfp/:id` |
| `POST` | `/system/upload-pfp` |
| `DELETE` | `/system/remove-pfp` |
| `POST` | `/system/upload-logo` |
| `GET` | `/system/is-default-logo` |
| `GET` | `/system/remove-logo` |
| `GET` | `/system/welcome-messages` |
| `POST` | `/system/set-welcome-messages` |
| `GET` | `/system/api-keys` |
| `POST` | `/system/generate-api-key` |
| `DELETE` | `/system/api-key/:id` |
| `POST` | `/system/custom-models` |
| `POST` | `/system/event-logs` |
| `DELETE` | `/system/event-logs` |
| `POST` | `/system/workspace-chats` |
| `DELETE` | `/system/workspace-chats/:id` |
| `GET` | `/system/export-chats` |
| `POST` | `/system/user` |
| `GET` | `/system/slash-command-presets` |
| `POST` | `/system/slash-command-presets` |
| `POST` | `/system/slash-command-presets/:slashCommandId` |
| `DELETE` | `/system/slash-command-presets/:slashCommandId` |
| `GET` | `/system/prompt-variables` |
| `POST` | `/system/prompt-variables` |
| `PUT` | `/system/prompt-variables/:id` |
| `DELETE` | `/system/prompt-variables/:id` |
| `POST` | `/system/validate-sql-connection` |

**Contract summary:**
- Basic health & bootstrap:
  - `GET /ping` returns `{ online: true }` for load balancers.
  - `GET /migrate` is a no-op used by deployment scripts to verify availability.
  - `GET /env-dump` writes `.env` contents to disk in production for debugging.
  - `GET /setup-complete` returns `{ results }` summarizing current `SystemSettings`.
- Authentication & tokens:
  - `GET /system/check-token` validates the active session (enforcing suspension rules in multi-user mode).
  - `POST /request-token` handles username/password login, returning `{ token, user, valid, message }`.
  - `GET /request-token/sso/simple` returns SSO redirect metadata when SimpleSSO is enabled.
  - Password recovery endpoints (`POST /system/recover-account`, `/system/reset-password`) accept `{ username }` or `{ token, password }` and return success/error states.
  - `POST /system/update-password` allows authenticated users to rotate their password with `{ currentPassword, newPassword }`.
- Data & storage utilities:
  - `GET /system/system-vectors` returns aggregate vector counts and namespaces.
  - Document cleanup endpoints (`DELETE /system/remove-document`, `/system/remove-documents`, `/system/remove-folder`) accept identifiers for documents/folders to purge from storage and embeddings.
  - `GET /system/local-files` returns browseable filesystem metadata gated by environment flags.
  - `GET /system/document-processing-status` surfaces collector connectivity state.
  - `GET /system/accepted-document-types` lists ingestion MIME support.
  - `POST /system/update-env` and `POST /system/validate-sql-connection` accept environment updates or database credentials and return `{ success, message }`.
- Multi-user configuration & branding:
  - `POST /system/enable-multi-user` toggles multi-user mode using `{ enabled: boolean }`.
  - `GET /system/multi-user-mode` returns `{ enabled }`.
  - Logo endpoints (`GET /system/logo`, `POST /system/upload-logo`, `GET /system/is-default-logo`, `GET /system/remove-logo`) manage UI branding assets, responding with binary data or `{ success }`.
  - Footer/support/app name endpoints (`GET /system/footer-data`, `/system/support-email`, `/system/custom-app-name`) expose configured values; updates flow through admin endpoints.
  - Profile photo endpoints (`GET /system/pfp/:id`, `POST /system/upload-pfp`, `DELETE /system/remove-pfp`) stream binary images or accept multipart uploads.
- Welcome experience:
  - `GET /system/welcome-messages` returns stored onboarding prompts.
  - `POST /system/set-welcome-messages` accepts `{ messages: [...] }` to update them.
- API keys & custom providers:
  - `GET /system/api-keys` lists system API keys; `POST /system/generate-api-key` creates one; `DELETE /system/api-key/:id` revokes it.
  - `POST /system/custom-models` accepts `{ provider, models }` JSON to persist custom LLM/embedding definitions.
- Logging & exports:
  - `POST /system/event-logs` queries event logs based on filters `{ type, range }`; `DELETE /system/event-logs` purges log tables.
  - `POST /system/workspace-chats` exports chat transcripts according to filters; `DELETE /system/workspace-chats/:id` deletes archived exports.
  - `GET /system/export-chats` streams exported archives (CSV/JSON) for download.
- User management:
  - `POST /system/user` creates the first admin user during setup using `{ username, password }`.
- Prompting & automation artifacts:
  - Slash command endpoints (`GET/POST/POST/:id/DELETE /system/slash-command-presets...`) list, create, update, and delete preset definitions via JSON bodies describing commands and payloads.
  - Prompt variable endpoints (`GET /system/prompt-variables`, `POST /system/prompt-variables`, `PUT /system/prompt-variables/:id`, `DELETE /system/prompt-variables/:id`) manage templated variables via bodies `{ key, value, description }` and return `{ variables }` or `{ success }`.

## `utils.js`

| Method | Path |
| --- | --- |
| `GET` | `/utils/metrics` |

**Contract summary:**
- `GET /utils/metrics` — Admin-authenticated endpoint returning queue depth, concurrency circuit state, and worker metrics as `{ metrics }` for the dashboard.

## `workspaceThreads.js`

| Method | Path |
| --- | --- |
| `POST` | `/workspace/:slug/thread/new` |
| `GET` | `/workspace/:slug/threads` |
| `DELETE` | `/workspace/:slug/thread/:threadSlug` |
| `DELETE` | `/workspace/:slug/thread-bulk-delete` |
| `GET` | `/workspace/:slug/thread/:threadSlug/chats` |
| `POST` | `/workspace/:slug/thread/:threadSlug/update` |
| `DELETE` | `/workspace/:slug/thread/:threadSlug/delete-edited-chats` |
| `POST` | `/workspace/:slug/thread/:threadSlug/update-chat` |

**Contract summary:**
- All routes require workspace access checks through `validWorkspaceSlug` and role guards when multi-user mode is active.
- `POST /workspace/:slug/thread/new` — Accepts `{ name, description?, parentChatId? }` and returns `{ thread }`.
- `GET /workspace/:slug/threads` — Returns paginated thread summaries for the workspace.
- `DELETE /workspace/:slug/thread/:threadSlug` — Deletes a thread and associated chats (`{ success }`).
- `DELETE /workspace/:slug/thread-bulk-delete` — Accepts `{ threadSlugs: string[] }` and removes them in batch.
- `GET /workspace/:slug/thread/:threadSlug/chats` — Returns chat history for the thread.
- `POST /workspace/:slug/thread/:threadSlug/update` — Accepts `{ title?, archived?, pinned? }` to update metadata and returns the mutated thread.
- `DELETE /workspace/:slug/thread/:threadSlug/delete-edited-chats` — Removes all edited responses from a thread (used for compliance).
- `POST /workspace/:slug/thread/:threadSlug/update-chat` — Accepts `{ chatId, content }` to replace a chat message and returns `{ chat }`.

## `workspaces.js`

| Method | Path |
| --- | --- |
| `POST` | `/workspace/new` |
| `POST` | `/workspace/:slug/update` |
| `POST` | `/workspace/:slug/upload` |
| `POST` | `/workspace/:slug/upload-link` |
| `POST` | `/workspace/:slug/update-embeddings` |
| `DELETE` | `/workspace/:slug` |
| `DELETE` | `/workspace/:slug/reset-vector-db` |
| `GET` | `/workspaces` |
| `GET` | `/workspace/:slug` |
| `GET` | `/workspace/:slug/chats` |
| `DELETE` | `/workspace/:slug/delete-chats` |
| `DELETE` | `/workspace/:slug/delete-edited-chats` |
| `POST` | `/workspace/:slug/update-chat` |
| `POST` | `/workspace/:slug/chat-feedback/:chatId` |
| `GET` | `/workspace/:slug/suggested-messages` |
| `POST` | `/workspace/:slug/suggested-messages` |
| `POST` | `/workspace/:slug/update-pin` |
| `GET` | `/workspace/:slug/tts/:chatId` |
| `GET` | `/workspace/:slug/pfp` |
| `POST` | `/workspace/:slug/upload-pfp` |
| `DELETE` | `/workspace/:slug/remove-pfp` |
| `POST` | `/workspace/:slug/thread/fork` |
| `PUT` | `/workspace/workspace-chats/:id` |
| `POST` | `/workspace/:slug/upload-and-embed` |
| `DELETE` | `/workspace/:slug/remove-and-unembed` |
| `GET` | `/workspace/:slug/prompt-history` |
| `DELETE` | `/workspace/:slug/prompt-history` |
| `DELETE` | `/workspace/prompt-history/:id` |
| `POST` | `/workspace/search` |

**Contract summary:**
- All endpoints require authenticated sessions and enforce workspace-specific access using `validatedRequest`, role checks, and ingestion rate limiting where appropriate.
- Provisioning & configuration:
  - `POST /workspace/new` creates a workspace from `{ name, onboardingComplete? }`.
  - `POST /workspace/:slug/update` updates settings (LLM provider, embedder, display name) based on the JSON body.
  - `DELETE /workspace/:slug` removes the workspace, cascades document/chat/vectors, and returns `{ success }`.
  - `DELETE /workspace/:slug/reset-vector-db` resets the namespace in the configured vector DB and returns `{ success }`.
- Ingestion:
  - `POST /workspace/:slug/upload` handles multipart file uploads (with `handleFileUpload`) and enqueues collector processing.
  - `POST /workspace/:slug/upload-link` accepts `{ url, options }` to ingest remote content.
  - `POST /workspace/:slug/upload-and-embed` accepts `{ documentPaths }` to embed previously uploaded files.
  - `POST /workspace/:slug/update-embeddings` accepts `{ documentIds }` to re-embed documents and returns status.
  - `DELETE /workspace/:slug/remove-and-unembed` accepts `{ documentPaths }` to purge documents and vectors.
- Chat lifecycle:
  - `GET /workspaces` returns workspace list; `GET /workspace/:slug` returns metadata.
  - `GET /workspace/:slug/chats` returns paginated chat history; `POST /workspace/:slug/update-chat` edits past chats; `DELETE /workspace/:slug/delete-chats` removes chats in bulk; `DELETE /workspace/:slug/delete-edited-chats` purges edited responses.
  - `PUT /workspace/workspace-chats/:id` updates saved chat attributes (title, pinned) and returns `{ chat }`.
  - `POST /workspace/:slug/chat-feedback/:chatId` accepts `{ liked: boolean }` to capture user feedback.
  - `POST /workspace/:slug/update-pin` toggles chat pinning.
  - `GET /workspace/:slug/tts/:chatId` streams audio generated by the configured TTS provider for a chat message.
- Assets & personalization:
  - `GET /workspace/:slug/pfp`, `POST /workspace/:slug/upload-pfp`, `DELETE /workspace/:slug/remove-pfp` manage workspace avatars.
  - `GET /workspace/:slug/suggested-messages` / `POST /workspace/:slug/suggested-messages` manage AI-suggested prompts.
  - `GET /workspace/:slug/prompt-history`, `DELETE /workspace/:slug/prompt-history`, `DELETE /workspace/prompt-history/:id` manage saved prompts.
  - `POST /workspace/:slug/thread/fork` clones a thread into a new workspace context using `{ threadSlug }` and returns the new slug.
- Search & retrieval:
  - `POST /workspace/:slug/update-embeddings` & `/workspace/:slug/vector-search` (API section) provide vector operations; `POST /workspace/search` performs combined workspace/thread search using `{ query }` and returns results.

## `workspacesParsedFiles.js`

| Method | Path |
| --- | --- |
| `GET` | `/workspace/:slug/parsed-files` |
| `DELETE` | `/workspace/:slug/delete-parsed-files` |
| `POST` | `/workspace/:slug/embed-parsed-file/:fileId` |
| `POST` | `/workspace/:slug/parse` |

**Contract summary:**
- Parsed file management endpoints let administrators control staged collector outputs.
- `GET /workspace/:slug/parsed-files` — Returns `{ files }` awaiting embedding for the workspace.
- `POST /workspace/:slug/parse` — Accepts `{ sourcePaths }` to trigger parsing on raw uploads and returns job receipts.
- `POST /workspace/:slug/embed-parsed-file/:fileId` — Embeds a specific parsed file, returning `{ success }`.
- `DELETE /workspace/:slug/delete-parsed-files` — Accepts `{ fileIds }` to purge staged files and returns `{ success }`.

