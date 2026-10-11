/**
 * bits.js — the lowest layer of wick's wire format.
 *
 * Everything above this file assumes a hostile link: bytes are expensive and
 * occasionally wrong. So we pack at the bit level, never waste a byte on a
 * fixed-width field we could shrink, and always pay one byte for an integrity
 * check the receiver can verify without a retransmission.
 *
 * Pure module — no DOM, no globals. Safe to run in a Worker or a test page.
 */

/** MSB-first bit writer that only materialises bytes when it has eight. */
export class BitWriter {
  constructor() {
    this.bytes = [];
    this.bitBuf = 0;
    this.bitLen = 0;
  }

  /** Write the low `n` bits of `value`, most-significant bit first. */
  writeBits(value, n) {
    for (let i = n - 1; i >= 0; i--) {
      this.bitBuf = (this.bitBuf << 1) | ((value >> i) & 1);
      this.bitLen++;
      if (this.bitLen === 8) {
        this.bytes.push(this.bitBuf & 0xff);
        this.bitBuf = 0;
        this.bitLen = 0;
      }
    }
    return this;
  }

  writeByte(b) {
    if (this.bitLen === 0) {
      this.bytes.push(b & 0xff);
    } else {
      this.writeBits(b & 0xff, 8);
    }
    return this;
  }

  writeBytes(arr) {
    for (let i = 0; i < arr.length; i++) this.writeByte(arr[i]);
    return this;
  }

  /** Pad the final partial byte with zero bits. */
  align() {
    if (this.bitLen > 0) {
      this.writeBits(0, 8 - this.bitLen);
    }
    return this;
  }

  /** Bytes written so far, rounded up to whole bytes. */
  get length() {
    return this.bytes.length + (this.bitLen > 0 ? 1 : 0);
  }

  finish() {
    this.align();
    return Uint8Array.from(this.bytes);
  }
}

/** Mirror of BitWriter. Throws RangeError if a read runs past the buffer. */
export class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.pos = 0;
    this.bitBuf = 0;
    this.bitLen = 0;
  }

  readBits(n) {
    let out = 0;
    for (let i = 0; i < n; i++) {
      if (this.bitLen === 0) {
        if (this.pos >= this.bytes.length) throw new RangeError("read past end of buffer");
        this.bitBuf = this.bytes[this.pos++];
        this.bitLen = 8;
      }
      const bit = (this.bitBuf >> (this.bitLen - 1)) & 1;
      this.bitLen--;
      out = (out << 1) | bit;
    }
    return out;
  }

  readByte() {
    if (this.bitLen === 0) {
      if (this.pos >= this.bytes.length) throw new RangeError("read past end of buffer");
      return this.bytes[this.pos++];
    }
    return this.readBits(8);
  }

  align() {
    this.bitLen = 0;
    return this;
  }

  get remaining() {
    return this.bytes.length - this.pos;
  }
}

/* ------------------------------------------------------------------------ */
/* varints — small numbers cost few bytes, large ones stay honest            */
/* ------------------------------------------------------------------------ */

/** Signed integers to unsigned: -1→1, 1→2, -2→3 … keeps tiny negatives tiny. */
export function zigzag(n) {
  return (n << 1) ^ (n >> 31);
}

export function unzigzag(z) {
  return (z >>> 1) ^ -(z & 1);
}

/** LEB128. 0–127 → 1 byte, 128–16383 → 2 bytes, and so on. */
export function writeVarint(writer, value) {
  let v = value >>> 0;
  while (v >= 0x80) {
    writer.writeByte((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  writer.writeByte(v);
  return writer;
}

export function readVarint(reader) {
  let shift = 0;
  let result = 0;
  for (;;) {
    const b = reader.readByte();
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) throw new RangeError("varint too long");
  }
  return result >>> 0;
}

export function writeZigzagVarint(writer, value) {
  return writeVarint(writer, zigzag(value));
}

export function readZigzagVarint(reader) {
  return unzigzag(readVarint(reader));
}

/* ------------------------------------------------------------------------ */
/* CRC-8/SMBUS — one byte that buys the receiver the right to say "bad frame" */
/* without asking the network for anything back.                            */
/* ------------------------------------------------------------------------ */

const CRC8_TABLE = (() => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) {
      c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
    }
    table[i] = c;
  }
  return table;
})();

export function crc8(bytes, start = 0, end = bytes.length) {
  let crc = 0x00;
  for (let i = start; i < end; i++) {
    crc = CRC8_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return crc;
}

/* ------------------------------------------------------------------------ */
/* fixed-point geography                                                     */
/* ------------------------------------------------------------------------ */

/** ~11.1 m at the equator — the precision a search grid actually needs. */
export const GEO_SCALE = 1e4;

export function quantise(value, scale = GEO_SCALE) {
  return Math.round(value * scale);
}

export function dequantise(units, scale = GEO_SCALE) {
  return units / scale;
}

export function toHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0").toUpperCase();
  }
  return out;
}
