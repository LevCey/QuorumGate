// @ts-check
/** @typedef {import('./embedder.js').Embedder} Embedder */

/**
 * Build an {@link Embedder} backed by the QVAC SDK `embed`. The SDK is imported
 * lazily (like {@link import('./qvac-model.js').createQvacModel}) so importing the
 * pipeline does not load it.
 *
 * The call shape is verified against the `@qvac/sdk` types: an embedding model is
 * loaded with `modelType: 'llamacpp-embedding'`, and `embed({ modelId, text })` with
 * an array of texts returns `{ embedding: number[][] }` — one vector per input.
 * Validate the actual run on the demo hardware before relying on it.
 *
 * @param {{ modelSrc: string, modelType?: string }} options
 * @returns {Promise<Embedder>}
 */
export async function createQvacEmbedder({ modelSrc, modelType = 'llamacpp-embedding' }) {
  const { loadModel, embed } = await import('@qvac/sdk');
  const modelId = await loadModel({ modelType, modelSrc });
  return {
    /**
     * @param {string[]} texts
     * @returns {Promise<number[][]>}
     */
    async embed(texts) {
      const { embedding } = await embed({ modelId, text: texts });
      return embedding;
    },
  };
}
