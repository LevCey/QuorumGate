// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestAction } from '../src/suggested-action.js';

test('the most severe fired check decides the action', () => {
  const action = suggestAction([
    { checkId: 'urgency_language', status: 'FAIL', severity: 'low', evidence: {} },
    { checkId: 'iban_change', status: 'FAIL', severity: 'high', evidence: {} },
    { checkId: 'abnormal_amount', status: 'PASS', severity: 'medium', evidence: {} },
  ]);
  assert.match(String(action), /bank details/i);
});

test('a single low-severity finding still gets guidance', () => {
  const action = suggestAction([
    { checkId: 'urgency_language', status: 'FAIL', severity: 'low', evidence: {} },
  ]);
  assert.match(String(action), /pressure signal/i);
});

test('no fired checks → no action', () => {
  assert.equal(suggestAction([{ checkId: 'iban_change', status: 'PASS', severity: 'high', evidence: {} }]), null);
});

test('an unknown fired check falls back to generic guidance', () => {
  assert.match(String(suggestAction([{ checkId: 'future_check', status: 'FAIL', severity: 'medium', evidence: {} }])), /review the flagged/i);
});
