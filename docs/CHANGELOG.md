---
srd_versions:
  - version: 1.0.0
    date: 2024-05-09
    summary: Initial SRD baseline covering architecture, data models, agents, ingestion, UI, and deployments.
---

# Documentation Change Log

The change log records the relationship between code-level changes and SRD updates. Each entry must reference the SRD sections that were revised alongside a short description of the driving code modifications.

## Process
1. When a pull request alters application architecture, data contracts, or operational flows, update the relevant SRD sections.
2. Bump the SRD `version` and `last_updated` front matter when the modifications materially impact readers.
3. Append a new entry below using the template:

   ```markdown
   ## [x.y.z] - YYYY-MM-DD
   ### SRD
   - Updated <Section Name> to reflect <change summary>.

   ### Code Alignment
   - <Repository path or PR reference>
   ```

4. Run `yarn docs:check` locally to validate the SRD schema, markdown formatting, and change-log linkage.

## [1.0.0] - 2024-05-09
### SRD
- Published the inaugural SRD with diagrams for architecture, agent orchestration, and deployments.

### Code Alignment
- Documented existing frontend (`frontend/`), server (`server/`), and collector (`collector/`) behaviors without code changes.
