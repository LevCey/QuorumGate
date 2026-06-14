// @ts-check
import { createQvacModel } from './qvac-model.js';
import { reviewBundle } from './review-bundle.js';

/** @typedef {import('../../p2p-review/src/case-bundle.js').CaseBundle} CaseBundle */
/** @typedef {import('../../p2p-review/src/delegate.js').SecondOpinion} SecondOpinion */
/** @typedef {import('../../p2p-review/src/delegate.js').DelegateTransport} DelegateTransport */
/** @typedef {import('./audit-log.js').AuditLog} AuditLog */

/**
 * Build a four-eyes transport backed by QVAC delegated inference: the second
 * reviewer's device (the provider, addressed by its public key) runs the reasoning
 * model and returns an independent opinion on the minimal case bundle. The model
 * source is resolved on the provider device.
 *
 * `fallbackToLocal` is OFF here on purpose: if the peer is unreachable the delegated
 * load throws, so the caller's own fallback ({@link getSecondOpinion} → local review)
 * runs and the recorded source ('peer' vs 'local') stays truthful. A new delegated
 * model is created per request so a transient peer failure surfaces as a throw.
 *
 * `contextSize` (`ctx_size`) and `maxPredict` (`predict`) bound the peer model so it
 * returns an opinion instead of running away. The second-reviewer prompt plus a memo
 * must fit the context, and the generation must stop: a small model that never emits a
 * stop token keeps generating until it either overflows the context
 * (`processPromptImpl: context overflow`) or fills it (a multi-minute hang). `ctx_size`
 * gives the prompt and memo room; `predict` caps generated tokens so an
 * instruction-ignoring model is still bounded. The verdict is clamped to the floor
 * regardless, so a truncated or malformed memo degrades safely to the floor.
 *
 * @param {{ providerPublicKey: string, modelSrc: string, modelType?: string, timeout?: number, contextSize?: number, maxPredict?: number, auditLog?: AuditLog }} opts
 * @returns {DelegateTransport}
 */
export function createDelegatedReviewer({ providerPublicKey, modelSrc, modelType = 'llm', timeout = 180_000, contextSize = 4096, maxPredict = 1024, auditLog }) {
  return {
    /**
     * @param {CaseBundle} bundle
     * @returns {Promise<SecondOpinion>}
     */
    async requestReview(bundle) {
      const model = await createQvacModel({
        modelSrc,
        modelType,
        modelConfig: { ctx_size: contextSize, predict: maxPredict },
        auditLog,
        delegate: { providerPublicKey, fallbackToLocal: false, timeout },
      });
      const result = await reviewBundle(bundle, model);
      return { verdict: result.verdict, memo: result.memo };
    },
  };
}
