// @ts-check
import {
  generateKeyPairSync,
  diffieHellman,
  hkdfSync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  createPrivateKey,
} from 'node:crypto';

/**
 * Application-layer encryption for the four-eyes case bundle (R7.3, I-4). The bundle
 * carries sensitive data (IBANs), so its confidentiality must not depend on the
 * transport alone: it is sealed to the second reviewer's public key here, so only
 * that reviewer's device can open it — even if the delegated-inference path is not
 * end-to-end encrypted.
 *
 * Scheme: an ephemeral X25519 key + ECDH to the recipient's static key, HKDF-SHA-256
 * to a 256-bit key, then AES-256-GCM (authenticated). Node built-ins only.
 */

const HKDF_INFO = Buffer.from('quorumgate-case-bundle-v1');

/**
 * Generate an X25519 keypair for a reviewer device, exported as base64 DER strings.
 * The public key is shared; the private key stays on the reviewer's device.
 * @returns {{ publicKey: string, privateKey: string }}
 */
export function generateReviewerKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

/**
 * The self-contained sealed envelope. `ephemeralPublicKey` lets the recipient derive
 * the same shared secret; the GCM `tag` authenticates the ciphertext.
 * @typedef {object} SealedBundle
 * @property {string} alg
 * @property {string} ephemeralPublicKey
 * @property {string} salt
 * @property {string} iv
 * @property {string} ciphertext
 * @property {string} tag
 */

/**
 * Seal a case bundle to a reviewer's public key (anonymous sender).
 * @param {unknown} bundle
 * @param {string} recipientPublicKeyB64
 * @returns {SealedBundle}
 */
export function sealCaseBundle(bundle, recipientPublicKeyB64) {
  const recipientPublic = createPublicKey({
    key: Buffer.from(recipientPublicKeyB64, 'base64'),
    type: 'spki',
    format: 'der',
  });
  const { publicKey: ephPub, privateKey: ephPriv } = generateKeyPairSync('x25519');
  const shared = diffieHellman({ privateKey: ephPriv, publicKey: recipientPublic });

  const salt = randomBytes(16);
  const key = Buffer.from(hkdfSync('sha256', shared, salt, HKDF_INFO, 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(bundle), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    alg: 'x25519-hkdf-sha256-aes256gcm',
    ephemeralPublicKey: ephPub.export({ type: 'spki', format: 'der' }).toString('base64'),
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

/**
 * Open a sealed case bundle with the reviewer's private key. Throws if the key is
 * wrong or the envelope was tampered with (GCM authentication failure).
 * @param {SealedBundle} sealed
 * @param {string} recipientPrivateKeyB64
 * @returns {unknown}
 */
export function openCaseBundle(sealed, recipientPrivateKeyB64) {
  const recipientPrivate = createPrivateKey({
    key: Buffer.from(recipientPrivateKeyB64, 'base64'),
    type: 'pkcs8',
    format: 'der',
  });
  const ephPublic = createPublicKey({
    key: Buffer.from(sealed.ephemeralPublicKey, 'base64'),
    type: 'spki',
    format: 'der',
  });
  const shared = diffieHellman({ privateKey: recipientPrivate, publicKey: ephPublic });
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.from(sealed.salt, 'base64'), HKDF_INFO, 32));

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}
