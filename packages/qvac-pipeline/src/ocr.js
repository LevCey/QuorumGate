// @ts-check

/**
 * The OCR interface. Like the other SDK seams (ReasoningModel, Embedder), the pipeline
 * depends on this, never on `@qvac/sdk` directly, so the SDK is a single pluggable
 * adapter and the text-handling stays testable with mock blocks.
 *
 * @typedef {{ text: string, confidence?: number, bbox?: unknown }} OcrBlock
 * @typedef {object} Ocr
 * @property {(image: string | Buffer) => Promise<OcrBlock[]>} extract  Detect and recognize text blocks in an image.
 */

/**
 * Join OCR text blocks (in detection order) into a single string.
 * @param {OcrBlock[]} blocks
 * @returns {string}
 */
export function ocrBlocksToText(blocks) {
  return blocks.map((b) => b.text).join('\n');
}

/**
 * The blocks whose recognition confidence is below a threshold — surfaced so a human
 * reviews fields the OCR was unsure about, rather than trusting them silently. Mirrors
 * the `lowConfidence` field the normalized request already carries.
 * @param {OcrBlock[]} blocks
 * @param {number} [threshold]
 * @returns {OcrBlock[]}
 */
export function lowConfidenceBlocks(blocks, threshold = 0.5) {
  return blocks.filter((b) => typeof b.confidence === 'number' && b.confidence < threshold);
}
