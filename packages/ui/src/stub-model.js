// @ts-check
/** @typedef {import('../../qvac-pipeline/src/model.js').ReasoningModel} ReasoningModel */

const FLOOR_RE = /floor \(code-decided\): (APPROVE|HOLD|ESCALATE)/;

/**
 * A deterministic, offline reasoning model. It does not reason — it returns the
 * code-decided verdict floor (parsed from the prompt) and a templated memo listing
 * the fired checks. Use it to run the desk reproducibly without the QVAC SDK (offline
 * demos, tests); the real product uses `createQvacModel`. Because it returns the
 * floor, the code clamp leaves it unchanged.
 *
 * @returns {ReasoningModel}
 */
export function createStubModel() {
  return {
    async complete({ prompt }) {
      const floor = prompt.match(FLOOR_RE)?.[1] ?? 'HOLD';
      const fired = prompt
        .split('\n')
        .filter((line) => line.startsWith('- ['))
        .map((line) => line.replace(/^- /, ''));
      const memo = fired.length
        ? `Offline stub: verdict ${floor} follows the code-decided floor. Findings: ${fired.join('; ')}.`
        : `Offline stub: verdict ${floor}; no checks failed.`;
      return { text: JSON.stringify({ verdict: floor, memo }) };
    },
  };
}
