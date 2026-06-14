// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moreConservative, computeVerdictFloor } from '../src/verdict.js';

test('moreConservative picks the stricter of two verdicts', () => {
  assert.equal(moreConservative('APPROVE', 'HOLD'), 'HOLD');
  assert.equal(moreConservative('HOLD', 'APPROVE'), 'HOLD');
  assert.equal(moreConservative('ESCALATE', 'HOLD'), 'ESCALATE');
  assert.equal(moreConservative('HOLD', 'ESCALATE'), 'ESCALATE');
  assert.equal(moreConservative('APPROVE', 'APPROVE'), 'APPROVE');
});

test('computeVerdictFloor: too many SKIPs forbid APPROVE (insufficient evidence)', () => {
  const skip = (id) => ({ checkId: id, status: 'SKIP', severity: 'low', evidence: {} });
  const pass = (id) => ({ checkId: id, status: 'PASS', severity: 'low', evidence: {} });

  const fourSkips = computeVerdictFloor([skip('a'), skip('b'), skip('c'), skip('d'), pass('e')]);
  assert.equal(fourSkips.floor, 'HOLD');
  assert.equal(fourSkips.approveForbidden, true);
  assert.equal(fourSkips.insufficientEvidence, true);

  // Three SKIPs is within the default budget — APPROVE remains permitted.
  assert.equal(computeVerdictFloor([skip('a'), skip('b'), skip('c'), pass('d')]).floor, 'APPROVE');

  // A high-severity failure still dominates, independent of the SKIP count.
  const withHighFail = computeVerdictFloor([
    skip('a'), skip('b'), skip('c'), skip('d'),
    { checkId: 'x', status: 'FAIL', severity: 'high', evidence: {} },
  ]);
  assert.equal(withHighFail.floor, 'HOLD');
  assert.equal(withHighFail.escalateEligible, true);
  assert.notEqual(withHighFail.insufficientEvidence, true);
});
