// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldDelegate, getSecondOpinion } from '../src/delegate.js';

const lowFloor = { floor: 'APPROVE', approveForbidden: false, escalateEligible: false };
const riskFloor = { floor: 'HOLD', approveForbidden: true, escalateEligible: true };

test('shouldDelegate: a high-value case delegates', () => {
  assert.equal(shouldDelegate({ supplierId: 'a', destinationIban: 'x', amount: 50000 }, lowFloor), true);
});

test('shouldDelegate: a high-risk (escalate-eligible) case delegates', () => {
  assert.equal(shouldDelegate({ supplierId: 'a', destinationIban: 'x', amount: 100 }, riskFloor), true);
});

test('shouldDelegate: a low-value, low-risk case does not delegate', () => {
  assert.equal(shouldDelegate({ supplierId: 'a', destinationIban: 'x', amount: 100 }, lowFloor), false);
});

const bundle = /** @type {any} */ ({ supplier: { id: 'a' }, payment: { destinationIban: '•••1' }, firedChecks: [], floor: riskFloor });

test('getSecondOpinion: a reachable peer provides the opinion (source peer)', async () => {
  const transport = { requestReview: async () => ({ verdict: /** @type {const} */ ('HOLD'), concur: true }) };
  const localReview = async () => ({ verdict: /** @type {const} */ ('ESCALATE'), concur: false });
  const result = await getSecondOpinion(bundle, transport, localReview);
  assert.equal(result.source, 'peer');
  assert.equal(result.opinion.verdict, 'HOLD');
});

test('getSecondOpinion: a transport failure falls back to local review (fallbackToLocal)', async () => {
  const transport = { requestReview: async () => { throw new Error('no peer'); } };
  const localReview = async () => ({ verdict: /** @type {const} */ ('HOLD'), concur: true });
  const result = await getSecondOpinion(bundle, transport, localReview);
  assert.equal(result.source, 'local');
  assert.equal(result.opinion.verdict, 'HOLD');
});

test('getSecondOpinion: no transport falls back to local review', async () => {
  const result = await getSecondOpinion(bundle, null, async () => ({ verdict: /** @type {const} */ ('HOLD'), concur: true }));
  assert.equal(result.source, 'local');
});
