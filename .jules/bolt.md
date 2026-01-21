## 2024-05-22 - [MarzbanService Instance Caching]
**Learning:** The application was recreating `MarzbanService` (and thus Axios instances) on every request, preventing TCP connection reuse.
**Action:** Implemented caching for service instances keyed by config ID and version, and added `keepAlive: true` agents to Axios.
