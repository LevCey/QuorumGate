# Four-eyes delegated review — recorded run

A real two-process run of the four-eyes second review over QVAC delegated inference
(June 13, 2026). Reviewer A runs the desk; Reviewer B runs a provider that serves
inference over the Holepunch DHT. The same script runs across two laptops (Linux ↔
Windows 11); this capture is the single-machine two-process run used for the
measurements.

## Commands

```bash
# Reviewer B (second device): start the provider — prints PROVIDER_KEY=...
node scripts/spike-p2p.mjs provider

# Reviewer A: review the BEC trap with four-eyes delegated to B
node packages/ui/src/desk-cli.js examples/sample-data/request-bec-trap.json \
  --model <gguf> --peer <PROVIDER_KEY> --peer-model <gguf-on-B> \
  --decide BLOCK --reviewer "Reviewer A"
```

## What happened

1. Reviewer A reviewed the trap locally — four checks fired (IBAN change, look-alike
   domain, abnormal amount, urgency), code floor HOLD, A's verdict **HOLD**.
2. The case is high-value, so the desk built the minimal case bundle and delegated it
   to B. Only the bundle crossed the link — masked IBAN, the fired checks, the floor;
   no raw documents, message text, or tax id.
3. B's model independently reviewed the bundle and returned its own memo and verdict:
   **HOLD — CONCUR**. The combined recommendation stayed HOLD.
4. The human recorded **BLOCK**. The evidence bundle records the second review with
   `source: "peer"`.

The SDK logs confirmed real delegation (`Sending delegated loadModel request to
provider`, `Peer connection opened`). With the peer stopped, the same review falls
back to a local second opinion and still reaches a verdict (I-5).

## Measured (from the run's `audit-log.jsonl`, Llama 3.2 1B Q4_K, demo hardware)

| Step | Load | TTFT | Tokens | Tokens/sec |
|---|---|---|---|---|
| Reviewer A — local review | 2.4 s | 0.9 s | 84 | 19.4 |
| Reviewer B — delegated second opinion (peer) | 1.9 s | 1.1 s | 80 | 18.4 |

The delegated second opinion runs at essentially local speed (same hardware here; the
P2P transport overhead is small). Two-laptop LAN round-trip reliability is recorded
separately: 10/10 rounds, median 882 ms (reproduce with `scripts/spike-p2p.mjs`).
