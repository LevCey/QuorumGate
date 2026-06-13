// @ts-check
import { clampVerdict } from '@quorumgate/core';
import { parseModelOutput } from './review.js';
import { buildSecondReviewerSystemPrompt, buildBundleUserPrompt } from './prompt.js';

/** @typedef {import('../../core/src/types.js').Verdict} Verdict */
/** @typedef {import('../../p2p-review/src/case-bundle.js').CaseBundle} CaseBundle */
/** @typedef {import('./model.js').ReasoningModel} ReasoningModel */

/**
 * An independent second reasoning pass over a minimal case bundle — what the second
 * reviewer's device does in a four-eyes review. It sees only the bundle (the fired
 * checks, the floor, and curated payment fields with the IBAN masked), never the raw
 * request, and its proposal is clamped to the same floor: the second reviewer can
 * tighten the verdict but never loosen it (I-1 holds on the second device too).
 *
 * The same function backs both the delegated peer review (running on the peer device)
 * and the local-fallback second opinion, so the two paths are identical except for
 * which model instance runs.
 *
 * @param {CaseBundle} bundle
 * @param {ReasoningModel} model
 * @returns {Promise<{ verdict: Verdict, modelProposed: Verdict, memo: string }>}
 */
export async function reviewBundle(bundle, model) {
  const completion = await model.complete({
    system: buildSecondReviewerSystemPrompt(),
    prompt: buildBundleUserPrompt(bundle),
  });

  const parsed = parseModelOutput(completion.text);
  const proposed = parsed.verdict ?? bundle.floor.floor; // conservative fallback
  const verdict = clampVerdict(proposed, bundle.floor);

  return { verdict, modelProposed: proposed, memo: parsed.memo ?? completion.text.trim() };
}
