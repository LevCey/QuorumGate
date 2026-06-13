# QuorumGate

**Confidential Multi-Reviewer Risk Desk.** A local-first pre-payment review desk that reads invoices and supplier messages on the finance team's own devices, flags payment fraud before money moves, and — for high-risk cases — enforces a four-eyes review peer-to-peer between two devices. No cloud. No external AI API. Sensitive payment data stays inside the company-controlled device perimeter.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Status](https://img.shields.io/badge/status-active%20build-brightgreen.svg)
![Built with](https://img.shields.io/badge/built%20with-QVAC%20SDK-black.svg)
![Track](https://img.shields.io/badge/track-General%20Purpose%20Devices-informational.svg)

**Website:** [quorumgate.com](https://quorumgate.com)

> **Status — built for [QVAC Hackathon I — Unleash Edge AI](https://dorahacks.io/hackathon/qvac-unleach-edge-ai-i/detail) (build period June 1–21, 2026).** The local review desk works today: deterministic risk checks, an explainable memo from a real local model via the QVAC SDK, and a four-eyes second review delegated peer-to-peer to a second device. OCR and embedding-based RAG are wired as SDK seams — the desk uses structured intake and a deterministic supplier lookup today. All inference runs locally through the QVAC SDK; there is no cloud dependency.

---

## The problem

Business Email Compromise (BEC) is one of the costliest cybercrimes targeting companies that make regular wire-transfer payments to suppliers. By the time a human notices a fraudulent payment, the money has usually already moved.

BEC drove **$2.77 billion in reported U.S. losses in 2024** across 21,442 complaints — the second-costliest cybercrime category that year (FBI IC3). It works through impersonation, urgency, and trust — a spoofed supplier email, a changed bank account, a rushed wire — not malware. AI now amplifies it: generated emails in an executive's writing style, voice-cloned confirmations, look-alike supplier domains.

The highest-leverage defense is to **review every invoice and supplier message in the moment before the payment is signed** — checking for changed bank details, duplicate invoices, impersonated senders, and abnormal amounts.

But this is exactly the review most finance teams *cannot* run with modern AI. Invoices, supplier bank details, and payment history are confidential. Sending them to a cloud LLM is unacceptable under GDPR, KVKK, banking-secrecy norms, and basic competitive caution. So the most sensitive, highest-value check is the one that has never been safely automated.

This is not an analytics problem. It is a confidentiality problem — and that is exactly what local AI solves.

> Source: FBI Internet Crime Complaint Center (IC3), *2024 Internet Crime Report*. https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf

## The solution

QuorumGate is a local-first pre-payment review desk that runs entirely on the finance team's own hardware using the QVAC SDK, with zero cloud dependency.

A payment request — invoice + supplier email + optional purchase order — is dropped into the desk, which:

1. **Reads** the payment request locally — structured intake today, with OCR over scanned invoices (via the SDK) as the input path being wired up.
2. **Grounds** it against the company's own supplier and payment history — a deterministic on-device supplier-history lookup today, with embedding-based retrieval (via the SDK) being wired in as additive grounding.
3. **Checks** them against a deterministic risk-rule set.
4. **Reasons** over the assembled evidence with a local reasoning model (an instruct model run through the QVAC SDK) and produces a structured verdict — **Approve / Hold / Escalate** — with an explainable memo that cites the grounding evidence.
5. **Returns** the decision to a human, who makes the final call and exports an audit-evidence bundle.

### Four-eyes across two devices — the differentiator

For high-value or high-risk cases, QuorumGate delegates the case to a **second reviewer's device** over QVAC's peer-to-peer delegated inference. A second local model on that device produces its own opinion over the same minimal bundle — the **four-eyes principle** (segregation of duties) across two company-controlled devices. (The second reviewer reasons over the curated bundle and the first reviewer's floor; it does not re-run the deterministic checks — see [Project status](#project-status).) Reviewer A sends only a minimal bundle of the necessary review material — the fired risk checks, their evidence, and curated payment fields with the IBAN masked — over QVAC's peer-to-peer channel; no cloud service or third-party AI ever receives invoice content, full IBANs, or supplier history. If no peer is available, the review falls back to a local second opinion, so a verdict is always reached. On the delegated-inference path the bundle is carried by the QVAC P2P channel's transport encryption; an additional application-layer sealed box (`packages/p2p-review/src/seal.js`, X25519 + AES-256-GCM) is implemented and unit-tested for deployments where the second device decrypts the bundle itself, and is not applied on the prompt path.

This "second reviewer on a second device, fully offline" step maps a real compliance control — dual authorization — directly onto QVAC's most distinctive primitive, and is what separates QuorumGate from any single-machine document tool.

## Why local AI / why QVAC

- **Confidentiality is the product.** Supplier IBANs, invoice contents, and payment history must never leave the company perimeter. Local inference is not a feature here — it is the only legally and commercially adoptable architecture.
- **Peer-to-peer delegated inference is QVAC-native.** The four-eyes workflow — one reviewer's device handing a case to another's — is a direct expression of QVAC's delegated-inference primitive over the Holepunch stack.
- **One SDK, full pipeline.** Local LLM reasoning and P2P delegated inference run behind a single cross-platform `@qvac/sdk` import (OCR and embeddings/RAG are in active development; see [Project status](#project-status)). There is no cloud and no external AI API — the only network use is encrypted peer-to-peer discovery and delegation over the public Holepunch DHT, and no cleartext payload ever leaves the company-controlled devices.

## Architecture

```
  Reviewer A — Analyst device (fully local)
  +-------------------------------------------------+
  |  Invoice + supplier email + purchase order      |
  |             |                                   |
  |             v                                   |
  |    OCR --> Parse --> Deterministic risk checks  |
  |             |                    ^              |
  |             v                    |              |
  |    Local RAG over supplier / payment history    |
  |             |                                   |
  |             v                                   |
  |    Reasoning LLM  -->  Verdict + explainable memo|
  |             |                                   |
  |   low risk  v          high value / high risk    |
  |   Approve / Hold ---------------+               |
  +---------------------------------|---------------+
                                    |  P2P delegated inference
                                    |  (Holepunch; falls back to local)
                                    v
  Reviewer B — Senior reviewer device (fully local)
  +-------------------------------------------------+
  |  Independent local model — second opinion       |
  |  Four-eyes / segregation of duties              |
  +---------------------------------|---------------+
                                    v
                Human decision: Approve / Hold / Escalate
                                    |
                                    v
                Audit-evidence bundle (local export)
```

_Today the input is structured intake and the grounding is a deterministic supplier lookup; OCR and embedding-based RAG are the SDK seams being wired (see [Project status](#project-status))._

**Key property:** invoice content, IBANs, and payment history stay within the company-controlled device perimeter and never reach any cloud or third-party AI service. During a four-eyes review, only a minimal case bundle (IBAN masked) moves directly between the two reviewer devices over QVAC's peer-to-peer channel; outside that perimeter, only the verdict and the exported evidence bundle ever leave a review session.

## Risk checks

Each payment request is evaluated against a deterministic rule set, grounded by local RAG and explained by the local reasoning model:

- **Bank account / IBAN change** — does the destination IBAN differ from this supplier's verified history?
- **Duplicate invoice** — same invoice number, or same supplier + amount + near date.
- **Suspicious sender domain** — look-alike or mismatched supplier email domain.
- **Urgency / pressure language** — "pay today", "urgent", off-hours pressure.
- **Invoice / PO mismatch** — amounts or line items that do not reconcile with the purchase order.
- **Abnormal amount** — outside this supplier's normal range.
- **Missing approval evidence** — no matching authorization on file.
- **Inconsistent supplier identity** — name, tax ID, or country drift.

## Example output

Captured from the desk reviewing the synthetic BEC-trap sample with the offline deterministic stub — the same run anyone can reproduce on one machine, no model download needed:

```bash
node packages/ui/src/desk-cli.js examples/sample-data/request-bec-trap.json --decide BLOCK --reviewer "Reviewer A"
```

```
QuorumGate — local pre-payment review  [offline · no data left the device perimeter]
Inference: offline stub (deterministic)

Recommendation (system): HOLD
Risk: 4 check(s) fired
  - [high] iban_change: Destination IBAN is not among the supplier's verified accounts.
  - [high] sender_domain: Sender domain is a look-alike of an approved supplier domain.
  - [low] urgency_language: Pressure / urgency language detected.
  - [medium] abnormal_amount: Amount exceeds the supplier's normal range.

Memo:
  Offline stub: verdict HOLD follows the code-decided floor. Findings: [high] iban_change: ...

Suggested action:
  Verify the bank details with a known supplier contact before any payment.

Final decision (human): BLOCK — Reviewer A (2026-06-10T19:41:08.683Z)

Evidence written: evidence/evidence-bundle.json, evidence/remote-call-disclosure.json
```

With `--model <instruct-gguf>`, the same review runs against a real local model through the QVAC SDK and the memo is written by the model; an inference audit log (TTFT, tokens/sec) is exported alongside the evidence. Every review returns a verdict (Approve / Hold / Escalate), the specific signals that fired, an explainable memo, a suggested next action, the human reviewer's recorded final decision, and an audit-evidence bundle.

## Built with the QVAC SDK

Inference and delegated compute run through [`@qvac/sdk`](https://docs.qvac.tether.io); embeddings/RAG and OCR are wired as SDK seams (see the status notes below). The primitives QuorumGate relies on:

| Primitive | Role in QuorumGate |
|---|---|
| **LLM completion** | An instruct model (loaded as GGUF via the SDK) reasons over the assembled evidence and writes the explainable verdict memo. Tool-calling orchestration is a planned enhancement; the code-orchestrated path is the product. |
| **Embeddings + RAG** | Additive grounding over the company's supplier and payment history (being wired; the deterministic on-device lookup is the current grounding path and remains authoritative). |
| **OCR** | Field extraction from scanned invoices (being wired; structured intake is the current input path). |
| **P2P delegated inference** (Holepunch stack) | The four-eyes second review across two devices, with automatic fallback to local inference. |

QuorumGate runs its reasoning locally through the QVAC SDK using an open instruct model (loaded as a GGUF; the exact model and quantization are pinned during the build and recorded in the reproducibility notes). Everything that infers does so through `@qvac/sdk` — there is no cloud dependency anywhere in the review.

The deterministic risk checks are implemented in plain, auditable code; the model reasons over their output rather than being trusted to enforce the rules itself.

## Requirements

| | |
|---|---|
| **Track** | General Purpose Devices — dedicated hardware up to 32 GB RAM |
| **Runtime** | Node.js LTS, cross-platform (Linux, macOS, Windows) |
| **Inference** | `@qvac/sdk` — 100% local, no cloud, no external AI API |
| **Reasoning model** | Open instruct model in GGUF, run locally via the QVAC SDK |
| **Models** | Downloaded and cached locally; the desk runs fully offline after the first download |
| **License** | Apache 2.0 |

## Repository structure

Monorepo layout (npm workspaces, plain ESM JavaScript, no build step):

```
quorumgate/
├── README.md
├── LICENSE                     Apache 2.0
├── packages/
│   ├── core/                   Deterministic risk checks + verdict floor (zero dependencies)
│   ├── qvac-pipeline/          Review, reasoning model, four-eyes orchestration, on @qvac/sdk
│   ├── p2p-review/             Four-eyes case bundle, delegation, sealed-box module (see status)
│   └── ui/                     Reviewer desk (CLI)
├── scripts/                    Hardware spikes (QVAC SDK, P2P delegated inference)
├── examples/
│   ├── sample-data/            Synthetic payment requests + supplier history
│   └── demo-script.md          Scripted demo walkthrough
├── docs/
│   ├── architecture.md         The three layers, trust boundaries, invariants
│   └── evidence-bundle.md      What the audit export contains
└── evidence/                   Pinned model + measured performance, four-eyes run
```

## Getting started

### Prerequisites

- Node.js LTS (≥ 20) and npm
- A device within the General Purpose track envelope (up to 32 GB RAM)
- For real local inference: an instruct-model GGUF (downloaded below). The offline path needs no model and no network.

### Install and test

```bash
npm install     # or: npm ci  — installs the QVAC SDK and links the workspaces
npm test        # 91 tests; the core package has zero dependencies
```

### Review a payment — single device, fully offline

The desk runs out of the box against a deterministic offline stub — no model download, no network — so the review is instantly reproducible:

```bash
node packages/ui/src/desk-cli.js examples/sample-data/request-bec-trap.json
```

It holds the BEC-trap sample (changed IBAN, look-alike domain, abnormal amount, urgency), prints the verdict, the fired checks, the memo, and a suggested action, and writes the evidence bundle to `evidence/`. Record the human's final decision with `--decide BLOCK --reviewer "<name>"`. (Example output is shown above.)

### Review with a real local model — via the QVAC SDK

Download an instruct GGUF and point the desk at it; the memo is then written by the model, and an inference audit log (TTFT, tokens/sec) is exported alongside the evidence:

```bash
# Pinned model: Qwen3-4B Q4_K_M (~2.4 GB). Cached locally; runs fully offline after.
mkdir -p models
curl -L -o models/Qwen3-4B-Q4_K_M.gguf \
  https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf

node packages/ui/src/desk-cli.js examples/sample-data/request-bec-trap.json \
  --model models/Qwen3-4B-Q4_K_M.gguf
```

Measured on the demo hardware (Intel Core i5-13420H, 15 GB RAM): ~6 s load, 3.4–7.9 s TTFT, ~7.5 tokens/sec — see [`evidence/model-pin.md`](evidence/model-pin.md).

### Four-eyes review — across two devices

On the second reviewer's device, start the provider and note its public key:

```bash
node scripts/spike-p2p.mjs provider          # prints PROVIDER_KEY=...
```

On the first reviewer's device, review a high-value case with the second opinion delegated over QVAC P2P — the peer's model independently reviews the minimal case bundle and returns its own verdict:

```bash
node packages/ui/src/desk-cli.js examples/sample-data/request-bec-trap.json \
  --model models/Qwen3-4B-Q4_K_M.gguf \
  --peer <PROVIDER_KEY> --peer-model <gguf-path-on-the-peer-device> \
  --decide BLOCK --reviewer "<name>"
```

The desk prints the second reviewer's verdict and whether it concurs. If the peer is unreachable, it falls back to a local second opinion, so a verdict is always reached — see [`evidence/four-eyes-run.md`](evidence/four-eyes-run.md).

## Project status

Built during the QVAC Hackathon I window (June 1–21, 2026).

**Working today**

- **Deterministic review (Layer A + B)** — eight risk checks decide a verdict floor in plain, auditable code; a real local model (Qwen3-4B via the QVAC SDK) writes the explainable memo and may only *tighten* the verdict, never loosen it.
- **Four-eyes P2P (Layer C)** — a high-value or high-risk case is delegated to a second reviewer's device over QVAC delegated inference; the peer's model returns its own verdict over the same bundle, with automatic fallback to a local second opinion. Validated across two laptops.
- **Reviewer desk** — a CLI that prints the verdict, fired checks, memo, and suggested action, records the human's final decision, and exports the audit-evidence bundle, the (empty) remote-call disclosure, and the inference audit log.

**In progress**

- OCR and embedding-based RAG through the SDK (today: structured intake + a deterministic supplier lookup, which remains the authoritative grounding).
- A graphical desk UI (today: the CLI).
- The recorded demo video and the full cross-device evidence capture.

## Reproducibility and evidence

- **Run it yourself:** `npm install && npm test` (91 tests), then the quickstart commands above — the offline path needs no model or network.
- **Hardware + pinned model:** [`evidence/model-pin.md`](evidence/model-pin.md) records the demo hardware (CPU, RAM) and the measured load / TTFT / tokens-per-second for the pinned model.
- **Four-eyes run:** [`evidence/four-eyes-run.md`](evidence/four-eyes-run.md) records a real delegated two-device second review and its timings.
- **Audit log:** each `--model` run writes `evidence/audit-log.jsonl` — model loads and per-call inference performance (prompt size, tokens, TTFT, tokens/sec).
- **Remote-call disclosure:** `evidence/remote-call-disclosure.json` is empty by design — QuorumGate makes no cloud or third-party AI calls.
- **Demo video:** recorded walkthrough to come (see [`examples/demo-script.md`](examples/demo-script.md)).

## Scope

QuorumGate is a decision-support tool for a human reviewer. It does not authorize or release payments on its own; a human makes the final decision on every case. It is a demonstration project, not legal or compliance advice, and not a certified financial-controls product.

## License

Licensed under the [Apache License 2.0](LICENSE).

## Links

- Website — https://quorumgate.com
- QVAC — https://qvac.tether.io
- QVAC SDK documentation — https://docs.qvac.tether.io
- QVAC SDK source — https://github.com/tetherto/qvac
- QVAC models — https://huggingface.co/qvac
