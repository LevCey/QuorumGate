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

    assert.match(formatReport(result), /Recommendation \(system\): HOLD/);
    assert.equal(bundle.verdict.memoSource, 'model-generated (not authoritative)');
    assert.match(formatReport(result), /Not evaluated: \d+ check\(s\) could not run/);
    assert.match(formatReport(result), /Memo \(model-generated/);
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

test('a human Escalate→Block decision is recorded and shown in the report', async () => {
  await withTempDir(async (out) => {
    const result = await runDesk({
      requestPath: `${dataDir}/request-bec-trap.json`,
      suppliersPath: `${dataDir}/suppliers.json`,
      outDir: out,
      decision: 'BLOCK',
      reviewer: 'Levent',
      now: '2026-06-08T00:00:00Z',
    });
    const bundle = JSON.parse(readFileSync(result.outputs.bundlePath, 'utf8'));
    assert.equal(bundle.humanDecision.decision, 'BLOCK');
    assert.equal(bundle.humanDecision.reviewer, 'Levent');
    assert.match(formatReport(result), /Final decision \(human\): BLOCK — Levent/);
  });
});
