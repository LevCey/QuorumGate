// @ts-check
/** @typedef {import('../types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../types.js').CheckConfig} CheckConfig */
/** @typedef {import('../types.js').CheckResult} CheckResult */

export const CHECK_ID = 'urgency_language';

/**
 * Urgency / pressure-language check (low, advisory). Fails when the supplier message
 * contains configured pressure phrases. Low severity on its own — it contributes to
 * the risk picture but does not block a payment by itself.
 *
 * @param {NormalizedRequest} request
 * @param {CheckConfig} config
 * @returns {CheckResult}
 */
export function checkUrgencyLanguage(request, config) {
  const text = request.messageText?.toLowerCase();
  if (!text) {
    return mk('SKIP', { note: 'No supplier message text to scan.' });
  }

  const matched = config.urgency.patterns.filter((p) => text.includes(p.toLowerCase()));
  if (matched.length === 0) {
    return mk('PASS', {});
  }
  return mk('FAIL', { matchedPhrases: matched, note: 'Pressure / urgency language detected.' });
}

/**
 * @param {import('../types.js').CheckStatus} status
 * @param {Record<string, unknown>} evidence
 * @returns {CheckResult}
 */
function mk(status, evidence) {
  return { checkId: CHECK_ID, status, severity: 'low', evidence };
}
