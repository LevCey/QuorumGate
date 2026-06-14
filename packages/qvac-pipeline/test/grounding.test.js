// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runDeskReview } from '../src/desk.js';
import { SupplierStore } from '../src/supplier-store.js';
import { SupplierMemory } from '../src/supplier-memory.js';

const dataDir = `${import.meta.dirname}/../../../examples/sample-data`;
const readJson = (name) => JSON.parse(readFileSync(`${dataDir}/${name}`, 'utf8'));
const store = new SupplierStore(readJson('suppliers.json'));

const mockEmbedder = {
  /** @param {string[]} texts */
  async embed(texts) {
    return texts.map(() => [1, 0]);
  },
};

/** A model that records the prompt it received. */
function capturingModel() {
  const state = { prompt: '' };
  return {
    state,
    model: {
      complete: async (/** @type {{ prompt: string }} */ req) => {
        state.prompt = req.prompt;
        return { text: '{"verdict":"APPROVE","memo":"ok"}' };
      },
    },
  };
}

test('RAG grounding reaches the model prompt when retrieval is configured', async () => {
  const memory = await SupplierMemory.build(readJson('suppliers.json'), mockEmbedder);
  const { state, model } = capturingModel();
  await runDeskReview(readJson('request-clean.json'), store, model, { retrieval: { memory, embedder: mockEmbedder } });
  assert.match(state.prompt, /Company records/);
  assert.match(state.prompt, /Acme GmbH/);
});

test('without retrieval, no grounding section is added to the prompt', async () => {
  const { state, model } = capturingModel();
  await runDeskReview(readJson('request-clean.json'), store, model, {});
  assert.equal(state.prompt.includes('Company records'), false);
});
