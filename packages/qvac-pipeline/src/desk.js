// @ts-check
import { normalizeRequest } from './intake.js';
import { reviewPayment } from './review.js';
import { buildEvidenceBundle } from './evidence.js';

/** @typedef {import('./supplier-store.js').SupplierStore} SupplierStore */
/** @typedef {import('./model.js').ReasoningModel} ReasoningModel */
/** @typedef {import('./review.js').ReviewResult} ReviewResult */
/** @typedef {import('./evidence.js').EvidenceBundle} EvidenceBundle */
/** @typedef {import('../../core/src/types.js').CheckConfig} CheckConfig */

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
 * @param {Record<string, unknown>} rawInput
 * @param {SupplierStore} store
 * @param {ReasoningModel} model
 * @param {{ config?: CheckConfig, now?: string, humanDecision?: { decision: string, reviewer: string } }} [options]
 * @returns {Promise<{
 *   intake: ReturnType<typeof normalizeRequest>,
 *   review: ReviewResult,
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
  const review = await reviewPayment(
    intake.request,
    history ?? { supplierId: intake.request.supplierId, verifiedIbans: [] },
    model,
    options.config,
  );

  const humanDecision = options.humanDecision
    ? makeHumanDecision(options.humanDecision.decision, options.humanDecision.reviewer, options.now)
    : null;

  const bundle = buildEvidenceBundle({ request: intake.request, review, humanDecision, generatedAt: options.now });

  return { intake, review, bundle, knownSupplier: history !== null };
}
