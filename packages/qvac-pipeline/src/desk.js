// @ts-check
import { normalizeRequest } from './intake.js';
import { reviewPayment } from './review.js';
import { buildEvidenceBundle } from './evidence.js';

/** @typedef {import('./supplier-store.js').SupplierStore} SupplierStore */
/** @typedef {import('./model.js').ReasoningModel} ReasoningModel */
/** @typedef {import('./review.js').ReviewResult} ReviewResult */
/** @typedef {import('./evidence.js').EvidenceBundle} EvidenceBundle */
/** @typedef {import('../../core/src/types.js').CheckConfig} CheckConfig */

/**
 * Run a full single-device desk review: normalize the dropped request, look up the
 * supplier's history, run Layer A + B, and assemble the audit-evidence bundle. This
 * is the judge-reproducible single-device path (R11.6) — no second device required.
 *
 * An unknown supplier is reviewed against an empty history, so the checks (e.g. the
 * IBAN-change check) naturally treat the destination as unverified.
 *
 * @param {Record<string, unknown>} rawInput
 * @param {SupplierStore} store
 * @param {ReasoningModel} model
 * @param {{ config?: CheckConfig, now?: string }} [options]
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
  const bundle = buildEvidenceBundle({ request: intake.request, review, generatedAt: options.now });

  return { intake, review, bundle, knownSupplier: history !== null };
}
