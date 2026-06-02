// @ts-check
/** @typedef {import('../types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../types.js').SupplierHistory} SupplierHistory */
/** @typedef {import('../types.js').CheckResult} CheckResult */

export const CHECK_ID = 'supplier_identity';

/**
 * Inconsistent-supplier-identity check (medium). Fails when the supplier name, tax
 * ID, or country on the request differs from the record on file. Name and country
 * are compared case-insensitively; tax ID is compared exactly.
 *
 * @param {NormalizedRequest} request
 * @param {SupplierHistory} history
 * @returns {CheckResult}
 */
export function checkSupplierIdentity(request, history) {
  /** @type {{ field: string, request: string, onFile: string }[]} */
  const drifts = [];
  let comparable = false;

  /**
   * @param {string} field
   * @param {string | undefined} a
   * @param {string | undefined} b
   * @param {boolean} caseInsensitive
   */
  const compare = (field, a, b, caseInsensitive) => {
    if (a == null || b == null) return;
    comparable = true;
    const x = caseInsensitive ? a.trim().toLowerCase() : a.trim();
    const y = caseInsensitive ? b.trim().toLowerCase() : b.trim();
    if (x !== y) drifts.push({ field, request: a, onFile: b });
  };

  compare('supplierName', request.supplierName, history.supplierName, true);
  compare('taxId', request.taxId, history.taxId, false);
  compare('country', request.country, history.country, true);

  if (!comparable) {
    return mk('SKIP', { note: 'No comparable identity fields.' });
  }
  if (drifts.length > 0) {
    return mk('FAIL', { drifts, note: 'Supplier identity differs from the record on file.' });
  }
  return mk('PASS', {});
}

/**
 * @param {import('../types.js').CheckStatus} status
 * @param {Record<string, unknown>} evidence
 * @returns {CheckResult}
 */
function mk(status, evidence) {
  return { checkId: CHECK_ID, status, severity: 'medium', evidence };
}
