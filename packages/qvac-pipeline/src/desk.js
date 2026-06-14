// @ts-check
import { moreConservative, clampVerdict } from '@quorumgate/core';
import { shouldDelegate, buildCaseBundle, getSecondOpinion } from '@quorumgate/p2p-review';
import { normalizeRequest } from './intake.js';
import { reviewPayment } from './review.js';
import { reviewBundle } from './review-bundle.js';
import { buildEvidenceBundle } from './evidence.js';

/** @typedef {import('./supplier-store.js').SupplierStore} SupplierStore */
/** @typedef {import('./model.js').ReasoningModel} ReasoningModel */
/** @typedef {import('./review.js').ReviewResult} ReviewResult */
/** @typedef {import('./evidence.js').EvidenceBundle} EvidenceBundle */
/** @typedef {import('../../core/src/types.js').CheckConfig} CheckConfig */
/** @typedef {import('../../p2p-review/src/delegate.js').DelegateTransport} DelegateTransport */
/** @typedef {import('../../p2p-review/src/delegate.js').DelegationConfig} DelegationConfig */
/** @typedef {import('./supplier-memory.js').SupplierMemory} SupplierMemory */
/** @typedef {import('./embedder.js').Embedder} Embedder */

/** The decisions a human reviewer may record. BLOCK is the Escalate→Block action. */
export const HUMAN_DECISIONS = new Set(['APPROVE', 'HOLD', 'ESCALATE', 'BLOCK']);

/**
 * @typedef {object} HumanDecision
 * @property {string} decision   One of {@link HUMAN_DECISIONS}.
 * @property {string} reviewer   Who made the decision.
 * @property {string} at         ISO timestamp.
 */

/**
 * Validate and stamp a human reviewer's final decision. The system only ever
 * recommends; the human decides (R1.3), so the decision is recorded separately from
 * the model verdict.
 *
 * @param {string} decision
 * @param {string} reviewer
 * @param {string} [at]
 * @returns {HumanDecision}
 */
export function makeHumanDecision(decision, reviewer, at) {
  const normalized = String(decision).toUpperCase();
  if (!HUMAN_DECISIONS.has(normalized)) {
    throw new Error(`Invalid human decision "${decision}" (expected one of ${[...HUMAN_DECISIONS].join(', ')}).`);
  }
  if (!reviewer || !reviewer.trim()) {
    throw new Error('A human decision requires a reviewer name.');
  }
  return { decision: normalized, reviewer: reviewer.trim(), at: at ?? new Date().toISOString() };
}

/**
 * Run a full single-device desk review: normalize the dropped request, look up the
 * supplier's history, run Layer A + B, and assemble the audit-evidence bundle. This
 * is the judge-reproducible single-device path (R11.6) — no second device required.
 *
 * The system produces a recommendation (the verdict); the human makes the final
 * decision (R1.3). Pass `options.humanDecision` to record that decision in the
 * bundle. An unknown supplier is reviewed against an empty history, so the checks
 * (e.g. the IBAN-change check) naturally treat the destination as unverified.
 *
 * Pass `options.fourEyes` to enable Layer C: a high-value or high-risk case gets an
 * independent second opinion (from the peer device when a transport is configured,
 * otherwise a local fallback). The second reviewer can only tighten the
 * recommendation; a verdict is always reached.
 *
 * @param {Record<string, unknown>} rawInput
 * @param {SupplierStore} store
 * @param {ReasoningModel} model
 * @param {{ config?: CheckConfig, now?: string, humanDecision?: { decision: string, reviewer: string }, fourEyes?: { transport?: DelegateTransport | null, localModel?: ReasoningModel, config?: DelegationConfig, requirePeer?: boolean }, retrieval?: { memory: SupplierMemory, embedder: Embedder }, provenance?: unknown }} [options]
 * @returns {Promise<{
 *   intake: ReturnType<typeof normalizeRequest>,
 *   review: ReviewResult,
 *   secondReview: Record<string, unknown> | null,
 *   recommendation: import('../../core/src/types.js').Verdict,
 *   bundle: EvidenceBundle,
 *   knownSupplier: boolean,
 * }>}
 */
export async function runDeskReview(rawInput, store, model, options = {}) {
  const intake = normalizeRequest(rawInput);
  if (intake.missing.length > 0) {
    throw new Error(`Cannot review: missing required field(s) — ${intake.missing.join(', ')}.`);
  }

  const history = store.lookup(intake.request.supplierId);

  // Optional local RAG: ground the memo in the company's own supplier records. Additive
  // only — the deterministic checks and the verdict floor are unaffected.
  let grounding;
  if (options.retrieval) {
    const query = `${intake.request.supplierName ?? intake.request.supplierId} ${intake.request.amount ?? ''} ${intake.request.currency ?? ''}`.trim();
    const hits = await options.retrieval.memory.retrieve(query, options.retrieval.embedder);
    grounding = hits.map((h) => h.text).join('\n');
  }

  const review = await reviewPayment(
    intake.request,
    history ?? { supplierId: intake.request.supplierId, verifiedIbans: [] },
    model,
    options.config,
    grounding,
  );

  // Layer C (four-eyes): an independent second opinion for high-value/high-risk cases.
  let secondReview = null;
  let recommendation = review.verdict;
  if (options.fourEyes && shouldDelegate(intake.request, review.floor, options.fourEyes.config)) {
    const caseBundle = buildCaseBundle(intake.request, review.checks, review.floor);
    const localModel = options.fourEyes.localModel ?? model;
    const { opinion, source } = await getSecondOpinion(
      caseBundle,
      options.fourEyes.transport ?? null,
      async () => {
        const r = await reviewBundle(caseBundle, localModel);
        return { verdict: r.verdict, memo: r.memo };
      },
    );
    const independent = source === 'peer';
    if (options.fourEyes.requirePeer && !independent) {
      // An independent second review was required but the peer was unreachable. Do not
      // pass the local self-review off as independent, and do not yield an approved-
      // looking outcome — hold pending a real second review (segregation of duties).
      recommendation = clampVerdict(moreConservative(review.verdict, 'HOLD'), review.floor);
      secondReview = {
        source,
        independent: false,
        obtained: false,
        reviewer: 'none (independent peer review required, peer unavailable)',
        verdict: null,
        memo: 'Independent second review was required but could not be obtained; the local fallback is not counted as an independent opinion.',
      };
    } else {
      recommendation = clampVerdict(moreConservative(review.verdict, opinion.verdict), review.floor);
      secondReview = {
        source,
        independent,
        obtained: true,
        reviewer: source === 'peer' ? 'second device (peer)' : 'local fallback',
        verdict: opinion.verdict,
        concur: opinion.verdict === review.verdict,
        memo: opinion.memo ?? null,
      };
    }
  }

  const humanDecision = options.humanDecision
    ? makeHumanDecision(options.humanDecision.decision, options.humanDecision.reviewer, options.now)
    : null;

  const bundle = buildEvidenceBundle({
    request: intake.request,
    review,
    secondReview,
    finalVerdict: recommendation,
    provenance: options.provenance,
    humanDecision,
    generatedAt: options.now,
  });

  return { intake, review, secondReview, recommendation, bundle, knownSupplier: history !== null };
}
