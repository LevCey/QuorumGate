// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInvoiceFields, resolveSupplierId } from '../src/invoice-ocr.js';

// The exact OCR output recorded from running the recognizer on the synthetic
// invoice image (including the OCR's small mistakes, e.g. "today:" for "today.").
const ocrText = [
  'INVOICE',
  'Acme GmbH',
  'billing@acrne.com',
  'Invoice No: INV-2026-052',
  'Date: 2026-06-03',
  'Description: Consulting services',
  'Total: 30,500 EUR',
  'IBAN: GB29 NWBK 6016 1331 9268 19',
  'URGENT: please wire today: Final notice_',
].join('\n');

test('parseInvoiceFields extracts the key fields from real OCR text', () => {
  const f = parseInvoiceFields(ocrText);
  assert.equal(f.supplierName, 'Acme GmbH');
  assert.equal(f.destinationIban, 'GB29 NWBK 6016 1331 9268 19');
  assert.equal(f.amount, 30500);
  assert.equal(f.currency, 'EUR');
  assert.equal(f.invoiceNumber, 'INV-2026-052');
  assert.equal(f.senderDomain, 'acrne.com');
  assert.match(f.messageText, /URGENT/);
});

test('resolveSupplierId matches a known supplier by name, else slugifies', () => {
  const suppliers = [{ supplierId: 'acme-gmbh', supplierName: 'Acme GmbH' }];
  assert.equal(resolveSupplierId('Acme GmbH', suppliers), 'acme-gmbh');
  assert.equal(resolveSupplierId('Unknown Co', suppliers), 'unknown-co');
  assert.equal(resolveSupplierId(undefined, suppliers), 'unknown');
});
