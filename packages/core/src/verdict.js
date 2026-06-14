// @ts-check
/** @typedef {import('./types.js').CheckResult} CheckResult */
/** @typedef {import('./types.js').Verdict} Verdict */

/**
 * Conservatism ordering. A higher rank is a more conservative verdict.
 * @type {Record<Verdict, number>}
 */
const VERDICT_RANK = { APPROVE: 0, HOLD: 1, ESCALATE: 2 };

/**
 * The code-decided verdict floor for a set of fired checks.
 * @typedef {object} VerdictFloor
 * @property {Verdict} floor             Minimum verdict the reviewer may issue.
 * @property {boolean} approveForbidden  True when APPROVE is not permitted.
 * @property {boolean} escalateEligible  True when the case may be escalated to four-eyes.
 * @property {boolean} [insufficientEvidence]  True when APPROVE was forbidden because too many checks could not be evaluated.
 */

/**
 * Compute the deterministic verdict floor from the fired checks.
 *
 * This is the auditable heart of the desk: the floor is decided here, in code, from
 * the check results alone. A high- or medium-severity failure forbids approval;
 * low-severity failures are advisory and do not block on their own. The reasoning
 * model may tighten this floor, never loosen it.
 *
 * @param {CheckResult[]} results
 * @param {{ insufficientEvidence?: { maxSkipsForApprove?: number } }} [config]
 * @returns {VerdictFloor}
 */
export function computeVerdictFloor(results, config = {}) {
  const fails = results.filter((r) => r.status === 'FAIL');
  const highFails = fails.filter((r) => r.severity === 'high');
  const mediumFails = fails.filter((r) => r.severity === 'medium');

  if (highFails.length > 0) {
    return { floor: 'HOLD', approveForbidden: true, escalateEligible: true };
  }
  if (mediumFails.length > 0) {
    return { floor: 'HOLD', approveForbidden: true, escalateEligible: mediumFails.length >= 2 };
  }
  // Insufficient evidence: when too many checks could not be evaluated (a sparse
  // supplier record), "couldn't evaluate" is treated as risk, not as a pass — APPROVE
  // is forbidden so a low-signal verdict does not rest on checks that never ran.
  const maxSkips = config.insufficientEvidence?.maxSkipsForApprove ?? 3;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  if (skipped > maxSkips) {
    return { floor: 'HOLD', approveForbidden: true, escalateEligible: false, insufficientEvidence: true };
  }
  // Only low-severity (advisory) signals, or none: approval remains permitted. The
  // model may still choose to HOLD on the strength of advisory signals.
  return { floor: 'APPROVE', approveForbidden: false, escalateEligible: false };
}

/**
 * Clamp a model-proposed verdict to the code-decided floor.
 *
 * Invariant: the model may only make the verdict MORE conservative. A proposal below
 * the floor (for example APPROVE while a high-severity check failed) is raised to the
 * floor. The model can never turn a failed check into an approval.
 *
 * @param {Verdict} proposed    Verdict suggested by the reasoning model.
 * @param {VerdictFloor} floor  Output of {@link computeVerdictFloor}.
 * @returns {Verdict}
 */
export function clampVerdict(proposed, floor) {
  return VERDICT_RANK[proposed] < VERDICT_RANK[floor.floor] ? floor.floor : proposed;
}

/**
 * Combine two verdicts into the more conservative one. Used to fold a second
 * reviewer's verdict into the first in a four-eyes review: the case takes the
 * stricter of the two, so the second reviewer can only tighten the outcome.
 *
 * @param {Verdict} a
 * @param {Verdict} b
 * @returns {Verdict}
 */
export function moreConservative(a, b) {
  return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b;
}
