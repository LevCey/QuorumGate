// @ts-check
/** @typedef {import('./model.js').ReasoningModel} ReasoningModel */
/** @typedef {import('./model.js').CompletionRequest} CompletionRequest */
/** @typedef {import('./model.js').CompletionResult} CompletionResult */
/** @typedef {import('./audit-log.js').AuditLog} AuditLog */

/**
 * Build a {@link ReasoningModel} backed by the QVAC SDK — the single SDK seam for
 * Layer B. The pipeline depends on the `ReasoningModel` interface; this adapter maps
 * it onto `@qvac/sdk` (loadModel returns a modelId; completion streams via
 * `result.tokenStream`).
 *
 * `@qvac/sdk` is imported lazily, inside this function, so importing the pipeline
 * does not load the SDK (~780 packages) unless a real model is actually used. If an
 * {@link AuditLog} is supplied, the model load and each completion are recorded
 * (loadMs, TTFT, tokens, tokens/sec) for the R9.2 audit artifact.
 *
 * Tool calling is intentionally not wired here: the pipeline runs the
 * code-orchestrated path (D11); tool calling requires a tools-configured model load
 * (`modelConfig: { tools: true, toolsMode: 'dynamic' }`) plus a capable model — a
 * later enhancement, not a dependency.
 *
 * Validate on the demo hardware with a real model (see `scripts/spike-qvac.mjs`).
 *
 * When `delegate` is given, the model runs on a peer device (QVAC delegated
 * inference) — this is the four-eyes second reviewer. `modelSrc` is then resolved on
 * the peer. Set `delegate.fallbackToLocal: false` to make an unreachable peer throw,
 * so the caller's own fallback decides what happens (and the source stays honest).
 *
 * @param {{ modelSrc: string, modelType?: string, modelConfig?: Record<string, unknown>, auditLog?: AuditLog, delegate?: { providerPublicKey: string, fallbackToLocal?: boolean, timeout?: number } }} options
 * @returns {Promise<ReasoningModel & { modelId: string }>}
 */
export async function createQvacModel({ modelSrc, modelType = 'llm', modelConfig, auditLog, delegate }) {
  const { loadModel, completion } = await import('@qvac/sdk');
  const loadStart = Date.now();
  const modelId = await loadModel({
    modelType,
    modelSrc,
    ...(modelConfig ? { modelConfig } : {}),
    ...(delegate ? { delegate } : {}),
  });
  auditLog?.modelLoad({ modelId: String(modelId), modelSrc, loadMs: Date.now() - loadStart, delegated: !!delegate });

  return {
    modelId,
    /**
     * @param {CompletionRequest} request
     * @returns {Promise<CompletionResult>}
     */
    async complete(request) {
      const history = [];
      if (request.system) history.push({ role: 'system', content: request.system });
      history.push({ role: 'user', content: request.prompt });

      const start = process.hrtime.bigint();
      let firstTokenNs = null;
      let text = '';
      let tokens = 0;
      const result = await completion({ modelId, history, stream: true });
      for await (const chunk of result.tokenStream) {
        if (firstTokenNs === null) firstTokenNs = process.hrtime.bigint();
        text += typeof chunk === 'string' ? chunk : (chunk?.text ?? chunk?.token ?? '');
        tokens += 1;
      }
      const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
      auditLog?.completion({
        modelId: String(modelId),
        promptChars: request.prompt.length,
        tokens,
        ttftMs: firstTokenNs ? +(Number(firstTokenNs - start) / 1e6).toFixed(1) : null,
        totalMs: +totalMs.toFixed(1),
        tokensPerSec: tokens > 1 ? +(tokens / (totalMs / 1000)).toFixed(1) : null,
      });
      return { text };
    },
  };
}
