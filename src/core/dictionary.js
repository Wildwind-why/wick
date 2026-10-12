/**
 * dictionary.js — the vocabulary half of the codec.
 *
 * The most expensive thing about a short message is that it is written in a
 * general-purpose alphabet: 8 bits per character, chosen for every possible
 * sentence. Emergency traffic is not general purpose. It reuses a small set
 * of words, again and again, under pressure.
 *
 * So we give those words one-byte codes. "need water" costs six bytes of
 * ASCII and two bytes of wick. Tokens occupy 0x01–0x7E; 0x7F opens a literal
 * run for everything the dictionary does not know; 0x00 terminates.
 *
 * Literal text is then 6-bit packed over a 42-symbol alphabet (a–z, space,
 * digits, five punctuation marks) with escape symbol 63 for anything else.
 * Four characters fit in three bytes; a capital letter costs eight bits.
 *
 * Pure module.
 */

/** Ordered so that codes 1..N are the most frequent emergencies first. */
export const WORDS = [
  "help", "safe", "water", "food", "medical", "injured", "trapped",
  "fire", "shelter", "power", "signal", "road", "bridge", "building",
  "school", "clinic", "hospital", "people", "person", "child",
  "elder", "group", "team", "need", "send", "receive", "location",
  "position", "here", "there", "north", "south", "east",
  "west", "sector", "zone", "area", "route", "grid", "map",
  "time", "now", "soon", "hour", "day", "night",
  "morning", "evening", "urgent", "critical", "stable", "ok", "yes",
  "no", "unknown", "waiting", "arrived", "moving", "stopped", "blocked",
  "open", "closed", "clear", "damaged", "collapse", "flood", "storm",
  "quake", "smoke", "gas", "leak", "battery", "charge", "radio",
  "phone", "message", "reply", "confirm", "update", "report", "status",
  "check", "all", "some", "few", "many", "one", "two",
  "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "and", "or", "at", "in", "on", "to",
  "from", "with", "without", "for", "is", "are", "was",
  "we", "i", "you", "they", "my", "our", "your",
  "the", "a", "please", "thanks", "keep", "stay", "go",
  "come", "wait", "back",
];

/** code (1-based) → word */
export const CODE_TO_WORD = new Map();
/** word → code */
export const WORD_TO_CODE = new Map();
WORDS.forEach((word, i) => {
  const code = i + 1;
  CODE_TO_WORD.set(code, word);
  WORD_TO_CODE.set(word, code);
});

export const TOKEN_EOF = 0x00;
export const TOKEN_LITERAL = 0x7f;

/** Longest match first so "trapped" beats "trap"-shaped prefixes. */
export const DICTIONARY_KEYS = [...WORD_TO_CODE.keys()].sort(
  (a, b) => b.length - a.length || a.localeCompare(b),
);

/* ------------------------------------------------------------------------ */
/* 6-bit text alphabet                                                       */
/* ------------------------------------------------------------------------ */

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const PUNCT = ".,?!-";
const ALPHABET = LOWER + " " + DIGITS + PUNCT;

export const TEXT_ALPHABET = new Map();
ALPHABET.split("").forEach((ch, i) => TEXT_ALPHABET.set(ch, i));

/** Any symbol we do not know is written as ESCAPE + one raw byte. */
export const ESCAPE = 63;
export const SYMBOL_BITS = 6;

export function encodeSymbol(ch) {
  if (ch.length !== 1 || ch.charCodeAt(0) > 255) throw new RangeError("encodeSymbol expects a UTF-8 byte");
  const direct = TEXT_ALPHABET.get(ch);
  if (direct !== undefined) return { symbol: direct, escaped: false };
  return { symbol: ESCAPE, escaped: true, raw: ch.charCodeAt(0) };
}

export function decodeSymbol(symbol, reader) {
  if (symbol === ESCAPE) return String.fromCharCode(reader.readByte());
  return ALPHABET[symbol];
}
