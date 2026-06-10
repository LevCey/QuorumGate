// @ts-check
/** @typedef {import('./types.js').CheckResult} CheckResult */

/**
 * Deterministic next-action guidance per failed check. Like the checks themselves,
 * the suggestion is decided by code, not by the model: the action for the most
 * severe fired check wins, in the order listed here.
 * @type {{ checkId: string, action: string }[]}
 */
const ACTIONS = [
  { checkId: 'iban_change', action: 'Verify the bank details with a known supplier contact before any payment.' },
  { checkId: 'sender_domain', action: 'Confirm the request through a known channel; do not reply to the sender address.' },
  { checkId: 'duplicate_invoice', action: 'Check whether this invoice was already paid before processing it again.' },
  { checkId: 'supplier_identity', action: 'Verify the supplier identity against the master record before proceeding.' },
  { checkId: 'missing_approval', action: 'Obtain the missing authorization before processing the payment.' },
  { checkId: 'invoice_po_mismatch', action: 'Reconcile the invoice against the purchase order before approval.' },
  { checkId: 'abnormal_amount', action: 'Confirm the amount with the requester before approval.' },
  { checkId: 'urgency_language', action: 'Treat the urgency as a pressure signal and follow the standard payment schedule.' },
];

const SEVERITY_RANK = { high: 2, medium: 1, low: 0 };

/**
 * Suggest the single next action for a review: the action mapped to the most severe
 * fired check (ties broken by the ACTIONS order). Returns null when nothing fired.
 *
 * @param {CheckResult[]} results
 * @returns {string | null}
 */
export function suggestAction(results) {
  const fired = results.filter((r) => r.status === 'FAIL');
  if (fired.length === 0) return null;

  let best = null;
  for (const { checkId, action } of ACTIONS) {
    const match = fired.find((r) => r.checkId === checkId);
    if (match && (best === null || SEVERITY_RANK[match.severity] > SEVERITY_RANK[best.severity])) {
      best = { severity: match.severity, action };
    }
  }
  return best ? best.action : 'Review the flagged findings before approving the payment.';
}
