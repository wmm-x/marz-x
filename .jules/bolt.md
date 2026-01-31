## 2024-05-23 - [Legacy Logic Performance Impact]
**Learning:** Found a critical anti-pattern in `MarzbanService` where a hardcoded 10% RAM usage threshold triggers a full service restart. This overrides dynamic thresholds defined in `autoOptimize.js` and likely causes frequent, unnecessary service interruptions and resource spikes.
**Action:** When optimizing legacy services, check for hardcoded logic that conflicts with newer configuration layers. Always verify thresholds against realistic production metrics (10% RAM is unrealistic).

## 2024-05-23 - [Connection Pooling]
**Learning:** Node.js HTTP/HTTPS agents should be explicitly reused for high-frequency internal API calls (proxying) to avoid TCP handshake overhead, even if global defaults are improved in newer Node versions.
**Action:** Use module-level `http.Agent` instances with `keepAlive: true` for Axios clients in service classes.
