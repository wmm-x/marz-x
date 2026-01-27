## 2024-05-23 - MarzbanService Connection Pooling & Caching
**Learning:** Instantiating `axios` clients per request without a shared `http.Agent` prevents TCP connection reuse, leading to significant overhead for frequent API calls.
**Action:** Always use shared `http.Agent` and `https.Agent` with `keepAlive: true` when making HTTP requests to the same backend services, and cache service instances where possible to avoid object creation overhead.
