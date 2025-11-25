# System Component Diagram

```mermaid
flowchart LR
    subgraph Client
        UI[Frontend (Vite + React)]
        BrowserExt[Browser Extension]
    end

    subgraph Backend
        API[Server API (Express)]
        Agents[Agent Runtime]
        Auth[Auth & Session]
        Vector[Vector Service Abstraction]
        Jobs[Background Jobs]
    end

    subgraph Observability
        Metrics[Metrics & Prometheus Exporter]
        Events[Event Logs / Telemetry]
    end

    subgraph Data
        VectorDB[(Vector Databases)]
        SQL[(SQLite/PostgreSQL)]
        ObjectStore[(Object Storage)]
    end

    subgraph Integrations
        LLMs[LLM Providers]
        Tools[External Tools & MCP Servers]
    end

    subgraph Testing
        Integration[Integration Stack (LiteLLM mock + fixtures)]
    end

    UI <--> API
    BrowserExt --> API
    API --> Agents
    API --> Auth
    API --> Metrics
    API --> Events
    Agents --> Vector
    Agents --> Jobs
    Jobs --> Collector
    Collector[Collector Service] --> Vector
    Collector --> Metrics
    Collector --> Events
    Vector --> VectorDB
    API --> SQL
    Agents --> LLMs
    Agents --> Tools
    Integration --> API
    Integration --> LLMs
    Collector --> ObjectStore
```
