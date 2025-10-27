function makeRequest(app) {
  return {
    post: (path) => createRunner(app, "POST", path),
    get: (path) => createRunner(app, "GET", path),
  };
}

function createRunner(app, method, path) {
  return {
    send: (payload = "") =>
      new Promise((resolve, reject) => {
        const server = app.listen(0, "127.0.0.1", () => {
          const { port } = server.address();
          const data =
            typeof payload === "string"
              ? payload
              : JSON.stringify(payload ?? {});

          const options = {
            method,
            headers: {},
          };

          if (method !== "GET") {
            options.headers["Content-Type"] = "application/json";
            options.body = data;
          }

          fetch(`http://127.0.0.1:${port}${path}`, options)
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
      }),
  };
}

module.exports = makeRequest;
