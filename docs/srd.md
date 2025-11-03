---
version: 1.0.0
status: Active
last_updated: 2024-05-09
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

## Data Models
### Relational Schema
Key relational entities live in `server/prisma/schema.prisma` and its generated client:

- **User** — Authentication credentials, permissions, theme preferences.
- **Workspace** — Logical grouping for documents, vector indexes, and chat history isolation.
- **Document & DocumentChunk** — Metadata and chunked payload pointers for ingested content.
- **Agent & AgentTool** — Declarative definitions for automated workflows and tool availability.
- **Thread & Message** — Conversation transcripts with model parameters and streaming metadata.

### Vector Storage
The server abstracts LanceDB (default) with optional providers via `server/services/vector/*`. Embeddings attach to `DocumentChunk` records and feed retrieval augmented generation (RAG) flows.

### Configuration Artifacts
Per-workspace JSON/YAML settings stored under `server/storage` and user-provided `.env` files govern provider credentials, rate limits, tool activation, and MCP endpoints.

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
