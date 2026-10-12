/**
 * energy.js — what a byte costs, on each kind of radio.
 *
 * The model separates two costs that behave very differently:
 *
 *   radio wake / RRC setup / tail   a fixed cost per transmission, paid
 *                                   whether you send 9 bytes or 900
 *   per-byte energy                 linear in payload size
 *
 * This split is the whole argument. On cellular the fixed cost dominates, so
 * the win comes from *transmitting less often* (store-and-forward batching).
 * On LoRa and BLE the fixed cost is almost nothing and the per-byte cost is
 * everything, so the win comes from *encoding less*. wick attacks both.
 *
 * All coefficients are illustrative estimates anchored on public measurements
 * of mobile radio energy and typical duty cycles. They are declared as
 * estimates everywhere they appear; they are not vendor datasheet values.
 *
 * Pure module.
 */

/**
 * fixedJ    — joules of wake-up / setup / tail energy per transmission
 * perByteJ  — joules per payload byte at the radio
 * rangeM    — order-of-magnitude usable range in metres
 * bps       — effective throughput for tiny frames
 */
export const RADIOS = {
  lte: {
    id: "lte",
    label: "Cellular · LTE",
    short: "LTE",
    note: "Base station needed. Highest fixed cost, so batching wins.",
    fixedJ: 1.4,
    perByteJ: 0.01,
    rangeM: 3000,
    bps: 20000,
    reachable: "Wherever there is a tower — the first thing to fail.",
    band: "700 MHz – 2.6 GHz",
  },
  gsm: {
    id: "gsm",
    label: "Cellular · 2G",
    short: "2G",
    note: "Survives longer than LTE on a degraded grid. Very high per-byte cost.",
    fixedJ: 0.6,
    perByteJ: 0.03,
    rangeM: 8000,
    bps: 2000,
    reachable: "Rural towers still up on backup power.",
    band: "900 / 1800 MHz",
  },
  lora: {
    id: "lora",
    label: "LoRa (868/915 MHz)",
    short: "LoRa",
    note: "No infrastructure. Per-byte cost rules, so encoding wins.",
    fixedJ: 0.0008,
    perByteJ: 0.00006,
    rangeM: 5000,
    bps: 300,
    reachable: "Village-to-village, no towers, no subscription.",
    band: "868 / 915 MHz ISM",
  },
  ble: {
    id: "ble",
    label: "Bluetooth Low Energy",
    short: "BLE",
    note: "Device-to-device mesh. Cheapest radio there is; range is short.",
    fixedJ: 0.00035,
    perByteJ: 0.00002,
    rangeM: 60,
    bps: 1000,
    reachable: "Inside a shelter, a stairwell, a collapsed floor.",
    band: "2.4 GHz",
  },
  satellite: {
    id: "satellite",
    label: "Satellite (SBD)",
    short: "Sat",
    note: "Works with everything on the ground destroyed. Extremely costly.",
    fixedJ: 2.2,
    perByteJ: 0.02,
    rangeM: 1e7,
    bps: 300,
    reachable: "Anywhere with sky. The last resort that still works.",
    band: "L-band",
  },
};

/**
 * Energy stores that people actually have at 1%.
 * joules = Wh × 3600. Phone: 3000 mAh @ 3.7 V = 11.1 Wh = 39 960 J.
 */
export const RESOURCES = {
  phone: {
    id: "phone",
    label: "Phone battery",
    detail: "3000 mAh · 3.7 V · 11.1 Wh",
    capacityJ: 39960,
    standbyW: 0.06,
  },
  powerbank: {
    id: "powerbank",
    label: "Power bank",
    detail: "10 000 mAh · 37 Wh",
    capacityJ: 133200,
    standbyW: 0.4,
  },
  aa: {
    id: "aa",
    label: "Two AA cells",
    detail: "2 × 2800 mAh @ 1.5 V · 8.4 Wh",
    capacityJ: 30240,
    standbyW: 0.09,
  },
  coin: {
    id: "coin",
    label: "Coin cell",
    detail: "CR2032 · 0.66 Wh",
    capacityJ: 2376,
    standbyW: 0.001,
  },
  crank: {
    id: "crank",
    label: "Hand crank · 60 s",
    detail: "≈5 W human input for one minute",
    capacityJ: 300,
    standbyW: 0.0,
  },
};

/**
 * Joules to put one message on one radio.
 *
 * The fixed cost is divided across the batch (one transmission carries the
 * whole outbox); the per-byte cost is paid for every byte in the frame.
 *
 * @param {object} opts
 * @param {string} opts.radioId
 * @param {number} opts.bytes      bytes this message occupies on the wire
 * @param {number} [opts.batchSize] messages sharing one transmission
 */
export function energyPerMessage({ radioId, bytes, batchSize = 1 }) {
  const radio = RADIOS[radioId];
  if (!radio) throw new Error(`unknown radio: ${radioId}`);
  const perMessageBytes = bytes;
  const transmissionsPerMessage = 1 / Math.max(1, batchSize);
  const fixed = radio.fixedJ * transmissionsPerMessage;
  const linear = radio.perByteJ * perMessageBytes;
  return { fixed, linear, total: fixed + linear, radio };
}

/**
 * Joules for a single transmission carrying `count` messages of `bytes` each,
 * plus whatever framing the radio requires.
 */
export function transmissionCost({ radioId, bytes, count = 1, framingBytes = 0 }) {
  const radio = RADIOS[radioId];
  if (!radio) throw new Error(`unknown radio: ${radioId}`);
  const onWire = bytes * count + framingBytes;
  return {
    total: radio.fixedJ + radio.perByteJ * onWire,
    onWire,
    perMessage: (radio.fixedJ + radio.perByteJ * onWire) / count,
    radio,
  };
}

/**
 * Split a store of energy into "how many messages" and "how long at this rate".
 *
 * @param {object} opts
 * @param {string} opts.resourceId
 * @param {number} opts.levelPct    remaining charge, 1–100
 * @param {number} opts.bytes
 * @param {string} opts.radioId
 * @param {number} [opts.batchSize]
 * @param {number} [opts.messagesPerHour] duty cycle used for the time estimate
 */
export function simulate({
  resourceId,
  levelPct,
  bytes,
  radioId,
  batchSize = 1,
  messagesPerHour = 6,
}) {
  const resource = RESOURCES[resourceId];
  if (!resource) throw new Error(`unknown resource: ${resourceId}`);

  const availableJ = resource.capacityJ * (levelPct / 100);
  const per = energyPerMessage({ radioId, bytes, batchSize });
  const messages = per.total > 0 ? Math.floor(availableJ / per.total) : Infinity;

  // Time-to-empty mixes the transmit duty cycle with the standby draw.
  const txPerHour = messagesPerHour * per.total; // J/h spent transmitting
  const standbyPerHour = resource.standbyW * 3600; // J/h spent idling
  const drainPerHour = txPerHour + standbyPerHour;
  const hours = drainPerHour > 0 ? availableJ / drainPerHour : Infinity;

  return {
    resource,
    radio: per.radio,
    availableJ,
    perMessageJ: per.total,
    fixedJ: per.fixed,
    linearJ: per.linear,
    messages,
    hours,
    drainPerHour,
    dutyShare: drainPerHour > 0 ? txPerHour / drainPerHour : 0,
  };
}

/** Human-friendly duration, tuned for the 1% end of the scale. */
export function formatDuration(hours) {
  if (!Number.isFinite(hours)) return "∞";
  if (hours < 1 / 60) return `${Math.round(hours * 3600)} s`;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
  if (hours < 24 * 400) return `${Math.round(hours / 24)} d`;
  return `${(hours / 8760).toFixed(1)} y`;
}

export function formatJoules(j) {
  if (!Number.isFinite(j)) return "∞";
  if (j >= 1000) return `${(j / 1000).toFixed(j >= 10000 ? 0 : 1)} kJ`;
  if (j >= 1) return `${j.toFixed(j >= 100 ? 0 : 1)} J`;
  if (j >= 0.001) return `${(j * 1000).toFixed(1)} mJ`;
  return `${(j * 1e6).toFixed(0)} µJ`;
}

export function formatCount(n) {
  if (!Number.isFinite(n)) return "∞";
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
