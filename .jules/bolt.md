## 2024-05-23 - Initial Bolt Setup
**Learning:** Establishing baseline performance metrics is crucial.
**Action:** Use console.time/timeEnd in verification scripts.

## 2024-05-23 - Service Instantiation Overhead
**Learning:** Instantiating services like 'MarzbanService' per-request creates new Axios clients and TCP agents, defeating connection pooling.
**Action:** Use module-level caching for service instances (keyed by config ID) and shared http/https agents with 'keepAlive: true'.
