## 2024-05-22 - Connection Pooling in Service Wrappers
**Learning:** Instantiating service classes (wrapping Axios) per-request defeats connection pooling if `httpAgent` isn't shared/global.
**Action:** Define `http.Agent` with `keepAlive: true` at the module level and pass it to `axios.create` inside the class.

## 2024-05-23 - Redundant API Calls in Scheduled Tasks
**Learning:** Scheduled tasks often fetch data to check conditions before calling service methods. If the service method re-fetches the same data, it doubles the API load unnecessarily.
**Action:** Design service methods to accept optional pre-fetched data (dependency injection of data) to avoid redundant calls.
