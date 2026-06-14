// @ts-check
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { runDeskReview, SupplierStore, remoteCallDisclosure, createQvacModel, createDelegatedReviewer, createQvacEmbedder, SupplierMemory, AuditLog, suggestAction, DEFAULT_CONFIG } from '@quorumgate/qvac-pipeline';
import { createStubModel } from './stub-model.js';
import { gitHead, modelProvenance } from './provenance.js';

/**
 * Run the reviewer desk on one payment request and write the evidence artifacts to
 * disk. Uses the offline deterministic stub model unless `modelSrc` is given, in
 * which case the real QVAC SDK model is used (loaded lazily) and an audit log of the
 * inference performance is written. A human decision, if supplied, is recorded in the
 * bundle (the system recommends; the human decides).
 *
 * For a high-value/high-risk case, `peerKey` enables the four-eyes second review: the
 * case is delegated to the peer device (QVAC delegated inference) addressed by that
 * public key, and the peer's model — resolved at `peerModelSrc` on that device —
 * returns an independent opinion. If the peer is unreachable the desk falls back to a
 * local second opinion, so a verdict is always reached.
 *
 * @param {{ requestPath: string, suppliersPath: string, outDir: string, modelSrc?: string, now?: string, decision?: string, reviewer?: string, peerKey?: string, peerModelSrc?: string, requirePeer?: boolean }} opts
 */
export async function runDesk({ requestPath, suppliersPath, outDir, modelSrc, now, decision, reviewer, peerKey, peerModelSrc, requirePeer, embedModelSrc }) {
  const suppliersData = JSON.parse(readFileSync(suppliersPath, 'utf8'));
  const store = new SupplierStore(suppliersData);
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));

  const auditLog = modelSrc || peerKey ? new AuditLog() : null;
  const model = modelSrc ? await createQvacModel({ modelSrc, auditLog }) : createStubModel();

  let fourEyes;
  if (peerKey) {
    const peerSrc = peerModelSrc ?? modelSrc;
    if (!peerSrc) {
      throw new Error('Four-eyes (--peer) needs the peer model path: pass --peer-model <gguf-path-on-the-peer-device> (or --model).');
    }
    const transport = createDelegatedReviewer({ providerPublicKey: peerKey, modelSrc: peerSrc, auditLog });
    fourEyes = { transport, localModel: model, requirePeer: !!requirePeer };
  }

  const provenance = {
    codeVersion: gitHead(process.cwd()),
    config: DEFAULT_CONFIG,
    model: await modelProvenance(modelSrc),
  };

  let retrieval;
  if (embedModelSrc) {
    const embedder = await createQvacEmbedder({ modelSrc: embedModelSrc });
    retrieval = { memory: await SupplierMemory.build(suppliersData, embedder), embedder };
  }

  const result = await runDeskReview(request, store, model, {
    now,
    provenance,
    ...(decision ? { humanDecision: { decision, reviewer: reviewer ?? '' } } : {}),
    ...(fourEyes ? { fourEyes } : {}),
    ...(retrieval ? { retrieval } : {}),
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
  lines.push(`Recommendation (system): ${bundle.verdict.final}${clampNote}`);

  const fired = review.checks.filter((c) => c.status === 'FAIL');
  if (fired.length) {
    lines.push(`Risk: ${fired.length} check(s) fired`);
    for (const c of fired) {
      lines.push(`  - [${c.severity}] ${c.checkId}: ${c.evidence.note ?? JSON.stringify(c.evidence)}`);
    }
  } else {
    lines.push('Risk: no checks fired');
  }

  const skipped = review.checks.filter((c) => c.status === 'SKIP');
  if (skipped.length) {
    lines.push(`Not evaluated: ${skipped.length} check(s) could not run — ${skipped.map((c) => c.checkId).join(', ')} (insufficient data)`);
  }

  lines.push('', 'Memo (model-generated — the fired checks above are the authoritative basis):', `  ${review.memo}`);

  const action = suggestAction(review.checks);
  if (action) lines.push('', 'Suggested action:', `  ${action}`);

  const sr = bundle.secondReview;
  if (sr && sr.obtained === false) {
    lines.push(
      '',
      '!! INDEPENDENT SECOND REVIEW NOT OBTAINED — peer required but unavailable.',
      '   Recommendation held pending an independent review; human acknowledgement required.',
    );
  } else if (sr) {
    const indep = sr.independent === false ? ' [local fallback — not independent]' : '';
    lines.push('', `Second reviewer (${sr.reviewer}): ${sr.verdict} — ${sr.concur ? 'CONCUR' : 'DIFFERS'}${indep}`);
    if (sr.memo) lines.push(`  ${sr.memo}`);
  }

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
      'Usage: node packages/ui/src/desk-cli.js <request.json> [--suppliers <path>] [--model <gguf>] [--embed-model <embedding-gguf>] [--out <dir>]\n' +
        '       [--decide <APPROVE|HOLD|ESCALATE|BLOCK> --reviewer <name>]\n' +
        '       [--peer <provider-public-key> --peer-model <gguf-path-on-peer> [--require-peer]]   (four-eyes second review)',
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
    peerKey: flag('--peer'),
    peerModelSrc: flag('--peer-model'),
    requirePeer: args.includes('--require-peer'),
    embedModelSrc: flag('--embed-model'),
  });
  console.log(formatReport(result));
  const written = [result.outputs.bundlePath, result.outputs.disclosurePath, result.outputs.auditPath].filter(Boolean);
  console.log(`\nEvidence written: ${written.join(', ')}`);
  // The SDK's inference worker keeps the event loop alive after the review; all
  // outputs are written synchronously above, so exit explicitly.
  process.exit(0);
}
