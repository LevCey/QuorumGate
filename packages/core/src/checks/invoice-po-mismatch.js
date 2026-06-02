// @ts-check
/** @typedef {import('../types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../types.js').CheckConfig} CheckConfig */
/** @typedef {import('../types.js').CheckResult} CheckResult */

export const CHECK_ID = 'invoice_po_mismatch';

/**
 * Invoice / purchase-order mismatch check (medium). Fails when the invoice amount
 * does not reconcile with the linked PO total within tolerance. Skipped when no PO
 * is supplied.
 *
 * @param {NormalizedRequest} request
 * @param {CheckConfig} config
 * @returns {CheckResult}
 */
export function checkInvoicePoMismatch(request, config) {
  const po = request.purchaseOrder;
  if (!po || request.amount == null) {
    return mk('SKIP', { note: 'No purchase order linked to the request.' });
  }

  const diff = Math.abs(request.amount - po.total);
  const relative = po.total === 0 ? (diff === 0 ? 0 : 1) : diff / Math.abs(po.total);
  const tolerance = config.invoicePoMismatch.amountTolerance;

  if (relative > tolerance) {
    return mk('FAIL', {
      invoiceAmount: request.amount,
      poTotal: po.total,
      relativeDifference: round(relative),
      tolerance,
      note: 'Invoice amount does not reconcile with the purchase order.',
    });
  }
  return mk('PASS', { invoiceAmount: request.amount, poTotal: po.total });
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
  return Math.round(x * 1000) / 1000;
}
