## 2024-05-22 - Connection Pooling in Service Wrappers
**Learning:** Instantiating service classes (wrapping Axios) per-request defeats connection pooling if `httpAgent` isn't shared/global.
**Action:** Define `http.Agent` with `keepAlive: true` at the module level and pass it to `axios.create` inside the class.
