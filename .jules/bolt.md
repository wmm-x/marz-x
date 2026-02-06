## 2024-05-22 - Axios Connection Pooling in Node.js
**Learning:** By default, Axios in Node.js uses the global `http` agent which has `keepAlive: false` (or creates new agents per instance if not configured). When creating a new `Axios` instance for every request (e.g., inside a service factory), this results in a new TCP connection for every request, causing significant latency and potential port exhaustion.
**Action:** Always create shared `http.Agent` and `https.Agent` instances with `{ keepAlive: true }` at the module level and pass them to `axios.create()`.
