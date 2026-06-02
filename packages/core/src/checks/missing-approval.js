// @ts-check
/** @typedef {import('../types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../types.js').SupplierHistory} SupplierHistory */
/** @typedef {import('../types.js').CheckResult} CheckResult */

export const CHECK_ID = 'missing_approval';

/**
 * Missing-approval check (medium). Fails when the payment carries no authorization
 * reference, or when the reference is not on file for the supplier.
 *
 * @param {NormalizedRequest} request
 * @param {SupplierHistory} history
 * @returns {CheckResult}
 */
export function checkMissingApproval(request, history) {
  const ref = request.approvalRef?.trim();

  if (!ref) {
    return mk('FAIL', { note: 'No authorization reference attached to the payment.' });
  }

  const approved = history.approvedRefs;
  if (approved && !approved.map((r) => r.trim()).includes(ref)) {
    return mk('FAIL', { approvalRef: ref, note: 'Authorization reference is not on file.' });
  }
  return mk('PASS', { approvalRef: ref });
}

/**
 * @param {import('../types.js').CheckStatus} status
 * @param {Record<string, unknown>} evidence
 * @returns {CheckResult}
 */
function mk(status, evidence) {
  return { checkId: CHECK_ID, status, severity: 'medium', evidence };
}
