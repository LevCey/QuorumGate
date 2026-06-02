// @ts-check
/** @typedef {import('./types.js').CheckConfig} CheckConfig */

/**
 * Default, documented thresholds. Every value is tunable per deployment; the
 * defaults are deliberately conservative for a finance review desk.
 * @type {CheckConfig}
 */
export const DEFAULT_CONFIG = {
  // A prior payment of the same amount within this many days is treated as a
  // possible duplicate.
  duplicateInvoice: { dateWindowDays: 5 },
  // A sender domain within this edit distance of an approved domain is flagged
  // as a look-alike.
  senderDomain: { lookalikeMaxDistance: 2 },
  // Substrings that signal pressure / urgency in a supplier message.
  urgency: {
    patterns: [
      'urgent',
      'pay today',
      'immediately',
      'as soon as possible',
      'asap',
      'wire today',
      'right away',
      'final notice',
      'overdue',
      'last chance',
    ],
  },
  // Allowed relative difference between the invoice amount and the linked PO total.
  invoicePoMismatch: { amountTolerance: 0.01 },
  // An amount above this multiple of the supplier's historical mean is abnormal.
  abnormalAmount: { meanMultiple: 3 },
};
