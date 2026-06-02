// @ts-check
/** @typedef {import('../types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../types.js').SupplierHistory} SupplierHistory */
/** @typedef {import('../types.js').CheckConfig} CheckConfig */
/** @typedef {import('../types.js').CheckResult} CheckResult */

export const CHECK_ID = 'abnormal_amount';

/**
 * Abnormal-amount check (medium). Fails when the amount exceeds a configurable
 * multiple of the supplier's historical mean. Skipped when there is no amount or no
 * historical amounts to compare against.
 *
 * @param {NormalizedRequest} request
 * @param {SupplierHistory} history
 * @param {CheckConfig} config
 * @returns {CheckResult}
 */
export function checkAbnormalAmount(request, history, config) {
  const past = history.pastAmounts ?? [];
  if (request.amount == null || past.length === 0) {
    return mk('SKIP', { note: 'No amount or no historical amounts for this supplier.' });
  }

  const mean = past.reduce((sum, x) => sum + x, 0) / past.length;
  const threshold = mean * config.abnormalAmount.meanMultiple;

  if (mean > 0 && request.amount > threshold) {
    return mk('FAIL', {
      amount: request.amount,
      historicalMean: round(mean),
      threshold: round(threshold),
      multiple: config.abnormalAmount.meanMultiple,
      note: "Amount exceeds the supplier's normal range.",
    });
  }
  return mk('PASS', { amount: request.amount, historicalMean: round(mean) });
}

/**
 * @param {import('../types.js').CheckStatus} status
 * @param {Record<string, unknown>} evidence
 * @returns {CheckResult}
 */
function mk(status, evidence) {
  return { checkId: CHECK_ID, status, severity: 'medium', evidence };
}

/** @param {number} x @returns {number} */
function round(x) {
  return Math.round(x * 100) / 100;
}
