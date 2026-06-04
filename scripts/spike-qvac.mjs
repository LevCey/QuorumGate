#!/usr/bin/env node
/*
 * QuorumGate — QVAC SDK spike / micro-benchmark (tasks W0.2 / W0.3).
 *
 * Aligned to the real @qvac/sdk API (v0.12.x): loadModel() returns a modelId, and
 * completion({ modelId, history, stream }) streams output via result.tokenStream.
 *
 * It (0) introspects exports, (1) loads a model, (2) runs a streamed completion
 * measuring TTFT and tokens/sec, (3) attempts tool calling (needs a tools-configured
 * model load + Zod tool schemas), and (4) reports whether ocr / embed / rag exports
 * are present. Prints a JSON summary to paste back. Every step is guarded.
 *
 * Usage (repo root, with @qvac/sdk installed):
 *   QVAC_MODEL="LLAMA_TOOL_CALLING_1B_INST_Q4_K" node scripts/spike-qvac.mjs
 *   # or a path / URL to a stronger instruct GGUF (e.g. a Qwen2.5-Instruct build)
 * Without QVAC_MODEL, only introspection runs.
 */
import * as qvac from '@qvac/sdk';

const summary = { node: process.version, model: process.env.QVAC_MODEL ?? null, steps: {} };
const record = (step, ok, detail = {}) => {
  summary.steps[step] = { ok, ...detail };
  console.log(`\n[${ok ? 'OK  ' : 'FAIL'}] ${step}`, detail);
};

record('import', true, { exportNames: Object.keys(qvac) });

const modelSrc = process.env.QVAC_MODEL;
if (!modelSrc) {
  console.log('\nNo QVAC_MODEL set — introspection only.');
  console.log('\n=== SUMMARY (paste back) ===\n' + JSON.stringify(summary, null, 2));
  process.exit(0);
}

/** Run a streamed completion and measure TTFT, total time, and tokens/sec. */
async function streamCompletion(modelId, history, tools) {
  const start = process.hrtime.bigint();
  let firstNs = null;
  let text = '';
  let tokens = 0;
  const result = await qvac.completion({ modelId, history, stream: true, ...(tools ? { tools } : {}) });
  for await (const chunk of result.tokenStream) {
    if (firstNs === null) firstNs = process.hrtime.bigint();
    text += typeof chunk === 'string' ? chunk : (chunk?.text ?? chunk?.token ?? '');
    tokens += 1;
  }
  const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
  return {
    text,
    ttftMs: firstNs ? +(Number(firstNs - start) / 1e6).toFixed(1) : null,
    totalMs: +totalMs.toFixed(1),
    tokens,
    tokensPerSec: tokens > 1 ? +(tokens / (totalMs / 1000)).toFixed(1) : null,
  };
}

// --- Step 1: load model ----------------------------------------------------------
let modelId = null;
try {
  const t0 = Date.now();
  modelId = await qvac.loadModel({ modelType: 'llm', modelSrc });
  record('loadModel', true, { loadMs: Date.now() - t0, modelId: String(modelId).slice(0, 80) });
} catch (err) {
  record('loadModel', false, { error: String(err) });
}

// --- Step 2: completion ----------------------------------------------------------
if (modelId) {
  try {
    const r = await streamCompletion(modelId, [{ role: 'user', content: 'Reply with the single word: READY' }]);
    record('completion', true, r);
  } catch (err) {
    record('completion', false, { error: String(err) });
  }
}

// --- Step 3: tool calling (needs a tools-configured load + Zod schemas) ----------
try {
  const { z } = await import('zod').catch(() => ({ z: null }));
  if (!z) {
    record('tool_calling', false, { skipped: 'zod not resolvable — install zod to test tool calling' });
  } else {
    const toolModelId = await qvac.loadModel({
      modelType: 'llm',
      modelSrc,
      modelConfig: { tools: true, toolsMode: 'dynamic' },
    });
    let toolCalled = false;
    const r = await streamCompletion(
      toolModelId,
      [{ role: 'user', content: 'Use the ping tool with value 1, then stop.' }],
      [
        {
          name: 'ping',
          description: 'A no-op test tool.',
          parameters: z.object({ value: z.number() }),
          handler: async (a) => {
            toolCalled = true;
            return { ok: true, echo: a };
          },
        },
      ],
    );
    record('tool_calling', true, { toolCalled, ttftMs: r.ttftMs, tokensPerSec: r.tokensPerSec, preview: r.text.slice(0, 120) });
  }
} catch (err) {
  record('tool_calling', false, { error: String(err) });
}

// --- Step 4: capability exports --------------------------------------------------
record('ocr_export', typeof qvac.ocr === 'function', { typeofOcr: typeof qvac.ocr });
record('embed_export', typeof qvac.embed === 'function', { typeofEmbed: typeof qvac.embed });
record('rag_exports', Object.keys(qvac).some((k) => /rag/i.test(k)), {
  ragKeys: Object.keys(qvac).filter((k) => /rag/i.test(k)),
});

// --- cleanup ---------------------------------------------------------------------
try {
  if (typeof qvac.stopQVACProvider === 'function') await qvac.stopQVACProvider();
  record('cleanup', true, {});
} catch (err) {
  record('cleanup', false, { error: String(err) });
}

console.log('\n=== SUMMARY (paste back) ===\n' + JSON.stringify(summary, null, 2));
