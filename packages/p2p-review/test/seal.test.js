// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateReviewerKeypair, sealCaseBundle, openCaseBundle } from '../src/seal.js';

const bundle = {
  supplier: { id: 'acme', name: 'Acme GmbH' },
  payment: { destinationIban: '••••6819', amount: 10200 },
  firedChecks: [{ checkId: 'iban_change', severity: 'high' }],
};

test('a sealed bundle round-trips back to the original for the right key', () => {
  const { publicKey, privateKey } = generateReviewerKeypair();
  const sealed = sealCaseBundle(bundle, publicKey);
  assert.deepEqual(openCaseBundle(sealed, privateKey), bundle);
});

test('the sealed envelope does not leak the plaintext', () => {
  const { publicKey } = generateReviewerKeypair();
  const blob = JSON.stringify(sealCaseBundle(bundle, publicKey));
  assert.equal(blob.includes('acme'), false);
  assert.equal(blob.includes('Acme'), false);
  assert.equal(blob.includes('6819'), false);
});

test('a different private key cannot open the bundle', () => {
  const recipient = generateReviewerKeypair();
  const attacker = generateReviewerKeypair();
  const sealed = sealCaseBundle(bundle, recipient.publicKey);
  assert.throws(() => openCaseBundle(sealed, attacker.privateKey));
});

test('a tampered envelope fails authentication', () => {
  const { publicKey, privateKey } = generateReviewerKeypair();
  const sealed = sealCaseBundle(bundle, publicKey);
  const ciphertext = Buffer.from(sealed.ciphertext, 'base64');
  ciphertext[0] ^= 0xff;
  assert.throws(() => openCaseBundle({ ...sealed, ciphertext: ciphertext.toString('base64') }, privateKey));
});
