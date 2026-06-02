// @ts-check
/** @typedef {import('../types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../types.js').SupplierHistory} SupplierHistory */
/** @typedef {import('../types.js').CheckConfig} CheckConfig */
/** @typedef {import('../types.js').CheckResult} CheckResult */

export const CHECK_ID = 'sender_domain';

/**
 * Suspicious-sender-domain check (high). Fails when the sender's domain is not an
 * approved domain for the supplier. When the domain is a near-match of an approved
 * domain, the evidence flags it as a look-alike.
 *
 * @param {NormalizedRequest} request
 * @param {SupplierHistory} history
 * @param {CheckConfig} config
 * @returns {CheckResult}
 */
export function checkSenderDomain(request, history, config) {
  const domain = request.senderDomain?.trim().toLowerCase();
  const approved = (history.approvedDomains ?? []).map((d) => d.trim().toLowerCase());

  if (!domain || approved.length === 0) {
    return mk('SKIP', { note: 'No sender domain or no approved domains on file.' });
  }
  if (approved.includes(domain)) {
    return mk('PASS', { senderDomain: domain });
  }

  let nearest = approved[0];
  let best = levenshtein(domain, nearest);
  for (const candidate of approved.slice(1)) {
    const dist = levenshtein(domain, candidate);
    if (dist < best) {
      best = dist;
      nearest = candidate;
    }
  }

  const lookalike = best <= config.senderDomain.lookalikeMaxDistance;
  return mk('FAIL', {
    senderDomain: domain,
    nearestApprovedDomain: nearest,
    editDistance: best,
    note: lookalike
      ? 'Sender domain is a look-alike of an approved supplier domain.'
      : 'Sender domain is not approved for this supplier.',
  });
}

/**
 * @param {import('../types.js').CheckStatus} status
 * @param {Record<string, unknown>} evidence
 * @returns {CheckResult}
 */
function mk(status, evidence) {
  return { checkId: CHECK_ID, status, severity: 'high', evidence };
}

/**
 * Levenshtein edit distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
