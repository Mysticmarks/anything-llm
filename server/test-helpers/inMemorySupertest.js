function makeRequest(app) {
  return {
    post: (path) => createRunner(app, "POST", path),
    get: (path) => createRunner(app, "GET", path),
    delete: (path) => createRunner(app, "DELETE", path),
    put: (path) => createRunner(app, "PUT", path),
  };
}

function createRunner(
  app,
  method,
  path,
  state = { headers: {}, query: {}, payload: undefined }
) {
  let pendingPromise = null;

  const runner = {
    query: (params = {}) =>
      createRunner(app, method, path, {
        ...state,
        query: { ...state.query, ...params },
      }),
    set: (name, value) =>
      createRunner(app, method, path, {
        ...state,
        headers: { ...state.headers, [name]: value },
      }),
    send: (payload) =>
      createRunner(app, method, path, {
        ...state,
        payload,
      }),
  };

  const ensurePromise = () => {
    if (!pendingPromise) {
      pendingPromise = executeRequest(state.payload);
    }
    return pendingPromise;
  };

  runner.then = (onFulfilled, onRejected) =>
    ensurePromise().then(onFulfilled, onRejected);
  runner.catch = (onRejected) => ensurePromise().catch(onRejected);
  runner.finally = (onFinally) => ensurePromise().finally(onFinally);

  return runner;

  function executeRequest(payload = state.payload) {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, "127.0.0.1", () => {
          const { port } = server.address();
          const hasBody = method !== "GET" && payload !== undefined;
          const data =
            typeof payload === "string" ? payload : JSON.stringify(payload ?? {});

          const queryString = new URLSearchParams(state.query).toString();
          const urlPath = queryString ? `${path}?${queryString}` : path;

          const options = {
            method,
            headers: { ...state.headers },
          };

          if (hasBody) {
            if (!options.headers["Content-Type"]) {
              options.headers["Content-Type"] = "application/json";
            }
            options.body = data;
          }

          fetch(`http://127.0.0.1:${port}${urlPath}`, options)
            .then(async (response) => {
              const text = await response.text();
              let json = undefined;
              try {
                json = JSON.parse(text);
              } catch {}

              resolve({
                status: response.status,
                body: json,
                text,
              });
            })
            .catch(reject)
            .finally(() => server.close());
        });
      });
  }
}

module.exports = makeRequest;
