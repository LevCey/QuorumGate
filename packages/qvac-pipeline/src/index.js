// @ts-check
// Layer B — the QVAC-SDK pipeline: local OCR + parsing, supplier-history RAG, and
// the reasoning model that writes the verdict memo (with tool calling for
// orchestration). The deterministic checks and the verdict floor live in
// @quorumgate/core; this layer reasons over their output and may only tighten the
// floor, never loosen it. See the project README for the three-layer architecture.
// Implementation lands in Week 1.
export {};
