// @ts-check
/** @typedef {import('../../core/src/types.js').SupplierHistory} SupplierHistory */

/**
 * A local, on-device store of the company's supplier records. Lookup is a
 * deterministic match by supplier id — this is the pre-retrieval that grounds the
 * Layer A checks (design §3.2–§3.3). An embeddings / RAG layer over the same records
 * (via the QVAC SDK, for fuzzy supplier matching) is a later enhancement; the
 * deterministic lookup here is what the checks depend on.
 */
export class SupplierStore {
  /** @param {SupplierHistory[]} records */
  constructor(records) {
    /** @type {Map<string, SupplierHistory>} */
    this.bySupplierId = new Map(records.map((r) => [r.supplierId, r]));
  }

  /**
   * @param {string} supplierId
   * @returns {SupplierHistory | null}
   */
  lookup(supplierId) {
    return this.bySupplierId.get(supplierId) ?? null;
  }

  /** @returns {number} */
  get size() {
    return this.bySupplierId.size;
  }
}
