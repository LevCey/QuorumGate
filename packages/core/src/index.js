// @ts-check
export { runChecks } from './run-checks.js';
export { computeVerdictFloor, clampVerdict } from './verdict.js';
export { DEFAULT_CONFIG } from './config.js';
export { checkIbanChange } from './checks/iban-change.js';
export { checkDuplicateInvoice } from './checks/duplicate-invoice.js';
export { checkSenderDomain } from './checks/sender-domain.js';
export { checkUrgencyLanguage } from './checks/urgency-language.js';
export { checkInvoicePoMismatch } from './checks/invoice-po-mismatch.js';
export { checkAbnormalAmount } from './checks/abnormal-amount.js';
export { checkMissingApproval } from './checks/missing-approval.js';
export { checkSupplierIdentity } from './checks/supplier-identity.js';
