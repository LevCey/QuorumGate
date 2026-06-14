// @ts-check
import { resolve } from 'node:path';
/** @typedef {import('./ocr.js').Ocr} Ocr */

/**
 * Build an {@link Ocr} backed by the QVAC SDK `ocr`. The call shape is verified against
 * the exported `@qvac/sdk` client types (`client/api/ocr.d.ts`): an OCR model is loaded
 * with `modelType: 'ocr'` (and a language list), and `ocr({ modelId, image })` returns
 * `{ blocks, blockStream, stats }` where `blocks` is a *promise* of the detected text
 * blocks (`{ text, bbox, confidence }`), which we await. (The async-iterable streaming
 * variant is the separate `blockStream`.) The SDK is imported lazily; the model load and
 * recognition are validated on the demo hardware (see `evidence/model-pin.md`).
 *
 * `modelSrc` defaults to the SDK's bundled latin OCR recognizer (downloaded from the
 * registry on first use); pass a local path to override it.
 *
 * @param {{ modelSrc?: string, langList?: string[] }} [options]
 * @returns {Promise<Ocr & { modelId: string }>}
 */
export async function createQvacOcr({ modelSrc, langList = ['en'] } = {}) {
  const { loadModel, ocr, OCR_LATIN_RECOGNIZER_1 } = await import('@qvac/sdk');
  const modelId = await loadModel({
    modelType: 'ocr',
    modelSrc: modelSrc ? resolve(modelSrc) : OCR_LATIN_RECOGNIZER_1,
    modelConfig: { langList },
  });
  return {
    modelId,
    /**
     * @param {string | Buffer} image
     * @returns {Promise<import('./ocr.js').OcrBlock[]>}
     */
    async extract(image) {
      const { blocks } = ocr({ modelId, image: typeof image === 'string' ? resolve(image) : image });
      return blocks;
    },
  };
}
