# ContinuityBench

ContinuityBench is the deterministic acceptance suite for Telos personal
continuity. It exercises the real `@telos/personal-core` SQLite store; it does
not replace results with mocks or documentation assertions.

Run the complete benchmark from the repository root:

```bash
pnpm continuity:bench
```

The command first builds all workspace packages, then runs the pinned DSH Web
parity audit, and only then grants `CB-12` its external parity evidence. Calling
the benchmark CLI without that evidence intentionally produces `FAIL` rather
than assuming DSH compatibility.

The JSON report contains 12 scenario results and the following aggregate
metrics:

- valid recall precision and stale-memory error rate;
- workspace/session scope leaks;
- provenance coverage and correction convergence;
- cross-session continuation success;
- deletion completeness, including honest reports for DSH materializations;
- duplicate injection rate, p95 local recall latency, and maximum ContextPack
  size.

Latency is a local deterministic-fixture gate, not a hardware-independent
performance claim. Community adapter comparison remains `NOT_RUN` until a
pinned adapter can run the same claim, scope, evidence, correction, and deletion
contract. Telos must not claim superiority from feature-list comparison alone.
