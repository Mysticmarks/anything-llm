---
version: 1.1.0
status: Active
last_updated: 2024-06-01
owners:
  - Mintplex Labs Core Maintainers
---

# AnythingLLM System Reference Document (SRD)

## Purpose
This System Reference Document (SRD) provides a canonical snapshot of the AnythingLLM platform. It defines the architecture, critical data models, agent orchestration flow, ingestion lifecycle, user interface journeys, deployment options, and the governance process that keeps the SRD synchronized with code changes.

## Architecture Overview
### Logical Architecture
AnythingLLM ships as a polyrepo-style monorepo with three primary runtime services and a rich client experience.

- **Frontend (`frontend/`)** — Vite-powered React application for workspace, agent, and content management.
- **Server (`server/`)** — Node.js Express API orchestrating authentication, workspace configuration, vector database abstraction, agent execution, and long-running job scheduling.
- **Collector (`collector/`)** — Dedicated ingestion service that normalizes raw files, web captures, and external connectors into structured workspace documents.
- **Shared storage** — SQLite (default) or PostgreSQL for relational data, LanceDB/PGVector/etc. for embeddings, and object storage for raw document artifacts.
- **Integrations** — External LLM providers, MCP-compatible tools, and third-party vector databases configured per workspace.

The [component diagram](./diagrams/system-components.md) visualizes module boundaries and integration points.

### Service Interactions
User actions are funneled through the frontend, which authenticates against the server and invokes API endpoints. The server orchestrates requests across the agent runtime, vector adapters, and ingestion queues, delegating heavy lifting to the collector where needed. Streaming responses flow back to the frontend to drive live chat updates.

The [agent orchestration sequence](./diagrams/agent-orchestration-sequence.md) details this choreography.

### Data Flow Summary
1. **Session establishment** — Frontend or browser extension clients exchange credentials (session cookie, API key, or invite code) with `/request-token` or `/v1/auth`. Successful logins hydrate the session store with user, workspace, and feature flag context.
2. **Request routing** — Authenticated calls land on Express routers grouped by domain (`workspaces`, `agentFlows`, `embed`, `mobile`, etc.). Middlewares enforce rate limits, role-based access, and request validation before controllers execute.
3. **Domain execution** — Controllers coordinate Prisma models, vector adapters, MCP bridges, and concurrency primitives (`chatQueue`, `ingestionQueue`, `agentFlowQueue`) to execute the workload. Long-running ingestion jobs spill to BullMQ workers via `server/jobs`.
4. **Persistence** — Workspace, document, and telemetry updates persist through Prisma transactions while embedding payloads are stored in the configured vector database namespace.
5. **Delivery** — Responses surface through REST JSON, server-sent events, or WebSocket streams. Observability hooks emit metrics (`/metrics`, `/metrics/prometheus`) and event logs for the runbooks linked later in this SRD.

### Concurrency & Scaling
- **Process supervision** — `server/index.js` launches an Express worker per CPU (configurable through `supervisor.js`) and restarts unhealthy workers with a bounded back-off. Signal handlers drain workers to keep Prisma and Redis connections consistent.
- **Async queues** — The server owns three in-memory `AsyncQueue` primitives backed by Prometheus instrumentation:
  - `chatQueue` throttles concurrent streamed chat completions (`CHAT_QUEUE_CONCURRENCY`, default 4).
  - `ingestionQueue` coordinates synchronous embedding when Redis/BullMQ are offline (`INGESTION_QUEUE_CONCURRENCY`, default 3).
  - `agentFlowQueue` serializes flow executions to guarantee ordering and bounded tool usage (`AGENT_FLOW_QUEUE_CONCURRENCY`, default 2).
- **Background workers** — When Redis is available, `server/jobs` spins up BullMQ worker_threads (`embeddingWorker.js`) to process the `embedding-jobs` queue with concurrency 2. Workers emit readiness events so process supervisors can gate startup.
- **Circuit breakers & rate limiters** — `server/utils/concurrency` exposes per-queue breakers that open after repeated failures and surface in readiness probes. `server/middleware/rateLimiters` applies request-per-minute limits across ingestion, chat, and invite endpoints to protect shared resources.

Refer to [`docs/server-concurrency.md`](./server-concurrency.md) for the deeper design rationale and benchmarking methodology.

## Data Models
### Relational Schema
Key relational entities live in `server/prisma/schema.prisma` and its generated client:

- **User** — Authentication credentials, permissions, theme preferences.
- **Workspace** — Logical grouping for documents, vector indexes, and chat history isolation.
- **Document & DocumentChunk** — Metadata and chunked payload pointers for ingested content.
- **Agent & AgentTool** — Declarative definitions for automated workflows and tool availability.
- **Thread & Message** — Conversation transcripts with model parameters and streaming metadata.

### Vector Storage
The server abstracts LanceDB (default) with optional providers via `server/services/vector/*`. Embeddings attach to `DocumentChunk` records and feed retrieval augmented generation (RAG) flows. Namespace names map 1:1 with workspace slugs so resets and exports can target precise tenants. When Pinecone, Qdrant, PGVector, or Weaviate are configured, provider-specific adapters maintain API parity while emitting shared metrics counters.

### Configuration Artifacts
Per-workspace JSON/YAML settings stored under `server/storage` and user-provided `.env` files govern provider credentials, rate limits, tool activation, and MCP endpoints.

### Audit, Telemetry, and Event Logs
- **EventLogs** (`server/models/eventLogs.js`) capture administrative actions (user invites, workspace deletion) and back office flows (failed logins) for incident reviews.
- **Telemetry** (`server/models/telemetry.js`) batches anonymised analytics when enabled. Each major endpoint (workspace CRUD, agent flow execution, embeds) emits events used by runbooks and the release dashboard.
- **Metrics registry** (`server/utils/metrics/registry.js`) publishes queue depth, breaker state, request latencies, and resource gauges. The Prometheus exporter integrates with the Kubernetes Helm chart documented under `docs/runbooks/observability.md`.

## Provider Integrations
AnythingLLM allows per-workspace selection of the following providers. Contracts and configuration live in `.env` and UI modals referenced below.

| Capability | Providers | Configuration Surface |
| --- | --- | --- |
| Large Language Models | OpenAI, Anthropic, Google Vertex AI, Azure OpenAI, custom API adapters | `server/utils/providers` with workspace overrides stored in `server/storage/workspaces/*.json`. |
| Embedding Engines | OpenAI, Cohere, HuggingFace Inference, local transformers, vector DB-native embeddings | `.env` keys (`EMBEDDING_ENGINE`, `EMBEDDING_MODEL`) and workspace overrides via `/workspace/:slug/update`. |
| Vector Databases | LanceDB (default), Qdrant, Pinecone, PGVector, Weaviate | `.env` keys (`VECTOR_DB`, provider-specific tokens) and runtime adapters in `server/services/vector`. |
| Text-to-Speech | Native browser voices, ElevenLabs, Azure Speech | Configured through `/system/set-welcome-messages` UI and stored in `SystemSettings`. |
| MCP / Tooling | Model Context Protocol servers, community plugins, browser extension actions | Registered via `/mcp-servers/*`, `/admin/v1/agent-plugins/*`, and community hub endpoints; manifests stored in Prisma tables. |

Provider fallbacks ensure that when a workspace inherits `inherit` values from the global configuration the server consults `SystemSettings` before defaulting to `.env`.

## Agent Orchestration
### Runtime Components
Agents execute inside the server service, leveraging:

- **Prompt composers** at `server/utils/agents` for instruction assembly.
- **Tool routers** that register capabilities from MCP servers, web actions, and workspace automations.
- **Response handlers** streaming tokens to clients while persisting state.

### Execution Flow
1. Frontend sends a task with workspace, agent, and optional tool directives.
2. Server normalizes the request, hydrates workspace context, and loads agent-specific policies.
3. Vector layer retrieves relevant DocumentChunks and tool metadata.
4. Agent runtime constructs prompts and invokes the selected LLM provider.
5. Tool calls are resolved iteratively until the agent emits a final response.
6. Conversation artifacts are saved to both relational and vector stores for replay and retrieval.

Refer to the [sequence diagram](./diagrams/agent-orchestration-sequence.md) for message-level detail.

## Ingestion Pipelines
### Sources
- File uploads (drag-and-drop, bulk dropzone).
- Web URLs and sitemap crawls via the collector.
- API ingestions initiated by automations.

### Pipeline Stages
1. **Normalization** — Collector converts raw inputs into canonical text via parsers in `collector/services/parsers`.
2. **Chunking** — Server chunker (`server/services/chunk`) segments normalized text using workspace-specific heuristics.
3. **Embedding** — Configured embedder generates vectors persisted through the vector abstraction.
4. **Indexing** — Vector service stores embeddings and updates metadata indexes.
5. **Verification** — Post-ingestion hooks validate chunk counts and register document provenance for citations.

### Automation & Recovery
- `scripts/start-stack.mjs` boots local server, collector, and frontend to reproduce ingestion issues end-to-end.
- `scripts/provision-deps.mjs` ensures Redis, Postgres, and headless browser dependencies exist before running the collector.
- BullMQ jobs can be inspected via `server/jobs/queueInspect.js` (executed with `node`) to requeue failed embeddings. Runbooks under `docs/runbooks/troubleshooting.md` outline manual recovery for backlog drains.

## UI Flows
### Workspace Setup
1. User authenticates (or invites) via the frontend login.
2. Navigates to workspace dashboard (`frontend/src/pages/Workspace`).
3. Configures providers, agents, and ingestion sources using guided modals.

### Chat & Agent Operation
1. User opens a workspace chat thread.
2. Selects an agent (or default chat mode) and submits a prompt.
3. UI streams tokens from server-sent events while showing tool activity.
4. User reviews citations, triggers follow-up automations, or escalates to workflow builders.

### Administration
- Organization owners manage users, themes, and system settings in `frontend/src/pages/Admin`.
- Monitoring views expose ingestion status, job queues, and deployment health indicators.

### Agent Flow Builder
1. Builder lives in `frontend/src/pages/AgentFlows` and persists to `/agent-flows/save`.
2. Users drag blocks that map directly to executor steps (LLM, tools, control flow). Validation occurs client side before save.
3. Test runs call `/agent-flows/:uuid/run` and stream status cards summarised in `docs/runbooks/agent-flows.md`.

### Embed & Browser Extension Journeys
- **Embed widgets** — The embed dashboard issues API keys, configures tone/model, and surfaces `/embed/:embedId/stream-chat` transcripts for review.
- **Browser extension** — Users register with `/browser-extension/api-keys/new`, install the Chrome extension, and push snippets via `/browser-extension/embed-content`. The extension surfaces workspace suggestions and respects rate limits configured in `SystemSettings`.

### Mobile Companion
1. Admin generates a device token from `/mobile/register` (exposed in the admin UI).
2. The mobile client authenticates against `/mobile/auth` and syncs workspace lists from `/mobile/devices`.
3. Commands (`/mobile/send/:command`) trigger push notifications or clipboard transfers, which are documented in [`docs/runbooks/mobile-companion.md`](./runbooks/mobile-companion.md).

## Deployment Options
AnythingLLM supports multiple deployment targets, visualized in the [deployment diagram](./diagrams/deployment-options.md).

- **Desktop App** — Bundled Electron runtime for single-user local operation.
- **Docker Compose** — Multi-container setup aligning frontend, server, collector, and vector DB.
- **Cloud Deployments** — Reference stacks for AWS ECS, GCP Cloud Run, and bare-metal scripts under `cloud-deployments/` and `BARE_METAL.md`.
- **Managed Integrations** — Optional use of managed vector databases (Pinecone, Qdrant, etc.) configured via environment variables.

## Change-Log Integration
The SRD version in the front matter must match the latest entry in [`docs/CHANGELOG.md`](./CHANGELOG.md). Every code change affecting architecture, data contracts, or runtime behavior should:

1. Update the SRD content in the appropriate section(s).
2. Increment the `version` and `last_updated` fields in the SRD front matter when scope is significant.
3. Record the change under a new heading in the change log with explicit references to SRD updates and associated code modules.

Automation in `yarn docs:check` validates the SRD structure and ensures the change log contains an entry for the declared version.

## Traceability Matrix
| SRD Section | Primary Repositories | Notes |
| --- | --- | --- |
| Architecture Overview | `frontend/`, `server/`, `collector/` | Align component diagram with service directories. |
| Data Models | `server/prisma/schema.prisma` | Keep entity definitions in sync after schema migrations. |
| Agent Orchestration | `server/utils/agents`, `frontend/src/pages/Workspace` | Ensure new tools or agent patterns documented. |
| Ingestion Pipelines | `collector/`, `server/services/chunk` | Update after adding parsers or chunking strategies. |
| UI Flows | `frontend/src/pages` | Refresh when navigation or core flows change. |
| Deployment Options | `cloud-deployments/`, `BARE_METAL.md`, `docker/` | Document new deployment targets or infrastructure.

## References
- Project README (`README.md`)
- Deployment guides (`docker/`, `cloud-deployments/`, `BARE_METAL.md`)
- Existing runbooks and ADRs under `docs/`
