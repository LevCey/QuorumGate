// @ts-check
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { runDeskReview, SupplierStore, remoteCallDisclosure, createQvacModel, AuditLog, suggestAction } from '@quorumgate/qvac-pipeline';
import { createStubModel } from './stub-model.js';

/**
 * Run the reviewer desk on one payment request and write the evidence artifacts to
 * disk. Uses the offline deterministic stub model unless `modelSrc` is given, in
 * which case the real QVAC SDK model is used (loaded lazily) and an audit log of the
 * inference performance is written. A human decision, if supplied, is recorded in the
 * bundle (the system recommends; the human decides).
 *
 * @param {{ requestPath: string, suppliersPath: string, outDir: string, modelSrc?: string, now?: string, decision?: string, reviewer?: string }} opts
 */
export async function runDesk({ requestPath, suppliersPath, outDir, modelSrc, now, decision, reviewer }) {
  const store = new SupplierStore(JSON.parse(readFileSync(suppliersPath, 'utf8')));
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));

  let model;
  let auditLog = null;
  if (modelSrc) {
    auditLog = new AuditLog();
    model = await createQvacModel({ modelSrc, auditLog });
  } else {
    model = createStubModel();
  }

  const result = await runDeskReview(request, store, model, {
    now,
    ...(decision ? { humanDecision: { decision, reviewer: reviewer ?? '' } } : {}),
  });

  mkdirSync(outDir, { recursive: true });
  /** @type {{ bundlePath: string, disclosurePath: string, auditPath?: string }} */
  const outputs = {
    bundlePath: `${outDir}/evidence-bundle.json`,
    disclosurePath: `${outDir}/remote-call-disclosure.json`,
  };
  writeFileSync(outputs.bundlePath, `${JSON.stringify(result.bundle, null, 2)}\n`);
  writeFileSync(outputs.disclosurePath, `${JSON.stringify(remoteCallDisclosure(), null, 2)}\n`);
  if (auditLog) {
    outputs.auditPath = `${outDir}/audit-log.jsonl`;
    writeFileSync(outputs.auditPath, auditLog.toJSONL());
  }

  return { ...result, outputs, usedModel: modelSrc ? 'qvac' : 'stub' };
}

/**
 * Render a desk result as a human-readable report.
 * @param {Awaited<ReturnType<typeof runDesk>>} result
 * @returns {string}
 */
export function formatReport(result) {
  const { review, bundle, knownSupplier, usedModel } = result;
  const lines = [
    'QuorumGate — local pre-payment review  [offline · no data left the device perimeter]',
    `Inference: ${usedModel === 'qvac' ? 'QVAC SDK (local)' : 'offline stub (deterministic)'}`,
  ];
  if (!knownSupplier) lines.push('! Unknown supplier — reviewed against empty history.');
  lines.push('');
  const clampNote =
    review.modelProposed !== review.verdict ? `  (model proposed ${review.modelProposed}, clamped to the code floor)` : '';
  lines.push(`Recommendation (system): ${review.verdict}${clampNote}`);

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

  const action = suggestAction(review.checks);
  if (action) lines.push('', 'Suggested action:', `  ${action}`);

  const h = bundle.humanDecision;
  lines.push('', h ? `Final decision (human): ${h.decision} — ${h.reviewer} (${h.at})` : 'Final decision (human): pending');
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
    console.error(
      'Usage: node packages/ui/src/desk-cli.js <request.json> [--suppliers <path>] [--model <gguf>] [--out <dir>] [--decide <APPROVE|HOLD|ESCALATE|BLOCK> --reviewer <name>]',
    );
    process.exit(2);
  }
  const result = await runDesk({
    requestPath,
    suppliersPath: flag('--suppliers') ?? 'examples/sample-data/suppliers.json',
    outDir: flag('--out') ?? 'evidence',
    modelSrc: flag('--model'),
    decision: flag('--decide'),
    reviewer: flag('--reviewer'),
  });
  console.log(formatReport(result));
  const written = [result.outputs.bundlePath, result.outputs.disclosurePath, result.outputs.auditPath].filter(Boolean);
  console.log(`\nEvidence written: ${written.join(', ')}`);
  // The SDK's inference worker keeps the event loop alive after the review; all
  // outputs are written synchronously above, so exit explicitly.
  process.exit(0);
}
