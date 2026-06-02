// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks } from '../src/run-checks.js';

const verifiedIban = 'DE89 3704 0044 0532 0130 00';

/** @type {import('../src/types.js').SupplierHistory} */
const history = {
  supplierId: 'acme',
  verifiedIbans: [verifiedIban],
  approvedDomains: ['acme.com'],
  pastInvoiceNumbers: ['INV-100', 'INV-101'],
  pastAmounts: [9500, 10000, 10500],
  approvedRefs: ['PO-2026-042'],
  supplierName: 'Acme GmbH',
  taxId: 'DE123456789',
  country: 'DE',
};

test('a clean, well-formed request yields an APPROVE floor', () => {
  const { results, floor } = runChecks(
    {
      supplierId: 'acme',
      destinationIban: verifiedIban,
      senderDomain: 'acme.com',
      amount: 10200,
      invoiceNumber: 'INV-200',
      invoiceDate: '2026-06-10',
      supplierName: 'Acme GmbH',
      taxId: 'DE123456789',
      country: 'DE',
      messageText: 'Invoice attached for this month. Thank you.',
      approvalRef: 'PO-2026-042',
      purchaseOrder: { total: 10200 },
    },
    history,
  );
  assert.equal(results.some((r) => r.status === 'FAIL'), false);
  assert.equal(floor.floor, 'APPROVE');
  assert.equal(floor.approveForbidden, false);
});

test('the BEC trap (changed IBAN + look-alike domain + urgency) forces a HOLD floor', () => {
  const { results, floor } = runChecks(
    {
      supplierId: 'acme',
      destinationIban: 'GB29 NWBK 6016 1331 9268 19', // attacker account
      senderDomain: 'acme.co', // look-alike of acme.com
      amount: 10200,
      invoiceNumber: 'INV-201',
      invoiceDate: '2026-06-10',
      supplierName: 'Acme GmbH',
      taxId: 'DE123456789',
      country: 'DE',
      messageText: 'Please wire today — this is urgent, final notice.',
      approvalRef: 'PO-2026-042',
    },
    history,
  );
  assert.equal(results.find((r) => r.checkId === 'iban_change')?.status, 'FAIL');
  assert.equal(results.find((r) => r.checkId === 'sender_domain')?.status, 'FAIL');
  assert.equal(floor.floor, 'HOLD');
  assert.equal(floor.approveForbidden, true);
  assert.equal(floor.escalateEligible, true);
});

test('the full evaluation is deterministic — identical inputs, identical output', () => {
  const request = {
    supplierId: 'acme',
    destinationIban: verifiedIban,
    senderDomain: 'acme.com',
    amount: 10000,
    approvalRef: 'PO-2026-042',
  };
  assert.deepEqual(runChecks({ ...request }, history), runChecks({ ...request }, history));
});
