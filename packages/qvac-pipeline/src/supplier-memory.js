// @ts-check
/** @typedef {import('./embedder.js').Embedder} Embedder */
/** @typedef {import('../../core/src/types.js').SupplierHistory} SupplierHistory */

/**
 * Build a short, plain-text note from a supplier's structured record — the unit a RAG
 * retrieval grounds the memo in. Synthesized from the record (no free text), and
 * deliberately excludes the tax id and the full IBAN; only the last four IBAN
 * characters appear, matching how the rest of the system handles them.
 *
 * @param {SupplierHistory} s
 * @returns {string}
 */
export function supplierNote(s) {
  const parts = [`Supplier ${s.supplierName ?? s.supplierId} (${s.supplierId}).`];
  if (s.verifiedIbans?.length) {
    const last4 = s.verifiedIbans.map((i) => i.replace(/\s+/g, '').slice(-4));
    parts.push(`Verified IBAN(s) ending ${last4.join(', ')}.`);
  }
  if (s.approvedDomains?.length) parts.push(`Approved domain(s): ${s.approvedDomains.join(', ')}.`);
  if (s.pastAmounts?.length) {
    parts.push(`Typical amount ${Math.min(...s.pastAmounts)}–${Math.max(...s.pastAmounts)}.`);
  }
  if (s.country) parts.push(`Country ${s.country}.`);
  return parts.join(' ');
}

/**
 * Cosine similarity of two equal-length vectors. Returns 0 when either is a zero
 * vector (no shared signal) rather than dividing by zero.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na > 0 && nb > 0 ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * A small in-memory retrieval index over supplier notes (local RAG). Embed the corpus
 * once, then retrieve the top-k most similar notes to a query. Used to ground the memo
 * in the company's own records and to surface the nearest known supplier for
 * fuzzy/impersonation cases. It is additive evidence — the deterministic supplier
 * lookup and the verdict floor remain authoritative.
 */
export class SupplierMemory {
  /**
   * @param {{ supplierId: string, text: string }[]} notes
   * @param {number[][]} vectors
   */
  constructor(notes, vectors) {
    this.notes = notes;
    this.vectors = vectors;
  }

  /**
   * Build the index from supplier records, embedding each note once.
   * @param {SupplierHistory[]} suppliers
   * @param {Embedder} embedder
   * @returns {Promise<SupplierMemory>}
   */
  static async build(suppliers, embedder) {
    const notes = suppliers.map((s) => ({ supplierId: s.supplierId, text: supplierNote(s) }));
    const vectors = notes.length ? await embedder.embed(notes.map((n) => n.text)) : [];
    return new SupplierMemory(notes, vectors);
  }

  /**
   * Retrieve the top-k notes most similar to a query text.
   * @param {string} queryText
   * @param {Embedder} embedder
   * @param {number} [k]
   * @returns {Promise<{ supplierId: string, text: string, score: number }[]>}
   */
  async retrieve(queryText, embedder, k = 2) {
    if (this.notes.length === 0) return [];
    const [query] = await embedder.embed([queryText]);
    return this.notes
      .map((note, i) => ({ ...note, score: cosineSimilarity(query, this.vectors[i]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}
