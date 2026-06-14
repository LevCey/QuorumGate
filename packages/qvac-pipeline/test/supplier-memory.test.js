// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SupplierMemory, supplierNote, cosineSimilarity } from '../src/supplier-memory.js';

const dataDir = `${import.meta.dirname}/../../../examples/sample-data`;
const suppliers = JSON.parse(readFileSync(`${dataDir}/suppliers.json`, 'utf8'));

// Deterministic bag-of-words embedder over a fixed vocabulary, so retrieval is
// testable offline without the SDK.
const VOCAB = ['acme', 'gmbh', 'nordlicht', 'ag', 'iban', 'domain', 'amount', 'country', 'invoice'];
const mockEmbedder = {
  /** @param {string[]} texts */
  async embed(texts) {
    return texts.map((t) => {
      const lower = t.toLowerCase();
      return VOCAB.map((w) => lower.split(w).length - 1);
    });
  },
};

test('cosineSimilarity: identical vectors score 1, orthogonal and zero score 0', () => {
  assert.equal(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
});

test('supplierNote summarizes the record without the tax id or full IBAN', () => {
  const note = supplierNote(suppliers[0]);
  assert.match(note, /Acme GmbH/);
  assert.match(note, /ending 3000/); // last 4 of the verified IBAN
  assert.equal(note.includes(suppliers[0].taxId), false);
  assert.equal(note.includes('3704'), false); // a non-final IBAN group must not appear
});

test('SupplierMemory retrieves the most relevant supplier note for a query', async () => {
  const memory = await SupplierMemory.build(suppliers, mockEmbedder);
  const hits = await memory.retrieve('payment to Acme GmbH', mockEmbedder, 1);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].supplierId, 'acme-gmbh');
  assert.ok(hits[0].score > 0);
});

test('SupplierMemory handles an empty corpus', async () => {
  const memory = await SupplierMemory.build([], mockEmbedder);
  assert.deepEqual(await memory.retrieve('anything', mockEmbedder), []);
});
