// @ts-check
import { runChecks, clampVerdict } from '@quorumgate/core';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';

/** @typedef {import('../../core/src/types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../../core/src/types.js').SupplierHistory} SupplierHistory */
/** @typedef {import('../../core/src/types.js').CheckConfig} CheckConfig */
/** @typedef {import('../../core/src/types.js').CheckResult} CheckResult */
/** @typedef {import('../../core/src/types.js').Verdict} Verdict */
/** @typedef {import('../../core/src/verdict.js').VerdictFloor} VerdictFloor */
/** @typedef {import('./model.js').ReasoningModel} ReasoningModel */

/**
 * Result of a full Layer A + Layer B review.
 * @typedef {object} ReviewResult
 * @property {Verdict} verdict        Final verdict — the model proposal clamped to the floor.
 * @property {Verdict} modelProposed  What the model suggested, before clamping.
 * @property {VerdictFloor} floor     Code-decided floor.
 * @property {CheckResult[]} checks   All check results.
 * @property {string} memo            Explainable memo (model prose).
 */

/** @type {Set<string>} */
const VERDICTS = new Set(['APPROVE', 'HOLD', 'ESCALATE']);

/**
 * Review a payment request end to end: run the deterministic checks (Layer A), ask
 * the reasoning model (Layer B) to explain and propose a verdict, then clamp that
 * proposal to the code-decided floor. The model can only tighten the verdict; a
 * missing or malformed model response falls back to the floor.
 *
 * @param {NormalizedRequest} request
 * @param {SupplierHistory} history
 * @param {ReasoningModel} model
 * @param {CheckConfig} [config]
 * @param {string} [grounding]  Retrieved company-record context (RAG); additive grounding for the memo only.
 * @returns {Promise<ReviewResult>}
 */
export async function reviewPayment(request, history, model, config, grounding) {
  const { results, floor } = runChecks(request, history, config);

  const completion = await model.complete({
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(request, results, floor, grounding),
  });

  const parsed = parseModelOutput(completion.text);
  const proposed = parsed.verdict ?? floor.floor; // conservative fallback
  const verdict = clampVerdict(proposed, floor); // I-1: the model may only tighten

  return {
    verdict,
    modelProposed: proposed,
    floor,
    checks: results,
    memo: parsed.memo ?? completion.text.trim(),
  };
}

/**
 * Parse the model's JSON response. Tolerant of surrounding prose; returns a null
 * verdict when nothing valid is found so the caller falls back to the floor.
 * @param {string} text
 * @returns {{ verdict: Verdict | null, memo: string | null }}
 */
export function parseModelOutput(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return { verdict: null, memo: null };
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    const raw = typeof obj.verdict === 'string' ? obj.verdict.toUpperCase() : null;
    return {
      verdict: raw && VERDICTS.has(raw) ? /** @type {Verdict} */ (raw) : null,
      memo: typeof obj.memo === 'string' ? obj.memo : null,
    };
  } catch {
    return { verdict: null, memo: null };
  }
}
