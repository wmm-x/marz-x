## 2025-01-26 - [Service Factory Pattern Bottleneck]
**Learning:** The `createMarzbanService` factory was instantiating a new `MarzbanService` (and thus a new Axios client) for every request, preventing TCP connection reuse despite high traffic potential.
**Action:** Always check if service factories or dependency injection containers are caching instances correctly, especially when expensive resources like HTTP clients are involved.
