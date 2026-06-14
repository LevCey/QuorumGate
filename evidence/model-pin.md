# Pinned reasoning model and measured performance

Recorded from real runs of the desk CLI on the declared demo hardware (June 10, 2026; full-pipeline validation June 14, 2026).

## Pinned model

| | |
|---|---|
| Model | **Qwen3-4B, Q4_K_M GGUF** (`Qwen/Qwen3-4B-GGUF`, file `Qwen3-4B-Q4_K_M.gguf`, 2.4 GB) |
| Loading | `@qvac/sdk` `loadModel` with a local file path (`--model <path-to-gguf>`) |
| Fallback / dev model | Llama 3.2 1B instruct (tool-calling build, Q4_K, 771 MB) — faster, noticeably weaker memos |

## Demo hardware

| | |
|---|---|
| CPU | Intel Core i5-13420H (12 threads) |
| RAM | 15 GB total (within the 32 GB General Purpose track envelope) |
| Storage | NVMe SSD |
| OS / runtime | Linux, Node.js v24 |

## Measured inference

Earlier figures were wall-clock estimates; the June 14 validation run records the SDK's
own reported stats (`generatedTokens` and the SDK's tokens/sec, not a stream-chunk
count), which are more authoritative.

| Run | Model | Load | TTFT | Tokens | Tokens/sec | Source |
|---|---|---|---|---|---|---|
| BEC-trap (signed + RAG) | Qwen3-4B Q4_K_M | ~6 s | 4.0 s | 538 generated | **9.1** | SDK stats (backend gpu) |
| BEC-trap (earlier) | Qwen3-4B Q4_K_M | 6.0 s | 7.9 s | 420 | 7.5 | wall-clock estimate |
| BEC-trap | Llama 3.2 1B Q4_K | 3.4 s | 2.0 s | 165 | 19.3 | wall-clock estimate |

## Full-pipeline validation (June 14, 2026)

One run exercised everything end to end on the demo hardware:

- **Reasoning:** Qwen3-4B (backend `gpu`), an explainable HOLD memo over the BEC trap.
- **Embedding-based RAG:** embeddinggemma-300M via `--embed-model` — the memo cited the
  supplier's typical range (9,500–10,500 EUR) retrieved from the company records, not
  just the fired checks.
- **Tamper-evident signing:** `--sign` produced a bundle that verifies VALID; editing the
  verdict in the JSON makes `scripts/verify-bundle.mjs` report INVALID.
- **Provenance + lifecycle:** the bundle carries the model SHA-256; the audit log carries
  model load and unload plus the SDK's per-call stats.

Raw artifacts committed: `evidence/sample-evidence-bundle.json`,
`evidence/sample-audit-log.jsonl`, `evidence/sample-remote-call-disclosure.json`.

## OCR pipeline validation (June 14, 2026)

Separately, the `--invoice-image` path was run on the demo hardware against the synthetic
invoice image (`examples/sample-data/invoice-bec-trap.png`, a realistic Acme GmbH
letterhead): the QVAC latin OCR recognizer (`OCR_LATIN_RECOGNIZER_1`, downloaded from the
registry) detected 29 text blocks, each with a per-block confidence; the extractor parsed
them into fields (IBAN, amount 30,500 EUR, invoice number, supplier name, and the
PO/approval reference), the supplier resolved to `acme-gmbh`, and the desk held the payment
on four signals — the changed IBAN, the look-alike sender domain, an abnormal amount, and
urgency — all read straight from the image. Committed artifact:
`evidence/sample-ocr-bundle.json`.

Notes:

- In an earlier run the 4B model **proposed ESCALATE above the HOLD floor** — the model
  is non-deterministic, so the exact proposal varies, but it can only tighten, never
  loosen, the code-decided floor.
- On the advisory-only sample the 4B model kept APPROVE and explained the low-severity
  pressure flag — no false alarm.
- All inference local via the QVAC SDK; the remote-call disclosure is empty.
