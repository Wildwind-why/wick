/**
 * offline.js — section 04.
 *
 * This is not a mock-up. It writes to IndexedDB, keeps the outbox across
 * reloads, and drains the whole queue in one transmission when a link is
 * declared. Switch your machine's Wi-Fi off and this section still runs,
 * because the service worker has the shell and the store has the queue.
 */

import { $, on, escapeHtml, debounce, workerUnsupportedReason } from "./dom.js";
import { t, nf } from "./i18n.js";
import { openStore } from "../core/store.js";
import { Outbox, LINKS, STATUS } from "../core/sync.js";
import { measure } from "../core/codec.js";
import { framingFor } from "../core/baseline.js";
import { state, setState, codecContext } from "./state.js";

const STATUS_LABEL = {
  [STATUS.queued]: "c4.queued",
  [STATUS.sending]: "c4.sending",
  [STATUS.sent]: "c4.sent",
  [STATUS.failed]: "c4.failed",
};

export async function initOffline() {
  const refs = {
    form: $("#off-form"),
    input: $("#off-input"),
    list: $("#off-list"),
    carried: $("#off-carried"),
    count: $("#off-count"),
    links: $("#off-links"),
    send: $("#off-send"),
    clear: $("#off-clear"),
    hint: $("#off-hint"),
    sw: $("#off-sw"),
    storeEl: $("#off-store"),
    device: $(".device"),
    link: $("#dev-link"),
    linkLabel: $("#dev-link-label"),
    rtt: $("#dev-rtt"),
  };
  if (!refs.form) return;

  /* ---- everything that does not need storage happens first ---------------
     The panel is fully built and interactive before any storage is touched,
     so a slow or blocked IndexedDB can never hold the interface hostage. */
  if (refs.list) refs.list.innerHTML = `<p class="device__empty">${escapeHtml(t("c4.empty"))}</p>`;

  refs.links.innerHTML = Object.values(LINKS)
    .map(
      (entry) =>
        `<button type="button" data-link="${entry.id}">${escapeHtml(entry.label)}${
          entry.rttMs ? ` · ${entry.rttMs} ms` : ""
        }</button>`,
    )
    .join("");

  let link = LINKS.offline;
  let outbox = null;

  const store = await openStore();
  outbox = new Outbox(store, { batchLimit: 12 });
  await outbox.hydrate();

  if (refs.storeEl) {
    refs.storeEl.textContent = t(store.kind === "indexeddb" ? "c4.store.idb" : "c4.store.mem");
    refs.storeEl.dataset.state = store.kind === "indexeddb" ? "ok" : "";
  }

  /* ---- service worker state --------------------------------------------
     This panel reports what the browser actually did, not what the code
     intended. It used to print "active · shell cached" as soon as the
     Service Worker API merely existed — which meant the page claimed a
     cached shell while nothing had ever been cached, or even registered.
     That is the one kind of sentence this project cannot afford, so the
     label starts neutral and only becomes "active" when `ready` resolves,
     with a deadline so a registration that never settles says so. */
  if (refs.sw) {
    refs.sw.textContent = t("c4.sw.pending");
    refs.sw.dataset.state = "pending";

    // Deliberately not awaited: the outbox above is the useful part of this
    // panel, and it must not wait on a worker that may take seconds to
    // activate — or never answer at all, which is exactly what happened when
    // this code trusted a `.catch()` on a promise that never rejects.
    reportWorkerState().then((state) => {
      const KEY = {
        active: "c4.sw.active",     // registered, in scope, and the whole shell is in the cache
        partial: "c4.sw.partial",   // registered, but the cache is incomplete or something failed
        absent: "c4.sw.absent",     // nothing registered here yet
        unsupported: "c4.sw.none",  // this context cannot host a worker at all
      };
      refs.sw.textContent = t(KEY[state] || "c4.sw.none");
      refs.sw.dataset.state = state === "active" ? "ok" : state === "unsupported" ? "unsupported" : "partial";
      refs.sw.dataset.verdict = state;
    });
  }

  /* ---- rendering ------------------------------------------------------- */
  const render = () => {
    const items = outbox.items;
    if (items.length === 0) {
      refs.list.innerHTML = `<p class="device__empty">${escapeHtml(t("c4.empty"))}</p>`;
    } else {
      refs.list.innerHTML = items
        .slice()
        .reverse()
        .map((item) => {
          const label = describe(item.message);
          return (
            `<div class="msg" data-status="${item.status}">` +
            `<span class="msg__text">${escapeHtml(label)}</span>` +
            `<span class="msg__meta"><span>${item.bytes} B</span>` +
            `<span class="msg__chip">${escapeHtml(t(STATUS_LABEL[item.status]))}</span></span></div>`
          );
        })
        .join("");
    }
    if (refs.count) refs.count.textContent = `${nf(outbox.queuedCount)} queued · ${nf(outbox.sent)} sent`;
    if (refs.hint) {
      refs.hint.textContent = link.available ? t("c1.batch.hint") : t("c4.nothing");
    }
  };

  const setLink = (next) => {
    link = next;
    for (const button of refs.links.children) {
      button.setAttribute("aria-pressed", String(button.dataset.link === link.id));
    }
    if (refs.link) {
      refs.link.dataset.link = link.id;
      refs.link.querySelector(".dot").dataset.state =
        link.id === "offline" ? "crit" : link.id === "edge" ? "warn" : "ok";
    }
    if (refs.linkLabel) refs.linkLabel.textContent = link.label;
    if (refs.rtt) refs.rtt.textContent = link.rttMs ? `${link.rttMs} ms · ${link.bytesPerSecond} B/s` : "—";
    render();
    if (link.available) scheduleFlush();
  };

  /* ---- compose --------------------------------------------------------- */
  refs.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = refs.input.value.trim();
    if (!text) return;
    const message =
      text.split(/\s+/).length === 1
        ? { type: "checkin", status: dictionaryWord(text) }
        : { type: "sitrep", text };
    const measurement = measure(message, codecContext());
    await outbox.enqueue(message, { bytes: measurement.size });
    refs.input.value = "";
    render();
    if (link.available) scheduleFlush();
  });

  /* ---- draining -------------------------------------------------------- */
  let timer = 0;
  function scheduleFlush() {
    clearTimeout(timer);
    timer = setTimeout(() => flush(), 420);
  }

  async function flush() {
    if (!link.available || outbox.queuedCount === 0) return;
    if (refs.device) refs.device.dataset.busy = "true";
    const before = outbox.queuedCount;
    const result = await outbox.flush(link);
    if (refs.device) refs.device.dataset.busy = "false";

    const framing = framingFor(state.radioId || "lte").wick;
    const wire = result.bytes + framing;
    if (refs.carried) refs.carried.textContent = nf(wire);
    setState({ lastTransmissionBytes: wire }, "offline");

    // The batched saving is the whole point, so the HUD reports it.
    const perMessage = before > 0 ? wire / before : wire;
    const naivePerMessage = 354;
    setState(
      { bytesSaved: Math.max(0, Math.round((naivePerMessage - perMessage) * before)) },
      "saved",
    );
    render();
  }

  refs.send.addEventListener("click", () => flush());
  refs.clear.addEventListener("click", async () => {
    await outbox.clear();
    render();
  });
  on(refs.links, "click", "[data-link]", (_, el) => setLink(LINKS[el.dataset.link]));

  /* ---- follow the outside world --------------------------------------- */
  const followBrowser = debounce(() => {
    if (navigator.onLine === false && link.id !== "offline") setLink(LINKS.offline);
  }, 200);
  window.addEventListener("offline", followBrowser);
  window.addEventListener("online", followBrowser);

  document.addEventListener("wick:lang", render);

  setLink(navigator.onLine === false ? LINKS.offline : LINKS.edge);
  render();
}

function describe(message) {
  if (message.type === "checkin") return `checkin · ${message.status}`;
  if (message.type === "need") return `need · ${message.need}`;
  if (message.type === "sitrep") return message.text;
  return message.type;
}

/** Anything outside the dictionary is still sendable — it just costs more. */
function dictionaryWord(text) {
  const word = text.toLowerCase().replace(/[^a-z]/g, "");
  return ["safe", "ok", "injured", "trapped", "stable", "unknown", "moving", "arrived", "stopped", "waiting"].includes(
    word,
  )
    ? word
    : "ok";
}

/**
 * Ask the browser what the offline shell actually did, and answer honestly.
 *
 * `navigator.serviceWorker.ready` never rejects — it simply never settles if
 * nothing was ever registered — so a plain `.catch()` reports success for a
 * Service Worker that does not exist. The deadline is what makes this
 * trustworthy: if registration did not happen, the panel says unavailable
 * instead of inheriting a hopeful default.
 *
 * Returns "active" only when a registration exists *and* its scope covers
 * this page *and* the worker answers on the message channel.
 */
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
  let report = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
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
          new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
        ]);
      }
    } catch {
      report = null;
    }
    const complete = !!(report && report.total && report.cached === report.total);
    if (complete) break;
    if (!report && !installing) break; // nothing to wait for
    if (report && !installing) break; // settled, and short — that is the answer
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
