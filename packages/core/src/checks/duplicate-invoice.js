// @ts-check
/** @typedef {import('../types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../types.js').SupplierHistory} SupplierHistory */
/** @typedef {import('../types.js').CheckConfig} CheckConfig */
/** @typedef {import('../types.js').CheckResult} CheckResult */
/** @typedef {import('../types.js').CheckStatus} CheckStatus */

export const CHECK_ID = 'duplicate_invoice';

/**
 * Duplicate-invoice check (medium). Fails when the invoice number was already paid,
 * or when a prior payment of the same amount falls within the duplicate window.
 *
 * @param {NormalizedRequest} request
 * @param {SupplierHistory} history
 * @param {CheckConfig} config
 * @returns {CheckResult}
 */
export function checkDuplicateInvoice(request, history, config) {
  const number = request.invoiceNumber?.trim().toLowerCase();
  const byNumber =
    number != null &&
    number !== '' &&
    (history.pastInvoiceNumbers ?? []).some((n) => n.trim().toLowerCase() === number);

  if (byNumber) {
    return result('FAIL', {
      invoiceNumber: request.invoiceNumber,
      note: 'Invoice number matches a previously paid invoice.',
    });
  }

  const windowDays = config.duplicateInvoice.dateWindowDays;
  const nearMatch =
    request.amount != null && request.invoiceDate != null
      ? (history.pastPayments ?? []).find(
          (p) =>
            p.amount === request.amount &&
            daysBetween(p.date, /** @type {string} */ (request.invoiceDate)) <= windowDays,
        )
      : undefined;

  if (nearMatch) {
    return result('FAIL', {
      amount: request.amount,
      matchedDate: nearMatch.date,
      windowDays,
      note: 'Same amount paid within the duplicate-detection window.',
    });
  }

  if (number == null && (request.amount == null || request.invoiceDate == null)) {
    return result('SKIP', { note: 'No invoice number or amount/date to compare.' });
  }
  return result('PASS', {});
}

/**
 * @param {CheckStatus} status
 * @param {Record<string, unknown>} evidence
 * @returns {CheckResult}
 */
function result(status, evidence) {
  return { checkId: CHECK_ID, status, severity: 'medium', evidence };
}

/**
 * Absolute difference between two ISO dates, in days. Returns Infinity for
 * unparseable input so it never produces a false match.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function daysBetween(a, b) {
  const ms = Math.abs(Date.parse(a) - Date.parse(b));
  return Number.isNaN(ms) ? Infinity : ms / 86_400_000;
}
