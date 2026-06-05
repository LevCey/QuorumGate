// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runDeskReview } from '../src/desk.js';
import { SupplierStore } from '../src/supplier-store.js';

const dataDir = `${import.meta.dirname}/../../../examples/sample-data`;
const readJson = (name) => JSON.parse(readFileSync(`${dataDir}/${name}`, 'utf8'));
const store = new SupplierStore(readJson('suppliers.json'));

/** @param {string} text @returns {import('../src/model.js').ReasoningModel} */
const mockModel = (text) => ({ complete: async () => ({ text }) });
const approves = mockModel('{"verdict":"APPROVE","memo":"All checks passed."}');

test('a clean request runs end to end and exports an APPROVE evidence bundle', async () => {
  const { review, bundle, knownSupplier } = await runDeskReview(readJson('request-clean.json'), store, approves, {
    now: '2026-06-05T00:00:00Z',
  });
  assert.equal(knownSupplier, true);
  assert.equal(review.verdict, 'APPROVE');
  assert.equal(bundle.verdict.final, 'APPROVE');
  assert.equal(bundle.generatedAt, '2026-06-05T00:00:00Z');
});

test('the BEC trap is held end to end even when the model would approve', async () => {
  const { review, bundle } = await runDeskReview(readJson('request-bec-trap.json'), store, approves);
  assert.equal(review.verdict, 'HOLD');
  assert.equal(bundle.verdict.final, 'HOLD');
  assert.equal(bundle.checks.find((c) => c.checkId === 'iban_change')?.status, 'FAIL');
});

test('a request missing a required field is rejected before review', async () => {
  await assert.rejects(
    () => runDeskReview({ amount: 100 }, store, approves),
    /missing required field/i,
  );
});
