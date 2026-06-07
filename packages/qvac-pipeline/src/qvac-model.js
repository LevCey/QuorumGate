// @ts-check
/** @typedef {import('./model.js').ReasoningModel} ReasoningModel */
/** @typedef {import('./model.js').CompletionRequest} CompletionRequest */
/** @typedef {import('./model.js').CompletionResult} CompletionResult */

/**
 * Build a {@link ReasoningModel} backed by the QVAC SDK — the single SDK seam for
 * Layer B. The pipeline depends on the `ReasoningModel` interface; this adapter maps
 * it onto `@qvac/sdk` (loadModel returns a modelId; completion streams via
 * `result.tokenStream`).
 *
 * `@qvac/sdk` is imported lazily, inside this function, so importing the pipeline
 * does not load the SDK (~780 packages) unless a real model is actually used.
 *
 * Tool calling is intentionally not wired here: the pipeline runs the
 * code-orchestrated path (D11); tool calling requires a tools-configured model load
 * (`modelConfig: { tools: true, toolsMode: 'dynamic' }`) plus a capable model — a
 * later enhancement, not a dependency.
 *
 * Validate on the demo hardware with a real model (see `scripts/spike-qvac.mjs`).
 *
 * @param {{ modelSrc: string, modelType?: string, modelConfig?: Record<string, unknown> }} options
 * @returns {Promise<ReasoningModel & { modelId: string }>}
 */
export async function createQvacModel({ modelSrc, modelType = 'llm', modelConfig }) {
  const { loadModel, completion } = await import('@qvac/sdk');
  const modelId = await loadModel({ modelType, modelSrc, ...(modelConfig ? { modelConfig } : {}) });

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

      const result = await completion({ modelId, history, stream: true });

      let text = '';
      for await (const chunk of result.tokenStream) {
        text += typeof chunk === 'string' ? chunk : (chunk?.text ?? chunk?.token ?? '');
      }
      return { text };
    },
  };
}
