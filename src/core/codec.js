/**
 * codec.js — wick's wire format.
 *
 * Wire layout (v2; decoding retains v1 compatibility)
 *   1 byte   header    version:2 | type:3 | hasPosition:1 | hasTime:1 | rsvd:1
 *   n bytes  body      depends on type
 *   1 byte   crc8      CRC-8/SMBUS over every preceding byte
 *
 * Bodies
 *   CHECK_IN  statusToken:7                       [+ position] [+ time]
 *   NEED      needToken:7, urgency:2              [+ position] [+ time]
 *   SITREP    7-bit token stream; literal runs carry UTF-8 bytes, then EOF
 *   ACK       ackedSequence:varint
 *   BEACON    position, time
 *
 * Position is measured in 1/10000 degree (~11 m) and sent as a signed delta
 * from a shared session origin, zigzag-varint encoded — so a check-in inside
 * the same 600 m block costs one byte per axis, not eight.
 *
 * Time is seconds since a session epoch, sent as a delta from the previous
 * message on the same thread when one exists.
 *
 * Pure module: no DOM, no globals, deterministic. Round-trip tested.
 */

import {
  BitWriter,
  BitReader,
  crc8,
  quantise,
  dequantise,
  readVarint,
  writeVarint,
  writeZigzagVarint,
  readZigzagVarint,
  toHex,
  GEO_SCALE,
} from "./bits.js";
import {
  WORD_TO_CODE,
  CODE_TO_WORD,
  DICTIONARY_KEYS,
  TOKEN_EOF,
  TOKEN_LITERAL,
  SYMBOL_BITS,
  ESCAPE,
  encodeSymbol,
  decodeSymbol,
  TEXT_ALPHABET,
} from "./dictionary.js";

export const VERSION = 2;
export const MAX_TEXT_BYTES = 2048;
const utf8 = new TextEncoder();
const utf8Reader = new TextDecoder("utf-8", { fatal: true });

export const TYPES = {
  checkin: 0,
  need: 1,
  sitrep: 2,
  ack: 3,
  beacon: 4,
};

export const TYPE_NAMES = Object.fromEntries(
  Object.entries(TYPES).map(([name, code]) => [code, name]),
);

export const URGENCY = ["routine", "elevated", "urgent", "critical"];

/** Groups drive the colour coding in the hex bench. */
export const FIELD_GROUP = {
  header: "header",
  token: "token",
  position: "position",
  time: "time",
  text: "text",
  integrity: "integrity",
};

export class CodecError extends Error {}

/* ------------------------------------------------------------------------ */
/* field-tracking writer                                                     */
/* ------------------------------------------------------------------------ */

class FieldWriter {
  constructor() {
    this.w = new BitWriter();
    this.fields = [];
  }

  field(key, label, group, fn) {
    const fromBit = this.w.bytes.length * 8 + this.w.bitLen;
    fn(this.w);
    const toBit = this.w.bytes.length * 8 + this.w.bitLen;
    this.fields.push({ key, label, group, from: Math.floor(fromBit / 8), to: Math.ceil(toBit / 8), fromBit, toBit });
    return this;
  }

  finish() {
    if (this.w.bitLen) this.field("padding", "padding", FIELD_GROUP.header, w => w.align());
    const body = Uint8Array.from(this.w.bytes);
    const checksum = crc8(body);
    const out = new Uint8Array(body.length + 1);
    out.set(body, 0);
    out[body.length] = checksum;
    this.fields.push({
      key: "crc",
      label: "crc8",
      group: FIELD_GROUP.integrity,
      from: body.length,
      to: body.length + 1,
      fromBit: body.length * 8,
      toBit: (body.length + 1) * 8,
    });
    return { bytes: out, fields: this.fields };
  }
}

/* ------------------------------------------------------------------------ */
/* text tokenisation                                                         */
/* ------------------------------------------------------------------------ */

const ALNUM = /[a-z0-9]/;

/**
 * Split free text into dictionary tokens and literal runs.
 * Boundaries are enforced on both sides so "sand" never becomes "s"+"and".
 * Exact lowercase words can use tokens; all other text remains unchanged.
 */
export function tokenise(text) {
  // Only exact lowercase words use tokens; names, whitespace and Unicode stay exact.
  const lower = text;
  const items = [];
  let literal = "";
  let i = 0;

  const flush = () => {
    if (literal) {
      items.push({ kind: "literal", text: literal });
      literal = "";
    }
  };

  while (i < lower.length) {
    let matched = null;
    for (const key of DICTIONARY_KEYS) {
      if (!lower.startsWith(key, i)) continue;
      const before = i === 0 ? " " : lower[i - 1];
      const after = lower[i + key.length] ?? " ";
      if (!ALNUM.test(before) && !ALNUM.test(after)) {
        matched = key;
        break;
      }
    }
    if (matched) {
      flush();
      items.push({ kind: "token", word: matched });
      i += matched.length;
    } else {
      literal += text[i];
      i += 1;
    }
  }
  flush();
  return items;
}

/** Comparable form used by the round-trip check. */
export function normalise(text) {
  return String(text);
}

/* ------------------------------------------------------------------------ */
/* encode                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * @param {object} message
 * @param {object} [context]
 * @param {{lat:number,lon:number}} [context.origin] shared session origin
 * @param {number} [context.prevTime] previous message time (s since epoch)
 * @returns {{bytes:Uint8Array, fields:Array}}
 */
export function encode(message, context = {}) {
  const type = TYPES[message.type];
  if (type === undefined) throw new CodecError(`unknown type: ${message.type}`);
  if (message.type === "sitrep" && utf8.encode(message.text || "").length > MAX_TEXT_BYTES) throw new CodecError(`text exceeds ${MAX_TEXT_BYTES} UTF-8 bytes`);
  for (const position of [message.position, context.origin]) {
    if (position && (!Number.isFinite(position.lat) || !Number.isFinite(position.lon) || Math.abs(position.lat) > 90 || Math.abs(position.lon) > 180)) throw new CodecError("invalid coordinates");
  }

  const hasPosition = !!message.position;
  const hasTime = Number.isFinite(message.time);
  const fw = new FieldWriter();

  fw.field("header", `header · v${VERSION} ${message.type}`, FIELD_GROUP.header, (w) => {
    w.writeBits(VERSION, 2);
    w.writeBits(type, 3);
    w.writeBits(hasPosition ? 1 : 0, 1);
    w.writeBits(hasTime ? 1 : 0, 1);
    w.writeBits(0, 1);
  });

  switch (message.type) {
    case "checkin": {
      const code = WORD_TO_CODE.get(String(message.status || "ok").toLowerCase());
      if (!code) throw new CodecError(`status not in dictionary: ${message.status}`);
      fw.field("status", `status · ${message.status}`, FIELD_GROUP.token, (w) => {
        w.writeBits(code, 7);
      });
      break;
    }
    case "need": {
      const code = WORD_TO_CODE.get(String(message.need || "help").toLowerCase());
      if (!code) throw new CodecError(`need not in dictionary: ${message.need}`);
      const urgency = Math.max(0, Math.min(3, message.urgency ?? 1));
      fw.field(
        "need",
        `need · ${message.need} · ${URGENCY[urgency]}`,
        FIELD_GROUP.token,
        (w) => {
          w.writeBits(code, 7);
          w.writeBits(urgency, 2);
        },
      );
      break;
    }
    case "sitrep": {
      const items = tokenise(message.text || "");
      items.forEach((item, index) => {
        if (item.kind === "token") {
          const code = WORD_TO_CODE.get(item.word);
          fw.field(`text${index}`, item.word, FIELD_GROUP.token, (w) =>
            w.writeBits(code, 7),
          );
        } else {
          fw.field(`text${index}`, `"${item.text}"`, FIELD_GROUP.text, (w) => {
            w.writeBits(TOKEN_LITERAL, 7);
            const symbols = [];
            for (const byte of utf8.encode(item.text)) {
              const ch = String.fromCharCode(byte);
              const { symbol, escaped, raw } = encodeSymbol(ch);
              symbols.push({ symbol, escaped, raw });
            }
            writeVarint(w, symbols.length);
            for (const s of symbols) {
              w.writeBits(s.symbol, SYMBOL_BITS);
              if (s.escaped) w.writeBits(s.raw, 8);
            }
          });
        }
      });
      // Explicit terminator: a SITREP may be followed by position/time, and the
      // receiver must be able to tell where the sentence stopped.
      fw.field("eof", "end", FIELD_GROUP.header, (w) => w.writeBits(TOKEN_EOF, 7));
      break;
    }
    case "ack": {
      fw.field("ack", `ack · #${message.sequence ?? 0}`, FIELD_GROUP.token, (w) => {
        writeVarint(w, message.sequence ?? 0);
      });
      break;
    }
    case "beacon": {
      if (!hasPosition) throw new CodecError("beacon requires a position");
      break;
    }
  }

  if (hasPosition) {
    const origin = context.origin || { lat: 0, lon: 0 };
    // No shared origin yet? Promote this fix to the origin and send it absolute.
    const dLat = quantise(message.position.lat) - quantise(origin.lat);
    const dLon = quantise(message.position.lon) - quantise(origin.lon);
    fw.field("position", `position · Δ${dLat},${dLon}`, FIELD_GROUP.position, (w) => {
      writeZigzagVarint(w, dLat);
      writeZigzagVarint(w, dLon);
    });
  }

  if (hasTime) {
    const prev = context.prevTime;
    const value = Number.isFinite(prev) ? message.time - prev : message.time;
    fw.field("time", "time · Δs", FIELD_GROUP.time, (w) => {
      writeZigzagVarint(w, value);
    });
  }

  return fw.finish();
}

/* ------------------------------------------------------------------------ */
/* decode                                                                    */
/* ------------------------------------------------------------------------ */

export function decode(bytes, context = {}) {
  try {
    return decodeInner(bytes, context);
  } catch (err) {
    if (err instanceof CodecError) throw err;
    throw new CodecError(err.message);
  }
}

function decodeInner(bytes, context = {}) {
  if (!bytes || bytes.length < 2) throw new CodecError("frame too short");

  const bodyLen = bytes.length - 1;
  const expected = bytes[bodyLen];
  const actual = crc8(bytes, 0, bodyLen);
  if (expected !== actual) {
    throw new CodecError(
      `crc mismatch (expected ${expected.toString(16)}, got ${actual.toString(16)})`,
    );
  }

  const r = new BitReader(bytes.subarray(0, bodyLen));
  const version = r.readBits(2);
  if (version !== VERSION && version !== 1) throw new CodecError(`unsupported version ${version}`);
  const type = r.readBits(3);
  const hasPosition = r.readBits(1) === 1;
  const hasTime = r.readBits(1) === 1;
  r.readBits(1);

  const name = TYPE_NAMES[type];
  if (!name) throw new CodecError(`unknown type code ${type}`);
  const message = { type: name };

  switch (name) {
    case "checkin": {
      const code = r.readBits(7);
      if (!CODE_TO_WORD.has(code)) throw new CodecError("unknown status token");
      message.status = CODE_TO_WORD.get(code);
      break;
    }
    case "need": {
      const code = r.readBits(7);
      if (!CODE_TO_WORD.has(code)) throw new CodecError("unknown need token");
      message.need = CODE_TO_WORD.get(code);
      message.urgency = r.readBits(2);
      break;
    }
    case "sitrep": {
      let text = "";
      for (;;) {
        const code = r.readBits(7);
        if (code === TOKEN_EOF) break;
        if (code === TOKEN_LITERAL) {
          const count = readVarint(r);
          if (count > MAX_TEXT_BYTES) throw new CodecError("literal too long");
          const literal = [];
          for (let i = 0; i < count; i++) {
            const symbol = r.readBits(SYMBOL_BITS);
            const ch = decodeSymbol(symbol, r);
            if (ch === undefined) throw new CodecError("unknown literal symbol");
            literal.push(ch.charCodeAt(0));
          }
          text += version === 1 ? String.fromCharCode(...literal) : utf8Reader.decode(Uint8Array.from(literal));
        } else {
          text += CODE_TO_WORD.get(code) ?? "?";
        }
      }
      message.text = text;
      break;
    }
    case "ack": {
      message.sequence = readVarint(r);
      break;
    }
    case "beacon":
      break;
  }

  if (hasPosition) {
    const dLat = readZigzagVarint(r);
    const dLon = readZigzagVarint(r);
    const origin = context.origin || { lat: 0, lon: 0 };
    message.position = {
      lat: dequantise(quantise(origin.lat) + dLat) ,
      lon: dequantise(quantise(origin.lon) + dLon),
    };
  }

  if (hasTime) {
    const delta = readZigzagVarint(r);
    message.time = Number.isFinite(context.prevTime) ? context.prevTime + delta : delta;
  }

  return message;
}

/* ------------------------------------------------------------------------ */
/* measurement — what the bench and the HUD actually show                    */
/* ------------------------------------------------------------------------ */

export function measure(message, context = {}) {
  const started = performance.now();
  const { bytes, fields } = encode(message, context);
  const encodeMs = performance.now() - started;

  let decoded = null;
  let ok = false;
  let error = null;
  try {
    decoded = decode(bytes, context);
    ok = roundTrips(message, decoded);
  } catch (err) {
    error = err.message;
  }

  return {
    bytes,
    hex: toHex(bytes),
    fields,
    size: bytes.length,
    decoded,
    ok,
    error,
    encodeMs,
    // bits of the frame that are payload rather than overhead
    efficiency: payloadRatio(fields),
  };
}

function payloadRatio(fields) {
  let payload = 0;
  let total = 0;
  for (const f of fields) {
    const len = (f.toBit - f.fromBit) / 8;
    total += len;
    if (f.group !== FIELD_GROUP.header && f.group !== FIELD_GROUP.integrity) {
      payload += len;
    }
  }
  return total === 0 ? 0 : payload / total;
}

export function roundTrips(original, decoded) {
  if (original.type !== decoded.type) return false;
  if (Boolean(original.position) !== Boolean(decoded.position)) return false;
  if (original.position && (Math.abs(original.position.lat - decoded.position.lat) > 0.000051 || Math.abs(original.position.lon - decoded.position.lon) > 0.000051)) return false;
  if (Number.isFinite(original.time) && original.time !== decoded.time) return false;
  if (original.type === "sitrep") {
    return normalise(original.text || "") === normalise(decoded.text || "");
  }
  if (original.type === "checkin") return original.status === decoded.status;
  if (original.type === "need") {
    return original.need === decoded.need && (original.urgency ?? 1) === decoded.urgency;
  }
  if (original.type === "ack") return (original.sequence ?? 0) === decoded.sequence;
  return true;
}

/** Rough character budget the dictionary can absorb without literals. */
export function dictionaryCoverage(text) {
  const items = tokenise(text);
  let tokenChars = 0;
  let literalChars = 0;
  for (const item of items) {
    if (item.kind === "token") tokenChars += item.word.length;
    else literalChars += item.text.length;
  }
  const total = tokenChars + literalChars;
  return {
    items,
    tokenChars,
    literalChars,
    ratio: total === 0 ? 1 : tokenChars / total,
  };
}

export { GEO_SCALE, TEXT_ALPHABET, ESCAPE };
