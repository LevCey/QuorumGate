# Four-eyes delegated review — recorded run

The four-eyes second review runs over QVAC delegated inference: Reviewer A runs the
desk; Reviewer B runs a provider that serves inference over the Holepunch DHT. For a
high-value or high-risk case, A delegates an independent review of the minimal case
bundle to B; B's model returns its own verdict and memo, which the desk folds in (the
second reviewer can only tighten, never loosen).

Validated two ways (June 13, 2026): across two physical laptops over a home LAN, and
as a single-machine two-process run for the per-step measurements.

## Commands

```bash
# Reviewer B (second device): start the provider — prints PROVIDER_KEY=...
node scripts/spike-p2p.mjs provider

# Reviewer A: review the BEC trap with four-eyes delegated to B
node packages/ui/src/desk-cli.js examples/sample-data/request-bec-trap.json \
  --model <gguf> --peer <PROVIDER_KEY> --peer-model <gguf-on-B> \
  --decide BLOCK --reviewer "Reviewer A"
```

## Two-device run (Linux consumer ↔ Windows 11 provider, home LAN)

- Reviewer A reviewed the trap locally — four checks fired (IBAN change, look-alike
  domain, abnormal amount, urgency), code floor HOLD, A's verdict **HOLD**.
- The desk delegated the minimal bundle to the Windows 11 peer. The consumer logged
  the delegated request, the direct DHT connection, and the peer connection to the
  provider's public key; the Windows side independently logged loading its own model
  (at its local path) and running the completion (~7.9 s) — the two sides' timings
  agree.
- B's model returned its own memo and verdict: **HOLD — CONCUR**. The evidence bundle
  records `secondReview.source: "peer"`.
- **Reliability: 4/4 runs reached the peer** (`source: "peer"`, no fallback), B
  HOLD/CONCUR each time; delegated second-opinion completion 6.9–9.3 s (Llama 3.2 1B
  Q4_K over the LAN). The sample is small and same-LAN.
- With the peer stopped, the same review falls back to a local second opinion and
  still reaches a verdict (I-5).

## Single-machine two-process run (per-step measurements)

Both roles on one machine, from the run's `audit-log.jsonl`:

| Step | Load | TTFT | Tokens | Tokens/sec |
|---|---|---|---|---|
| Reviewer A — local review | 2.4 s | 0.9 s | 84 | 19.4 |
| Reviewer B — delegated second opinion | 1.9 s | 1.1 s | 80 | 18.4 |

On one machine the delegated second opinion runs at essentially local speed; across
two laptops the delegated completion is 6.9–9.3 s, the extra time being the LAN round
trip and the peer-side model load. Raw P2P transport reliability is recorded
separately: 10/10 rounds, median 882 ms (reproduce with `scripts/spike-p2p.mjs`).

## Data that crosses

Only the minimal case bundle — masked IBAN, the fired checks with evidence, and the
floor; never raw documents, the message text, or the tax id. In the delegated-inference
path the bundle travels to the peer as the model prompt over QVAC's P2P channel. All
inference is local to the two devices; the remote-call disclosure is empty.

## Re-validated with the full feature set (June 14, 2026)

The two-laptop run was repeated after the desk gained signing, provenance, and the
independent-second-review controls — Linux consumer ↔ Windows 11 provider, `--sign`
enabled. The case delegated to the peer (`secondReview.source: "peer"`,
`independent: true`, CONCUR — HOLD), and the exported bundle is Ed25519-signed and
verifies (`scripts/verify-bundle.mjs` → VALID; editing any field → INVALID). The
committed artifact is `evidence/sample-four-eyes-bundle.json`.

## Peer model choice (June 14, 2026) — a capable model for a credible memo

The runs above used Llama 3.2 1B on the peer: a fast round-trip and the correct HOLD
verdict (the floor clamp holds whatever the peer model returns). But a 1B is too weak to
reason over the bundle — it returned a confident memo that contradicted the fired checks.
For a credible independent second opinion the demo therefore runs **Qwen3-4B on the peer
too**. Re-run Linux consumer ↔ Windows 11 provider (`--sign`): the peer returned a correct
concurring memo (the high-severity `iban_change` and `sender_domain` justify holding),
`secondReview.source: "peer"`, `independent: true`, CONCUR — HOLD, signed bundle VALID.
The latency is higher and dominated by the peer-side model load — about two minutes on the
demo laptop. The peer model is bounded (explicit `ctx_size` and a generated-token cap; see
`createDelegatedReviewer`) so it always returns instead of overflowing or running away, and
the four-eyes timeout is 180 s to cover a real model's load and inference on the peer.
