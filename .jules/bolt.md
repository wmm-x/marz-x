## 2024-05-22 - Connection Pooling in Service Wrappers
**Learning:** Instantiating service classes (wrapping Axios) per-request defeats connection pooling if `httpAgent` isn't shared/global.
**Action:** Define `http.Agent` with `keepAlive: true` at the module level and pass it to `axios.create` inside the class.

## 2024-05-24 - Redundant API Calls in Scheduled Tasks
**Learning:** Scheduled tasks often fetch data (e.g., stats) to decide on an action, then call a service method that fetches the same data again for validation. This doubles the API load unnecessarily.
**Action:** Design service methods to accept optional data arguments (e.g., `autoOptimizeServer(stats)`) to reuse already-fetched data from the scheduler.
