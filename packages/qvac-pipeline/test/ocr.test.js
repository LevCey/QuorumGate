// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrBlocksToText, lowConfidenceBlocks } from '../src/ocr.js';
import { createQvacOcr } from '../src/qvac-ocr.js';

const blocks = [
  { text: 'Acme GmbH', confidence: 0.99 },
  { text: 'IBAN GB29 NWBK 6016 1331 9268 19', confidence: 0.42 },
  { text: 'Amount: 30,500 EUR', confidence: 0.88 },
];

test('ocrBlocksToText joins block texts in detection order', () => {
  assert.equal(ocrBlocksToText(blocks), 'Acme GmbH\nIBAN GB29 NWBK 6016 1331 9268 19\nAmount: 30,500 EUR');
});

test('lowConfidenceBlocks flags blocks below the threshold for human review', () => {
  const low = lowConfidenceBlocks(blocks);
  assert.equal(low.length, 1);
  assert.match(low[0].text, /IBAN/);
});

test('createQvacOcr.extract awaits the SDK ocr() { blocks } promise into an array', async () => {
  // The exported @qvac/sdk `ocr({modelId, image})` returns `{ blocks: Promise<OcrBlock[]>, blockStream, stats }`.
  // This guards extract() against being "fixed" to iterate ocr() as an async generator: that
  // shape would never await `.blocks`, so this stub (which only exposes `.blocks`) would fail.
  let loadedWith;
  const fakeSdk = {
    OCR_LATIN_RECOGNIZER_1: 'bundled-latin',
    async loadModel(cfg) { loadedWith = cfg; return 'ocr-model-1'; },
    ocr({ modelId, image }) {
      assert.equal(modelId, 'ocr-model-1');
      assert.equal(typeof image, 'string');
      return { blocks: Promise.resolve([{ text: 'Acme GmbH', confidence: 0.99 }]), stats: {} };
    },
  };
  const reader = await createQvacOcr({ loadSdk: async () => fakeSdk });
  assert.equal(loadedWith.modelType, 'ocr');
  assert.equal(loadedWith.modelSrc, 'bundled-latin'); // no modelSrc → SDK's bundled recognizer
  const out = await reader.extract('/tmp/invoice.png');
  assert.equal(Array.isArray(out), true);
  assert.equal(out[0].text, 'Acme GmbH');
});
