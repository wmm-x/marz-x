
## 2024-05-22 - [MarzbanService Caching]
**Learning:** `MarzbanService` was instantiated on every request, creating new Axios instances without Keep-Alive. This caused high overhead for frequent API calls.
**Action:** Implemented instance caching keyed by Config ID + updatedAt, and enabled `keepAlive: true`. Always check for service instantiation patterns in high-traffic routes.
