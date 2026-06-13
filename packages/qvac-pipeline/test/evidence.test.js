// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceBundle, remoteCallDisclosure } from '../src/evidence.js';

const request = {
  supplierId: 'acme',
  supplierName: 'Acme GmbH',
  destinationIban: 'GB29 NWBK 6016 1331 9268 19',
  amount: 10200,
  currency: 'EUR',
  invoiceNumber: 'INV-1',
  taxId: 'DE123456789',
  messageText: 'URGENT. Internal note: secret-account-12345.',
};

/** @type {import('../src/review.js').ReviewResult} */
const review = {
  verdict: 'HOLD',
  modelProposed: 'APPROVE',
  floor: { floor: 'HOLD', approveForbidden: true, escalateEligible: true },
  checks: [
    { checkId: 'iban_change', status: 'FAIL', severity: 'high', evidence: { note: 'changed account' } },
    { checkId: 'urgency_language', status: 'FAIL', severity: 'low', evidence: { matchedPhrases: ['urgent'] } },
  ],
  memo: 'Verify the bank details before paying.',
};

test('the bundle records the verdict, floor, checks, and masked payment', () => {
  const b = buildEvidenceBundle({ request, review, generatedAt: '2026-06-05T00:00:00Z' });
  assert.equal(b.schemaVersion, 2);
  assert.equal(b.generatedAt, '2026-06-05T00:00:00Z');
  assert.equal(b.verdict.final, 'HOLD');
  assert.equal(b.verdict.modelProposed, 'APPROVE');
  assert.equal(b.verdict.memoSource, 'model-generated (not authoritative)');
  assert.match(b.payment.destinationIban, /^•+6819$/);
  assert.equal(b.checks.length, 2);
  assert.equal(b.humanDecision, null);
  assert.equal(b.provenance, null);
});

test('the bundle records provenance when supplied (traceability, not tamper-evidence)', () => {
  const provenance = { codeVersion: 'abc123', config: {}, model: { type: 'offline-stub' } };
  const b = buildEvidenceBundle({ request, review, provenance });
  assert.deepEqual(b.provenance, provenance);
});

test('the bundle does not leak the raw message or the tax id', () => {
  const serialized = JSON.stringify(buildEvidenceBundle({ request, review }));
  assert.equal(serialized.includes('secret-account-12345'), false);
  assert.equal(serialized.includes('DE123456789'), false);
});

test('the remote-call disclosure is empty by design', () => {
  const d = remoteCallDisclosure();
  assert.equal(d.calls.length, 0);
  assert.match(d.note, /no cloud/i);
});
