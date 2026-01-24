## 2024-05-22 - MarzbanService Optimization
**Learning:** The application instantiates `MarzbanService` (and thus a new Axios instance with new TCP connection) for every request. This is a significant bottleneck.
**Action:** Implemented connection pooling (shared `http.Agent` with `keepAlive`) and service instance caching keyed by config ID and `updatedAt`. Always look for repetitive object instantiation in high-traffic paths.
