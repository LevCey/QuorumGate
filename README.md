# QuorumGate

**Confidential Multi-Reviewer Risk Desk.** A local-first pre-payment review desk that reads invoices and supplier messages on the finance team's own devices, flags payment fraud before money moves, and — for high-risk cases — enforces a four-eyes review peer-to-peer between two devices. No cloud. No external API. Sensitive payment data never leaves the device perimeter.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Status](https://img.shields.io/badge/status-in%20development-orange.svg)
![Built with](https://img.shields.io/badge/built%20with-QVAC%20SDK-black.svg)
![Track](https://img.shields.io/badge/track-General%20Purpose%20Devices-informational.svg)

> **Status — in active development for [QVAC Hackathon I — Unleash Edge AI](https://dorahacks.io/hackathon/qvac-unleach-edge-ai-i/detail) (build period June 1–21, 2026).** This README describes the target architecture and is updated as components land. All AI inference runs locally through the QVAC SDK; there is no cloud dependency.

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

1. **Reads** the documents locally (OCR + parsing).
2. **Grounds** them against the company's own supplier and payment history (local RAG).
3. **Checks** them against a deterministic risk-rule set.
4. **Reasons** over the assembled evidence with a local QVAC Psy model and produces a structured verdict — **Approve / Hold / Escalate** — with an explainable memo that cites the grounding evidence.
5. **Returns** the decision to a human, who makes the final call and exports an audit-evidence bundle.

### Four-eyes across two devices — the differentiator

For high-value or high-risk cases, QuorumGate delegates the case to a **second reviewer's device** over QVAC's peer-to-peer delegated inference. A second, independent local model produces its own opinion — the **four-eyes principle** (segregation of duties) enforced across devices, with the raw documents never leaving either machine. If no peer is available, the review falls back to local inference, so a verdict is always reached.

This "second reviewer on a second device, fully offline" step maps a real compliance control — dual authorization — directly onto QVAC's most distinctive primitive, and is what separates QuorumGate from any single-machine document tool.

## Why local AI / why QVAC

- **Confidentiality is the product.** Supplier IBANs, invoice contents, and payment history must never leave the company perimeter. Local inference is not a feature here — it is the only legally and commercially adoptable architecture.
- **Peer-to-peer delegated inference is QVAC-native.** The four-eyes workflow — one reviewer's device handing a case to another's — is a direct expression of QVAC's delegated-inference primitive over the Holepunch stack.
- **One SDK, full pipeline.** OCR, embeddings, RAG, local LLM reasoning, and P2P delegation all live behind a single cross-platform `@qvac/sdk` import, so the entire review runs on a laptop with no external services.

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
  |    QVAC Psy  -->  Verdict + explainable memo     |
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

**Key property:** raw documents, IBANs, and payment history stay on the reviewer devices. Only the verdict and the exported evidence bundle ever leave a review session.

## Risk checks

Each payment request is evaluated against a deterministic rule set, grounded by local RAG and explained by the QVAC Psy model:

- **Bank account / IBAN change** — does the destination IBAN differ from this supplier's verified history?
- **Duplicate invoice** — same invoice number, or same supplier + amount + near date.
- **Suspicious sender domain** — look-alike or mismatched supplier email domain.
- **Urgency / pressure language** — "pay today", "urgent", off-hours pressure.
- **Invoice / PO mismatch** — amounts or line items that do not reconcile with the purchase order.
- **Abnormal amount** — outside this supplier's normal range.
- **Missing approval evidence** — no matching authorization on file.
- **Inconsistent supplier identity** — name, tax ID, or country drift.

## Example output

```
Verdict: HOLD

Reasons:
- Supplier bank IBAN differs from the verified record on file (last 11 payments).
- Sender domain does not match the approved supplier domain.
- Invoice amount is 2.8x this supplier's historical average.
- No matching purchase order found.

Second reviewer (Device B): CONCUR — HOLD.
All analysis performed locally on both devices. No data left the perimeter.

Suggested action:
Verify bank details with a known contact before payment.
```

Every review returns a verdict (Approve / Hold / Escalate), a risk level with the specific signals that fired, an explainable memo citing the grounding evidence, a suggested next action, and an audit-evidence bundle.

## Built with the QVAC SDK

All inference, embeddings, RAG, OCR, and delegated compute run through [`@qvac/sdk`](https://docs.qvac.tether.io). The primitives QuorumGate relies on:

| Primitive | Role in QuorumGate |
|---|---|
| **LLM completion (QVAC Psy)** | Reasons over the assembled evidence and writes the explainable verdict memo. |
| **Embeddings + RAG** | Grounds the risk checks in the company's own supplier and payment history. |
| **OCR** | Extracts fields from scanned or photographed invoices. |
| **P2P delegated inference** (Holepunch stack) | The four-eyes second review across two devices, with automatic fallback to local inference. |

QuorumGate routes all reasoning through **QVAC Psy**, Tether's foundational reasoning model — not the medical *MedPsy* variant. The exact model build and quantization are pinned during the build period and recorded in the reproducibility notes.

The deterministic risk checks are implemented in plain, auditable code; the model reasons over their output rather than being trusted to enforce the rules itself.

## Requirements

| | |
|---|---|
| **Track** | General Purpose Devices — dedicated hardware up to 32 GB RAM |
| **Runtime** | Node.js LTS, cross-platform (Linux, macOS, Windows) |
| **Inference** | `@qvac/sdk` — 100% local, no cloud, no external AI API |
| **Reasoning model** | QVAC Psy (foundational), run locally |
| **Models** | Downloaded and cached locally; the desk runs fully offline after the first download |
| **License** | Apache 2.0 |

## Repository structure

Target layout, built out over the hackathon:

```
quorumgate/
├── README.md
├── LICENSE                     Apache 2.0
├── packages/
│   ├── core/                   Deterministic risk-rules engine
│   ├── qvac-pipeline/          OCR -> RAG -> QVAC Psy verdict, on @qvac/sdk
│   ├── p2p-review/             Four-eyes delegated inference + local fallback
│   └── ui/                     Reviewer desk UI
├── examples/
│   ├── sample-invoices/        Synthetic invoices + supplier history
│   └── demo-script.md          Scripted demo walkthrough
├── docs/
│   ├── architecture.md
│   └── evidence-bundle.md      What the audit export contains
└── evidence/                   Reproducibility bundle: logs, demo video, benchmarks
```

## Getting started

### Prerequisites

- Node.js LTS and npm
- A device within the General Purpose track envelope (up to 32 GB RAM)
- The QVAC SDK:

  ```bash
  npm install @qvac/sdk
  ```

- A local QVAC Psy model build (downloaded and cached on first run)

### Running the desk

Setup and run instructions are finalized during the build period as components land, and are verified against the declared hardware in the reproducibility notes. Once models are cached, the desk runs fully offline.

## Project status and roadmap

QuorumGate is being built during the QVAC Hackathon I build window (June 1–21, 2026).

- **Core pipeline** — OCR to structured fields, deterministic risk rules, QVAC Psy verdict + explainable memo, local supplier-history RAG; a working single-device review.
- **Four-eyes P2P** — delegated inference to a second reviewer device over the Holepunch stack, with automatic fallback to local inference.
- **Reviewer desk** — a clean UI with a visible Approve / Hold / Escalate decision and audit-evidence export.
- **Evidence** — reproducibility instructions, hardware specs, audit logs, and a demo video.

## Reproducibility and evidence

In line with the hackathon's evidence framework, the repository will ship:

- Reproducibility instructions and hardware specs (CPU, GPU, RAM, storage) for every device used in the demo.
- A structured audit log capturing model loads/unloads and per-call inference performance (prompt, tokens, TTFT, tokens/sec).
- A remote-call disclosure file. QuorumGate performs no cloud AI calls, so this disclosure is empty by design — all inference is local.
- A demo video.

## Scope

QuorumGate is a decision-support tool for a human reviewer. It does not authorize or release payments on its own; a human makes the final decision on every case. It is a demonstration project, not legal or compliance advice, and not a certified financial-controls product.

## License

Licensed under the [Apache License 2.0](LICENSE).

## Links

- QVAC — https://qvac.tether.io
- QVAC SDK documentation — https://docs.qvac.tether.io
- QVAC SDK source — https://github.com/tetherto/qvac
- QVAC models — https://huggingface.co/qvac
