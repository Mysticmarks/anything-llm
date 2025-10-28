import { useCallback, useEffect, useRef, useState } from "react";
import showToast from "@/utils/toast";
import { websocketURI } from "@/utils/chat/agent";

const DEFAULT_RETRY_DELAYS = [1000, 2000, 5000];

function getRetryDelay(attempt, retryDelays = DEFAULT_RETRY_DELAYS) {
  if (Array.isArray(retryDelays) && retryDelays.length > 0) {
    return retryDelays[Math.min(attempt - 1, retryDelays.length - 1)];
  }

  const base = Number(retryDelays) || DEFAULT_RETRY_DELAYS[0];
  return Math.min(base * 2 ** (attempt - 1), 10000);
}

export default function useWorkspaceChatSocket({
  socketId,
  onMessage,
  onSessionStart,
  onSessionComplete,
  onSessionError,
  setLoadingResponse,
  abortEventName,
  retryDelays = DEFAULT_RETRY_DELAYS,
  onReconnectScheduled,
}) {
  const [socketState, setSocketState] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const abortListenerRef = useRef(null);
  const intentionalCloseRef = useRef(false);
  const suppressReconnectRef = useRef(false);
  const attemptRef = useRef(0);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const resetSocketState = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close(1000, "client teardown");
      socketRef.current = null;
    }
    setSocketState(null);
  }, []);

  const cleanup = useCallback(() => {
    clearReconnectTimer();
    if (abortListenerRef.current && abortEventName) {
      window.removeEventListener(abortEventName, abortListenerRef.current);
      abortListenerRef.current = null;
    }
    resetSocketState();
    attemptRef.current = 0;
    suppressReconnectRef.current = false;
    setStatus("idle");
  }, [abortEventName, clearReconnectTimer, resetSocketState]);

  const handleFatalError = useCallback(
    (message, err) => {
      console.error("Agent websocket fatal error", err);
      suppressReconnectRef.current = true;
      setError(err instanceof Error ? err : new Error(message));
      showToast(message, "error");
      onSessionError?.(message);
      setLoadingResponse?.(false);
    },
    [onSessionError, setLoadingResponse]
  );

  const connect = useCallback(() => {
    if (!socketId) return;

    clearReconnectTimer();
    setStatus((prev) => (prev === "open" ? prev : attemptRef.current > 0 ? "reconnecting" : "connecting"));
    setError(null);

    let socket;
    try {
      socket = new WebSocket(`${websocketURI()}/api/agent-invocation/${socketId}`);
    } catch (err) {
      handleFatalError("Unable to establish agent session.", err);
      return;
    }

    socket.supportsAgentStreaming = false;
    socketRef.current = socket;
    setSocketState(socket);

    const abortListener = () => {
      intentionalCloseRef.current = true;
      socket.close(1000, "aborted");
    };

    if (abortEventName) {
      window.addEventListener(abortEventName, abortListener);
      abortListenerRef.current = abortListener;
    }

    socket.addEventListener("open", () => {
      suppressReconnectRef.current = false;
      intentionalCloseRef.current = false;
      setStatus("open");
      onSessionStart?.();
    });

    socket.addEventListener("message", (event) => {
      setLoadingResponse?.(true);
      try {
        onMessage?.(socket, event);
      } catch (err) {
        handleFatalError("Failed to process streaming message.", err);
        intentionalCloseRef.current = true;
        socket.close(1011, "message parsing failure");
      } finally {
        setLoadingResponse?.(false);
      }
    });

    socket.addEventListener("error", (event) => {
      const errorMessage = "Agent streaming connection reported an error.";
      console.error(errorMessage, event);
      setError(event instanceof Error ? event : new Error(errorMessage));
    });

    socket.addEventListener("close", (event) => {
      clearReconnectTimer();
      if (abortEventName && abortListenerRef.current) {
        window.removeEventListener(abortEventName, abortListenerRef.current);
        abortListenerRef.current = null;
      }

      if (socketRef.current === socket) {
        socketRef.current = null;
        setSocketState(null);
      }

      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false;
        attemptRef.current = 0;
        setStatus("closed");
        setLoadingResponse?.(false);
        onSessionComplete?.();
        return;
      }

      if (suppressReconnectRef.current) {
        setStatus("error");
        setLoadingResponse?.(false);
        return;
      }

      const closeReason = event?.reason?.trim?.() || "Agent streaming connection closed unexpectedly.";
      const maxAttempts = Array.isArray(retryDelays)
        ? retryDelays.length
        : DEFAULT_RETRY_DELAYS.length;
      if (event?.code !== 1000 && attemptRef.current < maxAttempts) {
        attemptRef.current += 1;
        const delay = getRetryDelay(attemptRef.current, retryDelays);
        const attempt = attemptRef.current;
        showToast(
          `Agent connection interrupted. Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt}/${maxAttempts}).`,
          "warning"
        );
        console.warn("Agent websocket closed. Scheduling reconnect.", {
          code: event?.code,
          reason: closeReason,
          attempt,
          delay,
        });
        onReconnectScheduled?.(attempt, delay);
        setStatus("reconnecting");
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
        setLoadingResponse?.(false);
        return;
      }

      if (event?.code !== 1000) {
        handleFatalError(closeReason, new Error(closeReason));
        setStatus("error");
        return;
      }

      attemptRef.current = 0;
      setStatus("closed");
      setLoadingResponse?.(false);
      onSessionComplete?.();
    });
  }, [
    abortEventName,
    handleFatalError,
    onMessage,
    onReconnectScheduled,
    onSessionComplete,
    onSessionStart,
    retryDelays,
    setLoadingResponse,
    socketId,
    clearReconnectTimer,
  ]);

  useEffect(() => {
    if (!socketId) {
      cleanup();
      return undefined;
    }

    connect();

    return () => {
      intentionalCloseRef.current = true;
      cleanup();
    };
  }, [cleanup, connect, socketId]);

  useEffect(() => () => {
    intentionalCloseRef.current = true;
    cleanup();
  }, [cleanup]);

  return { socket: socketState, status, error };
}
