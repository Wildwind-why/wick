/** Optional same-origin relay. No polling until the user explicitly connects. */
import { decode } from '../core/codec.js';
import { delay } from '../core/sync.js';

export class RelayClient {
  mode = 'relay';
  constructor(store, { onReceive, onState }) {
    this.store = store; this.onReceive = onReceive; this.onState = onState;
    try { this.device = sessionStorage.getItem('wick:device'); } catch {}
    if (!this.device) this.device = 'device_' + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
    try { sessionStorage.setItem('wick:device', this.device); } catch {}
    this.connected = false;
  }
  async request(route, data, signal) {
    const response = await fetch(new URL('api/' + route, document.baseURI), {
      method: data ? 'POST' : 'GET', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Wick-Room': this.room, 'X-Wick-Device': this.device },
      body: data ? JSON.stringify(data) : undefined,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('relay unavailable (' + response.status + ')');
    return response.json();
  }
  async connect(room) {
    this.disconnect();
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(room)) throw new Error('invalid room code');
    this.room = room;
    const controller = this.controller = new AbortController();
    const status = await this.request('status', null, controller.signal);
    if (status.service !== 'wick-local-relay') throw new Error('start tools/serve.cjs first');
    if (controller.signal.aborted) throw new Error('cancelled');
    this.connected = true; this.onState('connected');
    this.poll(controller.signal);
  }
  disconnect() {
    this.connected = false; this.controller?.abort();
    this.onState?.('disconnected');
  }
  async poll(signal) {
    while (!signal.aborted) {
      try {
        const data = await this.request('inbox', null, signal);
        const receipts = [];
        for (const item of data.items) {
          try {
            const message = decode(Uint8Array.from(item.frame));
            const id = this.room + ':' + item.sender + ':' + item.id;
            if (!(await this.store.get('inbox', id))) {
              await this.store.put('inbox', { id, message, priority: item.priority, receivedAt: Date.now() });
              await this.onReceive();
            }
            receipts.push({ id: item.id, sender: item.sender });
          } catch { /* malformed frames are never acknowledged */ }
        }
        if (receipts.length) await this.request('ack', { items: receipts }, signal);
        this.onState('connected');
      } catch {
        if (!signal.aborted) this.onState('retrying');
      }
      try { await delay(document.documentElement.dataset.mode === 'eco' ? 3000 : 1000, signal); } catch { break; }
    }
  }
  async send(batch, { signal }) {
    if (!this.connected) throw new Error('connect the relay first');
    const both = AbortSignal.any([signal, this.controller.signal]);
    await this.request('send', { items: batch.map(({ id, frame, priority }) => ({ id, frame, priority })) }, both);
    const deadline = Date.now() + 10000;
    let acknowledged = [];
    while (Date.now() < deadline) {
      const receipts = await this.request('receipts', null, both);
      acknowledged = batch.filter(item => receipts.acknowledged.includes(item.id)).map(item => item.id);
      if (acknowledged.length === batch.length) return { acknowledged };
      await delay(650, both);
    }
    return { acknowledged };
  }
}
