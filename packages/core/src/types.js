// @ts-check

/**
 * Severity weight of a risk check when it fails.
 * @typedef {'low' | 'medium' | 'high'} Severity
 */

/**
 * Outcome of a single deterministic risk check. SKIP means the check could not run
 * for lack of required inputs — it is neither a pass nor a failure.
 * @typedef {'PASS' | 'FAIL' | 'SKIP'} CheckStatus
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
 * @property {CheckStatus} status   PASS, FAIL, or SKIP.
 * @property {Severity} severity    Risk weight applied when the check fails.
 * @property {Record<string, unknown>} evidence  Human-readable facts behind the result.
 */

/**
 * A line on a purchase order or invoice.
 * @typedef {object} LineItem
 * @property {string} description
 * @property {number} amount
 */

/**
 * A purchase order linked to the payment request.
 * @typedef {object} PurchaseOrder
 * @property {number} total
 * @property {LineItem[]} [lineItems]
 */

/**
 * Normalized payment request, produced by the pipeline from OCR + parsing.
 * @typedef {object} NormalizedRequest
 * @property {string} supplierId
 * @property {string} destinationIban
 * @property {string} [senderDomain]   Domain of the sender's email address.
 * @property {number} [amount]
 * @property {string} [currency]
 * @property {string} [invoiceNumber]
 * @property {string} [invoiceDate]    ISO date, e.g. "2026-06-01".
 * @property {string} [supplierName]
 * @property {string} [taxId]
 * @property {string} [country]        ISO country code or name.
 * @property {string} [messageText]    Supplier email body, scanned for pressure language.
 * @property {string} [approvalRef]    Authorization reference attached to the payment.
 * @property {PurchaseOrder} [purchaseOrder]
 */

/**
 * A prior payment to a supplier, used to detect duplicates.
 * @typedef {object} PastPayment
 * @property {number} amount
 * @property {string} date   ISO date.
 */

/**
 * The company's own verified record for a supplier (retrieved from local history).
 * @typedef {object} SupplierHistory
 * @property {string} supplierId
 * @property {string[]} verifiedIbans            IBANs paid before and confirmed.
 * @property {string[]} [approvedDomains]
 * @property {string[]} [pastInvoiceNumbers]
 * @property {number[]} [pastAmounts]
 * @property {PastPayment[]} [pastPayments]
 * @property {string[]} [approvedRefs]           Authorization references on file.
 * @property {string} [supplierName]
 * @property {string} [taxId]
 * @property {string} [country]
 */

/**
 * Tunable, documented thresholds for the checks. See DEFAULT_CONFIG.
 * @typedef {object} CheckConfig
 * @property {{ dateWindowDays: number }} duplicateInvoice
 * @property {{ lookalikeMaxDistance: number }} senderDomain
 * @property {{ patterns: string[] }} urgency
 * @property {{ amountTolerance: number }} invoicePoMismatch
 * @property {{ meanMultiple: number }} abnormalAmount
 */

export {};
