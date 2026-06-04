// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewPayment } from '../src/review.js';
import { normalizeRequest } from '../src/intake.js';
import { SupplierStore } from '../src/supplier-store.js';

const dataDir = `${import.meta.dirname}/../../../examples/sample-data`;
const readJson = (name) => JSON.parse(readFileSync(`${dataDir}/${name}`, 'utf8'));

const store = new SupplierStore(readJson('suppliers.json'));

/** @param {string} text @returns {import('../src/model.js').ReasoningModel} */
const mockModel = (text) => ({ complete: async () => ({ text }) });

/** Drive the full SDK-independent path: raw input → normalize → lookup → review. */
async function review(rawName, model) {
  const { request } = normalizeRequest(readJson(rawName));
  const history = store.lookup(request.supplierId);
  assert.ok(history, 'supplier should be found in the store');
  return reviewPayment(request, history, model);
}

test('end to end: the clean sample request is approved', async () => {
  const r = await review('request-clean.json', mockModel('{"verdict":"APPROVE","memo":"All checks passed."}'));
  assert.equal(r.checks.some((c) => c.status === 'FAIL'), false);
  assert.equal(r.verdict, 'APPROVE');
});

test('end to end: the BEC-trap sample is held even if the model would approve it', async () => {
  const r = await review('request-bec-trap.json', mockModel('{"verdict":"APPROVE","memo":"Looks fine."}'));
  assert.equal(r.checks.find((c) => c.checkId === 'iban_change')?.status, 'FAIL');
  assert.equal(r.checks.find((c) => c.checkId === 'sender_domain')?.status, 'FAIL');
  assert.equal(r.modelProposed, 'APPROVE');
  assert.equal(r.verdict, 'HOLD');
});
