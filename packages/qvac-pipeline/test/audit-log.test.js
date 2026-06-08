// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLog } from '../src/audit-log.js';

test('records model-load and completion events and serializes to JSONL', () => {
  let tick = 0;
  const log = new AuditLog({ now: () => `2026-06-08T00:00:0${tick++}Z` });
  log.modelLoad({ modelId: 'm1', loadMs: 1200 });
  log.completion({ tokens: 20, ttftMs: 200, tokensPerSec: 50 });

  assert.equal(log.entries.length, 2);
  assert.equal(log.entries[0].type, 'model_load');
  assert.equal(log.entries[0].at, '2026-06-08T00:00:00Z');
  assert.equal(log.entries[1].type, 'completion');
  assert.equal(log.entries[1].data?.tokens, 20);

  const lines = log.toJSONL().trimEnd().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).data.modelId, 'm1');
  assert.equal(JSON.parse(lines[1]).type, 'completion');
});

test('an empty log serializes to an empty string', () => {
  assert.equal(new AuditLog().toJSONL(), '');
});
