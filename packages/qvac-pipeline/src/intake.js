// @ts-check
/** @typedef {import('../../core/src/types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../../core/src/types.js').PurchaseOrder} PurchaseOrder */

/**
 * A raw, untrusted payment request as extracted from a dropped bundle (structured
 * fields from parsing, or from OCR). Field types are unverified until normalized.
 * An optional `confidence` map (field → 0..1) may accompany OCR-extracted fields.
 * @typedef {Record<string, unknown>} RawRequest
 */

/**
 * Result of normalizing a raw request: a typed NormalizedRequest plus the fields
 * that were missing or low-confidence — flagged, never silently defaulted.
 * @typedef {object} NormalizedIntake
 * @property {NormalizedRequest} request
 * @property {string[]} missing        Required fields that were absent or invalid.
 * @property {string[]} lowConfidence  Fields whose OCR confidence was below threshold.
 */

const REQUIRED = ['supplierId', 'destinationIban'];
const STRING_FIELDS = [
  'supplierId',
  'destinationIban',
  'senderDomain',
  'currency',
  'invoiceNumber',
  'invoiceDate',
  'supplierName',
  'taxId',
  'country',
  'messageText',
  'approvalRef',
];
const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Normalize and validate a raw extracted request into a NormalizedRequest.
 *
 * The raw input is untrusted — it crosses a trust boundary. Types are checked,
 * strings are trimmed, the amount is accepted only as a finite number, and missing
 * required fields and low-confidence fields are flagged rather than defaulted. Any
 * instruction-like content in the text is irrelevant here: this step only shapes
 * data; it never executes it.
 *
 * @param {RawRequest} raw
 * @returns {NormalizedIntake}
 */
export function normalizeRequest(raw) {
  /** @type {Record<string, unknown>} */
  const request = {};

  for (const key of STRING_FIELDS) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim() !== '') {
      request[key] = value.trim();
    }
  }

  if (typeof raw.amount === 'number' && Number.isFinite(raw.amount)) {
    request.amount = raw.amount;
  }

  const po = normalizePurchaseOrder(raw.purchaseOrder);
  if (po) request.purchaseOrder = po;

  const missing = REQUIRED.filter((key) => request[key] === undefined);
  const lowConfidence = collectLowConfidence(raw, request);

  return {
    request: /** @type {NormalizedRequest} */ (request),
    missing,
    lowConfidence,
  };
}

/**
 * @param {unknown} value
 * @returns {PurchaseOrder | undefined}
 */
function normalizePurchaseOrder(value) {
  if (typeof value !== 'object' || value === null) return undefined;
  const total = /** @type {Record<string, unknown>} */ (value).total;
  if (typeof total !== 'number' || !Number.isFinite(total)) return undefined;
  return { total };
}

/**
 * @param {RawRequest} raw
 * @param {Record<string, unknown>} request
 * @returns {string[]}
 */
function collectLowConfidence(raw, request) {
  const conf = raw.confidence;
  if (typeof conf !== 'object' || conf === null) return [];
  const map = /** @type {Record<string, unknown>} */ (conf);
  return Object.keys(request).filter((key) => {
    const score = map[key];
    return typeof score === 'number' && score < CONFIDENCE_THRESHOLD;
  });
}
