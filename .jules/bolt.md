## 2024-05-23 - Node 22 Keep-Alive Defaults
**Learning:** Node.js 19+ (and thus 22) enables HTTP Keep-Alive by default in the global agent.
**Action:** When optimizing connection reuse on newer Node versions, relying on global defaults works, but explicit Agent configuration ensures consistent performance across LTS versions (like 18) and allows fine-tuning (e.g. timeout).
