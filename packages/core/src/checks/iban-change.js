// @ts-check
/** @typedef {import('../types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../types.js').SupplierHistory} SupplierHistory */
/** @typedef {import('../types.js').CheckResult} CheckResult */

export const CHECK_ID = 'iban_change';

/**
 * Bank-account / IBAN change check.
 *
 * Fails (high severity) when the payment's destination IBAN is not among the
 * supplier's verified accounts. A changed payee account is the strongest single
 * signal of business email compromise, so a failure forbids approval.
 *
 * @param {NormalizedRequest} request
 * @param {SupplierHistory} history
 * @returns {CheckResult}
 */
export function checkIbanChange(request, history) {
  const target = normalizeIban(request.destinationIban);
  const known = history.verifiedIbans.some((iban) => normalizeIban(iban) === target);

  if (known) {
    return {
      checkId: CHECK_ID,
      status: 'PASS',
      severity: 'high',
      evidence: { destinationIban: maskIban(request.destinationIban) },
    };
  }

  return {
    checkId: CHECK_ID,
    status: 'FAIL',
    severity: 'high',
    evidence: {
      destinationIban: maskIban(request.destinationIban),
      verifiedIbanCount: history.verifiedIbans.length,
      note: "Destination IBAN is not among the supplier's verified accounts.",
    },
  };
}

/**
 * @param {string} iban
 * @returns {string}
 */
function normalizeIban(iban) {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/**
 * Mask all but the last four characters of an IBAN for logging.
 * @param {string} iban
 * @returns {string}
 */
function maskIban(iban) {
  const trimmed = iban.replace(/\s+/g, '');
  if (trimmed.length <= 4) return trimmed;
  return `${'•'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}
