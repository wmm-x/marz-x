## 2024-05-23 - Missing HTTP Keep-Alive in Backend Services
**Learning:** The `MarzbanService` was creating a new Axios client for every request without connection pooling. This causes high latency and overhead due to repeated TCP/TLS handshakes, especially for frequent API calls.
**Action:** Implemented shared `http.Agent` and `https.Agent` with `keepAlive: true` to reuse connections across service instances. Always check for connection pooling in service classes that instantiate HTTP clients.
