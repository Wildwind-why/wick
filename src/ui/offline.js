/** Offline-first composer, simulated link and optional real LAN relay. */
import { $, on, escapeHtml, workerUnsupportedReason } from './dom.js';
import { t, nf } from './i18n.js';
import { openStore } from '../core/store.js';
import { Outbox, LINKS, STATUS, composeText, simulatedTransport } from '../core/sync.js';
import { RelayClient } from './relay.js';

const STATUS_LABEL = { queued: 'c4.queued', sending: 'c4.sending', sent: 'c4.sent', failed: 'c4.failed', simulated: 'c4.simulated' };
export async function initOffline() {
  const refs = Object.fromEntries(['form','input','list','carried','count','links','send','clear','hint','sw','mode','room','connect','relay-status','inbox','priority','presets','error'].map(k => [k, $('#off-' + k)]));
  if (!refs.form) return;
  const device = $('.device');
  const store = await openStore();
  const outbox = new Outbox(store);
  await outbox.hydrate();
  let link = LINKS.offline, timer = 0, relayState = 'disconnected', mode = 'simulated';
  const relay = new RelayClient(store, { onReceive: renderInbox, onState(next) { relayState = next; render(); } });
  const storeEl = $('#off-store');
  if (storeEl) { storeEl.textContent = t(store.kind === 'indexeddb' ? 'c4.store.idb' : 'c4.store.mem'); storeEl.dataset.state = store.kind === 'indexeddb' ? 'ok' : ''; }
  refs.room.value = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(16).padStart(2, '0')).join('');
  refs.mode.value = mode;
  const CAPTURE = new URL(location.href).searchParams.get('capture') === '1';
  if (refs.sw) {
    refs.sw.textContent = t('c4.sw.pending'); refs.sw.dataset.state = 'pending';
    reportWorkerState(CAPTURE ? 60000 : 6000).then(verdict => {
      const keys = { active: 'active', registered: 'registered', partial: 'partial', absent: 'absent', unsupported: 'none' };
      refs.sw.dataset.verdict = verdict;
      refs.sw.dataset.labelKey = 'c4.sw.' + (keys[verdict] || 'none');
      refs.sw.dataset.state = verdict === 'active' ? 'ok' : verdict === 'unsupported' ? 'unsupported' : 'partial';
      render();
    });
  }
  function render() {
    const items = outbox.items.slice().sort((a,b) => (b.priority || 1) - (a.priority || 1) || b.createdAt - a.createdAt);
    refs.list.innerHTML = items.length ? items.map(item => `<div class="msg${item.priority === 3 ? ' msg--urgent' : ''}" data-status="${item.status}"><span class="msg__text">${escapeHtml(describe(item.message))}</span><span class="msg__meta">${item.priority === 3 ? escapeHtml(t('c4.urgent')) + ' · ' : ''}${item.bytes} B · ${escapeHtml(t(STATUS_LABEL[item.status] || 'c4.queued'))}</span></div>`).join('') : `<p class="device__empty">${escapeHtml(t('c4.empty'))}</p>`;
    refs.count.textContent = t('c4.count', { queued: outbox.items.length, sent: outbox.sent, simulated: outbox.simulated });
    refs.hint.textContent = t(outbox.error ? 'c4.retry' : !link.available ? 'c4.nothing' : mode === 'relay' ? 'c4.awaitPeer' : 'c4.simulationNote');
    refs.send.disabled = !!outbox.active || !link.available || (mode === 'relay' && !relay.connected);
    refs.clear.disabled = !!outbox.active;
    refs['relay-status'].textContent = t('c4.relay.' + relayState);
    refs.room.disabled = relay.connected;
    refs.connect.textContent = t(relay.connected ? 'c4.disconnect' : 'c4.connect');
    $('#off-relay-controls').hidden = mode !== 'relay';
    if (refs.sw?.dataset.labelKey) refs.sw.textContent = t(refs.sw.dataset.labelKey) + (refs.sw.dataset.shell ? ' · ' + refs.sw.dataset.shell : '');
    if (storeEl) storeEl.textContent = t(store.kind === 'indexeddb' ? 'c4.store.idb' : 'c4.store.mem');
    for (const button of refs.links.children) button.setAttribute('aria-pressed', String(button.dataset.link === link.id));
    $('#dev-link-label').textContent = mode === 'relay' ? t(link.available ? 'c4.localLink' : 'c4.paused') : t('c4.simulation') + ' · ' + link.label;
    $('#dev-link').dataset.link = link.id;
    $('#dev-link .dot').dataset.state = link.available ? 'ok' : 'crit';
    $('#dev-rtt').textContent = mode === 'simulated' && link.rttMs ? t('c4.modelRtt', { ms: link.rttMs }) : '';
  }
  async function renderInbox() {
    const items = (await store.all('inbox')).filter(i => !relay.room || i.id.startsWith(relay.room + ':')).sort((a,b) => b.receivedAt - a.receivedAt).slice(0, 8);
    refs.inbox.innerHTML = items.length ? items.map(i => `<div class="msg"><span class="msg__text">${escapeHtml(describe(i.message))}</span><span class="msg__meta">${escapeHtml(t('c4.received'))}</span></div>`).join('') : `<p class="hint">${escapeHtml(t('c4.inboxEmpty'))}</p>`;
  }
  function paintLinks() {
    const entries = mode === 'relay' ? [LINKS.offline, LINKS.good] : Object.values(LINKS);
    refs.links.innerHTML = entries.map(entry => `<button type="button" data-link="${entry.id}">${escapeHtml(mode === 'relay' ? t(entry.available ? 'c4.allowSend' : 'c4.pauseSend') : entry.label)}</button>`).join('');
  }
  function setLink(next) {
    link = next;
    if (!next.available) { clearTimeout(timer); outbox.cancel(); }
    render();
    if (next.available) scheduleFlush();
  }
  function scheduleFlush(urgent = false) {
    clearTimeout(timer);
    timer = setTimeout(() => flush(), urgent ? 0 : 420);
  }
  async function flush() {
    if (!link.available || !outbox.queuedCount || outbox.active) return;
    if (mode === 'relay' && !relay.connected) return;
    device.dataset.busy = 'true';
    try {
      const result = await outbox.flush(() => link, mode === 'relay' ? relay : simulatedTransport);
      refs.carried.textContent = nf(result.bytes);
    } catch { refs.error.textContent = t('c4.storageError'); }
    finally { device.dataset.busy = 'false'; render(); }
  }
  refs.form.addEventListener('submit', async event => {
    event.preventDefault(); refs.error.textContent = '';
    if (!refs.input.value.trim()) return;
    try {
      const urgent = refs.priority.value === '3';
      await outbox.enqueue(composeText(refs.input.value), { priority: urgent ? 3 : 1 });
      refs.input.value = ''; render();
      if (link.available) scheduleFlush(urgent);
    } catch (error) { refs.error.textContent = t('c4.inputError') + ' ' + error.message; }
  });
  on(refs.presets, 'click', '[data-compose]', (_, button) => {
    refs.input.value = t('c4.example.' + button.dataset.compose); refs.input.focus();
    refs.priority.value = button.dataset.compose === 'help' ? '3' : '1';
  });
  refs.mode.addEventListener('change', () => {
    outbox.cancel(); clearTimeout(timer); relay.disconnect(); mode = refs.mode.value;
    paintLinks(); setLink(LINKS.offline);
  });
  refs.connect.addEventListener('click', async () => {
    refs.error.textContent = '';
    if (relay.connected) { relay.disconnect(); setLink(LINKS.offline); return; }
    refs.connect.disabled = true;
    try { await relay.connect(refs.room.value.trim()); await renderInbox(); setLink(LINKS.good); }
    catch { refs.error.textContent = t('c4.connectError'); relay.disconnect(); }
    finally { refs.connect.disabled = false; render(); }
  });
  on(refs.links, 'click', '[data-link]', (_, button) => setLink(LINKS[button.dataset.link]));
  refs.send.addEventListener('click', flush);
  refs.clear.addEventListener('click', async () => { try { await outbox.clear(); } catch { refs.error.textContent = t('c4.storageError'); } });
  outbox.onChange(render);
  window.addEventListener('offline', () => setLink(LINKS.offline));
  window.addEventListener('online', () => { if (mode === 'relay' && relay.connected) setLink(LINKS.good); });
  window.addEventListener('pagehide', () => { clearTimeout(timer); outbox.cancel(); relay.disconnect(); });
  document.addEventListener('wick:lang', () => { paintLinks(); render(); renderInbox(); });
  paintLinks(); render(); await renderInbox();
}
function describe(message) {
  if (message.type === 'sitrep') return message.text;
  if (message.type === 'checkin') return 'checkin · ' + message.status;
  if (message.type === 'need') return 'need · ' + message.need;
  return message.type;
}
async function reportWorkerState(timeoutMs = 6000) {
  // Decided before the deadline, not after it: where no worker can exist, the
  // answer is "unavailable" immediately, rather than six seconds of the page
  // looking like it is still checking.
  if (workerUnsupportedReason()) return "unsupported";

  const registration = await Promise.race([
    navigator.serviceWorker
      .getRegistration()
      .catch(() => null)
      .then(async (existing) => existing || navigator.serviceWorker.ready.catch(() => null)),
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  // "No worker yet" is not the same as "this browser cannot have one", and the
  // label has to tell them apart: the first is a state you can wait out, the
  // second is a property of where the page was opened from.
  if (!registration) return "absent";

  // Scope check: a worker registered under a different path would not serve
  // this page, and "active" would be a lie.
  try {
    const scope = new URL(registration.scope);
    const here = new URL(location.href);
    if (scope.origin !== here.origin || !here.pathname.startsWith(scope.pathname)) return "absent";
  } catch {
    return "absent";
  }

  /*
   * Ask the worker to describe its own cache, and keep asking while it is still
   * working.
   *
   * Two things make a single attempt wrong. A message sent to a worker that has
   * not started yet is not answered at all; and a cache that is half-filled
   * because install is still running is not a verdict, it is a photograph of a
   * process halfway through. So: retry on silence, and retry on an incomplete
   * cache *as long as an install is still in flight*. Only a short cache with
   * nothing installing is a result worth reporting.
   */
  // Give the worker room to finish installing when the screenshot harness asks
  // for a longer deadline; the default stays tight for real users.
  const attempts = timeoutMs >= 20000 ? 20 : 6;
  const messageTimeout = timeoutMs >= 20000 ? 5000 : 2000;
  // Bound the whole exchange by wall-clock time, not by attempt count: the
  // useful work is "keep asking until the worker answers", and the answer is
  // either a report or the deadline.
  const deadline = performance.now() + timeoutMs;
  let report = null;
  for (let attempt = 0; attempt < attempts && performance.now() < deadline; attempt += 1) {
    let installing = false;
    try {
      const live = await navigator.serviceWorker.getRegistration().catch(() => null);
      installing = !!(live && live.installing);
      const worker = live && (live.active || live.waiting || live.installing);
      if (worker) {
        report = await Promise.race([
          new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => resolve(event.data);
            worker.postMessage("wick:shell", [channel.port2]);
          }),
          new Promise((resolve) => setTimeout(() => resolve(null), messageTimeout)),
        ]);
      }
    } catch {
      report = null;
    }
    if (report && report.total) {
      if (report.cached === report.total) break; // complete — that is the verdict
      if (report.failed && report.failed.length) break; // a failure is a verdict
      if (!installing) break; // settled and short — that is the answer
      // else: still installing, so keep waiting.
    }
    // Silence is NOT a verdict. A worker that has not started yet simply never
    // answers, and a message that arrives while it is still filling its cache
    // can be dropped. Reporting "registered" on the first unanswered message
    // was a race: on a fresh profile it made the panel understate a shell that
    // was, in fact, fully cached. Keep asking until the deadline instead.
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  const el = document.getElementById("off-sw");
  if (report && report.total) {
    if (el) el.dataset.shell = `${report.cached}/${report.total}`;
    if (report.failed && report.failed.length) {
      if (el) el.dataset.failed = report.failed.join(", ");
      return "partial";
    }
    // "shell cached" means all of it. A partial cache still helps, but it is
    // not what the label says, so it is not what the label claims.
    if (report.cached < report.total) {
      if (el) el.dataset.missing = (report.missing || []).join(", ");
      return "partial";
    }
    return "active";
  }

  // Registered and in scope, but the worker never described its cache. Saying
  // "active · shell cached" here would be a claim without evidence, which is
  // the failure this whole block exists to prevent.
  return "registered";
}
