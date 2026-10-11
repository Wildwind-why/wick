/**
 * secure.js — the sealed frame: what it costs to make a wick message private.
 *
 * `codec.js` produces a 6-byte frame for "I am safe". That frame is compact,
 * checksummed, and completely readable by anyone holding the radio. For an
 * emergency tool that is not a footnote — it is the difference between "I am
 * safe" and "the person carrying this phone is safe, and here is where". So
 * there is a second, optional layer, and this file is honest about its price.
 *
 * Wire layout, measured in bytes rather than described in prose:
 *
 *   offset  size  field
 *   0       1     algorithm id (0x01 = ChaCha20-Poly1305, RFC 8439)
 *   1       8     nonce tail — big-endian message counter
 *   ...     n     ciphertext (n = the plaintext frame length)
 *   end     16    Poly1305 tag
 *
 * Overhead: 25 bytes. A 6-byte check-in becomes a 31-byte sealed frame —
 * still ~11× smaller than the 354-byte chat envelope in `baseline.js`, and
 * that comparison is the point: privacy here costs 25 bytes, not a rewrite.
 *
 * The full 12-byte nonce is `sessionTag(4) || nonceTail(8)`. The session tag is
 * agreed once, offline, together with the key; only the tail travels. Reusing a
 * counter with the same key breaks ChaCha20-Poly1305 completely, so the counter
 * is per-session and monotonic, and this module refuses to seal a counter it
 * has already used.
 *
 * The 9-byte header is passed to the AEAD as associated data: a relay can see
 * the algorithm and the counter, and cannot change either without invalidating
 * the tag.
 *
 * Pure logic — no DOM, no async. The key never leaves the device.
 */

import { seal, open } from "./cipher.js";

export const ALG = {
  CHACHA20_POLY1305: 0x01,
};

export const SESSION_KEY_BYTES = 32;
export const NONCE_TAIL_BYTES = 8;
export const TAG_BYTES = 16;
export const HEADER_BYTES = 1 + NONCE_TAIL_BYTES;
export const SEAL_OVERHEAD = HEADER_BYTES + TAG_BYTES; // 25

/** What the sealed frame is made of, for the receipt printed in section 02. */
export function wireBreakdown(plaintextBytes = 6) {
  return [
    { label: "c1.seal.plain", bytes: plaintextBytes, kind: "plain" },
    { label: "c1.seal.alg", bytes: 1, kind: "seal" },
    { label: "c1.seal.nonce", bytes: NONCE_TAIL_BYTES, kind: "seal" },
    { label: "c1.seal.tag", bytes: TAG_BYTES, kind: "seal" },
    { label: "c1.seal.total", bytes: plaintextBytes + SEAL_OVERHEAD, kind: "total" },
  ];
}

function require(condition, message) {
  if (!condition) throw new Error(message);
}

function tailFromCounter(counter) {
  const out = new Uint8Array(NONCE_TAIL_BYTES);
  let rest = BigInt(counter);
  for (let i = NONCE_TAIL_BYTES - 1; i >= 0; i -= 1) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

function counterFromTail(tail) {
  let value = 0n;
  for (let i = 0; i < NONCE_TAIL_BYTES; i += 1) value = (value << 8n) | BigInt(tail[i]);
  return value;
}

function nonceFor(sessionTag, tail) {
  require(sessionTag.length === 4, "session tag must be 4 bytes");
  const nonce = new Uint8Array(12);
  nonce.set(sessionTag, 0);
  nonce.set(tail, 4);
  return nonce;
}

/** Hex is how a key is actually exchanged by hand in the field. */
export function keyFromHex(hex) {
  const clean = String(hex).replace(/[^0-9a-f]/gi, "");
  require(clean.length === SESSION_KEY_BYTES * 2, `key must be ${SESSION_KEY_BYTES} bytes of hex`);
  const out = new Uint8Array(SESSION_KEY_BYTES);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Seal one frame. `state` carries the session key material and the counter,
 * and is mutated so the same counter can never be used twice.
 *
 * @param {Uint8Array} plaintext  the frame from `codec.encode()`
 * @param {Uint8Array} key        32-byte session key
 * @param {object} session        { sessionTag: Uint8Array(4), counter: bigint|number }
 */
export function sealFrame(plaintext, key, session) {
  require(key.length === SESSION_KEY_BYTES, "session key must be 32 bytes");
  require(session && session.sessionTag, "a sealed frame needs a session tag");

  const counter = BigInt(session.counter ?? 0n);
  require(counter < 1n << 64n, "counter exhausted for this session");

  const tail = tailFromCounter(counter);
  const header = new Uint8Array(HEADER_BYTES);
  header[0] = ALG.CHACHA20_POLY1305;
  header.set(tail, 1);

  const body = seal(key, nonceFor(session.sessionTag, tail), header, plaintext);

  session.counter = counter + 1n;
  const out = new Uint8Array(header.length + body.length);
  out.set(header, 0);
  out.set(body, header.length);
  return out;
}

/**
 * Verify and open. Throws on anything wrong — wrong algorithm, a counter the
 * session has not reached, a tag that does not match — because a frame that
 * cannot be authenticated must not be shown to a user as if it were a message.
 */
export function openFrame(sealed, key, session) {
  require(key.length === SESSION_KEY_BYTES, "session key must be 32 bytes");
  require(sealed.length >= HEADER_BYTES + TAG_BYTES, "sealed frame is too short");
  require(sealed[0] === ALG.CHACHA20_POLY1305, `unknown algorithm id ${sealed[0]}`);

  const header = sealed.subarray(0, HEADER_BYTES);
  const tail = sealed.subarray(1, HEADER_BYTES);
  const body = sealed.subarray(HEADER_BYTES);
  const counter = counterFromTail(tail);

  if (session && session.counter !== undefined) {
    // Replay protection: a counter at or below the last accepted one is either
    // a duplicate or a replayed frame, and both are exactly what an attacker
    // wants to send.
    require(counter >= BigInt(session.counter), "counter replayed — frame rejected");
  }

  const plaintext = open(key, nonceFor(session.sessionTag, tail), header, body);
  if (session && session.counter !== undefined) session.counter = counter + 1n;
  return { alg: sealed[0], counter, plaintext };
}
