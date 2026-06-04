// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCaseBundle } from '../src/case-bundle.js';

const trapRequest = {
  supplierId: 'acme',
  supplierName: 'Acme GmbH',
  destinationIban: 'GB29 NWBK 6016 1331 9268 19',
  amount: 10200,
  currency: 'EUR',
  invoiceNumber: 'INV-052',
  taxId: 'DE123456789',
  messageText: 'URGENT: please wire today. Internal note: secret-account-12345.',
};

/** @type {import('../../core/src/types.js').CheckResult[]} */
const results = [
  { checkId: 'iban_change', status: 'FAIL', severity: 'high', evidence: { note: 'changed account' } },
  { checkId: 'sender_domain', status: 'FAIL', severity: 'high', evidence: { note: 'look-alike' } },
  { checkId: 'urgency_language', status: 'FAIL', severity: 'low', evidence: { matchedPhrases: ['urgent', 'wire today'] } },
  { checkId: 'abnormal_amount', status: 'PASS', severity: 'medium', evidence: {} },
];

const floor = { floor: 'HOLD', approveForbidden: true, escalateEligible: true };

test('the bundle carries the supplier, masked payment, fired checks, and floor', () => {
  const bundle = buildCaseBundle(trapRequest, results, floor);
  assert.equal(bundle.supplier.id, 'acme');
  assert.equal(bundle.supplier.name, 'Acme GmbH');
  assert.equal(bundle.payment.amount, 10200);
  assert.equal(bundle.firedChecks.length, 3); // only FAILs
  assert.equal(bundle.floor.approveForbidden, true);
});

test('the destination IBAN is masked (last four only)', () => {
  const bundle = buildCaseBundle(trapRequest, results, floor);
  assert.match(bundle.payment.destinationIban, /^•+6819$/);
  assert.equal(bundle.payment.destinationIban.includes('GB29'), false);
});

test('the bundle excludes the raw message and other non-essential fields', () => {
  const serialized = JSON.stringify(buildCaseBundle(trapRequest, results, floor));
  // Only matched snippets cross, never the full message or sensitive tail.
  assert.equal(serialized.includes('secret-account-12345'), false);
  assert.equal(serialized.includes('Internal note'), false);
  assert.equal(serialized.includes('messageText'), false);
  assert.equal(serialized.includes('DE123456789'), false); // taxId not sent
});
