// @ts-check
/** @typedef {import('../../core/src/types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../../core/src/types.js').Verdict} Verdict */
/** @typedef {import('../../core/src/verdict.js').VerdictFloor} VerdictFloor */
/** @typedef {import('./case-bundle.js').CaseBundle} CaseBundle */

/**
 * @typedef {object} DelegationConfig
 * @property {number} highValueThreshold  Amount at or above which a case goes to four-eyes.
 */

/** @type {DelegationConfig} */
export const DELEGATION_DEFAULTS = { highValueThreshold: 10000 };

/**
 * Decide whether a case should be delegated to a second reviewer (four-eyes). A case
 * delegates when it is high-value (amount ≥ threshold) or high-risk (the code-decided
 * floor is escalate-eligible). Per D3 / R7.1.
 *
 * @param {NormalizedRequest} request
 * @param {VerdictFloor} floor
 * @param {DelegationConfig} [config]
 * @returns {boolean}
 */
export function shouldDelegate(request, floor, config = DELEGATION_DEFAULTS) {
  const highValue = request.amount != null && request.amount >= config.highValueThreshold;
  return highValue || floor.escalateEligible;
}

/**
 * A second reviewer's opinion on a delegated case.
 * @typedef {object} SecondOpinion
 * @property {Verdict} verdict
 * @property {boolean} concur   Whether the second reviewer agrees with the first.
 * @property {string} [memo]
 */

/**
 * Transport that delivers a case bundle to a peer device and returns its opinion.
 * The concrete implementation is the QVAC P2P (Holepunch) adapter — the single SDK
 * seam. `requestReview` rejects when no peer is reachable.
 * @typedef {object} DelegateTransport
 * @property {(bundle: CaseBundle) => Promise<SecondOpinion>} requestReview
 */

/**
 * Obtain a second opinion: try the peer transport, and on any failure (or when no
 * transport is configured) fall back to a local second review. A verdict is always
 * reached — this is the `fallbackToLocal` guarantee (R7.4, I-5).
 *
 * @param {CaseBundle} bundle
 * @param {DelegateTransport | null} transport
 * @param {() => Promise<SecondOpinion>} localReview
 * @returns {Promise<{ opinion: SecondOpinion, source: 'peer' | 'local' }>}
 */
export async function getSecondOpinion(bundle, transport, localReview) {
  if (transport) {
    try {
      return { opinion: await transport.requestReview(bundle), source: 'peer' };
    } catch {
      // No peer reachable / transport error — fall back to a local second review.
    }
  }
  return { opinion: await localReview(), source: 'local' };
}
