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
const approves = mockModel('{"verdict":"APPROVE","memo":"all clear"}');

/** A peer transport that returns a fixed second opinion. */
const peer = (verdict, memo = 'second device opinion') => ({ requestReview: async () => ({ verdict, memo }) });

test('four-eyes: a reachable peer opinion is recorded and can tighten the recommendation', async () => {
  // BEC trap: floor HOLD, A model would approve → A verdict HOLD. Peer escalates.
  const res = await runDeskReview(readJson('request-bec-trap.json'), store, approves, {
    now: '2026-06-13T00:00:00Z',
    fourEyes: { transport: peer('ESCALATE'), localModel: approves },
  });
  assert.equal(res.secondReview.source, 'peer');
  assert.equal(res.secondReview.verdict, 'ESCALATE');
  assert.equal(res.secondReview.concur, false);
  assert.equal(res.recommendation, 'ESCALATE');
  assert.equal(res.bundle.verdict.final, 'ESCALATE');
  assert.equal(res.bundle.secondReview.source, 'peer');
});

test('four-eyes: a peer cannot loosen the recommendation below the code floor', async () => {
  const res = await runDeskReview(readJson('request-bec-trap.json'), store, approves, {
    fourEyes: { transport: peer('APPROVE'), localModel: approves },
  });
  assert.equal(res.secondReview.verdict, 'APPROVE');
  assert.equal(res.recommendation, 'HOLD'); // floor holds regardless of the peer
});

test('four-eyes: an unreachable peer falls back to a local second opinion', async () => {
  const throwing = { requestReview: async () => { throw new Error('no peer reachable'); } };
  const res = await runDeskReview(readJson('request-bec-trap.json'), store, approves, {
    fourEyes: { transport: throwing, localModel: approves },
  });
  assert.equal(res.secondReview.source, 'local');
  assert.equal(res.secondReview.verdict, 'HOLD'); // local APPROVE clamped to the floor
  assert.equal(res.recommendation, 'HOLD');
});

test('four-eyes: a low-value, low-risk case is not delegated', async () => {
  const res = await runDeskReview(readJson('request-advisory-only.json'), store, approves, {
    fourEyes: { transport: peer('ESCALATE'), localModel: approves, config: { highValueThreshold: 100000 } },
  });
  assert.equal(res.secondReview, null);
  assert.equal(res.recommendation, 'APPROVE');
  assert.equal(res.bundle.secondReview, null);
});

const throwingPeer = { requestReview: async () => { throw new Error('no peer reachable'); } };

test('four-eyes: a local fallback is recorded but marked not independent', async () => {
  const res = await runDeskReview(readJson('request-bec-trap.json'), store, approves, {
    fourEyes: { transport: throwingPeer, localModel: approves },
  });
  assert.equal(res.secondReview.source, 'local');
  assert.equal(res.secondReview.obtained, true);
  assert.equal(res.secondReview.independent, false);
});

test('four-eyes: --require-peer refuses to count a local fallback as an independent review', async () => {
  // The clean request is high-value (>= 10000) so it delegates; its floor is APPROVE.
  const res = await runDeskReview(readJson('request-clean.json'), store, approves, {
    fourEyes: { transport: throwingPeer, localModel: approves, requirePeer: true },
  });
  assert.equal(res.secondReview.obtained, false);
  assert.equal(res.secondReview.independent, false);
  assert.equal(res.secondReview.verdict, null);
  assert.equal(res.recommendation, 'HOLD'); // not APPROVE — no independent review was obtained
});
