// @ts-check
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { runDeskReview, SupplierStore, remoteCallDisclosure } from '@quorumgate/qvac-pipeline';
import { createStubModel } from './stub-model.js';

/**
 * Run the reviewer desk on one payment request and write the evidence artifacts to
 * disk. Uses the offline deterministic stub model unless `modelSrc` is given, in
 * which case the real QVAC SDK model is used (loaded lazily).
 *
 * @param {{ requestPath: string, suppliersPath: string, outDir: string, modelSrc?: string, now?: string }} opts
 */
export async function runDesk({ requestPath, suppliersPath, outDir, modelSrc, now }) {
  const store = new SupplierStore(JSON.parse(readFileSync(suppliersPath, 'utf8')));
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));

  let model;
  if (modelSrc) {
    const { createQvacModel } = await import('@quorumgate/qvac-pipeline');
    model = await createQvacModel({ modelSrc });
  } else {
    model = createStubModel();
  }

  const result = await runDeskReview(request, store, model, { now });

  mkdirSync(outDir, { recursive: true });
  const bundlePath = `${outDir}/evidence-bundle.json`;
  const disclosurePath = `${outDir}/remote-call-disclosure.json`;
  writeFileSync(bundlePath, `${JSON.stringify(result.bundle, null, 2)}\n`);
  writeFileSync(disclosurePath, `${JSON.stringify(remoteCallDisclosure(), null, 2)}\n`);

  return { ...result, outputs: { bundlePath, disclosurePath }, usedModel: modelSrc ? 'qvac' : 'stub' };
}

/**
 * Render a desk result as a human-readable report.
 * @param {Awaited<ReturnType<typeof runDesk>>} result
 * @returns {string}
 */
export function formatReport(result) {
  const { review, knownSupplier, usedModel } = result;
  const lines = [
    'QuorumGate — local pre-payment review  [offline · no data left the device perimeter]',
    `Inference: ${usedModel === 'qvac' ? 'QVAC SDK (local)' : 'offline stub (deterministic)'}`,
  ];
  if (!knownSupplier) lines.push('! Unknown supplier — reviewed against empty history.');
  lines.push('');
  const clampNote =
    review.modelProposed !== review.verdict ? `  (model proposed ${review.modelProposed}, clamped to the code floor)` : '';
  lines.push(`VERDICT: ${review.verdict}${clampNote}`);

  const fired = review.checks.filter((c) => c.status === 'FAIL');
  if (fired.length) {
    lines.push(`Risk: ${fired.length} check(s) fired`);
    for (const c of fired) {
      lines.push(`  - [${c.severity}] ${c.checkId}: ${c.evidence.note ?? JSON.stringify(c.evidence)}`);
    }
  } else {
    lines.push('Risk: no checks fired');
  }
  lines.push('', 'Memo:', `  ${review.memo}`);
  return lines.join('\n');
}

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const requestPath = args.find((a) => !a.startsWith('--'));
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (!requestPath) {
    console.error('Usage: node packages/ui/src/desk-cli.js <request.json> [--suppliers <path>] [--model <gguf>] [--out <dir>]');
    process.exit(2);
  }
  const result = await runDesk({
    requestPath,
    suppliersPath: flag('--suppliers') ?? 'examples/sample-data/suppliers.json',
    outDir: flag('--out') ?? 'evidence',
    modelSrc: flag('--model'),
  });
  console.log(formatReport(result));
  console.log(`\nEvidence written: ${result.outputs.bundlePath}, ${result.outputs.disclosurePath}`);
}
