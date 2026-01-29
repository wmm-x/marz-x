## 2024-05-23 - Shared Agents vs Instance Caching
**Learning:** For services that act as API clients (like `MarzbanService` wrapping Axios), sharing `http.Agent` and `https.Agent` at the module level is a more robust and simpler optimization than caching the service instances themselves.
**Why:** Shared agents provide connection pooling (Keep-Alive) across all instances, which is the primary performance bottleneck (TCP handshake overhead). Caching service instances adds complexity (cache invalidation, memory leaks) for negligible gain (saving just the `new Class()` allocation).
**Action:** Always prefer sharing underlying resources (Agents, Pools) over caching wrapper objects, unless the wrapper object initialization is extremely expensive.
