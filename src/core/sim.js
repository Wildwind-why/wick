/**
 * sim.js — the resource simulation.
 *
 * A minute-by-minute model of one team in the field. It answers the question a
 * jury will ask anyway: *show me it matters.*
 *
 * Modelled per minute, for `hours` hours:
 *   · demand      messages the team wants to send, on a day/night duty cycle
 *   · link        connectivity sampled from an outage profile
 *   · encoding    each message costs its true wick size, or the naive size
 *   · drain       transmit energy + standby energy, per radio and battery
 *   · backlog     queue depth, batched into one transmission when a link exists
 *
 * Deterministic: same scenario in, same series out (seeded PRNG, no Date).
 *
 * Pure module.
 */

import { RADIOS, RESOURCES, transmissionCost } from "./energy.js";
import { framingFor } from "./baseline.js";

/** Mulberry32 — small, fast, seedable, dependency-free. */
export function seeded(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SCENARIOS = {
  quake: {
    id: "quake",
    label: "Earthquake · shelter cluster",
    blurb:
      "Four responders, four villages, mains down, towers on backup power. Traffic spikes after each aftershock.",
    people: 4,
    messagesPerHour: 9,
    burstFactor: 3,
    outageProfile: { uptime: 0.28, outageMinutes: [25, 140] },
    hours: 336,
    resourceId: "phone",
    levelPct: 100,
    radioId: "gsm",
    seed: 7,
  },
  blackout: {
    id: "blackout",
    label: "City blackout · stairwell check",
    blurb:
      "One device walks a 30-storey building. No cell service inside, so messages hop phone-to-phone over BLE and send when one of them reaches the street.",
    people: 1,
    messagesPerHour: 14,
    burstFactor: 1.6,
    outageProfile: { uptime: 0.18, outageMinutes: [40, 220] },
    hours: 96,
    resourceId: "phone",
    levelPct: 100,
    radioId: "ble",
    seed: 23,
  },
  remote: {
    id: "remote",
    label: "Remote clinic · no towers",
    blurb:
      "A clinic two hours from the nearest mast, running on a car battery and a LoRa relay on the ridge.",
    people: 3,
    messagesPerHour: 6,
    burstFactor: 4,
    outageProfile: { uptime: 0.55, outageMinutes: [10, 90] },
    hours: 336,
    resourceId: "powerbank",
    levelPct: 100,
    radioId: "lora",
    seed: 41,
  },
  last1: {
    id: "last1",
    label: "The last 1%",
    blurb:
      "Everything is gone: one bar, one phone, one person who has to tell four families something true.",
    people: 1,
    messagesPerHour: 5,
    burstFactor: 1,
    outageProfile: { uptime: 0.2, outageMinutes: [60, 300] },
    hours: 12,
    resourceId: "phone",
    levelPct: 1,
    radioId: "lte",
    seed: 5,
  },
};

/**
 * @param {object} scenario
 * @param {object} opts
 * @param {'wick'|'naive'} opts.mode
 * @param {number} opts.bytes wick frame size (ignored when mode === 'naive')
 * @param {number} opts.naiveBytes
 * @returns {object} series + summary
 */
export function run(scenario, { mode = "wick", bytes = 12, naiveBytes = 340 } = {}) {
  const random = seeded(scenario.seed);
  const radio = RADIOS[scenario.radioId];
  const resource = RESOURCES[scenario.resourceId];
  const payload = mode === "wick" ? bytes : naiveBytes;
  const framing = mode === "wick" ? framingFor(scenario.radioId).wick : framingFor(scenario.radioId).naive;

  let chargeJ = resource.capacityJ * (scenario.levelPct / 100);
  const standbyPerMinute = resource.standbyW * 60;

  let queued = 0;
  let delivered = 0;
  let transmissions = 0;
  let spentJ = 0;
  let linkMinutes = 0;
  let outageLeft = 0;
  let linkUp = true;

  // Convert the scenario's uptime fraction into a two-state process:
  // mean outage length is given, mean up-time follows from the uptime ratio.
  const [outMin, outMax] = scenario.outageProfile.outageMinutes;
  const meanOutage = (outMin + outMax) / 2;
  const meanUp =
    (Math.max(0.02, Math.min(0.98, scenario.outageProfile.uptime)) /
      (1 - Math.max(0.02, Math.min(0.98, scenario.outageProfile.uptime)))) *
    meanOutage;
  const dropPerMinute = 1 / Math.max(1, meanUp);
  const randomOutage = () => outMin + random() * (outMax - outMin);

  const series = [];
  const totalMinutes = scenario.hours * 60;
  const sampleEvery = Math.max(1, Math.round(totalMinutes / 240));

  let deadAt = null;

  for (let m = 0; m < totalMinutes; m++) {
    // --- link state: a two-state outage process ---------------------------
    if (outageLeft > 0) {
      outageLeft -= 1;
      linkUp = false;
      if (outageLeft === 0) linkUp = true;
    } else if (linkUp && random() < dropPerMinute) {
      linkUp = false;
      outageLeft = Math.max(1, Math.round(randomOutage()));
    }
    if (linkUp) linkMinutes += 1;

    // --- demand: a day/night duty cycle plus bursts -----------------------
    const hour = (m / 60) % 24;
    const duty = 0.55 + 0.45 * Math.sin(((hour - 7) / 24) * Math.PI * 2);
    let demand = (scenario.people * scenario.messagesPerHour * duty) / 60;
    if (random() < 0.02) demand *= scenario.burstFactor;
    queued += demand;

    // --- transmit when a link exists --------------------------------------
    if (linkUp && queued >= 1) {
      const batch = Math.floor(Math.min(queued, 40));
      // One transmission carries the whole drained outbox: the fixed radio
      // cost is paid once and shared by every message in the batch.
      const { total: cost } = transmissionCost({
        radioId: scenario.radioId,
        bytes: payload,
        count: batch,
        framingBytes: framing,
      });
      if (chargeJ >= cost) {
        chargeJ -= cost;
        spentJ += cost;
        queued -= batch;
        delivered += batch;
        transmissions += 1;
      } else {
        deadAt = deadAt ?? m;
      }
    }

    // --- standby ----------------------------------------------------------
    if (chargeJ > 0) {
      const idle = Math.min(standbyPerMinute, chargeJ);
      chargeJ -= idle;
      spentJ += idle;
    } else if (deadAt === null) {
      deadAt = m;
    }

    if (m % sampleEvery === 0 || m === totalMinutes - 1) {
      series.push({
        minute: m,
        chargePct: Math.max(0, (chargeJ / resource.capacityJ) * 100),
        queued,
        delivered,
        transmissions,
      });
    }
  }

  const aliveHours = deadAt === null ? scenario.hours : deadAt / 60;

  return {
    mode,
    series,
    summary: {
      radio,
      resource,
      payloadBytes: payload,
      delivered: Math.round(delivered),
      undelivered: Math.round(queued),
      transmissions,
      spentJ,
      remainingJ: Math.max(0, chargeJ),
      linkMinutes,
      aliveHours,
      alivePct: (aliveHours / scenario.hours) * 100,
      payload,
    },
  };
}

/** Run the scenario both ways and describe the gap. */
export function compareScenario(scenario, { bytes = 12, naiveBytes = 340 } = {}) {
  const wick = run(scenario, { mode: "wick", bytes, naiveBytes });
  const naive = run(scenario, { mode: "naive", bytes, naiveBytes });

  const deliveredRatio =
    naive.summary.delivered > 0
      ? wick.summary.delivered / naive.summary.delivered
      : Infinity;

  return {
    scenario,
    wick,
    naive,
    deliveredRatio,
    extraDelivered: wick.summary.delivered - naive.summary.delivered,
    extraHours: wick.summary.aliveHours - naive.summary.aliveHours,
  };
}
