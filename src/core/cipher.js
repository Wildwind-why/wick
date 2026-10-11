/**
 * cipher.js — ChaCha20-Poly1305 AEAD, implemented here, in plain JavaScript.
 *
 * Why hand-roll a cipher instead of pulling one in: this project's whole claim
 * is that it has no supply chain. A page that argues about the cost of every
 * byte and then loads 40 KB of somebody else's crypto is not making the same
 * argument it is printing.
 *
 * Why ChaCha20-Poly1305 specifically: it is the AEAD in TLS 1.3 that does not
 * need a hardware AES unit — which matters on the eight-year-old phones this
 * project is written for — and it is specified tightly enough that an
 * implementation can be checked against published vectors instead of trusted.
 * `tests/codec.test.html` checks this file against RFC 8439 §2.4.2, §2.5.2 and
 * §2.8.2. Those vectors are the reason the code below can be short: no
 * invention, only arithmetic that either matches the standard or does not.
 *
 * This file is pure logic: no `document`, no `window`, no async. It runs in a
 * worker and in a test page unchanged.
 *
 * Cost of using it, stated plainly because the page has to show it: a 12-byte
 * nonce and a 16-byte tag on every frame. Confidentiality is not free; it is
 * 28 bytes plus whatever it takes to carry the nonce. Section 02 prints the
 * receipt.
 */

/* ------------------------------------------------------------------ *
 * 32-bit helpers. JavaScript bitwise operators are 32-bit signed, so
 * everything is coerced back to unsigned on the way out.
 * ------------------------------------------------------------------ */

const rotl = (v, c) => ((v << c) | (v >>> (32 - c))) >>> 0;
const add = (a, b) => (a + b) >>> 0;

const CONSTANTS = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];

function wordsLE(bytes, offset, count) {
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const at = offset + i * 4;
    out[i] = (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
  }
  return out;
}

function u32LE(value) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

/* ------------------------------------------------------------------ *
 * ChaCha20
 * ------------------------------------------------------------------ */

/** One 20-round ChaCha20 block: 16 words in, 64 keystream bytes out. */
export function chacha20Block(key, counter, nonce) {
  const state = [
    ...CONSTANTS,
    ...wordsLE(key, 0, 8),
    counter >>> 0,
    ...wordsLE(nonce, 0, 3),
  ];
  const working = state.slice();

  const quarter = (a, b, c, d) => {
    working[a] = add(working[a], working[b]);
    working[d] = rotl(working[d] ^ working[a], 16);
    working[c] = add(working[c], working[d]);
    working[b] = rotl(working[b] ^ working[c], 12);
    working[a] = add(working[a], working[b]);
    working[d] = rotl(working[d] ^ working[a], 8);
    working[c] = add(working[c], working[d]);
    working[b] = rotl(working[b] ^ working[c], 7);
  };

  for (let i = 0; i < 10; i += 1) {
    quarter(0, 4, 8, 12);
    quarter(1, 5, 9, 13);
    quarter(2, 6, 10, 14);
    quarter(3, 7, 11, 15);
    quarter(0, 5, 10, 15);
    quarter(1, 6, 11, 12);
    quarter(2, 7, 8, 13);
    quarter(3, 4, 9, 14);
  }

  const out = new Uint8Array(64);
  for (let i = 0; i < 16; i += 1) out.set(u32LE(add(working[i], state[i])), i * 4);
  return out;
}

/** The keystream as a byte stream, for a given starting block counter. */
export function chacha20(key, nonce, counter, input) {
  const out = new Uint8Array(input.length);
  let block = counter >>> 0;
  for (let offset = 0; offset < input.length; offset += 64) {
    const stream = chacha20Block(key, block, nonce);
    const take = Math.min(64, input.length - offset);
    for (let i = 0; i < take; i += 1) out[offset + i] = input[offset + i] ^ stream[i];
    block += 1;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Poly1305
 *
 * The 130-bit accumulator is done with BigInt: slower than a limb-based
 * implementation, and obviously correct, which is the trade this project makes
 * everywhere it can afford to. Poly1305 runs once per frame here, not in a
 * loop, so the cost does not show up in the frame-time readout.
 * ------------------------------------------------------------------ */

const P1305 = (1n << 130n) - 5n;
const MASK128 = (1n << 128n) - 1n;

function bigFromLE(bytes) {
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) value = (value << 8n) | BigInt(bytes[i]);
  return value;
}

function leFromBig(value, length) {
  const out = new Uint8Array(length);
  let rest = value;
  for (let i = 0; i < length; i += 1) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

/** Poly1305 one-time authenticator. `key` is 32 bytes; returns the 16-byte tag. */
export function poly1305(message, key) {
  const r = bigFromLE(key.subarray(0, 16)) & 0x0ffffffc0ffffffc0ffffffc0fffffffn;
  const s = bigFromLE(key.subarray(16, 32));

  let accumulator = 0n;
  for (let offset = 0; offset < message.length; offset += 16) {
    const chunk = message.subarray(offset, Math.min(offset + 16, message.length));
    // Each block is treated as a 129-bit number: the bytes, then a 1 bit above.
    const value = bigFromLE(chunk) + (1n << BigInt(8 * chunk.length));
    accumulator = ((accumulator + value) * r) % P1305;
  }
  return leFromBig((accumulator + s) & MASK128, 16);
}

/* ------------------------------------------------------------------ *
 * The AEAD construction (RFC 8439 §2.8): encrypt-then-MAC, with the
 * lengths authenticated so a truncated frame cannot verify.
 * ------------------------------------------------------------------ */

function pad16(target, length) {
  const remainder = length % 16;
  if (remainder !== 0) target.push(new Uint8Array(16 - remainder));
}

function macData(aad, ciphertext) {
  const parts = [];
  parts.push(aad);
  pad16(parts, aad.length);
  parts.push(ciphertext);
  pad16(parts, ciphertext.length);
  parts.push(new Uint8Array([...u32LE(aad.length), 0, 0, 0, 0]));
  parts.push(new Uint8Array([...u32LE(ciphertext.length), 0, 0, 0, 0]));

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function require(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Encrypt and authenticate. Returns `ciphertext || tag` (16 bytes longer).
 * `aad` is authenticated but not encrypted — used for the unencrypted frame
 * header, so a relay cannot relabel a message without breaking the tag.
 */
export function seal(key, nonce, aad, plaintext) {
  require(key.length === 32, "key must be 32 bytes");
  require(nonce.length === 12, "nonce must be 12 bytes");
  const polyKey = chacha20Block(key, 0, nonce).subarray(0, 32);
  const ciphertext = chacha20(key, nonce, 1, plaintext);
  const tag = poly1305(macData(aad, ciphertext), polyKey);
  const out = new Uint8Array(ciphertext.length + 16);
  out.set(ciphertext, 0);
  out.set(tag, ciphertext.length);
  return out;
}

/** Verify then decrypt. Throws on a bad tag — callers must not fall through. */
export function open(key, nonce, aad, sealed) {
  require(key.length === 32, "key must be 32 bytes");
  require(nonce.length === 12, "nonce must be 12 bytes");
  require(sealed.length >= 16, "sealed frame is shorter than its own tag");
  const ciphertext = sealed.subarray(0, sealed.length - 16);
  const tag = sealed.subarray(sealed.length - 16);
  const polyKey = chacha20Block(key, 0, nonce).subarray(0, 32);
  const expected = poly1305(macData(aad, ciphertext), polyKey);

  // Constant-time comparison: a byte-by-byte `===` leaks where the first
  // difference is, which is exactly the signal a forger wants.
  let diff = 0;
  for (let i = 0; i < 16; i += 1) diff |= tag[i] ^ expected[i];
  require(diff === 0, "authentication failed — frame rejected");

  return chacha20(key, nonce, 1, ciphertext);
}

/** Bytes a sealed frame adds before the nonce is carried. */
export const AEAD_OVERHEAD = { tag: 16, nonce: 12 };
