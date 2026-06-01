// @ts-check

/**
 * Severity weight of a risk check when it fails.
 * @typedef {'low' | 'medium' | 'high'} Severity
 */

/**
 * Outcome of a single deterministic risk check.
 * @typedef {'PASS' | 'FAIL'} CheckStatus
 */

/**
 * A reviewer verdict, ordered APPROVE < HOLD < ESCALATE (least to most conservative).
 * @typedef {'APPROVE' | 'HOLD' | 'ESCALATE'} Verdict
 */

/**
 * Structured result emitted by every risk check (Layer A). Decided by code, never
 * by the model.
 * @typedef {object} CheckResult
 * @property {string} checkId       Stable identifier, e.g. "iban_change".
 * @property {CheckStatus} status   PASS or FAIL.
 * @property {Severity} severity    Risk weight applied when the check fails.
 * @property {Record<string, unknown>} evidence  Human-readable facts behind the result.
 */

/**
 * Normalized payment request, produced by the pipeline from OCR + parsing. Only the
 * fields the core engine needs are modeled here.
 * @typedef {object} NormalizedRequest
 * @property {string} supplierId
 * @property {string} destinationIban
 * @property {string} [senderDomain]
 * @property {number} [amount]
 * @property {string} [invoiceNumber]
 */

/**
 * The company's own verified record for a supplier (retrieved from local history).
 * @typedef {object} SupplierHistory
 * @property {string} supplierId
 * @property {string[]} verifiedIbans          IBANs paid before and confirmed.
 * @property {string[]} [approvedDomains]
 * @property {string[]} [pastInvoiceNumbers]
 * @property {number[]} [pastAmounts]
 */

export {};
