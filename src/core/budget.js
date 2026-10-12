/**
 * budget.js — the power budget engine.
 *
 * Given a charge level, a radio and an outbox, answer the only question that
 * matters at 1%: *how much of what I need can I still afford?*
 *
 * It also decides what 1% mode is allowed to throw away. That is a product
 * decision, and it is stated out loud: at 1% wick stops sending position and
 * time, because a receiver who knows *what* you need can act, while a receiver
 * who knows where you were three minutes ago often cannot.
 *
 * Pure module.
 */

import { measure } from "./codec.js";
import { simulate, energyPerMessage, RADIOS } from "./energy.js";
import { naiveWire, batched, framingFor, FRAME_LIMIT } from "./baseline.js";

/**
 * What 1% mode strips, and why. Order matters: the first thing dropped is the
 * thing whose loss hurts least.
 */
export const ECO_TRIMMING = [
  {
    key: "position",
    label: "c3.keep.position",
    reason: "c3.keep.position.reason",
  },
  {
    key: "time",
    label: "c3.keep.time",
    reason: "c3.keep.time.reason",
  },
  {
    key: "detail",
    label: "c3.keep.detail",
    reason: "c3.keep.detail.reason",
  },
];

/**
 * @param {object} message       a wick message object
 * @param {object} context       codec context (origin / prevTime)
 * @param {boolean} eco          drop non-essential fields
 */
export function planMessage(message, context = {}, eco = false) {
  const plan = { ...message, position: message.position, time: message.time };
  const dropped = [];

  // Eco mode reduces interface work, never message meaning.
  // Batching remains an explicit control; no automatic payload truncation.

  const result = measure(plan, context);
  const naive = naiveWire(message);

  return { plan, dropped, wick: result, naive };
}

/**
 * Compare wick against the mainstream messenger for the same message, at the
 * same charge level, on the same radio.
 */
export function compare({
  message,
  context = {},
  resourceId = "phone",
  levelPct = 1,
  radioId = "lte",
  batchSize = 1,
  eco = false,
  messagesPerHour = 6,
}) {
  const { plan, dropped, wick } = planMessage(message, context, eco);
  const naive = naiveWire(message, radioId);
  const framing = framingFor(radioId);

  const wickBytesPerMessage = wick.size;
  const naiveBytesPerMessage = naive.payload;

  // Store-and-forward: the framing cost is paid once for the whole batch.
  const wickBatchBytes = batched(wickBytesPerMessage, batchSize, framing.wick);
  const naiveBatchBytes = batched(naiveBytesPerMessage, batchSize, framing.naive);

  const wickSim = simulate({
    resourceId,
    levelPct,
    bytes: wickBatchBytes,
    radioId,
    batchSize,
    messagesPerHour,
  });
  const naiveSim = simulate({
    resourceId,
    levelPct,
    bytes: naiveBatchBytes,
    radioId,
    batchSize,
    messagesPerHour,
  });

  // How many more messages wick buys with the same charge. >1 means wick wins.
  const ratio = naiveSim.messages > 0 ? wickSim.messages / naiveSim.messages : Infinity;

  return {
    plan,
    dropped,
    wick: {
      ...wick,
      wireBytes: wickBytesPerMessage,
      batchedBytes: wickBatchBytes,
      sim: wickSim,
    },
    naive: {
      ...naive,
      wireBytes: naiveBytesPerMessage,
      batchedBytes: naiveBatchBytes,
      sim: naiveSim,
    },
    advantage: ratio,
    bytesSavedPerMessage: naiveBatchBytes - wickBatchBytes,
    bytesSavedPct:
      naiveBatchBytes > 0
        ? 1 - wickBatchBytes / naiveBatchBytes
        : 0,
    framing,
    /**
     * A mainstream messenger cannot even place one of its messages into a raw
     * radio frame. This is the difference that no amount of tuning closes.
     */
    baselineFitsFrame: naive.fitsFrame,
    frameLimit: FRAME_LIMIT[radioId],
  };
}

/**
 * Which radio should you reach for? Ranked by how many messages the remaining
 * charge buys — the metric that matters, not raw throughput.
 */
export function rankRadios({ bytes, resourceId, levelPct, batchSize = 1 }) {
  return Object.values(RADIOS)
    .map((radio) => {
      const sim = simulate({
        resourceId,
        levelPct,
        bytes: batched(bytes, batchSize, framingFor(radio.id).wick),
        radioId: radio.id,
        batchSize,
      });
      return { radio, ...sim };
    })
    .sort((a, b) => b.messages - a.messages);
}

export { energyPerMessage };
