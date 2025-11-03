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

    subgraph Data
        VectorDB[(Vector Databases)]
        SQL[(SQLite/PostgreSQL)]
        ObjectStore[(Object Storage)]
    end

    subgraph Integrations
        LLMs[LLM Providers]
        Tools[External Tools & MCP Servers]
    end

    UI <--> API
    BrowserExt --> API
    API --> Agents
    API --> Auth
    Agents --> Vector
    Agents --> Jobs
    Jobs --> Collector
    Collector[Collector Service] --> Vector
    Vector --> VectorDB
    API --> SQL
    Agents --> LLMs
    Agents --> Tools
    Collector --> ObjectStore
```
