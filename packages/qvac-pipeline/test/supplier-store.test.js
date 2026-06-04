// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupplierStore } from '../src/supplier-store.js';

const records = [
  { supplierId: 'acme-gmbh', verifiedIbans: ['DE89'] },
  { supplierId: 'globex', verifiedIbans: ['FR76'] },
];

test('lookup returns the matching supplier record', () => {
  const store = new SupplierStore(records);
  assert.equal(store.lookup('globex')?.verifiedIbans[0], 'FR76');
});

test('lookup returns null for an unknown supplier', () => {
  const store = new SupplierStore(records);
  assert.equal(store.lookup('unknown'), null);
});

test('size reflects the number of records', () => {
  assert.equal(new SupplierStore(records).size, 2);
});
