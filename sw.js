/**
 * sw.js — the offline shell.
 *
 * Everything below is cached on install, so the page can be opened again with
 * no network at all. That is not a nice-to-have for this project: a tool that
 * claims to work at 1% has to keep working when the network is the first thing
 * to go, including the page that describes it.
 */

const VERSION = "wick-v2";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/css/tokens.css",
  "./assets/css/base.css",
  "./assets/css/app.css",
  "./assets/css/motion.css",
  "./src/main.js",
  "./src/core/bits.js",
  "./src/core/dictionary.js",
  "./src/core/codec.js",
  "./src/core/cipher.js",
  "./src/core/secure.js",
  "./src/core/baseline.js",
  "./src/core/energy.js",
  "./src/core/budget.js",
  "./src/core/store.js",
  "./src/core/sync.js",
  "./src/core/sim.js",
  "./src/ui/i18n.js",
  "./src/ui/lang/en.js",
  "./src/ui/lang/zh.js",
  "./src/ui/dom.js",
  "./src/ui/settings.js",
  "./src/ui/state.js",
  "./src/ui/telemetry.js",
  "./src/ui/reveal.js",
  "./src/ui/hero.js",
  "./src/ui/cost.js",
  "./src/ui/bench.js",
  "./src/ui/seal.js",
  "./src/ui/lab.js",
  "./src/ui/field.js",
  "./src/ui/sharecard.js",
  "./src/ui/tour.js",
  "./src/ui/impact.js",
  "./src/ui/craft.js",
  "./src/ui/craft-data.js",
  "./src/ui/budget-data.js",
  "./src/ui/offline.js",
  "./src/workers/codec.worker.js",
  "./src/workers/sim.worker.js",
];

let shellReport = { version: VERSION, total: SHELL.length, cached: 0, failed: [] };

/**
 * Cache the shell one entry at a time.
 *
 * `cache.addAll()` is atomic: a single 404 rejects the whole batch and leaves
 * the cache empty, which is exactly how an offline-first page ends up online
 * only. It also fails silently if the rejection is swallowed. So we put entries
 * individually, keep every entry that does resolve, and record the ones that
 * did not — a missing file should cost you that file, not the whole shell.
 *
 * The result is readable as `wick:shell` on the page (section 04 reports it),
 * so "shell cached" is a claim you can check rather than a claim you trust.
 */async function precache() {
  const cache = await caches.open(VERSION);
  const failed = [];
  await Promise.all(
    SHELL.map(async (entry) => {
      try {
        const response = await fetch(entry, { cache: "reload" });
        if (!response.ok) throw new Error(`${response.status}`);
        await cache.put(entry, response);
      } catch (error) {
        failed.push(`${entry} (${error.message})`);
      }
    }),
  );
  installFailures = failed;
  return describeShell();
}

/** Failures remembered for this worker instance; the cache itself is truth. */
let installFailures = [];

/**
 * Describe the cache by reading it, not by remembering what happened.
 *
 * A Service Worker is torn down between events, so an in-memory "install went
 * fine" flag is worth nothing the next time it wakes up. Reading the cache
 * means the page can ask "shell cached?" at any point and get the state of the
 * disk rather than the state of some variable that no longer exists.
 */
async function describeShell() {
  const cache = await caches.open(VERSION);
  const present = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
  const missing = SHELL.filter((entry) => {
    const path = new URL(entry, self.location.href).pathname;
    return !present.has(path);
  });
  return {
    version: VERSION,
    total: SHELL.length,
    cached: SHELL.length - missing.length,
    missing,
    failed: installFailures,
  };
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("message", (event) => {
  if (event.data !== "wick:shell") return;
  event.waitUntil(
    describeShell().then((report) => {
      const reply = { type: "wick:shell", ...report };
      // A transferred port is the reliable channel; event.source is the
      // fallback for a plain postMessage from a client.
      if (event.ports && event.ports[0]) event.ports[0].postMessage(reply);
      else if (event.source) event.source.postMessage(reply);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  /*
   * Navigations: serve the shell when the visitor asked for the shell.
   *
   * The first version answered *every* navigation in scope with the cached
   * `index.html`. For a single-page app that looks like it works — until the
   * origin also serves something else. The test pages live under `/tests/`,
   * and asking for one of them returned the app instead, whose relative
   * `assets/…` and `src/…` then resolved against `/tests/` and 404ed. A shell
   * that answers for URLs it was never given is not offline support, it is a
   * hijacked origin.
   *
   * So: match the request against the navigation entries actually in the shell,
   * and let anything else go to the network like a normal page.
   */
  const NAVIGATION_ENTRIES = ["./", "./index.html"];

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const inShell = NAVIGATION_ENTRIES.some((entry) => {
          const shellUrl = new URL(entry, self.location.href);
          // `/` and `/index.html` are the same document.
          return url.pathname === shellUrl.pathname || (entry === "./" && url.pathname === "/");
        });
        if (!inShell) return fetch(request);

        const cached = await cache.match("./index.html");
        if (cached) {
          // Refresh in the background so the next offline load is current.
          event.waitUntil(
            fetch(request)
              .then((response) => (response.ok && response.type === "basic" ? cache.put("./index.html", response.clone()) : null))
              .catch(() => null),
          );
          return cached;
        }
        return fetch(request);
      })().catch(() => caches.match("./index.html")),
    );
    return;
  }

  // Everything else: cache first, then network, then whatever we have.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
