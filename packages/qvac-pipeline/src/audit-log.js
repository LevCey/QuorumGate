// @ts-check

/**
 * @typedef {object} AuditEntry
 * @property {string} type   e.g. 'model_load', 'model_unload', 'completion'.
 * @property {string} at     ISO timestamp.
 * @property {Record<string, unknown>} [data]
 */

/**
 * An append-only audit log of model loads/unloads and inference-call performance, in
 * the hackathon's preset shape (R9.2: prompt, tokens, TTFT, tokens/sec, model build).
 *
 * It is SDK-independent — the QVAC adapter records events here; this only structures
 * and serializes them (one JSON object per line). The clock is injectable for
 * deterministic tests.
 */
export class AuditLog {
  /** @param {{ now?: () => string }} [options] */
  constructor({ now = () => new Date().toISOString() } = {}) {
    /** @type {AuditEntry[]} */
    this.entries = [];
    this._now = now;
  }

  /**
   * @param {string} type
   * @param {Record<string, unknown>} [data]
   * @returns {this}
   */
  record(type, data = {}) {
    this.entries.push({ type, at: this._now(), ...(Object.keys(data).length ? { data } : {}) });
    return this;
  }

  /** @param {Record<string, unknown>} data @returns {this} */
  modelLoad(data) {
    return this.record('model_load', data);
  }

  /** @param {Record<string, unknown>} data @returns {this} */
  modelUnload(data) {
    return this.record('model_unload', data);
  }

  /** @param {Record<string, unknown>} data @returns {this} */
  completion(data) {
    return this.record('completion', data);
  }

  /** @returns {string} The log as JSONL (one entry per line; empty string when empty). */
  toJSONL() {
    return this.entries.length ? `${this.entries.map((e) => JSON.stringify(e)).join('\n')}\n` : '';
  }
}
