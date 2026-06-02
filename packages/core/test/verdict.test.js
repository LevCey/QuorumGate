// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeVerdictFloor, clampVerdict } from '../src/verdict.js';

test('no failed checks → APPROVE floor', () => {
  const floor = computeVerdictFloor([
    { checkId: 'x', status: 'PASS', severity: 'high', evidence: {} },
  ]);
  assert.equal(floor.floor, 'APPROVE');
  assert.equal(floor.approveForbidden, false);
});

test('a high-severity failure forbids APPROVE and allows escalation', () => {
  const floor = computeVerdictFloor([
    { checkId: 'iban_change', status: 'FAIL', severity: 'high', evidence: {} },
  ]);
  assert.equal(floor.floor, 'HOLD');
  assert.equal(floor.approveForbidden, true);
  assert.equal(floor.escalateEligible, true);
});

test('low-severity (advisory) failures alone keep APPROVE permitted', () => {
  const floor = computeVerdictFloor([
    { checkId: 'urgency_language', status: 'FAIL', severity: 'low', evidence: {} },
  ]);
  assert.equal(floor.floor, 'APPROVE');
  assert.equal(floor.approveForbidden, false);
});

test('the model cannot loosen the floor — APPROVE under a high failure is clamped to HOLD', () => {
  const floor = computeVerdictFloor([
    { checkId: 'iban_change', status: 'FAIL', severity: 'high', evidence: {} },
  ]);
  assert.equal(clampVerdict('APPROVE', floor), 'HOLD');
});

test('the model may tighten the floor — ESCALATE is preserved', () => {
  const floor = computeVerdictFloor([
    { checkId: 'duplicate_invoice', status: 'FAIL', severity: 'medium', evidence: {} },
  ]);
  assert.equal(clampVerdict('ESCALATE', floor), 'ESCALATE');
});
