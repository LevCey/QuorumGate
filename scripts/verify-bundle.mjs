#!/usr/bin/env node
/*
 * Verify the Ed25519 signature on a signed evidence bundle (written with `--sign`).
 * Exits 0 and prints VALID when the signature matches the bundle's current contents;
 * exits 1 and prints INVALID when the bundle is unsigned or has been edited.
 *
 *   node scripts/verify-bundle.mjs evidence/evidence-bundle.json
 */
import { readFileSync } from 'node:fs';
import { verifyEvidenceBundle } from '@quorumgate/qvac-pipeline';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/verify-bundle.mjs <evidence-bundle.json>');
  process.exit(2);
}

const bundle = JSON.parse(readFileSync(path, 'utf8'));
const ok = verifyEvidenceBundle(bundle);
console.log(ok ? 'VALID — the signature matches the bundle contents.' : 'INVALID — the bundle is unsigned or has been tampered with.');
process.exit(ok ? 0 : 1);
