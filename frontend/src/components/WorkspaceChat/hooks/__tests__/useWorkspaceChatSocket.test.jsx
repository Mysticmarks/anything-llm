const { renderHook, act } = require("@testing-library/react");
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const mockToast = jest.fn();
const mockWebsocketURI = jest.fn(() => "ws://test.local");

jest.mock("@/utils/toast", () => ({
  __esModule: true,
  default: mockToast,
}));

jest.mock("@/utils/chat/agent", () => ({
  websocketURI: mockWebsocketURI,
}));

if (typeof window === "undefined") {
  global.window = {};
}

window.addEventListener = jest.fn();
window.removeEventListener = jest.fn();
window.dispatchEvent = jest.fn();

let useWorkspaceChatSocket;

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.listeners = { open: [], message: [], close: [], error: [] };
    this.readyState = MockWebSocket.CONNECTING;
    this.sent = [];
    sockets.push(this);
  }

  addEventListener(type, handler) {
    this.listeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    this.listeners[type] = this.listeners[type].filter((fn) => fn !== handler);
  }

  send(payload) {
    this.sent.push(payload);
  }

  close(code = 1000, reason = "") {
    this.readyState = MockWebSocket.CLOSING;
    this._emit("close", { code, reason });
    this.readyState = MockWebSocket.CLOSED;
  }

  _emit(type, payload) {
    const handlers = [...(this.listeners[type] || [])];
    handlers.forEach((handler) => handler(payload));
  }
}

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

let sockets;

beforeAll(() => {
  const filePath = path.resolve(__dirname, "../useWorkspaceChatSocket.js");
  const source = fs.readFileSync(filePath, "utf8");
  const { code } = esbuild.transformSync(source, {
    loader: "js",
    format: "cjs",
    target: "es2019",
  });
  const module = { exports: {} };
  const compiled = new Function("require", "module", "exports", code);
  compiled(require, module, module.exports);
  useWorkspaceChatSocket = module.exports.default || module.exports;
});

beforeEach(() => {
  sockets = [];
  mockToast.mockClear();
  mockWebsocketURI.mockClear();
  global.WebSocket = jest.fn((url) => new MockWebSocket(url));
});

afterEach(() => {
  delete global.WebSocket;
});

describe("useWorkspaceChatSocket", () => {
  test("establishes connections and forwards messages", () => {
    const onMessage = jest.fn();
    const onSessionStart = jest.fn();
    const onSessionComplete = jest.fn();
    const setLoadingResponse = jest.fn();

    const hook = renderHook((props) => useWorkspaceChatSocket(props), {
      initialProps: {
        socketId: null,
        onMessage,
        onSessionStart,
        onSessionComplete,
        onSessionError: jest.fn(),
        setLoadingResponse,
        abortEventName: "abort-event",
      },
    });

    hook.rerender({
      socketId: "socket-123",
      onMessage,
      onSessionStart,
      onSessionComplete,
      onSessionError: jest.fn(),
      setLoadingResponse,
      abortEventName: "abort-event",
    });

    expect(global.WebSocket).toHaveBeenCalledWith(
      "ws://test.local/api/agent-invocation/socket-123"
    );
    expect(sockets).toHaveLength(1);

    act(() => sockets[0]._emit("open"));
    expect(onSessionStart).toHaveBeenCalledTimes(1);

    act(() =>
      sockets[0]._emit("message", {
        data: JSON.stringify({ type: "statusResponse", content: "ping" }),
      })
    );
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(setLoadingResponse).toHaveBeenNthCalledWith(1, true);
    expect(setLoadingResponse).toHaveBeenNthCalledWith(2, false);

    act(() => sockets[0]._emit("close", { code: 1000, reason: "done" }));
    expect(onSessionComplete).toHaveBeenCalledTimes(1);
    expect(mockToast).not.toHaveBeenCalled();

    hook.unmount();
  });

  test("retries abnormal closures and surfaces errors when exhausted", () => {
    jest.useFakeTimers();
    const onMessage = jest.fn();
    const onSessionStart = jest.fn();
    const onSessionComplete = jest.fn();
    const onSessionError = jest.fn();

    const hook = renderHook((props) => useWorkspaceChatSocket(props), {
      initialProps: {
        socketId: "retry-1",
        onMessage,
        onSessionStart,
        onSessionComplete,
        onSessionError,
        setLoadingResponse: jest.fn(),
        abortEventName: "abort-event",
        retryDelays: [10, 20],
      },
    });

    expect(sockets).toHaveLength(1);
    act(() => sockets[0]._emit("open"));

    act(() => sockets[0]._emit("close", { code: 1011, reason: "boom" }));
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining("Retrying"),
      "warning"
    );
    expect(onSessionError).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(10));
    expect(global.WebSocket).toHaveBeenCalledTimes(2);
    act(() => sockets[1]._emit("open"));

    act(() => sockets[1]._emit("close", { code: 1011, reason: "still" }));
    expect(mockToast).toHaveBeenCalledTimes(2);

    act(() => jest.advanceTimersByTime(20));
    expect(global.WebSocket).toHaveBeenCalledTimes(3);

    act(() => sockets[2]._emit("close", { code: 1011, reason: "fatal" }));

    expect(onSessionComplete).not.toHaveBeenCalled();
    expect(onSessionError).toHaveBeenCalledWith("fatal");
    expect(mockToast).toHaveBeenCalledWith("fatal", "error");

    hook.unmount();
    jest.useRealTimers();
  });
});
