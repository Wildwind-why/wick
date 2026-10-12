/** Persistent outbox. Simulated receipts are distinct from peer acknowledgments. */
import { newId } from './store.js';
import { measure } from './codec.js';

export const STATUS = { queued: 'queued', sending: 'sending', sent: 'sent', failed: 'failed', simulated: 'simulated' };
export function composeText(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('empty message');
  return { type: 'sitrep', text };
}
export const simulatedTransport = {
  mode: 'simulated',
  async send(batch, { link, signal }) {
    const bytes = batch.reduce((sum, item) => sum + item.bytes, 0);
    await delay(Math.min(1400, Math.max(240, bytes / Math.max(1, link.bytesPerSecond) * 1000)), signal);
    return { acknowledged: batch.map(item => item.id) };
  },
};
export class Outbox {
  constructor(store, { batchLimit = 12 } = {}) {
    this.store = store; this.batchLimit = batchLimit;
    this.items = []; this.listeners = new Set();
    this.sent = 0; this.simulated = 0; this.transmissions = 0; this.wireBytes = 0;
    this.error = null; this.active = null; this.controller = null;
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }
  async hydrate() {
    const stored = await this.store.all('outbox');
    const legacy = stored.filter(i => i.status === STATUS.sent || i.status === STATUS.simulated);
    if (legacy.length) await this.store.complete(legacy.map(i => ({ ...i, status: STATUS.simulated, deliveryMode: 'simulated' })));
    this.items = stored.filter(i => !legacy.includes(i)).sort((a, b) => a.createdAt - b.createdAt);
    for (const item of this.items) {
      if (item.status === STATUS.sending) {
        item.status = STATUS.queued;
        await this.store.put('outbox', item);
      }
    }
    const archive = await this.store.all('archive');
    this.sent = archive.filter(i => i.deliveryMode === 'relay' && i.status === STATUS.sent).length;
    this.simulated = archive.length - this.sent;
    this.emit(); return this.items;
  }
  async enqueue(message, { priority = 1 } = {}) {
    const m = measure(message);
    if (!m.ok) throw new Error(m.error || 'message failed round-trip validation');
    const item = {
      id: newId('msg'), message: structuredClone(message), bytes: m.size,
      frame: Array.from(m.bytes), status: STATUS.queued,
      priority: priority === 3 ? 3 : 1, attempts: 0, createdAt: Date.now(), sentAt: null,
    };
    await this.store.put('outbox', item); this.items.push(item); this.emit(); return item;
  }
  get pending() {
    return this.items.filter(i => i.status === STATUS.queued || i.status === STATUS.failed)
      .sort((a, b) => (b.priority || 1) - (a.priority || 1) || a.createdAt - b.createdAt);
  }
  get queuedCount() { return this.pending.length; }
  get queuedBytes() { return this.pending.reduce((sum, i) => sum + i.bytes, 0); }
  cancel() { this.controller?.abort(); }
  flush(linkOrGetter, transport = simulatedTransport) {
    if (this.active) return this.active;
    this.controller = new AbortController();
    this.active = this.drain(linkOrGetter, transport, this.controller.signal)
      .finally(() => { this.active = null; this.controller = null; this.emit(); });
    return this.active;
  }
  async drain(linkOrGetter, transport, signal) {
    const getLink = typeof linkOrGetter === 'function' ? linkOrGetter : () => linkOrGetter;
    const result = { sent: 0, simulated: 0, transmissions: 0, bytes: 0, mode: transport.mode };
    this.error = null;
    while (this.pending.length && getLink()?.available && !signal.aborted) {
      const batch = this.pending.slice(0, this.batchLimit);
      try {
        for (const item of batch) {
          const m = measure(item.message);
          if (!m.ok) throw new Error('message failed round-trip validation');
          item.frame = Array.from(m.bytes); item.bytes = m.size;
          item.status = STATUS.sending; item.attempts += 1;
          await this.store.put('outbox', item);
        }
        this.emit();
        const receipt = await transport.send(batch, { link: getLink(), signal });
        if (signal.aborted || !getLink()?.available) throw new Error('link interrupted; awaiting confirmation');
        const ids = new Set(receipt.acknowledged || []);
        const confirmed = batch.filter(item => ids.has(item.id)).map(item => ({
          ...item, status: transport.mode === 'relay' ? STATUS.sent : STATUS.simulated,
          deliveryMode: transport.mode, sentAt: Date.now(),
        }));
        if (confirmed.length) {
          await this.store.complete(confirmed);
          const done = new Set(confirmed.map(i => i.id));
          this.items = this.items.filter(i => !done.has(i.id));
          const bytes = confirmed.reduce((sum, i) => sum + i.bytes, 0);
          result.bytes += bytes; result.transmissions += 1;
          result[transport.mode === 'relay' ? 'sent' : 'simulated'] += confirmed.length;
          this[transport.mode === 'relay' ? 'sent' : 'simulated'] += confirmed.length;
          this.transmissions++; this.wireBytes += bytes;
        }
        if (confirmed.length !== batch.length) throw new Error('peer confirmation incomplete');
      } catch (error) {
        this.error = error.message;
        for (const item of batch) {
          if (!this.items.includes(item)) continue;
          item.status = STATUS.failed; await this.store.put('outbox', item);
        }
        this.emit(); return { ...result, error: this.error };
      }
      this.emit();
    }
    return { ...result, blocked: !getLink()?.available };
  }
  async clear() {
    this.cancel(); if (this.active) await this.active;
    for (const item of this.items) await this.store.remove('outbox', item.id);
    this.items = []; this.error = null; this.emit();
  }
}
export function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('cancelled'));
    const abort = () => { clearTimeout(timer); reject(new Error('cancelled')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
export const LINKS = {
  offline: { id: 'offline', label: 'No link', available: false, bytesPerSecond: 0, rttMs: 0 },
  edge: { id: 'edge', label: 'Edge / 2G', available: true, bytesPerSecond: 140, rttMs: 900 },
  weak: { id: 'weak', label: 'Weak LTE', available: true, bytesPerSecond: 900, rttMs: 420 },
  good: { id: 'good', label: 'Good LTE', available: true, bytesPerSecond: 6000, rttMs: 90 },
};
