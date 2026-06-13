// @ts-check
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { statSync, readFileSync, writeFileSync, mkdirSync, createReadStream } from 'node:fs';
import { basename, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';

/**
 * Run-context provenance for an evidence bundle: what code, what model, and what
 * thresholds produced it. This is traceability/reproducibility, NOT tamper-evidence —
 * a user can still edit the JSON. (Cryptographic tamper-evidence is a separate,
 * signature-based concern.)
 */

/**
 * The repository's current commit, or null when git is unavailable / not a repo.
 * @param {string} cwd
 * @returns {string | null}
 */
export function gitHead(cwd) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const CACHE_FILE = `${homedir()}/.cache/quorumgate/model-hashes.json`;

/**
 * SHA-256 of a file, cached by absolute path + size + mtime so a repeated run of the
 * same model does not re-hash a multi-GB GGUF.
 * @param {string} path
 * @returns {Promise<string>}
 */
async function fileSha256Cached(path) {
  const st = statSync(path);
  const key = `${resolve(path)}|${st.size}|${Math.round(st.mtimeMs)}`;

  /** @type {Record<string, string>} */
  let cache = {};
  try {
    cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    /* no cache yet */
  }
  if (cache[key]) return cache[key];

  const hash = createHash('sha256');
  await new Promise((res, rej) => {
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', res);
    stream.on('error', rej);
  });
  const hex = hash.digest('hex');

  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    cache[key] = hex;
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    /* caching is best-effort */
  }
  return hex;
}

/**
 * Provenance for the model that produced a review: the basename (never the absolute
 * path — it can leak a username), the byte size, and the SHA-256 of the GGUF. Returns
 * a stub marker when no real model was used.
 * @param {string | undefined} modelSrc
 * @returns {Promise<Record<string, unknown>>}
 */
export async function modelProvenance(modelSrc) {
  if (!modelSrc) return { type: 'offline-stub' };
  const st = statSync(modelSrc);
  return { basename: basename(modelSrc), sizeBytes: st.size, sha256: await fileSha256Cached(modelSrc) };
}
