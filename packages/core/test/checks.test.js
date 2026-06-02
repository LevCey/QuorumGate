// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG as cfg } from '../src/config.js';
import { checkDuplicateInvoice } from '../src/checks/duplicate-invoice.js';
import { checkSenderDomain } from '../src/checks/sender-domain.js';
import { checkUrgencyLanguage } from '../src/checks/urgency-language.js';
import { checkInvoicePoMismatch } from '../src/checks/invoice-po-mismatch.js';
import { checkAbnormalAmount } from '../src/checks/abnormal-amount.js';
import { checkMissingApproval } from '../src/checks/missing-approval.js';
import { checkSupplierIdentity } from '../src/checks/supplier-identity.js';

/** @param {Partial<import('../src/types.js').NormalizedRequest>} [over] @returns {import('../src/types.js').NormalizedRequest} */
const req = (over = {}) => ({ supplierId: 'acme', destinationIban: 'DE89370400440532013000', ...over });
/** @param {Partial<import('../src/types.js').SupplierHistory>} [over] @returns {import('../src/types.js').SupplierHistory} */
const hist = (over = {}) => ({ supplierId: 'acme', verifiedIbans: ['DE89370400440532013000'], ...over });

// --- duplicate_invoice (R5.2) ---
test('duplicate_invoice: repeated invoice number fails', () => {
  assert.equal(checkDuplicateInvoice(req({ invoiceNumber: 'INV-100' }), hist({ pastInvoiceNumbers: ['inv-100'] }), cfg).status, 'FAIL');
});
test('duplicate_invoice: same amount within window fails', () => {
  assert.equal(checkDuplicateInvoice(req({ amount: 500, invoiceDate: '2026-06-02' }), hist({ pastPayments: [{ amount: 500, date: '2026-06-01' }] }), cfg).status, 'FAIL');
});
test('duplicate_invoice: a novel invoice passes', () => {
  assert.equal(checkDuplicateInvoice(req({ invoiceNumber: 'INV-999', amount: 500, invoiceDate: '2026-06-01' }), hist({ pastInvoiceNumbers: ['INV-100'], pastPayments: [{ amount: 10, date: '2020-01-01' }] }), cfg).status, 'PASS');
});
test('duplicate_invoice: no comparable data skips', () => {
  assert.equal(checkDuplicateInvoice(req(), hist(), cfg).status, 'SKIP');
});

// --- sender_domain (R5.3) ---
test('sender_domain: an approved domain passes', () => {
  assert.equal(checkSenderDomain(req({ senderDomain: 'acme.com' }), hist({ approvedDomains: ['acme.com'] }), cfg).status, 'PASS');
});
test('sender_domain: a look-alike fails and is flagged high', () => {
  const r = checkSenderDomain(req({ senderDomain: 'acme.co' }), hist({ approvedDomains: ['acme.com'] }), cfg);
  assert.equal(r.status, 'FAIL');
  assert.equal(r.severity, 'high');
  assert.match(String(r.evidence.note), /look-alike/);
});
test('sender_domain: an unrelated domain fails as not approved', () => {
  const r = checkSenderDomain(req({ senderDomain: 'unrelated-supplier-xyz.com' }), hist({ approvedDomains: ['acme.com'] }), cfg);
  assert.equal(r.status, 'FAIL');
  assert.match(String(r.evidence.note), /not approved/);
});
test('sender_domain: missing data skips', () => {
  assert.equal(checkSenderDomain(req(), hist(), cfg).status, 'SKIP');
});

// --- urgency_language (R5.4) ---
test('urgency_language: pressure phrases fail at low severity', () => {
  const r = checkUrgencyLanguage(req({ messageText: 'Please PAY TODAY, this is urgent.' }), cfg);
  assert.equal(r.status, 'FAIL');
  assert.equal(r.severity, 'low');
});
test('urgency_language: a neutral message passes', () => {
  assert.equal(checkUrgencyLanguage(req({ messageText: 'Invoice attached, thank you.' }), cfg).status, 'PASS');
});

// --- invoice_po_mismatch (R5.5) ---
test('invoice_po_mismatch: amount over the PO fails', () => {
  assert.equal(checkInvoicePoMismatch(req({ amount: 1500, purchaseOrder: { total: 1000 } }), cfg).status, 'FAIL');
});
test('invoice_po_mismatch: a matching amount passes', () => {
  assert.equal(checkInvoicePoMismatch(req({ amount: 1000, purchaseOrder: { total: 1000 } }), cfg).status, 'PASS');
});
test('invoice_po_mismatch: no PO skips', () => {
  assert.equal(checkInvoicePoMismatch(req({ amount: 1000 }), cfg).status, 'SKIP');
});

// --- abnormal_amount (R5.6) ---
test('abnormal_amount: an outlier fails', () => {
  assert.equal(checkAbnormalAmount(req({ amount: 5000 }), hist({ pastAmounts: [900, 1000, 1100] }), cfg).status, 'FAIL');
});
test('abnormal_amount: an in-range amount passes', () => {
  assert.equal(checkAbnormalAmount(req({ amount: 1000 }), hist({ pastAmounts: [900, 1000, 1100] }), cfg).status, 'PASS');
});
test('abnormal_amount: no history skips', () => {
  assert.equal(checkAbnormalAmount(req({ amount: 1000 }), hist(), cfg).status, 'SKIP');
});

// --- missing_approval (R5.7) ---
test('missing_approval: no reference fails', () => {
  assert.equal(checkMissingApproval(req(), hist()).status, 'FAIL');
});
test('missing_approval: an unknown reference fails', () => {
  assert.equal(checkMissingApproval(req({ approvalRef: 'X' }), hist({ approvedRefs: ['A', 'B'] })).status, 'FAIL');
});
test('missing_approval: a recognized reference passes', () => {
  assert.equal(checkMissingApproval(req({ approvalRef: 'A' }), hist({ approvedRefs: ['A', 'B'] })).status, 'PASS');
});

// --- supplier_identity (R5.8) ---
test('supplier_identity: a tax-id drift fails', () => {
  assert.equal(checkSupplierIdentity(req({ taxId: '111' }), hist({ taxId: '222' })).status, 'FAIL');
});
test('supplier_identity: a case-insensitive name match passes', () => {
  assert.equal(checkSupplierIdentity(req({ supplierName: 'Acme GmbH' }), hist({ supplierName: 'acme gmbh' })).status, 'PASS');
});
test('supplier_identity: nothing comparable skips', () => {
  assert.equal(checkSupplierIdentity(req(), hist()).status, 'SKIP');
});
