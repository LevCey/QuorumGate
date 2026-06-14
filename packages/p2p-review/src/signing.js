// @ts-check
import { generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey } from 'node:crypto';

/**
 * Ed25519 signing for tamper-evident, attributable records. This is the signing half
 * of the p2p-review key infrastructure (the encryption half is `seal.js`). Signatures
 * are computed over a canonical JSON encoding so verification does not depend on
 * property order. Node built-ins only.
 */

/**
 * Generate an Ed25519 signing keypair (base64 DER) for a device or a reviewer.
 * @returns {{ publicKey: string, privateKey: string }}
 */
export function generateSigningKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

/**
 * Canonical JSON: object keys sorted recursively, so the signed bytes are independent
 * of property order. `undefined` is encoded as null (JSON drops it anyway).
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * @typedef {object} Signature
 * @property {string} alg        Always "ed25519".
 * @property {string} publicKey  The signer's public key (base64 DER) — the record is self-verifying.
 * @property {string} signature  base64 signature over the canonical JSON of the payload.
 */

/**
 * Sign a JSON-serializable payload with an Ed25519 private key.
 * @param {unknown} payload
 * @param {{ privateKey: string, publicKey: string }} keypair
 * @returns {Signature}
 */
export function signPayload(payload, keypair) {
  const key = createPrivateKey({ key: Buffer.from(keypair.privateKey, 'base64'), type: 'pkcs8', format: 'der' });
  const signature = sign(null, Buffer.from(canonicalJson(payload), 'utf8'), key);
  return { alg: 'ed25519', publicKey: keypair.publicKey, signature: signature.toString('base64') };
}

/**
 * Verify a payload against a signature record (which carries the signer's public key).
 * Returns false on any malformed input rather than throwing.
 * @param {unknown} payload
 * @param {Signature} sig
 * @returns {boolean}
 */
export function verifyPayload(payload, sig) {
  try {
    if (!sig || sig.alg !== 'ed25519') return false;
    const key = createPublicKey({ key: Buffer.from(sig.publicKey, 'base64'), type: 'spki', format: 'der' });
    return verify(null, Buffer.from(canonicalJson(payload), 'utf8'), key, Buffer.from(sig.signature, 'base64'));
  } catch {
    return false;
  }
}
