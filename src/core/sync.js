/**
 * sync.js — store-and-forward, the offline half of the product.
 *
 * Writing a message never requires a network. It requires a queue.
 *
 *   compose → persisted locally → QUEUED
 *            (link returns) → batch → one transmission → SENT
 *
 * Because the whole outbox drains in a single transmission, the fixed radio
 * cost is paid once instead of once per message. That is the arithmetic that
 * makes 1% last: ten check-ins cost roughly one check-in's worth of radio
 * wake-ups.
 *
 * Works with any object store implementing put/get/all/remove.
 */

import { newId } from "./store.js";

export const STATUS = {
  queued: "queued",
  sending: "sending",
  sent: "sent",
  failed: "failed",
};

export class Outbox {
  /**
   * @param {object} store   openStore() result
   * @param {object} [opts]
   * @param {number} [opts.batchLimit] messages per transmission
   */
  constructor(store, { batchLimit = 12 } = {}) {
    this.store = store;
    this.batchLimit = batchLimit;
    this.items = [];
    this.listeners = new Set();
    this.sent = 0;
    this.transmissions = 0;
    this.wireBytes = 0;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #emit() {
    for (const fn of this.listeners) fn(this);
  }

  async hydrate() {
    const stored = await this.store.all("outbox");
    this.items = stored.sort((a, b) => a.createdAt - b.createdAt);
    this.#emit();
    return this.items;
  }

  /** Compose. Never throws for lack of a network — that is the point. */
  async enqueue(message, { bytes = 0 } = {}) {
    const item = {
      id: newId("msg"),
      message,
      bytes,
      status: STATUS.queued,
      attempts: 0,
      createdAt: Date.now(),
      sentAt: null,
    };
    this.items.push(item);
    await this.store.put("outbox", item);
    this.#emit();
    return item;
  }

  get pending() {
    return this.items.filter((i) => i.status === STATUS.queued || i.status === STATUS.failed);
  }

  get queuedCount() {
    return this.pending.length;
  }

  get queuedBytes() {
    return this.pending.reduce((sum, i) => sum + i.bytes, 0);
  }

  /**
   * Drain the outbox through a link.
   *
   * @param {object} link   { available:boolean, bytesPerSecond:number, label:string }
   * @returns {Promise<{sent:number, transmissions:number, bytes:number}>}
   */
  async flush(link) {
    if (!link?.available) {
      for (const item of this.pending) item.status = STATUS.failed;
      this.#emit();
      return { sent: 0, transmissions: 0, bytes: 0, blocked: true };
    }

    const batch = this.pending.slice(0, this.batchLimit);
    if (batch.length === 0) return { sent: 0, transmissions: 0, bytes: 0 };

    for (const item of batch) {
      item.status = STATUS.sending;
      item.attempts += 1;
      this.#emit();
    }

    const bytes = batch.reduce((sum, i) => sum + i.bytes, 0);
    const seconds = link.bytesPerSecond > 0 ? bytes / link.bytesPerSecond : 0.2;
    await delay(Math.min(1400, Math.max(240, seconds * 1000)));

    for (const item of batch) {
      item.status = STATUS.sent;
      item.sentAt = Date.now();
      await this.store.put("outbox", item);
      await this.store.put("archive", item);
    }

    this.items = this.items.filter((i) => i.status !== STATUS.sent);
    this.sent += batch.length;
    this.transmissions += 1;
    this.wireBytes += bytes;
    this.#emit();
    return { sent: batch.length, transmissions: 1, bytes };
  }

  /** Everything waiting can be cleared when the operator chooses to. */
  async clear() {
    for (const item of this.items) await this.store.remove("outbox", item.id);
    this.items = [];
    this.#emit();
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Link models used by the demo and the simulation. `available:false` is not a
 * failure state — it is the normal state in the field.
 */
export const LINKS = {
  offline: { id: "offline", label: "No link", available: false, bytesPerSecond: 0, rttMs: 0 },
  edge: { id: "edge", label: "Edge / 2G", available: true, bytesPerSecond: 140, rttMs: 900 },
  weak: { id: "weak", label: "Weak LTE", available: true, bytesPerSecond: 900, rttMs: 420 },
  good: { id: "good", label: "Good LTE", available: true, bytesPerSecond: 6000, rttMs: 90 },
};
