// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRequest } from '../src/intake.js';

test('valid fields are trimmed and typed', () => {
  const { request, missing } = normalizeRequest({
    supplierId: '  acme  ',
    destinationIban: 'DE89',
    amount: 1000,
    invoiceNumber: 'INV-1',
  });
  assert.equal(request.supplierId, 'acme');
  assert.equal(request.destinationIban, 'DE89');
  assert.equal(request.amount, 1000);
  assert.deepEqual(missing, []);
});

test('missing required fields are flagged, not defaulted', () => {
  const { request, missing } = normalizeRequest({ amount: 1000 });
  assert.equal(request.supplierId, undefined);
  assert.deepEqual(missing.sort(), ['destinationIban', 'supplierId']);
});

test('wrong-typed fields are dropped, not coerced', () => {
  const { request } = normalizeRequest({
    supplierId: 'acme',
    destinationIban: 'DE89',
    amount: 'not-a-number',
    senderDomain: 42,
  });
  assert.equal(request.amount, undefined);
  assert.equal(request.senderDomain, undefined);
});

test('a purchase order is accepted only with a numeric total', () => {
  assert.equal(normalizeRequest({ supplierId: 'a', destinationIban: 'b', purchaseOrder: { total: 500 } }).request.purchaseOrder?.total, 500);
  assert.equal(normalizeRequest({ supplierId: 'a', destinationIban: 'b', purchaseOrder: { total: 'x' } }).request.purchaseOrder, undefined);
});

test('low-confidence OCR fields are flagged', () => {
  const { lowConfidence } = normalizeRequest({
    supplierId: 'acme',
    destinationIban: 'DE89',
    confidence: { destinationIban: 0.4, supplierId: 0.95 },
  });
  assert.deepEqual(lowConfidence, ['destinationIban']);
});
