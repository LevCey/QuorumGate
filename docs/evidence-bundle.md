# The audit-evidence export

Every completed review can be exported locally. The desk writes up to three files
into the output directory (default `evidence/`); nothing is uploaded anywhere.

## `evidence-bundle.json`

The audit record of one review:

| Field | Content |
|---|---|
| `schemaVersion`, `generatedAt` | Format version and ISO timestamp. |
| `supplier` | Supplier id (and name when known). |
| `payment` | Amount, currency, invoice number, and the destination IBAN **masked to its last four characters**. |
| `checks` | Every check that ran — passed, failed, or skipped — with severity and human-readable evidence. |
| `floor` | The code-decided verdict floor (and whether APPROVE was forbidden). |
| `verdict` | The model-proposed verdict, the final (clamped) verdict, and the explainable memo. |
| `secondReview` | The second reviewer's opinion for delegated (four-eyes) cases. |
| `humanDecision` | The human reviewer's final decision, name, and timestamp. |

The bundle deliberately excludes raw documents, the supplier message text, and tax
identifiers: it records what was decided and why, not the underlying sensitive
material.

## `remote-call-disclosure.json`

The hackathon's transparency artifact, **empty by design**: QuorumGate makes no cloud
or third-party AI calls, so the disclosed call list is `[]`.

## `audit-log.jsonl`

Written when the review runs against a real local model (`--model`). One JSON object
per line, recording model loads and per-completion inference performance: prompt
size, token count, time-to-first-token, total time, and tokens per second, with the
model id. This is the performance evidence for the run that produced the bundle.
