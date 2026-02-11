## 2024-05-22 - Connection Pooling in Service Wrappers
**Learning:** Instantiating service classes (wrapping Axios) per-request defeats connection pooling if `httpAgent` isn't shared/global.
**Action:** Define `http.Agent` with `keepAlive: true` at the module level and pass it to `axios.create` inside the class.

## 2024-05-23 - Redundant API Calls in Scheduled Tasks
**Learning:** Scheduled tasks often fetch data to check conditions before calling service methods. If the service method re-fetches the same data, it doubles the API load unnecessarily.
**Action:** Design service methods to accept optional pre-fetched data (dependency injection of data) to avoid redundant calls.

## 2024-05-23 - SSRF Prevention in Legacy Code
**Learning:** String concatenation for URLs in Axios requests is flagged as a Security Hotspot. Legacy code modifications trigger full scans.
**Action:** Use `new URL()` to construct URLs and validate inputs with a dedicated validator (like `validateUrl`) before making requests. Explicitly pass `httpAgent`/`httpsAgent` to individual requests if they bypass the main client instance.
