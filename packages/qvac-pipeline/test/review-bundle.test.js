// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewBundle } from '../src/review-bundle.js';

/** @param {string} text */
const mockModel = (text) => ({ complete: async () => ({ text }) });

const holdBundle = {
  supplier: { id: 'acme-gmbh' },
  payment: { destinationIban: '••••6819', amount: 30500, currency: 'EUR', invoiceNumber: 'INV-1' },
  firedChecks: [{ checkId: 'iban_change', severity: 'high', evidence: { note: 'IBAN not verified' } }],
  floor: { floor: 'HOLD', approveForbidden: true, escalateEligible: true },
};

test('reviewBundle: the second reviewer cannot loosen below the floor', async () => {
  const r = await reviewBundle(holdBundle, mockModel('{"verdict":"APPROVE","memo":"looks fine"}'));
  assert.equal(r.modelProposed, 'APPROVE');
  assert.equal(r.verdict, 'HOLD');
});

test('reviewBundle: the second reviewer may tighten the verdict', async () => {
  const r = await reviewBundle(holdBundle, mockModel('{"verdict":"ESCALATE","memo":"needs deeper review"}'));
  assert.equal(r.verdict, 'ESCALATE');
  assert.match(r.memo, /deeper review/);
});

test('reviewBundle: malformed model output falls back to the floor', async () => {
  const r = await reviewBundle(holdBundle, mockModel('the model rambled without any JSON'));
  assert.equal(r.verdict, 'HOLD');
});
