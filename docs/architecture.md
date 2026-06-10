# Architecture

QuorumGate reviews a payment request entirely on the finance team's own devices. The
design splits authority across three layers so that the parts that must be auditable
are deterministic code, and the model can never overrule them.

## The three layers

**Layer A — deterministic decision logic** (`packages/core`, no SDK dependency).
Every risk check runs unconditionally in plain code and emits a structured result
(`checkId`, `status`, `severity`, `evidence`). From the fired checks, code computes a
**verdict floor**: any high- or medium-severity failure forbids APPROVE; low-severity
findings are advisory. The floor, not the model, decides what the minimum verdict is.

**Layer B — reasoning and explanation** (`packages/qvac-pipeline`). A local instruct
model, run through the QVAC SDK, reads the fired checks and writes the explainable
memo, proposing a verdict. The proposal is **clamped in code** to the Layer-A floor:
the model may tighten a verdict (be more conservative), never loosen it. A malformed
or missing model response falls back to the floor. The model is behind a small
`ReasoningModel` interface, so the desk also runs with a deterministic offline stub.

**Layer C — four-eyes delegation** (`packages/p2p-review`). High-value or high-risk
cases are routed to a second reviewer's device over QVAC P2P delegated inference.
Only a **minimal case bundle** crosses: curated payment fields (IBAN masked), the
fired checks with evidence, and the floor — never raw documents, the message text, or
the tax id. The bundle can additionally be sealed to the second reviewer's public key
(ephemeral X25519 + AES-256-GCM), so its confidentiality does not depend on the
transport. If no peer is available, the review falls back to a local second opinion —
a verdict is always reached.

The human reviewer makes the final decision (Approve / Hold / Escalate → Block); it
is recorded with the reviewer's name and a timestamp. The system only recommends.

## Trust boundaries

| Boundary | Protection |
|---|---|
| Invoice/email text → model | Untrusted input; it is data to explain, never instructions. Layer-A facts and the floor are code-owned, so an injected "approve me" cannot loosen the verdict — covered by an adversarial test. |
| Model → verdict | The proposal is clamped to the code-decided floor; the memo cites code-decided facts. |
| Reviewer A ↔ Reviewer B | Minimum-necessary case bundle; IBAN masked; optional public-key sealing on top of the transport. |
| Devices ↔ outside world | No cloud or third-party AI call anywhere; the remote-call disclosure ships empty by design. |

## Key invariants (tested)

- A high-severity failure can never produce APPROVE, regardless of model output.
- Untrusted document text cannot change the deterministic checks or loosen the verdict.
- A verdict is always reached: the single-device path is complete on its own.
- The deterministic core is reproducible: identical inputs produce identical fired
  checks and floor.
