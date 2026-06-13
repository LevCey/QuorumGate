// @ts-check
/** @typedef {import('../../core/src/types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('../../core/src/verdict.js').VerdictFloor} VerdictFloor */
/** @typedef {import('./review.js').ReviewResult} ReviewResult */

export const EVIDENCE_SCHEMA_VERSION = 1;

/**
 * The audit-evidence bundle exported for a completed review (R9.1).
 * @typedef {object} EvidenceBundle
 * @property {number} schemaVersion
 * @property {string} generatedAt
 * @property {{ id: string, name?: string }} supplier
 * @property {{ amount?: number, currency?: string, invoiceNumber?: string, destinationIban: string }} payment
 * @property {{ checkId: string, status: string, severity: string, evidence: Record<string, unknown> }[]} checks
 * @property {VerdictFloor} floor
 * @property {{ modelProposed: string, final: string, memo: string }} verdict
 * @property {unknown} secondReview
 * @property {string | null} humanDecision
 */

/**
 * Assemble the audit-evidence bundle for a completed review (R9.1). It is exported
 * locally, contains no raw files, and records no cloud calls; the destination IBAN
 * is masked. The full check set (including passes) is recorded so the evaluation is
 * auditable end to end.
 *
 * @param {object} input
 * @param {NormalizedRequest} input.request
 * @param {ReviewResult} input.review
 * @param {unknown} [input.secondReview]      Second reviewer's opinion (four-eyes), if any.
 * @param {string} [input.finalVerdict]       Overall recommendation (first review combined with the second); defaults to the first review's verdict.
 * @param {string | null} [input.humanDecision]
 * @param {string} [input.generatedAt]        ISO timestamp (defaults to now).
 * @returns {EvidenceBundle}
 */
export function buildEvidenceBundle({ request, review, secondReview = null, finalVerdict, humanDecision = null, generatedAt }) {
  /** @type {EvidenceBundle['payment']} */
  const payment = { destinationIban: maskIban(request.destinationIban) };
  if (request.amount != null) payment.amount = request.amount;
  if (request.currency) payment.currency = request.currency;
  if (request.invoiceNumber) payment.invoiceNumber = request.invoiceNumber;

  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    generatedAt: generatedAt ?? new Date().toISOString(),
    supplier: { id: request.supplierId, ...(request.supplierName ? { name: request.supplierName } : {}) },
    payment,
    checks: review.checks.map((r) => ({
      checkId: r.checkId,
      status: r.status,
      severity: r.severity,
      evidence: r.evidence,
    })),
    floor: review.floor,
    verdict: {
      modelProposed: review.modelProposed,
      final: finalVerdict ?? review.verdict,
      memo: review.memo,
      memoSource: 'model-generated (not authoritative)',
    },
    secondReview,
    humanDecision,
  };
}

/**
 * The remote-call disclosure required by the hackathon (R9.3). QuorumGate makes no
 * cloud or third-party AI calls, so the list is empty by design.
 * @returns {{ schemaVersion: number, calls: never[], note: string }}
 */
export function remoteCallDisclosure() {
  return {
    schemaVersion: 1,
    calls: [],
    note: 'QuorumGate performs no cloud or third-party AI calls; all inference is local via the QVAC SDK.',
  };
}

/**
 * Mask all but the last four characters of an IBAN.
 * @param {string} iban
 * @returns {string}
 */
function maskIban(iban) {
  const trimmed = iban.replace(/\s+/g, '');
  if (trimmed.length <= 4) return trimmed;
  return `${'•'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}
