// @ts-check
/** @typedef {import('../../core/src/types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../../core/src/types.js').CheckResult} CheckResult */
/** @typedef {import('../../core/src/verdict.js').VerdictFloor} VerdictFloor */

/**
 * The minimal case bundle sent to a second reviewer's device for four-eyes review.
 * It carries only the minimum necessary review material — never raw files or the
 * full supplier email — so the data crossing devices stays minimal even inside the
 * company-controlled perimeter (D3, R7.2). The destination IBAN is masked.
 * @typedef {object} CaseBundle
 * @property {{ id: string, name?: string }} supplier
 * @property {{ amount?: number, currency?: string, invoiceNumber?: string, destinationIban: string }} payment
 * @property {{ checkId: string, severity: string, evidence: Record<string, unknown> }[]} firedChecks
 * @property {VerdictFloor} floor
 */

/**
 * Build the minimal case bundle for delegated review. Only the fired checks (with
 * their evidence snippets) and a curated subset of payment fields are included; the
 * raw message text, tax id, approval refs, and full supplier history are deliberately
 * left out.
 *
 * @param {NormalizedRequest} request
 * @param {CheckResult[]} results
 * @param {VerdictFloor} floor
 * @returns {CaseBundle}
 */
export function buildCaseBundle(request, results, floor) {
  /** @type {CaseBundle['payment']} */
  const payment = { destinationIban: maskIban(request.destinationIban) };
  if (request.amount != null) payment.amount = request.amount;
  if (request.currency) payment.currency = request.currency;
  if (request.invoiceNumber) payment.invoiceNumber = request.invoiceNumber;

  return {
    supplier: {
      id: request.supplierId,
      ...(request.supplierName ? { name: request.supplierName } : {}),
    },
    payment,
    firedChecks: results
      .filter((r) => r.status === 'FAIL')
      .map((r) => ({ checkId: r.checkId, severity: r.severity, evidence: r.evidence })),
    floor,
  };
}

/**
 * Mask all but the last four characters of an IBAN.
 * @param {string} iban
 * @returns {string}
 */
function maskIban(iban) {
  const trimmed = iban.replace(/\s+/g, '');
  if (trimmed.length <= 4) return trimmed;
  return `${'•'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}
