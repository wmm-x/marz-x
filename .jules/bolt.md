# Bolt's Journal

## 2024-05-22 - [Initial Setup]
**Learning:** This is a new journal file. I will document critical performance learnings here.
**Action:** Always check this file before starting optimization tasks.

## 2024-05-22 - [Service Caching Strategy]
**Learning:** `createMarzbanService` was creating a new axios instance (and underlying HTTP agent) for every request. Since the configuration rarely changes, this caused unnecessary connection overhead.
**Action:** Implemented a `Map`-based cache keyed by `config.id` and invalidated by `config.updatedAt`. Also enabled `keepAlive: true` for HTTP/HTTPS agents to utilize connection pooling.
