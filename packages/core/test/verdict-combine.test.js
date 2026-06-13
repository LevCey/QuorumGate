// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moreConservative } from '../src/verdict.js';

test('moreConservative picks the stricter of two verdicts', () => {
  assert.equal(moreConservative('APPROVE', 'HOLD'), 'HOLD');
  assert.equal(moreConservative('HOLD', 'APPROVE'), 'HOLD');
  assert.equal(moreConservative('ESCALATE', 'HOLD'), 'ESCALATE');
  assert.equal(moreConservative('HOLD', 'ESCALATE'), 'ESCALATE');
  assert.equal(moreConservative('APPROVE', 'APPROVE'), 'APPROVE');
});
