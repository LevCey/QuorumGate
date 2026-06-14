// @ts-check
import { signPayload, verifyPayload } from '@quorumgate/p2p-review';

/**
 * Sign an evidence bundle for tamper-evidence: the signature covers the whole bundle
 * (excluding the signature field itself) with a device signing key, so editing any
 * field afterward invalidates it.
 *
 * This gives tamper-evidence today. Per-part attribution — the peer signing its own
 * second opinion, and an authenticated reviewer signing the human decision — is a
 * further step that needs persistent device/reviewer identities (see the README
 * limitations); the structure here extends to that.
 *
 * @param {Record<string, unknown>} bundle
 * @param {{ privateKey: string, publicKey: string }} deviceKeypair
 * @returns {Record<string, unknown>}  The bundle with a `signature` field attached.
 */
export function signEvidenceBundle(bundle, deviceKeypair) {
  const unsigned = { ...bundle };
  delete unsigned.signature;
  return { ...unsigned, signature: signPayload(unsigned, deviceKeypair) };
}

/**
 * Verify a signed evidence bundle against its embedded signature and public key.
 * Returns true only if the signature matches the bundle's current contents.
 * @param {Record<string, unknown>} bundle
 * @returns {boolean}
 */
export function verifyEvidenceBundle(bundle) {
  if (!bundle || !bundle.signature) return false;
  const unsigned = { ...bundle };
  delete unsigned.signature;
  return verifyPayload(unsigned, /** @type {any} */ (bundle.signature));
}
