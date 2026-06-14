// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSigningKeypair, signPayload, verifyPayload, canonicalJson } from '../src/signing.js';

test('a signed payload verifies, and a tampered payload does not', () => {
  const kp = generateSigningKeypair();
  const payload = { verdict: 'HOLD', amount: 30500, checks: ['iban_change'] };
  const sig = signPayload(payload, kp);
  assert.equal(verifyPayload(payload, sig), true);
  assert.equal(verifyPayload({ ...payload, verdict: 'APPROVE' }, sig), false);
});

test('verification is independent of property order (canonical JSON)', () => {
  const kp = generateSigningKeypair();
  const sig = signPayload({ a: 1, b: 2 }, kp);
  assert.equal(verifyPayload({ b: 2, a: 1 }, sig), true);
});

test('a signature from a different key does not verify', () => {
  const a = generateSigningKeypair();
  const b = generateSigningKeypair();
  const sig = signPayload({ x: 1 }, a);
  assert.equal(verifyPayload({ x: 1 }, { ...sig, publicKey: b.publicKey }), false);
});

test('canonicalJson sorts keys recursively', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":1}');
});
