// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkIbanChange } from '../src/checks/iban-change.js';

/** @type {import('../src/types.js').SupplierHistory} */
const history = {
  supplierId: 'acme',
  verifiedIbans: ['DE89 3704 0044 0532 0130 00'],
};

test('a known destination IBAN passes (whitespace/case-insensitive)', () => {
  const result = checkIbanChange(
    { supplierId: 'acme', destinationIban: 'de89370400440532013000' },
    history,
  );
  assert.equal(result.status, 'PASS');
});

test('an unknown destination IBAN fails at high severity', () => {
  const result = checkIbanChange(
    { supplierId: 'acme', destinationIban: 'GB29 NWBK 6016 1331 9268 19' },
    history,
  );
  assert.equal(result.status, 'FAIL');
  assert.equal(result.severity, 'high');
});

test('the failure evidence does not expose the full IBAN', () => {
  const result = checkIbanChange(
    { supplierId: 'acme', destinationIban: 'GB29NWBK60161331926819' },
    history,
  );
  assert.match(String(result.evidence.destinationIban), /^•+6819$/);
});
