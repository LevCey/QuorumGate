// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runDesk, formatReport } from '../src/desk-cli.js';

const dataDir = `${import.meta.dirname}/../../../examples/sample-data`;

/** @param {() => Promise<void>} body */
async function withTempDir(body) {
  const out = mkdtempSync(`${tmpdir()}/qg-`);
  try {
    await body(out);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

test('the desk reviews the BEC trap, holds it, and writes evidence (offline stub)', async () => {
  await withTempDir(async (out) => {
    const result = await runDesk({
      requestPath: `${dataDir}/request-bec-trap.json`,
      suppliersPath: `${dataDir}/suppliers.json`,
      outDir: out,
      now: '2026-06-07T00:00:00Z',
    });
    assert.equal(result.usedModel, 'stub');
    assert.equal(result.review.verdict, 'HOLD');

    const bundle = JSON.parse(readFileSync(result.outputs.bundlePath, 'utf8'));
    assert.equal(bundle.verdict.final, 'HOLD');
    assert.equal(bundle.generatedAt, '2026-06-07T00:00:00Z');

    const disclosure = JSON.parse(readFileSync(result.outputs.disclosurePath, 'utf8'));
    assert.equal(disclosure.calls.length, 0);

    assert.match(formatReport(result), /VERDICT: HOLD/);
  });
});

test('the desk approves the clean request (offline stub)', async () => {
  await withTempDir(async (out) => {
    const result = await runDesk({
      requestPath: `${dataDir}/request-clean.json`,
      suppliersPath: `${dataDir}/suppliers.json`,
      outDir: out,
    });
    assert.equal(result.review.verdict, 'APPROVE');
  });
});
