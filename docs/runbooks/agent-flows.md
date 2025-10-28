# Agent flow execution runbook

The agent flow builder now exposes a programmatic execution endpoint so that
administrators can trigger flow runs without wiring them through the live agent
runtime. This runbook explains the contract and the prerequisites for
successfully invoking `/agent-flows/:uuid/run`.

## When to use the endpoint

Use the execution endpoint when you need to validate a newly built flow or
orchestrate flows from external automation. The endpoint mirrors the logic the
agent runtime uses and therefore supports the same steps and variable
substitutions.

## Request contract

```
POST /agent-flows/:uuid/run
Content-Type: application/json

{
  "variables": { "optional": "object" },
  "workspaceId": 1,        // optional, see below
  "workspaceSlug": "demo", // optional, see below
  "includeTelemetry": true  // optional, defaults to true
}
```

### Workspace context requirements

Flows that include `llmInstruction` or `webScraping` steps require a fully
provisioned workspace context so that the execution environment can resolve an
LLM provider, credentials, and plugins. Provide either `workspaceId` or
`workspaceSlug` in the request to satisfy this requirement. Flows that only use
`start` or `apiCall` blocks can omit workspace information.

If a workspace is required but missing, the endpoint responds with HTTP 400 so
callers can retry with the proper context instead of failing mid-execution.

### Telemetry payload

When telemetry is enabled (default) the response includes two additional arrays:

- `thoughts`: status updates emitted by the flow execution (e.g., introspection
  messages).
- `logs`: structured log lines captured from the execution environment.

Disable telemetry by setting `includeTelemetry` to `false` if a compact response
is preferred.

## Response shape

```
{
  "success": true,
  "flow": { "uuid": "...", "name": "Flow name" },
  "results": {
    "success": true,
    "results": [ { "success": true, "result": "..." } ],
    "variables": { "captured": "values" },
    "directOutput": null
  },
  "workspace": { "id": 1, "slug": "demo", "name": "Demo Workspace" },
  "telemetry": {
    "thoughts": ["boot sequence", "step finished"],
    "logs": ["step complete {\"status\":\"ok\"}"]
  }
}
```

When execution fails the endpoint returns HTTP 500 along with the error message
in the `error` property. Validation and lookup errors reuse HTTP 4xx so callers
can correct the request and retry.

## Error handling & observability

- All execution attempts emit `agent_flow_executed` telemetry with a success
  flag so dashboards can monitor the pass rate.
- Failures additionally emit `agent_flow_execution_failed` with the flow UUID
  and the message returned by the executor.
- Workspace lookup errors surface as HTTP 404 with a human readable message.

## Agent channel fallbacks

Multi-agent flows rely on channel graphs to decide which participant should
speak next. When the selector cannot identify a follow-up speaker—because every
member has reached its round limit or is otherwise unavailable—the runtime now
emits a fallback message instead of silently terminating the conversation. The
channel posts the message to the waiting participant, the session is terminated,
and the `agent_flow_fallback` telemetry event is sent for observability.

Customize the text that is delivered during this fallback by adding
`emptySelectionFallbackMessage` to the channel configuration when constructing
the flow. If the field is omitted, a default escalation notice is used to
indicate that a human hand-off is required.

## Testing guidance

The server test suite includes `server/__tests__/endpoints/agentFlows.test.js`
which mocks the executor and validates the scenarios described above. Extend the
test when introducing new flow block types or response fields to prevent
regressions.
