# Pinned reasoning model and measured performance

Recorded from real runs of the desk CLI on the declared demo hardware (June 10, 2026).

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

## Measured inference (from `audit-log.jsonl` of the runs)

| Run | Model | Load | TTFT | Tokens | Tokens/sec |
|---|---|---|---|---|---|
| BEC-trap review | Qwen3-4B Q4_K_M | 6.0 s | 7.9 s | 420 | **7.5** |
| Advisory-only review | Qwen3-4B Q4_K_M | 6.4 s | 3.4 s | 450 | **7.5** |
| BEC-trap review | Llama 3.2 1B Q4_K | 3.4 s | 2.0 s | 165 | 19.3 |

Notes from the runs:

- On the BEC trap, the 4B model **proposed ESCALATE above the code floor of HOLD**
  ("the high-severity risks justify escalating for deeper review") — the
  tighten-only direction working with real local inference.
- On the advisory-only sample, the 4B model kept APPROVE and explained the
  low-severity pressure flag — no false alarm.
- All inference local via the QVAC SDK; the remote-call disclosure is empty.
