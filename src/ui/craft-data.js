/**
 * craft-data.js — the facts behind section 07.
 *
 * Payload sizes live in budget-data.js, which is generated from the shipped
 * files so the numbers cannot drift away from the artefacts they describe.
 * Only `note` fields are translatable; everything else is a technical name and
 * stays in one language on purpose.
 */

export const ARCH = [
  {
    title: "c7.arch.core",
    items: [
      { name: "bits.js", note: "bit packing · varint · CRC-8" },
      { name: "dictionary.js", note: "126 tokens · 6-bit alphabet" },
      { name: "codec.js", note: "encode · decode · measure" },
      { name: "cipher.js", note: "ChaCha20-Poly1305 · RFC 8439" },
      { name: "secure.js", note: "sealed frame · replay guard" },
      { name: "energy.js", note: "radio + battery model" },
      { name: "baseline.js", note: "the honest yardstick" },
      { name: "budget.js", note: "message planning" },
      { name: "sim.js", note: "seeded field model" },
    ],
  },
  {
    title: "c7.arch.app",
    items: [
      { name: "main.js", note: "boot · one failing module never takes the page" },
      { name: "state.js", note: "one shared model" },
      { name: "bench.js", note: "codec bench" },
      { name: "seal.js", note: "what privacy costs, in bytes" },
      { name: "lab.js", note: "budget controls" },
      { name: "offline.js", note: "outbox + link" },
      { name: "field.js", note: "scenario chart + data table" },
      { name: "sharecard.js", note: "canvas export, no upload" },
      { name: "tour.js", note: "the guided demo" },
      { name: "craft.js", note: "this page" },
    ],
  },
  {
    title: "c7.arch.workers",
    items: [
      { name: "codec.worker.js", note: "bulk encode" },
      { name: "sim.worker.js", note: "scenario runs" },
    ],
  },
  {
    title: "c7.arch.edge",
    items: [
      { name: "sw.js", note: "precache · offline shell" },
      { name: "manifest.webmanifest", note: "installable" },
      { name: "assets/css/…", note: "design tokens → sections" },
      { name: "assets/fonts/…", note: "self-hosted, OFL" },
    ],
  },
];

export const FILES = [
  { path: "src/main.js", note: "boot sequence · failures recorded, never thrown" },
  { path: "src/core/bits.js", note: "bit writer/reader · varint · zigzag · CRC-8" },
  { path: "src/core/dictionary.js", note: "126 one-byte tokens · 6-bit alphabet" },
  { path: "src/core/codec.js", note: "encode · decode · measure · round-trip check" },
  { path: "src/core/cipher.js", note: "ChaCha20-Poly1305, checked against RFC 8439 vectors" },
  { path: "src/core/secure.js", note: "sealed frame · 25 B overhead · replay guard" },
  { path: "src/core/baseline.js", note: "the mainstream-messenger yardstick" },
  { path: "src/core/energy.js", note: "radio and battery model, coefficients declared" },
  { path: "src/core/budget.js", note: "what the charge still buys · 1% trimming" },
  { path: "src/core/store.js", note: "IndexedDB with an in-memory fallback" },
  { path: "src/core/sync.js", note: "outbox · store-and-forward · batched drain" },
  { path: "src/core/sim.js", note: "seeded minute-by-minute field model" },
  { path: "src/ui/seal.js", note: "section 02b · the receipt for confidentiality" },
  { path: "src/ui/sharecard.js", note: "section 05 · PNG export drawn locally" },
  { path: "src/ui/tour.js", note: "the seven-step guided demo (?demo=1)" },
  { path: "src/workers/sim.worker.js", note: "scenario runs off the main thread" },
  { path: "src/workers/codec.worker.js", note: "bulk encode off the main thread" },
  { path: "sw.js", note: "precache the shell · real offline reload" },
  { path: "tests/codec.test.html", note: "58 assertions, run in the browser" },
  { path: "tests/page.test.html", note: "25 assertions against the real page" },
  { path: "tests/offline.test.html", note: "7 assertions on the offline shell, in a real browser" },
  { path: "tools/pack.py", note: "packages, then verifies its own references" },
];

/**
 * Required by the brief: name one or two existing products that are closest,
 * and say plainly how this one advances past them.
 */
export const COMPARE = [
  {
    tag: "closest · 1",
    title: "c7.cmp1.title",
    body: "c7.cmp1.body",
  },
  {
    tag: "closest · 2",
    title: "c7.cmp2.title",
    body: "c7.cmp2.body",
  },
  {
    tag: "what wick adds",
    title: "c7.cmp3.title",
    body: "c7.cmp3.body",
  },
  {
    tag: "what wick refuses",
    title: "c7.cmp4.title",
    body: "c7.cmp4.body",
  },
];

export const A11Y = [
  "c7.a11y.1",
  "c7.a11y.2",
  "c7.a11y.3",
  "c7.a11y.4",
  "c7.a11y.5",
  "c7.a11y.6",
];

export const PERF = [
  "c7.perf.1",
  "c7.perf.2",
  "c7.perf.3",
  "c7.perf.4",
  "c7.perf.5",
];
