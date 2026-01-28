## 2024-05-24 - [MarzbanService Connection Pooling]
**Learning:** The `MarzbanService` was being instantiated per-request, creating a new `axios` instance and new TCP connection for every API call. This defeats the purpose of keep-alive.
**Action:** Implemented caching for `MarzbanService` instances keyed by `config.id` and added shared `http.Agent`/`https.Agent` with `keepAlive: true`.
