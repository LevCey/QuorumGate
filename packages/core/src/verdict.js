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
 */

/**
 * Compute the deterministic verdict floor from the fired checks.
 *
 * This is the auditable heart of the desk: the floor is decided here, in code, from
 * the check results alone. A high-severity failure forbids approval; any failure
 * blocks a clean approve. The reasoning model may tighten this floor, never loosen it.
 *
 * @param {CheckResult[]} results
 * @returns {VerdictFloor}
 */
export function computeVerdictFloor(results) {
  const fails = results.filter((r) => r.status === 'FAIL');
  const highFails = fails.filter((r) => r.severity === 'high');

  if (highFails.length > 0) {
    return { floor: 'HOLD', approveForbidden: true, escalateEligible: true };
  }
  if (fails.length > 0) {
    return { floor: 'HOLD', approveForbidden: true, escalateEligible: fails.length >= 2 };
  }
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
