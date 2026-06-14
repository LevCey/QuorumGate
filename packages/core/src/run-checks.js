// @ts-check
import { checkIbanChange } from './checks/iban-change.js';
import { checkDuplicateInvoice } from './checks/duplicate-invoice.js';
import { checkSenderDomain } from './checks/sender-domain.js';
import { checkUrgencyLanguage } from './checks/urgency-language.js';
import { checkInvoicePoMismatch } from './checks/invoice-po-mismatch.js';
import { checkAbnormalAmount } from './checks/abnormal-amount.js';
import { checkMissingApproval } from './checks/missing-approval.js';
import { checkSupplierIdentity } from './checks/supplier-identity.js';
import { DEFAULT_CONFIG } from './config.js';
import { computeVerdictFloor } from './verdict.js';

/** @typedef {import('./types.js').NormalizedRequest} NormalizedRequest */
/** @typedef {import('./types.js').SupplierHistory} SupplierHistory */
/** @typedef {import('./types.js').CheckConfig} CheckConfig */
/** @typedef {import('./types.js').CheckResult} CheckResult */
/** @typedef {import('./verdict.js').VerdictFloor} VerdictFloor */

/**
 * Run every deterministic risk check over a request and the supplier's history,
 * then compute the code-decided verdict floor. No model is involved — this is the
 * full Layer A evaluation, identical for identical inputs.
 *
 * @param {NormalizedRequest} request
 * @param {SupplierHistory} history
 * @param {CheckConfig} [config]
 * @returns {{ results: CheckResult[], floor: VerdictFloor }}
 */
export function runChecks(request, history, config = DEFAULT_CONFIG) {
  const results = [
    checkIbanChange(request, history),
    checkDuplicateInvoice(request, history, config),
    checkSenderDomain(request, history, config),
    checkUrgencyLanguage(request, config),
    checkInvoicePoMismatch(request, config),
    checkAbnormalAmount(request, history, config),
    checkMissingApproval(request, history),
    checkSupplierIdentity(request, history),
  ];
  return { results, floor: computeVerdictFloor(results, config) };
}
