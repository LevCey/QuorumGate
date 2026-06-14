// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSigningKeypair } from '@quorumgate/p2p-review';
import { signEvidenceBundle, verifyEvidenceBundle } from '../src/sign-bundle.js';

const bundle = {
  schemaVersion: 2,
  verdict: { final: 'HOLD', memo: 'verify the bank details' },
  checks: [{ checkId: 'iban_change', status: 'FAIL' }],
};

test('a signed bundle verifies; editing any field breaks the signature', () => {
  const kp = generateSigningKeypair();
  const signed = signEvidenceBundle(bundle, kp);
  assert.equal(verifyEvidenceBundle(signed), true);

  const tampered = JSON.parse(JSON.stringify(signed));
  tampered.verdict.final = 'APPROVE';
  assert.equal(verifyEvidenceBundle(tampered), false);
});

test('an unsigned bundle does not verify', () => {
  assert.equal(verifyEvidenceBundle(bundle), false);
});
