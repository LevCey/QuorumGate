// @ts-check

/**
 * Heuristically parse invoice fields from OCR text. Tuned to the structured
 * "Label: value" layout the OCR recognizer produces; real invoices vary widely, so
 * this is a best-effort extractor for the demo, not a production document parser. The
 * deterministic checks treat the result as untrusted normalized input regardless.
 *
 * @param {string} text  OCR text (the joined detected blocks).
 * @returns {{ supplierName?: string, destinationIban?: string, amount?: number, currency?: string, invoiceNumber?: string, senderDomain?: string, messageText?: string }}
 */
export function parseInvoiceFields(text) {
  /** @type {Record<string, unknown>} */
  const fields = {};

  const iban = text.match(/IBAN[:\s]+([A-Z]{2}[\dA-Z][\dA-Z ]{10,32})/i);
  if (iban) fields.destinationIban = iban[1].replace(/\s+/g, ' ').trim();

  const amount = text.match(/(?:Total|Amount|Sum)[:\s]+([\d][\d.,]*)\s*(EUR|USD|GBP|CHF|€|\$|£)/i);
  if (amount) {
    fields.amount = Number(amount[1].replace(/[.,](?=\d{3}\b)/g, ''));
    fields.currency = normalizeCurrency(amount[2]);
  }

  // Require the colon so the "INVOICE" title is not mistaken for an "Invoice No:" label.
  const invoice = text.match(/Invoice\s*(?:No\.?|Number|#)?\s*:\s*([A-Za-z0-9-]+)/i);
  if (invoice) fields.invoiceNumber = invoice[1];

  const email = text.match(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/);
  if (email) fields.senderDomain = email[1].toLowerCase();

  const supplier = text.match(/^.*\b(?:GmbH|AG|Ltd|LLC|Inc|SARL|S\.?A\.?|B\.?V\.?)\b.*$/im);
  if (supplier) fields.supplierName = supplier[0].trim();

  const message = text.match(/^.*\b(?:urgent|wire today|pay today|immediately|final notice|asap)\b.*$/im);
  if (message) fields.messageText = message[0].trim();

  return fields;
}

/** @param {string} sym */
function normalizeCurrency(sym) {
  const map = /** @type {Record<string, string>} */ ({ '€': 'EUR', $: 'USD', '£': 'GBP' });
  return (map[sym] ?? sym).toUpperCase();
}

/**
 * Resolve a supplier id from an OCR-extracted supplier name by matching it against the
 * known supplier records (normalized, case-insensitive). Falls back to a slug of the
 * name when there is no match, so an unknown supplier is reviewed against empty history.
 *
 * @param {string | undefined} supplierName
 * @param {{ supplierId: string, supplierName?: string }[]} suppliers
 * @returns {string}
 */
export function resolveSupplierId(supplierName, suppliers) {
  if (!supplierName) return 'unknown';
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const target = norm(supplierName);
  const match = suppliers.find((s) => s.supplierName && norm(s.supplierName) === target);
  return match ? match.supplierId : norm(supplierName).replace(/\s+/g, '-');
}
