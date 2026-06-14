// @ts-check

/**
 * The embedding-model interface. Like {@link import('./model.js').ReasoningModel}, the
 * pipeline depends on this interface, never on `@qvac/sdk` directly, so the SDK is a
 * single pluggable adapter and retrieval stays testable with a deterministic mock.
 * @typedef {object} Embedder
 * @property {(texts: string[]) => Promise<number[][]>} embed  Embed each text into a vector.
 */

export {};
