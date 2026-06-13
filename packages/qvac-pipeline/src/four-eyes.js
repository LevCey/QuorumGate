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
 * @param {{ providerPublicKey: string, modelSrc: string, modelType?: string, timeout?: number, auditLog?: AuditLog }} opts
 * @returns {DelegateTransport}
 */
export function createDelegatedReviewer({ providerPublicKey, modelSrc, modelType = 'llm', timeout = 60_000, auditLog }) {
  return {
    /**
     * @param {CaseBundle} bundle
     * @returns {Promise<SecondOpinion>}
     */
    async requestReview(bundle) {
      const model = await createQvacModel({
        modelSrc,
        modelType,
        auditLog,
        delegate: { providerPublicKey, fallbackToLocal: false, timeout },
      });
      const result = await reviewBundle(bundle, model);
      return { verdict: result.verdict, memo: result.memo };
    },
  };
}
