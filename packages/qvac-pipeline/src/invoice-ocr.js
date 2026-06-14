// @ts-check

/**
 * Heuristically parse invoice fields from OCR text. Tuned to the structured
 * "Label: value" layout the OCR recognizer produces; real invoices vary widely, so
 * this is a best-effort extractor for the demo, not a production document parser. The
 * deterministic checks treat the result as untrusted normalized input regardless.
 *
 * @param {string} text  OCR text (the joined detected blocks).
 * @returns {{ supplierName?: string, destinationIban?: string, amount?: number, currency?: string, invoiceNumber?: string, senderDomain?: string, messageText?: string, approvalRef?: string }}
 */
export function parseInvoiceFields(text) {
  /** @type {Record<string, unknown>} */
  const fields = {};

  const iban = text.match(/IBAN[:\s]+([A-Z]{2}[\dA-Z][\dA-Z ]{10,32})/i);
  if (iban) fields.destinationIban = iban[1].replace(/\s+/g, ' ').trim();

  // The amount may sit a few words/lines below its label ("TOTAL DUE\n30,500.00 EUR") or
  // inline ("Total: 30,500 EUR"); fall back to any number that carries a currency code.
  const amount =
    text.match(/(?:Total|Amount|Sum)\b[^\d]{0,20}?([\d][\d.,]*)\s*(EUR|USD|GBP|CHF|€|\$|£)/i) ??
    text.match(/([\d][\d.,]*)\s*(EUR|USD|GBP|CHF|€|\$|£)\b/i);
  if (amount) {
    fields.amount = Number(amount[1].replace(/[.,](?=\d{3}\b)/g, ''));
    fields.currency = normalizeCurrency(amount[2]);
  }

  // The value may follow the label inline ("Invoice No: X") or on the next line
  // ("Invoice No\nX"); require a digit in it so the bare "INVOICE" title never matches.
  const invoice = text.match(/Invoice\s*(?:No\.?|Number|#)?\s*:?\s*([A-Za-z0-9-]*\d[A-Za-z0-9-]*)/i);
  if (invoice) fields.invoiceNumber = invoice[1];

  // Purchase-order / approval reference (e.g. "PO-2026-042"), if the invoice carries one.
  const approval = text.match(/\b(PO-[A-Za-z0-9-]*\d[A-Za-z0-9-]*)\b/i);
  if (approval) fields.approvalRef = approval[1];

  const email = text.match(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/);
  if (email) fields.senderDomain = email[1].toLowerCase();

  // Require a name word, on the same line ([ \t], not \n), before the company suffix — so a
  // standalone "GMBH" logo line, or an "ACME\nGMBH" logo split across two lines, is skipped.
  const supplier = text.match(/^.*[A-Za-z]{2,}[ \t]+(?:GmbH|AG|Ltd|LLC|Inc|SARL|S\.?A\.?|B\.?V\.?)\b.*$/im);
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
