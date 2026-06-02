# @quorumgate/core

Deterministic risk-check and verdict-floor engine — **Layer A** of QuorumGate.

This package has **no `@qvac/sdk` dependency** and performs no inference. Every risk
check runs in plain code and emits a structured result; the verdict floor is computed
here, from those results alone. The reasoning model may make a verdict *more*
conservative, never less — it cannot turn a failed check into an approval.

Run the tests (no install required), from the repository root:

```bash
npm test
```
