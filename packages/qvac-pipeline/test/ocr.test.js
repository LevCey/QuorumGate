// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrBlocksToText, lowConfidenceBlocks } from '../src/ocr.js';

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
