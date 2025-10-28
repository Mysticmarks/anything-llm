# Chat streaming expectations

The chat surface uses a hybrid transport model to deliver live responses. Default
SSE streaming handles simple prompts while agent-mode chats upgrade to a
websocket session that supports bidirectional control messages.

## Lifecycle overview

1. The HTTP streaming endpoint delivers `agentInitWebsocketConnection` when an
   agent workflow takes over the session.
2. The UI opens a websocket connection at `/api/agent-invocation/:uuid` using
   the `useWorkspaceChatSocket` hook.
3. The hook dispatches `agentSessionStart` and immediately clears pending
   attachments so that follow-up commands only reference data accepted by the
   agent runtime.
4. Messages stream over the socket until either side signals completion and the
   hook emits `agentSessionEnd`.

## Resilience guarantees

- **Automatic retries** – abnormal closures trigger exponential backoff with a
  default budget of three attempts (1s, 2s, 5s delays). The UI emits a toast for
  each retry and a final error toast if the budget is exhausted.
- **Structured teardown** – clean exits (manual aborts or graceful completion)
  append `Agent session complete.` to the transcript so operators can confirm the
  streaming session ended without error.
- **Parsing guards** – malformed payloads close the connection, surface a toast,
  and mark the transcript with an abort message to aid debugging.

## Testing expectations

- Unit tests live in `frontend/src/components/WorkspaceChat/hooks/__tests__` and
  validate message forwarding, retry scheduling, and fatal error handling.
- E2E coverage in `frontend/tests/e2e/workspace-journeys.spec.js` verifies that
  mocked websocket interruptions trigger reconnection and the UI surfaces the
  recovery message plus the closing status line.

Update this document when the retry strategy, toast messaging, or transcript
signatures change.
